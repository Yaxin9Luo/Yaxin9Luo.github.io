// The squads: men, where they stand, their blows and their skills. Owner: rules·build (B).

import {TAU, KB, DEAD, clamp, setState, rand, query, queryLane, Qpick, Qhit, Qally, Qwade, nearestFoe, CL, clusters, allyPool} from './core.js';
import {hitFoe, hurtAlly, addShot, addZone} from './harm.js';
import {cast, greatShock} from './shapes.js';
import {stepGeneral} from './generals.js';
import {WORLD, HERO, CRY, ALLY, ALLY_CLEAR, MAX, ELEMENTS, TRIGRAMS, BY} from '../content.js';

/** Add one man to the squad of a troop the build owns, whatever its number. For tests and stills. */
export function addMan(g, id) {
  const e = g.build.troops.find(t => t.id === id);
  if (!e) throw new Error(`no squad ${id}`);
  return addAlly(g, e, BY.troop[id].at[e.level]);
}
export function addAlly(g, e, P) {
  const a = allyPool.pop() || {}, h = g.hero, ang = rand(g) * TAU, stand = BY.troop[e.id].stand;
  a.id = g.nextId++; a.kind = e.id; a.general = ''; a.level = e.level; a.trueForm = false; a.rank = e.rank;
  a.x = a.px = h.x + Math.cos(ang) * 30; a.y = a.py = h.y + Math.sin(ang) * 30;
  a.facing = h.facing; a.dir = h.dir; a.hp = a.maxHp = menHp(g, P); a.state = 'walk'; a.stateT = 0; a.flash = 0; a.elite = false;
  a.r = P.r; a.cd = rand(g) * P.cd; a.i = 0; a.j = 0; a.m = 1; a.wade = stand === 'wade'; a.free = stand === 'wade' || stand === 'orbit'; a.blocks = !!BY.troop[e.id].blocks;
  a.dead = false; a.seekT = 0; a.tx = a.x; a.ty = a.y; a.hasTarget = false; a.mvT = 0; a.mvD = 0; a.mx0 = 0; a.my0 = 0; a.mx1 = 0; a.my1 = 0;
  a.awayT = 0; a.storm = null; a.stormId = 0; a.flip = 0; a.netT = 0;
  g.allies.push(a);
  g.slotsDirty = true;
  return a;
}
/** A soldier's health: his row's, and 练兵's share. */
export const menHp = (g, P) => Math.round(P.hp * (g.mods.troopHp || 1));
/** Bring every squad to its row: the men's health and rank, and (when `fill`) its full number at once. */
export function syncSquads(g, fill) {
  for (const e of g.build.troops) {
    const P = BY.troop[e.id].at[e.level];
    let n = 0;
    for (const a of g.allies) {
      if (a.kind !== e.id || a.state === 'dead') continue;
      n++;
      a.rank = e.rank; a.level = e.level;
      const hp = menHp(g, P);
      if (a.maxHp !== hp) { a.hp += hp - a.maxHp; a.maxHp = hp; }
    }
    if (fill) for (; n < P.men; n++) addAlly(g, e, P);
  }
}
export function assignSlots(g) {
  let i = 0;
  for (const e of g.build.troops) {
    let m = 0;
    for (const a of g.allies) if (a.kind === e.id && a.state !== 'dead') m++;
    let j = 0;
    for (const a of g.allies) {
      if (a.kind !== e.id || a.state === 'dead') continue;
      a.j = j++; a.m = m;
      if (!a.free) a.i = i++;
    }
  }
  g.standN = i; g.slotsDirty = false;
}

