# Generated mass: trial (2026-11-25)

Three mass kinds made through figures-key's generated pipeline, cut to the code puppets' joints and driven by the code
pose tables, then the same crowd drawn twice. Still: `../review/gencmp-campaign.webp` (page `../review/gencmp.html`,
`PAGE=gencmp.html node gen/shoot-campaign.mjs gencmp`).

## Files (mine; nothing of figures-key's was edited)
- Prompts: `lab/game-studies/imagegen/prompts/mass-*.txt` (anchor + frame + slot, as STYLE.md fixes; edits `mass-spear3-edit.txt`, `mass-spear5b-edit.txt`).
- Images: `lab/game-studies/imagegen/raw/mass-{ge,archer,spear}-1.png`, `mass-spear-3.png`, `mass-spear-5.png` (+ `.prompt.txt`); `mass-spear-5-drift.png` is the rejected first rank 5.
- Rigs: `lab/game-studies/imagegen/rigs/mass-*.json`, cut by their unchanged `cut.py`.
- My tools: `lab/game-studies/imagegen/mass/whiten.py` (Shang 尚白: pale yellow hide pulled to bone in the atlas),
  `mass/refit.py` (moves a rig onto a rank edit by the body's silhouette: a starting point only).
- Atlases + loader here: `mass-*.webp/.json`, `genmass.js`.

## How a generated kind is posed by the code tables
Parts: t (torso, far arm left on it), h, au (near upper arm, copied over the sleeve: `cut: none`), al (forearm + fist), w (weapon in
the fist), lu ll ku kl. A joint's angle = the table's angle minus the table's angle in the pose the picture is in (REF = the
table's base, legs in the drawn stride). The weapon, a world angle in the tables, turns by its world change less the chain
above it. So walk, windup, strike, hurt and the three-frame fall come from the existing tables with no new animation work.
Archer: one picture has no drawn bow, so windup and strike raise the bow arm and keep the bow upright.

## Cost of one kind (measured)
- Images: 1 for the base; +1 per rank made as an edit. API time per image 75 to 120 s when it goes through; the endpoint
  answered 500 or 429 (rate limit) on about a third of calls, so wall time per image was 2 to 6 min with retries.
- Hand work: one rig per picture, about 10 to 15 min reading a 50 px grid (head, near arm, weapon, four leg pieces, two feet).
  A rank edit redraws the pose a little (legs moved, the figure a few % larger), so the rig has to be redone; `refit.py`
  gets the body and head right and the limbs wrong.
- Atlas: 7 to 8.3 KB WebP per figure (9 parts, about 120 to 160 px tall, 0.11 to 0.13 atlas px per source px, i.e. about
  2x game size). The shipped game cuts frames from it like any puppet, so drawing 300 costs the same as 300 code figures
  (one cached frame each).

## Ranks as edits of one base
- Rank 3 from rank 1 (edit, base image only): same man, same costume logic, armour added, hand kept. Good.
- Rank 5 from rank 3 (edit, base only): the hand drifted (shaded, painterly gilt, torso turned) — rejected. Redone with the
  frame text and the two style references attached beside the rank-3 picture.
- Rule: every rank is an edit of the rank-1 base (or of rank 3) WITH the references attached, never a chain of bare edits.

## Weak, open
- Shang "white" comes back as yellow hide; `whiten.py` fixes it in the atlas. Better: say "bone white, not yellow" in the slot.
- Generated mass is a little smaller than the code mass at the same scale setting; one number per kind.
- The far arm does not swing (it is on the torso); the near upper arm is a copy over the sleeve, so a big arm turn shows two sleeves.
- Not checked: seams at 3x in every frame.

## Round 2 (same day): the user's brief — splendid, a world of gods and demons
- Frame: `lab/game-studies/imagegen/STYLE.md` section 9 (`prompts/mass-frame.txt`, `mass-shang-kit.txt`, `mass-zhou-kit.txt`, on figures-key's `frame-foot.txt`).
- Redone: 戈兵 `mass2-ge-1`, 弓手 `mass2-archer-1`, 长矛手 `mass2-spear-1b` (rank 1, an edit making the first rank-1 plainer so the ladder reads), `mass2-spear-3`, `mass2-spear-5`.
  Overview for the user: `lab/game-studies/imagegen/review/mass-overview-v2.webp` (large + game size); crowd: `../review/crowdgen-campaign.webp`.
- These are what `genmass.js` now serves for `shang:spear`, `shang:archer`, `zhou:spears` (ranks 2 and 4 show rank 1 and 3 until made).
- Rigging is automatic for every foot picture of the new pose (`mass/autorig.py`): a line fitted to the haft (it may lean), the grip,
  the elbow, the neck at the throat's dip, each leg traced up from its foot. The archer's curved bow has no haft: rigged without a weapon part.
- Cost, measured: 6 pictures, 70 to 283 s each (the endpoint returns 500 on about one call in three; retried after 40 s); no hand rig;
  atlases 60 KB for the six (8 to 14 KB a picture). Projected roster: about 80 pictures (≈35 Shang kinds and elites, 9 Zhou squads x 5) ≈ 1 MB of atlases.
- Waiting: the lead's and the user's verdict on the overview before the rest of the roster is generated (`mass/kinds.py` still holds the
  first brief's slots and must be rewritten to section 9 first). The 14 bases of the first brief were stopped after one (斧兵, unused).
