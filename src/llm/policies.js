// KV-cache eviction policies. Each sees one layer's cache, C = { K, pos, acc, obs }, already one entry over
// budget, and returns the index of the entry to drop. acc[j] is the attention entry j has received so far
// (summed over queries, averaged over heads); obs[j] is its attention from the last few queries.
const SINKS = 4;

// StreamingLLM: keep the first few tokens (attention sinks) and a window of the most recent ones
const stream = { evict: (C) => Math.min(SINKS, C.pos.length - 1) };

// H2O: keep the most recent half of the budget, and among the rest the heavy hitters (most attention so far)
const h2o = {
  evict(C, B) {
    const end = C.pos.length - Math.floor(B / 2); let j = 0;
    for (let i = 1; i < end; i++) if (C.acc[i] < C.acc[j]) j = i;
    return j;
  },
};

// SnapKV, in decoding: keep a recent window, and among the rest what the last few queries attended to most
const snap = {
  evict(C) {
    const end = C.pos.length - 8, score = (i) => C.obs[i].reduce((a, b) => a + b, 0); let j = 0, best = Infinity;
    for (let i = 0; i < end; i++) { const s = score(i); if (s < best) { best = s; j = i; } }
    return j;
  },
};

// facility location over the cached keys, each weighted by the attention it has received:
//   f(S) = sum_i a_i max_{j in S} sim(k_i, k_j),  sim = cosine, clipped at 0.
// Drop the entry whose removal lowers f(S) the least: a key that another kept key already stands in for
// costs almost nothing, so near-duplicates go first. The first token and a short recent window are kept.
const fl = {
  evict(C, B, D) {
    const n = C.pos.length, K = C.K, norm = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let e = 0; e < D; e++) s += K[i * D + e] ** 2; norm[i] = Math.sqrt(s) || 1; }
    const sim = new Float32Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
      let d = 0; for (let e = 0; e < D; e++) d += K[i * D + e] * K[j * D + e];
      const v = i === j ? 1 : Math.max(0, d / (norm[i] * norm[j])); sim[i * n + j] = v; sim[j * n + i] = v;
    }
    // for every i: the best and second-best kept stand-in
    const best = new Int32Array(n), first = new Float32Array(n), second = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let b = -1, v1 = -1, v2 = -1;
      for (let j = 0; j < n; j++) { const v = sim[i * n + j]; if (v > v1) { v2 = v1; v1 = v; b = j; } else if (v > v2) v2 = v; }
      best[i] = b; first[i] = v1; second[i] = Math.max(0, v2);
    }
    const lo = 1, hi = n - 4; let pick = lo, least = Infinity;
    for (let j = lo; j < hi; j++) {
      let loss = 0;
      for (let i = 0; i < n; i++) if (best[i] === j) loss += (C.acc[i] + 1e-3) * (first[i] - second[i]);
      if (loss < least) { least = loss; pick = j; }
    }
    return pick;
  },
};

// the visitor's policy (the KV game): the start token and the pinned positions never leave; otherwise the oldest
// entry goes. (The start token is an attention sink: drop it and every later prediction falls apart.)
const pin = { evict(C, B, D, keep) { for (let j = 1; j < C.pos.length - 1; j++) if (!keep.has(C.pos[j])) return j; return 1; } };

export const POLICIES = { full: { evict: () => 0 }, stream, h2o, snap, fl, pin };
export const POLICY_NAMES = { full: 'Full cache', stream: 'StreamingLLM', h2o: 'H2O', snap: 'SnapKV', fl: 'Facility location', pin: 'Pinned' };
