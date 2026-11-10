# Yaxin Luo · Interactive portfolio

The portfolio is readable immediately in English and Chinese. The optional Three.js world adds broom flight, six instant portals, spell effects, peaceful-until-engaged spirits, stardust and a timed flight course. The enlarged moonlit grounds add a six-stop portfolio tour, three camera presets, sky-lantern releases and interactive paper exhibits.

## Run

```sh
npm ci --prefix world
npm --prefix world test
npm run build:site
python3 -m http.server 4188 --bind 127.0.0.1 --directory dist
```

See [build instructions](../docs/world-build.md). `npm --prefix world run dev -- --port 4190` runs the app alone; the academic images and PDFs at the repository root (`files/`, `images/`) are added by the full build.

## Inspect the assets

Open `/asset-studio.html` for independently orbitable terrain, six buildings, the broom rider, wraith, six tree specimens, sky lantern, garden lantern, arched bridge, floating research book, shield, portal and stone material. Architecture entries provide GLB and packed Blender source downloads; character entries provide GLB downloads. These are the actual runtime models and materials, not concept images. Runtime architecture is generated from the same original model factories used by the exports.

- [Moonlit scene iteration and screenshot review](../docs/moonlit-iteration.md)
- [Night sky, moon, lanterns and garden sources](../docs/night-garden-art.md)
- [Art revision and visual references](../docs/art/asset-quality-plan.md)
- [Model generation and exports](../docs/world-models.md)
- [Character source and anchors](../docs/world-character-assets.md)
- [Material sources, licenses and checksums](../docs/world-asset-sources.md)
- [Academic content provenance](../docs/world-content-sources.md)
- [Verification results and limits](../docs/world-verification.md)

## Controls

The "3D Academy" entry loads **Moonlit Trials**, a lean arcade broom-flight game on the Academy map (`src/academy/`); see [performance and design notes](../docs/academy-performance.md). The broom always flies forward: W / S (or ↑ / ↓) climb and dive, A / D (or ← / →) turn, Shift boosts, Q / E barrel-roll to dodge, Space or a click casts an auto-aimed bolt, F reads a nearby landmark's chapter, T opens the trial list and R restarts a trial. Right-drag looks around; the wheel zooms. Escape opens the portfolio and M the travel map. Touch devices use the thumbstick and boost button plus roll and cast buttons; gamepads are supported. Fly through a golden gate to start a trial; a medal unlocks the next one. Trial bests, star shards and discoveries are saved locally (`yaxin.academy.v2`).

The original high-detail world below is unchanged and still loads with `?academy=classic`.

Original world: WASD / arrow keys fly; R / F change height; V or the camera buttons select follow, bird’s eye or low-angle views; Shift accelerates; Space casts the selected spell, 1–3 select spells, Q shields, E reads a nearby chapter or research book. Graphics quality, reduced motion and optional synthesized sound are in Settings. Progress is local to the browser; malformed or unavailable storage does not block the portfolio.

## Source layout

`content.js` and `journal.js` hold the bilingual academic content; `ui.js` provides the accessible reading and navigation layer. `game.js` runs the simulation. `world.js`, `landscape.js`, `models.js`, `architecture.js`, `characters.js`, `effects.js` and `rendering.js` provide assets and rendering. `collision.js` uses structural convex proxies for buildings and camera obstruction. Test files exercise content, save/state contracts, physics, terrain contact and collision regressions without claiming GPU or device coverage.

This is an original browser-scale interpretation of a Gothic fantasy setting. It does not contain extracted Hogwarts Legacy, Baldur’s Gate 3 or Divinity assets. Their visuals informed the art direction; the result should not be represented as AAA-equivalent rendering or production readiness on every mobile device.
