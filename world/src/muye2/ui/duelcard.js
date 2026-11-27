// A duel's title card keeps its own clock (SPEC-CAMPAIGN 3.7, "A duel on the page"). It once ran on the wall clock while
// the rules' `enter` beat runs in game time: whenever the field stood still or ran slow as he landed (a join's ceremony,
// an offer, heavy frames), the card played out unseen before he had finished landing (the lead's second joint look,
// 2026-11-27). Now it advances only while the field does, or while an offer waits for it (the offer is held back until
// the card has played: the card always plays first, other things wait). Pure, so the tests can step it.

export const CARD_MS = 2500;      // the card's length: the rules' `enter` beat
export const CARD_QUIET = 700;    // ms after it in which banners and heralds still wait (the art's seal spreads over the arena)
/** The card's moments, in ms of its own clock (muye.css keeps the same times). */
export const CARD_BEATS = [['sweep', 0], ['name', 550], ['seal', 950], ['clear', 2000]];

/** A card's state: `t` its clock in ms (-1: none), `beat` the next moment to tell. */
export const newCard = () => ({t: -1, beat: 0});
export const startCard = c => { c.t = 0; c.beat = 0; return c; };

/** One frame. `dt` real seconds; `moved`: the rules stepped this frame; `offer`: an offer is open; `playing`: the run is on
    and not paused; `held`: kept still for stills. Returns the moments reached this frame, in order. */
export function stepCard(c, {dt, moved, offer, playing, held}) {
  if (c.t < 0) return [];
  if (playing && !held && (moved || offer)) c.t += Math.min(dt, .1) * 1000;
  const out = [];
  while (c.beat < CARD_BEATS.length && c.t >= CARD_BEATS[c.beat][1]) out.push(CARD_BEATS[c.beat++][0]);
  if (c.t >= CARD_MS + CARD_QUIET) c.t = -1;      // done, and its quiet over
  return out;
}
/** The card is on screen (an offer waits until it is not). */
export const cardShowing = c => c.t >= 0 && c.t < CARD_MS;
/** Banners and heralds wait: the card is showing, or its quiet after. */
export const cardQuiet = c => c.t >= 0;
