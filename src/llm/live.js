// The live KV-cache experiment: download DistilGPT-2 once, then run the same text through the full cache and
// four eviction policies at the same budget, in parallel workers, on the visitor's own machine. Everything the
// lab screen shows in live mode is read from `state`.
import { makeTokenizer } from './tokenizer.js';

export const ORDER = ['full', 'stream', 'h2o', 'snap', 'fl'];
export const DEFAULT_TEXT = 'Maria Okafor ran the robotics lab at the university for twelve years. Her students built a small rover named Juniper that could map a room in under a minute. When the department moved buildings, the rover was packed into a crate and forgotten in a storage closet. Three years later, a new student found the crate, read the label, and asked who had built it. The answer, of course, was the students of Maria Okafor, and the rover was Juniper.';
const WATCH = 3;                                   // the layer whose attention the screen draws

export const state = {
  phase: 'idle', got: 0, total: 0, loadMs: 0, backend: '', model: null, budget: 24, text: DEFAULT_TEXT,
  ids: [], pieces: [], runs: {}, logs: [], listeners: new Set(),
};
const log = (s, c) => { state.logs.push([s, c]); if (state.logs.length > 80) state.logs.shift(); };
const emit = () => state.listeners.forEach((f) => f(state));

let tok = null, workers = [], loading = null;
const base = new URL('../model/', import.meta.url);      // this file is built into js/, the model sits in model/
const CHUNK = 14 * 1024 * 1024;                         // tools/pack_gpt2.py's chunk size
let inlineModel = null;

export function load() {
  if (loading) return loading;
  loading = (async () => {
    state.phase = 'loading'; emit();
    const t0 = performance.now(), man = await (await fetch(new URL('manifest.json', base))).json();
    state.model = man; state.total = man.bytes;
    log(`$ fetch distilgpt2 (${(man.params / 1e6).toFixed(1)}M params, int8, ${(man.bytes / 1e6).toFixed(0)} MB)`, 'green');
    const buf = new Uint8Array(man.bytes);
    // chunks in parallel; each lands at its own offset
    await Promise.all(man.chunks.map(async (c, i) => {
      const o = i * CHUNK;
      const res = await fetch(new URL(c, base)); const reader = res.body.getReader(); let p = o;
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf.set(value, p); p += value.length; state.got += value.length; emit(); }
    }));
    const [vocab, merges] = await Promise.all([fetch(new URL('vocab.json', base)).then((r) => r.json()), fetch(new URL('merges.txt', base)).then((r) => r.text())]);
    tok = makeTokenizer(vocab, merges);
    // one worker per core we can spare (and memory we can spare: each holds its own copy of the weights)
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    const n = Math.max(1, Math.min(5, cores - 1, Math.floor(mem / 2)));
    try {
      workers = await Promise.all(Array.from({ length: n }, () => new Promise((ok, bad) => {
        const w = new Worker(new URL('./llm-worker.js', import.meta.url));
        w.onerror = (e) => bad(e); w.onmessage = (e) => { if (e.data.type === 'ready') { w.onmessage = null; ok(w); } };
        const copy = buf.buffer.slice(0); w.postMessage({ type: 'init', manifest: man, buf: copy }, [copy]);
      })));
      state.backend = `${n} worker${n > 1 ? 's' : ''}`;
    } catch {
      // no workers here: run in the page, a token at a time
      const { loadModel } = await import('./gpt2.js');
      inlineModel = loadModel(man, buf.buffer);
      workers = [{ inline: true }]; state.backend = 'main thread';
    }
    state.loadMs = performance.now() - t0;
    log(`loaded in ${(state.loadMs / 1000).toFixed(1)} s, running on this device: ${state.backend}`, 'ink');
    state.phase = 'ready'; emit();
  })().catch((e) => { state.phase = 'error'; log(`could not load the model: ${e.message}`, 'red'); loading = null; emit(); });
  return loading;
}

let runId = 0;
export async function run(text = state.text, budget = state.budget) {
  if (state.phase !== 'ready' && state.phase !== 'done') return;
  const id = ++runId;
  state.text = text; state.budget = budget;
  state.ids = tok.encode(text).slice(0, 320); state.pieces = state.ids.map((i) => tok.piece(i));
  state.runs = Object.fromEntries(ORDER.map((p) => [p, { t: -1, lps: [], tops: [], rows: [], evicted: [], kept: [], ppl: null, ms: null, cache: 0, done: false }]));
  state.phase = 'running';
  log(`$ python -m subcache.bench --model distilgpt2 --budget ${budget} --policies ${ORDER.join(',')}`, 'green');
  log(`${state.ids.length} tokens, cache budget ${budget} entries per layer (full cache: ${state.ids.length})`, 'dim');
  emit();
  const queue = ORDER.slice();
  await Promise.all(workers.map((w) => (async () => {
    while (queue.length && id === runId) {
      const policy = queue.shift(), R = state.runs[policy];
      await new Promise((done) => {
        const on = (m) => {
          if (id !== runId) return done();
          if (m.type === 'tick') {
            R.t = m.t; R.lps[m.t] = m.lp; R.tops[m.t] = m.top; R.kept = m.kept; R.cache = m.cache;
            if (m.seen) R.rows[m.t] = m.seen; for (const e of m.evicted) R.evicted.push([m.t, e]);
          } else if (m.type === 'done') {
            Object.assign(R, { ppl: m.ppl, ms: m.ms, cache: m.cache, done: true });
            log(`${policy.padEnd(7)} ppl ${m.ppl.toFixed(2)}   ${m.ms.toFixed(0)} ms/token   KV ${(m.cache / 1024).toFixed(0)} KB`, policy === 'fl' ? 'orange' : 'ink');
            emit(); done(); return;
          }
          emit();
        };
        const msg = { type: 'run', id, ids: state.ids, policy, budget, watch: WATCH };
        if (w.inline) inlineRun(msg, on); else { w.onmessage = (e) => on(e.data); w.postMessage(msg); }
      });
    }
  })()));
  if (id !== runId) return;
  state.phase = 'done'; emit();
}

// in-page fallback: the same session, a token per macrotask so the page keeps drawing
async function inlineRun(msg, on) {
  const { Session, logSoftmaxAt, argmax } = await import('./gpt2.js');
  const { ids, policy, budget, watch } = msg;
  const s = new Session(inlineModel, { policy, budget, maxLen: ids.length + 2 }); const t0 = performance.now(); let nll = 0;
  for (let t = 0; t < ids.length; t++) {
    const r = s.step(ids[t], watch); const lp = t < ids.length - 1 ? logSoftmaxAt(r.logits, ids[t + 1]) : 0; nll -= lp;
    on({ type: 'tick', t, lp, top: argmax(r.logits), kept: r.kept, seen: r.seen, evicted: r.evicted, cache: s.cacheBytes });
    await new Promise((r2) => setTimeout(r2, 0));
  }
  on({ type: 'done', ppl: Math.exp(nll / Math.max(1, ids.length - 1)), ms: (performance.now() - t0) / ids.length, cache: s.cacheBytes });
}

export const subscribe = (f) => { state.listeners.add(f); return () => state.listeners.delete(f); };
