// node world/src/muye/art/fx/gen/fx.gen.mjs        (about a minute; ATLAS=1 also writes ../review/_atlas*.png, not kept)
// The brush vocabulary of the survivors-like's effects (review/DESIGN.md). Every cell is real strokes laid with PaintSim,
// lit from the upper left, packed into ../baked/fx-*.webp and fx.json. The vocabulary itself is in cells.mjs.
//
// Three ways a cell sits in the view (a ground point (x, y) is drawn at (x, 0.62 y); nothing shrinks with distance):
//   flat     lies on the ground: painted as seen from straight above; the page squeezes it onto the ground plane
//   along    travels: painted along +x from its pivot; the page lays it along a projected line at its own width
//   upright  stands or flies: a side view with its foot at the pivot
// A cell that is drawn on in time travels along one axis: 'x', 'up' or 'down'.
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {P, chance} from '../../../../board/baked/kit.mjs';
import {vocabulary} from './cells.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(join(root, '../../../../package.json'))('sharp');
const {arc, spline, clamp} = P.util;

const define = {
  materials: {
    pigment: {base: 'gouache', note: 'mineral colour in glue: opaque, matte, laid once', body: 1.0, ridges: .2, grain: .05, level: .25, gloss: .04, dry: .3, reach: 0, open: .1, bury: .8},
    thick: {base: 'gouache', note: 'the same, loaded: stands up from the paper', body: 1.7, ridges: .24, level: .15, gloss: .05, dry: .2, reach: 0, open: .05, bury: .95},
    scumble: {base: 'gouache', note: 'almost dry: catches the tooth', body: .35, opacity: .8, ridges: .1, grain: .12, gloss: .02, dry: .5, reach: 0, open: 0},
    chalk: {base: 'charcoal', note: 'gone almost dry: it only catches the tooth of the paper (飞白)', opacity: .8, dry: 1.0, charge: .62},
    wash: {base: 'gouache', note: 'ink or colour let down with water', body: .12, opacity: .5, ridges: .05, grain: .14, gloss: 0, dry: .55, reach: 0, open: 0, bury: .2},
    wet: {base: 'gouache', note: 'colour with much water in it: runs long, lies flat, pools', body: .55, ridges: .07, grain: .02, level: .85, gloss: .22, sharp: .5, dry: .04, reach: 0, open: .1, bury: .6},
    metal: {base: 'shell gold', note: 'powdered bronze in glue', body: .5, ridges: .1, level: .5, gloss: .5, sharp: .5, metal: .7, dry: .08, reach: 0, bury: .8, flake: {amount: .15, hue: 40, spread: .05, chroma: .4, size: .4, sparkle: .6, sheen: 0}},
    heavy: {base: 'gouache', note: 'ink ground thick: a slab', body: 2.2, ridges: .3, level: .1, gloss: .1, dry: .12, reach: 0, open: .05, bury: 1},
  },
  brushes: {
    big: {base: 'round', note: 'a large pointed brush, fully loaded: swells and thins with the hand', clump: 3, streak: 1.1, wobble: .25, var: .06},
    blunt: {base: 'flat', note: 'a worn flat brush: square ends (斧劈)', clump: 4, streak: 1.0, rag: 7, wobble: .5, taper: .15},
    full: {base: 'filbert', note: 'a full filbert', clump: 4, streak: .7, wobble: .2},
    drag: {base: 'dry', note: 'a stiff dry brush', streak: 1.7, wobble: .6},
    dab: {base: 'round', note: 'a round, pressed and lifted', wobble: .2, clump: 4, streak: .4},
    line: {base: 'liner', note: 'a rigger', reach: 0, wobble: .15},
    rule: {base: 'liner', note: 'a rigger drawn fast and straight (铁线)', reach: 0, wobble: 0, var: .05},
  },
};
const LAMP = {base: 'raking', relief: .75, contrast: .36, shadow: .12, cavity: .06};
const GROUND = color => ({kind: 'paper', color, tooth: .24, vary: 0, gloss: 0});