export function slotOf(g, a, out) {
  const h = g.hero, F = g.form, n = g.standN;
  let x = 0, y = 0;
  const stand = BY.troop[a.kind].stand, mid = (a.m - 1) / 2;
  if (stand === 'orbit') {
    // chariots circle the hero wide, whatever the formation
    const P = BY.troop[a.kind].at[1], ang = g.t * P.turn + a.j * TAU / a.m;
    x = Math.cos(ang) * P.orbit; y = Math.sin(ang) * P.orbit;
  } else if (!F || stand === 'wade') {
    // its own station (SPEC 2.2b): a block of rows and files in a sector of its own, outside the clear ring
    const St = BY.troop[a.kind].station, split = St.split ? (a.j & 1 ? 1 : -1) : 0, j = St.split ? a.j >> 1 : a.j, m = St.split ? (a.m + 1) >> 1 : a.m;
    const cols = Math.min(St.perRow, m), row = Math.floor(j / St.perRow), col = j % St.perRow - (Math.min(St.perRow, m - row * St.perRow) - 1) / 2;
    const ang = g.massA + (split || 1) * St.angle, c = Math.cos(ang), s = Math.sin(ang), along = St.r0 + row * 26, across = col * 24 * (cols > 0 ? 1 : 0);
    x = c * along - s * across; y = s * along + c * across;
  } else if (F.layout === 'snake') {
    // one file along the way he came, a man every `gap` px, from outside the clear ring
    const skip = Math.ceil(ALLY_CLEAR / F.gap), t = g.trail, k = t ? t.length - 2 - skip - a.i : -1;
    if (k >= 0) { out.x = t[k].x; out.y = t[k].y; return; }
    const d = F.gap * (a.i + 1 + skip);
    x = -Math.cos(h.head) * d; y = -Math.sin(h.head) * d;
  } else if (F.layout === 'dragons') {
    // two columns out ahead, left and right, opening forward
    const side = a.i & 1 ? 1 : -1, d = F.from + (a.i >> 1) * F.step, ang = h.head + side * F.spread;
    x = Math.cos(ang) * d; y = Math.sin(ang) * d;
  } else if (F.layout === 'gates') {
    // a square with a gate in the middle of each side
    const S = F.side + 2 * n, u = (a.i + .5) / n * 4, k = Math.floor(u) % 4, f = u - Math.floor(u);
    const p = f < .5 ? -S + f / .5 * .6 * S : S - (1 - f) / .5 * .6 * S;
    if (k === 0) { x = p; y = -S; } else if (k === 1) { x = S; y = p; } else if (k === 2) { x = -p; y = S; } else { x = -S; y = -p; }
  } else if (F.guard) {
    const ang = a.i * TAU / n, R = F.radius + n;
    x = Math.cos(ang) * R; y = Math.sin(ang) * R;
  } else if (F.tip) {
    // a wedge ahead, its tip far out; where its arms would come within the clear ring they spread wider instead
    const arm = (a.i + 1) >> 1, side = a.i & 1 ? 1 : -1, raw = F.tip - arm * F.step, along = Math.max(ALLY_CLEAR + 12, raw), across = side * (arm * F.spread + (along - raw) * .9);
    const c = Math.cos(h.head), s = Math.sin(h.head);
    x = c * along - s * across; y = s * along + c * across;
  } else {
    const ang = g.t * F.spin + (a.i % 8) * TAU / 8, R = F.radius + 34 * (a.i >> 3);
    x = Math.cos(ang) * R; y = Math.sin(ang) * R;
  }
  out.x = h.x + x; out.y = h.y + y;
}
export const SLOT = {x: 0, y: 0}, MEN = [];

/** A blow along a lane with no event of its own (the caller reports it). */
export function lineHit(g, x, y, dir, len, w, dmg, src, P, el) {
  const n = queryLane(x, y, dir, len, w, Qhit);
  for (let i = 0; i < n; i++) hitFoe(g, Qhit[i], dmg, src, P, x, y, el, false);
  return n;
}
/** Send a unit through the air or down a lane: for `time` it is carried to (x, y) and does nothing else. */
export function carry(a, x, y, time) {
  a.mx0 = a.x; a.my0 = a.y; a.mx1 = clamp(x, WORLD.edge, WORLD.w - WORLD.edge); a.my1 = clamp(y, WORLD.edge, WORLD.h - WORLD.edge);
  a.mvT = a.mvD = time; setState(a, 'skill'); a.stateT = 0;
}
/**
 * Is a zone we hold still the one we made? Zones are pooled: a dead one is reused by the next `addZone`, so a
 * reference must be checked by its id (unique for the run) and kind before use.
 */
