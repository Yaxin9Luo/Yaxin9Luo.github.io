// Spoils on the field: taking a boss's spoil, and what each spoil does every step. Owner: rules·build (B).
// Contract: lab/game-studies/SPEC-CAMPAIGN.md section 2.11. A calls `takeSpoil(g, f)` when a small or big boss dies, and
// `saveHero(g)` in hurtHero before a blow takes the hero's last health (八九玄功).

import {query, queryLane, Qhit, Qpick, CL, clusters} from './core.js';
import {hitFoe, addZone, shove} from './harm.js';
import {take, expose, heroMul} from './shapes.js';
import {held} from './squads.js';
import {isCommon, isNamed} from './generals.js';
import {payoff, recompute} from './build.js';
import {MAX, BY} from '../content.js';

const SPOIL = id => BY.spoil[id];
const stunFor = (f, t, boss) => { if (f.state !== 'dead') f.stun = Math.max(f.stun, isNamed(f) ? boss : t * (f.heavy ? .5 : 1)); };

/**
 * A small or big boss has died by the hero's side: his spoil is the hero's, and a big boss's also heals the hero fully.
 * (A big boss's guaranteed payoff comes with his chest of value 2: A's chest calls `bigPayoff`.) Returns the spoil's id,
 * or null when the boss has none (or it is held).
 */
export function takeSpoil(g, f) {
  const row = BY.spoilOf[f.kind];
  if (!row || g.build.spoils.some(s => s.id === row.id)) return null;
  g.build.spoils.push({id: row.id, from: f.kind, t: g.t, cd: row.id === 'changeForm' ? 0 : 1, n: 0});   // the stone is ready at once; the others begin a second later
  recompute(g);
  const ev = {type: 'spoil', id: row.id, from: f.kind, tier: row.tier, x: f.x, y: f.y, heal: false, payoff: null};
  g.events.push(ev);
  if (row.tier === 'big') { const h = g.hero; h.hp = h.maxHp; h.bleed = 0; ev.heal = true; }   // whole again: the bleeding stops too
  return row.id;
}
/**
 * A big boss's chest (value 2): a payoff, always. The first ready (evolution, blessed host, 显圣, 合璧); if none is, the
 * build's furthest treasure evolves, else its furthest squad is blessed, else its furthest general shows his true form.
 * Returns the payoff's kind, or null when the build has nothing to take it.
 */
export function bigPayoff(g, x, y) {
  const had = g.stats.payoffs.length;
  if (payoff(g, x, y, true) || forcePayoff(g, x, y)) return g.stats.payoffs.length > had ? g.stats.payoffs[g.stats.payoffs.length - 1].kind : null;
  return null;
}
/** A big boss's payoff when none is ready: the furthest treasure evolves, else the furthest squad is blessed, else a general's true form. */
function forcePayoff(g, x, y) {
  const b = g.build, far = (list, max) => list.reduce((best, e) => !best || e.level / max > best.level / max ? e : best, null);
  const t = far(b.treasures.filter(e => !e.evolved && !e.merged), MAX.treasure);
  if (t) {
    t.level = MAX.treasure; t.evolved = true; t.cd = .2;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'evolve', id: t.id});
    g.events.push({type: 'evolve', id: t.id, into: BY.treasure[t.id].evolved.id, x, y, first: false, chest: true, spoil: true});
    return true;
  }
  const s = far(b.troops.filter(e => !e.blessed), MAX.troop);
  if (s) {
    s.level = MAX.troop; s.blessed = true; s.rank = 5; s.skillCd = 1;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'blessed', id: s.id});
    g.events.push({type: 'rankUp', troop: s.id, rank: 5, level: s.level, x, y});
    g.events.push({type: 'blessed', troop: s.id, patron: BY.troop[s.id].patron, into: BY.troop[s.id].blessed.id, x, y, first: false, chest: true, spoil: true});
    return true;
  }
  const n = far(b.generals.filter(e => !e.trueForm), MAX.general);
  if (n) {
    n.level = MAX.general; n.trueForm = true; n.skillCd = 1;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'trueForm', id: n.id});
    g.events.push({type: 'trueForm', general: n.id, id: BY.general[n.id].trueForm.id, x, y, first: false, chest: true, spoil: true});
    return true;
  }
  return false;
}

/** What the spoils add to the sums the engine reads (recompute calls it). */
export function spoilMods(g, m) {
  for (const s of g.build.spoils) {
    const R = SPOIL(s.id);
    if (R.dashCd) m.dashCd *= R.dashCd;
    if (R.speed) m.speed *= 1 + R.speed;
  }
}

