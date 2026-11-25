// node gen/shoot-portraits.mjs   (dev server on 5173): writes imagegen/portraits/<id>-bust.webp, <id>-full.webp and imagegen/portraits.js
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core'), sharp = require('sharp');
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'imagegen'), pdir = join(dir, 'portraits'); mkdirSync(pdir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' }), page = await b.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/src/muye2/art/puppets/review/keyfig.html?g=portraits');
await page.waitForFunction(() => document.title === 'ready' || document.title.startsWith('error'), null, { timeout: 300000 });
const out = await page.evaluate(() => window.__out); await b.close();
const ids = Object.keys(out).sort(); let js = '// Portrait crops of the generated key figures (gen/shoot-portraits.mjs). bust: the rider, head to waist, about 480 px tall;\n// full: the whole figure as drawn in game, mount included, about 720 px tall. All face right, transparent.\nexport const PORTRAITS = {\n';
for (const id of ids) { const o = out[id];
  for (const [kind, h] of [['bust', 480], ['full', 720]]) { const buf = Buffer.from(o[kind].split(',')[1], 'base64');
    await sharp(buf).resize({ height: h, withoutEnlargement: false }).webp({ quality: Number(process.env.PQ || 78), alphaQuality: 85 }).toFile(join(pdir, `${id}-${kind}.webp`)); }
  js += `  ${id}: { bust: new URL('./portraits/${id}-bust.webp', import.meta.url).href, full: new URL('./portraits/${id}-full.webp', import.meta.url).href },\n`; }
writeFileSync(join(dir, 'portraits.js'), js + '};\n'); console.log(ids.length, 'portraits');
