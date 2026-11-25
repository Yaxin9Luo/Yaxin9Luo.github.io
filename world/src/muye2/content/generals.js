// The generals (将): named figures of Zhou who fight beside the hero, five levels and a true form. Owner: rules·build (B).

import {T} from './base.js';

// A general (将) is one named figure of the Zhou camp who fights beside the hero by himself. Mounts, weapons and
// treasures are the novel's, from research_notes/Fengshen content catalogue.md; where the book gives none (杨戬's
// mount), none is named; research_notes/Fengshen campaign research.md section 4 is the list of what each did, and
// SPEC-CAMPAIGN.md section 2.2 the one thing each does that nobody else does. `seek` is whom he goes for: 'cluster'
// (the densest group), 'elite' (an elite, else the strongest foe), 'named' (the named foe with the most health, else
// an elite, else the densest group), 'hero' (he keeps by the hero), 'rear' (behind the hero, away from the mass),
// 'front' (at the head of the squads). `fly` and `aloof`: the mass does not touch him. `station`: where he keeps when he has
// no quarry, as an angle from the side the mass is on (0 = toward it, π = behind the hero) and a distance; each his own,
// so that several generals never bury the hero (SPEC-CAMPAIGN 2.2a). `r`: about 20 mounted (ox, qilin, beast, luan, horse),
// 15 on foot or on wheels and wings, 12 for 土行孙 (four feet tall), to fit the painted figures (A, 2026-11-25). `attack` is his plain blow, `skill` what he does besides, both attacks of a shape. Levels 2
// to 5 each make him `grow` harder-hitting and tougher and change what the level's words say; the true form
// (显圣) comes by a chest at level 5.

