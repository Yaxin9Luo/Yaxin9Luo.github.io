# Companion asset provenance and runtime contract

Elizabeth static r4 and sampled motion r2 have root and independent art approval. Root also passed native browser walk/sign playback, bilingual sign and reduced-motion behavior; final high-bitrate evidence is recorded in `work/living-v8/elizabeth-browser-r2-review.md`. Sadaharu static r6 has root and independent art approval. The dog has a 34-bone rig and six clips. Final r12 local corrections retain the static design and close the reviewed limb/nape surface defects; root's final native GPU art gate passes; independent code review remains a separate gate in the task report. The optional hair-card layer is omitted from runtime based on matched GPU A/B evidence. No world placement is included in Task 1.

The authoring source is `world/scripts/build-companion-assets.py`, run with background Blender 5.1.2. Editable `.blend` files include a neutral studio; exported GLBs contain the actor only. The immutable accepted Elizabeth static source is `elizabeth-static-r4/elizabeth-static.blend`. Each render directory preserves the model revision, camera and review evidence. Rejected binary revisions belong in those evidence directories, not the final public model directory.

## Sources and authorship

The primary reference is BN Pictures' official TV Elizabeth art: local `work/living-v8/research/references/elizabeth-tv.gif`, SHA-256 `a34f308c7d24d1332a3733955146f18d500fd4123050d754611a322fa6bcbe56`; [source image](https://www.bn-pictures.co.jp/gintama/character/img/chara_12.gif), [official page](https://www.bn-pictures.co.jp/gintama/character/03.php). The TV Sadaharu reference and MegaHouse's licensed Elizabeth volume views were also actually inspected. Complete source URLs, file hashes, authority and limitations are in `work/living-v8/research/character-sources.json`.

Meshes, rigs, animations and materials are authored for this project. The underlying Gintama character designs are not ours. Official and licensed reference images stay outside `world/public` and are never model textures. Standing depth, back anatomy, concealed attachments and motion are authored inferences; TV character identity takes priority over chibi merchandise. The original bilingual sign reads “路过也欢迎。” / “Just passing by? Welcome.” The optional generic fine-fur image is newly generated original texture material; its exact prompt, native-alpha metadata and source hash are in `docs/art/living-v8/white-fur-tuft-{prompt.md,source.json}`. The optional layer remains hidden and editable in Blender. Native browser A/B evidence selected the continuous body with its authored 2048² tangent normal map; the final runtime omits the cards because their shading introduced broken grey/white patches without useful silhouette improvement.

Blender uses +Z up and -Y forward; GLB/runtime uses +Y up and +Z forward. Elizabeth stands approximately 3 m tall, with body width/height approximately .50, continuous shell and fused flippers, returned hem, exactly three lashes per eye, tiny pupils, a broad two-part bill and continuous three-toe webbed feet. The immutable r4 decoded bounds size is `[1.97403,2.99150,1.44403]` m; the held sign expands animated actor bounds.

## Loading and actor ownership

`await loadCompanionAssets({signal,deadline})` resolves only after both manifest assets truly decode through `GLTFLoader`; absolute deadline uses `performance.now()` milliseconds. The existing resource coordinator owns cached original scenes, immutable geometry/materials/embedded textures and clips for page lifetime. Repeated loads share these originals. Aborts/deadlines/load errors propagate; creation before loading throws.

`createCompanionActor(kind,{lang:'zh'})` returns independent `group`, `model`, `mixer`, actions and cloned bones through `SkeletonUtils.clone`. Geometry and original materials remain shared. Every Elizabeth owns its own sign socket hierarchy, canvas, CanvasTexture and cloned SignFace material. `setSign({zh,en})` and `setLanguage('zh'|'en')` redraw the same owned texture without affecting other actors. `dispose()` stops/uncaches the mixer, disposes per-instance skeleton bone textures and generated sign texture/material, and detaches the group; shared originals stay alive. `companionAssetDiagnostics()` reports loaded kinds and live actor count.

World positioning, scale and yaw belong to `actor.group`; in-place motion belongs to the rig. `setAction(name)`, `seek(seconds)` and `update(dt,{paused,reducedMotion,speed,getSupportHeight})` operate on that instance. Pause freezes time and pose. Speed is metres/second and scales walk playback by the authored stride speed. Reduced motion holds a readable sign or still idle pose. Elizabeth supports `idle` (3 s), `walk` (1.2 s), `sign_raise` (.55 s), `sign_hold` (2.5 s), `sign_lower` (.5 s), and public `sign` which sequences raise/hold/lower and returns to idle. Named clips remain separately addressable. Walk stride is .64 m, reference speed .533333 m/s, stance fraction .60, phase offsets left 0 and right .5.

## Named supports and sign contact