// ART-DIRECTION section 4, each as the two tones a brush carries (lit side warmer, shaded cooler)
export const PAINT = {
  red: ['#B8321F', '#9A2616'], redHot: ['#C8402A', '#B8321F'], redDeep: ['#8E2417', '#701A10'],
  white: ['#F4EEDF', '#E9E1CE'], ink: ['#1B1512', '#35302B'], inkMid: ['#35302B', '#6B645C'], inkPale: ['#6B645C', '#857E73'], inkClear: ['#A69F94', '#B5AEA2'],
  gold: ['#B08A3C', '#8E6D2C'], goldHi: ['#C6A04E', '#B08A3C'],
  blue: ['#2F4F7A', '#26426A'], blueHi: ['#48698F', '#2F4F7A'], bluePale: ['#7F95AE', '#6C849F'],
  green: ['#3F7D6A', '#346A59'], greenHi: ['#55907C', '#3F7D6A'],
  ochre: ['#A07C46', '#86673A'], ochreHi: ['#B8945A', '#A07C46'],
};
// Two sheets: main at 1.5 px a unit (loaded strokes whose edges are seen), soft at 1 px a unit (dry, pale, broken)
const pages = {main: {scale: 1.5, w: 1600, q: 76, cells: []}, soft: {scale: 1, w: 1400, q: 72, cells: []}, big: {scale: .5, w: 1900, q: 70, cells: []}};
const PAGE_NO = {main: 0, soft: 1, big: 2}, FILE = {main: 'fx-main.webp', soft: 'fx-soft.webp', big: 'fx-big.webp'};
/** box: [x0, y0, x1, y1] round the pivot; axis: 'x' | 'up' | 'down' | '' */
function cell(name, box, axis, paint, page = 'main') {
  const even = v => Math.ceil(v / 4) * 4;
  pages[page].cells.push({name, box, axis, paint, w: even(box[2] - box[0]), h: even(box[3] - box[1]), px: -box[0], py: -box[1]});
}
const pts = (f, n = 14) => Array.from({length: n + 1}, (_, i) => f(i / n));
const off = (path, d) => path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d] });
const part = (path, a, b) => path.slice(Math.round(a * (path.length - 1)), Math.round(b * (path.length - 1)) + 1);
const strokeAt = (x, y, ang, len, curv = 0, n = 6) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);

vocabulary({cell, PAINT, pts, off, part, strokeAt, spline});

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
    const ch = chance(9100 + i * 37 + c.name.length * 13), ox = c.x + c.px, oy = c.y + c.py;
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
  mkdirSync(join(root, 'baked'), {recursive: true});
  const json = {pages: {}, cells: {}}, only = process.env.ONLY;
  for (const [pname, pg] of Object.entries(pages)) {
    if (only && only !== pname) continue;
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
    for (const c of pg.cells) {      // trim every cell to its paint
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = Math.round(c.y * S); y < Math.round((c.y + c.h) * S); y++) for (let x = Math.round(c.x * S); x < Math.round((c.x + c.w) * S); x++) if (out[(y * W + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 < 0) { console.warn('empty cell', c.name); continue }
      x0 = Math.max(Math.round(c.x * S), x0 - 1); y0 = Math.max(Math.round(c.y * S), y0 - 1); x1 = Math.min(Math.round((c.x + c.w) * S), x1 + 2); y1 = Math.min(Math.round((c.y + c.h) * S), y1 + 2);
      // [page, sx, sy, sw, sh (pixels), pivot x, pivot y (units from the trimmed corner), w, h (units), axis]
      json.cells[c.name] = [PAGE_NO[pname], x0, y0, x1 - x0, y1 - y0, +(c.x + c.px - x0 / S).toFixed(2), +(c.y + c.py - y0 / S).toFixed(2), +((x1 - x0) / S).toFixed(2), +((y1 - y0) / S).toFixed(2), {x: 1, up: 2, down: 3}[c.axis] || 0];
    }
    const file = FILE[pname], img = sharp(out, {raw: {width: W, height: H, channels: 4}});
    await img.clone().webp({quality: +(process.env.Q || pg.q), alphaQuality: +(process.env.AQ || 60), effort: 6}).toFile(join(root, 'baked', file));
    json.pages[pname] = {file, scale: S, w: W, h: H};
    if (process.env.ATLAS) { const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pg.cells.map(c => `<text x="${c.x * S + 4}" y="${c.y * S + 11 * S}" font-family="Menlo" font-size="${Math.round(8 * S)}" fill="#6B645C">${c.name}</text>`).join('')}</svg>`;
      await sharp({create: {width: W, height: H, channels: 3, background: '#EFE7D6'}}).composite([{input: await img.png().toBuffer()}, {input: Buffer.from(labels)}]).png().toFile(join(root, 'review', `_atlas-${pname}.png`)); }
    console.log(`${file} ${W}x${H} ${pg.cells.length} cells ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (!only) writeFileSync(join(root, 'baked', 'atlas.json'), JSON.stringify(json));
}
