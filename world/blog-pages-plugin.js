// The blog is rendered at build time (SSG) inside the Vite build:
//   /blog/ and /blog/zh/                 the index (direction D), one per interface language
//   /blog/<slug>/ and /blog/<slug>/zh/   each language version of a post (direction E), hreflang-paired
//   /blog/<slug>/og.png (…/zh/og.png)    share cards; /blog/fonts/*.woff2 per-page CJK subsets
//   /blog/feed.xml, /blog/feed.zh.xml    Atom feeds (full text)
// The client bundle (src/blog/blog.js) never contains post data, so drafts cannot leak through it; drafts are only
// rendered by the dev server. The homepage reads the published posts' work links via `virtual:blog-work-links`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectPosts, published, minutes, length} from './src/blog/posts.js';
import {renderPost} from './src/blog/markdown.js';
import {renderIndex, renderArticle, pageHtml, postPath, versionFor, SITE, phaseLabel} from './src/blog/render.js';
import {typeset, smartQuotes} from './src/blog/text.js';
import {TYPES, TAGS} from './src/blog/taxonomy.js';
import {pageChars, pageFonts} from './src/blog/build/fonts.js';
import {renderCards} from './src/blog/build/og.js';
import {atomFeed} from './src/blog/build/feeds.js';
import {ogCardHtml} from './src/blog/og-card.js';

const world = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(world, 'src/blog/posts');
const publicDir = path.join(world, 'public');
const cacheDir = path.join(world, '.cache');
const katexDir = path.join(world, 'node_modules/katex/dist');
const VIRTUAL = 'virtual:blog-work-links';
// /blog/, /blog/zh/, /blog/<slug>/, /blog/<slug>/zh/ (files such as /blog/figure.svg are left alone)
const PAGE_PATH = /^\/blog\/(?:([a-z0-9][a-z0-9-]*)\/)?(zh\/)?(?:index\.html)?$/;

/** All post files, parsed (drafts included). */
export function readPosts(directory = postsDir) {
  const files = Object.fromEntries(fs.readdirSync(directory).filter(f => f.endsWith('.md')).map(f => [`./posts/${f}`, fs.readFileSync(path.join(directory, f), 'utf8')]));
  return collectPosts(files);
}

/** What a local image is: its size, and for SVG the markup to inline (so CSS can theme it). */
async function imageInfo(src, dir = publicDir) {
  if (!src.startsWith('/')) return null;
  const file = path.join(dir, src);
  if (!file.startsWith(dir) || !fs.existsSync(file)) throw new Error(`Blog image not found: ${src}`);
  if (file.endsWith('.svg')) {
    const svg = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*>\s*/, '').trim();
    const vb = svg.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
    return {width: vb ? Math.round(+vb[1]) : null, height: vb ? Math.round(+vb[2]) : null, svg};
  }
  const sharp = (await import('sharp')).default, meta = await sharp(file).metadata();
  return {width: meta.width, height: meta.height};
}

/**
 * Posts ready to render: drafts dropped unless `dev`, titles and summaries typeset, every version rendered.
 * `feed: true` also renders a feed copy of each version (images as <img>, no inline SVG).
 */
export async function loadPosts({dev = false, feed = false, directory = postsDir, images = publicDir} = {}) {
  const posts = readPosts(directory).map(p => dev ? p : published(p)).filter(Boolean);
  const info = new Map();
  for (const p of posts) for (const v of Object.values(p.versions)) {
    for (const [, src] of v.body.matchAll(/!\[[^\]]*\]\(\s*([^\s)]+)/g)) if (!info.has(src)) info.set(src, await imageInfo(src, images));
  }
  for (const post of posts) {
    post.langs = ['en', 'zh'].filter(l => post.versions[l]);
    for (const v of Object.values(post.versions)) {
      // Pages show typeset text (Chinese spacing comes from text-autospace); metadata and feeds keep the typed spaces.
      v.metaTitle = smartQuotes(v.title, v.lang, {open: false}); v.metaSummary = smartQuotes(v.summary, v.lang, {open: false});
      v.title = typeset(v.title, v.lang); v.summary = typeset(v.summary, v.lang);
      v.updates = v.updates.map(u => ({...u, text: typeset(u.text, v.lang)}));
      try {
        v.render = renderPost(v.body, {lang: v.lang, images: src => info.get(src)});
        if (feed) v.feedHtml = renderPost(v.body, {lang: v.lang, images: src => { const i = info.get(src); return i && {width: i.width, height: i.height}; }}).html;
      } catch (error) { throw new Error(`${error.message} (${v.file})`); }
      v.minutes = minutes(v.body); v.length = length(v.body, v.lang);
    }
  }
  return posts;
}

