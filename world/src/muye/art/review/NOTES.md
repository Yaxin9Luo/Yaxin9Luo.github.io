# Muye art module: review notes (2026-11-19)

`world/src/muye/art/`: the entry `index.js`, `ground/`, `sprites/`, the preview page and this folder. `puppets/` and `fx/` belong to other sessions; both were on disk when this was finished and both load.

- Preview: `http://localhost:5173/src/muye/art/preview.html` (options in a comment at the top of `preview.html`). It runs the real rules (`../sim.js`) with spawning off; `?fake=1` runs a scripted fake of the same shape, and the page falls back to it by itself if the rules fail to load.
- This folder is kept under 10 MB: only the stills to be judged. `node gen/shoot.mjs dawn fallback fake` shoots the three that were removed (dawn, the fallback puppets, the scripted fake game); all three were looked at and worked.
- Stills and measurements again: `node gen/shoot.mjs` from `art/` (needs the dev server on 5173; it never starts one). Rebuild the ground art: `node ground/gen/ground.gen.mjs` (85 s).

## Update, 18:15: the hero at density (tester S-1.3), and a regression fixed

**Measured with the tester's own tool** (`lab/game-studies/testing/tools-survivors/density.py`: greyscale, 8 px blur, the hero's 96 x 120 box ranked among about 839 boxes by contrast with the 50 px round it). Stills from the preview, real rules, 120 / 200 / 300 foes sent, three seeds each, before and after run back to back on the same rules. `node gen/saliency.mjs <out dir> ["pocket=0&boss=0"]` does it again. `pocket=0` is the state before.

| Foes sent (in view) | Before: rank, top % | After: rank, top % | Hero against his surroundings, before -> after |
|---|---|---|---|
| 120 (65, 81, 96) | 196, 406, 457 = 23%, 48%, 55% | 4, 9, 18 = 0.5%, 1.1%, 2.1% | -0.07, -0.03, +0.02 -> -0.24, -0.22, -0.22 |
| 200 (102, 141, 121) | 500, 351, 218 = 60%, 42%, 26% | 24, 23, 72 = 2.9%, 2.7%, **8.6%** | -0.02, -0.05, +0.08 -> -0.20, -0.20, -0.14 |
| 300 (196, 218, 182) | 646, 534, 641 = 77%, 64%, 76% | 31, 48, 61 = 3.7%, **5.7%**, **7.3%** | -0.01, -0.02, 0.00 -> -0.18, -0.18, -0.16 |

