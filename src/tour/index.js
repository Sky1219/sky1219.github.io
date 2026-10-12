// The tour: campus scans in around the building, fly to the building, break through into the room, and walk up to
// the screen, where the work is already running. The text overlays the scene (main.js). Loaded on first use, so
// the site itself stays light.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCampus } from './campus.js';
import { loadRoom, framing } from './rooms.js';
import { makeScreen } from '../screens/index.js';
import { PLACES } from '../content.js';

export { makeScreen };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const CAMPUS_HOME = new THREE.Vector3(-300, 0, -40);

let R = null;
let campusP = null;
export const prefetch = (place) => { campusP = campusP || buildCampus(); if (place) loadRoom(place).catch(() => {}); };

function setup(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 6000);
  const composer = new EffectComposer(renderer);
  const pass = new RenderPass(new THREE.Scene(), camera); composer.addPass(pass);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.55, 0.8));
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();
  return { renderer, camera, composer, pass, look: new THREE.Vector3() };
}

// where a ray from the building's centre leaves its footprint, so we can stop at the wall instead of flying through
function facade(b, dir) {
  const r = b.rings[0], ox = b.center.x, oz = b.center.z; let best = Infinity;
  for (let i = 0; i + 3 < r.length; i += 2) {
    const ax = r[i], az = r[i + 1], bx = r[i + 2], bz = r[i + 3], ex = bx - ax, ez = bz - az;
    const den = dir.x * ez - dir.z * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - ox) * ez - (az - oz) * ex) / den, u = ((ax - ox) * dir.z - (az - oz) * dir.x) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return isFinite(best) ? best : 25;
}

/* Run one tour. ui = { canvas, label, status, onScreen(screen), onArrive(screen), onView(close), reveal(), cross: { cover(), reveal() }, title() }.
   Returns { skip(), stop(), view(close) }. */
