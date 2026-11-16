// node world/src/board/baked/mountains.gen.mjs [look|bake] [--scale n]
//
// Oil brushwork for the three mountains of the research map: blue, peach, mint. The page keeps its soft wash under
// the ridge as the mass; this is the paint that goes on top of it, on bare ground, so only the paint is kept.
// It is painted in the map's own space for a reference box of REF = 1100 x 640 CSS px (the box given to mapSVG), and
// stretches with the box. The ridge line and the nodes are NOT painted here.
import {join} from 'node:path';
import {P, dir, chance, palette, preview, bake, writeBaked, arc, clamp, smooth, fbm, strokeAt, run} from './kit.mjs';
import {mapSVG} from '../../landing/landing.js';

export const REF = [1100, 640];
const [W, H] = REF, MAP = mapSVG(W, H, 'en', {motion: false}), mk = MAP.mk;

/* ---------- the ridge, as the page draws it ---------- */
const RIDGE = (() => { const c = MAP.curve, out = [c[0]], pts = c.slice(1), k = 1 / 6;
  for (let i = 0; i <= 10; i++) out.push([c[0][0] + (pts[0][0] - c[0][0]) * i / 10, c[0][1] + (pts[0][1] - c[0][1]) * i / 10]);
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const a = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k], b = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    for (let j = 1; j <= 24; j++) { const t = j / 24, u = 1 - t; out.push([u * u * u * p1[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * p2[1]]) } }
  return out })();
