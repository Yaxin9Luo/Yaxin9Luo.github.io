// node world/src/muye2/art/fx/gen/spoils.prep.mjs  ->  ../baked/spoils/<id>.webp, <id>-icon.webp + spoils.json
// The fourteen boss spoils (content/spoils.js) as ink-and-colour paintings made with the image-generation pipeline (the lead,
// 2026-11-26: the spoils at the feats' standard), from lab/game-studies/imagegen/fx/raw/spoil-<id>.png (prompts in
// fx/prompts/spoil/). Each is trimmed to its paint, its colour pulled a little toward the game's dull mineral palette, its
// faint fringe dropped, and written twice: <id>.webp at most 512 px on its longer side (the field, and the panel at about
// 200 px on a 2x screen) and <id>-icon.webp at most 96 px (48 px on a 2x screen), sharpened a touch so it still reads.
// More paintings are field parts only, not spoils: goldWhip1 (one whip of the pair), stone (the rock 袁洪 becomes), and the
// fx* passages of painted effect (the black wind, the yellow breath, the miasma, the parted earth, the blood slash, the gold
// sparks, the ghost ink, the crown's radiance; prompts in fx/prompts/spoil/fx*.txt with frame-fx.txt).
// spoils.json: {name: {w, h, cx, cy}} of the 512 picture: size in px and the centre of its ink (the pivot the field moves).
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json')('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), RAW = join(HERE, '../../../../../../lab/game-studies/imagegen/fx/raw'), OUT = join(HERE, '../baked/spoils');
const IDS = ['qingyunSword', 'hunyuanUmbrella', 'jadePipa', 'marten', 'callName', 'goldWhips', 'bloodBlade', 'yellowBreath', 'plague', 'goldenCrown', 'boneBanner', 'earthTravel', 'fiveLights', 'changeForm'], PARTS = ['goldWhip1', 'stone', 'fxBlackWind', 'fxYellowCloudA', 'fxYellowCloudB', 'fxMiasma', 'fxEarthRings', 'fxBloodSlash', 'fxGoldSpark', 'fxGhostInk', 'fxRadiance', 'antidote', 'fxJadeGlow'];      // antidote: the pickup that stops 化血神刀's bleeding (with an icon, for the page's off-screen pointer)
const SAT = JSON.parse(process.env.SAT || '{}'), meta = {};
// the icon's crop [x0, y0, x1, y1] in fractions of the 512 picture: the banner's skulled head, the sword's hilt and upper blade,
// the whips' dragon heads crossed, the umbrellas' domes, ...
const ICON = { qingyunSword: [0.3, 0, 1, 0.75], hunyuanUmbrella: [0, 0, 1, 0.58], jadePipa: [0.12, 0, 1, 1], marten: [0.32, 0, 1, 0.92], callName: [0.3, 0, 1, 1],
  goldWhips: [0, 0, 1, 0.62], bloodBlade: [0.08, 0, 1, 0.92], yellowBreath: [0, 0, 0.62, 1], plague: [0, 0, 1, 0.6], goldenCrown: [0.14, 0.08, 0.86, 0.92],
  boneBanner: [0.08, 0, 0.92, 0.42], earthTravel: [0.12, 0, 0.88, 1], fiveLights: [0, 0, 1, 1], changeForm: [0, 0, 0.72, 0.78] };
// a part of a picture, columns u0..u1, its cut side faded out over the last 30% of its width (a smooth ramp: it ends in vapour, not a line)
async function feathered(data, info, name, u0, u1, side) { const W = info.width, H = info.height, x0 = Math.round(u0 * W), x1 = Math.round(u1 * W), w = x1 - x0, out = Buffer.alloc(w * H * 4), F = 0.3 * w;
  let sx = 0, sy = 0, sa = 0; for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) { const i = (y * W + x0 + x) * 4, j = (y * w + x) * 4, e = side === 'left' ? x : w - 1 - x, k = Math.min(1, e / F), f = k * k * (3 - 2 * k);
    out[j] = data[i]; out[j + 1] = data[i + 1]; out[j + 2] = data[i + 2]; out[j + 3] = Math.round(data[i + 3] * f); sx += x * out[j + 3]; sy += y * out[j + 3]; sa += out[j + 3]; }
  const t = await sharp(out, { raw: { width: w, height: H, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toBuffer(); await sharp(t).toFile(join(OUT, `${name}.webp`));
  meta[name] = { w, h: H, cx: Math.round(sx / sa), cy: Math.round(sy / sa) }; }
// a picture's outline alone: its alpha grown by r px, in dark ink (drawn under the picture it rings)
async function rim(data, info, name, r) { const W = info.width, H = info.height, out = Buffer.alloc(W * H * 4), A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let dy = -r; dy <= r && m < 255; dy += 1) for (let dx = -r; dx <= r; dx += 1) { if (dx * dx + dy * dy > r * r) continue; const v = A(x + dx, y + dy); if (v > m) m = v; }
    const i = (y * W + x) * 4; out[i] = 34; out[i + 1] = 28; out[i + 2] = 26; out[i + 3] = m; }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 85, alphaQuality: 90 }).toFile(join(OUT, `${name}.webp`));
  meta[name] = { ...meta.stone }; }
