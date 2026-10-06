// Progressive enhancement for the statically rendered blog pages. The pages are complete without this file;
// it adds the reading interactions (scrollspy, sidenotes, copy buttons, viewer, chart read-out, index preview).
// No post data is imported here: every post reaches the browser only as its own HTML page.
import './blog.css';
import {writePrefs} from './prefs.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const zh = root.lang === 'zh-CN';
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (en, cn) => zh ? cn : en;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3 3 7-7"/></svg>';

/* ---------------- chrome shared by both pages ---------------- */
function currentTheme() {
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
$('.theme-btn')?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next; writePrefs({theme: next});
});
// Switching language here is the same choice as on the homepage.
document.addEventListener('click', e => {
  const a = e.target.closest('[data-lang-switch]'); if (!a) return;
  writePrefs({lang: a.dataset.langSwitch});
  const i = currentSection();
  try { if (i >= 0) sessionStorage.setItem('blog.section', String(i)); } catch { /* optional */ }
});
// Old links: /blog/?post=<slug>.
const legacy = new URLSearchParams(location.search).get('post');
if (legacy && /^[a-z0-9-]+$/.test(legacy)) location.replace(`/blog/${legacy}/`);

const rul = () => parseFloat(getComputedStyle(root).getPropertyValue('--rul')) || 0;
function rulerStrip() {
  const strip = $('.ry .strip'); if (!strip) return;
  const H = Math.max(document.documentElement.scrollHeight, innerHeight) + 200;
  strip.innerHTML = Array.from({length: Math.ceil(H / 100)}, (_, i) => `<span style="top:${(i + 1) * 100 - 14}px">${(i + 1) * 100}</span>`).join('');
}
function syncRuler() {
  const strip = $('.ry .strip'); if (!strip) return;
  strip.style.transform = `translateY(${-scrollY}px)`;
  $('.ry').style.setProperty('--ry0', `${-scrollY}px`);
}
const hlX = (x0, x1) => { const hl = $('.rx .hl'); if (hl) Object.assign(hl.style, {left: `${x0 - rul()}px`, width: `${Math.max(0, x1 - x0)}px`}); };
const hlY = (y0, y1) => { const hl = $('.ry .hl'); if (hl) Object.assign(hl.style, {top: `${Math.max(0, y0 - rul())}px`, height: `${Math.max(0, Math.min(innerHeight, y1) - Math.max(rul(), y0))}px`}); };

let msgTimer = 0;
function status(text) {
  const el = $('.status .msg'); if (!el) return;
  el.innerHTML = `${CHECK}<span>${esc(text)}</span>`; el.classList.add('show');
  clearTimeout(msgTimer); msgTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); status(msg); }
  catch { status(T('Copy failed: select the text instead', '复制失败，请手动选择文字')); }
}
function flash(btn) {
  const label = $('span', btn), old = label?.textContent;
  btn.classList.add('done'); if (label) label.textContent = T('Copied', '已复制');
  setTimeout(() => { btn.classList.remove('done'); if (label) label.textContent = old; }, 1600);
}
// Buttons that only work with JavaScript are revealed here.
$$('.code-copy[hidden], .tex-copy[hidden], .fig-zoom[hidden], .chart-data[hidden]').forEach(b => { b.hidden = false; });

