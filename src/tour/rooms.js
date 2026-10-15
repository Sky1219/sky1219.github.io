// The four rooms, modelled in Blender (public/rooms/*.glb; the .blend is in assets/). Each GLB carries empties:
// cam_start (where we walk in) and screen_target (the centre of the screen the explanation plays on). Here each
// room gets its lighting, its people made of light, me (the orange one), and a live canvas over its screen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeCrowd, makeAvatar, makePerson } from './people.js';
import { lerp } from '../screens/kit.js';
import ATRIUM_SEATS from './atrium-seats.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export const ROOMS = {
  // the CARAML lab: the computer at the back left, which faces into the room (+x)
  lab: {
    file: 'rooms/lab.glb', screen: { w: 0.6, h: 0.355, facing: V(1, 0, 0) }, look: V(0, 1.2, -4.5),
    via: (S) => [V(-0.3, 1.6, 0.6), V(-0.9, 1.5, -1.6)],
    // stepped back: the computer, and me beside it
    final: { at: (S) => ({ pos: S.clone().add(V(4.3, 0.85, 0.75)), look: S.clone().add(V(0.6, 0.2, -0.3)) }), dist: 1.42, up: 0.24 }, orbit: 0.55,
    people: () => [],
    board: { w: 2.0, h: 1.1, facing: V(-1, 0, 0) },       // the whiteboard on the right wall (board_target in the GLB)
    // the two who were in when the photo the room is modelled on was taken, modelled after it: one writing code
    // at the desk under the posters, one working something out on the whiteboard
    figures: [
      { file: 'rooms/labmates.glb', prefix: 'p1_', pos: V(1.5, 0, -3.3), yaw: Math.PI, kind: 'type', seed: 0.3 },
      { file: 'rooms/labmates.glb', prefix: 'p2_', pos: V(2.52, 0, -1.45), yaw: Math.PI / 2, kind: 'write', seed: 0.7 },
    ],
    me: { pos: V(-2.15, 0, -3.72), yaw: 0.75, turn: -1, kind: 'present' },        // up from his chair, showing you his screen
    motes: { x: [-3, 3], y: [0.3, 2.8], z: [-4.3, 4.3] },
    pulse: [['m_lab_screen_code', (t) => 0.95 + 0.08 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 17)]],
    light(scene) {
      scene.background = new THREE.Color(0x0c0f0c);
      scene.add(new THREE.HemisphereLight(0xfff1dc, 0x221f1c, 0.75));
      const d = new THREE.DirectionalLight(0xfff4e6, 0.6); d.position.set(2, 3, 2); scene.add(d);
      for (const [x, z] of [[-1.4, -2.6], [1.4, -2.6], [-1.4, 0], [1.4, 0], [-1.4, 2.6], [1.4, 2.6]]) { const p = new THREE.PointLight(0xffeedd, 1.4, 7, 1.6); p.position.set(x, 2.8, z); scene.add(p); }
    },
  },
  // the ECSS lecture hall: the projector screen on the front wall, an audience, me at the lectern
  hall: {
    file: 'rooms/hall.glb', screen: { w: 8.0, h: 4.5, facing: V(0, 0, 1) }, look: V(0, 3.4, -10),
    via: (S) => [V(2.5, 5.2, 6.0), V(1.0, 4.6, 3.5)],
    final: { dist: 11.4, up: 0.7, shift: 2.6 }, orbit: 0.8,
    people() {                                             // about half the seats taken, everyone facing the screen
      const out = [];
      for (let i = 0; i < 11; i++) for (const [x0, x1] of [[-6.6, -1.1], [1.1, 6.6]]) {
        const ln = x1 - x0, n = Math.floor(ln / 0.6);
        for (let k = 0; k < n; k++) if (rand() < 0.55) out.push({ pos: V(x0 + 0.3 + k * (ln - 0.6) / (n - 1), 0.32 * (i + 1), i - 3.0 + 0.12), yaw: Math.PI, kind: 'listen' });
      }
      return out;
    },
    me: { pos: V(3.3, 0, -7.0), yaw: -0.25, turn: -1 },
    light(scene) {
      scene.background = new THREE.Color(0x0a0b0e);
      scene.add(new THREE.HemisphereLight(0xfff0e0, 0x16141a, 0.5));
      const d = new THREE.DirectionalLight(0xffffff, 0.35); d.position.set(-3, 6, 4); scene.add(d);
      for (const x of [-5, 5]) for (const z of [-7.5, -3, 2, 7]) { const p = new THREE.PointLight(0xffeedd, 3, 10, 1.6); p.position.set(x, 6.6, z); scene.add(p); }
    },
  },
  // ECSW during HackUTD: hackers at every table, me on the stage under the big screen
  ecsw: {
    file: 'rooms/atrium.glb', screen: { w: 12.8, h: 7.2, facing: V(0, 0, 1) }, look: V(0, 5, -18),
    via: (S) => [V(-5, 7.5, 6), V(-2, 6.4, 3.0)],
    final: { dist: 19.5, up: 0.4, shift: 6.2 }, orbit: 0.9,
    hide: /^m_atr_(shirt|skin)/,                          // the placeholder people modelled in Blender
    people: () => ATRIUM_SEATS.map(([x, z, side]) => ({ pos: V(x, 0, z), yaw: side > 0 ? 0 : Math.PI, kind: 'type' }))
      .concat([[-7, -16], [-3.5, -15.5], [8, 2], [-12, -9], [12, -4]].map(([x, z]) => ({ pos: V(x, 0, z), yaw: rand() * 6.28, kind: 'stand' }))),
    me: { pos: V(4.2, 0.9, -13.6), yaw: -0.35, turn: -1 },
    light(scene) {
      scene.background = new THREE.Color(0x07080c);
      scene.fog = new THREE.Fog(0x07080c, 30, 70);
      scene.add(new THREE.HemisphereLight(0xc9c2ff, 0x101018, 0.3));
      for (const [x, z, c] of [[-10, 5, 0x8a4dff], [10, 5, 0x2ee6ff], [0, -10, 0xff7a2e], [0, 10, 0xffe7c9], [-10, -8, 0xffd9b0], [10, -8, 0xffd9b0]]) { const p = new THREE.PointLight(c, 14, 28, 1.6); p.position.set(x, 9, z); scene.add(p); }
    },
  },
  // my bedroom in Canyon Creek Heights South (tools/build_apartment.py): the desk runs along the right wall,
  // across from the bed, with the monitor at its far end (facing -x) and me at the laptop nearer the door
  home: {
    file: 'rooms/apartment.glb', screen: { w: 0.6, h: 0.355, facing: V(-1, 0, 0) }, look: V(1.3, 1.0, -1.2), exposure: 0.62,
    via: (S) => [V(-1.0, 1.5, 0.9), V(-1.05, 1.58, -0.1)],      // in along the bed, looking at the desk
    // stepped back over the bed by the window: the screen on the left, me at the laptop on the right
    final: { at: (S) => ({ pos: S.clone().add(V(-2.3, 0.5, 0.35)), look: S.clone().add(V(0.2, -0.3, 0.4)) }), dist: 1.5, up: 0.25 }, orbit: 0.3,
    people: () => [],
    me: { pos: V(0.95, 0, -0.1), yaw: Math.PI / 2, turn: 1, kind: 'type' },
    motes: { x: [-1.6, 1.6], y: [0.3, 2.5], z: [-1.8, 1.8] },
    // the tower's strip pulses and the bedside lamp flickers a little
    pulse: [['m_apt_rgb', (t) => 2.4 + 1.6 * Math.sin(t * 2.4)], ['m_apt_lamp', (t) => 1.1 + 0.08 * Math.sin(t * 9)]],
    light(scene) {
      scene.background = new THREE.Color(0x0a0908);
      scene.add(new THREE.HemisphereLight(0xffe2c4, 0x1a1410, 0.18));
      const lamp = new THREE.PointLight(0xffb070, 1.0, 4, 1.8); lamp.position.set(1.45, 1.2, -1.45); scene.add(lamp);       // the desk lamp
      const glow = new THREE.PointLight(0x8fc8ff, 0.5, 3, 1.8); glow.position.set(1.1, 1.15, -1.1); scene.add(glow);        // the monitor
      const ceiling = new THREE.PointLight(0xfff0dd, 0.5, 6, 1.8); ceiling.position.set(0, 2.45, 0); scene.add(ceiling);
      const moon = new THREE.DirectionalLight(0x6a86c8, 0.2); moon.position.set(-0.5, 2.0, -3); scene.add(moon);            // through the blinds
    },
  },
};

