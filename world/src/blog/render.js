// Page templates for the blog, rendered at build time (and by the dev server). Plain strings, no DOM.
// Index = direction D "Split Reader"; article = direction E (Layers rail + artboard + Inspector header).
// Nothing here lets a visitor edit anything: selection boxes are static and the cursor is decoration.
import {esc, typeset, wordBreaks} from './text.js';
import {TYPES, TAGS, PHASES, OFF_MAP, WORKS} from './taxonomy.js';
import {links} from '../content.js';

export const SITE = 'https://yaxin9luo.github.io';
export const PREFS_KEY = 'yaxin.grimoire.preferences';
export const NAME = {en: 'Yaxin’s Blog', zh: 'Yaxin 的博客'};
export const NAME_PLAIN = {en: 'Yaxin\'s Blog', zh: 'Yaxin 的博客'};
export const POSITIONING = {
  en: 'Research notes on post-training agents for long-horizon work: the model, and the harness around it.',
  zh: '后训练长程智能体的研究笔记：模型，以及它周围的 harness。',
};
const CREDIT = {en: 'Built with Claude Opus 5.5 as a coding agent, reviewed from rendered screenshots each round.', zh: '由 Claude Opus 5.5 作为编码智能体搭建，每轮基于渲染截图审阅。'};

const COPY = {
  about: ['About Me', '关于我'], research: ['Research', '研究方向'], pubs: ['Publications', '学术论文'], projects: ['Projects', '研究作品'], blog: ['Blog', '博客'], cv: ['CV', '简历'],
  home: ['Home', '主页'], posts: ['posts', '篇'], post: ['post', '篇'], page: ['Page', '页面'], history: ['History', '历史'], newest: ['newest', '最新'],
  langs: ['EN / 中文', '中文 / EN'], portfolio: ['Portfolio', '个人主页'], rss: ['RSS', 'RSS'], read: ['Read', '阅读'], inside: ['Inside', '文中的图表'],
  outline: ['Outline', '大纲'], textOnly: ['text only', '纯文字'], sections: ['sections', '节'], words: ['words', '词'], chars: ['chars', '字'],
  min: ['min', '分钟'], minRead: ['min read', '分钟'], hint: ['hover to switch · click to read', '悬停切换 · 点击阅读'], preview: ['Post preview', '文章预览'],
  filter: ['Filter by title, summary or tag', '按标题、摘要或标签筛选'], all: ['All', '全部'], none: ['No post matches this filter.', '没有符合筛选的文章。'], clear: ['Clear', '清除'],
  placeholder: ['placeholder', '占位'], placeholderNote: ['Placeholder post: a layout preview, not a real article. It will be replaced by the first real post.', '占位文章：用来预览版式，不是正式内容，会被第一篇正式文章替换。'],
  draftNote: ['Draft: visible only on the local dev server.', '草稿：只在本地开发服务器可见。'],
  layers: ['Layers', '图层'], contents: ['Contents', '目录'], allPosts: ['All posts', '全部文章'], cite: ['Cite this post', '引用本文'], top: ['Top', '顶部'],
  intro: ['Introduction', '引言'], updated: ['Updated', '更新'], published: ['Published', '发布'], by: ['Yaxin Luo', '罗亚鑫'], place: ['MBZUAI · VILA Lab', 'MBZUAI · VILA 实验室'],
  lang: ['Language', '语言'], noEn: ['No English version yet', '暂无英文版'], noZh: ['No Chinese version yet', '暂无中文版'],
  updatedBanner: ['Updated', '已更新'], seeUpdates: ['see what changed', '查看改动'], updates: ['Updates', '更新记录'],
  related: ['Related work', '相关工作'], moreIn: ['More in', '更多'], moreOff: ['More off the map', '更多地图之外的文章'], older: ['Older', '较早'], newer: ['Newer', '较新'],
  backIndex: ['Back to the blog index', '回到博客首页'], everyPost: ['Every post, newest first.', '全部文章，按时间倒序。'], onMap: ['on the map', '在地图上'],
  copy: ['Copy', '复制'], text: ['Text', '文本'], left: ['min left', '分钟'], done: ['Finished', '读完了'], notes: ['notes', '条笔记'],
  phaseLink: ['See this phase on the research map', '在研究地图上查看这一阶段'], skip: ['Skip to the post', '跳到正文'], theme: ['Toggle dark mode', '切换深色模式'],
  subscribe: ['Subscribe with RSS', '用 RSS 订阅'], onlyIn: ['Only in', '仅有'],
};
export const copy = (lang, key) => COPY[key]?.[lang === 'zh' ? 1 : 0] ?? key;