/* ---------------- index: split reader ---------------- */
function initIndex() {
  const rows = $$('.hi'), panels = new Map($$('.pv').map(p => [p.dataset.slug, p])), name = $('.pv-name');
  const select = li => {
    if (!li || li.classList.contains('on')) return;
    rows.forEach(r => r.classList.toggle('on', r === li));
    panels.forEach((p, slug) => { p.hidden = slug !== li.dataset.slug; });
    if (name) name.textContent = `${li.dataset.slug}.md`;
  };
  rows.forEach(li => {
    li.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') select(li); });
    li.addEventListener('focusin', () => select(li));
  });
  addEventListener('keydown', e => {
    if (e.target.closest('input')) return;
    if (e.key === '/') { e.preventDefault(); $('.filter input')?.focus(); return; }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const visible = rows.filter(r => !r.hidden), i = visible.findIndex(r => r.classList.contains('on'));
    const next = visible[Math.max(0, Math.min(visible.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) { e.preventDefault(); $('a', next).focus(); }
  });

  // Filter: words in the box match title, summary and tags (both languages); ?type ?work ?phase ?tag narrow it.
  const form = $('.filter'), input = $('.filter input'), active = $('.filter .active');
  const params = new URLSearchParams(location.search);
  const state = {q: params.get('q') || '', type: params.get('type') || '', work: params.get('work') || '', tag: params.get('tag') || '', phase: params.get('phase') || ''};
  if (input) input.value = state.q;
  const apply = () => {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const li of rows) {
      const ok = (!state.type || li.dataset.type === state.type) && (!state.work || li.dataset.work.split(' ').includes(state.work))
        && (!state.tag || li.dataset.tags.split(' ').includes(state.tag)) && (!state.phase || li.dataset.phase === state.phase)
        && words.every(w => li.dataset.search.includes(w));
      li.hidden = !ok; if (ok) shown++;
    }
    $('.ix .empty').hidden = shown > 0;
    $$('.filter .seg button').forEach(b => b.classList.toggle('on', b.dataset.type === state.type));
    const scoped = state.work ? state.work : state.tag ? `#${state.tag}` : state.phase ? state.phase : '';
    if (active) { active.hidden = !scoped; active.innerHTML = scoped ? `${esc(scoped)}<button type="button" aria-label="${T('Clear', '清除')}">✕</button>` : ''; }
    const first = rows.find(r => !r.hidden); if (first && $('.hi.on')?.hidden !== false) select(first);
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(state)) if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
    history.replaceState(null, '', u);
  };
  input?.addEventListener('input', () => { state.q = input.value; apply(); });
  form?.addEventListener('submit', e => e.preventDefault());
  form?.addEventListener('click', e => {
    const b = e.target.closest('.seg button'); if (b) { state.type = b.dataset.type; apply(); }
    if (e.target.closest('.active button')) { state.work = state.tag = state.phase = ''; apply(); }
  });
  if (Object.values(state).some(Boolean)) apply();

  const place = () => {
    const s = $('.ttl .sel')?.getBoundingClientRect(); if (!s) return;
    hlX(s.left - 14, s.right + 14); hlY(s.top - 8, s.bottom + 6);
  };
  const cur = $('.ix .ttl .cur');
  if (cur && motion && cur.animate) cur.animate([{transform: 'translate(170px,120px)', opacity: 0}, {transform: 'translate(20px,0)', opacity: 1}], {duration: 1300, easing: 'cubic-bezier(.45,.05,.2,1)'});
  document.fonts?.ready.then(place); addEventListener('resize', place); place();
  addEventListener('scroll', place, {passive: true});
}

/* ---------------- article ---------------- */
let sections = [];
function currentSection() {
  if (!sections.length) return -1;
  let act = -1; const line = innerHeight * .3;
  sections.forEach((s, i) => { if (s.h.getBoundingClientRect().top < line) act = i; });
  return act;
}

