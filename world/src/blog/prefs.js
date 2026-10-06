// The homepage and the blog share one preferences record (`yaxin.grimoire.preferences`, written by ui.js).
// The blog only reads and writes `lang` and `theme`, and always merges, so the 3D academy's settings survive.
export const PREFS_KEY = 'yaxin.grimoire.preferences';

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function readPrefs(store = storage()) {
  let p = {};
  try { p = JSON.parse(store?.getItem(PREFS_KEY) || '{}') || {}; } catch { p = {}; }
  return {lang: ['en', 'zh'].includes(p.lang) ? p.lang : null, theme: ['light', 'dark'].includes(p.theme) ? p.theme : null};
}

/** Merge {lang?, theme?} into the shared record without touching anything else in it. */
export function writePrefs(patch, store = storage()) {
  if (!store) return;
  let p = {};
  try { p = JSON.parse(store.getItem(PREFS_KEY) || '{}'); if (!p || typeof p !== 'object' || Array.isArray(p)) p = {}; } catch { p = {}; }
  for (const key of ['lang', 'theme']) if (patch[key] !== undefined) p[key] = patch[key];
  try { store.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage full or blocked: the choice lasts for this page */ }
}
