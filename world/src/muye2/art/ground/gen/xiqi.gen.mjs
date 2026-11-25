// node world/src/muye2/art/ground/gen/xiqi.gen.mjs [only=far,land,river,ground,props,mist] [proof=<dir>]
// Scene one of the campaign: outside Xiqi (西岐), Mount Qi (岐山) to the north and the Wei (渭水) across the plain, painted
// as a blue-green landscape (青绿山水) for a battle to be fought on. The rule of the picture: the open ground where the
// figures stand is a quiet ochre-and-green wash with little ink in it; the beauty is carried by the far band (the range
// and the city wall over the mist), the river, the groves and rocks at the edges of clearings, and the four landmarks.
// Painted with the ink engine of the side-view scene (world/src/fengshen/art/scene2/gen/ink.mjs, brush.mjs, read only).
// Output in ../baked/xiqi/: far.webp (the band at the top of the screen), land-<c>.webp (the whole field's wash at a
// quarter size, one per river course), river-<c>-<i>.webp (the river's drawing, cut in tiles), ground.webp (pieces that
// lie), props.webp (pieces that stand), mist.webp, xiqi.json (where every piece sits in its atlas), courses.js (the river
// courses as data: read by layout.js, which the rules may import).
// Projection: ground (x, y) is drawn at (x, y * KY); pieces that lie are painted already squeezed, pieces that stand are not.
import {writeFileSync, mkdirSync, statSync, readdirSync, unlinkSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ART = '../../../../fengshen/art/scene2/gen/';
const {Layer, sharp, chance, fbm, vnoise, clamp, smooth, PAPER, PIG} = await import(ART + 'ink.mjs');
const {ridgeOf, slope, rock, ghost, cutMist, pine, pineFar, bare, leaf, reed, drag} = await import(ART + 'brush.mjs');
PIG.gold = [.31, .52, 1.27];                    // bronze gold (scenery uses it only as a dull bronze on the cauldron)
PIG.apri = [.18, .46, 1.35];                    // apricot yellow (杏黄) for the investiture platform's banner: pale, never the pickups' gold
PIG.ochd = [.42, .66, .98];                     // a deeper earth for rammed walls and thatch
const KY = 0.62, WORLD = 6000;
const arg = k => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const SCENE = arg('scene') || 'xiqi', BAKED = join(dirname(fileURLToPath(import.meta.url)), '..', 'baked'), OUT = join(BAKED, SCENE), SHARED = join(BAKED, 'xiqi'); mkdirSync(OUT, {recursive: true});
const ONLY = arg('only') ? arg('only').split(',') : null, PROOF = arg('proof') || null, want = n => !ONLY || ONLY.includes(n);
const INK = [34, 30, 26];

/* ---------- sheet -> RGBA to lay over paper (as the field generator does) ---------- */
function rgbaOf(L) {
  const m = L.inkMask(), c = L.colour(), wh = L.wh, out = Buffer.alloc(L.N * 4);
  for (let i = 0; i < L.N; i++) { const a = m[i] / 255, w = wh ? Math.min(1, wh[i]) : 0; let A = Math.max(a, w); const F = [0, 0, 0];
    for (let k = 0; k < 3; k++) { let v = PAPER[k]; if (c && c[i * 4 + 3]) { const ca = c[i * 4 + 3] / 255; v *= 1 - ca * (1 - c[i * 4 + k] / 255) } F[k] = v * (1 - a) + INK[k] * a; A = Math.max(A, 1 - F[k] / PAPER[k]) }
    if (A < .006) continue; A = Math.min(1, A + .004);
    for (let k = 0; k < 3; k++) out[i * 4 + k] = clamp((F[k] - PAPER[k] * (1 - A)) / A, 0, 255); out[i * 4 + 3] = A * 255 }
  return out;
}
async function proof(name, raw, w, h) { if (!PROOF) return; mkdirSync(PROOF, {recursive: true});
  await sharp({create: {width: w, height: h, channels: 3, background: {r: PAPER[0], g: PAPER[1], b: PAPER[2]}}}).composite([{input: raw, raw: {width: w, height: h, channels: 4}}]).jpeg({quality: 86}).toFile(join(PROOF, name + '.jpg')) }

/* ---------- small things made of a few strokes (some re-cut from the side-view scene's generator) ---------- */
const line = (L, x0, y0, x1, y1, w, o = {}) => { const bow = o.bow ?? 0, mx = (x0 + x1) / 2 - (y1 - y0) * bow, my = (y0 + y1) / 2 + (x1 - x0) * bow;
  return L.stroke([[x0, y0, w * (o.w0 ?? .7)], [mx, my, w], [x1, y1, w * (o.w1 ?? .3)]], {load: .8, dry: .05, dry1: .45, streak: .4, rag: .15, pool: .05, ...o}) };
const body = (L, prof, x0, x1, y, o = 1) => { let top = 1e9; for (let x = x0; x <= x1; x += 4) top = Math.min(top, prof(x)); L.mountain(prof, {pig: 'white', dens: 2 * o, fade: (y - top) * 1.02, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0, x1, feather: 3, rough: 0, floor: y + 1.5, floorSoft: 1.5}) };      // paper kept under a profile down to y, and never below it
const along = (P, t) => { const n = P.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, g = k => P[clamp(k, 0, n)], a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
  const q = m => .5 * (2 * b[m] + (c[m] - a[m]) * u + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u * u + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u * u), dq = m => .5 * ((c[m] - a[m]) + 2 * (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u + 3 * (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u);
  const dx = dq(0), dy = dq(1), l = Math.hypot(dx, dy) || 1; return [q(0), q(1), dx / l, dy / l] };
// rammed earth wall (re-cut from scene2): its top line, ramming courses, gullies, battered ends
function wall(L, C, x0, x1, base, top, o = {}) {
  const tone = o.tone ?? 1, sd = x0 * .013, wy = x => top(x) + (vnoise(x * .05, 2) - .5) * 1.6 * (o.k ?? 1), hgt = base - top(x0), bat = hgt * .2, k = o.k ?? 1;
  const shade = x => .7 + .6 * fbm(x * .005 + sd, 3, 2);
  body(L, top, x0, x1, base + 1);
  L.mountain(wy, {dens: .24 * tone, fade: hgt * .95, fadeVar: .3, pow: .7, edge: 0, pig: 'och', blotch: .7, gran: 1.1, tide: 0, x0, x1, feather: 4, mod: shade});
  L.mountain(wy, {dens: .26 * tone, fade: hgt * 1.0, fadeVar: .3, pow: .6, edge: .9, edgeW: 2 * k, blotch: .6, tide: 0, x0, x1, feather: 4, rough: .6, mod: x => 1.7 - shade(x)});
  for (let dy = C.R(5, 9) * k; dy < hgt - 8 * k; dy += C.R(5, 12) * k) { let x = x0 + C.R(4, 60) * k; while (x < x1 - 10) { const len = C.R(20, 110) * k, tilt = C.R(-.012, .012) * len; L.stroke([[x, wy(x) + dy, .4], [x + len * C.R(.3, .7), wy(x + len * .5) + dy + tilt * .5, C.R(.5, 1.3) * k], [x + len, wy(x + len) + dy + tilt, .25]], {load: C.R(.2, .45) * tone * (1 - .5 * dy / hgt), dry: C.R(.2, .45), dry1: C.R(.7, .92), streak: .7, pool: 0}); x += len + (C.rnd() < .35 ? C.R(60, 180) * k : C.R(8, 40) * k) } }
  let x = x0 + 4;
  while (x < x1 - 10) { const len = C.R(40, 110) * k, p = []; for (let u = 0; u <= len; u += 8) p.push([Math.min(x1, x + u), wy(x + u) + .5, 1.5 * k * (.5 + .8 * Math.sin(Math.PI * Math.min(1, u / len * 1.15 + .05)))]); L.stroke(p, {load: .8 * tone, dry: C.R(0, .15), dry1: C.R(.35, .6), streak: .5, rag: .2, pool: .15}); x += len + C.R(2, 10) }
  const end = (xe, dir) => { const t0 = top(xe); body(L, xx => t0 + Math.abs(xx - xe) / bat * hgt, Math.min(xe, xe + dir * bat), Math.max(xe, xe + dir * bat), base + 1);
    for (let i = 0; i < 3; i++) { const t = i / 3 + C.R(0, .1), yt = t0 + 3 + hgt * t, w = C.R(3, 6) * k; L.stroke([[xe, yt, w * .6], [xe + dir * bat * (1 - t) * .5, (yt + base) / 2, w], [xe + dir * bat * (1 - t) * .96, base - 2, w * .3]], {pig: 'och', load: .3 * tone, dry: .15, dry1: .8, streak: .9, rag: .3}) }
    line(L, xe + dir * bat, base, xe, t0 + 1, 1.8 * k, {load: .85 * tone, w0: .5, w1: 1, bow: dir * .02}) };
  if (o.endL) end(x0, -1); if (o.endR) end(x1, 1);
}
// battlements (雉堞) along a wall top: small teeth of paper with a pressed line
function crenels(L, C, x0, x1, top, k = 1, tone = 1) { for (let x = x0 + 4 * k; x < x1 - 6 * k; x += 11 * k) { const y = top(x); body(L, () => y - 5 * k, x, x + 6 * k, y + 1); line(L, x, y - 5 * k, x + 6 * k, y - 5 * k, .9 * k, {load: .75 * tone, w0: .8, w1: .8}); line(L, x + 6 * k, y - 5 * k, x + 6 * k, y, .7 * k, {load: .6 * tone, w0: 1, w1: 1}) } }
// thatch between a ridge and an eave (scene2's roof): side-brush pulls, hips, ridge, eave
function roof(L, x, y0, y1, a, b, C, tone = 1, k = 1, mal = 0, och = .16) {
  body(L, xx => { const u = Math.abs(xx - x); return u < a ? y0 : y0 + (y1 - y0) * (u - a) / (b * 1.04 - a) }, x - b * 1.04, x + b * 1.04, y1 + 1);
  if (och) L.blot(x, (y0 + y1) / 2, b * .9, (y1 - y0) * .45, {pig: 'och', dens: och, rim: .2, soft: .5, rough: .3, gran: 1.2});
  if (mal) for (let i = 0; i < 4; i++) { const t = C.R(.1, .9), tx = x - a + 2 * a * t, bx = x - b + 2 * b * t; L.stroke([[tx, y0 + 3, 4 * k], [(tx + bx) / 2, (y0 + y1) / 2, 8 * k], [bx, y1 - 2, 3 * k]], {pig: 'mal', load: mal * C.R(.6, 1.1), dry: .2, dry1: .85, streak: .9, rag: .3, gran: 1.4}) }
  for (let i = 0, n = Math.max(5, Math.round(b / 6)); i < n; i++) { const t = (i + C.R(.1, .9)) / n, tx = x - a + 2 * a * t, bx = x - b + 2 * b * t, ww = C.R(2.5, 6) * k;
    L.stroke([[tx, y0 + 1, ww * .5], [(tx + bx) / 2 + C.R(-2, 2), (y0 + y1) / 2 + (y1 - y0) * .06, ww], [bx, y1 - 1, ww * .5]], {load: tone * C.R(.3, .55) * (t > .55 ? 1.3 : 1), load1: tone * .3, dry: C.R(.1, .25), dry1: C.R(.55, .85), side: t < .5 ? .5 : -.6, streak: .9, rag: .3, pool: .15}) }
  line(L, x - a, y0, x - b * 1.04, y1 + 1, 1.3 * k, {load: .8 * tone, bow: .04}); line(L, x + a, y0, x + b * 1.04, y1 + 1, 1.6 * k, {load: .95 * tone, bow: -.04});
  L.stroke([[x - a - 3, y0 + 1, .7 * k], [x, y0 - 1, 1.8 * k], [x + a + 3, y0 + 1, .8 * k]], {load: 1.0 * tone, dry: .05, dry1: .4, streak: .5, rag: .25});
  L.stroke([[x - b * 1.08, y1, .7 * k], [x - b * .3, y1 + 2, 1.9 * k], [x + b * .4, y1 + 2, 2.1 * k], [x + b * 1.08, y1, .7 * k]], {load: 1.0 * tone, dry: .08, dry1: .45, streak: .6, rag: .3});
}
// a hall: posts, the dark under the eave, a hipped roof (two eaves for the great ones: 四阿重屋)
function hall(L, x, y, w, h, C, o = {}) {
  const tone = o.tone ?? 1, posts = o.posts ?? 4, k = o.k ?? 1, two = o.two, ph = h * (two ? .3 : .44), ey = y - ph, ry = y - h;
  body(L, () => ey, x - w * .84, x + w * .84, y + 1);
  if (o.wallTone) L.blot(x, y - ph * .5, w * .8, ph * .5, {pig: 'och', dens: o.wallTone, rim: .2, soft: .3, rough: .2, gran: 1});
  L.stroke([[x - w * .82, ey + ph * .36, ph * .2], [x, ey + ph * .38, ph * .3], [x + w * .82, ey + ph * .36, ph * .2]], {load: .5 * tone, dry: .1, dry1: .5, streak: .7, rag: .3, pool: .2});
  for (let i = 0; i < posts; i++) { const px = x - w * .8 + i * w * 1.6 / (posts - 1); line(L, px, y, px + C.R(-.8, .8), ey, 1.2 * k, {load: .92 * tone, w0: 1, w1: .85, dry1: .2}) }
  line(L, x - w * .92, y, x + w * .92, y + C.R(-1, 1), 1.1 * k, {load: .7 * tone, w0: .6, w1: .5});
  if (!two) return roof(L, x, ry, ey, w * .42, w, C, tone, k, o.mal);
  const s1 = ey - h * .2, s2 = s1 - h * .1;
  roof(L, x, s1, ey, w * .7, w, C, tone, k, o.mal);
  L.stroke([[x - w * .62, (s1 + s2) / 2, h * .04], [x, (s1 + s2) / 2 + 1, h * .055], [x + w * .62, (s1 + s2) / 2, h * .04]], {load: .7 * tone, dry: .05, dry1: .4, streak: .6, rag: .25});
  roof(L, x, ry, s2, w * .34, w * .76, C, tone, k, o.mal);
}
function smoke(L, x, y, h, C, load = .07, lean = .55) {
  for (let j = 0; j < 2; j++) { const p = [], a = C.R(.8, 1.2) * lean; for (let i = 0; i <= 6; i++) { const t = i / 6; p.push([x - h * a * t * t + C.R(-4, 4) + j * 5 * t, y - h * t * (1 - .1 * j), 1.2 + (6 + 5 * j) * t + C.R(0, 2)]) }
    L.stroke(p, {load: load * (1 - .3 * j), load1: load * .15, dry: .1, dry1: .75, streak: .7, rag: .6, soft: .6, bleed: .6, bleedR: 4, pool: 0}) }
}
// a pennant on a pole, cloth in a given pigment, hanging down wind (left)
function pennant(L, x, y, h, C, pig = 'azu', len = 28, load = .75) { line(L, x, y, x + C.R(-1, 1), y - h, 1.2, {load: .9, w0: 1, w1: .6, dry1: .3});
  L.stroke([[x, y - h + 2, 4], [x - len * .45, y - h + 4 + C.R(-1, 2), 3.6], [x - len, y - h + 9, .4]], {pig, load, dry: .1, dry1: .6, streak: .6, rag: .3, pool: .3, gran: 1.1});
  L.stroke([[x, y - h + 2, 1], [x - len * .45, y - h + 1, 1.1], [x - len, y - h + 7, .2]], {load: .45, dry: .2, dry1: .7}) }

/* ---------- trees and rocks of the blue-green manner ---------- */
// a pine: the ink pine of the scene, then mineral green laid into its needle masses and a breath of azurite on top
function greenPine(L, x, y, h, C, o = {}) {
  pine(L, x, y, h, C, {load: o.load ?? .78, thick: o.thick, lean: o.lean});
  const lean = o.lean ?? 0;
  for (let i = 0, n = 5 + Math.floor(h / 30); i < n; i++) { const t = .45 + .55 * C.rnd(), cx = x + lean * h * t + C.R(-.26, .14) * h * (1.1 - t), cy = y - h * t + C.R(-4, 6);
    L.blot(cx, cy, h * C.R(.1, .17), h * C.R(.045, .07), {pig: 'mal', dens: C.R(.35, .6), rim: .5, rimW: .14, soft: .35, rough: .5, freq: .06, gran: 1.4});
    if (C.rnd() < .45) L.blot(cx + C.R(-4, 4), cy - h * .03, h * C.R(.06, .1), h * .03, {pig: 'azu', dens: C.R(.2, .34), rim: .4, soft: .4, rough: .5, freq: .07, gran: 1.4}) }
}
// a broadleaf tree in the outline-and-fill manner (双勾 and 点叶): a trunk, clumps of dotted leaves in malachite and ink
function dotTree(L, x, y, h, C, o = {}) {
  const lean = o.lean ?? C.R(-.15, .12), tw = Math.max(1.4, h * .04), pig = o.pig || 'mal';
  const P = []; for (let i = 0; i <= 5; i++) { const t = i / 5; P.push([x + lean * h * t * .6 + Math.sin(t * 4 + x) * h * .03, y - h * .78 * t, tw * (1.3 - .9 * t)]) }
  L.stroke(P, {load: .85, dry: .1, dry1: .5, side: .7, streak: .7, rag: .22, pool: .1});
  for (let b = 0; b < 3; b++) { const t = .5 + b * .14, bx = x + lean * h * t * .6, by = y - h * .78 * t, s = b % 2 ? 1 : -1; line(L, bx, by, bx + s * h * C.R(.18, .3), by - h * C.R(.1, .16), tw * .5, {load: .8, bow: s * .1}) }
  const clumps = o.clumps ?? 5 + Math.floor(C.R(0, 3));
  for (let i = 0; i < clumps; i++) { const a = C.R(-Math.PI, 0), r = C.R(.1, .34) * h, cx = x + lean * h * .45 + Math.cos(a) * r * 1.2, cy = y - h * .66 + Math.sin(a) * r * .6, cr = h * C.R(.13, .2);
    L.blot(cx, cy, cr * 1.1, cr * .75, {pig, dens: C.R(.4, .7), rim: .55, rimW: .12, soft: .3, rough: .6, freq: .05, gran: 1.4});
    if (o.azu) L.blot(cx - cr * .2, cy - cr * .3, cr * .6, cr * .35, {pig: 'azu', dens: o.azu * C.R(.5, 1), rim: .4, soft: .4, rough: .6, freq: .06, gran: 1.4});
    for (let j = 0, n = Math.round(cr * .9); j < n; j++) { const dx = C.gauss() * cr * .9, dy = C.gauss() * cr * .6; L.stroke([[cx + dx - 2, cy + dy, .6], [cx + dx, cy + dy - .5, C.R(1.3, 2.4)], [cx + dx + 2, cy + dy + .5, .5]], {load: C.R(.55, .95), dry: 0, dry1: .3, pool: .2, rag: .1, streak: .2}) } }
}
// a willow by the water: a dark short trunk, and long hanging strands in malachite and ink, leaning with the wind
function willow(L, x, y, h, C) {
  const tw = Math.max(1.6, h * .045), lean = C.R(-.12, .05), tx = x + lean * h * .5, ty = y - h * .62;
  L.stroke([[x, y, tw * 1.3], [x + lean * h * .25, y - h * .3, tw], [tx, ty, tw * .55]], {load: .95, dry: .1, dry1: .5, side: .7, streak: .7, rag: .3, pool: .15});
  for (let b = 0; b < 4; b++) { const s2 = b % 2 ? 1 : -1; line(L, tx, ty + 8, tx + s2 * h * C.R(.12, .24), ty - h * C.R(.06, .16), tw * .4, {load: .85, bow: s2 * .12}) }
  for (let i = 0; i < 6; i++) L.blot(tx + C.R(-.28, .28) * h, ty - h * C.R(.02, .14), h * C.R(.1, .16), h * C.R(.05, .08), {pig: 'mal', dens: C.R(.2, .32), rim: .4, soft: .5, rough: .6, freq: .05, gran: 1.3});
  for (let s2 = 0, n = 46; s2 < n; s2++) { const u = C.R(-1, 1), sx = tx + u * h * .3, sy = ty - h * .12 * (1 - u * u) + C.R(-4, 4), len = h * C.R(.25, .55) * (1 - .35 * Math.abs(u)), sw = -C.R(.02, .1) * len;
    L.stroke([[sx, sy, .4], [sx + sw * .35, sy + len * .45, C.R(.6, 1.1)], [sx + sw, sy + len, .15]], {pig: C.rnd() < .7 ? 'mal' : 'ink', load: C.R(.4, .8), dry: .1, dry1: .6, streak: .5, rag: .2, pool: .1}) }
}
// a blue-green rock: scene2's rock with stronger mineral facets
function greenRock(L, x, y, w, hgt, C, seed, o = {}) {
  massif(L, C, x - w / 2, x + w / 2, y, [[x - w * .12, hgt, w * .5], [x + w * .18, hgt * C.R(.7, .9), w * .42]], seed, {tone: .8, azu: o.azu ?? .55, mal: o.mal ?? .55, och: .2, trees: 0, k: Math.max(.5, w / 260)});
  drag(L, x - w * .55, y + 2, w * 1.1, 1.4, .22, C, {dry: .35});
  for (let j = 0; j < 5; j++) leaf(L, x + C.R(-.5, .5) * w, y + 2, C.R(6, 14), C.R(-.6, .2), C, {load: .5, w: .5});
}

/* ======================================================================================================================
   1. THE FAR BAND: what lies north beyond the field, seen over the mist at the top of the screen. One strip, 4400 x 520,
   slid with the camera (a third of its speed). Bottom 30% is mist: it melts into the ground below. Twin-peaked Qi
   (岐: the forked mountain) in the middle, ranges either side; the walls of Xiqi on the near hills to the west.
   ====================================================================================================================== */
const FAR = {w: 4400, h: 520, foot: 430};
// undo whatever a painter laid above a skyline (strokes thrown off a steep slope into the sky), keeping what was there before
function clipAbove(L, keep, rf, x0, x1) { const s = L.s, W = L.W, ox = L.xf.ox;
  for (let X = Math.max(0, Math.floor((x0 + ox) * s)); X < Math.min(W, Math.ceil((x1 + ox) * s)); X++) { const ys = (rf(X / s - ox) + L.xf.oy) * s - 1.5;
    for (let Y = 0; Y < Math.min(L.H, ys); Y++) { const i = Y * W + X; for (const n in L.d) { const a = L.d[n], b = keep[n]; a[i] = b ? b[i] : 0 } } } }
// a mountain mass in the blue-green manner, from a list of peaks [x, height, half-width]: a ragged skyline (cliffs, steps,
// worn heads), paper kept under it; an ochre ground, malachite on the body and azurite on the heads, each a graded wash
// fading down; then the ink structure of rock() over the colour
function massif(L, C, x0, x1, base, peaks, seed, o = {}) {
  const k = o.k ?? 1, pts = [];
  for (let x = x0; x <= x1; x += C.R(14, 26) * k) { let h = 0; for (const [px, ph, pw] of peaks) { const u = Math.abs(x - px) / pw; const v = u < 1 ? ph * (1 - u * u * (3 - 2 * u)) ** .8 : 0; h = Math.max(h, v) }
    h *= .9 + .2 * fbm(x * .02 + seed, 3, 2); if (h > 30 && vnoise(x * .03 + seed * 3, 1) > .72) h -= C.R(6, 16) * k;
    const e = smooth(x0, x0 + 60, x) * (1 - smooth(x1 - 60, x1, x)); pts.push([x, base - Math.max(6, h) * e - 6]) }
  const rf = ridgeOf(pts, seed, 4 * k), fade = Math.max(...peaks.map(p => p[1])) * 1.05;
  L.mountain(rf, {pig: 'white', dens: 3, fade, fadeVar: 0, pow: .1, edge: 0, blotch: 0, tide: 0, gran: 0, x0, x1, feather: 10, rough: 0, floor: base - 4, floorSoft: 30, seed});
  L.mountain(rf, {pig: 'och', dens: o.och ?? .14, fade, fadeVar: .4, pow: .5, edge: 0, blotch: .7, tide: .3, gran: 1.1, x0, x1, feather: 30, floor: base - 4, floorSoft: 40, seed: seed + 1});
  L.mountain(rf, {pig: 'mal', dens: o.mal ?? .45, fade: fade * .62, fadeVar: .6, pow: 1.1, edge: .4, edgeW: 3, blotch: .7, tide: .5, gran: 1.4, x0, x1, feather: 30, floor: base - 10, floorSoft: 50, seed: seed + 2});
  L.mountain(rf, {pig: 'azu', dens: o.azu ?? .45, fade: fade * .3, fadeVar: .7, pow: 1.3, edge: .6, edgeW: 3, blotch: .7, tide: .6, gran: 1.5, x0, x1, feather: 30, floor: base - 20, floorSoft: 50, seed: seed + 3});
  const keep = {}; for (const n in L.d) keep[n] = L.d[n].slice();
  rock(L, pts, {seed, foot: base - 2, tone: o.tone ?? .7, fade: fade * .8, x0, x1, k: 1.1 * k, fl: 40, fr: 40, azu: (o.azu ?? .45) * .9, mal: (o.mal ?? .45) * .9, trees: o.trees ?? 3, accent: .6, crag: 4 * k});
  clipAbove(L, keep, rf, x0, x1);
  return rf;
}
function paintFar(L) {
  const C = chance(31), F = FAR.foot;
  // the sky is paper, and covers the ground under the band
  body(L, () => 0, 0, FAR.w, F + 40);
  // 1. the farthest ranges: azurite breath, soft tops, long level lines (平远)
  const range = (x0, x1, base, hgt, seed, dens, azu, step = 70) => { const pts = []; let x = x0; while (x <= x1) { const t = (x - x0) / (x1 - x0), env = Math.sin(Math.PI * t) ** .55; pts.push([x, base - hgt * env * (.35 + 1.0 * fbm(x * .004 + seed, 2, 3) ** 1.3)]); x += C.R(step * .6, step * 1.3) }
    ghost(L, pts, {seed, dens, azu, och: .03, fade: hgt * 1.1, x0, x1, feather: 160, crag: 6, line: .1}) };
  range(-100, 1500, 330, 170, 2.2, .05, .16); range(1100, 2600, 300, 210, 3.7, .055, .2); range(2300, 3700, 320, 180, 5.1, .05, .18); range(3300, 4500, 330, 170, 6.6, .05, .16);
  for (const [mx, my, rx, ry] of [[600, 318, 420, 26], [1800, 300, 360, 22], [3000, 316, 420, 24], [3900, 322, 300, 20]]) cutMist(L, mx, my, rx, ry, .7);
  // 2. Mount Qi: a forked massif (岐), built as overlapping masses in blue-green, back to front
  const qx = 2200;
  massif(L, C, qx - 700, qx + 760, 446, [[qx - 330, 300, 150], [qx - 210, 360, 120], [qx - 40, 230, 120], [qx + 120, 380, 130], [qx + 260, 300, 160], [qx + 470, 200, 160]], 7.3, {tone: .62, azu: .5, mal: .45, och: .14, trees: 5});
  massif(L, C, qx - 1300, qx - 420, 452, [[qx - 1000, 110, 300], [qx - 700, 140, 260]], 8.8, {tone: .6, azu: .42, mal: .5, och: .14, trees: 4});
  massif(L, C, qx + 480, qx + 1360, 452, [[qx + 760, 150, 280], [qx + 1060, 100, 300]], 9.6, {tone: .6, azu: .42, mal: .5, och: .14, trees: 4});
  massif(L, C, qx - 560, qx + 560, 456, [[qx - 330, 150, 200], [qx + 300, 130, 220]], 10.4, {tone: .8, azu: .3, mal: .6, och: .16, trees: 6});
  massif(L, C, 3200, 4000, 452, [[3550, 90, 380]], 11.2, {tone: .55, azu: .35, mal: .5, och: .14, trees: 3});
  massif(L, C, 3800, 4460, 452, [[4150, 130, 320]], 12.5, {tone: .55, azu: .4, mal: .5, och: .14, trees: 3});
  massif(L, C, -120, 460, 452, [[120, 100, 300]], 13.6, {tone: .5, azu: .35, mal: .45, och: .14, trees: 2});
  // mist through the waist of the range
  for (const [mx, my, rx, ry, d] of [[qx - 300, 330, 240, 16, .7], [qx + 300, 316, 220, 16, .65], [qx - 860, 372, 240, 16, .7], [qx + 860, 370, 260, 16, .7], [qx, 410, 620, 30, .9], [3600, 404, 300, 20, .85], [4160, 396, 260, 18, .8]]) cutMist(L, mx, my, rx, ry, d);
  // 3. the walls of Xiqi on the near rise to the west: a long wall with crenels, a gate tower, corner towers; roofs inside, low
  const cx0 = 420, cx1 = 1480, top = x => 380 + (x - cx0) * .01;
  massif(L, C, cx0 - 300, cx1 + 300, 450, [[cx0 + 100, 70, 260], [cx0 + 620, 86, 420], [cx1 - 40, 66, 300]], 14.1, {tone: .4, azu: .1, mal: .4, och: .18, trees: 0, k: .7});
  for (const [hx, w, h] of [[cx0 + 150, 30, 26], [cx0 + 290, 40, 32], [cx0 + 440, 28, 24], [cx0 + 640, 48, 44], [cx0 + 800, 30, 26], [cx1 - 150, 36, 30], [cx1 - 300, 26, 22]]) hall(L, hx, top(hx) + 4, w, h, C, {posts: 3, tone: .55, k: .6, mal: .2});
  wall(L, C, cx0, cx1, 414, top, {tone: .85, endL: true, endR: true, k: .8});
  crenels(L, C, cx0, cx1, top, .75, .75);
  const gx = 940, gt = top(gx) - 10;
  wall(L, C, gx - 64, gx + 64, 415, () => gt, {tone: 1.1, endL: true, endR: true, k: .8});
  L.blot(gx, 404, 15, 12, {dens: 1.1, rim: .3, soft: .2, rough: .2}); L.blot(gx, 412, 15, 4, {dens: 1.1, rim: .1, soft: .2, rough: .1});
  hall(L, gx, gt, 60, 62, C, {posts: 5, k: .8, mal: .3, two: true, wallTone: .15});
  for (const tx of [cx0 + 30, cx1 - 30]) { const tt = top(tx) - 6; wall(L, C, tx - 26, tx + 26, 415, () => tt, {tone: 1, endL: true, endR: true, k: .7}); hall(L, tx, tt, 26, 28, C, {posts: 3, tone: .85, k: .6}) }
  for (const px of [cx0 + 220, cx0 + 420, gx - 86, gx + 86, cx1 - 260]) pennant(L, px, top(px) - 4, 26, C, 'rust', 14, .5);
  smoke(L, cx0 + 560, top(cx0 + 560) - 6, 60, C, .03);
  // 4. near hills and groves along the foot of the range, with willows and a few pines
  for (let x = 40; x < FAR.w; x += C.R(150, 320)) { if (x > cx0 - 60 && x < cx1 + 60) continue; const h = C.R(28, 54); for (let i = 0, n = 2 + Math.floor(C.R(0, 4)); i < n; i++) { const xx = x + C.R(-40, 40); if (C.rnd() < .6) pineFar(L, xx, 420 + C.R(-6, 8), h * C.R(.7, 1.1), C, .55); else dotTree(L, xx, 422 + C.R(-4, 8), h * .9, C, {clumps: 3}) } }
  // 5. the mist the band stands on: white lifted in long lobes, then the foot dissolved into the field
  for (let x = -100; x < FAR.w + 200; x += C.R(180, 380)) cutMist(L, x, 424 + C.R(-10, 10), C.R(200, 380), C.R(16, 30), .9);
  let x = 0; while (x < FAR.w) { const len = C.R(160, 420); drag(L, x, 446 + C.R(-6, 6), len, C.R(1, 1.6), C.R(.06, .11), C, {dry: .55, tilt: .1}); x += len + C.R(80, 300) }
}
// the passes: the walls of the valley seen ahead, steep and close (高远), cloud in their waists, a waterfall, a far gate on a saddle
function paintFarPasses(L) {
  const C = chance(57), F = FAR.foot; body(L, () => 0, 0, FAR.w, F + 40);
  const range = (x0, x1, base, hgt, seed, dens, azu, step = 60) => { const pts = []; let x = x0; while (x <= x1) { const t = (x - x0) / (x1 - x0), env = Math.sin(Math.PI * t) ** .5; pts.push([x, base - hgt * env * (.3 + 1.1 * fbm(x * .006 + seed, 2, 3) ** 1.2)]); x += C.R(step * .6, step * 1.3) }
    ghost(L, pts, {seed, dens, azu, och: .03, fade: hgt * 1.1, x0, x1, feather: 120, crag: 8, line: .12}) };
  range(-100, 2300, 300, 250, 2.6, .06, .2); range(2000, 4500, 290, 260, 4.4, .06, .22);
  // two jagged walls of rock, back and front, each many overlapping heads of different widths (cliffs, not cones)
  const wallOf = (x0, x1, h0, h1, seed) => { const pk = []; let x = x0 + C.R(40, 90); while (x < x1 - 60) { pk.push([x, C.R(h0, h1), C.R(150, 240)]); x += C.R(90, 170) } return pk };
  massif(L, C, -100, 1500, 440, wallOf(-100, 1500, 200, 300, 1), 26.1, {tone: .5, azu: .5, mal: .35, och: .12, trees: 3});
  massif(L, C, 2900, 4500, 440, wallOf(2900, 4500, 200, 300, 2), 27.3, {tone: .5, azu: .5, mal: .35, och: .12, trees: 3});
  massif(L, C, -100, 1350, 452, wallOf(-100, 1350, 250, 400, 3), 21.1, {tone: .85, azu: .6, mal: .55, och: .14, trees: 6});
  massif(L, C, 3050, 4500, 452, wallOf(3050, 4500, 250, 400, 4), 22.7, {tone: .85, azu: .6, mal: .55, och: .14, trees: 6});
  massif(L, C, 1100, 1900, 456, [[1250, 200, 220], [1500, 160, 260], [1750, 190, 220]], 23.3, {tone: .6, azu: .45, mal: .45, och: .14, trees: 4});
  massif(L, C, 2500, 3300, 456, [[2650, 180, 220], [2900, 210, 240], [3150, 170, 220]], 24.9, {tone: .6, azu: .45, mal: .45, och: .14, trees: 4});
  // the far gate on the saddle between the near walls
  const gx = 2200, gy = 330; massif(L, C, 1950, 2450, 380, [[2200, 60, 260]], 25.5, {tone: .5, azu: .2, mal: .5, och: .18, trees: 0, k: .6});
  wall(L, C, gx - 170, gx + 170, gy + 2, () => gy - 26, {tone: .9, endL: true, endR: true, k: .6}); crenels(L, C, gx - 170, gx + 170, () => gy - 26, .6, .8);
  hall(L, gx, gy - 34, 46, 46, C, {posts: 4, k: .6, mal: .3, two: true}); for (const px of [gx - 120, gx + 120]) pennant(L, px, gy - 28, 22, C, 'ink', 12, .5);
  // waterfalls: white lifted through the cliff, long and thin
  for (const [wx, wy, h] of [[560, 230, 150], [3760, 220, 160]]) { for (let j = 0; j < 3; j++) L.stroke([[wx + j * 4, wy, 2.5], [wx + j * 4 + 2, wy + h * .5, 4], [wx + j * 4 + 1, wy + h, 2]], {pig: 'white', load: 2, pool: 0, streak: .3, rag: .3}); cutMist(L, wx, wy + h, 60, 12, .9) }
  for (const [mx, my, rx, ry, d] of [[600, 250, 320, 22, .8], [3800, 240, 320, 22, .8], [2200, 400, 700, 30, .9], [1500, 330, 260, 18, .75], [2900, 330, 260, 18, .75]]) cutMist(L, mx, my, rx, ry, d);
  for (let x = -100; x < FAR.w + 200; x += C.R(180, 380)) cutMist(L, x, 424 + C.R(-10, 10), C.R(200, 380), C.R(16, 30), .9);
}
// Mengjin: across the plain, the walls of Zhaoge, its gate towers and the Star-Plucking Tower (摘星楼) on its terrace, smoke from the city
function paintFarMeng(L) {
  const C = chance(73), F = FAR.foot; body(L, () => 0, 0, FAR.w, F + 40);
  const range = (x0, x1, base, hgt, seed, dens, azu) => { const pts = []; let x = x0; while (x <= x1) { const t = (x - x0) / (x1 - x0), env = Math.sin(Math.PI * t) ** .6; pts.push([x, base - hgt * env * (.4 + .8 * fbm(x * .004 + seed, 2, 3))]); x += C.R(50, 110) }
    ghost(L, pts, {seed, dens, azu, och: .04, fade: hgt * 1.1, x0, x1, feather: 160, crag: 5, line: .08}) };
  range(-100, 2400, 360, 110, 3.3, .045, .12); range(2000, 4500, 350, 120, 6.1, .045, .12);
  const cx0 = 500, cx1 = 3900, top = x => 352 + Math.sin(x * .0012) * 4;
  // inside the walls, roofs and terraces, smoke
  for (let x = cx0 + 60; x < cx1 - 60; x += C.R(70, 140)) { const w = C.R(26, 50); hall(L, x, top(x) + 2, w, w * C.R(.7, 1), C, {posts: 3, tone: .5, k: .55, mal: .18}) }
  // the Star-Plucking Tower on its high terrace, and the Deer Terrace (鹿台) lower to the east
  const tx = 2700; let ty = top(tx) - 2; for (const [w, h] of [[130, 30], [96, 28], [66, 26]]) { wall(L, C, tx - w, tx + w, ty, () => ty - h, {tone: .9, endL: true, endR: true, k: .55}); ty -= h }
  for (let i = 0; i < 3; i++) { hall(L, tx, ty, 54 - i * 10, 40, C, {posts: 4, tone: .95, k: .7, mal: .35, two: i === 2}); ty -= 34 }
  let dy = top(3350) - 2; for (const [w, h] of [[110, 24], [76, 22]]) { wall(L, C, 3350 - w, 3350 + w, dy, () => dy - h, {tone: .8, endL: true, endR: true, k: .5}); dy -= h } hall(L, 3350, dy, 58, 50, C, {posts: 5, tone: .8, k: .6, mal: .3, two: true});
  for (const [sx, h] of [[1200, 160], [2300, 200], [3000, 150], [3600, 120]]) smoke(L, sx, top(sx) - 10, h, C, .05, .3);
  wall(L, C, cx0, cx1, 418, top, {tone: 1, endL: true, endR: true, k: .85}); crenels(L, C, cx0, cx1, top, .8, .85);
  for (const gx of [1300, 2200, 3100]) { const gt = top(gx) - 12; wall(L, C, gx - 70, gx + 70, 419, () => gt, {tone: 1.15, endL: true, endR: true, k: .8}); L.blot(gx, 408, 14, 11, {dens: 1.1, rim: .3, soft: .2}); hall(L, gx, gt, 66, 64, C, {posts: 5, k: .8, mal: .3, two: true}) }
  for (let x = cx0 + 80; x < cx1; x += C.R(90, 170)) pennant(L, x, top(x) - 4, 26, C, C.rnd() < .5 ? 'ink' : 'white', 14, .6);
  for (const [mx, my, rx, ry, d] of [[200, 400, 300, 20, .8], [4200, 400, 300, 20, .8]]) cutMist(L, mx, my, rx, ry, d);
  for (let x = -100; x < FAR.w + 200; x += C.R(180, 380)) cutMist(L, x, 430 + C.R(-10, 10), C.R(200, 380), C.R(16, 30), .9);
  let x = 0; while (x < FAR.w) { const len = C.R(160, 420); drag(L, x, 446 + C.R(-6, 6), len, C.R(1, 1.6), C.R(.06, .11), C, {dry: .55, tilt: .1}); x += len + C.R(80, 300) }
}
// the band's alpha falls away under the foot so it dissolves into the ground
function farFade(raw) { const {w, h, foot} = FAR;
  for (let y = 0; y < h; y++) { const f = 1 - smooth(foot - 70, h - 2, y); if (f >= 1) continue; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4 + 3; raw[i] = Math.round(raw[i] * f) } }
  return raw }

/* ======================================================================================================================
   2. THE COURSES OF THE WEI. Three, each mirrored or not by seed. World points (x, y), the river's half-width w at
   each point, and where its fords are (t along the course). A tributary joins the third.
   ====================================================================================================================== */
const XIQI_COURSES = [
  {name: 'south', waters: [{pts: [[-400, 4250, 120], [700, 4560, 140], [1600, 4220, 150], [2500, 4470, 160], [3400, 4900, 170], [4300, 4500, 160], [5200, 4720, 150], [6400, 4420, 140]], fords: [.3, .68], bars: [.43, .8]}]},
  {name: 'diagonal', waters: [{pts: [[-400, 1650, 120], [700, 1980, 140], [1500, 2480, 150], [2150, 3280, 150], [2750, 4020, 160], [3500, 4520, 170], [4400, 4860, 160], [5300, 5380, 150], [6400, 5560, 140]], fords: [.25, .62], bars: [.48, .85]}]},
  {name: 'confluence', waters: [{pts: [[-400, 1350, 120], [800, 1120, 140], [1900, 1480, 150], [2900, 1280, 160], [3900, 1640, 170], [4900, 1400, 160], [6400, 1700, 150]], fords: [.22, .7], bars: [.4, .9]},
    {pts: [[4250, 6400, 70], [4020, 5300, 80], [4480, 4200, 90], [4330, 3100, 100], [4150, 2200, 110], [4060, 1660, 120]], fords: [.5], bars: []}]},
];
// scene two, the passes: a valley between mountain walls running north-south. corridor: [x, y, half-width] down it (the rules'
// left-right limit); gates: y of the walls that cross it (the corridor narrows there); a stream along one side; the road down it.
const PASS_COURSES = [
  {name: 'pass-a', corridor: [[2900, -400, 700], [3300, 900, 740], [3000, 1800, 430], [2600, 2800, 760], [3100, 3900, 700], [3000, 4400, 430], [3350, 5300, 740], [3000, 6400, 700]], gates: [1800, 4400],
    waters: [{pts: [[3330, -400, 40], [3720, 900, 46], [3290, 1800, 36], [2980, 2800, 48], [3530, 3900, 46], [3290, 4400, 36], [3780, 5300, 48], [3420, 6400, 44]], fords: [.29, .69], bars: []}],
    roads: [[[2800, -400], [3150, 900], [2950, 1800], [2500, 2800], [2950, 3900], [2950, 4400], [3200, 5300], [2900, 6400]]]},
  {name: 'pass-b', corridor: [[3100, -400, 700], [2700, 1000, 760], [3000, 2000, 430], [3400, 3000, 740], [2900, 4100, 760], [3000, 4600, 430], [2650, 5500, 700], [3000, 6400, 700]], gates: [2000, 4600],
    waters: [{pts: [[2680, -400, 40], [2280, 1000, 46], [2710, 2000, 36], [3020, 3000, 48], [2470, 4100, 46], [2710, 4600, 36], [2230, 5500, 46], [2580, 6400, 44]], fords: [.31, .72], bars: []}],
    roads: [[[3200, -400], [2850, 1000], [3050, 2000], [3500, 3000], [3050, 4100], [3050, 4600], [2800, 5500], [3100, 6400]]]},
];
// scene three, Mengjin to Zhaoge: the Yellow River across the south, the walls of Zhaoge across the north (wall: their foot y; gate: x)
const MENG_COURSES = [
  {name: 'meng-a', wall: 520, gate: 3000, waters: [{pts: [[-400, 4600, 300], [900, 4800, 320], [2000, 4500, 300], [3000, 4700, 330], [4100, 4450, 310], [5200, 4750, 320], [6400, 4550, 300]], fords: [.5], bars: [.25, .78]}]},
  {name: 'meng-b', wall: 520, gate: 3000, waters: [{pts: [[-400, 4350, 300], [1000, 4650, 320], [2100, 4900, 330], [3000, 4600, 310], [4000, 4800, 330], [5100, 4500, 300], [6400, 4700, 320]], fords: [.48], bars: [.2, .72]}]},
];
const COURSES = SCENE === 'passes' ? PASS_COURSES : SCENE === 'mengjin' ? MENG_COURSES : XIQI_COURSES;
// how a scene's water is painted: azurite Wei; a narrow quick mountain stream; the wide yellow-brown Huang He with heavy waves
const WATER = {xiqi: {body: 'azu', shallow: 'mal', bodyK: 1, wave: 1, curls: 1}, passes: {body: 'azu', shallow: 'mal', bodyK: 1.2, wave: 1.2, curls: .6}, mengjin: {body: 'och', shallow: 'och', bodyK: 2.6, wave: 1.4, curls: 1.2, ink: .0022, crests: 1}}[SCENE];
const sq = P => P.map(([x, y, w]) => [x, y * KY, w]);                     // world -> the squeezed ground the pieces are painted in
const widthAt = (P, t) => { const n = P.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i; return P[i][2] + (P[i + 1][2] - P[i][2]) * u };

// fill a polygon (painter's units) with a density, soft over `soft` units inside its edge, the edge a little ragged
function poly(L, pts, dens, pig, o = {}) {
  const soft = o.soft ?? 4, rag = o.rag ?? 3, seed = o.seed ?? (L.seed += 2.3); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  const n = pts.length;
  area(L, x0 - 2, y0 - 2, x1 + 2, y1 + 2, (x, y) => { let inside = false, dmin = 1e9;
    for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      const dx = xj - xi, dy = yj - yi, l2 = dx * dx + dy * dy || 1, u = clamp(((x - xi) * dx + (y - yi) * dy) / l2), ex = xi + dx * u - x, ey = yi + dy * u - y; dmin = Math.min(dmin, Math.hypot(ex, ey)) }
    if (!inside) return 0; const e = dmin + (vnoise(x * .12 + seed, y * .12) - .5) * 2 * rag; return e <= 0 ? 0 : dens * smooth(0, soft, e) }, pig, o.gran ?? 1.2) }
// fields along the river (the plain of Zhou was farmed along its waters): strips of plots that follow the bank, one to three
// deep, each plot its own tint (young millet, stubble, ploughed earth) with furrows running with the water, balks of grass
// between them and here and there a path down to the bank. In stretches: the rest of the bank is left to grass and reeds.
function paintFields(L, course, ci) {
  for (const [wi, water] of course.waters.entries()) {
    const C = chance(919 + ci * 13 + wi), P = sq(water.pts), len = (() => { let l = 0, a = along(P, 0); for (let t = .002; t <= 1; t += .002) { const b = along(P, t); l += Math.hypot(b[0] - a[0], b[1] - a[1]); a = b } return l })(), dt = 1 / len;
    const ford = t => water.fords.some(f => Math.abs(t - f) < 140 * dt), wid = t => widthAt(water.pts, t);
    const pt = (t, d) => { const a = along(P, t); return [a[0] - a[3] * d, a[1] + a[2] * d * KY] };
    const band = (t0, t1, d, hw, o) => { const p = []; for (let j = 0; j <= 8; j++) { const t = t0 + (t1 - t0) * j / 8, q = pt(t, d); p.push([q[0], q[1], hw * KY * (j === 0 || j === 8 ? .7 : 1)]) } L.stroke(p, o) };
    const across = (t, d0, d1, o) => { const p = []; for (let j = 0; j <= 4; j++) { const q = pt(t, d0 + (d1 - d0) * j / 4); p.push([q[0], q[1], o.w * (j === 0 || j === 4 ? .4 : 1)]) } L.stroke(p, o) };
    for (const s of [-1, 1]) {
      const rows = 1 + Math.floor(C.R(0, 2.99)); let t = .02 + C.R(0, .03), k = 0;
      while (t < .97) {
        const pl = C.R(150, 360) * dt, t1 = Math.min(.98, t + pl), mid = (t + t1) / 2, district = fbm(mid * 7 + s * 3 + wi * 5 + ci, 2, 2);
        if (district > .47 && !ford(mid) && !ford(t) && !ford(t1)) {
          const keep = smooth(.47, .56, district); let d = (wid(mid) + C.R(90, 140)) * s;
          for (let r = 0; r < rows; r++) { const dep = C.R(110, 200) * s, d1 = d + dep; if (C.rnd() < .22) { d = d1 + C.R(6, 14) * s; continue }
            const kind = SCENE === 'mengjin' ? .5 + C.rnd() * .5 : C.rnd(), pig = kind < .45 ? 'mal' : 'och', dm = (d + d1) / 2, hw = Math.abs(dep) / 2 - 3;
            const outline = []; for (let j = 0; j <= 10; j++) outline.push(pt(t + 3 * dt + (t1 - t - 6 * dt) * j / 10, d + 3 * s)); for (let j = 10; j >= 0; j--) outline.push(pt(t + 3 * dt + (t1 - t - 6 * dt) * j / 10, d1 - 3 * s));
            poly(L, outline, (kind < .45 ? .07 : kind < .8 ? .065 : .035) * keep, pig, {soft: 5, rag: 3});
            if (kind < .45) poly(L, outline, .02 * keep, 'och', {soft: 8, rag: 4});
            const nf = Math.round(Math.abs(dep) / C.R(11, 16));
            for (let f = 1; f < nf; f++) { const df = d + dep * f / nf; let u = t + C.R(4, 20) * dt; while (u < t1 - 8 * dt) { const ul = Math.min(t1 - 6 * dt, u + C.R(40, 140) * dt); band(u, ul, df, C.R(.5, .9), {pig: kind < .45 ? 'mal' : 'ink', load: (kind < .45 ? .45 : .14) * keep * C.R(.7, 1.2), dry: .35, dry1: .85, streak: .7, rag: .2, pool: 0}); u = ul + C.R(5, 30) * dt } }
            // the balk along the plot's far side, broken, with a few tufts of grass
            let u = t; while (u < t1) { const ul = Math.min(t1, u + C.R(40, 120) * dt); band(u, ul, d1, C.R(.9, 1.5), {load: .34 * keep, dry: .3, dry1: .8, streak: .7, rag: .3, pool: 0}); if (C.rnd() < .5) { const q = pt((u + ul) / 2, d1); leaf(L, q[0], q[1] + 1, C.R(5, 10), C.R(-.5, .2), C, {load: .4 * keep, w: .45}) } u = ul + C.R(8, 50) * dt }
            d = d1 + C.R(5, 12) * s }
          // the balk across, at the plot's start, from the bank to the last row
          across(t, (wid(t) + 80) * s, d, {w: C.R(1, 1.6), load: .34 * keep, dry: .3, dry1: .8, streak: .7, rag: .3, pool: 0});
          if (k % 4 === 3) { across(t, wid(t) * s, d + 60 * s, {w: 5, pig: 'och', load: .08 * keep, dry: .2, dry1: .8, streak: .8, rag: .3, pool: 0}); across(t, wid(t) * s, d + 60 * s, {w: 3, pig: 'lift', load: .5, dry: 0, soft: .6, pool: 0}) }
        }
        t = t1 + C.R(2, 8) * dt; k++ } }
  }
}
// the river's drawing, in squeezed ground units (one call paints all of a course's waters into L)
function paintRiver(L, course, ci) {
  for (const [wi, water] of course.waters.entries()) {
    const C = chance(4242 + ci * 31 + wi * 7), P = sq(water.pts), main = wi === 0;
    const near = t => Math.max(0, ...water.fords.map(f => Math.exp(-(((t - f) / .018) ** 2)))), bar = t => Math.max(0, ...water.bars.map(f => Math.exp(-(((t - f) / .03) ** 2))));
    const wid = t => widthAt(water.pts, t) * (1 + .12 * Math.sin(t * 37 + ci) + .07 * Math.sin(t * 91 + wi)) * (1 + .35 * near(t));
    const len = (() => { let l = 0, a = along(P, 0); for (let t = .002; t <= 1; t += .002) { const b = along(P, t); l += Math.hypot(b[0] - a[0], b[1] - a[1]); a = b } return l })(), dt = 1 / len;
    const edge = (t, s, k = 1) => { const a = along(P, t), w = wid(t) * k; return [a[0] - a[3] * w * s, a[1] + a[2] * w * s * KY] };       // a point on a bank (s = -1 the far bank, +1 the near)
    // 1. the water: azurite deepening to the middle, malachite in the shallows by each bank, a breath of ochre where it is shallow at the ford
    for (let t = 0; t <= 1; t += 6 * dt) { const a = along(P, t), w = wid(t), sh = 1 - .75 * near(t);
      L.blot(a[0], a[1], w * 1.05, w * KY * .98, {pig: WATER.body, dens: .0075 * sh * WATER.bodyK, rim: .1, soft: .75, rough: .25, gran: 1.1, freq: .01, seed: 5 + t * 900 + wi});
      if (WATER.ink) L.blot(a[0], a[1], w * .8, w * KY * .7, {dens: WATER.ink * sh, rim: 0, soft: .9, rough: .3, gran: 1, seed: 7 + t * 300});
      if (((t * len) | 0) % 18 < 6) L.blot(a[0], a[1], w * .55, w * KY * .45, {pig: WATER.body, dens: .006 * sh * WATER.bodyK, rim: 0, soft: .9, rough: .3, gran: 1.2, seed: 9 + t * 700});
      for (const s of [-1, 1]) { const e = edge(t, s, .78); L.blot(e[0], e[1], w * .4, w * KY * .22, {pig: WATER.shallow, dens: .009 * (s > 0 ? 1.2 : 1), rim: .2, soft: .7, rough: .4, gran: 1.3, seed: 13 + t * 500 + s}) }
      if (near(t) > .2) L.blot(a[0], a[1], w * .9, w * KY * .7, {pig: 'och', dens: .004 * near(t), rim: .2, soft: .7, rough: .5, gran: 1.1, seed: 17 + t * 300}) }
    // 2. the wave lines (水纹): fine lines that run with the water in rows across it, each a little wavy, broken into
    //    long dashes with gaps; denser and darker in mid-stream, gone over the ford's shallows
    for (let row = -.82; row <= .82; row += C.R(.09, .14)) { let t = C.R(0, .02);
      while (t < 1) { const L0 = C.R(60, 240) * dt, mid = t + L0 / 2, o = row + (C.R(-.03, .03)), op = 1 - near(mid) ** .6, depth = 1 - Math.abs(o) * .55;
        if (op > .15) { const p = []; for (let j = 0; j <= 8; j++) { const tt = t + L0 * j / 8, a = along(P, tt), w = wid(tt), off = o * w + Math.sin(tt * len / C.R(26, 34) + row * 9) * 2.2; p.push([a[0] - a[3] * off, a[1] + a[2] * off * KY, (.45 + .4 * Math.sin(Math.PI * j / 8)) * C.R(.8, 1.2)]) }
          L.stroke(p, {load: C.R(.24, .4) * op * depth * WATER.wave, dry: .15, dry1: .6, streak: .4, rag: .15, pool: 0, seed: 21 + t * 9000 + row * 100}) }
        t += L0 + C.R(10, 70) * dt } }
    // curls in mid-stream (鱼鳞): little arcs that open down-stream, in loose groups
    for (let g = 0, ng = Math.round(len / 260 * WATER.curls); g < ng; g++) { const t0 = C.R(.02, .98); if (near(t0) > .2 || bar(t0) > .3) continue;
      for (let j = 0, n = 3 + Math.floor(C.R(0, 4)); j < n; j++) { const t = t0 + C.R(-30, 30) * dt, a = along(P, t), w = wid(t), o = C.R(-.45, .45) * w, cx = a[0] - a[3] * o, cy = a[1] + a[2] * o * KY, r = C.R(6, 11), ang = Math.atan2(a[3], a[2]);
        const pts = []; for (let i = 0; i <= 6; i++) { const b = ang + Math.PI * (.15 + .7 * i / 6); pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r * .55, .35 + .5 * Math.sin(Math.PI * i / 6)]) } L.stroke(pts, {load: C.R(.18, .28), dry: .1, dry1: .5, pool: 0, streak: .3}) } }
    // heavy water (白浪滔天): rows of white crests breaking across the stream, each a lifted arc of paper with ink under its lip
    if (WATER.crests) for (let g = 0, ng = Math.round(len / 40); g < ng; g++) { const t = C.R(.01, .99); if (near(t) > .3 || bar(t) > .4) continue; const a = along(P, t), w = wid(t), o = C.R(-.8, .8) * w, cx = a[0] - a[3] * o, cy = a[1] + a[2] * o * KY, l = C.R(40, 90), ang = Math.atan2(a[3] * KY, a[2]);
      const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6 - .5; pts.push([cx + Math.cos(ang) * u * l, cy + Math.sin(ang) * u * l - Math.sin(Math.PI * (u + .5)) * l * .05, .5 + 1.8 * Math.sin(Math.PI * (u + .5))]) }
      L.stroke(pts, {pig: 'white', load: 1.6, pool: 0, streak: .5, rag: .4, soft: .3}); L.stroke(pts.map(([x, y, ww]) => [x, y + ww + 1.5, ww * .45]), {load: .38, dry: .2, dry1: .7, pool: 0, streak: .5}) }
    // 3. the banks: the near bank pressed (the light is from the upper left and the bank's lip throws a shadow on the water), the far bank thin and broken
    for (const s of [-1, 1]) { let t = 0;
      while (t < 1) { const seg = C.R(40, 140) * dt, mid = t + seg / 2, open = 1 - near(mid) ** .5, p = [];
        for (let j = 0; j <= 5; j++) { const tt = t + seg * j / 5, e = edge(tt, s, 1 + C.R(-.03, .03)); p.push([e[0], e[1], (s > 0 ? 2.4 : 1.3) * Math.sin(Math.PI * (j + .4) / 5.8) + .3]) }
        if (open > .15) L.stroke(p, {load: (s > 0 ? .62 : .4) * C.R(.75, 1.15) * open, dry: C.R(.1, .3), dry1: C.R(.6, .9), streak: .6, rag: .25, pool: .12, seed: 31 + t * 3000 + s});
        if (s > 0 && open > .3 && C.rnd() < .5) { const e = edge(mid, s, 1.0); drag(L, e[0] - seg * len * .3, e[1] + 3, seg * len * .6, 2.4, .1, C, {dry: .5}) }
        t += seg + (C.rnd() < .22 ? C.R(15, 60) * dt : C.R(1, 8) * dt) } }
    // shoals: ochre sand outside a bank on the inside of bends, with white sand lifted through, dotted with pebbles
    for (let t = .03; t < .97; t += C.R(140, 320) * dt) { if (near(t) > .3) continue; const s = C.rnd() < .5 ? -1 : 1, a = along(P, t), w = wid(t), e = edge(t, s, 1.18), rx = C.R(70, 170);
      L.blot(e[0], e[1], rx, w * KY * .2 + 6, {pig: 'och', dens: .1, rim: .4, rimW: .15, soft: .5, rough: .5, gran: 1.2, rot: Math.atan2(a[3] * KY, a[2]) * .8});
      L.blot(e[0], e[1], rx * .6, w * KY * .1 + 3, {pig: 'white', dens: .55, rim: 0, soft: .8, rough: .5, gran: 0});
      for (let i = 0; i < 6; i++) L.blot(e[0] + C.R(-rx, rx) * .8, e[1] + C.R(-6, 6), C.R(1.5, 3), C.R(1, 1.8), {dens: C.R(.2, .4), rim: .5, soft: .3}) }
    // 4. sand bars in the stream (沙洲): an islet of sand and grass with reeds, its own lip of ink
    for (const tb of water.bars) { const a = along(P, tb), w = wid(tb), ang = Math.atan2(a[3] * KY, a[2]), rx = w * 1.5, ry = w * KY * .34, cx = a[0] + a[3] * w * .1, cy = a[1] - a[2] * w * .1 * KY;
      L.blot(cx, cy, rx, ry, {pig: 'white', dens: 1.6, rim: 0, soft: .25, rough: .35, freq: .02, gran: 0, rot: ang});
      L.blot(cx, cy, rx * .96, ry * .9, {pig: 'och', dens: .14, rim: .5, rimW: .1, soft: .3, rough: .35, freq: .02, gran: 1.2, rot: ang});
      L.blot(cx - rx * .1, cy - ry * .2, rx * .6, ry * .5, {pig: 'mal', dens: .16, rim: .4, soft: .4, rough: .5, freq: .03, gran: 1.4, rot: ang});
      const lip = []; for (let i = 0; i <= 14; i++) { const b = Math.PI * (.05 + .9 * i / 14); lip.push([cx + Math.cos(ang) * Math.cos(b) * rx * .98 - Math.sin(ang) * Math.sin(b) * ry * .95, cy + Math.sin(ang) * Math.cos(b) * rx * .98 + Math.cos(ang) * Math.sin(b) * ry * .95, .4 + 1.6 * Math.sin(b)]) }
      L.stroke(lip, {load: .6, dry: .1, dry1: .6, streak: .5, rag: .25, pool: .1});
      for (let i = 0; i < 16; i++) { const u = C.R(-.75, .75), v = C.R(-.4, .3); reed(L, cx + Math.cos(ang) * u * rx - Math.sin(ang) * v * ry, cy + Math.sin(ang) * u * rx + Math.cos(ang) * v * ry, C.R(16, 32), C, {load: .6}) }
      for (let i = 0; i < 18; i++) { const u = C.R(-.8, .8), v = C.R(-.5, .5); leaf(L, cx + Math.cos(ang) * u * rx - Math.sin(ang) * v * ry, cy + Math.sin(ang) * u * rx + Math.cos(ang) * v * ry + 2, C.R(6, 13), C.R(-.6, .2), C, {load: .45, w: .5}) } }
    // 5. reeds in clumps along both banks, rocks in the water by the near bank
    for (let i = 0, n = Math.round(len / 120); i < n; i++) { const t = C.R(.02, .98); if (near(t) > .3) continue; const s = C.rnd() < .55 ? 1 : -1, e = edge(t, s, C.R(.92, 1.08));
      for (let j = 0, m = 3 + Math.floor(C.R(0, 6)); j < m; j++) reed(L, e[0] + C.R(-24, 24), e[1] + C.R(-4, 5), C.R(14, 30), C, {load: .58});
      for (let j = 0; j < 5; j++) leaf(L, e[0] + C.R(-26, 26), e[1] + C.R(0, 6), C.R(7, 15), C.R(-.6, .2), C, {load: .5, w: .55}) }
    for (let i = 0, n = Math.round(len / 700); i < n; i++) { const t = C.R(.04, .96); if (near(t) > .2) continue; const e = edge(t, C.rnd() < .7 ? 1 : -1, C.R(.75, .95)), k = C.R(.3, .55), bx = e[0], by = e[1];
      rock(L, [[-40, 0], [-26, -18], [-8, -28], [12, -25], [22, -12], [40, 0]].map(([x, y]) => [bx + x * k, by + y * k]), {seed: 3 + i * 1.7 + ci, foot: by + 30, tone: 1.1, fade: 22 * k, x0: bx - 46 * k, x1: bx + 46 * k, k: .6 * k, fl: 10, fr: 12, body: 1, och: .08, azu: .5, mal: .4, accent: .5});
      for (let j = 0; j < 3; j++) { const l = C.R(14, 30); L.stroke([[bx - l - 20 * k, by + 4 + j * 3, .3], [bx - 20 * k - l / 2, by + 4 + j * 3, .7], [bx - 20 * k, by + 4 + j * 3, .3]], {load: .2, dry: .3, dry1: .8, pool: 0}) } }
    // 6. the fords: sand through the water, stepping stones, ruts running down to it from both banks
    if (SCENE === 'mengjin') { for (const tf of water.fords) { const a = along(P, tf), w = wid(tf);   // 孟津: a long tongue of sand out into the stream where the boats put in, both banks
        for (const s2 of [-1, 1]) { const e = edge(tf, s2, .7); L.blot(e[0], e[1], w * .9, w * KY * .3, {pig: 'white', dens: 1.4, rim: 0, soft: .4, rough: .4, freq: .01, gran: 0}); L.blot(e[0], e[1], w * .86, w * KY * .27, {pig: 'och', dens: .16, rim: .5, rimW: .1, soft: .3, rough: .4, freq: .01, gran: 1.2});
          for (let i = 0; i < 30; i++) L.blot(e[0] + C.R(-w, w) * .7, e[1] + C.R(-1, 1) * w * KY * .2, C.R(1.5, 3), C.R(1, 1.8), {dens: C.R(.2, .4), rim: .5, soft: .3}) } } continue }
    for (const tf of water.fords) { const a = along(P, tf), w = wid(tf), nx = -a[3], ny = a[2] * KY;
      L.blot(a[0], a[1], w * .9, w * KY * .55, {pig: 'och', dens: .08, rim: .25, soft: .6, rough: .5, gran: 1.1});
      L.blot(a[0] + 20, a[1] - 6, w * .5, w * KY * .2, {pig: 'lift', dens: .5, rim: 0, soft: .8, rough: .5, gran: 0});
      for (let i = -6; i <= 6; i++) { const sx = a[0] + nx * i * w / 6.5 + C.R(-5, 5), sy = a[1] + ny * i * w / 6.5 + C.R(-3, 3), r = C.R(5, 9); L.blot(sx, sy, r, r * .55, {dens: C.R(.32, .5), rim: .7, rimW: .22, soft: .25, rough: .25}); L.blot(sx + 2, sy + 2, r * 1.3, r * .5, {dens: .08, rim: 0, soft: .8}) }
      for (const off of [-30, 30]) for (let u = -w * 2.4; u < w * 2.4; u += C.R(26, 60)) { if (Math.abs(u) < w * .8) continue; const l = C.R(24, 54), e = Math.exp(-(((Math.abs(u) - w) / (w * 1.2)) ** 2));
        L.stroke([[a[0] + a[2] * off + nx * u, a[1] + a[3] * off * KY + ny * u, .5], [a[0] + a[2] * off + nx * (u + l / 2), a[1] + a[3] * off * KY + ny * (u + l / 2), C.R(1.6, 3)], [a[0] + a[2] * off + nx * (u + l), a[1] + a[3] * off * KY + ny * (u + l), .4]], {load: C.R(.2, .34) * e, dry: .35, dry1: .9, streak: .8, rag: .3, pool: 0}) } }
  }
}

