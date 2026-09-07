# Verification record — 8 September 2026

This record describes the enlarged moonlit revision. Earlier screenshots and checks remain in the local QA directory; old coordinates and lap records are not used as evidence for this map.

## Actual browser checks

The combined Vite/Jekyll site was exercised through loopback HTTP. Actual CSS viewports were 1280 × 800 and 390 × 844.

- The welcome screen offers immediate Chinese/English profile, publications, projects and CV access. Both traditional entrances remain available. The original academic content, layouts, config, images and PDFs have no diff against original master `d74149b885dbb1a8b59940e9ae0766922140727f`.
- The visible ascend button moved Y=18→30. Repeated presses reached the ceiling at Y=130; Descend then reached Y=118. Native Space activation on a focused ascend button produced a second 12-metre ascent (52→76 across click + Space), while mana stayed at 100.
- Follow, bird’s-eye and low-angle presets were clicked. The overhead camera shows the full archipelago. Selecting a camera during a tour now exits the tour and applies the selected preset.
- All six guided stops were visited in the actual browser: `(54,52,62)`, `(-49,25,48)`, `(88,26,78)`, `(-55,34,-40)`, `(-18,22,98)`, `(108,33,-30)`. Next, Previous, End, Read more and live language switching were exercised. Reading pauses the world and retains the stop when closed.
- The project portkey arrived at `(64,12,56)`. Clicking visible courtyard ground then moved the rider to approximately `(55.89,12,57.32)`. Clicking the actual open book at that location opened the AutoDesign article. Its top stayed at approximately 101 px after changing Chinese to English, confirming preservation of the selected paper rather than returning to the publication list start.
- Release a lantern displayed its confirmation and produced the rising paper-light effect. Individual actual assets—book, rider front/back and guardian—were inspected in Asset Studio.
- On the phone viewport, the welcome, flight, collapsible tools, guided tour, map and English profile were checked. The profile dialog and document fit the viewport with no horizontal overflow. The portrait tour camera was pulled back after screenshot review. A challenge timer overlapping Flight tools was found and corrected.
- Opening the map held the challenge timer at 111.6 seconds across observations. Traveling from that map canceled the race. Earlier browser playtests also exercised casting, shields, a banishment, first-ring collection, save reload and keyboard modal focus.

## Automated contracts

`npm --prefix world test`: **53 passed, 0 failed**. Coverage includes bilingual factual content and local image/CV contracts, malformed storage, progress migration, spell costs/cooldowns and peaceful exploration, shield/hit accounting, ordered ten-ring completion, portkeys, stale-input clearing, target-altitude convergence, camera presets and portrait tour framing, guide lifecycle, research book callbacks and wall occlusion, native Space keydown/keyup behavior, actual terrain contact and structural collision.

The new `moonlit-2` course invalidates earlier personal-best times while preserving other progress. This is tested without silently resetting a visitor's discoveries.

## Geometry and art checks

- Castle geometry and exported models were checked for finite positions, UVs and normals; front/courtyard/crown Blender renders were reviewed and refined. Its current size is 58 × 73.8 × 48.55 m with 423,667 triangles and 20 material batches.
- Character GLBs were independently parsed for triangles, embedded material maps, skin color attributes and animation anchors. Current sizes are 5,007,284 bytes for the rider and 1,895,056 bytes for the guardian.
- Both viaducts have real arch openings. Collision regressions cover deck, rails, piers and all six openings against actual meshes. Real movement simulation can descend toward the water and pass through the contact bridge's central arch; its camera stays above water.
- Road triangle centroids clear the rendered ground; gates and three exhibit bases meet graded surfaces. Review found and fixed buried bridges, uneven pedestals, a book clickable through walls and old castle collision dimensions.
- Independent sampled sweeps checked all ten course segments and six tour positions for structural obstructions. This is geometry/simulation evidence, not a complete manual browser race run.
- Multiple actual scene screenshots prompted the sky, moon, far mountains, warm paths, tree density, portrait camera and control-panel revisions documented in [moonlit-iteration.md](moonlit-iteration.md). Generated targets are always labeled separately from real renders.

## Build, assets and performance

- `npm run build:site` passed: Vite production bundle, Jekyll traditional site and 43 compatibility redirects. Original academic source directories are unchanged.
- All **83 public files** were verified source = combined `dist` = HTTP 4188 bytes, with SHA-256 and HTTP 200. The final audit totals **183,754,170 bytes**. This includes downloadable GLB/Blender source and preview renders, not just first-visit downloads. Separately, 26 representative entrypoints, original resources and emitted JS/CSS files returned 200 and matched `dist`.
- The three new sky/moon/flower resources total 1,343,734 bytes. Runtime characters total 6,902,340 bytes. The world constructs architecture from shared factories and does not download all optional architecture exports or Blender source scenes on entry.
- NASA lunar imagery, Blender Studio/MakeHuman character inputs, Poly Haven maps, generated artwork and original geometry have distinct provenance and license records. Final GLB hashes are included in the manifest and generation script.
- Local observed readings in the final revision ranged approximately **44–70 FPS** across welcome, flight, tour and phone-sized views with another 3D preview tab present. This is not a guaranteed frame rate, a controlled benchmark or proof of physical-phone performance. Renderer triangle counts include reflection, shadow and postprocessing passes.

## Remaining limits and publication boundary

A complete ten-ring manual browser playthrough, physical-phone multi-touch and a cross-device GPU matrix have not been completed. The scene is a stylized browser interpretation, not AAA-equivalent character animation, cinematic materials or environment production. Low and balanced graphics settings remain available.

Work is on `codex/enchanted-research-world` and draft PR #1. The workflow builds PRs but only deploys master. No production merge, Pages configuration change or public-homepage replacement has been performed. Scholar was rate-limited during the initial research; unverified citation metrics were omitted rather than invented.
