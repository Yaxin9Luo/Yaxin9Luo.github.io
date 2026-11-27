// The named foes (bosses) and what they loose. Owner: rules·campaign (A).

import {T} from './base.js';

export const bosses = [
  // The named foes (section 6.4). 魔家四将 as chapter 40 has them; one of the four comes at 5:00, by the seed. Every
  // pattern is warned: `warn` is the ride out of it at the hero's base speed plus 0.4 s or more.
  {id: 'moliqing', element: 'wood', name: T('Mo Liqing', '魔礼青'), title: T('eldest of the four Mo brothers, with the Azure Cloud Sword', '魔家四将之长，持青云剑'), treasure: T('Azure Cloud Sword', '青云剑'),
    ai: 'named', tier: 'small', hp: 1900, speed: 92, dmg: 20, r: 20, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'blackWind', shape: 'cone', warn: 1.4, angle: 36, radius: 440, dmg: 22, cd: 5.5, within: 420},
      {id: 'fireSnakes', shape: 'circles', warn: 1.05, count: 5, radius: 70, near: 3.2, scatter: 330, dmg: 18, cd: 7.5, within: 620}],
    text: T('The sword looses a black wind full of spear points down a cone, and golden snakes of fire that strike five places at once. Ride out of the cone; ride between the circles.', '青云剑放出一道锥形黑风，风中万千戈矛；又放金蛇烈焰，同时击向五处。骑出风锥，从火圈之间穿过。')},
  {id: 'molihong', element: 'water', name: T('Mo Lihong', '魔礼红'), title: T('of the four Mo brothers, with the Primordial Pearl Umbrella', '魔家四将之一，持混元珍珠伞'), treasure: T('Primordial Pearl Umbrella', '混元珍珠伞'),
    ai: 'named', tier: 'small', hp: 1900, speed: 92, dmg: 20, r: 20, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'umbrellaDark', shape: 'dark', warn: 1, radius: 290, life: 5, cd: 12, within: 520},
      {id: 'pearlRing', shape: 'ring', warn: 1.05, r0: 150, r: 232, through: true, dmg: 20, cd: 5, within: 300}],
    text: T('The opened umbrella darkens the ground round him: inside it your thrown treasures are taken out of the air and your pearls strike nothing. Its pearls fly out in a ring. Fight him from outside the dark; step out of the ring.', '撑开的宝伞让他四周天昏地暗：暗处之内，你掷出的法宝被收走，宝珠也打不中任何东西。伞上明珠飞旋成环击出。在黑暗之外与他交战；踏出珠环。')},
  {id: 'molihai', element: 'metal', name: T('Mo Lihai', '魔礼海'), title: T('of the four Mo brothers, with the Jade Pipa', '魔家四将之一，背碧玉琵琶'), treasure: T('Jade Pipa', '碧玉琵琶'),
    ai: 'named', tier: 'small', hp: 1900, speed: 92, dmg: 20, r: 20, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'fourStrings', shape: 'rings', warn: 1, bands: [[70, 150], [150, 230], [230, 310], [310, 390]], gap: .6, dmg: 18, cd: 7, within: 420},
      {id: 'windFire', shape: 'lane', warn: 1.05, length: 620, width: 90, dmg: 24, cd: 8, blast: true, within: 560}],
    text: T('Four strings, four rings: each plucked string strikes a band of ground further out than the last. Then wind and fire together down a lane. Stand where the last ring has been; step out of the lane.', '四弦四环：每拨一弦，击打的环带比上一环更远。随后风火齐至，沿一条道扫过。站到上一环刚打过的地方；踏出风火道。')},
  {id: 'molishou', element: 'earth', name: T('Mo Lishou', '魔礼寿'), title: T('youngest of the four Mo brothers, with the Flower-fox Marten', '魔家四将之幼，携花狐貂'), treasure: T('Flower-fox Marten', '花狐貂'),
    ai: 'named', tier: 'small', hp: 1900, speed: 92, dmg: 20, r: 20, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      {id: 'marten', shape: 'summon', kind: 'marten', warn: .8, cd: 12, within: 700},
      {id: 'lunge', shape: 'lane', warn: .9, length: 560, width: 60, chargeSpeed: 640, rest: 1, dmg: 22, cd: 6, within: 500}],
    text: T('He looses the marten, which grows to a winged white elephant and eats your soldiers one by one until it is killed; he himself lunges down a lane. Kill the marten first.', '他放出花狐貂，化作肋生飞翅的白象，把你的士兵一个个吃掉，直到被击杀；他自己则沿一条道突刺。先杀花狐貂。')},
  {id: 'marten', element: null, name: T('Flower-fox Marten', '花狐貂'), ai: 'marten', hp: 420, speed: 175, dmg: 16, r: 22, xp: 10, bite: 45, between: 1.1,
    text: T('Eats soldiers: one bite each second or so. With no soldier left it comes for you.', '吃士兵：约每秒一口。没有士兵可吃时就来扑你。')},
  {id: 'wenzhong', element: 'metal', name: T('Wen Zhong', '闻仲'), title: T('Grand Preceptor of Shang, on the Black Qilin, with his two golden whips', '商朝太师，骑墨麒麟，挂两根金鞭'), treasure: T('the Golden Whips', '金鞭'),
    // a duel (SPEC-CAMPAIGN 1.17): the field clears, an arena; three phases, 太师出征, 雷部, 绝龙岭 (ch 41-52)
    ai: 'named', tier: 'big', duel: true, phases: [1, .66, .33], hp: 30000, armour: 44, speed: 100, dmg: 15, r: 31, xp: 0, elite: true, heavy: true, boss: true, named: true,
    patterns: [
      // `then`: in a duel the pattern that follows this one `thenAfter` s after it begins, aimed at where the dodge took the hero (1.17)
      // `read`: an arena pattern (1.17): no straight way out; a safe place within reach is found by reading it (the test checks it)
      {id: 'qilinRush', then: 'pairedWhips', thenAfter: .45, shape: 'lane', warn: 1, length: 780, width: 90, chargeSpeed: 720, rest: .8, dmg: 10, cd: 6.5, within: 620},
      {id: 'pairedWhips', shape: 'circles', warn: 1.25, count: 2, radius: 110, ahead: 215, lead: .9, dmg: 9, cd: 4.5, within: 900},
      {id: 'thirdEye', then: 'qilinRush', thenAfter: .9, read: true, shape: 'sweep', warn: 1.1, count: 9, step: .36, gap: .18, length: 720, width: 90, dmg: 8, cd: 8, within: 620},
      {id: 'thunderRows', read: true, from: 1, shape: 'rows', warn: 1.2, count: 6, gap: 1.1, dmg: 7, cd: 9, within: 2000},
      {id: 'goldWall', from: 1, great: true, shape: 'wall', warn: 1.45, r0: 128, r: 160, life: 3, slam: {radius: 120, warn: 1.2, dmg: 12}, cd: 12, within: 560},
      {id: 'threeWhips', from: 1, shape: 'circles', warn: 1.25, count: 3, radius: 110, ahead: 215, lead: .9, near: 2.6, scatter: 300, dmg: 10, cd: 6, within: 900},
      {id: 'fourGenerals', then: 'threeWhips', thenAfter: .7, read: true, from: 1, shape: 'four', warn: 1.15, count: 4, spacing: 230, width: 90, gap: .15, dmg: 11, cd: 7, within: 2000, who: ['dengzhong', 'xinhuan', 'zhangjie', 'taorong']},
      {id: 'qilinReturn', from: 2, shape: 'lane', warn: 1.2, length: 780, width: 90, chargeSpeed: 720, rest: .5, dmg: 9, cd: 5, within: 620},
      {id: 'dragonPillars', read: true, from: 2, great: true, shape: 'rings', warn: 1.1, bands: [[80, 190], [190, 310], [310, 440], [440, 580]], gap: .55, dmg: 12, cd: 6, within: 2000},
      {id: 'thunderStorm', read: true, from: 2, shape: 'circles', warn: 1.2, count: 9, radius: 80, near: 2.4, scatter: 520, dmg: 12, cd: 6.5, within: 2000}],
    text: T('At 10:00 he calls you out alone: the field clears and a ring of his thunder holds you both. Three parts: the Grand Preceptor rides out (the Black Qilin, the paired whips, the white light of his third eye); the thunder of 雷部 breaks (rows of thunder across the ground, a wall of gold, his four officers riding side by side); at the Dragon-ending Ridge the fire pillars close on him and he drives their fire outward. Each part takes its time; read the ground and move.', '十点整他单独叫阵：战场清空，雷霆圈住你们二人。三段：太师出征（墨麒麟、雌雄鞭、第三只眼的白光）；雷部发作（一排排雷霆横扫地面、金遁、邓辛张陶四将并驾冲来）；绝龙岭上神火柱围住他，他把火势向外推开。每一段都有它的时间；读地面，然后走位。')},
];

