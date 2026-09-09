# Landscape v7 — terrain, planted walks and water

## Spec and outcome

Implement the user-approved findings in `work/qianli-reference-review/analysis.html`: a coherent, beautiful fantasy landscape with connected landforms, authored plant communities, grounded assets, calm readable water and layered depth. Preserve the painted distant mountains. Improve castle slopes, bridgehead coves and blossom walks as complete scenes, then apply the same rules to the remaining visible main island. The user explicitly requests subagent-driven implementation with repeated visual review. Quality has priority over token cost and simplistic polygon reduction.

## Global Constraints

- Preserve the traditional site, bilingual portfolio content, portal navigation, optional-play default, running/walking improvements and automatic time progression.
- Preserve the existing landmark, garden, bridge, portal and exhibit placement contracts; visible surfaces and movement support must agree. New slopes must not strand routes, engulf foundations or block interaction approaches.
- Preserve existing high-quality scan/PBR sources, detailed close vegetation, high-quality rendering settings and the painted mineral backdrop. No global blur, low-resolution cap, blanket sepia treatment or replacement of near assets with cheap distant cards.
- Establish readable large forms, regional color, connected material transitions and meaningful planting groups. Avoid uniform scattering, repeated identical cliff bands and unrelated boulders pasted over the terrain.
- Keep night bright and readable, with cool landforms and warm practical lights. Day/night, reduced-motion, water reflections and disposal must continue to work.
- Implement original project changes from the reference's principles; do not copy the supplied minified library or redistribute its embedded art into the website.
- Each worker owns only its task files, preserves other edits, does not spawn agents and does not push. Use the existing isolated worktree and commit each reviewed implementation. Browser-based visual review is coordinated by the root agent.
- Validate meaningful geometry/navigation/material contracts with focused tests. Do not write brittle tests that merely assert artistic constants. Root captures actual before/after frames and checks navigation plus day/night. The finished branch gets a complete test/build and an independent final review.

## Task 1: Connected landforms and grounded stonework

Ownership: `world/src/world.js`, `world/src/environment-composition.js`, new `world/src/landform-layout.js` if useful, and focused terrain/support/composition tests. Read existing layout, locations, collision and surface-support contracts before changing height. Also own the necessary terrain-only runtime bake in `world/scripts/prepare-runtime-assets.mjs`, its manifest entry, new hashed terrain GLB, runtime-asset tests and a terrain transmission report in `docs/art/landscape-v7/`; preserve every other asset descriptor.

Create a visibly stronger island silhouette and internal terrain: a coherent rock-backed castle precinct, sloping side/rear shoulders, lower shore terraces and two deliberate coves near bridge approaches or open island edges. Use authored regions and continuous fields, with secondary strata following the large rock forms. Avoid making the entire coast a uniform ledge or scallop pattern. Keep continuous terrain/cliff joins and reliable rendered height sampling. Preserve all authored paths, bridge decks, gardens, exhibit and landmark levels. Ground surrounding masonry, ledges and scanned stone groups coherently; existing actual-mesh rock fitting must remain valid after cliff changes. Add or refine broad foundations-to-soil/rock transitions rather than isolated floating props.

If adding a shared landform module, keep it deterministic and DOM-free, with no import cycle through `world.js` or `landscape.js`. Document its small public interface in the task report so the vegetation and atmosphere tasks can consume it. Do not modify their files. Preserve good existing UVs and topology while giving dry rock, moist lower banks and vegetated shoulders distinct spatial structure.

Run focused tests covering manifold/finite terrain, rendered-height support, bridge and portal approaches, and scanned-rock contact as applicable. Check generated geometry bounds and self-review the resulting changes. Commit implementation and write full evidence to the task report. Root will review actual day/night overview and low bridge/shore views; expect a visual refinement loop before acceptance.

## Task 2: Plant communities, blossom massing and ground palette

Ownership: `world/src/landscape.js` vegetation and ground-material sections only (leave lake/backdrop for Task 3), `world/src/grove-foliage.js`, `world/src/blossom-groves.js`, `world/src/environment-layout.js` planting/layout portions only, and focused vegetation tests. Consume Task 1's landform interface where appropriate; do not change terrain/support code. Also own the necessary botanical bake, `world/src/botanical-manifest.js`, newly hashed botanical derivatives and their packing report, so actual loaded trees match the revised source meshes.

Replace visually uniform ground scatter with readable ecological groups: open meadow, coherent flower drifts, tree-shadow humus, moist ferns and exposed rocky shoulders. Main routes, portal entries, exhibit faces and character silhouettes need visual breathing room. Keep detailed individual blades, flowers, branches and silhouettes. Control flowering-tree color, density and orientation at branch-group scale to form lit masses, darker interiors and crown openings; improve hero-tree variation and petal shape where visible. Make both cherry and lilac walks composed scenes, and ensure other visible planting participates in the same regional logic.

Ground materials should follow actual regions/slope/moisture rather than a global green recolor or evenly distributed random noise. Retain PBR detail and consistent texture scale; balance warm soil, sage/fern grass, mineral rock and restrained blossom accents. Keep wind and shadow deformation aligned and reduced-motion correct. Do not lower global mesh/DPR quality or change foliage LOD behavior to hide poor assets.

Run meaningful placement/corridor, finite geometry and wind/shadow tests appropriate to changes. Commit implementation and report full evidence. Root reviews day/night blossom walks, courtyard and overview; refine visual issues before acceptance.

## Task 3: Water, middle-distance depth and integrated atmosphere

Ownership: `world/src/landscape.js` lake/backdrop sections, `world/src/atmosphere.js`, `world/src/mineral-highlands.js`, optionally a focused new `world/src/landscape-depth.js`, quality-review camera presets only if needed, and focused atmosphere/water tests. Preserve Task 2 ground/vegetation changes.

Join the refined island to its distant painted surroundings with a small set of deliberately placed three-dimensional middle-distance rock groups or islets. Their silhouettes, PBR materials and palette must fit the main terrain and mineral mountains, avoiding obvious cones, duplicated mountain cards or a repetitive ring. Keep flying routes and long views open. Add selective low, soft water/valley mist that conveys depth without washing out the foreground; do not increase blanket fog.

Tune the existing lake so broad calm reflections are legible, with restrained varied wind ripples and stronger local shore character where appropriate. Use the authored new coves/terraces as an integrated shore/water composition. Preserve correct reflection cameras, surface height, environment palette, material disposal and reduced-motion. Keep night luminous with readable silhouettes and warm points of light. Check new geometry both in the main view and its water reflection. Additional small life/motion details should support composition and scale rather than scatter everywhere.

Run focused environment/geometry/reflection/disposal tests as applicable and build the world. Commit implementation and report evidence. Root conducts the integrated view and interaction checks; address the visual review and final code review findings.

## Visual acceptance and delivery

Keep baseline and candidate actual render frames for overview day/night, bridge contact or bank, castle footing, cherry and lilac walk, high flight and distant-landscape transition. Use the existing review UI and its local capture endpoint. Inspect actual native-resolution saved frames, not just a loading screen or a small browser screenshot. Exercise movement, teleportation, opening portfolio content, language, default play and time controls. Record the browser/device limitations of any performance observations; never claim M4 performance from M2 inspection.

Finish when visible improvements are confirmed, serious visual/geometry/interaction issues have been fixed, relevant tests and production build pass, and independent review is complete. Produce a reviewable local preview and evidence summary. Deployment is a separate action if requested; do not change the live site as an incidental part of art review.
