# Task 5 — authored ground motion and integration primitives

The delegated asset/runtime primitives are implemented and verified. Integrated Game controls, landing travel, camera, actual gameplay recording and compressed-derivative acceptance belong to the root integration task and are not claimed complete here.

## Delivered

- `scripts/art/build-characters.py` retains the full masked rider, tailored garment meshes/materials, 43-bone bind rig and eight existing flight actions. It adds six authored clips: `ground_idle` (2 s), `walk` (1 s), `run` (.70 s), `mount`/`dismount` (1.20 s), `ground_cast` (.60 s). Ground joint targets are solved in armature space and converted through bone-local/rest matrices; 100 Hz keyed poses maintain the in-place stride contract. No downloaded animation or new external asset/license was introduced.
- Standing uses an upright spine, asymmetric relaxed foot stance, reachable leg joints, independent arm IK targets, gravity-hung cape/scarf/tails and garment clearance. Original unequal leg lengths remain intact; an attempted scale correction was removed because it produced nonuniform-transform shear. Mount/dismount use staggered leg arcs and hand reach, with exact flight endpoints. Cape waist overlap found in the back render was corrected through the authored drape.
- Broom-only meshes are consolidated independently and tagged `broomPart`; hiding the broom no longer hides shared actor brass/leather or the wand. `sole.L/R`, `toe.L/R` anchors and `groundMotion` metadata are exported. Existing named cape/scarf/hat/mask/wand/broom/grip attachments are retained.
- `world/src/characters.js` adds ground/transition evaluation, ground cast timing, stance-foot world locks, .14 s ground pose blending, bounded two-bone foot/pelvis correction for supplied support, sole alignment to support normals and explicit motion reset. Paused/zero-dt updates remain inert. The root's loader changes are preserved in the working tree but excluded from this task's staged motion hunks.
- `world/src/ground-motion.js` is pure. It queries rendered terrain and permitted bridge/foundation/exhibition surfaces, checks slope/footprint/water/headroom, traverses low steps and slides/stops at obstacles without using flight penetration recovery. It accepts explicit `walkable` flags for further surfaces. `studio.js` adds ground/mount selectors and an actual MediaRecorder ground sequence using the existing capture lifecycle.

## Final asset and measured contact

Wizard source GLB: **23,473,556 bytes**, **255,660 triangles**, **31 meshes**, **43 bones**, **14 clips**. SHA-256:

`6f1a9ad3f526855a5299ab948db0b4cd1331122b44c81089b074ff24068ee588`

The original 255,660 triangles and full material detail remain; extra meshes isolate broom material groups. The source remains below the original 24 MB export cap. Wraith GLB/source rig were not regenerated.

Dense exported contact samples for both feet and both gaits measured maximum **1.183 mm sole-height error** and **0.331 mm stance drift** after subtracting actual world travel. Standing sole datum is **−1.30 m** relative to actor origin; measured hat top is +1.88822 m, total 3.188 m above sole. Headroom metadata is conservatively **3.24 m**. These are test measurements of this asset, not GPU performance measurements.

## Stable integration API

```js
import { CHARACTER_GROUND_MOTION, updateCharacter, resetCharacterMotion } from './characters.js';
import { GROUND_MOTION, queryGroundSupport, findSafeLanding, stepGroundMotion } from './ground-motion.js';

const world = { heightAt: renderedTerrainHeight, colliders, waterLevel: -15 };
queryGroundSupport({ x, z, feetY, radius, height, maxRise, maxDrop }, world);
// { valid, y, normal, surfaceId, reason }
findSafeLanding({ x, y, z }, world, options);
stepGroundMotion({ position, velocity, heading }, { x, z, run }, dt, world);
// { position, velocity, heading, support, distance, blocked, reason }
```

Pure motion positions use the **sole plane**. Convert to actor root with `actorY = support.y - CHARACTER_GROUND_MOTION.soleY`. Defaults: radius .32 m, height 3.24 m, walk/run 1.6/3.8 m/s, step-up .30 m, step-down .40 m, maximum slope 35°. `allowSteps` is used by movement, while landing requires the stricter supported footprint. Invalid reasons include `water`, `slope`, `edge`, `blocked`, `no-support`.