/** 八九玄功: a blow (or bleeding) that would take the hero's last health turns him to stone instead. A calls it in hurtHero and before a bleed death; true = he lives. */
export function saveHero(g) {
  const s = g.build.spoils.find(x => x.id === 'changeForm');
  if (!s || s.cd > 0) return false;
  const R = SPOIL('changeForm'), h = g.hero;
  s.cd = R.cd; h.safe = Math.max(h.safe, R.stone); h.hp = Math.max(h.hp, Math.round(h.maxHp * R.back)); h.bleed = 0;   // as stone he does not bleed
  g.events.push({type: 'spoilStrike', id: 'changeForm', shape: 'stone', x: h.x, y: h.y, radius: 40, time: R.stone});
  return true;
}

export function stepSpoils(g, dt) {
  const h = g.hero, mul = heroMul(g), area = g.mods.area;
  for (const s of g.build.spoils) {
    const R = SPOIL(s.id);
    s.cd -= dt;
    switch (s.id) {
      case 'hunyuanUmbrella': {                             // every shot near is swallowed; every eighth comes back as light
        s.radius = R.radius * area;
        const R2 = s.radius ** 2;
        for (const sh of g.shots) {
          if (sh.side !== 'shang' || sh.dead || (sh.x - h.x) ** 2 + (sh.y - h.y) ** 2 > R2) continue;
          sh.dead = true; s.n++;
          g.events.push({type: 'spoilStrike', id: s.id, shape: 'swallow', x: sh.x, y: sh.y, radius: 0, count: s.n % R.every || R.every});
          if (s.n % R.every === 0 && clusters(g, h.x, h.y, 600, 1)) blast(g, s.id, CL[0].x, CL[0].y, R.burst.radius * area, R.burst.dmg * mul, 0, 'light');
        }
        continue;
      }
      case 'yellowBreath': {                                // a ring of yellow breath: slowed always, souls taken every few seconds
        s.radius = R.radius * area;
        const n = query(h.x, h.y, s.radius, Qpick), pulse = s.cd <= 0;
        for (let i = 0; i < n; i++) { const f = Qpick[i]; f.slow = Math.max(f.slow, R.slow); f.slowT = Math.max(f.slowT, .15); if (pulse) stunFor(f, R.stun, R.stun / 3); }
        if (pulse) { s.cd = R.every; g.events.push({type: 'spoilStrike', id: s.id, shape: 'ring', x: h.x, y: h.y, radius: R.radius * area}); }
        continue;
      }
      case 'boneBanner': {                                  // under the planted banner the common fall and are taken; elites are held
        if (held(s.zone, s.zoneId, 'boneBanner') && s.zone.t < s.zone.life) {
          const z = s.zone, n = query(z.x, z.y, z.r, Qpick);
          for (let i = 0; i < n; i++) { const f = Qpick[i]; if (f.state === 'dead') continue; if (isCommon(f)) take(g, f, s.id); else f.stun = Math.max(f.stun, R.hold); }
        }
        if (s.cd > 0) continue;
        s.cd = R.cd;
        const z = addZone(g, 'boneBanner', 'zhou', s.id, h.x, h.y, R.radius * area, R.life * g.mods.dur);
        s.zone = z; s.zoneId = z.id;
        g.events.push({type: 'spoilStrike', id: s.id, shape: 'banner', x: h.x, y: h.y, radius: z.r, life: z.life});
        continue;
      }
      case 'earthTravel': {                                 // the spring goes under the earth; where he comes up it bursts
        if (h.dashT > 0) { if (!s.under) g.events.push({type: 'spoilStrike', id: s.id, shape: 'dive', x: h.x, y: h.y, radius: 40}); s.under = true; }
        else if (s.under) { s.under = false; blast(g, s.id, h.x, h.y, R.radius * area, R.dmg * mul, R.stun, 'burst'); }
        continue;
      }
      case 'marten': stepMarten(g, s, R, mul, dt); continue;
      case 'changeForm': continue;                          // passive (spoilMods) and saveHero
    }
    if (s.cd > 0) continue;
    if (!act(g, s, R, mul, area)) { s.cd = .3; continue; }
    s.cd = R.cd;
  }
}

/**
 * 花狐貂, a beast with a body (SPEC 2.11): it circles the hero (`circle`), leaps on its prey (`leap`), bites and holds
 * (`bite`), and comes back (`back`), or leaps again from where it is when it is ready. The art draws it from the spoil's
 * own fields: x, y (px, py: the step before), dir, state, stateT (seconds in it), target (the prey's id, or 0). Every step is decided by the field alone (deterministic).
 */
