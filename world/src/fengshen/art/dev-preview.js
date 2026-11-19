// A scripted stand-in for the simulation, so that the art module can be looked at by itself. Nothing here is the game:
// it only fills the `game` object of PROTOTYPE-SPEC.md section 3 with believable numbers and sends the events.
import { loadArt } from './index.js';
import { kindOf } from './poses.js';

const Q = new URLSearchParams(location.search), num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const MODE = Q.get('mode') || 'battle', AUTO = Q.get('auto') !== '0', FIXED_TIME = Q.has('time') ? num('time', 0) : null;
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d'), hud = document.getElementById('hud');
if (Q.get('clean') === '1') document.body.classList.add('clean');
const art = await loadArt({ lang: 'en', onProgress: (done, total) => { window.__progress = (window.__progress || []).concat([[done, total]]); } });
const WORLD = art.info.world, STEP = 1 / 60, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ the fake battle
const WIND = { soldier: 0.35, officer: 0.4, spear: 0.45, axe: 0.5, shield: 0.35, captain: 1.0 };
function cycleOf(kind) {                                                    // every state a kind has, in a believable order
  const c = [['idle', 1.0], ['walk', 1.4]];
  if (kind === 'archer') c.push(['draw', 0.7], ['attack', 0.4], ['idle', 0.6], ['draw', 0.7], ['attack', 0.4]);
  else c.push(['windup', WIND[kind]], ['attack', kind === 'captain' ? 0.6 : 0.4]);
  if (kind === 'captain') c.push(['idle', 0.6], ['horn', 1.1]);
  if (kind === 'spear') c.push(['idle', 0.5], ['brace', 1.3]);
  c.push(['idle', 0.5], ['stun', 0.7], ['idle', 0.7], ['windup', WIND[kind] || 0.4], ['attack', 0.4], ['dead', 1.2]);
  if (kind === 'archer') c.splice(c.length - 3, 2);
  return c;
}
let nextId = 1;
function unit(side, kind, x, lane, o = {}) {
  return { id: nextId++, side, kind, x, px: x, lane, facing: side === 'zhou' ? 1 : -1, hp: 3, maxHp: 3, state: 'idle', stateT: 0, flash: 0,
    veteran: !!o.veteran, $home: x, $cycle: o.follow ? null : cycleOf(kind), $i: 0, $t: -(o.wait ?? 0), $follow: o.follow ?? null };
}
function newGame() {
  nextId = 1;
  const g = { time: 0, hero: { x: num('at', 260), y: 0, px: 0, py: 0, vx: 0, vy: 0, facing: 1, hp: 5, maxHp: 5, state: 'ride', stateT: 0, topSpeed: 520, blade: 1, safe: 0 }, units: [], arrows: [], events: [], $beat: 0, $want: 520, $hold: 0 };
  g.hero.px = g.hero.x; g.$fallAt = Q.has('fall') ? num('fall', 1e9) : 1e9;
  // the warband: it follows the hero in a loose group, not a rank
  // the warband of SPEC-V2: a block three deep, shields in the first file, spears behind, archers at the back
  [['shield', 110], ['spear', 156], ['archer', 204]].forEach(([k, back], fi) => [0, 1, 2].forEach((lane) => { if (!Q.has('fall') && !(k === 'archer' && lane === 2)) g.units.push(unit('zhou', k, g.hero.x - back, lane, { follow: back, veteran: fi === 0 && lane === 0 })); }));
  // standing fights along the road: blocks three deep meeting, each figure on its own clock
  const fight = (x, zs, ss) => {
    zs.forEach((k, fi) => [0, 1, 2].forEach((lane) => g.units.push(unit('zhou', k, x - 40 - fi * 46, lane, { wait: fi * 0.5 + lane * 0.23 }))));
    ss.forEach((k, fi) => [0, 1, 2].forEach((lane) => { if (k !== 'captain' || lane === 1) g.units.push(unit('shang', k, x + 40 + fi * 46, lane, { wait: 0.3 + fi * 0.45 + lane * 0.2 })); }));
  };
  fight(1500, ['shield', 'spear'], ['spear', 'axe']);
  fight(2380, ['shield', 'spear', 'archer'], ['shield', 'spear', 'archer']);
  fight(3300, ['shield', 'archer'], ['shield', 'axe', 'archer']);
  fight(4080, ['shield', 'spear'], ['shield', 'captain', 'spear']);
  g.hero.hold = 0; g.hero.fullCry = false; g.hero.boons = Q.has('boons') ? ['fire', 'water', 'wood', 'metal', 'earth'].map((element, n) => ({ id: ['emberBlade', 'spring', 'galeLeap', 'keenEdge', 'quake'][n], element })) : [];
  return g;
}
// what the hero does on the way: [x, action]
const VERBS = [[700, 'sweep'], [1180, 'leapstrike'], [1700, 'dash'], [2250, 'sweep'], [2700, 'rally'], [3100, 'leapstrike'], [3600, 'dash'], [3950, 'sweep'], [4350, 'halt'], [4420, 'rally'], [4560, 'again']];
const BEATS = Q.has('verbs') ? VERBS : [[820, 'leap'], [1370, 'strike'], [1560, 'strike'], [1800, 'trot'], [2060, 'gallop'], [2250, 'strike'], [2420, 'hurt'], [2700, 'leap'], [3170, 'strike'], [3330, 'stopped'],
  [3420, 'strike'], [3700, 'leap'], [3960, 'strike'], [4120, 'strike'], [4350, 'halt'], [4560, 'again']];
const G = 2178, emit = (g, type, x, y, o = {}) => { const e = { type, x, y, ...o }; g.events.push(e); art.onEvent(e, g); };
let shake = 0;

