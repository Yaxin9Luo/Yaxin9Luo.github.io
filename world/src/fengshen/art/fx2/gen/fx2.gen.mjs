// node world/src/fengshen/art/fx2/gen/fx2.gen.mjs
// The second set of paint marks. Every cell is one or a few real strokes laid with PaintSim, lit by its lamp from the
// upper left, and packed into ../baked/fx2.webp (2 px a unit) and ../baked/fx2-big.webp (1 px a unit: the strokes of
// the boon bursts, which cross the whole screen), with ../baked/fx2.json. ../review/_atlas*.png shows them on paper.
//
// A cell is painted round its pivot at (0, 0), y down. A stroke that is drawn on in time is painted so that it
// travels along one axis of its cell: 'x' (left to right), 'up' or 'down'; the page reveals it by widening a
// rectangle along that axis, so the stroke appears the way the brush laid it.
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {P, chance} from '../../../../board/baked/kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(join(root, '../../../../package.json'))('sharp');
const {arc, spline, clamp} = P.util;

const define = {
  materials: {
    pigment: {base: 'gouache', note: 'mineral colour in glue: opaque, matte, laid once', body: 1.0, ridges: .2, grain: .05, level: .25, gloss: .04, dry: .3, reach: 0, open: .1, bury: .8},
    thick: {base: 'gouache', note: 'the same, loaded: stands up from the paper', body: 1.7, ridges: .24, level: .15, gloss: .05, dry: .2, reach: 0, open: .05, bury: .95},
    scumble: {base: 'gouache', note: 'almost dry: catches the tooth', body: .35, opacity: .8, ridges: .1, grain: .12, gloss: .02, dry: .5, reach: 0, open: 0},
    chalk: {base: 'charcoal', note: 'gone almost dry: it only catches the tooth of the paper (飞白)', opacity: .8, dry: 1.0, charge: .62},
    wash: {base: 'gouache', note: 'ink let down with water', body: .12, opacity: .5, ridges: .05, grain: .14, gloss: 0, dry: .55, reach: 0, open: 0, bury: .2},
    wet: {base: 'gouache', note: 'colour with much water in it: runs long, lies flat, a little shine', body: .55, ridges: .07, grain: .02, level: .85, gloss: .22, sharp: .5, dry: .04, reach: 0, open: .1, bury: .6},
    metal: {base: 'shell gold', note: 'powdered bronze in glue', body: .5, ridges: .1, level: .5, gloss: .5, sharp: .5, metal: .7, dry: .08, reach: 0, bury: .8, flake: {amount: .15, hue: 40, spread: .05, chroma: .4, size: .4, sparkle: .6, sheen: 0}},
    heavy: {base: 'gouache', note: 'ink ground thick: a slab', body: 2.2, ridges: .3, level: .1, gloss: .1, dry: .12, reach: 0, open: .05, bury: 1},
  },
  brushes: {
    big: {base: 'round', note: 'a large pointed brush, fully loaded: swells and thins with the hand', clump: 3, streak: 1.1, wobble: .25, var: .06},
    cloth: {base: 'flat', note: 'a broad flat brush, streaky', clump: 3, streak: 1.2, rag: 4, wobble: .25, taper: .4},
    blunt: {base: 'flat', note: 'a worn flat brush: square ends', clump: 4, streak: 1.0, rag: 7, wobble: .5, taper: .15},
    full: {base: 'filbert', note: 'a full filbert', clump: 4, streak: .7, wobble: .2},
    drag: {base: 'dry', note: 'a stiff dry brush', streak: 1.7, wobble: .6},
    dab: {base: 'round', note: 'a round, pressed and lifted', wobble: .2, clump: 4, streak: .4},
    line: {base: 'liner', note: 'a rigger', reach: 0, wobble: .15},
    rule: {base: 'liner', note: 'a rigger drawn fast and straight', reach: 0, wobble: 0, var: .05},
  },
};
const LAMP = {base: 'raking', relief: .75, contrast: .36, shadow: .12, cavity: .06};
const GROUND = color => ({kind: 'paper', color, tooth: .24, vary: 0, gloss: 0});

// the palette of ART-DIRECTION section 4, each as the two tones a brush carries (lit side warmer, shaded cooler)
export const PAINT = {
  red: ['#B8321F', '#9A2616'], redHot: ['#C8402A', '#B8321F'], redDeep: ['#8E2417', '#701A10'],
  white: ['#F4EEDF', '#E9E1CE'], ink: ['#1B1512', '#35302B'], inkMid: ['#35302B', '#6B645C'], dust: ['#6B645C', '#857E73'],
  gold: ['#B08A3C', '#8E6D2C'], goldHi: ['#C6A04E', '#B08A3C'],
  blue: ['#2F4F7A', '#26426A'], blueHi: ['#48698F', '#2F4F7A'],
  green: ['#3F7D6A', '#346A59'], greenHi: ['#55907C', '#3F7D6A'],
  ochre: ['#A07C46', '#86673A'],
};
// Three sheets, each at the resolution its strokes need at game size (the game shows a world unit at 0.74 to 0.84 CSS px,
// so 1.5 to 1.7 device px on a dense screen):
//   main  1.5 px a unit  loaded strokes: their edges and bristle marks are seen
//   soft  1 px a unit    dry-brush twins, dust, scuffs, streaks: broken speckle that is on screen while it thins
//   big   0.75 px a unit the strokes of the boon bursts, which cross the screen in under a second
const pages = {main: {scale: 1.5, w: 1500, q: 82, cells: []}, big: {scale: .75, w: 1900, q: 78, cells: []}, soft: {scale: 1, w: 1500, q: 78, cells: []}};
const PAGE_NO = {main: 0, big: 1, soft: 2}, FILE = {main: 'fx2.webp', big: 'fx2-big.webp', soft: 'fx2-soft.webp'};
const SOFT = /(_dry$)|^(thud|scuff|puff|blot|streak|tine_(red|ink)|ring_ink)(_\d+)?$/, UNUSED = /^(tine_white|loop_ink)/;
/** box: [x0, y0, x1, y1] round the pivot; axis: 'x' | 'up' | 'down' | '' */
function cell(name, box, axis, paint, page = 'main') { if (UNUSED.test(name)) return; if (page === 'main' && SOFT.test(name)) page = 'soft';
  const even = v => Math.ceil(v / 4) * 4;      // sizes in fours, so that every cell starts on a whole pixel at 1.5 and 0.75 px a unit
  pages[page].cells.push({name, box, axis, paint, w: even(box[2] - box[0]), h: even(box[3] - box[1]), px: -box[0], py: -box[1]}) }
const strokeAt = (x, y, ang, len, curv = 0, n = 6) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);
const pts = (f, n = 14) => Array.from({length: n + 1}, (_, i) => f(i / n));
const off = (path, d) => path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d] });
const part = (path, a, b) => path.slice(Math.round(a * (path.length - 1)), Math.round(b * (path.length - 1)) + 1);
const RISE = [.03, .06, .1, .16, .25, .37, .52, .7, .88, 1, 1, .82];      // a blow: thin where the swing began, loaded where it lands

/* =================================================================== the strike: 撇, one falling stroke
   The brush lands loaded (a pressed head), the hand changes its weight twice on the way, and the hair runs dry: the last
   third is 飞白, broken, and goes on a little past where the hand stopped. 150 long from the pivot along +x, bowed upward;
   the page turns it onto the axe's path, so that the dry tail ends on the foe. It is never one width.
   Each element has its own stroke for the same blow, not the same stroke in another colour. */
