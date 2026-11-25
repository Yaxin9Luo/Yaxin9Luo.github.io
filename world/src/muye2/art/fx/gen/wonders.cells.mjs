// The wonders: large brushwork for the great moments and the treasures at the scale the lead asked for (2026-11-25), in
// the hand of the first phase's vocabulary (cells.mjs, DESIGN.md): every stroke pressed, swelling and lifted; dry hair
// where the brush runs out (飞白); colour over an ink bone; light is paper left bare or a gold hair, never a glow.
// Baked by `SET=wonders node fx.gen.mjs` into ../baked/wonders.webp + wonders.json. Units are world units.
//   wdrg_{0,1,2}       a fire dragon's body written in a few strokes, tail at x = 0, neck at x = 400 (axis x: drawn on
//                      from the neck back, so it comes head first). After 陈容's 九龙图: never whole, the tail lost in hair.
//   wdrg_head_{0,1}    the head, pivot at the neck, facing +x
//   wcloud_{0..3}      祥云 in wash and line: soft lobes of let-down ink, spiral heads drawn in ink, one gold hair on a
//                      lower rim; 0, 1 dark (the sky closing), 2, 3 pale (what a dragon is half lost in)
//   wring_{0,1}        乾坤圈: one confident circular stroke in gold-ochre, its dry tail running past where it began
//   wring_trail_{0,1}  the dry-brush wake a thrown ring leaves (axis x: laid behind it along its flight)
//   whalo_fire, whalo_gold   an aura: a ring of wash with a broken edge, a thin line inside, fine radiating hairs
//   wseal              番天印 in brush: a block of axe-cut strokes in bronze and ink, 雷纹 in ink line, the knob a beast in
//                      a few strokes, gold as a hair on its edges; foot at the pivot
export function wonders({cell, PAINT, pts, off, part, strokeAt, spline}) {
  const TAU = Math.PI * 2;

  /* ------------------------------------------------ the fire dragon: body */
  for (let v = 0; v < 3; v++) cell(`wdrg_${v}`, [-110, -150, 430, 140], 'x', (st, {R}) => {
    // the gesture first: one strong S, a wave and a half, tail low and lost; the whole body is this line
    const L = 420, N = 40, ph = R(0, 6), A = 52 + 8 * v, p = pts(t => [L * t, A * Math.sin(TAU * 1.3 * t + ph) * (.55 + .45 * t)], N);
    const nrm = (k) => { const a = p[Math.max(0, k - 1)], b = p[Math.min(N, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; };   // points to the back
    const at = (t) => Math.min(N, Math.round(t * N));
    // the flesh: one wet stroke of cinnabar, a hair at the tail, full at the neck; the back side deeper
    st('wet', 'big', p, {w: 40, c: PAINT.red, pr: [.03, .08, .2, .38, .58, .76, .9, 1, 1, .95, .9]});
    st('pigment', 'big', part(off(p, -9), .3, 1), {w: 15, c: PAINT.redDeep, a: .85, pr: [.05, .4, .8, 1, .9, .8]});
    st('thick', 'dab', part(off(p, 5), .5, .97), {w: 10, c: PAINT.redHot, pr: [.1, .7, 1, .8, .3]});
    // where it breaks into wash: the tail half dragged dry, blots of let-down cinnabar beside it
    st('chalk', 'drag', part(p, 0, .5), {w: 30, c: PAINT.redDeep, a: .7, pr: [.1, .5, .9, 1, .7, .3]});
    // (the wash it breaks into is laid at run time by the wet-paper simulation, fx/gl/ink.js)
    // the belly: pale plates left near paper
    st('scumble', 'dab', part(off(p, 14), .38, .98), {w: 7, c: PAINT.ochreHi, a: .95, pr: [.1, 1, 1, .9, .5]});
    // the spine: dry ink hair (飞白), pressed hard only at the neck
    st('chalk', 'drag', part(off(p, -19), .08, 1), {w: 6, c: PAINT.ink, a: .85, pr: [.1, .5, .8, 1, .9, 1]});
    st('heavy', 'big', part(off(p, -18), .82, 1), {w: 5, c: PAINT.ink, pr: [.2, 1, 1]});
    // the flame ridge: tufts of two or three hooked tongues of unequal length, curling toward the tail, bigger toward the
    // neck; an odd long one sweeps far back; none at the tail, which is already smoke
    for (let i = 0, t = .2; t < .98; i++) { const k = at(t), q = off(p, -18)[k], n = nrm(k), d = [p[Math.min(N, k + 1)][0] - p[k][0], p[Math.min(N, k + 1)][1] - p[k][1]], dl = Math.hypot(d[0], d[1]) || 1, fw = [d[0] / dl, d[1] / dl];
      const m = 2 + (i % 2), big = i % 5 === 3 ? 1.9 : 1;
      for (let j = 0; j < m; j++) { const h = (18 + 46 * t) * big * (1 - j * .28) * R(.85, 1.15), b0 = [q[0] - fw[0] * j * 6, q[1] - fw[1] * j * 6], c1 = [b0[0] + n[0] * h * .55 + fw[0] * h * .1, b0[1] + n[1] * h * .55 + fw[1] * h * .1], tip = [b0[0] + n[0] * h - fw[0] * h * .45, b0[1] + n[1] * h - fw[1] * h * .45], hook = [tip[0] - fw[0] * h * .25 - n[0] * h * .12, tip[1] - fw[1] * h * .25 - n[1] * h * .12];
        st('pigment', 'big', spline([b0, c1, tip, hook], 7), {w: (6 + 9 * t) * (1 - j * .2), c: PAINT[j === 1 ? 'redDeep' : i % 4 === 2 && j === 0 ? 'ink' : 'red'], pr: [1, .8, .45, .15, .02]}) }
      t += R(.11, .17) }   // fewer, bolder: a few tufts carry the fire
    // two legs: shoulder, elbow, claw; a pressed stroke that thins, three hooked ink claws spread
    for (const [t, sw] of [[.5, -1], [.86, 1]]) { const k = at(t), q = off(p, 12)[k], n = nrm(k), e = [q[0] - n[0] * 30 + sw * 16, q[1] - n[1] * 30 + 8], f = [e[0] + 26, e[1] + 20 * sw * .5 + 18];
      st('pigment', 'big', spline([q, e, f], 8), {w: 13, c: PAINT.red, pr: [1, .8, .55, .35]}); st('pigment', 'line', spline([q, e, f], 8), {w: 1.4, c: PAINT.redDeep, pr: [.5, 1, .5]});
      for (let c = 0; c < 3; c++) { const a = -.7 + c * .55; st('heavy', 'big', spline([f, [f[0] + Math.cos(a) * 13, f[1] + Math.sin(a) * 9 + 3], [f[0] + Math.cos(a) * 16 + 2, f[1] + Math.sin(a) * 9 + 13]], 5), {w: 3.6, c: PAINT.ink, pr: [1, .7, .15]}) } }
    // the tail lost: dry strands of ink and red running past the end of the stroke
    for (let h = 0; h < 4; h++) st('chalk', 'drag', spline([p[2], [-30, p[0][1] + R(-20, 20)], [-100, p[0][1] + R(-50, 50)]], 6), {w: 8 - h * 1.5, c: PAINT[h % 2 ? 'redDeep' : 'ink'], a: .6, pr: [.9, .6, .3, .05]});
  }, 'wonders');
  /* ------------------------------------------------ the fire dragon: head (the first phase's head, drawn bigger and freer) */
  for (let v = 0; v < 2; v++) cell(`wdrg_head_${v}`, [-90, -140, 230, 80], 'x', (st, {R}) => {
    const k = 2.3, S = (q) => q.map(([x, y]) => [x * k, y * k]);
    // the mane: tufts of hooked flame streaming back off the skull, each tongue curling at its tip, ink in the deepest
    for (let i = 0; i < 9; i++) { const y0 = -24 + i * 4.5, x0 = 20 - i * 2, L = R(30, 52) * (1 - Math.abs(i - 3) * .07), lift = R(6, 16);
      const q = S(spline([[x0, y0], [x0 - L * .45, y0 - lift], [x0 - L, y0 - lift * .4 + R(-4, 4)], [x0 - L * .86, y0 - lift * .4 - 8]], 8));
      st('pigment', 'big', q, {w: R(5, 7.5) * k, c: PAINT[i % 4 === 2 ? 'ink' : i % 2 ? 'redDeep' : 'red'], pr: [1, .8, .5, .2, .03]}) }
    st('wet', 'big', S([[-2, -1], [20, -6], [42, -9], [56, -10], [64, -15]]), {w: 20 * k, c: PAINT.red, pr: [1, 1, .85, .58, .32, .14]});   // the upper jaw
    st('thick', 'dab', S([[58, -13], [63, -16]]), {w: 7 * k, c: PAINT.redDeep, pr: [1, .6]});
    st('thick', 'dab', S([[14, -6], [36, -9]]), {w: 6 * k, c: PAINT.redHot, pr: [.4, 1, .3]});
    st('pigment', 'big', S([[8, 7], [28, 10], [46, 15], [56, 22]]), {w: 9 * k, c: PAINT.redDeep, pr: [1, .8, .5, .18]});                 // the lower jaw, open: paper between
    st('heavy', 'line', S([[-2, -10], [20, -16], [40, -19], [56, -16], [64, -19]]), {w: 2.4 * k, c: PAINT.ink, pr: [.5, 1, .9, .6, .3]});
    st('heavy', 'dab', S([[30, -19], [44, -19]]), {w: 5 * k, c: PAINT.ink, pr: [.6, 1, .4]});                                             // the brow
    st('thick', 'dab', S([[37, -11], [43, -11]]), {w: 8 * k, c: PAINT.white, pr: [1, 1]}); st('heavy', 'dab', S([[41, -11], [42, -11]]), {w: 3.4 * k, c: PAINT.ink, pr: [1, 1]});
    for (const x of [40, 47, 54]) st('scumble', 'dab', S([[x, 2], [x + 1, 6]]), {w: 2.4 * k, c: PAINT.white, a: .95, pr: [1, .3]});         // teeth: paper
    for (const [y0, len, w] of [[-20, 1, 7], [-16, .8, 5.5]]) { const horn = S(spline([[30, y0], [10, y0 - 18 * len], [-10, y0 - 30 * len], [-30, y0 - 32 * len]], 8));
      st('pigment', 'big', horn, {w: w * k, c: PAINT[len < 1 ? 'redDeep' : 'red'], pr: [1, .9, .65, .35, .08]}); st('heavy', 'line', off(horn, -w * k * .45), {w: 1.6 * k, c: PAINT.ink, pr: [1, .9, .6, .2]}) }
    // whiskers: gold hairs, long, the only gold in the dragon
    st('pigment', 'line', S(spline([[62, -8], [80, -16], [92, -34], [84, -52], [70, -56]], 10)), {w: 1.6 * k, c: PAINT.goldHi, pr: [.4, 1, .9, .6, .3, .1]});
    st('pigment', 'line', S(spline([[56, 12], [74, 22], [90, 20], [98, 8]], 10)), {w: 1.4 * k, c: PAINT.goldHi, pr: [.4, 1, .7, .3, .1]});
    // breath: a hooked tongue of fire out of the jaw
    st('pigment', 'dab', S(spline([[60, 2], [76, 0], [90, 6], [96, 0]], 6)), {w: 6 * k, c: PAINT.redHot, pr: [.6, 1, .5, .08]});
  }, 'wonders');

  /* ------------------------------------------------ 祥云: wash and line */
  for (let v = 0; v < 4; v++) cell(`wcloud_${v}`, [-240, -120, 240, 50], '', (st, {R}) => {
    const dark = v < 2, body = dark ? PAINT.inkMid : PAINT.inkClear, line = dark ? PAINT.ink : PAINT.inkPale;
    // the body's wash is laid at run time by the wet-paper simulation; here only a soft dry underside to sit on
    st('chalk', 'drag', pts(t => [-210 + 420 * t, -6 + 4 * Math.sin(t * 9)], 12), {w: 22, c: body, a: dark ? .5 : .3, pr: [.05, .6, 1, .9, 1, .6, .05]});
    // the heads: spirals drawn in one pull each, their lobe outlined, the tail swept back into a dry stroke
    const n = 3 + (v % 2);
    for (let i = 0; i < n; i++) { const cx = -170 + (i + .5) * (340 / n) + R(-20, 20), cy = R(-40, -10), r0 = R(22, 32);
      st('pigment', 'line', pts(t => { const a = t * 10 + 1.2, r = r0 * (1 - t * .85); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .82] }, 26), {w: dark ? 3.4 : 2.4, c: line, pr: [.4, 1, 1, .8, .5, .2]});
      st('pigment', 'line', pts(t => { const a = 1.2 + Math.PI * (.15 + 1.35 * t); return [cx + Math.cos(a) * (r0 + 10), cy + Math.sin(a) * (r0 + 10) * .82] }, 14), {w: dark ? 2.8 : 2, c: line, a: .9, pr: [.2, 1, .9, .4]});
      st('chalk', 'drag', spline([[cx + r0, cy + 8], [cx + r0 + 50, cy + 20], [cx + r0 + 110, cy + 12 + R(-6, 6)]], 6), {w: 10, c: body, a: .8, pr: [.9, .6, .3, .05]});
      // light: the lower rim of one head in a gold hair (the strike's light caught on its edge), the others in paper scumble
      if (i === 1 || (dark && i === n - 1)) st('pigment', 'line', pts(t => { const a = .35 + 2.3 * t; return [cx + Math.cos(a) * (r0 + 13), cy + Math.sin(a) * (r0 + 13) * .82] }, 12), {w: 1.8, c: PAINT.goldHi, pr: [.2, 1, .9, .3]});
      else st('scumble', 'line', pts(t => { const a = .5 + 1.8 * t; return [cx + Math.cos(a) * (r0 + 6), cy + Math.sin(a) * (r0 + 6) * .82] }, 10), {w: 3, c: PAINT.white, a: .8, pr: [.2, 1, .4]}); }
  }, 'wonders');

  /* ------------------------------------------------ 乾坤圈: one circular stroke */
  for (let v = 0; v < 2; v++) cell(`wring_${v}`, [-84, -84, 84, 84], '', (st, {R}) => {
    const a0 = R(0, TAU), r = 62, circ = (s, e, rr = r, n = 30) => pts(t => { const a = a0 + s + (e - s) * t; return [Math.cos(a) * rr, Math.sin(a) * rr] }, n);
    st('pigment', 'big', circ(0, TAU * .93), {w: 13, c: PAINT.gold, pr: [1, 1, .95, .9, .85, .8, .72, .6, .45]});          // the stroke: pressed in, going round
    st('chalk', 'drag', circ(TAU * .8, TAU * 1.12), {w: 11, c: PAINT.ochre, a: .85, pr: [.8, .7, .5, .3, .1]});            // its dry tail running past the start
    st('pigment', 'line', circ(.1, TAU * .7, r - 7), {w: 1.4, c: PAINT.ink, a: .85, pr: [.3, 1, 1, .8, .3]});                // an ink hair inside
    st('pigment', 'rule', circ(TAU * .55, TAU * .85, r + 6, 12), {w: 1.6, c: PAINT.goldHi, pr: [.2, 1, .9, .2]});              // a gold hair where the light catches
    st('scumble', 'line', circ(TAU * .15, TAU * .3, r + 2, 8), {w: 3, c: PAINT.white, a: .9, pr: [.3, 1, .3]});
    st('pigment', 'dab', [[Math.cos(a0) * r, Math.sin(a0) * r], [Math.cos(a0 + .12) * r, Math.sin(a0 + .12) * r]], {w: 16, c: PAINT.ochre, pr: [1, .8]});   // where the brush came down
  }, 'wonders');
  // the ring as the lead asked after the second play (2026-11-25): the same circle at a third of the width, so many of them read
  // as quick thin flashes and never as discs
  for (let v = 0; v < 2; v++) cell(`wringt_${v}`, [-74, -74, 74, 74], '', (st, {R}) => {
    const a0 = R(0, TAU), r = 62, circ = (s, e, rr = r, n = 34) => pts(t => { const a = a0 + s + (e - s) * t; return [Math.cos(a) * rr, Math.sin(a) * rr] }, n);
    st('pigment', 'big', circ(0, TAU * .9), {w: 4.4, c: PAINT.gold, pr: [1, 1, .95, .9, .8, .7, .55, .35]});
    st('chalk', 'drag', circ(TAU * .82, TAU * 1.1), {w: 4, c: PAINT.ochre, a: .8, pr: [.8, .6, .3, .1]});
    st('pigment', 'line', circ(.2, TAU * .6, r - 3.5), {w: 1, c: PAINT.ink, a: .8, pr: [.3, 1, 1, .3]});
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wring_trail_${v}`, [-10, -24, 230, 24], 'x', (st, {R}) => {
    const p = pts(t => [220 * t, 8 * Math.sin(t * 3 + v * 2) * (1 - t)], 12);
    st('chalk', 'drag', p, {w: 18, c: PAINT.ochre, a: .8, pr: [.02, .1, .25, .45, .7, .9, 1]});
    st('chalk', 'drag', off(p, 7), {w: 6, c: PAINT.ink, a: .55, pr: [0, .05, .2, .5, .8, 1]});
    st('pigment', 'line', off(part(p, .4, 1), -6), {w: 1.4, c: PAINT.goldHi, pr: [0, .3, .8, 1]});
  }, 'wonders');

  /* ------------------------------------------------ an aura: wash ring, broken edge, fine radiating hairs */
  for (const [name, wash, hair, line] of [['fire', 'red', 'redDeep', 'goldHi'], ['gold', 'ochreHi', 'ochre', 'goldHi']]) cell(`whalo_${name}`, [-190, -190, 190, 190], '', (st, {R}) => {
    let a = R(0, TAU);
    for (let i = 0; i < 4; i++) { const sp = R(1.1, 1.5); st('wash', 'big', pts(t => [Math.cos(a + sp * t) * 140, Math.sin(a + sp * t) * 140], 14), {w: R(26, 38), c: PAINT[wash], a: .6, pr: [.1, .8, 1, .9, .5, .1]}); a += sp + R(.12, .3) }   // broken: gaps where the brush lifted
    st('pigment', 'line', pts(t => [Math.cos(t * 5.6 + 1) * 116, Math.sin(t * 5.6 + 1) * 116], 36), {w: 1.6, c: PAINT[hair], a: .9, pr: [.2, 1, .9, 1, .8, .2]});
    st('pigment', 'line', pts(t => [Math.cos(t * 4.4 + 3) * 126, Math.sin(t * 4.4 + 3) * 126], 30), {w: 1.4, c: PAINT[line], pr: [.1, 1, .8, .2]});
    for (let i = 0; i < 40; i++) { const b = i / 40 * TAU + R(-.04, .04), r0 = 158 + R(0, 8), r1 = r0 + R(10, 28);
      st('pigment', 'line', [[Math.cos(b) * r0, Math.sin(b) * r0], [Math.cos(b) * r1, Math.sin(b) * r1]], {w: i % 3 ? 1.1 : 1.3, c: PAINT[i % 3 ? hair : line], a: .85, pr: [1, .2]}) }
  }, 'wonders');

  /* ------------------------------------------------ 打神鞭: the lash, one calligraphic stroke that cracks out and curls */
  for (let v = 0; v < 3; v++) cell(`wlash_${v}`, [-20, -90, 640, 90], 'x', (st, {R}) => {
    // pressed in at the hand, thinning, one S, and at the tip a hooked curl (the crack); ink with a malachite edge (wood)
    const ph = R(-.4, .4), N = 96, curl = (t) => Math.max(0, (t - .84) / .16);
    const p = pts(t => { const c = curl(t), a = c * Math.PI * 1.3; return [560 * Math.min(t, .84) + (c > 0 ? Math.sin(a) * 26 : 0), 44 * Math.sin(t * Math.PI * 1.7 + ph) * (1 - t * .6) + (c > 0 ? -(1 - Math.cos(a)) * 20 : 0)]; }, N);
    st('heavy', 'big', p, {w: 15, c: PAINT.ink, pr: [1, .92, .8, .66, .54, .44, .35, .27, .2, .14, .09, .05]});      // one stroke, from the hand to the crack
    st('chalk', 'drag', part(p, .3, .78), {w: 12, c: PAINT.ink, a: .55, pr: [.6, .8, .7, .5, .3]});                   // the middle breaking dry (飞白)
    st('pigment', 'line', off(part(p, .02, .6), 6), {w: 2.4, c: PAINT.green, a: .85, pr: [.3, 1, .8, .5, .2]});        // malachite along its lit edge
    for (let i = 0; i < 6; i++) { const q = p[4 + i * 7]; st('pigment', 'line', [[q[0], q[1] - 7], [q[0] + 2, q[1] + 7]], {w: 1.6, c: PAINT.gold, a: .7, pr: [1, .5]}) }   // joints, ticked in bronze
    const tip = p[N]; for (let k = 0; k < 4; k++) { const a = -2.6 + k * .45; st('pigment', 'line', [[tip[0], tip[1]], [tip[0] + Math.cos(a) * 12, tip[1] + Math.sin(a) * 12]], {w: 1, c: PAINT.ink, a: .8, pr: [1, .1]}) }   // the crack
  }, 'wonders');
  /* ------------------------------------------------ a talisman struck onto a foe: a small strip of paper, a brushed mark */
  for (let v = 0; v < 3; v++) cell(`wfu_${v}`, [-14, -40, 14, 40], '', (st, {R}) => {
    st('pigment', 'full', [[0, -34], [0, 34]], {w: 20, c: PAINT.ochreHi, pr: [1, 1, 1]});
    st('pigment', 'line', spline([[-4, -24], [4, -16], [-3, -6], [5, 4], [-2, 14], [3, 24]], 10), {w: 2.4, c: PAINT.red, pr: [.6, 1, .8, 1, .7, .3]});
    st('pigment', 'line', [[-6, -28 + v * 3], [6, -28 + v * 3]], {w: 1.8, c: PAINT.red, pr: [1, 1]});
    st('pigment', 'line', [[-8, -34], [8, -34], [8, 34], [-8, 34], [-8, -34]], {w: 1, c: PAINT.ink, a: .7, pr: [1, 1, 1, 1, 1]});
  }, 'wonders');

  /* ------------------------------------------------ the hero's weapons (content/weapons.js): each blow is one stroke */
  // 枪 the spear's thrust: one fast pressed ink line, thin and straight, the point pressed hardest, a red tassel flicked back
  for (let v = 0; v < 2; v++) cell(`wspear_${v}`, [-20, -40, 560, 40], 'x', (st, {R}) => {
    const p = pts(t => [540 * t, 3 * Math.sin(t * 5 + v) * (1 - t)], 16);
    st('chalk', 'drag', part(p, 0, .45), {w: 9, c: PAINT.ink, a: .7, pr: [.05, .3, .6, .8]});                     // the push, dry
    st('heavy', 'big', part(p, .35, 1), {w: 8, c: PAINT.ink, pr: [.3, .6, .8, 1, 1, .9]});
    st('pigment', 'big', [[505, -7], [548, 0], [505, 7]], {w: 7, c: PAINT.gold, pr: [.6, 1, .6]});                // the head, bronze
    for (let k = 0; k < 4; k++) st('pigment', 'big', spline([[500, 0], [470 - k * 6, -8 + k * 5], [440 - k * 10, -14 + k * 9 + R(-3, 3)]], 5), {w: 4, c: PAINT[k % 2 ? 'redDeep' : 'red'], pr: [1, .6, .1]});   // the tassel
  }, 'wonders');
  // 戟 the sweep: a crescent laid along the arc, broad where the blade leads, running dry behind it
  for (let v = 0; v < 2; v++) cell(`wsweep_${v}`, [-20, -40, 560, 40], 'x', (st, {R}) => {
    const p = pts(t => [540 * t, 0], 16);
    st('chalk', 'drag', p, {w: 26, c: PAINT.ink, a: .75, pr: [0, .05, .15, .3, .5, .7, .85, 1]});
    st('heavy', 'big', part(p, .55, 1), {w: 22, c: PAINT.ink, pr: [.1, .5, .9, 1, .9]});
    st('pigment', 'line', off(part(p, .5, .98), -11), {w: 2.4, c: PAINT.ochreHi, pr: [.1, .8, 1, .6]});           // the blade's edge lit
    st('scumble', 'drag', off(part(p, .6, .95), 6), {w: 6, c: PAINT.white, a: .6, pr: [.2, 1, .3]});
  }, 'wonders');
  // 刀 the great blade: a heavy cleaving crescent, the side of a worn brush (斧劈), ochre caught on its leading edge
  for (let v = 0; v < 2; v++) cell(`wcleave_${v}`, [-20, -70, 560, 80], 'x', (st, {R}) => {
    const p = pts(t => [540 * t, -10 * Math.sin(t * Math.PI)], 20);                                                  // a crescent, bellied toward the cut
    st('chalk', 'drag', part(p, 0, .7), {w: 40, c: PAINT.ink, a: .6, pr: [0, .08, .2, .4, .6, .8]});
    st('heavy', 'big', part(p, .4, 1), {w: 48, c: PAINT.ink, pr: [.15, .55, .9, 1, .95, .6, .15]});                 // pressed in the middle of the cut, lifted at its end
    st('pigment', 'big', off(part(p, .5, .95), -22), {w: 6, c: PAINT.ochre, a: .9, pr: [.1, .8, 1, .7, .1]});         // the edge catching ochre
    for (let k = 0; k < 9; k++) { const x = R(260, 520), y = R(18, 56), w = R(3, 9); st('heavy', 'dab', [[x, y], [x - R(4, 14), y + R(2, 10)]], {w, c: PAINT.ink, pr: [1, .4]}) }   // ink flung off the back of the cut, scattered
  }, 'wonders');
  // 弓 an arrow and its wake
  for (let v = 0; v < 2; v++) cell(`warrow_${v}`, [-130, -12, 50, 12], 'x', (st, {R}) => {
    st('chalk', 'drag', [[-125, 0], [-40, 0]], {w: 5, c: PAINT.ink, a: .45, pr: [0, .3, .7]});                     // the wake
    st('heavy', 'line', [[-48, 0], [34, 0]], {w: 2.2, c: PAINT.ink, pr: [1, 1, 1]});                             // the shaft
    st('pigment', 'big', [[30, -4], [46, 0], [30, 4]], {w: 4, c: PAINT.gold, pr: [.6, 1, .6]});                  // the head
    for (const s of [-1, 1]) st('pigment', 'big', [[-46, 0], [-34, s * 7]], {w: 4, c: PAINT[v ? 'redDeep' : 'ochre'], pr: [1, .3]});   // the fletching
  }, 'wonders');

  /* ------------------------------------------------ the eight new treasures (SPEC-CAMPAIGN 2.3) */
  // 斩仙飞刀: a sliver of white light with an ink edge, diving; and the cut it leaves, one slash with a gold hair
  cell('wknife', [-20, -16, 200, 16], 'x', (st) => {
    st('chalk', 'drag', [[-15, 0], [90, 0]], {w: 6, c: PAINT.inkPale, a: .5, pr: [0, .3, .7]});
    st('thick', 'dab', [[80, 0], [190, -2]], {w: 12, c: PAINT.white, pr: [.2, .8, 1, .4]});
    st('pigment', 'line', [[84, 5], [192, -1]], {w: 1.6, c: PAINT.ink, pr: [.2, 1, .8]});
    st('pigment', 'line', [[100, -4], [186, -4]], {w: 1, c: PAINT.goldHi, pr: [.2, 1, .2]});
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wcut_${v}`, [-90, -60, 90, 60], '', (st, {R}) => {
    const a = -.7 + v * .25, p = [[-Math.cos(a) * 80, -Math.sin(a) * 50], [Math.cos(a) * 80, Math.sin(a) * 50]];
    st('heavy', 'big', p, {w: 9, c: PAINT.ink, pr: [.1, 1, .9, .1]}); st('pigment', 'line', [[p[0][0] + 6, p[0][1] - 4], [p[1][0] - 6, p[1][1] - 6]], {w: 1.2, c: PAINT.goldHi, pr: [.1, 1, .1]});
    for (let k = 0; k < 4; k++) { const x = R(-40, 40), y = x * Math.tan(a) * .62 + R(6, 20); st('heavy', 'dab', [[x, y], [x + R(-3, 3), y + R(4, 10)]], {w: R(2, 5), c: PAINT.ink, pr: [1, .3]}) }
  }, 'wonders');
  // 落魂钟: the bell in a few strokes (bronze, ink rim, a cloud scroll), and the toll: a dry arc of ink that runs outward
  cell('wbell', [-60, -110, 60, 10], '', (st) => {
    st('heavy', 'big', spline([[-44, 0], [-40, -60], [-20, -92], [20, -92], [40, -60], [44, 0]], 12), {w: 18, c: PAINT.inkMid, pr: [1, .9, .8, .8, .9, 1]});
    for (let k = -3; k <= 3; k++) st('heavy', 'blunt', [[k * 11, -6], [k * 9, -50], [k * 5, -86]], {w: 14, c: PAINT[Math.abs(k) > 1 ? 'inkMid' : 'ochre'], a: .95, pr: [1, .95, .8]});   // its body, cast bronze in vertical strokes
    st('heavy', 'line', [[-50, 2], [50, 2]], {w: 4, c: PAINT.ink, pr: [.6, 1, .6]});
    st('pigment', 'line', pts(t => { const a = t * 8, r = 12 * (1 - t * .8); return [Math.cos(a) * r, -46 + Math.sin(a) * r * .8] }, 16), {w: 1.6, c: PAINT.goldHi, pr: [.3, 1, .4]});
    st('heavy', 'big', [[-6, -96], [0, -108], [6, -96]], {w: 6, c: PAINT.ink, pr: [1, 1, 1]});
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wtoll_${v}`, [-10, -14, 520, 14], 'x', (st, {R}) => {
    st('chalk', 'drag', pts(t => [500 * t, 2 * Math.sin(t * 13 + v)], 14), {w: 8, c: PAINT.inkMid, a: .7, pr: [.1, .6, 1, .9, .7, .4, .1]});
    st('pigment', 'line', pts(t => [500 * t, -5 + 2 * Math.sin(t * 9 + v)], 14), {w: 1.2, c: PAINT.ochre, a: .8, pr: [0, .5, 1, .7, .1]});
  }, 'wonders');
  // 五火七禽扇: a front of fanned fire (hooked tongues leaning with the fan's sweep) and the seven birds of fire
  for (let v = 0; v < 2; v++) cell(`wfanfire_${v}`, [-20, -80, 560, 20], 'x', (st, {R}) => {
    st('wet', 'big', pts(t => [540 * t, 2], 12), {w: 14, c: PAINT.redDeep, a: .8, pr: [.1, .7, 1, 1, .8, .2]});
    st('chalk', 'drag', pts(t => [540 * t, -2 + 3 * Math.sin(t * 9)], 14), {w: 16, c: PAINT.red, a: .5, pr: [.1, .7, 1, 1, .8, .2]});      // a dry wash along the front
    for (let i = 0; i < 14; i++) { const x = 20 + i * 38 + R(-8, 8), hh = R(40, 76) * Math.sin(Math.PI * (i + .5) / 14), s = i % 3 ? 1 : -1;
      const sp = spline([[x, 0], [x + s * hh * .12, -hh * .3], [x - s * hh * .1, -hh * .6], [x + s * hh * .22 + hh * .2, -hh * .88], [x + s * hh * .4 + hh * .3, -hh]], 10);
      st('pigment', 'big', sp, {w: R(10, 14), c: PAINT[i % 3 === 1 ? 'redDeep' : i % 3 ? 'red' : 'redHot'], pr: [1, 1, .8, .55, .3, .1]});
      st('chalk', 'drag', part(sp, .45, 1), {w: 5, c: PAINT.redDeep, a: .95, pr: [.9, .6, .35, .12]}); }
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wbird_${v}`, [-50, -30, 50, 30], 'x', (st, {R}) => {
    st('pigment', 'big', spline([[-40, 4], [-10, 0], [20, -4], [40, -2]], 6), {w: 10, c: PAINT.red, pr: [.2, .9, 1, .6]});                 // body
    st('pigment', 'big', spline([[0, -2], [-14, -20 - v * 4], [-30, -26]], 6), {w: 7, c: PAINT.redDeep, pr: [1, .6, .1]});                   // wing up
    st('pigment', 'big', spline([[4, 2], [-8, 16], [-24, 22 + v * 4]], 6), {w: 6, c: PAINT.red, pr: [1, .6, .1]});                          // wing down
    for (let k = 0; k < 3; k++) st('pigment', 'big', spline([[-38, 4], [-52 - k * 4, k * 6 - 4], [-62 - k * 6, k * 9 - 6]], 5), {w: 4, c: PAINT.redHot, pr: [1, .5, .05]});   // tail of fire
    st('heavy', 'dab', [[36, -4], [37, -4]], {w: 3, c: PAINT.ink, pr: [1, 1]}); st('pigment', 'big', [[40, -2], [48, 0]], {w: 3, c: PAINT.gold, pr: [1, .3]});
  }, 'wonders');
  // 阴阳镜: the mirror (half ink, half paper, the two eyes) on a bronze rim
  cell('wmirror', [-46, -46, 46, 46], '', (st) => {
    st('pigment', 'big', pts(t => [Math.cos(t * TAU) * 38, Math.sin(t * TAU) * 38], 30), {w: 8, c: PAINT.gold, pr: [1, 1, 1, 1]});
    st('thick', 'dab', [[-1, 0], [1, 0]], {w: 68, c: PAINT.white, pr: [1, 1]});
    st('heavy', 'big', pts(t => { const a = -Math.PI / 2 + t * Math.PI; return [Math.cos(a) * 26 - 4 * Math.sin(t * Math.PI), Math.sin(a) * 26] }, 14), {w: 22, c: PAINT.ink, pr: [.3, 1, 1, .3]});
    st('heavy', 'dab', [[0, -16], [1, -16]], {w: 9, c: PAINT.ink, pr: [1, 1]}); st('thick', 'dab', [[0, 16], [1, 16]], {w: 9, c: PAINT.white, pr: [1, 1]});
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 34, Math.sin(t * TAU) * 34], 30), {w: 1.2, c: PAINT.ink, pr: [1, 1, 1]});
  }, 'wonders');
  // 捆仙绳: a golden-yellow rope wound three times round what it holds, an end flying
  for (let v = 0; v < 2; v++) cell(`wrope_${v}`, [-60, -90, 60, 14], '', (st, {R}) => {
    for (let i = 0; i < 3; i++) { const y = -18 - i * 24; st('pigment', 'big', pts(t => [Math.cos(t * TAU + i + v) * 40, y + Math.sin(t * TAU + i + v) * 10], 22), {w: 7, c: PAINT[i % 2 ? 'ochreHi' : 'goldHi'], pr: [.4, 1, 1, 1, .4]});
      st('pigment', 'line', pts(t => [Math.cos(t * 3.1 + i + v + .2) * 41, y + 4 + Math.sin(t * 3.1 + i + v + .2) * 10], 10), {w: 1.4, c: PAINT.ink, pr: [.3, 1, .3]}) }
    st('pigment', 'big', spline([[40, -18], [52, -4], [44, 10]], 6), {w: 6, c: PAINT.ochreHi, pr: [1, .5, .1]});
  }, 'wonders');
  // 遁龙桩: the post driven into the ground (an ink stake with bronze bands)
  cell('wpost', [-30, -260, 30, 12], '', (st) => {
    st('heavy', 'blunt', [[0, 0], [0, -130], [0, -250]], {w: 26, c: PAINT.inkMid, pr: [1, 1, .9]});
    st('chalk', 'drag', [[-10, -10], [-10, -240]], {w: 6, c: PAINT.ink, a: .7, pr: [1, .8, .5]});
    for (const y of [-60, -140, -220]) st('pigment', 'big', [[-16, y], [16, y + 4]], {w: 9, c: PAINT.gold, pr: [.7, 1, .7]});
    st('heavy', 'big', [[-18, -250], [0, -262], [18, -250]], {w: 8, c: PAINT.ink, pr: [1, 1, 1]});
  }, 'wonders');
  // 玲珑宝塔: a pagoda of seven eaves in a few strokes each, ink and bronze, a gold finial
  cell('wtower', [-110, -460, 110, 14], '', (st, {R}) => {
    for (let i = 0; i < 7; i++) { const y = -i * 62, w = 92 - i * 10;
      st('pigment', 'big', [[-w * .5, y - 12], [0, y - 13], [w * .5, y - 12]], {w: 30, c: PAINT[i % 2 ? 'ochreHi' : 'ochre'], a: .95, pr: [.85, 1, .85]});   // the storey, one fat stroke
      st('pigment', 'line', [[-w * .2, y - 2], [-w * .2, y - 24]], {w: 2, c: PAINT.ink, pr: [1, 1]}); st('pigment', 'line', [[w * .2, y - 2], [w * .2, y - 24]], {w: 2, c: PAINT.ink, pr: [1, 1]});   // its door posts
      st('heavy', 'big', spline([[-w - 10, y - 46], [-w * .5, y - 40], [0, y - 44], [w * .5, y - 40], [w + 10, y - 46]], 10), {w: 9, c: PAINT.ink, pr: [.3, 1, 1, 1, .3]});   // the eave, its corners turned up
      st('pigment', 'line', [[-w * .5 + 6, y - 34], [w * .5 - 6, y - 34]], {w: 1.4, c: PAINT.goldHi, pr: [.2, 1, .2]}) }
    st('pigment', 'big', [[0, -436], [0, -458]], {w: 7, c: PAINT.gold, pr: [1, .6]}); st('pigment', 'big', [[-6, -440], [6, -440]], {w: 6, c: PAINT.gold, pr: [1, 1]});
  }, 'wonders');

  /* ------------------------------------------------ 不动如山 / 移山: a peak of the blue-green landscape, in axe-cut strokes */
  for (let v = 0; v < 3; v++) cell(`wpeak_${v}`, [-110, -230, 110, 12], '', (st, {R}) => {
    // two summits, the nearer lower; each filled with soft tapering strokes that follow its slopes, colour blending upward
    const peaks = [[R(-30, -10), 200 + v * 12, 92], [R(30, 50), 140 + v * 8, 70]];
    for (const [px, h, base] of peaks) { const apex = [px, -h];
      for (let k = 0; k < 14; k++) { const f = k / 13, y = -h * f * .92 - 4, hw = base * (1 - f * .95), c = f < .22 ? PAINT.ochre : f < .32 ? PAINT.ochreHi : f < .55 ? PAINT.green : f < .66 ? PAINT.greenHi : PAINT.blue;
        st('pigment', 'big', [[px - hw, y + 6], [px - hw * .4, y - 4], [px + hw * .3, y - 2], [px + hw, y + 8]], {w: 24 - f * 10, c, a: .95, pr: [.3, 1, 1, .3]}) }
      st('heavy', 'big', [[px - base - 6, 4], [px - base * .45, -h * .5], apex, [px + base * .5, -h * .45], [px + base + 6, 4]], {w: 3.6, c: PAINT.ink, pr: [.3, .9, 1, .9, .3]});
      for (let i = 0; i < 6; i++) { const f = R(.15, .75), y = -h * f, x = px + R(-.5, .5) * base * (1 - f); st('pigment', 'line', [[x, y], [x + R(-10, 10), y + R(10, 20)]], {w: 1.6, c: PAINT.ink, a: .7, pr: [1, .3]}) }
      st('pigment', 'line', [apex, [apex[0] + 14, apex[1] + 26]], {w: 2, c: PAINT.goldHi, pr: [1, .3]}); }
  }, 'wonders');

  /* ------------------------------------------------ light as ruled lines (the Ming woodblock's mirrors, plate 46) */
  for (let v = 0; v < 2; v++) cell(`wray_${v}`, [-40, -10, 40, 620], 'down', (st, {R}) => {
    for (let i = 0; i < 5; i++) { const x = (i - 2) * R(6, 9) + R(-2, 2), y0 = R(0, 60), y1 = 600 - R(0, 140);
      st('pigment', 'rule', [[x, y0], [x, (y0 + y1) / 2], [x, y1]], {w: i === 2 ? 2.4 : R(1, 1.6), c: PAINT.goldHi, pr: [.1, 1, .9, .3]}) }
    st('pigment', 'rule', [[-16, 20], [-16, 560]], {w: 1, c: PAINT.ink, a: .7, pr: [.1, 1, .8, .1]}); st('pigment', 'rule', [[17, 60], [17, 520]], {w: 1, c: PAINT.ink, a: .6, pr: [.1, 1, .6, .1]});
    st('scumble', 'rule', [[2, 100], [2, 590]], {w: 3, c: PAINT.white, a: .9, pr: [.1, 1, 1, .2]});
  }, 'wonders');

  /* ------------------------------------------------ 混天绫: the silk, one ribbon stroke (laid along its arc at run time) */
  for (let v = 0; v < 2; v++) cell(`wsilk_${v}`, [-20, -60, 640, 60], 'x', (st, {R}) => {
    const N = 30, p = pts(t => [620 * t, 14 * Math.sin(t * TAU * 1.5 + v * 2) * (1 - t * .5)], N);
    const W = (t) => 30 * (.08 + .92 * Math.abs(Math.cos(t * Math.PI * 2.5 + v))) * (1 - t * .45);         // it pinches where it twists
    const prs = Array.from({length: 21}, (_, i) => Math.max(.04, W(i / 20) / 30));
    st('wet', 'big', p, {w: 34, c: PAINT.red, pr: prs});
    st('pigment', 'big', off(p, 6), {w: 12, c: PAINT.redDeep, a: .85, pr: prs.map(q => q * .9)});                 // the fold in shadow
    st('scumble', 'drag', part(off(p, -7), .05, .7), {w: 6, c: PAINT.white, a: .8, pr: [.2, 1, .8, 1, .6, .2]});   // the sheen of silk left as paper
    st('pigment', 'line', off(p, -14), {w: 1.6, c: PAINT.ink, a: .85, pr: [.6, 1, .8, .5, .9, .4, .1]});          // an ink hair on its edge
    st('chalk', 'drag', part(p, .78, 1), {w: 18, c: PAINT.redDeep, a: .7, pr: [.8, .6, .35, .1]});                // its end flying dry
  }, 'wonders');
  /* ------------------------------------------------ water: Ma Yuan's bands, a claw crest, spray (laid along an arc at run time) */
  for (let v = 0; v < 2; v++) cell(`wwave_${v}`, [-20, -80, 560, 40], 'x', (st, {R}) => {
    for (let i = 0; i < 5; i++) { const ph = R(0, 6), y0 = -4 + i * 6, p = pts(t => [540 * t, y0 + 7 * Math.sin(t * 9 + ph) * Math.sin(t * Math.PI)], 24);
      st('pigment', 'line', p, {w: i === 0 ? 2.4 : 1.4, c: PAINT[i === 0 ? 'ink' : i % 2 ? 'blue' : 'blueHi'], a: .9, pr: [.1, .8, 1, .7, 1, .9, .3]}) }
    st('wet', 'big', pts(t => [540 * t, 10 + 4 * Math.sin(t * 7)], 16), {w: 22, c: PAINT.bluePale, a: .45, pr: [.05, .7, 1, .8, 1, .6, .05]});
    for (const cx of [140 + R(-20, 20), 360 + R(-20, 20)]) {                                                         // claw crests: the foam left as paper
      const claw = spline([[cx - 40, 0], [cx - 10, -40], [cx + 18, -52], [cx + 34, -40], [cx + 22, -28]], 10);
      st('pigment', 'big', claw, {w: 9, c: PAINT.blue, pr: [.2, .8, 1, .7, .3]}); st('pigment', 'line', off(claw, -4), {w: 1.6, c: PAINT.ink, pr: [.3, 1, .9, .5, .2]});
      for (let k = 0; k < 4; k++) { const a = -2.4 + k * .35; st('pigment', 'line', [[cx + 26, -34], [cx + 26 + Math.cos(a) * 14, -34 + Math.sin(a) * 14]], {w: 1.4, c: PAINT.blue, pr: [1, .3]}) }
      for (let k = 0; k < 6; k++) { const x = cx + R(20, 60), y = R(-70, -40); st('pigment', 'dab', [[x, y], [x + 1, y]], {w: R(2, 4), c: PAINT.blueHi, pr: [1, 1]}) } }
  }, 'wonders');
  /* ------------------------------------------------ 火尖枪: the thrust, one long stroke of cinnabar with hooked fire */
  for (let v = 0; v < 2; v++) cell(`wthrust_${v}`, [-20, -70, 560, 70], 'x', (st, {R}) => {
    const p = pts(t => [520 * t, 4 * Math.sin(t * 8 + v)], 20);
    st('chalk', 'drag', part(p, 0, .4), {w: 20, c: PAINT.redDeep, a: .7, pr: [.1, .4, .8, 1]});                     // where the thrust began, gone dry
    st('wet', 'big', part(p, .2, 1), {w: 18, c: PAINT.red, pr: [.2, .6, .9, 1, 1, .8, .45, .1]});
    st('heavy', 'big', part(p, .3, 1), {w: 3.6, c: PAINT.ink, pr: [.2, .8, 1, 1, .9, .3]});                         // the shaft's bone in ink
    for (let i = 0; i < 5; i++) { const x = 200 + i * 62 + R(-10, 10), h = R(30, 48) * (1 - i * .08);         // a few hooked tongues off its upper edge only, leaning back: fire, not a feather
      st('pigment', 'big', spline([[x, -6], [x - h * .25, -h * .55], [x - h * .85, -h * .8], [x - h * .75, -h * .55]], 6), {w: R(6, 8), c: PAINT[i % 2 ? 'redDeep' : 'red'], pr: [1, .8, .45, .1]}) }
    st('pigment', 'big', [[500, -10], [548, 0], [500, 10]], {w: 8, c: PAINT.gold, pr: [.6, 1, .6]});              // the spearhead: matte bronze-gold
    st('pigment', 'line', [[498, -12], [550, 0], [498, 12]], {w: 1.6, c: PAINT.ink, pr: [1, 1, 1]});
  }, 'wonders');
  /* ------------------------------------------------ 定海珠: a pearl and its water trail */
  cell('wpearl', [-24, -24, 24, 24], '', (st) => {
    st('thick', 'dab', [[-1, 0], [1, 0]], {w: 34, c: PAINT.white, pr: [1, 1]});
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 17, Math.sin(t * TAU) * 17], 24), {w: 3, c: PAINT.blue, pr: [.6, 1, 1, .8, .4]});
    st('pigment', 'line', pts(t => [Math.cos(t * 4 + 2.2) * 19.5, Math.sin(t * 4 + 2.2) * 19.5], 14), {w: 1.4, c: PAINT.ink, pr: [.2, 1, .8, .1]});
    st('pigment', 'line', pts(t => [Math.cos(t * 1.6 + 3.6) * 10, Math.sin(t * 1.6 + 3.6) * 10], 8), {w: 2, c: PAINT.bluePale, a: .8, pr: [.2, 1, .2]});
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wpearl_trail_${v}`, [-10, -16, 170, 16], 'x', (st, {R}) => {
    for (let i = 0; i < 3; i++) st('pigment', 'line', pts(t => [160 * t, (i - 1) * 5 * (1 - t * .3) + 3 * Math.sin(t * 6 + i + v)], 10), {w: 1.6, c: PAINT[i === 1 ? 'blue' : 'blueHi'], a: .85, pr: [0, .1, .3, .6, .9, 1]});
  }, 'wonders');
  cell('whalo_water', [-190, -190, 190, 190], '', (st, {R}) => {
    let a = R(0, TAU);
    for (let i = 0; i < 4; i++) { const sp = R(1.1, 1.5); st('wash', 'big', pts(t => [Math.cos(a + sp * t) * 140, Math.sin(a + sp * t) * 140], 14), {w: R(24, 34), c: PAINT.bluePale, a: .6, pr: [.1, .8, 1, .9, .5, .1]}); a += sp + R(.12, .3) }
    for (let i = 0; i < 3; i++) st('pigment', 'line', pts(t => { const b = i * 2.1 + t * 1.8; return [Math.cos(b) * (118 + i * 6), Math.sin(b) * (118 + i * 6)] }, 16), {w: 1.4, c: PAINT[i === 1 ? 'ink' : 'blue'], a: .85, pr: [.1, 1, .8, .1]});
  }, 'wonders');
  /* ------------------------------------------------ 杏黄旗: the great apricot banner, golden lotus */
  cell('wflag', [-40, -760, 330, 20], '', (st, {R}) => {
    st('heavy', 'big', [[0, 0], [2, -380], [0, -740]], {w: 9, c: PAINT.ink, pr: [.8, 1, 1, .9]});                    // the pole
    st('pigment', 'dab', [[0, -748], [0, -760]], {w: 14, c: PAINT.gold, pr: [1, .4]});                                // its finial, bronze
    // the cloth hangs from a crossbar as a tall banner (the woodcuts' 旗): three vertical strokes of apricot dye side by side, each
    // swinging in an S as the wind takes it; the brush's hairs read as the folds of silk; two streamers fly from its foot
    const top = -720, x0 = 16;
    st('heavy', 'big', [[0, top - 6], [90, top - 2], [190, top + 4]], {w: 6, c: PAINT.ink, pr: [1, 1, .9]});
    for (let i = 0; i < 3; i++) { const q = pts(t => [x0 + 28 + i * 54 + 26 * Math.sin(t * 5 + i * .7) * t + t * 30, top + 6 + 440 * t], 14);
      st('wash', 'dye', q, {w: 60, c: PAINT[i === 1 ? 'goldHi' : 'ochreHi'], a: .95, pr: [1, 1, .98, .96, .94, .9, .7]}) }
    for (let i = 0; i < 4; i++) st('pigment', 'line', pts(t => [x0 + 16 + i * 46 + 26 * Math.sin(t * 5 + i * .6) * t + t * 30, top + 14 + 400 * t], 12), {w: 1.4, c: PAINT.ochre, a: .8, pr: [.3, 1, .8, .2]});   // folds
    st('pigment', 'line', pts(t => [x0 + 4 + 18 * Math.sin(t * 5) * t + t * 24, top + 4 + 430 * t], 12), {w: 2.2, c: PAINT.gold, pr: [.6, 1, 1, .8, .4]});   // the hem: bronze-gold pigment
    for (const [dx, sw] of [[30, 1], [150, -1]]) st('pigment', 'big', spline([[x0 + dx + 30, top + 440], [x0 + dx + 70, top + 500], [x0 + dx + 40 + 50 * sw, top + 560], [x0 + dx + 90 + 40 * sw, top + 610]], 10), {w: 20, c: PAINT.ochreHi, pr: [1, .85, .5, .15]});   // streamers
    for (let i = 0; i < 2; i++) { const cx = x0 + 70 + i * 60, cy = top + 130 + i * 150; st('pigment', 'line', pts(t => { const a = t * 9, r = 22 * (1 - t * .8); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8] }, 20), {w: 2, c: PAINT.ochre, pr: [.3, 1, .8, .3]}) }   // cloud scrolls dyed in
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wlotus_${v}`, [-50, -50, 50, 20], '', (st, {R}) => {
    for (let i = 0; i < 7; i++) { const a = -Math.PI + (i + .5) / 7 * Math.PI, L = (i === 3 ? 40 : 30) * R(.9, 1.1), q = spline([[0, 6], [Math.cos(a) * L * .5 - Math.sin(a) * 8, Math.sin(a) * L * .6], [Math.cos(a) * L, Math.sin(a) * L * .9]], 6);
      st('pigment', 'big', q, {w: 12, c: PAINT[i % 2 ? 'ochreHi' : 'goldHi'], pr: [.5, 1, .7, .15]}); st('pigment', 'line', off(q, -5), {w: 1, c: PAINT.ochre, pr: [.2, 1, .2]}) }
    st('pigment', 'big', [[-30, 12], [0, 16], [30, 12]], {w: 6, c: PAINT.green, pr: [.3, 1, .3]});
  }, 'wonders');

  /* ------------------------------------------------ 番天印 in brush: a mountain of bronze, no face */
  cell('wseal', [-180, -420, 180, 16], '', (st, {R}) => {
    const F = [[-120, -30], [50, -30], [50, -230], [-120, -230]], Sd = [[50, -30], [130, -80], [130, -280], [50, -230]], T = [[-120, -230], [50, -230], [130, -280], [-40, -280]];
    const lay = (q, c, w, n, a = .95) => { for (let i = 0; i <= n; i++) { const y = i / n; st('pigment', 'blunt', [[q[0][0] + (q[3][0] - q[0][0]) * y, q[0][1] + (q[3][1] - q[0][1]) * y], [q[1][0] + (q[2][0] - q[1][0]) * y, q[1][1] + (q[2][1] - q[1][1]) * y]], {w, c, a, pr: [.7, 1, .9, .6]}) } };
    // axe-cut strokes: bronze in front, the side in ink shadow, the top lit (near paper); laid with gaps so paper shows through
    // a mass of ink, not a box of boards: each face laid in vertical axe-cut strokes from its top edge to its foot (the hairs run
    // down the bronze like a cast surface), the front darkest, the side a let-down ink, the top lit ochre
    const face = (q, cs, w, n, a = .95) => { for (let i = 0; i <= n; i++) { const x = (i + .5) / (n + 1); const A = [q[3][0] + (q[2][0] - q[3][0]) * x, q[3][1] + (q[2][1] - q[3][1]) * x], B = [q[0][0] + (q[1][0] - q[0][0]) * x, q[0][1] + (q[1][1] - q[0][1]) * x];
      st('heavy', 'blunt', [A, [(A[0] + B[0]) / 2 + R(-3, 3), (A[1] + B[1]) / 2], B], {w, c: cs[i % cs.length], a, pr: [1, .95, .85]}) } };
    face(F, [PAINT.inkMid, PAINT.ink, PAINT.inkMid], 26, 7); face(Sd, [PAINT.inkPale, PAINT.inkMid], 22, 3, .9);
    for (let i = 0; i < 3; i++) { const y = i / 3; st('pigment', 'blunt', [[T[0][0] + (T[3][0] - T[0][0]) * y + 10, T[0][1] + (T[3][1] - T[0][1]) * y], [T[1][0] + (T[2][0] - T[1][0]) * y - 10, T[1][1] + (T[2][1] - T[1][1]) * y]], {w: 18, c: PAINT.ochreHi, a: .9, pr: [.8, 1, .8]}) }
    st('chalk', 'drag', [[-118, -40], [-118, -220]], {w: 16, c: PAINT.ink, a: .6, pr: [.6, 1, .5]});                // a dry stroke down its shaded edge
    for (let i = 0; i < 10; i++) { const x = R(-110, 40), y = R(-215, -45); st('pigment', 'dab', [[x, y], [x + R(-5, 5), y + R(-3, 3)]], {w: R(8, 16), c: PAINT[i % 2 ? 'green' : 'greenHi'], a: .55, pr: [1, .4]}) }   // patina, matte
    // a band of 雷纹 round the front face, in ink line: square spirals in a row, top and bottom
    for (const yy of [-52, -208]) for (let i = 0; i < 5; i++) { const cx = -110 + i * 33, s = yy > -100 ? -1 : 1;
      st('pigment', 'line', [[cx, yy], [cx + 24, yy], [cx + 24, yy + 14 * s], [cx + 6, yy + 14 * s], [cx + 6, yy + 6 * s], [cx + 16, yy + 6 * s]], {w: 2, c: PAINT.ochreHi, pr: [1, 1, 1, 1, 1, .4]}) }
    // in the middle one great cloud scroll, a few bold strokes (the treasure's seal face is underneath, unseen)
    st('pigment', 'big', pts(t => { const a = t * 8 + 1, r = 46 * (1 - t * .85); return [-35 + Math.cos(a) * r, -130 + Math.sin(a) * r * .8] }, 30), {w: 5, c: PAINT.gold, pr: [.3, 1, 1, .8, .5, .2]});
    st('pigment', 'big', spline([[10, -130], [40, -110], [44, -80]], 6), {w: 4, c: PAINT.gold, pr: [1, .6, .1]});
    // edges in ink; the lit edges a line of bronze-gold pigment
    for (const [a, b] of [[F[0], F[1]], [F[1], F[2]], [F[2], F[3]], [F[3], F[0]], [Sd[1], Sd[2]], [T[2], T[3]], [T[3], T[0]]]) st('heavy', 'line', [a, b], {w: 3, c: PAINT.ink, pr: [.7, 1, 1, .8]});
    st('pigment', 'line', [[-118, -233], [48, -233], [128, -283]], {w: 2.4, c: PAINT.goldHi, pr: [.3, 1, 1, .3]});
    // the knob: a crouching beast in four bold strokes of ink and bronze, a mane of hooked strokes, a line of gold on its back
    st('heavy', 'big', spline([[-70, -262], [-40, -316], [10, -326], [56, -296]], 10), {w: 34, c: PAINT.inkMid, pr: [.5, 1, 1, .7]});
    st('pigment', 'big', spline([[-60, -270], [-30, -310], [10, -318]], 8), {w: 14, c: PAINT.ochre, a: .8, pr: [.3, 1, .5]});
    st('heavy', 'big', spline([[30, -318], [56, -352], [84, -344]], 8), {w: 22, c: PAINT.ink, pr: [.8, 1, .6]});
    for (let i = 0; i < 6; i++) st('pigment', 'big', spline([[24 + i * 7, -336], [10 + i * 7, -366 - i * 3], [-8 + i * 6, -372 - i * 4]], 6), {w: 6, c: PAINT[i % 2 ? 'ochre' : 'ink'], pr: [1, .6, .1]});
    st('pigment', 'line', spline([[-50, -300], [-10, -322], [40, -318]], 8), {w: 2, c: PAINT.goldHi, pr: [.2, 1, .3]});
    st('thick', 'dab', [[74, -346], [76, -346]], {w: 6, c: PAINT.white, pr: [1, 1]});
    for (const x of [-56, 34]) st('heavy', 'dab', [[x, -264], [x + 8, -246]], {w: 9, c: PAINT.ink, pr: [1, .5]});
  }, 'wonders');

  /* ------------------------------------------------ SPEC-CAMPAIGN 1.11: the hero's states, the Shang's lasting ground */
  // 吕岳's plague ground: low dragged hair of dull green and ochre, a few dark spores; flat on the ground (drawn squashed)
  for (let v = 0; v < 2; v++) cell(`wplague_${v}`, [-120, -44, 120, 44], '', (st, {R}) => {
    for (let i = 0; i < 7; i++) { const y = -32 + i * 10 + R(-3, 3), x0 = -110 + R(0, 40), x1 = 110 - R(0, 40);
      st('chalk', 'drag', pts(t => [x0 + (x1 - x0) * t, y + 4 * Math.sin(t * 5 + i + v)], 8), {w: R(14, 22), c: PAINT[['green', 'ochre', 'inkMid'][i % 3]], a: .9, pr: [.1, .7, 1, .8, .2]}); }
    for (let i = 0; i < 9; i++) { const x = R(-90, 90), y = R(-28, 28); st('pigment', 'big', [[x, y], [x + 3, y + 1]], {w: R(4, 7), c: PAINT.ink, a: .85, pr: [.6, 1, .6]}); }
  }, 'wonders');
  // 卞吉's 幽魂白骨幡: an ink pole, a long pale banner hanging from a crossbar, three small skulls in ink, bone strings
  cell('wbone', [-60, -300, 60, 12], '', (st, {R}) => {
    st('heavy', 'blunt', [[0, 0], [0, -150], [0, -292]], {w: 12, c: PAINT.ink, pr: [1, 1, .8]});
    st('heavy', 'big', [[-40, -270], [0, -276], [42, -270]], {w: 7, c: PAINT.ink, pr: [.6, 1, .6]});
    for (let i = 0; i < 4; i++) { const x = -30 + i * 20; st('thick', 'big', pts(t => [x + 3 * Math.sin(t * 4 + i), -268 + 160 * t * (1 - .1 * (i % 2))], 8), {w: 22, c: PAINT.white, pr: [1, 1, 1, .9, .5]}); }
    for (const x of [-40, 40]) st('pigment', 'line', pts(t => [x + 2 * Math.sin(t * 6), -268 + 150 * t], 8), {w: 1.6, c: PAINT.inkPale, pr: [1, 1, .4]});
    for (let i = 0; i < 3; i++) { const y = -236 + i * 42; st('heavy', 'big', pts(t => [Math.cos(t * TAU) * 6, y + Math.sin(t * TAU) * 7], 12), {w: 5, c: PAINT.ink, pr: [.6, 1, 1, .6]}); st('heavy', 'big', [[-3, y + 9], [3, y + 9]], {w: 4, c: PAINT.ink, pr: [1, 1]}); }
    for (const x of [-38, 38]) st('pigment', 'line', pts(t => [x + 6 * Math.sin(t * 3), -270 + 200 * t], 9), {w: 2.2, c: PAINT.inkClear, pr: [.4, 1, 1, .3]});
  }, 'wonders');
  // 纣王's 托梁换柱: the fallen beam, axe-cut strokes of ochre and ink along the grain, the ends broken
  cell('wbeam', [-170, -34, 170, 26], '', (st, {R}) => {
    st('heavy', 'blunt', [[-160, 0], [0, -3], [160, 0]], {w: 40, c: PAINT.ochre, pr: [.8, 1, 1, .85]});
    for (let i = 0; i < 4; i++) st('chalk', 'drag', [[-150 + R(0, 30), -14 + i * 9], [150 - R(0, 30), -14 + i * 9 + R(-2, 2)]], {w: 4, c: PAINT.ink, a: .65, pr: [.2, 1, .8, .1]});
    st('pigment', 'line', [[-160, -20], [0, -23], [160, -20]], {w: 2.4, c: PAINT.ink, pr: [.5, 1, .5]});
    st('heavy', 'big', [[-160, 20], [0, 18], [160, 20]], {w: 5, c: PAINT.ink, pr: [.4, 1, .4]});
  }, 'wonders');
  // burnt ground: dry ink dragged out from a centre, a few embers of deep cinnabar
  for (let v = 0; v < 2; v++) cell(`wscorch_${v}`, [-100, -40, 100, 40], '', (st, {R}) => {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + R(-.2, .2), r0 = R(8, 24), r1 = R(60, 95); st('chalk', 'drag', [[Math.cos(a) * r0, Math.sin(a) * r0 * .4], [Math.cos(a) * r1, Math.sin(a) * r1 * .4]], {w: R(9, 16), c: PAINT[i % 3 ? 'inkMid' : 'ink'], a: .8, pr: [1, .7, .2]}); }
    for (let i = 0; i < 6; i++) { const x = R(-60, 60), y = R(-20, 20); st('pigment', 'big', [[x, y], [x + 3, y]], {w: R(4, 7), c: PAINT.redDeep, pr: [.6, 1, .6]}); }
  }, 'wonders');
  // a drop of blood running (化血神刀's bleed), deep cinnabar
  cell('wdrip', [-8, -4, 8, 34], '', (st) => {
    st('pigment', 'big', [[0, 0], [0.5, 14], [0, 26]], {w: 5, c: PAINT.redDeep, pr: [.3, .7, 1]});
    st('heavy', 'dab', [[0, 27], [0, 29]], {w: 9, c: PAINT.redDeep, pr: [1, 1]});
  }, 'wonders');
  // dizzy: one ink spiral seen flat, its dry tail running off
  cell('wswirl', [-40, -18, 46, 18], '', (st) => {
    st('pigment', 'big', pts(t => { const a = t * TAU * 1.7, r = 6 + 30 * t; return [Math.cos(a) * r, Math.sin(a) * r * .42]; }, 30), {w: 4, c: PAINT.inkMid, pr: [.3, .8, 1, 1, .7]});
    st('chalk', 'drag', [[30, -4], [44, 2]], {w: 4, c: PAINT.inkMid, a: .7, pr: [1, .2]});
  }, 'wonders');
  // a low fire on the ground: three or four hooked tongues of cinnabar from one root, unequal, leaning one way, ink hair
  // on the tallest, the root a smear of deep red; foot at the pivot
  for (let v = 0; v < 2; v++) cell(`wflame_${v}`, [-60, -120, 60, 10], '', (st, {R}) => {
    const lean = v ? -1 : 1;
    const W = 30, H = 104;
    st('chalk', 'drag', [[-W * 1.2, 1], [-W * .3, -1], [W * .4, 1], [W * 1.2, 0]], {w: W * .7, c: PAINT.red, a: .5, pr: [.2, .8, 1, .8, .2]});      // a dry wash where it stands
    for (let j = 0; j < 3; j++) { const x0 = (j - 1) * W * .45 + R(-.1, .1) * W, hh = H * [.7, 1, .55][j] * R(.92, 1.08), s = lean * (j === 2 ? -1 : 1), ph = R(0, 3);
      const sp = spline([[x0, 0], [x0 + s * hh * .12, -hh * .3], [x0 - s * hh * .1, -hh * .6], [x0 + s * hh * .22, -hh * .88], [x0 + s * hh * .4, -hh]], 14);   // an S, flicking over at the top
      st('pigment', 'big', sp, {w: W * (j === 1 ? .62 : .48), c: PAINT[j === 1 ? 'red' : j ? 'redDeep' : 'redHot'], pr: [1, 1, .85, .6, .38, .2, .08]});
      st('chalk', 'drag', part(sp, .45, 1), {w: W * .34, c: PAINT.redDeep, a: .95, pr: [.9, .7, .5, .3, .12]}); }      // the brush running dry
  }, 'wonders');
  /* ------------------------------------------------ the spoils held (SPEC 2.11: what a player must see while holding each) */
  // 混元伞: the Umbrella of Chaos open, seen a little from below: a dome of dark ink ribs, a pale cloth, pearls hung at the rim
  cell('wumbrella', [-110, -150, 110, 20], '', (st, {R}) => {
    st('wet', 'big', pts(t => { const a = Math.PI + t * Math.PI; return [Math.cos(a) * 96, -40 + Math.sin(a) * 60]; }, 24), {w: 34, c: PAINT.inkMid, a: .85, pr: [.4, 1, 1, 1, .4]});
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI; st('heavy', 'big', [[0, -100], [Math.cos(a) * 50, -40 + Math.sin(a) * 30 - 30], [Math.cos(a) * 98, -40 + Math.sin(a) * 60]], {w: 4, c: PAINT.ink, pr: [.6, 1, .8]}); }
    st('pigment', 'line', pts(t => [-98 + 196 * t, -40 + 6 * Math.sin(t * 20)], 30), {w: 2, c: PAINT.ink, pr: [1, 1, 1]});
    for (let k = 0; k < 9; k++) { const x = -88 + k * 22; st('thick', 'big', [[x, -32], [x, -26]], {w: 8, c: PAINT.white, pr: [1, 1]}); st('pigment', 'line', pts(t => [x + Math.cos(t * TAU) * 4.5, -29 + Math.sin(t * TAU) * 4.5], 10), {w: 1, c: PAINT.blue, pr: [1, 1]}); }
    st('heavy', 'blunt', [[0, -104], [0, 14]], {w: 6, c: PAINT.ink, pr: [1, 1, 1]});
    st('pigment', 'big', [[0, -112], [0, -100]], {w: 10, c: PAINT.gold, pr: [1, 1]});
  }, 'wonders');
  // 金霞冠: a small gold crown, matte bronze-gold in a few strokes, three points, a red jewel
  cell('wcrown', [-34, -40, 34, 6], '', (st) => {
    st('pigment', 'big', [[-28, 0], [0, 2], [28, 0]], {w: 9, c: PAINT.gold, pr: [1, 1, 1]});
    for (const [x, h] of [[-20, 22], [0, 32], [20, 22]]) st('pigment', 'big', [[x - 7, -2], [x, -h], [x + 7, -2]], {w: 5, c: PAINT.goldHi, pr: [1, .8, 1]});
    st('pigment', 'line', [[-28, 3], [28, 3]], {w: 1.2, c: PAINT.ink, pr: [1, 1]});
    st('heavy', 'big', [[0, -8], [0, -6]], {w: 7, c: PAINT.red, pr: [1, 1]});
  }, 'wonders');
  // 地行术: the earth heaved up where he travels under it: a low mound of ochre and dry ink, clods at its foot
  cell('wmound', [-80, -44, 80, 10], '', (st, {R}) => {
    st('wet', 'big', pts(t => [-70 + 140 * t, -36 * Math.sin(t * Math.PI)], 16), {w: 26, c: PAINT.ochre, pr: [.3, 1, 1, .3]});
    st('chalk', 'drag', pts(t => [-66 + 132 * t, -38 * Math.sin(t * Math.PI) + 2], 14), {w: 6, c: PAINT.ink, a: .8, pr: [.2, 1, 1, .2]});
    for (let k = 0; k < 6; k++) { const x = R(-70, 70); st('heavy', 'big', [[x, 2], [x + 4, 3]], {w: R(5, 9), c: PAINT.inkMid, pr: [1, 1]}); }
  }, 'wonders');
  // 青云剑 at his back: a long blue-green blade in one stroke, a bronze guard; 碧玉琵琶: a jade lute, its neck bent back
  cell('wsword', [-12, -150, 12, 10], '', (st) => {
    st('pigment', 'big', [[0, 0], [0, -70], [0, -146]], {w: 8, c: PAINT.blueHi, pr: [1, 1, .9, .2]});
    st('pigment', 'line', [[2, -4], [2, -140]], {w: 1.2, c: PAINT.bluePale, pr: [1, 1, .3]});
    st('pigment', 'big', [[-11, -4], [11, -4]], {w: 6, c: PAINT.gold, pr: [1, 1]}); st('heavy', 'big', [[0, -2], [0, 10]], {w: 5, c: PAINT.ink, pr: [1, 1]});
  }, 'wonders');
  cell('wpipa', [-30, -130, 30, 10], '', (st) => {
    st('wet', 'big', [[0, 0], [0, -30], [0, -60]], {w: 48, c: PAINT.green, pr: [.6, 1, .5]});
    st('pigment', 'big', [[0, -58], [0, -110], [-6, -126]], {w: 9, c: PAINT.greenHi, pr: [1, 1, .8]});
    for (const x of [-4, 0, 4]) st('pigment', 'line', [[x, -20], [x * 0.5, -108]], {w: .8, c: PAINT.white, pr: [1, 1]});
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 22, -30 + Math.sin(t * TAU) * 30], 20), {w: 1.4, c: PAINT.ink, pr: [1, 1]});
  }, 'wonders');
  // 五色神光 behind him: five arcs of pigment, one over the other, as a mandorla
  cell('wfive', [-110, -230, 110, 10], '', (st) => {
    const C5 = ['blue', 'red', 'ochre', 'white', 'ink'];
    for (let k = 0; k < 5; k++) { const r = 96 - k * 13; st('pigment', 'big', pts(t => { const a = Math.PI * (1.05 + 0.9 * t); return [Math.cos(a) * r * 0.8, -100 + Math.sin(a) * r * 1.2]; }, 20), {w: 9, c: PAINT[C5[k]], a: .85, pr: [.2, 1, 1, 1, .2]}); }
  }, 'wonders');
  /* ------------------------------------------------ 显圣: the gods' feats (the lead, 2026-11-25: "既然都显圣成神了，尽量做好一点") */
  // 哮天犬 in ink: a lean hound at full stretch in a few wet strokes, the far legs paler, a dry trail of hair behind (faces +x)
  for (let v = 0; v < 2; v++) cell(`whound_${v}`, [-90, -54, 76, 14], '', (st, {R}) => {
    const leg = (a, b, c, w, col, al) => st('pigment', 'big', spline([a, b, c], 6), {w, c: PAINT[col], a: al, pr: [1, .8, .4]});
    st('wet', 'big', spline([[-54, -26], [-20, -34 - v * 3], [18, -32], [44, -26]], 10), {w: 20, c: PAINT.ink, pr: [.5, 1, 1, .85, .6]});        // the body: one pull
    st('wet', 'big', spline([[40, -28], [56, -40], [70, -38]], 6), {w: 12, c: PAINT.ink, pr: [1, 1, .6]});                                    // neck and head
    st('pigment', 'big', [[62, -46], [70, -52]], {w: 5, c: PAINT.ink, pr: [1, .3]});                                                         // the ear laid back
    leg([30, -22], [52, -8], [72, -2], 6, 'inkMid', .6); leg([24, -20], [46, -4], [62, 4], 7, 'ink', 1);                                    // forelegs reaching
    leg([-44, -22], [-66, -8], [-86, -4], 6, 'inkMid', .6); leg([-40, -20], [-58, -2], [-78, 6], 7, 'ink', 1);                               // hind legs thrown back
    st('chalk', 'drag', spline([[-54, -30], [-72, -40], [-90, -42]], 6), {w: 6, c: PAINT.ink, a: .8, pr: [1, .5, .1]});                    // the tail
    st('chalk', 'drag', [[-30, -12], [-70, -10]], {w: 14, c: PAINT.inkPale, a: .5, pr: [.6, .3, .05]});                                    // dust of the run
  }, 'wonders');
  // lightning in brush: a jagged ink stroke, a matte gold hair along it, forks; falls from y = -300 to 0 (pivot at the foot)
  for (let v = 0; v < 2; v++) cell(`wbolt_${v}`, [-70, -310, 70, 10], '', (st, {R}) => {
    const p = [[R(-10, 10), -300]]; for (let i = 1; i <= 7; i++) p.push([(i % 2 ? 1 : -1) * R(14, 30) * (v ? -1 : 1), -300 + i * 42 + R(-6, 6)]); p.push([0, 0]);
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1], w = 6 + 6 * (i / p.length);
      st('heavy', 'big', [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], {w, c: PAINT.ink, pr: [1, .8, 1]});
      st('pigment', 'line', [[a[0] + 3, a[1]], [b[0] + 3, b[1]]], {w: 1.8, c: PAINT.goldHi, pr: [1, 1]}); }
    for (const k of [2, 4]) { const a = p[k], b = [a[0] + R(-40, 40), a[1] + 36], c = [b[0] + R(-30, 30), b[1] + 34];
      st('pigment', 'big', [a, b], {w: 4, c: PAINT.ink, pr: [1, .7]}); st('pigment', 'big', [b, c], {w: 3, c: PAINT.ink, pr: [.7, .1]}); }
  }, 'wonders');
  // the earth opened: a slab of ground standing up (ochre, axe-cut ink edges, clods) and a crack running out (along +x)
  for (let v = 0; v < 2; v++) cell(`wslab_${v}`, [-46, -96, 46, 8], '', (st, {R}) => {
    const lean = v ? 8 : -8, top = [[-30 + lean, -84], [-12 + lean, -96], [4 + lean, -86], [18 + lean, -94], [30 + lean, -80]];
    for (let k = 0; k < 5; k++) { const x = -24 + k * 12; st('wet', 'big', [[x, -2], [x + lean * .5, -46], [x + lean, -84 - (k % 2) * 8]], {w: 18, c: PAINT[k > 2 ? 'ochre' : 'ochreHi'], pr: [1, 1, .9]}); }
    st('wet', 'big', [[18, -4], [18 + lean, -82]], {w: 16, c: PAINT.inkMid, a: .6, pr: [1, 1, .8]});                                       // its shadowed face
    for (let i = 0; i < top.length - 1; i++) st('heavy', 'big', [top[i], top[i + 1]], {w: 4, c: PAINT.ink, pr: [1, 1]});              // the broken top
    st('pigment', 'line', [[-30, 0], [-30 + lean, -84]], {w: 2, c: PAINT.ink, pr: [1, 1]}); st('pigment', 'line', [[30, 0], [30 + lean, -80]], {w: 2, c: PAINT.ink, pr: [1, 1]});
    for (let k = 0; k < 4; k++) { const x = R(-36, 36); st('heavy', 'big', [[x, 4], [x + 3, 5]], {w: R(5, 8), c: PAINT.inkMid, pr: [1, 1]}); }
  }, 'wonders');
  for (let v = 0; v < 2; v++) cell(`wcrack_${v}`, [-6, -24, 260, 24], 'x', (st, {R}) => {
    const p = [[0, 0]]; for (let i = 1; i <= 9; i++) p.push([i * 28, R(-12, 12)]);
    for (let i = 0; i < p.length - 1; i++) st('heavy', 'big', [p[i], [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2], p[i + 1]], {w: 8 * (1 - i / p.length) + 1, c: PAINT.ink, pr: [1, .9, 1]});
    for (const k of [3, 6]) st('pigment', 'big', [p[k], [p[k][0] + 26, p[k][1] + R(-20, 20)]], {w: 3, c: PAINT.ink, pr: [1, .1]});
  }, 'wonders');
  // 五光: a ray of one mineral pigment, pressed at the stone and lifted as it goes out, its edge a dry hair (along +x)
  for (const [k, col] of [['blue', 'blue'], ['red', 'red'], ['gold', 'gold'], ['white', 'white'], ['green', 'green']].entries()) cell(`wlight5_${k}`, [-4, -20, 460, 20], 'x', (st, {R}) => {
    const p = pts(t => [450 * t, 3 * Math.sin(t * 5 + k)], 14);
    st('pigment', 'big', p, {w: 26, c: PAINT[col[1]], a: col[1] === 'white' ? 1 : .9, pr: [1, .95, .85, .7, .5, .32, .16, .05]});
    st('chalk', 'drag', off(p, 8), {w: 5, c: PAINT[col[1] === 'white' ? 'inkPale' : col[1]], a: .7, pr: [.8, .6, .4, .2, .05]});
    if (col[1] === 'white') st('pigment', 'line', off(p, -11), {w: 1.2, c: PAINT.inkPale, pr: [1, .8, .4, .1]});
  }, 'wonders');
  // 郑伦's white light: two broad pale strokes leaving paper bright, an ink hair on each edge (along +x)
  for (let v = 0; v < 2; v++) cell(`wwhite_${v}`, [-4, -34, 520, 34], 'x', (st, {R}) => {
    const p = pts(t => [510 * t, (v ? -1 : 1) * 6 * Math.sin(t * 3.2)], 16);
    st('thick', 'big', p, {w: 48, c: PAINT.white, pr: [1, 1, .95, .85, .7, .5, .3, .1]});
    st('pigment', 'line', off(p, 25), {w: 1.6, c: PAINT.inkMid, pr: [1, .9, .6, .3, .05]}); st('pigment', 'line', off(p, -25), {w: 1.6, c: PAINT.inkMid, pr: [1, .9, .6, .3, .05]});
    st('scumble', 'drag', off(p, 10), {w: 10, c: PAINT.bluePale, a: .4, pr: [.6, .5, .3, .1]});
  }, 'wonders');
  // 四海瓶: a vase of celadon, ink outline, a gold mouth rim, a wave on its belly
  cell('wvase', [-50, -130, 50, 8], '', (st) => {
    st('wet', 'big', [[0, -6], [0, -50], [0, -92]], {w: 74, c: PAINT.green, pr: [.75, 1, .55]});
    st('pigment', 'big', [[0, -92], [0, -118]], {w: 26, c: PAINT.greenHi, pr: [1, 1]});
    st('pigment', 'big', [[-18, -120], [18, -120]], {w: 7, c: PAINT.gold, pr: [1, 1]});
    for (const sg of [-1, 1]) st('pigment', 'line', spline([[sg * 22, -4], [sg * 38, -40], [sg * 30, -84], [sg * 13, -94], [sg * 13, -118]], 14), {w: 1.6, c: PAINT.ink, pr: [1, 1, 1]});
    st('pigment', 'line', pts(t => [-30 + 60 * t, -48 + 6 * Math.sin(t * 12)], 16), {w: 2, c: PAINT.blue, pr: [1, 1, 1]});
  }, 'wonders');
  // 攒心钉: a slim nail of matte gold, its point dark, a tail of cinnabar fire flaring behind it (points +x)
  for (let v = 0; v < 2; v++) cell(`wnail_${v}`, [-220, -26, 40, 26], 'x', (st, {R}) => {
    st('pigment', 'big', [[-40, 0], [10, 0], [36, 0]], {w: 9, c: PAINT.gold, pr: [1, 1, .1]});
    st('heavy', 'big', [[22, 0], [38, 0]], {w: 5, c: PAINT.ink, pr: [1, .1]});
    for (let k = 0; k < 5; k++) { const a = (k - 2) * .16, L = R(120, 180), sp = pts(t => [-40 - L * t, Math.sin(a) * L * t + 6 * Math.sin(t * 7 + k)], 8);
      st('pigment', 'big', sp, {w: R(8, 12), c: PAINT[k % 2 ? 'redDeep' : 'red'], pr: [1, .8, .5, .25, .05]}); st('chalk', 'drag', part(sp, .4, 1), {w: 4, c: PAINT.redDeep, a: .8, pr: [.7, .4, .1]}); }
  }, 'wonders');
  // dust thrown by a charge: a low dry swirl of ochre and ink (flat on the ground)
  for (let v = 0; v < 2; v++) cell(`wdust_${v}`, [-70, -40, 70, 10], '', (st, {R}) => {
    for (let k = 0; k < 4; k++) st('chalk', 'drag', pts(t => { const a = t * Math.PI * 1.2 + k; return [Math.cos(a) * (30 + 30 * t) * (v ? -1 : 1), -12 - 16 * t + Math.sin(a) * 10]; }, 10), {w: R(10, 16), c: PAINT[k % 2 ? 'ochre' : 'inkPale'], a: .7, pr: [.2, .9, 1, .5, .1]});
  }, 'wonders');
}
