// People made of light: chunky block figures that glow (bloom does the halo). A crowd is drawn with one
// InstancedMesh per body part, posed every frame from a small rig, so a hundred people cost a dozen draw calls.
// Poses: 'type' (seated at a keyboard), 'phone' (leaning back, on a phone), 'listen' (seated, hands in lap),
// 'stand', 'write' (standing at a board, writing), 'present' (standing, pointing at something now and then),
// 'wave' (standing, waving hello; the page's intro).
// The avatar (me) is the same build in warm orange light.
import * as THREE from 'three';

const PARTS = {                    // size [w, h, d] of each block, in metres
  head: [0.27, 0.27, 0.27], torso: [0.42, 0.5, 0.25], hips: [0.38, 0.16, 0.23],
  uarmL: [0.13, 0.3, 0.13], uarmR: [0.13, 0.3, 0.13], farmL: [0.12, 0.3, 0.12], farmR: [0.12, 0.3, 0.12],
  thighL: [0.16, 0.4, 0.17], thighR: [0.16, 0.4, 0.17], shinL: [0.15, 0.38, 0.16], shinR: [0.15, 0.38, 0.16],
  footL: [0.16, 0.09, 0.26], footR: [0.16, 0.09, 0.26],
};
const NAMES = Object.keys(PARTS);

const VS = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vP = position;
  gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FS = /* glsl */`
uniform vec3 uColor; uniform vec3 uEdge; uniform vec3 uHalf; varying vec3 vN; varying vec3 vP;
void main(){
  float l = 0.68 + 0.3 * max(vN.y, 0.0) + 0.1 * abs(vN.x);
  // brighter edges so each block reads on its own
  vec3 a = abs(vP) / uHalf; float e = smoothstep(0.82, 1.0, max(max(min(a.x, a.y), min(a.y, a.z)), min(a.x, a.z)));
  gl_FragColor = vec4(uColor * l + uEdge * e, 1.0);
}`;

// a rig: joints as nested groups, each body part a marker object whose world matrix we read
function makeRig() {
  const root = new THREE.Group(), pelvis = new THREE.Group(); root.add(pelvis);
  const mark = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; };
  const j = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  pelvis.position.y = 0.9;
  mark('hips', pelvis, 0, 0.02, 0);
  const chest = j(pelvis, 0, 0.1, 0); mark('torso', chest, 0, 0.26, 0);
  const neck = j(chest, 0, 0.52, 0); mark('head', neck, 0, 0.15, 0);
  const side = (s, L) => {
    const sh = j(chest, s * 0.28, 0.46, 0); mark(`uarm${L}`, sh, 0, -0.14, 0);
    const el = j(sh, 0, -0.29, 0); mark(`farm${L}`, el, 0, -0.14, 0);
    const hip = j(pelvis, s * 0.1, -0.06, 0); mark(`thigh${L}`, hip, 0, -0.2, 0);
    const kn = j(hip, 0, -0.4, 0); mark(`shin${L}`, kn, 0, -0.19, 0);
    const an = j(kn, 0, -0.38, 0); mark(`foot${L}`, an, 0, -0.02, 0.05);
    return { sh, el, hip, kn, an };
  };
  const L = side(1, 'L'), R = side(-1, 'R');
  const marks = {}; root.traverse((o) => { if (PARTS[o.name]) marks[o.name] = o; });
  return { root, pelvis, chest, neck, L, R, marks };
}

