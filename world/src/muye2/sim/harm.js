// Harm, and the things on the field: foes and allies hurt, the hero hurt, shots, zones and pickups made.
// Owner: rules·campaign (A).

import {KB, clamp, setState, rand, query, Qward, shotPool, zonePool, pickupPool, inZone} from './core.js';
import {mend} from './build.js';
import * as BUILD from './build.js';
import {inAura} from './squads.js';
import {WORLD, HERO, GENERAL, RIDER, SCHEDULE, PICKUPS, BY, CAMPAIGN} from '../content.js';
import {bossDown} from './campaign.js';

export function shove(f, ox, oy, dist) {
  let dx = f.x - ox, dy = f.y - oy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
  f.kx += dx * dist * KB; f.ky += dy * dist * KB;
}

/** How much more a boss takes, and how much higher his burst cap is, for having lived past his band (1 until then). */
export function weary(g, f) {
  const W = CAMPAIGN.weary, after = W.after[f.tier];
  if (!after) return 1;
  const over = g.t - f.born - after;
  return over > 0 ? 1 + over * W.rate : 1;
}

export function kill(g, f, src) {
  const row = BY.foe[f.kind];
  f.hp = 0; f.state = 'dead'; f.stateT = 0; f.act = '';
  g.alive--; g.stats.kills++;
  g.events.push({type: 'kill', x: f.x, y: f.y, id: f.id, kind: f.kind, by: src, elite: f.elite});
  if (row.xp) addPickup(g, 'spirit', f.x, f.y, f.scout ? Math.max(1, Math.round(row.xp * SCHEDULE.scouts.xp)) : row.xp);
  // a chest of value 1 is a small boss's (it offers generals), of value 2 a big boss's; a lieutenant leaves a peach
  if (f.tier === 'lieutenant') addPickup(g, 'peach', f.x + 10, f.y, 0);
  else if (f.elite && f.tier !== 'final') addPickup(g, 'chest', f.x + 12, f.y + 8, f.tier === 'small' ? 1 : f.tier === 'big' ? 2 : 0);
  if (f.elite && !f.tier && g.mods.chest > 1 && rand(g) < g.mods.chest - 1) addPickup(g, 'chest', f.x - 12, f.y + 8, 0);   // B's meta rank `chest`: an elite may leave a second
  else if (row.ai === 'aura') addPickup(g, 'peach', f.x + 10, f.y, 0);
  else {
    const roll = rand(g);
    if (roll < PICKUPS.peach) addPickup(g, 'peach', f.x + 10, f.y, 0);
    else if (roll < PICKUPS.peach + PICKUPS.lodestone) addPickup(g, 'lodestone', f.x + 10, f.y, 0);
  }
  if (f.tier) bossDown(g, f);
}

/** The hero's last health is gone: he falls from his horse, and the run ends HERO.fallTime later. */
export function fallNow(g, by) {
  const h = g.hero;
  if (h.fallT > 0) return;
  h.hp = 0; h.fallT = HERO.fallTime; h.fullCry = false; h.rideT = 0; h.held = 0; h.bleed = 0;
  setState(h, 'fall');
  g.events.push({type: 'fall', x: h.x, y: h.y, by});
}

/**
 * Harm a foe. `P` (a row's numbers, or null) gives the stun, the push from (ox, oy) and the share against elites;
 * `el` is the element a soldier's blow has taken in the eight trigrams; `dot` is burning: no armour, no effects.
 */