/** Neighbours and related posts for one post. */
function context(posts, post) {
  const i = posts.indexOf(post);
  const score = p => (p.work.some(w => post.work.includes(w)) ? 4 : 0) + (p.tags.filter(t => post.tags.includes(t)).length);
  const related = posts.filter(p => p !== post && p.phase === post.phase).sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date)).slice(0, 3);
  return {newer: posts[i - 1] || null, older: posts[i + 1] || null, related};
}

/** Every page of the blog as {path, lang, kind, head, body}. */
export function renderPages(posts, {og = {}} = {}) {
  const pages = [renderIndex(posts, 'en'), renderIndex(posts, 'zh')];
  for (const post of posts) for (const lang of post.langs) pages.push({...renderArticle(post, lang, {...context(posts, post), og: og[post.slug]}), post});
  return pages;
}

/** Work id → published, non-placeholder posts about it (the homepage's "notes (n) →" and "Explainer →"). */
export function workLinks(posts) {
  const links = {};
  for (const post of posts) {
    if (post.placeholder) continue;
    for (const id of post.work) (links[id] ||= []).push({slug: post.slug, type: post.type, date: post.date,
      title: Object.fromEntries(post.langs.map(l => [l, post.versions[l].title])), href: Object.fromEntries(['en', 'zh'].map(l => [l, postPath(post, versionFor(post, l))]))});
  }
  return links;
}

const ogPath = (post, lang) => `${postPath(post, lang)}og.png`;

function ogCard(post, lang, fontFaces) {
  const v = post.versions[lang], ph = phaseLabel(post.phase, lang);
  return ogCardHtml({lang, title: v.title, summary: v.summary, path: postPath(post, lang), slug: post.slug, typeLabel: TYPES[post.type][lang], date: post.date, minutes: v.minutes,
    phase: post.phase ? `${ph.n} ${ph[lang]}` : '', tags: post.tags.map(k => ({label: TAGS[k][lang], green: k === 'harness'})), fontFaces});
}

