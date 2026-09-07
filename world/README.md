# Yaxin Luo · Interactive portfolio

The portfolio is readable immediately in English and Chinese. The optional Three.js world adds broom flight, six instant portals, spell effects, peaceful-until-engaged spirits, stardust and a timed flight course. The original academic site remains at `/traditional/` in the combined build.

## Run

```sh
npm ci --prefix world
npm --prefix world test
npm run build:site
python3 -m http.server 4188 --bind 127.0.0.1 --directory dist
```

The combined build also requires Ruby 3.3 and Bundler. See [build instructions](../docs/world-build.md). `npm --prefix world run dev -- --port 4190` runs the world alone; original academic images, PDFs and traditional pages are provided by the combined build.

## Inspect the assets

Open `/asset-studio.html` for independently orbitable terrain, six buildings, the broom rider, wraith, two tree species, shield, portal and stone material. Architecture entries provide GLB and packed Blender source downloads; character entries provide GLB downloads. These are the actual runtime models and materials, not concept images. Runtime architecture is generated from the same original model factories used by the exports.

- [Art revision and visual references](../docs/art/asset-quality-plan.md)
- [Model generation and exports](../docs/world-models.md)
- [Character source and anchors](../docs/world-character-assets.md)
- [Material sources, licenses and checksums](../docs/world-asset-sources.md)
- [Academic content provenance](../docs/world-content-sources.md)
- [Verification results and limits](../docs/world-verification.md)

## Controls

WASD / arrow keys fly; R / F change height; Shift accelerates; right-drag orbits the camera; the wheel zooms. Clicking the world flies toward that point at the current altitude. Space casts the selected spell, 1–3 select spells, Q shields, E reads a nearby chapter. M opens the instant travel map and Escape opens/closes the portfolio. Touch devices have a thumbstick, altitude, cast and boost buttons. Reading a chapter pauses the simulation and any active race.

Graphics quality, reduced motion and optional synthesized sound are in Settings. Progress is local to the browser; malformed or unavailable storage does not block the portfolio. Resetting progress requires confirmation in Settings.

## Source layout

`content.js` and `journal.js` hold the bilingual academic content; `ui.js` provides the accessible reading and navigation layer. `game.js` runs the simulation. `world.js`, `landscape.js`, `models.js`, `architecture.js`, `characters.js`, `effects.js` and `rendering.js` provide assets and rendering. `collision.js` uses structural convex proxies for buildings and camera obstruction. Test files exercise content, save/state contracts, physics, terrain contact and collision regressions without claiming GPU or device coverage.

This is an original browser-scale interpretation of a Gothic fantasy setting. It does not contain extracted Hogwarts Legacy, Baldur’s Gate 3 or Divinity assets. Their visuals informed the art direction; the result should not be represented as AAA-equivalent rendering or production readiness on every mobile device.