export const CUT_LEN = 150, CUT_BOW = 26;
const CUT = pts(t => [CUT_LEN * t, -CUT_BOW * Math.sin(Math.PI * Math.pow(t, .8))], 18);
const FALL = [.5, 1, .96, .72, .8, .6, .44, .5, .33, .22, .12, .05];      // the pressure of the hand along it
const CUT_BOX = [-26, -70, 196, 44];
const tailOf = (st, c, w = 10) => {     // what the dry hair leaves beyond the stop
  st('chalk', 'drag', part(CUT, .5, 1).concat([[CUT_LEN + 16, 5], [CUT_LEN + 30, 12]]), {w, c, a: .9, pr: [.2, .8, 1, .7, .5, .3, .12]});
  st('chalk', 'drag', [[CUT_LEN * .72, 12], [CUT_LEN + 12, 20]], {w: w * .5, c, a: .8, pr: [.5, 1, .4, .1]});
};
for (const [tone, main, hot, deep] of [['red', 'red', 'redHot', 'redDeep'], ['ink', 'ink', 'inkMid', 'ink']]) {
  cell(`cut_${tone}`, CUT_BOX, 'x', (st) => {
    st('pigment', 'big', CUT, {w: 31, c: PAINT[main], pr: FALL, load: 150});
    st('thick', 'dab', [[-9, 4], [0, -2], [13, -9]], {w: 19, c: PAINT[deep], pr: [.5, 1, .5]});                                   // the pressed head: 顿
    st('thick', 'full', off(part(CUT, .04, .45), -3), {w: 9, c: PAINT[hot], pr: [.5, 1, .8, .4, .1]});                            // the load, where the brush was fullest
    tailOf(st, PAINT[deep]);
  });
  cell(`cut_${tone}_dry`, CUT_BOX, 'x', (st) => {
    st('chalk', 'big', CUT, {w: 27, c: PAINT[deep], a: .9, pr: FALL});
    st('scumble', 'drag', off(part(CUT, .02, .4), -2), {w: 8, c: PAINT[main], a: .8, pr: [.5, 1, .6, .2]});
  });
}
cell('cut_white', [-26, -82, 196, 40], 'x', (st) => st('scumble', 'drag', off(part(CUT, .08, .8), -13), {w: 6, c: PAINT.white, a: .95, pr: [.6, 1, .8, .5, .25, .1]}));
cell('cut_line', CUT_BOX, 'x', (st) => {      // the ink that runs ahead of the colour: a hair, and a dry drag under the heavy head
  st('pigment', 'line', off(CUT, 9), {w: 2.2, c: PAINT.ink, pr: [.6, 1, .9, .7, .5, .3, .15]});
  st('chalk', 'drag', off(part(CUT, 0, .5), 13), {w: 11, c: PAINT.ink, a: .7, pr: [.5, 1, .7, .3, .1]});
});
// 火: the stroke is itself a flame: a hot core that wavers, and tongues that leave its upper edge and lick back the way it came
for (const dry of [0, 1]) cell(dry ? 'cut_fire_dry' : 'cut_fire', [-50, -92, 196, 44], 'x', (st, {R}) => {
  const wav = pts(t => [CUT_LEN * t, -CUT_BOW * Math.sin(Math.PI * Math.pow(t, .8)) + 5 * Math.sin(t * 17) * (1 - t)], 18);
  if (dry) { st('chalk', 'big', wav, {w: 22, c: PAINT.redDeep, a: .9, pr: FALL}); }
  else { st('chalk', 'drag', off(part(wav, 0, .6), 12), {w: 10, c: PAINT.ink, a: .7, pr: [.5, 1, .6, .2]});
    st('pigment', 'big', wav, {w: 25, c: PAINT.red, pr: FALL, load: 150}); }
  [.06, .22, .4, .58, .76].forEach((t, i) => { const p = wav[Math.round(t * 18)], l = [44, 54, 46, 34, 24][i] * R(.9, 1.1), w = [12, 13, 11, 9, 7][i];
    const q = spline([[p[0], p[1] - 4], [p[0] - l * .28, p[1] - l * .5], [p[0] - l * .62 + R(-4, 4), p[1] - l * .8], [p[0] - l * .9, p[1] - l * 1.02]], 6);
    st(dry ? 'chalk' : 'pigment', 'big', q, {w, c: PAINT[dry || i % 2 ? 'redDeep' : 'red'], a: dry ? .85 : 1, pr: [.8, 1, .7, .45, .22, .07]});
    if (!dry) st('thick', 'dab', part(q, 0, .45), {w: w * .4, c: PAINT.redHot, pr: [1, .6, .15]}); });
  if (!dry) { st('thick', 'full', off(part(wav, .02, .5), -2), {w: 9, c: PAINT.redHot, pr: [.6, 1, .8, .4, .1]}); st('scumble', 'drag', part(wav, .04, .34), {w: 4, c: PAINT.white, a: .95, pr: [.5, 1, .4]}); tailOf(st, PAINT.redDeep, 8); }
});
// 水: long wet lines: three of them side by side, each finding its own way, pooled where they began, running on past the stop
cell('cut_water', [-26, -78, 232, 56], 'x', (st, {R}) => {
  [[0, 11, 1.2, 0], [-12, 6, 1.06, 1.7], [11, 4.4, .92, 3.4]].forEach(([d, w, len, ph], i) => {
    const p = pts(t => { const u = t * len; return [CUT_LEN * u + (i ? 10 : 0), -CUT_BOW * Math.sin(Math.PI * Math.pow(Math.min(1, u), .8)) + d + 5 * Math.sin(u * 11 + ph) * (.3 + u * .7) + (u > 1 ? (u - 1) * 60 : 0)] }, 20);
    st('wet', 'dab', p, {w, c: PAINT[i === 1 ? 'blueHi' : 'blue'], pr: [.7, 1, .95, .9, .85, .9, .8, .7, .6, .5, .34, .16]});
  });
  st('wet', 'dab', [[-8, 3], [2, -2], [12, -5]], {w: 17, c: PAINT.blue, pr: [.5, 1, .5]});                                       // the pool at the start
  st('wet', 'line', off(part(CUT, .05, .6), -3), {w: 2, c: PAINT.blueHi, pr: [.5, 1, .6, .2]});
  st('pigment', 'line', off(part(CUT, 0, .5), 17), {w: 1.6, c: PAINT.ink, pr: [.6, 1, .3]});
});
// 木: a stem that splits, and splits again, on its way down
for (const dry of [0, 1]) cell(dry ? 'cut_wood_dry' : 'cut_wood', [-26, -84, 214, 64], 'x', (st, {R}) => {
  const mat = dry ? 'chalk' : 'pigment', a = dry ? .85 : 1, at = t => CUT[Math.round(t * 18)];
  if (!dry) st('pigment', 'line', off(CUT, 7), {w: 2, c: PAINT.ink, pr: [.7, 1, .8, .5, .2]});
  st(mat, 'big', CUT, {w: 19, c: PAINT.green, a, pr: [.6, 1, .9, .75, .7, .56, .46, .36, .28, .2, .12, .05]});
  for (const [t, dx, dy, w, c] of [[.3, 74, -34, 9, 'green'], [.46, 80, 30, 8, 'greenHi'], [.64, 62, -22, 6.5, 'greenHi'], [.78, 56, 26, 5.5, 'green']]) { const p = at(t), q = spline([p, [p[0] + dx * .5, p[1] + dy * .34], [p[0] + dx, p[1] + dy + R(-4, 4)]], 6);
    st(mat, 'dab', q, {w, c: PAINT[c], a, pr: [.9, 1, .7, .4, .18, .05]});
    if (!dry && w > 7) { const m = q[3]; st('pigment', 'dab', [m, [m[0] + 18, m[1] + (dy < 0 ? 12 : -12)], [m[0] + 32, m[1] + (dy < 0 ? 16 : -18)]], {w: 4, c: PAINT.greenHi, pr: [.9, .6, .15]}) } }
  if (!dry) st('thick', 'dab', [[-7, 3], [2, -2], [16, -8]], {w: 12, c: PAINT.greenHi, pr: [.5, 1, .4]});
});
// 金: not a curve at all: one thin straight bright line along the chord of the blow and on past it, a hair of white beside it
cell('cut_metal', [-40, -14, 250, 14], 'x', (st) => {
  st('metal', 'rule', [[-30, 0], [236, 0]], {w: 5.4, c: PAINT.goldHi, pr: [.2, .9, 1, 1, 1, .95, .8, .5, .2]});
  st('pigment', 'rule', [[-6, -3.8], [170, -3.8]], {w: 1.5, c: PAINT.white, pr: [.4, 1, 1, .4]});
  st('pigment', 'rule', [[10, 3.6], [120, 3.6]], {w: 1.1, c: PAINT.ink, pr: [.8, 1, .3]});
  st('metal', 'rule', [[150, 7], [226, 7]], {w: 2, c: PAINT.gold, pr: [.2, 1, .3]});
});
// 土: short, blunt and dark: the side of a worn flat brush, ochre caught on its edge, clods where it ends
for (const dry of [0, 1]) cell(dry ? 'cut_earth_dry' : 'cut_earth', [-10, -76, 196, 50], 'x', (st, {R}) => {
  const p = part(CUT, .3, 1);
  if (dry) { st('chalk', 'blunt', p, {w: 30, c: PAINT.inkMid, a: .9, pr: [.8, 1, .9, .7, .5]}); return }
  st('chalk', 'blunt', off(p, 20), {w: 26, c: PAINT.inkMid, a: .8, pr: [.3, .9, 1, .7, .4]});
  st('heavy', 'blunt', p, {w: 30, c: PAINT.ink, pr: [.9, 1, 1, .96, .8, .6]});
  st('heavy', 'big', off(part(CUT, .22, .8), 15), {w: 22, c: PAINT.ink, pr: [.5, 1, .9, .6, .3]});
  st('chalk', 'blunt', off(part(CUT, .1, .5), -6), {w: 22, c: PAINT.ink, a: .85, pr: [.2, .6, 1, 1]});
  st('scumble', 'drag', off(part(CUT, .34, .9), -13), {w: 8, c: PAINT.ochre, a: .95, pr: [.7, 1, .8, .5, .2]});
  for (let i = 0; i < 5; i++) st('heavy', 'blunt', strokeAt(CUT_LEN + R(4, 34), R(-12, 26), R(-.6, .6), R(6, 12), 0, 2), {w: R(6, 11), c: PAINT[i % 2 ? 'ochre' : 'ink'], pr: [1, 1]});
});
// the counter-stroke: 钩, a hook flicked back off the stop. Pressed at the pivot, then up and away.
for (let v = 0; v < 2; v++) for (const [tone, c] of [['red', 'redDeep'], ['ink', 'ink'], ['gold', 'gold']]) cell(`hook_${tone}_${v}`, [-14, -56, 74, 18], 'x', (st, {R}) => {
  st('thick', 'dab', spline([[-2, 2], [10, 5], [26, -2 + R(-2, 2)], [44, -22], [56 + R(-4, 6), -44]], 6), {w: 12, c: PAINT[c], pr: [.6, 1, .9, .6, .35, .16, .05]});
});

