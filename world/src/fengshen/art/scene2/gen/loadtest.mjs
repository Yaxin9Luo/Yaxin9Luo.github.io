// node gen/loadtest.mjs    Progressive loading, checked: the files of places 2..5 are held back; loadScene() must still
// resolve, place 1 must draw, and a late place must fade in (three stills: before it comes, 0.25 s after, 1.2 s after).
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; import {writeFileSync} from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.route('**/@vite/client', r => r.fulfill({contentType: 'text/javascript', body: 'export const createHotContext = () => ({accept() {}, dispose() {}, prune() {}, on() {}, off() {}, invalidate() {}, send() {}, data: {}}); export const updateStyle = () => {}; export const removeStyle = () => {}; export const injectQuery = (u) => u;'}));
let release; const gate = new Promise(r => { release = r }); const sizes = {first: 0, later: 0, files: {}};
await page.route(/baked\/(set-[2-5]|atlas-f[2-5])/, async r => { await gate; r.continue() });
page.on('response', async r => { const m = r.url().match(/baked\/([^?]+)/); if (!m || r.status() !== 200) return; const n = (await r.body()).length; sizes.files[m[1]] = n; if (/set-[2-5]|atlas-f[2-5]/.test(m[1])) sizes.later += n; else sizes.first += n });
const t0 = Date.now();
await page.goto('http://localhost:5173/src/fengshen/art/scene2/preview.html?auto=0&clean=1&x=1440&t=0.3&figs=0'); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000});
const state = () => page.evaluate(() => ({ready: [1, 2, 3, 4, 5].map(n => window.preview.scene.ready(n)), progress: window.preview.scene.progress()}));
const shot = async () => { await page.evaluate(() => window.preview.step(1 / 60, 2)); return sharp(await page.screenshot()).resize(480, 300).png().toBuffer() };
const out = {resolvedWithOnlyPlace1: await state()}, cells = [await shot()];
release(); await page.waitForFunction(() => window.preview.scene.ready(2)); await page.waitForTimeout(250); cells.push(await shot());
await page.evaluate(() => window.preview.scene.whenAll); await page.waitForTimeout(1200); cells.push(await shot()); out.afterAll = await state();
out.bytes = {neededBeforeLoadSceneResolves: sizes.first, comeAfter: sizes.later, total: sizes.first + sizes.later};
await sharp({create: {width: 486 * 3 - 6, height: 300, channels: 3, background: '#2a2622'}}).composite(cells.map((input, i) => ({input, left: i * 486, top: 0}))).png().toFile(join(rv, 'loading.png'));
writeFileSync(join(rv, 'loading.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out)); await browser.close();
