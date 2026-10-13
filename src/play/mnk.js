// "Matchboxes vs. the language model." DistilGPT-2 plays tic-tac-toe with no game knowledge at all: the game so
// far is written out as text, and it takes the legal square whose number it finds the likeliest next token. It
// is X and moves first. MENACE (the learner from screens/mnk.js) is O, starts out knowing nothing, and learns
// from every game. The visitor can sit in either seat.
import { C, text, rect, line, pane, axes, wrap, MONO } from '../screens/kit.js';
import { Menace } from '../screens/mnk.js';
import { engine, ask, encode } from '../llm/engine.js';
import { pct } from './index.js';

const LM = 2, BOX = 1;                                   // the marks on the board: the model's X, MENACE's O
const MARK = { [LM]: 'X', [BOX]: 'O' };
// moves is every square taken so far, in order, the model's first
export const textOf = (moves) => `A game of tic-tac-toe on squares 1 to 9:${moves.map((m, i) => ` ${i % 2 ? 'O' : 'X'} ${m + 1},`).join('')} X`;
const WINDOW = 25, BATCH = 100;

// MENACE, its record against the model, and every position the model has been asked about, kept while the page is open
const G = { m: new Menace(3, 3, 3), hist: [], asked: new Map(), evals: 0 };
const boardOf = (moves) => { const b = Array(9).fill(0); moves.forEach((c, i) => { b[c] = i % 2 ? BOX : LM; }); return b; };

// the model's reading of a position: the probability of each legal square's number, normalized over the legal ones
function read(moves) {
  const key = moves.join('');
  if (!G.asked.has(key)) {
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => engine.tok.encode(` ${d}`)[0]);
    G.asked.set(key, ask({ type: 'score', ids: encode(textOf(moves)), want: digits }).then((r) => {
      const b = boardOf(moves), p = r.want.map((v, i) => (b[i] ? 0 : v)), z = p.reduce((x, y) => x + y, 0) || 1;
      G.evals++; return p.map((v) => v / z);
    }));
  }
  return G.asked.get(key);
}
async function modelMove(g, moves) {
  const p = await read(moves); let cell = 0; for (let i = 1; i < 9; i++) if (p[i] > p[cell]) cell = i;
  // while the game goes on, the other workers read the positions each reply would lead to
  for (let r = 0; r < 9; r++) { if (r === cell || g.board[r]) continue; const b = g.board.slice(); b[cell] = LM; b[r] = BOX; if (!g.winner(b)) read([...moves, cell, r]); }
  return { cell, p, text: textOf(moves) };
}
const share = (h, who) => h.filter((x) => x === who).length;

