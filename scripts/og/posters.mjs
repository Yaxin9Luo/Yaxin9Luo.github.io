// Render a poster, light and dark, of each live figure (```embed block) the blog index shows: its first-page preview
// lists a post's first three figures in an "Inside" strip, and a live page has no image of its own.
//   npm run posters   → world/public/<embed path without .html>.poster.webp and .poster-dark.webp
// Re-run after changing an interactive figure. Uses world's playwright-core with the installed Chrome (CHROME_PATH overrides).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pub = path.join(root, 'world/public');
const require = createRequire(path.join(root, 'world/package.json'));
const { chromium } = require('playwright-core'), sharp = require('sharp');

// The same posts and blocks the index renders (render.js thumbs: the first three blocks of each version).
const { loadPosts } = await import(path.join(root, 'world/blog-pages-plugin.js'));
const srcs = new Set();
for (const post of await loadPosts()) for (const v of Object.values(post.versions)) {
  for (const block of v.render.blocks.slice(0, 3)) if (block.kind === 'embed') srcs.add(block.src);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const file = path.join(pub, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(pub)) { res.writeHead(404).end(); return; }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
try {
  for (const src of srcs) for (const scheme of ['light', 'dark']) {
    // Reduced motion: the figure's play loop jumps to its end state, the frame a reader is left with.
    const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + src, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    if (errors.length) throw new Error(`${src}: ${errors.join('; ')}`);
    const file = path.join(pub, src.replace(/\.html$/, scheme === 'dark' ? '.poster-dark.webp' : '.poster.webp'));
    const stage = page.locator('.stage').first(), target = await stage.count() ? stage : page.locator('.w').first(); // the figure itself, else the page
    await sharp(await target.screenshot()).resize({ width: 560 }).webp({ quality: 84 }).toFile(file);
    console.log('wrote', path.relative(process.cwd(), file));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
