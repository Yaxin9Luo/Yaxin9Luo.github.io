# Living v8 garden fit audit

Read-only placement audit, 2026-09-10, before Task 3 assembly. This file supersedes the placement coordinates in `island-design.md`; its overall garden-campus recommendation remains valid. Only this audit document was written. No production files, assets, browser state, or Git state were changed.

## Decision

The existing island accommodates the four additions without moving any building, portal, exhibit, mature tree or existing lamp. Use horizontal arcade wings at **(-20, 2)** and **(20, 2)**, a conservatory shifted south to **(55, 22)**, and the water garden at **(-44, 47)**. All coordinates below are world **x/z**.

The earlier conservatory position `(55, 18)` is rejected: actual branch and leaf triangles from the mature silver tree at `(64.0123, 11.6270)` intersect that proposed building volume. Moving the building four units south resolves this without removing the tree.

The target images `docs/art/living-v8/island-target.png` and `conservatory-target.png` were inspected. They establish composition and the conservatory's intended 16 × 9 × 7.5 proportions; they do not establish actual mesh dimensions. Horizontal arcade wings follow the island concept more closely than the previous strips aligned along z.

## Final placement reservations

For the transforms below, the asset's long local axis is **X**, front is **+Z**, and origin is at its finished floor centre. Rotation Y is therefore **0**. If an eventual asset uses a different origin or axis, transform it to these world envelopes; do not assume its source origin already matches.

| Addition | World position x / floor y / z | Outer plan envelope | Highest reserved y | Approach |
|---|---|---|---:|---|
| West arcade | `(-20, 7.2, 2)` | `x -26…-14`, `z 0.3…3.7`, **12 × 3.4** | `12.6` | Open arches face south, +Z; enter from the shared academy approach through the south face. Retain open ends. |
| East arcade | `(20, 7.2, 2)` | `x 14…26`, `z 0.3…3.7`, **12 × 3.4** | `12.6` | Mirror the western approach while keeping the central axis open. |
| Conservatory | `(55, 6.7, 22)` | `x 47…63`, `z 17.5…26.5`, **16 × 9** | `14.2` | Main door in the south long face. Approach from the contact road, turn southeast, then follow the south frontage. |
| Water garden | `(-44, 7.1, 47)` | `x -52…-36`, `z 42.5…51.5`, **16 × 9** | `8.3` for the audited low edge/plant envelope | Approach from the publications road to the northeast, then enter from the east rim. |

The arcade reservation includes roof overhang, columns and end caps. The conservatory reservation includes its main plinth, roof and cupola. A separate **4.4 × 1.5 south porch** can occupy `x 52.8…57.2`, `z 26.5…28`, with a lower step around y = 6.35 leading to the y = 6.7 floor. That porch was checked separately and retains 2.30 units to the existing workshop.

Floor y means the **finished walking surface**, not automatically the terrain grade or model origin. Fit slab thickness and foundation below it. The audit tested each main reserved volume from floor minus 0.4 up to the highest y above; a deeper footing must remain inside the same clear plan envelope. New tall planting, vines extending beyond these envelopes, and a new willow are not covered by these reservations. The existing cherry canopy already supplies a western frame for the pool.

## What was actually reconstructed and tested

