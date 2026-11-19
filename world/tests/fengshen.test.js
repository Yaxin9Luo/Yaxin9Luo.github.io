// Rules v2 (lab/game-studies/SPEC-V2.md sections 1 to 5) and what stays of the prototype's contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, counts, addUnit, addBlock, jumpTo, waveGroups, waveBudget, has, power,
  STEP, WORLD, HERO, STRIKE, SWEEP, SLAM, CRY, GALLOP, RALLY, TRAMPLE, BRACE, FOE, BAND, WAVE, UNIT, FORM,
  BOONS, ARMY, SLIPS, ELEMENTS, CYCLE, LAST_WAVE, LANES,
} from '../src/fengshen/sim.js';

const NONE = {move: 0, leap: false, strike: false, strikeHeld: false, gallop: false, rally: false, order: null, pick: null};
const living = (g, side, kind) => g.units.filter(u => u.side === side && u.state !== 'dead' && (!kind || u.kind === kind));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
/** A unit's x with its rank's brick offset taken out. */
const flat = u => u.x - (u.lane - 1) * UNIT.brick;

/** A game with an empty field, for staging one situation. The warband's block is empty too. */
function stage(seed = 7, heroX = 2000) {
  const g = createGame(seed);
  g.units = []; g.spawns = []; g.events = []; g.forms = [g.forms[0]];
  g.hero.x = g.hero.px = heroX;
  g.forms[0].x = heroX - BAND.first;
  return g;
}
/** A foe that stands still and does nothing, far from any block logic. */
function dummy(g, kind, x, opts = {}) {
  const u = addUnit(g, 'shang', kind, x, {facing: -1, ...opts});
  u.stun = 1e6; u.hp = u.maxHp = opts.hp || 1000;
  return u;
}
/** Run steps, collecting events. `input` may be an object or a function of (game, stepIndex). */
function run(g, steps, input = NONE, until) {
  const events = [];
  for (let i = 0; i < steps; i++) {
    step(g, typeof input === 'function' ? input(g, i) : input);
    events.push(...g.events); g.events.length = 0;
    if (until && until(g, events)) break;
  }
  return events;
}
const give = (g, id) => { g.hero.boons.push({id, element: BOONS[id].element}); return g; };
const snapshot = g => JSON.stringify({phase: g.phase, wave: g.wave, t: g.t, hero: g.hero, units: g.units, arrows: g.arrows, stats: g.stats, choices: g.choices});
const sameLaneGap = units => { let m = Infinity; for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) if (units[i].lane === units[j].lane) m = Math.min(m, Math.abs(units[i].x - units[j].x)); return m; };

// ===================================================================================== section 1: the battle line

test('1. lanes are ranks: a body blocks only bodies of its own lane', () => {
  const g = stage();
  g.hero.x = g.hero.px = 300;
  const a = addBlock(g, 'shang', ['axe', 'axe', 'axe'], 2000, -1);
  assert.deepEqual(a.map(u => u.lane), [0, 1, 2]);
  assert.deepEqual(a.map(u => u.x), [2000 - UNIT.brick, 2000, 2000 + UNIT.brick], 'three abreast, one on each lane, each a third of a body along from the last');
  const t = addUnit(g, 'zhou', 'shield', 1500, {lane: 1});
  t.hp = t.maxHp = 1e6;
  g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500; g.forms[0].dir = 1;
  let worst = Infinity;
  run(g, 600, NONE, game => { worst = Math.min(worst, sameLaneGap(game.units)); return false; });
  // all three walk up to the one shield: two of them pass it by on their own lanes, none walks through it
  assert.ok(a.every(u => near(flat(u) - flat(t), UNIT.body + UNIT.gap, 1.5)), `all three stand a fighting distance off: ${a.map(u => flat(u) - flat(t))}`);
  assert.ok(worst >= UNIT.body - 1e-6, `closest two bodies of one lane: ${worst}`);
  // two of one lane set down on one spot ease apart
  const h = stage();
  const p = dummy(h, 'axe', 3000, {lane: 0, form: 99}), q = dummy(h, 'axe', 3004, {lane: 0, form: 99});
  const r = dummy(h, 'axe', 3002, {lane: 2, form: 99});
  run(h, 120);
  assert.ok(q.x - p.x >= UNIT.body - 1e-6, `eased apart to ${q.x - p.x}`);
  assert.equal(r.x, 3002, 'the one on another lane is not moved');
});

