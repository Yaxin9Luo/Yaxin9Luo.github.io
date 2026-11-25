// The timeline strip at the top (PLAN-CAMPAIGN section 8): the thirty minutes as three stretches, the bosses as marks on
// them, where the run is now, and when the next boss comes. Read from the campaign table, never from a copy of it.
import {runLength, nameOf} from './campaign.js';

const clock = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export {clock as shortClock};
const SEAL = {wenzhong: '闻', kongxuan: '孔', yuanhong: '袁', zhouwang: '纣'};

/** The strip's markup for a campaign table. `reached`: the furthest time to mark (the end sheet uses it); `lang`. */
export function timelineHTML(C, lang, {end = null} = {}) {
  const L = runLength(C), pct = t => (100 * t / L).toFixed(3);
  const segs = C.stretches.map(s => {
    const to = s.big.t, w = 100 * (to - s.from) / L;
    const k = end == null ? 0 : Math.max(0, Math.min(1, (end - s.from) / (to - s.from)));
    return `<li class="seg" data-i="${s.index}" style="left:${pct(s.from)}%;width:${w.toFixed(3)}%"><i class="done"${k ? ` style="transform:scaleX(${k.toFixed(3)})"` : ''}></i><span>${s.name[lang] || s.name.en}</span></li>`;
  }).join('');
  const past = t => end != null && t <= end ? ' past' : '';
  const marks = C.stretches.flatMap(s => [...s.small.map(t => `<b class="mk small${past(t)}" style="left:${pct(t)}%" data-t="${t}"></b>`), `<b class="mk big${past(s.big.t)}" style="left:${pct(s.big.t)}%" data-t="${s.big.t}">${SEAL[s.big.kind] || '将'}</b>`]).join('');
  const fin = C.final ? `<b class="mk final" style="left:100%" data-t="${L}">${SEAL[C.final.kind] || '纣'}</b>` : '';
  return `<ol class="segs">${segs}</ol>${marks}${fin}<i class="now"${end != null ? ` style="left:${pct(Math.min(end, L))}%"` : ''}></i>`;
}

export function createTimeline(root, sim) {
  let key = '', last = {};
  return {
    reset() { key = ''; last = {}; },
    update(cp, game, lang, t) {
      const C = cp.C, L = runLength(C), k = `${lang}|${C.stretches.length}`;
      if (k !== key) { key = k; root.querySelector('.tl-track').innerHTML = timelineHTML(C, lang); last = {}; }
      const now = Math.min(game.t, L);
      const nowEl = root.querySelector('.now');
      nowEl.style.left = `${(100 * now / L).toFixed(3)}%`;
      // each stretch fills as it passes
      for (const seg of root.querySelectorAll('.seg')) {
        const s = C.stretches[+seg.dataset.i], k2 = Math.max(0, Math.min(1, (game.t - s.from) / (s.big.t - s.from)));
        const done = seg.firstElementChild; const v = k2.toFixed(3); if (done.dataset.v !== v) { done.dataset.v = v; done.style.transform = `scaleX(${v})`; }
        seg.classList.toggle('cur', cp.stretch === s.index);
      }
      for (const mk of root.querySelectorAll('.mk')) mk.classList.toggle('past', +mk.dataset.t <= game.t);
      // the words at the right: the march, the boss on the field, or the next boss and how long until he comes
      let words;
      // a run that ends at a boss (the M1 build: `until`) names nothing past him; while he is on the field, he is the battle
      const end = cp.until && C.stretches.find(s => s.big.kind === cp.until), endT = end ? end.big.t : Infinity;
      const facing = cp.bar && game.foes.find(f => f.id === cp.bar);
      if (cp.march > 0) words = `<em>${t.march}</em>`;
      else if (facing && (!cp.next || cp.next.t > endT)) words = `${t.facing} <strong>${nameOf(sim, facing.kind, lang).name}</strong>`;
      else if (cp.next && cp.next.t > endT) words = '';
      else if (cp.next) {
        const who = cp.next.kind ? nameOf(sim, cp.next.kind, lang).name : t.nextSmall;
        words = `${t.next} <strong>${who}</strong> <span class="in">${clock(cp.next.t - game.t)}</span>`;
      } else if (cp.guards) words = `<em>${t.finalStretch}</em>`;
      else words = '';
      if (last.words !== words) { last.words = words; root.querySelector('.next').innerHTML = words; }
      root.classList.toggle('soon', !!cp.next && cp.next.t - game.t <= 10 && cp.next.t > game.t);
    },
  };
}
