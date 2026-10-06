# Yaxin Luo · Personal website

Source of [yaxin9luo.github.io](https://yaxin9luo.github.io/), a bilingual (English / 中文) research homepage.

- **Home**: the Editable Canvas landing, a one-screen design-tool canvas with the research map, the CV Tour guide and the portfolio panels (About, Research, Publications, Projects, Experience, Contact).
- **3D Academy**: an optional Three.js world that loads only when a visitor asks for it, plus its world map.
- **Yuanmingyuan**: a separate museum page (`/yuanmingyuan.html`).
- **Blog**: `/blog/`, with one page per post (`/blog/<slug>/`).

Everything is a static Vite app in `world/`. `scripts/build-site.mjs` assembles the published site in `dist/`, and GitHub Actions deploys it to GitHub Pages (`.github/workflows/world-site.yml`).

## Run and test

Use Node.js 22.12 or newer.

```sh
npm --prefix world ci
npm --prefix world run dev            # http://127.0.0.1:5173/
npm --prefix world test               # all checks
npm --prefix world run test:release   # the subset CI runs
npm run build:site                    # full site in dist/
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

## Where things live

| Path | What it is |
| --- | --- |
| `world/src/content.js` | Bilingual facts: profile, publications, experience, links. Shared by every page. |
| `world/src/landing/` | The Editable Canvas landing, its research map, the top bar capsules and the panel skin. |
| `world/src/blog/` | The blog app and its Markdown posts (`posts/<slug>.<en\|zh>.md`). |
| `files/`, `images/`, `Yaxin.JPG` | Public academic files (CV PDFs, editable resumes, paper figures, portrait), served at the same URLs. |
| `_data/portfolio.json` | Generated from `content.js` by `scripts/sync-portfolio-data.mjs`. The GitHub profile README reads it from this path, so keep it here. |
| `_data/open-source.json` | Dated GitHub star snapshot used by `content.js`. |
| `world/public/og/` | Share preview cards. Regenerate them with `npm run og` (see `scripts/og/`). |
| `scripts/site/` | Redirects for the removed Academic Pages site, the 404 page and the sitemap. |
| `docs/` | Production notes and evidence for the 3D world. |

## Old URLs

The site used to include an Academic Pages (Jekyll) version under `/traditional/`. It has been removed, with the theme's sample pages and files. Its pages that have a real equivalent (listed in `scripts/site/legacy-redirects.json`) redirect to it: `/publications/` to the Publications panel, `/publication/<paper>` to that paper, `/cv/` to the CV PDF, `/zh/` to the Chinese homepage, and the old blog pages to `/blog/`. Any other `/traditional/…` link is forwarded by `404.html`; the theme's sample pages get the 404 page.

Third-party assets keep their own licenses, listed in `world/public/THIRD-PARTY-NOTICES.txt` and `docs/world-asset-sources.md`.
