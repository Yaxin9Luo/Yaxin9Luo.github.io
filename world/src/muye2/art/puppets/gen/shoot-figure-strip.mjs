// node gen/shoot-figure-strip.mjs <outdir> <kind,kind,...|zhou:general,...>   (dev server on 5173)
// For each figure: a fresh run, the figure put near a still hero, the rules left to drive it (walk, wind-up of its warned patterns,
// the blow, hurt); frames cropped round it at game size every STEP ms. Writes <outdir>/<kind>-NN.png and states.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core');
const [out = '/tmp/fs', list = 'zhangguifang'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const N = +(process.env.N || 24), STEP = +(process.env.STEP || 110);
const HMR = 'export const createHotContext = () => ({ accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} }); export const updateStyle = (id, css) => { let s = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!s) { s = document.createElement("style"); s.setAttribute("data-vite-dev-id", id); document.head.appendChild(s); } s.textContent = css; }; export const removeStyle = () => {}; export const injectQuery = (u) => u; export const ErrorOverlay = class {};';   // no hot reload: other sessions' edits must not reload the page mid-shot
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); await page.route('**/@vite/client', (rt) => rt.fulfill({ body: HMR, contentType: 'application/javascript' }));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const states = {};
async function one(who) {
  await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/muye-next.html?seed=5&lang=en');
  await page.waitForFunction(() => window.__muye && window.__muye.ready, null, { timeout: 120000 });
  const ride = page.getByText(/Ride out|出征/).first(); if (await ride.count()) await ride.click(); else await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.waitForTimeout(500); }
  const ok = await page.evaluate(async (who) => {
    const M = window.__muye; if (M.mode !== 'play') { await M.begin(); await new Promise((r) => setTimeout(r, 800)); }
    const g = M.game, h = g.hero; h.xpNext = 1e9; h.hp = h.maxHp = 1e7;
    for (const f of g.foes) f.hp = 0, f.state = 'dead';
    if (who.startsWith('zhou:')) { const { addGeneral } = await import('/src/muye2/sim/generals.js'); const e = { id: who.slice(5), level: 1, trueForm: false }; g.build.generals.push(e); addGeneral(g, e);
      const { addFoe } = await import('/src/muye2/sim/foes.js'); for (let i = 0; i < 8; i++) addFoe(g, 'spear', h.x + 260 + (i % 4) * 30, h.y - 40 + Math.floor(i / 4) * 50);
      window.__who = g.allies.find((a) => a.general === who.slice(5)); }
    else { const { addFoe } = await import('/src/muye2/sim/foes.js'); const f = addFoe(g, who, h.x + 240, h.y + 40); f.hp = f.maxHp = 1e7; window.__who = f; }
    return !!window.__who;
  }, who);
  if (!ok) { console.log(who, 'not found'); return; }
  const S = [];
  for (let i = 0; i < N; i++) {
    if (await page.evaluate(() => window.__muye && window.__muye.game && window.__muye.game.phase === 'offer')) { await page.keyboard.press('1'); await page.waitForTimeout(300); }
    const r = await page.evaluate(() => { const M = window.__muye, u = window.__who; if (!M || !M.game || !u) return null; const h = M.game.hero; if (!u.general) { h.x = h.px = u.x - 330; h.y = h.py = u.y + 10; h.vx = h.vy = 0; } c = document.createElement('canvas').getContext('2d'); const b = M.art.drawUnitAgain(c, u); return b && { b, st: u.state, t: +(u.stateT || 0).toFixed(2) }; });
    if (r) { const bb = r.b, cx = (bb.left + bb.right) / 2, w = 340, hgt = 300, clip = { x: Math.min(1440 - w, Math.max(0, cx - w / 2)), y: Math.min(900 - hgt, Math.max(0, bb.bottom - hgt + 20)), width: w, height: hgt };
      const f = `${who.replace(':', '-')}-${String(i).padStart(2, '0')}.png`; await page.screenshot({ path: `${out}/${f}`, clip }); S.push([f, r.st, r.t]); }
    await page.waitForTimeout(STEP);
  }
  states[who] = S; console.log(who, S.map((s) => s[1]).join(' '));
  { let old = {}; try { old = JSON.parse(fs.readFileSync(`${out}/states.json`, 'utf8')); } catch {} fs.writeFileSync(`${out}/states.json`, JSON.stringify({ ...old, [who]: S })); }
}
for (const who of list.split(',')) { for (let k = 0; k < 3; k++) { try { await one(who); break; } catch (e) { console.log(who, 'retry', e.message.slice(0, 80)); } } }
let old = {}; try { old = JSON.parse(fs.readFileSync(`${out}/states.json`, 'utf8')); } catch {} fs.writeFileSync(`${out}/states.json`, JSON.stringify({ ...old, ...states }));
await browser.close();