function stepGame(g, dt) {
  g.time += dt; g.events.length = 0;
  const h = g.hero; h.px = h.x; h.py = h.y; h.stateT += dt;
  // the fall (contract change of 2026-11-18): health gone, the state `fallen`, one `fall` event, the horse slows to a stand
  if (h.state !== 'fallen' && h.x >= g.$fallAt && h.y === 0) { h.state = 'fallen'; h.stateT = 0; h.hp = 0; emit(g, 'fall', h.x, 90, { dir: num('dir', -1) }); shake = 8; }
  if (h.state === 'fallen') { h.vx *= Math.exp(-dt * 7); if (Math.abs(h.vx) < 2) h.vx = 0; h.x += h.vx * dt; shake *= Math.exp(-dt * 14); stepUnits(g, dt); return; }
  // the script
  const b = BEATS[g.$beat];
  if (b && h.x >= b[0] && h.y === 0 && !(h.$gather > 0) && (h.state === 'ride' || b[1] === 'again')) {
    g.$beat++;
    if (b[1] === 'sweep') { h.$gather = 0.7; }                                    // hold the blow for 0.7 s, then let it go
    else if (b[1] === 'leapstrike') { h.state = 'leap'; h.stateT = 0; h.vy = G * 0.3; h.$slam = true; emit(g, 'leap', h.x, 0); }
    else if (b[1] === 'dash') { h.state = 'dash'; h.stateT = 0; h.$x0 = h.x; emit(g, 'dash', h.x, 0); }
    else if (b[1] === 'rally') { h.state = 'rally'; h.stateT = 0; emit(g, 'rally', h.x, 0); }
    else if (b[1] === 'leap') { h.state = 'leap'; h.stateT = 0; h.vy = G * 0.3; emit(g, 'leap', h.x, 0); }
    else if (b[1] === 'strike') { h.state = 'strike'; h.stateT = 0; h.$hit = false; emit(g, 'swing', h.x, 80, { dir: h.facing }); }
    else if (b[1] === 'hurt') { h.state = 'hurt'; h.stateT = 0; h.vx *= 0.55; emit(g, 'hurt', h.x + 20, 110, { dmg: 1 }); shake = 5; }
    else if (b[1] === 'stopped') { h.state = 'stopped'; h.stateT = 0; h.vx = 0; emit(g, 'braced', h.x + 110, 70); shake = 9; }
    else if (b[1] === 'trot') g.$want = 150; else if (b[1] === 'gallop') g.$want = 520;
    else if (b[1] === 'halt') { g.$want = 0; g.$hold = 1.6; }
    else if (b[1] === 'again') { const n = newGame(); n.hero.x = n.hero.px = 260; Object.assign(g, n);  return; }
  }
  if (g.$want === 0 && Math.abs(h.vx) < 1) { g.$hold -= dt; if (g.$hold <= 0) g.$want = 520; }
  // the verbs of SPEC-V2, as the art will be handed them
  if (h.$gather > 0) { h.hold += dt; if (h.hold >= h.$gather) { h.$gather = 0; h.hold = 0; h.state = 'sweep'; h.stateT = 0; emit(g, 'sweep', h.x + 90, 70, { dir: h.facing, full: false }); shake = 6;
    for (const u of g.units) if (u.side === 'shang' && u.state !== 'dead' && u.x > h.x - 20 && u.x < h.x + 200) { u.state = 'stun'; u.stateT = 0; u.flash = 0.16; u.x += 60; emit(g, 'hit', u.x - 14, 70, { dmg: 3, mult: 2, kill: false, dir: h.facing }); } } }
  if (h.state === 'sweep' && h.stateT >= 0.46) { h.state = 'ride'; h.stateT = 0; }
  if (h.state === 'dash') { h.vx = 830; if (h.stateT >= 0.5) { h.state = 'ride'; h.stateT = 0; emit(g, 'trail', h.x, 0, { x0: h.$x0, x1: h.x }); } }
  if (h.state === 'rally' && h.stateT >= 1.2) { h.state = 'ride'; h.stateT = 0; }
  if (h.$slam && h.state === 'leap' && h.vy < 0) { h.state = 'strike'; h.stateT = 0; }
  const cry = Math.abs(h.vx) >= 468; h.$cryT = cry ? (h.$cryT || 0) + dt : 0; const was = h.fullCry; h.fullCry = h.$cryT > 0.8 || (was && Math.abs(h.vx) > 364); if (was !== h.fullCry) emit(g, 'fullCry', h.x, 0, { on: h.fullCry });
  if (h.state === 'strike' && h.y > 0) { /* the leap strike: held RAISED until the ground */ }
  else if (h.state === 'strike') {
    if (!h.$hit && h.stateT >= 0.05) {                                         // the blade is live: whoever stands in front of it is hit
      h.$hit = true; let any = false;
      for (const u of g.units) if (u.side === 'shang' && u.state !== 'dead' && u.x > h.x - 20 && u.x < h.x + 190) {
        any = true; const kill = Math.abs(h.vx) > 400; u.state = kill ? 'dead' : 'stun'; u.stateT = 0; u.flash = 0.16; u.$t = 0; u.$i = kill ? u.$cycle.length - 1 : u.$cycle.findIndex(([s]) => s === 'stun');
        emit(g, 'hit', u.x - 14, 78, { dmg: 2, mult: 1 + Math.abs(h.vx) / 300, kill, dir: h.facing });
      }
      if (any) shake = 6;
    }
    if (h.stateT >= 0.37) { h.state = 'ride'; h.stateT = 0; }
  } else if (h.state === 'hurt' && h.stateT >= 0.4) { h.state = 'ride'; h.stateT = 0; }
  else if (h.state === 'stopped' && h.stateT >= 0.9) { h.state = 'ride'; h.stateT = 0; }
  if (h.state !== 'stopped' && h.state !== 'dash') h.vx += clamp((h.hold > 0 ? 0.6 : 1) * g.$want - h.vx, -900 * dt, 620 * dt);
  h.x += h.vx * dt;
  if (h.state === 'leap' || h.y > 0) { h.vy -= G * dt; h.y += h.vy * dt; if (h.y <= 0) { h.y = 0; h.vy = 0; h.state = 'ride'; h.stateT = 0; emit(g, 'land', h.x, 0, { speed: Math.abs(h.vx) }); shake = 3; if (h.$slam) { h.$slam = false; emit(g, 'shock', h.x + 40, 0, { power: 1.4 }); shake = 9; } } }
  stepUnits(g, dt);
}
function stepUnits(g, dt) {
  const h = g.hero;
  for (const u of g.units) {
    u.px = u.x; u.stateT += dt; if (u.flash > 0) u.flash -= dt;
    if (u.$follow != null) {                                                   // the warband keeps its place behind the hero
      const want = h.x - u.$follow, d = want - u.x, v = clamp(d * 3, -120, 400);
      if (Math.abs(d) > 6) { u.x += v * dt; if (u.state !== 'walk') { u.state = 'walk'; u.stateT = 0; } } else if (u.state !== 'idle') { u.state = 'idle'; u.stateT = 0; }
      continue;
    }
    u.$t += dt; if (u.$t < 0) continue;
    let [s, dur] = u.$cycle[u.$i];
    if (u.$t >= dur || u.state !== s) {
      if (u.$t >= dur) { u.$i = (u.$i + 1) % u.$cycle.length; u.$t = 0; if (u.$i === 0) u.x = u.px = u.$home; }
      [s] = u.$cycle[u.$i];
      if (u.state !== s) {
        u.state = s; u.stateT = 0;
        if (s === 'attack' && u.kind === 'archer') { g.arrows.push({ x: u.x + u.facing * 34, y: 96, px: u.x, py: 96, vx: u.facing * 560, vy: 150 }); emit(g, 'loose', u.x, 96); }
        else if (s === 'attack') { emit(g, 'clash', u.x + u.facing * 62, 70, { side: u.side, kill: false }); if (u.id % 3 === 0) emit(g, 'blocked', u.x + u.facing * 80, 60); }
        else if (s === 'horn') emit(g, 'captainHorn', u.x, 120);
        else if (s === 'draw' && u.side === 'zhou' && u.lane === 0) emit(g, 'volley', u.x, 90);
        else if (s === 'stun') u.flash = 0.16; else if (s === 'dead') emit(g, 'clash', u.x, 60, { side: u.side === 'zhou' ? 'shang' : 'zhou', kill: true });
      }
    }
    if (u.state === 'walk') u.x += u.facing * 34 * dt;
  }
  for (let i = g.arrows.length - 1; i >= 0; i--) {
    const a = g.arrows[i]; a.px = a.x; a.py = a.y; a.vy -= 520 * dt; a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y <= 4) { emit(g, 'arrowHit', a.x, 4); g.arrows.splice(i, 1); }
  }
  shake *= Math.exp(-dt * 14);
}

