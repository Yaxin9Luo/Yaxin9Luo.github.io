// node world/src/muye/art/ground/gen/ground.gen.mjs
// The ground of the field of Muye, and what stands on it (grown from the view study, lab/game-studies/field). Painted with the ink tools of the side-view scene
// (world/src/fengshen/art/scene2/gen/ink.mjs and brush.mjs, imported read-only), re-cut for a field seen from above at
// an angle: every ground patch is painted already flattened (an ellipse where the ground has a circle), and has no
// straight edge and no frame, so that patches can be laid anywhere over plain paper, turned over, and overlapped.
// Standing things (pines, boulders, tents, a banner, a broken chariot) are upright, as the figures are, each with the
// paper it keeps for itself and a small ink shadow at its foot.
// Output: ../baked/ground.webp, props.webp, river-N.webp, field.json. One world pixel is one pixel of a patch.
// The field is drawn at (x, y * KY): KY is fixed here and read by the run time from field.json.
import {writeFileSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readdirSync, unlinkSync} from 'node:fs';
const KY = 0.62;
const ART = '../../../../fengshen/art/scene2/gen/';   // the ink engine and the brush vocabulary of the side-view scene, read only
const {Layer, sharp, chance, fbm, vnoise, clamp, smooth, PAPER, PIG} = await import(ART + 'ink.mjs');
PIG.gold = [.31, .52, 1.27];                                     // bronze gold, for battle spirit and the chest's band (added here; the engine file is not changed)
const {ridgeOf, rock, pine, bare, leaf, reed, drag} = await import(ART + 'brush.mjs');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'baked');
const INK = [34, 30, 26];

