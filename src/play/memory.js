// "Pack the context." A conversation ends with a question whose answer was given in its first turn. The visitor
// drags turns into a fixed token budget; the score is the probability DistilGPT-2 gives the right answer as its
// next token. A recency-only pick and a probabilistic-set-cover pick (cost-sensitive greedy) are measured too.
import { C, text, rect, pane, clamp, fit, MONO } from '../screens/kit.js';
import { engine, ask, encode } from '../llm/engine.js';
import { esc, pct, piece } from './index.js';

export const TURNS = [
  ['User', 'My dog is named Pepper and she hates long drives.'],
  ['Assistant', 'Noted, I will keep the drives short.'],
  ['User', 'My sister is joining us on Saturday.'],
  ['Assistant', 'Great, I will plan for three people.'],
  ['User', 'We need a cabin near the lake, under two hundred dollars a night.'],
  ['Assistant', 'Cedar Point has a cabin for one eighty with a fenced yard.'],
  ['User', 'Book it. Also find a diner that opens early.'],
  ['Assistant', 'The Blue Heron Diner opens at six.'],
  ['User', "Remind me to pack the dog's leash and water bowl."],
  ['Assistant', 'Added the leash and the water bowl to the list.'],
  ['User', "My neighbor's cat Atlas is staying home this time."],
  ['Assistant', 'Understood, nothing to pack for Atlas.'],
].map(([who, say]) => ({ who, say, line: `${who}: ${say}\n` }));
export const QUESTION = "What is my dog's name?";
export const ASK = `User: ${QUESTION}\nAssistant: Your dog's name is`;
export const ANSWER = ' Pepper';
export const BUDGET = 48;

// what goes to the model: the chosen turns in the order they were said, then the question
export const contextOf = (pick) => pick.slice().sort((a, b) => a - b).map((i) => TURNS[i].line).join('') + ASK;

// recency only: the latest turns that fit
export function recency(cost, budget = BUDGET) {
  const S = []; let left = budget;
  for (let i = TURNS.length - 1; i >= 0 && cost[i] <= left; i--) { S.push(i); left -= cost[i]; }
  return S;
}

// Probabilistic set cover. The concepts are the words of the conversation; a concept weighs what the question
// needs of it (1 if the question uses it, 0 if not); a turn that says a concept covers it with probability P. Then
//   f(S) = sum_c w_c (1 - prod_{i in S} (1 - p_ic)),
// packed greedily by gain per token until nothing that fits adds anything.
const STOP = new Set('a an the is are was am my me i you your we us it and but or to of in on at for with that this what will has have had be'.split(' '));
export const concepts = (s) => new Set((s.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/(ed|es|s|d|e)$/, '')));
const P = 0.8;
export function setCover(cost, budget = BUDGET) {
  const asked = concepts(QUESTION), has = TURNS.map((t) => concepts(t.say));
  const miss = new Map(); for (const h of has) for (const c of h) miss.set(c, 1);         // prod (1 - p_ic) so far
  const gain = (i) => { let g = 0; for (const c of has[i]) if (asked.has(c)) g += miss.get(c) * P; return g; };
  const S = [], gains = []; let left = budget;
  for (;;) {
    let pick = -1, top = 0;
    TURNS.forEach((_, i) => { if (S.includes(i) || cost[i] > left) return; const r = gain(i) / cost[i]; if (r > top) { top = r; pick = i; } });
    if (pick < 0) break;
    gains.push(gain(pick)); S.push(pick); left -= cost[pick];
    for (const c of has[pick]) miss.set(c, miss.get(c) * (1 - P));
  }
  return { pick: S, gains };
}

// ---------- the game ----------
const WHO = ['you', 'recent', 'cover'];
const NAME = { you: 'Your context', recent: 'Recency only', cover: 'Set cover' };
const COL = { you: C.orange, recent: C.purple, cover: C.cyan };

// what the model does with a context: the probability of the right answer, and what it would rather say
const measured = new Map();
function measure(pick) {
  const key = pick.slice().sort((a, b) => a - b).join(',');
  if (!measured.has(key)) {
    measured.set(key, ask({ type: 'score', ids: encode(contextOf(pick)), want: engine.tok.encode(ANSWER), topk: 3 }, { key: 'memory' })
      .then((m) => ({ pick, p: m.want[0], says: piece(m.top[0][0]).trim(), saysP: m.top[0][1] })));
  }
  return measured.get(key);
}

