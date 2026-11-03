// "One task, two graders": the same two pages scored by the lenient and the strict grader. The scores and the gap
// count to the chosen grader's values; seen for the first time, the figure switches to the strict grader by itself.
(function () {
  const {onView, reduced, fmt, lerp, ease} = kit;
  // Pre-gate scores of pi-f2-loop-l1 baseline and iter-001 on dev task b15-tec-1657 (lenient: the batch grade;
  // strict: mean of four 0.9.0 gradings), as in the paper's overview figure. Shown to two places, as there.
  const G = {lenient: {a: 0.6955, b: 0.993}, strict: {a: 0.7423, b: 0.8774}};
  const sa = document.getElementById('sa'), sb = document.getElementById('sb'), gap = document.getElementById('gap'), was = document.getElementById('was');
  const btns = [...document.querySelectorAll('.seg button')];
  let cur = {...G.lenient}, raf = 0, touched = false, grader = 'lenient';
  const diff = v => v.b - v.a;
  const paint = v => {
    sa.textContent = v.a.toFixed(2); sb.textContent = v.b.toFixed(2);
    gap.textContent = fmt(diff(v), 2, true);
  };
  function set(g, animate = !reduced) {
    grader = g; cancelAnimationFrame(raf);
    btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === g)));
    // Under the strict grader the gap is marked as the one that shrank, and the lenient one stays in view beside it.
    gap.classList.toggle('down', g === 'strict');
    was.textContent = g === 'strict' ? `was ${fmt(diff(G.lenient), 2, true)}` : '';
    const from = {...cur}, to = G[g], t0 = performance.now(), dur = 700;
    if (!animate) { cur = {...to}; paint(cur); return; }
    const step = now => {
      const t = ease(Math.min(1, (now - t0) / dur));
      cur = {a: lerp(from.a, to.a, t), b: lerp(from.b, to.b, t)}; paint(cur);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  btns.forEach(b => b.onclick = () => { touched = true; set(b.dataset.g); });
  // Reduced motion and the first frame a reader sees without scrolling to it: the strict result, the post's point.
  set(reduced ? 'strict' : 'lenient', false);
  onView(document.querySelector('.stage'), () => setTimeout(() => { if (!touched) set('strict'); }, 1100));
})();