// a sheet as RGBA to be laid ON raw paper: what the eye would see over paper, written as colour and cover
function rgbaOf(L) {
  const m = L.inkMask(), c = L.colour(), wh = L.wh, out = Buffer.alloc(L.N * 4);
  for (let i = 0; i < L.N; i++) { const a = m[i] / 255, w = wh ? Math.min(1, wh[i]) : 0; let A = Math.max(a, w); const F = [0, 0, 0];
    for (let k = 0; k < 3; k++) { let v = PAPER[k]; if (c && c[i * 4 + 3]) { const ca = c[i * 4 + 3] / 255; v *= 1 - ca * (1 - c[i * 4 + k] / 255) } F[k] = v * (1 - a) + INK[k] * a; A = Math.max(A, 1 - F[k] / PAPER[k]) }
    if (A < .006) continue; A = Math.min(1, A + .004);
    for (let k = 0; k < 3; k++) out[i * 4 + k] = clamp((F[k] - PAPER[k] * (1 - A)) / A, 0, 255); out[i * 4 + 3] = A * 255 }
  return out;
}
const line = (L, x0, y0, x1, y1, w, o = {}) => { const bow = o.bow ?? 0, mx = (x0 + x1) / 2 - (y1 - y0) * bow, my = (y0 + y1) / 2 + (x1 - x0) * bow; return L.stroke([[x0, y0, w * (o.w0 ?? .7)], [mx, my, w], [x1, y1, w * (o.w1 ?? .3)]], {load: .8, dry: .05, dry1: .45, streak: .4, rag: .15, pool: .05, ...o}) };
// a point along a hand-set path (Catmull-Rom), t 0..1, and its direction
const along = (P, t) => { const n = P.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, g = k => P[clamp(k, 0, n)], a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
  const q = m => .5 * (2 * b[m] + (c[m] - a[m]) * u + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u * u + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u * u), dq = m => .5 * ((c[m] - a[m]) + 2 * (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u + 3 * (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u);
  const dx = dq(0), dy = dq(1), l = Math.hypot(dx, dy) || 1; return [q(0), q(1), dx / l, dy / l] };
const ends = t => smooth(0, .18, t) * (1 - smooth(.82, 1, t));                        // everything on a path dies away toward its two ends

/* ---------- the ground: name -> {w, h, paint(L, C)}. The middle of the sheet is (0, 0). ---------- */
const GROUND = {};
const g = (name, w, h, paint) => { GROUND[name] = {w, h, paint} };
// damp ground: a few wet stains run together along one slant, with tide lines, and paper lifted through them
for (let v = 0; v < 3; v++) g('damp' + v, 760, 440, (L, C) => { const tilt = C.R(-.25, .25);
  for (let i = 0, n = 6 + v; i < n; i++) { const t = (i + C.R(.1, .9)) / n - .5, x = t * 520 + C.R(-30, 30), y = t * 520 * tilt + C.R(-50, 50); L.blot(x, y, C.R(60, 130), C.R(26, 56), {dens: C.R(.05, .1), rim: .6, rimW: .1, soft: .5, rough: .5, freq: .012, gran: .6, rot: tilt * .6}) }
  for (let i = 0; i < 5; i++) L.blot(C.R(-220, 220), C.R(-90, 90), C.R(40, 100), C.R(8, 16), {pig: 'lift', dens: .8, rim: 0, soft: .8, rough: .5, freq: .02, gran: 0});
  if (v === 1) L.blot(C.R(-80, 80), C.R(-30, 30), 70, 26, {pig: 'mal', dens: .05, rim: .3, soft: .7, rough: .5, gran: 1});
  for (let i = 0; i < 7; i++) drag(L, C.R(-260, 160), C.R(-110, 110), C.R(40, 120), C.R(.8, 1.5), C.R(.1, .18), C, {dry: .55, tilt: .2});
  for (let i = 0; i < 10; i++) L.blot(C.R(-250, 250), C.R(-120, 120), C.R(1.5, 3.5), C.R(1, 2), {dens: C.R(.15, .3), rim: .5, soft: .3}) });
// scrub: dry grass in clumps, thick in the middle of the patch and thinning out; a few dry pulls of earth under it
for (let v = 0; v < 3; v++) g('scrub' + v, 600, 360, (L, C) => {
  for (let i = 0; i < 9; i++) drag(L, C.R(-240, 120), C.R(-120, 120), C.R(50, 140), C.R(1, 2), C.R(.16, .28), C, {dry: .5, tilt: .2});
  for (let i = 0, n = 26 + v * 8; i < n; i++) { const x = C.gauss() * 150, y = C.gauss() * 80; if (Math.abs(x) > 270 || Math.abs(y) > 150) continue;
    for (let j = 0, m = 2 + Math.floor(C.R(0, 4)); j < m; j++) leaf(L, x + C.R(-7, 7), y + C.R(-2, 2), C.R(9, 24), C.R(-.7, .2), C, {load: C.R(.42, .7), w: .6}) }
  if (v === 2) for (let i = 0; i < 5; i++) reed(L, C.R(-60, 60), C.R(-30, 30), C.R(20, 36), C, {load: .5}) });
// bare earth: a few long dry pulls and nothing else
for (let v = 0; v < 3; v++) g('earth' + v, 640, 300, (L, C) => { for (let i = 0, n = 7 + v * 2; i < n; i++) { const y = C.R(-110, 110); drag(L, C.R(-280, 60), y, C.R(90, 260) * (1 - Math.abs(y) / 220), C.R(1.2, 2.8), C.R(.2, .34), C, {dry: .45, tilt: .25}) }
  for (let i = 0; i < 6; i++) L.blot(C.R(-250, 250), C.R(-110, 110), C.R(1.5, 3), C.R(1, 1.8), {dens: C.R(.18, .3), rim: .4, soft: .3}) });
// stony ground: pebbles as small wet dots with a rim, and chips cut with the side of the brush
for (let v = 0; v < 2; v++) g('stones' + v, 460, 280, (L, C) => { for (let i = 0, n = 16 + v * 8; i < n; i++) { const x = C.gauss() * 110, y = C.gauss() * 60; if (Math.abs(x) > 200 || Math.abs(y) > 120) continue; const r = C.R(2.5, 9);
    L.blot(x, y, r, r * .6, {dens: C.R(.12, .26), rim: .7, rimW: .2, soft: .3, rough: .3}); if (C.rnd() < .5) L.stroke([[x + r, y - 1, r * .4], [x + r * 1.6, y + r * .5, r * .5], [x + r * 2, y + r * 1.2, .4]], {load: C.R(.2, .34), dry: .2, dry1: .85, side: -.7, streak: .9, rag: .3}) }
  for (let i = 0; i < 4; i++) drag(L, C.R(-190, 60), C.R(-90, 90), C.R(50, 120), C.R(1, 1.8), C.R(.1, .18), C, {dry: .55}) });
// a burnt patch: a dry dark scrub outward from a wet middle, char, two stumps
for (let v = 0; v < 2; v++) g('burnt' + v, 480, 300, (L, C) => { L.blot(0, 0, 120, 52, {dens: .16, rim: .4, rimW: .14, soft: .5, rough: .6, freq: .02, gran: .9}); L.blot(C.R(-30, 30), C.R(-8, 8), 60, 24, {dens: .16, rim: .3, soft: .6, rough: .6, freq: .03, gran: .9});
  for (let i = 0; i < 26; i++) { const a = C.R(0, Math.PI * 2), r0 = C.R(20, 70), r1 = r0 + C.R(30, 90), cx = Math.cos(a), cy = Math.sin(a) * .5; L.stroke([[cx * r0, cy * r0, C.R(2, 5)], [cx * (r0 + r1) / 2, cy * (r0 + r1) / 2 + C.R(-3, 3), C.R(2, 4)], [cx * r1, cy * r1, .4]], {load: C.R(.18, .4), dry: .3, dry1: .92, streak: .9, rag: .4, pool: 0}) }
  for (let i = 0; i < 16; i++) L.blot(C.gauss() * 80, C.gauss() * 34, C.R(1.5, 4), C.R(1, 2.4), {dens: C.R(.4, .8), rim: .3, soft: .3});
  for (const sx of [-40 + v * 30, 50 - v * 60]) { const sy = C.R(-12, 12); line(L, sx, sy, sx + C.R(-4, 4), sy - C.R(14, 26), 2.4, {load: .85, w0: 1, w1: .6}); line(L, sx, sy - 12, sx + C.R(6, 12), sy - C.R(18, 26), 1, {load: .8}) } });
// a track worn by carts: two ruts that keep their distance, broken, with hoof marks between; it comes out of nothing and goes back into it
for (let v = 0; v < 2; v++) g('track' + v, 1200, 560, (L, C) => { const P = v ? [[-560, -200], [-300, -120], [-40, -10], [240, 30], [560, 190]] : [[-560, 150], [-280, 90], [0, 60], [260, -40], [560, -180]];
  for (const off of [-13, 13]) { let t = .02; while (t < .98) { const len = C.R(.04, .12), a = along(P, t), b = along(P, t + len / 2), c = along(P, t + len), e = ends(t + len / 2); if (e > .05) L.stroke([[a[0] - a[3] * off, a[1] + a[2] * off * .6, .6], [b[0] - b[3] * off, b[1] + b[2] * off * .6, C.R(1.6, 3.2)], [c[0] - c[3] * off, c[1] + c[2] * off * .6, .4]], {load: C.R(.2, .36) * e, dry: C.R(.3, .5), dry1: .9, streak: .8, rag: .3, pool: 0}); t += len + C.R(.005, .05) } }
  for (let i = 0; i < 40; i++) { const t = C.rnd(), a = along(P, t), e = ends(t); L.blot(a[0] + C.R(-9, 9), a[1] + C.R(-5, 5), C.R(1.6, 3), C.R(1, 1.8), {dens: C.R(.14, .3) * e, rim: .5, soft: .3}) }
  for (let i = 0; i < 10; i++) { const t = C.rnd(), a = along(P, t); drag(L, a[0] + C.R(-60, 20), a[1] + C.R(-40, 40), C.R(40, 100), C.R(.8, 1.4), C.R(.08, .14) * ends(t), C, {dry: .6}) } });
/* ---------- what stands on the ground: name -> {w, h, px, py (its foot inside the sheet), r (how wide it stands), paint} ---------- */
const PROPS = {};
const p = (name, w, h, r, paint, below = 16) => { PROPS[name] = {w, h, px: w / 2, py: h - below, r, paint} };   // below: room under the foot (a rock's base fades into the paper below its foot line)
const shadow = (L, x, w) => L.blot(x + w * .18, 3, w, w * .26, {dens: .2, rim: .1, soft: .7, rough: .3, gran: .5});
[[150, 1], [118, .9], [176, 1.15], [96, .85]].forEach(([h, th], i) => p('pine' + i, 280, h + 90, 16, (L, C) => { shadow(L, 0, h * .2); pine(L, 0, 0, h, C, {load: .82, thick: th, lean: [-.22, .1, -.34, -.05][i]}) }));
[[1, 7.1], [.7, 9.3], [1.3, 12.7], [.55, 15.9]].forEach(([k, seed], i) => p('boulder' + i, 280, 176, 40 * k, (L, C) => { shadow(L, 6, 46 * k);
  const pts = [[[-52, 0], [-36, -30], [-14, -52], [12, -48], [24, -22], [52, 0]], [[-50, 0], [-40, -22], [-16, -32], [4, -44], [28, -40], [38, -14], [54, 0]]][i % 2].map(([x, y]) => [x * k, y * k]);
  rock(L, pts, {seed, foot: 38, tone: 1.25, fade: 50 * k, x0: -58 * k, x1: 60 * k, k: .75 * k, fl: 12, fr: 14, body: 1, och: .12, azu: i === 2 ? .2 : 0, mal: i === 0 ? .2 : 0, inner: [[-10 * k, -44 * k, 34 * k, .9]]});
  drag(L, -50 * k, 4, 110 * k, 1.5, .3, C, {dry: .35}); for (let j = 0; j < 4; j++) leaf(L, C.R(-50, 50) * k, 4, C.R(8, 16), C.R(-.6, .2), C, {load: .5, w: .5}) }, 62));
[[86, 0], [64, 1]].forEach(([h, i]) => p('dead' + i, 170, h + 40, 12, (L, C) => { shadow(L, 0, h * .16); bare(L, 0, 0, h, C, {load: .82, depth: 3, lean: i ? .2 : -.25}) }));
// a field tent (re-cut from the side-view camp): a ridge on crossed sticks, two slopes, the dark of the door
for (let i = 0; i < 2; i++) p('tent' + i, 190, 110, 50, (L, C) => { const k = i ? .9 : 1.1, w = 44 * k, h = 50 * k, x0 = -w * .62, x1 = w * .6; shadow(L, 8, 58 * k);
  L.mountain(xx => xx < x0 ? -h * (xx - (x0 - w * .42)) / (w * .42) : xx > x1 ? -h * ((x1 + w * .42) - xx) / (w * .42) : -h, {pig: 'white', dens: 2, fade: h * 1.02, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0: x0 - w * .42, x1: x1 + w * .42, feather: 3, rough: 0});
  L.blot(-w * .15, -h * .42, w * .85, h * .5, {pig: 'och', dens: .13, rim: .2, soft: .5, rough: .3});
  L.stroke([[x0, -h, .7 * k], [0, -h + 3, 1.5 * k], [x1, -h * .98, .9 * k]], {load: .75, dry: .1, dry1: .5, streak: .5, rag: .2}); line(L, x0, -h, x0 - w * .42, 0, 1.2 * k, {load: .6, bow: .04, dry1: .7}); line(L, x1, -h * .98, x1 + w * .42, 0, 1.6 * k, {load: .85, bow: -.03}); line(L, x1, -h * .98, x1 - w * .34, 0, 1.3 * k, {load: .75, bow: .03});
  L.stroke([[x1 - 1, -h * .8, 1 * k], [x1 + w * .02, -h * .4, w * .14], [x1 + w * .04, -2, w * .22]], {load: .85, dry: .05, dry1: .4, streak: .7, rag: .3, pool: .2});
  for (const rx of [x0, x1]) { line(L, rx - 3 * k, -h + 4 * k, rx + 4 * k, -h - 9 * k, .7 * k, {load: .8}); line(L, rx + 3 * k, -h + 4 * k, rx - 4 * k, -h - 8 * k, .6 * k, {load: .7}) } });
// a standard left standing: its cloth is the greyed red of the scenery, never the hero's
p('banner', 150, 190, 8, (L, C) => { shadow(L, 0, 16); line(L, 0, 0, 3, -150, 1.5, {load: .9, w0: 1, w1: .5, dry1: .3}); line(L, -5, -143, 9, -144, 1.2, {load: .9});
  L.stroke([[3, -134, 11], [-22, -133, 10], [-44, -130, 7], [-60, -136, 1]], {pig: 'rust', load: .7, load1: .45, dry: .05, dry1: .6, streak: .8, rag: .25, pool: .3, gran: 1.1}); L.stroke([[-40, -124, 4], [-52, -119, 3], [-62, -115, .5]], {pig: 'rust', load: .7, dry: .1, dry1: .6}) });
// a broken chariot: one wheel leaning, the box tipped, the pole in the air, the parasol on the ground
p('wreck', 230, 130, 60, (L, C) => { shadow(L, 0, 70); const r = 22, cx = -34, cy = -20, pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * .62, cy + Math.sin(a) * r, 1.2 + .7 * Math.sin(a + 1)]) }
  L.stroke(pts, {load: .85, dry: .05, dry1: .3, streak: .4, rag: .2}); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3; line(L, cx, cy, cx + Math.cos(a) * r * .56, cy + Math.sin(a) * r * .92, .6, {load: .6, w0: 1, w1: .5}) }
  L.mountain(xx => -30 + (xx + 10) * .22, {pig: 'white', dens: 2, fade: 28, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0: -14, x1: 44, feather: 3, rough: 0});
  L.stroke([[-14, -18, 3], [14, -20, 9], [44, -8, 3]], {load: .5, dry: .15, dry1: .6, streak: .8, rag: .3}); line(L, -14, -32, 44, -19, 1.4, {load: .9}); line(L, -14, -32, -14, -4, 1.3, {load: .85, w0: 1}); line(L, 44, -19, 46, 0, 1.3, {load: .85, w0: 1});
  line(L, 40, -10, 96, -62, 1.3, {load: .8, bow: .06, w0: 1}); line(L, 88, -68, 104, -54, 1, {load: .8, bow: -.2});
  L.stroke([[52, 2, .6], [76, -8, 2.6], [102, 3, .6]], {load: .75, dry: .1, dry1: .5, streak: .6, rag: .3}); line(L, 76, -6, 60, 6, .8, {load: .8});
  L.stroke([[-70, 4, .5], [-56, 0, 1.6], [-44, 5, .4]], {pig: 'mal', load: .5, dry: .2, dry1: .7}); for (let i = 0; i < 5; i++) L.blot(C.R(-80, 90), C.R(2, 8), C.R(1.5, 3), 1.2, {dens: .4, rim: .3, soft: .3}) });
