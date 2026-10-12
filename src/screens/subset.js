// Data subset selection, as it runs on the lab workstation with submodlib: embed the data, build a facility-location
// function, maximize it with lazy greedy for a budget, compare what other submodular functions (graph cut,
// log-determinant) pick from the same data, then train on the subset. The point cloud, the picks, the gains and
// the evaluation counts are computed here for real (a 2D toy); the accuracy curves at the end are illustrative.
import { Screen, C, CLASS, MONO, text, rect, line, pane, code, axes, rng, clamp, ease, fmt } from './kit.js';

const SRC = `import numpy as np
from submodlib import FacilityLocationFunction

X = encoder.embed(train_images)    # (n, 512)
fl = FacilityLocationFunction(
    n=len(X), data=X, mode="dense",
    metric="cosine")
# f(S) = sum_i  max_{j in S} sim(i, j)
picks = fl.maximize(budget=k,
    optimizer="LazyGreedy")
idx = [i for i, gain in picks]
model = train(ResNet18(), train_images[idx])
evaluate(model, test_set)`;
const SRC2 = `from submodlib import (FacilityLocationFunction,
    GraphCutFunction, LogDeterminantFunction)

fns = {
  "facility location": FacilityLocationFunction(
      n, mode="dense", data=X, metric="cosine"),
  "graph cut": GraphCutFunction(
      n, mode="dense", data=X, lambdaVal=0.4),
  "log determinant": LogDeterminantFunction(
      n, mode="dense", data=X, lambdaVal=1.0),
}
for name, f in fns.items():
    picks[name] = f.maximize(budget=k,
        optimizer="LazyGreedy")`;
const HL = [3, 4, 7, 8, 12, 11];

// the data: five classes, one of them small, in a 2D stand-in for the embedding space
const R = rng(7), PTS = [];
const CL = [[0.25, 0.3, 70, 0.09], [0.7, 0.28, 60, 0.1], [0.45, 0.68, 60, 0.11], [0.82, 0.72, 34, 0.07], [0.12, 0.8, 10, 0.04]];
CL.forEach(([cx, cy, n, s], c) => { for (let i = 0; i < n; i++) { const a = R() * 6.28, r = Math.sqrt(-2 * Math.log(R() + 1e-9)) * s * 0.6; PTS.push({ x: clamp(cx + Math.cos(a) * r, 0.03, 0.97), y: clamp(cy + Math.sin(a) * r, 0.04, 0.96), c, d: R() }); } });
const N = PTS.length, K = 24;
const sim = (i, j) => Math.exp(-((PTS[i].x - PTS[j].x) ** 2 + (PTS[i].y - PTS[j].y) ** 2) / 0.02);
const f = (S) => { let s = 0; for (let i = 0; i < N; i++) { let m = 0; for (const j of S) m = Math.max(m, sim(i, j)); s += m; } return s; };
const GREEDY = [], GAINS = [], FS = [0];
{ const best = new Float64Array(N); let total = 0;
  for (let k = 0; k < K; k++) {
    let bj = -1, bg = -1;
    for (let j = 0; j < N; j++) { if (GREEDY.includes(j)) continue; let g = 0; for (let i = 0; i < N; i++) g += Math.max(0, sim(i, j) - best[i]); if (g > bg) { bg = g; bj = j; } }
    GREEDY.push(bj); GAINS.push(bg); for (let i = 0; i < N; i++) best[i] = Math.max(best[i], sim(i, bj)); total += bg; FS.push(total);
  } }
