// node world/src/board/baked/peony.gen.mjs [look|bake] [--scale n]
//
// A peony for the board: one open bloom, and a long branch of leaves with a bud that runs to the left under the
// row of buttons. Painted with PaintSim on bare ground, so that only the paint is kept (see kit.mjs).
//
// Both parts are laid out in one space (units; the bloom is about 210 across) and painted on two pages:
//   bloom   page origin (900, 0),   260 x 270
//   branch  page origin (0, 255),   960 x 90
// The stem runs through both, so the two pictures meet exactly when they are placed by their origins.
import {join} from 'node:path';
import {P, dir, chance, palette, preview, bake, writeBaked, spline, arc, clamp, smooth, fbm, strokeAt, prof} from './kit.mjs';

const MIX = {
  // the whites of the bloom, from the thick lights down into blue shadow
  'hi': {mix: {'titanium white': 10, 'naples yellow': .45}},
  'cream': {mix: {'titanium white': 6, 'naples yellow': .9, 'yellow ochre': .05}},
  'pale': {mix: {'titanium white': 6, 'cobalt blue': .45, 'cerulean': .25, 'naples yellow': .15}},
  'shade': {mix: {'titanium white': 3, 'cobalt blue': 1, 'ultramarine': .35, 'dioxazine violet': .12}},
  'dusk': {mix: {'ultramarine': 1, 'cobalt blue': .8, 'dioxazine violet': .25, 'titanium white': 2.2, 'raw umber': .08}},
  'deep': {mix: {'ultramarine': 1, 'cobalt blue': .5, 'dioxazine violet': .22, 'titanium white': .75, 'raw umber': .06}},
  'night': {mix: {'ultramarine': 1, 'dioxazine violet': .45, 'prussian blue': .15, 'titanium white': .2}},
  'violet': {mix: {'dioxazine violet': 1, 'ultramarine': .5, 'titanium white': .7}},
  'turq': {mix: {'viridian': 1, 'cerulean': 1.6, 'titanium white': 1.2}},
  'turq deep': {mix: {'viridian': 1, 'prussian blue': .5, 'cerulean': .6, 'titanium white': .15}},
  // the heart
  'gold': {mix: {'cadmium yellow': 1, 'yellow ochre': 1.2, 'naples yellow': .6}},
  'gold deep': {mix: {'yellow ochre': 1.5, 'raw sienna': .8, 'burnt sienna': .2}},
  'gold hi': {mix: {'naples yellow': 2, 'cadmium yellow': .6, 'titanium white': 1.5}},
  // leaves
  'leaf night': {mix: {'viridian': 1, 'prussian blue': .55, 'burnt umber': .35}},
  'leaf deep': {mix: {'viridian': 1.3, 'prussian blue': .3, 'sap green': .3, 'burnt umber': .12}},
  'leaf': {mix: {'viridian': 1.4, 'sap green': .5, 'ultramarine': .12, 'titanium white': .18}},
  'leaf lit': {mix: {'viridian': 1.1, 'sap green': .5, 'cerulean': .25, 'titanium white': .9, 'naples yellow': .2}},
  'leaf sheen': {mix: {'titanium white': 2.2, 'viridian': .55, 'cerulean': .35, 'naples yellow': .15}},
  'wood': {mix: {'burnt umber': 1, 'raw sienna': .45, 'viridian': .3, 'titanium white': .3}},
  'wood lit': {mix: {'raw sienna': 1, 'naples yellow': .7, 'titanium white': .7, 'viridian': .15}},
  'stem': {mix: {'viridian': 1, 'sap green': .7, 'burnt umber': .5, 'titanium white': .12}},
  'stem lit': {mix: {'sap green': 1, 'viridian': .6, 'naples yellow': .5, 'titanium white': .5}},
};
const {C, lerp3, ramp} = palette(MIX);
const WHITES = ['deep', 'dusk', 'shade', 'pale', 'cream', 'hi'];
const LEAVES = ['leaf night', 'leaf deep', 'leaf', 'leaf lit', 'leaf sheen'];

