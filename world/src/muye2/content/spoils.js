// Spoils (战利品): every small and big boss leaves his own power, turned to the hero's use. Held outside the slots, no
// levels, never offered. Owner: rules·build (B). Contract: lab/game-studies/SPEC-CAMPAIGN.md section 2.11; the book's
// words for each are in research_notes/Fengshen campaign research.md section 5 (chapter in `ch`).
//
// `from` is the boss's kind (A's BY.foe ids); `tier` 'small' | 'big'. The numbers are read by sim/spoils.js; `cd` is the
// seconds between one working and the next.

import {T} from './base.js';

export const spoils = [
  {id: 'qingyunSword', from: 'moliqing', tier: 'small', ch: [40], name: T('Blue Cloud Sword', '青云剑'),
    cd: 6, radius: 260, dmg: 90,
    text: T('Every 6 s a black wind full of blades spins out from you, cutting everything within 260 px.', '每 6 秒，一阵夹着万千戈矛的黑风从你身边卷出，斩切 260 像素内的一切。')},
  {id: 'hunyuanUmbrella', from: 'molihong', tier: 'small', ch: [40], name: T('Umbrella of Chaos', '混元伞'),
    radius: 170, every: 8, burst: {radius: 120, dmg: 120},
    text: T('The umbrella opens over you: every Shang shot that comes within 170 px is swallowed, and every eighth comes back as a burst of light on the densest group.', '混元伞撑开在你头上：射进 170 像素内的商军箭与火尽被收去，每收八支就化作一团光砸向最密的敌群。')},
  {id: 'jadePipa', from: 'molihai', tier: 'small', ch: [40], name: T('Jade Lute', '碧玉琵琶'),
    cd: 7, count: 3, radius: 110, dmg: 70, push: 120, burnDps: 25, burnLife: 3,
    text: T('Every 7 s the lute is plucked: wind and fire come together on the three densest groups, throwing them back and leaving the ground burning.', '每 7 秒拨动琵琶：风火齐至，落在最密的三处敌群，把他们掀开，地上烧起火来。')},
  {id: 'marten', from: 'molishou', tier: 'small', ch: [40], name: T('Flower-fox Marten', '花狐貂'),
    cd: 1, range: 420, devour: .4, dmg: 60,
    text: T('A white winged beast hunts round you: every second it leaps on a foe within 420 px; a common foe under 40% health is devoured whole, any other is bitten hard.', '一头生翅的白貂绕着你捕猎：每秒扑向 420 像素内的一个敌人；生命不足四成的寻常敌兵被整个吞下，其余被狠狠咬伤。')},
  {id: 'callName', from: 'zhangguifang', tier: 'small', ch: [36], name: T('Calling the Name', '呼名落马'),
    cd: 7, range: 520, stun: 2.5, bossStun: 1, expose: .5, exposeTime: 4, riders: 200, riderKinds: ['cavalry', 'chariot', 'flyingTiger'],
    text: T('Every 7 s you call the strongest elite or named foe in reach by name: he falls stunned and every blow on him is 50% harder for 4 s; every rider near him falls with him.', '每 7 秒，你呼出范围内最强的精英或名将之名：他应声落马被震晕，4 秒内所受每一击重五成；他身边的骑兵一同落马。')},
  {id: 'goldWhips', from: 'wenzhong', tier: 'big', ch: [41], name: T('Paired Gold Whips', '雌雄金鞭'),
    cd: 3, count: 2, range: 600, dmg: 220, chain: 3, chainRange: 220, chainShare: .5,
    text: T('Every 3 s two gold whips fall on the two strongest foes, and each blow leaps on to three more.', '每 3 秒，雌雄两根金鞭落在最强的两个敌人身上，每一鞭再跳向另外三个。')},
  {id: 'bloodBlade', from: 'yuhua', tier: 'small', ch: [74, 75], name: T('Blood-melting Blade', '化血神刀'),
    cd: 5, length: 420, width: 40, dmg: 60, bleed: .04, bossBleed: .01, bleedTime: 5,
    text: T('Every 5 s the blade flashes through the densest line: those it cuts bleed 4% of their greatest health a second for 5 s (a named foe 1%).', '每 5 秒，神刀化一道电光劈过最密的一线：被劈中的敌人 5 秒内每秒失去最大生命的 4%（名将 1%）。')},
  {id: 'yellowBreath', from: 'chenqi', tier: 'small', ch: [73, 74], name: T('Yellow Breath', '腹中黄气'),
    radius: 150, slow: .5, every: 2, stun: .6,
    text: T('A ring of yellow breath round you: foes within 150 px move at half speed, and every 2 s it takes their souls for a moment.', '一圈黄气环绕着你：150 像素内的敌人行动减半，每 2 秒被摄去魂魄片刻。')},
  {id: 'plague', from: 'lvyue', tier: 'small', ch: [58, 80], name: T('Plague Umbrella', '瘟㾮伞'),
    cd: 6, radius: 170, life: 6, dps: 60, slow: .35,
    text: T('Every 6 s a plague cloud falls on the densest group: for 6 s it eats at those inside and slows them.', '每 6 秒，一团瘟气落向最密的敌群：6 秒内侵蚀其中的敌人并拖慢他们。')},
  {id: 'goldenCrown', from: 'huoling', tier: 'small', ch: [71, 72], name: T('Golden-glow Crown', '金霞冠'),
    cd: 10, radius: 600, stun: 1.5, bossStun: .5, safe: 1.5,
    text: T('Every 10 s the crown blazes: every foe within 600 px is blinded for 1.5 s, and nothing can strike you for as long.', '每 10 秒金霞冠放光：600 像素内的敌人目盲 1.5 秒，这段时间里谁也打不着你。')},
  {id: 'boneBanner', from: 'bianji', tier: 'small', ch: [84, 85], name: T('Bone Banner of Lost Souls', '幽魂白骨幡'),
    cd: 9, radius: 110, life: 7, hold: .5,
    text: T('Every 9 s the banner is planted where you are, for 7 s: a common foe that comes under it falls and is taken; an elite under it is held fast.', '每 9 秒在你所在之处立起白骨幡，立 7 秒：走到幡下的寻常敌兵连人带马倒下被擒；精英在幡下被定住。')},
  {id: 'earthTravel', from: 'zhangkui', tier: 'small', ch: [86, 87], name: T('Travelling under the Earth', '地行术'),
    dashCd: .5, radius: 140, dmg: 150, stun: 1,
    text: T('Your spring comes back twice as fast and goes under the ground; where you come up the earth bursts and stuns all round.', '纵跃冷却减半，并从地下穿行；钻出之处地面炸开，震晕四周。')},
  {id: 'fiveLights', from: 'kongxuan', tier: 'big', ch: [69, 70], name: T('Five-coloured Light', '五色神光'),
    cd: 12, radius: 320, angle: 140, share: .2, bossShare: .08,
    text: T('Every 12 s the five-coloured light sweeps a wide fan toward the foe: every common foe in it is taken into the light, every elite loses a fifth of his greatest health, a named foe a twelfth.', '每 12 秒五色神光朝敌人刷出一大片扇面：其中的寻常敌兵尽被收入光中，精英失去最大生命的五分之一，名将失去十二分之一。')},
  {id: 'changeForm', from: 'yuanhong', tier: 'big', ch: [92, 93], name: T('Eight-Nine Changes', '八九玄功'),
    speed: .15, cd: 40, stone: 2, back: .4,
    text: T('You ride 15% faster, as clear wind; and a blow that would take your last health turns you to stone instead: untouched for 2 s, then back with 40% of your health (once every 40 s).', '骑行快 15%，化作清风；致命一击会把你化作怪石：2 秒内刀枪不入，随后以四成生命复原（每 40 秒一次）。')},
];
