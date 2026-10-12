// The KV-cache screen in live mode: everything here comes from DistilGPT-2 running on the visitor's machine
// (src/llm/). The heatmap is real attention (layer 4, averaged over its 12 heads) for whichever policy is
// featured; the text is shaded by how much harder each token became to predict once the cache was cut down;
// the table is measured, not simulated.
import { C, text, rect, pane, clamp, wrap, MONO } from './kit.js';
import { ORDER } from '../llm/live.js';
import { POLICY_NAMES } from '../llm/policies.js';

const COL = { green: C.green, ink: C.ink, dim: C.dim, orange: C.orange, red: C.red, yellow: C.yellow };
const agree = (R, F) => { let n = 0, a = 0; for (let t = 0; t < Math.min(R.t, F.t); t++) { n++; if (R.tops[t] === F.tops[t]) a++; } return n ? a / n : null; };

export function drawLive(sc, ctx, L) {
  const { w, h } = sc, feat = sc.featured || 'fl', R = L.runs[feat], F = L.runs.full, N = L.ids.length;
  sc.chrome(ctx, 'akash@caraml-ws3: ~/sub-cache', 'live on this device');
  // ---- attention ----
  const hb = pane(ctx, 8, 38, 610, 356, 'attention  layer 4 of 6, mean of 12 heads', { accent: C.blue, right: R ? POLICY_NAMES[feat] : '' });
  if (L.phase === 'loading' || L.phase === 'error' || !R) {
    const k = L.total ? L.got / L.total : 0;
    text(ctx, L.phase === 'error' ? 'could not load the model' : 'downloading DistilGPT-2 to this device', hb.x + hb.w / 2, hb.y + 110, { size: 17, color: L.phase === 'error' ? C.red : C.ink, align: 'center' });
    rect(ctx, hb.x + 60, hb.y + 140, hb.w - 120, 10, { fill: C.line }); rect(ctx, hb.x + 60, hb.y + 140, (hb.w - 120) * k, 10, { fill: C.orange });
    text(ctx, `${(L.got / 1e6).toFixed(1)} / ${(L.total / 1e6 || 85).toFixed(1)} MB   82M parameters, int8`, hb.x + hb.w / 2, hb.y + 172, { size: 13, color: C.dim, align: 'center' });
    text(ctx, 'GPT-2 written from scratch in JavaScript: no ML library, no server', hb.x + hb.w / 2, hb.y + 210, { size: 13, color: C.dim, align: 'center' });
  } else {
    const rows = 22, tNow = Math.max(0, R.t), q0 = Math.max(0, tNow - rows + 1), cw = hb.w / Math.max(N, 1), rh = (hb.h - 40) / rows;
    const evictedSoFar = new Set(R.evicted.filter(([t]) => t <= tNow).map(([, p]) => p));
    for (let q = q0; q <= tNow; q++) {
      const row = R.rows[q]; if (!row) continue;
      let mx = 1e-9; for (const v of row.att) mx = Math.max(mx, v);
      const y = hb.y + (q - q0) * rh;
      for (let k = 0; k <= q; k++) { if (!row.pos.includes(k)) { ctx.fillStyle = '#1a1014'; ctx.fillRect(hb.x + k * cw, y, Math.max(1, cw - 0.5), rh - 1); } }
      row.pos.forEach((p, i) => {
        const v = Math.sqrt(row.att[i] / mx);
        ctx.fillStyle = q === tNow ? `rgba(255,154,60,${0.12 + v * 0.88})` : `rgba(90,169,255,${0.06 + v * 0.9})`;
        ctx.fillRect(hb.x + p * cw, y, Math.max(1, cw - 0.5), rh - 1);
      });
    }
    const sy = hb.y + rows * rh + 8;
    for (let k = 0; k < N; k++) rect(ctx, hb.x + k * cw, sy, Math.max(1, cw - 0.5), 10, { fill: k > tNow ? C.line : R.kept.includes(k) ? C.orange : evictedSoFar.has(k) ? '#5a2430' : C.faint });
    const piece = (L.pieces[tNow] || '').replace(/\n/g, ' ');
    text(ctx, `query "${piece.trim()}"   kept ${R.kept.length}${feat === 'full' ? '' : ` / ${L.budget}`}   evicted ${evictedSoFar.size}`, hb.x, sy + 24, { size: 13, color: C.ink });
  }
  // ---- the text, shaded by what the cut-down cache cost ----
  const tb = pane(ctx, 626, 38, w - 634, 356, feat === 'full' ? 'text, shaded by surprise' : 'text: red = harder than with full cache', { accent: C.orange });
  ctx.save(); ctx.beginPath(); ctx.rect(tb.x, tb.y - 4, tb.w, tb.h + 4); ctx.clip();
  ctx.font = `12px ${MONO}`; let x = tb.x, y = tb.y + 6;
  L.pieces.forEach((p, t) => {
    const s = p.replace(/\n/g, ' '), wd = ctx.measureText(s).width;
    if (x + wd > tb.x + tb.w) { x = tb.x; y += 17; }
    const lp = R && R.lps[t - 1], lf = F && F.lps[t - 1];
    if (t > 0 && lp != null) {
      if (feat === 'full') rect(ctx, x, y - 8, wd, 16, { fill: `rgba(90,169,255,${clamp(-lp / 12) * 0.7})` });
      else if (lf != null) { const d = lf - lp; rect(ctx, x, y - 8, wd, 16, { fill: d > 0 ? `rgba(255,95,109,${clamp(d / 4) * 0.85})` : `rgba(79,212,122,${clamp(-d / 4) * 0.6})` }); }
    }
    text(ctx, s, x, y, { size: 12, color: R && t <= R.t ? C.ink : C.faint, font: MONO }); x += wd;
  });
  ctx.restore();
  // the token this policy hurt the most
  if (R && F && feat !== 'full') {
    let worst = -1, d = 0;
    for (let t = 1; t <= Math.min(R.t, F.t); t++) { const v = F.lps[t - 1] - R.lps[t - 1]; if (v > d) { d = v; worst = t; } }
    if (worst > 0) text(ctx, `hurt most: "${L.pieces[worst].trim()}" ${(Math.exp(F.lps[worst - 1]) * 100).toFixed(0)}% -> ${(Math.exp(R.lps[worst - 1]) * 100).toFixed(0)}% likely`, tb.x, tb.y + tb.h - 6, { size: 12, color: C.red });
  }
  // ---- terminal and measured results ----
  sc.lines = L.logs.map(([s, c]) => [s, COL[c] || C.ink]);
  sc.terminal(ctx, 8, 402, 610, h - 410);
  const rb = pane(ctx, 626, 402, w - 634, h - 410, `measured here  budget ${L.budget}, ${N} tokens`, { accent: C.purple });
  const cols = [0, 128, 196, 262, 324];
  ['policy', 'ppl', 'vs full', 'top-1=', 'ms/tok'].forEach((s, i) => text(ctx, s, rb.x + cols[i], rb.y + 4, { size: 11, color: C.dim }));
  const best = Math.min(...ORDER.filter((p) => p !== 'full' && L.runs[p]?.ppl).map((p) => L.runs[p].ppl));
  ORDER.forEach((p, k) => {
    const Q = L.runs[p], y = rb.y + 26 + k * 22, on = p === feat; if (!Q) return;
    if (on) rect(ctx, rb.x - 4, y - 10, rb.w + 8, 20, { fill: 'rgba(255,154,60,0.12)' });
    const col = p === 'fl' ? C.orange : C.ink;
    text(ctx, POLICY_NAMES[p], rb.x, y, { size: 12, color: col });
    if (Q.ppl == null) { rect(ctx, rb.x + 128, y - 3, 170 * clamp((Q.t + 1) / N), 6, { fill: C.blue }); return; }
    text(ctx, Q.ppl.toFixed(1), rb.x + cols[1], y, { size: 12, color: p !== 'full' && Q.ppl === best ? C.green : col });
    if (p !== 'full' && F.ppl) text(ctx, `+${(Q.ppl / F.ppl * 100 - 100).toFixed(0)}%`, rb.x + cols[2], y, { size: 12, color: C.dim });
    const a = p === 'full' ? 1 : agree(Q, F); if (a != null) text(ctx, `${Math.round(a * 100)}%`, rb.x + cols[3], y, { size: 12, color: C.dim });
    text(ctx, Q.ms.toFixed(0), rb.x + cols[4], y, { size: 12, color: C.dim });
  });
}
