// The preview of fx2: a stage, a button for every event and boon, slow motion, a frame stepper.
// It reads the game's art (paper, figures) from ../index.js and never writes to it.
import { loadFx } from './index.js';
import { loadArt } from '../index.js';

const Q = new URLSearchParams(location.search), STEP = 1 / 60;
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
const [art, fx] = await Promise.all([loadArt({}), loadFx()]);
const st = { slow: 1, paused: Q.get('auto') === '0', sil: false, only: false, ride: false, fig: Q.get('fig') !== '0', time: 0, t: 0, ms: 0, frames: 0 };
const cam = { x: 700, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
let W = 0, H = 0, dpr = 1, off = null, octx = null;
function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); art.setView({ width: W, height: H, dpr });
  off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height; octx = off.getContext('2d'); }
size(); addEventListener('resize', size);

// ---------------------------------------------------------------- the stage: the hero, a few of his men, a few foes
let id = 1;
const unit = (side, kind, x, lane, state = 'idle') => ({ id: id++, side, kind, x, px: x, lane, facing: side === 'zhou' ? 1 : -1, hp: 3, maxHp: 3, state, stateT: 0.3, flash: 0 });
const kinds = art.debug.kinds, zk = kinds.filter((k) => ['soldier', 'officer', 'shield'].includes(k)), sk = kinds.filter((k) => ['spear', 'axe', 'archer'].includes(k));
const game = { time: 0, hero: null, units: [], arrows: [], events: [] };
const queue = [];                                             // events to come: {t, e}
function reset() {
  fx.onEvent({ type: 'fx:clear' }); queue.length = 0; st.t = 0;
  game.hero = { x: 560, y: 0, px: 560, py: 0, vx: 0, vy: 0, facing: 1, hp: 5, maxHp: 5, state: 'ride', stateT: 0, topSpeed: 520, blade: 1, safe: 0, boons: [], fullCry: false };
  game.units = [unit('zhou', zk[0] || kinds[0], 400, 0), unit('zhou', zk[1] || zk[0] || kinds[0], 440, 1), unit('zhou', zk[0] || kinds[0], 360, 2),
    unit('shang', sk[0] || kinds[0], 720, 0), unit('shang', sk[1] || kinds[0], 790, 1), unit('shang', sk[2] || kinds[0], 940, 0), unit('shang', sk[1] || kinds[0], 1010, 2)];
  game.units.push({ ...unit('shang', 'captain', 1010, 2), id: 999 });                   // not drawn by the art yet: it only tells the horn where to sound
  cam.x = 700;
}
reset();
const foe = (i = 0) => game.units.filter((u) => u.side === 'shang' && u.kind !== 'captain')[i];
const at = (t, e) => queue.push({ t: st.t + t, e });
const pose = (state, dur) => { const h = game.hero; h.state = state; h.stateT = 0; queue.push({ t: st.t + dur, f: () => { h.state = 'ride'; h.stateT = 0; } }); };
const boon = (id, element) => { if (!game.hero.boons.some((b) => b.id === id)) game.hero.boons.push({ id, element }); };
const FEEDER = { fire: ['galeLeap', 'wood'], earth: ['emberBlade', 'fire'], metal: ['quake', 'earth'], water: ['keenEdge', 'metal'], wood: ['coldTide', 'water'] };
let threadOn = false;
const feed = (el) => { if (threadOn) boon(...FEEDER[el]); };

