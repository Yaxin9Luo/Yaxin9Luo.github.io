// node world/src/fengshen/art/gen/scene.gen.mjs [draft] [tone=day|dusk|all] [only=far,mid]
// The battlefield in ink, for a world 4800 px long: five sheets (back to front), each as wide as its parallax needs,
// baked to ../baked/<tone>/*.webp with ../baked/scene.json (where each sheet sits) and ../baked/<tone>/paper.jpg.
// No figures here: those are puppets (figures.js) and paint marks (fx.gen.mjs).
// A tone changes the paper's colour, the ink's temperature and the strength of the sun. Nothing else.
// Units are the design's: a view is 1440 x 900, the ground line is at y = 738. A sheet's own x is called u.
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Layer, paper, sharp, chance, fbm, vnoise, clamp, smooth, setTone, TONES} from './ink.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const DRAFT = process.argv.includes('draft'), ONLY = arg('only'), TONE_ARG = arg('tone') || 'all';
export const VIEW = 1440, H = 900, GROUND = 738, WORLD = 4800, MARGIN = 220, U0 = VIEW / 2 + MARGIN, START = 600;
// p: parallax (how far the sheet slides per pixel of camera); y0..y1: the band of the view it paints; s: pixels per unit
export const LAYERS = {
  sky: {p: .05, y0: 150, y1: 640, s: 1}, far: {p: .15, y0: 230, y1: 690, s: 1}, mid: {p: .35, y0: 420, y1: 700, s: 1},
  ground: {p: 1, y0: 630, y1: 890, s: DRAFT ? 1 : 2}, front: {p: 1.4, y0: 640, y1: 900, s: DRAFT ? 1 : 1.5},
};
const widthOf = p => Math.round(WORLD * p + VIEW + 2 * MARGIN);
// A point of the sheet is on the middle of the screen when the camera is at world x = (u - U0) / p.
// at(name, x): where something drawn at x in the approved one-screen still goes, so that the opening view is that still.
const at = (name, x = 0) => U0 + START * LAYERS[name].p - VIEW / 2 + x;
const sh = (pts, dx) => pts.map(([x, y, ...r]) => [x + dx, y, ...r]);

/* ---------- rock, in axe-cut strokes (斧劈皴) ----------
   The light is on the upper left for the whole picture. A mass has a lit side that is mostly bare paper with a
   broken line, and a shaded side that is one wet wash under a pressed line, cut by broad side-brush slashes. */
// a ridge through hand-set points: straight runs, corners a little worn, then small steps
function ridgeOf(pts, seed, crag = 5) {
  const lin = x => {
    if (x <= pts[0][0]) return pts[0][1] + (pts[0][0] - x) * .35;
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) }
    const l = pts[pts.length - 1]; return l[1] + (x - l[0]) * .35;
  };
  return x => (lin(x - 5) + 2 * lin(x) + lin(x + 5)) / 4 - Math.abs(fbm(x * .035 + seed, 5, 3) - .5) * 2 * crag - (vnoise(x * .16 + seed, 8) - .5) * crag * .35;
}
const slope = (rf, x, d = 7) => (rf(x + d) - rf(x - d)) / (2 * d);        // > 0: the ground falls to the right (shaded)

