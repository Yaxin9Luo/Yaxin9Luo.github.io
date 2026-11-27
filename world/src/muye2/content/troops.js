// The troops (兵): squads of men, eight levels and five ranks, a squad skill and a blessed one. Owner: rules·build (B).

import {T} from './base.js';

// A squad follows the hero. `stand` is where its men stand when no formation is taken: 'between' (toward the
// nearest mass), 'ring' (round the hero), 'behind' (away from the mass), 'far' (well behind), 'escort' (close by),
// 'line' (a loose line toward the mass), 'orbit' (they circle the hero wide and keep doing so in a formation),
// 'wade' (they go to the foe, in a formation too), 'flank' (two short files at the hero's left and right). Where a
// squad stands with no formation is its `station` (SPEC-CAMPAIGN 2.2b): a block of rows and files in a sector of its own
// (angle from the side the mass is on, the first row's distance, men a row, `split` into two blocks at ±angle), every
// one outside the clear ring round the hero (ALLY_CLEAR). `attack.per` is 'man' (each man by his own clock, at a foe in
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
export const SECOND = {
  fire: T('sets those it strikes burning', '让击中的敌人燃烧'), water: T('chills those it strikes so that they move slowly', '让击中的敌人迟滞'),
  wood: T('holds those it strikes fast for a moment', '把击中的敌人缠住片刻'), metal: T('cuts a quarter deeper', '多造成四分之一伤害'),
  earth: T('shoves those it strikes further back', '把击中的敌人推得更远'),
};
export const RANK_HP = [1, 1, 1.5, 2.2, 3], RANK_DMG = [1, 1, 1.5, 2.1, 2.8];
/**
 * A troop row. `men` is the number of men at each of the eight levels; a level that adds no man and no rank makes
 * the squad strike more often.
 */
