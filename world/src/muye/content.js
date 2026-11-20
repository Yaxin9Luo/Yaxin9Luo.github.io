// Muye as a survivors-like: everything a build is made of, and everything it meets, as rows of data.
// Contract: lab/game-studies/SPEC-SURVIVORS.md sections 1 to 4 and its "Changes". No rules live here: the
// engine (sim.js) understands a small set of attack shapes and reads their numbers from these rows, so a new
// treasure, troop kind, formation or foe is a new row (and its picture).
//
// Shapes an automatic attack can have (the `shape` of a treasure's row or of a troop's `attack`):
//   line   a thrust from the owner through every foe on it        length, width, count, fork, forkAngle, forkLength, burnDps, burnLife
//   arc    a sweep round the owner                                 angle (degrees), radius, push, span
//   orbit  things that circle the owner and strike what they touch rings [{count, radius, speed}], r, again
//   throw  a shot that flies, pierces, bounces and may come back   count, speed, r, range, life, pierce, bounces, hop, returns, target
//   drop   something that comes down on a place                    pick ('cluster' | 'strongest'), count, radius, delay, stun, range,
//                                                                  zone, zoneDps, zoneLife, zoneSlow, chase, eliteMult, chainElites
//   ward   a guard round the owner that takes a hit and answers    radius, push, mend, shieldAllies, pulse
//   beam   a ray that turns round the owner                        length, width, sweep (radians a second), life, slow, slowTime
//   bind   holds a line of foes in place                           length, width, hold
// Every shape also reads `cd` (seconds between casts), `dmg`, and where it applies `stun` and `push`.
// A row's `levels` are written as what changes at that level; `at[n]` (made below) is the full set of numbers at
// level n, and for a treasure `at[MAX + 1]` is the evolved form.

export const WORLD = {w: 6000, h: 6000, edge: 40};
export const STEP = 1 / 60;

export const HERO = {
  r: 18, hp: 100, speed: 215,
  safe: .5,            // after a hit, this long without further harm
  hurtTime: .25,       // how long `state` reads 'hurt' (display only)
  fallTime: 1.5,       // from the blow that takes the last health to the end of the run
  gather: 125,         // battle spirit this near flies to the hero
  touch: 26,           // and is taken this near
  dash: 180, dashTime: .2, dashCd: 3,
  turn: 3.5,           // radians a second the horse's heading follows the reins
  sharp: 1.05,         // a change of more than this (60 degrees) between reins and heading is a sharp turn
};
export const CRY = {
  after: 1.2,          // seconds of riding without a sharp turn or a stop
  speed: 1.3,
  reserve: .6,         // the ride clock runs this far past `after`
  cost: .15,           // every foe trampled and still standing takes this much off the ride clock: a thick mass ends
                       // the cry; a foe the horse kills outright costs nothing
  dmg: 20, perLevel: 5, // trample damage: it grows with the hero's level
  again: .8,           // a foe is not trampled again within this long
  stun: .5, aside: 70, // a trampled foe is thrown this far to the side and loses this long
};
export const ALLY = {
  hurt: .5,            // a soldier takes this share of a blow of the mass (he is armoured and stands in rank)
  shot: .3,            // and a shield-bearer this share of an arrow he stops
  speed: 1.15,         // soldiers keep up: this many times the hero's speed in full cry
};
export const SLOTS = {treasure: 6, art: 6, troop: 8, formation: 1, general: 5};
export const MAX = {treasure: 6, art: 5, troop: 8, formation: 3, general: 5};
export const OFFER = {rerolls: 2, banishes: 2, weight: {treasure: 1, art: 1, troop: .75, formation: .4, general: .3}, mend: 30,
  generalFrom: 4,      // no general is offered before the hero is this level
  chestNear: 2,        // a chest that finds no payoff ready gives its level to what is within this many levels of its top, if anything is
  lead: .3,            // what is owned and further along than this share of its levels is always on the offer (the furthest of them)
  depth: .5};          // a slip that continues something owned weighs this much more with each level it already has

// The five elements. `feeds` is the generating cycle: wood feeds fire, fire earth, earth metal, metal water, water wood.
export const ELEMENTS = {
  wood: {feeds: 'fire', zh: '木', en: 'wood', pigment: 'malachite'},
  fire: {feeds: 'earth', zh: '火', en: 'fire', pigment: 'cinnabar'},
  earth: {feeds: 'metal', zh: '土', en: 'earth', pigment: 'ink and ochre'},
  metal: {feeds: 'water', zh: '金', en: 'metal', pigment: 'bronze gold'},
  water: {feeds: 'wood', zh: '水', en: 'water', pigment: 'azurite'},
};
/** The element whose arts let a treasure of `element` evolve. */
export const fedBy = element => Object.keys(ELEMENTS).find(e => ELEMENTS[e].feeds === element);

// Resonance: `need` things of one element (treasures, arts and troops) give that element's standing bonus.
// The keys other than `text` are added to the same sums the arts add to.
export const RESONANCE = {
  need: 3,
  fire: {dmg: .01, text: {en: 'Fire resonance: everything you own hits 1% harder.', zh: '火之共鸣：你的一切攻击伤害提高 1%。'}},
  water: {regen: .5, text: {en: 'Water resonance: you mend half a point of health every second.', zh: '水之共鸣：每秒回复半点生命。'}},
  wood: {speed: .06, rate: .06, text: {en: 'Wood resonance: you ride and your treasures strike 6% faster.', zh: '木之共鸣：骑行与法宝出手都快 6%。'}},
  metal: {area: .1, text: {en: 'Metal resonance: every attack reaches a tenth wider.', zh: '金之共鸣：所有攻击的范围扩大一成。'}},
  earth: {armour: 1, hp: 15, text: {en: 'Earth resonance: 15 more health, and every hit hurts 1 less.', zh: '土之共鸣：生命上限加 15，每次受击少掉 1 点。'}},
};

const T = (en, zh) => ({en, zh});
// What a chest gave, for the banner over it (`chest` event, `gave`).
export const CHEST = {
  evolve: T('The chest evolves a treasure', '宝箱：法宝进化'), blessed: T('The chest blesses a squad', '宝箱：神兵天降'),
  trueForm: T('The chest shows a general\'s true form', '宝箱：将星显圣'), generals: T('The fallen foe\'s chest: choose a general', '破敌宝箱：点将'),
  treasure: T('The chest raises a treasure', '宝箱：法宝升级'), art: T('The chest deepens an art', '宝箱：心法精进'), troop: T('The chest strengthens a squad', '宝箱：兵阵增强'),
  formation: T('The chest drills the formation', '宝箱：阵法精进'), general: T('The chest raises a general', '宝箱：武将升级'), mend: T('The chest mends you', '宝箱：回复生命'),
};

