// node world/src/fengshen/art/scene2/gen/scene.gen.mjs [draft] [only=set,ground,sprites]
// The road to Muye in ink and mineral colour, for a world 4800 px long: five places, each its own composition.
//   1 the Zhou camp at dawn   2 the crossing at Mengjin   3 the pine ridge and its waterfall   4 the plain of Muye   5 the walls of Shang
// Baked to ../baked/: for every sheet an ink mask (<name>.webp, alpha only: the ink takes its colour at run time, from
// the time of day) and, where there is mineral colour, <name>.c.webp (to be multiplied under the ink); three atlases of
// things that move (ink, mist, colour); the paper's grain; and scene.json, which says where everything sits.
// Units: one world pixel. The ground line is y = 1000 (GY). The game shows about 1946 x 1216 of them (zoom 0.74), with the
// ground line 949 from the top, so the sky is tall: the picture is composed for that view, not for 1440 x 900 at zoom 1.
import {writeFileSync, mkdirSync, statSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Layer, sharp, chance, fbm, vnoise, clamp, smooth, PAPER} from './ink.mjs';
import {GY, ridgeOf, slope, rock, ghost, cutMist, pine, pineFar, bare, leaf, reed, drag} from './brush.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(root, 'baked');
const arg = k => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const DRAFT = process.argv.includes('draft'), ONLY = arg('only') ? arg('only').split(',') : null;
export const WORLD = 4800, HALF = 975, MARGIN = 120, U0 = HALF + MARGIN, CAM0 = 273, CAM1 = 4527;
// p: parallax; y0..y1: the band it paints; s: pixels per unit; d: depth 0 near .. 1 far (how far its ink is cooled and paled)
export const LAYERS = {
  // aq: WebP alpha quality of the ink; cs: the colour sheet's size as a share of the ink's (colour is soft, ink is not)
  sky: {p: .04, y0: 60, y1: 840, s: .25, d: 1, aq: 60, cs: 1}, far: {p: .12, y0: 400, y1: 850, s: .5, d: .85, aq: 66, cs: 1}, mid: {p: .3, y0: 360, y1: 860, s: .6, d: .7, aq: 70, cs: 1},
  hills: {p: .55, y0: 400, y1: 880, s: .8, d: .5, aq: 74, cs: .75}, set: {p: .9, y0: 230, y1: 1000, s: DRAFT ? .75 : 1, d: .45, aq: 78, cs: .6}, ground: {p: 1, y0: 930, y1: 1290, s: 1, d: 0, aq: 76, cs: 1},
};
const widthOf = p => Math.round((CAM1 - CAM0) * p + 2 * U0);
export const PL = [560, 1440, 2400, 3360, 4240];                                 // the camera's x at the middle of each place
const X = (name, cam, sx = 0) => U0 + LAYERS[name].p * (cam - CAM0) + sx;        // the sheet's u that is sx right of the middle of the screen
const sh = (pts, dx) => pts.map(([x, y, ...r]) => [x + dx, y, ...r]);
// what the run time needs to know about things that move: filled by the painters
const PLACE = {clouds: [], banners: [], falls: [], water: [], mist: [], tufts: [], front: [], birds: [], sun: null};

/* ---------- small things made of a few strokes ---------- */
const line = (L, x0, y0, x1, y1, w, o = {}) => { const bow = o.bow ?? 0, mx = (x0 + x1) / 2 - (y1 - y0) * bow, my = (y0 + y1) / 2 + (x1 - x0) * bow;
  return L.stroke([[x0, y0, w * (o.w0 ?? .7)], [mx, my, w], [x1, y1, w * (o.w1 ?? .3)]], {load: .8, dry: .05, dry1: .45, streak: .4, rag: .15, pool: .05, ...o}) };
