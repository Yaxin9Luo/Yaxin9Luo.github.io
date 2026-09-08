# Academy experience v2: visual and interaction verification

The earlier integrated v2 preview was rejected for flat materials, coarse foliage and reduced clarity. This revision keeps the bilingual portfolio and its traditional site while replacing the offending assets and render settings. The screenshots referenced here are real Three.js output, not generated target images.

## Geometry and surfaces

| Part | Final authored detail |
| --- | --- |
| Masked broom rider | 210,652 triangles, 43 bones, five blended flight actions; bent felt hat, silver full-face mask, tailored coat, glove fingers, rolled cuffs and garment hems |
| Archive guardian | 28,692 triangles, 27 bones, three actions |
| Silver broadleaf | 74,016 triangles with individually folded leaves and continuous root collar |
| Pine | 78,280 triangles, including 17,380 needles |
| Cherry | 76,010 triangles with separate flower petals |
| Courtyard | 636,442 triangles; curved masonry, basin, planted borders and an interactive armillary |
| Reading garden | 232,252 triangles; bound and open books, fine page lines, hollow teacup, saucer, shelves and planted beds |
| Terrain | 0.5 m surface sampling, replacing 1.1 m; 32 cliff bands replacing eight; shared vertices and smooth normals |

The geometry is combined or instanced by material where appropriate. Tree roots connect to their trunks. Low planting and mossy rocks soften courtyard boundaries while leaving roads and viewing lanes open. Meadow flowers use actual curved petals and stems, and grass clumps have 18 articulated blades rather than the earlier seven.

Source stone, slate, wood, metal and ground colour/normal/roughness maps are restored at physical scales. See [material-refinement-v2.md](material-refinement-v2.md) and [environment-art-v2.md](environment-art-v2.md). Model exports, Blender sources, byte counts and provenance accompany the assets. Garden GLBs are independently inspectable source exports; the website builds the same garden geometry and does not download those large review GLBs during play.

## Corrections discovered by actual rendering

- **Fabric appearing like polished leather:** Blender 5.1's glTF sheen extension exported full white rather than tint multiplied by weight. The export normalization now carries the authored weight. Geometry, actions and texture payloads were unchanged by that correction.
- **Fabric remaining too dark:** generated sRGB image pixels had received linear palette values. A Blender emission-plane comparison reproduced the mismatch independently of lighting: coat RGB8 was approximately `(13,27,45)` instead of `(64,91,116)`. The generator now explicitly encodes pigment to sRGB. The final GLB pigment decodes to linear `(0.052005,0.105132,0.175079)`, matching the source `(0.052,0.105,0.175)`. Normal and roughness images remain non-colour data. Character geometry, skinning and actions retain their previous binary data.
- **Square highlights across the lake:** filtered 512-pixel wave normals alone did not remove the artifact. A subsequent runtime comparison identified enlarged star pixels in the 512-pixel reflection. The reflection now uses 2048 pixels with mipmaps, and stars have a circular feathered shape. The same overview before and after shows the square pattern disappearing.
- **Clarity changing during use:** quality no longer follows a hidden frame-rate adjustment. High retains native density subject to the explicit 8.5-megapixel/2.5 DPR cap, 4× MSAA and 4096-pixel shadows. A resolution media query also updates the canvas when native DPR changes without a CSS resize; it is rebound and disposed correctly.
- **Unnecessary render-target work:** geometry is antialiased once in an HDR scene target. Post-processing works on the resolved single-sample image. AO and its depth rendering remain enabled in high quality. See [render-cost-review-v2.md](render-cost-review-v2.md).
- **Light briefly coming from below ground:** the automatic day/night blend now uses a smooth lighting-only horizon guard. Actual sun and moon positions, manual palettes and transition timing remain separate. Dense full-cycle tests check direction, velocity continuity and preset preservation.

## Portfolio behavior

The direct bilingual navigation, CV and contact remain available without gameplay. Physical books, the experience board, correspondence folder and observatory props open relevant content. Clicking the actual courtyard armillary was checked in the browser: day changed to dusk and the settings control reflected that state. Day/night can also be selected directly or run as a fourteen-minute cycle.

The atelier shows actual, attributed project media. It has independent media/project navigation, enlargement and a full reader. Current browser checks followed AutoDesign to its second image, opened the reader and switched language while retaining the same project and image. Earlier integration checks covered all six AutoDesign images, missing-media handling, single-step return, keyboard flight, altitude, portals, mobile portrait reading and optional gameplay. These earlier checks are not a physical-device performance claim.

Music is opt-in and locally served with CC0 attribution, separate music/effect volume, background suspension and reading ducking. A prior browser check decoded the supplied MP3 files and reported ready/muted states; this is not a claim of subjective audio audition.

## Evidence and limits

The local review directory is `../qa/academy-v2/`. Screenshots include matched 1024 × 576 CSS day/night overviews with a 2560 × 1440 canvas, close reading props, the masked rider and the actual exhibition. Independent visual review confirmed restored materials, clearer paths and removal of the square lake artifact. Formal rectangular garden layouts remain a stylistic characteristic; this revision is not described as equivalent to a commercial AAA environment.

On the shared desktop, the settings display showed about 21–24 FPS at 2560 × 1440 with high quality and 4× MSAA. A manual light-quality check showed about 52 FPS at 1280 × 720 with SMAA, then high quality was restored. These are observed snapshots, not an isolated benchmark or a promise of 60 FPS. Native mobile GPU and cross-monitor hardware performance were not measured. Static screenshots alone cannot establish temporal stability.

The final complete bundle passed **127 tests**, `npm run build:site`, **133 HTTP availability/size checks**, **19 GLB structure/triangle/byte validations**, and eight additional asset-provenance hashes. `git diff --check` is clean. [Verification record](evidence/quality-v2/verification.json).

Actual WebGL evidence:

- [Night overview with corrected reflections](evidence/quality-v2/refine-overview-night-water2048.png) and [matching day view](evidence/quality-v2/refine-overview-day-pass3.png).
- [Final rider: front](evidence/quality-v2/refine-rider-v9-front-web.png) and [boost side view](evidence/quality-v2/refine-rider-v9-boost-web.png), after the colour correction. Studio controls now occupy separate space outside the canvas.
- [Reading desk and surrounding material detail](evidence/quality-v2/refine-reading-desk-detail-web.png).

Exhibition framing is computed from the actual title/screen/workbench bounds and visible header/toolbar rectangles, retaining the original perspective and smooth camera motion. Projection regressions cover 1024×576, 756×771, 390×844 and 844×390, overlay wrapping, hidden controls and restoration. These mathematical checks are distinct from actual device testing.

The final integrated browser check at 756×771 CSS measured a 110-pixel header and 159.4-pixel toolbar. The [actual fitted exhibition](evidence/quality-v2/refine-exhibition-framing-final.png) now shows the title, screen and complete desk between them. [Final rider in the main scene](evidence/quality-v2/refine-final-flight-web.png) confirms the corrected garment material is also used outside the studio. No browser warnings or errors were reported in these checks.
