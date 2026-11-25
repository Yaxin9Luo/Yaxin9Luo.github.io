// The treasures (法宝): rows of an attack shape and its numbers per level, and an evolved form. Owner: rules·build (B).

import {T} from './base.js';
import {BEASTS} from './generals.js';

export const treasures = [
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
    base: {cd: 1.7, dmg: 20, angle: 120, radius: 165, push: 70},
    levels: [
      {text: T('A long sash whips an arc toward the nearest foes and pushes them back.', '长绫朝最近的敌人甩出一道弧，并把他们推开。')},
      {dmg: 26, radius: 172, text: T('A longer sash that hits for 26 instead of 20.', '长绫更长，伤害由 20 升到 26。')},
      {angle: 160, radius: 180, text: T('A wider and longer arc.', '弧更宽，绫更长。')},
      {dmg: 35, push: 90, angle: 175, text: T('Nearly a half circle; hits for 35 and pushes further.', '将近半圈；伤害升到 35，推得更远。')},
      {cd: 1.4, radius: 190, text: T('Longer, and whips more often.', '更长，甩得更勤。')},
      {dmg: 47, angle: 200, radius: 200, text: T('More than a half circle, longer, and 47 damage.', '超过半圈，更长，伤害升到 47。')},
    ],
    evolved: {id: 'riverTurner', name: T('River-turning Wave', '翻江'), dmg: 44, angle: 360, radius: 230, push: 150, span: .35,
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
  {
    // 斩仙飞刀 (75, 93, 97): 陆压's gourd; a white light with eyes and wings over the foe, 「請寶貝轉身」, and his head falls
    id: 'knife', element: 'metal', name: T('Immortal-slaying Knife', '斩仙飞刀'), shape: 'drop', opening: false, ch: [75, 93, 97],
    base: {cd: 6, dmg: 120, pick: 'strongest', count: 1, radius: 26, delay: .6, range: 520, behead: true, share: .02},
    levels: [
      {text: T('A white light rises from the gourd over the strongest foe near you; a moment later it beheads him. A common foe dies outright; an elite or a named foe takes 120 and loses 2% of his greatest health.', '葫芦中升起一道白光，悬在附近最强的敌人头顶；片刻后斩下。寻常敌兵当场毙命；精英与名将受 120 点伤害，并失去最大生命的 2%。')},
      {dmg: 160, radius: 30, text: T('The blade strikes for 160 instead of 120.', '刀光更重，伤害由 120 升到 160。')},
      {count: 2, radius: 32, text: T('Two lights at once, over the two strongest.', '同时升起两道白光，悬在最强的两个敌人头顶。')},
      {cd: 5, share: .03, radius: 34, text: T('It comes more often and takes 3% of the greatest health.', '出刀更勤，取走最大生命的 3%。')},
      {dmg: 220, range: 640, radius: 36, text: T('It reaches further and strikes for 220.', '够得更远，伤害升到 220。')},
      {count: 3, radius: 40, text: T('Three lights at once.', '三道白光同时升起。')},
    ],
    evolved: {id: 'gourdLight', name: T('The Light of the Gourd', '葫芦白光'), count: 5, share: .05, cd: 4.5, radius: 44,
      text: T('Five lights rise together; each takes 5% of a great foe\'s greatest health.', '五道白光一齐升起；每一刀取走强敌最大生命的 5%。')},
  },
  {
    // 落魂钟 (63, 65): 广成子's bell, given to 殷郊; it is shaken and the rider falls from his mount
    id: 'bell', element: 'metal', name: T('Soul-felling Bell', '落魂钟'), shape: 'arc', opening: false, ch: [63, 65],
    base: {cd: 4, dmg: 10, angle: 360, radius: 150, push: 20, stun: 1},
    levels: [
      {text: T('The bell rings: everything near you is struck and falls stunned for a second.', '钟声一响：你身边的一切都被击中，失魂倒地一秒。')},
      {dmg: 14, radius: 160, text: T('A louder peal that strikes for 14 instead of 10.', '钟声更响，伤害由 10 升到 14。')},
      {radius: 175, stun: 1.3, text: T('The peal carries further and stuns longer.', '钟声传得更远，失魂更久。')},
      {cd: 3.5, radius: 185, dmg: 18, text: T('It rings more often and strikes for 18.', '敲得更勤，伤害升到 18。')},
      {radius: 195, stun: 1.6, text: T('Further still, and a longer stun.', '传得再远，失魂更久。')},
      {radius: 215, dmg: 24, text: T('A much wider peal that strikes for 24.', '钟声远播，伤害升到 24。')},
    ],
    evolved: {id: 'soulBell', name: T('The Soul Falls', '落魂'), great: true, radius: 260, stun: 2, dmg: 30, again: 1,
      text: T('A wide peal that stuns for two seconds, and the bell rings again a second later.', '钟声远播，失魂两秒；一秒后再响一次。')},
  },
  {
    // 五火七禽扇 (49): 道德真君's fan of five fires, 「空中火、石中火、木中火、三昧火、人間火」; one fanning and a man is ash
    id: 'fan', element: 'fire', name: T('Fan of Five Fires', '五火七禽扇'), shape: 'arc', opening: false, ch: [49],   // weak at level 1: a fan-only run survived 8:02 (median)
    base: {cd: 2.2, dmg: 36, angle: 60, radius: 220, push: 0, burnDps: 10, burnLife: 2},
    levels: [
      {text: T('A cone of fire is fanned toward the nearest foes and leaves the ground burning along it.', '向最近的敌人扇出一片锥形火焰，所过之地燃烧一阵。')},
      {dmg: 48, radius: 235, text: T('Hotter: 48 instead of 36.', '火更旺，伤害由 36 升到 48。')},
      {angle: 75, radius: 250, text: T('A wider and longer cone.', '火焰更宽更长。')},
      {burnDps: 15, dmg: 67, radius: 260, text: T('The ground burns hotter, and the fire strikes for 67.', '地火更烈，扇火伤害升到 67。')},
      {cd: 1.9, radius: 275, text: T('Longer, and fanned more often.', '更长，扇得更勤。')},
      {angle: 90, dmg: 83, radius: 290, text: T('A quarter circle of fire that strikes for 83.', '火焰张成四分之一圆，伤害升到 83。')},
    ],
    evolved: {id: 'sevenBirds', name: T('Seven Birds, and Ash', '七禽化灰'), angle: 140, radius: 330, burnDps: 26, dmg: 103, ash: .16,
      text: T('A great fan of fire; a common foe left with less than a sixth of its health in it is ash.', '一扇烈焰铺开；火中生命不足六分之一的寻常敌兵化为飞灰。')},
  },
  {
    // 阴阳镜 (59): 赤精子's mirror, half red and half white: 「把白的一晃，便是死路」; the red face is life
    id: 'mirror', element: 'water', name: T('Mirror of Yin and Yang', '阴阳镜'), shape: 'beam', ch: [59],
    base: {cd: 3.2, dmg: 90, length: 240, width: 34, sweep: 1.6, life: 2, mend: 6, count: 1},   // a ray passes a foe in about a seventh of a second: dmg is a second's worth
    levels: [
      {text: T('The white face flashes: a ray sweeps round you and burns what it passes. Soldiers the red face passes mend.', '白面一晃：一道光绕你扫过，灼烧所过之敌；红面照过的士兵回复生命。')},
      {dmg: 120, width: 38, text: T('A broader ray that burns for 120 a second.', '光更宽，每秒伤害升到 120。')},
      {length: 280, text: T('A longer ray.', '光更长。')},
      {dmg: 156, life: 2.4, width: 42, text: T('It burns for 156 a second and lasts longer.', '每秒伤害升到 156，持续更久。')},
      {cd: 2.7, length: 300, text: T('Longer, and flashed more often.', '更长，晃得更勤。')},
      {length: 340, dmg: 192, text: T('A much longer ray that burns for 192 a second.', '光再长一截，每秒伤害升到 192。')},
    ],
    evolved: {id: 'twoFaces', name: T('Both Faces at Once', '阴阳两面'), count: 2, mend: 14, dmg: 234,
      text: T('Two rays back to back, one of death for the foe, one of life for your soldiers.', '两道光背对而扫：一面死路照敌，一面生路照兵。')},
  },
  {
    // 捆仙绳 (45): 惧留孙's rope (土行孙 stole it); it binds and the yellow-turban strongmen carry off the bound
    id: 'rope', element: 'wood', name: T('Immortal-binding Rope', '捆仙绳'), shape: 'bind', opening: false, ch: [45, 54],
    base: {cd: 3, dmg: 44, length: 240, width: 30, count: 1, hold: 1.2},
    levels: [
      {text: T('The rope flies along a line toward the nearest foes and binds everyone on it for a moment.', '仙绳沿一线飞向最近的敌人，把线上的敌人尽数捆住片刻。')},
      {dmg: 58, width: 34, text: T('A thicker rope that strikes for 58 instead of 44.', '绳更粗，伤害由 44 升到 58。')},
      {count: 2, text: T('Two ropes at once.', '同时飞出两条仙绳。')},
      {hold: 1.6, length: 280, width: 36, text: T('Longer ropes that hold longer.', '仙绳更长，捆得更久。')},
      {cd: 2.6, length: 300, text: T('Longer, and thrown more often.', '更长，出绳更勤。')},
      {length: 330, width: 40, dmg: 80, text: T('Longer and broader, and strikes for 80.', '更长更宽，伤害升到 80。')},
    ],
    evolved: {id: 'yellowTurban', name: T('The Strongmen Take Them', '黄巾力士拿人'), count: 3, hold: 2.2, capture: .34,
      text: T('Three ropes; the yellow-turban strongmen carry off any bound common foe with less than a third of its health.', '三条仙绳齐出；被捆的寻常敌兵若生命不足三分之一，即被黄巾力士拿走。')},
  },
  {
    // 遁龙桩, also 七宝金莲 (14, 38, 39, 94): 「上有三個金圈，往上一舉，落將下來」; it held 哪吒, 杨森 and 窦荣
    id: 'lotus', element: 'wood', name: T('Dragon-trapping Post', '遁龙桩'), shape: 'drop', opening: false, ch: [14, 38, 39, 94],
    base: {cd: 4.5, dmg: 58, pick: 'strongest', count: 1, radius: 40, delay: .5, range: 520, hold: 2},
    levels: [
      {text: T('Three gold rings fall over the strongest foe near you and hold him in place, even a heavy one; a named foe a third as long.', '三个金圈落在附近最强的敌人身上，把他定在原地，再重的也一样；名将只定三分之一的时间。')},
      {dmg: 80, radius: 44, text: T('The rings strike for 80 instead of 58.', '金圈更重，伤害由 58 升到 80。')},
      {count: 2, radius: 46, text: T('Two posts, over the two strongest.', '两根金桩，罩住最强的两个。')},
      {hold: 2.6, radius: 50, text: T('The rings hold longer.', '金圈定得更久。')},
      {cd: 3.8, radius: 54, text: T('Wider rings that fall more often.', '金圈更大，落得更勤。')},
      {count: 3, radius: 58, text: T('Three posts.', '三根金桩。')},
    ],
    evolved: {id: 'sevenTreasures', name: T('The Seven-treasure Golden Lotus', '七宝金莲'), count: 4, radius: 70, hold: 3.2, dmg: 134,
      text: T('Four golden lotuses, wider, and they hold longer.', '四朵七宝金莲，更大，定得更久。')},
  },
  {
    // 玲珑宝塔 (14, 65): 燃灯's pagoda, given to 李靖; it covered 哪吒 and crushed 罗宣
    id: 'tower', element: 'earth', name: T('Exquisite Pagoda', '玲珑宝塔'), shape: 'drop', opening: false, ch: [14, 65],
    base: {cd: 5, dmg: 50, pick: 'strongest', count: 1, radius: 70, delay: .7, range: 520, zone: 'tower', zoneDps: 20, zoneLife: 2.5, zoneSlow: .85},
    levels: [
      {text: T('The pagoda drops on the strongest foe near you and stands there a while: whoever is under it can hardly move and is crushed.', '宝塔落在附近最强的敌人身上，镇住片刻：塔下之敌几乎动弹不得，持续受压。')},
      {dmg: 70, radius: 76, text: T('A heavier pagoda: 70 instead of 50.', '宝塔更重，伤害由 50 升到 70。')},
      {radius: 86, zoneDps: 28, text: T('A wider pagoda that crushes harder.', '宝塔更大，压得更重。')},
      {zoneLife: 3, radius: 90, dmg: 90, text: T('It stands longer and strikes for 90.', '镇得更久，伤害升到 90。')},
      {cd: 4.3, radius: 95, text: T('Wider, and drops more often.', '更大，落得更勤。')},
      {count: 2, zoneDps: 38, text: T('Two pagodas, on the two strongest.', '两座宝塔，镇住最强的两个。')},
    ],
    evolved: {id: 'heavensTower', name: T('The Golden Pagoda of the Thirty-three Heavens', '三十三天黄金宝塔'), count: 3, radius: 110, zoneDps: 60, dmg: 140,
      text: T('Three great golden pagodas, larger and heavier.', '三座三十三天黄金宝塔，更大更重。')},
  },
  {
    // 照妖鉴 (92): 云中子's mirror; 杨戬 shone it and the goat was seen for what it was
    id: 'zhaoyao', element: 'metal', name: T('Demon-revealing Mirror', '照妖鉴'), shape: 'arc', opening: false, ch: [92],
    base: {cd: 3, dmg: 26, angle: 40, radius: 300, push: 0, expose: .15, exposeTime: 3},
    levels: [
      {text: T('A cone of light toward the nearest foes: those in it are revealed, and for 3 seconds every blow on them is 15% harder.', '一道锥形镜光照向最近的敌人：被照到的现出原形，3 秒内所受每一击重 15%。')},
      {radius: 320, dmg: 36, text: T('The light reaches further.', '镜光照得更远。')},
      {angle: 50, expose: .2, text: T('A wider light; the revealed take 20% more.', '镜光更宽；现形者多受 20%。')},
      {radius: 340, exposeTime: 4, text: T('Further, and they stay revealed for 4 seconds.', '更远，现形 4 秒。')},
      {cd: 2.6, radius: 360, text: T('It shines more often, and further.', '照得更勤、更远。')},
      {angle: 60, expose: .25, text: T('A wider light; the revealed take 25% more.', '镜光更宽；现形者多受 25%。')},
    ],
    evolved: {id: 'trueShape', name: T('Shown in Their True Shape', '现原形'), angle: 80, radius: 420, expose: .35, bane: BEASTS, baneMult: 3, baneStun: 1,
      text: T('A great light: the revealed take 35% more, and beasts and changers in it take three times its blow and stand stunned.', '大片镜光：现形者多受 35%；其中的妖兽与变化之物受三倍伤害，并被定住。')},
  },
];
// 合璧 (SPEC-CAMPAIGN 2.6): two treasures, both evolved, become one and free a slot. When `chain[0]` strikes,
// `chain[1]` strikes with it. Pairs the book puts together.
export const merges = [
  {id: 'naohai', name: T('Nezha Stirs the Sea', '哪吒闹海'), parts: ['sash', 'ring'], chain: ['sash', 'ring'], ch: [12],
    text: T('The sash and the ring as one: every wave of the sash throws the rings.', '混天绫与乾坤圈合璧：混天绫每翻一浪，乾坤圈随之掷出。')},
  {id: 'sanmeiFire', name: T('Samadhi Fire Dragons', '三昧火龙'), parts: ['fireSpear', 'fireCover'], chain: ['fireSpear', 'fireCover'], ch: [14, 76],
    text: T('The spear and the fire cover as one: every thrust drops the nine fire domes.', '火尖枪与九龙神火罩合璧：每一枪刺出，九龙火罩随之落下。')},
  {id: 'yuxuEdict', name: T('The Edict of Yuxu', '玉虚敕令'), parts: ['banner', 'whip'], chain: ['banner', 'whip'], ch: [38, 50],
    text: T('The banner and the whip as one: every time the banner\'s ward returns, the whip strikes every elite on screen.', '杏黄旗与打神鞭合璧：杏黄旗每复原一次，打神鞭随之击打满场精英。')},
  {id: 'yinjiaoPair', name: T('Seal and Bell', '番天落魂'), parts: ['bell', 'seal'], chain: ['bell', 'seal'], ch: [63],
    text: T('The bell and the seal as one: every peal brings the seal down on the densest group.', '落魂钟与番天印合璧：钟声一响，番天印随之砸向最密的敌群。')},
  {id: 'zhanyao', name: T('Reveal, then Behead', '照妖斩仙'), parts: ['zhaoyao', 'knife'], chain: ['zhaoyao', 'knife'], ch: [92, 93, 97],
    text: T('The mirror and the knife as one: every flash of the mirror sends the knife\'s lights at once.', '照妖鉴与斩仙飞刀合璧：镜光一照，飞刀白光随之升起。')},
  {id: 'zhenfu', name: T('Post and Pagoda', '塔桩镇伏'), parts: ['lotus', 'tower'], chain: ['lotus', 'tower'], ch: [14],
    text: T('The post and the pagoda as one: whoever the gold rings hold, the pagoda falls on.', '遁龙桩与玲珑宝塔合璧：金圈定住谁，宝塔就镇向谁。')},
];
