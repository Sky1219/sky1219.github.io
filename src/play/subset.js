// "Teach it with 4 sentences." Twenty-four sentences about one small town, four of which become the prompt; the
// score is DistilGPT-2's perplexity on a short passage about the same town that it hasn't seen. Facility location
// (over sentence embeddings made from the model's own token embeddings) and a random draw each pick their four,
// and all three are measured. Neither of them sees the passage.
import { C, text, rect, pane, clamp, MONO } from '../screens/kit.js';
import { engine, ask, encode, EOT } from '../llm/engine.js';
import { esc } from './index.js';

export const K = 4;
// the town's four subjects, some written about far more than others (so a random draw keeps landing on the same few)
const TOPICS = [
  ['Ingrid Solberg has kept the lighthouse for thirty years.', 'The lighthouse lamp is lit by Ingrid Solberg every evening.', 'Ingrid Solberg climbs the lighthouse stairs before dusk.', 'The lighthouse stands on the rocks north of the harbor.', 'Ships watch for the lighthouse lamp in bad weather.', 'Ingrid Solberg polishes the lamp glass each morning.', 'The lighthouse was painted white again last spring.', 'At night the lamp sweeps across the dark water.', 'Visitors may climb the lighthouse on Sundays.'],
  ['Rosa Delgado owns the bakery on the corner.', 'The bakery sells cardamom buns before seven.', 'Rosa Delgado bakes cardamom buns every morning.', 'People queue outside the bakery for warm bread.', 'The cardamom buns sell out by noon.', 'The bakery smells of butter and sugar.', 'On holidays the bakery makes almond cake.'],
  ['Captain Okoro runs the ferry across the bay.', 'The ferry leaves the dock every hour.', 'Captain Okoro has never missed a crossing.', 'The ferry is painted green and yellow.', 'Passengers wave to Captain Okoro from the dock.'],
  ['A fox lives behind the church.', 'The fox slept in the garden behind the church.', 'Children leave scraps for the fox.'],
];
export const PASSAGE = 'Ingrid Solberg lit the lighthouse lamp while Rosa Delgado carried cardamom buns down to the ferry. Captain Okoro shared them with the fox behind the church.';

// the pool, shuffled once so the subjects aren't in runs
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const POOL = (() => {
  const all = TOPICS.flatMap((ss, topic) => ss.map((s) => ({ s, topic }))), r = mulberry(7);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
})();

// A sentence's embedding is the mean of its tokens' embeddings, each weighted by how rare the token is in the pool
// (idf), so "Okoro" counts for more than "the". These are the weights, per sentence, per token.
export function idfWeights(sentences) {
  const df = new Map(); for (const ids of sentences) for (const t of new Set(ids)) df.set(t, (df.get(t) || 0) + 1);
  return sentences.map((ids) => ids.map((t) => Math.log(sentences.length / df.get(t))));
}
// cosine similarity between sentence embeddings, after removing their common direction (GPT-2's embeddings all
// point much the same way), clipped at 0
export function similarity(embs) {
  const n = embs.length, D = embs[0].length, mean = new Float32Array(D);
  for (const e of embs) for (let d = 0; d < D; d++) mean[d] += e[d] / n;
  const X = embs.map((e) => { const x = new Float32Array(D); let s = 0; for (let d = 0; d < D; d++) { x[d] = e[d] - mean[d]; s += x[d] * x[d]; } s = Math.sqrt(s) || 1; for (let d = 0; d < D; d++) x[d] /= s; return x; });
  const sim = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { let d = 0; for (let e = 0; e < D; e++) d += X[i][e] * X[j][e]; sim[i][j] = sim[j][i] = Math.max(0, d); }
  return sim;
}
// facility location, f(S) = sum_i max_{j in S} sim(i, j), maximized greedily
export function facility(sim, k) {
  const n = sim.length, best = new Float32Array(n), S = [];
  for (let step = 0; step < k; step++) {
    let pick = -1, top = -1;
    for (let j = 0; j < n; j++) { if (S.includes(j)) continue; let g = 0; for (let i = 0; i < n; i++) g += Math.max(0, sim[i][j] - best[i]); if (g > top) { top = g; pick = j; } }
    S.push(pick); for (let i = 0; i < n; i++) best[i] = Math.max(best[i], sim[i][pick]);
  }
  return S;
}
export function randomPick(k, rand = Math.random) { const idx = POOL.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, k); }
// the prompt a pick makes: its sentences in pool order (the passage follows)
export const promptOf = (pick) => pick.slice().sort((a, b) => a - b).map((i) => POOL[i].s).join(' ');
export const perplexity = (lps) => Math.exp(-lps.reduce((a, b) => a + b, 0) / Math.max(1, lps.length));

