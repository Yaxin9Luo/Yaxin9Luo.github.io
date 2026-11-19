// node world/src/fengshen/art/gen/fx.gen.mjs
// The paint marks: every blow, the dust of the charge and the cloth of the standard are real strokes, laid with
// PaintSim (the repo's paint simulator) as thick mineral colour, lit by its lamp from the upper left, and packed
// into ../baked/atlas.webp + atlas.json. The page only draws these cells. ../review/fx.png shows them over the paper.
// A cell is painted round its pivot at (0, 0). Units are screen pixels of the 1440 x 900 scene; SCALE px a unit.
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {P, chance} from '../../../board/baked/kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(join(root, '../../../package.json'))('sharp');
const {arc, circleArc, spline, clamp} = P.util;
const SCALE = 2, PAGE_W = 1100;

// one set of paints for everything: mineral pigment bound in glue, as in 重彩. Matte, with a little body.
const define = {
  materials: {
    pigment: {base: 'gouache', note: 'mineral colour in glue: opaque, matte, laid once', body: 1.0, ridges: .2, grain: .05, level: .25, gloss: .04, dry: .3, reach: 0, open: .1, bury: .8},
    thick: {base: 'gouache', note: 'the same, loaded: stands up from the paper', body: 1.7, ridges: .24, level: .15, gloss: .05, dry: .2, reach: 0, open: .05, bury: .95},
    scumble: {base: 'gouache', note: 'almost dry: catches the tooth', body: .35, opacity: .8, ridges: .1, grain: .12, gloss: .02, dry: .5, reach: 0, open: 0},
    chalk: {base: 'charcoal', note: 'ink gone almost dry: it only catches the tooth of the paper (飞白)', opacity: .8, dry: 1.0, charge: .62},
    wash: {base: 'gouache', note: 'ink let down with water, dragged', body: .12, opacity: .5, ridges: .05, grain: .14, gloss: 0, dry: .55, reach: 0, open: 0, bury: .2},
  },
  brushes: {
    cloth: {base: 'flat', note: 'a broad flat brush, streaky', clump: 3, streak: 1.2, rag: 4, wobble: .25, taper: .4},
    full: {base: 'filbert', note: 'a full filbert', clump: 4, streak: .7, wobble: .2},
    drag: {base: 'dry', note: 'a stiff dry brush', streak: 1.7, wobble: .6},
    dab: {base: 'round', note: 'a round, pressed and lifted', wobble: .2, clump: 4, streak: .4},
    line: {base: 'liner', note: 'a rigger', reach: 0, wobble: .15},
  },
};
const LAMP = {base: 'raking', relief: .75, contrast: .36, shadow: .12, cavity: .06};
const GROUND = color => ({kind: 'paper', color, tooth: .24, vary: 0, gloss: 0});

export const PAINT = {
  red: ['#B8321F', '#9A2616'], redHot: ['#C8402A', '#B8321F'], redDeep: ['#8E2417', '#701A10'],
  white: ['#F4EEDF', '#E9E1CE'], ink: ['#1B1512', '#35302B'], dust: ['#6B645C', '#857E73'], dustLight: ['#B4AC9E', '#C9C1B2'], gold: ['#B08A3C', '#8E6D2C'],
};
const cells = [];
function cell(name, w, h, px, py, paint) { cells.push({name, w, h, px, py, paint}) }
const strokeAt = (x, y, ang, len, curv = 0, n = 6) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);

/* ---- the cloth under the yak tails: one loaded pull of cinnabar along a travelling wave, drying toward its tail.
   Eight cells make the loop; each is painted afresh, so the cloth is redrawn like a hand-drawn cycle. ---- */
const FLAG_N = 8;
for (let f = 0; f < FLAG_N; f++) cell(`flag_${f}`, 190, 96, 180, 44, (st, {R}) => {
  const ph = f / FLAG_N * Math.PI * 2, L = 150;
  const spine = t => { const x = -L * t, a = 3 + 15 * t; return [x, a * Math.sin(t * 5.2 - ph) + 10 * t * t] };
  const pts = Array.from({length: 13}, (_, i) => spine(i / 12));
  st('pigment', 'cloth', spline(pts, 5), {w: 25, c: PAINT.red, pr: [.5, .95, 1, 1, .98, .95, .9, .82, .7, .52, .3, .12]});
  // the tail splits: a second, thinner pull leaves the first two thirds of the way along
  const t0 = .58, b = spine(t0), e = spine(1);
  st('pigment', 'full', spline([[b[0] + 6, b[1] + 5], [(b[0] + e[0]) / 2, (b[1] + e[1]) / 2 + 13], [e[0] + 6, e[1] + 20 + 4 * Math.sin(ph + 1)]], 6), {w: 11, c: PAINT.redDeep, pr: [.5, 1, .9, .7, .4, .15]});
  // one thick light along the top fold
  st('thick', 'drag', spline(pts.slice(1, 8).map(([x, y]) => [x, y - 6]), 5), {w: 6, c: PAINT.redHot, a: .9, pr: [.2, .8, 1, .7, .4, .15]});
});