// A mass is BUILT from strokes, not shaded: a pale ground tone that is lost at the foot; then, at every corner of the
// ridge where the ground turns over into shade, a spine running down into the mass with side-brush slashes pulled
// from it (their starts make the one hard edge: the break between light and shade; their tails run dry into the shade);
// a firm line on the shaded skyline, a broken one on the lit side; clefts and trees in near-black as the few accents.
// tone scales every load, so a far mass is the same drawing in paler ink.
function rock(L, pts, o) {
  const {seed = 1, foot = 1e9, tone = 1, fade = 200, x0 = pts[0][0] - 40, x1 = pts[pts.length - 1][0] + 40, lost = 'left', k = 1, azu = 0, trees = 0, accent = 1, inner = []} = o;
  const C = chance(Math.round(seed * 131)), rf = ridgeOf(pts, seed, o.crag ?? 4);
  const fl = lost === 'left' ? 170 : 60, fr = lost === 'left' ? 60 : 170;
  const feather = x => smooth(x0, x0 + fl, x) * (1 - smooth(x1 - fr, x1, x));
  // 1. the ground tone (清): thin, gone before the foot
  L.mountain(rf, {dens: .075 * tone, fade, fadeVar: .6, pow: 1.4, edge: .3, edgeW: 1.4, blotch: .4, tide: .3, x0, x1, feather: 1, mod: feather, seed});
  if (azu) L.mountain(rf, {dens: azu, fade: fade * .45, edge: 0, pig: 'azu', blotch: .7, x0, x1, feather: 1, mod: feather, seed: seed + 1});
  // 2. the shaded faces, one wet tone (淡) under everything that follows, with a hard top under the ridge
  L.mountain(rf, {dens: .1 * tone, fade: fade * .55, fadeVar: .7, pow: 1.1, edge: 1.1, edgeW: 1.6, blotch: .5, tide: .5, x0, x1, feather: 1, mod: x => feather(x) * smooth(.15, .6, slope(rf, x, 9)), seed: seed + 2});
  // 3. spines and their slashes (重)
  const slash = (xs, ys, len, w, load, dry1, dx = C.R(.2, 1.0)) => { const bend = C.R(-.12, .12) * len;
    L.stroke([[xs, ys, w * .6], [xs + dx * len * .3 + bend * .3, ys + len * .3, w], [xs + dx * len * .7 + bend, ys + len * .7, w * .78], [xs + dx * len, ys + len, w * .12]],
      {load, load1: load * .45, dry: C.R(.08, .22), dry1, dryPow: C.R(.8, 1.2), side: -.8, pool: .28, streak: .9, rag: .28, soft: .08}) };
  // spines start at every corner of the ridge that turns over into shade, and at the hand-set places inside the mass
  const spines = inner.map(([x, y, len, tk = .7]) => [x, y, len, tk]);
  for (let i = 1; i < pts.length - 1; i++) { const [px, py] = pts[i], sa = (py - pts[i - 1][1]) / (px - pts[i - 1][0]), sb = (pts[i + 1][1] - py) / (pts[i + 1][0] - px);
    if (sb > .45 && sb - sa > .5 && py < foot - 30) spines.push([px, rf(px), (foot - py) * C.R(.5, .8), 1]) }
  for (const [px, top, len, tk] of spines) {
    const f = feather(px); if (f < .25) continue;
    const lean = C.R(-.2, .04);
    // Slashes come in clusters along the break, two to four at a time, each cluster with its own angle; between
    // clusters the rock face is left bare. No two neighbours share a length.
    let t = C.R(0, .06);
    while (t < .92) {
      const n = 2 + Math.floor(C.R(0, 2.6)), ang = C.R(.2, 1.0), big = C.R(.6, 1.25);
      for (let j = 0; j < n && t < .95; j++) {
        const xs = px + 1 + lean * len * t + C.R(-2, 2), ys = top + 3 + len * t;
        slash(xs, ys, Math.min(foot - ys, C.R(16, 100) * k * big * (1 - .4 * t)), C.R(5, 19) * k * (1 - .3 * t), tone * tk * (.34 - .14 * t) * C.R(.65, 1.2) * f, C.R(.7, .93), ang + C.R(-.14, .14));
        t += C.R(5, 13) * k / len;
      }
      t += C.R(.1, .3);                                                                   // a bare face
    }
    // the spine itself: one pressed line, lifted two thirds of the way down
    L.stroke([[px, top + 1, 1.5 * k], [px + lean * len * .3, top + len * .3, 2.1 * k], [px + lean * len * .66, top + len * .66, .5 * k]], {load: tone * tk * .5 * f, dry: .05, dry1: .7, streak: .5, rag: .2, pool: .2});
    // a cleft or two in burnt ink (焦): short, thin, the darkest marks on the mass
    for (let j = 0; j < Math.round(C.R(.6, 2.2) * accent * tk); j++) { const t = C.R(.08, .5), xs = px + 4 + lean * len * t + C.R(2, 16) * k, ys = top + 6 + len * t, l = C.R(10, 24) * k;
      L.stroke([[xs, ys, .5], [xs + l * .25, ys + l * .5, C.R(1, 1.8) * k], [xs + l * .5, ys + l, .3]], {load: tone * .95 * f, dry: 0, dry1: .5, pool: .1, streak: .3, rag: .15}) }
  }
  // 4. the skyline: cuts hanging from the shaded slopes; a pressed line there, a thin broken one on the lit side
  let x = x0 + 30;
  while (x < x1 - 20) {
    const g = slope(rf, x), f = feather(x);
    if (g > .35 && f > .2 && rf(x) < foot - 30) { if (C.rnd() < .55) slash(x + C.R(-5, 5), rf(x) + C.R(1, 4), Math.min(foot - rf(x), C.R(16, 64) * k), C.R(5, 12) * k, tone * .22 * C.R(.7, 1.15) * f, C.R(.75, .92)); x += C.R(14, 44) / k }
    else if (g < -.2 && f > .3 && C.rnd() < .5 && rf(x) < foot - 24) { const xs = x, ys = rf(xs) + C.R(5, 16), len = C.R(24, 60) * k, w = C.R(1.2, 3) * k, dx = -C.R(.5, .9), dy = Math.min(1.1, -g * C.R(.7, 1.1) + .25);
      L.stroke([[xs, ys, w * .4], [xs + dx * len * .5, ys + dy * len * .5, w], [xs + dx * len, ys + dy * len, w * .2]], {load: tone * .16 * f, dry: C.R(.4, .55), dry1: C.R(.8, .93), streak: .8, rag: .3, pool: 0}); x += C.R(40, 100) / k }
    else x += C.R(22, 50);
  }
  x = x0 + C.R(10, 40);
  while (x < x1 - 10) {
    const g = slope(rf, x, 12), dark = g > .15, len = dark ? C.R(50, 120) : C.R(24, 70), p = [];
    for (let u = 0; u <= len; u += 6) { const xx = x + u, t = u / len, gg = Math.abs(slope(rf, xx, 4)); p.push([xx, rf(xx) + .6, (dark ? 1.6 : .8) * k * (.35 + .9 * Math.min(1, gg)) * (.4 + .9 * Math.sin(Math.PI * Math.min(1, t * 1.2 + .05)))]) }
    const f = feather(x + len / 2);
    if (p.length > 2 && f > .25 && rf(x + len / 2) < foot) L.stroke(p, {load: tone * (dark ? .42 : .2) * C.R(.75, 1.15) * f, dry: dark ? C.R(0, .2) : C.R(.3, .5), dry1: dark ? C.R(.4, .7) : C.R(.75, .92), streak: .5, rag: .2, pool: dark ? .2 : 0});
    x += len + (dark ? C.R(4, 26) : C.R(30, 110));
  }
  // 5. trees on the shoulders: a few wet dots of burnt ink, in small groups
  for (let g = 0; g < trees; g++) { const cx = C.R(x0 + fl * .6, x1 - fr * .6), n = 2 + Math.floor(C.R(0, 3)); if (rf(cx) > foot - 20) continue;
    for (let i = 0; i < n + 2; i++) { const xx = cx + C.gauss() * 11 * k, yy = rf(xx) + C.R(0, 2), h = C.R(4, 9) * k; L.stroke([[xx, yy, .5], [xx + C.R(-.6, .6), yy - h * .5, C.R(1.1, 1.9) * k], [xx + C.R(-1, 1), yy - h, .3]], {load: tone * .9 * feather(xx), streak: .3, pool: .2, dry1: .3}) } }
  return rf;
}
// mist that cuts a mass: water lifted through the wash in a long lobe, soft everywhere
const cutMist = (L, C, x, y, rx, ry, d = .85) => L.blot(x, y, rx, ry, {pig: 'lift', dens: d, rim: 0, soft: .9, rough: .35, freq: .008, gran: 0});

