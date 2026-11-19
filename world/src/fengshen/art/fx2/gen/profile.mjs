// node gen/profile.mjs [headed]   : what fx2 costs inside the real game. Opens fengshen.html?bench=1 (a scripted rider plays), in headless
// Chrome at 1440 x 900 unless `headed`, takes a CPU profile of SECONDS (default 6) of play and prints the time under each fx2 function
// (native calls such as drawImage are counted to the fx2 function that made them). Writes ../review/profile.json.
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const {chromium} = createRequire(join(here, '../../../../../package.json'))('playwright-core');
const SECONDS = +(process.env.SECONDS || 6), WARM = +(process.env.WARM || 4), headed = process.argv.includes('headed');
const b = await chromium.launch({channel: 'chrome', headless: !headed});
const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
p.on('pageerror', e => console.log('pageerror:', e.message));
// PATCH=notiles | nofx : the same game with fx2's ground marks not drawn, or with nothing of fx2 drawn. For telling fx2's own cost from
// cost the profiler puts on it (a software canvas charges deferred raster work to the next call that needs the pixels).
const PATCH = process.env.PATCH || '';
if (PATCH) await p.route(/fx2\/index\.js/, async r => { const res = await r.fetch(); let t = await res.text();
  if (PATCH === 'notiles') t = t.replace('drawMarks(ctx, f, dt);', '');
  if (PATCH === 'nofx') t = t.replace('drawMarks(ctx, f, dt); run(ctx, f, under, dt, false);', '').replace('run(ctx, f, over, dt, true);', '');
  r.fulfill({response: res, body: t}) });
await p.goto((process.env.URL || 'http://localhost:5173/fengshen.html') + '?bench=1' + (process.env.Q || ''));
await p.waitForTimeout(WARM * 1000);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start');
const f0 = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else r(n) }; requestAnimationFrame(tick) }));
await p.waitForTimeout(SECONDS * 1000 - 1000);
const {profile} = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(); let total = 0;
profile.samples.forEach((id, i) => { const dt = profile.timeDeltas[i] / 1000; self.set(id, (self.get(id) || 0) + dt); total += dt });
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
// each sample goes to the nearest ancestor (or itself) that is a function of fx2/index.js
const fx = {}, native = {}; let fxTotal = 0, idle = 0;
for (const [id, ms] of self) { const leaf = byId.get(id); if (leaf.callFrame.functionName === '(idle)') { idle += ms; continue }
  let n = leaf; while (n && !/fx2\/index\.js/.test(n.callFrame.url)) n = byId.get(parent.get(n.id));
  if (!n) continue; const k = n.callFrame.functionName || '(anonymous)'; fx[k] = (fx[k] || 0) + ms; fxTotal += ms;
  if (leaf !== n) { const kk = k + ' > ' + leaf.callFrame.functionName; native[kk] = (native[kk] || 0) + ms } }
// and the whole page: each sample to its nearest JavaScript function, whatever file it is in
const all = {}; for (const [id, ms] of self) { let n = byId.get(id); if (n.callFrame.functionName === '(idle)') continue; while (n && !n.callFrame.url) n = byId.get(parent.get(n.id)); const k = n ? n.callFrame.url.split('/').slice(-2).join('/').split('?')[0] + ' ' + n.callFrame.functionName : '(none)'; all[k] = (all[k] || 0) + ms }
const draw = await p.evaluate(() => { const f = window.__fengshen; if (!f || !f.perf) return null; const P = f.perf, n = P.n; let d = 0; for (let i = 0; i < n; i++) d += P.draw[i]; return +(d / n).toFixed(2) });
const round = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => [k, +v.toFixed(1)]));
const frames = Math.round(f0 * SECONDS), out = {patch: PATCH || 'none', gameDrawMsPerFrame: draw, wholePageTop: round(all), headed, seconds: SECONDS, fpsFirstSecond: f0, busyMs: +(total - idle).toFixed(0), fx2Ms: +fxTotal.toFixed(1), fx2MsPerFrameAt: {fps: f0, ms: +(fxTotal / frames).toFixed(3)}, fx2MsPerSecondOfPlay: +(fxTotal / SECONDS).toFixed(1), byFunction: round(fx), nativeUnder: round(native)};
console.log(JSON.stringify(out, null, 1)); writeFileSync(join(here, '..', 'review', process.env.OUT || 'profile.json'), JSON.stringify(out, null, 1));
await b.close();