test('1. a blow reaches across lanes: three abreast fight in the first file, spears thrust past it', () => {
  const g = stage(7, 300);
  const zhou = addBlock(g, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear'], 1500, 1);
  const shang = addBlock(g, 'shang', ['axe', 'axe', 'axe', 'spear', 'spear', 'spear'], 1500 + UNIT.body + UNIT.gap, -1);
  for (const u of [...zhou, ...shang]) u.hp = u.maxHp = 1e5;
  g.order = 'hold'; g.holdX = 1500;
  const blows = new Map(), prev = new Map();
  run(g, 360, NONE, game => {
    for (const u of game.units) { if (u.state === 'attack' && prev.get(u.id) !== 'attack') blows.set(u.id, (blows.get(u.id) || 0) + 1); prev.set(u.id, u.state); }
    return false;
  });
  assert.ok([...zhou, ...shang].every(u => blows.get(u.id) >= 2), `every one of the twelve lands blows: ${[...zhou, ...shang].map(u => blows.get(u.id) || 0)}`);
  // the second file is a file behind: only a spear's reach of two bodies gets there
  assert.ok(BAND.spear.reach >= UNIT.file + UNIT.body + UNIT.gap && BAND.shield.reach < UNIT.file + UNIT.body + UNIT.gap);
  assert.ok(FOE.spear.reach >= UNIT.file + UNIT.body + UNIT.gap && FOE.axe.reach < UNIT.file + UNIT.body + UNIT.gap);
  const lost = u => u.maxHp - u.hp;
  assert.ok(shang.slice(0, 3).every(u => lost(u) > 0) && zhou.slice(0, 3).every(u => lost(u) > 0), 'both first files are wounded');
  assert.ok(sameLaneGap(g.units) >= UNIT.body - 1e-6);
});

test('1. acceptance: two groups of six or more in contact, at least 5 a side begin a blow in any 2 s', () => {
  for (const order of ['charge', 'hold', 'follow']) {
    const g = stage(11, 600);
    const zhou = addBlock(g, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear', 'archer', 'archer'], 530, 1);
    const shang = addBlock(g, 'shang', ['shield', 'axe', 'axe', 'spear', 'spear', 'spear', 'archer', 'archer'], 1300, -1);
    for (const u of [...zhou, ...shang]) u.hp = u.maxHp = 1e5;
    g.hero.hp = g.hero.maxHp = 1e6;
    step(g, {...NONE, order});
    const began = {zhou: [], shang: []}, prev = new Map();
    let contact = null, worst = Infinity, close = 0, frames = 0;
    const least = {zhou: Infinity, shang: Infinity};
    for (let i = 0; i < 60 * 45; i++) {
      step(g, NONE); g.events.length = 0;
      for (const u of g.units) {
        const was = prev.get(u.id), now = u.state === 'windup' || u.state === 'attack';
        if (now && !was) began[u.side].push({i, id: u.id});
        prev.set(u.id, now);
      }
      frames += 1;
      const gap = sameLaneGap(g.units);
      worst = Math.min(worst, gap);
      if (gap < 20) close += 1;
      const front = Math.min(...shang.map(u => u.x)) - Math.max(...zhou.map(u => u.x));
      if (contact === null && front <= UNIT.body + UNIT.gap + 2) contact = i;
      if (contact !== null && i >= contact + 120) for (const side of ['zhou', 'shang']) least[side] = Math.min(least[side], new Set(began[side].filter(e => e.i > i - 120).map(e => e.id)).size);
    }
    assert.ok(contact !== null, `${order}: the blocks meet`);
    assert.ok(least.zhou >= 5 && least.shang >= 5, `${order}: fewest units beginning a blow in a 2 s window: Zhou ${least.zhou}, Shang ${least.shang}`);
    assert.ok(worst >= UNIT.body - 1e-6, `${order}: no two bodies of one lane overlap (${worst})`);
    assert.equal(close, 0, `${order}: ${close} of ${frames} frames with two of one lane within 20 px`);
  }
});

test('1. the block is three deep, files by kind, and keeps its shape in follow, hold and charge', () => {
  const g = createGame(3);
  const band = living(g, 'zhou');
  // the first file is the shields, the second the spears, the archers behind
  const at = kind => band.filter(u => u.kind === kind).map(u => [u.lane, HERO.startX - flat(u)]);
  assert.deepEqual(at('shield'), [[0, BAND.first], [1, BAND.first], [2, BAND.first]]);
  assert.deepEqual(at('spear'), [0, 1, 2].map(l => [l, BAND.first + UNIT.file]));
  assert.deepEqual(at('archer'), [0, 1].map(l => [l, BAND.first + 2 * UNIT.file]));
  g.spawns = []; g.units = [...band]; g.forms = [g.forms[0]];
  dummy(g, 'axe', 4600, {form: 99});
  const shape = () => band.map(u => Math.round(u.x - band[0].x));
  const start = shape();
  // follow at a gallop: the block runs after the hero at the pace of its slowest man and keeps its shape
  let bent = 0;
  run(g, 240, {...NONE, move: 1}, () => { bent = Math.max(bent, ...shape().map((d, i) => Math.abs(d - start[i]))); return false; });
  assert.ok(g.hero.x > 2000);
  assert.ok(near(flat(band[0]) - (530 + BAND.shield.speed * 240 * STEP), 0, 15), 'it has marched at the shields\' pace');
  assert.ok(bent <= 1, `the shape bent by ${bent} px`);
  // hold: the wall stands where the order was given, shields toward where the hero faces
  const gaveAt = g.hero.x;
  run(g, 1, {...NONE, order: 'hold'});
  const holdX = g.holdX;
  assert.equal(holdX, gaveAt);
  run(g, 60 * 16, {...NONE, move: 1});
  assert.deepEqual(band.filter(u => u.kind === 'shield').map(u => Math.round(flat(u))), [holdX, holdX, holdX].map(Math.round));
  assert.deepEqual(shape(), start, 'the wall has the same shape, shields forward');
  assert.ok(band.every(u => u.facing === 1 && u.state === 'idle'));
  // charge: the block goes for the nearest foe together, at the slowest member's speed, and stops at contact
  const foe = dummy(g, 'axe', holdX + 900, {form: 98});
  g.units = g.units.filter(u => u === foe || u.side === 'zhou');
  run(g, 1, {...NONE, order: 'charge'});
  bent = 0;
  run(g, 120, NONE, () => { bent = Math.max(bent, ...shape().map((d, i) => Math.abs(d - start[i]))); return false; });
  assert.ok(near(flat(band[0]) - holdX, BAND.shield.speed * 2, 3), `advanced ${flat(band[0]) - holdX} px in 2 s`);
  assert.ok(bent <= 1);
  run(g, 60 * 8);
  assert.ok(near(flat(foe) - flat(band[0]), UNIT.body + UNIT.gap, 1.5), 'the first file stops a fighting distance from the foe');
  assert.deepEqual(shape(), start);
  assert.ok(foe.hp < foe.maxHp, 'and fights from there');
});

test('1. a block faces about when its enemy is behind it, and the files change places', () => {
  const g = stage(7, 2000);
  const band = addBlock(g, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear', 'archer', 'archer'], 1930, 1);
  dummy(g, 'axe', 4600, {form: 99});
  g.hero.vx = -1; g.hero.facing = -1;
  run(g, 1, {...NONE, order: 'hold'});            // the hero faces left when he gives the order
  assert.equal(g.forms[0].dir, -1);
  let close = 0, frames = 0;
  run(g, 60 * 6, NONE, game => { frames += 1; if (sameLaneGap(game.units) < 20) close += 1; return false; });
  const xs = kind => band.filter(u => u.kind === kind).map(u => Math.round(u.x));
  assert.ok(Math.max(...xs('shield')) < Math.min(...xs('spear')) && Math.max(...xs('spear')) < Math.min(...xs('archer')), `shields now stand to the left, toward the enemy: ${xs('shield')} ${xs('spear')} ${xs('archer')}`);
  assert.ok(sameLaneGap(g.units) >= UNIT.body - 1e-6, 'and nobody overlaps once it is done');
  assert.ok(close <= FORM.reform * 60, `passing took ${close} frames`);
});

test('1. the Shang arrive as formed blocks: shields and axes in front, spears reaching past, archers behind', () => {
  const g = createGame(4);
  g.hero.x = g.hero.px = 2400; g.hero.hp = g.hero.maxHp = 1e6;
  jumpTo(g, 5);
  run(g, 70);
  const foes = living(g, 'shang');
  assert.ok(foes.length >= WAVE.groupMin, `${foes.length} in the first group`);
  const file = u => Math.round((flat(u) - Math.min(...foes.map(flat))) / UNIT.file);
  const rankOf = k => FOE[k].rank;
  for (const a of foes) for (const b of foes) if (a.lane === b.lane && file(a) < file(b)) assert.ok(rankOf(a.kind) <= rankOf(b.kind), `${a.kind} stands before ${b.kind}`);
  assert.equal(new Set(foes.map(u => u.lane)).size, LANES);
  assert.ok(Math.max(...foes.map(file)) <= 2, 'two or three files deep');
  assert.ok(sameLaneGap(foes) >= UNIT.body);
});

// ===================================================================================== section 2: troop kinds

test('2. the warband: three shields, three spears, two archers; a veteran has 40% more', () => {
  const g = createGame(1);
  assert.deepEqual(counts(g), {shields: 3, spears: 3, archers: 2, veterans: 0, band: 8, soldiers: 8, officers: 0, foes: 4});
  const one = kind => living(g, 'zhou', kind)[0];
  assert.deepEqual([one('shield').hp, one('spear').hp, one('archer').hp], [110, 70, 40]);
  assert.deepEqual([BAND.shield.dmg, BAND.spear.dmg, BAND.archer.dmg], [20, 26, 24]);
  assert.ok(g.units.every(u => u.veteran === false && ['shield', 'spear', 'archer'].includes(u.kind)));
  const s = stage();
  const vet = addUnit(s, 'zhou', 'spear', 1000, {veteran: true}), plain = addUnit(s, 'zhou', 'spear', 1100);
  assert.equal(vet.veteran, true);
  assert.equal(vet.maxHp, Math.round(BAND.spear.hp * 1.4)); assert.ok(near(vet.dmg, BAND.spear.dmg * 1.4)); assert.equal(plain.dmg, BAND.spear.dmg);
});

test('2. a shield takes half from the front, and the arrows meant for those close behind it', () => {
  const g = stage(7, 300);
  const shield = addUnit(g, 'zhou', 'shield', 1500, {lane: 0, facing: 1});
  g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500;
  const front = addUnit(g, 'shang', 'axe', 1500 + UNIT.body + UNIT.gap, {facing: -1, lane: 1});
  front.cd = 0;
  let ev = run(g, 60, NONE, (game, e) => e.some(x => x.type === 'blocked'));
  assert.equal(shield.hp, BAND.shield.hp - FOE.axe.dmg / 2, 'half the axe\'s 16 from the front');
  assert.ok(ev.some(e => e.type === 'blocked' && e.side === 'zhou'));
  assert.equal(shield.state !== 'stun', true, 'and it is not staggered');
  // from behind it is a man like any other
  const h = stage(7, 300);
  const turned = addUnit(h, 'zhou', 'shield', 1500, {lane: 0, facing: 1});
  h.order = 'hold'; h.holdX = 1500; h.forms[0].x = 1500;
  addUnit(h, 'zhou', 'shield', 1900, {lane: 1, facing: 1}).hp = 1e6;       // keeps the block facing right
  const behind = addUnit(h, 'shang', 'axe', 1500 - UNIT.body - UNIT.gap, {facing: 1, lane: 1});
  behind.cd = 0; turned.stun = 3; turned.facing = 1;
  run(h, 45, NONE, () => { turned.facing = 1; return turned.hp < BAND.shield.hp; });
  assert.equal(turned.hp, BAND.shield.hp - FOE.axe.dmg);
  // arrows: one falling on the spear 48 px behind the shield strikes the shield instead
  const a = stage(7, 300);
  const blockA = addBlock(a, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear', 'archer', 'archer', 'archer'], 1500, 1);
  const sh = blockA[0], sp = blockA[3], far = blockA[6];
  assert.deepEqual([sh.lane, sp.lane, far.lane, sh.x - sp.x, sh.x - far.x], [0, 0, 0, UNIT.file, 2 * UNIT.file]);
  a.order = 'hold'; a.holdX = 1500;
  dummy(a, 'axe', 4000);
  const drop = x => a.arrows.push({x, y: 50, px: x, py: 50, vx: -60, vy: -200, dmg: 9, side: 'shang', by: 'archer', from: 0, aim: x - 12});
  drop(sp.x + 6);
  ev = run(a, 30);
  assert.equal(sp.hp, BAND.spear.hp); assert.equal(sh.hp, BAND.shield.hp - 9 * UNIT.wall, 'a third, with a shield at either side');
  assert.ok(ev.some(e => e.type === 'blocked'));
  drop(far.x + 6);
  run(a, 30);
  assert.equal(far.hp, BAND.archer.hp - 9, 'beyond 60 px the shield does not cover');
});

test('2. a Zhou spear braces by itself against Shang who come on, and thrusts first', () => {
  const g = stage(7, 300);
  const spear = addUnit(g, 'zhou', 'spear', 1500, {lane: 0, facing: 1});
  g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500;
  const axe = addUnit(g, 'shang', 'axe', 1900, {facing: -1, lane: 0});
  let braced = 0;
  const ev = run(g, 600, NONE, (game, e) => { if (spear.state === 'brace') braced += 1; return axe.hp < axe.maxHp; });
  assert.ok(braced > 10, 'the spear is set before the axe arrives');
  assert.equal(axe.hp, FOE.axe.hp - BAND.spear.dmg * BAND.spear.braceBonus, 'the first thrust is half again as heavy');
  assert.ok(axe.x - spear.x > FOE.axe.reach, 'and lands before the axe can reach');
  assert.equal(axe.state, 'stun');
  assert.equal(spear.hp, BAND.spear.hp);
  assert.ok(ev.some(e => e.type === 'clash' && e.side === 'zhou'));
});

test('2. Zhou archers: range, pace and damage; a hold wall looses in volleys; they back away from melee', () => {
  const g = stage(7, 300);
  const archers = [0, 1, 2].map(l => addUnit(g, 'zhou', 'archer', 1500, {lane: l, facing: 1}));
  g.order = 'follow'; g.forms[0].x = 1500; g.hero.x = g.hero.px = 1570;
  const out = dummy(g, 'axe', 1500 + BAND.archer.range + 40, {lane: 0});
  let ev = run(g, 200);
  assert.equal(ev.some(e => e.type === 'loose'), false, 'nothing is in range');
  out.x = 1500 + BAND.archer.range - 60;
  archers[1].cd = .5; archers[2].cd = .9;
  const shots = [];
  ev = run(g, 60 * 9, NONE, (game, e) => { for (const x of e.splice(0)) if (x.type === 'loose') shots.push(game.t); return false; });
  const mine = shots.filter((t, i) => i % 3 === 0);
  assert.ok(near(mine[1] - mine[0], BAND.archer.between, STEP * 2), `an archer looses every ${mine[1] - mine[0]} s`);
  assert.ok(out.hp < 1000 && (1000 - out.hp) % (BAND.archer.dmg / 2) === 0, `${BAND.archer.dmg} a hit, half again in a volley: ${1000 - out.hp}`);
  assert.ok(g.stats.by.archer > 0);
  // on `follow` they loose as each is ready; a `hold` wall waits and looses together
  const h = stage(7, 300);
  const wall = [0, 1, 2].map(l => addUnit(h, 'zhou', 'archer', 1500, {lane: l, facing: 1}));
  h.order = 'hold'; h.holdX = 1500; h.forms[0].x = 1500;
  dummy(h, 'axe', 1900, {lane: 0});
  wall[1].cd = .4; wall[2].cd = .8;
  const volleys = [], singles = [];
  run(h, 60 * 8, NONE, (game, e) => { for (const x of e.splice(0)) { if (x.type === 'volley') volleys.push(x); if (x.type === 'loose') singles.push(game.t); } return false; });
  assert.ok(volleys.length >= 3 && volleys.every(v => v.count === 3), `volleys of three: ${volleys.map(v => v.count)}`);
  assert.ok(near(singles[0], singles[2], STEP), 'loosed on the same step');
  // a foe within 90 px: the archer walks away from it
  const b = stage(7, 300);
  const shy = addUnit(b, 'zhou', 'archer', 1500, {lane: 0, facing: 1});
  b.order = 'hold'; b.holdX = 1500; b.forms[0].x = 1500;
  dummy(b, 'axe', 1560, {lane: 1});
  shy.cd = 5;
  run(b, 30);
  assert.ok(shy.x < 1490, `backed off to ${shy.x}`);
});

test('2. the Shang shield-bearer blocks the front; the captain sweeps, sounds his horn, and his fall is a rout', () => {
  // a strike into a shield's face does half; from behind, all of it
  const g = stage();
  const front = dummy(g, 'shield', g.hero.x + 50, {facing: -1, form: 97}), back = dummy(g, 'shield', g.hero.x + 125, {facing: 1, lane: 1, form: 98});
  front.stun = 0; back.stun = 0; front.cd = back.cd = 99;
  const ev = run(g, 6, (game, i) => ({...NONE, strike: i === 0}));
  assert.equal(1000 - front.hp, STRIKE.dmg / 2); assert.equal(1000 - back.hp, STRIKE.dmg);
  assert.ok(ev.some(e => e.type === 'blocked' && e.side === 'shang'));
  assert.deepEqual([FOE.shield.rank, FOE.axe.rank, FOE.spear.rank, FOE.captain.rank, FOE.archer.rank], [0, 0, 1, 2, 3]);

  // the captain: 320 health, a sweep telegraphed for a whole second that takes everyone in its arc
  const c = stage(7, 300);
  const cap = addUnit(c, 'shang', 'captain', 1500 + UNIT.body + UNIT.gap, {facing: -1, lane: 1});
  assert.equal(cap.hp, 320);
  const men = addBlock(c, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear'], 1500, 1);
  for (const u of men) u.hp = u.maxHp = 1000;
  c.order = 'hold'; c.holdX = 1500;
  cap.cd = 0; cap.hp = cap.maxHp = 1e5;
  let raised = 0, swept = null;
  run(c, 400, NONE, (game, e) => { if (cap.state === 'windup') raised += 1; swept = e.find(x => x.type === 'sweep' && x.side === 'shang'); return !!swept; });
  assert.ok(near(raised * STEP, FOE.captain.wind, STEP * 2), `raised for ${raised * STEP} s`);
  const struck = men.filter(u => u.hp < 1000);
  assert.ok(struck.length >= 5, `the sweep took ${struck.length} of the six`);
  assert.ok(men.filter(u => u.kind === 'shield').every(u => near(1000 - u.hp, FOE.captain.dmg * UNIT.wall)) && men.filter(u => u.kind === 'spear' && u.hp < 1000).every(u => 1000 - u.hp === FOE.captain.dmg));
  assert.equal(men.some(u => u.state === 'stun'), false, 'shields keep their feet, and so do the spears behind them');
  // the horn, every 12 s: Shang near him strike faster for 5 s
  const mate = addUnit(c, 'shang', 'axe', 1700, {facing: -1, lane: 0, form: cap.form});
  mate.hp = mate.maxHp = 1e5;
  const horns = [];
  const hasted = [];
  run(c, 60 * 26, NONE, (game, e) => { for (const x of e.splice(0)) if (x.type === 'captainHorn') { horns.push(game.t); hasted.push(mate.hasteT); } return false; });
  assert.ok(horns.length >= 2 && near(horns[1] - horns[0], FOE.captain.horn, STEP * 2), `horn every ${horns[1] - horns[0]} s`);
  assert.ok(hasted.every(t => near(t, FOE.captain.hornTime, STEP * 2)), `hasted for ${hasted} s`);
  // his fall
  cap.hp = 1;
  const end = run(c, 600, NONE, (game, e) => e.some(x => x.type === 'rout'));
  assert.equal(end.filter(e => e.type === 'rout').length, 1);
  assert.equal(c.rout, true);
  mate.cd = 0; mate.hasteT = 0;
  const blows = [];
  let was = '';
  run(c, 60 * 14, NONE, game => { if (mate.state === 'attack' && was !== 'attack') blows.push(game.t); was = mate.state; return false; });
  assert.ok(blows.length >= 2 && near(blows[1] - blows[0], FOE.axe.between * 2, .1), `a routed axe strikes every ${blows[1] - blows[0]} s`);
});

// ===================================================================================== section 3: the hero's verbs

test('3. strike: as before, harder the faster the hero closes, two foes at most', () => {
  const blow = speed => {
    const g = stage();
    const foe = dummy(g, 'axe', g.hero.x + 100);
    g.hero.vx = speed;
    return {hit: run(g, 8, {...NONE, strike: true}, (game, e) => e.some(x => x.type === 'hit')).find(e => e.type === 'hit'), foe, g};
  };
  const still = blow(0);
  assert.equal(still.hit.dmg, STRIKE.dmg); assert.equal(still.hit.mult, 1); assert.equal(still.hit.by, 'strike');
  let last = STRIKE.dmg;
  for (const speed of [130, 260, 390, 520]) {
    const {hit} = blow(speed), closing = speed - HERO.coast * STEP * 4;
    assert.ok(near(hit.mult, 1 + closing / STRIKE.speedPer, 1e-9));
    assert.equal(hit.dmg, Math.round(STRIKE.dmg * hit.mult));
    assert.ok(hit.dmg > last); last = hit.dmg;
  }
  const g = stage();
  const three = [0, 1, 2].map(l => dummy(g, 'axe', g.hero.x + 90, {lane: l}));
  const ev = run(g, 30, (game, i) => ({...NONE, strike: i === 0}));
  assert.equal(ev.filter(e => e.type === 'hit').length, STRIKE.cleave, 'three abreast: a strike cuts two of them');
  assert.equal(three.filter(u => u.hp < 1000).length, 2);
  assert.equal(g.stats.by.strike, 2 * STRIKE.dmg);
});

test('3. sweep: hold 0.35 s and release; wide, every lane, pushes back; the horse is slowed while the blow is held', () => {
  const g = stage();
  const near3 = [0, 1, 2].map(l => dummy(g, 'axe', g.hero.x + 1800, {lane: l, form: 74 + l})), far = dummy(g, 'axe', g.hero.x + 1800 + 30, {lane: 0, form: 77});
  const beyond = dummy(g, 'axe', g.hero.x + 1800 + 260, {lane: 1, form: 78});
  g.hero.vx = HERO.top;
  // a tap is a strike and nothing more
  let ev = run(g, 12, (game, i) => ({...NONE, move: 1, strike: i === 0, strikeHeld: i < 5}));
  assert.deepEqual(ev.filter(e => e.type === 'swing' || e.type === 'sweep').map(e => e.type), ['swing']);
  assert.equal(g.hero.hold, 0);
  run(g, 30, {...NONE, move: 1});
  // press and hold: a strike at once, then the hold counts, the horse slows, and letting go sweeps
  const x0 = near3[0].x;
  ev = run(g, 1, {...NONE, move: 1, strike: true, strikeHeld: true});
  assert.ok(ev.some(e => e.type === 'swing'), 'the press strikes at once');
  run(g, 18, {...NONE, move: 1, strikeHeld: true});
  assert.ok(near(g.hero.hold, 19 * STEP, 1e-9), `hero.hold counts the seconds: ${g.hero.hold}`);
  assert.equal(g.hero.vx, HERO.top, 'not slowed before 0.35 s');
  run(g, 30, {...NONE, move: 1, strikeHeld: true});
  assert.ok(g.hero.vx < HERO.top - 100, 'slowing while the blow is held');
  run(g, 20, {...NONE, move: 1, strikeHeld: true});
  assert.ok(near(g.hero.vx, HERO.top * SWEEP.slow, 1e-6), `held to half: ${g.hero.vx}`);
  // ride on, still holding, until the three are 150 px ahead, then let go
  run(g, 600, {...NONE, move: 1, strikeHeld: true}, game => x0 - game.hero.x <= 150);
  const v = g.hero.vx;
  ev = run(g, 1, {...NONE, move: 1});
  const sweep = ev.find(e => e.type === 'sweep');
  assert.ok(sweep && sweep.dir === 1 && sweep.full === true, 'held past 0.8 s: a full sweep');
  assert.equal(g.hero.state, 'sweep'); assert.equal(g.hero.hold, 0);
  ev = run(g, 40, {...NONE, move: 1}, game => game.hero.state !== 'sweep');
  const hits = ev.filter(e => e.type === 'hit');
  assert.equal(hits.length, 4, 'all three lanes and the one behind them: everything within 180 px');
  assert.ok(hits.every(e => e.by === 'sweep'));
  assert.equal(beyond.hp, 1000);
  const mult = hits[0].mult;
  assert.ok(mult > 2 && near(mult, 1 + (v - HERO.accel * 0) / STRIKE.speedPer, .2));
  assert.equal(hits[0].dmg, Math.round(STRIKE.dmg * SWEEP.mult * mult), 'a share of a strike, with the speed bonus');
  assert.ok(SWEEP.mult < 1 && SWEEP.recover > STRIKE.recover, 'the plain strike is the heavier and the quicker blow');
  run(g, 60);
  assert.ok(near(near3[0].x - x0, SWEEP.push, 8), `pushed back ${near3[0].x - x0} px`);
  assert.ok(far.hp < 1000);
  assert.ok(g.stats.by.sweep > 0);
  // released before 0.35 s: no sweep
  const s = stage();
  dummy(s, 'axe', 4000);
  ev = run(s, 30, (game, i) => ({...NONE, strike: i === 0, strikeHeld: i < 18}));
  assert.equal(ev.some(e => e.type === 'sweep'), false);
});

test('3. a fully held sweep breaks a brace; a short one is turned like a strike', () => {
  const charge = (from, steps) => {
    const g = stage();
    const spear = addUnit(g, 'shang', 'spear', g.hero.x + 900, {facing: -1, lane: 1});
    spear.hp = spear.maxHp = 500;
    g.taught = true;
    g.hero.vx = HERO.top * SWEEP.slow;
    let held = 0, done = false;
    const ev = run(g, 400, game => {
      const gap = spear.x - game.hero.x, input = {...NONE, move: 1};
      // press when the spear is `from` px off, keep the key down for `steps` steps and until it is in reach, then let go
      if (!done && gap < from && (held < steps || gap > 165)) { input.strike = held === 0; input.strikeHeld = true; held += 1; }
      else if (held) done = true;
      return input;
    }, game => game.hero.x > spear.x + 150 || game.hero.state === 'stopped');
    return {g, spear, ev};
  };
  const short = charge(420, 24);
  assert.ok(short.ev.some(e => e.type === 'sweep' && !e.full));
  assert.equal(short.spear.hp, 500, 'the set spear turns it');
  assert.ok(short.ev.some(e => e.type === 'braced'), 'and stops the horse');
  const full = charge(700, 50);
  assert.ok(full.ev.some(e => e.type === 'sweep' && e.full));
  const hit = full.ev.find(e => e.type === 'hit');
  assert.ok(hit && hit.broke === true);
  assert.ok(full.spear.hp < 500);
  assert.equal(full.ev.some(e => e.type === 'braced'), false, 'the brace is broken and the horse rides through');
  assert.equal(full.g.hero.hp, HERO.hp);
});

test('3. leap strike: strike while falling, and the landing sends a shock along the ground', () => {
  const g = stage();
  const foes = [-140, -75, 80, 140].map((d, i) => dummy(g, 'axe', 0, {lane: i % 3, form: 60 + i}));
  const out = dummy(g, 'axe', 0, {lane: 0, form: 70});
  g.hero.vx = 400;
  run(g, 1, {...NONE, move: 1, leap: true});
  let ev = run(g, 60, {...NONE, move: 1}, game => game.hero.vy < 0);
  const peak = g.hero.y;
  ev = run(g, 1, {...NONE, move: 1, strike: true});
  assert.equal(ev.some(e => e.type === 'swing'), false, 'no ordinary strike');
  assert.equal(g.hero.state, 'strike');
  // set the foes down around where the horse will land
  const landX = g.hero.x + g.hero.vx * (2 * HERO.leapV / HERO.gravity - g.hero.airT);
  [-140, -75, 80, 140].forEach((d, i) => { foes[i].x = landX + d; });
  out.x = landX + SLAM.reach + UNIT.half + 30;
  ev = run(g, 60, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'shock'));
  const shock = ev.find(e => e.type === 'shock');
  assert.ok(ev.findIndex(e => e.type === 'land') < ev.findIndex(e => e.type === 'shock'), 'land, then shock');
  assert.ok(near(shock.x, g.hero.x, 12) && near(shock.power, peak / SLAM.height, .05), `power ${shock.power}`);
  assert.ok(foes.every(u => 1000 - u.hp === Math.round(SLAM.dmg * Math.min(1, shock.power))), `150 px each way: ${foes.map(u => 1000 - u.hp)}`);
  assert.equal(out.hp, 1000);
  assert.ok(ev.filter(e => e.type === 'hit').every(e => e.by === 'leapStrike'));
  foes.forEach(u => { u.stun = SLAM.stun; });
  assert.equal(g.stats.by.leapStrike, 4 * SLAM.dmg);
  // the higher the fall, the harder: a leap half again as high
  const hi = give(stage(), 'galeLeap');
  const t = dummy(hi, 'axe', 0);
  hi.hero.vx = 400;
  run(hi, 1, {...NONE, leap: true});
  let top = 0;
  run(hi, 80, NONE, game => { top = Math.max(top, game.hero.y); return game.hero.vy < 0; });
  run(hi, 1, {...NONE, strike: true});
  run(hi, 80, NONE, (game, e) => { t.x = game.hero.x + 60; return e.some(x => x.type === 'shock'); });
  assert.ok(near(top / 93.3, BOONS.galeLeap.height, .05), `leapt ${top} px`);
  assert.ok(1000 - t.hp > SLAM.dmg * 1.4, `the shock did ${1000 - t.hp}`);
  // a strike on the way up is an ordinary strike
  const up = stage();
  dummy(up, 'axe', 4000);
  up.hero.vx = 400;
  run(up, 1, {...NONE, leap: true});
  ev = run(up, 5, (game, i) => ({...NONE, strike: i === 2}));
  assert.ok(ev.some(e => e.type === 'swing'));
  ev = run(up, 60);
  assert.equal(ev.some(e => e.type === 'shock'), false);
});

test('3. break-through: 0.8 s at 90% of top speed and the horse is in full cry', () => {
  const g = stage(7, 600);
  dummy(g, 'axe', 4700);
  g.hero.vx = HERO.top * CRY.on;
  let ev = run(g, 46, {...NONE, move: 1});
  assert.equal(g.hero.fullCry, false);
  ev = run(g, 4, {...NONE, move: 1});
  assert.deepEqual(ev.filter(e => e.type === 'fullCry').map(e => e.on), [true]);
  assert.equal(g.hero.fullCry, true);
  assert.ok(g.hero.buffs.includes('fullCry'));
  // trample is doubled and knocks the foe aside into another rank
  const foe = addUnit(g, 'shang', 'axe', g.hero.x + 200, {facing: -1, lane: 0});
  foe.hp = foe.maxHp = 500; foe.stun = 2;
  ev = run(g, 60, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'trample'));
  const tr = ev.find(e => e.type === 'trample');
  assert.equal(500 - foe.hp, TRAMPLE.dmg * CRY.trample);
  assert.equal(tr.cry, true); assert.equal(tr.aside, true);
  assert.notEqual(foe.lane, 0);
  assert.ok(near(g.hero.vx, HERO.top * CRY.keep, 1e-6));
  assert.equal(g.stats.by.trample, TRAMPLE.dmg); assert.equal(g.stats.by.breakThrough, TRAMPLE.dmg);
  // lost under 70%
  ev = run(g, 200, {...NONE, move: -1}, (game, e) => e.some(x => x.type === 'fullCry'));
  assert.equal(ev.find(e => e.type === 'fullCry').on, false);
  assert.ok(Math.abs(g.hero.vx) < HERO.top * CRY.off && Math.abs(g.hero.vx) > HERO.top * CRY.off - 30);
  // a set spear still stops it
  const s = stage(7, 600);
  s.hero.vx = HERO.top;
  run(s, 60, {...NONE, move: 1});
  assert.equal(s.hero.fullCry, true);
  addUnit(s, 'shang', 'spear', s.hero.x + 450, {facing: -1, lane: 1});
  ev = run(s, 90, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'braced'));
  assert.ok(ev.some(e => e.type === 'braced'));
  assert.equal(s.hero.fullCry, false); assert.equal(s.hero.vx, 0);
});

test('3. flame gallop: K, 12 s; a burst that cannot be hurt or stopped, and a trail that burns', () => {
  const g = stage(7, 600);
  g.taught = true;
  const spear = addUnit(g, 'shang', 'spear', g.hero.x + 520, {facing: -1, lane: 1});
  spear.hp = spear.maxHp = 500;
  const axe = addUnit(g, 'shang', 'axe', g.hero.x + 700, {facing: -1, lane: 0});
  axe.hp = axe.maxHp = 500; axe.cd = 0;
  g.hero.vx = HERO.top;
  run(g, 14, {...NONE, move: 1});
  assert.equal(spear.state, 'brace');
  const x0 = g.hero.x;
  let ev = run(g, 1, {...NONE, move: 1, gallop: true});
  assert.ok(ev.some(e => e.type === 'dash'));
  assert.equal(g.hero.state, 'dash');
  assert.ok(near(g.hero.cd.gallop, GALLOP.cd, STEP)); assert.ok(g.hero.buffs.includes('dash'));
  assert.ok(near(g.hero.vx, HERO.top * GALLOP.speed));
  let steps = 1;
  ev = run(g, 60, {...NONE, move: 1}, game => { steps += 1; return game.hero.state !== 'dash'; });
  assert.ok(near(steps * STEP, GALLOP.time, STEP * 2), `the burst lasts ${steps * STEP} s`);
  assert.equal(ev.some(e => e.type === 'braced' || e.type === 'hurt'), false, 'neither the set spear nor the raised axe touches him');
  assert.equal(g.hero.hp, HERO.hp);
  assert.ok(g.hero.x > spear.x, 'he is through the spear');
  const trail = ev.find(e => e.type === 'trail');
  assert.ok(trail && trail.kind === 'gallop' && near(trail.x0, x0, 12) && near(trail.x1, g.hero.x, 12), 'the trail runs from where the burst began to where it ended');
  assert.ok(near(trail.x1 - trail.x0, HERO.top * GALLOP.speed * GALLOP.time, 20));
  assert.ok(near(g.hero.vx, HERO.top), 'back to top speed');
  // the trail burns those who stand in it, 8 a second for 2.5 s after the burst
  const stand = dummy(g, 'axe', (trail.x0 + trail.x1) / 2, {lane: 2, form: 90}), outside = dummy(g, 'axe', trail.x0 - 80, {lane: 2, form: 91});
  run(g, 60 * 4, {...NONE, move: 1});
  assert.ok(near(1000 - stand.hp, GALLOP.dps * GALLOP.life, 2.1), `burned for ${1000 - stand.hp}`);
  assert.equal(outside.hp, 1000);
  assert.ok(g.stats.by.gallop > 0);
  // not again until the 12 s are up
  ev = run(g, 1, {...NONE, gallop: true});
  assert.equal(ev.some(e => e.type === 'dash'), false);
  run(g, 60 * 8, NONE, game => game.hero.cd.gallop === 0);
  assert.ok(near(g.t - 0, 15 * STEP + GALLOP.cd, .2));
  g.hero.vx = 300;
  ev = run(g, 1, {...NONE, move: 1, gallop: true});
  assert.ok(ev.some(e => e.type === 'dash'));
});

test('3. rally: L, 20 s; every weapon is ready at once, and for 6 s the warband strikes twice as fast and cannot be staggered', () => {
  const g = stage(7, 1500);
  const inside = addUnit(g, 'zhou', 'shield', 1500, {lane: 0, facing: 1});
  inside.hp = inside.maxHp = 1e5;
  g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500;
  const target = addUnit(g, 'shang', 'axe', 1500 + UNIT.body + UNIT.gap, {facing: -1, lane: 0});
  target.hp = target.maxHp = 1e5;
  const rate = seconds => { let n = 0, was = ''; run(g, seconds * 60, NONE, () => { if (inside.state === 'attack' && was !== 'attack') n += 1; was = inside.state; return false; }); return n; };
  const plain = rate(6);
  const ev = run(g, 1, {...NONE, rally: true});
  assert.ok(ev.some(e => e.type === 'rally'));
  assert.equal(g.hero.state, 'rally');
  assert.ok(g.hero.buffs.includes('rally')); assert.ok(near(g.hero.cd.rally, RALLY.cd, STEP));
  assert.ok(inside.rallyT > 0);
  const fast = rate(6);
  run(g, 3);
  assert.ok(near(fast / plain, RALLY.haste, .2), `${plain} blows in 6 s, ${fast} when rallied`);
  assert.equal(g.hero.buffs.includes('rally'), false, 'the six seconds are over');
  // cannot be staggered: an axe staggers a spear, but not a rallied one
  const s = stage(7, 1300);
  const spear = addUnit(s, 'zhou', 'spear', 1500, {lane: 0, facing: 1}), away = addUnit(s, 'zhou', 'spear', 1500 - RALLY.range - 60, {lane: 1, facing: 1});
  spear.hp = spear.maxHp = 1e5; spear.cd = 99;
  s.order = 'hold'; s.holdX = 1500; s.forms[0].x = 1500;
  const axe = addUnit(s, 'shang', 'axe', 1556, {facing: -1, lane: 0});
  axe.hp = axe.maxHp = 1e5; axe.cd = 0;
  let stunned = 0;
  run(s, 240, NONE, () => { if (spear.state === 'stun') stunned += 1; spear.cd = 99; return false; });
  assert.ok(stunned > 0, 'an axe staggers him');
  away.x = s.hero.x - RALLY.range - 60;
  run(s, 1, {...NONE, rally: true});
  assert.ok(spear.rallyT > 0); assert.equal(away.rallyT, 0, 'beyond 450 px the standard is not seen');
  stunned = 0;
  run(s, 300, NONE, () => { if (spear.state === 'stun') stunned += 1; spear.cd = 99; return false; });
  assert.equal(stunned, 0);
  const again = run(s, 1, {...NONE, rally: true});
  assert.equal(again.some(e => e.type === 'rally'), false, '20 s between rallies');
});

test('3. hit-stop holds only the hero and the foes he met, and never more than 0.15 s in a second', () => {
  const g = stage();
  for (let i = 0; i < 40; i++) { const u = dummy(g, 'axe', g.hero.x + 300 + i * 50, {lane: i % 3, form: 100 + i}); u.hp = 1; }
  const walker = addUnit(g, 'zhou', 'shield', g.hero.x - 900, {lane: 0});
  g.hero.vx = HERO.top;
  const held = [];
  let most = 0, hits = 0, wx = walker.x;
  for (let i = 0; i < 360; i++) {
    const was = g.hero.hang > 0, x = g.hero.x, t = g.t;
    step(g, {...NONE, move: 1, strike: i % 6 === 0});
    assert.ok(g.t > t, 'the clock never stops');
    if (was) { held.push(i); assert.equal(g.hero.x, x); assert.ok(walker.x > wx, 'the field goes on'); }
    wx = walker.x;
    hits += g.events.filter(e => e.type === 'hit').length; g.events.length = 0;
    while (held.length && held[0] <= i - 60) held.shift();
    most = Math.max(most, held.length);
  }
  assert.ok(hits >= 12);
  assert.ok(most <= Math.round(STRIKE.freezeCap / STEP) && most >= 5, `${most} held steps in one second`);
});

test('3. a set Shang spear stops the hero from the first or the second file; the first time costs half', () => {
  const g = stage();
  const block = addBlock(g, 'shang', ['axe', 'axe', 'axe', 'spear', 'spear', 'spear', 'archer', 'archer'], g.hero.x + 600, -1);
  for (const u of block) u.cd = 99;
  g.hero.vx = HERO.top;
  let ev = run(g, 90, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'braced'));
  const spears = block.filter(u => u.kind === 'spear');
  assert.ok(spears.every(u => u.state === 'brace'), 'the spears of the second file set themselves over the axes');
  assert.ok(ev.some(e => e.type === 'braced'));
  assert.deepEqual(ev.filter(e => e.type === 'hurt').map(e => [e.dmg, e.by]), [[BRACE.dmg * BRACE.firstShare, 'brace']]);
  assert.equal(g.hero.state, 'stopped'); assert.equal(g.hero.vx, 0);
  assert.ok(spears[0].x - g.hero.x <= BRACE.reach && spears[0].x - g.hero.x > BRACE.reach - 12, 'stopped on the spear points, in front of the axes');
  // a third-file spear does not brace
  const d = stage();
  const deep = addBlock(d, 'shang', ['axe', 'axe', 'axe', 'shield', 'shield', 'shield', 'spear', 'spear', 'spear'], d.hero.x + 600, -1);
  for (const u of deep) u.cd = 99;
  d.hero.vx = HERO.top;
  let braced = false;
  run(d, 60, {...NONE, move: 1}, () => { braced = braced || deep.some(u => u.state === 'brace'); return false; });
  assert.equal(braced, false);
  // from the air a set spear is an ordinary target, and a leap clears it
  const a = stage();
  const lone = addUnit(a, 'shang', 'spear', a.hero.x + 450, {facing: -1, lane: 1});
  lone.hp = lone.maxHp = 500;
  a.hero.vx = HERO.top;
  let leapt = false, struck = false;
  ev = run(a, 110, game => {
    const gap = lone.x - game.hero.x, input = {...NONE, move: 1};
    if (!leapt && gap < 240) { input.leap = true; leapt = true; }
    if (leapt && !struck && gap < 150) { input.strike = true; struck = true; }
    return input;
  }, game => leapt && game.hero.y === 0 && game.hero.x > lone.x);
  assert.equal(ev.some(e => e.type === 'braced'), false);
  assert.equal(a.hero.hp, HERO.hp);
  assert.ok(ev.some(e => e.type === 'hit') && lone.hp < 500);
});

// ===================================================================================== section 4: boons

test('4. boons are data: ten of them, two to an element, and the generating cycle closes', () => {
  assert.equal(Object.keys(BOONS).length, 10);
  for (const el of Object.keys(ELEMENTS)) assert.equal(Object.values(BOONS).filter(b => b.element === el).length, 2, el);
  assert.deepEqual(Object.keys(ELEMENTS).sort(), ['earth', 'fire', 'metal', 'water', 'wood']);
  // wood feeds fire, fire earth, earth metal, metal water, water wood
  assert.deepEqual(['wood', 'fire', 'earth', 'metal', 'water'].map(e => ELEMENTS[e].feeds), ['fire', 'earth', 'metal', 'water', 'wood']);
  for (const [id, b] of Object.entries(BOONS)) {
    assert.ok(typeof b.on === 'string' && Array.isArray(b.scales), id);
    assert.deepEqual(SLIPS[id], {type: 'boon', element: b.element, on: b.on});
  }
  assert.deepEqual(Object.keys(ARMY).sort(), ['drill', 'levyArcher', 'levyShield', 'levySpear']);
  assert.deepEqual(SLIPS.levySpear, {type: 'army', kind: 'spear', count: 4});
  // a boon is 30% stronger when the player owns a boon of the element that feeds its own
  const g = give(stage(), 'emberBlade');
  assert.equal(power(g, 'emberBlade'), 1);
  give(g, 'coldTide');
  assert.equal(power(g, 'emberBlade'), 1, 'water does not feed fire');
  give(g, 'arrowRain');
  assert.equal(power(g, 'emberBlade'), CYCLE.strong, 'wood feeds fire');
  assert.equal(power(g, 'arrowRain'), CYCLE.strong, 'and water feeds wood');
  assert.equal(power(g, 'coldTide'), 1);
});

test('4. every offer is three slips with an element boon and an army slip; a pick is felt', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = createGame(seed);
    for (let wave = 1; wave < LAST_WAVE; wave++) {
      g.spawns = []; g.units = g.units.filter(u => u.side === 'zhou');
      run(g, 200, NONE, game => game.phase === 'choose' || game.wave > wave);
      assert.equal(g.phase, 'choose');
      const c = g.choices;
      assert.equal(c.length, 3); assert.equal(new Set(c).size, 3);
      assert.ok(c.every(id => SLIPS[id]), c.join());
      assert.ok(c.some(id => SLIPS[id].type === 'boon') && c.some(id => SLIPS[id].type === 'army'), `seed ${seed} wave ${wave}: ${c}`);
      assert.ok(c.every(id => !has(g, id)), 'a boon already owned is not offered again');
      const i = c.findIndex(id => SLIPS[id].type === 'boon'), id = c[i];
      const ev = run(g, 1, {...NONE, pick: i});
      assert.deepEqual(ev.filter(e => e.type === 'upgrade' || e.type === 'boon').map(e => [e.type, e.id, e.element]), [['upgrade', id, undefined], ['boon', id, BOONS[id].element]]);
      assert.deepEqual(g.hero.boons.at(-1), {id, element: BOONS[id].element});
      run(g, 200, NONE, game => game.wave > wave);
    }
    assert.equal(g.hero.boons.length, LAST_WAVE - 1);
  }
});

