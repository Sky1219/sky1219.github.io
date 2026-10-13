// The big screen above the ECSW stage during HackUTD: the event dashboard. Each step brings up the part of the
// weekend it's about: the CTF scoreboard, logistics, the events schedule, the sponsor challenges. Team names,
// challenge names and times here are placeholders.
import { Screen, C, MONO, SANS, text, box, rng, clamp, ease } from './kit.js';

const TEAMS = ['null_ptr', 'segfault_sisters', 'temoc_hax', 'byte_me', 'root_beer', 'off_by_one', 'sudo_su', 'ctrl_alt_defeat'];
const CHAL = ['warmup/hello', 'web/cookie-jar', 'crypto/xor-me', 'forensics/spectrogram', 'osint/campus-walk', 'rev/lockpick', 'pwn/overflow'];
const SCHED = [['11:00', 'Opening ceremony', 'Main stage'], ['13:00', 'Hacking begins', 'Everywhere'], ['14:00', 'Workshop: intro to RAG', 'ECSS 2.410'], ['16:00', 'Workshop: build an MCP server', 'ECSS 2.410'],
  ['18:00', 'Workshop: agents and tool use', 'ECSS 2.410'], ['21:00', 'Mini-event: cup stacking', 'Atrium'], ['00:00', 'Midnight snack', 'Lobby'], ['02:00', 'CTF final hour', 'Online']];
const TRACKS = [['Best use of AI', 'Booth 1'], ['Best hardware hack', 'Booth 2'], ['Best fintech', 'Booth 3'], ['Best social impact', 'Booth 4'], ['Best design', 'Booth 5'], ['Best beginner hack', 'Booth 6']];