// every effect, by name: what the simulation would send
const hx = () => game.hero.x, HY = 66;
const swing = (el) => { feed(el || 'fire'); pose('strike', 0.37); at(0, { type: 'swing', x: hx(), y: HY, dir: 1, element: el }); };
const hitAt = (t, mult, o = {}) => at(t, { type: 'hit', x: foe(0).x - 16, y: 38, dmg: 10 * mult, mult, kill: false, dir: 1, ...o });
const FIRE = {
  'strike': () => { swing(); hitAt(0.065, 1); },
  'strike (no hit)': () => swing(),
  'strike · fire (emberBlade)': () => { swing('fire'); hitAt(0.065, 1); },
  'strike · water': () => { swing('water'); hitAt(0.065, 1, { element: 'water' }); },
  'strike · wood': () => { swing('wood'); hitAt(0.065, 1, { element: 'wood' }); },
  'strike · metal (keenEdge)': () => { swing('metal'); hitAt(0.065, 2, { element: 'metal' }); },
  'strike · earth': () => { swing('earth'); hitAt(0.065, 1, { element: 'earth' }); },
  'sweep': () => { pose('strike', 0.4); at(0, { type: 'sweep', x: hx(), y: HY, dir: 1, full: false }); hitAt(0.065, 1.6); at(0.1, { type: 'hit', x: foe(1).x - 16, y: 44, mult: 1.6, dir: 1 }); },
  'sweep · full': () => { pose('strike', 0.45); at(0, { type: 'sweep', x: hx(), y: HY, dir: 1, full: true }); hitAt(0.1, 2); at(0.11, { type: 'hit', x: foe(1).x - 16, y: 44, mult: 2, dir: 1 }); },
  'sweep · water (coldTide)': () => { feed('water'); pose('strike', 0.4); at(0, { type: 'sweep', x: hx(), y: HY, dir: 1, full: false, element: 'water' }); },
  'leap strike': () => at(0, { type: 'shock', x: hx() + 90, y: 0, power: 1 }),
  'leap strike · wood (galeLeap)': () => { feed('wood'); at(0, { type: 'shock', x: hx() + 90, y: 0, power: 1, element: 'wood' }); },
  'leap strike · earth (quake)': () => { feed('earth'); at(0, { type: 'shock', x: hx() + 90, y: 0, power: 1.2, element: 'earth' }); },
  'break-through (1 s)': () => { const h = game.hero; h.vx = 500; st.ride = true; at(0, { type: 'fullCry', on: true }); at(0.5, { type: 'trample', x: 0, y: 0, kill: true, $atHero: true }); at(1.0, { type: 'fullCry', on: false }); queue.push({ t: st.t + 1.0, f: () => { h.vx = 0; st.ride = false; } }); },
  'flame gallop': () => gallop(false),
  'flame gallop · wildfire': () => gallop(true),
  'rally': () => { pose('ride', 0.1); at(0, { type: 'rally', x: hx(), y: 0 }); },
  'hit ×1': () => hitAt(0, 1), 'hit ×2': () => hitAt(0, 2), 'hit ×3': () => hitAt(0, 3), 'hit ×3 kill': () => hitAt(0, 3, { kill: true }),
  'gold blow (keenEdge)': () => { feed('metal'); boon('keenEdge', 'metal'); at(0, { type: 'crit', x: foe(0).x - 16, y: 38, dir: 1 }); hitAt(0, 2); },
  'clash': () => at(0, { type: 'clash', x: foe(1).x - 30, y: 36, side: 'zhou', kill: false }),
  'clash · kill (death mark)': () => at(0, { type: 'clash', x: foe(1).x - 30, y: 36, side: 'zhou', kill: true }),
  'shield block': () => at(0, { type: 'blocked', x: foe(0).x - 20, y: 40, dir: 1 }),
  'shield block · mirrorShields': () => { feed('metal'); at(0, { type: 'blocked', x: 430, y: 44, dir: -1, reflect: true, back: 1 }); },
  'braced (hero stopped)': () => at(0, { type: 'braced', x: foe(0).x - 24, y: 34, dir: 1 }),
  'braced · deepRoots breaks it': () => { feed('earth'); at(0, { type: 'braced', x: foe(0).x - 24, y: 34, dir: 1, broken: true }); },
  'trample': () => at(0, { type: 'trample', x: hx() + 40, y: 0, kill: false }),
  'trample · kill': () => at(0, { type: 'trample', x: hx() + 40, y: 0, kill: true }),
  'arrow hit': () => { at(0, { type: 'arrowHit', x: 430, y: 40 }); at(0.12, { type: 'arrowHit', x: 500, y: 0 }); },
  'loose · arrowRain': () => { feed('wood'); boon('arrowRain', 'wood'); at(0, { type: 'loose', x: 400, y: 44, side: 'zhou', dir: 1 }); },
  'mend (spring)': () => { feed('water'); boon('spring', 'water'); at(0, { type: 'cleared', x: hx(), y: 0 }); },
  'hurt': () => at(0, { type: 'hurt', x: hx(), y: HY, dmg: 10, by: 'axe' }),
  'fall': () => { at(0, { type: 'fall', x: hx(), y: 0, dir: -1 }); },
  'leap + land': () => { at(0, { type: 'leap', x: hx(), y: 0 }); at(0.4, { type: 'land', x: hx() + 120, y: 0, speed: 480 }); },
  "captain's horn": () => at(0, { type: 'captainHorn', x: 1010, y: 0 }),
  'boon · fire': () => at(0, { type: 'boon', id: 'emberBlade', element: 'fire' }),
  'boon · water': () => at(0, { type: 'boon', id: 'coldTide', element: 'water' }),
  'boon · wood': () => at(0, { type: 'boon', id: 'galeLeap', element: 'wood' }),
  'boon · metal': () => at(0, { type: 'boon', id: 'keenEdge', element: 'metal' }),
  'boon · earth': () => at(0, { type: 'boon', id: 'quake', element: 'earth' }),
};
function gallop(wild) {
  const h = game.hero; if (wild) boon('wildfire', 'fire'); feed('fire');
  h.vx = 832; st.ride = true; at(0, { type: 'dash', x: hx(), y: 0 });
  for (let i = 1; i <= (wild ? 60 : 30); i++) queue.push({ t: st.t + i * STEP, f: () => fx.onEvent({ type: 'trail', x0: h.x - 832 * STEP, x1: h.x }, game) });
  queue.push({ t: st.t + (wild ? 1.0 : 0.5), f: () => { h.vx = 0; st.ride = false; } });
}
const fire = (name) => { if (!FIRE[name]) throw new Error('no effect ' + name); FIRE[name](); };

