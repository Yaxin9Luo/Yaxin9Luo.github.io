// Fengshen simulation, rules v2: a side-view battle with three ranks in depth. Pure state and rules, no DOM.
// Contract: lab/game-studies/PROTOTYPE-SPEC.md sections 2 and 3, changed and extended by lab/game-studies/SPEC-V2.md
// sections 1 to 5 (and the "Changes" at the bottom of both). The page feeds one input per fixed step and empties
// `events`. Everything random comes from the seeded generator in the game state, so the same seed and the same
// inputs replay the same battle.
//
// World: x runs 0..WORLD.w, the ground is y = 0 and up is positive. Distances are in px, times in seconds.
// Foot units stand on one of three lanes, which are ranks in depth: a body blocks only bodies of its own lane,
// and a blow reaches any foe within its reach in x, whatever the lane. Units belong to a formation (the warband
// is one, every Shang group is one); the formation moves as a block and its units fight from their places.

export const WORLD = {w: 4800};
export const STEP = 1 / 60;
export const LAST_WAVE = 6;
export const LANES = 3;

export const HERO = {
  half: 46, height: 110, startX: 600, hp: 100,
  accel: 620, top: 520, brake: 900, coast: 260,
  leapMin: 180, leapV: 560, gravity: 1600,
  safe: .35,           // cannot be hit again for this long after a hit
  hurtTime: .2,        // how long `state` reads 'hurt' (display only: control is kept)
  stopTime: .3,        // how long a braced spear holds the hero at a standstill
  fallTime: 1.8,       // from the blow that takes the last health to the end of the run
  fallSlow: .6,        // the riderless horse comes to a stop in about this long
  dodgeY: 40,          // at or above this height melee blows pass under the horse
  rest: 40,            // health given back when a wave is cleared
};
export const STRIKE = {
  wind: .05, active: .12, recover: .2, reach: 120, dmg: 12, speedPer: 260,
  freeze: .03, freezeBig: .06, freezeKill: .09, bigMult: 1.8,
  freezeCap: .15,      // at most this much hit-stop falls on the hero in any `freezeWindow` seconds
  freezeWindow: 1,
  stun: .25,           // a struck foe staggers, which breaks its wind-up
  cleave: 2,           // one strike cuts at most this many foes, nearest first
  keep: .85,           // every foe the blade meets takes this much off the horse's speed
};
export const SWEEP = {
  holdMin: .35,        // the strike key held this long and released gives a sweep
  holdFull: .8,        // held this long, the sweep breaks a brace
  slow: .5,            // the horse is held to this share of top speed while the blow is held
  wind: .06, active: .14, recover: .5,
  reach: 180, mult: .65, push: 60, breakStun: .8,
  stun: .05,           // a sweep breaks a wind-up and pushes, but holds nobody: the foe is at you again at once
  keep: .65,           // a sweep that meets anyone takes this much off the horse's speed, once
  open: 1,             // while the blow is held and until the sweep is over, the rider is open: he takes this much more
};
export const SLAM = {
  reach: 150, dmg: 15,
  height: 93,          // the height of a plain leap: the shock's damage is `dmg` at this height and rises with it
  stun: .4, recover: .2,
};
export const CRY = {
  on: .9, off: .7, time: .8,
  trample: 2,          // trample damage is multiplied by this in full cry
  keep: .9,            // and a trampled foe takes less off the horse's speed
};
export const GALLOP = {cd: 12, time: .5, speed: 1.6, life: 2.5, dps: 8};
export const RALLY = {cd: 20, time: 6, range: 450, haste: 2, show: .6};
export const FIRE = {tick: .25};
export const TRAMPLE = {speed: 260, dmg: 10, stun: .7, keep: .75, again: .9};
export const BRACE = {
  range: 460, set: .35, speed: 200, dmg: 18,
  reach: 96,           // centre-to-centre distance at which the spear point meets the horse
  closing: 40,         // the hero counts as closing above this speed toward the spear
  patience: .8,        // a brace is dropped when the hero has not been closing for this long
  clear: 150,          // a spear braces from the first or second file: at most one comrade of its lane this near in front
  firstShare: .5,      // the first time in a run a spear stops the hero, it does this share of the damage
};
export const UNIT = {
  half: 16, height: 56, deadTime: 1.2, turn: .4, attackShow: .18, landSlack: 12,
  body: 44,            // no two living foot units of one lane stand closer than this between centres
  gap: 12,             // opposing fronts stand this much further apart than a body and fight across the gap
  file: 48,            // from one file of a block to the next
  brick: 15,           // each rank stands this much further along x than the one before: no two of a block share an x
  wall: 1 / 3,         // a shield beside another shield takes this share from the front instead of half
  push: 40,            // px/s at which two bodies that overlap (a recruit set down in the block) ease apart
  holdBlow: .5,        // how long a raised weapon waits for a hero who is riding in
  cover: 60,           // a shield takes the arrows meant for anyone this near behind it
  stagger: .3,         // a Zhou unit struck by an axe or the captain loses this long (not when rallied)
};
export const FORM = {
  turn: 2.5,           // a Shang block faces about when its enemy has been behind it this long
  turnZhou: 4,         // the warband is slower to do it: every turn about opens its ranks
  behind: 150,         // follow: the hero must be this far behind the block's last file before it turns to him
  reform: 4,           // at most this long its members may pass one another to take their new places
  clear: 300,          // nor while an enemy is this near its files
  settle: 12,          // the warband does not face about again within this long of the last time
  hurry: 4,            // and they move this much faster while they do
  seek: 9999,          // a Shang block goes for the nearest Zhou foot unit while one lives within this, otherwise for the hero
  standHero: 62,       // a block's first file stops this far from the hero
  standOff: 80,        // a block of archers alone stops this far inside its range
  balance: 1,          // seconds between two units changing lane to even the ranks
};
// Shang kinds. `reach` is against a foot unit, `reachHero` against the hero (centre to centre).
export const FOE = {
  shield: {hp: 110, speed: 55, dmg: 8, wind: .4, between: 1.2, reach: 62, reachHero: 70, cost: 2, from: 2, weight: 2, rank: 0},
  axe: {hp: 95, speed: 85, dmg: 16, wind: .5, between: 1.5, reach: 62, reachHero: 74, cost: 1.5, from: 2, weight: 3, rank: 0},
  spear: {hp: 80, speed: 60, dmg: 12, wind: .45, between: 1.3, reach: 110, reachHero: 86, cost: 1.5, from: 1, weight: 3, rank: 1},
  archer: {hp: 40, speed: 70, dmg: 9, wind: .7, between: 2.6, reach: 0, reachHero: 0, cost: 1.5, from: 3, weight: 1, rank: 3,
    maxShare: 1 / 3,   // at most this share of a group are archers
    range: 620,
    heroRange: 760,    // an archer shoots at the hero when the hero is this near, whoever else is nearer
    flight: .9, lead: .9, gravity: 900, spread: 30, fromY: 44},
  captain: {hp: 320, speed: 50, dmg: 24, wind: 1.0, between: 3.2, reach: 150, reachHero: 170, cost: 0, from: 99, weight: 0, rank: 2,
    horn: 12, hornTime: 5, hornRange: 500, haste: 1.6, stagger: .5},
};
// Zhou kinds.
export const BAND = {
  shield: {hp: 110, speed: 130, dmg: 20, wind: .3, between: 1.0, reach: 62, rank: 0},
  spear: {hp: 70, speed: 150, dmg: 26, wind: .35, between: 1.05, reach: 110, rank: 1,
    braceRange: 170, braceBonus: 1.5, braceStagger: .4,
    cover: 1.5,        // a spear with a shield standing before it thrusts this much harder, and is not staggered
    coverReach: 80},
  archer: {hp: 40, speed: 150, dmg: 24, wind: .6, between: 1.5, reach: 0, rank: 3,
    range: 560, flight: .8, lead: .6, spread: 24, shy: 90, wait: 1,
    volley: 1.5,       // arrows loosed together by two archers or more do this much more, and stagger
    volleyStagger: .3},
  veteran: 1.4,        // a veteran has this many times the health and the damage
  first: 70,           // follow: the first file's place behind the hero
  start: {shield: 3, spear: 3, archer: 2},
};
export const WAVE = {
  budget: [6, 24, 40, 56, 72, 66],
  leftFrom: 4,         // from this wave on, every second group enters from the left
  hp: [1, 1.25, 1.5, 1.75, 2, 2.25],     // Shang health in each wave, as a multiple of its base
  dmg: [1, 1.06, 1.12, 1.18, 1.24, 1.3], // and the damage of Shang blows and arrows
  groupMin: 6, groupMax: 9,
  groupLeast: 5,       // no group smaller than this is sent: a wave does not end on a straggler or two
  first: 1.0,          // seconds from the wave's start to its first group
  gap: 11,             // seconds between groups
  ahead: 1100,         // how far from the hero the head of a group enters (beyond the edge of the view)
  loneLead: 5,         // wave 1 opens with one spearman, this many seconds ahead of the rest
  rest: 2,             // seconds from the pick to the next wave
  guard: ['shield', 'shield', 'axe', 'spear', 'spear', 'spear', 'captain', 'archer', 'archer'],
};
export const ORDERS = ['follow', 'charge', 'hold'];

