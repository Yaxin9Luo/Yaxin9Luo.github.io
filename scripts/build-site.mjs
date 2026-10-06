// Assemble the published website in dist/: the Vite app (world/dist), the public academic files at the
// repository root (files/, images/, Yaxin.JPG), redirects for every page of the removed Academic Pages
// site, a 404 page and a fresh sitemap.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRoutes, filesForPath, redirectStub, notFoundPage, sitemapXml, robotsTxt } from './site/pages.mjs';
import { loadPosts } from '../world/blog-pages-plugin.js';
import { sitemapEntries } from '../world/src/blog/build/feeds.js';
import { postPath } from '../world/src/blog/render.js';
import { fetchSources } from './fonts/sources.mjs';
import { profile, links, publications } from '../world/src/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://yaxin9luo.github.io').replace(/\/+$/, '');
// Local checks only: reassemble dist/ from an existing world/dist without rebuilding the app.
const skipApp = process.argv.includes('--skip-app');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

async function files(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await files(path.join(directory, item.name), relative));
    else if (item.isFile()) result.push(relative);
  }
  return result;
}
const size = async file => (await stat(path.join(destination, file)).catch(() => null))?.size ?? 0;

if (!skipApp) {
  // The blog's per-page CJK subsets need the source fonts; without them the build still succeeds (system fonts).
  await fetchSources(undefined, message => console.log(message));
  run('node', ['scripts/sync-portfolio-data.mjs']);
  run('npm', ['--prefix', 'world', 'run', 'build']);
  run('node', ['scripts/prepare-public-assets.mjs']);
}

// Only this known generated destination is removed; source content is untouched.
await rm(destination, { recursive: true, force: true });
await cp(path.join(root, 'world/dist'), destination, { recursive: true });

// Public academic URLs (CV PDFs, paper figures, portrait) are served straight from the repository root.
for (const name of ['files', 'images', 'Yaxin.JPG']) {
  await cp(path.join(root, name), path.join(destination, name), { recursive: true });
}

// Every page of the removed Academic Pages site forwards to its equivalent (scripts/site/legacy-redirects.json).
let redirects = 0;
for (const [urlPath, target] of legacyRoutes()) {
  for (const file of filesForPath(urlPath)) {
    if (await size(file)) throw new Error(`Legacy redirect would overwrite a site file: ${file}`);
    await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
    await writeFile(path.join(destination, file), redirectStub(target, siteUrl));
    redirects += 1;
  }
}
await writeFile(path.join(destination, '404.html'), notFoundPage());

// Published posts (drafts never reach the build); placeholders are published but noindex, so not in the sitemap.
const posts = await loadPosts();
const entries = [{ path: '/', lastmod: null }, ...sitemapEntries(posts)];
await writeFile(path.join(destination, 'sitemap.xml'), sitemapXml(entries, siteUrl));
await writeFile(path.join(destination, 'robots.txt'), robotsTxt(siteUrl));
// The site-wide feed is the blog's English feed.
await cp(path.join(destination, 'blog/feed.xml'), path.join(destination, 'feed.xml'));
await writeFile(path.join(destination, '.nojekyll'), '');

// Every local URL the site links to must resolve in the published output.
const required = new Set([
  'index.html', 'blog/index.html', 'blog/zh/index.html', '404.html', 'sitemap.xml', 'robots.txt', 'feed.xml', 'blog/feed.xml', 'blog/feed.zh.xml', 'og/home.png', 'og/blog.png',
  ...posts.flatMap(post => Object.keys(post.versions).map(lang => `${postPath(post, lang).slice(1)}index.html`)),
  ...[profile.portrait, links.cv, links.cvZh, ...publications.map(p => p.image)].filter(Boolean),
  ...legacyRoutes().map(([, target]) => target).filter(target => /^\/(files|images)\//.test(target)),
].map(file => file.replace(/^\//, '')));
for (const file of required) {
  if (!(await size(file))) throw new Error(`Missing or empty build output: ${file}`);
}
// The removed site must not be linked from the app or the blog (its redirect pages and 404 may name it).
for (const file of (await files(destination)).filter(f => /^(index\.html|blog\/.*\.html|assets\/[^/]+\.js)$/.test(f))) {
  if ((await readFile(path.join(destination, file), 'utf8')).includes('/traditional')) throw new Error(`Stale /traditional link in ${file}`);
}
console.log(`Website built at dist/: ${redirects} legacy redirect pages, ${posts.length} posts, ${entries.length} sitemap URLs.`);

const publishedFiles = await files(destination); let publishedBytes = 0;
for (const file of publishedFiles) publishedBytes += (await stat(path.join(destination, file))).size;
if (publishedBytes > 1000000000) throw new Error('GitHub Pages output exceeds 1 GB: ' + publishedBytes);
console.log('Published site bytes:', publishedBytes);