// how many marginal-gain evaluations lazy greedy needs (stale gains are upper bounds, by submodularity)
const LAZY_EVALS = (() => {
  const best = new Float64Array(N), ub = Array.from({ length: N }, () => Infinity), chosen = new Set(); let evals = 0;
  const gain = (j) => { evals++; let g = 0; for (let i = 0; i < N; i++) g += Math.max(0, sim(i, j) - best[i]); return g; };
  for (let k = 0; k < K; k++) {
    for (;;) {
      let top = -1; for (let j = 0; j < N; j++) if (!chosen.has(j) && (top < 0 || ub[j] > ub[top])) top = j;
      const g = gain(top); ub[top] = g;
      let next = -1; for (let j = 0; j < N; j++) if (!chosen.has(j) && j !== top && (next < 0 || ub[j] > ub[next])) next = j;
      if (next < 0 || g >= ub[next]) { chosen.add(top); for (let i = 0; i < N; i++) best[i] = Math.max(best[i], sim(i, top)); break; }
    }
  }
  return evals;
})();
const NAIVE_EVALS = Array.from({ length: K }, (_, k) => N - k).reduce((a, b) => a + b, 0);
// graph cut: f(S) = sum_{i in V, j in S} s_ij - lambda * sum_{i, j in S} s_ij. Favors central, representative points.
const GRAPHCUT = (() => {
  const lam = 0.4, col = Array.from({ length: N }, (_, j) => { let t = 0; for (let i = 0; i < N; i++) t += sim(i, j); return t; }), S = [];
  for (let k = 0; k < K; k++) {
    let bj = -1, bg = -Infinity;
    for (let j = 0; j < N; j++) { if (S.includes(j)) continue; let inS = 0; for (const q of S) inS += sim(j, q); const g = col[j] - lam * (2 * inS + 1); if (g > bg) { bg = g; bj = j; } }
    S.push(bj);
  }
  return S;
})();
// log-determinant: f(S) = log det(L_S + lambda I). Favors diverse points; greedy by incremental Cholesky.
const LOGDET = (() => {
  const lam = 1.0, S = [], V = [];                          // V[k][j]: Cholesky rows for the chosen points
  const d2 = Array.from({ length: N }, () => 1 + lam);
  for (let k = 0; k < K; k++) {
    let bj = -1; for (let j = 0; j < N; j++) if (!S.includes(j) && (bj < 0 || d2[j] > d2[bj])) bj = j;
    const dj = Math.sqrt(d2[bj]), row = new Float64Array(N);
    for (let j = 0; j < N; j++) { let e = sim(bj, j); for (let q = 0; q < V.length; q++) e -= V[q][bj] * V[q][j]; row[j] = e / dj; d2[j] -= row[j] * row[j]; }
    V.push(row); S.push(bj);
  }
  return S;
})();
const FUNCS = [['facility location', C.orange, GREEDY], ['graph cut', C.purple, GRAPHCUT], ['log determinant', C.green, LOGDET]];
const classes = (S) => new Set(S.map((j) => PTS[j].c)).size;
const coverage = (S) => f(S) / FULL;
const spread = (S) => { let m = Infinity; for (const a of S) for (const b of S) if (a < b) m = Math.min(m, Math.hypot(PTS[a].x - PTS[b].x, PTS[a].y - PTS[b].y)); return m; };
const RAND = (() => { const r = rng(3), s = new Set(); while (s.size < K) s.add((r() * N) | 0); return [...s]; })();
const FULL = f([...Array(N).keys()]);
const nearest = (i, S) => { let b = -1, m = -1; for (const j of S) { const v = sim(i, j); if (v > m) { m = v; b = j; } } return [b, m]; };
const curve = (top, rate) => (e) => top * (1 - Math.exp(-e / rate)) + 0.1 * Math.exp(-e / rate);
const CURVES = [['all data', C.dim, curve(0.93, 4.2)], ['facility location, 10%', C.orange, curve(0.89, 3.9)], ['random, 10%', C.blue, curve(0.82, 4.4)]];

