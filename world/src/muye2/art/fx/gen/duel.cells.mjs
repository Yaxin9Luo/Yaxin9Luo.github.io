// The duel's sheet: the stage-final bosses' set pieces on their night arenas (the lead, 2026-11-27: "big readable shapes that
// cross the arena"). The paper sheets are ink on pale ground and vanish on a dark one; here the brush works as gold ink and
// lead white on indigo paper does (绀纸金泥): the light is the pigment, the ink is only in the cloud. Still brushwork: every
// stroke loaded at its start, dry where the brush runs out, never a flat band, never a glow.
// Baked by `SET=duel node fx.gen.mjs` into ../baked/duel.webp + duel.json. Units are world units.
//   dlane_{0,1}    flat along +x: a lane warned: a dry band of lead white the width of the lane, its edges ruled in gold
//   dbolt_{0,1}    lightning upright, foot at the pivot, from y = -740: one fast dry stroke, broken-edged, thick where it lands,
//                  a gold core in its trunk, hairline forks
//   dedge          flat along +x: a lane warned, restrained: the two gold-ruled edges with small ticks inward, nothing between
//   dedge0         flat along +x: a lane waiting its turn: thin gold edges and closed ends only
//   dveil          flat along +x: a waiting lane veiled: a broad soft ink wash
//   dband_{0,1}    flat along +x: a band of 绝龙岭's fire warned: lead-white and ochre under-wash, vermilion hairs, heavy gold edges
//   dring          flat: a circle warned: a ruled gold ring, dry white hairs inside it
//   dfire          upright: a pillar of fire (通天神火柱): tongues with ox-blood roots, cinnabar bodies, dry gold tips, embers
//   dflame_{0,1,2} upright: fire for the fall: narrow root, swelling body, separate tongues curling, a white-gold core low, smoke
//   ddisc          flat: a circle warned, filled: dry white hairs laid round inside it, a ruled gold ring at its edge
//   dscorch_{0,1}  flat along +x: the burn a strike leaves along its lane, embers in it
//   dpillar        upright: a column of white light standing where thunder struck, soft at the edges, foot at the pivot
//   dcrack_{0,1}   flat along +x: the ground split by thunder, lit from below: a white core, azure round it, side cracks
//   dseal          flat: the seal of the 雷部: two rings of gold, thunder spirals between them
//   dwhip_{0,1}    along +x: a golden whip's sweep across the arena: a gold stroke leading, a white trail behind it
export function duel({cell, PAINT, pts, off, part, spline}) {
  const TAU = Math.PI * 2;
  // a jagged path made of straight runs, each run filled with points so the paint keeps its corners
  const jag = (q, n = 4) => q.slice(0, -1).flatMap((a, i) => Array.from({length: n}, (_, k) => [a[0] + (q[i + 1][0] - a[0]) * k / n, a[1] + (q[i + 1][1] - a[1]) * k / n])).concat([q[q.length - 1]]);

  for (let v = 0; v < 2; v++) cell(`dlane_${v}`, [-10, -96, 1210, 96], 'x', (st, {R}) => {
    // the band: the hairs of one big dry brush dragged along the lane, each starting and running out at its own place, so the
    // ground shows between them (飞白), denser toward the middle
    for (let k = 0; k < 34; k++) { const d = (R(-1, 1) + R(-1, 1)) * 32, t0 = R(0, .18), t1 = R(.72, 1), wob = R(2, 7), ph = R(0, 6);
      st('chalk', 'drag', pts(t => [1200 * (t0 + (t1 - t0) * t), d + wob * Math.sin(t * 7 + ph)], 22), {w: R(5, 13), c: PAINT[k % 7 === 3 ? 'bluePale' : 'white'], a: R(.42, .78), pr: [R(.6, 1), 1, .9, .8, .6, R(.1, .4)]}); }
    // its edges ruled in gold, each a single line pressed at its start
    for (const s2 of [-1, 1]) st('pigment', 'line', pts(t => [1200 * t, s2 * 72 + 2 * Math.sin(t * 5 + s2)], 30), {w: 2.6, c: PAINT.goldHi, pr: [1, 1, .95, .9, .8, .6, .3]});
  }, 'duel');

  for (let v = 0; v < 2; v++) cell(`dbolt_${v}`, [-180, -760, 180, 40], '', (st, {R}) => {
    // one fast stroke of the brush thrown down from the sky (the lead: no even-width zigzag, no hard outline): irregular runs,
    // the brush dry and broken at the top, loading as it falls and pressed hardest where it lands
    const p = [[R(-30, 30), -740]]; let x = p[0][0], y = -740; while (y < -60) { y += R(50, 120); x += R(-80, 80) * (y > -220 ? .45 : 1); x = Math.max(-130, Math.min(130, x)); p.push([x, Math.min(-10, y)]); } p.push([x * .3, 0]);
    const q = jag(p, 4), n = q.length;
    // the trunk in three passes of dry white, each a little apart, so its edge is broken; wider as it falls
    for (let k = 0; k < 3; k++) st('chalk', 'drag', off(q, (k - 1) * R(3, 7)), {w: R(18, 26), c: PAINT.white, a: R(.75, .95), pr: [.12, .25, .4, .55, .7, .85, 1, 1]});
    st('thick', 'big', part(q, .5, 1), {w: 24, c: PAINT.white, pr: [.15, .5, .8, 1, 1]});
    // the gold core, only in the trunk's lower half, where it is loaded
    st('pigment', 'line', part(q, .35, 1), {w: 4, c: PAINT.goldHi, pr: [.1, .7, 1, 1, .8]});
    // hairline forks off the upper turns, thinning to nothing
    for (let k = 1; k < p.length - 2; k++) { if (R(0, 1) < .35) continue; const a = p[k], b = [a[0] + R(-130, 130), a[1] + R(50, 110)], c = [b[0] + R(-70, 70), b[1] + R(30, 70)];
      st('pigment', 'line', jag([a, b, c], 3), {w: R(1, 2.2), c: PAINT.white, pr: [1, .6, .2]}); }
    // where it lands: dry white thrown out low and wide
    const fx = p[p.length - 1][0]; for (let k = 0; k < 11; k++) { const a = -Math.PI + k / 10 * Math.PI, r = R(50, 120); st('chalk', 'drag', [[fx, 0], [fx + Math.cos(a) * r, Math.sin(a) * r * .35 + 4]], {w: R(5, 12), c: PAINT.white, a: .85, pr: [1, .2]}); }
  }, 'duel');

  cell('dedge', [-10, -96, 1210, 96], 'x', (st, {R}) => {
    // a lane warned, restrained (the tester: warning and strike read alike): only its two edges ruled in gold, pressed at the start,
    // the ground between them left alone; the dry wash is laid faint over it in the renderer as the time runs out
    for (const s2 of [-1, 1]) { st('pigment', 'line', pts(t => [1200 * t, s2 * 72 + 2 * Math.sin(t * 5 + s2)], 30), {w: 4.2, c: PAINT.goldHi, pr: [1, 1, .95, .9, .85, .7, .45]});
      for (let k = 0; k < 9; k++) { const x = 60 + k * 135 + R(-10, 10); st('pigment', 'line', [[x, s2 * 72], [x + 20, s2 * 44]], {w: 3.6, c: PAINT.goldHi, a: .9, pr: [1, .7, .2]}); } }
    // (the lead, round 2: a lane must read as one closed band) its two ends closed in gold, and a light hatch across it, dry
    for (const x of [0, 1200]) st('pigment', 'line', pts(t => [x + 2 * Math.sin(t * 4), -72 + 144 * t], 10), {w: 4.2, c: PAINT.goldHi, pr: [1, 1, .9, .9, 1]});
    for (let k = 0; k < 24; k++) { const x = 25 + k * 50 + R(-6, 6); st('chalk', 'drag', [[x - 22, 62], [x + 22, -62]], {w: R(2.5, 4), c: PAINT.goldHi, a: R(.35, .55), pr: [.4, 1, .8, .3]}); }
  }, 'duel');

  cell('dedge0', [-10, -96, 1210, 96], 'x', (st, {R}) => {
    // a lane still waiting its turn (the lead: nearly bare ground): its two edges and closed ends only, thin, no ticks, no hatch
    for (const s2 of [-1, 1]) st('pigment', 'line', pts(t => [1200 * t, s2 * 72 + 2 * Math.sin(t * 5 + s2)], 30), {w: 2.6, c: PAINT.goldHi, pr: [1, 1, .95, .9, .85, .7, .45]});
    for (const x of [0, 1200]) st('pigment', 'line', pts(t => [x + 2 * Math.sin(t * 4), -72 + 144 * t], 10), {w: 2.6, c: PAINT.goldHi, pr: [1, 1, .9, .9, 1]});
  }, 'duel');

  cell('dveil', [-10, -96, 1210, 96], 'x', (st, {R}) => {
    // a lane waiting its turn, veiled (the lead: safe ground goes darker as live ground goes lighter): a broad ink wash laid along
    // it in a few loaded passes, soft-edged, the brush lifting at the ends
    for (let k = 0; k < 5; k++) { const d = (k - 2) * 26 + R(-4, 4); st('wash', 'big', pts(t => [1200 * t, d + 3 * Math.sin(t * 6 + k)], 24), {w: R(46, 60), c: PAINT.ink, a: R(.7, .9), pr: [.4, .9, 1, 1, 1, .9, .5]}); }
  }, 'duel');

  for (let v = 0; v < 2; v++) cell(`dband_${v}`, [-10, -96, 1210, 96], 'x', (st, {R}) => {
    // 绝龙岭's fire warned (round 2, scenes: the cinnabar alone was as dark as the night and the warm dark of 绝龙岭): first an
    // under-wash of lead white and pale ochre hairs, so the band is clearly lighter than any of the three grounds, then vermilion
    // hairs over it, dense, and the edges ruled heavy in gold, doubled, like the lanes'
    for (let k = 0; k < 30; k++) { const d = (R(-1, 1) + R(-1, 1)) * 34, t0 = R(0, .12), t1 = R(.8, 1), wob = R(2, 6), ph = R(0, 6);
      st('chalk', 'drag', pts(t => [1200 * (t0 + (t1 - t0) * t), d + wob * Math.sin(t * 7 + ph)], 22), {w: R(8, 16), c: PAINT[k % 3 ? 'white' : 'ochreHi'], a: R(.5, .75), pr: [R(.6, 1), 1, .95, .85, .6, R(.15, .4)]}); }
    // (round 3, scenes: the hue was lost under the white) the vermilion laid dense and strong over the under-wash, so the body
    // reads light red: clearly lighter than the ground, clearly not white
    st('wash', 'big', pts(t => [1200 * t, 0], 24), {w: 120, c: PAINT.redHot, a: .45, pr: [.5, .9, 1, 1, 1, .9, .5]});
    for (let k = 0; k < 64; k++) { const d = (R(-1, 1) + R(-1, 1)) * 34, t0 = R(0, .15), t1 = R(.78, 1), wob = R(2, 7), ph = R(0, 6);
      st('chalk', 'drag', pts(t => [1200 * (t0 + (t1 - t0) * t), d + wob * Math.sin(t * 7 + ph)], 22), {w: R(6, 12), c: PAINT[k % 5 ? 'redHot' : 'red'], a: R(.7, .95), pr: [R(.7, 1), 1, .95, .85, .65, R(.15, .4)]}); }
    // a few lead-white hairs back over the red, so the light stays in it
    for (let k = 0; k < 8; k++) { const d = (R(-1, 1) + R(-1, 1)) * 26, t0 = R(0, .3), t1 = R(.6, .95);
      st('chalk', 'drag', pts(t => [1200 * (t0 + (t1 - t0) * t), d], 18), {w: R(3, 6), c: PAINT.white, a: R(.35, .55), pr: [.5, 1, .8, .3]}); }
    for (const s2 of [-1, 1]) { st('pigment', 'line', pts(t => [1200 * t, s2 * 74 + 2 * Math.sin(t * 5 + s2)], 30), {w: 5, c: PAINT.goldHi, pr: [1, 1, .95, .9, .85, .7, .4]});
      st('pigment', 'line', pts(t => [1200 * t, s2 * 64 + 1.5 * Math.sin(t * 6 - s2)], 30), {w: 2.2, c: PAINT.goldHi, a: .8, pr: [.9, 1, .9, .8, .6, .3]}); }
  }, 'duel');

  cell('dring', [-130, -130, 130, 130], '', (st, {R}) => {
    // a circle warned: one ruled ring of gold and inside it a ring of dry white hairs
    const ring = (r, n = 40) => pts(t => [Math.cos(t * TAU) * r, Math.sin(t * TAU) * r], n);
    st('pigment', 'line', ring(118), {w: 3, c: PAINT.goldHi, pr: [1, .9, 1, .85, 1, .9]});
    for (let k = 0; k < 5; k++) st('chalk', 'drag', ring(R(84, 108)), {w: R(4, 9), c: PAINT.white, a: R(.3, .55), pr: [.4, 1, .7, 1, .5, .9, .3]});
  }, 'duel');

  cell('dfire', [-90, -320, 90, 16], '', (st, {R}) => {
    // a pillar of fire (通天神火柱) with depth: each tongue laid three times, a wide ox-blood root, a cinnabar body, a gold tip
    // running out dry; the tongues apart so the night shows between them; embers flung above
    for (let k = 0; k < 13; k++) { const x0 = R(-42, 42), L = R(150, 300) * (1 - Math.abs(x0) / 90), sw = R(-1, 1) * 34, w = R(9, 18);
      const q = spline([[x0, 0], [x0 + sw * .3, -L * .35], [x0 - sw * .45, -L * .7], [x0 + sw, -L]], 14);
      st('pigment', 'big', part(q, 0, .45), {w: w * 1.5, c: PAINT.redDeep, a: .9, pr: [1, .9, .6, .2]});
      st('pigment', 'big', q, {w, c: PAINT[k % 3 ? 'red' : 'redHot'], a: R(.8, .95), pr: [.8, 1, .8, .5, .2, .03]});
      st('chalk', 'drag', part(q, .55, 1), {w: w * .45, c: PAINT.goldHi, a: .85, pr: [.2, .8, .5, .1]}); }
    for (let k = 0; k < 10; k++) { const x = R(-70, 70), y = R(-320, -200); st('pigment', 'dab', [[x, y], [x + 2, y - 3]], {w: R(3, 6), c: PAINT[k % 2 ? 'goldHi' : 'redHot'], pr: [1, 1]}); }
  }, 'duel');

  for (let v = 0; v < 3; v++) cell(`dflame_${v}`, [-120, -470, 120, 20], '', (st, {R}) => {
    // a pillar of fire for the fall (通天神火柱, the lead's round 2: fire tapers and licks): a narrow root on the ground, a body
    // that swells, then breaks into separate tongues that curl at their tips; cinnabar outside, gold within, a white-gold core
    // low down, ink smoke going up off the tips. Three variants, cross-faded in the renderer so the tongues move
    const n = 8, tongues = [];
    // each tongue an S that leans out from the root, its tip hooked outward; the middle ones tallest, each breaking off at its own height
    for (let k = 0; k < n; k++) { const c = (k + .5) / n * 2 - 1, L = (430 - 180 * Math.abs(c)) * R(.78, 1.08), sw = c * R(36, 58), A = R(10, 22) * (k % 2 ? 1 : -1), ph = R(0, 6), curl = (Math.abs(c) < .2 ? (R(0, 1) > .5 ? 1 : -1) : Math.sign(c)) * R(24, 52), x0 = R(-6, 6);
      tongues.push({L, q: pts(t => [x0 + sw * Math.sin(Math.PI * .5 * Math.min(1, t / .55)) + A * Math.sin(t * Math.PI * 2.2 + ph) * t + curl * t * t * t, -L * t], 22)}); }
    // licks broken off above the body, as fire throws them
    for (let k = 0; k < 2; k++) { const x = R(-40, 40), y = -R(330, 400), l = R(60, 95), cu = R(-1, 1) * 22;
      tongues.push({L: l, lick: true, q: pts(t => [x + cu * t * t + 6 * Math.sin(t * 5), y - l * t], 10)}); }
    // the cinnabar flesh: wide loaded strokes, narrow at the root, swelling, running out to a point at the tip
    for (const {q, lick} of tongues) st('pigment', 'big', q, {w: lick ? R(12, 16) : R(22, 30), c: PAINT.redDeep, a: .9, pr: [.25, .8, 1, .9, .6, .3, .05]});
    for (const {q, lick} of tongues) st('pigment', 'big', q, {w: lick ? R(7, 10) : R(14, 20), c: PAINT[R(0, 1) > .5 ? 'red' : 'redHot'], a: .95, pr: [.25, .85, 1, .85, .55, .25, .03]});
    // dry edges: the brush running out along each tongue's flank, so the fire is ragged, not smooth
    for (const {q, lick} of tongues) if (!lick) for (const d of [-9, 9]) st('chalk', 'drag', part(off(q, d), .1, .9), {w: R(3, 6), c: PAINT[d < 0 ? 'redHot' : 'redDeep'], a: .75, pr: [.2, .8, 1, .6, .2]});
    // gold within the lower body, then the white-gold core low down by the root
    for (const {q, lick} of tongues) if (!lick) st('pigment', 'big', part(q, 0, .62), {w: R(11, 16), c: PAINT.goldHi, a: .9, pr: [.3, .9, 1, .7, .3, .05]});
    st('thick', 'big', pts(t => [4 * Math.sin(t * 6), -135 * t], 10), {w: 28, c: PAINT.white, a: .85, pr: [.5, 1, .8, .45, .15, .02]});
    // dry gold licks at the tips, broken
    for (const {q} of tongues) st('chalk', 'drag', part(q, .7, 1), {w: R(5, 8), c: PAINT.goldHi, a: .8, pr: [.3, .9, .5, .1]});
    // ink smoke curling off the tallest tips, thin
    for (let k = 0; k < 3; k++) { const t0 = tongues[2 + (k % 2)], e = t0.q[t0.q.length - 1], dir = k % 2 ? 1 : -1;
      st('wash', 'big', spline([[e[0], e[1] + 10], [e[0] + dir * R(10, 30), e[1] - R(25, 40)], [e[0] - dir * R(0, 20), e[1] - R(55, 75)], [e[0] + dir * R(15, 40), e[1] - R(85, 110)]], 12), {w: R(18, 30), c: PAINT.inkMid, a: .2, pr: [.1, .6, 1, .6, .2]}); }
    // embers flung up
    for (let k = 0; k < 8; k++) { const x = R(-80, 80), y = R(-440, -250); st('pigment', 'dab', [[x, y], [x + 2, y - 3]], {w: R(3, 6), c: PAINT[k % 2 ? 'goldHi' : 'redHot'], pr: [1, 1]}); }
  }, 'duel');

  cell('ddisc', [-130, -130, 130, 130], '', (st, {R}) => {
    // a circle warned, filled: the hairs of a dry brush laid round and round inside it (飞白), a ruled gold ring at its edge
    for (let k = 0; k < 26; k++) { const r = R(12, 108), a0 = R(0, TAU), sp = R(1.2, 2.6);
      st('chalk', 'drag', pts(t => [Math.cos(a0 + t * sp) * r, Math.sin(a0 + t * sp) * r], 16), {w: R(6, 14), c: PAINT[k % 6 === 2 ? 'bluePale' : 'white'], a: R(.35, .65), pr: [.3, 1, .9, .6, .2]}); }
    st('pigment', 'line', pts(t => [Math.cos(t * TAU) * 118, Math.sin(t * TAU) * 118], 44), {w: 3.4, c: PAINT.goldHi, pr: [1, .9, 1, .85, 1, .9]});
  }, 'duel');

  for (let v = 0; v < 2; v++) cell(`dscorch_${v}`, [-10, -40, 620, 40], 'x', (st, {R}) => {
    // what a strike leaves along its lane: a dark burn with embers in it
    const p = pts(t => [600 * t, R(-4, 4)], 20);
    st('wash', 'big', p, {w: 40, c: PAINT.ink, a: .55, pr: [.3, .9, 1, .8, 1, .6, .2]});
    for (let k = 0; k < 14; k++) { const x = R(30, 570), y = R(-12, 12); st('pigment', 'dab', [[x, y], [x + 3, y]], {w: R(3, 6), c: PAINT[k % 3 ? 'red' : 'goldHi'], pr: [1, 1]}); }
  }, 'duel');

  cell('dpillar', [-100, -540, 100, 24], '', (st, {R}) => {
    // a column of light as the hairs of a brush pulled straight up from the ground: many dry white lines, the longest at the
    // middle, the outer ones short and cool; one loaded core running out toward the top
    for (let k = 0; k < 26; k++) { const d = (R(-1, 1) + R(-1, 1)) * 36, L = 520 * (1 - Math.abs(d) / 90) * R(.55, 1);
      st('chalk', 'drag', pts(t => [d * (1 - t * .25), -L * t], 14), {w: R(4, 10), c: PAINT[Math.abs(d) > 40 ? 'bluePale' : 'white'], a: R(.35, .7), pr: [1, .9, .7, .4, .1]}); }
    st('thick', 'big', pts(t => [R(-2, 2), -480 * t], 14), {w: 26, c: PAINT.white, pr: [1, 1, .8, .5, .2, .03]});
  }, 'duel');

  for (let v = 0; v < 2; v++) cell(`dcrack_${v}`, [-10, -60, 920, 60], 'x', (st, {R}) => {
    const p = [[0, 0]]; for (let i = 1; i <= 12; i++) p.push([i * 75, R(-22, 22)]); const q = jag(p, 3);
    st('scumble', 'drag', q, {w: 34, c: PAINT.bluePale, a: .4, pr: [.3, .8, 1, 1, .8, .3]});
    st('thick', 'big', q, {w: 7, c: PAINT.white, pr: [.5, 1, 1, .9, .6, .2]});
    for (const k of [2, 5, 8, 10]) { const a = p[k], b = [a[0] + R(-20, 40), a[1] + R(-50, 50)]; st('chalk', 'drag', jag([a, b], 3), {w: 4, c: PAINT.white, a: .85, pr: [1, .2]}); }
  }, 'duel');

  cell('dseal', [-270, -270, 270, 270], '', (st, {R}) => {
    const ring = (r, n = 48) => pts(t => [Math.cos(t * TAU) * r, Math.sin(t * TAU) * r], n);
    st('pigment', 'line', ring(240), {w: 4, c: PAINT.goldHi, pr: [1, .9, 1, .8, 1, .9]});
    st('chalk', 'drag', ring(196), {w: 10, c: PAINT.gold, a: .7, pr: [.8, .4, 1, .6, .9, .3, .8]});
    // eight thunder spirals between the rings (the 雷 of seal script: coils of cloud)
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, cx = Math.cos(a) * 218, cy = Math.sin(a) * 218;
      st('pigment', 'line', pts(t => [cx + Math.cos(a + t * TAU * 1.6) * 14 * (1 - t * .7), cy + Math.sin(a + t * TAU * 1.6) * 14 * (1 - t * .7)], 14), {w: 2.4, c: PAINT.goldHi, pr: [1, 1, .6]}); }
  }, 'duel');

  for (let v = 0; v < 2; v++) cell(`dwhip_${v}`, [-20, -180, 1120, 180], 'x', (st, {R}) => {
    const p = pts(t => [1080 * t, (v ? -1 : 1) * 130 * Math.sin(t * Math.PI) * (1 - t * .3)], 30);
    // the trail it leaves in the air: a wide dry white behind the whip, gone thin toward its start
    st('scumble', 'drag', p, {w: 120, c: PAINT.white, a: .3, pr: [.05, .2, .4, .6, .8, 1, 1]});
    // the whip: gold leaf, its jointed segments pressed one by one, a white hair along it
    st('chalk', 'drag', part(p, .35, 1), {w: 26, c: PAINT.goldHi, a: .95, pr: [.4, .8, 1, 1, .9]});
    for (let k = 0; k < 7; k++) { const q = part(p, .4 + k * .085, .44 + k * .085); st('pigment', 'big', q, {w: 22, c: PAINT.gold, pr: [1, .6]}); }
    st('pigment', 'line', off(part(p, .4, 1), -8), {w: 2, c: PAINT.white, pr: [.3, 1, 1, .6]});
  }, 'duel');

}
