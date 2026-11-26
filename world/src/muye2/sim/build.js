// The build: giving, offers, payoffs, chests. Owner: rules·build (B).

import {rand} from './core.js';
import {rebuildOrbits, manifest} from './shapes.js';
import {syncSquads} from './squads.js';
import {syncGenerals} from './generals.js';
import {HERO, SLOTS, MAX, OFFER, ELEMENTS, fedBy, RESONANCE, rankOf, PAYOFF, WEAPON_ART, xpNeed, CONTENT, BY, LIST} from '../content.js';
import {STAT, poolOf, meritFrom} from '../content/meta.js';
import {spoilMods, forcePayoff} from './spoils.js';
export {takeSpoil, saveHero, bigPayoff} from './spoils.js';

export const owned = (g, kind) => kind === 'treasure' ? g.build.treasures : kind === 'art' ? g.build.arts : kind === 'general' ? g.build.generals : g.build.troops;
export const keyOf = o => o.kind + ':' + o.id;

/** Everything the build's arts, resonances and formation come to, and what follows from a change of the build. */
export function recompute(g) {
  const b = g.build, sum = {dmg: 0, rate: 0, area: 0, dur: 0, speed: 0, spirit: 0, regen: 0, mend: 0, armour: 0, gather: 0, hp: 0, ride: 0, trample: 0, muster: 0, troopHp: 0, generalRate: 0, back: 0, weaponDmg: 0, weaponRate: 0, dashCd: 0};
  for (const a of b.arts) { const gv = BY.art[a.id].gives; for (const k in gv) sum[k] += gv[k] * a.level; }
  if (g.metaK) for (const k in g.metaK) sum[k] += g.metaK[k];        // the permanent ranks bought outside the run
  const count = {};
  for (const t of b.treasures) for (const e of t.merged ? t.parts : [t]) count[BY.treasure[e.id].element] = (count[BY.treasure[e.id].element] || 0) + 1;
  for (const e of b.arts) count[BY.art[e.id].element] = (count[BY.art[e.id].element] || 0) + 1;
  for (const e of b.troops) count[BY.troop[e.id].element] = (count[BY.troop[e.id].element] || 0) + 1;
  const res = Object.keys(ELEMENTS).filter(e => (count[e] || 0) >= RESONANCE.need);
  const deep = res.filter(e => count[e] >= RESONANCE.deep);
  for (const e of res) {
    const isDeep = deep.includes(e), times = isDeep ? 2 : 1;
    if (!b.resonance.includes(e) || (isDeep && !(b.deep || []).includes(e))) g.events.push({type: 'resonance', element: e, deep: isDeep, x: g.hero.x, y: g.hero.y});
    for (const k in RESONANCE[e]) if (k !== 'text') sum[k] += RESONANCE[e][k] * times;
    if (isDeep) sum.dmg += RESONANCE.deepDmg;
  }
  b.resonance = res; b.deep = deep;
  // the element the build has most of (the acolytes' spell takes it): the first of the five on a tie
  g.mainEl = Object.keys(ELEMENTS).reduce((best, e) => (count[e] || 0) > (count[best] || 0) ? e : best, 'water');
  const m = g.mods, h = g.hero;
  m.dmg = 1 + sum.dmg; m.rate = 1 + sum.rate; m.area = 1 + sum.area; m.dur = 1 + sum.dur; m.speed = 1 + sum.speed;
  m.spirit = 1 + sum.spirit; m.regen = sum.regen; m.mend = 1 + sum.mend; m.armour = sum.armour; m.gather = HERO.gather + sum.gather; m.ride = sum.ride; m.trample = 1 + sum.trample;
  m.muster = 1 + sum.muster; m.troopHp = 1 + sum.troopHp; m.generalRate = 1 + sum.generalRate; m.back = sum.back;
  m.weaponDmg = 1 + sum.weaponDmg; m.weaponRate = 1 + sum.weaponRate; m.dashCd = Math.max(.4, 1 - sum.dashCd);
  if (b.spoils) spoilMods(g, m);                      // 地行术, 八九玄功
  setPower(g);
  const maxHp = HERO.hp + sum.hp;
  if (maxHp > h.maxHp) h.hp += maxHp - h.maxHp;
  h.maxHp = maxHp; if (h.hp > maxHp) h.hp = maxHp;
  g.form = b.formation ? BY.formation[b.formation.id].at[b.formation.level] : null;
  syncSquads(g, true);
  syncGenerals(g);
  rebuildOrbits(g);
  if (!b.treasures.some(t => (t.merged ? t.parts : [t]).some(e => BY.treasure[e.id].shape === 'ward')) && g.ward.zone) { g.ward.zone.dead = true; g.ward.zone = null; g.ward.up = false; }
}