// a pine in a few marks: a leaning trunk and flat wet dabs, wider below
function pine(L, x, y, h, C, load = .6) {
  const lean = C.R(-.16, .16);
  L.stroke([[x, y, 1.1], [x + lean * h * .5, y - h * .5, .8], [x + lean * h, y - h, .35]], {load: load * 1.1, rag: .1, pool: 0});
  const n = 3 + Math.floor(C.R(0, 2.2));
  for (let i = 0; i < n; i++) { const t = (i + .6) / n, yy = y - h * (.3 + .7 * t), w = h * (.36 - .22 * t) * C.R(.75, 1.35), cx = x + lean * h * (.3 + .7 * t) + C.R(-2, 2); L.stroke([[cx - w, yy + C.R(0, 2), .5], [cx + C.R(-1, 1), yy - 1, C.R(1.4, 2.6)], [cx + w, yy + C.R(0, 2.5), .4]], {load: load * C.R(.75, 1.25), streak: .4, dry1: .35, pool: .2}) }
}
// a reed leaf, as orchid leaves are drawn: thin, swelling, thin, and bowed by its own weight; some break and hang
function leaf(L, x, y, h, lean, C, o = {}) {
  const w = C.R(1.7, 3.3) * (o.w || 1), bow = C.R(.15, .5) * (lean >= 0 ? 1 : -1), hang = C.R(0, 1) < .22;
  const tip = hang ? [x + lean * h * .8 + bow * h * .7, y - h * C.R(.45, .62)] : [x + lean * h + bow * h * .5, y - h * C.R(.88, 1)];
  L.stroke([[x, y, w * .45], [x + lean * h * .3, y - h * .46, w], [x + lean * h * .62 + bow * h * .16, y - h * .84, w * .6], [...tip, .12]], {load: (o.load || 2) * C.R(.75, 1.15), dry: 0, dry1: C.R(.25, .7), dryPow: 2, streak: .55, rag: .1, pool: .1, side: C.R(-.3, .3)});
}

