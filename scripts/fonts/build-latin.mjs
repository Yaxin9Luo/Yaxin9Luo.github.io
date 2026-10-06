// Build the blog's committed Latin body faces: Source Serif 4 at the 20 pt optical size (opsz 20), static
// 400 / 400 italic / 600 instances subset to Latin, written to world/public/fonts/blog/.
//   node scripts/fonts/build-latin.mjs   (needs the sources; run scripts/fonts/sources.mjs first)
// The license text is world/public/fonts/blog/OFL.txt. The headline (EC Serif), UI (EC Sans) and label (EC Mono) faces are the homepage's subsets in /fonts/ec/.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {fetchSources, readSource} from './sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const subsetFont = createRequire(path.join(root, 'world/package.json'))('subset-font');
const out = path.join(root, 'world/public/fonts/blog');

let latin = '';
for (let c = 0x20; c <= 0x7e; c++) latin += String.fromCharCode(c);
for (let c = 0xa0; c <= 0xff; c++) latin += String.fromCharCode(c);
latin += 'ıŁłŒœŠšŸŽžƒˆ˜˚–—‘’‚“”„†‡•…‰′″‹›€™−→←↑↓↗×≈≤≥±∞µπαβγδεθλμσφω·';

await fetchSources(['sourceSerif', 'sourceSerifItalic']);
mkdirSync(out, {recursive: true});
for (const [name, key, wght] of [['source-serif-400', 'sourceSerif', 400], ['source-serif-600', 'sourceSerif', 600], ['source-serif-400i', 'sourceSerifItalic', 400]]) {
  const src = readSource(key);
  if (!src) throw new Error(`Missing font source: ${key}`);
  const bytes = await subsetFont(src, latin, {targetFormat: 'woff2', variationAxes: {opsz: 20, wght}});
  writeFileSync(path.join(out, `${name}.woff2`), bytes);
  console.log(`${name}.woff2 ${(bytes.length / 1024).toFixed(1)} KB`);
}
