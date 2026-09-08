# Rendering cost review and preserved-quality correction

This review read the installed Three.js `0.185.1` implementation and the current render loop. It did not drive a browser, start a GPU renderer, change mesh budgets, reduce device-pixel ratio, or lower the selected AO/shadow settings. Frame-rate improvement must be measured in the production preview after other GPU work stops.

## Implemented: multisample geometric coverage once

Previously, both `EffectComposer` ping-pong targets had the selected sample count, including `4` in high quality. In the installed Three.js version:

1. `RenderPass` renders the beauty scene into the composer's read buffer.
2. Default `GTAOPass` renders the scene again with its normal override, calculates AO, denoises, then copies the beauty image into the write buffer and multiplies AO over that buffer in a second fullscreen draw.
3. `UnrealBloomPass` computes its mip chain and adds the final bloom image to the current read buffer.
4. `OutputPass` applies the final colour transform to the canvas.

`WebGLRenderer.render()` calls `updateMultisampleRenderTarget()` at the end of each render to a sampled target. Consequently, the beauty draw, GTAO's beauty copy, GTAO's blend and Bloom's final blend each used a multisampled target. On the explicit-resolve backend, each triggered a full colour resolve; their default depth attachment also entered the resolve mask even though no later pass read that depth.

The new `AntialiasedScenePass` in `world/src/rendering.js` renders the complete scene once to a dedicated HDR target with the selected MSAA sample count. This target retains its depth buffer, so opaque/transparent depth ordering and geometric antialiasing are preserved. Only colour is resolved. `initRenderTarget()` and `copyTextureToTexture()` transfer the resolved RGBA16F image on the GPU into the ordinary single-sample composer input, without a fullscreen draw, colour conversion, resize, or CPU readback.

The subsequent composer buffers have no depth attachment. GTAO's normal/depth target is unchanged; its AO and denoise image targets and Bloom's image targets no longer allocate unused depth attachments. High-quality AO retains the existing 0.8 linear-size multiplier, radius 1.6, eight GTAO samples, eight denoise samples, and blend intensity 0.55. Bloom's parameters and the pass order are unchanged. SMAA still handles a zero-MSAA mode/device before OutputPass. The renderer's 4096 shadow map and main geometry are outside this patch.

This replaces four sampled-image resolve points with one colour-only resolve plus one ordinary GPU image copy. It does not claim that fragment shading becomes four times faster: ordinary MSAA does not necessarily execute the fragment shader once per sample. The deterministic reduction is in multisample attachment storage, resolves and unused depth work. Actual timing depends on the WebGL backend and GPU contention.

## Other findings

**Water already has a bounded extra draw.** `landscape.js` invokes the stock reflection once per five beauty callbacks and returns immediately for an override-material render. The AO wrapper also hides the lake. The stock Water callback hides itself before calling the reflected scene render, preventing recursion. In the normal render order, the main scene's shadow pass has already cleared `shadowMap.needsUpdate` before Water's callback. There is no evidence here of a reflection recursion explosion or a second 4096 shadow render caused by the same invalidation. Avoid removing reflections or reducing their resolution as a speculative performance fix.

**Two shadow invalidators can request unnecessarily adjacent updates.** `_updateEnvironment()` requests a shadow update every 0.3 simulation seconds; `_tick()` independently requests one every fourth playing frame. A single scheduler could record the last *actual* shadow render and coalesce these requests while retaining their original maximum delays. Do not simply disable the 0.3-second invalidator whenever the sun stops: the idle rider, guardians, floating books and rotating fountain instrument can still cast moving shadows. Splitting static and dynamic shadow maps would require separate composition and careful validation, so it is not the next small patch.

**AO redraws substantial geometry.** A read-only Node construction of the current procedural world, using the initial camera `(105,58,150)` aimed at `(-18,34,-25)`, estimated about 7.17 million triangles inside coarse object frusta after multiplying instanced geometry by instance count. The current AO exclusion rules retained about 7.14 million. This estimate excludes the separately loaded hero/exhibition and texture-dependent sprites; it is not a GPU draw-counter measurement. The broad instanced grove groups and understory account for much of that geometry. Keeping all authored meshes while partitioning instance batches spatially could avoid drawing out-of-view instances during close flight. It will not substantially help the overview where almost the entire island is visible. Do not lower model detail to satisfy this estimate.

**Small CPU duplication exists, but it is unlikely to explain a 66 ms frame alone.** The AO wrapper traverses the scene and allocates a `hidden` array each frame, then GTAOPass traverses it again to hide points/lines. Renderer scene-matrix propagation also runs for the beauty scene, the AO override, and a reflection refresh. A reusable AO exclusion registry with correct dynamic additions/removals, and one explicit matrix update per animation frame, can reduce CPU overhead. They require care around bone updates, camera-facing halos and newly visible project media. They are lower-priority than removing unnecessary multisample work.

## Checks

`node --test world/tests/rendering.test.js world/tests/render-quality.test.js` exercises the real Three.js pass implementations with a recording renderer in Node. It checks consecutive-frame buffer swaps, scene depth and selected MSAA, unchanged high-quality AO dimensions/sample counts, HDR copy identity and dimensions, postprocess targets without MSAA/depth, transparent-object exclusion/restoration, quality and viewport transitions, limited hardware samples, SMAA fallback, canvas output and render-target disposal. It does not compile shaders or measure GPU timings. The production browser remains the visual/driver acceptance gate.
