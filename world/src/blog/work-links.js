// Which published blog posts are about which paper / project, for the homepage's entry points:
// "notes (n) →" on research-map node cards and "Explainer →" on Publications / Projects items.
// main.js fills this from `virtual:blog-work-links` (built from the posts' `work` field); both stay hidden while empty.
let byWork = {};

export function setWorkLinks(links) { byWork = links && typeof links === 'object' ? links : {}; }

/** Posts about a work id, newest first. */
export const notesFor = id => [...(byWork[id] || [])].sort((a, b) => b.date.localeCompare(a.date));

/** The newest Explainer about a work id, or null. */
export const explainerFor = id => notesFor(id).find(p => p.type === 'explainer') || null;

/** Blog index filtered to one work, in the reader's language. */
export const notesHref = (id, lang) => `${lang === 'zh' ? '/blog/zh/' : '/blog/'}?work=${encodeURIComponent(id)}`;