export const held = (z, id, kind) => !!z && z.id === id && z.kind === kind && !z.dead;
export const underStandard = (g, a) => { const z = g.standard; return !!z && (a.x - z.x) * (a.x - z.x) + (a.y - z.y) * (a.y - z.y) <= z.r * z.r; };
export const inAura = (g, a) => g.aura && (a.x - g.aura.x) * (a.x - g.aura.x) + (a.y - g.aura.y) * (a.y - g.aura.y) <= g.aura.radius * g.aura.radius;

/** One spell of the acolytes, of an element, on a place. Returns the event's measures. */
export function talisman(g, e, S, el, x, y, cx, cy, mul, rider) {
  const area = g.mods.area, dur = g.mods.dur, R = S.radius * area, id = e.id;
  if (el === 'fire') {
    const z = addZone(g, 'burn', 'zhou', id, x, y, R, S.life * dur);
    z.dps = S.dmg * mul * .8;
    return {shape: 'drop', targets: [{x, y}], radius: R, delay: 0, life: S.life * dur};
  }
  if (el === 'water') {
    const n = query(x, y, R, Qhit);
    for (let i = 0; i < n; i++) { const f = Qhit[i]; hitFoe(g, f, S.dmg * mul, id, null, x, y, rider, false); if (f.state !== 'dead') { f.stun = Math.max(f.stun, 1.6 * dur * (f.heavy ? .25 : 1)); f.slow = Math.max(f.slow, .5); f.slowT = 3 * dur; } }
    addZone(g, 'frost', 'zhou', id, x, y, R, 1.6 * dur);
    return {shape: 'frost', radius: R, hold: 1.6 * dur};
  }
  if (el === 'wood') {
    const d0 = Math.atan2(y - cy, x - cx), len = 340 * area, lines = [];
    for (let k = -1; k <= 1; k++) {
      const dir = d0 + k * .28, n = queryLane(cx, cy, dir, len, 30, Qhit);
      for (let i = 0; i < n; i++) { const f = Qhit[i]; hitFoe(g, f, S.dmg * mul * .7, id, null, cx, cy, rider, false); if (f.state !== 'dead') f.stun = Math.max(f.stun, 2 * dur * (f.heavy ? .25 : 1)); }
      const z = addZone(g, 'bind', 'zhou', id, cx, cy, 0, 2 * dur);
      z.shape = 'lane'; z.dir = dir; z.len = len; z.w = 30;
      lines.push({x: cx, y: cy, dir, length: len, width: 30});
    }
    return {shape: 'bind', lines, hold: 2 * dur};
  }
  if (el === 'metal') {
    const d0 = Math.atan2(y - cy, x - cx);
    for (let k = 0; k < 4; k++) {
      const dir = d0 + (k - 1.5) * .2, s = addShot(g, 'blade', 'zhou', id, cx, cy, Math.cos(dir) * 560, Math.sin(dir) * 560, 10, S.dmg * mul, 2.2);
      s.bounces = 3; s.hop = 230; s.el = rider;
    }
    return {shape: 'throw', count: 4};
  }
  // earth: a wall across the way the foes come, a little out from the hero
  const h = g.hero, d0 = Math.atan2(y - h.y, x - h.x), wx = h.x + Math.cos(d0) * 120, wy = h.y + Math.sin(d0) * 120, len = 260 * area;
  const z = addZone(g, 'wall', 'zhou', id, wx - Math.cos(d0 + Math.PI / 2) * len / 2, wy - Math.sin(d0 + Math.PI / 2) * len / 2, 0, S.life * dur);
  z.shape = 'lane'; z.dir = d0 + Math.PI / 2; z.len = len; z.w = 36; z.dps = S.dmg * mul * .4;
  return {shape: 'wall', lines: [{x: z.x, y: z.y, dir: z.dir, length: len, width: 36}], life: S.life * dur};
}

/**
 * A squad's skill (section 6.1): fires by itself on its cooldown from rank 2, and is one `squadSkill` event with a
 * shape. Returns false, and does nothing, when there is nobody to use it on.
 */
