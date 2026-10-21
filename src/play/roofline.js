// "Tune TinyLlama to beat the memory wall." Two parts. First a real measurement: DistilGPT-2 decodes a few dozen tokens on the visitor's
// own device, and since every token reads every weight, bytes / time is the memory bandwidth their browser got.
// Then a planner for TinyLlama-1.1B on the RTX 2080 Ti: pick the weight precision, the batch, and whether the
// kernels are fused and the GEMV runs at full occupancy, and a roofline model says the time per token. The model is calibrated to the
// measured 4.14 ms (fp16, batch 1, fused, full occupancy) and lands near the measured batches (7,553 tok/s at 64);
// the challenges are about where the time goes.
import { C, text, rect, line, pane, clamp, SANS, MONO } from '../screens/kit.js';
import { engine, ask, encode } from '../llm/engine.js';
import { about, table } from './index.js';
import { GPU, MODEL, FLOOR } from '../screens/hipinfer.js';

const PEAK = 34;                                         // TFLOP/s the batched GEMMs reach, fitted to hipinfer's batch 8 and 64 runs
const FLOP = 2 * 1.1e9;                                  // per token: two per weight
const LAYERS = 22, LAUNCH = 0.002;                       // ms of launch overhead per kernel
const PRECISION = { fp16: 1, int8: 0.5, int4: 0.25 };    // weight bytes, relative to fp16
const BATCHES = [1, 2, 4, 8, 16, 32, 64];

// one decode step for every user in the batch; each user gets one token per step
export function step({ prec, batch, fused, splitk }) {      // splitk: the occupancy-sized GEMV
  const gb = MODEL.gb * PRECISION[prec];
  const eff = (splitk || batch >= 8 ? 0.88 : 0.55) - (fused ? 0 : 0.03);   // share of the card's bandwidth the weight reads reach
  const mem = (gb / (GPU.bw * eff)) * 1000, math = (batch * FLOP) / (PEAK * 1e9);
  const launch = LAYERS * (fused ? 5 : 9) * LAUNCH;
  const ms = mem + math + launch;                       // measured batches fit this better than max(mem, math)
  return { gb, mem, math, launch, ms, tps: (batch / ms) * 1000, bound: math > mem ? 'compute' : 'memory', floor: (gb / GPU.bw) * 1000 };
}

const GOALS = [
  { id: 'match', title: 'Match hipinfer', how: 'fp16 at batch 1, within 4.2 ms per token', ok: (c, r) => c.prec === 'fp16' && c.batch === 1 && r.ms <= 4.2,
    why: 'Fusing cuts the launches and a full-occupancy GEMV keeps every SM reading; together they take fp16 from about 7 ms to 4.14.' },
  { id: 'floor', title: `Beat the ${FLOOR.toFixed(2)} ms floor`, how: `batch 1, under ${FLOOR.toFixed(2)} ms per token`, ok: (c, r) => c.batch === 1 && r.ms < FLOOR,
    why: 'No kernel trick gets under the floor: it is the time to read the weights once. Only reading fewer bytes does, which is what quantizing to int8 or int4 is.' },
  { id: 'crowd', title: 'Serve a crowd', how: 'at least 3,000 tokens/s in total, every user under 20 ms per token', ok: (c, r) => r.tps >= 3000 && r.ms < 20,
    why: 'Batching lets every user share one read of the weights, so throughput climbs almost for free while the step stays memory-bound.' },
  { id: 'ridge', title: 'Hit the compute wall', how: 'make the step compute-bound', ok: (c, r) => r.bound === 'compute',
    why: 'Past the ridge point the math, not the memory, sets the pace, and bigger batches start to cost every user time.' },
];

