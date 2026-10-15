// The hello on the way in: a little while after the page loads, me (the orange avatar from the tours) pops up in
// the corner, waves, and says the page is interactive. Its own small WebGL canvas, loaded only when it shows, and
// torn down when it's dismissed. main.js decides whether it shows at all (every load, but not once a tour has been opened).
import * as THREE from 'three';
import { makeAvatar } from './tour/people.js';

export const SAY = 'This website is interactive. Make sure to click on the orange links to see everything it has to offer.';

export async function show({ onDone } = {}) {
  const box = document.createElement('aside');
  box.className = 'hello'; box.setAttribute('aria-label', 'A note about this page');
  box.innerHTML = `<canvas class="hello-me" width="200" height="260" aria-hidden="true"></canvas>
    <div class="hello-say"><p aria-hidden="true"></p><span class="sr-only" role="status"></span><button type="button" class="hello-ok">Got it</button></div>`;
  const cv = box.querySelector('canvas'), say = box.querySelector('p'), ok = box.querySelector('.hello-ok'), sr = box.querySelector('[role="status"]');

  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(200, 260, false);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 200 / 260, 0.1, 50);
  camera.position.set(0.15, 1.15, 4.4); camera.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1));
  const me = await makeAvatar(new THREE.Vector3(0, 0, 0), -0.25, 1, 'wave');
  scene.add(me.group);
  document.body.append(box);

  // it pops up out of the corner with a little overshoot, then the words type out
  let raf = 0, done = false;
  const t0 = performance.now(), pop = (k) => (k >= 1 ? 1 : 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2));
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000, k = Math.min(1, t / 0.7), s = Math.max(0.001, pop(k));
    me.group.scale.setScalar(s); me.group.position.y = (1 - Math.min(1, k)) * -1.2;
    me.update(t); renderer.render(scene, camera);
  };
  frame();
  requestAnimationFrame(() => box.classList.add('on'));
  setTimeout(() => {
    if (done) return;
    sr.textContent = SAY;
    let i = 0; const type = setInterval(() => { say.textContent = SAY.slice(0, (i += 2)); if (i >= SAY.length || done) clearInterval(type); }, 22);
    document.body.classList.add('hinting');
    setTimeout(() => document.body.classList.remove('hinting'), 3200);
  }, 650);

  const hide = () => {
    if (done) return; done = true;
    box.classList.remove('on'); document.body.classList.remove('hinting');
    setTimeout(() => { cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss(); box.remove(); onDone?.(); }, 400);
  };
  ok.addEventListener('click', hide);
  return { hide };
}