const IC = {
  pointer: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3v16l4.5-4.5 3 6.5 2.8-1.3-3-6.3H18z"/></svg>',
  user: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6"/><path d="M2.8 14c.6-2.7 2.7-4.2 5.2-4.2s4.6 1.5 5.2 4.2"/></svg>',
  frame: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5v13M11 1.5v13M1.5 5h13M1.5 11h13"/></svg>',
  text: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M8 3v10.5"/></svg>',
  pen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.6l2.8 2.8-7.7 7.7H2.9v-2.8z"/></svg>',
  blog: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 6h6M5 8.5h6M5 11h3.5"/></svg>',
  cv: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/></svg>',
  moon: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z"/></svg>',
  sun: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.4"/><path d="M10 1.8v2M10 16.2v2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M1.8 10h2M16.2 10h2M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5"/></svg>',
  quote: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h4v4H4.5L3 11.5zM9 4.5h4v4h-2.5L9 11.5z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
  map: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 12c2-7 4-7 5 0s3 7 4 0 3-7 4 0"/></svg>',
  img: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="m2.5 11 3.5-3.5 3 3 2-2 2.5 2.5"/></svg>',
  chart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5h11M3.5 10.5l3-3.5 3 2 3.5-4.5"/></svg>',
  sigma: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3H4l4.5 5L4 13h8"/></svg>',
  code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg>',
  table: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M6.5 6.5V13"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.8C3 3.1 3.6 2.5 4.3 2.5H10.5"/></svg>',
  rss: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5a9.5 9.5 0 0 1 9.5 9.5M3 7.5A5.5 5.5 0 0 1 8.5 13"/><circle cx="3.8" cy="12.2" r="1.1"/></svg>',
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
  note: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v4M8 4.8v.1"/></svg>',
  list: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7"/></svg>',
  cursor: '<svg viewBox="0 0 22 30" aria-hidden="true"><path d="M2 2 L2 25.3 L8.9 18.4 L14.1 29.3 L18.7 27 L13.5 16.4 L23.3 15.5 Z"/></svg>',
};
const KID_ICON = {fig: IC.img, chart: IC.chart, eq: IC.sigma, code: IC.code, table: IC.table};

/* ---------------- URLs ---------------- */
export const primaryLang = post => post.versions.en ? 'en' : 'zh';
/** Path of one language version: /blog/<slug>/ for the primary (English when it exists), /blog/<slug>/zh/ for a paired translation. */
export const postPath = (post, lang) => lang === 'zh' && post.versions.en && post.versions.zh ? `/blog/${post.slug}/zh/` : `/blog/${post.slug}/`;
/** The version a reader in `uiLang` lands on from an index or link. */
export const versionFor = (post, uiLang) => post.versions[uiLang] ? uiLang : primaryLang(post);
export const indexPath = lang => lang === 'zh' ? '/blog/zh/' : '/blog/';

