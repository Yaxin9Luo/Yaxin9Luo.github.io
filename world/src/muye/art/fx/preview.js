// The preview of the survivors-like's effects. The rules are the real ones (read-only); the figures are stand-ins cut from
// the side-view game's puppets the way lab/game-studies/field/field.js cuts them (that code is copied here, shortened).
import { loadFx } from './index.js';
import { createGame, step as simStep, give, addFoe, addPickup, CONTENT } from '../../sim.js';
import { loadArt } from '../index.js';

const Q = new URLSearchParams(location.search), STEP = 1 / 60, KY = 0.62, PAPER = [239, 231, 214], TAU = Math.PI * 2;
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
const fx = await loadFx();
const st = { slow: 1, paused: Q.get('auto') === '0', fig: true, only: false, grey: false, ms: 0, ride: 'stand' };
const cam = { x: 3000, y: 3000, zoom: 1, shakeX: 0, shakeY: 0 };
// ---------------------------------------------------------------- the figures and the ground: the game's own art module
const art = await loadArt({ fx: false });
let W = 0, H = 0, dpr = 1, Z = 1;
function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); cam.zoom = Q.get('zoom') ? +Q.get('zoom') : Math.min(1.6, Math.max(0.7, Math.sqrt((W * H) / (1440 * 900)))); Z = cam.zoom * dpr; art.setView({ width: W, height: H, dpr }); }
size(); addEventListener('resize', size);
const SX = (x) => canvas.width / 2 + (x - cam.x) * Z, SY = (y) => canvas.height * 0.52 + (y - cam.y) * KY * Z;
// ---------------------------------------------------------------- the field, set by a scene
let game = null, sceneName = '', input = { mx: 0, my: 0, dash: false, pick: null, reroll: false, banish: null };
st.t = 0;
const TR = CONTENT.treasures.map((r) => r.id), FEED = { fire: 'wood', earth: 'fire', metal: 'earth', water: 'metal', wood: 'water' };
let rs = 7; const rnd = () => { rs = (rs * 1664525 + 1013904223) | 0; return ((rs >>> 8) & 0xffff) / 65536; };
function cluster(kind, n, ang, dist, spread = 60) { const h = game.hero; for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * spread; addFoe(game, Array.isArray(kind) ? kind[i % kind.length] : kind, h.x + Math.cos(ang) * dist + Math.cos(a) * d, h.y + Math.sin(ang) * dist + Math.sin(a) * d * 0.9); } }
function fresh() { st.keepOff = 0; st.keepN = 0; fx.onEvent({ type: 'fx:clear' }); rs = 7; st.t = 0; game = createGame(11, { bare: true, spawn: false }); game.phase = 'fight'; cam.x = game.hero.x; cam.y = game.hero.y; st.ride = 'stand'; if (art.reset) art.reset(); fx.onEvent({ type: 'game' }, game); }
function crowd(n, r0 = 230, r1 = 620) { const h = game.hero, kinds = ['spear', 'axe', 'shield', 'archer', 'spear', 'axe']; let left = n;
  for (let c = 0; left > 0 && c < 40; c++) { const m = Math.min(left, 6 + Math.floor(rnd() * 14)), a = rnd() * TAU, d = r0 + rnd() * (r1 - r0); cluster(kinds, m, a, d, 30 + m * 4); left -= m; } }
function treasure(id, lv, n = 0) { fresh(); sceneName = `${id} ${lv}${n ? ' in ' + n : ''}`; give(game, 'treasure', id, lv === 'ev' ? 6 : +lv, lv === 'ev');
  if (n) { crowd(n, 150, 560); for (const f of game.foes) f.hp = f.maxHp = 1e7; st.keepOff = 120; return; }
  cluster(['spear', 'axe'], 14, -0.5, 215, 50); cluster(['spear', 'shield'], 12, 2.5, 250, 55); cluster(['axe', 'archer'], 10, 1.2, 190, 45); cluster('spear', 6, 4.0, 160, 40);
  if (id === 'whip' || id === 'ring') { addFoe(game, 'chariot', game.hero.x + 250, game.hero.y - 90); if (lv === 'ev') { addFoe(game, 'chariot', game.hero.x - 280, game.hero.y + 60); addFoe(game, 'shaman', game.hero.x - 60, game.hero.y - 220); } } }