/**
 * Put a thing into the build, or raise the one owned by a level (or to `level`). `evolved` makes a treasure its
 * evolved form at once. Used by picks and chests, and by tests and stills. Returns the build's entry.
 */
/**
 * How hard each treasure and squad strikes (`g.power`). Before its payoff, a thing does `PAYOFF.curve` [at level 1, at its top
 * level] of its numbers; the curve comes in over `PAYOFF.fade` [from, to] seconds, so the first minute, when the build is one
 * or two things, keeps the rows' full numbers (SPEC-CAMPAIGN 2.8b). A bare stage, where one shape is tried against its row,
 * does the row's numbers, as it takes no notice of `PAYOFF.from`. Called by recompute and every few seconds while it fades in.
 */
export function setPower(g) {
  const b = g.build, [c0, c1] = PAYOFF.curve, [f0, f1] = PAYOFF.fade, k = g.options.bare ? 0 : Math.min(1, Math.max(0, (g.t - f0) / (f1 - f0)));
  const before = (lvl, max, [a0, a1] = [c0, c1]) => 1 + (a0 + (a1 - a0) * (lvl - 1) / (max - 1) - 1) * k;
  for (const t of b.treasures) { if (t.merged) for (const p of t.parts) g.power[p.id] = PAYOFF.merge; else g.power[t.id] = t.evolved ? PAYOFF.evolve : before(t.level, MAX.treasure); }
  for (const t of b.troops) g.power[t.id] = t.blessed ? PAYOFF.blessed : before(t.level, MAX.troop, PAYOFF.troopCurve);   // squads follow `troopCurve` when it is set, else `curve`
}
export function give(g, kind, id, level, evolved = false) {
  if (!BY[kind] || !BY[kind][id]) throw new Error(`no ${kind} ${id}`);
  const b = g.build;
  let e;
  if (kind === 'merge') {
    // 合璧: the two evolved treasures leave the list and one entry takes their place
    const M = BY.merge[id], parts = M.parts.map(p => b.treasures.find(t => t.id === p));
    if (parts.some(p => !p || !p.evolved)) throw new Error(`${id}: needs ${M.parts.join(' and ')} evolved`);
    b.treasures = b.treasures.filter(t => !M.parts.includes(t.id));
    e = {id, level: MAX.treasure, evolved: true, merged: true, parts: parts.map(p => ({id: p.id, level: p.level, evolved: true, cd: .3})), cd: 0};
    b.treasures.push(e);
    g.events.push({type: 'merge', id, parts: M.parts, x: g.hero.x, y: g.hero.y, shock: manifest(g, g.hero.x, g.hero.y)});
    g.stats.payoffs.push({t: g.t, kind: 'merge', id});
  } else if (kind === 'weapon') {
    // the weapon chosen before the run: only levels and its one evolution, never another
    if (b.weapon && b.weapon.id === id) b.weapon.level = Math.min(MAX.weapon, level || b.weapon.level + 1);
    else b.weapon = {id, level: level || 1, evolved: false, cd: .3, n: 0};
    if (evolved) { b.weapon.level = MAX.weapon; b.weapon.evolved = true; }
    e = b.weapon;
  } else if (kind === 'formation') {
    if (b.formation && b.formation.id === id) b.formation.level = Math.min(MAX.formation, level || b.formation.level + 1);
    else b.formation = {id, level: level || 1};
    e = b.formation;
  } else {
    const list = owned(g, kind);
    e = list.find(x => x.id === id);
    if (e) e.level = Math.min(MAX[kind], level || e.level + 1);
    else {
      e = kind === 'treasure' ? {id, level: level || 1, evolved: false, cd: .4}
        : kind === 'troop' ? {id, level: level || 1, rank: 1, blessed: false, cd: 1, musterT: 0, skillCd: 2}
        : kind === 'general' ? {id, level: level || 1, trueForm: false, skillCd: 2}
        : {id, level: level || 1};
      list.push(e);
      if (kind === 'general') g.events.push({type: 'summon', general: id, x: g.hero.x, y: g.hero.y});
    }
    if (kind === 'treasure' && evolved) { e.level = MAX.treasure; e.evolved = true; }
    if (kind === 'general' && evolved) { e.level = MAX.general; e.trueForm = true; }
    if (kind === 'troop') {
      // `evolved` makes the squad a blessed host at once (tests and stills); a rank is a change of the men
      if (evolved) { e.level = MAX.troop; e.blessed = true; }
      const rank = rankOf(e.level, e.blessed);
      if (rank !== e.rank) { e.rank = rank; g.events.push({type: 'rankUp', troop: id, rank, level: e.level, x: g.hero.x, y: g.hero.y}); }
    }
  }
  recompute(g);
  return e;
}
export const paramsOf = e => BY.treasure[e.id].at[e.evolved ? MAX.treasure + 1 : e.level];

