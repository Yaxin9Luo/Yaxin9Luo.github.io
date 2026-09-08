# Portfolio experience v4 — implementation and validation

2026-09-09. Continues the published resume update at `68830e6`; source branch `codex/world-experience-v4`. The approved scope is the main-task handoff of 2026-09-08. High visual quality remains an explicit user choice; the application does not lower it in response to FPS.

## Delivered implementation

- Portfolio UI and bilingual content initialize before any game import. Opening the profile, projects, papers, CV, or traditional site does not wait for a renderer or world assets. Explicit exploration, travel, or entering an exhibition starts 3D.
- One core attempt has a 20-second total budget including engine import, transfers, parsing and first frame. An early transient resource error can retry once within that budget; 404 and parse failures do not retry automatically. Cancellation aborts fetch/body streams and ignores/disposes stale parse results. Reader focus and content remain intact.
- The core downloads only the full-topology navigation terrain and a compressed, fully rigged wizard with initial texture tier. Buildings, authored gardens, paths, foliage families, scan textures, HDR, signage, and full wizard textures install independently after the first playable frame. Late optional requests settle independently, and a successful later batch clears the loading indicator. Each botanical region gets a fresh optional deadline. Optional failures leave the core playable and skip the affected unavailable tree family. The UI distinguishes pending, complete, and incomplete detail.
- Resource files use content hashes. Detailed diagnostics retain transfer/parse milestones, URL, actual bytes, status/type, attempt, assembly-region timing and first-frame timing; query credentials are removed. Save diagnostics from Settings, including after successful startup. Unknown/encoded content length does not produce a fictitious percentage.
- Exact offline botanical geometry preserves topology, opaque leaves/petals, vertex pigment, bark UVs, wind and shadow hooks; it removes procedural tree construction from interactive loading. It is not mesh simplification. Source factory remains available for authoring. Trees, clothes, architecture and final 4K scan surfaces remain available at high quality.
- One flowing HUD contains prompt, clock, light, broom, combat and touch actions. Short desktop viewports arrange clock and actions side by side so combat controls leave the character visible. The clock shows HH:mm and six periods, uses 240 active seconds/day, and distinguishes fixed time from jump-and-continue. Reading, hidden pages and explicit pause stop time; reduced motion freezes automatic progression.
- L controls a local wand light independently of combat/projectile lumos. The unchanged lumos projectile ID is displayed as Starbolt/星光弹. B safely lands/dismounts or mounts/takes off. Ground motion has authored idle/walk/run/mount/dismount/cast clips; all original eight flight clips and 43-bone rig anchors remain.
- Ground support samples rendered road/walk triangles and authored stepped slabs. Slope, water, edge, headroom and footprint checks prevent invalid landings. New scenery cannot strand a character inside a collider: support is revalidated and recovered nearby, with safe spawn fallback. Cast reservations cancel/refund consistently on interruption. Walking uses a shorter shoulder-height camera that blends through broom transitions while retaining manual orbit and explicit bird/low views.
- Two curated pink/lilac groves have planted branching trees, stone walks, benches, overlooks and warm lights; generic trees leave these groves and castle approaches clear. Original blue-green mountain meshes use layered terrain relief, weathered shoulders, distant conifers and low mist. Increased camera/water coverage avoids distant geometry/reflection clipping.

## Measured assets

See `transmission-report.json` and `botanical-transmission-report.json` for hashes and per-resource measurements. Decimal MB:

| Resource | Delivered bytes / properties |
| --- | --- |
| Core wizard |7,515,560B; same 255,660 triangles, 43 bones and 14 clips; initial 1024px WebP tier |
| Core navigation terrain |7,632,436B; unchanged full topology and metre-space bounds |
| Core geometry/model total |15,147,996B, excluding engine/shell files |
| Full wizard |16,186,484B; original final texture contents retained |
| Active botanical variants |53,080,204B across 14 files; 19 authored/review variants total86,134,732B |
| Mature near blossom tree |351,654 triangles; full blossom/petal geometry is instanced, not replaced by an image plane |
| Botanical packing error |maximum position component 0.075mm; topology and pigment comparisons recorded |

Meshopt + staged WebP were measured and implemented. KTX2 was not implemented or claimed. Initial scan previews use 2048px WebP; full original scan textures replace them later. These changes reduce blocking delivery; they do not claim a smaller final GPU workload.

## Actual validation and limits

