// node world/src/muye2/art/fx/gen/tai.gen.mjs  ->  ../baked/gtai.webp
// 泰山 for 黄飞虎's true form (武成王, after death 东岳泰山天齐仁圣大帝): the mountain painted in the hand of the far hills of
// the field, with the same ink-wash engine and brush vocabulary (fengshen/art/scene2/gen, imported read only, as the
// ground's generator does). No outline: each mass hung from its ridge in thin ink, ochre on the lit faces, azurite
// straddling the crests and malachite on the shoulders; pines on the shoulders; mist over the foot. The middle peak, 泰山,
// stands highest; a gold hair runs just inside its ridge (the god's mountain).
// The picture is RGBA to be laid on paper, its foot at the bottom centre. Lead's review, round 15 (2026-11-25).
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ART = '../../../../fengshen/art/scene2/gen/';
const {Layer, sharp, chance, clamp, PAPER, PIG} = await import(ART + 'ink.mjs');
const {rock, pine} = await import(ART + 'brush.mjs');
PIG.gold = [.31, .52, 1.27];                     // bronze gold, as the ground's generator adds it (the engine file is not changed)
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'baked', 'gtai.webp');
const INK = [34, 30, 26], W = 900, H = 640, S = 1.4;

const L = new Layer(W, H, S, W / 2, H - 20);     // unit (0, 0) at the foot's centre
const J = chance(7), rough = (pts) => pts.flatMap((p, i) => i ? [[(pts[i - 1][0] + p[0]) / 2 + J.R(-10, 10), (pts[i - 1][1] + p[1]) / 2 + J.R(-26, 18)], p] : [p]);      // a ridge breaks between its points
// back peaks first, the high middle one, then the low front shoulders over their feet. Each: the engine's rock (ink tone,
// texture, mineral facets, trees), then the field hills' teal: malachite washed down from the ridge and azurite high on it
const {ridgeOf} = await import(ART + 'brush.mjs');
const PEAKS = [
  [[[-440, -60], [-360, -170], [-300, -230], [-250, -300], [-190, -250], [-130, -200], [-80, -150]], {seed: 3, fade: 260, lost: 'left', x0: -450, x1: -60}, .8],
  [[[60, -150], [130, -230], [210, -320], [260, -340], [320, -260], [380, -170], [440, -60]], {seed: 7, fade: 270, lost: 'left', x0: 20, x1: 450}, .8],
  [[[-260, -40], [-200, -170], [-140, -300], [-80, -430], [-30, -540], [10, -560], [60, -500], [120, -400], [170, -300], [230, -170], [290, -40]], {seed: 11, fade: 420, lost: 'left', x0: -270, x1: 300, inner: [[-30, -520, 260, .7], [30, -520, 240, .6]]}, 1],
  [[[-200, -10], [-150, -90], [-90, -140], [-40, -110], [10, -40]], {seed: 17, fade: 140, lost: 'right', x0: -210, x1: 20}, .9],
  [[[60, -20], [110, -100], [170, -150], [230, -100], [270, -20]], {seed: 19, fade: 140, lost: 'left', x0: 50, x1: 280}, .9],
];
for (const [pts0, o, k] of PEAKS) { const pts = rough(pts0), rf = ridgeOf(pts, o.seed, 8);
  rock(L, pts, {...o, foot: 0, och: .08, azu: 1.6, mal: 1.2, tone: 2.2, crag: 8, trees: 3, body: 1.1});
  L.mountain(rf, {pig: 'mal', dens: .55 * k, fade: o.fade * .9, fadeVar: .6, pow: 1.1, edge: .5, edgeW: 2, blotch: .5, tide: .4, gran: .8, x0: o.x0, x1: o.x1, floor: 10, feather: 30, seed: o.seed + 1});
  L.mountain(rf, {pig: 'azu', dens: .7 * k, fade: o.fade * .38, fadeVar: .6, pow: 1.4, edge: .9, edgeW: 1.6, blotch: .5, tide: .4, gran: .8, x0: o.x0, x1: o.x1, floor: 10, feather: 30, seed: o.seed + 2});
  L.mountain(rf, {pig: 'ink', dens: .16 * k, fade: o.fade * .3, fadeVar: .5, pow: 1.6, edge: 1.2, edgeW: 1.3, blotch: .4, x0: o.x0, x1: o.x1, floor: 10, feather: 30, seed: o.seed + 3}); }
// the god's mountain: a gold hair just inside the high ridge, pressed at the summit and lifting down the slopes
L.stroke([[-24, -528, 1.4], [-60, -440, 1.1], [-110, -330, .7], [-150, -250, .3]], {pig: 'gold', load: .9, dry1: .5, pool: 0});
L.stroke([[18, -540, 1.2], [60, -480, .9], [110, -390, .5]], {pig: 'gold', load: .8, dry1: .6, pool: 0});
// pines on the front shoulders
const C = chance(41); for (const [x, y, h] of [[-120, -132, 34], [-96, -138, 28], [170, -144, 32], [196, -132, 26], [-300, -222, 22], [300, -250, 20]]) pine(L, x, y, h, C, {load: .7});
// (no white band for mist: on the field's teal ground it read as a slab; the foot is lost in the paper by fading its cover below)

// RGBA to lay on paper (as the ground's rgbaOf): what the eye sees over paper, as colour and cover
const m = L.inkMask(), c = L.colour(), wh = L.wh, out = Buffer.alloc(L.N * 4);
for (let i = 0; i < L.N; i++) { const a = m[i] / 255, w = wh ? Math.min(1, wh[i]) : 0; let A = Math.max(a, w); const F = [0, 0, 0];
  for (let k = 0; k < 3; k++) { let v = PAPER[k]; if (c && c[i * 4 + 3]) { const ca = c[i * 4 + 3] / 255; v *= 1 - ca * (1 - c[i * 4 + k] / 255); } F[k] = v * (1 - a) + INK[k] * a; A = Math.max(A, 1 - F[k] / PAPER[k]); }
  // lost in mist at the foot, and at the far ends: the cover fades out over the lowest fifth and the outer tenth
  { const x = i % L.W, y = Math.floor(i / L.W), fy = (y / S - (H - 20)), fx = Math.abs(x / L.W - .5) * 2; A *= (1 - Math.min(1, Math.max(0, (fy + 120) / 110)) ** 1.5) * (1 - Math.max(0, (fx - .88) / .12)); }
  if (A < .006) continue; A = Math.min(1, A + .004);
  for (let k = 0; k < 3; k++) out[i * 4 + k] = clamp((F[k] - PAPER[k] * (1 - A)) / A, 0, 255); out[i * 4 + 3] = A * 255; }
await sharp(out, {raw: {width: L.W, height: L.H, channels: 4}}).webp({quality: 82, alphaQuality: 80}).toFile(OUT);
console.log(`gtai.webp ${L.W}x${L.H}, foot at (${W / 2 * S}, ${(H - 20) * S}) px, ${S} px a unit`);
