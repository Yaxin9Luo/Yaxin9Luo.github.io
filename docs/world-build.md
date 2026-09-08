# Build and publish the two website entrances

The repository's original Jekyll pages, layouts, includes, data, images, and PDFs remain the source of the traditional website. The new Three.js app lives in `world/`. The combined static output is:

- `/`: the enchanted research world.
- `/traditional/`: the original English homepage.
- `/traditional/zh/`: the original Chinese homepage.
- `/traditional/publications/` and `/traditional/cv/`: the original academic pages.
- Existing page URLs such as `/zh/`, `/publications/`, `/cv/`, and article URLs redirect to their traditional equivalents, preserving query strings and fragments in JavaScript-enabled browsers.
- `/images/`, `/files/`, and legacy `/assets/` resources remain available for old direct links and for the game. Vite's hashed assets coexist with the legacy asset subdirectories.

## Local build

Use Node.js 22.12 or newer and Ruby 3.3 with Bundler. The Ruby and game dependencies are pinned by `Gemfile.lock` and `world/package-lock.json`.

```sh
bundle install
npm --prefix world ci
npm run build:site
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/traditional/`. Choose another free port when necessary. The output uses root-relative navigation and resource paths, so it can be previewed at any loopback port. `SITE_URL` may override the canonical hostname during the build; its default is `https://yaxin9luo.github.io`.

The root npm dependencies are only needed to regenerate the old site's minified JavaScript; they are not needed for the combined build. `npm run build:js` remains unchanged.

To compile the traditional website independently:

```sh
npm run build:traditional
```

This writes `work/traditional-site/`, which must be mounted at `/traditional/`. `scripts/build-traditional.sh` builds a disposable source copy under `work/`, using Jekyll safe mode as GitHub Pages does. Only this copy receives the `/traditional` base URL, root-relative resource/navigation helper, and a footer link returning to the game. The tracked original content is not rewritten. Node dependencies, build output, runtime scratch, and Git metadata are excluded before Jekyll runs.

The temporary copy also omits inherited favicon declarations whose image files are absent. A clearly marked bilingual placeholder keeps the existing research-notes navigation entry usable until actual notes are provided. Publication pages receive directory aliases in the output because simple local HTTP servers do not perform GitHub Pages extensionless `.html` resolution. These small compatibility repairs do not alter the original academic sources.

This workstation originally had only Apple's Ruby 2.6. A Ruby 3.3 runtime was therefore built locally under ignored `work/runtime/ruby/`; the script detects that runtime when it exists. It does not alter system Ruby or Homebrew configuration. On a fresh clone, use a standard Ruby 3.3 installation and run `bundle install` normally.

## Branch and deployment behavior

`.github/workflows/world-site.yml` builds the combined artifact for pull requests, pushes to `master`, and manual workflow runs. Pull requests and feature-branch manual runs cannot deploy. The deployment job only runs for a push to `master`, or a manual run on `master` with the `deploy` input selected.

Publishing this feature branch or opening a pull request does not replace the live homepage. Production publication requires a reviewed merge into `master`, GitHub Pages configured to use GitHub Actions, and any required `github-pages` environment approval. The implementation does not change those repository settings, merge the branch, or trigger a deployment by itself. Existing branch-based Jekyll publishing will continue to show the original site until the publishing source is deliberately switched.

The workflow follows [GitHub's custom Pages workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): it uploads a static Pages artifact, and grants `pages: write` and `id-token: write` only to the deployment job.

## Verification scope

The build scripts fail if either build fails or if essential homepage, Chinese homepage, stylesheet, or CV PDF outputs are missing. They do not substitute for browser playtesting. Verify rendered English/Chinese pages, representative images/CSS/JavaScript/PDF responses, traditional navigation, and the game return link over the local HTTP server before publication. Asset and interaction checks performed during development are recorded in the delivery notes.
