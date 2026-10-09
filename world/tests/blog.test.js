import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePost, collectPosts, pickVersion, isDraft, published, minutes} from '../src/blog/posts.js';
import {renderPost, slugify, hasMath, MAX_MARGIN_NOTES} from '../src/blog/markdown.js';
import {validateSpec, niceTicks, formatValue, chartSVG} from '../src/blog/chart.js';
import {stripCjkSpaces, smartQuotes, wordBreaks} from '../src/blog/text.js';
import {readPrefs, writePrefs, PREFS_KEY} from '../src/blog/prefs.js';
import {phaseOf, WORKS} from '../src/blog/taxonomy.js';
import {readPosts, loadPosts, writeBlog, workLinks, renderPages} from '../blog-pages-plugin.js';
import {pageChars} from '../src/blog/build/fonts.js';
import {sitemapEntries} from '../src/blog/build/feeds.js';

const world = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(world, 'src/blog/posts');
process.env.BLOG_OG = '0'; // share cards need a browser; the build test only checks pages, fonts and feeds

/* ---------------- posts ---------------- */
test('every blog post file parses with a title, a date, a type and known tags', () => {
  const posts = readPosts();
  assert.ok(posts.length > 0);
  for (const post of posts) {
    assert.ok(['essay', 'note', 'explainer', 'log'].includes(post.type), post.slug);
    for (const v of Object.values(post.versions)) { assert.ok(v.title); assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(v.body.length > 0); }
  }
});

test('posts sort newest first, fall back to the other language and share their fields', () => {
  const md = (title, date, extra = '') => `---\ntitle: ${title}\ndate: ${date}\n${extra}---\nBody`;
  const posts = collectPosts({'./posts/old.en.md': md('Old', '2026-01-01', 'tags: [agents, harness]\n'), './posts/new.zh.md': md('新', '2026-05-01', 'type: essay\nwork: [autodesign]\n')});
  assert.deepEqual(posts.map(p => p.slug), ['new', 'old']);
  assert.equal(pickVersion(posts[0], 'en').lang, 'zh');
  assert.deepEqual(posts[1].tags, ['agents', 'harness']);
  assert.equal(posts[0].type, 'essay');
  assert.equal(posts[0].phase, 'post-training', 'the phase follows from the work');
  assert.equal(posts[1].phase, null, 'no paper: off the map');
  assert.equal(phaseOf(['apl', 'opencaptchaworld']), 'eval');
  assert.ok(WORKS['longcat-2.5'] && WORKS.figmirror && WORKS.dvin);
});

test('front matter is validated: quotes, tags, types, works, shared fields, updates', () => {
  const md = (extra, title = 'x') => `---\ntitle: ${title}\ndate: 2026-01-01\n${extra}---\nbody`;
  assert.equal(parsePost('./posts/a.en.md', md('', 'The "inner loop"')).title, 'The "inner loop"');
  assert.equal(parsePost('./posts/a.en.md', md('', '"Quoted: with colon"')).title, 'Quoted: with colon');
  assert.throws(() => parsePost('./posts/no-lang.md', md('')), /<slug>\.<en\|zh>\.md/);
  assert.throws(() => parsePost('./posts/a.en.md', 'no front matter'), /front matter/);
  assert.throws(() => parsePost('./posts/a.en.md', '---\ntitle: x\ndate: Oct 2\n---\nbody'), /YYYY-MM-DD/);
  assert.throws(() => parsePost('./posts/a.en.md', md('tags: [Agents]\n')), /Unknown tag/);
  assert.throws(() => parsePost('./posts/a.en.md', md('type: poem\n')), /Unknown type/);
  assert.throws(() => parsePost('./posts/a.en.md', md('work: [no-such-paper]\n')), /Unknown work/);
  assert.throws(() => parsePost('./posts/a.en.md', md('updated: 2025-01-01\n')), /updated/);
  assert.throws(() => collectPosts({'./posts/a.en.md': md('type: note\n'), './posts/a.zh.md': md('type: essay\n')}), /differently/);
  const v = parsePost('./posts/a.en.md', '---\ntitle: x\ndate: 2026-01-01\nupdated: 2026-02-01\n---\nBody text.\n\n## Updates\n\n- 2026-02-01: Fixed the table.\n');
  assert.deepEqual(v.updates, [{date: '2026-02-01', text: 'Fixed the table.'}]);
  assert.ok(!v.body.includes('Updates'));
});