export function squadSkill(g, e, mul) {
  const row = BY.troop[e.id], S = row.skillAt[e.rank], h = g.hero, area = g.mods.area, dur = g.mods.dur;
  let m = 0, cx = 0, cy = 0;
  for (const a of g.allies) if (a.kind === e.id && a.state !== 'dead' && a.mvT <= 0) { MEN[m++] = a; cx += a.x; cy += a.y; }
  if (!m) return false;
  cx /= m; cy /= m;
  const rider = e.rank >= 4 ? row.element : null;          // from rank 4 the skill carries the squad's element
  const ev = {type: 'squadSkill', troop: e.id, rank: e.rank, id: S.id, blessed: e.rank === 5, shape: S.shape, element: row.element, x: cx, y: cy, dir: g.massA, by: []};
  for (let i = 0; i < m; i++) ev.by.push(MEN[i].id);
  switch (S.shape) {
    case 'arc': {
      const R = S.radius * area, full = S.angle >= 360, ox = full ? h.x : cx, oy = full ? h.y : cy;
      const t = nearestFoe(ox, oy, R);
      if (!t) return false;
      const dir = full ? g.massA : Math.atan2(t.y - oy, t.x - ox), half = Math.cos(S.angle * Math.PI / 360), c = Math.cos(dir), s = Math.sin(dir);
      const n = query(ox, oy, R, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - ox, dy = f.y - oy, d = Math.hypot(dx, dy);
        if (full || d <= f.r || (dx * c + dy * s) / d >= half) hitFoe(g, f, S.dmg * mul, e.id, S, ox, oy, rider, false);
      }
      ev.x = ox; ev.y = oy; ev.dir = dir; ev.radius = R; ev.angle = S.angle;
      break;
    }
    case 'lines': {
      const len = S.length * area, w = S.width * area;
      if (!query(h.x, h.y, len + 120, Qpick)) return false;
      ev.lines = [];
      for (let i = 0; i < m; i++) {
        const a = MEN[i], out = Math.atan2(a.y - h.y, a.x - h.x);
        for (let k = 0; k < S.fan; k++) {
          const dir = out + (S.fan === 1 ? 0 : (k - (S.fan - 1) / 2) * S.fanAngle);
          lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, S, rider);
          ev.lines.push({x: a.x, y: a.y, dir, length: len, width: w});
        }
        setState(a, 'skill'); a.stateT = 0;
      }
      break;
    }
    case 'drop': {
      const n = clusters(g, h.x, h.y, S.range, S.count);
      if (!n) return false;
      ev.targets = []; ev.radius = S.radius * area; ev.delay = S.delay;
      for (let i = 0; i < n; i++) {
        const z = addZone(g, S.zone || 'fall', 'zhou', e.id, CL[i].x, CL[i].y, S.radius * area, S.delay);
        z.P = S; z.level = e.level; z.mul = mul; z.el = rider;
        ev.targets.push({x: CL[i].x, y: CL[i].y});
      }
      ev.dir = Math.atan2(ev.targets[0].y - cy, ev.targets[0].x - cx);
      break;
    }
    case 'throw': {
      if (!clusters(g, h.x, h.y, S.range, 1)) return false;
      const tx = CL[0].x, ty = CL[0].y;
      ev.count = m; ev.dir = Math.atan2(ty - cy, tx - cx);
      for (let i = 0; i < m; i++) {
        const a = MEN[i], dir = Math.atan2(ty - a.y, tx - a.x), s = addShot(g, S.shotKind, 'zhou', e.id, a.x, a.y, Math.cos(dir) * S.speed, Math.sin(dir) * S.speed, S.shotR * area, S.dmg * mul, S.life);
        s.pierce = S.pierce; s.hitP = S; s.el = rider; s.burst = S.burst || null; s.mul = mul;
        setState(a, 'skill'); a.stateT = 0;
      }
      break;
    }
    case 'charge': {
      const len = S.length * area, w = S.width * area;
      ev.lanes = []; ev.time = S.time;
      // every chariot charges: the densest groups in reach of the circle they ride round the hero, one each (the
      // nearest to him still free; all at one when there is one group). Before, each looked only within its own
      // lane's length, and a chariot on the far side of the circle found nothing and stayed.
      const k = clusters(g, h.x, h.y, len + (row.base.orbit || 0), m);
      if (!k) return false;
      let used = 0;
      for (let i = 0; i < m; i++) {
        const a = MEN[i];
        let best = -1, bd = Infinity;
        for (let c = 0; c < k; c++) {
          if (used & (1 << c) && used !== (1 << k) - 1) continue;
          const d = (CL[c].x - a.x) * (CL[c].x - a.x) + (CL[c].y - a.y) * (CL[c].y - a.y);
          if (d < bd) { bd = d; best = c; }
        }
        used |= 1 << best;
        const dir = Math.atan2(CL[best].y - a.y, CL[best].x - a.x);
        lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, S, rider);
        if (S.back) lineHit(g, a.x + Math.cos(dir) * len, a.y + Math.sin(dir) * len, dir + Math.PI, len, w, S.dmg * mul * .6, e.id, S, rider);
        ev.lanes.push({x: a.x, y: a.y, dir, length: len, width: w, back: !!S.back});
        carry(a, a.x + Math.cos(dir) * len * (S.back ? .15 : 1), a.y + Math.sin(dir) * len * (S.back ? .15 : 1), S.time);
      }
      if (!ev.lanes.length) return false;
      ev.dir = ev.lanes[0].dir;
      break;
    }
    case 'leap': {
      // onto an elite if one is near, otherwise onto the thickest groups
      let elite = null;
      for (let i = 0, c = query(h.x, h.y, S.range, Qpick); i < c && !elite; i++) if (Qpick[i].elite) elite = Qpick[i];
      let n = clusters(g, h.x, h.y, S.range, Math.min(S.count, m));
      if (elite) { if (!n) n = 1; CL[0].x = elite.x; CL[0].y = elite.y; }
      if (!n) return false;
      ev.targets = []; ev.radius = S.radius * area; ev.time = S.time;
      for (let i = 0; i < n; i++) {
        const z = addZone(g, 'fall', 'zhou', e.id, CL[i].x, CL[i].y, S.radius * area, S.time);
        z.P = S; z.level = e.level; z.mul = mul; z.el = rider;
        ev.targets.push({x: CL[i].x, y: CL[i].y});
      }
      for (let i = 0; i < m; i++) { const t = ev.targets[i % n], ang = i * 2.4; carry(MEN[i], t.x + Math.cos(ang) * 26, t.y + Math.sin(ang) * 26, S.time); }
      ev.dir = Math.atan2(ev.targets[0].y - cy, ev.targets[0].x - cx);
      break;
    }
    case 'pull': {
      if (!clusters(g, cx, cy, S.range, 1)) return false;
      const px = CL[0].x, py = CL[0].y, R = S.radius * area, hold = S.hold * dur, n = query(px, py, R, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i];
        hitFoe(g, f, S.dmg * mul, e.id, null, px, py, rider, false);
        if (f.state === 'dead') continue;
        if (!f.heavy) { f.kx = (px - f.x) * .85 * KB; f.ky = (py - f.y) * .85 * KB; }
        f.stun = Math.max(f.stun, hold * (f.heavy ? .25 : 1));
      }
      addZone(g, 'hold', 'zhou', e.id, px, py, R, hold);
      ev.x = px; ev.y = py; ev.radius = R; ev.hold = hold; ev.dir = Math.atan2(py - cy, px - cx);
      break;
    }
    case 'standard': {
      // 中军帅旗: every squad gets back every man it has lost; foes near the standard are thrown back; soldiers under it mend
      const R = S.radius * area, life = S.life * dur;
      let mustered = 0;
      for (const t of g.build.troops) {
        const Q = BY.troop[t.id].at[t.level];
        let men = 0;
        for (const a of g.allies) if (a.kind === t.id && a.state !== 'dead') men++;
        for (; men < Q.men; men++, mustered++) { addAlly(g, t, Q); g.events.push({type: 'muster', kind: t.id, x: h.x, y: h.y}); }
        t.musterT = 0;
      }
      const n = query(h.x, h.y, R, Qhit);
      for (let i = 0; i < n; i++) hitFoe(g, Qhit[i], S.dmg * mul, e.id, S, h.x, h.y, rider, false);
      if (held(g.standard, g.standardId, 'standard')) g.standard.dead = true;
      const z = addZone(g, 'standard', 'zhou', e.id, h.x, h.y, R, life);
      z.follow = !!S.follow; z.P = S; z.level = e.level;
      g.standard = z; g.standardId = z.id;
      ev.x = h.x; ev.y = h.y; ev.radius = R; ev.life = life; ev.mustered = mustered; ev.follow = !!S.follow;
      if (!n && !mustered) { z.dead = true; g.standard = null; return false; }
      break;
    }
    case 'talisman': {
      const els = S.all ? Object.keys(ELEMENTS) : [g.mainEl], n = clusters(g, h.x, h.y, S.range, els.length);
      if (!n) return false;
      const spots = [];
      for (let i = 0; i < els.length; i++) spots.push({x: CL[i % n].x, y: CL[i % n].y});
      for (let i = 0; i < els.length; i++) {
        const more = talisman(g, e, S, els[i], spots[i].x, spots[i].y, cx, cy, mul, rider);
        const one = {...ev, ...more, by: ev.by, element: els[i], x: spots[i].x, y: spots[i].y, dir: Math.atan2(spots[i].y - cy, spots[i].x - cx), fromX: cx, fromY: cy};
        if (e.rank === 5) one.shock = greatShock(g, one.x, one.y, one.radius || 140);   // a blessed host's skill is a great strike
        g.events.push(one);
      }
      for (let i = 0; i < m; i++) { setState(MEN[i], 'skill'); MEN[i].stateT = 0; }
      return true;
    }
    default: return false;
  }
  if (e.rank === 5) ev.shock = greatShock(g, ev.lanes ? ev.lanes[0].x + Math.cos(ev.dir) * ev.lanes[0].length / 2 : ev.targets ? ev.targets[0].x : ev.x, ev.lanes ? ev.lanes[0].y + Math.sin(ev.dir) * ev.lanes[0].length / 2 : ev.targets ? ev.targets[0].y : ev.y, ev.radius || (ev.lanes && ev.lanes[0].width * 2) || 160);   // a blessed host's skill is a great strike (神兵)
  g.events.push(ev);
  return true;
}