// The five elements. `feeds` is the generating cycle: wood feeds fire, fire earth, earth metal, metal water,
// water wood. A boon is `strong` times stronger when the player also owns a boon of the element that feeds its own.
export const ELEMENTS = {
  fire: {feeds: 'earth'}, earth: {feeds: 'metal'}, metal: {feeds: 'water'}, water: {feeds: 'wood'}, wood: {feeds: 'fire'},
};
export const CYCLE = {strong: 1.3};
// Boons as data: the element, the verb or troop the boon changes (`on`), and its numbers. The rules read the
// numbers from here; `power(game, id)` multiplies the ones named in `scales`.
export const BOONS = {
  emberBlade: {element: 'fire', on: 'strike', life: 2, dps: 6, scales: ['dps']},
  wildfire: {element: 'fire', on: 'gallop', length: 2, burst: 26, burstReach: 120, scales: ['burst']},
  coldTide: {element: 'water', on: 'sweep', reach: 420, slow: .5, time: 3, scales: ['time']},
  spring: {element: 'water', on: 'warband', mend: 1.5, scales: ['mend']},
  galeLeap: {element: 'wood', on: 'leap', height: 1.5, throw: 120, gust: 110, gustDmg: 8, gustStun: .3, scales: ['throw']},
  arrowRain: {element: 'wood', on: 'archer', arrows: 3, fan: 48, scales: []},
  keenEdge: {element: 'metal', on: 'strike', every: 3, mult: 2, scales: ['mult']},
  mirrorShields: {element: 'metal', on: 'shield', dmg: 2, scales: ['dmg']},
  quake: {element: 'earth', on: 'leapStrike', width: 2, hold: 1, scales: ['hold']},
  deepRoots: {element: 'earth', on: 'hero', hp: 40, scales: ['hp']},
};
export const ARMY = {
  levyShield: {kind: 'shield', count: 4}, levySpear: {kind: 'spear', count: 4}, levyArcher: {kind: 'archer', count: 4},
  drill: {count: 4},
};
/** Every slip the game can offer: id -> {type, element?, on?, kind?, count?}. */
export const SLIPS = Object.fromEntries([
  ...Object.entries(BOONS).map(([id, b]) => [id, {type: 'boon', element: b.element, on: b.on}]),
  ...Object.entries(ARMY).map(([id, a]) => [id, {type: 'army', ...a}]),
]);
export const UPGRADES = Object.keys(SLIPS);

const EPS = 1e-9;
const approach = (v, to, by) => v < to ? Math.min(to, v + by) : Math.max(to, v - by);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const setState = (u, s) => { if (u.state !== s) { u.state = s; u.stateT = 0; } };
const alive = u => u.state !== 'dead';
const kindOf = u => u.side === 'zhou' ? BAND[u.kind] : FOE[u.kind];
const push = (g, type, x, y, more) => g.events.push({type, x, y, ...more});
// A shove is a speed that dies away at 8 a second; this many times the distance gives that distance.
const SHOVE = 8 / (1 - 8 * STEP);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Does the player own this boon? */
export const has = (g, id) => g.hero.boons.some(b => b.id === id);
/** 1, or CYCLE.strong when the player also owns a boon of the element that feeds this boon's element. */
export function power(g, id) {
  const el = BOONS[id].element;
  return g.hero.boons.some(b => ELEMENTS[b.element].feeds === el) ? CYCLE.strong : 1;
}
const num = (g, id, key) => BOONS[id][key] * (BOONS[id].scales.includes(key) ? power(g, id) : 1);

export function createGame(seed = 1) {
  const g = {
    seed, rand: mulberry32(seed), t: 0, phase: 'fight', wave: 0, choices: null,
    order: 'follow', holdX: HERO.startX,
    stats: {kills: 0, best: 0, bestMult: 1, time: 0, lost: 0, by: {}, hurtBy: {}},
    hero: {x: HERO.startX, y: 0, px: HERO.startX, py: 0, vx: 0, vy: 0, facing: 1, hp: HERO.hp, maxHp: HERO.hp,
      state: 'ride', stateT: 0, topSpeed: HERO.top, blade: 1, safe: 0,
      hold: 0, fullCry: false, cd: {gallop: 0, rally: 0}, buffs: [], boons: [],
      air: false, airT: 0, peak: 0, slam: false, strikeT: -1, struck: [], gold: false, strikes: 0,
      sweepT: -1, sweepFull: false, sweepKept: false, pressed: false,
      hurtT: 0, stopT: 0, fallT: 0, fallBrake: 0, dashT: 0, dashFire: null, rallyT: 0, rallyShow: 0, cryT: 0,
      hang: 0, hangLog: [], bufLeap: false, bufStrike: false, landed: false},
    units: [], arrows: [], events: [],
    forms: [{id: 0, side: 'zhou', dir: 1, x: HERO.startX - BAND.first, turnT: 0, reform: 0, laneT: 0, settle: 0}],
    fires: [], spawns: [], nextWaveAt: null, freeze: 0, nextId: 1, nextForm: 1,
    taught: false, rootsUsed: false, rout: false, loosed: 0, loosedX: 0,
  };
  muster(g, BAND.start);
  startWave(g);
  return g;
}

const rankOf = u => kindOf(u).rank;
/** A unit's x with its rank's brick offset taken out, so that the fronts of three ranks compare as one line. */
const flat = u => u.x - (u.lane - 1) * UNIT.brick;
/** Where a unit stands in its block: files front to back, each rank a third of a body further along x. */
const placeOf = (F, u, file = u.file) => clamp(F.x - F.dir * file * UNIT.file + (u.lane - 1) * UNIT.brick, UNIT.half, WORLD.w - UNIT.half);

/**
 * Add a unit. `side` is 'zhou' or 'shang'. opts: {facing, lane, form, veteran}. With no lane given the unit takes
 * the lane of its formation that has the fewest of its kind. A Shang unit added with no `form` is a block of its
 * own. Used by the game, and by tests and benchmarks.
 */
export function addUnit(g, side, kind, x, opts = {}) {
  const k = (side === 'zhou' ? BAND : FOE)[kind];
  if (!k || typeof k !== 'object') throw new Error(`no ${side} kind ${kind}`);
  x = clamp(x, UNIT.half, WORLD.w - UNIT.half);
  const facing = opts.facing || (side === 'zhou' ? g.forms[0].dir : (g.hero.x >= x ? 1 : -1));
  const form = opts.form ?? (side === 'zhou' ? 0 : newForm(g, 'shang', facing, x).id);
  let lane = opts.lane;
  if (lane === undefined) {
    const mates = g.units.filter(u => alive(u) && u.form === form), n = l => mates.filter(u => u.lane === l);
    lane = 0;
    for (let l = 1; l < LANES; l++) {
      const a = n(l), b = n(lane), ak = a.filter(u => u.kind === kind).length, bk = b.filter(u => u.kind === kind).length;
      if (ak < bk || (ak === bk && a.length < b.length)) lane = l;
    }
  }
  const vet = opts.veteran ? BAND.veteran : 1;
  const u = {id: g.nextId++, side, kind, veteran: !!opts.veteran, x, px: x, lane, facing,
    hp: Math.round(k.hp * vet), maxHp: Math.round(k.hp * vet), state: 'idle', stateT: 0, flash: 0,
    form, file: 0, rank: 0, vx: 0, kb: 0, dmg: k.dmg * vet, cd: side === 'zhou' ? 0 : .2 + g.rand() * .6,
    stun: 0, hang: 0, tcd: 0, turnT: 0, slow: 0, rallyT: 0, hasteT: 0, hornT: 0, waitT: 0, tgt: 0, shots: 0,
    calm: 0, set: false, late: false, aimX: 0};
  g.units.push(u);
  return u;
}

function newForm(g, side, dir, x) {
  const f = {id: g.nextForm++, side, dir, x, turnT: 0, reform: 0, laneT: 0, settle: 0};
  g.forms.push(f);
  return f;
}

/** A unit's place in its block: its lane's members stand in files front to back by kind, then by age. */
function fileOf(g, u) {
  let n = 0;
  const b = rankOf(u);
  for (const c of g.units) {
    if (c === u || !alive(c) || c.form !== u.form || c.lane !== u.lane) continue;
    const a = rankOf(c);
    if (a < b || (a === b && c.id < u.id)) n += 1;
  }
  return n;
}

/**
 * Set a formed block down with its first file at `x`, facing `dir`: for 'shang' a new block, for 'zhou' the warband
 * (which is moved there). Returns the units. Used for entering groups, and by tests and benchmarks.
 */
export function addBlock(g, side, kinds, x, dir) {
  const F = side === 'zhou' ? g.forms[0] : newForm(g, 'shang', dir, x), table = side === 'zhou' ? BAND : FOE;
  F.x = x; F.dir = dir;
  return [...kinds].sort((a, b) => table[a].rank - table[b].rank).map(kind => {
    const u = addUnit(g, side, kind, x, {form: F.id, facing: dir});
    u.file = fileOf(g, u);
    u.x = u.px = placeOf(F, u);
    return u;
  });
}

/** Set Zhou units down in their places in the block. {shield, spear, archer} are counts. */
function muster(g, counts, veteran = false) {
  const F = g.forms[0], out = [], old = g.units.some(u => alive(u) && u.form === 0);
  for (const kind of ['shield', 'spear', 'archer']) {
    for (let i = 0; i < (counts[kind] || 0); i++) out.push(addUnit(g, 'zhou', kind, F.x, {form: 0, facing: F.dir, veteran}));
  }
  // The block is drawn up afresh with the newcomers in their places. A levy comes between waves, with no enemy
  // on the field, so nobody has to push past anybody.
  if (old) F.x = clamp(g.hero.x - F.dir * BAND.first, UNIT.half + UNIT.brick, WORLD.w - UNIT.half - UNIT.brick);
  for (const u of g.units) {
    if (!alive(u) || u.form !== 0) continue;
    u.file = fileOf(g, u);
    u.x = placeOf(F, u);
    if (out.includes(u)) u.px = u.x;
  }
  return out;
}

