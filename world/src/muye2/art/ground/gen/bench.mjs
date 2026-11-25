// node world/src/muye2/art/ground/gen/bench.mjs   -> the ground's draw time, old and new, at 1x and 4x CPU throttle (headless Chrome, 1440 x 900, dpr 1)
import { createRequire } from 'node:module';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), { chromium } = require('playwright-core');
const B = (process.env.MUYE_URL || 'http://127.0.0.1:5173') + '/src/muye2/art/ground/gen/bench.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true }), out = [];
for (const [which, weather, scene] of [['old', '', ''], ['new', 'clear', 'xiqi'], ['new', 'rain', 'xiqi'], ['new', 'snow', 'xiqi'], ['new', 'clear', 'passes'], ['new', 'dust', 'passes'], ['new', 'clear', 'mengjin'], ['new', 'rain', 'mengjin']]) for (const rate of [1, 4]) for (const flush of [0, 1]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  page.on('pageerror', (e) => console.log('[err]', e.message));
  await page.goto(`${B}?which=${which}&weather=${weather}&scene=${scene}&frames=240&flush=${flush}`); await page.waitForFunction(() => window.__bench, null, { timeout: 300000 });
  const r = await page.evaluate(() => window.__bench); const row = { which, scene, weather, throttle: rate + 'x', flush: !!flush, mean: +r.mean.toFixed(2), median: +r.median.toFixed(2), p95: +r.p95.toFixed(2), max: +r.max.toFixed(2) }; out.push(row); console.log(JSON.stringify(row)); await page.close(); }
await browser.close(); console.log(JSON.stringify(out));
