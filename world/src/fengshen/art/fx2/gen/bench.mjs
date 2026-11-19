// node gen/bench.mjs   : the cost of fx2 in a heavy fight, in a real (headed, GPU) Chrome at 1440 x 900, one frame per animation frame.
// Writes ../review/bench.json. The dev server must be up on 5173.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const {chromium} = createRequire(join(here, '../../../../../package.json'))('playwright-core');
const b = await chromium.launch({channel: 'chrome', headless: false});
const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: +(process.env.DPR || 1)});
await p.goto('http://localhost:5173/src/fengshen/art/fx2/preview.html?auto=0&clean=1' + (process.env.Q || '')); await p.waitForFunction(() => document.title === 'ready');
// Measured with the effects alone over paper (`only`): in this preview the game's own art stalls the canvas after the camera has ridden
// about 1200 px (13 ms -> 250 ms a frame with no effect drawn at all), and every draw call made while it is stalled is slow, fx2's too.
const once = () => p.evaluate(async () => { const f = window.fxp, runs = []; f.set({only: true}); for (let i = 0; i < 3; i++) runs.push(await f.bench(4));
  const C = CanvasRenderingContext2D.prototype, orig = C.drawImage; let n = 0; C.drawImage = function () { n++; return orig.apply(this, arguments) }; await f.bench(4); C.drawImage = orig; f.set({only: false});
  const g = document.createElement('canvas').getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info');
  return {mode: 'effects alone over paper, heavy fight, one frame per animation frame, headed Chrome', runs, fxDrawImagesPerFrame: Math.round(n / 240), gpu: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'} });
let r; for (let i = 0; ; i++) { try { r = await once(); break } catch (e) { if (i >= 6) throw e; await p.waitForTimeout(1500); await p.waitForFunction(() => document.title === 'ready' && window.fxp, null, {timeout: 60000}) } }   // the page reloads when another session saves a file
console.log(JSON.stringify(r)); writeFileSync(join(here, '..', 'review', 'bench.json'), JSON.stringify(r, null, 1)); await b.close();
