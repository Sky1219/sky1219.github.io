// GPT-2, from scratch, in plain JavaScript: int8 weights (one scale per output row, see tools/pack_gpt2.py),
// fp32 activations, and an explicit per-layer KV cache that an eviction policy can actually evict from.
// GPT-2 adds absolute position embeddings at the input, so a cached key/value keeps meaning the same thing
// after other entries are dropped: eviction is just removing rows.
import { POLICIES } from './policies.js';

export function loadModel(manifest, buf) {
  const T = manifest.tensors, D = manifest.n_embd;
  const get = (name) => {
    const t = T[name]; if (!t) throw new Error(`missing tensor ${name}`);
    const n = t.shape.reduce((a, b) => a * b, 1);
    if (t.dtype === 'f32') return new Float32Array(buf, t.offset, n);
    return { q: new Int8Array(buf, t.offset, n), s: new Float32Array(buf, t.scale, t.shape[0]), out: t.shape[0], in: t.shape[1] };
  };
  const layers = [];
  for (let l = 0; l < manifest.n_layer; l++) {
    const p = `h.${l}.`;
    layers.push({
      ln1g: get(p + 'ln_1.g'), ln1b: get(p + 'ln_1.b'), attn: get(p + 'attn.c_attn'), attnb: get(p + 'attn.c_attn.b'),
      proj: get(p + 'attn.c_proj'), projb: get(p + 'attn.c_proj.b'), ln2g: get(p + 'ln_2.g'), ln2b: get(p + 'ln_2.b'),
      fc: get(p + 'mlp.c_fc'), fcb: get(p + 'mlp.c_fc.b'), fc2: get(p + 'mlp.c_proj'), fc2b: get(p + 'mlp.c_proj.b'),
    });
  }
  return { cfg: manifest, D, H: manifest.n_head, L: manifest.n_layer, wte: get('wte'), wpe: get('wpe'), layers, lnfg: get('ln_f.g'), lnfb: get('ln_f.b') };
}

// y = W x + b, W int8 [out][in] with a scale per output row
function matvec(W, x, b, y) {
  const { q, s, out, in: n } = W;
  for (let o = 0; o < out; o++) {
    let acc = 0, base = o * n;
    for (let i = 0; i < n; i += 4) acc += q[base + i] * x[i] + q[base + i + 1] * x[i + 1] + q[base + i + 2] * x[i + 2] + q[base + i + 3] * x[i + 3];
    y[o] = acc * s[o] + (b ? b[o] : 0);
  }
  return y;
}
function layerNorm(x, g, b, y) {
  const n = x.length; let m = 0, v = 0;
  for (let i = 0; i < n; i++) m += x[i];
  m /= n;
  for (let i = 0; i < n; i++) { const d = x[i] - m; v += d * d; }
  const r = 1 / Math.sqrt(v / n + 1e-5);
  for (let i = 0; i < n; i++) y[i] = (x[i] - m) * r * g[i] + b[i];
  return y;
}
const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));

/* One decoding session with its own KV cache.
   policy: 'full' | 'stream' | 'h2o' | 'snap' | 'fl'. budget: max entries kept per layer. */
