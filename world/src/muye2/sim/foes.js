// The Shang on the field: adding a foe, the mass's walking, shooting and charging. Owner: rules·campaign (A).

import {KB, DEAD, TICK, clamp, setState, rand, GW, GH, cellStart, gridItems, query, Qaura, foePool} from './core.js';
import {hitFoe, hurtAlly, hurtHero, addShot, addZone, weary} from './harm.js';
import {stepNamed, stepMarten, guardCut} from './bosses.js';
import {PLAN, spawnPlan} from './campaign.js';
import {WORLD, HERO, ALLY, SCHEDULE, CONTENT, BY, CAMPAIGN} from '../content.js';

/**
 * Add a foe of a kind in CONTENT.foes. Its health and damage are those of the kind at the game's time (the mass
 * grows by the minute; a boss does not). Used by the schedule, and by tests and stills.
 */
export function addFoe(g, kind, x, y) {
  const row = BY.foe[kind];
  if (!row) throw new Error(`no foe ${kind}`);
  const f = foePool.pop() || {};
  const grow = (row.boss ? 1 : spawnPlan(g.t, PLAN).hp) * g.tierK.hp;
  f.id = g.nextId++; f.kind = kind; f.x = f.px = clamp(x, 0, WORLD.w); f.y = f.py = clamp(y, 0, WORLD.h);
  f.vx = 0; f.vy = 0; f.facing = g.hero.x >= x ? 1 : -1; f.dir = 0;
  f.hp = f.maxHp = Math.round(row.hp * grow); f.state = 'walk'; f.stateT = 0; f.flash = 0; f.elite = !!row.elite;
  f.r = row.r; f.speed = row.speed; f.dmg = row.dmg * (1 + SCHEDULE.dmg * g.t / 60) * (g.t < SCHEDULE.early.until ? SCHEDULE.early.dmg + (1 - SCHEDULE.early.dmg) * g.t / SCHEDULE.early.until : 1) * g.tierK.dmg; f.armour = (row.armour || 0) + (row.boss ? 0 : PLAN.armour); f.heavy = !!row.heavy;
  f.cd = row.between ? row.between * (.3 + .7 * rand(g)) : 0; f.hitCd = 0; f.tcd = 0; f.oh = 0; f.backT = 0;
  f.stun = 0; f.slow = 0; f.slowT = 0; f.haste = 1; f.hasteT = 0; f.kx = 0; f.ky = 0;
  f.burn = 0; f.burnT = 0; f.burnTick = 0; f.burnSrc = '';
  f.dead = false; f.mark = 0; f.clen = 0; f.act = ''; f.actT = 0; f.ax = 0; f.ay = 0; f.cs = 0; f.cdmg = 0; f.rest = 0; f.auraT = 0; f.cell = 0;
  f.pcd = row.patterns ? row.patterns.map((A, i) => A.cd * (.35 + .3 * i)) : null; f.named = !!row.named; f.summon = ''; f.scout = false;
  // the campaign's fields (SPEC-CAMPAIGN.md 1.2, 1.3)
  f.tier = row.tier || ''; f.retinue = 0; f.phases = row.phases || null; f.phase = 0; f.enraged = false; f.cdK = 1; f.flee = false; f.guardT = 0; f.born = g.t;
  f.expose = 0; f.exposeT = 0; f.pat = ''; f.eyeUntil = 0; f.eyeWardUntil = 0; f.eyeWardNext = 0;     // B's 天眼 (times on g.t)
  f.wardT = 0; f.capB = 0; f.capMax = 0; f.weary = false; f.kinK = 0; f.kinKey = ''; f.host = false; f.lastHost = false; f.gateIn = false;      // the finale (1.16)
  f.melee = MELEE.has(row.ai) && !row.named && !row.heavy; f.atk = 0; if (f.melee) f.hitCd = Infinity;     // a melee foe swings (below); the squads' contact code never fires for him
  f.under = false; f.gone = false; f.ex = 0; f.ey = 0; f.glareT = 0; f.cutDmg = 0; f.summonN = 0; f.hookCd = 0; f.trailT = 0; f.wob = rand(g) * 6.283;      // B's (照妖鉴, 钉头七箭书): every field a pooled foe can carry is reset here, or a replay parts
  g.foes.push(f); g.alive++;
  return f;
}

