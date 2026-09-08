# Animated character assets

The rider is an adult seated broom pilot with a full antique-silver mask, a bent deep-indigo felt hat, a tailored coat and layered burgundy-lined cloth. The mask has real narrow apertures and a sculpted brow, nose ridge and tapered jaw. A fitted head cowl covers the back and neck. The guardian wears an original porcelain mask and crescent crown above a layered, curved robe. These are the actual 3D assets loaded by the game.

## Runtime assets

| Asset | Triangles | GLB bytes | Skin / bones | Looping actions |
| --- | ---: | ---: | --- | --- |
| `wizard.glb` | 210,652 | 7,963,620 | 1 / 43 | `idle`, `cruise`, `turn_left`, `turn_right`, `boost` |
| `wraith.glb` | 28,692 | 1,223,028 | 1 / 27 | `idle`, `approach`, `channel` |

The files and authoritative hashes are in `world/public/models/characters/manifest.json`. The rider cache token is `academy-tailored-v9-20260908`; the guardian uses `academy-guardian-v7-20260908`. Limits are 400,000 triangles / 12 MB for the rider and 30,000 triangles / 3 MB for the guardian. Materials use authored PBR values and embedded weave images. The rider wool, twill and satin now include 512 px tangent normal maps and roughness maps, exported as standard glTF material textures. There are no exposed-skin materials or hair cards in the masked rider.

Pigment images encode the original linear material palette and its subtle weave into sRGB before writing non-float image pixels. Writing linear values directly into an sRGB image had made the cloth much darker when decoded by Blender and glTF. The packed coat PNG now averages RGB8 (64.46, 91.21, 116.13), decoding to linear (0.05200, 0.10513, 0.17508), close to the intended (0.052, 0.105, 0.175). Trousers decode to (0.03697, 0.05398, 0.06794), and hat felt to (0.01693, 0.02703, 0.05200). An isolated Blender emission comparison confirmed that encoded image pixels match the direct linear shader color. Normal and roughness images remain Non-Color. The editable rigs contain the same corrected, packed pigment PNGs as their GLBs.

The export step normalizes `KHR_materials_sheen.sheenColorFactor` to the source Principled shader's linear RGB tint multiplied by its weight. Blender 5.1's exporter otherwise writes the tint alone whenever weight is nonzero, producing full white sheen in Three.js despite a low Blender weight. Rider wool/scarf use 0.12, twill/satin 0.055 and hat felt 0.025; guardian wool/lining use 0.025 and satin 0.08. Sheen roughness remains 0.6. This sheen normalization changes only JSON color factors. The later pigment correction replaces only the nine base-color PNG buffer views; mesh, skin, animation, normal and roughness buffer contents remain byte-identical. The editable rigs retain the original shader palette and sheen values.

The coat and trousers use connected adult anatomical topology reshaped into an asymmetric forward-seated posture. Tapered ridge-and-trough strokes sculpt elbow compression, forearm tension, wrist gathering, armhole-to-waist tension, belt compression, knee bends and seat contact. Each projected stroke is restricted to its skin region and surface direction; discontinuous projection onto another side of a bent joint is split and tapered away. Broad panels between those loaded areas stay smooth. The denser anatomical mesh supports these localized folds; the previous coat decimation has been removed. Shoulder and cuff linings follow the garment's actual boundary vertices and skin weights; the wrist lining reaches the glove palm. A thick lined standing collar finishes the neckline. Closed turned wrist cuffs cover the glove joins; gloves have tapered curled fingers, smaller thumb tips and back stitching. The scarf sits within the collar and finishes below it with a compact continuous turned hem and actual cloth thickness. The mask's supported eye-opening rows avoid the fold-over that caused a ragged upper edge in an intermediate render.

## Rig and animation contract

```js
import {
  loadCharacterAssets, createWizard, createWisp, updateCharacter,
} from './characters.js';

await loadCharacterAssets();
const rider = createWizard();
const guardian = createWisp();

// Once each frame; Game owns position, heading and banking.
updateCharacter(rider, {
  dt,                   // elapsed seconds, clamped to 0–0.1
  speed: normalizedSpeed, // 0–1
  turn: steering,       // -1–1
  vertical: climbInput, // -1–1; subtle head adjustment
  reducedMotion,
});
updateCharacter(guardian, {
  dt, speed: approachSpeed, state: channeling ? 'channel' : undefined,
  reducedMotion,
});
```

The loader deduplicates concurrent requests, validates the required actions and rider attachment nodes, surfaces errors and permits retries. It accepts `loadCharacterAssets({baseURL})`; the default is `/models/characters/`. Importing the module does not use browser globals. The existing procedural factories remain a fallback for simulation tests before assets load.

Factories use `SkeletonUtils.clone`. Each actor owns independent bones, an `AnimationMixer`, action weights and phase. GPU geometry, materials and textures are shared. Skinned meshes disable rest-pose frustum culling because the cloth moves outside those original bounds. World-level visibility and distance selection remain the caller's responsibility.

