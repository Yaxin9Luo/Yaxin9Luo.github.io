// Agreement bars and the two-grader page scatter.
(function () {
  const {fmt, tip, onView, onTheme} = kit;
  const ROWS = [['baseline', 'baseline harness', '--lenient', 'o'], ['F0', 'outcome only', '--f0', 'o'], ['F1a', 'failed items', '--f1', 'o'],
    ['F2L1', 'full feedback · prompt-level', '--f2', 'o'], ['F2L3', 'full feedback · control-loop', '--f2', 'd']];
  const on = Object.fromEntries(ROWS.map(r => [r[0], true]));

  const agree = document.getElementById('agree');
  const items = [['clear', 'pages differ clearly'], ['slight', 'pages differ slightly'], ['all', 'all non-tied pairs']];
  agree.innerHTML = items.map(([k, lab]) => {
    const a = D.agree[k];
    const z = 1.645, p = a.a / a.n, c = (p + z * z / (2 * a.n)) / (1 + z * z / a.n), h = z * Math.sqrt(p * (1 - p) / a.n + z * z / (4 * a.n * a.n)) / (1 + z * z / a.n);
    const ci = `90%: ${Math.round(100 * Math.max(0, c - h))}–${Math.round(100 * Math.min(1, c + h))}%`;
    return `<div style="margin:0 0 16px"><div style="display:flex;flex-wrap:wrap;gap:2px 10px;justify-content:space-between;font-size:12.5px"><span>${lab}</span><b class="label" style="color:var(--ink)">${a.a} of ${a.n} <span style="color:var(--faint);font-weight:500">· ${ci}</span></b></div>
      <div style="position:relative;height:12px;background:var(--surface-2);border-radius:3px;margin-top:6px"><div class="agree-fill" data-w="${100 * a.a / a.n}" style="position:absolute;inset:0 auto 0 0;width:0;background:var(--strict);border-radius:3px;transition:width var(--d3) var(--ease)"></div>
      <div style="position:absolute;top:-4px;bottom:-4px;left:50%;border-left:1px dashed var(--faint)"></div></div></div>`;
  }).join('') + '<p class="note">Dashed line: 50%, a coin flip. This study\'s held-out gains (0.03–0.18) appear to fall in the slight regime.</p>';
  onView(agree, () => agree.querySelectorAll('.agree-fill').forEach(b => b.style.width = b.dataset.w + '%'));

  const chips = document.getElementById('chips');
  ROWS.forEach(([k, lab, col, sh]) => {
    const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<i class="${sh === 'd' ? 'd' : ''}" style="background:var(${col})"></i>${lab}`;
    b.onclick = () => { on[k] = !on[k]; b.setAttribute('aria-pressed', on[k]); draw(); };
    chips.appendChild(b);
  });

  const S = document.getElementById('plot'), W = 330, H = 300, m = {l: 34, r: 8, t: 6, b: 30}, lo = 0.4, hi = 1.0;
  const x = v => m.l + (Math.max(lo, v) - lo) / (hi - lo) * (W - m.l - m.r), y = v => H - m.b - (Math.max(lo, v) - lo) / (hi - lo) * (H - m.t - m.b);
  function draw() {
    let g = '';
    for (let t = 0.4; t <= 1.0001; t += 0.2) g += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${y(lo)}" y2="${y(hi)}"/><line class="grid" y1="${y(t)}" y2="${y(t)}" x1="${x(lo)}" x2="${x(hi)}"/><text x="${x(t)}" y="${H - m.b + 14}" text-anchor="middle">${t.toFixed(1)}</text><text x="${m.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t.toFixed(1)}</text>`;
    g += `<line x1="${x(lo)}" y1="${y(lo)}" x2="${x(hi)}" y2="${y(hi)}" stroke="var(--faint)" stroke-dasharray="3 3"/><text x="${x(0.98)}" y="${y(0.995)}" text-anchor="end">same score</text>`;
    g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle">lenient grader</text><text transform="translate(9 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">strict grader</text>`;
    D.pages.forEach((p, i) => {
      const r = ROWS.find(r => r[0] === p.v); if (!on[p.v]) return;
      const cx = x(p.l), cy = y(p.s), c = `var(${r[2]})`;
      g += r[3] === 'd' ? `<rect data-i="${i}" x="${cx - 4}" y="${cy - 4}" width="8" height="8" transform="rotate(45 ${cx} ${cy})" fill="${c}" stroke="var(--surface)"/>` : `<circle data-i="${i}" cx="${cx}" cy="${cy}" r="4.4" fill="${c}" stroke="var(--surface)"/>`;
    });
    S.innerHTML = g;
  }
  S.addEventListener('pointerover', e => {
    const i = e.target.dataset && e.target.dataset.i; if (i === undefined) return;
    const p = D.pages[i], r = ROWS.find(r => r[0] === p.v);
    tip.show(`<b>${r[1]}</b><br>lenient ${p.l.toFixed(3)} · strict ${p.s.toFixed(3)}<br>change ${fmt(p.s - p.l, 3, true)}`, e);
  });
  S.addEventListener('pointermove', e => tip.move(e)); S.addEventListener('pointerout', () => tip.hide());
  draw(); onTheme(draw);
})();
