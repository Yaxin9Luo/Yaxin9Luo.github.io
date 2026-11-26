// What a thing is called on the page, in any of its forms: a row's own id, an evolved treasure's or weapon's id, a 合璧
// pair's id (the build keeps a pair as one treasure entry under the merge's id), a blessed host's, a true form's.
// Pure: no DOM, no game state, so tests/muye2-names.test.js walks every id in CONTENT through it in both languages.
// `c` is {sim, lang, t}: the rules module, 'zh' or 'en', and the page's copy for that language (t.peach, t.unknownThing).

export const rowOf = (sim, kind, id) => sim.BY && sim.BY[kind] ? sim.BY[kind][id] : (sim.CONTENT[kind + 's'] || []).find(r => r.id === id);
/** A treasure's evolved form is known by its own id in events and in the damage table: the treasure it came from. */
export const evolvedFrom = (sim, id) => (sim.CONTENT.treasures || []).find(r => r.evolved && r.evolved.id === id);
/** The hero's weapon in its evolved form is known by its own id too (SPEC-CAMPAIGN 2.4). */
export const weaponFrom = (sim, id) => (sim.CONTENT.weapons || []).find(r => r.evolved && r.evolved.id === id);
export const maxOf = (sim, kind) => (sim.MAX && sim.MAX[kind]) || (kind === 'general' ? 5 : kind === 'troop' ? 8 : 6);

/** Any id a thing can be known by back to the row it names: {row, kind, merge}; null when the tables have no such id. */
export function formRow(sim, kind, id) {
  const row = rowOf(sim, kind, id); if (row) return {row, kind, merge: null};
  if (kind === 'treasure' || kind === 'merge') {
    const m = rowOf(sim, 'merge', id); if (m) return {row: m, kind: 'merge', merge: m};
    const r = evolvedFrom(sim, id); if (r) return {row: r, kind: 'treasure', merge: null};
  }
  if (kind === 'weapon') { const r = weaponFrom(sim, id); if (r) return {row: r, kind, merge: null}; }
  if (kind === 'troop') { const r = (sim.CONTENT.troops || []).find(x => x.blessed && x.blessed.id === id); if (r) return {row: r, kind, merge: null}; }
  if (kind === 'general') { const r = (sim.CONTENT.generals || []).find(x => x.trueForm && x.trueForm.id === id); if (r) return {row: r, kind, merge: null}; }
  return null;
}
/** A 合璧 pair's element: its first part's. */
export const mergeElement = (sim, m) => { const p = m && m.parts && rowOf(sim, 'treasure', m.parts[0]); return p ? p.element || null : null; };
const say = (c, w) => w ? w[c.lang] || w.en : '';
/** A general in true form is called by his divine title (杨戬 → 清源妙道真君), never by his feat's name; his own name until the rules give one. */
export const titleOf = (c, row) => { const ti = row && row.trueForm && row.trueForm.title; return ti ? say(c, ti) : row ? say(c, row.name) : ''; };

/** The words of a thing at a level. One past the top level is its last form: a treasure evolved, a general's true form, a blessed host. */
export function wordsOf(c, kind, id, level) {
  const {sim, t} = c;
  if (kind === 'mend') return {name: t.peach[0], text: t.peach[1], element: null};
  const f = formRow(sim, kind, id);
  if (!f) return {name: t.unknownThing, text: '', element: null};   // never a raw id on the page
  if (f.merge) return {name: say(c, f.merge.name), text: say(c, f.merge.text), element: mergeElement(sim, f.merge), merged: true};
  if (f.row.id !== id) return wordsOf(c, f.kind, f.row.id, maxOf(sim, f.kind) + 1);   // known by its last form's own id
  const row = f.row;
  const last = level > maxOf(sim, kind) ? row.evolved || (row.trueForm && {name: row.name, text: row.trueForm.text}) || (row.blessed && {name: row.name, text: row.blessed.text}) : null;
  let d = null;
  try { d = sim.describe ? sim.describe(kind, id, level) : null; } catch { /* a level the rules have no words for: the table's own */ }
  if (!d || !d.name || !d.text) d = last || {name: row.name, text: ((row.levels || [])[Math.min(level, (row.levels || []).length) - 1] || {}).text || row.text || {en: '', zh: ''}};
  const out = {name: say(c, d.name), text: say(c, d.text), element: row.element || null};
  if (kind === 'general' && last) { out.mortal = say(c, row.name); out.name = titleOf(c, row); out.feat = row.trueForm && row.trueForm.name ? say(c, row.trueForm.name) : ''; }
  return out;
}
