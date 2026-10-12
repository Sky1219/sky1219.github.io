// Choosing what an agent remembers: a long coding session is split into turns and the facts each carries; facts
// are weighted by relevance to the new request; a probabilistic set cover function (submodlib) scores a set of
// turns, so repeats add little; cost-sensitive greedy packs turns by gain per token under a budget; the chosen
// ones go to the model with the request. The session and scores are a made-up example; the selection is computed.
import { Screen, C, text, rect, line, pane, ease, clamp } from './kit.js';

// each turn: role, text, tokens, and how much of each fact it carries
const TURNS = [
  ['U', 'Set up a Flask app for the lab demo', 120, { app: 0.6 }],
  ['A', 'Created app.py with a /predict route ...', 410, { app: 1 }],
  ['U', 'Store the API key in .env as LAB_API_KEY', 60, { key: 1 }],
  ['A', 'Added python-dotenv; the key loads from .env', 230, { key: 0.7, dotenv: 1 }],
  ['U', 'Why is the CSS not loading?', 70, { css: 0.3 }],
  ['A', 'static/ path was wrong; fixed url_for', 260, { css: 1 }],
  ['U', 'Write a Dockerfile', 50, { docker: 0.15 }],
  ['A', 'Dockerfile: python:3.11-slim, gunicorn ...', 380, { docker: 1 }],
  ['U', 'Can you show the Dockerfile again?', 40, { docker: 0.05 }],
  ['A', 'Dockerfile: python:3.11-slim, gunicorn ...', 370, { docker: 1 }],
  ['U', 'Change the port to 8080', 40, { port: 0.8 }],
  ['A', 'Updated EXPOSE 8080 and the gunicorn bind', 150, { port: 1 }],
  ['U', 'Add a loading spinner', 50, { spinner: 0.3 }],
  ['A', 'Spinner added in index.html', 200, { spinner: 1 }],
];
// how much each fact matters to the new request (its similarity to it)
const WEIGHT = { key: 1, docker: 0.9, port: 0.7, dotenv: 0.5, app: 0.3, css: 0.05, spinner: 0.05 };
const ASK = 'Deploy it to the lab server, with the API key from before.';
const BUDGET = 900;
// f(S) is submodlib's probabilistic set cover: each fact u, weighted by how much the request needs it, counts
// as covered with probability 1 - prod_{i in S} (1 - p_iu). A turn repeating a covered fact adds (almost) nothing.
const f = (S) => Object.entries(WEIGHT).reduce((a, [k, w]) => a + w * (1 - S.reduce((q, i) => q * (1 - (TURNS[i][3][k] || 0)), 1)), 0);
const relevance = (i) => f([i]);
const marginal = (i, S) => (S.includes(i) ? 0 : f([...S, i]) - f(S));
const ORDER = []; { let used = 0;
  for (;;) {
    let b = -1, bv = 0;
    TURNS.forEach((t, i) => { if (ORDER.includes(i) || used + t[2] > BUDGET) return; const v = marginal(i, ORDER) / t[2]; if (v > bv) { bv = v; b = i; } });
    if (b < 0 || bv < 1e-4) break; ORDER.push(b); used += TURNS[b][2];
  } }
const RECENT = []; { let used = 0; for (let i = TURNS.length - 1; i >= 0; i--) { if (used + TURNS[i][2] > BUDGET) break; used += TURNS[i][2]; RECENT.push(i); } }
const tokens = (S) => S.reduce((a, i) => a + TURNS[i][2], 0);

