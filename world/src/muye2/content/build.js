// What a build may hold and how it is offered: slots, tops, offers, resonance, the chest's words, what a payoff is
// worth, the generals' common numbers. Owner: rules·build (B).

import {T} from './base.js';

export const SLOTS = {treasure: 6, art: 6, troop: 8, formation: 1, general: 5};
export const MAX = {treasure: 6, art: 5, troop: 8, formation: 3, general: 5, weapon: 8};
export const OFFER = {rerolls: 2, banishes: 2, weight: {treasure: 1, art: 1, troop: .75, formation: .4, general: .3, weapon: 1.1, merge: 1}, mend: 30,
  generalFrom: 4,      // no general is offered before the hero is this level
  chestNear: 2,        // a chest that finds no payoff ready gives its level to what is within this many levels of its top, if anything is
  focus: .4,          // (was .15: a sensible build that started on treasures was shown too few squads) and every slip weighs (focus + the share of the build's levels in its family) / (focus + 1/3): a build that
                      // leans one way is offered more of that way, a mixed one is offered as before (SPEC-CAMPAIGN 2.8)
  focusFrom: 6,       // from this many levels in the build
  newUntil: 20, newLean: .6,   // from 20 levels, the new slip an offer always holds is of a family that leans at least this much
  family: {troop: 'host', general: 'host', formation: 'host', treasure: 'arms', weapon: 'arms', merge: 'arms', art: 'art'}};          // a slip that continues something owned weighs this much more with each level it already has


// Resonance: `need` things of one element (treasures, arts and troops) give that element's standing bonus.
// The keys other than `text` are added to the same sums the arts add to.
export const RESONANCE = {
  need: 3,
  deep: 6,             // deep resonance: six things of one element double the bonus and add `deepDmg` (what a build that commits to one element earns)
  deepDmg: .1,
  fire: {dmg: .02, text: {en: 'Fire resonance: everything you own hits 2% harder.', zh: '火之共鸣：你的一切攻击伤害提高 2%。'}},
  water: {regen: .6, text: {en: 'Water resonance: you mend 0.6 health every second.', zh: '水之共鸣：每秒回复 0.6 点生命。'}},
  wood: {speed: .06, rate: .06, text: {en: 'Wood resonance: you ride and your treasures strike 6% faster.', zh: '木之共鸣：骑行与法宝出手都快 6%。'}},
  metal: {area: .1, text: {en: 'Metal resonance: every attack reaches a tenth wider.', zh: '金之共鸣：所有攻击的范围扩大一成。'}},
  earth: {armour: 1, hp: 15, text: {en: 'Earth resonance: 15 more health, and every hit hurts 1 less.', zh: '土之共鸣：生命上限加 15，每次受击少掉 1 点。'}},
  deepText: {en: 'Deep resonance: six things of one element: its bonus twice over, and everything hits 10% harder.', zh: '五行深共鸣：同一行六件，共鸣加倍，一切攻击伤害再提高 10%。'},
};

// What a chest gave, for the banner over it (`chest` event, `gave`).
export const CHEST = {
  evolve: T('The chest evolves a treasure', '宝箱：法宝进化'), blessed: T('The chest blesses a squad', '宝箱：神兵天降'),
  trueForm: T('The chest shows a general\'s true form', '宝箱：将星显圣'), generals: T('The fallen foe\'s chest: choose a general', '破敌宝箱：点将'),
  treasure: T('The chest raises a treasure', '宝箱：法宝升级'), art: T('The chest deepens an art', '宝箱：心法精进'), troop: T('The chest strengthens a squad', '宝箱：兵阵增强'),
  formation: T('The chest drills the formation', '宝箱：阵法精进'), merge: T('The chest joins two treasures', '宝箱：法宝合璧'), general: T('The chest raises a general', '宝箱：武将升级'), mend: T('The chest mends you', '宝箱：回复生命'),
};

// What a payoff is worth: every blow of an evolved treasure, and of a blessed host, is this much harder.
export const PAYOFF = {evolve: 1.4, merge: 2, blessed: 2, trueForm: 1.6, curve: [.2, .75], troopCurve: [.5, .9], fade: [90, 180], from: 150};   // 2026-11-25 (SPEC-CAMPAIGN 2.8b): before its payoff a treasure does `curve` [level 1, top level] of its numbers, a squad `troopCurve` (treasures start at .2 since 2026-11-26: the random picker into plan without touching squads); the gap between a planned build and a random one is what a payoff brings. Was evolve 1.75, merge 2.4, blessed 2.6, no curve. troopCurve [.25, .75] until 2026-11-27 (with troops.js FOLLOW: the soldiers' place in a troop-heavy build).   // evolve 1.8 and blessed 2.8 until 2026-11-25: power moved to what a planned build earns   // `from`: no payoff comes before this time (on a bare stage it does)   // and a general in his true form strikes `trueForm` times as hard as at level 5
export const ALLY_CLEAR = 105;   // no soldier's place is within this of the hero (a mount and a half), and one pushed in walks out (SPEC 2.2b)
export const GENERAL = {clear: 70, formClear: 1.5,   // no general stands nearer the hero than this (about one mount's length; a true form, drawn larger, 1.5 times it)
  away: 20, speed: 330, grow: .17, hpGrow: .25, leash: 460, echo: .4, power: 1.85};   // 1.7, then 2.1, now 1.85 (2026-11-25): support generals added and 姜子牙 and 龙吉 made to hit harder; at 2.1 generals did 54% of a horseman's damage