/** What a wave is made of: the wave's budget spent on the kinds unlocked so far, already split into groups. */
export function waveBudget(wave) { return WAVE.budget[Math.min(wave, WAVE.budget.length) - 1]; }
export function waveGroups(wave, rand) {
  if (wave === 1) return [['spear'], ['spear', 'spear', 'spear']];     // one spearman alone, so the first brace is met alone
  let budget = waveBudget(wave);
  const open = k => FOE[k].from <= wave, cost = list => list.reduce((s, k) => s + FOE[k].cost, 0);
  const pickFront = () => {
    const pool = ['shield', 'axe'].filter(open);
    let pick = rand() * pool.reduce((s, k) => s + FOE[k].weight, 0);
    for (const k of pool) if ((pick -= FOE[k].weight) < 0) return k;
    return pool[pool.length - 1];
  };
  const groups = [];
  for (;;) {
    // a block is one file of shields and axes, one of spears whose reach passes them, and archers behind:
    // everyone in it can fight
    const size = WAVE.groupMin + Math.floor(rand() * (WAVE.groupMax - WAVE.groupMin + 1));
    const group = [pickFront(), pickFront(), pickFront(), 'spear', 'spear', 'spear'];
    for (let i = 6; i < size && open('archer'); i++) group.push('archer');
    while (cost(group) > budget && group.length > WAVE.groupLeast) group.pop();
    if (cost(group) > budget) break;                      // what is left would not make a group: it is not sent
    groups.push(group.sort((a, b) => FOE[a].rank - FOE[b].rank));
    budget -= cost(group);
  }
  if (wave >= LAST_WAVE) groups.push([...WAVE.guard]);        // the captain and his guard come last
  return groups;
}
export function waveRoster(wave, rand) { return waveGroups(wave, rand).flat(); }

function startWave(g) {
  g.wave += 1; g.phase = 'fight'; g.choices = null; g.nextWaveAt = null; g.rootsUsed = false;
  const groups = waveGroups(g.wave, g.rand);
  groups.forEach((kinds, n) => {
    const at = g.t + WAVE.first + (n === 0 ? 0 : g.wave === 1 ? WAVE.loneLead + (n - 1) * WAVE.gap : n * WAVE.gap);
    g.spawns.push({at, kinds, side: g.wave >= WAVE.leftFrom && n % 2 === 1 ? -1 : 1});
  });
  push(g, 'wave', g.hero.x, 0, {wave: g.wave, count: groups.reduce((s, k) => s + k.length, 0)});
}

// A group enters as a formed block beyond the edge of the view, on its side of the hero, first file nearest
// the hero. When the hero is too near that end of the world, the group enters from the other side instead.
function spawnGroup(g, group) {
  const h = g.hero, depth = WAVE.ahead + Math.ceil(group.kinds.length / LANES) * UNIT.file;
  const room = side => side > 0 ? h.x + depth <= WORLD.w - 40 : h.x - depth >= 40;
  const side = room(group.side) ? group.side : -group.side;
  const at = list => list[Math.min(g.wave, list.length) - 1], hp = at(WAVE.hp), dmg = at(WAVE.dmg);
  for (const u of addBlock(g, 'shang', group.kinds, h.x + side * WAVE.ahead, -side)) {
    if (u.kind !== 'captain') { u.hp = u.maxHp = Math.round(FOE[u.kind].hp * hp); u.dmg = Math.round(FOE[u.kind].dmg * dmg); }
  }
}

function offerChoices(g) {
  const h = g.hero, band = g.units.filter(u => u.side === 'zhou' && alive(u));
  const pick = list => list.splice(Math.floor(g.rand() * list.length), 1)[0];
  const boons = Object.keys(BOONS).filter(id => !has(g, id));
  const army = ['levyShield', 'levySpear', 'levyArcher'];
  // every offer has at least one element boon and one army slip; the third is a boon more often than not
  const out = [];
  const nBoon = Math.min(boons.length, g.rand() < .3 || band.length < 4 ? 1 : 2);
  for (let i = 0; i < nBoon; i++) out.push(pick(boons));
  out.push(pick(army));
  if (out.length < 3) out.push(band.some(u => !u.veteran) && band.length >= 2 ? 'drill' : pick(army));
  g.choices = out; g.phase = 'choose';
  if (h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + HERO.rest);
  if (has(g, 'spring')) for (const u of band) u.hp = u.maxHp;
}

function applyChoice(g, id) {
  const h = g.hero, slip = SLIPS[id];
  if (slip.type === 'boon') {
    h.boons.push({id, element: slip.element});
    if (id === 'deepRoots') { const hp = Math.round(num(g, id, 'hp')); h.maxHp += hp; h.hp += hp; }
  } else if (id === 'drill') {
    const band = g.units.filter(u => u.side === 'zhou' && alive(u) && !u.veteran).sort((a, b) => rankOf(a) - rankOf(b) || a.id - b.id);
    for (const u of band.slice(0, ARMY.drill.count)) {
      u.veteran = true; u.dmg *= BAND.veteran;
      u.hp = Math.round(u.hp * BAND.veteran); u.maxHp = Math.round(u.maxHp * BAND.veteran);
    }
  } else muster(g, {[slip.kind]: slip.count});
  push(g, 'upgrade', h.x, h.y, {id});
  if (slip.type === 'boon') push(g, 'boon', h.x, h.y, {id, element: slip.element});
}

// ------------------------------------------------------------------------------------------------- damage

// `fromX` is where the blow came from; the rider is pushed the other way. `by` names the source.
function hurtHero(g, dmg, fromX, by) {
  const h = g.hero;
  if (h.safe > 0 || h.fallT > 0 || h.dashT > 0 || g.phase === 'lost' || g.phase === 'won') return false;
  if (h.hold >= SWEEP.holdMin || h.sweepT >= 0) dmg = Math.round(dmg * SWEEP.open);
  h.hp -= dmg; h.safe = HERO.safe; h.hurtT = HERO.hurtTime;
  g.stats.hurtBy[by] = (g.stats.hurtBy[by] || 0) + dmg;
  push(g, 'hurt', h.x, h.y + HERO.height * .5, {dmg, by});
  if (h.hp <= 0) {
    // the rider falls; the run ends when HERO.fallTime is up (see step)
    h.hp = 0; h.fallT = HERO.fallTime; h.fallBrake = Math.abs(h.vx) / HERO.fallSlow;
    h.strikeT = -1; h.sweepT = -1; h.stopT = 0; h.hurtT = 0; h.hang = 0; h.hold = 0; h.pressed = false; h.slam = false;
    if (h.fullCry) { h.fullCry = false; push(g, 'fullCry', h.x, h.y, {on: false}); }
    push(g, 'fall', h.x, h.y, {dir: fromX < h.x ? 1 : fromX > h.x ? -1 : -h.facing});
  }
  return true;
}

/**
 * Take health off a unit. o: {from: x of the attacker (a blow or arrow that a shield can meet), by: source for
 * the tally, pierce: goes through a shield}. Returns {kill, blocked, dmg}.
 */
function hurtUnit(g, u, dmg, o = {}) {
  let blocked = false;
  if (u.kind === 'shield' && o.from !== undefined && !o.pierce && u.stun <= 0 && (o.from - u.x) * u.facing > 0) {
    // a shield takes half from the front; shields side by side lock, and take a third
    const wall = g.units.some(c => c !== u && c.side === u.side && c.kind === 'shield' && alive(c) && c.stun <= 0 && c.lane !== u.lane && Math.abs(flat(c) - flat(u)) < UNIT.body);
    dmg *= wall ? UNIT.wall : .5; blocked = true;
  }
  dmg = Math.min(dmg, u.hp);
  u.hp -= dmg; u.flash = .1;
  if (u.side === 'shang' && o.by) g.stats.by[o.by] = (g.stats.by[o.by] || 0) + dmg;
  if (blocked) push(g, 'blocked', u.x + u.facing * UNIT.half, UNIT.height * .6, {side: u.side});
  if (u.hp > EPS) return {kill: false, blocked, dmg};
  u.hp = 0; u.state = 'dead'; u.stateT = 0; u.stun = 0;
  if (u.side === 'shang') g.stats.kills += 1; else g.stats.lost += 1;
  if (u.kind === 'captain' && !g.rout) { g.rout = true; push(g, 'rout', u.x, UNIT.height); }
  return {kill: true, blocked, dmg};
}

/** The hero's blow holds the hero and the foes it met, and nobody else; holds do not add up or chain. */
function hang(g, seconds, units, dt) {
  const h = g.hero, wish = Math.round(seconds / dt);
  const spent = h.hangLog.filter(t => t > g.t - STRIKE.freezeWindow + EPS).length;
  const steps = Math.max(0, Math.min(wish, Math.round(STRIKE.freezeCap / dt) - spent));
  h.hang = Math.max(h.hang, steps);
  for (const u of units) u.hang = Math.max(u.hang, steps && steps + 1);
}

/** Lay fire on the ground from x0 to x1 for `life` seconds. */
function burn(g, x0, x1, life, dps, by) {
  const f = {x0, x1, until: g.t + life, dps, by, tick: FIRE.tick};
  g.fires.push(f);
  return f;
}

/** Is this a Shang spear whose brace is set and pointing at something that comes from `dir`? */
function setAgainst(u, dir) {
  return u.side === 'shang' && u.kind === 'spear' && u.state === 'brace' && u.set && !u.late && u.facing === -dir;
}

// --------------------------------------------------------------------------------------------------- hero

const foesOf = g => g.units.filter(u => u.side === 'shang' && alive(u));

