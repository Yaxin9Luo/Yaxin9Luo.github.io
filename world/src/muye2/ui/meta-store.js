// What lasts between runs (PLAN-CAMPAIGN section 5): merit, the ranks bought, what is unlocked, the difficulty tier, the
// codex entries met, and a short record of past runs. Kept in this browser's localStorage under one key, with a version
// number; older versions are migrated on load, a newer one is left untouched. Nothing of a run in progress is ever saved.
// An export code carries the same record to another browser.

export const KEY = 'muye.meta', VERSION = 1;
const KINDS = ['treasure', 'art', 'troop', 'general', 'formation', 'weapon', 'boss', 'foe', 'spoil'];   // 'spoil' added 2026-11-25: an older record reads it as none seen
const STATS = ['hp', 'speed', 'gather', 'spirit', 'merit', 'chest', 'rerolls', 'banishes', 'dashCd', 'startLevel'];

export function fresh() {
  return {v: VERSION, merit: 0, earned: 0, ranks: Object.fromEntries(STATS.map(k => [k, 0])), unlocked: {weapons: [], generals: [], treasures: []},
    tier: 0, tiersOpen: 1, weapon: '', seen: Object.fromEntries(KINDS.map(k => [k, []])), runs: 0, best: {t: 0, bosses: 0}, last: []};
}
/** Each step takes a record of version n to n + 1. Version 0 is "no version field": an early test record, or nothing. */
const STEPS = {
  0: old => ({...fresh(), merit: Math.max(0, Math.floor(+old.merit || 0))}),
};
/** Brings any record we know to the current shape, filling what is missing and dropping what is malformed. Throws on a newer version. */
export function migrate(raw) {
  let r = raw && typeof raw === 'object' ? raw : {};
  let v = Number.isInteger(r.v) ? r.v : 0;
  if (v > VERSION) throw Object.assign(new Error(`saved by a newer version (${v})`), {newer: true});
  while (v < VERSION) { r = STEPS[v](r); v = r.v = v + 1; }
  const f = fresh(), out = {...f, ...r};
  out.merit = Math.max(0, Math.floor(+out.merit || 0)); out.earned = Math.max(0, Math.floor(+out.earned || 0));
  out.ranks = {...f.ranks}; for (const k of STATS) out.ranks[k] = Math.max(0, Math.min(5, Math.floor(+(r.ranks || {})[k] || 0)));
  out.unlocked = {...f.unlocked}; for (const k in f.unlocked) out.unlocked[k] = Array.isArray((r.unlocked || {})[k]) ? r.unlocked[k].filter(x => typeof x === 'string') : [];
  out.seen = {...f.seen}; for (const k of KINDS) out.seen[k] = Array.isArray((r.seen || {})[k]) ? [...new Set(r.seen[k].filter(x => typeof x === 'string'))] : [];
  out.tier = Math.max(0, Math.floor(+out.tier || 0)); out.tiersOpen = Math.max(1, Math.floor(+out.tiersOpen || 1)); if (out.tier >= out.tiersOpen) out.tier = out.tiersOpen - 1;
  out.weapon = typeof out.weapon === 'string' ? out.weapon : '';
  out.runs = Math.max(0, Math.floor(+out.runs || 0)); out.best = {t: +(r.best || {}).t || 0, bosses: +(r.best || {}).bosses || 0};
  out.last = Array.isArray(r.last) ? r.last.slice(-5) : [];
  out.v = VERSION;
  return out;
}

// ---- the code: MUYE1. base64url of the JSON . a 6-hex check, so a code cut short or mistyped is refused, not half-read
function check(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6); }
const toB64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export function exportCode(meta) { const body = toB64(JSON.stringify(meta)); return `MUYE${VERSION}.${body}.${check(body)}`; }
/** Reads a code. Returns the migrated record, or throws with `why`: 'shape' | 'check' | 'newer'. */
export function importCode(code) {
  const m = String(code || '').replace(/\s+/g, '').match(/^MUYE(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-f]{6})$/);
  if (!m) throw Object.assign(new Error('not a Muye code'), {why: 'shape'});
  if (check(m[2]) !== m[3]) throw Object.assign(new Error('the code is damaged'), {why: 'check'});
  let raw; try { raw = JSON.parse(fromB64(m[2])); } catch { throw Object.assign(new Error('the code is damaged'), {why: 'check'}); }
  try { return migrate(raw); } catch (e) { throw Object.assign(e, {why: e.newer ? 'newer' : 'shape'}); }
}

/** The store: load once, save on every change. If storage is closed (private mode) it still works for this visit and says so. */
export function createMetaStore(storage = globalThis.localStorage) {
  let ok = true, newer = false, meta;
  try {
    const s = storage.getItem(KEY);
    meta = s ? migrate(JSON.parse(s)) : fresh();
  } catch (e) {
    if (e && e.newer) { newer = true; meta = fresh(); }      // a newer page saved here: keep its record, play on a fresh one, save nothing
    else if (e instanceof SyntaxError) { try { storage.setItem(KEY + '.damaged', storage.getItem(KEY)); } catch { /* nothing */ } meta = fresh(); }
    else { ok = false; meta = fresh(); }
  }
  const save = () => { if (newer) return false; try { storage.setItem(KEY, JSON.stringify(meta)); return true; } catch { ok = false; return false; } };
  return {
    get meta() { return meta; }, get ok() { return ok; }, get newer() { return newer; },
    save,
    replace(next) { meta = migrate(next); newer = false; return save(); },
    /** First meeting with a thing; returns true when it is new to the codex. */
    see(kind, id) { const list = meta.seen[kind]; if (!list || !id || list.includes(id)) return false; list.push(id); return true; },
  };
}