async function icon(data, info, n) { const [a, b, c, d] = ICON[n] || [0, 0, 1, 1], W = info.width, H = info.height;
  let x0 = a * W, y0 = b * H, x1 = c * W, y1 = d * H; const side = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = Math.round(cx - side / 2); y0 = Math.round(cy - side / 2);
  const S = Math.round(side), pad = { top: Math.max(0, -y0), left: Math.max(0, -x0), bottom: Math.max(0, y0 + S - H), right: Math.max(0, x0 + S - W) };
  const big = await sharp(data, { raw: info }).extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();      // sharp extracts before it extends in one pipeline: two steps
  const ext = await sharp(big).extract({ left: x0 + pad.left, top: y0 + pad.top, width: S, height: S }).png().toBuffer();
  const inner = 82, { data: q, info: qi } = await sharp(ext).resize({ width: inner, height: inner }).sharpen({ sigma: 0.6 }).raw().toBuffer({ resolveWithObject: true });
  const N = 96, o = (N - inner) >> 1, out = Buffer.alloc(N * N * 4);
  // the rim: the picture's alpha grown by 1.5 px, in dark ink, under the picture
  const A = (x, y) => (x < 0 || y < 0 || x >= inner || y >= inner ? 0 : q[(y * inner + x) * 4 + 3]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (dx * dx + dy * dy > 4.5) continue; m = Math.max(m, A(x - o + dx, y - o + dy)); }
    const i = (y * N + x) * 4, px = x - o, py = y - o, ia = A(px, py) / 255, ra = (m / 255) * 0.85, oa = ia + ra * (1 - ia);
    if (oa <= 0) continue; const j = (py * inner + px) * 4; for (let k = 0; k < 3; k++) { const ic = ia > 0 ? q[j + k] : 0, rc = [42, 34, 30][k]; out[i + k] = Math.round((ic * ia + rc * ra * (1 - ia)) / oa); } out[i + 3] = Math.round(oa * 255); }
  return sharp(out, { raw: { width: N, height: N, channels: 4 } }).webp({ quality: 90, alphaQuality: 95 }).toFile(join(OUT, `${n}-icon.webp`)); } mkdirSync(OUT, { recursive: true });
for (const n of [...IDS, ...PARTS]) { const src = join(RAW, `spoil-${n}.png`); if (!existsSync(src)) { console.warn('missing', n); continue; }
  const t = await sharp(src).ensureAlpha().trim({ threshold: 6 }).toBuffer();
  const { data, info } = await sharp(t).resize({ width: 512, height: 512, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const s = SAT[n] ?? 0.88; let sx = 0, sy = 0, sa = 0;
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; if (a < 18) { data[i + 3] = 0; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
    data[i] = Math.min(255, (l + (r - l) * s) * 0.97 + 6); data[i + 1] = Math.min(255, (l + (g - l) * s) * 0.97 + 4); data[i + 2] = Math.min(255, (l + (b - l) * s) * 0.97);
    const p = i / 4, x = p % info.width, y = (p / info.width) | 0; sx += x * a; sy += y * a; sa += a; }
  await sharp(data, { raw: info }).webp({ quality: 86, alphaQuality: 90 }).toFile(join(OUT, `${n}.webp`));
  if (IDS.includes(n) || n === 'antidote') await icon(data, info, n);
  // the field's cut parts, feathered where they are cut so no straight edge shows (the lead, round 4): the rolling cloud of the
  // 腹中黄气 painting without the face, and the white ape of the 八九玄功 painting without its trailing wind
  if (n === 'yellowBreath') await feathered(data, info, 'breathCloud', 0.4, 1, 'left');
  if (n === 'changeForm') await feathered(data, info, 'apeRear', 0, 0.68, 'right');
  if (n === 'changeForm') await feathered(data, info, 'apeWind', 0.6, 1, 'left');
  if (n === 'stone') { meta.stone = { w: info.width, h: info.height, cx: Math.round(sx / sa), cy: Math.round(sy / sa) }; await rim(data, info, 'stoneRim', 7); }      // the rock 袁洪 becomes, with a rim of ink round it, drawn under it so it reads as him changed
  meta[n] = { w: info.width, h: info.height, cx: Math.round(sx / sa), cy: Math.round(sy / sa) };
}
writeFileSync(join(OUT, 'spoils.json'), JSON.stringify(meta));
console.log(JSON.stringify(meta));
