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
const where = $('#tour-where'), status = $('#tour-status'), skipBtn = $('#tour-skip'), flat = $('#flat-game'), viewBtn = $('#tour-view'), hud = $('#tour-hud');
const SCREEN_H = { lab: 606, hall: 576, ecsw: 576 };
let current = null;          // { id, run, opener, pushed, stopSync, warp, blocks }
let hello = null;            // the intro's hello, while it's up (see the end of this file)
let toured = false;          // a tour has been opened this load: coming back from one, there's no hello
// while a tour is up, the page behind it is inert: the tab order stays in the dialog
const behind = () => document.querySelectorAll('body > :not(#tour):not(#warp):not(script)');

// A room's screen on a canvas outside the tour: the hover peek, the work cards, the flat fallback. The screens lay
// out at 1024 wide; scale draws them smaller (half size is a quarter of the work per frame). start(still) runs it,
// or draws one frame when still.
async function miniScreen(cv, tour, scale = 1) {
  const { makeScreen } = await screensMod();
  const W = 1024, H = SCREEN_H[tour.place], screen = makeScreen(tour.visual, W, H), ctx = cv.getContext('2d');
  let raf = 0, last = 0;
  const fit = () => { if (cv.width !== W * scale || cv.height !== H * scale) { cv.width = W * scale; cv.height = H * scale; } ctx.setTransform(scale, 0, 0, scale, 0, 0); };
  const loop = (t) => { raf = requestAnimationFrame(loop); screen.frame(ctx, Math.min(0.1, (t - last) / 1000)); last = t; };
  return {
    screen, ctx, fit,
    start(still = false) { cancelAnimationFrame(raf); fit(); if (still) screen.frame(ctx, 0); else { last = performance.now(); raf = requestAnimationFrame(loop); } },
    stop() { cancelAnimationFrame(raf); },
  };
}

// a look at the room's screen before you go: hovering a link floats a live thumbnail of what's running there.
// Only where there's a real hover; the page's "hover first" hints show only then too (.can-peek)
const canPeek = matchMedia('(hover: hover) and (pointer: fine)').matches;
document.documentElement.classList.toggle('can-peek', canPeek);
const peek = document.createElement('div'); peek.className = 'peek'; peek.innerHTML = '<canvas></canvas><p></p>'; document.body.append(peek);
const peekCv = peek.querySelector('canvas'), peekCap = peek.querySelector('p');
const peekScreens = new Map();                         // one per tour, kept for the next hover
let peeking = null;
async function startPeek(a) {
  const id = a.dataset.tour, tour = TOURS[id], place = PLACES[tour.place]; peeking = id;
  peekCap.innerHTML = `<b>${esc(place.building)}</b>${esc(place.name)}  ·  ${esc(tour.title)}`;
  const r = a.getBoundingClientRect(), w = 340, h = 20 + (340 * SCREEN_H[tour.place]) / 1024;
  const x = Math.min(innerWidth - w - 12, Math.max(12, r.left)), y = r.bottom + h + 10 < innerHeight ? r.bottom + 10 : r.top - h - 10;
  peek.style.left = `${x}px`; peek.style.top = `${y}px`;
  if (!peekScreens.has(id)) peekScreens.set(id, miniScreen(peekCv, tour, 0.5));
  const mini = await peekScreens.get(id);
  if (peeking !== id) return;
  mini.start(reduce()); peek.classList.add('on');
}
function stopPeek() { if (peeking) peekScreens.get(peeking)?.then((m) => m.stop()); peeking = null; peek.classList.remove('on'); }
// the link and its building on the map light up together
const lit = (id, on) => {
  const building = PLACES[TOURS[id].place].building;
  for (const el of document.querySelectorAll(`.plan-hot[data-code="${building}"], .pin[data-building="${building}"]`)) el.classList.toggle('lit', on);
};
for (const a of document.querySelectorAll('[data-tour]')) {
  const id = a.dataset.tour;
  const warm = () => { if (webgl) tourMod().then((m) => m.prefetch(TOURS[id].place)); };
  a.addEventListener('pointerenter', warm, { once: true });
  a.addEventListener('focus', warm, { once: true });
  let timer = 0;
  const on = () => { lit(id, true); if (canPeek && !a.matches('.pin') && !a.closest('.card')) timer = setTimeout(() => startPeek(a), 260); };
  const off = () => { lit(id, false); clearTimeout(timer); stopPeek(); };
  a.addEventListener('pointerenter', on); a.addEventListener('pointerleave', off); a.addEventListener('focus', on); a.addEventListener('blur', off);
  a.addEventListener('click', (e) => {
    e.preventDefault(); off();
    const r = a.getBoundingClientRect();
    open(id, a, { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 });
  });
}