test('drafts stay drafts until one language version is published, and draft translations are dropped', () => {
  const md = extra => `---\ntitle: T\ndate: 2026-01-01\n${extra}---\nBody`;
  const [both] = collectPosts({'./posts/a.en.md': md('draft: true\n'), './posts/a.zh.md': md('draft: true\n')});
  const [mixed] = collectPosts({'./posts/b.en.md': md(''), './posts/b.zh.md': md('draft: true\n')});
  assert.equal(isDraft(both), true); assert.equal(published(both), null);
  assert.equal(isDraft(mixed), false); assert.deepEqual(Object.keys(published(mixed).versions), ['en']);
});

/* ---------------- typography ---------------- */
test('Chinese typesetting: hand-typed spaces go, curly quotes come, headlines break between words', () => {
  assert.equal(stripCjkSpaces('一个 Agent 的 **Harness** 有 $k$ 条规则，见 [论文](https://x.y/a b)'), '一个Agent的**Harness**有$k$条规则，见[论文](https://x.y/a b)');
  assert.equal(stripCjkSpaces('1. 第一项\n- 第二项 `code x` 文字'), '1. 第一项\n- 第二项`code x`文字');
  assert.equal(smartQuotes('A "done" isn\'t \'real\'', 'en'), 'A “done” isn’t ‘real’');
  assert.equal(smartQuotes('别说"完成"', 'zh'), '别说“完成”');
  const title = wordBreaks('Harness 知道、模型却不知道的东西');
  assert.ok(title.includes('模型') && !/模<wbr>型/.test(title), title);
  assert.ok(title.includes('知道、<wbr>'), 'punctuation stays with the word before it');
  assert.ok(!/Harness<wbr>/.test(wordBreaks('Harness知道')), 'no break element at a Latin–Chinese boundary (it would cancel text-autospace)');
});

