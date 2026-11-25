// The attack shapes every treasure, soldier and general casts, and the treasures' own step. Owner: rules·build (B).

import {TAU, rand, buildGrid, query, queryLane, Qpick, Qhit, PICKED, DIRS, nearestFoe, pickNearest, CL, refreshDense, clusters, inZone} from './core.js';
import {paramsOf, setPower} from './build.js';
import {hitFoe, wardBurst, addShot, addZone, kill, shock} from './harm.js';

/** A great strike (SPEC-CAMPAIGN 1.10): it really pushes the field outward; the result goes on its event as `shock`. */
export const GREAT = {scale: 1.6, strength: 110, max: 450, manifest: {radius: 360, strength: 160}};   // manifest: the moment a payoff comes (显圣, 神兵天降, an evolution, 合璧)
export const manifest = (g, x, y) => shock(g, x, y, GREAT.manifest.radius, GREAT.manifest.strength);
export const greatShock = (g, x, y, r) => shock(g, x, y, Math.min(GREAT.max, r * GREAT.scale), GREAT.strength);
import {isCommon, isNamed} from './generals.js';
import {stepSpoils} from './spoils.js';
import {GENERAL, MAX, BY, PAYOFF} from '../content.js';

/** A foe revealed (照妖鉴) or nailed (钉头七箭书): every blow on him is harder while `exposeT` lasts (A's hitFoe reads it). */
/** A foe captured, beheaded or turned to ash: the health it had left counts as the harm of what took it. */
export function take(g, f, src) {
  const left = Math.max(0, f.hp);
  g.stats.damage[src] = (g.stats.damage[src] || 0) + left;
  g.events.push({type: 'hit', x: f.x, y: f.y, id: src, target: f.id, dmg: left, dot: false, push: 0, fromX: f.x, fromY: f.y, take: true});
  kill(g, f, src);
}
export function expose(f, share, time) { if (f.state === 'dead') return; f.expose = Math.max(f.exposeT > 0 ? f.expose || 0 : 0, share); f.exposeT = Math.max(f.exposeT || 0, time); }

export function doLine(g, x, y, dir, len, w, dmg, P, id, level, evolved, el, by, fork, weapon = false) {
  g.events.push({type: 'cast', id, level, evolved, shape: weapon ? 'line' : P.shape, x, y, dir, length: len, width: w, fork, by, weapon});
  const n = queryLane(x, y, dir, len, w, Qhit), hold = P.shape === 'bind';
  // 土行孙 is with him: the rope he once stole holds half as long again
  const H = hold ? P.hold * (id === 'rope' && g.tuxing ? BY.general.tuxingsun.ropeUp : 1) : 0;
  for (let i = 0; i < n; i++) {
    const f = Qhit[i];
    if (P.capture && isCommon(f) && f.hp - dmg < f.maxHp * P.capture) { take(g, f, id); continue; }   // the strongmen carry him off
    hitFoe(g, f, dmg, id, P, x, y, el, false);
    if (hold && f.state !== 'dead') f.stun = Math.max(f.stun, H * g.mods.dur * (f.heavy ? .25 : 1));
  }
  if (P.burnDps || hold) {
    const z = addZone(g, hold ? 'bind' : 'burn', 'zhou', id, x, y, 0, (hold ? H : P.burnLife) * g.mods.dur);
    z.shape = 'lane'; z.dir = dir; z.len = len; z.w = w; z.dps = hold ? 0 : P.burnDps * g.mods.dmg; z.level = level; z.evolved = evolved;
  }
}