- Called the real `createWorld()` and `createExhibitionStage()` constructors in Node, using current code and deterministic seeds.
- Decoded **17 botanical GLB variants** with the runtime Meshopt decoder and registered their baked geometry through `loadBotanicalAssets()`. This includes mature near geometry for landscape and blossom families and the two garden tree families. The resulting scene contains **34 landscape trees plus 13 blossom-walk trees**, with ornamental garden trees included inside the actual garden meshes.
- Loaded both actual full rock-scan GLBs through `loadScannedRockAssets()`. The final pass resolved their URLs through `asset-manifest.js`, matching runtime resources `models-environment-scans-rock_face_02-glb.f9e29a8aa1551073.glb` and `models-environment-scans-rock_moss_set_02-glb.aa7f3bd1d74cd31f.glb`. For this CPU-only audit, texture references were removed from an in-memory GLB copy before parsing; positions, indices, node transforms, quantization and geometry were retained. No source files were modified and no placeholder rock bounds were substituted.
- Reconstructed six complete buildings, six complete portals including piers/plinths, both bridges, all authored gardens and garden edges, physical signs, road lamps, three floating research books, the full exhibition platform/boards/screen/furniture, and both blossom walks.
- Examined **1,197 placed mesh/instance records** for fixed scenery and mature foliage. AABB broad-phase candidates were followed by transformed-triangle versus proposed-volume tests. This avoids treating the large bounds of a merged garden or curved road as an actual obstruction.
- Also checked the proposed volumes against the current garden, blossom and exhibition collider plane sets. All four candidates had **zero conservative collider-overlap candidates**. The source constructors returned 608 garden/world garden colliders and 7 exhibition colliders; blossom colliders were included as well.
- Calculated road gaps against **actual rendered road and irregular shoulder triangles**, rather than centreline samples alone. Garden-edge gaps likewise used actual geometry. Tree clearance uses per-instance mature geometry bounds enlarged by **0.18 on every axis**. This exceeds the current tree leaf shader's 0.07 maximum world-space bend and is deliberately conservative.
- Sampled rendered terrain over each complete footprint, including its boundaries, with spacing no greater than 0.5.

This is geometry and placement evidence. No browser, native candidate render, new-model mesh, actual traversal or UI activation was tested by this audit.

The final manifest-resolved pass repeated the four main reservations, porch, actual geometry distances, collision-plane checks and all ten approach segments. All clearance values and zero-intersection outcomes reported here were unchanged. This extra pass was necessary because source scan GLBs and the deployed compressed scan GLBs are not byte-identical.

## Clearance results

All numbers are world units. Structure bounds include full placed geometry, not the interaction radius in `locations.js`. Positive structure/crown gaps are conservative separations in plan; actual objects may be farther apart. Each final reserved volume had **zero static mesh triangle intersections**.

| Addition | Closest rendered road/shoulder | Closest relevant fixed place | Mature crown gap, with 0.18 expansion | Sampled existing ground y |
|---|---:|---|---:|---:|
| West arcade | **10.372**, about road shoulder | Fountain courtyard **6.30**; about portal **9.925**; castle **12.75** | **3.668**, silver crown west of castle | **6.651–7.884** |
| East arcade | **10.383**, about road shoulder | Fountain courtyard **6.30**; about portal **9.925**; castle **12.75** | **3.220**, silver crown east of castle | **6.086–7.257** |
| Conservatory | **5.724**, contact road shoulder | Workshop **3.80**; atelier court **17.50**; exhibition **24.60** | **1.517**, silver crown immediately north | **6.000–7.885** |
| Water garden | **4.949**, publications road shoulder | Library garden **6.50**; ruins **9.60**; library research book **15.384** | **1.557**, cherry crown southwest | **6.138–7.754** |

For the pool, exact geometry clearance to the planted library-garden edge is **6.502**, consistent with the conservative 6.50 district-bound gap. The greenhouse's separate porch retains **2.30** to the workshop, **23.10** to the exhibition, and **14.01** to the nearest road shoulder. It had no mesh or garden collider conflict in the checked volume.

Useful existing placed bounds:

| Existing object | x range | y range | z range |
|---|---:|---:|---:|
| Castle, complete | `-29…29` | `9…82.8` | `-61…-12.45` |
| About portal with piers/plinth | `-4.075…4.075` | `8.857…15.343` | `-2.5…0.5` |
| Workshop, complete | `55.5…72.5` | `6…23.325` | `30.3…44.45` |
| Exhibition, complete | `51.25…72.75` | `6.13…20.29` | `51.1…64.525` |
| Main exhibition screen frame | `54.2…69.8` | `9.38…19.08` | `52.27…52.79` |
| Library reading garden | `-80.5…-51.5` | `6.68…14.792` | `18…36` |
| Ruins, complete | `-53.9…-36.1` | `5…15.61` | `61.1…78.9` |

