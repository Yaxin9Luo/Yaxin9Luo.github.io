// Shared tools for the baked paintings: load PaintSim, paint on a surface, and write what the board needs.
//
// A piece is one function paint(s, K) that lays strokes on a PaintSim surface. bake() runs it three ways:
//   over black and over white  -> colour and cover of the paint alone (difference of the two), and its thickness
//   over the board's own colour, lit by PaintSim's lamp -> a preview to judge by eye
// Paint is laid with the surface API directly; nothing here depends on the page.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {deflateSync} from 'node:zlib';

export const dir = dirname(fileURLToPath(import.meta.url));
const vendor = join(dir, '..', 'vendor');
// the vendored copies end in "export {};" so the page can import them; a plain script does not want that line
for (const f of ['paintsim.js', 'paintsim.recipes.js']) runInThisContext(readFileSync(join(vendor, f), 'utf8').replace(/\nexport \{\};\s*$/, '\n'), {filename: f});
export const P = globalThis.PaintSim;
export const {spline, arc, circleArc, lerp, clamp, smooth, fbm, vnoise} = P.util;

/* ---------- chance, with a seed ---------- */
export function chance(seed0) {
  let seed = seed0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
  const R = (a, b) => a + rnd() * (b - a);
  return {rnd, R, pick: a => a[Math.floor(rnd() * a.length)], gauss: () => (rnd() + rnd() + rnd() - 1.5) / 1.5, reseed: n => { seed = n }};
}

/* ---------- colour ---------- */
export function palette(MIX) {
  const cache = new Map();
  const C = c => { if (typeof c !== 'string') return c; let v = cache.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); cache.set(c, v) } return v };
  const lerp3 = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
  const ramp = (list, t) => { t = clamp(t, 0, 1) * (list.length - 1); const i = Math.min(list.length - 2, Math.floor(t)); return lerp3(list[i], list[i + 1], t - i) };
  const hex = c => P.hex(C(c));
  return {C, lerp3, ramp, hex};
}

/* ---------- PNG ---------- */
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c });
const crc32 = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 };
export function png(w, h, data, channels = 4) {   // channels: 4 RGBA, 3 RGB, 1 grey
  const row = w * channels + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * channels, w * channels).copy(raw, y * row + 1);
  const chunk = (type, d) => { const td = Buffer.concat([Buffer.from(type, 'ascii'), d]), b = Buffer.alloc(8); b.writeUInt32BE(d.length, 0); b.writeUInt32BE(crc32(td), 4); return Buffer.concat([b.subarray(0, 4), td, b.subarray(4)]) };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = channels === 4 ? 6 : channels === 3 ? 2 : 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, {level: 6})), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- surfaces ---------- */
// The board is a gessoed canvas with a fine weave; the same tooth under every pass, so dry brush breaks alike.
const GROUND = color => ({kind: 'canvas', color, tooth: .22, pitch: 2.1, vary: 0, gloss: .03});
export const BOARD = {light: '#F6F6FA', dark: '#0E1020'};

function surface(piece, scale, color, light) {
  const s = P.create({width: piece.size[0], height: piece.size[1], scale, ground: GROUND(color), seed: piece.seed || 7, define: piece.define, light: light || 'raking'});
  piece.paint(s);
  s.dry();
  return s;
}

/** A lit look at the piece over the board's colour: the picture to judge. crop: [x0, y0, x1, y1] in page units. */
export function preview(piece, file, {scale = 2, dark = false, crop, light} = {}) {
  const t0 = performance.now();
  const s = surface(piece, scale, dark ? BOARD.dark : BOARD.light, light || piece.light);
  s.render();
  let W = s.pxWidth, H = s.pxHeight, px = s.pixels;
  if (crop) {
    const x0 = Math.max(0, Math.round(crop[0] * scale)), y0 = Math.max(0, Math.round(crop[1] * scale)), x1 = Math.min(W, Math.round(crop[2] * scale)), y1 = Math.min(H, Math.round(crop[3] * scale)), w = x1 - x0, h = y1 - y0;
    const img = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) img.set(px.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1) * 4), y * w * 4);
    px = img; W = w; H = h;
  }
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2] }
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, png(W, H, rgb, 3));
  console.log(`${file}  ${W}x${H}  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

/**
 * The paint alone. Returns {w, h, rgba (premultiplied colour and cover, 8 bit), relief (R thickness, G gloss, B metal)}
 * for the region crop (page units; default the whole page) at `scale` pixels a unit.
 *   cover  = 1 - (colour over white - colour over black)
 *   colour = colour over black            (already multiplied by cover)
 * THICK is the thickness that maps to 255.
 */
export const THICK = 3.2;
export function bake(piece, {scale = 2, crop} = {}) {
  const t0 = performance.now();
  const k = surface(piece, scale, '#000000'), w = surface(piece, scale, '#ffffff');
  const W = k.pxWidth, H = k.pxHeight, B = k.buffers, Wh = w.buffers;
  const c = crop || [0, 0, piece.size[0], piece.size[1]];
  const x0 = Math.max(0, Math.round(c[0] * scale)), y0 = Math.max(0, Math.round(c[1] * scale)), x1 = Math.min(W, Math.round(c[2] * scale)), y1 = Math.min(H, Math.round(c[3] * scale)), cw = x1 - x0, ch = y1 - y0;
  const rgba = new Uint8Array(cw * ch * 4), relief = new Uint8Array(cw * ch * 3);
  const b8 = v => v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  let covered = 0, maxT = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y0 + y) * W + x0 + x, o = y * cw + x;
    const a = clamp(1 - ((Wh.CR[i] - B.CR[i]) + (Wh.CG[i] - B.CG[i]) + (Wh.CB[i] - B.CB[i])) / 3, 0, 1);
    rgba[o * 4] = b8(Math.min(B.CR[i], a)); rgba[o * 4 + 1] = b8(Math.min(B.CG[i], a)); rgba[o * 4 + 2] = b8(Math.min(B.CB[i], a)); rgba[o * 4 + 3] = b8(a);
    const t = B.HT[i]; if (t > maxT) maxT = t;
    relief[o * 3] = b8(t / THICK); relief[o * 3 + 1] = b8(B.SP[i] * a); relief[o * 3 + 2] = b8(B.MT[i] * a);
    if (a > .5) covered++;
  }
  console.log(`bake ${piece.name} ${cw}x${ch}  cover ${(covered / (cw * ch) * 100).toFixed(1)}%  thickest ${maxT.toFixed(2)}  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return {w: cw, h: ch, rgba, relief};
}

/** Write a baked region as two PNG files (colour with cover; relief). encode.py turns them into WebP and makes the contact sheet. */
export function writeBaked(out, stem, baked) {
  mkdirSync(out, {recursive: true});
  writeFileSync(join(out, stem + '.color.png'), png(baked.w, baked.h, baked.rgba, 4));
  writeFileSync(join(out, stem + '.relief.png'), png(baked.w, baked.h, baked.relief, 3));
}

/* ---------- strokes: small helpers the pieces share ---------- */
// a stroke centred on (x, y), in a direction, curving
export const strokeAt = (x, y, ang, len, curv = 0, n = 5) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);
// pressure as numbers from a function of t (0 at the start of the stroke, 1 at its end)
export const prof = (f, n = 10) => Array.from({length: n + 1}, (_, i) => Math.max(0, f(i / n)));
// the part of a path, round its middle, for which ok(point) holds: a brush lifted at an edge
export function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
export const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
