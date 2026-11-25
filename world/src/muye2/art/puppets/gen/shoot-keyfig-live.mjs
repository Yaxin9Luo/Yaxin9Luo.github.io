// node gen/shoot-keyfig-live.mjs <out.png> <foe,foe,...>   (dev server on 5173)
// Starts a run on muye-next.html, puts the named foes round the hero and shoots the running page: the key figures drawn live.
import { createRequire } from 'node:module';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
const { chromium } = require('playwright-core');
const [out, list = 'wenzhong', states = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror:', e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await page.goto((process.env.SHEET_BASE || 'http://127.0.0.1:5173') + '/muye-next.html?seed=5&lang=en');
await page.waitForFunction(() => window.__muye && window.__muye.ready, null, { timeout: 120000 });
const ride = page.getByText(/Ride out|出征/).first(); if (await ride.count()) await ride.click(); else await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.waitForTimeout(700); }   // the first offers: take a gift
if (process.env.GENS) await page.evaluate((x) => { window.__GENS = x.split(','); }, process.env.GENS);
const info = await page.evaluate(async ([list, states]) => {
  const M = window.__muye; if (M.mode !== 'play') { await M.begin(); await new Promise((r) => setTimeout(r, 800)); }
  const { addFoe } = await import('/src/muye2/sim/foes.js');
  const g = M.game, h = g.hero, kinds = list.split(','), st = states ? states.split(',') : [];
  const gens = (new URLSearchParams(location.search)).get('x') || '';
  if (window.__GENS) { const { addGeneral } = await import('/src/muye2/sim/generals.js'); for (const id of window.__GENS) { try { const e = { id, level: 1, trueForm: false }; g.build.generals.push(e); addGeneral(g, e); } catch (e) { console.log('gen', id, e.message); } } }
  kinds.forEach((k, i) => { const a = (i / kinds.length) * Math.PI * 2 + 0.3, f = addFoe(g, k, h.x + Math.cos(a) * 330, h.y + Math.sin(a) * 260); if (st[i]) { f.state = st[i]; f.stateT = 0.05; f.frozen = true; } });
  return { allies: (g.allies || []).filter((a) => a.kind === 'general').map((a) => a.general), mode: M.mode, stats: M.art.stats.keyFigures, standIns: Object.keys(M.art.standIns || {}), foes: g.foes.length };
}, [list, states]);
console.log(JSON.stringify(info));
for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.waitForTimeout(500); }
await page.waitForTimeout(+(process.env.WAIT || 1200));
console.log(JSON.stringify(await page.evaluate(() => { const M = window.__muye, c = document.createElement('canvas').getContext('2d'); return (M.game.allies || []).filter((a) => a.kind === 'general').map((a) => [a.general, a.state, Math.round(a.x - M.game.hero.x), Math.round(a.y - M.game.hero.y), !!M.art.drawUnitAgain(c, a)]); })));
await page.screenshot({ path: out });
console.log('shot', out);
await browser.close();