/** What comes down at (x, y): the blow, and the field it leaves if its row has one. */
export function landAt(g, x, y, P, id, level, evolved, mul, el = null) {
  const R = P.radius * g.mods.area, ev = {type: 'land', id, level, evolved, x, y, radius: R, push: P.push || 0};
  g.events.push(ev);
  const n = query(x, y, R, Qhit);
  for (let i = 0; i < n; i++) {
    const f = Qhit[i];
    if (P.behead) {
      // 斩仙飞刀: a common foe's head falls; a great one loses a share of his greatest health besides the blow
      if (isCommon(f)) { take(g, f, id); continue; }
      hitFoe(g, f, P.dmg * mul, id, P, x, y, el, false);
      if (f.state !== 'dead') hitFoe(g, f, f.maxHp * P.share, id, null, x, y, null, false);
      continue;
    }
    hitFoe(g, f, P.dmg * mul, id, P, x, y, el, false);
    if (P.hold && f.state !== 'dead') {
      // 遁龙桩: the gold rings hold even a heavy foe; a named one a third as long
      const hold = P.hold * g.mods.dur * (isNamed(f) ? 1 / 3 : 1);
      f.stun = Math.max(f.stun, hold);
      const z = addZone(g, 'bind', 'zhou', id, f.x, f.y, f.r + 12, hold);
      z.unit = f; z.level = level; z.evolved = evolved;
    }
  }
  if (evolved && P.great) ev.shock = greatShock(g, x, y, R);
  if (P.zoneLife) {
    const z = addZone(g, P.zone || 'burn', 'zhou', id, x, y, R, P.zoneLife * g.mods.dur);
    z.dps = P.zoneDps * mul; z.slow = P.zoneSlow || 0; z.chase = P.chase || 0; z.level = level; z.evolved = evolved;
  }
}

/**
 * Cast one attack of a row from an owner (the hero or a soldier: anything with x and y). `P` is the row's numbers
 * at its level, `mul` what the caster's damage is multiplied by, `el` an element the blow carries, `by` the
 * soldier's id. Returns false, and does nothing, when there is nobody to aim at.
 */
