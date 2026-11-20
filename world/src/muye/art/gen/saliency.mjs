// The hero's saliency at density, by the tester's own measure (lab/game-studies/testing/tools-survivors/density.py):
// greyscale, 8 px blur, the hero's box ranked among all boxes of his size by contrast with the 50 px round them.
// Stills come from the art preview (real rules, no spawning) at 120, 200 and 300 foes, three seeds each.
//   node gen/saliency.mjs <out dir> [extra query, e.g. "pocket=0"] [--time=1]
// Writes <out>/density.json and the stills as jpg, then runs density.py on them (density-review.json, _density-sheet.jpg).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), { chromium } = require('playwright-core');
const out = process.argv[2], extra = process.argv[3] && !process.argv[3].startsWith('--') ? '&' + process.argv[3] : '';
if (!out) { console.log('usage: node gen/saliency.mjs <out dir> [query]'); process.exit(1); }
mkdirSync(out, { recursive: true });
const URL0 = (process.env.MUYE_URL || 'http://localhost:5173') + '/src/muye/art/preview.html';
const CASES = []; for (const [n, allies, warm] of [[120, 14, 2.5], [200, 26, 2.2], [300, 40, 2]]) for (const seed of [3, 5, 8]) CASES.push({ n, allies, warm, seed });
const browser = await chromium.launch({ channel: 'chrome', headless: true }), stills = [];
for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;' }));
  page.on('pageerror', (e) => console.log('  [page error]', e.message.slice(0, 300)));
  await page.goto(`${URL0}?n=${c.n}&allies=${c.allies}&warm=${c.warm}&seed=${c.seed}&still=1${extra}`);
  await page.waitForFunction(() => window.__preview && window.__preview.ready, null, { timeout: 120000 });
  const m = await page.evaluate(() => { const p = __preview, g = p.game, cam = p.cam, KY = p.art.KY, W = innerWidth, H = innerHeight, z = cam.zoom;
    const scr = (u) => [Math.round(W / 2 + (u.x - cam.x) * z), Math.round(H * 0.52 + (u.y - cam.y) * KY * z)], inView = (q) => q[0] > 0 && q[0] < W && q[1] > 0 && q[1] < H, pts = (l, f) => l.filter(f).map(scr).filter(inView);
    return { t: +(g.t || 0).toFixed(1), hero: scr(g.hero), view: [W, H], zoom: z, foes: pts(g.foes, (f) => f.state !== 'dead' && !f.elite), elites: pts(g.foes, (f) => f.state !== 'dead' && f.elite), allies: pts(g.allies, (f) => f.state !== 'dead'),
      shotsZhou: pts(g.shots, (q) => q.side !== 'shang'), shotsShang: pts(g.shots, (q) => q.side === 'shang') }; });
  m.file = `n${c.n}-seed${c.seed}.jpg`; m.why = `sent ${c.n}, seed ${c.seed}`; await page.screenshot({ path: `${out}/${m.file}`, type: 'jpeg', quality: 82 }); stills.push(m); await page.close();
}
await browser.close();
writeFileSync(`${out}/density.json`, JSON.stringify({ url: URL0 + extra, stills }, null, 1));
const txt = execFileSync('python3', ['/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/lab/game-studies/testing/tools-survivors/density.py', out], { encoding: 'utf8' });
for (const line of txt.split('\n')) { if (!line.startsWith('{')) continue; const r = JSON.parse(line); console.log(`${r.file}  foes ${String(r.foesOnScreen).padStart(3)}  rank ${String(r.heroRankAfterBlur).padStart(3)} of ${r.ofBoxes} (top ${(100 * r.heroRankAfterBlur / r.ofBoxes).toFixed(1)}%)  hero-ring ${r.heroMinusRing}  allies ${r.alliesMinusRingMedian}  foes ${r.foesMinusRingMedian}  ink ${r.inkCoveragePct}%`); }
