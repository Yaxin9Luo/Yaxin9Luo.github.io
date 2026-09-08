# Original landscape assets and external material provenance

## Original mountain matte

- Source: built-in ImageGen, generated for this project using our v4 composition reference. Not extracted from a commercial game.
- Accepted sources: `mineral-mountains-source.png` and `mineral-mountains-right-source.png`; generated output is **1774 × 887**, RGB black key, not true alpha and not native 4K.
- Runtime: `world/public/art/experience-v5/mineral-mountains.webp`, lossless WebP. World-space curved sectors preserve angular detail; transparent sky is keyed at runtime. Sky, lake and illumination stay live.
- First generation was rejected because it baked a checkerboard into RGB. The edit requests solid black above a clean tree silhouette; inspect actual frames for black fringe and seams.

### Original prompt

Create a production-quality background landscape CUTOUT texture for a 3D magical academy game. Use the provided image solely as reference for the beautiful refined blue-green mountains, atmospheric depth and physically rich fantasy art style. DO NOT include its castle, island, lake, reflection, moon, sky, UI or lanterns.
Deliver one exceptionally detailed wide 2:1 panorama, ideally 3840x1920, with genuine transparent alpha above the mountain silhouettes. This is a cylindrical distant-landscape matte, NOT a full illustration.
Only an expansive connected chain of magnificent blue-green mountain ridges, naturally sculpted limestone and slate cliffs, azure and malachite rock faces, forested shoulders with thousands of individually readable conifer silhouettes, waterfalls as tiny delicate details in 2 remote valleys, atmospheric layered valleys. Inspired by the sophistication and graceful rhythms of Thousand Li of Rivers and Mountains, translated into a premium coherent painterly-realistic fantasy game environment rather than ink or parchment. Absolutely no rounded identical cone mountains. Fine eroded rock relief, subtle warm ochre veins, moss and emerald forest, distant blue-grey veils.
Strongly asymmetric peak rhythm: a dominant intricately cragged massif left of center, a deep low saddle in center, elegant lesser peaks on right. Connected lower foothills run across the entire bottom. Peak tops between 25% and 65% from top. Bottom edge completely filled with dark bluegreen rock/forest; transparent above silhouettes, including fine trees. Broad softly diffused neutral daylight from upper left, restrained saturation, clearly visible rock detail; no deep black shadows, no blown highlights. No painted sky, clouds, water, fog hiding outlines, no text.
The leftmost and rightmost edges must both be low quiet foothills of matching color and similar height so the panorama wraps unobtrusively. Forest/rock cutout alpha edges must be clean, no white halo and NO checkerboard baked into RGB. The texture will receive time-of-day grading and dynamic mist inside the 3D game. Highest visual craftsmanship.

### Key-background edit

Edit this mountain artwork into a clean production matte texture. Preserve the exact mountain shapes, fine pine trees, rock detail, color and full composition. Replace EVERYTHING above the mountain silhouettes (all grey-white checkerboard, the pale ghost mountain contours in that checkerboard, and stray marks) with perfectly SOLID PURE BLACK RGB(0,0,0). This is intentionally an OPAQUE RGB black-key texture. DO NOT attempt transparency, DO NOT draw any checkerboard, no grey sky, no clouds, no moon, no lake. Keep precise detailed treetop edges against the flat black. The mountain area should be completely unchanged, especially the finest forests and waterfalls. Output the highest supported actual pixel resolution, requested 3840 by 1920 pixels, 2:1. This black background will be removed by a game shader. Do not darken the artwork itself.

### Companion direction

Create a companion production environment matte for the attached mountain artwork, same exquisite painted-realistic blue-green mineral rock and fine conifer forests, same neutral lighting and pixel detail. This companion shows LOWER, LONG CONTINUOUS RIDGELINES, one enormous asymmetric rocky massif on the RIGHT, plunging to a valley at the LEFT. No repeated silhouettes from the supplied image. Jagged stratified folded rock, turquoise shadow planes, muted ochre seams, dense dark fir trees, a few pale distant blue ridges. Mountains occupy lower 70 percent; above silhouette is ABSOLUTELY PURE FLAT RGB BLACK (#000000) opaque black-key background. NO checkerboard transparency, NO sky or clouds or moon, NO water plane, NO castle or buildings, NO text. Image fills edge-to-edge with natural low mountain extensions at both edges and foreground foothills covering whole bottom. Requested highest actual resolution, 2:1 wide aspect. This is a usable game asset, not a framed illustration. Preserve tiny individual treetops against black with a clean silhouette.

## Paving

- Asset: [Cobblestone Floor 08](https://polyhaven.com/a/cobblestone_floor_08), Rob Tuytel / Poly Haven.
- License: [CC0](https://polyhaven.com/license).
- Real surface width: 2 metres. Downloaded 4096 × 4096 PNG diffuse, OpenGL normal and roughness; API MD5 checked against downloaded bytes.
- Runtime: `world/public/textures/courtyard-paving/{color,normal,roughness}.webp`; 4K retained, quality 95/98/95. Shared textures are loaded through the existing optional resource loader.
- Original API record and exact URLs/digests saved alongside this document in `paving-provenance.json`.

## Art method references

[Kids With Sticks](https://kidswithsticks.com/creating-stylized-art-inspired-by-ghibli-using-unreal-engine-4/) describes combining painted distant landscapes with a 3D world. Our use is a project-specific inference: depth-separated mountain sectors and live near geometry provide useful parallax without replacing the world by a screenshot. [故宫](https://www.dpm.org.cn/collection/paint/228354.html) informed the connected blue-green ridge and valley composition.