// ------------------------------------------------------------------ the page
let W = 0, H = 0, dpr = 1;
function fit(w = innerWidth, h = innerHeight) {
  W = w; H = h; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  art.setView({ width: W, height: H, dpr });
}
const cam = { x: 720, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
const stats = { n: 0, calls: [], flushed: [], gaps: [] };
const flushPx = () => ctx.getImageData(0, 0, 1, 1);
// the order the page should call the art in: back, figures, effects, front (dust and paint stay behind the near reeds)
function render(g, alpha, dt, measure) {
  const t0 = performance.now();
  art.drawBack(ctx, cam, dt); const ta = performance.now(); art.drawFigures(ctx, cam, g, alpha, dt); const tb = performance.now(); art.drawEffects(ctx, cam, dt); const tc = performance.now(); if (Q.get('front') !== '0') art.drawFront(ctx, cam, dt);
  if (measure) { (stats.back ||= []).push(ta - t0); (stats.figs ||= []).push(tb - ta); (stats.fx ||= []).push(tc - tb); (stats.front ||= []).push(performance.now() - tc); }
  const t1 = performance.now();
  if (measure) { stats.calls.push(t1 - t0); if (measure === 2) { flushPx(); stats.flushed.push(performance.now() - t0); } }
  return t1 - t0;
}
function follow(g, dt, snap) {
  const half = W / 2 / (H / 900), lead = g.hero.x + 250, want = clamp(lead, half, WORLD - half);
  cam.x = snap ? want : cam.x + (want - cam.x) * Math.min(1, dt * 5);
  cam.shakeX = shake * Math.sin(g.time * 90); cam.shakeY = shake * 0.6 * Math.cos(g.time * 77);
  art.setTime(FIXED_TIME ?? clamp((g.hero.x - 600) / 3600, 0, 1));
}
const summary = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: +m.toFixed(2), p50: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2), n: a.length }; };

if (MODE === 'states' && (Q.get('part') === 'zhou' || Q.get('part') === 'shang')) foot(Q.get('part'));
else if (MODE === 'states') await sheet();
else if (MODE === 'lanes') lanes();
else if (MODE === 'crowd') crowd();
else if (MODE === 'telegraph') telegraph();
else if (MODE === 'bench') bench();
else battle();