/* =================================================================== the sweep: 蚕头雁尾, the long level stroke of clerical script
   A pressed head, a body that dips like a wave, and a tail that swells and is flicked up. 300 long. */
const HENG = pts(t => [300 * t - 8 * Math.exp(-t * 40), 10 * Math.sin(t * 5.4 + .4) * (1 - t * .5) - 16 * Math.pow(Math.max(0, t - .7) / .3, 1.6)], 18);
const HENG_PR = [1, .8, .5, .4, .36, .36, .4, .46, .54, .66, .8, .94, 1, .9, .66, .4, .18, .05];
cell('heng_red', [-30, -90, 330, 40], 'x', (st) => {
  st('pigment', 'big', HENG, {w: 28, c: PAINT.red, pr: HENG_PR});
  st('thick', 'dab', [[-10, -3], [2, 2], [16, 3]], {w: 17, c: PAINT.redDeep, pr: [.8, 1, .4]});               // the silkworm head
  st('thick', 'full', off(part(HENG, .55, .92), -3), {w: 9, c: PAINT.redHot, pr: [.1, .6, 1, .9, .5, .15]});  // the load in the goose tail
});
cell('heng_red_dry', [-30, -90, 330, 40], 'x', (st) => {
  st('chalk', 'big', HENG, {w: 26, c: PAINT.redDeep, a: .9, pr: HENG_PR});
  st('scumble', 'drag', off(part(HENG, .5, .95), -4), {w: 10, c: PAINT.red, a: .8, pr: [.2, .8, 1, .5, .15]});
});
cell('heng_white', [-30, -100, 330, 40], 'x', (st) => st('scumble', 'drag', off(part(HENG, .1, .9), -13), {w: 6, c: PAINT.white, a: .95, pr: [.2, .7, 1, .9, .8, .9, 1, .6, .2]}));
cell('heng_line', [-30, -90, 330, 46], 'x', (st) => {
  st('pigment', 'line', off(HENG, 11), {w: 2.4, c: PAINT.ink, pr: [.4, 1, .9, .8, .9, 1, .7, .3]});
  st('chalk', 'drag', off(part(HENG, .05, .8), 16), {w: 10, c: PAINT.ink, a: .6, pr: [.3, .8, 1, .8, .5, .2]});
});
// 水 (coldTide): the sweep as three long wet lines that run level, part, and pour down toward the ground at their end
cell('heng_water', [-30, -60, 340, 110], 'x', (st, {R}) => {
  [[0, 12, 0], [-13, 6, 1.9], [12, 5, 3.6]].forEach(([d, w, ph], i) => {
    const p = pts(t => [300 * t + (i ? 12 : 0), d + 8 * Math.sin(t * 9 + ph) * (.3 + .7 * t) + 80 * Math.pow(Math.max(0, t - .66) / .34, 2) * (1 - i * .16)], 22);
    st('wet', 'dab', p, {w, c: PAINT[i === 1 ? 'blueHi' : 'blue'], pr: [.7, 1, .95, .9, .85, .9, .8, .7, .6, .5, .36, .18]}) });
  st('wet', 'dab', [[-10, 3], [2, -1], [16, -3]], {w: 18, c: PAINT.blue, pr: [.5, 1, .5]});
  st('pigment', 'line', [[0, 20], [150, 24]], {w: 1.6, c: PAINT.ink, pr: [.6, 1, .3]});
});
// the fan the sweep opens into: the brush splits, and each tuft of hair draws its own pointed stroke
for (const dry of [0, 1]) cell(dry ? 'fan_red_dry' : 'fan_red', [-12, -92, 214, 92], 'x', (st, {R}) => {
  [[-.44, 118, 9], [-.21, 158, 12], [0, 186, 15], [.17, 150, 11], [.4, 108, 8]].forEach(([a, l, w], i) => {
    const p = spline([[0, i * 2 - 4], [l * .5 * Math.cos(a * .7), l * .5 * Math.sin(a * .7)], [l * Math.cos(a), l * Math.sin(a)]], 7);
    if (dry) st('chalk', 'big', p, {w: w * 1.2, c: PAINT.redDeep, a: .9, pr: [.8, 1, .8, .55, .35, .2, .08]});
    else { st('pigment', 'big', p, {w: w * 1.25, c: PAINT[i % 2 ? 'redDeep' : 'red'], pr: [.8, 1, .8, .55, .35, .2, .08]});
      st('chalk', 'drag', [[l * .7 * Math.cos(a), l * .7 * Math.sin(a)], [l * 1.16 * Math.cos(a * 1.1), l * 1.16 * Math.sin(a * 1.1)]], {w: w * .5, c: PAINT.redDeep, a: .85, pr: [.7, 1, .5, .15]}) }
  });
  if (!dry) { st('pigment', 'line', [[4, 8], [120, 34]], {w: 1.8, c: PAINT.ink, pr: [.8, 1, .3]}); st('pigment', 'line', [[4, -9], [130, -32]], {w: 1.6, c: PAINT.ink, pr: [.8, 1, .3]});
    st('thick', 'dab', [[2, -2], [40, -1]], {w: 8, c: PAINT.redHot, pr: [1, .7, .15]}) }
});
// what the sweep fans into: 飞白, tines of an almost dry brush. 190 long from the pivot.
for (const [tone, c, n] of [['red', 'red', 3], ['ink', 'ink', 2], ['white', 'white', 1]]) for (let v = 0; v < n; v++) cell(`tine_${tone}_${v}`, [-8, -22, 205, 22], 'x', (st, {R}) => {
  const l = R(150, 190), b = R(-10, 10);
  st(tone === 'white' ? 'scumble' : 'chalk', 'drag', spline([[0, 0], [l * .4, b * .5], [l * .8, b], [l, b * 1.3]], 6), {w: R(9, 14), c: PAINT[c], a: .95, pr: [.9, 1, .8, .6, .45, .3, .16, .05]});
  st('pigment', 'dab', [[0, R(-1, 1)], [R(16, 26), b * .1]], {w: R(5, 7), c: PAINT[tone === 'red' ? 'redDeep' : c], pr: [1, .7, .15]});
});

/* =================================================================== the leap strike: 竖, driven down and pressed at the foot
   Painted from 240 above the pivot down to it; the pivot is where it meets the ground. */
