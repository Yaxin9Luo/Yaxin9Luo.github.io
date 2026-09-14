# Herbarium garden kit

The arcade, conservatory, water garden and flower border are original authored architecture and garden compositions. Their editable source is `world/src/herbarium-assets.js`; each full `.blend` under `work/living-v8/exports/herbarium/` contains editable meshes/materials, packed image data, that JavaScript source, and `PARTS_AND_SUPPORT.json`. Reference images informed the art direction and are not model evidence or applied textures.

`manifest.json` identifies the exact authoring source, final GLB, Blender file, source textures, bounds, triangles and botanical provenance. Each `.parts.json` identifies named structural/support/plant components by their actual batch triangle index ranges. Each `.packing.json` records verified decoded geometry-attribute and RGBA-pixel identities.

Production code calls `loadHerbariumAssets()` from `world/src/herbarium-assets.js`, then its constructors. It fetches the three shared `botanical/*.glb` sources and existing `/textures/` PBR channels once through the resource coordinator. The assembled four GLBs and editable files are preserved outside public/Git under `work/living-v8/exports/herbarium/`, served locally at `http://127.0.0.1:4234/work/living-v8/exports/herbarium/`. They are portable editable/export deliverables; production constructors do not fetch them or their `.blend` files. No raw intermediate GLB archive is shipped.

The packed assembled GLBs require the standard `EXT_meshopt_compression` and `EXT_texture_webp` loader extensions. The existing `world/src/gltf-resource.js` configures Three.js GLTFLoader with MeshoptDecoder. Packing is entropy compression only: no geometry quantization, simplification, reordering, texture resizing or lossy pixel conversion. Lossless WebP is accepted only when its decoded RGBA matches exactly, including RGB beneath transparent pixels. Every accessor byte and ordered triangle winding is checked again after decoding.

Rebuild all final GLBs and editable scenes from the worktree root:

```sh
node world/scripts/export-herbarium-assets.mjs
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --background --python-exit-code 1 --python docs/art/living-v8/herbarium/audit-editable.py
```

The local full exports are intentionally ignored by Git to avoid redundant deployment copies and large GitHub blobs. A fresh checkout can reproduce them with these commands; the ordinary test suite explicitly skips only the optional local export gate until they exist. The first command requires the existing Node dependencies and Blender at the path above. It generates temporary uncompressed-geometry Blender inputs, imports and packs them, saves compressed editable scenes, then removes the temporary GLBs. `rebuild-editable.py` is the generated import stage of that command and is not a standalone rebuild after the temporary inputs are removed.

The save stage starts Blender with factory settings and propagates Python failures as exit1. It requires a completed save for every family before certifying editable hashes, deleting import inputs or publishing manifests. A failed save remains a failed rebuild even when older `.blend` files are present.

## Botanical credits

The composition uses these full-detail CC0 Poly Haven sources with original positions/normals/UVs and all 4096×4096 source image pixels preserved:

- [Fern02](https://polyhaven.com/a/fern_02): Rob Tuytel (scanning), Rico Cilliers (modeling). Selected source variants b and a.
- [PeriwinklePlant](https://polyhaven.com/a/periwinkle_plant): Amal Kumar. Selected variant 04 LOD0.
- [PottedPlant01](https://polyhaven.com/a/potted_plant_01): Rico Cilliers. The complete tree retains the pot, pebbles, stem and leaves with their original relative node transforms. Lower planted collections reuse its actual pot/pebble geometry.

[Poly Haven asset license](https://polyhaven.com/license): CC0. The original packages are preserved in `work/living-v8/research/plant-sources` with official URLs, MD5 verification and SHA256 records. No website example renders are packaged. `botanical/sources.json` records each runtime derivative. `docs/art/living-v8/herbarium/prepare-botanical.mjs` copies original decoded RGB with its matching original alpha into an unresized image; the supplied source JPEG alone did not contain the mask. The rejected shrub study remains in research evidence and is excluded from the production composition.
