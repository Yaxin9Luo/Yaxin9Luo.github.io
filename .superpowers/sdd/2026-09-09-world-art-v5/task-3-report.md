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