const SHU = pts(t => [7 * Math.sin(t * 2.6) * (1 - t), -240 + 240 * t]);
const SHU_PR = [.03, .08, .16, .26, .38, .5, .64, .78, .9, 1, 1, 1];
cell('slam_red', [-40, -256, 44, 20], 'down', (st) => {
  st('pigment', 'big', SHU, {w: 40, c: PAINT.red, pr: SHU_PR});
  st('thick', 'full', off(part(SHU, .5, 1), -5), {w: 14, c: PAINT.redHot, pr: [.1, .5, .9, 1, 1]});
  st('thick', 'dab', [[-15, -4], [0, 3], [17, -1]], {w: 15, c: PAINT.redDeep, pr: [.5, 1, .6]});                // the foot: 顿
});
cell('slam_red_dry', [-40, -256, 44, 20], 'down', (st) => {
  st('chalk', 'big', SHU, {w: 36, c: PAINT.redDeep, a: .9, pr: SHU_PR});
  st('scumble', 'drag', part(SHU, .6, 1), {w: 10, c: PAINT.red, a: .8, pr: [.2, .8, 1, .8]});
});
cell('slam_white', [-50, -256, 44, 20], 'down', (st) => st('scumble', 'drag', off(part(SHU, .2, .95), 19), {w: 8, c: PAINT.white, a: .95, pr: [.1, .5, .9, 1, .7]}));
cell('slam_line', [-50, -256, 54, 20], 'down', (st) => {
  st('pigment', 'line', off(SHU, -20), {w: 2.4, c: PAINT.ink, pr: [.2, .7, 1, 1, .8]});
  st('chalk', 'drag', off(part(SHU, .4, 1), -24), {w: 12, c: PAINT.ink, a: .65, pr: [.1, .5, .9, 1]});
});
// 木 (galeLeap): the slam as a stem driven down that roots where it lands: it splits both ways at the foot
cell('slam_wood', [-70, -256, 70, 24], 'down', (st, {R}) => {
  st('pigment', 'line', off(SHU, -12), {w: 2, c: PAINT.ink, pr: [.2, .7, 1, .8]});
  st('pigment', 'big', SHU, {w: 24, c: PAINT.green, pr: [.05, .14, .26, .4, .54, .68, .8, .9, 1, 1]});
  for (const [d, y, l, w] of [[-1, -70, 50, 9], [1, -96, 44, 8], [-1, -26, 60, 10], [1, -34, 56, 9]]) st('pigment', 'dab', spline([[d * 4, y], [d * l * .5, y + l * .4], [d * l, y + l * .56 + R(-4, 4)]], 6), {w, c: PAINT[d > 0 ? 'greenHi' : 'green'], pr: [.9, 1, .7, .4, .15, .05]});
  st('thick', 'dab', part(SHU, .7, 1), {w: 8, c: PAINT.greenHi, pr: [.2, .8, 1]});
});
// 土 (quake): the slam as a column of ink, blunt at both ends, ochre caught on its lit flank
cell('slam_earth', [-56, -230, 56, 22], 'down', (st, {R}) => {
  const p = part(SHU, .16, 1);
  st('chalk', 'blunt', off(p, 22), {w: 30, c: PAINT.inkMid, a: .8, pr: [.2, .7, 1, .8]});
  st('heavy', 'blunt', p, {w: 38, c: PAINT.ink, pr: [.5, .9, 1, 1, 1]});
  st('heavy', 'big', off(part(SHU, .5, 1), -16), {w: 26, c: PAINT.ink, pr: [.3, .9, 1, 1]});
  st('scumble', 'drag', off(part(SHU, .22, .94), 15), {w: 9, c: PAINT.ochre, a: .95, pr: [.3, 1, .8, .5]});
});
// the ring thrown along the ground, seen from the side: one half of a flat loop. It leaves the pivot both behind
// (above, thin) and in front (below, loaded) and closes 150 out. The page lays one half each way.
for (const [tone, c, c2] of [['ink', 'ink', 'dust'], ['red', 'red', 'redDeep'], ['green', 'green', 'greenHi'], ['ochre', 'ink', 'ochre']]) cell(`ring_${tone}`, [-6, -30, 172, 30], 'x', (st) => {
  const front = pts(t => [150 * Math.sin(t * Math.PI / 2), 12 * Math.cos(t * Math.PI / 2) + 2], 10), back = pts(t => [150 * Math.sin(t * Math.PI / 2), -13 * Math.cos(t * Math.PI / 2) - 1], 10);
  st('chalk', 'drag', back, {w: 7, c: PAINT[c2], a: .8, pr: [.5, .7, .8, .7, .5, .3]});
  st(tone === 'ink' ? 'chalk' : 'pigment', 'full', front, {w: tone === 'ochre' ? 17 : 12, c: PAINT[c], a: .95, pr: [.7, 1, 1, .9, .7, .5, .3, .12]});
  if (tone === 'ochre') st('scumble', 'drag', off(front, -5), {w: 6, c: PAINT.ochre, pr: [.4, 1, .8, .5, .2]});
});

/* =================================================================== break-through: 飞白, streaks torn off the horse */
for (let v = 0; v < 4; v++) cell(`streak_${v}`, [-8, -16, 232, 16], 'x', (st, {R}) => {
  const l = R(170, 220), mk = (y, w, c, a, mat = 'chalk') => st(mat, 'drag', [[0, y], [l * .5, y + R(-2, 2)], [l * R(.85, 1), y + R(-3, 3)]], {w, c: PAINT[c], a, pr: [.5, 1, .9, .7, .5, .3, .1]});
  if (v === 0 || v === 3) mk(R(-4, -2), R(8, 11), 'white', .95, 'scumble');
  mk(R(2, 5), v === 1 ? 11 : R(6, 9), v === 2 ? 'redDeep' : 'ink', .9);
  if (v === 2) st('pigment', 'line', [[6, -4], [l * .6, -5]], {w: 3, c: PAINT.red, pr: [.6, 1, .5]});
  if (v === 3 || v === 1) st('pigment', 'line', [[4, -8], [l * .7, -9]], {w: 1.8, c: PAINT.ink, pr: [.8, 1, .3]});
});

/* =================================================================== flame: 提 and 钩, a lick pressed at its root, rising, hooked at the tip
   The pivot is the root on the ground. It leans back (toward -x): the page mirrors it against the rider's way. */
function lick(st, R, h, w, c = ['red', 'redHot', 'redDeep'], base = true) {
  const lean = R(.2, .4) * h, ph = R(0, 3), sway = R(.09, .15) * h;
  const spine = pts(t => [-lean * t * t + sway * Math.sin(t * 4.2 + ph) * (1 - t) * t * 2.4, -h * t], 12);
  if (base) st('chalk', 'drag', [[-w * .9, 1], [0, 2], [w * .9, 0]], {w: w * .5, c: PAINT.ink, a: .8, pr: [.4, 1, .5]});                   // char under the colour
  st('pigment', 'dab', [[-w * .3, 0], [-w * .72, -h * .2], [-w * .7 - lean * .3, -h * R(.38, .5)]], {w: w * .55, c: PAINT[c[0]], pr: [.6, 1, .6, .25, .06]});   // a tongue behind
  st('pigment', 'big', spine, {w: w * 1.25, c: PAINT[c[0]], pr: [.55, .95, 1, .9, .74, .56, .4, .26, .14, .05]});
  st('pigment', 'dab', [[w * .3, 0], [w * .6, -h * .25], [w * .38, -h * .48], [w * .02, -h * R(.6, .7)]], {w: w * .7, c: PAINT[c[2]], pr: [.6, 1, .8, .5, .22, .06]});   // a tongue in front, darker
  st('thick', 'dab', part(off(spine, w * .06), 0, .5), {w: w * .46, c: PAINT[c[1]], pr: [.6, 1, .7, .3, .08]});
  st('scumble', 'drag', part(spine, .03, .3), {w: w * .24, c: PAINT.white, a: .95, pr: [.5, 1, .5, .1]});                                   // the heart of it, left as paper
  const tip = spine[spine.length - 1];
  st('pigment', 'dab', [[tip[0] - w * .1, tip[1] - h * .1], [tip[0] - w * .25, tip[1] - h * .17]], {w: w * .2, c: PAINT[c[0]], pr: [.9, .5]});   // a spark let go
}
for (let v = 0; v < 4; v++) cell(`lick_${v}`, [-40, -92, 30, 10], 'up', (st, {R}) => lick(st, R, R(58, 76), R(15, 19)));
for (let v = 0; v < 3; v++) cell(`lickS_${v}`, [-22, -46, 18, 8], 'up', (st, {R}) => lick(st, R, R(28, 36), R(9, 11)));
for (let v = 0; v < 2; v++) cell(`lickL_${v}`, [-78, -176, 56, 14], 'up', (st, {R}) => lick(st, R, R(130, 150), R(30, 36)));
// the burning stroke an ember blade leaves on the ground
cell('ember', [-10, -14, 140, 14], 'x', (st) => {
  st('chalk', 'drag', [[0, 3], [60, 5], [124, 3]], {w: 13, c: PAINT.ink, a: .85, pr: [.6, 1, .8, .4]});
  st('pigment', 'full', [[2, 0], [50, -2], [118, 0]], {w: 9, c: PAINT.redDeep, pr: [.9, 1, .8, .6, .3, .1]});
  st('thick', 'dab', [[4, -1], [40, -3]], {w: 5, c: PAINT.redHot, pr: [1, .6, .1]});
});

