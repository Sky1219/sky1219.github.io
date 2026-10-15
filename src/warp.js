// The way in. Clicking a place breaks the page into a grid from the link outward, the destination decodes on the
// dark, and campus scans itself in around the building. Getting into a building is a second, shorter effect:
// the view breaks into blocks, the blocks resolve into the room, and the room's name decodes over it.
// Drawn on one full-screen canvas (#warp) over everything.
const ORANGE = '255, 122, 34', CYAN = '78, 230, 255';
const SCRAMBLE = '!<>-_\\/[]{}=+*^?#01';
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (v) => 1 - (1 - v) ** 3;
const pick = (s) => s[Math.floor(Math.random() * s.length)];
export const scramble = (s, k) => Array.from(s, (ch, i) => (i < k * s.length || ch === ' ' ? ch : pick(SCRAMBLE))).join('');

function surface(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.hidden = false; canvas.style.opacity = '1';
  return { ctx: canvas.getContext('2d'), dpr, w, h };
}

/* The way in. The page breaks into a grid of cells in a wave from the link you clicked, each cell flashing as it
   turns; on the dark that's left, a survey grid and the destination decode in. Holds until release(), then the
   campus scans itself in underneath (tour/campus.js). Returns { release(): Promise, stop() }. */
export function enter(canvas, from, lines, MIN = 1.2) {
  const { ctx, dpr, w, h } = surface(canvas), S = Math.max(26, Math.round(Math.min(w, h) / 26));
  const cols = Math.ceil(w / S), rows = Math.ceil(h / S), far = Math.hypot(Math.max(from.x, w - from.x), Math.max(from.y, h - from.y));
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * S, y = r * S, d = Math.hypot(x + S / 2 - from.x, y + S / 2 - from.y) / far;
    cells.push({ x, y, d: d * 0.7 + Math.random() * 0.08, tint: Math.random() < 0.85 ? ORANGE : CYAN, lit: Math.random() < 0.05 });
  }
  const WAVE = 0.85;
  const start = performance.now(); let raf = 0, released = 0, frame = 0;
  const words = ['', ''];
  const draw = (now) => {
    const t = Math.max(0, (now - start) / 1000), out = released ? t - released : -1;
    frame++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // the wave: each cell flips from the page to the dark, with a flash on its edge as it goes
    for (const c of cells) {
      const k = clamp01((t - c.d) / 0.16); if (k <= 0) continue;
      const sz = S * (0.25 + 0.75 * easeOut(k)), o = (S - sz) / 2;
      ctx.fillStyle = '#060b09'; ctx.fillRect(c.x + o, c.y + o, sz, sz);
      const edge = k < 1 ? 1 - k : 0;
      if (edge) { ctx.strokeStyle = `rgba(${c.tint}, ${edge})`; ctx.lineWidth = 1.5; ctx.strokeRect(c.x + o + 0.5, c.y + o + 0.5, sz - 1, sz - 1); }
    }
    // the front of the wave
    const fr = (t / 0.7) * far;
    if (t < 1.1) { ctx.strokeStyle = `rgba(${ORANGE}, ${clamp01(1 - t / 1.1)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(from.x, from.y, Math.max(1, fr), 0, 6.283); ctx.stroke(); }
    // on the dark: a survey grid in perspective, drifting toward you, and a few cells still lit
    if (t > 0.5) {
      const a = clamp01((t - 0.5) / 0.6) * (out > 0 ? clamp01(1 - out / 0.35) : 1), hz = h * 0.56;
      ctx.strokeStyle = `rgba(95, 209, 190, ${0.22 * a})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -14; i <= 14; i++) { ctx.moveTo(w / 2 + i * 8, hz); ctx.lineTo(w / 2 + i * w * 0.16, h + 40); }
      const drift = (t * 0.6) % 1;
      for (let j = 0; j < 12; j++) { const z = (j + drift) / 12, y = hz + (h - hz) * z * z; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      const glow = ctx.createLinearGradient(0, hz - 60, 0, hz + 20); glow.addColorStop(0, 'rgba(255,122,34,0)'); glow.addColorStop(1, `rgba(255,122,34,${0.16 * a})`); ctx.fillStyle = glow; ctx.fillRect(0, hz - 60, w, 80);
      for (const c of cells) if (c.lit && c.y < hz) { ctx.fillStyle = `rgba(255, 215, 154, ${a * (0.3 + 0.3 * Math.sin(t * 3 + c.x))})`; ctx.fillRect(c.x + S * 0.4, c.y + S * 0.4, 3, 3); }
      // where we're going, decoding
      const k = clamp01((t - 0.65) / 0.7), k2 = clamp01((t - 0.95) / 0.7);
      if (frame % 2 === 0) { words[0] = scramble(lines[0], k); words[1] = scramble(lines[1], k2); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.min(52, w / 11)}px "JetBrains Mono", monospace`; ctx.fillStyle = `rgba(255, 244, 232, ${a})`;
      ctx.shadowColor = `rgba(${ORANGE}, 0.85)`; ctx.shadowBlur = 22; ctx.fillText(words[0], w / 2, hz - 120); ctx.shadowBlur = 0;
      ctx.font = `500 ${Math.min(15, w / 28)}px "JetBrains Mono", monospace`; ctx.fillStyle = `rgba(${ORANGE}, ${a})`; ctx.fillText(words[1], w / 2, hz - 74);
      // a progress strip of cells under the words
      const n = 16, filled = Math.min(n, Math.floor(clamp01((t - 0.8) / 1.0) * n));
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < filled ? `rgba(${ORANGE}, ${a})` : `rgba(95, 209, 190, ${0.18 * a})`; ctx.fillRect(w / 2 - n * 7 + i * 14, hz - 44, 10, 4); }
    }
    if (out > 0) {
      canvas.style.opacity = String(clamp01(1 - out / 0.45));
      if (out > 0.5) { canvas.hidden = true; return; }
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return {
    release() {
      return new Promise((res) => {
        const go = () => { const t = (performance.now() - start) / 1000; if (t < MIN) { setTimeout(go, (MIN - t) * 1000); return; } released = t; res(); };
        go();
      });
    },
    stop() { cancelAnimationFrame(raf); canvas.hidden = true; },
  };
}

/* Into the building: the frame breaks into blocks that fill from the middle out. cover() resolves when the view is
   hidden; reveal() opens the blocks onto the new scene. */
export function blocks(canvas) {
  const { ctx, dpr, w, h } = surface(canvas), S = Math.max(36, Math.round(Math.min(w, h) / 14));
  const cols = Math.ceil(w / S), rows = Math.ceil(h / S), cx = w / 2, cy = h / 2, far = Math.hypot(cx, cy);
  const cells = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = c * S, y = r * S; cells.push({ x, y, d: Math.hypot(x + S / 2 - cx, y + S / 2 - cy) / far * 0.38 + Math.random() * 0.12, tint: Math.random() < 0.8 ? ORANGE : CYAN }); }
  let raf = 0;
  const run = (dir, done) => {
    const start = performance.now(), DUR = 0.62;
    const f = (now) => {
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        const k = clamp01((t - c.d) / 0.14), cover = dir > 0 ? k : 1 - k;     // 1 = this block is solid
        if (cover <= 0) continue;
        const sz = S * easeOut(cover), o = (S - sz) / 2;
        ctx.fillStyle = '#040608'; ctx.fillRect(c.x + o, c.y + o, sz, sz);
        const edge = k > 0 && k < 1 ? 1 - Math.abs(k - 0.5) * 2 : 0;
        if (edge > 0) { ctx.strokeStyle = `rgba(${c.tint}, ${edge})`; ctx.lineWidth = 1.5; ctx.strokeRect(c.x + o + 0.5, c.y + o + 0.5, sz - 1, sz - 1); }
      }
      // a scan line sweeping across while it happens
      const sy = (dir > 0 ? t / DUR : 1 - t / DUR) * h; ctx.fillStyle = `rgba(${ORANGE}, 0.6)`; ctx.fillRect(0, sy, w, 2);
      if (Math.random() < 0.4) { ctx.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 3; i++) { const y = Math.floor(Math.random() * canvas.height), th = Math.floor((3 + Math.random() * 24) * dpr); ctx.drawImage(canvas, 0, y, canvas.width, th, (Math.random() - 0.5) * 50 * dpr, y, canvas.width, th); } }
      if (t < DUR + 0.05) raf = requestAnimationFrame(f); else done();
    };
    raf = requestAnimationFrame(f);
  };
  return {
    cover: () => new Promise((res) => run(1, () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#040608'; ctx.fillRect(0, 0, canvas.width, canvas.height); res(); })),
    reveal: () => new Promise((res) => run(-1, () => { canvas.hidden = true; res(); })),
    stop() { cancelAnimationFrame(raf); canvas.hidden = true; },
  };
}