/* ======================================================================================================================
   3. THE LAND: the whole field's wash at a quarter size. Pale ochre ground, broad malachite where the grass is, greener
   by the water, the river's bed tinted; beyond the field's edges the land goes under mist (paper covers it).
   ====================================================================================================================== */
const LAND = {x0: -800, y0: -800, x1: 6800, y1: 6800, s: .25};
// the passes: inside the corridor a stony valley floor; at its edges scree; beyond, the mountains seen from above, green
// and blue in tracts with the lines of their ridges, darkening away from the road
const corridorAt = (C, y) => { const P = C.corridor; let i = 0; while (i < P.length - 2 && y > P[i + 1][1]) i++; const a = P[i], b = P[i + 1], u = clamp((y - a[1]) / (b[1] - a[1])), e = u * u * (3 - 2 * u); return [a[0] + (b[0] - a[0]) * e, a[2] + (b[2] - a[2]) * e] };
function paintLandPasses(L, course, ci) {
  const W = L.W, H = L.H, s = L.s, och = L.pig('och'), mal = L.pig('mal'), azu = L.pig('azu'), ink = L.d.ink, T = L.tooth; L.wh = new Float32Array(L.N);
  for (let Y = 0; Y < H; Y++) { const y = (Y / s) / KY + LAND.y0, [cx, hw] = corridorAt(course, y);
    for (let X = 0; X < W; X++) { const i = Y * W + X, x = X / s + LAND.x0, e = Math.abs(x - cx) - hw + (fbm(x * .004 + ci, y * .004, 3) - .5) * 160, g = 1 + 1.1 * (T[i] - .5);
      const n = fbm(x * .0012 + 3, y * .0012 + ci, 4), ridge = Math.exp(-(((n - .5) / .014) ** 2)) + .6 * Math.exp(-(((n - .42) / .012) ** 2)) + .6 * Math.exp(-(((n - .58) / .012) ** 2));
      const inside = 1 - smooth(-200, 0, e), mount = smooth(-20, 260, e);
      och[i] = (.1 * inside + .1 * (1 - inside) * (1 - mount) + .05 * mount) * g;
      ink[i] = (.035 * (1 - inside) * (1 - mount) + mount * (.04 + .12 * ridge * smooth(80, 500, e))) * g;
      mal[i] = (.02 * inside + mount * (.07 + .07 * smooth(.45, .6, n))) * g;
      azu[i] = mount * (.03 + .08 * smooth(300, 1200, e) * smooth(.4, .7, fbm(x * .002, y * .002 + 9, 2))) * g;
      const out = Math.max(-y, y - WORLD) + (fbm(x * .002, y * .002, 3) - .5) * 320, c = smooth(-160, 380, out);
      if (c > 0) { och[i] *= 1 - c; mal[i] *= 1 - c; azu[i] *= 1 - c; ink[i] *= 1 - c; L.wh[i] = c } } }
}
// the pass road down the corridor: a pale trodden band, two broken ruts, hoof dashes; and the river course's tiles carry it
function paintRoad(L, pts, C) { const P = sq(pts.map(([x, y]) => [x, y, 0]));
  for (let t = 0; t <= 1; t += .0015) { const a = along(P, t); L.blot(a[0], a[1], 70, 40, {pig: 'och', dens: .012, rim: .1, soft: .8, rough: .4}); L.blot(a[0], a[1], 50, 26, {pig: 'lift', dens: .3, rim: 0, soft: .8, rough: .4}) }
  for (const off of [-18, 18]) { let t = 0; while (t < 1) { const l = C.R(.006, .016), a = along(P, t), b = along(P, t + l / 2), c = along(P, t + l); L.stroke([[a[0] - a[3] * off, a[1] + a[2] * off * KY, .4], [b[0] - b[3] * off, b[1] + b[2] * off * KY, C.R(1.2, 2.4)], [c[0] - c[3] * off, c[1] + c[2] * off * KY, .3]], {load: C.R(.2, .34), dry: .4, dry1: .9, streak: .8, rag: .3, pool: 0}); t += l + C.R(.001, .006) } }
  for (let i = 0; i < 900; i++) { const t = C.rnd(), a = along(P, t), o = C.gauss() * 24; L.stroke([[a[0] - a[3] * o, a[1] + a[2] * o * KY, .4], [a[0] - a[3] * o + a[2] * 4, a[1] + a[2] * o * KY + a[3] * 4, .8]], {load: C.R(.14, .28), dry: .3, dry1: .8, pool: 0}) } }
