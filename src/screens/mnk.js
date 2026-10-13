// mnk-bench on the lab workstation: a real MENACE learner (one matchbox per position, beads per move, +3 win,
// +1 draw, -1 loss) plays X against a random opponent, and the benchmark plots its learning curve; then the
// same learner on a bigger (m, n, k) board, to compare how fast it learns.
import { Screen, C, text, rect, line, pane, code, axes, clamp } from './kit.js';

const SRC = `class Menace:
    def __init__(self, m, n, k):
        self.boxes = {}   # position -> beads per move
    def move(self, board):
        beads = self.boxes.setdefault(
            key(board), init_beads(board))
        return random.choices(moves(board), beads)[0]
    def learn(self, history, result):
        delta = {WIN: 3, DRAW: 1, LOSS: -1}[result]
        for pos, mv in history:
            self.boxes[pos][mv] += delta

bench.run(Menace, boards=[(3,3,3), (4,4,3)],
          games=2000, plot="curves.png")`;
const HL = [2, 6, 10, 12, 12], GAMES = 2000;

function linesFor(m, n, k) {
  const L = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = []; for (let i = 0; i < k; i++) { const rr = r + dr * i, cc = c + dc * i; if (rr < 0 || rr >= m || cc < 0 || cc >= n) break; cells.push(rr * n + cc); }
    if (cells.length === k) L.push(cells);
  }
  return L;
}
// the 8 rotations and reflections of a square board, as cell permutations: canonical[i] = board[T[i]]
function symmetries(n) {
  const out = [], at = (r, c) => r * n + c;
  for (let f = 0; f < 2; f++) for (let rot = 0; rot < 4; rot++) {
    const T = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      let rr = r, cc = f ? n - 1 - c : c;
      for (let q = 0; q < rot; q++) [rr, cc] = [cc, n - 1 - rr];
      T.push(at(rr, cc));
    }
    out.push(T);
  }
  return out;
}
// MENACE keeps one box per position up to symmetry, as the original matchbox machine did
export class Menace {
  constructor(m, n, k) { this.m = m; this.n = n; this.k = k; this.lines = linesFor(m, n, k); this.sym = symmetries(n); this.boxes = new Map(); this.history = []; this.reset(); }
  canon(b) { let best = null, bt = null; for (const T of this.sym) { const key = T.map((i) => b[i]).join(''); if (best === null || key < best) { best = key; bt = T; } } return [best, bt]; }
  reset() { this.board = Array(this.m * this.n).fill(0); this.turn = 1; this.moves = []; this.result = null; this.last = null; }
  winner(b) { for (const l of this.lines) { const v = b[l[0]]; if (v && l.every((c) => b[c] === v)) return v; } return b.every((x) => x) ? 3 : 0; }
  beads(key) { if (!this.boxes.has(key)) this.boxes.set(key, Array.from(key, (x) => (x !== '0' ? 0 : this.m === 3 ? 4 : 3))); return this.boxes.get(key); }
  // X's move: draw a bead from this position's box
  draw() {
    const b = this.board, [key, T] = this.canon(b), beads = this.beads(key);
    let total = beads.reduce((x, y) => x + y, 0);
    if (!total) { Array.from(key).forEach((x, i) => { if (x === '0') beads[i] = 1; }); total = beads.reduce((x, y) => x + y, 0); }
    let r = Math.random() * total, j = 0;
    for (let i = 0; i < beads.length; i++) { r -= beads[i]; if (r <= 0 && beads[i] > 0) { j = i; break; } }
    const pick = T[j], shown = Array(beads.length).fill(0); T.forEach((cell, i) => { shown[cell] = beads[i]; });
    this.last = { key, pick, beads: shown, total }; this.moves.push([key, j]); this.place(pick, 1);
    return pick;
  }
  // put a mark down; when that ends the game, reinforce every move X made
  place(cell, who) {
    this.board[cell] = who; this.turn = 3 - who;
    const w = this.winner(this.board);
    if (w) {
      this.result = w === 1 ? 'win' : w === 2 ? 'loss' : 'draw';
      const d = { win: 3, draw: 1, loss: -1 }[this.result];
      for (const [key, i] of this.moves) { const bs = this.boxes.get(key); bs[i] = Math.max(0, bs[i] + d); }
      this.history.push(this.result);
    }
  }
  // one move of a game against a random opponent
  step() {
    if (this.turn === 1) this.draw();
    else { const free = this.board.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0); this.place(free[(Math.random() * free.length) | 0], 2); }
  }
  game() { this.reset(); while (!this.result) this.step(); }
  curve(N = 150) { const H = this.history, out = []; for (let e = N; e <= H.length; e += 20) { const win = H.slice(e - N, e); out.push([e, win.filter((x) => x !== 'loss').length / N]); } return out; }
}

