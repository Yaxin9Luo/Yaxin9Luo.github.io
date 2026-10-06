// Render the share preview cards (1200×630 PNG) from card.html with Playwright.
//   npm run og            → world/public/og/home.png and blog.png
//   npm run og -- --out <dir> [--scale 2]   (previews elsewhere, e.g. at 2×)
// Needs Playwright with Chromium: `npm i -g playwright && npx playwright install chromium`.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const out = path.resolve(arg('--out', path.join(root, 'world/public/og')));
const scale = Number(arg('--scale', 1));

async function chromium() {
  try { return (await import('playwright')).chromium; } catch { /* fall back to a global install */ }
  try { return createRequire(import.meta.url)(path.join(execSync('npm root -g').toString().trim(), 'playwright')).chromium; } catch { /* reported below */ }
  throw new Error('Playwright is required: npm i -g playwright && npx playwright install chromium');
}

// Serve only what the card needs: the template, the site fonts and the modules it imports.
const routes = [['/og/', 'scripts/og/'], ['/fonts/', 'world/public/fonts/'], ['/src/', 'world/src/'], ['/_data/', '_data/']];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname), route = routes.find(([prefix]) => url.startsWith(prefix));
  const file = route && path.join(root, route[1], url.slice(route[0].length));
  if (!file || !file.startsWith(root) || file.includes('..')) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await (await chromium()).launch();
try {
  await mkdir(out, { recursive: true });
  for (const card of ['home', 'blog']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(`failed ${request.url()}`));
    await page.goto(`${base}/og/card.html?card=${card}`);
    await page.waitForSelector('body.ready', { timeout: 15000 });
    if (errors.length) throw new Error(`${card} card: ${errors.join('; ')}`);
    const file = path.join(out, `${card}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log('wrote', path.relative(process.cwd(), file));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
