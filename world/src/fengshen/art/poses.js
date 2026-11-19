// Motion: every state of every figure as a pose (one angle per joint), read from the simulation's state and stateT.
// Puppets move like puppets: nothing deforms, parts only turn on their pivots. Timing is hand-set: a pose is left fast
// and arrived at slowly, extremes are held, and what is shown changes 24 times a second (STEP), not every frame.
// Keys of a pose that start with $ are not joints: $air (least height of the horse's body), $torso / $head (where the
// rider's springs are pulled to), $hide (parts left out), $fall (0..1, a figure going down), $fade (0..1 strength).
export const STEP = 24;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, v) => a + (b - a) * v;
const out = (v) => { v = clamp(v); return 1 - (1 - v) * (1 - v); };          // fast out of a key, slow into the next
const inout = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
export const stepped = (t) => Math.floor(t * STEP + 1e-6) / STEP;
const mix = (a, b, v) => { const o = { ...a }; for (const k in b) if (typeof b[k] === 'number') o[k] = lerp(a[k] ?? b[k], b[k], v); else o[k] = b[k]; return o; };

/* ------------------------------------------------------------------ Jiliang
   Legs are [upper, lower] angles; hT / hL the far (trailing) and near (leading) hind, fT / fL the same for the fore legs.
   pitch: the forehand (negative lifts the nose); flex: the hind half against it (negative tucks the haunch under);
   neck: against the pitch; air: the least height of the body, for keys where no hoof is down. */
const key = (hT, hL, fT, fL, pitch, flex, neck, air, d = 0) => ({ hT, hL, fT, fL, pitch, flex, neck, air, d });
// The gallop: eight keys in the real order of footfall (far hind, near hind, far fore, near fore, then the air with the
// legs gathered). The near side leads, fore and hind. A leg that bears weight is straight. d: share of the stride.
const GALLOP = [
  key([-22, -40], [-12, -50], [-8, 80], [10, 88], 0, -7, -6, 77, 0.16),      // 0 in the air, gathered
  key([-26, -8], [-30, -32], [-28, 70], [-8, 90], -4, -5, -8, 60, 0.10),     // 1 far hind down
  key([-2, -6], [-27, -8], [-46, 40], [-30, 72], -3, -2, -5, 0, 0.10),       // 2 near hind down
  key([34, -6], [6, -6], [-50, 6], [-48, 44], 0, 4, 0, 0, 0.12),             // 3 the hinds push, far fore reaches
  key([44, -24], [36, -8], [-26, 3], [-54, 10], 3, 5, 5, 0, 0.12),           // 4 far fore down
  key([34, -62], [42, -36], [0, 3], [-36, 3], 4, 2, 6, 0, 0.12),             // 5 near fore down
  key([10, -58], [24, -64], [34, 6], [-4, 3], 3, -2, 2, 0, 0.12),            // 6 over the near fore
  key([-12, -52], [2, -62], [30, 60], [32, 5], 0, -5, -3, 66, 0.16),         // 7 the near fore pushes off
];
// The trot: two beats, the legs in diagonal pairs.
const TROT = [
  key([-24, -8], [30, -44], [22, 52], [-30, 3], 0, 0, -3, 0, 0.25),          // near fore and far hind down
  key([6, -6], [0, -56], [-18, 64], [2, 3], 0, 1, -1, 0, 0.25),
  key([30, -44], [-24, -8], [-30, 3], [22, 52], 0, 0, -3, 0, 0.25),          // far fore and near hind down
  key([0, -56], [6, -6], [2, 3], [-18, 64], 0, 1, -1, 0, 0.25),
];
const STAND = key([-3, -8], [7, -10], [5, 3], [-3, 3], 0, 0, -5, 0);
const STRETCH = key([40, -8], [48, -12], [-60, 6], [-54, 8], -1, 6, 3, 75);                 // the flying gallop of the Han bronze horse: a held extreme, in the air only
const TAKEOFF = key([38, -10], [46, -14], [-20, 96], [-6, 102], -15, 5, -4, 72);            // thrown up off the hinds, forelegs folded
const DESCENT = key([-12, -58], [0, -66], [-44, 5], [-36, 4], 11, -6, 6, 70);               // forelegs reaching for the ground
const REAR = key([14, -34], [22, -38], [-78, 74], [-54, 92], -30, 0, 9, 0);                 // stopped dead: up on the hinds
const BOWED = key([-3, -8], [7, -10], [9, 2], [-6, 4], 4, 0, 54, 0);                        // standing by the fallen rider, the head down
const mixKey = (a, b, v) => { const o = {}; for (const k of ['pitch', 'flex', 'neck', 'air']) o[k] = lerp(a[k], b[k], v); for (const k of ['hT', 'hL', 'fT', 'fL']) o[k] = [lerp(a[k][0], b[k][0], v), lerp(a[k][1], b[k][1], v)]; return o; };
function cycle(keys, ph) {
  ph = ((ph % 1) + 1) % 1; let t0 = 0;
  for (let i = 0; i < keys.length; i++) { const a = keys[i]; if (ph < t0 + a.d || i === keys.length - 1) return mixKey(a, keys[(i + 1) % keys.length], out((ph - t0) / a.d)); t0 += a.d; }
}
// One stride covers more ground the faster the horse goes: the gallop is not one loop played quicker.
export const strideOf = (gait, speed) => (gait === 'gallop' ? 200 + 0.34 * speed : 76 + 0.26 * speed);

