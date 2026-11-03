// Keep-rule model: P(keep) = P(mean of n paired differences >= bar), each difference ~ N(gain, 2·noise²).
// "Run 40 evaluations" drops each run's measured gain onto the chart's own axis, so the bar visibly splits kept from reverted.
(function () {
  const {onTheme, reduced, fit} = kit;
  const S = {gain: 0.05, noise: 0.06, tasks: 6, bar: 0.0514};
  const C = [['gain', 'true gain of the edit', -0.05, 0.2, 0.005, 3], ['noise', 'per-task standard deviation', 0, 0.12, 0.005, 3],
    ['tasks', 'dev tasks', 2, 30, 1, 0], ['bar', 'keep bar', 0, 0.12, 0.0005, 4]];
  const ctl = document.getElementById('ctl'), svg = document.getElementById('curve'), tally = document.getElementById('tally');
  let runs = [], timer = 0;
  C.forEach(([k, lab, lo, hi, st]) => {
    const d = document.createElement('label');
    d.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>${lab}</span><b id="v-${k}" class="label" style="color:var(--ink)"></b></div><input type="range" min="${lo}" max="${hi}" step="${st}" value="${S[k]}" aria-label="${lab}">`;
    // Moving a setting changes the edit being measured: the runs on screen no longer describe it.
    d.querySelector('input').oninput = e => { S[k] = +e.target.value; clear(); draw(); };
    ctl.appendChild(d);
  });
  const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const sd = () => S.noise * Math.sqrt(2 / S.tasks);
  const pk = g => sd() === 0 ? (g >= S.bar ? 1 : 0) : 1 - Phi((S.bar - g) / sd());
  const lo = -0.05, hi = 0.2, H = 250, m = {l: 38, r: 12, t: 22, b: 30}, strip = 40; // the runs' strip sits between the curve and its axis labels
  let W = 560;
  const x = v => m.l + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - m.l - m.r);
  const y = v => H - m.b - strip - v * (H - m.t - m.b - strip);
  function draw() {
    C.forEach(([k, , , , , dg]) => document.getElementById('v-' + k).textContent = S[k].toFixed(dg));
    const p = pk(S.gain);
    document.getElementById('p').textContent = Math.round(100 * p) + '%';
    document.getElementById('ptext').textContent = S.gain > 0 ? `chance that an edit which truly gains ${S.gain.toFixed(3)} is kept` : 'chance that an edit which does not help is kept anyway';
    W = fit(svg, H);
    const zl = x(S.bar - 2 * sd()), zr = x(S.bar + 2 * sd()), base = H - m.b;
    let g = '';
    [0, 0.5, 1].forEach(t => g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t * 100}%</text>`);
    g += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${base}" y2="${base}"/>`;
    [-0.05, 0, 0.05, 0.1, 0.15, 0.2].forEach(t => g += `<text x="${x(t)}" y="${base + 14}" text-anchor="middle">${t.toFixed(2)}</text>`);
    g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle">gain of the edit</text>`;
    let d = '';
    for (let v = lo; v <= hi + 1e-9; v += 0.0025) d += (d ? 'L' : 'M') + x(v).toFixed(1) + ',' + y(pk(v)).toFixed(1);
    g += `<rect x="${zl}" y="${y(1)}" width="${Math.max(0, zr - zl)}" height="${base - y(1)}" fill="var(--rev)" opacity=".07"/>`;
    // Labels above the plot and in the margin, so neither the curve nor a run ever lands on them.
    g += `<text x="${(zl + zr) / 2}" y="${y(1) - 8}" text-anchor="middle" style="fill:var(--rev)">coin-flip zone</text>`;
    g += `<line x1="${x(S.bar)}" x2="${x(S.bar)}" y1="${base}" y2="${y(1)}" stroke="var(--faint)" stroke-dasharray="3 3"/><text x="${x(S.bar) + 5}" y="${y(1) + 12}">bar</text>`;
    g += `<text x="${m.l - 6}" y="${base - strip / 2 + 3.5}" text-anchor="end" style="fill:var(--faint)">runs</text>`;
    g += `<path d="${d}" fill="none" stroke="var(--kept)" stroke-width="2.2"/>`;
    g += `<line x1="${x(S.gain)}" x2="${x(S.gain)}" y1="${y(p)}" y2="${base}" stroke="var(--ink)" stroke-opacity=".25"/>`;
    g += `<circle cx="${x(S.gain)}" cy="${y(p)}" r="5.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`;
    g += '<g id="runs"></g>';
    svg.innerHTML = g;
    runs.forEach(r => place(r, false));
  }
  // A run lands in the strip at its measured gain, stacked over earlier runs that fell close by.
  function place(r, fresh) {
    const cx = x(r.v), row = runs.filter(q => q !== r && q.i < r.i && Math.abs(x(q.v) - cx) < 7).length % 5;
    const cy = H - m.b - 6 - row * 7, s = 6;
    const n = document.createElementNS('http://www.w3.org/2000/svg', r.keep ? 'circle' : 'rect');
    if (r.keep) { n.setAttribute('cx', cx); n.setAttribute('cy', cy); n.setAttribute('r', s / 2 + .5); }
    else { n.setAttribute('x', cx - s / 2); n.setAttribute('y', cy - s / 2); n.setAttribute('width', s); n.setAttribute('height', s); n.setAttribute('rx', 1); }
    n.setAttribute('fill', `var(${r.keep ? '--kept' : '--rev'})`);
    n.style.cssText = `transform-box:fill-box;transform-origin:center;transition:transform var(--d2) var(--ease),opacity var(--d2) var(--ease)${fresh && !reduced ? ';transform:translateY(-14px);opacity:0' : ''}`;
    svg.querySelector('#runs').appendChild(n);
    if (fresh && !reduced) requestAnimationFrame(() => requestAnimationFrame(() => { n.style.transform = ''; n.style.opacity = ''; }));
  }
  const say = () => { const k = runs.filter(r => r.keep).length; tally.textContent = runs.length ? `${k} of ${runs.length} kept` : ''; };
  function clear() { clearTimeout(timer); runs = []; say(); }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  document.getElementById('run').onclick = () => {
    clear(); draw();
    const one = () => {
      let s = 0; for (let j = 0; j < S.tasks; j++) s += S.gain + S.noise * gauss() - S.noise * gauss();
      const r = {i: runs.length, v: s / S.tasks, keep: s / S.tasks >= S.bar};
      runs.push(r); place(r, true); say();
      if (runs.length < 40) timer = reduced ? one() : setTimeout(one, 45);
    };
    one();
  };
  addEventListener('resize', draw);
  draw(); onTheme(draw);
})();
