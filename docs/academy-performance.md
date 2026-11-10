# 3D Academy rebuild: performance and game

The "3D Academy" entry now loads a lean, purpose-built game (`world/src/academy/`) on the original map: the same islands, six landmarks, bridges and lake, drawn in a stylized low-poly moonlit style and played as **Moonlit Trials**, an arcade broom-flight game. The original high-detail world is unchanged and still loads with `?academy=classic`; the asset studios and review pages that use it are untouched.

## Before and after

Same machine (Apple M2 Pro, 16 GB), Google Chrome headless on the real GPU (ANGLE Metal), production build served locally, measured by `world/scripts/bench-academy.mjs`. Frame figures are p50 unless stated.

| | Before: original world, default "high", 1440×900 @2× | After: lean Academy, default tier, 1440×900 @2× |
|---|---|---|
| Time to interactive | 16.1 s (5.4 s in a warm-disk rerun) | 0.27 s |
| Time to fully loaded | 162 s (77 s warm) | 0.27 s |
| Bytes downloaded | 400 MB, 183 requests | 1.5 MB, 6 requests (terrain 322 KB, 40 KB gzipped) |
| Main-thread blocking during load | 137 s total, longest task 22.8 s | 0 ms, no task over 50 ms |
| JS heap | 1.75 GB | 13 MB |
| Frame rate | ~3 FPS | 60 FPS (display-locked), 0 frames over 33 ms |
| CPU per frame (flying) | 292 ms | 0.7 ms |
| GPU per frame (flying) | 297 ms (spawn 580 ms) | 1.3 ms |
| Draw calls per frame | 2.1–3.7 K (bird's-eye 9.6 K) | 23 |
| Triangles per frame | 73–129 M (bird's-eye 290–340 M) | 52–70 K |

Low tier, 1366×768 @1× ("old laptop" settings):

| | Before ("low") | After (low) |
|---|---|---|
| Time to interactive / full | 9.5 s / 133 s | 0.22 s / 0.22 s |
| Frame rate | ~3 FPS (CPU 277–297 ms, GPU 53–267 ms) | 60 FPS (CPU 0.6–1.4 ms, GPU 0.5–0.6 ms) |
| With CPU throttled (Chrome DevTools emulation) | 4×: 1.4 s per frame | 6×: 60 FPS held, 0 frames over 33 ms |

What these numbers do not show: no physical old laptop was tested. An Intel UHD 620-class GPU is roughly 15× slower than this one, which puts the low tier at roughly 8–9 ms of GPU per frame; that is an estimate, not a measurement. Chrome's CPU throttling stretches long tasks more than short ones, so the throttled runs show headroom rather than an exact old-CPU frame time. Safari and Firefox were not measured.

## Why the original world was slow

- **CPU:** about 65% of frame time re-evaluated the procedural terrain function (`world.js` `terrainHeight` and shore fields, plus ground-motion queries) many times per frame; drawing was about 15%.
- **GPU:** 7 M+ triangles in view from the spawn point (the castle alone is 424 K), drawn 3–4 times per frame: MSAA beauty pass, GTAO normal prepass, water reflection whenever the camera moved, and a 4096² shadow map every fourth frame.
- **Load:** 400 MB of models, HDR and textures (production serves many from raw GitHub URLs) and procedural district assembly on the main thread.
- **No adaptation:** "high" was the default for every device and, by design, never lowered itself.

The low tier was just as slow, because the cost was the scene and the per-frame CPU work, not post-processing. That is why this is a rebuild rather than tuning.

## How the lean Academy stays fast

- **Terrain:** baked once into a 1 m height grid (`scripts/bake-academy-terrain.mjs`) from the same `terrainHeight`, so every physics or camera query is one bilinear lookup. A test checks the grid against the original function.
- **Draw calls:** static landmarks are merged into two geometries (lit stone and unlit glow); trees are three instanced meshes. Glows, stardust halos, wisps and particles are additive point sprites, one draw call per set.
- **Shading:** one sky shader (gradient, stars, moon), distance fog plus valley haze, and vertex colours with flat shading. The water shader gets shoreline foam and moon glitter from an 8-bit depth texture, with no reflection pass. The rider casts a blob shadow. There is no post-processing pass.
- **Quality:** the starting tier comes from the GPU name, core count and memory (`academy/quality.js`). A governor then watches frame cost (GPU timer queries when available, otherwise frame intervals with vsync-aware thresholds). It steps render scale down to 0.55 and then trims effects, recovers when there is headroom, and locks for 20 s after a failed step up so it does not oscillate. The Settings "High" option now means the best this device can fly smoothly; "Balanced" and "Low" cap it.
- **Loading:** scene assembly is split into small steps with yields between them, and shaders compile with `compileAsync` before the first frame.

## The game

- **Flight:** always forward, with momentum. W/S climb and dive (diving trades height for speed), A/D turn with a bank, and Shift boosts from a meter that refills on rings and stardust. Q/E barrel-roll sideways with brief invulnerability. Cliffs and buildings block and slide the broom instead of popping it over them.
- **Trials:** Lantern Loop, then Lake Run (threads both bridge channels), then Spire Ascent (spirals to the crown of the castle spire, then dives for the lake). Each is a timed run: rings add time and chain points, perfect passes score extra, and stardust builds a combo up to ×8. Wisps fire slow homing bolts that you dodge by rolling, and Space or a click casts an auto-aimed bolt. A hit costs time and the combo. Results show a medal, score breakdown and best; R retries. A medal unlocks the next trial.
- **Course design and tuning:** courses are validated against the baked terrain and the real landmark colliders. Clocks and medal thresholds were set from an autopilot flying the real flight model: cruising earns a medal, gold needs boosting lines and stardust chains.
- **Free flight:** the six landmarks are scenery with "F · Read" prompts that open the portfolio chapters. There are eight star shards to find, and golden gates start the trials.
- **Input:** touch uses the site's thumbstick and boost button plus roll and cast buttons. Gamepads work (left stick, RT/B boost, A cast, LB/RB roll, Start for trials).

## Re-running

```bash
npm --prefix world run test:release          # includes academy-flight, academy-trials, academy-quality
node world/scripts/bench-academy.mjs         # lean Academy, default tier
node world/scripts/bench-academy.mjs --classic --label classic
node world/scripts/bench-academy.mjs --quality low --width 1366 --height 768 --dpr 1 --throttle 6
node world/scripts/bake-academy-terrain.mjs  # only if world.js terrain or paths change
```
