# World art v5 — actual rendering and verification

Code under final review: `c78c2c1`. Base: `e39e27e`. Captured on 2026-09-09, Asia/Shanghai. These images come from the running Three.js scene; they are not generated paintovers.

## Visual changes

- Original blue-green mountain artwork replaces the repeated distant procedural peaks. Eight world-fixed curved sectors preserve the artwork's 2:1 proportions. Their lower geometry has shallow coastal depth; the academy island remains 3D. This is a hybrid matte technique, not a fully modeled distant mountain range.
- Live sky, stars, moon, sun and water remain independent of the artwork. Celestial objects now pass behind the mountain silhouettes. Water ripples, subdued mountain reflections and matching sky/water fog improve their integration.
- Day, dawn, dusk and night have distinct palettes. Softer shadows, warmer light at the actual castle doorways and ground-level lantern pools make the architecture and entrances easier to read at night.
- Dedicated 4K stone paving, a three-layer meadow/humus/moss ground material, irregular path shoulders and clustered low flowers, grasses and ferns add foreground detail. Visible path support and collision surfaces retain their existing contracts.

## Actual frames

| View | Evidence | What was inspected |
|---|---|---|
| Mountain composition, night | [Frame](highlands-night.png) | Rock/forest detail, lake contact, warm castle focal point |
| Flower garden, day | [Frame](lilac-day.png) | Paving, planting, material scale and corrected water/sky boundary |
| Western map edge, day | [Frame](west-edge-day.png) | Horizon continuity outside the principal composition |
| Raised flight camera, night | [Frame](high-flight-night.png) | Skyline, castle readability and island bounds |
| Eastern map edge, dawn | [Frame](east-edge-dawn.png) | Dawn color, side view and terrain contact |
| Flower garden, dusk | [Frame](lilac-dusk.png) | Warm/cool separation and readable foreground |
| Cherry walk, night | [Frame](cherry-night.png) | Near leaves, path and scene props |
| Shore, night | [Frame](shore-night.png) | Backlit cliffs and island edge; a diagnostic view, not a hero image |

[frames.json](frames.json) identifies the exact capture filename, resolution and code commit for every frame. The first three frames were refreshed after the final horizon correction; other frames document the preceding integrated visual gate. There is no post-capture enhancement.

## Review iterations

The first generated mountain source was rejected because its RGB pixels contained a checkerboard. A black-key revision replaced it. Actual in-game reviews then rejected an oversized, stretched backdrop, dark skyline fringes, repetitive peaks and a hard waterline. Subsequent passes preserved the source proportions, corrected edge reconstruction and celestial occlusion, graded reflected detail and matched the low sky to the live water fog. The final correction also gave the lower coastline restrained depth.

Foreground reviews restored green meadow pigment, adjusted paving color and improved stone/soil transitions. Regression tests exposed a small terrain/shoulder intersection; subdivision and supported edge clearance corrected it. Independent integration and art reviews found no remaining blocking issue in the reviewed code and final three comparison views.

The [generated garden target](../../art/experience-v5/garden-paintover-target.png) was a visual direction only. It is not substituted for an actual result. Source prompts, real image resolutions, CC0 paving attribution and exact source URLs are in [asset provenance](../../art/experience-v5/README.md).

## Interaction and movement

- [Ground recording](ground-sequence.webm), [sampled frames](ground-motion-contact.png), [trajectory](ground-metrics.json): landing, dismounting, walking, running, wand illumination, mounting and takeoff; all ten scripted stages completed. This recording uses `a90555d`, before the final distant-horizon-only correction.
- [Flight recording](flight-sequence.webm), [sampled frames](flight-motion-contact.png), [trajectory](flight-metrics.json): movement, boost, altitude change, spell effects, viewpoint changes and travel. Capture provenance is recorded in `motion-provenance.json`.
- Built production UI: Chinese portfolio opened; switching to English preserved the project information and changed the CV link. AutoDesign detail opened, its atelier action entered the 3D exhibit, image navigation worked, and selecting FigMirror updated the exhibit. [Reading UI](production-projects-ui.png), [exhibit UI](production-exhibit-ui.png). These checks used the production build at `a90555d`; the final correction changes only distant rendering.
- Full scene enhancement reached “Full scene detail ready”; browser warning/error logs were empty during these checks. One click during loading timed out on the loaded M2 desktop; it succeeded once the full scene was ready. No reduced quality preset was used to obtain the screenshots.

Motion contact sheets sample the real recordings. They establish visible states and transitions, not exhaustive frame-by-frame absence of every possible animation defect. Near tree crowns can briefly occlude a camera moving through their volume.

## Checks and performance

- `npm --prefix world test` at `c78c2c1`: **320 passed, 0 failed**.
- `npm run build:site` at `c78c2c1`: successful Vite + Jekyll build, including the traditional site and 44 legacy redirects.
- Local combined build: homepage, both traditional languages, both CV PDFs, mountain art and paving returned HTTP 200. Published source/runtime copies for all five new assets match their manifest SHA-256 values.
- [Independent unrecorded performance measurement](highlands-metrics.json) at `c78c2c1`: highlands/night, high quality, existing spatial LOD, 1024×576 CSS, 2560×1440 render target, DPR 2.5, 4× MSAA. A 3.5-second warmup preceded the completed 20-second sample. No recording or build ran during this sample.
- This M2 Pro / 16 GB desktop measured **9.20 FPS average**, 108.74 ms mean frame time and 201.40 ms p95. Mean CPU render submission was 75.56 ms; measured GPU time averaged 155.67 ms. CPU submission is not GPU duration. These asynchronous measurements must not be added together. Draw/triangle totals include reflection, shadows and postprocessing passes, not unique scene geometry.

This is still a demanding scene on the test machine, not a 60 FPS result. M4 Max performance has not been measured. The quality controls remain available and the user-requested high-quality default is retained.

## Remaining visual limits

The distant mountains use painted detail with limited parallax, and their detail character differs from nearby fully modeled objects. A broad lake mist transition remains visible in some views, although the hard blue/white sky-water seam was removed. Flower crowns retain some repeated petal geometry. Backlit shore cliffs are dark. This delivery improves the actual scene; it does not claim visual parity with a commercial AAA game or completion of entirely new tree/character models.