// the explanation, laid over the scene; the highlighted step follows the screen, and clicking a step jumps it there
function showBrief(tour, screen, focus = true) {
  const lede = splitFirst(tour.lede);
  brief.innerHTML = `
    <p class="b-kicker">${esc(tour.kicker)}</p>
    <h2 id="b-title" tabindex="-1">${esc(tour.title)}</h2>
    <p class="b-lede">${esc(lede[0])}</p>
    ${tour.play ? `<section class="b-play" aria-label="${esc(tour.play.title)}">
      <h3>${esc(tour.play.title)}</h3>
      ${tour.play.recorded ? recorded(tour.play.recorded) : ''}
      <button type="button" class="b-go">Play it yourself (85 MB download)</button>
      <p class="b-pitch">${esc(tour.play.pitch)}</p>
      <p class="b-small">It runs DistilGPT-2, a small text model from 2019, in your browser. It only continues the text it is given and does not follow instructions.</p>
      <p class="b-status" aria-live="polite"></p>
      <div class="b-game" hidden></div>
    </section>` : ''}
    <p class="b-role"><b>My part.</b> ${esc(tour.role)}</p>
    <details class="b-more"><summary class="b-how">${esc(tour.how || 'How it works')}<span>${tour.steps.length} steps, following the screen</span></summary>
      ${lede[1] ? `<p class="b-lede">${esc(lede[1])}</p>` : ''}
      <ol class="b-steps">${tour.steps.map((s, i) => `<li><button type="button" data-step="${i}">${esc(s)}</button></li>`).join('')}</ol>
    </details>
    <footer class="b-next">
      ${alsoIn(tour).length ? `<p class="b-also-k">Also in this room</p><div class="b-also">${alsoIn(tour).map((k) => `<button type="button" data-go="${k}">${esc(TOURS[k].title.split(':')[0])}</button>`).join('')}</div>` : ''}
      <p>Hiring for summer 2027? <a href="mailto:dasarrajuakash@gmail.com">Email me</a> or open the <a href="Akash_Dasarraju_Resume.pdf" target="_blank" rel="noopener">résumé</a>.</p>
    </footer>`;
  brief.hidden = false;
  overlay.classList.add('reading');
  if (focus) $('#b-title').focus({ preventScroll: true });
  brief.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => screen.goto(+b.dataset.step)));
  brief.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => switchTo(b.dataset.go), { once: true }));
  const unPlay = tour.play ? wirePlay(tour.play.id, screen) : () => {};
  const items = [...brief.querySelectorAll('.b-steps li')];
  let raf = 0, lastStep = -1;
  const sync = () => {
    raf = requestAnimationFrame(sync);
    if (screen.step !== lastStep) { lastStep = screen.step; items.forEach((li, i) => li.classList.toggle('now', i === screen.step)); }
  };
  sync();
  return () => { cancelAnimationFrame(raf); unPlay(); };
}