export function hitFoe(g, f, dmg, src, P, ox, oy, el, dot) {
  if (f.state === 'dead' || f.under || f.gone) return;          // under the earth, or gone on the wind: nothing reaches him
  let d = dmg * (g.power[src] || 1);
  if (!dot) {
    if (P && f.elite && P.eliteMult) d *= P.eliteMult;
    if (el === 'metal') d *= 1 + RIDER.metal.more * (g.form && g.form.rider || 1);
    if (f.armour) d = Math.max(1, d - f.armour);
    if (f.guardT > 0) d *= .15;                                  // 一刀抵三: he turns the blows aside
    if (f.exposeT > 0) d *= 1 + f.expose;                        // B's 照妖鉴 and 钉头七箭书: revealed, he takes more
    if (P && P.interrupt && f.named && (f.act === 'slam' || f.act === 'aim')) interrupt(g, f);
    if (f.tier === 'final' && g.campaign.officers > 0) d *= CAMPAIGN.guardAura;   // 鲁仁杰, 雷鹍, 雷鹏 still ride with him
  }
  let capped = false;
  if (f.capMax) d *= weary(g, f);                              // past his band he tires: every blow tells more
  if (f.capMax) {
    // a boss's ward on arrival and his burst cap (SPEC-CAMPAIGN.md 1.14): what goes over is turned aside
    if (f.wardT > 0) { d = 0; capped = true; }
    else if (d > f.capB) { d = Math.max(0, f.capB); capped = true; }
    f.capB -= d;
  }
  const dealt = d < f.hp ? d : f.hp;
  f.hp -= d; f.flash = .12;
  g.stats.damage[src] = (g.stats.damage[src] || 0) + dealt;
  if (dot) g.stats.effects[src] = (g.stats.effects[src] || 0) + dealt;      // burning and crushing ground: part of `damage`, counted here too
  g.events.push({type: 'hit', x: f.x, y: f.y, id: src, target: f.id, dmg: d, dot: !!dot, capped, push: !dot && P && P.push && !f.heavy ? P.push : 0, fromX: ox, fromY: oy});
  if (f.hp <= 0) { kill(g, f, src); return; }
  if (dot) return;
  const soft = f.heavy ? .25 : 1;
  if (P) {
    if (P.stun) f.stun = Math.max(f.stun, P.stun * g.mods.dur * soft);
    if (P.push && !f.heavy) shove(f, ox, oy, P.push);    // a chariot or a leader is not thrown
  }
  if (el && el !== 'metal') {
    const k = g.form && g.form.rider || 1, R = RIDER[el];
    if (el === 'fire') { f.burn = Math.max(f.burn, d * R.burn * k); f.burnT = R.time * g.mods.dur; f.burnSrc = src; }
    else if (el === 'water') { f.slow = Math.max(f.slow, Math.min(.8, R.slow * k)); f.slowT = R.time * g.mods.dur; }
    else if (el === 'wood') f.stun = Math.max(f.stun, R.hold * k * soft);
    else if (el === 'earth') shove(f, ox, oy, R.push * k * soft);
  }
}

export function hurtAlly(g, a, dmg, by) {
  if (a.state === 'dead' || a.state === 'away' || a.mvT > 0) return;
  const w = g.ward;
  if (w.up && w.P.shieldAllies) {
    const dx = a.x - g.hero.x, dy = a.y - g.hero.y, R = w.P.radius * g.mods.area;
    if (dx * dx + dy * dy <= R * R) dmg *= 1 - w.P.shieldAllies;
  }
  if (a.kind !== 'general' && inAura(g, a)) dmg *= 1 - g.aura.guard;     // 黄飞虎 is near
  a.hp -= dmg; a.flash = .12;
  if (a.hp > 0) return;
  a.hp = 0;
  if (a.kind === 'general') {
    // a general withdraws and comes back: he is never lost
    a.state = 'away'; a.stateT = 0; a.awayT = GENERAL.away;
    if (a.storm) { a.storm.dead = true; a.storm = null; }
    g.events.push({type: 'generalFall', general: a.general, x: a.x, y: a.y, by});
    return;
  }
  a.state = 'dead'; a.stateT = 0; g.slotsDirty = true;
  g.events.push({type: 'allyFall', x: a.x, y: a.y, id: a.id, kind: a.kind, by});
}

export function wardBurst(g, blocked) {
  const h = g.hero, P = g.ward.P, R = P.radius * g.mods.area, e = g.ward.entry;
  g.events.push({type: 'cast', id: e.id, level: e.level, evolved: e.evolved, shape: 'ward', x: h.x, y: h.y, dir: 0, radius: R, blocked});
  const n = query(h.x, h.y, R, Qward);
  for (let i = 0; i < n; i++) hitFoe(g, Qward[i], P.dmg * g.mods.dmg, e.id, P, h.x, h.y, null, false);
}