function pose(rig, kind, t, seed, turn = 1) {
  const { pelvis, chest, neck, L, R } = rig, s = seed * 6.28;
  for (const g of [chest, neck, L.sh, L.el, L.hip, L.kn, L.an, R.sh, R.el, R.hip, R.kn, R.an]) g.rotation.set(0, 0, 0);
  const sitting = kind === 'type' || kind === 'listen';
  pelvis.position.y = sitting ? 0.52 : 0.9;
  if (sitting) {
    for (const leg of [L, R]) { leg.hip.rotation.x = -Math.PI / 2; leg.kn.rotation.x = Math.PI / 2; }
    chest.rotation.x = kind === 'type' ? 0.12 : -0.05;
  }
  if (kind === 'type') {
    for (const [arm, k] of [[L, 0], [R, 1]]) {
      arm.sh.rotation.x = -0.55; arm.el.rotation.x = -1.0 + Math.sin(t * 9 + s + k * 2.1) * 0.08;
    }
    neck.rotation.y = Math.sin(t * 0.4 + s) * 0.12; neck.rotation.x = 0.15;
  } else if (kind === 'phone') {                           // leaning back in the chair, legs out, scrolling
    pelvis.position.y = 0.52; chest.rotation.x = -0.3;
    for (const leg of [L, R]) { leg.hip.rotation.x = -1.2; leg.kn.rotation.x = 0.35; leg.an.rotation.x = 0.5; }
    R.hip.rotation.y = -0.12; L.hip.rotation.y = 0.1;
    for (const [arm, k] of [[L, 1], [R, -1]]) { arm.sh.rotation.x = -0.25; arm.sh.rotation.z = -0.38 * k; arm.el.rotation.x = -1.7 + Math.sin(t * 5 + s + k) * 0.03; }
    neck.rotation.x = 0.55 + Math.sin(t * 0.35 + s) * 0.04; neck.rotation.y = Math.sin(t * 0.2 + s) * 0.06;
  } else if (kind === 'listen') {
    for (const arm of [L, R]) { arm.sh.rotation.x = -0.35; arm.el.rotation.x = -0.9; }
    neck.rotation.y = Math.sin(t * 0.25 + s) * 0.25; neck.rotation.x = Math.sin(t * 0.3 + s * 2) * 0.05;
  } else if (kind === 'wave') {                            // hello: right arm up and out, the forearm swinging
    R.sh.rotation.z = -2.5 + Math.sin(t * 1.3) * 0.05; R.el.rotation.z = -0.35 + Math.sin(t * 7) * 0.4;
    L.sh.rotation.z = 0.1; L.el.rotation.x = -0.2;
    neck.rotation.z = Math.sin(t * 1.1) * 0.06; neck.rotation.y = 0.15; chest.rotation.z = Math.sin(t * 1.3) * 0.03;
  } else if (kind === 'stand') {
    chest.rotation.z = Math.sin(t * 0.8 + s) * 0.02; L.sh.rotation.z = 0.08; R.sh.rotation.z = -0.08;
    neck.rotation.y = Math.sin(t * 0.3 + s) * 0.3;
  } else if (kind === 'write') {                           // at the board, marker up in his right hand, working down a line
    R.sh.rotation.x = -1.2 + Math.sin(t * 0.5 + s) * 0.08; R.sh.rotation.z = Math.sin(t * 0.9 + s) * 0.06; R.el.rotation.x = -0.9 + Math.sin(t * 7 + s) * 0.05;
    L.sh.rotation.x = 0.05; L.el.rotation.x = -0.15;
    neck.rotation.x = -0.1; neck.rotation.y = Math.sin(t * 0.3 + s) * 0.1; chest.rotation.z = Math.sin(t * 0.7 + s) * 0.012;
  } else if (kind === 'present') {                         // turns to the screen and points, then back to you
    const cyc = (t * 0.22 + seed) % 1, point = cyc < 0.45 ? Math.sin(Math.min(1, cyc / 0.45) * Math.PI) : 0;
    const P = turn > 0 ? L : R, O = turn > 0 ? R : L;      // turn: +1 if the screen is to his left (+x), -1 to his right
    chest.rotation.y = 0.55 * turn * point; neck.rotation.y = 0.4 * turn * point;
    P.sh.rotation.x = -1.3 * point; P.sh.rotation.z = 0.3 * turn * point; P.el.rotation.x = -0.15 * point;
    O.sh.rotation.x = -0.4; O.el.rotation.x = -0.9 + Math.sin(t * 2.2) * 0.12 * (1 - point);   // talks with his hands
    chest.rotation.z = Math.sin(t * 1.1) * 0.025;
  }
}