// --------------------------------------------------------------------------------------------- treasures
const treasures = [
  {
    id: 'fireSpear', element: 'fire', name: T('Fire-tipped Spear', '火尖枪'), shape: 'line',
    base: {cd: .95, dmg: 13, length: 230, width: 34, count: 1},
    levels: [
      {text: T('A spear of fire thrusts through every foe in a line, toward the nearest one.', '火枪朝最近的敌人直刺，贯穿一线上的所有敌人。')},
      {dmg: 18, width: 40, text: T('A broader blade that hits for 18 instead of 13.', '枪刃更宽，伤害由 13 升到 18。')},
      {count: 2, text: T('A second thrust goes at another foe at the same moment.', '同时再向另一个敌人刺出第二枪。')},
      {dmg: 24, length: 290, width: 46, text: T('The spear is longer and wider, and hits for 24.', '枪身更长更宽，伤害升到 24。')},
      {dmg: 30, cd: .85, length: 330, text: T('Longer still; hits for 30, a little more often.', '枪身再长一截；伤害升到 30，出枪也更勤。')},
      {count: 3, text: T('A third thrust: three lines of fire at once.', '第三枪：三道火线同时刺出。')},
    ],
    evolved: {id: 'sanmeiSpear', name: T('Samadhi Spear', '三昧神枪'), dmg: 33, fork: 2, forkAngle: .45, forkLength: .65, burnDps: 15, burnLife: 2.5,
      text: T('Every thrust forks in two at its tip, and the ground burns along each line for a while.', '每一枪在枪尖分成两岔，枪路所过之地燃烧一阵。')},
  },
  {
    id: 'fireCover', element: 'fire', name: T('Nine-dragon Fire Cover', '九龙神火罩'), shape: 'drop',
    base: {cd: 3, dmg: 8, pick: 'cluster', count: 1, radius: 78, delay: .5, range: 520, zone: 'burn', zoneDps: 8, zoneLife: 3.4},
    levels: [
      {text: T('Every few seconds a dome of fire drops on the densest group and burns whoever stays inside.', '每隔几秒，火罩落在最密的敌群上，烧灼罩内的敌人。')},
      {zoneDps: 13, radius: 88, text: T('A wider dome whose fire burns hotter: 13 a second instead of 8.', '火罩更大，火势更猛：每秒伤害由 8 升到 13。')},
      {radius: 104, text: T('A much wider dome.', '火罩大了一圈。')},
      {cd: 2.6, zoneDps: 19, radius: 112, text: T('Wider again; drops more often and burns for 19 a second.', '火罩再大；落得更勤，每秒伤害升到 19。')},
      {zoneLife: 4.4, radius: 120, text: T('The dome is larger and burns longer before it lifts.', '火罩更大，燃烧得更久才消散。')},
      {count: 2, zoneDps: 24, text: T('A second dome falls on the next densest group; both burn for 24 a second.', '第二个火罩落向次密的敌群；每秒伤害都升到 24。')},
    ],
    evolved: {id: 'nineDragons', name: T('Nine Dragons Burn the Sky', '九龙焚天'), cd: 4, count: 9, radius: 60, zoneDps: 48, zoneLife: 5, chase: 70,
      text: T('Nine smaller domes fall at once and crawl after the nearest foes.', '九个小火罩同时落下，并追着最近的敌人移动。')},
  },
  {
    id: 'sash', element: 'water', name: T('Armillary Sash', '混天绫'), shape: 'arc',
    base: {cd: 1.7, dmg: 15, angle: 120, radius: 165, push: 70},
    levels: [
      {text: T('A long sash whips an arc toward the nearest foes and pushes them back.', '长绫朝最近的敌人甩出一道弧，并把他们推开。')},
      {dmg: 20, radius: 172, text: T('A longer sash that hits for 20 instead of 15.', '长绫更长，伤害由 15 升到 20。')},
      {angle: 160, radius: 180, text: T('A wider and longer arc.', '弧更宽，绫更长。')},
      {dmg: 27, push: 90, angle: 175, text: T('Nearly a half circle; hits for 27 and pushes further.', '将近半圈；伤害升到 27，推得更远。')},
      {cd: 1.4, radius: 190, text: T('Longer, and whips more often.', '更长，甩得更勤。')},
      {dmg: 36, angle: 200, radius: 200, text: T('More than a half circle, longer, and 36 damage.', '超过半圈，更长，伤害升到 36。')},
    ],
    evolved: {id: 'riverTurner', name: T('River-turning Wave', '翻江'), dmg: 34, angle: 360, radius: 230, push: 150, span: .35,
      text: T('The arc becomes a full circle of wave that throws everything round you far back.', '弧变成一整圈浪，把四周的敌人远远掀开。')},
  },
  {
    id: 'pearls', element: 'water', name: T('Sea-calming Pearls', '定海珠'), shape: 'orbit',
    base: {dmg: 14, r: 14, again: .3, rings: [{count: 3, radius: 110, speed: 2.6}]},
    levels: [
      {text: T('Three pearls circle you and strike whatever they touch.', '三颗宝珠绕身旋转，碰到的敌人都会被击中。')},
      {dmg: 20, r: 17, text: T('Larger pearls that hit for 20 instead of 14.', '宝珠更大，伤害由 14 升到 20。')},
      {rings: [{count: 4, radius: 110, speed: 2.6}], text: T('A fourth pearl.', '第四颗宝珠。')},
      {dmg: 30, rings: [{count: 4, radius: 130, speed: 2.6}], text: T('The ring is wider and each pearl hits for 30.', '珠环更大，伤害升到 30。')},
      {rings: [{count: 5, radius: 130, speed: 2.6}], text: T('A fifth pearl.', '第五颗宝珠。')},
      {dmg: 42, rings: [{count: 6, radius: 130, speed: 2.6}], text: T('A sixth pearl, and 42 damage each.', '第六颗宝珠，伤害升到 42。')},
    ],
    evolved: {id: 'twentyFourHeavens', name: T('Twenty-four Heavens', '二十四诸天'), dmg: 52,
      rings: [{count: 8, radius: 110, speed: 2.8}, {count: 16, radius: 195, speed: -1.9}],
      text: T('Twenty-four pearls in two rings, eight inside and sixteen outside, turning opposite ways.', '二十四颗宝珠分成内外两环，内八外十六，反向旋转。')},
  },
  {
    id: 'whip', element: 'wood', name: T('God-beating Whip', '打神鞭'), shape: 'drop',
    base: {cd: 2.6, dmg: 35, pick: 'strongest', count: 1, radius: 44, delay: 0, range: 380, stun: .3, eliteMult: 1.3},
    levels: [
      {text: T('A heavy blow falls on the strongest foe near you. Elites take a third more.', '重鞭打向附近最强的敌人。精英多受三成伤害。')},
      {dmg: 48, radius: 50, text: T('A heavier blow, 48 instead of 35, that catches those standing close by.', '鞭击更重，伤害由 35 升到 48，并波及紧挨着的敌人。')},
      {cd: 2.2, radius: 60, text: T('The blow cracks the ground much wider, and falls more often.', '鞭落之处震开一大片，出鞭也更勤。')},
      {dmg: 61, eliteMult: 1.4, radius: 66, text: T('Wider again; hits for 61, and elites take two fifths more.', '范围再大；伤害升到 61，精英多受四成伤害。')},
      {cd: 1.9, radius: 72, text: T('A still wider crack, more often.', '震开的范围更大，出鞭更勤。')},
      {count: 2, dmg: 70, text: T('A second blow on the next strongest foe; both hit for 70.', '第二鞭打向次强的敌人；两鞭伤害都升到 70。')},
    ],
    evolved: {id: 'investiture', name: T('Investiture', '封神'), dmg: 104, count: 4, range: 700, chainElites: true,
      text: T('The blow chains to every elite on screen and to the four strongest foes in sight.', '鞭击连向屏幕上的每一个精英，以及视野内最强的四个敌人。')},
  },
  {
    id: 'ring', element: 'metal', name: T('Universe Ring', '乾坤圈'), shape: 'throw',
    base: {cd: 1.3, dmg: 16, count: 1, speed: 520, r: 14, range: 420, life: 3, pierce: 0, bounces: 3, hop: 240, target: 'nearest'},
    levels: [
      {text: T('A ring is thrown at the nearest foe and bounces on to three more.', '金圈掷向最近的敌人，再弹向另外三个。')},
      {dmg: 22, r: 17, text: T('A larger ring that hits for 22 instead of 16.', '金圈更大，伤害由 16 升到 22。')},
      {bounces: 5, text: T('Two more bounces.', '多弹两次。')},
      {count: 2, text: T('Two rings are thrown at once.', '同时掷出两个金圈。')},
      {dmg: 28, cd: 1.1, r: 20, text: T('Larger rings that hit for 28 and are thrown more often.', '金圈更大，伤害升到 28，掷得更勤。')},
      {count: 3, dmg: 32, text: T('A third ring, and 32 damage each.', '第三个金圈，伤害升到 32。')},
    ],
    evolved: {id: 'boundlessRing', name: T('Boundless Universe', '乾坤无极'), dmg: 33, count: 4, bounces: 8, returns: true,
      text: T('Four rings at once; when a ring has done bouncing it flies back to your hand through everything on the way.', '四圈齐出；弹完之后飞回手中，沿途的敌人都会被击中。')},
  },
  {
    id: 'seal', element: 'earth', name: T('Heaven-turning Seal', '番天印'), shape: 'drop',
    base: {cd: 2.6, dmg: 14, pick: 'cluster', count: 1, radius: 95, delay: .6, range: 520, stun: .6, push: 40},
    levels: [
      {text: T('A seal slams down on the densest group, flings those under it outward and stuns them for a moment.', '大印砸向最密的敌群，把印下的敌人向外震飞，并震晕片刻。')},
      {dmg: 22, radius: 105, push: 46, text: T('A larger seal that hits for 22 instead of 14.', '印面更大，伤害由 14 升到 22。')},
      {radius: 122, push: 52, text: T('A much larger seal that flings foes further.', '印面大了一圈，震飞得更远。')},
      {dmg: 38, stun: .8, radius: 130, push: 58, text: T('Larger again; hits for 38 and stuns a little longer.', '印面再大；伤害升到 38，震晕更久。')},
      {cd: 2.1, radius: 138, push: 64, text: T('Larger, and falls more often.', '更大，落得更勤。')},
      {dmg: 54, radius: 150, push: 70, text: T('Hits for 54 over a still larger place.', '伤害升到 54，范围更大。')},
    ],
    evolved: {id: 'overturn', name: T('Heaven and Earth Overturned', '番天覆地'), dmg: 68, push: 100, zone: 'crush', zoneDps: 38, zoneLife: 4, zoneSlow: .6,
      text: T('Where the seal falls it leaves a field that crushes: foes inside are slowed and keep taking damage.', '大印落处留下一片碾压之地：其中的敌人被拖慢并持续受伤。')},
  },
  {
    id: 'banner', element: 'earth', name: T('Apricot-yellow Banner', '杏黄旗'), shape: 'ward', opening: false,
    base: {cd: 9, dmg: 25, radius: 125, push: 110, mend: 0},
    levels: [
      {text: T('A ward round you takes one hit for you, throws back everyone near, and returns after 9 seconds.', '护身光罩替你挡下一次攻击，并把四周的敌人震开；9 秒后复原。')},
      {cd: 8, radius: 132, text: T('A wider ward that returns sooner: 8 seconds.', '光罩更大，复原更快：8 秒。')},
      {dmg: 40, radius: 146, text: T('The push reaches further and hits for 40.', '震开的范围更大，伤害升到 40。')},
      {cd: 6.5, radius: 152, text: T('Wider again; the ward returns after 6.5 seconds.', '光罩再大；6.5 秒复原。')},
      {mend: 4, radius: 156, text: T('Wider; a hit the ward takes also mends 4 health.', '光罩更大；每挡下一击，回复 4 点生命。')},
      {cd: 5, dmg: 60, radius: 170, text: T('Returns after 5 seconds; the push is wider and hits for 60.', '5 秒复原；震开范围更大，伤害升到 60。')},
    ],
    evolved: {id: 'centralBanner', name: T('Wu-ji Apricot Banner', '戊己杏黄旗'), dmg: 130, radius: 210, shieldAllies: .5, pulse: true,
      text: T('The ward also covers your squads: soldiers inside it take half damage, and it throws foes back every time it returns.', '光罩同时庇护兵阵：罩内士兵所受伤害减半，并且每次复原时都会把敌人震开。')},
  },
];

