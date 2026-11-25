// The generals on the field: whom each goes for, his blows and his skill. Owner: rules·build (B).

import {setState, query, Qpick, Qhit, Qally, PICKED, nearestFoe, CL, clusters, allyPool} from './core.js';
import {hitFoe, hurtAlly, addShot, addZone, kill} from './harm.js';
import {greatShock, take} from './shapes.js';
import {cast} from './shapes.js';
import {lineHit, carry, held} from './squads.js';
import {ALLY, MAX, GENERAL, BY} from '../content.js';

export function addGeneral(g, e) {
  const row = BY.general[e.id], P = row.at[e.trueForm ? MAX.general + 1 : e.level], a = allyPool.pop() || {}, h = g.hero;
  a.id = g.nextId++; a.kind = 'general'; a.general = e.id; a.level = e.level; a.trueForm = e.trueForm; a.rank = 0;   // every field in the order a soldier's are set: a unit taken from the pool reads the same as a new one
  a.x = a.px = h.x + 40; a.y = a.py = h.y - 30; a.facing = h.facing; a.dir = h.dir;
  a.hp = a.maxHp = Math.round(P.hp * P.hpGrow); a.state = 'walk'; a.stateT = 0; a.flash = 0; a.elite = false;
  a.r = row.r; a.cd = .5; a.i = 0; a.j = 0; a.m = 1; a.wade = false; a.free = true; a.blocks = false;
  a.dead = false; a.seekT = 0; a.tx = a.x; a.ty = a.y; a.hasTarget = false; a.mvT = 0; a.mvD = 0; a.mx0 = 0; a.my0 = 0; a.mx1 = 0; a.my1 = 0;
  a.awayT = 0; a.storm = null; a.stormId = 0; a.flip = 0; a.netT = 0;
  g.allies.push(a);
  return a;
}
/** Bring every general on the field to his row, and put those newly taken there. */
export function syncGenerals(g) {
  for (const e of g.build.generals) {
    const row = BY.general[e.id], P = row.at[e.trueForm ? MAX.general + 1 : e.level];
    let a = g.allies.find(x => x.kind === 'general' && x.general === e.id);
    if (!a) a = addGeneral(g, e);
    const hp = Math.round(P.hp * P.hpGrow);
    if (a.maxHp !== hp) { if (a.state !== 'away') a.hp += hp - a.maxHp; a.maxHp = hp; }
    a.level = e.level; a.trueForm = e.trueForm;
  }
}
/** Foes of his kind of quarry within `range` of the hero, nearest to (x, y) first, up to `count`, into PICKED. */
export function quarry(g, x, y, range, count, want) {
  const h = g.hero, n = query(h.x, h.y, range, Qpick);
  let m = 0;
  for (let pass = 0; pass < 2 && m < count; pass++) {
    for (;;) {
      let best = null, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const f = Qpick[i];
        if (f.state === 'dead' || f.mark === -1 || (pass === 0) !== want(f)) continue;
        const d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y);
        if (d < bd) { bd = d; best = f; }
      }
      if (!best || m >= count) break;
      best.mark = -1; PICKED[m++] = best;
    }
  }
  for (let i = 0; i < m; i++) PICKED[i].mark = 0;
  return m;
}
export const isNamed = f => !!(BY.foe[f.kind].named || BY.foe[f.kind].boss), isCommon = f => !f.elite && !isNamed(f);
export const isElite = f => f.elite, isShooter = f => { const ai = BY.foe[f.kind].ai; return ai === 'shoot' || ai === 'aura'; }, isWinding = f => f.state === 'windup' || f.act === 'aim' || f.act === 'slam';

