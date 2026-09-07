# Architecture assets and visual verification

The six architectural landmarks in `world/src/models.js` are original procedural models. `world/src/architecture.js` provides world-scaled UVs, chamfered stone geometry, and an explicit PBR preload. The buildings use licensed CC0 surface scans, with original silhouettes, layout, detailing, and mesh geometry. No proprietary game mesh or screenshot is included in a runtime asset. The user's existing Blender scene was never opened or modified: asset verification uses a separate `--background --factory-startup` process.

## Art direction and references

The architecture uses aged grey-beige masonry, blue-grey slate, oxidized copper, worn timber, antique brass, recessed lancets, and restrained amber light. The academy has seven unequal towers, a tall keep, clerestory-scale windows, flying buttresses, corner quoins, cornices, dormers, roof courses, and a projecting gatehouse. The observatory uses a separate copper material instead of slate on its dome. The workshop mixes stone and timber around a copper pressure vessel. The ruins include a surviving open-arched cloister wall, broken coping, and uneven paving.

The following primary references informed architectural density, plausible surface scale, weathering, and the distinction between load-bearing stone and metal/timber details. They were used as visual references, not as sources of reusable artwork:

- [Avalanche/WB Games: Hogwarts Legacy extended gameplay](https://blog.playstation.com/2022/03/17/hogwarts-legacy-your-first-look-at-extended-gameplay/), including the official gameplay still showing weathered ashlar, carved stone borders, and layered Gothic interiors.
- [Hogwarts Legacy official media](https://www.hogwartslegacy.com/en-us/media).
- [Larian: Returning to the City After 20 Years](https://baldursgate3.game/news/returning-to-the-city-after-20-years_70), for architectural variety, inhabited facades, and layered urban structures.
- The original image-generation target supplied during this task, used to compare the stone/slate detail hierarchy and seven landmark silhouettes.

These are production assets for a browser portfolio. They are not claimed to match a full AAA game's environment art, material diversity, or lighting pipeline.

## Runtime contract

Call `await loadArchitectureAssets()` before creating the world or the asset studio. Loading is explicit: module import and geometry construction remain safe in Node without a DOM. The loader uses the shared `loadPBRTexture()` cache, so architecture and landscape share decoded textures and GPU allocations.

Each factory returns a new `THREE.Group`, with its base at local Y = 0 (within floating-point precision), built around the local X/Z origin, and its main entrance facing **+Z**:

- `createCastle()` — academy and tall astronomical keep.
- `createObservatory()` — circular stone base, copper dome, telescope, and armillary spheres.
- `createLibrary()` — archive, rose window, lanterns, and open-book sculpture.
- `createWorkshop()` — stone/timber atelier, chimney, copper plumbing, and potion desk.
- `createOwlery()` — open upper lancets, timber balcony, exterior spiral stair, and perched owls.
- `createRuins()` — fragmented Gothic portal, open cloister, crystals, and loose paving.

The old `createWizard()` and `createWisp()` exports remain for compatibility; the main application uses the separately authored character asset module. Gameplay, camera motion, input, collision, journal content, audio, and lighting remain outside this model library.

## Geometry and materials

Main hall fronts and tower facets contain **real cut-out window openings**. Their glass sits behind the wall surface. Window surrounds use two layers of stone arch moldings, with genuine chamfered outer edges, trefoil tracery, central mullions, and thin diamond leadwork. Not every subordinate side window removes the underlying structural box; those use raised surrounds to create a shallow recess.

Quoins and prominent stone blocks use 44-triangle chamfered solids, with bevel width specified in metres. Shared material batches contain the repeated geometry. Small distant leadwork uses fewer segments, while silhouette and masonry details retain their geometry. Individual emissive windows add no point lights or shadow maps; a deterministic mixture of bright and quiet amber panes avoids uniformly lit facades.

UVs are generated after transforms, in object/world metres. Each triangle chooses a consistent planar projection. Vertical wall courses remain horizontal. Every exported position and UV has been checked for finite values. Texture sampling uses repeat wrapping, sRGB for color, linear data maps, and OpenGL +Y normals.

| Surface | Source tiling width | Use |
| --- | --- | --- |
| Castle masonry | 2.085 m | Walls, carved trim, weathered blocks |
| Slate roof | 3 m | Hall roofs, spires, roof courses |
| Aged wood | 2 m | Doors, structural timber, desks |
| Mossy rock | 3 m | Foundations and rocky masonry |
| Oxidized copper | 1 m artistic choice | Dome and pressure vessel; the source provides no usable physical dimension |

Source authors, licenses, original downloads, hashes, and map conventions are recorded in `docs/world-asset-sources.md` and `world/public/textures/manifest.json`. Shared textures are not disposed when switching between individual assets; dispose them only when the whole application shuts down.

## Measured asset sizes

Dimensions are **X × Y × Z**, measured from the final geometry. Mesh counts are per-model material batches, not the total renderer draw calls including shadows or post-processing.

| Model | Dimensions | Meshes | Triangles |
| --- | --- | ---: | ---: |
| Castle | 34.00 × 49.33 × 22.95 | 19 | 233,238 |
| Observatory | 16.40 × 21.34 × 17.43 | 15 | 21,434 |
| Library | 17.00 × 19.93 × 15.68 | 20 | 31,062 |
| Workshop | 17.00 × 17.33 × 14.15 | 21 | 13,494 |
| Owlery | 12.80 × 20.93 × 12.80 | 19 | 31,530 |
| Ruins | 17.80 × 10.61 × 17.80 | 9 | 9,900 |
| **Total** | — | **103** | **340,658** |

## Inspectable assets and reproduction

`world/public/models/architecture/` contains each landmark as a GLB plus a metadata manifest. The GLBs use `EXT_texture_webp` and refer to shared external images in `../../textures/`. Serve the common `world/public` asset root when viewing them. The portable GLBs use a constant metal/roughness pair for copper; the runtime additionally samples copper's independent metalness map. The original geometry and UVs are identical.

Export the current procedural factories with:

```sh
node scripts/art/architecture/export-assets.mjs
```

Produce independent Blender studio renders without opening an existing user scene:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/art/architecture/render-assets.py -- \
  castle library observatory workshop owlery ruins
```

The render script creates separate `*-studio.png` and `*-studio.blend` files. Each blend file packs its textures and uses relative source/render paths so it can be moved to another machine. The blend files contain review lighting and a ground plane in addition to the asset; those studio objects are not part of the exported game GLBs. The live asset studio uses the runtime Three.js factories and PBR loader, so it remains the final check for browser lighting, texture loading, and actual performance. Offline renders are art-review evidence, not browser frame-rate evidence.

The individual render review caught and corrected three structural details: ivy now uses thin lobed leaves and stems instead of solid chunks; the owlery staircase now has a continuous handrail and supporting stringer that reaches the upper balcony; and the atelier chimney has a hollow throat with a four-piece coping instead of a solid dark cap. The ruin portal uses closely fitted curved voussoirs around a keystone instead of floating rectangular blocks.

Final verification built all six factories in Node, checked finite positions, normals, UVs, ground bounds, and measured triangle counts, and exercised the explicit preload without a DOM. All six GLBs and studio PNGs returned HTTP 200 from the live development server, and every external GLB texture reference resolved to an existing relative file. All six Blender files were reopened and checked for packed images and relative texture/render paths. Every final studio PNG was visually inspected after the structural fixes above.
