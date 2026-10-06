// Static pages the build writes around the app: legacy redirect stubs, the 404 page and the sitemap.
// Pure helpers (no build side effects), shared by scripts/build-site.mjs and the world tests.
import {readFileSync} from 'node:fs';

export const SITE = 'https://yaxin9luo.github.io';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
export const legacy = JSON.parse(read('./legacy-redirects.json'));

const escapeHtml = value => String(value).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

/** Every legacy URL path with its new target: each old page under /traditional/, plus its root stub. */
export function legacyRoutes(pages = legacy.pages) {
  const routes = [];
  for (const [path, target] of Object.entries(pages)) {
    routes.push([`/traditional${path}`, target]);
    if (path !== '/') routes.push([path, target]);
  }
  return routes;
}

/** Files that answer a URL path on GitHub Pages: dir/ → dir/index.html; page.html as is; an extensionless
 *  permalink answers both /page (page.html) and /page/ (page/index.html). */
export function filesForPath(path) {
  const relative = path.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) return [`${relative}index.html`];
  if (/\.html?$/.test(relative)) return [relative];
  return [`${relative}.html`, `${relative}/index.html`];
}

/** A tiny page that forwards to `target` with or without JavaScript, and tells crawlers where it went. */
export function redirectStub(target, site = SITE) {
  const canonical = site + target.replace(/#.*$/, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moved · Yaxin Luo</title>
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
<script>location.replace(${JSON.stringify(target)})</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F7FB;color:#565B73;font:15px/1.5 system-ui,sans-serif}a{color:#4F46E5}@media (prefers-color-scheme:dark){body{background:#0F1020;color:#A9ACC6}a{color:#8B85FF}}</style>
</head><body><p>This page has moved · 页面已迁移 → <a href="${escapeHtml(target)}">${escapeHtml(target)}</a></p></body></html>
`;
}

/** The 404 page: the canvas-style template with the legacy map inlined for client-side forwarding. */
export function notFoundPage(pages = legacy.pages) {
  return read('./404.html').replace('/*LEGACY_PAGES*/{}', JSON.stringify(pages));
}

/** sitemap.xml: entries [{path, lastmod?, alternates?: {en, zh}}]; paired language versions list each other (hreflang). */
export function sitemapXml(entries, site = SITE) {
  const alt = a => a ? ['en', 'zh'].map(l => `<xhtml:link rel="alternate" hreflang="${l === 'zh' ? 'zh-CN' : 'en'}" href="${escapeHtml(site + a[l])}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(site + a.en)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(e => `  <url><loc>${escapeHtml(site + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}${alt(e.alternates)}</url>`).join('\n')}
</urlset>
`;
}

/** robots.txt: everything may be crawled (placeholder pages opt out with a noindex meta); points at the sitemap. */
export const robotsTxt = (site = SITE) => `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