// paper kept under a thing, so that it hides what is behind it: everything below a profile, down to y
const body = (L, prof, x0, x1, y, o = 1) => { let top = 1e9; for (let x = x0; x <= x1; x += 4) top = Math.min(top, prof(x)); L.mountain(prof, {pig: 'white', dens: 2 * o, fade: (y - top) * 1.02, fadeVar: 0, pow: .12, edge: 0, blotch: 0, tide: 0, gran: 0, x0, x1, feather: 3, rough: 0}) };
// a field tent: a ridge pole on crossed sticks, two slopes, the dark of the door on the gable that faces us
function tent(L, x, y, k, C, tone = 1) {
  const w = 46 * k * C.R(.9, 1.15), h = 50 * k * C.R(.9, 1.1), rx0 = x - w * .62, rx1 = x + w * .6, sag = C.R(1, 4) * k;
  body(L, xx => xx < rx0 ? y - h * (xx - (rx0 - w * .42)) / (w * .42) : xx > rx1 ? y - h * ((rx1 + w * .42) - xx) / (w * .42) : y - h, rx0 - w * .42, rx1 + w * .42, y + 1);
  L.blot(x - w * .15, y - h * .42, w * .85, h * .5, {pig: 'och', dens: .14 * tone, rim: .2, soft: .5, rough: .3});
  L.stroke([[rx0 - w * .2, y - 3, w * .05], [rx0 + w * .1, y - h * .5, w * .22], [rx0 + w * .5, y - h + 4, w * .1]], {load: .12 * tone, dry: .1, dry1: .7, streak: .8, rag: .4});          // a tone on the far slope
  L.stroke([[rx0, y - h, .7 * k], [x, y - h + sag, 1.5 * k], [rx1, y - h * .98, .9 * k]], {load: .7 * tone, dry: .1, dry1: .5, streak: .5, rag: .2});              // the ridge
  line(L, rx0, y - h, rx0 - w * .42, y, 1.2 * k, {load: .55 * tone, bow: .04, dry1: .7});                                                                           // the far slope
  line(L, rx1, y - h * .98, rx1 + w * .42, y, 1.6 * k, {load: .8 * tone, bow: -.03});                                                                               // the gable
  line(L, rx1, y - h * .98, rx1 - w * .34, y, 1.3 * k, {load: .7 * tone, bow: .03});
  L.stroke([[rx1 - 1, y - h * .8, 1 * k], [rx1 + w * .02, y - h * .4, w * .14], [rx1 + w * .04, y - 2, w * .22]], {load: .8 * tone, dry: .05, dry1: .4, streak: .7, rag: .3, pool: .2});   // the door
  for (const rx of [rx0, rx1]) { line(L, rx - 3 * k, y - h + 4 * k, rx + 4 * k, y - h - 9 * k, .7 * k, {load: .75 * tone}); line(L, rx + 3 * k, y - h + 4 * k, rx - 4 * k, y - h - 8 * k, .6 * k, {load: .65 * tone}) }
  drag(L, x - w * 1.1, y + 1, w * 2.3, 1.2 * k, .34 * tone, C, {dry: .5});
}
// the commander's tent: a canopy on four posts, a fringe under its eave, curtains tied back
function greatTent(L, x, y, k, C) {
  const w = 82 * k, h = 78 * k, eave = y - h * .58;
  body(L, xx => { const u = Math.abs(xx - x); return u < w * .48 ? y - h : y - h + (h * .42) * (u - w * .48) / (w * .54) }, x - w * 1.02, x + w * 1.02, y + 1);
  L.blot(x, y - h * .32, w * .9, h * .34, {pig: 'och', dens: .2, rim: .2, soft: .5, rough: .25}); L.blot(x - w * .1, y - h * .8, w * .7, h * .2, {pig: 'och', dens: .12, rim: .2, soft: .5, rough: .25});
  for (let i = 0; i < 7; i++) { const t = (i + C.R(.2, .8)) / 7, tx = x - w * .46 + w * .92 * t, bx = x - w + w * 2 * t; L.stroke([[tx, y - h + 2, 3 * k], [(tx + bx) / 2, (y - h + eave) / 2, 6 * k], [bx, eave - 1, 3 * k]], {load: C.R(.1, .2) * (t > .55 ? 1.5 : 1), dry: .15, dry1: .8, streak: .9, rag: .3, side: -.5}) }
  L.stroke([[x - w * .5, y - h, .8 * k], [x, y - h - 2 * k, 1.9 * k], [x + w * .46, y - h + 1, 1 * k]], {load: .85, dry: .05, dry1: .45, streak: .5, rag: .2});
  line(L, x - w * .5, y - h, x - w * 1.02, eave, 1.5 * k, {load: .7, bow: .06}); line(L, x + w * .46, y - h + 1, x + w * 1.0, eave + 2, 1.9 * k, {load: .88, bow: -.06});
  L.stroke([[x - w * 1.04, eave, 1 * k], [x - w * .2, eave + 3 * k, 1.8 * k], [x + w * 1.02, eave + 2, 1.2 * k]], {load: .85, dry: .1, dry1: .5, streak: .6, rag: .25});
  for (let i = 0, n = 15; i < n; i++) { const fx = x - w * .98 + (i + C.R(.2, .8)) * w * 1.96 / n; line(L, fx, eave + 2, fx + C.R(-1, 1), eave + C.R(6, 11) * k, .7 * k, {load: C.R(.45, .75)}) }
  L.stroke([[x - w * .7, eave + 12 * k, 3 * k], [x, eave + 16 * k, h * .2], [x + w * .7, eave + 12 * k, 3 * k]], {load: .5, dry: .1, dry1: .5, streak: .8, rag: .3, pool: .2});          // the dark inside
  for (const [px, t] of [[-.92, .6], [-.3, .55], [.36, .7], [.94, .88]]) line(L, x + w * px, eave + 3, x + w * px + C.R(-1.5, 1.5), y, 1.3 * k, {load: t, dry1: .6});
  L.stroke([[x + w * .36, eave + 8 * k, 1], [x + w * .5, y - h * .25, w * .09], [x + w * .9, y - 3, w * .05]], {load: .6, dry: .15, dry1: .6, streak: .8, rag: .3});     // a curtain
  L.stroke([[x - w * .3, eave + 8 * k, 1], [x - w * .46, y - h * .25, w * .07], [x - w * .88, y - 3, w * .04]], {load: .42, dry: .2, dry1: .7, streak: .8, rag: .3});
  drag(L, x - w * 1.3, y + 1, w * 2.7, 1.5 * k, .4, C, {dry: .45});
}
// a standard: a pole that is not quite straight, a crossbar, and (at run time) cloth that streams down wind
function standard(L, x, y, h, C, o = {}) {
  line(L, x, y, x + C.R(-3, 3), y - h, 1.5, {load: .9, bow: C.R(-.012, .012), w0: 1, w1: .5, dry1: .3});
  line(L, x - 7, y - h + 7, x + 8, y - h + 6, 1.2, {load: .9});
  L.stroke([[x, y - h - 1, .7], [x + 1, y - h - 9, 2], [x, y - h - 16, .3]], {load: .95, pool: .1});
  if (o.cloth) PLACE.banners.push({layer: 'set', x: +x.toFixed(1), y: +(y - h + 10).toFixed(1), k: o.k ?? 1, cell: o.cloth, ph: +C.R(0, 6).toFixed(2)});
}
// a rack of dagger-axes (戈) leaning on a rail
function rack(L, x, y, k, C) {
  line(L, x - 30 * k, y, x - 29 * k, y - 26 * k, 1.2, {load: .75}); line(L, x + 30 * k, y, x + 31 * k, y - 25 * k, 1.2, {load: .75}); line(L, x - 36 * k, y - 24 * k, x + 37 * k, y - 23 * k, 1.3, {load: .8, bow: .01});
  for (let i = 0; i < 6; i++) { const bx = x - 26 * k + i * 10 * k + C.R(-2, 2), tx = bx + C.R(4, 12) * k, ty = y - C.R(52, 70) * k; line(L, bx, y, tx, ty, .9, {load: C.R(.65, .9), w0: 1, w1: .6}); line(L, tx - 1, ty + 5 * k, tx + 7 * k, ty + 3 * k, 1.3, {load: .9, w0: .5, w1: .2}) }
}
// a war chariot at rest: one wheel toward us, the box, the parasol on its staff, the draught pole tipped up
function chariot(L, x, y, k, C, tone = 1) {
  const r = 17 * k, cy = y - r, pts = [];
  for (let i = 0; i <= 14; i++) { const a = -Math.PI * .5 + i / 14 * Math.PI * 2; pts.push([x + Math.cos(a) * r * (1 + C.R(-.03, .03)), cy + Math.sin(a) * r, (1.1 + .7 * Math.sin(a * 1 + 1)) * k]) }
  L.stroke(pts, {load: .82 * tone, dry: .05, dry1: .3, streak: .4, rag: .2});
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3; line(L, x, cy, x + Math.cos(a) * r * .92, cy + Math.sin(a) * r * .92, .55 * k, {load: .55 * tone, w0: 1, w1: .5}) }
  L.stroke([[x - 24 * k, cy - 6 * k, 1], [x - 2 * k, cy - 12 * k, 6.5 * k], [x + 22 * k, cy - 7 * k, 1.2]], {load: .55 * tone, dry: .15, dry1: .5, streak: .7, rag: .25});      // the box
  line(L, x - 22 * k, cy - 20 * k, x + 22 * k, cy - 19 * k, 1.1 * k, {load: .85 * tone});
  line(L, x + 2 * k, cy - 18 * k, x + 4 * k, cy - 66 * k, .9 * k, {load: .85 * tone, w0: 1});                                                                             // the staff
  L.stroke([[x - 26 * k, cy - 60 * k, .6], [x + 3 * k, cy - 70 * k, 2.2 * k], [x + 32 * k, cy - 60 * k, .6]], {load: .78 * tone, dry: .1, dry1: .5, streak: .6, rag: .3});   // the parasol
  line(L, x + 20 * k, cy - 4 * k, x + 74 * k, cy - 30 * k, 1.1 * k, {load: .75 * tone, bow: .08, w0: 1}); line(L, x + 66 * k, cy - 36 * k, x + 80 * k, cy - 22 * k, 1 * k, {load: .75 * tone, bow: -.2});
  drag(L, x - 40 * k, y + 1, 120 * k, 1.2 * k, .32 * tone, C, {dry: .5});
}
// broken strokes under a thing that stands in water: its image, paler and wider as it goes down
function reflect(L, x0, x1, y, depth, load, C, n = 6) {
  for (let i = 0; i < n; i++) { const t = (i + .5) / n, yy = y + 3 + depth * (t * t + .1 * t), cx = (x0 + x1) / 2 + C.R(-8, 8), w = (x1 - x0) * (.5 - .2 * t) * C.R(.75, 1.1);
    let x = cx - w; while (x < cx + w) { const len = C.R(14, 60) * (1 - .3 * t); drag(L, x, yy + C.R(-1.5, 1.5), Math.min(len, cx + w - x + 6), C.R(1.3, 3) * (1 - .4 * t), load * (1 - .7 * t) * C.R(.6, 1.2), C, {dry: .3 + .3 * t, tilt: .3}); x += len + C.R(6, 30) * (1 + t) } }
}
// a river boat: the hull in one loaded pull, a mat roof or men standing with their spears, the pole, and its image
function boat(L, x, y, len, C, o = {}) {
  const k = len / 100, m = o.mk ?? Math.min(k, 1.2), hk = Math.min(k, 1.5);
  L.stroke([[x - len * .52, y - 7 * hk, .6], [x - len * .3, y - 1, 3.2 * hk], [x + len * .2, y, 3.6 * hk], [x + len * .5, y - 9 * hk, .5]], {load: .9, dry: .05, dry1: .5, streak: .5, rag: .2, side: .5});
  if (o.roof) { L.stroke([[x - len * .2, y - 4 * hk, 1], [x - len * .02, y - 17 * hk, 2.6 * hk], [x + len * .2, y - 4 * hk, 1]], {load: .6, dry: .2, dry1: .6, streak: .8, rag: .3}); line(L, x - len * .22, y - 3 * hk, x + len * .22, y - 3 * hk, .8, {load: .65}) }
  if (o.men) for (let i = 0; i < o.men; i++) { const mx = x - len * .3 + i * len * .62 / o.men + C.R(-3, 3), h = C.R(17, 22) * m;
    L.stroke([[mx, y - 4 * hk, 1.6 * m], [mx + C.R(-.6, .6), y - 4 * hk - h * .6, 2 * m], [mx, y - 4 * hk - h, 1.1 * m]], {load: C.R(.65, .9), dry1: .3, pool: .1});
    if (C.rnd() < .75) line(L, mx + 3 * m, y - 5 * hk, mx + C.R(3, 7) * m, y - 4 * hk - h - C.R(10, 20) * m, .65, {load: .75, w0: 1, w1: .6}) }
  if (o.flag) { const fx = x + len * .14, fh = 52 * m; line(L, fx, y - 5 * hk, fx + 1, y - fh, 1, {load: .85, w0: 1}); L.stroke([[fx, y - fh + 2, 3 * m], [fx - 12 * m, y - fh + 4, 2.6 * m], [fx - 26 * m, y - fh + 8, .4]], {pig: 'rust', load: .8, dry: .1, dry1: .6, streak: .6, rag: .3}) }
  line(L, x - len * .44, y - 5 * hk, x - len * .44 + C.R(-2, 2), y - 5 * hk - 24 * m, 1.7 * m, {load: .8, w0: 1});                       // the poler
  line(L, x - len * .4, y - 6 * hk - 28 * m, x - len * .62, y + 10 * hk, .7, {load: .75, w0: 1, w1: .8});
  reflect(L, x - len * .45, x + len * .42, y + 2, 14 * hk + 8, .34, C, 4);
}
// rammed-earth wall: the firm line of its top, the layers of its ramming, gullies cut by rain; its foot in dust.
// Its ends are battered: a wedge of the same earth pulled down the slope with the side of the brush.
function wall(L, C, x0, x1, base, top, o = {}) {
  const tone = o.tone ?? 1, sd = x0 * .013, wy = x => top(x) + (vnoise(x * .05, 2) - .5) * 2.4, hgt = base - top(x0), bat = hgt * .2;
  const shade = x => .7 + .6 * fbm(x * .005 + sd, 3, 2);
  body(L, top, x0, x1, base + 1);
  L.mountain(wy, {dens: .21 * tone, fade: hgt * .95, fadeVar: .3, pow: .7, edge: 0, pig: 'och', blotch: .7, gran: 1.1, tide: 0, x0, x1, feather: 6, mod: shade});
  L.mountain(wy, {dens: .3 * tone, fade: hgt * 1.0, fadeVar: .3, pow: .6, edge: .9, edgeW: 2.6, blotch: .6, tide: 0, x0, x1, feather: 5, rough: .8, mod: x => 1.7 - shade(x)});
  // the courses of the ramming: never ruled. Some are missing, each runs a different way out of true, and they come in runs with bare wall between
  for (let dy = C.R(8, 14); dy < hgt - 24; dy += C.R(8, 22)) { let x = x0 + C.R(6, 140); while (x < x1 - 20) { const len = C.R(30, 190), tilt = C.R(-.012, .012) * len; L.stroke([[x, wy(x) + dy, .5], [x + len * C.R(.3, .7), wy(x + len * .5) + dy + tilt * .5 + C.R(-1, 1), C.R(.7, 1.9)], [x + len, wy(x + len) + dy + tilt, .3]], {load: C.R(.2, .5) * tone * (1 - .5 * dy / hgt), dry: C.R(.2, .45), dry1: C.R(.7, .92), streak: .7, pool: 0}); x += len + (C.rnd() < .35 ? C.R(120, 320) : C.R(10, 70)) } }
  // under the rim the wall is darkest: a broad dry pull, broken
  { let x = x0 + C.R(0, 30); while (x < x1 - 30) { const len = Math.min(x1 - x - 4, C.R(80, 240)); L.stroke([[x, wy(x) + 9, 4], [x + len * .5, wy(x + len * .5) + 10, C.R(6, 10)], [x + len, wy(x + len) + 9, 3]], {load: C.R(.16, .3) * tone, dry: .2, dry1: .8, streak: .9, rag: .4, pool: 0}); x += len + C.R(10, 90) } }
  let x = x0 + C.R(10, 50);
  while (x < x1 - 20) { const l = C.R(.2, .72) * hgt, w = C.R(4, 12); L.stroke([[x, wy(x) + 3, w * .5], [x + C.R(-2, 5), wy(x) + l * .5, w], [x + C.R(-3, 8), wy(x) + l, w * .12]], {load: .3 * tone * C.R(.6, 1.2), load1: .1 * tone, dry: .15, dry1: .88, streak: .9, rag: .3, side: -.7}); x += C.R(22, 110) }
  x = x0 + 4;
  while (x < x1 - 10) { const len = C.R(60, 150), p = []; for (let u = 0; u <= len; u += 10) p.push([Math.min(x1, x + u), wy(x + u) + .5, 2 * (.5 + .8 * Math.sin(Math.PI * Math.min(1, u / len * 1.15 + .05)))]); L.stroke(p, {load: .8 * tone, dry: C.R(0, .15), dry1: C.R(.35, .6), streak: .5, rag: .2, pool: .15}); x += len + C.R(2, 14) }
  const end = (xe, dir) => { const t0 = top(xe);
    body(L, xx => t0 + Math.abs(xx - xe) / bat * hgt, Math.min(xe, xe + dir * bat), Math.max(xe, xe + dir * bat), base + 1);
    for (let i = 0; i < 4; i++) { const t = i / 4 + C.R(0, .1), yt = t0 + 4 + hgt * t, w = C.R(4, 8);
      for (const [pig, ld] of [['och', .3], ['ink', dir > 0 ? .34 : .18]]) L.stroke([[xe, yt, w * .6], [xe + dir * bat * (1 - t) * .5, (yt + base) / 2, w], [xe + dir * bat * (1 - t) * .96, base - 2, w * .3]], {pig, load: ld * tone, dry: .15, dry1: .8, streak: .9, rag: .3, side: -dir * .5}) }
    line(L, xe + dir * bat, base, xe, t0 + 1, dir > 0 ? 2.6 : 2, {load: (dir > 0 ? .95 : .75) * tone, w0: .5, w1: 1, bow: dir * .02}) };
  if (o.endL) end(x0, -1); if (o.endR) end(x1, 1);
  if (!o.noMist) for (x = x0; x < x1; x += C.R(170, 300)) cutMist(L, x + 60, base - 2, C.R(100, 170), C.R(8, 15), .85);
}
// thatch between a ridge (half-length a, at y0) and an eave (half-length b, at y1): pulled down the slope with the side
// of the brush, the right half darker; then the hips, the ridge and the eave in pressed lines
function roof(L, x, y0, y1, a, b, C, tone = 1, k = 1, mal = 0) {
  body(L, xx => { const u = Math.abs(xx - x); return u < a ? y0 : y0 + (y1 - y0) * (u - a) / (b * 1.04 - a) }, x - b * 1.04, x + b * 1.04, y1 + 1);
  if (mal) for (let i = 0; i < 4; i++) { const t = C.R(.1, .9), tx = x - a + 2 * a * t, bx = x - b + 2 * b * t; L.stroke([[tx, y0 + 3, 4 * k], [(tx + bx) / 2, (y0 + y1) / 2, 8 * k], [bx, y1 - 2, 3 * k]], {pig: 'mal', load: mal * C.R(.6, 1.1), dry: .2, dry1: .85, streak: .9, rag: .3, gran: 1.4}) }
  for (let i = 0, n = Math.max(5, Math.round(b / 7)); i < n; i++) { const t = (i + C.R(.1, .9)) / n, tx = x - a + 2 * a * t, bx = x - b + 2 * b * t, ww = C.R(3.5, 7.5) * k;
    L.stroke([[tx, y0 + 1, ww * .5], [(tx + bx) / 2 + C.R(-2, 2), (y0 + y1) / 2 + (y1 - y0) * .06, ww], [bx, y1 - 1, ww * .5]], {load: tone * C.R(.34, .62) * (t > .55 ? 1.3 : 1), load1: tone * .3, dry: C.R(.1, .25), dry1: C.R(.55, .85), side: t < .5 ? .5 : -.6, streak: .9, rag: .3, pool: .15}) }
  line(L, x - a, y0, x - b * 1.04, y1 + 1, 1.5 * k, {load: .8 * tone, bow: .04}); line(L, x + a, y0, x + b * 1.04, y1 + 1, 1.9 * k, {load: .95 * tone, bow: -.04});
  L.stroke([[x - a - 3, y0 + 1, .8 * k], [x, y0 - 1, 2.1 * k], [x + a + 3, y0 + 1, .9 * k]], {load: 1.0 * tone, dry: .05, dry1: .4, streak: .5, rag: .25});
  L.stroke([[x - b * 1.08, y1, .8 * k], [x - b * .3, y1 + 2.5, 2.2 * k], [x + b * .4, y1 + 2.5, 2.4 * k], [x + b * 1.08, y1, .8 * k]], {load: 1.0 * tone, dry: .08, dry1: .45, streak: .6, rag: .3});
}
// a hall or tower: posts, the dark under the eave, and a plain hipped roof of thatch; the great ones have two eaves
// (四阿重屋). No tiles, no upturned eaves: a thousand years early. x: middle; y: floor; w: half the eave; h: floor to ridge
function hall(L, x, y, w, h, C, o = {}) {
  const tone = o.tone ?? 1, posts = o.posts ?? 4, k = o.k ?? 1, two = o.two, ph = h * (two ? .3 : .44), ey = y - ph, ry = y - h;
  body(L, () => ey, x - w * .84, x + w * .84, y + 1);
  L.stroke([[x - w * .82, ey + ph * .36, ph * .2], [x, ey + ph * .38, ph * .3], [x + w * .82, ey + ph * .36, ph * .2]], {load: .5 * tone, dry: .1, dry1: .5, streak: .7, rag: .3, pool: .2});
  for (let i = 0; i < posts; i++) { const px = x - w * .8 + i * w * 1.6 / (posts - 1); line(L, px, y, px + C.R(-.8, .8), ey, 1.3 * k, {load: .92 * tone, w0: 1, w1: .85, dry1: .2}) }
  line(L, x - w * .92, y, x + w * .92, y + C.R(-1, 1), 1.2 * k, {load: .7 * tone, w0: .6, w1: .5});
  if (!two) return roof(L, x, ry, ey, w * .42, w, C, tone, k, o.mal);
  const s1 = ey - h * .2, s2 = s1 - h * .1;                                           // the skirt, a dark band, the upper roof
  roof(L, x, s1, ey, w * .7, w, C, tone, k, o.mal);
  L.stroke([[x - w * .62, (s1 + s2) / 2, h * .04], [x, (s1 + s2) / 2 + 1, h * .055], [x + w * .62, (s1 + s2) / 2, h * .04]], {load: .7 * tone, dry: .05, dry1: .4, streak: .6, rag: .25});
  roof(L, x, ry, s2, w * .34, w * .76, C, tone, k, o.mal);
}
// a Shang standard: a pole, an animal-mask plate, streamers stiff in the wind
function shangStd(L, x, y, h, C) {
  const k = h / 40;
  line(L, x, y, x + C.R(-1, 1), y - h, 1.1 * k, {load: .9, w0: 1, w1: .7, dry1: .2});
  L.stroke([[x - 4 * k, y - h - 2 * k, 2.6 * k], [x, y - h - 4 * k, 3.3 * k], [x + 4 * k, y - h - 2 * k, 2.6 * k]], {load: .95, pool: .1, rag: .2}); line(L, x - 5 * k, y - h - 6 * k, x - 7 * k, y - h - 11 * k, .7 * k, {load: .9}); line(L, x + 5 * k, y - h - 6 * k, x + 7 * k, y - h - 11 * k, .7 * k, {load: .9});
  for (let i = 0; i < 2; i++) L.stroke([[x, y - h + (3 + i * 5) * k, .9 * k], [x - C.R(8, 12) * k, y - h + (5 + i * 5) * k + C.R(-1, 2), 1.1 * k], [x - C.R(18, 26) * k, y - h + (9 + i * 6) * k, .2]], {load: .8, dry: .1, dry1: .6, streak: .5, pig: i ? 'ink' : 'mal'});
}
// smoke: wet pale pulls that rise, lean down wind and come apart
function smoke(L, x, y, h, C, load = .07) {
  for (let j = 0; j < 2; j++) { const p = [], a = C.R(.4, .7); for (let i = 0; i <= 6; i++) { const t = i / 6; p.push([x - h * a * t * t + C.R(-5, 5) + j * 6 * t, y - h * t * (1 - .1 * j), 1.5 + (8 + 6 * j) * t + C.R(0, 3)]) }
    L.stroke(p, {load: load * (1 - .3 * j), load1: load * .15, dry: .1, dry1: .75, streak: .7, rag: .6, soft: .6, bleed: .6, bleedR: 4, pool: 0}) }
}