export class SubsetScreen extends Screen {
  constructor(w, h) { super(w, h, [6, 6.5, 6.5, 9, 9.5, 9]); this.goto(0); }
  onStep(s) {
    this.lines = []; const p = (x, c) => this.print(x, c);
    if (s === 0) { p('$ python select_subset.py --budget 0.10', C.green); p(`loading train_images ... ${N} examples`); }
    if (s === 1) { p('$ python select_subset.py --budget 0.10', C.green); p(`embedding done: X.shape = (${N}, 512)`); p(`building dense similarity kernel ${N} x ${N} ...`); }
    if (s === 2) { p('>>> fl.marginalGain(S, near)', C.green); p(fmt(this.nearGain, 2), C.yellow); p('>>> fl.marginalGain(S, far)', C.green); p(fmt(this.farGain, 2), C.yellow); }
    if (s === 3) { p('maximizing: budget=24, optimizer=LazyGreedy', C.green); }
    if (s === 4) {
      p('$ python compare_functions.py --budget 24', C.green);
      FUNCS.forEach(([name, col, S]) => p(`${name.padEnd(18)} classes ${classes(S)}/5  coverage ${fmt(coverage(S), 2)}  min dist ${fmt(spread(S), 3)}`, col));
    }
    if (s === 5) { p(`subset: ${K} / ${N} examples, f(S) = ${fmt(FS[K] / FULL, 3)} of f(V)`, C.ink); p('$ python train.py --subset fl.npy --epochs 20', C.green); }
    this.logged = 0;
  }
  get nearGain() { const S = GREEDY.slice(0, 3), a = GREEDY[0]; let j = 0, m = 1e9; PTS.forEach((p, i) => { const d = (p.x - PTS[a].x) ** 2 + (p.y - PTS[a].y) ** 2; if (i !== a && d < m) { m = d; j = i; } }); return f([...S, j]) - f(S); }
  get farGain() { const S = GREEDY.slice(0, 3); return f([...S, GREEDY[3]]) - f(S); }
  update() {
    const s = this.step, st = this.st;
    if (s === 0) { const k = Math.floor(st / 0.9); if (k > this.logged && k <= 5) { this.logged = k; this.print(`encoder.embed  batch ${k * 2}/10  ${'#'.repeat(k * 4).padEnd(20, '.')}`, C.dim); } }
    if (s === 3) { const k = this.picks; while (this.logged < k) { const i = this.logged; this.print(`k=${String(i + 1).padStart(2)}  pick=${String(GREEDY[i]).padStart(3)}  gain=${fmt(GAINS[i], 2).padStart(6)}  f(S)=${fmt(FS[i + 1], 1)}`, i < 5 ? C.ink : C.dim); this.logged++; }
      if (k === K && this.logged === K) { this.logged++; this.print(`done: ${LAZY_EVALS} gain evaluations (NaiveGreedy needs ${NAIVE_EVALS.toLocaleString('en-US')})`, C.green); } }
    if (s === 5) { const e = Math.floor(this.epoch); if (e > this.logged && e % 4 === 0) { this.logged = e; this.print(`epoch ${String(e).padStart(2)}  val_acc  all=${fmt(CURVES[0][2](e), 3)}  fl=${fmt(CURVES[1][2](e), 3)}  rand=${fmt(CURVES[2][2](e), 3)}`); } }
  }
  get picks() { return this.step < 3 ? (this.step >= 1 ? 3 : 0) : this.step === 3 ? Math.min(K, Math.floor(this.st / 0.3) + 1) : K; }
  get epoch() { return Math.min(20, this.st * 3.2); }
  draw(ctx) {
    const { w, h } = this, s = this.step, st = this.st;
    this.chrome(ctx, 'akash@caraml-ws3: ~/subset-selection', 'CARAML Lab');
    // code
    const cb = pane(ctx, 8, 38, 430, 342, 'select_subset.py', { accent: C.orange });
    if (s === 4) code(ctx, SRC2, cb.x + 14, cb.y + 6, { size: 12, lh: 21.5, hl: Math.min(12, 4 + Math.floor(this.st / 2.2) * 2), width: cb.w - 10 });
    else code(ctx, SRC, cb.x + 14, cb.y + 6, { size: 13, lh: 21.5, hl: HL[s], width: cb.w - 10 });
    // embedding space
    if (s === 4) return this.drawCompare(ctx);
    const eb = pane(ctx, 446, 38, w - 454, 342, 'embedding space (2D view)', { accent: C.blue, right: `n = ${N}` });
    const X = (v) => eb.x + 6 + v * (eb.w - 12), Y = (v) => eb.y + 4 + v * (eb.h - 8);
    const shown = s === 0 ? Math.floor(ease(st / 4) * N) : N, picks = GREEDY.slice(0, this.picks);
    if (s >= 1 && s <= 3 && picks.length) {               // each point to the pick that covers it best
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) { const [j, m] = nearest(i, picks); if (m < 0.02) continue; ctx.strokeStyle = `rgba(255,154,60,${m * (s === 3 ? 0.35 : 0.5)})`; ctx.beginPath(); ctx.moveTo(X(PTS[i].x), Y(PTS[i].y)); ctx.lineTo(X(PTS[j].x), Y(PTS[j].y)); ctx.stroke(); }
    }
    for (let i = 0; i < shown; i++) { const p = PTS[i]; rect(ctx, X(p.x) - 2.5, Y(p.y) - 2.5, 5, 5, { fill: CLASS[p.c], r: 3, alpha: s === 5 ? 0.45 : 0.85 }); }
    if (s === 5) for (const j of RAND) { const x = X(PTS[j].x), y = Y(PTS[j].y); line(ctx, [[x - 5, y - 5], [x + 5, y + 5]], { color: C.blue, lw: 2 }); line(ctx, [[x - 5, y + 5], [x + 5, y - 5]], { color: C.blue, lw: 2 }); }
    picks.forEach((j, k) => { ctx.strokeStyle = C.orange; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(PTS[j].x), Y(PTS[j].y), 7 + (k === picks.length - 1 && s === 3 ? 4 * (1 - ((st / 0.32) % 1)) : 0), 0, 6.3); ctx.stroke(); });
    if (s === 2) {                                         // a candidate next to a pick gains little; one in new territory gains a lot
      const a = GREEDY[0], far = GREEDY[3], pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
      const tag = (j, label, col) => { const x = X(PTS[j].x), y = Y(PTS[j].y); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 14 + pulse * 3, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); ctx.font = `13px ${MONO}`; const tw = ctx.measureText(label).width + 16, lx = x + 16 + tw > eb.x + eb.w ? x - 16 - tw : x + 16; rect(ctx, lx, y - 24, tw, 22, { fill: '#0b0f14', stroke: col, r: 4 }); text(ctx, label, lx + 8, y - 13, { size: 13, color: col }); };
      tag(a, `near a pick: +${fmt(this.nearGain, 1)}`, C.red); tag(far, `new region: +${fmt(this.farGain, 1)}`, C.green);
    }
    if (s === 5) { text(ctx, '○ facility location   × random', eb.x + eb.w - 4, eb.y + eb.h - 6, { size: 12, color: C.dim, align: 'right' });
      const miss = RAND.filter((j) => PTS[j].c === 4).length, hit = GREEDY.filter((j) => PTS[j].c === 4).length;
      text(ctx, `smallest class: FL ${hit} picks, random ${miss}`, eb.x + 4, eb.y + 10, { size: 13, color: C.pink }); }
    // terminal
    this.terminal(ctx, 8, 388, 500, h - 396);
    // plot
    const titles = ['f(S) as the subset grows', 'f(S) = coverage of every example', 'marginal gain of each greedy pick', 'f(S) / f(all data)', '', 'validation accuracy (illustrative)'];
    const pb = pane(ctx, 516, 388, w - 524, h - 396, titles[s], { accent: C.purple });
    if (s <= 1) {
      text(ctx, 'f(S) = Σ  max  sim(i, j)', pb.x + pb.w / 2, pb.y + 50, { size: 22, color: C.ink, align: 'center' });
      text(ctx, 'i∈V  j∈S', pb.x + pb.w / 2 - 34, pb.y + 76, { size: 12, color: C.dim, align: 'center' });
      text(ctx, s === 0 ? 'how well the subset S covers every example i' : 'each example counts once, through its closest pick', pb.x + pb.w / 2, pb.y + 118, { size: 13, color: C.dim, align: 'center' });
    } else if (s === 2) {
      const a = axes(ctx, pb.x, pb.y, pb.w, pb.h, { xlim: [0, K], ylim: [0, GAINS[0] * 1.1], xlabel: 'pick number', yticks: [0, 10, 20, 30].filter((v) => v < GAINS[0] * 1.1), xticks: [1, 8, 16, 24] });
      const bw = (a.R - a.L) / K - 2;
      GAINS.forEach((g, i) => { const k = ease(st * 2 - i * 0.06); rect(ctx, a.X(i) + 1, a.Y(g * k), bw, a.B - a.Y(g * k), { fill: i < 3 ? C.orange : C.purple, alpha: 0.85 }); });
    } else if (s === 3) {
      const a = axes(ctx, pb.x, pb.y, pb.w, pb.h, { xlim: [0, K], ylim: [0, 1], xlabel: '|S|', yticks: [0, 0.5, 1], xticks: [0, 8, 16, 24] });
      text(ctx, 'greedy is within 1 − 1/e of the best size-k subset', a.R - 4, a.B - 14, { size: 12, color: C.dim, align: 'right' });
      text(ctx, `lazy greedy: ${LAZY_EVALS} evaluations vs ${NAIVE_EVALS.toLocaleString('en-US')} naive`, a.R - 4, a.B - 32, { size: 12, color: C.green, align: 'right' });
      line(ctx, FS.slice(0, this.picks + 1).map((v, i) => [a.X(i), a.Y(v / FULL)]), { color: C.orange, lw: 2.5 });
    } else {
      const a = axes(ctx, pb.x, pb.y, pb.w, pb.h, { xlim: [0, 20], ylim: [0, 1], xlabel: 'epoch', yticks: [0, 0.5, 1], xticks: [0, 5, 10, 15, 20] });
      const E = this.epoch;
      CURVES.forEach(([name, col, fn], k) => { const pts = []; for (let e = 0; e <= E; e += 0.25) pts.push([a.X(e), a.Y(fn(e))]); line(ctx, pts, { color: col, lw: 2.5, dash: k === 0 ? [6, 4] : null }); text(ctx, name, a.R - 4, a.B - 50 + k * 17, { size: 12, color: col, align: 'right' }); });
    }
  }
  // the same data, three submodular functions, three different subsets
  drawCompare(ctx) {
    const { w, h } = this, st = this.st, eb = pane(ctx, 446, 38, w - 454, 342, 'same budget, different functions', { accent: C.blue, right: 'k = 24' });
    const cw = eb.w / 3;
    FUNCS.forEach(([name, col, S], q) => {
      const x0 = eb.x + q * cw, X = (v) => x0 + 4 + v * (cw - 8), Y = (v) => eb.y + 26 + v * (eb.h - 34);
      if (q) line(ctx, [[x0, eb.y], [x0, eb.y + eb.h]], { color: C.line });
      text(ctx, name, x0 + cw / 2, eb.y + 8, { size: 13, color: col, align: 'center' });
      for (const p of PTS) rect(ctx, X(p.x) - 2, Y(p.y) - 2, 4, 4, { fill: CLASS[p.c], r: 2, alpha: 0.45 });
      const n = Math.min(S.length, Math.floor(st / 0.12));
      S.slice(0, n).forEach((j) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(PTS[j].x), Y(PTS[j].y), 5, 0, 6.3); ctx.stroke(); });
    });
    this.terminal(ctx, 8, 388, 500, h - 396);
    const pb = pane(ctx, 516, 388, w - 524, h - 396, 'what each subset is good at', { accent: C.purple });
    const rows = [['classes covered', (S) => classes(S) / 5, (S) => `${classes(S)}/5`], ['coverage f_FL(S)/f_FL(V)', coverage, (S) => fmt(coverage(S), 2)], ['spread (min distance)', (S) => spread(S) / Math.max(...FUNCS.map((F) => spread(F[2]))), (S) => fmt(spread(S), 3)]];
    rows.forEach(([label, val, show], r) => {
      const y = pb.y + 8 + r * 52; text(ctx, label, pb.x, y, { size: 12, color: C.dim });
      FUNCS.forEach(([name, col, S], q) => { const k = ease(st / 1.5 - r * 0.3); const by = y + 14 + q * 11; rect(ctx, pb.x, by, (pb.w - 70) * val(S) * k, 8, { fill: col }); text(ctx, show(S), pb.x + pb.w - 4, by + 4, { size: 11, color: col, align: 'right' }); });
    });
  }
}