export class MnkScreen extends Screen {
  constructor(w, h) { super(w, h, [5, 5, 7, 10, 10]); this.goto(0); }
  onStep(s) {
    if (s === 0) { this.a = new Menace(3, 3, 3); this.b = null; this.lines = []; this.print('$ python -m mnkbench.run --boards 3x3k3,4x4k3 --games 2000', C.green); }
    if (s === 1) this.print('MENACE draws a bead from this position\'s box', C.dim);
    if (s === 2) this.print('game over: reinforcing every move it made', C.yellow);
    if (s === 3) this.print('training 3x3, k=3 against a random player ...', C.green);
    if (s === 4) { this.b = new Menace(4, 4, 3); this.print('training 4x4, k=3 ...', C.green); }
    this.wait = 0; this.cur = this.a; this.lastLog = 0;
  }
  update(dt) {
    const s = this.step;
    if (s <= 2) {                                          // one move at a time
      this.wait += dt; const g = this.a;
      if (this.wait > (g.result ? 1.6 : 0.55)) {
        this.wait = 0;
        if (g.result) g.reset(); else { g.step(); if (g.result) this.print(`game ${g.history.length}: ${g.result}   +${{ win: 3, draw: 1, loss: -1 }[g.result]} beads on ${g.moves.length} moves   boxes ${g.boxes.size}`, g.result === 'loss' ? C.red : C.green); }
      }
    } else {
      const g = s === 3 ? this.a : this.b, target = Math.min(GAMES, Math.floor((this.st / (this.beats[s] - 1.5)) * GAMES));
      let n = 0; while (g.history.length < target && n++ < 40) g.game();
      this.cur = g;
      const bucket = Math.floor(g.history.length / 250); if (bucket > 0 && bucket !== this.lastLog) { this.lastLog = bucket; const c = g.curve(); this.print(`${g.m}x${g.n}  games ${String(g.history.length).padStart(3)}  win+draw ${(c.length ? c[c.length - 1][1] * 100 : 0).toFixed(0)}%  boxes ${g.boxes.size}`); }
    }
  }
  draw(ctx) {
    const { w, h } = this, s = this.step, g = this.cur;
    this.chrome(ctx, 'akash@caraml-ws3: ~/mnk-bench', 'CARAML Lab');
    const cb = pane(ctx, 8, 38, 470, 356, 'mnkbench/menace.py', { accent: C.orange });
    code(ctx, SRC, cb.x + 14, cb.y + 6, { size: 12.5, lh: 22.5, hl: HL[s], width: cb.w - 10 });
    // the board, with this position's beads as a heat map
    const bb = pane(ctx, 486, 38, 250, 356, `board ${g.m}x${g.n}, k=${g.k}`, { accent: C.blue });
    const size = 220, cs = size / g.n, bx = bb.x + (bb.w - size) / 2, by = bb.y + 8;
    const L = g.last, total = L ? L.total : 0;
    for (let i = 0; i < g.m * g.n; i++) {
      const r = (i / g.n) | 0, c = i % g.n, x = bx + c * cs, y = by + r * cs, v = L && total ? L.beads[i] / total : 0;
      rect(ctx, x + 2, y + 2, cs - 4, cs - 4, { fill: `rgba(255,154,60,${v * 0.9})`, stroke: C.line });
      if (g.board[i] === 1) text(ctx, 'X', x + cs / 2, y + cs / 2 + 1, { size: cs * 0.5, color: C.orange, align: 'center', weight: '700' });
      else if (g.board[i] === 2) text(ctx, 'O', x + cs / 2, y + cs / 2 + 1, { size: cs * 0.5, color: C.blue, align: 'center', weight: '700' });
      else if (L && L.beads[i]) text(ctx, String(L.beads[i]), x + cs - 8, y + 12, { size: 11, color: C.dim, align: 'right' });
      if (L && i === L.pick && s === 1) rect(ctx, x + 2, y + 2, cs - 4, cs - 4, { stroke: C.yellow, lw: 3 });
    }
    const info = s <= 1 ? `this box: ${total} beads` : g.result ? `result: ${g.result}` : `${g.history.length} games`;
    text(ctx, info, bb.x + bb.w / 2, by + size + 22, { size: 13, color: g.result === 'loss' ? C.red : C.ink, align: 'center' });
    text(ctx, `${g.boxes.size} matchboxes`, bb.x + bb.w / 2, by + size + 44, { size: 13, color: C.dim, align: 'center' });
    if (L && s === 1) text(ctx, `P(pick) = ${L.beads[L.pick]}/${total}`, bb.x + bb.w / 2, by + size + 66, { size: 13, color: C.yellow, align: 'center' });
    // the learning curves
    const pb = pane(ctx, 744, 38, w - 752, 356, 'curves.png  win + draw rate', { accent: C.purple });
    const a = axes(ctx, pb.x, pb.y, pb.w, pb.h, { xlim: [0, GAMES], ylim: [0, 1], xlabel: 'games', xticks: [0, 1000, 2000], yticks: [0, 0.5, 1] });
    for (const [M, col, label] of [[this.a, C.orange, '3x3 k=3'], [this.b, C.blue, '4x4 k=3']]) {
      if (!M) continue; const pts = M.curve(); if (pts.length > 1) line(ctx, pts.map(([x, y]) => [a.X(x), a.Y(y)]), { color: col, lw: 2.2 });
      text(ctx, label, a.L + 8, a.T + 10 + (M === this.b ? 18 : 0), { size: 12, color: col });
    }
    this.terminal(ctx, 8, 402, w - 16, h - 410);
  }
}