function paintLand(L, course, ci) {
  if (SCENE === 'passes') return paintLandPasses(L, course, ci);
  const DRY = SCENE === 'mengjin' ? .55 : 1;
  const water = course.waters.map(w => w.pts), W = L.W, H = L.H, s = L.s, N = L.N;
  // distance to the water on a coarse grid (world units), then read back smoothly
  const G = 50, gw = Math.ceil((LAND.x1 - LAND.x0) / G) + 1, gh = Math.ceil((LAND.y1 - LAND.y0) / G) + 1, dist = new Float32Array(gw * gh).fill(1e9);
  for (const P of water) for (let t = 0; t <= 1; t += .0015) { const a = along(P, t), w = widthAt(P, t), gx = (a[0] - LAND.x0) / G, gy = (a[1] - LAND.y0) / G, R = 30;
    for (let j = Math.max(0, Math.floor(gy - R)); j <= Math.min(gh - 1, Math.ceil(gy + R)); j++) for (let i = Math.max(0, Math.floor(gx - R)); i <= Math.min(gw - 1, Math.ceil(gx + R)); i++) { const d = Math.max(0, Math.hypot(i - gx, j - gy) * G - w); const k = j * gw + i; if (d < dist[k]) dist[k] = d } }
  const dAt = (x, y) => { const gx = clamp((x - LAND.x0) / G, 0, gw - 1.001), gy = clamp((y - LAND.y0) / G, 0, gh - 1.001), i = gx | 0, j = gy | 0, u = gx - i, v = gy - j;
    return (dist[j * gw + i] * (1 - u) + dist[j * gw + i + 1] * u) * (1 - v) + (dist[(j + 1) * gw + i] * (1 - u) + dist[(j + 1) * gw + i + 1] * u) * v };
  const och = L.pig('och'), mal = L.pig('mal'), azu = L.pig('azu'), ink = L.d.ink, T = L.tooth; L.wh = new Float32Array(N);
  const tide = (v, at, w) => Math.exp(-(((v - at) / w) ** 2));
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { const i = Y * W + X, x = X / s + LAND.x0, y = (Y / s) / KY + LAND.y0;
    // warped noise: tracts with soft, wandering edges
    const wx = x + (fbm(x * .0004 + 3 + ci, y * .0004, 3) - .5) * 1400, wy = y + (fbm(x * .0004, y * .0004 + 7 + ci, 3) - .5) * 1400;
    const n1 = fbm(wx * .0008 + ci * 1.7, wy * .0008, 4), n2 = fbm(wx * .0016 + 11, wy * .0016 + ci, 3), d = dAt(x, y), wet = Math.exp(-d / 520);
    const g = smooth(.44, .56, n1 + wet * .22), gr = tide(n1 + wet * .22, .5, .012);       // grass tract and its tide line
    const e = smooth(.5, .62, n2), er = tide(n2, .56, .012);                                    // patches of barer, warmer earth
    const grain = 1 + 1.1 * (T[i] - .5);
    och[i] = (.08 + .06 * e + .05 * er - .025 * g) * grain;
    mal[i] = (.008 + .04 * g + .03 * gr + .03 * wet) * grain * (1 - .5 * e) * DRY;
    azu[i] = .012 * Math.exp(-d / 120) * grain;
    // the land closes under mist beyond the field's edges
    const out = Math.max(-x, x - WORLD, -y, y - WORLD) + (fbm(x * .002, y * .002, 3) - .5) * 320, c = smooth(-160, 380, out);
    if (c > 0) { och[i] *= 1 - c; mal[i] *= 1 - c; azu[i] *= 1 - c; ink[i] *= 1 - c; L.wh[i] = c } }
}