const MARTEN = {orbit: 58, spin: 2.6, speed: 1100, bite: .25, give: 1};
function preyOf(g, id) { if (!id) return null; for (const f of g.foes) if (f.id === id && f.state !== 'dead') return f; return null; }
function stepMarten(g, s, R, mul, dt) {
  const h = g.hero, M = MARTEN;
  if (s.x === undefined) { s.a = 0; s.x = h.x + M.orbit; s.y = h.y; s.dir = 0; s.state = 'circle'; s.target = 0; s.st = 0; s.leapT = 0; s.stateT = 0; s.was = 'circle'; }
  s.px = s.x; s.py = s.y;                                   // last step's place, for the art to ease between steps
  if (s.state !== s.was) { s.was = s.state; s.stateT = 0; }
  s.stateT += dt;
  s.a += M.spin * dt;
  const ox = h.x + Math.cos(s.a) * M.orbit, oy = h.y + Math.sin(s.a) * M.orbit;
  const go = (tx, ty, sp) => { const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy); if (d > .01) s.dir = Math.atan2(dy, dx); if (d <= sp * dt) { s.x = tx; s.y = ty; return true; } s.x += dx / d * sp * dt; s.y += dy / d * sp * dt; return false; };
  if ((s.state === 'circle' || s.state === 'back') && s.cd <= 0) {     // ready: choose the prey round the hero
    const n = query(h.x, h.y, R.range, Qpick);
    let best = null, bs = -1, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const f = Qpick[i];
      if (f.state === 'dead') continue;
      const sc = isCommon(f) && f.hp < f.maxHp * R.devour ? 2 : f.elite ? 1 : .5, d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2;
      if (sc > bs || (sc === bs && (d < bd || (d === bd && f.id < best.id)))) { bs = sc; best = f; bd = d; }
    }
    if (best) {
      s.state = 'leap'; s.target = best.id; s.leapT = 0;
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'leap', x: best.x, y: best.y, radius: 30, fromX: s.x, fromY: s.y, target: best.id});
    } else s.cd = .3;
  }
  switch (s.state) {
    case 'circle': {                                        // keeps to its ring round the hero, a little behind his moving
      const sp = Math.max(M.speed * .6, Math.hypot(h.vx || 0, h.vy || 0) * 1.5);
      go(ox, oy, sp);
      return;
    }
    case 'leap': {
      const f = preyOf(g, s.target);
      s.leapT += dt;
      if (!f || s.leapT > M.give) { s.state = 'back'; s.target = 0; return; }
      if (!go(f.x, f.y, M.speed)) return;
      // the bite: a common foe under the share is devoured whole, any other bitten hard
      const whole = isCommon(f) && f.hp < f.maxHp * R.devour;
      if (whole) take(g, f, s.id); else hitFoe(g, f, R.dmg * mul, s.id, null, s.x, s.y, null, false);
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'bite', x: s.x, y: s.y, radius: 30, target: f.id, devour: whole});
      s.state = 'bite'; s.st = M.bite; s.cd = R.cd;
      return;
    }
    case 'bite': {
      const f = preyOf(g, s.target);
      if (f) { s.x = f.x; s.y = f.y; }
      s.st -= dt;
      if (s.st <= 0) { s.state = 'back'; s.target = 0; }
      return;
    }
    case 'back': {
      if (go(ox, oy, M.speed)) s.state = 'circle';
      return;
    }
  }
}

/** A blast at a place: harm, a stun, a push. */
function blast(g, id, x, y, R, dmg, stun, shape, push = 0) {
  const n = query(x, y, R, Qhit);
  for (let i = 0; i < n; i++) { const f = Qhit[i]; hitFoe(g, f, dmg, id, null, x, y, null, false); if (stun) stunFor(f, stun, stun / 3); if (push && !f.heavy && f.state !== 'dead') shove(f, x, y, push); }
  g.events.push({type: 'spoilStrike', id, shape, x, y, radius: R});
  return n;
}

