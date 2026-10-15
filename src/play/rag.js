// "Fix the model's answer with retrieval." DistilGPT-2 is asked where HackUTD is held and, on its own, gets it wrong. The visitor
// plays the retriever: one of five documents goes in front of the question, and the model's next-token
// probabilities are measured again, along with the answer it goes on to give. One document answers the question;
// two only look as if they might.
import { C, SANS, MONO, text, rect, arrow, wrap, fit } from '../screens/kit.js';
import { engine, ask, encode } from '../llm/engine.js';
import { esc, pct, piece, about, table } from './index.js';

export const QUESTION = 'In which city is HackUTD held?';
export const ASK = `Question: ${QUESTION}\nAnswer: HackUTD is held in the city of`;
export const ANSWER = ' Richardson';
export const DOCS = [
  ['workshops.md', 'The workshops at HackUTD cover retrieval, the Model Context Protocol, and agents.'],
  ['texas.md', 'Austin is the capital of Texas and home to many technology companies.'],
  ['venue.md', 'HackUTD fills the ECSW building at UT Dallas, in the city of Richardson, Texas, for a weekend.'],
  ['hackmit.md', 'HackMIT is a student hackathon held every year at MIT in Cambridge, Massachusetts.'],
  ['numbers.md', 'About 1,300 students take part in HackUTD over one weekend.'],
];
// d is the document retrieved, or -1 for none
export const promptOf = (d) => (d < 0 ? '' : `${DOCS[d][1]}\n`) + ASK;
const TOP = 5, REPLY = 8;                               // the model gets this many tokens to answer in

const measured = new Map();
function measure(d) {
  if (!measured.has(d)) {
    const want = engine.tok.encode(ANSWER);
    measured.set(d, ask({ type: 'score', ids: encode(promptOf(d)), want, topk: TOP, gen: REPLY })
      .then((m) => ({ p: m.want[0], right: m.out.includes(want[0]), says: engine.tok.decode(m.out).split('\n')[0].trim().replace(/\.$/, ''), top: m.top.map(([id, p]) => ({ id, p, s: piece(id).trim() })) })));
  }
  return measured.get(d);
}

export function mount(root, screen) {
  const S = { on: false, draw, sel: -1, res: {}, shown: [Array(TOP).fill(0), Array(TOP).fill(0)] };
  screen.play = S;
  let alive = true;
  root.innerHTML = `
    ${about('Whether the model\'s answer follows the document the retriever hands it. One of the five says where HackUTD is held, two name other places, and two are about HackUTD but say nothing about where. The measure is the probability of the right city as the next token, and what the model goes on to say.',
              'This is the first workshop: retrieval-augmented generation. A model answers from what is in its prompt, so the retriever decides whether it is right, and a good retriever matters more than a bigger model here.')}
    <p class="g-note">Asked <b>“${esc(QUESTION)}”</b>, the model on its own answers <span class="g-alone">…</span> Retrieve one document to put in front of the question.</p>
    <div class="g-list" role="radiogroup" aria-label="Documents">${DOCS.map(([name, body], i) => `<button type="button" class="g-item" role="radio" aria-checked="false" data-i="${i}"><b>${esc(name)}</b> ${esc(body)}</button>`).join('')}</div>
    <div class="g-result" aria-live="polite"></div>`;
  const items = [...root.querySelectorAll('.g-item')], alone = root.querySelector('.g-alone'), result = root.querySelector('.g-result');
  measure(-1).then((r) => { if (!alive) return; S.res[-1] = r; alone.textContent = `“${r.says}”.`; });
  items.forEach((b, i) => { b.onclick = async () => {
    S.sel = i; S.on = true; items.forEach((x, j) => x.setAttribute('aria-checked', j === i));
    result.textContent = 'Asking the model…';
    const [base, r] = await Promise.all([measure(-1), measure(i)]);
    if (!alive || S.sel !== i) return;
    S.res[i] = r;
    const tried = [-1, ...DOCS.map((_, j) => j).filter((j) => S.res[j])];
    const rows = tried.map((j) => { const q = S.res[j]; return [j < 0 ? 'nothing' : esc(DOCS[j][0]), q.right ? `<span class="g-ok">${esc(q.says)}</span>` : esc(q.says), pct(q.p)]; });
    result.innerHTML = table(['retrieved', 'answers', `P(${esc(ANSWER.trim())})`], rows, tried.indexOf(i))
      + `<p class="g-verdict">With ${esc(DOCS[i][0])} in the prompt, the model answers “${esc(r.says)}”. `
      + (r.right ? `That document has the answer, and the model reads it off: “${esc(ANSWER.trim())}” went from ${pct(base.p)} to ${pct(r.p)} as the next token.`
        : r.says !== base.says ? 'The answer changed to a different wrong city, because the model repeats whatever place the document mentions. That is what grounding on the wrong document looks like.'
          : 'The answer has not changed, because that document does not say where HackUTD is held.') + '</p>';
  }; });
  return () => { alive = false; };
}

