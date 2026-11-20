// node world/src/muye/art/fx/gen/shoot.mjs [hero=<id>] [frames=<id>] [crowd] [style] [bench]   (the dev server on 5173 must be up)
// Writes into ../review/ (WebP, overwritten each time):
//   <id>.webp          columns level 1, 3, 6, evolved; rows the three beats of one cast (gather, burst, linger); alone
//   <id>-crowd.webp    the same four at the burst among 200 foes, colour above and greyscale below
//   <id>-frames.webp   every third frame of one cast at level 3, from the cast to 1.3 s
//   style.webp         the style sheet (style.html)
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../../../package.json'));
const {chromium} = require('playwright-core'), sharp = require('sharp');
const rv = join(here, '..', 'review'), args = process.argv.slice(2), val = k => (args.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const BEATS = {fireCover: [14, 40, 150], sash: [3, 9, 22], seal: [24, 38, 64], fireSpear: [1, 5, 16], whip: [2, 8, 22], ring: [6, 16, 34], pearls: [0, 12, 40], banner: [2, 10, 30]};      // frames after the cast
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
page.on('pageerror', e => console.log('pageerror:', e.message));
const open = async (url = 'preview.html?auto=0&clean=1') => { await page.goto('http://127.0.0.1:5173/src/muye/art/fx/' + url); await page.waitForFunction(() => document.title === 'ready' && window.fxp, null, {timeout: 180000}); };
const sheet = async (file, cells, w, h, cols, label = []) => {
  const comp = cells.map((input, i) => ({input, left: (i % cols) * w, top: Math.floor(i / cols) * h}));
  if (label.length) comp.push({input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * cols}" height="${h * Math.ceil(cells.length / cols)}">${label.map((t, i) => `<text x="${(i % cols) * w + 10}" y="${Math.floor(i / cols) * h + 22}" font-family="Menlo" font-size="15" fill="#6B645C">${t}</text>`).join('')}</svg>`), left: 0, top: 0});
  await sharp({create: {width: w * cols, height: h * Math.ceil(cells.length / cols), channels: 3, background: '#EFE7D6'}}).composite(comp).webp({quality: 80}).toFile(join(rv, file)); console.log(file);
};
const CLIP = {x: 340, y: 150, width: 760, height: 560}, SMALL = 560;
const shot = async (clip = CLIP, w = SMALL) => sharp(await page.screenshot({clip})).resize(w).png().toBuffer();
const LV = [1, 3, 6, 'ev'];

const retry = async (f) => { for (let i = 0; ; i++) { try { return await f(); } catch (e) { if (i >= 3) throw e; console.log('retry:', e.message.slice(0, 120)); await page.waitForTimeout(2000); await open(); await page.waitForFunction(() => window.fxp && window.fxp.fx.ready, null, {timeout: 30000}); } } };
const hero = val('hero');
if (hero) await retry(async () => { await open(); await page.waitForFunction(() => window.fxp && window.fxp.fx.ready, null, {timeout: 30000});
  const B = BEATS[hero], cells = [], labels = [];
  for (const [r, beat] of ['gather', 'burst', 'linger'].entries()) for (const lv of LV) {
    const n = await page.evaluate(([id, lv]) => { const f = window.fxp; f.treasure(id, lv); f.step(20); if (id === 'banner') { const h = f.game.hero; f.fx.onEvent({type: 'cast', id, shape: 'ward', level: lv === 'ev' ? 6 : lv, evolved: lv === 'ev', x: h.x, y: h.y, radius: [0, 125, 132, 146, 152, 158, 168][lv === 'ev' ? 6 : lv] * (lv === 'ev' ? 1.13 : 1), blocked: true}, f.game); return 0 } return f.until('cast:' + id, 1500) }, [hero, lv]);
    if (n < 0) console.log('no cast:', hero, lv);
    await page.evaluate(k => window.fxp.step(k), B[r]); cells.push(await shot()); labels.push(`${lv === 'ev' ? 'evolved' : 'level ' + lv} · ${beat} (+${B[r]} f)`) }
  await sheet(hero + '.webp', cells, SMALL, Math.round(SMALL * 560 / 760), 4, labels);
  const crowd = [], grey = [], lab = [];
  for (const lv of LV) { await page.evaluate(([id, lv]) => { const f = window.fxp; f.treasure(id, lv, 200); f.step(30); if (id === 'banner') { const h = f.game.hero; f.fx.onEvent({type: 'cast', id, shape: 'ward', level: 6, evolved: lv === 'ev', x: h.x, y: h.y, radius: 150, blocked: true}, f.game); return } f.until('cast:' + id, 1500) }, [hero, lv]); await page.evaluate(k => window.fxp.step(k), B[1]);
    const png = await page.screenshot({clip: CLIP}); crowd.push(await sharp(png).resize(SMALL).png().toBuffer()); grey.push(await sharp(png).greyscale().resize(SMALL).png().toBuffer()); lab.push(`${lv === 'ev' ? 'evolved' : 'level ' + lv} · 200 foes`) }
  await sheet(hero + '-crowd.webp', [...crowd, ...grey], SMALL, Math.round(SMALL * 560 / 760), 4, [...lab, ...lab.map(l => l + ' · grey')]);
});
const fr = val('frames');
if (fr) { await open(); await page.waitForFunction(() => window.fxp.fx.ready, null, {timeout: 30000});
  const lv = +(val('lv') || 3); await page.evaluate(([id, lv]) => { const f = window.fxp; f.treasure(id, lv); f.step(20); f.until('cast:' + id, 1500) }, [fr, lv]);
  const cells = [], labels = []; const total = +(val('n') || 24), every = +(val('every') || 3);
  for (let i = 0; i < total; i++) { cells.push(await shot({x: 420, y: 200, width: 600, height: 440}, 360)); labels.push(`+${i * every}`); await page.evaluate(k => window.fxp.step(k), every) }
  await sheet(fr + '-frames.webp', cells, 360, 264, 8, labels);
}
const troopsArg = val('troops');
if (troopsArg) await retry(async () => { await open(); await page.waitForFunction(() => window.fxp && window.fxp.fx.ready, null, {timeout: 30000});
  const WAIT = {shields: 8, spears: 4, archers: 50, strongmen: 26, chariots: 22, tigers: 30, acolytes: 18, hooks: 14};
  for (const id of troopsArg.split(',')) { const cells = [], labels = [];
    for (const lv of [3, 5, 7, 9]) { const n = await page.evaluate(([id, lv]) => { const f = window.fxp; f.troopScene(id, lv); f.step(10); return f.until('squadSkill', 900) }, [id, lv]);
      if (n < 0) console.log('no skill:', id, lv); await page.evaluate(k => window.fxp.step(k), WAIT[id] || 10);
      const png = await page.screenshot({clip: CLIP}); cells.push(await sharp(png).resize(SMALL).png().toBuffer()); labels.push(`${id} · ${lv === 9 ? 'rank 5 blessed' : 'level ' + lv + ' · rank ' + (lv >= 7 ? 4 : lv >= 5 ? 3 : 2)}`); }
    for (const b of [...cells]) cells.push(await sharp(b).greyscale().png().toBuffer());
    await sheet('troop-' + id + '.webp', cells, SMALL, Math.round(SMALL * 560 / 760), 4, [...labels, ...labels.map(l => l + ' · grey')]); } });
const gensArg = val('generals');
if (gensArg) await retry(async () => { await open(); await page.waitForFunction(() => window.fxp && window.fxp.fx.ready, null, {timeout: 30000});
  const cells = [], labels = [];
  for (const id of gensArg.split(',')) {
    await page.evaluate((id) => { const f = window.fxp; f.generalScene(id, 3); f.step(30); f.until('generalSkill', 600) }, id); await page.evaluate(() => window.fxp.step(8));
    cells.push(await sharp(await page.screenshot()).resize(720).png().toBuffer()); labels.push(id + ' · level 3 · skill');
    await page.evaluate((id) => { const f = window.fxp; f.generalScene(id, 6); f.step(40); f.trueFormNow(id); f.step(26) }, id);
    cells.push(await sharp(await page.screenshot()).resize(720).png().toBuffer()); labels.push(id + ' · 显圣 · 0.45 s');
    await page.evaluate(() => window.fxp.step(36)); cells.push(await sharp(await page.screenshot()).resize(720).png().toBuffer()); labels.push(id + ' · 显圣 · 1.05 s'); }
  await sheet('generals.webp', cells, 720, 450, 3, labels); });
const namedArg = val('named');
if (namedArg) await retry(async () => { await open(); await page.waitForFunction(() => window.fxp && window.fxp.fx.ready, null, {timeout: 30000});
  const NP = {moliqing: 2, molihong: 2, molihai: 2, molishou: 2, wenzhong: 3}, cells = [], labels = [], full = async () => sharp(await page.screenshot()).resize(640).png().toBuffer();
  for (const kind of namedArg.split(',')) for (let k = 0; k < NP[kind]; k++) {
    await page.evaluate(([kind, k]) => { window.fxp.namedScene(kind, k); window.fxp.step(k ? 70 : 36) }, [kind, k]);
    if (k === 0) { cells.push(await full()); labels.push(kind + ' · arrives'); }
    const w = await page.evaluate(() => { const f = window.fxp; const n = f.until('warn', 900); const z = f.game.zones.find(z => z.side === 'shang' && !z.dead); if (z) f.step(Math.round((z.life - z.t) * 60 * 0.6)); return [n, z ? z.pattern || z.kind : 'summon'] });
    cells.push(await full()); labels.push(kind + ' · warn ' + w[1] + (w[0] < 0 ? ' (none)' : ''));
    const l = await page.evaluate(() => { const f = window.fxp; const n = f.until('land', 240) >= 0 ? 1 : f.until('summoned', 200); f.step(7); return n });
    cells.push(await full()); labels.push(kind + ' · lands +7 f' + (l < 0 ? ' (none)' : ''));
    if (kind === 'molihong' && k === 0 || kind === 'wenzhong' && k === 2) { await page.evaluate(() => window.fxp.step(40)); cells.push(await full()); labels.push(kind + ' · held'); } }
  await sheet('named.webp', cells, 640, 400, 4, labels); });
if (args.includes('style')) { await page.goto('http://127.0.0.1:5173/src/muye/art/fx/style.html'); await page.waitForFunction(() => document.title === 'drawn', null, {timeout: 60000});
  await sharp(await page.screenshot({fullPage: true})).webp({quality: 82}).toFile(join(rv, 'style.webp')); console.log('style.webp') }
await browser.close();
