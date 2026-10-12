// The stage screen at HackUTD: the organizers' live dashboard for the weekend, with a panel for each of my jobs
// (the CTF, logistics, events, industry partners). The panel for the current step lights up. Team names and
// counts other than the 1,300 participants are illustrative.
import { Screen, C, SANS, text, rect, line, pane, ease, clamp, rng } from './kit.js';

const TEAMS = ['null_ptr', 'segfault sisters', 'tcp/ayy', 'root beer', 'byte me', 'stack smashers', 'xor-cist', 'git push -f'];
const CATS = [['web', 9], ['crypto', 6], ['forensics', 7], ['reversing', 5], ['on campus', 8]];
const EVENTS = [['10:00', 'Check-in opens'], ['12:00', 'Opening ceremony'], ['13:00', 'Hacking starts'], ['14:00', 'Workshop: building AI agents'], ['16:00', 'Workshop: RAG from scratch'], ['20:00', 'Mini event'], ['00:00', 'Midnight snack'], ['11:00', 'Hacking ends, judging']];
const TRACKS = [['Sponsor track A', 14, 3], ['Sponsor track B', 22, 4], ['Sponsor track C', 9, 2], ['Sponsor track D', 17, 3], ['Best use of AI', 31, 5]];

export class HackathonScreen extends Screen {
  constructor(w, h) {
    super(w, h, [8, 8, 8, 8]);
    const r = rng(9); this.score = TEAMS.map((n) => [n, Math.floor(r() * 900) + 300]); this.feed = [];
    this.goto(0);
  }
  onStep() { this.lines = []; }
  update(dt) {
    if (Math.random() < dt * 1.4) {                       // flags keep coming in
      const k = (Math.random() * TEAMS.length) | 0, cat = CATS[(Math.random() * CATS.length) | 0][0];
      this.score[k][1] += 100; this.feed.unshift(`${TEAMS[k]} solved a ${cat} challenge  +100`); this.feed.length = Math.min(this.feed.length, 4);
    }
  }
  draw(ctx) {
    const { w, h } = this, s = this.step, st = this.st;
    // header
    rect(ctx, 0, 0, w, 56, { fill: '#0e131a' }); rect(ctx, 0, 55, w, 1, { fill: C.line });
    const tw = text(ctx, 'HackUTD', 22, 29, { size: 26, font: SANS, weight: '800', color: C.ink });
    rect(ctx, 22 + tw + 14, 25, 8, 8, { fill: C.red, r: 4, alpha: 0.5 + 0.5 * Math.sin(this.t * 4) });
    text(ctx, 'live', 22 + tw + 28, 30, { size: 14, color: C.red });
    const left = 22 * 3600 - Math.floor(this.t * 37) % 3600;
    text(ctx, `hacking ends in ${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(Math.floor(left / 60) % 60).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`, w - 22, 29, { size: 18, color: C.orange, align: 'right' });
    const P = [[8, 64, 500, 252], [516, 64, w - 524, 252], [8, 324, 500, h - 332], [516, 324, w - 524, h - 332]];
    const titles = ['CTF scoreboard', 'Logistics', 'Events', 'Industry partners'];
    P.forEach(([x, y, pw, ph], i) => {
      const on = i === s;
      const b = pane(ctx, x, y, pw, ph, titles[i], { accent: on ? C.orange : C.faint });
      if (on) rect(ctx, x, y, pw, ph, { stroke: C.orange, lw: 2 });
      this[`p${i}`](ctx, b, on ? st : 99);
      if (!on) rect(ctx, x + 1, y + 26, pw - 2, ph - 27, { fill: 'rgba(11,15,20,0.55)' });
    });
  }
  // the CTF: scoreboard, challenge categories, and the solve feed
  p0(ctx, b) {
    const top = [...this.score].sort((a, c) => c[1] - a[1]).slice(0, 5);
    top.forEach(([n, sc], i) => { const y = b.y + 6 + i * 24; text(ctx, `${i + 1}`, b.x, y, { size: 14, color: C.dim }); text(ctx, n, b.x + 24, y, { size: 14 }); text(ctx, String(sc), b.x + 240, y, { size: 14, color: C.orange, align: 'right' }); });
    CATS.forEach(([c, n], i) => { const y = b.y + 6 + i * 24; text(ctx, c, b.x + 270, y, { size: 13, color: C.dim }); for (let k = 0; k < n; k++) rect(ctx, b.x + 370 + k * 10, y - 5, 7, 10, { fill: k < n * 0.6 ? C.green : C.line }); });
    this.feed.slice(0, 2).forEach((f, i) => text(ctx, f, b.x, b.y + 140 + i * 22, { size: 13, color: i ? C.dim : C.green }));
  }
  // logistics: check-in count, meals, rooms
  p1(ctx, b, st) {
    const n = Math.round(1300 * ease(Math.min(1, st / 5)));
    text(ctx, n.toLocaleString('en-US'), b.x, b.y + 30, { size: 46, font: SANS, weight: '800', color: C.ink });
    text(ctx, 'checked in of 1,300', b.x + 6, b.y + 66, { size: 13, color: C.dim });
    rect(ctx, b.x, b.y + 84, 220, 8, { fill: C.line }); rect(ctx, b.x, b.y + 84, 220 * n / 1300, 8, { fill: C.orange });
    [['Lunch', 'served'], ['Dinner', '19:00'], ['Midnight snack', '00:00'], ['Breakfast', '08:00']].forEach(([m, v], i) => { text(ctx, m, b.x + 250, b.y + 8 + i * 24, { size: 13 }); text(ctx, v, b.x + b.w, b.y + 8 + i * 24, { size: 13, color: v === 'served' ? C.green : C.dim, align: 'right' }); });
    [['ECSW atrium', 'hacking'], ['ECSS rooms', 'workshops'], ['Sleeping rooms', 'open 22:00']].forEach(([r, v], i) => { text(ctx, r, b.x, b.y + 118 + i * 22, { size: 13 }); text(ctx, v, b.x + 220, b.y + 118 + i * 22, { size: 13, color: C.dim, align: 'right' }); });
  }
  // events: the schedule, with a marker for now
  p2(ctx, b, st) {
    const now = 3 + Math.floor((st > 50 ? 0 : st) / 3) % 3;
    EVENTS.forEach(([t, e], i) => {
      const col = i % 2, row = (i / 2) | 0, x = b.x + col * 240, y = b.y + 8 + row * 30;
      if (i === now) rect(ctx, x - 6, y - 12, 232, 24, { fill: 'rgba(255,154,60,0.18)', r: 4 });
      text(ctx, t, x, y, { size: 13, color: i < now ? C.faint : C.dim }); text(ctx, e.length > 22 ? e.slice(0, 21) + '…' : e, x + 52, y, { size: 13, color: i === now ? C.orange : i < now ? C.faint : C.ink });
    });
  }
  // industry partners: tracks, with teams entered and mentors on the floor
  p3(ctx, b, st) {
    text(ctx, 'track', b.x, b.y + 4, { size: 12, color: C.dim }); text(ctx, 'teams', b.x + 230, b.y + 4, { size: 12, color: C.dim }); text(ctx, 'mentors here', b.x + 320, b.y + 4, { size: 12, color: C.dim });
    TRACKS.forEach(([t, n, m], i) => { const y = b.y + 28 + i * 22, k = ease(clamp(st - i * 0.3)); text(ctx, t, b.x, y, { size: 13 }); rect(ctx, b.x + 230, y - 5, 50 * (n / 31) * k, 10, { fill: C.blue }); text(ctx, String(Math.round(n * k)), b.x + 288, y, { size: 12, color: C.dim }); for (let q = 0; q < m; q++) rect(ctx, b.x + 320 + q * 14, y - 5, 10, 10, { fill: C.green, r: 5 }); });
  }
}
