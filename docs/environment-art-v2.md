# Academy environment production — 2026-09-08

The outer academy now has a deliberately composed 36 × 42 metre courtyard, with the existing star fountain remaining at `(0, 6, 35)`. Its paving, double borders, hollow fountain basin, raised tree beds, pointed pergola ribs and benches provide the intermediate scale between a rider and the castle. The same warm limestone, blue grey slate, aged brass and silver green planting continue through the reading garden, atelier court, wayfarer landing, correspondence landing, observatory terrace and both bridge thresholds.

Within the six authored districts, only the courtyard contains a tall pink tree; the small lilac accents remain flower borders. Outer trees and ground details are distributed inside eleven named groves instead of across almost every available patch of land. World coordinates and landmark portal positions are unchanged. The courtyard's north approach and northwest exit were shaped to keep the fountain bypass and pergola bays clear. Runtime stone, wood, brass and book-cloth materials retain the parallel PBR refinements described in `docs/material-refinement-v2.md`.

## Geometry and layout

`world/src/gardens.js` is the original, exportable geometry source. `world/src/environment-layout.js` is shared by terrain grading and vegetation exclusion. Each district is a local group; the district table supplies its placement. World metres and +Z fronts match the existing architecture factories.

| District | Centre x / z | Width × depth | Ground y |
| --- | --- | --- | --- |
| Courtyard | 0 / 31 | 36 × 42 | 6 |
| Library reading garden | -66 / 27 | 29 × 18 | 7 |
| Atelier court | 64 / 55.5 | 40 × 23 | 6 |
| Wayfarer landing | -45 / 84 | 24 × 18 | 5 |
| Owl post landing | 83.5 / -50 | 23 × 17 | 8 |
| Observatory terrace | -84 / -59 | 22 × 14 | 7 |

The post and observatory placements were adjusted after checking the actual clipped ground triangles. Checking `terrainHeight` alone would have missed a post corner extending over the island outline. Their existing portals remain `(80, -48)` and `(-84, -55)` respectively.

The atelier reserves x `[51,73]`, z `[51,65]` for the separately implemented media stage. Its floor top is y `6.17`; exterior props remain on the sides. Existing research book placements are preserved.

Geometry batches by material within each district. The garden lanterns are instanced together. Five restrained local point lights have no realtime shadows. Trees have curved branches, actual individual leaves and a small shared wind deformation. The raw GLBs are independent reviewable assets; runtime uses the same geometry factory so no additional garden GLB download is required during play. The quality budget preserves the authored surfaces: the courtyard alone contains 636,442 triangles, including its planted beds and trees.

## Runtime integration contract

`createWorld(scene)` now returns:

- `atmosphere`: the existing atmosphere object for the root time controller.
- `lake`: `{water, update}`, exposing the existing Three Water uniforms.
- `gardens`: the authored district group, update hook, lamp sites and lighting contract.
- `environmentColliders`: world-space convex-plane solids in the same format as `collision.js`. Root appends them to the per-Game building collider array. Pergola openings stay open; proxies cover its actual piers and beams rather than the whole pavilion. Low planter, furniture, fountain and bridge-threshold solids have their own height ranges.
- `clockTargets`, also `gardens.clockTargets`: real central armillary meshes with `userData.environmentAction = 'time'`. `gardens.clockPosition` is `(0,10.46,35)`. Root implements input, nearby E and time changes. The four pale stone markers belong to the visible instrument.
- `gardens.contentTargets`: the 19 actual meshes belonging to four useful portfolio props. Each mesh has `userData.portfolioAction` and `userData.portfolioLabel` (`{en,zh}`). Paving, ordinary planters and unrelated furniture are not interaction targets.
- `gardens.contentAnchors`: four `{position:Vector3, action, label}` entries, in world coordinates, for root's nearby E interaction. These stay within the visible prop bounds, and root owns the actual content interface or PDF action.
- `environmentLighting.emissiveMaterials`: `{material, baseIntensity}` entries for the actual non-black emissive scene materials.
- `environmentLighting.lights`: `{light, baseIntensity}` entries for the five local garden lights.
- `environmentLighting.nightMaterials`: `{material, uniform:'nightFactor', baseValue:1}` entries for lamp halos and ground light materials.
- `environmentLighting.nightObjects`: `{object, baseOpacity}` entries for the remaining decorative nocturnal motes and small lantern particles. Root owns their phase blending.