/* ---------------- markdown ---------------- */
test('markdown renders numbered equations, artboard figures, static charts, sidenotes and code windows', () => {
  const svg = '<svg viewBox="0 0 680 330"><rect/></svg>';
  const r = renderPost([
    'Cost $O(n^2)$, not $5 or $6. See [equation (1)](#eq-1).[^n]', '',
    '## First part', '', '$$\nx^2 \\label{eq:sq}\n$$', '',
    '![Layers](/blog/a.svg "Figure 1. The caption.")', '',
    '```chart', '{"type":"line","title":"T","x":["a","b"],"series":[{"name":"S","values":[1,2]}],"y":{"unit":"%"}}', '```', '',
    '```python file=pkg/rule.py hl=2', 'a = 1', 'b = "x"', '```', '',
    '| A | B |', '| --- | --- |', '| x | 12 |', '',
    '[^n]: A *note*.',
  ].join('\n'), {lang: 'en', images: src => src === '/blog/a.svg' ? {width: 680, height: 330, svg} : null});
  assert.match(r.html, /<div class="math" id="eq-sq"[^>]*>.*class="katex-display".*<a class="eq-num" href="#eq-sq"[^>]*>\(1\)<\/a>/s);
  assert.ok(r.html.includes('not $5 or $6.'), 'dollar amounts stay text');
  assert.match(r.html, /<a class="xref" href="#eq-1">equation \(1\)<\/a>/);
  assert.match(r.html, /<figure class="fig" id="fig-1"[^>]*data-zoom><div class="fig-head">.*<b>Figure 1<\/b><span>· a\.svg<\/span><span class="sz">680 × 330<\/span>/s);
  assert.match(r.html, /<svg role="img" aria-label="Layers" viewBox="0 0 680 330">/);
  assert.match(r.html, /<figcaption><b>Figure 1\.<\/b>The caption\.<\/figcaption>/);
  assert.match(r.html, /<figure class="fig chart" id="fig-2"[^>]*data-hover=/);
  assert.match(r.html, /<path class="s-line"/, 'the chart is drawn at build time');
  assert.match(r.html, /<div class="chart-table"><table>.*<td>2%<\/td>/s, 'and has its data table');
  assert.match(r.html, /<a class="fn-ref" href="#fn-1"[^>]*>1<\/a><span class="sn" id="fn-1" data-n="1" role="note"><span class="sn-n">1<\/span>A <em>note<\/em>\.<\/span>/);
  assert.match(r.html, /<figure class="code" id="code-rule-py" data-file="pkg\/rule\.py">.*<span class="code-file">.*pkg\/rule\.py<\/span><span class="code-lang">python<\/span>/s);
  assert.match(r.html, /<span class="ln hl" data-n="2">.*hljs-string/);
  assert.match(r.html, /<h2 id="first-part"><a class="h-anchor" href="#first-part"[^>]*><span class="num">01<\/span><span class="hash">#<\/span><\/a>First part<\/h2>/);
  assert.match(r.html, /<td class="num">12<\/td>/);
  assert.deepEqual(r.sections[0].kids.map(k => k.kind), ['eq', 'fig', 'chart', 'code', 'table']);
  assert.equal(r.blocks.length, 3);
  assert.equal(hasMath('`$x$` only code'), false);
  assert.equal(slugify('三类 Scaffolding!'), '三类-scaffolding');
});

test('callouts get a mono label; Critic / Designer notes are capped per post', () => {
  const html = renderPost('> [!NOTE]\n> Cost.\n\n> [!CRITIC]\n> These numbers are made up.\n\n> Plain quote.', {lang: 'en'}).html;
  assert.match(html, /<aside class="callout" data-kind="note"><p class="callout-title">.*<span>Note<\/span><\/p><p>Cost\.<\/p>/s);
  assert.match(html, /<aside class="anno anno-critic" aria-label="Critic note">.*<b>Critic<\/b>.*These numbers are made up\./s);
  assert.match(html, /<blockquote>\n<p>Plain quote\.<\/p>/);
  const many = Array.from({length: MAX_MARGIN_NOTES + 1}, () => '> [!DESIGNER]\n> Why.').join('\n\n');
  assert.throws(() => renderPost(many, {lang: 'en'}), /At most 2/);
  assert.match(renderPost('读 *这个* 词', {lang: 'zh'}).html, /<em>这个<\/em>/);
});

test('every chart block in every post is a valid chart spec', () => {
  for (const f of fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))) {
    const body = fs.readFileSync(path.join(postsDir, f), 'utf8');
    for (const [, json] of body.matchAll(/```chart\n([\s\S]*?)```/g)) assert.doesNotThrow(() => validateSpec(JSON.parse(json)), f);
  }
});