function stepHero(g, input, dt) {
  const h = g.hero, top = h.topSpeed;
  h.px = h.x; h.py = h.y;
  if (h.safe > 0) h.safe = Math.max(0, h.safe - dt);
  if (h.hurtT > 0) h.hurtT -= dt;
  if (h.fallT > 0) input = {};
  const free = h.fallT <= 0 && h.stopT <= 0;

  // the strike key: a press strikes at once; held long enough and let go, it sweeps
  let sweepNow = false;
  if (input.strike) h.pressed = true;
  if (h.pressed && input.strikeHeld) h.hold += dt;
  else if (h.pressed) {
    sweepNow = h.hold >= SWEEP.holdMin - EPS && free && h.sweepT < 0;
    if (sweepNow) h.sweepFull = h.hold >= SWEEP.holdFull - EPS;
    h.pressed = false; h.hold = 0;
  }
  const holding = h.hold >= SWEEP.holdMin - EPS;

  if (h.fallT > 0) {
    // no rider: a leap in progress comes down first, then the horse slows to a stop
    if (!h.air) h.vx = approach(h.vx, 0, h.fallBrake * dt);
  } else if (h.stopT > 0) { h.stopT -= dt; h.vx = 0; }
  else if (h.dashT > 0) {
    h.vx = h.facing * GALLOP.speed * top;
  } else if (!h.air) {
    const m = input.move > 0 ? 1 : input.move < 0 ? -1 : 0, cap = holding ? top * SWEEP.slow : top;
    if (m === 0) h.vx = approach(h.vx, 0, HERO.coast * dt);
    else if (h.vx * m < 0) h.vx = approach(h.vx, 0, HERO.brake * dt);   // reversing brakes through zero first
    else h.vx = approach(h.vx, m * cap, (Math.abs(h.vx) > cap ? HERO.brake : HERO.accel) * dt);
    if (input.leap && Math.abs(h.vx) >= HERO.leapMin) {
      h.air = true; h.airT = 0; h.peak = 0; h.slam = false;
      h.vy = HERO.leapV * (has(g, 'galeLeap') ? Math.sqrt(BOONS.galeLeap.height) : 1);
      push(g, 'leap', h.x, 0);
    } else if (input.gallop && h.cd.gallop <= 0) {
      // flame gallop: a burst the hero cannot be hurt or stopped in, leaving fire where the hooves went
      h.dashT = GALLOP.time; h.cd.gallop = GALLOP.cd;
      h.vx = h.facing * GALLOP.speed * top;
      h.dashFire = burn(g, h.x, h.x, GALLOP.time + GALLOP.life, GALLOP.dps, 'gallop');
      push(g, 'dash', h.x, 0, {dir: h.facing});
    }
  }
  if (h.vx > 0) h.facing = 1; else if (h.vx < 0) h.facing = -1;

  if (h.air) {
    h.airT += dt;
    h.vy -= HERO.gravity * dt; h.y += h.vy * dt;
    h.peak = Math.max(h.peak, h.y);
    if (h.y <= 0) {
      h.y = 0; h.vy = 0; h.air = false; h.landed = true;
      push(g, 'land', h.x + h.vx * dt, 0, {speed: Math.abs(h.vx)});
    }
  }
  h.x += h.vx * dt;
  if (h.x < HERO.half) { h.x = HERO.half; h.vx = 0; }
  if (h.x > WORLD.w - HERO.half) { h.x = WORLD.w - HERO.half; h.vx = 0; }

  if (h.dashT > 0) {
    h.dashFire.x1 = h.x;
    h.dashT -= dt;
    if (h.dashT <= 0) endDash(g);
  }
  if (!h.air && h.slam) { h.slam = false; if (h.fallT <= 0) shock(g, dt); }
  else if (!h.air && h.landed && h.fallT <= 0 && has(g, 'galeLeap')) gust(g);
  h.landed = false;

  // full cry: the horse has been at speed long enough to break through
  if (!h.air) {
    const speed = Math.abs(h.vx);
    if (speed >= CRY.on * top - EPS && h.fallT <= 0) h.cryT += dt;
    else h.cryT = 0;                                      // any drop under 90% and the 0.8 s begin again
    const on = h.cryT >= CRY.time - EPS;
    if (on !== h.fullCry && (on || speed < CRY.off * top)) { h.fullCry = on; push(g, 'fullCry', h.x, h.y, {on}); }
  }

  if (input.rally && h.cd.rally <= 0 && h.fallT <= 0) {
    h.cd.rally = RALLY.cd; h.rallyT = RALLY.time; h.rallyShow = RALLY.show;
    for (const u of g.units) if (u.side === 'zhou' && alive(u) && Math.abs(u.x - h.x) <= RALLY.range) { u.rallyT = RALLY.time; u.stun = 0; u.cd = 0; }   // and every weapon is ready at once
    push(g, 'rally', h.x, h.y + HERO.height);
  }

  // strike
  if (h.strikeT >= 0) {
    h.strikeT += dt;
    if (h.strikeT >= STRIKE.wind + STRIKE.active + STRIKE.recover - EPS) h.strikeT = -1;
  } else if (input.strike && free && h.sweepT < 0) {
    if (h.air && h.vy < 0) h.slam = true;                 // struck while coming down: the blow lands with the horse
    else if (!h.slam) {
      h.strikeT = 0; h.struck = []; h.strikes += 1;
      h.gold = has(g, 'keenEdge') && h.strikes % BOONS.keenEdge.every === 0;
      push(g, 'swing', h.x, h.y + HERO.height * .6, {dir: h.facing, gold: h.gold});
      if (has(g, 'emberBlade')) {
        const x1 = clamp(h.x + h.facing * (STRIKE.reach + UNIT.half), 0, WORLD.w);
        burn(g, h.x, x1, BOONS.emberBlade.life, num(g, 'emberBlade', 'dps'), 'emberBlade');
        push(g, 'trail', h.x, 0, {x0: h.x, x1, kind: 'ember', life: BOONS.emberBlade.life});
      }
    }
  }
  if (h.strikeT >= STRIKE.wind - EPS && h.strikeT < STRIKE.wind + STRIKE.active - EPS) {
    const inReach = u => { const ahead = (u.x - h.x) * h.facing; return ahead >= -UNIT.half && ahead <= STRIKE.reach + UNIT.half; };
    const cut = foesOf(g).filter(u => !h.struck.includes(u.id) && inReach(u))
      .sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x) || a.id - b.id);
    let longest = 0;
    const met = [];
    for (const u of cut) {
      if (h.struck.length >= STRIKE.cleave) break;
      h.struck.push(u.id);
      const dir = u.x > h.x ? 1 : u.x < h.x ? -1 : h.facing;
      if (!h.air && setAgainst(u, dir)) {
        // a set spear turns a blade that comes at it along the ground from the front
        push(g, 'clash', u.x - dir * UNIT.half, UNIT.height * .65, {side: 'shang', kill: false});
        continue;
      }
      const closing = Math.max(0, (h.vx - u.vx) * dir), mult = 1 + closing / STRIKE.speedPer;
      const base = STRIKE.dmg * h.blade * mult, gold = h.gold ? num(g, 'keenEdge', 'mult') : 1;
      const r = hurtUnit(g, u, Math.round(base), {from: h.x, by: 'strike', pierce: h.gold});
      let dmg = r.dmg;
      if (gold > 1 && !r.kill) dmg += hurtUnit(g, u, Math.round(base * (gold - 1)), {by: 'keenEdge', pierce: true}).dmg;
      const kill = !alive(u);
      if (h.gold) push(g, 'crit', u.x, UNIT.height * .65, {dmg});
      if (!kill) { u.stun = Math.max(u.stun, STRIKE.stun); setState(u, 'stun'); u.kb += dir * (70 + closing * .3); }
      if (dmg > g.stats.best) { g.stats.best = dmg; g.stats.bestMult = mult; }
      push(g, 'hit', u.x, UNIT.height * .65, {dmg, mult, kill, dir, by: 'strike', gold: h.gold});
      if (!h.air) h.vx *= STRIKE.keep;
      longest = Math.max(longest, kill ? STRIKE.freezeKill : mult >= STRIKE.bigMult ? STRIKE.freezeBig : STRIKE.freeze);
      met.push(u);
    }
    if (met.length) hang(g, longest, met, dt);
  }

  // sweep
  if (sweepNow) {
    h.sweepT = 0; h.strikeT = -1; h.struck = []; h.sweepKept = false;
    push(g, 'sweep', h.x, h.y + HERO.height * .5, {dir: h.facing, full: h.sweepFull, tide: has(g, 'coldTide')});
    if (has(g, 'coldTide')) {
      const b = BOONS.coldTide;
      for (const u of foesOf(g)) { const a = (u.x - h.x) * h.facing; if (a >= 0 && a <= b.reach) u.slow = Math.max(u.slow, num(g, 'coldTide', 'time')); }
    }
  } else if (h.sweepT >= 0) {
    h.sweepT += dt;
    if (h.sweepT >= SWEEP.wind + SWEEP.active + SWEEP.recover - EPS) h.sweepT = -1;
  }
  if (h.sweepT >= SWEEP.wind - EPS && h.sweepT < SWEEP.wind + SWEEP.active - EPS) {
    const met = [];
    let killed = false;
    for (const u of foesOf(g)) {
      const ahead = (u.x - h.x) * h.facing;
      if (h.struck.includes(u.id) || ahead < -UNIT.half || ahead > SWEEP.reach + UNIT.half) continue;
      h.struck.push(u.id);
      const dir = u.x > h.x ? 1 : u.x < h.x ? -1 : h.facing;
      if (!h.air && setAgainst(u, dir) && !h.sweepFull) {
        push(g, 'clash', u.x - dir * UNIT.half, UNIT.height * .65, {side: 'shang', kill: false});
        continue;
      }
      const broke = setAgainst(u, dir);                   // only a full sweep gets here against a set spear
      const closing = Math.max(0, (h.vx - u.vx) * dir), mult = 1 + closing / STRIKE.speedPer;
      const r = hurtUnit(g, u, Math.round(STRIKE.dmg * SWEEP.mult * h.blade * mult), {from: h.x, by: 'sweep'});
      if (!r.kill) {
        const stun = broke ? SWEEP.breakStun : SWEEP.stun;
        if (stun > 0) { u.stun = Math.max(u.stun, stun); setState(u, 'stun'); }
        u.kb += dir * SWEEP.push * SHOVE;
      }
      if (r.dmg > g.stats.best) { g.stats.best = r.dmg; g.stats.bestMult = mult; }
      push(g, 'hit', u.x, UNIT.height * .65, {dmg: r.dmg, mult, kill: r.kill, dir, by: 'sweep', broke});
      killed = killed || r.kill;
      met.push(u);
    }
    if (met.length) {
      if (!h.air && !h.sweepKept) { h.vx *= SWEEP.keep; h.sweepKept = true; }
      hang(g, killed ? STRIKE.freezeKill : STRIKE.freezeBig, met, dt);
    }
  }
}