/** The state the art keeps for the hero between frames. */
export const newHeroMotion = () => ({ gait: 'stand', phase: 0, t: 0 });

/**
 * The hero's pose for this frame. h: the simulation's hero; m: newHeroMotion(); dt: seconds since the last frame.
 * Gaits switch cleanly and are never blended: stand under 12 px/s, trot, gallop from 230 (back to trot under 170).
 */
export function heroPose(h, m, dt) {
  const speed = Math.abs(h.vx), air = h.y > 0.5 || h.state === 'leap';
  const gait = speed < 12 ? 'stand' : m.gait === 'gallop' ? (speed < 170 ? 'trot' : 'gallop') : speed >= 230 ? 'gallop' : 'trot';
  if (gait !== m.gait) { m.gait = gait; m.phase = gait === 'gallop' ? 0.26 : 0; }
  if (gait !== 'stand' && !air) m.phase = (m.phase + speed * dt / strideOf(gait, speed)) % 1;
  m.t += dt;
  const ph = Math.floor(m.phase * 16 + 1e-6) / 16;                              // sixteen shown poses to a stride
  let k;
  if (h.state === 'fallen') { const t = stepped(h.stateT);                      // the horse while its rider falls: up, down, then the head lowered to him
    k = t < 0.4 ? mixKey(STAND, REAR, out(t / 0.1)) : t < 1.0 ? mixKey(REAR, STAND, inout((t - 0.4) / 0.22)) : mixKey(STAND, BOWED, inout((t - 1.0) / 0.34)); }
  else if (h.state === 'stopped') { const t = stepped(h.stateT); k = mixKey(STAND, REAR, t < 0.34 ? out(t / 0.1) : 1 - inout((t - 0.34) / 0.3)); }
  else if (air) { const q = clamp(h.vy / 560, -1, 1); k = q > 0 ? mixKey(STRETCH, TAKEOFF, inout(q)) : mixKey(STRETCH, DESCENT, inout(-q)); }
  else k = gait === 'stand' ? STAND : cycle(gait === 'gallop' ? GALLOP : TROT, ph);
  // the horse in the new verbs: the flame gallop pulls every key toward the flying gallop; a rally at a stand lifts it;
  // in full cry the neck is stretched out and down
  if (h.state === 'dash') k = mixKey(k, { ...STRETCH, air: k.air }, 0.62);
  else if (h.state === 'rally' && gait === 'stand') k = mixKey(STAND, REAR, 0.42 * out(stepped(h.stateT) / 0.12));
  if (h.fullCry && !air && h.state !== 'fallen') k = { ...k, neck: k.neck + 13, pitch: k.pitch + 2 };
  // the rider. The blow has three poses with names: DRAWN (axe back over the shoulder), STRUCK (axe forward and down,
  // held), CARRIED (lifting back to the carry). The paint stroke bridges DRAWN and STRUCK; no in-between pose is shown.
  let wind = 0, swing = 0, torso = 5 + 9 * clamp(speed / 520), head = -3, armF = -62;
  if (h.state === 'strike') { const t = h.stateT; wind = t < 0.05 ? 1 : 0; swing = t < 0.05 ? 0 : t < 0.27 ? 1 : 1 - inout((t - 0.27) / 0.1); }
  if (h.state === 'hurt') { const v = Math.exp(-stepped(h.stateT) * 7); torso -= 24 * v; head += 14 * v; armF -= 60 * v; }
  if (h.state === 'stopped') { const v = Math.exp(-stepped(h.stateT) * 4); torso += 22 * v; head -= 12 * v; }
  const s = swing;
  const P = {
    body: k.pitch, hind: k.flex - k.pitch * 0.4, neck: -11 + k.neck,
    hU2: k.hT[0], hL2: k.hT[1], hU: k.hL[0], hL: k.hL[1], fU2: k.fT[0], fL2: k.fT[1], fU: k.fL[0], fL: k.fL[1],
    leg: -14 - k.pitch * 0.5,
    armU: lerp(-118, -82, s) - 16 * wind, armL: lerp(-30, -8, s), yue: lerp(-76, 30, s) - 16 * wind, armF: armF + k.pitch,
    pole: -9 + k.pitch * 0.3,
    $torso: torso + 8 * s - 5 * wind - k.pitch * 0.9, $head: head - 6 * s, $air: k.air, $swing: s, $airborne: air,
    ...(h.state === 'fallen' ? { $hide: FALL_HIDE } : null),
  };
  if (h.state !== 'fallen') verbs(P, h, m, air);
  return P;
}