// ---------------------------------------------------------------------------------------- the campaign's bosses
// Research notes section 5 (the chapter in `ch`). `tier`: 'small' | 'big' | 'final' | 'lieutenant'. `phases`: the
// health shares at which each phase begins; a pattern with `from: n` is used from phase n; every phase after the first
// makes the patterns come 15% sooner. `retinue`: what he brings, `{kind, count, phase}` (phase: released when he enters
// that phase; 0 or none: with him). Patterns use the proven shapes of the brothers and 闻仲 under their own ids, with
// what each does besides: `effect` on whom it strikes ('bleed', 'dizzy', 'soul', 'dazzle', 'held', 'light'), `leaves`
// lasting ground ('fire', 'plague', 'bone', 'wind', 'pillar'), `burrow`, `vanish`, and the self-shapes 'glare', 'stone', 'guard'.
const P = {   // proven shapes: each keeps 6 of 8 ways out at 0.4 s (the test checks every pattern of every row)
  cone: {shape: 'cone', warn: 1.4, angle: 36, radius: 440, within: 420},
  scatter: {shape: 'circles', warn: 1.05, count: 5, radius: 70, near: 3.2, scatter: 330, within: 620},
  ring: {shape: 'ring', warn: 1.05, r0: 150, r: 232, through: true, within: 300},
  bands: {shape: 'rings', warn: 1, bands: [[70, 150], [150, 230], [230, 310], [310, 390]], gap: .6, within: 420},
  blast: {shape: 'lane', warn: 1.05, length: 620, width: 90, blast: true, within: 560},
  charge: {shape: 'lane', warn: .9, length: 560, width: 60, chargeSpeed: 640, rest: 1, within: 500},
  rush: {shape: 'lane', warn: 1, length: 780, width: 80, chargeSpeed: 720, rest: .8, within: 620},
  pair: {shape: 'circles', warn: 1.25, count: 2, radius: 110, ahead: 215, lead: .9, within: 600},
  one: {shape: 'circles', warn: 1.3, count: 1, radius: 100, within: 420},
};
const pat = (id, base, more) => ({id, ...P[base], ...more});
const officer = (id, en, zh, title, ch, patterns, more = {}) => ({id, element: null, name: T(en, zh), title, ch,
  ai: 'named', tier: 'lieutenant', hp: 2600, armour: 20, speed: 96, dmg: 18, r: 20, xp: 20, elite: true, heavy: true, boss: true, named: true, patterns, ...more,
  text: T(`${en}, a named officer: a short bar, warned blows of his own; he leaves a peach.`, `${zh}：有名有姓的部将，头顶短血条，有自己的带预警招式；击杀掉落仙桃。`)});