test('4. army slips: a levy adds four of one kind in their places; drill makes four veterans', () => {
  const pick = id => {
    const g = createGame(2);
    g.spawns = []; g.units = g.units.filter(u => u.side === 'zhou');
    run(g, 5);
    g.choices = [id];
    const ev = run(g, 1, {...NONE, pick: 0});
    assert.deepEqual(ev.filter(e => e.type === 'upgrade' || e.type === 'boon').map(e => e.type), ['upgrade']);
    return g;
  };
  let g = pick('levyArcher');
  assert.deepEqual([counts(g).shields, counts(g).spears, counts(g).archers], [3, 3, 6]);
  g = pick('levyShield');
  assert.equal(counts(g).shields, 7);
  g.nextWaveAt = 1e9;
  run(g, 300);
  const band = living(g, 'zhou');
  assert.ok(sameLaneGap(band) >= UNIT.body - 1e-6, 'the block has made room for them');
  for (const a of band) for (const b of band) if (a.lane === b.lane && a.kind === 'shield' && b.kind !== 'shield') assert.ok(a.x > b.x, 'shields stand before the others of their lane');
  assert.ok([0, 1, 2].every(l => band.filter(u => u.lane === l).length >= 4), 'spread over the three ranks');
  g = pick('drill');
  const vets = living(g, 'zhou').filter(u => u.veteran);
  assert.equal(vets.length, 4); assert.equal(counts(g).veterans, 4);
  assert.deepEqual(vets.map(u => u.kind), ['shield', 'shield', 'shield', 'spear']);
  assert.equal(vets[0].maxHp, Math.round(BAND.shield.hp * 1.4)); assert.ok(near(vets[0].dmg, BAND.shield.dmg * 1.4));
});

