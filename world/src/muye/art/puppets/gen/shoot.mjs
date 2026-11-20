// node gen/shoot.mjs [mass band elites hero lineup]   (the site's dev server must be up on 5173; it is not restarted here)
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review'), want = process.argv.slice(2).filter((a) => a !== 'headed');
const browser = await chromium.launch({channel: 'chrome', headless: !process.argv.includes('headed')});
for (const g of want.length ? want : ['mass', 'band', 'elites', 'hero', 'lineup']) {
  const page = await browser.newPage({viewport: {width: 3700, height: 1200}, deviceScaleFactor: 1});
  page.on('console', m => { if (m.type() === 'error') console.log(g, 'console:', m.text()) }); page.on('pageerror', e => console.log(g, 'pageerror:', e.message));
  await page.goto((process.env.SHEET_BASE || 'http://localhost:5173') + '/src/muye/art/puppets/review/sheet.html?g=' + g); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000}).catch(() => console.log(g, 'did not become ready'));
  if (g === 'cost') { console.log(JSON.stringify(await page.evaluate(() => window.__cost))); await page.close(); continue; }
  if (g === 'blind') (await import('node:fs')).writeFileSync(join(rv, '..', 'gen', 'blind-key.json'), JSON.stringify(await page.evaluate(() => window.__key)));
  if (g === 'faxiang') { const out = join(rv, '..', 'faxiang'); (await import('node:fs')).mkdirSync(out, {recursive: true}); for (const [id, url] of Object.entries(await page.evaluate(() => window.__faxiang))) { const f = join(out, id + '.webp'); await sharp(Buffer.from(url.split(',')[1], 'base64')).webp({quality: 30, alphaQuality: 44, effort: 6}).toFile(f); console.log(id, (await import('node:fs')).statSync(f).size); } }
  await sharp(await (await page.$('#c')).screenshot()).webp({quality: 84}).toFile(join(rv, g + '.webp')); await page.close();   // WebP: the review folder stays small
}
await browser.close();