const sheets = [];
const add = (name, paint) => { if (!ONLY || ONLY.includes(name)) sheets.push({name, ...LAYERS[name], paint}) };

/* ---------- 1. sky: bare paper by day (the clouds are things that move); at dusk, red light low over the city ---------- */
add('sky', L => {
  const w = widthOf(.04);
  for (const [fx, y, rx, ry] of [[.66, 640, 700, 60], [.86, 560, 460, 44], [.5, 720, 560, 40]]) { const x = fx * w;
    L.blot(x, y, rx, ry, {pig: 'och', dens: .14, rim: .05, soft: .95, rough: .6, freq: .003}); L.blot(x + rx * .1, y + ry * .2, rx * .7, ry * .4, {pig: 'rust', dens: .07, rim: .1, soft: .95, rough: .6, freq: .004, gran: .6}) }
});
[[900, 150, 61], [700, 130, 67], [1100, 170, 71], [620, 110, 73]].forEach(([w, h, sd], i) => PLACE.clouds.push({cell: 'cloud' + i, p: .06, u: Math.round(U0 + (i * .27 + .08) * (CAM1 - CAM0) * .06 * 4 + [-700, 300, -100, 760][i]), y: [300, 210, 420, 520][i], k: 1, a: [.9, .7, .8, .6][i]}));

/* ---------- 2. the furthest range: it slides only 510 px in the whole run, so it is one long level line (平远):
   shoulders, saddles and a few flat heads, never a cone; broken twice, where water or the plain meets the sky ---------- */
add('far', L => {
  const C = chance(4);
  const seg = (x0, x1, hgt, seed, dens, azu) => { const pts = []; let x = x0; while (x <= x1) { const t = (x - x0) / (x1 - x0), env = Math.sin(Math.PI * t) ** .6; pts.push([x, 792 - hgt * env * (.3 + 1.1 * fbm(x * .005 + seed, 2, 3) ** 1.4) - (C.rnd() < .25 ? C.R(10, 30) * env : 0)]); x += C.R(36, 96) }
    ghost(L, pts, {seed, dens, azu, och: .035, fade: hgt * 1.0, x0, x1, feather: 130, crag: 7, line: .14}) };
  seg(40, 1000, 150, 3.1, .07, .05); seg(800, 1520, 200, 5.7, .09, .09); seg(1040, 1380, 90, 6.4, .07, .05); seg(1700, 2260, 120, 8.2, .06, .05); seg(2180, 2680, 150, 9.9, .075, .06);
  let x = 1400; while (x < 2700) { const len = C.R(120, 320); drag(L, x, 794 + C.R(-3, 3), len, C.R(1, 1.8), C.R(.08, .14), C, {dry: .5, tilt: .2}); x += len + C.R(40, 200) }
  for (const [mx, my, rx, ry] of [[1150, 770, 360, 26], [500, 776, 400, 22], [1960, 782, 300, 18], [2420, 778, 220, 18], [1210, 716, 100, 9]]) cutMist(L, mx, my, rx, ry, .8);
});

/* ---------- 3. the middle distance (slides 1276 px, so whatever stands here is in sight for most of the road: it is
   kept low). Hills behind the camp, a far shore where the river goes out of sight, a long back of hill, a mesa ---------- */
add('mid', L => {
  const C = chance(41), low = (pts, f = .62) => pts.map(([px, py]) => [px, 800 - (800 - py) * f]);
  const rfs = [], R = (pts, o) => { const rf = rock(L, pts, {och: .08, body: .75, ...o}); rfs.push(rf); return rf };
  R(low([[150, 800], [230, 720], [300, 668], [352, 640], [400, 632], [430, 660], [470, 668], [520, 620], [560, 584], [600, 578], [622, 640], [690, 672], [730, 720], [800, 790]]), {seed: 2.4, foot: 786, tone: .44, fade: 120, x0: 130, x1: 830, lost: 'right', azu: .12, mal: .12, trees: 3, accent: .6, inner: [[566, 672, 70, .7]]});
  R([[900, 800], [960, 766], [1010, 742], [1060, 736], [1084, 760], [1150, 792]], {seed: 3.9, foot: 788, tone: .42, fade: 56, x0: 880, x1: 1170, k: .8, trees: 1, accent: .4});
  R(low([[1660, 830], [1720, 760], [1760, 680], [1790, 620], [1820, 590], [1850, 530], [1884, 508], [1918, 504], [1936, 570], [1980, 590], [2002, 550], [2040, 538], [2062, 600], [2110, 630], [2140, 614], [2180, 620], [2200, 690], [2260, 750], [2320, 820]].map(([px, py]) => [1180 + (px - 1660) * .5, py]), .4), {seed: 6.6, foot: 790, tone: .4, fade: 100, x0: 1165, x1: 1525, k: .9, azu: .14, mal: .12, trees: 3, fl: 60, fr: 80, inner: [[1300, 690, 60, .7]]});
  R([[2900, 810], [2980, 770], [3030, 730], [3060, 712], [3160, 706], [3210, 710], [3236, 748], [3290, 766], [3370, 796]], {seed: 11.2, foot: 788, tone: .42, fade: 100, x0: 2880, x1: 3400, k: 1, azu: .08, mal: .1, trees: 2, accent: .5, inner: [[3070, 722, 50, .6]]});
  for (const [r, x, n, h] of [[0, 330, 3, 20], [0, 585, 2, 22], [2, 1290, 3, 18], [2, 1400, 2, 16], [3, 3080, 3, 18]]) for (let i = 0; i < n; i++) { const xx = x + C.R(-30, 30); pineFar(L, xx, rfs[r](xx) + C.R(2, 6), h * C.R(.8, 1.2), C, .36) }
  for (const [mx, my, rx, ry, d] of [[480, 784, 380, 22, .9], [1030, 790, 180, 14, .8], [1340, 790, 240, 16, .9], [3140, 788, 320, 18, .85]]) cutMist(L, mx, my, rx, ry, d);
  let x = 1500; while (x < 1900) { const len = C.R(60, 150); drag(L, x, 798 + C.R(-3, 3), len, C.R(.9, 1.5), C.R(.1, .16), C, {dry: .5, tilt: .2}); x += len + C.R(30, 110) }     // the far shore
  x = 1980; while (x < 3460) { const len = C.R(80, 220); drag(L, x, 802 + C.R(-3, 3), len, C.R(.9, 1.6), C.R(.1, .16), C, {dry: .5, tilt: .2}); x += len + C.R(60, 200) }
});