/* =================================================================== rally: 提, rising flicks in the banner's colours */
// a small pennant: a hair of ink for the pole, and the cloth a single flick streaming back from its top (提)
for (const [tone, c, c2] of [['red', 'red', 'redDeep'], ['white', 'white', 'white']]) for (let v = 0; v < 3; v++) cell(`ti_${tone}_${v}`, [-40, -70, 12, 8], 'up', (st, {R}) => {
  const h = R(46, 58), l = R(24, 32), d = R(4, 12);
  st('pigment', 'line', [[R(-1, 1), 2], [0, -h * .5], [R(-1, 1), -h]], {w: 2.2, c: PAINT.ink, pr: [1, .9, .8, .7]});
  const cloth = spline([[1, -h + 2], [-l * .4, -h + d * .2 - 3], [-l * .8, -h + d * .8], [-l, -h + d + R(-3, 3)]], 6);
  if (tone === 'white') st('pigment', 'line', off(cloth, -5), {w: 1.4, c: PAINT.ink, pr: [.8, 1, .5]});
  st('pigment', 'dab', cloth, {w: R(11, 14), c: PAINT[c], pr: [1, .95, .8, .6, .4, .2, .06]});
  st('pigment', 'dab', [[0, -h + 12], [-l * .45, -h + 15 + d * .4], [-l * .7, -h + 19 + d]], {w: 6, c: PAINT[c2], pr: [1, .7, .35, .1]});
});
cell('loop_ink', [-150, -26, 150, 26], '', (st) => {      // the ground line of the ring, a hair and a dry drag
  st('chalk', 'drag', pts(t => [140 * Math.cos(Math.PI * t), 17 * Math.sin(Math.PI * t)], 16), {w: 6, c: PAINT.dust, a: .8, pr: [.2, .8, 1, 1, .8, .2]});
  st('pigment', 'line', pts(t => [138 * Math.cos(Math.PI * (1 + t)), 16 * Math.sin(Math.PI * (1 + t))], 16), {w: 1.8, c: PAINT.inkMid, pr: [.2, .8, 1, .8, .2]});
});

/* =================================================================== impact: 点 pressed, and paint thrown from it */
for (let v = 0; v < 2; v++) cell(`core_${v}`, [-34, -34, 52, 34], '', (st, {R}) => {
  st('thick', 'dab', arc(-16, R(-4, 2), R(-.1, .2), 42, R(.1, .4), 7), {w: R(17, 21), c: PAINT.red, pr: [.5, 1, 1, .8, .5, .22, .06]});
  st('thick', 'dab', arc(0, -8, R(-.9, -.6), 28, -.3, 6), {w: 9, c: PAINT.redHot, pr: [.9, 1, .6, .3, .1]});
  st('thick', 'dab', arc(2, 5, R(.6, .9), 24, .3, 6), {w: 8, c: PAINT.redDeep, pr: [.9, 1, .6, .3, .1]});
  st('thick', 'dab', arc(-6, -3, -.3, 18, R(-.3, .3), 5), {w: 6, c: PAINT.white, pr: [1, .8, .4, .12]});
});
// thrown strokes: pressed where they leave, dry where they end. Along +x from the pivot.
for (const [tone, c, n, mat] of [['red', 'red', 4, 'pigment'], ['ink', 'ink', 2, 'pigment'], ['white', 'white', 2, 'scumble'], ['gold', 'goldHi', 2, 'metal'], ['blue', 'blue', 2, 'wet'], ['green', 'green', 2, 'pigment'], ['ochre', 'ochre', 2, 'pigment']]) for (let v = 0; v < n; v++) cell(`spoke_${tone}_${v}`, [-6, -16, 116, 16], 'x', (st, {R}) => {
  const l = [104, 58, 84, 44][v % 4] * R(.9, 1.1), b = R(8, 16) * (v % 2 ? 1 : -1), w = [13, 7, 9, 6][v % 4];
  st(mat, 'dab', spline([[2, 0], [l * .35, b * .2], [l * .7, b * .62], [l, b]], 6), {w, c: PAINT[c], pr: v % 2 ? [.9, 1, .7, .4, .2, .08] : [.3, .8, 1, .7, .4, .2, .06]});
  if (v % 4 !== 1) st('chalk', 'drag', [[l * .4, b * .3 + 2], [l * R(.95, 1.1), b * 1.15 + R(-2, 4)]], {w: w * .6, c: PAINT[tone === 'red' ? 'redDeep' : c], a: .8, pr: [.6, 1, .5, .15]});
  if (v % 4 === 0) st('pigment', 'dab', [[l + 6, b + 2], [l + 13, b + 4]], {w: 4, c: PAINT[c], pr: [1, .5]});
});
// ink under the colour: 泼墨, a thin wet blot with a spatter
for (let v = 0; v < 2; v++) cell(`blot_${v}`, [-64, -48, 84, 48], '', (st, {R}) => {
  for (let i = 0; i < 4; i++) st('chalk', 'full', strokeAt(R(-10, 24), R(-12, 12), R(-.6, .6), R(40, 80), R(-.5, .5), 6), {w: R(12, 22), c: PAINT[i % 2 ? 'inkMid' : 'dust'], a: R(.5, .75), pr: [.3, 1, .9, .5, .15]});
  for (let i = 0; i < 9; i++) { const a = R(-1.3, 1.3), d = R(26, 70); st('pigment', 'dab', arc(Math.cos(a) * d, Math.sin(a) * d * .7, a, R(3, 8), 0, 3), {w: R(1.6, 3.6), c: PAINT.ink, a: .85, pr: [1, .7, .2]}) }
});
// thrown drops: a head and a short tail behind it. They fly along +x.
for (const [tone, c, n, mat] of [['red', 'red', 4, 'thick'], ['ink', 'ink', 3, 'pigment'], ['white', 'white', 1, 'thick'], ['blue', 'blue', 3, 'wet'], ['green', 'green', 3, 'pigment'], ['gold', 'goldHi', 2, 'metal'], ['ochre', 'ochre', 2, 'thick']]) for (let v = 0; v < n; v++) cell(`drop_${tone}_${v}`, [-16, -7, 9, 7], '', (st, {R}) => {
  st(mat, 'dab', [[R(-13, -8), R(-1.5, 1.5)], [-3, 0], [3, 0]], {w: R(4.4, 7.4), c: PAINT[c], pr: [.2, .7, 1, .8]});
});
// leaves for wood, clods for earth: not drops, each its element's own small shape
for (let v = 0; v < 3; v++) cell(`leaf_${v}`, [-13, -8, 13, 8], '', (st, {R}) => {
  st('pigment', 'dab', [[-10, R(-1, 1)], [0, R(-2, 0)], [10, R(-1, 2)]], {w: R(6, 8), c: PAINT[v ? 'green' : 'greenHi'], pr: [.1, .8, 1, .7, .1]});
  st('pigment', 'line', [[-10, 0], [9, .5]], {w: 1.2, c: PAINT.ink, pr: [.8, 1, .4]});
});
for (let v = 0; v < 3; v++) cell(`clod_${v}`, [-10, -9, 10, 9], '', (st, {R}) => {
  st('heavy', 'blunt', [[-5, R(-1, 1)], [5, R(-1, 1)]], {w: R(8, 12), c: PAINT.ink, pr: [1, 1]});
  if (v !== 1) st('scumble', 'drag', [[-5, -3], [4, -3.5]], {w: 4, c: PAINT.ochre, pr: [1, .8]});
});
// what a blow leaves on the ground: flat, as the ground is seen
for (let v = 0; v < 3; v++) cell(`splat_${v}`, [-60, -24, 96, 24], '', (st, {R}) => {
  st('pigment', 'full', strokeAt(R(-6, 6), R(-2, 2), R(-.08, .08), R(54, 80), R(-.2, .2), 7), {w: R(10, 15), c: PAINT.redDeep, pr: [.3, .9, 1, .8, .5, .25, .08]});
  for (let i = 0; i < 6; i++) { const a = R(-.5, .5), d = R(26, 80); st('pigment', 'dab', arc(Math.cos(a) * d, Math.sin(a) * d * .5, a, R(5, 12), R(-.3, .3), 4), {w: R(2, 4.6), c: i % 2 ? PAINT.red : PAINT.redDeep, pr: [.9, 1, .5, .15]}) }
});