/* ======================================================================================================================
   4. PIECES THAT LIE (squeezed): fields, meadow, rises, earth, stones, tracks, and the grounds of the landmarks.
   Each fades out at its edge: laid over the land anywhere, mirrored or not, never a rectangle.
   ====================================================================================================================== */
// fill an area by a density function of (x, y) in the painter's units (with the paper's tooth for grain)
function area(L, x0, y0, x1, y1, f, pig = 'ink', gran = .9) { const s = L.s, {ox, oy} = L.xf, X0 = Math.max(0, Math.floor((x0 + ox) * s)), Y0 = Math.max(0, Math.floor((y0 + oy) * s)), X1 = Math.min(L.W - 1, Math.ceil((x1 + ox) * s)), Y1 = Math.min(L.H - 1, Math.ceil((y1 + oy) * s));
  if (X1 < X0 || Y1 < Y0) return; const bw = X1 - X0 + 1, bh = Y1 - Y0 + 1, tmp = new Float32Array(bw * bh), T = L.tooth;
  for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) { const v = f(X / s - ox, Y / s - oy); if (v > 0) tmp[(Y - Y0) * bw + X - X0] = v * (pig === 'white' ? 1 : 1 + gran * (T[Y * L.W + X] - .5)) }
  L._lay(tmp, X0, Y0, bw, bh, pig) }
