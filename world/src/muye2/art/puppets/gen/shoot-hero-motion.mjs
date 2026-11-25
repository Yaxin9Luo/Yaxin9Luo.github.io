// node gen/shoot-hero-motion.mjs <outdir>   (dev server on 5173)
// Rides 武王 in the running page (muye-next.html) and shoots frames round him at game size: the gallop, the spear's thrust on foes,
// a turn, a hurt, then the halberd; plus one wide frame for scale among the soldiers. Writes <outdir>/<tag>-<n>.png and boxes.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core');
const [out = '/tmp/hm'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const HMR = 'export const createHotContext = () => ({ accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} }); export const updateStyle = (id, css) => { let s = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!s) { s = document.createElement("style"); s.setAttribute("data-vite-dev-id", id); document.head.appendChild(s); } s.textContent = css; }; export const removeStyle = () => {}; export const injectQuery = (u) => u; export const ErrorOverlay = class {};';   // no hot reload: other sessions' edits must not reload the page mid-shot
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +(process.env.DPR || 1) }); await page.route('**/@vite/client', (rt) => rt.fulfill({ body: HMR, contentType: 'application/javascript' }));
page.on('pageerror', (e) => console.log('pageerror:', e.message, (e.stack||'').split('\n').slice(1,4).join(' | ')));
await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/muye-next.html?seed=5&lang=en' + (process.env.Q || ''));
await page.waitForFunction(() => window.__muye && window.__muye.ready, null, { timeout: 120000 });
const ride = page.getByText(/Ride out|出征/).first(); if (await ride.count()) await ride.click(); else await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.waitForTimeout(700); }
const setup = (weapon, foes) => page.evaluate(async ([weapon, foes]) => {
  const M = window.__muye; if (M.mode !== 'play') { await M.begin(); await new Promise((r) => setTimeout(r, 800)); }
  const g = M.game, h = g.hero; h.xpNext = 1e9; h.hp = h.maxHp = 1e6;
  g.build.weapon = { id: weapon, level: 1, evolved: false, cd: 0.4 };
  if (foes) { const addFoe = M.sim.addFoe; for (let i = 0; i < foes; i++) addFoe(g, 'spear', h.x + 150 + (i % 3) * 30, h.y - 30 + Math.floor(i / 3) * 30); }
  return { weapon: g.build.weapon.id, foes: g.foes.length };
}, [weapon, foes]);
const box = () => page.evaluate(() => { const M = window.__muye, c = document.createElement('canvas').getContext('2d'); return M.art.drawUnitAgain(c, M.game.hero); });
let n = 0; const boxes = {};
async function shoot(tag, k, every = 45) {
  for (let i = 0; i < k; i++) {
    const b = await box(); if (!b) { console.log('no box'); continue; } if (i === 0) console.log(tag, JSON.stringify(b));
    const dp = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width / innerWidth : 1; }), bb = (Array.isArray(b) ? b : [b.left, b.top, b.right, b.bottom]).map((v) => v / dp), cx = (bb[0] + bb[2]) / 2, cy = bb[3] - 75;   // around his feet
    const clip = { x: Math.min(1140, Math.max(0, cx - 150)), y: Math.min(640, Math.max(0, cy - 160)), width: 300, height: 260 };
    const st = await page.evaluate(() => { const M = window.__muye, h = M.game.hero, w = M.game.build.weapon; return [h.state, +w.cd.toFixed(2), h.facing]; });
    const f = `${tag}-${String(i).padStart(2, '0')}.png`; await page.screenshot({ path: `${out}/${f}`, clip }); boxes[f] = { b, st }; n++;
    await page.waitForTimeout(every);
  }
}
if (process.env.WEAPONS) {
  await setup('spear', 0); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800);
  for (const w of process.env.WEAPONS.split(',')) { await setup(w, 9); await page.waitForTimeout(200); await shoot(w, 16, 30); }
  await page.keyboard.up('ArrowRight');
} else {
await setup('spear', 0);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1600); await shoot('ride', 10);            // full gallop (full cry after the ride)
await setup('spear', 9); await page.waitForTimeout(150); await shoot('spear', 16, 30);                      // foes ahead: the thrust
await page.keyboard.up('ArrowRight'); await page.keyboard.down('ArrowLeft'); await shoot('turn', 8, 15);     // the turn
await page.evaluate(() => { const h = window.__muye.game.hero; h.hurtT = 0.25; h.flash = 0.15; }); await shoot('hurt', 5, 20);
await page.keyboard.up('ArrowLeft'); await page.keyboard.down('ArrowRight'); await setup('halberd', 9); await page.waitForTimeout(400); await shoot('halberd', 16, 30);
await page.keyboard.up('ArrowRight'); await page.waitForTimeout(600); await shoot('stand', 2, 300);
await page.evaluate(async () => { const M = window.__muye, g = M.game, h = g.hero; const addFoe = M.sim.addFoe;
  for (let i = 0; i < 4; i++) { const f = addFoe(g, 'spear', h.x + 70 + i * 34, h.y + 6); f.frozen = true; f.state = 'idle'; } });
await page.waitForTimeout(300); await shoot('scale', 1);
await page.screenshot({ path: `${out}/wide.png` });
}
fs.writeFileSync(`${out}/boxes.json`, JSON.stringify(boxes));
console.log('frames', n);
await browser.close();
