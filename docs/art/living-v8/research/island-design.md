# Living Academy v8 — island composition research

Design recommendation, 2026-09-09. This is a proposal, not an implementation or a visual acceptance report. Ownership: island design research only. No product files or Git state were changed.

## Verdict

Build **the Academy Herbarium Courts** on the existing main island: a small family of garden rooms connected by the current walks, with two short arcaded wings at the academy approach, one low botanical conservatory to the east, a sheltered library water garden to the west, and a deliberately open arrival meadow to the south. The castle remains the primary skyline; the conservatory supplies a second, much lower silhouette; tree masses and planted banks join these buildings to the ground.

The present footprint is sufficient. Expanding the island would increase the amount of ground to compose before it fixes the current problem. A new satellite island is an optional later destination, not a v8 prerequisite.

## Evidence from this build

Inspected the supplied native screenshot `截屏2026-09-09 23.35.14.png`, and the relevant authoring files: `world/src/environment-composition.js`, `environment-layout.js`, `landform-layout.js`, and `locations.js`. After the integrator installed the existing dependencies and requested a bounded material/grade check, also inspected the terrain sampling and ground-material sections in `world.js` and `landscape.js`.

The screenshot's dominant issue is the large, uniformly exposed grass field between separate rectangular destination pads. The pavilion, fountain square, library forecourt, and atelier platform have individual details, but their edges do not create a convincing shared place. Planting is most legible near the shore; much of the interior has the same short, regularly patterned grass. The castle is large enough to supply a strong focal point, while almost no intermediate architectural scale connects its base to the garden.

The scene already has useful assets and authoring structure: six graded destination gardens, authored blossom parks and flower drifts, protected curved routes, castle footings, scanned stone, two bridge channels, and a continuous island landform. Keep these. Add explicit garden-room edges and entrances, rather than another evenly distributed decoration pass.

The code contract places the castle at `(0, -38)`, the central court at `(0, 35)`, the library at `(-70, 7)`, the atelier at `(64, 37)`, and the arrival at `(18, 74)` in **x/z** coordinates. Castle-facing north is negative z. The central court is graded to y = 6; library terrace y = 7; atelier y = 6; castle y = 9. Existing access curves and portal coordinates take precedence over all proposed placements.

After the integrator installed the existing dependencies, sampled actual `academyPathCurves` at 800 subdivisions per curve and evaluated `renderedTerrainHeight` across the candidate footprints on a 0.5-unit grid. The refined anchors below have verified positive distance from the authored road envelopes and supported terrain. They are **not full existing-building, plant-crown, rendered-road, or collider clearance results**. Those checks remain part of assembly.

### Ground repetition: bounded diagnosis

The current `groundMaterial` directly samples meadow colour at `terrainPosition.xz / 2.5`; humus, moss, normal and roughness channels also use that fixed spatial repeat. There is no deperiodising texture sample in that material. `plantingMaterialMap` stores the opening mask in alpha, but the ground colour/roughness logic does not use that channel. Openings therefore reduce plant density while retaining the same meadow surface treatment. In addition, `createVegetation` excludes tall trees from a broad ellipse centred near `(6, 49)` with radii `(32, 42)`, keeping much of the middle field exposed.

These are concrete mechanisms consistent with the screenshot's mild checker/repeated-dot appearance and weak large-scale ground differentiation. They do not prove the exact share caused by texture, vegetation or lighting; a matched native A/B view must settle that.

Bounded material recommendation: retain the high-detail PBR maps, deperiodise their colour/normal/roughness samples consistently, and use authored district/opening masks to distinguish a connected mown lawn, shaded humus, flower-bed soil and worn stone margins. If rotating tangent-space normal samples, handle their orientation consistently. Broad ground variation should follow the garden design; do not merely tint every tile or add uniform noise. Trim selected parts of the canopy-exclusion mask only after protecting the actual castle and portal sightlines. New buildings placed on the unchanged repeating lawn do not satisfy this design.

## Five primary references, and what to take from them

All references were researched live. The design translations are my proposals, not claims that the original authors prescribed these coordinates or proportions. No source images, models, or textures were copied into the product.

