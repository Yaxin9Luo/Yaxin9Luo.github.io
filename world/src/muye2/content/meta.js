// Meta progression (局外成长): merit (功德) earned by a run, ten permanent ranks of five levels, what merit unlocks,
// and the difficulty tiers' share of merit. Pure data and pure functions; the page keeps the save (SPEC-CAMPAIGN
// 2.7 and 3.4). Owner: rules·build (B). A's TIERS (content/schedule.js) holds what a tier does to the foes.

import {T} from './base.js';
import {TIERS} from './schedule.js';

// What a run earns. `per` merit for every `time` seconds survived; a boss by his tier; every payoff (evolution,
// blessing, true form, 合璧, the weapon's evolution). The sum is then multiplied by the tier and the merit rank.
export const MERIT = {time: 10, per: 1, small: 15, lieutenant: 5, big: 40, final: 100, payoff: 8};

const rank = (id, zh, en, step, say) => ({id, name: T(en, zh), step,
  levels: [40, 80, 140, 220, 320].map((cost, i) => ({cost, text: say(i + 1)}))});
const pc = v => Math.round(v * 100);
/** The ten permanent stats: `step` is what one rank adds to what it names. */
export const STATS = [
  rank('hp', '生命', 'Health', 12, n => T(`${12 * n} more health.`, `生命上限加 ${12 * n}。`)),
  rank('speed', '移速', 'Speed', .03, n => T(`You ride ${pc(.03 * n)}% faster.`, `骑行速度提高 ${pc(.03 * n)}%。`)),
  rank('gather', '拾取', 'Reach', 20, n => T(`Battle spirit flies to you from ${20 * n} px further.`, `战意从更远 ${20 * n} 像素外飞来。`)),
  rank('spirit', '经验', 'Learning', .05, n => T(`Battle spirit counts for ${pc(.05 * n)}% more.`, `战意多算 ${pc(.05 * n)}%。`)),
  rank('merit', '功德', 'Merit', .1, n => T(`Every run earns ${pc(.1 * n)}% more merit.`, `每局所得功德多 ${pc(.1 * n)}%。`)),
  rank('chest', '宝箱', 'Chests', .08, n => T(`Chests come ${pc(.08 * n)}% more often.`, `宝箱出现率提高 ${pc(.08 * n)}%。`)),
  rank('rerolls', '重选', 'Rerolls', 1, n => T(`${n} more ${n === 1 ? 'reroll' : 'rerolls'} a run.`, `每局多 ${n} 次重选。`)),
  rank('banishes', '剔除', 'Banishes', 1, n => T(`${n} more ${n === 1 ? 'banish' : 'banishes'} a run.`, `每局多 ${n} 次剔除。`)),
  rank('dashCd', '冲刺', 'Spring', .05, n => T(`The spring comes back ${pc(.05 * n)}% sooner.`, `纵跃冷却缩短 ${pc(.05 * n)}%。`)),
  rank('startLevel', '开局', 'Head start', 1, n => T(`The run begins at level ${1 + n}: ${n} ${n === 1 ? 'pick' : 'picks'} at once.`, `开局即为 ${1 + n} 级：先选 ${n} 次。`)),
];
export const STAT = Object.fromEntries(STATS.map(s => [s.id, s]));