p('stakes', 210, 110, 60, (L, C) => { shadow(L, 0, 70); for (let i = 0; i < 6; i++) { const x = -70 + i * 28 + C.R(-5, 5), d = i % 2 ? 1 : -1, h = C.R(40, 66); L.stroke([[x - d * 10, 2, 2.6], [x, -h * .45, 2], [x + d * C.R(8, 16), -h, .4]], {load: .9, dry: .05, dry1: .5, streak: .6, rag: .2, side: .6}) } L.stroke([[-84, -22, 1.4], [0, -27, 2], [84, -19, 1.2]], {load: .85, dry: .1, dry1: .5, streak: .6}) });

/* ---------- the five landmarks: ground of their own, and things seen nowhere else ---------- */
// the ruined camp: trodden ground, three cold fires, litter
g('campGround', 1000, 560, (L, C) => { for (let i = 0; i < 46; i++) { const y = C.gauss() * 120; drag(L, C.gauss() * 260 - 80, y, C.R(60, 200), C.R(1, 2.6), C.R(.14, .3), C, {dry: .5, tilt: .3}) }
  for (const [fx, fy] of [[-200, -60], [60, 40], [250, -100]]) { L.blot(fx, fy, 30, 13, {dens: .3, rim: .5, rimW: .2, soft: .5, rough: .6, freq: .05, gran: 1}); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; L.blot(fx + Math.cos(a) * 34, fy + Math.sin(a) * 15, C.R(3, 5), C.R(2, 3), {dens: C.R(.3, .5), rim: .7, rimW: .2, soft: .3}) } for (let i = 0; i < 5; i++) line(L, fx + C.R(-14, 14), fy + C.R(-5, 5), fx + C.R(-20, 20), fy + C.R(-8, 8), 1.2, {load: .8}) }
  for (let i = 0; i < 20; i++) L.blot(C.gauss() * 240, C.gauss() * 110, C.R(1.5, 4), C.R(1, 2), {dens: C.R(.2, .45), rim: .4, soft: .3}); for (let i = 0; i < 8; i++) line(L, C.gauss() * 220, C.gauss() * 100, C.gauss() * 220, C.gauss() * 100 + 6, .8, {load: C.R(.4, .7), dry1: .7}) });
