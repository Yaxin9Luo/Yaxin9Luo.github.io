// Per-page CJK font subsets for the blog (build time, self-hosted).
// Each page gets up to four tiny faces holding exactly the Chinese characters it shows in that role:
//   Blog SC Sans 400 (body, UI), Blog SC Sans 700 (strong, th, h3…), Blog SC Serif 700 (titles), Blog SC Serif 400 (pull quotes).
// Faces cover only CJK code points (plus curly quotes on Chinese pages), so Latin text keeps the EC / Source Serif faces.
// Without the source fonts (offline, first run) pages fall back to the reader's system CJK fonts; the build says so.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';
import {readSource} from '../../../../scripts/fonts/sources.mjs';

const CJK_RANGE = 'U+2E80-2FFF,U+3000-303F,U+3040-30FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF';
const ZH_PUNCT = '‘’“”…—·';
const ZH_PUNCT_RANGE = 'U+00B7,U+2014,U+2018-2019,U+201C-201D,U+2026';
const isCJK = c => /[⺀-⿿　-〿぀-ヿ㐀-䶿一-鿿豈-﫿︰-﹏＀-￯]/u.test(c);

export const FACES = {
  sans400: {family: 'Blog SC Sans', weight: 400, source: 'sansSC', wght: 400},
  sans700: {family: 'Blog SC Sans', weight: 700, source: 'sansSC', wght: 700},
  serif700: {family: 'Blog SC Serif', weight: 700, source: 'serifSC', wght: 700},
  serif400: {family: 'Blog SC Serif', weight: 400, source: 'serifSC', wght: 400},
};
const SERIF_TAGS = new Set(['h1', 'h2', 'h5']), BOLD_TAGS = new Set(['strong', 'b', 'th', 'h3', 'h4']);
const SERIF_CLASS = /\b(fs|ly-mt|h1)\b/, BOLD_CLASS = /\b(callout-title|read|ly-n|ly-l|anno-tag|byline)\b/;
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'source', 'col', 'area', 'base', 'embed', 'param', 'track', 'path', 'circle', 'rect', 'line']);

/** The CJK characters a page renders in each face, from its <body> markup. */
export function pageChars(html, {zh = false} = {}) {
  const sets = {sans400: new Set(), sans700: new Set(), serif700: new Set(), serif400: new Set()};
  const body = html.slice(html.indexOf('<body'));
  const stack = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[5] !== undefined) {
      if (stack.some(s => s.tag === 'script' || s.tag === 'style')) continue;
      const text = m[5].replace(/&[a-z]+;|&#\d+;/g, ' ');
      const chars = [...text].filter(c => isCJK(c) || (zh && ZH_PUNCT.includes(c)));
      if (!chars.length) continue;
      const serif = stack.some(s => s.serif), bold = stack.some(s => s.bold), quote = stack.some(s => s.tag === 'blockquote');
      for (const c of chars) {
        sets.sans400.add(c);
        if (serif) sets.serif700.add(c); else if (quote && zh) sets.serif400.add(c);
        if (bold) sets.sans700.add(c);
      }
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) { const i = stack.map(s => s.tag).lastIndexOf(tag); if (i >= 0) stack.length = i; continue; }
    if (VOID.has(tag) || m[4]) continue;
    const cls = (m[3].match(/class="([^"]*)"/) || [])[1] || '';
    stack.push({tag, serif: SERIF_TAGS.has(tag) || SERIF_CLASS.test(cls), bold: BOLD_TAGS.has(tag) || BOLD_CLASS.test(cls)});
  }
  return Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, [...s].sort().join('')]));
}

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 10);

/**
 * Subset, cache and write the faces one page needs. Returns {css, preload, files: [{file, chars}]} or null when the
 * sources are unavailable. Identical subsets are shared between pages (same name, written once).
 */
export async function pageFonts(chars, {zh, outDir, cacheDir, extra = {}}) {
  const css = [], preload = [], files = [];
  for (const [key, face] of Object.entries(FACES)) {
    const text = [...new Set([...(chars[key] || ''), ...(extra[key] || '')])].sort().join('');
    if (!text) continue;
    const src = readSource(face.source);
    if (!src) return null;
    const id = hash(`${key}:${face.wght}:${text}`), name = `${key}-${id}.woff2`;
    const cached = path.join(cacheDir, name), target = path.join(outDir, name);
    if (!fs.existsSync(cached)) {
      fs.mkdirSync(cacheDir, {recursive: true});
      fs.writeFileSync(cached, await subsetFont(src, text, {targetFormat: 'woff2', variationAxes: {wght: face.wght}}));
    }
    if (!fs.existsSync(target)) { fs.mkdirSync(outDir, {recursive: true}); fs.copyFileSync(cached, target); }
    const url = `/blog/fonts/${name}`;
    css.push(`@font-face{font-family:"${face.family}";font-weight:${face.weight};font-display:swap;src:url(${url}) format("woff2");unicode-range:${CJK_RANGE}${zh ? ',' + ZH_PUNCT_RANGE : ''}}`);
    if (key === 'sans400' || key === 'serif700') preload.push(`<link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin>`);
    files.push({file: name, url, chars: text, family: face.family, weight: face.weight});
  }
  return {css: css.length ? `<style>${css.join('\n')}</style>` : '', preload: preload.join('\n'), files};
}
