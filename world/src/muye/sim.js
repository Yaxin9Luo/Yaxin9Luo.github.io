// Muye as a survivors-like: the rules. Pure state and rules, no DOM.
// Contract: lab/game-studies/SPEC-SURVIVORS.md sections 1 to 4 and the "Changes" at its bottom. The tables are in
// content.js; this file is the engine that reads them. The page feeds one input per fixed step and empties
// `events`. Everything random comes from the seeded generator in the game state (`rs`), so the same seed and the
// same inputs replay the same battle.
//
// World: a plane WORLD.w by WORLD.h, x to the right and y down, distances in px, times in seconds, angles in
// radians from +x toward +y. The hero only moves; everything he owns acts by itself.

import {
  WORLD, STEP, HERO, CRY, ALLY, SLOTS, MAX, OFFER, ELEMENTS, RESONANCE, TRIGRAMS, RIDER, SCHEDULE, SPAWN, PICKUPS,
  xpNeed, CONTENT, BY, LIST, fedBy, RANKS, rankOf, GENERAL, PAYOFF,
} from './content.js';
export * from './content.js';

const TAU = Math.PI * 2;
const KB = 8;                       // a shove is a speed that dies away at 8 a second: this many times the distance gives that distance
const DEAD = .6;                    // the dead stay this long as `dead`
const TICK = .25;                   // burning, fields and auras act this often
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const setState = (u, s) => { if (u.state !== s) { u.state = s; u.stateT = 0; } };

function rand(g) {
  const a = g.rs = (g.rs + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------------------- the spatial grid
// Rebuilt from the living foes at the start of every step, so it holds nothing between steps.
const CELL = 64, GW = Math.ceil(WORLD.w / CELL), GH = Math.ceil(WORLD.h / CELL), NC = GW * GH, MAXR = 40;
const cellStart = new Int32Array(NC + 1), cellFill = new Int32Array(NC);
const gridItems = [];
const cellOf = (x, y) => clamp(x / CELL | 0, 0, GW - 1) + clamp(y / CELL | 0, 0, GH - 1) * GW;

function buildGrid(g) {
  cellStart.fill(0);
  const foes = g.foes;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f.state === 'dead') continue;
    f.cell = cellOf(f.x, f.y);
    cellStart[f.cell + 1]++;
  }
  for (let i = 0; i < NC; i++) cellStart[i + 1] += cellStart[i];
  cellFill.set(cellStart.subarray(0, NC));
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f.state !== 'dead') gridItems[cellFill[f.cell]++] = f;
  }
}
/** The living foes whose bodies reach into the circle, into `out`; returns how many. */
function query(x, y, r, out) {
  const R = r + MAXR;
  const x0 = clamp((x - R) / CELL | 0, 0, GW - 1), x1 = clamp((x + R) / CELL | 0, 0, GW - 1);
  const y0 = clamp((y - R) / CELL | 0, 0, GH - 1), y1 = clamp((y + R) / CELL | 0, 0, GH - 1);
  let n = 0;
  for (let cy = y0; cy <= y1; cy++) {
    const base = cy * GW;
    for (let k = cellStart[base + x0], end = cellStart[base + x1 + 1]; k < end; k++) {
      const f = gridItems[k];
      if (f.state === 'dead') continue;
      const dx = f.x - x, dy = f.y - y, rr = r + f.r;
      if (dx * dx + dy * dy <= rr * rr) out[n++] = f;
    }
  }
  return n;
}
/** As `query`, for a lane from (x, y) along `dir`, `len` long and `w` wide. */
function queryLane(x, y, dir, len, w, out) {
  const c = Math.cos(dir), s = Math.sin(dir);
  const n = query(x + c * len / 2, y + s * len / 2, len / 2 + w / 2, out);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const f = out[i], dx = f.x - x, dy = f.y - y, along = dx * c + dy * s, off = Math.abs(dy * c - dx * s);
    if (along >= -f.r && along <= len + f.r && off <= w / 2 + f.r) out[m++] = f;
  }
  return m;
}
const Qpick = [], Qnear = [], Qhit = [], Qshot = [], Qhop = [], Qally = [], Qward = [], Qhero = [], Qzone = [], Qaura = [], Qwade = [];
const PICKED = [], DIRS = [];

function nearestFoe(x, y, range) {
  const n = query(x, y, range, Qnear);
  let best = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const f = Qnear[i], dx = f.x - x, dy = f.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
/** Up to `count` of the nearest foes, no two within `sep` radians of one another as seen from (x, y), into PICKED. */
function pickNearest(x, y, range, count, sep) {
  const n = query(x, y, range, Qpick), cs = Math.cos(sep);
  let m = 0;
  while (m < count) {
    let best = null, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const f = Qpick[i], dx = f.x - x, dy = f.y - y, d2 = dx * dx + dy * dy;
      if (d2 >= bd) continue;
      const d = Math.sqrt(d2) || 1;
      let ok = true;
      for (let j = 0; j < m && ok; j++) {
        const p = PICKED[j];
        if (p === f) { ok = false; break; }
        const px = p.x - x, py = p.y - y, pd = Math.hypot(px, py) || 1;
        if (sep > 0 && (dx * px + dy * py) / (d * pd) > cs) ok = false;
      }
      if (ok) { bd = d2; best = f; }
    }
    if (!best) break;
    PICKED[m++] = best;
  }
  return m;
}

// ------------------------------------------------------------------------------------------- where the mass is
// A coarse count of the foes round the hero, refreshed four times a second: the densest groups are where domes,
// seals and volleys fall, and its heaviest side is where the shields turn.
const DW = 13, DCELL = 120, DHALF = DW * DCELL / 2, ELITE_WEIGHT = 6;
const CL = Array.from({length: 12}, () => ({x: 0, y: 0, n: 0}));

function refreshDense(g) {
  const d = g.dense, h = g.hero, n = d.n, sx = d.sx, sy = d.sy;
  n.fill(0); sx.fill(0); sy.fill(0);
  d.ox = h.x - DHALF; d.oy = h.y - DHALF;
  for (let i = 0; i < g.foes.length; i++) {
    const f = g.foes[i];
    if (f.state === 'dead') continue;
    const cx = (f.x - d.ox) / DCELL | 0, cy = (f.y - d.oy) / DCELL | 0;
    if (cx < 0 || cy < 0 || cx >= DW || cy >= DW || f.x < d.ox || f.y < d.oy) continue;
    const c = cx + cy * DW, w = f.elite ? ELITE_WEIGHT : 1;         // a chariot or a leader counts as a group by itself
    n[c] += w; sx[c] += (f.x - d.ox) * w; sy[c] += (f.y - d.oy) * w;
  }
}
/** The `k` densest groups within `range` of (x, y), densest first, into CL; returns how many. */
function clusters(g, x, y, range, k) {
  const d = g.dense, n = d.n;
  let m = 0;
  while (m < k) {
    let best = -1, bn = 0;
    for (let c = 0; c < DW * DW; c++) {
      if (n[c] <= bn) continue;
      const px = d.ox + d.sx[c] / n[c] - x, py = d.oy + d.sy[c] / n[c] - y;
      if (px * px + py * py > range * range) continue;
      bn = n[c]; best = c;
    }
    if (best < 0) break;
    const o = CL[m++];
    o.x = d.ox + d.sx[best] / bn; o.y = d.oy + d.sy[best] / bn; o.n = bn; o.c = best;
    n[best] = -bn;                                     // taken: put back below
  }
  for (let i = 0; i < m; i++) n[CL[i].c] = CL[i].n;
  return m;
}

// ------------------------------------------------------------------------------------------- making a game
const foePool = [], shotPool = [], zonePool = [], pickupPool = [], allyPool = [];

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
      xpNext: xpNeed(1), safe: 0, rideT: 0, dashT: 0, dashX: 1, dashY: 0, hurtT: 0, fallT: 0, moving: false, course: 0, turn: 0},
    build: {treasures: [], arts: [], troops: [], generals: [], formation: null, resonance: []},
    offer: null, rerolls: OFFER.rerolls, banishes: OFFER.banishes, banished: [],
    foes: [], allies: [], shots: [], pickups: [], zones: [], events: [],
    stats: {kills: 0, damage: {}, effects: {}, payoffs: [], taken: {}, time: 0, level: 1, picks: 0, chests: 0, spirit: 0, levelTimes: []},
    mods: {dmg: 1, rate: 1, area: 1, dur: 1, speed: 1, spirit: 1, regen: 0, mend: 1, armour: 0, gather: HERO.gather, ride: 0, trample: 1},
    form: null, alive: 0, nextId: 1, markN: 0, dark: null, echo: null, holdT: 0, haste: 1, payoffDue: false, power: {}, mainEl: 'water', aura: null, chestOffer: false, guardN: 0, massA: 0, tickT: 0, slotsDirty: false, standN: 0,
    ward: {up: false, t: 0, zone: null},
    spawn: {acc: 0, t: 0, elite: 0, boss: 0, ring: 0, shamanAt: SCHEDULE.shamans.from, scoutAt: SCHEDULE.scouts.from, opened: false},
    dense: {n: new Int16Array(DW * DW), sx: new Float32Array(DW * DW), sy: new Float32Array(DW * DW), ox: 0, oy: 0},
  };
  if (options.start) give(g, 'treasure', options.start);
  else if (!options.bare) {
    // the run opens on a choice of three treasures
    const pool = CONTENT.treasures.filter(r => r.opening !== false).map(r => ({kind: 'treasure', id: r.id, level: 1, isNew: true})), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
    g.offer = out; g.phase = 'offer';
    g.events.push({type: 'offer', offer: out, opening: true});
  }
  return g;
}

// ------------------------------------------------------------------------------------------- the build
const owned = (g, kind) => kind === 'treasure' ? g.build.treasures : kind === 'art' ? g.build.arts : kind === 'general' ? g.build.generals : g.build.troops;
const keyOf = o => o.kind + ':' + o.id;

