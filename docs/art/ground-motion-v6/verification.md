# Ground movement and character animation v6

The reported problem was slow movement after landing and unnatural walking and
running. This change keeps the existing world art, clothing geometry and materials.

## Measured cause and timing checks

The previous main loop discarded every part of a frame beyond 50 ms. The
studio animation preview had the same cap. This produced actual slow motion
below 20 FPS; it was independent of the nominal movement speed.

Distances on flat ground through the actual `Game._tick` and movement code,
with only presentation boundaries stubbed, over four seconds:

| Render frequency | Previous walk | Previous run | Updated walk | Updated run |
| --- | ---: | ---: | ---: | ---: |
| 60 FPS | 6.40 | 15.20 | 12.80 | 28.80 |
| 15 FPS | 4.80 | 11.40 | 12.80 | 28.80 |
| 9 FPS | 2.88 | 6.84 | 12.80 | 28.80 |
| 8 FPS | 2.56 | 6.08 | 12.80 | 28.80 |

Distances are world units. These deterministic tests do not assert hardware
rendering performance. Nominal speeds are now 3.2 walking and 7.2 running.
Ordinary elapsed time is consumed in steps no larger than 1/60 second;
long stalls are limited to 250 ms without accumulating a catch-up backlog.

Regressions cover thin-wall collision, diagonal/analog input, paused and resumed
simulation, synchronous UI pauses during a frame, flight, grounded spell release
from the live wand, and projectile time after release. Gait phase comes from
actual displacement, including when collision stops movement.

## Review method

1. Record the old authored ground sequence from the side.
2. Rebuild and inspect exported skeletal actions and ground contact numerically.
3. Repack both initial and full wizard assets, retaining every unrelated runtime
   descriptor and all mesh topology.
4. Review new side/front sequences, refine visible problems, then record movement
   on the actual map and verify transitions, casting and flight.
5. Run the full tests and combined interactive/traditional build before publishing.

The studio uses the runtime's speed and cycle definitions. Recordings interrupted
by hidden tabs, page exits, or a frame stall exceeding the animation budget are
explicitly invalid. A passing recording must include both moving gaits, both broom
transitions, and the ground cast. Independent review caught and closed a case
where a stalled capture could previously have been labeled complete.

Baseline recording: `work/ground-motion-v6/baseline-side.webm`.
Baseline contact sheet: `work/ground-motion-v6/baseline-side-sheet.jpg`.

## First rendered iteration

Both front and side 16-second sequences completed without an animation-budget
stall. Evidence is `work/ground-motion-v6/v1-{front,side}.webm` with walk/run
contact sheets at `v1-{walk,run}-{front,side}.jpg`.

The review found improved relaxed walking arms, heel-to-toe contact, and a
distinct running recovery/flight phase. Hat, mask and clothing remained intact.
It also found that the walking support leg stayed too bent during passing;
measured mid-support knee angles were only 120.5 degrees in walk and 94.7 in
run. A new dense runtime transition check additionally caught brief boot
penetration when changing gaits. These findings require another iteration;
the first bake is not the accepted result.

## Second rendered iteration and regression checks

The final authored walk reaches a 154-degree support-knee angle; running uses
127.81 degrees with distinct recovery and flight phases. Heel-strike compression
is localized instead of making the entire gait crouch. The runtime preserves
heel/toe roll, resamples terrain after releasing an unreachable foot lock, and
blends the grounded limb lengths into the broom transition.

Two new complete 16-second captures are `work/ground-motion-v6/v2-side.webm`
and `v2-front.webm`, with matching walk/run contact sheets. Root and an independent
visual reviewer inspected both views. They show better support-leg extension,
clear walking/running silhouettes, preserved costume and no visible gross joint
deformation. Static pose review does not establish hardware frame rate or fully
prove the map interaction; the map check is recorded separately below.

Exported contact error is at most 2.123 mm and measured stance drift 1.317 mm.
Tests include rapid walk/run/idle changes, moving on positive and negative 12%
slopes, exact broom endpoints, and the maximum animated crown height. The crown
reaches 3.2586 world units; collision headroom is 3.28.

The final model keeps 255,660 triangles. All 36 primitive position and normal
buffers and all 1,032 tracks in the eight pre-existing flight actions are
unchanged; two UV buffers differ only by float roundoff of at most 5.96e-8.
Both wizard runtime derivatives were republished; the other 57 asset descriptors
are unchanged. See `animation-report.json`, `transmission-report.json` and
`runtime-publishing-proof.json` for digests and details.

Verification completed before final map recording:

- `npm --prefix world test`: 354 passed, zero failed.
- `npm run build:site`: passed; interactive root, traditional site, and 44 legacy redirects.
- Combined-build HTTP checks: root, new wizard core, and traditional page return 200.
- Independent timing review: no remaining correctness blocker; studio stalled-capture finding fixed and rechecked.

## Actual map acceptance

The local in-app browser completed the ground route on the full scene at high
quality, 2560 × 1440 backing resolution, native DPR 2.5 and 4x MSAA. Separate
20-second measurement returned 12.824 FPS on this M2 host. This is not an FPS
optimization or an M4 Max measurement; the same visual quality settings were kept.

The complete 24.032-second recording includes landing, walking at 3.2, running at
7.2, turning, stopping, a ground spell, mounting, ascending flight, portal travel,
and a second landing. It ends grounded, has no capture errors and is explicitly
valid. Browser warning/error logs were empty. See `map-measurement.json` and
`map-recording.json`; the review tool retains the existing v5 environment label,
while the character digests in this directory identify the new movement assets.

Root and the independent visual reviewer inspected map walk, run, turn, flight
and landing frames. No obvious new joint deformation, broom displacement or
costume damage was visible. Rear-facing cape, vegetation and the illumination
effect obscure some foot contact in these views; the numerical contact tests and
the unobstructed studio views provide the complementary evidence. The map images
alone do not prove zero sliding or penetration at every possible location.

Local video: `work/ground-motion-v6/map-ground-final.webm`. Extracted map frames
and the two studio iterations remain under the same work directory for comparison.
The build and all checks above were completed against the final source assets
before publication through the existing GitHub Pages workflow.
