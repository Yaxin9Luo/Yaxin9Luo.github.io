# Research atelier: physical objects and interaction

The existing project collection now appears as three usable physical objects: an output screen with a matching print, a hinged method folio, and a framed authorship plaque. All words, roles and media come from `exhibition-content.js`; the work introduces no new research result, personal role, award or evaluation number. The complete bilingual reader remains HTML.

## Authored geometry and surfaces

The atelier has **68 meshes, 168,458 triangles and 40 semantic ray targets**, measured from `createExhibitionStage` after batching. Repeated decoration is combined by material and parent; moving joints, text surfaces and named framing parts retain their identities.

- The desk has rounded walnut edges, end-grain strips, brass inlay, mortise pins, collars, a front apron and diagonal side braces. Its collider still leaves the underside and side aisles accessible.
- The folio has rounded leather covers, a cylindrical spine, four raised binding bands, thirteen visible page signatures, five independently pivoted leaves, linen stitching, corner hardware and a bookmark. The front cover rotates around its actual spine hinge. The inside cover and top reading leaf use current project metadata and the existing research question/method description in either language.
- The instrument has a plinth, three leveling feet, two bearing assemblies, 72 physical scale ticks, twelve knurls on each adjustment knob, gimbal rings and a media pointer. The pointer position follows the selected image index; it is not an unexplained continuous spin.
- The role plaque stands on its own braced base. Its frame, face and screw heads all route to the same project role section.

PBR uses the same local `loadPBRTexture` cache and authored tint/roughness treatment as the gardens. Existing aged-wood, castle-masonry, oxidized-copper and dark-leather color/normal/roughness channels are reused. UVs are assigned in metres: walnut 2 m, end-grain strip 0.9 m, metal 1 m, stone 2.085 m and leather 0.38 m. No shared texture repeat is mutated. The local source/licensing manifest is unchanged. Media and lettering keep their separate readable display materials.

## Root integration contract

```js
stage.setFocused(isNearby, { reducedMotion });
stage.setOpen(isExhibiting, { reducedMotion });
stage.update(elapsedSeconds, deltaSeconds, reducedMotion);
if (stage.consumeShadowUpdate()) renderer.shadowMap.needsUpdate = true;
```

`setFocused` and `setOpen` are independent. Both return `false` after disposal. `update(time)` remains supported for older callers. Motion uses bounded per-frame deltas: `dt = 0` does no work, wall-clock gaps above 0.25 seconds do not advance a pose, and ordinary steps are capped at 0.05 seconds. Reversals start from the current pose. Reduced motion immediately settles the requested pose and instrument position, with no acknowledgement pulse. Focus changes the reading-lamp intensity slightly; it does not dim or scale the image.

`consumeShadowUpdate()` returns and clears the pending shadow refresh signal. It is true for initial geometry and changed cover/page/gimbal/pointer poses, including immediate reduced-motion setters. Merely changing a target, updating a settled timer or animating the non-casting status label does not request a shadow pass. `shadowDirty` is the corresponding read-only getter. Root consumes this after `update`, including exhibition frames where gameplay is paused.

`setProject`, `setMedia`, `setLanguage` and `dispose` retain their previous roles. A project switch resets the media index while retaining the physical open/focus pose. Language changes update the title, cover, inside cover, actual method page, role, instrument label, neighboring projects and status. `motionState` returns a snapshot useful for verification. `materialsReady` resolves to `{ errors }`; `materialErrors` exposes loading failures while solid-color materials remain usable.

Target payloads are attached to the actual intersected mesh:

| Object | `action` | `section` |
| --- | --- | --- |
| Screen, screen trim and desk output print | `open` | — |
| Folio cover, spine, signatures, leaves and hardware | `detail` | `method` |
| Authorship plaque, supports and fasteners | `detail` | `role` |
| Media controls | `previousMedia` / `nextMedia` | — |
| Neighboring boards | `previousProject` / `nextProject` | — |

Every payload also carries the current `projectId` and `mediaIndex`. Root routes `open` to enlargement when already in the exhibition, and forwards `section` to the reader. Decorative folio or plaque parts cannot swallow a valid target ray: batching preserves their semantic payloads.

The media loader retains the most recent completed image during replacement and ignores obsolete requests. Owned media and lettering textures are released once on disposal, including late completions. Shared PBR textures remain owned by the common cache. Optional `loadMedia` and `loadSurface` constructor functions support deterministic loading/failure tests.

## Framing and studio

`camera.framingBounds` still contains exactly three world-space regions: screen, title, and desk. The desk region includes its closed, partly raised and fully open geometry. This retains the existing header/toolbar fitting mechanism, including the four desk legs. The fit excludes neighboring project boards so they do not shrink the primary work.

The standalone studio is `world/exhibit-studio.html`. Examples on the active local Vite server:

- [Open atelier, neutral light](http://127.0.0.1:4195/exhibit-studio.html?view=wide&light=neutral&open=1)
- [Method folio, daylight](http://127.0.0.1:4195/exhibit-studio.html?view=folio&light=day&open=1)
- [Instrument, night light](http://127.0.0.1:4195/exhibit-studio.html?view=instrument&light=night&open=1)
- [Chinese method folio](http://127.0.0.1:4195/exhibit-studio.html?view=folio&light=day&lang=zh&open=1)

The studio supplies project/media/language/light/open/focus controls, reduced motion, orbit/pan/zoom, actual mesh picking, image enlargement with source attribution, and method/role dialogs. It is a direct preview of the runtime stage generator. `window.__exhibitStudio` exposes its `stage`, `scene`, `camera`, `renderer`, `controls`, `setView`, `setLight` and `showDetail` for live review.

Useful camera positions are relative to `stage.group.position`:

| View | Position | Target |
| --- | --- | --- |
| Desk | `(1.4, 8.7, 13.4)` | `(0, 3.82, 3.66)` |
| Folio | `(5.8, 9.2, 10.5)` | `(3.05, 4.12, 3.8)` |
| Instrument | `(-3.4, 6.0, 7.0)` | `(-3.83, 4.7, 3.53)` |
| Role | `(0, 4.75, 8.2)` | `(0, 4.32, 2.6)` |
| Media | `(0, 8.1, 10.5)` | `(0, 8.1, -3.9)` |

The wide view fits measured physical bounds to the current canvas aspect. Query parameters are `view`, `light=neutral|day|night`, `open=0|1`, `focus=0|1`, `lang=en|zh`, `project`, `media` and `reduced=1`.

## Verification

The new behavior tests cover opening/reversal/closing, explicit pause and resumed legacy time, reduced motion, real ray hits on the three objects, fully open bounds, inside-cover reading orientation, stale media cancellation, late disposal, shared PBR lifetime, physical UV scaling and instrument retargeting. Existing exhibition and game framing tests cover the four viewport cases, overlay changes, camera restoration, routes, media and collision behavior.

The production Vite build includes the studio. HTTP checks verified the studio, its modules, representative local PBR maps, HDR, AutoDesign output and material license resources with their expected content types. HTTP availability and unit tests are separate from root's live WebGL visual/interaction review. The Vite paper-figure `/images/` route initially returned HTML fallback; root was notified to expose those files before reviewing the other projects in dev. Production site assembly already has its separate asset-copy contract.