| Reference and provenance | Supported observation | Transfer into this island |
|---|---|---|
| [Sissinghurst Castle Garden — National Trust](https://www.nationaltrust.org.uk/visit/kent/sissinghurst-castle-garden/the-garden-at-sissinghurst-castle-garden), garden steward | The garden combines distinct rooms and formal structure with abundant planting. The White Garden uses white, green, grey, and silver, finding variety in form and texture. | Make three related rooms with different dominant plant forms. Use ivory/silver around the academy and cooler violet at the water garden. Keep broad, dark foliage masses behind light flowers; do not make every region equally multicoloured. |
| [The Gardens of The Cloisters — The Met](https://www.metmuseum.org/de/press-releases/the-gardens-of-the-cloisters-2006-news), museum documentation, 2006 | Cloister passages connect major and domestic spaces; the gardens support conversation and rest. Cuxa combines columns, water, lawns and borders. Bonnefont retains a distant river view and groups herbs by use. | Borrow low architectural enclosure, sheltered benches and purposeful planting. Use two open wings rather than a full four-sided enclosure, preserving routes and castle views. Give the new conservatory an obvious botanical purpose. |
| [Temperate House — Royal Botanic Gardens, Kew](https://www.kew.org/kew-gardens/whats-in-the-gardens/temperate-house), institution responsible for the building and collection | The glasshouse houses botanical collections and presents the architecture together with living plants. | Make a small, original conservatory whose planted interior is visible. Its structure, benches, vents, and planted bays must form a coherent building, not an empty glass shell. The scale and footprint proposed below are original. |
| [The Witness: Designing Video Game Environments — Fletcher Studio](https://www.fletcher.studio/blog/2017/5/26/the-witness-designing-video-game-environments), first-person landscape design breakdown, David Fletcher, 2017 | The studio designed coherent geographical and cultural contexts; composed key views at thresholds; and softened biome boundaries with overlapping dominant species. Gameplay and intended circulation constrained spaces. | Review the court, library approach, and atelier approach as composed views. Carry one or two species across adjoining rooms. Build around navigation and portfolio destinations, with each added structure serving a garden use. |
| [Claude Monet, Water-Lilies, NG6343 — National Gallery](https://www.nationalgallery.org.uk/paintings/claude-monet-water-lilies), collection interpretation | The painting uses broad water colour and lily forms toward its edges, leaving visual space in the centre; related works use foliage as compositional anchors. | Give the pool a broad quiet centre, planted margins, and one framing tree. Borrow the organisation of colour and empty space, without reproducing a painting or replacing the retained Chinese mineral-painted mountain background. |

One additional artist's breakdown was inspected during source discovery, but its page contained unrelated injected advertising text. It is unnecessary to the recommendation and is excluded from the reference set. Two full-size Fletcher image requests and a separate Kew history-page request timed out; source claims above rely on successfully retrieved institutional/project text, not unviewed images.

## Three coherent directions

| Direction | Composition | Benefit | Tradeoff |
|---|---|---|---|
| **A. Academy Herbarium Courts — recommended** | Arcaded approach; east conservatory; west water garden; framed southern meadow. Shared limestone, dark slate, aged green metal, ivory and muted violet planting. | Directly repairs the vacant centre; makes the island feel maintained and inhabited; gives three useful ground-level experiences without moving destinations. | Needs a well-made arcade and conservatory. Weak geometry would make the additions look like more placeholders. |
| **B. Terraced Water Academy** | Extend the existing southern/eastern coves into two more deliberate inhabited shelves, with retaining walls, small stairs, reflecting basins, and an overlook pavilion. | Strong diagonal landform and vertical depth in aerial views; beautiful water relationships. | Requires more terrain, collision, and support work; shoreline quality is already sensitive. It can leave the interior vacant and dilute attention from the castle if done first. |
| **C. Orchard Scholars' Village** | Cluster two or three modest academic outbuildings around orchard courts: reading room, potting shed, small workshop annex. Narrow garden lanes join the current landmarks. | Strong signs of everyday use and varied roof silhouettes; can feel like a lived-in campus. | More architecture and circulation to author; greater risk of visual congestion or competing with the portfolio landmarks. It addresses habitation more strongly than graceful garden space. |

Choose A as one whole composition. Borrow only B's low garden level changes and C's potting/reading details. Do not combine all their buildings and terrain changes.

## Proposed world-space composition

Coordinates are x/z in current world units. Heights stated as “above grade” must be fitted to actual ground; they are not absolute world y. Dimensions are authoring envelopes, not permission to overlap the existing road, door, exhibit, or tree footprints.

| District | Proposed extent or anchors | Spatial job and visible form | Protected opening |
|---|---|---|---|
| **Academy approach** | West arcade centre `(-22.4, 4)`, east `(22.4, 4)`; each about `3.4 × 12`; upper roof about `5.4` above grade | Two short four-bay wings place dark arch openings against warm stone. Low planting follows the outer sides; inner sides stay open. Their ends are distinct entry thresholds, not parts of an island-wide fence. Fit the northern ends to the castle forecourt without burying its footing. | Preserve the entire central approach around x = 0, including the about portal and its sign. Nothing crosses the axis. Do not join the wings with a front wall or roof. |
| **Fountain court** | Existing `x = -18…18, z = 10…52` | Keep fountain, broad paving and route junctions. Join isolated planting beds visually with two unequal banks outside the western and eastern court edges. A small number of larger foliage masses should make the fountain feel sheltered. | All current route exits. Keep fountain water and the castle entrance visible from the southern court edge. |
| **East herbarium** | Conservatory centre `(55, 18)`, about `16 × 9`, long axis east/west, roof no more than `9` above grade | One low, finely framed glasshouse. Its west end faces the court; tall interior plants sit nearer the north/east sides; a potting bench and planted sill provide scale. Short garden spur connects its west door to the existing eastern route. Reposition overlapping grove individuals into edge clusters. | Atelier at `(64, 37)`, its front portal and exhibit views; the contact road remains open west of the proposed conservatory. No greenhouse roof may hide the atelier's defining roof from its approach. |
| **West library water garden** | Basin centre `(-44, 47)`, about `16 × 9` including margin; water surface about `12 × 6` | An elongated, slightly irregular stone-lined pool with one clear water centre, unequal lily groups, reeds at two margins, and a single small reading seat. One tree mass near the northwest margin connects it to the library/cherry walk. A short spur leads toward the existing library route. | Leave the library forecourt, the publication route north of the basin, and the journey route east of it clear. Do not put the pool across a current path. |
| **Arrival meadow** | Core near `(8, 68)`, about `24 × 16`; retain a clear region around the arrival `(18, 74)` | A real resting lawn with a quiet interior. Its edges receive unequal tree/shrub groups and two low stone seat segments, each a few metres long. Flower masses belong in the edge shade; the centre stays visibly open. This gives the southern foreground an intentional shape. | Clear approach to the fountain and view toward the castle. Keep tree trunks, furniture and dense planting out of the arrival body/camera envelope. |
| **Outer garden seams** | Existing library, cherry/lilac walks, cliff shoulders and bridge approaches | Reuse high-detail plant and rock sources to form connected groups: canopy → shrubs/ferns → low flowers → lawn. Let selected planted banks touch a building base or a terrace edge so each has an anchor. | Retain both bridge channels and all bridge portals. Keep distant painted mountains legible between local silhouettes. |

The two arcades may differ slightly in length if actual grade or circulation requires it. Preserve their common roof line and bay proportions; do not deform individual bays to force a fit. If the conservatory footprint needs adjustment, first move it within the east room or reduce its length by one bay. Do not enlarge the island as a first response.

The pool should be a shallow, supported garden basin, not a large terrain excavation. A continuous low masonry edge and planted shoulders can resolve a small level change. Do not run a decorative stream across protected routes merely to connect it to existing sea water.

### Measured route and terrain evidence

The clearance below is the shortest distance from a sampled route centreline to the rectangular design envelope, minus its authored half-width: 3.2 for the about road, 2 for other roads. Positive clearance is evidence about these envelopes, not the final visible road shoulder. Grid sampling reports the rendered terrain height under the whole proposed envelope.

| Refined envelope | Nearest route | Road-envelope gap | Ground min–max y | Assembly implication |
|---|---|---:|---:|---|
| West arcade, `(-22.4,4)`, `3.4 × 12` | Research | `12.17` | `6.654–7.678` | A local level walk near y = 7.2 requires modest fill/cut; fit supported footing and ramp the ends. |
| East arcade, `(22.4,4)`, `3.4 × 12` | Contact | `13.96` | `6.253–7.671` | Same approximate level walk as west keeps a coherent roof line; retain continuous ground support. |
| Conservatory, `(55,18)`, `16 × 9` | Contact | `5.13` | `6.021–8.295` | A bounded grade near y = 7 requires about 1.3 cut / 1 fill at extrema. Do not follow raw heightAt with individual columns or place a flat unsupported slab. Limit blend shoulders so the contact route is unaffected. |
| Water garden, `(-44,47)`, `16 × 9` | Publications | `5.27` | `6.138–7.754` | A supported local garden shelf near y = 7.1 is plausible. Fit the shallow basin above/into that shelf without letting terrain show through water. |

The earlier larger candidates varied by about 2.3–3.6 vertically, so these shortened and shifted footprints are recommended. New grades should preserve the existing road/portal override contract. Current tree crowns and detailed atelier geometry have not been collision-tested by this research task.

## Sightlines and space rhythm

1. **Arrival → fountain → academy entrance.** Keep a readable light path and a central opening through planting. Arcades sit at the sides of the destination, so the castle base acquires scale without losing its doorway.
2. **Fountain → west library.** A dark tree mass and bright flowering margin draw the eye left; the water garden is a secondary foreground destination. The library door and publication interaction remain easier to recognise than the garden furniture.
3. **Fountain → east atelier.** The conservatory is a low, oblique glass-and-metal rhythm behind the eastern garden. The atelier remains the primary destination along the project route. Planting must not cover the actual project work.
4. **Library water edge → castle.** A local framed glimpse, with pool in the foreground, an arcade in the middle distance, and castle above. This is the most useful new quiet screenshot.
5. **Court → bridge destinations.** Preserve gaps through vegetation. An endpoint can be partially framed by foliage; its access path must not disappear into a hedge.

The island should alternate sheltered threshold, open court, planted room, and open meadow. It should not become a continuous hedge maze. A continuous run of copied fencing or uniformly spaced trees fails this design.

## Original asset kit, ordered by visible payoff

| Priority | Asset | Minimum art content before assembly | Intended use |
|---|---|---|---|
| **P0** | **Arcade bay + two end treatments** | Slender shaft and capital; real arch void; visible voussoir/stones or restrained carved joints; a supported eave and dark roof; UVs and material scale matching existing masonry. No flat arch texture on an opaque wall. | Two short wings; few variants, deliberate placement. |
| **P0** | **Botanical conservatory** | Distinct low roof silhouette; aged green metal or timber frame; believable sill and masonry plinth; glazed panels with restrained reflection; vent/louver detail; door; two interior planting masses and a potting bench. | One building. Its interior must be readable at near distance and its silhouette at overview distance. |
| **P0** | **Garden bank assemblies** | Curated groups using retained high-detail foliage: taller back mass, mid-height shrubs/ferns, low edge flowers, irregular soil/moss transition, occasional integrated stone. At least three different footprints. | Join court, building, water and meadow edges. They replace isolated scatter; density alone is not the goal. |
| **P1** | **Water garden assembly** | Non-perfect outline; coping with believable thickness; water held inside the basin; two unequal lily/reed groups; exposed quiet water; one supported edge seat. | One west library garden. No uniform lily grid or excessive saturated turquoise. |
| **P1** | **Garden threshold/low seat modules** | A limited palette of weathered stone ends, ledges, and seats; joints and support visible near camera. Low enough to retain views. | Meadow edges and one library rest point; no perimeter enclosure. |
| **P1** | **Planted conservatory interior kit** | Two distinct specimen forms, grouped pots, useful workbench, one readable botanical working area. Small objects grouped on surfaces rather than scattered across ground. | Make the greenhouse feel used. Details reinforce the building; they do not compensate for a poor exterior. |
| **P2** | **Reading and maintenance details** | One book rest/table, watering vessel, a few controlled hanging/trailing plants; material and scale consistent with characters. | At most a few focal corners, after whole-scene approval. |

Use the existing high-detail scanned stone and plant sources where applicable. New architecture should be original in silhouette and assembly; these references are design precedents, not asset libraries. Retain rich material detail while reducing obvious large-area repetition in the lawn. More evenly sprinkled flowers would preserve the same barren composition under extra noise.

## Before-assembly review gate

Review one arcade bay with an end, the complete conservatory, one garden-bank composition, and the water-garden assembly in a separate art/studio view before placing many instances.

- Show each at human scale, at the expected approach scale, and at the expected overview scale. If only the close view reads well, repair the silhouette or massing first.
- Inspect against both pale sky and darker foliage; real holes, glazing, edge thickness and plant silhouettes must survive both backgrounds.
- Show neutral daylight without hiding geometry in bloom or heavy fog. Match masonry scale, roof value and plant material response to the retained castle and gardens.
- Check bases against a representative sloped/graded ground sample. No floating rims, unsupported masonry, buried doors or leaking water.
- Arcade roof must read as supported; repeated bays must not resemble a solid fence. Conservatory interior must have visible depth and living plant forms, rather than a uniformly bright glass box.
- The bank assembly must read as one connected planting mass with layers; it must also contain intentional gaps. Repeated identical bouquets or equidistant shrubs fail.
- Check all new structures at nearby character scale with the character owner. Use this to verify seats, doors and bench heights rather than assuming the current character scale.

## Assembly and screenshot acceptance

These are required candidate views, not claims that they have been captured. Use native-resolution daylight views first; repeat the key views at the selected dusk/night state only after daytime composition works. Keep a comparison view matched to the user's screenshot.

| View | Proposed eye/target or framing | What must be evident |
|---|---|---|
| **Matched overview** | Match the supplied screenshot framing and crop | The centre reads as connected gardens; castle dominates; the water garden and conservatory each supply one clear secondary form. No extra island is required to make the main one convincing. |
| **Whole-world hero** | Existing broad vista showing castle and painted far mountains | The new lower forms do not destroy the skyline, distant mountain character or bridge legibility. |
| **Arrival** | Eye near `(18, ground+2, 74)`, aim toward fountain then academy entry | A framed but open lawn; the intended destination is legible immediately. New props do not block movement/camera. |
| **Court toward academy** | Eye near `(0, ground+2, 43)`, aim near `(0, 12, -10)` | Slender side arcades, clear centre, visible masonry/planting junctions. No flat wall of arches. |
| **Library water garden** | Eye near `(-32, ground+2, 54)`, aim near `(-46, 8, 43)`; adjust to actual support | Water centre, layered edges, reading-scale detail, and a meaningful connection back to library/court. |
| **Conservatory approach** | Eye near `(40, ground+2, 27)`, aim near `(55, 10, 18)` | Door and planted interior readable; no glass sorting or opaque-mirror problem; supported plinth; atelier still legible from its own approach. |
| **Portfolio access route** | Walk each retained destination route and capture its approach | CV/about, publications, projects and contact remain directly reachable and recognisable. Verify actual click/interaction as well as appearance. |

Fit coordinates to actual ground and collision in runtime. Check route clearance against full placed geometry and plant crowns, not just placement points. Verify portal activation, project exhibits, camera travel, render errors, and asset availability after assembly. HTTP 200 alone is not visual proof.

Use the matched overview as the first whole-scene decision point: if there is still one undifferentiated grass field with a few new objects, revise room boundaries and planting masses before adding P2 detail. If every remaining lawn pocket is filled, restore the arrival meadow and the path-side openings. Acceptance requires both abundance and a clear place to rest the eye.

## Optional island extension

A future small conservatory island could sit beyond the east shore and be reached by a light garden bridge, but it would add landform, bridge, collision, navigation and skyline work. It also moves the new attraction away from the barren main-island centre. Choose it only if runtime fitting proves that the present east room cannot accommodate a convincing conservatory while retaining the required paths and atelier views. The existing data and screenshot do not currently establish such a need.