test('4. fire: emberBlade leaves a burning stroke; wildfire makes the trail burn twice as long and burst where the gallop ends', () => {
  const g = give(stage(), 'emberBlade');
  const foe = dummy(g, 'axe', g.hero.x + 100), behind = dummy(g, 'axe', g.hero.x - 100, {lane: 1, form: 80});
  let ev = run(g, 1, {...NONE, strike: true});
  const t = ev.find(e => e.type === 'trail');
  assert.ok(t && t.kind === 'ember' && t.x0 === g.hero.x && t.x1 === g.hero.x + STRIKE.reach + UNIT.half);
  run(g, 60 * 3);
  assert.ok(near(1000 - foe.hp - STRIKE.dmg, BOONS.emberBlade.dps * BOONS.emberBlade.life, 1.6), `burned for ${1000 - foe.hp - STRIKE.dmg} over 2 s`);
  assert.equal(behind.hp, 1000);
  assert.ok(near(g.stats.by.emberBlade, 12, 1.6));
  // fed by wood, 30% more
  const fed = give(give(stage(), 'emberBlade'), 'arrowRain');
  const f2 = dummy(fed, 'axe', fed.hero.x + 100);
  run(fed, 1, {...NONE, strike: true});
  run(fed, 60 * 3);
  assert.ok(near(1000 - f2.hp - STRIKE.dmg, 12 * CYCLE.strong, 2));

  // wildfire: the trail burns twice as long, and the fire bursts where the gallop ends, among them
  const w = give(stage(7, 600), 'wildfire');
  w.hero.vx = HERO.top;
  const x0 = w.hero.x, len = HERO.top * GALLOP.speed * GALLOP.time;
  const atEnd = dummy(w, 'axe', x0 + len + 60, {form: 81}), beyond = dummy(w, 'axe', x0 + len + BOONS.wildfire.burstReach + 120, {lane: 1, form: 82});
  ev = run(w, 40, (game, i) => ({...NONE, move: 1, gallop: i === 0}), (game, e) => e.some(x => x.type === 'trail'));
  const trail = ev.find(e => e.type === 'trail'), burst = ev.find(e => e.type === 'shock');
  assert.ok(near(trail.x1 - trail.x0, len, 30) && trail.life === GALLOP.life * BOONS.wildfire.length, `trail ${trail.x1 - trail.x0} px for ${trail.life} s`);
  assert.ok(burst && burst.kind === 'burst' && near(burst.x, w.hero.x, 12), 'the burst is where the horse is');
  assert.equal(1000 - atEnd.hp >= BOONS.wildfire.burst, true, `the burst did ${1000 - atEnd.hp}`);
  assert.equal(beyond.hp, 1000);
  assert.ok(w.stats.by.wildfire >= BOONS.wildfire.burst);
  const inTrail = dummy(w, 'axe', x0 + len / 2, {lane: 2, form: 83});
  run(w, 60 * 6, {...NONE, move: 1});
  assert.ok(near(1000 - inTrail.hp, GALLOP.dps * GALLOP.life * 2, 4.1), `one who stands in the trail burns for ${1000 - inTrail.hp}`);
});