/* ---------------- small pieces ---------------- */
export const phaseLabel = (phase, lang) => phase ? PHASES[phase] : OFF_MAP;
function phaseChip(post, lang, cls = '') {
  const ph = phaseLabel(post.phase, lang);
  return `<span class="phase-chip${post.phase ? '' : ' off'}${cls ? ' ' + cls : ''}">${post.phase ? `<b>${ph.n}</b>` : ''}${esc(ph[lang])}</span>`;
}
const typeName = (post, lang) => TYPES[post.type][lang];
const fmtDate = (d, lang) => {
  const [y, m, dd] = d.split('-').map(Number);
  return lang === 'zh' ? `${y}年${m}月${dd}日` : `${dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
};
/** Title markup: Chinese titles may only break between words. */
const title = (text, lang) => lang === 'zh' ? wordBreaks(text) : esc(text);
/** Language badge for a post shown outside its own language: “中” in the English index, an orange EN in the Chinese one. */
const langBadge = (post, uiLang) => post.versions[uiLang] ? '' : `<span class="lang-badge ${uiLang === 'zh' ? 'en' : 'zh'}" title="${esc(copy(uiLang, 'onlyIn'))} ${uiLang === 'zh' ? 'English' : '中文'}">${uiLang === 'zh' ? 'EN' : '中'}</span>`;
const placeholderMark = (post, lang) => post.placeholder ? `<span class="mark-ph">${esc(copy(lang, 'placeholder'))}</span>` : '';

function sel(inner, tag) {
  return `<span class="sel"><span class="frame" aria-hidden="true"><svg><rect/></svg></span>${inner}${['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'].map(h => `<i class="h ${h}" aria-hidden="true"></i>`).join('')}<span class="tagc" aria-hidden="true">${tag}</span></span>`;
}
const cursor = (kind, label) => `<div class="cur ${kind}" aria-hidden="true">${IC.cursor}<span class="lbl">${label}</span></div>`;

function rulers() {
  return `<div class="corner" aria-hidden="true"></div><div class="rx" aria-hidden="true">${Array.from({length: 39}, (_, i) => `<span style="left:${(i + 1) * 100}px">${(i + 1) * 100}</span>`).join('')}<i class="hl"></i></div><div class="ry" aria-hidden="true"><div class="strip"></div><i class="hl"></i></div>`;
}

function topbar(lang, {crumbs = [], alt}) {
  const t = k => copy(lang, k);
  const segs = [['yaxin-luo', '/'], ['blog', indexPath(lang)], ...crumbs];
  const path = segs.map(([l, h], i) => i === segs.length - 1 ? `<b>${esc(l)}</b>` : `<a href="${h}"${i === 0 ? ' class="root"' : ''}>${esc(l)}</a>`).join('<i>/</i>');
  const nav = [['about', IC.user], ['research', IC.frame], ['publications', IC.text], ['projects', IC.pen]]
    .map(([id, icon]) => `<a href="/#section/${id}">${icon}<span>${esc(t(id === 'publications' ? 'pubs' : id))}</span></a>`).join('');
  const cv = lang === 'zh' ? links.cvZh : links.cv;
  const langBtn = alt
    ? `<a class="lang-btn" href="${alt}?lang=${lang === 'zh' ? 'en' : 'zh'}" data-lang-switch="${lang === 'zh' ? 'en' : 'zh'}" hreflang="${lang === 'zh' ? 'en' : 'zh-CN'}" aria-label="Switch language / 切换语言"><span class="${lang === 'en' ? 'on' : ''}">EN</span><i>/</i><span class="zh ${lang === 'zh' ? 'on' : ''}">中</span></a>`
    : `<span class="lang-btn off" title="${esc(t(lang === 'zh' ? 'noEn' : 'noZh'))}"><span class="${lang === 'en' ? 'on' : ''}">EN</span><i>/</i><span class="zh ${lang === 'zh' ? 'on' : ''}">中</span></span>`;
  return `<header class="topbar"><div class="crumb"><span class="wdots" aria-hidden="true"><i></i><i></i><i></i></span><span class="path">${path}</span></div>
<nav class="nav" aria-label="${esc(t('portfolio'))}"><a class="home" href="/" aria-label="${esc(t('home'))}">${IC.pointer}</a>${nav}<a href="${indexPath(lang)}" aria-current="page">${IC.blog}<span>${esc(t('blog'))}</span></a><span class="sep" aria-hidden="true"></span><a href="${esc(cv)}" target="_blank" rel="noopener">${IC.cv}<span>${esc(t('cv'))}</span></a></nav>
<div class="utils">${langBtn}<button class="icon-btn theme-btn" type="button" aria-label="${esc(t('theme'))}"><span class="moon">${IC.moon}</span><span class="sun">${IC.sun}</span></button></div></header>`;
}

/* ---------------- <head> ---------------- */
/**
 * Everything in <head> except the Vite asset tags (the plugin adds those) and the per-page CJK @font-face block
 * (marked with <!--blog:fonts-->). `alternates` = {en: path, zh: path} for the language versions that exist.
 */
export function head({lang, path, titleText, description, alternates, ogImage, ogAlt, type = 'website', noindex = false, extra = '', math = false}) {
  const url = SITE + path, other = lang === 'zh' ? 'en' : 'zh', locale = lang === 'zh' ? 'zh_CN' : 'en_US';
  const hreflang = alternates.en && alternates.zh
    ? [`<link rel="alternate" hreflang="en" href="${SITE}${alternates.en}">`, `<link rel="alternate" hreflang="zh-CN" href="${SITE}${alternates.zh}">`, `<link rel="alternate" hreflang="x-default" href="${SITE}${alternates.en}">`].join('\n')
    : '';
  // Before first paint: apply the shared theme, and send a reader whose language preference (set on the
  // homepage or here) differs from this page to the other version when one exists. ?lang= wins and is saved.
  const prefs = `<script>(function(){var K=${JSON.stringify(PREFS_KEY)},p={};try{p=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(e){}
var d=document.documentElement;if(p.theme==='light'||p.theme==='dark')d.dataset.theme=p.theme;d.classList.add('js');
var q=new URLSearchParams(location.search),l=q.get('lang');if(l==='en'||l==='zh'){p.lang=l;try{localStorage.setItem(K,JSON.stringify(p))}catch(e){}q.delete('lang');var s=q.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:'')+location.hash)}
var alt=${JSON.stringify(alternates[other] || null)};if(alt&&p.lang===${JSON.stringify(other)})location.replace(alt+location.search+location.hash)})()</script>`;
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titleText)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#F7F7FB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1020" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/svg+xml" href="/crest.svg">
<link rel="canonical" href="${url}">
${hreflang}
<link rel="alternate" type="application/atom+xml" title="${esc(NAME_PLAIN.en)} (English)" href="${SITE}/blog/feed.xml">
<link rel="alternate" type="application/atom+xml" title="${esc(NAME_PLAIN.zh)}（中文）" href="${SITE}/blog/feed.zh.xml">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(NAME_PLAIN[lang])}">
<meta property="og:locale" content="${locale}">
${alternates[other] ? `<meta property="og:locale:alternate" content="${lang === 'zh' ? 'en_US' : 'zh_CN'}">\n` : ''}<meta property="og:title" content="${esc(titleText.replace(/ — .*$/, ''))}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${esc(ogAlt)}">
${extra}${prefs}
<link rel="preload" href="/fonts/blog/source-serif-400.woff2" as="font" type="font/woff2" crossorigin>
${math ? '<link rel="stylesheet" href="/blog/katex/katex.min.css">\n' : ''}<!--blog:fonts-->`;
}