// ---------------------------------------------------------------- the clock and the picture
function tick(dt) {
  st.t += dt; const h = game.hero;
  h.px = h.x; h.x += h.vx * dt; h.stateT += dt;
  if (st.ride) cam.x = h.x + 140;
  for (const u of game.units) u.stateT += dt;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t <= st.t + 1e-9) { const q = queue.splice(i, 1)[0]; if (q.f) q.f(); else { if (q.e.$atHero) q.e.x = h.x + 30; fx.onEvent(q.e, game); } }
}
function render(dt) {
  const t0 = performance.now(); let ms = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (st.only || st.sil) { ctx.globalAlpha = 1; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(0, 0, canvas.width, canvas.height); } else art.drawBack(ctx, cam);
  const target = st.sil ? octx : ctx;
  if (st.sil) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-over'; octx.clearRect(0, 0, off.width, off.height); }
  let a = performance.now(); fx.drawUnder(target, cam, dt); ms += performance.now() - a;
  if (st.fig && !st.only && !st.sil) { art.drawFigures(ctx, cam, game, 1, dt); art.drawFront(ctx, cam); }
  a = performance.now(); fx.drawOver(target, cam, dt); ms += performance.now() - a;
  if (st.sil) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#14110F'; octx.fillRect(0, 0, off.width, off.height); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); }
  st.ms += (ms - st.ms) * 0.05; void t0;
  return ms;
}
const step = (n = 1) => { let ms = 0; for (let i = 0; i < n; i++) { tick(STEP); ms = render(STEP); } return ms; };
let last = performance.now(), acc = 0;
function loop(now) {
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  if (!st.paused) { acc += real / st.slow; let n = 0; while (acc >= STEP && n++ < 4) { acc -= STEP; tick(STEP); render(STEP); } if (!n && st.slow === 1) render(0); }
  hud.textContent = `fx ${st.ms.toFixed(2)} ms   t ${st.t.toFixed(2)} s${st.slow !== 1 ? '   slow ×' + st.slow : ''}${st.paused ? '   paused' : ''}`;
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- the panel
const panel = document.getElementById('panel');
const group = (title) => { const h = document.createElement('h4'); h.textContent = title; panel.append(h); };
const button = (label, f, toggle) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { const on = f(); if (toggle) b.classList.toggle('on', !!on); }; panel.append(b); return b; };
group('clock');
button('pause', () => (st.paused = !st.paused), true).classList.toggle('on', st.paused);
button('step ▸', () => { st.paused = true; step(1); });
button('slow ×4', () => (st.slow = st.slow === 4 ? 1 : 4), true);
button('slow ×10', () => (st.slow = st.slow === 10 ? 1 : 10), true);
button('reset', () => reset());
group('view');
button('silhouette', () => (st.sil = !st.sil), true);
button('effects only', () => (st.only = !st.only), true);
button('dusk', () => { st.time = st.time ? 0 : 1; art.setTime(st.time); fx.setTime(st.time); return st.time; }, true);
button('thread of the feeding pigment', () => (threadOn = !threadOn), true);
let g = '';
for (const name of Object.keys(FIRE)) {
  const k = name.startsWith('boon') ? 'the moment a boon is picked' : /strike|sweep|break|gallop|rally/.test(name) ? 'the six verbs, and their elements' : 'impacts and the rest';
  if (k !== g) group(g = k);
  button(name, () => fire(name));
}
const hud = document.createElement('div'); hud.id = 'hud'; panel.append(hud);
if (Q.get('clean') === '1') document.body.classList.add('clean');
addEventListener('keydown', (e) => { if (e.key === ' ') { st.paused = !st.paused; e.preventDefault(); } else if (e.key === '.') { st.paused = true; step(1); } else if (e.key === '[') st.slow = Math.min(16, st.slow * 2); else if (e.key === ']') st.slow = Math.max(1, st.slow / 2); });