export function stepAllies(g, dt) {
  const h = g.hero, m = g.mods;
  if (g.slotsDirty) assignSlots(g);
  // 黄飞虎's presence, 哪吒's, 姜子牙's and 土行孙's, for this step
  g.aura = null; g.echo = null; g.ziya = null; g.tuxing = null;
  for (const a of g.allies) {
    if (a.kind !== 'general' || a.state === 'away' || a.state === 'dead') continue;
    const row = BY.general[a.general], P = row.at[a.trueForm ? MAX.general + 1 : a.level], AU = (P.form && P.form.aura) || P.aura;
    if (AU) g.aura = {x: a.x, y: a.y, radius: AU.radius, dmg: AU.dmg, guard: AU.guard};
    if (row.echoes) g.echo = a;
    if (row.presence) g.ziya = a;
    if (row.ropeUp) g.tuxing = a;
  }
  // 姜子牙 on the field: the formation takes its commanded numbers
  const fb = g.build.formation;
  if (fb) { const R = BY.formation[fb.id]; g.form = g.ziya && R.commanded ? R.commanded[fb.level] : R.at[fb.level]; }
  const F = g.form, mul0 = m.dmg * (F && F.moving && h.moving ? 1 + F.moving : 1) * (F && F.cross ? 1 + F.cross : 1);
  if (F && F.layout) stepFormation(g, F, dt);
  // 牙门将 stand: the others muster faster; the standard mends those under it (and, blessed, they strike harder)
  let rally = 1;
  for (const a of g.allies) if (a.kind === 'yamen' && a.state !== 'dead') { rally = BY.troop.yamen.base.rally; break; }
  const st = held(g.standard, g.standardId, 'standard') && g.standard.t < g.standard.life ? g.standard : null;
  if (!st) g.standard = null;
  else for (const a of g.allies) if (a.kind !== 'general' && a.state !== 'dead' && underStandard(g, a)) a.hp = Math.min(a.maxHp, a.hp + st.P.mend * dt);
  // squads: men come back, the squad skills, and the volleys of those that act together
  for (const e of g.build.troops) {
    const P = BY.troop[e.id].at[e.level];
    let men = 0, near = false;
    for (const a of g.allies) if (a.kind === e.id && a.state !== 'dead') { men++; if (!near && inAura(g, a)) near = true; }
    const mul = mul0 * (near ? 1 + g.aura.dmg : 1);
    if (men < P.men) {
      e.musterT += dt * (e.id === 'yamen' ? 1 : rally) * (m.muster || 1);
      if (e.musterT >= P.muster) { e.musterT = 0; addAlly(g, e, P); g.events.push({type: 'muster', kind: e.id, x: h.x, y: h.y}); }
    } else e.musterT = 0;
    if (e.rank >= 2) {
      e.skillCd -= dt;
      if (e.skillCd <= 0) e.skillCd = squadSkill(g, e, mul) ? BY.troop[e.id].skillAt[e.rank].cd : .5;
    }
    if (P.per !== 'squad') continue;
    e.cd -= dt;
    if (e.cd > 0) continue;
    e.cd = .2;
    for (const a of g.allies) {
      if (a.kind !== e.id || a.state === 'dead' || a.mvT > 0) continue;
      if (cast(g, a, P, e.id, e.level, false, mul, F && F.rider ? elementAt(g, a) : null, a.id)) { e.cd = P.cd; setState(a, 'attack'); a.stateT = 0; }
      else break;
    }
  }
  const speed = HERO.speed * m.speed * CRY.speed * ALLY.speed;
  for (let i = 0; i < g.allies.length; i++) {
    const a = g.allies[i];
    a.px = a.x; a.py = a.y; a.stateT += dt;
    if (a.flash > 0) a.flash -= dt;
    if (a.state === 'dead') { if (a.stateT >= DEAD) a.dead = true; continue; }
    if (a.kind === 'general') { stepGeneral(g, a, dt); continue; }
    const e = g.build.troops.find(t => t.id === a.kind);
    if (!e) { a.dead = true; continue; }
    if (a.mvT > 0) {
      // in the air, or down the lane of a charge
      a.mvT -= dt;
      const k = 1 - Math.max(0, a.mvT) / a.mvD;
      a.x = a.mx0 + (a.mx1 - a.mx0) * k; a.y = a.my0 + (a.my1 - a.my0) * k;
      continue;
    }
    const P = BY.troop[e.id].at[e.level];
    // where he should be
    slotOf(g, a, SLOT);
    let tx = SLOT.x, ty = SLOT.y, stop = 2;
    if (P.leash) {
      // a man leaves his place to reach a foe near it (one who wades: near the hero), and no further
      a.seekT -= dt;
      if (a.seekT <= 0) {
        a.seekT = .3;
        const n = a.wade ? query(h.x, h.y, P.leash, Qwade) : query(tx, ty, P.leash, Qwade);
        let best = null, bd = Infinity;
        for (let k = 0; k < n; k++) { const f = Qwade[k], d = (f.x - a.x) * (f.x - a.x) + (f.y - a.y) * (f.y - a.y); if (d < bd) { bd = d; best = f; } }
        a.hasTarget = !!best;
        if (best) { a.tx = best.x; a.ty = best.y; }
      }
      if (a.hasTarget) { tx = a.tx; ty = a.ty; stop = P.shape === 'line' ? P.length * .7 : P.radius * .5; }
    }
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    if (d > 900) { a.x = tx; a.y = ty; }
    else if (d > stop) {
      const v = Math.min(d - stop, speed * dt);
      a.x += dx / d * v; a.y += dy / d * v; a.dir = Math.atan2(dy, dx);
      if (Math.abs(dx) > 4) a.facing = dx > 0 ? 1 : -1;
      if ((a.state !== 'attack' && a.state !== 'skill') || a.stateT > .25) setState(a, 'walk');
    } else if ((a.state !== 'attack' && a.state !== 'skill') || a.stateT > .25) setState(a, 'idle');
    if (!a.hasTarget) {
      // the clear ring round the hero (SPEC 2.2b): one with nobody to fight who is inside it walks out
      const ox = a.x - h.x, oy = a.y - h.y, od = Math.hypot(ox, oy);
      if (od < ALLY_CLEAR) { const k = Math.min(ALLY_CLEAR - od, speed * .6 * dt), ux = od > 1e-6 ? ox / od : Math.cos(g.massA), uy = od > 1e-6 ? oy / od : Math.sin(g.massA); a.x += ux * k; a.y += uy * k; }
    }
    // bodies: foes cannot walk through him, and those who touch him strike him
    const n = query(a.x, a.y, a.r + 2, Qally);
    for (let k = 0; k < n; k++) {
      const f = Qally[k];
      if (f.state === 'dead') continue;
      const fx = f.x - a.x, fy = f.y - a.y, fd = Math.hypot(fx, fy) || 1, over = a.r + f.r - fd;
      if (over > 0 && !f.heavy) { f.x += fx / fd * over * .5; f.y += fy / fd * over * .5; }
      if (F && F.snakeHold && g.t - (g.snakeAt.get(f.id) ?? -9) >= 1) { g.snakeAt.set(f.id, g.t); f.stun = Math.max(f.stun, F.snakeHold * g.mods.dur * (f.heavy ? .25 : 1)); }   // the snake holds what it touches
      if (f.hitCd <= 0 && f.stun <= 0) { f.hitCd = 1; hurtAlly(g, a, f.act === 'charge' ? f.cdmg : f.dmg * ALLY.hurt, f.kind); }
    }
    if (a.state === 'dead' || P.per !== 'man') continue;
    a.cd -= dt;
    if (a.cd <= 0) {
      if (cast(g, a, P, e.id, e.level, false, mul0 * (inAura(g, a) ? 1 + g.aura.dmg : 1) * (st && st.P.up && underStandard(g, a) ? 1 + st.P.up : 1) * (F && F.file ? 1 + F.file : 1), F && F.rider ? elementAt(g, a) : null, a.id)) { a.cd = P.cd; setState(a, 'attack'); a.stateT = 0; }
      else a.cd = .15;
    }
  }
}
/** What the three formations of 子牙's tokens do each step: the snake's track, the dragons' cone, the four gates. */
export function stepFormation(g, F, dt) {
  const h = g.hero;
  if (F.layout === 'snake') {
    if (!g.snakeAt) g.snakeAt = new Map();          // by foe id: a pooled foe keeps nothing of another's
    if (g.snakeAt.size > 2000) g.snakeAt.clear();
    const t = g.trail || (g.trail = []), last = t[t.length - 1];
    if (!last || Math.hypot(h.x - last.x, h.y - last.y) >= F.gap) { t.push({x: h.x, y: h.y}); if (t.length > 96) t.shift(); g.slotsDirty = true; }
    return;
  }
  if (F.layout === 'dragons') {
    const c = Math.cos(h.head), s = Math.sin(h.head), half = Math.cos(F.spread), n = query(h.x, h.y, F.reach, Qpick);
    for (let i = 0; i < n; i++) {
      const f = Qpick[i], dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy) || 1;
      if ((dx * c + dy * s) / d >= half) { f.slow = Math.max(f.slow, F.coneSlow); f.slowT = Math.max(f.slowT, .1); }
    }
    return;
  }
  // gates: a square of half-side S round the hero
  const S = F.side + 2 * g.standN, n = query(h.x, h.y, S * 1.42, Qpick);
  g.gatesT = (g.gatesT || 0) + dt;
  const close = g.gatesT >= F.close;
  if (close) g.gatesT = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const f = Qpick[i];
    if (f.state === 'dead' || Math.abs(f.x - h.x) > S || Math.abs(f.y - h.y) > S) continue;
    f.slow = Math.max(f.slow, F.trap); f.slowT = Math.max(f.slowT, .1);
    if (close) { f.stun = Math.max(f.stun, F.closeStun * g.mods.dur * (f.heavy ? .25 : 1)); count++; }
  }
  if (close && count) g.events.push({type: 'gates', x: h.x, y: h.y, radius: S, count});
}
/** The element of the place a soldier stands on in the eight trigrams. */
export function elementAt(g, a) {
  const ang = Math.atan2(a.y - g.hero.y, a.x - g.hero.x);
  return TRIGRAMS[((Math.round(ang / (TAU / 8)) % 8) + 8) % 8].element;
}
