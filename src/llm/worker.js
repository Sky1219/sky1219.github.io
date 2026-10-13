// Runs GPT-2 off the main thread. Messages in: { type: 'init', manifest, buf } (buf is the packed weights,
// transferred), { type: 'run', id, ids, policy, budget, watch } for the KV-cache experiment, and
// { type: 'score', ... } and { type: 'embed', ... } for the games (src/play/). Messages out: 'ready', per-token
// 'tick' updates, and a last 'done' (run) or 'scored' (score, embed).
import { loadModel, Session, logSoftmaxAt, argmax } from './gpt2.js';

let model = null, scorer = null, fed = [];

/* score: feed ids through a full cache and report what the model made of them.
     from    the first position whose token is scored: lps[i] is the log-probability of ids[from + i] given
             everything before it, tops[i] the token the model would have picked there
     want    token ids whose probability as the next token (after all of ids) is reported
     topk    how many of the likeliest next tokens to report, as [id, p]
     gen     how many tokens to generate greedily after ids (out), with want[0]'s probability at each (along)
     ticks   post a 'tick' for each scored position as it's reached
   The session is kept between requests, and whatever prefix the new ids share with the last ones isn't recomputed. */
function score(msg, post) {
  const { id, ids, from = ids.length, want = [], topk = 0, gen = 0, ticks = false } = msg;
  if (!scorer) scorer = new Session(model, { maxLen: 512 });
  let n = 0; const keep = Math.max(0, Math.min(from, ids.length) - 1);
  while (n < keep && n < fed.length && fed[n] === ids[n]) n++;
  scorer.rewind(n); fed.length = n;
  const next = want.length || topk || gen, lps = [], tops = [];
  let logits = null;
  for (let t = n; t < ids.length; t++) {
    const last = t === ids.length - 1, scored = !last && t + 1 >= from;
    logits = scorer.step(ids[t], 3, scored || (last && next)).logits; fed.push(ids[t]);
    if (scored) { lps.push(logSoftmaxAt(logits, ids[t + 1])); tops.push(argmax(logits)); if (ticks) post({ type: 'tick', id, i: lps.length - 1, lp: lps[lps.length - 1] }); }
  }
  const out = { type: 'scored', id, lps, tops, want: [], top: [], out: [], along: [] };
  const probs = () => {
    let mx = -Infinity, z = 0; for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
    for (let i = 0; i < logits.length; i++) z += Math.exp(logits[i] - mx);
    return (i) => Math.exp(logits[i] - mx) / z;
  };
  if (want.length || topk) {
    const p = probs();
    out.want = want.map(p);
    if (topk) out.top = Array.from(logits.keys()).sort((a, b) => logits[b] - logits[a]).slice(0, topk).map((i) => [i, p(i)]);
  }
  // along[g] is the probability of want[0] as the g-th generated token, on the path the model actually takes
  for (let g = 0; g < gen && fed.length < 510; g++) {
    if (want.length) out.along.push(probs()(want[0]));
    const tk = argmax(logits); out.out.push(tk);
    if (g < gen - 1) { logits = scorer.step(tk).logits; fed.push(tk); }
  }
  post(out);
}

// embed: a sentence embedding with no forward pass, the weighted mean of the model's token embeddings for ids
function embed({ id, ids, weights }, post) {
  const D = model.D, { q, s } = model.wte, mean = new Float32Array(D); let z = 0;
  ids.forEach((tk, k) => { const w = weights ? weights[k] : 1; z += w; for (let i = 0; i < D; i++) mean[i] += q[tk * D + i] * s[tk] * w; });
  for (let i = 0; i < D; i++) mean[i] /= z || 1;
  post({ type: 'scored', id, mean });
}

// pause, when given, is awaited between tokens of a run: in a page (no worker) it lets the page keep drawing
const handle = async (msg, post, pause) => {
  if (msg.type === 'init') { model = loadModel(msg.manifest, msg.buf); scorer = null; fed = []; post({ type: 'ready' }); return; }
  if (msg.type === 'score') return score(msg, post);
  if (msg.type === 'embed') return embed(msg, post);
  if (msg.type === 'run') {
    const { id, ids, policy, budget, watch = 3 } = msg, s = new Session(model, { policy, budget, maxLen: Math.max(ids.length + 2, 8) });
    const t0 = performance.now(); let nll = 0;
    for (let t = 0; t < ids.length; t++) {
      const r = s.step(ids[t], watch);
      const lp = t < ids.length - 1 ? logSoftmaxAt(r.logits, ids[t + 1]) : 0; nll -= lp;
      post({ type: 'tick', id, t, lp, top: argmax(r.logits), kept: r.kept, seen: r.seen, evicted: r.evicted, cache: s.cacheBytes });
      if (pause) await pause();
    }
    const n = Math.max(1, ids.length - 1);
    post({ type: 'done', id, ppl: Math.exp(nll / n), ms: (performance.now() - t0) / ids.length, cache: s.cacheBytes });
  }
};
// as a worker; the same handler is used in-page when workers aren't available (see engine.js)
if (typeof self !== 'undefined' && typeof window === 'undefined') self.onmessage = (e) => handle(e.data, (m) => self.postMessage(m));
export { handle };