const sheets = [];
const add = (name, paint) => { if (!ONLY || ONLY.split(',').includes(name)) sheets.push({name, ...LAYERS[name], paint}) };

/* ---------- 1. sky: the sun (the one accent of the tone), ghosts of ranges, birds going home ---------- */
add('sky', (L, T) => {
  const dx = at('sky');
  L.blot(dx + 792, 318, 33, 33, {pig: 'red', dens: T.sun, rim: .5, rimW: .05, soft: .08, rough: .025, gran: .9, seed: 3});
  for (const [pts, x0, x1, d] of [
    [[[980, 560], [1090, 470], [1170, 420], [1205, 415], [1235, 470], [1330, 440], [1400, 385], [1440, 380], [1470, 440], [1600, 470]], 960, 1640, .07],
    [[[-140, 520], [-20, 500], [80, 470], [120, 472], [160, 520], [300, 560]], -200, 330, .06],
    [[[380, 600], [470, 560], [540, 548], [600, 560], [700, 600]], 360, 720, .04]]) {
    const g = ridgeOf(sh(pts, dx), 3.1 + x0 * .01, 3);
    L.mountain(g, {dens: d, fade: 190, pow: 1.1, edge: .5, edgeW: 2.2, blotch: .3, tide: .2, x0: dx + x0, x1: dx + x1, feather: 150});
    L.mountain(g, {dens: d * .6, fade: 110, edge: 0, pig: 'azu', blotch: .5, x0: dx + x0, x1: dx + x1, feather: 150});
  }
  for (const [x, y, k] of [[604, 238, 1], [632, 222, .8], [668, 248, .7], [571, 263, .6], [1500, 300, .7], [1530, 288, .55]]) { const X = dx + x; L.stroke([[X - 7 * k, y - 3 * k, .3], [X - 3 * k, y - 1.5 * k, 1.1 * k], [X, y + 1.5 * k, .5]], {load: .9, pool: 0}); L.stroke([[X, y + 1.5 * k, .5], [X + 4 * k, y - 2.5 * k, 1 * k], [X + 9 * k, y - 2 * k, .2]], {load: .9, pool: 0}) }
});

/* ---------- 2. far mountains. They slide only 720 px in the whole run, so this is one long composition and not a
   pattern: a low range, a void, the host and its guests, a pale long range, and a leaning group at the far end. ---------- */