export function castShape(g, o, P, id, level, evolved, mul = 1, el = null, by = 0) {
  buildGrid(g); refreshDense(g);                         // called from outside a step: look at the field as it is now
  return cast(g, o, P, id, level, evolved, mul, el, by);
}
export function cast(g, o, P, id, level, evolved, mul, el, by) {
  const area = g.mods.area, x = o.x, y = o.y;
  switch (P.shape) {
    case 'line': case 'bind': {
      const len = P.length * area, w = P.width * area, count = P.count || 1;
      const n = pickNearest(x, y, len, count, .4);
      if (!n) return false;
      const d0 = Math.atan2(PICKED[0].y - y, PICKED[0].x - x);
      for (let i = 0; i < count; i++) {
        const dir = i < n ? Math.atan2(PICKED[i].y - y, PICKED[i].x - x) : d0 + i * TAU / count;
        DIRS[i] = dir;
      }
      for (let i = 0; i < count; i++) {
        const dir = DIRS[i];
        doLine(g, x, y, dir, len, w, P.dmg * mul, P, id, level, evolved, el, by, false);
        if (P.fork) {
          const tx = x + Math.cos(dir) * len, ty = y + Math.sin(dir) * len;
          for (let k = 0; k < P.fork; k++) {
            const off = P.fork === 1 ? 0 : (k / (P.fork - 1) * 2 - 1) * P.forkAngle;
            doLine(g, tx, ty, dir + off, len * P.forkLength, w, P.dmg * mul, P, id, level, evolved, el, by, true);
          }
        }
      }
      return true;
    }
    case 'arc': {
      const R = P.radius * area, t = nearestFoe(x, y, Math.max(R * .85, P.range || 0));
      if (!t) return false;
      const dir = Math.atan2(t.y - y, t.x - x), full = P.angle >= 360, half = Math.cos(P.angle * Math.PI / 360), c = Math.cos(dir), s = Math.sin(dir);
      const ev = {type: 'cast', id, level, evolved, shape: 'arc', x, y, dir, radius: R, angle: P.angle, span: P.span || 0, by};
      g.events.push(ev);
      const n = query(x, y, R, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
        if (!(full || d <= f.r || (dx * c + dy * s) / d >= half)) continue;
        const bane = P.bane && P.bane.includes(f.kind);
        hitFoe(g, f, P.dmg * mul * (bane ? P.baneMult : 1) * (P.namedMult && isNamed(f) ? P.namedMult : 1), id, P, x, y, el, false);
        if (f.state === 'dead') continue;
        if (P.ash && isCommon(f) && f.hp < f.maxHp * P.ash) { take(g, f, id); continue; }          // 七禽: ash
        if (P.expose) expose(f, P.expose, P.exposeTime * g.mods.dur);                               // 照妖鉴: revealed
        if (bane && P.baneStun) f.stun = Math.max(f.stun, P.baneStun * g.mods.dur);
      }
      if (P.burnDps) {
        // the fan's fire stays on the ground along the cone
        const z = addZone(g, 'burn', 'zhou', id, x, y, 0, P.burnLife * g.mods.dur);
        z.shape = 'lane'; z.dir = dir; z.len = R; z.w = Math.max(30, R * Math.sin(Math.min(P.angle, 120) * Math.PI / 360)); z.dps = P.burnDps * mul; z.level = level; z.evolved = evolved;
      }
      if (evolved && P.great && !by) ev.shock = greatShock(g, x, y, R);
      if (P.again) {
        // 落魂: the bell rings again a moment later, round wherever he is then
        const z = addZone(g, 'fall', 'zhou', id, x, y, R, P.again);
        z.P = {...P, again: 0, delay: 0}; z.level = level; z.evolved = evolved; z.mul = mul; z.follow = o === g.hero;
      }
      return true;
    }
    case 'throw': {
      let n = 0, tx = 0, ty = 0;
      if (P.target === 'cluster') {
        if (!clusters(g, g.hero.x, g.hero.y, P.range, 1)) return false;
        tx = CL[0].x; ty = CL[0].y;
      } else {
        n = pickNearest(x, y, P.range, P.count, 0);
        if (!n) return false;
        tx = PICKED[0].x; ty = PICKED[0].y;
      }
      const d0 = Math.atan2(ty - y, tx - x), r = (P.shotR || P.r) * area;
      g.events.push({type: 'cast', id, level, evolved, shape: 'throw', x, y, dir: d0, count: P.count, by});
      for (let i = 0; i < P.count; i++) {
        const dir = i < n ? Math.atan2(PICKED[i].y - y, PICKED[i].x - x) : d0 + (i === 0 ? 0 : ((i + 1) >> 1) * .22 * (i & 1 ? 1 : -1));
        const s = addShot(g, id, 'zhou', id, x, y, Math.cos(dir) * P.speed, Math.sin(dir) * P.speed, r, P.dmg * mul, P.life);
        s.pierce = P.pierce || 0; s.bounces = P.bounces || 0; s.hop = P.hop || 0; s.returns = !!P.returns; s.el = el; s.P = P;
        s.level = level; s.evolved = evolved;
      }
      return true;
    }
    case 'drop': {
      const targets = [];
      if (P.pick === 'strongest') {
        const range = P.range, n = query(x, y, range, Qpick), mark = ++g.markN;
        if (!n) return false;
        let m = 0;
        while (m < P.count) {
          let best = null;
          for (let i = 0; i < n; i++) { const f = Qpick[i]; if (f.mark !== mark && (!best || f.hp > best.hp)) best = f; }
          if (!best) break;
          best.mark = mark; PICKED[m++] = best;
        }
        if (P.chainElites) for (let i = 0; i < n && m < 24; i++) { const f = Qpick[i]; if (f.elite && f.mark !== mark) { f.mark = mark; PICKED[m++] = f; } }
        for (let i = 0; i < m; i++) targets.push({x: PICKED[i].x, y: PICKED[i].y, id: PICKED[i].id});
      } else {
        const n = clusters(g, x, y, P.range, P.count);
        if (!n) return false;
        for (let i = 0; i < P.count; i++) {
          const c = CL[i % n];
          if (i < n) targets.push({x: c.x, y: c.y});
          else { const a = rand(g) * TAU, d = P.radius * area * (1 + rand(g)); targets.push({x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d}); }
        }
      }
      g.events.push({type: 'cast', id, level, evolved, shape: 'drop', x, y, dir: Math.atan2(targets[0].y - y, targets[0].x - x), targets, radius: P.radius * area, delay: P.delay, by});
      for (const t of targets) {
        if (P.delay > 0) {
          const z = addZone(g, 'fall', 'zhou', id, t.x, t.y, P.radius * area, P.delay);
          z.P = P; z.level = level; z.evolved = evolved; z.mul = mul;
        } else landAt(g, t.x, t.y, P, id, level, evolved, mul);
      }
      return true;
    }
    case 'beam': {
      const len = P.length * area, t = nearestFoe(x, y, len);
      if (!t) return false;
      const dir = Math.atan2(t.y - y, t.x - x);
      g.events.push({type: 'cast', id, level, evolved, shape: 'beam', x, y, dir, length: len, width: P.width * area, life: P.life, sweep: P.sweep, count: P.count || 1, by});
      for (let k = 0; k < (P.count || 1); k++) {
        const z = addZone(g, 'beam', 'zhou', id, x, y, 0, P.life * g.mods.dur);
        z.shape = 'lane'; z.dir = dir + k * TAU / (P.count || 1); z.len = len; z.w = P.width * area; z.dps = P.dmg * mul; z.slow = P.slow || 0; z.spin = P.sweep || 0;
        z.follow = o === g.hero; z.level = level; z.evolved = evolved; z.P = P;
      }
      return true;
    }
  }
  return false;
}

