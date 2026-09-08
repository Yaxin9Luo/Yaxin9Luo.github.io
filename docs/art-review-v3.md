# Production v3: fixed-courtyard art review

Reviewed 2026-09-08. This records a read-only inspection of an actual browser frame and its corresponding lighting, atmosphere, foliage, and rendering implementation. The proposed settings below are candidates for controlled comparison, **not visually accepted final settings**.

## Evidence

Actual frame: [current-court-night-high-lod-frame-20260908T115657333Z-1.png](evidence/production-v3/courtyard-initial-native.png).

Absolute source path:
`/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-experience-v2/work/production-v3/captures/current-court-night-high-lod-frame-20260908T115657333Z-1.png`

The image is 1280 × 720. The review page declares a 1024 × 576 CSS viewport; that matches effective DPR 1.25. Its still exporter calls `canvas.toBlob()` directly, without resizing. The PNG alone does not record the device's actual MSAA sample count. The accompanying `qa-smoke-*.json` is explicitly transport-smoke evidence and does not establish rendering performance.

The fixed review camera is eye `[30,27,79]`, target `[0,10,28]`, FOV 43°. This composition is a repeatable courtyard comparison. The cropped upper castle is not evidence about the quality of the application's other camera compositions.

Sources inspected: `world/src/game.js`, `environment-time.js`, `atmosphere.js`, `rendering.js`, `render-quality.js`, `grove-foliage.js`, `foliage-lod.js`, `landscape.js`, `gardens.js`, and `quality-review.js`.

## Appearance and cause

The castle already has readable edges, recessed windows, buttresses, roof courses, and steps. The fountain, paving, benches, mountain layers, and warm windows are also distinct. The broad castle walls and large ground planes look similarly lit and muted, while leaves and flower fragments carry many small bright edges. The primary issue is tonal and color organization; increasing polygon counts would not resolve it.

At the time of inspection, `sampleEnvironment(TIME_PHASES.night)` used:

| Parameter | Inspected value |
| --- | --- |
| Key / hemisphere / fill intensity | 3.1 / 2.1 / 1.25 |
| Key / sky / ground / fill color | `#c3deff` / `#b6d1eb` / `#737b83` / `#ffdab8` |
| Exposure | 1.16 |
| Zenith / horizon / cloud / fog | `#152d59` / `#6382a0` / `#6386a4` / `#46617c` |
| Fog density | .00135 |
| Castle facade point intensity | 220; two other accent points 75 each |
| Fill position | `[60,80,100]` |

The calculated moon key direction was approximately `[-.297,.368,-.881]`, elevation 21.6°. The camera sees the castle from positive X/Z, so the +Z front and +X side both face away from this key. They largely depend on the pale hemisphere and camera-side warm fill, reducing both plane contrast and the separation between cool night surfaces and local warm windows. Fog is not the principal cause of the near courtyard's flatness: the configured exponential fog weight is only about 0.45% at 50 units and 1.81% at 100 units.

## Three controlled recommendations

1. **Rebalance the existing night lights while keeping a bright directional key.** First candidate: hemisphere 1.75, key 3.35, fill .90, ground `#596d88`, fill `#b7ccec`. Retain key `#c3deff`, sky `#b6d1eb`, exposure 1.16, and the existing sky/fog palette. Keep the facade point at 220 in the first comparison. This modestly lowers broad ambient fill and moves global reflected light toward cool blue, leaving warm accents localized. If the entrance becomes too subdued in the actual frame, test only the castle point at 280 next. If the front and side remain too similar after the palette comparison, separately change fill X from +60 to -45, retaining Y=80, Z=100 and intensity .90. This tests directional modeling without changing geometry, AO, or exposure.

2. **Make a few existing flower trees read as coherent pale-lilac groups.** Current tree construction supports lilac, but the landscape tree families are pine/silver/cherry, and authored garden trees choose silver or cherry. Trial one or two existing flowering trees as lilac. Increase only those trees' flower radii from roughly .085–.09 to .11–.12, keeping their count. Organize silver-green pigment by branch/spray, with smaller variations within each group, instead of independent strong per-leaf value changes. The aim is recognizable crown and flower groups at the courtyard scale, using existing geometry and retaining open architectural sight lines.

3. **Separate the sampling question from art changes.** The high policy caps DPR at 2.5 and 8.5 million pixels but also caps it at native DPR, so a 1.25 device remains at 1.25. High requests four offscreen MSAA samples, clamped to the device maximum. Current tree leaves are opaque modeled geometry with mipmapped pigment/normal maps, not alpha-cut cards; alpha-threshold changes therefore do not address these crown edges. At 720 pixels tall and FOV 43°, an unscaled .12-unit leaf is only about 2.2 pixels wide at 50 units and 1.1 pixels at 100 units, before foreshortening and the authored garden's .78 horizontal scale. Higher sampling can materially improve these edges, but cannot account for broad walls looking gray. Compare Native with the explicit 2.5 sampling option using the same camera, full geometry, fixed night, and fixed wind time. Record CSS size, backing size, actual DPR, and actual MSAA samples with the result. Production quality changes should follow the real image and cost comparison.

The inspected LOD changes tessellation rather than deleting leaves, flowers, or shoots, and all tiers share their materials. Sparse-looking crowns in this frame should therefore not be attributed to an assumed aggressive leaf-count reduction.

## Acceptance still required

Root owns the lighting edits, real browser comparisons, and recording. This review did not change core lighting or foliage and does not establish that the candidate palette, crown adjustments, or supersampling meet the final visual/performance goal. The desired result remains a bright, clearly modeled castle and blue moonlit world, distinct warm windows/lamps, and readable pale-lilac tree groups.

## Follow-up: actual A/B/C courtyard captures

Root supplied three additional frames using the same courtyard camera, complete foliage geometry and explicit 2.5 sampling. All three were visually inspected:

| Frame | Conditions | Evidence |
| --- | --- | --- |
| A | Original warm global fill | [120944304Z](evidence/production-v3/courtyard-light-a.png) |
| B | Candidate cool fill and reduced hemisphere | [121234264Z](evidence/production-v3/courtyard-light-b.png) |
| C | B plus night fill X = -45 | [121645216Z](evidence/production-v3/courtyard-light-c.png) |

The independent visual review supports retaining C for this courtyard comparison. A → B reduces the broad beige-gray wash over masonry and makes the blue night surfaces and amber windows more distinct. B → C gives the left building's side wall, castle side towers and entrance edges clearer relationships between light and shade. The front facade, steps and paving remain readable. The right lawn becomes quieter, but its path edges and local lamp pools remain distinct; these frames do not justify raising global exposure again.

This is a selection among the supplied courtyard lighting samples, not final acceptance of the whole world, foliage revision or performance. Guardians, particles, and the fountain instrument are in different dynamic states even though wind was fixed. No whole-frame pixel-difference metric was used; the assessment compares static architecture, paving and light color. The original native-versus-higher-sampling question remains a separate comparison.