// under the pine wood: a floor in shade (the one large darker ground on the field), needles, roots
g('woodGround', 1100, 640, (L, C) => { for (let i = 0; i < 12; i++) L.blot(C.gauss() * 220, C.gauss() * 110, C.R(110, 220), C.R(50, 100), {dens: C.R(.03, .06), rim: .3, rimW: .2, soft: .7, rough: .6, freq: .01, gran: .8});
  for (let i = 0; i < 4; i++) L.blot(C.gauss() * 200, C.gauss() * 100, C.R(60, 120), C.R(26, 50), {pig: 'mal', dens: .03, rim: .2, soft: .8, rough: .6, gran: 1});
  for (let i = 0; i < 160; i++) { const x = C.gauss() * 280, y = C.gauss() * 140, a = C.R(0, 3.1), l = C.R(3, 8); line(L, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l * .6, .6, {load: C.R(.3, .6)}) }
  for (let i = 0; i < 40; i++) { const x = C.gauss() * 250, y = C.gauss() * 130; for (let j = 0; j < 3; j++) leaf(L, x + C.R(-6, 6), y, C.R(8, 20), C.R(-.7, .2), C, {load: C.R(.4, .65), w: .6}) } });
// the burnt village: the footings of four houses as broken lines, ash inside them, a well
g('villageGround', 1100, 640, (L, C) => { for (const [hx, hy, w, d] of [[-280, -110, 150, 70], [-40, -40, 180, 80], [230, -120, 140, 64], [120, 120, 170, 76], [-250, 110, 130, 60]]) {
    L.blot(hx, hy, w * .6, d * .55, {dens: .13, rim: .4, rimW: .14, soft: .5, rough: .6, freq: .03, gran: 1}); L.blot(hx + C.R(-20, 20), hy, w * .3, d * .3, {dens: .14, rim: .2, soft: .6, rough: .6, freq: .05, gran: 1});
    const sk = .35, c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [hx + x + y * sk, hy + y]);
    for (let e = 0; e < 4; e++) { const a = c[e], b = c[(e + 1) % 4]; let t = C.R(0, .15); while (t < .95) { const l = C.R(.15, .4), t1 = Math.min(1, t + l); line(L, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, C.R(1.4, 2.6), {load: C.R(.4, .7), dry: .2, dry1: .8, streak: .7}); t = t1 + C.R(.04, .2) } }
    for (let i = 0; i < 14; i++) L.blot(hx + C.gauss() * w * .3, hy + C.gauss() * d * .3, C.R(1.5, 4.5), C.R(1, 2.6), {dens: C.R(.4, .8), rim: .3, soft: .3}); for (let i = 0; i < 6; i++) line(L, hx + C.gauss() * w * .3, hy + C.gauss() * d * .25, hx + C.gauss() * w * .35, hy + C.gauss() * d * .3, 1.6, {load: C.R(.6, .9), dry1: .6}) }
  const wp = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; wp.push([40 + Math.cos(a) * 20, 20 + Math.sin(a) * 9, 1.6 + Math.sin(a + 1)]) } L.stroke(wp, {load: .8, dry: .05, dry1: .3}); L.blot(40, 21, 14, 6, {dens: .6, rim: .2, soft: .4});
  for (let i = 0; i < 16; i++) drag(L, C.gauss() * 320 - 60, C.gauss() * 150, C.R(50, 150), C.R(1, 2), C.R(.12, .22), C, {dry: .55}) });