const define = {
  pigments: MIX,
  materials: {
    'under': {base: 'oil', note: 'thin first colour under a petal or a leaf', body: .35, opacity: .97, ridges: .15, gloss: .12, reach: 0, merge: 0, pickup: 0, open: .5, bury: .4, dry: .15},
    'petal': {base: 'oil', note: 'thick flower paint, worked into itself', body: 1.15, ridges: .14, grain: .05, gloss: .3, reach: 0, merge: .16, pickup: .02, bury: .7, dry: .2},
    'clean': {base: 'oil', note: 'a clean loaded brush: lies on top', body: 1, gloss: .3, reach: 0, merge: 0, pickup: 0, bury: .8, dry: .2},
    'impasto': {base: 'oil', note: 'thick creamy lights, put down and left', body: 1.8, ridges: .2, grain: .04, gloss: .38, sharp: .5, reach: 0, merge: 0, pickup: 0, bury: .95, dry: .18},
    'leafy': {base: 'oil', note: 'leaf greens with a little more oil', body: .95, ridges: .22, grain: .04, gloss: .32, sharp: .45, reach: 0, merge: .18, pickup: .02, dry: .2},
    'glaze': {base: 'oil glaze', note: 'transparent shadow over dry paint', opacity: .4},
    'seed': {base: 'oil', note: 'stiff gold-coloured paint for the stamens', body: 1.9, ridges: .1, gloss: .5, sharp: .6, reach: 0, merge: 0, pickup: 0, bury: 1, dry: .1, metal: .35},
  },
  brushes: {
    'petal': {base: 'filbert', note: 'one touch, one part of a petal', clump: 2.6, streak: .9, wobble: .6, var: .2},
    'leafb': {base: 'filbert', note: 'a worn filbert for leaves: streaky, the hairs parting', clump: 3.4, streak: 1.5, wobble: .9, var: .32, vary: .08},
    'broad': {base: 'filbert', note: 'a big filbert', clump: 3, wobble: .9, var: .2, vary: .06},
    'flatp': {base: 'flat', note: 'a small flat for crisp planes', width: 12, rag: 2.5, wobble: .4, taper: .35},
    'point': {base: 'round', note: 'the point of a round', profile: 'taper', wobble: .35},
    'comma': {base: 'round', profile: 'comma', wobble: .3},
    'drag': {base: 'filbert', note: 'a nearly dry filbert dragged over the ridges', dry: .7, charge: .55, streak: 1.5, wobble: .8},
  },
};

/* ---------- geometry of the whole ---------- */
const BX = 1028, BY = 130, RB = 100;                        // the bloom: centre and outer radius
const LV = (() => { const v = [-.6, -.62, .5], l = Math.hypot(...v); return v.map(c => c / l) })();   // light from the upper left
// the stem, from under the bloom down and away to the left, ending in a twig
const STEM = spline([[1012, 196], [996, 232], [962, 268], [912, 302], [846, 317], [760, 314], [660, 317], [560, 313], [450, 318], [340, 313], [230, 318], [130, 314], [56, 319]], 14);
const stemAt = t => { const f = clamp(t, 0, 1) * (STEM.length - 1), i = Math.min(STEM.length - 2, Math.floor(f)), k = f - i, a = STEM[i], b = STEM[i + 1]; return {x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0])} };

/* =====================================================================
   THE BLOOM
   Each petal is a cup seen from outside, as in paintings/peonies.gen.mjs of PaintSim: a broad touch ALONG the edge of
   the flower in the petal's own shade (its hollow), and its lit rim laid along the outer edge. Never a stroke that
   runs from the heart outward: those make pleats, not petals.
   ===================================================================== */
