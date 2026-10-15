// The model every live screen shares: DistilGPT-2, downloaded once to the visitor's machine and held by a small
// pool of workers. The games (src/play/) send their work through ask().
import { makeTokenizer } from './tokenizer.js';

export const POOL = 5;                                  // one worker per KV policy, so those five runs go side by side
export const EOT = 50256;                               // <|endoftext|>, which GPT-2 text starts from
export const engine = { phase: 'idle', got: 0, total: 0, loadMs: 0, backend: '', model: null, tok: null, error: '', listeners: new Set() };
const emit = () => engine.listeners.forEach((f) => f(engine));
export const subscribe = (f) => { engine.listeners.add(f); return () => engine.listeners.delete(f); };

let workers = [], loading = null;
const queue = [];
const base = new URL('../model/', import.meta.url);      // this file is built into js/, the model sits in model/
const CHUNK = 14 * 1024 * 1024;                         // tools/pack_gpt2.py's chunk size

export function load() {
  if (loading) return loading;
  loading = (async () => {
    engine.phase = 'loading'; engine.got = 0; emit();
    const t0 = performance.now(), man = await (await fetch(new URL('manifest.json', base))).json();
    engine.model = man; engine.total = man.bytes; emit();
    const buf = new Uint8Array(man.bytes);
    // chunks in parallel; each lands at its own offset
    await Promise.all(man.chunks.map(async (c, i) => {
      const o = i * CHUNK;
      const res = await fetch(new URL(c, base)); const reader = res.body.getReader(); let p = o;
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf.set(value, p); p += value.length; engine.got += value.length; emit(); }
    }));
    const [vocab, merges] = await Promise.all([fetch(new URL('vocab.json', base)).then((r) => r.json()), fetch(new URL('merges.txt', base)).then((r) => r.text())]);
    engine.tok = makeTokenizer(vocab, merges);
    try {
      // each worker holds its own copy of the weights
      workers = await Promise.all(Array.from({ length: POOL }, () => new Promise((ok, bad) => {
        const w = new Worker(new URL('./llm-worker.js', import.meta.url));
        w.onerror = (e) => bad(e); w.onmessage = (e) => { if (e.data.type === 'ready') { w.onmessage = null; ok({ w, busy: false, key: null }); } };
        const copy = buf.buffer.slice(0); w.postMessage({ type: 'init', manifest: man, buf: copy }, [copy]);
      })));
      engine.backend = `${POOL} workers`;
    } catch {
      // no workers here: run in the page, yielding between tokens so it keeps drawing
      const { handle } = await import('./worker.js');
      await handle({ type: 'init', manifest: man, buf: buf.buffer }, () => {});
      const pause = () => new Promise((r) => setTimeout(r, 0));
      workers = [{ inline: (msg, on) => handle(msg, on, pause), busy: false, key: null }]; engine.backend = 'main thread';
    }
    engine.loadMs = performance.now() - t0;
    engine.phase = 'ready'; emit(); pump();
  })().catch((e) => { engine.phase = 'error'; engine.error = e.message; loading = null; emit(); });
  return loading;
}

/* Send one job to a free worker. onTick gets each message before the job's last one ('done' or 'scored'), which
   the promise resolves with. Jobs that share a prompt prefix should share a key: a worker that last served that
   key still has the prefix in its cache. */
export function ask(msg, { onTick, key = null } = {}) {
  return new Promise((done) => { queue.push({ msg, onTick, key, done }); pump(); });
}
function pump() {
  while (queue.length) {
    const free = workers.filter((w) => !w.busy); if (!free.length) return;
    const job = queue.shift(), w = (job.key && free.find((x) => x.key === job.key)) || free.find((x) => !x.key) || free[0];
    w.busy = true; if (job.key) w.key = job.key;
    const on = (m) => { if (m.type === 'done' || m.type === 'scored') { w.busy = false; job.done(m); pump(); } else if (job.onTick) job.onTick(m); };
    if (w.inline) setTimeout(() => w.inline(job.msg, on), 0); else { w.w.onmessage = (e) => on(e.data); w.w.postMessage(job.msg); }
  }
}

// text -> token ids, starting from <|endoftext|> the way the model was trained to
export const encode = (text) => [EOT, ...engine.tok.encode(text)];