/* ---------- 4. the near hills (slides 2340 px): wooded hills behind the camp, a bluff on the near bank, the far shore
   of the river with its sails, the foothills of the ridge with their pines, talus running out, and then the plain ---------- */
add('hills', L => {
  const C = chance(53);
  const R = (pts, o) => rock(L, pts, {och: .1, body: .95, ...o});
  const pines = (rf, list, load = .62) => { for (const [x, n, h] of list) for (let i = 0; i < n; i++) { const xx = x + C.R(-26, 26); pineFar(L, xx, rf(xx) + C.R(2, 7), h * C.R(.75, 1.25), C, load * C.R(.85, 1.15)) } };
  let rf = R([[240, 840], [330, 790], [410, 742], [470, 712], [516, 700], [540, 704], [560, 760], [620, 772], [690, 728], [740, 690], [772, 672], [800, 676], [822, 740], [890, 790], [980, 836]], {seed: 2.9, foot: 814, tone: .66, fade: 130, x0: 220, x1: 1010, lost: 'right', azu: .12, mal: .14, trees: 2, inner: [[760, 690, 70, .6]], crests: [[772, 1]]});
  pines(rf, [[440, 4, 26], [500, 2, 22], [720, 3, 28], [790, 2, 22]]);
  rf = R([[1090, 840], [1150, 806], [1200, 770], [1250, 744], [1290, 738], [1316, 742], [1330, 790], [1362, 812], [1400, 838]], {seed: 5.1, foot: 826, tone: .7, fade: 90, x0: 1070, x1: 1420, k: .9, mal: .14, trees: 1});
  pines(rf, [[1262, 3, 26], [1210, 2, 20]]);
  // the far shore: low, with far trees, and sails
  let x = 1420; while (x < 2140) { const len = C.R(70, 190); drag(L, x, 822 + C.R(-3, 3), len, C.R(1.2, 2.2), C.R(.16, .26), C, {dry: .45, tilt: .2}); if (C.rnd() < .6) for (let i = 0, n = 3 + Math.floor(C.R(0, 6)), tx = x + C.R(0, len); i < n; i++) { const xx = tx + C.R(-24, 24), h = C.R(5, 12); L.stroke([[xx, 822, .5], [xx + C.R(-1, 1), 822 - h * .6, C.R(1.3, 2.4)], [xx + C.R(-1.5, .5), 822 - h, .3]], {load: C.R(.3, .5), streak: .3, pool: .2, dry1: .3}) } x += len + C.R(30, 130) }
  for (const [sx, k] of [[1640, 1], [1700, .7], [1930, .8]]) { line(L, sx, 826, sx + 1, 826 - 24 * k, .7, {load: .5, w0: 1}); L.stroke([[sx + 1, 826 - 23 * k, .6], [sx - 5 * k, 826 - 13 * k, 3.4 * k], [sx - 2 * k, 826 - 4 * k, 1]], {load: .32, dry: .2, dry1: .6, streak: .7, rag: .3}); drag(L, sx - 12 * k, 827, 24 * k, 1.3, .45, C, {dry: .2, tilt: 0}) }
  // foothills of the ridge
  rf = R([[2000, 850], [2060, 800], [2106, 742], [2140, 690], [2170, 650], [2200, 636], [2230, 640], [2246, 700], [2280, 716], [2306, 680], [2340, 632], [2366, 620], [2390, 626], [2406, 700], [2430, 760], [2460, 846]], {seed: 7.7, foot: 822, tone: .74, fade: 180, x0: 1970, x1: 2490, fr: 40, k: 1.1, azu: .16, mal: .18, trees: 2, inner: [[2206, 650, 110, .7], [2370, 634, 110, .7]]});
  pines(rf, [[2180, 3, 30], [2290, 2, 24], [2360, 3, 30], [2090, 2, 24]], .68);
  x = 2520; while (x < 4500) { const len = C.R(90, 260); drag(L, x, 838 + C.R(-3, 3), len, C.R(1.1, 2), C.R(.14, .24), C, {dry: .5, tilt: .2}); x += len + C.R(80, 300) }
  for (const [mx, my, rx, ry, d] of [[600, 814, 400, 26, .9], [1250, 828, 200, 16, .8], [2270, 812, 380, 34, .92], [2210, 716, 110, 12, .5], [2370, 690, 90, 10, .45]]) cutMist(L, mx, my, rx, ry, d);
});

/* ---------- 5. the places themselves (slides 3829 px; a place stands 800 from the next). Low, empty, TALL, empty,
   TALL: camp and banners, open water, the ridge, the open plain, the city. Each tall thing keeps its own paper, so
   it hides what is behind it. Everything stands on y = 784 or a little above, 200 over the heads of the battle. ---------- */
