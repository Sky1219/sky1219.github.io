// The three rooms, modelled in Blender (public/rooms/*.glb; the .blend is in assets/). Each GLB carries empties:
// cam_start (where we walk in) and screen_target (the centre of the screen the explanation plays on). Here each
// room gets its lighting, its people made of light, me (the orange one), and a live canvas over its screen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeCrowd, makeAvatar } from './people.js';
import ATRIUM_SEATS from './atrium-seats.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export const ROOMS = {
  // the CARAML lab: the computer at the back left, which faces into the room (+x)
  lab: {
    file: 'rooms/lab.glb', screen: { w: 0.6, h: 0.355, facing: V(1, 0, 0) }, look: V(0, 1.2, -4.5),
    via: (S) => [V(-0.3, 1.6, 0.6), V(-0.9, 1.5, -1.6)],
    // stepped back: the computer, and me beside it
    final: { at: (S) => ({ pos: S.clone().add(V(4.3, 0.85, 0.75)), look: S.clone().add(V(0.6, 0.2, -0.3)) }), dist: 1.42, up: 0.24, shift: 0.42 },
    people: () => [
      { pos: V(2.12, 0, -3.0), yaw: Math.PI / 2, kind: 'type' },
      { pos: V(2.12, 0, -0.25), yaw: Math.PI / 2, kind: 'type' },
      { pos: V(-2.12, 0, -0.25), yaw: -Math.PI / 2, kind: 'type' },
      { pos: V(0.95, 0, 1.0), yaw: -2.4, kind: 'stand' },
    ],
    me: { pos: V(-2.15, 0, -3.72), yaw: 0.75, turn: -1, kind: 'present' },        // up from his chair, showing you his screen
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
    final: { dist: 11.4, up: 0.7, shift: 2.6 },
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
    final: { dist: 19.5, up: 0.4, shift: 6.2 },
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
};

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
      const crowd = makeCrowd(R.people()); scene.add(crowd.group);
      const me = await makeAvatar(R.me.pos, R.me.yaw, R.me.turn, R.me.kind); scene.add(me.group);
      return { scene, start, S, plane, canvas: cv, tex, room: R, update: (t) => { crowd.update(t); me.update(t); } };
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
