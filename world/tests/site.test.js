import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {legacy, legacyRoutes, filesForPath, redirectStub, notFoundPage, sitemapXml} from '../../scripts/site/pages.mjs';
import {renderLanding, renderExplore} from '../src/landing/landing.js';
import {parseContentRoute} from '../src/exhibition-state.js';
import {readPosts, postPageHtml} from '../blog-pages-plugin.js';
import {isDraft} from '../src/blog/posts.js';

const world = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(world, '..');
const STALE = /\/traditional|traditional (site|website)|传统主页|经典版主页/i;

function sources(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(item => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? sources(file) : /\.(js|css|html|md)$/.test(item.name) ? [file] : [];
  });
}

test('nothing on the site links to the removed /traditional/ site any more', () => {
  for (const lang of ['en', 'zh']) {
    assert.ok(!STALE.test(renderLanding(lang)), `landing (${lang})`);
    assert.ok(!STALE.test(renderExplore(lang)), `top bar (${lang})`);
  }
  const files = [...sources(path.join(world, 'src')), path.join(world, 'index.html'), path.join(world, 'blog/index.html'), path.join(world, 'blog-pages-plugin.js')];
  assert.ok(files.length > 50);
  for (const file of files) assert.ok(!STALE.test(fs.readFileSync(file, 'utf8')), path.relative(root, file));
});

