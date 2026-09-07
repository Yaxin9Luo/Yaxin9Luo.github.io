# Verification record

Local verification on 7–8 September 2026. This record distinguishes simulation,
browser behavior, asset inspection and deployment evidence.

## Portfolio and navigation

- All six chapters were opened in the actual browser. English and Chinese
  publications each contain 11 articles; profile, projects, six research
  directions, education/experience and contact links are readable without playing.
- Local portrait, publication figures and CV paths were checked. Offscreen images
  use lazy loading; no completed image reported a failed decode in the sampled
  mobile/Chinese publication view.
- All six map buttons were clicked. The observed destinations were academy
  `(0,11,5)`, library `(-44,10,17)`, workshop `(40,9,40)`, observatory
  `(-48,10,-32)`, ruins `(-29,9,60)`, and owl post `(43,10,-26)`.
  The UI reached `6 / 6`; after a full reload it still displayed `6 / 6`.
- Actual CSS viewports tested include desktop `1280 × 800` and `1024 × 576`, and
  phone-sized `390 × 844`. The Chinese profile and publication view had no document
  horizontal overflow. Mobile chapter tabs scroll horizontally by design. The
  five modal tools stayed inside the dialog. Touch-target sizes were enlarged
  following this inspection.
- Keyboard M opens the map, Escape closes it; Tab stays within the modal focus
  cycle. Background content is inert while reading. The reduced-motion switch
  applies its CSS state and disables the teleport flash.

## Playing the actual browser build

- Clicking visible courtyard ground moved the rider from `(9,8,48)` to about
  `(8.30,8,42.96)`, confirming that movement was actually simulated.
- Keyboard Space and the mobile cast button consume mana. The mobile shield
  button produced the visible protective membrane. Selecting Avada Kedavra and
  casting at an automatically targeted wraith changed the actual quest record to
  `1 / 5` banishments.
- A flight trial displayed the ten-ring course. Flying through the first ring
  changed the UI to `1 / 10`. Opening the map held the timer at `87.1` seconds
  across subsequent observations. Teleporting ended the trial.
- Playtesting found that a trial started after dueling retained combat mode. It
  now clears combat and previous projectiles; the fix is covered by a regression.
- A full ten-ring manual playthrough and simultaneous multi-touch joystick input
  on a physical phone have not been performed. Ring ordering, full-course
  completion, personal-best logic and touch/keyboard release are simulation-tested.

## Automated and geometry checks

`npm --prefix world test`: **34 passing tests**, including:

- bilingual content and local resource contracts;
- malformed/unavailable storage, immutable snapshots, idempotent progress;
- movement normalization, frame-independent damping and swept proximity checks;
- spell cooldown/mana, shields, peaceful exploration, hit/banishment accounting;
- all direct destinations, clearing stale input, trial ordering and best times;
- actual road triangle interiors above the rendered ground, graded gate platforms;
- building collision against the new asset dimensions and a camera obstruction
  regression also checked against the actual castle mesh.

The art integration review reproduced gates floating by up to about 1.6 m,
roads intersecting new terrain, an east-wing rider penetration and an orbit camera
inside the castle. These were corrected. The final road centroid clearance is
roughly 0.009–0.141 m; island crossings now route to the stone bridges. Building
collision uses 103 structural convex bodies rather than outdated circular radii.
It conservatively treats windows and closed doors as solid. Decorative vegetation
and furniture are not player colliders. Per-frame motion is bounded; arbitrary
large teleport segments are not a continuous-physics simulation.

## Asset and visual review

- The owner’s screenshots, supplied Hogwarts Legacy gameplay and official
  Hogwarts Legacy, Baldur’s Gate 3 and Divinity sources informed the art direction.
  The reference image generated with ImageGen is explicitly a target, not a
  screenshot of the implementation.
- Terrain, six buildings, rider, wraith, trees, portal and shield are individually
  viewable in the live asset studio. Architecture also has standalone Blender
  renders and packed `.blend` source scenes. Character front renders were checked
  after correcting inflated sleeves and intersecting clothing.
- The assembled scene was captured from both the welcome camera and broom camera.
  Reviews prompted readable navigation over the sky, a weaker overlay over the
  main castle, shorter foreground trees, natural tree crowns, less glittery water,
  and hiding the racing rings until the optional trial starts.
- Materials have source URLs, license records, physical-scale notes and hashes.
  Thirty-seven PBR/HDR resources were validated and served successfully. Original
  geometry and UV export checks are detailed in the model/character documents.
- These are textured, stylized browser assets. They do not establish parity with
  AAA character scans, cloth simulation, cinematic animation or environment art.
  Cloth motion uses lightweight anchor animation; there is no full skeletal action
  animation set or photorealistic facial system.

## Build and performance

- `npm run build:site` passed, combining Vite and Jekyll with 43 compatibility
  redirects. The original academic content/config/layout/image/PDF directories
  have no diff against the original master revision.
- Independent review checked 133 representative HTTP addresses, all emitted JS
  companion paths, and byte-for-byte correspondence of the public assets with
  their built and served copies. All 70 final public files were rechecked through the delivery server,
  matching source and built files byte-for-byte; the homepage, asset studio, both
  traditional entrances, CV and portrait returned HTTP 200.
- The production dependency audit reported zero known vulnerabilities.
- Observed local rendering during development ranged approximately 39–60 FPS with
  multiple active 3D previews. After closing the extra previews and Blender jobs,
  the academy approach read 75 FPS at 1280 × 800 and Balanced quality. This is a local observation, not a
  60 FPS guarantee or a mobile-device benchmark. GPU draw/triangle counters include
  shadow, reflection and postprocessing passes rather than unique model triangles.
- The optional world loads local textures and roughly 5.17 MB of character GLBs.
  The complete public asset directory also includes large, downloadable Blender
  and architecture exports; those are not all downloaded to enter the world.
  Readable portfolio content initializes before the 3D assets.

## Publication boundary

The feature branch can be reviewed without replacing the public homepage. The
workflow builds PRs but deploys only from master. A production merge, GitHub Pages
configuration change and public deployment have not been performed. Scholar
returned HTTP 429 during research; facts were grounded in the existing site and
linked work, and unverified citation metrics were omitted.
