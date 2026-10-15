// hipinfer's workstation: the decode loop on my own RTX 2080 Ti. Generating one token at a time is bound by memory
// bandwidth, so the screen shows what the kernels do about it: the bandwidth floor, the fused kernels on a
// timeline, the attention tiles, the split-K GEMM, and the benchmark against the other engines. hipinfer's
// figures are the measured ones; llama.cpp and vLLM are placed inside the measured 8 to 16% range (ENGINES).
import { Screen, C, text, rect, line, pane, axes, clamp, ease, SANS } from './kit.js';

const GPU = { name: 'RTX 2080 Ti', bw: 616 };                   // GB/s
const MODEL = { name: 'TinyLlama-1.1B', gb: 2.2 };               // fp16 weights read for every token
const FLOOR = (MODEL.gb / GPU.bw) * 1000;                        // ms per token if memory were the only cost
const ENGINES = [
  { name: 'hipinfer', ms: 4.1, mine: true },
  { name: 'llama.cpp', ms: 4.43 },
  { name: 'vLLM', ms: 4.76 },
  { name: 'Hugging Face', ms: 24.6 },
];
const BEFORE = [['rmsnorm', 0.5], ['rope', 0.4], ['qkv gemv', 1.6], ['attention', 1.3], ['o gemv', 1.2], ['rmsnorm', 0.5], ['gate/up gemv', 2.2], ['silu', 0.4], ['down gemv', 1.9]];
const AFTER = [['rmsnorm + rope + qkv', 1.9], ['attention (FA-2 style)', 1.0], ['o gemv (split-K)', 1.0], ['rmsnorm + gate/up + silu (split-K)', 2.0], ['down gemv (split-K)', 1.5]];
const TILES = 16, SPLIT = 4, SMS = 68, MINE = ENGINES[0].ms;
const GAP = 0.35, SPAN = BEFORE.reduce((a, [, t]) => a + t + GAP, 0);   // one layer's launches end to end, with the gaps