export class StageScreen extends Screen {
  constructor(w, h) {
    super(w, h, [8, 7, 8, 7]);
    const r = rng(4); this.r = r;
    this.scores = TEAMS.map((t) => ({ t, s: 200 + Math.floor(r() * 900) }));
    this.feed = []; this.next = 0;
  }
  draw(ctx, dt) {
    const { w, h } = this, st = this.step;
    // live solves
    this.next -= dt;
    if (this.next <= 0) { this.next = 0.9 + this.r() * 1.3; const tm = this.scores[(this.r() * TEAMS.length) | 0], c = CHAL[(this.r() * CHAL.length) | 0], pts = [50, 100, 200, 300][(this.r() * 4) | 0]; tm.s += pts; this.feed.unshift({ t: tm.t, c, pts, at: this.t }); this.feed = this.feed.slice(0, 6); }
    box(ctx, 0, 0, w, h, { fill: '#07070d' });
    // header
    text(ctx, 'HackUTD', 28, 34, { size: 30, font: SANS, weight: '800', color: '#fff' });
    text(ctx, 'ECSW · live', 170, 36, { size: 15, font: SANS, color: '#9aa3b5' });
    const left = 17 * 3600 + 42 * 60 - Math.floor(this.t);
    text(ctx, `HACKING ENDS IN  ${String((left / 3600) | 0).padStart(2, '0')}:${String(((left % 3600) / 60) | 0).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`, w - 28, 34, { size: 18, color: C.acc, align: 'right', weight: '700' });
    box(ctx, 28, 62, w - 56, 2, { fill: '#232336' });
    const P = [[28, 80, 470, 236], [526, 80, 470, 236], [28, 330, 470, 230], [526, 330, 470, 230]];
    const draws = [this.ctf, this.logistics, this.events, this.sponsors];
    P.forEach(([x, y, pw, ph], i) => {
      const on = i === st;
      ctx.globalAlpha = on ? 1 : 0.38;
      box(ctx, x, y, pw, ph, { fill: on ? '#11111c' : '#0c0c14', stroke: on ? C.acc : '#232336', lw: on ? 2 : 1, r: 10 });
      draws[i].call(this, ctx, x + 16, y + 14, pw - 32, ph - 28, on);
      ctx.globalAlpha = 1;
    });
  }
  title(ctx, x, y, s, on) { text(ctx, s, x, y + 8, { size: 14, font: SANS, weight: '700', color: on ? C.acc : '#c9cfdb' }); }
  ctf(ctx, x, y, w, h) {
    this.title(ctx, x, y, 'CTF scoreboard');
    const top = [...this.scores].sort((a, b) => b.s - a.s).slice(0, 5);
    top.forEach((s, i) => { const yy = y + 36 + i * 22; text(ctx, `${i + 1}`, x, yy, { size: 13, color: '#9aa3b5' }); text(ctx, s.t, x + 22, yy, { size: 13, color: '#fff' }); text(ctx, String(s.s), x + w * 0.55, yy, { size: 13, color: C.ok, align: 'right' }); });
    const fx = x + w * 0.6; text(ctx, 'recent solves', fx, y + 8, { size: 11, color: '#9aa3b5' });
    this.feed.slice(0, 6).forEach((f, i) => { const a = clamp((this.t - f.at) * 3, 0, 1); ctx.save(); ctx.globalAlpha *= a; text(ctx, f.t, fx, y + 36 + i * 30, { size: 11.5, color: '#fff' }); text(ctx, `${f.c}  +${f.pts}`, fx, y + 50 + i * 30, { size: 10.5, color: C.ok }); ctx.restore(); });
  }
  logistics(ctx, x, y, w, h) {
    this.title(ctx, x, y, 'Logistics');
    const n = Math.min(1300, 1180 + Math.floor(this.t * 2));
    text(ctx, n.toLocaleString(), x, y + 54, { size: 40, font: SANS, weight: '800', color: '#fff' });
    text(ctx, 'hackers checked in', x, y + 84, { size: 12, color: '#9aa3b5' });
    box(ctx, x, y + 98, w * 0.45, 8, { fill: '#232336', r: 4 }); box(ctx, x, y + 98, w * 0.45 * n / 1300, 8, { fill: C.acc, r: 4 });
    [['Dinner', '7:00 PM · lobby'], ['Breakfast', '8:00 AM · lobby'], ['Quiet room', 'ECSW 1.355'], ['Help desk', 'by the stage']].forEach(([a, b], i) => {
      const yy = y + 34 + i * 26; text(ctx, a, x + w * 0.52, yy, { size: 12.5, color: '#fff', font: SANS, weight: '600' }); text(ctx, b, x + w, yy, { size: 12, color: '#9aa3b5', align: 'right' });
    });
    text(ctx, 'Wi-Fi: HackUTD-guest', x, y + h - 8, { size: 11, color: '#9aa3b5' });
  }
  events(ctx, x, y, w, h) {
    this.title(ctx, x, y, 'Schedule');
    const now = 2 + (Math.floor(this.t / 6) % 4);
    SCHED.forEach(([t, e, where], i) => {
      const yy = y + 32 + i * 23, on = i === now;
      if (on) box(ctx, x - 6, yy - 10, w + 12, 21, { fill: 'rgba(255,138,61,0.16)', r: 4 });
      text(ctx, t, x, yy, { size: 12, color: on ? C.acc : '#9aa3b5' }); text(ctx, e, x + 56, yy, { size: 12.5, font: SANS, color: i < now ? '#6b7180' : '#fff', weight: on ? '700' : '400' });
      text(ctx, on ? 'NOW' : where, x + w, yy, { size: 11, color: on ? C.acc : '#9aa3b5', align: 'right', weight: on ? '700' : '' });
    });
  }
  sponsors(ctx, x, y, w, h) {
    this.title(ctx, x, y, 'Sponsor challenges');
    TRACKS.forEach(([t, b], i) => {
      const col = i % 2, row = (i / 2) | 0, xx = x + col * (w / 2), yy = y + 30 + row * 58;
      box(ctx, xx, yy, w / 2 - 10, 48, { fill: '#171724', r: 6 });
      text(ctx, t, xx + 12, yy + 17, { size: 12.5, font: SANS, weight: '600', color: '#fff' });
      text(ctx, `${b} · mentors on site`, xx + 12, yy + 34, { size: 10.5, color: '#9aa3b5' });
    });
    text(ctx, 'Judging Sunday 11:00 · submit by 10:00', x, y + h - 6, { size: 11, color: '#9aa3b5' });
  }
}
