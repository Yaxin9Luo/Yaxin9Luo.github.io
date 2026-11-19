// node gen/shoot.mjs [strips] [elements] [scale] [bursts] [sil] [bench] [only=<strip name>]
// (the site's dev server must be up on 5173; it is not restarted here). Writes into ../review/.
//   strips    one strip per effect: eight frames across its life (60 frames a second; the frame numbers are in STRIPS)
//   elements  the strike in its five elements, side by side, at the frame of contact and two frames of the scatter
//   scale     the same impact at 1x, 2x and 3x
//   bursts    the five boon bursts, five frames each, the whole screen
//   sil       every strip again as black silhouettes, in one sheet
//   bench     the cost of drawUnder + drawOver in a heavy fight at 1440 x 900, to review/bench.json
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../../../package.json'));
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(here, '..', 'review');
const BASE = process.env.FX_URL || 'http://localhost:5173/src/fengshen/art/fx2/preview.html', has = k => process.argv.includes(k);
const only = (process.argv.find(a => a.startsWith('only=')) || '').slice(5);

// name of the file: [button in the preview, frames to show (1 = the frame the event is drawn in), clip x, y, w, h (CSS px of 1440 x 900), setup]
const STRIPS = {
  'strike': ['strike', [1, 2, 3, 4, 5, 7, 10, 14], 470, 440, 420, 350],
  'strike-riding': ['strike', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 430, 440, 420, 350, {vx: 480}],
  'sweep-riding': ['sweep', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 430, 500, 560, 290, {vx: 480}],
  'sweep': ['sweep', [1, 2, 3, 4, 6, 8, 11, 16], 440, 500, 620, 290],
  'sweep-full': ['sweep · full', [1, 2, 3, 4, 6, 8, 12, 18], 440, 470, 720, 320],
  'leap-strike': ['leap strike', [1, 2, 3, 4, 6, 9, 13, 22], 420, 440, 500, 350],
  'break-through': ['break-through (1 s)', [1, 4, 10, 20, 31, 34, 40, 66], 300, 500, 620, 290, {follow: true}],
  'flame-gallop': ['flame gallop', [2, 8, 16, 30, 60, 110, 150, 172], 380, 560, 1000, 230],
  'rally': ['rally', [2, 5, 9, 14, 20, 30, 40, 50], 330, 540, 500, 250],
  'impact': ['hit ×2', [1, 2, 4, 6, 9, 13, 18, 26], 600, 520, 440, 270],
  'shield-block': ['shield block', [1, 2, 3, 5, 7, 10, 14, 18], 620, 590, 280, 190],
  'braced': ['braced (hero stopped)', [1, 2, 4, 6, 9, 13, 18, 24], 600, 570, 320, 210],
  'trample': ['trample · kill', [1, 2, 4, 7, 11, 16, 24, 40], 440, 600, 400, 190],
  'arrow-hit': ['arrow hit', [1, 2, 4, 6, 8, 10, 13, 18], 380, 600, 320, 180],
  'fall': ['fall', [1, 2, 4, 7, 11, 16, 24, 40], 380, 430, 460, 350],
  'death-mark': ['clash · kill (death mark)', [1, 2, 4, 7, 11, 16, 30, 60], 640, 610, 280, 180],
  'horn': ["captain's horn", [1, 4, 8, 12, 16, 22, 30, 40], 780, 480, 500, 280],
  'hurt': ['hurt', [1, 2, 4, 6, 9, 12, 16, 22], 440, 480, 360, 290],
  'boon-emberBlade': ['strike · fire (emberBlade)', [2, 3, 5, 8, 12, 40, 100, 150], 470, 440, 420, 350],
  'boon-wildfire': ['flame gallop · wildfire', [20, 50, 62, 70, 74, 80, 90, 150], 340, 440, 1080, 350, {follow: false}],
  'boon-coldTide': ['sweep · water (coldTide)', [3, 7, 12, 18, 26, 34, 50, 70], 440, 540, 860, 250],
  'boon-spring': ['mend (spring)', [3, 8, 14, 20, 28, 36, 44, 52], 230, 590, 320, 190],
  'boon-galeLeap': ['leap strike · wood (galeLeap)', [2, 5, 7, 10, 14, 20, 28, 40], 380, 470, 580, 320],
  'boon-arrowRain': ['loose · arrowRain', [1, 2, 4, 6, 8, 11, 15, 22], 230, 590, 320, 190],
  'boon-keenEdge': ['gold blow (keenEdge)', [1, 2, 3, 5, 8, 11, 15, 20], 480, 560, 560, 230],
  'boon-mirrorShields': ['shield block · mirrorShields', [1, 2, 4, 6, 8, 11, 15, 20], 250, 520, 420, 260],
  'boon-quake': ['leap strike · earth (quake)', [2, 5, 8, 11, 16, 40, 70, 82], 260, 470, 800, 320],
  'boon-deepRoots': ['braced · deepRoots breaks it', [1, 2, 4, 6, 9, 13, 18, 26], 540, 560, 400, 230],
};