/** Everything the build's arts, resonances and formation come to, and what follows from a change of the build. */
function recompute(g) {
  const b = g.build, sum = {dmg: 0, rate: 0, area: 0, dur: 0, speed: 0, spirit: 0, regen: 0, mend: 0, armour: 0, gather: 0, hp: 0, ride: 0, trample: 0};
  for (const a of b.arts) { const gv = BY.art[a.id].gives; for (const k in gv) sum[k] += gv[k] * a.level; }
  const count = {};
  for (const e of b.treasures) count[BY.treasure[e.id].element] = (count[BY.treasure[e.id].element] || 0) + 1;
  for (const e of b.arts) count[BY.art[e.id].element] = (count[BY.art[e.id].element] || 0) + 1;
  for (const e of b.troops) count[BY.troop[e.id].element] = (count[BY.troop[e.id].element] || 0) + 1;
  const res = Object.keys(ELEMENTS).filter(e => (count[e] || 0) >= RESONANCE.need);
  for (const e of res) {
    if (!b.resonance.includes(e)) g.events.push({type: 'resonance', element: e, x: g.hero.x, y: g.hero.y});
    for (const k in RESONANCE[e]) if (k !== 'text') sum[k] += RESONANCE[e][k];
  }
  b.resonance = res;
  // the element the build has most of (the acolytes' spell takes it): the first of the five on a tie
  g.mainEl = Object.keys(ELEMENTS).reduce((best, e) => (count[e] || 0) > (count[best] || 0) ? e : best, 'water');
  const m = g.mods, h = g.hero;
  m.dmg = 1 + sum.dmg; m.rate = 1 + sum.rate; m.area = 1 + sum.area; m.dur = 1 + sum.dur; m.speed = 1 + sum.speed;
  m.spirit = 1 + sum.spirit; m.regen = sum.regen; m.mend = 1 + sum.mend; m.armour = sum.armour; m.gather = HERO.gather + sum.gather; m.ride = sum.ride; m.trample = 1 + sum.trample;
  for (const t of b.treasures) g.power[t.id] = t.evolved ? PAYOFF.evolve : 1;
  for (const t of b.troops) g.power[t.id] = t.blessed ? PAYOFF.blessed : 1;
  const maxHp = HERO.hp + sum.hp;
  if (maxHp > h.maxHp) h.hp += maxHp - h.maxHp;
  h.maxHp = maxHp; if (h.hp > maxHp) h.hp = maxHp;
  g.form = b.formation ? BY.formation[b.formation.id].at[b.formation.level] : null;
  syncSquads(g, true);
  syncGenerals(g);
  rebuildOrbits(g);
  if (!b.treasures.some(e => BY.treasure[e.id].shape === 'ward') && g.ward.zone) { g.ward.zone.dead = true; g.ward.zone = null; g.ward.up = false; }
}

/**
 * Put a thing into the build, or raise the one owned by a level (or to `level`). `evolved` makes a treasure its
 * evolved form at once. Used by picks and chests, and by tests and stills. Returns the build's entry.
 */
export function give(g, kind, id, level, evolved = false) {
  if (!BY[kind] || !BY[kind][id]) throw new Error(`no ${kind} ${id}`);
  const b = g.build;
  let e;
  if (kind === 'formation') {
    if (b.formation && b.formation.id === id) b.formation.level = Math.min(MAX.formation, level || b.formation.level + 1);
    else b.formation = {id, level: level || 1};
    e = b.formation;
  } else {
    const list = owned(g, kind);
    e = list.find(x => x.id === id);
    if (e) e.level = Math.min(MAX[kind], level || e.level + 1);
    else {
      e = kind === 'treasure' ? {id, level: level || 1, evolved: false, cd: .4}
        : kind === 'troop' ? {id, level: level || 1, rank: 1, blessed: false, cd: 1, musterT: 0, skillCd: 2}
        : kind === 'general' ? {id, level: level || 1, trueForm: false, skillCd: 2}
        : {id, level: level || 1};
      list.push(e);
      if (kind === 'general') g.events.push({type: 'summon', general: id, x: g.hero.x, y: g.hero.y});
    }
    if (kind === 'treasure' && evolved) { e.level = MAX.treasure; e.evolved = true; }
    if (kind === 'general' && evolved) { e.level = MAX.general; e.trueForm = true; }
    if (kind === 'troop') {
      // `evolved` makes the squad a blessed host at once (tests and stills); a rank is a change of the men
      if (evolved) { e.level = MAX.troop; e.blessed = true; }
      const rank = rankOf(e.level, e.blessed);
      if (rank !== e.rank) { e.rank = rank; g.events.push({type: 'rankUp', troop: id, rank, level: e.level, x: g.hero.x, y: g.hero.y}); }
    }
  }
  recompute(g);
  return e;
}
const paramsOf = e => BY.treasure[e.id].at[e.evolved ? MAX.treasure + 1 : e.level];

/** Can this treasure evolve now: level 6, not yet evolved, and an art of the element that feeds its own is owned. */
export function canEvolve(g, e) {
  const row = BY.treasure[e.id];
  if (e.evolved || e.level < MAX.treasure || !row.evolved) return false;
  const need = fedBy(row.element);
  return g.build.arts.some(a => BY.art[a.id].element === need);
}
/** Can this squad become a blessed host now: level 8, not yet blessed, and its kind's patron general owned. */
export function canBless(g, e) {
  return !e.blessed && e.level >= MAX.troop && g.build.generals.some(x => x.id === BY.troop[e.id].patron);
}

function candidates(g, shown, chest = false) {
  const b = g.build, cont = [], fresh = [], swap = [];
  const barred = o => g.banished.includes(keyOf(o)) || (shown && shown.some(s => keyOf(s) === keyOf(o)));
  for (const kind of ['treasure', 'art', 'troop', 'general']) {
    const list = owned(g, kind);
    if (kind === 'general' && g.hero.level < OFFER.generalFrom && !chest) continue;
    for (const e of list) if (e.level < MAX[kind]) { const o = {kind, id: e.id, level: e.level + 1, isNew: false}; if (!barred(o)) cont.push(o); }
    if (list.length < SLOTS[kind]) for (const row of LIST[kind]) if (!list.some(e => e.id === row.id)) { const o = {kind, id: row.id, level: 1, isNew: true}; if (!barred(o)) fresh.push(o); }
  }
  for (const row of CONTENT.formations) {
    const cur = b.formation && b.formation.id === row.id;
    if (cur && b.formation.level >= MAX.formation) continue;
    const o = cur ? {kind: 'formation', id: row.id, level: b.formation.level + 1, isNew: false} : {kind: 'formation', id: row.id, level: 1, isNew: true};
    if (barred(o)) continue;
    (cur ? cont : b.formation ? swap : fresh).push(o);
  }
  // What would unlock a payoff the build is waiting for: the art that feeds a treasure at its top level, the patron
  // of a squad that is nearing its last rank. Such a slip says so (`unlocks`), and an offer always holds one.
  const unlock = [];
  for (const t of b.treasures) {
    const row = BY.treasure[t.id], need = fedBy(row.element);
    if (t.evolved || t.level < MAX.treasure - 1 || b.arts.some(a => BY.art[a.id].element === need)) continue;
    for (const o of fresh) if (o.kind === 'art' && BY.art[o.id].element === need && !o.unlocks) { o.unlocks = {kind: 'evolve', id: t.id, into: row.evolved.id}; unlock.push(o); }
  }
  for (const t of b.troops) {
    const row = BY.troop[t.id];
    if (t.blessed || t.level < MAX.troop - 2 || b.generals.some(e => e.id === row.patron) || b.generals.length >= SLOTS.general) continue;
    let o = fresh.find(x => x.kind === 'general' && x.id === row.patron);
    if (!o && !chest) { o = {kind: 'general', id: row.patron, level: 1, isNew: true}; if (barred(o)) continue; fresh.push(o); }   // offered whatever the hero's level
    if (o && !o.unlocks) { o.unlocks = {kind: 'bless', id: t.id, into: row.blessed.id}; unlock.push(o); }
  }
  // The level that completes a payoff: a treasure's last with its art owned, a squad's last with its patron owned,
  // a general's last.
  for (const o of cont) {
    if (o.level !== MAX[o.kind]) continue;
    if (o.kind === 'treasure' && BY.treasure[o.id].evolved && b.arts.some(a => BY.art[a.id].element === fedBy(BY.treasure[o.id].element))) o.unlocks = {kind: 'evolve', id: o.id, into: BY.treasure[o.id].evolved.id};
    else if (o.kind === 'troop' && b.generals.some(e => e.id === BY.troop[o.id].patron)) o.unlocks = {kind: 'bless', id: o.id, into: BY.troop[o.id].blessed.id};
    else if (o.kind === 'general') o.unlocks = {kind: 'trueForm', id: o.id, into: BY.general[o.id].trueForm.id};
    if (o.unlocks) unlock.push(o);
  }
  return {cont, fresh, swap, unlock};
}
/** One of the list by weight, taken out of it. What is owned weighs more the further along it is. */
function draw(g, list) {
  const w = o => OFFER.weight[o.kind] * (o.isNew ? 1 : 1 + OFFER.depth * (o.level - 2));
  let total = 0;
  for (const o of list) total += w(o);
  let pick = rand(g) * total;
  for (let i = 0; i < list.length; i++) if ((pick -= w(list[i])) < 0) return list.splice(i, 1)[0];
  return list.pop();
}
const MEND = {kind: 'mend', id: 'peach', level: 0, isNew: false};
/** Three gifts from what can still be taken: one continues something owned, one is new while a slot is free. */
function makeOffer(g) {
  const {cont, fresh, swap, unlock} = candidates(g, null), out = [];
  if (unlock.length) { const o = draw(g, unlock), from = o.isNew ? fresh : cont; from.splice(from.indexOf(o), 1); out.push(o); }   // the way to a payoff is always on offer
  else {                                                  // else what the player has taken furthest is: the next level of it
    let top = null, far = OFFER.lead;
    for (const o of cont) if (o.kind !== 'art' && o.kind !== 'formation' && (o.level - 1) / MAX[o.kind] > far) { far = (o.level - 1) / MAX[o.kind]; top = o; }
    if (top) { cont.splice(cont.indexOf(top), 1); out.push(top); }
  }
  if (cont.length && !out.some(o => !o.isNew)) out.push(draw(g, cont));
  if (fresh.length && !out.some(o => o.isNew)) out.push(draw(g, fresh));
  const rest = [...cont, ...fresh, ...swap];
  while (out.length < 3 && rest.length) out.push(draw(g, rest));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
  if (!out.length) out.push({...MEND});
  return out;
}
function openOffer(g) {
  g.offer = makeOffer(g); g.phase = 'offer';
  g.events.push({type: 'offer', offer: g.offer});
}
function mend(g, v) { const h = g.hero; h.hp = Math.min(h.maxHp, h.hp + v); }

