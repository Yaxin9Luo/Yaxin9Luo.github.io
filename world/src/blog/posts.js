// Posts live in ./posts as `<slug>.<lang>.md`. A post may exist in one or both languages.
// Front matter is flat `key: value` lines; lists are written `[a, b]`.
//   title, summary            per language
//   date (YYYY-MM-DD)          first publication, same in both versions
//   updated (YYYY-MM-DD)       optional, last substantive change; a closing `## Updates` section logs it
//   type                       essay | note | explainer | log
//   work                       [paper or project ids from taxonomy.js]; the research-map phase follows from it
//   tags                       [keys from taxonomy.js], at most 3
//   cite                       false hides "Cite this post" (logs)
//   placeholder, draft         booleans; placeholders are published with noindex, drafts never leave the dev server
// Shared fields may be written in either version; when both versions write one, they must agree.
import {TYPES, TAGS, WORKS, phaseOf} from './taxonomy.js';

const SHARED = ['type', 'work', 'tags', 'updated', 'cite', 'placeholder'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A closing "Updates" section (English or Chinese heading) becomes the post's update log.
const UPDATES = /(?:^|\n)##\s+(?:Updates|更新记录|更新)\s*\n([\s\S]*)$/;

function fail(file, message) { throw new Error(`${message}: ${file}`); }

export function parsePost(file, raw) {
  const name = file.split('/').pop().replace(/\.md$/, '');
  const [, slug, lang] = name.match(/^(.+)\.(en|zh)$/) || [];
  if (!slug) fail(file, 'Blog post file must be named <slug>.<en|zh>.md');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(file, 'Blog post slugs are lower-case kebab-case');
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) fail(file, 'Blog post is missing front matter');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^(\w+):\s*(.*)$/); if (!pair) continue;
    // Strip one pair of surrounding quotes only, so titles may end with a quoted phrase.
    let value = pair[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (/^\[.*\]$/.test(value)) value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    if (value === 'true' || value === 'false') value = value === 'true';
    meta[pair[1]] = value;
  }
  if (!meta.title || !DATE.test(meta.date || '')) fail(file, 'Blog post needs a title and a YYYY-MM-DD date');
  if (meta.updated !== undefined && (!DATE.test(meta.updated) || meta.updated < meta.date)) fail(file, '`updated` must be a YYYY-MM-DD date on or after `date`');
  if (meta.type !== undefined && !TYPES[meta.type]) fail(file, `Unknown type "${meta.type}" (essay, note, explainer or log)`);
  for (const key of ['work', 'tags']) if (meta[key] !== undefined && !Array.isArray(meta[key])) meta[key] = [meta[key]].filter(Boolean);
  for (const id of meta.work || []) if (!WORKS[id]) fail(file, `Unknown work id "${id}"`);
  for (const tag of meta.tags || []) if (!TAGS[tag]) fail(file, `Unknown tag "${tag}" (see taxonomy.js)`);
  if ((meta.tags || []).length > 3) fail(file, 'At most 3 tags');
  let body = match[2].trim(), updates = [];
  const log = body.match(UPDATES);
  if (log) {
    body = body.slice(0, log.index).trim();
    updates = [...log[1].matchAll(/^[-*]\s*(\d{4}-\d{2}-\d{2})\s*[:：—–-]?\s*(.+)$/gm)].map(([, date, text]) => ({date, text: text.trim()}));
  }
  return {
    slug, lang, file, title: meta.title, date: meta.date, summary: meta.summary || '', body, updates,
    draft: meta.draft === true,
    // Shared fields stay undefined when this version does not write them; collectPosts merges them.
    shared: Object.fromEntries(SHARED.filter(k => meta[k] !== undefined).map(k => [k, meta[k]])),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One entry per slug, newest first, each holding its language versions and the shared fields.
export function collectPosts(files) {
  const bySlug = new Map();
  for (const [file, raw] of Object.entries(files)) {
    const v = parsePost(file, raw);
    if (!bySlug.has(v.slug)) bySlug.set(v.slug, {slug: v.slug, versions: {}});
    const post = bySlug.get(v.slug);
    if (post.versions[v.lang]) fail(file, 'Duplicate language version');
    post.versions[v.lang] = v;
  }
  const posts = [...bySlug.values()].map(post => {
    const vs = Object.values(post.versions), shared = {};
    for (const key of SHARED) {
      const values = vs.map(v => v.shared[key]).filter(x => x !== undefined);
      if (values.some(x => !same(x, values[0]))) fail(vs[0].file, `Both language versions set "${key}" differently`);
      shared[key] = values[0];
    }
    if (vs.some(v => v.date !== vs[0].date)) fail(vs[0].file, 'Both language versions need the same date');
    const work = shared.work || [];
    return {
      ...post, date: vs[0].date, updated: shared.updated || null, type: shared.type || 'note', work, tags: shared.tags || [],
      phase: phaseOf(work), cite: shared.cite !== false, placeholder: shared.placeholder === true,
    };
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// A post is a draft until at least one language version drops `draft: true`.
export const isDraft = post => Object.values(post.versions).every(v => v.draft);

/** The post as the public build sees it: draft translations removed, or null when nothing is published. */
export function published(post) {
  const versions = Object.fromEntries(Object.entries(post.versions).filter(([, v]) => !v.draft));
  return Object.keys(versions).length ? {...post, versions} : null;
}

export const langsOf = post => ['en', 'zh'].filter(l => post.versions[l]);
export const pickVersion = (post, lang) => post.versions[lang] || post.versions[lang === 'zh' ? 'en' : 'zh'];

const HAN = /[㐀-鿿]/g;
const prose = text => text.replace(/```[\s\S]*?```/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ');
/** Reading time: 400 Chinese characters or 220 English words a minute, code and display math excluded. */
export function minutes(text) {
  const plain = prose(text), han = (plain.match(HAN) || []).length;
  const words = (plain.replace(HAN, ' ').match(/[A-Za-z0-9’'-]+/g) || []).length;
  return Math.max(1, Math.round(han / 400 + words / 220));
}
/** Length shown in the index: words for English, characters for Chinese. */
export function length(text, lang) {
  const plain = prose(text);
  return lang === 'zh' ? (plain.match(HAN) || []).length : (plain.match(/[A-Za-z0-9’'-]+/g) || []).length;
}