// the altar's ground: a low mound drawn by the strokes that go round it, a worn way up to it
g('altarGround', 800, 460, (L, C) => { for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) { const a = C.R(0, Math.PI * 2), rx = 130 + r * 56, ry = (60 + r * 26), l = C.R(.2, .5); const p = []; for (let j = 0; j <= 4; j++) { const b = a + l * j / 4; p.push([Math.cos(b) * rx, Math.sin(b) * ry + 10, .5 + 1.3 * Math.sin(Math.PI * (j + .3) / 4.6)]) } L.stroke(p, {load: C.R(.14, .3) * (1 - r * .16), dry: .4, dry1: .9, streak: .7, pool: 0}) }
  L.blot(0, 6, 150, 62, {pig: 'och', dens: .06, rim: .2, soft: .7, rough: .4}); for (let i = 0; i < 14; i++) drag(L, -20 + C.R(-14, 14), 70 + i * 9, C.R(30, 70), 1.4, C.R(.14, .26), C, {dry: .5}) });

// charred house frames: posts that still stand, a beam fallen across
for (let i = 0; i < 3; i++) p('ruin' + i, 240, 150, 50, (L, C) => { shadow(L, 0, 64); const n = 3 + i; for (let j = 0; j < n; j++) { const x = -60 + j * (120 / (n - 1)) + C.R(-6, 6), h = C.R(40, 96); L.stroke([[x, 2, 3], [x + C.R(-2, 2), -h * .5, 2.6], [x + C.R(-4, 4), -h, 1.2]], {load: 1, dry: .05, dry1: .4, streak: .6, rag: .25, side: .5}); if (C.rnd() < .6) line(L, x, -h, x + C.R(-10, 10), -h - C.R(4, 10), 1, {load: .9}) }
  line(L, -70, -C.R(30, 60), 64, -C.R(8, 22), 2.6, {load: .95, w0: .8, w1: .6, dry1: .5, bow: .03}); line(L, -30, -4, 50, -C.R(40, 70), 2, {load: .9, w0: .8, w1: .5}); for (let j = 0; j < 8; j++) L.blot(C.R(-70, 70), C.R(0, 8), C.R(2, 5), C.R(1.2, 2.4), {dens: C.R(.5, .9), rim: .3, soft: .3}) });
// a tent brought down: its ridge on the ground, cloth in folds
p('tornTent', 220, 100, 54, (L, C) => { shadow(L, 0, 66); L.mountain(xx => -22 + Math.abs(xx) * .22 + 6 * Math.sin(xx * .09), {pig: 'white', dens: 2, fade: 26, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0: -64, x1: 64, feather: 6, rough: 0});
  L.blot(0, -8, 56, 12, {pig: 'och', dens: .13, rim: .2, soft: .5}); L.stroke([[-66, 0, .8], [-30, -20, 1.6], [4, -24, 1.4], [36, -14, 1.5], [66, 0, .8]], {load: .8, dry: .1, dry1: .5, streak: .5, rag: .2}); for (const fx of [-34, -6, 22]) line(L, fx, -20, fx + C.R(4, 12), -2, 1.1, {load: .6, bow: .1}); line(L, -70, -4, 30, -40, 1.6, {load: .9, w0: 1}); line(L, 40, 0, 84, -26, 1.3, {load: .85, w0: 1}) });
// a standard fallen: the pole along the ground, the cloth spread, in the greyed red
p('fallen', 230, 90, 40, (L, C) => { line(L, -90, -4, 90, -16, 1.6, {load: .9, w0: 1, w1: .6}); L.stroke([[60, -17, 3], [44, -8, 12], [18, -2, 13], [-4, -6, 6], [-16, -2, 1]], {pig: 'rust', load: .7, load1: .45, dry: .05, dry1: .6, streak: .8, rag: .3, pool: .3, gran: 1.1}); L.blot(30, 0, 40, 6, {dens: .16, rim: .1, soft: .7}) });
// the altar: a platform of rammed earth in two steps, a bronze cauldron on three legs, two poles with pennons of hide
p('altar', 380, 260, 150, (L, C) => { shadow(L, 10, 150);
  const step = (x0, x1, top, base, tone) => { L.mountain(() => top, {pig: 'white', dens: 2, fade: (base - top) * 1.02, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0, x1, feather: 3, rough: 0}); L.mountain(xx => top + (vnoise(xx * .05, 2) - .5) * 2, {dens: .22 * tone, fade: (base - top), fadeVar: .3, pow: .7, edge: 0, pig: 'och', blotch: .7, gran: 1.1, tide: 0, x0, x1, feather: 5});
    L.mountain(xx => top + (vnoise(xx * .05, 2) - .5) * 2, {dens: .22 * tone, fade: (base - top), fadeVar: .3, pow: .6, edge: .9, edgeW: 2.4, blotch: .6, tide: 0, x0, x1, feather: 4, rough: .8});
    for (let dy = 7; dy < base - top - 6; dy += C.R(7, 12)) { let x = x0 + C.R(4, 30); while (x < x1 - 14) { const len = C.R(24, 90); L.stroke([[x, top + dy, .5], [x + len * .5, top + dy + C.R(-1, 1), C.R(.7, 1.5)], [Math.min(x1, x + len), top + dy, .3]], {load: C.R(.2, .45) * tone, dry: .3, dry1: .85, streak: .7, pool: 0}); x += len + C.R(8, 60) } }
    L.stroke([[x0, top, 1.2], [(x0 + x1) / 2, top + 1, 2.2], [x1, top, 1.2]], {load: .85 * tone, dry: .05, dry1: .45, streak: .5, rag: .2}); line(L, x0, top, x0 - 8, base, 1.6, {load: .7 * tone, w0: 1, w1: .5}); line(L, x1, top, x1 + 10, base, 2, {load: .9 * tone, w0: 1, w1: .5}) };
  step(-140, 140, -44, 0, 1); step(-90, 90, -84, -44, .9);
  for (let i = 0; i < 6; i++) line(L, -18 + i * 7, -2 - i * 7.2, 22 + i * 7 * 0 + 18, -2 - i * 7.2, 1, {load: .6});                    // the steps up its front
  // the cauldron (鼎): two ears, a deep bowl with a band, three legs; malachite for its bronze, as the Shang's is
  L.blot(0, -112, 24, 15, {pig: 'mal', dens: .5, rim: .3, soft: .25, rough: .15, gran: 1.2}); L.stroke([[-25, -122, 1.2], [0, -119, 2.4], [25, -122, 1.2]], {load: .95, dry: .05, dry1: .3}); L.stroke([[-24, -112, 1], [0, -109, 1.6], [24, -112, 1]], {load: .7, dry: .2, dry1: .6});
  for (const lx of [-16, 0, 16]) line(L, lx, -100, lx + (lx ? Math.sign(lx) * 3 : 0), -84, 2.2, {load: .95, w0: 1, w1: .7}); for (const ex of [-18, 18]) { line(L, ex, -122, ex, -134, 1.4, {load: .95, w0: 1, w1: 1}); line(L, ex - 3, -134, ex + 3, -134, 1.2, {load: .95}) }
  for (const [px, h] of [[-120, 150], [118, 130]]) { line(L, px, -44, px + C.R(-3, 3), -44 - h, 1.5, {load: .9, w0: 1, w1: .5}); L.stroke([[px, -40 - h, 5], [px - 16, -34 - h, 4.4], [px - 34, -26 - h, .6]], {load: .5, dry: .2, dry1: .7, streak: .8, rag: .3}); L.stroke([[px, -30 - h, 3], [px - 12, -22 - h, 2.6], [px - 24, -12 - h, .4]], {load: .5, dry: .2, dry1: .7, streak: .8}) } });