add('set', L => {
  const C = chance(67), [c1, c2, c3, c4, c5] = PL.map(cam => X('set', cam)), B = 784;
  const R = (c, pts, o) => rock(L, sh(pts, c), {body: 1, ...o, x0: o.x0 + c, x1: o.x1 + c, inner: (o.inner || []).map(([x, ...r]) => [x + c, ...r]), crests: (o.crests || []).map(([x, b]) => [x + c, b])});
  let x, rf;

  /* 1. the camp. Host: the commander's tent under three standards. Guests: tents in two rows, a chariot at each end,
     a rack of dagger-axes, the smoke of two fires. */
  for (const [tx, k] of [[-330, .6], [-216, .56], [130, .6], [236, .54]]) tent(L, c1 + tx, B - 12, k, C, .62);
  smoke(L, c1 - 250, B - 44, 230, C, .045); smoke(L, c1 + 250, B - 40, 170, C, .04);
  rack(L, c1 - 458, B + 1, 1.4, C); chariot(L, c1 - 372, B + 3, 1.5, C);
  tent(L, c1 - 262, B + 4, 1.2, C, 1.05);
  greatTent(L, c1 - 40, B + 4, 1.55, C);
  standard(L, c1 - 190, B + 4, 250, C, {cloth: 'flagB', k: 1.25}); standard(L, c1 + 44, B + 5, 320, C, {cloth: 'flagA', k: 1.4}); standard(L, c1 + 116, B + 3, 214, C, {cloth: 'flagC', k: 1.15});
  tent(L, c1 + 212, B + 3, 1.15, C, 1); tent(L, c1 + 318, B + 1, .86, C, .9);
  x = c1 - 520; while (x < c1 + 420) { const len = C.R(80, 220); drag(L, x, B + 8 + C.R(0, 30), len, C.R(.9, 1.6), C.R(.1, .18), C, {dry: .55, tilt: .15}); x += len + C.R(60, 200) }

  /* 2. the crossing. Host: the ferry, full of men, one red pennant, and its image in the water. Guests: a moored boat
     by a sandbar and its reeds, a far boat, the far shore. The water is the paper. */
  // the far shore: one dark level line with its trees, right across; under it the water takes a thin tone that is lifted in streaks
  x = c2 - 470; while (x < c2 + 330) { const len = C.R(110, 300); drag(L, x, 768 + C.R(-2, 2), len, C.R(2.4, 4), C.R(.55, .75), C, {dry: .12, tilt: .2}); drag(L, x + C.R(10, 60), 770 + C.R(-1, 2), len * C.R(.5, .9), C.R(1.6, 3), C.R(.4, .6), C, {dry: .2, tilt: .2}); drag(L, x + C.R(0, 40), 764 + C.R(-2, 1), len * C.R(.4, .8), C.R(1.2, 2.4), C.R(.2, .3), C, {dry: .5, tilt: .2});
    for (let i = 0, n = 4 + Math.floor(C.R(0, 8)), tx = x + C.R(0, len); i < n; i++) { const xx = tx + C.R(-40, 40), h = C.R(7, 19); L.stroke([[xx, 768, .5], [xx + C.R(-1, 1), 768 - h * .6, C.R(1.6, 3.2)], [xx + C.R(-2, .5), 768 - h, .3]], {load: C.R(.45, .75), streak: .3, pool: .2, dry1: .3}) }
    x += len + C.R(6, 50) }
  L.mountain(() => 772, {dens: .075, fade: 70, fadeVar: .5, pow: 1.2, edge: .3, edgeW: 3, pig: 'azu', blotch: .6, gran: .9, tide: 0, x0: c2 - 560, x1: c2 + 420, feather: 140, rough: 1.5});
  L.mountain(() => 771, {dens: .13, fade: 60, fadeVar: .6, pow: 1.3, edge: .4, edgeW: 2, blotch: .5, tide: 0, x0: c2 - 560, x1: c2 + 420, feather: 120, rough: 1.5});
  for (let i = 0; i < 26; i++) { const yy = 776 + C.R(0, 44), xx = c2 + C.R(-540, 380), len = C.R(40, 200); L.stroke([[xx, yy, .5], [xx + len * .5, yy + C.R(-1, 1), C.R(1.2, 2.6)], [xx + len, yy + C.R(-1, 1), .4]], {pig: 'lift', load: C.R(.5, 1), dry: .2, dry1: .7, streak: .6, pool: 0}) }
  for (const [sx, sw, sy] of [[-500, 200, 797], [-326, 116, 806]]) { drag(L, c2 + sx, sy + C.R(-2, 2), sw, 2.8, .4, C, {dry: .35}); drag(L, c2 + sx + 20, sy + 5, sw * .7, 1.6, .22, C, {dry: .5}); L.blot(c2 + sx + sw / 2, sy - 1, sw * .5, 6, {pig: 'och', dens: .16, rim: .2, soft: .6}); for (let i = 0; i < sw / 11; i++) reed(L, c2 + sx + C.R(6, sw - 6), sy, C.R(18, 46), C, {load: .8}) }
  boat(L, c2 - 340, 794, 124, C, {roof: true});
  boat(L, c2 + 40, 798, 250, C, {men: 9, flag: true}); boat(L, c2 + 262, 778, 64, C, {roof: true});
  for (let i = 0; i < 90; i++) { const t = C.rnd() ** 1.4, yy = 786 + 160 * t, xx = c2 + C.R(-640, 520), len = C.R(40, 170) * (1 + t); drag(L, xx, yy, len, C.R(.8, 1.8), C.R(.16, .3) * (1 - .6 * t), C, {dry: .45, tilt: .1}) }
  for (let i = 0; i < 14; i++) drag(L, c2 + 40 + C.R(-190, 150), 804 + C.R(0, 40), C.R(30, 110), C.R(1.2, 2.4), C.R(.2, .34), C, {dry: .35, tilt: .1});
  PLACE.water.push({layer: 'set', x0: c2 - 600, x1: c2 + 520, y0: 786, y1: 950});

  /* 3. the pine ridge. Host: the tower of rock with azurite on its crown, and the fall that drops from the notch on its
     right into the mist. Guests: a lower block on its left across a cleft, a buttress on its right, pines on every
     ledge, each its own tree; a spur that runs down into the river on the left (so the water ends in rock, not in a
     fade); a spire and talus on the right that thin out into the plain. Blocks and cliffs, not a cone. */
  rf = R(c3, [[-610, 782], [-566, 752], [-524, 716], [-484, 690], [-452, 684], [-432, 712], [-402, 720], [-374, 760], [-340, 784]], {seed: 12.1, foot: 778, tone: .85, fade: 90, x0: -630, x1: -320, k: 1, och: .14, mal: .2, azu: .1, fl: 40, fr: 30, inner: [[-460, 690, 60, .6]]});
  pine(L, c3 - 500, rf(c3 - 500) + 3, 104, C, {load: .88, lean: -.6, thick: 1.2}); pine(L, c3 - 420, rf(c3 - 420) + 3, 52, C, {load: .8});
  reflect(L, c3 - 600, c3 - 350, 782, 54, .24, C, 5);
  const MASS = [[-330, 792], [-306, 706], [-280, 640], [-262, 560], [-250, 524], [-212, 510], [-172, 518], [-160, 560], [-152, 604], [-130, 606], [-116, 520], [-104, 440], [-88, 372], [-62, 330], [-22, 306], [18, 300], [40, 314], [48, 372], [52, 424], [70, 438], [80, 500], [86, 548], [100, 566], [120, 548], [128, 504], [160, 470], [200, 476], [214, 520], [220, 562], [246, 586], [258, 640], [264, 684], [300, 722], [326, 770], [344, 794]];
  rf = R(c3, MASS, {seed: 14.6, foot: 776, tone: 1.15, fade: 350, x0: -370, x1: 372, k: 1.5, och: .19, azu: .3, mal: .32, trees: 0, crests: [[0, 1.5], [170, 1.1], [-212, .9]], inner: [[-250, 530, 180, .8], [-100, 460, 220, .85], [44, 330, 230, .8], [60, 440, 200, .7], [214, 490, 190, .8], [-170, 530, 110, .6], [262, 650, 100, .6]], fl: 100, fr: 26});
  // the fall: paper kept for the water, a dark wet edge beside it so that it shines, a step half way, spray at the foot
  const fx = c3 + 100, fall = [[fx - 2, 566, 6], [fx + 3, 624, 8], [fx - 1, 672, 9], [fx + 6, 724, 13], [fx + 4, 772, 19]];
  L.stroke(fall.map(([px, py, w]) => [px + w + 8, py, w * 1.1]), {load: .8, dry: .05, dry1: .5, streak: .8, rag: .4, side: -.6, pool: .2});
  L.stroke(fall.map(([px, py, w]) => [px - w - 6, py + 4, w * .8]), {load: .55, dry: .2, dry1: .7, streak: .8, rag: .4});
  L.stroke(fall, {pig: 'lift', load: 1.6, dry: 0, streak: .1, rag: .35, soft: .3, pool: 0});
  for (let i = 0; i < 5; i++) { const dx = C.R(-4, 4); L.stroke(fall.slice(i % 2, 4 + i % 2).map(([px, py, w]) => [px + dx * w / 6, py + C.R(-8, 8), .7]), {load: C.R(.12, .22), dry: .4, dry1: .9, streak: .8, pool: 0}) }
  L.stroke([[fx - 10, 668, 1], [fx, 672, 3.6], [fx + 11, 669, 1]], {load: .6, dry: .1, dry1: .5, rag: .3});
  PLACE.falls.push({layer: 'set', x: fx + 2, y0: 570, y1: 772, w: 16});
  for (const [px, h, o] of [[-300, 88, {}], [-240, 70, {}], [-196, 96, {lean: -.4}], [-140, 62, {lean: -.55}], [-30, 66, {}], [22, 52, {}], [62, 86, {lean: .16}], [150, 80, {}], [196, 70, {lean: -.3}], [252, 104, {thick: 1.15}], [300, 124, {thick: 1.25, load: .95}]]) pine(L, c3 + px, rf(c3 + px) + 5, h, C, {load: .86, ...o});
  cutMist(L, c3 - 190, 694, 150, 16, .7); cutMist(L, c3 - 170, 786, 220, 26, .95); cutMist(L, c3 + 230, 776, 170, 16, .9); cutMist(L, c3 + 214, 650, 60, 8, .45); cutMist(L, fx + 6, 776, 80, 18, .95);
  // at its foot, in front of the mist: low rock and three pines, darker than anything on the mass
  for (const [bx, k, sd] of [[-90, 1.1, 5], [40, .7, 6], [176, .9, 7]]) { const q = R(c3 + bx, [[-60, 796], [-40, 770], [-14, 752], [18, 756], [30, 776], [62, 796]].map(([px, py]) => [px * k, 796 + (py - 796) * k]), {seed: 30 + sd, foot: 800, tone: 1.3, fade: 50 * k, x0: -70 * k, x1: 70 * k, k: .8 * k, och: .16, fl: 20, fr: 24, inner: [[-12 * k, 754 + 44 * (1 - k), 30 * k, 1], [20 * k, 760 + 40 * (1 - k), 22 * k, .8]]}); if (sd !== 6) pine(L, c3 + bx - 8 * k, q(c3 + bx - 8 * k) + 4, sd === 5 ? 112 : 84, C, {load: 1, thick: 1.2, lean: sd === 5 ? -.2 : .1}) }
  R(c3, [[400, 792], [412, 700], [424, 628], [436, 600], [446, 630], [452, 720], [468, 792]], {seed: 16.3, foot: 786, tone: .7, fade: 160, x0: 386, x1: 482, k: .8, och: .12, azu: .14, fl: 14, fr: 14, inner: [[438, 610, 100, .6]]});
  for (const [bx, k, sd, tree] of [[540, 1, 1, 0], [650, .6, 2, 1]]) { const q = R(c3 + bx, [[-56, 792], [-36, 760], [-12, 742], [16, 746], [28, 770], [58, 792]].map(([px, py]) => [px * k, 792 + (py - 792) * k]), {seed: 20 + sd, foot: 790, tone: .85, fade: 40 * k, x0: -66 * k, x1: 66 * k, k: .7 * k, och: .12, fl: 20, fr: 24, accent: .6}); if (tree) bare(L, c3 + bx + 20, q(c3 + bx + 20) + 4, 70, C, {load: .7, depth: 2}) }

  /* 4. the plain. Host: one old tree. Guests: two small trees far off, and on the horizon the host of Shang drawn up,
     spears and standards as small as grass, dust over them. The rest is left to the sky. */
  x = c4 - 420; while (x < c4 + 640) { const len = C.R(120, 340); drag(L, x, 790 + C.R(-3, 3), len, C.R(1.1, 2.1), C.R(.18, .3), C, {dry: .45, tilt: .2}); x += len + C.R(60, 280) }
  for (let i = 0; i < 14; i++) { const yy = 806 + 110 * C.rnd() ** 1.5; drag(L, c4 + C.R(-460, 640), yy, C.R(80, 260), C.R(.8, 1.4), C.R(.07, .12), C, {dry: .6, tilt: .15}) }
  bare(L, c4 + 96, 792, 262, C, {load: .95, depth: 4, lean: -.14});
  L.stroke([[c4 + 40, 795, 1], [c4 + 92, 784, 7], [c4 + 150, 795, 1]], {load: .55, dry: .2, dry1: .7, streak: .7, rag: .4}); for (let i = 0; i < 11; i++) leaf(L, c4 + 96 + C.R(-70, 80), 795, C.R(10, 26), C.R(-.7, .2), C, {load: .55, w: .6});
  bare(L, c4 - 226, 790, 66, C, {load: .55, depth: 3}); bare(L, c4 + 262, 789, 84, C, {load: .6, depth: 3, lean: -.3});
  for (const [hx, n] of [[340, 44], [468, 60], [596, 36]]) { L.blot(c4 + hx + 30, 744, 110, 30, {dens: .06, rim: 0, soft: .9, rough: .5}); drag(L, c4 + hx - 60, 792, 120, 2.6, .5, C, {dry: .2});
    for (let i = 0; i < n; i++) { const xx = c4 + hx + C.gauss() * 44, h = C.R(16, 30); line(L, xx, 791, xx + C.R(-1.5, 1.5), 791 - h, .7, {load: C.R(.5, .85), w0: 1, w1: .7}); if (C.rnd() < .5) L.stroke([[xx, 791, 1.2], [xx + C.R(-.5, .5), 786, 1.9], [xx, 780, .8]], {load: C.R(.5, .8), pool: .1}) } }
  shangStd(L, c4 + 386, 790, 50, C); shangStd(L, c4 + 500, 790, 58, C); shangStd(L, c4 + 604, 790, 44, C);
  PLACE.birds.push({layer: 'mid', x: X('mid', PL[3], 500), y: 470, n: 9});

  /* 5. the city. Host: the gate under its tower. Behind the wall, the terrace of the palace with its hall. Guests: a
     watch tower out on the plain, dead trees, standards along the wall, smoke. Dark, and the last thing on the road. */
  const wx = c5 - 336; for (const dx of [-17, 0, 17]) line(L, wx + dx * 1.25, 794, wx + dx, 664, 1.5, {load: .85, w0: 1, w1: .8}); line(L, wx - 20, 760, wx + 18, 706, 1, {load: .65}); line(L, wx + 20, 760, wx - 18, 706, 1, {load: .65});
  hall(L, wx, 664, 38, 62, C, {posts: 3}); shangStd(L, wx + 12, 604, 44, C); drag(L, wx - 70, 795, 150, 1.8, .36, C);
  bare(L, c5 - 236, 793, 124, C, {load: .85, depth: 3, lean: -.3}); bare(L, c5 - 180, 791, 70, C, {load: .65, depth: 2});
  const tx = c5 + 670; let ty = 616;
  for (const [w, h] of [[250, 66], [178, 60], [120, 54]]) { const y0 = ty, y1 = ty - h; wall(L, C, tx - w, tx + w, y0, () => y1, {tone: .85, endL: true, endR: true, noMist: true}); ty = y1 }
  hall(L, tx, ty, 112, 138, C, {posts: 6, mal: .4, k: 1.4, two: true}); shangStd(L, tx - 98, ty, 54, C); shangStd(L, tx + 100, ty, 46, C);
  smoke(L, c5 + 430, 600, 300, C, .04); smoke(L, c5 + 930, 606, 240, C, .035);
  const top = xx => 610 + (xx - c5) * .004;
  wall(L, C, c5 - 124, c5 + 1340, 796, top, {endL: true});
  hall(L, c5 - 80, top(c5 - 80), 44, 64, C, {posts: 3});
  const gx = c5 + 190, gt = top(gx) - 14;
  wall(L, C, gx - 124, gx + 124, 797, () => gt, {tone: 1.3, endL: true, endR: true, noMist: true});
  for (let i = 0; i < 7; i++) { const yy = 692 + i * 15; L.stroke([[gx - 37, yy + C.R(-1, 1), 8], [gx + C.R(-6, 6), yy, 13], [gx + 37, yy + C.R(-1, 1), 8]], {load: 1.3, dry: 0, dry1: .12, streak: .3, rag: .2, pool: .15}) }   // the gate's dark
  line(L, gx - 43, 797, gx - 42, 676, 2.8, {load: 1, w0: 1, w1: 1}); line(L, gx + 43, 797, gx + 42, 676, 3, {load: 1, w0: 1, w1: 1}); line(L, gx - 56, 676, gx + 56, 675, 3.4, {load: 1, w0: .8, w1: .8}); line(L, gx - 50, 661, gx + 50, 660, 1.6, {load: .9, w0: .8, w1: .8});
  hall(L, gx, gt, 124, 160, C, {posts: 6, k: 1.5, mal: .26, two: true});
  hall(L, gx + 430, top(gx + 430), 52, 72, C, {posts: 3, tone: .9});
  for (const sx of [-250, 250, 560, 700, 880, 1040]) shangStd(L, gx + sx, top(gx + sx), C.R(40, 60), C);
  shangStd(L, gx - 96, gt, 56, C); shangStd(L, gx + 100, gt, 50, C);
  cutMist(L, c5 + 1260, 700, 200, 120, .75);
  x = c5 - 600; while (x < c5 + 1300) { const len = C.R(100, 300); drag(L, x, 806 + C.R(0, 80), len, C.R(.8, 1.5), C.R(.07, .13), C, {dry: .6, tilt: .12}); x += len * C.R(.5, 1) + C.R(40, 200) }
  PLACE.sun = {layer: 'sky', x: X('sky', PL[1], 250), y: 640};
});