/** Harm meant for the hero: the spring and the half second after a hit let it pass, then the ward, then a soldier of the ring. */
export function hurtHero(g, dmg, by, x, y, pattern = '') {
  const h = g.hero;
  if (h.safe > 0 || h.dashT > 0 || h.fallT > 0 || g.phase !== 'fight') return false;
  h.safe = HERO.safe;
  const w = g.ward;
  if (w.up) {
    w.up = false; w.t = w.P.cd;
    if (w.zone) { w.zone.dead = true; w.zone = null; }
    g.events.push({type: 'block', x: h.x, y: h.y, id: w.entry.id, by});
    wardBurst(g, true);
    if (w.P.mend) mend(g, w.P.mend);
    return false;
  }
  if (g.form && g.form.guard) {
    g.guardN++;
    if (g.guardN % g.form.guard === 0) {
      let best = null, bd = Infinity;
      for (const a of g.allies) {
        if (a.state === 'dead' || a.wade) continue;
        const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) {
        g.events.push({type: 'guard', x: best.x, y: best.y, id: best.id, by});
        hurtAlly(g, best, dmg, by);
        return false;
      }
    }
  }
  // the rage: past g.campaign.rageAt (SCHEDULE.late) every blow of the Shang is harder with each minute, whoever strikes it
  const past = (g.t - g.campaign.rageAt) / 60;
  const d = Math.min(HERO.blowCap * h.maxHp, Math.max(1, dmg * (past > 0 ? 1 + SCHEDULE.late.dmg * past * Math.max(1, past) : 1) - g.mods.armour));   // one blow takes at most HERO.blowCap of full health
  if (h.hp - d <= 0 && BUILD.saveHero && BUILD.saveHero(g)) return false;   // 袁洪's spoil, 八九玄功: stone instead of the fall
  h.hp -= d; h.flash = .15; h.hurtT = HERO.hurtTime;
  g.stats.taken[by] = (g.stats.taken[by] || 0) + d;
  g.events.push({type: 'hurt', x: h.x, y: h.y, dmg: d, by, fromX: x, fromY: y, pattern});   // `pattern`: the warned blow's id, '' for a body or a shot
  if (h.hp <= 0) fallNow(g, by);
  return true;
}

/** Add a shot. The schedule and the shapes use it; tests and stills may. */
export function addShot(g, kind, side, src, x, y, vx, vy, r, dmg, life) {
  const s = shotPool.pop() || {last: [0, 0, 0, 0, 0, 0, 0, 0]};
  s.id = g.nextId++; s.kind = kind; s.side = side; s.src = src; s.x = s.px = x; s.y = s.py = y; s.vx = vx; s.vy = vy;
  s.r = r; s.dmg = dmg; s.life = life; s.t = 0; s.dead = false; s.level = 0; s.evolved = false;
  s.pierce = 0; s.bounces = 0; s.hop = 0; s.returns = false; s.back = false; s.el = null; s.P = null; s.speed = Math.hypot(vx, vy);
  s.orbit = false; s.ring = 0; s.a0 = 0; s.li = 0; s.hitP = null; s.burst = null; s.mul = 1;
  for (let i = 0; i < 8; i++) s.last[i] = 0;
  g.shots.push(s);
  return s;
}
export function addZone(g, kind, side, src, x, y, r, life) {
  const z = zonePool.pop() || {};
  z.id = g.nextId++; z.kind = kind; z.side = side; z.src = src; z.shape = 'circle'; z.x = x; z.y = y; z.r = r;
  z.dir = 0; z.len = 0; z.w = 0; z.t = 0; z.life = life; z.dps = 0; z.slow = 0; z.dmg = 0; z.tick = 0; z.chase = 0; z.spin = 0;
  z.follow = false; z.hold = 0; z.level = 0; z.evolved = false; z.P = null; z.mul = 1; z.dead = false; z.el = null; z.unit = null; z.r0 = 0; z.angle = 0; z.pattern = ''; z.unitId = 0; z.great = false; z.gap = 0;
  g.zones.push(z);
  return z;
}
/** Add a pickup: 'spirit' (with a value), 'peach', 'lodestone' or 'chest'. Fallen foes use it; tests and stills may. */
export function addPickup(g, kind, x, y, value = 0) {
  if (kind === 'spirit' && g.pickups.length >= PICKUPS.cap) {
    // the field is full of it: this one joins another
    const o = g.pickups[g.nextId % g.pickups.length];
    if (o.kind === 'spirit' && !o.dead) { o.value += value; o.size = o.value >= PICKUPS.large ? 2 : o.value >= PICKUPS.mid ? 1 : 0; return o; }
  }
  const p = pickupPool.pop() || {};
  p.id = g.nextId++; p.kind = kind; p.x = p.px = clamp(x, WORLD.edge, WORLD.w - WORLD.edge); p.y = p.py = clamp(y, WORLD.edge, WORLD.h - WORLD.edge);
  p.value = value; p.size = kind !== 'spirit' ? 0 : value >= PICKUPS.large ? 2 : value >= PICKUPS.mid ? 1 : 0; p.pull = false; p.t = 0; p.dead = false;
  g.pickups.push(p);
  return p;
}