/** Can this treasure evolve now: level 6, not yet evolved, and an art of the element that feeds its own is owned. */
export function canEvolve(g, e) {
  if (e.merged) return false;
  const row = BY.treasure[e.id];
  if (e.evolved || e.level < MAX.treasure || !row.evolved) return false;
  const need = fedBy(row.element);
  return g.build.arts.some(a => BY.art[a.id].element === need);
}
/** Can the two treasures of a pair join now: both owned and both evolved. */
export function canMerge(g, id) {
  return BY.merge[id].parts.every(p => g.build.treasures.some(t => t.id === p && t.evolved && !t.merged));
}
/** Can the weapon evolve now: level 8, not yet evolved, and the art 武艺 owned. */
export function canEvolveWeapon(g) {
  const w = g.build.weapon;
  return !!w && !w.evolved && w.level >= MAX.weapon && g.build.arts.some(a => a.id === WEAPON_ART);
}
/** Can this squad become a blessed host now: level 8, not yet blessed, and its kind's patron general owned. */
export function canBless(g, e) {
  return !e.blessed && e.level >= MAX.troop && g.build.generals.some(x => x.id === BY.troop[e.id].patron);
}

export function candidates(g, shown, chest = false) {
  const b = g.build, cont = [], fresh = [], swap = [];
  const barred = o => g.banished.includes(keyOf(o)) || (shown && shown.some(s => keyOf(s) === keyOf(o)));
  for (const kind of ['treasure', 'art', 'troop', 'general']) {
    const list = owned(g, kind);
    if (kind === 'general' && g.hero.level < OFFER.generalFrom && !chest) continue;
    for (const e of list) if (e.level < MAX[kind]) { const o = {kind, id: e.id, level: e.level + 1, isNew: false}; if (!barred(o)) cont.push(o); }
    if (list.length < SLOTS[kind]) for (const row of LIST[kind]) if (!list.some(e => e.id === row.id) && inPool(g, kind, row.id)) { const o = {kind, id: row.id, level: 1, isNew: true}; if (!barred(o)) fresh.push(o); }
  }
  if (b.weapon && b.weapon.level < MAX.weapon) { const o = {kind: 'weapon', id: b.weapon.id, level: b.weapon.level + 1, isNew: false}; if (!barred(o)) cont.push(o); }
  for (const row of CONTENT.formations) {
    const cur = b.formation && b.formation.id === row.id;
    if (cur && b.formation.level >= MAX.formation) continue;
    const o = cur ? {kind: 'formation', id: row.id, level: b.formation.level + 1, isNew: false} : {kind: 'formation', id: row.id, level: 1, isNew: true};
    if (barred(o)) continue;
    (cur ? cont : b.formation ? swap : fresh).push(o);
  }
  // What would unlock a payoff the build is waiting for: the art that feeds a treasure at its top level, the patron
  // of a squad that is nearing its last rank. Such a slip says so (`unlocks`), and an offer always holds one.
  const unlock = [];
  for (const M of CONTENT.merges) if (canMerge(g, M.id)) { const o = {kind: 'merge', id: M.id, level: 1, isNew: false, unlocks: {kind: 'merge', id: M.id}}; if (!barred(o)) unlock.push(o); }
  for (const t of b.treasures) {
    if (t.merged) continue;
    const row = BY.treasure[t.id], need = fedBy(row.element);
    if (t.evolved || t.level < MAX.treasure - 1 || b.arts.some(a => BY.art[a.id].element === need)) continue;
    for (const o of fresh) if (o.kind === 'art' && BY.art[o.id].element === need && !o.unlocks) { o.unlocks = {kind: 'evolve', id: t.id, into: row.evolved.id}; unlock.push(o); }
  }
  const w = b.weapon;
  if (w && !w.evolved && w.level >= MAX.weapon - 1 && !b.arts.some(a => a.id === WEAPON_ART))
    for (const o of fresh) if (o.kind === 'art' && o.id === WEAPON_ART && !o.unlocks) { o.unlocks = {kind: 'evolve', id: w.id, into: BY.weapon[w.id].evolved.id, weapon: true}; unlock.push(o); }
  for (const t of b.troops) {
    const row = BY.troop[t.id];
    if (t.blessed || t.level < MAX.troop - 2 || b.generals.some(e => e.id === row.patron) || b.generals.length >= SLOTS.general) continue;
    let o = fresh.find(x => x.kind === 'general' && x.id === row.patron);
    if (!o && !chest && inPool(g, 'general', row.patron)) { o = {kind: 'general', id: row.patron, level: 1, isNew: true}; if (barred(o)) continue; fresh.push(o); }   // offered whatever the hero's level
    if (o && !o.unlocks) { o.unlocks = {kind: 'bless', id: t.id, into: row.blessed.id}; unlock.push(o); }
  }
  // The level that completes a payoff: a treasure's last with its art owned, a squad's last with its patron owned,
  // a general's last.
  for (const o of cont) {
    if (o.level !== MAX[o.kind]) continue;
    if (o.kind === 'treasure' && BY.treasure[o.id].evolved && b.arts.some(a => BY.art[a.id].element === fedBy(BY.treasure[o.id].element))) o.unlocks = {kind: 'evolve', id: o.id, into: BY.treasure[o.id].evolved.id};
    else if (o.kind === 'troop' && b.generals.some(e => e.id === BY.troop[o.id].patron)) o.unlocks = {kind: 'bless', id: o.id, into: BY.troop[o.id].blessed.id};
    else if (o.kind === 'general') o.unlocks = {kind: 'trueForm', id: o.id, into: BY.general[o.id].trueForm.id};
    else if (o.kind === 'weapon' && b.arts.some(a => a.id === WEAPON_ART)) o.unlocks = {kind: 'evolve', id: o.id, into: BY.weapon[o.id].evolved.id, weapon: true};
    if (o.unlocks) unlock.push(o);
  }
  return {cont, fresh, swap, unlock};
}
/** The share of the build's levels in each family (host: squads, generals, formation; arms: treasures and the weapon; art). */
export function familyShare(g) {
  const b = g.build, n = {host: 0, arms: 0, art: 0};
  for (const t of b.troops) n.host += t.level;
  for (const e of b.generals) n.host += e.level;
  if (b.formation) n.host += b.formation.level;
  for (const t of b.treasures) n.arms += t.merged ? 2 * MAX.treasure : t.level;
  if (b.weapon) n.arms += b.weapon.level - 1;          // the weapon's first level is the player's choice before the run
  for (const a of b.arts) n.art += a.level;
  const all = n.host + n.arms + n.art || 1;
  return {host: n.host / all, arms: n.arms / all, art: n.art / all, n: n.host + n.arms + n.art};
}
/** One of the list by weight, taken out of it. What is owned weighs more the further along it is. */
/** How much a slip of this kind leans with the build: 1 for a young or mixed build, more for its own family, less for a shunned one. */
export function leanOf(g) {
  const share = familyShare(g);
  return k => share.n < OFFER.focusFrom ? 1 : (OFFER.focus + (share[OFFER.family[k]] || 0)) / (OFFER.focus + 1 / 3);
}
export function draw(g, list) {
  const lean = leanOf(g);
  const w = o => OFFER.weight[o.kind] * lean(o.kind);
  let total = 0;
  for (const o of list) total += w(o);
  let pick = rand(g) * total;
  for (let i = 0; i < list.length; i++) if ((pick -= w(list[i])) < 0) return list.splice(i, 1)[0];
  return list.pop();
}
export const MEND = {kind: 'mend', id: 'peach', level: 0, isNew: false};
/** Three gifts from what can still be taken: one continues something owned, one is new while a slot is free. */
export function makeOffer(g) {
  const {cont, fresh, swap, unlock} = candidates(g, null), out = [];
  if (unlock.length) { const o = draw(g, unlock), from = o.kind === 'merge' ? null : o.isNew ? fresh : cont; if (from) from.splice(from.indexOf(o), 1); out.push(o); }   // the way to a payoff is always on offer
  // (no slip leads otherwise: until 2026-11-25 the next level of what was taken furthest was on every offer, and it carried a
  // random picker to the payoffs as surely as a planner; SPEC-CAMPAIGN 2.8b)
  if (cont.length && !out.some(o => !o.isNew)) out.push(draw(g, cont));
  // a new slip while a slot is free; late in a run only one of a family the build leans toward (else new slips compete with the rest)
  const lean = leanOf(g), late = familyShare(g).n >= OFFER.newUntil, ownNew = late ? fresh.filter(o => lean(o.kind) >= OFFER.newLean) : fresh;
  if (ownNew.length && !out.some(o => o.isNew)) { const o = draw(g, ownNew); fresh.splice(fresh.indexOf(o), 1); out.push(o); }
  const rest = [...cont, ...fresh, ...swap];
  while (out.length < 3 && rest.length) out.push(draw(g, rest));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
  if (!out.length) out.push({...MEND});
  return out;
}
export function openOffer(g) {
  g.offer = makeOffer(g); g.phase = 'offer';
  g.events.push({type: 'offer', offer: g.offer});
}
export function mend(g, v) { const h = g.hero; h.hp = Math.min(h.maxHp, h.hp + v); }

