// A game: making one, and the order of a step. Owner: rules·campaign (A).

import {TICK, clamp, wrap, rand, buildGrid, query, Qaura, DW, CL, refreshDense, clusters, foePool, shotPool, zonePool, pickupPool, allyPool, inZone, compact} from './core.js';
import {give, openOffer, mend, payoff, stepOffer} from './build.js';
import {stepTreasures} from './shapes.js';
import {stepHero, stepContact} from './hero.js';
import {stepAllies} from './squads.js';
import {stepFoes} from './foes.js';
import {stepShots, stepZones, stepPickups} from './field.js';
import {stepSpawn, stepCampaign, makeCampaign, confine} from './campaign.js';
import * as BUILD from './build.js';
import {WORLD, STEP, HERO, OFFER, PAYOFF, SCHEDULE, xpNeed, CONTENT, TIERS} from '../content.js';

/**
 * A new game. options: {start: a treasure id the hero begins with (otherwise the run opens on an offer of three
 * treasures), bare: true for a hero who owns nothing and is offered nothing at the start, spawn: false for an
 * empty field (the last two for tests and stills)}.
 */
export function createGame(seed = 1, options = {}) {
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  const g = {
    seed, rs: seed >>> 0, t: 0, phase: 'fight', options,
    hero: {id: 0, kind: 'hero', x: cx, y: cy, px: cx, py: cy, vx: 0, vy: 0, facing: 1, dir: 0, head: 0,
      hp: HERO.hp, maxHp: HERO.hp, state: 'idle', stateT: 0, flash: 0, fullCry: false, dashCd: 0, level: 1, xp: 0,
      xpNext: xpNeed(1), safe: 0, rideT: 0, dashT: 0, dashX: 1, dashY: 0, hurtT: 0, fallT: 0, moving: false, course: 0, turn: 0, afoot: 0, held: 0, bleed: 0, dizzy: 0, dazzled: 0, weak: 0, weakT: 0, drag: 1, dragT: 0, boneCd: 0},
    build: {treasures: [], arts: [], troops: [], generals: [], formation: null, resonance: []},
    offer: null, rerolls: OFFER.rerolls, banishes: OFFER.banishes, banished: [],
    foes: [], allies: [], shots: [], pickups: [], zones: [], events: [],
    stats: {kills: 0, damage: {}, effects: {}, payoffs: [], taken: {}, time: 0, level: 1, picks: 0, chests: 0, spirit: 0, levelTimes: [], bosses: {}},
    mods: {dmg: 1, rate: 1, area: 1, dur: 1, speed: 1, spirit: 1, regen: 0, mend: 1, armour: 0, gather: HERO.gather, ride: 0, trample: 1, dashCd: 1},
    form: null, alive: 0, nextId: 1, markN: 0, dark: null, echo: null, holdT: 0, haste: 1, payoffDue: false, power: {}, mainEl: 'water', aura: null, chestOffer: false, guardN: 0, massA: 0, tickT: 0, slotsDirty: false, standN: 0,
    ward: {up: false, t: 0, zone: null},
    spawn: {acc: 0, t: 0, elite: 0, boss: 0, ring: 0, shamanAt: SCHEDULE.shamans.from, scoutAt: SCHEDULE.scouts.from, guardAt: 0, opened: false},
    lightTaken: {}, lightN: 0, tickN: 0,
    tier: options.tier || 0, tierK: TIERS[options.tier || 0] || TIERS[0], campaign: null,
    dense: {n: new Int16Array(DW * DW), sx: new Float32Array(DW * DW), sy: new Float32Array(DW * DW), ox: 0, oy: 0},
  };
  g.campaign = makeCampaign(g);
  if (BUILD.applyMeta) BUILD.applyMeta(g, options.meta);      // B's: the meta ranks and the weapon (SPEC-CAMPAIGN.md 1.6, 2.9)
  if (options.start) give(g, 'treasure', options.start);
  else if (!options.bare) {
    // the run opens on a choice of three treasures
    const pool = (BUILD.openingPool ? BUILD.openingPool(g) : CONTENT.treasures.filter(r => r.opening !== false)).map(r => ({kind: 'treasure', id: r.id, level: 1, isNew: true})), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
    g.offer = out; g.phase = 'offer';
    g.events.push({type: 'offer', offer: out, opening: true});
  }
  return g;
}