/* ---- the slash: where the axe has been. Painted backward from the blade: loaded there, dry where the swing began.
   Centre (0, 0) is the rider's shoulder; the blade ends at angle A1. ---- */
export const SLASH = {r: 116, a0: -1.95, a1: .36};
cell('slash', 300, 300, 150, 150, (st, {R}) => {
  const {r, a0, a1} = SLASH;
  st('pigment', 'cloth', circleArc(0, 0, r, a1, a0, 24), {w: 25, c: PAINT.red, pr: [.3, .85, 1, 1, .94, .84, .72, .6, .48, .36, .26, .17, .1, .04]});
  st('thick', 'full', circleArc(0, 0, r + 5, a1 - .03, a1 - .8, 12), {w: 9, c: PAINT.redHot, pr: [.6, 1, .9, .6, .3, .1]});
  // the paper-coloured dry drag along the outer edge: the flash of the blade
  st('scumble', 'drag', circleArc(0, 0, r + 11, a1 - .08, a0 + .7, 16), {w: 7, c: PAINT.white, a: .95, pr: [.5, 1, 1, .8, .55, .3, .12]});
});

/* ---- the impact: thrown paint. The blow comes from the left and above; everything flies on from it. ---- */
cell('burst', 190, 170, 60, 85, (st, {R}) => {
  // one loaded dab that breaks on the shield, two smaller that leave it, then what is thrown
  st('thick', 'dab', arc(-14, -6, .12, 44, .25, 7), {w: 17, c: PAINT.red, pr: [.5, 1, 1, .8, .5, .25, .08]});
  st('thick', 'dab', arc(2, -10, -.75, 30, -.3, 6), {w: 9, c: PAINT.redHot, pr: [.9, 1, .6, .3, .1]});
  st('thick', 'dab', arc(4, 4, .8, 26, .3, 6), {w: 8, c: PAINT.red, pr: [.9, 1, .6, .3, .1]});
  for (const [a, d, l, w] of [[-.4, 8, 20, 6], [.45, 12, 16, 5]]) st('thick', 'dab', arc(Math.cos(a) * d, Math.sin(a) * d, a, l, R(-.3, .3), 5), {w, c: PAINT.white, pr: [1, .8, .45, .15]});
  for (let i = 0; i < 8; i++) { const a = R(-1.1, 1.1), d = R(40, 92); st('pigment', 'dab', arc(Math.cos(a) * d, Math.sin(a) * d, a + R(-.2, .2), R(4, 10), R(-.4, .4), 4), {w: R(2.2, 4.4), c: i % 3 ? PAINT.red : PAINT.ink, pr: [.9, 1, .5, .15]}) }
});

/* ---- dust of the charge: pale ink dragged dry, low heaps rising and thinning behind the hooves. Four cells. ---- */
for (let f = 0; f < 4; f++) cell(`dust_${f}`, 330, 130, 310, 112, (st, {R}) => {
  // 飞白: dry flicks thrown up and back from the hooves, each pressed at the hoof and lifted as it rises and curls
  for (const [x0, y0, len, rise, w, a] of [[2, -3, 96, .3, 13, .9], [-12, -8, 132, .48, 15, .8], [-34, -2, 84, .14, 9, .8], [-52, -14, 120, .62, 12, .62], [-4, -14, 70, .8, 9, .7], [-92, -6, 90, .3, 10, .5]]) {
    const l = len * R(.85, 1.15), r = rise * R(.8, 1.2);
    st('chalk', 'full', spline([[x0, y0], [x0 - l * .4, y0 - l * r * .18 + R(-3, 3)], [x0 - l * .78, y0 - l * r * .6], [x0 - l, y0 - l * r * 1.05 - R(0, 6)]], 6), {w: w * R(.85, 1.15), c: PAINT.dust, a, pr: [.35, 1, .95, .8, .6, .4, .2, .06]});
  }
  for (let i = 0; i < 12; i++) { const a = R(2.6, 3.5), d = R(20, 150); st('pigment', 'dab', strokeAt(Math.cos(a) * d, -6 + Math.sin(a) * d * .7 - R(0, 16), R(-.9, -.2), R(3, 7), 0, 3), {w: R(1.6, 3.4), c: PAINT.ink, a: .8, pr: [1, .7, .2]}) }
});
/* ---- a small puff under running feet ---- */
for (let f = 0; f < 2; f++) cell(`puff_${f}`, 90, 44, 76, 38, (st, {R}) => { for (const [x, y, w] of [[-8, -4, 9], [-26, -8, 11], [-46, -12, 8]]) st('chalk', 'full', strokeAt(x + R(-3, 3), y, -.35, w * 2.4, -.7, 5), {w, c: PAINT.dust, a: .7, pr: [.35, 1, .8, .45, .15]}) });