export function takeGift(g, o, from) {
  if (o.kind === 'mend') mend(g, OFFER.mend);
  else give(g, o.kind, o.id);
  g.stats.picks += from === 'offer' ? 1 : 0;
  g.events.push({type: 'take', kind: o.kind, id: o.id, level: o.level, isNew: o.isNew, from, x: g.hero.x, y: g.hero.y});
  // the first payoff of a run needs no chest: it happens the moment it is ready
  if (!g.stats.payoffs.length) payoff(g, g.hero.x, g.hero.y, false);
}

/**
 * The payoffs: a treasure evolves, a squad becomes a blessed host, a general shows his true form. Does the first one
 * that is ready, in that order, and reports it; returns false when none is.
 */
export function payoff(g, x, y, chest, announce = chest) {
  // none before PAYOFF.from: one that is ready earlier waits, and comes by itself when the time does
  if (g.t < PAYOFF.from && !g.options.bare) { g.payoffDue = true; return false; }
  const first = !g.stats.payoffs.length;
  const e = g.build.treasures.find(t => canEvolve(g, t));
  if (e) {
    e.evolved = true; e.cd = .2;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'evolve', id: e.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'evolve', id: e.id});
    g.events.push({type: 'evolve', id: e.id, into: BY.treasure[e.id].evolved.id, x, y, first, chest, shock: manifest(g, g.hero.x, g.hero.y)});
    return true;
  }
  if (canEvolveWeapon(g)) {
    const w = g.build.weapon;
    w.evolved = true; w.cd = .2;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'evolve', id: w.id, weapon: true});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'evolve', id: w.id});
    g.events.push({type: 'evolve', id: w.id, into: BY.weapon[w.id].evolved.id, weapon: true, x, y, first, chest, shock: manifest(g, g.hero.x, g.hero.y)});
    return true;
  }
  const squad = g.build.troops.find(t => canBless(g, t));
  if (squad) {
    squad.blessed = true; squad.rank = 5; squad.skillCd = 1;
    recompute(g);
    g.stats.payoffs.push({t: g.t, kind: 'blessed', id: squad.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'blessed', id: squad.id});
    g.events.push({type: 'rankUp', troop: squad.id, rank: 5, level: squad.level, x, y});
    g.events.push({type: 'blessed', troop: squad.id, patron: BY.troop[squad.id].patron, into: BY.troop[squad.id].blessed.id, x, y, first, chest, shock: manifest(g, g.hero.x, g.hero.y)});
    return true;
  }
  const pair = CONTENT.merges.find(M => canMerge(g, M.id));
  if (pair && chest) {
    if (announce) g.events.push({type: 'chest', x, y, gave: 'merge', id: pair.id});
    give(g, 'merge', pair.id);
    return true;
  }
  const gen = g.build.generals.find(t => t.level >= MAX.general && !t.trueForm);
  if (gen) {
    gen.trueForm = true; gen.skillCd = 1;
    recompute(g);
    const u = g.allies.find(a => a.kind === 'general' && a.general === gen.id);
    g.stats.payoffs.push({t: g.t, kind: 'trueForm', id: gen.id});
    if (announce) g.events.push({type: 'chest', x, y, gave: 'trueForm', id: gen.id});
    g.events.push({type: 'trueForm', general: gen.id, id: BY.general[gen.id].trueForm.id, x: u ? u.x : x, y: u ? u.y : y, first, chest, shock: manifest(g, u ? u.x : g.hero.x, u ? u.y : g.hero.y)});
    return true;
  }
  return false;
}

