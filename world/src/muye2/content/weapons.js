// The hero's weapons (兵器): one is chosen before the run and is his own automatic attack beside the treasures; it
// takes no slot, has eight levels and one evolution (level 8 and the art 武艺 owned, by a chest). Owner: rules·build
// (B). Contract: lab/game-studies/SPEC-CAMPAIGN.md section 2.4 (and 3.4: the fields the page reads).
//
// The book never shows 武王 fighting (research_notes/Fengshen campaign research.md 4.16), so the weapons are the
// game's own; the bow's evolution is the 乾坤弓 and 震天箭 of 陈塘关 (13).
// Shapes: 'thrust' (lines along the way the horse is heading: length, width, count, fanAngle, tip), 'sweep' (an arc
// toward the nearest foe, as a treasure's arc: angle, radius, push, stun; combo, namedMult, twice, double, cleft),
// 'shoot' (arrows at the nearest elite or named foe, else the nearest: count, speed, r, range, life, pierce, fan).

import {T} from './base.js';

export const WEAPON_ART = 'wuyi';   // the art whose ownership lets a weapon evolve

// Reach (user, second play, 2026-11-25; SPEC-CAMPAIGN 2.4): the four hand weapons strike only what is in reach (a
// mount's length is 70 px) and never aim at a far foe; they grow in force, speed and effect, not in range. Only the bow
// shoots, and it is weak per arrow: the safe choice.
export const REACH = {spear: 105, halberd: 70, glaive: 85, steelWhip: 55};
export const weapons = [
  {
    id: 'spear', sign: '枪', name: T('Spear', '枪'), shape: 'thrust',
    text: T('A thrust of a mount and a half ahead, the way the horse is heading, through everything on it; with nobody there, at the nearest foe in that reach.', '朝战马前进方向刺出一个半马身长的一枪，贯穿枪路上的敌人；前方无敌时刺向这距离内最近的敌人。'),
    suits: T('Riding through the mass.', '冲阵。'),
    base: {cd: .7, dmg: 45, length: REACH.spear, width: 34, count: 1, fanAngle: .35, push: 0},
    levels: [
      {text: T('A thrust of a mount and a half ahead, the way the horse is heading, through everything on it; with nobody there, at the nearest foe in that reach.', '朝战马前进方向刺出一个半马身长的一枪，贯穿枪路上的敌人；前方无敌时刺向这距离内最近的敌人。')},
      {dmg: 58, text: T('A harder thrust: 58 instead of 45.', '刺得更重：伤害由 45 升到 58。')},
      {count: 2, text: T('Two thrusts at once, a little either side.', '同时刺出两枪，略向两侧分开。')},
      {push: 40, cd: .62, text: T('Quicker, and the thrust throws them back.', '出枪更快，并把敌人挑开。')},
      {dmg: 74, text: T('Harder: 74.', '更重：74。')},
      {count: 3, width: 40, text: T('Three thrusts in a fan, and broader.', '三枪成扇，枪锋更宽。')},
      {dmg: 92, text: T('Harder: 92.', '更重：92。')},
      {cd: .5, push: 60, text: T('Quicker still, and it throws them further.', '再快，挑得更远。')},
    ],
    evolved: {id: 'dragonSpear', name: T('The Roving Dragon', '游龙枪'), count: 5, fanAngle: .3, dmg: 110, tip: {radius: 50, share: .6},
      text: T('Five thrusts in a fan, and the tip of each bursts.', '五枪成扇，每一枪的枪尖都会炸开。')},
  },
  {
    id: 'halberd', sign: '戟', name: T('Halberd', '戟'), shape: 'sweep',
    text: T('A sweep of half a circle at a mount\'s length, toward the nearest foe in reach.', '朝一马身内最近的敌人横扫半圈。'),
    suits: T('Being surrounded.', '被围。'),
    base: {cd: .9, dmg: 50, angle: 180, radius: REACH.halberd, push: 40},
    levels: [
      {text: T('A sweep of half a circle at a mount\'s length, toward the nearest foe in reach.', '朝一马身内最近的敌人横扫半圈。')},
      {dmg: 62, text: T('A harder sweep: 62 instead of 50.', '扫得更重：伤害由 50 升到 62。')},
      {angle: 220, text: T('A wider sweep.', '扫得更宽。')},
      {push: 60, cd: .8, text: T('Quicker, and it throws them further back.', '更快，掀得更远。')},
      {dmg: 77, text: T('Harder: 77.', '更重：77。')},
      {angle: 270, text: T('Three quarters of a circle.', '扫过四分之三圈。')},
      {dmg: 92, text: T('Harder: 92.', '更重：92。')},
      {angle: 360, text: T('A full circle.', '扫满一整圈。')},
    ],
    evolved: {id: 'paintedHalberd', name: T('The Painted Halberd', '方天画戟'), dmg: 112, twice: 1.36, push: 90,
      text: T('Two full sweeps, the second a little wider, that throw everything back.', '连扫两整圈，第二圈略宽，把敌人远远掀开。')},
  },
  {
    id: 'glaive', sign: '刀', name: T('Great blade', '大刀'), shape: 'sweep',
    text: T('A slow, heavy cleave a little wider than the halberd\'s that throws foes back and staggers them.', '慢而重的劈砍，比戟略宽，把敌人击退并震晕片刻。'),
    suits: T('Thick crowds.', '人堆。'),
    base: {cd: 1.5, dmg: 130, angle: 200, radius: REACH.glaive, push: 130, stun: .4},
    levels: [
      {text: T('A slow, heavy cleave a little wider than the halberd\'s that throws foes back and staggers them.', '慢而重的劈砍，比戟略宽，把敌人击退并震晕片刻。')},
      {dmg: 165, text: T('A heavier cleave: 165 instead of 130.', '劈得更重：伤害由 130 升到 165。')},
      {stun: .6, text: T('They stagger longer.', '震晕更久。')},
      {angle: 220, cd: 1.35, text: T('Wider and a little quicker.', '更宽，略快。')},
      {dmg: 205, text: T('Heavier: 205.', '更重：205。')},
      {push: 170, text: T('It throws them further.', '击退更远。')},
      {dmg: 245, stun: .8, text: T('Heavier (245), and a longer stagger.', '更重（245），震晕更久。')},
      {angle: 240, cd: 1.15, text: T('Wider and quicker.', '更宽，更快。')},
    ],
    evolved: {id: 'mountainSplitter', name: T('Splitting the Mountain', '开山'), great: true, dmg: 290, cleft: {width: 60, dps: 60, slow: .5, life: 3},
      text: T('The cleave leaves a short cleft in the ground that crushes and slows whoever is in it for 3 s.', '一刀劈出一道地裂，裂中之敌 3 秒内持续受压、行动迟缓。')},
  },
  {
    id: 'bow', sign: '弓', name: T('Bow', '弓'), shape: 'shoot',
    text: T('Arrows from far off at the nearest elite or named foe, else the nearest foe; each goes through one. The only weapon that reaches far, and the lightest per arrow.', '远射最近的精英或名将，没有则射最近的敌人；每支箭可穿透一人。唯一能远攻的兵器，每箭也最轻。'),
    suits: T('Keeping away.', '放风筝。'),
    base: {cd: 1.1, dmg: 30, count: 1, speed: 760, r: 8, range: 600, life: 1.1, pierce: 1, fan: .1},
    levels: [
      {text: T('Arrows from far off at the nearest elite or named foe, else the nearest foe; each goes through one. The only weapon that reaches far, and the lightest per arrow.', '远射最近的精英或名将，没有则射最近的敌人；每支箭可穿透一人。唯一能远攻的兵器，每箭也最轻。')},
      {dmg: 37, text: T('Harder arrows: 37 instead of 30.', '箭更重：伤害由 30 升到 37。')},
      {count: 2, text: T('Two arrows at once.', '一次两箭。')},
      {range: 680, life: 1.2, text: T('Further.', '射得更远。')},
      {cd: .95, pierce: 2, text: T('Quicker, and each goes through two.', '更快，每箭穿透两人。')},
      {count: 3, text: T('Three arrows at once.', '一次三箭。')},
      {dmg: 48, text: T('Harder: 48.', '更重：48。')},
      {cd: .8, count: 4, text: T('Four arrows, quicker.', '四箭齐发，更快。')},
    ],
    evolved: {id: 'zhentian', name: T('The Universe Bow and the Heaven-shaking Arrows', '乾坤弓·震天箭'), count: 6, pierce: 99, dmg: 60, fan: .12,
      text: T('Six heaven-shaking arrows at once, and each goes through everything on its way.', '六支震天箭齐发，每一支都贯穿沿途的一切。')},
  },
  {
    id: 'steelWhip', sign: '鞭', name: T('Steel whip', '钢鞭'), shape: 'sweep',
    text: T('The shortest and fastest: quick blows at the nearest foe close by, every third one heavy; named foes take 60% more.', '最短也最快：快打身边最近的敌人，每第三鞭是重击；名将多受六成伤害。'),
    suits: T('Bosses.', '打 Boss。'),
    base: {cd: .42, dmg: 34, angle: 150, radius: REACH.steelWhip, push: 0, namedMult: 1.6, combo: {every: 3, mult: 2.5, radiusUp: 1}},
    levels: [
      {text: T('The shortest and fastest: quick blows at the nearest foe close by, every third one heavy; named foes take 60% more.', '最短也最快：快打身边最近的敌人，每第三鞭是重击；名将多受六成伤害。')},
      {dmg: 44, text: T('Harder blows: 44 instead of 34.', '鞭更重：伤害由 34 升到 44。')},
      {cd: .37, text: T('Quicker.', '更快。')},
      {namedMult: 1.8, text: T('Named foes take 80% more.', '名将多受八成。')},
      {dmg: 56, text: T('Harder: 56.', '更重：56。')},
      {cd: .33, combo: {every: 3, mult: 3.2, radiusUp: 1}, text: T('Quicker, and the third blow is heavier.', '更快，第三鞭更重。')},
      {dmg: 68, text: T('Harder: 68.', '更重：68。')},
      {namedMult: 2, cd: .3, text: T('Named foes take twice; quicker still.', '名将受双倍伤害；再快。')},
    ],
    evolved: {id: 'ninefold', name: T('The Nine-jointed Whip', '九节钢鞭'), dmg: 80, double: true, namedMult: 2.2,
      text: T('Two whips at once, before and behind; named foes take 120% more.', '双鞭齐下，一前一后；名将多受一倍二成。')},
  },
];