// the ridge by its length, so that a steep flank gets as many touches as a gentle one
const RCUM = RIDGE.reduce((a, p, i) => (a.push(i ? a[i - 1] + Math.hypot(p[0] - RIDGE[i - 1][0], p[1] - RIDGE[i - 1][1]) : 0), a), []), RLEN = RCUM[RCUM.length - 1];
const xAt = l => { l = clamp(l, 0, RLEN); let i = 1; while (i < RCUM.length - 1 && RCUM[i] < l) i++; const t = (l - RCUM[i - 1]) / Math.max(1e-6, RCUM[i] - RCUM[i - 1]); return RIDGE[i - 1][0] + (RIDGE[i][0] - RIDGE[i - 1][0]) * t };
const X0 = RIDGE[0][0], X1 = RIDGE[RIDGE.length - 1][0];
// The third mountain is still being climbed: past the end of the drawn ridge its slope goes on, up behind the loop and to the
// right edge of the box. There is no ridge line there; EXT is only where the unfinished paint stops.
export const LOOP = MAP.loop, EXT = [[900, 363], [960, 262], [1040, 205], [W, 170]], X2 = W;
const extY = x => { for (let i = 1; i < EXT.length; i++) if (EXT[i][0] >= x) { const a = EXT[i - 1], b = EXT[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) } return EXT[EXT.length - 1][1] };
const ridgeY = x => { if (x <= X0) return RIDGE[0][1]; if (x > RIDGE[RIDGE.length - 1][0]) return extY(x); for (let i = 1; i < RIDGE.length; i++) if (RIDGE[i][0] >= x) { const a = RIDGE[i - 1], b = RIDGE[i], t = (x - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[1] + (b[1] - a[1]) * t } return RIDGE[RIDGE.length - 1][1] };
const BASE = H - 30 * mk, FOOT = BASE - 12;
// summits and the valleys between them
const SUM = [{x: 201, y: 228, x0: X0, x1: 428}, {x: 579, y: 228, x0: 428, x1: 813}, {x: 1112, y: 165, x0: 813, x1: W}];
const sumAt = x => x < 428 ? SUM[0] : x < 813 ? SUM[1] : SUM[2];
const gap = 12, colW = (W - gap * 2) / 3, EDGE = [colW + gap / 2, 2 * colW + gap * 1.5];

// No pauses for the words: the paint runs through where the labels sit, and the page thins it under each label.
const perp = (x, y) => { const m = (ridgeY(x + 5) - ridgeY(x - 5)) / 10; return (y - ridgeY(x)) / Math.sqrt(1 + m * m) };
const depth = (x, y) => y - ridgeY(x);
// the loop's disc (and 14 px round it) and its two names above it stay free; only the thin lay-in may pass behind the lower half of the disc
const NAMES = [LOOP.x - 88, LOOP.y - LOOP.R - 46 * mk, LOOP.x + 88, LOOP.y - LOOP.R - 2];
const inMass = (x, y, top = 9, lay = false) => x > X0 + 2 && x < X2 - 2 - top * .8 && perp(x, y) > top && y < FOOT - top * .7
  && !(Math.hypot(x - LOOP.x, y - LOOP.y) < LOOP.R + 14 + top && !(lay && y > LOOP.y + 6)) && !(x > NAMES[0] - top && x < NAMES[2] + top && y > NAMES[1] - top && y < NAMES[3] + top);
// how finished the third mountain is at a place: 1 low and to the left, falling to 0 up and to the right
const done = (x, y) => x < X1 - 60 ? 1 : 1 - smooth((((x - (X1 - 60)) / 260) * .6 + ((FOOT - y) / 420) * .7 - .22) / .4);

/* ---------- colour ---------- */
const MIX = {
  'cool': {mix: {'titanium white': 3, 'cobalt blue': .7, 'ivory black': .12, 'viridian': .15}},
  'b hi': {mix: {'titanium white': 8, 'cobalt blue': .5, 'cerulean': .3, 'naples yellow': .1}},
  'b lit': {mix: {'titanium white': 4, 'cobalt blue': 1.2, 'cerulean': .5}},
  'b mid': {mix: {'titanium white': 2, 'cobalt blue': 1.3, 'ultramarine': .7}},
  'b shade': {mix: {'ultramarine': 1.4, 'cobalt blue': .5, 'dioxazine violet': .22, 'titanium white': .85}},
  'b deep': {mix: {'ultramarine': 1, 'dioxazine violet': .3, 'prussian blue': .1, 'titanium white': .6}},
  'b alt': {mix: {'cerulean': 1, 'viridian': .25, 'titanium white': 2}},
  'b alt2': {mix: {'dioxazine violet': .6, 'ultramarine': .8, 'titanium white': 2.4}},
  'p hi': {mix: {'titanium white': 8, 'naples yellow': 1.2, 'vermilion': .05}},
  'p lit': {mix: {'titanium white': 4, 'naples yellow': 2, 'vermilion': .22}},
  'p mid': {mix: {'titanium white': 3, 'naples yellow': 1.6, 'vermilion': .5, 'yellow ochre': .3}},
  'p shade': {mix: {'titanium white': 2, 'vermilion': .55, 'burnt sienna': .5, 'naples yellow': .7, 'dioxazine violet': .1}},
  'p deep': {mix: {'burnt sienna': 1, 'alizarin crimson': .25, 'dioxazine violet': .22, 'titanium white': .8}},
  'p rose': {mix: {'titanium white': 2.4, 'rose madder': .5, 'burnt sienna': .35, 'dioxazine violet': .12}},
  'p alt': {mix: {'titanium white': 3, 'rose madder': .3, 'naples yellow': 1, 'vermilion': .2}},
  'p alt2': {mix: {'titanium white': 3, 'yellow ochre': 1, 'cadmium yellow': .25}},
  'm hi': {mix: {'titanium white': 8, 'viridian': .35, 'naples yellow': .5}},
  'm lit': {mix: {'titanium white': 4, 'viridian': .9, 'cerulean': .2, 'naples yellow': .5}},
  'm mid': {mix: {'titanium white': 2.4, 'viridian': 1.4, 'cerulean': .3}},
  'm shade': {mix: {'viridian': 1.4, 'cobalt blue': .3, 'titanium white': 1.8}},
  'm deep': {mix: {'viridian': 1, 'prussian blue': .25, 'titanium white': .8}},
  'm alt': {mix: {'titanium white': 3, 'cerulean': .8, 'viridian': .5}},
  'm alt2': {mix: {'titanium white': 3, 'sap green': .7, 'naples yellow': .8}},
};
const {C, lerp3, ramp} = palette(MIX);
const FAM = ['b', 'p', 'm'].map(k => ({ramp: ['deep', 'shade', 'mid', 'lit', 'hi'].map(n => k + ' ' + n), alt: [k + ' alt', k + ' alt2']}));
// the family at x: each mass keeps its own; its neighbour's colour comes in only in a band round the phase boundary
function famAt(x, rnd) { const BAND = 35; let i = x < EDGE[0] ? 0 : x < EDGE[1] ? 1 : 2;
  for (let e = 0; e < 2; e++) { const d = x - EDGE[e]; if (Math.abs(d) < BAND) { const p = .5 + d / BAND / 2; i = rnd() < p ? e + 1 : e } }
  return FAM[i] }

const define = {
  pigments: MIX,
  materials: {
    'thin': {base: 'oil', note: 'paint let down with medium: the ground shows through it', body: .45, opacity: .7, ridges: .2, gloss: .16, reach: 0, merge: .2, pickup: .03, open: .5, dry: .2},
    'body': {base: 'oil', note: 'loaded paint', body: 1.05, ridges: .2, grain: .05, gloss: .28, reach: 0, merge: .18, pickup: .03, bury: .7, dry: .2},
    'slab': {base: 'oil', note: 'paint for the knife, not too thick', body: .8, gloss: .34, sharp: .6, reach: 0, merge: .05, pickup: 0, bury: .9, dry: .15},
    'impasto': {base: 'oil', note: 'thick pale lights, put down and left', body: 1.7, ridges: .22, gloss: .36, sharp: .5, reach: 0, merge: 0, pickup: 0, bury: .95, dry: .18},
    'scum': {base: 'oil', note: 'stiff paint dragged dry', body: .6, opacity: .8, grain: .1, gloss: .14, reach: 0, merge: 0, pickup: 0, dry: .3},
  },
  brushes: {
    'big': {base: 'filbert', note: 'a big soft filbert', clump: 3.4, streak: 1.4, wobble: .45, var: .3, vary: .08},
    'soft': {base: 'mop', note: 'a mop for the first thin passages', wobble: .4},
    'round': {base: 'round', note: 'a full round, pressed and lifted', wobble: .4, var: .2},
    'plane': {base: 'filbert', note: 'a broad filbert, well loaded: one plane, one touch', clump: 1.6, streak: .6, wobble: .16, var: .1, vary: .03},
    'flatw': {base: 'flat', note: 'a broad flat brush, its end ragged', rag: 3, wobble: .35, taper: .3},
    'kn': {base: 'knife', note: 'the edge of a small knife', wobble: .3},
    'drag': {base: 'dry', note: 'a dry bristle brush', streak: 1.6, wobble: 1.1},
    'fan': {base: 'fan', wobble: .8},
  },
};
const LONG = [[.75, 1, 1, .95, .85, .7, .5, .3, .12], [.5, .9, 1, 1, .9, .75, .55, .3, .1], [.9, 1, .9, .85, .8, .6, .45, .25], [.6, 1, 1, .8, .7, .7, .5, .2]];
const SOFT = [[.08, .35, .75, 1, 1, .85, .6, .35, .12], [.1, .5, .9, 1, .8, .55, .3, .1], [.05, .25, .6, .9, 1, .9, .7, .4, .15], [.15, .6, 1, .9, .6, .3, .1]];
const PR = [[.3, .8, 1, 1, .8, .45, .15], [.6, 1, 1, .85, .55, .25], [.2, .6, 1, 1, .9, .6, .3, .1], [.8, 1, .9, .7, .45, .2], [.35, 1, .9, .9, .5, .2]];

// spurs: ridgelets that run down from the summits. Each has a face turned to the light (its left) and one turned away.
const SPURS = [
  [[201, 236], [214, 330], [205, 430], [228, 520], [222, 590]], [[170, 300], [150, 390], [128, 480], [120, 575]], [[240, 300], [268, 380], [300, 470], [330, 575]], [[362, 500], [386, 588]],
  [[579, 236], [590, 330], [578, 430], [600, 520], [596, 590]], [[556, 300], [548, 380], [530, 460], [500, 540], [488, 588]], [[625, 300], [668, 390], [700, 470], [725, 588]], [[742, 505], [754, 588]],
  [[882, 405], [868, 500], [852, 588]], [[1012, 425], [992, 505], [976, 588]], [[1078, 300], [1064, 430], [1050, 588]],
];
const spurX = (sp, y) => { if (y < sp[0][1] || y > sp[sp.length - 1][1]) return null; for (let i = 1; i < sp.length; i++) if (sp[i][1] >= y) { const a = sp[i - 1], b = sp[i]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) } return null };
const WEDGE = [[.5, .9, 1, 1, .95, .8, .55, .25], [1, 1, .95, .85, .7, .5, .3, .12], [.2, .45, .7, .9, 1, 1, .8, .4], [.7, 1, 1, .9, .9, .7, .4], [.35, .8, 1, .9, .6, .35, .15], [.9, 1, 1, 1, .8, .45]];
const BL = [[.75, 1, 1, 1, .9, .6], [.5, .95, 1, 1, .85, .5], [.9, 1, 1, .9, .7, .35], [.6, 1, 1, 1, 1, .7]];