/** What everyone has from the first run, and what merit buys (the rest enters the pools only once bought). */
export const START = {
  weapons: ['spear'],
  generals: ['nezha', 'yangjian', 'leizhenzi', 'tuxingsun', 'dengchanyu', 'huangfeihu'],
  treasures: ['fireSpear', 'fireCover', 'sash', 'pearls', 'whip', 'ring', 'seal', 'banner'],
};
export const UNLOCKS = [
  {kind: 'weapon', id: 'halberd', cost: 150}, {kind: 'weapon', id: 'bow', cost: 200}, {kind: 'weapon', id: 'glaive', cost: 250}, {kind: 'weapon', id: 'steelWhip', cost: 300},
  {kind: 'general', id: 'zhenglun', cost: 200}, {kind: 'general', id: 'longji', cost: 250}, {kind: 'general', id: 'huangtianhua', cost: 300}, {kind: 'general', id: 'jiangziya', cost: 400},
  {kind: 'treasure', id: 'fan', cost: 120}, {kind: 'treasure', id: 'mirror', cost: 120}, {kind: 'treasure', id: 'rope', cost: 150}, {kind: 'treasure', id: 'bell', cost: 150},
  {kind: 'treasure', id: 'lotus', cost: 180}, {kind: 'treasure', id: 'tower', cost: 180}, {kind: 'treasure', id: 'zhaoyao', cost: 220}, {kind: 'treasure', id: 'knife', cost: 260},
];
const TIER_WORDS = [
  [T('The Vanguard', '偏师'), T('The run as it is.', '原本的难度。')],
  [T('The King\'s Host', '王师'), T('The Shang are tougher and hit harder; merit is half as much again.', '商军更耐打、更凶；功德多一半。')],
  [T('Against the Tyrant', '伐纣'), T('Tougher and harder still; merit more than doubles.', '商军更强；功德翻倍有余。')],
];
export const META = {
  start: START,
  stats: STATS,
  unlocks: UNLOCKS,
  tiers: TIERS.map((k, tier) => ({tier, name: TIER_WORDS[tier] ? TIER_WORDS[tier][0] : T(`Tier ${tier}`, `第${tier + 1}档`), text: TIER_WORDS[tier] ? TIER_WORDS[tier][1] : T('Harder still.', '更难。'), merit: k.merit})),
  tierOpensOn: 'yuanhong',
};

// ------------------------------------------------------------------------------------------- pure functions
/** Merit of a run from what it did: {time, bosses: {small, big, final, lieutenant}, payoffs, tier, ranks}. Returns {merit, parts}. */
export function meritFrom({time = 0, bosses = {}, payoffs = 0, tier = 0, ranks = {}}) {
  const parts = [{why: 'time', n: Math.floor(time / MERIT.time), merit: Math.floor(time / MERIT.time) * MERIT.per}];
  for (const t of ['small', 'lieutenant', 'big', 'final']) if (bosses[t]) parts.push({why: t, n: bosses[t], merit: bosses[t] * MERIT[t]});
  if (payoffs) parts.push({why: 'payoff', n: payoffs, merit: payoffs * MERIT.payoff});
  const base = parts.reduce((s, p) => s + p.merit, 0), tk = (TIERS[tier] || TIERS[0]).merit, rk = 1 + STAT.merit.step * (ranks.merit || 0);
  parts.push({why: 'tier', x: tk}, {why: 'rank', x: rk});
  return {merit: Math.round(base * tk * rk), parts};
}
/** What the next rank of a stat costs (null at the top). */
export const rankCost = (id, have) => have >= 5 ? null : STAT[id].levels[have].cost;
/** Buy a rank or an unlock: returns the new save, or null when it cannot be bought. A save is {merit, ranks, unlocked, tier, best}. */
export function buy(save, what) {
  const s = {...save, ranks: {...save.ranks}, unlocked: {weapons: [...save.unlocked.weapons], generals: [...save.unlocked.generals], treasures: [...save.unlocked.treasures]}};
  if (what.stat) {
    const c = rankCost(what.stat, s.ranks[what.stat] || 0);
    if (c === null || s.merit < c) return null;
    s.merit -= c; s.ranks[what.stat] = (s.ranks[what.stat] || 0) + 1;
    return s;
  }
  const u = UNLOCKS.find(x => x.kind === what.kind && x.id === what.id), list = s.unlocked[what.kind + 's'];
  if (!u || list.includes(u.id) || s.merit < u.cost) return null;
  s.merit -= u.cost; list.push(u.id);
  return s;
}
/** A fresh save. */
export const newSave = () => ({version: 1, merit: 0, ranks: Object.fromEntries(STATS.map(s => [s.id, 0])), unlocked: {weapons: [], generals: [], treasures: []}, tier: 0, best: 0});
/** What is in the pools for a save: START and what was bought. */
export const poolOf = unlocked => ({weapons: [...START.weapons, ...unlocked.weapons], generals: [...START.generals, ...unlocked.generals], treasures: [...START.treasures, ...unlocked.treasures]});
/** Merit to buy everything. */
export const meritToAll = () => STATS.reduce((s, r) => s + r.levels.reduce((t, l) => t + l.cost, 0), 0) + UNLOCKS.reduce((s, u) => s + u.cost, 0);
