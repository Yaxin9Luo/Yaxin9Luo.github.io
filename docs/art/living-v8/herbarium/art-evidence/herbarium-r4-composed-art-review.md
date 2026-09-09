# Herbarium R4 — composed four-family art review

**Conservatory: PASS. Arcade: PASS. Border: PASS. Water garden: REFINE.** These are independent isolated-asset art judgments from the actual composed R4 frames. The remaining asset work is confined to WAT-01 water optics and WAT-02 lily appearance. Whole-island composition, terrain blending and walking-route verification remain Task 3 and root's final acceptance.

All 17 supplied PNGs were actually viewed at native 1845 × 1440 resolution. Their sidecars report DPR/render ratio 2.5. The frozen asset source is `e61d5d5d41644c9e03e3205ef9125e3dd8c354599377f357233c569e11b9d9d1`; all five archived files match R4 `candidate.json`. The manifest itself hashes to `dae7b3d31263615b7a948ffe2f97d41d90e1710a39b08dd4ab1a0a291a394749`. Full frame/sidecar/source/brief hash inventory: `herbarium-r4-composed-art-review.evidence.json`. Batch attribution is supplied by root; capture sidecars do not embed the implementation hash.

## Conservatory — PASS

**CONS-03 CLOSED.** C4-C/C4-I show actual curled fern fronds, branching woody stems, shaped leaves and small attached pink blooms. These have credible thin silhouettes and texture variation at close range, replacing the rigid broad-leaf construction. Plants enter visible gravel/soil in their pots. Floor specimens, bench specimens and far-side plants create readable near/middle/far layers through the glass. C4-M/C4-P show an airy working conservatory with shelving and visible central floor. The interior view now establishes the room and the relation of plants to their containers, instead of being filled by oversized schematic leaves. No additional species, wider footprint or planting in the central aisle is needed to close this issue.

**CONS-04 CLOSED for the material-read criterion.** The pots now read as aged terracotta, with rims, relief, weathering and visible planting media; the uniform smooth peach pots are gone. The narrower green paint range reads as worn painted metal against the modest brass fittings. Weathering is still conspicuous in the entrance close view, but it no longer requires a separate material correction for this gate. C4-N retains restrained material contrast without a new glaring surface defect.

**CONS-01/02/05 remain CLOSED.** The glass still exposes depth, the rosettes/ferrules remain visibly attached, and the gutter follows the rounded enclosure. No R4 regression in the accepted architectural criteria was observed. This is a visual floor/aisle assessment, not a measured passage or collision certification.

## Arcade — PASS

**ARC-01/02/03 remain CLOSED.** A4-M shows the light four-bay rhythm and real open depth. A4-C retains pale stone, readable voussoir seams and supported arch/capital relationships. The restrained vine is visibly external and connected up the left column into the arch. A4-P shows an open longitudinal route, grounded bases and transverse top members. No additional decoration or architectural revision is requested. Only daylight frames were supplied for the R4 arcade.

## Border — PASS

**BOR-02 CLOSED.** B4-C shows recognizably different fern and flowering-plant forms, thin attached stems, curled/tapering fronds, natural leaf texture and pink blooms. The regular horizontal purple tiers and repeated procedural leaf fans are replaced. Their forms remain legible in the composed bed, rather than only in an isolated source study.

**BOR-01/03 remain CLOSED for the isolated bed.** B4-M/B4-P/B4-C show successive overlapping leafy groups with uneven flowering peaks, roots entering continuous soil and selected stones. The lower canopy is more delicate than R2 but retains continuity without returning to detached example plants. The close view provides the main rooting/morphology evidence; the whole/profile views place the long, low module relatively small in the frame. B4-N shows no obvious night material regression.

The cut soil perimeter is visible in the studio. It must meet the lawn/building/path grade during Task 3; this is the existing integration condition, not a request for another platform, broader bed or more species.

## Water garden — REFINE

**WAT-03/04 remain CLOSED.** W4-M/W4-O preserve the connected shore, clear seating/entry areas, thick pale capstones and recessed pool. The botanical banks now use the reviewed natural foliage; W4-L shows that the roots enter the soil beside the rim. The central/east water remains quiet and the silhouette stays low. These improvements should be preserved.