export function startLane(g, f, A) {
  const h = g.hero, dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1;
  f.ax = dx / d; f.ay = dy / d; f.act = 'aim'; f.actT = A.warn; f.cs = A.chargeSpeed; f.cdmg = (A.dmg || BY.foe[f.kind].dmg) * (f.dmg / BY.foe[f.kind].dmg);
  f.rest = A.rest; f.clen = A.length;
  const dir = Math.atan2(f.ay, f.ax);
  const z = addZone(g, 'lane', 'shang', f.kind, f.x, f.y, 0, A.warn);
  z.shape = 'lane'; z.dir = dir; z.len = A.length; z.w = A.width; z.pattern = f.pat = A.ai ? 'lane' : A.id;
  g.events.push({type: 'warn', kind: z.pattern, shape: 'lane', by: f.kind, x: f.x, y: f.y, dir, length: A.length, width: A.width, time: A.warn, id: f.id});
  setState(f, 'windup');
}

export function stepFoes(g, dt) {
  const h = g.hero, foes = g.foes, lim = WORLD.w, kd = Math.max(0, 1 - KB * dt);
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    f.px = f.x; f.py = f.y; f.stateT += dt;
    if (f.state === 'dead') { if (f.stateT >= DEAD) f.dead = true; continue; }
    if (f.flash > 0) f.flash -= dt;
    if (f.cd > 0) f.cd -= dt;
    if (f.hitCd > 0) f.hitCd -= dt;
    if (f.tcd > 0) f.tcd -= dt;
    if (f.oh > 0) f.oh -= dt;
    if (f.backT > 0) f.backT -= dt;
    if (f.hasteT > 0) f.hasteT -= dt;
    if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slow = 0; }
    if (f.burnT > 0) {
      f.burnT -= dt; f.burnTick -= dt;
      if (f.burnTick <= 0) { f.burnTick += TICK; hitFoe(g, f, f.burn * TICK, f.burnSrc, null, 0, 0, null, true); if (f.state === 'dead') continue; }
      if (f.burnT <= 0) f.burn = 0;
    }
    if (f.kx !== 0 || f.ky !== 0) {
      f.x += f.kx * dt; f.y += f.ky * dt; f.kx *= kd; f.ky *= kd;
      if (Math.abs(f.kx) + Math.abs(f.ky) < 4) { f.kx = 0; f.ky = 0; }
    }
    const row = BY.foe[f.kind];
    const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (f.guardT > 0) { f.guardT -= dt; if (f.guardT <= 0 && f.cutDmg) { guardCut(g, f); f.cutDmg = 0; } }
    if (f.wardT > 0) f.wardT -= dt;
    if (f.capMax) {
      const w = weary(g, f);                                  // the burst cap's bucket fills again; past his band, faster
      if (w > 1 && !f.weary) { f.weary = true; g.events.push({type: 'weary', id: f.id, kind: f.kind, tier: f.tier, x: f.x, y: f.y}); }
      f.capB = Math.min(f.capMax * w * CAMPAIGN.guard.hold, f.capB + f.capMax * w * dt);
    }
    if (f.glareT > 0) { f.glareT -= dt; if (f.glareT <= 0) g.events.push({type: 'glareEnd', id: f.id, x: f.x, y: f.y}); }
    if (f.hookCd > 0) f.hookCd -= dt;
    if (f.exposeT > 0) f.exposeT -= dt;
    if (f.flee) {
      // the rout: they run from the hero and hurt nobody until the march ends and they are gone
      const sp = f.speed * CAMPAIGN.rout;
      f.vx = -dx / d * sp; f.vy = -dy / d * sp; f.x += f.vx * dt; f.y += f.vy * dt; f.facing = dx > 0 ? -1 : 1; f.dir = Math.atan2(-dy, -dx);
      setState(f, 'flee');
      if (f.x < 0) f.x = 0; else if (f.x > lim) f.x = lim;
      if (f.y < 0) f.y = 0; else if (f.y > WORLD.h) f.y = WORLD.h;
      continue;
    }
    let walk = 1;                                        // 1 toward the hero, -1 away, 0 stand
    if (f.stun > 0) {
      f.stun -= dt; walk = 0;
      if (f.act === 'swing' || f.act === 'after') { f.act = ''; f.atk = 0; }
      if (!f.act) setState(f, 'stun');
    }
    if (f.act) {
      // a warned attack runs its course: a chariot or a leader cannot be talked out of it
      walk = 0; f.actT -= dt;
      if (f.act === 'aim') { if (f.actT <= 0) { f.act = 'charge'; f.actT = f.clen / f.cs; setState(f, 'charge'); } }
      else if (f.act === 'swing') { if (f.actT <= 0) blow(g, f, row); }
      else if (f.act === 'after') { if (f.actT <= 0) { f.act = ''; f.atk = 0; setState(f, 'walk'); } }
      else if (f.act === 'rear') { if (f.actT <= 0) { f.act = 'gallop'; f.actT = row.dash; setState(f, 'gallop'); } }
      else if (f.act === 'gallop') {
        f.x += f.ax * row.gallop * dt; f.y += f.ay * row.gallop * dt; f.facing = f.ax >= 0 ? 1 : -1;
        if (f.actT <= 0) { f.act = ''; f.cd = row.between; setState(f, 'walk'); }
      }
      else if (f.act === 'charge') {
        f.x += f.ax * f.cs * dt; f.y += f.ay * f.cs * dt; f.facing = f.ax >= 0 ? 1 : -1;
        if (f.actT <= 0) { f.act = 'rest'; f.actT = f.rest; setState(f, 'rest'); }
      } else if (f.actT <= 0) {
        if (f.summon) {
          for (let k = 0, n = f.summonN || 1; k < n; k++) {
            const a = rand(g) * 6.283, o = addFoe(g, f.summon, f.x + Math.cos(a) * 60, f.y + Math.sin(a) * 60);
            if (f.summonN) { o.retinue = f.id; o.elite = false; }
            g.events.push({type: 'summoned', kind: f.summon, x: o.x, y: o.y, id: o.id, by: f.kind});
          }
          f.summon = ''; f.summonN = 0;
        }
        if (f.under) { f.under = false; f.x = f.px = f.ex; f.y = f.py = f.ey; g.events.push({type: 'emerge', id: f.id, x: f.x, y: f.y}); }
        if (f.gone) { f.gone = false; const a = rand(g) * 6.283; f.x = f.px = h.x + Math.cos(a) * 170; f.y = f.py = h.y + Math.sin(a) * 170; g.events.push({type: 'transform', id: f.id, form: 'back', time: 0, x: f.x, y: f.y}); }
        f.act = ''; setState(f, 'walk');
      }
    } else if (f.stun <= 0) {
      const ai = row.ai;
      if (ai === 'shoot' || ai === 'aura') {
        const keep = ai === 'shoot' ? row.range : row.keep;
        walk = d > keep ? 1 : d < keep * .6 ? -.6 : 0;
        if (f.state === 'windup') {
          walk = 0;
          if (f.stateT >= row.wind) {
            const S = row.shot, dir = Math.atan2(dy, dx);
            addShot(g, S.kind, 'shang', f.kind, f.x, f.y, Math.cos(dir) * S.speed, Math.sin(dir) * S.speed, S.r, S.dmg * (f.dmg / row.dmg), S.life);
            g.events.push({type: 'shoot', x: f.x, y: f.y, kind: S.kind, dir, id: f.id});
            f.cd = row.between; setState(f, 'walk');
          }
        } else if (f.cd <= 0 && d < keep * 1.25) { setState(f, 'windup'); walk = 0; }
        if (ai === 'aura') {
          f.auraT -= dt;
          if (f.auraT <= 0) {
            f.auraT = TICK;
            const n = query(f.x, f.y, row.aura, Qaura);
            for (let k = 0; k < n; k++) { const o = Qaura[k]; if (o !== f && !o.elite) { o.haste = row.haste; o.hasteT = TICK * 2; } }
          }
        }
      } else if (ai === 'charge') {
        if (f.cd <= 0 && d < row.sight) { f.cd = row.between; startLane(g, f, row); walk = 0; }
      } else if (ai === 'ride') {
        // 拐子马: he closes fast; near enough, he rears (a pose, `windup`) and gallops through where the hero was
        if (f.cd <= 0 && d < row.reach) {
          f.ax = dx / d; f.ay = dy / d; f.act = 'rear'; f.actT = row.wind; walk = 0; setState(f, 'windup');
          g.events.push({type: 'rear', x: f.x, y: f.y, id: f.id, dir: Math.atan2(dy, dx), time: row.wind});
        }
      } else if (ai === 'drum') {
        // the drummer keeps behind the mass; at each beat those round him break into a run
        walk = d > row.keep ? 1 : d < row.keep * .7 ? -.6 : 0;
        f.auraT -= dt;
        if (f.auraT <= 0) {
          f.auraT = row.beat;
          g.events.push({type: 'drum', x: f.x, y: f.y, id: f.id, radius: row.radius, time: row.surge});
          const n = query(f.x, f.y, row.radius, Qaura);
          for (let k = 0; k < n; k++) { const o = Qaura[k]; if (o !== f && !o.elite && !o.flee) { o.haste = Math.max(o.haste, row.haste); o.hasteT = Math.max(o.hasteT, row.surge); } }
        }
      } else if (ai === 'named') { if (stepNamed(g, f, row, d, dt)) walk = 0; }
      else if (ai === 'marten') { if (stepMarten(g, f, row, dt)) walk = 0; }
      if (f.melee && walk !== 0 && !f.act && startSwing(g, f, d)) walk = 0;
      if (row.trail && walk !== 0) {
        // 火龙兵: fire where they have run
        f.trailT -= dt;
        if (f.trailT <= 0) { f.trailT = row.trail.every; const z = addZone(g, 'fire', 'shang', f.kind, f.x, f.y, row.trail.r, row.trail.life); z.dmg = row.trail.dmg * (f.dmg / row.dmg); z.tick = .5; }
      }
      if ((ai === 'aura') && row.drag) { const hx = h.x - f.x, hy = h.y - f.y; if (hx * hx + hy * hy < row.aura * row.aura) { h.drag = Math.min(h.drag, 1 - row.drag); h.dragT = .1; } }
      if (ai === 'escort') {
        // 钺斧卫 keep by 纣王 while he lives
        const king = g.campaign.live.find(o => o.tier === 'final' && o.state !== 'dead');
        if (king && d > 160) {
          const a = (f.id % 12) / 12 * 6.283 + g.t * .3, tx = king.x + Math.cos(a) * 110 - f.x, ty = king.y + Math.sin(a) * 110 - f.y, td = Math.hypot(tx, ty) || 1;
          const sp = Math.min(td, f.speed * dt * (f.slow > 0 ? 1 - f.slow : 1)); f.x += tx / td * sp; f.y += ty / td * sp; walk = 0; setState(f, 'walk');
        }
      }
      if (walk !== 0 && !f.act && f.state !== 'windup') {
        let sp = f.speed * g.haste * walk * (f.hasteT > 0 ? f.haste : 1) * (f.slow > 0 ? 1 - f.slow : 1);
        if (f.tier && walk > 0 && d > CAMPAIGN.come.far) sp *= CAMPAIGN.come.stride;      // a boss comes to the hero
        else if (f.weary && walk > 0 && d > CAMPAIGN.weary.near) sp *= CAMPAIGN.come.stride;
        if (f.weary && walk > 0) sp *= CAMPAIGN.weary.close;                              // weary, he closes in
        f.vx = dx / d * sp; f.vy = dy / d * sp;
        if (ai === 'swarm') { const w = Math.sin(g.t * 5 + f.wob) * sp * .8; f.vx += -dy / d * w; f.vy += dx / d * w; }   // crows and wasps weave as they come
        f.x += f.vx * dt; f.y += f.vy * dt;
        setState(f, 'walk');
      } else if (!f.act && f.state !== 'windup' && f.state !== 'attack' && f.stun <= 0) setState(f, 'idle');
      if (Math.abs(dx) > 6) f.facing = dx > 0 ? 1 : -1;
    }
    f.dir = Math.atan2(dy, dx);
    // bodies of the mass ease apart (a chariot or a leader is not moved by them)
    if (!f.heavy) {
      const c = f.cell, cx = c % GW, cy = (c / GW) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= GH) continue;
        const x0 = cx > 0 ? cx - 1 : 0, x1 = cx < GW - 1 ? cx + 1 : cx, base = yy * GW;
        for (let k = cellStart[base + x0], end = cellStart[base + x1 + 1]; k < end; k++) {
          const o = gridItems[k];
          if (o === f || o.state === 'dead') continue;
          const ex = f.x - o.x, ey = f.y - o.y, rr = f.r + o.r, d2 = ex * ex + ey * ey;
          if (d2 >= rr * rr) continue;
          if (d2 < 1e-6) { f.x += ((f.id & 1) ? 1 : -1) * .5; f.y += ((f.id & 2) ? 1 : -1) * .5; continue; }
          const dd = Math.sqrt(d2), p = (rr - dd) * (o.heavy ? .5 : .25) / dd;
          f.x += ex * p; f.y += ey * p;
        }
      }
    }
    if (f.x < 0) f.x = 0; else if (f.x > lim) f.x = lim;
    if (f.y < 0) f.y = 0; else if (f.y > WORLD.h) f.y = WORLD.h;
  }
}