// The verbs of SPEC-V2 section 3, each three poses with names; a paint stroke (fx) bridges the first two.
//   sweep:       GATHERED (the axe drawn back low behind him, deeper the longer it is held), SWEPT (level, far forward, held), then the carry
//   leap strike: RAISED (straight up, in the air), SLAMMED (driven down ahead of the horse on landing, held), then the carry
//   flame gallop: DASHING (flat on the neck, the axe trailing);  rally: RALLYING (sitting tall, the standard upright, a hand on it)
const GATHERED = { armU: 46, armL: -16, yue: -206, $torso: -13, $head: 7 }, SWEPT = { armU: -74, armL: -6, yue: 15, $torso: 27, $head: -8 };
const RAISED = { armU: -172, armL: -4, yue: -99, $torso: -7, $head: -10 }, SLAMMED = { armU: -56, armL: -4, yue: 66, $torso: 35, $head: -4 };
const DASHING = { armU: 32, armL: -10, yue: -170, $torso: 35, $head: -15 }, RALLYING = { pole: 7, armF: -160, armU: -40, armL: -30, yue: -22, $torso: -9, $head: -13 };
function verbs(P, h, m, air) {
  const set = (o, v) => { for (const id in o) P[id] = lerp(P[id], o[id], v); }, hold = stepped(h.hold || 0);
  if (h.state === 'sweep') { const t = stepped(h.stateT); if (t < 0.04) set(GATHERED, 1); else set(SWEPT, t < 0.3 ? 1 : 1 - inout((t - 0.3) / 0.16)); }
  else if (hold > 0.08) set(GATHERED, 0.5 * out(hold / 0.14) + 0.5 * clamp(hold / 0.8));
  if (h.state === 'strike' && air) set(RAISED, out(stepped(h.stateT) / 0.08));
  if (m.slamT != null && m.slamT < 0.42) { const t = stepped(m.slamT); set(SLAMMED, t < 0.22 ? 1 : 1 - inout((t - 0.22) / 0.2)); }
  if (h.state === 'dash') set(DASHING, out(stepped(h.stateT) / 0.08));
  if (h.state === 'rally') set(RALLYING, out(stepped(h.stateT) / 0.12));
  if (h.fullCry) P.$torso += 9;
  P.$cry = (h.fullCry || h.state === 'dash') ? 1 : 0;
}

