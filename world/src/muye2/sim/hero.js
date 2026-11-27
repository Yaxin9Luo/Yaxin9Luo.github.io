// The hero: riding, the spring, the full cry and the trample. Owner: rules·campaign (A).

import {KB, clamp, wrap, setState, query, Qhero} from './core.js';
import {hitFoe, hurtHero, fallNow} from './harm.js';
import {meritNow} from './campaign.js';
import * as BUILD from './build.js';
import {WORLD, HERO, CRY, BY, CAMPAIGN} from '../content.js';

export const BREACH = {eliteMult: 1};

export function stepHero(g, input, dt) {
  const h = g.hero, m = g.mods;
  h.px = h.x; h.py = h.y; h.stateT += dt;
  if (h.safe > 0) h.safe -= dt;
  if (h.dashCd > 0) h.dashCd = Math.max(0, h.dashCd - dt);
  if (h.hurtT > 0) h.hurtT -= dt;
  if (h.flash > 0) h.flash -= dt;
  if (h.afoot > 0) { h.afoot -= dt; if (h.afoot <= 0) { h.afoot = 0; g.events.push({type: 'remount', x: h.x, y: h.y}); } }
  // what the bosses of the later stretches do to him (SPEC-CAMPAIGN.md 1.11)
  if (h.dizzy > 0) h.dizzy -= dt;
  if (h.dazzled > 0) h.dazzled -= dt;
  if (h.boneCd > 0) h.boneCd -= dt;
  if (h.dragT > 0) h.dragT -= dt; else h.drag = 1;
  if (h.weakT > 0) h.weakT -= dt; else h.weak = 0;
  if (h.bleed > 0 && h.fallT <= 0) { h.hp -= h.bleed * dt; g.stats.taken.bleed = (g.stats.taken.bleed || 0) + h.bleed * dt; if (h.hp <= 0 && !(BUILD.saveHero && BUILD.saveHero(g))) fallNow(g, 'bleed'); }   // 袁洪's spoil catches a fatal bleed too
  if (h.held > 0 && h.fallT <= 0) {
    h.held -= dt; h.vx = 0; h.vy = 0; h.moving = false; h.rideT = 0; h.fullCry = false;
    if (h.held <= 0) { h.held = 0; g.events.push({type: 'freed', x: h.x, y: h.y}); }
    setState(h, 'held');
    return;
  }
  if (h.fallT > 0) {
    // the riderless horse runs on and slows
    h.vx *= 1 - Math.min(1, 3 * dt); h.vy *= 1 - Math.min(1, 3 * dt);
    h.x = clamp(h.x + h.vx * dt, WORLD.edge, WORLD.w - WORLD.edge); h.y = clamp(h.y + h.vy * dt, WORLD.edge, WORLD.h - WORLD.edge);
    h.fallT -= dt; h.moving = false;
    if (h.fallT <= 0) { g.phase = 'lost'; g.stats.time = g.t; g.events.push({type: 'lost', x: h.x, y: h.y, t: g.t, merit: meritNow(g)}); }
    return;
  }
  let mx = +input.mx || 0, my = +input.my || 0, mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
  const moving = mag > .3, was = h.fullCry;
  if (input.dash && h.dashCd <= 0 && h.dashT <= 0 && h.afoot <= 0 && h.dizzy <= 0) {
    const a = moving ? Math.atan2(my, mx) : h.head;
    h.dashX = Math.cos(a); h.dashY = Math.sin(a); h.dashT = HERO.dashTime; h.dashCd = HERO.dashCd * (g.mods.dashCd || 1); h.head = a;
    g.events.push({type: 'dash', x: h.x, y: h.y, dir: a});
  }
  let step = dt;
  if (h.dashT > 0) {
    // Jiliang's spring: through everything, and nothing can touch him
    const v = HERO.dash / HERO.dashTime;
    step = Math.min(dt, h.dashT);
    h.vx = h.dashX * v; h.vy = h.dashY * v;
    h.dashT -= dt; if (h.dashT < 1e-9) h.dashT = 0;
    h.rideT = Math.min(h.rideT + dt, CRY.after + CRY.reserve + m.ride);
  } else if (moving) {
    const a = Math.atan2(my, mx), d = wrap(a - h.head);
    if (Math.abs(d) > HERO.sharp) { h.rideT = 0; h.head = a; }       // a sharp turn: the horse breaks its stride
    else h.head = wrap(h.head + clamp(d, -HERO.turn * dt, HERO.turn * dt));
    h.rideT = h.afoot > 0 ? 0 : Math.min(h.rideT + dt, CRY.after + CRY.reserve + m.ride);      // on foot: no full cry
    const v = HERO.speed * m.speed * (h.afoot > 0 ? HERO.afoot : 1) * h.drag * (h.rideT >= CRY.after ? CRY.speed : 1) * mag;
    h.vx = mx / mag * v; h.vy = my / mag * v;
    // how fast his course is turning (rad/s, smoothed): a foe who aims where he is going reads it
    h.turn += (clamp(wrap(a - h.course) / dt, -4, 4) - h.turn) * Math.min(1, dt * 5); h.course = a;
  } else { h.rideT = 0; h.vx = 0; h.vy = 0; h.turn = 0; }
  h.fullCry = h.rideT >= CRY.after;
  if (h.fullCry !== was) g.events.push({type: h.fullCry ? 'cry' : 'cryEnd', x: h.x, y: h.y});
  h.x = clamp(h.x + h.vx * step, WORLD.edge, WORLD.w - WORLD.edge); h.y = clamp(h.y + h.vy * step, WORLD.edge, WORLD.h - WORLD.edge);
  h.moving = moving || h.dashT > 0;
  h.dir = h.head;
  if (Math.abs(h.vx) > 1) h.facing = h.vx > 0 ? 1 : -1;
  if (m.regen && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + m.regen * dt);
  setState(h, h.dashT > 0 ? 'dash' : h.hurtT > 0 ? 'hurt' : h.afoot > 0 ? 'afoot' : h.moving ? 'ride' : 'idle');
}