/* =================================================================== the shield block: 顿, a bar set against the blow */
cell('bar_ink', [-20, -44, 22, 44], '', (st) => {
  st('heavy', 'blunt', spline([[4, -36], [-3, -12], [-3, 12], [5, 36]], 6), {w: 15, c: PAINT.ink, pr: [.9, 1, 1, 1, .9]});
  st('scumble', 'drag', spline([[-8, -30], [-13, 0], [-8, 30]], 6), {w: 5, c: PAINT.white, pr: [.4, 1, .4]});
});
for (let v = 0; v < 2; v++) cell(`chips_${v}`, [-6, -44, 84, 44], 'x', (st, {R}) => {       // what springs back off the shield, fanned
  for (const a of [-.62, -.22, .16, .55]) { const l = R(36, 70), aa = a + R(-.1, .1); st('scumble', 'drag', [[6 * Math.cos(aa), 6 * Math.sin(aa)], [l * Math.cos(aa), l * Math.sin(aa)]], {w: R(4, 7), c: PAINT.white, a: .95, pr: [1, .8, .5, .2]});
    st('pigment', 'line', [[8 * Math.cos(aa), 8 * Math.sin(aa) + 2], [l * .7 * Math.cos(aa), l * .7 * Math.sin(aa) + 2]], {w: 1.6, c: PAINT.ink, pr: [1, .6, .2]}) }
});

/* =================================================================== dust, hooves, bodies: pale ink dragged dry */
for (let v = 0; v < 2; v++) cell(`thud_${v}`, [-105, -60, 105, 10], '', (st, {R}) => {
  for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) { const l = R(40, 84), r = R(.25, .7); st('chalk', 'full', spline([[dir * R(2, 10), -2], [dir * l * .4, -l * r * .2], [dir * l * .8, -l * r * .62], [dir * l, -l * r]], 6), {w: R(7, 12), c: PAINT.dust, a: R(.6, .9), pr: [.4, 1, .85, .55, .25, .08]}) }
  for (let i = 0; i < 9; i++) st('pigment', 'dab', strokeAt(R(-80, 80), -R(4, 40), R(-1.2, 1.2), R(3, 7), 0, 3), {w: R(1.6, 3.2), c: PAINT.ink, a: .8, pr: [1, .7, .2]});
});
for (let v = 0; v < 3; v++) cell(`scuff_${v}`, [-65, -18, 65, 18], '', (st, {R}) => {
  for (let i = 0; i < 3; i++) st('chalk', 'full', strokeAt(R(-14, 14), R(-6, 6), R(-.12, .12), R(50, 96), R(-.15, .15), 7), {w: R(5, 10), c: PAINT.dust, a: R(.6, .9), pr: [.3, 1, .9, .6, .35, .12]});
  for (let i = 0; i < 5; i++) st('pigment', 'dab', strokeAt(R(-50, 50), R(-10, 10), R(-.5, .5), R(3, 7), 0, 3), {w: R(1.6, 3), c: PAINT.ink, a: .8, pr: [1, .7, .2]});
});
for (let v = 0; v < 2; v++) cell(`puff_${v}`, [-76, -38, 14, 6], '', (st, {R}) => { for (const [x, y, w] of [[-8, -4, 9], [-26, -8, 11], [-46, -12, 8]]) st('chalk', 'full', strokeAt(x + R(-3, 3), y, -.35, w * 2.4, -.7, 5), {w, c: PAINT.dust, a: .7, pr: [.35, 1, .8, .45, .15]}) });
for (let v = 0; v < 2; v++) cell(`hoof_${v}`, [-16, -10, 16, 10], '', (st, {R}) => st('pigment', 'dab', pts(t => [11 * Math.cos(Math.PI * (.1 + .8 * t)) + R(-.5, .5), -3 + 6.5 * Math.sin(Math.PI * (.1 + .8 * t))], 8), {w: 5.5, c: PAINT.ink, a: .9, pr: [.3, .9, 1, 1, .9, .3]}));

/* =================================================================== an arrow striking: a tick and two splinters */
for (let v = 0; v < 2; v++) cell(`tick_${v}`, [-26, -18, 16, 18], '', (st, {R}) => {
  st('pigment', 'dab', [[-4, R(-1, 1)], [3, 0], [7, 2]], {w: 6, c: PAINT.ink, pr: [.5, 1, .4]});
  for (const a of [2.5, 3.6]) { const aa = a + R(-.25, .25), l = R(12, 20); st('pigment', 'line', [[4 * Math.cos(aa), 4 * Math.sin(aa)], [l * Math.cos(aa), l * Math.sin(aa)]], {w: 1.8, c: PAINT.inkMid, pr: [1, .6, .2]}) }
});

/* =================================================================== the death mark: one pressed dot of ink, and red that seeps from it */
for (let v = 0; v < 3; v++) cell(`death_${v}`, [-40, -16, 56, 16], 'x', (st, {R}) => {
  st('pigment', 'full', spline([[-6, R(1, 3)], [14, R(2, 5)], [R(34, 46), R(1, 5)]], 6), {w: R(8, 10), c: PAINT.redDeep, pr: [.8, 1, .7, .4, .2, .06]});
  st('heavy', 'dab', spline([[-22, -3], [-12, R(-1, 2)], [-2, 4]], 5), {w: R(11, 13), c: PAINT.ink, pr: [.3, 1, .9, .3]});
  st('pigment', 'line', [[-30, R(-5, -2)], [-14, -1]], {w: 2, c: PAINT.ink, pr: [.3, 1]});
});

/* =================================================================== the captain's horn: broken arcs that open away from the mouth */
[52, 86, 122].forEach((r, v) => cell(`horn_${v}`, [Math.round(r * .7 - 12), Math.round(-r * .72 - 8), Math.round(r + 16), Math.round(r * .72 + 8)], '', (st) => {
  const a = pts(t => [r * Math.cos(-.72 + 1.44 * t), r * Math.sin(-.72 + 1.44 * t)], 12);
  st('chalk', 'drag', a, {w: 9 + v * 2.5, c: PAINT.ink, a: .92, pr: [.1, .6, 1, 1, .9, 1, .6, .15]});
  st('pigment', 'dab', part(off(a, 7 + v), .25, .8), {w: 3.6, c: PAINT.green, pr: [.1, .8, 1, .7, .15]});
}));
cell('dot_green', [-14, -12, 16, 12], '', (st) => { st('thick', 'dab', [[-7, -2], [0, 1], [8, -1]], {w: 12, c: PAINT.green, pr: [.4, 1, .5]}); st('pigment', 'dab', [[-3, -3], [3, -2]], {w: 4, c: PAINT.greenHi, pr: [1, .4]}) });