/* ------------------------------------------------------------------ foot soldiers
   One table of key poses per kind; a state is a short walk between them. base is the carriage, stand the legs at rest. */
const STANDLEGS = { lu: -6, ll: 6, ku: 8, kl: 4 }, SETLEGS = { lu: -28, ll: 18, ku: 26, kl: 8 }, LUNGE = { lu: -48, ll: 32, ku: 36, kl: 4 };
const KIND = {
  soldier: {
    scale: 0.86, stride: 62, run: 36, box: [-110, -150, 120, 70],
    base: { t: 6, h: -3, au: -26, al: -74, bu: -58, bl: -44, w: -16 },
    windup: { t: -6, h: 2, au: 24, al: -104, bu: -70, bl: -50, w: -10, ...SETLEGS },                 // the spear drawn back
    attack: { t: 22, h: -8, au: -72, al: -18, bu: -30, bl: -70, w: -3, ...LUNGE },                    // thrust
    stun: { t: -24, h: 16, au: -150, al: -30, bu: 140, bl: -40, w: -80, lu: -18, ll: 40, ku: 30, kl: 32 },
  },
  officer: {
    scale: 0.94, stride: 64, run: 36, box: [-110, -160, 120, 70],
    base: { t: 8, h: -5, au: -60, al: -40, bu: 30, bl: -30, w: -40, c: 8 },
    windup: { t: -4, h: 0, au: -156, al: -28, bu: 40, bl: -40, w: -118, c: 2, ...SETLEGS },           // the sword raised
    attack: { t: 20, h: -8, au: -46, al: -8, bu: 60, bl: -30, w: 14, c: 16, ...LUNGE },               // cut down
    stun: { t: -24, h: 16, au: -150, al: -30, bu: 140, bl: -40, w: -100, c: -10, lu: -18, ll: 40, ku: 30, kl: 32 },
  },
  spear: {
    scale: 0.96, stride: 44, run: 24, box: [-170, -190, 200, 60],
    base: { t: 4, h: -2, au: -46, al: -46, s: 0, bu: -24, bl: -96, w: -72, $hide: { wb: true } },                          // shield forward, the dagger-axe on the shoulder
    // BRACE: low behind the shield, the long shaft levelled at the horse. Read it by the level line and the crouch.
    brace: { t: 30, h: -18, au: -64, al: -8, s: -8, bu: -58, bl: -20, wb: 5, lu: -74, ll: 84, ku: 54, kl: 10, $hide: { w: true } },
    // WINDUP: upright, the dagger-axe high and back over the head. Read it by the shaft standing above the crest.
    windup: { t: -8, h: 4, au: -50, al: -40, s: 0, bu: -172, bl: -16, w: -124, lu: -24, ll: 16, ku: 22, kl: 6 , $hide: { wb: true } },
    attack: { t: 18, h: -8, au: -30, al: -60, s: 6, bu: -58, bl: -16, w: 24, lu: -44, ll: 34, ku: 34, kl: 4 , $hide: { wb: true } },
    stun: { t: -22, h: 14, au: -130, al: -40, s: -30, bu: 150, bl: -40, w: -150, lu: -18, ll: 40, ku: 30, kl: 32 , $hide: { wb: true } },
  },
  axe: {
    scale: 1.06, stride: 50, run: 26, box: [-150, -200, 150, 60],
    base: { t: 6, h: -4, au: -44, al: -66, bu: -52, bl: -58, w: -52 },
    // WINDUP: both arms up, the broad axe over the head. Read it by the blade above everything else.
    windup: { t: -8, h: 2, au: -154, al: -20, bu: -136, bl: -36, w: -100, lu: -30, ll: 22, ku: 28, kl: 6 },
    attack: { t: 24, h: -10, au: -42, al: -8, bu: -30, bl: -20, w: 34, lu: -50, ll: 40, ku: 36, kl: 4 },
    stun: { t: -22, h: 14, au: -130, al: -40, bu: 150, bl: -40, w: -150, lu: -18, ll: 40, ku: 30, kl: 32 },
  },
  archer: {
    scale: 0.92, stride: 46, run: 24, box: [-130, -170, 130, 60],
    base: { t: 0, h: -4, au: -20, al: -60, bu: -50, bl: -30, w: -62, $hide: { wd: true } },           // the bow carried low
    // DRAW: upright, the bow arm out, the bow standing, the string hand at the ear. Read it by the standing arc and the arrow.
    draw: { t: -5, h: -8, au: -96, al: -118, bu: -112, bl: -4, w: -22, lu: -22, ll: 14, ku: 20, kl: 4, $hide: { w: true } },
    attack: { t: -2, h: -6, au: -70, al: -150, bu: -112, bl: -4, w: -22, lu: -22, ll: 14, ku: 20, kl: 4, $hide: { wd: true } },   // loosed: the hand flies back
    stun: { t: -22, h: 14, au: -130, al: -40, bu: 150, bl: -40, w: -150, lu: -18, ll: 40, ku: 30, kl: 32, $hide: { wd: true } },
  },
};
const STUN = { t: -24, h: 16, au: -150, al: -30, bu: 140, bl: -40, w: -80, lu: -18, ll: 40, ku: 30, kl: 32 };
Object.assign(KIND, {
  // ---- Zhou, SPEC-V2 section 2
  'zhou:shield': {   // 干: the first file. Top line: the round head of the tall shield beside a knotted cap.
    scale: 0.9, stride: 58, run: 30, box: [-120, -165, 130, 70],
    base: { t: 3, h: -2, au: -40, al: -50, bu: -62, bl: -30, s: 0, w: -50 },
    windup: { t: -6, h: 2, au: -152, al: -28, bu: -66, bl: -26, s: 0, w: -120, ...SETLEGS },
    attack: { t: 14, h: -6, au: -52, al: -8, bu: -50, bl: -40, s: 4, w: 8, ...LUNGE },
    // BLOCK: down behind the shield, the shield's foot on the ground, the sword held back
    block: { t: 15, h: -10, au: 24, al: -50, bu: -76, bl: -4, s: 0, w: -36, lu: -54, ll: 54, ku: 42, kl: 8 },
    stun: { ...STUN, s: -30 },
  },
  'zhou:spear': {    // 戈: the second file, thrusting past the first. Top line: a streaming tassel and the blade above it.
    scale: 0.88, stride: 62, run: 34, box: [-130, -175, 200, 70],
    base: { t: 5, h: -3, au: -30, al: -70, bu: -56, bl: -50, w: -62, $hide: { wb: true } },
    windup: { t: -6, h: 2, au: 22, al: -100, bu: -66, bl: -52, w: -8, ...SETLEGS, $hide: { wb: true } },
    attack: { t: 24, h: -8, au: -76, al: -12, bu: -34, bl: -66, w: -2, ...LUNGE, $hide: { wb: true } },
    brace: { t: 26, h: -14, au: -66, al: -12, bu: -50, bl: -30, wb: 6, lu: -66, ll: 74, ku: 50, kl: 10, $hide: { w: true } },
    stun: { ...STUN, $hide: { wb: true } },
  },
  'zhou:archer': {   // 射: the rear. Top line: two upright feathers. He shoots on an arc, so the bow is aimed up.
    scale: 0.84, stride: 58, run: 32, box: [-130, -185, 140, 70],
    base: { t: 0, h: -3, au: -20, al: -60, bu: -44, bl: -30, w: -58, $hide: { wd: true } },
    draw: { t: -10, h: -12, au: -104, al: -126, bu: -138, bl: -6, wd: -32, lu: -20, ll: 12, ku: 20, kl: 4, $hide: { w: true } },
    // VOLLEY: the whole rank leans back and aims high together
    volley: { t: -19, h: -20, au: -122, al: -128, bu: -158, bl: -6, wd: -54, lu: -26, ll: 14, ku: 26, kl: 4, $hide: { w: true } },
    attack: { t: -8, h: -10, au: -74, al: -150, bu: -138, bl: -6, w: -32, lu: -20, ll: 12, ku: 20, kl: 4, $hide: { wd: true } },
    stun: { ...STUN, w: -150, $hide: { wd: true } },
  },
  // ---- Shang additions
  'shang:shield': {  // the animal-mask shield-bearer: the first file. Top line: the two bronze horns of the mask.
    scale: 1.0, stride: 44, run: 22, box: [-170, -190, 150, 60],
    base: { t: 4, h: -2, au: -50, al: -40, s: 0, bu: -30, bl: -80, w: -70 },
    windup: { t: -4, h: 2, au: -46, al: -44, s: 0, bu: -160, bl: -20, w: -112, lu: -24, ll: 16, ku: 22, kl: 6 },
    attack: { t: 16, h: -8, au: -34, al: -56, s: 6, bu: -52, bl: -14, w: 30, lu: -44, ll: 34, ku: 34, kl: 4 },
    block: { t: 17, h: -12, au: -68, al: -18, s: 0, bu: 14, bl: -60, w: -44, lu: -56, ll: 54, ku: 40, kl: 8 },
    stun: { t: -22, h: 14, au: -130, al: -40, s: -30, bu: 150, bl: -40, w: -150, lu: -18, ll: 40, ku: 30, kl: 32 },
  },
  'shang:captain': { // tall, the mask standard on his back. slow: his windup is the 1.0 s sweep, gathered at once, then deepening.
    scale: 1.5, stride: 70, run: 20, box: [-190, -215, 190, 60], slow: 1.0,
    base: { t: 4, h: -3, au: -44, al: -66, bu: -52, bl: -58, w: -52, f: 3, $hide: { horn: true } },
    // SWEEP GATHERED: turned away, both arms back, the great axe level behind him. Read it by the blade far out at the back.
    windup: { t: -26, h: 14, au: 106, al: -8, bu: 82, bl: -18, w: 188, f: -7, lu: -42, ll: 30, ku: 42, kl: 10, $hide: { horn: true } },
    attack: { t: 30, h: -10, au: -82, al: -6, bu: -60, bl: -10, w: 9, f: 11, lu: -58, ll: 46, ku: 42, kl: 4, $hide: { horn: true } },
    // HORN: head back, the horn at the mouth, the axe grounded
    horn: { t: -13, h: -24, au: -118, al: -112, horn: -62, bu: -40, bl: -50, w: -58, f: -5, lu: -12, ll: 8, ku: 14, kl: 4, $hide: {} },
    stun: { t: -18, h: 12, au: -120, al: -40, bu: 130, bl: -40, w: -140, f: -12, lu: -18, ll: 40, ku: 30, kl: 32, $hide: { horn: true } },
    // a death in three beats: to the knees with the axe let go (held); the standard tips back; then down on his face, the standard across him
    death: (t, stand) => {
      const KNEEL = { ...stand, t: 12, h: 26, au: 14, al: -16, bu: 26, bl: -20, w: 14, f: -16, lu: -78, ll: 112, ku: 16, kl: 84 };
      const DOWN = { ...KNEEL, t: 84, h: 20, au: -150, al: -20, bu: -130, bl: -30, w: 4, f: 86, lu: 10, ll: 20, ku: 30, kl: 30 };
      if (t < 0.46) return mix(stand, KNEEL, out(t / 0.16));
      const fall = out((t - 0.46) / 0.26), q = mix(KNEEL, DOWN, fall); q.$fall = fall; q.$fade = t < 0.98 ? 1 : clamp(1 - (t - 0.98) / 0.22); return q;
    },
  },
});
for (const k of ['spear', 'axe', 'archer']) KIND['shang:' + k] = KIND[k];
for (const k of ['soldier', 'officer']) KIND['zhou:' + k] = KIND[k];
/** The table of a kind. side is 'zhou' or 'shang'; without it the first prototype's names are used. */
export const kindOf = (k, side) => KIND[`${side}:${k}`] || KIND[k];
const runLegs = (ph, amp) => { const leg = (p) => [-8 - amp * Math.sin(TAU * p), 10 + amp * 1.25 * Math.max(0, Math.sin(TAU * p + 2.3))]; const [lu, ll] = leg(ph), [ku, kl] = leg(ph + 0.5); return { lu, ll, ku, kl }; };