// --------------------------------------------------------------------------------------------- arts
// `gives` is added once per level to the sums the engine reads: dmg, rate, area, dur, speed, spirit (shares),
// regen (health a second), mend (share added to what a peach mends), hp, armour, gather (px), ride (seconds the
// ride clock runs further past the full cry: about eight foes a second of it), trample (share).
const pct = v => Math.round(v * 100);
const art = (id, element, name, gives, say) => ({
  id, element, name, gives,
  levels: Array.from({length: MAX.art}, (_, i) => ({text: say(i + 1)})),
});
const arts = [
  art('sanmei', 'fire', T('Samadhi Fire', '三昧真火'), {dmg: .08},
    n => T(`Treasures, squads and the horse all hit ${pct(.08 * n)}% harder.`, `法宝、兵阵与战马的伤害都提高 ${pct(.08 * n)}%。`)),
  art('changming', 'fire', T('Ever-burning Lamp', '长明'), {dur: .15},
    n => T(`Fires, fields, stuns and slows you cause last ${pct(.15 * n)}% longer.`, `你造成的燃烧、力场、震晕与减速多持续 ${pct(.15 * n)}%。`)),
  art('ganlu', 'water', T('Sweet Dew', '甘露'), {regen: .4, mend: .2},
    n => T(`You mend ${(.4 * n).toFixed(1)} health every second, and a peach mends ${pct(.2 * n)}% more.`, `每秒回复 ${(.4 * n).toFixed(1)} 点生命，仙桃的回复量提高 ${pct(.2 * n)}%。`)),
  art('lingtai', 'water', T('Spirit Terrace', '灵台'), {spirit: .12},
    n => T(`Battle spirit you gather counts for ${pct(.12 * n)}% more, so levels come sooner.`, `拾取的战意多算 ${pct(.12 * n)}%，升级更快。`)),
  art('fenglei', 'wood', T('Wind and Thunder', '风雷'), {speed: .05, rate: .07, ride: .18, trample: .3},
    n => T(`You ride ${pct(.05 * n)}% faster, every treasure strikes ${pct(.07 * n)}% more often, and in full cry the horse tramples ${pct(.3 * n)}% harder and rides down ${n === 1 ? 'one more foe' : 'more foes'} before its stride breaks.`, `骑行速度提高 ${pct(.05 * n)}%，所有法宝出手频率提高 ${pct(.07 * n)}%；全速冲锋时，践踏的伤害提高 ${pct(.3 * n)}%，战马能多踏翻几个敌人才会被拖住。`)),
  art('jinguang', 'metal', T('Golden Light', '金光'), {area: .1},
    n => T(`Every attack is ${pct(.1 * n)}% larger: longer lines, wider arcs and circles.`, `所有攻击的范围扩大 ${pct(.1 * n)}%：线更长，弧与圈更大。`)),
  art('jubao', 'metal', T('Treasure Bowl', '聚宝'), {gather: 35},
    n => T(`Battle spirit flies to you from ${35 * n} px further away.`, `战意从更远 ${35 * n} 像素之外飞向你。`)),
  art('houtu', 'earth', T('Deep Earth', '厚土'), {hp: 20, armour: 1, trample: 1},
    n => T(`${20 * n} more health, every hit hurts ${n} less, and the horse tramples ${pct(1 * n)}% harder.`, `生命上限加 ${20 * n}，每次受击少掉 ${n} 点，战马践踏的伤害提高 ${pct(1 * n)}%。`)),
];

// --------------------------------------------------------------------------------------------- troops
// A squad follows the hero. `stand` is where its men stand when no formation is taken: 'between' (toward the
// nearest mass), 'ring' (round the hero), 'behind' (away from the mass), 'far' (well behind), 'escort' (close by),
// 'line' (a loose line toward the mass), 'orbit' (they circle the hero wide and keep doing so in a formation),
// 'wade' (they go to the foe, in a formation too). `attack.per` is 'man' (each man by his own clock, at a foe in
// his `range`) or 'squad' (all together at the densest group in `range` of the hero). `leash` is how far a man
// leaves his place to reach a foe (for those who wade, how far from the hero).
//
// Levels 1 to 8 and five ranks (section 6.2). A rank is a change of the men: rank 2 at level 3 (the squad skill
// unlocks), rank 3 at level 5 (more men, a larger skill), rank 4 at level 7 (the skill takes a second effect, that
// of the squad's element), rank 5 by a chest at level 8 with the kind's patron general owned (the blessed skill).
// Levels 2, 4, 6 and 8 add men or rate. `skill` is the squad skill at rank 2; `skill.at3` what grows at rank 3;
// `blessed` the skill of rank 5. A skill is an attack of a shape, as a treasure's is.
export const RANKS = [
  {rank: 1, level: 1, id: 'levy', name: T('Levy', '卒')},
  {rank: 2, level: 3, id: 'picked', name: T('Picked men', '锐士')},
  {rank: 3, level: 5, id: 'armoured', name: T('Armoured men', '甲士')},
  {rank: 4, level: 7, id: 'darkGuard', name: T('Dark-armour guard', '玄甲')},
  {rank: 5, level: 8, id: 'blessed', name: T('Blessed host', '神兵')},
];
/** The rank of a squad at a level; `blessed` is the fifth, given by a chest. */
export const rankOf = (level, blessed = false) => blessed ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
// what the squad's element adds to its skill from rank 4, in the words of a slip
const SECOND = {
  fire: T('sets those it strikes burning', '让击中的敌人燃烧'), water: T('chills those it strikes so that they move slowly', '让击中的敌人迟滞'),
  wood: T('holds those it strikes fast for a moment', '把击中的敌人缠住片刻'), metal: T('cuts a quarter deeper', '多造成四分之一伤害'),
  earth: T('shoves those it strikes further back', '把击中的敌人推得更远'),
};
const RANK_HP = [1, 1, 1.5, 2.2, 3], RANK_DMG = [1, 1, 1.5, 2.1, 2.8];
/**
 * A troop row. `men` is the number of men at each of the eight levels; a level that adds no man and no rank makes
 * the squad strike more often.
 */
