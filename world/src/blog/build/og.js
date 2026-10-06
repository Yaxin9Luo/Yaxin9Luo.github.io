// Render share cards (1200×630 PNG) with Playwright. Uses the bundled Chromium when installed, else the system
// Chrome (CI's ubuntu-latest has one). When neither is available the build keeps the generic /og/blog.png.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {'.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'};

async function launch() {
  if (process.env.BLOG_OG === '0') return null;
  let chromium;
  try { ({chromium} = await import('playwright-core')); } catch { return null; }
  for (const options of [{}, {channel: 'chrome'}, process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : null].filter(Boolean)) {
    try { return await chromium.launch({...options, args: ['--no-proxy-server']}); } catch { /* try the next browser */ }
  }
  return null;
}

/**
 * cards: [{id, html, out}] — html is a full card page; out is the PNG path. Files under `roots` (url prefix → dir)
 * are served so the card can load the site's fonts. Returns the ids that have a PNG afterwards.
 */
export async function renderCards(cards, {roots, cacheDir, log = console.log}) {
  const done = new Set(), todo = [];
  for (const card of cards) {
    const key = createHash('sha1').update(card.html).update('og-v1').digest('hex').slice(0, 16), cached = path.join(cacheDir, `${key}.png`);
    card.cached = cached;
    if (fs.existsSync(cached)) { fs.mkdirSync(path.dirname(card.out), {recursive: true}); fs.copyFileSync(cached, card.out); done.add(card.id); }
    else todo.push(card);
  }
  if (!todo.length) return done;
  const browser = await launch();
  if (!browser) { log(`blog: no Chromium for share cards; ${todo.length} post(s) keep /og/blog.png`); return done; }
  const pages = new Map(todo.map(c => [`/__og/${c.id}.html`, c.html]));
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pages.has(url)) { res.writeHead(200, {'content-type': TYPES['.html']}).end(pages.get(url)); return; }
    for (const [prefix, dir] of Object.entries(roots)) {
      if (!url.startsWith(prefix)) continue;
      const file = path.join(dir, url.slice(prefix.length));
      if (file.startsWith(dir) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'}).end(fs.readFileSync(file)); return; }
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const card of todo) {
      const page = await browser.newPage({viewport: {width: 1200, height: 630}, colorScheme: 'light', reducedMotion: 'reduce'});
      try {
        await page.goto(`${base}/__og/${card.id}.html`);
        await page.waitForSelector('body.ready', {timeout: 15000});
        fs.mkdirSync(path.dirname(card.out), {recursive: true}); fs.mkdirSync(cacheDir, {recursive: true});
        await page.screenshot({path: card.cached, clip: {x: 0, y: 0, width: 1200, height: 630}});
        fs.copyFileSync(card.cached, card.out); done.add(card.id);
      } catch (error) { log(`blog: share card ${card.id} failed: ${error.message}`); }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  return done;
}