export class Session {
  constructor(model, { policy = 'full', budget = Infinity, maxLen = 512 } = {}) {
    this.m = model; this.policy = POLICIES[policy]; this.budget = policy === 'full' ? Infinity : budget;
    const { D, L } = model, cap = Math.min(maxLen, this.budget === Infinity ? maxLen : this.budget + 1);
    this.cap = cap; this.t = 0;
    // per layer: keys, values, the original position of each entry, attention it has received, and the last
    // few attention rows it was part of (for SnapKV)
    this.layers = Array.from({ length: L }, () => ({ K: new Float32Array(cap * D), V: new Float32Array(cap * D), pos: [], acc: [], obs: [] }));
    const F = (n) => new Float32Array(n);
    this.x = F(D); this.h = F(D); this.qkv = F(3 * D); this.a = F(D); this.o = F(D); this.f = F(4 * D); this.g = F(D);
    this.logits = F(model.wte.out); this.scores = F(cap);
  }
  // feed one token; returns the logits for the next one, plus what the chosen layer attended to and evicted.
  // head = false skips the logits (half the work) for tokens whose prediction nobody will read.
  step(token, watch = 3, head = true) {
    const m = this.m, { D, H } = m, hd = D / H, x = this.x, t = this.t++;
    for (let i = 0; i < D; i++) x[i] = m.wte.q[token * D + i] * m.wte.s[token] + m.wpe[t * D + i];
    let seen = null; const evicted = [];
    for (let l = 0; l < m.L; l++) {
      const W = m.layers[l], C = this.layers[l];
      layerNorm(x, W.ln1g, W.ln1b, this.h);
      matvec(W.attn, this.h, W.attnb, this.qkv);
      // append this token's key and value
      const n = C.pos.length;
      C.K.set(this.qkv.subarray(D, 2 * D), n * D); C.V.set(this.qkv.subarray(2 * D, 3 * D), n * D);
      C.pos.push(t); C.acc.push(0); C.obs.push([]);
      const N = n + 1, sc = this.scores, row = new Float32Array(N);
      this.a.fill(0);
      for (let h = 0; h < H; h++) {
        const qo = h * hd; let mx = -Infinity;
        for (let j = 0; j < N; j++) { let d = 0; const ko = j * D + qo; for (let e = 0; e < hd; e++) d += this.qkv[qo + e] * C.K[ko + e]; d /= Math.sqrt(hd); sc[j] = d; if (d > mx) mx = d; }
        let z = 0; for (let j = 0; j < N; j++) { sc[j] = Math.exp(sc[j] - mx); z += sc[j]; }
        for (let j = 0; j < N; j++) {
          const p = sc[j] / z; row[j] += p / H;
          const vo = j * D + qo; for (let e = 0; e < hd; e++) this.a[qo + e] += p * C.V[vo + e];
        }
      }
      for (let j = 0; j < N; j++) { C.acc[j] += row[j]; C.obs[j].push(row[j]); if (C.obs[j].length > 8) C.obs[j].shift(); }
      if (l === watch) seen = { pos: C.pos.slice(), att: row };
      matvec(W.proj, this.a, W.projb, this.o);
      for (let i = 0; i < D; i++) x[i] += this.o[i];
      layerNorm(x, W.ln2g, W.ln2b, this.h);
      matvec(W.fc, this.h, W.fcb, this.f);
      for (let i = 0; i < this.f.length; i++) this.f[i] = gelu(this.f[i]);
      matvec(W.fc2, this.f, W.fc2b, this.o);
      for (let i = 0; i < D; i++) x[i] += this.o[i];
      // over budget: the policy picks one entry of this layer's cache to drop
      if (C.pos.length > this.budget) {
        const j = this.policy.evict(C, this.budget, D);
        if (l === watch) evicted.push(C.pos[j]);
        C.K.copyWithin(j * D, (j + 1) * D, C.pos.length * D); C.V.copyWithin(j * D, (j + 1) * D, C.pos.length * D);
        C.pos.splice(j, 1); C.acc.splice(j, 1); C.obs.splice(j, 1);
      }
    }
    layerNorm(x, m.lnfg, m.lnfb, this.g);
    if (head) matvec(m.wte, this.g, null, this.logits);
    return { logits: this.logits, seen, evicted, kept: this.layers[watch].pos.slice() };
  }
  // back to the first n tokens (full cache only), so a prompt that shares a prefix with the last one reuses it
  rewind(n) { for (const C of this.layers) { C.pos.length = n; C.acc.length = n; C.obs.length = n; } this.t = n; }
  // bytes held by the cache right now: keys and values, fp32, every layer
  get cacheBytes() { return this.layers.reduce((a, C) => a + C.pos.length * this.m.D * 2 * 4, 0); }
}

export function logSoftmaxAt(logits, k) {
  let mx = -Infinity; for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
  let z = 0; for (let i = 0; i < logits.length; i++) z += Math.exp(logits[i] - mx);
  return logits[k] - mx - Math.log(z);
}
export function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }
