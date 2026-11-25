// Procedural motion for mounted key figures (the hero first): a real gallop, a rider who rides, and a weapon that strikes when the
// rules' weapon does. Built per frame from the unit's speed, the stride phase and the time to / since the weapon's cast; no tables.
// Angles in degrees, positive turns clockwise on screen with the figure facing right (+ on a leg swings the hoof back).
const TAU = Math.PI * 2, cos = (x) => Math.cos(x * TAU), sin = (x) => Math.sin(x * TAU);
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);

// ---- the mount. gait 0 = stand, 1 = walk, 2 = gallop (blended by speed). p: stride phase 0..1.
// Rotary gallop: hind far, hind near, fore far, fore near land in turn; each leg swings on a cosine and folds its knee on the way forward.
const LEGS = { legC: 0.0, legD: 0.12, legB: 0.42, legA: 0.54 };
export function mountPose(p, speed, cry, still) {
  const g = clamp(speed / 300), w = 1 - Math.abs(g - 0.5) * 2;     // g: 0 stand .. 1 gallop
  const amp = still ? 0 : mix(14, cry ? 40 : 32, g), fold = still ? 0 : mix(20, cry ? 70 : 58, g);
  const P = {};
  for (const [leg, off] of Object.entries(LEGS)) {
    const q = p - off, fore = leg === 'legA' || leg === 'legB';
    P[leg] = amp * cos(q) * (fore ? 1 : 0.9);                                       // + = hoof back (stance push), - = reaching forward
    const lift = Math.max(0, -sin(q));                                              // the swing half: the leg comes forward folded
    P[leg + '2'] = fore ? fold * lift : -fold * 0.55 * lift;                       // fore knee folds the hoof up behind; hind hock the other way
  }
  P.body = still ? 0 : g * (cry ? 5 : 3.5) * sin(p + 0.1);                          // the rocking of the gallop
  P.neck = still ? 0 : -g * 7 * sin(p + 0.35) - g * 4;                              // nods against the body; reaches when fast
  P.tail = still ? -6 : mix(4, cry ? 34 : 26, g) + 6 * sin(p * 2 + 0.2);            // streams back with speed
  P.$bob = still ? 0 : mix(1.5, 7, g) * Math.abs(sin(p));
  return P;
}

// ---- the weapon timelines (seconds): wind-up before the cast, then strike, follow-through, recovery
export const WEAPON_TIME = {
  spear: { W: 0.18, S: 0.08, F: 0.12, R: 0.22 },
  halberd: { W: 0.22, S: 0.16, F: 0.14, R: 0.26 },
  glaive: { W: 0.34, S: 0.14, F: 0.2, R: 0.36 },
  bow: { W: 0.32, S: 0.05, F: 0.12, R: 0.24 },
  steelWhip: { W: 0.12, S: 0.07, F: 0.1, R: 0.16 },
};
// keyframes per weapon: shoulder (armU), elbow (armF), wrist (hand) and the torso's extra lean; 'ride' is the carry at the gallop

/** Which beat of the weapon we are in: [from, to, t] keyframe names and the blend. The blow lands ON the cast (the rules deal the damage then):
 * wind-up over the W seconds before the strike, the strike over the last S seconds before the cast, then follow-through and recovery after it.
 * cd: seconds to the next cast (pass a large number when no foe is in reach: the rules then retry every 0.12 s and nothing should move); since: seconds since the last. */
export function weaponBeat(id, cd, since) {
  const T = WEAPON_TIME[id] || WEAPON_TIME.spear;
  if (since < T.F) return ['hit', 'fol', ease(since / T.F)];
  if (cd != null && cd < T.S) return ['wind', 'hit', ease(1 - cd / T.S)];
  if (cd != null && cd < T.S + T.W) return [since < T.F + T.R ? 'fol' : 'ride', 'wind', ease(1 - (cd - T.S) / T.W)];
  if (since < T.F + T.R) return ['fol', 'ride', ease((since - T.F) / T.R)];
  return ['ride', 'ride', 0];
}
export function lerpPose(A, B, t) { const o = {}; for (const k in A) o[k] = mix(A[k], B[k] ?? 0, t); for (const k in B) if (!(k in o)) o[k] = mix(0, B[k], t); return o; }   // a key one side lacks is 0 there

// ---- cloth and trailing parts: speed trails them back, a blow snaps them, a little wave keeps them alive
export function trail(now, speed, snap, base = {}) {
  const g = clamp(speed / 300);
  return {
    cloak: (base.cloak || 0) + 6 + 26 * g + 6 * Math.sin(now * 7) + 14 * snap,
    plume: (base.plume || 0) + 10 + 30 * g + 8 * Math.sin(now * 9 + 1) + 20 * snap,
    banner: (base.banner || 0) + 3 * g + 2 * Math.sin(now * 3.1) - 4 * snap,
  };
}