const BLOG_CARD_ALT = {
  en: 'Yaxin’s Blog by Yaxin Luo: research notes on post-training agents for long-horizon work, shown on a design canvas.',
  zh: 'Yaxin 的博客（罗亚鑫）：后训练长程智能体的研究笔记，模型以及它周围的 harness；分享卡片画在一块带标尺和选框的设计画布上。',
};

/* ---------------- index (direction D) ---------------- */
function miniChart(spec) {
  const vals = spec.series.flatMap(s => s.values).filter(v => v !== null), lo = Math.min(...vals), hi = Math.max(...vals);
  const W = 160, H = 64, n = spec.x.length, X = i => 6 + (W - 12) * i / Math.max(1, n - 1), Y = v => H - 6 - (H - 12) * (v - lo) / ((hi - lo) || 1);
  if (spec.type === 'bar') {
    const k = spec.series.length, bw = (W - 12) / n / (k + 1);
    return `<svg class="mini" viewBox="0 0 ${W} ${H}" aria-hidden="true">${spec.x.map((_, i) => spec.series.map((s, si) => s.values[i] === null ? '' : `<rect x="${(6 + i * (W - 12) / n + si * bw).toFixed(1)}" y="${Y(s.values[i]).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(H - 6 - Y(s.values[i])).toFixed(1)}" rx="1.5" class="${si === k - 1 ? 'a' : 'b'}"/>`).join('')).join('')}</svg>`;
  }
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" aria-hidden="true">${spec.series.map((s, si) => `<path class="ln ${si === spec.series.length - 1 ? 'a' : 'b'}" d="${s.values.map((v, i) => v === null ? '' : `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}"/>`).join('')}</svg>`;
}
const TABLE_GLYPH = '<svg viewBox="0 0 160 64" aria-hidden="true"><rect x="20" y="8" width="120" height="48" rx="5" class="tg-card"/><path d="M20 20h120M20 32h120M20 44h120M62 8v48M102 8v48" class="tg-hair"/></svg>';

function thumbs(v, lang) {
  const items = v.render.blocks.slice(0, 3).map(b => {
    const im = b.kind === 'figure' ? (b.svg || `<img src="${esc(b.src)}" alt="" loading="lazy">`) : b.kind === 'chart' ? miniChart(b.spec) : TABLE_GLYPH;
    const kind = b.kind === 'chart' ? (lang === 'zh' ? '图表' : 'chart') : b.kind === 'table' ? b.size : '';
    return `<div class="th"><div class="im">${im}</div><div class="cap">${esc(b.label)}<span>${esc(kind)}</span></div></div>`;
  });
  const h2 = v.render.sections.filter(s => s.level === 2).length;
  return items.length ? items.join('') : `<div class="th none">${esc(copy(lang, 'textOnly'))} · ${h2} ${esc(copy(lang, 'sections'))}</div>`;
}

function previewPanel(post, uiLang, i, selected) {
  const lang = versionFor(post, uiLang), v = post.versions[lang], t = k => copy(uiLang, k);
  const h2s = v.render.sections.filter(s => s.level === 2);
  const len = `${v.length.toLocaleString('en-US')} ${lang === 'zh' ? t('chars') : t('words')}`;
  return `<article class="pv" data-slug="${post.slug}" lang="${lang === 'zh' ? 'zh-CN' : 'en'}"${selected ? '' : ' hidden'}>
<div class="flab"><span>${IC.frame}${esc(String(i + 1).padStart(2, '0'))} · ${esc(post.slug)}</span><span>${esc(len)} · ${v.minutes} ${esc(t('min'))}</span></div>
<div class="page"><i class="h a"></i><i class="h b"></i><i class="h c"></i><i class="h d"></i>
<div class="k">${phaseChip(post, uiLang)}<span>${esc(typeName(post, uiLang))}</span><span>${esc(fmtDate(post.date, uiLang))}</span>${placeholderMark(post, uiLang)}</div>
<h3 class="fs">${title(v.title, lang)}</h3><p class="dek">${esc(v.summary)}</p>
<p class="lbl">${esc(t('inside'))}</p><div class="thumbs">${thumbs(v, uiLang)}</div>
${h2s.length ? `<p class="lbl">${esc(t('outline'))}</p><ol class="ol">${h2s.map(s => `<li><span>${s.n}</span>${esc(s.title)}</li>`).join('')}</ol>` : ''}
<div class="pf"><span class="tag">${post.langs.map(l => l === 'zh' ? '中' : 'EN').join(' · ')}</span><a class="read" href="${postPath(post, lang)}">${esc(t('read'))} · ${v.minutes} ${esc(t('min'))} ${IC.arrow}</a></div></div></article>`;
}

/** The blog index: one landscape screen (history timeline left, sticky first-page preview right) that scrolls natively. */
export function renderIndex(posts, lang) {
  const t = k => copy(lang, k), zh = lang === 'zh';
  const newest = posts[0];
  const rows = posts.map((post, i) => {
    const vl = versionFor(post, lang), v = post.versions[vl];
    const tagText = post.tags.map(k => `${TAGS[k].en} ${TAGS[k].zh}`).join(' ');
    const search = [v.title, v.summary, tagText, ...Object.values(post.versions).map(x => `${x.title} ${x.summary}`)].join(' ').toLowerCase();
    return `<li class="hi${i === 0 ? ' on' : ''}" data-slug="${post.slug}" data-type="${post.type}" data-work="${post.work.join(' ')}" data-phase="${post.phase || 'off'}" data-tags="${post.tags.join(' ')}" data-search="${esc(search)}">
<span class="dot" aria-hidden="true"><i></i></span>
<div class="hm"><div class="d">${post.date}<span class="ty">${esc(typeName(post, lang))}</span>${placeholderMark(post, lang)}</div><h2 lang="${vl === 'zh' ? 'zh-CN' : 'en'}"><a href="${postPath(post, vl)}">${title(v.title, vl)}</a>${langBadge(post, lang)}</h2></div>
<div class="r">${phaseChip(post, lang)}<span>${v.minutes} ${esc(t('min'))}</span></div></li>`;
  }).join('\n');
  const types = Object.keys(TYPES).filter(k => posts.some(p => p.type === k));
  const alternates = {en: '/blog/', zh: '/blog/zh/'};
  const body = `${rulers()}
${topbar(lang, {alt: alternates[zh ? 'en' : 'zh']})}
<main class="ix" id="main">
<section class="left">
<div class="ibar"><span><span class="k">◇</span><b>${esc(t('page'))}</b><span class="k">·</span>${esc(t('blog'))}</span><span><b>${posts.length}</b>${zh ? '' : '&nbsp;'}${esc(t('posts'))}</span><span><span class="k">${esc(t('history'))}</span><span class="ph-dots" aria-hidden="true">${posts.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).reverse().join('')}</span></span></div>
<div class="ttl">${sel(`<h1>${esc(NAME[lang])}</h1>`, 'H1')}${cursor('d', 'Designer')}</div>
<p class="claim">${esc(POSITIONING[lang])}</p>
<form class="filter" role="search" hidden><label class="q">${IC.search}<span class="sr">${esc(t('filter'))}</span><input type="search" name="q" placeholder="${esc(t('filter'))}" autocomplete="off"><kbd>/</kbd></label>
${types.length > 1 ? `<div class="seg" role="group" aria-label="Type"><button type="button" class="on" data-type="">${esc(t('all'))}</button>${types.map(k => `<button type="button" data-type="${k}">${esc(TYPES[k][lang])}</button>`).join('')}</div>` : ''}
<span class="active" hidden></span></form>
<ol class="hist">${rows}</ol>
<p class="empty" hidden>${esc(t('none'))}</p>
</section>
<section class="win" aria-label="${esc(t('preview'))}">
<div class="bar"><span class="wdots bare" aria-hidden="true"><i></i><i></i><i></i></span><span>preview / <b class="pv-name">${esc(newest ? newest.slug : '')}.md</b></span><span class="hint">${esc(t('hint'))} <kbd>↵</kbd></span></div>
<div class="cv">${posts.map((p, i) => previewPanel(p, lang, i, i === 0)).join('\n')}</div>
</section>
</main>
<footer class="status"><span class="where"><span class="dot" aria-hidden="true"></span><b>${posts.length}</b>${zh ? '' : '&nbsp;'}${esc(t('posts'))}${newest ? ` · ${esc(t('newest'))} ${esc(fmtDate(newest.date, lang))}` : ''} · ${esc(t('langs'))}</span><span class="grow"></span><span class="right"><a href="/">${esc(t('portfolio'))}</a> · <a href="/#section/publications">${esc(t('pubs'))}</a> · <a href="/blog/${zh ? 'feed.zh.xml' : 'feed.xml'}">${IC.rss}${esc(t('rss'))}</a></span></footer>`;
  return {
    path: indexPath(lang), lang, kind: 'index',
    head: head({lang, path: indexPath(lang), titleText: NAME_PLAIN[lang], description: POSITIONING[lang], alternates, ogImage: `${SITE}/og/blog.png`, ogAlt: BLOG_CARD_ALT[lang]}),
    body,
  };
}

/* ---------------- article (direction E) ---------------- */
function citeData(post, v) {
  const url = SITE + postPath(post, v.lang), [y, m, d] = post.date.split('-');
  const key = `luo${y}${post.slug.split('-').find(w => w.length > 3) || post.slug.split('-')[0]}`;
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][+m - 1];
  const t = v.metaTitle || v.title, plainTitle = t.replace(/[’]/g, '\'');
  const bib = `@misc{${key},\n  author       = {Luo, Yaxin},\n  title        = {${plainTitle}},\n  year         = {${y}},\n  month        = ${mon},\n  howpublished = {\\url{${url}}},\n  note         = {Blog post}\n}`;
  const text = v.lang === 'zh'
    ? `罗亚鑫. ${t}[EB/OL]. Yaxin 的博客, ${post.date}. ${url}.`
    : `Luo, Yaxin. (${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]} ${y}). ${t}. Yaxin’s Blog. ${url}`;
  return {bib, text, d};
}

function endPanel(post, v, ctx) {
  const lang = v.lang, t = k => copy(lang, k);
  const cite = citeData(post, v);
  const bibHtml = esc(cite.bib).replace(/^(\s+)(\w+)(\s+=)/gm, '$1<span class="k">$2</span>$3');
  const left = [];
  if (post.cite) left.push(`<section class="end-sec" id="cite" aria-label="${esc(t('cite'))}"><h4 class="end-h">${esc(t('cite'))}</h4>