// a heavy fight for the bench: every 1/60 s some events, as a battle of 30 with the hero in it would send
let bk = 0;
function benchStart() {
  reset(); st.paused = true; bk = 0;
  boon('emberBlade', 'fire'); boon('coldTide', 'water'); boon('quake', 'earth'); boon('wildfire', 'fire'); boon('keenEdge', 'metal');
}
function benchFrame(f) {
  const h = game.hero, x = () => h.x + 80 + ((bk++ * 97) % 500);
  if (f % 4 === 0) fx.onEvent({ type: 'clash', x: x(), y: 36, side: bk % 2 ? 'zhou' : 'shang', kill: bk % 5 === 0 }, game);
  if (f % 9 === 0) fx.onEvent({ type: 'arrowHit', x: x(), y: bk % 3 ? 40 : 0 }, game);
  if (f % 13 === 0) fx.onEvent({ type: 'blocked', x: x(), y: 40, dir: 1 }, game);
  if (f % 30 === 0) { fx.onEvent({ type: 'swing', x: h.x, y: 66, dir: 1 }, game); queue.push({ t: st.t + 0.1, e: { type: 'hit', x: h.x + 120, y: 38, mult: 1 + (bk % 3), kill: bk % 2 === 0, dir: 1 } }); }
  if (f % 30 === 15) fx.onEvent({ type: 'trample', x: h.x + 40, y: 0, kill: true }, game);
  if (f % 120 === 40) fx.onEvent({ type: 'sweep', x: h.x, y: 66, dir: 1, full: true }, game);
  if (f % 120 === 80) fx.onEvent({ type: 'shock', x: h.x + 90, y: 0, power: 1.2 }, game);
  if (f % 180 === 20) fx.onEvent({ type: 'rally' }, game);
  if (f % 240 === 100) { fx.onEvent({ type: 'dash' }, game); for (let i = 1; i <= 30; i++) queue.push({ t: st.t + i * STEP, f: () => fx.onEvent({ type: 'trail', x0: h.x - 14, x1: h.x }, game) }); }
  if (f === 60) fx.onEvent({ type: 'fullCry', on: true }, game);
  h.vx = 300; st.ride = true;
  tick(STEP); return render(STEP);
}
// a heavy fight: a battle of 30 with the hero in it and five boons owned, one frame per animation frame (as the game runs)
async function bench(seconds = 8) {
  benchStart(); let sum = 0, n = 0, worst = 0; const all = [];
  for (let f = 0; f < seconds * 60; f++) { await new Promise((r) => requestAnimationFrame(r)); const ms = benchFrame(f); if (f > 30) { sum += ms; n++; worst = Math.max(worst, ms); all.push(ms); } }
  game.hero.vx = 0; st.ride = false; all.sort((a, b) => a - b);
  return { avgMs: +(sum / n).toFixed(3), medianMs: +all[n >> 1].toFixed(3), p95Ms: +all[Math.floor(n * 0.95)].toFixed(3), worstMs: +worst.toFixed(2), frames: n, width: canvas.width, height: canvas.height, dpr };
}