const GROUND = {}, gp = (name, w, h, paint) => { GROUND[name] = {w, h, paint} };
const fadeE = (x, y, rx, ry, n = 0) => 1 - smooth(.55, 1, Math.hypot(x / rx, y / ry) + n);
// 井田 fields: a skewed grid of plots, each its own tint (young millet, stubble, fallow) with crop rows; raised paths between
for (let v = 0; v < 0; v++) gp('fields' + v, 820, 460, (L, C) => { const nx = 3 + (v === 2 ? 1 : 0), ny = 3, pw = 190, ph = 100, sk = C.R(-.25, .25), x0 = -nx * pw / 2, y0 = -ny * ph / 2;
  const P = (i, j) => [x0 + i * pw + (j * ph) * sk + C.R(-6, 6), y0 + j * ph + C.R(-4, 4)], corner = []; for (let j = 0; j <= ny; j++) { corner[j] = []; for (let i = 0; i <= nx; i++) corner[j][i] = P(i, j) }
  const edgeN = (x, y) => (fbm(x * .01 + v, y * .01, 2) - .5) * .5;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = corner[j][i], b = corner[j][i + 1], c = corner[j + 1][i + 1], d = corner[j + 1][i], cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2, kind = Math.floor(C.R(0, 3)), keep = fadeE(cx, cy, 380, 210);
    if (keep < .15) continue;
    const pig = kind === 0 ? 'mal' : 'och', dens = (kind === 0 ? .065 : kind === 1 ? .07 : .035) * keep;
    area(L, cx - pw * .7, cy - ph * .6, cx + pw * .7, cy + ph * .6, (x, y) => { const u = (x - cx - (y - cy) * sk) / (pw * .46), w = (y - cy) / (ph * .44); const r = Math.max(Math.abs(u), Math.abs(w)) * .8 + Math.hypot(u, w) * .2 + edgeN(x, y) * .7; return r < 1 ? dens * (1 - smooth(.7, 1, r)) * fadeE(x, y, 400, 225, edgeN(x, y)) : 0 }, pig, 1.2);
    if (kind === 0) area(L, cx - pw * .7, cy - ph * .6, cx + pw * .7, cy + ph * .6, (x, y) => { const u = (x - cx - (y - cy) * sk) / (pw * .46), w = (y - cy) / (ph * .44); return Math.max(Math.abs(u), Math.abs(w)) + edgeN(x, y) * .7 < .9 ? .02 * keep : 0 }, 'och', 1.2);
    // crop rows: dry pulls along the plot, every few units, broken
    if (kind < 2) for (let r = -ph * .38; r < ph * .38; r += C.R(7, 11)) { let t = -pw * .42 + C.R(0, 20); while (t < pw * .42) { const l = C.R(20, 70); L.stroke([[cx + t + r * sk, cy + r, .3], [cx + t + l / 2 + r * sk, cy + r + C.R(-.6, .6), C.R(.6, 1.1)], [cx + Math.min(pw * .44, t + l) + r * sk, cy + r, .3]], {pig: kind === 0 ? 'mal' : 'ink', load: (kind === 0 ? .32 : .1) * keep * C.R(.7, 1.2), dry: .45, dry1: .85, streak: .7, pool: 0}); t += l + C.R(4, 30) } } }
  // the paths between plots: broken pressed lines with tufts of grass
  const lineAlong = (a, b) => { let t = C.R(0, .1); while (t < .95) { const l = C.R(.15, .35), t1 = Math.min(1, t + l), mx = a[0] + (b[0] - a[0]) * (t + t1) / 2, my = a[1] + (b[1] - a[1]) * (t + t1) / 2, keep = fadeE(mx, my, 400, 220); if (keep > .15) { L.stroke([[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, .5], [mx, my + C.R(-1, 1), C.R(1, 1.8)], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, .4]], {load: .3 * keep, dry: .25, dry1: .8, streak: .7, rag: .3, pool: 0}); if (C.rnd() < .5) leaf(L, mx, my + 1, C.R(5, 10), C.R(-.5, .2), C, {load: .4 * keep, w: .45}) } t = t1 + C.R(.02, .12) } };
  for (let j = 0; j <= ny; j++) lineAlong(corner[j][0], corner[j][nx]); for (let i = 0; i <= nx; i++) lineAlong(corner[0][i], corner[ny][i]);
  if (v === 1) { const a = corner[0][1], b = corner[ny][1]; for (let i = 0; i < 3; i++) { const t = C.R(.2, .8); dotTree(L, a[0] + (b[0] - a[0]) * t + C.R(-8, 8), a[1] + (b[1] - a[1]) * t, 0, C) } }
});
// meadow: a broad pale green with tufts of grass and small flowers of azurite and white, thinning out
for (let v = 0; v < 3; v++) gp('meadow' + v, 640, 360, (L, C) => {
  area(L, -320, -180, 320, 180, (x, y) => .07 * fadeE(x, y, 300, 165, (fbm(x * .012 + v * 3, y * .012, 3) - .5) * .7), 'mal', 1.3);
  for (let i = 0, n = 34 + v * 10; i < n; i++) { const x = C.gauss() * 150, y = C.gauss() * 80; if (Math.abs(x) > 270 || Math.abs(y) > 140) continue; for (let j = 0, m = 2 + Math.floor(C.R(0, 3)); j < m; j++) leaf(L, x + C.R(-6, 6), y + C.R(-2, 2), C.R(7, 16), C.R(-.7, .2), C, {load: C.R(.3, .55), w: .5});
    if (C.rnd() < .3) L.stroke([[x + C.R(-8, 8), y - 6, .4], [x, y - 12, .8], [x + 2, y - 16, .3]], {pig: 'mal', load: 1.1, pool: 0}) }
  for (let i = 0; i < 18; i++) { const x = C.gauss() * 140, y = C.gauss() * 70; L.blot(x, y, 2.2, 1.6, {pig: C.rnd() < .6 ? 'azu' : 'white', dens: .9, rim: .3, soft: .3, rough: .2}) } });
// a low rise of ground: contour strokes round its crown, malachite over it, moss dots (苔点) on its shoulders
for (let v = 0; v < 2; v++) gp('rise' + v, 900, 420, (L, C) => { const rx = 360, ry = 150;
  area(L, -450, -210, 450, 210, (x, y) => { const r = Math.hypot(x / rx, (y + 20) / ry) + (fbm(x * .008 + v, y * .008, 3) - .5) * .4; return r < 1 ? (.09 * (1 - r) + .02) * (1 - smooth(.8, 1, r)) : 0 }, 'mal', 1.3);
  area(L, -450, -210, 450, 210, (x, y) => { const r = Math.hypot(x / rx, (y + 50) / (ry * .7)); return r < 1 ? .06 * (1 - r) : 0 }, 'azu', 1.3);
  area(L, -450, -210, 450, 210, (x, y) => { const r = Math.hypot(x / rx, (y - 30) / ry); return r < 1 && y > 0 ? .07 * (1 - smooth(.6, 1, r)) * smooth(0, 60, y) : 0 }, 'och', 1.2);
  for (let k = 0; k < 3; k++) { const kr = .45 + k * .22; for (let i = 0; i < 5; i++) { const a0 = C.R(.1, Math.PI - .4), l = C.R(.4, .9), p = []; for (let j = 0; j <= 5; j++) { const b = a0 + l * j / 5; p.push([Math.cos(b) * rx * kr, Math.sin(b) * ry * kr - 20 + 6, .4 + 1.2 * Math.sin(Math.PI * j / 5)]) } L.stroke(p, {load: C.R(.18, .32) * (1 - k * .2), dry: .35, dry1: .85, streak: .7, pool: 0}) } }
  for (let i = 0; i < 26; i++) { const a = C.R(Math.PI * .9, Math.PI * 2.1), r = C.R(.3, .85); L.blot(Math.cos(a) * rx * r, Math.sin(a) * ry * r - 20, C.R(1.8, 3.4), C.R(1.2, 2.2), {dens: C.R(.5, .9), rim: .3, soft: .3, rough: .2}) }
  for (let i = 0; i < 8; i++) leaf(L, C.R(-.6, .6) * rx, C.R(-.4, .5) * ry, C.R(8, 14), C.R(-.6, .2), C, {load: .45, w: .5}) });
