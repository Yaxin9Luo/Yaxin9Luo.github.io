// Stills of the ground, taken in the running game page (world/muye-next.html on the dev server, never started here).
//   node world/src/muye2/art/ground/gen/shoot.mjs <outDir> <shots.json>
// shots.json: [{name, seed, at: [x, y] | 'altar' | 'granary' | 'camp' | 'platform' | 'river' | 'open', foes: 0, allies: 0,
//               weather, hour, k (time 0..1), w, h}]
// The page's own chrome (HUD, offer, sheet) is hidden for the still; the canvas is what the player sees under it.
// The game keeps running between shots; the hero is held where he is put and kept alive.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), { chromium } = require('playwright-core');
const [OUT, LIST] = process.argv.slice(2); mkdirSync(OUT, { recursive: true });
const SHOTS = JSON.parse(readFileSync(LIST, 'utf8')), URL0 = process.env.MUYE_URL || 'http://127.0.0.1:5173/muye-next.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pages = {};
async function pageFor(seed, w, h) {
  const key = `${seed}:${w}x${h}`; if (pages[key]) return pages[key];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('  [page error]', e.message.slice(0, 400)));
  await page.goto(`${URL0}?seed=${seed}&lang=zh`);
  await page.waitForFunction(() => window.__muye && window.__muye.ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__muye.begin(); const s = document.createElement('style'); s.textContent = 'body > *:not(canvas){display:none!important}'; document.head.appendChild(s); });
  await page.waitForFunction(() => window.__muye.art && window.__muye.art.ground && window.__muye.game, null, { timeout: 120000 }); await page.waitForTimeout(400);
  return (pages[key] = page);
}
for (const S of SHOTS) for (let attempt = 0; attempt < 3; attempt++) { try {
  const page = await pageFor(S.seed ?? 7, S.w || 1440, S.h || 900);
  const info = await page.evaluate(async (S) => {
    const M = window.__muye, g = M.game, sim = M.sim, art = M.art, G = art.ground;
    G.follow = false;   /* review stills set the scene themselves, not from the game's campaign */
    if (S.scene && G.setStretch) await G.setStretch(S.scene);
    if (S.march != null && G.march) { G.march(S.march, S.to); await new Promise((r) => setTimeout(r, 1500)); G.march(S.march, S.to); await new Promise((r) => setTimeout(r, 800)); } else if (G.march) G.march(null);
    if (G.setScene) G.setScene({ weather: S.weather, hour: S.hour });
    if (S.gateOpen != null && G.setGate) for (const q of G.places || []) if (q.kind === 'gate') G.setGate(q.id, S.gateOpen);
    if (S.k != null) { art.setTime(S.k); }
    M.cam.zoom = S.zoom || Math.min(1.6, Math.max(0.7, Math.sqrt(innerWidth * innerHeight / (1440 * 900))));
    const spot = typeof S.at === 'string' ? (G.spots ? G.spots(S.at) : null) : S.at; const [x, y] = spot || [3000, 3000];
    const h = g.hero; h.x = h.px = x; h.y = h.py = y; h.vx = h.vy = 0; h.hp = h.maxHp = 1e7;
    g.foes.length = 0; g.shots && (g.shots.length = 0); g.zones && (g.zones.length = 0); g.pickups && (g.pickups.length = 0);
    const KINDS = ['spear', 'spear', 'spear', 'axe', 'axe', 'shield', 'archer', 'archer', 'shaman'];
    const hash = (i, j) => { let q = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
    if (S.allies) { for (const id of ['shields', 'spears', 'archers']) try { sim.give(g, 'troop', id, 3); } catch (e) {} for (let i = 0; g.allies.length < S.allies && i < 80; i++) sim.addMan(g, ['shields', 'spears', 'archers'][i % 3]); while (g.allies.length > S.allies) g.allies.pop(); for (const a of g.allies) { const t = hash(a.id, 9) * 6.283, r = 70 + hash(a.id, 8) * 120; a.x = a.px = x + Math.cos(t) * r; a.y = a.py = y + Math.sin(t) * r; } }
    else if (g.allies) g.allies.length = 0;
    for (let i = 0; i < (S.foes || 0); i++) { const c = i % 7, ca = c / 7 * 6.283 + 0.4, cd = 330 + hash(c, 5) * 300, r = Math.sqrt(hash(i, 11)) * 150, t = hash(i, 13) * 6.283;
      sim.addFoe(g, KINDS[Math.floor(hash(i, 17) * KINDS.length)], x + Math.cos(ca) * cd * 1.3 + Math.cos(t) * r, y + Math.sin(ca) * cd + Math.sin(t) * r); }
    await new Promise((r) => setTimeout(r, S.warm ?? 900));
    const hh = g.hero; return { hero: [Math.round(hh.x), Math.round(hh.y)], foes: g.foes.length, allies: (g.allies || []).length, scene: G.scene ? G.scene() : null, ownFall: !!G.ownFall, weatherState: G.weatherState ? G.weatherState() : null };
  }, S);
  await page.screenshot({ path: `${OUT}/${S.name}.png` });
  console.log(S.name, JSON.stringify(info)); break;
  } catch (e) { console.log('  retry', S.name, String(e.message).slice(0, 80)); for (const k in pages) { try { await pages[k].close(); } catch {} delete pages[k]; } } }
await browser.close();