// a troop at a level (9 = the blessed host) among a crowd, for the squad skills
function troopScene(id, lv, n = 90) { fresh(); sceneName = `${id} ${lv}`; give(game, 'troop', id, Math.min(8, lv), lv >= 9); crowd(n, 170, 520); addFoe(game, 'chariot', game.hero.x + 260, game.hero.y - 60); for (const f of game.foes) f.hp = f.maxHp = 1e7; st.keepOff = 110; }
function generalScene(id, lv, n = 90) { fresh(); sceneName = `${id} ${lv}`; give(game, 'general', id, Math.min(5, lv), lv >= 6); crowd(n, 170, 520); addFoe(game, 'chariot', game.hero.x + 260, game.hero.y - 60); addFoe(game, 'archer', game.hero.x - 300, game.hero.y + 80); addFoe(game, 'shaman', game.hero.x + 330, game.hero.y + 120); for (const f of game.foes) f.hp = f.maxHp = 1e7; st.keepOff = 110; }
// a named foe of the Shang with one pattern ready (k), the others held; the arrival marked as the rules mark it
function namedScene(kind, k = 0, n = 60) { fresh(); sceneName = kind + ' ' + k; crowd(n, 200, 560); const h = game.hero, f = addFoe(game, kind, h.x + 280, h.y - 70); f.hp = f.maxHp = 1e7; if (f.pcd) f.pcd = f.pcd.map((_, i) => (i === k ? 0.2 : 99)); fx.onEvent({ type: 'arrive', kind, x: f.x, y: f.y, id: f.id }, game); for (const u of game.foes) if (u !== f) u.hp = u.maxHp = 1e7; return f.id; }
function trueFormNow(id) { const u = game.allies.find((a) => a.kind === 'general' && a.general === id); const ids = { nezha: 'threeHeadsEightArms', yangjian: 'seventyTwoChanges', leizhenzi: 'stormWings', tuxingsun: 'earthOpens', dengchanyu: 'fiveLights', huangfeihu: 'kingWucheng' }; fx.onEvent({ type: 'trueForm', general: id, id: ids[id], x: u ? u.x : game.hero.x, y: u ? u.y : game.hero.y }, game); }
const SCENES = {
  'squads · ring': () => squads('circle'), 'squads · arrowhead': () => squads('arrowhead'), 'squads · eight trigrams': () => squads('trigrams'),
  'ride: full cry, trample, spring': () => { fresh(); sceneName = 'ride'; st.ride = 'circle'; crowd(70, 200, 520); },
  'danger: chariot lane': () => { fresh(); sceneName = 'lane'; addFoe(game, 'chariot', game.hero.x + 360, game.hero.y - 120); cluster('spear', 8, 2.6, 300); },
  'danger: the leader (two attacks)': () => { fresh(); sceneName = 'boss'; const b = addFoe(game, 'captain', game.hero.x + 300, game.hero.y + 40); fx.onEvent({ type: 'boss', x: b.x, y: b.y }, game); cluster(['spear', 'axe'], 12, 3.0, 320); },
  'pickups, all kinds': () => { fresh(); sceneName = 'pickups'; const h = game.hero; [[1, -220, -60], [1, -180, 30], [1, -250, 50], [4, -90, -110], [4, -40, 120], [12, 90, -90], [12, 150, 100]].forEach(([v, dx, dy]) => addPickup(game, 'spirit', h.x + dx, h.y + dy, v)); addPickup(game, 'peach', h.x + 230, h.y - 40); addPickup(game, 'lodestone', h.x + 300, h.y + 70); addPickup(game, 'chest', h.x + 60, h.y + 190); cluster('spear', 6, 3.6, 380); },
  'full evolved build, 300 foes, surrounded': () => dense(300), 'full evolved build, 300 foes, riding out': () => dense(300, 'drift'), 'full evolved build, 120 foes': () => dense(120),
  'seal level 1, a minute of play (60 foes kept up)': () => sealPlay(1, 60, 'circle'), 'seal level 6 in a crowd of 200': () => sealPlay(6, 200, 'stand'),
};
function squads(form) { fresh(); sceneName = 'squads ' + form; for (const id of ['shields', 'spears', 'archers', 'strongmen']) { try { give(game, 'troop', id, 4); } catch { /* three slots */ } } give(game, 'formation', form, 2); st.ride = form === 'arrowhead' ? 'line' : 'stand'; crowd(70, 240, 520); }
function dense(n, ride = 'stand') { fresh(); sceneName = 'dense ' + n + ' ' + ride; for (const id of ['fireCover', 'sash', 'seal', 'fireSpear', 'whip', 'ring']) give(game, 'treasure', id, 6, true); for (const id of ['shields', 'spears', 'archers', 'tigers', 'acolytes']) give(game, 'troop', id, 6); for (const id of ['nezha', 'leizhenzi']) give(game, 'general', id, 5); give(game, 'formation', 'circle', 3); crowd(n, 200, 620); st.ride = ride; addFoe(game, 'chariot', game.hero.x - 420, game.hero.y - 200); { const w = addFoe(game, 'wenzhong', game.hero.x + 380, game.hero.y + 120); w.hp = w.maxHp = 1e7; }
  for (const f of game.foes) f.hp = f.maxHp = 1e7; st.keepOff = 135; }      // for the density proof the mass does not thin out: the build would clear 300 foes of the first minute in six seconds