/** Build-time output: pages, fonts, cards, feeds, KaTeX assets. `assets` = the Vite tags for the blog bundle. */
export async function writeBlog(outDir, {assets, log = console.log, directory = postsDir, images = publicDir} = {}) {
  const posts = await loadPosts({feed: true, directory, images});
  const fontsOut = path.join(outDir, 'blog/fonts');
  let pages = renderPages(posts, {og: Object.fromEntries(posts.map(p => [p.slug, Object.fromEntries(p.langs.map(l => [l, SITE + ogPath(p, l)]))]))});
  // 1. Per-page CJK subsets (the share card's text is included in its page's subset).
  const fontsByPath = new Map(); let fallback = false;
  for (const page of pages) {
    const zh = page.lang === 'zh';
    const extra = page.post ? pageChars(`<body>${ogCard(page.post, page.lang, '').replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>/g, '')}`, {zh}) : {};
    const fonts = await pageFonts(pageChars(pageHtml(page), {zh}), {zh, outDir: fontsOut, cacheDir: path.join(cacheDir, 'blog-fonts'), extra});
    if (!fonts) fallback = true;
    fontsByPath.set(page.path, fonts || {css: '', preload: '', files: []});
  }
  if (fallback) log('blog: CJK font sources missing (run node scripts/fonts/sources.mjs); Chinese text uses system fonts');
  // 2. Share cards, drawn with the same fonts.
  const cards = pages.filter(p => p.post).map(p => ({id: `${p.post.slug}-${p.lang}`, post: p.post, lang: p.lang,
    html: ogCard(p.post, p.lang, fontsByPath.get(p.path).css.replace(/^<style>|<\/style>$/g, '')), out: path.join(outDir, ogPath(p.post, p.lang).slice(1))}));
  const made = await renderCards(cards, {roots: {'/fonts/': path.join(outDir, 'fonts'), '/blog/fonts/': fontsOut}, cacheDir: path.join(cacheDir, 'og'), log});
  const og = {};
  for (const c of cards) if (made.has(c.id)) (og[c.post.slug] ||= {})[c.lang] = SITE + ogPath(c.post, c.lang);
  pages = renderPages(posts, {og});
  // 3. Pages.
  for (const page of pages) {
    const fonts = fontsByPath.get(page.path);
    const file = path.join(outDir, page.path.slice(1), 'index.html');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, pageHtml(page, {assets, fonts: `${fonts.preload}\n${fonts.css}`}));
  }
  fs.writeFileSync(path.join(fontsOut, 'manifest.json'), JSON.stringify(Object.fromEntries([...fontsByPath].map(([p, f]) => [p, f.files.map(({file, chars, family, weight}) => ({file, chars, family, weight}))])), null, 1));
  // 4. KaTeX stylesheet and the fonts it references, only when a post has math.
  if (posts.some(p => Object.values(p.versions).some(v => v.render.math))) {
    const dest = path.join(outDir, 'blog/katex');
    fs.mkdirSync(path.join(dest, 'fonts'), {recursive: true});
    fs.copyFileSync(path.join(katexDir, 'katex-swap.min.css'), path.join(dest, 'katex.min.css'));
    for (const f of fs.readdirSync(path.join(katexDir, 'fonts')).filter(f => f.endsWith('.woff2'))) fs.copyFileSync(path.join(katexDir, 'fonts', f), path.join(dest, 'fonts', f));
  }
  // 5. Feeds: published, non-placeholder posts, full text.
  const listed = posts.filter(p => !p.placeholder).map(post => ({post, html: Object.fromEntries(post.langs.map(l => [l, post.versions[l].feedHtml]))}));
  fs.writeFileSync(path.join(outDir, 'blog/feed.xml'), atomFeed(listed, 'en', posts[0]?.date));
  fs.writeFileSync(path.join(outDir, 'blog/feed.zh.xml'), atomFeed(listed, 'zh', posts[0]?.date));
  log(`blog: ${pages.length} pages, ${made.size}/${cards.length} share cards, ${fallback ? 'system CJK fonts' : 'per-page CJK subsets'}`);
  return {posts, pages};
}

export function blogPagesPlugin() {
  let outDir = '', command = 'build';
  return {
    name: 'blog-pages',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); command = config.command; },
    resolveId(id) { return id === VIRTUAL ? '\0' + VIRTUAL : null; },
    async load(id) {
      if (id !== '\0' + VIRTUAL) return null;
      return `export default ${JSON.stringify(workLinks(await loadPosts({dev: false})))};`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://x');
        if (url.pathname.startsWith('/blog/katex/')) {
          const file = path.join(katexDir, url.pathname.replace('/blog/katex/', '').replace('katex.min.css', 'katex-swap.min.css'));
          if (file.startsWith(katexDir) && fs.existsSync(file)) { res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'font/woff2'); res.end(fs.readFileSync(file)); return; }
        }
        if (/^\/blog(\/[a-z0-9-]+)?(\/zh)?$/.test(url.pathname)) { res.statusCode = 302; res.setHeader('location', `${url.pathname}/${url.search}`); res.end(); return; }
        const m = url.pathname.match(PAGE_PATH);
        if (!m || req.method !== 'GET') return next();
        try {
          const pages = renderPages(await loadPosts({dev: true}));
          const page = pages.find(p => p.path === url.pathname.replace(/index\.html$/, ''));
          if (!page) return next();
          const html = pageHtml(page, {assets: '<script type="module" src="/src/blog/blog.js"></script>'});
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(await server.transformIndexHtml(url.pathname, html));
        } catch (error) { next(error); }
      });
    },
    async closeBundle() {
      if (command !== 'build') return;
      const shellPath = path.join(outDir, 'blog/index.html');
      if (!fs.existsSync(shellPath)) return;
      const shell = fs.readFileSync(shellPath, 'utf8');
      const assets = [...shell.matchAll(/<(?:script[^>]*src="\/assets\/[^"]+"[^>]*><\/script>|link[^>]*href="\/assets\/[^"]+"[^>]*>)/g)].map(m => m[0]).join('\n');
      if (!assets) throw new Error('blog: could not find the bundle tags in the built shell');
      await writeBlog(outDir, {assets});
    },
  };
}