function initArticle() {
  const body = $('#post-body'), board = $('.board'), head = $('.head');
  sections = $$('h2[id]', body).map(h => ({h, id: h.id, n: $('.h-anchor .num', h)?.textContent || '', title: [...h.childNodes].filter(n => !(n.classList?.contains('h-anchor'))).map(n => n.textContent).join('')}));
  const tocItems = $$('.toc > li');

  // The title's selection box hugs its longest line; the Designer cursor rests on the right-middle handle.
  const hug = () => {
    const h1 = $('.head .h1'), sel = h1?.closest('.sel'); if (!sel) return;
    sel.style.width = '';
    const r = document.createRange(); r.selectNodeContents(h1);
    const rects = [...r.getClientRects()]; if (!rects.length) return;
    const width = Math.ceil(Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left)) + 4);
    sel.style.width = `${width}px`;
    const ttl = $('.head .ttl'), tr = ttl.getBoundingClientRect(), sr = sel.getBoundingClientRect();
    ttl.style.setProperty('--cx', `${sr.right - tr.left + 6}px`); ttl.style.setProperty('--cy', `${sr.top - tr.top + sr.height / 2 - 4}px`);
  };
  const cur = $('.head .cur');
  if (cur && motion && cur.animate) cur.animate([{opacity: 0, translate: '120px 90px'}, {opacity: 1, translate: '0 0'}], {duration: 1200, easing: 'cubic-bezier(.45,.05,.2,1)'});

  // Sidenotes and Critic/Designer notes share the margin column; they stack without overlapping.
  const wide = () => getComputedStyle(root).getPropertyValue('--mcol').trim() !== '0px';
  const layoutMargin = () => {
    const items = [], top = body.getBoundingClientRect().top;
    if (wide()) {
      $$('.sn', body).forEach(sn => {
        const ref = $(`#fnref-${sn.dataset.n}`), lh = parseFloat(getComputedStyle(ref.closest('p,li') || body).lineHeight) || 30, r = ref.getBoundingClientRect();
        items.push({el: sn, y: r.top - top + r.height / 2 - lh / 2 + (lh - 21) / 2});
      });
      $$('.anno', body).forEach(a => { const next = a.nextElementSibling; if (next) items.push({el: a, y: ($('.fig-frame', next) || next).getBoundingClientRect().top - top - 2}); });
    }
    items.sort((a, b) => a.y - b.y);
    let bottom = -Infinity;
    for (const it of items) { const y = Math.max(it.y, bottom + 16); it.el.style.top = `${y}px`; bottom = y + it.el.offsetHeight; }
    if (!wide()) $$('.sn, .anno', body).forEach(el => { el.style.top = ''; });
  };
  $$('.fn-ref', body).forEach(ref => ref.addEventListener('click', e => {
    e.preventDefault();
    const sn = $(`#fn-${ref.dataset.n}`);
    if (wide()) { sn.classList.remove('flash'); void sn.offsetWidth; sn.classList.add('flash'); }
    else { const open = sn.classList.toggle('open'); ref.classList.toggle('on', open); ref.setAttribute('aria-expanded', String(open)); }
  }));

  // Copy: section links, code, TeX, citation.
  $$('.h-anchor', body).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1), n = $('.num', a)?.textContent;
    history.replaceState(null, '', `#${id}`);
    document.getElementById(id).scrollIntoView({behavior: motion ? 'smooth' : 'auto'});
    copyText(location.href, `${T('Link copied', '链接已复制')}${n ? ` · §${n}` : ''}`);
  }));
  $$('.code .code-copy', body).forEach(b => b.addEventListener('click', () => {
    const code = b.closest('.code'), lines = $$('.ln', code).map(l => l.textContent);
    copyText(lines.join('\n'), `${T(`Copied ${lines.length} lines`, `已复制 ${lines.length} 行`)} · ${code.dataset.file.split('/').pop()}`); flash(b);
  }));
  $$('.tex-copy', body).forEach(b => b.addEventListener('click', () => copyText(b.closest('.math').dataset.tex, T('TeX copied', 'TeX 已复制'))));
  const cite = $('.cite');
  if (cite) {
    $$('.cite-tab', cite).forEach(tab => tab.addEventListener('click', () => {
      $$('.cite-tab', cite).forEach(x => x.setAttribute('aria-selected', String(x === tab)));
      $$('pre', cite).forEach(p => { p.hidden = p.dataset.f !== tab.dataset.f; });
    }));
    $('.code-copy', cite).addEventListener('click', e => {
      const pre = $$('pre', cite).find(p => !p.hidden);
      copyText(pre.textContent, pre.dataset.f === 'bib' ? T('BibTeX copied', 'BibTeX 已复制') : T('Citation copied', '引用已复制')); flash(e.currentTarget);
    });
  }
  $$('a.xref', body).forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); history.replaceState(null, '', a.getAttribute('href'));
    el.scrollIntoView({behavior: motion ? 'smooth' : 'auto', block: 'center'});
    el.classList.remove('target'); void el.offsetWidth; el.classList.add('target');
  }));
  $$('.toc .kids a').forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); el.scrollIntoView({behavior: motion ? 'smooth' : 'auto', block: 'center'});
  }));
  $('.toc-btn')?.addEventListener('click', () => { const on = root.classList.toggle('toc-open'); $('.toc-btn').setAttribute('aria-expanded', String(on)); });
  $('#rail')?.addEventListener('click', e => { if (e.target.closest('a')) { root.classList.remove('toc-open'); $('.toc-btn')?.setAttribute('aria-expanded', 'false'); } });
  $$('a[href="#top"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', location.pathname); scrollTo({top: 0, behavior: motion ? 'smooth' : 'auto'}); }));

  initViewer(body);
  $$('.chart', body).forEach(initChart);

  // Scroll: progress, scrollspy (Layers, status bar, left ruler), header cursor fade.
  const pct = $('.rail-prog .pct'), track = $('.rail-prog .track i'), left = $('.rail-prog .left'), mins = +(left?.dataset.min || 1);
  const where = $('.status .sec');
  let lastAct = -2;
  const onScroll = () => {
    root.classList.toggle('scrolled', scrollY > 8);
    syncRuler();
    if (cur) { const o = Math.max(0, 1 - scrollY / 300); cur.style.opacity = String(o); cur.classList.toggle('gone', o === 0); }
    const r = body.getBoundingClientRect(), total = r.height - innerHeight * .55;
    const p = Math.min(1, Math.max(0, (-r.top + innerHeight * .3) / Math.max(1, total)));
    if (pct) pct.textContent = `${Math.round(p * 100)}%`;
    if (track) track.style.transform = `scaleX(${p})`;
    if (left) { const m = Math.max(0, Math.ceil(mins * (1 - p))); left.textContent = p >= .995 ? T('Finished', '读完了') : zh ? `还剩 ${m} 分钟` : `${m} min left`; }
    const act = currentSection();
    if (act !== lastAct) {
      lastAct = act;
      tocItems.forEach(li => {
        const i = sections.findIndex(s => s.id === li.dataset.id), isH2 = li.classList.contains('h2');
        li.classList.toggle('on', i === act && i >= 0);
        li.classList.toggle('read', isH2 && act >= 0 && i >= 0 && i < act);
      });
      $('.rail-frame')?.classList.toggle('on', act < 0);
      const s = sections[act];
      if (where) where.innerHTML = s ? `<span class="n">${esc(s.n)}</span> <b>${esc(s.title)}</b>` : `<span class="n">00</span> <b>${T('Introduction', '引言')}</b>`;
    }
    if (rul()) {
      const s = sections[act], next = sections[act + 1]?.h || $('#post-end');
      hlY((s ? s.h : head).getBoundingClientRect().top, next.getBoundingClientRect().top);
    }
  };
  const layout = () => {
    hug(); layoutMargin(); rulerStrip();
    const c = body.getBoundingClientRect(); hlX(c.left, c.right);
    const b = board.getBoundingClientRect(), sz = $('.frame-label .sz');
    if (sz) sz.textContent = `${Math.round(b.width)} × ${Math.round(b.height).toLocaleString('en-US')}`;
    onScroll();
  };
  addEventListener('scroll', onScroll, {passive: true});
  let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); });
  layout(); document.fonts?.ready.then(layout);
  new ResizeObserver(() => layout()).observe(body);
  // Arriving from the other language version: return to the same section.
  try {
    const saved = sessionStorage.getItem('blog.section'), i = saved === null ? -1 : +saved; sessionStorage.removeItem('blog.section');
    if (!location.hash && i >= 0 && sections[i]) requestAnimationFrame(() => sections[i].h.scrollIntoView());
  } catch { /* optional */ }
}