/**
 * A chest evolves a treasure if one can evolve; otherwise it blesses a squad that can be blessed; otherwise it
 * shows a general's true form; otherwise it gives a level to something owned; otherwise it mends. The chest of the
 * named foe of 5:00 (`named`) offers three generals instead while a general's place is free.
 */
export function openChest(g, x, y, named) {
  g.stats.chests++;
  if (named && g.build.generals.length < SLOTS.general) {
    const pool = CONTENT.generals.filter(r => !g.build.generals.some(e => e.id === r.id) && !g.banished.includes('general:' + r.id) && inPool(g, 'general', r.id)).map(r => ({kind: 'general', id: r.id, level: 1, isNew: true})), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
    if (out.length) {
      g.events.push({type: 'chest', x, y, gave: 'generals', id: null});
      g.offer = out; g.phase = 'offer'; g.chestOffer = true;
      g.events.push({type: 'offer', offer: out, chest: true});
      return;
    }
  }
  if (payoff(g, x, y, true)) return;                      // a payoff that is ready always comes first
  if (OFFER.firstChestPays && !g.stats.payoffs.length && g.t >= PAYOFF.from && forcePayoff(g, x, y)) return;   // an option for the user (off): a run's first chest after PAYOFF.from brings its first payoff
  // otherwise it carries the build toward its next payoff: what unlocks one if anything does, else a level for
  // the treasure, squad or general that is furthest along
  const {cont, unlock} = candidates(g, null, true);
  let o = null;
  if (unlock.length) o = unlock[Math.floor(rand(g) * unlock.length)];
  else {
    // only what the player has himself taken most of the way: within `OFFER.chestNear` levels of its top
    let top = 0;
    for (const c of cont) {
      if (c.kind === 'art' || c.kind === 'formation' || (g.stats.payoffs.length && c.level <= MAX[c.kind] - OFFER.chestNear)) continue;   // until the run's first payoff: whatever is furthest along
      const far = c.level / MAX[c.kind] + rand(g) * .01;
      if (far > top) { top = far; o = c; }
    }
    if (!o) o = cont.length ? cont[Math.floor(rand(g) * cont.length)] : {...MEND};
  }
  g.events.push({type: 'chest', x, y, gave: o.kind, id: o.id});
  const had = g.stats.payoffs.length;
  takeGift(g, o, 'chest');
  if (g.stats.payoffs.length === had) payoff(g, x, y, true, false);   // and if its level completed something, the same chest does that too
}

