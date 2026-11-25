// The art module's own page: see the options in preview.html. Drives art/index.js from the real rules without
// spawning, or from a scripted fake game of the same shape.
import { loadArt } from './index.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? +q.get(k) : d);
const N = num('n', 120), MEN = num('allies', 14), TIME = num('time', 0.5), ZOOM = num('zoom', 1), STILL = q.get('still') === '1', WARM = num('warm', 2.5), SEED = num('seed', 3), BENCH = num('bench', 0);
const RIDE = (q.get('ride') || '1,0').split(',').map(Number), info = document.getElementById('info'), canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
const dpr = num('dpr', Math.min(2, devicePixelRatio || 1));
const hash = (i, j) => { let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const progress = []; const t0 = performance.now();
const art = await loadArt({ onProgress: (a, b) => { progress.push([a, b, Math.round(performance.now() - t0)]); info.textContent = `loading ${a}/${b}`; }, puppets: q.get('puppets') || undefined, fx: q.get('fx') !== '0', pocket: q.get('pocket') !== '0', dpr, budgetMB: num('budget', 40) });
const loadMs = Math.round(performance.now() - t0);
const where = () => { const a = q.get('at'); if (!a) return [2380, 2050]; if (art.landmarks[a]) { const m = art.landmarks[a]; const o = { camp: [-160, 300], wood: [-330, 330], village: [-120, 330], altar: [-330, 250], ford: [-260, 60] }[a] || [-200, 330]; return [m[0] + o[0], m[1] + o[1]]; } return a.split(',').map(Number); };

// ---------------------------------------------------------------- the game: the real rules, or the fake
let sim = null, game = null, step = null;
const KINDS = ['spear', 'spear', 'spear', 'spear', 'axe', 'axe', 'axe', 'shield', 'shield', 'archer', 'archer'];
function clumps(add, cx, cy, n) {                                                       // foes in clumps round a point, as the spawner sends them
  const m = Math.max(3, Math.ceil(n / 13)); let left = n;
  for (let c = 0; c < m && left > 0; c++) { const a = (c / m) * Math.PI * 2 + hash(c, SEED) * 0.9, d = 330 + hash(c, SEED + 5) * 430, gx = cx + Math.cos(a) * d * 1.15, gy = cy + Math.sin(a) * d, k = Math.min(left, Math.ceil(n / m));
    for (let i = 0; i < k; i++, left--) { const r = Math.sqrt(hash(c * 97 + i, 11)) * (60 + k * 5), t = hash(c * 97 + i, 13) * Math.PI * 2; add(KINDS[Math.floor(hash(c * 31 + i, 17) * KINDS.length)], gx + Math.cos(t) * r, gy + Math.sin(t) * r); } }
}
async function realGame() {
  sim = await import('../sim.js'); const g = sim.createGame(SEED, { start: 'fireSpear', spawn: false }), h = g.hero, [x, y] = where();
  h.x = h.px = x; h.y = h.py = y; h.hp = h.maxHp = 1e6; const ax = x + RIDE[0] * sim.HERO.speed * WARM * 0.85, ay = y + RIDE[1] * sim.HERO.speed * WARM * 0.85;   // the battle is laid where he will be when the still is taken
  for (const id of ['sash', 'pearls', 'ring', 'seal']) { try { sim.give(g, 'treasure', id); } catch (e) { console.warn(e); } }
  if (MEN > 0) { const squads = MEN > 20 ? ['shields', 'spears', 'archers', 'strongmen'] : ['shields', 'spears', 'archers']; for (const id of squads) sim.give(g, 'troop', id, MEN > 20 ? 3 : 1); sim.give(g, 'formation', q.get('form') || 'circle', 1);
    for (let i = 0; g.allies.length < MEN && i < 80; i++) sim.addMan(g, squads[i % squads.length]); while (g.allies.length > MEN) g.allies.pop(); }
  clumps((k, fx, fy) => sim.addFoe(g, k, fx, fy), ax, ay, N);
  if (N >= 60) { sim.addFoe(g, 'chariot', ax - 560, ay - 250); const boss = (sim.CONTENT.foes.find((f) => f.boss) || {}).id; if (boss && q.get('boss') !== '0') sim.addFoe(g, boss, ax + 470, ay + 300); sim.addFoe(g, 'shaman', ax + 380, ay - 330); sim.addFoe(g, 'shaman', ax - 300, ay + 420); }
  if (N > 0) { for (let i = 0; i < 16; i++) sim.addPickup(g, 'spirit', ax + (hash(i, 3) - 0.5) * 1100, ay + (hash(i, 4) - 0.5) * 1000, [2, 2, 8, 30][i % 4]); sim.addPickup(g, 'peach', ax + 420, ay + 210); sim.addPickup(g, 'chest', ax - 430, ay + 240); sim.addPickup(g, 'lodestone', ax + 320, ay - 300); }
  const input = { mx: RIDE[0], my: RIDE[1], dash: false, pick: null, reroll: false, banish: null };
  step = (dt) => { input.pick = g.phase === 'offer' ? 0 : null; sim.step(g, input, dt); h.hp = h.maxHp; if (g.events.length) { for (const e of g.events) art.onEvent(e, g); g.events.length = 0; }
    if (BENCH && g.foes.length < N) clumps((k, fx, fy) => sim.addFoe(g, k, fx, fy), h.x, h.y, N - g.foes.length); };
  return g;
}
function fakeGame() {                                                                    // the same shape, scripted: nothing here has rules
  const [x, y] = where(), unit = (id, kind, ux, uy) => ({ id, kind, x: ux, y: uy, px: ux, py: uy, facing: ux < x ? 1 : -1, dir: 0, hp: 1, maxHp: 1, state: 'walk', stateT: 0, flash: 0, elite: false });
  const g = { t: 0, phase: 'fight', hero: { ...unit(0, 'hero', x, y), vx: 0, vy: 0, facing: 1, fullCry: false, moving: true, state: 'ride' }, foes: [], allies: [], shots: [], pickups: [], zones: [], events: [], build: { treasures: [], troops: [], resonance: [] } };
  let id = 1; clumps((k, fx, fy) => g.foes.push(unit(id++, k, fx, fy)), x, y, N); g.foes.push(unit(id++, 'chariot', x - 520, y - 250), unit(id++, 'captain', x + 430, y + 300));
  for (let i = 0; i < MEN; i++) g.allies.push({ ...unit(id++, ['shields', 'spears', 'archers'][i % 3], x, y), slot: i });
  for (let i = 0; i < 12; i++) g.pickups.push({ id: id++, kind: 'spirit', size: i % 3, x: x + (hash(i, 3) - 0.5) * 800, y: y + (hash(i, 4) - 0.5) * 800, px: 0, py: 0 }); g.pickups.forEach((p) => { p.px = p.x; p.py = p.y; });
  g.zones.push({ kind: 'lane', side: 'shang', shape: 'lane', x: x - 520, y: y - 250, dir: 0.45, len: 700, w: 90, t: 0, life: 1.2 }, { kind: 'warn', side: 'shang', shape: 'circle', x: x + 120, y: y + 60, r: 150, t: 0, life: 0.9 });
  step = (dt) => { const h = g.hero; g.t += dt; h.px = h.x; h.py = h.y; h.vx = RIDE[0] * 300; h.vy = RIDE[1] * 300; h.x += h.vx * dt; h.y += h.vy * dt; h.moving = !!(RIDE[0] || RIDE[1]); h.state = h.moving ? 'ride' : 'idle'; h.fullCry = g.t % 8 > 5; if (RIDE[0]) h.facing = Math.sign(RIDE[0]);
    g.allies.forEach((a, i) => { const ang = (i / g.allies.length) * Math.PI * 2 + g.t * 0.2, tx = h.x + Math.cos(ang) * 150, ty = h.y + Math.sin(ang) * 150; a.px = a.x; a.py = a.y; a.x += (tx - a.x) * 4 * dt; a.y += (ty - a.y) * 4 * dt; a.facing = h.facing; a.stateT += dt; });
    for (const f of g.foes) { const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1; f.px = f.x; f.py = f.y; f.stateT += dt; if (d > 150) { f.state = 'walk'; f.x += (dx / d) * 60 * dt; f.y += (dy / d) * 60 * dt; } else if (f.state === 'walk') { f.state = 'windup'; f.stateT = 0; } else if (f.stateT > 0.6) { f.state = f.state === 'windup' ? 'attack' : 'windup'; f.stateT = 0; } f.facing = dx >= 0 ? 1 : -1; }
    for (const zo of g.zones) zo.t = (zo.t + dt) % zo.life; };
  return g;
}
let driver = 'rules';
if (q.get('fake') === '1') { game = fakeGame(); driver = 'fake'; } else { try { game = await realGame(); } catch (e) { console.warn('preview: the rules did not load; using the scripted fake', e); game = fakeGame(); driver = 'fake (rules failed: ' + e.message + ')'; } }

// ---------------------------------------------------------------- the loop
const cam = { x: game.hero.x, y: game.hero.y, zoom: ZOOM, shakeX: 0, shakeY: 0 };
let W = 0, H = 0;
function size() { W = innerWidth; H = innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); art.setView({ width: W, height: H, dpr }); }
addEventListener('resize', size); size(); art.setTime(TIME);
const STEP = 1 / 60, cost = [], gaps = []; let acc = 0, last = 0, frames = 0, held = false;
function draw(alpha, dt) { const a = performance.now(); art.drawGround(ctx, cam, dt); const b = performance.now(); art.drawWorld(ctx, cam, game, alpha, dt); const c = performance.now(); art.drawOver(ctx, cam, dt); const d = performance.now(); return [d - a, b - a, c - b, d - c]; }
for (let t = 0; t < WARM; t += STEP) step(STEP);                                         // the opening seconds of the battle, before anything is shown
function frame(t) {
  const gap = last ? t - last : 16.7, dt = Math.min(0.05, Math.max(0, gap / 1000)); last = t;
  if (!held) { acc += dt; let n = 0; while (acc >= STEP && n++ < 4) { step(STEP); acc -= STEP; } }
  cam.x = game.hero.x + (num('cx', 0)); cam.y = game.hero.y + num('cy', 0);
  const alpha = held ? 1 : acc / STEP, c = draw(alpha, held ? 0 : dt); for (let i = 1; i < BENCH; i++) draw(alpha, 0);
  frames++; if (frames > 30) { cost.push(c); gaps.push(gap); if (cost.length > 600) { cost.shift(); gaps.shift(); } }
  if (STILL && frames === 24) { held = true; }
  if (STILL && frames === 26) { preview.ready = true; info.style.display = 'none'; return; }
  if (frames % 30 === 0) { const s = preview.stats(); info.textContent = `${driver} · foes ${game.foes.length} allies ${game.allies.length} · art ${s.mean.toFixed(2)} ms (ground ${s.ground.toFixed(2)}, world ${s.world.toFixed(2)}, over ${s.over.toFixed(2)}) · gap ${s.gap.toFixed(1)} ms\nsprites ${JSON.stringify(art.stats.sprites)} · ${art.stats.puppets} · fx ${art.stats.fx} · load ${loadMs} ms`; }
  requestAnimationFrame(frame);
}
const mean = (l) => l.reduce((a, b) => a + b, 0) / Math.max(1, l.length), med = (l) => l.slice().sort((a, b) => a - b)[Math.floor(l.length / 2)] || 0;
const preview = window.__preview = { art, game, cam, ready: false, driver, loadMs, progress,
  stats: () => ({ frames: cost.length, mean: mean(cost.map((c) => c[0])), median: med(cost.map((c) => c[0])), p95: cost.map((c) => c[0]).sort((a, b) => a - b)[Math.floor(cost.length * 0.95)] || 0, ground: mean(cost.map((c) => c[1])), world: mean(cost.map((c) => c[2])), over: mean(cost.map((c) => c[3])), gap: mean(gaps), gapMedian: med(gaps), foes: game.foes.length, allies: game.allies.length, shots: game.shots.length, zones: game.zones.length, bench: BENCH, sprites: art.stats.sprites }) };
requestAnimationFrame(frame);