Elizabeth bones: `Root` places the in-place rig; `Body` drives the shell and concealed upper foot roots; `ArmL/R` and `FlipperL/R` deform the continuous wings; `GripR` supplies the restrained right fin-tip curl; `FootL/R` drive webbed forefeet; `SoleL/R` are attached sole anchors; `SignSocket` drives the thick shaft and board. `SignFace`, `SignBoard`, `SignStaff` are real skinned meshes. SignSocket sits at GripR.tail with Blender world `(0,-.024,0)` offset; the staff radius is .023 m. The sign carries low beside the shell and raises in front.

Sole rest positions in Blender are `(-.4,-.55,.008)` and `(.4,-.55,.008)` m, converted to GLB up +Y. Each sole anchor is parented to its corresponding Foot bone. Upper foot-root weights transition to Body, preserving attachment when the forefoot swings. The walk uses a flat webbed foot with .125 m swing lift, avoiding root exposure and toe pitch penetration.

Optional support callback signature:

```js
actor.update(dt, {
  speed,
  getSupportHeight({kind,name,position,planted,phase,correction}) {
    return worldFloorHeightAt(position.x, position.z); // world Y metres or undefined
  }
});
```

After mixer evaluation, the callback is invoked only for planted anchors. The actor moves each Foot bone vertically toward floor height plus .008 m sole clearance, clamped to ±.08 m. The next evaluation restores the uncorrected local bone transform before the mixer, so corrections do not accumulate and removing the callback clears them. `actor.footStates` records anchor positions before correction, phase, planted state and applied correction. This is a small support adjustment, not IK or arbitrary-slope support; Task 5 owns route grade and body placement. Pause preserves the last pose. Sadaharu uses `FrontSoleL/R` and `HindSoleL/R`, each parented to the matching Paw bone. Small support correction targets `FrontFootL/R` and `HindFootL/R`; sole clearance is .018 m. Standing sole positions in Blender are `(±.4,-.40,.018)` front and `(±.4,1.03,.018)` hind. Each leg has Upper, Lower, Foot and Paw bones, plus its Sole anchor. The trunk is Root/Pelvis/Spine/Chest/Neck/Head/Jaw, with EarL/R and Tail01–Tail05, 34 bones total. Original clips are idle 3 s, walk 1.4 s, sit 1.25 s, stand 1.1 s, sniff 2.4 s and greet 2.6 s. Walk stride is .76 m, reference speed .542857 m/s, stance .72; FrontL/FrontR/HindL/HindR phases are 0/.5/.25/.75. These are authored canine-motion inferences, not canonical animation measurements. The full r10 gait and action set plus narrowly reviewed r11/r12 corrective poses are versioned evidence; `sadaharu-motion-r12/payload-comparison.json` records unchanged mesh surface attributes, rig and clip data versus the r10 predecessor, and the actual pose displacement caused by local skin-weight changes.

## Verification boundary

The focused Node suite loads actual GLBs through GLTFLoader and verifies identity, finite skin/track data, pose continuity, physical socket contact, clone/resource independence, disposal, time policies, real skinned sole clearance and correction stability. Node decodes embedded image bytes with sharp but uses a canvas ownership shim; it does not prove text appearance or GPU pixels. The independent browser studio at `/companion-studio.html` supplies camera/light/action/time/pause/language controls, actual bright/dark backgrounds, PNG saving and WebM recording. Root owns browser rendering and gameplay review.

## Delivered asset measurements

`delivery-metrics.json` identifies the final GLBs and editable-source hashes. Exact decoded idle bounds use +Y up / +Z forward and metres; animated envelopes below are unions of 21 real skinned samples per clip, not an analytic guarantee between samples.

| Asset | GLB bytes | Triangles / bones | Idle size x/y/z | Sampled animated size x/y/z |
|---|---:|---:|---|---|
| Elizabeth `02e4aa775c59` | 2,814,792 | 97,458 / 12 | 1.97403 / 2.99150 / 2.22208 | 3.45836 / 3.30704 / 2.41408 |
| Sadaharu `f55e04dc95af` | 6,218,004 | 87,668 / 34 | 1.61728 / 2.99010 / 3.32534 | 1.85948 / 3.10533 / 3.67732 |

The public directory contains only these two GLBs and the two editable `.blend` sources. Historical accepted/rejected GLBs are retained locally in `archive/models/`; `archive/model-locations.json` maps their original review paths to preserved bytes and hashes. Original reviewed image/source paths remain immutable. The committed accepted static GLB is the identity fixture for tests; the complete rejected iteration archive remains local art history.

The generator runs through background Blender only. Existing evidence directories get a UTC suffix on rerun. Motion construction consumes the immutable accepted static sources in `elizabeth-static-r4/` and `sadaharu-static-r6/`. `capture-dog-review.py` adds missing same-source views without replacing already registered images. `decode-dog-motion.mjs`, `compare-dog-payload.mjs` and `measure-companion-assets.mjs` retain numerical checks separately from art and browser judgments.
