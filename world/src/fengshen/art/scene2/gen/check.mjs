// node gen/check.mjs    The review order of ART-DIRECTION section 8, as far as numbers can run it, on the five place stills.
// Needs review/place-N.png (figures) and review/bare-place-N.png (same view, no figures): node gen/shoot.mjs places; PRE=bare- FIGS=0 node gen/shoot.mjs places
// Writes review/checks.json and review/check-thumbs.png (64 px), check-grey.png, check-blur.png, check-flip.png.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync, readFileSync} from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review');
const L = (r, g, b) => { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }, Y = .2126 * f(r) + .7152 * f(g) + .0722 * f(b); return Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y };
const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return (mx - mn) / 255 };   // chroma, 0..1
const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const out = {}, W = 1440, H = 900, GROUND = 702, BAND0 = GROUND - 130;        // the band the figures' bodies stand in: 175 world px above the ground line, at zoom 0.74
const cells = {thumb: [], grey: [], blur: [], flip: []};
for (let n = 1; n <= 5; n++) {
  const a = await sharp(join(rv, `place-${n}.png`)).removeAlpha().raw().toBuffer(), b = await sharp(join(rv, `bare-place-${n}.png`)).removeAlpha().raw().toBuffer();
  const px = (buf, x, y) => [buf[(y * W + x) * 3], buf[(y * W + x) * 3 + 1], buf[(y * W + x) * 3 + 2]];
  // figure pixels: where the two stills differ
  let fig = 0, figL = 0, bgL = 0, darkFig = 100, darkScene = 100, satFig = 0, satScene = 0, satAt = null, darkAt = null, bandSum = 0, bandN = 0; const bandHist = new Uint32Array(101);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = px(a, x, y), q = px(b, x, y), d = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]), lp = L(...p), lq = L(...q), sp = sat(...p), sq = sat(...q);
    if (d > 40) { fig++; figL += lp; bgL += lq; if (lp < darkFig) darkFig = lp; if (sp > satFig) satFig = sp }
    if (lq < darkScene && y < GROUND + 60) { darkScene = lq; darkAt = [x, y] } if (sq > satScene) { satScene = sq; satAt = [x, y, hex(...q)] }
    if (y >= BAND0 && y < GROUND - 4) { bandSum += lq; bandN++; bandHist[Math.round(lq)]++ }
  }
  // the tester's measure (F-2.8): of the most saturated 0.2% of pixels in the still with figures, what share is on a figure
  const sats = new Float32Array(W * H), isFig = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = px(a, x, y), q = px(b, x, y); sats[y * W + x] = sat(...p); isFig[y * W + x] = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 40 ? 1 : 0 }
  const cut = Float32Array.from(sats).sort()[Math.floor(W * H * .998)]; let topN = 0, topFig = 0, sceneSat = []; for (let i = 0; i < W * H; i++) { if (sats[i] >= cut) { topN++; topFig += isFig[i] } }
  { const bs = []; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) bs.push(sat(...px(b, x, y))); bs.sort((u, v) => u - v); sceneSat = [bs[Math.floor(bs.length * .998)], bs[bs.length - 1]] }
  const fs = []; for (let i = 0; i < W * H; i++) if (isFig[i]) fs.push(sats[i]); fs.sort((u, v) => u - v);
  let acc = 0, band05 = 0; for (let v = 0; v <= 100; v++) { acc += bandHist[v]; if (acc > bandN * .01) { band05 = v; break } }
  const paper = L(...px(b, 720, 40));
  // the front layer is allowed its darks: darkest of the scene above the ground line + 60 only
  // palette: ten colours eyedropped from the bare still on a grid, the most saturated of each cell
  const drops = []; for (let i = 0; i < 10; i++) { const x0 = (i % 5) * 288, y0 = 200 + Math.floor(i / 5) * 260; let best = null, bs = -1; for (let y = y0; y < y0 + 260; y += 3) for (let x = x0; x < x0 + 288; x += 3) { const q = px(b, x, y), s = sat(...q); if (s > bs) { bs = s; best = q } } drops.push(hex(...best)) }
  out['place-' + n] = {paper: +paper.toFixed(1), figures: {pixels: fig, meanL: +(figL / fig).toFixed(1), backdropMeanL: +(bgL / fig).toFixed(1), darkest: +darkFig.toFixed(1), mostSaturated: +satFig.toFixed(2)},
    saturation: {top02pctOnFigures: +(topFig / topN).toFixed(3), sceneP998: +sceneSat[0].toFixed(2), sceneMax: +sceneSat[1].toFixed(2), figuresP90: +fs[Math.floor(fs.length * .9)].toFixed(2), figuresMax: +fs[fs.length - 1].toFixed(2)},
    scene: {darkestAboveGround: +darkScene.toFixed(1), darkestAt: darkAt, mostSaturated: +satScene.toFixed(2), mostSaturatedAt: satAt}, band: {meanL: +(bandSum / bandN).toFixed(1), darkest1pct: band05}, eyedrops: drops};
  const img = () => sharp(join(rv, `place-${n}.png`));
  cells.thumb.push(await img().resize(64, 40).resize(320, 200, {kernel: 'nearest'}).png().toBuffer()); cells.grey.push(await img().greyscale().resize(480, 300).png().toBuffer());
  cells.blur.push(await img().blur(8).resize(480, 300).png().toBuffer()); cells.flip.push(await img().flop().resize(480, 300).png().toBuffer());
}
for (const [k, list] of Object.entries(cells)) { const w = k === 'thumb' ? 320 : 480, h = k === 'thumb' ? 200 : 300;
  await sharp({create: {width: (w + 6) * 5 - 6, height: h, channels: 3, background: '#2a2622'}}).composite(list.map((input, i) => ({input, left: i * (w + 6), top: 0}))).png().toFile(join(rv, `check-${k}.png`)) }
writeFileSync(join(rv, 'checks.json'), JSON.stringify(out, null, 1));
const sc = JSON.parse(readFileSync(join(rv, '..', 'baked', 'scene.json'), 'utf8'));
writeFileSync(join(rv, 'values.json'), JSON.stringify({note: 'L* (0-100, raw paper about 92) of each sheet alone over paper in day ink. darkest/lightest: the 0.05% ends. p05: the 5% point of painted pixels. under52: share of painted pixels darker than 52. front: the sprites in front, in the near ink.', sheets: sc.values, front: {darkest: Math.round(L(...sc.time.ink[1])), lightest: 92}}, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v.saturation), 'paper', v.paper, JSON.stringify(v.paper && {}) && '', 'fig', v.figures.meanL, 'behind', v.figures.backdropMeanL, 'band', JSON.stringify(v.band), 'sceneSatAt', JSON.stringify(v.scene.mostSaturatedAt));