const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: +(process.env.DPR || 1)});
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()) }); page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(BASE + '?auto=0&clean=1'); await page.waitForFunction(() => document.title === 'ready', null, {timeout: 120000});
const sheet = async (file, cells, w, h, cols, scale = 1) => { const img = sharp({create: {width: w * cols, height: h * Math.ceil(cells.length / cols), channels: 3, background: '#EFE7D6'}})
  .composite(cells.map((input, i) => ({input, left: (i % cols) * w, top: Math.floor(i / cols) * h}))).png();
  if (scale !== 1) await sharp(await img.toBuffer()).resize(Math.round(w * cols * scale)).png().toFile(join(rv, file)); else await img.toFile(join(rv, file)); console.log(file) };
async function shots(spec, set = {}) { for (let i = 0; ; i++) { try { return await shots1(spec, set) } catch (e) { if (i >= 3) throw e; await page.waitForTimeout(1500); await page.waitForFunction(() => document.title === 'ready' && window.fxp, null, {timeout: 120000}) } } }
async function shots1(spec, set = {}) {
  const [name, frames, x, y, w, h, o = {}] = spec, cells = [];
  await page.evaluate(([s]) => { window.fxp.reset(); window.fxp.set({sil: false, only: false, thread: false, ...s}); window.fxp.step(1) }, [set]);
  if (o.vx) await page.evaluate(v => { const f = window.fxp; f.game.hero.vx = v; f.set({ride: true}); f.step(20) }, o.vx);
  await page.evaluate(n => window.fxp.fire(n), name);
  let f = 0;
  for (const want of frames) { await page.evaluate(n => window.fxp.step(n), want - f); f = want;
    const dx = o.follow ? await page.evaluate(() => window.fxp.cam.x - 700 - 140) : 0; void dx;
    cells.push(await page.screenshot({clip: {x, y, width: w, height: h}})) }
  return cells;
}

if (has('strips')) for (const [file, spec] of Object.entries(STRIPS)) { if (only && only !== file) continue; await sheet(file + '.png', await shots(spec), spec[4], spec[5], spec[1].length > 8 ? 6 : 8) }
if (has('thread')) { const spec = STRIPS['boon-emberBlade']; await sheet('thread.png', [...await shots(['strike · fire (emberBlade)', [7, 10], ...spec.slice(2, 6)]), ...await shots(['strike · fire (emberBlade)', [7, 10], ...spec.slice(2, 6)], {thread: true}),
  ...await shots(['leap strike · earth (quake)', [8, 16], ...spec.slice(2, 6)]), ...await shots(['leap strike · earth (quake)', [8, 16], ...spec.slice(2, 6)], {thread: true})], spec[4], spec[5], 4) }
if (has('elements')) { const cells = [];
  for (const n of ['strike', 'strike · fire (emberBlade)', 'strike · water', 'strike · wood', 'strike · metal (keenEdge)', 'strike · earth']) cells.push(await shots([n, [3, 5, 8, 12], 470, 440, 420, 350]));
  await sheet('elements.png', [0, 1, 2, 3].flatMap(r => cells.map(c => c[r])), 420, 350, 6) }
if (has('scale')) { const cells = [];      // rows: the whole strike at 1x, 2x, 3x and 3.5x (the rider at that speed, then the hit), frames 3, 5, 7, 10 after the swing
  for (const m of [1, 2, 3, 3.5]) { await page.evaluate(() => { window.fxp.reset(); window.fxp.set({sil: false, only: false, thread: false}); window.fxp.step(1) });
    await page.evaluate(m => { const f = window.fxp, h = f.game.hero, x = 720 - 16; h.vx = (m - 1) * 200; h.x = x - 120 - h.vx * 0.065 - h.vx * 4 / 60; h.px = h.x; f.set({ride: false}); f.step(4); f.blow(m, x) }, m);
    let at = 0; for (const want of [3, 5, 7, 10]) { await page.evaluate(n => window.fxp.step(n), want - at); at = want; cells.push(await page.screenshot({clip: {x: 500, y: 410, width: 440, height: 380}})) } }
  await sheet('scale.png', cells, 440, 380, 4) }
if (has('bursts')) { const cells = []; for (const el of ['fire', 'water', 'wood', 'metal', 'earth']) cells.push(...await shots(['boon · ' + el, [4, 10, 16, 24, 34, 46], 0, 0, 1440, 900]));
  const small = await Promise.all(cells.map(c => sharp(c).resize(480).png().toBuffer())); await sheet('boon-bursts.png', small, 480, 300, 6) }
if (has('sil')) { const cells = [];
  for (const [file, spec] of Object.entries(STRIPS)) { if (file.endsWith('-riding')) continue; const c = await shots(spec, {sil: true}); const w = 240, h = 150;
    for (const b of c) cells.push(await sharp(b).resize(w, h, {fit: 'contain', background: '#EFE7D6'}).png().toBuffer()) }
  await sheet('silhouettes.png', cells, 240, 150, 8) }
if (has('bench')) { const runs = []; for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.fxp.bench(8))); console.log(JSON.stringify(runs)); writeFileSync(join(rv, 'bench.json'), JSON.stringify(runs, null, 1)) }
if (has('probe')) { const name = process.env.NAME, frames = (process.env.FRAMES || '1,3,6,10,16,24').split(',').map(Number), c = (process.env.CLIP || '300,380,840,420').split(',').map(Number);
  await sheet(process.env.OUT || '_probe.png', await shots([name, frames, ...c], JSON.parse(process.env.SET || '{}')), c[2], c[3], +(process.env.COLS || 3)) }
await browser.close();