/** Bodies that meet the hero: in full cry he tramples them, otherwise (or when one cannot be trampled again yet) they hurt him. */
export function stepContact(g) {
  const h = g.hero;
  if (h.dashT > 0 || h.fallT > 0) return;
  const n = query(h.x, h.y, HERO.r, Qhero);
  for (let i = 0; i < n; i++) {
    const f = Qhero[i];
    if (f.state === 'dead' || f.flee) continue;
    if (h.fullCry && f.tcd <= 0) {
      const sp = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / sp, uy = h.vy / sp;
      const side = (f.x - h.x) * -uy + (f.y - h.y) * ux >= 0 ? 1 : -1;
      const dmg = (CRY.dmg + CRY.perLevel * h.level) * g.mods.dmg * g.mods.trample * (g.form && g.form.moving ? 1 + g.form.moving : 1);
      f.tcd = CRY.again;
      g.events.push({type: 'trample', x: f.x, y: f.y, target: f.id, dir: h.head});
      if (!f.heavy) { f.stun = Math.max(f.stun, CRY.stun); f.kx += -uy * side * CRY.aside * KB; f.ky += ux * side * CRY.aside * KB; }
      BREACH.eliteMult = g.form && g.form.breach || 1;       // the arrowhead: the trample breaks chariots and named foes
      hitFoe(g, f, dmg, 'trample', BREACH, h.x, h.y, null, false);
      if (f.state === 'dead') continue;                    // ridden down and killed: the stride is not broken
      h.rideT -= CRY.cost * (f.heavy ? 3 : 1);
      if (h.rideT < CRY.after) { h.fullCry = false; h.rideT = 0; g.events.push({type: 'cryEnd', x: h.x, y: h.y}); }   // the mass was too thick: the stride is lost
      if (!f.heavy) continue;
    }
    if (f.stun > 0 && !f.heavy) continue;
    if (f.under || f.gone || f.melee) continue;                     // the foot mass swings instead (foes.js)
    if (f.duelFoe && f.act !== 'charge') continue;                   // a duel's boss strikes by his patterns, not by touch (1.17)
    const brushed = !!f.tier && f.act !== 'charge';                  // a named foe's brush (1.17): a quarter of his blow, then a grace
    if (brushed && g.t - f.touchAt < CAMPAIGN.touch.grace) continue;
    const struck = hurtHero(g, f.act === 'charge' ? f.cdmg : brushed ? f.dmg * CAMPAIGN.touch.brush : f.dmg, f.kind, f.x, f.y, f.act === 'charge' ? f.pat : '');
    if (struck && brushed) f.touchAt = g.t;
    const row = BY.foe[f.kind];
    if (struck && row.hook && f.hookCd <= 0 && h.held <= 0) { f.hookCd = row.hook.every; h.held = row.hook.hold; g.events.push({type: 'held', time: row.hook.hold, by: f.kind, how: 'hook', x: h.x, y: h.y}); }
  }
}

/** 张桂芳's call or 纣王's shout has struck: the hero is off his horse for `time` s (SPEC-CAMPAIGN.md 1.5). */
export function unhorse(g, time, by) {
  const h = g.hero;
  if (h.fallT > 0) return;
  if (h.afoot <= 0) g.events.push({type: 'unhorsed', time, by, x: h.x, y: h.y});
  h.afoot = Math.max(h.afoot, time);
  if (h.fullCry) { h.fullCry = false; g.events.push({type: 'cryEnd', x: h.x, y: h.y}); }
  h.rideT = 0;
}