- **Target (top 5% in every dense still) is met in 6 of 9 stills; the other three are at 5.7%, 7.3% and 8.6%.** (Run again at 19:40 on the rules of that hour, with the hit edge below in place; the first run at 18:15 gave 0.5% to 9.5%.) Not met in full.
- **With a named foe's slam on screen it is not met at all**: 14% to 57% (before: 14% to 75%), `hero-after-with-named-foe.json`. Its warning is three cinnabar rings and a fill about 900 px wide, drawn by `art/fx`; in grey that is the darkest large thing on the screen and it lies under the hero. This needs the fx session (thinner rings, no fill under the hero's pocket), not the world drawing.
- "In colour": the tool measures grey only. By eye in `hero-after-*.jpg` the hero is found at once; I have no number for colour.
- Zhou squads as the second read: the tool's `alliesMinusRingMedian` is -0.07 to -0.10 before and after, about the same as the foes' (-0.08 to -0.12). **In grey the squads are not a second read by this measure**; in colour they are (azurite discs, and the puppets session's ranks are now gold).
- Stills: `hero-before-120/200/300.jpg`, `hero-after-120/200/300.jpg` (seed 3) and the grey 8 px blur of each. Numbers: `hero-before.json`, `hero-after.json`.

What was changed, all in the world drawing (`index.js`, `sprites/sprites.js`), nothing in the UI:
1. **A pocket of paper round the hero.** Mass foes whose feet are within about 150 x 135 px of him are drawn at 22% of their strength (55% in their warning or blow), rising to full at 1.4 times that; their hurt flash is thinned with them. Elites and named foes are never thinned. The paper patch on the ground under him is wider.
2. **A pool of ink under him** (66 x 35 px, far darker than any other shadow). This is what the measure responds to most: softening it from 0.95 to 0.93 strength with a softer rim took the 300-foe stills from about 8% to about 23%. **It looks heavy**: a black blot under a white horse. It is the honest price of this measure with a pale hero; see "decision" below.
3. **His own men do not stand over him**: allies just in front of him are drawn behind him.
4. **The mass is cut duller and darker** (saturation x 0.4, value x 0.78, at load, mass kinds only): its gold is no longer the loudest colour, and no longer the pickups' gold (S-1.9).
- Not done: a taller banner (the puppet is not mine); muting by distance from the hero (would need a second atlas).
- **Decision for the lead**: the measure rewards a dark box on pale surroundings, and the hero is a white horse whose own retinue darkens the 50 px round him. Getting the last three stills under 5% means a still blacker pool or thinning his own squads. I stopped here. The other way is to give the hero a dark element of his own (a dark saddle cloth or caparison in the puppet), which would let the pool be a normal shadow again.

**Regression found and fixed while measuring.** `art/puppets` grew from 13 kinds to 34 (1,133 frames) and the pipeline cut all of them at load: sprite resolution fell to **0.52** (everything soft) and the cut took **4.3 s**. Now only the hero and the six everyday foes are cut at load; troops, generals and named foes are cut the first time they are drawn, each in its own sheet (a troop's new tier replaces its old one). Resolution is 1.0 again, the cut at load takes 0.2 s, and a first sight costs 27 to 63 ms once (measured over 6 kinds). A foe or ally kind with no puppet borrows the captain's or the spearman's, so nothing is invisible. Allies use `zhou:<sim id>` when the puppets have it, with the highest tier not above the troop's level.

Cost now (headless, 1440 x 900, 300 foes, 40 allies, fx on, load average about 20): art 1.03 ms mean, p95 1.4 ms; four draws a frame hold 16.67 ms. Sprites 28.6 MB at dpr 1 after six kinds were cut on sight. At dpr 2 the resolution is 1.06 (the cap; same open decision as before).

The battle stills that were here (`foes-120*`, `foes-300*`) were from before this change and are deleted; the `hero-*` stills replace them. The rules changed three times during this work (new named foes, a new formation), so numbers from different hours do not compare; only the before and after above were run together.

## Update, 23:40: after the lead's look at two full runs

The lead overruled the saliency number ("stop chasing it; keep what you did"). Five things from his look:

1. **Dusk (mine, fixed).** The paper no longer turns peach or orange. From 0.62 of the run it goes a little warmer and greyer; in the last tenth it dims to a warm grey. The far ground (the top of the view) is cooled and darkened by a veil that fades out two thirds of the way down (one stretched 1 x 256 strip, multiplied). Paper on screen: 0.5 `(239,231,214)`, 0.8 `(232,223,206)`, 0.92 `(227,217,200)`, 1.0 `(206,196,179)`. Stills of one battle at four times: `day-0.50.jpg`, `evening-0.80.jpg`, `evening-0.92.jpg`, `evening-1.00.jpg`. No long shadows were added.
2. **White cut-outs of whole figures (mine, fixed).** It was the hit flash: a paper-white copy of the figure at 0.9 strength for 0.15 s on every hit, and chained hits kept allies, chariots and Wen Zhong white. There is now no flash on any figure and no white sheet is made at all. A hit is the effects' mark; the hero keeps his cinnabar edge. A general who is `away` is not drawn (no dry-brush fade was made for leaving or returning).
3. **Flat blue ellipses under Zhou units (mine, fixed).** They were my mark for the warband. Now an ordinary soft shadow with one thin azurite ring of ink round it, in two pulls that do not meet. `roster-a.jpg`, `roster-b.jpg`.
4. **Rectangular patches of streaks (not found in my files; I believe the effects').** Nothing in the world drawing paints streaks in a box: props and ground patches are painted to nothing at their edges, and my dry wash is used only under the hero and is an ellipse. The same boxes are in my own stills from 18:13, before that wash existed, under a chest and on bare ground. I did not prove it by running with `?fx=0`; that would settle it.
5. **Battle-spirit drops (the effects').** With `art/fx` loaded it draws the pickups; mine (gold flame drops from `marks.webp`) are drawn only when fx is absent. In my stills tonight the drops are already smaller than in the lead's.

**Not the same moments.** The lead asked for stills of the same moments (`C-50`, `C-61`, `C-65`, `C-70`, `C-76`, `D-46`). Those came from the tester's rider on the game page; I did not re-run it. Mine are preview stills of comparable scenes. The game page was loaded and played after the changes with no errors.

**Sprite memory budget raised from 40 to 64 MB, on my own decision; say if it must go back.** The hero is now 13.5% larger and his standard taller (the figures session delivered it), so his sheet alone is 23.6 MB at dpr 1, and with four squads, three generals and two named foes the sheets came to 48 MB. Under 40 MB that meant either soft figures or sheets being dropped and cut again.

## Update, 21:30: wiring of the new figures, stronger means for the hero, and the measure itself

**Wiring (the two gaps the figures session reported, and the rest of section 6).** Checked in the preview on the real rules with all eight troops (ranks 1, 2 and 3 on screen), six generals (three plain, three in true form), the four Mo brothers, the marten and Wen Zhong (`roster-a.jpg`, `roster-b.jpg`): `art.standIns` stayed empty, so nothing borrowed another's figure.
- A soldier's sheet is chosen by HIS `rank`; a general's by `general` and `trueForm`; a foe's by `kind` (the figures' `keyOf` rule, written out so it allocates nothing per unit).
- States: `skill` plays `PUPPETS[key].skill.state` for a squad and `skill` for a general; Wen Zhong's charge plays `rush`, and `windup2` while a `goldWall` zone is live (the rules give the foe no pattern id, so the zone is read); the Zhou chariots play `charge` and `wreck`; units in `away` or `under` are not drawn.
- Several variants of a kind now live side by side (men at different ranks, a general and his true form); before, a second variant replaced the first and they would have been cut again every frame. Sheets are dropped only when the 40 MB budget is passed, longest unused first. A rank that stands on its own cloud (`noShadow`) gets no disc.
- `art.standIns` lists any kind that had to borrow a figure: empty when the wiring is whole.
- Not wired: `zhou:standard` (the squad's standard-bearer). The rules have no such unit, so nothing asks for it. Not checked: ranks 4 and 5 on screen, a general's `skill` frames and Wen Zhong's `rush` in a still (the states are chosen by code I did not watch play).
- Cost of a first sight: 27 to 150 ms once a kind (Wen Zhong is the largest). With four squads, three generals and two named foes at once the sheets reach 37 to 43 MB.

**Stronger means for the hero** (the lead's list):
- The hero and Jiliang are 13.5% larger (1.34 on the figures' size, was 1.18).
- The ordinary mass is cut in two flat dark tones, no gold, green or bone at all (lacquer, and one dull tone). Elites and named foes keep their colour; Zhou squads keep theirs.
- The wash of bare paper on the ground under him is a third wider and stronger. Foes are solid everywhere.
- The taller standard with a longer streamer is the figures session's puppet; I asked that session for it (no reply read yet). **Not done.**

**The tester's number, again not moved.** Same tool, three seeds, no named foe, before (`?pocket=0`) and after run within minutes of each other:

| Foes sent (in view) | Before, top % | After, top % |
|---|---|---|
| 120 (66, 81, 96) | 22, 33, 51 | 40, 60, 23 |
| 200 (102, 141, 121) | 53, 39, 27 | 57, 71, 11 |
| 300 (196, 218, 182) | 87, 71, 61 | 57, 57, 73 |

Top 5% in 0 of 9 stills. The tool's colour figure (share of the most saturated 0.5% of pixels that lie on the hero) is 18 to 30% after, 20 to 37% before: lower, because the squads' own colour now carries more of the saturation.

**Is the measure misleading here? Yes, for this picture, and `measure-top25.jpg` shows it.** It is the 300-foe still with the 25 boxes the measure ranks first drawn in blue and the hero's box in green.
- 23 of the 25 are dark clumps of foes (mean grey about 0.33 against 0.58 round them); one is a patch of bare paper inside a crowd. The measure ranks "a box darker or lighter than its surroundings", and a dense dark mass on pale paper is exactly that. With 200 foes there are always dozens of such boxes.
- The hero ranks 480 of 839 with a difference of +0.04: his box holds a pale horse's legs, his dark trappings, and three of his own shield men, which average to the same grey (0.62) as the mixed ground and figures round him (0.58). A figure made of light and dark parts scores near zero whatever its size, colour or shape.
- The box is 96 x 120 px; the hero with his standard is about 270 x 330 px. The measure looks at his horse's legs.
- So it rewards the two things the lead rejected (clearing the ground round him of foes, near-black under him) and is blind to the things that do make him the first read: size, the only long cinnabar shapes, the tallest silhouette, a pale body among dark ones.
- What I would measure instead: rank by size-weighted colour and silhouette, for example the hero's share of the screen's saturated cinnabar and paper-white area, or a search test (a person or a vision model asked to point at the hero in a blurred still, timed). I have not built either.
- By my eye in `hero-after-120/200/300.jpg` he is found at once at all three densities. That is a judgement, to be set against the lead's own look.

**Cost** (headless, 1440 x 900, 300 foes, 40 allies, fx on), measured before the last change to the memory share: art 1.46 ms mean, p95 2.4 ms; four draws a frame hold 16.67 ms. That run had sprites at resolution 0.885, because the larger hero pushed the load-time cut over its share of the budget; the share is now 82% and the game page reports resolution 1.0 at 30.4 MB. Not re-benched after that.

## Update, 20:20: the lead's correction (this replaces what the two updates below say about the pocket and the pool)

The lead judged two parts of the 18:15 change wrong, and they are removed:
- **Foes near the hero are no longer thinned.** Every foe is drawn at full strength.
- **The near-black pool under the hero is gone.** His shadow is a dry ink wash with a broken edge (a faint wet middle and dry pulls that stop short), mid ink, about the horse's footprint (58 x 12 px).
- The paper veil that was drawn over the figures behind him is gone too: paper is washed on the ground layer only.

What stays: the wash of bare paper on the ground under and just round him; he is drawn in front of whatever touches him from the front; his own men are not drawn over him; the mass is cut flat and dull everywhere (now saturation x 0.3, value x 0.72); the cinnabar hit edge; the sprite cuts on first sight.

**The tester's number with these means is not improved.** Same tool, same rules, three seeds, no named foe, run back to back (`hero-before.json`, `hero-after.json`; "before" is `?pocket=0`):

| Foes sent (in view) | Before, top % | After, top % | Hero against his surroundings, after |
|---|---|---|---|
| 120 (66, 81, 96) | 19, 40, 54 | 35, 66, 29 | -0.04, +0.01, +0.06 |
| 200 (102, 141, 121) | 53, 31, 18 | 68, 65, 8 | +0.02, -0.02, +0.16 |
| 300 (196, 217, 182) | 73, 76, 72 | 76, 65, 61 | +0.01, +0.02, +0.02 |

- **Target (top 5%) is met in 0 of 9 stills.** At the hero's real size on screen (`--hero=200x230`) it is the same: ranks 3 to 133 of 154 after, 2 to 111 before.
- Why: the measure is the mean grey of his box against the 50 px round it. A white horse among his own squad and the mass has the same mean grey as his surroundings (about 0.58 against 0.58), so the difference is about zero whatever is done to the mass. The 18:15 version reached 0.5% to 8.6% only by clearing the foes round him and putting near-black under him, the two things now removed. Drawing him in front of everything within 96 units was tried and changed nothing.
- What would move the number without those two: a dark element on the hero himself (a dark caparison or saddle cloth in his puppet), or effects kept off him. In `hero-after-200.jpg` the sash and the spear's stroke are drawn across the horse; that is `art/fx`'s to thin.
- By eye in colour he is found at once in `hero-after-120/200/300.jpg` (the largest pale figure, the only long cinnabar). That is my judgement, not a measurement.
- Stills: `hero-before-*.jpg`, `hero-after-*.jpg` and the grey 8 px blur of each (seed 3).

## Update, 19:45: the hero's hit flash, the camera kick, the page

- **The hero is never flashed white.** A hit shows as a cinnabar edge: his silhouette in cinnabar, 7% larger, drawn behind him, fading over 0.16 s, begun at most once every 0.34 s (so about three a second however fast the hits chain). His body is not covered. `hero-hit-edge.jpg` (a forced hit in the preview). Foes and allies keep the short paper-white flash, thinned inside the hero's pocket.
- **`art.kick()`** returns `fx.kick()`, or `[0, 0]` without `art/fx`. Checked in the preview: it answers a non-zero pair after a cast.
- **The game page** (`muye-next.html`): loaded, a run started and ridden for 10 s, no page errors, sprites at resolution 1.0, 20.4 MB. Foes drawn grey and translucent near the hero are the pocket (change 1 above), not a fault: only mass foes within about 150 x 135 px of him, never elites.
- Not checked: the hit edge on the game page under real chained hits (only forced in the preview); the kick as the page applies it.

## What is here

| File | What |
|---|---|
| `foes-120.png`, `-blur`, `-grey` | 120 foes sent (95 alive at the still), 14 allies, five treasures, a chariot, a captain, two shamans |
| `foes-300.png`, `-blur`, `-grey` | 300 foes sent (243 alive), 40 allies |
| `camp.png`, `wood.png`, `village.png`, `altar.png`, `ford.png` | the five landmarks, the hero riding past with six men |
| `field.png` | the whole middle of the field at zoom 0.26: river, wood, camp, village, altar in one view |
| `dusk.png` | `setTime(1)` |
| `bench.json`, `stills.json` | the numbers below |

## The contract, as built

`loadArt({onProgress, puppets, fx, budgetMB, dpr, seed})` returns `setView`, `setTime`, `drawGround(ctx, cam)`, `drawWorld(ctx, cam, game, alpha, dt)`, `drawOver(ctx, cam, dt)`, `onEvent(event, game)`, and also `paperAt(k)`, `reset()`, `stats`, `landmarks`. The camera's point is at (width / 2, height x 0.52), as in `dev-stub-art.js`. `onProgress(done, total)` counts 14 image loads and then the sprite cut.

Seams:
- `art/puppets/index.js` is used when it exports `PUPPETS` and `createCutter`. If the file is missing or throws, `sprites/fallback.js` supplies the same two exports from the side-view game's puppets. Keys used: `hero`, `shang:<foe kind>`, `zhou:shield|spear|archer|strongman`. Troop level picks the tier (1, 3, 5). The hero's variant is `game.build.resonance.slice(0, 3).join('+')`.
- `art/fx/index.js` is used when it exports `loadFx`. Without it there are no effects and the module draws the warnings, pickups and treasure shots itself.
- **Who draws what when fx is loaded** (it was not in the brief, so I chose): fx draws all of `game.zones` (the danger lanes and rings included), the pickups, and the `pearls` and `ring` shots, because it already does and two drawings of the same warning were on screen together. This module draws those only when fx is absent (from `ground/baked/marks.webp`). Arrows, the shaman's orb and any other shot are always drawn here. If the lead wants pickups sorted among the figures instead, pass `loadFx({pickups: false})` in `index.js` and remove the `if (!fx)` before the pickups loop.
- fx reads the game it was last handed through `onEvent`; `drawWorld` hands it the game once (`{type: 'game'}`) so zones show before the first real event.

State to frame: `walk`/`charge` use the walk by distance travelled (leader's `charge` uses `attack2`), `windup` uses `windup` (boss with `act === 'aim'` uses `windup2`; the shaman alternates `chant`), `attack`, `stun` uses `hurt`, `dead` plays the death frames and fades by 0.62 s, chariot uses `run` and `wreck`. Hero: `fall`, `dash` (spring), `idle` (stand), otherwise the gallop or the full cry by `fullCry`. `flash > 0` lays the figure's paper-white frame over it.

## Readability: what was done and how it reads

1. **Hero.** Largest figure (1.18 on top of the puppets' own size). Drawn as if 46 units nearer than he is, so foes that touch him from the front no longer cover him. A soft patch of paper is laid on the ground under him before the time-of-day tone, and a second breath of paper is laid behind him just before he is drawn, so whatever stands behind him is veiled. A darker, wider contact shadow.
2. **Warband.** 1.36 on top of the puppets' size (they were smaller than the Shang mass) and each man on a hard-edged azurite disc.
3. **Mass foes.** The puppets session's simplified puppets are used as they are. The derived version (fill in lacquer black, keep one piece in colour) lives in `sprites/fallback.js`.
4. **Danger.** Cinnabar on the ground is only the lanes and rings (fx's when loaded, mine otherwise). Scenery cloth is the greyed red.
5. **Scenery in front of the hero** is drawn at a third of its strength.

Honest reading of the proofs:
- `foes-120-blur.png`: first the cinnabar ring of the captain's slam (correct: it is under the hero at that moment), then the hero as a pale and red mass in it, then the Shang clumps as dark shapes, then the blue of the warband. The warband is second only where it stands together; scattered men are still easy to miss.
- `foes-300-blur.png`: the Shang are dark masses with a clear edge. The hero is the red and pale place in the middle. The row of shields under him reads as a blue band: a clear second.
- `foes-300-grey.png`: the hero is found by being the one large pale figure. The Shang carry most of the picture's weight by area, so "hero first" holds for the centre of the screen, not for the whole picture. The warband in grey is "the pale ones with a grey foot": readable, weaker than in colour because the disc's mark is hue.
- Not solved here: foes still stand on top of one another and on the hero, because the rules let them touch. A separation radius in the rules would do more for reading than any art.

## Ground

- 6000 x 6000, nothing tiled. One river painted across the whole field (eight image tiles), with a ford. 19 patches and 21 standing props laid by seed in cells of 620: about nine cells in ten hold a patch, six small bits a cell, props singly and in groves; tents, stakes, banner and wreck never within sight of their like; nothing random within 470 of a landmark.
- Landmarks (world x, y): ford (3015, 3212), ruined camp (1500, 1650), pine wood (4550, 1500), burnt village (1350, 4500), altar (4650, 4550). Exported as `art.landmarks`.
- Standing scenery is drawn 1.5 times the size it was painted for (boulders 1.15), and was baked again at 2.25 so it stays sharp. Props are sorted with the figures.
- `setTime(k)`: the ground is painted in day colour; two full-screen fills follow it (the paper's tone multiplied, the ink's temperature screened). Figures are not tinted. `paperAt(k)` gives the paper colour for the page.

## Sprite pipeline

- 250 frames cut at load from the puppets, trimmed to what was painted and packed: one atlas for everything but the hero (1984 x 2057), one sheet for the hero (1792 x 1815). A flash sheet at a third of the size. One `drawImage` a unit, two in the instant it is hurt; mirrored by facing.
- Memory is estimated first and the frame resolution is lowered to fit the budget (40 MB); if the result is still over, it is cut again.

## Measurements

Headless Chrome, 1440 x 900, real rules, 300 foes kept topped up, 40 allies, five treasures, fx on. Load average of the machine was about 62. `art` is script time of the three calls.

| Run | art mean | median | p95 | ground / world / over | frame gap |
|---|---|---|---|---|---|
| dpr 1 | 1.11 ms | 1.10 | 2.10 | 0.47 / 0.61 / 0.03 | 16.67 ms |
| dpr 1, art drawn 4 times a frame | 1.15 ms (first of the four) | 1.00 | 2.20 | | 16.67 ms |
| dpr 2 | 1.15 ms | 1.00 | 2.40 | 0.46 / 0.65 / 0.05 | 16.67 ms |
| dpr 1, 120 foes | 0.87 ms | 0.80 | 1.70 | | 16.67 ms |
| dpr 1, fx off | 0.99 ms | 0.90 | 1.40 | 0.34 / 0.65 / 0.00 | 16.67 ms |

- Budget was 4 ms. Drawing the art four times a frame still holds 60 frames a second, so the canvas work behind the script is not hiding a cost.
- Sprites: 31.1 MB at dpr 1 (resolution 1.0), cut in 0.44 to 0.6 s. At dpr 2: 37.5 MB at resolution 1.1, cut in 1.2 s. **So on a 2x screen the figures are not sharp**: the 40 MB cap allows only 1.1x. The hero is 11 MB of the 25 MB of frames (36 frames of about 290 px); leader 2.7, chariot 2.2, captain 1.5.
- A new resonance cuts the hero again: 106 ms once, 13.8 MB, replacing the old sheet.
- The fallback puppets cut in 4.0 s (two bakes a kind). Only used if `art/puppets/` fails.
- Images: 1,111,712 bytes in `ground/baked/` (budget 1.5 MB): props 328 KB, ground 271 KB, river 274 KB, marks 210 KB, grain 26 KB.
- Whole load of the preview (images, puppets, fx, sprites): 0.7 to 1.5 s.
- Not measured: a real 2x display, a machine without a GPU, the game's own page (`muye-next.html`), memory as the browser reports it (the MB above are pixels x 4).

## Weak, and what I would do next

- Sharpness at dpr 2 (above). Either raise the cap to about 70 MB, or cut the hero's gallop and full cry from 12 frames to 8, or cut the mass at full density and only the large figures lower. This is a decision for the lead.
- The 106 ms hitch when the resonance changes. It could be cut over a few frames.
- The ground under a battle is nearly bare paper, and the open field between landmarks is thin. Correct for reading; plain as a painting.
- The ford is found by the tracks that run into the water, not by the water itself looking shallow.
- Boulders are pale and soft at this size; they are the weakest prop.
- At dusk the whole ground goes one flat orange (`dusk.png`). It is the side-view scene's dusk paper and is strong for a field with nothing else on it.
- The hero's veil of paper is a soft oval; over a dense mass at dusk it can be seen as an oval.
- fx's pickups lie under the figures (drawn with the ground), so a pile of foes hides them. Mine sort with the figures but have no halo. One of the two should be chosen.
- Not looked at: other window shapes and zooms than 1440 x 900 at zoom 1 (and 0.26 for the overview), the hero's fall, the leader's charge, tiers 3 and 5 of the warband in a still.