The constraining silver tree is rooted at `(64.0123, 7.4927, 11.6270)`, scale `1.09175`, rotation Y `5.02407`. Its expanded crown bounds are `x 59.894…68.437`, `y 11.371…17.088`, `z 7.383…15.983`. The old greenhouse envelope began at z = 13.5 and produced real branch and leaf triangle hits. The new envelope begins at z = 17.5.

The nearby cherry tree is rooted at `(-60, 5.5852, 57)`, with the actual anisotropic blossom-walk placement. Its expanded crown bounds are `x -65.730…-53.557`, `y 9.291…14.564`, `z 51.368…62.499`. Keep the pool reservation's west edge at x = -52; expanding it west would consume the remaining mature-canopy margin.

## Approaches: preserve the existing lamps

The checked corridors below clear current fixed geometry. Main-axis road joins are intentional. They still need actual surfaces, grades and collision support during assembly.

| Destination | Suggested centreline, in x/z | Clear width | Result |
|---|---|---:|---|
| West arcade | `(0,8.5) → (-20,8.5) → (-20,3.7)` | **2.2** | No fixed mesh intersections in the checked corridor bounds. |
| East arcade | `(0,8.5) → (20,8.5) → (20,3.7)` | **2.2** | No fixed mesh intersections in the checked corridor bounds. |
| Conservatory | `(37.1,21.7) → (43,27.2) → (50,27.5) → (55,27.5)` | **2.4** | No fixed mesh intersections. The last segment arrives at the south porch. |
| Water garden | `(-40,34.2) → (-34.5,41) → (-34.5,47) → (-36.5,47)` | **2.4** | No fixed mesh intersections. Enter the east rim, rather than cutting directly south from the publications road. |

The contact curve's exact t = 0.6 point is `(37.1440, 21.7246)`. The publications curve point closest to x = -40 is `(-40.0087, 33.7726)`; the tested start at `(-40,34.2)` lies within that road's paving. Small bends can smooth these polylines, but keep them inside the tested corridors; smoothing must not bulge toward nearby poles or structures.

Two tempting shortcuts failed:

- Arcade links along **z = 6** intersect the existing about-road lamps near `(-4.75,5.94)` and `(4.65,6.03)`. Move the links south to z = 8.5; keep those lamps.
- A straight northern pool entry along **x = -44** intersects the publications-road lamp near `(-43.08,37.74)`. Use the northeast/east approach above.

Approach tests used conservative axis-aligned enclosures around each segment, including full intended path width, and checked the walking/furniture height range. The diagonals' enclosures are wider than the path itself. This does not verify the final slopes or a character walk-through.

## Grade and navigation integration concerns

1. **Do not append new IDs blindly to `gardenDistricts`.** `createAuthoredGardens()` calls `factories[district.id](materials)` for every entry. Adding a new grade-only district would throw unless its garden factory is also wired. A separate v8 grade/mask composed in the terrain pipeline is a straightforward alternative.

2. Current `terrainHeight()` order is: shoreline/base landform → bridge bank adjustment → landmark circle grades → castle foundation → `gradeGardenTerrain()` → portal approach grades → bridge endpoint grades → central court grade → exhibit grades. Apply any separate v8 grade after the existing garden grade and retain the later protected overrides. Check transitions where grades meet; `gradeGardenTerrain()` itself returns the first matching district.

3. The about portal's later grade affects `|x| < 13.8` and `|z + 1| < 9`. A horizontal 12-unit arcade centred at x = ±18 would place its inner part inside that zone. The recommended centres at **±20** leave inner edges at **±14**, outside the override. Keep caps, floor and foundations inside this envelope. A blend shoulder may enter the old grade region; a finished floor must not.