/* ---- the beast's aura: a short wisp of paint trailing from a hoof. Pivot at the hoof; it curls up and back. ---- */
for (const [tone, mat, col] of [['red', 'pigment', 'red']]) for (let v = 0; v < 4; v++) cell(`wisp_${tone}_${v}`, 78, 40, 70, 32, (st, {R}) => {
  const l = R(34, 52), r = R(.25, .5);
  st(mat, 'full', spline([[0, 0], [-l * .3, -l * r * .15 + R(-1, 1)], [-l * .7, -l * r * .6], [-l, -l * r - R(0, 4)]], 6), {w: R(5, 7.5), c: PAINT[col], a: tone === 'ink' ? .9 : 1, pr: [.5, 1, .9, .65, .4, .2, .06]});
  st(mat, 'full', spline([[-4, 2], [-l * .4, 1 + R(-1, 1)], [-l * .72, -3 - R(0, 3)]], 5), {w: R(3, 4.4), c: PAINT[tone === 'ink' ? 'ink' : 'redDeep'], a: .9, pr: [.6, 1, .6, .25, .08]});
  const cx = -l * R(.4, .6), cy = -l * r * .5 - 3;
  st(mat, 'dab', spline([[cx, cy], [cx - 6, cy - 6], [cx - 4, cy - 12], [cx + 2, cy - 12]], 5), {w: R(2.4, 3.4), c: PAINT[col], pr: [.9, 1, .6, .2]});
});

/* ---- marks that stay: what a blow throws onto the ground, and what hooves and falling bodies scuff into it ---- */
for (let v = 0; v < 3; v++) cell(`splat_${v}`, 150, 46, 60, 24, (st, {R}) => {
  st('pigment', 'full', strokeAt(R(-6, 6), R(-2, 2), R(-.08, .08), R(54, 80), R(-.2, .2), 7), {w: R(10, 15), c: PAINT.redDeep, pr: [.3, .9, 1, .8, .5, .25, .08]});
  for (let i = 0; i < 6; i++) { const a = R(-.5, .5), d = R(26, 80); st('pigment', 'dab', arc(Math.cos(a) * d, Math.sin(a) * d * .5, a, R(5, 12), R(-.3, .3), 4), {w: R(2, 4.6), c: i % 2 ? PAINT.red : PAINT.redDeep, pr: [.9, 1, .5, .15]}) }
});
for (let v = 0; v < 3; v++) cell(`scuff_${v}`, 130, 36, 65, 18, (st, {R}) => {
  for (let i = 0; i < 3; i++) st('chalk', 'full', strokeAt(R(-14, 14), R(-6, 6), R(-.12, .12), R(50, 96), R(-.15, .15), 7), {w: R(5, 10), c: PAINT.dust, a: R(.6, .9), pr: [.3, 1, .9, .6, .35, .12]});
  for (let i = 0; i < 5; i++) st('pigment', 'dab', strokeAt(R(-50, 50), R(-10, 10), R(-.5, .5), R(3, 7), 0, 3), {w: R(1.6, 3), c: PAINT.ink, a: .8, pr: [1, .7, .2]});
});
/* ---- a body or a horse hitting the ground: dry flicks thrown both ways, low ---- */
for (let v = 0; v < 2; v++) cell(`thud_${v}`, 210, 70, 105, 60, (st, {R}) => {
  for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) { const l = R(40, 84), r = R(.25, .7); st('chalk', 'full', spline([[dir * R(2, 10), -2], [dir * l * .4, -l * r * .2], [dir * l * .8, -l * r * .62], [dir * l, -l * r]], 6), {w: R(7, 12), c: PAINT.dust, a: R(.6, .9), pr: [.4, 1, .85, .55, .25, .08]}) }
  for (let i = 0; i < 9; i++) st('pigment', 'dab', strokeAt(R(-80, 80), -R(4, 40), R(-1.2, 1.2), R(3, 7), 0, 3), {w: R(1.6, 3.2), c: PAINT.ink, a: .8, pr: [1, .7, .2]});
});