// bare warm earth: a few long dry pulls on a breath of ochre
for (let v = 0; v < 2; v++) gp('earth' + v, 640, 300, (L, C) => { area(L, -320, -150, 320, 150, (x, y) => .06 * fadeE(x, y, 300, 135, (fbm(x * .01 + v, y * .01, 3) - .5) * .7), 'och', 1.2);
  for (let i = 0, n = 6 + v * 2; i < n; i++) { const y = C.R(-100, 100); drag(L, C.R(-260, 60), y, C.R(80, 220) * (1 - Math.abs(y) / 220), C.R(1.1, 2.4), C.R(.14, .26), C, {dry: .45, tilt: .25}) }
  for (let i = 0; i < 6; i++) L.blot(C.R(-230, 230), C.R(-100, 100), C.R(1.5, 3), C.R(1, 1.8), {dens: C.R(.18, .3), rim: .4, soft: .3}) });
for (let v = 0; v < 2; v++) gp('stones' + v, 460, 280, (L, C) => { for (let i = 0, n = 16 + v * 8; i < n; i++) { const x = C.gauss() * 110, y = C.gauss() * 60; if (Math.abs(x) > 200 || Math.abs(y) > 120) continue; const r = C.R(2.5, 9);
    L.blot(x, y, r, r * .6, {pig: C.rnd() < .3 ? 'azu' : 'ink', dens: C.R(.12, .26), rim: .7, rimW: .2, soft: .3, rough: .3}); if (C.rnd() < .5) L.stroke([[x + r, y - 1, r * .4], [x + r * 1.6, y + r * .5, r * .5], [x + r * 2, y + r * 1.2, .4]], {load: C.R(.2, .34), dry: .2, dry1: .85, side: -.7, streak: .9, rag: .3}) }
  for (let i = 0; i < 4; i++) drag(L, C.R(-190, 60), C.R(-90, 90), C.R(50, 120), C.R(1, 1.8), C.R(.1, .18), C, {dry: .55}) });
// a cart road: two ruts that keep their distance, broken, a pale worn strip between, out of nothing and back into it
for (let v = 0; v < 2; v++) gp('track' + v, 1300, 560, (L, C) => { const P = v ? [[-620, -200], [-300, -110], [-40, -10], [260, 40], [620, 190]] : [[-620, 160], [-280, 90], [0, 60], [280, -50], [620, -180]], ends = t => smooth(0, .18, t) * (1 - smooth(.82, 1, t));
  for (let t = 0; t <= 1; t += .004) { const a = along(P, t); L.blot(a[0], a[1], 30, 14, {pig: 'och', dens: .012 * ends(t), rim: 0, soft: .8, rough: .3}) }
  for (const off of [-14, 14]) { let t = .02; while (t < .98) { const len = C.R(.04, .12), a = along(P, t), b = along(P, t + len / 2), c = along(P, t + len), e = ends(t + len / 2); if (e > .05) L.stroke([[a[0] - a[3] * off, a[1] + a[2] * off * .6, .6], [b[0] - b[3] * off, b[1] + b[2] * off * .6, C.R(1.4, 2.8)], [c[0] - c[3] * off, c[1] + c[2] * off * .6, .4]], {load: C.R(.18, .32) * e, dry: C.R(.3, .5), dry1: .9, streak: .8, rag: .3, pool: 0}); t += len + C.R(.005, .05) } }
  for (let i = 0; i < 40; i++) { const t = C.rnd(), a = along(P, t), e = ends(t); L.blot(a[0] + C.R(-9, 9), a[1] + C.R(-5, 5), C.R(1.6, 3), C.R(1, 1.8), {dens: C.R(.14, .3) * e, rim: .5, soft: .3}) } });
// small things for the open ground, scattered thinly: tufts of grass with a moss dot or two, a mossy stone
for (let v = 0; v < 4; v++) gp('tuft' + v, 140, 70, (L, C) => { for (let i = 0, n = 4 + v * 2; i < n; i++) leaf(L, C.gauss() * 18, C.gauss() * 5 + 10, C.R(8, 18), C.R(-.7, .2), C, {load: C.R(.35, .6), w: .55});
  for (let i = 0; i < 3; i++) L.stroke([[C.gauss() * 16, 8, .4], [C.gauss() * 16, 2, 1.2], [C.gauss() * 16, -4, .3]], {pig: 'mal', load: 1, pool: 0}); for (let i = 0; i < 2 + v; i++) L.blot(C.gauss() * 26, C.R(4, 14), C.R(1.4, 2.4), C.R(1, 1.6), {dens: .8, rim: .3, soft: .3}) });
for (let v = 0; v < 2; v++) gp('moss' + v, 180, 90, (L, C) => { const k = v ? .8 : 1.1; L.blot(0, 6, 34 * k, 13 * k, {pig: 'white', dens: 1.4, rim: 0, soft: .4}); L.blot(0, 6, 34 * k, 13 * k, {pig: 'och', dens: .16, rim: .5, soft: .3, rough: .4});
  L.blot(-6 * k, 2, 22 * k, 7 * k, {pig: 'mal', dens: .32, rim: .4, soft: .4, rough: .5, gran: 1.4}); L.blot(-10 * k, 0, 10 * k, 4 * k, {pig: 'azu', dens: .3, rim: .4, soft: .4, rough: .5, gran: 1.4});
  L.stroke([[-34 * k, 8, .5], [-20 * k, -6 * k, 1.6], [6 * k, -8 * k, 1.8], [30 * k, 2, 1.3], [36 * k, 10, .4]], {load: .8, dry: .1, dry1: .5, streak: .5, rag: .3}); L.stroke([[-30 * k, 14, .4], [0, 18 * k, 1.4], [32 * k, 14, .4]], {load: .5, dry: .3, dry1: .8});
  for (let i = 0; i < 7; i++) L.blot(C.R(-26, 22) * k, C.R(-9, 0) * k, C.R(1.4, 2.4), C.R(1, 1.6), {dens: .9, rim: .3, soft: .3}); for (let i = 0; i < 4; i++) leaf(L, C.R(-36, 36) * k, 14, C.R(6, 12), C.R(-.6, .2), C, {load: .45, w: .5}) });
// the track an army leaves across the field: a broad band trodden pale, with ruts, the dashes of many feet and hooves, dying away at both ends
for (let v = 0; v < 2; v++) gp('march' + v, 1500, 300, (L, C) => { const P = v ? [[-740, 40], [-360, -20], [0, 10], [360, -30], [740, 20]] : [[-740, -30], [-360, 25], [0, -10], [360, 30], [740, -20]], ends = t => smooth(0, .2, t) * (1 - smooth(.8, 1, t));
  for (let t = 0; t <= 1; t += .003) { const a = along(P, t); L.blot(a[0], a[1], 60, 26, {pig: 'och', dens: .01 * ends(t), rim: 0, soft: .8, rough: .4}); L.blot(a[0], a[1], 46, 18, {pig: 'lift', dens: .25 * ends(t), rim: 0, soft: .8, rough: .4}) }
  for (const off of [-22, 0, 24]) { let t = .02; while (t < .98) { const l = C.R(.03, .09), a = along(P, t), b = along(P, t + l / 2), c = along(P, t + l), e = ends(t + l / 2); if (e > .05 && C.rnd() < .8) L.stroke([[a[0], a[1] + off + C.R(-4, 4), .4], [b[0], b[1] + off + C.R(-4, 4), C.R(1, 2)], [c[0], c[1] + off + C.R(-4, 4), .3]], {load: C.R(.14, .26) * e, dry: .4, dry1: .9, streak: .8, rag: .3, pool: 0}); t += l + C.R(.005, .04) } }
  for (let i = 0; i < 240; i++) { const t = C.rnd(), a = along(P, t), e = ends(t); L.stroke([[a[0] + C.R(-6, 6), a[1] + C.gauss() * 16, .4], [a[0] + C.R(-6, 6) + 4, a[1] + C.gauss() * 16, .8]], {load: C.R(.15, .3) * e, dry: .3, dry1: .8, pool: 0}) } });
// landmark grounds
gp('altarGround', 900, 500, (L, C) => { area(L, -450, -250, 450, 250, (x, y) => { const r = Math.hypot(x / 360, y / 190) + (fbm(x * .01, y * .01, 2) - .5) * .25; return r < 1 ? .09 * (1 - smooth(.7, 1, r)) : 0 }, 'och', 1.2);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) { const a = C.R(0, Math.PI * 2), rx = 150 + r * 56, ry = 70 + r * 28, l = C.R(.2, .5), p = []; for (let j = 0; j <= 4; j++) { const b = a + l * j / 4; p.push([Math.cos(b) * rx, Math.sin(b) * ry + 10, .5 + 1.2 * Math.sin(Math.PI * (j + .3) / 4.6)]) } L.stroke(p, {load: C.R(.14, .28) * (1 - r * .16), dry: .4, dry1: .9, streak: .7, pool: 0}) }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; for (let j = 0; j < 7; j++) { const r = 1.1 + j * .12; L.blot(Math.cos(a) * 160 * r, Math.sin(a) * 80 * r + 10, 5, 3, {dens: .25, rim: .6, soft: .3}) } } });
gp('yardGround', 980, 520, (L, C) => { area(L, -490, -260, 490, 260, (x, y) => { const r = Math.hypot(x / 420, y / 215) + (fbm(x * .01 + 4, y * .01, 2) - .5) * .3; return r < 1 ? .1 * (1 - smooth(.65, 1, r)) : 0 }, 'och', 1.2);
  for (let i = 0; i < 260; i++) { const x = C.gauss() * 170, y = C.gauss() * 80; L.blot(x, y, C.R(.8, 1.6), C.R(.6, 1), {pig: 'och', dens: .8, rim: .2, soft: .3}) }
  for (let i = 0; i < 18; i++) drag(L, C.gauss() * 260 - 60, C.gauss() * 110, C.R(40, 120), C.R(1, 1.8), C.R(.1, .18), C, {dry: .55}) });
gp('campGround', 1000, 560, (L, C) => { area(L, -500, -280, 500, 280, (x, y) => .06 * fadeE(x, y, 430, 240, (fbm(x * .01 + 7, y * .01, 3) - .5) * .5), 'och', 1.2);
  for (let i = 0; i < 46; i++) { const y = C.gauss() * 120; drag(L, C.gauss() * 260 - 80, y, C.R(60, 200), C.R(1, 2.6), C.R(.12, .26), C, {dry: .5, tilt: .3}) }
  for (const [fx, fy] of [[-200, -60], [60, 40], [250, -100]]) { L.blot(fx, fy, 30, 13, {dens: .3, rim: .5, rimW: .2, soft: .5, rough: .6, freq: .05, gran: 1}); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; L.blot(fx + Math.cos(a) * 34, fy + Math.sin(a) * 15, C.R(3, 5), C.R(2, 3), {dens: C.R(.3, .5), rim: .7, rimW: .2, soft: .3}) } for (let i = 0; i < 5; i++) line(L, fx + C.R(-14, 14), fy + C.R(-5, 5), fx + C.R(-20, 20), fy + C.R(-8, 8), 1.2, {load: .8}) }
  for (let i = 0; i < 20; i++) L.blot(C.gauss() * 240, C.gauss() * 110, C.R(1.5, 4), C.R(1, 2), {dens: C.R(.2, .45), rim: .4, soft: .3}) });
gp('platformGround', 1200, 640, (L, C) => { area(L, -600, -320, 600, 320, (x, y) => .07 * fadeE(x, y, 520, 280, (fbm(x * .008 + 9, y * .008, 3) - .5) * .5), 'och', 1.2);
  // a paved way: square slabs in rows, leading from the front up to the stairs
  for (let i = 0; i < 12; i++) drag(L, C.R(-40, 20), 60 + i * 13, C.R(40, 80), 1.4, C.R(.1, .18), C, {dry: .55});
  for (let i = 0; i < 8; i++) { const a = C.R(0, Math.PI * 2), r = C.R(.6, 1); for (let j = 0; j < 3; j++) leaf(L, Math.cos(a) * 420 * r, Math.sin(a) * 200 * r, C.R(6, 14), C.R(-.6, .2), C, {load: .45, w: .5}) } });

/* ======================================================================================================================
   5. PIECES THAT STAND (upright, foot at the bottom middle): trees, rocks, and the four landmarks. Painted at the size
   they are shown, baked at 1.5 pixels a unit.
   ====================================================================================================================== */
const PROPS = {}, pp = (name, w, h, r, paint, below = 14) => { PROPS[name] = {w, h, px: w / 2, py: h - below, r, paint} };
const shadow = (L, x, w, d = .16) => L.blot(x + w * .18, 3, w, w * .24, {dens: d, rim: .1, soft: .7, rough: .3, gran: .5});
[[230, 1, -.2], [190, .9, .1], [270, 1.15, -.3], [150, .85, -.05]].forEach(([h, th, lean], i) => pp('pine' + i, 300, h + 70, 16, (L, C) => { shadow(L, 0, h * .2); greenPine(L, 0, 0, h, C, {thick: th, lean}) }));
[[170, .3], [140, 0], [200, .2]].forEach(([h, azu], i) => pp('tree' + i, 260, h + 50, 18, (L, C) => { shadow(L, 0, h * .22); dotTree(L, 0, 0, h, C, {azu}) }));
[[190], [150]].forEach(([h], i) => pp('willow' + i, 280, h + 60, 16, (L, C) => { shadow(L, 0, h * .2); willow(L, 0, 0, h, C) }));
[[130, 54], [180, 70], [250, 92], [100, 40]].forEach(([w, h], i) => pp('rock' + i, w + 80, h + 50, w * .4, (L, C) => { shadow(L, 4, w * .45, .2); greenRock(L, 0, 0, w, h, C, 3.1 + i * 2.7) }, 24));
// cliff faces for the walls of the passes (the painted set overrides these when it exists): tall blue-green rock, a pine on a ledge
[[300, 330, 21.3], [260, 400, 22.9], [340, 300, 24.1], [280, 360, 25.7]].forEach(([w, h, seed], i) => pp('pc-cliff' + i, w + 60, h + 50, 90, (L, C) => {
  massif(L, C, -w / 2, w / 2, 0, [[-w * .18, h, w * .32], [w * .12, h * C.R(.75, .95), w * .3], [w * .3, h * .55, w * .22]], seed, {tone: .95, azu: .65, mal: .55, och: .18, trees: 2, k: .8});
  pineFar(L, C.R(-w * .2, w * .2), -h * C.R(.45, .6), 40, C, .7); drag(L, -w * .55, 2, w * 1.1, 1.4, .26, C, {dry: .35}) }, 24));
pp('bare0', 190, 150, 12, (L, C) => { shadow(L, 0, 16); bare(L, 0, 0, 110, C, {load: .8, depth: 3, lean: -.2}) });
// --- the ruined camp (re-cut from the field generator): tents, a tent brought down, a chariot broken, stakes, standards, a drum
for (let i = 0; i < 2; i++) pp('tent' + i, 280, 160, 70, (L, C) => { const k = i ? 1.4 : 1.7, w = 44 * k, h = 50 * k, x0 = -w * .62, x1 = w * .6; shadow(L, 8, 58 * k);
  body(L, xx => xx < x0 ? -h * (xx - (x0 - w * .42)) / (w * .42) : xx > x1 ? -h * ((x1 + w * .42) - xx) / (w * .42) : -h, x0 - w * .42, x1 + w * .42, 1);
  L.blot(-w * .15, -h * .42, w * .85, h * .5, {pig: 'och', dens: .16, rim: .2, soft: .5, rough: .3});
  L.stroke([[x0, -h, .7 * k], [0, -h + 3, 1.5 * k], [x1, -h * .98, .9 * k]], {load: .75, dry: .1, dry1: .5, streak: .5, rag: .2}); line(L, x0, -h, x0 - w * .42, 0, 1.2 * k, {load: .6, bow: .04, dry1: .7}); line(L, x1, -h * .98, x1 + w * .42, 0, 1.6 * k, {load: .85, bow: -.03}); line(L, x1, -h * .98, x1 - w * .34, 0, 1.3 * k, {load: .75, bow: .03});
  L.stroke([[x1 - 1, -h * .8, 1 * k], [x1 + w * .02, -h * .4, w * .14], [x1 + w * .04, -2, w * .22]], {load: .85, dry: .05, dry1: .4, streak: .7, rag: .3, pool: .2}) });