const demon = (id, en, zh, title, ch, patterns, more = {}) => ({...officer(id, en, zh, title, ch, patterns, {tier: 'small', hp: 80000, armour: 50, dmg: 26, demon: true, cap: 1 / 60, weary: 65, ...more}),
  text: T(`${en}, one of the seven of 梅山 who come with 袁洪: a short bar, two warned blows; while any of them lives 袁洪 takes only a fifth of every blow. He leaves a peach.`, `${zh}：随袁洪而来的梅山七怪之一，头顶短血条，两种带预警的招式；他们有一个活着，袁洪便只受五分之一的伤害。击杀掉落仙桃。`)});
const beast = (id, en, zh, rider) => ({id, element: null, name: T(en, zh), ch: 38, ai: 'charge', hp: 300, speed: 120, dmg: 16, r: 20, xp: 10, heavy: true,
  sight: 460, warn: .8, length: 420, width: 48, chargeSpeed: 600, rest: 1.2, between: 4.5,
  text: T(`The ${en.toLowerCase()} the Nine-Dragon Isle sage ${rider} rode: one of 张桂芳's four beasts. It shows a short lane, then lunges down it.`, `九龙岛${rider}的坐骑${zh}，张桂芳的四只异兽之一。先亮出短冲锋道，再沿道扑来。`)});

