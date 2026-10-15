// "Finish the story with 32 slots of memory." DistilGPT-2 reads a short story through a KV cache that holds only
// BUDGET entries per layer, so once it's full every new token pushes one out. The visitor pins up to PINS tokens
// that must stay; the other slots roll with the newest tokens. The story ends on two names from its start, and
// the score is how likely the model found each name when it came, next to the real eviction policies at the same
// budget (src/llm/policies.js) and the full cache.
import { C, text, rect, pane, clamp, MONO, SANS } from '../screens/kit.js';
import { engine, ask, encode } from '../llm/engine.js';
import { POLICY_NAMES } from '../llm/policies.js';
import { esc, pct, about, table } from './index.js';

export const STORY = 'Maria Okafor ran the robotics lab for twelve years. Her students built a small rover named Juniper that could map a room in under a minute. When the department moved buildings, the rover was packed into a crate and forgotten in a closet. Three years later, a new student found the crate and asked who had built it.';
export const ENDING = ' The answer was the students of Maria Okafor, and the small rover named Juniper.';
export const NAMES = [' Okafor', ' Juniper'];
const NM = NAMES.map((n) => n.trim());
export const BUDGET = 32, PINS = 8;
const WHO = ['you', 'stream', 'h2o', 'snap', 'fl', 'full'];
const NAME = { ...POLICY_NAMES, you: 'Your pins' };
const NOTE = { stream: 'keeps the first 4 tokens and the newest 28', h2o: 'keeps the newest 16 and, of the rest, the 16 most attended so far', snap: 'keeps the newest 8 and, of the rest, what the last few tokens attended to', fl: 'keeps the start, the newest 4, and the keys that best cover what has been attended to, so near-duplicates go first', full: 'keeps everything' };
const COL = { you: C.orange, stream: C.purple, h2o: C.blue, snap: C.pink, fl: C.cyan, full: C.dim };

// where a name falls in the token ids: every occurrence, as [first index, length] (tools/kvcheck.mjs uses it too)
export function spans(tok, ids, name) {
  const t = tok.encode(name), out = [];
  for (let i = 0; i + t.length <= ids.length; i++) if (t.every((x, k) => ids[i + k] === x)) out.push([i, t.length]);
  return out;
}

// one policy's run: per-token log-probabilities, which positions were still cached when the ending began,
// and from those the probability of each name and the perplexity of the ending
const measured = new Map();
function measure(S, who, keep = []) {
  const key = who === 'you' ? `you:${keep.join(',')}` : who;
  if (!measured.has(key)) {
    const lps = [], R = (S.runs[who] = { lps, t: -1, atEnd: null, done: false });
    measured.set(key, ask({ type: 'run', ids: S.ids, policy: who === 'you' ? 'pin' : who, budget: BUDGET, keep }, {
      onTick: (m) => { lps[m.t] = m.lp; R.t = m.t; if (m.t === S.endAt - 1) R.atEnd = m.kept; },
    }).then(() => {
      const end = lps.slice(S.endAt - 1, S.ids.length - 1);
      return { lps, atEnd: new Set(R.atEnd), ppl: Math.exp(-end.reduce((a, b) => a + b, 0) / end.length),
        p: S.names.map(([i, n]) => Math.exp(lps.slice(i - 1, i - 1 + n).reduce((a, b) => a + b, 0))) };
    }));
  }
  return measured.get(key).then((r) => { S.runs[who] = { ...r, t: S.ids.length, done: true }; return r; });
}

