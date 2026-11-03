// "How the loop works": a step-through of the optimization loop that defines every term the post uses.
// The diagram is drawn once per layout and steps only change classes, so boxes and arrows ease between states;
// the current step's title sits in the loop's own hole, and the card below keeps the tallest step's height.
(function () {
  const {onTheme, reduced} = kit;
  const svg = document.getElementById('loop'), card = document.getElementById('card'), dots = document.getElementById('dots'), count = document.getElementById('count');
  const prev = document.getElementById('prev'), next = document.getElementById('next');
  // Nodes on a loop: x, y are centres. The wide loop leaves a hole between its rows for the step title.
  const WIDE = {box: [640, 236], meta: [100, 34], harness: [320, 34], agent: [540, 34], grader: [540, 202], rule: [320, 202], feedback: [100, 202]};
  const NARROW = {box: [340, 330], meta: [82, 34], harness: [258, 34], agent: [258, 165], grader: [258, 296], rule: [82, 296], feedback: [82, 165]};
  // title, subtitle, shorter subtitle for the narrow layout
  const LABEL = {
    meta: ['Meta Agent', 'proposes one edit'], harness: ['Harness', 'instructions · skills · loop', 'how the agent works'],
    agent: ['Coding agent', 'builds a page'], grader: ['Grader', 'checks · judges · gates', 'scores each page'],
    rule: ['Keep rule', 'gain must clear a bar', 'keep or revert'], feedback: ['Feedback', 'what flows back'],
  };
  const E = [['meta', 'harness'], ['harness', 'agent'], ['agent', 'grader'], ['grader', 'rule'], ['rule', 'feedback'], ['feedback', 'meta']];
  const STEPS = [
    {on: ['harness'], h: 'The harness', b: 'Everything around a frozen AI model: its <b>instructions</b>, <b>skills</b> (reusable how-to files), <b>hooks</b> (scripts that run at fixed moments) and its <b>control loop</b>. Changing the harness changes how the agent works without retraining the model.'},
    {on: ['meta', 'harness'], h: 'The Meta Agent edits it', b: 'A second AI agent reads the run records and proposes <b>one edit</b> to the harness per iteration. In most lineages it may edit instructions, skills and hooks (<b>prompt-level</b>); in one it may also edit the control loop (<b>control-loop</b>).'},
    {on: ['harness', 'agent'], h: 'The coding agent builds pages', b: 'With the edited harness, a coding agent builds an interactive web page from a short written brief. There is no reference answer: many different pages can be good.'},
    {on: ['agent', 'grader'], h: 'The grader scores each page from 0 to 1', b: 'Programmatic checks (does it load, overflow, throw errors), <b>claim checks</b> by AI judges (does it do what the brief asks) and a <b>design judge</b> scoring a design <b>rubric</b>, the list of criteria it checks. Breaking a hard rule, a <b>gate</b>, multiplies the score by 0.8.'},
    {on: ['grader', 'rule'], h: 'The keep rule decides', sub: 'kept → the next edit starts here · reverted → back to the parent', b: 'Each candidate runs on <b>6 dev tasks</b> the Meta Agent never sees. If its mean score beats its parent\'s by a <b>bar</b> set from measured noise, the edit is <b>kept</b>; otherwise it is <b>reverted</b>. A chain of kept edits from the starting harness is a <b>lineage</b>.'},
    {on: ['rule', 'feedback', 'meta'], h: 'Feedback flows back', b: 'What the Meta Agent sees next is the variable we studied. Pick a setting:', fb: true},
    {on: ['meta', 'harness', 'agent', 'grader', 'rule', 'feedback'], h: 'And at the end: unseen tasks', b: 'Besides the 6 dev tasks, each candidate runs on <b>2 search tasks</b> (scores visible only in the richer feedback settings). <b>8 held-out tasks</b> were never used for decisions: they are the final test. We ran the whole loop under a <b>lenient grader</b> (stage 1), then under a <b>strict grader</b> (stage 2).'},
  ];
  const FB = {
    outcome: ['outcome only', 'Only "kept" or "reverted". No scores.'],
    failed: ['failed items', 'Search-task scores, plus the text of every check and rubric item a page failed.'],
    full: ['full feedback', 'All of that, plus page screenshots and the full traces of the runs.'],
  };
  let step = 0, fb = 'failed', narrow = null;

  // ---- the diagram: built per layout, then only re-classed ----
  function build() {
    narrow = svg.getBoundingClientRect().width < 520 || innerWidth < 560;
    const pos = narrow ? NARROW : WIDE, [bw, bh] = pos.box, W = narrow ? 140 : 190, H = 58;
    svg.setAttribute('viewBox', `0 0 ${bw} ${bh}`);
    let g = '<defs>' + ['ah', 'ahon'].map(id => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(${id === 'ah' ? '--line-2' : '--kept'})"/></marker>`).join('') + '</defs>';
    E.forEach(([a, b]) => {
      const [ax, ay] = pos[a], [bx, by] = pos[b], dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
      const x1 = ax + dx * W / 2, y1 = ay + dy * H / 2, x2 = bx - dx * (W / 2 + 4), y2 = by - dy * (H / 2 + 4);
      // A dim and a lit copy of each arrow: the lit one fades in, so the change of state is a transition, not a swap.
      g += `<line class="e" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`;
      g += `<line class="e on${reduced ? '' : ' flow'}" data-e="${a}-${b}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ahon)"/>`;
    });
    Object.entries(LABEL).forEach(([k, [t, s, short]]) => {
      const [x, y] = pos[k];
      g += `<g class="n" data-k="${k}" role="button" tabindex="0" aria-label="${t}"><rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="12"/>`
        + `<text class="t" x="${x}" y="${y - 3}" text-anchor="middle">${t}</text>`
        + `<text class="s" data-s="${k}" x="${x}" y="${y + 15}" text-anchor="middle">${narrow && short || s}</text></g>`;
    });
    if (!narrow) g += `<text class="hole" x="${bw / 2}" y="${bh / 2 - 2}" text-anchor="middle"></text><text class="hole-sub" x="${bw / 2}" y="${bh / 2 + 18}" text-anchor="middle"></text>`;
    svg.innerHTML = g;
    svg.querySelectorAll('g.n').forEach(n => {
      const go = () => { const i = STEPS.findIndex(st => st.on[st.on.length - 1] === n.dataset.k || (st.on.length === 1 && st.on[0] === n.dataset.k)); if (i >= 0) set(i); };
      n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
  }

  // ---- the card: every step rendered in one grid cell, so its height is the tallest step's and nothing below moves ----
  card.innerHTML = STEPS.map((s, i) => `<div class="st" data-i="${i}" aria-hidden="true"><h3 class="st-h">${s.h}</h3><p>${s.b}</p>${s.fb ? `<div class="fbs">${Object.entries(FB).map(([k, [lab]]) => `<button class="chip" data-fb="${k}">${lab}</button>`).join('')}</div><p class="fbt" aria-live="polite"></p>` : ''}</div>`).join('');
  card.querySelectorAll('[data-fb]').forEach(b => b.onclick = () => { fb = b.dataset.fb; paint(); });
  dots.innerHTML = STEPS.map((s, i) => `<button class="dot" data-i="${i}" aria-label="step ${i + 1}: ${s.h}"></button>`).join('');
  dots.querySelectorAll('button').forEach(b => b.onclick = () => set(+b.dataset.i));

  function paint() {
    const s = STEPS[step], on = new Set(s.on);
    svg.querySelectorAll('g.n').forEach(n => n.classList.toggle('lit', on.has(n.dataset.k)));
    svg.querySelectorAll('line.on').forEach(l => { const [a, b] = l.dataset.e.split('-'); l.classList.toggle('show', on.has(a) && on.has(b)); });
    // On the feedback step the Feedback box names the chosen setting.
    const fs = svg.querySelector('[data-s="feedback"]'); if (fs) fs.textContent = s.fb ? FB[fb][0] : LABEL.feedback[1];
    const hole = svg.querySelector('.hole'); if (hole) { hole.textContent = s.h; svg.querySelector('.hole-sub').textContent = s.sub || ''; }
    card.classList.toggle('narrow', narrow);
    card.querySelectorAll('.st').forEach(e => { const cur = +e.dataset.i === step; e.classList.toggle('cur', cur); e.setAttribute('aria-hidden', String(!cur)); e.inert = !cur; });
    card.querySelectorAll('[data-fb]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fb === fb)));
    const ft = card.querySelector('.fbt'); if (ft) ft.textContent = FB[fb][1];
    dots.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === step)));
    count.textContent = `step ${step + 1} of ${STEPS.length}`;
    prev.disabled = step === 0; next.textContent = step === STEPS.length - 1 ? 'Start over' : 'Next →';
  }
  const set = i => { step = i; paint(); };
  prev.onclick = () => set(Math.max(0, step - 1));
  next.onclick = () => set(step === STEPS.length - 1 ? 0 : step + 1);
  addEventListener('keydown', e => { if (e.target.closest?.('button,input')) return; if (e.key === 'ArrowRight') next.click(); if (e.key === 'ArrowLeft') prev.click(); });
  const relayout = () => { const was = narrow; const w = svg.getBoundingClientRect().width < 520 || innerWidth < 560; if (w !== was) { build(); paint(); } };
  addEventListener('resize', relayout);
  build(); paint(); onTheme(paint);
})();