export function mount(root, screen) {
  const cost = TURNS.map((t) => engine.tok.encode(t.line).length), used = (pick) => pick.reduce((a, i) => a + cost[i], 0);
  const S = { on: false, draw, cost, used, mine: [], res: {}, logs: [] };
  screen.play = S;
  let alive = true, seq = 0, warn = '';
  const log = (s, c = C.ink) => S.logs.push([s, c]);
  root.innerHTML = `
    <p class="g-note">The conversation ends with <b>“${esc(QUESTION)}”</b> The model can only answer if the turn with the answer is in its context, and only ${BUDGET} tokens fit (a token is roughly a word). Drag or click turns into the context. The score is the probability that the model gives the right answer. It is compared with keeping only the latest turns, and with set cover, which picks the turns most relevant to the question.</p>
    <p class="g-label">Conversation</p>
    <ol class="g-list g-out" aria-label="Conversation"></ol>
    <p class="g-label">Context sent to the model <span class="g-count"></span></p>
    <div class="g-meter"><i></i></div>
    <ol class="g-list g-in" aria-label="Context sent to the model"></ol>
    <p class="g-result" aria-live="polite"></p>`;
  const lists = { out: root.querySelector('.g-out'), in: root.querySelector('.g-in') }, count = root.querySelector('.g-count'), meter = root.querySelector('.g-meter i'), result = root.querySelector('.g-result');
  const say = (r) => `“${ANSWER.trim()}” at ${pct(r.p)}${r.says === ANSWER.trim() ? '' : `, and it would rather say “${r.says}”`}`;
  const render = () => {
    const item = (i) => `<li class="g-item g-turn" draggable="true" role="button" tabindex="0" data-i="${i}"><b>${TURNS[i].who}</b> ${esc(TURNS[i].say)}<span class="g-cost">${cost[i]}</span></li>`;
    const mine = S.mine.slice().sort((a, b) => a - b);
    lists.out.innerHTML = TURNS.map((_, i) => (S.mine.includes(i) ? '' : item(i))).join('');
    lists.in.innerHTML = mine.map(item).join('') || '<li class="g-empty">Drop turns here</li>';
    count.textContent = `${used(S.mine)} of ${BUDGET} tokens`;
    meter.style.width = `${(used(S.mine) / BUDGET) * 100}%`;
    const { you, recent, cover } = S.res;
    result.textContent = warn || [you && `Your context: ${say(you)}.`, recent && `Recency only: ${say(recent)}.`, cover && `Set cover: ${say(cover)}.`].filter(Boolean).join(' ');
  };
  // move a turn into the context (if it fits) or back out, then ask the model again
  const move = async (i, into = !S.mine.includes(i)) => {
    if (into === S.mine.includes(i)) return;
    const left = BUDGET - used(S.mine);
    if (into && cost[i] > left) { warn = `That turn costs ${cost[i]} tokens and only ${left} are left. Take something out first.`; render(); return; }
    warn = ''; S.mine = into ? [...S.mine, i] : S.mine.filter((j) => j !== i); S.on = true;
    const id = ++seq, pick = S.mine.slice(); S.res.you = null; render();
    const r = await measure(pick);
    if (!alive || id !== seq) return;
    S.res.you = r; log(`mine        ${String(used(pick)).padStart(2)} tokens   P(" ${ANSWER.trim()}") ${pct(r.p).padStart(5)}   says "${r.says}"`, COL.you);
    render();
  };
  const turnOf = (e) => { const li = e.target.closest('.g-turn'); return li ? +li.dataset.i : -1; };
  root.addEventListener('click', (e) => { const i = turnOf(e); if (i >= 0) move(i); });
  root.addEventListener('keydown', (e) => { const i = turnOf(e); if (i >= 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); move(i); } });
  root.addEventListener('dragstart', (e) => { const i = turnOf(e); if (i >= 0) { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; } });
  for (const [name, list] of Object.entries(lists)) {
    list.addEventListener('dragover', (e) => { e.preventDefault(); list.classList.add('over'); });
    list.addEventListener('dragleave', () => list.classList.remove('over'));
    list.addEventListener('drop', (e) => { e.preventDefault(); list.classList.remove('over'); const i = parseInt(e.dataTransfer.getData('text/plain'), 10); if (i >= 0 && i < TURNS.length) move(i, name === 'in'); });
  }
  // the two baselines pick once
  log(`$ python -m agentmem.pack --budget ${BUDGET} --policies recency,set_cover`, C.green);
  for (const [who, pick] of [['recent', recency(cost)], ['cover', setCover(cost).pick]]) {
    measure(pick).then((r) => {
      if (!alive) return;
      S.res[who] = r; log(`${who === 'recent' ? 'recency  ' : 'set cover'}   ${String(used(pick)).padStart(2)} tokens   P(" ${ANSWER.trim()}") ${pct(r.p).padStart(5)}   says "${r.says}"`, COL[who]);
      render();
    });
  }
  render();
  return () => { alive = false; };
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc;
  const picks = { you: S.mine, recent: S.res.recent ? S.res.recent.pick : [], cover: S.res.cover ? S.res.cover.pick : [] };
  sc.chrome(ctx, 'akash@caraml-ws3: ~/agent-memory', 'live on this device');
  // the conversation, and which turns each strategy sends back
  const tb = pane(ctx, 8, 38, 640, 356, `conversation: ${TURNS.length} turns, ${S.used(TURNS.map((_, i) => i))} tokens`, { accent: C.blue, right: `budget ${BUDGET} tokens` });
  text(ctx, 'tok', tb.x + 500, tb.y + 2, { size: 11, color: C.dim, align: 'right' });
  WHO.forEach((who, k) => text(ctx, { you: 'you', recent: 'recent', cover: 'cover' }[who], tb.x + 536 + k * 38, tb.y + 2, { size: 11, color: COL[who], align: 'center' }));
  TURNS.forEach((t, i) => {
    const y = tb.y + 24 + i * 23, any = WHO.some((who) => picks[who].includes(i));
    if (i % 2) rect(ctx, tb.x - 4, y - 11, tb.w + 8, 22, { fill: 'rgba(255,255,255,0.02)' });
    text(ctx, t.who === 'User' ? 'U' : 'A', tb.x, y, { size: 13, color: t.who === 'User' ? C.green : C.dim });
    ctx.font = `13px ${MONO}`; text(ctx, fit(ctx, t.say, 440), tb.x + 22, y, { size: 13, color: any ? C.ink : C.dim });
    text(ctx, String(S.cost[i]), tb.x + 500, y, { size: 12, color: C.dim, align: 'right' });
    WHO.forEach((who, k) => rect(ctx, tb.x + 530 + k * 38, y - 6, 12, 12, picks[who].includes(i) ? { fill: COL[who] } : { stroke: C.line }));
  });
  text(ctx, `U ${QUESTION}`, tb.x, tb.y + tb.h - 22, { size: 13, color: C.yellow });
  text(ctx, 'A Your dog’s name is ▮', tb.x, tb.y + tb.h - 2, { size: 13, color: C.yellow });
  // what the model then makes of the question
  const rb = pane(ctx, 656, 38, w - 664, 356, `P(“${ANSWER.trim()}”) as the next token`, { accent: C.orange });
  WHO.forEach((who, k) => {
    const R = S.res[who], y = rb.y + 8 + k * 104;
    text(ctx, NAME[who], rb.x, y, { size: 14, color: COL[who] });
    text(ctx, `${S.used(picks[who])} / ${BUDGET} tok`, rb.x + rb.w, y, { size: 12, color: C.dim, align: 'right' });
    rect(ctx, rb.x, y + 16, rb.w, 16, { fill: C.head });
    if (!R) { text(ctx, who === 'you' && !S.mine.length ? 'nothing in the context yet' : 'asking the model…', rb.x, y + 50, { size: 12, color: C.dim }); return; }
    rect(ctx, rb.x, y + 16, rb.w * clamp(R.p), 16, { fill: COL[who] });
    text(ctx, pct(R.p), rb.x, y + 50, { size: 16, color: C.ink, weight: '700' });
    text(ctx, `says “${R.says}” (${pct(R.saysP)})`, rb.x + rb.w, y + 50, { size: 12, color: R.says === ANSWER.trim() ? C.green : C.red, align: 'right' });
  });
  const keep = sc.lines; sc.lines = S.logs.slice(-12); sc.terminal(ctx, 8, 402, w - 16, h - 410); sc.lines = keep;
}
