// UT Dallas at night: the building models from the HackUTD Zero Day map (public/data/campus3d.*), the rest of
// the OpenStreetMap footprints extruded, roads as faint lines, and an orange highlight for the building a
// tour heads into. Scene units are metres: x east, y up, z south.
import * as THREE from 'three';

// the scan: everything beyond uReveal metres of uCenter is not drawn yet, and the front glows as it passes
const U = { time: { value: 0 }, reveal: { value: 1e6 }, center: { value: new THREE.Vector2() } };
const SCAN = /* glsl */`
uniform float uReveal; uniform vec2 uCenter;
float scanFront(vec3 w){ float d = distance(w.xz, uCenter); if (d > uReveal) discard; return smoothstep(18.0, 0.0, uReveal - d) * step(uReveal, 5000.0); }`;
const WIN_VS = /* glsl */`
varying vec3 vW; varying vec3 vN;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WIN_FS = /* glsl */`
uniform float uTime; uniform float uSeed; uniform float uLit; uniform vec3 uTint;
varying vec3 vW; varying vec3 vN;
${SCAN}
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
void main(){
  float front = scanFront(vW);
  vec3 n = vN / max(length(vN), 1e-4);
  vec3 col;
  if (n.y > 0.5) col = vec3(0.006, 0.01, 0.009);
  else {
    vec2 t = normalize(vec2(-n.z, n.x) + 1e-5);
    vec2 g = vec2(dot(vW.xz, t) / 2.2, vW.y / 3.6);
    vec2 cell = floor(g), f = fract(g);
    float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.82);
    float r = h21(cell + uSeed * 17.13), r2 = h21(cell.yx + uSeed * 3.7 + 11.0);
    float lit = step(1.0 - uLit, r) * step(0.5, vW.y) * step(0.07, fract(h21(cell * 0.37 + 5.0) + uTime * 0.012));   // now and then one goes dark
    vec3 wc = r2 < 0.75 ? vec3(1.0, 0.78, 0.5) : vec3(0.75, 0.88, 1.0);
    vec3 base = vec3(0.008, 0.012, 0.011) + vec3(0.01, 0.016, 0.015) * max(dot(n, normalize(vec3(0.4, 0.5, 0.7))), 0.0);
    float aa = clamp(1.6 - length(fwidth(g)) * 2.2, 0.0, 1.0);
    vec3 detail = base + win * lit * wc * (0.35 + 0.6 * r2) + win * (1.0 - lit) * vec3(0.004, 0.007, 0.007);
    col = mix(base + uLit * 0.12 * vec3(1.0, 0.8, 0.55), detail, aa);
  }
  gl_FragColor = vec4(col + uTint + vec3(1.0, 0.45, 0.12) * front * 1.6, 1.0);
}`;
const winMat = (seed, lit) => new THREE.ShaderMaterial({ vertexShader: WIN_VS, fragmentShader: WIN_FS, uniforms: { uTime: U.time, uSeed: { value: seed }, uLit: { value: lit }, uTint: { value: new THREE.Color(0, 0, 0) }, uReveal: U.reveal, uCenter: U.center } });
// lines (roads, building edges) that take part in the scan
const lineMat = (color, opacity) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uReveal: U.reveal, uCenter: U.center },
  vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vW; ${SCAN}
    void main(){ float f = scanFront(vW); gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.55, 0.2) * 2.0, f), uOpacity + f); }`,
});