/* ---- what the last blow left on the ground: paint stays on the sheet ---- */
cell('mark', 170, 44, 85, 22, (st, {R}) => {
  st('scumble', 'drag', strokeAt(0, 0, -.04, 140, .05, 9), {w: 13, c: PAINT.redDeep, a: .85, pr: [.2, .8, 1, .8, .6, .4, .2, .08]});
  for (let i = 0; i < 4; i++) st('pigment', 'dab', strokeAt(R(20, 70), R(-12, 12), R(-.4, .4), R(5, 10), 0, 3), {w: R(2, 4), c: PAINT.redDeep, pr: [1, .6, .2]});
});
/* ---- an arrow in the air: one line of ink, a gold head, a dragged feather ---- */
cell('arrow', 70, 16, 35, 8, (st) => {
  st('pigment', 'line', [[-26, 0], [0, .3], [24, 0]], {w: 2, c: PAINT.ink, pr: [.8, 1, 1]});
  st('pigment', 'dab', [[22, 0], [31, 0]], {w: 4.4, c: PAINT.gold, pr: [1, .6, .1]});
  st('scumble', 'drag', [[-28, 0], [-18, -.2]], {w: 6, c: PAINT.ink, pr: [.5, 1, .6]});
});

/* ---------- pack: shelves, tallest first ---------- */
const PAD = 4;
let x = PAD, y = PAD, shelf = 0;
for (const c of [...cells].sort((a, b) => b.h - a.h || b.w - a.w)) {
  if (x + c.w + PAD > PAGE_W) { x = PAD; y += shelf + PAD; shelf = 0 }
  c.x = x; c.y = y; x += c.w + PAD; shelf = Math.max(shelf, c.h);
}
const PAGE_H = Math.ceil((y + shelf + PAD) / 4) * 4;

function surface(color) {
  const s = P.create({width: PAGE_W, height: PAGE_H, scale: SCALE, ground: GROUND(color), seed: 5, define, light: LAMP});
  cells.forEach((c, i) => {
    const ch = chance(3000 + i * 37), ox = c.x + c.px, oy = c.y + c.py;
    const st = (material, brush, path, o = {}) => {
      const cmd = {material, brush, path: path.map(p => [p[0] + ox, p[1] + oy])};
      if (o.w !== undefined) cmd.width = o.w;
      if (o.c) { cmd.color = P.color(o.c[0]); cmd.color2 = P.color(o.c[1]) }
      if (o.a !== undefined) cmd.opacity = o.a;
      if (o.pr) cmd.pressure = o.pr;
      s.paint(cmd);
    };
    c.paint(st, ch);
  });
  s.dry();
  return s;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = performance.now();
  mkdirSync(join(root, 'baked'), {recursive: true}); mkdirSync(join(root, 'review'), {recursive: true});
  // cover from the pigment itself (over white minus over black); colour as the lamp shows it over black
  const k = surface('#000000'), w = surface('#ffffff');
  k.render();
  const W = k.pxWidth, H = k.pxHeight, B = k.buffers, Wh = w.buffers, lit = k.pixels, out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = clamp(1 - ((Wh.CR[i] - B.CR[i]) + (Wh.CG[i] - B.CG[i]) + (Wh.CB[i] - B.CB[i])) / 3, 0, 1);
    if (a < .02) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, Math.round(lit[i * 4 + c] / a));
    out[i * 4 + 3] = Math.round(a * 255);
  }
  const img = sharp(out, {raw: {width: W, height: H, channels: 4}});
  await img.clone().webp({quality: 92, alphaQuality: 95, effort: 5}).toFile(join(root, 'baked', 'atlas.webp'));
  writeFileSync(join(root, 'baked', 'atlas.json'), JSON.stringify({scale: SCALE, w: W, h: H, flagFrames: FLAG_N, slash: SLASH, cells: Object.fromEntries(cells.map(c => [c.name, [c.x, c.y, c.w, c.h, c.px, c.py]]))}));
  await sharp(await sharp({create: {width: W, height: H, channels: 3, background: '#EFE7D6'}}).composite([{input: await img.png().toBuffer()}]).png().toBuffer()).resize(Math.round(W / 2)).png().toFile(join(root, 'review', 'fx.png'));
  console.log(`fx/atlas.webp ${W}x${H} ${cells.length} cells ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