export function generalSkill(g, a, e, row, P, mul) {
  const S = P.skill, F = P.form || null, h = g.hero, area = g.mods.area, dur = g.mods.dur;
  const ev = {type: 'generalSkill', general: e.id, level: e.level, trueForm: e.trueForm, id: S.id, shape: S.shape, element: row.element, x: a.x, y: a.y, dir: a.dir, by: a.id};
  switch (S.shape) {
    case 'arc': {                                           // 哪吒: the sash sweeps and the ring is thrown
      const R = S.radius * area * (F ? F.radiusUp : 1), t = nearestFoe(a.x, a.y, R);
      if (!t) return false;
      const dir = Math.atan2(t.y - a.y, t.x - a.x), angle = F && F.full ? 360 : S.angle, half = Math.cos(angle * Math.PI / 360), c = Math.cos(dir), s = Math.sin(dir);
      const n = query(a.x, a.y, R, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy);
        if (angle >= 360 || d <= f.r || (dx * c + dy * s) / d >= half) hitFoe(g, f, S.dmg * mul, e.id, S, a.x, a.y, null, false);
      }
      const r = S.ring, shot = addShot(g, 'ring', 'zhou', e.id, a.x, a.y, c * r.speed, s * r.speed, r.r, r.dmg * mul, r.life);
      shot.bounces = r.bounces; shot.hop = r.hop;
      ev.dir = dir; ev.radius = R; ev.angle = angle; ev.ring = true;
      break;
    }
    case 'hound': {                                         // 杨戬: the hound runs down those who shoot and curse
      const n = quarry(g, a.x, a.y, S.range, S.count, isShooter);
      if (!n) return false;
      ev.targets = [];
      for (let i = 0; i < n; i++) { const f = PICKED[i]; ev.targets.push({x: f.x, y: f.y, id: f.id}); }
      const A = row.attack;
      for (let i = 0; i < n; i++) hitFoe(g, PICKED[i], S.dmg * mul * (isShooter(PICKED[i]) ? 2 : 1) * (A.bane && A.bane.includes(PICKED[i].kind) ? A.baneMult : 1), e.id, null, a.x, a.y, null, false);
      ev.count = n;
      break;
    }
    case 'line': {                                          // 雷震子: a dive along a line through the thickest of them
      if (!clusters(g, a.x, a.y, 440, 1)) return false;
      const dir = Math.atan2(CL[0].y - a.y, CL[0].x - a.x), len = S.length * area, w = S.width * area;
      lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, S, null);
      ev.dir = dir; ev.length = len; ev.width = w; ev.time = .35;
      const ex = a.x + Math.cos(dir) * len, ey = a.y + Math.sin(dir) * len;
      if (S.smash) {
        // 一棍打下山尖 (22): where the dive ends the staff brings down a mountain-top
        const M = S.smash, R = M.radius * area, k = query(ex, ey, R, Qhit);
        for (let i = 0; i < k; i++) { const f = Qhit[i]; hitFoe(g, f, M.dmg * mul, e.id, null, ex, ey, null, false); if (f.state !== 'dead') f.stun = Math.max(f.stun, M.stun * dur * (f.heavy ? .25 : 1)); }
        ev.smash = {x: ex, y: ey, radius: R};
      }
      carry(a, ex, ey, .35);
      break;
    }
    case 'bindOne': {                                       // 土行孙: up from under an elite, and the rope
      const n = quarry(g, a.x, a.y, S.range, 1, isElite);
      if (!n) return false;
      const f = PICKED[0], boss = !!BY.foe[f.kind].boss, hold = S.hold * dur * (boss ? .4 : 1);
      a.x = f.x + f.r + a.r; a.y = f.y; a.px = a.x; a.py = a.y;
      ev.x = a.x; ev.y = a.y; ev.targets = [{x: f.x, y: f.y, id: f.id}]; ev.hold = hold;
      hitFoe(g, f, S.dmg * mul, e.id, null, a.x, a.y, null, false);
      if (f.state !== 'dead') { f.stun = Math.max(f.stun, hold); if (!boss) { f.act = ''; f.actT = 0; } }
      const z = addZone(g, 'bind', 'zhou', e.id, f.x, f.y, f.r + 16, hold);
      z.unit = f;
      if (F && F.quake) {
        const Q = F.quake, c = clusters(g, h.x, h.y, 540, Q.count);
        ev.quake = [];
        for (let i = 0; i < c; i++) ev.quake.push({x: CL[i].x, y: CL[i].y, radius: Q.radius * area});
        for (const q of ev.quake) {
          const k = query(q.x, q.y, q.radius, Qhit);
          for (let i = 0; i < k; i++) { const o = Qhit[i]; hitFoe(g, o, Q.dmg * mul, e.id, null, q.x, q.y, null, false); if (o.state !== 'dead') o.stun = Math.max(o.stun, Q.hold * dur * (o.heavy ? .25 : 1)); }
          addZone(g, 'hold', 'zhou', e.id, q.x, q.y, q.radius, Q.hold * dur);
        }
      }
      break;
    }
    case 'stone': {                                         // 邓婵玉: five stones at once; in her true form a fan of light as well
      const n = throwStones(g, a, e, S, S.count, mul);
      if (!n) return false;
      ev.count = n;
      if (F && F.blind) {
        const B = F.blind, R = B.radius * area, dir = g.massA, half = Math.cos(B.angle * Math.PI / 360), c = Math.cos(dir), s = Math.sin(dir), k = query(a.x, a.y, R, Qhit);
        for (let i = 0; i < k; i++) {
          const f = Qhit[i], dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy) || 1;
          if ((dx * c + dy * s) / d < half) continue;
          hitFoe(g, f, B.dmg * mul, e.id, null, a.x, a.y, null, false);
          if (f.state !== 'dead') f.stun = Math.max(f.stun, B.stun * dur * (f.heavy ? .25 : 1));
        }
        ev.shape = 'cone'; ev.dir = dir; ev.radius = R; ev.angle = B.angle;
      }
      break;
    }
    case 'charge': {                                        // 黄飞虎: the divine ox charges down a lane through the densest group ahead
      if (!clusters(g, h.x, h.y, 440, 1)) return false;
      const dir = Math.atan2(CL[0].y - a.y, CL[0].x - a.x), len = S.length * area, w = S.width * area, back = !!(F && F.back);
      lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, S, null);
      if (back) lineHit(g, a.x + Math.cos(dir) * len, a.y + Math.sin(dir) * len, dir + Math.PI, len, w, S.dmg * mul * .6, e.id, S, null);
      ev.dir = dir; ev.length = len; ev.width = w; ev.time = S.time; ev.back = back;
      carry(a, a.x + Math.cos(dir) * len * (back ? .15 : 1), a.y + Math.sin(dir) * len * (back ? .15 : 1), S.time);
      break;
    }
    case 'command': {                                       // 姜子牙: every squad's skill comes round sooner; as marshal, all at once
      const all = !!(F && F.allSkills), nail = (F && F.nail) || S.nail;
      ev.troops = []; ev.all = all;
      for (const t of g.build.troops) {
        if (t.rank < 2) continue;
        t.skillCd = all ? 0 : t.skillCd * (1 - S.haste);
        ev.troops.push(t.id);
      }
      if (nail) {
        // 钉头七箭书 (48): the named foe with the most health is nailed; every blow on him is harder for a while
        let best = null;
        for (let i = 0, n = query(h.x, h.y, nail.range, Qpick); i < n; i++) { const f = Qpick[i]; if (f.state !== 'dead' && isNamed(f) && (!best || f.hp > best.hp)) best = f; }
        if (best) { best.expose = Math.max(best.expose || 0, nail.expose); best.exposeT = nail.time * dur; ev.nail = {id: best.id, x: best.x, y: best.y, time: nail.time * dur, expose: nail.expose}; }
      }
      if (!ev.troops.length && !ev.nail) return false;
      break;
    }
    case 'snort': {                                         // 郑伦: the white light takes the soul; the weak are captured
      if (!clusters(g, a.x, a.y, S.radius * area, 1)) return false;
      const full = !!(F && F.full), cap = (F && F.capture) || S.capture, R = S.radius * area, angle = full ? 360 : S.angle;
      // he snorts toward the group; standing in it, he snorts outward from the hero through it, from a step back
      let ox = a.x, oy = a.y, dir = Math.atan2(CL[0].y - a.y, CL[0].x - a.x);
      if (Math.hypot(CL[0].x - a.x, CL[0].y - a.y) < R * .3) { dir = Math.atan2(CL[0].y - h.y, CL[0].x - h.x); ox = CL[0].x - Math.cos(dir) * R * .4; oy = CL[0].y - Math.sin(dir) * R * .4; }
      const half = Math.cos(angle * Math.PI / 360), c = Math.cos(dir), sn = Math.sin(dir);
      const n = query(ox, oy, R, Qhit);
      ev.captured = []; ev.x = ox; ev.y = oy;
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - ox, dy = f.y - oy, d = Math.hypot(dx, dy) || 1;
        if (f.state === 'dead' || (!full && (dx * c + dy * sn) / d < half)) continue;
        if (isCommon(f) && f.hp - S.dmg * mul < f.maxHp * cap) { ev.captured.push(f.id); take(g, f, e.id); continue; }
        hitFoe(g, f, S.dmg * mul, e.id, null, ox, oy, null, false);
        if (f.state !== 'dead') f.stun = Math.max(f.stun, S.daze * dur * (f.heavy ? .25 : 1));
      }
      ev.dir = dir; ev.radius = R; ev.angle = angle;
      // the crow soldiers come up with their hooks (3: 「烏鴉兵」 bind whom his light has felled)
      const crows = g.build.troops.find(t => t.id === 'crows' && t.rank >= 2);
      if (crows) crows.skillCd = Math.min(crows.skillCd, 0);
      break;
    }
    case 'vase': {                                          // 龙吉公主: the vase swallows the Shang's shots and fire; the rope binds
      const all = !!(F && F.all), R = S.radius * area, R2 = R * R;
      let swallowed = 0, doused = 0;
      for (const s of g.shots) if (s.side === 'shang' && !s.dead && (all || (s.x - h.x) * (s.x - h.x) + (s.y - h.y) * (s.y - h.y) <= R2)) { s.dead = true; swallowed++; }
      for (const z of g.zones) if (z.side === 'shang' && !z.dead && z.kind === 'burn' && (all || (z.x - h.x) * (z.x - h.x) + (z.y - h.y) * (z.y - h.y) <= R2)) { z.dead = true; doused++; }
      ev.radius = all ? 0 : R; ev.swallowed = swallowed; ev.doused = doused; ev.targets = [];
      if (F && F.pour && swallowed) {
        // poured back as water on the densest groups, one blow a shot
        const P = F.pour, k = clusters(g, h.x, h.y, 700, Math.min(swallowed, 8));
        for (let j = 0; j < swallowed && k; j++) {
          const c = CL[j % k], m = query(c.x, c.y, P.radius * area, Qhit);
          for (let i = 0; i < m; i++) hitFoe(g, Qhit[i], P.dmg * mul, e.id, null, c.x, c.y, null, false);
          if (j < k) ev.targets.push({x: c.x, y: c.y, pour: true});
        }
      }
      // 捆龙索: the strongest foe near is bound, and the strongmen hold it
      let best = null;
      for (let i = 0, n = query(a.x, a.y, S.range, Qpick); i < n; i++) { const f = Qpick[i]; if (f.state !== 'dead' && (!best || f.hp > best.hp)) best = f; }
      if (best) {
        const hold = S.hold * dur * (isNamed(best) ? 1 / 3 : best.heavy ? .5 : 1);
        hitFoe(g, best, S.dmg * mul, e.id, null, a.x, a.y, null, false);
        if (best.state !== 'dead') { best.stun = Math.max(best.stun, hold); const z = addZone(g, 'bind', 'zhou', e.id, best.x, best.y, best.r + 14, hold); z.unit = best; }
        ev.targets.push({x: best.x, y: best.y, id: best.id}); ev.hold = hold;
      }
      if (!best && !swallowed && !doused) return false;
      break;
    }
    case 'nail': {                                          // 黄天化: the nail goes through the heart of the strongest named foe
      let best = null, rank = -1;
      for (let i = 0, n = query(a.x, a.y, S.length * area, Qpick); i < n; i++) {
        const f = Qpick[i];
        if (f.state === 'dead') continue;
        const r = isNamed(f) ? 2 : f.elite ? 1 : 0;
        if (r > rank || (r === rank && f.hp > best.hp)) { best = f; rank = r; }
      }
      if (!best) return false;
      const share = (F && F.share) || S.share, len = S.length * area, w = S.width * area, dir = Math.atan2(best.y - a.y, best.x - a.x);
      ev.targets = []; ev.dir = dir; ev.length = len; ev.width = w; ev.count = S.count;
      for (let k = 0; k < S.count && best.state !== 'dead'; k++) {
        lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, null, null);
        if (best.state !== 'dead') hitFoe(g, best, best.maxHp * share, e.id, null, a.x, a.y, null, false);
        ev.targets.push({x: best.x, y: best.y, id: best.id});
      }
      break;
    }
    default: return false;
  }
  // a true form's skill is a great strike (SPEC-CAMPAIGN 1.10): it pushes the field outward from where it falls
  if (F && F.great) { const S2 = ev.smash, x = S2 ? S2.x : ev.x, y = S2 ? S2.y : ev.y; ev.shock = greatShock(g, x, y, (S2 && S2.radius) || ev.radius || 140); }
  g.events.push(ev);
  setState(a, 'skill'); a.stateT = 0;
  return true;
}
/** 五光石: fast stones, one foe each, first at whatever is winding up a blow. Returns how many were thrown. */
export function throwStones(g, a, e, S, count, mul) {
  const n = quarry(g, a.x, a.y, S.range, count || 1, isWinding);
  for (let i = 0; i < n; i++) {
    const f = PICKED[i], dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy) || 1;
    const s = addShot(g, 'stone', 'zhou', e.id, a.x, a.y, dx / d * S.speed, dy / d * S.speed, S.r, S.dmg * mul, d / S.speed + .25);
    s.hitP = S;
  }
  return n;
}