function battle() {
  fit(); addEventListener('resize', () => fit());
  const g = newGame(); let acc = 0, last = 0, paused = false, slow = num('slow', 1), ms = 0;
  follow(g, 0, true);
  const frame = (dtReal) => {                                                 // fixed steps, drawn with the remainder as alpha, as the game will
    acc += dtReal / slow; let n = 0;
    while (acc >= STEP && n < 5) { stepGame(g, STEP); acc -= STEP; n++; }
    follow(g, dtReal / slow, false);
    ms = ms * 0.9 + 0.1 * render(g, acc / STEP, dtReal / slow, 0);
    hud.textContent = `art ${ms.toFixed(2)} ms   hero x ${g.hero.x.toFixed(0)}  ${g.hero.state}  ${Math.abs(g.hero.vx).toFixed(0)} px/s   units ${g.units.length}${slow !== 1 ? '   slow ×' + slow : ''}${paused ? '   paused' : ''}`;
  };
  // for scripts: step whole frames and draw; no clock involved
  window.preview = { art, game: g, cam, step(n = 1) { for (let i = 0; i < n; i++) { stepGame(g, STEP); follow(g, STEP, false); } acc = 0; render(g, 1, STEP, 0); return { x: g.hero.x, state: g.hero.state, stateT: g.hero.stateT, phase: art.debug.hero.phase, gait: art.debug.hero.gait }; },
    // run on without drawing until the hero has passed x, then draw
    runTo(x) { let k = 0; const off = document.createElement('canvas').getContext('2d'); while (g.hero.x < x && k++ < 4000) { stepGame(g, STEP); follow(g, STEP, false); if (k % 2 === 0) art.drawFigures(off, cam, g, 1, STEP * 2); } render(g, 1, STEP, 0); return g.hero.x; } };
  addEventListener('keydown', (e) => { if (e.key === 'r') art.onEvent({ type: 'refuse', what: 'leap' }, g); else if (e.key === 't') art.onEvent({ type: 'refuse', what: 'strike' }, g); else if (e.key === ' ') paused = !paused; else if (e.key === '.') { paused = true; window.preview.step(1); } else if (e.key === '[') slow = Math.min(16, slow * 2); else if (e.key === ']') slow = Math.max(1, slow / 2); });
  if (AUTO) { const loop = (t) => { const d = Math.min(0.05, (t - last) / 1000 || STEP); last = t; if (!paused) frame(d); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  else render(g, 1, STEP, 0);
  document.title = 'ready';
}

// 30 figures in view at 1440 × 900 (or the window), every one animating, the camera scrolling the whole world
function bench() {
  fit(num('w', innerWidth), num('h', innerHeight)); const g = newGame(); g.units.length = 0; nextId = 1;
  const kinds = [['zhou', 'shield'], ['zhou', 'spear'], ['zhou', 'archer'], ['shang', 'spear'], ['shang', 'axe'], ['shang', 'archer'], ['shang', 'shield'], ['zhou', 'shield'], ['zhou', 'spear'], ['shang', 'axe']];
  for (let i = 0; i < 29; i++) { const [sd, k] = i === 28 ? ['shang', 'captain'] : kinds[i % kinds.length], u = unit(sd, k, 0, i % 3, { wait: i * 0.13 }); u.$off = -640 + (i * 1280) / 28; g.units.push(u); }
  g.hero.x = 800; g.$beat = 99; let frames = 0, last = 0; const N = num('n', 600), flushEvery = Q.get('flush') === '1';
  const loop = (t) => {
    if (last) stats.gaps.push(t - last); last = t;
    stepGame(g, STEP);
    if (g.hero.x > WORLD - 900) g.hero.x = g.hero.px = 800;
    cam.x = g.hero.x; art.setTime(FIXED_TIME ?? 0.5);
    for (const u of g.units) { const x = cam.x + u.$off + (u.state === 'walk' ? u.stateT * 30 * u.facing : 0); u.px = x - (u.state === 'walk' ? 0.5 * u.facing : 0); u.x = x; }
    if (frames % 20 === 0) { const u = g.units[frames % 29]; art.onEvent({ type: 'hit', x: u.x, y: 70, mult: 2, kill: false, dir: 1 }, g); art.onEvent({ type: 'land', x: g.hero.x, y: 0, speed: 500 }, g); }
    if (frames % 45 === 0) { art.onEvent({ type: 'swing', x: g.hero.x, y: 80, dir: 1 }, g); g.hero.state = 'strike'; g.hero.stateT = 0; }
    if (g.hero.state === 'strike' && g.hero.stateT > 0.37) g.hero.state = 'ride';
    render(g, 1, STEP, flushEvery && frames % 2 ? 2 : 1);
    if (++frames < N) requestAnimationFrame(loop);
    else { window.__bench = { view: [W, H, dpr], figures: g.units.length + 1, calls: summary(stats.calls.slice(30)), back: summary(stats.back.slice(30)), figs: summary(stats.figs.slice(30)), fx: summary(stats.fx.slice(30)), front: summary(stats.front.slice(30)), flushed: summary(stats.flushed.slice(15)), frameGap: summary(stats.gaps.slice(30)) }; hud.textContent = JSON.stringify(window.__bench, null, 1); document.title = 'ready'; }
  };
  requestAnimationFrame(loop);
}

// every kind in every state, at game size, labelled; then the same sheet as black silhouettes
async function sheet() {
  document.body.classList.add('sheet', 'clean');
  const CW = 2640, HERO_H = 400, FOOT_H = 235, TOP = 60, BLOCK = TOP + ((Q.get('part') || 'hero') === 'verbs' ? 3 : 4) * HERO_H + 30, both = Q.get('sil') !== '0' && Q.get('sil') !== 'only';
  const blocks = Q.get('sil') === 'only' ? [1] : both ? [0, 1] : [0];
  canvas.width = CW; canvas.height = BLOCK * blocks.length; canvas.style.width = CW + 'px'; canvas.style.height = canvas.height + 'px';
  art.setView({ width: CW, height: 900, dpr: 1 }); art.setTime(FIXED_TIME ?? 0);
  const off = document.createElement('canvas').getContext('2d'), camAt = (Y) => ({ x: CW / 2, y: Y - 738, zoom: 1, shakeX: 0, shakeY: 0 });
  const label = (s, x, y, big) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#35302B'; ctx.font = `${big ? '600 15px' : '13px'} ui-monospace, Menlo, monospace`; ctx.textAlign = big ? 'left' : 'center'; ctx.fillText(s, x, y); };
  const groundLine = (Y) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.35; ctx.fillStyle = '#A69F94'; ctx.fillRect(170, Y + 1, CW - 200, 1); ctx.globalAlpha = 1; };
  const PART = Q.get('part') || 'hero';
  const heroAt = (x, o) => ({ hold: 0, fullCry: false, boons: [], ...(o.extra || {}), x, y: o.y || 0, px: x, py: o.y || 0, vx: o.vx || 0, vy: o.vy || 0, facing: 1, hp: 5, maxHp: 5, state: o.state || 'ride', stateT: o.stateT || 0, topSpeed: 520, blade: 1, safe: 0 });
  // run the hero's own clock up to the wanted moment on a spare canvas, then draw the last frame on the sheet
  function heroCell(x, Y, spec) {
    const hm = art.debug.hero, cam = camAt(Y); hm.pts = {}; hm.slashT = 9; hm.gait = 'stand';
    const v = spec.run ?? spec.vx ?? 0, pre = spec.pre ?? 70; let n = pre;
    for (let i = 0; i < 400; i++) {                                           // the approach: ride in at the wanted speed
      const left = n - i; if (left <= 0) { if (spec.key == null || Math.floor(hm.phase * 8 + 1e-6) === spec.key) break; n++; }
      const xx = x - v * STEP * Math.max(0, n - i); art.drawFigures(off, cam, { hero: { ...heroAt(xx, { vx: v, extra: spec.pre0 ? null : spec.extra }), px: xx - v * STEP }, units: [] }, 1, STEP);
    }
    const o = { vx: spec.vx ?? v, extra: spec.extra, ...spec.then };
    if (spec.event) art.onEvent({ type: spec.event, x, y: 0, dir: 1 }, null);
    if (spec.swing) art.onEvent({ type: 'swing', x, y: 80, dir: 1 }, null);
    if (spec.refuse) art.onEvent({ type: 'refuse', what: spec.refuse }, null);
    const frames = spec.frames ?? 1;
    for (let i = 1; i <= frames; i++) art.drawFigures(i === frames ? ctx : off, cam, { hero: heroAt(x, { ...o, stateT: spec.then && spec.then.stateT != null ? spec.then.stateT : (i * STEP) }), units: [] }, 1, STEP);
    if (spec.fx) { art.drawEffects(ctx, cam, frames * STEP); } 
  }
  const HERO = [
    [['ride · standing', { vx: 0 }], ['ride · trot', { vx: 150 }], ['ride · gallop, gathered', { vx: 520, key: 1 }], ['ride · gallop, reaching', { vx: 520, key: 5 }],
      ['leap · rising', { run: 480, then: { state: 'leap', y: 46, vy: 420 }, frames: 6 }], ['leap · falling', { run: 480, then: { state: 'leap', y: 52, vy: -430 }, frames: 6 }]],
    [['strike 1 · DRAWN  (0.03 s)', { run: 480, swing: true, then: { state: 'strike' }, frames: 2 }], ['strike 2 · STRUCK  (0.10 s)', { run: 480, swing: true, then: { state: 'strike' }, frames: 6 }],
      ['strike 3 · CARRIED  (0.33 s)', { run: 480, swing: true, then: { state: 'strike' }, frames: 20 }], ['hurt  (0.07 s)', { run: 480, then: { state: 'hurt' }, frames: 4 }],
      ['stopped  (0.25 s)', { run: 480, vx: 0, then: { state: 'stopped', vx: 0 }, frames: 15 }]],
    [['leap refused · head toss, hoof up  (0.05 s)', { vx: 120, refuse: 'leap', frames: 3 }], ['leap refused · the stamp  (0.15 s)', { vx: 120, refuse: 'leap', frames: 9 }],
      ['strike refused · the arm jerks  (0.05 s)', { run: 480, refuse: 'strike', frames: 3 }], ['strike refused · checked  (0.10 s)', { run: 480, refuse: 'strike', frames: 7 }]],
    [['fallen 1 · the blow  (0.20 s)', { run: 300, vx: 0, then: { state: 'fallen', vx: 0 }, frames: 12, fx: true }], ['fallen 2 · the fall  (0.50 s)', { run: 300, vx: 0, then: { state: 'fallen', vx: 0 }, frames: 30 }],
      ['fallen · the ground  (0.68 s)', { run: 300, vx: 0, then: { state: 'fallen', vx: 0 }, frames: 41 }], ['fallen 3 · the stillness  (1.70 s)', { run: 300, vx: 0, then: { state: 'fallen', vx: 0 }, frames: 102 }]],
  ];
  const VERB_ROWS = [
    [['sweep · GATHERED, held 0.2 s', { run: 480, pre0: 1, extra: { hold: 0.2 }, frames: 10 }], ['sweep · GATHERED, held 0.8 s (full)', { run: 480, pre0: 1, extra: { hold: 0.8 }, frames: 10 }],
      ['sweep · SWEPT  (0.10 s)', { run: 480, event: 'sweep', then: { state: 'sweep' }, frames: 6, fx: true }], ['sweep · back to the carry  (0.42 s)', { run: 480, event: 'sweep', then: { state: 'sweep' }, frames: 25 }],
      ['full cry (neck out, all streaming flat)', { run: 520, extra: { fullCry: true }, key: 5, pre: 110 }], ['the same key, not in full cry', { run: 520, key: 5, pre: 110 }]],
    [['leap strike · RAISED, in the air', { run: 480, then: { state: 'strike', y: 62, vy: -200 }, frames: 6 }], ['leap strike · SLAMMED  (0.10 s)', { run: 480, event: 'shock', frames: 6, fx: true }], ['leap strike · back to the carry  (0.40 s)', { run: 480, event: 'shock', frames: 24 }],
      ['flame gallop · DASHING', { run: 520, then: { state: 'dash', vx: 830 }, frames: 9 }], ['rally · RALLYING, at a stand', { vx: 0, then: { state: 'rally', vx: 0 }, frames: 16 }], ['rally at a gallop', { run: 480, then: { state: 'rally' }, frames: 16 }]],
    [['no boon', { vx: 150 }], ['five boons, one of each element: blade fire, ribbons water and wood, scarf metal, plume earth', { vx: 150, extra: { boons: ['fire', 'water', 'wood', 'metal', 'earth'].map((element) => ({ id: 'x', element })) } }],
      ['one boon: water on the blade', { vx: 150, extra: { boons: [{ id: 'coldTide', element: 'water' }] } }], ['two: wood on the blade, fire on a ribbon', { vx: 150, extra: { boons: [{ id: 'galeLeap', element: 'wood' }, { id: 'emberBlade', element: 'fire' }] } }],
      ['two: metal, earth', { vx: 150, extra: { boons: [{ id: 'keenEdge', element: 'metal' }, { id: 'quake', element: 'earth' }] } }]],
  ];
  const FOOT = [['idle', 0.4], ['walk', 0.3], ['walk', 0.3], ['windup', 0.34], ['attack', 0.1], ['brace', 0.5], ['draw', 0.66], ['stun', 0.2], ['dead', 0.55]];
  const has = (kind, s) => s !== 'brace' && s !== 'draw' ? !(kind === 'archer' && s === 'windup') : (s === 'brace' ? kind === 'spear' : kind === 'archer');
  let id = 1000;
  blocks.forEach((sil, bi) => {
    const y0 = bi * BLOCK; art.debug.silhouettes(!!sil);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(0, y0, CW, BLOCK);
    label(sil ? 'the same sheet in black: every state must be told apart by its outline alone' : 'fengshen art · every kind in every state, at game size (view 900 high, zoom 1)', 24, y0 + 30, true);
    const HROWS = PART === 'verbs' ? VERB_ROWS : HERO;
    HROWS.forEach((row, r) => { const Y = y0 + TOP + (r + 1) * HERO_H - 40; groundLine(Y); label((PART === 'verbs' ? ['sweep, full cry', 'leap strike, flame gallop, rally', 'boon marks'] : ['hero on Jiliang', 'hero', 'refusals', 'the fall'])[r], 24, Y - 150, true);
      row.forEach(([name, spec], i) => { const x = PART !== 'verbs' && r === 3 ? 640 + i * 610 : 420 + i * 410; heroCell(x, Y, spec); label(name, x, Y + 26); }); });
    [].forEach((kind, r) => {
      const Y = y0 + TOP + 4 * HERO_H + (r + 1) * FOOT_H - 34, zhou = r < 2, units = []; groundLine(Y); label((zhou ? 'Zhou ' : 'Shang ') + kind, 24, Y - 90, true);
      let col = 0, walks = 0;
      for (const [s, t] of FOOT) { if (!has(kind, s)) continue; const x = 330 + col++ * 285, u = { id: s === 'walk' ? (walks++ ? 1003 : 1001) + r * 10 : id++, side: zhou ? 'zhou' : 'shang', kind, x, px: x, lane: 0, facing: zhou ? 1 : -1, hp: 3, maxHp: 3, state: s, stateT: t, flash: 0 };
        units.push(u); label(s === 'walk' ? `walk ${walks}` : `${s}  (${t} s)`, x, Y + 24); }
      art.drawFigures(ctx, camAt(Y), { hero: null, units, arrows: [] }, 0, STEP);
    });
  });
  art.debug.silhouettes(false);
  document.title = 'ready';
}

// each foe's warning, stepped through: one row a telegraph, one column every 0.06 s, from the state's first frame to the blow;
// then the same rows in black. The moment the blow lands is marked.
function telegraph() {
  document.body.classList.add('sheet', 'clean');
  const ROWS = [['shang', 'captain', 'windup', 1.0, 'attack', 'Shang captain · the sweep: gathered for 1.0 s, then the blow', 0.1], ['shang', 'captain', 'horn', 9, null, 'Shang captain · the horn', 0.1], ['shang', 'captain', 'dead', 9, null, 'Shang captain · the death (1.2 s)', 0.1],
    ['shang', 'shield', 'windup', 0.35, 'attack', 'Shang shield · windup 0.35 s, then the blow', 0.06], ['shang', 'shield', 'block', 9, null, 'Shang shield · block (the art holds it 0.34 s after `blocked`)', 0.06],
    ['shang', 'spear', 'brace', 0.35, null, 'Shang spear · brace (set at 0.35 s)', 0.06], ['shang', 'spear', 'windup', 0.45, 'attack', 'Shang spear · windup 0.45 s, then the blow', 0.06], ['shang', 'axe', 'windup', 0.5, 'attack', 'Shang axe · windup 0.5 s, then the blow', 0.06], ['shang', 'archer', 'draw', 0.7, 'attack', 'Shang archer · draw 0.7 s, then the arrow', 0.06],
    ['zhou', 'shield', 'windup', 0.35, 'attack', 'Zhou shield · windup 0.35 s, then the cut', 0.06], ['zhou', 'shield', 'block', 9, null, 'Zhou shield · block', 0.06], ['zhou', 'spear', 'brace', 9, null, 'Zhou spear · brace', 0.06],
    ['zhou', 'spear', 'windup', 0.35, 'attack', 'Zhou spear · windup 0.35 s, then the thrust', 0.06], ['zhou', 'archer', 'draw', 0.7, 'attack', 'Zhou archer · draw 0.7 s, then the arrow', 0.06], ['zhou', 'archer', 'volley', 9, null, 'Zhou archer · volley (aimed high)', 0.06]];
  const COLS = 14, CW = 240 + COLS * 200, RH = 250, RHC = 400, yOf = (r) => ROWS.slice(0, r + 1).reduce((a, q) => a + (q[1] === 'captain' ? RHC : RH), 0), BLOCK = 50 + yOf(ROWS.length - 1);
  canvas.width = CW; canvas.height = BLOCK * 2; canvas.style.width = CW + 'px'; canvas.style.height = canvas.height + 'px';
  art.setView({ width: CW, height: 900, dpr: 1 }); art.setTime(0);
  const text = (t, x, y, big) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#35302B'; ctx.font = `${big ? '600 14px' : '12px'} ui-monospace, Menlo, monospace`; ctx.textAlign = big ? 'left' : 'center'; ctx.fillText(t, x, y); };
  let id = 5000;
  [0, 1].forEach((sil) => {
    art.debug.silhouettes(!!sil); const y0 = sil * BLOCK;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(0, y0, CW, BLOCK);
    ROWS.forEach(([side, kind, s1, dur, s2, title, step], r) => {
      const Y = y0 + 50 + yOf(r) - 36, units = [], zhou = side === 'zhou'; text(title, 16, Y - (kind === 'captain' ? RHC : RH) + 62, true);
      for (let c = 0; c < COLS; c++) { const t = c * step, x = 230 + c * 200, late = s2 && t >= dur;
        units.push({ id: id++, side: zhou ? 'zhou' : 'shang', kind, x, px: x, lane: 0, facing: zhou ? 1 : -1, hp: 3, maxHp: 3, state: late ? s2 : s1, stateT: late ? t - dur : t, flash: 0 });
        text(`${t.toFixed(2)} s${late ? '  ' + s2 : ''}`, x, Y + 22); }
      art.drawFigures(ctx, { x: CW / 2, y: Y - 738, zoom: 1 }, { hero: null, units, arrows: [] }, 0, STEP);
    });
  });
  art.debug.silhouettes(false); document.title = 'ready';
}

// three figures on three lanes, standing on one spot and a little apart: they must read as three, not as one mass
function lanes() {
  document.body.classList.add('sheet', 'clean');
  const SETS = [['spear', 'axe', 'archer'], ['axe', 'axe', 'axe'], ['spear', 'spear', 'spear'], ['archer', 'archer', 'archer'], ['soldier', 'officer', 'soldier']];
  const GAPS = [0, 14, 30, 50], STATES = ['idle', 'windup'], CW = 220 + GAPS.length * STATES.length * 250, RH = 250, BLOCK = 50 + SETS.length * RH;
  canvas.width = CW; canvas.height = BLOCK * 2; canvas.style.width = CW + 'px'; canvas.style.height = canvas.height + 'px';
  art.setView({ width: CW, height: 900, dpr: 1 }); art.setTime(FIXED_TIME ?? 0);
  const text = (t, x, y, big) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#35302B'; ctx.font = `${big ? '600 14px' : '12px'} ui-monospace, Menlo, monospace`; ctx.textAlign = big ? 'left' : 'center'; ctx.fillText(t, x, y); };
  let id = 7000;
  [0, 1].forEach((sil) => {
    art.debug.silhouettes(!!sil); const y0 = sil * BLOCK;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(0, y0, CW, BLOCK);
    SETS.forEach((set, r) => {
      const Y = y0 + 50 + (r + 1) * RH - 36, units = [], zhou = set[0] === 'soldier'; text(set.join(' · '), 16, Y - RH + 62, true);
      STATES.forEach((st, si) => GAPS.forEach((gap, gi) => { const x = 250 + (si * GAPS.length + gi) * 250;
        set.forEach((kind, lane) => units.push({ id: id++, side: zhou ? 'zhou' : 'shang', kind, x: x + (lane - 1) * gap, px: x + (lane - 1) * gap, lane, facing: zhou ? 1 : -1, hp: 3, maxHp: 3, state: st, stateT: 0.4, flash: 0 }));
        text(`${st}, ${gap} px apart`, x, Y + 22); }));
      art.drawFigures(ctx, { x: CW / 2, y: Y - 738, zoom: 1 }, { hero: null, units, arrows: [] }, 0, STEP);
    });
  });
  art.debug.silhouettes(false); document.title = 'ready';
}

// Groups as the simulation now sets them: bodies 34 px apart in x, lanes alternating, a braced spear at the front.
// Colour, then grey (value only), then black. The last row is one of each kind alone, for measuring value.
function crowd() {
  document.body.classList.add('sheet', 'clean');
  const GAP = num('gap', 46);
  const Z = ['shield', 'spear', 'archer', 'archer'], SH = ['shield', 'spear', 'axe', 'archer'];
  const march = () => 'walk', zf = (k, lane) => (k === 'shield' ? (lane === 1 ? 'block' : 'attack') : k === 'spear' ? (lane === 0 ? 'windup' : 'attack') : 'volley');
  const sf = (k, lane) => (k === 'shield' ? (lane === 2 ? 'block' : 'windup') : k === 'spear' ? (lane === 1 ? 'brace' : 'attack') : k === 'axe' ? (lane === 0 ? 'windup' : 'idle') : 'draw');
  const ROWS = [
    ['a Zhou block marching: 3 deep, 4 files (shields, spears, archers, archers)', [['zhou', Z, march]]],
    ['the Zhou block fighting: shields cut and block, spears thrust past them, archers loose a volley', [['zhou', Z, zf]]],
    ['a Shang block marching: 3 deep, 4 files (shields, spears, axes, archers)', [['shang', SH, march]]],
    ['the Shang block fighting: one spear braced, archers drawing', [['shang', SH, sf]]],
    ['the two blocks meeting, 70 px between the fronts', [['zhou', Z, zf], ['shang', SH, sf]]],
    ['three at one x, one per rank: zhou shield, zhou spear, shang shield, shang axe (idle)', 'ranks'],
    ['one of each, front rank, idle (for value): zhou shield, spear, archer; shang spear, axe, archer, shield, captain', 'value'],
  ];
  const CW = 1500, RH = 300, BLOCK = 40 + ROWS.length * RH + 140, MODES = ['colour', 'grey', 'black'];
  canvas.width = CW * 3; canvas.height = BLOCK; canvas.style.width = CW * 3 + 'px'; canvas.style.height = BLOCK + 'px';
  art.setView({ width: CW * 3, height: 900, dpr: 1 }); art.setTime(FIXED_TIME ?? 0);
  const text = (t, x, y) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.fillStyle = '#35302B'; ctx.font = '600 13px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.fillText(t, x, y); };
  let id = 9000; window.__value = [];
  const mk = (kind, state, side, x, lane) => ({ id: id++, side, kind, x, px: x, lane, veteran: false, facing: side === 'zhou' ? 1 : -1, hp: 3, maxHp: 3, state, stateT: state === 'attack' ? 0.1 : 0.45, flash: 0 });
  MODES.forEach((mode, mi) => {
    art.debug.silhouettes(mode === 'black'); const x0 = mi * CW;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(x0, 0, CW, BLOCK);
    ROWS.forEach(([title, set], r) => {
      const Y = 40 + (r + 1) * RH - 30 + (r === ROWS.length - 1 ? 140 : 0), units = []; text(`${mode} · ${title}`, x0 + 14, Y - RH + 46 - (r === ROWS.length - 1 ? 140 : 0));
      const mid = x0 + CW / 2;
      if (set === 'ranks') [['zhou', 'shield'], ['zhou', 'spear'], ['shang', 'shield'], ['shang', 'axe']].forEach(([sd, k], i) => [0, 1, 2].forEach((lane) => units.push(mk(k, 'idle', sd, x0 + 260 + i * 320, lane))));
      else if (set === 'value') [['zhou', 'shield'], ['zhou', 'spear'], ['zhou', 'archer'], ['shang', 'spear'], ['shang', 'axe'], ['shang', 'archer'], ['shang', 'shield'], ['shang', 'captain']].forEach(([sd, k], i) => { const x = x0 + 130 + i * 175; units.push(mk(k, 'idle', sd, x, 0)); if (mi === 1) window.__value.push({ kind: sd + ':' + k, x, y: Y, big: k === 'captain' }); });
      else set.forEach(([sd, files, st]) => { const front = set.length === 2 ? mid + (sd === 'zhou' ? -35 : 35) : mid + (sd === 'zhou' ? 70 : -70);
        files.forEach((k, fi) => [0, 1, 2].forEach((lane) => units.push(mk(k, st(k, lane), sd, front + (sd === 'zhou' ? -1 : 1) * (fi * GAP + lane * num('brick', 15)), lane)))); });
      art.drawFigures(ctx, { x: CW * 1.5, y: Y - 738, zoom: 1 }, { hero: null, units, arrows: [] }, 0, STEP);
    });
  });
  // the middle third in grey: value only
  const img = ctx.getImageData(CW, 0, CW, BLOCK), d = img.data; for (let i = 0; i < d.length; i += 4) { const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); d[i] = d[i + 1] = d[i + 2] = l; } ctx.putImageData(img, CW, 0);
  // value of each kind alone: the figure's own pixels (darker than the paper by a margin), their mean and their darkest fifth
  const paper = 0.2126 * 0xEF + 0.7152 * 0xE7 + 0.0722 * 0xD6;
  window.__value = window.__value.map(({ kind, x, y }) => { const q = ctx.getImageData(x - 85, y - 180, 180, 186).data, v = []; for (let i = 0; i < q.length; i += 4) if (q[i] < paper - 12) v.push(q[i] / 255); v.sort((a, b) => a - b);
    const mean = v.reduce((a, b) => a + b, 0) / v.length, fifth = v.slice(0, Math.ceil(v.length / 5)).reduce((a, b) => a + b, 0) / Math.ceil(v.length / 5); return { kind, pixels: v.length, mean: +mean.toFixed(3), darkestFifth: +fifth.toFixed(3) }; });
  art.debug.silhouettes(false); document.title = 'ready';
}