test('4. water: coldTide\'s sweep sends a wave that slows; spring mends the warband', () => {
  const g = give(stage(), 'coldTide');
  const inWave = addUnit(g, 'shang', 'axe', g.hero.x + 400, {facing: -1, lane: 0}), beyond = addUnit(g, 'shang', 'axe', g.hero.x + 460, {facing: -1, lane: 1});
  const zhou = addUnit(g, 'zhou', 'shield', g.hero.x - 1400, {lane: 0});
  zhou.hp = zhou.maxHp = 1e5; g.order = 'hold'; g.holdX = zhou.x; g.forms[0].x = zhou.x; g.hero.hp = 1e6;
  for (const u of [inWave, beyond]) u.hp = u.maxHp = 1e5;
  const ev = run(g, 24, (game, i) => ({...NONE, strike: i === 0, strikeHeld: i < 23}));
  assert.ok(ev.some(e => e.type === 'sweep' && e.tide === true));
  assert.ok(near(inWave.slow, BOONS.coldTide.time, .05)); assert.equal(beyond.slow, 0);
  const x = [inWave.x, beyond.x];
  run(g, 60);
  assert.ok(near((x[0] - inWave.x) / (x[1] - beyond.x), BOONS.coldTide.slow, .05), 'half speed');
  run(g, 60 * 3);
  assert.ok(inWave.slow <= 0, 'for three seconds');

  const s = give(stage(), 'spring');
  const hurt = addUnit(s, 'zhou', 'spear', 1000);
  dummy(s, 'axe', 4000);
  hurt.hp = 10;
  run(s, 60 * 4);
  assert.ok(near(hurt.hp, 10 + BOONS.spring.mend * 4, .1), `mended to ${hurt.hp}`);
  s.units = s.units.filter(u => u.side === 'zhou');
  run(s, 3);
  assert.equal(s.phase, 'choose'); assert.equal(hurt.hp, hurt.maxHp, 'and fully between waves');
});

test('4. wood: galeLeap throws foes back from the shock; arrowRain looses three arrows', () => {
  const slam = g => {
    const foe = dummy(g, 'axe', 0);
    g.hero.vx = 250;                                     // too slow to trample: only the shock touches the foe
    run(g, 1, {...NONE, leap: true});
    run(g, 90, NONE, game => game.hero.vy < 0);
    run(g, 1, {...NONE, strike: true});
    const ev = run(g, 90, NONE, (game, e) => { if (game.hero.air) foe.x = game.hero.x + 70; return e.some(x => x.type === 'shock'); });
    const x = foe.x;
    run(g, 60);
    return {thrown: foe.x - x, ev};
  };
  const plain = slam(stage()), gale = slam(give(stage(), 'galeLeap'));
  assert.ok(Math.abs(plain.thrown) < 2);
  assert.ok(near(gale.thrown, BOONS.galeLeap.throw, 12), `thrown ${gale.thrown} px`);
  assert.equal(gale.ev.find(e => e.type === 'shock').gale, true);
  const g = give(stage(7, 300), 'arrowRain');
  const archer = addUnit(g, 'zhou', 'archer', 1500, {lane: 0, facing: 1});
  g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500;
  const foes = [...Array(9)].map((_, i) => dummy(g, 'axe', 1800 + (i - 4) * 24, {lane: i % 3, form: 83 + i}));   // a crowd: every arrow finds someone
  run(g, 60, NONE, (game, e) => e.some(x => x.type === 'loose'));
  assert.equal(g.arrows.length, 3);
  assert.ok(g.arrows.every(a => a.side === 'zhou'));
  run(g, 70);
  assert.equal(foes.reduce((s, u) => s + 1000 - u.hp, 0), 3 * BAND.archer.dmg, 'three arrows land');
  assert.equal(g.stats.by.archer, BAND.archer.dmg); assert.equal(g.stats.by.arrowRain, 2 * BAND.archer.dmg);
  assert.equal(archer.hp, BAND.archer.hp);
});