// ------------------------------------------------------------------------------------------- the melee mass's blow
// A foot soldier of the mass in reach of the hero or of a soldier stops, winds up (`windup`, SWING.wind s), strikes on
// the blow (the harm lands then, if the target is still in reach), and recovers (`attack`). The art reads `state`,
// `stateT`, `act` ('swing' | 'after'), `actT` and `atk` (the target's id; 0 the hero... see SPEC 1.13). Timed so that the
// mass hurts as much as its touch did: the hero is struck at most every SWING.hero s (his 0.5 s grace capped the touch),
// a soldier every SWING.ally s (the squads' hitCd of 1 s).
const MELEE = new Set(['walk', 'swarm', 'escort']);
export const SWING = {wind: .3, reach: 10, land: 20, hero: .2, ally: .55, spent: .05};
const TARGET = {x: 0, y: 0};
function startSwing(g, f, d) {
  const h = g.hero;
  if (h.fallT <= 0 && d <= f.r + HERO.r + SWING.reach) { f.atk = -1; }
  else {
    if ((f.id + g.tickN) % 4) return false;                        // soldiers in reach are looked for every 4th step
    let best = null, bd = Infinity;
    for (const a of g.allies) {
      if (a.state === 'dead' || a.state === 'away' || a.mvT > 0 || a.kind === 'general' && BY.general[a.general] && BY.general[a.general].fly) continue;
      const dx = a.x - f.x, dy = a.y - f.y, dd = dx * dx + dy * dy, R = f.r + a.r + SWING.reach;
      if (dd <= R * R && dd < bd) { bd = dd; best = a; }
    }
    if (!best) return false;
    f.atk = best.id;
  }
  f.act = 'swing'; f.actT = SWING.wind; setState(f, 'windup');
  return true;
}
function blow(g, f, row) {
  const h = g.hero;
  let spent = false;
  if (f.atk === -1) {
    spent = h.safe > 0;
    const dx = h.x - f.x, dy = h.y - f.y, R = f.r + HERO.r + SWING.land;
    if (dx * dx + dy * dy <= R * R && hurtHero(g, f.dmg, f.kind, f.x, f.y, '') && row.hook && h.held <= 0 && f.hookCd <= 0) {
      f.hookCd = row.hook.every; h.held = row.hook.hold;
      g.events.push({type: 'held', time: row.hook.hold, by: f.kind, how: 'hook', x: h.x, y: h.y});
    }
  } else {
    const a = g.allies.find(o => o.id === f.atk);
    if (a && a.state !== 'dead' && a.state !== 'away') { const dx = a.x - f.x, dy = a.y - f.y, R = f.r + a.r + SWING.land; if (dx * dx + dy * dy <= R * R) hurtAlly(g, a, f.dmg * ALLY.hurt, f.kind); }
  }
  g.events.push({type: 'blow', id: f.id, target: f.atk, x: f.x, y: f.y});
  // a blow that fell in the hero's half second of grace was spent on nothing: he swings again sooner (as a touch would have)
  f.act = 'after'; f.actT = f.atk === -1 ? (spent ? SWING.spent : SWING.hero) : SWING.ally; setState(f, 'attack');
}
