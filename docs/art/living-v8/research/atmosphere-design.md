# Living v8 atmosphere: light, lanterns, fireflies and birds

Research and contract audit, 2026-09-09. This is a design candidate, not a rendered or performance-validated implementation. Only this report was authored; no product source, browser session, Git state or v7 worktree was changed.

## Recommended composition

Use clear champagne sunlight, pearl-blue moonlight, cream architecture and restrained amber accents around the existing mineral painting. At night, three small compositions of floating paper lanterns establish depth; fireflies inhabit three low garden pockets. By day, three small flocks travel through side airspace. Keep the central castle silhouette, research bridge, contact bridge and open lake legible. More visible life should come from recognisable bodies, deliberate trajectories and intervals of activity, rather than additional scene-wide points.

Build and review one finished lantern, one finished bird with its wing poses, and one firefly before assembling populations. Preserve existing authored geometry, native DPR, shadow resolution, reflection resolution and rendering quality. Preserve the v7 foreground fog correction and painted mountain treatment.

## Existing implementation and ownership boundaries

| Verified source | Existing behavior and implication |
| --- | --- |
| [atmosphere.js:14](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/atmosphere.js:14) | Late phase-2 cloud panorama, LROC moon texture and blossom atlas loading; shared sky/moon binding sets hydrate live materials. Preserve delayed-load and disposal behavior. |
| [atmosphere.js:52](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/atmosphere.js:52) | A detailed lantern already exists: 24-segment lathed paper, woven/fiber shader, eight seams, bamboo rims, cross brace, internal flame and aura. There are 26 ambient lanterns, an eight-lantern manual release pool and 90 fireflies. Improve these assets and their composition; do not introduce a second lantern feature. |
| [atmosphere.js:96](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/atmosphere.js:96) | Existing cloud sky sphere, sun, textured full moon, separate halos and 1,800 stars. Sky centers on the active render camera in `onBeforeRender`; sun/moon are currently positioned relative to the world origin. |
| [world.js:311](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/world.js:311) | A separate older layer contains 16 tiny glowing spheres, 140 nocturnal motes and 12 V-shaped `THREE.Line` birds. Birds currently circle the central castle at roughly y=32 and are not day-gated. Replace these corresponding legacy effects when their new counterparts are ready; retain gameplay wisps, crystals, rings and portals. |
| [environment-time.js:10](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/environment-time.js:10) | One interpolated palette controls sky, light, water and haze. The 240-second auto clock, 2.4-second mode transition and explicit time selection already work; keep this contract. |
| [game.js:258](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/game.js:258) | Existing hemisphere light, shadowed directional key, directional fill and four warm point accents. `_updateEnvironment` overwrites their palette-dependent values every frame. Constructor-only light edits will not persist. |
| [landscape.js:198](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/landscape.js:198), [landscape-depth.js:14](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/landscape-depth.js:14) | Lake is physically at y=-15, with 2,048-pixel reflections and local fog depth scaling .65 by day/.50 at night. Lake fog recovers the shared horizon endpoint over view depth 1,800–3,000. Preserve this: increasing global fog would wash out the coast again. |
| [rendering.js:53](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/rendering.js:53) | Existing HDR targets and bloom strength .28, radius .45, threshold 1.35, followed by OutputPass. Author a bright core and quiet surrounding material; keep bloom settings fixed for the first art review. |
| [audio.js:13](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/audio.js:13) | Audio is off by default, unlocked through user action, with one AudioContext, day/night music, spatial wind/water and reading ducking. Bird calls are not currently present. |

## Primary references and what to borrow

These sources inform the recommendations; the actual palette, counts, geometry and coordinates below are project-specific art direction, not values prescribed by a source.