function troop(o) {
  const levels = [];
  let cd = o.base.cd;
  for (let l = 1; l <= 8; l++) {
    const rank = rankOf(l), up = l > 1 && rank > rankOf(l - 1), more = l > 1 && o.men[l - 1] > o.men[l - 2];
    const nums = {men: o.men[l - 1], rank, hp: Math.round(o.base.hp * RANK_HP[rank]), dmg: Math.round(o.base.dmg * RANK_DMG[rank])};
    if (l > 1 && !up && !more) cd = Math.round(cd * .86 * 100) / 100;
    nums.cd = cd;
    const R = RANKS[rank - 1], n = nums.men, one = n === 1;
    let text;
    if (l === 1) text = o.text;
    else if (up && rank === 2) text = T(`Picked men (锐士): ${nums.hp} health each and a blow of ${nums.dmg}. They learn ${o.skill.name.en}: ${o.skill.text.en}`, `锐士：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。习得「${o.skill.name.zh}」：${o.skill.text.zh}`);
    else if (up && rank === 3) text = T(`Armoured men (甲士)${more ? `, ${n} of them` : ''}: ${nums.hp} health each and a blow of ${nums.dmg}. ${o.skill.name.en} grows: ${o.skill.at3.text.en}`, `甲士${more ? `，增至 ${n} 名` : ''}：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。「${o.skill.name.zh}」更强：${o.skill.at3.text.zh}`);
    else if (up && rank === 4) text = T(`Dark-armour guard (玄甲): ${nums.hp} health each and a blow of ${nums.dmg}. ${o.skill.name.en} also ${SECOND[o.element].en}.`, `玄甲：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。「${o.skill.name.zh}」还会${SECOND[o.element].zh}。`);
    else if (more) text = T(`${one ? 'One' : n} ${o.name.en.toLowerCase()} in the squad.`, `${o.name.zh}增至 ${n} 名。`);
    else text = T(`The ${o.name.en.toLowerCase()} strike more often: every ${cd} s instead of ${levels[l - 2].cd}.`, `${o.name.zh}出手更勤：每 ${cd} 秒一次，原为 ${levels[l - 2].cd} 秒。`);
    levels.push({...nums, text});
  }
  return {id: o.id, element: o.element, name: o.name, stand: o.stand, blocks: !!o.blocks, patron: o.patron, base: o.base, levels, skill: o.skill, blessed: o.blessed};
}
const troops = [
  troop({
    id: 'shields', element: 'earth', name: T('Shield-bearers', '干士'), stand: 'between', blocks: true, patron: 'tuxingsun', men: [4, 5, 5, 6, 7, 7, 7, 8],
    base: {hp: 120, r: 13, muster: 4, leash: 70, per: 'man', shape: 'arc', cd: 1.4, dmg: 12, angle: 110, radius: 54, push: 45, range: 50, stun: 0},
    text: T('Four shield-bearers stand between you and the nearest mass. Foes cannot walk through them and arrows stop on their shields.', '四名干士站在你与最近的敌群之间。敌人穿不过他们，箭矢被盾牌挡下。'),
    skill: {id: 'shieldWall', name: T('Shield Wall', '盾墙'), shape: 'arc', cd: 9, dmg: 22, radius: 150, angle: 150, push: 130, stun: .8,
      text: T('they lock shields and shove the whole front back, stunning it.', '连盾成墙，把整条战线推回去并震晕。'),
      at3: {radius: 195, push: 160, text: T('a longer wall that shoves further.', '盾墙更长，推得更远。')}},
    blessed: {id: 'mountainWall', name: T('Wall Like a Mountain', '不动如山'), shape: 'arc', dmg: 60, radius: 250, angle: 360, push: 220, stun: 1.5,
      text: T('The wall closes into a full ring round you and throws everything outward, stunned.', '盾墙合成一整圈，把四周的一切向外掀翻并震晕。')},
  }),
  troop({
    id: 'spears', element: 'metal', name: T('Dagger-axe men', '戈士'), stand: 'ring', patron: 'yangjian', men: [4, 5, 5, 6, 7, 7, 7, 8],
    base: {hp: 70, r: 12, muster: 4, leash: 150, per: 'man', shape: 'line', cd: 1.2, dmg: 20, length: 110, width: 24, count: 1, range: 105, push: 0},
    text: T('Four dagger-axe men stand round you and thrust outward at whatever comes in reach.', '四名戈士环立四周，向进入范围的敌人刺击。'),
    skill: {id: 'massThrust', name: T('Massed Thrust', '攒刺'), shape: 'lines', cd: 7, dmg: 34, length: 170, width: 28, fan: 1,
      text: T('all thrust outward at once, a ring of points that goes through everyone on it.', '同时向外齐刺，一圈枪尖贯穿所过之敌。'),
      at3: {length: 230, width: 34, text: T('longer and broader points.', '枪尖更长更宽。')}},
    blessed: {id: 'thousandPoints', name: T('A Thousand Points', '万刃齐发'), shape: 'lines', dmg: 70, length: 300, width: 36, fan: 3, fanAngle: .3,
      text: T('Every man thrusts three points in a fan: a full crown of blades round you.', '每人扇形刺出三道枪芒：四周绽开一整圈刀光。')},
  }),
  troop({
    id: 'archers', element: 'wood', name: T('Archers', '射士'), stand: 'behind', patron: 'leizhenzi', men: [3, 4, 4, 5, 6, 6, 6, 7],
    base: {hp: 45, r: 12, muster: 4, per: 'squad', shape: 'throw', cd: 1.6, dmg: 34, count: 1, speed: 560, shotR: 9, range: 520, life: 1.3, pierce: 2, bounces: 0, hop: 0, target: 'cluster'},
    text: T('Three archers keep behind you and loose a volley at the densest group.', '三名射士跟在你身后，向最密的敌群齐射。'),
    skill: {id: 'arrowRain', name: T('Rain of Arrows', '箭雨'), shape: 'drop', pick: 'cluster', zone: 'rain', cd: 6.5, dmg: 56, count: 1, radius: 120, delay: .9, range: 560,
      text: T('a volley rises and falls on the densest group, darkening a circle of ground first.', '箭矢升空后落向最密的敌群，落下前地上先暗出一个圆。'),
      at3: {radius: 155, text: T('the rain covers a wider circle.', '箭雨覆盖更大的圆。')}},
    blessed: {id: 'skyOfArrows', name: T('A Sky of Arrows', '遮天箭雨'), shape: 'drop', pick: 'cluster', zone: 'rain', dmg: 80, count: 3, radius: 150, delay: .9, range: 620, stun: .8,
      text: T('Three rains fall on three groups at once and pin those under them.', '三阵箭雨同时落向三处敌群，并把箭下之敌钉在原地。')},
  }),
  troop({
    id: 'strongmen', element: 'earth', name: T('Yellow-turban strongmen', '黄巾力士'), stand: 'wade', patron: 'tuxingsun', men: [1, 1, 1, 2, 2, 2, 2, 3],
    base: {hp: 300, r: 22, muster: 8, leash: 300, per: 'man', shape: 'arc', cd: 2.2, dmg: 46, angle: 360, radius: 82, push: 150, range: 60, stun: 0},
    text: T('One huge summoned strongman wades into the foe near you and throws everyone round him.', '召来一名巨大的黄巾力士，冲入附近的敌群，把四周的敌人掀飞。'),
    skill: {id: 'boulder', name: T('Hurled Boulder', '掷石'), shape: 'throw', cd: 8, dmg: 70, count: 1, speed: 440, shotR: 26, range: 520, life: 1, pierce: 99, bounces: 0, hop: 0, target: 'cluster', push: 60, shotKind: 'boulder',
      text: T('each lifts a boulder and hurls it: it bowls a line through the mass.', '每人举起巨石掷出，在敌群中滚出一条线。'),
      at3: {shotR: 36, life: 1.25, text: T('a larger boulder that rolls further.', '巨石更大，滚得更远。')}},
    blessed: {id: 'mountainThrow', name: T('Throwing the Mountain', '移山'), shape: 'throw', dmg: 120, count: 1, speed: 440, shotR: 44, range: 560, life: 1.25, pierce: 99, bounces: 0, hop: 0, target: 'cluster', push: 90, shotKind: 'boulder', burst: {radius: 150, dmg: 140, stun: 1},
      text: T('The boulder is a piece of mountain: where its roll ends it bursts and stuns all round it.', '掷出的是一角山岩：滚到尽头轰然崩开，震晕四周。')},
  }),
  troop({
    id: 'chariots', element: 'metal', name: T('War chariots', '戎车'), stand: 'orbit', patron: 'huangfeihu', men: [1, 1, 1, 2, 2, 2, 2, 3],
    base: {hp: 260, r: 24, muster: 8, per: 'man', shape: 'arc', cd: .8, dmg: 38, angle: 360, radius: 58, push: 50, range: 40, stun: 0, orbit: 230, turn: .9},
    text: T('One war chariot circles you wide and runs down whatever it meets.', '一辆戎车在你外围绕行，碾过遇到的敌人。'),
    skill: {id: 'chariotCharge', name: T('Breaking Charge', '冲阵'), shape: 'charge', cd: 6.5, dmg: 104, length: 420, width: 64, push: 90, time: .6,
      text: T('each chariot charges down a lane through the densest group, throws everything aside, then wheels back.', '每辆战车沿一条道冲过最密的敌群，把一切撞开，再掉头回来。'),
      at3: {length: 520, width: 80, text: T('a longer and wider lane.', '冲锋道更长更宽。')}},
    blessed: {id: 'ironTide', name: T('Iron Tide', '铁流'), shape: 'charge', dmg: 130, length: 620, width: 96, push: 140, time: .7, back: true,
      text: T('The chariots charge out and back again down the same lane, and nothing stands in it.', '战车沿同一条道冲出又冲回，道上再无站立之敌。')},
  }),
  troop({
    id: 'tigers', element: 'fire', name: T('Tiger guards', '虎贲'), stand: 'escort', patron: 'huangfeihu', men: [2, 3, 3, 4, 4, 4, 4, 5],
    base: {hp: 110, r: 14, muster: 5, leash: 130, per: 'man', shape: 'arc', cd: 1, dmg: 24, angle: 110, radius: 62, push: 0, range: 56, stun: 0},
    text: T('Two tiger guards ride close beside you and cut down what comes near.', '两名虎贲紧随左右，砍倒靠近的敌人。'),
    skill: {id: 'tigerLeap', name: T('Tiger Leap', '虎跃'), shape: 'leap', cd: 7, dmg: 52, radius: 90, range: 420, time: .45, stun: .5, count: 1,
      text: T('they leap together onto an elite, or the nearest thick group, and land heavily.', '一同跃向精英或最近的密集敌群，重重落下。'),
      at3: {radius: 120, text: T('a heavier landing over a wider place.', '落地更重，范围更大。')}},
    blessed: {id: 'tigerStorm', name: T('Storm of Tigers', '群虎扑阵'), shape: 'leap', dmg: 120, radius: 120, range: 480, time: .45, stun: .8, count: 5, zone: 'burn', zoneDps: 30, zoneLife: 3,
      text: T('Each guard leaps onto a group of his own, and the ground burns where he lands.', '每名虎贲各扑一处敌群，落地之处燃起烈火。')},
  }),
  troop({
    id: 'acolytes', element: 'water', name: T('Daoist acolytes', '道童'), stand: 'far', patron: 'dengchanyu', men: [2, 3, 3, 4, 4, 4, 4, 5],
    base: {hp: 40, r: 11, muster: 5, per: 'man', shape: 'throw', cd: 1.6, dmg: 20, count: 1, speed: 480, shotR: 8, range: 440, life: 1.1, pierce: 0, bounces: 0, hop: 0, target: 'nearest', shotKind: 'talisman'},
    text: T('Two acolytes keep well behind you and throw paper talismans at the nearest foes.', '两名道童远远跟在后面，向最近的敌人掷出符纸。'),
    skill: {id: 'talisman', name: T('Talisman Rite', '符法'), shape: 'talisman', cd: 7, dmg: 42, radius: 110, range: 520, life: 4,
      text: T('they cast a spell of the element your build has most of: fire burns the ground, water freezes, wood binds, metal sends thin blades from foe to foe, earth raises a wall.', '施展你身上最多的那一行的法术：火焚地，水冻结，木缠缚，金放出在敌间弹跳的薄刃，土升起一道墙。'),
      at3: {radius: 140, life: 5, text: T('a larger spell that lasts longer.', '法术更大，持续更久。')}},
    blessed: {id: 'fiveTalismans', name: T('Five Talismans', '五行符阵'), shape: 'talisman', dmg: 55, radius: 150, range: 560, life: 5, all: true,
      text: T('All five elements at once: fire, frost, vines, blades and a wall, each on a group of its own.', '五行齐发：火、冰、藤、刃、墙，各落一处敌群。')},
  }),
  troop({
    id: 'hooks', element: 'wood', name: T('Flying-tiger soldiers', '飞虎兵'), stand: 'line', patron: 'huangfeihu', men: [3, 4, 4, 5, 6, 6, 6, 7],
    base: {hp: 60, r: 12, muster: 4, leash: 120, per: 'man', shape: 'line', cd: 1.1, dmg: 14, length: 100, width: 22, count: 1, range: 95, push: -24},
    text: T('Three soldiers with hooks and chains keep a loose line toward the foe and drag those in reach closer.', '三名手持挠钩铁索的飞虎兵散成一线，把够得着的敌人钩近。'),
    skill: {id: 'hookDrag', name: T('Hooks and Chains', '挠钩'), shape: 'pull', cd: 8, dmg: 14, radius: 150, range: 380, hold: 1.4,
      text: T('hooks fly into the densest group, drag it together into one knot and hold it there.', '挠钩飞入最密的敌群，把他们拖成一团并拽住。'),
      at3: {radius: 195, hold: 1.8, text: T('the hooks reach wider and hold longer.', '挠钩够得更广，拽得更久。')}},
    blessed: {id: 'heavenNet', name: T('Net of Heaven', '天罗地网'), shape: 'pull', dmg: 40, radius: 300, range: 420, hold: 2.6,
      text: T('A net of chains falls over everything in sight of the squad, hauls it into one heap and holds it long.', '铁索织成的大网罩住视野内的一切，收成一堆并久久拽住。')},
  }),
];

