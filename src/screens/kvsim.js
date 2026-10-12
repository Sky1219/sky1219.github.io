// A toy KV cache: a short passage is generated token by token with a fixed cache budget, under four eviction
// policies. Attention is simulated (not a real model): each token has a topic, and a new token attends to the
// first token (an attention sink), to recent tokens, and to earlier tokens on its own topic.
export const TEXT = ('<s> The lab picks training data with facility location , a submodular score that rewards coverage . ' +
  'We tested it on vision models and on chat logs . Later , asked why the picked subset works , the model ' +
  'answers that facility location rewards coverage of the data , so small groups are not missed .').split(' ');
const TOPIC = { facility: 1, location: 1, submodular: 1, score: 1, rewards: 2, coverage: 2, subset: 3, picks: 3, picked: 3, data: 3, training: 3,
  vision: 4, models: 4, model: 4, chat: 4, logs: 4, groups: 2, missed: 2, small: 2, works: 3, lab: 5, tested: 4 };
export const topicOf = (j) => TOPIC[TEXT[j]] || 0;
export const PROMPT = 26;
export const POLICIES = [
  { id: 'stream', label: 'STREAMINGLLM', name: 'StreamingLLM', note: 'keeps the first token (an attention sink) and a window of recent ones' },
  { id: 'h2o', label: 'H2O', name: 'H2O', note: 'keeps recent tokens plus the "heavy hitters" with the most attention so far' },
  { id: 'snap', label: 'SNAPKV', name: 'SnapKV', note: 'keeps what the last few queries attended to most' },
  { id: 'sub', label: 'FACILITY LOCATION', name: 'Facility location', note: 'keeps the keys that best cover everything attended so far (attention-weighted facility location), so near-duplicates don\'t crowd it out' },
];

function attention(t) {
  const q = topicOf(t), w = [];
  for (let j = 0; j < t; j++) {
    let a = j === 0 ? 2.2 : 0.15;
    a += 1.2 * Math.exp(-(t - j) / 3);
    const k = topicOf(j);
    if (q && k === q) a += 2.6; else if (q && k && Math.abs(k - q) === 1) a += 0.5;
    w.push(a);
  }
  const s = w.reduce((x, y) => x + y, 0);
  return w.map((x) => x / s);
}
export const ATT = TEXT.map((_, t) => (t ? attention(t) : []));

// run one policy; each step records what the cache holds, what got evicted, and how much of what the new token
// attends to is still available (kept, or covered by a kept entry with the same content)
export function simulate(policy, B) {
  const kept = [], acc = new Float64Array(TEXT.length), steps = [];
  for (let t = 0; t < TEXT.length; t++) {
    if (t > 0) {
      const a = ATT[t]; for (const j of kept) acc[j] += a[j];
      const topics = new Set(kept.map(topicOf).filter(Boolean)); let seen = 0;
      for (let j = 0; j < t; j++) if (kept.includes(j) || (topicOf(j) && topics.has(topicOf(j)))) seen += a[j];
      if (t >= PROMPT) steps.push({ t, seen, kept: kept.slice(), evicted: null });
    }
    kept.push(t);
    if (kept.length > B) {
      let out;
      if (policy === 'stream') out = kept[1] ?? kept[0];                    // never the sink
      else if (policy === 'h2o') { const c = kept.slice(0, kept.length - Math.floor(B / 2)); out = c.reduce((m, j) => (acc[j] < acc[m] ? j : m), c[0]); }
      else if (policy === 'snap') {                                          // attention from the last 4 queries
        const obs = (j) => { let s = 0; for (let q = Math.max(1, t - 3); q <= t; q++) if (j < q) s += ATT[q][j]; return s; };
        const c = kept.slice(0, kept.length - Math.floor(B / 4)); out = c.reduce((m, j) => (obs(j) < obs(m) ? j : m), c[0]);
      } else {                                                                // facility location over the keys, each
        // token weighted by the attention it has received: evict the key whose loss lowers f(S) the least
        const c = kept.slice(0, kept.length - Math.floor(B / 4));
        const sim = (i, j) => (i === j ? 1 : (topicOf(i) && topicOf(i) === topicOf(j)) ? 0.85 : 0);
        const val = (S) => { let f = 0; for (let i = 0; i <= t; i++) { let m = 0; for (const j of S) m = Math.max(m, sim(i, j)); f += m * (0.3 + acc[i]); } return f; };
        let best = Infinity; const all = val(kept);
        for (const j of c) { const loss = all - val(kept.filter((x) => x !== j)) + (j === 0 ? 1 : 0); if (loss < best) { best = loss; out = j; } }
      }
      kept.splice(kept.indexOf(out), 1);
      if (steps.length) steps[steps.length - 1].evicted = out;
    }
  }
  return steps;
}
export const average = (steps) => steps.reduce((a, s) => a + s.seen, 0) / steps.length;