/* figure viewer: read-only zoom and pan */
function initViewer(body) {
  const viewer = $('.viewer'); if (!viewer) return;
  const art = $('.vart', viewer), stage = $('.vstage', viewer), pctEl = $('.pct', viewer);
  const v = {s: 1, x: 0, y: 0, fit: 1, w: 0, h: 0, origin: null};
  const set = (s, center) => {
    v.s = Math.max(.25, Math.min(4, s)); if (center) { v.x = 0; v.y = 0; }
    art.style.transform = `translate(${v.x - v.w * v.s / 2}px,${v.y - v.h * v.s / 2}px) scale(${v.s})`;
    pctEl.textContent = `${Math.round(v.s * 100)}%`;
  };
  const open = fig => {
    const src = $('.fig-art', fig); art.innerHTML = src.innerHTML;
    $('.t', viewer).innerHTML = `${esc(fig.dataset.label)} <i>· ${esc(fig.dataset.file)}</i>`;
    $('.vcap', viewer).innerHTML = $('figcaption', fig)?.innerHTML || '';
    viewer.hidden = false; document.body.style.overflow = 'hidden'; v.origin = document.activeElement;
    const el = $('svg, img', art), vb = el.viewBox?.baseVal, w = vb?.width || el.naturalWidth || 800, h = vb?.height || el.naturalHeight || 500;
    v.w = w + 56; v.h = h + 56; art.style.width = `${v.w}px`;
    const sr = stage.getBoundingClientRect(); v.fit = Math.min((sr.width - 80) / v.w, (sr.height - 40) / v.h, 2.5);
    set(v.fit, true); $('[data-v=close]', viewer).focus();
  };
  const close = () => { viewer.hidden = true; document.body.style.overflow = ''; v.origin?.focus?.(); };
  $$('.fig[data-zoom]', body).forEach(fig => {
    $('.fig-art', fig).addEventListener('click', () => open(fig));
    $('.fig-art', fig).addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(fig); } });
    $('.fig-zoom', fig)?.addEventListener('click', () => open(fig));
  });
  viewer.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    ({in: () => set(v.s * 1.25), out: () => set(v.s / 1.25), fit: () => set(v.fit, true), 100: () => set(1, true), close})[b.dataset.v]();
  });
  let drag = null;
  stage.addEventListener('pointerdown', e => { drag = {x: e.clientX - v.x, y: e.clientY - v.y}; stage.classList.add('drag'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!drag) return; v.x = e.clientX - drag.x; v.y = e.clientY - drag.y; set(v.s); });
  stage.addEventListener('pointerup', () => { drag = null; stage.classList.remove('drag'); });
  stage.addEventListener('wheel', e => { e.preventDefault(); set(v.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, {passive: false});
  addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === '+' || e.key === '=') set(v.s * 1.25);
    if (e.key === '-') set(v.s / 1.25);
    if (e.key === '0') set(v.fit, true);
    if (e.key === 'Tab') { const f = $$('button', viewer), i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });
}