// Pearls and the like are shots that never fly off: they are set round the hero whenever the build changes.
export function rebuildOrbits(g) {
  for (const s of g.shots) if (s.orbit) s.dead = true;
  for (const t of g.build.treasures) for (const e of t.merged ? t.parts : [t]) {
    const P = paramsOf(e);
    if (P.shape !== 'orbit') continue;
    g.events.push({type: 'cast', id: e.id, level: e.level, evolved: e.evolved, shape: 'orbit', x: g.hero.x, y: g.hero.y, dir: 0, rings: P.rings});
    P.rings.forEach((ring, ri) => {
      for (let k = 0; k < ring.count; k++) {
        const s = addShot(g, e.id, 'zhou', e.id, g.hero.x, g.hero.y, 0, 0, P.r, P.dmg, Infinity);
        s.orbit = true; s.ring = ri; s.a0 = k * TAU / ring.count; s.P = P; s.level = e.level; s.evolved = e.evolved;
      }
    });
  }
}

export function stepTreasures(g, dt) {
  const h = g.hero, m = g.mods, w = g.ward, Z = g.ziya ? BY.general.jiangziya.presence : null;
  if (g.t >= PAYOFF.fade[0] && g.t <= PAYOFF.fade[1] + 5 && Math.floor(g.t / 5) !== g.powerAt) { g.powerAt = Math.floor(g.t / 5); setPower(g); }   // the curve fades in (SPEC 2.8b)
  if (g.build.weapon) stepWeapon(g, dt);
  if (g.build.spoils && g.build.spoils.length) stepSpoils(g, dt);
  // 孔宣's five-coloured light (SPEC 1.11): the pearls of an element he has taken are put away until it returns
  for (const t of g.build.treasures) for (const e of t.merged ? t.parts : [t]) {
    if (BY.treasure[e.id].shape !== 'orbit') continue;
    const off = taken(g, e.id), has = g.shots.some(s => s.orbit && s.src === e.id && !s.dead);
    if (off && has) for (const s of g.shots) { if (s.orbit && s.src === e.id) s.dead = true; }
    else if (!off && !has) rebuildOrbits(g);
  }
  // the red face of the mirror: soldiers its ray passes mend
  for (const z of g.zones) {
    if (z.dead || z.kind !== 'beam' || z.src !== 'mirror' || !z.P || !z.P.mend) continue;
    for (const a of g.allies) if (a.kind !== 'general' && a.state !== 'dead' && a.hp < a.maxHp && inZone(z, a.x, a.y, a.r)) a.hp = Math.min(a.maxHp, a.hp + z.P.mend * dt);
  }
  for (const e of g.build.treasures) {
    if (!e.merged) { stepOne(g, e, dt, Z); continue; }
    // 合璧: each part on its own clock; when the first strikes, the second strikes with it
    const M = BY.merge[e.id];
    for (const p of e.parts) {
      if (!stepOne(g, p, dt, Z) || p.id !== M.chain[0]) continue;
      const q = e.parts.find(x => x.id === M.chain[1]);
      strike(g, q, withPresence(paramsOf(q), q.id, Z));
    }
  }
}
/** Is this treasure's element taken by 孔宣's light (A sets g.lightTaken[element] to the time it returns)? */
export const taken = (g, id) => !!g.lightTaken && (g.lightTaken[BY.treasure[id].element] || 0) > g.t;
/** The hero's own blows (treasures and weapon) on 吕岳's plague ground: weaker by `hero.weak`. */
export const heroMul = g => g.mods.dmg * (1 - (g.hero.weak || 0));
/** 姜子牙 is on the field: his whip strikes harder and one foe more. */
const withPresence = (P, id, Z) => Z && id === 'whip' ? {...P, dmg: P.dmg * (1 + Z.whip.up), count: P.count + Z.whip.count} : P;
/** One cast of a treasure from the hero, and 哪吒's echo of it. */
function strike(g, e, P) {
  if (taken(g, e.id)) return false;                       // 孔宣 has taken its element
  const done = cast(g, g.hero, P, e.id, e.level, e.evolved, heroMul(g), null, 0);
  // 哪吒 is with him: the same treasure strikes again from where 哪吒 stands (his echo is his own: not weakened by the hero's ground)
  if (done && g.echo && g.echo.state !== 'away' && BY.general.nezha.echoes.includes(e.id)) cast(g, g.echo, P, e.id, e.level, e.evolved, g.mods.dmg * GENERAL.echo, null, g.echo.id);
  return done;
}
/** One treasure (or one part of a pair) on its clock. Returns true when it struck (a ward: when it came back up). */
function stepOne(g, e, dt, Z) {
  const h = g.hero, m = g.mods, w = g.ward, P = withPresence(paramsOf(e), e.id, Z);
  if (P.shape === 'orbit') return false;
  if (P.shape === 'ward') {
    w.P = P; w.entry = e;
    if (!w.up && !taken(g, e.id)) {
      // 姜子牙 is on the field: his banner returns sooner
      w.t -= dt * m.rate / (Z && e.id === 'banner' ? 1 - Z.banner.sooner : 1);
      if (w.t <= 0) {
        w.up = true;
        w.zone = addZone(g, 'ward', 'zhou', e.id, h.x, h.y, P.radius * m.area, Infinity);
        w.zone.follow = true; w.zone.level = e.level; w.zone.evolved = e.evolved;
        if (P.pulse) wardBurst(g, false);
        return true;
      }
    } else if (w.zone) { w.zone.r = P.radius * m.area; w.zone.level = e.level; w.zone.evolved = e.evolved; }
    return false;
  }
  if (taken(g, e.id)) return false;                       // its clock stands while the light has its element
  e.cd -= dt * m.rate;
  if (e.cd > 0) return false;
  const done = strike(g, e, P);
  e.cd = done ? P.cd : .12;
  return done;
}

