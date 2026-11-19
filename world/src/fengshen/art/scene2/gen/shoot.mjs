// node gen/shoot.mjs [places] [times] [strip] [bench] [probe]     (the site's dev server must be up on 5173; it is not restarted here)
// Stills of scene2 from the preview page, into ../review/. All at 1440 x 900, framed as the game frames the world.
//   places: place-1..5.png (figures in front)    times: time-dawn/day/dusk.png    strip: nine views along the road, small
//   bench: frame cost to review/bench.json       probe: one still, X=2400 T=0.5 FIGS=0 OUT=probe.png
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review'), has = k => process.argv.includes(k);
const BASE = process.env.SCENE_URL || 'http://localhost:5173/src/fengshen/art/scene2/preview.html';
const PL = [560, 1440, 2400, 3360, 4240], tOf = x => (x - 273) / 4254;
const browser = await chromium.launch({channel: 'chrome', headless: !has('headed'), args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']});
const open = async (q, vp = {width: 1440, height: 900}) => { const page = await browser.newPage({viewport: vp, deviceScaleFactor: +(process.env.DPR || 1)});
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()) }); page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.route('**/@vite/client', r => r.fulfill({contentType: 'text/javascript', body: 'export const createHotContext = () => ({accept() {}, dispose() {}, prune() {}, on() {}, off() {}, invalidate() {}, send() {}, data: {}}); export const updateStyle = () => {}; export const removeStyle = () => {}; export const injectQuery = (u) => u;'}));   // other sessions edit files; no reloads in the middle of a measure
  await page.goto(BASE + '?' + q); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000}); return page };
const still = async (page, x, t, file, secs = 3) => { await page.evaluate(([x, t, secs]) => { window.preview.set(x, t); window.preview.step(1 / 30, 30 * secs) }, [x, t, secs]); await page.screenshot({path: join(rv, file)}) };

if (has('probe')) { const page = await open(`auto=0&clean=1&x=${process.env.X || 2400}&figs=${process.env.FIGS || 0}`); await still(page, +(process.env.X || 2400), +(process.env.T ?? tOf(+(process.env.X || 2400))), process.env.OUT || 'probe.png'); await page.close() }
if (has('places')) { const page = await open('auto=0&clean=1&x=560&figs=' + (process.env.FIGS || 1)); for (let i = 0; i < 5; i++) await still(page, PL[i], tOf(PL[i]), `${process.env.PRE || ''}place-${i + 1}.png`); await page.close() }
if (has('times')) { const page = await open('auto=0&clean=1&x=2400&figs=1'); for (const [n, t] of [['dawn', 0], ['day', .5], ['dusk', 1]]) await still(page, +(process.env.X || 2400), t, `time-${n}.png`); await page.close() }
if (has('strip')) { const page = await open('auto=0&clean=1&x=560&figs=0'), cells = [], xs = [273, 560, 1000, 1440, 1920, 2400, 2880, 3360, 3800, 4240, 4527], w = 480, h = 300;
  for (const x of xs) { await page.evaluate(([x, t]) => { window.preview.set(x, t); window.preview.step(1 / 30, 60) }, [x, tOf(x)]); cells.push(await sharp(await page.screenshot()).resize(w, h).png().toBuffer()) }
  await sharp({create: {width: (w + 6) * 4 - 6, height: (h + 6) * 3 - 6, channels: 3, background: '#2a2622'}}).composite(cells.map((input, i) => ({input, left: (i % 4) * (w + 6), top: Math.floor(i / 4) * (h + 6)}))).png().toFile(join(rv, 'strip.png')); await page.close() }
if (has('bench')) { const page = await open('mode=bench&figs=0&n=' + (process.env.N || 600)); const r = await page.evaluate(() => window.__bench); console.log(JSON.stringify(r)); writeFileSync(join(rv, `bench${process.env.DPR === '2' ? '-dpr2' : ''}.json`), JSON.stringify(r, null, 1)); await page.close() }
if (has('motion')) {   // is it alive, and is it quiet? Four stills 0.8 s apart per place, no figures: how much of the frame changes, and by how much
  const page = await open('auto=0&clean=1&x=560&figs=0'), out = {}, strips = [];
  for (let n = 0; n < 5; n++) { const x = PL[n], shots = [];
    await page.evaluate(([x, t]) => { window.preview.set(x, t); window.preview.step(1 / 30, 60) }, [x, tOf(x)]);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.preview.step(1 / 30, 24)); shots.push(await sharp(await page.screenshot()).removeAlpha().raw().toBuffer()) }
    let changed = 0, sum = 0, max = 0; const a = shots[0], b = shots[3]; for (let i = 0; i < a.length; i += 3) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; if (d > 6) { changed++; sum += d; if (d > max) max = d } }
    out['place-' + (n + 1)] = {changedShare: +(changed / (a.length / 3)).toFixed(4), meanChange: changed ? +(sum / changed / 2.55).toFixed(1) : 0, maxChange: +(max / 2.55).toFixed(1)};
    if (n < 3) { const crop = [[520, 300, 360, 150], [560, 500, 360, 150], [700, 300, 200, 260]][n]; for (const s of shots) strips.push(await sharp(s, {raw: {width: 1440, height: 900, channels: 3}}).extract({left: crop[0], top: crop[1], width: crop[2], height: crop[3]}).resize(360, 150, {fit: 'contain', background: '#2a2622'}).png().toBuffer()) } }
  await sharp({create: {width: 366 * 4 - 6, height: 156 * 3 - 6, channels: 3, background: '#2a2622'}}).composite(strips.map((input, i) => ({input, left: (i % 4) * 366, top: Math.floor(i / 4) * 156}))).png().toFile(join(rv, 'motion.png'));
  writeFileSync(join(rv, 'motion.json'), JSON.stringify({note: 'four stills 0.8 s apart; changedShare: share of pixels that differ between the first and last by more than 6/255; meanChange and maxChange in % of full scale', ...out}, null, 1)); console.log(JSON.stringify(out)); await page.close() }
await browser.close();