// the seal alone in play: the field is topped up to n foes as they fall, so a minute of it can be watched (and what it leaves behind)
function sealPlay(lv = 1, n = 60, ride = 'circle') { fresh(); sceneName = `seal ${lv} among ${n}`; give(game, 'treasure', 'seal', +lv); crowd(n, 200, 560); st.ride = ride; st.keepN = n; if (ride === 'stand') st.keepOff = 110; }
const EVENTS = {
  'level up': () => fx.onEvent({ type: 'levelUp', level: 5, x: game.hero.x, y: game.hero.y }, game),
  'hero hurt': () => fx.onEvent({ type: 'hurt', x: game.hero.x, y: game.hero.y, dmg: 9, fromX: game.hero.x + 100, fromY: game.hero.y - 40 }, game),
  'the fall': () => fx.onEvent({ type: 'fall', x: game.hero.x, y: game.hero.y, fromX: game.hero.x + 100, fromY: game.hero.y }, game),
  'elite arrives (in view)': () => fx.onEvent({ type: 'elite', x: game.hero.x + 330, y: game.hero.y - 150 }, game),
  'elite arrives (off screen)': () => fx.onEvent({ type: 'elite', x: game.hero.x - 1400, y: game.hero.y - 600 }, game),
  'leader arrives (off screen)': () => fx.onEvent({ type: 'boss', x: game.hero.x + 1500, y: game.hero.y + 900 }, game),
  'encirclement': () => fx.onEvent({ type: 'encircle' }, game),
  'peach taken': () => fx.onEvent({ type: 'pickup', kind: 'peach', x: game.hero.x, y: game.hero.y }, game),
  'lodestone taken': () => fx.onEvent({ type: 'pickup', kind: 'lodestone', x: game.hero.x, y: game.hero.y }, game),
  'chest opened': () => fx.onEvent({ type: 'chest', x: game.hero.x, y: game.hero.y, gave: 'evolve' }, game),
  'mirror beam (optional)': () => fx.onEvent({ type: 'cast', id: 'mirror', shape: 'beam', x: game.hero.x, y: game.hero.y, dir: -0.4, length: 320, width: 44 }, game),
  'binding rope (optional)': () => fx.onEvent({ type: 'cast', id: 'rope', shape: 'bind', x: game.hero.x, y: game.hero.y, dir: 2.6, length: 280 }, game),
  ...Object.fromEntries(TR.map((id) => [`evolve · ${id}`, () => fx.onEvent({ type: 'evolve', id, x: game.hero.x, y: game.hero.y }, game)])),
};
treasure('fireSpear', 1);

