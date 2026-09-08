# QA measurement and recording repairs

Completed the scoped QA infrastructure changes without modifying Game, studio, audio, or committing.

## Behavior

- One session owns preparation, warmup, running and finalization. The lock is acquired before awaiting audio. All run/configuration/export controls stay disabled until recorder callbacks and local saving finish. An interrupted audio-loading continuation cannot start a recorder in a newer session.
- Each recorder closes over its own stream, chunks, audio output and MIME type. Start failure, normal completion, spontaneous stop and visibility interruption release that session's tracks and audio connection.
- Measurement uses 3.5 seconds of warmup followed by 20 seconds of sampling. The report records warmup and sample durations. Fixed views, scripted flight and automatic daylight are identified as different workloads. An exhibition whose source image is still unavailable after warmup is marked invalid instead of measured as a settled scene.
- Reports retain the run's build, view, light, quality, foliage and sound conditions, plus `completed`, `invalid`, `reason`, `expectedDurationMs` and `elapsedDurationMs`. Hidden-page interruptions export `invalid: true` and `reason: "page-hidden"`.
- A visible `植被` selector offers `空间 LOD` and `完整几何` in the current world. Full geometry invokes `vegetation.lodController.setEnabled(false)`; selecting LOD invokes `setEnabled(true)`. The selector is locked during a session. The historical world has no controller and is visibly fixed to full geometry.
- PNG, video and JSON evidence names contain build, view, light, quality, foliage, sampling, kind, UTC timestamp and a monotonic suffix. Still-image conditions are captured with the rendered frame, before asynchronous PNG encoding. The server also uses exclusive creation and returns HTTP 409 for an existing evidence name.
- GPU collection continues after CPU sampling stops. Finalization polls availability asynchronously for at most 500 ms; it never waits synchronously for a GPU result. Reports expose issued, collected, pending-at-stop, abandoned, disjoint-event and timeout counts.

## Files

Current sources: `world/src/quality-review.js`, `world/src/review-metrics.js`, `world/review-capture-plugin.js`.

Tests: `world/tests/quality-review.test.js`, `world/tests/review-metrics.test.js`, `world/tests/review-capture-plugin.test.js`.

All six source/test files are synchronized to `work/production-v3/baseline/world`. The baseline HTML retains `data-build="338d112-baseline"`. Its Vite configuration now includes the review entry and explicitly points images to the artifact's root `images` directory. Current evidence remains under `work/production-v3/captures`; baseline evidence remains under `work/production-v3/baseline-captures`.

The parent's leading-slash middleware repair was retained and confirmed by tests and real HTTP requests.

## Verification

- 22 targeted tests pass in the current tree and the same 22 pass in the baseline tree. The lifecycle tests execute the actual review page source with controlled DOM/recorder fixtures, including async audio reentry, stale continuation, delayed final chunks/local saving, interruption JSON, still encoding, start failure, full-geometry control and warmup duration. They are not browser performance measurements.
- Production Vite builds pass for current and baseline, including the review entry.
- Both review pages and their JavaScript return HTTP 200.
- `/images/DViN.png` returns `image/png`; `/images/autodesign.webp` returns `image/webp` on both servers. Response hashes match the artifact root's real image files.
- Real capture POSTs returned HTTP 200 and exact uploaded bytes were verified in each separate output directory. The two files named `qa-smoke-*` explicitly label themselves as transport checks, not performance evidence.

Preview URLs remain running:

- Current: http://127.0.0.1:4195/quality-review.html
- Historical baseline: http://127.0.0.1:4196/quality-review.html

Live Chrome rendering, real browser MediaRecorder codec behavior and the eventual 20-second comparative measurements remain the parent's independent browser verification. No runtime performance conclusion is claimed by these infrastructure tests.

## Sampling diagnosis additions

The QA page and historical baseline now share three additional view values: `castle-footing` (eye [39,16,-8], target [27,9,-24]), `contact-bridge` (eye [59,15,-23], target [52,3,-42]), and `shore-detail` (eye [111,6,16], target [99,-2,2]). The four existing comparison poses and their FOV 43 are retained.

A visible `#sampling` control provides Native / 2x / 2.5x. The default is `native`, which retains the normal quality policy. Explicit 2x and 2.5x set absolute renderer DPR 2 and 2.5 and call `rendering.resize(width, height, dpr)` to update composer and its passes. The override is applied only to the QA Game instance and survives its normal resize calls. Game, production render-quality, and default settings were not edited.

The live readout displays CSS dimensions, backing dimensions and effective DPR. Exported reports contain `sampling`, `canvas.cssWidth/cssHeight`, `canvas.backingWidth/backingHeight`, effective `canvas.dpr` and physical `canvas.nativeDpr`. All evidence filenames include the sampling label; 2.5x is sanitized to `2-5x` in filenames. The sampling control shares the session lock, including preparation and finalization. Tests cover the camera coordinates, renderer/composer synchronization, resize persistence, Native restoration, locked configuration and exported sampling metadata.

For a resolution-only diagnosis, explicitly select **完整几何 / full geometry** and keep camera, light and quality fixed across Native, 2x and 2.5x. LOD selection normally depends on backing pixel size, so leaving LOD enabled can change geometry as well as resolution. At 1024×576 CSS pixels with physical DPR 1.25, the expected backing sizes are Native 1280×720, 2x 2048×1152, and 2.5x 2560×1440. This is an explicit diagnostic control; no visual improvement or production quality decision is claimed before live comparison.

## Static foliage comparison control

The visible `#reduced-motion` checkbox is labelled `静态对照 / reduced motion` and defaults to false. Changing it while idle calls `game.setOption('reducedMotion', checked)`. Its value is included in the session metadata and exported report as `reducedMotion`; live metrics also show the effective option. The control shares the full preparation/running/finalization lock. A VM regression test checks the default false state, explicit true/false application, lock and report snapshot.

The current `environment-wind.js` and baseline `grove-foliage.js` both explicitly set foliage wind time to 0 when reduced motion is true. For repeatable leaf comparisons select full geometry, enable static comparison, and keep view/light/quality fixed while changing Native versus 2.5x sampling. The QA source and tests are now frozen to avoid hot reload during the parent's captures.
