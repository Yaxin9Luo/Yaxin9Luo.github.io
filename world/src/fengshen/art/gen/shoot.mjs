// node gen/shoot.mjs [states] [scroll] [motion] [bench] [probe]   (the site's dev server must be up on 5173; it is not restarted here)
// Writes into ../review/. states: states.png; scroll: scroll-1..4.png; motion: strips of the gallop, the blow and each telegraph;
// bench: the frame cost at 1440 x 900 with 30 figures, to review/bench.json.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(dirname(fileURLToPath(import.meta.url)), '..', 'review');
const BASE = process.env.ART_URL || 'http://localhost:5173/src/fengshen/art/dev-preview.html', has = k => process.argv.includes(k);
const HEAD = has('headed');
const browser = await chromium.launch({channel: 'chrome', headless: !HEAD});
const open = async (q, vp = {width: 1440, height: 900}) => { const page = await browser.newPage({viewport: vp, deviceScaleFactor: 1});
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()) }); page.on('pageerror', e => console.log('pageerror:', e.message));
  for (let i = 0; ; i++) { try { await page.goto(BASE + '?' + q); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000}); break } catch (e) { if (i >= 2) throw e } }
  return page };
const strip = async (name, cells, w, h, cols) => sharp({create: {width: w * cols, height: h * Math.ceil(cells.length / cols), channels: 3, background: '#EFE7D6'}})
  .composite(cells.map((input, i) => ({input, left: (i % cols) * w, top: Math.floor(i / cols) * h}))).png().toFile(join(rv, name));

if (has('probe')) { const page = await open('auto=0&clean=1&time=' + (process.env.T || 0) + '&at=' + (process.env.AT || 260)); await page.evaluate(n => window.preview.step(n), +(process.env.N || 60)); await page.screenshot({path: join(rv, process.env.OUT || 'probe.png')}); await page.close() }
if (has('states')) for (const [part, file] of [['hero', 'states.png'], ['zhou', 'states-zhou.png'], ['shang', 'states-shang.png']]) { const page = await open('mode=states&part=' + part, {width: 3360, height: 1200}); const el = await page.$('#c'); await el.screenshot({path: join(rv, file)}); await page.close() }
if (has('verbs')) { const page = await open('mode=states&part=verbs', {width: 3000, height: 1200}); await (await page.$('#c')).screenshot({path: join(rv, 'hero-verbs.png')}); await page.close() }
if (has('telegraph')) { const p2 = await open('mode=telegraph', {width: 3100, height: 1200}); await (await p2.$('#c')).screenshot({path: join(rv, 'motion-telegraphs.png')}); await p2.close() }
if (has('verbmotion')) {   // the new verbs in the scripted battle, every second frame (60/s)
  const page = await open('auto=0&clean=1&time=0&verbs=1&boons=1');
  const run = async (name, toX, frames, every, cols, w = 620) => { await page.evaluate(x => window.preview.runTo(x), toX); const cells = [];
    for (let f = 0; f < frames; f++) { await page.evaluate(() => window.preview.step(1)); if (f % every) continue;
      const p = await page.evaluate(() => { const g = window.preview.game; return window.preview.art.toScreen(window.preview.cam, g.hero.x, 0) });
      cells.push(await page.screenshot({clip: {x: Math.max(0, Math.min(1440 - w, Math.round(p[0] - w * 0.42))), y: Math.round(p[1] - 340), width: w, height: 420}})) }
    await strip(name, cells, w, 420, cols) };
  await run('motion-sweep.png', 696, 78, 3, 6); await run('motion-leapstrike.png', 1176, 66, 3, 6); await run('motion-dash.png', 1690, 48, 3, 6); await run('motion-rally.png', 2696, 60, 4, 5);
  await page.close() }
if (has('scroll')) { const page = await open('auto=0&clean=1');
  // four views along the road, each taken while the scripted battle is going on there
  let i = 1; for (const x of [640, 1430, 2700, 4080]) { await page.evaluate(x => window.preview.runTo(x), x); await page.evaluate(() => window.preview.step(1)); await page.screenshot({path: join(rv, `scroll-${i++}.png`)}) }
  await page.close() }