- Full Node suite passed 308 tests on the final integrated source, including diagnostic retention, optional-resource settlement, HDR retry, camera transitions, actual-world path traversal and upward-facing surface regressions.
- Full combined Vite/Jekyll build passed with 44 legacy redirects and both traditional languages/CV assets. Raw source is built normally; generated hashed JS is not edited.
- Actual browser: Codex in-app browser on Apple M2 Pro, 16GB RAM. This is not M4, Chrome, Safari or Firefox proof. Default high quality remained selected.
- Local fault service: core body held forever aborted at 19,923.9ms; reading opened during loading remained open after timeout. Core 404 and invalid GLB produced retry/diagnostic fallback without automatic loops. 400kbit/s per-resource/150ms initial-delay service showed the 20-second message and aborted both core bodies after about 12.49seconds of transport, following about 7.5seconds of engine download. This service is not an aggregate Fast3G/Slow4G emulator. No false percentage was shown.
- With every optional runtime resource returning 404, the real core opened, wand light toggled, and the bilingual paper reader opened while the clock paused. Full-detail readiness was not falsely claimed. A failed night HDR can be retried by an explicit time selection; ordinary clock ticks cannot start a retry loop. Temporary fault services are ignored local files, not shipped.
- First slow-network run was invalidated by rebuilding hashed chunks while that page was open; the page was reloaded against the completed build and rerun. No invalid run is used as timing proof.
- A20-second highlands measurement after 3.5seconds warmup, 2560×1440 backing pixels/1024×576 CSS/DPR 2.5/high/LOD/animated, measured 11.58 FPS, frame p95 163.9 ms on this M2 Pro. See the attached JSON; GPU timer results and CPU submission are separate. This is below 60 FPS; no target-device performance claim is made. Small final shading/horizon corrections followed this measurement without lowering quality.
- Final local production-build recovery check used an isolated loopback origin with no-store responses: wizard-core returned one HTTP 503, retried once, and reached the first rendered core frame at 995.1 ms; initial enhancement completion was 16,802.4 ms. The browser/GPU process was already warm from review; these are not GitHub Pages cold-network timings. The exported diagnostics retain both the first completion and later wraith loading/ready transitions. The largest synchronous region block was vegetation at 3,246.5 ms, so detail assembly can still cause a brief input/render stall on this M2. See `docs/evidence/experience-v4/world/local-loading-diagnostics.json`.
- M4 Max and actual Chrome/Safari/Firefox remain unverified. The reported M4 Chrome fetch failure is not attributed to a specific cause without its diagnostics. Use the same live URL/deployment and save loading diagnostics for comparison.

## Art review provenance

`landscape-target.png` is the initial ImageGen concept derived from an earlier actual world frame. `landscape-refinement-target.png` is an ImageGen edit of the actual v4 highlands frame captured 2026-09-08T16:20:40Z. It preserves the academy layout and proposes layered mineral mountains, generous sky/lake and warm night lighting. These images are targets, not screenshots or runtime backgrounds.

Actual review rejected the first tall, fluted mountain wall. The next iteration moved ridges farther away, lowered their relative height, broke up their silhouettes, restored background/reflector coverage, softened repetitive terraces, added sparse ridge conifers, and matched distant water fog with the sky horizon. Near-grove review also exposed downward-facing path triangles; winding was corrected and front-face raycast coverage added. Actual movement then revealed an 8.8 cm path riser being mistaken for a 41.27 degree slope: support now uses the rendered triangle normal. The real-world regression traverses 15.4 m without blocking, and open-ground takeoff uses the same footprint support while retaining water/edge/headroom rejection. An initial ground recording was rejected because foliage hid the camera; a second exposed the blocked path; the final recording includes visible movement, 3.8 m/s running, illumination, mounting, flight, teleport and supported dismounting. Its JSON records positions and states every half second. The sky now follows both main and reflected cameras so changing altitude does not shift its angular horizon. Flower crowns were separately reviewed in studio; petal directions were changed after the first view revealed flat horizontal sprays. Final evidence files contain actual Three.js output. The result is an original stylized WebGL environment; it is not presented as a shipped AAA game's rendering quality.

Character and botanical geometry are authored in-repository. Existing Poly Haven scan/PBR and CC0 audio provenance is preserved in their source manifests. No extracted Hogwarts Legacy/BG3 game assets or commercial soundtrack were added. ImageGen targets are not used as third-party licensing evidence.

The publication includes a final GitHub API snapshot dated 2026-09-09: AutoDesign 197 stars; FigMirror 510 stars. Both editable HTMLs and both two-page PDF exports were refreshed, rendered and inspected again.
