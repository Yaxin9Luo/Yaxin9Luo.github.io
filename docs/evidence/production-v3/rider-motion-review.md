# Rider motion review · actual Three.js capture

Bounded independent review found no obvious pose pop, detached support contact or garment penetration in the examined boost-start and cast frames. This review did not change the asset, runtime or studio, and did not start Blender or GPU rendering.

## Source and actual timing

Source: `work/production-v3/captures/studio-rider-neutral-shadows-on-front-sequence-solid-animated-record-complete-20260908T122515925Z-4.webm` in the academy project. Root produced this recording in the real Three.js studio. The source contact sheet `rider-action-contact-sheet.png` was also inspected, but the transition assessment uses native extracted frames.

- SHA-256: `94e691829e7c3a2db249d0101e677dda7cfb3a12401739caaa8993c16ae2df82`.
- 4,327,096 bytes; VP9; native resolution **1985 × 777**.
- **479 decoded video frames and 479 video packets**.
- First packet PTS **0.000 s**; last packet PTS **15.932 s**; measured packet span **15.932 s**.
- Packet timestamps increase monotonically. Inter-packet spacing: minimum **13 ms**, median **34 ms**, maximum **60 ms**. There is no gap above 100 ms.
- The derived cadence is approximately **30.0 encoded frames/s** across that PTS span. This is recording cadence, not a measurement of the renderer's GPU frame rate.
- The WebM header omits duration, and packets omit their display durations; the last frame's exact display end is therefore unspecified. `r_frame_rate=1000/1` and `avg_frame_rate=0/0` are metadata values, not evidence of 1000 FPS. Do not label this file as exactly 16.000 seconds from the header.

`rider-motion-probe.json` retains full ffprobe packet/stream/container output; `rider-motion-timing.json` retains its summary. The probe used `-threads 1 -count_frames -count_packets -show_streams -show_format -show_packets` on the original file. Extraction used FFmpeg software decode (`-hwaccel none -threads 1`), frame-index selection and `-fps_mode vfr`. The PNGs preserve native dimensions without cropping, resizing or retouching. `rider-motion-frames.json` records every frame index, actual PTS and PNG hash.

## Visible transitions

The studio sequence starts idle at 0 s, cruise at 2 s, boost at 4 s, cruise again at 8 s, idle plus a cast request at 10 s, then left turn at 12 s. This schedule was checked in the existing studio code without editing it. These are intended state times; the table below gives the actual nearest captured frame timestamps.

**Boost start, 3.931–4.367 s:** the head and torso progressively dip forward through 4.140–4.244 s and settle into the lean. The supporting left hand, pelvis, legs and broom remain stable. Sleeves and chest panels maintain a coherent silhouette. No gross garment penetration, limb dislocation or whole-pose jump is visible in these six frames. Scarf and coat-tail outlines shift gradually.

**Cast, 9.931–10.728 s:** the right hand (image left) lifts and folds inward by 10.098 s, passes through an intermediate pose at 10.139 s, extends through 10.162–10.245 s, then retracts by 10.373 s and settles by 10.567–10.728 s. Five consecutive decoded frames, indices 303–307, were inspected across the fast windup-to-extension transition; their actual PTS are 10.098, 10.139, 10.162, 10.193 and 10.245 s. This shows an intermediate arm/wand progression rather than an obvious single-frame pose snap. The supporting hand and seated contact remain stable, and no obvious sleeve collapse or chest-layer burst is visible.

The recording visually establishes a cast near 10 s. It does not establish exact gameplay projectile release timing; the runtime/GLB tests cover the exported 0.18 s release contract separately.

## Native frames inspected

All 16 PNGs below were individually opened at original image detail.

| Phase | Decoded frame index (zero-based) | Actual PTS | Native PNG |
| --- | ---: | ---: | --- |
| boost | 118 | 3.931 s | [rider-boost-03.931s.png](motion-frames/rider-boost-03.931s.png) |
| boost | 120 | 4.007 s | [rider-boost-04.007s.png](motion-frames/rider-boost-04.007s.png) |
| boost | 122 | 4.066 s | [rider-boost-04.066s.png](motion-frames/rider-boost-04.066s.png) |
| boost | 124 | 4.140 s | [rider-boost-04.140s.png](motion-frames/rider-boost-04.140s.png) |
| boost | 127 | 4.244 s | [rider-boost-04.244s.png](motion-frames/rider-boost-04.244s.png) |
| boost | 131 | 4.367 s | [rider-boost-04.367s.png](motion-frames/rider-boost-04.367s.png) |
| cast | 298 | 9.931 s | [rider-cast-09.931s.png](motion-frames/rider-cast-09.931s.png) |
| cast | 301 | 10.026 s | [rider-cast-10.026s.png](motion-frames/rider-cast-10.026s.png) |
| cast | 303 | 10.098 s | [rider-cast-10.098s.png](motion-frames/rider-cast-10.098s.png) |
| cast | 304 | 10.139 s | [rider-cast-10.139s.png](motion-frames/rider-cast-10.139s.png) |
| cast | 305 | 10.162 s | [rider-cast-10.162s.png](motion-frames/rider-cast-10.162s.png) |
| cast | 306 | 10.193 s | [rider-cast-10.193s.png](motion-frames/rider-cast-10.193s.png) |
| cast | 307 | 10.245 s | [rider-cast-10.245s.png](motion-frames/rider-cast-10.245s.png) |
| cast | 311 | 10.373 s | [rider-cast-10.373s.png](motion-frames/rider-cast-10.373s.png) |
| cast | 317 | 10.567 s | [rider-cast-10.567s.png](motion-frames/rider-cast-10.567s.png) |
| cast | 322 | 10.728 s | [rider-cast-10.728s.png](motion-frames/rider-cast-10.728s.png) |

## Scope of the conclusion

The front camera leaves the rider relatively small and conceals much of the rear cape. This evidence supports gross pose continuity and visible support/garment stability at the sampled moments; it does not resolve subpixel self-intersections, every cloth surface, continuous rear-cape clearance or all action combinations. The existing sampled deformed-mesh clearance tests remain separate evidence. The three actual Three.js garment/back stills are the material/tailoring evidence. Integrated gameplay behavior and native-device GPU performance remain the main task's checks.

No new asset change is warranted by this bounded review. The locked rider remains `40f3112ed006a08fe33fed49de9e512dff634d28e2c35039ab1d554c24f0c514`, cache key `academy-tailored-v11-cut-panels-20260908c`. All character Blender/GPU work had exited at **2026-09-08 12:21:47.849 UTC**; this follow-up only ran brief single-threaded software media checks and documentation edits.