add('far', L => {
  const C = chance(21), dx = at('far');
  const R = (pts, o) => rock(L, sh(pts, dx), {...o, x0: o.x0 + dx, x1: o.x1 + dx, inner: (o.inner || []).map(([x, ...r]) => [x + dx, ...r])});
  R([[-460, 590], [-400, 552], [-350, 524], [-312, 518], [-294, 556], [-230, 588]], {seed: 2.2, foot: 590, tone: .3, fade: 110, x0: -480, x1: -200, lost: 'right', trees: 1, accent: .4});
  // guest, behind and to the right: a flat-topped mesa, the palest
  R([[1290, 590], [1332, 540], [1352, 470], [1372, 452], [1440, 446], [1486, 452], [1500, 520], [1530, 560], [1600, 585]], {seed: 9.1, foot: 566, tone: .36, fade: 170, x0: 1270, x1: 1620, lost: 'right', azu: .05, trees: 1, accent: .5});
  // the host: a long low shoulder, then a tower with a broad crown and a cliff on its shaded side
  R([[930, 606], [976, 574], [1010, 562], [1022, 514], [1070, 502], [1086, 472], [1128, 464], [1144, 384], [1160, 362], [1170, 302], [1190, 286], [1224, 282], [1240, 300], [1246, 386], [1266, 402], [1274, 480], [1310, 502], [1326, 562], [1368, 596]], {seed: 7.7, foot: 566, tone: .58, fade: 240, x0: 900, x1: 1392, k: 1.2, azu: .08, trees: 3, inner: [[1150, 400, 130, .75], [1094, 482, 70, .6], [1030, 524, 36, .5], [1196, 300, 60, .55]]});
  // guest, in front and to the left of the host: a low leaning ridge
  R([[820, 620], [868, 596], [900, 560], [936, 548], [950, 556], [962, 600], [1000, 618]], {seed: 5.5, foot: 606, tone: .46, fade: 90, x0: 800, x1: 1020, k: .85, trees: 1, accent: .6});
  // the low range on the left
  R([[-130, 566], [-84, 512], [-60, 462], [-36, 452], [22, 446], [46, 452], [58, 512], [108, 522], [150, 544], [196, 516], [214, 482], [246, 472], [268, 478], [282, 548], [360, 574], [470, 602]], {seed: 12.4, foot: 588, tone: .4, fade: 150, x0: -140, x1: 500, lost: 'right', azu: .04, trees: 2, accent: .6, inner: [[-30, 466, 70, .7], [226, 486, 50, .6]]});
  // further on: a pale long range lost into the paper, and a group that leans, the last thing before the town
  R([[1640, 596], [1700, 556], [1752, 528], [1816, 520], [1842, 538], [1886, 506], [1950, 500], [1972, 544], [2040, 584]], {seed: 15.3, foot: 580, tone: .3, fade: 120, x0: 1620, x1: 2060, lost: 'right', trees: 1, accent: .4});
  R([[1930, 606], [1990, 566], [2026, 476], [2044, 408], [2068, 378], [2090, 384], [2100, 470], [2136, 490], [2148, 444], [2176, 424], [2204, 432], [2214, 522], [2256, 562], [2330, 596]], {seed: 18.6, foot: 570, tone: .5, fade: 200, x0: 1900, x1: 2350, k: 1.1, azu: .06, trees: 2, inner: [[2046, 420, 110, .7], [2160, 440, 80, .6]]});
  for (const [x, y, rx, ry, d] of [[1090, 552, 250, 24, .85], [1360, 566, 230, 22, .85], [150, 592, 290, 26, .9], [1180, 452, 80, 9, .45], [900, 614, 120, 14, .8], [-340, 592, 160, 16, .8], [1830, 584, 240, 20, .85], [2110, 572, 240, 22, .85], [2070, 470, 60, 8, .4]]) cutMist(L, C, dx + x, y, rx, ry, d);
});

/* ---------- 3. the nearer hills and pines, sliding 1680 px in the run, and the town of Shang: it comes into view
   past the middle of the field and stands right of centre at the end. ---------- */