// ------------------------------------------------------------------------------------------- the hero's weapon
export const weaponParams = w => BY.weapon[w.id].at[w.evolved ? MAX.weapon + 1 : w.level];
/** The weapon strikes on its own clock, which 武艺 hurries (not the treasures' rate). */
export function stepWeapon(g, dt) {
  const w = g.build.weapon, m = g.mods;
  w.cd -= dt * (m.weaponRate || 1);
  if (w.cd > 0) return;
  const P = weaponParams(w), done = castWeapon(g, w, P, heroMul(g) * (m.weaponDmg || 1));
  w.cd = done ? P.cd : .12;
}
/** The last cast event of `id` is the weapon's: mark it so. */
const markWeapon = (g, id) => { for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'cast' && e.id === id) { e.weapon = true; return e; } } return null; };
export function castWeapon(g, w, P, mul) {
  const h = g.hero, area = g.mods.area, id = w.id, level = w.level, evolved = w.evolved;
  if (P.shape === 'thrust') {
    // along the way the horse is heading, whether or not a foe is there, so long as one is in reach
    const len = P.length * area, wd = P.width * area, t = nearestFoe(h.x, h.y, len);
    if (!t) return false;
    // the way the horse is heading when a foe is on that line; riding away from them, at the nearest
    const ahead = queryLane(h.x, h.y, h.head, len, wd, Qhit) > 0, d0 = ahead ? h.head : Math.atan2(t.y - h.y, t.x - h.x);
    for (let k = 0; k < P.count; k++) {
      const dir = d0 + (k - (P.count - 1) / 2) * P.fanAngle;
      doLine(g, h.x, h.y, dir, len, wd, P.dmg * mul, P, id, level, evolved, null, 0, false, true);
      if (P.tip) {
        const tx = h.x + Math.cos(dir) * len, ty = h.y + Math.sin(dir) * len, R = P.tip.radius * area, n = query(tx, ty, R, Qhit);
        g.events.push({type: 'land', id, level, evolved, x: tx, y: ty, radius: R, push: 0, weapon: true});
        for (let i = 0; i < n; i++) hitFoe(g, Qhit[i], P.dmg * P.tip.share * mul, id, null, tx, ty, null, false);
      }
    }
    return true;
  }
  if (P.shape === 'sweep') {
    let Q = {...P, shape: 'arc', range: 0};                // only what is within the sweep itself: never a far foe
    if (P.combo && (w.n = (w.n || 0) + 1) % P.combo.every === 0) Q = {...Q, dmg: P.dmg * P.combo.mult, radius: P.radius * P.combo.radiusUp, heavy: true};
    if (!cast(g, h, Q, id, level, evolved, mul, null, 0)) return false;
    const ev = markWeapon(g, id);
    if (Q.heavy) ev.heavy = true;
    if (P.twice) { cast(g, h, {...Q, radius: Q.radius * P.twice}, id, level, evolved, mul, null, 0); markWeapon(g, id); }
    if (P.double) {
      // the second whip behind: the nearest foe on the other side
      const back = {...Q, angle: Q.angle}, dir = ev.dir + Math.PI, R = Q.radius * area, n = query(h.x, h.y, R, Qhit), half = Math.cos(Q.angle * Math.PI / 360), c = Math.cos(dir), sn = Math.sin(dir);
      g.events.push({type: 'cast', id, level, evolved, shape: 'arc', x: h.x, y: h.y, dir, radius: R, angle: Q.angle, span: 0, by: 0, weapon: true});
      for (let i = 0; i < n; i++) { const f = Qhit[i], dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy) || 1; if ((dx * c + dy * sn) / d >= half) hitFoe(g, f, back.dmg * mul * (isNamed(f) ? P.namedMult : 1), id, back, h.x, h.y, null, false); }
    }
    if (w.evolved && P.great) ev.shock = greatShock(g, h.x, h.y, Q.radius * area);
    if (P.cleft) {
      // 开山: a cleft in the ground along the cut
      const C = P.cleft, z = addZone(g, 'crush', 'zhou', id, h.x, h.y, 0, C.life * g.mods.dur);
      z.shape = 'lane'; z.dir = ev.dir; z.len = P.radius * area * 1.6; z.w = C.width * area; z.dps = C.dps * mul; z.slow = C.slow; z.level = level; z.evolved = evolved;
    }
    return true;
  }
  // shoot: each arrow at a target of its own, the elites and named foes first, then the nearest; spare arrows fly beside
  // the first (parallel, not fanned: a fan would miss a lone far target, and the bow's reach would fall as it levelled)
  const range = P.range, n = query(h.x, h.y, range, Qpick), targets = [];
  for (let i = 0; i < n; i++) { const f = Qpick[i]; if (f.state !== 'dead') targets.push(f); }
  if (!targets.length) return false;
  const rank = f => (f.elite || isNamed(f) ? 0 : 1e9) + (f.x - h.x) * (f.x - h.x) + (f.y - h.y) * (f.y - h.y);
  targets.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const t0 = targets[0], d0 = Math.atan2(t0.y - h.y, t0.x - h.x), px = -Math.sin(d0), py = Math.cos(d0);
  g.events.push({type: 'cast', id, level, evolved, shape: 'throw', x: h.x, y: h.y, dir: d0, count: P.count, by: 0, weapon: true});
  for (let k = 0; k < P.count; k++) {
    let sx = h.x, sy = h.y, dir = d0;
    if (k < targets.length) dir = Math.atan2(targets[k].y - h.y, targets[k].x - h.x);
    else { const off = ((k - targets.length) % 2 ? 1 : -1) * (((k - targets.length) >> 1) + 1) * 12; sx += px * off; sy += py * off; }
    const s = addShot(g, id, 'zhou', id, sx, sy, Math.cos(dir) * P.speed, Math.sin(dir) * P.speed, P.r * area, P.dmg * mul, P.life);
    s.pierce = P.pierce; s.P = P; s.level = level; s.evolved = evolved;
  }
  return true;
}