// the lede's first sentence leads the panel; the rest opens "How it works"
function splitFirst(s) { const m = s.match(/^.+?[.?!](?=\s+\S)/); return m ? [m[0], s.slice(m[0].length).trim()] : [s, '']; }
// one run of the game, recorded on this site's model, shown before anyone downloads it
function recorded(r) {
  return `<div class="b-rec"><p class="b-rec-k">One recorded run</p>
    <table class="g-score"><thead><tr>${r.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${r.rows.map((row, i) => `<tr${i === r.best ? ' class="best"' : ''}>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="b-rec-note">${esc(r.note)}</p></div>`;
}

// the room's other tours, in TOURS order
function alsoIn(tour) { return Object.keys(TOURS).filter((k) => TOURS[k].place === tour.place && TOURS[k] !== tour); }
// from one tour to the next without touching history twice: the new tour takes the old one's entry
function switchTo(id) {
  if (!current) return;
  const { opener, pushed } = current;
  close(true, false);
  open(id, opener, null, { replace: true, pushed });
}

// the tour's game (src/play/): played in the panel, on the same in-browser model, with the result on the screen
function wirePlay(id, screen) {
  let alive = true, unmount = () => {};
  import('./play/index.js').then((m) => { if (alive) unmount = m.mountPlay(id, brief.querySelector('.b-play'), screen); });
  return () => { alive = false; unmount(); };
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
  const mini = await miniScreen(flat.querySelector('canvas'), tour);
  if (current !== me) return;
  flat.hidden = false; mini.start();
  const stopBrief = showBrief(tour, mini.screen);
  me.stopSync = () => { mini.stop(); stopBrief(); flat.hidden = true; };
}

function open(id, opener, from, how = {}) {
  const tour = TOURS[id]; if (!tour) return;
  if (current) close(false);
  toured = true; hello?.hide();
  const place = PLACES[tour.place];
  document.body.classList.add('touring');
  for (const el of behind()) el.inert = true;
  overlay.hidden = false; overlay.classList.remove('reading', 'close'); viewBtn.hidden = true;
  brief.hidden = true; brief.innerHTML = ''; title.hidden = true;
  where.innerHTML = ''; status.textContent = '';
  overlay.setAttribute('aria-label', `Tour: ${tour.title}`);
  const pushed = how.replace ? how.pushed : location.hash !== `#${id}`;
  try {
    if (how.replace) history.replaceState({ tour: id }, '', `#${id}`);
    else if (pushed) history.pushState({ tour: id }, '', `#${id}`);
  } catch { /* sandboxed frames may refuse */ }
  const me = { id, opener, pushed, run: null, stopSync: null, warp: null, blocks: null };
  current = me;
  const flatMode = !webgl || reduce();
  skipBtn.hidden = flatMode;
  $('#tour-close').focus({ preventScroll: true });
  if (flatMode) { where.innerHTML = `<b>${esc(place.building)}</b> ${esc(place.name)}`; playFlat(tour, me); return; }
  // every tour flies in over campus ("Skip the flight" is there for anyone in a hurry); moving to another tour in the
  // same room goes straight there
  const quick = !!how.replace;
  overlay.classList.toggle('flying', !quick);
  me.warp = enter(warpCv, from || { x: innerWidth / 2, y: innerHeight / 2 }, [place.building, `${place.name}  //  32.986 N  96.748 W`], quick ? 0.5 : 1.2);
  tourMod().then((m) => {
    if (current !== me) return;
    me.run = m.runTour(tour, {
      canvas,
      label: (code, name) => { where.innerHTML = `<b>${esc(code)}</b> ${esc(name)}`; },
      status: (s) => { status.textContent = s; },
      hud: (s) => { hud.textContent = s; hud.hidden = !s; },
      reveal: () => me.warp.release(),
      cross: { cover: () => (me.blocks = blocks(warpCv)).cover(), reveal: () => me.blocks.reveal() },
      title: (p, building) => { if (!quick) showTitle(p, building); },
      quick,
      // the explanation is up as soon as the room's screen exists, so there's something to read during the flight
      onScreen: (screen) => { if (current === me) me.stopSync = showBrief(tour, screen, false); },
      onView: (on) => { overlay.classList.toggle('close', on); viewBtn.textContent = on ? 'Look around the room' : 'Back to the screen'; },
      onArrive: (screen) => {
        if (current !== me) return;
        skipBtn.hidden = true; overlay.classList.remove('flying');
        if (!screen) { me.warp.stop(); me.run.stop(); me.stopSync?.(); me.stopSync = null; playFlat(tour, me); return; }
        viewBtn.hidden = false; $('#b-title')?.focus({ preventScroll: true });
      },
    });
  }).catch(() => { me.warp.stop(); me.stopSync?.(); me.stopSync = null; playFlat(tour, me); });
}

function close(fromHistory = false, refocus = true) {
  if (!current) return;
  const { run, stopSync, opener, pushed, warp, blocks: bl } = current; current = null;
  if (run) run.stop();
  if (stopSync) stopSync();
  if (warp) warp.stop(); if (bl) bl.stop();
  overlay.hidden = true; brief.hidden = true; flat.hidden = true; title.hidden = true; hud.hidden = true;
  document.body.classList.remove('touring');
  for (const el of behind()) el.inert = false;
  if (!fromHistory) try { if (pushed) history.back(); else history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  if (opener && refocus) opener.focus({ preventScroll: true });
}

$('#tour-close').addEventListener('click', () => close());
skipBtn.addEventListener('click', () => { if (current && current.run) current.run.skip(); });
viewBtn.addEventListener('click', () => { if (current && current.run) current.run.view(!overlay.classList.contains('close')); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !current) return;
  if (e.target.matches?.('input, textarea, select, [contenteditable]')) { e.target.blur(); return; }
  close();
});
addEventListener('popstate', () => { const id = location.hash.slice(1); if (current && !TOURS[id]) close(true); else if (TOURS[id] && !current) open(id); });
if (TOURS[location.hash.slice(1)]) open(location.hash.slice(1));

// the hello (src/intro.js): me, popping up to say the page is interactive. On every load, a moment in, but not once
// a tour has been opened (so not on the way back from one), nor with reduced motion or no WebGL to draw me with
{
  if (webgl && !reduce()) setTimeout(() => {
    if (toured) return;
    import('./intro.js').then((m) => m.show({ onDone: () => { hello = null; } })).then((h) => {
      hello = h; if (toured) h.hide();
      if (matchMedia('(pointer: coarse)').matches) setTimeout(() => h.hide(), 9000);
    }).catch(() => {});
  }, 1600);
}