pp('tornTent', 240, 110, 60, (L, C) => { shadow(L, 0, 66); body(L, xx => -22 + Math.abs(xx) * .22 + 6 * Math.sin(xx * .09), -64, 64, 1);
  L.blot(0, -8, 56, 12, {pig: 'och', dens: .16, rim: .2, soft: .5}); L.stroke([[-66, 0, .8], [-30, -20, 1.6], [4, -24, 1.4], [36, -14, 1.5], [66, 0, .8]], {load: .8, dry: .1, dry1: .5, streak: .5, rag: .2}); for (const fx of [-34, -6, 22]) line(L, fx, -20, fx + C.R(4, 12), -2, 1.1, {load: .6, bow: .1}); line(L, -70, -4, 30, -40, 1.6, {load: .9, w0: 1}); line(L, 40, 0, 84, -26, 1.3, {load: .85, w0: 1}) });
pp('wreck', 230, 130, 60, (L, C) => { shadow(L, 0, 70); const r = 22, cx = -34, cy = -20, pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * .62, cy + Math.sin(a) * r, 1.2 + .7 * Math.sin(a + 1)]) }
  L.stroke(pts, {load: .85, dry: .05, dry1: .3, streak: .4, rag: .2}); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3; line(L, cx, cy, cx + Math.cos(a) * r * .56, cy + Math.sin(a) * r * .92, .6, {load: .6, w0: 1, w1: .5}) }
  body(L, xx => -30 + (xx + 10) * .22, -14, 44, 0); L.blot(14, -16, 26, 8, {pig: 'och', dens: .14, rim: .3, soft: .5});
  L.stroke([[-14, -18, 3], [14, -20, 9], [44, -8, 3]], {load: .5, dry: .15, dry1: .6, streak: .8, rag: .3}); line(L, -14, -32, 44, -19, 1.4, {load: .9}); line(L, -14, -32, -14, -4, 1.3, {load: .85, w0: 1}); line(L, 44, -19, 46, 0, 1.3, {load: .85, w0: 1});
  line(L, 40, -10, 96, -62, 1.3, {load: .8, bow: .06, w0: 1}); line(L, 88, -68, 104, -54, 1, {load: .8, bow: -.2});
  L.stroke([[52, 2, .6], [76, -8, 2.6], [102, 3, .6]], {load: .75, dry: .1, dry1: .5, streak: .6, rag: .3}); L.stroke([[-70, 4, .5], [-56, 0, 1.6], [-44, 5, .4]], {pig: 'mal', load: .5, dry: .2, dry1: .7}) });
pp('stakes', 230, 110, 60, (L, C) => { shadow(L, 0, 70); for (let i = 0; i < 6; i++) { const x = -70 + i * 28 + C.R(-5, 5), d = i % 2 ? 1 : -1, h = C.R(40, 66) * (i === 3 ? .4 : 1); L.stroke([[x - d * 10, 2, 2.6], [x, -h * .45, 2], [x + d * C.R(8, 16), -h, .4]], {load: .9, dry: .05, dry1: .5, streak: .6, rag: .2, side: .6}) } L.stroke([[-84, -22, 1.4], [-10, -27, 2], [20, -12, 1.2]], {load: .85, dry: .1, dry1: .5, streak: .6}); line(L, 40, -2, 90, -8, 1.2, {load: .8}) });
pp('banner', 150, 200, 8, (L, C) => { shadow(L, 0, 16); line(L, 0, 0, 3, -160, 1.5, {load: .9, w0: 1, w1: .5, dry1: .3}); line(L, -5, -153, 9, -154, 1.2, {load: .9});
  L.stroke([[3, -144, 11], [-22, -143, 10], [-44, -140, 7], [-60, -146, 1]], {pig: 'rust', load: .7, load1: .45, dry: .05, dry1: .6, streak: .8, rag: .25, pool: .3, gran: 1.1}); L.stroke([[-40, -134, 4], [-52, -129, 3], [-62, -125, .5]], {pig: 'rust', load: .7, dry: .1, dry1: .6}) });
pp('fallen', 230, 90, 40, (L, C) => { line(L, -90, -4, 90, -16, 1.6, {load: .9, w0: 1, w1: .6}); L.stroke([[60, -17, 3], [44, -8, 12], [18, -2, 13], [-4, -6, 6], [-16, -2, 1]], {pig: 'rust', load: .7, load1: .45, dry: .05, dry1: .6, streak: .8, rag: .3, pool: .3, gran: 1.1}); L.blot(30, 0, 40, 6, {dens: .16, rim: .1, soft: .7}) });
pp('drum', 150, 120, 36, (L, C) => { shadow(L, 0, 40); // a war drum on its side, its frame broken
  const cx = 0, cy = -30, rx = 14, ry = 28; body(L, x => cy - ry * .9 + Math.abs(x) * .1, -44, 30, 2);
  L.blot(-14, cy, 30, 24, {pig: 'och', dens: .2, rim: .3, soft: .4}); L.blot(-14, cy, 30, 24, {pig: 'rust', dens: .12, rim: .3, soft: .4});
  const face = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; face.push([cx + 14 + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1.3 + .6 * Math.sin(a + 2)]) } L.stroke(face, {load: .9, dry: .05, dry1: .3});
  L.stroke([[-42, cy - ry * .9, 1.5], [-14, cy - ry * 1.02, 2], [14, cy - ry, 1.5]], {load: .9}); L.stroke([[-42, cy + ry * .9, 1.5], [-14, cy + ry * 1.02, 2], [14, cy + ry, 1.5]], {load: .9});
  for (const fx of [-34, -20, -6]) for (const s of [-1, 1]) L.blot(fx, cy + s * ry * .95, 1.8, 1.8, {dens: 1, rim: .2, soft: .3});
  line(L, 26, 0, 60, -50, 1.4, {load: .85, w0: 1}); line(L, 50, 0, 40, -30, 1.2, {load: .8}); line(L, -60, -2, -20, -10, 1.1, {load: .7}) });
// --- the altar (祭坛): a round altar of rammed earth in three drums, a bronze cauldron on top, a ring of poles with pennons
function drum(L, C, cx, base, rx, ry, h, tone = 1) {        // one round tier, seen from above at an angle: a top ellipse and its front side
  area(L, cx - rx - 2, base - h - ry - 2, cx + rx + 2, base + ry + 2, (x, y) => { const u = (x - cx) / rx; if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return y > base - h - e && y < base + e ? 1 : 0 }, 'white');
  area(L, cx - rx, base - h - ry, cx + rx, base + ry, (x, y) => { const u = (x - cx) / rx; if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return y > base - h + e && y < base + e ? (.22 + .12 * u) * tone : 0 }, 'och', 1.3);
  area(L, cx - rx, base - h - ry, cx + rx, base + ry, (x, y) => { const u = (x - cx) / rx; if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return y > base - h + e && y < base + e ? .1 * Math.max(0, u) * tone : 0 }, 'ink', 1.1);
  for (let dy = 6; dy < h - 3; dy += C.R(6, 10)) { let a = -.95; while (a < .95) { const l = C.R(.15, .5), p = []; for (let j = 0; j <= 4; j++) { const u = Math.min(.98, a + l * j / 4); p.push([cx + u * rx, base - h + dy + Math.sqrt(1 - u * u) * ry, .5 + .6 * Math.sin(Math.PI * j / 4)]) } L.stroke(p, {load: C.R(.15, .35) * tone, dry: .3, dry1: .85, streak: .7, pool: 0}); a += l + C.R(.05, .3) } }
  const rim = (yo, w, ld, back) => { const p = []; for (let i = 0; i <= 20; i++) { const a = back ? Math.PI + Math.PI * i / 20 : Math.PI * i / 20; p.push([cx + Math.cos(a) * rx, base - yo + Math.sin(a) * ry, w * (.5 + .5 * Math.sin(Math.PI * i / 20))]) } L.stroke(p, {load: ld * tone, dry: .08, dry1: .5, streak: .5, rag: .2}) };
  rim(h, 1.3, .7, true); rim(h, 1.8, .9, false); rim(0, 1.6, .8, false);
  line(L, cx - rx, base - h, cx - rx + 1, base, 1.2, {load: .6 * tone, w0: 1, w1: 1}); line(L, cx + rx, base - h, cx + rx - 1, base, 1.8, {load: .9 * tone, w0: 1, w1: 1});
}
function cauldron(L, C, x, y, k = 1) { L.blot(x, y - 22 * k, 24 * k, 15 * k, {pig: 'white', dens: 1.4, rim: 0, soft: .3}); L.blot(x, y - 22 * k, 24 * k, 15 * k, {pig: 'mal', dens: .55, rim: .3, soft: .25, rough: .15, gran: 1.2}); L.blot(x + 6 * k, y - 20 * k, 14 * k, 10 * k, {dens: .14, rim: .2, soft: .5});
  L.stroke([[x - 25 * k, y - 32 * k, 1.2 * k], [x, y - 29 * k, 2.4 * k], [x + 25 * k, y - 32 * k, 1.2 * k]], {load: .95, dry: .05, dry1: .3}); L.stroke([[x - 24 * k, y - 22 * k, 1], [x, y - 19 * k, 1.6 * k], [x + 24 * k, y - 22 * k, 1]], {load: .7, dry: .2, dry1: .6});
  for (const lx of [-16, 0, 16]) line(L, x + lx * k, y - 10 * k, x + lx * k + (lx ? Math.sign(lx) * 3 * k : 0), y, 2.2 * k, {load: .95, w0: 1, w1: .7}); for (const ex of [-18, 18]) { line(L, x + ex * k, y - 32 * k, x + ex * k, y - 44 * k, 1.4 * k, {load: .95, w0: 1, w1: 1}); line(L, x + (ex - 3) * k, y - 44 * k, x + (ex + 3) * k, y - 44 * k, 1.2 * k, {load: .95}) } }
pp('altar', 520, 380, 150, (L, C) => { shadow(L, 10, 200, .2);
  const poles = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; poles.push([Math.cos(a) * 230, Math.sin(a) * 66 - 20]) }
  const pole = ([px, py], i) => { const h = C.R(118, 136), pig = ['azu', 'mal', 'och', 'azu'][i % 4]; line(L, px, py, px + C.R(-1, 1), py - h, 2, {load: .95, w0: 1, w1: .6}); L.stroke([[px, py - h + 2, 7], [px - 22, py - h + 6, 7], [px - 46, py - h + 14, 1.5]], {pig, load: .95, load1: .7, dry: .05, dry1: .5, streak: .6, rag: .3, pool: .3, gran: 1.2}); L.stroke([[px, py - h + 10, 5], [px - 18, py - h + 16, 4.5], [px - 34, py - h + 24, .8]], {pig, load: .8, dry: .1, dry1: .6, streak: .6, rag: .3}); line(L, px - 3, py - h - 4, px + 3, py - h - 4, 1.4, {load: .9}) };
  poles.forEach((p, i) => { if (p[1] < -20) pole(p, i) });
  area(L, -190, -170, 190, 60, (x, y) => { for (const [b, rx, ry, h] of [[0, 190, 50, 34], [-34, 130, 34, 30], [-64, 76, 20, 26]]) { const u = x / rx; if (Math.abs(u) < 1 && Math.abs(y - (b - h)) < Math.sqrt(1 - u * u) * ry) return .1 } return 0 }, 'och', 1.3);
  drum(L, C, 0, 0, 190, 50, 34, 1); drum(L, C, 0, -34, 130, 34, 30, .95); drum(L, C, 0, -64, 76, 20, 26, .9);
  for (let i = 0; i < 6; i++) { const y = -4 - i * 10, w = 16; body(L, () => y - 6, -w, w, y + 1); line(L, -w, y - 5, w, y - 5, 1, {load: .7}); }    // stairs up the front
  cauldron(L, C, 0, -92, 1.2);
  poles.forEach((p, i) => { if (p[1] >= -20) pole(p, i) });
  for (let i = 0; i < 3; i++) { const x = [-150, 150, 90][i], y = [36, 30, 50][i]; body(L, () => y - 26, x - 8, x + 8, y + 1); L.blot(x, y - 13, 7, 13, {pig: 'och', dens: .2, rim: .3, soft: .3}); line(L, x - 8, y - 26, x - 8, y, 1, {load: .7}); line(L, x + 8, y - 26, x + 8, y, 1.4, {load: .85}) } }, 70);
pp('incense', 120, 200, 0, (L, C) => { smoke(L, 4, -6, 170, C, .09, .35); smoke(L, -4, -2, 130, C, .06, .5) });
// --- the granary (粮仓): round granaries (囷) on raised footings with conical thatch, a barn, a wattle fence, heaps and sacks
function roundGranary(L, C, x, y, r, h, k = 1) { const ry = r * .3, eave = y - h, apex = eave - r * 1.1;
  area(L, x - r - 6, y - h - ry, x + r + 6, y + ry + 4, (xx, yy) => { const u = (xx - x) / (r + 4); if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return yy > y - 10 * k - e && yy < y + e * 1.1 + 4 ? 1 : 0 }, 'white');
  area(L, x - r - 6, y - 12, x + r + 6, y + ry + 6, (xx, yy) => { const u = (xx - x) / (r + 4); if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return yy > y - 10 * k + e && yy < y + e + 4 ? .22 : 0 }, 'ink', 1.4);   // the stone footing
  area(L, x - r, eave - 2, x + r, y, (xx, yy) => { const u = (xx - x) / r; if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return yy > eave + e * .5 && yy < y - 10 * k + e ? 1 : 0 }, 'white');
  area(L, x - r, eave - 2, x + r, y, (xx, yy) => { const u = (xx - x) / r; if (Math.abs(u) > 1) return 0; const e = Math.sqrt(1 - u * u) * ry; return yy > eave + e * .5 && yy < y - 10 * k + e ? .2 + .14 * u : 0 }, 'och', 1.3);
  for (let i = -5; i <= 5; i++) { const u = i / 5.6, xx = x + u * r, e = Math.sqrt(1 - u * u) * ry; line(L, xx, eave + e * .6, xx, y - 10 * k + e, .7 * k, {load: .3 + .25 * Math.max(0, u), w0: 1, w1: 1, dry1: .6}) }
  for (const f of [.35, .7]) { const p = []; for (let i = 0; i <= 10; i++) { const u = -1 + 2 * i / 10, e = Math.sqrt(Math.max(0, 1 - u * u)) * ry; p.push([x + u * r, eave + (y - 10 * k - eave) * f + e, .9 * k]) } L.stroke(p, {load: .55, dry: .1, dry1: .6}) }
  L.blot(x - r * .2, y - 26 * k, 7 * k, 11 * k, {dens: .9, rim: .3, soft: .25});            // the hatch
  area(L, x - r * 1.2, apex, x + r * 1.2, eave + ry * 1.2, (xx, yy) => { const t = Math.abs(xx - x) / (r * 1.18); return t < 1 && yy > apex + t * (eave + ry * .6 - apex) && yy < eave + ry * .1 + ry * .9 * Math.sqrt(Math.max(0, 1 - t * t)) ? 1 : 0 }, 'white');
  area(L, x - r * 1.2, apex, x + r * 1.2, eave + ry, (xx, yy) => { const t = Math.abs(xx - x) / (r * 1.18), top = apex + t * (eave + ry * .6 - apex); return t < 1 && yy > top && yy < eave + ry * .1 + ry * .9 * Math.sqrt(Math.max(0, 1 - t * t)) ? .16 + .1 * ((xx - x) / r) : 0 }, 'och', 1.4);
  for (let i = 0, n = Math.round(r / 3.2); i < n; i++) { const u = -1 + 2 * (i + C.R(.2, .8)) / n, bx = x + u * r * 1.16, by = eave + ry * .7 * Math.sqrt(Math.max(0, 1 - u * u)) + ry * .2;
    L.stroke([[x + u * 3, apex + 4, .4], [x + (bx - x) * .55, apex + (by - apex) * .55, C.R(1.4, 2.6) * k], [bx, by, C.R(1.2, 2.2) * k]], {load: C.R(.3, .55) * (u > .2 ? 1.35 : 1), dry: C.R(.1, .3), dry1: .8, streak: .9, rag: .3, pool: .1}) }
  const eaveP = []; for (let i = 0; i <= 14; i++) { const u = -1 + 2 * i / 14; eaveP.push([x + u * r * 1.18, eave + ry * .9 * Math.sqrt(Math.max(0, 1 - u * u)) + ry * .1, (1 + .8 * Math.max(0, u)) * k]) } L.stroke(eaveP, {load: .95, dry: .05, dry1: .4, streak: .6, rag: .3});
  line(L, x, apex - 6 * k, x, apex + 6, 2 * k, {load: 1, w0: 1, w1: 1}); L.blot(x, apex - 8 * k, 4 * k, 3 * k, {dens: .9, rim: .3, soft: .3}) }