const HEART = [BX - 7, BY - 12], NOTCH = 4.03;   // NOTCH: the angle of the gap that the second look closes
const PR = [[.35, .8, 1, 1, .85, .5], [.5, 1, 1, .9, .6, .3], [.3, .7, 1, 1, .9, .6, .35], [.6, 1, .95, .8, .45]];
function mk(s, ox, oy) {
  const T = pts => pts.map(p => [p[0] - ox, p[1] - oy]);
  const st = (material, brush, path, o = {}) => { if (!path || path.length < 2) return; const c = {material, brush, path: T(path)};
    if (o.w !== undefined) c.width = o.w; if (o.c !== undefined) c.color = C(o.c); if (o.c2 !== undefined) c.color2 = C(o.c2); if (o.a !== undefined) c.opacity = o.a;
    if (o.pr !== undefined) c.pressure = o.pr; if (o.grad) c.grad = o.grad; if (o.tone2) c.tone2 = o.tone2; if (o.wob !== undefined) c.wobble = o.wob; s.paint(c) };
  const fl = (material, poly, o = {}) => { const c = {material, shape: T(poly)}; if (o.c !== undefined) c.color = C(o.c); if (o.a !== undefined) c.opacity = o.a; if (o.soft !== undefined) c.soft = o.soft; s.fill(c) };
  const dot = (material, x, y, r, o = {}) => { const c = {material, at: [x - ox, y - oy], r}; if (o.c !== undefined) c.color = C(o.c); if (o.dome !== undefined) c.dome = o.dome; if (o.a !== undefined) c.opacity = o.a; s.dot(c) };
  return {st, fl, dot};
}
// lightness on the bloom: a dome lit from the upper left; light and shadow kept apart, as a painter groups them
function bloomLight(x, y) {
  const dx = (x - BX) / RB, dy = (y - BY) / RB, d2 = Math.min(1, dx * dx + dy * dy), nz = Math.sqrt(Math.max(.05, 1 - d2)), l = Math.hypot(dx, dy, nz);
  let L = .1 + Math.max(0, ((dx * LV[0] + dy * LV[1] + nz * LV[2]) / l + .42) / 1.3);
  L -= .16 * smooth((Math.sqrt(d2) - .7) / .3) * smooth(dy / .5);
  L = clamp(L + (fbm(x / 22 + 7, y / 22, 3) - .5) * .22, 0, 1);
  return .12 + .88 * (.45 * L + .55 * smooth((L - .2) / .6));
}
function paintBloom(s, ox, oy, rs) {
  const {rnd, R, pick} = rs, {st, fl, dot} = mk(s, ox, oy);
  // a point of the flower: angle th, at fraction f of the radius, about a centre that slides toward the heart as f falls
  const cen = f => [BX + (HEART[0] - BX) * (1 - f), BY + (HEART[1] - BY) * (1 - f)];
  const pt = (th, f, f0 = f) => { const c = cen(f0); return [c[0] + Math.cos(th) * RB * f, c[1] + Math.sin(th) * RB * f * .95] };
  const ell = (a0, a1, f, n = 6, bulge = 0, f0 = f) => { const p = []; for (let i = 0; i <= n; i++) { const t = i / n; p.push(pt(a0 + (a1 - a0) * t, f * (1 + bulge * Math.sin(Math.PI * t)), f0)) } return p };

  // under everything: a soft mass in middle shade, with patches of light and shade, so that no ground shows between petals
  fl('under', spline(Array.from({length: 11}, (_, i) => pt(i * .571, R(.82, .9), 1)), 5, true), {c: ramp(WHITES, .46), soft: 3});
  for (let i = 0; i < 30; i++) { const th = R(0, 6.283), f = .74 * Math.sqrt(rnd()), m = pt(th, f, 1), L = bloomLight(m[0], m[1]) + R(-.12, .12);
    st('petal', 'broad', strokeAt(m[0], m[1], th + 1.57 + R(-1, 1), RB * R(.3, .5), R(-.6, .6), 3), {w: RB * R(.2, .32), c: lerp3(ramp(WHITES, L * .8 - .05), pick(['turq', 'violet', 'pale', 'shade']), R(0, .25)), c2: ramp(WHITES, L * .8 + .08), grad: -1, a: .95, pr: pick(PR)}) }

  // the petals: a few big guards round the outside, then the mound, smaller toward the heart
  const petals = [];
  const nG = 7, off = R(0, 6.283);
  for (let i = 0; i < nG; i++) petals.push({tier: 0, th: off + i * 6.283 / nG + R(-.16, .16), f: R(.86, 1.0), span: 6.283 / nG * R(1.02, 1.3), w: R(.3, .36)});
  for (let i = 0; i < 9; i++) petals.push({tier: 1, th: off + .4 + i * 6.283 / 9 + R(-.22, .22), f: R(.56, .72), span: R(.8, 1.1), w: R(.22, .28)});
  for (let i = 0; i < 8; i++) petals.push({tier: 2, th: off + 1 + i * 6.283 / 8 + R(-.3, .3), f: R(.3, .46), span: R(.95, 1.35), w: R(.16, .2)});
  for (let i = 0; i < 6; i++) petals.push({tier: 3, th: R(0, 6.283), f: R(.15, .23), span: R(1.2, 1.8), w: R(.09, .12)});
  petals.sort((a, b) => b.f - a.f);
  for (const q of petals) { const m = pt(q.th, q.f); q.L = clamp(bloomLight(m[0], m[1]) + R(-.1, .1) - .22 * smooth((.34 - q.f) / .24), 0, 1) }

  let lastTier = 0;
  for (const q of petals) {
    if (q.tier !== lastTier) { lastTier = q.tier }
    const a0 = q.th - q.span * .46, a1 = q.th + q.span * .46, inner = clamp(q.L - .24 - (q.tier ? .04 : 0), 0, 1), lift = q.L < .5 ? .26 : .04, tint = q.L < .55 ? pick(['turq', 'violet', 'pale', 'pale', 'cream']) : 'cream', tk = q.L < .55 ? R(.08, .3) : 0;
    // the shadow this petal throws on what lies under it, on the side away from the light
    if (q.tier > 0 && q.tier < 3) { const sh = ell(a0 + .1, a1 - .1, q.f * 1.07, 5, .05, q.f).map(p => [p[0] + 2.2, p[1] + 2.8]);
      st('petal', 'petal', sh, {w: RB * q.w * .5, c: lerp3(ramp(WHITES, clamp(q.L * .42 - .1, 0, .5)), pick(['violet', 'night', 'turq deep']), R(.1, .35)), a: R(.6, .85), pr: pick(PR)}) }
    // the hollow of the cup
    st('petal', rnd() < .7 ? 'petal' : 'broad', ell(a0, a1, q.f * .88, 6, R(.03, .09), q.f), {w: RB * q.w * R(.92, 1.1), c: lerp3(ramp(WHITES, inner * .8 + R(-.07, .04)), pick(['violet', 'turq', 'dusk', 'shade']), q.L < .55 ? R(.05, .28) : R(0, .08)), c2: ramp(WHITES, inner * .8 + R(.07, .18)), grad: -1, a: .97, pr: pick(PR)});
    // the rim: on a guard petal broken by a notch, so two touches that do not quite meet
    const rw = RB * q.w * R(.36, .48), cR = lerp3(ramp(WHITES, q.L * .9 + lift), tint, tk), cR2 = lerp3(ramp(WHITES, Math.min(.97, q.L * .95 + .12 + lift)), tint, tk * .5);
    if (q.tier === 0) { const cut = R(-.12, .14) * q.span, g = q.span * R(.025, .05), b1 = R(.07, .13), b2 = R(.06, .12);
      st('petal', rnd() < .5 ? 'petal' : 'flatp', ell(a0 + q.span * .05, q.th + cut - g, q.f * R(.99, 1.03), 5, b1), {w: rw, c: cR, c2: cR2, grad: -1, a: .97, pr: pick(PR)});
      st('petal', rnd() < .5 ? 'petal' : 'flatp', ell(q.th + cut + g, a1 - q.span * .05, q.f * R(.97, 1.02), 5, b2), {w: rw * R(.85, 1.1), c: lerp3(cR, cR2, R(0, .6)), c2: cR2, grad: -1, a: .97, pr: pick(PR)});
      q.path = ell(a0 + q.span * .1, q.th + cut - g, q.f * 1.0, 4, b1) }
    else { const p = ell(a0 + q.span * .07, a1 - q.span * .07, q.f * 1.0, 5, R(.05, .13)); st('petal', rnd() < .45 ? 'flatp' : 'petal', p, {w: rw, c: cR, c2: cR2, grad: -1, a: .97, pr: pick(PR)}); q.path = p }
    q.rw = rw;
  }

  // where one guard petal tucks under the next: a short dark curved crease; in shade the rim catches a cool reflected light
  for (const q of petals) { if (q.tier > 0) continue;
    { const e = rnd() < .5 ? -.48 : .48, th = q.th + e * q.span, a = pt(th, q.f * .98, q.f), b = pt(th - e * .16, q.f * R(.7, .78), q.f), m = pt(th - e * .03, q.f * .86, q.f);
      st('clean', 'comma', [a, m, b], {w: RB * R(.03, .045), c: lerp3('dusk', pick(['violet', 'turq deep', 'night']), R(.3, .6)), a: R(.4, .7) * (q.L > .6 ? .55 : 1)}) }
    if (q.L < .5 && rnd() < .6) st('clean', 'drag', ell(q.th - q.span * .3, q.th + q.span * .25, q.f * 1.01, 5, .08), {w: RB * R(.025, .04), c: lerp3('pale', 'turq', R(.1, .45)), a: R(.55, .8)}) }
  // the deepest pockets: few, small, dark, tucked under the rims of the inner petals on the side away from the light
  for (const q of petals) { if (q.tier < 2 || rnd() < .35) continue; const sgn = 1, p = ell(q.th - q.span * .25, q.th + q.span * .25, q.f * 1.12, 4, .04, q.f).map(v => [v[0] + 1.2, v[1] + 1.6]);
    st('clean', 'comma', p, {w: RB * R(.03, .05), c: lerp3(pick(['violet', 'turq deep', 'night']), 'dusk', R(.15, .5)), a: R(.4, .75)}) }
  // the outline broken by petal tips that run a little past the edge
  for (let i = 0; i < 5; i++) { const th = R(2.2, 6.6), span = R(.32, .5), p = ell(th - span / 2, th + span / 2, R(.96, 1.04), 4, R(.06, .12)), m = p[2], L = bloomLight(m[0], m[1]);
    st('petal', rnd() < .5 ? 'petal' : 'flatp', p, {w: RB * R(.1, .17), c: ramp(WHITES, L * .85 + .02), c2: ramp(WHITES, Math.min(.97, L * .9 + .14)), grad: -1, a: .95, pr: pick(PR)}) }

  // the heart: a small dark hollow, and a broken ring of stiff gold touches round three green carpels
  const [hx, hy] = HEART;
  for (let i = 0; i < 6; i++) { const a = R(0, 6.283); st('clean', 'comma', strokeAt(hx + Math.cos(a) * RB * .05, hy + Math.sin(a) * RB * .045, a + 1.57, RB * R(.1, .15), R(-.9, .9), 4), {w: RB * R(.05, .07), c: lerp3('night', pick(['turq deep', 'violet']), R(.3, .7)), a: .9}) }
  s.dry(1, true);
  for (let i = 0; i < 22; i++) { if (rnd() < .22) continue; const a = i * .286 + R(-.14, .14), rr = RB * R(.045, .11), x = hx + Math.cos(a) * rr, y = hy + Math.sin(a) * rr * .9;
    const lit = clamp(.5 - (Math.cos(a) * LV[0] + Math.sin(a) * LV[1]) * .5 + R(-.2, .2), 0, 1);
    st('seed', 'comma', strokeAt(x, y, a + R(-.6, .6), RB * R(.035, .06), R(-.6, .6), 3), {w: RB * R(.022, .034), c: lerp3('gold deep', 'gold', lit), c2: lerp3('gold', 'gold hi', lit), a: .97}) }
  for (let i = 0; i < 5; i++) { const a = R(0, 6.283), rr = RB * R(.03, .1); dot('seed', hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * .9, RB * R(.011, .018), {c: rnd() < .6 ? 'gold hi' : 'gold', dome: .6}) }
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + .4; dot('clean', hx + Math.cos(a) * RB * .022, hy + Math.sin(a) * RB * .02, RB * .017, {c: lerp3('leaf lit', 'turq', .4), dome: .5}) }

  // thick lights, last and left alone, on the rims that face the light
  for (const q of petals) { if (!q.path || q.L < .66 || rnd() < .28) continue; const p = rnd() < .5 ? q.path.slice(0, 4) : q.path.slice(1);
    st('impasto', rnd() < .3 ? 'flatp' : 'petal', p, {w: q.rw * R(.45, .75), c: ramp(WHITES, Math.min(1, q.L * .6 + .44)), c2: 'hi', grad: rnd() < .5 ? 1 : -1, a: .97, pr: rnd() < .5 ? 'comma' : 'leaf'}) }
  // a second look, with its own chance so that nothing above moves
  { const c2 = chance(515), R2 = c2.R, P2 = c2.pick;
    // the guard petal at the upper left did not close on its neighbour and the ground showed: one more petal there
    st('petal', 'broad', ell(NOTCH - .34, NOTCH + .34, .84, 6, .06, .95), {w: RB * .27, c: ramp(WHITES, .72), c2: ramp(WHITES, .85), grad: -1, a: .97, pr: PR[0]});
    st('petal', 'petal', ell(NOTCH - .3, NOTCH + .28, .96, 5, .09, .95), {w: RB * .13, c: ramp(WHITES, .86), c2: 'hi', grad: -1, a: .97, pr: PR[2]});
    st('impasto', 'petal', ell(NOTCH - .2, NOTCH + .12, .97, 4, .09, .95), {w: RB * .07, c: 'hi', a: .96, pr: 'comma'});
    // violet and turquoise in the shadow half, tucked just outside the rims of the petals that are turned from the light
    let n = 0; for (const q of petals) { if (q.L > .5 || q.tier > 2 || !q.path || c2.rnd() < .4 || n >= 10) continue; n++;
      const p = q.path.slice(1, 5).map(v => { const dx = v[0] - HEART[0], dy = v[1] - HEART[1], l = Math.hypot(dx, dy) || 1, k = q.rw * .62; return [v[0] + dx / l * k + 1, v[1] + dy / l * k + 1.5] });
      st('clean', 'comma', p, {w: RB * R2(.03, .05), c: lerp3(P2(['violet', 'turq', 'turq deep', 'violet', 'turq']), 'dusk', R2(0, .25)), a: R2(.6, .88)}) }
    // and two thick cream lights on the rims that face the lamp
    for (const q of petals.filter(q => q.tier === 0 && q.path).sort((a, b) => b.L - a.L).slice(0, 2)) st('impasto', 'petal', q.path.slice(0, 4), {w: q.rw * .7, c: 'cream', c2: 'hi', grad: -.8, a: .97, pr: PR[1]}) }
}

