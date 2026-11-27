// The campaign's clock: how many Shang, of which kinds, when the elites and bosses come; pickups; the level curve.
// Owner: rules·campaign (A).

import {T} from './base.js';

// --------------------------------------------------------------------------------------------- the schedule
// Between two rows the numbers run in a straight line. `alive` is how many Shang the field is kept at, `rate`
// the most that may enter each second, `hp` what their health is multiplied by, `armour` the bronze they wear (taken off every blow, not off burning: from
// 5:00 many small blows count for little and a deep build is asked for), `mix` the weights of the kinds. They enter in clumps from every side,
// `SPAWN.near`..`SPAWN.far` px from the hero (off screen).
export const SCHEDULE = {
  waves: [
    {t: 0, alive: 14, rate: 1.8, hp: 1, armour: 0, mix: {spear: 1}},
    {t: 30, alive: 20, rate: 2.4, hp: 1, armour: 0, mix: {spear: 4, axe: 1}},
    {t: 60, alive: 30, rate: 3, hp: 1, armour: 0, mix: {spear: 4, axe: 2}},
    {t: 120, alive: 45, rate: 3.2, hp: 1.1, armour: 0, mix: {spear: 5, axe: 2, shield: 1, archer: 1}},
    {t: 150, alive: 60, rate: 3.7, hp: 1.2, armour: 0, mix: {spear: 5, axe: 2, shield: 1, archer: 1, drummer: .15}},
    {t: 180, alive: 75, rate: 4.2, hp: 1.35, armour: 0, mix: {spear: 5, axe: 3, shield: 2, archer: 1, drummer: .2}},
    {t: 240, alive: 110, rate: 5.2, hp: 1.7, armour: 0, mix: {spear: 5, axe: 3, shield: 2, archer: 2, drummer: .25, cavalry: .5}},
    {t: 300, alive: 150, rate: 6.5, hp: 2.4, armour: 4, mix: {spear: 4, axe: 4, shield: 2, archer: 2, drummer: .3, cavalry: 1}},
    {t: 360, alive: 195, rate: 8, hp: 3, armour: 8, mix: {spear: 4, axe: 4, shield: 3, archer: 2, drummer: .3, cavalry: 1.2}},
    {t: 420, alive: 240, rate: 10, hp: 7.8, armour: 12, mix: {spear: 4, axe: 4, shield: 3, archer: 2, drummer: .35, cavalry: 1}},
    {t: 480, alive: 270, rate: 12, hp: 12.5, armour: 21, mix: {spear: 3, axe: 5, shield: 3, archer: 2, drummer: .35, cavalry: 1}},
    {t: 540, alive: 290, rate: 14, hp: 18, armour: 27, mix: {spear: 3, axe: 5, shield: 4, archer: 2, drummer: .4, cavalry: 1}},
    // stretch two (PLACEHOLDER numbers: the mass keeps growing as before, and its new kinds join the old)
    {t: 600, alive: 300, rate: 17, hp: 25.5, armour: 31, mix: {spear: 2, axe: 4, shield: 3, archer: 2, drummer: .3, cavalry: 1, fireCrow: 1, wasp: 1}},
    {t: 720, alive: 360, rate: 18, hp: 32, armour: 34, mix: {spear: 1, axe: 3, shield: 3, archer: 2, cavalry: 1, fireCrow: 2, wasp: 1, flyingTiger: 2, fireDragon: 1, plague: .3, bladeCart: .1}},
    {t: 900, alive: 420, rate: 20, hp: 45, armour: 40, mix: {axe: 2, shield: 2, archer: 2, cavalry: 1, fireCrow: 2, wasp: 2, flyingTiger: 3, fireDragon: 2, plague: .4, bladeCart: .15}},
    // stretch three
    {t: 1200, alive: 450, rate: 22, hp: 75, armour: 50, mix: {axe: 1, shield: 2, archer: 2, flyingTiger: 1, fireDragon: 1, bianGuard: 2, centipede: 1, snake: 1, dog: 2, boar: 1, goat: 1, buffalo: .5, pox: .4}},
    {t: 1500, alive: 450, rate: 24, hp: 110, armour: 58, mix: {shield: 2, archer: 2, bianGuard: 3, centipede: 2, snake: 2, dog: 2, boar: 2, goat: 2, buffalo: 1, pox: .4}},
    {t: 1800, alive: 450, rate: 26, hp: 150, armour: 66, mix: {shield: 2, archer: 2, bianGuard: 3, centipede: 2, snake: 2, dog: 2, boar: 2, goat: 2, buffalo: 1, pox: .4}},
    {t: 2400, alive: 450, rate: 28, hp: 220, armour: 76, mix: {shield: 2, archer: 2, bianGuard: 3, centipede: 2, snake: 2, dog: 2, boar: 2, goat: 2, buffalo: 1, pox: .4}},     // past the last row their health keeps growing
  ],
  // a chariot about every minute from 1:50: each leaves a chest
  elites: [
    {t: 110, kind: 'chariot', count: 1}, {t: 170, kind: 'chariot', count: 1}, {t: 230, kind: 'chariot', count: 1},
    {t: 350, kind: 'chariot', count: 1}, {t: 410, kind: 'chariot', count: 1}, {t: 470, kind: 'chariot', count: 2},
    {t: 530, kind: 'chariot', count: 2}, {t: 575, kind: 'chariot', count: 1},
    // stretches two and three (PLACEHOLDER): a chest about every minute between the bosses
    {t: 650, kind: 'bladeCart', count: 2}, {t: 700, kind: 'chariot', count: 2}, {t: 760, kind: 'chariot', count: 2}, {t: 870, kind: 'chariot', count: 2}, {t: 940, kind: 'chariot', count: 2},
    {t: 1080, kind: 'chariot', count: 2}, {t: 1140, kind: 'chariot', count: 2},
    {t: 1260, kind: 'giant', count: 1}, {t: 1320, kind: 'giant', count: 1}, {t: 1470, kind: 'giant', count: 2}, {t: 1540, kind: 'giant', count: 1}, {t: 1680, kind: 'giant', count: 2}, {t: 1740, kind: 'giant', count: 1},
  ],
  shamans: {from: 180, every: 45, until: 600},
  // Scout chariots before the named foe: one every `every` s. A scout is a chariot (`foe.scout`) of less health whose
  // warned charge hurts little; it is no elite and leaves no chest. It gives the quiet minutes something to answer.
  scouts: {from: 125, until: 295, every: 18, faster: {from: 175, every: 9}, most: 2, hp: .6, dmg: .33, xp: .25},   // never more than `most` alive
  // an encirclement: a full ring of one kind closes in from every side at once
  rings: [{t: 170, kind: 'spear', count: 30}, {t: 300, kind: 'axe', count: 24}, {t: 390, kind: 'spear', count: 44}, {t: 510, kind: 'axe', count: 56}, {t: 560, kind: 'shield', count: 30}],
  early: {until: 240, dmg: .35},  /* until was 100; 240 since the ×1.2 of TIERS (2026-11-26), so a careless first run still lasts 3:30 */   // the mass strikes at this share of its damage at 0:00, rising to all of it by `until`
  // the rage ("the longer, the harder"): from `after` s after 纣王 arrives (`until` s after the boss that ends a
  // one-stretch run), every Shang blow is `dmg` harder with each minute, and a minute later by as much again for every
  // minute beyond it; from that minute every foe also moves `speed` faster with each minute: no run outlasts it.
  // `at`: and from this clock time whatever has happened, so that a run whose last boss is never killed ends too.
  late: {after: 240, until: 60, at: 2400, dmg: 1.5, speed: 1.2},
  dmg: .065,           // the damage of Shang blows and shots grows by this share every minute (their health is `hp` in the rows above); .08 until 2026-11-26, when TIERS' ×1.2 came in (B, SPEC-CAMPAIGN 2.8b)
  cap: 450,            // never more of the mass than this alive (each wave's `alive` keeps stretch one at 300; a recent computer is the baseline, 2026-11-25)
};
// The whole run as data (contract: SPEC-CAMPAIGN.md 1.1). Small slots: `t` and what his health is multiplied by;
// the boss of a slot is drawn by the seed from the stretch's `pool` ('mojia': one of the four brothers by the seed).
export const CAMPAIGN = {
  stretches: [
    {index: 0, id: 'xiqi', name: T('The Siege of Xiqi', '西岐之围'), from: 0, small: [{t: 210, hp: 1.1}, {t: 420, hp: 3}], pool: ['zhangguifang', 'mojia'], big: {t: 600, kind: 'wenzhong'}},
    {index: 1, id: 'passes', name: T('The Eastern Passes', '东征诸关'), from: 600, small: [{t: 810, hp: 14}, {t: 1020, hp: 17}], pool: ['yuhua', 'chenqi', 'lvyue', 'huoling'], big: {t: 1200, kind: 'kongxuan'}},
    {index: 2, id: 'zhaoge', name: T('At the Gates of Zhaoge', '兵临朝歌'), from: 1200, small: [{t: 1410, hp: 18.5}, {t: 1620, hp: 19}], pool: ['bianji', 'zhangkui'], big: {t: 1800, kind: 'yuanhong'}},
  ],
  final: {index: 3, id: 'walls', name: T('Beneath the Walls of Zhaoge', '朝歌城下'), after: 'yuanhong', kind: 'zhouwang',
    // when he comes every Shang foe of the mass changes dress in place; from then only these enter
    guards: {shield: 'goldMelon', axe: 'axeGuard', cavalry: 'axeGuard', bianGuard: 'goldMelon', buffalo: 'goldMelon', chariot: 'zhendian', giant: 'zhendian', bladeCart: 'zhendian', other: 'yulin'},
    mix: {yulin: 5, goldMelon: 2, axeGuard: 2, drumGuard: .5}, elites: {kind: 'zhendian', every: 50},
    // the finale (SPEC-CAMPAIGN 1.16): at 袁洪's coming the field is the last common host (mustered to full strength once if
    // thin); from then nothing common enters.
    // 纣王's sortie at the rest's end after 袁洪: the last guard, a fixed roster, out of the gate over `issue` s; the `reserve`
    // steps out at his last phase or when the first rank is gone. Their health is the mass's at `hpAt` s. Nothing respawns.
    host: {first: {yulin: 100, goldMelon: 42, axeGuard: 34, drumGuard: 10, zhendian: 14}, reserve: {yulin: 40, goldMelon: 18, axeGuard: 14, zhendian: 8}, issue: 14, hpAt: 2400}},
  mojia: ['moliqing', 'molihong', 'molihai', 'molishou'],
  march: 4,          // seconds of march after a big boss falls: nothing enters; the Shang on the field rout (not before 纣王)
  rest: 25,          // and then this many seconds of rest after 闻仲 and 孔宣: no new mass while his spoil and the new field land (2026-11-26, B)
  enrage: 120,       // a big boss not killed this long after he arrives enrages:
  rage: {dmg: 1.5, speed: 1.3, cd: .7},
  // bosses are fights (SPEC-CAMPAIGN.md 1.14): no harm for `ward` s after he arrives; then his health falls at most
  // `cap[tier]` of its maximum a second, from a bucket that holds `hold` seconds' worth (a burst is felt, not final)
  // a ring round a boss gives a hero close by longer to ride out (SPEC 1.15): `add` s more at `full` px or nearer, none from `none` px
  ringClose: {add: .45, full: 160, none: 280, gap: .5},      // `gap`: half-angle (rad) of the open way on the banded rings' far side
  // a boss comes to the hero: further than `far` px from him he strides at `stride` times his pace (SPEC 1.14)
  come: {far: 220, stride: 2},
  // a named foe's body (small, great and final bosses, officers; 1.17): on a charge it strikes in full; any other touch is a
  // brush that costs `brush` of his blow, and then his body does no harm for `grace` s (the mass is not changed)
  touch: {brush: .25, grace: 1.5},
  // the duels of the stage-final bosses (SPEC-CAMPAIGN 1.17; duel-events.md): the arena's radius, the held beats (`enter` as he
  // lands, `beat` at a phase line, `fall` when he falls), the longest he may stand idle (`gap`), each phase's least time
  // (`minT`: each phase's health is taken no faster than over it: never ahead of that pace, though a build behind it may catch up), how long the fled
  // mass takes to vanish (`clear`)
  duel: {r: 600, enter: 2.5, beat: 2.5, fall: 3, gap: .9, minT: [25, 35, 40], layer: .6, clear: 3, keep: [180, 260], apart: 110, size: 1.32},      // `size`: his radius in the duel (31 → 41: 0.19 of the 214 px he is drawn)      // `keep`: the range he holds between patterns; `apart`: outside a charge he is never nearer the hero than this (centre to centre: he is drawn 214 px tall)
  // a great boss's poise (1.17): control fills it (`need` seconds of would-be stun; a slow fills at its strength a second, a
  // push at `push` per px/s); full, he is staggered `stagger` s, then shrugs control off for `immune` s, and needs `grow` times more
  poise: {need: 3, stagger: 1, immune: 10, grow: 1.6, slow: 1, push: 1 / 400, shrugEvery: 1},
  // a boss alive past his band tires (SPEC 1.14): each second past `after` he takes `rate` more from every blow, and his
  // burst cap grows alike; a fight a strong build ends in its band never meets it, a weak or distant one ends soon after
  // and he closes: weary, he strides at `close` times his stride whenever further than `near` px
  weary: {after: {small: 32, big: 70, final: 75}, rate: .15, close: 1.3, near: 120},
  guard: {ward: 1.5, cap: {small: 1 / 25, big: 1 / 60, final: 1 / 70, lieutenant: 1 / 10}, hold: 2},
  phaseCd: .85,      // every phase after the first: his patterns come this much sooner
  retinue: {hp: 2},  // a plain soldier of a boss's retinue: this many times the health of his kind
  guardAura: .5,     // 纣王 takes this share of harm while any of his three officers lives
  rout: 1.3,         // routing foes run at this many times their speed
  // shocks (contract 1.10): a big boss's arrival, and a great blow (a pattern with `great: true`) when it lands
  shock: {arrive: {radius: 340, strength: 150}, blow: {reach: 1.6, strength: 110}},
};
// Landmarks (plan section 7; contract 1.7): places on the field the hero rides to for a reward, a fresh set each
// scene, placed by the seed. The scene session draws them where `g.landmarks` says. `gives`: what riding onto one does.
export const LANDMARKS = {
  kinds: {
    altar: {name: T('Altar', '祭坛'), count: 1, gives: 'reroll', text: T('One more reroll for this run.', '本局多一次重选。')},
    granary: {name: T('Granary', '粮仓'), count: 2, gives: 'mend', mend: .4, text: T('Mends two fifths of your health.', '回复四成生命。')},
    fengshen: {name: T('Investiture Terrace', '封神台'), count: 1, gives: 'merit', merit: 50, text: T('Merit for the end of the run.', '结算时多得功德。')},
    camp: {name: T('Ruined camp', '残营'), count: 2, gives: 'chest', text: T('A chest lies in the ruins.', '残营里有一个宝箱。')},
  },
  touch: 70,           // ridden this near, it gives once
  near: 700, far: 2300, apart: 500,   // from the hero when the scene begins, and from each other
};
// Difficulty tiers (contract 1.6): what the Shang's health and harm are multiplied by. B's merit reads `merit`.
export const TIERS = [{hp: 1, dmg: 1.2, merit: 1}, {hp: 1.35, dmg: 1.44, merit: 1.5}, {hp: 1.8, dmg: 1.68, merit: 2.2}];   // dmg ×1.2 in every tier, 2026-11-26 (B, SPEC-CAMPAIGN 2.8b): the whole run to plan; was 1, 1.2, 1.4

export const SPAWN = {near: 760, far: 860, clump: 6, spread: 90, every: .5,
  // the Shang are already on the field when the run begins, in four loose rings: something happens at once and keeps happening
  opening: [{kind: 'spear', count: 4, near: 210, far: 300}, {kind: 'spear', count: 4, near: 400, far: 500}, {kind: 'spear', count: 5, near: 580, far: 700}, {kind: 'spear', count: 6, near: 780, far: 900}]};
export const PICKUPS = {
  mid: 3, large: 10,   // battle spirit worth this much or more is the middle size, the large size
  peach: .012, lodestone: .003,   // the chance a fallen foe of the mass leaves one
  peachMend: 25, cap: 400, life: 0,
};
// Battle spirit needed to go from `level` to the next.
export const XP = {base: 4, step: 5.5, power: 1.5, late: 30, lateStep: .02};
// past level `late` (about the end of stretch one) each level asks a little more again, so that a whole run is about 65 picks
export const xpNeed = level => Math.round((XP.base + XP.step * Math.pow(level - 1, XP.power)) * (level > XP.late ? 1 + XP.lateStep * (level - XP.late) : 1));