function takeGift(g, o, from) {
  if (o.kind === 'mend') mend(g, OFFER.mend);
  else give(g, o.kind, o.id);
  g.stats.picks += from === 'offer' ? 1 : 0;
  g.events.push({type: 'take', kind: o.kind, id: o.id, level: o.level, isNew: o.isNew, from, x: g.hero.x, y: g.hero.y});
  // the first payoff of a run needs no chest: it happens the moment it is ready
  if (!g.stats.payoffs.length) payoff(g, g.hero.x, g.hero.y, false);
}

/**
 * The payoffs: a treasure evolves, a squad becomes a blessed host, a general shows his true form. Does the first one
 * that is ready, in that order, and reports it; returns false when none is.
 */
function payoff(g, x, y, chest, announce = chest) {
  // none before PAYOFF.from: one that is ready earlier waits, and comes by itself when the time does
  if (g.t < PAYOFF.from && !g.options.bare) { g.payoffDue = true; return false; }
  const first = !g.stats.payoffs.length;
  const e = g.build.treasures.find(t => canEvolve(g, t));
  if (e) {
    e.evolved = true; e.cd = .2;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'evolve', id: e.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'evolve', id: e.id});
    g.events.push({type: 'evolve', id: e.id, into: BY.treasure[e.id].evolved.id, x, y, first, chest});
    return true;
  }
  const squad = g.build.troops.find(t => canBless(g, t));
  if (squad) {
    squad.blessed = true; squad.rank = 5; squad.skillCd = 1;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'blessed', id: squad.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'blessed', id: squad.id});
    g.events.push({type: 'rankUp', troop: squad.id, rank: 5, level: squad.level, x, y});
    g.events.push({type: 'blessed', troop: squad.id, patron: BY.troop[squad.id].patron, into: BY.troop[squad.id].blessed.id, x, y, first, chest});
    return true;
  }
  const gen = g.build.generals.find(t => t.level >= MAX.general && !t.trueForm);
  if (gen) {
    gen.trueForm = true; gen.skillCd = 1;
    recompute(g);
    const u = g.allies.find(a => a.kind === 'general' && a.general === gen.id);
    g.stats.payoffs.push({t: g.t, kind: 'trueForm', id: gen.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'trueForm', id: gen.id});
    g.events.push({type: 'trueForm', general: gen.id, id: BY.general[gen.id].trueForm.id, x: u ? u.x : x, y: u ? u.y : y, first, chest});
    return true;
  }
  return false;
}

/**
 * A chest evolves a treasure if one can evolve; otherwise it blesses a squad that can be blessed; otherwise it
 * shows a general's true form; otherwise it gives a level to something owned; otherwise it mends. The chest of the
 * named foe of 5:00 (`named`) offers three generals instead while a general's place is free.
 */
function openChest(g, x, y, named) {
  g.stats.chests++;
  if (named && g.build.generals.length < SLOTS.general) {
    const pool = CONTENT.generals.filter(r => !g.build.generals.some(e => e.id === r.id) && !g.banished.includes('general:' + r.id)).map(r => ({kind: 'general', id: r.id, level: 1, isNew: true})), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
    if (out.length) {
      g.events.push({type: 'chest', x, y, gave: 'generals', id: null});
      g.offer = out; g.phase = 'offer'; g.chestOffer = true;
      g.events.push({type: 'offer', offer: out, chest: true});
      return;
    }
  }
  if (payoff(g, x, y, true)) return;                      // a payoff that is ready always comes first
  // otherwise it carries the build toward its next payoff: what unlocks one if anything does, else a level for
  // the treasure, squad or general that is furthest along
  const {cont, unlock} = candidates(g, null, true);
  let o = null;
  if (unlock.length) o = unlock[Math.floor(rand(g) * unlock.length)];
  else {
    // only what the player has himself taken most of the way: within `OFFER.chestNear` levels of its top
    let top = 0;
    for (const c of cont) {
      if (c.kind === 'art' || c.kind === 'formation' || (g.stats.payoffs.length && c.level <= MAX[c.kind] - OFFER.chestNear)) continue;   // until the run's first payoff: whatever is furthest along
      const far = c.level / MAX[c.kind] + rand(g) * .01;
      if (far > top) { top = far; o = c; }
    }
    if (!o) o = cont.length ? cont[Math.floor(rand(g) * cont.length)] : {...MEND};
  }
  g.events.push({type: 'chest', x, y, gave: o.kind, id: o.id});
  const had = g.stats.payoffs.length;
  takeGift(g, o, 'chest');
  if (g.stats.payoffs.length === had) payoff(g, x, y, true, false);   // and if its level completed something, the same chest does that too
}

function stepOffer(g, input) {
  const offer = g.offer;
  if (input.reroll && g.rerolls > 0 && !g.chestOffer) {
    g.rerolls--;
    if (g.t === 0 && !g.build.treasures.length) {
      const pool = CONTENT.treasures.filter(r => r.opening !== false).map(r => ({kind: 'treasure', id: r.id, level: 1, isNew: true})), out = [];
      while (out.length < 3) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
      g.offer = out;
    } else g.offer = makeOffer(g);
    g.events.push({type: 'offer', offer: g.offer, rerolled: true});
    return;
  }
  const b = input.banish;
  if (b !== null && b !== undefined && offer[b] && g.banishes > 0 && offer[b].kind !== 'mend' && g.build.treasures.length && !g.chestOffer) {
    g.banishes--;
    g.banished.push(keyOf(offer[b]));
    const {cont, fresh, swap} = candidates(g, offer), rest = [...cont, ...fresh, ...swap];
    for (const o of rest) delete o.unlocks;
    if (rest.length) offer[b] = draw(g, rest); else offer.splice(b, 1);
    if (!offer.length) offer.push({...MEND});
    g.events.push({type: 'offer', offer, banished: true});
    return;
  }
  const p = input.pick;
  if (p !== null && p !== undefined && offer[p]) {
    const from = g.chestOffer ? 'chest' : 'offer';
    g.offer = null; g.phase = 'fight'; g.chestOffer = false;
    takeGift(g, offer[p], from);
  }
}

// ------------------------------------------------------------------------------------------- units
/**
 * Add a foe of a kind in CONTENT.foes. Its health and damage are those of the kind at the game's time (the mass
 * grows by the minute; a boss does not). Used by the schedule, and by tests and stills.
 */
export function addFoe(g, kind, x, y) {
  const row = BY.foe[kind];
  if (!row) throw new Error(`no foe ${kind}`);
  const f = foePool.pop() || {};
  const grow = row.boss ? 1 : spawnPlan(g.t, PLAN).hp;
  f.id = g.nextId++; f.kind = kind; f.x = f.px = clamp(x, 0, WORLD.w); f.y = f.py = clamp(y, 0, WORLD.h);
  f.vx = 0; f.vy = 0; f.facing = g.hero.x >= x ? 1 : -1; f.dir = 0;
  f.hp = f.maxHp = Math.round(row.hp * grow); f.state = 'walk'; f.stateT = 0; f.flash = 0; f.elite = !!row.elite;
  f.r = row.r; f.speed = row.speed; f.dmg = row.dmg * (1 + SCHEDULE.dmg * g.t / 60) * (g.t < SCHEDULE.early.until ? SCHEDULE.early.dmg + (1 - SCHEDULE.early.dmg) * g.t / SCHEDULE.early.until : 1); f.armour = (row.armour || 0) + (row.boss ? 0 : PLAN.armour); f.heavy = !!row.heavy;
  f.cd = row.between ? row.between * (.3 + .7 * rand(g)) : 0; f.hitCd = 0; f.tcd = 0; f.oh = 0; f.backT = 0;
  f.stun = 0; f.slow = 0; f.slowT = 0; f.haste = 1; f.hasteT = 0; f.kx = 0; f.ky = 0;
  f.burn = 0; f.burnT = 0; f.burnTick = 0; f.burnSrc = '';
  f.dead = false; f.mark = 0; f.clen = 0; f.act = ''; f.actT = 0; f.ax = 0; f.ay = 0; f.cs = 0; f.cdmg = 0; f.rest = 0; f.auraT = 0; f.cell = 0;
  f.pcd = row.patterns ? row.patterns.map((A, i) => A.cd * (.35 + .3 * i)) : null; f.named = !!row.named; f.summon = ''; f.scout = false;
  g.foes.push(f); g.alive++;
  return f;
}

