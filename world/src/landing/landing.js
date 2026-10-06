// Editable Canvas landing: the one-screen home that sits above the (lazy) 3D academy.
// Facts come from content.js; this module owns layout, the research map and the playful,
// non-destructive canvas affordances (handles spring back, nothing is ever saved or edited).
import {profile, links, publications, cvForLanguage} from '../content.js';
import {ec, cursorArrow} from './icons.js';

export const MUSEUM_URL = lang => `/yuanmingyuan.html?composition=xianfaqiao&planting=western&court=garden-r4&yangquelong=refined-r1&lang=${lang}`;

export const landingCopy = {
  en: {
    hist: 'History', role: 'ML PhD · MBZUAI VILA Lab&nbsp; /&nbsp; Research Intern · Meituan LongCat',
    chipA: 'Artifact design post-training', chipB: 'Long-horizon agent harnesses',
    email: 'Email', cv: 'CV', tour: 'CV Tour ↗',
    mapTitle: 'one question · three phases', mapHint: 'hover a node', lgPaper: 'paper / project', lgLoop: 'model ⟲ harness loop', lgAll: 'all publications →',
    now: 'Now', nowT: 'research intern at Meituan M17 LongCat · open to research collaboration', demo: 'demo canvas · handles spring back, nothing is saved',
    explore: 'Explore', academy: '3D Academy', world: 'World map', ymy: 'Yuanmingyuan',
    paper: 'paper', code: 'code', open: 'details', snap: 'demo · springs back', map: 'Research map', name: 'Yaxin Luo',
  },
  zh: {
    hist: '历史', role: 'ML 博士生 · MBZUAI VILA Lab&nbsp; /&nbsp; 研究实习生 · 美团 LongCat',
    chipA: 'Artifact design 后训练', chipB: '长程智能体 harness',
    email: '邮件', cv: '简历', tour: 'CV 导览 ↗',
    mapTitle: '一个问题 · 三个阶段', mapHint: '悬停节点', lgPaper: '论文 / 项目', lgLoop: '模型 ⟲ harness 循环', lgAll: '全部论文 →',
    now: '现在', nowT: '美团 M17 LongCat 研究实习 · 欢迎研究合作', demo: '演示画布 · 手柄会弹回，不会保存任何改动',
    explore: '探索', academy: '3D 学院', world: '世界地图', ymy: '圆明园',
    paper: '论文', code: '代码', open: '详情', snap: '演示 · 松手弹回', map: '研究地图', name: 'Yaxin Luo',
  },
};