<div class="cite"><div class="code-bar"><span class="wdots" aria-hidden="true"><i></i><i></i><i></i></span><span role="tablist" aria-label="${esc(t('cite'))}" class="cite-tabs"><button class="cite-tab" role="tab" aria-selected="true" data-f="text">${esc(t('text'))}</button><button class="cite-tab" role="tab" aria-selected="false" data-f="bib">BibTeX</button></span><button class="code-copy" type="button" hidden>${IC.copy}<span>${esc(t('copy'))}</span></button></div>
<pre class="cite-text" data-f="text">${esc(cite.text)}</pre><pre class="cite-bib" data-f="bib" hidden>${bibHtml}</pre></div></section>`);
  if (v.updates.length) left.push(`<section class="end-sec" id="updates" aria-label="${esc(t('updates'))}"><h4 class="end-h">${esc(t('updates'))}</h4><ul class="history">${v.updates.map(u => `<li><span class="dt" aria-hidden="true"></span><time datetime="${u.date}">${u.date}</time><span>${esc(u.text)}</span></li>`).join('')}<li><span class="dt" aria-hidden="true"></span><time datetime="${post.date}">${post.date}</time><span>${esc(t('published'))}</span></li></ul></section>`);
  const right = [];
  const works = post.work.map(id => WORKS[id]).filter(Boolean);
  if (works.length) right.push(`<section class="end-sec" aria-label="${esc(t('related'))}"><h4 class="end-h">${esc(t('related'))}</h4><div class="works">${works.map(w => `<div class="wcard"><div class="m"><span>${esc(w.venue)} ${w.year}</span>${w.phase ? `<span class="chip">${PHASES[w.phase].n} ${esc(PHASES[w.phase][lang])}</span>` : ''}</div><h5><a href="${w.href}">${esc(w.title[lang] || w.title.en)}</a></h5><div class="f">${w.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}<a href="${w.href}">${esc(t('onMap'))} →</a></div></div>`).join('')}</div></section>`);
  const more = ctx.related;
  if (more.length) right.push(`<section class="end-sec" aria-label="${esc(post.phase ? `${t('moreIn')} ${PHASES[post.phase][lang]}` : t('moreOff'))}"><h4 class="end-h">${esc(post.phase ? `${t('moreIn')} ${PHASES[post.phase].n} ${PHASES[post.phase][lang]}` : t('moreOff'))}</h4><ul class="rel">${more.map(p => { const vl = versionFor(p, lang), pv = p.versions[vl]; return `<li><a href="${postPath(p, vl)}"><time>${p.date}</time><b lang="${vl === 'zh' ? 'zh-CN' : 'en'}">${title(pv.title, vl)}</b>${langBadge(p, lang)}</a></li>`; }).join('')}</ul></section>`);
  const card = (p, dir, right) => {
    if (!p) return `<a class="pcard${right ? ' right' : ''}" href="${indexPath(lang)}"><span class="m"><span class="dir">${right ? '' : '← '}${esc(t('allPosts'))}${right ? ' →' : ''}</span></span><h5>${esc(t('backIndex'))}</h5><p>${esc(t('everyPost'))}</p></a>`;
    const vl = versionFor(p, lang), pv = p.versions[vl];
    return `<a class="pcard${right ? ' right' : ''}" href="${postPath(p, vl)}"><span class="m"><span class="dir">${dir}</span><span>${p.date}</span></span><h5 lang="${vl === 'zh' ? 'zh-CN' : 'en'}">${title(pv.title, vl)}${langBadge(p, lang)}</h5><p>${esc(pv.summary)}</p></a>`;
  };
  return `<div class="end-panel${left.length && right.length ? '' : ' one'}"><div class="end-col">${left.join('')}</div>${right.length ? `<div class="end-col">${right.join('')}</div>` : ''}</div>
