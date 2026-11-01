// Before/after slider over the real pages one lineage built, with a strip of every revision for the chosen task.
(function () {
  const T = D.tasks, O = D.outcome;
  const ts = document.getElementById('task'), A = document.getElementById('a'), B = document.getElementById('b');
  const order = keys => keys.sort((x, y) => x === 'baseline' ? -1 : y === 'baseline' ? 1 : x.localeCompare(y));
  Object.keys(T).sort().forEach(t => ts.insertAdjacentHTML('beforeend', `<option>${t}</option>`));
  if (T['b16-edu-2092']) ts.value = 'b16-edu-2092';
  function opts() {
    const r = order(Object.keys(T[ts.value])); A.innerHTML = B.innerHTML = '';
    r.forEach(k => { A.insertAdjacentHTML('beforeend', `<option>${k}</option>`); B.insertAdjacentHTML('beforeend', `<option>${k}</option>`); });
    A.value = 'baseline'; B.value = r.includes('iter-003') ? 'iter-003' : r[r.length - 1];
  }
  const cmp = document.getElementById('cmp');
  const size = () => cmp.style.setProperty('--w', cmp.clientWidth + 'px');
  function show() {
    const t = T[ts.value], a = t[A.value], b = t[B.value];
    document.getElementById('ia').src = a.img; document.getElementById('ib').src = b.img;
    document.getElementById('la').textContent = `${A.value} · ${a.score.toFixed(3)}`;
    document.getElementById('lb').textContent = `${B.value} · ${b.score.toFixed(3)}`;
    const s = document.getElementById('strip'); s.innerHTML = '';
    order(Object.keys(t)).forEach(k => {
      const v = t[k], c = O[k] === 'revert' ? 'var(--rev)' : O[k] === 'keep' ? 'var(--kept)' : 'var(--line-2)';
      s.insertAdjacentHTML('beforeend', `<button data-k="${k}" aria-label="show ${k} on the right" style="padding:0;border:2px solid ${c};border-radius:8px;overflow:hidden;background:var(--bg);cursor:pointer;text-align:left;${k === B.value ? 'box-shadow:0 0 0 2px var(--ink)' : ''}"><img src="${v.img}" alt="" loading="lazy" style="display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top"><span class="label" style="display:block;padding:3px 6px">${k} · ${v.score.toFixed(2)}</span></button>`);
    });
    s.querySelectorAll('button').forEach(e => e.onclick = () => { B.value = e.dataset.k; show(); });
    size();
  }
  addEventListener('resize', size);
  // The divider moves only while it is held (mouse or touch); the page itself scrolls normally.
  const knob = document.getElementById('knob'), clip = document.getElementById('clip');
  const setP = p => { p = Math.max(0, Math.min(1, p)); clip.style.width = knob.style.left = p * 100 + '%'; knob.setAttribute('aria-valuenow', Math.round(p * 100)); };
  const at = e => { const r = cmp.getBoundingClientRect(); setP((e.clientX - r.left) / r.width); };
  let dragging = false;
  knob.addEventListener('pointerdown', e => { dragging = true; knob.setPointerCapture(e.pointerId); at(e); e.preventDefault(); });
  knob.addEventListener('pointermove', e => { if (dragging) at(e); });
  knob.addEventListener('pointerup', () => { dragging = false; }); knob.addEventListener('pointercancel', () => { dragging = false; });
  cmp.addEventListener('click', e => { if (e.target === knob || knob.contains(e.target)) return; at(e); });
  knob.addEventListener('keydown', e => { const w = parseFloat(clip.style.width) / 100 || 0.5; if (e.key === 'ArrowLeft') setP(w - 0.05); if (e.key === 'ArrowRight') setP(w + 0.05); });
  ts.onchange = () => { opts(); show(); }; A.onchange = show; B.onchange = show; opts(); show();
})();