// 杨戬's bane: what changes its shape or is a beast in a man's form (41: he became the marten; 92: the 梅山 seven)
export const BEASTS = ['marten', 'yuanhong', 'wulong', 'changhao', 'daili', 'jindasheng', 'zhuzizhen', 'yangxian', 'centipede', 'snake', 'boar', 'goat', 'dog', 'buffalo'];
export const general = o => ({...o, levels: o.levels.map((text, i) => ({text, ...(o.steps[i] || {})}))});
export const generals = [
  general({
    id: 'nezha', element: 'fire', name: T('Nezha', '哪吒'), mount: T('the Wind-fire Wheels', '风火轮'), weapon: T('the Fire-tipped Spear', '火尖枪'),
    treasures: ['乾坤圈', '混天绫'], patronOf: [], echoes: ['fireSpear', 'ring', 'sash', 'fireCover'], station: {angle: 0.55, dist: 260}, seek: 'cluster', fly: true, hp: 260, r: 15, speed: 400,
    attack: {shape: 'line', cd: .75, dmg: 26, length: 150, width: 30, count: 1},
    skill: {id: 'ringAndSash', name: T('Ring and Sash', '圈绫并用'), shape: 'arc', cd: 4.5, dmg: 30, radius: 150, angle: 220, push: 90, ring: {dmg: 30, bounces: 4, hop: 240, speed: 520, r: 15, life: 3}},
    steps: [{}, {}, {skillCd: 3.6}, {}, {count: 2}],
    levels: [
      T('Nezha darts between groups on the Wind-fire Wheels and thrusts with the Fire-tipped Spear; now and then he throws the Universe Ring and sweeps the Armillary Sash. While he is with you, your own Fire-tipped Spear, Universe Ring, Armillary Sash and Nine-dragon Fire Cover also strike from where he stands, at two fifths of their strength.', '哪吒脚踏风火轮穿梭于敌群之间，以火尖枪刺敌，不时掷出乾坤圈、甩开混天绫。有他在场，你自己的火尖枪、乾坤圈、混天绫、九龙神火罩也会从他所在之处再出手一次，威力为四成。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He throws the ring and sweeps the sash more often.', '他掷圈甩绫更勤。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He thrusts at two foes at once.', '他同时刺向两个敌人。'),
    ],
    trueForm: {id: 'threeHeadsEightArms', great: true, name: T('Three Heads, Eight Arms', '三头八臂'), count: 4, skillCd: 2.6, radiusUp: 1.3, full: true,
      text: T('After the three fire dates he shows three heads and eight arms: every arm a weapon, spear thrusts on all sides, the sash a full circle.', '吃下三枚火枣后现出三头八臂：每只手一件兵器，四面出枪，混天绫甩成整圈。')},
  }),
  general({
    id: 'yangjian', element: 'metal', name: T('Yang Jian', '杨戬'), mount: null, weapon: T('the three-pointed, two-edged blade', '三尖两刃刀'),
    treasures: ['哮天犬'], patronOf: ['spears'], station: {angle: 1.25, dist: 200}, seek: 'elite', hp: 320, r: 19, speed: 340,
    attack: {shape: 'arc', cd: .85, dmg: 46, radius: 100, angle: 150, push: 0, eliteMult: 1.6, range: 80, bane: BEASTS, baneMult: 2},
    skill: {id: 'houndHunt', name: T('The Heaven-barking Hound', '哮天犬'), shape: 'hound', cd: 2.4, dmg: 80, count: 1, range: 640},
    steps: [{}, {}, {count: 2}, {}, {skillCd: 1.8}],
    levels: [
      T('Yang Jian seeks out elites and duels them with the three-pointed blade, which bites them harder; his Heaven-barking Hound runs down archers and shamans far off. Beasts and shape-changers (the marten, the Meishan kinds) take twice from blade and hound.', '杨戬专找精英，以三尖两刃刀与之单挑，对精英伤害更高；哮天犬扑杀远处的弓手与巫。妖兽与变化之物（花狐貂、梅山诸怪）在他刀下、犬口受伤加倍。'),
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
    treasures: [], patronOf: ['archers'], station: {angle: -0.7, dist: 240}, seek: 'cluster', fly: true, hp: 240, r: 15, speed: 380,
    attack: {shape: 'drop', pick: 'strongest', cd: 1.1, dmg: 32, count: 1, radius: 62, delay: 0, range: 110},
    skill: {id: 'thunderDive', name: T('Thunder Dive', '风雷俯冲'), shape: 'line', cd: 6, dmg: 64, length: 380, width: 64, count: 1, stun: .5, smash: null},
    steps: [{}, {}, {smash: {radius: 110, dmg: 80, stun: 1}, skillCd: 5}, {}, {width: 90}],
    levels: [
      T('Leizhenzi flies over the mass on his wings of wind and thunder, strikes down with the Golden Staff, and dives with thunder along a line through the thickest of them.', '雷震子展开风雷二翅飞越敌群，以黄金棍下击，并挟雷声沿一线俯冲穿过最密之处。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('Where the dive ends his staff brings down a mountain-top: a heavy fall that stuns all round, and he dives more often.', '俯冲尽处一棍打下山尖：重重砸落，震晕四周；他俯冲也更勤。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The dive is broader.', '俯冲的一线更宽。'),
    ],
    trueForm: {id: 'stormWings', great: true, name: T('Storm on the Wing', '风雷随身'), storm: {radius: 150, dps: 34}, skillCd: 4,
      text: T('A storm goes with him: a cloud that moves where he flies and strikes everything under it.', '风雷随身：一团雷云跟着他移动，击打云下的一切。')},
  }),
  general({
    id: 'tuxingsun', element: 'earth', name: T('Tu Xingsun', '土行孙'), mount: null, weapon: T('the iron staff', '宾铁棍'),
    treasures: ['捆仙绳'], patronOf: ['strongmen', 'shields'], station: {angle: -1.3, dist: 170}, seek: 'elite', under: true, ropeUp: 1.5, hp: 280, r: 12, speed: 360,
    attack: {shape: 'arc', cd: .8, dmg: 42, radius: 74, angle: 360, push: 0, range: 56},
    skill: {id: 'bindingRope', name: T('The Immortal-binding Rope', '捆仙绳'), shape: 'bindOne', cd: 6, dmg: 95, hold: 3, range: 620},
    steps: [{}, {}, {hold: 3.8}, {}, {skillCd: 5.4}],
    levels: [
      T('Tu Xingsun travels under the ground, comes up beneath an elite and binds it with the Immortal-binding Rope, then lays about him with his iron staff. While he is with you, your own Immortal-binding Rope holds half as long again.', '土行孙施展地行术潜入地下，从精英脚下钻出，以捆仙绳将其捆住，再抡起宾铁棍乱打。有他在场，你自己的捆仙绳多捆一半时间。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The rope holds longer.', '捆仙绳捆得更久。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He binds more often.', '他出绳更勤。'),
    ],
    trueForm: {id: 'earthOpens', great: true, name: T('The Earth Opens', '地裂'), quake: {count: 3, radius: 125, dmg: 90, hold: 2.5}, skillCd: 5,
      text: T('When he binds, the ground opens under three whole groups and holds everyone in it.', '他出绳时，三处敌群脚下的大地同时裂开，把其中的敌人全部陷住。')},
  }),
  general({
    id: 'dengchanyu', element: 'water', name: T('Deng Chanyu', '邓婵玉'), mount: null, weapon: T('her blade', '刀'),
    treasures: ['五光石'], patronOf: [], station: {angle: 1.75, dist: 180}, seek: 'hero', hp: 200, r: 19, speed: 340,
    attack: {shape: 'stone', cd: 1, dmg: 48, range: 540, stun: 1.2, speed: 720, r: 9, interrupt: true},
    skill: {id: 'fiveStones', name: T('Five Stones', '连珠五石'), shape: 'stone', cd: 5, dmg: 48, range: 560, stun: 1.2, speed: 720, r: 9, count: 5, interrupt: true},
    steps: [{}, {}, {stun: 1.6}, {}, {skillCd: 4.5}],
    levels: [
      T('Deng Chanyu rides by you and throws five-light stones a long way, straight at the face: one stone stuns one foe, and she aims first at whatever is winding up a blow, so that it breaks off.', '邓婵玉随你而行，远远掷出五光石，专打面门：一石震晕一敌，并优先打向正在蓄力出手的敌人，打断其出招。'),
      T('She hits harder and stands more.', '她打得更重，也更耐打。'),
      T('A stone stuns longer.', '五光石震晕得更久。'),
      T('She hits harder and stands more.', '她打得更重，也更耐打。'),
      T('She throws five at once more often.', '她连掷五石更勤。'),
    ],
    trueForm: {id: 'fiveLights', great: true, name: T('The Five Lights', '五光齐放'), blind: {angle: 130, radius: 440, dmg: 46, stun: 2}, skillCd: 7,
      text: T('The stones blaze together: a fan of five lights that blinds the whole side the foes are thickest on.', '五石齐放光华：一片扇形的五色光，让敌人最密的整整一侧目不能视。')},
  }),
  general({
    id: 'huangfeihu', element: 'earth', name: T('Huang Feihu', '黄飞虎'), mount: T('the Five-coloured Divine Ox', '五色神牛'), weapon: T('his spear', '枪'),
    treasures: [], patronOf: ['chariots', 'ironRiders'], station: {angle: 0, dist: 150}, seek: 'front', hp: 380, r: 20, speed: 330,
    attack: {shape: 'line', cd: .8, dmg: 48, length: 150, width: 34, count: 1},
    skill: {id: 'oxCharge', name: T('Charge of the Divine Ox', '神牛冲阵'), shape: 'charge', cd: 8, dmg: 70, length: 380, width: 70, push: 120, stun: .5, time: .5},
    aura: {radius: 280, dmg: .15, guard: .2},
    steps: [{}, {aura: {radius: 280, dmg: .2, guard: .2}}, {skillCd: 8}, {aura: {radius: 320, dmg: .25, guard: .3}}, {aura: {radius: 320, dmg: .3, guard: .3}}],
    levels: [
      T('Huang Feihu fights at the head of your squads on the Five-coloured Divine Ox. Every squad near him hits harder and takes less; now and then the ox charges down a lane through the thickest of the foe, throwing everything aside.', '黄飞虎骑五色神牛在你的兵阵最前方作战。他身边的每一队都打得更重、受伤更少；神牛不时沿一条道冲过最密的敌群，把一切撞开。'),
      T('The squads near him hit harder still.', '他身边的兵阵打得更重。'),
      T('The ox charges more often.', '神牛冲阵更勤。'),
      T('His presence reaches further and the squads near him take less.', '他的威势传得更远，身边兵阵受伤更少。'),
      T('The squads near him hit harder still.', '他身边的兵阵打得更重。'),
    ],
    trueForm: {id: 'kingWucheng', great: true, name: T('Prince Wucheng', '武成王'), aura: {radius: 5000, dmg: .35, guard: .35}, back: true,
      text: T('As Prince Wucheng his presence has no edge: every squad on the field hits harder and takes less, and the ox charges out and back down the same lane.', '武成王亲临：威势遍及全军，每一队都打得更重、受伤更少；神牛沿同一条道冲出又冲回。')},
  }),
  general({
    // 姜子牙 (38, 39, 48, 53, 67): commands the host and never fights hand to hand. While he is on the field the
    // formation takes its `commanded` numbers and the hero's 打神鞭 and 杏黄旗 grow stronger (`presence`).
    // element water: 冰冻岐山 (39), the fisherman of 渭水; and the 玉虚门人 he blesses are water
    id: 'jiangziya', element: 'water', name: T('Jiang Ziya', '姜子牙'), mount: T('the Four-unlike', '四不相'), weapon: T('the paired swords', '雌雄宝剑'),
    treasures: ['打神鞭', '杏黄旗', '封神榜'], patronOf: ['disciples', 'yamen'], station: {angle: 2.6, dist: 150}, seek: 'rear', aloof: true, hp: 300, r: 20, speed: 340,
    presence: {whip: {up: .35, count: 1}, banner: {sooner: .4}},
    attack: {shape: 'drop', pick: 'strongest', cd: 1.3, dmg: 75, count: 2, radius: 85, delay: .35, range: 520, stun: .35},   // the Five Thunders: two bolts
    skill: {id: 'command', name: T('The Marshal\'s Command', '号令'), shape: 'command', cd: 9, haste: .5, nail: null},
    steps: [{}, {}, {haste: .67}, {}, {nail: {expose: .3, time: 7, range: 800}}],
    levels: [
      T('Jiang Ziya rides the Four-unlike behind you and calls down the Five Thunders on the two strongest foes in reach. His command brings every squad\'s skill round by half its time; while he is with you the formation stands at its best, your God-beating Whip strikes harder and one foe more, and your Apricot-yellow Banner returns sooner. He never fights hand to hand.', '姜子牙骑四不相随在你身后，以五雷正法击打范围内最强的两个敌人。他一声号令，各队技能的冷却减半；有他在场，阵法更精，你的打神鞭打得更重、多打一个敌人，杏黄旗复原更快。他从不近身厮杀。'),
      T('His thunder falls harder and he stands more.', '他的雷法更重，也更耐打。'),
      T('His command cuts two thirds of every squad\'s wait.', '号令让各队技能的冷却缩短三分之二。'),
      T('His thunder falls harder and he stands more.', '他的雷法更重，也更耐打。'),
      T('The Nailing Book of Seven Arrows: his command also nails the named foe with the most health, and for 7 s every blow on him is 30% harder.', '钉头七箭书：号令时一并钉住血最多的名将，7 秒内他所受的每一击都重三成。'),
    ],
    trueForm: {id: 'marshal', name: T('Invested at the Golden Terrace', '金台拜将'), allSkills: true, nail: {expose: .4, time: 7, range: 800}, skillCd: 7,
      text: T('Invested as marshal at the golden terrace: his command fires every squad\'s skill at once, and the nail makes every blow 40% harder.', '金台拜将，执掌帅印：一声号令，所有兵阵的技能同时发动；七箭书让名将所受每一击重四成。')},
  }),
  general({
    // 郑伦 (3, 57, 74, 76): the white light from his nose takes the soul; his crow soldiers come up and bind.
    id: 'zhenglun', element: 'metal', name: T('Zheng Lun', '郑伦'), mount: T('the Fire-eyed Golden-pupil Beast', '火眼金睛兽'), weapon: T('two demon-quelling pestles', '两柄降魔杵'),
    treasures: [], patronOf: ['crows'], station: {angle: 0.25, dist: 210}, seek: 'cluster', hp: 340, r: 20, speed: 330,
    attack: {shape: 'arc', cd: .9, dmg: 40, angle: 360, radius: 70, push: 0, range: 50},
    skill: {id: 'whiteLight', name: T('White Light from the Nose', '鼻中白光'), shape: 'snort', cd: 6, dmg: 20, radius: 360, angle: 70, daze: 2, capture: .25},
    steps: [{}, {}, {capture: .34}, {}, {angle: 100}],
    levels: [
      T('Zheng Lun rides into the thick of them and swings his two pestles all round. Now and then he snorts: two beams of white light from his nose, and every foe in them loses its soul for two seconds; a common foe in them with less than a quarter of its health is captured outright. If your crow soldiers are on the field they throw their hooks into the light at once.', '郑伦冲入敌群，两柄降魔杵四面横扫。他不时鼻中一哼，喷出两道白光：光中的敌人失魂两秒；光中生命不足四分之一的寻常敌兵当场被擒。若乌鸦兵在场，他们立刻向白光中抛出挠钩。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He captures those with less than a third of their health.', '生命不足三分之一的敌兵也会被擒。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The light spreads wider.', '白光散得更宽。'),
    ],
    trueForm: {id: 'soulLight', great: true, name: T('The Soul-taking Light', '白光摄魄'), full: true, capture: .5,
      text: T('The light goes out all round him, and takes any common foe with less than half its health.', '白光向四面八方喷出，生命不足一半的寻常敌兵尽数被擒。')},
  }),
  general({
    // 龙吉公主 (64, 66, 70–71): the Fog-and-dew Net and the Vase of the Four Seas took the fire of 罗宣; the
    // Dragon-binding Rope, and the yellow-turban strongmen who carry off whom it binds.
    id: 'longji', element: 'water', name: T('Princess Longji', '龙吉公主'), mount: T('the blue luan bird', '青鸾'), weapon: T('the Luan-flight Sword', '鸾飞剑'),
    treasures: ['雾露乾坤网', '四海瓶', '捆龙索'], patronOf: [], station: {angle: -1.95, dist: 165}, seek: 'hero', fly: true, hp: 230, r: 19, speed: 380,
    attack: {shape: 'throw', target: 'nearest', cd: .8, dmg: 55, count: 2, speed: 640, r: 12, range: 480, life: 1.2, pierce: 3, bounces: 0, hop: 0},
    skill: {id: 'fourSeas', name: T('The Vase of the Four Seas', '四海瓶'), shape: 'vase', cd: 5, dmg: 30, radius: 300, range: 420, hold: 1.5, net: {radius: 140, every: .5}},
    steps: [{}, {}, {net: {radius: 180, every: .3}}, {}, {radius: 420}],
    levels: [
      T('Princess Longji flies by you on her blue luan and sends the Luan-flight Sword through the nearest foes. Her Fog-and-dew Net catches Shang arrows and fire that come near you, a few a second; now and then she opens the Vase of the Four Seas, which swallows every Shang shot round you and puts out their burning ground, and binds the strongest foe near with the Dragon-binding Rope.', '龙吉公主乘青鸾随你而飞，鸾飞剑穿过最近的敌人。她的雾露乾坤网每秒兜住几支射向你附近的商军箭矢与火；她不时打开四海瓶，把你四周商军的箭与火尽数收入瓶中，扑灭他们的火地，再以捆龙索捆住附近最强的敌人。'),
      T('She strikes harder and stands more.', '她打得更重，也更耐打。'),
      T('The net is wider and catches more each second.', '雾露乾坤网张得更开，每秒兜住更多。'),
      T('She strikes harder and stands more.', '她打得更重，也更耐打。'),
      T('The vase draws from further away.', '四海瓶收得更远。'),
    ],
    trueForm: {id: 'allSeas', great: true, name: T('All the Four Seas in the Vase', '四海归瓶'), all: true, pour: {dmg: 40, radius: 80},
      text: T('The vase swallows every Shang shot on the field and pours it back as water on the densest groups.', '四海瓶收尽满场商军的箭与火，再化作大水倾向最密的敌群。')},
  }),
  general({
    // 黄天化 (32, 40–41, 53): the Heart-piercing Nail, seven inches and five tenths, that went through 魔礼青's heart.
    id: 'huangtianhua', element: 'fire', name: T('Huang Tianhua', '黄天化'), mount: T('the Jade Qilin', '玉麒麟'), weapon: T('two silver hammers', '两柄银锤'),
    treasures: ['攒心钉', '莫耶宝剑', '火龙标'], patronOf: [], station: {angle: -0.3, dist: 225}, seek: 'named', fly: true, hp: 300, r: 20, speed: 360,
    attack: {shape: 'arc', cd: .8, dmg: 44, angle: 180, radius: 80, push: 20, range: 60},
    skill: {id: 'heartNail', name: T('The Heart-piercing Nail', '攒心钉'), shape: 'nail', cd: 7, dmg: 60, share: .025, length: 700, width: 30, count: 1},
    steps: [{}, {}, {share: .035}, {}, {skillCd: 5.5}],
    levels: [
      T('Huang Tianhua rides the wind on the Jade Qilin straight for the named foe with the most health, and beats about him with two silver hammers. Now and then he throws the Heart-piercing Nail: it goes through everything on its line, and its mark loses 2.5% of his greatest health besides the blow.', '黄天化骑玉麒麟乘风直取血最多的名将，两柄银锤左右开弓。他不时祭出攒心钉：钉穿一线上的一切，所中之敌除伤害外再失去最大生命的 2.5%。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('The nail takes 3.5% of the greatest health.', '攒心钉取走最大生命的 3.5%。'),
      T('He hits harder and stands more.', '他打得更重，也更耐打。'),
      T('He throws the nail more often.', '他祭钉更勤。'),
    ],
    trueForm: {id: 'piercingLight', name: T('Light Through the Heart', '华光穿心'), count: 3, share: .05,
      text: T('Three nails in a row, each taking 5% of the greatest health.', '连发三钉，每一钉取走最大生命的 5%。')},
  }),
];