// how long each effect is on the sheet, with the hero riding at `speed`: frames (60 a second) until nothing of it is alive
// in front of the figures, and until nothing is alive at all; and the most strokes it had alive at once
function lifetimes(speed = 480) {
  const out = {};
  for (const name of Object.keys(FIRE)) {
    reset(); st.paused = true; const h = game.hero; h.vx = speed; st.ride = true; step(2);
    const keep = name.startsWith('break') || name.startsWith('flame'); fire(name); if (!keep) { h.vx = speed; st.ride = true; }
    let over = 0, all = 0, peak = 0;
    for (let f = 1; f <= 400; f++) { step(1); if (!keep) { h.vx = speed; st.ride = true; } const c = { type: 'fx:count' }; fx.onEvent(c, game); const n = c.over + c.under;
      if (c.over + (queue.length ? 1 : 0) > 0) over = f; if (n + c.waiting + queue.length > 0) all = f; peak = Math.max(peak, n); if (!n && !c.waiting && !queue.length) break; }
    out[name] = { overS: +(over / 60).toFixed(2), allS: +(all / 60).toFixed(2), peak };
  }
  reset(); return out;
}
// ---------------------------------------------------------------- sampling: does paint cover a telegraph? does the ground become a stripe?
// A scripted close fight: six foes in three ranks just ahead of the hero, each winding up for 0.5 s of every 1.6 s; the hero
// strikes every 0.6 s (multipliers 1 .. 3.3 in turn), sweeps every 2.5 s, leap-strikes every 4 s; the lines clash, arrows land,
// hooves trample. Every frame the strokes in front of the figures are drawn alone and the share of each winding-up foe's
// box (50 x 60 units, as the tester's) that is under paint of more than 43% cover is counted. Every half second the marks
// under the figures are drawn alone and the ground band (world y -30 .. 20, 1000 units round the hero) is measured.
const OFFS = [70, 110, 150, 200, 250, 310], MULTS = [1, 1.4, 2, 2.6, 3.3];
function sample({ seconds = 40, speed = 150 } = {}) {
  reset(); st.paused = true; const h = game.hero, foes = OFFS.map((d, i) => unit('shang', sk[i % sk.length] || kinds[0], h.x + d, i % 3));
  game.units = [...game.units.filter((u) => u.side === 'zhou'), ...foes];
  const pass = document.createElement('canvas'); pass.width = canvas.width; pass.height = canvas.height; const pc = pass.getContext('2d', { willReadFrequently: true });
  const k = canvas.width / W, T = { frames: 0, sum: 0, over10: 0, over25: 0, runs: [], run: new Map() }, M = { n: 0, share: 0, alpha: 0, stripe: 0, maxShare: 0, maxStripe: 0 };
  let c = 0;
  for (let f = 0; f < seconds * 60; f++) {
    h.vx = speed; st.ride = speed > 0; foes.forEach((u, i) => { u.px = u.x; u.x = h.x + OFFS[i]; const ph = (f / 60 + i * 0.27) % 1.6; u.state = ph < 0.5 ? 'windup' : 'idle'; u.stateT = ph < 0.5 ? ph : 0.3; });
    const near = foes[(c >> 2) % 2];
    if (f % 36 === 0) { fx.onEvent({ type: 'swing', x: h.x, y: 66, dir: 1 }, game); const mult = MULTS[(f / 36) % 5]; queue.push({ t: st.t + 0.065, e: { type: 'hit', x: near.x, y: 36, mult, dmg: 10 * mult, kill: mult > 2.5, dir: 1, by: 'strike' } }); }
    if (f % 150 === 60) { fx.onEvent({ type: 'sweep', x: h.x, y: 66, dir: 1, full: (f / 150 | 0) % 2 === 1 }, game); for (let i = 0; i < 4; i++) queue.push({ t: st.t + 0.07, e: { type: 'hit', x: foes[i].x, y: 36, mult: 1.6 + 0.4 * (i % 2), kill: i === 1, dir: 1, by: 'sweep' } }); }
    if (f % 240 === 120) { fx.onEvent({ type: 'shock', x: h.x + 90, y: 0, power: 1 }, game); for (let i = 0; i < 2; i++) fx.onEvent({ type: 'hit', x: foes[i].x, y: 22, mult: 1.5, kill: false, dir: 1, by: 'leapStrike' }, game); }
    if (f % 8 === 0) { c++; fx.onEvent({ type: 'clash', x: foes[c % 6].x - 16, y: 36, side: c % 2 ? 'zhou' : 'shang', kill: c % 5 === 0 }, game); }
    if (f % 45 === 20) fx.onEvent({ type: 'trample', x: h.x + 40, y: 0, kill: true }, game);
    if (f % 20 === 7) fx.onEvent({ type: 'arrowHit', x: h.x - 60 + (c * 37) % 200, y: c % 3 ? 40 : 0 }, game);
    tick(STEP); render(STEP);
    // the strokes in front of the figures, alone
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = 'source-over'; pc.globalAlpha = 1; pc.clearRect(0, 0, pass.width, pass.height); fx.drawOver(pc, cam, 0);
    for (const u of foes) { const key = u.id;
      if (u.state !== 'windup') { if (T.run.get(key)) T.runs.push(T.run.get(key)); T.run.set(key, 0); continue; }
      const [sx, sy] = art.toScreen(cam, u.x, 12 + 22 * u.lane), z = cam.zoom * H / 900, w = Math.round(50 * z * k), hh = Math.round(60 * z * k);
      const d = pc.getImageData(Math.round((sx - 25 * z) * k), Math.round((sy - 60 * z) * k), w, hh).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 110) n++;
      const share = n / (w * hh); T.frames++; T.sum += share; if (share > 0.1) T.over10++; if (share > 0.25) { T.over25++; T.run.set(key, (T.run.get(key) || 0) + 1); } else { if (T.run.get(key)) T.runs.push(T.run.get(key)); T.run.set(key, 0); } }
    // the marks under the figures, alone
    if (f % 30 === 29 && f > 300) { pc.clearRect(0, 0, pass.width, pass.height); fx.drawUnder(pc, cam, 0);
      const [x0, y0] = art.toScreen(cam, h.x - 400, 20), [x1, y1] = art.toScreen(cam, h.x + 600, -30), w = Math.round((x1 - x0) * k), hh = Math.max(1, Math.round((y1 - y0) * k));
      const d = pc.getImageData(Math.round(x0 * k), Math.round(y0 * k), w, hh).data; let n = 0, a = 0, runLen = 0, best = 0;
      for (let x = 0; x < w; x++) { let col = 0; for (let y = 0; y < hh; y++) { const v = d[(y * w + x) * 4 + 3]; a += v; if (v > 40) { n++; if (v > 60) col = 1; } } runLen = col ? runLen + 1 : 0; if (runLen > best) best = runLen; }
      const share = n / (w * hh), stripe = best / (w / 1000); M.n++; M.share += share; M.alpha += a / (w * hh) / 255; M.stripe += stripe; M.maxShare = Math.max(M.maxShare, share); M.maxStripe = Math.max(M.maxStripe, stripe); }
  }
  h.vx = 0; st.ride = false; T.runs.sort((a, b) => a - b);
  const pct = (v) => +(100 * v).toFixed(1);
  return { seconds, speed, telegraph: { framesSampled: T.frames, meanSharePct: pct(T.sum / T.frames), framesOver10Pct: pct(T.over10 / T.frames), framesOver25Pct: pct(T.over25 / T.frames), longestRunOver25Frames: T.runs.length ? T.runs[T.runs.length - 1] : 0, runsOver25LongerThan3Frames: T.runs.filter((r) => r > 3).length },
    ground: { samples: M.n, meanSharePaintedPct: pct(M.share / M.n), maxSharePaintedPct: pct(M.maxShare), meanCoverPct: pct(M.alpha / M.n), meanLongestUnbrokenRunUnits: Math.round(M.stripe / M.n), maxLongestUnbrokenRunUnits: Math.round(M.maxStripe) } };
}
// the picture of one hit by its multiplier: paint (pixels of more than 43% cover) in front of the figures at its fullest, and how far from the hit it reaches
function hitSizes(mults = [1, 1.5, 2, 2.5, 3, 3.5], blow = false) {   // blow: the whole strike (the rider's stroke at that speed, then the hit), not the hit alone
  const pass = document.createElement('canvas'); pass.width = canvas.width; pass.height = canvas.height; const pc = pass.getContext('2d', { willReadFrequently: true }), k = canvas.width / W, out = [];
  for (const mult of mults) { let peak = 0, reach = 0, strokes = 0, n = 0;
    for (let rep = 0; rep < 6; rep++) { reset(); st.paused = true; step(2); let x = foe(0).x - 16; const ev = { type: 'hit', x, y: 38, mult, dmg: 10 * mult, kill: false, dir: 1, by: 'strike' };
      if (blow) { const h = game.hero; h.vx = (mult - 1) * 200; h.x = x - 120 - h.vx * 0.065; h.px = h.x; cam.x = x; fx.onEvent({ type: 'swing', x: h.x, y: 66, dir: 1 }, game); queue.push({ t: st.t + 0.065, e: ev }); } else fx.onEvent(ev, game);
      const cnt = { type: 'fx:count' }; let pk = 0, far = 0, most = 0;
      for (let f = 0; f < (blow ? 18 : 14); f++) { step(1); fx.onEvent(cnt, game); most = Math.max(most, cnt.over + cnt.under);
        pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, pass.width, pass.height); fx.drawOver(pc, cam, 0);
        const [sx, sy] = art.toScreen(cam, x, 38), R = Math.round(330 * k), X0 = Math.max(0, Math.round(sx * k) - R), Y0 = Math.max(0, Math.round(sy * k) - R), d = pc.getImageData(X0, Y0, 2 * R, 2 * R).data; let c = 0, fr = 0;
        for (let i = 3, q = 0; i < d.length; i += 4, q++) if (d[i] > 110) { c++; const dx = (q % (2 * R)) - R, dy = ((q / (2 * R)) | 0) - R, r2 = dx * dx + dy * dy; if (r2 > fr) fr = r2; }
        if (c > pk) pk = c; far = Math.max(far, Math.sqrt(fr) / k); }
      peak += pk / (k * k); reach += far; strokes += most; n++; }
    out.push({ mult, peakPaintPx: Math.round(peak / n), reachPx: Math.round(reach / n), strokesAlive: +(strokes / n).toFixed(1) }); }
  reset(); const base = out[0]; for (const o of out) { o.paintVs1x = +(o.peakPaintPx / base.peakPaintPx).toFixed(2); o.reachVs1x = +(o.reachPx / base.reachPx).toFixed(2); }
  return out;
}
// one whole strike at multiplier m on a foe at x: the swing now, the hit when the stroke's tail arrives
function blow(m, x) { const h = game.hero; pose('strike', 0.37); h.vx = (m - 1) * 200; fx.onEvent({ type: 'swing', x: h.x, y: 66, dir: 1 }, game); queue.push({ t: st.t + 0.065, e: { type: 'hit', x, y: 38, mult: m, dmg: 10 * m, kill: false, dir: 1, by: 'strike' } }); queue.push({ t: st.t + 0.07, f: () => { h.vx = 0; } }); }
window.fxp = { sample, hitSizes, blow, fire, step, reset, bench, benchStart, benchFrame, lifetimes, names: Object.keys(FIRE), game, cam, st,
  set(o) { Object.assign(st, o); if (o.time != null) { art.setTime(o.time); fx.setTime(o.time); } if (o.thread != null) threadOn = o.thread; },
  toScreen: (x, y) => art.toScreen(cam, x, y) };
render(0);
requestAnimationFrame(loop);
document.title = 'ready';