- [Philémon Caron's first-person painterly lighting tutorial](https://www.creativebloq.com/3d/how-to-create-an-atmospheric-painterly-environment-in-unreal-engine): choose a principal view, establish surface values and light hierarchy, then refine atmosphere. Apply this to a stable academy composition and warm/cool separation, with restrained bloom.
- [Epic's Sky Atmosphere documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere-component-in-unreal-engine): directional scattering concentrates a halo around a celestial source, whereas increased aerosol density reduces scene clarity. Borrow the narrow angular aureole; do not port a volumetric atmosphere system into this renderer.
- [Three.js MeshStandardMaterial documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html): emissive contribution is independent of scene lighting. Use authored emission gradients for luminous paper and tiny insect abdomens instead of adding a point light to every object.
- [Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html): repeated geometry can share draws; matrix and morph changes require dirty flags, moving instances need correct bounds, and instance resources need disposal. Use full-detail geometry with these explicit contracts.
- [Craig Reynolds' original Boids account](https://www.red3d.com/cwr/boids/): local separation, alignment and cohesion can be combined with obstacle avoidance and an authored goal path. For twelve birds, a small CPU flock following a designed route is sufficient; a GPU simulation framework is unnecessary.
- [National Park Service firefly observations](https://www.nps.gov/cong/learn/nature/synchronous-fireflies-at-congaree.htm): observed species have low forest habitats and distinct flash/rest patterns. Borrow low habitat and pauses; the proposed soft, asynchronous fantasy pulses are not a species-accurate reproduction.

## Light and sky candidate

Start with the following values under the current ACES/output pipeline. Hex values are input colors interpreted by Three's color management; light intensities are existing scene units. Review actual stone, foliage, scan materials and faces before committing the palette.

| Parameter | Clear day | Peach dusk | Bright night |
| --- | --- | --- | --- |
| Zenith / horizon | `#4387b5` / `#d4e8e9` | `#7485b4` / `#edba9f` | `#223653` / `#587787` |
| Cloud tint | `#fff5e2` | `#f3d6c0` | `#657f95` |
| Key color / intensity | `#fff1d6` / 3.2 | `#ffcca0` / 2.45 | `#d6e5f4` / 2.1 |
| Hemisphere sky / ground | `#c0def0` / `#a9aa8f` | `#c8c6df` / `#aba291` | `#bbcddd` / `#6c7d82` |
| Hemisphere intensity | 1.0 | 1.05 | 1.18 |
| Fill color / intensity | `#c6d9eb` / .48 | `#b2b9d7` / .40 | `#b5c6d8` / .36 |
| Exposure | 1.0 | 1.02 | 1.05 |
| Water color | retain `#236775` | retain `#53697f` | test `#1e4658` |
| Fog color / density | retain `#abc6d5` / .00095 | retain `#b49da6` / .0012 | retain `#354f66` / .00135 |

Keep fog endpoints unchanged in this first pass, including the sky's `smoothstep(.01,.11,d.y)` blend into its shared fog tint. Update the `noon` and `midnight` derived palettes intentionally: noon key about 3.3, midnight ambient about 1.1, with a darker zenith than ordinary night. Leave dawn initially unchanged, then inspect its interpolation into the new day. Existing day/night intensity and luminance tests must still pass. Night should retain visible cream walls and green foliage, with directional form; raising ambient until every surface is equally bright defeats that aim.

Local refinements:

1. **Sun:** retain a readable warm white disk. The current sky lobe uses `pow(dot,8)*.18`, which spreads warm light widely. Trial an exponent of 64–128 at amplitude .10–.16, accompanied by the existing mesh halo at opacity .12–.18. These are separate, restrained inner/outer contributions; review their combined energy. Preserve sunset visibility and the true sun direction. No screen-wide shafts or added fog.
2. **Moon:** keep the 2K LROC texture, spherical form and crater contrast. Shift the cyan corona toward pearl blue, approximately `#c0d5e8`, opacity .10–.15. Preserve a faint outer halo while avoiding a clipped featureless disk. The moon remains a stylized large celestial body; enlarging it is not the main improvement.
3. **Celestial positioning:** use active-camera world position for sky and distant celestial centers, preserving directional placement and draw ordering behind the mineral painting. Compute halo orientation from the actual render camera, including the reflected camera. Lanterns, insects and birds remain world-fixed. Do not recenter finite atmospheric objects or the painting. The present lantern aura uses the camera's local quaternion; use a world quaternion transformed into the parent frame, or a view-space billboard shader that includes instance transforms.
4. **Academy accents:** reuse the four existing point lights; tune toward `#ffd29a` and place their contribution at facade recesses/courts only after the architecture owner supplies final facade positions. Preserve the existing key's smooth elevation floor and low-angle shadow attenuation. Keep shadow map quality. Lantern emission plus a local aura supplies their glow; moving point lights on all lanterns would add broad illumination without useful form.
5. **Material balance:** keep stone albedo and scanned rock texture contrast. Review lantern paper and white architecture together under the current bloom threshold. Increase only the small authored luminous regions when bloom is needed; do not lower the global threshold to make everything glow.

## Finished assets and bounded populations

All coordinates below are **initial world-space authoring domains**, to be checked against the final island/architecture layout. They are not confirmed collision-safe placements. Keep deterministic seeds. Within each domain, reject positions inside landmark volumes plus a clearance margin and reject important view corridors. Validate the complete motion envelope, not just initial centers. Do this during authoring/build validation; do not continually move populations away from the player's camera.

### Paper lanterns

Preserve the existing 1.86-unit paper silhouette, 24-segment construction, seams, bamboo rim, brace and internal flame. Refine the asset with slight asymmetric folds, a quiet ivory cap, amber lower paper and a small warm-white flame. Paper should read as a lit object in daylight too, not an orange blob. Trial lower-paper emissive intensity 1.8–2.4 and upper-paper .55–.85 at night, with seam contrast around 15–25%; flame radiance 4–6 is a starting point to test in the actual HDR pipeline. Keep aura opacity around .12–.22. Avoid animated high-frequency weave shimmer; use a properly filtered authored fiber texture if the current procedural weave aliases in motion.

Retain 26 ambient lanterns split into three unequal clusters:

| Group | Count | Center `(x,y,z)` | Half extents `(x,y,z)` |
| --- | --- | --- | --- |
| Western water | 8 | `(-118,58,28)` | `(22,22,38)` |
| Eastern water | 10 | `(123,64,-4)` | `(20,26,34)` |
| Far western sky | 8 | `(-115,92,-112)` | `(22,20,24)` |

Keep at least a 10-unit margin around landmark bounding volumes. A castle-spire sightline can be blocked by an object outside the castle footprint: review projected overlap from highlands, court and bridge views separately. Preserve substantial empty intervals between groups. Ambient movement can remain a slow wind sway with 1–2 units of lateral excursion, .5–1.2 of vertical bob and less than 4 degrees of tilt; stagger phases and heights. Avoid synchronized bobbing or obvious vertical wrapping through the visible frame.

Retain the eight-item release pool and existing input action. The released lantern starts beside the player and rises roughly .7–.9 units per active second with shared wind. Replace the current per-frame `.1` age cap: at 7.82 fps it slows ascent relative to elapsed time. Consume foreground elapsed time with the established stall policy; use substeps when needed. Fade near the existing maximum age/height boundary before reuse so there is no conspicuous pop. Repeated release must remain bounded and must not move an unrelated ambient lantern.

**Instancing:** share the full authored geometry/materials. Instance opaque bamboo, flame geometry and additive auras per spatial group, plus the manual pool where appropriate. Preserve separate sortable transparent paper shells initially. Transparent instances are not individually depth-sorted by ordinary object sorting; batching all rice-paper shells together can cause visible overlap errors. An opaque backlit-paper approximation is an optional studio comparison, not permission to discard translucency for speed. Billboards use the active pass camera; a reflection pass never advances animation.

### Fireflies

Replace the current 90 generic point sprites with three 30-insect habitat groups; retire the separate 140 scene-wide motes and 16 glowing spheres when this population is installed. Preserve unrelated magical gameplay effects. Start habitats near cherry `(-73,66)`, lilac `(48,77)` and the outer research grove `(-105,-82)` in x/z, with elliptical radii approximately `(10,6)`, `(9,6)` and `(6,8)`. Final garden geometry determines exact positions.

Author a close-view firefly: a small dark elongated body, tiny wings and a luminous amber abdomen, approximately .035–.05 units long. Reuse the full asset by instancing; its far appearance comes from normal screen projection, not a reduced-detail asset. Add a round emissive core and soft radial aura, typically .18–.34 units across, depth-tested and depth-write disabled. The current firefly `PointsMaterial` has no circular point mask; do not carry square points into the new effect. Start color variations at warm gold `#ffe7a3` and pale yellow-green `#d9ecab`, with little or no violet.

Keep positions .6–2.2 units above the actual rendered ground, beside plants rather than spread through the sky or across paved paths. Use the final terrain/patch height resolver; the present atmosphere receives `terrainHeight`, whereas the navigable world already exposes `renderedTerrainHeight`. Stay clear of building interiors, walkways and signs. Motion is a local .25–.6-unit wandering loop, not random teleportation. Each insect has a soft pulse followed by several seconds of rest; stagger phases so only a minority glow strongly together. A gentle .2–.4-second pulse every 3–6 seconds is an art starting point. Reduced motion holds a quiet constant subset of lights and freezes flight/pulsing.

### Birds

Replace the twelve V-line birds with twelve authored 3D birds, distributed 5/4/3. A stylized swallow-like design suits the academy: ivory breast, slate blue wings, a small warm throat accent, a readable head/beak and forked tail. Start with body length .25–.35 and wingspan .7–1.0 units; these are deliberately enlarged fantasy proportions, not a biological measurement. Keep real wing volume and underside shape. Review close passes before fixing final scale or topology.

Use a GLB with compatible upstroke, downstroke and glide morph poses, including normals; instance the complete geometry per flock with per-instance morph weights. This preserves authored detail and avoids a separate animation mixer for every bird. Update `morphTexture.needsUpdate` and `instanceMatrix.needsUpdate` after changes, and include every wing pose and motion envelope in bounds. A skeleton-based asset is also viable if it materially improves the approved bird; instancing is not a reason to reject a better authored pose.

| Flock | Count | Initial route region | Purpose |
| --- | --- | --- | --- |
| West | 5 | center `(-138,38,-22)`, x/z radii `(22,36)`, altitude 26–50 | Small near-water crossings to the left of the academy |
| East | 4 | center `(143,34,18)`, radii `(18,34)`, altitude 24–46 | Counterbalance, visible from contact side |
| Far sky | 3 | center `(18,60,-190)`, radii `(60,25)`, altitude 55–75 | Occasional small silhouettes against sky, behind the academy |

Far fauna may exist outside player travel bounds; it remains noninteractive. Use smooth continuous authored paths, tangent orientation, roughly 5–8 units/second travel, 12–20-degree banking, brief 2–4 Hz wingbeat sequences and several seconds of glide. These are motion-review starting values. Add limited local separation/alignment/cohesion for 2–5-unit spacing, while the route and predictive clearance retain final control. Keep routes at least 12 units from landmark volumes and away from the central spire. Do not reuse the current circular path through the castle at y=32.

Day activity can use `1-smoothstep(.12,.55,night)`, with gradual handoff at dusk. Have quiet intervals rather than all flocks crossing every view continuously. In reduced motion, freeze a stable glide pose and position; do not continually reinitialize to time zero. Static perched birds are a later option only at actual approved architecture sockets, not improvised floating perches. No new bird shadow pass is necessary for these small elevated groups; nearby perched birds should use normal local scene lighting/shadows if added.

## Integration and lifecycle contract

1. **One retained atmosphere.** [createNavigationWorld and assembleWorld](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/world.js:375) already share the navigation atmosphere during enhancement. Attach new populations there once, with an optional late asset hydration step. Do not recreate sky/lanterns when high-detail districts finish. Remove only the corresponding legacy bird/mote/orb creation, animation and night-registration entries.
2. **One light owner.** [Game._updateEnvironment](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/game.js:282) sends the live palette to `atmosphere.setEnvironment`. Atmosphere is a scene sibling of `world.root`; `registerWorldLighting(world.root)` does not automatically find it. Keep its emissives and fauna fades under `setEnvironment`; do not also register and multiply them a second time.
3. **Explicit activity clock.** [Game._tick](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/game.js:1020) advances `_time` while reading/paused. Pass an optional sixth update argument such as `{paused: this._isPaused(), started: this.started}` through both full and navigation world updates to atmosphere. Accumulate a local active elapsed time only when started, unpaused and not reduced-motion; do not use `_time` directly for the new populations. Keep the last pose during pause and on resume. Explicit day/night selection must still recolor the frozen scene. Hidden/context-lost frames already stop; avoid later catch-up debt. A cloud update may share this local activity clock without changing water, gameplay or character clocks.
4. **Per-pass correctness.** World update occurs before the camera's final update. Billboards and celestial camera centering belong in render-time orientation/uniform work using the passed camera. Simulation, spawning and pulse phase advance only once per game update. Test the existing throttled water reflection and main scene together; do not consume time once per render pass or orient every pass to `game.camera`.
5. **Disposal.** [Game.dispose](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/game.js:1698) collects geometries/materials/direct material texture properties, but does not call `atmosphere.dispose()` and does not automatically discover nested shader-uniform textures or dispose an instanced mesh's morph texture. Give the new module one idempotent release hook for its instance resources, owned uniform textures and late-load bindings, invoked before the existing scene cleanup. Keep the existing scene-level Set cleanup authoritative for shared geometry/materials; do not call the current whole-tree atmosphere disposer plus scene cleanup blindly. Mark or track asset-cache ownership so shared textures survive another world's disposal. Late fetch/decode completion must check abort/disposed state before attaching.
6. **Audio stays optional.** The requested visuals do not require new sound assets. If bird calls are included in v8, use `WorldAudio.setEnvironment/update`, the existing AudioContext, ambience bus and camera listener. Load attributable original/CC0 mono calls only after sound is enabled/unlocked; three flock panners suffice, with at most two calls at once and occasional 12–30-second opportunities. Fade with daylight, preserve reading ducking and suppress scheduling during pause/hidden state. No chirp backlog after resume. Use abort/context/disposal guards like the existing music loader; retain the overall voice cap. Do not add per-firefly sounds or another ambient soundtrack.

## Asset-first review and completion evidence

Before integration, review the same authored assets under the real output pipeline: lantern front/back/below and overlapped pair in day/dusk/night, including bamboo, paper translucency, flame and filtered fibers; bird front/side/below across the three wing poses and a 10-second bank/glide; firefly against leaves, stone and dark water at close and normal player distance. Use finished exportable meshes/materials with recorded source/license for any imported data. A glowy point or V-line placeholder does not pass this gate. No new assets were produced or rendered during this research task.

The current [quality-review poses](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/world/src/quality-review.js:13) provide reproducible composition checks:

| Pose | Eye → target | Check |
| --- | --- | --- |
| highlands | `(130,94,184)` → `(-2,44,-40)` | Painted mountain detail, central spire clearance, separated lantern groups |
| court | `(30,27,79)` → `(0,10,28)` | Cream facade brightness, eye-level lantern readability, open central sky |
| bridge | `(-27,26,-23)` → `(-65,5,-53)` | Research landmark and bridge remain readable during flight |
| contact-bridge | `(59,15,-23)` → `(52,3,-42)` | Eastern flock/lantern separation from contact approach |
| cherry / lilac | `(-45,17,85)` → `(-73,9,66)` / `(69,17,97)` → `(48,10,77)` | Fireflies occupy plants, with no square glow or paved-path noise |
| high-flight | `(0,125,110)` → `(0,24,-60)` | Full motion bounds, upper sky, no camera-relative finite objects |
| shore | `(93,4,115)` → `(45,2,73)` | Reflection orientation, horizon continuity, foreground clarity |

Highlands and overview are authored diagnostic poses outside some player bounds; do not describe them as reachable gameplay positions. Add an actual court-to-research flight recording because static postcard views will not expose camera-facing, sorting and trajectory faults.

Behavioral evidence required after implementation:

- Existing environment clock tests still pass; day/dusk/night transitions remain continuous and explicit selection works while paused/reduced. Verify both sides of the sun/moon horizon handoff and one complete auto cycle.
- Navigation-to-full enhancement retains exactly one atmosphere and the same release pool. Deferred or failed bird/texture loading can retry without duplicates; disposal during loading does not resurrect objects.
- Run equivalent elapsed sequences at approximately 8, 30 and 60 fps; release height, bird route progress and pulse phase agree within a defined simulation tolerance. Pause for 10 seconds, resume and verify there is no jump. Repeat with reduced motion, tab hiding and context restoration.
- Validate every group's entire path/morph bounds against landmark clearances and actual rendered ground. Check projected landmark visibility through representative motion recordings; footprint distance alone is insufficient.
- Exercise all eight release slots and further releases; object/resource counts remain bounded. Check overlapping paper shells and every aura in the main view and reflection. Rendering the reflection does not increment simulation state.
- Night hides day birds smoothly; daylight quiets firefly/lantern emission without making paper disappear. Reduced-motion transforms and pulses remain stable. Existing interaction controls, reading pause, travel and sound-off behavior remain intact.
- Repeated create/dispose returns new-owned texture/buffer counts to baseline, keeps shared assets valid and removes late-load bindings. If bird audio is added, verify no requests/autoplay with sound off, no extra AudioContext, bounded simultaneous calls and no post-disposal playback.

The inherited [v7 review](/Users/yaxinluo/Documents/Codex/2026-09-07/https-yaxin9luo-github-io-https-yaxin9luo/outputs/academy-living-v8/docs/art/landscape-v7/review.md:29) records Apple M2 Pro high/native at 2560×1440, DPR 2.5 and 4×MSAA: 7.82 fps average, GPU 116.42 ms, over a separate 20-second walking measurement. This is a candid inherited limit, not a fresh v8 result or a result for a different Mac. Repeat the same measurement separately from recording after integration, report CPU/GPU time, draws and visible populations, and inspect any regression. Sharing full-detail assets, grouping opaque parts and retiring duplicate legacy effects are the first efficiency measures. Do not lower global geometry quality, DPR, reflection size or shadow quality to produce a better number.

Recommended implementation order: approved asset studies → palette and celestial light refinement → grouped lanterns and release timing → habitat fireflies → 3D daytime birds → lifecycle/behavior checks and full native review. Coordinate final placement with the architecture owner; atmosphere must follow the approved architecture, not move landmarks to make its effects fit.
