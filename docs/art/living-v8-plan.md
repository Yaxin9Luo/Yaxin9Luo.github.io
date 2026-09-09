# Living Academy v8 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task. User explicitly selected subagents and delegated design decisions. No further execution-choice question.

**Goal:** Deliver a visibly richer garden academy with faithfully authored roaming Elizabeth/Sadaharu and beautiful living day/night atmosphere.
**Architecture:** Original Blender/GLB characters and standalone authored garden-kit assets pass studio review before installation. Existing world/support/lighting systems remain authoritative; small focused modules provide new districts, atmosphere and companions.
**Tech Stack:** Three.js0.185.1, Vite8, Blender, existing Node tests/Jekyll combined site.
**Spec:** docs/art/living-v8/design.md

## Global Constraints

- Quality first; no global mesh/DPR/texture reduction. Preserve castle, traditional/bilingual CV/content, all portals, movement, default gameplay/time and painted distance.
- User authorized autonomous decisions while asleep. Reference images/clip hypotheses are not actual asset evidence. Every source image retains provenance; no unlicensed show audio in public.
- Use this isolated worktree only. Preserve others' changes. Each worker owns exact files, never spawns or pushes; root controls browser/captures. Implement serially when integration files overlap, commit only owned changes after root's asset/art gate.
- Meaningful tests inspect actual GLB, geometry, support, animation/resource/state behavior. Do not pin subjective artistic constants as tests. Final full suite/build and independent review are required.

## Task 1: Faithful character assets and isolated review stage

