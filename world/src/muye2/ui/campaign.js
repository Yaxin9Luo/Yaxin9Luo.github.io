// The page's reading of the campaign (lab/game-studies/SPEC-CAMPAIGN.md section 1). The rules own the campaign; this
// file only reads it. Where the rules do not yet export a piece of the contract, a stand-in with the contract's own
// names and shapes is used, so the page can be built and checked before the rules land. Every stand-in is marked.

/** SPEC-CAMPAIGN 1.1, as published. Used only while `sim.CAMPAIGN` is missing. */
export const CAMPAIGN_STANDIN = {
  stretches: [
    {index: 0, id: 'xiqi', name: {en: 'The Siege of Xiqi', zh: '西岐之围'}, from: 0, small: [210, 420], pool: ['zhangguifang', 'mojia'], big: {t: 600, kind: 'wenzhong'}},
    {index: 1, id: 'passes', name: {en: 'The Eastern Passes', zh: '东征诸关'}, from: 600, small: [810, 1020], pool: ['yuhua', 'chenqi', 'lvyue', 'huoling'], big: {t: 1200, kind: 'kongxuan'}},
    {index: 2, id: 'zhaoge', name: {en: 'At the Gates of Zhaoge', zh: '兵临朝歌'}, from: 1200, small: [1410, 1620], pool: ['bianji', 'zhangkui'], big: {t: 1800, kind: 'yuanhong'}},
  ],
  final: {index: 3, id: 'walls', name: {en: 'Beneath the Walls of Zhaoge', zh: '朝歌城下'}, after: 'yuanhong', kind: 'zhouwang'},
  march: 4, enrage: 120,
};
/** Names the rules' foe table may not have yet (SPEC-CAMPAIGN 1.4). Only a fallback: `BY.foe[kind].name / .title` wins. */
/** Each spoil's sign (SPEC-CAMPAIGN 2.11 gives none): one character of the thing itself. */
export const SPOIL_SIGN = {qingyunSword: '剑', hunyuanUmbrella: '伞', jadePipa: '琶', marten: '貂', callName: '呼', goldWhips: '鞭', bloodBlade: '刀', yellowBreath: '气', plague: '瘟', goldenCrown: '冠', boneBanner: '幡', earthTravel: '遁', fiveLights: '光', changeForm: '变'};
export const BOSS_NAMES = {
  zhangguifang: {name: {en: 'Zhang Guifang', zh: '张桂芳'}, title: {en: 'Commander of Green Dragon Pass, who calls men from their horses', zh: '青龙关总兵，呼名落马'}},
  wenzhong: {name: {en: 'Wen Zhong', zh: '闻仲'}, title: {en: 'Grand Tutor of Shang, on the black qilin', zh: '商朝太师，骑墨麒麟'}},
  kongxuan: {name: {en: 'Kong Xuan', zh: '孔宣'}, title: {en: 'Of the five-coloured light', zh: '五色神光'}},
  yuanhong: {name: {en: 'Yuan Hong', zh: '袁洪'}, title: {en: 'The white ape of Meishan', zh: '梅山白猿'}},
  zhouwang: {name: {en: 'King Zhou of Shang', zh: '纣王'}, title: {en: 'Son of Heaven, who could hold up a falling beam', zh: '天子，托梁换柱'}},
  dengzhong: {name: {en: 'Deng Zhong', zh: '邓忠'}}, xinhuan: {name: {en: 'Xin Huan', zh: '辛环'}}, zhangjie: {name: {en: 'Zhang Jie', zh: '张节'}}, taorong: {name: {en: 'Tao Rong', zh: '陶荣'}},
  yuhua: {name: {en: 'Yu Hua', zh: '余化'}}, chenqi: {name: {en: 'Chen Qi', zh: '陈奇'}}, lvyue: {name: {en: 'Lü Yue', zh: '吕岳'}}, huoling: {name: {en: 'Holy Mother Huoling', zh: '火灵圣母'}},
  bianji: {name: {en: 'Bian Ji', zh: '卞吉'}}, zhangkui: {name: {en: 'Zhang Kui', zh: '张奎'}}, gaolanying: {name: {en: 'Gao Lanying', zh: '高兰英'}},
  lurenjie: {name: {en: 'Lu Renjie', zh: '鲁仁杰'}}, leikun: {name: {en: 'Lei Kun', zh: '雷鹍'}}, leipeng: {name: {en: 'Lei Peng', zh: '雷鹏'}},
  daji: {name: {en: 'Daji', zh: '妲己'}}, ximei: {name: {en: 'Hu Ximei', zh: '胡喜媚'}}, wanggui: {name: {en: 'Lady Wang', zh: '王贵人'}},
};
const BIG = new Set(['wenzhong', 'kongxuan', 'yuanhong']);
/** Default phase shares by tier, used only when a unit carries no `phases` (SPEC-CAMPAIGN 1.2 gives the shape). */
const PHASES = {final: [1, .6, .25], big: [1, .6, .3], small: [1, .5], lieutenant: [1], elite: [1]};

export function campaignTable(sim) { return sim && sim.CAMPAIGN ? sim.CAMPAIGN : CAMPAIGN_STANDIN; }
/** The full length of the timeline in seconds: the last big boss, plus room for the final. */
export function runLength(C) { const last = C.stretches[C.stretches.length - 1]; return last.big.t; }

/** A foe's tier as the page draws it: the rules' `tier` if present, else read from what the unit is. '' for the plain mass. */
export function tierOf(u) {
  if (u.tier) return u.tier;
  if (u.kind === 'zhouwang') return 'final';
  if (u.named) return BIG.has(u.kind) ? 'big' : 'small';
  return u.elite || u.retinue ? 'elite' : '';
}
export const phasesOf = u => Array.isArray(u.phases) && u.phases.length ? u.phases : PHASES[tierOf(u)] || [1];
export function nameOf(sim, kind, lang) {
  const r = sim && sim.BY && sim.BY.foe && sim.BY.foe[kind], f = BOSS_NAMES[kind] || {};
  const name = (r && r.name) || f.name, title = (r && r.title) || f.title;
  return {name: name ? name[lang] || name.en : kind, title: title ? title[lang] || title.en : '', zhName: name ? name.zh : kind};
}

/** What the page needs to know of the campaign this frame: the rules' `g.campaign` when it exists, else a stand-in read from the clock and the field. */
export function campaignNow(sim, g) {
  const C = campaignTable(sim), t = g.t || 0;
  if (g.campaign) return {...g.campaign, C, standin: false};
  let stretch = 0; for (const s of C.stretches) if (t >= s.from) stretch = s.index;
  // the boss in the long bar: the big or final boss on the field
  let bar = 0; for (const u of g.foes) if (!u.dead && u.state !== 'dead' && u.hp > 0 && (tierOf(u) === 'big' || tierOf(u) === 'final')) { bar = u.id; break; }
  let next = null;
  for (const s of C.stretches) {
    for (const st of s.small) if (st > t) { next = {t: st, tier: 'small', kind: null}; break; }
    if (next) { if (s.big.t < next.t) next = {t: s.big.t, tier: 'big', kind: s.big.kind}; break; }
    if (s.big.t > t) { next = {t: s.big.t, tier: 'big', kind: s.big.kind}; break; }
  }
  return {stretch, scene: stretch, march: 0, next, bar, guards: false, until: null, C, standin: true};
}
