# Character production v3

The rider now has independently cut sleeves, a continuous shoulder seam, thin notched wool lapels, a worsted waistcoat over inset linen, rolled cuffs and a belt fitted to the finished coat. The cape descends from a narrow shoulder attachment into two split panels. Its curved longitudinal folds and layered hem replace the previous broad convex silhouette. The fully covering silver mask and bent felt hat remain; the mask has supported cheek planes and real recessed eye apertures.

Actual Three.js review rejected the v10 rider's muscular waist ridges, padded lapels and plastic-looking collar/chest. The v11 revision bridges the anatomy's chest hollows with a broad cut coat panel, replaces equal horizontal ridges with unequal diagonal gathers, and projects chest layers/stitches onto the finished cloth using its interpolated skin weights. Lapel arch is now 2.5 mm and thickness 3.2 mm. The standing collar's reversed face order was corrected so wool faces outward; its satin lining remains inside a 5.5 mm wall. The scarf fits inside it, with a build-time BVH check rejecting intersections. Integrated v11 close-up acceptance is recorded separately in `work/production-v3/character-report.md`.

The broom has a tapered bent handle, a leather grip underneath the supporting hand, lengthwise carved grain, a stepped brass collar with rivet heads, secondary thread bindings, nine internal bundles and 112 individually curved, tapered birch twigs. The left grip, pelvis and broom remain fixed in the authored flight and one-shot actions. The guardian has thicker porcelain eye apertures, carved face edging, more articulated drapery, sewn panel edges and independently separated front/back trains.

## Surfaces and evidence

The selected hybrid uses retained Poly Haven `poly_wool_herringbone` and `brown_leather` scans. Coat, pressed lapel facings and worsted waistcoat use wool tiles spanning 0.27 m; leather tiles span 0.40 m, matching the provider dimensions. The .82 roughness waistcoat no longer shares the .43 satin lining, and pressed wool facings use .86 roughness. Cloth surface UVs follow measured mesh distance; other garment surfaces use projection in object meters. This is local physical texture scale, not a claim that every seam is a production clothing pattern.

The material variants use identical geometry, lights and cameras. After the v11 geometry was frozen, a final middle trial retained more fiber detail than the earlier smooth hybrid while avoiding the full scan's conspicuous mottling. Rider wool uses normalized scan luminance exponent .50, normal strength .48 and local roughness variation .62. Its pigment has approximately 10.9% relative luminance variation; the guardian retains its earlier 4.8% treatment. Original mean linear pigments remain unchanged. Generated base color pixels are explicitly encoded to sRGB; normal and roughness images remain Non-Color. The existing corrected sheen mapping remains in place.

The render evidence is in `../qa/production-v3/characters/` relative to the project root. `index.html` contains matched before/after, textile/leather comparisons, masks, neutral views and action samples. The Cycles neutral/action frames show fixed v11 geometry before the last wool-detail increase; the selected textile frame uses the final material. The main task supplied actual Three.js garment/back screenshots and a VP9 studio sequence; the production report records independent review of those stills and 16 native boost/cast frames. `rider-motion-review.md` and its probe/frame manifests retain 479 decoded frames across PTS 0.000–15.932 s and the bounded visual findings. This supports gross visible transition continuity, not complete gameplay or GPU-performance acceptance.

## Runtime contract

The eight rider clips are `idle`, `cruise`, `turn_left`, `turn_right`, `boost`, `boost_start`, `boost_end` and `cast`. Flight loops last 4 seconds; one-shot clips start at zero and last exactly 0.20, 0.35 and 0.60 seconds. IK is baked into the GLB.

```js
import {
  updateCharacter,
  requestCharacterCast,
  cancelCharacterCast,
  CHARACTER_ACTION_TIMING,
} from './characters.js';

// Request once per accepted input. Repeated requests restart and increment sequence.
const request = requestCharacterCast(rider);
// { accepted, releaseDelay: 0.18, duration: 0.60, sequence }

// The caller owns world movement. Boost input reacts before speed has risen.
const event = updateCharacter(rider, {
  dt, speed, turn, vertical, boost: boostIntent, paused, reducedMotion,
});
if (event.castReleased) releaseReservedSpell(event.castSequence);

// Teleport/gameplay disable cancels; pause preserves the pending cast.
cancelCharacterCast(rider);
```

`CHARACTER_ACTION_TIMING` is `{ boostStart: 0.20, boostEnd: 0.35, cast: 0.60, castRelease: 0.18 }`. The update result contains `castReleased`, `castSequence` and `castActive`. Cast events come from the same elapsed time used to sample the action, so a frame crossing the release threshold emits exactly one event. The caller should reserve mana/cooldown at request acceptance and release the projectile from this event; a separate wall-clock timeout would not honor pause.

Boost start/end are interruptible on the latest intent. Cast has pose priority while the boost transition clock continues. Blend weights remain normalized; finished transient contributions are retired below 0.1%. The cape follows sampled world orientation with progressively slower response along its chain, including delayed response to torso/group turns.

Zero `dt`, invalid `dt` and `paused: true` freeze pose, cloth, blend state and event time. Reduced motion holds a selected idle pose while retaining gameplay release timing. A cast leaving reduced motion resumes at its current elapsed time. The helper caps a positive step at 0.10 seconds, matching its existing simulation contract. It does not own document visibility, input capture or game movement; the caller must pass pause or stop advancing while backgrounded.

## Reproduction and provenance

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/art/build-characters.py -- --material-ab
```

The default material is `hybrid`. `--material=authored` and `--material=scans` produce explicit alternatives. `--only=wizard` or `--only=wraith` rebuilds one actor. `--views=front,side,back,garment,face,cast` selects render views. `--preview` lowers render resolution/samples only; it does not simplify mesh geometry. `--no-render` skips neutral renders.

Outputs are `world/public/models/characters/{wizard,wraith}.glb`, editable packed `source/{wizard,wraith}-academy-rig.blend`, `manifest.json`, and `source/sources.json`. The provenance record includes the builder SHA-256, source blend byte counts/hashes, consumed texture hashes, physical scales, author/provider/license records and action timing. Original topology remains derived from the retained CC0 Blender Studio body; source head/eyes and archived hair are not exported. Supplied ArtStation links are design references, with no copied proprietary models or textures.

The dedicated suite now has 19 Three.js tests against the shipped mesh, skin and action data. Node omits the material/image table only from its geometry-only loader response; separate binary GLB/PNG checks verify materials, color encoding, textures, source hashes and export metadata. Tests cover clip durations, stable support contacts, complete mask/hat, independent garment meshes, cape extent, upper-back clearance via raycasts in four poses, chest layer vertex/triangle-centroid clearance in five poses, finite deformation and loop seams, interruption/return, cast repeat/cancel/release, pause, reduced motion, orientation lag and normalized effective weights. The current test result and refreshed artifact evidence are recorded in the production report.

The build is reproducible from retained source inputs and fixed seeds. GLB/Blend hashes identify the delivered files; byte identity across different Blender releases or exporter versions is not promised. Actual GPU performance and integrated browser motion are separate verification gates.