export function mount(root, screen) {
  const ref = new Menace(3, 3, 3);                        // a plain board for games MENACE isn't in
  const S = { on: false, draw, g: G.m, mode: 'idle', seat: 0, wait: false, moves: [], lm: null, logs: [], note: '' };
  screen.play = S;
  let alive = true, run = 0;
  const log = (s, c = C.ink) => S.logs.push([s, c]);
  root.innerHTML = `
    <p class="g-note">The model is X and moves first. MENACE is O. MENACE starts with random moves and adjusts after every game, so it should overtake the model as more games are played. The model never learns.</p>
    <div class="g-row"><button type="button" class="g-btn g-train">Play ${BATCH} games: MENACE vs the model</button></div>
    <div class="g-row"><button type="button" class="g-ghost g-lm">Play the model yourself</button><button type="button" class="g-ghost g-box">Play MENACE yourself</button></div>
    <div class="g-board" role="group" aria-label="Board">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-i="${i}" disabled></button>`).join('')}</div>
    <p class="g-result" aria-live="polite"></p>`;
  const cells = [...root.querySelectorAll('.g-board button')], result = root.querySelector('.g-result'), train = root.querySelector('.g-train');
  const render = () => {
    cells.forEach((b, i) => {
      const v = S.g.board[i]; b.textContent = v ? MARK[v] : ''; b.dataset.mark = v ? MARK[v] : '';
      b.disabled = !!v || !S.seat || S.g.turn !== S.seat || !!S.g.result || S.wait;
      b.setAttribute('aria-label', `Square ${i + 1}, ${v ? MARK[v] : 'empty'}`);
    });
    train.disabled = S.mode === 'train';
    result.textContent = S.note;
  };
  const record = () => {
    const h = G.hist, n = h.length; if (!n) return '';
    const first = h.slice(0, WINDOW), last = h.slice(-WINDOW);
    return `${n} games: MENACE won ${share(h, 'win')}, the model ${share(h, 'loss')}, ${share(h, 'draw')} drawn.`
      + (n >= 2 * WINDOW ? ` In the first ${WINDOW}, MENACE won ${share(first, 'win')} and the model ${share(first, 'loss')}; in the last ${WINDOW}, MENACE ${share(last, 'win')} and the model ${share(last, 'loss')}.` : '');
  };
  // the model takes its turn in the game on the board
  const modelTurn = async (id) => {
    const r = await modelMove(S.g, S.moves);
    if (!alive || id !== run) return false;
    S.lm = r; S.moves.push(r.cell); S.g.place(r.cell, LM);
    return true;
  };

  train.onclick = async () => {
    const id = ++run; S.mode = 'train'; S.seat = 0; S.on = true; S.g = G.m; S.wait = false; render();
    if (!S.logs.length) log('$ python -m mnkbench.run --board 3x3k3 --agents menace,distilgpt2', C.green);
    for (let n = 0; n < BATCH; n++) {
      G.m.reset(); S.moves = [];
      for (;;) {
        if (!(await modelTurn(id))) return;
        if (G.m.result) break;
        S.moves.push(G.m.draw());
        if (G.m.result) break;
      }
      G.hist.push(G.m.result);
      const k = G.hist.length;
      if (k % WINDOW === 0) { const w = G.hist.slice(-WINDOW); log(`games ${String(k - WINDOW + 1).padStart(3)}-${String(k).padEnd(3)}  MENACE ${String(share(w, 'win')).padStart(2)}   model ${String(share(w, 'loss')).padStart(2)}   draws ${String(share(w, 'draw')).padStart(2)}   boxes ${G.m.boxes.size}   positions read ${G.evals}`, share(w, 'win') > share(w, 'loss') ? C.orange : C.blue); }
      S.note = record(); render();
      await new Promise((r) => setTimeout(r, 30));          // slow enough to watch
      if (!alive || id !== run) return;
    }
    S.mode = 'idle'; render();
  };
  // the visitor takes a seat: seat is the mark they play
  const sit = async (seat) => {
    const id = ++run; S.mode = 'play'; S.seat = seat; S.on = true; S.moves = []; S.lm = null;
    S.g = seat === BOX ? ref : G.m; S.g.reset(); S.g.turn = LM;
    if (seat === BOX) { S.note = 'You are O. The model is thinking…'; S.wait = true; render(); if (!(await modelTurn(id))) return; S.wait = false; S.note = 'You are O. Your move.'; }
    else S.note = 'You are X, in the model’s seat. You move first.';
    render();
  };
  root.querySelector('.g-lm').onclick = () => sit(BOX);
  root.querySelector('.g-box').onclick = () => sit(LM);
  const over = () => {
    const r = S.g.result, won = (r === 'win') === (S.seat === BOX);     // result is from O's side
    S.note = r === 'draw' ? 'A draw.' : won ? 'You won.' : S.seat === BOX ? 'The model won.' : 'MENACE won, and added beads to every move it made.';
    if (S.seat === LM && r === 'loss') S.note = 'You won, and MENACE took a bead out of every move it made.';
  };
  cells.forEach((b, i) => { b.onclick = async () => {
    const id = run, g = S.g; if (!S.seat || g.board[i] || g.result || g.turn !== S.seat || S.wait) return;
    S.on = true; S.moves.push(i); g.place(i, S.seat);
    if (!g.result) {
      if (S.seat === BOX) { S.wait = true; S.note = 'The model is thinking…'; render(); if (!(await modelTurn(id))) return; S.wait = false; S.note = 'Your move.'; }
      else { S.moves.push(g.draw()); S.note = 'MENACE drew a bead. Your move.'; }
    }
    if (g.result) over();
    render();
  }; });
  S.note = record() || `Start with ${BATCH} games and watch who is ahead.`;
  render();
  return () => { alive = false; run++; };
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc, g = S.g, H = G.hist;
  sc.chrome(ctx, 'akash@caraml-ws3: ~/mnk-bench', 'live on this device');
  // the board: the model's X, MENACE's O; empty squares carry what whoever moved last thought of them
  const bb = pane(ctx, 8, 38, 290, 356, 'board 3x3, k=3', { accent: C.blue, right: S.mode === 'train' ? `game ${H.length + 1}` : S.seat ? 'you are playing' : '' });
  const size = 228, cs = size / 3, bx = bb.x + (bb.w - size) / 2, by = bb.y + 6, beads = g === G.m && g.last && g.turn === LM ? g.last : null;
  for (let i = 0; i < 9; i++) {
    const x = bx + (i % 3) * cs, y = by + Math.floor(i / 3) * cs, v = g.board[i];
    rect(ctx, x + 2, y + 2, cs - 4, cs - 4, { fill: C.head, stroke: C.line });
    text(ctx, String(i + 1), x + 9, y + 13, { size: 11, color: C.faint });
    if (v) text(ctx, MARK[v], x + cs / 2, y + cs / 2 + 2, { size: cs * 0.5, color: v === LM ? C.blue : C.orange, align: 'center', weight: '700' });
    else if (beads && beads.beads[i]) text(ctx, `${beads.beads[i]} beads`, x + cs / 2, y + cs / 2, { size: 12, color: C.orange, align: 'center' });
  }
  text(ctx, 'X  DistilGPT-2', bb.x, by + size + 22, { size: 13, color: C.blue });
  text(ctx, S.seat === LM ? 'X  you' : S.seat === BOX ? 'O  you' : 'O  MENACE', bb.x + 150, by + size + 22, { size: 13, color: C.orange });
  text(ctx, `${G.m.boxes.size} matchboxes   ${G.evals} positions read`, bb.x, by + size + 48, { size: 12, color: C.dim });
  if (g.result) text(ctx, g.result === 'draw' ? 'draw' : `${g.result === 'win' ? 'O' : 'X'} wins`, bb.x, by + size + 72, { size: 14, color: g.result === 'win' ? C.orange : g.result === 'loss' ? C.blue : C.ink });
  // what the model was shown, and how likely it found each square's number
  const mb = pane(ctx, 306, 38, 330, 356, 'what the model reads', { accent: C.purple });
  if (S.lm) {
    ctx.font = `13px ${MONO}`;
    const rows = wrap(ctx, S.lm.text, mb.w); rows.forEach((r, i) => text(ctx, r, mb.x, mb.y + 6 + i * 19, { size: 13, color: i === rows.length - 1 ? C.ink : C.dim }));
    const y0 = mb.y + 96;
    text(ctx, 'next token, over the legal squares', mb.x, y0, { size: 12, color: C.dim });
    S.lm.p.forEach((p, i) => {
      const y = y0 + 24 + i * 24, on = i === S.lm.cell;
      text(ctx, `" ${i + 1}"`, mb.x, y, { size: 13, color: p ? (on ? C.blue : C.ink) : C.faint });
      if (!p) { text(ctx, 'taken', mb.x + 52, y, { size: 12, color: C.faint }); return; }
      rect(ctx, mb.x + 52, y - 6, 190 * p, 12, { fill: on ? C.blue : C.faint });
      text(ctx, pct(p), mb.x + mb.w, y, { size: 12, color: on ? C.blue : C.dim, align: 'right' });
    });
  } else text(ctx, S.seat === LM ? 'the model is sitting this one out' : 'nothing yet', mb.x, mb.y + 10, { size: 13, color: C.dim });
  // who has been winning
  const pb = pane(ctx, 644, 38, w - 652, 356, `share of the last ${WINDOW} games won`, { accent: C.orange });
  const xmax = Math.max(BATCH, Math.ceil(H.length / BATCH) * BATCH), a = axes(ctx, pb.x, pb.y, pb.w, pb.h, { xlim: [0, xmax], ylim: [0, 1], xlabel: 'games', xticks: [0, xmax / 2, xmax], yticks: [0, 0.5, 1] });
  for (const [who, col, label, k] of [['win', C.orange, 'MENACE', 0], ['loss', C.blue, 'DistilGPT-2', 1]]) {
    const pts = []; for (let e = WINDOW; e <= H.length; e++) pts.push([a.X(e), a.Y(share(H.slice(e - WINDOW, e), who) / WINDOW)]);
    if (pts.length > 1) line(ctx, pts, { color: col, lw: 2.2 });
    text(ctx, label, a.L + 8, a.T + 10 + k * 18, { size: 12, color: col });
  }
  if (H.length < WINDOW) text(ctx, `${H.length} of the first ${WINDOW} games played`, (a.L + a.R) / 2, (a.T + a.B) / 2, { size: 12, color: C.dim, align: 'center' });
  const keep = sc.lines; sc.lines = S.logs.slice(-12); sc.terminal(ctx, 8, 402, w - 16, h - 410); sc.lines = keep;
}
