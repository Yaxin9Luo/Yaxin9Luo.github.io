// Stand-in for sim.js, used by the page with ?stub=1 (or ?stub=sim) while the real simulation is being written.
// It follows lab/game-studies/SPEC-V2.md closely enough to drive the page: the same fields, the same events, the six
// verbs, three kinds of warband, boons and six waves. It is NOT the game's rules: formations are a loose file, most
// boons are only recorded (their effects are the real simulation's work), and nothing here is tested.
//
// Input per step (the shape the page sends; see the page session's note in the shared notes folder):
//   {move, leap, order, pick, strike (down edge), strikeHeld (level), strikeUp (edge), gallop (edge), rally (edge)}
const HERO_HW = 46, FOOT_HW = 16, WORLD = 4800;
export const LAST_WAVE = 6;
const K = {
  zhou: {
    shield: {hp: 70, dmg: 8, speed: 150, wind: .3, cd: 1, reach: 46}, spear: {hp: 48, dmg: 10, speed: 150, wind: .3, cd: 1, reach: 100},
    archer: {hp: 30, dmg: 9, speed: 150, wind: .5, cd: 2.2, reach: 0, range: 560},
  },
  shang: {
    spear: {hp: 50, dmg: 12, speed: 60, wind: .45, cd: 1.3, reach: 100}, axe: {hp: 60, dmg: 16, speed: 85, wind: .5, cd: 1.5, reach: 50},
    shield: {hp: 70, dmg: 8, speed: 60, wind: .4, cd: 1.2, reach: 46}, archer: {hp: 26, dmg: 9, speed: 70, wind: .7, cd: 2.6, reach: 0, range: 620},
    captain: {hp: 320, dmg: 26, speed: 50, wind: 1, cd: 2.6, reach: 150},
  },
};
const ELEMENT = {emberBlade: 'fire', wildfire: 'fire', coldTide: 'water', spring: 'water', galeLeap: 'wood', arrowRain: 'wood', keenEdge: 'metal', mirrorShields: 'metal', quake: 'earth', deepRoots: 'earth'};
const ARMY = ['levyShield', 'levySpear', 'levyArcher', 'drill'];
const kindOf = u => K[u.side][u.kind];
function rnd(g) { g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0; return g.seed / 4294967296; }
function add(g, side, kind, x) {
  const k = K[side][kind];
  const u = {id: g.nextId++, side, kind, veteran: false, x, px: x, lane: g.nextId % 3, facing: side === 'zhou' ? 1 : -1, hp: k.hp, maxHp: k.hp, state: 'idle', stateT: 0, flash: 0, cd: rnd(g), freeze: 0, stun: 0, aimX: 0, horn: 12};
  g.units.push(u); return u;
}
export function createGame(seed = 1) {
  const g = {seed: (seed >>> 0) || 1, phase: 'fight', wave: 0, choices: null, order: 'follow', holdX: 0, t: 0, stats: {kills: 0, best: 0, bestMult: 1, time: 0, lost: 0},
    hero: {x: 700, y: 0, px: 700, py: 0, vx: 0, vy: 0, facing: 1, hp: 100, maxHp: 100, state: 'ride', stateT: 0, topSpeed: 520, blade: 1, safe: 0,
      hold: 0, fullCry: false, cd: {gallop: 0, rally: 0}, buffs: [], boons: [],
      freeze: 0, strikeT: -1, hit: null, hurtT: 0, stopT: 0, fallT: 0, holding: false, cryT: 0, dashT: 0, dashFrom: 0, rallyT: 0, sweepT: 0, airStrike: false, peak: 0, strikes: 0},
    units: [], arrows: [], trails: [], events: [], nextId: 1, nextWave: 1.2, volleyAt: 0, routed: false};
  ['shield', 'shield', 'shield', 'spear', 'spear', 'spear', 'archer', 'archer'].forEach((kind, i) => add(g, 'zhou', kind, 640 - i * 44));
  return g;
}
export function counts(g) {
  const c = {shields: 0, spears: 0, archers: 0, foes: 0};
  for (const u of g.units) { if (u.state === 'dead') continue; if (u.side === 'shang') c.foes++; else c[u.kind + 's']++; }
  return c;
}
const ev = (g, type, x, y, more) => g.events.push({type, x, y, ...more});
function set(u, state) { if (u.state !== state) { u.state = state; u.stateT = 0; } }
function hurtUnit(g, u, dmg, fromX, pierce) {
  if (u.kind === 'shield' && !pierce && fromX !== undefined && Math.sign(fromX - u.x) === u.facing) { dmg *= .5; if (rnd(g) < .4) ev(g, 'blocked', u.x + u.facing * 14, 46); }
  u.hp -= dmg; u.flash = .12;
  const kill = u.hp <= 0;
  if (kill) {
    set(u, 'dead'); if (u.side === 'shang') g.stats.kills++; else g.stats.lost++;
    if (u.kind === 'captain') { g.routed = true; ev(g, 'rout', u.x, 60); }
  }
  return kill;
}
function hurtHero(g, dmg) {
  const h = g.hero;
  if (h.safe > 0 || h.dashT > 0 || h.fallT > 0 || g.phase === 'lost' || g.phase === 'won') return;
  h.hp = Math.max(0, h.hp - dmg); h.safe = .35; h.hurtT = .2;
  ev(g, 'hurt', h.x, h.y + 60, {dmg});
  if (h.hp <= 0) { h.fallT = 1.8; h.state = 'fallen'; h.stateT = 0; ev(g, 'fall', h.x, h.y, {dir: -h.facing}); }     // the run ends when the fall is over (see step)
}
function spawnWave(g) {
  g.wave++; g.routed = false;
  let budget = 4 + 3 * g.wave, n = 0, group = 0;
  const kinds = ['spear', 'axe']; if (g.wave >= 2) kinds.push('shield'); if (g.wave >= 3) kinds.push('archer');
  const edge = Math.min(WORLD - 60, g.hero.x + 1000);
  if (g.wave === LAST_WAVE) { add(g, 'shang', 'captain', Math.min(WORLD - 20, edge + 420)); n++; }
  while (budget >= 1.5) {
    const kind = kinds[(rnd(g) * kinds.length) | 0];
    if (n % 3 === 0) group += 90 + rnd(g) * 160;
    add(g, 'shang', kind, Math.min(WORLD - 20, edge + group + (n % 3) * 34 + (kind === 'archer' ? 200 : 0)));
    budget -= 1.5; n++;
  }
  ev(g, 'wave', g.hero.x, 0, {wave: g.wave, count: n});
}
function offer(g) {
  const h = g.hero, own = new Set(h.boons.map(b => b.id)), boons = Object.keys(ELEMENT).filter(id => !own.has(id)), army = ARMY.slice();
  const take = a => a.splice((rnd(g) * a.length) | 0, 1)[0];
  const out = [take(boons), take(army)]; out.push(rnd(g) < .7 && boons.length ? take(boons) : take(army));      // at least one of each
  for (let i = out.length - 1; i > 0; i--) { const j = (rnd(g) * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
  g.choices = out.filter(Boolean); g.phase = 'choose';
}
function choose(g, id) {
  const h = g.hero;
  if (ELEMENT[id]) {
    h.boons.push({id, element: ELEMENT[id]});
    if (id === 'deepRoots') { h.maxHp += 40; h.hp += 40; }
    ev(g, 'boon', h.x, h.y + 80, {id, element: ELEMENT[id]});
  } else {
    if (id === 'drill') { let n = 4; for (const u of g.units) if (n && u.side === 'zhou' && u.state !== 'dead' && !u.veteran) { u.veteran = true; u.maxHp = Math.round(u.maxHp * 1.4); u.hp = u.maxHp; n--; } }
    else { const kind = id.replace('levy', '').toLowerCase(); for (let i = 0; i < 4; i++) add(g, 'zhou', kind, h.x - h.facing * (120 + i * 50)); }
    ev(g, 'upgrade', h.x, h.y, {id});
  }
}
function cut(g, u, base, pierce) {
  const h = g.hero, dt = 1 / 60, uv = (u.x - u.px) / dt, closing = Math.max(0, (h.vx - uv) * Math.sign(u.x - h.x || h.facing)), mult = 1 + closing / 260, dmg = Math.round(base * h.blade * mult);
  const kill = hurtUnit(g, u, dmg, h.x, pierce);
  const f = kill ? .09 : mult >= 1.8 ? .06 : .03; h.freeze = Math.max(h.freeze, f); u.freeze = f;
  if (dmg > g.stats.best) { g.stats.best = dmg; g.stats.bestMult = mult; }
  ev(g, 'hit', u.x, 60, {dmg, mult, kill, dir: h.facing});
  return kill;
}
function hero(g, input, dt) {
  const h = g.hero, ground = h.y <= 0, top = h.topSpeed;
  if (h.stopT > 0) h.stopT -= dt;
  if (h.sweepT > 0) h.sweepT -= dt;
  // flame gallop and rally
  if (input.gallop && h.cd.gallop <= 0 && h.stopT <= 0) { h.dashT = .5; h.dashFrom = h.x; h.cd.gallop = 12; ev(g, 'dash', h.x, h.y); }
  if (input.rally && h.cd.rally <= 0) { h.rallyT = 6; h.cd.rally = 20; h.buffs = ['rally']; h.rallyShow = .5; ev(g, 'rally', h.x, h.y + 130); }
  if (h.rallyT > 0) { h.rallyT -= dt; if (h.rallyT <= 0) h.buffs = []; }
  if (h.rallyShow > 0) h.rallyShow -= dt;
  if (h.dashT > 0) {
    h.dashT -= dt; h.vx = h.facing * top * 1.6;
    if (h.dashT <= 0) { h.vx = h.facing * top; const far = h.boons.some(b => b.id === 'wildfire') ? 2 : 1, x1 = h.x, x0 = x1 - (x1 - h.dashFrom) * far; g.trails.push({x0: Math.min(x0, x1), x1: Math.max(x0, x1), t: 2.5}); ev(g, 'trail', h.x, 0, {x0, x1}); }
  } else if (ground && h.stopT <= 0) {
    const m = input.move || 0, cap = h.hold >= .35 ? top * .6 : top;
    if (m && h.vx * m < 0) h.vx += m * 900 * dt;
    else if (m) h.vx = Math.max(-cap, Math.min(cap, h.vx + m * 620 * dt));
    else h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx), 300 * dt);
    if (Math.abs(h.vx) > cap) h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx) - cap, 1200 * dt);
    if (h.vx) h.facing = Math.sign(h.vx); else if (m) h.facing = m;
    if (input.leap && Math.abs(h.vx) >= 180) { h.vy = h.boons.some(b => b.id === 'galeLeap') ? 690 : 560; h.y = .01; h.peak = 0; ev(g, 'leap', h.x, 0); }
  }
  if (!ground || h.y > 0) {
    h.vy -= 1600 * dt; h.y += h.vy * dt; h.peak = Math.max(h.peak, h.y);
    if (h.y <= 0) {
      h.y = 0; h.vy = 0; ev(g, 'land', h.x, 0, {speed: Math.abs(h.vx)});
      if (h.airStrike) {
        h.airStrike = false; const wide = h.boons.some(b => b.id === 'quake') ? 300 : 150, power = Math.min(2, h.peak / 98);
        ev(g, 'shock', h.x, 0, {power});
        for (const u of g.units) if (u.side === 'shang' && u.state !== 'dead' && Math.abs(u.x - h.x) <= wide) { if (!hurtUnit(g, u, 18 * power * h.blade, h.x, true)) { set(u, 'stun'); u.stun = .6; } }
      }
    }
  }
  h.x = Math.max(HERO_HW, Math.min(WORLD - HERO_HW, h.x + h.vx * dt));
  if (h.x <= HERO_HW || h.x >= WORLD - HERO_HW) h.vx = 0;
  // full cry
  const frac = Math.abs(h.vx) / top;
  if (!h.fullCry) { h.cryT = frac >= .9 && h.y <= 0 ? h.cryT + dt : 0; if (h.cryT >= .8) { h.fullCry = true; ev(g, 'fullCry', h.x, h.y, {on: true}); } }
  else if (frac < .7) { h.fullCry = false; h.cryT = 0; ev(g, 'fullCry', h.x, h.y, {on: false}); }
  // strike on the down edge; held on, it becomes a sweep on release
  if (input.strike && h.strikeT < 0 && h.sweepT <= 0 && h.stopT <= 0) {
    h.strikeT = 0; h.hit = new Set(); h.strikes++; h.holding = h.y <= 0; if (h.y > 0) h.airStrike = true;
    ev(g, 'swing', h.x + h.facing * 60, h.y + 70, {dir: h.facing});
  }
  if (h.holding && input.strikeHeld) h.hold += dt;
  else if (h.holding) {
    if (h.hold >= .35) {
      const full = h.hold >= .8; h.sweepT = .32; h.strikeT = -1;
      ev(g, 'sweep', h.x + h.facing * 90, 60, {dir: h.facing, full});
      for (const u of g.units) {
        if (u.side !== 'shang' || u.state === 'dead') continue;
        const d = (u.x - h.x) * h.facing; if (d < -10 || d > 180 + HERO_HW) continue;
        if (!cut(g, u, 32, full)) { u.x += h.facing * 60; if (full && u.state === 'brace') set(u, 'stun'), u.stun = .5; }
      }
    }
    h.holding = false; h.hold = 0;
  }
  if (h.strikeT >= 0) {
    h.strikeT += dt;
    if (h.strikeT >= .05 && h.strikeT <= .17) for (const u of g.units) {
      if (u.side !== 'shang' || u.state === 'dead' || h.hit.has(u.id)) continue;
      const d = (u.x - h.x) * h.facing;
      if (d < -10 || d > 120 + HERO_HW || h.y > 150) continue;
      h.hit.add(u.id);
      const gold = h.boons.some(b => b.id === 'keenEdge') && h.strikes % 3 === 0;
      if (gold) ev(g, 'crit', u.x, 70);
      cut(g, u, gold ? 40 : 20, gold);
    }
    if (h.strikeT >= .37) h.strikeT = -1;
  }
  if (ground && Math.abs(h.vx) >= 200) for (const u of g.units) {
    if (u.side !== 'shang' || u.state === 'dead' || u.state === 'stun' || Math.abs(u.x - h.x) > HERO_HW + FOOT_HW) continue;
    const front = Math.sign(h.x - u.x) === u.facing && Math.sign(h.vx) === -u.facing;
    if (u.kind === 'spear' && u.state === 'brace' && u.stateT >= .35 && front && h.dashT <= 0) {
      h.vx = 0; h.stopT = .35; h.holding = false; h.hold = 0; ev(g, 'braced', u.x, 70); hurtHero(g, 18); break;
    } else if (Math.abs(h.vx) >= 260) {
      const kill = hurtUnit(g, u, h.fullCry ? 20 : 10); if (!kill) { set(u, 'stun'); u.stun = .7; if (h.fullCry) u.lane = (u.lane + 1) % 3; }
      if (h.dashT <= 0) h.vx *= .85; ev(g, 'trample', u.x, 0, {kill});
    }
  }
  if (h.hurtT > 0) h.hurtT -= dt;
  const s = h.stopT > 0 ? 'stopped' : h.hurtT > 0 ? 'hurt' : h.dashT > 0 ? 'dash' : h.sweepT > 0 ? 'sweep' : h.rallyShow > 0 ? 'rally' : h.strikeT >= 0 ? 'strike' : h.y > 0 ? 'leap' : 'ride';
  if (s !== h.state) { h.state = s; h.stateT = 0; } else h.stateT += dt;
}
function nearest(g, u, side, range = Infinity) {
  let best = null, bd = range;
  for (const o of g.units) { if (o.side !== side || o.state === 'dead') continue; const d = Math.abs(o.x - u.x); if (d < bd) { bd = d; best = o; } }
  if (side === 'zhou' && g.hero.fallT <= 0 && Math.abs(g.hero.x - u.x) < bd) best = g.hero;
  return best;
}
function melee(g, u, target, dt) {
  const k = kindOf(u), isHero = target === g.hero, d = Math.abs(target.x - u.x), reach = k.reach + (isHero ? HERO_HW - FOOT_HW : 0);
  u.facing = Math.sign(target.x - u.x) || u.facing;
  if (u.state === 'windup') {
    if (u.stateT >= k.wind) {
      set(u, 'attack'); u.cd = k.cd * (u.side === 'shang' && g.routed ? 2 : 1);
      if (d <= reach + 14 && !(isHero && target.y > 70)) {
        const dmg = k.dmg * (u.veteran ? 1.4 : 1);
        if (isHero) hurtHero(g, dmg);
        else { const kill = hurtUnit(g, target, dmg, u.x); ev(g, 'clash', target.x, 50, {side: target.side, kill}); }
      }
    }
  } else if (u.state === 'attack') { if (u.stateT >= .18) set(u, 'idle'); }
  else if (d > reach) { set(u, 'walk'); u.x += u.facing * k.speed * dt; }
  else if (u.cd <= 0) set(u, 'windup');
  else set(u, 'idle');
}
function shoot(g, u, target, d, dt) {
  const k = kindOf(u), h = g.hero;
  u.facing = Math.sign(target.x - u.x) || u.facing;
  if (u.state === 'draw') {
    if (u.stateT >= k.wind) {
      const T = .9, n = u.side === 'zhou' && h.boons.some(b => b.id === 'arrowRain') ? 3 : 1;
      for (let i = 0; i < n; i++) g.arrows.push({x: u.x, y: 70, px: u.x, py: 70, vx: (u.aimX + (i - (n - 1) / 2) * 40 - u.x) / T, vy: 600 * T / 2 - 40 / T, dmg: k.dmg * (u.veteran ? 1.4 : 1), side: u.side});
      ev(g, 'loose', u.x, 70); u.cd = k.cd; set(u, 'idle');
      if (u.side === 'zhou' && g.order === 'hold' && g.t >= g.volleyAt) { g.volleyAt = g.t + 2; ev(g, 'volley', u.x, 90); }
    }
  } else if (d < 220) { set(u, 'walk'); u.x = Math.max(20, Math.min(WORLD - 20, u.x - u.facing * k.speed * dt)); }
  else if (d > k.range) { set(u, 'walk'); u.x += u.facing * k.speed * dt; }
  else if (u.cd <= 0) { set(u, 'draw'); u.aimX = target.x + (target === h ? h.vx * .9 * .4 : 0); }
  else set(u, 'idle');
}
function unit(g, u, i, dt) {
  const h = g.hero, k = kindOf(u), rallied = u.side === 'zhou' && h.rallyT > 0 && Math.abs(u.x - h.x) <= 450;
  u.stateT += dt; if (u.flash > 0) u.flash -= dt; if (u.cd > 0) u.cd -= dt * (rallied ? 1.5 : 1);
  if (u.state === 'dead') return;
  if (u.freeze > 0) { u.freeze -= dt; return; }
  if (u.state === 'stun') { u.stun -= dt; if (u.stun <= 0) set(u, 'idle'); return; }
  if (u.side === 'zhou') {
    const range = u.kind === 'archer' ? k.range : g.order === 'charge' ? Infinity : g.order === 'hold' ? 160 : 140, foe = nearest(g, u, 'shang', range);
    if (foe || u.state === 'windup' || u.state === 'attack' || u.state === 'draw') { if (!foe) set(u, 'idle'); else if (u.kind === 'archer') shoot(g, u, foe, Math.abs(foe.x - u.x), dt); else melee(g, u, foe, dt); return; }
    // a loose block: shields nearest the hero, spears behind them, archers at the back
    const rank = u.kind === 'shield' ? 0 : u.kind === 'spear' ? 1 : 2, file = (i % 9) / 3 | 0;
    const home = g.order === 'hold' ? g.holdX - rank * 48 - file * 30 : h.x - h.facing * (HERO_HW + 60 + rank * 110 + file * 40), d = home - u.x;
    if (Math.abs(d) > 8) { set(u, 'walk'); u.facing = Math.sign(d); u.x += u.facing * Math.min(Math.abs(d), k.speed * dt * (Math.abs(d) > 200 ? 2.6 : 1)); }
    else { set(u, 'idle'); u.facing = g.order === 'hold' ? 1 : h.facing; }
    return;
  }
  const target = nearest(g, u, 'zhou'); if (!target) return;
  const d = Math.abs(target.x - u.x), close = nearest(g, u, 'zhou', 70), busy = close && close !== h;
  if (u.kind === 'captain') { u.horn -= dt; if (u.horn <= 0) { u.horn = 12; ev(g, 'captainHorn', u.x, 120); for (const o of g.units) if (o.side === 'shang' && Math.abs(o.x - u.x) < 500) o.cd = Math.min(o.cd, .2); } }
  if (u.kind === 'spear' && !busy && u.state !== 'windup' && u.state !== 'attack' && h.fallT <= 0) {
    const dh = (h.x - u.x), front = Math.abs(dh) <= 460 && Math.abs(dh) > HERO_HW, closing = h.vx * Math.sign(-dh) > 60;
    if (front && (closing || (u.state === 'brace' && Math.abs(h.vx) > 20))) { u.facing = Math.sign(dh); set(u, 'brace'); return; }
  }
  if (u.kind === 'archer') shoot(g, u, target, d, dt); else melee(g, u, target, dt);
}
export function step(g, input, dt = 1 / 60) {
  const h = g.hero;
  g.t += dt;
  h.px = h.x; h.py = h.y; for (const u of g.units) u.px = u.x; for (const a of g.arrows) { a.px = a.x; a.py = a.y; }
  if (g.phase === 'fight' || g.phase === 'choose') g.stats.time += dt;
  if (h.fallT > 0) input = {};
  if (g.phase === 'choose' && input.pick != null && g.choices[input.pick]) { choose(g, g.choices[input.pick]); g.choices = null; g.phase = 'fight'; g.nextWave = 2; }
  if (input.order && input.order !== g.order) { g.order = input.order; g.holdX = h.x; ev(g, 'order', h.x, 120, {order: g.order}); }
  if (h.safe > 0) h.safe -= dt;
  h.cd.gallop = Math.max(0, h.cd.gallop - dt); h.cd.rally = Math.max(0, h.cd.rally - dt);
  if (h.fallT > 0) {
    if (h.state !== 'fallen') { h.state = 'fallen'; h.stateT = 0; }
    h.fallT -= dt; h.stateT += dt; h.hold = 0; h.fullCry = false; h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx), 900 * dt); h.x += h.vx * dt;
    if (h.fallT <= 0) { h.fallT = 0; g.phase = 'lost'; g.choices = null; ev(g, 'lost', h.x, h.y); }
  } else if (g.phase !== 'lost') { if (h.freeze > 0) h.freeze -= dt; else hero(g, input, dt); }
  g.units.forEach((u, i) => unit(g, u, i, dt));
  for (const tr of g.trails) { tr.t -= dt; for (const u of g.units) if (u.side === 'shang' && u.state !== 'dead' && u.x >= tr.x0 && u.x <= tr.x1) hurtUnit(g, u, 8 * dt); }
  g.trails = g.trails.filter(tr => tr.t > 0);
  for (const a of g.arrows) {
    a.vy -= 600 * dt; a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.side === 'shang' && a.vy < 0 && a.y < 90 && Math.abs(a.x - h.x) < HERO_HW && h.y < 60 && h.safe <= 0 && h.dashT <= 0 && h.fallT <= 0) { a.dead = true; ev(g, 'arrowHit', a.x, a.y); hurtHero(g, a.dmg); continue; }
    if (a.y <= 0) {
      a.dead = true;
      const foe = a.side === 'zhou' ? 'shang' : 'zhou', hit = g.units.find(u => u.side === foe && u.state !== 'dead' && Math.abs(u.x - a.x) < 22);
      const guard = a.side === 'shang' && g.units.find(u => u.side === 'zhou' && u.kind === 'shield' && u.state !== 'dead' && Math.abs(u.x - a.x) < 60);
      if (guard) ev(g, 'blocked', guard.x, 50);
      else if (hit) { const kill = hurtUnit(g, hit, a.dmg); ev(g, 'clash', hit.x, 40, {side: hit.side, kill}); }
      ev(g, 'arrowHit', a.x, 0);
    }
  }
  g.arrows = g.arrows.filter(a => !a.dead);
  g.units = g.units.filter(u => u.state !== 'dead' || u.stateT < 1.2);
  if (g.phase === 'fight' && h.fallT <= 0) {
    if (g.nextWave > 0) { g.nextWave -= dt; if (g.nextWave <= 0) spawnWave(g); }
    else if (g.wave > 0 && !g.units.some(u => u.side === 'shang' && u.state !== 'dead')) {
      ev(g, 'cleared', h.x, 0, {wave: g.wave});
      if (g.wave >= LAST_WAVE) { g.phase = 'won'; ev(g, 'won', h.x, 0); } else offer(g);
    }
  }
  return g;
}
