// The campaign's clock on the field: how many enter, where, and when the elites and bosses arrive; the bosses'
// phases and rage; the march and rout between stretches; 纣王 and the change to the 御林军; the run's end.
// Contract: SPEC-CAMPAIGN.md 1.1 to 1.3. Owner: rules·campaign (A).

import {TAU, DEAD, clamp, rand, setState} from './core.js';
import {addFoe} from './foes.js';
import {WORLD, SCHEDULE, SPAWN, BY, CAMPAIGN, LANDMARKS} from '../content.js';
import {mend} from './build.js';
import * as BUILD from './build.js';
import {fieldOf, SCENE_OF} from '../art/ground/layout.js';
import {addPickup, shock} from './harm.js';

export const PLAN = {alive: 0, rate: 0, hp: 1, armour: 0, mix: null};
/** What the field is kept at at time `t`: {alive, rate, hp, mix}. */
export function spawnPlan(t, out = {}) {
  const W = SCHEDULE.waves;
  let i = 0;
  while (i < W.length - 1 && W[i + 1].t <= t) i++;
  const a = W[i], b = W[Math.min(i + 1, W.length - 1)], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
  out.alive = Math.min(SCHEDULE.cap, a.alive + (b.alive - a.alive) * k); out.rate = a.rate + (b.rate - a.rate) * k; out.hp = a.hp + (b.hp - a.hp) * k; out.armour = (a.armour || 0) + ((b.armour || 0) - (a.armour || 0)) * k; out.mix = a.mix;
  if (i === W.length - 1 && i > 0) out.hp += (a.hp - W[i - 1].hp) / (a.t - W[i - 1].t) * (t - a.t);   // past the last row their health keeps growing as before
  return out;
}
export function pickKind(g, mix) {
  let total = 0;
  for (const k in mix) total += mix[k];
  let pick = rand(g) * total;
  for (const k in mix) if ((pick -= mix[k]) < 0) return k;
  return 'spear';
}
export const AT = {x: 0, y: 0};
/** A place `dist` from the hero at `angle`; when that is off the field, the opposite side, then the field's edge. */
export function placeAt(g, angle, dist) {
  const h = g.hero, e = WORLD.edge;
  let x = h.x + Math.cos(angle) * dist, y = h.y + Math.sin(angle) * dist;
  if (x < e || x > WORLD.w - e) x = h.x - Math.cos(angle) * dist;
  if (y < e || y > WORLD.h - e) y = h.y - Math.sin(angle) * dist;
  AT.x = clamp(x, e, WORLD.w - e); AT.y = clamp(y, e, WORLD.h - e);
  const F = g.field;
  if (F) {
    // on the walkable field, and on the hero's side of a shut wall
    AT.y = clamp(AT.y, F.ys[0], F.ys[1]);
    for (const gt of g.gates) if (!gt.open && (h.y < gt.y) !== (AT.y < gt.y)) AT.y = 2 * gt.y - AT.y;
    AT.y = clamp(AT.y, F.ys[0], F.ys[1]);
    const b = F.bounds(AT.y); AT.x = clamp(AT.x, b[0], b[1]);
    // not inside a landmark's building (0.6 of its yard)
    for (const m of g.landmarks) {
      const R = (m.r || 0) * .6, dx = AT.x - m.x, dy = AT.y - m.y, d = Math.hypot(dx, dy);
      if (R && d < R) { const k = d > 1e-6 ? R / d : 0; AT.x = d > 1e-6 ? m.x + dx * k : m.x + R; AT.y = d > 1e-6 ? m.y + dy * k : m.y; }
    }
  }
}
export function enter(g, kind, type) {
  placeAt(g, rand(g) * TAU, SPAWN.near + rand(g) * (SPAWN.far - SPAWN.near));
  const f = addFoe(g, kind, AT.x, AT.y);
  if (type) g.events.push({type, kind, x: f.x, y: f.y, id: f.id});
  return f;
}

