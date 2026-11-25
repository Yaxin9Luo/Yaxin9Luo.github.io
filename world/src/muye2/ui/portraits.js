// Portraits of the generated key figures, for the scroll case, the codex and the heralds. The figures session (art/)
// cuts them and exports PORTRAITS = {id: {bust, full}} from art/puppets/imagegen/portraits.js (3.3 MB in all, so none
// is fetched up front); until that file exists
// the page shows a seal with one character instead. Loaded once, off the path of the first frame.
const found = import.meta.glob('../art/puppets/imagegen/portraits.js');
let table = {};
export const portraitsReady = (async () => {
  const load = Object.values(found)[0];
  if (!load) return table;
  try { const m = await load(); table = m.PORTRAITS || {}; } catch { table = {}; }
  return table;      // nothing is fetched here: about 175 KB a figure, so each image loads only when a screen or a herald needs it
})();
/** The portrait of an id ('bust' or 'full'), or '' when there is none. */
export const portrait = (id, which = 'bust') => (table[id] && table[id][which]) || '';
const warmed = new Set();
/** Fetch one portrait ahead of need (a boss's bust shortly before he arrives, so his herald has it at once). */
export function warm(id, which = 'bust') { const url = portrait(id, which); if (!url || warmed.has(url)) return; warmed.add(url); const i = new Image(); i.decoding = 'async'; i.src = url; }