test('4. metal: keenEdge\'s third strike is a gold blow that cuts through shields; mirrorShields send arrows back', () => {
  const g = give(stage(), 'keenEdge');
  const shield = dummy(g, 'shield', g.hero.x + 90, {form: 97});
  shield.stun = 0; shield.cd = 99;
  const dmg = [], crits = [];
  for (let n = 0; n < 6; n++) {
    const hp = shield.hp;
    const ev = run(g, 40, (game, i) => ({...NONE, strike: i === 0}));
    dmg.push(hp - shield.hp); crits.push(ev.some(e => e.type === 'crit'));
    assert.equal(ev.find(e => e.type === 'swing').gold, n % 3 === 2);
    shield.x = g.hero.x + 90; shield.kb = 0; shield.stun = 0;
  }
  assert.deepEqual(dmg, [1, 1, 4, 1, 1, 4].map(k => k * STRIKE.dmg / 2), 'half through the shield twice, then double and straight through');
  assert.deepEqual(crits, [false, false, true, false, false, true]);
  assert.equal(g.stats.by.keenEdge, 2 * STRIKE.dmg, 'the tally gives the boon what it added');

  const m = give(stage(7, 300), 'mirrorShields');
  const sh = addUnit(m, 'zhou', 'shield', 1500, {lane: 0, facing: 1});
  m.order = 'hold'; m.holdX = 1500; m.forms[0].x = 1500;
  const archer = addUnit(m, 'shang', 'archer', 1900, {facing: -1, lane: 0});
  archer.hp = archer.maxHp = 500; archer.cd = 0;
  const ev = run(m, 60 * 9, NONE, () => archer.hp < 500);
  assert.ok(ev.some(e => e.type === 'blocked'));
  assert.equal(500 - archer.hp, FOE.archer.dmg * BOONS.mirrorShields.dmg, 'the arrow comes back, twice as hard, to the one who loosed it');
  assert.equal(m.stats.by.mirrorShields, 18);
  assert.equal(sh.hp, BAND.shield.hp - 4.5);
});

test('4. earth: quake doubles the shock and holds foes a second; deepRoots gives 40 health and a brace that fails', () => {
  const slam = g => {
    const nearF = dummy(g, 'axe', 0), farF = dummy(g, 'axe', 0, {lane: 1, form: 84});
    g.hero.vx = 250;
    run(g, 1, {...NONE, leap: true});
    run(g, 90, NONE, game => game.hero.vy < 0);
    run(g, 1, {...NONE, strike: true});
    nearF.cd = 99;
    run(g, 90, NONE, (game, e) => { if (game.hero.air) { nearF.x = game.hero.x + 80; farF.x = game.hero.x + 250; nearF.stun = 0; } return e.some(x => x.type === 'shock'); });
    return {nearF, farF, g};
  };
  const plain = slam(stage()), quake = slam(give(stage(), 'quake'));
  assert.equal(plain.farF.hp, 1000); assert.ok(quake.farF.hp < 1000, 'twice as wide');
  assert.ok(near(plain.nearF.stun, SLAM.stun, .05)); assert.ok(near(quake.nearF.stun, BOONS.quake.hold, .05));
  assert.ok(quake.g.stats.by.quake > 0 && quake.g.stats.by.leapStrike > 0);

  const g = stage();
  g.choices = ['deepRoots']; g.phase = 'choose'; g.taught = true;
  run(g, 1, {...NONE, pick: 0});
  assert.equal(g.hero.maxHp, HERO.hp + 40); assert.equal(g.hero.hp, HERO.hp + 40);
  g.nextWaveAt = 1e9;
  const charge = () => {
    g.units = []; g.hero.stopT = 0; g.hero.safe = 0;
    addUnit(g, 'shang', 'spear', g.hero.x + 450, {facing: -1, lane: 1});
    g.hero.vx = HERO.top;
    return run(g, 90, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'braced' || x.type === 'trample'));
  };
  let ev = charge();
  assert.equal(ev.some(e => e.type === 'braced'), false, 'once a wave the spear fails');
  assert.ok(ev.some(e => e.type === 'trample'));
  assert.equal(g.hero.hp, 140);
  ev = charge();
  assert.ok(ev.some(e => e.type === 'braced'), 'the second time it holds');
});

// ===================================================================================== section 5: waves

test('5. six waves: every block can fight; shields from 2, archers from 3, both sides from 4, the captain last', () => {
  assert.equal(LAST_WAVE, 6); assert.equal(WAVE.budget.length, 6);
  const cost = list => list.reduce((s, k) => s + FOE[k].cost, 0);
  for (let seed = 1; seed <= 20; seed++) {
    const rand = createGame(seed).rand;
    for (let wave = 1; wave <= 6; wave++) {
      const groups = waveGroups(wave, rand), all = groups.flat();
      if (wave === 1) { assert.deepEqual(groups, [['spear'], ['spear', 'spear', 'spear']]); continue; }
      const blocks = wave === 6 ? groups.slice(0, -1) : groups;
      const left = waveBudget(wave) - cost(blocks.flat());
      assert.ok(left >= 0 && left < 5 * 2, `wave ${wave}: ${left} of the budget is left, less than a group would cost`);
      for (const gr of blocks) {
        // one file of shields and axes, one of spears whose reach passes them, archers behind: everyone can fight
        assert.ok(gr.length >= WAVE.groupLeast && gr.length <= WAVE.groupMax, `wave ${wave}: a group of ${gr.length}`);
        assert.ok(gr.slice(0, 3).every(k => k === 'shield' || k === 'axe'), gr.join());
        assert.ok(gr.slice(3, 6).every(k => k === 'spear'), gr.join());
        assert.ok(gr.slice(6).every(k => k === 'archer') && gr.filter(k => k === 'archer').length <= Math.floor(gr.length / 3), gr.join());
      }
      if (wave < 3) assert.ok(!all.includes('archer'));
      assert.equal(all.filter(k => k === 'captain').length, wave === 6 ? 1 : 0);
      if (wave === 6) assert.deepEqual(groups.at(-1), WAVE.guard, 'the captain comes last, inside his guard');
      assert.ok(groups.every(gr => gr.length >= WAVE.groupLeast), 'no wave ends on a straggler or two');
    }
  }
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) waveGroups(5, createGame(seed).rand).flat().forEach(k => seen.add(k));
  assert.deepEqual([...seen].sort(), ['archer', 'axe', 'shield', 'spear']);
  // sides
  const sides = wave => {
    const g = createGame(3);
    g.hero.x = g.hero.px = 2400; g.hero.hp = g.hero.maxHp = 1e6;
    jumpTo(g, wave);
    const out = [], known = new Set();
    for (let i = 0; i < 60 * 60 && g.spawns.length; i++) {
      step(g, NONE); g.events.length = 0;
      const fresh = g.units.filter(u => u.side === 'shang' && !known.has(u.id));
      if (fresh.length) { out.push(Math.sign(fresh[0].x - g.hero.x)); fresh.forEach(u => known.add(u.id)); }
    }
    return out;
  };
  assert.ok(sides(3).every(s => s === 1), 'wave 3 comes from the right');
  const four = sides(4);
  assert.ok(four.includes(1) && four.includes(-1), `wave 4 comes from both sides: ${four}`);
});

test('5. win after wave 6; the hero falls before the run is lost; nothing moves after the end', () => {
  const g = createGame(9);
  jumpTo(g, LAST_WAVE);
  g.spawns = g.spawns.slice(-1); g.spawns[0].at = g.t + .5;
  run(g, 60);
  assert.ok(living(g, 'shang', 'captain').length === 1);
  for (const u of living(g, 'shang')) u.hp = 0.5;
  g.hero.hp = g.hero.maxHp = 1e6;
  g.order = 'charge';
  let ev = run(g, 60 * 40, {...NONE, move: 1, strike: true}, game => game.phase !== 'fight');
  assert.equal(g.phase, 'won');
  assert.deepEqual(ev.filter(e => ['rout', 'cleared', 'won'].includes(e.type)).map(e => e.type), ['rout', 'cleared', 'won']);
  const frozen = snapshot(g);
  run(g, 30, {...NONE, move: 1, strike: true});
  assert.equal(snapshot(g), frozen);

  const l = stage();
  const axe = addUnit(l, 'shang', 'axe', l.hero.x + 500, {facing: -1, lane: 0});
  axe.cd = 0;
  l.hero.hp = 10; l.hero.vx = 400;
  ev = run(l, 300, {...NONE, move: 1}, (game, e) => e.some(x => x.type === 'fall'));
  assert.deepEqual(ev.filter(e => e.type === 'fall').map(e => e.dir), [-1]);
  assert.equal(l.phase, 'fight'); assert.equal(l.hero.state, 'fallen');
  const t0 = l.t;
  ev = run(l, 300, {move: 1, leap: true, strike: true, strikeHeld: true, gallop: true, rally: true, order: 'charge', pick: 0}, game => game.phase === 'lost');
  assert.equal(ev.some(e => ['swing', 'sweep', 'leap', 'dash', 'rally', 'order', 'hurt'].includes(e.type)), false, 'no verb answers and nothing more wounds him');
  assert.ok(near(l.t - t0, HERO.fallTime, .12)); assert.equal(l.hero.vx, 0);
  assert.equal(ev.at(-1).type, 'lost');
});

test('5. the same seed and inputs replay the same battle', () => {
  const script = (g, i) => ({move: i % 400 < 260 ? 1 : -1, leap: i % 97 === 0, strike: i % 23 === 0, strikeHeld: i % 230 < 40, gallop: i % 800 === 9, rally: i % 1300 === 11,
    order: i % 310 === 0 ? ['follow', 'charge', 'hold'][(i / 310) % 3] : null, pick: g.phase === 'choose' ? i % 3 : null});
  const a = createGame(42), b = createGame(42), c = createGame(43);
  for (const g of [a, b, c]) g.hero.hp = g.hero.maxHp = 1e5;
  const ea = run(a, 4800, script), eb = run(b, 4800, script);
  run(c, 4800, script);
  assert.equal(snapshot(a), snapshot(b));
  assert.deepEqual(ea, eb);
  assert.ok(ea.length > 100 && a.wave >= 2);
  assert.notEqual(snapshot(a), snapshot(c));
  const names = new Set(ea.map(e => e.type));
  for (const type of ['swing', 'sweep', 'hit', 'leap', 'land', 'dash', 'trail', 'rally', 'fullCry', 'loose', 'wave']) assert.ok(names.has(type), `the script sends ${type}`);
});

test('5. the contract\'s fields are there', () => {
  const g = createGame(1);
  for (const key of ['x', 'y', 'px', 'py', 'vx', 'vy', 'facing', 'hp', 'maxHp', 'state', 'stateT', 'topSpeed', 'blade', 'safe', 'hold', 'fullCry', 'cd', 'buffs', 'boons']) assert.ok(key in g.hero, key);
  assert.deepEqual(g.hero.cd, {gallop: 0, rally: 0}); assert.equal(g.hero.hold, 0); assert.equal(g.hero.fullCry, false);
  assert.deepEqual([g.hero.buffs, g.hero.boons], [[], []]);
  for (const u of g.units) for (const key of ['id', 'side', 'kind', 'veteran', 'x', 'px', 'lane', 'facing', 'hp', 'maxHp', 'state', 'stateT', 'flash']) assert.ok(key in u, key);
  assert.deepEqual(g.events.map(e => e.type), ['wave']);
  assert.equal(g.phase, 'fight'); assert.equal(g.wave, 1); assert.equal(g.order, 'follow');
});

// ===================================================================================== section 5: three players

// Three scripted players, by skill. They read only what a player can see on screen.
const pickBoon = g => { const i = g.choices.findIndex(id => SLIPS[id].type === 'boon'); return i < 0 ? 0 : i; };
const pickArmyWhenThin = g => living(g, 'zhou').length < 6 ? g.choices.findIndex(id => SLIPS[id].type === 'army') : pickBoon(g);