/* =====================================================================
   THE STEM, THE LEAVES, THE BUD
   ===================================================================== */
function paintBranch(s, ox, oy, rs, part) {
  const {rnd, R, pick} = rs, {st, fl} = mk(s, ox, oy);
  const LEAFPR = prof(t => Math.pow(Math.sin(Math.PI * Math.pow(t, .62)), .85));
  // one leaflet, folded along a curved midrib: two halves, the one turned to the light lighter; long, with a drawn-out point
  function leaflet(x, y, ang, len, wid, lit, bend = R(-.5, .5)) {
    const kind = rnd();
    if (kind < .16) { st('leafy', 'petal', arc(x, y, ang, len * R(.75, 1), bend, 6), {w: wid * R(.24, .34), c: ramp(LEAVES, lit * .5), c2: ramp(LEAVES, lit * .6 + .2), grad: 1, a: .97, pr: LEAFPR}); return }   // seen edge on
    if (kind < .3) { len *= R(.6, .78); wid *= R(1.05, 1.2) }                                                                                              // foreshortened
    const p = arc(x, y, ang, len, bend, 7), nx0 = -Math.sin(ang + bend / 2), ny0 = Math.cos(ang + bend / 2), up = (nx0 * LV[0] + ny0 * LV[1]) > 0 ? 1 : -1;
    const half = (sd, k) => p.map((v, i) => { const t = i / (p.length - 1), a = ang + bend * t, e = Math.sin(Math.PI * Math.pow(t, .7)) * wid * .24 * k; return [v[0] - Math.sin(a) * sd * e, v[1] + Math.cos(a) * sd * e] });
    const fold = R(.1, .5), cD = ramp(LEAVES, clamp(lit * .6, 0, 1)), cL = ramp(LEAVES, clamp(lit * .62 + .12 + fold * .35, 0, 1));
    st('leafy', 'leafb', half(-up, 1), {w: wid * .6, c: lerp3(cD, 'leaf night', R(.15, .45)), c2: cD, grad: up * .4, a: .97, pr: LEAFPR});
    st('leafy', 'leafb', half(up, 1), {w: wid * .55, c: lerp3(cD, cL, .5), c2: cL, grad: -up * .6, a: .97, pr: LEAFPR});
    // broken colour laid into the wet: a bluer touch in the dark half, a mineral green one in the light half, neither running the whole length
    if (rnd() < .8) st('leafy', 'drag', half(-up, R(.9, 1.5)).slice(1, 4 + Math.floor(rnd() * 2)), {w: wid * R(.16, .26), c: lerp3('leaf night', pick(['turq deep', 'leaf', 'leaf deep']), R(.3, .6)), a: R(.6, .85)});
    if (rnd() < .8) st('leafy', 'drag', half(up, R(1.1, 1.7)).slice(2 + Math.floor(rnd() * 2), 7), {w: wid * R(.14, .24), c: lerp3(cL, pick(['leaf lit', 'turq', 'leaf sheen']), R(.3, .7)), a: R(.6, .85)});
    if (rnd() < .7) st('clean', 'point', p.slice(0, 6), {w: Math.max(1, wid * .06), c: lerp3('leaf night', 'leaf deep', R(0, .5)), a: R(.4, .7)});
    if (lit > .55 && rnd() < .6) st('impasto', 'comma', half(up, .9).slice(1, 4), {w: wid * R(.1, .16), c: lerp3('leaf lit', 'leaf sheen', R(.4, .9)), a: R(.7, .9)});
  }
  // the stem: one drawn line that thins as it goes, darker below, with a broken light along its upper side
  const n = STEM.length, cut = Math.round(n * .46);
  st('leafy', 'point', STEM.slice(0, cut + 2), {w: 8, c: lerp3('stem', 'leaf night', .35), c2: 'stem', grad: .5, a: .97, pr: [1, .96, .9, .82, .74, .68, .62]});
  st('leafy', 'point', STEM.slice(cut), {w: 5, c: lerp3('stem', 'leaf night', .25), c2: 'stem', grad: .5, a: .97, pr: [1, .92, .82, .7, .58, .46, .3]});
  for (let i = 3; i < n - 8; i += 6 + Math.floor(rnd() * 9)) { const len = 5 + Math.floor(rnd() * 9), t = i / n, seg = STEM.slice(i, i + len).map(p => [p[0] - .7, p[1] - 1.2 * (1 - t) - .4]);
    st('clean', 'point', seg, {w: 2.6 * (1 - t) + .9, c: lerp3('stem lit', 'leaf sheen', R(0, .45)), a: R(.55, .8)}) }
  if (part === 'bloom') {   // two leaves under the bloom, mostly hidden by it: the dark that sets the flower off
    leaflet(BX - 20, BY + 74, 2.5, 74, 30, .35, -.4); leaflet(BX + 22, BY + 76, .55, 66, 28, .2, .45); leaflet(BX - 6, BY + 84, 1.9, 50, 22, .3, .3); return }
}