function town(L, C, x0, x1, gates) {
  // No tiled roofs, no upturned eaves: this is a thousand years before them. A rammed-earth wall with sloping ends and
  // the lines of its ramming; gate towers of posts under plain hipped roofs of thatch; rigid standards.
  const wy = x => 604 - (x - x0) * .006 + (vnoise(x * .05, 2) - .5) * 1.6;
  L.mountain(wy, {dens: .5, fade: 34, pow: .7, edge: .5, edgeW: 1.2, blotch: .5, x0, x1, feather: 12, rough: .5});
  for (const dy of [8, 15, 22, 29]) { let x = x0 + C.R(6, 20); while (x < x1 - 20) { const len = C.R(26, 80); L.stroke([[x, wy(x) + dy, .5], [x + len * .5, wy(x + len * .5) + dy, C.R(.8, 1.3)], [x + len, wy(x + len) + dy, .4]], {load: .5, dry: .35, dry1: .75, streak: .7, pool: 0}); x += len + C.R(10, 46) } }
  for (const [x, d] of [[x0, -1], [x1, 1]]) L.stroke([[x + d * 7, wy(x) + 32, .6], [x, wy(x) + 10, 1.5], [x - d * 5, wy(x), .8]], {load: .8, pool: .1});
  for (const [gx, k] of gates) {
    const gw = wy(gx);
    L.stroke([[gx - 8 * k, gw + 32, 1], [gx - 7.5 * k, gw + 12, 1.4], [gx + 7.5 * k, gw + 12, 1.4], [gx + 8 * k, gw + 32, 1]], {pig: 'lift', load: .9, pool: 0, streak: 0, rag: .1});
    for (const x of [-14, -5, 5, 14]) L.stroke([[gx + x * k, gw, .9], [gx + x * k + C.R(-.4, .4), gw - 16 * k, .8]], {load: .95, pool: 0});
    const thatch = x => { const u = Math.abs(x - gx); return gw - 16 * k - 15 * k * (1 - smooth(9 * k, 27 * k, u)) + (vnoise(x * .4, 3) - .5) * 1.2 };
    L.mountain(thatch, {dens: 1.0, fade: 13 * k, pow: .5, edge: .4, edgeW: 1, blotch: .4, x0: gx - 28 * k, x1: gx + 28 * k, feather: 3, rough: .6});
    L.stroke([[gx - 30 * k, gw - 15 * k, .6], [gx, gw - 14.4 * k, 1.5], [gx + 30 * k, gw - 15 * k, .6]], {load: 1.1, dry: .1, dry1: .4, streak: .6, rag: .3, pool: 0});
  }
  let x = x0 + 24;
  while (x < x1 - 20) { const h = C.R(13, 24); if (!gates.some(([gx, k]) => Math.abs(x - gx) < 36 * k)) { L.stroke([[x, wy(x) + 1, .8], [x + .4, wy(x) - h, .6]], {load: 1, pool: 0}); L.stroke([[x + 2.4, wy(x) + 1 - h, 2.4], [x + 2.8, wy(x) + 8 - h, 2.6], [x + 2.6, wy(x) + 11.5 - h, 1.4]], {load: 1.05, pool: 0, dry: .05, dry1: .3}) } x += C.R(26, 74) }
  for (let i = 0; i < Math.round((x1 - x0) / 34); i++) { const X = C.R(x0 - 10, x1 + 10), y = wy(X) + 40 + C.R(-3, 6); L.stroke([[X - C.R(3, 8), y + C.R(0, 1.5), .5], [X, y - C.R(1, 3), C.R(1.6, 3.6)], [X + C.R(3, 8), y + .5, .4]], {load: C.R(.4, .8), streak: .3, pool: .4}) }
}
add('mid', L => {
  const C = chance(5), dx = at('mid');
  const hills = [
    // the two of the opening view: one at each edge, the middle left bare for the hero
    [sh([[-140, 584], [-92, 542], [-44, 520], [-4, 524], [20, 568], [70, 582], [126, 560], [166, 558], [188, 594], [270, 614], [350, 624]], dx), {seed: 9.9, foot: 630, tone: .82, fade: 100, x0: dx - 150, x1: dx + 380, lost: 'right', k: .95, trees: 1}, [[-60, 3], [140, 2]]],
    [sh([[1430, 664], [1462, 612], [1490, 566], [1516, 544], [1546, 502], [1572, 498], [1590, 560], [1640, 600], [1700, 640]], dx), {seed: 4.2, foot: 642, tone: .85, fade: 150, x0: dx + 1410, x1: dx + 1720, k: .95, trees: 1}, [[1530, 3]]],
    // a low outcrop alone in the open
    [[[1240, 652], [1290, 624], [1322, 600], [1350, 596], [1362, 628], [1420, 650]], {seed: 21.3, foot: 648, tone: .7, fade: 60, x0: 1220, x1: 1440, k: .8, trees: 0, accent: .5}, [[1332, 2]]],
    // a long back with a notch, before the town
    [[[2190, 660], [2236, 622], [2262, 574], [2300, 560], [2316, 596], [2350, 586], [2374, 540], [2404, 532], [2420, 590], [2470, 640]], {seed: 23.9, foot: 640, tone: .8, fade: 110, x0: 2170, x1: 2490, k: .95, trees: 1}, [[2290, 2], [2390, 3]]],
    // behind the town, to close the field
    [[[3080, 650], [3130, 600], [3160, 540], [3200, 500], [3232, 492], [3250, 560], [3300, 580], [3336, 536], [3372, 528], [3390, 600], [3470, 640], [3560, 650]], {seed: 27.1, foot: 640, tone: .85, fade: 150, x0: 3060, x1: 3580, k: 1, trees: 2}, [[3180, 3], [3350, 2]]],
    // far to the left, behind where the warband starts
    [[[-40, 640], [20, 600], [60, 560], [96, 552], [112, 600], [170, 640]], {seed: 29.4, foot: 640, tone: .75, fade: 90, x0: -60, x1: 190, lost: 'right', k: .9, trees: 1}, [[70, 2]]],
  ];
  for (const [pts, o, pines] of hills) { const rf = rock(L, pts, o), off = pts[0][0] > 1000 || o.seed < 5 ? 0 : 0;
    for (const [x, n] of pines) for (let i = 0; i < n; i++) { const xx = (o.seed === 9.9 || o.seed === 4.2 ? dx : 0) + x + C.R(-22, 22); pine(L, xx, rf(xx) + C.R(2, 8), C.R(15, 28), C, C.R(.6, .8)) } }
  town(L, C, 2520, 3040, [[2716, 1.15], [2930, .8]]);
  for (const [x, y, rx, ry, d] of [[dx + 1510, 640, 130, 16, .7], [dx + 90, 630, 260, 20, .9], [1330, 650, 110, 12, .8], [2330, 646, 170, 16, .8], [3300, 646, 250, 18, .85], [60, 646, 120, 12, .8]]) cutMist(L, C, x, y, rx, ry, d);
});