function heap(L, C, x, y, w) { body(L, xx => y - w * .5 * (1 - ((xx - x) / w) ** 2), x - w, x + w, y + 1); area(L, x - w, y - w * .5, x + w, y + 2, (xx, yy) => { const u = (xx - x) / w; const top = y - w * .5 * (1 - u * u); return yy > top && yy < y + 1 ? .26 + .1 * u : 0 }, 'och', 1.6);
  for (let i = 0; i < w; i++) { const u = C.R(-.9, .9), yy = y - w * .5 * (1 - u * u) * C.R(0, 1); L.blot(x + u * w, yy, 1, .8, {pig: 'och', dens: 1.2, rim: .2, soft: .2}) }
  L.stroke([[x - w, y, .5], [x - w * .4, y - w * .42, 1], [x, y - w * .5, 1.2], [x + w * .5, y - w * .37, 1.4], [x + w, y, .6]], {load: .7, dry: .2, dry1: .7}) }
function sack(L, C, x, y, k = 1) { body(L, xx => y - 22 * k + Math.abs(xx - x) * .5, x - 11 * k, x + 11 * k, y + 1); L.blot(x, y - 10 * k, 10 * k, 11 * k, {pig: 'och', dens: .25, rim: .3, soft: .3}); L.stroke([[x - 10 * k, y, .8], [x - 11 * k, y - 12 * k, 1.2], [x - 4 * k, y - 22 * k, .9], [x + 4 * k, y - 22 * k, .9], [x + 11 * k, y - 12 * k, 1.5], [x + 10 * k, y, .9]], {load: .8, dry: .1, dry1: .4}); line(L, x - 4 * k, y - 22 * k, x + 4 * k, y - 26 * k, 1, {load: .9}) }
function fence(L, C, x0, x1, y, h = 26, tone = 1) { for (let x = x0; x < x1; x += C.R(9, 13)) line(L, x, y + C.R(-1, 1), x + C.R(-1.5, 1.5), y - h * C.R(.85, 1.1), 1.2, {load: .75 * tone, w0: 1, w1: .7}); for (const f of [.35, .75]) L.stroke([[x0, y - h * f, .9], [(x0 + x1) / 2, y - h * f + C.R(-2, 2), 1.4], [x1, y - h * f, .9]], {load: .55 * tone, dry: .15, dry1: .6, streak: .6}) }
pp('granaries', 560, 330, 170, (L, C) => { shadow(L, 0, 240, .2);
  roundGranary(L, C, -150, -40, 62, 70, 1); roundGranary(L, C, 70, -56, 70, 82, 1.1); roundGranary(L, C, 190, -20, 52, 58, .9);
  fence(L, C, -260, -60, 22, 24); fence(L, C, 110, 270, 30, 22);
  heap(L, C, -40, 24, 40); sack(L, C, 30, 32); sack(L, C, 52, 36, .9); sack(L, C, 16, 40, .85) }, 40);
pp('barn', 300, 220, 90, (L, C) => { shadow(L, 0, 110); body(L, () => -70, -96, 96, 0); L.blot(0, -36, 90, 32, {pig: 'och', dens: .24, rim: .3, soft: .3, rough: .2, gran: 1.2});
  for (let x = -90; x <= 90; x += 9) line(L, x, -2, x + C.R(-1, 1), -68, .6, {load: .25, w0: 1, w1: 1}); line(L, -96, 0, 96, -1, 1.4, {load: .8}); line(L, -94, 0, -94, -70, 1.2, {load: .7}); line(L, 94, 0, 94, -70, 1.6, {load: .9});
  L.blot(-30, -26, 14, 22, {dens: .95, rim: .3, soft: .2}); roof(L, 0, -150, -66, 60, 118, C, 1, 1.1, .25, .22); sack(L, C, 60, 14); sack(L, C, 80, 18, .9); heap(L, C, -70, 16, 30) }, 30);
pp('oxcart', 220, 130, 50, (L, C) => { shadow(L, 0, 70); const cx = -10, cy = -26, r = 24; const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * .5, cy + Math.sin(a) * r, 1.2 + .6 * Math.sin(a + 1)]) } L.stroke(pts, {load: .85, dry: .05, dry1: .3});
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(L, cx, cy, cx + Math.cos(a) * r * .45, cy + Math.sin(a) * r * .9, .6, {load: .6}) }
  body(L, () => -54, -60, 50, -26); L.blot(-5, -40, 54, 14, {pig: 'och', dens: .22, rim: .3, soft: .3}); line(L, -60, -26, 50, -28, 1.3, {load: .85}); line(L, -60, -54, 50, -54, 1, {load: .7});
  heap(L, C, -5, -54, 34); for (const sx of [-40, 26]) sack(L, C, sx, -52, .8); line(L, 50, -30, 104, -12, 1.4, {load: .85, w0: 1}) });
// --- the investiture platform (封神台): a high terrace of rammed earth in three stages, a stair up its face, a hall on top
// with the List hung in its door, apricot banners (杏黄旗) at its corners, mist about its foot, pines either side
pp('platform', 540, 470, 180, (L, C) => { shadow(L, 0, 190, .16);
  greenPine(L, -215, -4, 145, C, {lean: -.15}); greenPine(L, 212, 0, 128, C, {lean: .1});
  let ty = 0; const stages = [[172, 60], [130, 54], [94, 50]];
  for (const [w, h] of stages) { wall(L, C, -w, w, ty, () => ty - h, {tone: 1.5, endL: true, endR: true}); L.blot(w * .45, ty - h * .5, w * .5, h * .45, {dens: .06, rim: .2, soft: .6}); ty -= h }
  // the stair: a band of steps up the middle of each stage
  ty = 0; for (const [w, h] of stages) { const sw = 22; body(L, () => ty - h, -sw, sw, ty + 1); L.blot(0, ty - h / 2, sw, h / 2, {pig: 'och', dens: .1, rim: .2, soft: .3}); for (let y = ty - 4; y > ty - h; y -= 7) line(L, -sw, y, sw, y, 1, {load: .55, w0: .8, w1: .8}); line(L, -sw, ty - h, -sw, ty, 1.2, {load: .7, w0: 1, w1: 1}); line(L, sw, ty - h, sw, ty, 1.6, {load: .9, w0: 1, w1: 1}); ty -= h }
  for (let i = 0; i < 3; i++) { const [w] = stages[i], y = -stages.slice(0, i + 1).reduce((a, s) => a + s[1], 0); for (let x = -w + 10; x < w - 8; x += 14) { if (Math.abs(x) < 30) continue; line(L, x, y, x, y - 9, .9, {load: .6, w0: 1, w1: 1}) } L.stroke([[-w + 6, y - 8, .7], [0, y - 9, 1], [w - 6, y - 8, .7]], {load: .5, dry: .2, dry1: .6}) }   // railings on each stage
  const top = ty; hall(L, 0, top, 108, 128, C, {posts: 6, k: 1.2, mal: .7, two: true, wallTone: .2});
  // the List of the Deified (封神榜): a long pale scroll hung in the hall's door, written in small dark marks
  body(L, () => top - 36, -11, 11, top - 3); L.blot(0, top - 20, 10, 16, {pig: 'apri', dens: .25, rim: .3, soft: .2}); line(L, -13, top - 37, 13, top - 37, 1.6, {load: 1, w0: 1, w1: 1});
  for (let c = -1; c <= 1; c++) for (let r = 0; r < 4; r++) L.blot(c * 6, top - 31 + r * 7, 1.3, 1, {dens: .8, rim: .2, soft: .2});
  // apricot banners on tall poles at the corners of the top stage and the foot
  const flag = (x, y, h, len, wd) => { line(L, x, y, x + C.R(-1, 1), y - h, 2.2, {load: .95, w0: 1, w1: .6}); line(L, x - 4, y - h + 6, x - len - 4, y - h + 6, 1.6, {load: .9, w0: 1, w1: 1}); L.blot(x - len / 2 - 3, y - h + 8, 3, 3, {dens: 1, rim: .2, soft: .3});
    const p = []; for (let i = 0; i <= 6; i++) { const t = i / 6; p.push([x - len / 2 - 3 + Math.sin(t * 3) * 4 * t, y - h + 10 + wd * t, len * .48 * (1 - .25 * t)]) } L.stroke(p, {pig: 'white', load: 2, pool: 0, streak: 0, rag: .1});
    L.stroke(p, {pig: 'apri', load: .55, load1: .4, dry: .05, dry1: .4, streak: .5, rag: .2, pool: .4, gran: 1.2}); L.stroke(p.map(([a, b, c]) => [a, b, c * .9]), {pig: 'och', load: .12, dry: .2, dry1: .6, streak: .8});
    for (const s2 of [-1, 1]) L.stroke(p.map(([a, b, c], i) => [a + s2 * c * .96, b, .5 + .5 * (i < 6)]), {load: .45, dry: .1, dry1: .6});
    for (let i = 0; i < 3; i++) L.blot(x - len / 2 - 3, y - h + 22 + i * wd / 4, 2.6, 2.2, {dens: .7, rim: .2, soft: .2}) };
  flag(-104, top, 112, 26, 54); flag(104, top, 124, 26, 60); flag(-156, 0, 118, 22, 46); flag(162, 0, 110, 22, 44);
  for (const [mx, my, rx, ry, d] of [[-200, -30, 140, 20, .8], [170, -48, 160, 20, .75], [0, -6, 250, 12, .55]]) cutMist(L, mx, my, rx, ry, d) }, 60);

/* ======================================================================================================================
   6. MIST: soft lobes of white, laid over the ground in bands under the figures. Painted at half size.
   ====================================================================================================================== */
const MIST = {}; [[1400, 220], [1100, 180], [800, 150]].forEach(([w, h], i) => { MIST['mist' + i] = {w, h, paint: (L, C) => { for (let j = 0; j < 7; j++) L.blot(C.R(-w * .32, w * .32), C.R(-h * .12, h * .12), w * C.R(.15, .3), h * C.R(.22, .4), {pig: 'white', dens: .35, rim: 0, soft: .95, rough: .5, freq: .004, gran: 0}) }} });

/* ---------- bake ---------- */
const t0 = performance.now(), META = {ky: KY, world: WORLD};
async function webp(raw, w, h, file, q = 80, aq = 80) { await sharp(raw, {raw: {width: w, height: h, channels: 4}}).webp({quality: q, alphaQuality: aq, effort: 6}).toFile(join(OUT, file)); console.log(file, w + 'x' + h, statSync(join(OUT, file)).size, 'bytes', ((performance.now() - t0) / 1000).toFixed(1) + 's') }
if (want('far')) { const L = new Layer(FAR.w, FAR.h, 1, 0, 0); L.seed = 3; (SCENE === 'passes' ? paintFarPasses : SCENE === 'mengjin' ? paintFarMeng : paintFar)(L); const raw = farFade(rgbaOf(L)); await webp(raw, FAR.w, FAR.h, 'far.webp', 82, 82); await proof('far', raw, FAR.w, FAR.h) }
async function atlas(defs, file, s, quality, aq = 80) {
  const names = Object.keys(defs).sort((a, b) => defs[b].h - defs[a].h), AW = 2048, cells = {}, parts = []; let x = 0, y = 0, rowH = 0;
  for (const n of names) { const q = defs[n], W = Math.ceil(q.w * s), H = Math.ceil(q.h * s); if (x + W > AW) { x = 0; y += rowH + 2; rowH = 0 }
    const px = q.px ?? q.w / 2, py = q.py ?? q.h / 2, L = new Layer(q.w, q.h, s, px, py); L.seed = n.length * 5.3 + n.charCodeAt(n.length - 1); q.paint(L, chance(n.split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 11)));
    const raw = rgbaOf(L); parts.push({input: raw, raw: {width: L.W, height: L.H, channels: 4}, left: x, top: y}); cells[n] = [x, y, L.W, L.H, px, py, s, q.r || 0]; if (PROOF) await proof('piece-' + n, raw, L.W, L.H); x += W + 2; rowH = Math.max(rowH, H) }
  await sharp({create: {width: AW, height: y + rowH, channels: 4, background: {r: PAPER[0], g: PAPER[1], b: PAPER[2], alpha: 0}}}).composite(parts).webp({quality, alphaQuality: aq, effort: 6}).toFile(join(OUT, file));
  console.log(file, AW + 'x' + (y + rowH), names.length, 'pieces', statSync(join(OUT, file)).size, 'bytes', ((performance.now() - t0) / 1000).toFixed(1) + 's'); return {w: AW, h: y + rowH, cells};
}
// only what the layouts still use (the painted atlases replaced the code trees, rocks and landmarks)
const USED_G = /^(rise|meadow|earth|stones|track|tuft|march)\d+$/, USED_P = /^pc-cliff\d+$/;
for (const k of Object.keys(GROUND)) if (!USED_G.test(k)) delete GROUND[k]; for (const k of Object.keys(PROPS)) if (!USED_P.test(k)) delete PROPS[k];
if (SCENE === 'xiqi' && want('ground')) META.ground = await atlas(GROUND, 'ground.webp', 1, 66, 70);
if (SCENE === 'xiqi' && want('props')) META.props = await atlas(PROPS, 'props.webp', 1.5, 84, 86);
if (SCENE === 'xiqi' && want('mist')) META.mist = await atlas(MIST, 'mist.webp', .5, 70, 70);
if (want('far')) META.far = {file: 'far.webp', ...FAR};
META.land = {...LAND, files: COURSES.map((c, i) => `land-${i}.webp`)};
const courseOf = ci => COURSES[ci];
for (let ci = 0; ci < COURSES.length; ci++) {
  if (want('land') || want('land' + ci)) { const lw = LAND.x1 - LAND.x0, lh = (LAND.y1 - LAND.y0) * KY, L = new Layer(lw, lh, LAND.s, -LAND.x0, -LAND.y0 * KY); L.seed = 5 + ci; paintLand(L, courseOf(ci), ci); const raw = rgbaOf(L); await webp(raw, L.W, L.H, `land-${ci}.webp`, 80, 70); await proof(`land-${ci}`, raw, L.W, L.H) }
  if (want('river') || want('river' + ci)) {
    for (const f of readdirSync(OUT)) if (new RegExp(`^river-${ci}-\\d+\\.webp$`).test(f)) unlinkSync(join(OUT, f));
    const TW = 1536, TH = 768, tiles = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const wt of courseOf(ci).waters) { const P = sq(wt.pts); for (let t = 0; t <= 1; t += .002) { const a = along(P, t); x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]) } }
    x0 = Math.max(-300, x0 - 600); x1 = Math.min(6300, x1 + 600); y0 = Math.max(-200, y0 - 520); y1 = Math.min(WORLD * KY + 200, y1 + 520);
    for (let ty = Math.floor(y0 / TH) * TH; ty < y1; ty += TH) for (let tx = Math.floor(x0 / TW) * TW; tx < x1; tx += TW) {
      let hit = false; for (const wt of courseOf(ci).waters) { const P = sq(wt.pts); for (let t = 0; t <= 1 && !hit; t += .002) { const a = along(P, t); if (a[0] > tx - 700 && a[0] < tx + TW + 700 && a[1] > ty - 520 && a[1] < ty + TH + 520) hit = true } }
      if (!hit) continue;
      const L = new Layer(TW, TH, 1, -tx, -ty); L.seed = 9; if (SCENE !== 'passes') paintFields(L, courseOf(ci), ci); for (const r of courseOf(ci).roads || []) paintRoad(L, r, chance(55 + ci)); paintRiver(L, courseOf(ci), ci); const raw = rgbaOf(L);
      // the river too goes under the mist beyond the field's edges
      for (let Y = 0; Y < TH; Y++) for (let X = 0; X < TW; X++) { const x = X + tx, y = (Y + ty) / KY, out = Math.max(-x, x - WORLD, -y, y - WORLD) + (fbm(x * .002, y * .002, 3) - .5) * 260, f = 1 - smooth(-140, 360, out); if (f < 1) raw[(Y * TW + X) * 4 + 3] *= f }
      let any = false; for (let i = 3; i < raw.length; i += 4) if (raw[i] > 6) { any = true; break } if (!any) continue;
      const file = `river-${ci}-${tiles.length}.webp`; await webp(raw, TW, TH, file, 64, 68); tiles.push({file, x: tx, y: ty, w: TW, h: TH}); if (PROOF && tiles.length <= 3) await proof(file.replace('.webp', ''), raw, TW, TH) }
    META['river' + ci] = tiles;
  }
}
// the courses as data, for layout.js (and through it the rules): world coordinates, half-widths, fords, bars
writeFileSync(join(OUT, 'courses.js'), '// Written by gen/xiqi.gen.mjs scene=' + SCENE + '. The water courses (world x, y, half-width w), fords and sand bars (t along the water); for the passes the corridor and gates, for Mengjin the wall.\nexport const COURSES = ' + JSON.stringify(COURSES) + ';\n');
{ const f = join(OUT, SCENE + '.json'); let old = {}; try { old = JSON.parse((await import('node:fs')).readFileSync(f, 'utf8')) } catch {} writeFileSync(f, JSON.stringify({...old, ...META})) }
console.log(((performance.now() - t0) / 1000).toFixed(1) + ' s');
