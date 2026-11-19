// node gen/sample.mjs [out.json]   : the preview's own sampling (see preview.js: sample, hitSizes), headless Chrome, 1440 x 900.
// Prints and writes ../review/<out> : share of a winding-up foe's box under effect paint, ground-mark density, a hit's size by multiplier.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const {chromium} = createRequire(join(here, '../../../../../package.json'))('playwright-core');
const b = await chromium.launch({channel: 'chrome', headless: true});
const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
p.on('pageerror', e => console.log('pageerror:', e.message));
const run = async () => { await p.goto('http://localhost:5173/src/fengshen/art/fx2/preview.html?auto=0&clean=1'); await p.waitForFunction(() => document.title === 'ready' && window.fxp, null, {timeout: 120000});
  return p.evaluate(() => ({moving: window.fxp.sample({seconds: 40, speed: 150}), standing: window.fxp.sample({seconds: 60, speed: 0}), hit: window.fxp.hitSizes(), blow: window.fxp.hitSizes([1, 1.5, 2, 2.5, 3, 3.5], true)})) };
let r; for (let i = 0; ; i++) { try { r = await run(); break } catch (e) { if (i >= 4) throw e; await p.waitForTimeout(1500) } }
console.log(JSON.stringify(r, null, 1)); writeFileSync(join(here, '..', 'review', process.argv[2] || 'sample.json'), JSON.stringify(r, null, 1)); await b.close();