// ------------------------------------------------------------------------------------------- one step
export const NO_INPUT = {mx: 0, my: 0, dash: false, pick: null, reroll: false, banish: null};

/**
 * Advance the game by `dt`. input: {mx, my: -1..1, dash, pick: null | 0 | 1 | 2, reroll, banish: null | 0 | 1 | 2};
 * dash, pick, reroll and banish are edges (the page sends each once). While an offer is open the clock stands.
 */
export function step(g, input = NO_INPUT, dt = STEP) {
  if (g.phase === 'won' || g.phase === 'lost') return g;
  if (g.phase === 'offer') { stepOffer(g, input); return g; }
  g.t += dt;
  const h = g.hero;
  // the rage's other half: past a minute of it the Shang also come faster, until nobody can ride away from them
  if (g.payoffDue && g.t >= PAYOFF.from) { g.payoffDue = false; payoff(g, h.x, h.y, false); }
  const late = g.campaign.rageAt + 60;
  g.haste = g.t > late ? 1 + SCHEDULE.late.speed * (g.t - late) / 60 : 1;
  stepCampaign(g, dt, g.options.spawn !== false);
  if (g.options.spawn !== false) stepSpawn(g, dt);
  buildGrid(g);
  stepHero(g, input, dt);
  if (g.phase !== 'fight') return g;
  g.tickT -= dt;
  if (g.tickT <= 0) {
    g.tickT += TICK;
    refreshDense(g);
    // the side the mass is on, for the shields; and the slowing ground of the eight trigrams
    let want = h.head;
    if (clusters(g, h.x, h.y, 460, 1)) want = Math.atan2(CL[0].y - h.y, CL[0].x - h.x);
    g.massA = wrap(g.massA + clamp(wrap(want - g.massA), -.5, .5));
    const F = g.form;
    if (F && F.slow) {
      const n = query(h.x, h.y, F.field, Qaura);
      for (let i = 0; i < n; i++) { const f = Qaura[i]; f.slow = Math.max(f.slow, F.slow); f.slowT = TICK * 2; }
    }
  }
  if (h.fallT <= 0) stepTreasures(g, dt);
  if (g.allies.length) stepAllies(g, dt);
  g.tickN++;
  stepFoes(g, dt);
  confine(g);
  stepContact(g);
  stepShots(g, dt);
  stepZones(g, dt);
  stepPickups(g, dt);
  compact(g.foes, foePool); compact(g.shots, shotPool); compact(g.zones, zonePool); compact(g.pickups, pickupPool);
  if (g.allies.length) { const n = g.allies.length; compact(g.allies, allyPool); if (g.allies.length !== n) g.slotsDirty = true; }
  g.stats.time = g.t; g.stats.level = h.level;
  if (g.holdT > 0) g.holdT -= dt;
  if (g.phase === 'fight' && h.fallT <= 0 && h.xp >= h.xpNext && !underWarning(g)) {
    h.xp -= h.xpNext; h.level++; h.xpNext = xpNeed(h.level);
    g.stats.level = h.level; g.stats.levelTimes.push(g.t);
    g.events.push({type: 'levelUp', level: h.level, x: h.x, y: h.y});
    openOffer(g);
  }
  return g;
}

/** Is a warned blow of the Shang over the hero, or only just landed? A level's offer does not open on top of one. */
export function underWarning(g) {
  if (g.holdT > 0) return true;
  const h = g.hero;
  for (const z of g.zones) if (z.side === 'shang' && !z.dead && (z.kind === 'warn' || z.kind === 'lane') && inZone(z, h.x, h.y, HERO.r + 30)) return true;
  return false;
}

/** How many of what are on the field. */
export function counts(g) {
  let foes = 0, elites = 0, allies = 0;
  for (const f of g.foes) if (f.state !== 'dead') { foes++; if (f.elite) elites++; }
  for (const a of g.allies) if (a.state !== 'dead') allies++;
  return {foes, elites, allies, shots: g.shots.length, zones: g.zones.length, pickups: g.pickups.length};
}
