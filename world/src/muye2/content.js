// Muye's rules: the tables. Every table lives in its own file under content/ with one owner (the file map is at the
// top of lab/game-studies/SPEC-CAMPAIGN.md); this file joins them, makes the per-level numbers from the rows, and
// is what sim.js re-exports. No rules live here.
// Contract: lab/game-studies/SPEC-SURVIVORS.md ("Changes") and lab/game-studies/SPEC-CAMPAIGN.md.

import {fedBy} from './content/base.js';
import {MAX, PAYOFF, GENERAL} from './content/build.js';
import {treasures, merges} from './content/treasures.js';
import {arts} from './content/arts.js';
import {troops, RANKS, rankOf} from './content/troops.js';
import {generals} from './content/generals.js';
import {formations} from './content/formations.js';
import {weapons, WEAPON_ART} from './content/weapons.js';
import {spoils} from './content/spoils.js';
import {foes} from './content/foes.js';
import {bosses} from './content/bosses.js';

export {WORLD, STEP, HERO, CRY, ALLY, ELEMENTS, fedBy} from './content/base.js';
export {SLOTS, MAX, OFFER, RESONANCE, CHEST, PAYOFF, GENERAL, ALLY_CLEAR} from './content/build.js';
export {RANKS, rankOf} from './content/troops.js';
export {TRIGRAMS, RIDER} from './content/formations.js';
export {WEAPON_ART} from './content/weapons.js';
export {SCHEDULE, SPAWN, PICKUPS, XP, xpNeed, CAMPAIGN, TIERS, LANDMARKS} from './content/schedule.js';

// --------------------------------------------------------------------------------------------- made from the rows
function resolve(rows, max, kind) {
  for (const row of rows) {
    row.kind = kind;
    if (row.levels.length !== max) throw new Error(`${row.id}: ${row.levels.length} levels, wants ${max}`);
    row.at = [null];
    let cur = {...(row.base || {}), shape: row.shape || (row.base && row.base.shape)};
    for (const lv of row.levels) {
      const {text, ...nums} = lv;
      cur = {...cur, ...nums};
      row.at.push(cur);
    }
    if (row.evolved) {
      const {id, name, text, ...nums} = row.evolved;
      row.at.push({...cur, ...nums});
      row.evolved.needs = fedBy(row.element);
    }
  }
  return rows;
}
// a squad skill's numbers at ranks 2 to 5 (`skillAt[rank]`), and a general's at levels 1 to 5 and in his true form (`at[6]`)
for (const row of troops) {
  const {text, at3, ...two} = row.skill, {text: t3, ...three} = at3, {text: tb, ...five} = row.blessed;
  row.skillAt = [null, null, two, {...two, ...three}, {...two, ...three}, {...two, ...three, ...five}];
}
for (const row of generals) {
  row.kind = 'general';
  row.at = [null];
  let cur = {hp: row.hp, attack: row.attack, skill: row.skill, aura: row.aura || null, grow: 1, hpGrow: 1};
  row.levels.forEach((lv, i) => {
    const {text, aura, ...nums} = lv;
    const attack = {...cur.attack}, skill = {...cur.skill};
    for (const k in nums) { if (k === 'skillCd') skill.cd = nums[k]; else if (k in skill && k !== 'count') skill[k] = nums[k]; else if (k === 'count') { if (row.skill.count !== undefined) skill.count = nums[k]; else attack.count = nums[k]; } else attack[k] = nums[k]; }
    cur = {...cur, attack, skill, aura: aura || cur.aura, grow: 1 + GENERAL.grow * i, hpGrow: 1 + GENERAL.hpGrow * i};
    row.at.push(cur);
  });
  const {id, name, text, skillCd, count, eliteMult, ...form} = row.trueForm;
  const attack = {...cur.attack}, skill = {...cur.skill};
  if (skillCd) skill.cd = skillCd;
  if (count) { if (row.skill.count !== undefined) skill.count = count; else attack.count = count; }
  if (eliteMult) attack.eliteMult = eliteMult;
  row.at.push({...cur, attack, skill, form, grow: cur.grow * PAYOFF.trueForm, hpGrow: cur.hpGrow * 1.3});
}
// a formation's numbers while 姜子牙 is on the field (B)
const commanded = rows => { for (const row of rows) row.commanded = [null, ...row.at.slice(1).map((a, i) => ({...a, ...(row.command ? row.command[i] : {}), commanded: true}))]; return rows; };
export const CONTENT = {
  treasures: resolve(treasures, MAX.treasure, 'treasure'),
  arts: resolve(arts, MAX.art, 'art'),
  troops: resolve(troops, MAX.troop, 'troop'),
  generals,
  formations: commanded(resolve(formations, MAX.formation, 'formation')),
  merges: merges.map(r => ({...r, kind: 'merge'})),
  spoils: spoils.map(r => ({...r, kind: 'spoil'})),
  weapons: resolve(weapons, MAX.weapon, 'weapon').map(r => { r.evolved.needs = WEAPON_ART; return r; }),
  foes: [...foes, ...bosses],
};
const index = rows => Object.fromEntries(rows.map(r => [r.id, r]));
export const BY = {
  treasure: index(CONTENT.treasures), art: index(CONTENT.arts), troop: index(CONTENT.troops),
  formation: index(CONTENT.formations), foe: index(CONTENT.foes), general: index(CONTENT.generals), weapon: index(CONTENT.weapons), merge: index(CONTENT.merges), spoil: index(CONTENT.spoils),
  spoilOf: Object.fromEntries(CONTENT.spoils.map(r => [r.from, r])),   // a boss's kind -> his spoil (B)
};
export const LIST = {treasure: CONTENT.treasures, art: CONTENT.arts, troop: CONTENT.troops, formation: CONTENT.formations, general: CONTENT.generals, weapon: CONTENT.weapons};
/** The words on an offer slip: the name and what this level changes. `level` MAX + 1 of a treasure is its evolved form. */
export function describe(kind, id, level) {
  const row = BY[kind][id];
  if ((kind === 'treasure' || kind === 'weapon') && level > MAX[kind]) return {name: row.evolved.name, text: row.evolved.text, element: row.element || null};
  if (kind === 'merge') return {name: row.name, text: row.text, element: null, parts: row.parts};
  if (kind === 'spoil') return {name: row.name, text: row.text, element: null, from: row.from, tier: row.tier};
  if (kind === 'weapon') return {name: row.name, text: row.levels[level - 1].text, element: null, sign: row.sign};
  if (kind === 'general' && level > MAX.general) return {name: row.trueForm.name, text: row.trueForm.text, element: row.element};
  if (kind === 'troop') {
    // a squad's slip also says its rank; level 9 is the blessed host
    const blessed = level > MAX.troop, rank = rankOf(Math.min(level, MAX.troop), blessed);
    return {name: blessed ? row.blessed.name : row.name, text: blessed ? row.blessed.text : row.levels[level - 1].text, element: row.element, rank, rankName: RANKS[rank - 1].name};
  }
  return {name: row.name, text: row.levels[level - 1].text, element: row.element};
}
