// The site: a plain page. Anything marked as a place opens a tour of where that work happens: a tunnel into a
// digital UT Dallas, a flight to the building, and the room, where the explanation overlays the scene and follows
// the work running on the room's screen.
import { TOURS, PLACES } from './content.js';
import { enter, blocks, scramble } from './warp.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
const tourMod = () => import('./tour/index.js');
const screensMod = () => import('./screens/index.js');

const overlay = $('#tour'), canvas = $('#tour-canvas'), warpCv = $('#warp'), brief = $('#brief'), title = $('#room-title');
const where = $('#tour-where'), status = $('#tour-status'), skipBtn = $('#tour-skip'), flat = $('#flat-game'), viewBtn = $('#tour-view');
const SCREEN_H = { lab: 606, hall: 576, ecsw: 576 };
let current = null;          // { id, run, opener, pushed, stopSync, warp, blocks }

for (const a of document.querySelectorAll('[data-tour]')) {
  const warm = () => { if (webgl) tourMod().then((m) => m.prefetch(TOURS[a.dataset.tour].place)); };
  a.addEventListener('pointerenter', warm, { once: true });
  a.addEventListener('focus', warm, { once: true });
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const r = a.getBoundingClientRect();
    open(a.dataset.tour, a, { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 });
  });
}

// the explanation, laid over the scene; the highlighted step follows the screen, and clicking a step jumps it there
function showBrief(tour, screen) {
  brief.innerHTML = `
    <p class="b-kicker">${esc(tour.kicker)}</p>
    <h2 id="b-title" tabindex="-1">${esc(tour.title)}</h2>
    <p class="b-lede">${esc(tour.lede)}</p>
    <ol class="b-steps">${tour.steps.map((s, i) => `<li><button type="button" data-step="${i}">${esc(s)}</button></li>`).join('')}</ol>
    <p class="b-role"><b>My part.</b> ${esc(tour.role)}</p>
    ${tour.live ? `<section class="b-live" aria-label="Run it on a real model">
      <h3>Run it on a real model</h3>
      <p>DistilGPT-2 (82M parameters) runs right here in your browser, on GPT-2 implemented from scratch in JavaScript for this site. The screen switches to its real attention, and every policy is measured on your text.</p>
      <button type="button" class="b-go">Download the model (85 MB) and run</button>
      <div class="b-form" hidden>
        <label for="b-text">Text</label>
        <textarea id="b-text" rows="5" spellcheck="false"></textarea>
        <label class="b-budget">Cache budget <input type="range" min="8" max="64" step="4"> <output></output> entries per layer</label>
        <button type="button" class="b-run">Run again</button>
      </div>
      <p class="b-status" aria-live="polite"></p>
    </section>` : ''}`;
  brief.hidden = false;
  overlay.classList.add('reading');
  $('#b-title').focus({ preventScroll: true });
  brief.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => screen.goto(+b.dataset.step)));
  const unLive = tour.live ? wireLive(screen) : () => {};
  const items = [...brief.querySelectorAll('.b-steps li')];
  let raf = 0, lastStep = -1;
  const sync = () => {
    raf = requestAnimationFrame(sync);
    if (screen.step !== lastStep) { lastStep = screen.step; items.forEach((li, i) => li.classList.toggle('now', i === screen.step)); }
  };
  sync();
  return () => { cancelAnimationFrame(raf); unLive(); };
}

// the "run it on a real model" panel: loads DistilGPT-2 once (src/llm/), then the screen shows the live run
function wireLive(screen) {
  const box = brief.querySelector('.b-live'), go = box.querySelector('.b-go'), form = box.querySelector('.b-form');
  const ta = box.querySelector('textarea'), range = box.querySelector('input'), out = box.querySelector('output'), again = box.querySelector('.b-run'), status = box.querySelector('.b-status');
  let unsub = () => {}, alive = true;
  import('./llm/live.js').then((L) => {
    if (!alive) return;
    const S = L.state; screen.attachLive?.(S);
    ta.value = S.text; range.value = S.budget; out.textContent = S.budget;
    range.oninput = () => { out.textContent = range.value; };
    const render = () => {
      const names = { full: 'full cache', stream: 'StreamingLLM', h2o: 'H2O', snap: 'SnapKV', fl: 'facility location' };
      go.hidden = S.phase !== 'idle' && S.phase !== 'error';
      form.hidden = !(S.phase === 'ready' || S.phase === 'done' || S.phase === 'running');
      again.disabled = S.phase === 'running';
      if (S.phase === 'loading') status.textContent = `Downloading ${(S.got / 1e6).toFixed(0)} of ${((S.total || 85e6) / 1e6).toFixed(0)} MB…`;
      else if (S.phase === 'running') { const n = Object.values(S.runs).filter((r) => r.done).length; status.textContent = `Running ${S.ids.length} tokens through 5 caches on ${S.backend}: ${n} of 5 done.`; }
      else if (S.phase === 'done') {
        const rank = ['stream', 'h2o', 'snap', 'fl'].map((p) => [p, S.runs[p].ppl]).sort((a, b) => a[1] - b[1]);
        status.textContent = `At ${S.budget} entries per layer, ${names[rank[0][0]]} kept perplexity closest to the full cache (${rank[0][1].toFixed(1)} vs ${S.runs.full.ppl.toFixed(1)}); ${names[rank[3][0]]} lost the most (${rank[3][1].toFixed(1)}). Click a step to see each policy's attention.`;
      } else if (S.phase === 'error') status.textContent = 'The model could not load here. Try a desktop browser.';
      else status.textContent = '';
    };
    unsub = L.subscribe(render); render();
    const start = () => { screen.manual = false; L.run(ta.value.trim() || L.DEFAULT_TEXT, +range.value); };
    go.onclick = () => { go.hidden = true; L.load().then(() => { if (alive && S.phase === 'ready') start(); }); };
    again.onclick = start;
  });
  return () => { alive = false; unsub(); };
}

