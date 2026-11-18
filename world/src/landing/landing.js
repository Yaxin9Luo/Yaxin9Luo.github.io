// The painter's board: the one-screen home that sits above the (lazy) 3D academy.
// Facts come from content.js; this module owns the page's HTML (top bar, hero, the study sheet with the research map,
// status line) and its plain behaviour. Where the browser can draw HTML into a canvas, ./board/ takes the same
// elements and paints them (oil-paint name, pigment in water, layers); everywhere else this HTML is the page.
import {profile, links, publications, cvForLanguage} from '../content.js';
import {ec, cursorArrow} from './icons.js';
import {notesFor, notesHref} from '../blog/work-links.js';
import {notesHTML} from '../board/notes.js';

export const MUSEUM_URL = lang => `/yuanmingyuan.html?composition=xianfaqiao&planting=western&court=garden-r4&yangquelong=refined-r1&lang=${lang}`;


export const landingCopy = {
  en: {
    nav: {about: 'About Me', research: 'Research', publications: 'Publications', projects: 'Projects', blog: 'Blog', cv: 'CV'}, heroName: 'Yaxin Luo',
    explode: 'explode layers', collapse: 'collapse layers', hold: 'hold space', layersTip: 'layers · Space', enterKey: 'Space', enterHold: 'hold', enterOr: 'or click', enterDo: 'to enter the page', layersHint: 'hold Space to see the layers', scrape: 'scrape the board clean', scrapeTitle: 'Scrape the paint off the board', save: 'save this board', saveTitle: 'Download this board as a PNG', themeToggle: 'Switch theme', langSwitch: 'Language',
    role: '<span>ML PhD · MBZUAI VILA Lab</span>&nbsp; /&nbsp; <span>Research Intern · Meituan LongCat</span>',
    chipA: 'Post-training & RL', chipB: 'Long-horizon agents',
    email: 'Email', cv: 'CV', tour: 'CV Tour',
    mapTitle: 'one question · three phases', mapHint: 'hover a node', lgPaper: 'paper / project', lgLoop: 'model ⟲ harness loop', lgAll: 'all publications →',
    now: 'Now', nowT: 'research intern at Meituan M17 LongCat · open to research collaboration',
    explore: 'Explore', academy: '3D Academy', games: 'Games', ymy: 'Yuanmingyuan',
    paper: 'paper', code: 'code', open: 'details', map: 'Research map', name: 'Yaxin Luo',
  },
  zh: {
    nav: {about: '关于我', research: '研究方向', publications: '学术论文', projects: '研究作品', blog: '博客', cv: '简历'}, heroName: '罗亚鑫',
    explode: '拆解图层', collapse: '合上图层', hold: '按住空格', layersTip: '图层 · 空格', enterKey: '空格', enterHold: '按住', enterOr: '或点击', enterDo: '进入页面', layersHint: '按住空格，查看图层', scrape: '刮净画板', scrapeTitle: '把画板上的颜料刮干净', save: '保存这块画板', saveTitle: '把这块画板下载为 PNG', themeToggle: '切换主题', langSwitch: '语言',
    role: '<span>ML 博士生 · MBZUAI VILA Lab</span>&nbsp; /&nbsp; <span>研究实习生 · 美团 LongCat</span>',
    chipA: '后训练与强化学习', chipB: '长程智能体',
    email: '邮件', cv: '简历', tour: 'CV 导览',
    mapTitle: '一个问题 · 三个阶段', mapHint: '悬停节点', lgPaper: '论文 / 项目', lgLoop: '模型 ⟲ harness 循环', lgAll: '全部论文 →',
    now: '现在', nowT: '美团 M17 LongCat 研究实习 · 欢迎研究合作',
    explore: '探索', academy: '3D 学院', games: '游戏作品集', ymy: '圆明园',
    paper: '论文', code: '代码', open: '详情', map: '研究地图', name: 'Yaxin Luo',
  },
};

export const mapPhases = {
  en: [['01', '2024–25', 'Multimodal', 'efficient, grounded', 'multimodal models'], ['02', '2025 → present', 'Eval', 'measuring agents on', 'long-horizon agentic tasks'], ['03', '2026 → present', 'Post-training', 'co-evolution of model', 'parameters and harnesses']],
  zh: [['01', '2024–25', '多模态', '高效、可定位的', '多模态模型'], ['02', '2025 → 至今', '评测', '衡量智能体在', '长程智能体任务上的能力'], ['03', '2026 → 至今', '后训练', '模型参数与 harness', '的协同进化']],
};

/* Research map nodes: same order and credits as the GitHub profile map. `pub` links into content.js. */
export const mapNodes = [
  {id: 'apl', pub: 'apl', name: 'APL', venue: 'ECCV 24', col: 0, fx: .22, fy: .84, lab: 'br', role: ['first author', '第一作者'], full: ['ECCV 2024', 'ECCV 2024'],
    q: ['Can a one-stage grounder learn where a phrase points, without any box labels?', '单阶段定位模型能否在没有框标注的情况下，学会一句话指向哪里？'], dg: 'apl'},
  {id: 'gmod', pub: 'gamma-mod', name: 'γ-MoD', venue: 'ICLR 25', col: 0, fx: .56, fy: .2, lab: 'above', role: ['first author', '第一作者'], full: ['ICLR 2025', 'ICLR 2025'],
    q: ['Which layers can a multimodal LLM skip for most tokens, without losing accuracy?', '多模态大模型的哪些层，可以让大多数 token 直接跳过而不掉点？'], dg: 'gmod'},
  {id: 'dvin', pub: 'dvin', name: 'DViN', venue: 'CVPR 25', col: 0, fx: .82, fy: .64, lab: 'bl', role: ['co-author', '合作者'], full: ['CVPR 2025', 'CVPR 2025'],
    q: ['Can visual features be routed per expression, so each phrase sees what it needs?', '能否按每条指代表达动态路由视觉特征，让每句话只看它需要的部分？'], dg: 'dvin'},
  {id: 'ocw', pub: 'opencaptchaworld', name: 'Open CaptchaWorld', venue: 'NeurIPS 25', col: 1, fx: .16, fy: .88, lab: 'br', role: ['first author', '第一作者'], full: ['NeurIPS 2025', 'NeurIPS 2025'],
    q: ['Can multimodal agents solve the interactive puzzles humans clear in seconds?', '多模态智能体能否解开人类几秒钟就能完成的交互式验证码？'], dg: 'ocw'},
  {id: 'fig', project: 'figmirror', name: 'FigMirror', venue: ['open source', '开源'], col: 1, fx: .4, fy: .58, lab: 'br', role: ['contributor', '贡献者'], full: ['open source', '开源项目'],
    q: ['Can an agent redraw your data in a paper\'s figure style, as editable Matplotlib?', '智能体能否按论文的图表风格，把你的数据画成可编辑的 Matplotlib？'], dg: 'fig',
    links: [['code', 'https://github.com/VILA-Lab/FigMirror']]},
  {id: 'ngc', pub: 'nextgen-captchas', name: 'Next-Gen CAPTCHAs', venue: 'ICML 26', col: 1, fx: .58, fy: .2, lab: 'above', role: ['co-first author', '共同第一作者'], full: ['ICML 2026', 'ICML 2026'],
    q: ['Can the cognitive gap between humans and GUI agents become a scalable defense?', '人与 GUI 智能体之间的认知差距，能否变成可扩展的防御？'], dg: 'ngc'},
  {id: 'ad', pub: 'autodesign', name: 'AutoDesign', venue: 'arXiv 26', col: 2, fx: .2, fy: .86, lab: 'br', role: ['first author', '第一作者'], full: ['arXiv 2026', 'arXiv 2026'],
    q: ['Can the model and its harness improve each other on long design tasks?', '在长程设计任务上，模型和它的 harness 能否互相改进？'], dg: 'ad'},
  {id: 'lc', work: 'longcat-2.5', name: 'LongCat-2.5', venue: ['1.6T · Meituan', '1.6T · 美团'], col: 2, fx: .6, fy: .38, lab: 'loop', green: 1, role: ['post-training contributor', '后训练贡献者'], full: ['Meituan M17', '美团 M17'],
    q: ['How do we post-train a 1.6T model, and the harness around it, for long-horizon agentic design?', '如何为长程 agentic design 后训练一个 1.6T 参数的模型，以及它周围的 harness？'], dg: 'lc'},
];