export function stepOffer(g, input) {
  const offer = g.offer;
  if (input.reroll && g.rerolls > 0 && !g.chestOffer) {
    g.rerolls--;
    if (g.t === 0 && !g.build.treasures.length) {
      const pool = openingPool(g), out = [];
      while (out.length < 3) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
      g.offer = out;
    } else g.offer = makeOffer(g);
    g.events.push({type: 'offer', offer: g.offer, rerolled: true});
    return;
  }
  const b = input.banish;
  if (b !== null && b !== undefined && offer[b] && g.banishes > 0 && offer[b].kind !== 'mend' && g.build.treasures.length && !g.chestOffer) {
    g.banishes--;
    g.banished.push(keyOf(offer[b]));
    const {cont, fresh, swap} = candidates(g, offer), rest = [...cont, ...fresh, ...swap];
    for (const o of rest) delete o.unlocks;
    if (rest.length) offer[b] = draw(g, rest); else offer.splice(b, 1);
    if (!offer.length) offer.push({...MEND});
    g.events.push({type: 'offer', offer, banished: true});
    return;
  }
  const p = input.pick;
  if (p !== null && p !== undefined && offer[p]) {
    const from = g.chestOffer ? 'chest' : 'offer';
    g.offer = null; g.phase = 'fight'; g.chestOffer = false;
    takeGift(g, offer[p], from);
  }
}

