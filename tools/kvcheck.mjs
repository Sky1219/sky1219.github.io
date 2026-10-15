// Runs the KV-cache game's story through the in-browser model in Node, to check the numbers the game reports:
//   node tools/kvcheck.mjs
// Prints, per policy, the probability of each name when the ending reaches it and the ending's perplexity.
import { readFileSync } from 'node:fs';
import { makeTokenizer } from '../src/llm/tokenizer.js';
import { handle } from '../src/llm/worker.js';
import { STORY, ENDING as GAME_ENDING, NAMES, BUDGET, spans as spansIn } from '../src/play/kv.js';

const man = JSON.parse(readFileSync('public/model/manifest.json', 'utf8'));
const buf = new Uint8Array(man.bytes); let o = 0;
for (const c of man.chunks) { const b = readFileSync(`public/model/${c}`); buf.set(b, o); o += b.length; }
const tok = makeTokenizer(JSON.parse(readFileSync('public/model/vocab.json', 'utf8')), readFileSync('public/model/merges.txt', 'utf8'));
await handle({ type: 'init', manifest: man, buf: buf.buffer }, () => {});

const ENDING = process.env.ENDING || GAME_ENDING;                    // ENDING=... to try another one
const ids = [50256, ...tok.encode(STORY + ENDING)], endAt = 1 + tok.encode(STORY).length;
console.log(ids.length, 'tokens; ending starts at', endAt, ids.slice(endAt).map((i) => JSON.stringify(tok.piece(i))).join(' '));
const spans = (name) => spansIn(tok, ids, name);
for (const n of NAMES) console.log(n, spans(n));
const keep = process.argv.slice(2).map(Number).filter((x) => !Number.isNaN(x));
for (const policy of ['full', 'stream', 'h2o', 'snap', 'fl', 'pin']) {
  const lps = [];
  await handle({ type: 'run', id: 1, ids, policy, budget: +(process.env.BUDGET || BUDGET), keep }, (m) => { if (m.type === 'tick') lps[m.t] = m.lp; });
  const end = lps.slice(endAt - 1, ids.length - 1), ppl = Math.exp(-end.reduce((a, b) => a + b, 0) / end.length);
  const p = NAMES.map((n) => { const [i, k] = spans(n).find(([i]) => i >= endAt); return Math.exp(lps.slice(i - 1, i - 1 + k).reduce((a, b) => a + b, 0)); });
  console.log(policy.padEnd(7), 'P(Okafor)', p[0].toFixed(4), 'P(Juniper)', p[1].toFixed(4), 'ending ppl', ppl.toFixed(1), ids.slice(endAt).map((t, k) => `${tok.piece(t)}:${(100 * Math.exp(lps[endAt + k - 1])).toFixed(0)}`).join(' '));
}