/* Mini diagrams inside the hover card (viewBox 280×80). Labels never sit on top of shapes. */
const DG = {
  apl: `<rect class="as" x="14" y="14" width="112" height="52" rx="5"/>${[0, 1, 2, 3, 4].map(i => [0, 1].map(j => `<circle class="m" cx="${32 + i * 19}" cy="${30 + j * 20}" r="3.5"/>`).join('')).join('')}<rect class="cs" x="62" y="20" width="26" height="22" rx="3"/><circle class="af" cx="75" cy="30" r="4.5"/><path class="a" d="M136 40h26"/><path class="af" d="M162 36l7 4-7 4z"/><text x="178" y="36" class="k">“the red cup”</text><text x="178" y="52">no box labels</text>`,
  gmod: `${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect class="${[1, 3, 4, 6].includes(i) ? 'ms' : 'as'}" x="${14 + i * 30}" y="22" width="22" height="40" rx="4"/>`).join('')}<path class="cs" d="M8 70 C30 70 30 42 36 42 S58 70 70 70 S90 42 96 42 S150 70 160 70 S186 42 192 42 S214 70 220 70"/><text x="232" y="38" class="k">skip</text><text x="232" y="54">dashed</text><text x="14" y="15">layers →</text>`,
  dvin: `<rect class="as" x="12" y="27" width="52" height="26" rx="5"/><text x="38" y="44" text-anchor="middle" class="k">image</text><path class="a" d="M64 40h24"/><circle class="af" cx="96" cy="40" r="7"/>${[15, 40, 65].map((y, i) => `<path class="${i === 1 ? 'a' : 'ms'}" d="M103 40 L142 ${y}"/><rect class="${i === 1 ? 'g' : 'ms'}" x="142" y="${y - 8}" width="40" height="16" rx="4"/>`).join('')}<text x="194" y="44" class="k">phrase-fit</text><text x="194" y="58">routing</text>`,
  ocw: `${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="${i === 5 ? 'g' : 'as'}" x="${14 + (i % 4) * 28}" y="${12 + Math.floor(i / 4) * 30}" width="22" height="24" rx="4"/>`).join('')}<path class="c" d="M128 44 l0 16 l4.5 -4.5 l3.4 7 l3 -1.5 l-3.3 -6.8 l6.4 -.6z"/><text x="164" y="30" class="k">20 types</text><text x="164" y="46" class="k">225 tasks</text><text x="164" y="62">interactive web</text>`,
  ngc: `<text x="14" y="30" class="k">human</text><rect class="g" x="66" y="20" width="190" height="14" rx="4"/><text x="14" y="58" class="k">agent</text><rect class="as" x="66" y="48" width="46" height="14" rx="4"/><path class="cs" d="M120 55 h134" stroke-dasharray="3 4"/><text x="150" y="76">cognitive gap</text>`,
  fig: `<rect class="as" x="14" y="10" width="62" height="52" rx="5"/><path class="a" d="M22 54 L36 38 L50 44 L68 22"/><text x="45" y="75" text-anchor="middle">reference</text><path class="a" d="M86 36h34"/><path class="af" d="M120 32l7 4-7 4z"/><rect class="g" x="138" y="10" width="62" height="52" rx="5"/><path class="gs" d="M146 54 L160 34 L174 42 L192 24"/><text x="169" y="75" text-anchor="middle">your data</text><text x="212" y="32" class="k">.py</text><text x="212" y="48">editable</text>`,
  ad: `<circle class="as" cx="46" cy="38" r="27"/><circle class="g" cx="128" cy="38" r="31"/><text x="46" y="42" text-anchor="middle" class="k">model</text><text x="128" y="42" text-anchor="middle" class="k">harness</text><path class="a" d="M72 28 Q87 18 99 26"/><path class="af" d="M97 21l6 6-8 2z"/><path class="gs" d="M99 52 Q87 60 74 50"/><circle class="c" cx="78" cy="73" r="4"/><text x="87" y="77">critic</text><text x="176" y="26" class="k">posters · slides</text><text x="176" y="42" class="k">web · video</text><text x="176" y="58">editable</text>`,
  lc: `${[['harness', 56], ['traj.', 42], ['Mid-T', 42], ['SFT', 42], ['RL', 42]].map(([t, w], i, a) => { const x = 8 + a.slice(0, i).reduce((n, [, v]) => n + v + 8, 0); return `<rect class="${i < 2 ? 'g' : 'as'}" x="${x}" y="16" width="${w}" height="28" rx="6"/><text x="${x + w / 2}" y="34" text-anchor="middle" class="k">${t}</text>${i < 4 ? `<path class="a" d="M${x + w} 30h8"/>` : ''}`; }).join('')}<text x="8" y="66">1.6T params · long-horizon agentic design</text>`,
};

const esc = v => String(v).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const pick = (v, lang) => Array.isArray(v) ? v[lang === 'zh' ? 1 : 0] : v && typeof v === 'object' ? v[lang] : v;

/** Split the positioning line at its dash, so the claim reads bold and the rest muted. */
export function splitClaim(text) {
  const m = String(text).match(/^(.*?—+)\s*(.*)$/);
  return m ? [m[1], m[2]] : [String(text), ''];
}

function strings(lang) {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'], [claimA, claimB] = splitClaim(profile.positioning[lang]);
  return {...t, claimA: esc(claimA), claimB: esc(claimB), bio: esc(profile.intro[lang])};
}