/** A blow that breaks off a named foe's warned pattern (邓婵玉's stone in his windup, B's `P.interrupt`): his marked ground clears. */
function interrupt(g, f) {
  for (const z of g.zones) if (z.side === 'shang' && !z.dead && z.src === f.kind && (z.kind === 'warn' || z.kind === 'lane')) z.dead = true;
  f.act = ''; f.actT = 0; f.summon = ''; setState(f, 'walk');
  g.events.push({type: 'interrupt', id: f.id, kind: f.kind, x: f.x, y: f.y});
}

/**
 * A shock (SPEC-CAMPAIGN.md 1.10): everything within `radius` of (x, y) is pushed straight outward, `strength` px at
 * the centre falling to nothing at the edge: foes of the mass (a heavy foe a quarter as far; a boss, his officers and
 * the routing not at all) and soldiers and generals on the ground. The hero only when `hero` is set (a boss's own
 * arrival), and never onto warned ground. Deterministic: no draw. Returns the measures the event carries.
 */
export function shock(g, x, y, radius, strength, hero = false) {
  const n = query(x, y, radius, Qward);
  for (let i = 0; i < n; i++) {
    const f = Qward[i];
    if (f.tier || f.flee || f.state === 'dead') continue;
    const d = Math.hypot(f.x - x, f.y - y), k = 1 - Math.min(1, d / radius);
    shove(f, x, y, strength * k * (f.heavy ? .25 : 1));
  }
  for (const a of g.allies) {
    if (a.state === 'dead' || a.state === 'away' || a.mvT > 0) continue;
    const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
    if (d >= radius) continue;
    const k = (1 - d / radius) * strength * .6, ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
    a.x = clamp(a.x + ux * k, WORLD.edge, WORLD.w - WORLD.edge); a.y = clamp(a.y + uy * k, WORLD.edge, WORLD.h - WORLD.edge);
  }
  const h = g.hero;
  if (hero && h.fallT <= 0 && h.dashT <= 0) {
    const dx = h.x - x, dy = h.y - y, d = Math.hypot(dx, dy);
    if (d < radius) {
      const k = (1 - d / radius) * strength * .5, ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
      const nx = clamp(h.x + ux * k, WORLD.edge, WORLD.w - WORLD.edge), ny = clamp(h.y + uy * k, WORLD.edge, WORLD.h - WORLD.edge);
      if (!g.zones.some(z => z.side === 'shang' && !z.dead && (z.kind === 'warn' || z.kind === 'lane') && inZone(z, nx, ny, HERO.r))) { h.x = nx; h.y = ny; }
    }
  }
  return {x, y, radius, strength};
}
