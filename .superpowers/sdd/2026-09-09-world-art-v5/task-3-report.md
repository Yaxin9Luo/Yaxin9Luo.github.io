# Task 3 — foreground materials and layered planting

## Implemented

- Viewed `docs/art/experience-v5/garden-paintover-target.png` as the art target and the specified native v4 lilac/day frame as the actual before image. The actual frame's disconnected plant tufts and plain wall-textured walks drove this change.
- Bound the prepared three-channel courtyard-paving surface in landscape loading. Roads and blossom walks use a 2 m planar repeat, full photographic albedo, 0.45 normal scale and 0.60 roughness floor. Court paving uses the same measured repeat through the existing architectural UV adapter. Warm ivory coping has a separate smoother finish; inlay/joints are darker.
- Added irregular 0.25–0.45 m soil shoulders alongside roads. Every vertex follows rendered terrain; the visible triangles enter the same surface-support index. No terrain elevations or movement constants changed.
- Enabled existing authored planted court transitions with rendered terrain sampling. Inspected their winding and retained the already-upward orientation, with a new actual ray test.
- Increased the meadow sampling budget from 16,000 to 62,000, expanded low-plant coverage independently of tall-tree exclusions, and reserved the sampled blossom paths and overlooks. Added seven-frond, paired-leaflet fern geometry as one instanced material batch with wind depth/distance passes. Existing grass and flower geometry is reused through instancing; flowers form denser groups among ferns and grasses while low-noise areas remain lawn.
- Softened leaf/petal normal relief from 0.42 to 0.18. Added restrained direct-light-dependent backscatter and lower-crown indirect-light attenuation, preserving full cached geometry, existing detail tiers and wind/depth behavior.

## Verification

- Focused ground-world, surface-support, gardens, garden-edges, grove-foliage and landscape-detail suite: 30/30 passed.
- Additional production-world road/shoulder downward-ray versus support agreement test: passed; ground-world suite 5/5 passed again after the final shoulder-width adjustment.
- Garden transition ground is ray-visible from above. Existing garden collision equality, courtyard tile/grout walkability, actual cherry/lilac path movement, bridge exclusions and cached botanical geometry/export tests pass.
- Updated the intentional deterministic planting layout digest; retained the existing bridge-clearance assertions. Added minimum continuous-meadow/fern population checks, dimensional frond checks and fern shadow-pass checks.
- `git diff --check` passed.

## Self review and limits

The new planting uses shared instanced geometry instead of per-plant draw calls. Tall-tree placement, cached crown geometry and tree LOD policy are preserved. The low layer clears authored gardens, landmarks, bridges, paths and blossom overlooks. No new collision solids were added for decorative foliage. Road shoulders are indexed as actual support rather than being unsupported visible decoration.

Parent task owns browser shader compilation, near day/night visual acceptance and integrated build/performance evidence. This report does not claim visual acceptance from Node tests. Crown-form variants were intentionally not added: shared geometry stays exact, and this pass concentrates on layered planting, material separation and shading.

## Foreground polish after actual dusk review

Inspected `work/production-v3/captures/experience-v4-lilac-dusk-high-lod-native-frame-20260908T180332706Z-2.png`. The planting is visibly more continuous, but terrain retained broad tinted folds and the paving multiplied the dusk palette toward brown.

- Ground now ignores the legacy baked vertex colour attribute (geometry is retained), removes the broad sine/cosine rock overlay, and uses a 2.5 m physical tile instead of approximately 15 m. Normal scale is 0.30 instead of 0.70.
- Added a restrained nonperiodic three-octave soil blend: meadow remains dominant, forest humus contributes at most 18% on flatter ground, moss grows subtly with noise and more strongly with slope. Albedo, tangent-space normal and roughness use identical blend weights and a shared UV basis. Each extra channel points to its existing decoded source texture and updates when phase-two loading finishes; disposal releases its binding.
- Roads, court paving and blossom walks use neutral pale ivory-grey pigments to preserve the measured beige/grey source under dusk. Two existing park point lights increase from base 28 to 65; no additional lights were introduced.
- Corrected the low-plant comment: roots clear the path while decorative frond tips may overhang the margin. No unsupported claim of full footprint clearance remains.
- Updated stale tests to assert visible but restrained botanical relief and eight actual road centres with their paired shoulders. Existing full rendered-road/support tests remain unchanged. The material test checks loaded layer channels, matching normal/roughness blending, physical repeat and absence of the old periodic overlay.
- Focused material/cache smoke: 9/9 passed. Full integrated suite result recorded below when complete. Browser compilation and visual acceptance remain with the parent task.

The first integrated run passed 316/317. Extending the terrain test to shoulders exposed a real 1.38 mm buried shoulder triangle at a terrain crease. Shoulder geometry now has three cross-strip subdivisions and 35 mm outer clearance; visible vertices and their surface-support triangles still agree. Terrain plus production-world movement/raycast tests then passed 7/7. A final integrated rerun follows this geometry fix.

Final integrated `npm test`: **317/317 passed**, 0 failures, approximately 34 seconds. Output: `/tmp/world-v5-foreground-polish-tests-final.log`. Final `git diff --check` passed. No browser visual acceptance or build is claimed by this worker.

## Final grass pigment and missing-channel correction

Viewed `work/production-v3/captures/experience-v5-lilac-dusk-high-lod-native-frame-20260908T181454256Z-1.png`. The physical-scale texture fixed the broad paint but revealed the source meadow's dry brown pigment. The grass base now mixes 72% toward a restrained fern-green pigment normalized to the original texel luminance. Fine texture contrast and luminance remain intact; humus and moss are blended afterwards and retain their separate colours. No geometry, normals, lights or paving changed in this final pass.

Missing channels now have shared type-correct fallbacks: flat tangent normal `[128,128,255]` in `NoColorSpace`, white matte roughness in `NoColorSpace`, and the existing neutral sRGB rock colour. A new regression test verifies both never-loaded and HTTP-404-failed surfaces, the decoded tangent normal direction, shared fallback objects and the luminance-preserving grade ordering. Focused terrain/material tests: **6/6 passed**. `git diff --check` passed. Parent retains actual day/dusk/night and final full-suite/build acceptance.
