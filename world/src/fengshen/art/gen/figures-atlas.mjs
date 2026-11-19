// node gen/figures-atlas.mjs   (needs baked/atlas.webp + atlas.json from gen/fx.gen.mjs)
// Packs the few paint cells that hang on the figures (the standard's cloth, the hoof flames, the arrow) into their own
// small sheet, baked/figures.webp + figures.json. Everything else in the first atlas is painted by fx2 now.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, statSync} from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const sharp = require('sharp');
const baked = join(dirname(fileURLToPath(import.meta.url)), '..', 'baked');
const src = JSON.parse(readFileSync(join(baked, 'atlas.json'), 'utf8')), S0 = src.scale, S = 1.6, PAD = 4;
const keep = [...Array.from({length: 8}, (_, i) => `flag_${i}`), ...Array.from({length: 4}, (_, i) => `wisp_red_${i}`), 'arrow'];
const cells = {}, parts = []; let x = PAD, y = PAD, rowH = 0; const W = 4 * (190 + PAD) + PAD;
for (const name of keep) { const [cx, cy, cw, ch, px, py] = src.cells[name]; if (x + cw + PAD > W) { x = PAD; y += rowH + PAD; rowH = 0; }
  const w = Math.round(cw * S), h = Math.round(ch * S);
  const input = await sharp(join(baked, 'atlas.webp')).extract({left: Math.round(cx * S0), top: Math.round(cy * S0), width: Math.round(cw * S0), height: Math.round(ch * S0)}).resize(w, h, {kernel: 'lanczos3'}).png().toBuffer();
  parts.push({input, left: Math.round(x * S), top: Math.round(y * S)}); cells[name] = [x, y, cw, ch, px, py]; x += cw + PAD; rowH = Math.max(rowH, ch); }
const H = y + rowH + PAD, out = join(baked, 'figures.webp');
await sharp({create: {width: Math.ceil(W * S), height: Math.ceil(H * S), channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite(parts).webp({quality: +(process.env.Q || 80), alphaQuality: 90, effort: 6}).toFile(out);
writeFileSync(join(baked, 'figures.json'), JSON.stringify({scale: S, flagFrames: 8, cells}));
console.log('figures.webp', Math.ceil(W * S), 'x', Math.ceil(H * S), statSync(out).size, 'bytes');