function endDash(g) {
  const h = g.hero, f = h.dashFire;
  h.dashT = 0; h.dashFire = null;
  h.vx = h.facing * h.topSpeed;
  let life = GALLOP.life;
  if (has(g, 'wildfire')) {
    // the trail burns twice as long, and bursts where the burst of speed ends: among them
    const b = BOONS.wildfire;
    const more = burn(g, f.x0, f.x1, GALLOP.life * b.length, GALLOP.dps, 'wildfire');
    more.from = g.t + GALLOP.life;
    life = GALLOP.life * b.length;
    for (const u of foesOf(g)) {
      if (Math.abs(u.x - h.x) > b.burstReach) continue;
      const r = hurtUnit(g, u, num(g, 'wildfire', 'burst'), {by: 'wildfire'});
      if (!r.kill) { u.stun = Math.max(u.stun, STRIKE.stun); setState(u, 'stun'); }
      push(g, 'hit', u.x, UNIT.height * .5, {dmg: r.dmg, mult: 1, kill: r.kill, dir: h.facing, by: 'wildfire'});
    }
    push(g, 'shock', h.x, 0, {power: power(g, 'wildfire'), kind: 'burst', reach: b.burstReach});
  }
  push(g, 'trail', f.x0, 0, {x0: f.x0, x1: f.x1, kind: 'gallop', life});
}

/** With galeLeap every landing throws back those around the horse, strike or no strike. */
function gust(g) {
  const h = g.hero, b = BOONS.galeLeap;
  for (const u of foesOf(g)) {
    if (Math.abs(u.x - h.x) > b.gust) continue;
    const r = hurtUnit(g, u, b.gustDmg, {by: 'galeLeap'});
    if (!r.kill) { u.stun = Math.max(u.stun, b.gustStun); setState(u, 'stun'); u.kb += (u.x >= h.x ? 1 : -1) * num(g, 'galeLeap', 'throw') * SHOVE; }
  }
  push(g, 'shock', h.x, 0, {power: .5, kind: 'gust', reach: b.gust, gale: true});
}

/** The leap strike lands: a shock along the ground both ways, harder the higher the fall. */
function shock(g, dt) {
  const h = g.hero, k = Math.max(.5, h.peak / SLAM.height), quake = has(g, 'quake'), gale = has(g, 'galeLeap');
  const reach = SLAM.reach * (quake ? BOONS.quake.width : 1), met = [];
  let killed = false;
  // coming down on set spear points is the leap strike's answer: the horse is taken on them and there is no shock
  const spike = foesOf(g).find(u => setAgainst(u, u.x >= h.x ? 1 : -1) && Math.abs(u.x - h.x) <= BRACE.reach);
  if (spike && h.dashT <= 0) {
    hurtHero(g, g.taught ? BRACE.dmg : Math.round(BRACE.dmg * BRACE.firstShare), spike.x, 'brace');
    g.taught = true;
    h.vx = 0; h.cryT = 0;
    if (h.fullCry) { h.fullCry = false; push(g, 'fullCry', h.x, h.y, {on: false}); }
    if (h.fallT <= 0) h.stopT = HERO.stopTime;
    push(g, 'braced', spike.x - (spike.x >= h.x ? 1 : -1) * UNIT.half, UNIT.height * .6, {slam: true});
    return;
  }
  for (const u of foesOf(g)) {
    const d = Math.abs(u.x - h.x);
    if (d > reach + UNIT.half) continue;
    if (u.kind === 'shield' && u.stun <= 0) {             // a shield is set against the shock and keeps its feet
      push(g, 'blocked', u.x, UNIT.height * .5, {side: 'shang', by: 'leapStrike'});
      continue;
    }
    const dir = u.x >= h.x ? 1 : -1, base = SLAM.dmg * h.blade * Math.min(k, 1), far = d > SLAM.reach + UNIT.half;
    // the tally: what a plain leap strike would have done is the verb's, the rest is the boon's
    let dmg = 0, kill = false;
    const r = hurtUnit(g, u, Math.round(base), {by: far ? 'quake' : 'leapStrike'});
    dmg += r.dmg; kill = r.kill;
    if (!kill && k > 1) { const r2 = hurtUnit(g, u, Math.round(SLAM.dmg * h.blade * (k - 1)), {by: 'galeLeap'}); dmg += r2.dmg; kill = r2.kill; }
    if (!kill) {
      u.stun = Math.max(u.stun, quake ? num(g, 'quake', 'hold') : SLAM.stun); setState(u, 'stun');
      if (gale) u.kb += dir * num(g, 'galeLeap', 'throw') * SHOVE;
    }
    push(g, 'hit', u.x, UNIT.height * .4, {dmg, mult: k, kill, dir, by: 'leapStrike'});
    killed = killed || kill;
    met.push(u);
  }
  push(g, 'shock', h.x, 0, {power: k, reach, quake, gale});
  h.strikeT = STRIKE.wind + STRIKE.active + STRIKE.recover - SLAM.recover;   // the rider recovers from the blow
  if (met.length) hang(g, killed ? STRIKE.freezeKill : STRIKE.freezeBig, met, dt);
}

// The one state the page draws. Read after everything in the step has had its say, so a blow shows at once.
function nameHeroState(h, dt) {
  const state = h.fallT > 0 || h.hp <= 0 ? 'fallen' : h.stopT > 0 ? 'stopped' : h.hurtT > 0 ? 'hurt' : h.dashT > 0 ? 'dash'
    : h.sweepT >= 0 ? 'sweep' : h.strikeT >= 0 || h.slam ? 'strike' : h.rallyShow > 0 ? 'rally' : h.air ? 'leap' : 'ride';
  if (state !== h.state) { h.state = state; h.stateT = 0; } else h.stateT += dt;
  if (state === 'strike' && h.strikeT >= 0) h.stateT = h.strikeT;
  else if (state === 'sweep') h.stateT = h.sweepT;
  else if (state === 'leap') h.stateT = h.airT;
  h.buffs = [h.rallyT > 0 && 'rally', h.dashT > 0 && 'dash', h.fullCry && 'fullCry'].filter(Boolean);
}

// -------------------------------------------------------------------------------------------- formations

function about(g, F, depth) {
  F.x = F.x - F.dir * (depth - 1) * UNIT.file;            // the rear becomes the front, where it stands
  F.dir = -F.dir; F.turnT = 0; F.reform = FORM.reform; F.settle = FORM.settle;
}
const depthOf = mem => Math.max(1, ...[0, 1, 2].map(l => mem.filter(u => u.lane === l).length));
/** Are two men of a re-forming block on the wrong side of each other? Only then may one pass the other. */
const misplaced = (F, a, b) => (b.file - a.file) * (b.x - a.x) * F.dir > 0;

/** Move every block: follow, hold, or go for the nearest enemy and stop a fighting distance short of him. */
function stepForms(g, dt) {
  const h = g.hero, live = g.units.filter(alive);
  for (const F of [...g.forms]) {
    const mem = live.filter(u => u.form === F.id);
    if (!mem.length) {
      if (F.id !== 0) g.forms.splice(g.forms.indexOf(F), 1);
      else if (g.order !== 'hold') { F.dir = h.facing; F.x = h.x - F.dir * BAND.first; }
      continue;
    }
    if (F.reform > 0) {
      // re-forming is over as soon as every rank stands in its order with room between the men
      F.reform -= dt;
      let sorted = true;
      for (let l = 0; l < LANES && sorted; l++) {
        const row = mem.filter(u => u.lane === l).sort((a, b) => a.file - b.file);
        for (let i = 1; i < row.length; i++) if ((row[i - 1].x - row[i].x) * F.dir < UNIT.body - 1) { sorted = false; break; }
      }
      if (sorted) F.reform = 0;
    }
    const speed = Math.min(...mem.map(u => kindOf(u).speed * (u.slow > 0 ? BOONS.coldTide.slow : 1)));
    const depth = depthOf(mem);
    const enemies = live.filter(u => u.side !== F.side);
    let mode = F.side === 'shang' ? 'charge' : g.order, target = F.x, turn = false, chasing = false;
    const at = c => c === h ? h.x : flat(c), zhou = F.side === 'zhou';
    if (mode === 'charge' && !enemies.length && zhou) mode = 'follow';
    if (mode === 'follow') {
      // the block trails the hero; it faces about only when he has ridden off behind its last file and stays that way
      turn = h.facing !== F.dir && (h.x - (F.x - F.dir * (depth - 1) * UNIT.file)) * F.dir < -FORM.behind;
      target = h.x - F.dir * BAND.first;
    } else if (mode === 'hold') target = g.holdX;
    else {
      // the nearest enemy; the warband keeps its front and takes the nearest one ahead while there is one
      let e = null, bd = Infinity, front = null, fd = Infinity;
      for (const c of enemies) {
        const d = Math.abs(at(c) - F.x);
        if (d < bd) { bd = d; e = c; }
        if ((at(c) - F.x) * F.dir > -UNIT.body && d < fd) { fd = d; front = c; }
      }
      if (zhou && front) e = front;
      if (!zhou && h.fallT <= 0 && bd > FORM.seek) { e = h; chasing = true; }
      if (e) {
        turn = (at(e) - F.x) * F.dir < -UNIT.body;
        // a block that has only archers left to lead it stands off and shoots
        const lead = mem.every(u => u.kind === 'archer') ? kindOf(mem[0]).range - FORM.standOff : 0;
        if (!turn) target = at(e) - F.dir * (lead || (e === h ? FORM.standHero : UNIT.body + UNIT.gap));
      }
    }
    if (F.settle > 0) F.settle -= dt;
    // the warband opens its ranks to turn only when it has turned long ago and no enemy is upon it
    const pressed = zhou && (F.settle > 0 || enemies.some(c => Math.abs(c.x - F.x) < FORM.clear + depth * UNIT.file));
    F.turnT = turn && !pressed ? F.turnT + dt : 0;
    // a block does not open its ranks for a rider who is only passing behind it: its men turn where they stand
    if (F.turnT >= (zhou || chasing ? FORM.turnZhou : FORM.turn)) { about(g, F, depth); continue; }
    // never walk into the enemy: the first file stops a fighting distance short of the nearest body ahead
    let limit = Infinity;
    for (const c of enemies) { const a = (flat(c) - F.x) * F.dir; if (a > 0 && a < limit) limit = a; }
    const want = clamp((target - F.x) * F.dir, -speed * dt, speed * dt);
    F.x += F.dir * (want > 0 ? Math.min(want, Math.max(0, limit - UNIT.body - UNIT.gap)) : want);
    const back = (depth - 1) * UNIT.file;
    F.x = clamp(F.x, UNIT.half + UNIT.brick + (F.dir > 0 ? back : 0), WORLD.w - UNIT.half - UNIT.brick - (F.dir < 0 ? back : 0));
    // even the ranks: the last unit of the deepest lane steps over to the thinnest
    F.laneT -= dt;
    if (F.laneT <= 0) {
      const n = [0, 1, 2].map(l => mem.filter(u => u.lane === l).length);
      const hi = n.indexOf(Math.max(...n)), lo = n.indexOf(Math.min(...n));
      if (n[hi] - n[lo] >= 2) {
        const last = mem.filter(u => u.lane === hi && u.state !== 'windup' && u.hang <= 0).sort((a, b) => rankOf(b) - rankOf(a) || b.id - a.id)[0];
        if (last && !live.some(c => c.lane === lo && Math.abs(c.x - last.x) < UNIT.body)) { last.lane = lo; F.laneT = FORM.balance; }
      }
    }
  }
}

