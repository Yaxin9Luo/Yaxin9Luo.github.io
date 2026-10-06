// Typography helpers shared by the build (Node) and, where noted, the browser.
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export const CJK = '\\u2e80-\\u2eff\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';
const HAS_CJK = new RegExp(`[${CJK}]`);
export const hasCJK = s => HAS_CJK.test(s);

// Spans of Markdown that must never be touched: code, math, link targets and raw HTML tags.
const PROTECTED = /```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\]\([^)\n]*\)|<[^>\n]+>/g;

/**
 * Chinese–Latin spacing is drawn by the browser (`text-autospace`), so hand-typed spaces between a
 * Chinese character and Latin text are removed from Chinese sources. List markers ("1. ", "- ") are kept.
 */
export function stripCjkSpaces(markdown) {
  const kept = [];
  let s = markdown.replace(PROTECTED, m => `${kept.push(m) - 1}`);
  s = s.replace(new RegExp(`([${CJK}])[ \\t]+(?=[A-Za-z0-9\\uE000*_\\[(])`, 'g'), '$1')
    .replace(new RegExp(`([A-Za-z0-9\\uE001*_\\])%])[ \\t]+(?=[${CJK}])`, 'g'), '$1');
  return s.replace(/(\d+)/g, (_, i) => kept[+i]);
}

/** Curly quotes for one run of plain text. Chinese uses “” for ASCII double quotes and leaves ' alone. */
export function smartQuotes(text, lang = 'en', state = {open: false}) {
  if (lang === 'zh') return text.replace(/"/g, () => (state.open = !state.open) ? '“' : '”');
  return text
    .replace(/(^|[\s([{—–-])"/g, '$1“').replace(/"/g, '”')
    .replace(/(\p{L}|\p{N})'(?=\p{L})/gu, '$1’')
    .replace(/(^|[\s([{—–-])'/g, '$1‘').replace(/'/g, '’');
}

/** A plain title or summary typeset for its language: curly quotes, and for Chinese no hand-typed spaces. */
export function typeset(text, lang) {
  const t = smartQuotes(String(text ?? ''), lang);
  return lang === 'zh' ? stripCjkSpaces(t) : t;
}

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', {granularity: 'word'}) : null;
const PUNCT = /^[\s、，。；：！？）》」』”’…—·,.;:!?)\]]+$/u;
/**
 * Escaped HTML for a Chinese headline that may only break between words: <wbr> between word segments
 * (punctuation sticks to the word before it); pair with `word-break: keep-all`.
 */
export function wordBreaks(text) {
  if (!segmenter || !hasCJK(text)) return esc(text);
  const parts = [];
  for (const {segment} of segmenter.segment(text)) {
    const prev = parts.at(-1) || '';
    // Punctuation sticks to the word before it; a Latin–Chinese boundary gets no <wbr> either, because the break
    // element would cancel the 1/8 em that text-autospace draws there.
    if (parts.length && (PUNCT.test(segment) || /^\s+$/.test(segment) || (/[A-Za-z0-9]$/.test(prev) && hasCJK(segment[0])) || (hasCJK(prev.at(-1)) && /^[A-Za-z0-9]/.test(segment)))) parts[parts.length - 1] += segment;
    else parts.push(segment);
  }
  return parts.map(esc).join('<wbr>');
}