// --------------------------------------------------------------------------------------------- generals
// A general (将) is one named figure of the Zhou camp who fights beside the hero by himself. Mounts, weapons and
// treasures are the novel's, from research_notes/Fengshen content catalogue.md; where the book gives none (杨戬's
// mount) or the catalogue could not confirm one (邓婵玉's), none is named. `seek` is whom he goes for: 'cluster'
// (the densest group), 'elite' (an elite, else the strongest foe), 'hero' (he keeps by the hero), 'front' (at the
// head of the squads). `attack` is his plain blow, `skill` what he does besides, both attacks of a shape. Levels 2
// to 5 each make him `grow` harder-hitting and tougher and change what the level's words say; the true form
// (显圣) comes by a chest at level 5.
// What a payoff is worth: every blow of an evolved treasure, and of a blessed host, is this much harder.
export const PAYOFF = {evolve: 1.8, blessed: 2.8, trueForm: 1.6, from: 150};   // `from`: no payoff comes before this time (on a bare stage it does)   // and a general in his true form strikes `trueForm` times as hard as at level 5
export const GENERAL = {away: 20, speed: 330, grow: .17, hpGrow: .25, leash: 460, echo: .4, power: 1.7};
const general = o => ({...o, levels: o.levels.map((text, i) => ({text, ...(o.steps[i] || {})}))});
const generals = [
  general({
    id: 'nezha', element: 'fire', name: T('Nezha', '哪吒'), mount: T('the Wind-fire Wheels', '风火轮'), weapon: T('the Fire-tipped Spear', '火尖枪'),
    treasures: ['乾坤圈', '混天绫'], patronOf: [], echoes: ['fireSpear', 'ring', 'sash'], seek: 'cluster', fly: true, hp: 260, r: 16, speed: 400,
    attack: {shape: 'line', cd: .75, dmg: 26, length: 150, width: 30, count: 1},
    skill: {id: 'ringAndSash', name: T('Ring and Sash', '圈绫并用'), shape: 'arc', cd: 4.5, dmg: 30, radius: 150, angle: 220, push: 90, ring: {dmg: 30, bounces: 4, hop: 240, speed: 520, r: 15, life: 3}},
    steps: [{}, {}, {skillCd: 3.6}, {}, {count: 2}],
    levels: [
      T('Nezha darts between groups on the Wind-fire Wheels and thrusts with the Fire-tipped Spear; now and then he throws the Universe Ring and sweeps the Armillary Sash. While he is with you, your own Fire-tipped Spear, Universe Ring and Armillary Sash also strike from where he stands, at two fifths of their strength.', '哪吒脚踏风火轮穿梭于敌群之间，以火尖枪刺敌，不时掷出乾坤圈、甩开混天绫。有他在场，你自己的火尖枪、乾坤圈、混天绫也会从他所在之处再出手一次，威力为四成。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He throws the ring and sweeps the sash more often.', '他掷圈甩绫更勤。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He thrusts at two foes at once.', '他同时刺向两个敌人。'),
    ],
    trueForm: {id: 'threeHeadsEightArms', name: T('Three Heads, Eight Arms', '三头八臂'), count: 4, skillCd: 2.6, radiusUp: 1.3, full: true,
      text: T('After the three fire dates he shows three heads and eight arms: every arm a weapon, spear thrusts on all sides, the sash a full circle.', '吃下三枚火枣后现出三头八臂：每只手一件兵器，四面出枪，混天绫甩成整圈。')},
  }),
  general({
    id: 'yangjian', element: 'metal', name: T('Yang Jian', '杨戬'), mount: null, weapon: T('the three-pointed, two-edged blade', '三尖两刃刀'),
    treasures: ['哮天犬'], patronOf: ['spears'], seek: 'elite', hp: 320, r: 16, speed: 340,
    attack: {shape: 'arc', cd: .85, dmg: 46, radius: 100, angle: 150, push: 0, eliteMult: 1.6, range: 80},
    skill: {id: 'houndHunt', name: T('The Heaven-barking Hound', '哮天犬'), shape: 'hound', cd: 2.4, dmg: 80, count: 1, range: 640},
    steps: [{}, {}, {count: 2}, {}, {skillCd: 1.8}],
    levels: [
      T('Yang Jian seeks out elites and duels them with the three-pointed blade, which bites them harder; his Heaven-barking Hound runs down archers and shamans far off.', '杨戬专找精英，以三尖两刃刀与之单挑，对精英伤害更高；哮天犬扑杀远处的弓手与巫。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The hound takes two at a time.', '哮天犬一次扑两个。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The hound hunts more often.', '哮天犬出击更勤。'),
    ],
    trueForm: {id: 'seventyTwoChanges', name: T('The Seventy-two Changes', '七十二变'), count: 6, eliteMult: 2.6, skillCd: 1.6,
      text: T('He turns into whatever beats his foe, so elites take far more from his blade; the hound becomes a pack of six ink hounds.', '他变作克制对手之物，精英在他刀下受伤大增；哮天犬化作六条墨犬成群扑出。')},
  }),
  general({
    id: 'leizhenzi', element: 'wood', name: T('Leizhenzi', '雷震子'), mount: T('his two wings of wind and thunder', '风雷二翅'), weapon: T('the Golden Staff', '黄金棍'),
    treasures: [], patronOf: ['archers'], seek: 'cluster', fly: true, hp: 240, r: 16, speed: 380,
    attack: {shape: 'drop', pick: 'strongest', cd: 1.1, dmg: 32, count: 1, radius: 62, delay: 0, range: 110},
    skill: {id: 'thunderDive', name: T('Thunder Dive', '风雷俯冲'), shape: 'line', cd: 6, dmg: 64, length: 380, width: 64, count: 1, stun: .5},
    steps: [{}, {}, {skillCd: 4.8}, {}, {width: 90}],
    levels: [
      T('Leizhenzi flies over the mass on his wings of wind and thunder, strikes down with the Golden Staff, and dives with thunder along a line through the thickest of them.', '雷震子展开风雷二翅飞越敌群，以黄金棍下击，并挟雷声沿一线俯冲穿过最密之处。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He dives more often.', '他俯冲更勤。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The dive is broader.', '俯冲的一线更宽。'),
    ],
    trueForm: {id: 'stormWings', name: T('Storm on the Wing', '风雷随身'), storm: {radius: 150, dps: 34}, skillCd: 4,
      text: T('A storm goes with him: a cloud that moves where he flies and strikes everything under it.', '风雷随身：一团雷云跟着他移动，击打云下的一切。')},
  }),
  general({
    id: 'tuxingsun', element: 'earth', name: T('Tu Xingsun', '土行孙'), mount: null, weapon: T('the iron staff', '宾铁棍'),
    treasures: ['捆仙绳'], patronOf: ['strongmen', 'shields'], seek: 'elite', under: true, hp: 280, r: 13, speed: 360,
    attack: {shape: 'arc', cd: .8, dmg: 42, radius: 74, angle: 360, push: 0, range: 56},
    skill: {id: 'bindingRope', name: T('The Immortal-binding Rope', '捆仙绳'), shape: 'bindOne', cd: 6, dmg: 95, hold: 3, range: 620},
    steps: [{}, {}, {hold: 3.8}, {}, {skillCd: 5.4}],
    levels: [
      T('Tu Xingsun travels under the ground, comes up beneath an elite and binds it with the Immortal-binding Rope, then lays about him with his iron staff.', '土行孙施展地行术潜入地下，从精英脚下钻出，以捆仙绳将其捆住，再抡起宾铁棍乱打。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The rope holds longer.', '捆仙绳捆得更久。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He binds more often.', '他出绳更勤。'),
    ],
    trueForm: {id: 'earthOpens', name: T('The Earth Opens', '地裂'), quake: {count: 3, radius: 125, dmg: 90, hold: 2.5}, skillCd: 5,
      text: T('When he binds, the ground opens under three whole groups and holds everyone in it.', '他出绳时，三处敌群脚下的大地同时裂开，把其中的敌人全部陷住。')},
  }),
  general({
    id: 'dengchanyu', element: 'water', name: T('Deng Chanyu', '邓婵玉'), mount: null, weapon: T('her blade', '刀'),
    treasures: ['五光石'], patronOf: ['acolytes'], seek: 'hero', hp: 200, r: 14, speed: 340,
    attack: {shape: 'stone', cd: 1, dmg: 48, range: 540, stun: 1.2, speed: 720, r: 9},
    skill: {id: 'fiveStones', name: T('Five Stones', '连珠五石'), shape: 'stone', cd: 5, dmg: 48, range: 560, stun: 1.2, speed: 720, r: 9, count: 5},
    steps: [{}, {}, {stun: 1.6}, {}, {skillCd: 4.5}],
    levels: [
      T('Deng Chanyu rides by you and throws five-light stones a long way: one stone stuns one foe, and she aims first at whatever is winding up a blow.', '邓婵玉随你而行，远远掷出五光石：一石震晕一敌，并优先打向正在蓄力出手的敌人。'),
      T('She hits harder and stands more.', '她打得更重，也更耐打。'),
      T('A stone stuns longer.', '五光石震晕得更久。'),
      T('She hits harder and stands more.', '她打得更重，也更耐打。'),
      T('She throws five at once more often.', '她连掷五石更勤。'),
    ],
    trueForm: {id: 'fiveLights', name: T('The Five Lights', '五光齐放'), blind: {angle: 130, radius: 440, dmg: 46, stun: 2}, skillCd: 7,
      text: T('The stones blaze together: a fan of five lights that blinds the whole side the foes are thickest on.', '五石齐放光华：一片扇形的五色光，让敌人最密的整整一侧目不能视。')},
  }),
  general({
    id: 'huangfeihu', element: 'earth', name: T('Huang Feihu', '黄飞虎'), mount: T('the Five-coloured Divine Ox', '五色神牛'), weapon: T('his spear', '枪'),
    treasures: [], patronOf: ['hooks', 'tigers', 'chariots'], seek: 'front', hp: 380, r: 18, speed: 330,
    attack: {shape: 'line', cd: .8, dmg: 48, length: 150, width: 34, count: 1},
    skill: {id: 'rally', name: T('The Prince\'s Rally', '王命'), shape: 'rally', cd: 10, radius: 280, haste: .5},
    aura: {radius: 280, dmg: .15, guard: .2},
    steps: [{}, {aura: {radius: 280, dmg: .2, guard: .2}}, {skillCd: 8}, {aura: {radius: 320, dmg: .25, guard: .3}}, {aura: {radius: 320, dmg: .3, guard: .3}}],
    levels: [
      T('Huang Feihu fights at the head of your squads on the Five-coloured Divine Ox. Every squad near him hits harder and takes less; when he rallies them, their skills come round sooner.', '黄飞虎骑五色神牛在你的兵阵最前方作战。他身边的每一队都打得更重、受伤更少；他一声号令，各队的技能更快再次就绪。'),
      T('The squads near him hit harder still.', '他身边的兵阵打得更重。'),
      T('He rallies more often.', '他号令更勤。'),
      T('His presence reaches further and the squads near him take less.', '他的威势传得更远，身边兵阵受伤更少。'),
      T('The squads near him hit harder still.', '他身边的兵阵打得更重。'),
    ],
    trueForm: {id: 'kingWucheng', name: T('Prince Wucheng', '武成王'), allSkills: true,
      text: T('As Prince Wucheng: when he rallies, every squad\'s skill fires together at once.', '武成王亲临：他一声号令，所有兵阵的技能同时发动。')},
  }),
];