`updateCharacter(actor, {dt, mode, groundSpeed, gaitPhase, transitionProgress, groundSupport, paused, reducedMotion})` accepts mode `grounded`, `mounting`, `dismounting`, or default `flying`. `groundSpeed` is **actual m/s**, `gaitPhase` normalized 0–1. Advance phase by actual returned distance / cycle distance: walk 1.6 m, run 2.66 m. Initialize from rest around walk phase .29 or run phase .18, and preserve phase when switching gaits. `transitionProgress` is explicit 0–1 and Game owns world displacement. Existing cast result fields remain, with `gaitPhase`/`mode` added on ground updates.

`groundSupport={x,z,y,normal,heightAt?}` drives the pose correction. Optional `heightAt(x,z)` provides actual individual-foot support heights for steps; without it the supplied plane is used. To query a foot surface with the pure helper, use `radius:0,height:0` and the current support Y as `feetY`, preserving bounded rise/drop. Game should freeze ground horizontal movement during the .60 s planted ground cast. Gate casting during mount/dismount before the existing immediate-cast fallback. Ground cast still releases once at .18 s, with pause/reduced-motion/cancellation contracts preserved.

After Game cancels/refunds its pending cast, `resetCharacterMotion(actor,{mode:'flying'|'grounded'})` resets the skeletal pose, cast/boost transition state, gait phase, planted feet and cape history. Game owns safe landing, input/UI, transition root height, camera and teleport/race/respawn state. Existing R/F/Space/Q/E/V/spell controls should remain; B is available for the root's broom toggle.

## Verification actually performed

Command from project root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/art/build-characters.py -- --only=wizard --no-render \
  --qa=work/experience-v4/character-review
node --test world/tests/character-animation.test.js world/tests/ground-motion.test.js world/tests/studio-review.test.js
```

The builder reached `CHARACTER_ASSETS_COMPLETE`. **43 tests passed** in the final combined run; the small subsequent studio selector/bounds/record-label update also passed all 11 studio tests. Coverage includes original seat/grip and cloth/chest clearance, clip seams/extents, boost/cast/pause/reduced motion, source pigment/material provenance, sole/stride contact, mount endpoints, a sloped runtime foot plane, actual-distance idle-to-walk foot locking, water/edge/roof/headroom rejection, bridge support, wall stopping and low-step traversal. Initial tests caught and drove fixes for scale shear, sparse gait interpolation, low-step support and startup foot contact. No test tolerance was widened to hide those failures.

11 native **840 × 1050** Blender 5.1.2 Cycles source-rig stills were rendered and individually inspected: neutral front/side/back, day/night stand, walk contact/passing, run contact/flight, mount midpoint, cast release. Full rig/materials are used, with the isolated broom hidden only for ground clips. These are **source-rig art evidence**, not Three.js gameplay recordings. `render-ground.py` reproduces them when invoked against the retained wizard `.blend`. `evidence.json` records native PNG hashes and the final GLB hash. `tests-final.log` retains the combined check output.

Preview: **http://127.0.0.1:52821/** (loopback server left running). PNGs were visually inspected; HTML/image availability checks are recorded separately from full browser layout acceptance. The gallery is a simple index, and no browser layout test was claimed.

In the actual Three.js `asset-studio.html?asset=rider`, choose **Stand / 站立**, then the existing **Record 16s** button for the new ground sequence: stand 0–2, walk 2–4, run 4–8, stand 8–10, mount 10–11.2, hover 11.2–12, dismount 12–13.2, stand 13.2–14, ground cast at 14. Existing flight recording remains unchanged when recording starts from a flight selector. Individual ground/mount selectors, front/side/back/garment/mask views and day/night lights remain available. The root must record and inspect real moving gameplay for final Task 5 acceptance.

## Remaining integration gates

Root must verify actual terrain/bridge/platform travel and safe landing trajectories, B/touch bilingual controls, camera transitions, cast refunds through teleport/respawn, pause during all modes and compressed runtime derivatives. Runtime supports only explicitly permitted proxy surfaces; it does not infer walkability from arbitrary decorative meshes or all roofs. Stance IK is bounded and releases an unreachable lock rather than stretching the leg; abrupt direction changes/terrain discontinuities require the integrated review. Blade-thin garment clearance across every possible blend is not proven by sampled tests/stills.

Existing checked-in provenance covers Blender Studio CC0 garment topology and Poly Haven CC0 cloth/leather detail. New actions are authored in the existing generator. The character notice deliberately does not relicense original repository work as CC0. The root's resource packing/loader work owns Meshopt derivative verification; no source mesh simplification was performed here.