/* people: [{ pos: Vector3 (feet), yaw (radians, 0 faces +z), kind, seed }]. color: THREE.Color (linear, can exceed 1) */
export function makeCrowd(people, color = new THREE.Color(0.72, 0.88, 0.98), edge = new THREE.Color(0.25, 0.75, 1.1)) {
  const group = new THREE.Group();
  const meshes = {};
  for (const n of NAMES) {
    const [w, h, d] = PARTS[n];
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, toneMapped: false,
      uniforms: { uColor: { value: color }, uEdge: { value: edge }, uHalf: { value: new THREE.Vector3(w / 2, h / 2, d / 2) } },
    }), people.length);
    m.frustumCulled = false; group.add(m); meshes[n] = m;
  }
  const rig = makeRig(), tmp = new THREE.Matrix4();
  const update = (t) => {
    people.forEach((p, i) => {
      rig.root.position.copy(p.pos); rig.root.rotation.set(0, p.yaw, 0);
      pose(rig, p.kind, t, p.seed ?? i * 0.137, p.turn ?? 1);
      rig.root.updateMatrixWorld(true);
      for (const n of NAMES) { tmp.copy(rig.marks[n].matrixWorld); meshes[n].setMatrixAt(i, tmp); }
    });
    for (const n of NAMES) meshes[n].instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update, people };
}