bosses.push(
  // stretch one, small: 张桂芳 (ch 36–39). The call: his voice carries in front of him, and the one it names falls from his horse.
  {id: 'zhangguifang', element: 'metal', name: T('Zhang Guifang', '张桂芳'), title: T('Commander of the Green Dragon Pass, who calls a man by name and he falls from his horse', '青龙关总兵，呼名落马'), treasure: T('the calling of names', '呼名落马'), ch: 36,
    ai: 'named', tier: 'small', hp: 2100, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'bian'}, {kind: 'suanni'}, {kind: 'leopard'}, {kind: 'zhengning'}],
    patterns: [
      pat('callName', 'cone', {dmg: 8, unhorse: 2.5, cd: 9}),
      pat('silverSpear', 'charge', {dmg: 22, cd: 6})],
    text: T('White armour, a white horse, a spear. He calls your name down a narrow cone: who stays in it falls from 吉量 and goes on foot for a while (slower, no spring, no full cry). Four beasts of the Nine-Dragon Isle come with him. Step out of the cone.', '银盔素铠，白马长枪。他朝一道窄锥呼你的名字：留在锥里的人跌下吉量，步行一阵（更慢，不能腾跃，不能冲锋）。九龙岛四只异兽随他而来。踏出呼名之锥。')},
  beast('bian', 'Bian beast', '狴犴', '王魔'), beast('suanni', 'Suanni', '狻猊', '杨森'), beast('leopard', 'Spotted leopard', '花斑豹', '高友乾'), beast('zhengning', 'Zhengning', '狰狞', '李兴霸'),
  // 闻仲's four (ch 42, 51–52)
  officer('dengzhong', 'Deng Zhong', '邓忠', T('of 闻仲\'s four, with the great axe', '闻仲四将之一，阔斧似车轮'), 42, [pat('greatAxe', 'one', {dmg: 24, cd: 5}), pat('wheelAxe', 'ring', {dmg: 22, cd: 6.5})], {r: 27}),
  officer('xinhuan', 'Xin Huan', '辛环', T('of 闻仲\'s four, on wings of flesh, with hammer and chisel', '闻仲四将之一，肉翅飞行，锤钻'), 41, [pat('wingDive', 'charge', {dmg: 22, cd: 6}), pat('hammerDrop', 'one', {dmg: 24, cd: 5.5})], {heavy: false, fly: true}),
  officer('zhangjie', 'Zhang Jie', '张节', T('of 闻仲\'s four, with the spear', '闻仲四将之一，枪传天下'), 42, [pat('spearRun', 'charge', {dmg: 22, cd: 6.5}), pat('spearThrust', 'blast', {dmg: 22, cd: 6, width: 70, warn: 1})], {r: 27}),
  officer('taorong', 'Tao Rong', '陶荣', T('of 闻仲\'s four, with the wind-gathering banner', '闻仲四将之一，聚风幡'), 42, [pat('gatherWind', 'blast', {dmg: 14, cd: 8, leaves: {kind: 'wind', life: 2.5, push: 150}}), pat('twinMaces', 'pair', {dmg: 22, cd: 5.5})], {r: 27}),

  // stretch two, small
  {id: 'yuhua', element: 'fire', name: T('Yu Hua', '余化'), title: T('"Seven Heads", with the Blood-melting Blade and the Soul-slaying Banner', '七首将军，化血神刀、戮魂幡'), treasure: T('Blood-melting Blade', '化血神刀'), ch: 74,
    ai: 'named', tier: 'small', hp: 2600, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    patterns: [pat('bloodBlade', 'pair', {dmg: 18, cd: 6, effect: 'bleed', bleed: 3}), pat('soulBanner', 'cone', {dmg: 22, cd: 7, effect: 'dizzy', time: 2})],
    text: T('The blade flies like lightning: a cut from it bleeds until you ride over one of the two antidotes that fall. The soul-slaying banner looses black vapour down a cone: who is in it cannot spring for a while.', '神刀如电光：中刀之后血流不止，直到骑过落下的两份解药之一。戮魂幡放出黑气成锥：锥中之人一时不能腾跃。')},
  {id: 'chenqi', element: 'earth', name: T('Chen Qi', '陈奇'), title: T('who breathes the yellow vapour, with three thousand flying-tiger soldiers', '腹内黄气，统三千飞虎兵'), treasure: T('the yellow vapour', '黄气'), ch: 73,
    ai: 'named', tier: 'small', hp: 2600, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'flyingTiger', count: 10}],
    patterns: [pat('yellowBreath', 'cone', {dmg: 16, cd: 7, effect: 'soul', time: 3}), pat('pestleRush', 'charge', {dmg: 22, cd: 6}), {id: 'demonPestle', shape: 'summon', kind: 'flyingTiger', count: 6, warn: .8, cd: 8, within: 700}],
    text: T('A breath of yellow vapour down a cone: soldiers and generals in it stand senseless and stop fighting, and you cannot spring. He raises the demon-quelling pestle and his flying-tiger soldiers rush in.', '一口黄气喷成锥：锥中兵将失魂停手，你也不能腾跃。荡魔杵一举，飞虎兵蜂拥而来。')},
  {id: 'lvyue', element: 'water', name: T('Lü Yue', '吕岳'), title: T('Lord of Plagues, three-eyed, with his envoys', '瘟部之主，三目，率行瘟使者'), treasure: T('Plague Umbrella', '瘟㾮伞'), ch: 58,
    ai: 'named', tier: 'small', hp: 2600, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'plague', count: 4}],
    patterns: [pat('plagueUmbrella', 'scatter', {dmg: 10, cd: 8, count: 3, leaves: {kind: 'plague', life: 8, slow: .35, weak: .4}}), pat('plagueBell', 'bands', {dmg: 18, cd: 7})],
    text: T('The plague umbrellas open where they fall: under one you ride slowly and your treasures lose two fifths of their strength. The plague bell sounds in rings. Four envoys come with him.', '瘟㾮伞落处撑开：伞下骑行迟缓，法宝威力减去四成。瘟疫钟声一环一环荡开。四名行瘟使者随他而来。')},
  {id: 'huoling', element: 'fire', name: T('Holy Mother of Fire', '火灵圣母'), title: T('on the golden-eyed camel, with the Golden-glow Crown and three thousand fire-dragon soldiers', '骑金眼驼，金霞冠，统三千火龙兵'), treasure: T('Golden-glow Crown', '金霞冠'), ch: 71,
    ai: 'named', tier: 'small', hp: 2600, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'fireDragon', count: 10}],
    patterns: [{id: 'goldGlow', shape: 'glare', warn: .5, life: 6, cd: 18, within: 800}, pat('taiaSwords', 'pair', {dmg: 24, cd: 5}), pat('dragonCharge', 'blast', {dmg: 24, cd: 6, leaves: {kind: 'fire', life: 3, dmg: 6}})],
    text: T('The golden-glow crown hides her in light: for a while her own warnings are hard to see. Her fire-dragon soldiers charge down a lane and leave it burning.', '金霞冠放光笼住她：一时之间她的预警难以看清。火龙兵沿道冲阵，道上留下烈火。')},
  // stretch three, small
  {id: 'bianji', element: 'water', name: T('Bian Ji', '卞吉'), title: T('with the Bone Banner of Lost Souls', '幽魂白骨幡'), treasure: T('Bone Banner of Lost Souls', '幽魂白骨幡'), ch: 84,
    ai: 'named', tier: 'small', hp: 2600, speed: 96, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'bianGuard', count: 6}],
    patterns: [pat('halberd', 'charge', {dmg: 24, cd: 6}), pat('boneBanner', 'one', {dmg: 14, cd: 5, leaves: {kind: 'bone', life: 14, r: 95, hold: 1.2, dmg: 12}})],
    text: T('He plants the bone banner where you stand: it stays on the field, and whoever rides under it is seized for a moment. Spring through it, or ride round.', '他把白骨幡立在你脚下：幡立在场上，从幡下骑过的人被擒片刻。腾跃穿过，或者绕开。')},
  {id: 'zhangkui', element: 'earth', name: T('Zhang Kui', '张奎'), title: T('on the one-horned smoke beast, who travels under the earth', '骑独角乌烟兽，善地行术'), treasure: T('Earth travel', '地行术'), ch: 86,
    ai: 'named', tier: 'small', hp: 2200, speed: 110, dmg: 20, r: 27, xp: 60, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'gaolanying'}],
    patterns: [pat('fromBelow', 'one', {dmg: 26, cd: 6, burrow: true}), pat('smokeRush', 'rush', {dmg: 26, cd: 6})],
    text: T('He goes under the earth and comes up beneath you: while he travels nothing reaches him; the ground marks where he will rise.', '他潜入地下，从你脚下钻出：潜行时打不着他；地上先显出他要钻出之处。')},
  officer('gaolanying', 'Gao Lanying', '高兰英', T('in white, with two blades and forty-nine sun needles', '一身缟素，双刀，四十九根太阳神针'), 87, [pat('sunNeedles', 'cone', {dmg: 14, cd: 8, effect: 'dazzle', time: 3}), pat('twinSabres', 'pair', {dmg: 22, cd: 5.5})], {hp: 2200, r: 27}),

  // the big bosses of stretches two and three
  {id: 'kongxuan', element: 'metal', name: T('Kong Xuan', '孔宣'), title: T('of the five-coloured light, on a red horse, with a great blade', '五色神光，红马大刀'), treasure: T('Five-coloured Divine Light', '五色神光'), ch: 69,
    ai: 'named', tier: 'big', phases: [1, .6, .3], hp: 180000, armour: 50, speed: 100, dmg: 28, r: 31, xp: 0, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'wasp', count: 16}, {kind: 'wasp', count: 16, phase: 1}],
    patterns: [pat('greatBlade', 'rush', {dmg: 38, cd: 7.5}), pat('fiveLights', 'bands', {great: true, dmg: 24, cd: 8, effect: 'light', time: 12}), pat('lightSweep', 'cone', {dmg: 36, cd: 6, effect: 'light', time: 8, from: 1})],
    text: T('Five lights in five colours: a light that catches you sweeps away your treasures of its element for a while (wood, fire, earth, metal, water in turn). Do not build on one element alone.', '五色神光：被哪一道光刷中，你那一行的法宝便一时失效（木、火、土、金、水依次轮转）。莫只走一系。')},
  {id: 'yuanhong', element: 'metal', name: T('Yuan Hong', '袁洪'), title: T('the White Ape of Plum Mountain, with the iron staff and the Eight-Nine Arts', '梅山白猿，宾铁棍，八九玄功'), treasure: T('Eight-Nine Arts', '八九玄功'), ch: 88,
    ai: 'named', tier: 'big', phases: [1, .66, .33], hp: 600000, weary: 115, armour: 62, speed: 104, dmg: 38, r: 31, xp: 0, elite: true, heavy: true, boss: true, named: true,
    // the finale (SPEC-CAMPAIGN 1.16): the six of 梅山 come with him at once, and while any lives he takes `kin` of every blow
    retinue: [{kind: 'wulong'}, {kind: 'changhao'}, {kind: 'daili'}, {kind: 'jindasheng'}, {kind: 'zhuzizhen'}, {kind: 'yangxian'}], kin: .2,
    patterns: [pat('ironStaff', 'rush', {dmg: 50, cd: 6}), {id: 'stoneForm', shape: 'stone', warn: .4, life: 3, cd: 12, within: 700}, pat('clearWind', 'scatter', {great: true, dmg: 43, cd: 6.8, vanish: true, from: 1}), pat('staffRing', 'ring', {dmg: 43, cd: 4.7})],
    text: T('He comes with all six of 梅山 at once, and the Shang then on the field are the last of their host: none come after them. While any of the six lives he takes only a fifth of every blow: kill them first. Under the blade he turns to stone (blows do little for a while) or to a clear wind (he is gone, and comes back beside you as five blows fall round you). When he falls the Shang left on the field break and flee.', '他与梅山六怪一同现身，此时场上的商军便是最后一批，再无后援。六怪有一个活着，他便只受五分之一的伤害：先除六怪。刀下化为顽石（一时刀枪难伤），或化清风而去（不见踪影，再现于你身旁，同时五处落击）。他一倒下，场上残余商军溃逃。')},
  // 梅山七怪 (ch. 91-92): 袁洪's six, each a small boss of the finale with two warned blows; each leaves a peach, not a chest
  demon('wulong', 'Wu Long', '吴龙', T('the Centipede, who hides in black mist', '蜈蚣精，藏于黑雾'), 91, [pat('blackMist', 'scatter', {dmg: 34, cd: 7}), pat('coil', 'ring', {dmg: 30, cd: 6.5})]),
  demon('changhao', 'Chang Hao', '常昊', T('the White Snake', '白蛇精'), 91, [pat('serpentStrike', 'charge', {dmg: 36, cd: 6}), pat('venom', 'one', {dmg: 24, cd: 8, leaves: {kind: 'plague', life: 6, slow: .3, weak: .3}})]),
  demon('daili', 'Dai Li', '戴礼', T('the Hound, with two blades and a red pearl', '狗精，双刀，口吐红珠'), 92, [pat('redPearl', 'pair', {dmg: 36, cd: 5.5}), pat('houndLeap', 'charge', {dmg: 30, cd: 6})]),
  demon('jindasheng', 'Jin Dasheng', '金大升', T('the Buffalo, who spits ox-bezoar like lightning', '水牛精，喷牛黄如火电'), 92, [pat('bezoar', 'blast', {dmg: 39, cd: 7}), pat('horns', 'rush', {dmg: 34, cd: 7.5})], {r: 27, hp: 90000}),
  demon('zhuzizhen', 'Zhu Zizhen', '朱子真', T('the Boar, who swallows a man whole', '猪精，一口吞人'), 92, [pat('swallow', 'one', {dmg: 31, cd: 7, effect: 'held', time: 1.5, how: 'swallow'}), pat('trample', 'charge', {dmg: 30, cd: 6.5})], {hp: 90000}),
  demon('yangxian', 'Yang Xian', '杨显', T('the Goat, with the halberd and the white light', '羊精，持戟，吐白光'), 92, [pat('whiteLight', 'cone', {dmg: 39, cd: 6.5}), pat('halberdSweep', 'cone', {dmg: 30, cd: 6, radius: 300, angle: 50, within: 260})]),

  // the final boss: 纣王 (research notes section 1; the lead's decision of 2026-11-25). PLACEHOLDER numbers.
  {id: 'zhouwang', element: 'earth', name: T('King Zhou of Shang', '纣王'), title: T('on the Carefree Horse, with the gold-backed blade, who once held up a fallen beam', '骑逍遥马，提金背刀，托梁换柱'), treasure: T('the Gold-backed Blade', '金背刀'), ch: 95,
    ai: 'named', tier: 'final', phases: [1, .6, .25], hp: 280000, cap: 1 / 135, weary: 165, armour: 70, speed: 104, dmg: 32, r: 35, xp: 0, elite: true, heavy: true, boss: true, named: true,
    retinue: [{kind: 'lurenjie'}, {kind: 'leikun'}, {kind: 'leipeng'}, {kind: 'daji'}, {kind: 'ximei'}, {kind: 'wanggui'}],      // all ride out of the gate with him (1.16)
    patterns: [
      pat('goldBlade', 'cone', {dmg: 40, cd: 5}),
      {id: 'holdThree', shape: 'guard', warn: .6, life: 3, cut: 140, cd: 14, within: 520},
      pat('unhorsingShout', 'cone', {dmg: 10, unhorse: 2, cd: 11, angle: 36, radius: 400}),
      pat('pillar', 'one', {great: true, dmg: 44, cd: 7, from: 1, radius: 110, warn: 1.35, leaves: {kind: 'pillar', life: 8, r: 60}}),
      pat('bambooWhip', 'pair', {dmg: 40, cd: 4.5, from: 1})],
    text: T('When 袁洪 has fallen and his remnant fled, the gate of 朝歌 opens and he rides out with all he has left: 鲁仁杰, 雷鹍 and 雷鹏 (while any of the three lives he takes half), the three fox-spirits on their peach-blossom horses, and the last of the 御林军, rank after rank, the second rank held back for his last stand. They are the last: none come after them. Hemmed in, he grows fiercer and brings down a beam. Killing him wins: he withdraws into the Star-plucking Tower as it burns.', '袁洪倒下、残军溃逃之后，朝歌城门大开，他带着最后的一切冲出城来：鲁仁杰、雷鹍、雷鹏护驾（三将有一个在，他便只受一半伤害），三妖骑桃花马随驾，最后的御林军一排接一排，第二排留待他困兽之斗时才出。这便是最后一批，再无后援。困在垓心，越战越勇，托梁换柱。击杀即胜：他退入摘星楼，楼焚。')},
  officer('lurenjie', 'Lu Renjie', '鲁仁杰', T('Grand General of the 御林军, with the spear', '纣王驾下总督兵马大将军，用枪'), 94, [pat('guardSpear', 'charge', {dmg: 30, cd: 6})], {hp: 27000, armour: 48, guard: true}),
  officer('leikun', 'Lei Kun', '雷鹍', T('the king\'s left wing', '纣王左翼'), 95, [pat('leftWing', 'pair', {dmg: 28, cd: 5.5})], {hp: 24000, armour: 46, guard: true}),
  officer('leipeng', 'Lei Peng', '雷鹏', T('the king\'s right wing', '纣王右翼'), 95, [pat('rightWing', 'blast', {dmg: 28, cd: 7})], {hp: 24000, armour: 46, guard: true}),
  officer('daji', 'Daji', '妲己', T('the nine-tailed fox, with two blades, on a peach-blossom horse', '九尾狐，双刀，骑桃花马'), 96, [pat('twinBlades', 'pair', {dmg: 30, cd: 5})], {hp: 27000, armour: 46}),
  officer('ximei', 'Hu Ximei', '胡喜媚', T('the pheasant spirit, with two swords, on a peach-blossom horse', '九头雉鸡精，两口宝剑，骑桃花马'), 96, [pat('twinSwords', 'cone', {dmg: 30, cd: 6})], {hp: 24000, armour: 46}),
  officer('wanggui', 'Lady Wang', '王贵人', T('the jade-pipa spirit, with the embroidered blade, on a peach-blossom horse', '玉石琵琶精，绣鸾刀，骑桃花马'), 96, [pat('embroideredBlade', 'charge', {dmg: 30, cd: 6})], {hp: 24000, armour: 46}),
);