/* ---------- the river: one water across the whole field, with a ford near the middle. It is painted once, in the
   field's own (squeezed) coordinates, and cut into tiles; a tile holds whatever part of it falls there. ---------- */
const RIVER = [[-200, 2150], [600, 2300], [1300, 2720], [2000, 2640], [2600, 2900], [3120, 3260], [3800, 3300], [4500, 3640], [5300, 3600], [6200, 3960]].map(([x, y]) => [x, y * KY]);
const FORD = .535;                                                  // where along it the ford lies
function river(L) { const C = chance(4242), P = RIVER, near = t => Math.exp(-(((t - FORD) / .022) ** 2)), wid = t => (40 + 12 * Math.sin(t * 31) + 8 * Math.sin(t * 77 + 1)) * (1 + .9 * near(t));
  for (let t = 0; t <= 1; t += .0016) { const a = along(P, t), w = wid(t); L.blot(a[0], a[1], w * 1.2, w * .66, {pig: 'azu', dens: .028 * (1 - .7 * near(t)), rim: 0, soft: .9, rough: .3, gran: .8, seed: 5 + t * 900}) }
  for (const s of [-1, 1]) { let t = 0; while (t < 1) { const len = C.R(.006, .016), mid = t + len / 2, p = [];
      for (let j = 0; j <= 4; j++) { const a = along(P, t + len * j / 4), w = wid(t + len * j / 4); p.push([a[0] - a[3] * w * s, a[1] + a[2] * w * s * KY, (s > 0 ? 2.5 : 1.6) * Math.sin(Math.PI * (j + .4) / 4.8) + .3]) }
      const open = 1 - near(mid) ** .5; if (open > .12) L.stroke(p, {load: (s > 0 ? .75 : .45) * C.R(.7, 1.15) * open, dry: C.R(.1, .3), dry1: C.R(.6, .9), streak: .6, rag: .25, pool: .1, seed: 11 + t * 3000 + s}); t += len + (C.rnd() < .2 ? C.R(.004, .012) : C.R(.0005, .003)) } }
  for (let i = 0; i < 420; i++) { const t = C.rnd(), a = along(P, t), w = wid(t), o = C.R(-.7, .7) * w, l = C.R(14, 46); L.stroke([[a[0] - a[3] * o - a[2] * l / 2, a[1] + a[2] * o * KY - a[3] * l / 2, .4], [a[0] - a[3] * o, a[1] + a[2] * o * KY, C.R(.7, 1.3)], [a[0] - a[3] * o + a[2] * l / 2, a[1] + a[2] * o * KY + a[3] * l / 2, .3]], {load: C.R(.1, .2), dry: .4, dry1: .9, streak: .7, pool: 0, seed: 21 + i}) }
  for (let i = 0; i < 26; i++) { const t = C.R(.02, .98); if (near(t) > .2) continue; const a = along(P, t), k = C.R(.35, .75), bx = a[0] + C.R(-20, 20), by = a[1] + C.R(-6, 12);
    rock(L, [[-40, 0], [-26, -18], [-8, -30], [12, -27], [22, -12], [40, 0]].map(([x, y]) => [bx + x * k, by + y * k]), {seed: 3 + i * 1.7, foot: by + 38, tone: 1.2, fade: 26 * k, x0: bx - 46 * k, x1: bx + 46 * k, k: .6 * k, fl: 12, fr: 14, body: 1, och: .08, accent: .5}); drag(L, bx - 34 * k, by + 4, 70 * k, 1.6, .28, C, {dry: .3}) }
  for (let i = 0; i < 34; i++) { const t = C.R(.02, .98); if (near(t) > .3) continue; const a = along(P, t), w = wid(t) + 8, s = C.rnd() < .5 ? 1 : -1; for (let j = 0; j < 6; j++) reed(L, a[0] - a[3] * w * s + C.R(-22, 22), a[1] + a[2] * w * s * KY + C.R(-4, 6), C.R(16, 34), C, {load: .6}) }
  // the ford: the banks give way, sand shows through, stones to step on, the ruts of carts going down into the water and out
  { const a = along(P, FORD), nx = -a[3], ny = a[2] * KY; L.blot(a[0], a[1], 150, 62, {pig: 'och', dens: .07, rim: .25, soft: .6, rough: .5, gran: 1, seed: 77}); L.blot(a[0] + 30, a[1] - 10, 80, 26, {pig: 'lift', dens: .6, rim: 0, soft: .8, rough: .5, gran: 0, seed: 78});
    for (let i = -4; i <= 4; i++) { const sx = a[0] + nx * i * 22 + C.R(-5, 5), sy = a[1] + ny * i * 22 + C.R(-3, 3), r = C.R(5, 9); L.blot(sx, sy, r, r * .55, {dens: C.R(.3, .5), rim: .7, rimW: .22, soft: .25, rough: .25, seed: 80 + i}); L.blot(sx + 2, sy + 2, r * 1.3, r * .5, {dens: .08, rim: 0, soft: .8, seed: 90 + i}) }
    for (const off of [-64, -38]) for (let u = -260; u < 260; u += C.R(30, 70)) { const l = C.R(24, 60), e = 1 - Math.exp(-((u / 70) ** 2)); L.stroke([[a[0] + a[2] * off + nx * u, a[1] + a[3] * off * KY + ny * u, .6], [a[0] + a[2] * off + nx * (u + l / 2), a[1] + a[3] * off * KY + ny * (u + l / 2), C.R(1.6, 3)], [a[0] + a[2] * off + nx * (u + l), a[1] + a[3] * off * KY + ny * (u + l), .4]], {load: C.R(.2, .36) * (.25 + .75 * e), dry: .35, dry1: .9, streak: .8, rag: .3, pool: 0, seed: 100 + u + off}) } }
}