const PHASES = {
  en: [['01', '2024–25', 'Multimodal', 'efficient, grounded', 'multimodal models'], ['02', '2025–26', 'Eval', 'measuring agents on', 'long-horizon agentic tasks'], ['03', '2026 →', 'Post-training', 'co-evolution of model', 'parameters and harnesses']],
  zh: [['01', '2024–25', '多模态', '高效、可定位的', '多模态模型'], ['02', '2025–26', '评测', '衡量智能体在', '长程智能体任务上的能力'], ['03', '2026 →', '后训练', '模型参数与 harness', '的协同进化']],
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
  {id: 'lc', name: 'LongCat-2.5', venue: ['1.6T · Meituan', '1.6T · 美团'], col: 2, fx: .6, fy: .38, lab: 'loop', green: 1, role: ['post-training contributor', '后训练贡献者'], full: ['Meituan M17', '美团 M17'],
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

/* Inspector history: a truthful, compact record of how this page was made. */
const HIST = {
  en: [['r1', '4 directions', 'Canvas, split map, artboards and a critique loop, drafted as clickable prototypes.', [['C', 'too many ideas on one screen']]],
    ['r2', 'Interview', 'Picked from round 1: the critique loop, the canvas shell and the split research map.', [['C', 'the map must never be hidden']]],
    ['r3', 'Critique', 'Screenshots at three sizes, light and dark, reviewed and fixed.', [['C', 'nothing may look like it edits the page'], ['C', 'credits must be truthful']]],
    ['now', 'This page', 'Rulers, toolbar, map on the right, tour in the corner.', [['✓', 'ships when every size is clean', 1]]]],
  zh: [['r1', '四个方向', '画布、分屏地图、画板、批评循环，各做成可点击原型。', [['C', '一屏塞了太多想法']]],
    ['r2', '访谈', '选定：批评循环 + 画布外壳 + 分屏研究地图。', [['C', '地图必须常驻，不能藏起来']]],
    ['r3', '批评', '三种尺寸、深浅两套截图，逐张审阅并修正。', [['C', '任何交互都不能看起来像在改页面内容'], ['C', '署名与来源必须属实']]],
    ['now', '当前页面', '标尺、工具栏、右侧地图、角落导览。', [['✓', '每个尺寸都干净才交付', 1]]]],
};
const CRED = {en: 'Built with Claude Opus 5.5 as a coding agent, reviewed from rendered screenshots each round.', zh: '由 Claude Opus 5.5 作为编码智能体搭建，每轮基于渲染截图审阅。'};
const NOTES = {en: {claim: 'leads with the claim ✓', chips: 'one accent ✓', loop: 'model ⟲ harness'}, zh: {claim: '先说结论 ✓', chips: '只用一个强调色 ✓', loop: '模型 ⟲ harness'}};

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

/** Static landing markup. Root keeps the `.welcome` class: Interface hides it while the 3D world plays. */
export function renderLanding(lang = 'en') {
  const t = strings(lang);
  const L = k => `data-l="${k}"`;
  return `<section class="welcome landing ec-dots" aria-label="${esc(t.name)}">
    <div class="ec-corner" aria-hidden="true"></div><div class="ec-rx" aria-hidden="true"><i class="hl"></i></div><div class="ec-ry" aria-hidden="true"><i class="hl"></i></div>
    <div class="ec-main">
      <div class="ec-left">
        <div class="ec-hero">
          <div class="ec-insp"><span><span class="k">◇</span><span class="ttl">Text · H1</span></span><span>Noto Serif · 700</span><span class="isz">— px</span><span><i class="sw"></i><span class="ifill">#15162E</span></span><span class="hist"><span class="k" ${L('hist')}>${t.hist}</span><ol></ol></span><div class="hpop" role="tooltip"></div></div>
          <div class="ec-namerow"><div class="ec-sel"><h1 class="ec-name">Yaxin Luo</h1></div><span class="ec-zhname" lang="zh-CN">罗亚鑫</span></div>
          <div class="ec-role" ${L('role')}>${t.role}</div>
          <p class="ec-claim"><b ${L('claimA')}>${t.claimA}</b> <span ${L('claimB')}>${t.claimB}</span></p>
          <div class="ec-chips"><span class="ec-chip" ${L('chipA')}>${t.chipA}</span><span class="ec-chip g" ${L('chipB')}>${t.chipB}</span></div>
          <p class="ec-bio" ${L('bio')}>${t.bio}</p>
          <div class="ec-cta">
            <a class="ec-btn p" href="${links.email}">${ec.mail}<span ${L('email')}>${t.email}</span></a>
            <a class="ec-btn" href="${links.scholar}" target="_blank" rel="noopener noreferrer">${ec.scholar}<span>Scholar</span><span class="ar">↗</span></a>
            <a class="ec-btn ec-cv" href="${cvForLanguage(lang)}" target="_blank" rel="noopener noreferrer">${ec.cv}<span ${L('cv')}>${t.cv}</span><span class="ar">↗</span></a>
            <a class="ec-btn" href="${links.github}" target="_blank" rel="noopener noreferrer">${ec.gh}<span>GitHub</span><span class="ar">↗</span></a>
          </div>
        </div>
        <button class="ec-tour-chip" data-action="mascot-toggle" aria-controls="mascot-guide"><span ${L('tour')}>${t.tour}</span></button>
      </div>
      <section class="ec-win" aria-label="${esc(t.map)}">
        <div class="bar"><span class="ec-wdots" aria-hidden="true"><i></i><i></i><i></i></span><span>research-map / <b ${L('mapTitle')}>${t.mapTitle}</b></span><span class="hint"><span ${L('mapHint')}>${t.mapHint}</span> <kbd>tab</kbd></span></div>
        <div class="cv ec-dots"><div class="ec-mapbox"></div>
          <div class="legend"><span><i></i><span ${L('lgPaper')}>${t.lgPaper}</span></span><span><i class="l"></i><span ${L('lgLoop')}>${t.lgLoop}</span></span><button data-action="section" data-id="publications" ${L('lgAll')}>${t.lgAll}</button></div>
        </div>
      </section>
    </div>
    <div class="ec-layer" aria-hidden="true"></div>
  </section>
  <footer class="intro-footer ec-status">
    <span class="now"><span class="dot" aria-hidden="true"></span><b ${L('now')}>${t.now}</b> · <span ${L('nowT')}>${t.nowT}</span></span>
    <span class="demo" ${L('demo')}>${t.demo}</span>
    <span id="load-status" class="ec-sr" aria-live="polite"></span>
  </footer>`;
}

/**
 * The three places to explore, as dashed capsules for the top bar: the 3D academy (lazy world),
 * its travel map, and the Yuanmingyuan museum (a separate page). Labels use the Interface copy keys
 * (academy / map / garden), so the Interface's language switch keeps them current.
 */
export function renderExplore(lang = 'en') {
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'];
  return `<span class="ec-explore" role="group" aria-label="${esc(t.explore)}">`
    + `<button class="ec-cap academy-button" id="explore-button" data-action="start">${ec.cube}<span data-i18n="academy">${t.academy}</span></button>`
    + `<button class="ec-cap" data-action="map">${ec.map}<span data-i18n="map">${t.world}</span></button>`
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

/** Research map SVG for a box of W×H px. Pure: returns markup and the scale factor. */
export function mapSVG(W, H, lang = 'en', {motion = true} = {}) {
  const zh = lang === 'zh';
  const gap = 12, colW = (W - gap * 2) / 3, mk = Math.max(.82, Math.min(1.12, colW / 230, H / 560));
  const head = 128 * mk, bottom = 64 * mk;
  const cx = (c, f) => c * (colW + gap) + colW * f, cy = f => head + (H - head - bottom) * f;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${zh ? '研究地图：多模态、评测、后训练' : 'Research map: Multimodal, Eval, Post-training'}">`;
  PHASES[zh ? 'zh' : 'en'].forEach((p, i) => {
    const x = i * (colW + gap), ix = x + 18 * mk;
    s += `<rect class="phase" x="${x + .5}" y=".5" width="${colW - 1}" height="${H - 1}" rx="13"/>`;
    s += `<text class="num" x="${ix}" y="${34 * mk}">${p[0]}</text><text class="yr" x="${ix + 30 * mk}" y="${34 * mk}">${p[1]}</text>`;
    s += `<text class="ph" x="${ix}" y="${72 * mk}">${p[2]}</text><text class="phs" x="${ix}" y="${98 * mk}">${p[3]}</text><text class="phs" x="${ix}" y="${118 * mk}">${p[4]}</text>`;
  });
  const L = mapNodes.find(n => n.lab === 'loop'), lx = cx(2, L.fx), ly = cy(L.fy), R = Math.min(colW * .34, 72 * mk);
  const nodes = mapNodes.filter(n => n !== L), pts = [...nodes.map(n => [Math.round(cx(n.col, n.fx)), Math.round(cy(n.fy))]), [Math.round(lx - R * .7), Math.round(ly + R * .72)]];
  // Straight lead-in, tangent to the first segment and clipped to the first column card (never below it).
  const [a, b] = pts, dx = b[0] - a[0], dy = b[1] - a[1];
  const k = Math.max(0, Math.min((H - 14 * mk - a[1]) / Math.max(1, -dy), (a[0] - 14 * mk) / Math.max(1, dx), .28));
  const start = [+(a[0] - dx * k).toFixed(1), +(a[1] - dy * k).toFixed(1)];
  const d = `M${start[0]} ${start[1]} L${a[0]} ${a[1]}${catmull(pts)}`;
  s += `<path class="trk" d="${d}"/><path class="crv" d="${d}"/>`;
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
    s += `<g class="node" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)} · ${esc(venue(n))}"><circle class="r" cx="${x}" cy="${y}" r="8" style="animation-delay:-${(i * .8).toFixed(1)}s"/><circle class="o" cx="${x}" cy="${y}" r="8"/>`;
    s += `<text class="nm" x="${tx}" y="${ny}" text-anchor="${anc}">${esc(n.name)}</text><text class="vn" x="${tx}" y="${vy}" text-anchor="${anc}">${esc(venue(n))}</text>`;
    s += `<circle cx="${x}" cy="${y}" r="22" fill="transparent"/></g>`;
  });
  return {svg: s + '</svg>', mk};
}

/** Hover-card markup for one map node. Links are real; the title opens the paper / project panel. */
export function cardHTML(id, lang = 'en') {
  const n = mapNodes.find(q => q.id === id); if (!n) return '';
  const t = landingCopy[lang === 'zh' ? 'zh' : 'en'], pub = n.pub && publications.find(p => p.id === n.pub);
  const linkList = pub ? pub.links.filter(l => /^(Paper|Code)$/.test(l.label.en)).map(l => [l.label.en === 'Paper' ? 'paper' : 'code', l.url]) : (n.links || []);
  const action = pub ? `data-action="paper" data-id="${pub.id}"` : n.project ? `data-action="project" data-id="${n.project}"` : '';
  const title = action ? `<button class="ttl" ${action}>${esc(n.name)}</button>` : `<span class="ttl">${esc(n.name)}</span>`;
  const foot = [...linkList.map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t[k]} ↗</a>`), action ? `<button ${action}>${t.open} →</button>` : ''].join('');
  return `<div class="meta"><span class="rl${n.green ? ' g' : ''}">${esc(pick(n.role, lang))}</span><span>${esc(pick(n.full, lang))}</span></div><h4>${title}</h4><p class="q">${esc(pick(n.q, lang))}</p><div class="dg" aria-hidden="true"><svg viewBox="0 0 280 80" preserveAspectRatio="xMidYMid meet">${DG[n.dg]}</svg></div>${foot ? `<div class="pf">${foot}</div>` : ''}`;
}

class Cursor {
  constructor(kind, label, layer, motion) { this.layer = layer; this.motion = motion; this.e = document.createElement('div'); this.e.className = 'ec-cur ' + kind; this.e.innerHTML = cursorArrow + `<span class="lbl">${label}</span>`; layer.appendChild(this.e); this.x = 0; this.y = 0; this.anim = null; }
  place(x, y) { this.x = x; this.y = y; this.e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  moveTo(x, y, dur = 1300) {
    if (!this.motion || !this.e.animate) { this.place(x, y); return Promise.resolve(); }
    const from = `translate(${this.x}px,${this.y}px)`, to = `translate(${x}px,${y}px)`;
    this.x = x; this.y = y; this.e.style.transform = to; this.anim?.cancel();
    this.anim = this.e.animate([{transform: from}, {transform: to}], {duration: dur, easing: 'cubic-bezier(.45,0,.25,1)'});
    return this.anim.finished.catch(() => {});
  }
}
class Bubble {
  constructor(layer, kind) { this.e = document.createElement('div'); this.e.className = 'ec-bubble hide ' + kind; layer.appendChild(this.e); }
  show(text, x, y, who) { this.e.innerHTML = `<b>${who}</b>${esc(text)}`; this.e.style.left = x + 'px'; this.e.style.top = y + 'px'; this.e.classList.remove('hide'); }
  hide() { this.e.classList.add('hide'); }
}

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Wire the interactive layer. `host` is the Interface root; `getGuide()` returns the mascot root so the
 * hero can be fitted above it. Returns {setLanguage, refresh, pause, resume, destroy}.
 */
export function mountLanding(host, {lang = 'en', reducedMotion = false, getGuide = () => null} = {}) {
  const $ = s => host.querySelector(s);
  const land = $('.landing'); if (!land || typeof ResizeObserver !== 'function') return null;
  const ac = new AbortController(), on = (el, type, fn, opt = {}) => el?.addEventListener(type, fn, {...opt, signal: ac.signal});
  const root = document.documentElement;
  let LANG = lang === 'zh' ? 'zh' : 'en', paused = false, disposed = false;
  let motion = !reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches && new URLSearchParams(location.search).get('motion') !== '0';
  land.classList.toggle('ec-motion', motion);
  const mb = $('.ec-mapbox'), layer = $('.ec-layer'), sel = $('.ec-sel'), nameEl = $('.ec-name');
  const card = document.createElement('div'); card.className = 'ec-pcard'; card.setAttribute('role', 'dialog');

  /* ---------- research map + hover card ---------- */
  let pinned = null, user = false, hideTimer = 0;
  function buildMap() {
    const W = Math.round(mb.clientWidth), H = Math.round(mb.clientHeight); if (!W || !H) return;
    const {svg, mk} = mapSVG(W, H, LANG, {motion});
    mb.style.setProperty('--mk', mk.toFixed(3)); mb.innerHTML = svg; mb.appendChild(card);
    mb.querySelectorAll('.node').forEach(g => {
      g.addEventListener('pointerenter', () => { user = true; layer.classList.add('quiet'); showCard(g.dataset.id); });
      g.addEventListener('focus', () => showCard(g.dataset.id));
      g.addEventListener('pointerleave', () => { user = false; layer.classList.remove('quiet'); hideSoon(); });
      g.addEventListener('blur', () => hideSoon());
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.querySelector('[data-action]')?.click(); } });
    });
    if (pinned) showCard(pinned);
  }
  function showCard(id) {
    clearTimeout(hideTimer); pinned = id;
    mb.querySelectorAll('.node').forEach(g => g.classList.toggle('on', g.dataset.id === id));
    card.innerHTML = cardHTML(id, LANG);
    const g = mb.querySelector(`.node[data-id="${id}"] .o, .node[data-id="${id}"] .orbit`); if (!g) return;
    const gr = g.getBoundingClientRect(), b = mb.getBoundingClientRect(), cw = card.offsetWidth || 316, ch = card.offsetHeight || 250;
    let x = gr.right - b.left + 16, y = gr.top - b.top + gr.height / 2 - ch / 2;
    if (x + cw > b.width + 6) x = gr.left - b.left - cw - 16;
    y = Math.max(4, Math.min(b.height - ch - 4, y));
    card.style.left = x + 'px'; card.style.top = y + 'px'; card.classList.add('show');
  }
  function hideCard() { pinned = null; card.classList.remove('show'); mb.querySelectorAll('.node').forEach(g => g.classList.remove('on')); }
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!card.matches(':hover') && !card.contains(document.activeElement)) hideCard(); }, 160); }
  on(card, 'pointerenter', () => { clearTimeout(hideTimer); user = true; });
  on(card, 'pointerleave', () => { user = false; layer.classList.remove('quiet'); hideSoon(); });
  on(card, 'focusout', () => hideSoon());

  /* ---------- name: playful handles that always spring back ---------- */
  const frame = document.createElement('div'); frame.className = 'frame'; frame.innerHTML = '<svg aria-hidden="true"><rect/></svg>'; sel.prepend(frame);
  ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'].forEach(k => { const h = document.createElement('i'); h.className = 'h ' + k; h.dataset.h = k; sel.appendChild(h); });
  const dim = document.createElement('span'); dim.className = 'dim'; sel.appendChild(dim);
  let st = null;
  on(sel, 'pointerdown', e => {
    const h = e.target.dataset?.h; if (!h) return;
    e.preventDefault(); e.target.setPointerCapture?.(e.pointerId);
    st = {x: e.clientX, y: e.clientY, w: nameEl.offsetWidth, h}; nameEl.classList.remove('spring'); sel.classList.add('dragging'); dim.textContent = landingCopy[LANG].snap;
  });
  on(sel, 'pointermove', e => {
    if (!st) return;
    const sx = st.h.includes('l') ? -1 : st.h.includes('r') ? 1 : 0, sy = st.h.includes('t') ? -1 : st.h.includes('b') ? 1 : 0;
    const d = sx ? (e.clientX - st.x) * sx / st.w : (e.clientY - st.y) * sy / 120, k = 1 + Math.tanh(d * 1.4) * .12;
    nameEl.style.transform = `scale(${k.toFixed(3)})`; dim.textContent = `${landingCopy[LANG].snap} · ${Math.round(k * 100)}%`;
  });
  const end = () => { if (!st) return; st = null; nameEl.classList.add('spring'); nameEl.style.transform = ''; setTimeout(() => sel.classList.remove('dragging'), 350); };
  on(sel, 'pointerup', end); on(sel, 'pointercancel', end);

  function paintInsp() {
    $('.isz').textContent = Math.round(parseFloat(getComputedStyle(nameEl).fontSize)) + ' px';
    $('.ifill').textContent = isDark() ? '#F2F2FA' : '#15162E';
  }

  /* ---------- inspector history ---------- */
  const hpop = $('.hpop'), histOl = $('.hist ol');
  function renderHist() {
    const H = HIST[LANG];
    histOl.innerHTML = H.map((h, i) => `<li class="${i === H.length - 1 ? 'now' : ''}"><button data-k="${i}" aria-label="${esc(h[1])}"><i></i></button></li>`).join('');
    histOl.querySelectorAll('button').forEach(b => {
      const show = () => showHist(+b.dataset.k), off = () => { layer.classList.remove('quiet'); hpop.classList.remove('show'); histOl.querySelectorAll('li').forEach(l => l.classList.remove('on')); };
      b.addEventListener('pointerenter', show); b.addEventListener('focus', show); b.addEventListener('click', show);
      b.addEventListener('pointerleave', off); b.addEventListener('blur', off);
    });
  }
  function showHist(i) {
    const h = HIST[LANG][i];
    hpop.innerHTML = `<div class="hm"><b>${h[0] === 'now' ? (LANG === 'zh' ? '当前' : 'now') : (LANG === 'zh' ? '第 ' + h[0].slice(1) + ' 轮' : 'round ' + h[0].slice(1))}</b></div><h5>${esc(h[1])}</h5><div>${esc(h[2])}</div>${h[3].map(n => `<div class="note${n[2] ? ' ok' : ''}"><b>${n[0]}</b><span>${esc(n[1])}</span></div>`).join('')}<div class="cred">${CRED[LANG]}</div>`;
    const li = histOl.children[i], ib = $('.ec-insp').getBoundingClientRect(), lb = li.getBoundingClientRect();
    hpop.style.left = Math.max(0, lb.left - ib.left - 150) + 'px';
    histOl.querySelectorAll('li').forEach((l, k) => l.classList.toggle('on', k === i));
    hpop.classList.add('show'); layer.classList.add('quiet');
  }

  /* ---------- rulers ---------- */
  function rulers() {
    const rx = $('.ec-rx'); rx.querySelectorAll('span').forEach(s => s.remove());
    let html = ''; for (let x = 100; x < innerWidth; x += 100) html += `<span style="left:${x - 24}px">${x}</span>`;
    rx.insertAdjacentHTML('beforeend', html);
    const n = nameEl.getBoundingClientRect(), o = land.getBoundingClientRect();
    rx.querySelector('.hl').style.cssText = `left:${n.left - o.left - 24}px;width:${n.width}px`;
    $('.ec-ry .hl').style.cssText = `top:${n.top - o.top - 24}px;height:${n.height}px`;
  }

  /* ---------- fit: shrink hero type until it clears the tour guide (never overlaps) ---------- */
  function fit() {
    const left = $('.ec-left'), hero = $('.ec-hero'), zn = $('.ec-zhname');
    let f = 1; root.style.setProperty('--ec-fit', 1);
    const guide = getGuide(), gh = Math.max(guide && !guide.hidden && guide.dataset.state !== 'reading' ? guide.offsetHeight : 0, innerHeight < 860 ? 168 : 196);
    const limit = left.getBoundingClientRect().bottom - gh - 14;
    const over = () => (LANG === 'zh' && zn.getBoundingClientRect().right > left.getBoundingClientRect().right - 8) || hero.getBoundingClientRect().bottom > limit;
    while (over() && f > .66) { f -= .02; root.style.setProperty('--ec-fit', f.toFixed(2)); }
  }

  /* ---------- collaborator cursors ---------- */
  const rel = (target, ax = 0, ay = 0) => { const a = target.getBoundingClientRect(), b = layer.getBoundingClientRect(); return {x: a.left - b.left + a.width * ax, y: a.top - b.top + a.height * ay}; };
  const D = new Cursor('d', 'Designer', layer, motion), C = new Cursor('c', 'Critic', layer, motion);
  const bc = new Bubble(layer, 'c'), bd = new Bubble(layer, 'd');
  function home() {
    const tr = sel.querySelector('.h.tr'); if (!tr) return;
    const t = rel(tr, 1, 0), lim = rel($('.ec-win')).x - 110; D.place(Math.min(t.x + 4, lim), t.y + 10);
    const a = mb.querySelector('.node.loop .orbit'); if (a) { const p = rel(a, .5, 1); C.place(p.x - 14, p.y + 4); }
  }
  const F = {active: false, last: 0, tx: 0, ty: 0};
  on(land, 'pointermove', e => {
    if (!motion || paused) return;
    const b = layer.getBoundingClientRect();
    if (!F.active) { C.anim?.cancel(); D.anim?.cancel(); bc.hide(); bd.hide(); }
    F.active = true; F.last = performance.now(); F.tx = e.clientX - b.left; F.ty = e.clientY - b.top;
  });
  let raf = 0;
  const drift = () => {
    raf = 0; if (disposed || paused || !motion) return;
    if (F.active) {
      C.place(C.x + (F.tx + 46 - C.x) * .06, C.y + (F.ty + 34 - C.y) * .06);
      D.place(D.x + (F.tx - 120 - D.x) * .035, D.y + (F.ty + 70 - D.y) * .035);
      if (performance.now() - F.last > 2600) F.active = false;
    }
    raf = requestAnimationFrame(drift);
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function script() {
    const claim = () => $('.ec-claim b'), chip = () => $('.ec-chips').lastElementChild;
    const steps = [
      async () => { await D.moveTo(rel(claim(), 1, .5).x + 6, rel(claim(), 1, .5).y - 6, 1400); const p = rel(claim(), 1, 0); return ['d', NOTES[LANG].claim, p.x - 40, p.y - 44]; },
      async () => { const n = mb.querySelector('.node[data-id=ngc] .o'); if (n) { const p = rel(n, .5, .5); await C.moveTo(p.x + 4, p.y + 6, 1500); if (!user) showCard('ngc'); } return null; },
      async () => { if (!user) hideCard(); const p0 = rel(chip(), 1, .5); await D.moveTo(p0.x + 8, p0.y, 1400); const p = rel(chip(), 1, 0); return ['d', NOTES[LANG].chips, p.x - 40, p.y - 46]; },
      async () => { const n = mb.querySelector('.node.loop .orbit'); if (!n) return null; const p0 = rel(n, .5, 1); await C.moveTo(p0.x - 14, p0.y + 4, 1500); const p = rel(n, 0, 1); return ['c', NOTES[LANG].loop, p.x - 80, p.y + 34]; },
    ];
    let i = 0;
    while (!disposed) {
      if (F.active || user || paused || document.hidden) { await sleep(600); continue; }
      bc.hide(); bd.hide();
      const r = await steps[i++ % steps.length]();
      if (F.active || disposed) continue;
      if (r) { const [w, t, x, y] = r; (w === 'c' ? bc : bd).show(t, x, y, w === 'c' ? 'C' : 'D'); }
      await sleep(3200);
    }
  }

  /* ---------- language + layout ---------- */
  function applyText() {
    const t = strings(LANG);
    land.parentElement.querySelectorAll('[data-l]').forEach(e => { const v = t[e.dataset.l]; if (v != null) e.innerHTML = v; });
    land.setAttribute('aria-label', t.name);
    $('.ec-win')?.setAttribute('aria-label', t.map);
    host.querySelector('.ec-explore')?.setAttribute('aria-label', t.explore);
    host.querySelectorAll('.ec-cv').forEach(a => a.setAttribute('href', cvForLanguage(LANG)));
  }
  function layoutAll() { if (disposed || paused || !land.offsetWidth) return; fit(); buildMap(); paintInsp(); rulers(); home(); }
  const ro = new ResizeObserver(() => layoutAll()); ro.observe(mb); ro.observe(land);
  const guide = getGuide(); if (guide) ro.observe(guide);
  renderHist(); applyText();
  const ready = document.fonts?.ready || Promise.resolve();
  ready.then(() => requestAnimationFrame(() => {
    layoutAll();
    const P = new URLSearchParams(location.search);
    if (P.get('card')) { layer.classList.add('quiet'); showCard(P.get('card')); }
    if (P.get('hist')) showHist(+P.get('hist'));
    if (motion) { raf = requestAnimationFrame(drift); setTimeout(script, 2200); }
  }));
  const themeObserver = new MutationObserver(() => paintInsp()); themeObserver.observe(root, {attributes: true, attributeFilter: ['data-theme']});
  return {
    setLanguage(value) { LANG = value === 'zh' ? 'zh' : 'en'; applyText(); renderHist(); requestAnimationFrame(layoutAll); },
    setReducedMotion(value) { motion = !value && !matchMedia('(prefers-reduced-motion: reduce)').matches; land.classList.toggle('ec-motion', motion); D.motion = C.motion = motion; buildMap(); },
    refresh: () => requestAnimationFrame(layoutAll),
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; },
    resume() { if (!paused) return; paused = false; requestAnimationFrame(layoutAll); if (motion && !raf) raf = requestAnimationFrame(drift); },
    destroy() { disposed = true; ac.abort(); ro.disconnect(); themeObserver.disconnect(); cancelAnimationFrame(raf); },
  };
}
