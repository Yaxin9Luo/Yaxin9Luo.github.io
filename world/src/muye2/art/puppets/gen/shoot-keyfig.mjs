// node gen/shoot-keyfig.mjs <g> <out.webp|png> [query]   (the dev server must be up on 5173; SHEET_BASE overrides)
// Shoots review/keyfig.html?g=<g>&<query> and writes the canvas. Console output (measurements) is printed.
import { createRequire } from 'node:module';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core'), sharp = require('sharp');
const [g, outFile, q = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 2600, height: 1200 }, deviceScaleFactor: 1 });
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); }); page.on('console', (m) => console.log('console:', m.text().slice(0, 2000))); page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/src/muye2/art/puppets/review/keyfig.html?g=' + g + (q ? '&' + q : ''));
await page.waitForFunction(() => document.title === 'ready' || document.title.startsWith('error'), null, { timeout: 180000 }).catch(() => console.log('did not become ready'));
console.log('title:', await page.title().catch(() => '?'));
const shot = await (await page.$('#c')).screenshot();
const img = sharp(shot), m = await img.metadata();
if (outFile.endsWith('.png')) await img.png().toFile(outFile); else await img.webp({ quality: Number(process.env.Q || 86) }).toFile(outFile);
console.log(outFile, m.width, m.height);
await browser.close();