/* ---------- marks: danger on the ground, what can be picked up, a curse in flight ---------- */
const MARKS = {};
const m = (name, w, h, px, py, paint) => { MARKS[name] = {w, h, px, py, paint} };
// DANGER is cinnabar, and nothing else on the ground is: a lane (drawn from its start, 600 long, stretched to fit) and a ring (radius 100, already squeezed)
m('lane', 640, 120, 20, 60, (L, C) => { L.stroke([[0, 0, 30], [200, C.R(-3, 3), 34], [420, C.R(-3, 3), 33], [600, 0, 26]], {pig: 'red', load: .34, load1: .26, dry: .1, dry1: .5, streak: .9, rag: .3, pool: .5, gran: 1.1, soft: .1});
  for (const s of [-1, 1]) L.stroke([[0, s * 32, 1.2], [300, s * 35 + C.R(-2, 2), 2.6], [600, s * 29, 1]], {pig: 'red', load: 1.1, dry: .1, dry1: .7, streak: .7, rag: .3}); for (let i = 0; i < 5; i++) { const x = 80 + i * 110; for (const s of [-1, 1]) L.stroke([[x, s * 26, .6], [x + 16, s * 13, 2.2], [x + 34, 0, .5]], {pig: 'red', load: .9, dry: .15, dry1: .7}) } });
m('warn', 260, 170, 130, 85, (L, C) => { L.blot(0, 0, 96, 59, {pig: 'red', dens: .22, rim: .9, rimW: .08, soft: .2, rough: .12, gran: 1.1}); for (const [a0, a1] of [[.2, 2.6], [3.4, 5.9]]) { const p = []; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; p.push([Math.cos(a) * 100, Math.sin(a) * 62, 1 + 2.4 * Math.sin(Math.PI * (i + .5) / 11)]) } L.stroke(p, {pig: 'red', load: 1.2, dry: .1, dry1: .75, streak: .7, rag: .3}) } });
// battle spirit: a gold flame standing on a point of ink, on a little paper of its own so that it shows on any ground. Three sizes.
[[.8, 0], [1.1, 1], [1.5, 2]].forEach(([k, i]) => m('spirit' + i, 60, 70, 30, 56, (L, C) => { L.blot(0, -14 * k, 15 * k, 17 * k, {pig: 'white', dens: 1.3, rim: 0, soft: .6, rough: .2}); L.blot(1, 1, 8 * k, 2.6 * k, {dens: .5, rim: .2, soft: .5});
  L.stroke([[0, -1, 1], [-5 * k, -8 * k, 5.4 * k], [-1 * k, -18 * k, 3.4 * k], [4 * k, -28 * k, .3]], {pig: 'gold', load: 1.5, dry: 0, dry1: .3, streak: .4, rag: .2, pool: .4, side: -.4}); L.stroke([[2 * k, -3 * k, .8], [5 * k, -10 * k, 2.6 * k], [3 * k, -17 * k, .3]], {pig: 'gold', load: 1.2, dry: 0, dry1: .4});
  L.stroke([[-6 * k, -5 * k, .5], [-7.5 * k, -11 * k, 1.1], [-3 * k, -19 * k, .6], [3 * k, -27 * k, .2]], {load: .7, dry: .1, dry1: .5, pool: 0}); if (i) L.stroke([[-2 * k, -9 * k, .5], [0, -13 * k, 1.6 * k], [1 * k, -17 * k, .3]], {pig: 'white', load: 1, pool: 0}) }));
// a peach (mends): round, with a leaf; a lodestone: a dark stone in a ring of azurite; a chest: lacquer with a gold band
m('peach', 60, 60, 30, 48, (L, C) => { L.blot(0, -12, 17, 17, {pig: 'white', dens: 1.3, rim: 0, soft: .5}); L.blot(1, 1, 10, 3, {dens: .5, rim: .2, soft: .5}); L.blot(0, -11, 10, 10.5, {pig: 'rust', dens: .55, rim: .5, rimW: .14, soft: .2, rough: .12, gran: 1}); L.blot(-3, -14, 4, 4, {pig: 'white', dens: .5, rim: 0, soft: .7});
  L.stroke([[0, -21, .6], [6, -27, 3], [13, -26, .4]], {pig: 'mal', load: 1.2, dry: 0, dry1: .4}); L.stroke([[0, -2, .5], [-1, -11, .9], [0, -21, .6]], {load: .5, dry: .2, dry1: .7, pool: 0}) });
m('lodestone', 70, 60, 35, 44, (L, C) => { L.blot(0, -8, 22, 16, {pig: 'white', dens: 1.3, rim: 0, soft: .5}); const p = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; p.push([Math.cos(a) * 20, -6 + Math.sin(a) * 9, 1 + 1.2 * Math.sin(a + 2)]) } L.stroke(p, {pig: 'azu', load: 1.3, dry: 0, dry1: .4, streak: .5});
  L.stroke([[-8, -2, 2], [-5, -13, 6], [5, -15, 5], [9, -3, 2]], {load: 1.1, dry: 0, dry1: .3, streak: .5, rag: .3, side: -.5}); L.blot(1, 1, 11, 3, {dens: .5, rim: .2, soft: .5}) });