/** The spoils that work on a clock. Returns false when there is nobody to use it on. */
function act(g, s, R, mul, area) {
  const h = g.hero;
  switch (s.id) {
    case 'qingyunSword': {                                  // a black wind of blades all round
      if (!query(h.x, h.y, R.radius * area, Qpick)) return false;
      blast(g, s.id, h.x, h.y, R.radius * area, R.dmg * mul, 0, 'ring');
      return true;
    }
    case 'jadePipa': {                                      // wind and fire on the three densest groups
      const k = clusters(g, h.x, h.y, 600, R.count);
      if (!k) return false;
      for (let i = 0; i < k; i++) {
        blast(g, s.id, CL[i].x, CL[i].y, R.radius * area, R.dmg * mul, 0, 'windfire', R.push);
        const z = addZone(g, 'burn', 'zhou', s.id, CL[i].x, CL[i].y, R.radius * area, R.burnLife * g.mods.dur);
        z.dps = R.burnDps * mul;
      }
      return true;
    }
    case 'callName': {                                      // the strongest elite or named foe falls at his name
      const n = query(h.x, h.y, R.range, Qpick);
      let best = null;
      for (let i = 0; i < n; i++) { const f = Qpick[i]; if (f.state !== 'dead' && (f.elite || isNamed(f)) && (!best || f.hp > best.hp)) best = f; }
      if (!best) return false;
      best.stun = Math.max(best.stun, isNamed(best) ? R.bossStun : R.stun);
      expose(best, R.expose, R.exposeTime);
      const k = query(best.x, best.y, R.riders, Qhit);
      for (let i = 0; i < k; i++) { const f = Qhit[i]; if (R.riderKinds.includes(f.kind)) f.stun = Math.max(f.stun, R.stun); }
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'call', x: best.x, y: best.y, radius: R.riders, target: best.id});
      return true;
    }
    case 'goldWhips': {                                     // two whips on the two strongest, each leaping on to three more
      const n = query(h.x, h.y, R.range, Qpick), list = [];
      for (let i = 0; i < n; i++) if (Qpick[i].state !== 'dead') list.push(Qpick[i]);
      if (!list.length) return false;
      list.sort((a, b) => b.hp - a.hp || a.id - b.id);
      const targets = [];
      for (const f of list.slice(0, R.count)) {
        targets.push({x: f.x, y: f.y, id: f.id});
        hitFoe(g, f, R.dmg * mul, s.id, null, h.x, h.y, null, false);
        const k = query(f.x, f.y, R.chainRange, Qhit);
        for (let i = 0, c = 0; i < k && c < R.chain; i++) { const o = Qhit[i]; if (o === f || o.state === 'dead') continue; c++; hitFoe(g, o, R.dmg * R.chainShare * mul, s.id, null, f.x, f.y, null, false); targets.push({x: o.x, y: o.y, id: o.id, chain: true}); }
      }
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'whips', x: h.x, y: h.y, radius: 0, targets});
      return true;
    }
    case 'bloodBlade': {                                    // a flash of the blade down the densest line; those it cuts bleed
      if (!clusters(g, h.x, h.y, R.length, 1)) return false;
      const dir = Math.atan2(CL[0].y - h.y, CL[0].x - h.x), len = R.length * area, w = R.width * area, n = queryLane(h.x, h.y, dir, len, w, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i];
        hitFoe(g, f, R.dmg * mul, s.id, null, h.x, h.y, null, false);
        if (f.state === 'dead') continue;
        f.burn = Math.max(f.burn, f.maxHp * (isNamed(f) ? R.bossBleed : R.bleed)); f.burnT = Math.max(f.burnT, R.bleedTime); f.burnSrc = s.id;
      }
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'line', x: h.x, y: h.y, dir, length: len, width: w});
      return true;
    }
    case 'plague': {                                        // a plague cloud on the densest group
      if (!clusters(g, h.x, h.y, 600, 1)) return false;
      const z = addZone(g, 'miasma', 'zhou', s.id, CL[0].x, CL[0].y, R.radius * area, R.life * g.mods.dur);
      z.dps = R.dps * mul; z.slow = R.slow;
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'cloud', x: z.x, y: z.y, radius: z.r, life: z.life});
      return true;
    }
    case 'goldenCrown': {                                   // the crown blazes: all near are blind, and he cannot be struck
      const n = query(h.x, h.y, R.radius, Qpick);
      if (!n) return false;
      for (let i = 0; i < n; i++) stunFor(Qpick[i], R.stun, R.bossStun);
      h.safe = Math.max(h.safe, R.safe);
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'flash', x: h.x, y: h.y, radius: R.radius, time: R.safe});
      return true;
    }
    case 'fiveLights': {                                    // a fan of the five-coloured light: the common taken, the great lessened
      const R0 = R.radius * area, dir = g.massA, half = Math.cos(R.angle * Math.PI / 360), c = Math.cos(dir), sn = Math.sin(dir), n = query(h.x, h.y, R0, Qhit);
      let any = 0;
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy) || 1;
        if (f.state === 'dead' || (dx * c + dy * sn) / d < half) continue;
        any++;
        if (isCommon(f)) take(g, f, s.id);
        else hitFoe(g, f, f.maxHp * (isNamed(f) ? R.bossShare : R.share), s.id, null, h.x, h.y, null, true);
      }
      if (!any) return false;
      g.events.push({type: 'spoilStrike', id: s.id, shape: 'fan', x: h.x, y: h.y, dir, radius: R0, angle: R.angle});
      return true;
    }
  }
  return false;
}