/* =====================================================================
   THE BRANCH UNDER THE BUTTONS
   A band 960 x 90: the stem comes down from the bloom at the right and runs left, heavy and a little woody at first,
   thinning to a twig. Few leaves, large, at uneven distances; each a peony leaf of three leaflets joined at the base, the
   end one often with a lobe. The top 28 units are kept free left of x = 640, where the buttons hang.
   ===================================================================== */
function paintBand(s, ox, oy) {
  const {rnd, R, pick} = chance(8831), {st, fl, dot} = mk(s, ox, oy);
  const TOP = x => oy + (x < 652 ? 32 : 5), BOT = oy + 86;
  const LPR = prof(t => Math.pow(Math.sin(Math.PI * Math.pow(t, .58)), .8));
  const at = x => { let b = 0, bd = 1e9; STEM.forEach((p, i) => { if (p[1] > 290 && Math.abs(p[0] - x) < bd) { bd = Math.abs(p[0] - x); b = i } }); const a = STEM[Math.max(0, b - 2)], c = STEM[Math.min(STEM.length - 1, b + 2)]; return {x: STEM[b][0], y: STEM[b][1], ang: Math.atan2(c[1] - a[1], c[0] - a[0]), i: b} };
  // how long a leaflet may be in a direction before it leaves the band
  const fit = (x, y, a, l, wid) => { const sy = Math.sin(a), m = wid * .3 + 2; return sy < -.04 ? Math.min(l, Math.max(0, y - TOP(x + Math.cos(a) * l * .6) - m) / -sy) : sy > .04 ? Math.min(l, Math.max(0, BOT - y - m) / sy) : l };

  // one leaflet: two curved loaded strokes that meet along the midrib, the one turned to the light lighter; a light midrib; sometimes a lobe
  function leaflet(x, y, a, len, lit, bend, lobe) {
    let wid = len * R(.2, .27); const l = Math.min(fit(x, y, a, len, wid), fit(x, y, a + bend * .7, len, wid)); if (l < 15) return; wid = Math.max(Math.min(wid, l * .36), l * .22);
    const p = arc(x, y, a, l, bend, 7), up = (-Math.sin(a + bend / 2) * LV[0] + Math.cos(a + bend / 2) * LV[1]) > 0 ? 1 : -1;
    const half = (sd, k) => p.map((v, i) => { const t = i / (p.length - 1), aa = a + bend * t, e = Math.sin(Math.PI * Math.pow(t, .66)) * wid * .25 * k; return [v[0] - Math.sin(aa) * sd * e, v[1] + Math.cos(aa) * sd * e] });
    if (lobe) leaflet(p[2][0], p[2][1], a + bend * .3 + lobe * R(.5, .75), l * R(.42, .55), lit - .08, -lobe * R(.1, .4), 0);
    const cD = ramp(LEAVES, clamp(lit * .58, 0, 1)), cL = ramp(LEAVES, clamp(lit * .62 + .14 + R(.03, .16), 0, 1));
    st('leafy', 'leafb', half(-up, 1), {w: wid * .62, c: lerp3(cD, 'leaf night', R(.15, .45)), c2: cD, grad: up * .4, a: .97, pr: LPR});
    st('leafy', 'leafb', half(up, 1), {w: wid * .58, c: lerp3(cD, cL, .5), c2: cL, grad: -up * .6, a: .97, pr: LPR});
    if (rnd() < .8) st('leafy', 'drag', half(-up, R(.9, 1.5)).slice(1, 4 + Math.floor(rnd() * 2)), {w: wid * R(.16, .26), c: lerp3('leaf night', pick(['turq deep', 'leaf', 'leaf deep']), R(.3, .6)), a: R(.6, .85)});
    if (rnd() < .8) st('leafy', 'drag', half(up, R(1.1, 1.7)).slice(2 + Math.floor(rnd() * 2), 7), {w: wid * R(.14, .24), c: lerp3(cL, pick(['leaf lit', 'turq', 'leaf sheen']), R(.3, .7)), a: R(.6, .85)});
    st('clean', 'point', p.slice(0, 6), {w: Math.max(1.1, wid * .055), c: lerp3('leaf lit', 'leaf sheen', R(.2, .8)), a: R(.5, .8)});   // the light midrib
    if (lit > .55 && rnd() < .6) st('impasto', 'comma', half(up, .9).slice(1, 4), {w: wid * R(.1, .16), c: lerp3('leaf lit', 'leaf sheen', R(.4, .9)), a: R(.7, .9)});
  }
  // a peony leaf at x: side +1 above the stem, -1 below; lean is its angle off the stem; a drooping one curls downward
  function leaf(x, side, len, lit, lean, droop) {
    const g = at(x), axis = g.ang + side * lean, pet = len * R(.2, .34), bx = g.x + Math.cos(axis) * pet, by = g.y + Math.sin(axis) * pet;
    st('leafy', 'point', [[g.x, g.y], [(g.x + bx) / 2, (g.y + by) / 2 + R(-1, 1)], [bx, by]], {w: 3.4, c: 'stem', c2: 'stem lit', grad: .5, a: .96, pr: [1, .9, .8]});
    const flat = a => droop ? R(.3, .65) * -1 : (g.ang - a) * R(.25, .6);
    const parts = [[axis + R(.62, .98), R(.5, .7), 0], [axis - R(.62, .98), R(.5, .7), 0], [axis + R(-.1, .1), 1, rnd() < .65 ? pick([-1, 1]) : 0]];
    for (const [a, k, lobe] of parts) leaflet(bx, by, a, len * k * R(.93, 1.07), clamp(lit + R(-.16, .16), 0, 1), flat(a), lobe);
  }

  // the leaves that lie behind the stem first
  leaf(852, -1, 60, .38, .7, true);     // one cluster drooping
  leaf(548, 1, 86, .82, .3);
  leaf(262, -1, 54, .42, .5);
  // the stem: one drawn line, thick then thin, with a second, woody colour dragged over its first third
  const run = STEM.filter(p => p[1] > 262);
  st('leafy', 'point', run, {w: 8.4, c: lerp3('stem', 'leaf night', .35), c2: 'stem', grad: .5, a: .97, pr: [1, .95, .8, .9, .82, .7, .76, .62, .5, .42, .3, .16]});
  st('leafy', 'drag', run.slice(0, Math.round(run.length * .3)), {w: 6.4, c: 'wood', c2: 'wood lit', grad: .6, a: .85, pr: [1, .9, .9, .7, .5, .2]});
  for (let i = 2; i < run.length - 8; i += 5 + Math.floor(rnd() * 9)) { const n = 4 + Math.floor(rnd() * 8), t = i / run.length, seg = run.slice(i, i + n).map(p => [p[0] - .6, p[1] - 1.7 * (1 - t) - .5]);
    st('clean', 'point', seg, {w: 2.8 * (1 - t) + .9, c: lerp3(t < .3 ? 'wood lit' : 'stem lit', 'leaf sheen', R(0, .45)), a: R(.55, .8)}) }
  for (const x of [925, 880, 822]) { const g = at(x); st('clean', 'comma', strokeAt(g.x, g.y + 1, g.ang + 1.2, 7, .6, 3), {w: 1.6, c: lerp3('wood', 'leaf night', .5), a: .7}) }   // scars on the old wood
  // the leaves in front of the stem, at uneven distances, some lying over it
  leaf(898, 1, 84, .8, .75);
  leaf(772, 1, 60, .75, .5);
  leaf(655, -1, 78, .45, .22);
  leaf(500, -1, 52, .4, .6);
  leaf(372, 1, 70, .8, .2);
  leaf(235, 1, 48, .75, .42);
  leaf(150, -1, 40, .5, .4);
  { const g = at(60); leaflet(g.x, g.y, g.ang + .22, 30, .7, -.3, 0); leaflet(g.x + 3, g.y, g.ang - .24, 24, .5, .3, 0) }
  // the bud, half open, on a strong pedicel where the top of the band is free: petals wrapped like brackets, the left ones in light
  { const g = at(716), r = 15, ax = -2.2, bx = g.x - 15, by = g.y - 31, ux = Math.cos(ax), uy = Math.sin(ax), vx = -uy, vy = ux;
    const B = (u, v) => [bx + ux * u * r + vx * v * r, by + uy * u * r + vy * v * r];
    st('leafy', 'point', [[g.x, g.y], [g.x - 1, g.y - 9], B(-1.3, -.1), B(-.95, 0)], {w: 5, c: 'stem', c2: 'stem lit', grad: .5, a: .97, pr: [1, .95, .9, .85]});
    fl('under', spline([B(-.9, 0), B(-.5, .62), B(.2, .7), B(.85, .3), B(1, 0), B(.8, -.34), B(.2, -.7), B(-.5, -.6)], 5, true), {c: ramp(WHITES, .42), soft: 0});
    const side = (v0, v1, u0, u1, L, w) => st('petal', 'petal', [B(u0, v0 * .55), B((u0 + u1) / 2 - .05, v1), B(u1, v0 * .25)], {w: r * w, c: ramp(WHITES, L * .8), c2: ramp(WHITES, L * .86 + .14), grad: v0 > 0 ? -.8 : .8, a: .97, pr: [.45, .9, 1, .9, .5]});
    side(-.5, -.52, -.8, .8, .22, .5); side(.5, .52, -.8, .85, .8, .52); side(-.1, -.2, -.7, .95, .5, .42); side(.2, .22, -.5, 1.02, .95, .36);
    st('clean', 'comma', [B(.95, .02), B(.3, -.08), B(-.3, -.02)], {w: 1.5, c: lerp3('night', 'violet', .5), a: .6});
    st('clean', 'comma', [B(.2, -.62), B(-.3, -.5), B(-.6, -.3)], {w: 1.8, c: lerp3('dusk', 'turq deep', .4), a: .55});
    st('impasto', 'comma', [B(-.2, .5), B(.35, .5), B(.8, .22)], {w: r * .22, c: 'hi', a: .95});
    for (const [v, lit] of [[-.55, .25], [.55, .8], [0, .5]]) st('leafy', 'leafb', [B(-1.0, v * .3), B(-.55, v * 1.12), B(v ? .05 : -.2, v * (v ? .95 : 0))], {w: r * (v ? .5 : .55), c: ramp(LEAVES, lit * .5), c2: ramp(LEAVES, lit * .6 + .22), grad: v > 0 ? -.7 : .7, a: .97, pr: [.7, 1, .85, .45, .15]}) }
}