m('chest', 90, 80, 45, 62, (L, C) => { L.blot(0, -18, 34, 26, {pig: 'white', dens: 1.4, rim: 0, soft: .4}); L.blot(3, 2, 30, 6, {dens: .45, rim: .2, soft: .6}); for (let i = 0; i < 5; i++) L.stroke([[-24, -6 - i * 6, 3.4], [0, -7 - i * 6, 4], [24, -6 - i * 6, 3.4]], {load: 1.25, dry: 0, dry1: .2, streak: .4, rag: .15});
  L.stroke([[-26, -19, 1.6], [0, -20, 2.6], [26, -19, 1.6]], {pig: 'white', load: 1.5, pool: 0}); L.stroke([[-26, -19, 1.4], [0, -20, 2.2], [26, -19, 1.4]], {pig: 'gold', load: 1.6, dry: 0, dry1: .2}); L.blot(0, -19, 4.4, 4.4, {pig: 'white', dens: 1.5, rim: 0, soft: .2}); L.blot(0, -19, 3.6, 3.6, {pig: 'gold', dens: 1.5, rim: .3, soft: .2});
  L.stroke([[-27, -36, 1.2], [0, -41, 2.2], [27, -36, 1.2]], {load: 1.1, dry: .05, dry1: .3}) });
// a shaman's curse in flight: a dark wet blot with a malachite heart and a tail
m('orb', 70, 40, 44, 20, (L, C) => { L.stroke([[-36, 0, .6], [-16, C.R(-2, 2), 4], [0, 0, 8]], {load: .7, dry: .3, dry1: .2, streak: .8, rag: .4, dryPow: .5}); L.blot(4, 0, 11, 10, {dens: 1.1, rim: .4, soft: .3, rough: .3}); L.blot(5, -1, 5, 5, {pig: 'white', dens: 1, rim: 0, soft: .4}); L.blot(5, -1, 4.6, 4.6, {pig: 'mal', dens: 1.2, rim: .3, soft: .3}) });
// the paper kept clear under the hero (white, soft everywhere): the run time fills it with the paper's colour
m('clear', 200, 130, 100, 65, (L, C) => { L.blot(0, 0, 70, 42, {pig: 'white', dens: 1.25, rim: 0, soft: .95, rough: .22, freq: .02, gran: 0}) });

/* ---------- bake ---------- */
async function atlas(defs, file, s, quality) {
  const names = Object.keys(defs).sort((a, b) => defs[b].h - defs[a].h), AW = 2048, cells = {}, parts = []; let x = 0, y = 0, rowH = 0;
  for (const n of names) { const q = defs[n], W = Math.ceil(q.w * s), H = Math.ceil(q.h * s); if (x + W > AW) { x = 0; y += rowH + 2; rowH = 0 }
    const px = q.px ?? q.w / 2, py = q.py ?? q.h / 2, L = new Layer(q.w, q.h, s, px, py); L.seed = n.length * 5.3 + n.charCodeAt(n.length - 1); q.paint(L, chance(n.split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 11)));
    parts.push({input: rgbaOf(L), raw: {width: L.W, height: L.H, channels: 4}, left: x, top: y}); cells[n] = [x, y, L.W, L.H, px, py, s, q.r || 0]; x += W + 2; rowH = Math.max(rowH, H) }
  await sharp({create: {width: AW, height: y + rowH, channels: 4, background: {r: PAPER[0], g: PAPER[1], b: PAPER[2], alpha: 0}}}).composite(parts).webp({quality, alphaQuality: 80, effort: 6}).toFile(join(OUT, file));
  console.log(file, AW + 'x' + (y + rowH), names.length, 'pieces', statSync(join(OUT, file)).size, 'bytes'); return {w: AW, h: y + rowH, cells};
}
const t0 = performance.now();
for (const f of readdirSync(OUT)) if (/^river-\d+\.webp$/.test(f)) unlinkSync(join(OUT, f));
const TW = 1536, TH = 768, tiles = []; { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let t = 0; t <= 1; t += .002) { const a = along(RIVER, t); x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]) }
  x0 = Math.max(-160, x0 - 160); x1 = Math.min(6160, x1 + 160); y0 -= 220; y1 += 220;
  for (let ty = Math.floor(y0 / TH) * TH; ty < y1; ty += TH) for (let tx = Math.floor(x0 / TW) * TW; tx < x1; tx += TW) { let hit = false; for (let t = 0; t <= 1 && !hit; t += .002) { const a = along(RIVER, t); if (a[0] > tx - 200 && a[0] < tx + TW + 200 && a[1] > ty - 200 && a[1] < ty + TH + 200) hit = true } if (!hit) continue;
    const L = new Layer(TW, TH, 1, -tx, -ty); L.seed = 9; river(L); const raw = rgbaOf(L); let any = false; for (let i = 3; i < raw.length; i += 4) if (raw[i] > 6) { any = true; break } if (!any) continue;
    const file = `river-${tiles.length}.webp`; await sharp(raw, {raw: {width: TW, height: TH, channels: 4}}).webp({quality: 76, alphaQuality: 78, effort: 6}).toFile(join(OUT, file)); tiles.push({file, x: tx, y: ty, w: TW, h: TH}); console.log(file, tx, ty, statSync(join(OUT, file)).size) } }

const fa = along(RIVER, FORD), riverPath = []; for (let t = 0; t <= 1.0001; t += .01) { const a = along(RIVER, t); riverPath.push([Math.round(a[0]), Math.round(a[1] / KY)]) }
const marksAtlas = await atlas(MARKS, 'marks.webp', 2, 84);
const out = {ky: KY, paper: PAPER, marks: marksAtlas, river: {tiles, path: riverPath, ford: [Math.round(fa[0]), Math.round(fa[1] / KY)]}, ground: await atlas(GROUND, 'ground.webp', 1, 78), props: await atlas(PROPS, 'props.webp', 2.25, 82)};
writeFileSync(join(OUT, 'field.json'), JSON.stringify(out)); console.log(((performance.now() - t0) / 1000).toFixed(1) + ' s');