// --------------------------------------------------------------------------------------------- formations
const formations = [
  {
    id: 'circle', element: null, name: T('The Ring', '圆阵'), layout: 'ring',
    base: {guard: 4, radius: 86},
    levels: [
      {text: T('The squads stand all round you. Every fourth hit meant for you is taken by a soldier instead.', '兵阵环立四周。每第四次打向你的攻击由一名士兵代受。')},
      {guard: 3, text: T('Every third hit is taken by a soldier.', '每第三次攻击由士兵代受。')},
      {guard: 2, text: T('Every second hit is taken by a soldier.', '每第二次攻击由士兵代受。')},
    ],
  },
  {
    id: 'arrowhead', element: null, name: T('The Arrowhead', '锋矢阵'), layout: 'arrow',
    base: {moving: .25, breach: 2, tip: 140, step: 30, spread: 28},   // `breach`: the trample strikes an elite this many times as hard
    levels: [
      {text: T('The squads form a wedge ahead of you. While you are moving, the trample and the squads hit a quarter harder, and the trample strikes chariots and named foes twice as hard.', '兵阵在你前方排成楔形。移动时，践踏与兵阵的伤害提高四分之一；践踏对战车与名将的伤害翻倍。')},
      {moving: .4, breach: 2.5, text: T('While you are moving, the trample and the squads hit 40% harder, and the trample strikes chariots and named foes two and a half times as hard.', '移动时，践踏与兵阵的伤害提高 40%；践踏对战车与名将的伤害为两倍半。')},
      {moving: .6, breach: 3, text: T('While you are moving, the trample and the squads hit 60% harder, and the trample strikes chariots and named foes three times as hard.', '移动时，践踏与兵阵的伤害提高 60%；践踏对战车与名将的伤害为三倍。')},
    ],
  },
  {
    id: 'trigrams', element: null, name: T('The Eight Trigrams', '八卦阵'), layout: 'trigram',
    base: {slow: .2, radius: 130, field: 190, spin: .3, rider: 1},
    levels: [
      {text: T('The squads stand on a slowly turning octagon. Foes inside it are slowed by a fifth, and each soldier\'s attack takes the element of where he stands: fire burns, water chills, wood holds, metal cuts deeper, earth shoves.', '兵阵立于缓缓转动的八卦之上。阵内敌人减速两成，每名士兵的攻击带上所站卦位的五行：火灼烧，水迟滞，木缠缚，金更利，土推撞。')},
      {slow: .3, rider: 1.4, text: T('Foes inside are slowed by 30%, and the elements bite harder.', '阵内敌人减速三成，五行效果更强。')},
      {slow: .4, rider: 1.8, text: T('Foes inside are slowed by 40%, and the elements bite harder still.', '阵内敌人减速四成，五行效果再强。')},
    ],
  },
];
// The octagon's eight places, counter-clockwise from east (the later-heaven arrangement), and what an element
// adds to a soldier's attack there. The numbers are multiplied by the formation's `rider`.
export const TRIGRAMS = [
  {zh: '震', element: 'wood'}, {zh: '艮', element: 'earth'}, {zh: '坎', element: 'water'}, {zh: '乾', element: 'metal'},
  {zh: '兑', element: 'metal'}, {zh: '坤', element: 'earth'}, {zh: '离', element: 'fire'}, {zh: '巽', element: 'wood'},
];
export const RIDER = {
  fire: {burn: .3, time: 2},        // burns for this share of the blow each second
  water: {slow: .35, time: 1.5},
  wood: {hold: .3},                 // held in place this long
  metal: {more: .25},               // this share more damage
  earth: {push: 50},
};