// every kind of one side in every state it has, at game size, labelled; then the same in black
function foot(side) {
  document.body.classList.add('sheet', 'clean');
  const KINDS = side === 'zhou' ? ['shield', 'spear', 'archer'] : ['spear', 'axe', 'archer', 'shield', 'captain'];
  const cols = (kind) => { const K = kindOf(kind, side), c = [['idle', 0.4], ['walk', 0.3]];
    if (K.windup) { if (K.slow) c.push(['windup', 0.2], ['windup', 0.95]); else c.push(['windup', 0.34]); }
    c.push(['attack', 0.1]); for (const s of ['brace', 'draw', 'volley', 'block', 'horn']) if (K[s]) c.push([s, 0.5]);
    c.push(['stun', 0.2]); if (K.death) c.push(['dead', 0.3], ['dead', 0.62], ['dead', 0.9]); else c.push(['dead', 0.55]); return c; };
  const rh = (k) => (k === 'captain' ? 400 : 250), DX = (k) => (k === 'captain' ? 300 : 250), extra = side === 'zhou' ? 280 : 0;
  const CW = 3300, BLOCK = 60 + KINDS.reduce((a, k) => a + rh(k), 0) + extra + 30;
  canvas.width = CW; canvas.height = BLOCK * 2; canvas.style.width = CW + 'px'; canvas.style.height = canvas.height + 'px';
  art.setView({ width: CW, height: 900, dpr: 1 }); art.setTime(FIXED_TIME ?? 0);
  const text = (t, x, y, big) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#35302B'; ctx.font = `${big ? '600 15px' : '13px'} ui-monospace, Menlo, monospace`; ctx.textAlign = big ? 'left' : 'center'; ctx.fillText(t, x, y); };
  let id = 12000;
  [0, 1].forEach((sil) => {
    art.debug.silhouettes(!!sil); const y0 = sil * BLOCK; let Y = y0 + 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#EFE7D6'; ctx.fillRect(0, y0, CW, BLOCK);
    text(`${side === 'zhou' ? 'Zhou' : 'Shang'} · every kind in every state, at game size${sil ? ', in black' : ''}`, 24, y0 + 30, true);
    const mk = (kind, state, t, x, o = {}) => ({ id: id++, side, kind, x, px: x, lane: 0, veteran: false, facing: side === 'zhou' ? 1 : -1, hp: 3, maxHp: 3, state, stateT: t, flash: 0, ...o });
    for (const kind of KINDS) { Y += rh(kind); const units = []; text(`${side} ${kind}`, 24, Y - rh(kind) + 70, true);
      cols(kind).forEach(([s, t], c) => { const x = 330 + c * DX(kind); units.push(mk(kind, s, t, x)); text(`${s}  (${t} s)`, x, Y - 10); });
      art.drawFigures(ctx, { x: CW / 2, y: Y - 34 - 738, zoom: 1 }, { hero: null, units, arrows: [] }, 0, STEP); }
    if (side === 'zhou') { Y += extra; text('veterans (bronze cap and shoulders), and the mark an army boon puts on the shields: fire, water, wood, metal, earth', 24, Y - extra + 70, true);
      const row = (units, boons) => art.drawFigures(ctx, { x: CW / 2, y: Y - 34 - 738, zoom: 1 }, { hero: null, boons, units, arrows: [] }, 0, STEP);
      row(['shield', 'spear', 'archer'].map((k, i) => mk(k, 'idle', 0.4, 330 + i * 250, { veteran: true })), []); ['shield', 'spear', 'archer'].forEach((k, i) => text(`veteran ${k}`, 330 + i * 250, Y - 10));
      ['fire', 'water', 'wood', 'metal', 'earth'].forEach((element, i) => { row([mk('shield', 'idle', 0.4, 1200 + i * 250)], [{ id: 'spring', element }]); text(element, 1200 + i * 250, Y - 10); }); }
  });
  art.debug.silhouettes(false); document.title = 'ready';
}