/**
 * A foot soldier's pose. kind: soldier | officer | spear | axe | archer; state and stateT from the simulation;
 * phase: 0..1 along the stride (the art advances it by distance moved); seed: a number that sets this one a little apart.
 */
export function footPose(kind, state, stateT, phase, seed = 0, o = {}) {
  const K = kindOf(kind, o.side), t = stepped(stateT), stand = { ...K.base, ...STANDLEGS }, tt = stepped(stateT + seed);
  const breath = Math.sin(tt * 1.7 + seed * 5), sway = Math.sin(tt * 1.1 + seed * 9);
  if (state !== 'dead') {
    // moments the art starts itself from events: a shield taking a blow, the captain's horn
    if (o.block != null && o.block < 0.34 && K.block) return mix(stand, K.block, o.block < 0.24 ? out(o.block / 0.05) : 1 - inout((o.block - 0.24) / 0.1));
    if (K.horn && (state === 'horn' || (o.horn != null && o.horn < 1.1))) { const ht = state === 'horn' ? t : stepped(o.horn); return mix(stand, K.horn, ht < 0.9 ? out(ht / 0.14) : 1 - inout((ht - 0.9) / 0.2)); }
  }
  switch (state) {
    case 'walk': { const ph = Math.floor(phase * 12 + 1e-6) / 12, s2 = Math.sin(TAU * ph * 2);
      return { ...K.base, ...runLegs(ph, K.run), t: K.base.t + 2 * s2, h: K.base.h - 1.5 * s2, au: K.base.au + 3 * Math.sin(TAU * ph), $bob: -2.5 * Math.abs(Math.sin(TAU * ph)) }; }
    case 'windup': return K.slow ? mix(stand, K.windup, 0.72 * out(t / 0.2) + 0.28 * clamp(t / K.slow))                // a long telegraph: there at once, then it deepens
      : mix(stand, K.windup || K.attack, out(t / 0.14));                                                             // fast into the anticipation, then held
    case 'attack': return t < 0.2 ? mix(K.windup || stand, K.attack, out(t / 0.07)) : mix(K.attack, stand, inout((t - 0.2) / 0.18));
    case 'brace': return mix(stand, K.brace || stand, out(t / 0.3));
    case 'block': return mix(stand, K.block || stand, out(t / 0.05));
    case 'volley': return mix(stand, K.volley || K.draw || stand, out(t / 0.16));                                  // for the review sheet; in play it is `draw` after a `volley` event
    case 'draw': return mix(stand, (o.volley && K.volley) || K.draw || stand, t < 0.16 ? out(t / 0.16) * 0.8 : 0.8 + 0.2 * inout((t - 0.16) / 0.5));   // up at once, then the last of the pull
    case 'stun': { const p = mix(stand, K.stun, out(t / 0.1)); p.t += 3 * Math.sin(tt * 14) * Math.exp(-t * 3); return p; }
    case 'dead': { if (K.death) return K.death(t, stand);
      const fall = out(t / 0.36), p = mix(K.stun, { ...K.stun, t: K.stun.t - 62, h: 30, lu: -40, ll: 20, ku: -10, kl: 40 }, fall);   // the rods are let go
      p.$fall = fall; p.$fade = t < 0.8 ? 1 : clamp(1 - (t - 0.8) / 0.4); return p; }
    default: return { ...stand, t: stand.t + 1.2 * breath, h: stand.h - 1.2 * breath + 1.5 * sway, au: stand.au + 2 * sway };   // idle: breathing
  }
}