/* ---------- the two pages ---------- */
export const bloom = {name: 'peony-bloom', origin: [900, 0], size: [260, 270], seed: 11, define,
  paint(s) { const rs = chance(90211); paintBranch(s, 900, 0, chance(4471), 'bloom'); s.dry(1, true); paintBloom(s, 900, 0, rs) }};
export const branch = {name: 'peony-branch', origin: [0, 255], size: [960, 90], seed: 12, define,
  paint(s) { paintBand(s, 0, 255) }};

if (import.meta.url === 'file://' + process.argv[1]) {
  const mode = process.argv[2] || 'look', i = process.argv.indexOf('--scale'), scale = i > 0 ? +process.argv[i + 1] : 2;
  const out = process.env.LOOK || '/tmp/peony';
  if (mode === 'look') {
    preview(bloom, join(out, 'bloom.png'), {scale});
    preview(branch, join(out, 'branch.png'), {scale});
    if (process.argv.includes('--dark')) { preview(bloom, join(out, 'bloom-dark.png'), {scale, dark: true}); preview(branch, join(out, 'branch-dark.png'), {scale, dark: true}) }
  } else {
    writeBaked(process.env.OUT || join(dir, '_png'), 'peony-bloom', bake(bloom, {scale: 3}));
    writeBaked(process.env.OUT || join(dir, '_png'), 'peony-branch', bake(branch, {scale: 3}));
  }
}