export function stepGeneral(g, a, dt) {
  const h = g.hero, m = g.mods, e = g.build.generals.find(x => x.id === a.general);
  if (!e) { a.dead = true; return; }
  const row = BY.general[e.id], P = row.at[e.trueForm ? MAX.general + 1 : e.level], F = P.form || null;
  if (a.state === 'away') {
    // he has withdrawn; he is never lost
    a.awayT -= dt; a.x = a.px = h.x; a.y = a.py = h.y;
    if (a.awayT <= (g.mods.back || 0)) {   /* 将星: back sooner */ a.hp = a.maxHp; setState(a, 'walk'); g.events.push({type: 'generalReturn', general: e.id, x: a.x, y: a.y}); }
    return;
  }
  if (a.mvT > 0) { a.mvT -= dt; const k = 1 - Math.max(0, a.mvT) / a.mvD; a.x = a.mx0 + (a.mx1 - a.mx0) * k; a.y = a.my0 + (a.my1 - a.my0) * k; return; }
  // whom he goes for
  a.seekT -= dt;
  if (a.seekT <= 0) {
    a.seekT = .3; a.hasTarget = false;
    // his own station round the hero, turned to where the mass is (SPEC-CAMPAIGN 2.2a)
    const St = row.station, sa = g.massA + St.angle;
    a.tx = h.x + Math.cos(sa) * St.dist; a.ty = h.y + Math.sin(sa) * St.dist;
    if (row.seek === 'cluster') { if (clusters(g, h.x, h.y, GENERAL.leash, 1)) { a.tx = CL[0].x; a.ty = CL[0].y; a.hasTarget = true; } }
    else if (row.seek === 'elite') { if (quarry(g, a.x, a.y, GENERAL.leash, 1, isElite)) { a.tx = PICKED[0].x; a.ty = PICKED[0].y; a.hasTarget = true; } }
    else if (row.seek === 'named') {
      // the named foe with the most health in reach, else an elite, else the densest group
      let best = null;
      for (let i = 0, n = query(h.x, h.y, GENERAL.leash * 1.4, Qpick); i < n; i++) { const f = Qpick[i]; if (f.state !== 'dead' && isNamed(f) && (!best || f.hp > best.hp)) best = f; }
      if (best || quarry(g, a.x, a.y, GENERAL.leash, 1, isElite)) { const t = best || PICKED[0]; a.tx = t.x; a.ty = t.y; a.hasTarget = true; }
      else if (clusters(g, h.x, h.y, GENERAL.leash, 1)) { a.tx = CL[0].x; a.ty = CL[0].y; a.hasTarget = true; }
    }
    else if (row.seek === 'front') { a.tx = h.x + Math.cos(g.massA) * 150; a.ty = h.y + Math.sin(g.massA) * 150; }
  }
  const A = P.attack, reach = !a.hasTarget ? 4 : A.shape === 'line' ? A.length * .6 : A.shape === 'arc' ? A.radius * .6 : 50;
  const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
  const under = !!row.under && d > 150;
  if (d > 1400) { a.x = h.x; a.y = h.y; }
  else if (d > reach) {
    const v = Math.min(d - reach, row.speed * m.speed * (under ? 1.5 : 1) * dt);
    a.x += dx / d * v; a.y += dy / d * v; a.dir = Math.atan2(dy, dx);
    if (Math.abs(dx) > 4) a.facing = dx > 0 ? 1 : -1;
    if (under) setState(a, 'under'); else if ((a.state !== 'attack' && a.state !== 'skill') || a.stateT > .3) setState(a, 'walk');
  } else if ((a.state !== 'attack' && a.state !== 'skill') || a.stateT > .3) setState(a, 'idle');
  {
    // never on top of the hero: one within a mount's length (a true form, drawn larger, one and a half) steps aside at once,
    // out to the side the hero is not riding toward, so the hero rides past him rather than through him
    const clear = GENERAL.clear * (e.trueForm ? GENERAL.formClear : 1), ox = a.x - h.x, oy = a.y - h.y, od = Math.hypot(ox, oy);
    if (od < clear) {
      let ux = od > 1e-6 ? ox / od : Math.cos(g.massA + row.station.angle), uy = od > 1e-6 ? oy / od : Math.sin(g.massA + row.station.angle);
      const hv = Math.hypot(h.vx || 0, h.vy || 0);
      if (hv > 1 && (ux * h.vx + uy * h.vy) / hv > .5) { const sx = -h.vy / hv, sy = h.vx / hv, side = ux * sx + uy * sy >= 0 ? 1 : -1; ux = sx * side; uy = sy * side; }   // right in his path: aside
      const nx = a.x + ux * (clear - od), ny = a.y + uy * (clear - od), ex = nx - h.x, ey = ny - h.y, ed = Math.hypot(ex, ey) || 1;
      a.x = h.x + ex / ed * clear; a.y = h.y + ey / ed * clear;
    }
  }
  if (!row.fly && !row.aloof && !under) {
    // on the ground he is a body like a soldier's: foes go round him and strike him
    const n = query(a.x, a.y, a.r + 2, Qally);
    for (let k = 0; k < n; k++) {
      const f = Qally[k];
      if (f.state === 'dead') continue;
      const fx = f.x - a.x, fy = f.y - a.y, fd = Math.hypot(fx, fy) || 1, over = a.r + f.r - fd;
      if (over > 0 && !f.heavy) { f.x += fx / fd * over * .5; f.y += fy / fd * over * .5; }
      if (f.hitCd <= 0 && f.stun <= 0) { f.hitCd = 1; hurtAlly(g, a, f.act === 'charge' ? f.cdmg : f.dmg * ALLY.hurt, f.kind); }
    }
    if (a.state === 'away') return;
  }
  const mul = m.dmg * P.grow * GENERAL.power;
  if (F && F.storm) {
    if (!held(a.storm, a.stormId, 'storm') || a.storm.unit !== a) { a.storm = addZone(g, 'storm', 'zhou', e.id, a.x, a.y, F.storm.radius * m.area, Infinity); a.storm.unit = a; a.stormId = a.storm.id; }   // pooled: held by id
    a.storm.dps = F.storm.dps * mul;
  }
  if (under) return;
  if (P.skill.net) {
    // 雾露乾坤网: Shang shots that come near the hero are caught, one every `every` seconds
    a.netT -= dt;
    if (a.netT <= 0) {
      const N = P.skill.net, R2 = (N.radius * m.area) ** 2;
      let best = null, bd = R2;
      for (const s of g.shots) { if (s.side !== 'shang' || s.dead) continue; const d = (s.x - h.x) * (s.x - h.x) + (s.y - h.y) * (s.y - h.y); if (d <= bd) { bd = d; best = s; } }
      if (best) { best.dead = true; a.netT = N.every; g.events.push({type: 'netCatch', x: best.x, y: best.y, by: e.id, kind: best.kind}); }
      else a.netT = .1;
    }
  }
  a.cd -= dt;
  if (a.cd <= 0) {
    const done = A.shape === 'stone' ? throwStones(g, a, e, A, 1, mul) > 0 : cast(g, a, A, e.id, e.level, e.trueForm, mul, null, a.id);
    a.cd = done ? A.cd : .15;
    if (done && a.state !== 'skill') { setState(a, 'attack'); a.stateT = 0; }
  }
  e.skillCd -= dt * (m.generalRate || 1);
  if (e.skillCd <= 0) e.skillCd = generalSkill(g, a, e, row, P, mul) ? P.skill.cd : .4;
}