// on a phone the map follows the projects (the proof first); on a wide screen it sits beside the name
{
  const plate = $('.plan'), home = plate.parentElement, after = $('#research'), narrow = matchMedia('(max-width: 880px)');
  const place = () => { const want = narrow.matches ? after.parentElement : home; if (plate.parentElement !== want) { if (narrow.matches) after.before(plate); else home.append(plate); } };
  narrow.addEventListener('change', place); addEventListener('resize', place); place();
}
// light or dark: the system's choice until the visitor picks one, which is remembered (the <head> applies it before paint)
{
  const root = document.documentElement, sys = matchMedia('(prefers-color-scheme: dark)');
  const now = () => root.dataset.theme || (sys.matches ? 'dark' : 'light');
  const label = () => { const to = now() === 'dark' ? 'light' : 'dark'; for (const b of document.querySelectorAll('.theme-btn')) { b.setAttribute('aria-label', `Switch to ${to} mode`); b.title = `Switch to ${to} mode`; } };
  for (const b of document.querySelectorAll('.theme-btn')) b.addEventListener('click', () => {
    const t = now() === 'dark' ? 'light' : 'dark'; root.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch { /* private mode: it lasts this visit */ }
    label();
  });
  sys.addEventListener('change', label); label();
}
// the clock on the plate: it is always now in Richardson
{
  const cap = $('.plan figcaption');
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  const tick = () => { cap.innerHTML = `UT Dallas, Richardson, Texas <b>${fmt.format(new Date()).toLowerCase()}</b>`; };
  tick(); setInterval(tick, 20000);
}
// entries come in as you reach them
document.documentElement.classList.add('js');
const seen = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); seen.unobserve(e.target);
}), { rootMargin: '0px 0px -6% 0px' });
for (const el of document.querySelectorAll('[data-reveal]')) seen.observe(el);
{
  let queued = 0;
  const above = () => {
    queued = 0;
    for (const el of document.querySelectorAll('[data-reveal]:not(.in)')) if (el.getBoundingClientRect().top < innerHeight) { el.classList.add('in'); seen.unobserve(el); }
  };
  addEventListener('scroll', () => { if (!queued) queued = requestAnimationFrame(above); }, { passive: true });
  addEventListener('hashchange', above);
}
addEventListener('beforeprint', () => {
  for (const el of document.querySelectorAll('[data-reveal]')) el.classList.add('in');
  for (const d of document.querySelectorAll('details')) d.open = true;
});
// the bar across the top appears once the hero has scrolled away
{
  const top = $('.top'), hero = $('.hero');
  new IntersectionObserver(([e]) => top.classList.toggle('show', !e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(hero);
}
// the plate tilts a little toward the pointer
{
  const plate = $('.plan');
  if (plate && canPeek && !reduce()) {
    let want = [0, 0], cur = [0, 0], raf = 0, r = null;   // r: the plate's box, read once per visit (it moves as it tilts)
    const tick = () => {
      cur = cur.map((c, i) => c + (want[i] - c) * 0.1);
      plate.style.transform = `perspective(1400px) rotateX(${cur[0].toFixed(2)}deg) rotateY(${cur[1].toFixed(2)}deg)`;
      raf = Math.abs(cur[0] - want[0]) + Math.abs(cur[1] - want[1]) > 0.01 ? requestAnimationFrame(tick) : 0;
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
    plate.addEventListener('pointerenter', () => { r = plate.getBoundingClientRect(); });
    plate.addEventListener('pointermove', (e) => { r ||= plate.getBoundingClientRect(); want = [-((e.clientY - r.top) / r.height - 0.5) * 6, ((e.clientX - r.left) / r.width - 0.5) * 8]; go(); });
    plate.addEventListener('pointerleave', () => { want = [0, 0]; r = null; go(); });
  }
}
// the cards: each shows its room's screen, drawn as it comes into view and running while you're over it
{
  const shot = async (card) => {
    const tour = TOURS[card.dataset.card], cv = card.querySelector('canvas'); if (!tour || !cv) return;
    const mini = await miniScreen(cv, tour, 0.5);
    mini.fit(); for (let i = 0; i < 12; i++) mini.screen.frame(mini.ctx, 0.3);   // a few seconds in, so there's something on it
    const top = card.querySelector('.card-top');
    top.addEventListener('pointerenter', () => { if (!reduce()) mini.start(); });
    top.addEventListener('pointerleave', () => mini.stop());
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); shot(e.target); } }), { rootMargin: '240px 0px' });
  for (const c of document.querySelectorAll('.card[data-card]')) io.observe(c);
}
