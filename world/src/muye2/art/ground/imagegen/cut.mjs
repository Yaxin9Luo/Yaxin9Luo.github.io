// node world/src/muye2/art/ground/imagegen/cut.mjs [--debug <dir>]
// Painted scenery (raw/*.png from gen.py) -> ../baked/paint.webp + paint.json, an atlas the ground draws like its own.
// Rigs in rigs.json, one entry per source picture:
//   {"src": "raw/x2-platform.png", "scale": 0.45, "kind": "place", "name": "platform", "foot": [x, y],
//    "stand": [{"name": "platform", "poly": [[x, y], ...], "foot": [x, y]}]}
//     place: the whole picture becomes a lying piece `<name>.g` (drawn under the figures, its anchor at `foot`), and each
//            polygon a standing piece (sorted with the figures by its own foot). Coordinates in source pixels.
//   {"src": "raw/x1-pines.png", "scale": 0.5, "kind": "set", "name": "ppine", "minArea": 4000}
//     set:   every separate island of the picture becomes a standing piece <name>0, <name>1 ... (left to right), its foot
//            the middle of its lowest row.
// Finish: pixels under alpha 60 are dropped; the soft rim's colour is pulled to the paper (no dark halo); colours are
// pulled a little toward the scene's dull mineral palette (saturation x0.82, a breath of warm paper).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), sharp = require('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, '..', 'baked'), PAPER = [239, 231, 214];
const DEBUG = process.argv.includes('--debug') ? process.argv[process.argv.indexOf('--debug') + 1] : null;
const only = process.argv.find((a) => a.startsWith('only=')); const ONLY = only ? only.slice(5).split(',') : null;
const RIGS = JSON.parse(readFileSync(join(HERE, 'rigs.json'), 'utf8')).filter((r) => !ONLY || ONLY.includes(r.atlas || 'paint'));   // only=<atlas,...>: rebuild those atlases whole
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

function finish(px, w, h, sat = 0.82) {   // RGBA buffer in place
  for (let i = 0; i < w * h; i++) { const o = i * 4, a = px[o + 3]; if (a < 60) { px[o] = PAPER[0]; px[o + 1] = PAPER[1]; px[o + 2] = PAPER[2]; px[o + 3] = 0; continue; }
    let r = px[o], g = px[o + 1], b = px[o + 2]; const l = 0.3 * r + 0.59 * g + 0.11 * b, k = sat; r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k;
    r = r * 0.94 + PAPER[0] * 0.06; g = g * 0.94 + PAPER[1] * 0.06; b = b * 0.94 + PAPER[2] * 0.06;
    const rim = a < 200 ? 1 - (a - 60) / 140 : 0; px[o] = r + (PAPER[0] - r) * rim; px[o + 1] = g + (PAPER[1] - g) * rim; px[o + 2] = b + (PAPER[2] - b) * rim; px[o + 3] = Math.min(255, Math.round((a - 60) * 255 / 195)); }
}
// crop a region (with a mask function) of the scaled picture to its alpha bounds
function crop(px, w, h, keep) { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (px[o + 3] > 0 && keep(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return null; const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const s = ((y + y0) * w + x + x0) * 4, d = (y * cw + x) * 4; if (keep(x + x0, y + y0)) px.copy(out, d, s, s + 4); }
  return { buf: out, x0, y0, w: cw, h: ch }; }
// the pale ground disc a generated piece stands on: in the lowest `frac` of the crop, light low-chroma pixels go transparent
function dropPale(c, frac = 0.3) { const { buf, w, h } = c, y0 = Math.floor(h * (1 - frac));
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (!buf[o + 3]) continue; const r = buf[o], g = buf[o + 1], b = buf[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0;
    const pale = Math.min(1, Math.max(0, (l - 170) / 30)) * Math.min(1, Math.max(0, (0.3 - sat) / 0.12)); if (pale > 0) buf[o + 3] = Math.round(buf[o + 3] * (1 - pale)); } }
// soften the bottom edge of a polygon crop (a cut through grass reads as a ruled line otherwise)
function fadeBottom(c, px) { const { buf, w, h } = c; for (let y = Math.max(0, h - px); y < h; y++) { const k = (h - 1 - y) / px; for (let x = 0; x < w; x++) buf[(y * w + x) * 4 + 3] *= k; } }
// islands of opaque pixels (4-connected), at a coarse step for speed
function islands(px, w, h, minArea) { const lab = new Int32Array(w * h).fill(-1), out = []; let n = 0;
  for (let i = 0; i < w * h; i++) { if (lab[i] >= 0 || px[i * 4 + 3] < 40) continue; const q = [i]; lab[i] = n; let area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (q.length) { const k = q.pop(), x = k % w, y = (k / w) | 0; area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const m of [k - 1, k + 1, k - w, k + w]) { if (m < 0 || m >= w * h || lab[m] >= 0 || px[m * 4 + 3] < 40) continue; if ((m === k - 1 && x === 0) || (m === k + 1 && x === w - 1)) continue; lab[m] = n; q.push(m); } }
    if (area >= minArea) out.push({ id: n, area, x0, x1, y0, y1 }); n++; }
  return { lab, list: out.sort((a, b) => a.x0 - b.x0) }; }