export function runTour(tour, ui) {
  R = R || setup(ui.canvas);
  const { camera, composer, pass } = R;
  const place = PLACES[tour.place];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alive = true, raf = 0, skipping = false, room = null, screen = null, sctx = null, sway = null, views = null, close = false;
  const t0 = performance.now(), clock = () => (performance.now() - t0) / 1000;
  let lastF = clock();
  const frame = (fn) => {
    cancelAnimationFrame(raf);
    const f = () => {
      if (!alive) return; raf = requestAnimationFrame(f);
      const t = clock(), dt = Math.min(0.1, t - lastF); lastF = t;
      fn(t, dt);
      if (room) room.update(t);
      if (screen && room) { screen.frame(sctx, dt); room.tex.needsUpdate = true; }
      if (sway) {                                          // once settled, the view drifts a little with the pointer
        sway.cur.lerp(sway.want, Math.min(1, dt * 3));
        camera.position.copy(sway.pos).addScaledVector(sway.right, sway.cur.x).addScaledVector(sway.up, sway.cur.y); camera.lookAt(sway.look);
      }
      composer.render();
    };
    f();
  };
  const wait = (s) => new Promise((r) => setTimeout(r, reduce || skipping ? 0 : s * 1000));
  const fly = (pts, looks, secs, onT) => new Promise((done) => {
    const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null;
    const s0 = clock();
    const step = () => {
      const k = skipping || reduce ? 1 : Math.min(1, (clock() - s0) / secs), e = ease(k);
      if (curve) curve.getPoint(e, camera.position); else camera.position.lerpVectors(pts[0], pts[1], e);
      R.look.lerpVectors(looks[0], looks[1], e); camera.lookAt(R.look);
      if (onT) onT(k);
      if (k >= 1) done(); else if (alive) requestAnimationFrame(step);
    };
    step();
  });

  const move = (e) => {
    if (sway && e.pointerType === 'mouse') { const r = ui.canvas.getBoundingClientRect(); sway.want.set(((e.clientX - r.left) / r.width - 0.5) * sway.amp, -((e.clientY - r.top) / r.height - 0.5) * sway.amp * 0.6); }
  };
  const settle = (v, amp) => {
    const f = new THREE.Vector3().subVectors(v.look, v.pos).normalize();
    sway = { pos: v.pos.clone(), look: v.look.clone(), right: new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize(), up: new THREE.Vector3(0, 1, 0),
      cur: new THREE.Vector2(), want: new THREE.Vector2(), amp: v.pos.distanceTo(v.look) * amp };
  };
  // between the wide view of the room and the screen up close
  const view = async (on) => {
    if (!views || on === close) return;
    close = on; ui.onView(on);
    const from = { pos: camera.position.clone(), look: sway ? sway.look.clone() : R.look.clone() }, to = on ? views.close() : views.wide;
    sway = null;
    await fly([from.pos, to.pos], [from.look, to.look], 1.1);
    settle(to, on ? 0.02 : 0.06);
  };
  ui.canvas.addEventListener('pointermove', move);

  (async () => {
    ui.status('Loading campus');
    const [campus, rm] = await Promise.all([campusP || (campusP = buildCampus()), loadRoom(tour.place)]);
    if (!alive) return;
    // the screen starts now, so it's already running when we walk in
    screen = makeScreen(tour.visual, rm.canvas.width, rm.canvas.height); sctx = rm.canvas.getContext('2d');
    ui.onScreen(screen);
    // ---- out of the tunnel, over campus ----
    const b = campus.highlight(place.building);
    campus.glowOn = 0; pass.scene = campus.scene;
    const C = b.center, H = Math.max(10, b.height);
    const off = new THREE.Vector3(0.55, 0, 0.83).normalize();
    const overview = CAMPUS_HOME.clone().add(new THREE.Vector3(260, 520, 640)), near = C.clone().addScaledVector(off, 150).setY(80);
    camera.position.copy(overview); R.look.copy(CAMPUS_HOME); camera.lookAt(R.look);
    campus.hold(C);
    frame((t) => campus.update(t));
    ui.status('');
    await ui.reveal();
    if (!alive) return;
    campus.scan(C, reduce || skipping ? 0.01 : 2.8);
    ui.label(place.building, b.name);
    await fly([overview, CAMPUS_HOME.clone().lerp(C, 0.5).add(new THREE.Vector3(200, 320, 380)), near], [CAMPUS_HOME, C.clone().setY(H * 0.5)], 2.6,
      (k) => { campus.glowOn = Math.min(1, k * 1.6); });
    await wait(0.4);
    // ---- up to the wall, and through ----
    const wall = facade(b, off), y = Math.min(H * 0.45, 14);
    const door = C.clone().addScaledVector(off, wall + 22).setY(y), edge = C.clone().addScaledVector(off, wall + 3.5).setY(y);
    const aim = C.clone().setY(y * 0.9);
    await fly([near, door], [C.clone().setY(H * 0.5), aim], 1.3);
    const push = fly([door, edge], [aim, aim], 1.0);
    await wait(0.45);
    await ui.cross.cover(); await push;
    if (!alive) return;
    // ---- the room: its name, then walk up to the screen ----
    room = rm; ui.label(place.building, place.name);
    pass.scene = room.scene;
    camera.position.copy(room.start); R.look.copy(room.room.look); camera.lookAt(R.look);
    frame(() => {});
    ui.title(place, b.name);
    await ui.cross.reveal();
    const portrait = ui.canvas.clientWidth < ui.canvas.clientHeight * 0.9;
    const end = framing(room, portrait);
    await fly([room.start, ...room.room.via(room.S), end.pos], [room.room.look, end.look], 3.2);
    if (!alive) return;
    views = {
      wide: end,
      close() {                       // square on to the screen, which fills the side of the view the text isn't on
        const Rm = room.room, w = ui.canvas.clientWidth, h = ui.canvas.clientHeight, aspect = w / h, tn = Math.tan((50 * Math.PI) / 360);
        const port = aspect < 0.9, f = Rm.screen.facing, up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(f.clone().negate(), up).normalize();
        const fillW = port ? 0.94 : Rm.closeFill || 0.66, fillH = port ? 0.42 : 0.8;
        const d = Math.max(Rm.screen.w / (fillW * 2 * tn * aspect), Rm.screen.h / (fillH * 2 * tn));
        // landscape: slide sideways so the screen sits right of the text; portrait: tilt down so it sits above it
        const look = room.S.clone();
        if (!port) look.addScaledVector(right, -(Rm.closeShift ?? 0.295) * d * tn * aspect);
        const pos = look.clone().addScaledVector(f, d);
        if (port) look.addScaledVector(up, -0.27 * 2 * d * tn);
        if (Rm.closeLift) { pos.addScaledVector(up, Rm.closeLift * d); }
        return { pos, look };
      },
    };
    await wait(0.5);
    close = false; await view(true);
    if (!alive) return;
    ui.onArrive(screen);
  })().catch((err) => { console.error(err); if (alive) ui.onArrive(null); });

  return {
    skip() { skipping = true; },
    view,
    stop() { alive = false; cancelAnimationFrame(raf); ui.canvas.removeEventListener('pointermove', move); },
  };
}
