// "How the loop works": a step-through of the optimization loop that defines every term the post uses.
(function () {
  const {onTheme, reduced} = kit;
  const svg = document.getElementById('loop'), card = document.getElementById('card'), dots = document.getElementById('dots');
  const prev = document.getElementById('prev'), next = document.getElementById('next');
  // Nodes on a loop: x, y are centres in a 640 x 280 box.
  const WIDE = {
    meta: [105, 70], harness: [320, 70], agent: [535, 70], grader: [535, 210], rule: [320, 210], feedback: [105, 210],
  };
  const NARROW = {  // the same loop in two columns for phones
    meta: [82, 40], harness: [258, 40], agent: [258, 160], grader: [258, 280], rule: [82, 280], feedback: [82, 160],
  };
  // title, subtitle, shorter subtitle for the narrow layout
  const LABEL = {
    meta: ['Meta Agent', 'proposes one edit'], harness: ['Harness', 'instructions · skills · loop', 'how the agent works'],
    agent: ['Coding agent', 'builds a page'], grader: ['Grader', 'checks · judges · gates', 'scores each page'],
    rule: ['Keep rule', 'gain must clear a bar', 'keep or revert'], feedback: ['Feedback', 'what flows back'],
  };
  let N = {};
  const E = [['meta', 'harness'], ['harness', 'agent'], ['agent', 'grader'], ['grader', 'rule'], ['rule', 'feedback'], ['feedback', 'meta']];
  const STEPS = [
    {on: ['harness'], h: 'The harness', b: 'Everything around a frozen AI model: its <b>instructions</b>, <b>skills</b> (reusable how-to files), <b>hooks</b> (scripts that run at fixed moments) and its <b>control loop</b>. Changing the harness changes how the agent works without retraining the model.'},
    {on: ['meta', 'harness'], h: 'The Meta Agent edits it', b: 'A second AI agent reads the run records and proposes <b>one edit</b> to the harness per iteration. In most lineages it may edit instructions, skills and hooks (<b>prompt-level</b>); in one it may also edit the control loop (<b>control-loop</b>).'},
    {on: ['harness', 'agent'], h: 'The coding agent builds pages', b: 'With the edited harness, a coding agent builds an interactive web page from a short written brief. There is no reference answer: many different pages can be good.'},
    {on: ['agent', 'grader'], h: 'The grader scores each page from 0 to 1', b: 'Programmatic checks (does it load, overflow, throw errors), <b>claim checks</b> by AI judges (does it do what the brief asks) and a <b>design judge</b> scoring a design <b>rubric</b>, the list of criteria it checks. Breaking a hard rule, a <b>gate</b>, multiplies the score by 0.8.'},
    {on: ['grader', 'rule'], h: 'The keep rule decides', b: 'Each candidate runs on <b>6 dev tasks</b> the Meta Agent never sees. If its mean score beats its parent\'s by a <b>bar</b> set from measured noise, the edit is <b>kept</b>; otherwise it is <b>reverted</b>. A chain of kept edits from the starting harness is a <b>lineage</b>.'},
    {on: ['rule', 'feedback', 'meta'], h: 'Feedback flows back', b: 'What the Meta Agent sees next is the variable we studied. Pick a setting:', fb: true},
    {on: ['meta', 'harness', 'agent', 'grader', 'rule', 'feedback'], h: 'And at the end: unseen tasks', b: 'Besides the 6 dev tasks, each candidate runs on <b>2 search tasks</b> (scores visible only in the richer feedback settings). <b>8 held-out tasks</b> were never used for decisions: they are the final test. We ran the whole loop under a <b>lenient grader</b> (stage 1), then under a <b>strict grader</b> (stage 2).'},
  ];
  const FB = {
    outcome: ['outcome only', 'Only "kept" or "reverted". No scores.'],
    failed: ['failed items', 'Search-task scores, plus the text of every check and rubric item a page failed.'],
    full: ['full feedback', 'All of that, plus page screenshots and the full traces of the runs.'],
  };
  let step = 0, fb = 'failed';
  function layout() {
    const narrow = svg.getBoundingClientRect().width < 520 || innerWidth < 560;
    const pos = narrow ? NARROW : WIDE;
    N = Object.fromEntries(Object.entries(pos).map(([k, [x, y]]) => [k, {x, y, t: LABEL[k][0], s: narrow && LABEL[k][2] || LABEL[k][1]}]));
    svg.setAttribute('viewBox', narrow ? '0 0 340 340' : '0 0 640 280');
    return narrow;
  }
  function draw() {
    const narrow = layout();
    const s = STEPS[step], on = new Set(s.on);
    let g = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--faint)"/></marker><marker id="ahon" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--kept)"/></marker></defs>';
    const W = narrow ? 140 : 186, H = 58;
    E.forEach(([a, b]) => {
      const A = N[a], B = N[b], lit = on.has(a) && on.has(b);
      const dx = Math.sign(B.x - A.x), dy = Math.sign(B.y - A.y);
      const x1 = A.x + dx * W / 2, y1 = A.y + dy * H / 2, x2 = B.x - dx * (W / 2 + 4), y2 = B.y - dy * (H / 2 + 4);
      g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(${lit ? '--kept' : '--line-2'})" stroke-width="${lit ? 2.4 : 1.4}" marker-end="url(#${lit ? 'ahon' : 'ah'})" ${lit && !reduced ? 'class="flow"' : ''}/>`;
    });
    if (step === 4) g += narrow ? `<text x="170" y="334" text-anchor="middle" style="font-size:10px">kept → next edit starts here</text>` : `<text x="320" y="146" text-anchor="middle" style="font-size:10px">kept → next edit starts here · reverted → back to the parent</text>`;
    Object.entries(N).forEach(([k, n]) => {
      const lit = on.has(k);
      g += `<g style="cursor:pointer" data-k="${k}"><rect x="${n.x - W / 2}" y="${n.y - H / 2}" width="${W}" height="${H}" rx="12" fill="var(${lit ? '--bg' : '--surface'})" stroke="var(${lit ? '--kept' : '--line-2'})" stroke-width="${lit ? 2 : 1}"/>`
        + `<text x="${n.x}" y="${n.y - 3}" text-anchor="middle" style="font-family:var(--sans);font-size:14px;font-weight:600;fill:var(${lit ? '--ink' : '--muted'})">${n.t}</text>`
        + `<text x="${n.x}" y="${n.y + 15}" text-anchor="middle" style="font-size:10px">${n.s}</text></g>`;
    });
    svg.innerHTML = g;
    svg.querySelectorAll('g[data-k]').forEach(e => e.onclick = () => { const i = STEPS.findIndex(st => st.on[st.on.length - 1] === e.dataset.k || (st.on.length === 1 && st.on[0] === e.dataset.k)); if (i >= 0) { step = i; draw(); } });
    let html = `<div class="eyebrow" style="margin-bottom:6px">step ${step + 1} of ${STEPS.length}</div><h3 style="font-size:18px">${s.h}</h3><p style="margin:6px 0 0;font-size:14px;line-height:1.55">${s.b}</p>`;
    if (s.fb) {
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' + Object.entries(FB).map(([k, [lab]]) => `<button class="chip" data-fb="${k}" aria-pressed="${k === fb}">${lab}</button>`).join('') + `</div><p style="margin:8px 0 0;font-size:13.5px;color:var(--muted)">${FB[fb][1]}</p>`;
    }
    card.innerHTML = html;
    card.querySelectorAll('[data-fb]').forEach(b => b.onclick = () => { fb = b.dataset.fb; draw(); });
    dots.innerHTML = STEPS.map((_, i) => `<button aria-label="step ${i + 1}" data-i="${i}" style="width:9px;height:9px;padding:0;border-radius:50%;border:0;background:var(${i === step ? '--ink' : '--line-2'});cursor:pointer"></button>`).join('');
    dots.querySelectorAll('button').forEach(b => b.onclick = () => { step = +b.dataset.i; draw(); });
    prev.disabled = step === 0; next.textContent = step === STEPS.length - 1 ? 'Start over' : 'Next →';
  }
  prev.onclick = () => { step = Math.max(0, step - 1); draw(); };
  next.onclick = () => { step = step === STEPS.length - 1 ? 0 : step + 1; draw(); };
  addEventListener('keydown', e => { if (e.key === 'ArrowRight') next.click(); if (e.key === 'ArrowLeft') prev.click(); });
  addEventListener('resize', draw);
  draw(); onTheme(draw);
})();
