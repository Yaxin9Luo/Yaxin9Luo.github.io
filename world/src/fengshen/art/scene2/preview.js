// A page to look at scene2 by itself. Nothing here is the game: the camera is framed as main.js frames it, and the
// figures (imported read-only from ../index.js) stand where a battle would, so that the scene can be judged behind them.
import { loadScene } from './index.js';

const Q = new URLSearchParams(location.search), num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d'), $ = (id) => document.getElementById(id);
if (Q.get('clean') === '1') document.body.classList.add('clean');
const scene = await loadScene(), PL = scene.info.places;
let art = null;
if (Q.get('figs') !== '0') { try { art = await (await import('../index.js')).loadArt({ lang: 'en' }); } catch (e) { console.warn('figures not loaded:', e.message); } }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const cam = { x: num('x', Q.has('place') ? PL[num('place', 1) - 1] : 560), y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
let W = 0, H = 0, dpr = 1, time = num('t', 0.5), ride = Q.get('auto') !== '0' && !Q.has('x') && !Q.has('place'), follow = !Q.has('t');
function fit() {
  W = num('w', innerWidth); H = num('h', innerHeight); dpr = num('dpr', Math.min(devicePixelRatio || 1, 2));
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  scene.setView({ width: W, height: H, dpr }); if (art) art.setView({ width: W, height: H, dpr });
  cam.zoom = num('zoom', 0.74 * clamp(W / H / 1.6, 0.8, 1.3)); cam.y = -(0.82 - 0.78) * 900 / cam.zoom;      // main.js: frameCam()
}
addEventListener('resize', fit); fit();

// figures to stand in front: the hero left of the middle, his warband behind, a block of Shang ahead
function people() {
  if (!art) return null;
  const kinds = art.debug.kinds, has = (k) => kinds.includes(k), vw = W / (H / 900 * cam.zoom), hx = cam.x - vw * 0.12;
  const zk = ['shield', 'soldier', 'spear', 'officer', 'archer'].filter(has), sk = ['spear', 'axe', 'archer', 'shield'].filter(has);
  let id = 1; const u = (side, kind, x, lane, state = 'idle') => ({ id: id++, side, kind, x, px: x, lane, facing: side === 'zhou' ? 1 : -1, hp: 3, maxHp: 3, state, stateT: 0.3, flash: 0, veteran: false });
  const units = [];
  [[90, 0, 'soldier'], [130, 1, 'officer'], [170, 2, 'soldier'], [215, 0, 'soldier'], [255, 1, 'soldier'], [300, 2, 'soldier']].forEach(([b, l, k]) => { if (has(k)) units.push(u('zhou', k, hx - b - 60, l)); else if (zk.length) units.push(u('zhou', zk[0], hx - b - 60, l)); });
  [[330, 0, 'spear', 'brace'], [380, 1, 'axe', 'idle'], [430, 2, 'spear', 'idle'], [470, 0, 'axe', 'windup'], [560, 1, 'archer', 'draw'], [600, 2, 'archer', 'idle']].forEach(([a, l, k, st]) => { if (has(k)) units.push(u('shang', k, hx + a, l, st)); else if (sk.length) units.push(u('shang', sk[0], hx + a, l)); });
  return { time: 0, hero: { x: hx, y: 0, px: hx, py: 0, vx: 0, vy: 0, facing: 1, hp: 5, maxHp: 5, state: 'ride', stateT: 0.4, topSpeed: 520, blade: 1, safe: 0, hold: 0, fullCry: false, cd: { gallop: 0, rally: 0 }, buffs: [], boons: [] }, units, arrows: [], events: [] };
}
function draw(dt) {
  if (follow) time = clamp((cam.x - 273) / (4527 - 273), 0, 1);
  scene.setTime(time); if (art) art.setTime(time);
  scene.drawBack(ctx, cam); scene.drawMid(ctx, cam, dt);
  if (art && $('figs').checked) { const g = people(); try { art.drawFigures(ctx, cam, g, 1, dt); } catch (e) { if (!draw.warned) { draw.warned = true; console.warn('figures:', e.message); } } }
  scene.drawFront(ctx, cam, dt);
}
const ready = () => { document.title = 'ready'; };
window.preview = { scene, art, cam, set(x, t) { cam.x = x; if (t != null) { time = t; follow = false; } }, step(sec = 1 / 60, n = 1) { for (let i = 0; i < n; i++) draw(sec); }, people };

if (Q.get('mode') === 'bench') {
  const n = num('n', 600), part = { back: [], mid: [], front: [], all: [], gap: [] }; let i = 0, last = performance.now();
  document.body.classList.add('clean');
  const tick = () => {
    const t = performance.now(); if (i > 20) part.gap.push(t - last); last = t;
    cam.x = 273 + ((i * 7.1) % 4254); scene.setTime((i / n)); 
    const a = performance.now(); scene.drawBack(ctx, cam); const b = performance.now(); scene.drawMid(ctx, cam, 1 / 60); const c = performance.now(); scene.drawFront(ctx, cam, 1 / 60); const d = performance.now();
    if (i > 20) { part.back.push(b - a); part.mid.push(c - b); part.front.push(d - c); part.all.push(d - a); }
    if (++i < n) requestAnimationFrame(tick);
    else { const st = (v) => { v = [...v].sort((p, q) => p - q); return { mean: +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(3), p95: +v[Math.floor(v.length * 0.95)].toFixed(3), max: +v[v.length - 1].toFixed(3) }; };
      window.__bench = { view: [W, H], dpr, frames: part.all.length, all: st(part.all), drawBack: st(part.back), drawMid: st(part.mid), drawFront: st(part.front), frameGap: st(part.gap) }; ready(); }
  };
  requestAnimationFrame(tick);
} else {
  $('x').value = cam.x; $('t').value = time; $('ride').checked = ride; $('auto').checked = follow; if (Q.get('figs') === '0') $('figs').checked = false;
  $('x').oninput = (e) => { cam.x = +e.target.value; ride = $('ride').checked = false; };
  $('t').oninput = (e) => { time = +e.target.value; follow = $('auto').checked = false; };
  $('ride').onchange = (e) => { ride = e.target.checked; }; $('auto').onchange = (e) => { follow = e.target.checked; };
  addEventListener('keydown', (e) => { if (e.key >= '1' && e.key <= '5') { cam.x = PL[+e.key - 1]; ride = $('ride').checked = false; } if (e.key === ' ') { ride = !ride; $('ride').checked = ride; } });
  let last = performance.now(), dir = 1;
  const loop = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (ride) { cam.x += dir * 150 * dt; if (cam.x > 4527) { cam.x = 4527; dir = -1; } if (cam.x < 273) { cam.x = 273; dir = 1; } $('x').value = cam.x; }
    if (follow) $('t').value = time;
    draw(dt); $('hud').textContent = `x ${cam.x.toFixed(0)}  time ${time.toFixed(2)}`;
    if (Q.get('auto') !== '0') requestAnimationFrame(loop); };
  if (Q.get('auto') === '0') { for (let i = 0; i < 12; i++) draw(1 / 60); ready(); } else { requestAnimationFrame(loop); ready(); }
}