// the room's name, decoding over the scene as we arrive
function showTitle(place, building) {
  title.innerHTML = `<p class="rt-k"></p><h2 class="rt-t"></h2><p class="rt-s"></p>`;
  const [k, t, s] = title.children, lines = [`${place.building} // ${building}`, place.name, place.sub];
  title.hidden = false; title.classList.remove('out');
  const t0 = performance.now();
  const tick = () => {
    const e = (performance.now() - t0) / 1000;
    [k, t, s].forEach((el, i) => { el.textContent = scramble(lines[i], Math.min(1, Math.max(0, (e - i * 0.18) / 0.7))); });
    if (e < 1.4) requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => title.classList.add('out'), 2600);
  setTimeout(() => { title.hidden = true; }, 3400);
}

// no WebGL (or reduced motion): the same screen, flat on the page, with the same overlay
async function playFlat(tour, me) {
  const { makeScreen } = await screensMod();
  if (current !== me) return;
  flat.hidden = false;
  const cv = flat.querySelector('canvas'), ctx = cv.getContext('2d');
  cv.width = 1024; cv.height = SCREEN_H[tour.place];
  const screen = makeScreen(tour.visual, cv.width, cv.height);
  let last = performance.now(), raf = 0;
  const loop = (t) => { raf = requestAnimationFrame(loop); screen.frame(ctx, Math.min(0.1, (t - last) / 1000)); last = t; };
  raf = requestAnimationFrame(loop);
  const stopBrief = showBrief(tour, screen);
  me.stopSync = () => { cancelAnimationFrame(raf); stopBrief(); flat.hidden = true; };
}

function open(id, opener, from) {
  const tour = TOURS[id]; if (!tour) return;
  if (current) close(false);
  const place = PLACES[tour.place];
  document.body.classList.add('touring');
  overlay.hidden = false; overlay.classList.remove('reading', 'close'); viewBtn.hidden = true;
  brief.hidden = true; brief.innerHTML = ''; title.hidden = true;
  where.innerHTML = ''; status.textContent = '';
  const pushed = location.hash !== `#${id}`;
  if (pushed) try { history.pushState({ tour: id }, '', `#${id}`); } catch { /* sandboxed frames may refuse */ }
  const me = { id, opener, pushed, run: null, stopSync: null, warp: null, blocks: null };
  current = me;
  const flatMode = !webgl || reduce();
  skipBtn.hidden = flatMode;
  if (flatMode) { where.innerHTML = `<b>${esc(place.building)}</b> ${esc(place.name)}`; playFlat(tour, me); return; }
  me.warp = enter(warpCv, from || { x: innerWidth / 2, y: innerHeight / 2 }, [place.building, `${place.name}  //  32.986 N  96.748 W`]);
  tourMod().then((m) => {
    if (current !== me) return;
    me.run = m.runTour(tour, {
      canvas,
      label: (code, name) => { where.innerHTML = `<b>${esc(code)}</b> ${esc(name)}`; },
      status: (s) => { status.textContent = s; },
      reveal: () => me.warp.release(),
      cross: { cover: () => (me.blocks = blocks(warpCv)).cover(), reveal: () => me.blocks.reveal() },
      title: (p, building) => showTitle(p, building),
      onScreen: () => {},
      onView: (on) => { overlay.classList.toggle('close', on); viewBtn.textContent = on ? 'Look around' : 'Back to the screen'; },
      onArrive: (screen) => {
        if (current !== me) return;
        skipBtn.hidden = true;
        if (!screen) { me.warp.stop(); me.run.stop(); playFlat(tour, me); return; }
        viewBtn.hidden = false;
        me.stopSync = showBrief(tour, screen);
      },
    });
  }).catch(() => { me.warp.stop(); playFlat(tour, me); });
}

function close(fromHistory = false) {
  if (!current) return;
  const { run, stopSync, opener, pushed, warp, blocks: bl } = current; current = null;
  if (run) run.stop();
  if (stopSync) stopSync();
  if (warp) warp.stop(); if (bl) bl.stop();
  overlay.hidden = true; brief.hidden = true; flat.hidden = true; title.hidden = true;
  document.body.classList.remove('touring');
  if (!fromHistory) try { if (pushed) history.back(); else history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  if (opener) opener.focus({ preventScroll: true });
}

$('#tour-close').addEventListener('click', () => close());
skipBtn.addEventListener('click', () => { if (current && current.run) current.run.skip(); });
viewBtn.addEventListener('click', () => { if (current && current.run) current.run.view(!overlay.classList.contains('close')); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
addEventListener('popstate', () => { const id = location.hash.slice(1); if (current && !TOURS[id]) close(true); else if (TOURS[id] && !current) open(id); });
if (TOURS[location.hash.slice(1)]) open(location.hash.slice(1));