test('chart helpers produce clean ticks, reject malformed specs and draw series in theme colors', () => {
  assert.deepEqual(niceTicks(0, 100, 4), [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(0, 64, 4), [0, 20, 40, 60, 80]);
  assert.equal(formatValue(12900), '12.9K'); assert.equal(formatValue(55, '%'), '55%');
  assert.throws(() => validateSpec({type: 'pie', x: [1], series: [{name: 'a', values: [1]}]}), /line" or "bar/);
  assert.throws(() => validateSpec({type: 'bar', x: [1, 2], series: [{name: 'a', values: [1]}]}), /one value per x/);
  assert.throws(() => validateSpec({type: 'bar', x: [1], series: 'abcde'.split('').map(n => ({name: n, values: [1]}))}), /at most 4/);
  const {svg, hover} = chartSVG({type: 'bar', x: ['a', 'b'], series: [{name: 'A', values: [1, 2]}, {name: 'B', values: [3, null]}]});
  assert.match(svg, /var\(--rd-series-2\)/);
  assert.deepEqual(hover.vals, [['1', '2'], ['3', '—']]);
});

/* ---------------- preferences shared with the homepage ---------------- */
test('the blog shares EN/中 and theme with the homepage and never drops the homepage settings', () => {
  const store = new Map(), mem = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  store.set(PREFS_KEY, JSON.stringify({lang: 'zh', quality: 'low', sound: true, theme: null}));
  assert.deepEqual(readPrefs(mem), {lang: 'zh', theme: null}, 'a choice of 中文 on the homepage opens the blog in Chinese');
  writePrefs({theme: 'dark'}, mem); writePrefs({lang: 'en'}, mem);
  assert.deepEqual(JSON.parse(store.get(PREFS_KEY)), {lang: 'en', quality: 'low', sound: true, theme: 'dark'});
  store.set(PREFS_KEY, 'not json'); writePrefs({lang: 'zh'}, mem);
  assert.deepEqual(JSON.parse(store.get(PREFS_KEY)), {lang: 'zh'});
  // The homepage's own preferences key is the same one.
  assert.ok(fs.readFileSync(path.join(world, 'src/ui.js'), 'utf8').includes(`'${PREFS_KEY}'`));
});

/* ---------------- the static build ---------------- */
async function fixtureBuild() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-')), posts = path.join(dir, 'posts'), out = path.join(dir, 'out');
  fs.mkdirSync(posts);
  const write = (name, text) => fs.writeFileSync(path.join(posts, name), text);
  write('real-post.en.md', '---\ntitle: A real post\ndate: 2026-10-10\nsummary: It says something.\ntype: explainer\nwork: [autodesign]\ntags: [harness]\n---\nThe opening paragraph of the real post.\n\n## Setup\n\nText with $x^2$.\n\n## Results\n\nMore.\n');
  write('real-post.zh.md', '---\ntitle: 一篇正式文章\ndate: 2026-10-10\nsummary: 它讲了一件事。\ntype: explainer\nwork: [autodesign]\ntags: [harness]\n---\n正式文章的第一段，提到 Agent 和模型。\n\n## 设定\n\n文字。\n');
  write('only-zh.zh.md', '---\ntitle: 只有中文的笔记\ndate: 2026-09-01\nsummary: 中文摘要。\n---\n中文正文。\n');
  write('layout-sample.en.md', '---\ntitle: Layout sample\ndate: 2026-08-01\nplaceholder: true\n---\nPlaceholder body.\n');
  write('secret.en.md', '---\ntitle: SECRET-DRAFT-TITLE-8c1f\ndate: 2026-10-20\ndraft: true\n---\nSECRET-DRAFT-BODY-8c1f\n');
  write('real-post-draft.en.md', '---\ntitle: Another\ndate: 2026-07-01\n---\nPublished.\n');
  write('real-post-draft.zh.md', '---\ntitle: DRAFT-TRANSLATION-8c1f\ndate: 2026-07-01\ndraft: true\n---\nDRAFT-TRANSLATION-BODY-8c1f\n');
  const logs = [];
  const result = await writeBlog(out, {assets: '<script type="module" src="/assets/blog-test.js"></script>', directory: posts, log: m => logs.push(m)});
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(f); } };
  walk(out);
  const read = rel => fs.readFileSync(path.join(out, rel), 'utf8');
  return {out, files, read, result, logs, postsDir: posts};
}
let built;
const build = () => built ||= fixtureBuild();

