// GPT-2's byte-level BPE tokenizer: text -> UTF-8 bytes mapped to printable characters, split by GPT-2's
// pre-tokenizer pattern, then merged pair by pair in the order merges.txt ranks them.
const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

function byteMap() {
  const bs = []; for (let i = 33; i <= 126; i++) bs.push(i); for (let i = 161; i <= 172; i++) bs.push(i); for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice(); let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
  const enc = {}, dec = {}; bs.forEach((b, i) => { enc[b] = String.fromCharCode(cs[i]); dec[String.fromCharCode(cs[i])] = b; });
  return { enc, dec };
}

export function makeTokenizer(vocab, mergesText) {
  const { enc, dec } = byteMap(), inv = []; for (const [k, v] of Object.entries(vocab)) inv[v] = k;
  const ranks = new Map(); mergesText.split('\n').slice(1).forEach((l, i) => { if (l.trim()) ranks.set(l, i); });
  const cache = new Map(), te = new TextEncoder(), td = new TextDecoder();
  const bpe = (word) => {
    if (cache.has(word)) return cache.get(word);
    let parts = Array.from(word);
    for (;;) {
      let best = -1, rank = Infinity;
      for (let i = 0; i < parts.length - 1; i++) { const r = ranks.get(parts[i] + ' ' + parts[i + 1]); if (r !== undefined && r < rank) { rank = r; best = i; } }
      if (best < 0) break;
      parts = [...parts.slice(0, best), parts[best] + parts[best + 1], ...parts.slice(best + 2)];
    }
    cache.set(word, parts); return parts;
  };
  return {
    encode(text) {
      const ids = [];
      for (const m of text.matchAll(PAT)) { const w = Array.from(te.encode(m[0]), (b) => enc[b]).join(''); for (const p of bpe(w)) ids.push(vocab[p]); }
      return ids;
    },
    decode(ids) { return td.decode(new Uint8Array(ids.flatMap((id) => Array.from(inv[id] || '', (c) => dec[c])))); },
    piece(id) { return this.decode([id]); },
  };
}
