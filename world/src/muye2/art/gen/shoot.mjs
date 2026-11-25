// Stills and measurements of the art module, from the preview page on the running dev server (never started here).
//   node gen/shoot.mjs [name ...]        names: see SHOTS below, plus `bench`. No names: everything.
// Each battle still is also saved blurred 8 px (-blur) and in grey (-grey).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), { chromium } = require('playwright-core');
const OUT = fileURLToPath(new URL('../review/', import.meta.url)), URL0 = (process.env.MUYE_URL || 'http://localhost:5173') + '/src/muye/art/preview.html';
const SHOTS = {
  'foes-120': { q: 'n=120&allies=14&still=1', proofs: true }, 'foes-300': { q: 'n=300&allies=40&still=1&warm=2', proofs: true },
  camp: { q: 'at=camp&n=0&allies=6&still=1&warm=0.6' }, wood: { q: 'at=wood&n=0&allies=6&still=1&warm=0.6' }, village: { q: 'at=village&n=0&allies=6&still=1&warm=0.6' }, altar: { q: 'at=altar&n=0&allies=6&still=1&warm=0.6' }, ford: { q: 'at=ford&n=0&allies=6&still=1&warm=0.6' },
  field: { q: 'at=3000,3000&n=0&allies=0&still=1&warm=0&zoom=0.26&ride=0,0', w: 1600, h: 1000 },
  dawn: { q: 'n=120&allies=14&still=1&time=0' }, dusk: { q: 'n=120&allies=14&still=1&time=1' },
  fallback: { q: 'n=120&allies=14&still=1&puppets=fallback' }, fake: { q: 'n=120&allies=14&still=1&fake=1' },
};
const want = process.argv.slice(2), names = want.length ? want : [...Object.keys(SHOTS), 'bench'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function open(q, w = 1440, h = 900, scale = 1) { const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;' }));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text().slice(0, 300)); }); page.on('pageerror', (e) => console.log('  [page error]', e.message.slice(0, 400)));
  await page.goto(`${URL0}?${q}`); return page; }
const report = {};
for (const name of names) {
  if (name === 'bench') continue; const S = SHOTS[name]; if (!S) { console.log('no shot', name); continue; }
  const page = await open(S.q, S.w, S.h); await page.waitForFunction(() => window.__preview && window.__preview.ready, null, { timeout: 120000 });
  await page.screenshot({ path: `${OUT}${name}.png` });
  report[name] = await page.evaluate(() => ({ driver: __preview.driver, loadMs: __preview.loadMs, foes: __preview.game.foes.length, allies: __preview.game.allies.length, sprites: __preview.art.stats.sprites, puppets: __preview.art.stats.puppets, fx: __preview.art.stats.fx }));
  if (S.proofs) { await page.evaluate(() => { document.getElementById('c').style.filter = 'blur(8px)'; }); await page.screenshot({ path: `${OUT}${name}-blur.png` }); await page.evaluate(() => { document.getElementById('c').style.filter = 'grayscale(1)'; }); await page.screenshot({ path: `${OUT}${name}-grey.png` }); }
  console.log(name, JSON.stringify(report[name])); await page.close();
}
if (names.includes('bench')) {
  // Cost. `art` is the script time of the three calls (drawGround, drawWorld, drawOver). The frame gap with the art drawn
  // 1 and 4 times a frame shows whether the canvas work behind the script holds 60 frames a second.
  const bench = { when: new Date().toISOString(), note: 'headless Chrome, 1440 x 900; 300 foes kept topped up, 40 allies, five treasures', runs: [] };
  for (const [label, q, scale] of [['dpr1', 'n=300&allies=40&bench=1', 1], ['dpr1 x4', 'n=300&allies=40&bench=4', 1], ['dpr2', 'n=300&allies=40&bench=1&dpr=2', 2], ['dpr1, 120 foes', 'n=120&allies=14&bench=1', 1], ['dpr1, no fx', 'n=300&allies=40&bench=1&fx=0', 1]]) {
    const page = await open(q, 1440, 900, scale); await page.waitForFunction(() => window.__preview && window.__preview.stats().frames >= 400, null, { timeout: 180000 });
    const s = await page.evaluate(() => __preview.stats()), mem = await page.evaluate(() => __preview.loadMs); bench.runs.push({ label, ...s, loadMs: mem }); console.log(label, JSON.stringify(s)); await page.close(); }
  writeFileSync(`${OUT}bench.json`, JSON.stringify(bench, null, 1));
}
if (Object.keys(report).length) writeFileSync(`${OUT}stills.json`, JSON.stringify(report, null, 1));
await browser.close();