test('drafts and draft translations never reach any built file', async () => {
  const {files} = await build();
  assert.ok(files.length > 8);
  for (const file of files) {
    const text = fs.readFileSync(file).toString('latin1');
    for (const marker of ['SECRET-DRAFT', 'DRAFT-TRANSLATION']) assert.ok(!text.includes(marker), `${marker} in ${file}`);
  }
  assert.ok(!files.some(f => f.includes('/secret/')));
  assert.ok(!files.some(f => f.includes('/real-post-draft/zh/')));
  // The client bundle carries no post data at all: it imports no Markdown and no post module.
  const client = fs.readFileSync(path.join(world, 'src/blog/blog.js'), 'utf8');
  assert.ok(!/import\.meta\.glob|\.md['"?]|from '\.\/posts|from '\.\/markdown/.test(client));
});

test('every page is static HTML with its content, canonical and hreflang pair', async () => {
  const {read} = await build();
  const en = read('blog/real-post/index.html'), zh = read('blog/real-post/zh/index.html');
  assert.match(en, /<html lang="en" class="page-post">/); assert.match(zh, /<html lang="zh-CN" class="page-post">/);
  assert.match(en, /<h1 class="h1">A real post<\/h1>/);
  assert.match(en, /<p>The opening paragraph of the real post\.<\/p>/);
  assert.match(en, /<li class="h2" data-id="setup"><a href="#setup"><span class="n">01<\/span><span>Setup<\/span><\/a><\/li>/, 'Layers outline');
  assert.match(en, /class="katex"/, 'math is rendered at build time');
  assert.match(en, /<link rel="stylesheet" href="\/blog\/katex\/katex\.min\.css">/);
  assert.match(zh, /正式文章的第一段，提到Agent和模型。/, 'Chinese spacing is drawn by text-autospace');
  for (const html of [en, zh]) {
    assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/">/);
    assert.match(html, /<link rel="alternate" hreflang="zh-CN" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/zh\/">/);
    assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/">/);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.match(html, /<script type="module" src="\/assets\/blog-test\.js"><\/script>/);
    assert.match(html, /application\/ld\+json/);
    assert.doesNotMatch(html, /noindex/);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|cdn\./, 'no third-party requests');
  }
  assert.match(en, /<link rel="canonical" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/">/);
  assert.match(zh, /<link rel="canonical" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/zh\/">/);
  // A Chinese-only post lives at its base URL, in Chinese, without hreflang; the English index lists it with a badge.
  const only = read('blog/only-zh/index.html');
  assert.match(only, /<html lang="zh-CN"/); assert.doesNotMatch(only, /hreflang=/);
  const index = read('blog/index.html'), indexZh = read('blog/zh/index.html');
  assert.match(index, /只有(<wbr>)?中文(<wbr>)?的(<wbr>)?笔记<\/a><span class="lang-badge zh"/);
  assert.match(index, /<h1>Yaxin’s Blog<\/h1>/); assert.match(indexZh, /<h1>Yaxin 的博客<\/h1>/);
  assert.match(index, /Research notes on post-training agents for long-horizon work: the model, and the harness around it\./);
  assert.match(indexZh, /后训练长程智能体的研究笔记：模型，以及它周围的 harness。/);
  assert.match(index, /<article class="pv" data-slug="real-post"/, 'the first-page preview is in the HTML');
  assert.match(indexZh, /hreflang="zh-CN" href="https:\/\/yaxin9luo\.github\.io\/blog\/zh\/"/);
  // Theme and language come from the homepage's preferences before first paint.
  assert.match(en, /yaxin\.grimoire\.preferences/);
  assert.match(en, /var alt="\/blog\/real-post\/zh\/";if\(alt&&p\.lang==="zh"\)location\.replace/);
});

test('placeholder posts stay published but carry noindex and stay out of feeds and the sitemap', async () => {
  const {read, result} = await build();
  assert.match(read('blog/layout-sample/index.html'), /<meta name="robots" content="noindex">/);
  assert.match(read('blog/index.html'), /data-slug="layout-sample"/, 'still listed on the index');
  for (const feed of ['blog/feed.xml', 'blog/feed.zh.xml']) assert.ok(!read(feed).includes('layout-sample'), feed);
  assert.ok(!sitemapEntries(result.posts).some(e => e.path.includes('layout-sample')));
  // The site's placeholder posts (the outline of the post in progress): every language version is noindex.
  const pages = renderPages(await loadPosts()).filter(p => p.post?.placeholder);
  assert.equal(new Set(pages.map(p => p.post.slug)).size, 1);
  for (const page of pages) assert.match(page.head, /<meta name="robots" content="noindex">/, page.path);
});

test('feeds are full-text Atom with absolute links, newest first, one per language', async () => {
  const {read} = await build();
  const en = read('blog/feed.xml'), zh = read('blog/feed.zh.xml');
  for (const xml of [en, zh]) {
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"'));
    assert.equal((xml.match(/<entry /g) || []).length, 3);
    assert.doesNotMatch(xml, /href=&quot;\/(?!\/)|src=&quot;\/(?!\/)/, 'links are absolute');
    const updated = [...xml.matchAll(/<entry[\s\S]*?<published>([^<]+)</g)].map(m => m[1]);
    assert.deepEqual(updated, [...updated].sort().reverse());
  }
  assert.match(en, /<link rel="alternate" type="text\/html" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/"\/>/);
  assert.match(zh, /<link rel="alternate" type="text\/html" href="https:\/\/yaxin9luo\.github\.io\/blog\/real-post\/zh\/"\/>/);
  assert.match(en, /<entry xml:lang="zh-CN">\s*<id>https:\/\/yaxin9luo\.github\.io\/blog\/only-zh\/<\/id>/, 'single-language posts appear in both feeds');
  assert.match(en, /The opening paragraph of the real post/);
});

test('per-page Chinese font subsets cover every character the page shows (when the sources exist)', async () => {
  const {read, logs, out} = await build();
  const manifest = JSON.parse(read('blog/fonts/manifest.json'));
  const files = Object.values(manifest).flat();
  if (!files.length) { assert.ok(logs.some(l => /system CJK fonts|system fonts/.test(l)), 'the fallback is reported'); return; }
  for (const [page, faces] of Object.entries(manifest)) {
    const html = read(`${page.slice(1)}index.html`), chars = pageChars(html, {zh: page.includes('/zh/') || page === '/blog/only-zh/'});
    const sans = faces.find(f => f.family === 'Blog SC Sans' && f.weight === 400)?.chars || '';
    for (const c of chars.sans400) assert.ok(sans.includes(c), `${page}: ${c}`);
    for (const f of faces) assert.ok(html.includes(`/blog/fonts/${f.file}`), `${page} declares ${f.file}`);
  }
  for (const f of files) assert.ok(fs.statSync(path.join(out, 'blog/fonts', f.file)).size < 200_000, f.file);
});

test('the homepage entry points come from published posts with a work link', async () => {
  const {result} = await build();
  const links = workLinks(result.posts);
  assert.deepEqual(Object.keys(links), ['autodesign']);
  assert.deepEqual(links.autodesign.map(p => [p.slug, p.type, p.href.zh]), [['real-post', 'explainer', '/blog/real-post/zh/']]);
  const real = workLinks(await loadPosts());
  assert.ok(Object.values(real).flat().every(p => !p.slug.includes('draft')));
});

test('sitemap entries list both indexes and every indexable version with its hreflang pair', async () => {
  const {result} = await build();
  const entries = sitemapEntries(result.posts);
  assert.deepEqual(entries.map(e => e.path), ['/blog/', '/blog/zh/', '/blog/real-post/', '/blog/real-post/zh/', '/blog/only-zh/', '/blog/real-post-draft/']);
  assert.deepEqual(entries[2].alternates, {en: '/blog/real-post/', zh: '/blog/real-post/zh/'});
  assert.equal(entries[4].alternates, null);
});

test('reading time counts Chinese characters and English words', () => {
  assert.equal(minutes('word '.repeat(440)), 2);
  assert.equal(minutes('字'.repeat(800)), 2);
  assert.equal(minutes('```\n' + 'code '.repeat(1000) + '\n```\nshort'), 1);
});

test('homepage: "notes (n) →" on map cards and "Explainer →" on Publications / Projects appear only for linked posts', async () => {
  const {setWorkLinks} = await import('../src/blog/work-links.js');
  const {cardHTML} = await import('../src/landing/landing.js');
  const {renderJournal} = await import('../src/journal.js');
  try {
    // Today no published post links a paper, so nothing is shown.
    setWorkLinks(workLinks(await loadPosts()));
    assert.doesNotMatch(cardHTML('ad', 'en'), /notes \(/);
    assert.doesNotMatch(renderJournal('publications', 'en'), /Explainer/);
    // With a published Explainer about AutoDesign (fixture), both entry points appear and link to the blog.
    const {result} = await build();
    setWorkLinks(workLinks(result.posts));
    assert.match(cardHTML('ad', 'en'), /<a class="notes" href="\/blog\/\?work=autodesign">notes \(1\) →<\/a>/);
    assert.match(cardHTML('ad', 'zh'), /<a class="notes" href="\/blog\/zh\/\?work=autodesign">笔记 \(1\) →<\/a>/);
    assert.doesNotMatch(cardHTML('apl', 'en'), /notes \(/);
    assert.match(renderJournal('publications', 'en'), /<a class="paper-link paper-link-blog" href="\/blog\/real-post\/">Explainer →<\/a>/);
    assert.match(renderJournal('projects', 'zh'), /<a class="paper-link paper-link-blog" href="\/blog\/real-post\/zh\/">解读 →<\/a>/);
  } finally { setWorkLinks({}); }
});
