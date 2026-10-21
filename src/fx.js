// The effects drawn over everything on one 2D canvas: the jump into the digital world when a link is clicked
// (arcs off the link, a burst, a tunnel at speed), the ring that opens onto campus, the targeting HUD during
// the flight, and the voxel dissolve that carries us from outside a building into the room.
const SIG = '255, 138, 61';
const SCRAMBLE = '!<>-_\\/[]{}=+*^?#01';
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (v) => 1 - (1 - v) ** 3;
const pick = (s) => s[Math.floor(Math.random() * s.length)];

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  const S = { warp: null, ring: null, hud: null, cells: null };
  const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  fit(); addEventListener('resize', fit);
  const now = () => performance.now() / 1000;

  const streaks = Array.from({ length: 300 }, () => ({ a: Math.random() * 6.283, z: 0.15 + Math.random() * 0.85, pace: 0.6 + Math.random() * 0.9, tint: Math.random() < 0.6 ? SIG : Math.random() < 0.75 ? '255, 255, 255' : '57, 208, 216' }));
  const gates = Array.from({ length: 12 }, (_, i) => ({ z: (i + 1) / 12 }));

  function decode(lines, t0, t) {
    return lines.map((s, i) => {
      const k = clamp01((t - t0 - i * 0.45) / 0.5), shown = Math.floor(k * s.length);
      return k <= 0 ? '' : Array.from(s, (ch, j) => (j < shown || ch === ' ' ? ch : pick(SCRAMBLE))).join('');
    });
  }

  function drawWarp(t, dt) {
    const w = S.warp, q = t - w.t0, cx = W / 2, cy = H / 2, reach = Math.hypot(cx, cy);
    const project = (z) => (reach * 0.06) / z;
    const BURST = 0.62;
    const rush = clamp01((q - BURST) / 1.6), speed = 0.2 + 2.2 * rush * rush + (S.ring ? 3 : 0);
    const rattle = (q < BURST ? 5 * (q / BURST) ** 2 : 12 * clamp01(1 - (q - BURST) / 0.35)) + (S.ring ? 6 : 0);
    ctx.setTransform(dpr, 0, 0, dpr, (Math.random() - 0.5) * rattle * dpr, (Math.random() - 0.5) * rattle * dpr);
    // the page goes dark underneath
    ctx.fillStyle = `rgba(3, 5, 7, ${q < BURST ? 0.75 * q / BURST : 1})`; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    // arcs off the link, crawling to the centre
    const held = q < BURST ? 1 : clamp01(1 - (q - BURST) / 0.2);
    if (held > 0 && w.from) {
      const f = w.from, grown = clamp01(q / (BURST * 0.85)); const g = grown * grown * (3 - 2 * grown);
      const ends = [[f.left, f.top], [f.right, f.top], [f.left, f.bottom], [f.right, f.bottom], [(f.left + f.right) / 2, f.top]];
      ctx.strokeStyle = `rgba(${SIG}, ${0.9 * held})`; ctx.lineWidth = 2; ctx.strokeRect(f.left - 4, f.top - 3, f.width + 8, f.height + 6);
      for (const [x0, y0] of ends) {
        const tx = x0 + (cx - x0) * g, ty = y0 + (cy - y0) * g, dx = tx - x0, dy = ty - y0, len = Math.hypot(dx, dy) || 1;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        for (let i = 1; i <= 10; i++) { const a = i / 10, s = Math.sin(a * Math.PI) * 16 * (Math.random() - 0.5); ctx.lineTo(x0 + dx * a - (dy / len) * s, y0 + dy * a + (dx / len) * s); }
        ctx.strokeStyle = `rgba(${SIG}, ${0.45 * held})`; ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * held})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      const charge = clamp01((q - BURST * 0.5) / (BURST * 0.5));
      if (charge > 0) { const r = 20 + charge * 90 + Math.random() * 10, gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(255,255,255,${0.9 * charge * held})`); gr.addColorStop(0.3, `rgba(${SIG},${0.6 * charge * held})`); gr.addColorStop(1, `rgba(${SIG},0)`); ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
    }
    if (q >= BURST) {
      ctx.save(); ctx.translate(cx, cy);
      const on = clamp01((q - BURST) / 0.4);
      for (const gt of gates) {
        gt.z -= speed * 0.45 * dt; if (gt.z <= 0.04) gt.z += 1;
        const half = project(gt.z) * 1.5, near = 1 - gt.z, a = Math.min(1, near * 1.8) * on;
        ctx.save(); ctx.rotate(gt.z * 1.3 + t * 0.3);
        ctx.strokeStyle = `rgba(${SIG}, ${a * 0.22})`; ctx.lineWidth = 2 + near * 9; ctx.strokeRect(-half, -half, half * 2, half * 2);
        ctx.strokeStyle = `rgba(255, 214, 180, ${a * 0.7})`; ctx.lineWidth = 0.6 + near * 1.6; ctx.strokeRect(-half, -half, half * 2, half * 2);
        ctx.restore();
      }
      for (const s of streaks) {
        const from = Math.min(1, s.z + speed * s.pace * 0.07); s.z -= speed * s.pace * dt;
        if (s.z <= 0.03) { s.z = 1; s.a = Math.random() * 6.283; continue; }
        const c = Math.cos(s.a), sn = Math.sin(s.a), r0 = project(from), r1 = project(s.z);
        ctx.strokeStyle = `rgba(${s.tint}, ${Math.min(1, (1 - s.z) * 1.4) * on})`; ctx.lineWidth = 0.8 + (1 - s.z) * 2.4;
        ctx.beginPath(); ctx.moveTo(c * r0, sn * r0); ctx.lineTo(c * r1, sn * r1); ctx.stroke();
      }
      ctx.restore();
      const since = q - BURST;
      if (since < 0.5) { const fade = 1 - since / 0.5, r = reach * (0.35 + since * 2), gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(255,255,255,${fade})`); gr.addColorStop(0.25, `rgba(${SIG},${fade * 0.8})`); gr.addColorStop(1, `rgba(${SIG},0)`); ctx.fillStyle = gr; ctx.fillRect(-20, -20, W + 40, H + 40); }
      for (let i = 0; i < 3; i++) { const p = (since - i * 0.12) / 0.8; if (p <= 0 || p >= 1) continue; ctx.strokeStyle = `rgba(${SIG}, ${1 - p})`; ctx.lineWidth = 2 + (1 - p) * 7; ctx.beginPath(); ctx.arc(cx, cy, reach * 1.1 * easeOut(p), 0, 6.283); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // what we're doing, decoding a letter at a time
    if (q > BURST + 0.15) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const lines = decode(w.lines, w.t0 + BURST + 0.15, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((s, i) => {
        ctx.font = i === lines.length - 1 ? `700 ${Math.min(30, W / 22)}px "Bricolage Grotesque", sans-serif` : `500 ${Math.min(14, W / 34)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillStyle = i === lines.length - 1 ? '#fff' : `rgba(${SIG}, 0.95)`; ctx.shadowColor = `rgb(${SIG})`; ctx.shadowBlur = 16;
        ctx.fillText(s, cx, cy + H * 0.2 + (i - lines.length + 1) * 26 + (i === lines.length - 1 ? 10 : 0));
      });
      ctx.shadowBlur = 0;
    }
    // tearing on the hits
    if ((q >= BURST && q < BURST + 0.25) || Math.random() < 0.05 || S.ring) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 5; i++) { const y = Math.floor(Math.random() * canvas.height), tall = Math.floor((4 + Math.random() * 40) * dpr), sh = (Math.random() - 0.5) * 80 * dpr; ctx.drawImage(canvas, 0, y, canvas.width, tall, sh, y, canvas.width, tall); }
    }
  }

  // the tunnel's end: a hole opens from the centre onto whatever is underneath
  function drawRing(t) {
    const q = clamp01((t - S.ring.t0) / S.ring.dur), cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy) * 1.05 * easeOut(q);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${SIG}, ${1 - q})`; ctx.lineWidth = 3 + 14 * (1 - q); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q)})`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (q >= 1) { const done = S.ring.done; S.ring = null; S.warp = null; done(); }
  }

  // the HUD while flying over campus: frame corners, a lock on the target, and a readout
  function drawHud(t) {
    const h = S.hud; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = clamp01((t - h.t0) / 0.5) * (h.out ? clamp01(1 - (t - h.out) / 0.4) : 1); if (a <= 0) { if (h.out) S.hud = null; return; }
    ctx.globalAlpha = a; ctx.strokeStyle = `rgba(${SIG}, 0.85)`; ctx.lineWidth = 2;
    const m = 22, L = 26;
    for (const [x, y, sx, sy] of [[m, m + 50, 1, 1], [W - m, m + 50, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); }
    // scan line
    const sy = 70 + ((t * 0.35) % 1) * (H - 90); ctx.fillStyle = `rgba(${SIG}, 0.06)`; ctx.fillRect(0, sy, W, 2);
    const g = h.target;
    if (g) {
      const lock = clamp01((t - h.t0 - 0.3) / 0.9), s = 60 + (1 - easeOut(lock)) * 140 + Math.sin(t * 6) * 3, x = g.x, y = g.y;
      ctx.strokeStyle = `rgba(${SIG}, ${0.5 + 0.5 * lock})`; ctx.lineWidth = 2;
      for (const [sx, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.moveTo(x + sx * s, y + sy2 * (s - 16)); ctx.lineTo(x + sx * s, y + sy2 * s); ctx.lineTo(x + sx * (s - 16), y + sy2 * s); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.283); ctx.fillStyle = `rgb(${SIG})`; ctx.fill();
      ctx.font = '700 14px "Bricolage Grotesque", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      const lx = Math.min(W - 230, x + s + 14), ly = Math.max(90, y - s);
      ctx.fillText(h.label, lx, ly); ctx.font = '12px "Bricolage Grotesque", sans-serif'; ctx.fillStyle = `rgb(${SIG})`;
      ctx.fillText(lock < 1 ? 'ACQUIRING' : 'LOCKED', lx, ly + 18); ctx.fillText(`${Math.round(h.dist)} m`, lx, ly + 34);
    }
    ctx.font = '11px "Bricolage Grotesque", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = `rgba(${SIG}, 0.9)`;
    (h.lines || []).forEach((s, i) => ctx.fillText(s, m + 6, H - m - 12 - i * 16));
    ctx.globalAlpha = 1;
  }

  // the voxel dissolve: squares fill the view from the centre out, then clear the same way
  function drawCells(t) {
    const c = S.cells, q = clamp01((t - c.t0) / c.dur), size = Math.max(22, Math.round(Math.min(W, H) / 22));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!c.grid || c.size !== size) {
      c.size = size; c.grid = [];
      const cols = Math.ceil(W / size), rows = Math.ceil(H / size), mx = cols / 2, my = rows / 2, far = Math.hypot(mx, my);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) c.grid.push({ x, y, d: (Math.hypot(x + 0.5 - mx, y + 0.5 - my) / far) * 0.75 + Math.random() * 0.25 });
    }
    for (const g of c.grid) {
      const k = c.mode === 'in' ? clamp01((q - g.d * 0.7) / 0.3) : 1 - clamp01((q - g.d * 0.7) / 0.3);
      if (k <= 0) continue;
      const s = size * k, x = g.x * size + (size - s) / 2, y = g.y * size + (size - s) / 2;
      ctx.fillStyle = '#050806'; ctx.fillRect(x, y, s, s);
      if (k < 1) { ctx.strokeStyle = `rgba(${SIG}, ${0.9 * (1 - k) + 0.2})`; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); }
    }
    if (c.mode === 'in' && q > 0.4) { ctx.fillStyle = `rgba(${SIG}, ${0.1 * Math.sin(q * Math.PI)})`; ctx.fillRect(0, 0, W, H); }
    if (q >= 1 && c.done) { const d = c.done; c.done = null; d(); }
    if (q >= 1 && c.mode === 'out') S.cells = null;
  }

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = now(), dt = Math.min(0.05, t - last); last = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (S.warp) drawWarp(t, dt);
    if (S.ring) drawRing(t);
    if (S.hud) drawHud(t);
    if (S.cells) drawCells(t);
    if (!S.warp && !S.ring && !S.hud && !S.cells) { cancelAnimationFrame(raf); raf = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  const run = () => { if (!raf) { last = now(); raf = requestAnimationFrame(loop); } };

  return {
    // resolves once the page is fully covered; the tunnel keeps running until reveal()
    warpIn(from, lines) { S.warp = { t0: now(), from, lines }; S.ring = null; run(); return new Promise((r) => setTimeout(r, 900)); },
    reveal(dur = 0.7) { if (!S.warp) return Promise.resolve(); return new Promise((done) => { S.ring = { t0: now(), dur, done }; run(); }); },
    hud(state) { if (!state) { if (S.hud && !S.hud.out) S.hud.out = now(); return; } if (!S.hud || S.hud.out) S.hud = { t0: now() }; Object.assign(S.hud, state); run(); },
    cover(dur = 0.75) { return new Promise((done) => { S.cells = { t0: now(), dur, mode: 'in', done }; run(); }); },
    uncover(dur = 0.85) { return new Promise((done) => { if (!S.cells) return done(); S.cells = { ...S.cells, t0: now(), dur, mode: 'out', done }; run(); }); },
    clear() { S.warp = S.ring = S.hud = S.cells = null; },
  };
}