/* ---------- 6. the ground the battle is fought on. Never a ruled line and never a wash: dry strokes with gaps. Each
   place has its own ground: trodden earth, the shallows of the ford, stone, dry grass, the ruts of the road. ---------- */
add('ground', L => {
  const C = chance(9), w = widthOf(1), xw = u => u - U0 + CAM0;                     // sheet u -> world x
  const zone = x => x < 1020 ? 'camp' : x < 1880 ? 'ford' : x < 2900 ? 'rock' : x < 3880 ? 'plain' : 'road';
  let u = -40;
  while (u < w) {
    const z = zone(xw(u)); let len = C.R(110, 290), gy = GY + C.R(1, 10), gap = C.rnd() < .3 ? C.R(120, 260) : C.R(20, 110);
    if (z === 'ford') {                                                                // water: thin level lines, a pebble bar now and then
      len = C.R(90, 260); drag(L, u, gy, len, C.R(1.4, 2.6), C.R(.24, .36), C, {dry: .5, tilt: .15});
      for (let i = 0, n = 1 + Math.floor(C.R(0, 3)); i < n; i++) drag(L, u + C.R(-40, len), GY + C.R(14, 90), C.R(40, 170), C.R(.8, 1.5), C.R(.1, .2), C, {dry: .55, tilt: .1});
      if (C.rnd() < .4) for (let i = 0, n = 3 + Math.floor(C.R(0, 5)), px = u + C.R(0, len); i < n; i++) L.blot(px + C.R(-30, 30), GY + C.R(6, 20), C.R(2, 5), C.R(1.2, 2.6), {dens: C.R(.2, .4), rim: .5, soft: .3, rough: .25});
      gap = C.R(30, 150);
    } else if (z === 'rock') {                                                         // stone: short pulls, and chips cut with the side of the brush
      len = C.R(60, 190); drag(L, u, gy, len, C.R(3.4, 5.6), C.R(.38, .52), C);
      if (C.rnd() < .6) for (let i = 0, n = 2 + Math.floor(C.R(0, 3)), px = u + C.R(0, len); i < n; i++) { const l = C.R(8, 22), ww = C.R(3, 7), sx = px + i * C.R(8, 16); L.stroke([[sx, GY + C.R(2, 8), ww * .5], [sx + l * .3, GY + 8 + l * .4, ww], [sx + l * .5, GY + 8 + l, ww * .15]], {load: C.R(.2, .36), dry: .15, dry1: .85, side: -.7, streak: .9, rag: .3}) }
      if (C.rnd() < .5) drag(L, u + len * C.R(.1, .5), gy + C.R(5, 9), len * C.R(.4, .8), C.R(1.8, 3), C.R(.26, .38), C, {dry: .5});
      gap = C.rnd() < .25 ? C.R(100, 220) : C.R(14, 70);
    } else if (z === 'road') {                                                         // ruts: long pulls that keep their level, two or three abreast
      len = C.R(200, 420); drag(L, u, GY + 4 + C.R(-1, 1), len, C.R(3, 4.6), C.R(.36, .5), C, {tilt: .3});
      if (C.rnd() < .8) drag(L, u + C.R(20, 90), GY + 18 + C.R(-2, 2), len * C.R(.6, 1), C.R(1.8, 2.8), C.R(.24, .34), C, {dry: .5, tilt: .3});
      if (C.rnd() < .5) drag(L, u + C.R(40, 160), GY + 40 + C.R(-3, 3), len * C.R(.5, .9), C.R(1.4, 2.4), C.R(.16, .26), C, {dry: .55, tilt: .3});
      gap = C.R(20, 120);
    } else {                                                                           // earth and grass
      const thin = z === 'plain';
      drag(L, u, gy, len, C.R(3.4, 5.4) * (thin ? .8 : 1), C.R(.36, .5), C);
      if (C.rnd() < .75) drag(L, u + len * C.R(.1, .5), gy + C.R(5, 9), len * C.R(.4, .8), C.R(1.8, 3), C.R(.26, .38), C, {dry: .5});
      if (C.rnd() < .5) drag(L, u + len * C.R(.3, .8), gy - C.R(3, 6), len * C.R(.3, .6), C.R(1.2, 2.2), C.R(.26, .4), C, {dry: .5});
      if (C.rnd() < .35) for (let i = 0, n = 1 + Math.floor(C.R(0, 3)); i < n; i++) L.blot(u + C.R(0, len), GY + C.R(12, 24), C.R(1.2, 2.8), C.R(.8, 1.6), {dens: C.R(.26, .42), rim: .4, soft: .3, rough: .2});
      if (thin) gap *= 1.5;
    }
    u += len + gap;
  }
  u = C.R(100, 400);
  while (u < w) { const len = C.R(160, 340); drag(L, u, C.R(1050, 1130), len, C.R(2.2, 3.4), C.R(.16, .27), C, {dry: .56}); u += len + C.R(260, 640) }
  // behind the line, further up the sheet: the same ground going away, paler and thinner
  u = 0; while (u < w) { const len = C.R(90, 260); drag(L, u, C.R(946, 986), len, C.R(.9, 1.7), C.R(.08, .15), C, {dry: .58, tilt: .15}); u += len + C.R(120, 420) }
  // what grows on the line and moves in the wind: placed here, drawn at run time
  u = 60; while (u < w - 60) { const z = zone(xw(u)); if (z !== 'road' || C.rnd() < .4) PLACE.tufts.push({x: Math.round(xw(u)), y: Math.round(GY + C.R(2, 9)), cell: z === 'ford' ? 'reedS' + Math.floor(C.R(0, 3)) : 'tuft' + Math.floor(C.R(0, 5)), k: +C.R(.7, 1.25).toFixed(2), flip: C.rnd() < .3 ? -1 : 1, ph: +C.R(0, 6).toFixed(2)}); u += z === 'plain' ? C.R(70, 260) : z === 'ford' ? C.R(90, 320) : C.R(160, 520) }
});

/* ---------- things that move, each painted once on its own small sheet ---------- */
// name -> {w, h, px, py (the pivot inside the sheet), s, kind: 'ink' | 'mist' | 'col', paint(L, C)}
const SPR = {};
const spr = (name, kind, w, h, px, py, s, paint) => { SPR[name] = {kind, w, h, px, py, s, paint} };
// in front of everything, in the wettest, darkest ink; never more than 200 above the bottom of the view
const frontRock = (L, C, pts, seed) => { const rf0 = ridgeOf(pts, seed, 6), a = pts[0][0] - 10, b = pts[pts.length - 1][0] + 10;
  L.mountain(rf0, {dens: 1.1, fade: 230, fadeVar: .3, pow: .5, edge: .3, blotch: .5, tide: 0, x0: a, x1: b, gran: .9, feather: 24, seed});
  return rock(L, pts, {seed, foot: 90, tone: 2.3, fade: 200, x0: a, x1: b, k: 1.5, fl: 24, fr: 24, crag: 6}) };
// front sprites share a frame: x from -260..260, the base of the view at y = 0, tops no higher than -200; the sheet runs 80 below
// each belongs to the place it is first seen at, and is packed with that place's things, so a place can be loaded by itself
const FRP = {fStakes: 1, fGrassB: 1, fReedsA: 2, fStonesB: 2, fReedsB: 2, fRockPine: 3, fStonesA: 3, fGrassC: 3, fGrassA: 4, fDead: 4, fAbatis: 5, fRockB: 5};
const FR = (name, w, paint) => spr(name, 'f' + FRP[name], w, 300, w / 2, 220, 1, paint);
FR('fStakes', 420, (L, C) => { for (let i = 0; i < 7; i++) { const x = -150 + i * 46 + C.R(-8, 8), d = i % 2 ? 1 : -1, h = C.R(110, 170); L.stroke([[x - d * 26, 60, 5], [x, -h * .4, 4], [x + d * C.R(20, 40), -h, .6]], {load: 1.15, dry: .05, dry1: .5, streak: .6, rag: .2, side: .6}) }
  L.stroke([[-190, -48, 3], [0, -62, 4.2], [190, -40, 2.4]], {load: 1.1, dry: .1, dry1: .5, streak: .6}); for (let i = 0; i < 8; i++) leaf(L, C.R(-190, 190), 30, C.R(50, 110), C.R(-.5, .1), C, {load: 1.1, w: 1.4}) });
