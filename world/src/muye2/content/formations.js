// The formations (阵): how the squads stand, and the eight trigrams' elements. Owner: rules·build (B).

import {T} from './base.js';

// Every formation also has `command`: what changes at each level while 姜子牙 is on the field (content.js makes
// `commanded[level]` from it). The three new ones are from 子牙's twelve formation tokens (68).
export const formations = [
  {
    id: 'circle', element: null, name: T('The Ring', '圆阵'), layout: 'ring',
    base: {guard: 4, radius: 122},
    command: [{guard: 3}, {guard: 2}, {guard: 1}],
    levels: [
      {text: T('The squads stand all round you. Every fourth hit meant for you is taken by a soldier instead.', '兵阵环立四周。每第四次打向你的攻击由一名士兵代受。')},
      {guard: 3, text: T('Every third hit is taken by a soldier.', '每第三次攻击由士兵代受。')},
      {guard: 2, text: T('Every second hit is taken by a soldier.', '每第二次攻击由士兵代受。')},
    ],
  },
  {
    id: 'arrowhead', element: null, name: T('The Arrowhead', '锋矢阵'), layout: 'arrow',
    base: {moving: .25, breach: 3, tip: 230, step: 26, spread: 26},   // `breach`: the trample strikes an elite this many times as hard
    command: [{moving: .4, breach: 4}, {moving: .55, breach: 5}, {moving: .75, breach: 6}],
    levels: [
      {text: T('The squads form a wedge ahead of you. While you are moving, the trample and the squads hit a quarter harder, and the trample strikes chariots and named foes three times as hard.', '兵阵在你前方排成楔形。移动时，践踏与兵阵的伤害提高四分之一；践踏对战车与名将的伤害为三倍。')},
      {moving: .4, breach: 4, text: T('While you are moving, the trample and the squads hit 40% harder, and the trample strikes chariots and named foes four times as hard.', '移动时，践踏与兵阵的伤害提高 40%；践踏对战车与名将的伤害为四倍。')},
      {moving: .6, breach: 5, text: T('While you are moving, the trample and the squads hit 60% harder, and the trample strikes chariots and named foes five times as hard.', '移动时，践踏与兵阵的伤害提高 60%；践踏对战车与名将的伤害为五倍。')},
    ],
  },
  {
    id: 'trigrams', element: null, name: T('The Eight Trigrams', '八卦阵'), layout: 'trigram',
    base: {slow: .2, radius: 135, field: 200, spin: .3, rider: 1},
    command: [{slow: .3, rider: 1.4}, {slow: .4, rider: 1.8}, {slow: .5, rider: 2.2}],
    levels: [
      {text: T('The squads stand on a slowly turning octagon. Foes inside it are slowed by a fifth, and each soldier\'s attack takes the element of where he stands: fire burns, water chills, wood holds, metal cuts deeper, earth shoves.', '兵阵立于缓缓转动的八卦之上。阵内敌人减速两成，每名士兵的攻击带上所站卦位的五行：火灼烧，水迟滞，木缠缚，金更利，土推撞。')},
      {slow: .3, rider: 1.4, text: T('Foes inside are slowed by 30%, and the elements bite harder.', '阵内敌人减速三成，五行效果更强。')},
      {slow: .4, rider: 1.8, text: T('Foes inside are slowed by 40%, and the elements bite harder still.', '阵内敌人减速四成，五行效果再强。')},
    ],
  },
  {
    // 一字长蛇阵 (68): the men ride in one file along the way the hero has come; whatever a man of the file touches is held
    id: 'snake', element: null, name: T('The Long Snake', '一字长蛇阵'), layout: 'snake',
    base: {layout: 'snake', gap: 26, snakeHold: .4, file: .1},
    command: [{snakeHold: .6, file: .15}, {snakeHold: .8, file: .2}, {snakeHold: 1, file: .25}],
    levels: [
      {text: T('The squads ride in one long file along the way you came. A foe a man of the file touches is held for 0.4 s (once a second), and the men of the file strike 10% harder.', '兵阵沿你走过的路排成一字长蛇。被蛇身士兵碰到的敌人被缠住 0.4 秒（每秒至多一次），蛇身士兵攻击提高 10%。')},
      {snakeHold: .6, file: .15, text: T('Held 0.6 s; the file strikes 15% harder.', '缠住 0.6 秒；蛇身攻击提高 15%。')},
      {snakeHold: .8, file: .2, text: T('Held 0.8 s; the file strikes 20% harder.', '缠住 0.8 秒；蛇身攻击提高 20%。')},
    ],
  },
  {
    // 二龙出水阵 (68): two columns go out ahead of the hero, left and right; between them the foe is caught
    id: 'dragons', element: null, name: T('Two Dragons Leave the Water', '二龙出水阵'), layout: 'dragons',
    base: {layout: 'dragons', spread: .61, step: 30, from: 120, reach: 380, coneSlow: .25, cross: .1},
    command: [{coneSlow: .35, cross: .15}, {coneSlow: .45, cross: .2}, {coneSlow: .55, cross: .25}],
    levels: [
      {text: T('The squads go out ahead of you in two columns, left and right. Foes in the cone between them are slowed by a quarter, and every squad strikes 10% harder.', '兵阵在你前方分作左右两列，如二龙出水。两列之间的锥形内敌人减速四分之一，各队攻击提高 10%。')},
      {coneSlow: .35, cross: .15, text: T('Slowed by 35% between them; squads strike 15% harder.', '两列之间减速 35%；各队攻击提高 15%。')},
      {coneSlow: .45, cross: .2, text: T('Slowed by 45% between them; squads strike 20% harder.', '两列之间减速 45%；各队攻击提高 20%。')},
    ],
  },
  {
    // 四门斗底阵 (68): a square round the hero with a gate in each side; who comes in is caught at the bottom
    id: 'gates', element: null, name: T('Four Gates', '四门斗底阵'), layout: 'gates',
    base: {layout: 'gates', side: 125, trap: .3, close: 5, closeStun: 1},
    command: [{trap: .4, close: 4.5}, {trap: .5, close: 4}, {trap: .6, close: 3.5}],
    levels: [
      {text: T('The squads stand on a square round you with a gate in each side. Foes inside are slowed by 30%, and every 5 s the gates close: those inside are stunned for a second.', '兵阵在你四周列成方阵，四面各留一门。阵内敌人减速三成；每 5 秒四门一闭，阵内之敌震晕一秒。')},
      {trap: .4, close: 4.5, text: T('Slowed by 40% inside; the gates close every 4.5 s.', '阵内减速四成；每 4.5 秒闭门一次。')},
      {trap: .5, close: 4, text: T('Slowed by half inside; the gates close every 4 s.', '阵内减速一半；每 4 秒闭门一次。')},
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
