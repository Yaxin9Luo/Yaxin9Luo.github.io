// Atom feeds (full text) and sitemap entries for the blog. Drafts and placeholder posts are never listed.
import {esc} from '../text.js';
import {SITE, NAME_PLAIN, POSITIONING, postPath, versionFor} from '../render.js';

const absolute = html => html.replace(/(\s(?:src|href))="\/(?!\/)/g, `$1="${SITE}/`);

/** entries: [{post, html: {en, zh}}] newest first. The English feed falls back to Chinese-only posts and vice versa. */
export function atomFeed(entries, lang, fallbackDate = '2026-01-01') {
  const self = `${SITE}/blog/${lang === 'zh' ? 'feed.zh.xml' : 'feed.xml'}`, home = `${SITE}${lang === 'zh' ? '/blog/zh/' : '/blog/'}`;
  const items = entries.slice(0, 20).map(({post, html}) => {
    const vl = versionFor(post, lang), v = post.versions[vl], url = SITE + postPath(post, vl);
    const updated = post.updated || post.date;
    return `  <entry xml:lang="${vl === 'zh' ? 'zh-CN' : 'en'}">
    <id>${url}</id>
    <title>${esc(v.metaTitle || v.title)}</title>
    <link rel="alternate" type="text/html" href="${url}"/>
    <published>${post.date}T00:00:00Z</published>
    <updated>${updated}T00:00:00Z</updated>
    <author><name>Yaxin Luo</name><uri>${SITE}/</uri></author>
    <summary>${esc(v.metaSummary || v.summary)}</summary>
    <content type="html">${esc(absolute(html[vl]))}</content>
  </entry>`;
  });
  const newest = entries.map(e => e.post.updated || e.post.date).sort().at(-1) || fallbackDate;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
  <id>${home}</id>
  <title>${esc(NAME_PLAIN[lang])}</title>
  <subtitle>${esc(POSITIONING[lang])}</subtitle>
  <link rel="self" type="application/atom+xml" href="${self}"/>
  <link rel="alternate" type="text/html" href="${home}"/>
  <updated>${newest}T00:00:00Z</updated>
  <author><name>Yaxin Luo</name><uri>${SITE}/</uri></author>
${items.join('\n')}
</feed>
`;
}

/** Blog URLs for sitemap.xml: both index pages and every indexable language version, with hreflang pairs. */
export function sitemapEntries(posts) {
  const listed = posts.filter(p => !p.placeholder);
  const newest = listed.map(p => p.updated || p.date).sort().at(-1);
  const pair = {en: '/blog/', zh: '/blog/zh/'};
  return [
    {path: '/blog/', lastmod: newest, alternates: pair}, {path: '/blog/zh/', lastmod: newest, alternates: pair},
    ...listed.flatMap(p => {
      const alternates = p.versions.en && p.versions.zh ? {en: postPath(p, 'en'), zh: postPath(p, 'zh')} : null;
      return Object.keys(p.versions).map(l => ({path: postPath(p, l), lastmod: p.updated || p.date, alternates}));
    }),
  ];
}