**Files:** create world/scripts/build-companion-assets.py, world/public/models/companions/* (our .blend and hashed .glb), world/src/companion-manifest.js, world/src/companion-assets.js, world/src/companion-studio.js, world/companion-studio.html, focused world/tests/companion-assets.test.js; add only companion-studio build input in world/vite.config.js. Docs/source provenance under docs/art/living-v8/companions/. No Game/world placement yet.
**Consumes:** verified reference files and full character-design.md. Blender binary /Applications/Blender.app/Contents/MacOS/Blender. Existing renderer/capture patterns are read-only examples.
**Produces:**
```js
await loadCompanionAssets({signal, deadline}); // true decoded assets, independent of Game
const actor=createCompanionActor(kind,{lang:'zh'}); // 'elizabeth' | 'sadaharu'
// actor.group is THREE.Group; actor exposes:
actor.setAction('idle'); actor.update(dt,{paused:false,reducedMotion:false,speed:0});
actor.setSign({zh:'路过也欢迎。',en:'Just passing by? Welcome.'});
actor.setLanguage('en'); actor.dispose();
// report exact supported actions, authored stride, anchor node names and bounds.
```
- [ ] Open actual TV reference images and author Elizabeth static model first. White shell continuous; eyes/lashes/beak/arms/web feet are real attached geometry. Save editable Blender and actual GLB; render neutral front/side/back/3quarter/face and silhouette. Root and independent character designer inspect; fix and re-render before animations.
- [ ] Add independent rig and in-place idle/walk/sign-raise/hold/lower, held sign with proper socket/contact and localized original text. Author Sadaharu with connected body, correct head/collar/tail and actual quadruped idle/walk/sit/stand/sniff/greet clips. Repeat static and8 gait-frame reviews. Do not settle for intersecting primitive spheres.
- [ ] Build an isolated browser studio with front/profile/back/threequarter/face selectors, day/neutral/night, action/time/pause controls, frame saving via existing capture endpoint and clip recording. Start with asset before showing main map; keep controls accessible and report actual load failures.
- [ ] Meaningful tests decode final GLBs through real GLTFLoader (Node only strips browser-only image descriptions if necessary), verify finite geometry/rig/clip tracks, supported actions, clone skeleton independence, sign resources, loop/pose continuity and feet support. Regression example:
```js
const a=createCompanionActor('elizabeth'),b=createCompanionActor('elizabeth');
a.setAction('sign'); a.update(.5,{paused:false,reducedMotion:false,speed:0});
assert.notEqual(a.group.getObjectByName('SignSocket'),b.group.getObjectByName('SignSocket'));
// Check actual held sign socket position, finite matrices and independent clip times.
```
- [ ] Preserve material/animation/source identity on load; own and release per-instance sign textures/mixers while cached geometry remains shared. Run focused tests/build, self-review, report actual assets/hashes and constraints, commit after asset art passes. Stop stage1 for root art review, not user approval.

## Task 2: Original garden architecture and planted-edge kit

**Files:** create world/src/herbarium-assets.js, world/herbarium-studio.html, world/src/herbarium-studio.js, world/scripts/export-herbarium-assets.mjs plus editable Blender/export assets under world/public/models/herbarium/, tests/herbarium-assets.test.js. Add only herbarium-studio build input to vite.config.js. No world placement yet.
**Produces:**
```js
createArcade({bays:4}); createConservatory(); createWaterGarden();
createGardenBorder({length:12,seed:81});
// each returns THREE.Group with ground at local y0, dimensions and colliders/support metadata in userData.
```
- [ ] Author slender open pointed arches with real voids, shaped bases/capitals, arch voussoirs and supported coping. Conservatory has curved ribbed glazing, doors, gutters, stone plinth, detailed iron nodes and visible plants/pots/workbench; intentional shared glass/material grouping, not an opaque cube.
- [ ] Water garden has real coping/lining, restrained ripples, lily leaves/blossoms, grouped benches/planting. Border kit has foreground low flowers, medium foliage, sparse taller accents and curved stone edge, plus purposeful gaps; compatible PBR and no regularly spaced bouquets.
- [ ] Isolated studio actual neutral/day/night views at character and overview scale, frame saving. Root art-review of all four asset families before placement. Save original GLBs and editable Blender representation with correct sources; preserve shared-texture ownership.
- [ ] Tests validate finite geometry, positive open spans/door clearance against delivered actor bounds, real floor/structural support metadata, no detached glass/parts, clone transforms/disposal. Run focused checks/build, self-review, commit after review.

## Task 3: Connected main-island gardens and ground treatment

**Files:** new world/src/herbarium-layout.js and herbarium-district.js; narrow world.js/world surface-support integration, environment-layout.js/landscape.js planting/ground sections; necessary terrain bake/manifest/new hashed derivative in existing scripts; focused terrain/runtime/herbarium placement tests. Do not alter Task1 actors, lake/v7 fog or distant source artwork.
**Interfaces:**
```js
herbariumSites; gradeHerbariumTerrain(x,z,height); herbariumAt(x,z);
createHerbariumDistrict(root,{heightAt}); // {group,colliders,supportSurfaces,update,dispose}
```
- [ ] Verify shortened candidate sites from research against FULL placed geometry, existing gardens/landmarks/portal approach/road curves and mature tree crowns. Adjust within the existing island as needed. Foundation grading must be continuous, preserve previous authored grades and be present in active runtime GLB. Do not float pavilions on raw1–2m slope.
- [ ] Connect courts through grouped flower borders, low planted edges and a clear mown arrival lawn; soften/reduce only canopy-exclusion sectors that prevent composition, without hiding portfolio signs or castle facade. Preserve route width and all interaction approaches.
- [ ] Remove obvious meadow tiling using consistent coordinate transforms for color/normal/roughness and continuous authored district masks. No global blur/low-res texture swap. Verify actual shader compilation and near/overview PBR response, not only string tests.
- [ ] Integrate district once in full/progressive world assembly; register lighting/colliders/support and lifecycle. Bake only changed terrain descriptor; preserve unrelated derivatives. Test actual face interiors against ground, roads/bridge/portal grades, pool avoidance, finite terrain, full/cold assembly idempotence.
```js
for(const site of herbariumSites) for(const p of sampleFloor(site)) {
 assert(Math.abs(renderedTerrainHeight(p.x,p.z)-site.floor)<supportTolerance);
}
// Also evaluate actual decoded runtime triangles, not just source height function.
```
- [ ] Root native matched overview/arrival/castle forecourt/conservatory/water garden/day/night review; refine composition, then focused checks/build/self-review/commit.

## Task 4: Authored daylight, moonlight and living sky

**Files:** atmosphere.js, focused new sky-fauna.js if useful, environment-time.js palette only as justified, narrow world.js removal of old duplicated bird/glow/mote layers and update context, Game existing world.update context only, asset studio fauna entries, relevant tests. No v7 fog/painting changes.
**Interfaces:** retain createAtmosphere(scene,{heightAt}), its environment/sun/moon/update/release API; extend update context with paused in backward-compatible form. Existing Game world.update viewport context gains paused flag; no clock replacement.
- [ ] Read full atmosphere-design.md. Author bird body/head/beak/tail and separate wings with glide/flap/bank, lantern translucent shell/ribs/flame/open rim, low firefly groups. Review actual specimens before scene placement. Instance opaque structures where equivalent; maintain transparent sorting and real mirror-pass orientation.
- [ ] Replace old12 line birds/16 glow balls/140 motes when new layer is live. Retain bounded26 lanterns+8releasepool and90 grouped fireflies or revise visually if justified, without double scenes. Use spatially authored side routes and garden-release pockets.
- [ ] Tight sun/moon halos, warm sunlight/cool readable moon and continuous day/night visibility. Use local activity clock advanced only by allowed dt; reduced motion keeps static legible effects; no reading/background drift or burst on resume. Release lifetime must use elapsed accepted activity time, not inconsistent .1s cap.
- [ ] Test full/progressive ownership, no duplicate layers, day/night fade continuity, pause/reduced freeze and resume, mirror camera callbacks, bounded releases and idempotent disposal including instance/morph resources. Native day/dusk/night/high/low review before commit.

## Task 5: Companion roaming, signs, interactions and original foley

**Files:** new companion-system.js / companion-foley.js if useful, original audio manifest, narrow Game start/enhancement/update/interact/raycast/frame/dispose hooks and UI nearby prompt/i18n; tests/companions.test.js and focused UI/loading/audio tests. Reuse completed Task1 actors; do not remodel silently.
**Produces:**
```js
const companions=createCompanionSystem({root,heightAt,colliders,onMessage,onSound});
companions.update(dt,{playerPosition,paused,reducedMotion,night,language});
companions.nearest(position); // null | {id,label:{en,zh},actionLabel:{en,zh}}
companions.interact(id); companions.setLanguage(lang); companions.dispose();
```
- [ ] Install once after real actor assets load, with cancellation and shared-cache/per-instance ownership. Initial companions near courtyard, away from portal/exhibit faces. Roam through valid grounded waypoints; test full swept segments/feet against ground and obstacles, limit slope/shore access. Smooth heading and actual traveled speed drive pose; stops do not slide.
- [ ] Elizabeth pauses, faces visitor, raises original bilingual board, holds readable text and lowers. Sadaharu greets/sniffs/sits/wags then resumes. Optional short nearby duo gag with long cooldown; behavior does not require enabled combat or collected items. Reduced-motion interaction presents stable readable board/pose.
- [ ] Wire click/touch/E and nearby-name/action prompt. Preserve priority for portfolio/exhibit access; no friendly combat damage and no forced page opening. Interaction effects small/local (wood tap, brief dust/handdrawn accent), no screen shake. Original foley obeys existing explicit audio unlock/mute/suspend/volume, distance attenuation and bounded voices. Preserve separate source provenance, not copied anime audio.
- [ ] Meaningful seeded roaming, frame-rate independence, obstacle/shore no-crossing, rapid repeat interactions, bilingual signs, pause/reduced, cold/cancel load, raycast/UI priority and shared resource disposal tests. Actual audio enabled/muted browser check, actual walk/pet/sign interaction recording. Commit after review.

## Final integrated gate (root + independent reviewer)

- [ ] Matched native before/after overview, arrival, castle, conservatory and water garden day/night; sky/flying high/low; Elizabeth full/face/sign and Sadaharu walk/greet actual frames plus recordings. Rejected candidates preserved and clearly labelled.
- [ ] Normal production cold startup (not only studio preloading), immediate CV/portfolio, all new character interactions, defaultplay/time, language, reduced-motion and audio. Console/GPU errors empty; representative HTML/CSS/JS/GLB/PBR/CV HTTP200 and actual image/resource readiness.
- [ ] Final complete tests and combined Vite/Jekyll build, independent whole-branch review, fix any significant findings and scoped re-review. Separate20s high/native performance from capture; report actual hardware and limitations.
- [ ] Keep clean local branch/worktree/preview; comparison and asset gallery use real renders. Copy research source links and final evidence/rulings into docs. Archive completed SDD evidence before clearing its active workspace. Do not push or deploy this iteration unless requested.