/* =================================================================== water: long wet lines, a crest that curls, drips */
for (let v = 0; v < 3; v++) cell(`wave_${v}`, [-8, -18, 336, 18], 'x', (st, {R}) => {
  const ph = R(0, 6), l = R(290, 325), a = R(3, 6), p = pts(t => [l * t, a * Math.sin(t * R(7, 9) + ph) * (.4 + t * .6)], 16);
  st('wet', 'dab', p, {w: R(8, 11), c: PAINT.blue, pr: [.5, 1, 1, .95, .9, .9, .85, .8, .7, .55, .35, .15]});
  st('wet', 'line', off(part(p, .05, .7), -2.5), {w: 2.4, c: PAINT.blueHi, pr: [.3, 1, .9, .6, .2]});
});
for (let v = 0; v < 2; v++) cell(`crest_${v}`, [-30, -74, 74, 12], 'x', (st, {R}) => {
  const h = R(48, 60), p = spline([[-22, 2], [-4, -h * .5], [16, -h * .95], [38, -h], [54, -h * .72], [56, -h * .42], [46, -h * .3]], 6);
  st('wet', 'full', p, {w: R(15, 18), c: PAINT.blue, pr: [.5, .9, 1, 1, .85, .6, .4, .2]});
  st('wet', 'dab', off(part(p, .1, .6), 5), {w: 6, c: PAINT.blueHi, pr: [.3, 1, .8, .3]});
  st('scumble', 'drag', off(part(p, .45, .95), -8), {w: 6, c: PAINT.white, a: .95, pr: [.3, 1, .9, .5]});       // the lip, in paper white
  st('pigment', 'line', off(part(p, 0, .5), 10), {w: 1.8, c: PAINT.ink, pr: [.4, 1, .5]});
});
for (let v = 0; v < 2; v++) cell(`drip_${v}`, [-8, -4, 8, 60], 'down', (st, {R}) => {
  const l = R(34, 50);
  st('wet', 'dab', [[R(-1, 1), 0], [R(-1.5, 1.5), l * .5], [0, l]], {w: 3.2, c: PAINT.blue, pr: [.9, .7, .6, .8]});
  st('wet', 'dab', [[0, l - 2], [0, l + 4]], {w: 7, c: PAINT.blue, pr: [.7, 1, .7]});
});

/* =================================================================== wood: strokes that split and branch */
for (let v = 0; v < 3; v++) cell(`branch_${v}`, [-8, -84, 184, 44], 'x', (st, {R}) => {
  const l = R(140, 168), f1 = R(.3, .42), f2 = R(.55, .68), main = pts(t => [l * t, -16 * t + 7 * Math.sin(t * 5 + v)], 12), at = f => main[Math.round(f * 12)];
  const a = at(f1), b = at(f2), up = spline([a, [a[0] + 30, a[1] - 22], [a[0] + 62, a[1] - 36 + R(-6, 6)], [a[0] + R(84, 100), a[1] - R(50, 62)]], 6), dn = spline([b, [b[0] + 22, b[1] + 12], [b[0] + R(44, 58), b[1] + R(24, 34)]], 6);
  st('pigment', 'line', off(main, 5), {w: 2, c: PAINT.ink, pr: [.6, 1, .8, .5, .2]});
  st('pigment', 'dab', main, {w: R(11, 13), c: PAINT.green, pr: [.9, 1, .9, .8, .68, .55, .42, .3, .18, .08]});
  st('pigment', 'dab', up, {w: 8, c: PAINT.green, pr: [.8, 1, .8, .55, .3, .1]});
  st('pigment', 'dab', dn, {w: 6.5, c: PAINT.greenHi, pr: [.8, 1, .6, .25, .08]});
  const u = up[Math.round(up.length * .5)]; st('pigment', 'dab', spline([u, [u[0] + 16, u[1] + 2], [u[0] + R(30, 40), u[1] + R(6, 12)]], 5), {w: 4.6, c: PAINT.greenHi, pr: [.9, .8, .4, .1]});
  st('thick', 'dab', part(main, 0, .3), {w: 5, c: PAINT.greenHi, pr: [1, .6, .15]});
});

/* =================================================================== metal: thin, straight, bright */
for (let v = 0; v < 3; v++) cell(`edge_${v}`, [-6, -8, 318, 8], 'x', (st, {R}) => {
  const l = R(280, 310);
  st('metal', 'rule', [[0, 0], [l, 0]], {w: R(4.2, 5.2), c: PAINT.goldHi, pr: [.5, 1, 1, 1, 1, .9, .7, .35]});
  st('pigment', 'rule', [[l * .06, -3.4], [l * R(.7, .86), -3.4]], {w: 1.4, c: PAINT.white, pr: [.4, 1, 1, .5]});
  st('pigment', 'rule', [[l * .1, 3.2], [l * .5, 3.2]], {w: 1.1, c: PAINT.ink, pr: [.8, 1, .3]});
});
cell('edge_dry', [-6, -8, 318, 8], 'x', (st, {R}) => { for (const [a, b] of [[.04, .22], [.3, .52], [.6, .7], [.8, .9]]) st('metal', 'rule', [[300 * a, 0], [300 * b, 0]], {w: 3.4, c: PAINT.gold, pr: [.3, 1, .8, .2]}) });
cell('glint', [-22, -22, 22, 22], '', (st) => {
  st('metal', 'rule', [[0, -19], [0, 19]], {w: 3.4, c: PAINT.goldHi, pr: [.1, 1, .1]}); st('metal', 'rule', [[-14, 0], [14, 0]], {w: 3, c: PAINT.goldHi, pr: [.1, 1, .1]});
  st('pigment', 'rule', [[-1, -7], [-1, 7]], {w: 1.3, c: PAINT.white, pr: [.2, 1, .2]});
});

/* =================================================================== earth: heavy, blunt, dark */
for (let v = 0; v < 2; v++) cell(`slab_${v}`, [-12, -34, 172, 34], 'x', (st, {R}) => {
  const l = R(138, 156);
  st('heavy', 'blunt', [[0, R(-2, 2)], [l * .5, R(-3, 3)], [l, R(-2, 2)]], {w: R(38, 44), c: PAINT.ink, pr: [1, 1, 1, .96, .9]});
  st('scumble', 'drag', [[6, -15], [l * .8, -16 + R(-2, 2)]], {w: 9, c: PAINT.ochre, a: .95, pr: [.7, 1, .8, .4]});
  st('chalk', 'drag', [[l * .2, 22], [l * 1.02, 23]], {w: 8, c: PAINT.ochre, a: .8, pr: [.3, 1, .6]});
});
for (let v = 0; v < 3; v++) cell(`spike_${v}`, [-30, -132, 30, 10], 'up', (st, {R}) => {
  const h = R(88, 120), lean = R(-12, 12), p = [[0, 2], [lean * .4, -h * .5], [lean, -h]];
  st('heavy', 'big', p, {w: R(34, 40), c: PAINT.ink, pr: [.9, 1, .9, .76, .62, .5, .42, .36]});
  st('heavy', 'blunt', [[lean - 5, -h + 2], [lean + 5, -h - 1]], {w: 12, c: PAINT.ink, pr: [1, 1]});      // the top is broken off square, not drawn to a point
  st('scumble', 'drag', off(part(spline(p, 6), .05, .8), 9), {w: 6, c: PAINT.ochre, a: .95, pr: [.8, 1, .7, .3]});
  st('pigment', 'line', off(spline(p, 6), -4), {w: 1.6, c: PAINT.dust, pr: [.3, 1, .5]});
});

/* =================================================================== the thread of the feeding pigment (相生) */
for (const [tone, c] of [['red', 'red'], ['blue', 'blueHi'], ['green', 'green'], ['gold', 'goldHi'], ['ochre', 'ochre']]) cell(`thread_${tone}`, [-6, -10, 236, 10], 'x', (st, {R}) => {
  st(tone === 'gold' ? 'metal' : 'pigment', 'line', pts(t => [224 * t, 4 * Math.sin(t * 9 + 1)], 14), {w: 3, c: PAINT[c], pr: [.5, 1, .9, 1, .8, 1, .7, .3]});
});