if (has('motion')) {
  const page = await open('auto=0&clean=1&time=0');
  const hero = async (name, toX, frames, every, cols) => { await page.evaluate(x => window.preview.runTo(x), toX); const cells = [];
    for (let f = 0; f < frames; f++) { await page.evaluate(() => window.preview.step(1)); if (f % every) continue;
      const p = await page.evaluate(() => { const g = window.preview.game, a = window.preview.art; return a.toScreen(window.preview.cam, g.hero.x, 0) });
      cells.push(await page.screenshot({clip: {x: Math.max(0, Math.round(p[0] - 250)), y: Math.round(p[1] - 330), width: 520, height: 400}})) }
    await strip(name, cells, 520, 400, cols) };
  await hero('motion-gallop.png', 1160, 24, 1, 6);          // 0.4 s of the gallop, every frame (60/s): a little more than one stride
  await hero('motion-strike.png', 1365, 30, 1, 6);          // the blow at x 1370: every frame for half a second
  await hero('motion-leap.png', 2690, 48, 2, 6);            // the leap at x 2700
  await hero('motion-stopped.png', 3325, 60, 3, 5);         // stopped by the braced spear at x 3330
  await page.close();
}
if (has('refuse')) {   // the two refusals, every frame (60/s): a leap pressed below leap speed, then a strike pressed in the recovery
  const page = await open('auto=0&clean=1&time=0&fall=99999'); const cells = [];
  const shot = async () => { const p = await page.evaluate(() => { const g = window.preview.game; return window.preview.art.toScreen(window.preview.cam, g.hero.x, 0) }); cells.push(await page.screenshot({clip: {x: Math.max(0, Math.round(p[0] - 200)), y: Math.round(p[1] - 310), width: 420, height: 360}})) };
  await page.evaluate(() => window.preview.step(12)); await page.evaluate(() => window.preview.art.onEvent({type: 'refuse', what: 'leap'}, window.preview.game));
  for (let f = 0; f < 24; f++) { await page.evaluate(() => window.preview.step(1)); await shot() }
  await page.evaluate(() => window.preview.runTo(1380)); await page.evaluate(() => window.preview.step(22)); await page.evaluate(() => window.preview.art.onEvent({type: 'refuse', what: 'strike'}, window.preview.game));
  for (let f = 0; f < 12; f++) { await page.evaluate(() => window.preview.step(1)); await shot() }
  await strip('motion-refuse.png', cells, 420, 360, 12); await page.close() }
if (has('crowd')) { const page = await open('mode=crowd', {width: 4560, height: 1200}); await (await page.$('#c')).screenshot({path: join(rv, 'crowd.png')});
  const v = await page.evaluate(() => window.__value); console.log(JSON.stringify(v)); writeFileSync(join(rv, 'value.json'), JSON.stringify(v, null, 1)); await page.close() }
if (has('lanes')) { const page = await open('mode=lanes', {width: 2260, height: 1200}); await (await page.$('#c')).screenshot({path: join(rv, 'lanes.png')}); await page.close() }
if (has('fall')) {   // the fall at a gallop, every third frame for two seconds (60/s), the rider thrown back
  const page = await open('auto=0&clean=1&time=0&fall=' + (process.env.FALLX || 950) + '&dir=' + (process.env.DIR || -1)); await page.evaluate(x => window.preview.runTo(x), +(process.env.FALLX || 950) - 4); const cells = [];
  for (let f = 0; f < 120; f++) { await page.evaluate(() => window.preview.step(1)); if (f % 3) continue;
    const p = await page.evaluate(() => { const g = window.preview.game; return window.preview.art.toScreen(window.preview.cam, g.hero.x, 0) });
    cells.push(await page.screenshot({clip: {x: Math.max(0, Math.min(1440 - 700, Math.round(p[0] - 440))), y: Math.round(p[1] - 330), width: 700, height: 400}})) }
  await strip(process.env.OUT || 'motion-fall.png', cells, 700, 400, 5); await page.close() }
if (has('bench')) { const page = await open('mode=bench&w=1440&h=900&n=600&' + (process.env.BQ || 'time=0.5')); const r = await page.evaluate(() => window.__bench); console.log(JSON.stringify(r)); writeFileSync(join(rv, 'bench.json'), JSON.stringify(r, null, 1)); await page.close() }
await browser.close();