// Modelled figures (Blender, one mesh per body part named after the rig's parts, so the same poses drive them),
// drawn as holograms: their own colours lit from inside, a bright rim, scanlines climbing through, glowing edges.
// Me (public/rooms/avatar.glb, source assets/avatar.blend) in orange light with sparks drifting up; the two
// labmates (public/rooms/labmates.glb, built by tools/build_labmates.py after the photo the lab is modelled on)
// in the same cool light as everyone else.
const HOLO = {                     // my colours (navy polo, dark trousers, glasses), lit from inside
  av_shirt: [0.09, 0.15, 0.55], av_pants: [0.05, 0.055, 0.1], av_skin: [0.62, 0.37, 0.23], av_hair: [0.04, 0.028, 0.024],
  av_glow: [2.2, 1.2, 0.45], av_shoe: [0.04, 0.04, 0.05], av_lens: [0.35, 0.55, 0.8],
};
const WARM = { rim: [1.5, 0.62, 0.18], sweep: [1.2, 0.7, 0.35], edge: [1.6, 0.7, 0.2], edgeOpacity: 0.75, sparks: true };
const COOL = { rim: [0.3, 0.75, 1.15], sweep: [0, 0, 0], edge: [0.3, 0.8, 1.2], edgeOpacity: 0.45, sparks: false };
const HVS = /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vV;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp; }`;
const HFS = /* glsl */`
uniform vec3 uColor; uniform vec3 uRim; uniform vec3 uSweep; uniform float uTime; uniform float uBase; varying vec3 vN; varying vec3 vW; varying vec3 vV;
void main(){
  vec3 n = normalize(vN), v = normalize(vV);
  float l = 0.62 + 0.3 * max(n.y, 0.0) + 0.12 * abs(n.x);
  float rim = pow(1.0 - abs(dot(n, v)), 2.2);
  float scan = 0.82 + 0.18 * sin((vW.y - uBase) * 140.0 - uTime * 6.0);
  float sweep = smoothstep(0.06, 0.0, abs(fract(uTime * 0.28) * 2.4 - 0.2 - (vW.y - uBase)));   // a bright band rising through
  vec3 c = uColor * l * scan + uRim * rim * 0.75 + uSweep * sweep * 0.7;
  gl_FragColor = vec4(c, 1.0);
}`;
const files = new Map();
const loadFigure = (file) => { if (!files.has(file)) files.set(file, import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(file))); return files.get(file); };

// parts are looked up as prefix + the rig's part name; colours come from `colors` by material name, or from the
// model's own materials
async function makeFigure(file, at, yaw, kind, { prefix = '', turn = 1, seed = 0.1, colors = null, style = COOL } = {}) {
  const gltf = await loadFigure(file);
  const group = new THREE.Group(), parts = {}, mats = [];
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(...style.edge), toneMapped: false, transparent: true, opacity: style.edgeOpacity });
  const colorOf = (m) => (colors ? new THREE.Color(...(colors[m.name] || colors.av_shirt)) : m.color.clone().multiplyScalar(/glow|lens/.test(m.name) ? 2.2 : 1.15));
  const matFor = (m) => { const sm = new THREE.ShaderMaterial({ vertexShader: HVS, fragmentShader: HFS, toneMapped: false,
    uniforms: { uColor: { value: colorOf(m) }, uRim: { value: new THREE.Color(...style.rim) }, uSweep: { value: new THREE.Color(...style.sweep) }, uTime: { value: 0 }, uBase: { value: at.y } } }); mats.push(sm); return sm; };
  for (const n of NAMES) {
    const src = gltf.scene.getObjectByName(prefix + n); if (!src) continue;
    const part = new THREE.Group(); part.matrixAutoUpdate = false;
    src.traverse((o) => {
      if (!o.isMesh) return;
      part.add(new THREE.Mesh(o.geometry, matFor(o.material)));
      part.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), edgeMat));
    });
    group.add(part); parts[n] = part;
  }
  if (!Object.keys(parts).length) throw new Error(`no figure "${prefix}" in ${file}`);
  let sparks = null, sp, sg, seeds, glow;
  if (style.sparks) {                                      // sparks drifting up around me
    const N = 40; sp = new Float32Array(N * 3); seeds = Array.from({ length: N }, () => [Math.random() * 6.28, 0.25 + Math.random() * 0.25, Math.random()]);
    sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(2.4, 1.2, 0.4), size: 0.025, toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }));
    sparks.frustumCulled = false; group.add(sparks);
    glow = new THREE.PointLight(0xff7a22, 0.8, 3, 1.8); group.add(glow);
  }
  const rig = makeRig();
  const update = (t) => {
    rig.root.position.copy(at); rig.root.rotation.set(0, yaw, 0);
    pose(rig, kind, t, seed, turn); rig.root.updateMatrixWorld(true);
    for (const n in parts) parts[n].matrix.copy(rig.marks[n].matrixWorld);
    for (const m of mats) m.uniforms.uTime.value = t;
    if (!sparks) return;
    const c = rig.marks.torso.getWorldPosition(new THREE.Vector3()); glow.position.copy(c).add(new THREE.Vector3(0, 0.2, 0));
    seeds.forEach(([a, r, o], i) => { const k = (t * 0.25 + o) % 1; sp[i * 3] = c.x + Math.cos(a + t * 0.5) * r; sp[i * 3 + 1] = at.y + k * 2.1; sp[i * 3 + 2] = c.z + Math.sin(a + t * 0.5) * r; });
    sg.attributes.position.needsUpdate = true;
  };
  update(0);
  return { group, update };
}

// me; falls back to the block build in orange if the model can't be loaded
export const makeAvatar = (at, yaw, turn = 1, kind = 'present') => makeFigure('rooms/avatar.glb', at, yaw, kind, { turn, colors: HOLO, style: WARM })
  .catch(() => makeCrowd([{ pos: at, yaw, kind, seed: 0.1, turn }], new THREE.Color(0.95, 0.4, 0.08), new THREE.Color(1.8, 0.7, 0.12)));

// someone modelled after a real person in the room: { file, prefix, pos, yaw, kind, seed }. Falls back to a block person.
export const makePerson = (p) => makeFigure(p.file, p.pos, p.yaw, p.kind, { prefix: p.prefix, seed: p.seed })
  .catch(() => makeCrowd([p]));
