// node .../bench-stages.mjs -> software-raster cost of each stage of the new ground (flush on, 1x): whole minus the stage
import { createRequire } from 'node:module';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), { chromium } = require('playwright-core');
const B = 'http://127.0.0.1:5173/src/muye2/art/ground/gen/bench.html', browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const skip of (process.argv[2] || ',land,river,patches,mist,far').split(',')) { const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${B}?which=new&weather=${process.argv[3] || 'clear'}&frames=150&flush=1&skip=${skip}`); await page.waitForFunction(() => window.__bench, null, { timeout: 300000 });
  const r = await page.evaluate(() => window.__bench); console.log((skip || 'none').padEnd(8), r.mean.toFixed(2), r.median.toFixed(2)); await page.close(); }
await browser.close();
