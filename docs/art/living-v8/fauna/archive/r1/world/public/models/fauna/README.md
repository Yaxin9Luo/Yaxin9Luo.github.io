# Living sky · original editable specimens

These assets are original geometric interpretations authored for Living Academy v8. The canonical editable recipe is `world/src/sky-fauna.js`; a matching copy is included here. Rebuild with `node scripts/export-fauna.mjs` from `world/`. `manifest.json` binds each export to the source SHA-256.

The swallow has a continuous shaped chest/head, short bill, eyes, thick cambered wings with broad roots, overlapping primary/secondary feathers and a true short tail fan with two long outer feathers. The original articulated shoulder/wrist deformation is baked to compatible upstroke/downstroke position **and normal** morphs. Its GLB includes the same geometry and a ten-second authored bank/flap/glide animation. Scale, joint motion and feather construction are artistic interpretations, not measured animal motion.

The paper lantern has a full double-sided folded shell, eight slender bamboo ribs, a genuinely open lower rim, crossed brace, fuel pad and tapered flame. Its exported GLB retains the exact geometry, PBR materials and paper vertex pigments. The editable runtime recipe additionally supplies derivative-filtered paper fibres, graded warm emission and a view-space radial aura; those shader effects are not portable glTF material extensions. The firefly GLB similarly retains the full beetle, wings, antennae, legs and luminous abdomen; its additive aura stays in the runtime source. The studio renders the canonical runtime materials and geometry, not the fallback GLB material interpretation.

No reference photograph or third-party texture is included in these assets. The bird morphology was informed by three licensed research photographs, kept outside public resources:

- Mildeep, *Barn-Swallow.jpg*, 2024-01-31, [source](https://commons.wikimedia.org/wiki/File:Barn-Swallow.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Dori, *Barn swallow 7283.jpg*, 2008-06-29, [source](https://commons.wikimedia.org/wiki/File:Barn_swallow_7283.jpg), selected [CC BY-SA 3.0 US](https://creativecommons.org/licenses/by-sa/3.0/us/).
- Prasan Shrestha, *A reflection flight of barn swallow.jpg*, 2024-01-01, [source](https://commons.wikimedia.org/wiki/File:A_reflection_flight_of_barn_swallow.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This photograph is a water reflection, used only for wing/tail silhouette.

Full reference records and art interpretation limits are in `docs/art/living-v8/research/birds/`. Photos remain unchanged local research evidence. No photo pixels, stock mesh or recorded bird call are used at runtime.