export function mount(root, screen) {
  const ids = encode(STORY + ENDING), endAt = encode(STORY).length;
  const at = NAMES.map((n) => spans(engine.tok, ids, n)), names = at.map((o) => o.find(([i]) => i >= endAt)), early = at.map((o) => o.find(([i]) => i < endAt));
  const S = { on: false, draw, ids, pieces: ids.map((i) => engine.tok.piece(i)), endAt, names, early, pins: new Set(), runs: {}, logs: [], layout: null };
  // the story's words, each the token positions it is made of: pinning a word pins all of them
  const words = []; for (let t = 1; t < endAt; t++) { const p = S.pieces[t]; if (/^\s/.test(p) || !words.length) words.push({ text: p.trim(), at: [t] }); else { words[words.length - 1].text += p; words[words.length - 1].at.push(t); } }
  screen.play = S;
  let alive = true, busy = false;
  const log = (s, c = C.ink) => S.logs.push([s, c]);
  const logRow = (who, r) => log(`${NAME[who].padEnd(17)} P(${NM[0]}) ${pct(r.p[0]).padStart(5)}   P(${NM[1]}) ${pct(r.p[1]).padStart(5)}   ending ppl ${r.ppl.toFixed(1)}`, COL[who]);
  root.innerHTML = `
    ${about(`Whether a model reading with only ${BUDGET} slots of memory can still finish a story that ends on two names from its start. You pin up to ${PINS} tokens the cache must keep; the other slots roll with the newest tokens. The score is the probability the model gave each name when it came, and its perplexity on the last sentence, next to four real eviction policies and the full cache at the same budget.`,
      'At long contexts the KV cache, not the weights, is what fills GPU memory. SubCache measures this exact trade on real models: keep a quarter of the cache and see how much quality goes. A policy that keeps the right entries is the difference between 3× the requests on one GPU and a model that forgets who built the rover.')}
    <p class="g-label">The story <span class="g-count"></span></p>
    <div class="g-tokens" role="group" aria-label="Story words">${words.map((w, k) => `<button type="button" class="g-tok" aria-pressed="false" data-w="${k}">${esc(w.text)}</button>`).join('')}</div>
    <p class="g-label">The ending it has to predict</p>
    <p class="g-ending">${S.pieces.slice(endAt).map((p, k) => (names.some(([i, n]) => endAt + k >= i && endAt + k < i + n) ? `<b>${esc(p)}</b>` : esc(p))).join('')}</p>
    <div class="g-row"><button type="button" class="g-btn g-go" disabled>Run with my pins</button><button type="button" class="g-ghost g-clear">Clear</button></div>
    <div class="g-result" aria-live="polite"></div>`;
  const toks = [...root.querySelectorAll('.g-tok')], go = root.querySelector('.g-go'), count = root.querySelector('.g-count'), result = root.querySelector('.g-result');
  const render = () => {
    toks.forEach((b) => b.setAttribute('aria-pressed', words[+b.dataset.w].at.every((t) => S.pins.has(t))));
    count.textContent = `${S.pins.size} of ${PINS} slots pinned; 1 holds the start token, ${BUDGET - 1 - S.pins.size} roll with the newest tokens`;
    go.disabled = busy || !S.pins.size;
    const rows = WHO.filter((w) => S.runs[w] && S.runs[w].done), best = rows.reduce((b, w, i) => (b < 0 || S.runs[w].ppl < S.runs[rows[b]].ppl ? i : b), -1);
    if (!rows.length) return;
    // which of the names from the start a run still had cached when the ending began
    const held = (w, none) => { const h = NM.filter((_, k) => { const [i, n] = early[k]; for (let j = i; j < i + n; j++) if (S.runs[w].atEnd.has(j)) return true; return false; }); return h.length ? h.join(' and ') : none; };
    result.innerHTML = table(['', `P(${NM[0]})`, `P(${NM[1]})`, 'ppl'], rows.map((w) => [NAME[w], pct(S.runs[w].p[0]), pct(S.runs[w].p[1]), S.runs[w].ppl.toFixed(1)]), best)
      + `<p class="g-verdict">${rows.includes('you') ? `When the ending began, your cache still held ${held('you', 'neither name')} from the start. ` : ''}`
      + rows.filter((w) => w !== 'you' && w !== 'full').map((w) => `${NAME[w]} held ${held(w, 'neither')}`).join('; ')
      + (rows.length > 1 ? `. Lower perplexity is better; the full cache is the ceiling, with ${S.ids.length} slots instead of ${BUDGET}.` : '.') + '</p>';
  };
  toks.forEach((b) => { b.onclick = () => {
    const w = words[+b.dataset.w].at;
    if (w.every((t) => S.pins.has(t))) w.forEach((t) => S.pins.delete(t));
    else if (S.pins.size + w.filter((t) => !S.pins.has(t)).length <= PINS) w.forEach((t) => S.pins.add(t));
    else return;
    S.on = true; render();
  }; });
  root.querySelector('.g-clear').onclick = () => { S.pins.clear(); render(); };
  go.onclick = async () => {
    busy = true; S.on = true; render();
    const keep = [...S.pins].sort((a, b) => a - b);
    log(`$ python -m subcache.run --budget ${BUDGET} --policy pin --keep ${keep.join(',')}`, C.green);
    const r = await measure(S, 'you', keep);
    if (!alive) return;
    logRow('you', r);
    busy = false; render();
  };
  // the baselines run once, when the game opens
  log(`$ python -m subcache.bench --budget ${BUDGET} --policies streamingllm,h2o,snapkv,facility_location,full`, C.green);
  for (const w of WHO.slice(1)) measure(S, w).then((r) => { if (!alive) return; logRow(w, r); render(); });
  render();
  return () => { alive = false; };
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc;
  const done = WHO.filter((x) => S.runs[x] && S.runs[x].done), show = done.length ? done[Math.floor(sc.t / 4) % done.length] : 'you', R = S.runs[show];
  sc.chrome(ctx, 'akash@caraml-ws3: ~/SubCache', 'live on this device');
  // the story as the cache saw it: what was still held when the ending began, then the ending shaded by surprise
  const tb = pane(ctx, 8, 38, 640, 356, `${BUDGET}-slot cache: ${NAME[show].toLowerCase()}`, { accent: COL[show], right: R && R.done ? 'blue = cached at the ending' : S.pins.size ? 'orange = pinned' : '' });
  ctx.font = `15px ${MONO}`;
  // where each token sits never changes, so it is laid out once: [x, y, width, is it one of the names]
  if (!S.layout) {
    let x = tb.x, y = tb.y + 14;
    S.layout = S.pieces.map((p, t) => {
      const wd = ctx.measureText(p).width; if (t && x + wd > tb.x + tb.w) { x = tb.x; y += 26; }
      const box = [x, y, wd, (t >= S.endAt ? S.names : S.early).some(([i, n]) => t >= i && t < i + n)]; if (t) x += wd; return box;
    });
  }
  S.pieces.forEach((p, t) => {
    if (!t) return;
    const [x, y, wd, isName] = S.layout[t], inEnd = t >= S.endAt, cached = R && R.done && R.atEnd.has(t), pinned = show === 'you' && S.pins.has(t);
    if (inEnd) { const lp = R && R.done ? R.lps[t - 1] : null; if (lp != null) rect(ctx, x, y - 12, wd, 24, { fill: `rgba(255,95,109,${clamp(-lp / 8) * 0.85})` }); if (isName) rect(ctx, x, y - 12, wd, 24, { stroke: C.yellow, lw: 1 }); }
    else if (cached) rect(ctx, x, y - 12, wd, 24, { fill: 'rgba(90,169,255,0.28)' });
    if (pinned) rect(ctx, x, y + 11, wd, 2, { fill: C.orange });
    text(ctx, p, x, y, { size: 15, color: inEnd ? C.ink : cached || !R || !R.done ? C.ink : C.faint });
  });
  if (R && !R.done) text(ctx, `reading token ${Math.max(0, R.t)} of ${S.ids.length}…`, tb.x, tb.y + tb.h - 8, { size: 12, color: C.dim });
  else if (R && R.done) text(ctx, `${NAME[show]}: P(${NM[0]}) ${pct(R.p[0])}, P(${NM[1]}) ${pct(R.p[1])}, ending perplexity ${R.ppl.toFixed(1)}`, tb.x, tb.y + tb.h - 8, { size: 13, color: COL[show] });
  else text(ctx, S.pins.size ? `pinned: ${S.pins.size} of ${PINS}` : 'pin the tokens it should not forget', tb.x, tb.y + tb.h - 8, { size: 12, color: C.dim });
  // each name's probability when it came up, per policy
  const rb = pane(ctx, 656, 38, w - 664, 356, 'P(name) when it came up', { accent: C.orange });
  WHO.forEach((who, k) => {
    const Q = S.runs[who], y = rb.y + 8 + k * 54;
    text(ctx, NAME[who], rb.x, y, { size: 12, color: COL[who] === C.dim ? C.ink : COL[who] });
    NM.forEach((n, j) => {
      const yy = y + 14 + j * 14;
      rect(ctx, rb.x + 70, yy, rb.w - 120, 10, { fill: C.head });
      if (Q && Q.done) { rect(ctx, rb.x + 70, yy, (rb.w - 120) * clamp(Q.p[j]), 10, { fill: COL[who] }); text(ctx, pct(Q.p[j]), rb.x + rb.w, yy + 5, { size: 11, color: C.dim, align: 'right' }); }
      else text(ctx, Q ? '…' : who === 'you' ? 'run' : '', rb.x + rb.w, yy + 5, { size: 11, color: C.faint, align: 'right' });
      text(ctx, n, rb.x, yy + 5, { size: 10, color: C.dim });
    });
  });
  const keep = sc.lines; sc.lines = S.logs.slice(-12); sc.terminal(ctx, 8, 402, 640, h - 410); sc.lines = keep;
  const pb = pane(ctx, 656, 402, w - 664, h - 410, 'what each policy keeps', { accent: C.purple });
  ctx.font = `12px ${SANS}`;
  text(ctx, NOTE[show] || `the start token, your ${S.pins.size} pins, then the newest ${BUDGET - 1 - S.pins.size}`, pb.x, pb.y + 8, { size: 12, font: SANS, color: C.ink });
  text(ctx, `every policy gets the same ${BUDGET} slots per layer; the story is ${S.ids.length} tokens`, pb.x, pb.y + 30, { size: 11, font: SANS, color: C.dim });
}