export function mount(root, screen) {
  const S = { on: false, draw, cfg: { prec: 'fp16', batch: 1, fused: false, splitk: false }, done: new Set(), dev: null, measuring: false };
  screen.play = S;
  let alive = true;
  const seg = (key, opts, label) => `<p class="g-label">${label}</p><div class="g-row g-seg" data-key="${key}">${opts.map((o) => `<button type="button" class="g-ghost" data-v="${o}">${o}</button>`).join('')}</div>`;
  root.innerHTML = `
    ${about('How fast one token can be generated, and what limits it. Every token has to read every weight from memory, so at batch 1 the time is set by memory bandwidth, not by math. You first measure your own device, then plan TinyLlama-1.1B on the RTX 2080 Ti hipinfer runs on, against four challenges.',
      'This is the problem hipinfer is built around. Its kernels are fused and its GEMV keeps every SM reading, so TinyLlama decodes at 4.14 ms, 82% of the bandwidth floor and 1.15x faster than llama.cpp on the same card. The planner is a roofline model calibrated to that measurement.')}
    <div class="g-row"><button type="button" class="g-btn g-measure">Measure this device</button></div>
    <div class="g-dev" aria-live="polite"></div>
    ${seg('prec', Object.keys(PRECISION), 'Weight precision')}
    ${seg('batch', BATCHES, 'Batch: users served at once')}
    <div class="g-row g-seg" data-key="kernels"><button type="button" class="g-ghost" data-v="fused">Fused kernels</button><button type="button" class="g-ghost" data-v="splitk">Full-occupancy GEMV</button></div>
    <div class="g-result" aria-live="polite"></div>
    <ol class="g-goals"></ol>`;
  const result = root.querySelector('.g-result'), goals = root.querySelector('.g-goals'), dev = root.querySelector('.g-dev'), measure = root.querySelector('.g-measure');
  const render = () => {
    const c = S.cfg, r = step(c);
    for (const g of GOALS) if (g.ok(c, r)) S.done.add(g.id);
    root.querySelectorAll('.g-seg').forEach((row) => row.querySelectorAll('button').forEach((b) => {
      const k = row.dataset.key, v = b.dataset.v;
      b.setAttribute('aria-pressed', k === 'kernels' ? c[v] : String(c[k]) === v);
    }));
    result.innerHTML = table(['', 'per token', 'tokens/s', 'bound by'], [['This plan', `${r.ms.toFixed(2)} ms`, Math.round(r.tps).toLocaleString('en-US'), r.bound]], 0)
      + `<p class="g-verdict">Reading ${r.gb.toFixed(2)} GB takes ${r.mem.toFixed(2)} ms, the math for ${c.batch} user${c.batch > 1 ? 's' : ''} ${r.math.toFixed(2)} ms, and ${LAYERS * (c.fused ? 5 : 9)} kernel launches ${r.launch.toFixed(2)} ms. `
      + (r.bound === 'memory' ? `The step is waiting on memory: the floor at this precision is ${r.floor.toFixed(2)} ms.` : 'The step is waiting on math: more users now slow everyone down.') + '</p>';
    goals.innerHTML = GOALS.map((g) => `<li class="${S.done.has(g.id) ? 'got' : ''}"><b>${S.done.has(g.id) ? '✓ ' : ''}${g.title}</b> ${g.how}.${S.done.has(g.id) ? ` <span>${g.why}</span>` : ''}</li>`).join('');
    S.on = true;
  };
  root.querySelectorAll('.g-seg button').forEach((b) => { b.onclick = () => {
    const k = b.closest('.g-seg').dataset.key, v = b.dataset.v, c = S.cfg;
    if (k === 'kernels') c[v] = !c[v]; else c[k] = k === 'batch' ? +v : v;
    render();
  }; });
  measure.onclick = async () => {
    measure.disabled = true; S.measuring = true; S.on = true; dev.textContent = 'Decoding 48 tokens on this device…';
    const ids = encode('The rover was packed into a crate and forgotten in a storage closet, until a new student found it three years later and asked who had built it.').slice(0, 48);
    const m = await ask({ type: 'run', ids, policy: 'full', budget: Infinity });
    if (!alive) return;
    const mb = engine.model.bytes / 1e6;
    S.dev = { ms: m.ms, gbs: mb / m.ms, mb }; S.measuring = false; measure.disabled = false; measure.textContent = 'Measure again';
    dev.innerHTML = `<p class="g-verdict">Your device decoded DistilGPT-2 at <b>${m.ms.toFixed(1)} ms per token</b>. Each token read all ${mb.toFixed(0)} MB of weights, so your browser pulled about <b>${S.dev.gbs.toFixed(1)} GB/s</b> from memory, on the CPU in plain JavaScript. The RTX 2080 Ti below has ${GPU.bw} GB/s.</p>`;
  };
  render();
  return () => { alive = false; };
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc, c = S.cfg, r = step(c);
  sc.chrome(ctx, 'akash@2080ti: ~/hipinfer/plan', `${MODEL.name} on the ${GPU.name}`);
  // the roofline: tokens/s against batch, with the memory roof and the compute roof
  const rb = pane(ctx, 8, 38, 610, 356, 'roofline: total tokens/s by batch (log scale)', { accent: C.blue, right: `${c.prec}${c.fused ? ', fused' : ''}${c.splitk ? ', full occupancy' : ''}` });
  const L = rb.x + 46, R = rb.x + rb.w - 8, T = rb.y + 8, B = rb.y + rb.h - 30;
  const X = (b) => L + ((Math.log2(b)) / 6) * (R - L), lo = 1.7, hi = 4.2, Y = (v) => B - ((Math.log10(Math.max(1, v)) - lo) / (hi - lo)) * (B - T);   // 50 to 16,000 tokens/s
  for (const v of [10, 100, 1000, 10000]) { line(ctx, [[L, Y(v)], [R, Y(v)]], { color: C.line, lw: 1 }); text(ctx, v.toLocaleString('en-US'), L - 6, Y(v), { size: 11, color: C.dim, align: 'right' }); }
  BATCHES.forEach((b) => text(ctx, String(b), X(b), B + 12, { size: 11, color: b === c.batch ? C.ink : C.dim, align: 'center' }));
  text(ctx, 'users per step', (L + R) / 2, B + 26, { size: 11, color: C.dim, align: 'center' });
  const curve = (f, col, lw = 2, dash = null) => line(ctx, BATCHES.map((b) => [X(b), Y(f(b))]), { color: col, lw, dash });
  curve((b) => (b / ((MODEL.gb * PRECISION[c.prec]) / GPU.bw)), C.yellow, 1.5, [5, 4]);            // memory roof: one full-bandwidth read per step
  curve(() => (PEAK * 1e12) / FLOP, C.purple, 1.5, [5, 4]);                                         // compute roof
  curve((b) => step({ ...c, batch: b }).tps, C.orange, 2.4);
  text(ctx, 'memory roof', X(1) + 6, Y(1 / ((MODEL.gb * PRECISION[c.prec]) / GPU.bw)) - 12, { size: 11, color: C.yellow });
  text(ctx, 'compute roof', R - 4, Y((PEAK * 1e12) / FLOP) - 10, { size: 11, color: C.purple, align: 'right' });
  rect(ctx, X(c.batch) - 6, Y(r.tps) - 6, 12, 12, { fill: C.orange, r: 6 });
  text(ctx, `${Math.round(r.tps).toLocaleString('en-US')} tok/s`, X(c.batch) + (c.batch >= 32 ? -10 : 10), Y(r.tps) + 16, { size: 12, color: C.orange, align: c.batch >= 32 ? 'right' : 'left' });
  // where one step's time goes
  const tb = pane(ctx, 626, 38, w - 634, 356, 'one step, per user', { accent: C.orange });
  const span = Math.max(8, r.ms * 1.15), bx = tb.x, bw = tb.w, Xm = (ms) => bx + (bw * ms) / span;
  const bar = (y, label, ms, col) => { text(ctx, label, bx, y, { size: 12, color: C.dim }); rect(ctx, bx, y + 10, bw, 14, { fill: C.head, r: 3 }); rect(ctx, bx, y + 10, Xm(ms) - bx, 14, { fill: col, r: 3 }); text(ctx, `${ms.toFixed(2)} ms`, bx + bw, y, { size: 12, color: C.ink, align: 'right' }); };
  bar(tb.y + 10, `read ${r.gb.toFixed(2)} GB of weights`, r.mem, r.bound === 'memory' ? C.yellow : C.faint);
  bar(tb.y + 52, `math for ${c.batch} user${c.batch > 1 ? 's' : ''}`, r.math, r.bound === 'compute' ? C.purple : C.faint);
  bar(tb.y + 94, `${LAYERS * (c.fused ? 5 : 9)} kernel launches`, r.launch, C.blue);
  line(ctx, [[Xm(FLOOR), tb.y + 136], [Xm(FLOOR), tb.y + 176]], { color: C.yellow, lw: 1.5, dash: [4, 3] });
  text(ctx, `fp16 floor ${FLOOR.toFixed(2)}`, Xm(FLOOR), tb.y + 188, { size: 11, color: C.yellow, align: 'center' });
  rect(ctx, bx, tb.y + 146, Xm(r.ms) - bx, 20, { fill: r.ms < FLOOR ? C.green : C.orange, r: 3 });
  text(ctx, `${r.ms.toFixed(2)} ms per token`, bx, tb.y + 214, { size: 22, font: SANS, weight: '800', color: r.ms < FLOOR ? C.green : C.ink });
  text(ctx, `bound by ${r.bound}`, bx, tb.y + 240, { size: 13, color: r.bound === 'memory' ? C.yellow : C.purple });
  text(ctx, 'hipinfer, measured: 4.14 ms at fp16, batch 1', bx, tb.y + tb.h - 8, { size: 11, color: C.dim });
  // this device, and the challenges
  const db = pane(ctx, 8, 402, 610, h - 410, 'this device: DistilGPT-2, in the browser', { accent: C.green });
  if (S.dev) {
    text(ctx, `${S.dev.ms.toFixed(1)} ms per token   ${S.dev.mb.toFixed(0)} MB of weights each`, db.x, db.y + 8, { size: 14, font: MONO, color: C.ink });
    const scale = (v) => (db.w - 140) * clamp(Math.log10(1 + v) / Math.log10(1 + GPU.bw));
    [['your browser', S.dev.gbs, C.green], [GPU.name, GPU.bw, C.orange]].forEach(([label, v, col], k) => {
      const y = db.y + 40 + k * 30;
      text(ctx, label, db.x, y, { size: 12, color: C.dim }); rect(ctx, db.x + 110, y - 7, scale(v), 14, { fill: col, r: 3 });
      text(ctx, `${v.toFixed(1)} GB/s`, db.x + db.w, y, { size: 12, color: C.ink, align: 'right' });
    });
  } else text(ctx, S.measuring ? 'decoding on this device…' : 'press "Measure this device" to see how fast your browser reads the weights', db.x, db.y + 8, { size: 13, color: C.dim });
  const gb = pane(ctx, 626, 402, w - 634, h - 410, `challenges ${S.done.size} / ${GOALS.length}`, { accent: C.purple });
  GOALS.forEach((g, k) => text(ctx, `${S.done.has(g.id) ? '✓' : '·'} ${g.title}`, gb.x, gb.y + 8 + k * 24, { size: 13, color: S.done.has(g.id) ? C.green : C.dim }));
}
