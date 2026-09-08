# Character assets / 人物与守护灵资产

This revision replaces the primitive face and short shoulder sheet with a mature anatomical head, textured hair cards, a continuous tailored coat and a long lined cape. The enemy is an original floating moon guardian with an ivory mask, crescent crown and flowing drapery. Neither figure depicts a film character or claims to be a likeness of Yaxin Luo.

## Runtime files and budgets

| Asset | Triangles | GLB size | Geometry |
| --- | ---: | ---: | --- |
| `world/public/models/characters/wizard.glb` | 89,110 | 5,007,284 bytes | Original coat, cape, scarf, gloves, boots and broom; adapted CC0 anatomical head and hair |
| `world/public/models/characters/wraith.glb` | 28,674 | 1,895,056 bytes | Original mask, crescent crown, drapery, crystal and ornaments |

The authoritative counts are in `world/public/models/characters/manifest.json`. Limits are 100,000 triangles / 8 MB for the researcher and 30,000 triangles / 3 MB for the guardian. Source assets in `source/` are build inputs and are not loaded by the website. Guardian instances share mesh buffers, materials and textures; cloning does not duplicate those GPU resources.

## External sources and license evidence

| Source | Author | License | Use |
| --- | --- | --- | --- |
| [Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/) — Head (Animation), Realistic | Dan Ulrich / Blender Studio; author verified in the downloaded collection's metadata | CC0 | Head, sclera and iris topology. The bundled Multires detail was applied before extraction. The build refits the head, trims the bust, paints subtle skin variation and adjusts eye materials. |
| [MakeHuman Hair 01 — short_messy](https://static.makehumancommunity.org/assets/assetpacks/hair01.html) | Cortu Johnstone | CC0; also stated in the original `.mhmat` and `.mhclo` files | Original hair-card mesh and albedo/alpha. Refitted to the researcher and tinted chestnut; a second refitted layer covers the back. The original object-space normal map is deliberately not used on the transformed cards. |
| [Poly Wool Herringbone](https://polyhaven.com/a/poly_wool_herringbone) | colormass; processed by Rico Cilliers | [CC0](https://polyhaven.com/license) | Cloth albedo, normal and roughness maps, with separate garment tints. |
| [Brown Leather](https://polyhaven.com/a/brown_leather) | Rob Tuytel | [CC0](https://polyhaven.com/license) | Gloves, belts and boots use albedo, normal and roughness. |

`world/public/models/characters/source/sources.json` records exact download URLs, adaptations and SHA-256 hashes of the retained source files. The complete upstream archives remain in the workspace's intermediate `work/character-assets` directory; the build requires only the small retained source subset. The Poly Haven team's texture manifest records the material acquisition and checksums.

Geometry not listed as external above is authored by `scripts/art/build-characters.py`. Wood grain is generated mathematically. Skin shading uses vertex colors and modest subsurface response in Blender; the exported GLB preserves the color attribute but is not a full cinematic skin shader. WebP textures and texture transforms are embedded through `EXT_texture_webp` and `KHR_texture_transform`.

## Modeling target and actual review

`outputs/qa/characters-concept-v2.png` was generated with the built-in ImageGen tool as a design target. It is not a rendered GLB and is not used as a billboard in the game. The actual character renders are separate files below. The design direction is an adult magical researcher in midnight wool, burgundy lining and restrained antique-gold embroidery, with a graceful moon guardian.

The Blender MCP status tools for Hunyuan3D, Hyper3D Rodin and Sketchfab returned that Blender could not be reached. An additional probe of the add-on's documented public Rodin free-trial route returned `API_INSUFFICIENT_FUNDS`; it did not produce an asset. No private keys, saved Blender preferences or existing Blender scenes were changed. Both final assets were therefore produced using isolated Blender CLI sessions and the licensed inputs above.

Actual 10-sample Cycles studio previews were inspected repeatedly from the front and back, plus a face close-up. The work went beyond the initial revision:

1. The old primitive facial pieces were replaced with Blender Studio anatomical topology, including ears, eyelids, nose, lips and neck. Visible shoulder-bust remnants were removed or refitted behind the collar.
2. The first eye-material pass concealed the iris behind the sclera. Iris and pupil regions were corrected on the visible ocular surface.
3. A fitted scalp alone read as a hard cap. It was covered by licensed textured hair cards, refitted in front and back, and given a darker matte scalp material. The loader uses alpha cutout for hair strands to avoid transparent sorting across the face.
4. Torso and sleeve geometry was joined into a continuous tailored shell. Remeshing and smoothing removed the separate shoulder-ball appearance; elbow compression, seams, lapels and pockets remain visible.
5. The short shoulder sheet became a full-length, lined cape. Winding and lining were corrected after an actual back render showed the wrong face. Gold borders and celestial embroidery lie on the cape's sampled surface and move with its anchor.
6. The old hooded figure with tubular arms was replaced by an original mask-and-crown silhouette. Side drapery tapers and joins a continuous shoulder mantle. The visible upper ends of rear streamers were tucked into the robe.
7. Stair-stepped mask eye holes were replaced with small almond-shaped dark insets and cyan eye details to remain legible after mesh simplification.

Final studio renders use 40 Cycles samples at 1000 × 1100. Relative to the surrounding `outputs` directory:

- `qa/wizard-studio-front.png`
- `qa/wizard-studio-back.png`
- `qa/wizard-face-review.png`
- `qa/wraith-studio-front.png`
- `qa/wraith-studio-back.png`
- `qa/character-review.html` — independent review sheet with actual renders and clearly labeled concept target.

These are substantially rebuilt game assets. They remain stylized and do not reproduce the concept image's cinematic cloth micro-detail, strand-level groom or photographic skin. Studio inspection establishes the actual geometry/material appearance in Blender; the parent task separately owns the integrated Three.js lighting, camera, gameplay and performance review.

## Runtime contract

```js
import { loadCharacterAssets, createWizard, createWisp } from './characters.js';
await loadCharacterAssets();
const wizard = createWizard();
const guardian = createWisp();
```

`loadCharacterAssets({baseURL})` deduplicates concurrent calls, checks all four rider anchors, surfaces loading failures and allows retries. The default base URL is `/models/characters/`. The factories return independent object hierarchies with shared geometry/material/texture storage. Importing the module does not touch browser globals; before loading, the existing procedural factories remain available for Node simulation tests and graceful fallback.

The researcher faces local −Z and preserves the four animation anchors:

| Property | GLB node | Local attachment |
| --- | --- | --- |
| `userData.cape` | `rider-cape` | `(0, 0.76, 0.01)`; `restRotationX` records the rest pose |
| `userData.scarf` | `rider-scarf` | `(0.12, 0.92, -0.04)` |
| `userData.wandTip` | `wandTip` | `(0.105, 0.18, -1.64)` |
| `userData.broomTail` | `broomTail` | `(0, -0.45, 1.99)` |

The modeled flight pose is static. The cape and scarf retain the current small procedural rotations; there is no new skeleton or cloth solver in the runtime. The guardian still uses the existing group movement and combat behavior.

## Rebuild

From the repository root, with the retained source subset and the two Poly Haven texture folders present:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/art/build-characters.py
```

Verified with Blender 5.1.2. This starts an isolated factory scene, exports both GLBs and the manifest, and renders the five actual views. Append `-- --preview` for a 10-sample review without overwriting the GLBs or manifest. The user's running Blender scene is not accessed.

## ImageGen design prompt

Built-in ImageGen, `stylized-concept`, used once for the design target. Condensed prompt:

> Create a professional original fantasy RPG character development sheet with exactly two separate full-body 3D character designs on a neutral desaturated charcoal studio background, no text. Left: an adult male magical researcher riding a hand-carved walnut flying broom in a believable leaning-forward seated flying pose; natural face and realistic adult proportions; dark side-part hair; high-collared charcoal navy wool riding coat, burgundy scarf with gold edging, riding gloves and dark boots. A long heavy midnight-teal cape billows backward, with muted burgundy lining, antique-gold edging and subtle celestial embroidery. Right: an elegant spectral archive guardian with a slender ivory ceremonial mask, pale cyan eyes, graceful crescent crown, midnight indigo layered fabric flowing into tapered tails, fine gold trim and a small luminous chest crystal. Mature painterly realism as premium game assets, large readable folds, woven cloth, matte leather and restrained antique metal. Warm key and cool moon rim. No toy heads, bulbous limbs, cylinders, recognizable franchise characters, logos or words. Clear three-quarter views with uncluttered silhouettes.

## Final verification

The current build passed script syntax checks, the Node-safe character module import and the 40 world tests available at the character-production stage. The integrated suite subsequently grew to 53 passing checks; see [current verification](world-verification.md). Both final GLB containers were parsed independently: sizes, triangle counts, embedded normal/roughness textures, rider skin vertex colors and all four exact anchor translations were checked. The standalone review sheet and representative images/models return HTTP 200 at `http://127.0.0.1:4205/qa/character-review.html`. Its five actual source renders were visually inspected; no browser interaction or runtime performance claim is inferred from those HTTP checks.
