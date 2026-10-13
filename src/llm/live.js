// The live KV-cache experiment: run the same text through the full cache and four eviction policies at the same
// budget, in parallel workers, on the visitor's own machine (the model itself is engine.js's). Everything the lab
// screen shows in live mode is read from `state`.
import { engine, load as loadEngine, ask, subscribe as onEngine } from './engine.js';

export const ORDER = ['full', 'stream', 'h2o', 'snap', 'fl'];
export const DEFAULT_TEXT = 'Maria Okafor ran the robotics lab at the university for twelve years. Her students built a small rover named Juniper that could map a room in under a minute. When the department moved buildings, the rover was packed into a crate and forgotten in a storage closet. Three years later, a new student found the crate, read the label, and asked who had built it. The answer, of course, was the students of Maria Okafor, and the rover was Juniper.';
const WATCH = 3;                                   // the layer whose attention the screen draws

export const state = {
  phase: 'idle', got: 0, total: 0, loadMs: 0, backend: '', model: null, budget: 24, text: DEFAULT_TEXT,
  ids: [], pieces: [], runs: {}, logs: [], listeners: new Set(),
};
const log = (s, c) => { state.logs.push([s, c]); if (state.logs.length > 80) state.logs.shift(); };
const emit = () => state.listeners.forEach((f) => f(state));

// follow the shared model as it loads (a game may have loaded it already)
let seen = 'idle';
const follow = () => {
  const { phase, got, total, loadMs, backend, model } = engine;
  Object.assign(state, { got, total, loadMs, backend, model });
  if (phase !== seen) {
    seen = phase;
    if (phase === 'loading') state.phase = 'loading';
    if (phase === 'error') { state.phase = 'error'; log(`could not load the model: ${engine.error}`, 'red'); }
    if (phase === 'ready') {
      log(`$ fetch distilgpt2 (${(model.params / 1e6).toFixed(1)}M params, int8, ${(model.bytes / 1e6).toFixed(0)} MB)`, 'green');
      log(`loaded in ${(loadMs / 1000).toFixed(1)} s, running on this device: ${backend}`, 'ink');
      if (state.phase === 'idle' || state.phase === 'loading' || state.phase === 'error') state.phase = 'ready';
    }
  }
  emit();
};
onEngine(follow); follow();
export const load = () => loadEngine();

let runId = 0;
export async function run(text = state.text, budget = state.budget) {
  if (state.phase !== 'ready' && state.phase !== 'done') return;
  const id = ++runId;
  state.text = text; state.budget = budget;
  state.ids = engine.tok.encode(text).slice(0, 320); state.pieces = state.ids.map((i) => engine.tok.piece(i));
  state.runs = Object.fromEntries(ORDER.map((p) => [p, { t: -1, lps: [], tops: [], rows: [], evicted: [], kept: [], ppl: null, ms: null, cache: 0, done: false }]));
  state.phase = 'running';
  log(`$ python -m subcache.bench --model distilgpt2 --budget ${budget} --policies ${ORDER.join(',')}`, 'green');
  log(`${state.ids.length} tokens, cache budget ${budget} entries per layer (full cache: ${state.ids.length})`, 'dim');
  emit();
  await Promise.all(ORDER.map(async (policy) => {
    const R = state.runs[policy];
    const m = await ask({ type: 'run', id, ids: state.ids, policy, budget, watch: WATCH }, {
      onTick(m) {
        if (id !== runId) return;
        R.t = m.t; R.lps[m.t] = m.lp; R.tops[m.t] = m.top; R.kept = m.kept; R.cache = m.cache;
        if (m.seen) R.rows[m.t] = m.seen; for (const e of m.evicted) R.evicted.push([m.t, e]);
        emit();
      },
    });
    if (id !== runId) return;
    Object.assign(R, { ppl: m.ppl, ms: m.ms, cache: m.cache, done: true });
    log(`${policy.padEnd(7)} ppl ${m.ppl.toFixed(2)}   ${m.ms.toFixed(0)} ms/token   KV ${(m.cache / 1024).toFixed(0)} KB`, policy === 'fl' ? 'orange' : 'ink');
    emit();
  }));
  if (id !== runId) return;
  state.phase = 'done'; emit();
}

export const subscribe = (f) => { state.listeners.add(f); return () => state.listeners.delete(f); };
