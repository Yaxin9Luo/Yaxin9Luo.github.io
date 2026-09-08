# World HUD, active time and wand illumination

Implementation scope: `ui.js`, HUD CSS, `time-contract.js`, `environment-time.js`, `illumination.js` and focused tests. Game/world lifecycle, lighting registration, input dispatch and browser acceptance belong to the root integration. Loading coordinator, main bridge, character assets and resumes were preserved.

## HUD and time selection

The interaction prompt, world clock, exploration actions, combat HUD and touch controls now share one `.world-hud` flow. The old prompt/HUD bottom offsets are overridden within this container. Portrait uses a column; touch landscape places the stick and movement controls beside that column. The container accounts for the bottom safe area and permits scrolling when an unusually short viewport cannot fit all controls. Narrow layouts use the HUD map button instead of a floating minimap over the controls.

The world clock shows HH:mm, a named period and auto/fixed/paused status. Text refreshes at most four times per second, except an explicit state/language change, and only changed text is written. It has `aria-live="off"`. Wand-light and broom buttons remain available outside optional gameplay; they are disabled while reading/paused or during incompatible movement transitions. Button actions use the existing event delegation rather than held pointer controls.

The settings selector explicitly labels fixed periods. A separate six-button group jumps to a period and continues the day. The physical astronomical clock's prompt also says that time will continue. Old `timeOfDay` preferences keep their meaning; no existing fixed setting is silently converted to auto.

`time-contract.js` has no engine imports. The static portfolio UI imports this lightweight contract, so adding the clock does not pull Three into the shell before world intent.

## Time API

```js
// Re-exported from environment-time.js for existing Game imports.
TIME_PERIODS // dawn, day, noon, dusk, night, midnight
TIME_MODES   // auto plus those six fixed presets
TIME_PHASES  // .265, .46, .5, .735, .86, 0
normalizeTimeMode(value)
formatClockTime(phase)
periodForPhase(phase)

clock.setMode(mode, immediate = false)
clock.jumpTo(period, immediate = false)
clock.update(activeDt, { paused = false, reducedMotion = false } = {})
clock.getSnapshot({ started = true, paused = false,
  pauseReason = null, reducedMotion = false } = {})
```

Default and invalid-duration fallback are both 240 active seconds. `update` accepts all finite, nonnegative active elapsed time; it never applies the movement safety clamp. Pause and reduced motion freeze natural time and in-progress manual transitions. A deliberate setting change while paused/reduced-motion should call setMode/jumpTo with `immediate=true`.

jumpTo uses the existing shortest phase transition over 2.4 seconds and includes the active time spent in that transition. Fixed modes do not advance. Noon and midnight have small distinct palette changes, while the previous dawn/day/dusk/night exact palettes and continuous protected key-light direction remain intact.

Snapshot fields: existing `{mode,phase,label,night}` plus `{period,clockText,durationSeconds,clockState,pauseReason,transitioning}`. `clockState` is auto/fixed/paused; mode retains the stored enum. Hours, rather than palette interpolation endpoints, determine the visible period. Afternoon is therefore `day`; the Game astronomical-clock action should choose the next chronological TIME_PHASES anchor in auto mode rather than assume `period` uniquely identifies its position in the preset list.

Root integration must supply elapsed active seconds before motion clamping, gate intro/reading/hidden/exhibition/reduced-motion time, and reset its active baseline across lifecycle changes. This pure clock cannot infer whether a large supplied delta was an active slow frame or time spent away.

## Wand light API and budget

```js
const illumination = createWandIllumination();
effects.add(illumination.group);
illumination.setEnabled(enabled, { immediate: reducedMotion });
illumination.update(motionDt, wandWorldPosition, {
  paused, reducedMotion, visible: started && !exhibition
});
illumination.getState(); // { enabled, available, intensity }
illumination.dispose();
```

One PointLight, intensity 18, distance 14 metres, decay 2; no shadow map. A tiny sphere marks the actual source. Fade duration is 0.28 seconds. The module neither reads world phase nor changes mana, cooldown, selected spell, pending projectile release or audio. It must be positioned from the animated wand tip after character pose update in the same frame. An invalid/unavailable anchor never emits from the origin.

Once anchored, the light stays in the graph at zero intensity when off, avoiding a change to every material's light-count shader variant when L toggles. Its little mesh is hidden when off. Initialize the wand pose/anchor before the first shader warmup to include this stable light slot. Pause freezes the fade; hiding preserves enabled intent. Disposal removes and frees only this module's own geometry/material and is idempotent.

Keep it out of the environment night-light registry, which multiplies lights by the night factor. Root `Game.toggleIllumination()` owns input availability, L one-shot handling and state publication. Publish `snapshot.illumination` with `available=started&&!paused`. `Game.toggleBroom()` and B own movement transitions; UI reads a locomotion mode string or `{mode}` and labels grounded as summon, flight as safe landing, transitions as busy. Existing lumos projectile ID/index/audio stay unchanged; its display-name adjustment is owned by root's shared location-data change.

The unshadowed light does not guarantee wall occlusion. Root's near-wall, day/night, grounded/flying screenshots must establish actual illumination and check light leaks/glare. No browser visual pass or frame-time cost is claimed by these unit tests.

## Verification performed

`node --test world/tests/environment-time.test.js world/tests/time-contract.test.js world/tests/illumination.test.js world/tests/ui.test.js`: 34 passed, 0 failed. The final UI/illumination adjustment was also rerun as a 22-test subset, all passed. `node --check` on the edited JS entry points and scoped `git diff --check` passed.

Coverage includes 240-second cycles at 60/17/5 FPS and uneven active deltas; pause, fixed and jump-and-continue semantics; exact legacy palettes and C1 direction continuity; time preferences and midnight formatting; common HUD markup; rate-limited clock updates; gameplay-independent controls and reading guards; real PointLight identity, wand pose, fades, invalid anchors and one-time resource disposal. DOM fixtures do not establish pixel layout.

Before implementation, the resource-loader deadline fix was rechecked read-only. Forward/reverse subscription deadlines passed. A delayed-timer result-admission gap was reproduced and reported to root. Root then added the consumer's own deadline check before resolving; the same reproduction now resolves the long consumer and rejects the expired short consumer with timeout. That resource file/test remained root-owned throughout.

Browser acceptance still required: EN/ZH, gameplay off/on, desktop/portrait/landscape, zoom and safe area; measured visible HUD rectangles; reader/modal focus; actual near-ground/wall light; and unchanged render-quality settings during comparison.
