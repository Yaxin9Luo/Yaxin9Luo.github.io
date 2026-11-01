// Keep-rule model: P(keep) = P(mean of n paired differences >= bar), each difference ~ N(gain, 2·noise²).
(function () {
  const {onTheme, reduced, fit} = kit;
  const S = {gain: 0.05, noise: 0.06, tasks: 6, bar: 0.0514};
  const C = [['gain', 'true gain of the edit', -0.05, 0.2, 0.005, 3], ['noise', 'per-task standard deviation', 0, 0.12, 0.005, 3],
    ['tasks', 'dev tasks', 2, 30, 1, 0], ['bar', 'keep bar', 0, 0.12, 0.0005, 4]];
  const ctl = document.getElementById('ctl');
  C.forEach(([k, lab, lo, hi, st]) => {
    const d = document.createElement('label');
    d.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>${lab}</span><b id="v-${k}" class="label" style="color:var(--ink)"></b></div><input type="range" min="${lo}" max="${hi}" step="${st}" value="${S[k]}" aria-label="${lab}">`;
    d.querySelector('input').oninput = e => { S[k] = +e.target.value; draw(); };
    ctl.appendChild(d);
  });
  const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const sd = () => S.noise * Math.sqrt(2 / S.tasks);
  const pk = g => sd() === 0 ? (g >= S.bar ? 1 : 0) : 1 - Phi((S.bar - g) / sd());
  function draw() {
    C.forEach(([k, , , , , dg]) => document.getElementById('v-' + k).textContent = S[k].toFixed(dg));
    const p = pk(S.gain);
    document.getElementById('p').textContent = Math.round(100 * p) + '%';
    document.getElementById('ptext').textContent = S.gain > 0 ? `chance that an edit which truly gains ${S.gain.toFixed(3)} is kept` : 'chance that an edit which does not help is kept anyway';
    const H = 200, W = fit(document.getElementById('curve'), H), m = {l: 38, r: 12, t: 10, b: 30}, lo = -0.05, hi = 0.2;
    const x = v => m.l + (v - lo) / (hi - lo) * (W - m.l - m.r), y = v => H - m.b - v * (H - m.t - m.b);
    let g = '';
    [0, 0.5, 1].forEach(t => g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t * 100}%</text>`);
    [-0.05, 0, 0.05, 0.1, 0.15, 0.2].forEach(t => g += `<text x="${x(t)}" y="${H - m.b + 14}" text-anchor="middle">${t.toFixed(2)}</text>`);
    g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle">true gain of the edit</text>`;
    let d = '';
    for (let v = lo; v <= hi + 1e-9; v += 0.0025) d += (d ? 'L' : 'M') + x(v).toFixed(1) + ',' + y(pk(v)).toFixed(1);
    g += `<rect x="${x(S.bar - 2 * sd())}" y="${y(1)}" width="${Math.max(0, x(S.bar + 2 * sd()) - x(S.bar - 2 * sd()))}" height="${y(0) - y(1)}" fill="var(--rev)" opacity=".07"/>`;
    g += `<line x1="${x(S.bar)}" x2="${x(S.bar)}" y1="${y(0)}" y2="${y(1)}" stroke="var(--faint)" stroke-dasharray="3 3"/><text x="${x(S.bar) + 5}" y="${y(1) + 10}">bar</text>`;
    g += `<text x="${x(S.bar + 2 * sd()) - 4}" y="${y(0.04)}" text-anchor="end" style="fill:var(--rev)">coin-flip zone</text>`;
    g += `<path d="${d}" fill="none" stroke="var(--kept)" stroke-width="2.2"/><circle cx="${x(S.gain)}" cy="${y(p)}" r="5.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`;
    document.getElementById('curve').innerHTML = g;
  }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  document.getElementById('run').onclick = () => {
    const dots = document.getElementById('dots'), tally = document.getElementById('tally'); dots.innerHTML = '';
    let kept = 0, i = 0;
    const one = () => {
      let s = 0; for (let j = 0; j < S.tasks; j++) s += S.gain + S.noise * gauss() - S.noise * gauss();
      const keep = s / S.tasks >= S.bar; kept += keep;
      const e = document.createElement('span'); e.title = keep ? 'kept' : 'reverted';
      e.style.cssText = `width:14px;height:14px;border-radius:${keep ? '50%' : '3px'};background:var(${keep ? '--kept' : '--rev'});transition:transform var(--d2) var(--ease);transform:scale(0)`;
      dots.appendChild(e); requestAnimationFrame(() => e.style.transform = 'scale(1)');
      tally.textContent = `${kept} kept · ${i + 1 - kept} reverted`;
      if (++i < 40) reduced ? one() : setTimeout(one, 35);
    };
    one();
  };
  addEventListener('resize', draw);
  draw(); onTheme(draw);
})();