const pieces = [];
for (const R of RIGS) {
  const res = R.res ?? Math.min(1.5, 1 / R.scale), k = R.scale * res, src = sharp(join(HERE, R.src)), meta = await src.metadata(), W = Math.round(meta.width * k), H = Math.round(meta.height * k);
  const px = await sharp(join(HERE, R.src)).ensureAlpha().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer(); finish(px, W, H, R.sat ?? 0.82);
  const S = (p) => p.map(([x, y]) => [x * k, y * k]);
  if (R.kind === 'place') {
    // the lying part: everything outside the standing polygons, at 60% of the standing parts' resolution (it is soft ground and cloud)
    const gk = k * 0.6, GW = Math.round(meta.width * gk), GH = Math.round(meta.height * gk), gpx = await sharp(join(HERE, R.src)).ensureAlpha().resize(GW, GH, { kernel: 'lanczos3' }).raw().toBuffer(); finish(gpx, GW, GH, R.sat ?? 0.82);
    const GP = (R.stand || []).map((st) => st.poly.map(([x, y]) => [x * gk, y * gk])), g = crop(gpx, GW, GH, (x, y) => !GP.some((P) => inPoly(x + 0.5, y + 0.5, P))), f = [R.foot[0] * gk, R.foot[1] * gk];
    pieces.push({ name: R.name + '.g', ...g, px: f[0] - g.x0, py: f[1] - g.y0, r: 0, s: res * 0.6, rig: R.atlas || 'paint' });
    for (const st of R.stand || []) { const P = S(st.poly), c = crop(px, W, H, (x, y) => inPoly(x + 0.5, y + 0.5, P)); if (!c) continue; const sf = S([st.foot])[0];
      if (st.dropPale) dropPale(c, st.dropPale); if (st.fade) fadeBottom(c, Math.round(st.fade * k));
      pieces.push({ name: st.name, ...c, px: sf[0] - c.x0, py: sf[1] - c.y0, r: st.r ?? 60, s: res, rig: R.atlas || 'paint' }); }
  } else if (R.kind === 'whole') {   // the whole picture standing (a wall, a gate): foot at R.foot
    const c = crop(px, W, H, () => true), f = [R.foot[0] * k, R.foot[1] * k]; if (R.dropPale) dropPale(c, R.dropPale);
    pieces.push({ name: R.name, ...c, px: f[0] - c.x0, py: f[1] - c.y0, r: R.r ?? 200, s: res, rig: R.atlas || 'paint' });
  } else if (R.kind === 'polys') {   // several standing pieces cut by polygon from one picture
    R.stand.forEach((st, i) => { const P = S(st.poly), c = crop(px, W, H, (x, y) => inPoly(x + 0.5, y + 0.5, P)); if (!c) return; const sf = S([st.foot])[0]; if (R.dropPale) dropPale(c, R.dropPale); if (R.fade) fadeBottom(c, Math.round(R.fade * k));
      pieces.push({ name: R.name + i, ...c, px: sf[0] - c.x0, py: sf[1] - c.y0, r: st.r ?? R.r ?? 30, s: res, rig: R.atlas || 'paint' }); });
  } else {
    const { lab, list } = islands(px, W, H, (R.minArea ?? 3000) * k * k);
    list.forEach((isl, i) => { const c = crop(px, W, H, (x, y) => lab[y * W + x] === isl.id); if (R.dropPale) dropPale(c, R.dropPale); let fy = c.h - 1, sx = 0, n = 0; for (let x = 0; x < c.w; x++) if (c.buf[((c.h - 6) * c.w + x) * 4 + 3] > 0) { sx += x; n++; }
      pieces.push({ name: R.name + i, ...c, px: n ? sx / n : c.w / 2, py: fy - 4, r: R.r ?? 20, s: res, rig: R.atlas || 'paint' }); });
  }
}
// pack each atlas (rows by height, 2048 wide): a rig's "atlas" names it (default "paint", shared by every scene)
for (const R of RIGS) for (const p of pieces) if (p.rig === undefined && (p.name === R.name || p.name.startsWith(R.name))) p.rig = R.atlas || 'paint';
const groups = {}; for (const p of pieces) (groups[p.rig || 'paint'] ||= []).push(p);
for (const [atlasName, list] of Object.entries(groups)) {
  list.sort((a, b) => b.h - a.h); const AW = 2048, cells = {}, parts = []; let x = 0, y = 0, rowH = 0;
  for (const p of list) { if (x + p.w > AW) { x = 0; y += rowH + 2; rowH = 0; } parts.push({ input: p.buf, raw: { width: p.w, height: p.h, channels: 4 }, left: x, top: y }); cells[p.name] = [x, y, p.w, p.h, +(p.px / p.s).toFixed(1), +(p.py / p.s).toFixed(1), p.s, p.r]; /* anchor in world units, as the code atlases keep it */ x += p.w + 2; rowH = Math.max(rowH, p.h); }
  const file = join(OUT, 'xiqi', atlasName + '.webp'); await sharp({ create: { width: AW, height: y + rowH, channels: 4, background: { r: PAPER[0], g: PAPER[1], b: PAPER[2], alpha: 0 } } }).composite(parts).webp({ quality: 74, alphaQuality: 76, effort: 6 }).toFile(file);
  writeFileSync(join(OUT, 'xiqi', atlasName + '.json'), JSON.stringify({ w: AW, h: y + rowH, cells }));
  console.log(atlasName + '.webp', AW + 'x' + (y + rowH), list.length, 'pieces:', Object.keys(cells).join(' '));
  if (DEBUG) { mkdirSync(DEBUG, { recursive: true }); await sharp(file).flatten({ background: '#808080' }).jpeg({ quality: 80 }).toFile(join(DEBUG, atlasName + '-atlas.jpg')); }
}
