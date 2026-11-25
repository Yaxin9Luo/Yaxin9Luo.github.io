// node world/src/muye2/art/fx/gen/chasm.gen.mjs  ->  ../baked/gchasm.webp
// 土行孙's 地裂: the earth opened under a group, seen from above as the field is (squeezed to the ground's 0.62). Painted
// with the field's ink-wash engine (fengshen/art/scene2/gen, read only, as tai.gen.mjs): the mouth a wet stain of ink
// pooled darkest in the middle with a tide line at its rim; the near lip a band of ochre earth broken into lumps; the far
// wall let-down ink; cracks pulled out from the rim in dry-brush; clods and spatter round it. Its centre at the middle.
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ART = '../../../../fengshen/art/scene2/gen/';
const {Layer, sharp, chance, clamp, PAPER} = await import(ART + 'ink.mjs');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'baked', 'gchasm.webp');
const INK = [34, 30, 26], W = 520, H = 300, S = 1.4, C = chance(23);
const L = new Layer(W, H, S, W / 2, H / 2);
// ochre earth thrown up round the mouth, under everything
for (let k = 0; k < 14; k++) { const a = C.R(0, Math.PI * 2), r = C.R(150, 205); L.blot(Math.cos(a) * r, Math.sin(a) * r * .5, C.R(14, 30), C.R(8, 16), {pig: 'och', dens: .9, rim: .4, rough: .5, gran: 1}); }
L.blot(0, 4, 190, 92, {pig: 'och', dens: .55, rim: .7, rimW: .08, soft: .2, rough: .45, freq: .025, gran: 1});
// the mouth: wet ink, pooled darkest in the middle, a tide line at its rim
L.blot(0, 0, 158, 70, {dens: 1.2, rim: .9, rimW: .06, soft: .12, rough: .4, freq: .03});
L.blot(-10, 6, 120, 52, {dens: 1.6, rim: .4, soft: .25, rough: .35});
L.blot(8, 10, 70, 30, {dens: 2.2, rim: .2, soft: .4, rough: .3});
// the far wall: let-down ink just inside the upper rim
L.stroke([[-140, -30, 10], [-70, -60, 16], [10, -66, 18], [90, -56, 14], [146, -26, 8]], {load: .5, dry: .2, dry1: .6, pool: .3, streak: .6});
// the near lip: lumps of ochre earth, ink pressed under each
for (let k = 0; k < 11; k++) { const x = -135 + k * 27 + C.R(-5, 5), y = 52 + 18 * Math.sin((k / 10) * Math.PI) + C.R(-4, 4);
  L.blot(x, y, C.R(11, 16), C.R(6, 9), {pig: 'och', dens: 1.6, rim: .6, rough: .5, gran: 1}); L.stroke([[x - 10, y + 8, 1.4], [x + 10, y + 9, 1.2]], {load: .9, pool: 0}); }
// cracks pulled out from the rim: straight runs, pressed at the rim, running dry
for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + C.R(-.2, .2), x0 = Math.cos(a) * 155, y0 = Math.sin(a) * 68, L1 = C.R(55, 95);
  const m = [x0 + Math.cos(a) * L1 * .5 + C.R(-10, 10), y0 + Math.sin(a) * L1 * .25 + C.R(-6, 6)], e = [x0 + Math.cos(a) * L1, y0 + Math.sin(a) * L1 * .5];
  L.stroke([[x0, y0, 3.2], [m[0], m[1], 2]], {load: 1, dry1: .3, pool: .2, rag: .2}); L.stroke([[m[0], m[1], 2], [e[0], e[1], .6]], {load: .9, dry: .3, dry1: .8, pool: 0, rag: .2}); }
// spatter flung out
for (let k = 0; k < 16; k++) { const a = C.R(0, Math.PI * 2), r = C.R(170, 240); L.blot(Math.cos(a) * r, Math.sin(a) * r * .5, C.R(2, 5), C.R(2, 4), {dens: 1.4, rim: .3}); }
const m = L.inkMask(), c = L.colour(), out = Buffer.alloc(L.N * 4);
for (let i = 0; i < L.N; i++) { const a = m[i] / 255; let A = a; const F = [0, 0, 0];
  for (let k = 0; k < 3; k++) { let v = PAPER[k]; if (c && c[i * 4 + 3]) { const ca = c[i * 4 + 3] / 255; v *= 1 - ca * (1 - c[i * 4 + k] / 255); } F[k] = v * (1 - a) + INK[k] * a; A = Math.max(A, 1 - F[k] / PAPER[k]); }
  if (A < .006) continue; A = Math.min(1, A + .004);
  for (let k = 0; k < 3; k++) out[i * 4 + k] = clamp((F[k] - PAPER[k] * (1 - A)) / A, 0, 255); out[i * 4 + 3] = A * 255; }
await sharp(out, {raw: {width: L.W, height: L.H, channels: 4}}).webp({quality: 82, alphaQuality: 80}).toFile(OUT);
console.log(`gchasm.webp ${L.W}x${L.H}, centre at the middle, ${S} px a unit`);