/**
 * What the player brought into the run: the weapon chosen before it (`g.options.weapon`) and what was bought outside
 * it (`meta`, SPEC-CAMPAIGN 1.6 and 2.7). Called by createGame after the hero is made and before the first offer,
 * with or without `meta`.
 */
export function applyMeta(g, meta) {
  if (!g.build.spoils) g.build.spoils = [];           // the spoils row (SPEC 2.11): outside the slots
  const id = g.options && g.options.weapon;
  if (id) {
    if (!BY.weapon[id]) throw new Error(`no weapon ${id}`);
    give(g, 'weapon', id, 1);
  }
  if (meta) applyRanks(g, meta);
}
/** Is this thing in the run's pools: everything when no `meta.unlocked` was given, else META.start and what was bought. */
export function inPool(g, kind, id) {
  if (!g.pool || (kind !== 'treasure' && kind !== 'general')) return true;
  return g.pool[kind + 's'].includes(id);
}
/** The slips of the run's opening offer: the treasures that may open a run and are in the pools. createGame (A) uses it. */
export function openingPool(g) {
  return CONTENT.treasures.filter(r => r.opening !== false && inPool(g, 'treasure', r.id)).map(r => ({kind: 'treasure', id: r.id, level: 1, isNew: true}));
}
/** The ten permanent ranks (META.stats) and the pools (META.start and meta.unlocked). */
function applyRanks(g, meta) {
  const r = meta.ranks || {}, n = id => Math.max(0, Math.min(5, r[id] | 0)), h = g.hero;
  g.metaK = {hp: STAT.hp.step * n('hp'), speed: STAT.speed.step * n('speed'), gather: STAT.gather.step * n('gather'), spirit: STAT.spirit.step * n('spirit'), dashCd: STAT.dashCd.step * n('dashCd')};
  g.mods.chest = 1 + STAT.chest.step * n('chest');          // A reads it where a chest may drop
  g.rerolls += STAT.rerolls.step * n('rerolls'); g.banishes += STAT.banishes.step * n('banishes');
  // a head start: the battle spirit of the first levels, so that their offers open one after another at once
  for (let l = 1; l <= n('startLevel'); l++) h.xp += xpNeed(l);
  if (meta.unlocked) g.pool = poolOf({weapons: meta.unlocked.weapons || [], generals: meta.unlocked.generals || [], treasures: meta.unlocked.treasures || []});
  recompute(g);
}
/** The run's merit (SPEC-CAMPAIGN 2.7): set in g.stats when the run is won or lost (A calls it). */
export function meritOf(g) {
  const m = meritFrom({time: g.t, bosses: g.stats.bosses || {}, payoffs: g.stats.payoffs.length, tier: g.options.tier || 0, ranks: (g.options.meta && g.options.meta.ranks) || {}});
  g.stats.merit = m.merit; g.stats.meritParts = m.parts;
  return m.merit;
}
