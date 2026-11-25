// Muye as a survivors-like: the rules. Pure state and rules, no DOM.
// Contract: lab/game-studies/SPEC-SURVIVORS.md and its "Changes", and lab/game-studies/SPEC-CAMPAIGN.md (the
// campaign, and the file map: every file under sim/ and content/ has one owner). The tables are in content.js
// and content/; the engine is in sim/; this file is the entry the page and the tests import. The page feeds one
// input per fixed step and empties `events`. Everything random comes from the seeded generator in the game state
// (`rs`), so the same seed and the same inputs replay the same battle.
//
// World: a plane WORLD.w by WORLD.h, x to the right and y down, distances in px, times in seconds, angles in
// radians from +x toward +y. The hero only moves; everything he owns acts by itself.

export * from './content.js';
export {createGame, step, counts} from './sim/game.js';
export {give, canEvolve, canBless, canEvolveWeapon, canMerge, applyMeta, meritOf, openingPool, inPool, familyShare, leanOf, takeSpoil, saveHero, bigPayoff} from './sim/build.js';
export {META, MERIT, STATS, UNLOCKS, meritFrom, buy, newSave, poolOf, rankCost, meritToAll} from './content/meta.js';
export {addFoe} from './sim/foes.js';
export {addMan, elementAt} from './sim/squads.js';
export {addShot, addPickup} from './sim/harm.js';
export {castShape} from './sim/shapes.js';
export {spawnPlan} from './sim/campaign.js';