| Existing issue | R4 judgment | Exact remaining correction and closure target |
|---|---|---|
| WAT-01 — water surface/depth optics | **PARTIAL / REFINE** | The shallow bottom and restrained refraction remain visible, and the submerged stalks are softer than R3. However, W4-C and especially W4-L still contain large offset dark copies of pads and flower forms; vein lines are visible inside some copies. Even W4-O reads paired green/dark discs. Diagnose and reduce the duplicate imagery produced through the water so the surface leaves are primary and underwater detail is secondary. Preserve a mildly visible shallow bottom and quiet surface. Compare the same close, low and overview views after the optics correction. |
| WAT-02 — coherent natural lilies and floating contact | **PARTIAL / REFINE** | Coherent separate pads and their near-surface placement remain improvements. The shared optical duplication still weakens the contact read. In addition, the close view exposes very straight, prominent radial spokes, repeated sharp wedge notches, flat pad faces and an exposed pale/yellow cylindrical flower center/stalk. Against the newly natural bank foliage, this retained lily exemplar looks mechanically drawn. Refine the existing pads with subtler, less regular vein contrast and a softer, slightly cupped irregular edge/notch; refine the existing blossom center/petal attachment so it reads as one flower rather than petals around a cylinder. Keep the existing colonies, sparse blooms and open water. Do not lower all pads to hide an optical artifact. |

The remaining dark imagery must not be described as proven cast shadow. Read-only inspection of the frozen source finds `castShadow=false` for water-family leaf/lime/sage/submerged buckets (`herbarium-assets.js:64`), while the water uses physical transmission 0.965, thickness 0.48 and IOR 1.333 (`:29`). Visible vein detail in the dark copies, together with the disabled pad/vein casting, supports an optical contribution. Pink/ivory/yellow flower parts still retain ordinary shadow casting, so flower shadows may coexist. The exact render-pass contribution has not been isolated by this review; a controlled optics diagnostic belongs to the correction work.

The frozen source places lily centers at Y 0.184–0.190 and the water at Y 0.180 (`:187`, `:220`), with small pad-edge waviness. Those source values support retaining the contact coordinates, but are not a geometric measurement of the rendered edge. The symptom does not justify blind lowering. One water-only follow-up can close both IDs after the duplicate-image and lily-detail defects are visibly resolved. No other family needs a new art cycle unless that work changes it.

## Actual R4 frame inventory

All paths below are under `work/production-v3/captures/`.

| Key | Actual PNG |
|---|---|
| C4-M | `herbarium-conservatory-threequarter-day-1788981192202.png` |
| C4-C | `herbarium-conservatory-close-day-1788981192842.png` |
| C4-I | `herbarium-conservatory-interior-day-1788981193444.png` |
| C4-P | `herbarium-conservatory-profile-day-1788981194092.png` |
| C4-N | `herbarium-conservatory-threequarter-night-1788981194841.png` |
| W4-M | `herbarium-water-threequarter-day-1788981325565.png` |
| W4-O | `herbarium-water-overview-day-1788981326118.png` |
| W4-C | `herbarium-water-close-day-1788981326690.png` |
| W4-L | `herbarium-water-interior-day-1788981327277.png` |
| W4-N | `herbarium-water-threequarter-night-1788981327869.png` |
| B4-M | `herbarium-border-threequarter-day-1788981497435.png` |
| B4-C | `herbarium-border-close-day-1788981497993.png` |
| B4-P | `herbarium-border-profile-day-1788981498558.png` |
| B4-N | `herbarium-border-threequarter-night-1788981499150.png` |
| A4-M | `herbarium-arcade-threequarter-day-1788981545728.png` |
| A4-C | `herbarium-arcade-close-day-1788981546302.png` |
| A4-P | `herbarium-arcade-profile-day-1788981546870.png` |

This review uses native stills, the established targets and the asset art card. It does not claim animation/wind quality, exact collision/clearance, planted-edge integration or whole-island readiness. No production files were edited and no browser or Git mutation was used.
