// The way in, once a visit: a short film cut from models built in Blender (tools/build_intro.py ->
// public/intro/intro.glb), lit and bloomed in three.js, in the language of the HackUTD Zero Day intro (RGB split,
// tearing, scanlines) on the night palette. It ends by shattering off the page.
//   open        a cursor in the dark while the models load; signal, and the camera slides in close across a graphics
//               card's fans and fins as they spin up
//   INFERENCE   a GPU package turns in the middle of the frame while memory sticks streak past the lens, the card
//               behind them
//   RESEARCH    the camera flies through a neural network, its layers firing one after another, over an attention
//               pattern rising out of the floor as a city of columns
//   EFFICIENCY  a stopwatch, its hand racing, while a speed gauge swings past with its needle slamming to the top
//   finale      back to the card: its gold fingers light, everything in the air is pulled into its fan, the camera dives
//               in while my name decodes, and it breaks through with a flash onto the page
// Each shot dissolves into the next (a scan plane, the model breaking into pixels that rebuild the next), and its word
// slams onto the floor.
// three.js draws into a canvas off the page; each frame is copied onto the visible 2D canvas, where the words,
// tearing and scanlines go over it. A click, key, scroll or touch skips to the break-through. <head> decides whether
// it plays (html.intro-on, which also covers the page and holds the hero's entrance); run() resolves once it's gone.
// ?intro=2.5 holds it at 2.5 s, for checking a frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