// --------------------------------------------------------------------------------------------- foot units

function nearestIn(list, x, max) {
  let best = null, bd = max + EPS;
  for (const o of list) { const d = Math.abs(o.x - x); if (d < bd) { bd = d; best = o; } }
  return best;
}
/** The enemy within `max` in x that `u` would rather fight: the nearest, and of equally near ones the one on its own lane. */
function facing(list, u, max) {
  let best = null, bs = Infinity;
  for (const o of list) {
    const d = Math.abs(flat(o) - flat(u));               // rank against rank: the brick offsets do not shorten or lengthen a reach
    if (d > max + EPS) continue;
    const score = d + Math.abs(o.lane - u.lane) * 40;       // ranks are bricked, so the man on one's own lane is not always the nearest
    if (score < bs) { bs = score; best = o; }
  }
  return best;
}

/** The haste of a unit's blows: rallied Zhou and horn-driven Shang strike faster, routed Shang slower. */
function haste(g, u) {
  if (u.side === 'zhou') return u.rallyT > 0 ? RALLY.haste : 1;
  return (u.hasteT > 0 ? FOE.captain.haste : 1) * (g.rout ? .5 : 1);
}

/** A Zhou spear with a living shield of its side standing just before it: it fights from cover. */
function covered(g, u) {
  return u.side === 'zhou' && u.kind === 'spear' && g.units.some(c => c.side === 'zhou' && c.kind === 'shield' && alive(c)
    && (c.x - u.x) * u.facing > 0 && Math.abs(c.x - u.x) <= BAND.spear.coverReach);
}

function landBlow(g, u, k, target) {
  const h = g.hero;
  if (target === h) { if (h.y < HERO.dodgeY) hurtHero(g, u.dmg, u.x, u.kind); return; }
  const r = hurtUnit(g, target, u.dmg * (covered(g, u) ? BAND.spear.cover : 1), {from: u.x, by: u.side === 'zhou' ? u.kind : undefined});
  if (!r.blocked || r.kill) push(g, 'clash', target.x, UNIT.height * .6, {side: u.side, kill: r.kill});
  if (!r.kill && !r.blocked && target.side === 'zhou' && target.rallyT <= 0 && !covered(g, target) && (u.kind === 'axe' || u.kind === 'captain')) {
    target.stun = Math.max(target.stun, k.stagger || UNIT.stagger); setState(target, 'stun');
  }
}

/**
 * A melee fighter in his place: wind up at the nearest enemy in reach, land the blow, wait. Returns true while
 * the unit is busy with a blow (and stands), false when it is free to walk to its place.
 */
function fight(g, u, k, enemies, dt) {
  const h = g.hero, heroOk = u.side === 'shang' && h.fallT <= 0;
  const reach = e => e === h ? k.reachHero : k.reach;
  const gapTo = e => e === h ? Math.abs(h.x - u.x) : Math.abs(flat(e) - flat(u));
  const inFront = e => (e === h ? h.x - u.x : flat(e) - flat(u)) * u.facing >= 0;
  if (u.state === 'windup') {
    if (u.stateT >= k.wind - EPS) {
      let t = u.tgt === 0 ? (heroOk ? h : null) : enemies.find(e => e.id === u.tgt && alive(e));
      const ok = e => e && inFront(e) && gapTo(e) <= reach(e) + UNIT.landSlack;
      // a weapon raised against a hero who is still riding in is held up until the horse arrives
      if (t === h && inFront(h) && Math.abs(h.x - u.x) > reach(h) + UNIT.landSlack
        && -h.vx * Math.sign(h.x - u.x) > BRACE.closing && u.stateT < k.wind + UNIT.holdBlow) return true;
      if (u.kind === 'captain') {
        // the captain's sweep takes everyone in its arc
        for (const e of enemies) if (alive(e) && ok(e)) landBlow(g, u, k, e);
        if (heroOk && ok(h)) landBlow(g, u, k, h);
        push(g, 'sweep', u.x, UNIT.height, {dir: u.facing, full: true, side: 'shang'});
      } else {
        if (!ok(t)) t = facing(enemies.filter(e => alive(e) && ok(e)), u, Infinity) || (heroOk && ok(h) ? h : null);
        if (t) landBlow(g, u, k, t);
      }
      setState(u, 'attack'); u.cd = k.between / haste(g, u) - k.wind;
    }
    return true;
  }
  if (u.state === 'attack' && u.stateT < UNIT.attackShow) return true;
  let t = facing(enemies, u, k.reach);
  if (heroOk && Math.abs(h.x - u.x) <= k.reachHero && (!t || Math.abs(h.x - u.x) < gapTo(t))) t = h;
  if (!t && heroOk && !h.air && u.cd <= 0) {
    // a foe times its blow to a hero riding in: the weapon goes up early enough to land as the horse arrives
    const dir = h.x >= u.x ? 1 : -1, coming = Math.max(0, -h.vx * dir) * k.wind;
    if (coming > 0 && Math.abs(h.x - u.x) - coming <= k.reachHero - 6) t = h;
  }
  if (!t) { u.turnT = 0; return false; }
  const dir = t.x >= u.x ? 1 : -1;
  if (u.facing !== dir) {
    u.turnT += dt;
    if (u.side === 'shang' && u.turnT < UNIT.turn) { setState(u, 'idle'); return true; }
    u.facing = dir;
  }
  u.turnT = 0;
  if (u.cd > 0) return false;
  setState(u, 'windup'); u.tgt = t === h ? 0 : t.id;
  return true;
}

/** A Shang spear against the hero's charge: set the spear, hold it while he comes. True while braced. */
function shangBrace(g, u, band, foes, dt) {
  const h = g.hero, k = FOE.spear;
  const hx = h.x - u.x, dH = Math.abs(hx), hdir = hx >= 0 ? 1 : -1, toward = -h.vx * hdir;
  const fighting = band.some(s => Math.abs(flat(s) - flat(u)) <= k.reach + UNIT.landSlack);
  // from the first or second file: at most one comrade of its own lane stands between the point and the hero
  const ahead = foes.filter(c => c !== u && alive(c) && c.lane === u.lane && (c.x - u.x) * hdir > 0 && Math.abs(c.x - u.x) <= Math.min(BRACE.clear, dH)).length;
  const inFront = ahead <= 1 && hdir === u.facing && dH <= BRACE.range && h.fallT <= 0;
  // a slow hero inside thrusting distance is fought, not braced against
  const slowAndNear = !h.air && toward < BRACE.speed && dH <= k.reachHero + UNIT.landSlack;
  if (u.state === 'brace') {
    // a spear that is still being set when the horse is already on it comes too late
    if (!u.set && u.stateT >= BRACE.set - EPS) { u.set = true; u.late = dH <= BRACE.reach; }
    u.calm = toward > BRACE.closing ? 0 : u.calm + dt;
    if (!fighting && inFront && !slowAndNear && u.calm < BRACE.patience) return true;
    setState(u, 'idle');
  } else if (!fighting && inFront && !slowAndNear && toward > BRACE.closing && u.state !== 'windup') {
    setState(u, 'brace'); u.calm = 0; u.set = false; u.late = false;
    return true;
  }
  return false;
}

/** A Zhou spear in a standing block sets itself against Shang who come on, and thrusts first. True while braced. */
function zhouBrace(g, u, foes, marching) {
  const k = BAND.spear, ahead = f => (flat(f) - flat(u)) * u.facing;
  const coming = foes.some(f => ahead(f) > k.reach && ahead(f) <= k.reach + k.braceRange && f.vx * u.facing < -5);
  const near = facing(foes.filter(f => ahead(f) > 0), u, k.reach);
  if (u.state === 'brace') {
    if (near) {
      const r = hurtUnit(g, near, u.dmg * k.braceBonus * (covered(g, u) ? k.cover : 1), {from: u.x, by: 'spear'});
      if (!r.blocked || r.kill) push(g, 'clash', near.x, UNIT.height * .6, {side: 'zhou', kill: r.kill});
      if (!r.kill) { near.stun = Math.max(near.stun, k.braceStagger); setState(near, 'stun'); }
      setState(u, 'attack'); u.cd = k.between / haste(g, u);
      return true;
    }
    if (coming && !marching) return true;
    setState(u, 'idle');
    return false;
  }
  if (!marching && !near && coming && u.cd <= 0 && u.state !== 'windup' && u.state !== 'attack') { setState(u, 'brace'); return true; }
  return false;
}

function loose(g, u, k, aim, by, volley = false) {
  const dir = aim >= u.x ? 1 : -1, x = u.x + dir * 10, y = FOE.archer.fromY;
  g.arrows.push({x, y, px: x, py: y, vx: (aim - x) / k.flight, vy: -y / k.flight + FOE.archer.gravity * k.flight / 2,
    dmg: u.dmg * (volley ? BAND.archer.volley : 1), side: u.side, by, from: u.id, aim, volley});
}