export const TROOP_UP = 1.3;   // 1.25 to 1.3 (at 1.4–1.6 the troops build won 51–53/60, over its 85%) (2026-11-25): soldiers did 11-14% of a sensible winning build's damage (bar 15%) as treasures and generals grew   // every squad's blows, skills and blessed skills, over the numbers written in the rows below
export const FOLLOW = {mult: 1.4, t: 2};   // 2026-11-27: a squad does `mult` times its damage to a foe a general struck within the last `t` s (天眼's marks too). Stronger generals had taken the soldiers' kills: troop-heavy wins 41% soldiers (bar 45%); with this and PAYOFF.troopCurve [.5, .9], 47.7% over 120 seeds, generals untouched
const FOLLOW_TEXT = T(` They fall on whatever a general has just struck: ${Math.round((FOLLOW.mult - 1) * 100)}% more damage to it for ${FOLLOW.t} s.`, `将领刚击中的敌人，兵士乘势掩杀：${FOLLOW.t} 秒内对其伤害提高 ${Math.round((FOLLOW.mult - 1) * 100)}%。`);
export function troop(o) {
  const up = x => x && x.dmg ? {...x, dmg: Math.round(x.dmg * TROOP_UP)} : x;
  o = {...o, base: up(o.base), skill: up(o.skill), blessed: up(o.blessed)};
  const levels = [];
  let cd = o.base.cd;
  for (let l = 1; l <= 8; l++) {
    const rank = rankOf(l), up = l > 1 && rank > rankOf(l - 1), more = l > 1 && o.men[l - 1] > o.men[l - 2];
    const nums = {men: o.men[l - 1], rank, hp: Math.round(o.base.hp * RANK_HP[rank]), dmg: Math.round(o.base.dmg * RANK_DMG[rank])};
    if (l > 1 && !up && !more) cd = Math.round(cd * .86 * 100) / 100;
    nums.cd = cd;
    const R = RANKS[rank - 1], n = nums.men, one = n === 1;
    let text;
    if (l === 1) text = T(o.text.en + FOLLOW_TEXT.en, o.text.zh + FOLLOW_TEXT.zh);
    else if (up && rank === 2) text = T(`Picked men (锐士): ${nums.hp} health each and a blow of ${nums.dmg}. They learn ${o.skill.name.en}: ${o.skill.text.en}`, `锐士：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。习得「${o.skill.name.zh}」：${o.skill.text.zh}`);
    else if (up && rank === 3) text = T(`Armoured men (甲士)${more ? `, ${n} of them` : ''}: ${nums.hp} health each and a blow of ${nums.dmg}. ${o.skill.name.en} grows: ${o.skill.at3.text.en}`, `甲士${more ? `，增至 ${n} 名` : ''}：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。「${o.skill.name.zh}」更强：${o.skill.at3.text.zh}`);
    else if (up && rank === 4) text = T(`Dark-armour guard (玄甲): ${nums.hp} health each and a blow of ${nums.dmg}. ${o.skill.name.en} also ${SECOND[o.element].en}.`, `玄甲：每人 ${nums.hp} 点生命，攻击 ${nums.dmg}。「${o.skill.name.zh}」还会${SECOND[o.element].zh}。`);
    else if (more) text = T(`${one ? 'One' : n} ${o.name.en.toLowerCase()} in the squad.`, `${o.name.zh}增至 ${n} 名。`);
    else text = T(`The ${o.name.en.toLowerCase()} strike more often: every ${cd} s instead of ${levels[l - 2].cd}.`, `${o.name.zh}出手更勤：每 ${cd} 秒一次，原为 ${levels[l - 2].cd} 秒。`);
    levels.push({...nums, text});
  }
  return {id: o.id, element: o.element, name: o.name, stand: o.stand, station: o.station, blocks: !!o.blocks, patron: o.patron, base: o.base, levels, skill: o.skill, blessed: o.blessed};
}
export const troops = [
  troop({
    id: 'shields', element: 'earth', name: T('Round-shield men', '牌手'), stand: 'between', blocks: true, patron: 'tuxingsun', station: {angle: 0, r0: 128, perRow: 5}, men: [5, 6, 6, 7, 8, 8, 8, 10],
    base: {hp: 120, r: 13, muster: 4, leash: 70, per: 'man', shape: 'arc', cd: 1.4, dmg: 12, angle: 110, radius: 54, push: 45, range: 50, stun: 0},
    text: T('Five round-shield men stand between you and the nearest mass. Foes cannot walk through them and arrows stop on their shields.', '五名牌手站在你与最近的敌群之间。敌人穿不过他们，箭矢被团牌挡下。'),
    skill: {id: 'shieldWall', name: T('Shield Wall', '盾墙'), shape: 'arc', cd: 9, dmg: 22, radius: 150, angle: 150, push: 130, stun: .8,
      text: T('they lock shields and shove the whole front back, stunning it.', '连盾成墙，把整条战线推回去并震晕。'),
      at3: {radius: 195, push: 160, text: T('a longer wall that shoves further.', '盾墙更长，推得更远。')}},
    blessed: {id: 'mountainWall', name: T('Wall Like a Mountain', '不动如山'), shape: 'arc', dmg: 60, radius: 250, angle: 360, push: 220, stun: 1.5,
      text: T('The wall closes into a full ring round you and throws everything outward, stunned.', '盾墙合成一整圈，把四周的一切向外掀翻并震晕。')},
  }),
  troop({
    id: 'spears', element: 'metal', name: T('Long-spear men', '长矛手'), stand: 'ring', patron: 'yangjian', station: {angle: 1.3, r0: 125, perRow: 2, split: true}, men: [5, 6, 6, 7, 8, 8, 8, 10],
    base: {hp: 70, r: 12, muster: 4, leash: 150, per: 'man', shape: 'line', cd: 1.2, dmg: 20, length: 110, width: 24, count: 1, range: 105, push: 0},
    text: T('Five long-spear men stand round you and thrust outward at whatever comes in reach.', '五名长矛手环立四周，向进入范围的敌人刺击。'),
    skill: {id: 'massThrust', name: T('Massed Thrust', '攒刺'), shape: 'lines', cd: 7, dmg: 34, length: 170, width: 28, fan: 1,
      text: T('all thrust outward at once, a ring of points that goes through everyone on it.', '同时向外齐刺，一圈枪尖贯穿所过之敌。'),
      at3: {length: 230, width: 34, text: T('longer and broader points.', '枪尖更长更宽。')}},
    blessed: {id: 'thousandPoints', name: T('A Thousand Points', '万刃齐发'), shape: 'lines', dmg: 70, length: 300, width: 36, fan: 3, fanAngle: .3,
      text: T('Every man thrusts three points in a fan: a full crown of blades round you.', '每人扇形刺出三道枪芒：四周绽开一整圈刀光。')},
  }),
  troop({
    id: 'archers', element: 'wood', name: T('Strong-bow archers', '强弓手'), stand: 'behind', patron: 'leizhenzi', station: {angle: Math.PI, r0: 128, perRow: 4}, men: [4, 5, 5, 6, 7, 7, 7, 9],
    base: {hp: 45, r: 12, muster: 4, per: 'squad', shape: 'throw', cd: 1.6, dmg: 34, count: 1, speed: 560, shotR: 9, range: 520, life: 1.3, pierce: 2, bounces: 0, hop: 0, target: 'cluster'},
    text: T('Four strong-bow archers keep behind you and loose a volley at the densest group.', '四名强弓手跟在你身后，向最密的敌群齐射。'),
    skill: {id: 'arrowRain', name: T('Rain of Arrows', '箭雨'), shape: 'drop', pick: 'cluster', zone: 'rain', cd: 6.5, dmg: 56, count: 1, radius: 120, delay: .9, range: 560,
      text: T('a volley rises and falls on the densest group, darkening a circle of ground first.', '箭矢升空后落向最密的敌群，落下前地上先暗出一个圆。'),
      at3: {radius: 155, text: T('the rain covers a wider circle.', '箭雨覆盖更大的圆。')}},
    blessed: {id: 'skyOfArrows', name: T('A Sky of Arrows', '遮天箭雨'), shape: 'drop', pick: 'cluster', zone: 'rain', dmg: 80, count: 3, radius: 150, delay: .9, range: 620, stun: .8,
      text: T('Three rains fall on three groups at once and pin those under them.', '三阵箭雨同时落向三处敌群，并把箭下之敌钉在原地。')},
  }),
  troop({
    id: 'strongmen', element: 'earth', name: T('Yellow-turban strongmen', '黄巾力士'), stand: 'wade', patron: 'tuxingsun', station: {angle: 0, r0: 215, perRow: 2}, men: [1, 2, 2, 2, 3, 3, 3, 4],
    base: {hp: 300, r: 22, muster: 8, leash: 300, per: 'man', shape: 'arc', cd: 2.2, dmg: 46, angle: 360, radius: 82, push: 150, range: 60, stun: 0},
    text: T('One huge summoned strongman wades into the foe near you and throws everyone round him.', '召来一名巨大的黄巾力士，冲入附近的敌群，把四周的敌人掀飞。'),
    skill: {id: 'boulder', name: T('Hurled Boulder', '掷石'), shape: 'throw', cd: 8, dmg: 70, count: 1, speed: 440, shotR: 26, range: 520, life: 1, pierce: 99, bounces: 0, hop: 0, target: 'cluster', push: 60, shotKind: 'boulder',
      text: T('each lifts a boulder and hurls it: it bowls a line through the mass.', '每人举起巨石掷出，在敌群中滚出一条线。'),
      at3: {shotR: 36, life: 1.25, text: T('a larger boulder that rolls further.', '巨石更大，滚得更远。')}},
    blessed: {id: 'mountainThrow', name: T('Throwing the Mountain', '移山'), shape: 'throw', dmg: 120, count: 1, speed: 440, shotR: 44, range: 560, life: 1.25, pierce: 99, bounces: 0, hop: 0, target: 'cluster', push: 90, shotKind: 'boulder', burst: {radius: 150, dmg: 140, stun: 1},
      text: T('The boulder is a piece of mountain: where its roll ends it bursts and stuns all round it.', '掷出的是一角山岩：滚到尽头轰然崩开，震晕四周。')},
  }),
  troop({
    id: 'chariots', element: 'metal', name: T('War chariots', '战车'), stand: 'orbit', patron: 'huangfeihu', station: {angle: 0, r0: 230, perRow: 4}, men: [1, 2, 2, 2, 3, 3, 3, 4],
    base: {hp: 260, r: 24, muster: 8, per: 'man', shape: 'arc', cd: .8, dmg: 38, angle: 360, radius: 58, push: 50, range: 40, stun: 0, orbit: 230, turn: .9},
    text: T('One war chariot circles you wide and runs down whatever it meets.', '一辆战车在你外围绕行，碾过遇到的敌人。'),
    skill: {id: 'chariotCharge', name: T('Breaking Charge', '冲阵'), shape: 'charge', cd: 6.5, dmg: 104, length: 420, width: 64, push: 90, time: .6,
      text: T('each chariot charges down a lane through the densest group, throws everything aside, then wheels back.', '每辆战车沿一条道冲过最密的敌群，把一切撞开，再掉头回来。'),
      at3: {length: 520, width: 80, text: T('a longer and wider lane.', '冲锋道更长更宽。')}},
    blessed: {id: 'ironTide', name: T('Iron Tide', '铁流'), shape: 'charge', dmg: 130, length: 620, width: 96, push: 140, time: .7, back: true,
      text: T('The chariots charge out and back again down the same lane, and nothing stands in it.', '战车沿同一条道冲出又冲回，道上再无站立之敌。')},
  }),
  troop({
    id: 'ironRiders', element: 'fire', name: T('Iron cavalry', '铁骑'), stand: 'escort', patron: 'huangfeihu', station: {angle: 2.15, r0: 150, perRow: 2, split: true}, men: [3, 4, 4, 5, 6, 6, 6, 7],
    base: {hp: 110, r: 14, muster: 5, leash: 130, per: 'man', shape: 'arc', cd: 1, dmg: 24, angle: 110, radius: 62, push: 0, range: 56, stun: 0},
    text: T('Three iron horsemen ride close beside you and cut down what comes near.', '三名铁骑紧随左右，砍倒靠近的敌人。'),
    skill: {id: 'breakLine', name: T('Breaking the Line', '陷阵'), shape: 'leap', cd: 7, dmg: 52, radius: 90, range: 420, time: .45, stun: .5, count: 1,
      text: T('they spur together onto an elite, or the nearest thick group, and crash into it.', '一同纵马冲向精英或最近的密集敌群，重重撞入。'),
      at3: {radius: 120, text: T('a heavier crash over a wider place.', '冲撞更重，范围更大。')}},
    blessed: {id: 'ironFlood', name: T('Iron Horse Abreast', '铁骑横排'), shape: 'leap', dmg: 120, radius: 120, range: 480, time: .45, stun: .8, count: 5, zone: 'burn', zoneDps: 30, zoneLife: 3,
      text: T('Each horseman rides into a group of his own, and the ground burns where he strikes.', '每名铁骑各冲一处敌群，冲入之处燃起烈火。')},
  }),
  troop({
    id: 'disciples', element: 'water', name: T('Disciples of Yuxu', '玉虚门人'), stand: 'far', patron: 'jiangziya', station: {angle: Math.PI, r0: 185, perRow: 4}, men: [3, 4, 4, 5, 6, 6, 6, 7],
    base: {hp: 40, r: 11, muster: 5, per: 'man', shape: 'throw', cd: 1.6, dmg: 20, count: 1, speed: 480, shotR: 8, range: 440, life: 1.1, pierce: 0, bounces: 0, hop: 0, target: 'nearest', shotKind: 'talisman'},
    text: T('Three disciples of Yuxu keep well behind you and throw paper talismans at the nearest foes.', '三名玉虚门人远远跟在后面，向最近的敌人掷出符纸。'),
    skill: {id: 'talisman', name: T('Talisman Rite', '符法'), shape: 'talisman', cd: 7, dmg: 42, radius: 110, range: 520, life: 4,
      text: T('they cast a spell of the element your build has most of: fire burns the ground, water freezes, wood binds, metal sends thin blades from foe to foe, earth raises a wall.', '施展你身上最多的那一行的法术：火焚地，水冻结，木缠缚，金放出在敌间弹跳的薄刃，土升起一道墙。'),
      at3: {radius: 140, life: 5, text: T('a larger spell that lasts longer.', '法术更大，持续更久。')}},
    blessed: {id: 'fiveTalismans', name: T('Five Talismans', '五行符阵'), shape: 'talisman', dmg: 55, radius: 150, range: 560, life: 5, all: true,
      text: T('All five elements at once: fire, frost, vines, blades and a wall, each on a group of its own.', '五行齐发：火、冰、藤、刃、墙，各落一处敌群。')},
  }),
  troop({
    id: 'crows', element: 'wood', name: T('Crow soldiers', '乌鸦兵'), stand: 'line', patron: 'zhenglun', station: {angle: 0, r0: 185, perRow: 5}, men: [4, 5, 5, 6, 7, 7, 7, 9],
    base: {hp: 60, r: 12, muster: 4, leash: 120, per: 'man', shape: 'line', cd: 1.1, dmg: 14, length: 100, width: 22, count: 1, range: 95, push: -24},
    text: T('Four crow soldiers with hooks and chains keep a loose line toward the foe and drag those in reach closer.', '四名手持挠钩铁索的乌鸦兵散成一线，把够得着的敌人钩近。'),
    skill: {id: 'hookDrag', name: T('Hooks and Chains', '挠钩'), shape: 'pull', cd: 8, dmg: 14, radius: 150, range: 380, hold: 1.4,
      text: T('hooks fly into the densest group, drag it together into one knot and hold it there.', '挠钩飞入最密的敌群，把他们拖成一团并拽住。'),
      at3: {radius: 195, hold: 1.8, text: T('the hooks reach wider and hold longer.', '挠钩够得更广，拽得更久。')}},
    blessed: {id: 'heavenNet', name: T('Net of Heaven', '天罗地网'), shape: 'pull', dmg: 40, radius: 300, range: 420, hold: 2.6,
      text: T('A net of chains falls over everything in sight of the squad, hauls it into one heap and holds it long.', '铁索织成的大网罩住视野内的一切，收成一堆并久久拽住。')},
  }),
  troop({
    // 牙门将 (53: the 中军 under the apricot banner, 「金盔，金甲，紅袍，畫戟」): they keep the host whole. While one stands,
    // every other squad musters its fallen men `rally` times as fast; their standard brings every fallen man back at once.
    id: 'yamen', element: 'fire', name: T('Gold-armoured guards', '牙门将'), stand: 'flank', patron: 'jiangziya', station: {angle: .62, r0: 120, perRow: 1, split: true}, men: [2, 2, 3, 3, 4, 4, 4, 6],
    base: {hp: 220, r: 15, muster: 6, leash: 170, per: 'man', shape: 'arc', cd: 1.1, dmg: 30, angle: 200, radius: 78, push: 30, range: 60, stun: 0, rally: 1.5},
    text: T('Two gold-armoured guards with painted halberds ride at your flanks and sweep what comes near. While one of them stands, every other squad musters its fallen men half as fast again.', '两名金盔金甲、手持画戟的牙门将护在你两侧，横扫靠近的敌人。只要有一人在，其余各队补员快一半。'),
    skill: {id: 'standard', name: T('The Standard of the Centre', '中军帅旗'), shape: 'standard', cd: 14, dmg: 30, radius: 220, push: 80, life: 6, mend: 10,
      text: T('they plant the apricot standard where you are: every squad gets back every man it has lost at once, foes near it are thrown back, and soldiers under it mend for a while.', '在你所在之处立起杏黄帅旗：各队阵亡的士兵立刻全数补回，旗下的敌人被震开，旗下士兵持续回复生命。'),
      at3: {radius: 280, life: 8, text: T('a wider standard that stands longer.', '帅旗覆盖更广，立得更久。')}},
    blessed: {id: 'twentyFour', name: T('Twenty-four Gold-armoured Generals', '二十四员牙门将'), shape: 'standard', dmg: 60, radius: 340, push: 120, life: 10, mend: 24, follow: true, up: .25,
      text: T('The standard goes with you while it stands; soldiers under it strike a quarter harder and mend fast.', '帅旗随你而行；旗下士兵攻击提高四分之一，回复更快。')},
  }),
];
