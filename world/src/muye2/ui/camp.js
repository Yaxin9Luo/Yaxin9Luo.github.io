// The place before a run (PLAN-CAMPAIGN section 8): one scroll case, opened. Its lid carries the name and three tags
// (weapon, merit, codex); below, one handscroll unrolls between two rollers and shows the tag chosen. One place, not
// three pop-ups. Keyboard: Q / E or the tags' numbers change the tag, arrows choose, Enter rides out.
import {WEAPONS_STANDIN, META_STANDIN} from './camp-data.js';
import {CODEX} from './codex-data.js';
import {exportCode, importCode} from './meta-store.js';
import {BOSS_NAMES, SPOIL_SIGN, nameOf as bossName} from './campaign.js';
import {spoilPic, spoilMarkHTML} from './spoil-pictures.js';
import {portrait, portraitsReady} from './portraits.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const PIGMENT = {fire: '#B8321F', water: '#2F4F7A', wood: '#3F7D6A', metal: '#B08A3C', earth: '#35302B'};
export const TABS = ['weapon', 'merit', 'codex'];
const CODEX_KINDS = ['treasure', 'general', 'boss', 'spoil', 'troop', 'foe'];

export function createCamp({root, sim, store, words, onBegin, onChange}) {
  let tab = 'weapon', codexKind = 'treasure', codexId = '', unrollAt = 0, note = '', noteBad = false;
  const lang = () => words().lang, t = () => words();
  const nm = x => x ? x[lang()] || x.en : '';
  const weapons = () => (sim.CONTENT.weapons && sim.CONTENT.weapons.length ? sim.CONTENT.weapons : WEAPONS_STANDIN);
  const META = () => sim.META || META_STANDIN;
  const standin = () => !sim.META || !sim.CONTENT.weapons;
  const meta = () => store.meta;
  const isUnlocked = (kind, id) => { const M = META(); if (kind === 'weapon' && (M.start.weapons || []).includes(id)) return true; const u = M.unlocks.find(x => x.kind === kind && x.id === id); return !u || meta().unlocked[kind + 's'].includes(id); };
  const chosenWeapon = () => { const w = weapons(), m = meta(); return w.find(r => r.id === m.weapon && isUnlocked('weapon', r.id)) || w.find(r => isUnlocked('weapon', r.id)) || w[0]; };

  /* ---------- the three panels ---------- */
  function weaponPanel() {
    const cur = chosenWeapon(), M = META();
    const slips = weapons().map((w, i) => {
      const open = isUnlocked('weapon', w.id), u = M.unlocks.find(x => x.kind === 'weapon' && x.id === w.id);
      return `<button class="wslip${w.id === cur.id ? ' on' : ''}${open ? '' : ' locked'}" data-weapon="${w.id}" aria-pressed="${w.id === cur.id}" ${open ? '' : 'aria-disabled="true"'}>
        <span class="wsign" aria-hidden="true">${esc(w.sign || nm(w.name)[0])}</span><strong>${esc(nm(w.name))}</strong>
        <span class="wtext">${esc(nm(w.text))}</span><em>${esc(nm(w.suits))}</em>
        ${w.id === cur.id ? '<i class="stamp" aria-hidden="true">选</i>' : ''}${open ? (w.id === cur.id ? `<span class="wstate">${t().chosen}</span>` : `<span class="wstate">${t().choose}</span>`) : `<span class="wstate lock">${t().lockedFor(u ? u.cost : '?')}</span>`}<kbd>${i + 1}</kbd></button>`;
    }).join('');
    const hero = portrait('wuwang', 'full');
    return `<div class="panel-head"><h2>${t().pickWeapon}</h2><p>${t().weaponNote}</p></div>
      <div class="wstage${hero ? ' with-hero' : ''}">${hero ? `<figure class="hero-fig"><img src="${hero}" alt="" loading="lazy" decoding="async"><figcaption>${t().heroName}</figcaption></figure>` : ''}<div class="wslips">${slips}</div></div>
      <ul class="how">${t().how.map(x => `<li>${x}</li>`).join('')}</ul>`;
  }
  function meritPanel() {
    const M = META(), m = meta();
    const stats = M.stats.map(s => {
      const r = m.ranks[s.id] || 0, next = s.levels[r], can = next && m.merit >= next.cost;
      return `<li><span class="sname">${esc(nm(s.name))}</span><span class="pips5" aria-label="${r} / 5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</span>
        <span class="snow">${next ? `${esc(nm(next.text))}` : esc(nm(s.levels[4].text))}</span>
        ${next ? `<button class="buy" data-buy="${s.id}" ${can ? '' : 'disabled'} aria-label="${esc(nm(next.text))} · ${next.cost}">${next.cost}</button>` : `<span class="full">${t().full}</span>`}</li>`;
    }).join('');
    const unl = M.unlocks.map(u => {
      const have = m.unlocked[u.kind + 's'].includes(u.id), row = u.kind === 'weapon' ? weapons().find(w => w.id === u.id) : sim.BY && sim.BY[u.kind] && sim.BY[u.kind][u.id];
      const name = row ? nm(row.name) : u.id;
      return `<button class="unl${have ? ' have' : ''}" data-unlock="${u.kind}:${u.id}" ${have || m.merit < u.cost ? 'disabled' : ''}><span class="ukind">${t().kinds[u.kind] || u.kind}</span><strong>${esc(name)}</strong><b>${have ? t().owned : u.cost}</b></button>`;
    }).join('');
    const tiers = M.tiers.map(x => `<button class="tier${m.tier === x.tier ? ' on' : ''}" data-tier="${x.tier}" ${x.tier < m.tiersOpen ? '' : 'disabled'}><strong>${esc(nm(x.name))}</strong><span>${x.tier < m.tiersOpen ? esc(nm(x.text)) : t().tierLocked}</span></button>`).join('');
    return `<div class="panel-head"><h2>${t().merit}</h2><p class="purse"><b>${m.merit.toLocaleString('en-US')}</b><span>${t().meritNow}</span></p><p>${t().meritNote}</p></div>
      <div class="merit-cols"><section><h3>${t().stats}</h3><ul class="stats">${stats}</ul></section>
      <section><h3>${t().unlocks}</h3><div class="unls">${unl}</div><h3>${t().tiers}</h3><div class="tiers">${tiers}</div>
      <h3>${t().save}</h3><p class="savenote">${store.newer ? t().saveNewer : store.ok ? t().saveNote : t().saveOff}</p>
      <div class="saverow"><button class="plain sm" data-do="export">${t().exportCode}</button><input id="import-code" spellcheck="false" autocomplete="off" placeholder="MUYE1.…" aria-label="${t().importLabel}"><button class="plain sm" data-do="import">${t().importBtn}</button></div>
      <p class="savemsg${noteBad ? ' bad' : ''}" role="status">${esc(note)}</p></section></div>`;
  }
  function codexPanel() {
    const seen = meta().seen;
    const entries = kind => Object.keys(CODEX[kind] || {});
    const list = entries(codexKind);
    if (!codexId || !list.includes(codexId)) codexId = list.find(id => seen[codexKind].includes(id)) || list[0];
    const nameOf = (kind, id) => {
      const by = kind === 'boss' || kind === 'foe' ? sim.BY.foe : sim.BY[kind], row = by && by[id];
      if (row && row.name) return row.name; if (BOSS_NAMES[id]) return BOSS_NAMES[id].name; return {en: id, zh: id};
    };
    const tabs = CODEX_KINDS.map(k => { const n = entries(k).length, s = entries(k).filter(id => seen[k].includes(id)).length; return `<button class="ckind${k === codexKind ? ' on' : ''}" data-ckind="${k}">${t().codexKinds[k]}<b>${s}/${n}</b></button>`; }).join('');
    const items = list.map(id => { const open = seen[codexKind].includes(id), n = nameOf(codexKind, id); return `<button class="centry${id === codexId ? ' on' : ''}${open ? '' : ' closed'}${open && portrait(id) ? ' has-face' : ''}" data-centry="${id}">${open && portrait(id) ? `<img src="${portrait(id)}" alt="" loading="lazy" decoding="async">` : ''}${open ? esc(n.zh) : '？'}<small>${open ? esc(lang() === 'zh' ? '' : n.en) : t().unmet}</small></button>`; }).join('');
    const e = CODEX[codexKind][codexId], open = seen[codexKind].includes(codexId), n = nameOf(codexKind, codexId);
    const row = (codexKind === 'boss' || codexKind === 'foe' ? sim.BY.foe : sim.BY[codexKind] || {})[codexId] || {};
    const detail = !open ? `<div class="cread closed"><span class="cbig">？</span><p>${t().codexLocked}</p></div>`
      : `<div class="cread${portrait(codexId) ? ' with-bust' : codexKind === 'spoil' && spoilPic(codexId) ? ' with-pic' : ''}">${portrait(codexId) ? `<img class="cbust" src="${portrait(codexId)}" alt="" loading="lazy" decoding="async">` : codexKind === 'spoil' ? (spoilPic(codexId) ? `<span class="cbig spoil pic">${spoilMarkHTML(codexId, esc, false)}</span>` : `<span class="cbig spoil">${esc(SPOIL_SIGN[codexId] || n.zh[0])}</span>`) : `<span class="cbig" style="${row.element ? `--pig:${PIGMENT[row.element]}` : ''}">${esc(n.zh[0])}</span>`}<h3>${esc(n.zh)}${lang() === 'zh' ? '' : ` <small>${esc(n.en)}</small>`}</h3>
        ${row.title ? `<p class="ctitle">${esc(nm(row.title))}</p>` : ''}${codexKind === 'general' && (seen.form || []).includes(codexId) && row.trueForm && row.trueForm.title ? `<p class="ctitle cform">${esc(t().trueFormOf ? t().trueFormOf(nm(row.trueForm.title)) : nm(row.trueForm.title))}</p>` : ''}${codexKind === 'spoil' && row.from ? `<p class="ctitle">${esc(t().spoilFrom(bossName(sim, row.from, lang()).name))}</p><p class="ctext">${esc(nm(row.text))}</p>` : ''}
        ${e.quote ? `<blockquote lang="zh-Hant">「${esc(e.quote)}」</blockquote><p class="cch">${t().chapter(e.ch)}${e.who ? ` · ${esc(e.who)}` : ''}</p>${lang() === 'zh' ? '' : `<p class="cgloss">${esc(String(e.en || '').replace(/^Gloss:\s*/, ''))}</p>`}` : `<p class="cch">${t().noQuote}</p>`}</div>`;
    return `<div class="panel-head"><h2>${t().codex}</h2><p>${t().codexNote}</p></div><div class="ckinds">${tabs}</div><div class="cbody"><div class="clist">${items}</div>${detail}</div>`;
  }

  function render(unroll) {
    const T = t(), cur = chosenWeapon();
    const panel = tab === 'weapon' ? weaponPanel() : tab === 'merit' ? meritPanel() : codexPanel();
    const keepCode = root.querySelector('#import-code') ? root.querySelector('#import-code').value : '';
    root.innerHTML = `<div class="lid"><span class="seal" aria-hidden="true">周</span><h1>${T.name}<small>${T.other}</small></h1>
        <nav class="tags" role="tablist">${TABS.map((k, i) => `<button class="tag-${k}${tab === k ? ' on' : ''}" role="tab" aria-selected="${tab === k}" data-tab="${k}"><span>${T.tabs[k]}</span><kbd>${'QWE'[i]}</kbd></button>`).join('')}</nav>
        <div class="ride"><span class="purse-sm">${T.meritShort} <b>${meta().merit.toLocaleString('en-US')}</b></span><button class="go" data-do="begin">${T.start} · ${esc(nm(cur.name))}<kbd>Enter</kbd></button><span class="note" id="load-line" role="status"></span></div></div>
      <div class="scroll${unroll ? ' unroll' : ''}"><i class="roller l"></i><div class="paper" role="tabpanel">${panel}${standin() ? `<p class="standin">${T.standin}</p>` : ''}</div><i class="roller r"></i></div>`;
    const code = root.querySelector('#import-code'); if (code) code.value = keepCode;
    if (unroll) unrollAt = performance.now();
  }
  function setTab(k) { if (!TABS.includes(k) || k === tab) return; tab = k; note = ''; render(true); onChange && onChange('tab'); }
  function buy(kind, id) {
    const m = meta(), M = META();
    if (kind === 'stat') { const s = M.stats.find(x => x.id === id), r = m.ranks[id] || 0, next = s && s.levels[r]; if (!next || m.merit < next.cost) return false; m.merit -= next.cost; m.ranks[id] = r + 1; }
    else { const u = M.unlocks.find(x => x.kind === kind && x.id === id); if (!u || m.merit < u.cost || m.unlocked[kind + 's'].includes(id)) return false; m.merit -= u.cost; m.unlocked[kind + 's'].push(id); }
    store.save(); render(false); onChange && onChange('buy'); return true;
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) setTab(b.dataset.tab);
    else if (b.dataset.weapon) { if (isUnlocked('weapon', b.dataset.weapon)) { meta().weapon = b.dataset.weapon; store.save(); render(false); onChange && onChange('weapon'); } else { setTab('merit'); } }
    else if (b.dataset.buy) buy('stat', b.dataset.buy);
    else if (b.dataset.unlock) { const [k, id] = b.dataset.unlock.split(':'); buy(k, id); }
    else if (b.dataset.tier) { meta().tier = +b.dataset.tier; store.save(); render(false); }
    else if (b.dataset.ckind) { codexKind = b.dataset.ckind; codexId = ''; render(false); }
    else if (b.dataset.centry) { codexId = b.dataset.centry; render(false); }
    else if (b.dataset.do === 'export') {
      const code = exportCode(meta()), input = root.querySelector('#import-code');
      const done = ok => { note = ok ? t().copied : t().copyHere; noteBad = false; render(false); const i2 = root.querySelector('#import-code'); if (!ok && i2) { i2.value = code; i2.select(); } };
      void input;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => done(true), () => done(false)); else done(false);
    } else if (b.dataset.do === 'import') {
      const v = (root.querySelector('#import-code') || {}).value || '';
      try { const next = importCode(v); if (!confirm(t().importConfirm(next.merit))) return; store.replace(next); note = t().imported; noteBad = false; root.querySelector('#import-code').value = ''; }
      catch (err) { note = t().importBad[err.why] || t().importBad.shape; noteBad = true; }
      render(false); onChange && onChange('import');
    } else if (b.dataset.do === 'begin') onBegin();
  });
  portraitsReady.then(() => { if (root.isConnected && !root.hidden && root.firstElementChild) render(false); });
  return {
    render, setTab,
    get tab() { return tab; },
    weapon: () => chosenWeapon(),
    /** Keys while the camp is up; returns true when a key was used. */
    key(k, inField) {
      if (inField) return false;
      if (k === 'q' || k === 'e' || k === 'w') { const i = {q: 0, w: 1, e: 2}[k]; setTab(TABS[i]); return true; }
      if (tab === 'weapon' && (k === 'ArrowLeft' || k === 'ArrowRight' || /^[1-5]$/.test(k))) {
        const list = weapons().filter(w => isUnlocked('weapon', w.id)), cur = chosenWeapon();
        let next = cur;
        if (/^[1-5]$/.test(k)) { const w = weapons()[+k - 1]; if (w && isUnlocked('weapon', w.id)) next = w; }
        else { const i = list.indexOf(cur); next = list[(i + (k === 'ArrowRight' ? 1 : list.length - 1)) % list.length]; }
        if (next !== cur) { meta().weapon = next.id; store.save(); render(false); }
        return true;
      }
      return false;
    },
    /** What createGame receives from the camp (SPEC-CAMPAIGN 1.6). `unlocked` only when the rules have their own unlock table. */
    options() {
      const m = meta(), o = {weapon: chosenWeapon().id, meta: {ranks: {...m.ranks}}, tier: m.tier};
      if (sim.META) o.meta.unlocked = {weapons: [...m.unlocked.weapons], generals: [...m.unlocked.generals], treasures: [...m.unlocked.treasures]};      // what was bought; the rules add META.start
      if (!sim.CONTENT.weapons) delete o.weapon;      // the rules know no weapons yet: the run opens as today
      return o;
    },
  };
}