/** An archer of either side: pick a target, draw (the telegraph), loose on an arc. Returns true while busy. */
function shoot(g, u, k, enemies, dt) {
  const h = g.hero;
  if (u.state === 'draw') {
    if (u.stateT >= k.wind - EPS) {
      const n = u.side === 'zhou' && has(g, 'arrowRain') ? BOONS.arrowRain.arrows : 1;
      for (let i = 0; i < n; i++) {
        const fan = i * BOONS.arrowRain.fan * u.facing;      // the extra arrows fall a file and two files deeper
        loose(g, u, k, u.aimX + fan + (g.rand() - .5) * k.spread, fan ? 'arrowRain' : 'archer', u.side === 'zhou' && g.volley);
      }
      push(g, 'loose', u.x + u.facing * 10, FOE.archer.fromY, {side: u.side});
      if (u.side === 'zhou') { g.loosed += 1; g.loosedX += u.x; }
      setState(u, 'attack'); u.cd = k.between / haste(g, u) - k.wind; u.waitT = 0; u.shots += 1;
    }
    return true;
  }
  if (u.state === 'attack' && u.stateT < UNIT.attackShow) return true;
  let t = nearestIn(enemies, u.x, k.range);
  // Shang archers spread their aim: every other arrow of each bow is for the hero, the rest for the warband
  if (u.side === 'shang' && h.fallT <= 0 && Math.abs(h.x - u.x) <= k.heroRange && (!t || (u.shots + u.id) % 2 === 0)) t = h;
  if (!t) { u.waitT = 0; return false; }
  u.facing = t.x >= u.x ? 1 : -1;
  if (u.cd > 0) return false;
  if (u.side === 'zhou' && g.order === 'hold') {
    // a wall looses in volleys: wait for the other archers, but not for ever
    u.waitT += dt;
    if (u.waitT < k.wait && !g.wallReady) return false;
  }
  setState(u, 'draw');
  // the target point is fixed now: where the target stands, plus a share of how far it will have gone when the arrow lands
  u.aimX = t.x + k.lead * (t.vx || 0) * (k.wind + k.flight);
  return true;
}

/** How far `u` may go along its lane in direction `dir` before its body meets the next one or the world's end.
 *  While its block is re-forming after a turn about (`pass`), comrades of the block do not stop it. */
function roomFor(line, u, dir, pass) {
  let c = null;
  for (let i = u.rank + dir; i >= 0 && i < line.length; i += dir) {
    if (!alive(line[i]) || (pass && pass(line[i]))) continue;
    c = line[i]; break;
  }
  const edge = dir > 0 ? WORLD.w - UNIT.half - u.x : u.x - UNIT.half;
  return Math.max(0, Math.min(edge, c ? Math.abs(c.x - u.x) - UNIT.body : Infinity));
}

function stepUnits(g, dt) {
  const live = g.units.filter(alive);
  const band = live.filter(u => u.side === 'zhou'), foes = live.filter(u => u.side === 'shang');
  // A body blocks only bodies of its own lane; within a lane nobody passes anybody (but see FORM.reform).
  const lines = [0, 1, 2].map(l => live.filter(u => u.lane === l).sort((a, b) => a.x - b.x || a.id - b.id));
  for (const line of lines) line.forEach((u, i) => { u.rank = i; });
  const forms = new Map(g.forms.map(F => [F.id, F]));
  let gone = false;
  g.loosed = 0; g.loosedX = 0;
  // a wall looses in volleys: its archers wait for one another (but not for ever, see BAND.archer.wait)
  const bows = band.filter(u => u.kind === 'archer');
  g.wallReady = bows.every(u => u.cd <= dt + EPS || u.state === 'draw');
  // two or more loosing on this step is a volley
  g.volley = bows.filter(u => u.hang <= 0 && u.stun <= 0 && u.state === 'draw' && u.stateT + dt >= BAND.archer.wind - EPS).length >= 2;
  for (const u of g.units) {
    u.px = u.x;
    if (u.hang > 0) { u.hang -= 1; u.vx = 0; continue; }          // held by the hero's blow
    u.stateT += dt;
    if (u.flash > 0) u.flash = Math.max(0, u.flash - dt);
    if (!alive(u)) { if (u.stateT >= UNIT.deadTime) { u.gone = true; gone = true; } continue; }
    for (const key of ['cd', 'tcd', 'slow', 'rallyT', 'hasteT']) if (u[key] > 0) u[key] -= dt;
    if (u.side === 'zhou' && has(g, 'spring')) u.hp = Math.min(u.maxHp, u.hp + num(g, 'spring', 'mend') * dt);
    const F = forms.get(u.form), k = kindOf(u), enemies = (u.side === 'zhou' ? foes : band).filter(alive);
    const speed = k.speed * (u.slow > 0 ? BOONS.coldTide.slow : 1);
    u.file = fileOf(g, u);
    const slot = F ? placeOf(F, u) : u.x, re = !!F && F.reform > 0;
    let v = 0, busy = false;
    if (u.stun > 0) { u.stun -= dt; setState(u, 'stun'); }
    else {
      if (u.state === 'stun') setState(u, 'idle');
      const marching = Math.abs(slot - u.x) > 2;
      if (u.kind === 'captain') {
        u.hornT += dt;
        if (u.hornT >= k.horn) {
          u.hornT = 0;
          for (const c of foes) if (alive(c) && Math.abs(c.x - u.x) <= k.hornRange) c.hasteT = k.hornTime;
          push(g, 'captainHorn', u.x, UNIT.height * 1.4);
        }
      }
      if (u.kind === 'archer') {
        busy = shoot(g, u, k, enemies, dt);
        const close = u.side === 'zhou' && !busy ? nearestIn(enemies, u.x, k.shy) : null;
        if (close) { v = (u.x >= close.x ? 1 : -1) * speed; setState(u, 'walk'); busy = true; }   // an archer backs away from melee
      } else {
        if (u.side === 'shang' && u.kind === 'spear') busy = shangBrace(g, u, band, foes, dt);
        if (u.side === 'zhou' && u.kind === 'spear') busy = zhouBrace(g, u, enemies, marching);
        if (!busy) busy = fight(g, u, k, enemies, dt);
      }
      if (!busy) {
        const dx = slot - u.x, d = Math.abs(dx);
        if (d <= .5) { setState(u, 'idle'); if (F && u.turnT === 0 && !nearestIn(enemies, u.x, k.reach || k.range)) u.facing = F.dir; }
        else {
          setState(u, 'walk'); v = Math.sign(dx) * Math.min(speed * (re ? FORM.hurry : 1), d / dt);
          if (!nearestIn(enemies, u.x, k.reach || k.range)) u.facing = F && d < UNIT.file * 3 ? F.dir : Math.sign(dx);
        }
      }
    }
    if (!alive(u)) continue;
    u.kb *= Math.max(0, 1 - 8 * dt);
    const vel = v + u.kb, dir = vel > 0 ? 1 : -1;
    const step = Math.min(Math.abs(vel) * dt, roomFor(lines[u.lane], u, dir, re && Math.abs(u.kb) < 1 ? c => c.form === u.form && misplaced(F, u, c) : null));
    if (v !== 0 && step < Math.abs(vel) * dt * .5 && u.state === 'walk') setState(u, 'idle');   // cannot advance: waits
    u.x += dir * step;
    u.vx = dir * step / dt;
  }
  // Bodies of one lane that overlap all the same (a unit set down in the block) ease apart.
  for (const line of lines) {
    for (let i = 0, a = null; i < line.length; i++) {
      const b = line[i];
      if (!alive(b)) continue;
      if (a && a.lane === b.lane) {
        const short = UNIT.body - Math.abs(b.x - a.x), F = forms.get(a.form);
        if (short > 1e-6 && !(a.form === b.form && F && F.reform > 0)) {
          const by = Math.min(UNIT.push * dt, short / 2), s = b.x >= a.x ? 1 : -1;
          a.x = clamp(a.x - s * by, UNIT.half, WORLD.w - UNIT.half); b.x = clamp(b.x + s * by, UNIT.half, WORLD.w - UNIT.half);
        }
      }
      a = b;
    }
  }
  if (g.loosed >= 2) push(g, 'volley', g.loosedX / g.loosed, 60, {count: g.loosed});
  if (gone) g.units = g.units.filter(u => !u.gone);
}

// The horse meeting foes on the ground, in every lane: a set spear from the front stops it, anything else goes down.
function stepContact(g) {
  const h = g.hero;
  if (h.air || h.fallT > 0) return;
  for (const u of g.units) {
    if (u.side !== 'shang' || !alive(u)) continue;
    const dx = u.x - h.x, d = Math.abs(dx), dir = dx > 0 ? 1 : dx < 0 ? -1 : h.facing;
    if (setAgainst(u, dir) && h.vx * dir >= BRACE.speed && d <= BRACE.reach) {
      const roots = has(g, 'deepRoots') && !g.rootsUsed;
      if (h.dashT > 0 || roots) {
        // the flame gallop cannot be stopped; and once a wave, deep roots carry the horse through a spear
        if (h.dashT <= 0) g.rootsUsed = true;
        u.stun = SWEEP.breakStun; setState(u, 'stun');
        push(g, 'blocked', u.x - dir * UNIT.half, UNIT.height * .6, {side: 'zhou', by: h.dashT > 0 ? 'gallop' : 'deepRoots'});
        continue;
      }
      hurtHero(g, g.taught ? BRACE.dmg : Math.round(BRACE.dmg * BRACE.firstShare), u.x, 'brace');
      g.taught = true;
      h.vx = 0; h.strikeT = -1; h.sweepT = -1; h.cryT = 0;
      if (h.fullCry) { h.fullCry = false; push(g, 'fullCry', h.x, h.y, {on: false}); }
      if (h.fallT <= 0) h.stopT = HERO.stopTime;
      push(g, 'braced', u.x - dir * UNIT.half, UNIT.height * .6);
      if (h.fallT > 0) return;
    } else if (Math.abs(h.vx) >= TRAMPLE.speed && d < HERO.half + UNIT.half && u.tcd <= 0) {
      const cry = h.fullCry;
      const r = hurtUnit(g, u, TRAMPLE.dmg, {by: 'trample'});
      const kill = r.kill || (cry && hurtUnit(g, u, TRAMPLE.dmg * (CRY.trample - 1), {by: 'breakThrough'}).kill);
      u.tcd = TRAMPLE.again;
      let aside = false;
      if (!kill) {
        u.stun = TRAMPLE.stun; setState(u, 'stun'); u.kb += h.facing * 120;
        if (cry) {
          // in full cry the horse knocks foes aside into another rank, where there is room
          const lane = [u.lane + 1, u.lane - 1].find(l => l >= 0 && l < LANES && !g.units.some(c => alive(c) && c.lane === l && Math.abs(c.x - u.x) < UNIT.body));
          if (lane !== undefined) { u.lane = lane; aside = true; }
        }
      }
      if (h.dashT <= 0) h.vx *= cry ? CRY.keep : TRAMPLE.keep;
      push(g, 'trample', u.x, 0, {kill, cry, aside});
    }
  }
}

