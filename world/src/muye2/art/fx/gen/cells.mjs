// The brush vocabulary (review/DESIGN.md, "Stroke families"). Units are world px; the main sheet bakes 1.5 px a unit.
// Rules every stroke here keeps: a pressed head, a belly and a lifted tail (提按); dry hair where the brush runs out (飞白);
// colour laid over a pale ink bone (骨), never a flat tube; light is paper left bare, a white scumble or a gold hair.
export function vocabulary({cell, PAINT, pts, off, part, strokeAt, spline}) {
  const CALLI = [.55, 1, .95, .86, .74, .62, .5, .38, .26, .14, .05];          // a stroke: pressed head, belly, lifted tail
  const SWELL = [.3, .75, 1, 1, .9, .7, .45, .2];                              // a stroke that swells in its middle

  /* ============================================================ the bone: a pale ink line laid first (gather) */
  for (let v = 0; v < 3; v++) cell(`hair_${v}`, [-6, -16, 210, 16], 'x', (st, {R}) => {
    const p = pts(t => [200 * t, 5 * Math.sin(t * (3 + v) + v) * (1 - t)], 12);
    st('pigment', 'line', p, {w: 2.6, c: PAINT.inkPale, pr: [.3, 1, .85, .7, .55, .4, .25, .1]});
    st('chalk', 'drag', part(p, .55, 1), {w: 4, c: PAINT.inkPale, a: .7, pr: [.6, 1, .5, .15]});
  }, 'soft');

  /* ============================================================ FIRE 火: tongues with hooked tips, layered dark to hot, core left as paper */
  // a flame tongue standing on its foot: char under it, a dark tongue behind, the main tongue, a darker one in front, the hot core
  // brushed flame (the lead, 2026-11-25: "a few upward strokes of cinnabar with a dry tip and a wash at the root"): a
  // let-down wash where it stands, then three strokes pressed at the root and lifted as they rise, the last of each dry
  function tongue(st, R, h, w, lean = 1) {
    st('chalk', 'drag', [[-w * 1.2, 1], [-w * .3, -1], [w * .4, 1], [w * 1.2, 0]], {w: w * .7, c: PAINT.red, a: .5, pr: [.2, .8, 1, .8, .2]});      // a dry wash where it stands
    for (let j = 0; j < 3; j++) { const x0 = (j - 1) * w * .45 + R(-.1, .1) * w, hh = h * [.7, 1, .55][j] * R(.92, 1.08), s = lean * (j === 2 ? -1 : 1), ph = R(0, 3);
      const sp = spline([[x0, 0], [x0 + s * hh * .12, -hh * .3], [x0 - s * hh * .1, -hh * .6], [x0 + s * hh * .22, -hh * .88], [x0 + s * hh * .4, -hh]], 14);   // an S, flicking over at the top
      st('pigment', 'big', sp, {w: w * (j === 1 ? .62 : .48), c: PAINT[j === 1 ? 'red' : j ? 'redDeep' : 'redHot'], pr: [1, 1, .85, .6, .38, .2, .08]});
      st('chalk', 'drag', part(sp, .45, 1), {w: w * .34, c: PAINT.redDeep, a: .95, pr: [.9, .7, .5, .3, .12]}); }      // the brush running dry
  }
  [[0, 46, 13], [1, 46, 13], [2, 80, 19], [3, 80, 19], [4, 124, 26], [5, 124, 26]].forEach(([v, h, w]) => cell(`fl_${v}`, [-w * 2.2 - h * .35, -h * 1.05, w * 2, 8], 'up', (st, {R}) => tongue(st, R, h * R(.92, 1.06), w, v % 2 ? 1 : -1)));
  // what is left of a tongue: the same shape gone dry, deep red and ink, broken
  for (let v = 0; v < 2; v++) cell(`fl_dry_${v}`, [-60, -90, 40, 8], 'up', (st, {R}) => {
    const h = 74, spine = pts(t => [-20 * t * t + 6 * Math.sin(t * 5 + v) * (1 - t), -h * t], 12);
    st('chalk', 'big', spine, {w: 18, c: PAINT.redDeep, a: .85, pr: [.7, 1, .8, .5, .25, .06]});
    st('chalk', 'drag', off(part(spine, 0, .6), 6), {w: 8, c: PAINT.ink, a: .6, pr: [.6, 1, .4, .1]});
  }, 'soft');

  // the dragon of fire (九龙神火罩): a body chained from segments, a head, a tail. Facing +x; the page lays them along a coil.
  // The body is a flame itself: an ink spine (the darkest thing in it, thin), cinnabar flesh, a deep belly, a hot core,
  // scales hinted by three hairs of paper white, two dorsal tongues licking back.
  for (let v = 0; v < 3; v++) cell(`drg_${v}`, [-8, -30, 76, 20], 'x', (st, {R}) => {
    const L = 64, ph = R(0, 6), p = pts(t => [L * t, 3 * Math.sin(t * 6.28 + ph)], 10);
    st('pigment', 'big', p, {w: 17, c: PAINT.red, pr: [.92, 1, 1, .97, 1, .94]});                                           // the trunk
    st('scumble', 'dab', part(off(p, 6), .02, .98), {w: 5, c: PAINT.ochreHi, a: .95, pr: [.8, 1, 1, .9]});                // the belly: pale plates
    for (let i = 0; i < 6; i++) { const q = p[1 + i * 1.6 | 0]; st('pigment', 'line', [[q[0], q[1] + 3.5], [q[0] + 1.5, q[1] + 8.5]], {w: 1.1, c: PAINT.redDeep, pr: [1, 1]}) }
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const q = p[Math.min(10, 1 + i * 2)], y = q[1] - 4 + r * 4.5, x = q[0] + r * 6;           // scales: little hooks of deep red
      st('pigment', 'line', [[x - 3, y - 2], [x + 1, y + 1], [x - 3, y + 3]], {w: 1.5, c: PAINT.redDeep, a: .9, pr: [.4, 1, .4]}) }
    st('pigment', 'line', off(p, -8.2), {w: 2.2, c: PAINT.ink, pr: [.8, 1, .9, 1, .9, .8]});                                // the spine
    for (let i = 0; i < 5; i++) { const q = off(p, -8)[1 + i * 2], h = R(5, 8);                                             // a saw ridge leaning back
      st('pigment', 'dab', [[q[0] + 3, q[1]], [q[0] - 2, q[1] - h]], {w: 4, c: PAINT[i % 2 ? 'redDeep' : 'ink'], pr: [1, .2]}) }
    const q = off(p, -8)[2], h = R(14, 20); st('pigment', 'dab', spline([[q[0] + 4, q[1]], [q[0] - h * .4, q[1] - h * .6], [q[0] - h, q[1] - h * .7]], 5), {w: 5, c: PAINT.red, pr: [1, .6, .2, .03]});   // one tongue of fire it trails
    st('scumble', 'line', part(off(p, -3), .1, .8), {w: 1.6, c: PAINT.white, a: .7, pr: [.2, 1, .6, .1]});
  });
  for (let v = 0; v < 3; v++) cell(`drg_dry_${v}`, [-8, -30, 76, 20], 'x', (st, {R}) => {      // the body in flying white: paper through the red, the scales in deep red hooks, the spine in dry ink
    const p = pts(t => [64 * t, 3 * Math.sin(t * 6.28 + v * 2)], 10);
    st('chalk', 'big', p, {w: 17, c: PAINT.red, a: .85, pr: [.8, 1, .9, 1, .85, .9]});
    st('chalk', 'drag', off(p, 4), {w: 7, c: PAINT.redDeep, a: .7, pr: [.6, 1, .8, .6]});
    for (let i = 0; i < 5; i++) { const q = p[Math.min(10, 1 + i * 2)]; st('pigment', 'line', [[q[0] - 3, q[1] - 4], [q[0] + 1, q[1] - 1], [q[0] - 3, q[1] + 2]], {w: 1.4, c: PAINT.redDeep, a: .85, pr: [.4, 1, .4]}) }
    st('chalk', 'drag', off(p, -8), {w: 3, c: PAINT.ink, a: .8, pr: [.7, 1, .7, .9, .5]});
    for (let i = 0; i < 4; i++) { const q = off(p, -8)[2 + i * 2]; st('pigment', 'dab', [[q[0] + 2, q[1]], [q[0] - 2, q[1] - R(4, 7)]], {w: 3, c: PAINT.redDeep, pr: [1, .2]}) }
  }, 'soft');
  for (let v = 0; v < 2; v++) cell(`drg_head_${v}`, [-40, -56, 96, 30], 'x', (st, {R}) => {
    for (const [x0, y0, x1, y1, w, c] of [[14, -14, -34, -26, 7, 'redDeep'], [8, -4, -36, -10, 7.5, 'red'], [4, 6, -30, 8, 6.5, 'redDeep'], [18, -8, -22, -20, 6, 'red']]) {   // the mane streams back
      const q = spline([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - R(2, 6)], [x1, y1 + R(-3, 3)]], 6); st('pigment', 'big', q, {w, c: PAINT[c], pr: [1, .8, .5, .25, .06]}); st('chalk', 'drag', part(q, .6, 1), {w: 3, c: PAINT.redDeep, a: .8, pr: [.7, .3]}) }
    st('pigment', 'big', [[-2, -1], [20, -6], [42, -9], [56, -10], [64, -15]], {w: 20, c: PAINT.red, pr: [1, 1, .85, .58, .32, .14]});        // the upper jaw: a wedge, the nose turned up
    st('thick', 'dab', [[58, -13], [63, -16]], {w: 7, c: PAINT.redDeep, pr: [1, .6]});
    st('thick', 'dab', [[14, -6], [36, -9]], {w: 6, c: PAINT.redHot, pr: [.4, 1, .3]});
    st('pigment', 'big', [[8, 7], [28, 10], [46, 15], [56, 22]], {w: 9, c: PAINT.redDeep, pr: [1, .8, .5, .18]});                             // the lower jaw, open: paper between
    st('pigment', 'line', [[-2, -10], [20, -16], [40, -19], [56, -16], [64, -19]], {w: 1.8, c: PAINT.ink, pr: [.5, 1, .9, .6, .3]});
    st('thick', 'dab', [[30, -16], [38, -17]], {w: 7, c: PAINT.redDeep, pr: [1, .8]});
    st('heavy', 'dab', [[30, -19], [44, -19]], {w: 5, c: PAINT.ink, pr: [.6, 1, .4]});                                                              // the brow, ink
    st('thick', 'dab', [[37, -11], [43, -11]], {w: 9, c: PAINT.white, pr: [1, 1]}); st('heavy', 'dab', [[41, -11], [42, -11]], {w: 3.6, c: PAINT.ink, pr: [1, 1]});   // the eye, left as paper
    for (const x of [40, 47, 54]) st('scumble', 'dab', [[x, 2], [x + 1, 6]], {w: 2.4, c: PAINT.white, a: .95, pr: [1, .3]});
    for (const [y0, len, w] of [[-20, 1, 7], [-16, .8, 5.5]]) { const horn = spline([[30, y0], [10, y0 - 18 * len], [-10, y0 - 30 * len], [-30, y0 - 32 * len]], 8);       // two horns swept back, ink on their edge, a tine on each
      st('pigment', 'big', horn, {w, c: PAINT[len < 1 ? 'redDeep' : 'red'], pr: [1, .9, .65, .35, .08]}); st('pigment', 'line', off(horn, -w * .45), {w: 1.5, c: PAINT.ink, pr: [1, .9, .6, .2]});
      const q = horn[3]; st('pigment', 'dab', [q, [q[0] - 2, q[1] - 10 * len]], {w: 3.5, c: PAINT.redDeep, pr: [1, .2]}) }
    st('metal', 'line', spline([[62, -8], [76, -14], [86, -28], [80, -42], [72, -46]], 8), {w: 1.7, c: PAINT.goldHi, pr: [.4, 1, .9, .6, .3, .1]});
    st('metal', 'line', spline([[56, 12], [70, 20], [84, 18], [90, 10]], 8), {w: 1.5, c: PAINT.goldHi, pr: [.4, 1, .7, .3, .1]});
  });
  cell('drg_tail', [-6, -24, 92, 24], 'x', (st, {R}) => {
    const p = pts(t => [62 * t, 4 * Math.sin(t * 5)], 10);
    st('pigment', 'big', p, {w: 15, c: PAINT.red, pr: [.95, 1, .85, .66, .45, .26, .1]});
    st('chalk', 'drag', off(p, -7), {w: 3, c: PAINT.ink, a: .85, pr: [1, .9, .6, .3, .1]});
    for (const [dx, dy, w] of [[86, -14, 4.5], [88, 2, 5], [80, 14, 4]]) st('pigment', 'dab', spline([[50, 2], [66, dy * .4], [dx, dy]], 5), {w, c: PAINT.redDeep, pr: [1, .6, .25, .05]});
  });
  for (let v = 0; v < 4; v++) cell(`ash_${v}`, [-8, -8, 8, 8], '', (st, {R}) => { for (let i = 0; i < 2; i++) st('chalk', 'dab', strokeAt(R(-2, 2), R(-2, 2), R(0, 3), R(3, 7)), {w: R(3, 6), c: PAINT.inkPale, a: .9, pr: [1, .6]}) }, 'soft');
  for (let v = 0; v < 3; v++) cell(`ember_${v}`, [-4, -8, 16, 8], 'x', (st, {R}) => st('thick', 'dab', [[0, 0], [6, R(-3, 3)], [12, R(-4, 4)]], {w: R(3, 4.5), c: PAINT[v ? 'red' : 'redHot'], pr: [1, .6, .1]}));
  // the ground a fire leaves: a broken ring of pale char and three flecks of deep red, 100 in radius (flat)
  for (let v = 0; v < 2; v++) cell(`scorch_${v}`, [-112, -112, 112, 112], '', (st, {R}) => {
    let a = R(0, 6); for (let i = 0; i < 5; i++) { const span = R(.7, 1.1), p = pts(t => { const b = a + span * t, r = 96 + R(-3, 3); return [Math.cos(b) * r, Math.sin(b) * r] }, 8); st('chalk', 'big', p, {w: R(8, 14), c: PAINT.inkPale, a: .55, pr: [.3, 1, .8, .4, .1]}); a += span + R(.15, .4) }
    for (let i = 0; i < 7; i++) { const b = R(0, 6.3), r = R(30, 80); st('chalk', 'drag', strokeAt(Math.cos(b) * r, Math.sin(b) * r, b, R(10, 22)), {w: R(5, 9), c: PAINT.inkClear, a: .7, pr: [.5, 1, .3]}) }
    for (let i = 0; i < 4; i++) { const b = R(0, 6.3), r = R(50, 95); st('chalk', 'dab', strokeAt(Math.cos(b) * r, Math.sin(b) * r, b + 1.5, R(4, 8)), {w: 3.5, c: PAINT.redDeep, a: .75, pr: [1, .4]}) }
  }, 'soft');
  // the cover itself is a ghost: a gold rim (flat, 100 in radius) and a bell drawn in two pale side strokes; the force is the dragons
  cell('cover_rim', [-108, -108, 108, 108], '', (st, {R}) => {
    st('metal', 'rule', pts(t => [Math.cos(t * 6.1 + .2) * 100, Math.sin(t * 6.1 + .2) * 100], 40), {w: 2.4, c: PAINT.goldHi, pr: [.2, 1, 1, .9, 1, .9, 1, .5]});
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; st('metal', 'rule', [[Math.cos(a) * 100, Math.sin(a) * 100], [Math.cos(a) * 107, Math.sin(a) * 107]], {w: 2, c: PAINT.gold, pr: [1, .3]}) }
    st('pigment', 'line', pts(t => [Math.cos(t * 5 + 1) * 93, Math.sin(t * 5 + 1) * 93], 30), {w: 1.1, c: PAINT.inkPale, a: .7, pr: [.2, 1, .7, 1, .3]});
  });
  cell('cover_ghost', [-110, -140, 110, 8], '', (st) => {
    st('chalk', 'big', spline([[-8, -126], [-46, -108], [-78, -60], [-96, -6]], 10), {w: 10, c: PAINT.inkClear, a: .6, pr: [.3, 1, .8, .5, .2]});
    st('chalk', 'big', spline([[8, -126], [46, -108], [78, -60], [96, -6]], 10), {w: 10, c: PAINT.inkClear, a: .6, pr: [.3, 1, .8, .5, .2]});
    st('wash', 'big', spline([[-96, -4], [0, 4], [96, -4]], 10), {w: 9, c: PAINT.inkClear, a: .45, pr: [.2, 1, 1, .2]});
    st('pigment', 'dab', [[0, -126], [0, -138]], {w: 9, c: PAINT.inkMid, pr: [1, .5]});
    st('metal', 'line', [[-6, -132], [6, -132]], {w: 1.6, c: PAINT.goldHi, pr: [1, 1]});
  }, 'soft');

  /* ============================================================ WATER 水: Ma Yuan's bundles of line, claw crests, wet pooled ends */
  // 混天绫: the sash itself, a ribbon of red silk drawn thick-thin (兰叶描): it pinches where it twists and shows its paler back
  for (let v = 0; v < 3; v++) cell(`silk_${v}`, [-8, -24, 118, 24], 'x', (st, {R}) => {
    const ph = R(0, 6), p = pts(t => [110 * t, 6 * Math.sin(t * 6.28 + ph)], 16), pinch = R(.42, .6);
    const pr = Array.from({length: 13}, (_, i) => .16 + .84 * Math.pow(Math.abs(Math.sin((i / 12 - pinch) * Math.PI * 1.15)), .7));
    st('pigment', 'big', p, {w: 12, c: PAINT.red, pr});
    st('pigment', 'line', off(p, -5.5), {w: 1.4, c: PAINT.ink, a: .9, pr: pr.map(x => .3 + .7 * x)});
    st('scumble', 'line', part(off(p, -2), .05, pinch - .1), {w: 2.2, c: PAINT.white, a: .85, pr: [.3, 1, .6]});
    const q = p[Math.round(pinch * 16)]; st('pigment', 'dab', [[q[0] - 5, q[1] + 1], [q[0] + 5, q[1] - 1]], {w: 5, c: PAINT.redDeep, pr: [.6, 1, .6]});
  });
  cell('silk_tip', [-6, -40, 80, 30], 'x', (st) => {
    const p = spline([[0, 0], [28, -4], [52, -14], [62, -28], [50, -34], [44, -24]], 18);
    st('pigment', 'big', p, {w: 11, c: PAINT.red, pr: [1, .9, .75, .5, .3, .14, .04]});
    st('pigment', 'line', off(p, -5), {w: 1.3, c: PAINT.ink, pr: [.9, 1, .7, .4, .1]});
  });
  // a bundle of wave lines: four hairs that part in the middle and close at the ends, over a pale wash; the leading hair is ink
  for (let v = 0; v < 3; v++) cell(`wave_${v}`, [-6, -30, 140, 30], 'x', (st, {R}) => {
    const ph = R(0, 6), L = 130;
    st('wash', 'big', pts(t => [L * t, 4 * Math.sin(t * 7.5 + ph)], 10), {w: 26, c: PAINT.bluePale, a: .32, pr: [.1, .7, 1, .8, .3]});
    for (let i = 0; i < 4; i++) { const k = i - 1.5, p = pts(t => [L * t, k * 5.5 * (.5 + .7 * Math.sin(Math.PI * t)) + 4 * Math.sin(t * 7.5 + ph + i * .4)], 16);
      st(i === 0 ? 'pigment' : 'wet', 'line', p, {w: [2, 3.6, 3, 2.4][i], c: i === 0 ? PAINT.ink : PAINT[i === 2 ? 'blueHi' : 'blue'], a: i === 0 ? .85 : 1, pr: [.25, .9, 1, .7, .9, 1, .6, .2]}) }
    st('wet', 'dab', [[-2, 0], [6, -1]], {w: 10, c: PAINT.blue, pr: [.6, 1]});                                                       // the pool where the brush came down
  });
  for (let v = 0; v < 3; v++) cell(`wave_break_${v}`, [-6, -30, 140, 30], 'x', (st, {R}) => {      // the water behind the crest, breaking up: short hairs, foam, spray
    for (let i = 0; i < 5; i++) { const x0 = R(0, 90), y0 = R(-14, 14), L = R(18, 40); st(i ? 'wet' : 'pigment', 'line', pts(t => [x0 + L * t, y0 + 3 * Math.sin(t * 4 + i)], 6), {w: R(1.6, 3.2), c: i ? PAINT[i % 2 ? 'blue' : 'blueHi'] : PAINT.ink, a: i ? 1 : .7, pr: [.2, 1, .7, .1]}) }
    st('wash', 'big', pts(t => [130 * t, 3 * Math.sin(t * 6 + v)], 8), {w: 20, c: PAINT.bluePale, a: .22, pr: [.1, .8, .5, .1]});
    for (let i = 0; i < 4; i++) st('scumble', 'drag', strokeAt(R(10, 120), R(-10, 10), R(-.3, .3), R(8, 18)), {w: R(3, 5), c: PAINT.white, a: .9, pr: [.5, 1, .3]});
    for (let i = 0; i < 5; i++) st('wet', 'dab', strokeAt(R(0, 130), R(-18, 18), 0, R(1, 3)), {w: R(2, 3.6), c: PAINT.blue, pr: [1, .6]});
  });
  // a crest breaking: the wave climbs, curls over, and its lip splits into claws of foam (paper white, ink-edged)
  function crest(st, R, k) {
    const body = spline([[-44 * k, 0], [-24 * k, -26 * k], [-4 * k, -52 * k], [16 * k, -62 * k], [30 * k, -54 * k], [28 * k, -40 * k]], 16);
    st('wash', 'big', [[-48 * k, -2], [0, -8 * k], [40 * k, -2]], {w: 18 * k, c: PAINT.bluePale, a: .35, pr: [.2, 1, .3]});
    st('wet', 'big', body, {w: 15 * k, c: PAINT.blue, pr: [.35, .8, 1, 1, .8, .5, .25]});
    st('wet', 'line', part(off(body, 6 * k), 0, .8), {w: 3.2 * k, c: PAINT.blueHi, pr: [.3, 1, .9, .5]});
    st('wet', 'line', part(off(body, 11 * k), 0, .6), {w: 2.4 * k, c: PAINT.blue, pr: [.3, 1, .6, .2]});
    st('pigment', 'line', part(off(body, -7 * k), .1, 1), {w: 1.6 * k, c: PAINT.ink, a: .85, pr: [.3, 1, .9, .6, .2]});
    for (let i = 0; i < 4; i++) { const q = body[10 + i * 2] || body[body.length - 1], d = R(.8, 1.3);
      const claw = spline([[q[0], q[1]], [q[0] + (6 + i * 3) * k * d, q[1] + (2 - i) * 3 * k], [q[0] + (8 + i * 4) * k * d, q[1] + (8 + i * 2) * k]], 5);
      st('thick', 'dab', claw, {w: 5 * k, c: PAINT.white, pr: [1, .7, .3, .06]});
      st('pigment', 'line', off(claw, 2.6 * k), {w: 1.1 * k, c: PAINT.ink, a: .8, pr: [.8, 1, .4]}) }
    for (let i = 0; i < 5; i++) st('thick', 'dab', strokeAt(R(-6, 40) * k, R(-82, -62) * k, R(0, 3), R(2, 4) * k), {w: R(2.5, 4) * k, c: PAINT[i % 2 ? 'white' : 'bluePale'], pr: [1, .5]});
  }
  for (let v = 0; v < 3; v++) cell(`crest_${v}`, [-56, -92, 56, 8], 'up', (st, {R}) => crest(st, R, R(.9, 1.05)));
  cell('crest_big', [-100, -160, 100, 12], 'up', (st, {R}) => crest(st, R, 1.75));
  cell('crest_lead', [-80, -130, 80, 10], 'up', (st, {R}) => { crest(st, R, 1.4); for (let i = 0; i < 6; i++) st('thick', 'dab', strokeAt(R(-10, 60), R(-120, -88), R(0, 3), R(3, 6)), {w: R(3, 5), c: PAINT[i % 3 ? 'white' : 'bluePale'], pr: [1, .5]}) });
  for (let v = 0; v < 3; v++) cell(`spray_${v}`, [-14, -14, 14, 14], '', (st, {R}) => { for (let i = 0; i < 3; i++) st(i ? 'wet' : 'thick', 'dab', strokeAt(R(-6, 6), R(-6, 6), R(0, 3), R(2, 5)), {w: R(2.5, 4.5), c: PAINT[i ? 'blue' : 'white'], pr: [1, .5]}) });
  for (let v = 0; v < 2; v++) cell(`ripple_${v}`, [-108, -108, 108, 108], '', (st, {R}) => {
    for (const r of [100, 78, 56]) { const a = R(0, 6), span = R(3.2, 4.6); st('wet', 'line', pts(t => [Math.cos(a + span * t) * r, Math.sin(a + span * t) * r], 24), {w: r / 30, c: PAINT.bluePale, a: .75, pr: [.1, .8, 1, .7, .9, .4, .05]}) }
  }, 'soft');

  /* ============================================================ EARTH 土: 斧劈 axe-cuts, 泼墨 thrown ink, ochre on dry flanks; square and heavy */
  // 番天印: the seal block as it falls (upright, foot at the pivot): a dark top, ochre sides cut with the side of the brush, a
  // crouching beast for a knob with one gold hair on its back
  cell('seal_block', [-52, -104, 52, 6], '', (st, {R}) => {
    for (let i = 0; i < 5; i++) { const x = -34 + i * 17 + R(-2, 2); st('heavy', 'blunt', [[x, -2], [x + R(-2, 2), -42]], {w: 18, c: PAINT[i % 2 ? 'ink' : 'inkMid'], pr: [1, .95, .9, 1]}) }       // the face in shadow: axe-cut, dark
    st('scumble', 'blunt', [[30, -4], [31, -40]], {w: 9, c: PAINT.ochre, a: .9, pr: [.5, 1, .7]});
    for (let i = 0; i < 3; i++) st('scumble', 'blunt', [[-38, -48 - i * 15], [38, -50 - i * 15 + R(-2, 2)]], {w: 16, c: PAINT[i === 1 ? 'ochreHi' : 'ochre'], a: .95, pr: [.7, 1, 1, .8]});   // the top, in the light: dry ochre on paper
    st('pigment', 'line', [[-40, -43], [40, -43]], {w: 2.4, c: PAINT.ink, pr: [1, 1, 1]});
    st('chalk', 'drag', [[-40, -90], [40, -90]], {w: 3, c: PAINT.inkMid, a: .7, pr: [.4, 1, .6]});
    st('scumble', 'line', [[-36, -46], [36, -46]], {w: 2, c: PAINT.white, a: .95, pr: [.4, 1, 1, .5]});
    st('heavy', 'dab', [[-12, -66], [0, -74], [12, -68]], {w: 16, c: PAINT.ink, pr: [.8, 1, .8]});                                          // the knob: a crouching beast
    st('heavy', 'dab', [[-14, -74], [-16, -84]], {w: 5, c: PAINT.ink, pr: [1, .3]}); st('heavy', 'dab', [[-5, -78], [-6, -88]], {w: 5, c: PAINT.ink, pr: [1, .3]});
    st('metal', 'line', [[-12, -78], [2, -82], [14, -74]], {w: 1.6, c: PAINT.goldHi, pr: [.5, 1, .4]});
  });
  cell('seal_smear', [-40, -230, 40, 4], 'up', (st) => {
    st('chalk', 'blunt', [[0, -40], [0, -120], [0, -220]], {w: 62, c: PAINT.inkPale, a: .55, pr: [1, .6, .3, .08]});
    for (const x of [-26, 24]) st('chalk', 'drag', [[x, -30], [x * .9, -150]], {w: 6, c: PAINT.inkMid, a: .6, pr: [1, .5, .1]});
  }, 'soft');
  // the shadow it throws before it lands: a square of let-down ink with axe-cut edges (flat, 100 across)
  cell('seal_shadow', [-62, -62, 62, 62], '', (st, {R}) => {
    for (let i = 0; i < 4; i++) st('wash', 'blunt', [[-50 + R(-3, 3), -38 + i * 25], [50 + R(-3, 3), -38 + i * 25 + R(-2, 2)]], {w: 28, c: PAINT.inkMid, a: .5, pr: [.7, 1, 1, .8]});
    st('chalk', 'blunt', [[-50, -50], [50, -50]], {w: 6, c: PAINT.inkMid, a: .5, pr: [1, .8]}); st('chalk', 'blunt', [[-50, 50], [50, 50]], {w: 6, c: PAINT.inkMid, a: .5, pr: [.8, 1]});
  }, 'soft');
  cell('seal_shade', [-62, -62, 62, 62], '', (st, {R}) => {          // the shadow as it nears: a soft dark square, axe-cut at its edges
    for (let i = 0; i < 5; i++) st('wash', 'blunt', [[-48 + R(-3, 3), -40 + i * 20], [48 + R(-3, 3), -40 + i * 20 + R(-2, 2)]], {w: 26, c: PAINT.ink, a: .62, pr: [.8, 1, 1, .85]});
    for (const [a, b] of [[[-50, -50], [50, -50]], [[50, -50], [50, 50]], [[50, 50], [-50, 50]], [[-50, 50], [-50, -50]]]) st('chalk', 'blunt', [a, b], {w: 7, c: PAINT.ink, a: .6, pr: [1, .8, 1]});
  }, 'soft');
  cell('seal_dark', [-52, -104, 52, 6], '', (st, {R}) => {           // the one frame of impact: the block as a slab of 焦墨
    for (let i = 0; i < 6; i++) st('heavy', 'blunt', [[-38, -4 - i * 15], [38, -4 - i * 15 + R(-1, 1)]], {w: 17, c: PAINT.ink, pr: [1, 1, 1, 1]});
    st('heavy', 'dab', [[-12, -66], [0, -76], [12, -68]], {w: 18, c: PAINT.ink, pr: [.8, 1, .8]});
    st('scumble', 'line', [[-38, -45], [38, -45]], {w: 2, c: PAINT.white, a: .9, pr: [.4, 1, 1, .5]});
  });
  for (let v = 0; v < 5; v++) cell(`throw_${v}`, [-20, -34, 176, 34], 'x', (st, {R}) => {      // heavy thrown ink: a blot, a loaded body breaking into flying white, drops beyond
    const L = R(90, 150), bend = R(-18, 18);
    for (let i = 0; i < 5; i++) st('heavy', 'dab', strokeAt(R(-6, 6), R(-6, 6), R(0, 3), R(4, 10)), {w: R(14, 22), c: PAINT.ink, pr: [.8, 1, .7]});
    const p = spline([[4, R(-3, 3)], [L * .3, bend * .15 + R(-4, 4)], [L * .65, bend * .6], [L, bend]], 12);
    st('pigment', 'big', part(p, 0, .6), {w: R(15, 19), c: PAINT.ink, pr: [1, .9, .7, .5, .3]});
    st('chalk', 'big', part(p, .3, 1), {w: R(14, 17), c: PAINT.ink, a: .95, pr: [1, .9, .7, .45, .2, .05]});          // flying white: the hair runs dry
    st('chalk', 'drag', off(part(p, .4, 1), R(-6, 6)), {w: 6, c: PAINT.inkMid, a: .8, pr: [.8, 1, .5, .1]});
    let d = L; for (let i = 0; i < 4; i++) { d += R(6, 16); const s2 = 7 - i * 1.4; st('heavy', 'dab', strokeAt(d, bend * (d / L) + R(-6, 6), R(0, 3), s2 * .5), {w: s2 + R(0, 2), c: PAINT.ink, pr: [1, .8]}) }
  });
  // the print: a frame struck in four strokes whose corners overrun, and the seal's script inside (flat, 100 across)
  cell('seal_print', [-60, -60, 60, 60], '', (st, {R}) => {          // 白文: the ground of the seal in ink, its script left as paper, the edge chipped as an old seal's is
    for (let i = 0; i < 6; i++) { const y = -42 + i * 17; st('heavy', 'blunt', [[-50 + R(-3, 2), y], [50 + R(-2, 3), y + R(-1, 1)]], {w: 19, c: PAINT.ink, pr: [.9, 1, 1, .95]}) }
    for (const cx of [-28, 0, 28]) { const rows = 2 + Math.floor(R(0, 3));
      for (let i = 0; i < rows; i++) { const y = -32 + i * 64 / rows + R(-2, 2); st('thick', 'blunt', [[cx - 9, y], [cx + 9, y]], {w: 5, c: PAINT.white, pr: [1, .9, 1]}) }
      st('thick', 'blunt', [[cx + R(-6, 6), -36], [cx + R(-6, 6), 36]], {w: 5, c: PAINT.white, pr: [1, .9, 1]});
      if (R(0, 1) > .4) st('thick', 'blunt', [[cx - 9, R(-12, 8)], [cx - 9, R(14, 30)]], {w: 4.5, c: PAINT.white, pr: [1, 1]}) }
    for (let i = 0; i < 7; i++) { const side = i % 4, u = R(-40, 40), x = side === 0 ? u : side === 1 ? 52 : side === 2 ? u : -52, y = side === 0 ? -52 : side === 1 ? u : side === 2 ? 52 : u;
      st('thick', 'dab', strokeAt(x, y, R(0, 3), R(3, 9)), {w: R(5, 10), c: PAINT.white, pr: [1, .8]}) }
  });
  // 泼墨: ink thrown by the blow; a pressed head, a flung tail running dry, a drop or two let go beyond (along +x)
  for (let v = 0; v < 5; v++) cell(`splash_${v}`, [-16, -22, 116, 22], 'x', (st, {R}) => {
    const L = R(40, 92), bend = R(-12, 12);
    for (let i = 0; i < 4; i++) st('pigment', 'dab', strokeAt(R(-4, 4), R(-4, 4), R(0, 3), R(3, 8)), {w: R(8, 13), c: PAINT.ink, pr: [.8, 1, .7]});     // a blot, not a nail head
    const p = spline([[4, R(-2, 2)], [L * .35, bend * .2 + R(-3, 3)], [L * .7, bend * .7], [L, bend]], 10);
    st('pigment', 'big', p, {w: R(7, 10), c: PAINT.ink, pr: [1, .8, .55, .4, .22, .1, .03]});
    st('chalk', 'drag', part(p, .35, 1), {w: 7, c: PAINT.inkMid, a: .75, pr: [.8, 1, .5, .1]});
    let d = L; for (let i = 0; i < 3; i++) { d += R(6, 14); const s = 4.5 - i * 1.2; st('pigment', 'dab', strokeAt(d, bend * (d / L) + R(-4, 4), R(0, 3), s * .6), {w: s + R(0, 1.5), c: PAINT.ink, pr: [1, .8]}) }
  });
  for (let v = 0; v < 3; v++) cell(`slab_${v}`, [-20, -26, 20, 4], '', (st, {R}) => {
    st('heavy', 'blunt', [[R(-8, -4), 0], [R(-2, 2), R(-18, -24)]], {w: R(12, 16), c: PAINT.ink, pr: [1, 1, .9]});
    st('scumble', 'drag', [[R(2, 6), -1], [R(4, 8), -14]], {w: 6, c: PAINT.ochre, a: .95, pr: [1, .7, .2]});
  });
  for (let v = 0; v < 3; v++) cell(`crack_${v}`, [-8, -40, 124, 40], 'x', (st, {R}) => {
    const p = [[0, 0]]; for (let i = 1; i <= 6; i++) p.push([i * 19, p[i - 1][1] + R(-9, 9)]);
    st('chalk', 'big', p, {w: 4.5, c: PAINT.ink, a: .85, pr: [1, .85, .7, .5, .3, .1]});
    const b = p[2 + v % 2]; st('chalk', 'drag', [b, [b[0] + 18, b[1] + R(-22, 22)], [b[0] + 32, b[1] + R(-30, 30)]], {w: 3, c: PAINT.ink, a: .75, pr: [1, .5, .1]});
  }, 'soft');
  for (let v = 0; v < 3; v++) cell(`dust_${v}`, [-62, -46, 62, 6], '', (st, {R}) => {      // a puff of dust: small curls of dry brush in a rough dome, no edge to it
    for (let i = 0; i < 7; i++) { const a = R(0, 6.283), d = Math.sqrt(R(0, 1)), cx = Math.cos(a) * d * 40, cy = -18 + Math.sin(a) * d * 16 - (1 - d) * 8, r = R(6, 12), a0 = R(0, 6.283);
      st('chalk', 'dab', pts(t => [cx + Math.cos(a0 + t * 4.4) * r * (1 - .3 * t), cy + Math.sin(a0 + t * 4.4) * r * .7 * (1 - .3 * t)], 9), {w: R(5, 8), c: PAINT[i % 3 === 1 ? 'ochre' : 'inkClear'], a: .55, pr: [.2, .8, 1, .6, .1]}); }
  }, 'soft');
  // the ground the blow shakes: a ring of short axe-cut dashes, ink and ochre (flat, 100 in radius)
  for (let v = 0; v < 2; v++) cell(`quake_${v}`, [-112, -112, 112, 112], '', (st, {R}) => {
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + R(-.1, .1), r = R(92, 102); st('chalk', 'blunt', strokeAt(Math.cos(a) * r, Math.sin(a) * r, a + 1.571 + R(-.3, .3), R(16, 28)), {w: R(6, 10), c: PAINT[i % 2 ? 'ochre' : 'inkMid'], a: .85, pr: [1, .8, .3]}) }
  }, 'soft');
  // 番天覆地: the field the evolved seal leaves: earth split in a square web, dry ochre, embers of deep red in three cracks (flat, 200 across)
  for (let v = 0; v < 2; v++) cell(`field_${v}`, [-110, -110, 110, 110], '', (st, {R}) => {
    for (let i = 0; i < 7; i++) { const a = R(0, 6.3), r = R(0, 55), x = Math.cos(a) * r, y = Math.sin(a) * r; st('wash', 'big', strokeAt(x, y, R(0, 3), R(14, 30)), {w: R(40, 64), c: PAINT.ochre, a: .32, pr: [.5, 1, .6]}) }
    const spokes = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + R(-.2, .2), p = [[0, 0]]; for (let j = 1; j <= 5; j++) { const r = j * 19; p.push([Math.cos(a + R(-.25, .25)) * r, Math.sin(a + R(-.25, .25)) * r]) } spokes.push(p);
      st('chalk', 'big', p, {w: 4.2, c: PAINT.inkMid, a: .85, pr: [1, .9, .7, .5, .25]}) }
    for (let i = 0; i < 7; i++) { const a = spokes[i][3], b = spokes[(i + 1) % 7][3]; st('chalk', 'drag', [a, [(a[0] + b[0]) / 2 + R(-6, 6), (a[1] + b[1]) / 2 + R(-6, 6)], b], {w: 2.6, c: PAINT.inkMid, a: .7, pr: [.8, 1, .6]}) }
    for (const i of [0, 3, 5]) st('pigment', 'line', part(spokes[i], .2, .8), {w: 1.6, c: PAINT.redDeep, a: .9, pr: [.3, 1, .4]});
  });

  /* ============================================================ WOOD 木: wind and thunder; dry bark strokes, angular 折, pointed leaves */
  for (let v = 0; v < 2; v++) cell(`bark_${v}`, [-8, -24, 214, 24], 'x', (st, {R}) => {
    const p = pts(t => [200 * t, 6 * Math.sin(t * 3 + v)], 12);
    st('chalk', 'big', p, {w: 18, c: PAINT.ink, a: .9, pr: CALLI});
    st('scumble', 'drag', off(part(p, .05, .8), -3), {w: 9, c: PAINT.green, a: .95, pr: [.4, 1, .8, .5, .2]});
    st('pigment', 'dab', [[-4, 0], [8, -1]], {w: 14, c: PAINT.ink, pr: [1, .8]});
  });
  for (let v = 0; v < 2; v++) cell(`thunder_${v}`, [-8, -34, 214, 34], 'x', (st, {R}) => {
    const p = [[0, 0]]; for (let i = 1; i <= 5; i++) p.push([i * 40, (i % 2 ? -1 : 1) * R(12, 24)]);
    for (let i = 0; i < 5; i++) st('pigment', 'big', [p[i], [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2], p[i + 1]], {w: 8 - i, c: PAINT.ink, pr: [1, .55, .85]});
    st('pigment', 'line', off(p, -4), {w: 2.2, c: PAINT.greenHi, pr: [.6, 1, .8, .4]});
    st('scumble', 'line', off(part(p, 0, .6), 3), {w: 1.6, c: PAINT.white, a: .9, pr: [.5, 1, .2]});
  });
  for (let v = 0; v < 4; v++) cell(`leaf_${v}`, [-6, -10, 22, 10], 'x', (st, {R}) => st('pigment', 'dab', [[0, 0], [8, R(-2, 2)], [16, R(-3, 3)]], {w: R(7, 9), c: PAINT[v % 2 ? 'greenHi' : 'green'], pr: [.6, 1, .5, .05]}));

  /* ============================================================ METAL 金: straight ruled hair (铁线), rings, rays of a treasure's light */
  for (let v = 0; v < 2; v++) cell(`blade_${v}`, [-10, -12, 230, 12], 'x', (st) => {
    st('metal', 'rule', [[0, 0], [220, 0]], {w: 4.6, c: PAINT.goldHi, pr: [.2, .9, 1, 1, 1, .95, .8, .5, .15]});
    st('pigment', 'rule', [[10, -3.4], [170 - v * 30, -3.4]], {w: 1.3, c: PAINT.white, pr: [.4, 1, 1, .3]});
    st('pigment', 'rule', [[20, 3.2], [120, 3.2]], {w: 1, c: PAINT.ink, pr: [.8, 1, .3]});
  });
  for (let v = 0; v < 2; v++) cell(`ray_${v}`, [-4, -6, 210, 6], 'x', (st) => {
    st('metal', 'rule', [[0, 0], [200 - v * 50, 0]], {w: 1.8, c: PAINT.goldHi, pr: [.3, 1, 1, .7, .2]});
    st('pigment', 'rule', [[8, 2.4], [120 - v * 30, 2.4]], {w: .9, c: PAINT.white, pr: [.5, 1, .2]});
  });
  // the ring (乾坤圈) at four turns of its spin: a bronze band, ink hair outside, a hair of paper white on its lit arc
  [1, .66, .36, .12].forEach((sq, v) => cell(`hoop_${v}`, [-30, -30, 30, 30], '', (st) => {
    const ell = pts(t => [Math.cos(t * 6.283) * 22, Math.sin(t * 6.283) * 22 * sq], 28);
    st('metal', 'big', ell, {w: 6.5, c: PAINT.gold, pr: [1, 1, 1, 1]});
    st('pigment', 'line', off(ell, -4), {w: 1.1, c: PAINT.ink, a: .9, pr: [1, 1, 1]});
    st('scumble', 'line', part(off(ell, 1.2), .52, .78), {w: 1.6, c: PAINT.white, pr: [.3, 1, .3]});
  }));
  cell('gold_ring', [-106, -106, 106, 106], '', (st) => st('metal', 'rule', pts(t => [Math.cos(t * 6.2) * 100, Math.sin(t * 6.2) * 100], 40), {w: 2, c: PAINT.goldHi, pr: [.1, 1, 1, 1, .9, 1, .4]}));

  /* ============================================================ the other treasures */
  // 火尖枪: a thrust of fire, pressed at the hand, a leaf of flame for a head; fire ticks lean back along its upper edge (woodblock fire)
  for (let v = 0; v < 2; v++) cell(`thrust_${v}`, [-10, -40, 272, 22], 'x', (st, {R}) => {
    const p = pts(t => [260 * t, -3 * Math.sin(Math.PI * t) + R(-1, 1) * t], 14);
    st('pigment', 'line', off(p, 7), {w: 1.6, c: PAINT.ink, pr: [.9, 1, .8, .5, .2]});
    st('pigment', 'big', p, {w: 15, c: PAINT.red, pr: [1, .95, .85, .72, .6, .48, .36, .24, .12, .03]});
    st('thick', 'dab', part(off(p, -2), 0, .45), {w: 6, c: PAINT.redHot, pr: [.8, 1, .6, .2]});
    st('scumble', 'line', part(off(p, -1), .05, .4), {w: 2, c: PAINT.white, a: .9, pr: [.4, 1, .3]});
    st('pigment', 'dab', [[-5, 1], [0, 0], [5, 0]], {w: 12, c: PAINT.redDeep, pr: [.55, 1, .7]});                                   // pressed at the hand: round, not a cut block
    for (let i = 0; i < 7; i++) { const q = p[2 + i * 1.6 | 0], h = R(10, 20) * (1 - i * .08);                                   // ticks of fire leaning back
      st('pigment', 'dab', spline([[q[0], q[1] - 6], [q[0] - h * .5, q[1] - 6 - h * .6], [q[0] - h * .7, q[1] - 6 - h], [q[0] - h * .5, q[1] - 8 - h * 1.1]], 5), {w: R(4, 6), c: PAINT[i % 2 ? 'redDeep' : 'red'], pr: [1, .7, .35, .08]}) }
  });
  // 三昧神枪's fork: a tongue of flame leaves the head of the thrust as a hair, swells, and curls back on itself in a hook;
  // dry hair along its root (飞白), a deep line under its belly, two small ticks leaning back. Thin: never a second shaft.
  for (let v = 0; v < 2; v++) cell(`fork_${v}`, [-6, -74, 266, 14], 'x', (st, {R}) => {
    const hook = R(30, 40), p = spline([[0, 0], [60, R(-1.5, 1.5)], [130, -4], [192, -11], [230, -22], [249, -22 - hook * .55], [240, -22 - hook]], 18);
    st('pigment', 'big', p, {w: 11, c: PAINT.red, pr: [.1, .4, .78, 1, .96, .82, .64, .46, .3, .16, .04]});
    st('pigment', 'line', off(part(p, .12, .72), 3.2), {w: 2.2, c: PAINT.redDeep, pr: [.2, 1, .8, .2]});
    st('chalk', 'drag', part(off(p, -1), .08, .5), {w: 5, c: PAINT.redHot, a: .75, pr: [.3, 1, .6, .1]});
    st('scumble', 'line', part(off(p, -1.5), .3, .55), {w: 1.6, c: PAINT.white, a: .8, pr: [.3, 1, .2]});
    for (const f of [.42, .62]) { const q = p[Math.round(f * (p.length - 1))], h = R(9, 14);
      st('pigment', 'dab', spline([[q[0], q[1] - 5], [q[0] - h * .5, q[1] - 5 - h * .6], [q[0] - h * .7, q[1] - 5 - h], [q[0] - h * .5, q[1] - 7 - h * 1.1]], 5), {w: R(3.5, 4.5), c: PAINT.redDeep, pr: [1, .7, .35, .08]}) }
  });
  cell('thrust_dry', [-10, -30, 272, 20], 'x', (st) => { const p = pts(t => [260 * t, -3 * Math.sin(Math.PI * t)], 12); st('chalk', 'big', p, {w: 13, c: PAINT.redDeep, a: .85, pr: [1, .8, .6, .45, .3, .15, .04]}); });
  cell('spearhead', [-6, -26, 70, 26], 'x', (st) => {          // the head: a leaf of flame, its point a hair
    st('pigment', 'big', spline([[0, 0], [20, -8], [44, -4], [64, 0]], 10), {w: 15, c: PAINT.red, pr: [.5, 1, .85, .5, .15, .02]});
    st('pigment', 'big', spline([[0, 0], [20, 8], [44, 4], [64, 0]], 10), {w: 9, c: PAINT.redDeep, pr: [.4, 1, .7, .3, .05]});
    st('scumble', 'line', [[6, -1], [40, -2]], {w: 2.4, c: PAINT.white, pr: [.4, 1, .2]});
    st('metal', 'line', [[30, -9], [62, -1]], {w: 1.3, c: PAINT.goldHi, pr: [.3, 1, .2]});
  });
  for (let v = 0; v < 4; v++) cell(`tick_${v}`, [-16, -30, 8, 4], 'up', (st, {R}) => {       // one hooked tick of fire, standing
    const h = R(16, 26); st('pigment', 'dab', spline([[0, 0], [-h * .2, -h * .5], [-h * .5, -h * .9], [-h * .3, -h * 1.05]], 6), {w: R(5, 7), c: PAINT[v % 2 ? 'redDeep' : 'red'], pr: [1, .8, .4, .08]});
    st('chalk', 'drag', [[-3, 1], [3, 1]], {w: 3, c: PAINT.ink, a: .5, pr: [1, 1]});
  });
  // 定海珠: a pearl is a disc of paper with an azurite rim and a gold glint; it trails three hairs of water
  cell('pearl', [-14, -14, 14, 14], '', (st) => {
    st('thick', 'dab', [[-1, 0], [1, 0]], {w: 19, c: PAINT.white, pr: [1, 1]});
    st('wet', 'line', pts(t => [Math.cos(t * 6.283) * 8.6, Math.sin(t * 6.283) * 8.6], 24), {w: 2.6, c: PAINT.blue, pr: [1, .8, 1, .7, 1]});
    st('pigment', 'line', pts(t => [Math.cos(t * 3 + .3) * 10.2, Math.sin(t * 3 + .3) * 10.2], 12), {w: 1.1, c: PAINT.ink, pr: [.3, 1, .3]});
    st('metal', 'dab', [[-3.5, -3.5], [-2, -4.5]], {w: 3, c: PAINT.goldHi, pr: [1, .4]});
  });
  for (let v = 0; v < 2; v++) cell(`pearl_tail_${v}`, [-4, -10, 74, 10], 'x', (st, {R}) => { for (let i = 0; i < 3; i++) st('wet', 'line', pts(t => [70 * t, (i - 1) * 3.4 * (1 - t * .6) + 2 * Math.sin(t * 7 + i + v)], 8), {w: 2.2 - i * .4, c: PAINT[i === 1 ? 'blueHi' : 'blue'], pr: [1, .8, .5, .25, .05]}) });
  cell('pearl_tail_gold', [-4, -10, 90, 10], 'x', (st) => { st('metal', 'rule', [[0, 0], [86, 0]], {w: 2, c: PAINT.goldHi, pr: [1, .8, .5, .2]}); st('wet', 'line', [[0, 3], [50, 4]], {w: 1.6, c: PAINT.blue, pr: [1, .3]}); });
  // 打神鞭: twenty-one joints of dark wood bound with talismans, gold at every joint (第38回: 每一節有四道符印)
  cell('whip_rod', [-10, -18, 168, 18], 'x', (st, {R}) => {          // 打神鞭: about one and a half riders long, tapering; each joint a bulge like a bamboo node, a thin gold band in it
    st('pigment', 'blunt', [[-6, 0], [9, 0]], {w: 17, c: PAINT.redDeep, pr: [1, 1]});                 // the grip, wrapped
    st('heavy', 'big', pts(t => [8 + 154 * t, 0], 12), {w: 15, c: PAINT.ink, pr: [1, .96, .9, .84, .78, .72, .66, .6, .54, .48, .4, .3]});   // one tapering body
    st('scumble', 'drag', [[12, -3.5], [150, -1.5]], {w: 2.2, c: PAINT.inkPale, a: .8, pr: [.5, 1, .7, .2]});
    for (let j = 1; j <= 7; j++) { const x = 8 + j * 21.5, w = 15 * (1 - .062 * j * 1.1);
      st('heavy', 'dab', [[x - 2.5, 0], [x + 2.5, 0]], {w: w + 6, c: PAINT.ink, pr: [.8, 1, .8]});
      st('metal', 'blunt', [[x, -(w + 4) / 2 + 1], [x, (w + 4) / 2 - 1]], {w: 1.8, c: PAINT.goldHi, pr: [.7, 1, .7]}); }
  });
  cell('whip_arc', [-10, -150, 230, 10], '', (st, {R}) => {          // the broad smear of the swing: dry ink fanning over a quarter turn
    for (let i = 0; i < 7; i++) { const r = 120 + i * 13; st('chalk', 'drag', pts(t => [Math.cos(-Math.PI / 2 + t * 1.4) * r * .95 + 6, Math.sin(-Math.PI / 2 + t * 1.4) * r * .62 + 4], 12), {w: R(8, 14), c: PAINT[i % 3 ? 'inkPale' : 'inkMid'], a: .55 + i * .04, pr: [.1, .5, .9, 1, .7, .2]}) }
  }, 'soft');
  cell('whip_hit', [-70, -40, 70, 40], '', (st, {R}) => {           // the flat hard print of the blow on the ground
    for (let i = 0; i < 5; i++) st('heavy', 'blunt', strokeAt(R(-24, 24), R(-12, 12), R(-.3, .3), R(30, 60)), {w: R(12, 20), c: PAINT.ink, pr: [1, 1, .9]});
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + R(-.2, .2); st('chalk', 'blunt', strokeAt(Math.cos(a) * 52, Math.sin(a) * 30, a, R(16, 28)), {w: 6, c: PAINT.inkMid, a: .85, pr: [1, .7, .2]}) }
  });
  for (let v = 0; v < 2; v++) cell(`bolt_${v}`, [-10, -44, 214, 44], 'x', (st, {R}) => {      // thunder as a bold folded stroke running into flying white
    const p = [[0, 0]]; for (let i = 1; i <= 5; i++) p.push([i * 40, (i % 2 ? -1 : 1) * R(18, 30)]);
    for (let i = 0; i < 5; i++) { const a = p[i], b = p[i + 1], w = 15 - i * 2; st(i < 3 ? 'pigment' : 'chalk', 'big', [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], {w, c: PAINT.ink, pr: [1, .7, .9]}); st('heavy', 'dab', [[a[0] - 2, a[1]], [a[0] + 2, a[1]]], {w: w + 3, c: PAINT.ink, pr: [1, 1]}) }
    st('chalk', 'drag', off(p, -6), {w: 4, c: PAINT.greenHi, a: .9, pr: [1, .8, .6, .3]});
    st('scumble', 'line', off(p.slice(0, 4), 3), {w: 2, c: PAINT.white, a: .9, pr: [1, .6, .2]});
  });
  for (let v = 0; v < 2; v++) cell(`chain_${v}`, [-6, -26, 206, 26], 'x', (st, {R}) => {      // the evolved chain: a bolt of light, paper white between two ink edges, a gold hair down it
    const p = [[0, 0]]; for (let i = 1; i <= 6; i++) p.push([i * 33, (i % 2 ? -1 : 1) * R(8, 16)]);
    st('pigment', 'big', p, {w: 13, c: PAINT.ink, pr: [.6, 1, 1, 1, .9, .7, .3]});
    st('thick', 'big', p, {w: 8, c: PAINT.white, pr: [.5, 1, 1, 1, .9, .6, .2]});
    st('metal', 'line', p, {w: 1.6, c: PAINT.goldHi, pr: [.5, 1, 1, .8, .4]});
  });
  // 杏黄旗: the ward a pale apricot ring; when it takes a blow golden flowers open (第50回: 旗現金花)
  cell('ward_ring', [-108, -108, 108, 108], '', (st, {R}) => { let a = R(0, 6); for (let i = 0; i < 4; i++) { const span = R(1.1, 1.5); st('scumble', 'big', pts(t => [Math.cos(a + span * t) * 100, Math.sin(a + span * t) * 100], 12), {w: R(5, 8), c: PAINT.ochreHi, a: .85, pr: [.2, 1, .8, .9, .3]}); a += span + R(.1, .3) } st('metal', 'line', pts(t => [Math.cos(t * 6.2) * 94, Math.sin(t * 6.2) * 94], 30), {w: 1, c: PAINT.gold, a: .7, pr: [.2, 1, .6, 1, .2]}); });
  for (let v = 0; v < 3; v++) cell(`flower_${v}`, [-20, -20, 20, 20], '', (st, {R}) => {
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + R(-.15, .15) + v; st('metal', 'dab', [[Math.cos(a) * 3, Math.sin(a) * 3], [Math.cos(a) * 10, Math.sin(a) * 10], [Math.cos(a) * 13, Math.sin(a) * 13]], {w: 10, c: PAINT[i % 2 ? 'goldHi' : 'gold'], pr: [.5, 1, .7]}); st('pigment', 'line', [[Math.cos(a) * 4, Math.sin(a) * 4], [Math.cos(a) * 11, Math.sin(a) * 11]], {w: .9, c: PAINT.ochre, pr: [1, .3]}) }
    st('pigment', 'dab', [[-1, 0], [1, 0]], {w: 5, c: PAINT.red, pr: [1, 1]});
  });
  for (let v = 0; v < 3; v++) cell(`petal_${v}`, [-6, -6, 10, 6], '', (st, {R}) => st('metal', 'dab', [[0, 0], [5, R(-2, 2)], [8, 0]], {w: 5, c: PAINT[v ? 'goldHi' : 'gold'], pr: [.5, 1, .2]}));
  cell('flag', [-6, -84, 46, 4], '', (st) => {          // the apricot banner on its staff
    st('pigment', 'rule', [[0, 2], [0, -82]], {w: 2.4, c: PAINT.inkMid, pr: [1, 1]});
    st('pigment', 'blunt', [[2, -76], [22, -73], [40, -70]], {w: 16, c: PAINT.ochreHi, pr: [1, .95, .8]});
    st('pigment', 'blunt', [[2, -62], [20, -60], [34, -54]], {w: 12, c: PAINT.ochre, pr: [1, .8, .4]});
    st('metal', 'line', [[2, -84], [40, -77]], {w: 1.4, c: PAINT.goldHi, pr: [1, .6]});
    st('metal', 'dab', [[0, -84], [0, -86]], {w: 4, c: PAINT.goldHi, pr: [1, 1]});
  });

  /* ============================================================ what is worth riding to: a colour and shape no foe carries
     Battle spirit is a wisp of paper white with an ink hair round it and a heart of cinnabar: the lightest thing on the field. */
  [[0, 22, 1], [1, 28, 1.25], [2, 34, 1.5]].forEach(([v, h, k]) => cell(`wisp_${v}`, [-12 * k, -h - 6, 12 * k, 4], '', (st) => {
    const drop = pts(t => { const a = t * 6.283; return [7 * k * Math.sin(a) * Math.sin(a / 2), -h / 2 - Math.cos(a) * h / 2 + (a > 3 && a < 6 ? 0 : 0)] }, 32);
    st('thick', 'dab', [[0, -h * .28], [0, -h * .36]], {w: 11 * k, c: PAINT.white, pr: [1, 1]}); st('thick', 'big', [[0, -h * .4], [0, -h * .78], [1 * k, -h * .96]], {w: 6 * k, c: PAINT.white, pr: [1, .6, .1]});
    st('pigment', 'line', drop, {w: 1.6, c: PAINT.inkPale, pr: [.2, .9, 1, 1, 1, .9, .2]});
    st('pigment', 'dab', [[0, -h * .3], [0, -h * .34]], {w: 2.6 + v, c: PAINT.red, pr: [1, 1]});
    if (v === 2) for (const d of [-1, 1]) st('pigment', 'line', spline([[d * 9 * k, -3], [d * 13 * k, -h * .5], [d * 9 * k, -h * .85]], 5), {w: 1.6, c: PAINT.blue, pr: [1, .6, .1]});
  }));
  cell('wisp_ground', [-14, -6, 14, 6], '', (st) => st('wash', 'big', [[-10, 0], [10, 0]], {w: 7, c: PAINT.inkClear, a: .55, pr: [.4, 1, .4]}), 'soft');
  cell('peach', [-16, -30, 18, 4], '', (st) => {
    st('thick', 'dab', [[-2, -10], [2, -12]], {w: 22, c: PAINT.white, pr: [1, 1]}); st('pigment', 'dab', [[3, -20], [6, -24]], {w: 10, c: PAINT.red, pr: [1, .5]});
    st('pigment', 'line', pts(t => [Math.cos(t * 6.283) * 11, -11 + Math.sin(t * 6.283) * 11], 20), {w: 1.2, c: PAINT.ink, pr: [1, .8, 1]});
    st('pigment', 'dab', [[-2, -22], [-12, -28]], {w: 7, c: PAINT.green, pr: [1, .3]}); st('pigment', 'dab', [[0, -22], [6, -29]], {w: 5, c: PAINT.greenHi, pr: [1, .3]});
  });
  cell('lodestone', [-16, -28, 16, 4], '', (st) => {
    st('heavy', 'dab', [[-6, -8], [0, -16], [6, -8]], {w: 16, c: PAINT.inkMid, pr: [1, 1, 1]});
    st('pigment', 'blunt', [[-11, -12], [11, -12]], {w: 4, c: PAINT.blue, pr: [1, 1]}); st('scumble', 'line', [[-6, -22], [6, -20]], {w: 1.6, c: PAINT.white, pr: [1, .3]});
  });
  cell('chest', [-24, -30, 24, 4], '', (st) => {
    for (let i = 0; i < 3; i++) st('heavy', 'blunt', [[-18, -4 - i * 7], [18, -4 - i * 7]], {w: 8, c: PAINT[i === 2 ? 'ochreHi' : 'ochre'], pr: [1, 1]});
    st('pigment', 'line', [[-19, -1], [-19, -24], [19, -24], [19, -1], [-19, -1]], {w: 1.6, c: PAINT.ink, pr: [1, 1, 1, 1, 1]});
    st('pigment', 'dab', [[-1, -14], [1, -14]], {w: 6, c: PAINT.red, pr: [1, 1]}); st('metal', 'line', [[-17, -18], [17, -18]], {w: 1.2, c: PAINT.goldHi, pr: [1, 1]});
  });
  // a blow landing among hundreds: one small tick in the element's pigment
  for (const [el, c1, c2] of [['fire', 'red', 'redDeep'], ['water', 'blue', 'blueHi'], ['wood', 'green', 'ink'], ['metal', 'gold', 'goldHi'], ['earth', 'ink', 'ochre']]) for (let v = 0; v < 2; v++)
    cell(`hit_${el}_${v}`, [-4, -12, 30, 12], 'x', (st, {R}) => { st(el === 'metal' ? 'metal' : 'pigment', 'dab', [[0, 0], [12, R(-3, 3)], [24, R(-5, 5)]], {w: R(4, 5.5), c: PAINT[c1], pr: [1, .7, .3, .05]}); st('pigment', 'dab', [[4, 4], [14, 7]], {w: 2.5, c: PAINT[c2], pr: [1, .2]}); });

  /* ============================================================ the squads' skills (SPEC section 6.1) */
  // 盾墙: a wall of shields, one cell a man's width: a tall axe-cut stroke of ink, the shield face in azurite with a gold boss
  for (let v = 0; v < 3; v++) cell(`wall_${v}`, [-26, -66, 26, 6], '', (st, {R}) => {
    st('heavy', 'blunt', [[R(-4, 4), 0], [R(-3, 3), -60]], {w: 30, c: PAINT.ink, pr: [1, 1, .95, .8]});
    st('pigment', 'blunt', [[-1, -8], [0, -50]], {w: 18, c: PAINT[v % 2 ? 'blue' : 'blueHi'], pr: [1, 1, 1]});
    st('metal', 'dab', [[0, -30], [0, -32]], {w: 6, c: PAINT.goldHi, pr: [1, 1]}); st('scumble', 'drag', [[-12, -4], [-12, -56]], {w: 4, c: PAINT.ochre, a: .9, pr: [.4, 1, .5]});
  });
  // 箭雨: the ground darkens first (a soft round shade); arrows fall as hair lines; they stand in the ground, malachite fletch
  cell('rain_shade', [-108, -108, 108, 108], '', (st, {R}) => { for (let i = 0; i < 5; i++) { const r = 20 + i * 18; st('wash', 'big', pts(t => [Math.cos(t * 6.283) * r, Math.sin(t * 6.283) * r], 24), {w: 26, c: PAINT.inkMid, a: .3, pr: [1, 1, 1]}) } }, 'soft');
  // the arrow rain: a thin short streak at one slant, a head at its lower end, a hair of fletching
  for (let v = 0; v < 3; v++) cell(`arrow_fall_${v}`, [-4, -4, 46, 4], 'x', (st, {R}) => { st('pigment', 'line', [[0, 0], [40, R(-.3, .3)]], {w: 1.1, c: PAINT.inkMid, pr: [.1, .5, 1, 1]}); st('pigment', 'dab', [[38, 0], [44, 0]], {w: 2.2, c: PAINT.ink, pr: [.6, 1]}); if (v) st('pigment', 'dab', [[1, -1.5], [5, 0]], {w: 1, c: PAINT.green, pr: [1, .3]}); });
  // the place the arrows will come down: a wash laid with a wet brush, edge broken, pooled darker on one side, paper through it
  for (let v = 0; v < 2; v++) cell(`rain_wash_${v}`, [-112, -112, 112, 112], '', (st, {R}) => {
    for (let i = 0; i < 4; i++) { const a0 = R(0, 6.28); st('wash', 'big', pts(t => { const a = a0 + t * 3.4, r = R(40, 92); return [Math.cos(a) * r * (i % 2 ? .9 : 1), Math.sin(a) * r]; }, 9), {w: R(40, 56), c: PAINT.inkMid, a: .32, pr: [.5, 1, .9, 1, .4]}); }
    const side = R(0, 6.28); st('wet', 'big', pts(t => [Math.cos(side + (t - .5) * 1.6) * 62, Math.sin(side + (t - .5) * 1.6) * 62], 8), {w: 34, c: PAINT.inkMid, a: .55, pr: [.3, 1, 1, .3]});
    for (let i = 0; i < 3; i++) { const a = R(0, 6.28), r = R(10, 60); st('scumble', 'drag', [[Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * r + R(-25, 25), Math.sin(a) * r + R(-10, 10)]], {w: 9, c: PAINT.paper || PAINT.white, a: .7, pr: [.4, 1, .4]}); }
  }, 'soft');
  for (let v = 0; v < 3; v++) cell(`arrow_stuck_${v}`, [-8, -26, 8, 2], '', (st, {R}) => { const lean = R(-6, 6); st('pigment', 'rule', [[0, 0], [lean, -22]], {w: 1.5, c: PAINT.ink, pr: [1, 1]}); st('pigment', 'dab', [[lean - 2, -20], [lean + 2, -24]], {w: 3, c: PAINT.green, pr: [1, .4]}); st('chalk', 'drag', [[-3, 1], [3, 1]], {w: 2.5, c: PAINT.inkPale, a: .6, pr: [1, 1]}); });
  // 掷石: a boulder, axe-cut, at three turns of its roll
  for (let v = 0; v < 3; v++) cell(`boulder_${v}`, [-30, -30, 30, 30], '', (st, {R}) => {
    const a0 = v * 2.1; for (let i = 0; i < 4; i++) { const a = a0 + i * 1.57; st('heavy', 'blunt', [[Math.cos(a) * 14, Math.sin(a) * 14], [Math.cos(a + 1.57) * 14, Math.sin(a + 1.57) * 14]], {w: 16, c: PAINT[i % 2 ? 'ink' : 'inkMid'], pr: [1, 1]}) }
    st('scumble', 'blunt', [[Math.cos(a0) * 8, Math.sin(a0) * 8 - 6], [Math.cos(a0 + 1) * 10, Math.sin(a0 + 1) * 10 - 6]], {w: 9, c: PAINT.ochreHi, a: .95, pr: [1, .5]});
    st('scumble', 'line', [[-10, -14], [6, -16]], {w: 1.8, c: PAINT.white, pr: [.4, 1, .3]});
  });
  // 冲阵: the chariot's wake: ruled bronze hairs and dust along the lane (along +x)
  for (let v = 0; v < 2; v++) cell(`wake_${v}`, [-6, -22, 206, 22], 'x', (st, {R}) => {
    st('chalk', 'blunt', [[0, 0], [200, R(-3, 3)]], {w: 30, c: PAINT.inkClear, a: .55, pr: [.1, .6, 1, .8]});
    for (const y of [-9, -3, 4, 10]) st(Math.abs(y) < 5 ? 'metal' : 'pigment', 'rule', [[R(20, 60), y], [200, y + R(-1, 1)]], {w: Math.abs(y) < 5 ? 1.8 : 1, c: Math.abs(y) < 5 ? PAINT.goldHi : PAINT.inkMid, pr: [.1, 1, .7]});
  }, 'soft');
  // 虎跃: the leap's path, a dry streak; the landing's mark, three claw rakes in deep red and ink
  cell('leap_trail', [-6, -14, 206, 14], 'x', (st) => { st('chalk', 'drag', [[0, 0], [100, -2], [200, 0]], {w: 12, c: PAINT.redDeep, a: .7, pr: [.1, .5, 1, .6]}); st('pigment', 'line', [[60, 3], [196, 2]], {w: 1.4, c: PAINT.ink, pr: [.1, 1, .5]}); }, 'soft');
  for (let v = 0; v < 2; v++) cell(`claw_${v}`, [-50, -40, 50, 40], '', (st, {R}) => { for (let i = 0; i < 3; i++) { const y = (i - 1) * 16 + R(-2, 2); st('pigment', 'big', spline([[-40, y - 8], [0, y + R(-2, 2)], [40, y + 8]], 6), {w: 9 - Math.abs(i - 1) * 2, c: PAINT[i === 1 ? 'redDeep' : 'ink'], pr: [.3, 1, .9, .5, .1]}) } });
  // 符法: a paper talisman, yellow with cinnabar script; frost; vines; a spinning blade
  cell('fu', [-8, -22, 8, 2], '', (st) => { st('pigment', 'blunt', [[0, 0], [0, -20]], {w: 10, c: PAINT.ochreHi, pr: [1, 1]}); for (let i = 0; i < 3; i++) st('pigment', 'line', [[-2.5, -4 - i * 5.5], [2.5, -5 - i * 5.5]], {w: 1.4, c: PAINT.red, pr: [1, .6]}); st('pigment', 'line', [[0, -2], [0, -18]], {w: .9, c: PAINT.red, pr: [1, 1]}); });
  for (let v = 0; v < 3; v++) cell(`frost_${v}`, [-40, -40, 40, 40], '', (st, {R}) => {      // ice: six short ruled spokes in azurite and white, crossed small
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + R(-.2, .2), L = R(20, 34); st('wet', 'rule', [[0, 0], [Math.cos(a) * L, Math.sin(a) * L]], {w: 3, c: PAINT.blueHi, pr: [1, .8, .2]}); st('thick', 'rule', [[Math.cos(a) * L * .4, Math.sin(a) * L * .4], [Math.cos(a) * L * .7, Math.sin(a) * L * .7]], {w: 1.6, c: PAINT.white, pr: [1, .4]});
      const m = [Math.cos(a) * L * .6, Math.sin(a) * L * .6]; for (const d of [-1, 1]) st('wet', 'rule', [m, [m[0] + Math.cos(a + d * .7) * 8, m[1] + Math.sin(a + d * .7) * 8]], {w: 1.5, c: PAINT.blue, pr: [1, .3]}) }
  });
  for (let v = 0; v < 2; v++) cell(`vine_${v}`, [-6, -16, 206, 16], 'x', (st, {R}) => {      // a binding vine: two green lines twisting round each other, leaves pressed along them
    for (let k = 0; k < 2; k++) st('pigment', 'big', pts(t => [200 * t, 7 * Math.sin(t * 14 + k * 3.14 + v)], 24), {w: 4, c: PAINT[k ? 'greenHi' : 'green'], pr: [.4, 1, 1, .9, .5]});
    for (let i = 0; i < 6; i++) { const x = 20 + i * 30, y = 7 * Math.sin(x / 200 * 14 + v); st('pigment', 'dab', [[x, y], [x + 6, y - 7 * (i % 2 ? 1 : -1)]], {w: 5, c: PAINT.green, pr: [1, .2]}) }
    st('pigment', 'line', pts(t => [200 * t, 7 * Math.sin(t * 14 + v) + 3], 20), {w: 1, c: PAINT.ink, a: .7, pr: [.3, 1, .3]});
  });
  for (let v = 0; v < 2; v++) cell(`spin_${v}`, [-12, -12, 12, 12], '', (st) => { for (let i = 0; i < 3; i++) { const a = i * 2.094 + v * .5; st('metal', 'dab', [[0, 0], [Math.cos(a) * 10, Math.sin(a) * 10], [Math.cos(a + .5) * 11, Math.sin(a + .5) * 11]], {w: 3.4, c: PAINT.goldHi, pr: [1, .8, .1]}) } st('pigment', 'dab', [[0, 0], [1, 0]], {w: 3, c: PAINT.ink, pr: [1, 1]}); });
  // 挠钩: an iron chain with its hook (along +x); a net of chains (flat)
  // 挠钩: one taut ink line from the hand to the hook, a few link marks near each end, the hook a bold barbed stroke
  for (let v = 0; v < 2; v++) cell(`chain_hook_${v}`, [-6, -14, 214, 14], 'x', (st, {R}) => {
    st('pigment', 'line', [[0, 0], [100, R(-.6, .6)], [196, 0]], {w: 1.7, c: PAINT.ink, pr: [.8, 1, 1, .9]});
    for (const x of [6, 14, 22, 170, 178, 186]) st('pigment', 'dab', pts(t => [x + Math.cos(t * 6.283) * 3.6, Math.sin(t * 6.283) * 2.4], 8), {w: 1.4, c: PAINT.inkMid, pr: [1, 1]});
    st('heavy', 'big', spline([[192, 0], [204, 1], [210, -6], [205, -12], [199, -10]], 8), {w: 4.4, c: PAINT.ink, pr: [.7, 1, .9, .5, .15]});
    st('heavy', 'dab', [[201, 2], [197, 7]], {w: 3, c: PAINT.ink, pr: [1, .2]});                 // the barb
  });
  // the hold: the cords pulled tight round the group, a cinch: loops laid by hand, not closed, their ends pulled out to the men
  for (let v = 0; v < 2; v++) cell(`cinch_${v}`, [-112, -112, 112, 112], '', (st, {R}) => {
    for (let i = 0; i < 3; i++) { const a0 = R(0, 6.28), sp = R(5.3, 5.9), r0 = 72 + i * 9; st('pigment', 'line', pts(t => { const a = a0 + sp * t, r = r0 * (1 + .08 * Math.sin(a * 3 + i)); return [Math.cos(a) * r, Math.sin(a) * r]; }, 26), {w: 2.2 - i * .3, c: PAINT[i ? 'inkMid' : 'ink'], pr: [.4, 1, 1, .9, .6]}); }
    for (let i = 0; i < 4; i++) { const a = R(0, 6.28); st('pigment', 'line', [[Math.cos(a) * 76, Math.sin(a) * 76], [Math.cos(a + R(-.2, .2)) * 108, Math.sin(a + .1) * 108]], {w: 1.5, c: PAINT.ink, pr: [1, .4]}); }
  }, 'soft');
  // 天罗地网: a net of hand-drawn cords sagging between knots, its rim a heavier cord
  cell('net', [-108, -108, 108, 108], '', (st, {R}) => {
    const K = []; for (let a = 0; a < 12; a++) K.push([Math.cos(a / 12 * 6.283) * 100, Math.sin(a / 12 * 6.283) * 100]);
    const sag = (p, q, d) => { const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, l = Math.hypot(q[0] - p[0], q[1] - p[1]); return spline([p, [mx + R(-3, 3), my + d * l * .14], q], 8); };
    for (let i = 0; i < 6; i++) { st('chalk', 'line', sag(K[i], K[(i + 5) % 12], 1), {w: 1.7, c: PAINT.inkMid, a: .9, pr: [.7, 1, .8]}); st('chalk', 'line', sag(K[i + 6], K[(i + 1) % 12], -1), {w: 1.7, c: PAINT.inkMid, a: .9, pr: [.7, 1, .8]}); }
    for (let i = 0; i < 12; i++) { st('pigment', 'line', sag(K[i], K[(i + 1) % 12], .6), {w: 2.6, c: PAINT.ink, pr: [1, .9, 1]}); st('pigment', 'dab', [[K[i][0] - 1, K[i][1]], [K[i][0] + 1, K[i][1]]], {w: 4, c: PAINT.ink, pr: [1, 1]}); }
  }, 'soft');
  // the blessed host's ground (神兵): a halo of brush strokes, banded as Dunhuang's are: the element's pigment, a gold hair, short rays
  for (const [el, c] of [['fire', 'red'], ['water', 'blue'], ['wood', 'green'], ['metal', 'gold'], ['earth', 'ochre']]) cell(`halo_${el}`, [-108, -108, 108, 108], '', (st, {R}) => {
    let a = R(0, 6); for (let i = 0; i < 3; i++) { const sp = R(1.6, 2); st('scumble', 'big', pts(t => [Math.cos(a + sp * t) * 96, Math.sin(a + sp * t) * 96], 14), {w: 9, c: PAINT[c], a: .9, pr: [.2, 1, .9, 1, .3]}); a += sp + .25 }
    st('metal', 'line', pts(t => [Math.cos(t * 6.25) * 84, Math.sin(t * 6.25) * 84], 32), {w: 1.4, c: PAINT.goldHi, pr: [.3, 1, 1, .9, .2]});
    for (let i = 0; i < 12; i++) { const b = i / 12 * 6.283; st('pigment', 'line', [[Math.cos(b) * 104, Math.sin(b) * 104], [Math.cos(b) * 112, Math.sin(b) * 112]], {w: 1.6, c: PAINT[c], pr: [1, .3]}) }
  });

  /* ============================================================ the generals (section 6.3) */
  for (let v = 0; v < 2; v++) cell(`hound_${v}`, [-50, -40, 60, 8], '', (st, {R}) => {      // 哮天犬 as an ink hound at full stretch, a few strokes of 泼墨
    st('heavy', 'big', spline([[-40, -14], [-10, -20], [20, -18], [40, -24]], 8), {w: 16, c: PAINT.ink, pr: [.3, 1, 1, .9, .7]});                   // the body
    st('heavy', 'dab', [[38, -26], [50, -28]], {w: 12, c: PAINT.ink, pr: [1, .6]}); st('pigment', 'dab', [[46, -26], [56, -20]], {w: 5, c: PAINT.ink, pr: [1, .2]});   // head, jaw
    st('pigment', 'dab', [[40, -32], [44, -40]], {w: 4, c: PAINT.ink, pr: [1, .2]});
    for (const [x0, a] of [[28, .9], [24, .5], [-28, -.6], [-34, -1]]) st('pigment', 'big', [[x0, -16], [x0 + Math.cos(a) * 14, -16 + 18], [x0 + Math.cos(a) * 24, -2]], {w: 4, c: PAINT.ink, pr: [1, .7, .3]});
    st('chalk', 'drag', [[-40, -14], [-60, -20 - v * 6]], {w: 6, c: PAINT.ink, a: .8, pr: [1, .4, .1]});
    st('scumble', 'dab', [[46, -27], [47, -27]], {w: 2.4, c: PAINT.white, pr: [1, 1]});
  });
  for (let v = 0; v < 2; v++) cell(`cloud_${v}`, [-110, -70, 110, 20], '', (st, {R}) => {   // a thunder cloud: 泼墨 wash with spiral heads, dark at its core
    for (let i = 0; i < 5; i++) st('wash', 'big', strokeAt(R(-60, 60), R(-40, 0), R(-.3, .3), R(60, 110)), {w: R(30, 46), c: PAINT.inkMid, a: .55, pr: [.3, 1, .8, .3]});
    for (let i = 0; i < 4; i++) { const cx = -70 + i * 46 + R(-8, 8), cy = R(-50, -30); st('pigment', 'line', pts(t => { const a = t * 9, r = 14 * (1 - t * .8); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8] }, 20), {w: 3, c: PAINT.ink, pr: [.3, 1, .8, .4]}) }
    st('chalk', 'drag', [[-100, 4], [100, 6]], {w: 12, c: PAINT.inkMid, a: .6, pr: [.2, 1, .2]});
  }, 'soft');
  cell('drum', [-14, -14, 14, 14], '', (st) => { st('thick', 'dab', [[-1, 0], [1, 0]], {w: 20, c: PAINT.redDeep, pr: [1, 1]}); st('thick', 'dab', [[0, -1], [0, 1]], {w: 12, c: PAINT.white, pr: [1, 1]}); st('pigment', 'line', pts(t => [Math.cos(t * 6.283) * 10.5, Math.sin(t * 6.283) * 10.5], 20), {w: 1.6, c: PAINT.ink, pr: [1, 1, 1]}); st('metal', 'dab', [[0, -10], [0, -11]], {w: 3, c: PAINT.goldHi, pr: [1, 1]}); });
  for (let v = 0; v < 2; v++) cell(`rope_${v}`, [-40, -60, 40, 6], '', (st, {R}) => {        // 捆仙绳: a golden-yellow rope wound three times round what it holds
    for (let i = 0; i < 3; i++) { const y = -12 - i * 16; st('pigment', 'big', pts(t => [Math.cos(t * 6.283 + i) * 26, y + Math.sin(t * 6.283 + i) * 7], 20), {w: 5, c: PAINT[i % 2 ? 'ochreHi' : 'goldHi'], pr: [.4, 1, 1, 1, .4]}); st('pigment', 'line', pts(t => [Math.cos(t * 3.1 + i + .2) * 27, y + 3 + Math.sin(t * 3.1 + i + .2) * 7], 10), {w: 1.2, c: PAINT.ink, pr: [.3, 1, .3]}) }
    st('pigment', 'big', [[26, -12], [34, 0]], {w: 4, c: PAINT.ochreHi, pr: [1, .3]});
  });
  cell('stone5', [-12, -12, 12, 12], '', (st) => {          // 五光石: a pale stone with five short hairs of five colours round it
    st('thick', 'dab', [[-1, 0], [1, 0]], {w: 9, c: PAINT.white, pr: [1, 1]}); st('pigment', 'line', pts(t => [Math.cos(t * 6.283) * 5, Math.sin(t * 6.283) * 5], 14), {w: 1.2, c: PAINT.ink, pr: [1, 1]});
    ['red', 'blue', 'green', 'goldHi', 'ochre'].forEach((c, i) => { const a = i / 5 * 6.283; st('pigment', 'line', [[Math.cos(a) * 7, Math.sin(a) * 7], [Math.cos(a) * 11, Math.sin(a) * 11]], {w: 1.8, c: PAINT[c], pr: [1, .3]}) });
  });

  cell('mandorla', [-110, -260, 110, 10], '', (st, {R}) => {      // the true form's aureole: a pale ogival field, a gold line round it, a pale ink line inside (Yongle, Dunhuang)
    const out = pts(t => { const a = Math.PI * (1 - t) ; const y = -125 - Math.sin(a - Math.PI / 2) * 120; const w = 100 * Math.sin(a) * (1 - .25 * Math.pow(Math.max(0, -Math.cos(a)), 3)); return [w * (t < .5 ? -1 : 1) * 0 + 100 * Math.cos(a), y + (t > .35 && t < .65 ? -30 * Math.sin((t - .35) / .3 * Math.PI) : 0)] }, 40);
    for (let i = 0; i < 4; i++) st('wash', 'big', strokeAt(0, -40 - i * 50, Math.PI / 2, 60), {w: 150 - i * 20, c: PAINT.white, a: .55, pr: [.6, 1, .6]});
    st('metal', 'line', out, {w: 3, c: PAINT.goldHi, pr: [.2, 1, 1, 1, 1, 1, .2]});
    st('pigment', 'line', out.map(p => [p[0] * .88, -125 + (p[1] + 125) * .9]), {w: 1.2, c: PAINT.inkPale, a: .8, pr: [.2, 1, 1, .2]});
  }, 'soft');

  /* ============================================================ danger: cinnabar on the ground, and nothing else is (SPEC 5) */
  cell('warn_ring', [-108, -108, 108, 108], '', (st, {R}) => {          // a ring struck in two strokes, pressed where each begins
    for (const [a0, span] of [[R(0, .4), 3.4], [3.4 + R(0, .3), 3.0]]) st('pigment', 'big', pts(t => [Math.cos(a0 + span * t) * 100, Math.sin(a0 + span * t) * 100], 24), {w: 7, c: PAINT.red, pr: [1, .9, .85, .8, .85, .9, .6]});
    st('pigment', 'line', pts(t => [Math.cos(t * 6.283) * 93, Math.sin(t * 6.283) * 93], 30), {w: 1.6, c: PAINT.redDeep, pr: [.6, 1, 1, .6]});
  });
  cell('warn_fill', [-104, -104, 104, 104], '', (st, {R}) => { for (let i = 0; i < 5; i++) st('wash', 'big', strokeAt(0, -80 + i * 40, 0, 170 - Math.abs(i - 2) * 40), {w: 44, c: PAINT.red, a: .5, pr: [.5, 1, .5]}); }, 'soft');
  cell('warn_edge', [-6, -8, 206, 8], 'x', (st) => st('pigment', 'big', [[0, 0], [100, 0], [200, 0]], {w: 6, c: PAINT.red, pr: [1, .85, .8, .85, .7]}));
  cell('warn_chev', [-18, -22, 10, 22], '', (st) => { st('pigment', 'big', [[-14, -18], [4, 0]], {w: 6, c: PAINT.red, pr: [1, .7]}); st('pigment', 'big', [[-14, 18], [4, 0]], {w: 6, c: PAINT.red, pr: [1, .7]}); });
  for (let v = 0; v < 2; v++) cell(`warn_tick_${v}`, [-4, -6, 34, 6], 'x', (st, {R}) => st('pigment', 'dab', [[0, 0], [14, R(-1, 1)], [28, 0]], {w: 5, c: PAINT.red, pr: [1, .8, .3]}));
  // 金遁: the golden wall: slabs of gold standing in a ring, ink at their edges
  for (let v = 0; v < 2; v++) cell(`gold_wall_${v}`, [-24, -86, 24, 6], '', (st, {R}) => {
    st('metal', 'blunt', [[R(-2, 2), 0], [R(-2, 2), -80]], {w: 34, c: PAINT[v ? 'gold' : 'goldHi'], pr: [1, 1, .95, .9]});
    st('pigment', 'line', [[-17, 0], [-17, -80]], {w: 1.6, c: PAINT.ink, pr: [1, 1]}); st('scumble', 'line', [[-8, -6], [-8, -74]], {w: 2, c: PAINT.white, pr: [.4, 1, .4]});
  });

  // 青云剑's black wind: a broad ink stroke that curls at its head, dry flying white along its back
  for (let v = 0; v < 3; v++) cell(`wind_${v}`, [-10, -34, 216, 34], 'x', (st, {R}) => {
    const p = pts(t => [200 * t, (10 + 6 * v) * Math.sin(t * (3.2 + v * .6) + v) * t], 14);
    st('pigment', 'big', p, {w: 22 - v * 3, c: PAINT.ink, pr: [.15, .7, 1, .95, .8, .6, .35, .1]});
    st('chalk', 'drag', off(part(p, .1, .9), 9), {w: 9, c: PAINT.inkMid, a: .85, pr: [.2, 1, .8, .3]});
  });

  /* ============================================================ moments: the hero's level, a chest, a wound, the horse */
  cell('chev_ink', [-30, -30, 14, 30], '', (st) => { st('pigment', 'big', [[-24, -24], [8, 0]], {w: 9, c: PAINT.ink, pr: [1, .8, .5]}); st('pigment', 'big', [[-24, 24], [8, 0]], {w: 9, c: PAINT.ink, pr: [1, .8, .5]}); });
  for (let v = 0; v < 2; v++) cell(`cut_${v}`, [-8, -14, 150, 14], 'x', (st, {R}) => {      // a wound: one fast cut, pressed at the entry, cinnabar under ink
    const p = pts(t => [140 * t, (v ? 4 : -4) * Math.sin(Math.PI * t)], 10);
    st('pigment', 'big', p, {w: 10, c: PAINT.redDeep, pr: [.4, 1, .9, .6, .25, .05]}); st('pigment', 'line', off(p, -3), {w: 2, c: PAINT.ink, pr: [1, .8, .3]});
  });
  for (let v = 0; v < 3; v++) cell(`rise_${v}`, [-8, -60, 8, 4], 'up', (st, {R}) => st('metal', 'dab', pts(t => [R(-1, 1) + 3 * Math.sin(t * 4 + v), -56 * t], 6), {w: 4, c: PAINT[v ? 'gold' : 'goldHi'], pr: [.2, 1, .7, .3]}));
  for (let v = 0; v < 2; v++) cell(`hoof_${v}`, [-12, -10, 12, 10], '', (st, {R}) => st('chalk', 'dab', pts(t => [Math.cos(Math.PI * (.15 + 1.7 * t)) * 8, Math.sin(Math.PI * (.15 + 1.7 * t)) * 7], 8), {w: 4, c: PAINT.inkMid, a: .8, pr: [.5, 1, 1, .5]}));
  for (let v = 0; v < 2; v++) cell(`kill_${v}`, [-12, -8, 12, 8], '', (st, {R}) => { st('pigment', 'dab', [[-9, R(-3, 3)], [9, R(-3, 3)]], {w: 3, c: PAINT.inkMid, pr: [1, .3]}); st('pigment', 'dab', [[R(-3, 3), -6], [R(-3, 3), 6]], {w: 2, c: PAINT.inkPale, pr: [1, .3]}); });

  // 冲阵: the ruts and dust a chariot leaves: dry ochre and ink dragged and broken, no ruled line
  for (let v = 0; v < 2; v++) cell(`rut_${v}`, [-6, -20, 208, 20], 'x', (st, {R}) => {
    for (let i = 0; i < 3; i++) { const y = (i - 1) * 9 + R(-2, 2); st('chalk', 'drag', pts(t => [R(0, 12) + 186 * t, y + 2 * Math.sin(t * 5 + i + v)], 8), {w: R(5, 9), c: PAINT[i === 1 ? 'ochre' : 'inkPale'], a: .8, pr: [.1, .7, 1, .8, .5, .1]}); }
    st('wash', 'big', [[30, 0], [200, 0]], {w: 26, c: PAINT.ochreHi || PAINT.ochre, a: .25, pr: [.2, 1, .4]});
  });

  /* ============================================================ the named foes' emblems: large, pale, line only, behind him as he lands */
  cell('emblem_moliqing', [-60, -280, 60, 10], '', (st, {R}) => {        // 青云剑: a long sword point up, a cloud at its hilt
    st('pigment', 'line', [[-7, -40], [-6, -250], [0, -276], [6, -250], [7, -40]], {w: 4.3, c: PAINT.ink, pr: [1, 1, 1, 1, 1]});
    st('pigment', 'line', [[0, -48], [0, -255]], {w: 2.2, c: PAINT.inkMid, pr: [.6, 1, .6]});
    st('pigment', 'big', [[-38, -40], [38, -40]], {w: 10.8, c: PAINT.ink, pr: [1, 1, .8]}); st('pigment', 'line', [[0, -38], [0, -2]], {w: 12.6, c: PAINT.green, pr: [1, 1]});
    for (let i = 0; i < 3; i++) st('pigment', 'line', spline([[-50 + i * 30, -10], [-35 + i * 30, -24], [-20 + i * 30, -12], [-28 + i * 30, -4]], 8), {w: 3.2, c: PAINT.green, pr: [1, 1, .4]});
  }, 'big');
  cell('emblem_molihong', [-150, -250, 150, 10], '', (st, {R}) => {      // 混元珍珠伞: the umbrella open, strings of pearls hanging from its rim
    st('pigment', 'line', pts(t => [-140 + 280 * t, -150 - 80 * Math.sin(Math.PI * t)], 20), {w: 4.7, c: PAINT.ink, pr: [1, 1, 1]});
    for (let i = 0; i <= 6; i++) { const x = -140 + i * 280 / 6; st('pigment', 'line', [[x, -150 - 80 * Math.sin(Math.PI * i / 6)], [0, -238]], {w: 2.2, c: PAINT.inkMid, pr: [1, 1]}); for (let k = 0; k < 4; k++) st('wet', 'dab', [[x, -140 + k * 14], [x + .5, -137 + k * 14]], {w: 12.6, c: PAINT.blue, pr: [1, 1]}); }
    st('pigment', 'line', [[0, -238], [0, 0]], {w: 5.4, c: PAINT.ink, pr: [1, 1, .8]});
  }, 'big');
  cell('emblem_molihai', [-90, -280, 90, 10], '', (st, {R}) => {         // 碧玉琵琶: the pear-shaped body, the bent neck, four strings
    st('pigment', 'line', pts(t => { const a = Math.PI * 2 * t; return [Math.sin(a) * (70 - 20 * Math.cos(a) * 0), -80 - Math.cos(a) * 75 + 20 * Math.sin(a) * 0]; }, 32), {w: 4.7, c: PAINT.ink, pr: [1, 1, 1, 1]});
    st('pigment', 'line', [[-14, -150], [-10, -250], [10, -250], [14, -150]], {w: 4.0, c: PAINT.ink, pr: [1, 1, 1, 1]});
    st('pigment', 'line', [[-10, -250], [-30, -272]], {w: 7.2, c: PAINT.ink, pr: [1, .6]});
    for (let i = 0; i < 4; i++) st('pigment', 'line', [[-9 + i * 6, -250], [-14 + i * 9, -30]], {w: 1.8, c: PAINT.green, pr: [1, 1]});
    for (const y of [-260, -245, -232]) for (const d of [-1, 1]) st('pigment', 'dab', [[d * 10, y], [d * 22, y - 2]], {w: 5.4, c: PAINT.ink, pr: [1, .5]});
  }, 'big');
  cell('emblem_molishou', [-130, -200, 130, 10], '', (st, {R}) => {      // 花狐貂: the marten coiled to spring, its tail a great brush
    st('pigment', 'line', spline([[-90, -40], [-60, -110], [0, -130], [60, -100], [80, -60], [50, -30]], 14), {w: 5.4, c: PAINT.ink, pr: [1, 1, .9, .9, .8]});
    st('pigment', 'line', spline([[50, -30], [0, -40], [-40, -20], [-90, -40]], 10), {w: 4.3, c: PAINT.ink, pr: [.8, 1, 1]});
    st('chalk', 'big', spline([[-90, -40], [-120, -100], [-100, -170], [-50, -190]], 12), {w: 39.6, c: PAINT.ochre, a: .8, pr: [1, .9, .7, .3]});
    st('pigment', 'line', [[60, -100], [72, -126], [78, -98]], {w: 3.6, c: PAINT.ink, pr: [1, 1, 1]}); st('pigment', 'dab', [[80, -80], [83, -80]], {w: 7.2, c: PAINT.ink, pr: [1, 1]});
  }, 'big');
  cell('emblem_wenzhong', [-150, -290, 150, 10], '', (st, {R}) => {      // 雌雄金鞭: two golden whips crossed, and the third eye open above them
    for (const d of [-1, 1]) { st('metal', 'blunt', [[d * -110, -10], [d * 100, -260]], {w: 16.2, c: PAINT.gold, pr: [1, .9, .8, .6]}); for (let i = 1; i < 8; i++) { const f = i / 8; st('pigment', 'dab', [[d * (-110 + 210 * f) - 6, -10 - 250 * f], [d * (-110 + 210 * f) + 6, -10 - 250 * f]], {w: 5.4, c: PAINT.ink, pr: [1, 1]}); } }
    st('pigment', 'line', pts(t => [-26 + 52 * t, -230 - 12 * Math.sin(Math.PI * t)], 10), {w: 4.3, c: PAINT.ink, pr: [1, 1, 1]}); st('pigment', 'line', pts(t => [-26 + 52 * t, -230 + 12 * Math.sin(Math.PI * t)], 10), {w: 4.3, c: PAINT.ink, pr: [1, 1, 1]});
    st('metal', 'dab', [[-3, -230], [3, -230]], {w: 18.0, c: PAINT.goldHi, pr: [1, 1]});
  }, 'big');

  /* ============================================================ 法相: the great image of a general's true form, risen behind him over the field
     pale ink line, thin mineral colour, gold line; on the big page (0.5 px a unit), so every line is at least 5 units */
  const L5 = {w: 5.5, c: PAINT.inkMid, pr: [.6, 1, 1, .9, .7]}, GOLD = (w = 4) => ({w, c: PAINT.goldHi, pr: [.5, 1, 1, .8]});
  const wash = (st, path, c, w = 40, a = .28) => st('wash', 'big', path, {w, c: PAINT[c], a, pr: [.4, 1, 1, .4]});
  function deity(st, R, {crown = 1, hair = 0, arms = 1, robe = 'blue', halo = 'goldHi'} = {}) {      // a standing figure seen from the front, the height of 4–5 riders
    const C5 = {w: 6.5, c: PAINT.inkMid, pr: [.35, 1, .8, .9, .6, .3]};                                                         // the contour: thick-thin
    st('wash', 'big', pts(t => [Math.cos(t * 6.283) * 40, -400 + Math.sin(t * 6.283) * 40], 14), {w: 34, c: PAINT[halo], a: .22, pr: [1, 1, 1]});
    st('metal', 'line', pts(t => [Math.cos(t * 6.283) * 58, -404 + Math.sin(t * 6.283) * 58], 22), GOLD(3.5));               // the head halo
    for (const d of [-1, 1]) wash(st, spline([[d * 40, -330], [d * 62, -180], [d * 70, -40]], 8), robe, 70, .3);              // the robe, thin mineral colour
    wash(st, [[0, -330], [0, -30]], robe, 60, .22);
    st('pigment', 'big', pts(t => [Math.cos(t * 6.283) * 26, -400 + Math.sin(t * 6.283) * 32], 16), {w: 5.5, c: PAINT.inkMid, pr: [.5, 1, 1, .7, 1, .6]});   // the head
    for (const d of [-1, 1]) { st('pigment', 'line', [[d * 10, -404], [d * 18, -406]], {w: 3, c: PAINT.ink, pr: [1, 1]}); }
    if (crown) st('metal', 'line', [[-24, -428], [-14, -452], [-4, -436], [0, -462], [4, -436], [14, -452], [24, -428]], GOLD(4.5));
    if (hair) st('pigment', 'big', spline([[-22, -428], [-10, -476], [10, -476], [22, -428]], 10), {...C5, c: PAINT.ink});
    st('pigment', 'big', spline([[-62, -346], [-20, -364], [20, -364], [62, -346]], 8), C5);                                      // the shoulders
    for (const d of [-1, 1]) {
      st('pigment', 'big', spline([[d * 62, -346], [d * 56, -280], [d * 50, -230]], 8), C5);
      st('pigment', 'big', spline([[d * 50, -230], [d * 66, -130], [d * 86, -20]], 10), C5);                                     // the robe
      if (arms) { st('pigment', 'big', spline([[d * 62, -340], [d * 96, -270], [d * 104, -200], [d * 80, -170]], 10), C5);          // the sleeve, hanging
        st('pigment', 'big', spline([[d * 80, -170], [d * 60, -200], [d * 40, -238]], 8), {...C5, w: 5}); }
      st('pigment', 'big', spline([[d * 60, -340], [d * 140, -300], [d * 116, -200], [d * 170, -110], [d * 160, -50]], 14), {w: 5, c: PAINT[robe === 'red' ? 'redDeep' : robe], pr: [.3, 1, .9, .7, .9, .4]});   // 披帛
    }
    st('pigment', 'big', spline([[-86, -20], [-40, -6], [0, -18], [40, -6], [86, -20]], 10), C5);                                 // the hem
    st('metal', 'big', [[-50, -232], [50, -232]], {w: 6, c: PAINT.goldHi, pr: [.6, 1, 1, .6]});                                     // the belt
    for (const x of [-30, -10, 10, 30]) st('pigment', 'big', spline([[x * .6, -224], [x * .9, -130], [x * 1.3, -26]], 8), {w: 4, c: PAINT.inkPale, pr: [.2, 1, .6, .2]});
  }
  const mandorla = (st, c, n = 22, rx = 190, ry = 290, cy = -290) => { for (let i = 0; i < n; i++) { const a = -Math.PI * .1 + (i / (n - 1)) * Math.PI * 1.2 + Math.PI; const x = Math.cos(a) * rx, y = cy + Math.sin(a) * ry; st('pigment', 'big', spline([[x, y], [x * 1.08 + 6, y - 22], [x * 1.04, y - 44]], 6), {w: 9, c: PAINT[c], pr: [1, .8, .4, .1]}); }
    st('pigment', 'line', pts(t => { const a = Math.PI * (.9 + 1.2 * t); return [Math.cos(a) * rx * .94, cy + Math.sin(a) * ry * .94]; }, 30), {w: 4, c: PAINT[c], pr: [.4, 1, 1, .4]}); };
  // behind each 法相 (the figures themselves are drawn by the figures session, art/puppets/faxiang.js): its mandorla, in his element
  cell('mandorla_nezha', [-300, -640, 300, 30], '', (st, {R}) => { mandorla(st, 'red', 30, 240, 320, -330); wash(st, pts(t => [-80 + 160 * t, -330], 4), 'red', 160, .12); }, 'big');
  cell('mandorla_yangjian', [-300, -660, 300, 30], '', (st, {R}) => { for (let i = 0; i < 26; i++) { const a = Math.PI * (1.02 + i / 25 * .96); st('metal', 'line', [[Math.cos(a) * 90, -470 + Math.sin(a) * 90], [Math.cos(a) * 270, -400 + Math.sin(a) * 250]], GOLD(i % 3 ? 3 : 5)); } st('metal', 'line', pts(t => [Math.cos(t * 6.283) * 86, -470 + Math.sin(t * 6.283) * 86], 24), GOLD(4)); }, 'big');
  cell('mandorla_leizhenzi', [-420, -620, 420, 40], '', (st, {R}) => {      // the storm the wings beat: wind strokes behind them, a cloud wash under
    for (const d of [-1, 1]) for (let i = 0; i < 5; i++) { const y = -520 + i * 70; st('chalk', 'big', spline([[d * 60, y + 40], [d * 220, y - 10 + R(-10, 10)], [d * 400, y + 30]], 10), {w: 14 - i, c: PAINT[i % 2 ? 'inkPale' : 'green'], a: .8, pr: [.2, 1, .8, .4, .05]}); }
    wash(st, pts(t => [-380 + 760 * t, -20 + 10 * Math.sin(t * 9)], 8), 'inkPale', 90, .3); }, 'big');
  cell('mandorla_dengchanyu', [-320, -660, 320, 30], '', (st, {R}) => {     // the five lights fanned out wide behind her
    ['red', 'blue', 'green', 'goldHi', 'ochre'].forEach((c, i) => { const a = Math.PI * (1.12 + i * .19); for (let k = 0; k < 3; k++) st('pigment', 'big', [[Math.cos(a + (k - 1) * .05) * 120, -420 + Math.sin(a + (k - 1) * .05) * 120], [Math.cos(a + (k - 1) * .05) * 300, -420 + Math.sin(a + (k - 1) * .05) * 280]], {w: 8, c: PAINT[c], pr: [.1, .8, 1, .4]}); }); }, 'big');
  cell('mandorla_huangfeihu', [-320, -660, 320, 30], '', (st, {R}) => { for (let i = 0; i < 22; i++) { const a = Math.PI * (1.05 + i / 21 * .9); st('metal', 'line', [[Math.cos(a) * 140, -440 + Math.sin(a) * 120], [Math.cos(a) * 290, -400 + Math.sin(a) * 260]], GOLD(i % 3 ? 3 : 5)); } }, 'big');
}
