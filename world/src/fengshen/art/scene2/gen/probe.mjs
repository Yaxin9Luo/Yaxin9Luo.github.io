// node gen/probe.mjs [headed] [save]    What the scene costs a frame, measured so that rasterising is counted: each frame
// draws the scene K times and the frame is timed from its start to the start of the next (requestAnimationFrame to
// requestAnimationFrame), so work the browser defers is paid inside the measure. Cost of one draw = (gap(K) - gap(0)) / K.
// Headless Chrome is the software path. Also: the JavaScript time of the calls alone, and the old scene the same way.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs'; import {execSync} from 'node:child_process';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const {chromium} = require('playwright-core');
const headed = process.argv.includes('headed');
const browser = await chromium.launch({channel: 'chrome', headless: !headed, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: +(process.env.DPR || 1)});
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.route('**/@vite/client', r => r.fulfill({contentType: 'text/javascript', body: 'export const createHotContext = () => ({accept() {}, dispose() {}, prune() {}, on() {}, off() {}, invalidate() {}, send() {}, data: {}}); export const updateStyle = () => {}; export const removeStyle = () => {}; export const injectQuery = (u) => u;'}));   // other sessions edit files; no reloads in the middle of a measure
await page.goto('http://localhost:5173/src/fengshen/art/scene2/preview.html?auto=0&clean=1&x=2400&figs=1'); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000});
const r = await page.evaluate(async (variants) => { const p = window.preview, ctx = document.getElementById('c').getContext('2d'), out = {}, D = p.scene.debug.DBG || {};
  const raf = () => new Promise(r => requestAnimationFrame(r)), med = v => { v = [...v].sort((a, b) => a - b); return v[Math.floor(v.length / 2)] }, mean = v => v.reduce((a, b) => a + b, 0) / v.length;
  const scene2 = () => { p.scene.drawBack(ctx, p.cam); p.scene.drawMid(ctx, p.cam, 1 / 60); p.scene.drawFront(ctx, p.cam, 1 / 60) }, old = () => { p.art.drawBack(ctx, p.cam); p.art.drawFront(ctx, p.cam) };
  // gap with K draws a frame; the camera rides the whole road and the time of day follows it
  const run = async (fn, K, N = +(new URLSearchParams(location.search).get("n") || 30)) => { const gaps = [], js = []; let last = await raf(); for (let i = 0; i < N; i++) { p.cam.x = 273 + (i / N) * 4254; p.scene.setTime(i / N); const a = performance.now(); for (let k = 0; k < K; k++) fn(); js.push((performance.now() - a) / Math.max(1, K)); const now = await raf(); gaps.push(now - last); last = now } return {gap: mean(gaps), js: mean(js), jsMed: med(js)} };
  const cost = async (fn) => { const a = await run(fn, 1), b = await run(fn, 5); return {perDraw: +((b.gap - a.gap) / 4).toFixed(2), jsMean: +a.js.toFixed(2), jsMedian: +a.jsMed.toFixed(2), gap1: +a.gap.toFixed(1), gap5: +b.gap.toFixed(1)} };
  out.idle = +(await run(() => {}, 0)).gap.toFixed(1);
  out.scene2 = await cost(scene2); if (p.art) out.oldScene = await cost(old);
  for (const v of variants) { for (const k in D) D[k] = 1; for (const k of v.split('+')) if (k) D[k] = 0; out['without ' + v] = await cost(scene2) } for (const k in D) D[k] = 1;
  return out }, (process.env.VARIANTS || '').split(',').filter(Boolean));
r.loadAverage = execSync('uptime').toString().trim().split('load averages:')[1].trim(); r.view = [1440, 900, +(process.env.DPR || 1)]; r.browser = headed ? 'headed Chrome (GPU)' : 'headless Chrome (software)';
console.log(JSON.stringify(r, null, 1));
if (process.argv.includes('save')) writeFileSync(new URL('../review/bench-' + (process.env.TAG || (headed ? 'headed' : 'headless')) + '.json', import.meta.url), JSON.stringify(r, null, 1));
await browser.close();