function stepFires(g, dt) {
  if (!g.fires.length) return;
  for (const f of g.fires) {
    if (f.from && g.t < f.from) continue;                 // not alight yet
    f.tick -= dt;
    if (f.tick > 0) continue;
    f.tick += FIRE.tick;
    const lo = Math.min(f.x0, f.x1) - UNIT.half, hi = Math.max(f.x0, f.x1) + UNIT.half;
    for (const u of g.units) {
      if (u.side !== 'shang' || !alive(u) || u.x < lo || u.x > hi) continue;
      const r = hurtUnit(g, u, f.dps * FIRE.tick, {by: f.by});
      if (r.kill) push(g, 'clash', u.x, UNIT.height * .4, {side: 'zhou', kill: true, by: f.by});
    }
  }
  g.fires = g.fires.filter(f => f.until > g.t || f === g.hero.dashFire);
}

function stepArrows(g, dt) {
  const h = g.hero, gravity = FOE.archer.gravity;
  let spent = false;
  for (const a of g.arrows) {
    a.px = a.x; a.py = a.y;
    a.vy -= gravity * dt; a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y <= 0 || a.x < 0 || a.x > WORLD.w) { a.gone = true; spent = true; continue; }
    // an arrow wounds where it comes down, not on its way up and over
    if (a.vy >= 0 || a.y > HERO.height) continue;
    if (a.side === 'shang' && Math.abs(a.x - h.x) < HERO.half * .8 && a.y >= h.y && a.y <= h.y + HERO.height && hurtHero(g, a.dmg, a.x - a.vx, 'archer')) {
      a.gone = true; spent = true;
      push(g, 'arrowHit', a.x, a.y, {side: a.side});
      continue;
    }
    // on foot it finds only those where it was aimed: archers shoot over everyone in between
    if (a.y > UNIT.height || Math.abs(a.x - a.aim) > UNIT.half + 8) continue;
    let victim = null;
    for (const u of g.units) {
      if (u.side === a.side || !alive(u) || Math.abs(u.x - a.x) >= UNIT.half) continue;
      if (!victim || Math.abs(u.x - a.x) < Math.abs(victim.x - a.x)) victim = u;
    }
    if (!victim) continue;
    // a shield takes the arrows meant for anyone close behind it
    const fromX = a.x - a.vx;
    const cover = g.units.find(s => s.side === victim.side && s.kind === 'shield' && alive(s) && s.stun <= 0 && s !== victim
      && (fromX - s.x) * s.facing > 0 && (s.x - victim.x) * s.facing >= 0 && Math.abs(s.x - victim.x) <= UNIT.cover);
    const target = cover || victim;
    a.gone = true; spent = true;
    const r = hurtUnit(g, target, a.dmg, {from: fromX, by: a.side === 'zhou' ? a.by : undefined});
    push(g, 'arrowHit', a.x, a.y, {side: a.side});
    if (!r.blocked || r.kill) push(g, 'clash', target.x, a.y, {side: a.side, kill: r.kill});
    if (a.volley && !r.kill && !r.blocked) { target.stun = Math.max(target.stun, BAND.archer.volleyStagger); setState(target, 'stun'); }
    if (r.blocked && target.side === 'zhou' && has(g, 'mirrorShields')) {
      // a mirror shield sends the arrow back where it came from
      const back = g.units.find(u => u.id === a.from && alive(u)) || nearestIn(foesOf(g), target.x, Infinity);
      if (back) {
        const k = FOE.archer, x = target.x, aim = back.x + back.vx * k.flight;
        g.arrows.push({x, y: k.fromY, px: x, py: k.fromY, vx: (aim - x) / k.flight, vy: -k.fromY / k.flight + gravity * k.flight / 2,
          dmg: a.dmg * num(g, 'mirrorShields', 'dmg'), side: 'zhou', by: 'mirrorShields', from: target.id, aim});
      }
    }
  }
  if (spent) g.arrows = g.arrows.filter(a => !a.gone);
}

// --------------------------------------------------------------------------------------------------- step

/**
 * Advance one fixed step. input: {move: -1 | 0 | 1, leap, strike, strikeHeld, gallop, rally, order, pick}.
 * `leap`, `strike`, `gallop`, `rally`, `order` and `pick` are edges: pass them on the step they happen and not
 * again. `strikeHeld` is true on every step while the strike key is down.
 */
export function step(g, input = {}, dt = STEP) {
  const h = g.hero;
  if (g.phase === 'lost' || g.phase === 'won') return g;
  if (h.fallT > 0) input = {};                    // a fallen hero gives no orders and picks nothing
  if (ORDERS.includes(input.order) && (input.order !== g.order || input.order === 'hold')) {
    g.order = input.order;
    if (g.order === 'hold') {
      // the wall stands where the order was given, shields toward where the hero faces
      const F = g.forms[0], mem = g.units.filter(u => alive(u) && u.form === 0);
      g.holdX = h.x;
      if (F.dir !== h.facing) about(g, F, depthOf(mem));
    }
    push(g, 'order', h.x, h.y, {order: g.order});
  }
  if (g.phase === 'choose' && Number.isInteger(input.pick) && g.choices && g.choices[input.pick]) {
    applyChoice(g, g.choices[input.pick]);
    g.choices = null; g.phase = 'fight'; g.nextWaveAt = g.t + WAVE.rest;
  }
  g.t += dt;
  if (g.phase === 'fight') g.stats.time += dt;
  if (g.nextWaveAt !== null && g.t >= g.nextWaveAt) startWave(g);
  while (g.spawns.length && g.spawns[0].at <= g.t) spawnGroup(g, g.spawns.shift());
  for (const key of ['gallop', 'rally']) if (h.cd[key] > 0) h.cd[key] = Math.max(0, h.cd[key] - dt);
  if (h.rallyT > 0) h.rallyT -= dt;
  if (h.rallyShow > 0) h.rallyShow -= dt;

  // A blow holds the hero for a few steps (and the foes it met, in stepUnits); the field goes on.
  const held = h.hang > 0;
  if (held) {
    h.hang -= 1; h.hangLog.push(g.t);
    h.px = h.x; h.py = h.y;
    h.bufLeap = h.bufLeap || !!input.leap; h.bufStrike = h.bufStrike || !!input.strike;   // keys pressed meanwhile are not lost
    if (h.pressed && input.strikeHeld) h.hold += dt;
  } else {
    if (h.bufLeap || h.bufStrike) { input = {...input, leap: input.leap || h.bufLeap, strike: input.strike || h.bufStrike}; h.bufLeap = h.bufStrike = false; }
    stepHero(g, input, dt);
  }
  while (h.hangLog.length && h.hangLog[0] <= g.t - STRIKE.freezeWindow - EPS) h.hangLog.shift();
  g.freeze = h.hang > 0 ? h.hang * dt : 0;
  stepForms(g, dt);
  stepUnits(g, dt);
  if (!held) stepContact(g);
  stepFires(g, dt);
  stepArrows(g, dt);
  if (h.fallT > 0) {
    h.fallT -= dt;
    if (h.fallT <= 0) {
      h.fallT = 0; g.phase = 'lost'; g.choices = null;
      push(g, 'lost', h.x, h.y);
    }
  }
  nameHeroState(h, held ? 0 : dt);

  if (g.phase === 'fight' && h.hp > 0 && g.nextWaveAt === null && !g.spawns.length && !g.units.some(u => u.side === 'shang' && alive(u))) {
    push(g, 'cleared', h.x, h.y, {wave: g.wave});
    if (g.wave >= LAST_WAVE) { g.phase = 'won'; push(g, 'won', h.x, h.y); }
    else offerChoices(g);
  }
  return g;
}

export function counts(g) {
  const c = {shields: 0, spears: 0, archers: 0, veterans: 0, band: 0, soldiers: 0, officers: 0, foes: 0};
  for (const u of g.units) {
    if (!alive(u)) continue;
    if (u.side === 'shang') { c.foes += 1; continue; }
    c[u.kind + 's'] += 1; c.band += 1;
    if (u.veteran) c.veterans += 1;
  }
  for (const s of g.spawns) c.foes += s.kinds.length;
  c.soldiers = c.band; c.officers = c.veterans;
  return c;
}

/** For benchmarks and tests: drop the game into a wave with a set warband ({shield, spear, archer}). */
export function jumpTo(g, wave, band = BAND.start) {
  const h = g.hero, F = g.forms[0];
  g.units = []; g.spawns = []; g.arrows = []; g.fires = []; g.forms = [F]; g.wave = wave - 1; g.rout = false;
  F.dir = h.facing; F.x = h.x - F.dir * BAND.first; F.reform = 0; F.turnT = 0;
  muster(g, band);
  startWave(g);
  return g;
}
