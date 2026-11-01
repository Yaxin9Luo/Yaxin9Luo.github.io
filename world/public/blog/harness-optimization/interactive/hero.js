// Hero: one scrubber moves every gain and every page from the lenient grader (t = 0) to the strict grader (t = 1).
(function () {
  const {lerp, fmt, ICON, player, onView, tip, css, onTheme} = kit;
  const bars = document.getElementById('bars'), dots = document.getElementById('dots');
  const range = document.getElementById('t'), playBtn = document.getElementById('play'), lost = document.getElementById('lost');
  const W = 340, H = 236, rowH = 52, top = 14;

  // Bars: gain over the baseline, x from -0.04 to 0.24.
  const bx = v => 112 + (v + 0.04) / 0.28 * (W - 112 - 46);
  // Dots: page score, x from 0.3 to 1.0; one row for the baseline and one per harness.
  const ROWS = [{key: 'baseline', name: 'baseline harness', color: '--lenient', shape: 'o'}, ...D.arms];
  const dx = v => 112 + (Math.max(0.3, v) - 0.3) / 0.7 * (W - 112 - 10), dRow = 42;
  const jitter = D.pages.map((p, i) => ((i * 7919) % 17) / 17 - 0.5);

  function frame(t) {
    let g = '';
    [0, 0.1, 0.2].forEach(v => g += `<line class="grid" x1="${bx(v)}" x2="${bx(v)}" y1="${top - 6}" y2="${top + rowH * 4 - 8}"/><text x="${bx(v)}" y="${top + rowH * 4 + 6}" text-anchor="middle">${v === 0 ? '0' : '+' + v.toFixed(1)}</text>`);
    D.arms.forEach((a, i) => {
      const y = top + i * rowH + 18, [l, lo, hi] = a.l, [s, slo, shi] = a.s;
      const v = lerp(l, s, t), vlo = lerp(lo, slo, t), vhi = lerp(hi, shi, t);
      g += `<text x="0" y="${y - 12}" style="font-family:var(--sans);font-size:11.5px;fill:var(--ink)">${a.name}</text>`;
      g += `<rect x="${bx(0)}" y="${y - 6}" width="${bx(l) - bx(0)}" height="12" rx="2" fill="none" stroke="var(--lenient)" stroke-dasharray="3 2"/>`;
      g += `<rect x="${Math.min(bx(0), bx(v))}" y="${y - 6}" width="${Math.abs(bx(v) - bx(0))}" height="12" rx="2" fill="var(${a.color})"/>`;
      g += `<line x1="${bx(vlo)}" x2="${bx(vhi)}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-width="1.2"/><line x1="${bx(vlo)}" x2="${bx(vlo)}" y1="${y - 4}" y2="${y + 4}" stroke="var(--ink)"/><line x1="${bx(vhi)}" x2="${bx(vhi)}" y1="${y - 4}" y2="${y + 4}" stroke="var(--ink)"/>`;
      if (a.shape === 'd') g += `<rect x="${bx(v) - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${bx(v)} ${y})" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.3"/>`;
      g += `<text x="${W}" y="${y + 4}" text-anchor="end" style="fill:var(--ink)">${fmt(v, 3, true)}</text>`;
      if (t > 0.02) g += `<text x="${W}" y="${y + 17}" text-anchor="end" style="fill:var(--rev)">${Math.round(100 * (1 - v / l))}% lost</text>`;
    });
    bars.innerHTML = `<line class="axis" x1="${bx(0)}" x2="${bx(0)}" y1="${top - 6}" y2="${top + rowH * 4 - 8}"/>` + g;

    let d = '';
    [0.4, 0.6, 0.8, 1.0].forEach(v => d += `<line class="grid" x1="${dx(v)}" x2="${dx(v)}" y1="4" y2="${8 + dRow * 5}"/><text x="${dx(v)}" y="${dRow * 5 + 22}" text-anchor="middle">${v.toFixed(1)}</text>`);
    ROWS.forEach((r, i) => {
      const y = 22 + i * dRow, ps = D.pages.map((p, j) => [p, j]).filter(([p]) => p.v === r.key);
      d += `<text x="0" y="${y + 4}" style="font-family:var(--sans);font-size:11px;fill:var(--ink)">${r.name.replace(' · ', ' · ')}</text>`;
      const mean = ps.reduce((s, [p]) => s + lerp(p.l, p.s, t), 0) / ps.length;
      ps.forEach(([p, j]) => {
        const x = dx(lerp(p.l, p.s, t)), yy = y + jitter[j] * 18;
        d += r.shape === 'd'
          ? `<rect data-j="${j}" x="${x - 3.4}" y="${yy - 3.4}" width="6.8" height="6.8" transform="rotate(45 ${x} ${yy})" fill="var(${r.color})" stroke="var(--surface)" stroke-width="1"/>`
          : `<circle data-j="${j}" cx="${x}" cy="${yy}" r="3.8" fill="var(${r.color})" stroke="var(--surface)" stroke-width="1"/>`;
      });
      d += `<line x1="${dx(mean)}" x2="${dx(mean)}" y1="${y - 13}" y2="${y + 13}" stroke="var(--ink)" stroke-width="2"/>`;
    });
    dots.innerHTML = d;
    const best = D.arms[3];
    lost.textContent = Math.round(100 * (1 - lerp(best.l[0], best.s[0], t) / best.l[0])) + '%';
    range.value = t;
  }

  dots.addEventListener('pointerover', e => {
    const j = e.target.dataset && e.target.dataset.j; if (j === undefined) return;
    const p = D.pages[j], row = ROWS.find(r => r.key === p.v);
    tip.show(`<b>${row.name}</b><br>lenient ${p.l.toFixed(3)} → strict ${p.s.toFixed(3)} (${fmt(p.s - p.l, 3, true)})`, e);
  });
  dots.addEventListener('pointermove', e => tip.move(e));
  dots.addEventListener('pointerout', () => tip.hide());

  const setIcon = () => { playBtn.innerHTML = p.playing ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', p.playing ? 'Pause' : 'Play'); };
  const p = player({seconds: 2.6, render: frame, onEnd: setIcon});
  playBtn.onclick = () => { p.playing ? p.pause() : p.play(); setIcon(); };
  range.oninput = () => { p.pause(); setIcon(); p.set(+range.value); };
  const reset = document.getElementById('reset'); reset.innerHTML = ICON.reset;
  reset.onclick = () => { p.pause(); p.set(0); setIcon(); };
  setIcon(); frame(0);
  onTheme(() => frame(p.t));
  // Play once when the figure first scrolls into view.
  onView(document.querySelector('.stage'), () => setTimeout(() => { if (p.t === 0) { p.play(); setIcon(); } }, 500));
})();