/* ------------------------------------------------------------------ the hero's fall
   Three beats, each a key that is reached fast and then held: the blow (thrown back off the saddle, the axe and the
   standard leaving his hands), the fall (in the air, clear of the horse; then the ground), the stillness.
   Every piece is rigid; only places and angles change. Times are the simulation's stateT in the state `fallen`. */
const FALL_HIDE = Object.fromEntries(['cape', 'torso', 'leg', 'armF', 'armU', 'armL', 'yue', 'head', 'plume', 'pole', 'm1', 'm2', 'm3'].map((id) => [id, true]));
// t: when the key starts; in: seconds to reach it; e: how far along the throw (0 the saddle .. 1 the place he lies);
// h: height, 1 the saddle .. 0 the ground; lift: extra height; rot: the whole figure, degrees, toward the throw
const RIDER_FALL = [
  { t: 0, in: 0, e: 0, h: 1, lift: 0, rot: 8, leg: -14, armU: -110, armL: -30, armF: -62, head: -4, cape: 6, plume: 0 },
  { t: 0.02, in: 0.08, e: 0.16, h: 1, lift: 18, rot: 54, leg: -44, armU: -158, armL: -14, armF: -150, head: 16, cape: -30, plume: -40 },   // the blow, held
  { t: 0.36, in: 0.1, e: 0.74, h: 0.86, lift: 14, rot: 124, leg: 24, armU: -176, armL: -6, armF: -128, head: -18, cape: -70, plume: -80 },   // in the air, held
  { t: 0.62, in: 0.05, e: 1, h: 0, lift: 0, rot: 98, leg: -52, armU: -150, armL: -40, armF: -156, head: -14, cape: 20, plume: 30 },          // the ground
  { t: 0.76, in: 0.14, e: 1, h: 0, lift: 0, rot: 90, leg: -2, armU: -172, armL: -8, armF: -178, head: -4, cape: 44, plume: 62 },             // still
];
// d: design units along the throw from the saddle; y: height of the pole's foot; rot toward the throw; m: the tail and ribbons; flag: the cloth (radians)
const STANDARD_FALL = [
  { t: 0, in: 0, d: 0, y: 1, lift: 30, rot: 8, m: 4, flag: 0 },
  { t: 0.04, in: 0.1, d: 26, y: 1, lift: 44, rot: 34, m: 40, flag: 0.5 },
  { t: 0.36, in: 0.12, d: 150, y: 0.5, lift: 30, rot: 66, m: 70, flag: 0.9 },
  { t: 0.66, in: 0.07, d: 214, y: 0, lift: 5, rot: 94, m: 30, flag: 0.3 },
  { t: 0.8, in: 0.12, d: 214, y: 0, lift: 3, rot: 91, m: 100, flag: 1.5 },
];
// the axe goes the other way (d away from the throw), turning over; it ends flat, the blade up
const AXE_FALL = [
  { t: 0, in: 0, d: 0, y: 1, lift: 40, rot: -76 },
  { t: 0.04, in: 0.1, d: 40, y: 1, lift: 76, rot: -150 },
  { t: 0.3, in: 0.12, d: 150, y: 0.7, lift: 40, rot: -262 },
  { t: 0.52, in: 0.06, d: 226, y: 0, lift: 4, rot: -366 },
  { t: 0.64, in: 0.1, d: 226, y: 0, lift: 3, rot: -352 },
];
const track = (keys, t) => { let i = 0; while (i + 1 < keys.length && keys[i + 1].t <= t) i++; const c = keys[i]; return i === 0 || c.in <= 0 ? { ...c } : mix(keys[i - 1], c, out((t - c.t) / c.in)); };
/** Where the pieces are at stateT in the fall. */
export function fallPose(stateT) { const t = stepped(Math.max(0, stateT)); return { rider: track(RIDER_FALL, t), standard: track(STANDARD_FALL, t), axe: track(AXE_FALL, t), landed: t >= 0.62, still: t >= 0.9, turn: t >= 1.0 }; }