test('every page of the removed site redirects to its live equivalent', () => {
  const pages = legacy.pages;
  for (const [from, to] of Object.entries(pages)) {
    assert.match(from, /^\//, from);
    assert.ok(to.startsWith('/') && !to.includes('traditional'), `${from} → ${to}`);
    const url = new URL(to, 'https://yaxin9luo.github.io');
    if (url.hash) {
      const route = parseContentRoute(url.hash), [kind, id] = url.hash.slice(1).split('/');
      assert.deepEqual([route?.kind, route?.id], [kind, id], `${from} → ${to} opens exactly that panel`);
    } else if (/^\/(files|images)\//.test(url.pathname)) {
      assert.ok(fs.statSync(path.join(root, decodeURIComponent(url.pathname))).size > 0, to);
    } else {
      assert.ok(['/', '/blog/'].includes(url.pathname) && ['', '?lang=zh'].includes(url.search), to);
    }
  }
  assert.equal(pages['/zh/'], '/?lang=zh');
  assert.equal(pages['/cv/'], '/files/CV_YaxinLuo.pdf');
  assert.equal(pages['/zh/cv/'], '/files/CV_YaxinLuo_zh.pdf');
  assert.equal(pages['/publications/'], '/#section/publications');
  assert.equal(pages['/portfolio/'], '/#section/projects');
  assert.equal(pages['/long-horizon-research-thoughts/'], '/blog/');
  const papers = Object.entries(pages).filter(([from]) => from.startsWith('/publication/'));
  assert.equal(papers.length, 6);
  for (const [, to] of papers) assert.match(to, /^\/#paper\//);
  for (const [from, to] of Object.entries(pages).filter(([from]) => from.startsWith('/posts/'))) assert.equal(to, '/blog/', from);
});

test('redirect stubs cover old root and /traditional/ URLs without touching site files', () => {
  assert.deepEqual(filesForPath('/zh/'), ['zh/index.html']);
  assert.deepEqual(filesForPath('/traditional/'), ['traditional/index.html']);
  assert.deepEqual(filesForPath('/publication/APL'), ['publication/APL.html', 'publication/APL/index.html']);
  assert.deepEqual(filesForPath('/talkmap/map.html'), ['talkmap/map.html']);
  const routes = new Map(legacyRoutes());
  assert.equal(routes.get('/traditional/'), '/');
  assert.ok(!routes.has('/'), 'the homepage itself is never a redirect');
  for (const from of Object.keys(legacy.pages)) assert.equal(routes.get(`/traditional${from}`), legacy.pages[from]);
  const written = legacyRoutes().flatMap(([from]) => filesForPath(from));
  assert.equal(new Set(written).size, written.length, 'no two legacy URLs write the same file');
  for (const file of ['index.html', '404.html', 'sitemap.xml', 'blog/index.html', 'yuanmingyuan.html']) assert.ok(!written.includes(file), file);

  const stub = redirectStub('/#section/publications');
  assert.ok(stub.includes('<meta http-equiv="refresh" content="0;url=/#section/publications">'));
  assert.ok(stub.includes('location.replace("/#section/publications")'));
  assert.ok(stub.includes('<link rel="canonical" href="https://yaxin9luo.github.io/">'));
  assert.ok(!stub.includes('noindex'), 'an instant refresh reads as a permanent redirect');
});

test('the 404 page forwards unknown /traditional/ URLs and leaves other misses on the page', () => {
  const html = notFoundPage();
  assert.ok(!html.includes('LEGACY_PAGES') && html.includes('"/publication/APL":"/#paper/apl"'));
  assert.ok(!/https?:\/\/(?!yaxin9luo)/.test(html.replace(/xmlns="[^"]*"/g, '')), 'no third-party requests');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const forward = pathname => {
    let to = null;
    vm.runInNewContext(script, {location: {pathname, replace: url => { to = url; }}, localStorage: {getItem: () => null}, document: {documentElement: {dataset: {}}}, JSON});
    return to;
  };
  assert.equal(forward('/traditional/publications/'), '/#section/publications');
  assert.equal(forward('/traditional/publication/APL.html'), '/#paper/apl');
  assert.equal(forward('/traditional/publication/APL/'), '/#paper/apl');
  assert.equal(forward('/traditional/zh'), '/?lang=zh');
  assert.equal(forward('/traditional/files/CV_YaxinLuo.pdf'), '/files/CV_YaxinLuo.pdf');
  assert.equal(forward('/traditional/images/APL.png'), '/images/APL.png');
  assert.equal(forward('/traditional/some/page/that/never/existed/'), '/');
  assert.equal(forward('/traditional'), '/');
  assert.equal(forward('/no-such-page/'), null);
  assert.equal(forward('/blog/no-such-post/'), null);
});

test('the sitemap lists the homepage, the blog and every published post', () => {
  const posts = readPosts().filter(post => !isDraft(post)).map(post => ({slug: post.slug, date: (post.versions.en || post.versions.zh).date}));
  assert.ok(posts.length > 0);
  const xml = sitemapXml(posts);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(locs, ['https://yaxin9luo.github.io/', 'https://yaxin9luo.github.io/blog/', ...posts.map(p => `https://yaxin9luo.github.io/blog/${p.slug}/`)]);
  assert.ok(!xml.includes('traditional'));
  for (const post of posts) assert.ok(xml.includes(`/blog/${post.slug}/</loc><lastmod>${post.date}</lastmod>`));
});

test('the homepage, the blog and every post share a 1200×630 card in the Editable Canvas style', () => {
  const png = name => {
    const bytes = fs.readFileSync(path.join(world, 'public/og', name));
    assert.equal(bytes.toString('latin1', 1, 4), 'PNG', name);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes.length];
  };
  const meta = (html, key) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
  const shell = fs.readFileSync(path.join(world, 'blog/index.html'), 'utf8');
  const pages = [['home.png', fs.readFileSync(path.join(world, 'index.html'), 'utf8')], ['blog.png', shell],
    ...readPosts().filter(post => !isDraft(post)).map(post => ['blog.png', postPageHtml(shell, post)])];
  for (const [card, html] of pages) {
    const url = `https://yaxin9luo.github.io/og/${card}`;
    assert.equal(meta(html, 'og:image'), url);
    assert.equal(meta(html, 'twitter:image'), url);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    assert.deepEqual([meta(html, 'og:image:width'), meta(html, 'og:image:height')], ['1200', '630']);
    assert.ok(meta(html, 'og:image:alt')?.length > 40 && meta(html, 'twitter:image:alt') === meta(html, 'og:image:alt'));
    assert.equal((html.match(/property="og:image"/g) || []).length, 1);
  }
  for (const card of ['home.png', 'blog.png']) {
    const [width, height, bytes] = png(card);
    assert.deepEqual([width, height], [1200, 630], card);
    assert.ok(bytes < 400_000, `${card} stays light: ${bytes} bytes`);
  }
  const template = fs.readFileSync(path.join(root, 'scripts/og/card.html'), 'utf8');
  assert.ok(template.includes("from '/src/landing/landing.js'"), 'the card draws the real research map and copy');
});
