// Runs GPT-2 off the main thread. Messages in: { type: 'init', manifest, buf, vocab, merges } (buf is the packed
// weights, transferred), { type: 'run', id, ids, policy, budget, watch }. Messages out: 'ready', per-token
// 'tick' updates, and 'done' with the run's totals.
import { loadModel, Session, logSoftmaxAt, argmax } from './gpt2.js';

let model = null;
const handle = (msg, post) => {
  if (msg.type === 'init') { model = loadModel(msg.manifest, msg.buf); post({ type: 'ready' }); return; }
  if (msg.type === 'run') {
    const { id, ids, policy, budget, watch = 3 } = msg, s = new Session(model, { policy, budget, maxLen: Math.max(ids.length + 2, 8) });
    const t0 = performance.now(); let nll = 0;
    for (let t = 0; t < ids.length; t++) {
      const r = s.step(ids[t], watch);
      const lp = t < ids.length - 1 ? logSoftmaxAt(r.logits, ids[t + 1]) : 0; nll -= lp;
      post({ type: 'tick', id, t, lp, top: argmax(r.logits), kept: r.kept, seen: r.seen, evicted: r.evicted, cache: s.cacheBytes });
    }
    const n = Math.max(1, ids.length - 1);
    post({ type: 'done', id, ppl: Math.exp(nll / n), ms: (performance.now() - t0) / ids.length, cache: s.cacheBytes });
  }
};
// as a worker; the same handler is used in-page when workers aren't available (see live.js)
if (typeof self !== 'undefined' && typeof window === 'undefined') self.onmessage = (e) => handle(e.data, (m) => self.postMessage(m));
export { handle };