/** Rides through, comes back, leaps set spears, strikes in reach, orders charge and follow. `all` adds the other verbs. */
function rider(all) {
  let dir = 1, holding = false;
  return g => {
    const h = g.hero, input = {...NONE};
    if (g.phase === 'choose') input.pick = pickArmyWhenThin(g);
    const foes = living(g, 'shang'), band = living(g, 'zhou');
    const order = foes.length ? 'charge' : 'follow';
    if (g.order !== order) input.order = order;
    if (!foes.length) { holding = false; return input; }
    if (!foes.some(u => (u.x - h.x) * dir > -40) && Math.min(...foes.map(u => Math.abs(u.x - h.x))) > 280) dir = -dir;
    if (h.x >= WORLD.w - HERO.half - 1) dir = -1;
    if (h.x <= HERO.half + 1) dir = 1;
    input.move = dir;
    const v = h.vx * dir, ahead = u => (u.x - h.x) * dir;
    const front = foes.filter(u => ahead(u) > 0).sort((a, b) => ahead(a) - ahead(b));
    const set = front.find(u => u.kind === 'spear' && u.state === 'brace' && u.facing === -dir);
    const crowd = front.filter(u => ahead(u) < (front[0] ? ahead(front[0]) + 150 : 0)).length;
    let strike = false;
    for (const u of foes) if (h.facing === dir && ahead(u) > -10 && ahead(u) < STRIKE.reach + 10 + Math.max(0, v - u.vx * dir) * .06) strike = true;
    if (set && !h.air && ahead(set) < BRACE.reach + 20 + v * .25) {
      if (all && h.cd.gallop <= 0 && ahead(set) < 260 && crowd >= 3) input.gallop = true;     // through the spears on fire
      else if (v >= HERO.leapMin) input.leap = true;
      else if (ahead(set) < 320) input.move = 0;
    }
    if (all) {
      // leap strike: coming down among them
      if (h.air && h.vy < 0 && !h.slam && foes.filter(u => Math.abs(u.x - (h.x + h.vx * .15)) < 150).length >= 2) { input.strike = true; return input; }
      // rally when the warband is in the fight
      if (h.cd.rally <= 0 && band.filter(b => Math.abs(b.x - h.x) <= RALLY.range && foes.some(f => Math.abs(f.x - b.x) < 120)).length >= 3) input.rally = true;
      // flame gallop out of trouble
      if (h.cd.gallop <= 0 && !h.air && h.hp < h.maxHp * .4 && foes.filter(u => Math.abs(u.x - h.x) < 150).length >= 2) input.gallop = true;
      // sweep a crowd that has no set spear in front
      if (!holding && !set && !h.air && crowd >= 3 && front[0] && ahead(front[0]) < 150 + v * .45 && ahead(front[0]) > 200 && h.sweepT < 0) { holding = true; input.strike = true; input.strikeHeld = true; return input; }
      if (holding) {
        const inReach = front.filter(u => ahead(u) < SWEEP.reach).length;
        if ((h.hold >= SWEEP.holdMin && inReach >= 2) || h.hold > 1.4 || set || !front.length) holding = false;   // let go
        else { input.strikeHeld = true; return input; }
      }
    }
    if (strike) input.strike = true;
    return input;
  };
}
/** Rides at the nearest foe and strikes when one is in reach. No leap, no orders, no other verb. */
function naive() {
  return g => {
    const h = g.hero, input = {...NONE, pick: g.phase === 'choose' ? 0 : null};
    const foes = living(g, 'shang');
    if (!foes.length) return input;
    const near = foes.reduce((a, b) => Math.abs(b.x - h.x) < Math.abs(a.x - h.x) ? b : a);
    input.move = near.x > h.x ? 1 : -1;
    input.strike = foes.some(u => (u.x - h.x) * h.facing > -10 && (u.x - h.x) * h.facing < STRIKE.reach + 10);
    return input;
  };
}
/** One verb only: rides, leaps set spears, and uses nothing but the named verb. */
function single(verb) {
  let dir = 1, holding = false;
  return g => {
    const h = g.hero, input = {...NONE};
    if (g.phase === 'choose') input.pick = pickArmyWhenThin(g);
    const foes = living(g, 'shang');
    const order = foes.length ? 'charge' : 'follow';
    if (g.order !== order) input.order = order;
    if (!foes.length) { holding = false; return input; }
    if (!foes.some(u => (u.x - h.x) * dir > -40) && Math.min(...foes.map(u => Math.abs(u.x - h.x))) > 280) dir = -dir;
    if (h.x >= WORLD.w - HERO.half - 1) dir = -1;
    if (h.x <= HERO.half + 1) dir = 1;
    input.move = dir;
    const v = h.vx * dir, ahead = u => (u.x - h.x) * dir;
    const front = foes.filter(u => ahead(u) > 0).sort((a, b) => ahead(a) - ahead(b));
    const set = front.find(u => u.kind === 'spear' && u.state === 'brace' && u.facing === -dir);
    if (verb === 'slam') {
      if (h.air) { if (h.vy < 0 && !h.slam) input.strike = true; return input; }
      if (front[0] && v >= HERO.leapMin && ahead(front[0]) < 150 + v * .3) input.leap = true;   // leap so as to come down among them
      return input;
    }
    if (set && !h.air && ahead(set) < BRACE.reach + 20 + v * .25) { if (v >= HERO.leapMin) input.leap = true; else if (ahead(set) < 320) input.move = 0; }
    if (verb === 'sweep') {
      if (!holding && !h.air && front[0] && ahead(front[0]) < 150 + v * .45 && h.sweepT < 0) { holding = true; input.strike = true; input.strikeHeld = true; return input; }
      if (holding) {
        if ((h.hold >= SWEEP.holdMin && front.filter(u => ahead(u) < SWEEP.reach).length >= 1) || h.hold > 1.4 || !front.length) holding = false;
        else input.strikeHeld = true;
      }
    }
    return input;
  };
}
/** Stands behind the warband under `hold` and does nothing: how the warband does alone. */
function bystander() {
  let said = false;
  return g => {
    const input = {...NONE};
    if (g.phase === 'choose') input.pick = pickBoon(g);
    if (!said) { input.order = 'hold'; said = true; }
    const F = g.forms[0], h = g.hero, back = F.x - F.dir * 260;
    input.move = Math.abs(h.x - back) > 30 ? Math.sign(back - h.x) : 0;       // behind the last file
    return input;
  };
}
const BOTS = {competent: () => rider(true), striker: () => rider(false), naive, sweeper: () => single('sweep'), slammer: () => single('slam'), bystander};
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN; };

function play(seed, player, {maxTime = 900, untilWave = 99} = {}) {
  const g = createGame(seed), used = {};
  let steps = 0, frames = 0, close = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && g.wave < untilWave && steps * STEP < maxTime) {
    step(g, player(g)); steps += 1;
    for (const e of g.events) used[e.type] = (used[e.type] || 0) + 1;
    g.events.length = 0;
    if (steps % 2 === 0) { frames += 1; if (sameLaneGap(g.units.filter(u => u.state !== 'dead' && u.side === 'zhou')) < 20 || sameLaneGap(g.units.filter(u => u.state !== 'dead' && u.side === 'shang')) < 20) close += 1; }
  }
  return {g, seconds: steps * STEP, used, close: close / Math.max(1, frames)};
}
const VERBS = {strike: ['strike', 'keenEdge', 'emberBlade'], sweep: ['sweep'], trample: ['trample', 'breakThrough'], gallop: ['gallop', 'wildfire'], leapStrike: ['leapStrike', 'quake', 'galeLeap']};
const WARBAND = ['shield', 'spear', 'archer', 'arrowRain', 'mirrorShields'];

test('5. difficulty: the players by skill, the one-verb players, and the warband alone, over 20 seeds', t => {
  const table = {};
  for (const name of ['competent', 'striker', 'naive', 'sweeper', 'slammer']) {
    const rows = [];
    for (let seed = 1; seed <= 20; seed++) rows.push(play(seed, BOTS[name]()));
    assert.ok(rows.every(r => r.g.phase === 'won' || r.g.phase === 'lost'), `${name}: every run ends`);
    const wins = rows.filter(r => r.g.phase === 'won'), fell = [1, 2, 3, 4, 5, 6].map(w => rows.filter(r => r.g.phase === 'lost' && r.g.wave === w).length);
    const by = {}, hurt = {};
    for (const r of rows) { for (const k in r.g.stats.by) by[k] = (by[k] || 0) + r.g.stats.by[k]; for (const k in r.g.stats.hurtBy) hurt[k] = (hurt[k] || 0) + r.g.stats.hurtBy[k]; }
    const all = Object.values(by).reduce((a, b) => a + b, 0), sum = list => list.reduce((s, k) => s + (by[k] || 0), 0);
    const hero = Object.fromEntries(Object.entries(VERBS).map(([k, list]) => [k, sum(list)])), heroAll = Object.values(hero).reduce((a, b) => a + b, 0);
    table[name] = {rows, wins: wins.length, time: median(rows.map(r => r.seconds)), winTime: median(wins.map(r => r.seconds)), wave: median(rows.map(r => r.g.wave)), fell,
      band: sum(WARBAND) / all, verbs: Object.fromEntries(Object.entries(hero).map(([k, v]) => [k, v / heroAll])), close: rows.reduce((s, r) => s + r.close, 0) / rows.length};
    const pct = v => `${(100 * v).toFixed(0)}%`, share = o => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(1)}%`).join(', '); };
    t.diagnostic(`${name}: wins ${wins.length}/20; median run ${table[name].time.toFixed(0)} s${wins.length ? ` (won runs ${table[name].winTime.toFixed(0)} s)` : ''}; median wave reached ${table[name].wave}; falls in waves 1 to 6: ${fell.join(' ')}`);
    t.diagnostic(`   the hero's damage by verb: ${Object.entries(table[name].verbs).map(([k, v]) => `${k} ${pct(v)}`).join(', ')}`);
    t.diagnostic(`   the warband's share of all damage to the Shang: ${pct(table[name].band)} (${WARBAND.map(k => `${k} ${(100 * (by[k] || 0) / all).toFixed(1)}%`).join(', ')})`);
    if (name === 'competent') {
      t.diagnostic(`   every source: ${share(by)}`);
      t.diagnostic(`   damage to the hero: ${share(hurt)}`);
      const n = type => rows.reduce((s, r) => s + (r.used[type] || 0), 0);
      t.diagnostic(`   per run: ${['swing', 'sweep', 'shock', 'dash', 'rally', 'leap', 'volley', 'crit'].map(k => `${k} ${(n(k) / 20).toFixed(1)}`).join(', ')}`);
      t.diagnostic(`   frames with two of one lane and one side within 20 px: ${(100 * table[name].close).toFixed(2)}%`);
      for (const type of ['swing', 'sweep', 'shock', 'dash', 'rally', 'leap', 'fullCry']) assert.ok(n(type) > 20, `the competent player uses ${type}`);
    }
  }
  // the warband alone under `hold`, the hero standing by
  const alone = [];
  for (let seed = 1; seed <= 20; seed++) alone.push(play(seed, BOTS.bystander()));
  const past2 = alone.filter(r => r.g.wave >= 3 || r.g.phase === 'won').length;
  t.diagnostic(`the warband alone (hold, hero standing by): clears wave 2 on ${past2}/20; falls in waves 1 to 6: ${[1, 2, 3, 4, 5, 6].map(w => alone.filter(r => r.g.phase === 'lost' && r.g.wave === w).length).join(' ')}`);

  // Targets. The bands are a little wider than the targets: they catch a retune that breaks them, not seed noise.
  const c = table.competent;
  assert.ok(c.wins >= 8 && c.wins <= 16, `competent wins ${c.wins}/20 (target 50 to 70%)`);
  assert.ok(c.winTime >= 240 && c.winTime <= 360, `a won run takes ${c.winTime.toFixed(0)} s (target 4 to 6 minutes)`);
  assert.ok(c.band >= .25 && c.band <= .45, `beside a competent hero the warband does ${(100 * c.band).toFixed(0)}% of the damage (target 30 to 40%)`);
  assert.ok(Math.max(...Object.values(c.verbs)) <= .38, `no verb carries the battle: ${JSON.stringify(c.verbs)}`);
  assert.ok(c.verbs.strike >= c.verbs.sweep, 'the plain strike does more than the sweep');
  assert.ok(c.close < .01, `two of a lane within 20 px in ${(100 * c.close).toFixed(2)}% of frames`);
  assert.ok(past2 > 10, `eight men under hold beat wave 2 on ${past2} of 20`);
  assert.ok(table.naive.wins === 0 && table.naive.wave <= 3 && table.naive.rows.every(r => r.g.wave >= 2), `never leaping: wave ${table.naive.wave}; wave 1 is safe`);
  assert.ok(table.striker.wins < c.wins && table.sweeper.wins < c.wins && table.slammer.wins < c.wins, 'no narrower player does as well as the one who uses every verb');
  assert.ok(table.slammer.wave <= 4, `leap strike only falls by wave ${table.slammer.wave}`);
});

