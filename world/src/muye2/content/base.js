// Muye's rules, shared measures: the world, the hero, the horse's cry, the soldiers' share of harm, the five
// elements, and the words helper. Owner: rules·campaign (A); others add, never rename.
//
// Shapes an automatic attack can have (the `shape` of a treasure's row or of a troop's `attack`):
//   line   a thrust from the owner through every foe on it        length, width, count, fork, forkAngle, forkLength, burnDps, burnLife
//   arc    a sweep round the owner                                 angle (degrees), radius, push, span
//   orbit  things that circle the owner and strike what they touch rings [{count, radius, speed}], r, again
//   throw  a shot that flies, pierces, bounces and may come back   count, speed, r, range, life, pierce, bounces, hop, returns, target
//   drop   something that comes down on a place                    pick ('cluster' | 'strongest'), count, radius, delay, stun, range,
//                                                                  zone, zoneDps, zoneLife, zoneSlow, chase, eliteMult, chainElites
//   ward   a guard round the owner that takes a hit and answers    radius, push, mend, shieldAllies, pulse
//   beam   a ray that turns round the owner                        length, width, sweep (radians a second), life, slow, slowTime
//   bind   holds a line of foes in place                           length, width, hold
// Every shape also reads `cd` (seconds between casts), `dmg`, and where it applies `stun` and `push`.
// A row's `levels` are written as what changes at that level; `at[n]` (made below) is the full set of numbers at
// level n, and for a treasure `at[MAX + 1]` is the evolved form.

export const WORLD = {w: 6000, h: 6000, edge: 40};
export const STEP = 1 / 60;

export const HERO = {
  r: 18, hp: 100, speed: 215,
  safe: .5,            // after a hit, this long without further harm
  blowCap: .3,         // no single blow takes more than this share of his full health (lead, 2026-11-26: a run is never ended by one hit)
  hurtTime: .25,       // how long `state` reads 'hurt' (display only)
  fallTime: 1.5,       // from the blow that takes the last health to the end of the run
  gather: 125,         // battle spirit this near flies to the hero
  touch: 26,           // and is taken this near
  dash: 180, dashTime: .2, dashCd: 3,
  turn: 3.5,           // radians a second the horse's heading follows the reins
  afoot: .6,           // unhorsed (张桂芳's call, 纣王's shout): on foot he goes this share of his speed, with no spring and no full cry
  sharp: 1.05,         // a change of more than this (60 degrees) between reins and heading is a sharp turn
};
export const CRY = {
  after: 1.2,          // seconds of riding without a sharp turn or a stop
  speed: 1.3,
  reserve: .6,         // the ride clock runs this far past `after`
  cost: .15,           // every foe trampled and still standing takes this much off the ride clock: a thick mass ends
                       // the cry; a foe the horse kills outright costs nothing
  dmg: 20, perLevel: 5, // trample damage: it grows with the hero's level
  again: .8,           // a foe is not trampled again within this long
  stun: .5, aside: 70, // a trampled foe is thrown this far to the side and loses this long
};
export const ALLY = {
  hurt: .5,            // a soldier takes this share of a blow of the mass (he is armoured and stands in rank)
  shot: .3,            // and a shield-bearer this share of an arrow he stops
  speed: 1.15,         // soldiers keep up: this many times the hero's speed in full cry
};

// The five elements. `feeds` is the generating cycle: wood feeds fire, fire earth, earth metal, metal water, water wood.
export const ELEMENTS = {
  wood: {feeds: 'fire', zh: '木', en: 'wood', pigment: 'malachite'},
  fire: {feeds: 'earth', zh: '火', en: 'fire', pigment: 'cinnabar'},
  earth: {feeds: 'metal', zh: '土', en: 'earth', pigment: 'ink and ochre'},
  metal: {feeds: 'water', zh: '金', en: 'metal', pigment: 'bronze gold'},
  water: {feeds: 'wood', zh: '水', en: 'water', pigment: 'azurite'},
};
/** The element whose arts let a treasure of `element` evolve. */
export const fedBy = element => Object.keys(ELEMENTS).find(e => ELEMENTS[e].feeds === element);

export const T = (en, zh) => ({en, zh});