function bars(ctx, S, row, R, x, y, w) {
  const shown = S.shown[row];
  for (let k = 0; k < TOP; k++) {
    const t = R && R.top[k], yy = y + k * 25, right = t && t.s === ANSWER.trim();
    shown[k] += ((t ? t.p : 0) - shown[k]) * 0.12;                    // bars slide to their new lengths
    rect(ctx, x + 130, yy - 9, w - 190, 18, { fill: '#121923', r: 3 });
    if (!t) continue;
    rect(ctx, x + 130, yy - 9, (w - 190) * shown[k], 18, { fill: right ? C.green : C.blue, r: 3 });
    text(ctx, `“${t.s}”`, x + 120, yy, { size: 15, color: right ? C.green : C.ink, align: 'right' });
    text(ctx, pct(t.p), x + w, yy, { size: 14, color: right ? C.green : C.dim, align: 'right' });
  }
  if (R) { ctx.font = `15px ${MONO}`; text(ctx, fit(ctx, `it answers: “${R.says}”`, w), x, y + TOP * 25 + 12, { size: 15, color: R.right ? C.green : C.red }); }
}

function draw(sc, ctx) {
  const S = sc.play, { w, h } = sc, d = S.sel, base = S.res[-1], R = S.res[d];
  text(ctx, 'Build the RAG pipeline', 40, 46, { size: 30, font: SANS, weight: '800', color: C.ink });
  text(ctx, 'You are the retriever. The model is DistilGPT-2, running on this device.', 40, 80, { size: 15, font: SANS, color: C.dim });
  rect(ctx, 40, 98, 60, 3, { fill: C.orange });
  // the prompt the model gets
  text(ctx, 'PROMPT', 40, 132, { size: 12, color: C.dim });
  rect(ctx, 40, 146, 450, 330, { fill: '#121923', stroke: C.blue, lw: 2, r: 8 });
  let y = 172;
  if (d >= 0) {
    ctx.font = `14px ${MONO}`; const rows = wrap(ctx, DOCS[d][1], 410);
    rect(ctx, 52, y - 16, 426, rows.length * 21 + 34, { fill: 'rgba(255,154,60,0.14)', stroke: C.orange, r: 6 });
    text(ctx, `retrieved: ${DOCS[d][0]}`, 62, y, { size: 12, color: C.orange });
    rows.forEach((r, i) => text(ctx, r, 62, y + 22 + i * 21, { size: 14, color: C.ink }));
    y += rows.length * 21 + 46;
  } else { text(ctx, '(nothing retrieved)', 62, y, { size: 13, color: C.faint }); y += 34; }
  ctx.font = `14px ${MONO}`;
  for (const [i, r] of wrap(ctx, `Question: ${QUESTION}`, 410).entries()) text(ctx, r, 62, y + i * 21, { size: 14, color: C.ink });
  y += 46;
  const tail = wrap(ctx, 'Answer: HackUTD is held in the city of', 410);
  tail.forEach((r, i) => { const tw = text(ctx, r, 62, y + i * 21, { size: 14, color: C.ink }); if (i === tail.length - 1 && (sc.t * 2) % 2 < 1.2) rect(ctx, 62 + tw + 8, y + i * 21 - 8, 9, 16, { fill: C.orange }); });
  arrow(ctx, 496, 310, 534, 310, { color: C.dim });
  // the next token, without and with the document
  text(ctx, 'NEXT TOKEN, MODEL ALONE', 548, 132, { size: 12, color: C.dim });
  bars(ctx, S, 0, base, 548, 158, 436);
  text(ctx, d >= 0 ? `NEXT TOKEN, WITH ${DOCS[d][0].toUpperCase()}` : 'NEXT TOKEN, WITH A DOCUMENT', 548, 332, { size: 12, color: d >= 0 ? C.orange : C.dim });
  bars(ctx, S, 1, d >= 0 ? R : null, 548, 358, 436);
  if (d < 0) text(ctx, 'pick a document to retrieve', 548 + 218, 408, { size: 14, font: SANS, color: C.dim, align: 'center' });
  else if (!R) text(ctx, 'asking the model…', 548 + 218, 408, { size: 14, font: SANS, color: C.dim, align: 'center' });
  text(ctx, R && d >= 0 ? (R.right ? 'With the right document, the answer is correct.' : 'That is the wrong document, so the answer is still wrong.') : '', 40, h - 44, { size: 18, font: SANS, weight: '700', color: R && R.right ? C.green : C.red });
  text(ctx, 'HackUTD workshop  ·  live', w - 30, h - 22, { size: 12, color: C.faint, align: 'right' });
}