// the film look, last in the chain: chromatic aberration toward the edges, a vignette, grain
const FILM = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, split: { value: 0.0015 }, grain: { value: 0.05 }, glitch: { value: 0 }, drain: { value: 0 },
    shock: { value: null }, shockR: { value: 0 }, shockA: { value: 0 }, aspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, split, grain, glitch, shockR, shockA, aspect, drain; uniform vec2 shock; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5; float r = length(d);
      // through a change, some bands of the frame slip sideways and break into blocks, as if the signal were rebuilding
      vec2 uv = vUv + vec2(0.0, (hash(vec2(floor(time * 0.4), 3.0)) - 0.5) * 0.0012); float band = floor(vUv.y * 30.0), tick = floor(time * 0.5);
      float hitb = step(hash(vec2(band, tick)), glitch * 0.22);
      if (hitb > 0.0) { uv.x += (hash(vec2(band, tick + 7.0)) - 0.5) * 0.08 * glitch; vec2 b = vec2(0.014, 0.024); uv = (floor(uv / b) + 0.5) * b; }
      // a shockwave: a ring that bends the frame outward as it passes, bright and split at its edge
      vec2 sd = (vUv - shock) * vec2(aspect, 1.0); float sl = length(sd) + 1e-5;
      float sw = exp(-pow((sl - shockR) * 14.0, 2.0)) * shockA;
      uv -= sd / sl / vec2(aspect, 1.0) * sw * 0.035;
      vec2 off = d * split * (1.0 + 6.0 * r * r) + vec2(0.004 * hitb * glitch, 0.0) + sd / sl * sw * 0.006;
      vec3 c = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      c += hitb * glitch * vec3(0.02, 0.06, 0.05) + sw * vec3(0.12, 0.1, 0.08);
      float lum = dot(c, vec3(0.299, 0.587, 0.114));                  // the grade: teal shadows, warm highlights
      c = mix(c, c * vec3(0.82, 1.04, 1.1) + vec3(0.0, 0.01, 0.014), (1.0 - smoothstep(0.0, 0.32, lum)) * 0.7);
      c = mix(c, c * vec3(1.1, 0.98, 0.86), smoothstep(0.45, 1.0, lum) * 0.55);
      c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))) * vec3(0.78, 1.0, 1.08) * 1.15, drain);   // bullet time: the colour drains cold
      c *= mix(1.0, 0.42, smoothstep(0.28, 0.85, r));                 // the vignette
      c += (hash(vUv * vec2(1920.0, 1080.0) + time) - 0.5) * grain;    // the grain
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// light shafts, after the tone mapping: the bright parts of the frame smeared out from a point behind the subject
const RAYS = {
  uniforms: { tDiffuse: { value: null }, light: { value: null }, strength: { value: 0.45 }, density: { value: 0.75 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 light; uniform float strength, density; varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb, acc = vec3(0.0);
      vec2 step = (vUv - light) * density / 48.0, uv = vUv; float decay = 1.0;
      for (int i = 0; i < 48; i++) { uv -= step; vec3 s = texture2D(tDiffuse, uv).rgb; acc += max(s - 0.55, 0.0) * decay; decay *= 0.955; }
      gl_FragColor = vec4(base + acc * strength / 12.0 * vec3(1.0, 0.82, 0.62), 1.0);
    }`,
};

const ORANGE = '255, 138, 61', CYAN = '95, 209, 190', PINK = '255, 0, 94', WHITE = '255, 244, 232';
const FONT = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';
// the cut: when each shot starts, and the finale's beats
const CUTS = [0, 1.2, 2.35, 3.6, 4.85];                  // open, INFERENCE, RESEARCH, EFFICIENCY, finale
const SHOTS = ['open', 'inference', 'research', 'efficiency', 'finale'];
const WORDS = { inference: 'INFERENCE', research: 'RESEARCH', efficiency: 'EFFICIENCY' };
const FIN = CUTS[4], SUCK = FIN + 0.9, DIVE = FIN + 1.3, BREAK = FIN + 2.55, END = BREAK + 1.1;   // after the break, the frame shatters off the page
// bullet time in the finale, before the fan draws everything in: time stops, the colour drains, the camera whips round
const BT0 = FIN + 0.5, BT1 = FIN + 0.85;
const frozen = (t) => clamp01((t - BT0) / 0.06) * clamp01((BT1 - t) / 0.06);
const SCRAMBLE = '!<>-_\\/[]{}=+*^?#01';
// Between shots the subject doesn't cut, it dissolves: a scan plane sweeps across it, the solid behind the plane is
// gone, and what was there flies off as square pixels sampled from its surface, which land on the next subject as a
// second plane, a beat behind, builds it. TR is half the length of each change, centred on its cut.
const TR = 0.42, PIX = 7000, FORM = 0.95;   // FORM: the opening, as the card builds out of a storm of pixels
const SLOW = 3;   // film seconds are this many real seconds
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeIn = (v) => v ** 3, easeOut = (v) => 1 - (1 - v) ** 3, smooth = (v) => v * v * (3 - 2 * v);
const pick = (s) => s[Math.floor(Math.random() * s.length)];
const scramble = (text, k) => Array.from(text, (ch, i) => (i < Math.floor(k * text.length) || ch === ' ' ? ch : pick(SCRAMBLE))).join('');
const shotAt = (t) => CUTS.reduce((a, c, i) => (t >= c ? i : a), 0);

export function run() {
  return new Promise((resolve) => {
    const root = document.documentElement;
    const cv = document.createElement('canvas');
    cv.className = 'boot'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'An animated introduction. Press any key to skip.');
    document.body.append(cv);
    const dpr = Math.min(2, devicePixelRatio || 1), ctx = cv.getContext('2d');
    const streak = document.createElement('canvas'), sctx = streak.getContext('2d');
    // a dirty lens: smudges, specks and a few bokeh rings, invisible until the frame turns bright, then lit up
    const dirt = document.createElement('canvas'); dirt.width = 640; dirt.height = 360;
    { const d = dirt.getContext('2d'), R = Math.random;
      for (let i = 0; i < 46; i++) { const x = R() * 640, y = R() * 360, r = 12 + R() * 70, g = d.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,214,170,${0.05 + R() * 0.08})`); g.addColorStop(1, 'rgba(255,214,170,0)'); d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 9; i++) { const x = R() * 640, y = R() * 360, r = 8 + R() * 22; d.strokeStyle = `rgba(255,226,190,${0.08 + R() * 0.08})`; d.lineWidth = 1.2;
        d.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; d[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } d.stroke(); }
      for (let i = 0; i < 260; i++) { d.fillStyle = `rgba(255,236,214,${0.1 + R() * 0.25})`; d.fillRect(R() * 640, R() * 360, 1 + R() * 1.6, 1 + R() * 1.6); } }
    // how bright the frame is, from a tiny copy of it
    const probe = document.createElement('canvas'); probe.width = 8; probe.height = 5; const pctx = probe.getContext('2d', { willReadFrequently: true });
    let namePix = null, snap = null, snapHub = null, w = 0, h = 0, raf = 0, done = false, frame = 0, ready = null, last = 0, t0 = 0, skipAt = Infinity;
    const start = performance.now();
    const held = new URLSearchParams(location.search).get('intro'), freeze = held && !Number.isNaN(+held) ? +held : null;

    const finish = () => {
      if (done) return; done = true;
      cancelAnimationFrame(raf); removeEventListener('resize', size);
      for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(e, skip, true);
      root.classList.remove('intro-on'); cv.classList.add('out');
      setTimeout(() => { cv.remove(); ready?.dispose(); resolve(); }, 420);
    };
    function skip() { if (!ready) { finish(); return; } if (skipAt === Infinity) skipAt = (performance.now() - t0) / 1000; }
    for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(e, skip, { capture: true, passive: true });
    function size() { w = innerWidth; h = innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ready?.resize(); }
    size(); addEventListener('resize', size);

    // ---------- the 3D: every model at the origin, shown one shot at a time, on a grid floor in the dark ----------
    const build = async () => {
      const gl = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, powerPreference: 'high-performance' });
      renderer.localClippingEnabled = true;
      renderer.setPixelRatio(dpr); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040605); scene.fog = new THREE.Fog(0x040605, 7, 18);
      const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.2;
      const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 60);
      const key = new THREE.DirectionalLight(0xfff1e0, 0.9); key.position.set(2, 3, 4); scene.add(key);
      const rim = new THREE.PointLight(0xff7a22, 30, 12, 1.6); rim.position.set(-2.5, 1.5, -1.5); scene.add(rim);
      const cool = new THREE.PointLight(0x5fd1be, 14, 12, 1.6); cool.position.set(3, -0.5, 2); scene.add(cool);
      const core = new THREE.PointLight(0xff8a3d, 0, 6, 1.4); scene.add(core);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec3 vP; void main() {
          float y = normalize(vP).y;
          vec3 top = vec3(0.012, 0.03, 0.026), mid = vec3(0.004, 0.006, 0.005), glow = vec3(0.16, 0.06, 0.015);
          vec3 c = mix(mid, top, smoothstep(0.0, 0.7, y)) + glow * exp(-pow((y + 0.02) * 9.0, 2.0));   // an ember line at the horizon
          gl_FragColor = vec4(c, 1.0); }`,
      }));
      scene.add(sky); scene.background = null;
      const grid = new THREE.GridHelper(40, 80, 0x2a6b60, 0x173a33); grid.position.y = -1.35; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);
      // (the plane is unrotated: its xy is the floor's xz.) The floor alive: packets of light racing down some of the grid's lines, and a ring that ripples out along the
      // lines from each subject as it locks
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { time: { value: 0 }, ringT: { value: -1 }, center: { value: new THREE.Vector2() }, fade: { value: 1 }, rush: { value: 0 } },
        vertexShader: 'varying vec2 vW; void main() { vW = position.xy; gl_Position = projectionMatrix * viewMatrix * vec4(vW.x, -1.349, vW.y, 1.0); }',
        fragmentShader: `varying vec2 vW; uniform float time, ringT, fade, rush; uniform vec2 center;
          float line(float c) { return 1.0 - smoothstep(0.0, 0.018, abs(fract(c * 2.0 + 0.5) - 0.5) * 0.5); }
          float hash(float n) { return fract(sin(n * 91.7) * 43758.5453); }
          float packet(float along, float row) {
            float h = hash(row), q = fract(along * 0.05 - time * (0.35 + 0.5 * h + rush) + h * 7.0);
            return step(0.62 - 0.3 * rush, h) * smoothstep(0.8, 0.995, q) * step(q, 0.995);
          }
          void main() {
            float lx = line(vW.y), lz = line(vW.x), rz = floor(vW.y * 2.0 + 0.5), rx = floor(vW.x * 2.0 + 0.5);
            float d = length(vW - center), near = exp(-d * 0.14);
            vec3 col = vec3(1.0, 0.54, 0.24) * (lx * packet(vW.x, rz) + lz * packet(-vW.y, rx + 100.0)) * 1.6;
            float r = ringT * 4.5, ring = ringT < 0.0 ? 0.0 : exp(-pow((d - r) * 2.6, 2.0)) * exp(-ringT * 0.9);
            col += vec3(0.37, 0.82, 0.75) * ring * (0.07 + 2.6 * max(lx, lz));
            gl_FragColor = vec4(col * near * fade, 1.0);
          }`,
      }));
      floor.frustumCulled = false; scene.add(floor);

      const gltf = await new GLTFLoader().loadAsync(new URL('../intro/intro.glb', import.meta.url).href);
      const M = {};
      for (const n of ['gpu', 'chip', 'dimm', 'net', 'attn', 'watch', 'gauge']) { const o = gltf.scene.getObjectByName(n); o.position.set(0, 0, 0); M[n] = o; scene.add(o); }
      // each model gets its own copies of its materials, so a plane can cut one without touching the others
      for (const r of Object.values(M)) { const seen = new Map(); r.traverse((o) => { if (o.isMesh) { if (!seen.has(o.material)) seen.set(o.material, o.material.clone()); o.material = seen.get(o.material); } }); }
      // glow tuned for the camera: the chip's traces and the memory stick's strip pass close to the lens
      const dim = { trace: 0.3, colcap: 0.6, edge: 0.07, tick: 0.3, arc_cool: 0.3 };
      scene.traverse((o) => { if (o.isMesh && dim[o.material?.name] != null) o.material.emissiveIntensity *= dim[o.material.name]; });
      M.dimm.traverse((o) => { if (o.isMesh && o.material?.name === 'glow') { o.material = o.material.clone(); o.material.emissiveIntensity *= 0.08; } });
      scene.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material?.name === 'die') { o.material.metalness = 0.35; o.material.roughness = 0.45; o.material.color.setRGB(0.01, 0.011, 0.014); }
        if (o.material?.name === 'trace') o.material.color.setRGB(0.12, 0.05, 0.02);
      });
      for (const g of [M.watch, M.gauge]) g.traverse((o) => { if (o.isMesh && (o.material?.name === 'ring' || o.material?.name === 'glow')) { o.material = o.material.clone(); o.material.emissiveIntensity *= 0.35; } });
      const dimm2 = M.dimm.clone(); scene.add(dimm2);
      const gpuBack = M.gpu.clone(); scene.add(gpuBack);            // the card again, in the back of the INFERENCE shot
      const fans = [M.gpu, gpuBack].flatMap((g) => ['fan_L', 'fan_R', 'fan_L_cap', 'fan_R_cap'].map((n) => g.getObjectByName(n))).filter(Boolean);
      const glow = M.gpu.getObjectByName('glow'), rings = ['ring_fan_L', 'ring_fan_R'].map((n) => M.gpu.getObjectByName(n)).filter(Boolean);
      const fingers = M.gpu.getObjectByName('fingers');
      if (fingers) { fingers.material = fingers.material.clone(); fingers.material.emissive = new THREE.Color(0xff8a3d); }
      const layers = [0, 1, 2, 3].map((i) => M.net.getObjectByName(`net_n${i}`)).filter(Boolean);
      for (const l of layers) l.material = l.material.clone();
      const hand = M.watch.getObjectByName('watch_hand'), needle = M.gauge.getObjectByName('gauge_needle');
      const SUBJ = [M.gpu, M.chip, M.net, M.watch, M.gpu];
      // current through the chip: bright bands race along its traces (both ways across the die), over a dim glow
      const flow = { value: 0 };
      M.chip.traverse((o) => {
        if (!o.isMesh || o.material.name !== 'trace') return;
        const m = o.material;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.flow = flow;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal; uniform float flow;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              float lane = floor((vLocal.x + vLocal.z) * 16.0);
              float bx = fract(vLocal.x * 1.6 - flow * (0.9 + 0.4 * fract(lane * 0.37)) + fract(lane * 0.71));
              float bz = fract(-vLocal.z * 1.6 - flow * (0.7 + 0.5 * fract(lane * 0.53)) + fract(lane * 0.29));
              float pulse = smoothstep(0.82, 0.98, bx) * step(bx, 0.98) + smoothstep(0.82, 0.98, bz) * step(bz, 0.98);
              totalEmissiveRadiance *= 0.35 + 4.0 * pulse;`);
        };
        m.customProgramCacheKey = () => 'trace-flow';
        m.needsUpdate = true;
      });

      // the planes that cut a model during a change (each keeps its model whole until then)
      const OPEN = 1e4;
      for (const r of Object.values(M)) {
        r.userData.plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), OPEN);
        r.traverse((o) => { if (o.isMesh) o.material.clippingPlanes = [r.userData.plane]; });
      }
      // each subject's surface as points, in its own frame (the models load at the origin, unrotated), with a colour:
      // what glows keeps its glow, the rest is lifted so it reads as light
      const sample = (root) => {
        root.updateMatrixWorld(true);
        const meshes = []; root.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) meshes.push(o); });
        const area = meshes.map((m) => { const g = m.geometry, p = g.attributes.position, ix = g.index, tri = new THREE.Triangle(); let a = 0; const n = ix ? ix.count : p.count;
          for (let i = 0; i < n; i += 3) { const [i0, i1, i2] = ix ? [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)] : [i, i + 1, i + 2]; tri.a.fromBufferAttribute(p, i0).applyMatrix4(m.matrixWorld); tri.b.fromBufferAttribute(p, i1).applyMatrix4(m.matrixWorld); tri.c.fromBufferAttribute(p, i2).applyMatrix4(m.matrixWorld); a += tri.getArea(); }
          return a; });
        const total = area.reduce((a, b) => a + b, 0), pts = new Float32Array(PIX * 3), cols = new Float32Array(PIX * 3), q = new THREE.Vector3(), c = new THREE.Color();
        let k = 0;
        meshes.forEach((m, mi) => {
          const n = mi === meshes.length - 1 ? PIX - k : Math.round((PIX * area[mi]) / total); if (n <= 0) return;
          const sm = new MeshSurfaceSampler(m).build(), mat = m.material;
          const glowing = mat.emissiveIntensity > 0.3 && mat.emissive && mat.emissive.getHex() !== 0;
          c.copy(glowing ? mat.emissive : mat.color); const hsl = {}; c.getHSL(hsl);
          if (!glowing) c.setHSL(hsl.h, Math.min(1, hsl.s * 0.6 + 0.1), 0.35 + hsl.l * 0.6);
          for (let i = 0; i < n && k < PIX; i++, k++) { sm.sample(q); q.applyMatrix4(m.matrixWorld); pts.set([q.x, q.y, q.z], k * 3); cols.set([c.r, c.g, c.b], k * 3); }
        });
        return { pts, cols };
      };
      const clouds = new Map(SUBJ.map((r) => [r, sample(r)]));
      for (const r of new Set(SUBJ)) {
        r.userData.holo = new THREE.Plane(new THREE.Vector3(1, 0, 0), OPEN);
        const mat = new THREE.LineBasicMaterial({ color: 0x7fe8d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [r.userData.holo] });
        r.userData.wire = mat;
        const meshes = []; r.traverse((o) => { if (o.isMesh) meshes.push(o); });
        for (const m of meshes) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), mat); l.raycast = () => {}; m.add(l); }
      }

      // the pixels in flight, and the two scan planes
      const pixGeo = new THREE.BufferGeometry(), pxPos = new Float32Array(PIX * 3), pxCol = new Float32Array(PIX * 3), pxA = new Float32Array(PIX);
      pixGeo.setAttribute('position', new THREE.BufferAttribute(pxPos, 3)); pixGeo.setAttribute('color', new THREE.BufferAttribute(pxCol, 3)); pixGeo.setAttribute('alpha', new THREE.BufferAttribute(pxA, 1));
      const pixels = new THREE.Points(pixGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { scale: { value: 1 }, boost: { value: 1 } },
        vertexShader: `attribute vec3 color; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale, boost;
          void main() { vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = boost * min(scale * (0.6 + 1.2 * alpha) / -mv.z, scale * 0.35); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: 'varying vec3 vC; varying float vA; void main() { if (vA <= 0.0) discard; gl_FragColor = vec4(vC * (0.7 + 0.8 * vA), 0.85 * vA); }',   // square: a pixel, not a dot
      }));
      pixels.frustumCulled = false; scene.add(pixels);
      // more square pixels of their own (the signals, the data rings), drawn the same way
      const cloudOf = (n, boost = 1, over = false) => {   // over: drawn over everything (the signals run inside the links)
        const geo = new THREE.BufferGeometry(), P = new Float32Array(n * 3), C = new Float32Array(n * 3), A = new Float32Array(n);
        geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(A, 1));
        const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: !over,
          uniforms: { scale: pixels.material.uniforms.scale, boost: { value: boost } }, vertexShader: pixels.material.vertexShader, fragmentShader: pixels.material.fragmentShader }));
        pts.frustumCulled = false;
        const dirty = () => { for (const k of ['position', 'color', 'alpha']) geo.attributes[k].needsUpdate = true; };
        return { pts, P, C, A, n, dirty };
      };
      // signals through the network: a pulse down every link, from each layer to the next as they fire in turn, with a
      // short tail; the nodes are where tools/build_intro.py put them (Blender's z up is three's y)
      const NL = [4, 6, 6, 3], nodeAt = NL.map((n, li) => Array.from({ length: n }, (_, j) => new THREE.Vector3(-1.2 + li * 0.8, (j - (n - 1) / 2) * 0.36, -((j % 2) * 0.12 - 0.06))));
      const links = []; for (let l = 0; l < 3; l++) for (const a of nodeAt[l]) for (const b of nodeAt[l + 1]) links.push([l, a, b, Math.random()]);
      const TAIL = 6, WAVES = 2, sig = cloudOf(links.length * TAIL * WAVES, 4, true); M.net.add(sig.pts);
      const sv = new THREE.Vector3();
      // data rings: two dashed rings of pixels orbiting each subject once it has locked, on different tilts and speeds
      const RN = 360, rings3 = cloudOf(RN * 2, 1.6), rc = new THREE.Vector3(), rsz = new THREE.Vector3(), rbox = new THREE.Box3();
      scene.add(rings3.pts);
      const RING = [
        { e1: new THREE.Vector3(1, 0, 0), e2: new THREE.Vector3(0, Math.sin(0.38), Math.cos(0.38)), spin: 0.9, col: [1, 0.54, 0.24] },
        { e1: new THREE.Vector3(Math.cos(0.8), 0, -Math.sin(0.8)), e2: new THREE.Vector3(0.15, 0.99, 0), spin: -1.3, col: [0.37, 0.82, 0.75] },
      ];
      const orbit = (subject, t, fade) => {
        rings3.pts.visible = fade > 0.01; if (!rings3.pts.visible) return;
        rbox.setFromObject(subject).getCenter(rc); rbox.getSize(rsz); const R = Math.max(rsz.x, rsz.y, rsz.z) * 0.68;
        RING.forEach(({ e1, e2, spin, col }, ri) => {
          for (let i = 0; i < RN; i++) {
            const j = ri * RN + i, th = (i / RN) * Math.PI * 2 + t * spin, on = Math.floor(i / 10) % 4 !== 3, open = clamp01(fade * 1.4 - (i / RN) * 0.4);
            const r = R * (1 + (ri ? 0.06 : 0)) * (0.85 + 0.15 * open);
            sv.copy(rc).addScaledVector(e1, Math.cos(th) * r).addScaledVector(e2, Math.sin(th) * r);
            rings3.P.set([sv.x, sv.y, sv.z], j * 3); rings3.C.set(col, j * 3);
            rings3.A[j] = on ? 0.75 * open * (i % 10 === 0 ? 1.3 : 1) : 0;
          }
        });
        rings3.dirty();
      };
      const signals = (p, on) => {
        sig.pts.visible = on; if (!on) return;
        links.forEach(([l, a, b, r], i) => {
          for (let wv = 0; wv < WAVES; wv++) {
            // leaves layer l+1 as it fires and lands on layer l as that one does; a second wave half a beat behind
            const s = p * 5 - 0.6 - (2 - l) - 0.15 * r - wv * 0.5;
            for (let k = 0; k < TAIL; k++) {
              const q = s - k * 0.05, j = (i * WAVES + wv) * TAIL + k, live = q > 0 && q < 1;
              sv.lerpVectors(b, a, clamp01(q)); sig.P.set([sv.x, sv.y, sv.z], j * 3);
              sig.C.set(k === 0 ? [0.85, 1, 0.95] : [1, 0.55 - 0.05 * k, 0.24], j * 3);
              sig.A[j] = live ? (1 - k / TAIL) * Math.min(1, Math.sin(Math.PI * q) * 3) : 0;
            }
          }
        });
        sig.dirty();
      };
      // a scan plane: a faint grid with a bright rim, so it reads as a sensor sweeping through rather than a sheet of light
      const scanMat = (hex) => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { color: { value: new THREE.Color(hex) }, opacity: { value: 0 }, cells: { value: new THREE.Vector2(8, 8) } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 color; uniform float opacity; uniform vec2 cells; varying vec2 vUv;
          void main() { vec2 g = abs(fract(vUv * cells) - 0.5); float line = smoothstep(0.47, 0.5, max(g.x, g.y));
            vec2 e = min(vUv, 1.0 - vUv); float rim = 1.0 - smoothstep(0.0, 0.012, min(e.x, e.y));
            gl_FragColor = vec4(color * opacity * (0.04 + 0.35 * line + 1.2 * rim), 1.0); }`,
      });
      const scanOut = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scanMat(0xff8a3d)), scanIn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scanMat(0x5fd1be));
      for (const p of [scanOut, scanIn]) { p.rotation.y = Math.PI / 2; scene.add(p); }
      // a change in progress: the clouds put where their models stand, sorted along the sweep so pixels pair up with
      // the part of the next model across from them
      let change = null;
      const begin = (k, out, inn) => {
        const box = new THREE.Box3().setFromObject(out).union(new THREE.Box3().setFromObject(inn));
        const place = (r) => { const { pts, cols } = clouds.get(r), wpts = new Float32Array(PIX * 3), q = new THREE.Vector3(); r.updateMatrixWorld(true);
          for (let i = 0; i < PIX; i++) { q.fromArray(pts, i * 3).applyMatrix4(r.matrixWorld); wpts.set([q.x, q.y, q.z], i * 3); }
          const order = Array.from({ length: PIX }, (_, i) => i).sort((a, b) => wpts[a * 3] - wpts[b * 3]); return { wpts, cols, order }; };
        change = { k, out, inn, box, a: place(out), b: place(inn), seed: Array.from({ length: PIX }, () => Math.random()) };
      };
      // the opening: a storm of pixels in the dark behind the card, which pours forward and builds it
      const beginStorm = () => {
        const box = new THREE.Box3().setFromObject(M.gpu), wpts = new Float32Array(PIX * 3), cols = new Float32Array(PIX * 3), c = new THREE.Color();
        for (let i = 0; i < PIX; i++) {
          wpts.set([(Math.random() - 0.5) * 7, -1 + Math.random() * 2.8, -0.6 - Math.random() * 3.5], i * 3);
          c.set(i % 5 === 0 ? 0xff8a3d : i % 3 === 0 ? 0xfff4e8 : 0x5fd1be); cols.set([c.r, c.g, c.b], i * 3);
        }
        const order = Array.from({ length: PIX }, (_, i) => i).sort((a, b) => wpts[a * 3] - wpts[b * 3]);
        const place = (r) => { const { pts, cols } = clouds.get(r), wp = new Float32Array(PIX * 3), q = new THREE.Vector3(); r.updateMatrixWorld(true);
          for (let i = 0; i < PIX; i++) { q.fromArray(pts, i * 3).applyMatrix4(r.matrixWorld); wp.set([q.x, q.y, q.z], i * 3); }
          return { wpts: wp, cols, order: Array.from({ length: PIX }, (_, i) => i).sort((a, b) => wp[a * 3] - wp[b * 3]) }; };
        change = { k: 0, out: null, inn: M.gpu, box, a: { wpts, cols, order }, b: place(M.gpu), seed: Array.from({ length: PIX }, () => Math.random()) };
      };
      const morph = (u) => {
        const { box, a, b, out, inn, seed } = change, x0 = box.min.x - 0.05, x1 = box.max.x + 0.05;
        const sweepOut = clamp01(u / 0.72), sweepIn = clamp01((u - 0.28) / 0.72);
        const sOut = x0 + (x1 - x0) * smooth(sweepOut), sIn = x0 + (x1 - x0) * smooth(sweepIn);
        if (out) out.userData.plane.set(new THREE.Vector3(1, 0, 0), -sOut); inn.userData.plane.set(new THREE.Vector3(-1, 0, 0), sIn);
        // the planes themselves, glowing, the size of the models' cross-section
        const H = box.max.y - box.min.y + 0.3, D = box.max.z - box.min.z + 0.3, cy = (box.max.y + box.min.y) / 2, cz = (box.max.z + box.min.z) / 2;
        scanOut.position.set(sOut, cy, cz); scanOut.scale.set(D, H, 1); scanOut.material.uniforms.opacity.value = out ? Math.sin(Math.PI * sweepOut) : 0; scanOut.material.uniforms.cells.value.set(D * 6, H * 6);
        // the next subject as a wireframe ahead of its build; the last one's wireframe lingers where the cut has been
        const fl = 0.8 + 0.2 * Math.sin(u * 140);
        inn.userData.holo.set(new THREE.Vector3(1, 0, 0), -sIn); inn.userData.wire.opacity = (out ? 0.55 : 0.16) * fl * smooth(clamp01(u / 0.2));   // the card's fins are dense up close
        if (out && out !== inn) { out.userData.holo.set(new THREE.Vector3(-1, 0, 0), sOut); out.userData.wire.opacity = 0.4 * fl * (1 - smooth(clamp01(u / 0.65))); }
        scanIn.position.set(sIn, cy, cz); scanIn.scale.set(D, H, 1); scanIn.material.uniforms.opacity.value = (out ? 0.7 : 0.3) * Math.sin(Math.PI * sweepIn); scanIn.material.uniforms.cells.value.set(D * 6, H * 6);
        // each pixel leaves when the first plane passes it and lands as the second reaches where it's going
        for (let j = 0; j < PIX; j++) {
          const ia = a.order[j], ib = b.order[j], ax = a.wpts[ia * 3], fa = clamp01((ax - x0) / (x1 - x0));
          const q = clamp01((u - fa * 0.72) / 0.28 + (seed[j] - 0.5) * 0.25), e = smooth(q), arc = Math.sin(Math.PI * q);
          for (let d = 0; d < 3; d++) pxPos[j * 3 + d] = a.wpts[ia * 3 + d] + (b.wpts[ib * 3 + d] - a.wpts[ia * 3 + d]) * e;
          pxPos[j * 3 + 1] += arc * (0.25 + 0.5 * seed[j]); pxPos[j * 3 + 2] += arc * (seed[j] - 0.5) * 0.9;
          for (let d = 0; d < 3; d++) pxCol[j * 3 + d] = a.cols[ia * 3 + d] + (b.cols[ib * 3 + d] - a.cols[ia * 3 + d]) * e;
          pxA[j] = q > 0 && q < 1 ? Math.min(1, arc * 1.6) : 0;
        }
        pixGeo.attributes.position.needsUpdate = true; pixGeo.attributes.color.needsUpdate = true; pixGeo.attributes.alpha.needsUpdate = true;
        pixels.visible = true;
      };
      const settle = () => { for (const r of Object.values(M)) { r.userData.plane.set(new THREE.Vector3(1, 0, 0), OPEN); if (r.userData.wire) r.userData.wire.opacity = 0; } pixels.visible = false; scanOut.material.uniforms.opacity.value = scanIn.material.uniforms.opacity.value = 0; change = null; };
      const fanR = M.gpu.getObjectByName('fan_R');
      const hub = new THREE.Vector3();

      // dust: points round the origin, drifting through every shot, pulled into the fan at the end
      const N = 300, home = new Float32Array(N * 3), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), lag = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        home.set([(Math.random() - 0.5) * 10, (Math.random() - 0.4) * 5, (Math.random() - 0.5) * 8], i * 3);
        col.set(Math.random() < 0.7 ? [1, 0.54, 0.24] : Math.random() < 0.7 ? [0.37, 0.82, 0.75] : [1, 0.95, 0.9], i * 3); lag[i] = Math.random() * 0.35;
      }
      const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));

      const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
      const trails = new AfterimagePass(0); composer.addPass(trails);   // light trails behind what moves fast; off by default
      const bokeh = new BokehPass(scene, camera, { focus: 4, aperture: 0.0016, maxblur: 0.008 }); composer.addPass(bokeh);
      const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.55, 0.85); composer.addPass(bloom);
      composer.addPass(new OutputPass());
      const rays = new ShaderPass(RAYS); rays.uniforms.light.value = new THREE.Vector2(0.5, 0.5); composer.addPass(rays);
      const film = new ShaderPass(FILM); film.uniforms.shock.value = new THREE.Vector2(0.5, 0.5); composer.addPass(film);
      const resize = () => { renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const v = new THREE.Vector3(), look = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();
      const at = (o, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => { o.visible = true; o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); };
      let spin = 0, lock = null, changing = -1; const box = new THREE.Box3();
      const stage = (shot, p, t, narrow, back) => {
            if (shot === 'open') {
              // in close across the card's fans and fins as they spin up, the light strip flickering on
              at(M.gpu, 0, 0, 0);
              const s = smooth(p); A.set(1.4 - 2.3 * s, 0.35 - 0.2 * s, 1.55); camera.position.copy(A); look.set(0.75 - 1.9 * s, 0.05, 0);
              const flick = t < 0.5 ? [0, 1, 0, 0.3, 1, 0, 1, 1, 0.5, 1][Math.min(9, Math.floor(t / 0.05))] : 1;
              if (glow) glow.visible = flick > 0.4; for (const r of rings) r.visible = t > 0.25 && flick > 0.2;
            } else if (shot === 'inference') {
              // the chip turns in the middle; memory sticks streak past the lens, one near, one far; the card behind
              at(M.chip, 0.15, 0.05, 0, -0.5 + 0.7 * p, 0.12, 0, 1.25);
              at(M.dimm, 3.4 - 7 * p, -0.5, 1.7, 0.25, 0.1, 0.12);
              at(dimm2, -3.6 + 6 * p, 0.85, -1.6, -0.3, 0, -0.08, 0.9);
              at(gpuBack, 2.4, 0.15, -3.2, -0.65, 0, 0, 1.1);
              camera.position.set((0.9 - 1.4 * p) * back, 0.35 - 0.2 * p, (3.4 - 0.6 * p) * back); look.set(0.1, 0, 0);
            } else if (shot === 'research') {
              // through the network: its layers run toward the camera, which flies down them while they fire in turn,
              // over an attention pattern rising out of the floor
              at(M.net, 0, 0.15, 0, Math.PI / 2, 0, 0.12 * Math.sin(t), 1.45);
              layers.forEach((l, i) => { const fire = Math.exp(-(((p * 5 - 0.6 - (3 - i)) * 1.6) ** 2)); l.material.emissiveIntensity = 0.35 + 3 * fire; });
              at(M.attn, -0.4, -1.35, -3.4, 0.6 + 0.2 * p, 0, 0, 1.6); M.attn.scale.y = 1.6 * easeOut(clamp01(p * 1.4));
              // alongside the network rather than through its nodes, which would white the frame out
              camera.position.set((1.5 + 0.2 * Math.sin(p * 3)) * back, 0.35 + 0.35 * p, (4.8 - 5.6 * smooth(p)) * (narrow ? 1.25 : 1));
              look.set(-0.2, -0.15 - 0.5 * p, camera.position.z - 3.4);
              camera.fov = 44;
            } else if (shot === 'efficiency') {
              // the stopwatch, its hand racing; the gauge swings past with its needle slamming to the top
              at(M.watch, -0.35, 0.2, 0, -0.35 + 0.45 * p, 0.05, 0, 1.25);
              if (hand) hand.rotation.z = -t * 14;
              const g = easeOut(clamp01(p * 1.3));
              at(M.gauge, 2.7 - 1.6 * g, -0.75 + 0.25 * g, 1.3, -0.5 + 0.3 * g, 0.1, 0, 0.95);
              if (needle) needle.rotation.z = -(-2.0 + 4.0 * easeOut(clamp01(p * 1.6)) + 0.08 * Math.sin(t * 40) * clamp01(p * 2 - 1));
              camera.position.set((-0.5 + 0.8 * p) * back, 0.3, (4.6 - 0.7 * p) * back); look.set(0.3, 0, 0);
            } else {
              // back to the card: three-quarters, the fingers lighting as everything pours into the fan; then the dive
              at(M.gpu, 0, 0, 0); if (glow) glow.visible = true; for (const r of rings) r.visible = true;
              const charge = clamp01((t - SUCK) / (DIVE - SUCK)), dive = easeIn(clamp01((t - DIVE) / (BREAK - DIVE)));
              const a = -0.45 + 0.12 * Math.sin(t * 0.4) + 1.05 * smooth(clamp01((t - BT0) / (BT1 - BT0)));
              camera.position.set(Math.sin(a) * 5.4 * back, 0.75 + 0.25 * back, Math.cos(a) * 5.4 * back); look.set(0, 0.05, 0);
              fanR.getWorldPosition(hub);
              if (dive > 0) { camera.position.lerp(B.set(hub.x, hub.y, hub.z + 0.12), dive); look.lerp(hub, smooth(clamp01((t - DIVE) / 0.4))); }
              camera.fov = 38 + 30 * dive;
              if (fingers) fingers.material.emissiveIntensity = 0.2 + 3 * charge + 4 * dive;
              core.position.set(hub.x, hub.y, hub.z + 0.25); core.intensity = 35 * charge + 70 * dive;
              bloom.strength = 0.8 + 0.55 * charge + 0.4 * dive; grid.material.opacity = 0.5 * (1 - dive);
            }
      };
      if (freeze != null) window.__intro = { scene, M, bloom };   // a frozen frame can be inspected from the console

      return {
        gl, resize,
        hubOnScreen() { v.copy(hub).project(camera); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]; },
        dispose() { renderer.dispose(); pmrem.dispose(); dustGeo.dispose(); },
        render(t, dt) {
          const si0 = shotAt(t), shot = SHOTS[si0], lin = clamp01((t - CUTS[shotAt(t)]) / ((CUTS[shotAt(t) + 1] ?? END) - CUTS[shotAt(t)]));
          const p = shot === 'finale' ? lin : lin + 0.1 * Math.sin(lin * Math.PI * 2);   // a speed ramp: fast in, slow on the subject, fast out
          const narrow = w / h < 0.8, back = narrow ? 1.8 : 1;       // a phone stands further back
          for (const o of [...Object.values(M), dimm2, gpuBack]) o.visible = false;
          grid.visible = true; camera.fov = 38;
          spin += dt * (1 - 0.97 * frozen(t)) * (12 + (shot === 'finale' ? 40 * clamp01((t - SUCK) / 0.4) + 60 * clamp01((t - DIVE) / 0.6) : 0));
          for (const f of fans) f.rotation.z = -spin;
          // during a change: the outgoing shot at its end and the incoming at its start, the camera gliding between, the
          // subjects dissolving one into the other; otherwise the shot as it is
          const k = [1, 2, 3, 4].find((c) => Math.abs(t - CUTS[c]) < TR);
          let subject = SUBJ[shotAt(t)], u = 0;
          if (k) {
            u = (t - CUTS[k] + TR) / (2 * TR);
            const hideAll = () => { for (const o of [...Object.values(M), dimm2, gpuBack]) o.visible = false; };
            stage(SHOTS[k - 1], 1, t, narrow, back); const camA = camera.position.clone(), lookA = look.clone(), fovA = camera.fov; hideAll();
            stage(SHOTS[k], 0, t, narrow, back); const camB = camera.position.clone(), lookB = look.clone(), fovB = camera.fov; hideAll();
            const out = SUBJ[k - 1], inn = SUBJ[k]; out.visible = inn.visible = true;
            if (!change || change.k !== k) begin(k, out, inn);
            const e = smooth(u); camera.position.lerpVectors(camA, camB, e); look.lerpVectors(lookA, lookB, e); camera.fov = fovA + (fovB - fovA) * e;
            camera.position.sub(look).multiplyScalar(1 + 0.9 * Math.sin(Math.PI * u)).add(look);   // pulled back mid-change, so both subjects are whole
            morph(u); subject = u < 0.5 ? out : inn; film.uniforms.glitch.value = Math.sin(Math.PI * u) ** 2;
          } else {
            stage(shot, p, t, narrow, back);
            if (t < FORM) { if (!change || change.k !== 0) beginStorm(); u = t / FORM; morph(u); film.uniforms.glitch.value = 0.3 * Math.sin(Math.PI * u) ** 2; }
            else { if (change) settle(); film.uniforms.glitch.value = 0; }
          }

          signals(p, shot === 'research' && !k); flow.value = t * 1.4;
          // the rings open as the subject locks and close before it dissolves (not up close on the card in the opening)
          orbit(subject, t, !k && si0 > 0 && si0 < 4 ? smooth(clamp01((t - CUTS[si0] - TR) / 0.3)) * smooth(clamp01((CUTS[si0 + 1] - TR - t) / 0.2)) : 0);
          if (shot !== 'finale') { core.intensity = 0; bloom.strength = shot === 'research' ? 0.45 : 0.75; grid.material.opacity = 0.5; }
          // the floor: the ring goes out from the subject as it locks (from the hub as the finale charges)
          const fu = floor.material.uniforms, settleAt = si0 === 0 ? FORM : si0 < 4 ? CUTS[si0] + TR : SUCK;
          fu.time.value = t; fu.ringT.value = k ? -1 : t - settleAt;
          if (shot === 'finale') fu.center.value.set(hub.x, hub.z); else { subject.getWorldPosition(v); fu.center.value.set(v.x, v.z); }
          fu.rush.value = shot === 'finale' ? 0.6 * clamp01((t - SUCK) / 0.6) : 0; fu.fade.value = grid.material.opacity / 0.5;
          // a handheld drift, and the focus on what the shot is about
          camera.position.x += 0.018 * Math.sin(t * 1.7) + 0.008 * Math.sin(t * 4.3); camera.position.y += 0.014 * Math.sin(t * 2.3 + 1);
          const pull = !k && si0 > 0 && si0 < 4 ? smooth(clamp01((t - CUTS[si0] - TR) / 0.45)) : 1;
          bokeh.uniforms.focus.value = camera.position.distanceTo(subject.getWorldPosition(v)) * (shot === 'open' ? 0.75 : 1) * (0.45 + 0.55 * pull);
          bokeh.uniforms.aperture.value = (shot === 'research' ? 0.0011 : shot === 'finale' ? 0.0007 : 0.0016) * (1 + 1.5 * (1 - pull));
          film.uniforms.drain.value = 0.75 * frozen(t);
          film.uniforms.time.value = (t < BT0 || t > BT1 ? t : BT0) * 60 % 100;   // even the grain holds still film.uniforms.split.value = 0.0015 + (shot === 'finale' ? 0.004 * clamp01((t - DIVE) / 0.8) : 0);
          camera.lookAt(look);
          if (!k && si0 < 4 && t >= settleAt) { const sl = t - settleAt; camera.fov *= 1 - 0.1 * Math.exp(-sl * 6) * clamp01(sl / 0.04); }   // a punch-in as it locks
          const roll = k ? 0 : shot === 'inference' ? 0.1 - 0.16 * p : shot === 'efficiency' ? -0.08 + 0.14 * p : shot === 'research' ? 0.05 * Math.sin(p * 4) : 0;
          pixels.material.uniforms.scale.value = h * 0.012 * dpr;
          camera.rotateZ(roll); camera.updateProjectionMatrix();
          // the dust drifts, then is pulled into the fan
          for (let i = 0; i < N; i++) {
            const k = shot === 'finale' ? smooth(clamp01((t - SUCK - lag[i]) / (DIVE - SUCK + 0.2))) : 0;
            const td = t < BT0 ? t : t < BT1 ? BT0 : t - (BT1 - BT0);
            const hx = home[i * 3] + Math.sin(td * 0.3 + i) * 0.12, hy = home[i * 3 + 1] + Math.sin(td * 0.5 + i * 0.7) * 0.1, hz = home[i * 3 + 2];
            pos[i * 3] = hx + (hub.x - hx) * k; pos[i * 3 + 1] = hy + (hub.y - hy) * k; pos[i * 3 + 2] = hz + (hub.z - hz) * k;
          }
          dustGeo.attributes.position.needsUpdate = true;
          camera.updateMatrixWorld();
          if (shot === 'finale') v.copy(hub); else box.setFromObject(subject).getCenter(v).add(B.set(0, 0.35, -0.6));
          v.project(camera); rays.uniforms.light.value.set(Math.min(1.3, Math.max(-0.3, v.x * 0.5 + 0.5)), Math.min(1.3, Math.max(-0.3, v.y * 0.5 + 0.5)));
          const diving = shot === 'finale' ? clamp01((t - SUCK) / (BREAK - SUCK)) : 0;
          rays.uniforms.strength.value = (v.z < 1 ? 0.45 : 0) + 0.5 * diving; rays.uniforms.density.value = 0.75 + 0.2 * diving;
          // trails: through the changes and the opening (the pixels in flight streak), behind the memory sticks as they
          // fly past, and long in the dive
          const flight = k ? Math.sin(Math.PI * u) : t < FORM ? Math.sin(Math.PI * t / FORM) : 0;
          trails.uniforms.damp.value = freeze != null ? 0 : Math.min(0.9, Math.max(0.86 * Math.sqrt(flight), shot === 'inference' && !k ? 0.6 : 0, shot === 'finale' ? 0.88 * clamp01((t - SUCK) / 0.5) : 0));
          // where the subject's middle sits on screen, for the HUD's reticle and the shockwave
          box.setFromObject(subject).getCenter(v).project(camera);
          lock = v.z < 1 ? [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h] : null; changing = k ? u : -1;
          // a shockwave as each subject locks, out from it; a bigger one from the hub as the camera dives
          const fw = film.uniforms; fw.aspect.value = w / h;
          const big = shot === 'finale', since = big ? t - DIVE : k ? -1 : t - settleAt;
          if (since >= 0 && since < 0.9) {
            if (big) { v.copy(hub).project(camera); fw.shock.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); }
            else if (lock) fw.shock.value.set(lock[0] / w, 1 - lock[1] / h);
            fw.shockR.value = since * (big ? 2.2 : 1.5); fw.shockA.value = (big ? 1.4 : 0.8) * (1 - since / 0.9) ** 1.5;
          } else fw.shockA.value = 0;
          composer.render();
        },
        lock: () => lock, changing: () => changing,
      };
    };

    // ---------- each frame: the 3D, then the word, the name and the glitch over it ----------
    const draw = (now) => {
      raf = requestAnimationFrame(draw); frame++;
      if (!cv.width || !cv.height) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#040605'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (!ready) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (Math.floor((now - start) / 200) % 2 === 0) { ctx.fillStyle = `rgba(${ORANGE},0.95)`; ctx.fillRect(w / 2 - 8, h / 2 - 14, 16, 28); } return; }
      // the film runs at half speed; a skip goes straight to the break-through at full speed
      const real = (now - t0) / 1000; let t = freeze ?? real / SLOW;
      if (freeze == null && t > BREAK) t = BREAK + (t - BREAK) * SLOW;   // the shatter plays at full speed
      if (skipAt !== Infinity) t = Math.max(t, BREAK + (real - skipAt));
      if (t >= END) { finish(); return; }
      if (t >= BREAK && snap) { shatter(t); return; }
      const dt = freeze != null ? 0.016 : Math.min(0.05, (now - (last || now)) / 1000) / SLOW; last = now;
      ready.render(t, dt);
      const si = shotAt(t), shot = SHOTS[si], since = t - CUTS[si], narrow = w < 640;
      const dive = shot === 'finale' ? easeIn(clamp01((t - DIVE) / (BREAK - DIVE))) : 0;
      const hit = t < 0.3 || t >= BREAK - 0.12;
      const slamHit = WORDS[shot] && since < 0.1 ? 1 - since / 0.1 : 0;
      const rattle = (hit ? 8 : 0) + 12 * dive + 14 * slamHit;
      ctx.drawImage(ready.gl, (Math.random() - 0.5) * rattle * dpr, (Math.random() - 0.5) * rattle * dpr, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // anamorphic streaks: the frame squeezed to a few columns and stretched back, so bright things smear sideways
      streak.width = 40; streak.height = Math.max(1, Math.round(h / 3));
      sctx.drawImage(ready.gl, 0, 0, streak.width, streak.height);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.16; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(streak, 0, 0, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (hit) {                                                       // a split on the hits: the frame again, shifted
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3;
        ctx.drawImage(ready.gl, -7, 0, w, h); ctx.drawImage(ready.gl, 7, 0, w, h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      // speed lines out from the middle: a hiss through every shot, a surge on each cut and in the dive
      const surge = 0.12 + (si > 0 ? 0.5 * clamp01(1 - since / 0.35) : 0) + 1.6 * dive;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 26; k++) {
        const a = (k * 2.399 + Math.floor(t * 18) * 0.7) % 6.283, r0 = Math.hypot(w, h) * (0.22 + ((k * 0.37 + t * 1.9) % 0.5)), len = 40 + 220 * surge;
        ctx.strokeStyle = `rgba(${k % 3 ? WHITE : ORANGE},${Math.min(0.5, 0.07 * surge)})`; ctx.lineWidth = 1 + (k % 2);
        ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); ctx.lineTo(w / 2 + Math.cos(a) * (r0 + len), h / 2 + Math.sin(a) * (r0 + len)); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      // bullet time: ghosts of the frame either side, as from a ring of cameras, and a sweep across it as time stops
      const fz = frozen(t);
      if (fz > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (const dx of [-18, 18]) { ctx.globalAlpha = 0.1 * fz; ctx.drawImage(ready.gl, dx, 0, w, h); }
        const sx = w * clamp01((t - BT0) / 0.15); ctx.globalAlpha = 0.5 * fz * (1 - clamp01((t - BT0) / 0.15)); ctx.fillStyle = `rgb(${WHITE})`; ctx.fillRect(sx - 1, 0, 2, h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      // the shot's word, huge, on the floor: slammed in, drifting
      if (WORDS[shot]) {
        const word = WORDS[shot], fs = Math.min(w * 0.15, h * 0.3);
        ctx.save(); ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const fit = Math.min(1, (w * 0.94) / ctx.measureText(word).width), text = scramble(word, clamp01(since / 0.28)), slam = 1 + 0.2 * clamp01(1 - since / 0.14);
        ctx.translate(w / 2 + since * 18, narrow ? h * 0.82 : h * 0.84); ctx.scale(slam * fit, slam * fit);
        ctx.globalCompositeOperation = 'lighter';
        if (since < 0.22) { ctx.fillStyle = `rgba(${PINK},0.5)`; ctx.fillText(text, -6, 0); ctx.fillStyle = `rgba(${CYAN},0.5)`; ctx.fillText(text, 6, 0); }
        ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(${ORANGE},0.8)`; ctx.strokeText(text, 0, 0);
        ctx.fillStyle = `rgba(${ORANGE},${since < 0.1 ? 0.55 : 0.12})`; ctx.fillText(text, 0, 0);
        ctx.restore();
      }

      // the lens dirt, lit by how bright the frame is
      pctx.drawImage(ready.gl, 0, 0, 8, 5); const px8 = pctx.getImageData(0, 0, 8, 5).data; let lum = 0;
      for (let i = 0; i < px8.length; i += 4) lum += (0.3 * px8[i] + 0.59 * px8[i + 1] + 0.11 * px8[i + 2]) / 255;
      lum /= 40; const glare = clamp01((lum - 0.16) * 2.6);
      if (glare > 0.01) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = glare; ctx.drawImage(dirt, 0, 0, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      // the HUD: corner brackets close in and lock onto the subject once it's built, with a crosshair and a sweep
      const lk = ready.lock(), ch = ready.changing();
      const leak = ch >= 0 ? Math.sin(Math.PI * ch) : t < 0.6 ? clamp01(1 - t / 0.6) * 0.7 : 0;
      if (leak > 0.01) {
        ctx.globalCompositeOperation = 'screen';
        for (const [ox, oy, rr, col, ph] of [[-0.05, 0.2, 0.55, ORANGE, 0], [1.05, 0.75, 0.5, PINK, 2], [0.6, -0.1, 0.4, '255, 196, 120', 4]]) {
          const x = w * (ox + 0.08 * Math.sin(t * 1.3 + ph)), y = h * (oy + 0.06 * Math.cos(t * 1.1 + ph)), R = Math.max(w, h) * rr;
          const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(${col},${0.42 * leak})`); g.addColorStop(0.5, `rgba(${col},${0.12 * leak})`); g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (lk && t > FORM && t < SUCK && (ch < 0 || ch > 0.8)) {
        const settled = ch < 0 ? clamp01((t - (CUTS[si] + (si ? TR : FORM))) / 0.25 + 0.0001) : 0;
        // a reticle of fixed size on the middle of the subject (kept clear of the edges and the word), closing in to lock
        const S = Math.min(w, h) * 0.16 * (1 + 0.6 * (1 - easeOut(settled)));
        const mx = Math.min(w * 0.7, Math.max(w * 0.3, lk[0])), my = Math.min(h * 0.58, Math.max(h * 0.3, lk[1]));
        const X0 = mx - S, Y0 = my - S, X1 = mx + S, Y1 = my + S;
        {
          const blink = settled < 1 ? (Math.floor(t * 40) % 2 ? 0.9 : 0.3) : 0.95, L = Math.min(34, (X1 - X0) * 0.2);
          ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
          ctx.strokeStyle = `rgba(${settled < 1 ? WHITE : ORANGE},${blink})`; ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (const [x, y, sx, sy] of [[X0, Y0, 1, 1], [X1, Y0, -1, 1], [X0, Y1, 1, -1], [X1, Y1, -1, -1]]) { ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); }
          const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, r = 7;
          ctx.moveTo(cx - r * 2, cy); ctx.lineTo(cx - r, cy); ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r * 2, cy); ctx.moveTo(cx, cy - r * 2); ctx.lineTo(cx, cy - r); ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy + r * 2);
          ctx.stroke();
          // a broken ring turning around the crosshair
          ctx.lineWidth = 1.2; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 60;
          ctx.beginPath(); ctx.arc(cx, cy, S * 0.42, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
          ctx.restore();
          // a thin sweep down the locked frame, and tick marks along its top edge
          if (settled >= 1) {
            const sy = Y0 + (Y1 - Y0) * ((t * 0.9) % 1); const g = ctx.createLinearGradient(X0, 0, X1, 0);
            g.addColorStop(0, `rgba(${ORANGE},0)`); g.addColorStop(0.5, `rgba(${ORANGE},0.35)`); g.addColorStop(1, `rgba(${ORANGE},0)`);
            ctx.fillStyle = g; ctx.fillRect(X0, sy, X1 - X0, 1);
            ctx.fillStyle = `rgba(${ORANGE},0.5)`; for (let x = X0 + L + 6; x < X1 - L - 6; x += 9) ctx.fillRect(x, Y0 - 1, 1, (Math.round((x - X0) / 9) % 4 ? 3 : 6));
          }
        }
      }

      // the name, as the camera dives into the fan, over a dark band so it reads through the glow
      if (shot === 'finale' && t >= DIVE + 0.25) {
        const k = clamp01((t - DIVE - 0.25) / 0.45), name = scramble('AKASH DASARRAJU', k);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let px = Math.min(w * 0.085, 92); ctx.font = `800 ${px}px ${FONT}`; px = Math.min(px, (px * w * 0.88) / ctx.measureText('AKASH DASARRAJU').width); ctx.font = `800 ${px}px ${FONT}`;
        const band = ctx.createLinearGradient(0, h / 2 - px * 1.4, 0, h / 2 + px * 1.6); band.addColorStop(0, 'rgba(4,6,5,0)'); band.addColorStop(0.35, `rgba(4,6,5,${0.62 * k})`); band.addColorStop(0.7, `rgba(4,6,5,${0.62 * k})`); band.addColorStop(1, 'rgba(4,6,5,0)');
        ctx.fillStyle = band; ctx.fillRect(0, h / 2 - px * 1.4, w, px * 3);
        // the name builds out of pixels that stream from the fan's hub, then snaps to the type
        const key = `${w}x${h}x${px}`;
        if (!namePix || namePix.key !== key) {
          const oc = document.createElement('canvas'), ow = Math.ceil(w), oh = Math.ceil(px * 1.6); oc.width = ow; oc.height = oh;
          const o = oc.getContext('2d'); o.font = `800 ${px}px ${FONT}`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff'; o.fillText('AKASH DASARRAJU', ow / 2, oh / 2);
          const data = o.getImageData(0, 0, ow, oh).data, step = Math.max(2, Math.round(px / 26)), pts = [];
          for (let y = 0; y < oh; y += step) for (let x = 0; x < ow; x += step) if (data[(y * ow + x) * 4 + 3] > 140) pts.push([x, y - oh / 2 + h / 2, Math.random(), Math.random() * 6.283]);
          namePix = { key, pts, step };
        }
        const [hx, hy] = ready.hubOnScreen(), build = clamp01((t - DIVE - 0.25) / 0.6);
        if (build < 1) {
          ctx.globalCompositeOperation = 'lighter';
          for (const [x, y, d, a] of namePix.pts) {
            const e = easeOut(clamp01(build * 1.7 - d * 0.7)); if (e <= 0) continue;
            const sx = hx + Math.cos(a) * 40 * (1 - e), sy = hy + Math.sin(a) * 40 * (1 - e);
            const X = sx + (x - sx) * e, Y = sy + (y - sy) * e, sz = namePix.step * (e < 1 ? 1.4 : 1);
            ctx.fillStyle = e < 1 ? (d < 0.33 ? `rgba(${CYAN},0.9)` : d < 0.5 ? `rgba(${PINK},0.8)` : `rgba(${WHITE},0.9)`) : `rgb(${WHITE})`;
            ctx.fillRect(X - sz / 2, Y - sz / 2, sz, sz);
          }
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.globalCompositeOperation = 'lighter';
          if (t < DIVE + 0.95) { ctx.fillStyle = `rgba(${PINK},0.5)`; ctx.fillText(name, w / 2 - 4, h / 2); ctx.fillStyle = `rgba(${CYAN},0.5)`; ctx.fillText(name, w / 2 + 4, h / 2); }
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgb(${WHITE})`; ctx.fillText('AKASH DASARRAJU', w / 2, h / 2);
        }
        ctx.font = `700 ${Math.max(11, px * 0.26)}px ${FONT}`; ctx.fillStyle = `rgba(${WHITE},${k})`;
        ctx.fillText(scramble('ML SYSTEMS  ·  LLM INFERENCE  ·  RESEARCH', clamp01(k * 1.3 - 0.3)), w / 2, h / 2 + px * 0.85);
      }
      // the frame as it breaks, kept for the shatter (before the flash, so the tiles hold the picture)
      if (t >= BREAK && !snap) {
        snap = document.createElement('canvas'); snap.width = cv.width; snap.height = cv.height; snap.getContext('2d').drawImage(cv, 0, 0);
        snapHub = ready.hubOnScreen(); root.classList.remove('intro-on');
      }
      if (t >= BREAK - 0.12) { ctx.fillStyle = `rgba(255,236,220,${0.7 * clamp01((t - BREAK + 0.12) / 0.12)})`; ctx.fillRect(0, 0, w, h); }
      // tearing on the cuts, and now and then between
      if (hit || Math.random() < 0.025) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < (hit ? 8 : 2); i++) { const y = Math.floor(Math.random() * cv.height), tall = Math.floor((3 + Math.random() * 34) * dpr), shove = (Math.random() - 0.5) * (hit ? 90 : 26) * dpr; ctx.drawImage(cv, 0, y, cv.width, tall, shove, y, cv.width, tall); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; for (let y = frame % 2; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      // letterbox bars: in at the signal, open again as the camera dives through; the shot and a timecode in them
      const bar = h * (narrow ? 0.06 : 0.085) * smooth(clamp01(t / 0.5)) * (1 - smooth(clamp01((t - DIVE - 0.2) / 0.7)));
      if (bar > 0.5) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar);
        ctx.font = `600 ${narrow ? 9 : 11}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(201,212,221,0.7)';
        const label = si === 0 ? 'AKASH DASARRAJU' : si < 4 ? `0${si}  ${WORDS[shot]}` : 'AKASH DASARRAJU';
        ctx.textAlign = 'left'; ctx.fillText(label, 18, bar / 2);
        const f = Math.floor(t * 24) % 24, sec = Math.floor(t);
        ctx.textAlign = 'right'; ctx.fillText(`00:00:${String(sec).padStart(2, '0')}:${String(f).padStart(2, '0')}`, w - 18, bar / 2);
        ctx.fillStyle = `rgba(${ORANGE},${Math.floor(t * 2) % 2 ? 0.9 : 0.25})`; ctx.beginPath(); ctx.arc(w - 18 - (narrow ? 78 : 96), bar / 2, 3.5, 0, 6.3); ctx.fill();
      }
      if (t > 1 && t < DIVE) { ctx.font = `500 12px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = 'rgba(201,212,221,0.55)'; ctx.fillText('click or press any key to skip', w - 18, h - h * (narrow ? 0.06 : 0.085) - 10); }
    };
    // the way out: the last frame breaks into tiles that fly out from the fan toward the lens, edges burning, and the
    // page is there behind them
    const shatter = (t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const tt = clamp01((t - BREAK) / (END - BREAK)), cols = w < 640 ? 9 : 18, tw = w / cols, rows = Math.ceil(h / tw), th = h / rows;
      const [hx, hy] = snapHub && snapHub[0] > 0 && snapHub[0] < w && snapHub[1] > 0 && snapHub[1] < h ? snapHub : [w / 2, h / 2], diag = Math.hypot(w, h);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * tw, y = j * th, cx = x + tw / 2, cy = y + th / 2, dx = cx - hx, dy = cy - hy, rnd = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
        const r = Math.abs(rnd), q = clamp01((tt - (Math.hypot(dx, dy) / diag) * 0.5 - r * 0.12) / 0.45);
        if (q >= 1) continue;
        const e = q * q;
        ctx.save(); ctx.globalAlpha = 1 - q;
        ctx.translate(cx + dx * e * 1.3, cy + dy * e * 1.3); ctx.rotate((r - 0.5) * e * 2.2); ctx.scale(1 + e * 2.2, 1 + e * 2.2);
        const sx = snap.width / w, sy = snap.height / h;   // the frame as saved, even if the window has changed since
        ctx.drawImage(snap, x * sx, y * sy, tw * sx, th * sy, -tw / 2 - 0.5, -th / 2 - 0.5, tw + 1, th + 1);
        if (q > 0) { ctx.strokeStyle = `rgba(${r < 0.3 ? CYAN : ORANGE},${0.9 * (1 - q)})`; ctx.lineWidth = 1.2; ctx.strokeRect(-tw / 2, -th / 2, tw, th); }
        ctx.restore();
      }
      if (tt < 0.18) { ctx.fillStyle = `rgba(255,236,220,${0.75 * (1 - tt / 0.18)})`; ctx.fillRect(0, 0, w, h); }
    };
    raf = requestAnimationFrame(draw);

    // load the models (and Bricolage, which the overlay draws in); if WebGL or the file fails, there's no intro
    Promise.all([build(), Promise.race([document.fonts?.load(`700 20px ${FONT}`), new Promise((r) => setTimeout(r, 400))]).catch(() => {})])
      .then(([r]) => { if (done) { r.dispose(); return; } ready = r; ready.resize(); t0 = performance.now(); })
      .catch(() => finish());
  });
}
