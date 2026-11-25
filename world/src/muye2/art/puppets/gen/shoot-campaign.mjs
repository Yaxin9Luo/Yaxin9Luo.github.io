// node gen/shoot-campaign.mjs [style crowd anim]   (the dev server must be up; SHEET_BASE overrides http://127.0.0.1:5173)
// Writes review/<g>-campaign.webp. PNG=<dir> also writes a lossless copy there, for close looking.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review'), want = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
for (const g of want.length ? want : ['style', 'crowd', 'anim']) {
  const page = await browser.newPage({ viewport: { width: 2600, height: 1200 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log(g, 'console:', m.text()); }); page.on('pageerror', (e) => console.log(g, 'pageerror:', e.message));
  await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/src/muye2/art/puppets/review/' + (process.env.PAGE || 'campaign.html') + '?g=' + g + (process.env.Q || ''));
  await page.waitForFunction(() => document.title === 'ready' || document.title.startsWith('error'), null, { timeout: 120000 }).catch(() => console.log(g, 'did not become ready'));
  const shot = await (await page.$('#c')).screenshot();
  await sharp(shot).webp({ quality: 86 }).toFile(join(rv, g + '-campaign.webp'));
  if (process.env.PNG) await sharp(shot).png().toFile(join(process.env.PNG, g + '.png'));
  console.log(g, (await sharp(shot).metadata()).width, (await sharp(shot).metadata()).height);
  await page.close();
}
await browser.close();