FR('fGrassA', 460, (L, C) => { for (const [gx, n, h] of [[-130, 6, 150], [-40, 6, 180], [60, 5, 120], [150, 3, 80]]) for (let i = 0; i < n; i++) leaf(L, gx + C.R(-18, 18), 40 + C.R(0, 14), h * C.R(.5, 1.05), C.R(-.6, .2), C, {load: 1.12, w: 1.5}) });
FR('fGrassB', 380, (L, C) => { for (const [gx, n, h] of [[-90, 5, 120], [0, 4, 160], [80, 4, 100]]) for (let i = 0; i < n; i++) leaf(L, gx + C.R(-16, 16), 40 + C.R(0, 14), h * C.R(.5, 1.05), C.R(-.65, .15), C, {load: 1.1, w: 1.4}); for (let i = 0; i < 5; i++) reed(L, C.R(-120, 120), 40, C.R(120, 200), C, {load: 1.1}) });
FR('fGrassC', 300, (L, C) => { for (const [gx, n, h] of [[-50, 4, 100], [30, 4, 140]]) for (let i = 0; i < n; i++) leaf(L, gx + C.R(-16, 16), 40 + C.R(0, 14), h * C.R(.5, 1.05), C.R(-.6, .2), C, {load: 1.08, w: 1.3}) });
FR('fReedsA', 480, (L, C) => { for (let i = 0; i < 14; i++) reed(L, C.R(-200, 200), 50, C.R(110, 215), C, {load: 1.15}); for (let i = 0; i < 12; i++) leaf(L, C.R(-200, 200), 50, C.R(60, 150), C.R(-.6, .15), C, {load: 1.1, w: 1.5}) });
FR('fReedsB', 360, (L, C) => { for (let i = 0; i < 9; i++) reed(L, C.R(-140, 140), 50, C.R(90, 190), C, {load: 1.1}); for (let i = 0; i < 8; i++) leaf(L, C.R(-140, 140), 50, C.R(50, 120), C.R(-.6, .15), C, {load: 1.1, w: 1.4}) });
FR('fStonesA', 520, (L, C) => { frontRock(L, C, [[-230, 60], [-180, -40], [-120, -86], [-70, -92], [-40, -50], [20, -30], [80, -64], [130, -58], [170, -10], [230, 60]], 3.1) });
FR('fStonesB', 400, (L, C) => { frontRock(L, C, [[-170, 70], [-110, -20], [-60, -70], [-10, -76], [30, -30], [90, -10], [170, 70]], 5.4) });
FR('fRockPine', 560, (L, C) => { const rf = frontRock(L, C, [[-250, 70], [-190, -30], [-150, -110], [-90, -150], [-40, -156], [-10, -100], [50, -70], [110, -96], [150, -90], [190, -20], [250, 70]], 7.9); pine(L, 120, rf(120) + 6, 96, C, {load: 1.15, lean: -.5, thick: 1.5, tiers: 4}) });
FR('fRockB', 440, (L, C) => { frontRock(L, C, [[-190, 70], [-150, -60], [-100, -150], [-50, -176], [-20, -170], [0, -90], [60, -60], [120, -80], [190, 70]], 9.2) });
FR('fAbatis', 440, (L, C) => { for (let i = 0; i < 6; i++) { const x = -160 + i * 60 + C.R(-10, 10), h = C.R(100, 180); L.stroke([[x + 40, 60, 5], [x + 10, -h * .4, 4.2], [x - C.R(30, 60), -h, .6]], {load: 1.15, dry: .05, dry1: .5, streak: .6, rag: .2, side: .6}) } for (let i = 0; i < 3; i++) L.stroke([[C.R(-180, 0), C.R(-20, 30), 3], [C.R(-40, 60), C.R(-70, -30), 3.4], [C.R(100, 190), C.R(-30, 20), 1]], {load: 1.1, dry: .1, dry1: .6, streak: .6}) });
FR('fDead', 420, (L, C) => { frontRock(L, C, [[-170, 70], [-110, 0], [-50, -40], [10, -44], [60, -10], [170, 70]], 11.4); bare(L, -20, -38, 150, C, {load: 1.15, depth: 3, lean: -.7}) });
// on the ground line, pale: tufts of grass and short reeds
for (let i = 0; i < 5; i++) spr('tuft' + i, 'ink', 80, 56, 40, 50, 1.5, (L, C) => { for (let j = 0, n = 3 + Math.floor(C.R(0, 4)); j < n; j++) leaf(L, C.R(-10, 10), 0, C.R(12, 34), C.R(-.7, .25), C, {load: .5, w: .55}) });
for (let i = 0; i < 3; i++) spr('reedS' + i, 'ink', 90, 86, 50, 80, 1.5, (L, C) => { for (let j = 0, n = 2 + Math.floor(C.R(0, 3)); j < n; j++) reed(L, C.R(-12, 12), 0, C.R(30, 66), C, {load: .5}); for (let j = 0; j < 3; j++) leaf(L, C.R(-12, 12), 0, C.R(14, 30), C.R(-.6, .2), C, {load: .45, w: .5}) });
// clouds: a few wet stains run together, their upper edge lobed, the under side lifted away; pale
[[900, 150, 61], [700, 130, 67], [1100, 170, 71], [620, 110, 73]].forEach(([w, h, sd], i) => spr('cloud' + i, 'ink', w, h, w / 2, h / 2, .25, (L, C) => { L.seed = sd;
  for (let j = 0, n = 5 + i % 3; j < n; j++) { const t = (j + .5) / n - .5; L.blot(t * w * .78 + C.R(-20, 20), -h * .06 + C.R(-.1, .1) * h - h * .16 * Math.cos(t * 3), w * C.R(.09, .17), h * C.R(.16, .3), {dens: C.R(.04, .065), rim: .1, rimW: .3, soft: .85, rough: .55, freq: .008, gran: .2}) }
  L.blot(0, h * .3, w * .5, h * .22, {pig: 'lift', dens: 1, rim: 0, soft: .8, rough: .4, freq: .01, gran: 0}) }));
// birds: three beats of the wing
[[-9, -5, 0, 2, 10, -4], [-10, -1, 0, 1, 10, 0], [-8, 4, 0, 0, 9, 5]].forEach(([ax, ay, bx, by, cx, cy], i) => spr('bird' + i, 'ink', 28, 20, 14, 10, 3, L => { L.stroke([[ax, ay, .35], [(ax + bx) / 2, (ay + by) / 2 - 1.5, 1.15], [bx, by, .6]], {load: 1, pool: 0, rag: .1}); L.stroke([[bx, by, .6], [(bx + cx) / 2, (by + cy) / 2 - 1.2, 1.05], [cx, cy, .25]], {load: 1, pool: 0, rag: .1}) }));
// ripples: dry level pulls, to come and go on the water; and the paper's light on it
for (let i = 0; i < 4; i++) spr('rip' + i, 'ink', 200, 14, 100, 7, 1, (L, C) => { let x = -90; while (x < 70) { const len = C.R(24, 80); drag(L, x, C.R(-2, 2), Math.min(len, 90 - x), C.R(.8, 1.5), C.R(.3, .5), C, {dry: .5, tilt: .1}); x += len + C.R(8, 30) } });
for (let i = 0; i < 3; i++) spr('glint' + i, 'mist', 220, 16, 110, 8, 1, (L, C) => { let x = -100; while (x < 80) { const len = C.R(30, 90); drag(L, x, C.R(-2, 2), Math.min(len, 100 - x), C.R(1.6, 2.8), C.R(1, 1.6), C, {dry: .3, tilt: .1}); x += len + C.R(10, 40) } });
// falling water: streaks of paper down the fall
for (let i = 0; i < 3; i++) spr('fall' + i, 'mist', 30, 210, 15, 5, 1, (L, C) => { for (let j = 0; j < 4; j++) { const x = C.R(-7, 7), y = C.R(0, 120), l = C.R(40, 90); L.stroke([[x, y, .5], [x + C.R(-1.5, 1.5), y + l * .5, C.R(1.2, 2.2)], [x + C.R(-2, 2), y + l, .4]], {load: C.R(.8, 1.4), dry: .2, dry1: .8, streak: .7, pool: 0}) } });
// mist: long lobes of nothing, soft everywhere, each its own shape
[[620, 110, 31], [520, 90, 37], [760, 120, 43], [440, 80, 47], [680, 100, 53], [560, 130, 59]].forEach(([w, h, sd], i) => spr('mist' + i, 'mist', w, h, w / 2, h / 2, .25, (L, C) => { L.seed = sd;
  // every stain stays well inside its sheet (radius x (1.25 + rough) < half the sheet), so no lobe is ever cut square by its own edge
  L.blot(0, 2, w * .27, h * .22, {dens: 1.6, rim: 0, soft: .92, rough: .4, freq: .006, gran: 0}); L.blot(C.R(-.14, .14) * w, -h * .08, w * .17, h * .16, {dens: 1.1, rim: 0, soft: .95, rough: .45, freq: .009, gran: 0}); L.blot(C.R(-.16, .16) * w, h * .08, w * .14, h * .12, {dens: .8, rim: 0, soft: .95, rough: .45, freq: .012, gran: 0}) }));
// banner cloth in cinnabar: a long pennant with a swallow tail, drawn hanging to the LEFT of its pole (the wind's way)
[['flagA', 92, 34], ['flagB', 74, 28], ['flagC', 60, 24]].forEach(([name, len, ht]) => spr(name, 'col', len + 16, ht + 20, len + 8, 8, 2, (L, C) => {
  L.stroke([[0, ht * .45, ht * .5], [-len * .35, ht * .46, ht * .47], [-len * .7, ht * .5, ht * .36], [-len * .97, ht * .34, ht * .1]], {pig: 'rust', load: .85, load1: .6, dry: .05, dry1: .6, streak: .8, rag: .25, pool: .3, gran: 1.1});
  L.stroke([[-len * .62, ht * .62, ht * .2], [-len * .82, ht * .76, ht * .13], [-len * .99, ht * .86, .5]], {pig: 'rust', load: 1.1, dry: .1, dry1: .6, streak: .6, rag: .25});
  L.stroke([[0, ht * .12, 1], [-len * .5, ht * .1, 1.6], [-len * .9, ht * .2, .5]], {pig: 'ink', load: .5, dry: .2, dry1: .7, streak: .6}) }));
// the sun at dawn: small, pale, a wet disc with a rim
spr('sun', 'col', 90, 90, 45, 45, 1, L => { L.blot(0, 0, 25, 25, {pig: 'rust', dens: .42, rim: .5, rimW: .05, soft: .08, rough: .025, gran: .9, seed: 3}) });

/* ---------- placing the mist and what stands in front (run-time lists) ---------- */
// mist: {cell, p, u (sheet units of a layer with parallax p), y, k, a, span (how far it drifts before it comes round)}
const M = (cell, p, place, sx, y, k, a) => ({cell, p, u: Math.round(p * (PL[place] - CAM0) + U0 + sx), y, k: +(k * 1.45).toFixed(2), a});
PLACE.mist = [
  M('mist2', .42, 0, -200, 776, 1.5, .7), M('mist0', .42, 2, 60, 770, 1.6, .8),                                         // behind the near hills
  M('mist1', .7, 0, -260, 806, 1.4, .8), M('mist5', .7, 2, -80, 792, 1.7, .9), M('mist4', .7, 2, 80, 690, 1.0, .65), M('mist3', .7, 4, 420, 800, 1.5, .5),   // behind the places
  M('mist4', .95, 0, -60, 812, 1.6, .7), M('mist3', .95, 2, 60, 806, 1.7, .85), M('mist0', .95, 4, 260, 818, 1.8, .55),   // at their feet
];
// front: {cell, x: the camera x at which it is in the middle of the screen, dx: where it then is, sway}
PLACE.front = [   // `at` (which atlas holds the cell) is filled in below
  {cell: 'fStakes', x: PL[0] - 520, k: 1, sway: 0}, {cell: 'fGrassB', x: PL[0] + 470, k: .8, sway: 1},
  {cell: 'fReedsA', x: PL[1] - 420, k: 1, sway: 1}, {cell: 'fStonesB', x: PL[1] + 60, k: .7, sway: 0}, {cell: 'fReedsB', x: PL[1] + 520, k: .9, sway: 1},
  {cell: 'fRockPine', x: PL[2] - 470, k: 1, sway: 0}, {cell: 'fStonesA', x: PL[2] + 520, k: .85, sway: 0}, {cell: 'fGrassC', x: PL[2] + 110, k: .7, sway: 1},
  {cell: 'fGrassA', x: PL[3] - 500, k: 1, sway: 1}, {cell: 'fDead', x: PL[3] + 480, k: 1, sway: 0}, {cell: 'fGrassC', x: PL[3] + 20, k: .6, sway: 1, flip: -1},
  {cell: 'fAbatis', x: PL[4] - 440, k: 1, sway: 0}, {cell: 'fRockB', x: PL[4] + 520, k: .9, sway: 0}, {cell: 'fGrassB', x: PL[4] + 90, k: .6, sway: 1, flip: -1},
];

for (const o of PLACE.front) o.at = 'f' + FRP[o.cell];

/* ---------- the script of the day: paper, ink near and far, the strength of the mineral colour ---------- */
// The ink is baked in its day colour, cooler and paler with distance (ink toward haze by depth). At run time the ink's
// temperature is one colour screened over the scene (it lifts the darks toward itself and leaves the paper nearly alone).
export const TIME = {
  keys: [0, .42, .6, 1],
  paper: [[233, 230, 219], [239, 231, 214], [239, 231, 214], [226, 180, 142]],
  temper: [[5, 10, 20], [0, 0, 0], [0, 0, 0], [36, 12, 4]],
  ink: [[30, 26, 22], [30, 26, 22], [30, 26, 22], [30, 26, 22]], haze: [[98, 108, 122], [98, 108, 122], [98, 108, 122], [98, 108, 122]],
  mineral: [.6, 1, 1, .8], dusk: [0, 0, 0, 1], sun: [.65, .25, .1, 0],
};