function paint(s) {
  const {rnd, R, pick} = chance(77031);
  const st = (material, brush, path, o = {}) => { { const top = o.top ?? (o.w || 10) * .36 + 2; if (path.length && !inMass(path[0][0], path[0][1], top, o.lay)) path = path.slice().reverse(); let n = 0; while (n < path.length && inMass(path[n][0], path[n][1], top, o.lay)) n++; path = path.slice(0, n) } if (path.length < (o.min || 4)) return false; const c = {material, brush, path};
    if (o.w !== undefined) c.width = o.w; if (o.c !== undefined) c.color = C(o.c); if (o.c2 !== undefined) c.color2 = C(o.c2); if (o.a !== undefined) c.opacity = o.a;
    if (o.pr !== undefined) c.pressure = o.pr; if (o.grad) c.grad = o.grad; if (o.tone2) c.tone2 = o.tone2; s.paint(c); return true };
  // the fall line: with the slope of the ridge on a steep flank, fanning from the summit under it and deeper in the mass
  const fall = (x, y) => { const S = sumAt(x), rad = clamp(Math.atan2(y - (S.y - 60), (x - S.x) * 1.1), .5, 2.64), m = (ridgeY(x + 6) - ridgeY(x - 6)) / 12, aT = m >= 0 ? Math.atan2(m, 1) : Math.atan2(-m, -1);
    const wT = smooth((Math.abs(m) - .5) / 1) * (1 - smooth(depth(x, y) / 170)) * .85; return rad + (aT - rad) * wT };
  // value by planes: left of the nearest spur is a face in the light, right of it a face in shade; the whole left of a mountain a little lighter than its right
  const value = (x, y) => { let best = null, bd = 1e9; for (const sp of SPURS) { const sx = spurX(sp, y); if (sx === null) continue; const d = x - sx; if (Math.abs(d) < bd) { bd = Math.abs(d); best = d } }
    const S = sumAt(x), g = clamp((S.x - x) / 110, -1, 1), side = best === null ? g : (best < 0 ? 1 : -1) * (1 - .45 * smooth(bd / 95)), f = depth(x, y) / Math.max(1, FOOT - ridgeY(x));
    const L = .5 + .19 * side + .22 * g - .06 * f; return .5 + (L - .5) * (1 - .25 * smooth((f - .22) / .4)) };   // calmer inside the mass: the planes come closer in value
  const hue = (x, L) => { const F = famAt(x, rnd), i = FAM.indexOf(F), c = ramp(F.ramp, clamp(L, 0, 1)); if (rnd() > .25) return c;
    return L > .5 ? lerp3(c, F.alt[i === 1 ? 1 : 0], R(.2, .5)) : lerp3(c, ['b alt2', 'p rose', 'cool'][i], R(.2, .5)) };
  // the foot is not a hem: the paint stops at a different height at each place, and runs long down the spurs
  const footY = x => { const h = FOOT - ridgeY(x); let y = FOOT - 12 - Math.min(h * .45, 120 * clamp((fbm(x / 58 + 1.3, 2.3, 3) - .3) * 1.7, 0, 1)); for (const sp of SPURS) { const sx = spurX(sp, 572); if (sx !== null && Math.abs(x - sx) < 24) y = FOOT - 9 } return y };
  const LN = [-.7071, -.7071];
  // one plane of the rock: a single broad touch in one colour and value, its edge toward the light clean and lighter, its other edge dragged dry
  function facet(x, y, ang, len, w, L, o = {}) {
    const p = strokeAt(x, y, ang, len, R(-.55, .55), 7), nx = -Math.sin(ang), ny = Math.cos(ang), sgn = nx * LN[0] + ny * LN[1] > 0 ? 1 : -1, c = hue(x, L + R(-.05, .05)), k = rnd();
    const ok = st(o.lay ? 'thin' : 'body', k < .85 ? 'plane' : 'round', p, {lay: o.lay, w, c, c2: lerp3(c, ramp(famAt(x, rnd).ramp, clamp(L + .22, 0, 1)), .6), grad: sgn * .75, a: o.a ?? R(.86, .97), pr: pick(WEDGE)});
    if (ok && !o.lay && rnd() < .7) st('scum', 'drag', p.map(v => [v[0] - nx * sgn * w * .4, v[1] - ny * sgn * w * .4]), {w: w * R(.3, .45), c: lerp3(c, 'cool', R(0, .2)), a: R(.5, .8), pr: pick(SOFT), top: 6});
    return ok }
  const angle = (x, y) => { const k = rnd(), a = fall(x, y); return k < .66 ? a + R(-.3, .3) : k < .88 ? a + (rnd() < .5 ? 1 : -1) * R(.7, 1.3) : (rnd() < .5 ? R(-.18, .18) : Math.PI + R(-.18, .18)) };

  // 1. the big planes of each mass, laid on a loose lattice: larger and quieter inside, none below the uneven foot
  const cells = []; for (let x0 = X0 + 18; x0 < X2 - 4; x0 += 44) for (let y0 = ridgeY(x0) + 30; y0 < FOOT - 14; y0 += 40) cells.push([x0 + R(-13, 13), y0 + R(-12, 12)]);
  cells.sort(() => rnd() - .5);
  for (const [x, y] of cells) { if (x < X0 + 4 || x > X2 - 3 || y > footY(x)) continue; const dn = done(x, y); if (rnd() < (1 - dn) * .55) continue; const h = FOOT - ridgeY(x), f = depth(x, y) / h, w = Math.min(R(28, 46) + 16 * smooth((f - .15) / .4), h * .4), len = Math.min(R(54, 96) + 30 * smooth((f - .15) / .4), (footY(x) - y) * 2 + 40);
    if (!inMass(x, y, 8, dn < .5)) continue; facet(x, y, dn < .5 ? fall(x, y) + R(-.3, .3) : angle(x, y), len * (dn < .5 ? 1.3 : 1), w, value(x, y), dn < .5 ? {lay: true, a: R(.35, .6)} : {a: R(.86, .97) * (.6 + .4 * dn)}) }
  // 2. smaller planes hard under the ridge, all along it, where the big ones cannot reach: here the contrasts are liveliest
  for (let l = 6; l < RLEN - 4; l += R(17, 30)) { const x = xAt(l), w = R(14, 30), m = (ridgeY(x + 5) - ridgeY(x - 5)) / 10, d = (w * .36 + 4) * Math.sqrt(1 + m * m) + R(0, 12), y = ridgeY(x) + d; if (y > FOOT - 6) continue;
    const L = value(x, y); facet(x, y, angle(x, y), R(30, 62), w, .5 + (L - .5) * 1.15 + R(-.05, .05)) }
  s.dry(.6, true);
  // 3. clefts: a few deep cool accents down the shaded side of each spur, and in the valleys
  for (const sp of SPURS) for (let i = 0; i < 3; i++) { const y = R(sp[0][1] + 20, sp[sp.length - 1][1] - 30), x = spurX(sp, y) + R(4, 10); if (!inMass(x, y, 8) || y > footY(x) || done(x, y) < .6) continue; const y2 = Math.min(footY(x) - 6, y + R(50, 110)), x2 = (spurX(sp, Math.min(y2, sp[sp.length - 1][1])) ?? x) + R(4, 12);
    st('body', 'round', [[x, y], [(x + x2) / 2 + R(-3, 3), (y + y2) / 2], [x2, y2]].flatMap((p, i, a) => i < a.length - 1 ? [p, [(p[0] + a[i + 1][0]) / 2, (p[1] + a[i + 1][1]) / 2]] : [p]), {w: R(3, 6.5), c: hue(x, R(.02, .14)), a: R(.6, .85), pr: pick(SOFT), top: 6}) }
  for (const vx of [428, 813, 110]) for (let i = 0; i < 7; i++) { const x = vx + R(-55, 55), y = ridgeY(x) + R(12, 40); if (!inMass(x, y, 6)) continue;
    st('body', 'round', strokeAt(x, y, fall(x, y) + R(-.4, .4), R(20, 44), R(-.8, .8), 5), {w: R(6, 12), c: hue(x, R(.04, .2)), a: R(.65, .88), pr: pick(PR), top: 6}) }
  // 4. lights: thick and pale along the lit side of the spurs near the top, and under the summits
  for (const sp of SPURS) for (let i = 0; i < 2; i++) { const y = R(sp[0][1] + 8, sp[0][1] + (sp[sp.length - 1][1] - sp[0][1]) * .4), x = spurX(sp, y) - R(5, 16); if (!inMass(x, y, 9) || done(x, y) < .6) continue;
    st('impasto', rnd() < .5 ? 'round' : 'big', strokeAt(x, y, Math.PI / 2 + R(-.25, .25), R(34, 66), R(-.4, .4), 6), {w: R(6, 11), c: hue(x, R(.86, 1)), c2: famAt(x, rnd).ramp[4], grad: .8, a: .96, pr: pick(PR), top: 8}) }
  for (const S of SUM.slice(0, 2)) for (let i = 0; i < 5; i++) { const x = S.x - R(-4, 60) * (S === SUM[2] ? .5 : 1), y = ridgeY(x) + R(13, 56); if (!inMass(x, y, 10)) continue;
    st('impasto', rnd() < .6 ? 'round' : 'big', strokeAt(x, y, fall(x, y) + R(-.3, .3), R(18, 40), R(-.9, .9), 5), {w: R(6, 13), c: hue(x, R(.85, 1)), c2: FAM[SUM.indexOf(S)].ramp[4], grad: rnd() < .5 ? .8 : -.8, a: .96, pr: pick(PR), top: 10}) }
  // 5. at the foot: a few level drags of paler paint, like scree or mist, across the ends of the spurs; and rare thin hairs as accents
  for (let i = 0; i < 8; i++) { const x = R(X0 + 30, X1 - 40), y = Math.min(FOOT - 8, footY(x) + R(-26, 10)); if (!inMass(x, y, 6)) continue; const F = famAt(x, rnd);
    st('scum', 'drag', strokeAt(x, y, R(-.14, .14), R(40, 84), R(-.25, .25), 6), {w: R(10, 20), c: lerp3(ramp(F.ramp, .78), 'cool', R(0, .3)), a: R(.3, .5), pr: pick(SOFT), top: 5}) }
  // the top right of the third mountain: a few loose marks that only say which way the slope will go
  for (const [x, y] of [[1062, 262], [1084, 232], [1070, 330], [1040, 292], [1088, 300], [1076, 390]]) st('thin', 'plane', arc(x + R(-6, 6), y + R(-6, 6), 2.05 + R(-.2, .2), R(46, 84), R(-.3, .3), 6), {w: R(9, 20), c: hue(x, R(.5, .8)), a: R(.3, .5), pr: pick(SOFT), top: 5, lay: true});
  for (let i = 0; i < 26; i++) { const x = R(X0 + 12, X1 - 8), y = ridgeY(x) + R(20, 1) + rnd() * (footY(x) - ridgeY(x) - 20); if (!inMass(x, y, 8)) continue;
    st('scum', 'drag', arc(x, y, fall(x, y) + R(-.3, .3), R(30, 70), R(-.5, .5), 5), {w: R(4, 9), c: hue(x, value(x, y) + R(-.2, .2)), a: R(.5, .8), pr: pick(SOFT), top: 6}) }
}

export const mountains = {name: 'mountains', size: REF, seed: 31, define, paint};

if (import.meta.url === 'file://' + process.argv[1]) {
  const mode = process.argv[2] || 'look', i = process.argv.indexOf('--scale'), scale = i > 0 ? +process.argv[i + 1] : 2;
  const out = process.env.LOOK || '/tmp/mountains';
  if (mode === 'look') { preview(mountains, join(out, 'mountains.png'), {scale}); if (process.argv.includes('--dark')) preview(mountains, join(out, 'mountains-dark.png'), {scale, dark: true}) }
  else if (mode === 'ridge') console.log(JSON.stringify({ridge: RIDGE, foot: FOOT, edge: EDGE, ext: EXT, loop: LOOP, names: NAMES}));
  else writeBaked(process.env.OUT || join(dir, '_png'), 'mountains', bake(mountains, {scale: 2}));
}