The 43-bone rider rig keeps the pelvis seated and uses root-parented hand targets with two-bone arm IK. Two clavicle bones add shoulder lift and forward reach, while the planted left hand stays on the broom. Stronger coordinated torso lean, controlled right-hand aiming and offset knee/ankle follow-through distinguish cruising, turning and boosting. Blender bakes the constrained arm motion into the GLB. Twelve cape bones, four scarf bones and six coat-tail bones carry overlapping cloth waves. The cape sags between the shoulder attachments, opens into long directional folds and turns at its side and rear hems. Its lining has 0.014 model-unit thickness; the folded coat tails use 0.013. Piping and embroidery inherit barycentrically sampled weights from adjacent cloth triangles, rather than estimating the cloth position from one coordinate. The scarf arch was raised after an actual boost/back review exposed an intersection with the lifted cape. Rider clips are normalized to start at zero and last exactly four seconds. The guardian has independent core, mask, gown, side-panel and back-train chains. These are authored skeletal loops, not a runtime cloth simulation. Input changes blend their weights smoothly. Reduced motion holds a fixed idle frame.

The art coordinates are Y up, forward −Z. The following Object3D references remain available on the rider:

| Property | Exported node | Use |
| --- | --- | --- |
| `userData.cape` | `rider-cape` | Skinned cloth node; may be a multi-material Group |
| `userData.scarf` | `rider-scarf` | Skinned scarf node; may be a multi-material Group |
| `userData.wandTip` | `wandTip` | Follows the animated right hand; use `getWorldPosition()` for effects |
| `userData.broomTail` | `broomTail` | Follows the broom bone; use `getWorldPosition()` for trail effects |

The old cape/scarf Object3D rotation animation must not be applied on top of these clips. Bone names containing punctuation are sanitized by Three.js property binding; `hand.L` becomes `handL`. The additional `gripContact` socket follows the baked left forearm endpoint and exists to verify wrist-to-hand contact.

## Sources and editable files

The active external input is the **Body Male - Realistic** object (`GEO-body_male_realistic`) from Blender Studio and community contributors' [Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/), distributed under CC0. The [official versioned bundle](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip) identifies the release. Coat and trouser regions are cut, inflated, reshaped, weighted and remapped into the riding posture. Source head and eye geometry are not exported.

`world/public/models/characters/source/` contains:

- `blender-studio-anatomy-cc0.blend`: retained body/eye subset, 639,977 bytes. Only the body garment regions are used.
- `wizard-academy-rig.blend` and `wraith-academy-rig.blend`: editable final geometry, armatures and actions.
- `sources.json` and `LICENSE.txt`: source URLs, adaptations, hashes and license evidence.
- Earlier head and Cortu Johnstone CC0 hair files: archived provenance, unused by the current builder.

The masks, hat, head cowl, garment linings, accessories, cloth panels, gloves, boots, broom, crown, weights, rigs, actions and weave albedo/normal/roughness images are authored by `scripts/art/build-characters.py`. The current build does not load the archived hair images or external clothing/leather texture packs. The source files are build inputs and are not loaded by the browser.

## Rebuild and review

From this checkout's repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/art/build-characters.py
```

Verified with Blender 5.1.2 in an isolated factory scene. The command exports both GLBs, saves the editable rigs, renders the actual views, and writes the manifest after rendering finishes. Wait for `CHARACTER_ASSETS_COMPLETE` before testing hashes or reloading a build in progress.

Optional arguments follow `--`:

- `--only=wizard` or `--only=wraith`: rebuild one character and retain the other manifest entry.
- `--no-render`: export models, source rigs and manifest without studio rendering.
- `--preview`: still replaces the GLBs and manifest, but uses 12 Cycles samples at 70% resolution and permits temporary triangle-budget overage for art iteration. It is not a final delivery check.

Final actual renders use 40 Cycles samples at 1050 × 1150. They are under the parent workspace's `outputs/qa/academy-v2/`:

- Rider: `character-wizard-front.png`, `character-wizard-three-quarter.png`, `character-wizard-side.png`, `character-wizard-back.png`, `character-wizard-face.png`, plus `character-wizard-garment.png` for the sleeve, cuff and knee closeup.
- Rider action frames: `character-wizard-boost.png`, `character-wizard-turn_left.png`, `character-wizard-turn_right.png`.
- Guardian: `character-wraith-front.png`, `character-wraith-three-quarter.png`, `character-wraith-side.png`, `character-wraith-back.png`, `character-wraith-approach.png`, `character-wraith-channel.png`.

The earlier ImageGen concept remains a design reference in the workspace; it is not a rendered model or a runtime billboard. The final masked design follows the user's later art direction. The runtime asset studio is maintained separately in `world/asset-studio.html` and supports asset, view and action inspection.

## Verification scope

`node --test tests/character-animation.test.js` from `world/` covers eight checks: actual file hashes, budgets, skins, required actions and exported textile material textures; actual GLB sheen factors and roughness for all nine cloth materials; decoded embedded PNG pigment means against the linear palette and retained weave variation; independently cloned bones with shared geometry; fixed seat and gripping-hand contact with moving wand socket and moving shoulder/elbow/knee poses; presence of the full mask and hat; cloth deformation, loop continuity and finite sampled bounds; and input blending/reduced motion.

The Node loader decodes the shipped mesh, skin and animation data with only image/material tables omitted from its local test response because Node has no browser image decoder. A separate PNG decoder unfilters the actual packed pigment pixels and applies the sRGB transfer function; all nine decoded linear means must stay within 0.001 of the source palette. Raw GLB material names, texture references and attributes are also inspected. Loop checks use each clip's exported duration, so the end of the actual loop is checked even when another asset retains a different time range. It samples cloth and mesh vertices across all exported actions; it does not prove every possible blend is collision-free. The actual Blender renders establish studio appearance. Integrated Three.js material rendering, gameplay, camera visibility and performance require the parent task's browser review.