// ===================================================================================== release fixes (test round 2)

test('R. brick ranks: at rest no two of a block share an x, on either side', () => {
  const g = createGame(2);
  jumpTo(g, 5, {shield: 5, spear: 4, archer: 4});
  g.hero.hp = g.hero.maxHp = 1e6;
  run(g, 70);
  for (const side of ['zhou', 'shang']) {
    const xs = living(g, side).map(u => u.x).sort((a, b) => a - b);
    assert.ok(xs.length >= 6);
    let least = Infinity;
    for (let i = 1; i < xs.length; i++) least = Math.min(least, xs[i] - xs[i - 1]);
    assert.ok(least >= UNIT.brick - 1e-6, `${side}: the nearest two stand ${least} px apart in x`);
  }
  assert.ok(near(UNIT.brick, UNIT.body / 3, 1));
});

test('R. the warband re-forms without heaping: a turn about passes cleanly, a levy is drawn up in place', () => {
  const g = stage(7, 2000);
  const band = addBlock(g, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear', 'archer', 'archer'], 1930, 1);
  dummy(g, 'axe', 4600, {form: 99});
  g.hero.vx = -1; g.hero.facing = -1;
  run(g, 1, {...NONE, order: 'hold'});
  let close = 0, steps = 0;
  run(g, 60 * 5, NONE, game => { steps += 1; if (sameLaneGap(band) < 20) close += 1; return game.forms[0].reform <= 0 && steps > 5; });
  assert.ok(steps < 60, `the block is in order again after ${steps} steps`);
  assert.ok(close <= 14, `two of a lane were within 20 px for ${close} steps`);
  assert.ok(sameLaneGap(band) >= UNIT.body - 1);
  // a levy between waves: nobody pushes through anybody
  g.units = g.units.filter(u => u.side === 'zhou'); g.phase = 'choose'; g.choices = ['levyShield'];
  run(g, 1, {...NONE, pick: 0});
  assert.equal(counts(g).shields, 7);
  assert.ok(sameLaneGap(living(g, 'zhou')) >= UNIT.body - 1e-6, 'drawn up with room for every man at once');
  // and the warband does not turn about again within 12 s, nor with an enemy upon it
  assert.equal(FORM.settle, 12); assert.ok(FORM.turnZhou > FORM.turn);
});

test('R. the formation pays: locked shields take a third, a spear behind a shield thrusts harder, a volley hits harder and staggers', () => {
  // shields
  const hit = shields => {
    const g = stage(7, 300);
    const block = addBlock(g, 'zhou', shields, 1500, 1);
    g.order = 'hold'; g.holdX = 1500;
    const axe = addUnit(g, 'shang', 'axe', 1500 + UNIT.body + UNIT.gap, {facing: -1, lane: 1});
    axe.cd = 0;
    run(g, 60, NONE, (game, e) => e.some(x => x.type === 'blocked'));
    return BAND.shield.hp - Math.min(...block.map(u => u.hp));
  };
  assert.equal(hit(['shield']), FOE.axe.dmg / 2, 'alone: half');
  assert.ok(near(hit(['shield', 'shield', 'shield']), FOE.axe.dmg * UNIT.wall), 'side by side: a third');
  // spears
  const thrust = kinds => {
    const g = stage(7, 300);
    g.forms[0].x = 1500 + UNIT.brick;
    kinds.forEach((kind, i) => addUnit(g, 'zhou', kind, 1500 - i * UNIT.file, {lane: 0, facing: 1}));   // one behind the other on one lane
    g.order = 'hold'; g.holdX = 1500 + UNIT.brick;
    const foe = dummy(g, 'axe', 1500 + UNIT.body + UNIT.gap, {lane: 0, form: 77});
    for (const u of living(g, 'zhou', 'shield')) u.cd = 99;
    run(g, 120, NONE, () => foe.hp < 1000);
    return 1000 - foe.hp;
  };
  assert.equal(thrust(['spear']), BAND.spear.dmg);
  assert.equal(thrust(['shield', 'spear']), BAND.spear.dmg * BAND.spear.cover, 'from behind a shield: half again');
  // archers
  const shot = n => {
    const g = stage(7, 300);
    for (let l = 0; l < n; l++) addUnit(g, 'zhou', 'archer', 1500, {lane: l, facing: 1});
    g.order = 'hold'; g.holdX = 1500; g.forms[0].x = 1500;
    const foe = addUnit(g, 'shang', 'axe', 1500 + 300, {facing: -1, lane: 0, form: 77});
    foe.hp = foe.maxHp = 1000; foe.cd = 99; foe.stun = 0;
    let stunned = false;
    const ev = run(g, 230, NONE, () => { stunned = stunned || foe.state === 'stun'; return false; });
    return {dmg: 1000 - foe.hp, stunned, volleys: ev.filter(e => e.type === 'volley').length};
  };
  const one = shot(1), three = shot(3);
  assert.ok(one.dmg > 0 && one.dmg % BAND.archer.dmg === 0 && !one.stunned && one.volleys === 0, `one archer: ${one.dmg}, no volley`);
  assert.ok(three.dmg >= 3 * BAND.archer.dmg * BAND.archer.volley && three.dmg % (BAND.archer.dmg * BAND.archer.volley) === 0, `loosed together, half again each: ${three.dmg}`);
  assert.ok(three.stunned && three.volleys >= 1, 'and the volley staggers');
});

test('R. the leap strike has answers: set spears under the landing take the horse, and shields keep their feet', () => {
  const g = stage();
  g.taught = true;
  const spear = addUnit(g, 'shang', 'spear', g.hero.x + 420, {facing: -1, lane: 1});
  spear.cd = 99;
  g.hero.vx = 400;
  run(g, 1, {...NONE, move: 1, leap: true});
  let ev = run(g, 60, {...NONE, move: 1}, game => game.hero.vy < 0);
  spear.x = g.hero.x + g.hero.vx * (2 * HERO.leapV / HERO.gravity - g.hero.airT) + 60;       // 60 px beyond where the horse comes down
  ev = run(g, 60, (game, i) => ({...NONE, move: 1, strike: i === 0}), (game, e) => e.some(x => x.type === 'land'));
  assert.equal(ev.some(e => e.type === 'shock'), false, 'no shock');
  const braced = ev.find(e => e.type === 'braced');
  assert.ok(braced && braced.slam === true);
  assert.equal(g.hero.hp, HERO.hp - BRACE.dmg); assert.equal(g.hero.state, 'stopped');
  assert.equal(spear.hp, FOE.spear.hp);
  // shields
  const s = stage();
  const shield = dummy(s, 'shield', 0, {form: 70}), axe = dummy(s, 'axe', 0, {lane: 1, form: 71});
  shield.stun = 0; shield.cd = 99;
  s.hero.vx = 250;
  run(s, 1, {...NONE, leap: true});
  run(s, 90, NONE, game => game.hero.vy < 0);
  run(s, 1, {...NONE, strike: true});
  ev = run(s, 90, NONE, (game, e) => { if (game.hero.air) { shield.x = game.hero.x + 80; axe.x = game.hero.x - 80; shield.stun = 0; } return e.some(x => x.type === 'shock'); });
  assert.equal(shield.hp, 1000, 'the shield is set against the shock');
  assert.ok(axe.hp < 1000);
  assert.ok(ev.some(e => e.type === 'blocked' && e.by === 'leapStrike'));
  assert.ok(SLAM.dmg < STRIKE.dmg * 2 && SLAM.stun <= .4);
});

test('R. galeLeap is felt on every landing; rally makes every weapon ready at once; full cry needs its 0.8 s again', () => {
  const g = give(stage(), 'galeLeap');
  const foe = dummy(g, 'axe', 0);
  g.hero.vx = 250;
  run(g, 1, {...NONE, leap: true});
  const ev = run(g, 120, NONE, (game, e) => { if (game.hero.air) foe.x = game.hero.x + 70; return e.some(x => x.type === 'shock'); });
  const gust = ev.find(e => e.type === 'shock');
  assert.ok(gust && gust.kind === 'gust', 'a landing with no strike still throws them back');
  const x = foe.x;
  run(g, 60);
  assert.ok(near(foe.x - x, BOONS.galeLeap.throw, 20), `thrown ${foe.x - x} px`); assert.equal(1000 - foe.hp, BOONS.galeLeap.gustDmg);
  // rally
  const r = stage(7, 1500);
  const men = addBlock(r, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear'], 1500, 1);
  r.order = 'hold'; r.holdX = 1500;
  for (const l of [0, 1, 2]) dummy(r, 'axe', 1500 + UNIT.body + UNIT.gap + (l - 1) * UNIT.brick, {lane: l, form: 60 + l});
  for (const u of men) u.cd = 5;
  run(r, 1, {...NONE, rally: true});
  run(r, 2);
  assert.ok(men.every(u => u.state === 'windup' || u.state === 'attack'), `all six begin a blow at once: ${men.map(u => u.state)}`);
  assert.equal(RALLY.haste, 2);
  // full cry
  const c = stage(7, 600);
  dummy(c, 'axe', 4700);
  c.hero.vx = HERO.top;
  run(c, 60, {...NONE, move: 1});
  assert.equal(c.hero.fullCry, true);
  c.hero.vx = HERO.top * .8;                                // a dip under 90%, not under 70%: still in full cry
  run(c, 2, {...NONE, move: 1});
  assert.equal(c.hero.fullCry, true);
  c.hero.vx = HERO.top * .6;                                // lost
  run(c, 1, {...NONE, move: 1});
  assert.equal(c.hero.fullCry, false);
  let steps = 0;
  run(c, 200, {...NONE, move: 1}, game => { if (game.hero.vx >= HERO.top * CRY.on) steps += 1; return game.hero.fullCry; });
  assert.ok(near(steps * STEP, CRY.time, STEP * 2), `full cry again ${steps * STEP} s after passing 90%`);
});

test('R. Shang archers spread their aim over the warband and the hero', () => {
  const g = stage(7, 1500);
  const men = addBlock(g, 'zhou', ['shield', 'shield', 'shield', 'spear', 'spear', 'spear'], 1600, 1);
  for (const u of men) u.hp = u.maxHp = 1e5;
  g.order = 'hold'; g.holdX = 1600; g.hero.hp = g.hero.maxHp = 1e5;
  const archers = [0, 1, 2].map(l => addUnit(g, 'shang', 'archer', 2100, {facing: -1, lane: l, form: 50}));
  g.forms.push({id: 50, side: 'shang', dir: -1, x: 2100, turnT: 0, reform: 0, laneT: 0, settle: 0});
  for (const u of archers) { u.hp = u.maxHp = 1e5; }
  let atHero = 0, atBand = 0;
  const ev = run(g, 60 * 30, NONE, game => { for (const a of game.arrows) if (a.side === 'shang' && !a.seen) { a.seen = true; if (Math.abs(a.aim - game.hero.x) < 50) atHero += 1; else atBand += 1; } return false; });
  assert.ok(atHero >= 8 && atBand >= 8, `${atHero} arrows for the hero, ${atBand} for the warband`);
  assert.ok(ev.filter(e => e.type === 'blocked').length >= 5, 'and Zhou shields meet them');
});
