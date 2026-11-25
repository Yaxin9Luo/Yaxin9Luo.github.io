// The strokes that are new for the oblique field. Called by fx.gen.mjs with its own tools.
// Units are world pixels (a foot soldier stands about 45 tall, the hero about 150).
export function fieldCells({cell, PAINT, pts, off, part, strokeAt, spline}) {
  const circle = (r, n = 28, a0 = 0, a1 = Math.PI * 2, cx = 0, cy = 0) => pts(t => [cx + r * Math.cos(a0 + (a1 - a0) * t), cy + r * Math.sin(a0 + (a1 - a0) * t)], n);
  PAINT.pale = ['#A69F94', '#8F887D']; PAINT.apricot = ['#C99A45', '#A88248'];

  /* ---- 火尖枪 the Fire-tipped Spear (along): a straight thrust, pressed where it leaves the hand, with a flame for its head */
  const THR = pts(t => [240 * t, 2.5 * Math.sin(t * 7) * (1 - t)], 16);
  for (const dry of [0, 1]) cell(dry ? 'thrust_dry' : 'thrust', [-20, -28, 300, 28], 'x', (st) => {
    if (dry) { st('chalk', 'big', THR, {w: 15, c: PAINT.redDeep, a: .9, pr: [.7, 1, .8, .6, .5, .5, .5, .4, .2]}); st('chalk', 'big', [[200, 0], [230, -1], [262, 0]], {w: 18, c: PAINT.redDeep, a: .85, pr: [.1, 1, .6, .1]}); return }
    st('chalk', 'drag', off(THR, 8), {w: 9, c: PAINT.ink, a: .6, pr: [.6, 1, .7, .4, .2]});
    st('pigment', 'big', THR, {w: 17, c: PAINT.red, pr: [.7, 1, .8, .6, .52, .5, .5, .55, .62, .5, .3, .1], load: 260});
    st('thick', 'full', part(THR, .02, .5), {w: 6, c: PAINT.redHot, pr: [.6, 1, .7, .3]});
    st('thick', 'big', [[196, 0], [228, -1], [264, 0]], {w: 23, c: PAINT.red, pr: [.1, 1, .75, .3, .02]});                    // the head: a leaf of flame
    st('thick', 'dab', [[204, 0], [238, 0]], {w: 8, c: PAINT.redHot, pr: [.4, 1, .3]});
    st('scumble', 'drag', [[208, -1], [242, -1]], {w: 3, c: PAINT.white, pr: [.5, 1, .3]});
    for (const d of [-1, 1]) st('pigment', 'dab', [[212, d * 8], [226, d * 15], [238, d * 17]], {w: 5.5, c: PAINT.redDeep, pr: [1, .6, .1]});   // its two tongues
  });
  /* burnt ground. scorch (flat): round, r 100. scorch_line (along): under a thrust that burns. Ink first: the cinnabar in it is
     thin, because strong cinnabar on the ground is kept for danger. */
  cell('scorch', [-112, -112, 112, 112], '', (st, {R}) => {
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + R(-.2, .2), r = R(50, 92); st('chalk', 'full', strokeAt(Math.cos(a) * r, Math.sin(a) * r, a + 1.57 + R(-.4, .4), R(50, 80), R(-.6, .6), 6), {w: R(14, 24), c: PAINT[i % 3 ? 'dust' : 'inkMid'], a: R(.4, .7), pr: [.3, 1, .8, .4, .1]}) }
    st('chalk', 'drag', circle(94, 30, .3, 5.6), {w: 7, c: PAINT.redDeep, a: .5, pr: [.2, .8, 1, .6, .9, .5, .2]});
    for (let i = 0; i < 14; i++) { const a = R(0, 6.283), r = R(10, 96); st('pigment', 'dab', strokeAt(Math.cos(a) * r, Math.sin(a) * r, R(0, 3), R(3, 7), 0, 3), {w: R(1.6, 3.4), c: PAINT.ink, a: .8, pr: [1, .6, .2]}) }
  });
  cell('scorch_line', [-10, -24, 252, 24], 'x', (st, {R}) => {
    st('chalk', 'drag', [[0, 2], [120, R(-2, 4)], [240, 1]], {w: 24, c: PAINT.dust, a: .7, pr: [.5, 1, .9, .8, .6, .3]});
    st('chalk', 'drag', [[6, -2], [120, R(-3, 1)], [236, -1]], {w: 9, c: PAINT.inkMid, a: .8, pr: [.6, 1, .7, .9, .4]});
    st('scumble', 'drag', [[10, 0], [226, 0]], {w: 4, c: PAINT.redDeep, a: .6, pr: [.6, 1, .5, .8, .3]});
  });

  /* ---- 九龙神火罩 the Nine-dragon Fire Cover (upright, foot at the pivot, for a radius of 78): a bell let down over them.
     It is drawn open (a rim, two sides, a crown, ribs), never filled, so that who is inside can still be seen. */
  for (const dry of [0, 1]) cell(dry ? 'dome_dry' : 'dome', [-98, -150, 98, 44], 'down', (st) => {
    const mat = dry ? 'chalk' : 'pigment', a = dry ? .85 : 1, side = d => spline([[d * 6, -124], [d * 44, -112], [d * 70, -66], [d * 80, -6]], 8);
    st('chalk', 'drag', pts(t => [80 * Math.cos(Math.PI * (1 + t)), 24 * Math.sin(Math.PI * (1 + t))], 14), {w: 5, c: PAINT.redDeep, a: .6, pr: [.3, 1, .8, 1, .3]});   // the far rim, pale
    if (!dry) for (const x of [-40, 0, 40]) st('chalk', 'drag', spline([[x * .2, -118], [x * .8, -70], [x, 18 - Math.abs(x) * .12]], 6), {w: 6, c: PAINT.redDeep, a: .5, pr: [.2, .8, 1, .6]});   // ribs
    for (const d of [-1, 1]) { const sd = side(d); st(mat, 'big', sd, {w: 15, c: PAINT[dry ? 'redDeep' : 'red'], a, pr: [.5, .9, 1, .9, .7, .5]});
      if (!dry) { st('thick', 'dab', part(sd, .1, .6), {w: 5, c: PAINT.redHot, pr: [.4, 1, .5, .1]});
        for (const [t, l] of [[.3, 26], [.55, 30], [.8, 24]]) { const p = sd[Math.round(t * (sd.length - 1))]; st('pigment', 'dab', spline([p, [p[0] + d * l * .5, p[1] + 5], [p[0] + d * l, p[1] - l * .5]], 5), {w: 6, c: PAINT.redDeep, pr: [.9, 1, .5, .1]}) } } }   // dragons: hooks along the shell
    st(mat, 'big', pts(t => [80 * Math.cos(Math.PI * t), 24 * Math.sin(Math.PI * t)], 14), {w: 12, c: PAINT[dry ? 'redDeep' : 'red'], a, pr: [.4, 1, .9, .8, .9, 1, .4]});      // the near rim
    if (!dry) { st('metal', 'dab', [[-7, -130], [0, -134], [8, -130]], {w: 13, c: PAINT.goldHi, pr: [.5, 1, .5]}); st('pigment', 'line', [[-12, -122], [12, -122]], {w: 2, c: PAINT.ink, pr: [1, 1]}) }   // the crown
  });

  /* ---- 混天绫 the Armillary Sash (along): lengths of a wet ribbon laid end to end round the hero, and its curling end */
  for (let v = 0; v < 3; v++) cell(`sash_${v}`, [-12, -24, 118, 24], 'x', (st, {R}) => {
    const ph = R(0, 6), p = pts(t => [104 * t, 6 * Math.sin(t * 6 + ph)], 12);
    st('pigment', 'line', off(p, 9), {w: 1.6, c: PAINT.ink, pr: [.5, 1, .6, .2]});
    st('wet', 'big', p, {w: R(13, 15), c: PAINT.blue, pr: [.6, 1, .8, .62, .8, 1, .7, .5]});
    st('wet', 'dab', off(part(p, .05, .9), -4), {w: 4, c: PAINT.blueHi, pr: [.3, 1, .8, 1, .3]});
    st('scumble', 'drag', off(part(p, .2, .8), -8), {w: 3.4, c: PAINT.white, a: .95, pr: [.3, 1, .6]});
  });
  cell('sash_tip', [-12, -46, 96, 30], 'x', (st) => {
    const p = spline([[0, 0], [30, -4], [56, -20], [70, -34], [82, -30], [84, -18], [76, -12]], 7);
    st('pigment', 'line', off(part(p, 0, .5), 9), {w: 1.6, c: PAINT.ink, pr: [.5, 1, .4]});
    st('wet', 'big', p, {w: 15, c: PAINT.blue, pr: [.7, 1, .9, .7, .5, .3, .12]});
    st('scumble', 'drag', off(part(p, .4, .9), -6), {w: 4, c: PAINT.white, a: .95, pr: [.3, 1, .5]});
  });
  // a ripple (flat, r 40) and half of a wave ring (flat, like ring_ink, in azurite)
  cell('ripple', [-48, -48, 48, 48], '', (st) => { st('wet', 'dab', circle(40, 24, .2, 4.4), {w: 4, c: PAINT.blue, pr: [.2, 1, .7, 1, .5, .15]}); st('wet', 'line', circle(31, 18, 3.4, 6.6), {w: 2, c: PAINT.blueHi, pr: [.2, 1, .6, .2]}) });
  cell('ring_blue', [-6, -30, 172, 30], 'x', (st) => {
    const front = pts(t => [150 * Math.sin(t * Math.PI / 2), 12 * Math.cos(t * Math.PI / 2) + 2], 10), back = pts(t => [150 * Math.sin(t * Math.PI / 2), -13 * Math.cos(t * Math.PI / 2) - 1], 10);
    st('wet', 'line', back, {w: 3, c: PAINT.blueHi, pr: [.5, .8, 1, .7, .4]}); st('wet', 'big', front, {w: 11, c: PAINT.blue, pr: [.7, 1, 1, .9, .7, .5, .3, .12]}); st('scumble', 'drag', off(part(front, .1, .8), -6), {w: 3, c: PAINT.white, pr: [.3, 1, .4]});
  });

  /* ---- rings thrown along the ground (flat): the right half of a true circle of radius 150, drawn outward from the middle line.
     The page lays one half each way and squeezes them onto the ground, so the ring is round on the ground, not a bar. */
  for (const [tone, mat, c, c2, w] of [['ink', 'chalk', 'ink', 'dust', 9], ['ochre', 'pigment', 'ink', 'ochre', 13], ['blue', 'wet', 'blue', 'blueHi', 11], ['gold', 'metal', 'goldHi', 'gold', 7]]) cell(`gring_${tone}`, [-12, -166, 166, 166], 'x', (st) => {
    const arc = circle(150, 30, -Math.PI / 2, Math.PI / 2);
    st(mat, tone === 'gold' ? 'dab' : 'big', arc, {w, c: PAINT[c], a: tone === 'ink' ? .9 : 1, pr: [.35, .8, 1, .9, 1, .8, .6, .9, .7, .3]});
    if (tone === 'ochre') st('scumble', 'drag', circle(142, 24, -1.2, 1.2), {w: 6, c: PAINT.ochre, pr: [.3, 1, .7, 1, .3]});
    else if (tone !== 'ink') st(tone === 'gold' ? 'pigment' : 'wet', 'line', circle(141, 20, -1.1, .9), {w: 2, c: PAINT[tone === 'gold' ? 'white' : c2], pr: [.2, 1, .6, .2]});
    else st('pigment', 'line', circle(158, 20, -.9, .6), {w: 1.6, c: PAINT.inkMid, pr: [.2, 1, .3]});
  });

  /* ---- 定海珠 the Sea-calming Pearls (upright, small): a bead with a light on it and the comma of water it drags */
  cell('pearl', [-17, -17, 17, 17], '', (st) => {
    st('pigment', 'dab', circle(11, 12, .4, 2.9), {w: 2.4, c: PAINT.ink, pr: [.2, 1, .8, .2]});
    st('wet', 'dab', [[-2.5, 0], [0, .4], [2.5, 0]], {w: 23, c: PAINT.blue, pr: [1, 1, 1]});
    st('wet', 'dab', [[-5, -4], [0, -6]], {w: 7, c: PAINT.blueHi, pr: [1, .7]});
    st('thick', 'dab', [[-5, -5], [-2.5, -6]], {w: 4, c: PAINT.white, pr: [1, .8]});
  });
  cell('pearl_tail', [-52, -10, 6, 10], 'x', (st) => { st('wet', 'dab', spline([[-46, 4], [-26, 3], [-10, 0], [0, 0]], 6), {w: 9, c: PAINT.blue, pr: [.05, .3, .6, .9, 1]}); st('wet', 'line', [[-40, 0], [-8, -3]], {w: 1.8, c: PAINT.blueHi, pr: [.2, 1, .5]}) });

  /* ---- 打神鞭 the God-beating Whip (upright): a jointed rod of wood brought down from above; where it lands the ground splits (flat) */
  const WHIP = pts(t => [-86 + 86 * t + 10 * Math.sin(t * 3.1), -230 + 230 * t], 14);
  for (const dry of [0, 1]) cell(dry ? 'whip_dry' : 'whip', [-116, -246, 40, 26], 'down', (st) => {
    if (dry) { st('chalk', 'big', WHIP, {w: 20, c: PAINT.green, a: .85, pr: [.2, .5, .8, 1, 1, .9]}); return }
    st('pigment', 'line', off(WHIP, -11), {w: 2.2, c: PAINT.ink, pr: [.3, .8, 1, .9]});
    st('pigment', 'big', WHIP, {w: 23, c: PAINT.green, pr: [.14, .3, .5, .7, .86, 1, 1, 1, .95]});
    st('thick', 'dab', off(part(WHIP, .5, 1), 4), {w: 7, c: PAINT.greenHi, pr: [.2, .9, 1, .8]});
    for (let i = 3; i < 14; i += 2) { const p = WHIP[i], w = 5 + i * .7; st('pigment', 'line', [[p[0] - w, p[1] + 3], [p[0] + w, p[1] - 3]], {w: 2.4, c: PAINT.ink, pr: [.6, 1, .6]}) }     // its joints
    st('heavy', 'dab', [[-9, -5], [0, 2], [10, -2]], {w: 15, c: PAINT.green, pr: [.5, 1, .5]});
  });
  cell('crack', [-74, -56, 74, 56], '', (st, {R}) => {
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + R(-.3, .3), l = R(40, 66), p = spline([[4 * Math.cos(a), 4 * Math.sin(a)], [l * .5 * Math.cos(a + .2), l * .5 * Math.sin(a + .2)], [l * Math.cos(a - .1), l * Math.sin(a - .1)]], 6);
      st('pigment', 'line', off(p, 3), {w: 1.6, c: PAINT.ink, pr: [.8, 1, .4]}); st('pigment', 'dab', p, {w: R(6, 9), c: PAINT[i % 2 ? 'green' : 'greenHi'], pr: [.9, 1, .7, .4, .15, .04]});
      const m = p[7]; st('pigment', 'dab', [m, [m[0] + 16 * Math.cos(a + 1), m[1] + 16 * Math.sin(a + 1)]], {w: 4, c: PAINT.green, pr: [.9, .4, .05]}) }
  });
  cell('vine', [-8, -18, 172, 18], 'x', (st) => {
    const p = pts(t => [160 * t, 7 * Math.sin(t * 8)], 14);
    st('pigment', 'line', off(p, 4), {w: 1.4, c: PAINT.ink, pr: [.6, 1, .5]}); st('pigment', 'dab', p, {w: 6, c: PAINT.green, pr: [.8, 1, .8, .9, .7, .8, .5, .2]});
    for (const t of [.25, .5, .75]) { const q = p[Math.round(t * 14)], d = t === .5 ? 1 : -1; st('pigment', 'dab', [q, [q[0] + 10, q[1] + d * 9], [q[0] + 22, q[1] + d * 11]], {w: 5, c: PAINT.greenHi, pr: [.9, .8, .1]}) }
  });

  /* ---- 乾坤圈 the Universe Ring (upright, small): a bronze hoop, a hair of white on it */
  for (const [name, r, w] of [['quan', 14, 6], ['quan_big', 20, 7.5]]) cell(name, [-r - 8, -r - 8, r + 8, r + 8], '', (st) => {
    st('pigment', 'line', circle(r + 3.4, 20, .5, 2.7), {w: 1.6, c: PAINT.ink, pr: [.2, 1, .8, .2]});
    st('metal', 'dab', circle(r, 26, -1.6, 4.75), {w, c: PAINT.goldHi, pr: [.9, 1, 1, 1, 1, 1, .9]});
    st('pigment', 'rule', circle(r - 1.5, 12, 3.5, 4.9), {w: 1.5, c: PAINT.white, pr: [.2, 1, .2]});
  });

  /* ---- 番天印 the Heaven-turning Seal: the block that falls (upright, for a radius of 95) and what it prints (flat) */
  cell('seal', [-70, -176, 70, 30], 'down', (st, {R}) => {
    for (const [x, w, top] of [[-34, 30, -98], [-6, 34, -104], [26, 32, -100], [46, 18, -94]]) st('heavy', 'blunt', [[x * .86 + R(-2, 2), top], [x * .95, -50], [x + R(-2, 2), 2]], {w, c: PAINT.ink, pr: [.8, 1, 1, 1]});      // the body, in four pulls that leave paper between them
    st('heavy', 'blunt', [[-56, 6], [0, 10], [58, 6]], {w: 13, c: PAINT.ink, pr: [1, 1, 1]});                                                         // the carved foot
    st('scumble', 'drag', [[-46, -108], [0, -114], [50, -108]], {w: 20, c: PAINT.ochre, a: .95, pr: [.7, 1, 1, .7]});                                 // the top face, lit
    st('scumble', 'drag', [[-50, -92], [-56, -4]], {w: 9, c: PAINT.ochre, a: .9, pr: [.6, 1, .7, .3]});
    st('heavy', 'big', [[-20, -120], [0, -150], [22, -120]], {w: 20, c: PAINT.ink, pr: [.6, 1, .6]}); st('scumble', 'drag', [[-8, -146], [8, -146]], {w: 5, c: PAINT.ochre, pr: [1, .6]});   // the knob
    st('pigment', 'line', [[-40, -60], [44, -62]], {w: 2, c: PAINT.ochre, pr: [.5, 1, .5]}); st('pigment', 'line', [[-42, -34], [46, -36]], {w: 2, c: PAINT.ochre, pr: [.5, 1, .5]});         // bands cut round it
  });
  cell('print', [-112, -112, 112, 112], '', (st, {R}) => {       // a square seal's impression: a frame and a few cut strokes inside
    const q = 78, bar = (x0, y0, x1, y1, w = 13) => st('heavy', 'blunt', [[x0 + R(-2, 2), y0 + R(-2, 2)], [(x0 + x1) / 2 + R(-2, 2), (y0 + y1) / 2 + R(-2, 2)], [x1, y1]], {w, c: PAINT.ink, pr: [.9, 1, .8, 1, .7]});
    bar(-q, -q, q, -q, 15); bar(q, -q, q, q, 15); bar(q, q, -q, q, 15); bar(-q, q, -q, -q, 15);
    bar(-46, -40, 44, -40, 10); bar(-46, -4, 10, -4, 10); bar(0, -40, 0, 46, 10); bar(-46, 34, 46, 34, 10); bar(34, -8, 34, 30, 9); bar(-44, 6, -44, 30, 9);
    for (let i = 0; i < 5; i++) st('scumble', 'drag', strokeAt(R(-70, 70), R(-70, 70), R(0, 3), R(30, 60), 0, 4), {w: R(8, 14), c: PAINT.ochre, a: .8, pr: [.3, 1, .4]});
    for (let i = 0; i < 4; i++) st('chalk', 'drag', strokeAt(R(-90, 90), (i % 2 ? 1 : -1) * R(88, 100), R(-.2, .2), R(40, 70), 0, 4), {w: 7, c: PAINT.dust, a: .6, pr: [.3, 1, .3]});
  });
  cell('print_red', [-112, -112, 112, 112], '', (st, {R}) => {    // 番天覆地: the same print taken in seal paste: a thin border inside the frame
    const q = 62; for (const [a, b] of [[[-q, -q], [q, -q]], [[q, -q], [q, q]], [[q, q], [-q, q]], [[-q, q], [-q, -q]]]) st('pigment', 'cloth', [a, [(a[0] + b[0]) / 2 + R(-2, 2), (a[1] + b[1]) / 2 + R(-2, 2)], b], {w: 5, c: PAINT.red, a: .9, pr: [.8, 1, .7, 1, .6]});
  });

  /* ---- 杏黄旗 the Apricot-yellow Banner: the ward on the ground (flat, r 125) and the small banner that marks it (upright) */
  cell('ward', [-136, -136, 136, 136], '', (st) => {
    st('chalk', 'drag', circle(125, 44, .15, 6.1), {w: 5, c: PAINT.apricot, a: .9, pr: [.3, 1, .8, 1, .7, 1, .8, 1, .3]});
    st('pigment', 'line', circle(117, 30, 1.2, 3.6), {w: 1.4, c: PAINT.inkMid, pr: [.2, 1, .6, .2]}); st('pigment', 'line', circle(117, 30, 4.4, 6.6), {w: 1.4, c: PAINT.inkMid, pr: [.2, 1, .6, .2]});
  });
  cell('ward_hit', [-140, -140, 140, 140], '', (st) => { for (const [a0, a1] of [[.1, 1.3], [1.7, 2.9], [3.3, 4.5], [4.9, 6.1]]) st('pigment', 'big', circle(126, 14, a0, a1), {w: 12, c: PAINT.apricot, pr: [.2, 1, .9, 1, .2]}); st('scumble', 'drag', circle(133, 40, 0, 6.2), {w: 3, c: PAINT.white, pr: [.3, 1, .5, 1, .3]}) });
  cell('flag', [-34, -68, 10, 8], 'up', (st) => {
    st('pigment', 'line', [[0, 2], [0, -30], [0, -60]], {w: 2.2, c: PAINT.ink, pr: [1, .9, .7]});
    st('pigment', 'dab', spline([[1, -58], [-12, -56], [-24, -50], [-30, -44]], 6), {w: 13, c: PAINT.apricot, pr: [1, .95, .7, .4, .12]}); st('pigment', 'dab', [[0, -46], [-14, -42], [-20, -36]], {w: 6, c: PAINT.ochre, pr: [1, .6, .1]});
  });

  /* ---- the two that may come later: 阴阳镜 the mirror's beam (along: a white side and a dark side) and 捆仙绳 the rope (along) */
  cell('beam', [-10, -30, 330, 30], 'x', (st) => {
    st('scumble', 'drag', [[0, -9], [160, -10], [316, -9]], {w: 16, c: PAINT.white, a: .95, pr: [.6, 1, 1, .9, .6]});
    st('chalk', 'drag', [[0, 9], [160, 10], [316, 9]], {w: 15, c: PAINT.inkMid, a: .8, pr: [.6, 1, 1, .9, .6]});
    st('metal', 'rule', [[0, 0], [318, 0]], {w: 3.4, c: PAINT.goldHi, pr: [.5, 1, 1, 1, .6]}); st('pigment', 'rule', [[4, -18], [300, -18]], {w: 1.2, c: PAINT.gold, pr: [.5, 1, .4]});
  });
  cell('rope', [-8, -14, 212, 14], 'x', (st) => {
    for (const ph of [0, 3.14]) st('pigment', 'dab', pts(t => [200 * t, 5 * Math.sin(t * 25 + ph)], 40), {w: 4.4, c: PAINT[ph ? 'greenHi' : 'green'], pr: [.8, 1, 1, 1, .8]});
    for (const x of [40, 100, 160]) st('pigment', 'dab', [[x - 3, -6], [x, 0], [x + 3, 6]], {w: 7, c: PAINT.ink, pr: [.5, 1, .5]});
  });

  /* ---- the squads: a spearman's jab (along), the path of a foe a Strongman throws (upright arc) */
  cell('jab', [-6, -10, 72, 10], 'x', (st) => { st('pigment', 'line', [[0, 0], [50, 0]], {w: 2.2, c: PAINT.ink, pr: [.6, 1, .8]}); st('metal', 'dab', [[44, 0], [56, 0], [66, 0]], {w: 7, c: PAINT.goldHi, pr: [.3, 1, .1]}); st('scumble', 'drag', [[10, -4], [48, -4]], {w: 3, c: PAINT.white, pr: [.4, 1, .3]}) });
  cell('toss', [-8, -74, 152, 10], 'x', (st) => { const p = pts(t => [140 * t, -4 * 62 * t * (1 - t)], 14); st('chalk', 'drag', p, {w: 9, c: PAINT.ochre, a: .85, pr: [.8, 1, .7, .5, .4, .5, .7]}); st('pigment', 'line', off(p, 5), {w: 1.6, c: PAINT.inkMid, pr: [.6, 1, .4, .6]}) });

  /* ---- the formations' standing marks (flat): pencil-thin ink, to be drawn pale. A ring, an arrowhead, the eight trigrams. */
  cell('f_ring', [-208, -208, 208, 208], '', (st) => { for (const [a0, a1] of [[.1, 1.9], [2.2, 4.0], [4.3, 6.1]]) st('pigment', 'line', circle(200, 30, a0, a1), {w: 2, c: PAINT.pale, pr: [.3, 1, .8, 1, .3]}) });
  cell('f_arrow', [-20, -150, 264, 150], '', (st) => { for (const d of [-1, 1]) { st('pigment', 'line', [[250, 0], [120, d * 70], [0, d * 140]], {w: 2, c: PAINT.pale, pr: [1, .8, .6, .3]}); st('pigment', 'line', [[190, 0], [100, d * 46], [30, d * 84]], {w: 1.6, c: PAINT.pale, pr: [.8, .6, .2]}) } });
  // later-heaven order, clockwise from the south: 离 坤 兑 乾 坎 艮 震 巽; a line is whole (1) or broken (0), bottom line first
  ['101', '000', '110', '111', '010', '001', '100', '011'].forEach((bits, v) => cell(`gua_${v}`, [-24, -18, 24, 18], '', (st) => {
    [...bits].forEach((b, i) => { const y = 10 - i * 10; if (b === '1') st('pigment', 'line', [[-18, y], [18, y]], {w: 3, c: PAINT.inkMid, pr: [.8, 1, .8]}); else { st('pigment', 'line', [[-18, y], [-4, y]], {w: 3, c: PAINT.inkMid, pr: [.8, 1]}); st('pigment', 'line', [[4, y], [18, y]], {w: 3, c: PAINT.inkMid, pr: [1, .8]}) } });
  }));

  /* ---- what the player must read. Danger is cinnabar on the ground, and it is the only strong cinnabar there.
     lane (flat, 400 x 60): where a charge will pass. zone (flat, r 100): where a blow will land; zone_fill grows inside it as the time runs out. */
  cell('lane', [-10, -40, 420, 40], 'x', (st) => {
    st('scumble', 'drag', [[0, 0], [200, 0], [400, 0]], {w: 54, c: PAINT.red, a: .42, pr: [.8, 1, 1, 1, .8]});
    for (const y of [-30, 30]) st('pigment', 'cloth', [[0, y], [200, y], [400, y]], {w: 5, c: PAINT.red, pr: [1, 1, 1, 1, 1]});
    for (let x = 40; x < 400; x += 72) { st('pigment', 'dab', [[x - 14, -20], [x + 8, 0]], {w: 4.4, c: PAINT.red, pr: [.7, 1]}); st('pigment', 'dab', [[x + 8, 0], [x - 14, 20]], {w: 4.4, c: PAINT.red, pr: [1, .7]}) }
  });
  cell('zone', [-112, -112, 112, 112], '', (st) => { st('pigment', 'cloth', circle(100, 48, 0, 6.2832), {w: 8, c: PAINT.red, pr: [1, 1, 1, 1]}); st('pigment', 'line', circle(88, 40, .3, 5.9), {w: 2, c: PAINT.redDeep, pr: [.3, 1, .7, 1, .3]}) });
  cell('zone_fill', [-104, -104, 104, 104], '', (st, {R}) => { for (let i = -3; i <= 3; i++) { const y = i * 28, h = Math.sqrt(Math.max(0, 96 * 96 - y * y)); st('scumble', 'drag', [[-h, y + R(-3, 3)], [0, y + R(-4, 4)], [h, y + R(-3, 3)]], {w: 34, c: PAINT.red, a: .45, pr: [.5, 1, 1, 1, .5]}) } });
  // an arrival off the screen: a chevron for the edge of the sheet
  cell('chev', [-26, -24, 26, 24], '', (st) => { st('heavy', 'big', [[-14, -18], [12, 0]], {w: 11, c: PAINT.ink, pr: [.6, 1]}); st('heavy', 'big', [[12, 0], [-14, 18]], {w: 11, c: PAINT.ink, pr: [1, .6]}); st('pigment', 'dab', [[-18, -8], [-4, 0]], {w: 5, c: PAINT.green, pr: [.6, 1]}); st('pigment', 'dab', [[-4, 0], [-18, 8]], {w: 5, c: PAINT.green, pr: [1, .6]}) });

  /* ---- what is worth riding to (upright, each with its own small ink shadow on the ground): battle spirit in three sizes, the
     peach, the lodestone, the chest. None has a tail or a direction: nothing here can be taken for something in flight. */
  const shadow = (st, w) => st('chalk', 'drag', [[-w, 2], [0, 3], [w, 2]], {w: w * .7, c: PAINT.inkMid, a: .7, pr: [.3, 1, .3]});
  cell('spirit_0', [-12, -22, 12, 8], '', (st) => { shadow(st, 7); st('metal', 'dab', [[0, -1], [.5, -8], [0, -15]], {w: 9, c: PAINT.goldHi, pr: [1, .8, .25]}) });
  cell('spirit_1', [-16, -32, 16, 10], '', (st) => { shadow(st, 10); st('metal', 'dab', [[0, -2], [1, -12], [0, -23]], {w: 14, c: PAINT.goldHi, pr: [1, .85, .25]}); st('thick', 'dab', [[-2, -8], [-2, -12]], {w: 4, c: PAINT.white, pr: [1, .6]}); st('pigment', 'line', [[-7, -1], [7, -1]], {w: 1.6, c: PAINT.ink, pr: [.5, 1, .5]}) });
  cell('spirit_2', [-24, -48, 24, 12], '', (st) => { shadow(st, 15);
    for (const [dx, h, w] of [[-9, 22, 11], [9, 24, 11], [0, 36, 17]]) st('metal', 'dab', [[dx, -2], [dx * 1.1 + 1, -h * .5], [dx * .8, -h]], {w, c: PAINT[dx ? 'gold' : 'goldHi'], pr: [1, .85, .25]});
    st('thick', 'dab', [[-3, -12], [-3, -19]], {w: 5, c: PAINT.white, pr: [1, .6]}); st('pigment', 'line', [[-13, -1], [13, -1]], {w: 2, c: PAINT.ink, pr: [.5, 1, .5]}) });
  cell('halo', [-30, -30, 30, 30], '', (st) => st('metal', 'rule', circle(22, 24, .4, 6.0), {w: 2.4, c: PAINT.gold, pr: [.3, 1, .7, 1, .3]}));
  cell('peach', [-20, -36, 20, 10], '', (st) => { shadow(st, 12);
    st('thick', 'dab', [[-2, -13], [0, -12], [2, -13]], {w: 25, c: PAINT.white, pr: [1, 1, 1]}); st('pigment', 'dab', [[-5, -22], [0, -27], [5, -22]], {w: 11, c: PAINT.red, a: .85, pr: [.4, 1, .4]});
    st('pigment', 'line', [[0, -27], [1, -14], [0, -3]], {w: 1.6, c: PAINT.redDeep, pr: [.8, .6, .3]}); st('pigment', 'line', circle(12.5, 14, .4, 2.8, 0, -13), {w: 1.6, c: PAINT.ink, pr: [.2, 1, .2]});
    for (const d of [-1, 1]) st('pigment', 'dab', [[d * 3, -3], [d * 12, -5], [d * 18, -2]], {w: 7, c: PAINT.green, pr: [.4, 1, .2]}) });
  cell('lodestone', [-20, -34, 20, 10], '', (st) => { shadow(st, 11);
    st('heavy', 'big', [[0, -1], [1, -12], [0, -25]], {w: 20, c: PAINT.ink, pr: [.5, 1, .4]}); st('metal', 'rule', [[-8, -14], [8, -10]], {w: 3, c: PAINT.goldHi, pr: [.6, 1, .6]});
    for (const a of [-2.5, -1.9, -1.2, -.6]) st('pigment', 'rule', [[13 * Math.cos(a), -13 + 13 * Math.sin(a)], [19 * Math.cos(a), -13 + 19 * Math.sin(a)]], {w: 1.4, c: PAINT.inkMid, pr: [1, .5]}) });
  cell('chest', [-32, -50, 32, 12], '', (st) => { shadow(st, 24);
    st('heavy', 'blunt', [[-22, -11], [0, -11], [22, -11]], {w: 22, c: PAINT.ochre, pr: [1, 1, 1]}); st('heavy', 'big', [[-24, -24], [0, -32], [24, -24]], {w: 13, c: PAINT.ink, pr: [.7, 1, .7]});
    for (const [a, b] of [[[-24, -22], [-24, 0]], [[-24, 0], [24, 0]], [[24, 0], [24, -22]], [[-12, -22], [-12, 0]], [[12, -22], [12, 0]]]) st('pigment', 'line', [a, b], {w: 2, c: PAINT.ink, pr: [1, 1]});
    st('metal', 'dab', [[0, -21], [0, -13]], {w: 8, c: PAINT.goldHi, pr: [1, .8]}); st('thick', 'dab', [[-17, -30], [-12, -33]], {w: 3, c: PAINT.white, pr: [1, .5]}) });
  // a level gained: gold that rises (upright), and half of a gold ring on the ground (flat, like ring_ink)
  for (let v = 0; v < 2; v++) cell(`rise_${v}`, [-10, -64, 14, 8], 'up', (st, {R}) => { const h = R(46, 58); st('metal', 'dab', spline([[0, 2], [R(-2, 2), -h * .5], [R(2, 8), -h]], 6), {w: 8, c: PAINT.goldHi, pr: [.9, 1, .7, .4, .15, .03]}); st('pigment', 'rule', [[-3, -4], [-2, -h * .5]], {w: 1.2, c: PAINT.white, pr: [1, .3]}) });
  cell('ring_gold', [-6, -30, 172, 30], 'x', (st) => {
    const front = pts(t => [150 * Math.sin(t * Math.PI / 2), 12 * Math.cos(t * Math.PI / 2) + 2], 10), back = pts(t => [150 * Math.sin(t * Math.PI / 2), -13 * Math.cos(t * Math.PI / 2) - 1], 10);
    st('metal', 'rule', back, {w: 2.4, c: PAINT.gold, pr: [.5, .8, 1, .7, .4]}); st('metal', 'dab', front, {w: 7, c: PAINT.goldHi, pr: [.7, 1, 1, .9, .7, .5, .3, .12]});
  });
}