4. Keep both arcade finished floors at **7.2** for one roof datum. Relative to sampled existing ground, the west needs at most roughly **0.68 cut / 0.55 fill**, and the east **0.06 cut / 1.11 fill** before accounting for slab thickness. Resolve this with supported foundations and local transitions. Do not let independently height-sampled columns tilt the arcade or give every bay a different roof height.

5. The conservatory finished floor **6.7** implies roughly **1.19 cut / 0.70 fill** across its main footprint. Its south porch is over ground **6.000–6.104**, allowing deliberate steps. A terrain blend of about 1.5–2 units can remain clear of the contact road and workshop, but the final shape must be checked. Do not spread a terrace south into the workshop's north edge at z = 30.3.

6. The pool's finished garden shelf **7.1** implies roughly **0.65 cut / 0.96 fill**. Keep water inside a supported basin and remove terrain/cover that would show through its surface. Keep the blend narrow enough to preserve the publications-road grade and the existing library garden transition north of it.

7. New raised walks and floors must enter the real support/collider system. `world.heightAt` ultimately stacks rendered terrain, road support and blossom-walk support; merely drawing a flat floor does not make it walkable. Add support using actual floor triangles, with appropriate column/wall/edge colliders. A conservatory's whole bounding box must not become a solid obstacle if the door is intended to be entered.

8. Existing grass must be masked by the new occupied footprints and their path surfaces. Per-instance low-cover bounds currently overlap the reservations **38 west / 35 east / 69 conservatory / 90 pool** times. These are potential cover overlaps, not 232 separately tested triangle collisions. No additional shrub, fern, rock or litter instance bounds from the low-vegetation groups overlapped those reservations in this pass. Filter placements after seeded sampling to avoid shifting unrelated plants throughout the island.

## Protected sightlines

Tested these nine segments against all final reserved volumes, including the south porch. All remained clear:

| View | Eye → target, x/y/z |
|---|---|
| Arrival to castle entrance | `(18,18,74) → (0,15,-12.45)` |
| Fountain court to about portal | `(0,8,43) → (0,12.1,-1)` |
| Publications route to library portal | `(-36,9,36) → (-70,10.1,24)` |
| Projects route toward exhibit screen position | `(32,9,40) → (62,14.23,53.05)`; a rear-side approach segment, not a screen-readability proof |
| Actual front side of exhibit screen | `(62,10,66) → (62,14.23,53.05)` |
| Central court to workshop | `(1,9,35) → (64,15,37)` |
| Contact route to contact portal | `(37,9,22) → (80,11.1,-48)` |
| Research route to research portal | `(-31,9,29) → (-84,10.1,-55)` |
| Water garden edge to castle entrance | `(-44,9,54) → (0,15,-12.45)` |

These are targeted non-occlusion checks, not proof for every camera position, every pixel of an exhibit, or added planting. They support keeping the castle axis, the workshop and the exhibition readable. Preserve the existing UI access to CV/projects and verify actual interactions after assembly.

## Remaining verification after assets exist

The proposed meshes do not exist in this audit. Confirm actual transformed geometry, including eaves, capitals, porch, opened doors and foliage, stays inside the reservations before relying on the measured gaps. Include wind in the new foliage bounds. The 1.52/1.56 canopy margins at the greenhouse/pool are the limiting nearby margins; avoid consuming them with unspecified decoration.

Then verify supported floors and traversable entrances in runtime, render the matched overview and the actual ground-level approaches, and inspect the full screen/CV interactions. The new scene's visual balance, glass rendering, terrain transitions and material quality remain root/native-review tasks; the concept illustrations and this CPU geometry audit cannot establish those outcomes.

Principal implementation evidence: `world/src/world.js` (`assembleWorld`, `terrainHeight`, road generation), `models.js` (all six real constructors), `gardens.js` (`createAuthoredGardens`, `worldColliders`), `exhibits.js` (`createExhibitionStage`), `botanical-cache.js` and `gltf-resource.js` (decoded geometry), `foliage-lod.js` (actual placement matrices), `blossom-groves.js`, `rock-scans.js`, `environment-wind.js`, and `surface-support.js`.