<nav class="pn-grid" aria-label="${esc(t('allPosts'))}">${card(ctx.newer, `← ${esc(t('newer'))}`)}${card(ctx.older, `${esc(t('older'))} →`, true)}</nav>
<p class="end-foot"><a href="/blog/${lang === 'zh' ? 'feed.zh.xml' : 'feed.xml'}">${IC.rss}${esc(t('subscribe'))}</a><span>·</span><span>${esc(CREDIT[lang])}</span></p>`;
}

/** One language version of a post, as a full page. `ctx` = {newer, older, related, dev}. */
export function renderArticle(post, lang, ctx) {
  const v = post.versions[lang], t = k => copy(lang, k), zh = lang === 'zh', r = v.render;
  const path = postPath(post, lang), other = zh ? 'en' : 'zh';
  const alternates = Object.fromEntries(post.langs.map(l => [l, postPath(post, l)]));
  const ph = phaseLabel(post.phase, lang);
  const h2s = r.sections.filter(s => s.level === 2);
  const seg = `<span class="seg" role="group" aria-label="${esc(t('lang'))}">${['en', 'zh'].map(l => l === lang
    ? `<span class="on${l === 'zh' ? ' zh' : ''}" aria-current="true">${l === 'en' ? 'EN' : '中'}</span>`
    : post.versions[l] ? `<a class="${l === 'zh' ? 'zh' : ''}" href="${postPath(post, l)}?lang=${l}" data-lang-switch="${l}" hreflang="${l === 'zh' ? 'zh-CN' : 'en'}" lang="${l === 'zh' ? 'zh-CN' : 'en'}">${l === 'en' ? 'EN' : '中'}</a>`
      : `<span class="na${l === 'zh' ? ' zh' : ''}" title="${esc(t(l === 'zh' ? 'noZh' : 'noEn'))}">${l === 'en' ? 'EN' : '中'}</span>`).join('')}</span>`;
  const updated = post.updated && post.updated > post.date;
  const insp = `<div class="insp" role="group" aria-label="${esc(typeName(post, lang))}">
