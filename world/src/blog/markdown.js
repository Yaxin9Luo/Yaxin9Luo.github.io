// Build-time Markdown → HTML for posts (Node only; nothing here ships to the browser).
// Beyond GFM: $…$ / $$…$$ math (KaTeX, numbered and linkable), footnotes as margin sidenotes, titled images as
// artboard figures, ```chart blocks, code windows with file names and highlighted lines, GitHub callouts plus the
// authored > [!CRITIC] / > [!DESIGNER] margin notes, numbered H2s with copyable anchors, and curly quotes.
import {Marked} from 'marked';
import katex from 'katex';
import hljs from 'highlight.js';
import {esc, smartQuotes, stripCjkSpaces, wordBreaks} from './text.js';
import {validateSpec, chartBlock} from './chart.js';

export const MAX_MARGIN_NOTES = 2;

// Heading ids keep CJK characters so Chinese headings get readable anchors too.
export function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
}

export const hasMath = body => /\$\$[\s\S]+?\$\$|\$(?=\S)[^$\n]*?\S\$/.test(body.replace(/```[\s\S]*?```|`[^`\n]*`/g, ''));

const ICON = {
  frame: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5v13M11 1.5v13M1.5 5h13M1.5 11h13"/></svg>',
  zoom: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.8C3 3.1 3.6 2.5 4.3 2.5H10.5"/></svg>',
  file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/></svg>',
  note: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v4M8 4.8v.1"/></svg>',
  cursor: '<svg viewBox="0 0 16 22" aria-hidden="true"><path d="M1.5 1.5 14 12.2l-5.6.6 3.2 6.4-2.3 1.1-3.1-6.5-4.2 3.9z"/></svg>',
};
const CALLOUT = {
  NOTE: ['Note', '注'], TIP: ['Tip', '提示'], WARNING: ['Warning', '注意'], IMPORTANT: ['Important', '要点'],
  CRITIC: ['Critic', 'Critic'], DESIGNER: ['Designer', 'Designer'],
};

// Split highlight.js output into lines, closing and reopening spans that cross a line break.
function htmlLines(html) {
  const lines = [], open = [];
  let cur = '';
  for (const part of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (!part) continue;
    if (part === '\n') { lines.push(cur + '</span>'.repeat(open.length)); cur = open.join(''); }
    else if (part.startsWith('<span')) { open.push(part); cur += part; }
    else if (part === '</span>') { open.pop(); cur += part; }
    else cur += part;
  }
  lines.push(cur);
  return lines;
}
const ranges = spec => new Set(String(spec || '').split(',').flatMap(r => { const [a, b = a] = r.split('-').map(Number); return a && b >= a ? Array.from({length: b - a + 1}, (_, i) => a + i) : []; }));

/**
 * Render one language version of a post.
 * `images(src)` returns {width, height, svg?} for local images (svg = inline markup to theme with CSS).
 * Returns the HTML plus the outline the Layers panel and the index preview need.
 */
export function renderPost(body, {lang = 'en', images = () => null} = {}) {
  const zh = lang === 'zh', L = (en, cn) => zh ? cn : en;
  const source = zh ? stripCjkSpaces(body) : body;
  const sections = []; // {id, n, level, title, kids: [{kind, label, id}]}
  const blocks = []; // figures, charts and tables in order (for the index preview)
  const ids = new Set();
  let fig = 0, tbl = 0, eq = 0, notes = 0, h2 = 0;
  const kid = item => { const s = [...sections].reverse().find(x => x.level === 2); if (s) s.kids.push(item); };
  const uniqueId = base => { let id = base, i = 2; while (ids.has(id)) id = `${base}-${i++}`; ids.add(id); return id; };

  // Footnote definitions ([^id]: text) become sidenotes placed right after their reference.
  const defs = new Map();
  const text = source.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.+)$/gm, (_, id, note) => { defs.set(id, note.trim()); return ''; });
  const order = new Map();

  const quotes = {open: false};
  const marked = new Marked({gfm: true});
  const tex = (src, displayMode) => katex.renderToString(src, {displayMode, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore'});
  marked.use({
    walkTokens(token) {
      if ((token.type === 'text' || token.type === 'escape') && !token.tokens && typeof token.text === 'string') token.text = smartQuotes(token.text, lang, quotes);
    },
    extensions: [
      {name: 'mathBlock', level: 'block',
        start: src => src.match(/^\$\$/m)?.index,
        tokenizer(src) { const m = src.match(/^\$\$\s*\n?([\s\S]+?)\n?\s*\$\$[ \t]*(?:\n+|$)/); if (m) return {type: 'mathBlock', raw: m[0], text: m[1].trim()}; },
        renderer(token) {
          eq++;
          let src = token.text, id = `eq-${eq}`;
          src = src.replace(/\\label\{([^}]+)\}/, (_, name) => { id = `eq-${slugify(name.replace(/^eq:/, ''))}`; return ''; }).replace(/\\tag\{[^}]*\}/, '').trim();
          id = uniqueId(id);
          kid({kind: 'eq', label: `${L('Equation', '式')} (${eq})`, id});
          return `<div class="math" id="${id}" data-tex="${esc(src)}">${tex(src, true)}<button class="tex-copy" type="button" hidden>TeX</button><a class="eq-num" href="#${id}" aria-label="${L('Equation', '式')} ${eq}">(${eq})</a></div>\n`;
        }},
      {name: 'mathInline', level: 'inline',
        start: src => { const i = src.indexOf('$'); return i >= 0 ? i : undefined; },
        tokenizer(src) { const m = src.match(/^\$(?!\$)(?=\S)((?:\\.|[^\\\n$])*?\S)\$(?!\d)/); if (m) return {type: 'mathInline', raw: m[0], text: m[1]}; },
        renderer: token => tex(token.text, false)},
      {name: 'fnRef', level: 'inline',
        start: src => { const i = src.indexOf('[^'); return i >= 0 ? i : undefined; },
        tokenizer(src) {
          const m = src.match(/^\[\^([^\]\s]+)\]/);
          if (m && defs.has(m[1])) return {type: 'fnRef', raw: m[0], id: m[1], tokens: this.lexer.inlineTokens(defs.get(m[1]))};
        },
        renderer(token) {
          if (!order.has(token.id)) order.set(token.id, ++notes);
          const n = order.get(token.id);
          return `<a class="fn-ref" href="#fn-${n}" id="fnref-${n}" data-n="${n}" aria-describedby="fn-${n}">${n}</a><span class="sn" id="fn-${n}" data-n="${n}" role="note"><span class="sn-n">${n}</span>${this.parser.parseInline(token.tokens)}</span>`;
        }},
    ],
    renderer: {
      heading(token) {
        const inner = this.parser.parseInline(token.tokens), plain = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').replace(/&quot;/g, '"').trim();
        if (token.depth > 3) return `<h${token.depth}>${inner}</h${token.depth}>\n`;
        const id = uniqueId(slugify(plain));
        if (token.depth === 2) {
          const n = String(++h2).padStart(2, '0');
          sections.push({id, n, level: 2, title: plain, kids: []});
          const shown = zh && !/<(?!wbr)/.test(inner) ? wordBreaks(plain) : inner;
          return `<h2 id="${id}"><a class="h-anchor" href="#${id}" aria-label="${L('Copy link to section', '复制本节链接')} ${n}"><span class="num">${n}</span><span class="hash">#</span></a>${shown}</h2>\n`;
        }
        if (token.depth === 3) sections.push({id, n: '', level: 3, title: plain, kids: []});
        return `<h${token.depth} id="${id}"><a class="h-anchor" href="#${id}" aria-label="${L('Copy link to section', '复制本节链接')}"><span class="hash">#</span></a>${inner}</h${token.depth}>\n`;
      },
      paragraph(token) {
        const only = token.tokens?.filter(t => !(t.type === 'text' && !t.text.trim()));
        if (only?.length !== 1 || only[0].type !== 'image') return false;
        const img = only[0], info = images(img.href) || {}, n = ++fig, label = `${L('Figure', '图')} ${n}`, id = `fig-${n}`;
        const caption = (img.title || '').replace(/^(?:Figure|Fig\.)\s*\d+[.:]\s*|^图\s*\d+\s*[：:.．]\s*/, '');
        const file = img.href.split('/').pop().replace(/\.(en|zh)\.svg$/, '.svg');
        const size = info.width ? `${info.width} × ${info.height}` : '';
        kid({kind: 'fig', label, id}); blocks.push({kind: 'figure', label, id, src: img.href, svg: info.svg || null});
        const art = info.svg
          ? info.svg.replace(/^<svg\b/, `<svg role="img" aria-label="${esc(img.text)}"`)
          : `<img src="${esc(img.href)}" alt="${esc(img.text)}"${info.width ? ` width="${info.width}" height="${info.height}"` : ''} loading="lazy" decoding="async">`;
        return `<figure class="fig" id="${id}" data-label="${esc(label)}" data-file="${esc(file)}" data-zoom><div class="fig-head">${ICON.frame}<b>${esc(label)}</b><span>· ${esc(file)}</span>${size ? `<span class="sz">${size}</span>` : ''}</div>`
          + `<div class="fig-frame"><div class="fig-art" tabindex="0" role="button" aria-label="${L('Zoom', '放大')} ${esc(label)}">${art}</div><button class="fig-zoom" type="button" tabindex="-1" hidden>${ICON.zoom}<span>${L('Zoom', '放大')}</span></button></div>`
          + `${caption ? `<figcaption><b>${esc(label)}${zh ? '' : '.'}</b>${marked.parseInline(zh ? stripCjkSpaces(caption) : caption)}</figcaption>` : ''}</figure>\n`;
      },
      code(token) {
        const [langName = '', ...meta] = (token.lang || '').trim().split(/\s+/);
        if (langName === 'chart') {
          let spec;
          try { spec = validateSpec(JSON.parse(token.text)); } catch (error) { throw new Error(`Chart block: ${error.message}`); }
          const n = ++fig, label = `${L('Figure', '图')} ${n}`, id = `fig-${n}`;
          kid({kind: 'chart', label, id}); blocks.push({kind: 'chart', label, id, spec});
          return chartBlock(spec, {lang, label, id}) + '\n';
        }
        const opts = Object.fromEntries(meta.map(m => m.split('=')).filter(p => p.length === 2));
        const language = hljs.getLanguage(langName) ? langName : 'plaintext';
        const hl = ranges(opts.hl), file = opts.file || (langName ? `snippet.${{python: 'py', javascript: 'js', typescript: 'ts', bash: 'sh', shell: 'sh', yaml: 'yml'}[langName] || langName}` : 'snippet.txt');
        const lines = htmlLines(hljs.highlight(token.text, {language, ignoreIllegals: true}).value);
        const id = uniqueId(`code-${slugify(file.split('/').pop())}`);
        kid({kind: 'code', label: file.split('/').pop(), id});
        return `<figure class="code" id="${id}" data-file="${esc(file)}"><div class="code-bar"><span class="wdots" aria-hidden="true"><i></i><i></i><i></i></span><span class="code-file">${ICON.file}${esc(file)}</span>${langName ? `<span class="code-lang">${esc(langName)}</span>` : ''}<button class="code-copy" type="button" hidden>${ICON.copy}<span>${L('Copy', '复制')}</span></button></div>`
          + `<pre><code>${lines.map((l, i) => `<span class="ln${hl.has(i + 1) ? ' hl' : ''}" data-n="${i + 1}">${l || ' '}</span>`).join('')}</code></pre></figure>\n`;
      },
      table(token) {
        const n = ++tbl, label = `${L('Table', '表')} ${n}`, id = `table-${n}`;
        kid({kind: 'table', label, id}); blocks.push({kind: 'table', label, id, size: `${token.header.length} × ${token.rows.length}`});
        const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        // Numeric columns align right in tabular figures.
        const numeric = token.header.map((_, i) => token.rows.length > 0 && token.rows.every(r => /^[\s\d.,%×x—–+-]*$/.test(r[i].text) && /\d/.test(r[i].text)));
        const cls = i => numeric[i] ? ' class="num"' : '';
        return `<figure class="tbl" id="${id}" data-label="${esc(label)}"><div class="tbl-wrap"><table><thead><tr>${token.header.map((c, i) => cell(c, 'th').replace('<th', `<th${cls(i)}`)).join('')}</tr></thead><tbody>${token.rows.map(r => `<tr>${r.map((c, i) => cell(c, 'td').replace('<td', `<td${cls(i)}`)).join('')}</tr>`).join('')}</tbody></table></div></figure>\n`;
      },
      blockquote(token) {
        const inner = this.parser.parse(token.tokens);
        const m = inner.match(/^<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CRITIC|DESIGNER)\][ \t]*(?:<br>)?\n?/);
        if (!m) return `<blockquote>\n${inner}</blockquote>\n`;
        const kind = m[1], rest = inner.slice(m[0].length).replace(/^<\/p>\n?/, ''), body = rest.startsWith('<') ? rest : `<p>${rest}`;
        if (kind === 'CRITIC' || kind === 'DESIGNER') {
          const who = CALLOUT[kind][0], k = kind.toLowerCase();
          return `<aside class="anno anno-${k}" aria-label="${who} ${L('note', '批注')}"><div class="anno-tag">${ICON.cursor}<b>${who}</b><small>${L('note', '批注')}</small></div>${body}</aside>\n`;
        }
        return `<aside class="callout" data-kind="${kind.toLowerCase()}"><p class="callout-title">${ICON.note}<span>${CALLOUT[kind][zh ? 1 : 0]}</span></p>${body}</aside>\n`;
      },
      link(token) {
        const inner = this.parser.parseInline(token.tokens), href = token.href || '';
        const title = token.title ? ` title="${esc(token.title)}"` : '';
        if (/^https?:\/\//.test(href) && !href.startsWith('https://yaxin9luo.github.io/')) return `<a class="ext" href="${esc(href)}"${title} target="_blank" rel="noopener">${inner}</a>`;
        if (/^#(eq|fig|table|code)-/.test(href)) return `<a class="xref" href="${esc(href)}"${title}>${inner}</a>`;
        return `<a href="${esc(href)}"${title}>${inner}</a>`;
      },
      hr: () => '<hr>\n',
    },
  });

  const html = marked.parse(text);
  const margin = (html.match(/<aside class="anno /g) || []).length;
  if (margin > MAX_MARGIN_NOTES) throw new Error(`At most ${MAX_MARGIN_NOTES} Critic / Designer notes per post (found ${margin})`);
  const unused = [...defs.keys()].filter(id => !order.has(id));
  if (unused.length) throw new Error(`Footnote defined but never referenced: [^${unused[0]}]`);
  return {html, sections, blocks, notes, equations: eq, math: eq > 0 || /class="katex"/.test(html)};
}
