// The gods' sheet: the ten Zhou generals' true-form feats (显圣) at the size of a god's blow (the lead, round 14 review,
// 2026-11-25): "the largest, most composed picture on the field for its one or two seconds". Every stroke loaded at its
// start, flying white (飞白) where the brush runs dry, pressed at its end, ink pooling where it lands, wash bleeding round
// the wet strokes; gold as line and leaf, never a flat band, never shiny.
// Baked by `SET=gods node fx.gen.mjs` into ../baked/gods.webp + gods.json. Units are world units.
//   gspear_{0,1}   火尖枪 thrust along +x: dry push, pressed ink shaft, bronze head, fire tongues at the point
//   gsilk_{0,1}    混天绫 along +x: a long red silk turning, its pale inner face showing at each fold
//   gbrick         金砖 upright, falling: a block of gold leaf in square strokes, ink-cut edges
//   gsword_{0,1}   阴阳剑 crescent cut along +x: 0 ink, 1 pale with an ink edge
//   gcage          九龙神火罩 upright: a dome of fire tongues over a gold rim
//   gsplash_{0,1}  flat: ink thrown down: a pooled heart, bleeding wash, flung drops (the land of a strike)
//   gpool_{0,1}    flat: the trace left on the ground: pooled ink drying, its edge bled into the paper
//   gshock_{0,1}   flat: the shock of a held blow: a broken ring of dry ink, loaded segments
//   gbolt_{0,1}    lightning upright, foot at the pivot, from y = -600: jagged ink, gold hair, forks
//   gwind_{0,1}    a wing's wind along +x: many dry hairs from one loaded start
//   grift_{0,1}    flat along +x: the earth torn: a wet dark gash, ochre lips, side cracks
//   gclod_{0,1}    a clod of earth flung up
//   gstone_{0..4}  五光石 along +x (head at the pivot, tail behind): blue, red, gold, white, green
//   gstar5         the five lights bursting on a face
//   gmark          a small mountain in gold line: what each allied squad receives from 武成王
//   gslip_{0,1}    a slip of the investiture list, upright, its top at the pivot: names in ink, a red seal, gold edges
//   gthread_{0,1}  a gold thread of command along +x
//   gring          flat: a squad receiving the god's presence: a gold line ellipse with leaf flecks
//   gscroll        the investiture list along +x (unrolls): paper band, ink columns, red seals, rollers
//   gbeam_{0,1}    郑伦's white light along +x: a broad bright stroke edged in ink
//   gsoul          a soul drawn up: a pale wisp, upright
//   gwave_{0,1}    a breaking wave upright, foot at the pivot: azurite mass, ink curls, white claws of foam
//   gnail          攒心钉 along +x (points +x): gold nail, a long tail of 华光 (red, gold hair, white core)
//   gflare         the 华光 bursting through a heart
export function gods({cell, PAINT, pts, off, part, spline}) {
  const TAU = Math.PI * 2;
  // a round blot of ink: a stroke laid round a small circle fills it (a two-point dab paints a bar)
  const blot = (st, x, y, r, mat, col, a = 1, sq = 1) => st(mat, 'big', pts(t => [x + Math.cos(t * TAU * 1.3) * r * .28, y + Math.sin(t * TAU * 1.3) * r * .28 * sq], 13), {w: r * 1.1, c: PAINT[col], a, pr: [1, 1, 1, 1]});
  // a jagged path made of straight runs, each run filled with points so the paint keeps its corners
  const jag = (q, n = 4) => q.slice(0, -1).flatMap((a, i) => Array.from({length: n}, (_, k) => [a[0] + (q[i + 1][0] - a[0]) * k / n, a[1] + (q[i + 1][1] - a[1]) * k / n])).concat([q[q.length - 1]]);

  /* ------------------------------------------------ 哪吒's eight weapons */
  for (let v = 0; v < 2; v++) cell(`gspear_${v}`, [-20, -70, 640, 70], 'x', (st, {R}) => {
    const p = pts(t => [600 * t, 6 * Math.sin(t * 4 + v) * (1 - t)], 20);
    // the push: dry hair, the brush loaded but moving fast
    st('chalk', 'drag', part(p, 0, .5), {w: 22, c: PAINT.ink, a: .75, pr: [.05, .25, .5, .7, .85]});
    // the shaft: loaded in, pressed hardest under the head
    st('heavy', 'big', part(p, .3, .9), {w: 11, c: PAINT.ink, pr: [.4, .6, .8, .95, 1, 1]});
    st('pigment', 'line', off(part(p, .35, .88), -6), {w: 2, c: PAINT.goldHi, pr: [.2, .8, 1, .6]});
    // the head in bronze, its point pressed in ink
    st('pigment', 'big', [[528, -12], [592, 0], [528, 12]], {w: 12, c: PAINT.gold, pr: [.7, 1, .7]});
    st('heavy', 'big', [[575, 0], [606, 0]], {w: 7, c: PAINT.ink, pr: [1, .15]});
    // fire tongues round the point, hooked back, red deep at their roots
    for (let k = 0; k < 7; k++) { const a = (k - 3) * .32, L = R(50, 90) * (1 - Math.abs(k - 3) * .12), b = [560, 0], tip = [560 - Math.cos(a) * L * .4 + 30, Math.sin(a) * L], hook = [tip[0] - 26, tip[1] + Math.sign(a || 1) * 8];
      st('pigment', 'big', spline([b, [560 + 10, Math.sin(a) * L * .5], tip, hook], 7), {w: R(9, 14), c: PAINT[k % 3 === 1 ? 'redDeep' : 'red'], pr: [1, .8, .5, .2, .03]}); }
    // a red tassel flicked back off the head
    for (let k = 0; k < 3; k++) st('chalk', 'drag', spline([[520, 0], [480, R(-14, 14)], [430, R(-26, 26)]], 6), {w: 6, c: PAINT.red, a: .8, pr: [1, .5, .1]});
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gsilk_${v}`, [-20, -130, 700, 130], 'x', (st, {R}) => {
    const ph = R(0, 3), p = pts(t => [680 * t, 80 * Math.sin(t * TAU * 1.1 + ph) * (.4 + .6 * t)], 40);
    // the cloth: one wet loaded stroke of cinnabar, wider where it turns toward us
    st('wet', 'big', p, {w: 46, c: PAINT.red, pr: [1, .95, .7, .45, .8, 1, .7, .4, .8, .9, .5, .2]});
    st('wash', 'big', off(p, 18), {w: 40, c: PAINT.red, a: .35, pr: [.6, .4, .2, .4, .3, .1]});
    // the folds: its pale inner face, an ink line on each edge where it turns
    for (const f of [.28, .55, .82]) { const q = part(p, f - .06, f + .06); st('thick', 'dab', q, {w: 16, c: PAINT.redHot, pr: [.2, 1, .2]}); st('pigment', 'line', off(q, -20), {w: 2, c: PAINT.redDeep, pr: [.3, 1, .3]}); }
    st('pigment', 'line', off(p, 22), {w: 1.8, c: PAINT.redDeep, a: .9, pr: [1, .8, .5, .8, .6, .3, .1]});
    // the end runs dry and frays
    for (let k = 0; k < 4; k++) st('chalk', 'drag', off(part(p, .8, 1), (k - 1.5) * 9), {w: 7, c: PAINT[k % 2 ? 'redDeep' : 'red'], a: .7, pr: [.8, .5, .2, .02]});
    st('pigment', 'line', off(part(p, .1, .7), -24), {w: 1.4, c: PAINT.goldHi, a: .9, pr: [.1, .9, 1, .5, .1]});
  }, 'gods');
  cell('gbrick', [-80, -110, 80, 10], '', (st, {R}) => {
    // the block in square strokes of gold pigment, the lit face paler, axe-cut ink at its edges, leaf flecks
    for (let k = 0; k < 5; k++) st('pigment', 'blunt', [[-56 + k * 26, -8], [-56 + k * 26, -78]], {w: 28, c: PAINT[k < 3 ? 'goldHi' : 'gold'], pr: [1, 1, 1]});
    st('pigment', 'blunt', [[-60, -86], [64, -96]], {w: 18, c: PAINT.goldHi, pr: [1, 1]});
    st('wash', 'big', [[40, -10], [40, -84]], {w: 34, c: PAINT.ochre, a: .6, pr: [1, 1]});
    for (const q of [[[-64, -4], [-64, -82]], [[-64, -82], [-50, -100], [66, -104]], [[66, -104], [66, -16], [52, 0]], [[-64, -4], [52, 0]], [[-50, -84], [62, -92]]]) st('heavy', 'big', q, {w: 4.5, c: PAINT.ink, pr: [1, .8, 1]});
    for (let k = 0; k < 14; k++) { const x = R(-50, 50), y = R(-90, -14); st('thick', 'dab', [[x, y], [x + 3, y - 2]], {w: R(3, 6), c: PAINT.goldHi, pr: [1, .5]}); }
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gsword_${v}`, [-20, -200, 620, 40], 'x', (st, {R}) => {
    const p = pts(t => [600 * t, -150 * Math.sin(t * Math.PI) * (1 - .3 * t)], 30);
    st('chalk', 'drag', part(p, 0, .55), {w: 34, c: v ? PAINT.inkPale : PAINT.ink, a: .6, pr: [0, .1, .3, .55, .8]});
    if (v) { st('thick', 'big', part(p, .3, 1), {w: 30, c: PAINT.white, pr: [.2, .7, 1, 1, .8, .3, .05]}); st('pigment', 'line', off(part(p, .3, .98), 15), {w: 2.4, c: PAINT.ink, pr: [.2, 1, 1, .6, .1]}); st('pigment', 'line', off(part(p, .4, .9), -14), {w: 1.4, c: PAINT.goldHi, pr: [.2, 1, .4]}); }
    else { st('heavy', 'big', part(p, .3, 1), {w: 30, c: PAINT.ink, pr: [.2, .7, 1, 1, .8, .3, .05]}); st('pigment', 'line', off(part(p, .4, .95), -15), {w: 2, c: PAINT.goldHi, pr: [.2, 1, .8, .2]}); }
    for (let k = 0; k < 8; k++) { const q = p[Math.round(R(.6, .95) * 30)], x = q[0] + R(-10, 30), y = q[1] + R(14, 40); st('heavy', 'dab', [[x, y], [x + R(4, 12), y + R(2, 8)]], {w: R(3, 7), c: PAINT.ink, pr: [1, .3]}); }
  }, 'gods');
  cell('gcage', [-200, -260, 200, 30], '', (st, {R}) => {
    // the gold rim on the ground, then a dome of fire tongues rising from it, nine of them leaning in, ink at the roots
    st('pigment', 'big', pts(t => [Math.cos(Math.PI + t * Math.PI) * 170, Math.sin(Math.PI + t * Math.PI) * -24], 24), {w: 10, c: PAINT.gold, pr: [.6, 1, 1, .8]});
    st('pigment', 'big', pts(t => [Math.cos(t * Math.PI) * 170, Math.sin(t * Math.PI) * 22], 24), {w: 8, c: PAINT.ochre, pr: [.8, 1, 1, .6]});
    for (let k = 0; k < 9; k++) { const x0 = -150 + k * 37.5, lean = -x0 * .5, h = 160 + 70 * Math.cos((k - 4) / 4 * 1.2) + R(-15, 15);
      const q = spline([[x0, 0], [x0 + lean * .3 + R(-10, 10), -h * .4], [x0 + lean * .8, -h * .8], [x0 + lean * .7 - 14, -h]], 9);
      st('wet', 'big', q, {w: R(26, 34), c: PAINT[k % 3 === 1 ? 'redDeep' : 'red'], pr: [1, .9, .7, .4, .15, .02]});
      st('heavy', 'big', part(q, 0, .3), {w: 10, c: PAINT.ink, a: .8, pr: [1, .6, .1]});
      st('chalk', 'drag', part(off(q, 8), .5, 1), {w: 8, c: PAINT.redHot, a: .7, pr: [.6, .4, .1]}); }
    st('pigment', 'line', pts(t => [Math.cos(Math.PI + t * Math.PI) * 168, Math.sin(Math.PI + t * Math.PI) * -22], 24), {w: 1.6, c: PAINT.goldHi, pr: [.3, 1, 1, .3]});
  }, 'gods');

  /* ------------------------------------------------ ink on the ground: the land, the trace, the shock */
  for (let v = 0; v < 2; v++) cell(`gsplash_${v}`, [-200, -120, 200, 120], '', (st, {R}) => {
    // the heart: ink thrown down wet in overlapping round blots; a pale bleed round it; a few tears flung out, some dry
    for (let k = 0; k < 14; k++) { const a = R(0, TAU), r = R(.2, 1) * 120; blot(st, Math.cos(a) * r, Math.sin(a) * r * .55, R(30, 56), 'wash', 'inkPale', .35, .6); }
    for (let k = 0; k < 9; k++) { const a = R(0, TAU), r = R(0, 1) ** 2 * 50; blot(st, Math.cos(a) * r, Math.sin(a) * r * .55, R(24, 44), 'wet', k % 3 ? 'ink' : 'inkMid', 1, .7); }
    for (let k = 0; k < 10; k++) { const a = R(0, TAU), r0 = R(45, 60), r1 = r0 + R(30, 90), w = R(6, 12), d = (r) => [Math.cos(a) * r, Math.sin(a) * r * .55];
      st('heavy', 'big', [d(r0), d((r0 + r1) / 2), d(r1)], {w, c: PAINT.ink, pr: [1, .5, .08]});
      if (k % 2) blot(st, ...d(r1 + 14), w * 1.1, 'heavy', 'ink'); else st('chalk', 'drag', [d(r1 - 10), d(r1 + 36)], {w: w * 1.4, c: PAINT.ink, a: .7, pr: [.6, .05]}); }
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gpool_${v}`, [-170, -90, 170, 90], '', (st, {R}) => {
    // the trace: a pool of ink drying, round blots run together, darker where they meet; its edge bled pale; drops
    for (let k = 0; k < 12; k++) { const a = R(0, TAU), r = R(.4, 1) * 120; blot(st, Math.cos(a) * r, Math.sin(a) * r * .5, R(36, 60), 'wash', 'inkPale', .3, .55); }
    for (let k = 0; k < 8; k++) { const a = R(0, TAU), r = R(0, 1) ** 1.3 * 70; blot(st, Math.cos(a) * r, Math.sin(a) * r * .5, R(30, 50), 'wet', k % 3 ? 'inkMid' : 'ink', .8, .55); }
    for (let k = 0; k < 7; k++) { const a = R(0, TAU), r = R(110, 160); blot(st, Math.cos(a) * r, Math.sin(a) * r * .5, R(6, 12), 'heavy', 'ink'); }
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gshock_${v}`, [-250, -140, 250, 140], '', (st, {R}) => {
    // the shock: a ring laid in four or five loaded strokes, each pressed in and dragged dry, gaps where the brush lifted
    let a = R(0, TAU);
    for (let i = 0; i < 5; i++) { const sp = R(.9, 1.2), q = pts(t => [Math.cos(a + sp * t) * 220, Math.sin(a + sp * t) * 118], 14);
      st('heavy', 'big', part(q, 0, .4), {w: R(14, 20), c: PAINT.ink, pr: [1, .8, .4]}); st('chalk', 'drag', q, {w: R(16, 22), c: PAINT.ink, a: .75, pr: [1, .8, .6, .4, .2, .05]}); a += sp + R(.08, .25); }
    st('pigment', 'line', pts(t => [Math.cos(t * TAU * .7 + 2) * 205, Math.sin(t * TAU * .7 + 2) * 108], 30), {w: 1.6, c: PAINT.goldHi, pr: [.1, 1, .8, .2]});
  }, 'gods');

  /* ------------------------------------------------ 雷震子: lightning, the wind of the wings */
  for (let v = 0; v < 2; v++) cell(`gbolt_${v}`, [-140, -620, 140, 20], '', (st, {R}) => {
    // jagged: straight segments (a smooth path snakes), each loaded where it turns; a gold hair along it; forks dry out
    const p = [[R(-20, 20), -600]]; for (let i = 1; i <= 9; i++) p.push([(i % 2 ? 1 : -1) * R(24, 56) * (v ? -1 : 1), -600 + i * 62 + R(-10, 10)]); p.push([0, 0]);
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1], w = 9 + 10 * (i / p.length);
      st('heavy', 'big', [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], {w, c: PAINT.ink, pr: [1, .75, 1]});
      st('pigment', 'line', [[a[0] + 5, a[1]], [b[0] + 5, b[1]]], {w: 2.6, c: PAINT.goldHi, pr: [1, 1]}); }
    for (const k of [2, 4, 6]) { const a = p[k], b = [a[0] + R(-80, 80), a[1] + 60], c = [b[0] + R(-50, 50), b[1] + 50];
      st('heavy', 'big', [a, b], {w: 6, c: PAINT.ink, pr: [1, .6]}); st('chalk', 'drag', [b, c], {w: 6, c: PAINT.ink, a: .8, pr: [.7, .1]}); st('pigment', 'line', [[a[0] + 3, a[1]], [b[0] + 3, b[1]]], {w: 1.4, c: PAINT.goldHi, pr: [1, .3]}); }
    // where it lands: ink thrown down
    for (let k = 0; k < 8; k++) { const a = -Math.PI + k / 7 * Math.PI, r = R(20, 60); st('heavy', 'big', [[0, 0], [Math.cos(a) * r, Math.sin(a) * r * .5 + 6]], {w: R(5, 10), c: PAINT.ink, pr: [1, .2]}); }
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gwind_${v}`, [-20, -110, 740, 110], 'x', (st, {R}) => {
    // one loaded start, then the hairs of the brush part and run on dry, curling at their ends
    const curl = v ? -1 : 1;
    st('heavy', 'big', [[0, 0], [40, curl * 6], [90, curl * 14]], {w: 40, c: PAINT.ink, pr: [1, .8, .4]});
    for (let k = 0; k < 9; k++) { const d = (k - 4) * 11, L = R(560, 700), q = pts(t => [90 + (L - 90) * t, curl * 14 + d * (1 + t) + curl * 50 * Math.sin(t * Math.PI * 1.2) - curl * (t > .85 ? (t - .85) * 300 : 0)], 16);
      st('chalk', 'drag', q, {w: R(5, 11), c: PAINT[k % 4 === 1 ? 'green' : k % 3 ? 'ink' : 'inkMid'], a: .85, pr: [1, .8, .6, .4, .2, .05]}); }
    st('pigment', 'line', pts(t => [100 + 520 * t, curl * (20 + 50 * Math.sin(t * Math.PI * 1.2)) - 30], 14), {w: 1.6, c: PAINT.goldHi, pr: [.2, 1, .8, .3, .05]});
  }, 'gods');

  /* ------------------------------------------------ 土行孙: the earth torn */
  for (let v = 0; v < 2; v++) cell(`grift_${v}`, [-20, -70, 460, 70], 'x', (st, {R}) => {
    // the gash: one stroke of wet ink down a jagged line, pressed widest in the middle, sharp at both ends; its far lip
    // caught in ochre, earth thrown out in dry ochre, short side cracks
    const p = [[0, 0]]; for (let i = 1; i <= 10; i++) p.push([i * 44, R(-14, 14)]); const q = jag(p, 5);
    st('wash', 'big', off(q, -6), {w: 60, c: PAINT.ochre, a: .4, pr: [.1, .6, 1, 1, .6, .1]});
    st('wet', 'big', q, {w: 34, c: PAINT.ink, pr: [.05, .4, .8, 1, 1, .9, .6, .25, .02]});
    st('pigment', 'big', off(q, -16), {w: 4, c: PAINT.ochreHi, pr: [.1, .8, 1, 1, .7, .1]});
    for (let k = 0; k < 7; k++) { const a = p[1 + Math.floor(R(0, 9))], s = k % 2 ? 1 : -1; st('chalk', 'drag', [[a[0], a[1] + s * 14], [a[0] + R(-20, 20), a[1] + s * R(40, 60)]], {w: R(14, 22), c: PAINT.ochre, a: .7, pr: [1, .4, .05]}); }
    for (const k of [2, 5, 8]) { const a = p[k], s = (k % 2 ? 1 : -1); st('heavy', 'big', jag([a, [a[0] + R(10, 26), a[1] + s * R(24, 40)], [a[0] + R(24, 50), a[1] + s * R(44, 58)]], 3), {w: 4, c: PAINT.ink, pr: [1, .5, .05]}); }
  }, 'gods');
  /* ------------------------------------------------ 杨戬's seventy-two changes: beasts and birds in a few wet strokes (写意), facing +x,
     the pivot at the belly; ink pulled wet for the mass, dry hair for fur and feather, one touch of colour each */
  cell('gtiger', [-190, -130, 170, 50], '', (st, {R}) => {
    // the tiger: a long ochre body crouched to spring, the black stripes struck across its back in heavy dry strokes, a great
    // head with round ears and white jowls, and the long striped tail curling up behind
    const body = spline([[-110, -40], [-60, -58], [0, -60], [60, -52], [92, -44]], 14);
    st('wet', 'big', body, {w: 58, c: PAINT.ochre, pr: [.7, 1, 1, 1, .9]});
    st('wash', 'big', off(body, 20), {w: 22, c: PAINT.white, a: .7, pr: [.3, .8, 1, .6]});
    for (let k = 0; k < 9; k++) { const q = body[1 + Math.round(k * 1.4)]; st('heavy', 'big', [[q[0] + 6, q[1] - 28], [q[0] - 2, q[1] - 8], [q[0] + 4, q[1] + 10]], {w: R(6, 9), c: PAINT.ink, pr: [1, .9, .1]}); }
    st('wet', 'big', pts(t => [96 + 26 * Math.cos(t * 6), -58 + 22 * Math.sin(t * 6)], 10), {w: 34, c: PAINT.ochre, pr: [1, 1, 1, 1]});
    st('thick', 'big', [[106, -46], [124, -40]], {w: 14, c: PAINT.white, pr: [1, .6]});
    for (const x of [80, 96]) st('heavy', 'big', [[x - 4, -78], [x, -88], [x + 4, -78]], {w: 4, c: PAINT.ink, pr: [1, 1, 1]});
    st('heavy', 'big', [[112, -64], [120, -62]], {w: 5, c: PAINT.ink, pr: [1, 1]}); st('thick', 'big', pts(t => [104 + 2 * Math.cos(t * 7), -64 + 2 * Math.sin(t * 7)], 5), {w: 5, c: PAINT.goldHi, pr: [1, 1]});
    for (const [a, b, c] of [[[66, -36], [96, -6], [130, 16]], [[44, -34], [66, -2], [92, 20]], [[-90, -30], [-120, 0], [-150, 20]], [[-74, -28], [-94, 4], [-108, 24]]]) st('pigment', 'big', spline([a, b, c], 6), {w: 15, c: PAINT.ochre, pr: [1, .8, .5]});
    const tail = spline([[-110, -44], [-150, -60], [-168, -96], [-150, -120]], 10); st('pigment', 'big', tail, {w: 11, c: PAINT.ochre, pr: [1, .8, .6, .4]});
    for (let k = 2; k < 10; k += 2) { const q = tail[k]; st('heavy', 'big', [[q[0] - 6, q[1]], [q[0] + 6, q[1] + 2]], {w: 4, c: PAINT.ink, pr: [1, 1]}); }
  }, 'gods');
  cell('ghawk', [-200, -110, 200, 70], '', (st, {R}) => {
    // the hawk seen spread above the field: two broad wings out flat, each a loaded stroke whose end breaks into five dry
    // fingered primaries, the tail fanned, the head small with a hooked gold beak
    for (const sd of [-1, 1]) { const w = spline([[sd * 14, -20], [sd * 70, -34], [sd * 130, -30], [sd * 170, -16]], 12);
      st('wet', 'big', w, {w: 46, c: PAINT.ink, pr: [1, 1, .9, .7]});
      st('wash', 'big', off(w, sd * -18), {w: 20, c: PAINT.inkMid, a: .6, pr: [1, .9, .6]});
      for (let k = 0; k < 5; k++) { const q = [sd * (150 + k * 6), -24 + k * 8]; st('chalk', 'drag', [q, [q[0] + sd * R(28, 40), q[1] + R(-6, 10) + k * 4]], {w: 8, c: PAINT.ink, a: .9, pr: [1, .5, .05]}); } }
    st('wet', 'big', [[0, -40], [0, -10], [0, 26]], {w: 30, c: PAINT.inkMid, pr: [.7, 1, .8]});
    for (let k = -2; k <= 2; k++) st('chalk', 'drag', [[0, 24], [k * 14, 60]], {w: 10, c: PAINT.ink, a: .85, pr: [1, .6, .1]});
    st('heavy', 'big', pts(t => [8 * Math.cos(t * 7), -52 + 8 * Math.sin(t * 7)], 6), {w: 12, c: PAINT.ink, pr: [1, 1]});
    st('pigment', 'big', [[0, -62], [6, -74], [-2, -70]], {w: 5, c: PAINT.gold, pr: [1, .8, .2]});
  }, 'gods');
  cell('gmarten', [-150, -70, 150, 30], '', (st, {R}) => {
    // 花狐貂: a long low body poured in one pull, a great brushed tail, white at the throat
    const b = spline([[-80, -26], [-30, -38], [30, -36], [80, -28]], 12);
    st('wet', 'big', b, {w: 30, c: PAINT.ink, pr: [.6, 1, 1, .9]});
    st('wash', 'big', off(b, 10), {w: 16, c: PAINT.ochre, a: .7, pr: [.4, 1, 1, .4]});
    st('wet', 'big', spline([[78, -32], [102, -40], [122, -34]], 6), {w: 22, c: PAINT.ink, pr: [1, 1, .6]});
    st('thick', 'big', [[106, -28], [120, -26]], {w: 7, c: PAINT.white, pr: [1, .5]});
    st('heavy', 'big', [[104, -48], [100, -58]], {w: 5, c: PAINT.ink, pr: [1, .3]});
    for (let k = 0; k < 6; k++) st('chalk', 'drag', spline([[-78, -30], [-110, -44 + k * 4], [-146, -52 + k * 7]], 6), {w: 12, c: PAINT[k % 2 ? 'ink' : 'inkMid'], a: .8, pr: [1, .8, .3]});
    for (const [x, d] of [[50, 1], [-50, -1]]) st('pigment', 'big', [[x, -22], [x + d * 14, -6], [x + d * 22, 6]], {w: 7, c: PAINT.ink, pr: [1, .7, .3]});
  }, 'gods');
  cell('gcrane', [-200, -150, 200, 40], '', (st, {R}) => {
    // the crane in flight: white wings raised with black flight feathers, the long neck stretched straight ahead with a
    // cinnabar crown, the long legs trailing straight behind
    for (const sd of [-1, 1]) { const w = spline([[0, -58], [-20, -58 + sd * 40], [-40, -58 + sd * 80], [-50, -58 + sd * 100]], 10);
      st('thick', 'big', w, {w: 38, c: PAINT.white, pr: [1, 1, .9, .6]});
      st('pigment', 'line', off(w, 18), {w: 1.6, c: PAINT.inkMid, pr: [.3, 1, .6]});
      st('chalk', 'drag', part(w, .6, 1), {w: 26, c: PAINT.ink, a: .95, pr: [.6, 1, .6]}); }
    st('thick', 'big', [[-70, -58], [-20, -60], [20, -62]], {w: 30, c: PAINT.white, pr: [.6, 1, .8]});
    st('pigment', 'line', [[-70, -46], [-20, -48], [20, -50]], {w: 1.6, c: PAINT.inkMid, pr: [.3, 1, .5]});
    st('heavy', 'big', [[18, -64], [80, -70], [140, -72]], {w: 7, c: PAINT.ink, pr: [1, .9, .8]});
    st('thick', 'big', pts(t => [142 + 6 * Math.cos(t * 7), -74 + 5 * Math.sin(t * 7)], 6), {w: 9, c: PAINT.white, pr: [1, 1]});
    st('thick', 'big', pts(t => [140 + 3 * Math.cos(t * 7), -80 + 3 * Math.sin(t * 7)], 5), {w: 7, c: PAINT.red, pr: [1, 1]});
    st('pigment', 'big', [[148, -74], [184, -72]], {w: 4, c: PAINT.goldHi, pr: [1, .2]});
    for (const dy of [-4, 4]) st('pigment', 'line', [[-70, -56 + dy], [-140, -52 + dy], [-196, -50 + dy]], {w: 2.4, c: PAINT.ink, pr: [1, 1, .6]});
  }, 'gods');
  cell('gserpent', [-130, -110, 130, 60], '', (st, {R}) => {
    // the serpent coiled to strike: two coils of malachite laid round and round, scales ticked dry, the neck rearing up out of
    // the coils into a raised head with a forked red tongue
    const coil = pts(t => { const a = t * Math.PI * 4, r = 90 - 44 * t; return [Math.cos(a) * r, 20 + Math.sin(a) * r * .45]; }, 40);
    st('wet', 'big', coil, {w: 26, c: PAINT.green, pr: [.2, .7, 1, 1, 1, 1]});
    st('wet', 'big', off(coil, -8), {w: 8, c: PAINT.ink, a: .75, pr: [.2, .8, 1, 1, .9]});
    for (let k = 4; k < 40; k += 3) { const q = coil[k]; st('chalk', 'drag', [[q[0] - 4, q[1] - 5], [q[0] + 4, q[1] + 4]], {w: 4, c: PAINT.ink, a: .55, pr: [1, .2]}); }
    const neck = spline([coil[40], [10, -20], [20, -60], [44, -84]], 10);
    st('wet', 'big', neck, {w: 22, c: PAINT.green, pr: [1, 1, .9, .8]});
    st('wet', 'big', pts(t => [52 + 16 * Math.cos(t * 6), -88 + 10 * Math.sin(t * 6)], 8), {w: 20, c: PAINT.green, pr: [1, 1, 1]});
    st('pigment', 'line', [[66, -86], [86, -82], [92, -88]], {w: 1.6, c: PAINT.red, pr: [1, 1, .5]}); st('pigment', 'line', [[86, -82], [92, -78]], {w: 1.4, c: PAINT.red, pr: [1, .5]});
    st('thick', 'big', pts(t => [56 + 2 * Math.cos(t * 7), -94 + 2 * Math.sin(t * 7)], 5), {w: 5, c: PAINT.goldHi, pr: [1, 1]});
  }, 'gods');
  /* ------------------------------------------------ 黄天化's 华光: one hard lance of light along +x (the pivot at its root): a white-hot core
     laid thick, matte gold edges ruled hard, a cinnabar fringe of flame dragged back, the point pressed in gold and ink */
  cell('glance', [-20, -60, 980, 60], 'x', (st, {R}) => {
    const p = pts(t => [940 * t, 0], 24);
    st('pigment', 'big', p, {w: 64, c: PAINT.red, pr: [.5, .8, 1, 1, 1, .9, .7]});
    for (let k = 0; k < 8; k++) st('chalk', 'drag', off(p, (k - 3.5) * 8).map(([x, y]) => [x, y + R(-2, 2)]), {w: 6, c: PAINT[k % 2 ? 'redDeep' : 'redHot'], a: .8, pr: [.3, .7, 1, .8, .4, .1]});
    st('pigment', 'big', p, {w: 34, c: PAINT.goldHi, pr: [.6, .9, 1, 1, 1, .9]});
    st('thick', 'big', p, {w: 16, c: PAINT.white, pr: [.4, .8, 1, 1, 1, .8]});
    for (const sd of [-1, 1]) st('pigment', 'rule', off(p, sd * 18), {w: 2.6, c: PAINT.gold, pr: [.3, 1, 1, 1, .8]});
    st('pigment', 'big', [[900, -14], [972, 0], [900, 14]], {w: 14, c: PAINT.gold, pr: [.6, 1, .6]});
    st('heavy', 'big', [[950, 0], [980, 0]], {w: 6, c: PAINT.ink, pr: [1, .1]});
  }, 'gods');
  /* ------------------------------------------------ 邓婵玉's five lights: a broad band of one mineral pigment, laid opaque and strong from a
     narrow root to a wide end (along +x), its edges dragged dry, a hair of gold through it */
  for (const [k, col, hi] of [[0, 'blue', 'blueHi'], [1, 'red', 'redHot'], [2, 'gold', 'goldHi'], [3, 'white', 'white'], [4, 'green', 'greenHi']]) cell(`gband_${k}`, [-10, -40, 620, 40], 'x', (st, {R}) => {
    // a beam of light, not cloth: a soft glow of the pigment let down wide and thin, the beam itself narrow and tapering to
    // a point, a bright core laid thick, flying white along both edges where the light breaks up
    const p = pts(t => [600 * t, 2 * Math.sin(t * 7 + k)], 18);
    st('wash', 'big', p, {w: 60, c: PAINT[col === 'white' ? 'bluePale' : col], a: .35, pr: [.1, .5, .8, .9, .7, .4, .1]});
    st('pigment', 'big', p, {w: 26, c: PAINT[col], pr: [.25, .7, 1, 1, .85, .55, .25, .05]});
    st('thick', 'big', part(p, 0, .85), {w: 8, c: PAINT[col === 'gold' || col === 'white' ? 'white' : hi], pr: [.4, 1, 1, .8, .4, .1]});
    for (const sd of [-1, 1]) st('chalk', 'drag', off(part(p, .15, 1), sd * 15), {w: 6, c: PAINT[col === 'white' ? 'inkPale' : col], a: .8, pr: [.3, .9, 1, .6, .2]});
    st('pigment', 'line', off(part(p, .05, .8), -4), {w: 1.2, c: PAINT[col === 'gold' ? 'redDeep' : 'goldHi'], pr: [.2, 1, .7, .1]});
    if (col === 'white') for (const sd of [-1, 1]) st('pigment', 'line', off(part(p, 0, .8), sd * 13), {w: 1.2, c: PAINT.inkMid, pr: [.2, 1, .6, .1]});
  }, 'gods');
  for (let v = 0; v < 2; v++) cell(`gclod_${v}`, [-40, -46, 40, 10], '', (st, {R}) => {
    st('thick', 'blunt', [[-22, -6], [-10, -30], [16, -34], [24, -10]], {w: 24, c: PAINT[v ? 'ochre' : 'ochreHi'], pr: [1, 1, 1, 1]});
    st('heavy', 'big', [[-24, -4], [-12, -32], [18, -38]], {w: 3.4, c: PAINT.ink, pr: [1, 1, .4]});
    st('wash', 'big', [[10, -8], [20, -28]], {w: 14, c: PAINT.inkMid, a: .5, pr: [1, 1]});
  }, 'gods');

  /* ------------------------------------------------ 邓婵玉: five stones, five lights */
  for (const [k, col, hi] of [[0, 'blue', 'blueHi'], [1, 'red', 'redHot'], [2, 'gold', 'goldHi'], [3, 'white', 'white'], [4, 'green', 'greenHi']]) cell(`gstone_${k}`, [-440, -40, 40, 40], 'x', (st, {R}) => {
    const p = pts(t => [-420 * (1 - t), 5 * Math.sin(t * 6 + k) * (1 - t)], 16);
    // the tail: pigment laid thin and dragged, loaded toward the stone
    st('chalk', 'drag', p, {w: 30, c: PAINT[col], a: .8, pr: [.02, .1, .25, .45, .7, .9, 1]});
    st('pigment', 'big', part(p, .5, 1), {w: 16, c: PAINT[hi], pr: [.1, .4, .8, 1]});
    if (col === 'white') st('pigment', 'line', off(part(p, .3, 1), 10), {w: 1.4, c: PAINT.inkPale, pr: [.1, .6, 1]});
    // the stone: a pressed lump of the same pigment, ringed in ink, a gold fleck
    st('thick', 'dab', [[-6, 0], [8, 0]], {w: 30, c: PAINT[col], pr: [1, 1]});
    st('pigment', 'line', pts(t => [1 + Math.cos(t * TAU) * 17, Math.sin(t * TAU) * 15], 16), {w: 2.4, c: PAINT.ink, pr: [1, .8, 1, .6, 1]});
    st('pigment', 'dab', [[-4, -6], [0, -7]], {w: 5, c: PAINT.goldHi, pr: [1, .4]});
  }, 'gods');
  cell('gstar5', [-160, -160, 160, 160], '', (st, {R}) => {
    // the five lights bursting: short pressed strokes outward in turn of the five pigments, dry at their ends, paper at the heart
    const C = ['blue', 'red', 'gold', 'white', 'green'];
    for (let k = 0; k < 25; k++) { const a = k / 25 * TAU + R(-.06, .06), r0 = R(24, 40), r1 = R(110, 150), col = C[k % 5];
      st('pigment', 'big', [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * (r0 + r1) / 2, Math.sin(a) * (r0 + r1) / 2], [Math.cos(a) * r1, Math.sin(a) * r1]], {w: R(10, 16), c: PAINT[col], pr: [1, .7, .1]});
      if (col === 'white') st('pigment', 'line', [[Math.cos(a) * r0 + 6, Math.sin(a) * r0], [Math.cos(a) * r1 * .8 + 6, Math.sin(a) * r1 * .8]], {w: 1, c: PAINT.inkPale, pr: [1, .2]}); }
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 30, Math.sin(t * TAU) * 30], 20), {w: 1.6, c: PAINT.goldHi, pr: [1, .5, 1, .5]});
  }, 'gods');

  /* ------------------------------------------------ 黄飞虎: 东岳泰山 */
  // (泰山 itself is a picture of its own, painted with the field's ink-wash engine: gen/tai.gen.mjs -> baked/gtai.webp)
  // what each allied squad receives from 武成王: a small mountain in gold line over them, his ground under their feet
  cell('gmark', [-60, -56, 60, 6], '', (st, {R}) => {
    st('pigment', 'line', [[-50, 0], [-30, -28], [-14, -12], [0, -50], [16, -14], [30, -32], [50, 0]], {w: 3, c: PAINT.goldHi, pr: [.4, 1, 1, 1, 1, 1, .4]});
    st('pigment', 'line', [[-44, 2], [44, 2]], {w: 2, c: PAINT.gold, pr: [.3, 1, .3]});
    for (let k = 0; k < 8; k++) { const x = R(-36, 36), y = R(-30, -4); st('thick', 'big', pts(t => [x + Math.cos(t * 7) * 1.5, y + Math.sin(t * 7) * 1.5], 5), {w: R(3, 5), c: PAINT.goldHi, pr: [1, 1]}); }
  }, 'gods');
  // a slip of the investiture list: paper, a column of names in ink, a red seal at its foot, gold edges (upright, its top at the pivot)
  for (let v = 0; v < 2; v++) cell(`gslip_${v}`, [-28, -6, 28, 210], '', (st, {R}) => {
    st('pigment', 'dye', [[0, 0], [0, 200]], {w: 44, c: PAINT.white, pr: [1, 1]});
    st('wash', 'big', [[0, 4], [0, 196]], {w: 38, c: PAINT.ochreHi, a: .3, pr: [1, 1]});
    for (const x of [-21, 21]) st('pigment', 'rule', [[x, 0], [x, 200]], {w: 2.2, c: PAINT.gold, pr: [1, 1]});
    for (let g = 0; g < 6; g++) { const y = 16 + g * 24; st('heavy', 'big', [[-8, y], [R(-1, 2), y + R(5, 9)], [8, y + R(3, 10)]], {w: R(3.4, 4.6), c: PAINT.ink, pr: [1, .6, .9]}); st('heavy', 'big', [[R(-2, 2), y - 2], [R(-2, 2), y + 12]], {w: 2.6, c: PAINT.ink, pr: [1, .5]}); }
    st('thick', 'blunt', [[-11, 180], [11, 180]], {w: 22, c: PAINT.red, pr: [1, 1]}); st('pigment', 'line', [[-6, 174], [6, 186]], {w: 1.2, c: PAINT.white, pr: [1, 1]});
  }, 'gods');
  // a gold thread of his command to a squad, along +x: loaded at its start, running dry, a fleck where it ends
  for (let v = 0; v < 2; v++) cell(`gthread_${v}`, [-6, -16, 620, 16], 'x', (st, {R}) => {
    const p = pts(t => [600 * t, 6 * Math.sin(t * 5 + v * 2) * (1 - t)], 16);
    st('pigment', 'big', p, {w: 5, c: PAINT.goldHi, pr: [1, .9, .7, .5, .3]});
    st('chalk', 'drag', part(p, .5, 1), {w: 6, c: PAINT.gold, a: .7, pr: [.6, .4, .1]});
    st('thick', 'big', pts(t => [600 + Math.cos(t * 7) * 3, Math.sin(t * 7) * 3], 6), {w: 7, c: PAINT.goldHi, pr: [1, 1]});
  }, 'gods');
  cell('gring', [-150, -70, 150, 70], '', (st, {R}) => {
    // a gold line ellipse laid in two strokes, each loaded and lifted; leaf flecks; four ticks of ink at the quarters
    for (let s = 0; s < 2; s++) st('pigment', 'big', pts(t => { const a = s * Math.PI + .2 + t * Math.PI * 1.05; return [Math.cos(a) * 130, Math.sin(a) * 56]; }, 22), {w: 7, c: PAINT[s ? 'gold' : 'goldHi'], pr: [1, .9, .8, .6, .3]});
    st('wash', 'big', pts(t => [Math.cos(t * TAU) * 118, Math.sin(t * TAU) * 48], 26), {w: 18, c: PAINT.ochreHi, a: .35, pr: [1, 1, 1, 1]});
    for (let k = 0; k < 18; k++) { const a = R(0, TAU), r = R(.9, 1.08); st('thick', 'dab', [[Math.cos(a) * 130 * r, Math.sin(a) * 56 * r], [Math.cos(a) * 130 * r + 3, Math.sin(a) * 56 * r]], {w: R(3, 6), c: PAINT.goldHi, pr: [1, .5]}); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; st('heavy', 'big', [[Math.cos(a) * 122, Math.sin(a) * 52], [Math.cos(a) * 142, Math.sin(a) * 62]], {w: 4, c: PAINT.ink, pr: [1, .2]}); }
  }, 'gods');

  /* ------------------------------------------------ 姜子牙: the investiture list */
  cell('gscroll', [-30, -120, 900, 120], 'x', (st, {R}) => {
    // the paper band, laid in two wide soft strokes; its edges ruled in ink; columns of names as short pressed strokes;
    // red seals; the far roller in ink and gold (it unrolls along +x)
    st('pigment', 'dye', [[0, 0], [860, 0]], {w: 190, c: PAINT.white, pr: [1, 1]});
    st('wash', 'big', [[0, 0], [860, 0]], {w: 170, c: PAINT.ochreHi, a: .35, pr: [1, 1]});
    for (const y of [-95, 95]) st('pigment', 'rule', [[0, y], [860, y]], {w: 2.2, c: PAINT.ink, pr: [1, 1]});
    for (const y of [-86, 86]) st('pigment', 'rule', [[0, y], [860, y]], {w: 1.2, c: PAINT.gold, pr: [1, 1]});
    for (let col = 0; col < 26; col++) { const x = 40 + col * 30, n = 4 + Math.floor(R(0, 4));
      for (let g = 0; g < n; g++) { const y = -70 + g * 22; st('heavy', 'big', [[x - R(5, 9), y], [x + R(-2, 2), y + R(4, 8)], [x + R(5, 9), y + R(2, 10)]], {w: R(3, 5), c: PAINT.ink, pr: [1, .6, .9]}); } }
    for (const x of [180, 470, 760]) { st('thick', 'blunt', [[x - 14, 50], [x + 14, 50]], {w: 30, c: PAINT.red, pr: [1, 1]}); st('pigment', 'line', [[x - 8, 42], [x + 8, 58]], {w: 1.4, c: PAINT.white, pr: [1, 1]}); }
    for (const x of [-12, 872]) { st('heavy', 'big', [[x, -112], [x, 112]], {w: 22, c: PAINT.ink, pr: [1, 1, 1]}); st('pigment', 'line', [[x + 6, -108], [x + 6, 108]], {w: 2, c: PAINT.goldHi, pr: [1, 1]}); }
  }, 'gods');

  /* ------------------------------------------------ 郑伦: white light, souls */
  for (let v = 0; v < 2; v++) cell(`gbeam_${v}`, [-10, -80, 780, 80], 'x', (st, {R}) => {
    const p = pts(t => [760 * t, (v ? -1 : 1) * 10 * Math.sin(t * 3)], 20), Wd = (t) => 30 + 70 * t;
    // the light widens as it goes; paper-bright, a cool dry hair inside, an ink line on each edge (the light is the paper)
    st('thick', 'big', p, {w: 110, c: PAINT.white, pr: [.3, .5, .7, .85, 1, 1, .9, .6, .2]});
    st('scumble', 'drag', part(p, .1, 1), {w: 30, c: PAINT.bluePale, a: .45, pr: [.2, .6, .8, .5, .1]});
    for (const s of [-1, 1]) st('pigment', 'line', p.map(([x, y], i) => [x, y + s * Wd(i / 20) * .5]), {w: 2, c: PAINT.inkMid, pr: [1, 1, .9, .7, .4, .1]});
    for (let k = 0; k < 6; k++) { const t = R(.2, .9), q = p[Math.round(t * 20)]; st('pigment', 'line', [[q[0], q[1] + R(-20, 20)], [q[0] + R(60, 120), q[1] + R(-20, 20)]], {w: 1, c: PAINT.goldHi, a: .8, pr: [.2, 1, .2]}); }
  }, 'gods');
  cell('gsoul', [-30, -110, 30, 10], '', (st, {R}) => {
    const q = spline([[0, 0], [-14, -30], [10, -60], [-6, -90], [4, -104]], 14);
    st('thick', 'big', q, {w: 18, c: PAINT.white, pr: [.2, .8, 1, .7, .3, .05]});
    st('pigment', 'line', off(q, 9), {w: 1.4, c: PAINT.inkPale, pr: [.2, 1, .8, .3]});
    st('heavy', 'dab', [[4, -96], [5, -98]], {w: 6, c: PAINT.ink, pr: [1, 1]});
  }, 'gods');

  /* ------------------------------------------------ 龙吉: a breaking wave */
  for (let v = 0; v < 2; v++) cell(`gwave_${v}`, [-320, -380, 320, 30], '', (st, {R}) => {
    // one great curl, after 北斋's wave told in ink and azurite: the body a broad stroke rising from the left and rolling
    // over to the right, darker at its back; the inside of the curl paper; the lip in ink line; claws of foam white
    const m = v ? -1 : 1, X = ([x, y]) => [x * m, y];
    const body = spline([[-200, 0], [-170, -90], [-120, -230], [0, -330], [130, -350], [230, -300], [260, -220], [200, -170], [150, -200]], 40).map(X);
    st('wet', 'big', part(body, 0, .8), {w: 120, c: PAINT.blue, pr: [.6, .9, 1, 1, .9, .7, .5]});
    st('wet', 'big', off(part(body, .05, .7), 40), {w: 60, c: PAINT.blueHi, a: .9, pr: [.5, 1, .8, .5]});
    st('wash', 'big', off(part(body, 0, .6), -70), {w: 70, c: PAINT.bluePale, a: .5, pr: [.4, 1, .6, .2]});
    st('pigment', 'line', off(part(body, 0, .82), 58), {w: 3, c: PAINT.ink, pr: [.2, 1, 1, 1, .8, .5]});
    // the lines of water inside the body, following it
    for (let k = 0; k < 4; k++) st('pigment', 'line', off(part(body, .1 + k * .05, .7), 30 - k * 18), {w: 1.4, c: PAINT.ink, a: .6, pr: [.1, 1, .6, .1]});
    // foam claws along the lip, curling down
    for (let k = 0; k < 9; k++) { const a = body[Math.round((.56 + k * .045) * (body.length - 1))], tip = [a[0] + m * R(16, 40), a[1] + R(30, 60)];
      st('thick', 'big', [a, [(a[0] + tip[0]) / 2 + m * 10, (a[1] + tip[1]) / 2 - 6], tip], {w: R(10, 16), c: PAINT.white, pr: [1, .7, .1]});
      st('pigment', 'line', [[a[0] - m * 4, a[1]], [tip[0] - m * 4, tip[1]]], {w: 1, c: PAINT.inkPale, pr: [1, .2]}); }
    // spray: dry white flung off the top
    for (let k = 0; k < 6; k++) { const a = body[Math.round((.45 + k * .07) * (body.length - 1))]; st('chalk', 'drag', [a, [a[0] + m * R(20, 50), a[1] - R(30, 70)]], {w: R(8, 14), c: PAINT.white, a: .8, pr: [.8, .1]}); }
    // 海水: the curl told again inside itself in nested ink lines (the old masters' way of drawing water), and smaller
    // curls breaking off the lip, each with its own foam
    for (let k = 1; k <= 3; k++) st('pigment', 'line', off(part(body, .25 + k * .08, .95), 58 - k * 26), {w: 2.2 - k * .3, c: PAINT.ink, a: .85, pr: [.1, 1, 1, .8, .3]});
    for (let k = 0; k < 3; k++) { const a0 = body[Math.round((.62 + k * .1) * (body.length - 1))], r = 26 - k * 5, c0 = [a0[0] + m * 30, a0[1] + 10 + k * 14];
      st('wet', 'big', pts(t => [c0[0] + m * Math.cos(t * 4.2 - 1) * r, c0[1] + Math.sin(t * 4.2 - 1) * r], 14), {w: 14, c: PAINT.blue, pr: [1, .9, .6, .3]});
      st('pigment', 'line', pts(t => [c0[0] + m * Math.cos(t * 4.2 - 1) * (r + 7), c0[1] + Math.sin(t * 4.2 - 1) * (r + 7)], 14), {w: 1.6, c: PAINT.ink, pr: [.3, 1, .6, .1]});
      for (let j = 0; j < 4; j++) { const q = [c0[0] + m * (r + 4) * Math.cos(-1 + j * .5), c0[1] + (r + 4) * Math.sin(-1 + j * .5)]; st('thick', 'big', [q, [q[0] + m * 12, q[1] + 14]], {w: 7, c: PAINT.white, pr: [1, .1]}); } }
    // spray flung off the crest in white dots
    for (let k = 0; k < 18; k++) { const a0 = body[Math.round(R(.45, .8) * (body.length - 1))], x = a0[0] + m * R(10, 90), y = a0[1] - R(10, 80); st('thick', 'big', pts(t => [x + Math.cos(t * 7) * 2, y + Math.sin(t * 7) * 2], 5), {w: R(4, 9), c: PAINT.white, pr: [1, 1]}); }
    st('scumble', 'drag', [[-320, 14], [0, 0], [320, 14]].map(X), {w: 34, c: PAINT.white, a: .9, pr: [.4, 1, .4]});
  }, 'gods');

  /* ------------------------------------------------ 黄天化: the nail, its 华光 */
  cell('gnail', [-620, -70, 70, 70], 'x', (st, {R}) => {
    // the light behind it: red tongues loaded at the nail and dragged dry far back, a gold hair, paper bright at the core
    for (let k = 0; k < 7; k++) { const a = (k - 3) * .07, L = R(420, 600), sp = pts(t => [-30 - L * t, Math.sin(a) * L * t + 10 * Math.sin(t * 7 + k)], 12);
      st('pigment', 'big', part(sp, 0, .6), {w: R(18, 26) * (1 - Math.abs(k - 3) * .15), c: PAINT[k % 2 ? 'redDeep' : 'red'], pr: [1, .8, .5, .2]});
      st('chalk', 'drag', sp, {w: R(8, 14), c: PAINT[k % 2 ? 'redDeep' : 'red'], a: .8, pr: [.9, .6, .4, .2, .05]}); }
    st('thick', 'big', [[-20, 0], [-160, 0], [-300, 0]], {w: 14, c: PAINT.white, pr: [1, .5, .05]});
    st('pigment', 'line', pts(t => [-30 - 380 * t, -14 + 4 * Math.sin(t * 9)], 12), {w: 1.8, c: PAINT.goldHi, pr: [1, .8, .4, .1]});
    // the nail: matte gold, pressed in at its head, its point ink
    st('pigment', 'big', [[-50, 0], [20, 0], [56, 0]], {w: 14, c: PAINT.gold, pr: [1, 1, .1]});
    st('pigment', 'line', [[-46, -6], [40, -3]], {w: 1.6, c: PAINT.goldHi, pr: [1, .4]});
    st('heavy', 'big', [[36, 0], [62, 0]], {w: 7, c: PAINT.ink, pr: [1, .1]});
  }, 'gods');
  cell('gflare', [-160, -160, 160, 160], '', (st, {R}) => {
    // through the heart: flame tongues out on every side, longer along the line of the nail (+x), ink flung
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + R(-.1, .1), L = (Math.abs(Math.cos(a)) > .8 && Math.cos(a) > 0 ? 150 : 90) * R(.8, 1.1), tip = [Math.cos(a) * L, Math.sin(a) * L], hook = [tip[0] + Math.cos(a + 1.4) * 18, tip[1] + Math.sin(a + 1.4) * 18];
      st('pigment', 'big', spline([[Math.cos(a) * 10, Math.sin(a) * 10], [Math.cos(a) * L * .5, Math.sin(a) * L * .5], tip, hook], 7), {w: R(12, 20), c: PAINT[k % 3 === 1 ? 'redDeep' : k % 3 ? 'red' : 'redHot'], pr: [1, .8, .5, .2, .03]}); }
    st('thick', 'dab', [[-8, 0], [8, 0]], {w: 34, c: PAINT.white, pr: [1, 1]});
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 26, Math.sin(t * TAU) * 26], 16), {w: 2, c: PAINT.goldHi, pr: [1, .4, 1, .4]});
    for (let k = 0; k < 8; k++) { const a = R(0, TAU), r = R(100, 150); st('heavy', 'dab', [[Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * r + 3, Math.sin(a) * r + 2]], {w: R(4, 8), c: PAINT.ink, pr: [1, .4]}); }
  }, 'gods');
}