/* ---------- 4. mist, and the ground the battle is fought on, for the whole length of the world ---------- */
// The ground is never a ruled line and never a wash. It is dry strokes with gaps, in stretches: a heavy pull, lighter
// ones beside it at other heights, then bare paper. Below it the paper is empty but for a long dry pull now and then.
add('ground', L => {
  const C = chance(9), x0 = -40, x1 = widthOf(1) + 40;
  let x = x0;
  while (x < x1) { const rx = C.R(160, 330); L.blot(x + rx * .5, C.R(656, 688), rx, C.R(16, 36), {pig: 'white', dens: C.R(.3, .6), rim: 0, soft: .92, rough: .32, freq: .006, gran: 0}); x += rx * C.R(.9, 2.2) }
  const drag = (x, y, len, w, load, dry = .42) => { const tilt = C.R(-.025, .035) * len; return L.stroke([[x, y + C.R(-1, 1), w * .3], [x + len * C.R(.3, .45), y + tilt * .4 + C.R(-1.5, 1.5), w], [x + len * .8, y + tilt * .8 + C.R(-1, 2), w * .6], [x + len, y + tilt + C.R(-1, 2), w * .15]],
    {load, dry, dry1: C.R(.78, .93), dryPow: C.R(.7, 1.1), streak: .8, rag: .32, pool: 0}) };
  x = x0;
  while (x < x1) {
    const len = C.R(110, 290), gy = GROUND + C.R(1, 10);
    drag(x, gy, len, C.R(3.4, 5.4), C.R(.36, .5));
    if (C.rnd() < .75) drag(x + len * C.R(.1, .5), gy + C.R(5, 9), len * C.R(.4, .8), C.R(1.8, 3), C.R(.26, .38), .5);
    if (C.rnd() < .5) drag(x + len * C.R(.3, .8), gy - C.R(3, 6), len * C.R(.3, .6), C.R(1.2, 2.2), C.R(.26, .4), .5);
    if (C.rnd() < .35) for (let i = 0, n = 1 + Math.floor(C.R(0, 3)); i < n; i++) L.blot(x + C.R(0, len), GROUND + C.R(12, 24), C.R(1.2, 2.8), C.R(.8, 1.6), {dens: C.R(.26, .42), rim: .4, soft: .3, rough: .2});
    if (C.rnd() < .3) for (let i = 0, n = 2 + Math.floor(C.R(0, 3)), tx = x + C.R(0, len); i < n; i++) leaf(L, tx + C.R(-9, 9), GROUND + C.R(4, 9), C.R(8, 18), C.R(-.6, .6), C, {load: .46, w: .5});
    x += len + (C.rnd() < .3 ? C.R(120, 260) : C.R(20, 110));                          // now and then a long bare stretch
  }
  x = x0 + C.R(100, 400);
  while (x < x1) { const len = C.R(160, 340); drag(x, C.R(780, 850), len, C.R(2.2, 3.4), C.R(.16, .27), .56); x += len + C.R(260, 640) }
});

/* ---------- 5. in front of everything: rock and reeds in the wettest, darkest ink. Clusters far apart and unequal,
   never taller than 180 above the bottom edge, so they frame the field and do not hide it for long. ---------- */