/** Add one man to the squad of a troop the build owns, whatever its number. For tests and stills. */
export function addMan(g, id) {
  const e = g.build.troops.find(t => t.id === id);
  if (!e) throw new Error(`no squad ${id}`);
  return addAlly(g, e, BY.troop[id].at[e.level]);
}
function addAlly(g, e, P) {
  const a = allyPool.pop() || {}, h = g.hero, ang = rand(g) * TAU, stand = BY.troop[e.id].stand;
  a.id = g.nextId++; a.kind = e.id; a.general = ''; a.level = e.level; a.trueForm = false; a.rank = e.rank;
  a.x = a.px = h.x + Math.cos(ang) * 30; a.y = a.py = h.y + Math.sin(ang) * 30;
  a.facing = h.facing; a.dir = h.dir; a.hp = a.maxHp = P.hp; a.state = 'walk'; a.stateT = 0; a.flash = 0; a.elite = false;
  a.r = P.r; a.cd = rand(g) * P.cd; a.i = 0; a.j = 0; a.m = 1; a.wade = stand === 'wade'; a.free = stand === 'wade' || stand === 'orbit'; a.blocks = !!BY.troop[e.id].blocks;
  a.dead = false; a.seekT = 0; a.tx = a.x; a.ty = a.y; a.hasTarget = false; a.mvT = 0; a.mvD = 0; a.mx0 = 0; a.my0 = 0; a.mx1 = 0; a.my1 = 0;
  a.awayT = 0; a.storm = null; a.flip = 0;
  g.allies.push(a);
  g.slotsDirty = true;
  return a;
}
/** Bring every squad to its row: the men's health and rank, and (when `fill`) its full number at once. */
function syncSquads(g, fill) {
  for (const e of g.build.troops) {
    const P = BY.troop[e.id].at[e.level];
    let n = 0;
    for (const a of g.allies) {
      if (a.kind !== e.id || a.state === 'dead') continue;
      n++;
      a.rank = e.rank; a.level = e.level;
      if (a.maxHp !== P.hp) { a.hp += P.hp - a.maxHp; a.maxHp = P.hp; }
    }
    if (fill) for (; n < P.men; n++) addAlly(g, e, P);
  }
}
function assignSlots(g) {
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

// ------------------------------------------------------------------------------------------- harm
function shove(f, ox, oy, dist) {
  let dx = f.x - ox, dy = f.y - oy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
  f.kx += dx * dist * KB; f.ky += dy * dist * KB;
}

function kill(g, f, src) {
  const row = BY.foe[f.kind];
  f.hp = 0; f.state = 'dead'; f.stateT = 0; f.act = '';
  g.alive--; g.stats.kills++;
  g.events.push({type: 'kill', x: f.x, y: f.y, id: f.id, kind: f.kind, by: src, elite: f.elite});
  if (row.xp) addPickup(g, 'spirit', f.x, f.y, f.scout ? Math.max(1, Math.round(row.xp * SCHEDULE.scouts.xp)) : row.xp);
  if (f.elite) addPickup(g, 'chest', f.x + 12, f.y + 8, row.named && !row.last ? 1 : 0);   // a chest of value 1 is a named foe's
  else if (row.ai === 'aura') addPickup(g, 'peach', f.x + 10, f.y, 0);
  else {
    const roll = rand(g);
    if (roll < PICKUPS.peach) addPickup(g, 'peach', f.x + 10, f.y, 0);
    else if (roll < PICKUPS.peach + PICKUPS.lodestone) addPickup(g, 'lodestone', f.x + 10, f.y, 0);
  }
  if (row.last) { g.phase = 'won'; g.stats.time = g.t; g.events.push({type: 'won', x: f.x, y: f.y, t: g.t}); }
}

/**
 * Harm a foe. `P` (a row's numbers, or null) gives the stun, the push from (ox, oy) and the share against elites;
 * `el` is the element a soldier's blow has taken in the eight trigrams; `dot` is burning: no armour, no effects.
 */
function hitFoe(g, f, dmg, src, P, ox, oy, el, dot) {
  if (f.state === 'dead') return;
  let d = dmg * (g.power[src] || 1);
  if (!dot) {
    if (P && f.elite && P.eliteMult) d *= P.eliteMult;
    if (el === 'metal') d *= 1 + RIDER.metal.more * (g.form && g.form.rider || 1);
    if (f.armour) d = Math.max(1, d - f.armour);
  }
  const dealt = d < f.hp ? d : f.hp;
  f.hp -= d; f.flash = .12;
  g.stats.damage[src] = (g.stats.damage[src] || 0) + dealt;
  if (dot) g.stats.effects[src] = (g.stats.effects[src] || 0) + dealt;      // burning and crushing ground: part of `damage`, counted here too
  g.events.push({type: 'hit', x: f.x, y: f.y, id: src, target: f.id, dmg: d, dot: !!dot, push: !dot && P && P.push && !f.heavy ? P.push : 0, fromX: ox, fromY: oy});
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

function hurtAlly(g, a, dmg, by) {
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

function wardBurst(g, blocked) {
  const h = g.hero, P = g.ward.P, R = P.radius * g.mods.area, e = g.ward.entry;
  g.events.push({type: 'cast', id: e.id, level: e.level, evolved: e.evolved, shape: 'ward', x: h.x, y: h.y, dir: 0, radius: R, blocked});
  const n = query(h.x, h.y, R, Qward);
  for (let i = 0; i < n; i++) hitFoe(g, Qward[i], P.dmg * g.mods.dmg, e.id, P, h.x, h.y, null, false);
}

/** Harm meant for the hero: the spring and the half second after a hit let it pass, then the ward, then a soldier of the ring. */
function hurtHero(g, dmg, by, x, y, pattern = '') {
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
  // the rage: past SCHEDULE.late.from every blow of the Shang is harder with each minute, whoever strikes it
  const past = (g.t - SCHEDULE.late.from) / 60;
  const d = Math.max(1, dmg * (past > 0 ? 1 + SCHEDULE.late.dmg * past * Math.max(1, past) : 1) - g.mods.armour);
  h.hp -= d; h.flash = .15; h.hurtT = HERO.hurtTime;
  g.stats.taken[by] = (g.stats.taken[by] || 0) + d;
  g.events.push({type: 'hurt', x: h.x, y: h.y, dmg: d, by, fromX: x, fromY: y, pattern});   // `pattern`: the warned blow's id, '' for a body or a shot
  if (h.hp <= 0) {
    h.hp = 0; h.fallT = HERO.fallTime; h.fullCry = false; h.rideT = 0;
    setState(h, 'fall');
    g.events.push({type: 'fall', x: h.x, y: h.y, by});
  }
  return true;
}

// ------------------------------------------------------------------------------------------- shots, zones, pickups
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
function addZone(g, kind, side, src, x, y, r, life) {
  const z = zonePool.pop() || {};
  z.id = g.nextId++; z.kind = kind; z.side = side; z.src = src; z.shape = 'circle'; z.x = x; z.y = y; z.r = r;
  z.dir = 0; z.len = 0; z.w = 0; z.t = 0; z.life = life; z.dps = 0; z.slow = 0; z.dmg = 0; z.tick = 0; z.chase = 0; z.spin = 0;
  z.follow = false; z.hold = 0; z.level = 0; z.evolved = false; z.P = null; z.mul = 1; z.dead = false; z.el = null; z.unit = null; z.r0 = 0; z.angle = 0; z.pattern = '';
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
function compact(list, pool) {
  let w = 0;
  for (let i = 0; i < list.length; i++) { const o = list[i]; if (o.dead) pool.push(o); else list[w++] = o; }
  list.length = w;
}

// ------------------------------------------------------------------------------------------- the shapes
function doLine(g, x, y, dir, len, w, dmg, P, id, level, evolved, el, by, fork) {
  g.events.push({type: 'cast', id, level, evolved, shape: P.shape, x, y, dir, length: len, width: w, fork, by});
  const n = queryLane(x, y, dir, len, w, Qhit), hold = P.shape === 'bind';
  for (let i = 0; i < n; i++) {
    const f = Qhit[i];
    hitFoe(g, f, dmg, id, P, x, y, el, false);
    if (hold && f.state !== 'dead') f.stun = Math.max(f.stun, P.hold * g.mods.dur * (f.heavy ? .25 : 1));
  }
  if (P.burnDps || hold) {
    const z = addZone(g, hold ? 'bind' : 'burn', 'zhou', id, x, y, 0, (hold ? P.hold : P.burnLife) * g.mods.dur);
    z.shape = 'lane'; z.dir = dir; z.len = len; z.w = w; z.dps = hold ? 0 : P.burnDps * g.mods.dmg; z.level = level; z.evolved = evolved;
  }
}

/** What comes down at (x, y): the blow, and the field it leaves if its row has one. */
function landAt(g, x, y, P, id, level, evolved, mul, el = null) {
  const R = P.radius * g.mods.area;
  g.events.push({type: 'land', id, level, evolved, x, y, radius: R, push: P.push || 0});
  const n = query(x, y, R, Qhit);
  for (let i = 0; i < n; i++) hitFoe(g, Qhit[i], P.dmg * mul, id, P, x, y, el, false);
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
function cast(g, o, P, id, level, evolved, mul, el, by) {
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
      g.events.push({type: 'cast', id, level, evolved, shape: 'arc', x, y, dir, radius: R, angle: P.angle, span: P.span || 0, by});
      const n = query(x, y, R, Qhit);
      for (let i = 0; i < n; i++) {
        const f = Qhit[i], dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
        if (full || d <= f.r || (dx * c + dy * s) / d >= half) hitFoe(g, f, P.dmg * mul, id, P, x, y, el, false);
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
      g.events.push({type: 'cast', id, level, evolved, shape: 'beam', x, y, dir, length: len, width: P.width * area, life: P.life, sweep: P.sweep, by});
      const z = addZone(g, 'beam', 'zhou', id, x, y, 0, P.life * g.mods.dur);
      z.shape = 'lane'; z.dir = dir; z.len = len; z.w = P.width * area; z.dps = P.dmg * mul; z.slow = P.slow || 0; z.spin = P.sweep || 0;
      z.follow = o === g.hero; z.level = level; z.evolved = evolved;
      return true;
    }
  }
  return false;
}

// Pearls and the like are shots that never fly off: they are set round the hero whenever the build changes.
function rebuildOrbits(g) {
  for (const s of g.shots) if (s.orbit) s.dead = true;
  for (const e of g.build.treasures) {
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

function stepTreasures(g, dt) {
  const h = g.hero, m = g.mods, w = g.ward;
  for (const e of g.build.treasures) {
    const P = paramsOf(e);
    if (P.shape === 'orbit') continue;
    if (P.shape === 'ward') {
      w.P = P; w.entry = e;
      if (!w.up) {
        w.t -= dt * m.rate;
        if (w.t <= 0) {
          w.up = true;
          w.zone = addZone(g, 'ward', 'zhou', e.id, h.x, h.y, P.radius * m.area, Infinity);
          w.zone.follow = true; w.zone.level = e.level; w.zone.evolved = e.evolved;
          if (P.pulse) wardBurst(g, false);
        }
      } else if (w.zone) { w.zone.r = P.radius * m.area; w.zone.level = e.level; w.zone.evolved = e.evolved; }
      continue;
    }
    e.cd -= dt * m.rate;
    if (e.cd <= 0) {
      const done = cast(g, h, P, e.id, e.level, e.evolved, m.dmg, null, 0);
      e.cd = done ? P.cd : .12;
      // 哪吒 is with him: the same treasure strikes again from where 哪吒 stands
      if (done && g.echo && g.echo.state !== 'away' && BY.general.nezha.echoes.includes(e.id)) cast(g, g.echo, P, e.id, e.level, e.evolved, m.dmg * GENERAL.echo, null, g.echo.id);
    }
  }
}

// ------------------------------------------------------------------------------------------- the hero
function stepHero(g, input, dt) {
  const h = g.hero, m = g.mods;
  h.px = h.x; h.py = h.y; h.stateT += dt;
  if (h.safe > 0) h.safe -= dt;
  if (h.dashCd > 0) h.dashCd = Math.max(0, h.dashCd - dt);
  if (h.hurtT > 0) h.hurtT -= dt;
  if (h.flash > 0) h.flash -= dt;
  if (h.fallT > 0) {
    // the riderless horse runs on and slows
    h.vx *= 1 - Math.min(1, 3 * dt); h.vy *= 1 - Math.min(1, 3 * dt);
    h.x = clamp(h.x + h.vx * dt, WORLD.edge, WORLD.w - WORLD.edge); h.y = clamp(h.y + h.vy * dt, WORLD.edge, WORLD.h - WORLD.edge);
    h.fallT -= dt; h.moving = false;
    if (h.fallT <= 0) { g.phase = 'lost'; g.stats.time = g.t; g.events.push({type: 'lost', x: h.x, y: h.y, t: g.t}); }
    return;
  }
  let mx = +input.mx || 0, my = +input.my || 0, mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
  const moving = mag > .3, was = h.fullCry;
  if (input.dash && h.dashCd <= 0 && h.dashT <= 0) {
    const a = moving ? Math.atan2(my, mx) : h.head;
    h.dashX = Math.cos(a); h.dashY = Math.sin(a); h.dashT = HERO.dashTime; h.dashCd = HERO.dashCd; h.head = a;
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
    h.rideT = Math.min(h.rideT + dt, CRY.after + CRY.reserve + m.ride);
    const v = HERO.speed * m.speed * (h.rideT >= CRY.after ? CRY.speed : 1) * mag;
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
  setState(h, h.dashT > 0 ? 'dash' : h.hurtT > 0 ? 'hurt' : h.moving ? 'ride' : 'idle');
}

/** Bodies that meet the hero: in full cry he tramples them, otherwise (or when one cannot be trampled again yet) they hurt him. */
function stepContact(g) {
  const h = g.hero;
  if (h.dashT > 0 || h.fallT > 0) return;
  const n = query(h.x, h.y, HERO.r, Qhero);
  for (let i = 0; i < n; i++) {
    const f = Qhero[i];
    if (f.state === 'dead') continue;
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
    hurtHero(g, f.act === 'charge' ? f.cdmg : f.dmg, f.kind, f.x, f.y, f.act === 'charge' ? f.pat : '');
  }
}

// ------------------------------------------------------------------------------------------- the squads
function slotOf(g, a, out) {
  const h = g.hero, F = g.form, n = g.standN;
  let x = 0, y = 0;
  const stand = BY.troop[a.kind].stand, mid = (a.m - 1) / 2;
  if (stand === 'wade') { const ang = g.massA + Math.PI + (a.j - mid) * .7; x = Math.cos(ang) * 60; y = Math.sin(ang) * 60; }
  else if (stand === 'orbit') {
    // chariots circle the hero wide, whatever the formation
    const P = BY.troop[a.kind].at[1], ang = g.t * P.turn + a.j * TAU / a.m;
    x = Math.cos(ang) * P.orbit; y = Math.sin(ang) * P.orbit;
  } else if (!F) {
    if (stand === 'between') { const ang = g.massA + (a.j - mid) * .42; x = Math.cos(ang) * 64; y = Math.sin(ang) * 64; }
    else if (stand === 'behind') { const ang = g.massA + Math.PI + (a.j - mid) * .5; x = Math.cos(ang) * 46; y = Math.sin(ang) * 46; }
    else if (stand === 'far') { const ang = g.massA + Math.PI + (a.j - mid) * .4; x = Math.cos(ang) * 112; y = Math.sin(ang) * 112; }
    else if (stand === 'escort') { const ang = a.j * TAU / a.m + 1.1; x = Math.cos(ang) * 50; y = Math.sin(ang) * 50; }
    else if (stand === 'line') { const ang = g.massA + (a.j - mid) * .5; x = Math.cos(ang) * 128; y = Math.sin(ang) * 128; }
    else { const ang = a.j * TAU / a.m + .4; x = Math.cos(ang) * 92; y = Math.sin(ang) * 92; }
  } else if (F.guard) {
    const ang = a.i * TAU / n, R = F.radius + n;
    x = Math.cos(ang) * R; y = Math.sin(ang) * R;
  } else if (F.tip) {
    const arm = (a.i + 1) >> 1, side = a.i & 1 ? 1 : -1, along = F.tip - arm * F.step, across = side * arm * F.spread;
    const c = Math.cos(h.head), s = Math.sin(h.head);
    x = c * along - s * across; y = s * along + c * across;
  } else {
    const ang = g.t * F.spin + (a.i % 8) * TAU / 8, R = F.radius + 34 * (a.i >> 3);
    x = Math.cos(ang) * R; y = Math.sin(ang) * R;
  }
  out.x = h.x + x; out.y = h.y + y;
}
const SLOT = {x: 0, y: 0}, MEN = [];
const BREACH = {eliteMult: 1};

/** A blow along a lane with no event of its own (the caller reports it). */
function lineHit(g, x, y, dir, len, w, dmg, src, P, el) {
  const n = queryLane(x, y, dir, len, w, Qhit);
  for (let i = 0; i < n; i++) hitFoe(g, Qhit[i], dmg, src, P, x, y, el, false);
  return n;
}
/** Send a unit through the air or down a lane: for `time` it is carried to (x, y) and does nothing else. */
function carry(a, x, y, time) {
  a.mx0 = a.x; a.my0 = a.y; a.mx1 = clamp(x, WORLD.edge, WORLD.w - WORLD.edge); a.my1 = clamp(y, WORLD.edge, WORLD.h - WORLD.edge);
  a.mvT = a.mvD = time; setState(a, 'skill'); a.stateT = 0;
}
const inAura = (g, a) => g.aura && (a.x - g.aura.x) * (a.x - g.aura.x) + (a.y - g.aura.y) * (a.y - g.aura.y) <= g.aura.radius * g.aura.radius;

/** One spell of the acolytes, of an element, on a place. Returns the event's measures. */
function talisman(g, e, S, el, x, y, cx, cy, mul, rider) {
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
function squadSkill(g, e, mul) {
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
      for (let i = 0; i < m; i++) {
        const a = MEN[i];
        if (!clusters(g, a.x, a.y, len, 1)) continue;
        const dir = Math.atan2(CL[0].y - a.y, CL[0].x - a.x);
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
    case 'talisman': {
      const els = S.all ? Object.keys(ELEMENTS) : [g.mainEl], n = clusters(g, h.x, h.y, S.range, els.length);
      if (!n) return false;
      const spots = [];
      for (let i = 0; i < els.length; i++) spots.push({x: CL[i % n].x, y: CL[i % n].y});
      for (let i = 0; i < els.length; i++) {
        const more = talisman(g, e, S, els[i], spots[i].x, spots[i].y, cx, cy, mul, rider);
        g.events.push({...ev, ...more, by: ev.by, element: els[i], x: spots[i].x, y: spots[i].y, dir: Math.atan2(spots[i].y - cy, spots[i].x - cx), fromX: cx, fromY: cy});
      }
      for (let i = 0; i < m; i++) { setState(MEN[i], 'skill'); MEN[i].stateT = 0; }
      return true;
    }
    default: return false;
  }
  g.events.push(ev);
  return true;
}

// ------------------------------------------------------------------------------------------- the generals
function addGeneral(g, e) {
  const row = BY.general[e.id], P = row.at[e.trueForm ? MAX.general + 1 : e.level], a = allyPool.pop() || {}, h = g.hero;
  a.id = g.nextId++; a.kind = 'general'; a.general = e.id; a.level = e.level; a.trueForm = e.trueForm; a.rank = 0;   // every field in the order a soldier's are set: a unit taken from the pool reads the same as a new one
  a.x = a.px = h.x + 40; a.y = a.py = h.y - 30; a.facing = h.facing; a.dir = h.dir;
  a.hp = a.maxHp = Math.round(P.hp * P.hpGrow); a.state = 'walk'; a.stateT = 0; a.flash = 0; a.elite = false;
  a.r = row.r; a.cd = .5; a.i = 0; a.j = 0; a.m = 1; a.wade = false; a.free = true; a.blocks = false;
  a.dead = false; a.seekT = 0; a.tx = a.x; a.ty = a.y; a.hasTarget = false; a.mvT = 0; a.mvD = 0; a.mx0 = 0; a.my0 = 0; a.mx1 = 0; a.my1 = 0;
  a.awayT = 0; a.storm = null; a.flip = 0;
  g.allies.push(a);
  return a;
}
/** Bring every general on the field to his row, and put those newly taken there. */
function syncGenerals(g) {
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
function quarry(g, x, y, range, count, want) {
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
const isElite = f => f.elite, isShooter = f => { const ai = BY.foe[f.kind].ai; return ai === 'shoot' || ai === 'aura'; }, isWinding = f => f.state === 'windup' || f.act === 'aim' || f.act === 'slam';

function generalSkill(g, a, e, row, P, mul) {
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
      for (let i = 0; i < n; i++) hitFoe(g, PICKED[i], S.dmg * mul * (isShooter(PICKED[i]) ? 2 : 1), e.id, null, a.x, a.y, null, false);
      ev.count = n;
      break;
    }
    case 'line': {                                          // 雷震子: a dive along a line through the thickest of them
      if (!clusters(g, a.x, a.y, 440, 1)) return false;
      const dir = Math.atan2(CL[0].y - a.y, CL[0].x - a.x), len = S.length * area, w = S.width * area;
      lineHit(g, a.x, a.y, dir, len, w, S.dmg * mul, e.id, S, null);
      ev.dir = dir; ev.length = len; ev.width = w; ev.time = .35;
      carry(a, a.x + Math.cos(dir) * len, a.y + Math.sin(dir) * len, .35);
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
    case 'rally': {                                         // 黄飞虎: the squads' skills come round sooner; as 武成王, all at once
      if (!g.build.troops.length) return false;
      for (const t of g.build.troops) if (t.rank >= 2) t.skillCd = F && F.allSkills ? 0 : t.skillCd * (1 - S.haste);
      ev.radius = P.aura.radius; ev.all = !!(F && F.allSkills);
      break;
    }
    default: return false;
  }
  g.events.push(ev);
  setState(a, 'skill'); a.stateT = 0;
  return true;
}
/** 五光石: fast stones, one foe each, first at whatever is winding up a blow. Returns how many were thrown. */
function throwStones(g, a, e, S, count, mul) {
  const n = quarry(g, a.x, a.y, S.range, count || 1, isWinding);
  for (let i = 0; i < n; i++) {
    const f = PICKED[i], dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy) || 1;
    const s = addShot(g, 'stone', 'zhou', e.id, a.x, a.y, dx / d * S.speed, dy / d * S.speed, S.r, S.dmg * mul, d / S.speed + .25);
    s.hitP = S;
  }
  return n;
}

function stepGeneral(g, a, dt) {
  const h = g.hero, m = g.mods, e = g.build.generals.find(x => x.id === a.general);
  if (!e) { a.dead = true; return; }
  const row = BY.general[e.id], P = row.at[e.trueForm ? MAX.general + 1 : e.level], F = P.form || null;
  if (a.state === 'away') {
    // he has withdrawn; he is never lost
    a.awayT -= dt; a.x = a.px = h.x; a.y = a.py = h.y;
    if (a.awayT <= 0) { a.hp = a.maxHp; setState(a, 'walk'); g.events.push({type: 'generalReturn', general: e.id, x: a.x, y: a.y}); }
    return;
  }
  if (a.mvT > 0) { a.mvT -= dt; const k = 1 - Math.max(0, a.mvT) / a.mvD; a.x = a.mx0 + (a.mx1 - a.mx0) * k; a.y = a.my0 + (a.my1 - a.my0) * k; return; }
  // whom he goes for
  a.seekT -= dt;
  if (a.seekT <= 0) {
    a.seekT = .3; a.hasTarget = false;
    const side = g.build.generals.indexOf(e) ? -1 : 1;
    a.tx = h.x + Math.cos(g.massA + Math.PI + side * .9) * 78; a.ty = h.y + Math.sin(g.massA + Math.PI + side * .9) * 78;
    if (row.seek === 'cluster') { if (clusters(g, h.x, h.y, GENERAL.leash, 1)) { a.tx = CL[0].x; a.ty = CL[0].y; a.hasTarget = true; } }
    else if (row.seek === 'elite') { if (quarry(g, a.x, a.y, GENERAL.leash, 1, isElite)) { a.tx = PICKED[0].x; a.ty = PICKED[0].y; a.hasTarget = true; } }
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
  if (!row.fly && !under) {
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
    if (!a.storm || a.storm.dead) { a.storm = addZone(g, 'storm', 'zhou', e.id, a.x, a.y, F.storm.radius * m.area, Infinity); a.storm.unit = a; }
    a.storm.dps = F.storm.dps * mul;
  }
  if (under) return;
  a.cd -= dt;
  if (a.cd <= 0) {
    const done = A.shape === 'stone' ? throwStones(g, a, e, A, 1, mul) > 0 : cast(g, a, A, e.id, e.level, e.trueForm, mul, null, a.id);
    a.cd = done ? A.cd : .15;
    if (done && a.state !== 'skill') { setState(a, 'attack'); a.stateT = 0; }
  }
  e.skillCd -= dt;
  if (e.skillCd <= 0) e.skillCd = generalSkill(g, a, e, row, P, mul) ? P.skill.cd : .4;
}

function stepAllies(g, dt) {
  const h = g.hero, m = g.mods, F = g.form;
  if (g.slotsDirty) assignSlots(g);
  const mul0 = m.dmg * (F && F.moving && h.moving ? 1 + F.moving : 1);
  // 黄飞虎's presence, and 哪吒's, for this step
  g.aura = null; g.echo = null;
  for (const a of g.allies) {
    if (a.kind !== 'general' || a.state === 'away' || a.state === 'dead') continue;
    const row = BY.general[a.general], P = row.at[a.trueForm ? MAX.general + 1 : a.level];
    if (P.aura) g.aura = {x: a.x, y: a.y, radius: P.aura.radius, dmg: P.aura.dmg, guard: P.aura.guard};
    if (row.echoes) g.echo = a;
  }
  // squads: men come back, the squad skills, and the volleys of those that act together
  for (const e of g.build.troops) {
    const P = BY.troop[e.id].at[e.level];
    let men = 0, near = false;
    for (const a of g.allies) if (a.kind === e.id && a.state !== 'dead') { men++; if (!near && inAura(g, a)) near = true; }
    const mul = mul0 * (near ? 1 + g.aura.dmg : 1);
    if (men < P.men) {
      e.musterT += dt;
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
    // bodies: foes cannot walk through him, and those who touch him strike him
    const n = query(a.x, a.y, a.r + 2, Qally);
    for (let k = 0; k < n; k++) {
      const f = Qally[k];
      if (f.state === 'dead') continue;
      const fx = f.x - a.x, fy = f.y - a.y, fd = Math.hypot(fx, fy) || 1, over = a.r + f.r - fd;
      if (over > 0 && !f.heavy) { f.x += fx / fd * over * .5; f.y += fy / fd * over * .5; }
      if (f.hitCd <= 0 && f.stun <= 0) { f.hitCd = 1; hurtAlly(g, a, f.act === 'charge' ? f.cdmg : f.dmg * ALLY.hurt, f.kind); }
    }
    if (a.state === 'dead' || P.per !== 'man') continue;
    a.cd -= dt;
    if (a.cd <= 0) {
      if (cast(g, a, P, e.id, e.level, false, mul0 * (inAura(g, a) ? 1 + g.aura.dmg : 1), F && F.rider ? elementAt(g, a) : null, a.id)) { a.cd = P.cd; setState(a, 'attack'); a.stateT = 0; }
      else a.cd = .15;
    }
  }
}
/** The element of the place a soldier stands on in the eight trigrams. */
export function elementAt(g, a) {
  const ang = Math.atan2(a.y - g.hero.y, a.x - g.hero.x);
  return TRIGRAMS[((Math.round(ang / (TAU / 8)) % 8) + 8) % 8].element;
}

// ------------------------------------------------------------------------------------------- the Shang
function startLane(g, f, A) {
  const h = g.hero, dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1;
  f.ax = dx / d; f.ay = dy / d; f.act = 'aim'; f.actT = A.warn; f.cs = A.chargeSpeed; f.cdmg = (A.dmg || BY.foe[f.kind].dmg) * (f.dmg / BY.foe[f.kind].dmg);
  f.rest = A.rest; f.clen = A.length;
  const dir = Math.atan2(f.ay, f.ax);
  const z = addZone(g, 'lane', 'shang', f.kind, f.x, f.y, 0, A.warn);
  z.shape = 'lane'; z.dir = dir; z.len = A.length; z.w = A.width; z.pattern = f.pat = A.ai ? 'lane' : A.id;
  g.events.push({type: 'warn', kind: z.pattern, shape: 'lane', by: f.kind, x: f.x, y: f.y, dir, length: A.length, width: A.width, time: A.warn, id: f.id});
  setState(f, 'windup');
}
/** Is (x, y), with `pad` to spare, on a zone's ground: a circle, a ring, a lane or a cone. */
function inZone(z, x, y, pad) {
  const dx = x - z.x, dy = y - z.y;
  if (z.shape === 'lane') {
    const c = Math.cos(z.dir), s = Math.sin(z.dir), along = dx * c + dy * s, off = Math.abs(dy * c - dx * s);
    return along >= -pad && along <= z.len + pad && off <= z.w / 2 + pad;
  }
  const d = Math.hypot(dx, dy);
  if (d > z.r + pad) return false;
  if (z.shape === 'ring') return d >= z.r0 - pad;
  if (z.shape === 'cone') return d < 1 || (dx * Math.cos(z.dir) + dy * Math.sin(z.dir)) / d >= Math.cos(z.angle * Math.PI / 360 + pad / Math.max(d, 1));
  return true;
}
/** A named foe begins one of his patterns: the ground is marked for `warn` seconds, then it strikes. */
function startPattern(g, f, A) {
  if (A.shape === 'lane' && A.chargeSpeed) { startLane(g, f, A); return; }
  const h = g.hero, k = f.dmg / BY.foe[f.kind].dmg, dir = Math.atan2(h.y - f.y, h.x - f.x);
  const warn = (z, more) => { z.pattern = A.id; z.dmg = (A.dmg || 0) * k; g.events.push({type: 'warn', kind: A.id, shape: z.shape, by: f.kind, id: f.id, time: z.life, x: z.x, y: z.y, ...more}); return z; };
  switch (A.shape) {
    case 'lane': {                                          // a blast down a lane: he stands
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, 0, A.warn);
      z.shape = 'lane'; z.dir = dir; z.len = A.length; z.w = A.width;
      warn(z, {dir, length: A.length, width: A.width});
      break;
    }
    case 'cone': {
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, A.radius, A.warn);
      z.shape = 'cone'; z.dir = dir; z.angle = A.angle;
      warn(z, {dir, angle: A.angle, radius: A.radius});
      break;
    }
    case 'circles': {
      // the first where the hero is; with `ahead`, the second where he is going; the rest scattered round him
      for (let i = 0; i < A.count; i++) {
        let x = h.x, y = h.y;
        // the second where he is going; if he stands, between him and the one who strikes: the ways out are away
        // (`lead`: where his speed and his turning will have carried him by then, this share of the way)
        if (i === 1 && A.ahead) {
          if (h.moving && A.lead) {
            const v = Math.max(Math.hypot(h.vx, h.vy), A.ahead / (A.warn * A.lead)), T = A.warn * A.lead, w = h.turn, c = h.course;
            if (Math.abs(w) < .05) { x += Math.cos(c) * v * T; y += Math.sin(c) * v * T; }
            else { x += v / w * (Math.sin(c + w * T) - Math.sin(c)); y -= v / w * (Math.cos(c + w * T) - Math.cos(c)); }
          } else { const a = h.moving ? h.head : dir + Math.PI; x += Math.cos(a) * A.ahead; y += Math.sin(a) * A.ahead; }
        }
        else if (i > 0) { const near = A.radius * (A.near || 1.6), a = rand(g) * TAU, d = near + rand(g) * (A.scatter - near); x += Math.cos(a) * d; y += Math.sin(a) * d; }
        warn(addZone(g, 'warn', 'shang', f.kind, x, y, A.radius, A.warn), {radius: A.radius});
      }
      break;
    }
    case 'ring': {
      // `through`: the band is laid through the place the hero is in, as wide as the row's
      const w = A.r - A.r0, r0 = A.through ? Math.max(BY.foe[f.kind].r + 20, Math.hypot(h.x - f.x, h.y - f.y) - w / 2) : A.r0;
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, r0 + w, A.warn);
      z.shape = 'ring'; z.r0 = r0;
      warn(z, {radius: r0 + w, inner: r0});
      break;
    }
    case 'rings': {                                         // band after band, each further out and a little later
      A.bands.forEach((b, i) => {
        const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, b[1], A.warn + i * A.gap);
        z.shape = 'ring'; z.r0 = b[0];
        warn(z, {radius: b[1], inner: b[0], order: i});
      });
      break;
    }
    case 'dark': case 'wall': {
      const z = A.shape === 'dark' ? addZone(g, 'warn', 'shang', f.kind, f.x, f.y, A.radius, A.warn) : addZone(g, 'warn', 'shang', f.kind, h.x, h.y, A.r, A.warn);
      z.P = A;
      if (A.shape === 'dark') z.unit = f; else { z.shape = 'ring'; z.r0 = A.r0; }
      warn(z, A.shape === 'dark' ? {radius: A.radius, life: A.life} : {radius: A.r, inner: A.r0, life: A.life});
      z.dmg = 0;
      break;
    }
    case 'summon': {
      f.summon = A.kind;
      g.events.push({type: 'warn', kind: A.id, shape: 'summon', by: f.kind, id: f.id, time: A.warn, x: f.x, y: f.y});
      break;
    }
  }
  f.act = 'slam'; f.actT = A.warn;
  setState(f, 'windup');
}

function stepFoes(g, dt) {
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
    let walk = 1;                                        // 1 toward the hero, -1 away, 0 stand
    if (f.stun > 0) {
      f.stun -= dt; walk = 0;
      if (!f.act) setState(f, 'stun');
    }
    if (f.act) {
      // a warned attack runs its course: a chariot or a leader cannot be talked out of it
      walk = 0; f.actT -= dt;
      if (f.act === 'aim') { if (f.actT <= 0) { f.act = 'charge'; f.actT = f.clen / f.cs; setState(f, 'charge'); } }
      else if (f.act === 'charge') {
        f.x += f.ax * f.cs * dt; f.y += f.ay * f.cs * dt; f.facing = f.ax >= 0 ? 1 : -1;
        if (f.actT <= 0) { f.act = 'rest'; f.actT = f.rest; setState(f, 'rest'); }
      } else if (f.actT <= 0) {
        if (f.summon) {
          const o = addFoe(g, f.summon, f.x + 30, f.y);
          g.events.push({type: 'summoned', kind: f.summon, x: o.x, y: o.y, id: o.id, by: f.kind});
          f.summon = '';
        }
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
      } else if (ai === 'named') {
        const pats = row.patterns;
        for (let k = 0; k < pats.length; k++) f.pcd[k] -= dt;
        for (let k = pats.length - 1; k >= 0; k--) {
          const A = pats[k];
          if (f.pcd[k] > 0 || d > A.within || (A.shape === 'summon' && g.foes.some(o => o.kind === A.kind && o.state !== 'dead'))) continue;
          f.pcd[k] = A.cd; startPattern(g, f, A); walk = 0;
          break;
        }
      } else if (ai === 'marten') {
        // it eats soldiers: the nearest one, a bite at a time; with none left it comes for the hero
        let prey = null, bd = Infinity;
        for (const a of g.allies) {
          if (a.kind === 'general' || a.state === 'dead' || a.mvT > 0) continue;
          const pd = (a.x - f.x) * (a.x - f.x) + (a.y - f.y) * (a.y - f.y);
          if (pd < bd) { bd = pd; prey = a; }
        }
        if (prey) {
          walk = 0;
          const pd = Math.sqrt(bd) || 1, sp = f.speed * g.haste * (f.slow > 0 ? 1 - f.slow : 1);
          if (pd > f.r + prey.r) { f.x += (prey.x - f.x) / pd * sp * dt; f.y += (prey.y - f.y) / pd * sp * dt; setState(f, 'walk'); }
          else if (f.cd <= 0) { f.cd = row.between; setState(f, 'attack'); g.events.push({type: 'bite', x: prey.x, y: prey.y, id: f.id, target: prey.id}); hurtAlly(g, prey, row.bite, f.kind); }
          f.facing = prey.x >= f.x ? 1 : -1;
        }
      }
      if (walk !== 0 && !f.act && f.state !== 'windup') {
        const sp = f.speed * g.haste * walk * (f.hasteT > 0 ? f.haste : 1) * (f.slow > 0 ? 1 - f.slow : 1);
        f.vx = dx / d * sp; f.vy = dy / d * sp;
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

// ------------------------------------------------------------------------------------------- shots, zones, pickups in motion
function remember(s, id) { s.last[s.li] = id; s.li = (s.li + 1) & 7; }
function stepShots(g, dt) {
  const h = g.hero, shots = g.shots, m = g.mods;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (s.dead) continue;
    s.px = s.x; s.py = s.y; s.t += dt;
    if (s.orbit) {
      const P = s.P, ring = P.rings[s.ring], a = s.a0 + ring.speed * g.t, R = ring.radius * m.area;
      s.x = h.x + Math.cos(a) * R; s.y = h.y + Math.sin(a) * R; s.r = P.r * m.area;
      if (g.dark && (s.x - g.dark.x) * (s.x - g.dark.x) + (s.y - g.dark.y) * (s.y - g.dark.y) < g.dark.r * g.dark.r) continue;   // in the umbrella's dark a pearl strikes nothing
      const n = query(s.x, s.y, s.r, Qshot);
      for (let k = 0; k < n; k++) { const f = Qshot[k]; if (f.oh <= 0) { f.oh = P.again; hitFoe(g, f, P.dmg * m.dmg, s.src, P, h.x, h.y, null, false); } }
      continue;
    }
    if (s.side === 'shang') {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) { s.dead = true; continue; }
      const dx = s.x - h.x, dy = s.y - h.y, rr = s.r + HERO.r;
      if (dx * dx + dy * dy <= rr * rr && h.dashT <= 0 && h.fallT <= 0) { hurtHero(g, s.dmg, s.kind, s.x, s.y); s.dead = true; continue; }
      for (let k = 0; k < g.allies.length; k++) {
        const a = g.allies[k];
        if (!a.blocks || a.state === 'dead') continue;
        const ax = s.x - a.x, ay = s.y - a.y, ar = s.r + a.r + 6;
        if (ax * ax + ay * ay <= ar * ar) {
          s.dead = true;
          g.events.push({type: 'block', x: s.x, y: s.y, id: a.id, by: s.kind});
          hurtAlly(g, a, s.dmg * ALLY.shot, s.kind);
          break;
        }
      }
      continue;
    }
    // a thrown thing of the hero's side
    if (g.dark && (s.x - g.dark.x) * (s.x - g.dark.x) + (s.y - g.dark.y) * (s.y - g.dark.y) < g.dark.r * g.dark.r) {
      s.dead = true; g.events.push({type: 'taken', x: s.x, y: s.y, id: s.src, kind: s.kind});       // the umbrella takes it out of the air
      continue;
    }
    if (s.back) {
      const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 26) { s.dead = true; g.events.push({type: 'catch', x: h.x, y: h.y, id: s.src}); continue; }
      s.vx = dx / d * s.speed; s.vy = dy / d * s.speed;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0 && !s.back) {
      if (s.returns) { s.back = true; s.life = 9; }
      else {
        s.dead = true;
        if (s.burst) {
          // a piece of mountain: it bursts where its roll ends
          const B = s.burst, R = B.radius * m.area, c = query(s.x, s.y, R, Qhop);
          g.events.push({type: 'land', id: s.src, x: s.x, y: s.y, radius: R, push: 0});
          for (let q = 0; q < c; q++) hitFoe(g, Qhop[q], B.dmg * s.mul, s.src, B, s.x, s.y, s.el, false);
        }
        continue;
      }
    }
    const n = query(s.x, s.y, s.r, Qshot);
    for (let k = 0; k < n; k++) {
      const f = Qshot[k];
      if (s.back) { if (f.backT <= 0) { f.backT = .35; hitFoe(g, f, s.dmg, s.src, null, s.x, s.y, s.el, false); } continue; }
      const L = s.last;
      if (L[0] === f.id || L[1] === f.id || L[2] === f.id || L[3] === f.id || L[4] === f.id || L[5] === f.id || L[6] === f.id || L[7] === f.id) continue;
      remember(s, f.id);
      hitFoe(g, f, s.dmg, s.src, s.hitP, s.x - s.vx, s.y - s.vy, s.el, false);
      if (s.pierce > 0) { s.pierce--; break; }
      let next = null;
      if (s.bounces > 0) {
        s.bounces--;
        const c = query(s.x, s.y, s.hop, Qhop);
        let bd = Infinity;
        for (let q = 0; q < c; q++) {
          const o = Qhop[q];
          if (o.state === 'dead' || L[0] === o.id || L[1] === o.id || L[2] === o.id || L[3] === o.id || L[4] === o.id || L[5] === o.id || L[6] === o.id || L[7] === o.id) continue;
          const d2 = (o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y);
          if (d2 < bd) { bd = d2; next = o; }
        }
      }
      if (next) {
        const dx = next.x - s.x, dy = next.y - s.y, d = Math.hypot(dx, dy) || 1;
        s.vx = dx / d * s.speed; s.vy = dy / d * s.speed; s.life = Math.max(s.life, .8);
        g.events.push({type: 'bounce', x: s.x, y: s.y, id: s.src});
      } else if (s.returns) { s.back = true; s.life = 9; }
      else s.dead = true;
      break;
    }
  }
}

function stepZones(g, dt) {
  const h = g.hero, zones = g.zones, count = zones.length;
  g.dark = null;
  for (let i = 0; i < count; i++) {
    const z = zones[i];
    if (z.dead) continue;
    z.t += dt;
    if (z.follow) { z.x = h.x; z.y = h.y; }
    if (z.unit) {
      // it goes with a unit (a general's storm, the rope on a bound foe) and ends with it
      if (z.unit.dead || z.unit.state === 'dead' || z.unit.state === 'away') { z.dead = true; continue; }
      z.x = z.unit.x; z.y = z.unit.y;
    }
    if (z.kind === 'ward') continue;
    if (z.kind === 'fall' || z.kind === 'rain') {
      if (z.t >= z.life) { z.dead = true; landAt(g, z.x, z.y, z.P, z.src, z.level, z.evolved, z.mul, z.el); }
      continue;
    }
    if (z.kind === 'wall' && z.side === 'zhou' && z.t < z.life) {
      // a raised wall: the mass cannot walk through it
      const c = Math.cos(z.dir), sn = Math.sin(z.dir), k = queryLane(z.x, z.y, z.dir, z.len, z.w, Qzone);
      for (let q = 0; q < k; q++) {
        const f = Qzone[q];
        if (f.heavy) continue;
        const off = (f.y - z.y) * c - (f.x - z.x) * sn, push = (z.w / 2 + f.r - Math.abs(off)) * (off >= 0 ? 1 : -1);
        f.x += -sn * push; f.y += c * push;
      }
    }
    if (z.side === 'shang') {
      if (z.kind === 'dark') {
        // the umbrella's darkness: while it lasts the hero's thrown treasures are taken out of the air inside it
        if (z.t >= z.life) z.dead = true; else g.dark = z;
        continue;
      }
      if (z.kind === 'wall') {
        // the golden wall: a ring nobody rides through (the spring passes it)
        if (z.t >= z.life) { z.dead = true; continue; }
        if (h.dashT <= 0 && h.fallT <= 0) {
          const dx = h.x - z.x, dy = h.y - z.y, d = Math.hypot(dx, dy) || 1, inside = d < (z.r0 + z.r) / 2;
          const want = inside ? Math.min(d, z.r0 - HERO.r) : Math.max(d, z.r + HERO.r);
          if (want !== d) { h.x = z.x + dx / d * want; h.y = z.y + dy / d * want; }
        }
        continue;
      }
      if (z.t < z.life) continue;
      z.dead = true;
      // a level's offer waits until the blow has landed and 0.6 s more (a charge: until it has run)
      if (inZone(z, h.x, h.y, HERO.r + 30)) g.holdT = Math.max(g.holdT, z.kind === 'lane' ? 1.3 : .6);
      if (z.kind !== 'warn') continue;
      const A = z.P;
      if (A && A.shape === 'dark') {
        const dz = addZone(g, 'dark', 'shang', z.src, z.x, z.y, A.radius, A.life);
        dz.unit = z.unit; dz.pattern = A.id;
        g.events.push({type: 'land', id: A.id, shape: 'circle', x: z.x, y: z.y, radius: A.radius, side: 'shang', life: A.life});
        continue;
      }
      if (A && A.shape === 'wall') {
        const wz = addZone(g, 'wall', 'shang', z.src, z.x, z.y, A.r, A.life);
        wz.shape = 'ring'; wz.r0 = A.r0; wz.pattern = A.id;
        g.events.push({type: 'land', id: A.id, shape: 'ring', x: z.x, y: z.y, radius: A.r, inner: A.r0, side: 'shang', life: A.life});
        const sz = addZone(g, 'warn', 'shang', z.src, z.x, z.y, A.slam.radius, A.slam.warn);
        sz.dmg = A.slam.dmg; sz.pattern = A.id + 'Slam';
        g.events.push({type: 'warn', kind: sz.pattern, shape: 'circle', by: z.src, id: 0, time: A.slam.warn, x: z.x, y: z.y, radius: A.slam.radius});
        continue;
      }
      // the warned blow lands: on the hero if he is still on its ground, and on the soldiers who are
      g.events.push({type: 'land', id: z.pattern || z.src, shape: z.shape, x: z.x, y: z.y, radius: z.r, inner: z.r0, dir: z.dir, length: z.len, width: z.w, angle: z.angle, side: 'shang'});
      if (!z.dmg) continue;
      if (inZone(z, h.x, h.y, HERO.r * .5)) hurtHero(g, z.dmg, z.src, z.x, z.y, z.pattern || z.src);
      for (const a of g.allies) if (a.state !== 'dead' && a.state !== 'away' && inZone(z, a.x, a.y, 0)) hurtAlly(g, a, z.dmg, z.src);
      continue;
    }
    if (z.t >= z.life) { z.dead = true; continue; }
    if (z.spin) z.dir = wrap(z.dir + z.spin * dt);
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick += TICK;
    const n = z.shape === 'lane' ? queryLane(z.x, z.y, z.dir, z.len, z.w, Qzone) : query(z.x, z.y, z.r, Qzone);
    for (let k = 0; k < n; k++) {
      const f = Qzone[k];
      if (z.slow) { f.slow = Math.max(f.slow, z.slow); f.slowT = TICK * 2; }
      if (z.dps) hitFoe(g, f, z.dps * TICK, z.src, null, 0, 0, null, true);
    }
    if (z.chase) {
      // a dome that hunts: toward the nearest foe outside it
      const t = nearestFoe(z.x, z.y, 320);
      if (t) { const dx = t.x - z.x, dy = t.y - z.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, z.chase * TICK); z.x += dx / d * v; z.y += dy / d * v; }
    }
  }
}

function stepPickups(g, dt) {
  const h = g.hero, ps = g.pickups, gather = g.mods.gather, g2 = gather * gather;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.dead) continue;
    p.px = p.x; p.py = p.y; p.t += dt;
    const dx = h.x - p.x, dy = h.y - p.y, d2 = dx * dx + dy * dy;
    if (!p.pull && d2 > g2) continue;
    if (h.fallT > 0) continue;
    if (d2 <= HERO.touch * HERO.touch) {
      p.dead = true;
      g.events.push({type: 'pickup', kind: p.kind, size: p.size, value: p.value, x: h.x, y: h.y});
      if (p.kind === 'spirit') { h.xp += p.value * g.mods.spirit; g.stats.spirit += p.value * g.mods.spirit; }
      else if (p.kind === 'peach') mend(g, PICKUPS.peachMend * g.mods.mend);
      else if (p.kind === 'lodestone') { for (const o of ps) if (o.kind === 'spirit') o.pull = true; }
      else if (p.kind === 'chest') openChest(g, p.x, p.y, p.value === 1);
      continue;
    }
    if (p.kind === 'chest' && !p.pull) continue;          // a chest is ridden over, not drawn in
    const d = Math.sqrt(d2), v = Math.min(d, (p.pull ? 900 : 560) * dt);
    p.x += dx / d * v; p.y += dy / d * v;
  }
}

// ------------------------------------------------------------------------------------------- the schedule
const PLAN = {alive: 0, rate: 0, hp: 1, armour: 0, mix: null};
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
function pickKind(g, mix) {
  let total = 0;
  for (const k in mix) total += mix[k];
  let pick = rand(g) * total;
  for (const k in mix) if ((pick -= mix[k]) < 0) return k;
  return 'spear';
}
const AT = {x: 0, y: 0};
/** A place `dist` from the hero at `angle`; when that is off the field, the opposite side, then the field's edge. */
function placeAt(g, angle, dist) {
  const h = g.hero, e = WORLD.edge;
  let x = h.x + Math.cos(angle) * dist, y = h.y + Math.sin(angle) * dist;
  if (x < e || x > WORLD.w - e) x = h.x - Math.cos(angle) * dist;
  if (y < e || y > WORLD.h - e) y = h.y - Math.sin(angle) * dist;
  AT.x = clamp(x, e, WORLD.w - e); AT.y = clamp(y, e, WORLD.h - e);
}
function enter(g, kind, type) {
  placeAt(g, rand(g) * TAU, SPAWN.near + rand(g) * (SPAWN.far - SPAWN.near));
  const f = addFoe(g, kind, AT.x, AT.y);
  if (type) g.events.push({type, kind, x: f.x, y: f.y, id: f.id});
  return f;
}
function stepSpawn(g, dt) {
  const s = g.spawn, t = g.t;
  if (!s.opened) {
    s.opened = true;
    for (const O of SPAWN.opening) {
      const a0 = rand(g) * TAU;
      for (let i = 0; i < O.count; i++) { placeAt(g, a0 + i * TAU / O.count, O.near + rand(g) * (O.far - O.near)); addFoe(g, O.kind, AT.x, AT.y); }
    }
  }
  spawnPlan(t, PLAN);
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
      for (let i = 0; i < k; i++) addFoe(g, pickKind(g, PLAN.mix), bx + (rand(g) - .5) * SPAWN.spread, by + (rand(g) - .5) * SPAWN.spread);
      n -= k;
    }
  }
  const E = SCHEDULE.elites, B = SCHEDULE.bosses, R = SCHEDULE.rings;
  while (s.elite < E.length && t >= E[s.elite].t) { for (let i = 0; i < E[s.elite].count; i++) enter(g, E[s.elite].kind, 'elite'); s.elite++; }
  while (s.boss < B.length && t >= B[s.boss].t) {
    const b = B[s.boss++], kind = g.options.named && b.kinds ? g.options.named : b.kinds ? b.kinds[(g.seed >>> 0) % b.kinds.length] : b.kind, row = BY.foe[kind];
    const f = enter(g, kind, 'boss');
    g.events.push({type: 'arrive', kind, name: row.name, title: row.title, x: f.x, y: f.y, id: f.id});
  }
  if (t >= s.shamanAt) { s.shamanAt += SCHEDULE.shamans.every; enter(g, 'shaman', null); }
  const SC = SCHEDULE.scouts;
  if (t >= s.scoutAt && t < SC.until) {
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

// ------------------------------------------------------------------------------------------- one step
const NO_INPUT = {mx: 0, my: 0, dash: false, pick: null, reroll: false, banish: null};

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
  g.haste = g.t > SCHEDULE.late.from + 60 ? 1 + SCHEDULE.late.speed * (g.t - SCHEDULE.late.from - 60) / 60 : 1;
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
  stepFoes(g, dt);
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
function underWarning(g) {
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