export class MemoryScreen extends Screen {
  constructor(w, h) { super(w, h, [5.5, 6.5, 6.5, 8, 10]); this.goto(0); }
  onStep(s) {
    this.lines = [];
    const p = (x, c) => this.print(x, c);
    if (s === 0) { p('$ python select_context.py session.jsonl --budget 900', C.green); p(`parsed ${TURNS.length} turns, ${tokens(TURNS.map((_, i) => i))} tokens, ${Object.keys(WEIGHT).length} facts`); p('context window left for history: 900 tokens', C.yellow); }
    if (s === 1) { p('w = [sim(embed(fact), embed(request)) for fact in facts]', C.green); p('f = ProbabilisticSetCoverFunction(n=14, probs=P,', C.ink); p('        num_concepts=7, concept_weights=w)', C.ink); }
    if (s === 2) { p('>>> f.marginalGain({8}, 10), f.marginalGain({8}, 9)', C.green); p(`(${(marginal(9, [7]) / 1.2).toFixed(2)}, ${(marginal(8, [7]) / 1.2).toFixed(2)})`, C.yellow); }
    if (s === 3) { p('f.maximize(budget=900, optimizer="NaiveGreedy",', C.green); p('           costs=tokens, costSensitiveGreedy=True)', C.green); }
    if (s === 4) { p(`context: turns ${[...ORDER].sort((a, b) => a - b).map((i) => i + 1).join(', ')}  (${tokens(ORDER)} tokens)`, C.ink); p('$ agent.run(request, context)', C.green); }
    this.logged = 0;
  }
  get chosen() { return this.step < 3 ? [] : this.step === 3 ? ORDER.slice(0, Math.min(ORDER.length, Math.floor(this.st / 1.1))) : ORDER; }
  update() {
    if (this.step === 3) { const c = this.chosen; while (this.logged < c.length) { const i = c[this.logged++]; this.print(`+ turn ${String(i + 1).padStart(2)}  ${String(TURNS[i][2]).padStart(3)} tok  gain ${(marginal(i, c.slice(0, this.logged - 1)) / 1.2).toFixed(2)}  used ${tokens(c.slice(0, this.logged))}/${BUDGET}`); } }
  }
  draw(ctx) {
    const { w, h } = this, s = this.step, st = this.st, chosen = this.chosen;
    this.chrome(ctx, 'akash@caraml-ws3: ~/agent-memory', 'CARAML Lab');
    // the session, one row per turn
    const tb = pane(ctx, 8, 38, w - 16, 360, 'session.jsonl', { accent: C.orange, right: `new request: "${ASK}"` });
    const cols = { n: tb.x + 4, role: tb.x + 34, txt: tb.x + 70, tok: tb.x + 460, rel: tb.x + 530, mar: tb.x + 720, inc: tb.x + 880 };
    const hy = tb.y + 4;
    [['#', 'n'], ['', 'role'], ['turn', 'txt'], ['tokens', 'tok'], ['relevance', 'rel'], ['marginal', 'mar'], ['in context', 'inc']].forEach(([l, k]) => text(ctx, l, cols[k], hy, { size: 12, color: C.dim }));
    TURNS.forEach(([role, txt, tok], i) => {
      const rel = relevance(i) / 1.2, y = hy + 21 + i * 19.6, on = chosen.includes(i), isNew = s === 3 && chosen[chosen.length - 1] === i;
      if (on) rect(ctx, tb.x - 4, y - 10, tb.w + 8, 20, { fill: isNew ? 'rgba(255,154,60,0.28)' : 'rgba(255,154,60,0.12)' });
      const fade = s === 0 ? clamp(st * 4 - i * 0.25) : 1;
      text(ctx, String(i + 1), cols.n, y, { size: 13, color: C.dim, alpha: fade });
      text(ctx, role === 'U' ? 'user' : 'asst', cols.role, y, { size: 12, color: role === 'U' ? C.blue : C.purple, alpha: fade });
      text(ctx, txt, cols.txt, y, { size: 13, color: C.ink, alpha: fade });
      text(ctx, String(tok), cols.tok + 40, y, { size: 13, color: C.dim, align: 'right', alpha: fade });
      if (s >= 1) { const k = s === 1 ? ease(st * 1.4 - i * 0.12) : 1; rect(ctx, cols.rel, y - 5, 120, 10, { fill: C.line }); rect(ctx, cols.rel, y - 5, 120 * Math.min(1, rel) * k, 10, { fill: rel > 0.5 ? C.green : C.faint }); text(ctx, (rel * k).toFixed(2), cols.rel + 128, y, { size: 12, color: C.dim }); }
      if (s >= 2) {
        const S = s === 2 ? [7] : chosen, m = marginal(i, S), red = !S.includes(i) && m < rel * 0.2 && rel > 0.2;
        text(ctx, S.includes(i) ? "—" : (m / 1.2).toFixed(2), cols.mar, y, { size: 13, color: red ? C.red : C.ink });
        if (red) text(ctx, 'already covered', cols.mar + 46, y, { size: 12, color: C.red });
      }
      if (on) text(ctx, 'yes', cols.inc, y, { size: 13, color: C.orange, weight: '700' });
    });
    // the budget
    const used = tokens(chosen), by = 38 + 360 - 14;
    text(ctx, 'budget', tb.x, by, { size: 12, color: C.dim });
    rect(ctx, tb.x + 60, by - 6, 400, 12, { fill: C.line }); rect(ctx, tb.x + 60, by - 6, 400 * used / BUDGET, 12, { fill: C.orange });
    text(ctx, `${used} / ${BUDGET} tokens`, tb.x + 470, by, { size: 12, color: C.ink });
    // bottom: terminal, and the result
    this.terminal(ctx, 8, 406, 470, h - 414);
    const rb = pane(ctx, 486, 406, w - 494, h - 414, s < 4 ? 'what gets sent' : 'answer check, same 900-token budget', { accent: C.purple });
    if (s < 4) {
      const lines = ['[system] You are a coding agent ...', ...[...chosen].sort((a, b) => a - b).map((i) => `[turn ${i + 1}] ${TURNS[i][1]}`), `[request] ${ASK}`];
      lines.slice(0, 8).forEach((l, i) => text(ctx, l.length > 54 ? l.slice(0, 53) + '…' : l, rb.x, rb.y + 6 + i * 19, { size: 12, color: l.startsWith('[req') ? C.orange : l.startsWith('[sys') ? C.dim : C.ink }));
    } else {
      const k = ease(st / 2), row = (label, a, b, y) => { text(ctx, label, rb.x, y, { size: 13, color: C.ink }); text(ctx, a, rb.x + 250, y, { size: 13, color: a === 'yes' ? C.green : C.red }); text(ctx, b, rb.x + 370, y, { size: 13, color: b === 'yes' ? C.green : C.red }); };
      text(ctx, 'needs', rb.x, rb.y + 6, { size: 12, color: C.dim }); text(ctx, 'last turns', rb.x + 250, rb.y + 6, { size: 12, color: C.dim }); text(ctx, 'submodular', rb.x + 370, rb.y + 6, { size: 12, color: C.orange });
      const has = (S, i) => (S.includes(i) ? 'yes' : 'no'), hasP = (S) => (S.includes(10) || S.includes(11) ? 'yes' : 'no');
      if (k > 0.2) row('where the API key is (3)', has(RECENT, 2), has(ORDER, 2), rb.y + 32);
      const hasD = (S) => (S.includes(7) || S.includes(9) ? 'yes' : 'no');
      if (k > 0.5) row('the Dockerfile (8)', hasD(RECENT), hasD(ORDER), rb.y + 54);
      if (k > 0.8) row('port 8080 (11)', hasP(RECENT), hasP(ORDER), rb.y + 76);
      if (st > 2.5) text(ctx, 'the last-turns window spends 250 tokens on', rb.x, rb.y + 110, { size: 12, color: C.dim });
      if (st > 2.5) text(ctx, 'the spinner, and misses the API key', rb.x, rb.y + 128, { size: 12, color: C.dim });
    }
  }
}
