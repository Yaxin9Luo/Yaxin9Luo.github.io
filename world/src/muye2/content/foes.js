// The Shang mass: the foe kinds that are not bosses. Owner: rules·campaign (A).

import {T} from './base.js';

// `ai`: 'walk' (straight at the hero), 'swarm' (as walk, weaving from side to side), 'escort' (keeps round 纣王 while he lives), 'shoot' (stops at `range` and looses), 'charge' (a warning lane, then a
// straight charge), 'aura' (keeps its distance, makes those near it faster, throws a spell), 'drum' (keeps behind the
// mass and beats: each beat drives those round him to a run), 'ride' (closes fast, rears, gallops straight through
// where the hero was and wheels back), 'named' (a boss: see bosses.js).
// `stretch` is the stretch whose mass the kind belongs to (0, 1, 2; 3 the 御林军); names from
// research_notes/Fengshen campaign research.md section 6.1 (the chapter in `ch`). `hook` (on touching the hero, he is
// held), `trail` (fire left behind), `drag` (near one, the hero is slowed): what a kind does besides its `ai`.
// `armour` is taken off every blow (not off burning). `heavy` foes are barely thrown or stunned.
export const foes = [
  {id: 'spear', element: null, name: T('Shang spearman', '商戈兵'), ai: 'walk', hp: 10, speed: 78, dmg: 6, r: 13, xp: 1,
    text: T('The mass: slow, weak, many.', '人海：慢，弱，多。')},
  {id: 'axe', element: null, name: T('Shang axeman', '商斧兵'), ai: 'walk', hp: 18, speed: 112, dmg: 9, r: 13, xp: 2,
    text: T('Fast and hits hard; dies quickly.', '快，打得重，死得也快。')},
  {id: 'shield', element: null, name: T('Shang shield-bearer', '商盾兵'), ai: 'walk', hp: 48, speed: 60, dmg: 7, r: 15, xp: 3, armour: 3,
    text: T('Slow and tough: its shield takes 3 off every blow, so many small hits do little.', '慢而坚：盾牌让每次受击少掉 3 点，零碎的小伤害对它没什么用。')},
  {id: 'archer', element: null, name: T('Long-bow archer', '长箭手'), ch: 51, ai: 'shoot', hp: 12, speed: 78, dmg: 6, r: 12, xp: 2,
    range: 380, wind: .5, between: 2.8, shot: {kind: 'arrow', speed: 300, r: 7, life: 2.2, dmg: 6},
    text: T('Stops at a distance and looses arrows to be dodged.', '停在远处放箭，需要躲避。')},
  {id: 'chariot', element: null, name: T('War chariot', '战车'), ai: 'charge', hp: 260, speed: 95, dmg: 22, r: 26, xp: 20, elite: true, heavy: true,
    sight: 560, warn: .9, length: 720, width: 56, chargeSpeed: 640, rest: 1.8, between: 5,
    text: T('An elite. It shows a lane, then charges straight down it. It drops a chest.', '精英。先亮出一条冲锋道，再沿道直冲。击破后掉落宝箱。')},
  {id: 'shaman', element: null, name: T('Shaman', '巫'), ai: 'aura', hp: 80, speed: 72, dmg: 8, r: 14, xp: 12,
    keep: 320, aura: 230, haste: 1.45, wind: .6, between: 4, shot: {kind: 'orb', speed: 180, r: 11, life: 5, dmg: 12},
    text: T('Keeps away, makes every foe near it faster until it is killed, and throws a slow curse.', '躲在远处，让身边的敌人加速直到它被击杀，并投出缓慢的咒球。')},
  // stretch one, new in the campaign
  {id: 'drummer', element: null, name: T('War drummer', '鼓手'), ai: 'drum', hp: 60, speed: 70, dmg: 6, r: 15, xp: 8,
    keep: 280, beat: 3, radius: 220, haste: 1.7, surge: 1.2,
    text: T('Keeps behind the mass and beats the drum: at every beat those round him break into a run for a moment. Kill him first, or ride clear of the beat.', '躲在人海后面擂鼓：每一通鼓，身边的商兵都猛冲一阵。先杀他，或在鼓点时让开。')},
  {id: 'cavalry', element: null, name: T('Hooked-horse rider', '拐子马'), ch: 40, ai: 'ride', hp: 30, speed: 150, dmg: 7, r: 16, xp: 4,
    reach: 300, wind: .5, gallop: 360, dash: 1.1, between: 5,
    text: T('Fast riders. One rears, then gallops straight through where you were and wheels round: step aside as he rears.', '快骑。先人立而起，再直冲你刚才所在之处，冲过头后兜回。见他人立就让开。')},
  // stretch two (M2: behaviour of their own; for now the stand-in in the comment)
  {id: 'flyingTiger', element: null, name: T('Flying-tiger soldier', '飞虎兵'), ch: 74, stretch: 1, ai: 'walk', hp: 30, speed: 95, dmg: 9, r: 13, xp: 3, hook: {hold: .45, every: 4},
    text: T('陈奇\'s men in yellow, with hooks and nooses: one that reaches you hooks you fast for a moment.', '陈奇的黄号兵，持挠钩套索：碰到你就把你钩住片刻。')},
  {id: 'fireDragon', element: 'fire', name: T('Fire-dragon soldier', '火龙兵'), ch: 71, stretch: 1, ai: 'walk', hp: 36, speed: 120, dmg: 9, r: 13, xp: 3, trail: {every: .8, r: 24, life: 2, dmg: 3},
    text: T('火灵圣母\'s three thousand, who charge with fire: the ground they run over burns for a while.', '火灵圣母的三千火龙兵，以火冲营：跑过之处燃起一阵火。')},
  {id: 'bladeCart', element: null, name: T('Ten-thousand-blade cart', '万刃车兵'), ch: 76, stretch: 1, ai: 'charge', hp: 120, speed: 80, dmg: 10, r: 20, xp: 8, heavy: true,
    sight: 480, warn: .9, length: 420, width: 44, chargeSpeed: 520, rest: 1.6, between: 6,
    text: T('Barefoot men in black push carts of blades down a warned lane.', '皂服赤脚，推着刀车沿预警之道冲来。')},
  {id: 'plague', element: 'water', name: T('Plague envoy', '行瘟使者'), ch: 58, stretch: 1, ai: 'aura', hp: 90, speed: 72, dmg: 8, r: 14, xp: 12, drag: .2,
    keep: 320, aura: 230, haste: 1.3, wind: .6, between: 4, shot: {kind: 'orb', speed: 180, r: 11, life: 5, dmg: 14},
    text: T('吕岳\'s envoys with chime and banner: like the shaman, and near one you ride a fifth slower.', '吕岳的行瘟使者，持磬与幡：如巫，靠近他时你慢两成。')},
  {id: 'fireCrow', element: 'fire', name: T('Fire crows', '火鸦'), ch: 64, stretch: 1, ai: 'swarm', hp: 14, speed: 140, dmg: 6, r: 10, xp: 1,
    text: T('A flock that breathes fire: fast, frail, weaving as it comes.', '口内喷火的鸦群：快而脆，左右穿飞而来。')},
  {id: 'wasp', element: null, name: T('Centipede-wasps', '蜈蜂'), ch: 70, stretch: 1, ai: 'swarm', hp: 10, speed: 150, dmg: 5, r: 9, xp: 1,
    text: T('高继能\'s swarm, weaving as it comes.', '高继能的蜈蜂群，左右穿飞而来。')},
  // stretch three
  {id: 'bianGuard', element: null, name: T('Bian Ji\'s house guard', '卞吉家将'), ch: 85, stretch: 2, ai: 'walk', hp: 70, speed: 80, dmg: 12, r: 15, xp: 4, armour: 3,
    text: T('Bian Ji\'s men: tough, and they hit hard.', '卞吉家将：耐打，手重。')},
  {id: 'pox', element: null, name: T('Pox adept', '毒痘道人'), ch: 81, stretch: 2, ai: 'aura', hp: 90, speed: 72, dmg: 8, r: 14, xp: 12, drag: .2,
    keep: 320, aura: 230, haste: 1.3, wind: .6, between: 4, shot: {kind: 'orb', speed: 200, r: 12, life: 5, dmg: 16},
    text: T('Scatters poison pox: like the shaman, and near one you ride a fifth slower.', '夜洒毒痘：如巫，靠近他时你慢两成。')},
  ...[['centipede', '蜈蚣', 'Centipede', 'wood', 92, 34, 110, 'swarm'], ['snake', '白蛇', 'White snake', 'water', 92, 40, 100, 'swarm'], ['dog', '犬', 'Hound', 'metal', 92, 26, 150, 'walk'],
    ['goat', '山羊', 'Goat', 'metal', 92, 36, 125, 'walk']].map(([id, zh, en, element, ch, hp, speed, ai]) => (
    {id, element, name: T(en, zh), ch, stretch: 2, ai, hp, speed, dmg: 10, r: 14, xp: 3,
      text: T('A beast of the Plum Mountain kind (the book has one of each, the fiends\' true forms; the many are the game\'s).', '梅山原形兽（书中每种只有一只，即六怪的原形；成群是改编）。')})),
  {id: 'buffalo', element: 'earth', name: T('Water buffalo', '水牛'), ch: 92, stretch: 2, ai: 'charge', hp: 90, speed: 70, dmg: 14, r: 18, xp: 5, heavy: true,
    sight: 420, warn: .8, length: 360, width: 40, chargeSpeed: 480, rest: 1.6, between: 6,
    text: T('Lowers its horns, shows a short lane and charges down it.', '低头亮角，先现短冲锋道，再沿道冲来。')},
  {id: 'boar', element: 'earth', name: T('Boar', '野猪'), ch: 92, stretch: 2, ai: 'ride', hp: 60, speed: 120, dmg: 10, r: 15, xp: 4,
    reach: 260, wind: .5, gallop: 340, dash: 1, between: 5,
    text: T('Paws the ground, then runs straight through where you were.', '刨地之后，直冲你刚才所在之处。')},
  {id: 'giant', element: 'earth', name: T('Giant with a harrow-log', '巨人'), ch: 91, stretch: 2, ai: 'charge', hp: 600, speed: 80, dmg: 26, r: 30, xp: 30, elite: true, heavy: true,
    sight: 520, warn: 1, length: 600, width: 64, chargeSpeed: 560, rest: 2, between: 6,
    text: T('A giant like 邬文化, dragging a harrow-log down a warned lane. An elite; leaves a chest.', '邬文化一般的巨人，拖着排扒木沿预警之道冲来。精英，掉宝箱。')},
  // the 御林军 (research notes section 2; never called 禁军): from 纣王's arrival every foe of the mass is one of these
  {id: 'yulin', element: null, name: T('Imperial guard', '御林甲士'), ch: 94, stretch: 3, ai: 'walk', hp: 60, speed: 85, dmg: 12, r: 14, xp: 4, armour: 4,
    text: T('Armoured, with dagger-axes; they march to the drums.', '披铠持戈，擂鼍鼓而进。')},
  {id: 'drumGuard', element: null, name: T('Guard drummer', '御林鼓手'), ch: 94, stretch: 3, ai: 'drum', hp: 80, speed: 70, dmg: 8, r: 15, xp: 8, armour: 4,
    keep: 280, beat: 2.6, radius: 240, haste: 1.7, surge: 1.2,
    text: T('The 御林军\'s drummers (they beat the 鼍 drum as they march): at each beat the guards round them run.', '御林军的鼓手（擂鼍鼓而进）：每一通鼓，身边的禁卫都猛冲一阵。')},
  {id: 'goldMelon', element: null, name: T('Gold-melon guard', '金瓜武士'), ch: 10, stretch: 3, ai: 'walk', hp: 90, speed: 70, dmg: 18, r: 15, xp: 5, armour: 6,
    text: T('The palace executioners with the golden melon mace: slow and heavy-handed.', '殿上以金瓜击顶的武士：慢而手重。')},
  {id: 'axeGuard', element: null, name: T('Battle-axe guard', '钺斧卫'), ch: 20, stretch: 3, ai: 'escort', hp: 70, speed: 95, dmg: 14, r: 15, xp: 5, armour: 4,
    text: T('The broad-axe guards of the procession (带刀力士): while 纣王 lives they keep round him.', '仪仗中的钺斧卫（带刀力士）：纣王在时环护左右。')},
  {id: 'zhendian', element: null, name: T('Hall-guarding general', '镇殿将军'), ch: 8, stretch: 3, ai: 'charge', hp: 900, speed: 85, dmg: 30, r: 34, xp: 30, elite: true, heavy: true,
    sight: 560, warn: 1, length: 640, width: 70, chargeSpeed: 600, rest: 1.8, between: 5.5,
    text: T('A giant of three zhang with a halberd; the guards\' elite. He shows a lane and strides down it. Leaves a chest.', '身高三丈的持戟巨人，御林军的精英。亮出一道再沿道冲来。掉宝箱。')},
];