// What's on the lab's whiteboard: why greedy selection gets within (1 - 1/e) of the best subset, in marker.
// Each line is runs of [text, level] (-1 a subscript, 1 a superscript); the last one stops where his hand is.
const BOARD_LINES = [
  { runs: [['f(S*) ≤ f(S', 0], ['i', -1], [') + k·( f(S', 0], ['i+1', -1], [') − f(S', 0], ['i', -1], [') )', 0]] },
  { runs: [['δ', 0], ['i+1', -1], [' ≤ (1 − 1/k)·δ', 0], ['i', -1]] },
  { runs: [['f(S*) − f(S', 0], ['k', -1], [') ≤ (1 − 1/k)', 0], ['k', 1], ['·f(S*)', 0]] },
  { runs: [['⇒  f(S', 0], ['k', -1], [') ≥ (1 − 1/e)·f(S*)', 0]], end: 0.82 },
];
function boardTexture(w, h) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
  const ctx = cv.getContext('2d'), size = 42, font = (lvl) => `${lvl ? size * 0.6 : size}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
  const width = (runs) => runs.reduce((a, [s, lvl]) => { ctx.font = font(lvl); return a + ctx.measureText(s).width; }, 0);
  ctx.fillStyle = '#16255e'; ctx.textBaseline = 'alphabetic';
  BOARD_LINES.forEach(({ runs, end }, i) => {
    const x0 = 0.05 * cv.width, wd = width(runs), k = Math.min(1, ((end || 0.95) * cv.width - x0) / wd);
    ctx.save(); ctx.translate(end ? end * cv.width - wd * k : x0, (0.17 + i * 0.14) * cv.height); ctx.rotate((i % 2 ? 1 : -1) * 0.008); ctx.scale(k, k);
    let x = 0;
    for (const [s, lvl] of runs) { ctx.font = font(lvl); ctx.fillText(s, x, -lvl * size * (lvl > 0 ? 0.45 : 0.22)); x += ctx.measureText(s).width; }
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

// dust: a few hundred points drifting up through the room, catching the light
function makeMotes({ x, y, z }, n = 220) {
  const pos = new Float32Array(n * 3), seeds = Array.from({ length: n }, () => [rand(), rand(), rand(), rand()]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.15, 0.85), size: 0.014, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  points.frustumCulled = false;
  const update = (t) => {
    seeds.forEach(([a, b, c, d], i) => {
      pos[i * 3] = lerp(x[0], x[1], a) + Math.sin(t * 0.13 + d * 6.28) * 0.2;
      pos[i * 3 + 1] = lerp(y[0], y[1], (b + t * 0.006 * (0.5 + d)) % 1);
      pos[i * 3 + 2] = lerp(z[0], z[1], c) + Math.cos(t * 0.11 + a * 6.28) * 0.2;
    });
    g.attributes.position.needsUpdate = true;
  };
  update(0);
  return { points, update };
}

const cache = new Map();
export function loadRoom(id) {
  if (!cache.has(id)) {
    const R = ROOMS[id];
    cache.set(id, new GLTFLoader().loadAsync(R.file).then(async (g) => {
      const scene = new THREE.Scene(); scene.add(g.scene); R.light(scene);
      if (R.hide) g.scene.traverse((o) => { if (R.hide.test(o.name)) o.visible = false; });
      g.scene.updateMatrixWorld(true);
      const find = (prefix) => { let o = null; g.scene.traverse((n) => { if (!o && n.name.startsWith(prefix)) o = n; }); return o; };
      const start = find('cam_start').getWorldPosition(new THREE.Vector3());
      const S = find('screen_target').getWorldPosition(new THREE.Vector3());
      // the canvas the game draws into, laid over the screen
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * R.screen.h / R.screen.w);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(R.screen.w, R.screen.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      plane.position.copy(S).addScaledVector(R.screen.facing, R.screen.w * 0.004 + 0.004);
      plane.lookAt(plane.position.clone().add(R.screen.facing));
      scene.add(plane);
      const B = R.board && find('board_target');
      if (B) {                                             // the writing, over the board's own white
        const bp = new THREE.Mesh(new THREE.PlaneGeometry(R.board.w, R.board.h), new THREE.MeshBasicMaterial({ map: boardTexture(R.board.w, R.board.h), transparent: true, depthWrite: false, toneMapped: false }));
        bp.position.copy(B.getWorldPosition(new THREE.Vector3())).addScaledVector(R.board.facing, 0.004);
        bp.lookAt(bp.position.clone().add(R.board.facing));
        scene.add(bp);
      }
      const crowd = makeCrowd(R.people()); scene.add(crowd.group);
      // dust drifting in the light, and the things in the room that pulse (named meshes whose emission follows a curve)
      const motes = R.motes ? makeMotes(R.motes) : null; if (motes) scene.add(motes.points);
      const pulse = (R.pulse || []).map(([name, fn]) => { let o = null; g.scene.traverse((n) => { if (!o && n.isMesh && n.name.startsWith(name)) o = n; }); return o && [o.material, fn]; }).filter(Boolean);
      const me = await makeAvatar(R.me.pos, R.me.yaw, R.me.turn, R.me.kind); scene.add(me.group);
      const figures = await Promise.all((R.figures || []).map(makePerson)); for (const f of figures) scene.add(f.group);
      return { scene, start, S, plane, canvas: cv, tex, room: R, update: (t) => { crowd.update(t); me.update(t); for (const f of figures) f.update(t); if (motes) motes.update(t); for (const [m, fn] of pulse) m.emissiveIntensity = fn(t); } };
    }));
  }
  return cache.get(id);
}

// where the camera ends up: square on to the screen, aimed a little to one side so the text has room
export function framing(room, portrait) {
  const R = room.room, f = R.screen.facing, up = V(0, 1, 0), right = new THREE.Vector3().crossVectors(f.clone().negate(), up).normalize();
  if (R.final.at && !portrait) return R.final.at(room.S);
  const k = portrait ? 1.35 : 1;
  const pos = room.S.clone().addScaledVector(f, R.final.dist * k).addScaledVector(up, R.final.up);
  const look = portrait ? room.S.clone().addScaledVector(up, -R.screen.h * 0.55) : room.S.clone().addScaledVector(right, -R.final.shift);
  return { pos, look };
}