<span>${IC.cv}<span class="v">${esc(typeName(post, lang))}</span></span>${seg}
<span><time class="v" datetime="${post.date}">${post.date}</time></span>
<span>${IC.clock}<span class="v">${v.minutes}</span><span class="k">${esc(t('minRead'))}</span></span>
${updated ? `<a href="#updates" title="${esc(v.updates.map(u => `${u.date} ${u.text}`).join(' · '))}"><span class="k">${esc(t('updated'))}</span><span class="v">${post.updated.slice(5)}</span><span class="uhist" aria-hidden="true"><i></i><b></b><i class="now"></i></span></a>` : ''}
${post.phase ? `<a class="phase" href="/#section/research" title="${esc(t('phaseLink'))}">${IC.map}<span class="pn">${ph.n}</span>${esc(ph[lang])}</a>` : `<span class="phase off">${IC.map}${esc(ph[lang])}</span>`}</div>`;
  const notices = [
    updated ? `<p class="banner upd">${IC.note}<span>${esc(t('updatedBanner'))} ${post.updated}${v.updates[0] ? ` · ${esc(v.updates[0].text)}` : ''}</span><a href="#updates">${esc(t('seeUpdates'))} ↓</a></p>` : '',
    post.placeholder ? `<p class="banner ph">${IC.note}<span>${esc(t('placeholderNote'))}</span></p>` : '',
    v.draft ? `<p class="banner ph">${IC.note}<span>${esc(t('draftNote'))}</span></p>` : '',
  ].join('');
  const toc = r.sections.map((s, i) => `<li class="${s.level === 3 ? 'h3' : 'h2'}" data-id="${esc(s.id)}"><a href="#${esc(s.id)}"><span class="n">${s.n}</span><span>${esc(s.title)}</span></a>${s.kids.length ? `<ol class="kids">${s.kids.map(k => `<li><a href="#${esc(k.id)}">${KID_ICON[k.kind]}<span>${esc(k.label)}</span></a></li>`).join('')}</ol>` : ''}</li>`).join('');
  const file = `${post.slug}.${lang}.md`;
  const body = `${rulers()}