/* charts: crosshair + read-out over the static SVG, arrow keys, and the Data toggle */
function initChart(fig) {
  let d; try { d = JSON.parse(fig.dataset.hover); } catch { return; }
  const svg = $('.plot svg', fig), tip = $('.tip', fig), cross = $('.xhair', svg), btn = $('.chart-data', fig);
  btn?.addEventListener('click', () => {
    const on = fig.classList.toggle('show-table'); btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? T('Chart', '图表') : T('Data', '数据');
  });
  const NS = 'http://www.w3.org/2000/svg';
  const dots = d.line ? d.ys.map((_, si) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '4.5'); c.setAttribute('class', 'hdot'); c.style.fill = `var(--rd-series-${si + 1})`; c.setAttribute('visibility', 'hidden'); svg.append(c); return c; }) : [];
  const bars = $$('.bar-r', svg);
  let act = -1;
  const show = i => {
    act = i; const x = d.xs[i];
    if (d.line) {
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dots.forEach((c, si) => { const y = d.ys[si][i]; c.setAttribute('visibility', y === null ? 'hidden' : 'visible'); if (y !== null) { c.setAttribute('cx', x); c.setAttribute('cy', y); } });
    } else bars.forEach(b => b.classList.toggle('dim', +b.dataset.i !== i));
    tip.innerHTML = `<strong>${esc(d.x[i])}</strong>${d.names.map((n, si) => `<span><i style="--c:var(--rd-series-${si + 1})"></i>${esc(n)}<b>${esc(d.vals[si][i])}</b></span>`).join('')}`;
    tip.hidden = false;
    const r = svg.getBoundingClientRect(), k = r.width / d.w, tw = tip.offsetWidth;
    const ys = d.ys.map(s => s[i]).filter(y => y !== null), top = d.line ? Math.min(...ys) : 20;
    let leftPx = x * k + 14; if (leftPx + tw > d.r * k + 6) leftPx = Math.max(0, x * k - tw - 14);
    tip.style.transform = `translate(${leftPx}px,${Math.max(0, top * k - 20)}px)`;
  };
  const hide = () => { act = -1; cross.setAttribute('visibility', 'hidden'); dots.forEach(c => c.setAttribute('visibility', 'hidden')); bars.forEach(b => b.classList.remove('dim')); tip.hidden = true; };
  const near = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / (r.width / d.w); let b = 0; d.xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(d.xs[b] - x)) b = i; }); return b; };
  svg.addEventListener('pointermove', e => { const i = near(e); if (i !== act) show(i); });
  svg.addEventListener('pointerdown', e => show(near(e)));
  svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return; e.preventDefault();
    if (e.key === 'Escape') return hide();
    const n = d.xs.length;
    show(e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, (act < 0 ? 0 : act) + (e.key === 'ArrowRight' ? 1 : -1))));
  });
}

/* ---------------- boot ---------------- */
rulerStrip(); syncRuler();
addEventListener('scroll', () => { root.classList.toggle('scrolled', scrollY > 8); syncRuler(); }, {passive: true});
if (root.classList.contains('page-index')) initIndex();
if (root.classList.contains('page-post')) initArticle();