// ---------------------------------------------------------------- the clock and the picture
const log = [];                                               // the events of the last step, for the strips
function tick(dt) {
  const g = game, h = g.hero; st.t += dt;
  if (st.ride === 'circle') { const a = st.t * 0.9; input.mx = Math.cos(a); input.my = Math.sin(a); } else if (st.ride === 'line') { input.mx = 1; input.my = 0.15; } else if (st.ride === 'drift') { input.mx = 0.5; input.my = 0.12; } else { input.mx = 0; input.my = 0; }
  h.hp = h.maxHp; h.xp = 0; if (g.phase !== 'fight') g.phase = 'fight';
  if (st.keepOff) for (const f of g.foes) { const dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy) || 1; if (d < st.keepOff) { f.x = h.x + dx / d * st.keepOff; f.y = h.y + dy / d * st.keepOff; } }   // density proof only: unkillable foes are held off the hero, as kills and pushes would hold them
  if (st.keepN && g.foes.length < st.keepN) crowd(Math.min(12, st.keepN - g.foes.length), 260, 600);
  simStep(g, input, dt); input.dash = false;
  log.length = 0; for (const e of g.events) { fx.onEvent(e, g); log.push(e.type + (e.id ? ':' + e.id : '')); } g.events.length = 0;
  cam.x = h.x; cam.y = h.y;
}
function render(dt) {
  const kk = fx.kick ? fx.kick() : [0, 0]; cam.shakeX = kk[0]; cam.shakeY = kk[1];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = `rgb(${PAPER})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!st.only) { ctx.save(); art.drawGround(ctx, cam, dt); ctx.restore(); }
  let a = performance.now(), ms = 0; ctx.save(); fx.drawGround(ctx, cam, dt); ctx.restore(); ms += performance.now() - a;
  if (st.fig && !st.only) { ctx.save(); art.drawWorld(ctx, cam, worldView(), 1, dt); ctx.restore(); }
  a = performance.now(); ctx.save(); fx.drawOver(ctx, cam, dt); ctx.restore(); ms += performance.now() - a;
  ctx.setTransform(1, 0, 0, 1, 0, 0); if (st.grey) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over'; }
  st.ms += (ms - st.ms) * 0.05; return ms;
}
// the art module, loaded without effects, would draw its own fallback zones, pickups, pearls and rings: in the game it does not
const worldView = () => { const v = Object.create(game); v.zones = []; v.pickups = []; v.shots = game.shots.filter((x) => x.kind !== 'pearls' && x.kind !== 'ring'); return v; };
const step = (n = 1) => { let ms = 0; for (let i = 0; i < n; i++) { tick(STEP); ms = render(STEP); } return ms; };
// run until the rules report an event (say 'cast:seal'), at most `max` frames; returns the frames taken or -1
function until(what, max = 900) { for (let i = 1; i <= max; i++) { tick(STEP); render(STEP); if (log.includes(what) || log.some((l) => l.startsWith(what))) return i; } return -1; }
let last = performance.now(), acc = 0;
function loop(now) {
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  if (!st.paused) { acc += real / st.slow; let n = 0; while (acc >= STEP && n++ < 4) { acc -= STEP; tick(STEP); render(STEP); } }
  const c = { type: 'fx:count' }; fx.onEvent(c, game);
  hud.textContent = `${sceneName}\nfx ${st.ms.toFixed(2)} ms   strokes ${c.over + c.under}   marks ${c.marks}   density ${c.level}\nfoes ${game.foes.length}   t ${st.t.toFixed(1)} s${st.slow !== 1 ? '   slow ×' + st.slow : ''}${st.paused ? '   paused' : ''}`;
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- the panel
const panel = document.getElementById('panel');
const group = (title) => { const h = document.createElement('h4'); h.textContent = title; panel.append(h); };
const button = (label, f, toggle) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { const on = f(); if (toggle) b.classList.toggle('on', !!on); }; panel.append(b); return b; };
group('clock'); button('pause', () => (st.paused = !st.paused), true).classList.toggle('on', st.paused); button('step ▸', () => { st.paused = true; step(1); }); button('slow ×4', () => (st.slow = st.slow === 4 ? 1 : 4), true); button('slow ×10', () => (st.slow = st.slow === 10 ? 1 : 10), true);
button('effects only', () => (st.only = !st.only), true); button('spring (Space)', () => { input.dash = true; });
for (const row of CONTENT.treasures) { group(`${row.name.zh} ${row.name.en} · ${row.element}`); for (const lv of [1, 3, 6, 'ev']) button(lv === 'ev' ? `evolved: ${row.evolved.name.zh}` : `level ${lv}`, () => treasure(row.id, lv)); }
group('squads, formations, the horse, danger, pickups, density'); for (const name of Object.keys(SCENES)) button(name, () => SCENES[name]());
group('moments'); for (const name of Object.keys(EVENTS)) button(name, () => EVENTS[name]());
const hud = document.createElement('div'); hud.id = 'hud'; panel.append(hud);
if (Q.get('clean') === '1') document.body.classList.add('clean');
addEventListener('keydown', (e) => { if (e.key === ' ') { input.dash = true; e.preventDefault(); } else if (e.key === 'p') st.paused = !st.paused; else if (e.key === '.') { st.paused = true; step(1); } });

// the cost of a full evolved build at n foes: one frame per animation frame, time inside drawGround + drawOver
async function bench(n = 300, seconds = 8) { dense(n); st.paused = true; let sum = 0, k = 0, worst = 0; const all = [], c = { type: 'fx:count' }; let strokes = 0;
  for (let f = 0; f < seconds * 60; f++) { await new Promise((r) => requestAnimationFrame(r)); tick(STEP); const ms = render(STEP); if (f > 60) { sum += ms; k++; worst = Math.max(worst, ms); all.push(ms); fx.onEvent(c, game); strokes += c.live || 0; } }
  all.sort((a, b) => a - b); return { foesAtEnd: game.foes.length, avgMs: +(sum / k).toFixed(3), medianMs: +all[k >> 1].toFixed(3), p95Ms: +all[Math.floor(k * 0.95)].toFixed(3), worstMs: +worst.toFixed(2), meanStrokesAndMarks: Math.round(strokes / k), frames: k, width: canvas.width, height: canvas.height }; }
window.fxp = { fx, namedScene, troopScene, generalScene, trueFormNow, sealPlay, treasure, scene: (n) => SCENES[n](), event: (n) => EVENTS[n](), step, until, bench, dense, st, cam, get game() { return game; }, get log() { return log; }, scenes: Object.keys(SCENES), events: Object.keys(EVENTS), treasures: TR,
  screen: (x, y) => [SX(x) / dpr, SY(y) / dpr] };
render(0); requestAnimationFrame(loop); document.title = 'ready';
