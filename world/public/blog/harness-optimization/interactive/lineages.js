// Lineage explorer: every revision of a lineage with the Meta Agent's hypothesis and the keep rule's verdict.
(function () {
  const {fmt, onTheme, fit} = kit;
  const L = D, sel = document.getElementById('pick');
  let cur = 0, pick = 1;
  const groups = {};
  L.forEach((l, i) => (groups[l.stage] = groups[l.stage] || []).push([i, l]));
  Object.entries(groups).forEach(([stage, ls]) => {
    const og = document.createElement('optgroup'); og.label = stage === 'strict grader' ? 'Stage 2 · strict grader' : 'Batch 1–2 · lenient grader';
    ls.forEach(([i, l]) => og.insertAdjacentHTML('beforeend', `<option value="${i}">${l.name}</option>`)); sel.appendChild(og);
  });
  const pref = L.findIndex(l => l.name.includes('control-loop') && l.stage === 'strict grader');
  if (pref >= 0) { cur = pref; sel.value = pref; }
  sel.onchange = () => { cur = +sel.value; pick = 1; draw(); };
  const REASON = {cleared: 'cleared its bar', below_bar: 'below the bar', more_flagged_runs: 'vetoed for more unstable (flagged) runs', more_failures: 'vetoed for more agent failures', over_time_cap: 'over the time cap'};
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function draw() {
    const l = L[cur], R = l.revs; document.getElementById('open').href = l.link;
    const C = document.getElementById('chart'), H = 210, W = fit(C, H), narrow = W < 460;
    const m = {l: 40, r: 30, t: 12, b: 28}, vals = R.map(r => r.dev);
    const short = s => !narrow ? s : s === 'baseline' ? 'base' : s.replace(/^iter-0*/, '#');
    const lo = Math.floor(Math.min(...vals) * 20) / 20 - 0.02, hi = Math.min(1, Math.ceil(Math.max(...vals) * 20) / 20 + 0.02);
    const x = i => m.l + i * (W - m.l - m.r) / Math.max(1, R.length - 1), y = v => H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
    const idx = Object.fromEntries(R.map((r, i) => [r.label, i]));
    let g = '';
    for (let t = Math.ceil(lo * 20) / 20; t <= hi + 1e-9; t += 0.05) g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t.toFixed(2)}</text>`;
    R.forEach((r, i) => {
      if (!r.parent || idx[r.parent] === undefined) return;
      const p = idx[r.parent], kept = r.outcome === 'keep';
      g += `<line x1="${x(p)}" y1="${y(R[p].dev)}" x2="${x(i)}" y2="${y(r.dev)}" stroke="var(${kept ? '--kept' : '--line-2'})" stroke-width="${kept ? 2.4 : 1.2}"/>`;
    });
    R.forEach((r, i) => {
      const c = r.outcome === 'keep' ? '--kept' : r.outcome === 'revert' ? '--rev' : '--lenient', s = i === pick;
      g += `<g data-i="${i}" style="cursor:pointer" tabindex="0" role="button" aria-label="${r.label}"><circle cx="${x(i)}" cy="${y(r.dev)}" r="16" fill="transparent"/><circle cx="${x(i)}" cy="${y(r.dev)}" r="${s ? 8 : 6}" fill="var(${c})" stroke="var(${s ? '--ink' : '--surface'})" stroke-width="2"/></g><text x="${x(i)}" y="${H - m.b + 16}" text-anchor="middle" style="${s ? 'fill:var(--ink)' : ''}">${short(r.label)}</text>`;
    });
    C.innerHTML = g;
    C.querySelectorAll('g[data-i]').forEach(e => { const go = () => { pick = +e.dataset.i; draw(); }; e.onclick = go; e.onkeydown = k => { if (k.key === 'Enter' || k.key === ' ') go(); }; });
    const r = R[Math.min(pick, R.length - 1)];
    const verdict = r.outcome === 'keep' ? '<b style="color:var(--kept)">kept</b>' : r.outcome === 'revert' ? '<b style="color:var(--rev)">reverted</b>' : '<b>starting harness</b>';
    // The rule's own terms: V5 = mean gain minus the price of slower runs; V7 = gain on the logit scale, plus the
    // value of cheaper runs, minus the price of extra unstable (flagged) runs.
    const out = r.out ? `, ${r.out} pair${r.out > 1 ? 's' : ''} left out` : '';
    const vs = r.cm != null ? `${r.cm.toFixed(3)} vs parent ${r.pm.toFixed(3)}, ` : '';
    const terms = r.v === 7
      ? [`logit ${fmt(r.lg, 3, true)}`, r.ct ? `${r.ct > 0 ? 'cheaper' : 'costlier'} runs ${fmt(r.ct, 3, true)}${r.cc && r.pc ? ` (${fmt(100 * (r.cc / r.pc - 1), 0, true)}% cost)` : ''}` : '',
        r.ft ? `${r.ft < 0 ? 'more' : 'fewer'} unstable runs ${fmt(r.ft, 3, true)}` : ''].filter(Boolean).join(' · ')
      : r.tt && Math.abs(r.tt) >= 0.0005 ? `${r.tt < 0 ? 'slower' : 'faster'} runs ${fmt(r.tt, 3, true)}` : '';
    const rule = r.diff == null ? '' : `<div class="label" style="margin:-2px 0 8px;line-height:1.6">dev score ${vs}gap ${fmt(r.diff, 3, true)}${out}`
      + (r.adj != null ? `<br>rule: ${terms ? terms + ' → ' : ''}<b style="color:var(--ink)">${fmt(r.adj, 3, true)}</b> against a bar of ${r.bar.toFixed(r.v === 7 ? 3 : 4)}${r.v === 7 ? ' (logit scale)' : ''}` : '') + '</div>';
    document.getElementById('card').innerHTML = `<div class="label" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px"><b style="color:var(--ink)">${r.label}</b>${verdict}${r.reason ? `<span>${REASON[r.reason] || r.reason}</span>` : ''}</div>${rule}`
      + `<div style="font-size:13.5px;line-height:1.55">${r.hyp ? '<span class="label">hypothesis · </span>' + esc(r.hyp) : '<span style="color:var(--muted)">The harness every lineage starts from.</span>'}</div>`;
  }
  addEventListener('resize', draw);
  draw(); onTheme(draw);
})();