add('front', L => {
  const C = chance(17), w = widthOf(1.4);
  const cluster = (cx, dir, big) => {
    if (big) {
      const base = dir > 0 ? [[-200, 842], [-150, 806], [-100, 800], [-70, 828], [-10, 846], [42, 838], [70, 868], [140, 900]] : [[-150, 900], [-90, 872], [-48, 846], [0, 840], [30, 802], [80, 790], [110, 820], [140, 850], [200, 880]];
      const pts = base.map(([x, y]) => [cx + x * C.R(.9, 1.15), y + C.R(-6, 8)]), rf = ridgeOf(pts, cx * .013, 6), a = pts[0][0] - 10, b = pts[pts.length - 1][0] + 10;
      L.mountain(x => rf(x) + 5 + (fbm(x * .05, 2, 2) - .5) * 12, {dens: .7, fade: 130, pow: .6, edge: .3, blotch: .9, x0: a, x1: b, gran: .9, tide: .6, feather: 30});
      L.mountain(rf, {dens: .6, fade: 90, pow: .8, edge: .5, blotch: .9, x0: a, x1: b, feather: 30, mod: x => smooth(.1, .6, slope(rf, x, 8))});
      let x = a + 10;
      while (x < b - 10) { const len = C.R(40, 100), p = []; for (let u = 0; u <= len; u += 6) p.push([x + u, rf(x + u) + .5, 2.6 * (.4 + .9 * Math.sin(Math.PI * Math.min(1, u / len * 1.2 + .05)))]); L.stroke(p, {load: 1.15, dry: C.R(0, .2), dry1: C.R(.4, .7), streak: .5, rag: .2}); x += len + C.R(4, 22) }
      x = a + 20;
      while (x < b - 20) { if (slope(rf, x) > .25) { const len = C.R(26, 60), ww = C.R(4, 8); L.stroke([[x, rf(x) + 4, ww * .5], [x + len * .1, rf(x) + 4 + len * .4, ww], [x + len * .3, rf(x) + 4 + len, ww * .2]], {load: 1.0, dry: .2, dry1: .85, side: -.7, streak: .85, rag: .3}) } x += C.R(18, 40) }
    }
    const groups = big ? [[-130, 5, 140, 818], [-60, 5, 165, 836], [40, 4, 105, 858], [120, 2, 60, 890]] : [[-40, 4, 110, 866], [20, 3, 70, 884], [70, 2, 50, 892]];
    for (const [gx, n, h, base] of groups) for (let i = 0; i < n; i++) leaf(L, cx + dir * gx + C.R(-16, 16), base + C.R(0, 14), h * C.R(.5, 1.05), C.R(-.42, .42) + dir * .08, C, {load: 1.12, w: 1.5});
    if (big) for (const gx of [-110, -40]) L.stroke([[cx + dir * gx, C.R(700, 716), .8], [cx + dir * gx + C.R(-3, 3), 694, 3.2], [cx + dir * gx + C.R(-5, 5), 680, .5]], {load: 1.05, dry: .3, dry1: .7, streak: .6, pool: 0});
  };
  // the two of the opening view first (they sit in its bottom corners), then on along the field
  const o = at('front');
  for (const [u, dir, big] of [[o + 60, 1, true], [o + 1400, -1, true], [o - 900, -1, false], [o + 2360, 1, false], [o + 3150, -1, true], [o + 4300, 1, true], [o + 5000, -1, false], [o + 5900, 1, true], [o + 6800, -1, false], [o + 7300, -1, true]]) if (u > -200 && u < w + 200) cluster(u, dir, big);
});

/* ---------- bake ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t00 = performance.now();
  for (const tone of TONE_ARG === 'all' ? Object.keys(TONES) : [TONE_ARG]) {
    const T = setTone(tone), out = join(root, 'baked', tone);
    mkdirSync(out, {recursive: true});
    for (const sh of sheets) {
      const t0 = performance.now(), w = widthOf(sh.p), L = new Layer(w, sh.y1 - sh.y0, sh.s, 0, -sh.y0); sh.paint(L, T);
      await L.image().webp({quality: 88, alphaQuality: 90, effort: 4}).toFile(join(out, sh.name + '.webp'));
      console.log(`${tone}/${sh.name} ${L.W}x${L.H} ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
    if (!ONLY) await paper(VIEW, H, 1).jpeg({quality: 92}).toFile(join(out, 'paper.jpg'));
  }
  writeFileSync(join(root, 'baked', 'scene.json'), JSON.stringify({view: [VIEW, H], ground: GROUND, world: WORLD, margin: MARGIN, u0: U0,
    layers: Object.entries(LAYERS).map(([name, l]) => ({name, p: l.p, y0: l.y0, y1: l.y1, w: widthOf(l.p)})),
    tones: Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, {paper: v.paper, ink: v.ink}]))}, null, 1));
  console.log(`total ${((performance.now() - t00) / 1000).toFixed(1)} s`);
}