// ------------------------------------------------------------------------------------------- the campaign's state
/** A well-mixed 32-bit hash (murmur3's finaliser): draws made from the seed alone, apart from the game's generator. */
const mix32 = h => { h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35); return (h ^ (h >>> 16)) >>> 0; };
/** The order of the small bosses, by the seed alone (the game's generator is not touched, so the run's other draws
 * are as before), and the rest of the campaign's state. Called by createGame. */
export function makeCampaign(g) {
  const seed = g.seed >>> 0, small = [];
  for (const S of CAMPAIGN.stretches) {
    const pool = S.pool.slice();
    let h = seed ^ Math.imul(S.index + 1, 0x9E3779B1);
    for (let i = pool.length - 1; i > 0; i--) { h = mix32(h + 0x6D2B79F5); const j = Math.floor(h / 4294967296 * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    S.small.forEach((slot, i) => {
      let kind = pool[i % pool.length];
      if (kind === 'mojia') kind = g.options.named || CAMPAIGN.mojia[seed % CAMPAIGN.mojia.length];
      small.push({t: slot.t, hp: slot.hp, kind, stretch: S.index, slot: i, unit: 0});
    });
  }
  g.landmarks = [];
  g.field = fieldFor(g, 0); g.gates = gatesOf(g.field);
  placeLandmarks(g, 0);
  return {stretch: -1, scene: 0, march: 0, rest: 0, marchTo: 0, next: null, bar: 0, guards: false, until: g.options.until || null,
    rageAt: Infinity, small, si: 0, bi: 0, finalDue: false, live: [], officers: 0, moved: false, smallDown: {}};
}

/** A boss of a tier enters: off screen as the mass does, with his retinue round him. */
export function enterBoss(g, kind, tier, hpK = 1, at = null) {
  const row = BY.foe[kind], c = g.campaign, f = enter(g, kind, 'boss');
  if (at) { f.x = f.px = at.x; f.y = f.py = at.y; }
  f.tier = tier; f.hp = f.maxHp = Math.round(f.maxHp * hpK);
  guardBoss(f);
  // a big or the final boss lands with a shock that throws everything round him outward, the hero too (1.10)
  const S = CAMPAIGN.shock.arrive, sh = tier === 'big' || tier === 'final' ? shock(g, f.x, f.y, S.radius, S.strength, true) : null;
  g.events.push({type: 'arrive', kind, name: row.name, title: row.title, x: f.x, y: f.y, id: f.id, tier, maxHp: f.maxHp, phases: f.phases, shock: sh});
  c.live.push(f);
  if (tier === 'big' || tier === 'final') c.bar = f.id;
  if (c.until === kind) c.rageAt = Math.min(c.rageAt, g.t + SCHEDULE.late.until);
  if (tier === 'final') c.rageAt = Math.min(c.rageAt, g.t + SCHEDULE.late.after);
  bringRetinue(g, f, 0);
  return f;
}
/** A boss (or officer) arrives warded, and his health may fall only so fast (1.14). */
export function guardBoss(f) {
  const G = CAMPAIGN.guard, share = G.cap[f.tier];
  if (!share) return;
  f.wardT = f.tier === 'lieutenant' ? 0 : G.ward; f.capMax = f.maxHp * share; f.capB = f.capMax * G.hold;
}
/** What a boss brings when he enters (phase 0) or enters a phase. */
function bringRetinue(g, f, phase) {
  const row = BY.foe[f.kind];
  if (!row.retinue) return;
  for (const R of row.retinue) {
    if ((R.phase || 0) !== phase) continue;
    for (let i = 0; i < (R.count || 1); i++) {
      const a = rand(g) * TAU, d = 70 + rand(g) * 90, o = addFoe(g, R.kind, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d), sub = BY.foe[R.kind];
      o.retinue = f.id;
      if (o.tier) { guardBoss(o); g.campaign.live.push(o); if (sub.guard) g.campaign.officers++; g.events.push({type: 'arrive', kind: R.kind, name: sub.name, title: sub.title, x: o.x, y: o.y, id: o.id, tier: o.tier, maxHp: o.maxHp, phases: o.phases}); }
      else { o.hp = o.maxHp = Math.round(o.maxHp * CAMPAIGN.retinue.hp); o.elite = false; }
      g.events.push({type: 'summoned', kind: R.kind, x: o.x, y: o.y, id: o.id, by: f.kind});
    }
  }
}

/** A boss or lieutenant has died (called by `kill`). A big boss's death begins a march, or wins a one-stretch run. */
export function bossDown(g, f) {
  const c = g.campaign;
  g.events.push({type: 'bossDown', id: f.id, kind: f.kind, tier: f.tier, x: f.x, y: f.y});
  g.stats.bosses[f.tier] = (g.stats.bosses[f.tier] || 0) + 1;      // B's meritOf reads it
  if (BY.foe[f.kind].guard && c.officers > 0) c.officers--;
  if (f.tier === 'small') { const slot = c.small.find(x => x.unit === f.id); if (slot) c.smallDown[slot.stretch + ':' + slot.slot] = true; }
  if (c.bar === f.id) c.bar = 0;
  if ((f.tier === 'small' || f.tier === 'big') && !f.flee) BUILD.takeSpoil(g, f);   // his own power; a big boss's also heals fully (SPEC 2.11)
  if (c.until === f.kind || f.tier === 'final') { win(g, f); return; }
  if (f.tier !== 'big' || f.flee) return;
  if (f.kind === CAMPAIGN.final.after) { c.finalDue = true; startMarch(g, false); }      // Zhaoge's men stand: 纣王 comes to them
  else startMarch(g, true);
}
/** The run's merit, by B's `meritOf` when it exists (it sets g.stats.merit and meritParts); 0 until then. */
export function meritNow(g) {
  if (BUILD.meritOf) BUILD.meritOf(g);
  return g.stats.merit || 0;
}
function win(g, f) {
  if (g.phase === 'won') return;
  g.phase = 'won'; g.stats.time = g.t;
  g.events.push({type: 'won', x: f.x, y: f.y, t: g.t, merit: meritNow(g)});
}
function startMarch(g, rout) {
  const c = g.campaign;
  c.moved = false;
  c.march = CAMPAIGN.march; c.marchTo = c.finalDue ? CAMPAIGN.final.index : Math.min(c.scene + 1, CAMPAIGN.final.index);
  g.events.push({type: 'march', from: c.scene, to: c.marchTo, time: CAMPAIGN.march, x: g.hero.x, y: g.hero.y});
  if (!rout) return;
  let n = 0;
  for (const f of g.foes) {
    if (f.state === 'dead' || f.flee) continue;
    f.flee = true; f.act = ''; f.stun = 1e9; f.summon = ''; n++;       // stunned: soldiers and the hero's body take no harm from them
    setState(f, 'flee');
  }
  for (const z of g.zones) if (z.side === 'shang') z.dead = true;        // what they had raised falls with their courage
  c.live = c.live.filter(o => !o.flee);
  g.events.push({type: 'rout', count: n, x: g.hero.x, y: g.hero.y});
}
function endMarch(g) {
  const c = g.campaign;
  for (const f of g.foes) if (f.flee && f.state !== 'dead') { f.state = 'dead'; f.stateT = DEAD; f.dead = true; g.alive--; }
  if (!c.moved) { c.moved = true; layNextField(g); }
  if (!c.finalDue) c.rest = CAMPAIGN.rest;                  // a rest after 闻仲 and 孔宣: no new mass while the prize lands (SPEC 1.14)
  c.scene = c.marchTo;
  placeLandmarks(g, c.scene);
  g.events.push({type: 'marchEnd', scene: c.scene, x: g.hero.x, y: g.hero.y, landmarks: g.landmarks, rest: c.rest});
  if (c.finalDue) {
    c.finalDue = false;
    swapGuards(g);
    const gate = g.gates.find(x => x.opensAfter === CAMPAIGN.final.after);
    if (gate) { gate.open = true; g.events.push({type: 'gateOpen', id: gate.id, x: gate.x, y: gate.y}); }
    const king = enterBoss(g, CAMPAIGN.final.kind, 'final', 1, gate ? {x: gate.x, y: g.field.ys[0] + 60} : null);
    void king;
  }
}
/** 纣王 has come: every Shang of the mass on the field changes dress in place, health kept in the same share. */
function swapGuards(g) {
  const c = g.campaign, map = CAMPAIGN.final.guards, units = [];
  c.guards = true;
  spawnPlan(g.t, PLAN);
  for (const f of g.foes) {
    if (f.state === 'dead' || f.tier || f.flee) continue;
    const to = map[f.kind] || map.other, row = BY.foe[to];
    if (to === f.kind || !row) continue;
    const share = f.hp / f.maxHp;
    units.push({id: f.id, from: f.kind, to});
    f.kind = to; f.elite = !!row.elite; f.heavy = !!row.heavy; f.r = row.r; f.speed = row.speed; f.scout = false; f.act = ''; f.pcd = null;
    f.dmg = row.dmg * (1 + SCHEDULE.dmg * g.t / 60) * g.tierK.dmg;
    f.maxHp = Math.round(row.hp * PLAN.hp * g.tierK.hp * (f.retinue ? CAMPAIGN.retinue.hp : 1)); f.hp = Math.max(1, Math.round(share * f.maxHp));
    f.armour = (row.armour || 0) + PLAN.armour; f.cd = row.between ? row.between * rand(g) : 0;
    if (f.state === 'windup' || f.state === 'charge' || f.state === 'rest') setState(f, 'walk');
  }
  g.events.push({type: 'guards', x: g.hero.x, y: g.hero.y, units});
}

/** A fresh set of landmarks for a scene, placed by the seed alone (not the game's generator). */
function placeLandmarks(g, scene) {
  if (g.options.bare || g.options.spawn === false) { g.landmarks = []; return; }
  if (g.field) {      // the scene's painted places (the ground session's fieldOf): the reward sits on the building
    g.landmarks = g.field.places.filter(p => LANDMARKS.kinds[p.kind]).map(p => ({id: p.id, kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), r: p.r, taken: false, scene}));
    return;
  }
  let h = (g.seed >>> 0) ^ Math.imul(scene + 7, 0x85EBCA6B);
  const r = () => (h = mix32(h + 0x6D2B79F5)) / 4294967296, L = LANDMARKS, e = 400, out = [];
  for (const kind in L.kinds) for (let i = 0; i < L.kinds[kind].count; i++) {
    let x = 0, y = 0;
    for (let k = 0; k < 40; k++) {
      const a = r() * TAU, d = L.near + r() * (L.far - L.near);
      x = clamp(g.hero.x + Math.cos(a) * d, e, WORLD.w - e); y = clamp(g.hero.y + Math.sin(a) * d, e, WORLD.h - e);
      if (out.every(o => Math.hypot(o.x - x, o.y - y) >= L.apart) && Math.hypot(g.hero.x - x, g.hero.y - y) >= L.near * .8) break;
    }
    out.push({id: `${scene}:${kind}:${i}`, kind, x: Math.round(x), y: Math.round(y), taken: false, scene});
  }
  g.landmarks = out;
}
// ------------------------------------------------------------------------------------------- the field (the scene session's)
const FIELDS = new Map();
/** The walkable field of a scene, as the art draws it (art/ground/layout.js fieldOf), cached; null on a bare stage. */
function fieldFor(g, scene) {
  if (g.options.bare || g.options.spawn === false || g.options.field === false) return null;
  const key = (g.seed >>> 0) + ':' + scene;
  let F = FIELDS.get(key);
  if (!F) { if (FIELDS.size > 64) FIELDS.clear(); F = fieldOf(g.seed >>> 0, scene); FIELDS.set(key, F); }
  return F;
}
const gatesOf = F => F ? F.gates.map(x => ({id: x.id, x: x.x, y: x.y, hw: x.hw, opensAfter: x.opensAfter, open: false})) : [];
/** Halfway through a march, under the art's mist: the next field is laid and the riders stand at its start. */
function layNextField(g) {
  const c = g.campaign, F = fieldFor(g, c.marchTo);
  if (!F || F === g.field) return;
  if (SCENE_OF[c.marchTo] === SCENE_OF[c.scene]) { g.field = F; g.gates = gatesOf(F); return; }   // the walls of Zhaoge stand on the same field: nobody moves
  const h = g.hero, dx = F.start[0] - h.x, dy = F.start[1] - h.y;
  h.x = h.px = F.start[0]; h.y = h.py = F.start[1];
  for (const a of g.allies) { a.x += dx; a.y += dy; a.px = a.x; a.py = a.y; a.mx0 += dx; a.my0 += dy; a.mx1 += dx; a.my1 += dy; }
  for (const p of g.pickups) { p.x += dx; p.y += dy; p.px = p.x; p.py = p.y; }     // what lay round him comes along
  for (const z of g.zones) if (z.side === 'zhou') { z.x += dx; z.y += dy; }
  g.field = F; g.gates = gatesOf(F);
  for (const f of g.foes) if (f.flee) { f.state = 'dead'; f.stateT = DEAD; f.dead = true; g.alive--; f.flee = false; }   // the routed are left behind
  g.events.push({type: 'fieldLaid', scene: c.marchTo, x: h.x, y: h.y});
}
/** A wall of the passes opens when its small boss has fallen (`small0`, `small1`: the stretch's first and second). */
function openGates(g) {
  const c = g.campaign;
  for (const gt of g.gates) {
    if (gt.open) continue;
    const m = /^small(\d)$/.exec(gt.opensAfter);
    if (m && c.smallDown[c.scene + ':' + m[1]]) { gt.open = true; g.events.push({type: 'gateOpen', id: gt.id, x: gt.x, y: gt.y}); }
  }
}
/**
 * Keep everyone on the walkable field and behind a shut wall (called by `step` after everything has moved). A boss
 * or officer passes a wall (he comes through its gate); the routed are not held.
 */
export function confine(g) {
  const F = g.field;
  if (!F) return;
  const h = g.hero, [y0, y1] = F.ys;
  let shut = false;
  for (const gt of g.gates) if (!gt.open) shut = true;
  if (h.y < y0) h.y = y0; else if (h.y > y1) h.y = y1;
  let b = F.bounds(h.y);
  if (h.x < b[0]) h.x = b[0]; else if (h.x > b[1]) h.x = b[1];
  if (shut) for (const gt of g.gates) if (!gt.open) h.y = wallHold(h.py, h.y, gt.y);
  const scene = g.campaign.scene, box = scene === 0;
  for (const f of g.foes) {
    if (f.state === 'dead' || f.flee) continue;
    if (f.y < y0) f.y = y0; else if (f.y > y1) f.y = y1;
    if (!box) { b = F.bounds(f.y); if (f.x < b[0]) f.x = b[0]; else if (f.x > b[1]) f.x = b[1]; }
    if (shut && !f.tier) for (const gt of g.gates) if (!gt.open) f.y = wallHold(f.py, f.y, gt.y);
  }
  if (!box) for (const a of g.allies) {
    if (a.state === 'dead' || a.state === 'away' || a.mvT > 0) continue;
    if (a.y < y0) a.y = y0; else if (a.y > y1) a.y = y1;
    b = F.bounds(a.y); if (a.x < b[0]) a.x = b[0]; else if (a.x > b[1]) a.x = b[1];
  }
}
const WALL = 40;
/** A shut wall at `wy`: who was on one side stays at least WALL px off it on that side. */
function wallHold(py, y, wy) {
  if (py <= wy) return y > wy - WALL ? Math.min(y, wy - WALL) : y;
  return y < wy + WALL ? Math.max(y, wy + WALL) : y;
}

/** The hero rides onto a landmark: it gives what its kind gives, once. */
function stepLandmarks(g) {
  const h = g.hero, L = LANDMARKS;
  if (h.fallT > 0) return;
  for (const m of g.landmarks) {
    if (m.taken || (h.x - m.x) * (h.x - m.x) + (h.y - m.y) * (h.y - m.y) > L.touch * L.touch) continue;
    const K = L.kinds[m.kind];
    m.taken = true;
    if (K.gives === 'reroll') g.rerolls++;
    else if (K.gives === 'mend') mend(g, h.maxHp * K.mend);
    else if (K.gives === 'merit') g.stats.landmarkMerit = (g.stats.landmarkMerit || 0) + K.merit;
    else if (K.gives === 'chest') addPickup(g, 'chest', m.x, m.y, 0);
    g.events.push({type: 'landmark', id: m.id, kind: m.kind, gives: K.gives, x: m.x, y: m.y});
  }
}

/** The campaign's turn: marches, the bosses' phases and rage, the rage's fallback; and when `timeline`, who arrives. */
export function stepCampaign(g, dt, timeline) {
  const c = g.campaign, t = g.t;
  if (c.march > 0) {
    c.march -= dt;
    if (!c.moved && c.march <= CAMPAIGN.march / 2) { c.moved = true; layNextField(g); }
    if (c.march <= 0) { c.march = 0; endMarch(g); }
  } else if (c.rest > 0 && (c.rest -= dt) <= 0) { c.rest = 0; g.events.push({type: 'restEnd', x: g.hero.x, y: g.hero.y}); }
  if (g.gates.length) openGates(g);
  for (let i = c.live.length - 1; i >= 0; i--) {
    const f = c.live[i];
    if (f.dead || f.state === 'dead') { c.live.splice(i, 1); continue; }
    if (f.phases) {
      const share = f.hp / f.maxHp;
      while (f.phase + 1 < f.phases.length && share < f.phases[f.phase + 1]) {
        f.phase++; f.cdK *= CAMPAIGN.phaseCd;
        g.events.push({type: 'bossPhase', id: f.id, kind: f.kind, phase: f.phase, x: f.x, y: f.y});
        bringRetinue(g, f, f.phase);
      }
    }
    if (f.tier === 'big' && !f.enraged && t - f.born >= CAMPAIGN.enrage) {
      const R = CAMPAIGN.rage;
      f.enraged = true; f.dmg *= R.dmg; f.speed *= R.speed; f.cdK *= R.cd;
      g.events.push({type: 'enrage', id: f.id, kind: f.kind, x: f.x, y: f.y});
    }
  }
  if (t >= SCHEDULE.late.at && c.rageAt > SCHEDULE.late.at) c.rageAt = SCHEDULE.late.at;
  for (const el in g.lightTaken) if (t >= g.lightTaken[el]) { delete g.lightTaken[el]; g.events.push({type: 'lightReturned', element: el, x: g.hero.x, y: g.hero.y}); }
  if (g.landmarks.length) stepLandmarks(g);
  if (!timeline) return;
  const S = CAMPAIGN.stretches;
  while (c.stretch + 1 < S.length && t >= S[c.stretch + 1].from) { const x = S[++c.stretch]; g.events.push({type: 'stretch', index: x.index, id: x.id, name: x.name, x: g.hero.x, y: g.hero.y}); }
  if (c.march > 0) return;                                  // nobody arrives on the march
  while (c.si < c.small.length && t >= c.small[c.si].t) { const s = c.small[c.si++]; s.unit = enterBoss(g, s.kind, 'small', s.hp).id; }
  while (c.bi < S.length && t >= S[c.bi].big.t) enterBoss(g, S[c.bi++].big.kind, 'big');
  // what comes next, for the page's timeline
  const ns = c.small[c.si], nb = S[c.bi];
  c.next = ns && (!nb || ns.t < nb.big.t) ? {t: ns.t, tier: 'small', kind: ns.kind} : nb ? {t: nb.big.t, tier: 'big', kind: nb.big.kind} : null;
}

export function stepSpawn(g, dt) {
  const s = g.spawn, t = g.t;
  if (!s.opened) {
    s.opened = true;
    for (const O of SPAWN.opening) {
      const a0 = rand(g) * TAU;
      for (let i = 0; i < O.count; i++) { placeAt(g, a0 + i * TAU / O.count, O.near + rand(g) * (O.far - O.near)); addFoe(g, O.kind, AT.x, AT.y); }
    }
  }
  const E = SCHEDULE.elites, R = SCHEDULE.rings, c = g.campaign;
  if (c.march > 0 || c.rest > 0) {
    // nothing enters on the march or the rest after it: what fell due is let go
    while (s.elite < E.length && t >= E[s.elite].t) s.elite++;
    while (s.ring < R.length && t >= R[s.ring].t) s.ring++;
    s.acc = 0;
    return;
  }
  spawnPlan(t, PLAN);
  const mix = c.guards ? CAMPAIGN.final.mix : PLAN.mix;      // from 纣王's coming only the 御林军 (held here: addFoe refills PLAN)
  s.acc = Math.min(s.acc + PLAN.rate * dt, Math.max(6, PLAN.rate * 2));
  s.t -= dt;
  if (s.t <= 0) {
    s.t += SPAWN.every;
    let n = Math.min(Math.floor(s.acc), Math.ceil(PLAN.alive) - g.alive, SCHEDULE.cap - g.alive);
    if (n > 0) s.acc -= n;
    while (n > 0) {
      const k = Math.min(n, 1 + Math.floor(rand(g) * SPAWN.clump)), angle = rand(g) * TAU, dist = SPAWN.near + rand(g) * (SPAWN.far - SPAWN.near);
      placeAt(g, angle, dist);
      const bx = AT.x, by = AT.y;
      for (let i = 0; i < k; i++) addFoe(g, pickKind(g, mix), bx + (rand(g) - .5) * SPAWN.spread, by + (rand(g) - .5) * SPAWN.spread);
      n -= k;
    }
  }
  while (s.elite < E.length && t >= E[s.elite].t) { for (let i = 0; i < E[s.elite].count; i++) enter(g, c.guards ? CAMPAIGN.final.elites.kind : E[s.elite].kind, 'elite'); s.elite++; }
  if (c.guards && t >= s.guardAt) { s.guardAt = t + CAMPAIGN.final.elites.every; enter(g, CAMPAIGN.final.elites.kind, 'elite'); }
  if (t >= s.shamanAt && t < SCHEDULE.shamans.until) { s.shamanAt += SCHEDULE.shamans.every; enter(g, 'shaman', null); }
  const SC = SCHEDULE.scouts;
  if (t >= s.scoutAt && t < SC.until && !c.live.some(f => f.tier === 'small')) {      // no scout while a small boss is on the field
    s.scoutAt += t >= SC.faster.from ? SC.faster.every : SC.every;
    let out = 0;
    for (const x of g.foes) if (x.scout && x.state !== 'dead') out++;
    if (out < SC.most) {
      const f = enter(g, 'chariot', 'scout');
      f.scout = true; f.elite = false; f.hp = f.maxHp = Math.round(f.hp * SC.hp); f.dmg *= SC.dmg;
    }
  }
  while (s.ring < R.length && t >= R[s.ring].t) {
    const r = R[s.ring++], a0 = rand(g) * TAU;
    g.events.push({type: 'encircle', kind: r.kind, count: r.count, x: g.hero.x, y: g.hero.y});
    for (let i = 0; i < r.count; i++) { placeAt(g, a0 + i * TAU / r.count, SPAWN.far); addFoe(g, r.kind, AT.x, AT.y); }
  }
}