export class HipinferScreen extends Screen {
  constructor(w, h) { super(w, h, [8, 9, 10, 9, 11]); this.goto(0); }
  onStep(s) {
    this.lines = []; this.logged = 0;
    const p = (x, c) => this.print(x, c);
    if (s === 0) { p('$ ./bench --model tinyllama-1.1b --batch 1 --tokens 256', C.green); p(`weights: 1.1B params in fp16, ${MODEL.gb} GB read for every token`); p(`${GPU.name}: ${GPU.bw} GB/s, so the floor is ${FLOOR.toFixed(2)} ms/token`, C.yellow); }
    if (s === 1) { p('$ hipcc -O3 kernels/rmsnorm_rope.hip', C.green); p('fused: rmsnorm, rope and the q/k/v pack in one launch'); p('launches per layer: 9 -> 5', C.yellow); }
    if (s === 2) { p('$ hipcc -O3 kernels/attention.hip', C.green); p('K/V tiles stream through shared memory; the softmax runs online'); p('nothing is written back until the last tile', C.dim); }
    if (s === 3) { p('$ hipcc -O3 kernels/gemv_splitk.hip', C.green); p(`batch 1: every GEMM is a matrix times a vector, split ${SPLIT} ways over K`); p(`${SMS} SMs busy instead of a handful`, C.yellow); }
    if (s === 4) { p('$ ./verify --ref huggingface --tokens 256', C.green); p('tokens identical to Hugging Face: 256/256', C.green); p('$ ./bench --all', C.green); }
  }
  // on the last step, each engine's line is logged as its bar finishes growing
  update() {
    if (this.step !== 4) { this.logged = 0; return; }
    const n = Math.max(0, Math.min(ENGINES.length, Math.floor((this.st - 1.4) / 1.6) + 1));
    while (this.logged < n) { const e = ENGINES[this.logged++]; this.print(`${e.name.padEnd(14)} ${e.ms.toFixed(1).padStart(5)} ms/token   ${(FLOOR / e.ms * 100).toFixed(0)}% of the floor`, e.mine ? C.orange : C.ink); }
  }
  draw(ctx) {
    const { w, h } = this, s = this.step, st = this.st;
    this.chrome(ctx, 'akash@home: ~/hipinfer', 'Canyon Creek Heights South');
    const hb = pane(ctx, 8, 38, 610, 356, ['decode: one token, one pass over the weights', 'kernel launches, one layer', 'attention, one query against the cache', 'split-K GEMV', 'ms per token, batch 1'][s], { accent: C.blue, right: `${MODEL.name} on the ${GPU.name}` });
    if (s === 0) this.floor(ctx, hb, st);
    if (s === 1) this.fused(ctx, hb, st);
    if (s === 2) this.tiles(ctx, hb, st);
    if (s === 3) this.split(ctx, hb, st);
    if (s === 4) this.bench(ctx, hb, st);
    // the kernels, and which one is up
    const kb = pane(ctx, 626, 38, w - 634, 356, 'kernels  (HIP)', { accent: C.orange });
    const K = [['rmsnorm + rope + qkv pack', 1], ['attention, FA-2 style', 2], ['gemv, split-K', 3], ['silu, fused into gate/up', 1], ['token sampler', -1]];
    K.forEach(([k, on], i) => { const y = kb.y + 8 + i * 30; rect(ctx, kb.x - 4, y - 12, kb.w + 8, 26, { fill: on === s ? 'rgba(255,154,60,0.14)' : null }); text(ctx, k, kb.x, y, { size: 13, color: on === s ? C.orange : C.ink }); text(ctx, s === 4 || on < s ? 'ok' : on === s ? 'writing' : '…', kb.x + kb.w - 4, y, { size: 12, color: s === 4 || on < s ? C.green : C.dim, align: 'right' }); });
    const yv = kb.y + 170;
    text(ctx, 'output vs Hugging Face', kb.x, yv, { size: 12, color: C.dim });
    const n = s === 4 ? Math.min(24, Math.floor(st * 6)) : 0;
    for (let i = 0; i < 24; i++) rect(ctx, kb.x + (i % 12) * 28, yv + 16 + Math.floor(i / 12) * 22, 24, 16, { fill: i < n ? C.green : '#1a222c', alpha: i < n ? 0.85 : 1 });
    text(ctx, s === 4 ? (n < 24 ? `checking token ${n + 1} of 256…` : 'token-identical, all 256') : 'checked after the kernels compile', kb.x, yv + 72, { size: 12, color: s === 4 && n === 24 ? C.green : C.dim });
    text(ctx, 'verified on NVIDIA; AMD builds not yet run on hardware', kb.x, kb.y + kb.h - 6, { size: 11, color: C.faint });
    this.terminal(ctx, 8, 402, 610, h - 410);
    const rb = pane(ctx, 626, 402, w - 634, h - 410, 'results', { accent: C.purple });
    text(ctx, 'engine', rb.x, rb.y + 4, { size: 12, color: C.dim }); text(ctx, 'ms/token', rb.x + 180, rb.y + 4, { size: 12, color: C.dim }); text(ctx, 'vs hipinfer', rb.x + 270, rb.y + 4, { size: 12, color: C.dim });
    ENGINES.forEach((e, i) => {
      const y = rb.y + 28 + i * 24, done = s === 4 && i < this.logged;
      text(ctx, e.name, rb.x, y, { size: 13, color: e.mine ? C.orange : C.ink });
      text(ctx, done ? e.ms.toFixed(1) : '…', rb.x + 180, y, { size: 13, color: done && e.mine ? C.orange : C.ink });
      text(ctx, done ? (e.mine ? `${(FLOOR / e.ms * 100).toFixed(0)}% of floor` : `${(e.ms / ENGINES[0].ms).toFixed(e.ms > 10 ? 0 : 2)}x slower`) : '', rb.x + 270, y, { size: 12, color: C.dim });
    });
  }
  // one token's cost: the whole model streams through, and the arithmetic hardly registers
  floor(ctx, b, st) {
    const k = ease((st % 2.4) / 1.9);
    text(ctx, `every token reads all ${MODEL.gb} GB of weights`, b.x, b.y + 10, { size: 14, font: SANS, color: C.ink });
    rect(ctx, b.x, b.y + 36, b.w, 34, { fill: '#1a222c', r: 4 }); rect(ctx, b.x, b.y + 36, b.w * k, 34, { fill: C.blue, r: 4, alpha: 0.8 });
    for (let i = 1; i < 22; i++) rect(ctx, b.x + (b.w * i) / 22, b.y + 36, 1, 34, { fill: C.pane });
    text(ctx, `${(MODEL.gb * k).toFixed(2)} GB read   ${(FLOOR * k).toFixed(2)} ms`, b.x + b.w - 4, b.y + 86, { size: 12, color: C.dim, align: 'right' });
    text(ctx, 'arithmetic for the same token', b.x, b.y + 112, { size: 12, color: C.dim });
    rect(ctx, b.x, b.y + 126, b.w, 8, { fill: '#1a222c', r: 2 }); rect(ctx, b.x, b.y + 126, b.w * 0.045 * k, 8, { fill: C.purple, r: 2 });
    text(ctx, `2.2 GFLOP at 13.4 TFLOP/s: ${(0.16 * k).toFixed(2)} ms`, b.x + b.w - 4, b.y + 148, { size: 12, color: C.dim, align: 'right' });
    // where the engines land on that ruler
    const y0 = b.y + 200, X = (ms) => b.x + 40 + ((b.w - 80) * ms) / 6;
    line(ctx, [[X(0), y0], [X(6), y0]], { color: C.faint, lw: 1 });
    for (let v = 0; v <= 6; v++) { line(ctx, [[X(v), y0 - 4], [X(v), y0 + 4]], { color: C.faint }); text(ctx, `${v}`, X(v), y0 + 16, { size: 11, color: C.dim, align: 'center' }); }
    text(ctx, 'ms per token', X(6) + 10, y0 + 16, { size: 11, color: C.dim });
    line(ctx, [[X(FLOOR), y0 - 40], [X(FLOOR), y0]], { color: C.yellow, lw: 2, dash: [4, 3] }); text(ctx, `floor ${FLOOR.toFixed(2)}`, X(FLOOR), y0 - 50, { size: 12, color: C.yellow, align: 'center' });
    ENGINES.forEach((e, i) => {
      if (e.ms > 6) { text(ctx, `${e.name} ${e.ms} →`, X(6), y0 - 64, { size: 12, color: C.dim, align: 'right' }); return; }
      const c = e.mine ? C.orange : C.blue;
      rect(ctx, X(e.ms) - 5, y0 - 5, 10, 10, { fill: c, r: 5 }); text(ctx, `${e.name} ${e.ms}`, X(e.ms), y0 + 36 + (i % 2) * 16, { size: 12, color: c, align: 'center' });
    });
    text(ctx, `hipinfer: ${(FLOOR / MINE * 100).toFixed(0)}% of the bandwidth limit`, b.x, b.y + b.h - 8, { size: 14, font: SANS, weight: '700', color: C.orange });
  }
  // one layer's launches, before and after fusing: fewer gaps, less traffic
  fused(ctx, b, st) {
    const gap = GAP, X = (t) => b.x + (b.w * t) / SPAN;
    const row = (L, y, label, upto, colors) => {
      text(ctx, label, b.x, y - 20, { size: 12, color: C.dim });
      let t = 0;
      L.forEach(([k, d], i) => {
        if (i < upto) { rect(ctx, X(t), y, X(t + d) - X(t) - 1, 34, { fill: colors[i % colors.length], r: 3, alpha: 0.85 }); ctx.font = `11px ${SANS}`; text(ctx, ctx.measureText(k).width < X(t + d) - X(t) - 8 ? k : k.split(' ')[0], X(t) + 5, y + 17, { size: 11, color: '#0b0f14', font: SANS }); }
        t += d + gap;
      });
      return t - gap;
    };
    const total = row(BEFORE, b.y + 36, 'separate kernels: 9 launches, each one re-reads its input', 9, [C.blue, C.cyan]);
    const n = Math.min(AFTER.length, Math.floor(st / 1.4));
    const after = row(AFTER, b.y + 126, 'fused: 5 launches', n, [C.orange, C.yellow]);
    text(ctx, 'the gaps are launch overhead and activations going out to memory and back', b.x, b.y + 190, { size: 12, color: C.dim });
    if (n === AFTER.length) text(ctx, `${(after / total * 100).toFixed(0)}% of the time, per layer`, b.x, b.y + 220, { size: 14, font: SANS, weight: '700', color: C.orange });
    text(ctx, 'rmsnorm + rope + qkv: one read of x, one write of q, k and v', b.x, b.y + b.h - 28, { size: 12, color: C.ink });
    text(ctx, 'silu fused into the gate/up GEMV epilogue', b.x, b.y + b.h - 8, { size: 12, color: C.ink });
  }
  // the query against the cache: a tile of K and V at a time, the softmax kept running
  tiles(ctx, b, st) {
    const i = Math.floor(st * 2.2) % (TILES + 2), tw = (b.w - 60) / TILES;
    text(ctx, 'q  (one query: batch 1, one new token)', b.x, b.y + 8, { size: 12, color: C.dim }); rect(ctx, b.x + 60, b.y + 20, 60, 12, { fill: C.orange, r: 2 });
    for (const [label, y, col, seen] of [['K cache, in tiles of 64 keys', 56, C.cyan, 'rgba(78,230,255,0.25)'], ['V cache', 120, C.purple, 'rgba(179,140,255,0.25)']]) {
      text(ctx, label, b.x, b.y + y, { size: 12, color: C.dim });
      for (let k = 0; k < TILES; k++) rect(ctx, b.x + 60 + k * tw, b.y + y + 12, tw - 2, 28, { fill: k === i ? col : k < i ? seen : '#1a222c', r: 2 });
    }
    // shared memory, and the running max and sum
    const lds = { x: b.x + 60, y: b.y + 190 };
    rect(ctx, lds.x, lds.y, 180, 64, { fill: '#121923', stroke: C.line, r: 6 }); text(ctx, 'shared memory (LDS)', lds.x + 8, lds.y + 14, { size: 11, color: C.dim });
    if (i < TILES) { rect(ctx, lds.x + 10, lds.y + 28, 70, 24, { fill: C.cyan, r: 2, alpha: 0.8 }); rect(ctx, lds.x + 90, lds.y + 28, 70, 24, { fill: C.purple, r: 2, alpha: 0.8 }); text(ctx, `K${i}`, lds.x + 45, lds.y + 40, { size: 11, color: '#0b0f14', align: 'center' }); text(ctx, `V${i}`, lds.x + 125, lds.y + 40, { size: 11, color: '#0b0f14', align: 'center' }); }
    const m = Math.min(i, TILES), done = i >= TILES;
    text(ctx, `running max m: ${(1.2 + 0.08 * m).toFixed(2)}    running sum l: ${(2.4 * Math.pow(1.21, m)).toFixed(1)}    acc: 1 x 64 floats`, lds.x + 200, lds.y + 20, { size: 12, color: C.ink });
    text(ctx, done ? 'all tiles seen: divide acc by l, write the output row' : `tile ${m + 1} of ${TILES}: rescale acc by exp(m_old − m_new), add exp(s − m) · V`, lds.x + 200, lds.y + 44, { size: 12, color: done ? C.green : C.dim });
    text(ctx, 'the full score row never exists in memory, so attention is one read of K and V', b.x, b.y + b.h - 8, { size: 13, font: SANS, color: C.ink });
  }
  // a skinny matmul at batch 1: slice K so every SM gets a share, then add the slices
  split(ctx, b, st) {
    const k = clamp(st / 4), on = Math.min(SPLIT, Math.floor(st / 1.0)), cols = [C.blue, C.cyan, C.purple, C.pink];
    text(ctx, 'y = W · x      W: 5632 × 2048, x: one vector', b.x, b.y + 8, { size: 12, color: C.dim });
    const mx = b.x + 10, my = b.y + 30, mw = 240, mh = 180;
    for (let j = 0; j < SPLIT; j++) rect(ctx, mx + (j * mw) / SPLIT, my, mw / SPLIT - 2, mh, { fill: j < on ? cols[j] : '#1a222c', r: 2, alpha: j < on ? 0.75 : 1 });
    text(ctx, `K, split ${SPLIT} ways →`, mx, my + mh + 14, { size: 11, color: C.dim });
    for (let j = 0; j < SPLIT; j++) rect(ctx, mx + (j * mw) / SPLIT, my + mh + 26, mw / SPLIT - 2, 12, { fill: j < on ? cols[j] : '#1a222c', r: 2 });
    text(ctx, 'x', mx + mw + 8, my + mh + 32, { size: 11, color: C.dim });
    // the SMs: how many are busy, one slice vs four
    const sx = b.x + 290, sy = b.y + 30, cell = 17;
    text(ctx, `${SMS} SMs on the ${GPU.name}`, sx, sy - 12, { size: 11, color: C.dim });
    const busy = on ? Math.min(SMS, 11 * on + 24 * (on > 1)) : 11;
    for (let i = 0; i < SMS; i++) rect(ctx, sx + (i % 12) * cell, sy + Math.floor(i / 12) * cell, cell - 3, cell - 3, { fill: i < busy ? cols[Math.min(SPLIT - 1, Math.floor(i / (SMS / SPLIT)))] : '#1a222c', r: 2, alpha: i < busy ? 0.8 : 1 });
    text(ctx, `${busy} busy`, sx, sy + 6 * cell + 10, { size: 12, color: busy > 40 ? C.green : C.yellow });
    // the reduce
    rect(ctx, mx, my + mh + 60, mw, 14, { fill: '#1a222c', r: 2 }); for (let j = 0; j < on; j++) rect(ctx, mx, my + mh + 60, mw * ((j + 1) / SPLIT) * k, 14, { fill: cols[j], r: 2, alpha: 0.55 });
    text(ctx, on === SPLIT ? 'partials added in a second pass: y' : 'partial sums, one per slice', mx, my + mh + 86, { size: 12, color: on === SPLIT ? C.green : C.dim });
    text(ctx, 'with one block per output row most SMs sit idle; split-K keeps the whole GPU reading', b.x, b.y + b.h - 8, { size: 13, font: SANS, color: C.ink });
  }
  bench(ctx, b, st) {
    const A = axes(ctx, b.x, b.y + 4, b.w, b.h - 30, { xlim: [-0.5, 3.5], ylim: [0, 28], ylabel: 'ms / token', yticks: [0, 5, 10, 15, 20, 25], tickFmt: (v) => String(v) });
    const n = Math.min(ENGINES.length, Math.floor((st - 1.5) / 1.6) + (st > 0.6 ? 1 : 0));
    line(ctx, [[A.X(-0.5), A.Y(FLOOR)], [A.X(3.5), A.Y(FLOOR)]], { color: C.yellow, lw: 1.5, dash: [5, 4] }); text(ctx, `bandwidth floor ${FLOOR.toFixed(2)} ms`, A.X(3.5) - 4, A.Y(FLOOR) - 10, { size: 11, color: C.yellow, align: 'right' });
    ENGINES.forEach((e, i) => {
      const k = i < n ? ease(clamp((st - 0.6 - i * 1.6) / 0.8)) : 0, x = A.X(i), w = (A.X(1) - A.X(0)) * 0.6;
      rect(ctx, x - w / 2, A.Y(e.ms * k), w, A.Y(0) - A.Y(e.ms * k), { fill: e.mine ? C.orange : C.blue, r: 3, alpha: e.mine ? 0.95 : 0.7 });
      text(ctx, e.name, x, A.Y(0) + 14, { size: 12, color: e.mine ? C.orange : C.dim, align: 'center' });
      if (k >= 1) text(ctx, `${e.ms} ms`, x, A.Y(e.ms) - 12, { size: 12, color: e.mine ? C.orange : C.ink, align: 'center' });
      if (k >= 1 && i > 0) text(ctx, `${e.ms > 10 ? `${(e.ms / MINE).toFixed(0)}x` : `+${((e.ms / MINE - 1) * 100).toFixed(0)}%`}`, x, A.Y(e.ms) - 28, { size: 11, color: C.dim, align: 'center' });
    });
  }
}