const EXT = 'target="_blank" rel="noopener noreferrer"';
const dabs = '<span class="wdots" aria-hidden="true"><i></i><i></i><i></i></span>';
// The mark at the top left: a peony crest, a roundel in the manner of a family crest (a ring, three tiers of broad
// notched petals: eight, eight and five, and a seed pod with its stamens), printed in one colour with a worn edge.
// The paths come from a small generator (petals as curves in polar form); this is its output.
const CREST = `<svg class="crest" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="crest-wear"><circle cx="50" cy="50" r="50" fill="#fff"/><g fill="#000"><circle cx="3.4" cy="38" r="2.6"/><circle cx="96.4" cy="63" r="3"/><circle cx="66" cy="97.6" r="2.3"/><circle cx="27" cy="5.6" r="2"/><circle cx="88.6" cy="17.4" r="2.5"/><circle cx="12.4" cy="85" r="2"/></g><g fill="#000" opacity=".16"><ellipse cx="70" cy="30" rx="17" ry="11"/><ellipse cx="27" cy="67" rx="14" ry="17"/><ellipse cx="60" cy="80" rx="18" ry="7"/></g></mask></defs><g mask="url(#crest-wear)"><circle cx="50" cy="50" r="48" fill="currentColor"/><circle cx="50" cy="50" r="43.2" fill="none" stroke="#FFF9EE" stroke-width="1.5"/><path d="M50.00 35.00 Q40.30 30.87 38.76 21.47 Q40.83 11.29 50.00 18.25 Q59.17 11.29 61.24 21.47 Q59.70 30.87 50.00 35.00Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M60.61 39.39 Q56.67 29.61 62.23 21.88 Q70.89 16.14 72.45 27.55 Q83.86 29.11 78.12 37.77 Q70.39 43.33 60.61 39.39Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M65.00 50.00 Q69.13 40.30 78.53 38.76 Q88.71 40.83 81.75 50.00 Q88.71 59.17 78.53 61.24 Q69.13 59.70 65.00 50.00Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M60.61 60.61 Q70.39 56.67 78.12 62.23 Q83.86 70.89 72.45 72.45 Q70.89 83.86 62.23 78.12 Q56.67 70.39 60.61 60.61Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M50.00 65.00 Q59.70 69.13 61.24 78.53 Q59.17 88.71 50.00 81.75 Q40.83 88.71 38.76 78.53 Q40.30 69.13 50.00 65.00Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M39.39 60.61 Q43.33 70.39 37.77 78.12 Q29.11 83.86 27.55 72.45 Q16.14 70.89 21.88 62.23 Q29.61 56.67 39.39 60.61Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M35.00 50.00 Q30.87 59.70 21.47 61.24 Q11.29 59.17 18.25 50.00 Q11.29 40.83 21.47 38.76 Q30.87 40.30 35.00 50.00Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M39.39 39.39 Q29.61 43.33 21.88 37.77 Q16.14 29.11 27.55 27.55 Q29.11 16.14 37.77 21.88 Q43.33 29.61 39.39 39.39Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M53.44 41.69 Q48.46 35.98 49.81 28.16 Q54.06 21.95 58.76 28.86 Q66.96 27.30 65.58 34.69 Q61.00 41.17 53.44 41.69Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M58.31 46.56 Q59.05 38.72 66.01 33.70 Q73.75 32.26 72.11 40.84 Q79.34 45.75 72.85 50.20 Q64.37 51.57 58.31 46.56Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M58.31 53.44 Q64.02 48.46 71.84 49.81 Q78.05 54.06 71.14 58.76 Q72.70 66.96 65.31 65.58 Q58.83 61.00 58.31 53.44Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M53.44 58.31 Q61.28 59.05 66.30 66.01 Q67.74 73.75 59.16 72.11 Q54.25 79.34 49.80 72.85 Q48.43 64.37 53.44 58.31Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M46.56 58.31 Q51.54 64.02 50.19 71.84 Q45.94 78.05 41.24 71.14 Q33.04 72.70 34.42 65.31 Q39.00 58.83 46.56 58.31Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M41.69 53.44 Q40.95 61.28 33.99 66.30 Q26.25 67.74 27.89 59.16 Q20.66 54.25 27.15 49.80 Q35.63 48.43 41.69 53.44Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M41.69 46.56 Q35.98 51.54 28.16 50.19 Q21.95 45.94 28.86 41.24 Q27.30 33.04 34.69 34.42 Q41.17 39.00 41.69 46.56Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M46.56 41.69 Q38.72 40.95 33.70 33.99 Q32.26 26.25 40.84 27.89 Q45.75 20.66 50.20 27.15 Q51.57 35.63 46.56 41.69Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M50.56 46.04 Q46.04 43.34 44.58 37.24 Q46.50 32.36 52.07 35.29 Q58.23 34.01 58.72 39.23 Q55.64 44.69 50.56 46.04Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M53.94 49.31 Q55.11 44.17 60.46 40.91 Q65.70 41.22 64.62 47.42 Q67.75 52.88 62.94 54.97 Q56.79 53.73 53.94 49.31Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M51.88 53.53 Q57.12 53.06 61.88 57.14 Q63.20 62.22 56.97 63.11 Q52.75 67.77 49.27 63.84 Q48.55 57.61 51.88 53.53Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M47.22 52.88 Q49.29 57.72 46.88 63.50 Q42.46 66.33 39.68 60.68 Q33.94 58.10 36.61 53.59 Q42.31 50.98 47.22 52.88Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M46.40 48.25 Q42.44 51.71 36.19 51.21 Q32.14 47.88 36.65 43.49 Q37.33 37.23 42.45 38.38 Q46.69 42.99 46.40 48.25Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="50" cy="50" r="5.6" fill="#FFF9EE" stroke="currentColor" stroke-width="1.7"/><circle cx="50.00" cy="47.10" r="0.95" fill="currentColor"/><circle cx="52.51" cy="48.55" r="0.95" fill="currentColor"/><circle cx="52.51" cy="51.45" r="0.95" fill="currentColor"/><circle cx="50.00" cy="52.90" r="0.95" fill="currentColor"/><circle cx="47.49" cy="51.45" r="0.95" fill="currentColor"/><circle cx="47.49" cy="48.55" r="0.95" fill="currentColor"/><circle cx="50.00" cy="50.00" r="1" fill="currentColor"/></g></svg>`;
const themeIcon = () => typeof document !== 'undefined' && (document.documentElement?.dataset?.theme || (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? ec.sun : ec.moon;

/* The page, piece by piece. The board (./board/scene.js) lays the same pieces out on its sheets. */
function top(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'], section = id => `<a href="#section/${id}" data-action="section" data-id="${id}">${t.nav[id]}</a>`;
  return `<header class="top">
    <a class="brand" href="#" data-action="home" aria-label="${esc(t.name)}">${CREST}<span class="crumb">yaxin-luo <i>/</i> <b>home</b></span></a>
    <nav class="nav" aria-label="${esc(t.map)}">${['about', 'research', 'publications', 'projects'].map(section).join('')}<a href="/blog/${lang === 'zh' ? '?lang=zh' : ''}">${t.nav.blog}</a><a href="${cvForLanguage(lang)}" ${EXT}>${t.nav.cv}</a></nav>
    <div class="tools">
      <span class="lang" role="group" aria-label="${t.langSwitch}"><button type="button" data-action="language" aria-pressed="${lang !== 'zh'}" lang="en">EN</button><button type="button" data-action="language" aria-pressed="${lang === 'zh'}" lang="zh-CN">中</button></span>
      <button type="button" class="theme-button" data-action="theme" aria-label="${t.themeToggle}">${themeIcon()}</button>
      <button type="button" class="tour-chip" data-action="mascot-toggle" aria-controls="mascot-guide">${t.tour}</button>
      <span class="explore" role="group" aria-label="${esc(t.explore)}"><a href="#" data-action="start">${ec.cube}<span>${t.academy}</span></a><a href="#section/games" data-action="games">${ec.game}<span>${t.games}</span></a><a data-museum-entry href="${MUSEUM_URL(lang)}">${ec.pavilion}<span>${t.ymy}</span></a></span>
    </div>
  </header>`;
}
function hero(lang = 'en') {
  const t = strings(lang), zh = lang === 'zh';
  return `<section class="hero">
    <div class="namerow"><h1 class="name"${zh ? ' lang="zh-CN"' : ''}>${t.heroName}</h1></div>
    <div class="role">${t.role}</div>
    <p class="claim"><b>${t.claimA}</b> <span>${t.claimB}</span></p>
    <div class="chips"><span class="chip">${esc(t.chipA)}</span><span class="chip g">${esc(t.chipB)}</span></div>
    <p class="bio">${t.bio}</p>
    <div class="cta">
      <a class="btn p" href="${links.email}">${ec.mail}<span>${t.email}</span></a>
      <a class="btn" href="${links.scholar}" ${EXT}>${ec.scholar}<span>Scholar</span><span class="ar">↗</span></a>
      <a class="btn" href="${cvForLanguage(lang)}" ${EXT}>${ec.cv}<span>${t.cv}</span><span class="ar">↗</span></a>
      <a class="btn" href="${links.github}" ${EXT}>${ec.gh}<span>GitHub</span><span class="ar">↗</span></a>
    </div>
  </section>`;
}
function mapWindow(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<section class="mapwin" aria-label="${esc(t.map)}">
    <div class="bar"><span><span class="crumb">research-map / </span><b>${t.mapTitle}</b></span><span class="hint">${t.mapHint}</span></div>
    <div class="cv"><div class="mapbox"></div>
      <div class="legend"><span><i></i>${t.lgPaper}</span><span><i class="l"></i>${t.lgLoop}</span><a href="#section/publications" data-action="section" data-id="publications">${t.lgAll}</a></div>
    </div>
  </section>`;
}
/* The status line: only the Now line (and the 3D loading status for screen readers). */
function status(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<footer class="intro-footer status"><span class="now"><span class="dot" aria-hidden="true"></span><b>${t.now}</b> · ${t.nowT}</span><span id="load-status" class="ec-sr" aria-live="polite"></span></footer>`;
}
const blank = '<div></div>';
/* Four sheets, bottom to top in space: ground (status line), text (top bar and hero), the study sheet, annotations.
   Each fills the window and is empty where another sheet has its content, so the plain page composes exactly. */
const sheetHTML = {
  text: lang => top(lang) + `<main class="main">${hero(lang)}${blank}</main>` + blank,
  map: lang => blank + `<div class="main">${blank}${mapWindow(lang)}</div>` + blank,
  ground: lang => blank + blank + status(lang),
};

/** Static landing markup. Root keeps the `.welcome` class: Interface hides it while the 3D world plays. */
/** The pill at the foot of the opening stack ("hold Space · or click · to enter the page"), and what it says after. */
export function enterHintHTML(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<button class="enter-hint" type="button" tabindex="-1"><span class="eh-enter"><span>${esc(t.enterHold)}</span><kbd><i aria-hidden="true"></i>${esc(t.enterKey)}</kbd><b aria-hidden="true">·</b><span>${esc(t.enterOr)}</span><b aria-hidden="true">·</b><span>${esc(t.enterDo)}</span></span><span class="eh-layers"><kbd><i aria-hidden="true"></i>${esc(t.enterKey)}</kbd><span>${esc(t.layersHint)}</span></span></button>`;
}
/**
 * Whether the board opens as its exploded stack of sheets. Not when the effect is off, motion is reduced, the
 * address opens a panel, or the visitor comes back to a page they have already entered (history back / forward).
 */
export function opensExploded({effects = true, reducedMotion = false, hash = '', reading = false, navigation = 'navigate', entered = false} = {}) {
  if (!effects || reducedMotion || reading) return false;
  if (hash.replace(/^#/, '').split(/[&,]/).some(part => part && !/^(stats|still)$/.test(part))) return false;
  return !(navigation === 'back_forward' && entered);
}
export function renderLanding(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<section class="welcome landing board" aria-label="${esc(t.name)}"><div id="stage">
    <div class="layer page" id="text">${sheetHTML.text(lang)}</div>
    <div class="layer page" id="mapl">${sheetHTML.map(lang)}</div>
    <div class="layer page" id="ground">${sheetHTML.ground(lang)}</div>
    ${notesHTML}
  </div>
  <div class="pveil"></div>
  <button class="xbtn" type="button" aria-pressed="false" data-tip="${esc(t.layersTip)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5"/></svg><span>${t.explode}</span><kbd>${t.hold}</kbd></button>
  <button class="xbtn save" type="button" title="${esc(t.saveTitle)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg><span>${t.save}</span></button>
  <button class="xbtn scrape" type="button" title="${esc(t.scrapeTitle)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5 9 15M9 15l2.2 2.2M9 15l-1.8-1.8M7.2 13.2 15.6 4.8c1.5-1.5 4.1.6 3 2.6-1.6 3-4.4 6.2-7.4 9.8"/></svg><span>${t.scrape}</span></button>
  ${enterHintHTML(lang)}
  <div class="tags" aria-hidden="true"><div><b>01</b>ground</div><div><b>02</b>text</div><div><b>03</b>research-map</div><div><b>04</b>annotations</div><div><b>05</b><span>sheet</span></div></div>
  </section>`;
}

/**
 * The three places to explore, as dashed capsules for the top bar: the 3D academy (lazy world),
 * the Games sheet, and the Yuanmingyuan museum (a separate page). Labels use the Interface copy keys
 * (academy / games / garden), so the Interface's language switch keeps them current.
 */
export function renderExplore(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<span class="ec-explore" role="group" aria-label="${esc(t.explore)}">`
    + `<button class="ec-cap academy-button" id="explore-button" data-action="start">${ec.cube}<span data-i18n="academy">${t.academy}</span></button>`
    + `<button class="ec-cap" data-action="games">${ec.game}<span data-i18n="games">${t.games}</span></button>`
    + `<a class="ec-cap" data-museum-entry href="${MUSEUM_URL(lang)}">${ec.pavilion}<span data-i18n="garden">${t.ymy}</span></a>`
    + `</span>`;
}

function catmull(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, k = 1 / 6;
    d += ` C ${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)}, ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Below this map width the three columns no longer hold their words (the widest line clears its column by 8px at 546): the map switches to its compact layout. */
export const COMPACT_MAP = 546;
/** Below this width the hero and the map stack in one column; it matches the stacked block in landing.css. */
const STACKED = '(max-width: 900px)';

/**
 * Research map SVG for a box of W×H px. Pure: returns markup and the scale factor. Under COMPACT_MAP it returns
 * the compact layout instead, which sets its own height (`h`).
 */
export function mapSVG(W, H, lang = 'en', {motion = true} = {}) {
  if (W < COMPACT_MAP) return compactMapSVG(W, lang, {motion});
  const zh = lang === 'zh';
  const gap = 12, colW = (W - gap * 2) / 3, mk = Math.max(.82, Math.min(1.12, colW / 230, H / 560));
  const head = 128 * mk, bottom = 64 * mk;
  const cx = (c, f) => c * (colW + gap) + colW * f, cy = f => head + (H - head - bottom) * f;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${zh ? '研究地图：多模态、评测、后训练' : 'Research map: Multimodal, Eval, Post-training'}">`;
  mapPhases[zh ? 'zh' : 'en'].forEach((p, i) => {
    const x = i * (colW + gap), ix = x + 18 * mk;
    s += `<rect class="phase" x="${x + .5}" y=".5" width="${colW - 1}" height="${H - 1}" rx="13"/>`;
    s += `<text class="num" x="${ix}" y="${34 * mk}">${p[0]}</text><text class="yr" x="${ix + 30 * mk}" y="${34 * mk}">${p[1]}</text>`;
    s += `<text class="ph" x="${ix}" y="${72 * mk}">${p[2]}</text><text class="phs" x="${ix}" y="${98 * mk}">${p[3]}</text><text class="phs" x="${ix}" y="${118 * mk}">${p[4]}</text>`;
  });
  // the quiet apparatus of a study, in pencil: a baseline with year ticks, construction lines at the phase
  // boundaries, and the question the sheet asks
  const base = H - 30 * mk, edges = [colW + gap / 2, 2 * colW + gap * 1.5], years = ['2024', '2025', '2026 →'];
  s += `<g class="study" aria-hidden="true"><path class="rule" d="M8 ${base}H${W - 8}"/>${edges.map(x => `<path class="cons" d="M${x} ${head - 4}V${base + 5}"/>`).join('')}`;
  s += [8, ...edges].map((x, i) => `<path class="rule" d="M${x} ${base - 4}V${base + 4}"/><text class="tick" x="${x + 6}" y="${base + 15 * mk}">${years[i]}</text>`).join('');
  s += `<text class="note" x="${16 * mk}" y="${head + 22 * mk}">${zh ? 'harness 做的事，模型能自己做多少？' : 'how much can the model carry on its own?'}</text></g>`;
  const L = mapNodes.find(n => n.lab === 'loop'), lx = cx(2, L.fx), ly = cy(L.fy), R = Math.min(colW * .34, 72 * mk);
  const nodes = mapNodes.filter(n => n !== L), pts = [...nodes.map(n => [Math.round(cx(n.col, n.fx)), Math.round(cy(n.fy))]), [Math.round(lx - R * .7), Math.round(ly + R * .72)]];
  // Straight lead-in, tangent to the first segment and clipped to the first column card (never below it).
  const [a, b] = pts, dx = b[0] - a[0], dy = b[1] - a[1];
  const k = Math.max(0, Math.min((H - 14 * mk - a[1]) / Math.max(1, -dy), (a[0] - 14 * mk) / Math.max(1, dx), .28));
  const start = [+(a[0] - dx * k).toFixed(1), +(a[1] - dy * k).toFixed(1)];
  const d = `M${start[0]} ${start[1]} L${a[0]} ${a[1]}${catmull(pts)}`;
  s += `<path class="trk" d="${d}"/><path class="crv" d="${d}"/>`;
  // Past the loop the ridge is not drawn yet: a dotted pencil line goes on up to the sheet's right edge, with an
  // arrow and a note. It starts clear of the loop and of the loop's two names. ext: the undrawn slope from the
  // curve's end, for whatever is painted under it.
  const ext = [[lx - R * .7, ly + R * .72], [lx + R * .04, ly - R * .53], [lx + R + 3, ly - R * 1.24], [W, ly - R * 1.67]];
  { // it leaves the curve's end, passes under the loop (well clear of the orbit) and rises to the sheet's right edge
    const f = v => v.toFixed(1), cxq = lx + R * .75, cyq = ly + R * 1.5, x1 = W - 9, y1 = ly + R * .45;
    const ang = Math.atan2(y1 - cyq, x1 - cxq), tip = a => `${f(x1 - 7 * Math.cos(ang + a))} ${f(y1 - 7 * Math.sin(ang + a))}`;
    s += `<g class="study" aria-hidden="true"><path class="ext" d="M${f(lx - R * .45)} ${f(ly + R * .95 + 7)} Q${f(cxq)} ${f(cyq)} ${f(x1)} ${f(y1)}"/><path class="rule" d="M${tip(.45)}L${f(x1)} ${f(y1)}L${tip(-.45)}"/>`;
    s += `<text class="note prog" x="${f(W - 8)}" y="${f(ly + R * 1.5 + 8 * mk)}" text-anchor="end">${zh ? '进行中' : 'in progress'}</text></g>`;
  }
  const r = R * .5, venue = n => pick(n.venue, lang);
  s += `<g class="node loop" data-id="${L.id}" tabindex="0" role="button" aria-label="${L.name} · ${esc(venue(L))}"><circle class="orbit" cx="${lx}" cy="${ly}" r="${R}"/>`;
  s += `<circle class="loopm" cx="${lx - r * .86}" cy="${ly}" r="${r}"/><circle class="looph" cx="${lx + r * .86}" cy="${ly}" r="${r}"/>`;
  s += `<text class="loopt" x="${lx - r * .95}" y="${ly + 4.5 * mk}" text-anchor="middle" fill="var(--ec-accent)">${zh ? '模型' : 'model'}</text><text class="loopt" x="${lx + r * .95}" y="${ly + 4.5 * mk}" text-anchor="middle" fill="var(--ec-green)">harness</text>`;
  s += `<circle class="tok" r="4" cx="${lx + R}" cy="${ly}">${motion ? `<animateMotion dur="9s" repeatCount="indefinite" path="M0 0 a${R} ${R} 0 1 1 -${2 * R} 0 a${R} ${R} 0 1 1 ${2 * R} 0"/>` : ''}</circle>`;
  s += `<text class="nm lp" x="${lx}" y="${ly - R - 26 * mk}" text-anchor="middle">${L.name}</text><text class="vn" x="${lx}" y="${ly - R - 10 * mk}" text-anchor="middle">${esc(venue(L))}</text>`;
  s += `<rect x="${lx - R}" y="${ly - R - 40 * mk}" width="${2 * R}" height="${2 * R + 40 * mk}" fill="transparent"/></g>`;
  nodes.forEach((n, i) => {
    const x = Math.round(cx(n.col, n.fx)), y = Math.round(cy(n.fy)), up = n.lab === 'above';
    const side = n.lab === 'br' ? 1 : n.lab === 'bl' ? -1 : 0, anc = side > 0 ? 'start' : side < 0 ? 'end' : 'middle', tx = x + side * 8 * mk;
    const ny = up ? y - 36 * mk : y + (side ? 28 : 33) * mk, vy = up ? y - 19 * mk : y + (side ? 44 : 49) * mk;
    s += `<g class="node" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)} · ${esc(venue(n))}"><circle class="o" cx="${x}" cy="${y}" r="8"/>`;
    s += `<text class="nm" x="${tx}" y="${ny}" text-anchor="${anc}">${esc(n.name)}</text><text class="vn" x="${tx}" y="${vy}" text-anchor="${anc}">${esc(venue(n))}</text>`;
    s += `<circle cx="${x}" cy="${y}" r="22" fill="transparent"/></g>`;
  });
  // pts: node centres [x, y, id] in curve order, the loop's centre last; curve: the points the path runs through
  return {svg: s + '</svg>', mk, path: d, ext, pts: [...nodes.map((n, i) => [pts[i][0], pts[i][1], n.id]), [lx, ly, L.id]], curve: [start, ...pts], loop: {x: lx, y: ly, R}};
}

/**
 * The phone column's map: the phases stack as bands and the curve runs down a lane on the left, the peaks swinging
 * right, so it never crosses a word; names and phase headers share one column beside the lane. Rows are whole-width
 * tap targets. Same classes as the wide map, at one scale.
 */
function compactMapSVG(W, lang, {motion}) {
  const zh = lang === 'zh', mk = .9, gap = 10, col = 126, top = 104, rowH = 42, R = 52, venue = n => pick(n.venue, lang);
  const L = mapNodes.find(n => n.lab === 'loop'), nodes = mapNodes.filter(n => n !== L);
  const laneX = n => Math.round(24 + 60 * (1 - (n.fy - .2) / .68));
  let s = '', y0 = 0, lx = 62, ly = 0;
  const pts = [];
  mapPhases[zh ? 'zh' : 'en'].forEach((p, c) => {
    const own = nodes.filter(n => n.col === c), h = top + own.length * rowH + (c === 2 ? 2 * R + 12 : 0) + 8;
    s += `<rect class="phase" x=".5" y="${y0 + .5}" width="${W - 1}" height="${h - 1}" rx="13"/>`;
    s += `<text class="num" x="${col}" y="${y0 + 24}">${p[0]}</text><text class="yr" x="${col + 27}" y="${y0 + 24}">${p[1]}</text>`;
    s += `<text class="ph" x="${col}" y="${y0 + 52}">${p[2]}</text><text class="phs" x="${col}" y="${y0 + 72}">${p[3]}</text><text class="phs" x="${col}" y="${y0 + 89}">${p[4]}</text>`;
    own.forEach((n, i) => pts.push({n, x: laneX(n), y: y0 + top + rowH * i + rowH / 2}));
    if (c === 2) ly = y0 + top + own.length * rowH + 6 + R;
    y0 += h + gap;
  });
  const H = y0 - gap, first = pts[0];
  const d = `M${first.x} ${first.y - 104} L${first.x} ${first.y}${catmull([...pts.map(q => [q.x, q.y]), [Math.round(lx - R * .7), Math.round(ly - R * .72)]])}`;
  let out = `<svg class="compact" viewBox="0 0 ${W} ${H}" role="group" aria-label="${zh ? '研究地图：多模态、评测、后训练' : 'Research map: Multimodal, Eval, Post-training'}">${s}`;
  out += `<path class="trk" d="${d}"/><path class="crv" d="${d}"/>`;
  pts.forEach(({n, x, y}, i) => {
    out += `<g class="node" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)} · ${esc(venue(n))}"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="transparent"/>`;
    out += `<circle class="o" cx="${x}" cy="${y}" r="8"/>`;
    out += `<text class="nm" x="${col}" y="${y - 1}">${esc(n.name)}</text><text class="vn" x="${col}" y="${y + 14}">${esc(venue(n))}</text></g>`;
  });
  const r = R * .5;
  out += `<g class="node loop" data-id="${L.id}" tabindex="0" role="button" aria-label="${L.name} · ${esc(venue(L))}"><rect x="0" y="${ly - R - 6}" width="${W}" height="${2 * R + 12}" fill="transparent"/><circle class="orbit" cx="${lx}" cy="${ly}" r="${R}"/>`;
  out += `<circle class="loopm" cx="${lx - r * .86}" cy="${ly}" r="${r}"/><circle class="looph" cx="${lx + r * .86}" cy="${ly}" r="${r}"/>`;
  out += `<text class="loopt" x="${lx - r * .95}" y="${ly + 4}" text-anchor="middle" fill="var(--ec-accent)">${zh ? '模型' : 'model'}</text><text class="loopt" x="${lx + r * .95}" y="${ly + 4}" text-anchor="middle" fill="var(--ec-green)">harness</text>`;
  out += `<circle class="tok" r="4" cx="${lx + R}" cy="${ly}">${motion ? `<animateMotion dur="9s" repeatCount="indefinite" path="M0 0 a${R} ${R} 0 1 1 -${2 * R} 0 a${R} ${R} 0 1 1 ${2 * R} 0"/>` : ''}</circle>`;
  out += `<text class="nm lp" x="${col}" y="${ly - 1}">${L.name}</text><text class="vn" x="${col}" y="${ly + 14}">${esc(venue(L))}</text></g>`;
  return {svg: out + '</svg>', mk, h: H, path: d, pts: [...pts.map(q => [q.x, q.y, q.n.id]), [lx, ly, L.id]], curve: pts.map(q => [q.x, q.y]), loop: {x: lx, y: ly, R}};
}

/** Hover-card markup for one map node. Links are real; the title opens the paper / project panel. */
export function cardHTML(id, lang = 'en') {
  const n = mapNodes.find(q => q.id === id); if (!n) return '';
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'], pub = n.pub && publications.find(p => p.id === n.pub);
  const linkList = pub ? pub.links.filter(l => /^(Paper|Code)$/.test(l.label.en)).map(l => [l.label.en === 'Paper' ? 'paper' : 'code', l.url]) : (n.links || []);
  const action = pub ? `data-action="paper" data-id="${pub.id}"` : n.project ? `data-action="project" data-id="${n.project}"` : '';
  const title = action ? `<button class="ttl" ${action}>${esc(n.name)}</button>` : `<span class="ttl">${esc(n.name)}</span>`;
  // Blog notes about this work (only when there are any): /blog/?work=<id>.
  const workId = n.work || n.pub || n.project || n.id, notes = notesFor(workId).length;
  const foot = [...linkList.map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t[k]} ↗</a>`), notes ? `<a class="notes" href="${notesHref(workId, lang)}">${lang === 'zh' ? '笔记' : 'notes'} (${notes}) →</a>` : '', action ? `<button ${action}>${t.open} →</button>` : ''].join('');
  return `<div class="meta"><span class="rl${n.green ? ' g' : ''}">${esc(pick(n.role, lang))}</span><span>${esc(pick(n.full, lang))}</span></div><h4>${title}</h4><p class="q">${esc(pick(n.q, lang))}</p><div class="dg" aria-hidden="true"><svg viewBox="0 0 280 80" preserveAspectRatio="xMidYMid meet">${DG[n.dg]}</svg></div>${foot ? `<div class="pf">${foot}</div>` : ''}`;
}

/**
 * One sheet of the page: fills `root` with `page(lang)`, builds the research map into its .mapbox (if it has one),
 * shows the hover cards, and rebuilds the map when its box changes size. onChange runs after anything that moves
 * the words. Returns {lang, map, setLanguage, nodes(), box()} with positions in the sheet's own px.
 */
function mountSheet(root, {lang = 'en', page, onChange, motion = true} = {}) {
  lang = lang === 'zh' ? 'zh' : 'en';
  let map = null, pinned = null, hideTimer = 0, observer = null, built = [0, 0];
  const changed = why => onChange?.(why);
  const card = document.createElement('div'); card.className = 'pcard'; card.setAttribute('role', 'dialog');
  const offset = node => { let x = 0, y = 0; for (let n = node; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  function buildMap() {
    const box = root.querySelector('.mapbox'); if (!box) return;
    box.style.height = '';
    const W = Math.round(box.clientWidth), compact = W < COMPACT_MAP;
    root.querySelector('.mapwin')?.classList.toggle('compact', compact);   // before measuring: the compact window has no height of its own
    const H = compact ? 0 : Math.round(box.clientHeight);
    if (!W || (!compact && !H)) return;
    built = [W, H];
    map = mapSVG(W, H, lang, {motion});
    if (compact) box.style.height = map.h + 'px';
    box.style.setProperty('--mk', map.mk.toFixed(3)); box.innerHTML = map.svg; box.appendChild(card);
    if (pinned) showCard(pinned);
    changed('map');
  }
  function showCard(id) {
    const box = root.querySelector('.mapbox'); if (!box || !map) return;
    clearTimeout(hideTimer); pinned = id;
    box.querySelectorAll('.node').forEach(g => g.classList.toggle('on', g.dataset.id === id));
    card.innerHTML = cardHTML(id, lang); card.classList.add('show');
    const point = map.pts.find(p => p[2] === id), r = id === 'lc' ? map.loop.R : 8;
    const cw = card.offsetWidth || 316, ch = card.offsetHeight || 250, bw = box.clientWidth, bh = box.clientHeight;
    let x = point[0] + r + 16, y = point[1] - ch / 2;
    if (x + cw > bw + 6) x = point[0] - r - cw - 16;
    if (x < -6) { x = Math.max(0, Math.min(bw - cw, point[0] - cw / 2)); y = point[1] + r + 12; if (y + ch > bh - 4) y = point[1] - r - ch - 12; }
    card.style.left = x + 'px'; card.style.top = Math.max(4, Math.min(bh - ch - 4, y)) + 'px';
    changed('card');
  }
  function hideCard() { if (!pinned) return; pinned = null; card.classList.remove('show'); root.querySelectorAll('.mapbox .node').forEach(g => g.classList.remove('on')); changed('card'); }
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!card.matches(':hover') && !card.contains(document.activeElement)) hideCard(); }, 180); }
  // one set of listeners on the root: the sheet's HTML is replaced when the language changes
  root.addEventListener('pointerover', e => { const node = e.target.closest('.mapbox .node'); if (node) showCard(node.dataset.id); else if (e.target.closest('.pcard')) clearTimeout(hideTimer); });
  root.addEventListener('pointerout', e => { if (e.pointerType !== 'touch' && e.target.closest('.mapbox .node, .pcard')) hideSoon(); });
  root.addEventListener('focusin', e => { const node = e.target.closest('.mapbox .node'); if (node) showCard(node.dataset.id); });
  root.addEventListener('focusout', e => { if (e.target.closest('.mapbox .node, .pcard')) hideSoon(); });
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.mapbox .node')) { e.preventDefault(); e.stopPropagation(); card.querySelector('[data-action]')?.click(); } });
  root.ownerDocument.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && pinned && !card.contains(e.target) && !e.target.closest?.('.mapbox .node')) hideCard(); });
  function render() {
    root.innerHTML = page(lang);
    buildMap();
    observer?.disconnect();
    const box = root.querySelector('.mapbox');
    // rebuild when the box really changed (the compact map sets its own height: that alone is no reason)
    if (box && typeof ResizeObserver === 'function') { observer = new ResizeObserver(() => { const W = Math.round(box.clientWidth), H = Math.round(box.clientHeight); if (W !== built[0] || (W >= COMPACT_MAP && H !== built[1])) buildMap(); }); observer.observe(box); }
    changed('language');
  }
  render();
  return {
    root, buildMap, showCard, hideCard,
    get lang() { return lang; }, get map() { return map; },
    setLanguage(value) { lang = value === 'zh' ? 'zh' : 'en'; pinned = null; render(); },
    setMotion(value) { motion = value; buildMap(); },
    nodes() { const box = root.querySelector('.mapbox'); if (!box || !map) return []; const [ox, oy] = offset(box); return map.pts.map(([x, y, id]) => ({id, x: x + ox, y: y + oy, r: id === 'lc' ? map.loop.R : 8})); },
    box(target) { const node = typeof target === 'string' ? root.querySelector(target) : target; if (!node) return null; const [x, y] = offset(node); return [x, y, node.offsetWidth, node.offsetHeight]; },
  };
}

/** What the board's scene needs of the page (it reads it as window.SITE): the pieces and the sheet mounter. */
export const site = {top, hero, mapWindow, status, mount: mountSheet};

/** Below either, the page is one scrolling column and the board's effect stays off (it matches board.css). */
export const BOARD_MIN = {width: 1260, height: 600};

/**
 * Wire the landing. `host` is the Interface root. The page works as plain HTML at once; the board (HTML-in-Canvas)
 * is loaded after it and takes over where the browser supports it, the window is large enough and the theme is
 * light. Returns {setLanguage, setReducedMotion, refresh, pause, resume, destroy}.
 */
export function mountLanding(host, {lang = 'en', reducedMotion = false, getGuide = () => null} = {}) {
  const land = host.querySelector('.landing'); if (!land || typeof ResizeObserver !== 'function') return null;
  const root = document.documentElement, $ = id => land.querySelector('#' + id);
  let LANG = lang === 'zh' ? 'zh' : 'en', paused = false, disposed = false, board = null, sheets = null;
  let still = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === '0';
  const dark = () => (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  // the idle CV Tour guide rests in the status line, clear of the hero
  const dock = () => { const guide = getGuide(); guide?.classList.add('ec-docked'); host.querySelector('.status')?.classList.add('docked'); };
  const applyMode = () => { land.classList.toggle('dark', dark()); root.classList.toggle('board-dark', dark()); if (board?.app) { board.app.dark = dark(); board.app.setEffects?.(!paused); board.app.dirty?.(); } land.classList.toggle('fx', !!board?.app?.effects?.()); syncPanel(); };
  // The site's panel (a section, a paper, a project, the map, settings) is the board's fifth sheet while the effect
  // runs: ui.js opens and fills it (.experience.reading); here the board is told to lift it or put it away.
  const experience = host.querySelector('.experience'), pageContent = host.querySelector('#page-content');
  let panelKey = '';
  function syncPanel() {
    const open = experience.classList.contains('reading') && !experience.classList.contains('playing');
    const route = /^#(section|paper|project)\/([\w-]+)/.exec(location.hash), id = route ? route[2] : '';
    const key = route ? route[1] + '/' + id : 'panel', turned = open && panelKey && key !== panelKey;
    panelKey = open ? key : '';
    if (!board?.app?.effects?.()) {      // the plain sheet: one element, so it settles again as the next page
      const sheet = turned && host.querySelector('.grimoire');
      if (sheet) { sheet.classList.remove('turn'); void sheet.offsetWidth; sheet.classList.add('turn'); }
      return;
    }
    land.querySelectorAll('.nav a[data-id]').forEach(a => { const on = open && route?.[1] === 'section' && a.dataset.id === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    board.markNav();
    board.sheet(open, id || 'panel', key);
    if (open && land.inert) land.inert = false;   // the canvas holds the open sheet: the board guards its own parts
  }
  const panelObserver = new MutationObserver(() => syncPanel());
  if (experience) panelObserver.observe(experience, {attributes: true, attributeFilter: ['class']});
  if (pageContent) panelObserver.observe(pageContent, {childList: true});
  panelObserver.observe(land, {attributes: true, attributeFilter: ['inert']});

  // Until the board has loaded (and for good where it cannot run) the sheets are mounted here.
  function plain() {
    if (sheets) return;
    sheets = {
      ground: mountSheet($('ground'), {lang: LANG, page: sheetHTML.ground}),
      map: mountSheet($('mapl'), {lang: LANG, page: sheetHTML.map, motion: !still}),
      text: mountSheet($('text'), {lang: LANG, page: sheetHTML.text}),
    };
    dock();
  }
  // Probe for HTML-in-Canvas before fetching anything (the feature itself, never the browser's name); ?fx=off forces the plain page.
  const probe = document.createElement('canvas'); probe.setAttribute('content', 'drawable');
  const canDraw = (probe.content === 'drawable' || 'layoutSubtree' in HTMLCanvasElement.prototype) && typeof probe.requestPaint === 'function';
  // The board (and the paint simulator) is fetched only when the window can show the effect: a phone never pays for it.
  const big = () => innerWidth >= BOARD_MIN.width && innerHeight >= BOARD_MIN.height;
  const start = () => import('../board/index.js').then(m => m.startBoard({site, min: BOARD_MIN, lang: LANG, still, intro: opening(), copy: () => landingCopy[LANG], onMode: () => { land.classList.toggle('fx', !!board?.app?.effects?.()); dock(); }})).then(started => {
    board = started;
    if (disposed) { board.app?.setEffects?.(false); return; }
    if (board.lang() !== LANG) board.setLanguage(LANG);
    applyMode(); dock();
  }).catch(error => { console.warn('board', error); if (!land.querySelector('.hero')) { root.classList.add('flat'); plain(); } });
  land.classList.toggle('dark', dark());
  root.classList.toggle('board-dark', dark());
  const opening = () => {
    let entered = false; try { entered = sessionStorage.getItem('board-entered') === '1'; } catch (error) { /* private mode */ }
    return opensExploded({effects: !paused, reducedMotion: still, hash: location.hash, reading: !!experience?.matches('.reading, .playing, .exhibiting'), navigation: performance.getEntriesByType?.('navigation')[0]?.type || 'navigate', entered});
  };
  let started = false;
  const grow = () => { if (started || disposed || !big()) return; started = true; removeEventListener('resize', grow); start(); };
  if (!canDraw || new URLSearchParams(location.search).get('fx') === 'off') { root.classList.add('flat'); plain(); }
  else if (big()) { started = true; start(); }
  else { root.classList.add('flat'); plain(); addEventListener('resize', grow); }

  const themeObserver = new MutationObserver(() => { applyMode(); land.querySelectorAll('.theme-button').forEach(b => { b.innerHTML = themeIcon(); }); });
  themeObserver.observe(root, {attributes: true, attributeFilter: ['data-theme']});
  const schemeQuery = matchMedia('(prefers-color-scheme: dark)'), onScheme = () => applyMode();
  schemeQuery.addEventListener?.('change', onScheme);
  return {
    setLanguage(value) {
      LANG = value === 'zh' ? 'zh' : 'en';
      if (board) board.setLanguage(LANG); else if (sheets) for (const sheet of Object.values(sheets)) sheet.setLanguage(LANG);
      land.setAttribute('aria-label', landingCopy[LANG].name);
      for (const [selector, key] of [['.xbtn:not(.save):not(.scrape) span', land.querySelector('.xbtn')?.getAttribute('aria-pressed') === 'true' ? 'collapse' : 'explode'], ['.xbtn kbd', 'hold'], ['.xbtn.save span', 'save'], ['.xbtn.scrape span', 'scrape']]) { const el = land.querySelector(selector); if (el) el.textContent = landingCopy[LANG][key]; }
      land.querySelector('.xbtn')?.setAttribute('data-tip', landingCopy[LANG].layersTip);
      { const hint = land.querySelector('.enter-hint'); if (hint) { const fresh = document.createElement('div'); fresh.innerHTML = enterHintHTML(LANG); hint.innerHTML = fresh.firstChild.innerHTML; } }
      dock();
    },
    setReducedMotion(value) { still = !!value || matchMedia('(prefers-reduced-motion: reduce)').matches; root.classList.toggle('still', still); sheets?.map.setMotion(!still); },
    refresh() { window.__board?.measure?.(); sheets?.map.buildMap(); dock(); },
    pause() { paused = true; applyMode(); },
    resume() { if (!paused) return; paused = false; applyMode(); requestAnimationFrame(() => { window.__board?.measure?.(); dock(); }); },
    destroy() { disposed = true; panelObserver.disconnect(); themeObserver.disconnect(); schemeQuery.removeEventListener?.('change', onScheme); board?.app?.setEffects?.(false); },
  };
}
