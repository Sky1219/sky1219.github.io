// KV-cache eviction as sub-cache runs it: tokens are decoded one at a time, each adds a key/value entry, and with
// a fixed budget something has to be evicted. The heatmap is the attention each new query pays to earlier keys;
// evicted keys go dark. Attention here is simulated (kvsim.js), not a real model, and the table says so.
import { Screen, C, text, rect, line, pane, ease, clamp } from './kit.js';
import { TEXT, ATT, POLICIES, simulate, average, topicOf } from './kvsim.js';
import { drawLive } from './kvlive.js';

// live mode: which policy each step features (step 2 cycles through the baselines)
const FEATURE = [['full'], ['stream'], ['stream', 'h2o', 'snap'], ['fl'], ['fl']];

const B = 10;
const RUNS = Object.fromEntries(POLICIES.map((p) => [p.id, simulate(p.id, B)]));
const AVG = Object.fromEntries(POLICIES.map((p) => [p.id, average(RUNS[p.id])]));
const PER = 0.42;                          // seconds per decoded token on screen

export class KvScreen extends Screen {
  constructor(w, h) { super(w, h, [5, 5, 15, 8, 9]); this.goto(0); }
  // switch to the real model: L is src/llm/live.js's state
  attachLive(L) { this.live = L; this.featured = 'fl'; this.cyc = 0; }
  get isLive() { return !!this.live && !['idle', 'ready'].includes(this.live.phase); }
  goto(i) {
    if (!this.isLive) return super.goto(i);
    this.step = ((i % 5) + 5) % 5; this.st = 0; this.manual = true;
    const f = FEATURE[this.step]; this.featured = f[(this.cyc = this.step === 2 ? (this.cyc + 1) % 3 : 0)];
  }
  frame(ctx, dt) {
    this.hold = this.isLive;
    if (this.live && this.live.phase !== this.lastPhase) { if (this.live.phase === 'done' && !this.manual) this.featured = 'fl'; if (this.live.phase === 'running') this.manual = false; this.lastPhase = this.live.phase; }
    if (this.isLive && !this.manual && this.live.phase === 'running') {
      // while it runs, show each policy in turn
      this.featSt = (this.featSt || 0) + dt;
      if (this.featSt > 4) { this.featSt = 0; const i = ['full', 'stream', 'h2o', 'snap', 'fl'].indexOf(this.featured); this.featured = ['full', 'stream', 'h2o', 'snap', 'fl'][(i + 1) % 5]; }
    }
    if (this.isLive && !this.manual) this.step = this.live.phase === 'done' ? 4 : this.live.phase !== 'running' ? 0 : { full: 0, stream: 2, h2o: 2, snap: 2, fl: 3 }[this.featured];
    super.frame(ctx, dt);
  }
  onStep(s) {
    this.lines = [];
    const p = (x, c) => this.print(x, c);
    if (s === 0) { p('$ python -m subcache.decode --budget 10', C.green); p('prefill ... cache grows by one entry per token'); }
    if (s === 1) { p('cache full (10/10): evicting one entry per new token', C.yellow); }
    if (s === 2) { p('$ python -m subcache.bench --policy streamingllm,h2o,snapkv', C.green); }
    if (s === 3) { p('$ python -m subcache.bench --policy facility_location', C.green); p('f(S) = sum_i a_i max_{j in S} sim(k_i, k_j)   # a_i: attention so far', C.dim); }
    if (s === 4) { p('$ python -m subcache.report', C.green); POLICIES.forEach((q) => p(`${q.name.padEnd(22)} attn kept ${(AVG[q.id] * 100).toFixed(1)}%`, q.id === 'sub' ? C.orange : C.ink)); }
    this.lastI = -1;
  }
  // which policy is on screen, and how far through its run
  get state() {
    const s = this.step, st = this.st;
    if (s === 0) { const t = Math.min(B, 1 + Math.floor(st / PER)); return { t, kept: [...Array(t).keys()], pol: null, ev: null }; }
    const pol = s === 1 ? 'stream' : s === 2 ? ['stream', 'h2o', 'snap'][Math.min(2, Math.floor(st / 5))] : 'sub';
    const local = s === 2 ? st % 5 : st, run = RUNS[pol];
    const i = Math.min(run.length - 1, Math.floor(local / PER) + (s === 1 ? 0 : 20));
    return { ...run[i], pol, i, ev: i > 0 ? run[i - 1].evicted : null };
  }
  update() {
    if (this.isLive) return;
    const S = this.state;
    if (S.pol && S.i !== this.lastI && this.step >= 1 && this.step <= 3) {
      this.lastI = S.i;
      if (S.ev != null) this.print(`t=${String(S.t).padStart(2)}  "${TEXT[S.t]}"`.padEnd(22) + `evict "${TEXT[S.ev]}"`.padEnd(22) + `attn kept ${(S.seen * 100).toFixed(0)}%`, S.pol === 'sub' ? C.orange : C.dim);
    }
  }
  draw(ctx) {
    if (this.isLive) return drawLive(this, ctx, this.live);
    const { w, h } = this, s = this.step, S = this.state, t = S.t, kept = S.kept;
    const polName = S.pol ? POLICIES.find((p) => p.id === S.pol).name : 'filling';
    this.chrome(ctx, 'akash@caraml-ws3: ~/sub-cache', 'CARAML Lab');
    // attention heatmap: one row per query, one column per key
    const hb = pane(ctx, 8, 38, 610, 356, 'attention  (query x key)', { accent: C.blue, right: `policy: ${polName}` });
    const rows = 22, q0 = Math.max(1, t - rows + 1), cw = hb.w / TEXT.length, rh = (hb.h - 40) / rows;
    const keptTopics = new Set(kept.map(topicOf).filter(Boolean));
    for (let q = q0; q <= t; q++) {
      const y = hb.y + (q - q0) * rh, a = ATT[q];
      for (let k = 0; k < q; k++) {
        const v = clamp(a[k] * 6), alive = kept.includes(k) || (q < t);
        ctx.fillStyle = q === t ? (kept.includes(k) ? `rgba(255,154,60,${0.15 + v})` : `rgba(255,95,109,${0.1 + v * 0.8})`) : `rgba(90,169,255,${0.05 + v * (alive ? 0.9 : 0.3)})`;
        ctx.fillRect(hb.x + k * cw, y, Math.max(1, cw - 1), rh - 1);
      }
    }
    // the cache, as a strip of columns
    const sy = hb.y + rows * rh + 8;
    for (let k = 0; k <= t; k++) rect(ctx, hb.x + k * cw, sy, Math.max(1, cw - 1), 10, { fill: kept.includes(k) ? C.orange : k === t ? C.ink : '#2a1a1d' });
    if (S.ev != null) { const x = hb.x + S.ev * cw; rect(ctx, x - 2, hb.y, cw + 3, sy - hb.y + 12, { stroke: C.red, lw: 2, alpha: 0.9 }); }
    text(ctx, `query "${TEXT[t]}"   key/value entries kept: ${kept.length}/${B}`, hb.x, sy + 24, { size: 13, color: C.ink });
    // the cache contents
    const cb = pane(ctx, 626, 38, w - 634, 356, `KV cache  budget ${B}`, { accent: C.orange });
    text(ctx, 'slot', cb.x, cb.y + 4, { size: 12, color: C.dim }); text(ctx, 'pos', cb.x + 50, cb.y + 4, { size: 12, color: C.dim }); text(ctx, 'token', cb.x + 100, cb.y + 4, { size: 12, color: C.dim }); text(ctx, 'attn now', cb.x + 240, cb.y + 4, { size: 12, color: C.dim });
    for (let k = 0; k < B; k++) {
      const j = kept[k], y = cb.y + 30 + k * 27;
      rect(ctx, cb.x - 4, y - 11, cb.w + 8, 23, { fill: k % 2 ? 'rgba(255,255,255,0.02)' : null });
      text(ctx, String(k), cb.x, y, { size: 13, color: C.dim });
      if (j == null) { text(ctx, '—', cb.x + 50, y, { size: 13, color: C.faint }); continue; }
      text(ctx, String(j), cb.x + 50, y, { size: 13, color: C.dim });
      text(ctx, TEXT[j] === '<s>' ? '<s> (sink)' : TEXT[j], cb.x + 100, y, { size: 13, color: j === 0 ? C.purple : C.ink });
      const v = t < ATT.length && j < t ? ATT[t][j] : 0; rect(ctx, cb.x + 240, y - 5, 80 * clamp(v * 5), 10, { fill: C.blue });
    }
    text(ctx, keptTopics.size ? `topics covered: ${keptTopics.size}` : '', cb.x, cb.y + cb.h - 6, { size: 12, color: C.dim });
    // terminal and results
    this.terminal(ctx, 8, 402, 610, h - 410);
    const rb = pane(ctx, 626, 402, w - 634, h - 410, 'results  (toy attention)', { accent: C.purple });
    const order = [{ id: 'full', name: 'full cache' }, ...POLICIES];
    text(ctx, 'policy', rb.x, rb.y + 4, { size: 12, color: C.dim }); text(ctx, 'attn kept', rb.x + 190, rb.y + 4, { size: 12, color: C.dim }); text(ctx, 'KV size', rb.x + 290, rb.y + 4, { size: 12, color: C.dim });
    order.forEach((p, k) => {
      const y = rb.y + 28 + k * 24, done = p.id === 'full' || s === 4 || (s === 3 && p.id !== 'sub') || (s === 2 && ['stream', 'h2o', 'snap'].includes(p.id) && ['stream', 'h2o', 'snap'].indexOf(p.id) < Math.floor(this.st / 5)) || (s === 3 && p.id === 'sub' && this.st > 6);
      const v = p.id === 'full' ? 1 : AVG[p.id];
      text(ctx, p.name, rb.x, y, { size: 13, color: p.id === 'sub' ? C.orange : C.ink });
      text(ctx, done ? `${(v * 100).toFixed(1)}%` : '…', rb.x + 190, y, { size: 13, color: done && p.id === 'sub' ? C.orange : C.ink });
      text(ctx, p.id === 'full' ? '100%' : `${Math.round((B / TEXT.length) * 100)}%`, rb.x + 290, y, { size: 13, color: C.dim });
    });
  }
}