`world.update()` updates the armillary and shared planted-crown wind. Reduced motion disables both animations. Main game lighting, day/night state, atmosphere and game input remain owned by the root integration.

| Visible prop title | Action | World anchor x / y / z |
| --- | --- | --- |
| PUBLICATIONS, on the library reference shelf | `{kind:'section',id:'publications'}` | -61 / 8.75 / 21.8 |
| EXPERIENCE, on the timeline board | `{kind:'section',id:'journey'}` | -52.7 / 7.16 / 79.3 |
| CV, on the correspondence folder | `{kind:'cv'}` | 87.38 / 10.31 / -46.84 |
| RESEARCH, on the observatory instrument | `{kind:'section',id:'research'}` | -89 / 9.73 / -55.05 |

The timeline's 2021, 2025 and 2026 marks come from the existing experience data. Titles are real mesh letters, using a small outline subset generated from the existing OFL-licensed Inter font in `world/public/fonts/`; the original license remains there. `scripts/art/environment/build-signage-font.py` reproduces the checked-in `world/src/signage-font.json` using `fonttools` and `skia-pathops`. Overlapping font contours are merged before triangulation: Inter's V tip otherwise produced an incorrect filled triangle. These are asset-build dependencies only; there is no new runtime dependency or network font request. Re-running the font script is only necessary when the subset or source font changes.

## Reproduction and evidence

Run from this repository:

```sh
npm --prefix scripts/art/environment ci
node scripts/art/environment/export-assets.mjs
node --test world/tests/gardens.test.js world/tests/grove-foliage.test.js world/tests/terrain.test.js world/tests/collision.test.js
npm --prefix world run build
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/art/environment/render-assets.py -- grove-silver grove-pine grove-cherry garden-shrub garden-flower courtyard reading journey astral post
```

The six GLBs and their exact geometry/bounds/material manifests are under `world/public/models/environment/`. The neutral Blender PNGs and inspectable `.blend` review scenes go outside the deployable tree to `../qa/academy-v2/environment-assets/`. The render script uses Cycles, 24 samples, denoising and isolated factory startup. No external app session is changed.

The geometry checks verify:

- graded supports and actual triangle-mesh support at each district's centre and edge samples;
- unchanged portal locations and open academy axis / fountain circuit / western promenade;
- an open, usable pergola interior with colliding masonry and beams;
- a clear reserved exhibition footprint;
- GLB signatures, byte counts, triangle counts and bounds against fresh runtime factories;
- real light/material references and clock target geometry;
- four distinct content actions attached to real prop meshes, with bounded world-space reading anchors and no accidental paving targets;
- opaque, textured leaf surfaces with sufficient projected area from two viewing directions, hundreds of small disconnected leaf/needle pieces instead of metre-sized spheres, and the normal instanced vegetation path without browser tree assets;
- nonempty embedded pigment/normal textures in the foliage GLBs, catching blank Canvas exports;
- one connected, widening root-collar surface, rejecting detached root spikes.

The focused environment, foliage, terrain and structural-collision suite passed 32 tests. A production Vite build also passed; root repeats the whole application checks with the other workers' integration. Neutral studio images were actually inspected for paving continuity, basin wall depth, canopy volume, furniture contact, pergola opening and readable prop titles. `reading-detail.png`, `journey-detail.png`, `post-detail.png` and `astral-detail.png` show the four physical content props. `reading-desk-detail.png` shows bowed open pages with fine surface lines, and the hollow glazed teacup, saucer, handle and tea surface. Its desk collision envelope is unchanged. These images establish the geometry under studio lighting. Root's Three.js desktop/mobile screenshots and runtime checks establish the integrated day/night result, click/E behavior and performance; the studio images do not establish those outcomes.

The existing architecture GLB review files retain their historical texture-based material pipeline. Browser-loaded stone and wood PBR maps belong to runtime materials; the offline garden GLBs retain their base colour and standard material properties. The procedural foliage pigment and normal maps are embedded in the review GLBs. Custom wind shaders are runtime-only.

## Botanical geometry and visual refinement

