# Action and audio production review

Reviewed 2026-09-08. Scope: `world/src/game.js`, `audio.js`, and `effects.js`. Only the two new test files below and this report were edited; the root agent owns all source fixes.

## Current result

`node --test tests/action-integration-v3.test.js tests/audio-production-v3.test.js` from `world/`: **15 tests passed** after the root agent's four fixes. The immediate background audio regression initially failed (14 passed, 1 failed) and now passes with the new application-state guards.

## Findings and fix review

| Status | Finding | Evidence and reviewed correction |
| --- | --- | --- |
| Fixed and verified | A projectile slot taken by an enemy during the player's charge left a permanent charge halo after refund. | The integration test occupies the shared pool after reservation, advances the shipped cast animation, and checks no player projectile, full refund, no release sound, and hidden charge. `_releaseSpell()` now cancels the effect in its no-slot branch. |
| Fixed and verified | Charge VFX continued rotating and pulsing during pause because their phase came from advancing world time. | Calling the actual effect's `update(0,42,...)` after charging used to change its pose. The effect now advances a local phase from bounded delta; zero delta preserves visible phase and resuming advances it. |
| Fixed and verified | A pending device resume could complete after a background suspension request, leaving application and device state inconsistent. | Deferred resume reproduces the original failure. The new `_syncContextState()` reconciles the latest intent after each completion. Additional tests reverse intent 200 times with both operations deferred: two resume and two suspend operations settle to the latest request, with one context. Completion after disposal schedules no new operation and reconnects no graph. |
| Fixed and verified | A background request did not immediately suppress new action sounds while asynchronous device suspension was pending. | With the context still `running` after `setSuspended(true)`, `play('page')` and `play('boost')` previously allocated 13 new nodes (17 → 30). `play()` now checks the current application `suspended` intent; the regression verifies no new nodes during pending suspension. Root also added the same synchronous guard to `update()`. |

The state reconciliation correction passed the additional rapid-interleaving and disposal checks. The final correction also prevents accepting new work before device state catches up.

## Coverage and evidence boundary

- `world/tests/action-integration-v3.test.js`: eight integration tests. They run actual Game action/effect methods and the shipped wizard GLB's geometry, skin, and animation buffers through the real character loader. Only embedded image/material tables are stripped for Node's missing image decoder. The tests verify reservation, spell identity across selection changes, release exactly once at the animated wand tip, pause/resume, teleport and gameplay-off cancellation/refund, reduced-motion timing, shared-pool exhaustion, and boost sound edges.
- `world/tests/audio-production-v3.test.js`: seven tests. The Web Audio boundary tracks graph connections, source starts/stops, asynchronous state requests, context creation/closure, and music fetches. Repeated unlock/mute/resume retains one context and one scheduled score source per track. Layered sounds free their gain/filter nodes, the 24-voice limit holds, and disposal disconnects all dry/reverb/panner/limiter paths.
- Actual wind sample generation passes at 44.1 and 48 kHz, with 0.9 and 4 second cycles: finite nonzero energy, deterministic output, and a loop-boundary sample step no larger than ordinary adjacent steps within the same cycle.

These checks do not establish audible quality, MP3 decode quality on a real device, browser autoplay policy, GPU rendering, or visual choreography quality. Root owns browser/audio audition and source changes.