// ---------- the game ----------
const WHO = ['you', 'fl', 'rnd'];
const NAME = { you: 'Your four', fl: 'Facility location', rnd: 'Random draw', none: 'No prompt' };
const COL = { you: C.orange, fl: C.cyan, rnd: C.purple, none: C.dim };
const SUBJECT = ['lighthouse', 'bakery', 'ferry', 'fox'];
const subjects = (pick) => new Set(pick.map((i) => POOL[i].topic)).size;

// facility location's pick doesn't depend on the visitor, so it's worked out once; so is any prompt already measured
let shared = null;
const measured = new Map();
function prepare() {
  if (!shared) {
    const ids = POOL.map((p) => engine.tok.encode(p.s)), W = idfWeights(ids);
    shared = Promise.all(ids.map((x, i) => ask({ type: 'embed', ids: x, weights: W[i] }).then((m) => m.mean))).then((embs) => facility(similarity(embs), K));
  }
  return shared;
}
// the passage's perplexity after this pick's prompt, token by token as the model gets there
async function measure(S, who, pick) {
  const key = pick.slice().sort((a, b) => a - b).join(','), R = (S.runs[who] = { pick, lps: [], ppl: null });
  if (!measured.has(key)) {
    const pre = pick.length ? encode(promptOf(pick)) : [EOT];
    const m = await ask({ type: 'score', ids: [...pre, ...S.passIds], from: pre.length, ticks: true }, { onTick: (t) => { R.lps[t.i] = t.lp; } });
    measured.set(key, m.lps);
  }
  R.lps = measured.get(key); R.ppl = perplexity(R.lps);
}