// --------------------------------------------------------------------------------------------- foes
// `ai`: 'walk' (straight at the hero), 'shoot' (stops at `range` and looses), 'charge' (a warning lane, then a
// straight charge), 'aura' (keeps its distance, makes those near it faster, throws a spell), 'boss'.
// `armour` is taken off every blow (not off burning). `heavy` foes are barely thrown or stunned.
const foes = [
  {id: 'spear', element: null, name: T('Shang spearman', '商戈兵'), ai: 'walk', hp: 10, speed: 78, dmg: 6, r: 13, xp: 1,
    text: T('The mass: slow, weak, many.', '人海：慢，弱，多。')},
  {id: 'axe', element: null, name: T('Shang axeman', '商斧兵'), ai: 'walk', hp: 18, speed: 112, dmg: 9, r: 13, xp: 2,
    text: T('Fast and hits hard; dies quickly.', '快，打得重，死得也快。')},
  {id: 'shield', element: null, name: T('Shang shield-bearer', '商盾兵'), ai: 'walk', hp: 48, speed: 60, dmg: 7, r: 15, xp: 3, armour: 3,
    text: T('Slow and tough: its shield takes 3 off every blow, so many small hits do little.', '慢而坚：盾牌让每次受击少掉 3 点，零碎的小伤害对它没什么用。')},
  {id: 'archer', element: null, name: T('Shang archer', '商弓手'), ai: 'shoot', hp: 12, speed: 78, dmg: 6, r: 12, xp: 2,
    range: 380, wind: .5, between: 2.8, shot: {kind: 'arrow', speed: 300, r: 7, life: 2.2, dmg: 6},
    text: T('Stops at a distance and looses arrows to be dodged.', '停在远处放箭，需要躲避。')},
  {id: 'chariot', element: null, name: T('War chariot', '战车'), ai: 'charge', hp: 260, speed: 95, dmg: 22, r: 26, xp: 20, elite: true, heavy: true,
    sight: 560, warn: .9, length: 720, width: 56, chargeSpeed: 640, rest: 1.8, between: 5,
    text: T('An elite. It shows a lane, then charges straight down it. It drops a chest.', '精英。先亮出一条冲锋道，再沿道直冲。击破后掉落宝箱。')},
  {id: 'shaman', element: null, name: T('Shaman', '巫'), ai: 'aura', hp: 80, speed: 72, dmg: 8, r: 14, xp: 12,
    keep: 320, aura: 230, haste: 1.45, wind: .6, between: 4, shot: {kind: 'orb', speed: 180, r: 11, life: 5, dmg: 12},
    text: T('Keeps away, makes every foe near it faster until it is killed, and throws a slow curse.', '躲在远处，让身边的敌人加速直到它被击杀，并投出缓慢的咒球。')},
  // The named foes (section 6.4). 魔家四将 as chapter 40 has them; one of the four comes at 5:00, by the seed. Every
  // pattern is warned: `warn` is the ride out of it at the hero's base speed plus 0.4 s or more.
  {id: 'moliqing', element: 'wood', name: T('Mo Liqing', '魔礼青'), title: T('eldest of the four Mo brothers, with the Azure Cloud Sword', '魔家四将之长，持青云剑'), treasure: T('Azure Cloud Sword', '青云剑'),
    ai: 'named', hp: 2600, speed: 92, dmg: 20, r: 30, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'blackWind', shape: 'cone', warn: 1.4, angle: 36, radius: 440, dmg: 22, cd: 5.5, within: 420},
      {id: 'fireSnakes', shape: 'circles', warn: 1.05, count: 5, radius: 70, near: 3.2, scatter: 330, dmg: 18, cd: 7.5, within: 620}],
    text: T('The sword looses a black wind full of spear points down a cone, and golden snakes of fire that strike five places at once. Ride out of the cone; ride between the circles.', '青云剑放出一道锥形黑风，风中万千戈矛；又放金蛇烈焰，同时击向五处。骑出风锥，从火圈之间穿过。')},
  {id: 'molihong', element: 'water', name: T('Mo Lihong', '魔礼红'), title: T('of the four Mo brothers, with the Primordial Pearl Umbrella', '魔家四将之一，持混元珍珠伞'), treasure: T('Primordial Pearl Umbrella', '混元珍珠伞'),
    ai: 'named', hp: 2600, speed: 92, dmg: 20, r: 30, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'umbrellaDark', shape: 'dark', warn: 1, radius: 290, life: 5, cd: 12, within: 520},
      {id: 'pearlRing', shape: 'ring', warn: 1.05, r0: 150, r: 232, through: true, dmg: 20, cd: 5, within: 300}],
    text: T('The opened umbrella darkens the ground round him: inside it your thrown treasures are taken out of the air and your pearls strike nothing. Its pearls fly out in a ring. Fight him from outside the dark; step out of the ring.', '撑开的宝伞让他四周天昏地暗：暗处之内，你掷出的法宝被收走，宝珠也打不中任何东西。伞上明珠飞旋成环击出。在黑暗之外与他交战；踏出珠环。')},
  {id: 'molihai', element: 'metal', name: T('Mo Lihai', '魔礼海'), title: T('of the four Mo brothers, with the Jade Pipa', '魔家四将之一，背碧玉琵琶'), treasure: T('Jade Pipa', '碧玉琵琶'),
    ai: 'named', hp: 2600, speed: 92, dmg: 20, r: 30, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'fourStrings', shape: 'rings', warn: 1, bands: [[70, 150], [150, 230], [230, 310], [310, 390]], gap: .6, dmg: 18, cd: 7, within: 420},
      {id: 'windFire', shape: 'lane', warn: 1.05, length: 620, width: 90, dmg: 24, cd: 8, blast: true, within: 560}],
    text: T('Four strings, four rings: each plucked string strikes a band of ground further out than the last. Then wind and fire together down a lane. Stand where the last ring has been; step out of the lane.', '四弦四环：每拨一弦，击打的环带比上一环更远。随后风火齐至，沿一条道扫过。站到上一环刚打过的地方；踏出风火道。')},
  {id: 'molishou', element: 'earth', name: T('Mo Lishou', '魔礼寿'), title: T('youngest of the four Mo brothers, with the Flower-fox Marten', '魔家四将之幼，携花狐貂'), treasure: T('Flower-fox Marten', '花狐貂'),
    ai: 'named', hp: 2600, speed: 92, dmg: 20, r: 30, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'marten', shape: 'summon', kind: 'marten', warn: .8, cd: 22, within: 700},
      {id: 'lunge', shape: 'lane', warn: .9, length: 560, width: 60, chargeSpeed: 640, rest: 1, dmg: 22, cd: 6, within: 500}],
    text: T('He looses the marten, which grows to a winged white elephant and eats your soldiers one by one until it is killed; he himself lunges down a lane. Kill the marten first.', '他放出花狐貂，化作肋生飞翅的白象，把你的士兵一个个吃掉，直到被击杀；他自己则沿一条道突刺。先杀花狐貂。')},
  {id: 'marten', element: null, name: T('Flower-fox Marten', '花狐貂'), ai: 'marten', hp: 420, speed: 175, dmg: 16, r: 22, xp: 10, bite: 45, between: 1.1,
    text: T('Eats soldiers: one bite each second or so. With no soldier left it comes for you.', '吃士兵：约每秒一口。没有士兵可吃时就来扑你。')},
  {id: 'wenzhong', element: 'metal', name: T('Wen Zhong', '闻仲'), title: T('Grand Preceptor of Shang, on the Black Qilin, with his two golden whips', '商朝太师，骑墨麒麟，挂两根金鞭'), treasure: T('the Golden Whips', '金鞭'),
    ai: 'named', hp: 21500, armour: 30, speed: 100, dmg: 26, r: 38, xp: 0, elite: true, heavy: true, boss: true, named: true, last: true,
    patterns: [
      {id: 'qilinRush', shape: 'lane', warn: 1, length: 780, width: 80, chargeSpeed: 720, rest: .8, dmg: 36, cd: 7.5, within: 620},
      {id: 'pairedWhips', shape: 'circles', warn: 1.25, count: 2, radius: 110, ahead: 215, lead: .9, dmg: 36, cd: 4.5, within: 600},
      {id: 'goldWall', shape: 'wall', warn: 1.45, r0: 128, r: 160, life: 3, slam: {radius: 120, warn: 1.2, dmg: 40}, cd: 13, within: 560}],
    text: T('Arrives at 10:00; killing him wins. The Black Qilin rushes down a lane; the two whips fall on two circles, one where you are and one where you are going; a wall of gold rises in a ring round you and a whip falls inside it. Ride out of the ring before it closes, or spring through it.', '10:00 到场；击杀即胜。墨麒麟沿一条道冲来；双鞭落向两个圈，一个在你脚下，一个在你前路；一道金墙在你四周升起成环，随后一鞭落入环内。在金墙合拢前骑出去，或纵跃穿过。')},
];

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
    {t: 180, alive: 75, rate: 4.2, hp: 1.35, armour: 0, mix: {spear: 5, axe: 3, shield: 2, archer: 1}},
    {t: 240, alive: 110, rate: 5.2, hp: 1.7, armour: 0, mix: {spear: 5, axe: 3, shield: 2, archer: 2}},
    {t: 300, alive: 150, rate: 6.5, hp: 2.4, armour: 4, mix: {spear: 4, axe: 4, shield: 2, archer: 2}},
    {t: 360, alive: 195, rate: 8, hp: 3, armour: 8, mix: {spear: 4, axe: 4, shield: 3, archer: 2}},
    {t: 420, alive: 240, rate: 10, hp: 7.8, armour: 12, mix: {spear: 4, axe: 4, shield: 3, archer: 2}},
    {t: 480, alive: 280, rate: 12.5, hp: 15, armour: 18, mix: {spear: 3, axe: 5, shield: 3, archer: 2}},
    {t: 540, alive: 300, rate: 15, hp: 21, armour: 23, mix: {spear: 3, axe: 5, shield: 4, archer: 2}},
    {t: 600, alive: 300, rate: 17, hp: 25.5, armour: 27, mix: {spear: 3, axe: 5, shield: 4, archer: 2}},
    {t: 900, alive: 300, rate: 22, hp: 39, armour: 34, mix: {spear: 3, axe: 5, shield: 4, archer: 2}},     // past 10:00 the mass keeps growing: a run cannot stand still
  ],
  // a chariot about every minute from 1:50: each leaves a chest
  elites: [
    {t: 110, kind: 'chariot', count: 1}, {t: 170, kind: 'chariot', count: 1}, {t: 230, kind: 'chariot', count: 1},
    {t: 350, kind: 'chariot', count: 1}, {t: 410, kind: 'chariot', count: 1}, {t: 470, kind: 'chariot', count: 2},
    {t: 530, kind: 'chariot', count: 2}, {t: 575, kind: 'chariot', count: 1},
  ],
  shamans: {from: 180, every: 45},
  // Scout chariots before the named foe: one every `every` s. A scout is a chariot (`foe.scout`) of less health whose
  // warned charge hurts little; it is no elite and leaves no chest. It gives the quiet minutes something to answer.
  scouts: {from: 125, until: 295, every: 18, faster: {from: 175, every: 9}, most: 2, hp: .6, dmg: .33, xp: .25},   // never more than `most` alive
  bosses: [{t: 300, kinds: ['moliqing', 'molihong', 'molihai', 'molishou']}, {t: 600, kind: 'wenzhong'}],   // one of the four by the seed
  // an encirclement: a full ring of one kind closes in from every side at once
  rings: [{t: 170, kind: 'spear', count: 30}, {t: 300, kind: 'axe', count: 24}, {t: 390, kind: 'spear', count: 44}, {t: 510, kind: 'axe', count: 56}, {t: 560, kind: 'shield', count: 30}],
  early: {until: 100, dmg: .35},   // the mass strikes at this share of its damage at 0:00, rising to all of it by `until`
  late: {from: 660, dmg: 1.5, speed: 1.2},   // `speed`: and past 12:00 every foe moves this share faster with each minute
    // the rage: past 11:00 every Shang blow is this share harder with each minute, and past 12:00 by as much
                                 // again for every minute beyond it (2.5 times at 12:00, 7 times at 13:00): no run outlasts it
  dmg: .08,            // the damage of Shang blows and shots grows by this share every minute (their health is `hp` in the rows above)
  cap: 300,            // never more of the mass than this alive
};
export const SPAWN = {near: 760, far: 860, clump: 6, spread: 90, every: .5,
  // the Shang are already on the field when the run begins, in four loose rings: something happens at once and keeps happening
  opening: [{kind: 'spear', count: 4, near: 210, far: 300}, {kind: 'spear', count: 4, near: 400, far: 500}, {kind: 'spear', count: 5, near: 580, far: 700}, {kind: 'spear', count: 6, near: 780, far: 900}]};