export async function buildCampus(base = 'data/') {
  const [manifest, bin, site] = await Promise.all([
    fetch(`${base}campus3d.json`).then((r) => r.json()),
    fetch(`${base}campus3d.bin`).then((r) => r.arrayBuffer()),
    fetch(`${base}site.json`).then((r) => r.json()),
  ]);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1512);
  scene.fog = new THREE.FogExp2(0x0a1512, 0.0011);

  // ground and roads
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShaderMaterial({
    uniforms: { uReveal: U.reveal, uCenter: U.center },
    vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform float uReveal; uniform vec2 uCenter; varying vec3 vW;
      void main(){
        vec2 q = vW.xz / 25.0, fw = fwidth(q), g = abs(fract(q - 0.5) - 0.5) / fw;
        float grid = (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.08, 0.35, max(fw.x, fw.y)));
        float d = distance(vW.xz, uCenter), inside = step(d, uReveal), ring = smoothstep(6.0, 0.0, abs(d - uReveal)) * step(uReveal, 5000.0);
        float fade = exp(-d * 0.0012);
        vec3 col = vec3(0.004, 0.0103, 0.008) * inside + vec3(0.05, 0.16, 0.13) * grid * fade * (0.25 + 0.75 * (1.0 - inside)) * 0.5;
        gl_FragColor = vec4(col + vec3(1.0, 0.5, 0.15) * ring * 1.8, 1.0);
      }`,
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const roadLines = (list, color, y) => {
    const pos = [];
    for (const r of list) for (let i = 2; i < r.length; i += 2) pos.push(r[i - 2], y, r[i - 1], r[i], y, r[i + 1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.LineSegments(g, lineMat(color, 0.9)));
  };
  roadLines(site.roads.path, 0x203a31, 0.02);
  roadLines(site.roads.service, 0x2f5246, 0.03);
  roadLines(site.roads.major, 0x4f7d6c, 0.04);

  // modelled buildings
  let seed = 1;
  for (const m of manifest.meshes) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, m.pos, m.count * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bin, m.nor, m.count * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(m.idx32 ? new Uint32Array(bin, m.idx, m.idxCount) : new Uint16Array(bin, m.idx, m.idxCount), 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, winMat(seed++ * 0.731, m.code ? 0.42 : 0.3));
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), lineMat(0x3f6f62, 0.55)));
    scene.add(mesh);
  }
  // footprints without a model, extruded
  const shapes = [];
  for (const f of site.footprints) {
    if (f.model) continue;
    const r = f.rings[0]; if (r.length < 8) continue;
    const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], -r[i + 1]));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: Math.max(4, f.h), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); shapes.push(g);
  }
  if (shapes.length) {
    const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
    const g = mergeGeometries(shapes.map((s) => (s.index ? s.toNonIndexed() : s)));
    scene.add(new THREE.Mesh(g, winMat(91.3, 0.18)));
  }
  scene.add(new THREE.HemisphereLight(0x9fc6b8, 0x0a1210, 0.6));

  // stars, some of them twinkling
  {
    const N = 1600, pos = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.283, e = Math.asin(Math.random()) * 0.95 + 0.03, r = 2600;
      pos.set([r * Math.cos(e) * Math.cos(a), r * Math.sin(e), r * Math.cos(e) * Math.sin(a)], i * 3); ph[i] = Math.random() * 6.283;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: U.time },
      vertexShader: 'attribute float phase; uniform float uTime; varying float vA; void main(){ vA = 0.5 + 0.5 * sin(uTime * (0.5 + fract(phase * 7.0)) + phase); gl_PointSize = 1.3 + 1.8 * fract(phase * 13.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), 0.25 + 0.6 * vA); }' }));
    stars.frustumCulled = false; scene.add(stars);
  }
  // traffic: headlights one way, taillights the other, running along the main roads
  const lanes = site.roads.major.map((r) => {
    const pts = [], cum = [0]; for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }).filter((l) => l.len > 80);
  const NC = 110, cars = [], cpos = new Float32Array(NC * 3), tone = new Float32Array(NC);
  for (let i = 0; i < NC; i++) { const l = lanes[Math.floor(Math.random() * lanes.length)], dir = Math.random() < 0.5 ? 1 : -1; cars.push({ l, dir, s: Math.random() * l.len, v: 8 + Math.random() * 8, i: 0 }); tone[i] = dir; }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3)); cg.setAttribute('tone', new THREE.BufferAttribute(tone, 1));
  const traffic = new THREE.Points(cg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uReveal: U.reveal, uCenter: U.center },
    vertexShader: 'attribute float tone; varying vec3 vW; varying float vT; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vT = tone; gl_PointSize = 3.0; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `varying vec3 vW; varying float vT; ${SCAN}
      void main(){ scanFront(vW); vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; vec3 c = vT > 0.0 ? vec3(1.0, 0.9, 0.7) : vec3(1.0, 0.22, 0.12); gl_FragColor = vec4(c * 1.5, 0.9); }` }));
  traffic.frustumCulled = false; scene.add(traffic);
  // a car keeps the index of the road segment it's on (c.i) and steps it as it moves, writing straight into cpos
  const place = (c, i) => {
    const { cum, pts } = c.l;
    while (c.i < cum.length - 2 && cum[c.i + 1] < c.s) c.i++;
    while (c.i > 0 && cum[c.i] > c.s) c.i--;
    const a = pts[c.i], b = pts[c.i + 1], k = (c.s - cum[c.i]) / Math.max(1e-6, cum[c.i + 1] - cum[c.i]);
    cpos[i * 3] = a.x + (b.x - a.x) * k; cpos[i * 3 + 1] = 0.9; cpos[i * 3 + 2] = a.y + (b.y - a.y) * k;
  };
  let lastT = 0;
  const drive = (t) => {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    cars.forEach((c, i) => {
      c.s += c.dir * c.v * dt;
      if (c.s < 0 || c.s > c.l.len) { c.dir *= -1; tone[i] = c.dir; c.s = Math.max(0, Math.min(c.l.len, c.s)); cg.attributes.tone.needsUpdate = true; }
      place(c, i);
    });
    cg.attributes.position.needsUpdate = true;
  };

  // where each building is, and a highlight that can be put on any of them
  const byCode = new Map();
  for (const f of site.footprints) if (f.code) {
    const r = f.rings[0]; let x = 0, z = 0; const n = r.length / 2;
    for (let i = 0; i < r.length; i += 2) { x += r[i]; z += r[i + 1]; }
    byCode.set(f.code, { center: new THREE.Vector3(x / n, 0, z / n), height: f.h, rings: f.rings, name: f.name });
  }
  const glow = new THREE.Group(); scene.add(glow);
  const shellMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uH: { value: 20 }, uOn: { value: 0 } },
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uH; uniform float uOn; varying float vY;
      void main(){ float k = clamp(vY / uH, 0.0, 1.0); float band = 0.5 + 0.5 * sin(vY * 0.9 - uTime * 3.0);
        float a = (pow(1.0 - k, 1.5) * 0.55 + 0.25 * band * (1.0 - k) + smoothstep(0.96, 1.0, k) * 1.2) * uOn;
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * a * 2.6, 1.0); }`,
  });
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOn: shellMat.uniforms.uOn },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uOn; varying float vY; void main(){ gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * pow(1.0 - vY, 2.0) * 0.9 * uOn, 1.0); }',
  });
  function highlight(code) {
    glow.clear();
    const b = byCode.get(code); if (!b) return null;
    const H = Math.max(8, b.height) + 3;
    shellMat.uniforms.uH.value = H;
    for (const r of b.rings) {
      const pos = [], idx = [];
      for (let i = 0; i < r.length; i += 2) { pos.push(r[i], 0, r[i + 1], r[i], H, r[i + 1]); }
      const n = r.length / 2;
      for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      glow.add(new THREE.Mesh(g, shellMat));
      const top = []; for (let i = 0; i < r.length; i += 2) top.push(r[i], H, r[i + 1]);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
      glow.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff9a4a })));
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.5, 160, 20, 1, true), beamMat);
    beam.geometry.translate(0, 80, 0); beam.position.set(b.center.x, H, b.center.z); glow.add(beam);
    return b;
  }
  return {
    scene, byCode, highlight, origin: site.origin,
    set glowOn(v) { shellMat.uniforms.uOn.value = v; },
    // scan campus in around a point: nothing at first, then a ring running outward that leaves the buildings behind it
    hold(center) { U.center.value.set(center.x, center.z); U.reveal.value = 0; },
    scan(center, secs = 2.6) {
      U.center.value.set(center.x, center.z); U.reveal.value = 0;
      const t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / (secs * 1000)); U.reveal.value = k < 1 ? 1400 * k * k * (3 - 2 * k) + 1 : 1e6; if (k < 1) requestAnimationFrame(step); };
      step();
    },
    update(t) { U.time.value = t; drive(t); },
  };
}