/* =================================================================== the boon bursts: strokes that cross the screen (1 px a unit) */
for (let v = 0; v < 2; v++) cell(`B_lick_${v}`, [-190, -560, 130, 30], 'up', (st, {R}) => lick(st, R, R(470, 520), R(86, 104), ['red', 'redHot', 'redDeep'], false), 'big');
for (let v = 0; v < 2; v++) cell(`B_wave_${v}`, [-20, -70, 900, 70], 'x', (st, {R}) => {
  const ph = R(0, 6), f = R(9, 13), p = pts(t => [870 * t, 30 * Math.sin(t * f + ph) * (.35 + .65 * t) + 12 * Math.sin(t * 31 + ph)], 30);
  st('wet', 'big', p, {w: R(30, 36), c: PAINT.blue, pr: [.4, 1, .8, .55, .75, .95, .6, .5, .8, .6, .4, .5, .3, .12]});
  st('wet', 'dab', off(part(p, .04, .7), -7), {w: 7, c: PAINT.blueHi, pr: [.3, 1, .9, .6, .2]});
  st('scumble', 'drag', off(part(p, .5, .98), 9), {w: 9, c: PAINT.white, a: .9, pr: [.2, .8, 1, .5]});
}, 'big');
cell('B_trunk', [-20, -300, 620, 60], 'x', (st) => {
  const p = pts(t => [580 * t, -230 * Math.pow(t, 1.3) + 22 * Math.sin(t * 6)], 18);
  st('pigment', 'line', off(p, 16), {w: 5, c: PAINT.ink, pr: [.6, 1, .8, .5, .2]});
  st('pigment', 'full', p, {w: 44, c: PAINT.green, pr: [.9, 1, .92, .84, .74, .64, .54, .44, .34, .24]});
  st('thick', 'dab', part(p, 0, .35), {w: 16, c: PAINT.greenHi, pr: [1, .7, .2]});
}, 'big');
for (let v = 0; v < 2; v++) cell(`B_bough_${v}`, [-20, -230, 420, 80], 'x', (st, {R}) => {
  const p = pts(t => [380 * t, (v ? -170 : 40) * Math.pow(t, 1.2) + 14 * Math.sin(t * 7 + v)], 14);
  st('pigment', 'line', off(p, 9), {w: 3.4, c: PAINT.ink, pr: [.6, 1, .6, .2]});
  st('pigment', 'full', p, {w: 26, c: PAINT.green, pr: [.9, 1, .85, .68, .5, .34, .2, .08]});
  const a = p[6]; st('pigment', 'dab', spline([a, [a[0] + 50, a[1] + (v ? 26 : -40)], [a[0] + 120, a[1] + (v ? 30 : -84)]], 6), {w: 15, c: PAINT.greenHi, pr: [.9, 1, .6, .3, .08]});
}, 'big');
// earth: 斧劈皴, the axe-cut stroke of the scene's own rocks: the side of a broad brush dragged steeply down, ragged where
// it starts, dry on one flank, stopped dead at the foot
for (let v = 0; v < 2; v++) cell(`B_slab_${v}`, [-150, -540, 150, 40], 'down', (st, {R}) => {
  const lean = v ? -70 : 90, p = pts(t => [lean * (1 - t) * (1 - t * .3), -500 + 500 * t], 8);
  st('chalk', 'blunt', off(p, v ? 52 : -52), {w: 70, c: PAINT.inkMid, a: .85, pr: [.3, .8, 1, .9, .7, .5]});                       // the dry flank
  st('heavy', 'blunt', p, {w: R(84, 96), c: PAINT.ink, pr: [.25, .6, .9, 1, 1, 1, 1]});
  st('heavy', 'big', off(part(p, .35, 1), v ? -30 : 30), {w: 60, c: PAINT.ink, pr: [.2, .7, 1, 1, .9]});
  st('scumble', 'drag', off(part(p, .15, .9), v ? -44 : 44), {w: 16, c: PAINT.ochre, a: .95, pr: [.2, .8, 1, .7, .3]});
  st('chalk', 'drag', off(part(p, .3, .97), v ? 20 : -20), {w: 12, c: PAINT.ochre, a: .7, pr: [.2, 1, .6]});
}, 'big');
cell('B_foot', [-240, -70, 240, 30], '', (st, {R}) => {      // what a falling slab throws out along the ground
  for (const d of [-1, 1]) for (let i = 0; i < 4; i++) { const l = R(90, 220), r = R(.1, .3); st('pigment', 'full', spline([[d * R(20, 60), 0], [d * l * .6, -l * r * .5], [d * l, -l * r]], 6), {w: R(12, 22), c: PAINT[i % 2 ? 'ochre' : 'ink'], pr: [.9, 1, .7, .4, .2, .06]}) }
}, 'big');

/* ---------- pack: shelves, tallest first ---------- */
const PAD = 4;
function pack(pg) {
  let x = PAD, y = PAD, shelf = 0;
  for (const c of [...pg.cells].sort((a, b) => b.h - a.h || b.w - a.w)) {
    if (x + c.w + PAD > pg.w) { x = PAD; y += shelf + PAD; shelf = 0 }
    c.x = x; c.y = y; x += c.w + PAD; shelf = Math.max(shelf, c.h);
  }
  pg.h = Math.ceil((y + shelf + PAD) / 4) * 4;
}
function surface(pg, color) {
  const s = P.create({width: pg.w, height: pg.h, scale: pg.scale, ground: GROUND(color), seed: 5, define, light: LAMP});
  pg.cells.forEach((c, i) => {
    const ch = chance(7000 + i * 37 + c.name.length), ox = c.x + c.px, oy = c.y + c.py;
    const st = (material, brush, path, o = {}) => {
      const cmd = {material, brush, path: path.map(p => [p[0] + ox, p[1] + oy])};
      if (o.w !== undefined) cmd.width = o.w;
      if (o.c) { cmd.color = P.color(o.c[0]); cmd.color2 = P.color(o.c[1]) }
      if (o.a !== undefined) cmd.opacity = o.a;
      if (o.pr) cmd.pressure = o.pr;
      if (o.press !== undefined) cmd.press = o.press;
      if (o.load !== undefined) cmd.load = o.load;
      s.paint(cmd);
    };
    c.paint(st, ch);
  });
  s.dry();
  return s;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(root, 'baked'), {recursive: true}); mkdirSync(join(root, 'review'), {recursive: true});
  const json = {pages: {}, cells: {}};
  for (const [pname, pg] of Object.entries(pages)) {
    const t0 = performance.now(); pack(pg);
    // cover from the pigment itself (over white minus over black); colour as the lamp shows it over black
    const k = surface(pg, '#000000'), w = surface(pg, '#ffffff');
    k.render();
    const W = k.pxWidth, H = k.pxHeight, B = k.buffers, Wh = w.buffers, lit = k.pixels, out = Buffer.alloc(W * H * 4), S = pg.scale;
    for (let i = 0; i < W * H; i++) {
      const a = clamp(1 - ((Wh.CR[i] - B.CR[i]) + (Wh.CG[i] - B.CG[i]) + (Wh.CB[i] - B.CB[i])) / 3, 0, 1);
      if (a < .02) continue;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, Math.round(lit[i * 4 + c] / a));
      out[i * 4 + 3] = Math.round(a * 255);
    }
    // trim every cell to its paint, so the page draws no empty pixels
    for (const c of pg.cells) {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = Math.round(c.y * S); y < Math.round((c.y + c.h) * S); y++) for (let x = Math.round(c.x * S); x < Math.round((c.x + c.w) * S); x++) if (out[(y * W + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 < 0) { console.warn('empty cell', c.name); continue }
      x0 = Math.max(Math.round(c.x * S), x0 - 1); y0 = Math.max(Math.round(c.y * S), y0 - 1); x1 = Math.min(Math.round((c.x + c.w) * S), x1 + 2); y1 = Math.min(Math.round((c.y + c.h) * S), y1 + 2);
      // [page, sx, sy, sw, sh (pixels of the page), pivot x, pivot y (units, from the trimmed corner), w, h (units), axis]
      json.cells[c.name] = [PAGE_NO[pname], x0, y0, x1 - x0, y1 - y0, +(c.x + c.px - x0 / S).toFixed(2), +(c.y + c.py - y0 / S).toFixed(2), +((x1 - x0) / S).toFixed(2), +((y1 - y0) / S).toFixed(2), {x: 1, up: 2, down: 3}[c.axis] || 0];
    }
    const file = FILE[pname];
    const img = sharp(out, {raw: {width: W, height: H, channels: 4}});
    await img.clone().webp({quality: +(process.env.Q || pg.q), alphaQuality: +(process.env.AQ || 84), effort: 6}).toFile(join(root, 'baked', file));
    json.pages[pname] = {file, scale: S, w: W, h: H};
    const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pg.cells.map(c => `<text x="${c.x * S + 4}" y="${c.y * S + 11 * S}" font-family="Menlo" font-size="${Math.round(9 * S)}" fill="#6B645C">${c.name}</text>`).join('')}</svg>`;
    await sharp({create: {width: W, height: H, channels: 3, background: '#EFE7D6'}}).composite([{input: await img.png().toBuffer()}, {input: Buffer.from(labels)}]).png().toFile(join(root, 'review', `_atlas${pname === 'main' ? '' : '-' + pname}.png`));
    console.log(`${file} ${W}x${H} ${pg.cells.length} cells ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  writeFileSync(join(root, 'baked', 'fx2.json'), JSON.stringify(json));
}
