// node world/src/muye2/art/fx/gen/beasts.prep.mjs  ->  ../baked/beasts/<name>.webp + beasts.json
// 杨戬's seventy-two changes: freehand ink-wash animals made with the image-generation pipeline (the user's choice,
// 2026-11-25: generated references, used directly), from lab/game-studies/imagegen/fx/raw/ink-<name>.png (prompts in
// fx/prompts/ink/). Each is trimmed to its paint, scaled to MAX px on its longer side, its colour pulled toward the
// game's dull mineral palette (saturation down, a breath of warm paper), its faint fringe dropped. All face right.
// beasts.json: {name: {w, h, cx, cy}}: size in px and the centre of its ink (the pivot the feat moves).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json')('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), RAW = join(HERE, '../../../../../../lab/game-studies/imagegen/fx/raw'), OUT = join(HERE, '../baked/beasts');
const MAX = 720, NAMES = ['hound', 'tiger', 'hawk', 'marten', 'crane', 'serpent'], SAT = { tiger: 0.62, serpent: 0.6 }, meta = {};
for (const n of NAMES) {
  const t = await sharp(join(RAW, `ink-${n}.png`)).ensureAlpha().trim({ threshold: 6 }).toBuffer();
  const img = sharp(t).resize({ width: MAX, height: MAX, fit: 'inside' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const s = SAT[n] ?? 0.82; let sx = 0, sy = 0, sa = 0;
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; if (a < 18) { data[i + 3] = 0; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
    data[i] = Math.min(255, (l + (r - l) * s) * 0.97 + 6); data[i + 1] = Math.min(255, (l + (g - l) * s) * 0.97 + 4); data[i + 2] = Math.min(255, (l + (b - l) * s) * 0.97);
    const p = i / 4, x = p % info.width, y = (p / info.width) | 0; sx += x * a; sy += y * a; sa += a; }
  await sharp(data, { raw: info }).webp({ quality: 86, alphaQuality: 90 }).toFile(join(OUT, `${n}.webp`));
  meta[n] = { w: info.width, h: info.height, cx: Math.round(sx / sa), cy: Math.round(sy / sa) };
}
writeFileSync(join(OUT, 'beasts.json'), JSON.stringify(meta));
console.log(JSON.stringify(meta));