/* ---------- bake ---------- */
const rgb2L = (r, g, b) => { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }, Y = .2126 * f(r) + .7152 * f(g) + .0722 * f(b); return Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y };
const inkOf = d => TIME.ink[1].map((v, i) => Math.round(v + (TIME.haze[1][i] - v) * d * .6));
// one piece of a sheet as a file. raw: RGBA; scale < 1 writes it smaller (soft things lose nothing by it)
async function encode(raw, w, h, file, {scale = 1, quality = 50, alphaQuality = 78, crop = null} = {}) {
  let img = sharp(raw, {raw: {width: w, height: h, channels: 4}}); if (crop) img = img.extract(crop);
  const cw = crop ? crop.width : w; if (scale !== 1) img = img.resize({width: Math.max(1, Math.round(cw * scale))});
  await img.webp({quality, alphaQuality, effort: 6}).toFile(file); return statSync(file).size }
const inkRGBA = (L, rgb) => { const m = L.inkMask(), buf = Buffer.alloc(L.N * 4); let any = false; for (let i = 0; i < L.N; i++) { buf[i * 4] = rgb[0]; buf[i * 4 + 1] = rgb[1]; buf[i * 4 + 2] = rgb[2]; buf[i * 4 + 3] = m[i]; if (m[i]) any = true } return any ? buf : null };
const bodyRGBA = L => { const m = L.bodyMask(); if (!m) return null; const buf = Buffer.alloc(L.N * 4); for (let i = 0; i < L.N; i++) buf[i * 4 + 3] = m[i]; return buf };
// darkest and lightest: the 0.05% ends of the sheet's lightness (L*, paper about 92), over raw paper in day ink.
// p05: the 5% point of the painted pixels only (those under L 90). under52: the share of painted pixels darker than 52.
function valuesOf(L, d) { const f = L.flat(inkOf(d)); let lo = 100, hi = 0; const hist = new Uint32Array(101); for (let i = 0; i < L.N; i++) hist[Math.round(rgb2L(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]))]++;
  let acc = 0; for (let v = 0; v <= 100; v++) { acc += hist[v]; if (acc > L.N * .0005) { lo = v; break } } acc = 0; for (let v = 100; v >= 0; v--) { acc += hist[v]; if (acc > L.N * .0005) { hi = v; break } }
  let painted = 0, under = 0; for (let v = 0; v < 90; v++) { painted += hist[v]; if (v < 52) under += hist[v] } acc = 0; let p05 = lo; for (let v = 0; v < 90; v++) { acc += hist[v]; if (acc > painted * .05) { p05 = v; break } }
  return {darkest: lo, lightest: hi, p05, under52: +(under / Math.max(1, painted)).toFixed(4), ink: inkOf(d)} }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t00 = performance.now(); mkdirSync(OUT, {recursive: true});
  let old = null; try { const fs = await import('node:fs'); old = JSON.parse(fs.readFileSync(join(OUT, 'scene.json'), 'utf8')) } catch { /* first bake */ }
  const meta = {}, values = old?.values || {};
  // every painter runs (they fill PLACE), but with only=..., sheets not named are painted on a 1-pixel-per-16 sheet and not written
  for (const [name, def] of Object.entries(LAYERS)) {
    const sheet = sheets.find(s => s.name === name), w = widthOf(def.p), t0 = performance.now();
    if (sheet) {
      const L = new Layer(w, def.y1 - def.y0, def.s, 0, -def.y0); sheet.paint(L);
      const ink = inkRGBA(L, inkOf(def.d)), col = L.colour(), bod = bodyRGBA(L), W = L.W, H = L.H;
      const enc = (raw, file, o) => raw ? encode(raw, W, H, join(OUT, file), o) : 0;
      meta[name] = {p: def.p, y0: def.y0, y1: def.y1, w, d: def.d, ink: !!ink, colour: !!col, body: !!bod};
      if (name !== 'set') { await enc(ink, name + '.webp', {alphaQuality: def.aq}); await enc(col, name + '.c.webp', {scale: def.cs, quality: 72, alphaQuality: 70}); await enc(bod, name + '.b.webp', {scale: .5, quality: 40, alphaQuality: 60}) }
      else {
        // The places are cut apart where the sheet is emptiest between them, each cropped to what is painted in it, so
        // that a place is a few small files and the first can be on screen before the others have come.
        const cs = PL.map(c => X('set', c) * def.s), sum = new Float64Array(W);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; sum[x] += (ink ? ink[i * 4 + 3] : 0) + (col ? col[i * 4 + 3] : 0) }
        const cuts = [0]; for (let t = 0; t < 4; t++) { const mid = Math.round((cs[t] + cs[t + 1]) / 2); let best = mid; for (let x = mid - Math.round(100 * def.s); x <= mid + Math.round(100 * def.s); x++) if (sum[x] < sum[best] - 1e-9) best = x; cuts.push(best) } cuts.push(W);
        meta.set.tiles = [];
        for (let t = 0; t < 5; t++) { const x0 = cuts[t], x1 = cuts[t + 1]; let ya = H, yb = 0;
          for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4 + 3; if ((ink && ink[i]) || (col && col[i]) || (bod && bod[i])) { if (y < ya) ya = y; yb = y; break } }
          ya = Math.max(0, ya - 2); yb = Math.min(H, yb + 3); const crop = {left: x0, top: ya, width: x1 - x0, height: yb - ya}, n = t + 1;
          await enc(ink, `set-${n}.webp`, {crop, alphaQuality: def.aq}); await enc(col, `set-${n}.c.webp`, {crop, scale: def.cs, quality: 72, alphaQuality: 70}); await enc(bod, `set-${n}.b.webp`, {crop, scale: .5, quality: 40, alphaQuality: 60});
          meta.set.tiles.push({u0: x0 / def.s, u1: x1 / def.s, y0: def.y0 + ya / def.s, y1: def.y0 + yb / def.s}) }
      }
      values[name] = valuesOf(L, def.d);
      await sharp(L.flat(inkOf(def.d)), {raw: {width: L.W, height: L.H, channels: 3}}).resize({width: Math.min(L.W, 2400)}).jpeg({quality: 80}).toFile(join(root, 'review', 'sheet-' + name + '.jpg'));
      console.log(`${name} ${L.W}x${L.H} ${((performance.now() - t0) / 1000).toFixed(1)} s`, values[name]);
    } else meta[name] = old.layers[name];
  }
  if (ONLY && !ONLY.includes('set')) Object.assign(PLACE, {banners: old.place.banners, falls: old.place.falls, water: old.place.water, birds: old.place.birds, sun: old.place.sun});
  if (ONLY && !ONLY.includes('ground')) PLACE.tufts = old.place.tufts;
  // sprites, packed on shelves into one atlas per kind
  let atlas = old?.atlas;
  if (!ONLY || ONLY.includes('sprites')) {
    atlas = {};
    for (const kind of ['ink', 'mist', 'col', 'f1', 'f2', 'f3', 'f4', 'f5']) { const isInk = kind === 'ink' || kind[0] === 'f';
      const names = Object.keys(SPR).filter(n => SPR[n].kind === kind).sort((a, b) => SPR[b].h * SPR[b].s - SPR[a].h * SPR[a].s), AW = kind[0] === 'f' ? 1024 : 2048, cells = {}, parts = [];
      let x = 0, y = 0, rowH = 0;
      for (const n of names) { const q = SPR[n], W = Math.ceil(q.w * q.s), H = Math.ceil(q.h * q.s); if (x + W > AW) { x = 0; y += rowH + 2; rowH = 0 }
        const L = new Layer(q.w, q.h, q.s, q.px, q.py); L.seed = n.length * 7.7 + n.charCodeAt(n.length - 1); q.paint(L, chance(n.split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)));
        let raw; if (kind === 'col') raw = L.colour(); else { const m = L.inkMask(), c = isInk ? TIME.ink[1] : [0, 0, 0]; raw = Buffer.alloc(L.N * 4); for (let i = 0; i < L.N; i++) { raw[i * 4] = c[0]; raw[i * 4 + 1] = c[1]; raw[i * 4 + 2] = c[2]; raw[i * 4 + 3] = m[i] } }
        if (kind === 'col' && L.d.ink.some(v => v > 0)) { const m = L.inkMask(); for (let i = 0; i < L.N; i++) { const a = m[i] / 255; if (a > 0) { const ca = raw[i * 4 + 3] / 255, na = 1 - (1 - ca) * (1 - a); for (let k2 = 0; k2 < 3; k2++) raw[i * 4 + k2] = na ? (raw[i * 4 + k2] * ca * (1 - a) + 30 * a) / na : 0; raw[i * 4 + 3] = na * 255 } } }
        parts.push({input: raw, raw: {width: L.W, height: L.H, channels: 4}, left: x, top: y}); cells[n] = [x, y, L.W, L.H, q.px, q.py, q.s]; x += W + 2; rowH = Math.max(rowH, H) }
      const AH = y + rowH;
      await sharp({create: {width: AW, height: AH, channels: 4, background: isInk ? {r: TIME.ink[1][0], g: TIME.ink[1][1], b: TIME.ink[1][2], alpha: 0} : {r: 0, g: 0, b: 0, alpha: 0}}}).composite(parts).webp({quality: kind === 'col' ? 80 : 50, alphaQuality: kind === 'mist' ? 60 : 78, effort: 6}).toFile(join(OUT, `atlas-${kind}.webp`));
      atlas[kind] = {w: AW, h: AH, cells}; console.log(`atlas-${kind} ${AW}x${AH} ${names.length} cells`);
    }
    // the paper's grain: a tile that repeats without a seam, to be multiplied over the paper's flat colour
    // Black with a little alpha, so laying it ON (source-over) darkens exactly as multiplying by a grey would, without the blend.
    const G = 256, g = Buffer.alloc(G * G * 4), wrap = (f, x, y) => { const u = x / G, v = y / G; return f(x, y) * (1 - u) * (1 - v) + f(x - G, y) * u * (1 - v) + f(x, y - G) * (1 - u) * v + f(x - G, y - G) * u * v };
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const m = wrap((a, b) => (vnoise(a * 1.1 + 50, b * 1.1 + 50) - .5) * .05 + (vnoise(a * .09 + 50, b * .5 + 50) - .5) * .03 + (fbm(a * .02 + 50, b * .025 + 50, 3) - .5) * .05, x, y); g[(y * G + x) * 4 + 3] = clamp(255 * (.06 - m), 0, 255) }
    await sharp(g, {raw: {width: G, height: G, channels: 4}}).webp({lossless: true, effort: 6}).toFile(join(OUT, 'grain.webp'));
  }
  writeFileSync(join(OUT, 'scene.json'), JSON.stringify({world: WORLD, ground: GY, u0: U0, cam0: CAM0, cam1: CAM1, places: PL, layers: meta, atlas, place: PLACE, time: TIME, values}));
  let bytes = 0; for (const f of readdirSync(OUT).sort()) if (/\.(webp|jpg|png)$/.test(f)) { const n = statSync(join(OUT, f)).size; bytes += n; if (process.argv.includes('sizes')) console.log(f.padEnd(18), n) }
  console.log(`total ${((performance.now() - t00) / 1000).toFixed(1)} s; images ${(bytes / 1048576).toFixed(2)} MB`);
}
