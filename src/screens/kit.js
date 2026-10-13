// What the room screens share. Each screen is a workstation (or a projector) showing the real work: code, logs,
// plots and diagrams, drawn on a canvas every frame. A screen walks through its steps on a timeline, says which
// step it's on (this.step, which the overlay highlights), and can be sent to any step (goto). A game from
// src/play/ can take the screen over (this.play): while it's on, the game draws; clicking a step hands it back.
export const C = {
  bg: '#0b0f14', pane: '#11161d', head: '#161c24', line: '#263040', ink: '#d6dee8', dim: '#7d8a9a', faint: '#3a4656',
  orange: '#ff9a3c', blue: '#5aa9ff', cyan: '#4ee6ff', green: '#4fd47a', red: '#ff5f6d', yellow: '#e6c45a', purple: '#b38cff', pink: '#ff7ab6',
};
export const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
export const SANS = '"Schibsted Grotesk", system-ui, sans-serif';
export const CLASS = ['#5aa9ff', '#ff9a3c', '#4fd47a', '#b38cff', '#ff7ab6', '#e6c45a'];

export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const fmt = (x, d = 3) => x.toFixed(d);

export function text(ctx, s, x, y, { size = 15, color = C.ink, align = 'left', font = MONO, weight = '', base = 'middle', alpha = 1 } = {}) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color;
  ctx.globalAlpha = alpha; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  return ctx.measureText(s).width;
}
export function rect(ctx, x, y, w, h, { fill = null, stroke = null, lw = 1, r = 0, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha; ctx.beginPath();
  if (r) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
export function line(ctx, pts, { color = C.ink, lw = 1.5, alpha = 1, dash = null } = {}) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}
export function arrow(ctx, x0, y0, x1, y1, { color = C.dim, lw = 2, head = 9, alpha = 1 } = {}) {
  line(ctx, [[x0, y0], [x1, y1]], { color, lw, alpha });
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45)); ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)); ctx.fill(); ctx.globalAlpha = 1;
}
// s, cut short with an ellipsis if it's wider than maxW (in the font already set on ctx)
export function fit(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
export function wrap(ctx, s, maxW) {
  const out = []; let cur = '';
  for (const word of s.split(' ')) { const t = cur ? `${cur} ${word}` : word; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
  if (cur) out.push(cur); return out;
}

// a pane with a title strip, like an editor tab or a terminal
export function pane(ctx, x, y, w, h, title, { accent = C.faint, right = '' } = {}) {
  rect(ctx, x, y, w, h, { fill: C.pane, stroke: C.line });
  rect(ctx, x, y, w, 26, { fill: C.head });
  rect(ctx, x, y + 25, w, 1, { fill: C.line });
  rect(ctx, x, y, 3, 26, { fill: accent });
  text(ctx, title, x + 12, y + 13, { size: 13, color: C.dim });
  if (right) text(ctx, right, x + w - 10, y + 13, { size: 12, color: C.dim, align: 'right' });
  return { x: x + 10, y: y + 34, w: w - 20, h: h - 42 };
}

// minimal Python highlighting, enough for the snippets on screen
const KW = /^(from|import|def|return|for|in|if|else|elif|while|with|as|not|and|or|None|True|False|class|lambda|yield)$/;
export function code(ctx, src, x, y, { size = 14, lh = 20, hl = -1, hlColor = 'rgba(255,154,60,0.16)', width = 400, upto = Infinity } = {}) {
  const rows = src.split('\n');
  rows.forEach((row, i) => {
    if (i >= upto) return;
    const Y = y + i * lh;
    if (i === hl) { rect(ctx, x - 8, Y - lh / 2, width + 8, lh, { fill: hlColor }); rect(ctx, x - 8, Y - lh / 2, 2, lh, { fill: C.orange }); }
    text(ctx, String(i + 1).padStart(2), x - 4, Y, { size: size - 2, color: C.faint, align: 'right' });
    ctx.font = `${size}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let X = x + 12;
    const parts = row.match(/(#.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g) || [];
    let at = 0;
    for (const p of parts) {
      at += p.length;
      let c = C.ink;
      if (p.startsWith('#')) c = C.dim; else if (/^["']/.test(p)) c = C.green; else if (/^\d/.test(p)) c = C.purple;
      else if (KW.test(p)) c = C.pink; else if (/^[A-Z]/.test(p)) c = C.yellow; else if (/^\w+$/.test(p) && row[at] === '(') c = C.blue;
      ctx.fillStyle = c; ctx.fillText(p, X, Y); X += ctx.measureText(p).width;
    }
  });
}

// axes for a plot; returns functions that map data to pixels
export function axes(ctx, x, y, w, h, { xlim = [0, 1], ylim = [0, 1], xlabel = '', ylabel = '', xticks = [], yticks = [], tickFmt = (v) => String(v) } = {}) {
  const L = x + 46, B = y + h - 26, R = x + w - 8, T = y + 6;
  const X = (v) => L + ((v - xlim[0]) / (xlim[1] - xlim[0])) * (R - L), Y = (v) => B - ((v - ylim[0]) / (ylim[1] - ylim[0])) * (B - T);
  for (const v of yticks) { line(ctx, [[L, Y(v)], [R, Y(v)]], { color: C.line, lw: 1 }); text(ctx, tickFmt(v), L - 6, Y(v), { size: 11, color: C.dim, align: 'right' }); }
  for (const v of xticks) text(ctx, String(v), X(v), B + 10, { size: 11, color: C.dim, align: 'center' });
  line(ctx, [[L, T], [L, B], [R, B]], { color: C.faint, lw: 1 });
  if (xlabel) text(ctx, xlabel, (L + R) / 2, B + 22, { size: 11, color: C.dim, align: 'center' });
  if (ylabel) { ctx.save(); ctx.translate(x + 8, (T + B) / 2); ctx.rotate(-Math.PI / 2); text(ctx, ylabel, 0, 0, { size: 11, color: C.dim, align: 'center' }); ctx.restore(); }
  return { X, Y, L, R, T, B };
}

export class Screen {
  constructor(w, h, beats) { this.w = w; this.h = h; this.beats = beats; this.t = 0; this.step = 0; this.st = 0; this.lines = []; this.loop = 0; }
  goto(i) { if (this.play) this.play.on = false; this.step = ((i % this.beats.length) + this.beats.length) % this.beats.length; this.st = 0; if (this.step === 0) this.loop++; this.onStep(this.step); }
  onStep() {}
  // the terminal: a scrolling log
  print(s, color = C.ink) { this.lines.push([s, color]); if (this.lines.length > 60) this.lines.shift(); }
  terminal(ctx, x, y, w, h, title = 'terminal') {
    const b = pane(ctx, x, y, w, h, title, { accent: C.green });
    const lh = 19, n = Math.floor(b.h / lh), rows = this.lines.slice(-n);
    ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y - 6, b.w, b.h + 6); ctx.clip();
    rows.forEach(([s, c], i) => text(ctx, s, b.x, b.y + 4 + i * lh, { size: 13, color: c }));
    if ((this.t * 2) % 2 < 1.2) rect(ctx, b.x, b.y + 4 + rows.length * lh - 7, 8, 14, { fill: C.ink, alpha: 0.7 });
    ctx.restore();
  }
  // the window chrome across the top of a workstation
  chrome(ctx, title, right = '') {
    rect(ctx, 0, 0, this.w, 30, { fill: '#0e131a' }); rect(ctx, 0, 29, this.w, 1, { fill: C.line });
    [C.red, C.yellow, C.green].forEach((c, i) => rect(ctx, 14 + i * 18, 9, 11, 11, { fill: c, r: 6, alpha: 0.8 }));
    text(ctx, title, this.w / 2, 15, { size: 13, color: C.dim, align: 'center' });
    if (right) text(ctx, right, this.w - 12, 15, { size: 12, color: C.dim, align: 'right' });
  }
  frame(ctx, dt) {
    this.t += dt; this.st += dt;
    const play = this.play && this.play.on ? this.play : null;
    if (!play && !this.hold && this.st > this.beats[this.step]) this.goto(this.step + 1);
    ctx.save();
    rect(ctx, 0, 0, this.w, this.h, { fill: C.bg });
    if (play) play.draw(this, ctx); else { this.update?.(dt); this.draw(ctx); }
    // the glass: faint scanlines and a soft edge
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < this.h; y += 3) ctx.fillRect(0, y, this.w, 1);
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.45, this.w / 2, this.h / 2, this.w * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }
  pointer() { return false; }
  click() { return false; }
}