export const PICKUPS = {
  mid: 3, large: 10,   // battle spirit worth this much or more is the middle size, the large size
  peach: .012, lodestone: .003,   // the chance a fallen foe of the mass leaves one
  peachMend: 25, cap: 400, life: 0,
};
// Battle spirit needed to go from `level` to the next.
export const XP = {base: 4, step: 5.5, power: 1.5};
export const xpNeed = level => Math.round(XP.base + XP.step * Math.pow(level - 1, XP.power));

// --------------------------------------------------------------------------------------------- made from the rows
function resolve(rows, max, kind) {
  for (const row of rows) {
    row.kind = kind;
    if (row.levels.length !== max) throw new Error(`${row.id}: ${row.levels.length} levels, wants ${max}`);
    row.at = [null];
    let cur = {...(row.base || {}), shape: row.shape || (row.base && row.base.shape)};
    for (const lv of row.levels) {
      const {text, ...nums} = lv;
      cur = {...cur, ...nums};
      row.at.push(cur);
    }
    if (row.evolved) {
      const {id, name, text, ...nums} = row.evolved;
      row.at.push({...cur, ...nums});
      row.evolved.needs = fedBy(row.element);
    }
  }
  return rows;
}
// a squad skill's numbers at ranks 2 to 5 (`skillAt[rank]`), and a general's at levels 1 to 5 and in his true form (`at[6]`)
for (const row of troops) {
  const {text, at3, ...two} = row.skill, {text: t3, ...three} = at3, {text: tb, ...five} = row.blessed;
  row.skillAt = [null, null, two, {...two, ...three}, {...two, ...three}, {...two, ...three, ...five}];
}
for (const row of generals) {
  row.kind = 'general';
  row.at = [null];
  let cur = {hp: row.hp, attack: row.attack, skill: row.skill, aura: row.aura || null, grow: 1, hpGrow: 1};
  row.levels.forEach((lv, i) => {
    const {text, aura, ...nums} = lv;
    const attack = {...cur.attack}, skill = {...cur.skill};
    for (const k in nums) { if (k === 'skillCd') skill.cd = nums[k]; else if (k in skill && k !== 'count') skill[k] = nums[k]; else if (k === 'count') { if (row.skill.count !== undefined) skill.count = nums[k]; else attack.count = nums[k]; } else attack[k] = nums[k]; }
    cur = {...cur, attack, skill, aura: aura || cur.aura, grow: 1 + GENERAL.grow * i, hpGrow: 1 + GENERAL.hpGrow * i};
    row.at.push(cur);
  });
  const {id, name, text, skillCd, count, eliteMult, ...form} = row.trueForm;
  const attack = {...cur.attack}, skill = {...cur.skill};
  if (skillCd) skill.cd = skillCd;
  if (count) { if (row.skill.count !== undefined) skill.count = count; else attack.count = count; }
  if (eliteMult) attack.eliteMult = eliteMult;
  row.at.push({...cur, attack, skill, form, grow: cur.grow * PAYOFF.trueForm, hpGrow: cur.hpGrow * 1.3});
}
export const CONTENT = {
  treasures: resolve(treasures, MAX.treasure, 'treasure'),
  arts: resolve(arts, MAX.art, 'art'),
  troops: resolve(troops, MAX.troop, 'troop'),
  generals,
  formations: resolve(formations, MAX.formation, 'formation'),
  foes,
};
const index = rows => Object.fromEntries(rows.map(r => [r.id, r]));
export const BY = {
  treasure: index(CONTENT.treasures), art: index(CONTENT.arts), troop: index(CONTENT.troops),
  formation: index(CONTENT.formations), foe: index(CONTENT.foes), general: index(CONTENT.generals),
};
export const LIST = {treasure: CONTENT.treasures, art: CONTENT.arts, troop: CONTENT.troops, formation: CONTENT.formations, general: CONTENT.generals};
/** The words on an offer slip: the name and what this level changes. `level` MAX + 1 of a treasure is its evolved form. */
export function describe(kind, id, level) {
  const row = BY[kind][id];
  if (kind === 'treasure' && level > MAX.treasure) return {name: row.evolved.name, text: row.evolved.text, element: row.element};
  if (kind === 'general' && level > MAX.general) return {name: row.trueForm.name, text: row.trueForm.text, element: row.element};
  if (kind === 'troop') {
    // a squad's slip also says its rank; level 9 is the blessed host
    const blessed = level > MAX.troop, rank = rankOf(Math.min(level, MAX.troop), blessed);
    return {name: blessed ? row.blessed.name : row.name, text: blessed ? row.blessed.text : row.levels[level - 1].text, element: row.element, rank, rankName: RANKS[rank - 1].name};
  }
  return {name: row.name, text: row.levels[level - 1].text, element: row.element};
}
