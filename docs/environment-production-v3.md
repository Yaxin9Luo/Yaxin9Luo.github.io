# Academy environment production v3

This revision adds real scanned geology to the castle banks, bridge abutments and selected shore sections; replaces peripheral rectangular planters with irregular jointed fieldstone beds; and selects tree surface detail by projected size and distance. The central courtyard geometry, 0.5 m terrain grid, 32 cliff bands, existing architecture materials and portal coordinates remain intact.

## Actual scanned geometry and PBR

| Asset | Authors | Geometry | Runtime GLB |
| --- | --- | ---: | ---: |
| [Rock Face 02](https://polyhaven.com/a/rock_face_02) | Dario Barresi; processing by Rico Cilliers | 29,566 triangles | 18,219,896 bytes |
| [Rock Moss Set 02](https://polyhaven.com/a/rock_moss_set_02) | Kless Gyzen | 57,647 triangles across seven stones | 13,597,844 bytes |

Both assets use Poly Haven's [CC0 license](https://polyhaven.com/license). `world/public/models/environment/scans/manifest.json` records authors, URLs, units, individual mesh bounds, source scales, texture dimensions, derivative encoding and SHA256. `sources.json` contains the official download package and `source-downloads.json` records publisher MD5 plus the SHA256 of all ten original glTF, binary and JPEG files. The originals occupy 46,866,901 bytes under `work/production-v3/environment-sources/` and are kept outside the deployable tree.

Every source vertex/index/normal/UV byte is unchanged. The six PBR images retain their native 4096 × 4096 dimensions: diffuse and packed AO/roughness/metal channels use WebP quality 95; tangent-space OpenGL normals use quality 100, all with method 6 and no resizing. The runtime GLBs use `EXT_texture_webp`. These are explicit offline encoding choices, with original JPEG files retained. There is no runtime material or resolution reduction. The AO channel is applied at strength 0.75. Diffuse maps remain sRGB; normals and packed maps remain non-color data. Each stone keeps its source scale, is centred in XZ and grounded at its mesh minimum Y; the publisher's presentation-layout translations are omitted for individual placement. Reported runtime bounds come from actual mesh accessors, rather than assuming the asset page's overall displayed width equals a single piece's width.

`loadLandscapeAssets()` awaits the scanned GLBs and six physical sign textures. Loading failure goes through the application's existing asset-load error path. Procedural spheres are not substituted for missing scans. Node-only geometry tests can construct the world before asset loading; in that case scan groups explicitly report `assetReady: false` and contain no fake rocks.

## Composition and scale

`world/src/environment-composition.js` provides jointed, bevelled limestone and mossy masonry courses around the castle's outer plinth. Six uneven strata groups and smaller moss stones meet those courses. Eight regional planting ribbons use varied low shrubs, heather, muted ivory and ochre flower groups. The original botanical leaves, flowers and stems remain physical opaque surfaces.

Both ends of both bridges receive large scanned abutment stones aligned to their actual parapet axes. Selected coast sections use the real clipped shoreline edges and their outward gradient; they are not placed from the graded height function alone. After the bridge/cliff silhouette refinement, the current seeded world requests 157 composition scan instances. Of these, 54 large face instances form 20 staggered groups over five targeted coast runs. Existing regional shrubs and flower sprays remain part of the bank composition. The ordinary grove outcrops and small ground stones also use the seven scanned moss stones. Gaps between shoreline sections expose the existing continuous 32-band cliff mesh; this is an authored treatment of junctions and representative shore runs, not a claim that every cliff face has been replaced by photogrammetry.

Outer district beds use an asymmetric outline and individual bevelled fieldstone joints. Their planting height stays compatible with existing shrubs and trees. The courtyard keeps its original formal limestone beds and its geometry is unchanged. Existing useful books, timeline board, correspondence folder, research instrument and their collision/interaction anchors remain intact.

Six physical enamel-and-brass signs carry a large portfolio function and a smaller regional motif in both languages: ABOUT / 关于我, PAPERS / 论文, PROJECTS / 作品, EXPERIENCE / 经历, RESEARCH / 研究, and CONTACT · CV / 联系 · 简历. The textures are locally generated from the existing Inter font and installed Chinese glyphs; no personal claim or new timeline fact is added. The plaque meshes are ordinary PBR surfaces attached to bevelled stone posts.

## Foliage detail contract

`createVegetation(root, heightAt, nearPath)` retains its old full-detail, browser-independent interface. `createWorld` explicitly requests the new spatial LOD path. The seeded world contains 38 grove trees in 16 kind/spatial chunks; the existing maximum remains 64, and no new tree-density reduction is introduced.

| Tree / seed 168 | Near | Mid | Far | Botanical pieces retained at every tier |
| --- | ---: | ---: | ---: | --- |
| Silver broadleaf | 74,016 | 39,296 | 30,274 | 4,065 leaves; 327 branches |
| Pine | 78,280 | 40,772 | 39,588 | 17,380 needles; 256 branches |
| Cherry | 76,010 | 51,484 | 50,592 | 1,647 leaves; 239 branches; 915 flowers |

Near geometry is byte-identical to the pre-revision tree review GLBs for every geometry accessor buffer; `work/production-v3/environment-near-geometry-proof.json` records the baseline commit and hashes. Mid/far variants reduce individual curved surface and branch tessellation, preserving every leaf, needle, flower and shoot. The cherry tiers retain complete petal boundary vertices and eight-point leaf outlines because an earlier smaller far mesh lost too much projected coverage. Pine needles retain their four outline points as two physical triangles. There are no alpha cards or canopy blobs.

Projection uses the supplied viewport's actual pixel height and camera projection matrix. Near entry uses more than 260 pixels or less than 34 m from the conservative canopy sphere. Near exit requires less than 220 pixels and more than 43 m. Far entry requires less than 76 pixels and more than 125 m; far exit uses more than 96 pixels or less than 108 m. Exact thresholds are in `FOLIAGE_LOD`. Hysteresis avoids rapid switches around boundaries; near reentry happens in the same update. Updating without a camera or valid viewport retains the current selection, initially near.

Each spatial/LOD batch keeps proper world-space instance transforms and conservative bounds. Rebuilds happen only when tree tiers change. Empty-tier batches are hidden; occupied batches retain `castShadow` and ordinary Three.js frustum culling, so offscreen trees are still available to the shadow and reflection cameras. No camera-frustum boolean is used to remove their shadows. The exact same world-space breeze clock/direction deforms visible and custom depth/distance passes. Rotated/scaled instances undo their transform when applying world-space wind. Grass, meadow flowers and small world lantern motes share direction `(1, 0, 0.55)`, normalized. Paper/released lantern integration is owned by the root atmosphere work.

Integration:

```js
world.update(time, dt, reducedMotion, camera, {width: canvas.width, height: canvas.height});
// Optional when camera movement happens after the ordinary world update:
world.updateVegetation(camera, {width: canvas.width, height: canvas.height});
const counts = world.vegetation.lod;
// Explicit controlled geometry baseline; all render settings stay constant:
world.vegetation.lodController.setEnabled(false); // restore near everywhere
world.vegetation.lodController.setEnabled(true);
```

Stats include near/mid/far tree counts, chunk count, occupied batches, total submitted tree triangles, full-detail tree triangles, transitions and update count. `submittedTriangles` counts all occupied tree batches, not just main-camera-visible triangles and not the whole scene. `foliage-lod-manifest.json` contains the policies and exact seed-168 geometry counts.

## Verification and visual limits

The focused environment, garden, terrain and foliage suite passed 23 tests. Seven new/changed focused tests were repeated after the final baseline-control and upward-facing ground-patch assertions. They check publisher geometry identity, all three PBR channels plus AO, source hashes, bilingual physical signs, grounded low planting, boundary hysteresis and reentry, instance transforms under a transformed parent, explicit baseline restoration, all tiers' botanical counts, near geometry retention, offscreen shadow availability, and shared wind in visible/depth/distance passes. The existing floor, portal, exhibition, collision, content-anchor and export checks remain included. The production world build passed.

`scripts/art/environment/check-lod-coverage.mjs` casts 20 × 24 orthographic rays across the exact same near bounds, for two principal axes on all three trees. The final mid tiers preserve 96.35–99.13% of near opaque crown ray coverage; far tiers preserve 93.30–99.13%, with matching Jaccard ranges. Exact results are in `work/production-v3/foliage-lod-coverage.json`. This geometric sampling checks projected occupancy, not temporal perception, flight performance or GPU cost.

Studio factories for live inspection are `createScannedRockSpecimen('face'|'moss')` from `rock-scans.js` and `createFootingSpecimen()` from `environment-composition.js`. The latter uses the same production masonry, scanned rock pieces and plants. `scripts/art/environment/render-scan-review.py` rendered the exact runtime GLBs under neutral/day/night lighting into `../qa/academy-v3/environment/`. All six lighting images were visually inspected, including corrected full-silhouette framing and individual grounding. Strata, fractured edges and moss texture remain visible under neutral/day light, with subdued readable relief at night. The isolated render job finished successfully. Root owns the final integrated browser views, flying transitions, frame/GPU/long-task/interaction-delay measurements, and hardware-specific acceptance. Static source renders and tests do not establish those outcomes.

The six full-size 4K scan maps have a material GPU-residency cost (approximately 512 MiB with uncompressed RGBA mip chains before driver-specific storage), and the new geology adds geometry. The 31.8 MB GLB payload is explicit. Tree triangle savings alone are not a claim of a faster complete scene. Quality settings, renderer DPR, AO, MSAA, shadow resolution and shadow frequency are untouched by this environment revision.

Reproduction:

```sh
python3 scripts/art/environment/fetch-rock-scans.py
python3 scripts/art/environment/build-rock-scans.py
node scripts/art/environment/build-wayfinding.mjs
node scripts/art/environment/export-assets.mjs
node scripts/art/environment/check-lod-coverage.mjs
node --test world/tests/foliage-lod.test.js world/tests/environment-composition.test.js world/tests/gardens.test.js world/tests/terrain.test.js world/tests/grove-foliage.test.js
npm --prefix world run build
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/art/environment/render-scan-review.py
```

The downloader accepts optional `ACADEMY_ASSET_PROXY`; it uses verified TLS and HTTP/1.1. Texture encoding needs Pillow, signage/export uses the existing environment art-tools package, and the signage script expects the macOS installed Chinese font used in this workspace.

## Waterline rock groups and bridge clearance

Final integrated review restricts the new geology to the waterline: 24 existing volumetric moss-set scan instances form 15 groups, nine of which contain two connected stones. Every rock intersects the -15 m lake surface; their overall bounds are -20.465 to -9.203 m. Middle and upper cliff surfaces have no new isolated rock bodies. The original continuous terrain and cliff geometry remain unchanged.

The 24 rocks keep 198,796 full source triangles across 17 existing piece/cell batches. Original geometry, UVs, normals, GLB files and native 4K PBR maps are unchanged. A shared-map per-instance coastal tint is the only colour adjustment. The open rock-face scan is not used for these waterline groups; no folded scan borders or vertex deformation shader remain.

Installation uses actual source front/back triangle intersections against the real cliff. Upper stones require at least three vertical surface-contact samples with the lower stone, and every stone extends below the lake. Source vertices enforce channel clearance; conservative transformed bounds reserve bridge and portal approaches. The common scanned-rock assembly also excludes the bridge deck/landing volume, covering scattered grove stones as well as authored footings. It preserves adjacent and submerged rock placement.

`work/production-v3/cliff-refine-layout.json` contains exact source pieces, transforms, contact samples and clearance data. The final focused suite passed 18 tests, including six cliff/source/contact/bridge checks and the existing provenance, terrain, materials and garden-edge checks. Root performs final integrated capture and performance acceptance; geometric checks alone do not establish those outcomes.

The committed scan manifest also records each original publisher buffer's offset, length and SHA256. The provenance test hashes the corresponding geometry bytes inside the committed GLB, so it works in a clean checkout without ignored source downloads. The packaging script emits these records after reading the actual source buffers; this does not add duplicate BIN payloads or skip source verification.

## Cliff UV continuity and bridge planting

The cliff shell assigns one dominant projection axis per triangle and duplicates vertices only where adjacent triangles require different UV axes. Original triangle order, index count, position and smooth-normal values are preserved, including the 32-band shoreline segment layout used by rock fitting. This prevents unrelated x/y/z coordinates from interpolating across a single triangle. Ground mapping, material and image resolution are unchanged. The integrated shore-detail review confirmed that the broad stretched bands disappeared.

All general vegetation and authored shore shrub/flower batches share the bridge-span/landing exclusion dimensions. Filtering happens during final instance assembly, so all seeded sampling and every outside-bridge transform and flower colour remain unchanged. The regression digest was captured from the pre-fix layout with only bridge rectangles excluded. The actual cliff-triangle UV checks and initial planting/waterline suite passed 11 tests; the final authored-shrub bridge assertion is included for the full integration run.
