// The game each tour offers in its panel. All of them run on the same in-browser DistilGPT-2 (src/llm/engine.js),
// downloaded when the visitor asks; once it's there, the game mounts its controls in the panel and takes over the
// room's screen (screen.play) whenever the visitor plays. Each game module exports mount(el, screen) -> unmount.
import { engine, load, subscribe } from '../llm/engine.js';

const GAMES = {
  subset: () => import('./subset.js'), memory: () => import('./memory.js'), mnk: () => import('./mnk.js'),
  rag: () => import('./rag.js'), ctf: () => import('./ctf.js'), kv: () => import('./kv.js'),
};

export function mountPlay(id, box, screen) {
  const go = box.querySelector('.b-go'), status = box.querySelector('.b-status'), room = box.querySelector('.b-game');
  let alive = true, started = false, unmount = null;
  const start = async () => {
    if (started) return; started = true;
    const game = await GAMES[id]();
    if (!alive) return;
    status.textContent = ''; room.hidden = false;
    unmount = game.mount(room, screen);
  };
  const render = () => {
    go.hidden = engine.phase !== 'idle' && engine.phase !== 'error';
    if (engine.phase === 'loading') status.textContent = `Downloading ${(engine.got / 1e6).toFixed(0)} of ${((engine.total || 85e6) / 1e6).toFixed(0)} MB…`;
    else if (engine.phase === 'error') status.textContent = 'The model could not load here. Try a desktop browser.';
    else if (engine.phase === 'ready') start();
  };
  const unsub = subscribe(render); render();
  go.onclick = () => { go.hidden = true; load(); };
  return () => { alive = false; unsub(); if (unmount) unmount(); screen.play = null; };
}

// what each game is testing and what the result says about the work, at the top of its panel
export const about = (tests, means) => `<div class="g-what"><p><b>What's tested</b>${tests}</p><p><b>Why it matters</b>${means}</p></div>`;
// a small scoreboard: rows of cells (already escaped), with the best row marked
export const table = (head, rows, best = -1) => `<table class="g-score"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === best ? ' class="best"' : ''}>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
// small helpers the games share
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pct = (p) => (p >= 0.0995 ? `${Math.round(p * 100)}%` : p >= 0.001 ? `${(p * 100).toFixed(1)}%` : '<0.1%');
// what a token looks like in running text: its spaces and newlines made visible enough to read
export const piece = (id) => engine.tok.piece(id).replace(/\n/g, '⏎');