export function mount(root, screen) {
  const passIds = engine.tok.encode(` ${PASSAGE}`);
  const S = { on: false, draw, passIds, pieces: passIds.map((i) => engine.tok.piece(i)), mine: [], runs: {}, scored: false, logs: [] };
  screen.play = S;
  let alive = true, busy = false;
  const log = (s, c = C.ink) => S.logs.push([s, c]);
  root.innerHTML = `
    <p class="g-note">Pick the ${K} sentences that will best prepare the model for a passage about this town. It mentions everything the town is known for, and you don't get to read it first.</p>
    <div class="g-list g-pool" role="group" aria-label="Sentences">${POOL.map((p, i) => `<button type="button" class="g-item" aria-pressed="false" data-i="${i}">${esc(p.s)}</button>`).join('')}</div>
    <div class="g-row"><button type="button" class="g-btn g-score" disabled>Score my ${K}</button><button type="button" class="g-ghost g-clear">Clear</button><span class="g-count"></span></div>
    <p class="g-result" aria-live="polite"></p>`;
  const items = [...root.querySelectorAll('.g-item')], score = root.querySelector('.g-score'), count = root.querySelector('.g-count'), result = root.querySelector('.g-result');
  const render = () => {
    items.forEach((b, i) => b.setAttribute('aria-pressed', S.mine.includes(i)));
    count.textContent = `${S.mine.length} of ${K} picked`;
    score.disabled = busy || S.mine.length !== K;
  };
  items.forEach((b, i) => { b.onclick = () => {
    if (S.mine.includes(i)) S.mine = S.mine.filter((j) => j !== i); else if (S.mine.length < K) S.mine.push(i); else return;
    S.on = true; render();
  }; });
  root.querySelector('.g-clear').onclick = () => { S.mine = []; render(); };
  score.onclick = async () => {
    busy = true; S.on = true; render();
    result.textContent = 'Scoring your four, facility location’s four and a random four…';
    const fl = await prepare();
    if (!alive) return;
    S.scored = true;
    log('$ python -m subsel.eval --prompts mine,facility_location,random --heldout passage.txt', C.green);
    await Promise.all([['none', []], ['rnd', randomPick(K)], ['fl', fl], ['you', S.mine.slice()]].map(async ([who, pick]) => {
      await measure(S, who, pick);
      log(`${NAME[who].padEnd(18)} subjects ${pick.length ? subjects(pick) : '-'}   perplexity ${S.runs[who].ppl.toFixed(1)}`, COL[who]);
    }));
    if (!alive) return;
    const { you, fl: F, rnd, none } = S.runs;
    result.textContent = `Perplexity on the passage, lower is better: your four ${you.ppl.toFixed(1)}, facility location ${F.ppl.toFixed(1)}, a random four ${rnd.ppl.toFixed(1)}, no prompt ${none.ppl.toFixed(1)}. `
      + `The passage touches all ${SUBJECT.length} subjects in town; you covered ${subjects(you.pick)}, facility location ${subjects(F.pick)}, the random draw ${subjects(rnd.pick)}. `
      + (you.ppl < F.ppl ? 'You beat facility location, which never saw the passage.' : 'Facility location wins this one without ever seeing the passage: it only tries to cover the pool.');
    busy = false; render();
  };
  log('$ python -m subsel.embed --model distilgpt2 --pool town.txt', C.green);
  prepare().then((fl) => { if (alive) log(`${POOL.length} sentences embedded (idf-weighted token embeddings); facility location picked ${fl.length}`, C.dim); });
  render();
  return () => { alive = false; };
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc, show = WHO[Math.floor(sc.t / 4) % 3];
  const has = (who, i) => (who === 'you' ? S.mine.includes(i) : !!S.runs[who] && S.runs[who].pick.includes(i));
  sc.chrome(ctx, 'akash@caraml-ws3: ~/subset-select', 'live on this device');
  // the pool: in the order shown until it's scored, then a row per subject with who picked what
  const pb = pane(ctx, 8, 38, 400, 356, S.scored ? 'pool, by subject: who picked what' : `pool: ${S.mine.length} of ${K} picked`, { accent: C.blue });
  if (!S.scored) {
    const cw = pb.w / 8, ch = 64;
    POOL.forEach((_, i) => {
      const x = pb.x + (i % 8) * cw, y = pb.y + Math.floor(i / 8) * ch, on = S.mine.includes(i);
      rect(ctx, x + 2, y + 2, cw - 4, ch - 4, { fill: on ? C.orange : C.head, stroke: C.line, r: 3 });
      text(ctx, String(i + 1), x + cw / 2, y + ch / 2, { size: 12, color: on ? '#1a0b02' : C.faint, align: 'center' });
    });
    text(ctx, 'each cell is one sentence in the list', pb.x, pb.y + 3 * ch + 18, { size: 12, color: C.dim });
  } else {
    SUBJECT.forEach((name, t) => {
      const y = pb.y + 8 + t * 62;
      text(ctx, name, pb.x, y + 20, { size: 13, color: C.dim });
      POOL.map((p, i) => (p.topic === t ? i : -1)).filter((i) => i >= 0).forEach((i, k) => {
        WHO.forEach((who, b) => rect(ctx, pb.x + 90 + k * 32, y + b * 14, 28, 12, { fill: has(who, i) ? COL[who] : C.head }));
      });
    });
    WHO.forEach((who, b) => { const x = pb.x + b * 130; rect(ctx, x, pb.y + 284, 10, 10, { fill: COL[who] }); text(ctx, NAME[who], x + 16, pb.y + 290, { size: 12, color: who === show ? C.ink : C.dim }); });
  }
  // the passage, shaded by how surprised the model was at each token
  const R = S.runs[show], tb = pane(ctx, 416, 38, w - 424, 356, S.scored ? `held-out passage after: ${NAME[show].toLowerCase()}` : 'held-out passage', { accent: S.scored ? COL[show] : C.faint, right: 'red = surprised' });
  if (!S.scored) {
    text(ctx, 'held out until you score', tb.x + tb.w / 2, tb.y + 120, { size: 17, color: C.ink, align: 'center' });
    text(ctx, `${S.pieces.length} tokens about the same town`, tb.x + tb.w / 2, tb.y + 150, { size: 13, color: C.dim, align: 'center' });
  } else {
    ctx.font = `17px ${MONO}`; let x = tb.x, y = tb.y + 14;
    S.pieces.forEach((p, t) => {
      const wd = ctx.measureText(p).width; if (x + wd > tb.x + tb.w) { x = tb.x; y += 32; }
      const lp = R && R.lps[t];
      if (lp != null) rect(ctx, x, y - 13, wd, 26, { fill: `rgba(255,95,109,${clamp(-lp / 10) * 0.85})` });
      text(ctx, p, x, y, { size: 17, color: lp != null ? C.ink : C.faint }); x += wd;
    });
    if (R && R.ppl != null) text(ctx, `${NAME[show]}: perplexity ${R.ppl.toFixed(1)}`, tb.x, tb.y + tb.h - 8, { size: 14, color: COL[show] });
  }
  // the log, and the scores
  const keep = sc.lines; sc.lines = S.logs.slice(-12); sc.terminal(ctx, 8, 402, 610, h - 410); sc.lines = keep;
  const rb = pane(ctx, 626, 402, w - 634, h - 410, 'perplexity on the passage (lower is better)', { accent: C.purple });
  const top = Math.max(1, ...Object.values(S.runs).map((r) => r.ppl || 0));
  ['none', 'rnd', 'fl', 'you'].forEach((who, k) => {
    const Q = S.runs[who], y = rb.y + 12 + k * 34;
    if (who === show) rect(ctx, rb.x - 4, y - 14, rb.w + 8, 28, { fill: 'rgba(255,255,255,0.05)' });
    text(ctx, NAME[who], rb.x, y, { size: 13, color: COL[who] });
    if (!Q) { text(ctx, '…', rb.x + 150, y, { size: 13, color: C.faint }); return; }
    if (Q.ppl == null) { rect(ctx, rb.x + 150, y - 3, 160 * clamp(Q.lps.length / S.pieces.length), 6, { fill: C.blue }); return; }
    rect(ctx, rb.x + 150, y - 6, 150 * (Q.ppl / top), 12, { fill: COL[who] });
    text(ctx, Q.ppl.toFixed(1), rb.x + rb.w, y, { size: 13, color: C.ink, align: 'right' });
  });
}