The first integrated screenshots exposed disappearing alpha-tested leaves and a dominant thin branch network. A replacement made from large opaque crown shells kept its silhouette, but the user correctly rejected its smooth, grape-like appearance. The current geometry replaces both failure modes with many small, opaque botanical surfaces. Tree detail is checked in close, medium and approximately 120-pixel-tall distant Blender views before the final integrated Three.js review.

`world/src/grove-foliage.js` exports `createGroveTree(kind,seed)`, `createGroveShrub(kind,seed)`, `createGardenFlower(kind,seed)` and `updateGroveWind(seconds,reducedMotion)`. Each factory returns a group containing two meshes, exposed as `branchesMesh` and `leavesMesh`, plus `userData.botanicalDetail` counts. Root instances those two meshes over the existing 64-tree budget and named grove placements. Dedicated shrubs originate at ground zero; they do not shrink or translate a whole tree. Garden planting uses the same factories and preserves the botanical UVs while merging by material.

| Asset | Triangles | Individual leaves / needles | Branches | Flowers |
| --- | ---: | ---: | ---: | ---: |
| Silver broadleaf | 74,016 | 4,065 | 327 | 0 |
| Layered pine | 78,280 | 17,380 | 256 | 0 |
| Warm pink cherry | 76,010 | 1,647 | 239 | 915 |
| Low garden shrub | 9,456 | 540 | 48 | 0 |
| Close garden flower spray | 3,288 | 6 | 6 | 6 |

Broad leaves have a folded, smoothly shaded outline and authored vein relief. Pine needles form overlapping three-dimensional sprays. Cherry flowers have separate petals; close garden flowers add finer cupped surfaces and physical stamens, connected to the main stem by lateral flower stalks. Shrubs carry leaves at low, middle and upper stem positions. Trunks and main boughs use curved tapered sections; five rounded root ridges belong to the same continuous surface as the widening root collar. Bark detail varies along the stem with interrupted grain and small knot patterns. These original local DataTextures are fully opaque and shared between plant materials, with mipmaps and anisotropic filtering. Indexed vertices reduce duplicate storage without removing triangles.

The export tool uses the isolated `@napi-rs/canvas` art dependency to encode those textures. It explicitly adapts Canvas inputs before GLTF export: a native Canvas `data()` method previously caused Three.js to mistake the canvas for raw pixel data and produce transparent images. Nonempty embedded PNG checks and independently inspected pixel data confirm the correction. No Canvas dependency is added to the runtime bundle.

`grove-*-studio.png`, `grove-*-detail.png`, `grove-*-base.png` and `grove-*-distance.png` record the tree checks. `garden-shrub-studio.png`, `garden-flower-studio.png`, `courtyard-low.png` and `reading-desk-detail.png` record the near-ground and prop checks. The six garden GLBs and both manifests are regenerated together after geometry changes; their counts are checked against fresh factories rather than an old polygon budget. Root's subsequent Three.js views determine the integrated lighting, detail readability and performance.

## Final perimeter refinement

The follow-up is limited to `gardenEdges()`. Its stones now reuse the same decoded `mossy-rock` pigment, normal and roughness maps as the surrounding landscape. Three original 3,380-triangle forms add unequal weathered sides, shallow erosion hollows and cut upper faces. The obsolete crown spheres are removed. Six planting ribbons have unequal lengths along the central court flanks, library front and atelier front; their low shrubs and flowers remain outside the paving and the exhibition viewing lane. Forest-ground PBR beneath them follows the sampled terrain, with upward-facing triangles and clipped gaps at approaches.

The placement guard checks each object's footprint against the provided path mask, garden paving, land support and exhibition viewing lane. `edgePlacements` metadata is available on the transition group for geometry inspection. A direct code check using the current world's sampled paths and `renderedTerrainHeight` produced 51 shrubs, 23 stones and 12 flower groups in 8 material batches, with zero generated vertices inside the road mask. The maximum vegetation height above the varying hillside was 1.43 m; the local shrub geometry itself remains below one metre. Root owns the integrated preview and day/night colour assessment.

Run `node --test world/tests/garden-edges.test.js world/tests/gardens.test.js world/tests/materials.test.js` for the focused checks. All 14 passed, followed by a successful Vite build. They verify actual PBR references, geometric erosion, path clearance, low vegetation, unchanged collision/content anchors, and the six existing GLBs against their factories. This perimeter geometry is runtime-only: the six district factories, GLBs and manifests were not regenerated or changed for this follow-up.