${topbar(lang, {crumbs: [[post.slug, path]], alt: alternates[other]})}
<a class="skip sr" href="#post-body">${esc(t('skip'))}</a>
<main class="stage" id="main">
<div class="rail-col"><nav class="rail" id="rail" aria-label="${esc(t('layers'))}">
<div class="rail-head"><span>${esc(t('layers'))}</span><span>${h2s.length} ${esc(t('sections'))}</span></div>
<a class="rail-frame on" href="#top">${IC.frame}<span>${esc(post.slug)}</span></a>
<div class="toc-wrap"><ol class="toc">${toc}</ol></div>
<div class="rail-prog"><b class="pct">0%</b><span class="track"><i></i></span><span class="left" data-min="${v.minutes}">${zh ? `还剩 ${v.minutes} 分钟` : `${v.minutes} ${esc(t('left'))}`}</span></div>
<div class="rail-foot"><a href="${indexPath(lang)}">${IC.back}<span>${esc(t('allPosts'))}</span></a>${post.cite ? `<a href="#cite">${IC.quote}<span>${esc(t('cite'))}</span></a>` : ''}</div>
</nav></div>
<div class="board-col">
<div class="frame-label">${IC.frame}<b>${esc(file)}</b><span class="sz"></span></div>
<article class="board" id="top" lang="${zh ? 'zh-CN' : 'en'}">
<header class="head">${insp}
<div class="ttl">${sel(`<h1 class="h1">${title(v.title, lang)}</h1>`, 'H1')}${cursor('d', 'Designer')}</div>
<p class="dek">${esc(v.summary)}</p>
${notices}
<div class="byline"><span class="av" aria-hidden="true">YL</span><b>${esc(t('by'))}</b><span class="sep" aria-hidden="true"></span><span>${esc(t('place'))}</span><span class="tags">${post.tags.map(k => `<a class="tag" href="${indexPath(lang)}?tag=${k}">${esc(TAGS[k][lang])}</a>`).join('')}</span></div>
</header>
<div class="post-body prose" id="post-body">
${r.html}</div>
<footer class="post-end" id="post-end">${endPanel(post, v, ctx)}</footer>
</article></div>
</main>
<footer class="status"><span class="where"><span class="dot" aria-hidden="true"></span><span class="sec"><span class="n">00</span> <b>${esc(t('intro'))}</b></span></span><span class="msg" role="status" aria-live="polite"></span><span class="right"><button type="button" class="toc-btn" aria-expanded="false" aria-controls="rail">${IC.list}<span>${esc(t('contents'))}</span></button><a href="#top" class="to-top"><span aria-hidden="true">↑</span><span>${esc(t('top'))}</span></a></span></footer>
<div class="viewer" role="dialog" aria-modal="true" aria-label="${zh ? '图片查看器' : 'Figure viewer'}" hidden><div class="vbar"><span class="t"></span><span class="sep"></span><button type="button" data-v="out" aria-label="Zoom out">−</button><span class="pct">100%</span><button type="button" data-v="in" aria-label="Zoom in">+</button><span class="sep"></span><button type="button" data-v="fit">${zh ? '适合' : 'Fit'}</button><button type="button" data-v="100">100%</button><span class="sep"></span><button type="button" data-v="close" aria-label="Close">Esc ✕</button></div><div class="vstage"><div class="vart"></div></div><p class="vcap"></p></div>`;
  const ogImage = ctx.og?.[lang] || `${SITE}/og/blog.png`;
  const ld = {'@context': 'https://schema.org', '@type': 'BlogPosting', headline: v.metaTitle || v.title, description: v.metaSummary || v.summary, datePublished: post.date, dateModified: post.updated || post.date,
    inLanguage: zh ? 'zh-CN' : 'en', url: SITE + path, image: ogImage, author: {'@type': 'Person', name: 'Yaxin Luo', url: `${SITE}/`}};
  const extra = `<meta property="article:published_time" content="${post.date}">
${post.updated ? `<meta property="article:modified_time" content="${post.updated}">\n` : ''}<meta name="citation_title" content="${esc(v.metaTitle || v.title)}">
<meta name="citation_author" content="Luo, Yaxin">
<meta name="citation_publication_date" content="${post.date.replace(/-/g, '/')}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
`;
  return {
    path, lang, kind: 'post', slug: post.slug,
    head: head({lang, path, titleText: `${v.metaTitle || v.title} — ${NAME_PLAIN[lang]}`, description: v.metaSummary || v.summary, alternates, ogImage, type: 'article', noindex: post.placeholder || v.draft, extra, math: r.math,
      ogAlt: zh ? `分享卡片：${v.metaTitle || v.title}。${v.metaSummary || v.summary}` : `Share card: ${v.metaTitle || v.title}. ${v.metaSummary || v.summary}`}),
    body,
  };
}

/** Wrap a rendered page: the Vite shell provides the asset tags, the template provides the rest. */
export function pageHtml(page, {assets = '', fonts = ''} = {}) {
  return `<!doctype html>
<html lang="${page.lang === 'zh' ? 'zh-CN' : 'en'}" class="${page.kind === 'index' ? 'page-index' : 'page-post'}">
<head>
${page.head.replace('<!--blog:fonts-->', fonts)}
${assets}
</head>
<body>
<div class="canvas-dots" aria-hidden="true"></div>
${page.body}
</body>
</html>
`;
}
