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
const UP = new THREE.Vector3(0, 1, 0), ORBIT = new THREE.Vector3(), AXIS = new THREE.Vector3();   // scratch for the orbit, every frame

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

/* Run one tour. ui = { canvas, label, status, onScreen(screen), onArrive(screen), onView(close), reveal(), cross: { cover(), reveal() }, title(), quick }.
   quick: straight to the room (the flight is for the first visit). Returns { skip(), stop(), view(close) }. */
export function runTour(tour, ui) {
  R = R || setup(ui.canvas);
  const { camera, composer, pass } = R;
  const place = PLACES[tour.place];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alive = true, raf = 0, skipping = !!ui.quick, room = null, screen = null, sctx = null, sway = null, views = null, close = false;
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
      if (sway) {                                          // once settled, the view drifts a little with the pointer, and a drag walks round
        sway.cur.lerp(sway.want, Math.min(1, dt * 3));
        orbit.yaw += (orbit.wantYaw - orbit.yaw) * Math.min(1, dt * 8); orbit.pitch += (orbit.wantPitch - orbit.pitch) * Math.min(1, dt * 8);
        const v = ORBIT.copy(sway.off).applyAxisAngle(UP, orbit.yaw); v.applyAxisAngle(AXIS.crossVectors(UP, v).normalize(), orbit.pitch);
        camera.position.copy(sway.look).add(v).addScaledVector(sway.right, sway.cur.x).addScaledVector(UP, sway.cur.y);
        camera.position.y = Math.max(0.3, camera.position.y); camera.lookAt(sway.look);
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

  // the pointer: a little drift as the mouse moves, and in the wide view a drag orbits the room
  const orbit = { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0 };
  let drag = null;
  const move = (e) => {
    if (drag) {                                        // how far round depends on the room: a bedroom has walls close by
      const lim = (room && room.room.orbit) || 0.6;
      orbit.wantYaw = Math.max(-lim, Math.min(lim, drag.yaw - (e.clientX - drag.x) * 0.0025)); orbit.wantPitch = Math.max(-0.25, Math.min(0.45, drag.pitch - (e.clientY - drag.y) * 0.002)); return;
    }
    if (sway && e.pointerType === 'mouse') { const r = ui.canvas.getBoundingClientRect(); sway.want.set(((e.clientX - r.left) / r.width - 0.5) * sway.amp, -((e.clientY - r.top) / r.height - 0.5) * sway.amp * 0.6); }
  };
  const down = (e) => { if (!sway || close || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, yaw: orbit.wantYaw, pitch: orbit.wantPitch }; ui.canvas.setPointerCapture(e.pointerId); ui.canvas.style.cursor = 'grabbing'; };
  const lift = () => { if (!drag) return; drag = null; ui.canvas.style.cursor = close ? '' : 'grab'; };
  const settle = (v, amp) => {
    const f = new THREE.Vector3().subVectors(v.look, v.pos).normalize();
    sway = { look: v.look.clone(), off: new THREE.Vector3().subVectors(v.pos, v.look), right: new THREE.Vector3().crossVectors(f, UP).normalize(),
      cur: new THREE.Vector2(), want: new THREE.Vector2(), amp: v.pos.distanceTo(v.look) * amp };
    orbit.yaw = orbit.pitch = orbit.wantYaw = orbit.wantPitch = 0;
    ui.canvas.style.cursor = close ? '' : 'grab';
    ui.hud?.(close ? '' : 'DRAG TO LOOK ROUND THE ROOM');
  };
  // between the wide view of the room and the screen up close
  const view = async (on) => {
    if (!views || on === close) return;
    close = on; ui.onView(on);
    const from = { pos: camera.position.clone(), look: sway ? sway.look.clone() : R.look.clone() }, to = on ? views.close() : views.wide;
    sway = null;
    await fly([from.pos, to.pos], [from.look, to.look], 0.9);
    settle(to, on ? 0.02 : 0.06);
  };
  ui.canvas.addEventListener('pointermove', move); ui.canvas.addEventListener('pointerdown', down);
  ui.canvas.addEventListener('pointerup', lift); ui.canvas.addEventListener('pointercancel', lift);

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
    const O = campus.origin, KX = 111320 * Math.cos((32.9872 * Math.PI) / 180);
    let shown = '';
    const hud = () => {                                   // the readout along the bottom: where we are over campus (written only when it changes)
      const p = camera.position, d = Math.hypot(p.x - C.x, p.z - C.z), brg = ((Math.atan2(C.x - p.x, -(C.z - p.z)) * 180) / Math.PI + 360) % 360;
      const s = `${(O[1] - p.z / 110540).toFixed(4)} N  ${(-(O[0] + p.x / KX)).toFixed(4)} W   ALT ${Math.max(0, p.y).toFixed(0).padStart(3)} m   ${place.building} ${d.toFixed(0).padStart(4)} m  BRG ${brg.toFixed(0).padStart(3)}°`;
      if (s !== shown) ui.hud?.((shown = s));
    };
    frame((t) => { campus.update(t); hud(); });
    ui.status('');
    await ui.reveal();
    if (!alive) return;
    campus.scan(C, reduce || skipping ? 0.01 : 2.8);
    ui.label(place.building, b.name);
    await fly([overview, CAMPUS_HOME.clone().lerp(C, 0.5).add(new THREE.Vector3(200, 320, 380)), near], [CAMPUS_HOME, C.clone().setY(H * 0.5)], 1.8,
      (k) => { campus.glowOn = Math.min(1, k * 1.6); });
    await wait(0.15);
    // ---- up to the wall, and through ----
    const wall = facade(b, off), y = Math.min(H * 0.45, 14);
    const door = C.clone().addScaledVector(off, wall + 22).setY(y), edge = C.clone().addScaledVector(off, wall + 3.5).setY(y);
    const aim = C.clone().setY(y * 0.9);
    await fly([near, door], [C.clone().setY(H * 0.5), aim], 0.9);
    const push = fly([door, edge], [aim, aim], 0.7);
    await wait(0.25);
    await ui.cross.cover(); await push;
    if (!alive) return;
    // ---- the room: its name, then walk up to the screen ----
    room = rm; ui.label(place.building, place.name); ui.hud?.('');
    pass.scene = room.scene;
    camera.position.copy(room.start); R.look.copy(room.room.look); camera.lookAt(R.look);
    frame(() => {});
    ui.title(place, b.name);
    await ui.cross.reveal();
    const portrait = ui.canvas.clientWidth < ui.canvas.clientHeight * 0.9;
    const end = framing(room, portrait);
    await fly([room.start, ...room.room.via(room.S), end.pos], [room.room.look, end.look], 2.0);
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
    await wait(0.2);
    close = false; await view(true);
    if (!alive) return;
    ui.onArrive(screen);
  })().catch((err) => { console.error(err); if (alive) ui.onArrive(null); });

  return {
    skip() { skipping = true; },
    view,
    stop() {
      alive = false; cancelAnimationFrame(raf); ui.canvas.style.cursor = '';
      ui.canvas.removeEventListener('pointermove', move); ui.canvas.removeEventListener('pointerdown', down); ui.canvas.removeEventListener('pointerup', lift); ui.canvas.removeEventListener('pointercancel', lift);
    },
  };
}
