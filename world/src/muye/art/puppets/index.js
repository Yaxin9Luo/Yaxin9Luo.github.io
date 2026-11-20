// The puppets of the field game, as the sprite pipeline consumes them (the shape of lab/game-studies/field/field.js,
// made general): for every kind, a puppet definition, a scale, a box, and for every state a list of ready frames.
//
//   import { PUPPETS, createCutter } from './puppets/index.js';
//   const P = PUPPETS['shang:spear'];
//   P.scale                       // world pixels per design unit at game size (a foot figure comes out about 60 px tall)
//   P.box                         // [x0, y0, x1, y1] in design units round the ground point: every frame fits inside it
//   P.shadow                      // [rx, ry, strength] of the shadow to lay under it, in world pixels (null: none)
//   P.states                      // {walk: [frame x6], idle: [frame], windup: [...], attack: [...], hurt: [...], dead: [...], ...}
//   P.variants                    // names of the variants that change how it is cut (troop tiers, the hero's resonance): see `variant`
//
// A frame is a list of layers, `[{pup, pose, dx, dy, root, flip, alpha}]`: most frames have one layer. The cutter draws them:
//
//   const cut = createCutter(pxPerUnitOfWorld, {solid});         // pxPerUnitOfWorld = device pixels per world pixel (SS in field.js)
//   cut.draw(ctx, key, state, i, x, y, {variant});               // paints frame i with its ground point at device pixel (x, y), facing right
//   cut.count(key, state);                                       // how many frames
//
// So a pipeline loops over kinds, states and frames, calls `draw` into its sheet at (cell x - box[0] * k, cell y - box[1] * k)
// with k = P.scale * pxPerUnitOfWorld, and lays the shadow itself. Nothing here reads a clock: frames are fixed pictures.
// States follow the rules' names (walk, idle, windup = the warning, attack = the blow, dead); `hurt` is for the flash.
import { bake, drawPuppet, footDrop } from './engine.js';
import { C, hero as heroDef, horse, heroPieces, zhou, shang, boonMark, ELEMENT } from './base-figures.js';
import { KIND, footPose, heroPose, fallPose, STANDLEGS, mix } from './base-poses.js';
import { mass, bandExtras, strongman, car, zhouCar } from './figures.js';
import { soldier, standard, cloud, TROOP_ELEMENT, GROW } from './troops.js';
import { nezha, yangjian, hound, marten, leizhenzi, stormCloud, tuxingsun, mound, dengchanyu, huangfeihu, ox, mo, wenzhong, qilin } from './generals.js';

export * as engine from './engine.js';
export { C as PALETTE, ELEMENT };

// ------------------------------------------------------------------ sizes at game size (world pixels per design unit)
const FOOT = 0.54;
export const SIZE = { mass: FOOT, band: FOOT, shaman: FOOT * 1.12, strongman: FOOT * 1.9, crew: FOOT * 0.96, captain: FOOT * 1.75, leader: FOOT * 2.3, hero: 0.68, horse: 0.6, car: 0.8 };

// ------------------------------------------------------------------ pose tables for the kinds that are new here
const STUN = { t: -24, h: 16, au: -150, al: -30, bu: 140, bl: -40, w: -80, lu: -18, ll: 40, ku: 30, kl: 32 };
const SET = { lu: -28, ll: 18, ku: 26, kl: 8 }, LUNGE = { lu: -48, ll: 32, ku: 36, kl: 4 };
Object.assign(KIND, {
  'zhou:strongman': { scale: 1, stride: 80, run: 30, box: [-110, -160, 130, 60],
    base: { t: 7, h: -3, au: -22, al: -34, bu: 12, bl: -30, $hide: { rock: true } },
    windup: { t: -15, h: 8, au: -172, al: -8, bu: -150, bl: -24, rock: 0, ...SET, $hide: {} },                                       // THROW 1: the boulder up over his head
    attack: { t: 28, h: -8, au: -62, al: -8, bu: -36, bl: -22, ...LUNGE, $hide: { rock: true } },                                    // THROW 2: thrown
    stun: { ...STUN, $hide: { rock: true } } },
  'shang:shaman': { scale: 1, stride: 40, run: 12, box: [-120, -190, 140, 60],
    base: { t: 2, h: 0, au: -44, al: -52, bu: -28, bl: -70, w: -84, drum: 0 },
    windup: { t: -9, h: -15, au: -152, al: -18, bu: -160, bl: -12, w: -104, drum: 0, lu: -10, ll: 8, ku: 10, kl: 4 },                // CHANT A
    attack: { t: 14, h: -6, au: -84, al: -6, bu: -40, bl: -60, w: -6, drum: 0, lu: -30, ll: 20, ku: 24, kl: 6 },                      // the curse thrown
    stun: { ...STUN, w: -150, drum: 0 } },
});
Object.assign(KIND, {
  'zhou:tigers': { scale: 1, stride: 64, run: 36, box: [-130, -190, 170, 70],                                                         // 虎贲: a great blade in both hands
    base: { t: 5, h: -3, au: -52, al: -44, bu: -70, bl: -24, w: -62, c: 6 },
    windup: { t: -8, h: 4, au: -158, al: -24, bu: -150, bl: -30, w: -128, c: 0, ...SET },
    attack: { t: 24, h: -8, au: -56, al: -8, bu: -40, bl: -30, w: 22, c: 18, ...LUNGE },
    stun: { ...STUN, c: -10 } },
  'zhou:acolytes': { scale: 1, stride: 52, run: 22, box: [-110, -170, 140, 70],                                                       // 道童: a talisman held up, then thrown
    base: { t: 2, h: -2, au: -74, al: -62, bu: -18, bl: -44, w: -84, wh: 34 },
    windup: { t: -9, h: -8, au: -164, al: -20, bu: -40, bl: -60, w: -150, wh: 10, lu: -14, ll: 10, ku: 14, kl: 4 },
    attack: { t: 14, h: -4, au: -78, al: -4, bu: 10, bl: -30, w: -8, wh: 60, lu: -34, ll: 22, ku: 26, kl: 6 },
    stun: { ...STUN, wh: 0 } },
});
const CHANT_B = { t: -3, h: -8, au: -126, al: -44, bu: -172, bl: 14, w: -80, drum: 0, lu: -10, ll: 8, ku: 10, kl: 4 };
const STOMP_UP = { t: -8, h: 4, au: -124, al: -62, bu: -118, bl: -64, lu: -84, ll: 96, ku: 8, kl: 4, $hide: { rock: true } };
const STOMP_DOWN = { t: 16, h: -8, au: 24, al: -24, bu: 34, bl: -22, lu: -18, ll: 6, ku: 34, kl: 22, $hide: { rock: true } };

// ------------------------------------------------------------------ every puppet that is cut, by name
const band = (o, tier) => () => { const d = zhou({ ...o, rank: tier >= 3, helm: tier >= 5 ? 2 : o.helm }); return { parts: [...d.parts, ...bandExtras(tier)], feet: d.feet }; };
const BAND = { shield: { weapon: 'sword', shield: 'tall', helm: 1 }, spear: { weapon: 'ge', helm: 0 }, archer: { weapon: 'bow', hand: 'bl', helm: 3, thin: true } };
const heroCut = (res = []) => () => {                                                 // res: the elements in resonance, in the order gained
  const d = heroDef(), slots = ['m2', 'm3', 'plume'], re = {}; res.slice(0, 3).forEach((el, i) => { re[slots[i]] = boonMark(slots[i], el).parts[0].draw; });
  const flame = (id, len) => ({ id: 'fl_' + id, parent: id, at: [0, len * 1.22 * 0.8], z: 3.5, rot: 0, world: false, draw: (g) => g.body([[2, -3], [-10, -9], [-30, -20, 1], [-18, -4], [-36, 2, 1], [-16, 6], [-24, 16, 1], [-4, 6]], C.red, { line: 0.9 }) });
  return { parts: [...d.parts.map((p) => (re[p.id] ? { ...p, draw: re[p.id] } : p)), flame('fL', 35), flame('fL2', 35), flame('hL', 39), flame('hL2', 39)], feet: d.feet };
};
const off = heroPieces();
const DEFS = {
  'mass:spear': () => mass('spear'), 'mass:axe': () => mass('axe'), 'mass:shield': () => mass('shield'), 'mass:archer': () => mass('archer'), 'mass:shaman': () => mass('shaman'),
  strongman, car, cloud,
  'crew:driver': () => shang({ helm: 1 }), 'crew:axe': () => shang({ weapon: 'yue', long: true, helm: 2 }),
  'horse:shang': () => horse({ coat: C.zhong, mane: C.lacquer }),
  captain: () => shang({ weapon: 'yue', long: true, helm: 2, standard: true, horn: true }),
  leader: () => shang({ weapon: 'yue', long: true, helm: 2, standard: true, horn: true, shield: 'mask', shieldHand: 'bl', shieldZ: 29 }),
  'hero.rider': () => off.rider, 'hero.standard': () => off.standard, 'hero.axe': () => off.axe,
};
for (const k in BAND) for (const tier of [1, 3, 5]) DEFS[`band:${k}:${tier}`] = band(BAND[k], tier);
// the troops of section 6, five ranks each
const TROOP_KINDS = ['shields', 'spears', 'archers', 'strongmen', 'chariots', 'tigers', 'acolytes', 'hooks'], RANKS = [1, 2, 3, 4, 5];
for (const r of RANKS) { for (const k of ['shields', 'spears', 'archers', 'tigers', 'acolytes', 'hooks']) DEFS[`troop:${k}:${r}`] = () => soldier(k, r);
  DEFS[`troop:strongmen:${r}`] = () => strongman(r); DEFS[`zhoucar:${r}`] = () => zhouCar(r); DEFS[`horse:zhou:${r}`] = () => horse({ coat: r >= 4 ? C.qing : C.dan, mane: r === 5 ? C.gold : C.nong });
  for (const el of ['fire', 'water', 'wood', 'metal', 'earth']) DEFS[`standard:${r}:${el}`] = () => standard(r, el); }
const _unused = null;
const variantDef = (pup, variant) => (pup === 'hero' ? heroCut(variant && !/^[1-5]/.test(variant) ? variant.split('+') : []) : DEFS[pup]);

// ------------------------------------------------------------------ frames
const one = (pup, pose, o = {}) => [{ pup, pose, ...o }];
const foot = (pup, kind, side, list) => { const st = {}; for (const [name, frames] of Object.entries(list)) st[name] = frames.map((f) => (Array.isArray(f) ? one(pup, footPose(kind, f[0], f[1], f[2] || 0, 0.3, { side })) : one(pup, f))); return st; };
const WALK6 = Array.from({ length: 6 }, (_, i) => ['walk', 0.3, i / 6]);
const stand = (key) => ({ ...KIND[key].base, ...STANDLEGS });
// the hero: what streams is set by hand per frame (the first game moved it with springs; a sprite has no clock)
const REST = { tail: -4, cape: 6, plume: 0, mane1: 0, mane2: 0, mane3: 0, s1: 0, m1: 4, m2: 4, m3: 4 };
const FLAT = { tail: 10, cape: 16, plume: -30, mane1: 14, mane2: 24, mane3: 34, s1: 22, m1: 12, m2: 12, m3: 12 };                    // degrees toward straight back, in full cry
const NOFLAME = { fl_fL: true, fl_fL2: true, fl_hL: true, fl_hL2: true };
const riding = (o, phase, cry, sway = phase) => {
  const base = heroPose({ x: 0, y: 0, vx: 320, vy: 0, facing: 1, state: 'ride', stateT: 1, hold: 0, fullCry: cry, boons: [], topSpeed: 520, ...o }, { gait: 'gallop', phase, t: 0 }, 0), p = { ...base };
  for (const id in REST) p[id] = REST[id] + (cry ? FLAT[id] : 0) + (cry ? 2.5 : 5) * Math.sin(Math.PI * 2 * (sway * 2 + id.length * 0.13));
  p.torso = base.$torso; p.head = base.$head; p.$hide = { ...(base.$hide || {}), ...(cry ? {} : NOFLAME) }; return p;
};
const standing = () => { const base = heroPose({ x: 0, y: 0, vx: 0, vy: 0, facing: 1, state: 'ride', stateT: 1, hold: 0, boons: [], topSpeed: 520 }, { gait: 'stand', phase: 0, t: 0 }, 0), p = { ...base, torso: base.$torso, head: base.$head, $hide: NOFLAME };
  for (const id in REST) p[id] = REST[id] - (id === 'plume' ? 0 : id.startsWith('mane') ? 22 : 40); return p; };                     // at a stand everything hangs
function fallFrames() {                                                               // the fall of the first game, as five pictures: the blow, the air, the ground, still, the horse turned to him
  const SEAT = 178, LIE = 13;
  return [0.2, 0.5, 0.66, 0.9, 1.6].map((t) => { const F = fallPose(t), R = F.rider, St = F.standard, A = F.axe;
    const hp = heroPose({ x: 0, y: 0, vx: 0, vy: 0, facing: 1, state: 'fallen', stateT: t, hold: 0, boons: [], topSpeed: 520 }, { gait: 'stand', phase: 0, t: 0 }, 0);
    const horseP = { ...hp, $hide: { ...hp.$hide, ...NOFLAME } }; for (const id of ['tail', 'mane1', 'mane2', 'mane3', 's1']) horseP[id] = REST[id] - (t > 0.6 ? 30 : 0);
    return [{ pup: 'hero.standard', pose: { pole: -St.rot, m1: St.m, m2: St.m * 0.9, m3: St.m * 1.1 }, root: [-St.d, -(SEAT * St.y + St.lift)], k: 1 },
      { pup: 'hero', pose: horseP, flip: F.turn ? -1 : 1 },
      { pup: 'hero.axe', pose: { yue: A.rot }, root: [A.d, -(SEAT * A.y + A.lift)], k: 1 },
      { pup: 'hero.rider', pose: { torso: -R.rot, leg: R.leg, armU: R.armU, armL: R.armL, armF: R.armF, head: R.head, plume: R.plume, cape: R.cape }, root: [-150 * R.e, -(LIE + (SEAT - LIE) * R.h + R.lift)], k: 1 }]; });
}
// the chariot: far horse, near horse, crew, car. phase: the horses' stride; the wheel turns with it.
const horsePose = (phase, state = 'ride', t = 1) => { const hp = heroPose({ x: 0, y: 0, vx: state === 'ride' ? 320 : 0, vy: 0, facing: 1, state, stateT: t, hold: 0, boons: [], topSpeed: 520 }, { gait: state === 'ride' ? 'gallop' : 'stand', phase, t: 0 }, 0);
  const hide = Object.fromEntries(['cape', 'torso', 'leg', 'armF', 'armU', 'armL', 'yue', 'head', 'plume', 'pole', 'm1', 'm2', 'm3'].map((id) => [id, true])); return { ...hp, $hide: hide }; };
const CS = SIZE.crew / SIZE.car, HS = SIZE.horse / SIZE.car;                          // layers of other sizes inside the chariot's frame
const chariotRun = Array.from({ length: 6 }, (_, i) => [
  { pup: 'horse:shang', pose: horsePose((i / 6 + 0.45) % 1), dx: 176, dy: -8, k: HS, alpha: 0.9 }, { pup: 'horse:shang', pose: horsePose(i / 6), dx: 154, dy: 0, k: HS },
  { pup: 'crew:driver', pose: { ...footPose('axe', 'idle', 0.4, 0, 0.3, { side: 'shang' }), t: 10, au: -70, al: -30, bu: -76, bl: -24 }, dx: 24, dy: -28, k: CS },
  { pup: 'crew:axe', pose: footPose('axe', 'windup', 0.4, 0, 0.3, { side: 'shang' }), dx: -18, dy: -28, k: CS },
  { pup: 'car', pose: { wheel: i * 15 } },
]);
const chariotWreck = [
  [{ pup: 'horse:shang', pose: horsePose(0, 'stopped', 0.2), dx: 176, dy: -8, k: HS, alpha: 0.9 }, { pup: 'horse:shang', pose: horsePose(0, 'stopped', 0.25), dx: 154, dy: 0, k: HS },
    { pup: 'crew:driver', pose: footPose('axe', 'stun', 0.2, 0, 0.3, { side: 'shang' }), dx: 34, dy: -22, k: CS }, { pup: 'crew:axe', pose: footPose('axe', 'stun', 0.2, 0, 0.5, { side: 'shang' }), dx: -14, dy: -16, k: CS },
    { pup: 'car', pose: { box: -14, wheel: 40 } }],
  [{ pup: 'horse:shang', pose: horsePose(0.3), dx: 250, dy: 0, k: HS },
    { pup: 'crew:driver', pose: footPose('axe', 'dead', 0.3, 0, 0.3, { side: 'shang' }), dx: 96, dy: -20, k: CS }, { pup: 'crew:axe', pose: footPose('axe', 'stun', 0.3, 0, 0.5, { side: 'shang' }), dx: 30, dy: -20, k: CS },
    { pup: 'car', pose: { box: -50, wheel: 70 }, dy: -10 }],
  [{ pup: 'crew:driver', pose: footPose('axe', 'dead', 0.7, 0, 0.3, { side: 'shang' }), dx: 120, dy: 0, k: CS }, { pup: 'crew:axe', pose: footPose('axe', 'dead', 0.7, 0, 0.5, { side: 'shang' }), dx: 56, dy: 0, k: CS },
    { pup: 'car', pose: { box: -92, wheel: 95 }, dy: -34 }],
];
const boss = (pup) => { const K = KIND['shang:captain'], st = stand('shang:captain'), f = (s, t, ph) => one(pup, footPose('captain', s, t, ph || 0, 0.3, { side: 'shang' }));
  const leader = pup === 'leader', withS = (frames) => (leader ? frames.map((fr) => fr.map((l) => ({ ...l, pose: { s: 0, ...l.pose } }))) : frames);
  return {
    walk: withS(WALK6.map(([s, t, ph]) => f(s, t, ph))), idle: withS([f('idle', 0.4)]),
    windup: withS([f('windup', 0.2), f('windup', 0.95)]), attack: withS([f('attack', 0.1)]),                                         // the wide sweep: gathered (two depths), then the blow
    windup2: withS(leader ? [one(pup, { ...st, t: 24, h: -12, au: -64, al: -10, bu: -70, bl: -10, w: 8, lu: -66, ll: 72, ku: 46, kl: 10 })] : [f('horn', 0.5)]),   // leader: set for the charge; captain: the horn that calls the volley
    attack2: withS(leader ? [one(pup, { ...K.attack, t: 36, w: 4, au: -80, al: -4, lu: -62, ll: 30, ku: 50, kl: 2 })] : [one(pup, { ...st, t: 8, h: -6, au: -96, al: -4, bu: -30, bl: -40, w: -96 })]),   // the charge itself; the arm thrown forward: loose!
    hurt: withS([f('stun', 0.15)]), dead: withS([f('dead', 0.12), f('dead', 0.34), f('dead', 0.56), f('dead', 0.8)]),
  }; };

const massStates = (kind) => foot('mass:' + kind, kind, 'shang', { walk: WALK6, idle: [['idle', 0.4]], windup: [[kind === 'archer' ? 'draw' : kind === 'spear' ? 'brace' : 'windup', 0.5]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.7]] });
const bandStates = (k, tier) => foot(`band:${k}:${tier}`, k, 'zhou', { walk: WALK6, idle: [['idle', 0.4]], windup: [[k === 'archer' ? 'draw' : 'windup', 0.4]], attack: [['attack', 0.1]], ...(k === 'shield' ? { block: [['block', 0.2]] } : {}), hurt: [['stun', 0.15]], dead: [['dead', 0.7]] });

const SH = (rx, ry, a) => [rx, ry, a];
export const PUPPETS = {
  hero: { side: 'zhou', scale: SIZE.hero, box: [-520, -560, 400, 110], shadow: SH(46, 11, 0.5), variants: 'resonance: "" or elements joined by "+", for example "fire" or "water+metal" (up to three; they recolour the standard\'s two ribbons and the plume)',
    states: { gallop: Array.from({ length: 12 }, (_, i) => one('hero', riding({}, i / 12, false))), cry: Array.from({ length: 12 }, (_, i) => one('hero', riding({}, i / 12, true))),
      stand: [one('hero', standing())], spring: [0.12, 0.62].map((ph) => one('hero', riding({ state: 'dash', stateT: 0.3, vx: 520 }, ph, true))),
      hurt: [one('hero', riding({ state: 'hurt', stateT: 0.04 }, 0.3, false))], fall: fallFrames() } },
  'shang:spear': { side: 'shang', scale: SIZE.mass, box: [-190, -170, 210, 60], shadow: SH(19, 5.5, 0.3), states: massStates('spear') },
  'shang:axe': { side: 'shang', scale: SIZE.mass * 1.08, box: [-160, -190, 160, 60], shadow: SH(20, 5.5, 0.3), states: massStates('axe') },
  'shang:shield': { side: 'shang', scale: SIZE.mass * 1.04, box: [-170, -180, 150, 60], shadow: SH(21, 5.5, 0.3), states: massStates('shield') },
  'shang:archer': { side: 'shang', scale: SIZE.mass * 0.96, box: [-150, -180, 150, 60], shadow: SH(18, 5.5, 0.3), states: massStates('archer') },
  'shang:shaman': { side: 'shang', scale: SIZE.shaman, box: [-130, -210, 150, 60], shadow: SH(22, 6, 0.3),
    states: { ...foot('mass:shaman', 'shaman', 'shang', { walk: WALK6, idle: [['idle', 0.4]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.7]] }),
      chant: [one('mass:shaman', { ...stand('shang:shaman'), ...KIND['shang:shaman'].windup }), one('mass:shaman', { ...stand('shang:shaman'), ...CHANT_B })], windup: [one('mass:shaman', { ...stand('shang:shaman'), ...KIND['shang:shaman'].windup })] } },
  'shang:chariot': { side: 'shang', scale: SIZE.car, box: [-200, -200, 330, 50], shadow: SH(150, 13, 0.3), states: { run: chariotRun, wreck: chariotWreck } },
  'shang:captain': { side: 'shang', scale: SIZE.captain, box: [-200, -220, 200, 60], shadow: SH(40, 9, 0.35), states: boss('captain') },
  'shang:leader': { side: 'shang', scale: SIZE.leader, box: [-200, -220, 200, 60], shadow: SH(54, 12, 0.35), states: boss('leader') },
  'zhou:strongman': { side: 'zhou', scale: SIZE.strongman, box: [-110, -170, 130, 60], shadow: SH(36, 9, 0.5),
    states: { ...foot('strongman', 'strongman', 'zhou', { walk: WALK6, idle: [['idle', 0.4]], hurt: [['stun', 0.15]], dead: [['dead', 0.7]] }),
      'throw': [one('strongman', { ...stand('zhou:strongman'), ...KIND['zhou:strongman'].windup }), one('strongman', { ...stand('zhou:strongman'), ...KIND['zhou:strongman'].attack })],
      stomp: [one('strongman', { ...stand('zhou:strongman'), ...STOMP_UP }), one('strongman', { ...stand('zhou:strongman'), ...STOMP_DOWN })],
      windup: [one('strongman', { ...stand('zhou:strongman'), ...KIND['zhou:strongman'].windup })], attack: [one('strongman', { ...stand('zhou:strongman'), ...KIND['zhou:strongman'].attack })] } },
};
for (const k in BAND) { const states = {}; for (const tier of [1, 3, 5]) states[tier] = bandStates(k, tier);
  PUPPETS['zhou:' + k] = { side: 'zhou', scale: SIZE.band * (k === 'shield' ? 0.94 : k === 'spear' ? 0.92 : 0.88), box: [-140, -200, 210, 70], shadow: SH(18, 5.5, 0.5), variants: 'tier: "1", "3" or "5" (levels 1-2, 3-4, 5-6): 3 adds bronze cap, shoulders and finial, 5 adds a tall crest', tiers: states, states: states[1] }; }
// ---- the troops (section 6.1, 6.2): `zhou:<id>`, tiers "1".."5" are the ranks
const TABLE = { shields: 'shield', spears: 'spear', archers: 'archer', tigers: 'tigers', acolytes: 'acolytes', hooks: 'spear', strongmen: 'strongman' };
const troopStates = (id, r) => { const pup = `troop:${id}:${r}`, k = TABLE[id], g = GROW[r - 1];
  const st = foot(pup, k, 'zhou', { walk: WALK6, idle: [['idle', 0.4]], windup: [[k === 'archer' ? 'draw' : 'windup', 0.4]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.7]] });
  // the squad skill of the kind (6.1), as poses: the pipeline plays them in order; the effects paint the force
  const P1 = (pose, o) => one(pup, pose, o), K = KIND[`zhou:${k}`] || KIND[k], sd = { ...K.base, ...STANDLEGS }, f1 = (s2, t2, ph) => footPose(k, s2, t2, ph || 0, 0.3, { side: 'zhou' });
  if (id === 'shields') st.wall = [P1(f1('block', 0.2)), P1({ ...f1('block', 0.2), t: 24, bu: -84, bl: 2, s: 6, lu: -50, ll: 34, ku: 40, kl: 4 })];                       // 盾墙: locked, then the shove
  if (id === 'spears') st.thrust = [P1(f1('brace', 0.5)), P1({ ...f1('brace', 0.5), t: 30, au: -84, al: -4, bu: -30, bl: -60, wb: 0, ...LUNGE })];                      // 攒刺: levelled, then all points out
  if (id === 'archers') st.volley = [P1(f1('volley', 0.5)), P1({ ...f1('attack', 0.1), t: -16, w: -54, bu: -158 })];                                                // 箭雨: aimed high, loosed
  if (id === 'strongmen') st.hurl = [P1({ ...sd, ...K.windup }), P1({ ...sd, ...K.attack })];                                                                       // 掷石: the boulder up, thrown
  if (id === 'tigers') st.leap = [P1({ ...sd, t: 22, h: -8, au: -40, al: -60, bu: -60, bl: -40, w: -30, lu: -70, ll: 86, ku: -40, kl: 90 }),                          // 虎跃: crouched; in the air, the blade back over the head; the landing blow
    P1({ ...sd, t: -12, h: 10, au: -168, al: -10, bu: -160, bl: -14, w: -140, lu: -50, ll: 80, ku: 30, kl: 50, c: -30 }, { dy: -58 }), P1({ ...sd, ...K.attack, t: 34, w: 40, lu: -66, ll: 70, ku: 44, kl: 6 })];
  if (id === 'acolytes') st.cast = [P1({ ...sd, ...K.windup }), P1({ ...sd, ...K.attack })];                                                                          // 符法: the talisman up, thrown
  if (id === 'hooks') st.cast = [P1({ ...sd, t: -12, h: 6, au: 40, al: -90, bu: -70, bl: -40, w: 150, ...SET, $hide: { wb: true } }), P1({ ...f1('brace', 0.5), t: 26, au: -80, al: -4, wb: -4, ...LUNGE }),   // 挠钩: swung back, cast far, hauled in
    P1({ ...sd, t: -10, h: 4, au: -20, al: -100, bu: -40, bl: -80, w: -14, ...SET, $hide: { wb: true } })];
  // rank 5 stands on a cloud scroll (a layer under the man), not on the ground
  for (const name in st) st[name] = st[name].map((fr) => [...(r === 5 && name !== 'dead' ? [{ pup: 'cloud', pose: {}, k: g * (id === 'strongmen' ? 0.62 : 1), dy: 3 }] : []), ...fr.map((l) => ({ ...l, k: g, ...(r === 5 && name !== 'dead' ? { dy: -5 } : {}) }))]); return st; };
const ZH = 0.6 / 0.8, zhouChariot = (r) => { const crew = (kind, state, dx) => ({ pup: `troop:${kind}:${r}`, pose: footPose(TABLE[kind], state, 0.4, 0, 0.3, { side: 'zhou' }), dx, dy: -24, k: (FOOT * GROW[r - 1]) / 0.8 });
  const frame = (i, n) => [...(r >= 2 ? [{ pup: `horse:zhou:${r}`, pose: horsePose((i / n + 0.45) % 1), dx: 168, dy: -8, k: ZH, alpha: 0.9 }] : []), { pup: `horse:zhou:${r}`, pose: horsePose(i / n), dx: 146, dy: 0, k: ZH },
    crew('spears', 'idle', 22), crew('archers', r >= 2 ? 'draw' : 'idle', -16), { pup: `zhoucar:${r}`, pose: { wheel: i * 15 } }];
  // 冲阵: the charge is the same gallop with the crew set for it (the spearman's long piece levelled, the archer drawn)
  const charge = (i) => frame(i, 6).map((l) => (l.pup === `troop:spears:${r}` ? { ...l, pose: { ...footPose('spear', 'brace', 0.5, 0, 0.3, { side: 'zhou' }), lu: -6, ll: 6, ku: 8, kl: 4 } } : l));
  // the wreck (the renderer plays it when a chariot dies): the team checks, the car tips back, the crew go down
  const H = `horse:zhou:${r}`, C2 = `zhoucar:${r}`, down = (kind, state, t, dx, dy) => ({ ...crew(kind, 'idle', dx), pose: footPose(TABLE[kind], state, t, 0, 0.4, { side: 'zhou' }), dy });
  const wreck = [[{ pup: H, pose: horsePose(0, 'stopped', 0.2), dx: 146, dy: 0, k: ZH }, down('spears', 'stun', 0.2, 30, -20), down('archers', 'stun', 0.2, -12, -16), { pup: C2, pose: { box: -14, wheel: 40 } }],
    [{ pup: H, pose: horsePose(0.3), dx: 236, dy: 0, k: ZH }, down('spears', 'dead', 0.3, 92, -18), down('archers', 'stun', 0.3, 28, -18), { pup: C2, pose: { box: -50, wheel: 70 }, dy: -10 }],
    [{ pup: H, pose: horsePose(0.6), dx: 330, dy: 0, k: ZH, alpha: 0.6 }, down('spears', 'dead', 0.9, 110, -2), down('archers', 'dead', 0.7, 44, -4), { pup: C2, pose: { box: -76, wheel: 90 }, dy: -14 }]];
  return { run: Array.from({ length: 6 }, (_, i) => frame(i, 6)), idle: [frame(1, 6)], charge: Array.from({ length: 6 }, (_, i) => charge(i)), wreck }; };
for (const id of TROOP_KINDS) { const tiers = {}; for (const r of RANKS) tiers[r] = id === 'chariots' ? zhouChariot(r) : troopStates(id, r);
  PUPPETS['zhou:' + id] = { side: 'zhou', element: TROOP_ELEMENT[id], scale: id === 'strongmen' ? SIZE.strongman : id === 'chariots' ? 0.8 : FOOT, box: id === 'chariots' ? [-200, -300, 330, 50] : id === 'strongmen' ? [-150, -230, 160, 60] : [-200, -260, 260, 70],
    shadow: id === 'chariots' ? SH(140, 12, 0.5) : id === 'strongmen' ? SH(36, 9, 0.5) : SH(18, 5.5, 0.5), noShadow: id === 'chariots' ? [] : ['5'], variants: 'rank: "1".."5" (卒, 锐士, 甲士, 玄甲, 神兵); a rank in noShadow stands on its own cloud and takes no shadow', tiers, states: tiers[1] }; }
// the squad's standard-bearer: tiers "2", "3", and "4:<element>", "5:<element>"
{ const tiers = {}, st = (r, el) => { const o = foot(`standard:${r}:${el}`, 'spear', 'zhou', { walk: WALK6, idle: [['idle', 0.4]], hurt: [['stun', 0.15]], dead: [['dead', 0.7]] }); for (const n in o) o[n] = o[n].map((fr) => fr.map((l) => ({ ...l, pose: { ...l.pose, w: -80, $hide: {} }, k: GROW[r - 1] }))); return o; };
  tiers['2'] = st(2, 'fire'); tiers['3'] = st(3, 'fire'); for (const el of ['fire', 'water', 'wood', 'metal', 'earth']) { tiers['4:' + el] = st(4, el); tiers['5:' + el] = st(5, el); }
  PUPPETS['zhou:standard'] = { side: 'zhou', scale: FOOT, box: [-170, -260, 230, 70], shadow: SH(18, 5.5, 0.5), variants: 'the squad\'s standard: "2", "3", "4:<element>", "5:<element>"', tiers, states: tiers['2'] }; }
// ---- generals (6.3) and named foes (6.4)
Object.assign(KIND, {
  'zhou:thrower': { scale: 1, stride: 60, run: 30, box: [-120, -180, 150, 70],                                                         // 邓婵玉: the stone is thrown with a turn of the hand
    base: { t: 3, h: -3, au: -30, al: -70, bu: -60, bl: -30, w: -60, stone: 0 },
    windup: { t: -12, h: 8, au: 60, al: -70, bu: -70, bl: -20, w: -40, stone: 0, ...SET },
    attack: { t: 18, h: -6, au: -88, al: -4, bu: 20, bl: -40, w: 40, stone: 0, ...LUNGE }, stun: { ...STUN } },
  'shang:king': { scale: 1, stride: 70, run: 18, box: [-170, -230, 190, 70],                                                           // a Mo brother: slow, huge
    base: { t: 4, h: -3, au: -50, al: -50, bu: -30, bl: -60, w: -74, marten: -20, pipa: -150 },
    windup: { t: -14, h: 8, au: -160, al: -16, bu: -120, bl: -40, w: -112, marten: -70, pipa: -120, ...SET },
    attack: { t: 24, h: -8, au: -70, al: -6, bu: -20, bl: -50, w: -4, marten: 10, pipa: -170, ...LUNGE }, stun: { ...STUN, pipa: -150 } },
});
{ const GEN = FOOT * 1.45, DEF = (name, fn) => { DEFS[name] = fn; };
  DEF('nezha', () => nezha(false)); DEF('nezha!', () => nezha(true)); DEF('yangjian', () => yangjian(false)); DEF('yangjian!', () => yangjian(true)); DEF('hound', () => hound(false)); DEF('hound.ink', () => hound(true));
  DEF('leizhenzi', () => leizhenzi(false)); DEF('leizhenzi!', () => leizhenzi(true)); DEF('storm', stormCloud); DEF('tuxingsun', () => tuxingsun(false)); DEF('tuxingsun!', () => tuxingsun(true)); DEF('mound', () => mound(false)); DEF('mound!', () => mound(true));
  DEF('dengchanyu', () => dengchanyu(false)); DEF('dengchanyu!', () => dengchanyu(true)); DEF('huangfeihu', () => huangfeihu(false)); DEF('huangfeihu!', () => huangfeihu(true)); DEF('ox', () => ox(false)); DEF('ox!', () => ox(true));
  for (const w of ['qing', 'hong', 'hai', 'shou']) DEF('mo:' + w, () => mo(w)); DEF('wenzhong', wenzhong); DEF('qilin', qilin);
  const fp = (table, side, s, t, ph) => footPose(table, s, t, ph || 0, 0.3, { side });
  const basic = (pup, table, side, more = (p) => p) => { const f = (s, t, ph) => one(pup, more(fp(table, side, s, t, ph), s, ph || 0)); return { walk: WALK6.map(([s, t, ph]) => f(s, t, ph)), idle: [f('idle', 0.4)], windup: [f('windup', 0.4)], attack: [f('attack', 0.1)], hurt: [f('stun', 0.15)] }; };
  const each = (st, fn) => { const o = {}; for (const n in st) o[n] = st[n].map((fr, i) => fn(fr, n, i)); return o; };
  const withSkill = (st) => ({ ...st, skill: st.skill || [...(st.rise || st.windup), ...st.attack] });                            // `skill`: the gathering pose, then the blow (the contract's state for a general's skill)
  const two = (id, make0, extra = {}) => { const make = (T) => withSkill(make0(T)); PUPPETS['zhou:' + id] = { id, side: 'zhou', general: true, scale: GEN, box: [-260, -330, 280, 80], shadow: SH(26, 7, 0.5), variants: '"1" the general, "true" his true form (显圣)', ...extra, tiers: { 1: make(false), true: make(true) }, states: make(false) }; };
  // 哪吒: he does not walk, he rides the wheels: the legs stay set, the wheels turn
  two('nezha', (T) => each(basic(T ? 'nezha!' : 'nezha', 'spear', 'zhou', (p, s, ph) => ({ ...p, lu: -16, ll: 12, ku: 18, kl: 6, $bob: 0, ring: 0, wheel0: ph * 360, wheel1: ph * 360 + 40, sash: s === 'attack' ? 14 : 0 })), (fr) => fr.map((l) => ({ ...l, k: T ? 1.25 : 1 }))));
  // 杨戬 and the hound beside him; in the true form three ink hounds run with it
  { const dog = (i, ink, dx, dy, k) => ({ pup: ink ? 'hound.ink' : 'hound', pose: { fU: -8 + (i % 2 ? 26 : -22), fU2: 14 + (i % 2 ? -30 : 20), hU: 10 + (i % 2 ? -26 : 22), hU2: -16 + (i % 2 ? 30 : -18) }, dx, dy, k });
    two('yangjian', (T) => each(basic(T ? 'yangjian!' : 'yangjian', 'spear', 'zhou'), (fr, n, i) => [...(T ? [dog(i + 1, true, 150, -8, 0.9), dog(i, true, -84, -10, 0.8)] : []), ...fr.map((l) => ({ ...l, k: T ? 1.15 : 1 })), dog(i, false, 86, 0, 0.95), ...(T ? [dog(i + 1, true, 30, 4, 1)] : [])])); }
  // 雷震子 flies: every layer is lifted; the wings beat between two angles; the true form brings its storm
  two('leizhenzi', (T) => each(basic(T ? 'leizhenzi!' : 'leizhenzi', 'tigers', 'zhou', (p, s, ph) => ({ ...p, lu: -30, ll: 50, ku: 20, kl: 40, $bob: 0, wingA: Math.floor(ph * 6) % 2 ? 10 : -22, wingB: Math.floor(ph * 6) % 2 ? 30 : -4 })), (fr) => [...(T ? [{ pup: 'storm', pose: {}, root: [10, -250] }] : []), ...fr.map((l) => ({ ...l, dy: -64, k: T ? 1.12 : 1 }))]), { shadow: SH(30, 7, 0.4) });
  // 土行孙: `windup` is only the ground stirring (he is under it), `attack` is him risen from it
  two('tuxingsun', (T) => { const pup = T ? 'tuxingsun!' : 'tuxingsun', m = { pup: T ? 'mound!' : 'mound', pose: {}, dx: 0, dy: 2 }, b = basic(pup, 'spear', 'zhou'); return { ...b, windup: [[m]], attack: [[{ ...b.windup[0][0], dy: 20 }, m], [...b.attack[0]]], rise: [[m], [{ ...b.windup[0][0], dy: 20 }, m]] }; }, { scale: FOOT * 1.12 });
  two('dengchanyu', (T) => basic(T ? 'dengchanyu!' : 'dengchanyu', 'thrower', 'zhou'), { scale: FOOT * 1.36 });
  // 黄飞虎 on the five-coloured ox
  two('huangfeihu', (T) => { const R = T ? 'huangfeihu!' : 'huangfeihu', O = T ? 'ox!' : 'ox', sit = { lu: -74, ll: 78, ku: -62, kl: 72, $bob: 0 }, kr = GEN / 0.8;
    const fr = (ox, rs, rt) => [{ pup: O, pose: ox }, { pup: R, pose: { ...fp('spear', 'zhou', rs, rt), ...sit }, dx: 6, dy: -58, k: kr }];
    return { walk: Array.from({ length: 6 }, (_, i) => fr(horsePose(i / 6), 'idle', 0.4)), idle: [fr(horsePose(0, 'idle'), 'idle', 0.4)], windup: [fr(horsePose(0.1), 'windup', 0.4)], attack: [fr(horsePose(0.6), 'attack', 0.1)], hurt: [fr(horsePose(0, 'stopped', 0.2), 'stun', 0.15)] }; }, { scale: 0.8, box: [-220, -300, 300, 60], shadow: SH(70, 11, 0.5) });
  // the four Mo brothers: one of them is the 5:00 foe
  // Each has his own height and stance: 青 the tallest, upright, the sword held high; 红 squat and planted wide, leaning back under the umbrella;
  // 海 swayed back on the rear leg; 寿 the shortest, hunched forward over bent knees.
  const MO = { qing: [1.14, { t: -3, au: -34, al: -10 }], hong: [0.98, { t: -9, h: 4, lu: -17, ll: 15, ku: 17, kl: -13, au: -30 }], hai: [1.04, { t: -14, h: 8, lu: -24, ll: 20, ku: 6 }], shou: [0.9, { t: 17, h: -12, lu: -16, ll: 26, ku: 8, kl: 14, bu: -24 }] };
  for (const w of ['qing', 'hong', 'hai', 'shou']) { const [tall, lean] = MO[w], pose = (p) => { const q = { ...p }; for (const k in lean) q[k] = (q[k] || 0) + lean[k]; return q; };
    const b = basic('mo:' + w, 'king', 'shang', pose), K2 = KIND['shang:king'], st = { ...K2.base, ...STANDLEGS };
    PUPPETS['shang:moli' + w] = { side: 'shang', named: true, scale: FOOT * 2.3 * tall, box: [-200, -250, 230, 70].map((v) => Math.round(v * Math.max(1, tall))), shadow: SH(w === 'hong' ? 62 : 50, 12, 0.35),
      states: { ...b, windup: [one('mo:' + w, pose(mix(st, K2.windup, 0.55))), ...b.windup], dead: [0.15, 0.4, 0.62, 0.9].map((t) => one('mo:' + w, fp('king', 'shang', 'dead', t))) } }; }
  // 闻仲 on the black qilin, a golden whip in each hand
  { const sit = { lu: -74, ll: 78, ku: -62, kl: 72, $bob: 0 }, kr = (FOOT * 1.9) / 0.86, st = { ...KIND['zhou:tigers'].base, ...STANDLEGS };
    const arms = { idle: { au: -60, al: -50, bu: -40, bl: -70, w: -70, w2: -50 }, windup: { t: -14, h: 8, au: -165, al: -10, bu: -150, bl: -20, w: -120, w2: -100 }, attack: { t: 20, h: -6, au: -60, al: -6, bu: -40, bl: -10, w: 16, w2: 30 }, call: { t: -8, h: -12, au: -150, al: -30, bu: -30, bl: -60, w: -92, w2: -40 } };
    const fr = (q, a) => [{ pup: 'qilin', pose: q }, { pup: 'wenzhong', pose: { ...st, ...arms[a], ...sit }, dx: 4, dy: -92, k: kr }];
    PUPPETS['shang:wenzhong'] = { side: 'shang', named: true, scale: 0.86, box: [-300, -420, 330, 80], shadow: SH(80, 14, 0.35),
      states: { walk: Array.from({ length: 6 }, (_, i) => fr(horsePose(i / 6), 'idle')), idle: [fr(horsePose(0, 'idle'), 'idle')], windup: [fr(horsePose(0, 'stopped', 0.2), 'windup')], attack: [fr(horsePose(0.55), 'attack')],
        windup2: [fr(horsePose(0, 'idle'), 'call')], attack2: [fr(horsePose(0, 'stopped', 0.25), 'attack')],                         // 金遁: a whip pointed, and the golden wall stands (the wall itself is the effects')
        rush: Array.from({ length: 6 }, (_, i) => fr(horsePose(i / 6), i % 2 ? 'attack' : 'windup')), hurt: [fr(horsePose(0, 'stopped', 0.3), 'idle')],   // the qilin's rush
        dead: [fr(horsePose(0, 'stopped', 0.2), 'windup'), fr(horsePose(0, 'stopped', 0.34), 'idle'), fr(horsePose(0, 'idle'), 'idle').map((l) => (l.pup === 'wenzhong' ? { ...l, pose: { ...l.pose, t: 70, h: 30, au: 40, bu: 60 }, dx: -60, dy: -30 } : l))] } }; }
  // 花狐貂 let loose (a unit of kind `marten`)
  DEFS.marten = marten; { const run = (i) => one('marten', { fU: -8 + (i % 2 ? 30 : -26), fU2: 14 + (i % 2 ? -34 : 24), hU: 10 + (i % 2 ? -30 : 26), hU2: -16 + (i % 2 ? 34 : -22), wing: i % 2 ? 18 : -14 });
    PUPPETS['shang:marten'] = { side: 'shang', scale: FOOT * 2.1, box: [-90, -80, 90, 40], shadow: SH(40, 9, 0.35), states: { walk: [0, 1, 2, 3, 4, 5].map(run), idle: [run(0)], attack: [run(1)], hurt: [run(0)], dead: [one('marten', { body: 170 })] } }; }
}
// the squad skills of the contract: which state plays for a skill id (the plain and the blessed id play the same poses)
const SKILL = { shields: ['wall', 'shieldWall', 'mountainWall'], spears: ['thrust', 'massThrust', 'thousandPoints'], archers: ['volley', 'arrowRain', 'skyOfArrows'], strongmen: ['hurl', 'boulder', 'mountainThrow'],
  chariots: ['charge', 'chariotCharge', 'ironTide'], tigers: ['leap', 'tigerLeap', 'tigerStorm'], acolytes: ['cast', 'talisman', 'fiveTalismans'], hooks: ['cast', 'hookDrag', 'heavenNet'] };
for (const id in SKILL) PUPPETS['zhou:' + id].skill = { state: SKILL[id][0], ids: SKILL[id].slice(1) };
/** The key and variant for a unit of the rules: a soldier (`kind` a troop id, `rank`), a general (`kind: 'general'`, `general`, `trueForm`), a foe (`kind`). */
export function keyOf(unit, side) { if (unit.kind === 'general') return ['zhou:' + unit.general, unit.trueForm ? 'true' : '1']; const key = (side || unit.side || 'shang') + ':' + unit.kind; return [key, PUPPETS[key] && PUPPETS[key].tiers ? String(unit.rank || 1) : '']; }
export const KINDS = Object.keys(PUPPETS);
/** The frames of a kind's state, for a variant: a troop's tier ("1", "3", "5"); the hero's variant does not change poses. */
export const framesOf = (key, state, variant) => { const P = PUPPETS[key]; return ((P.tiers && P.tiers[variant || 1]) || P.states)[state] || []; };

// ------------------------------------------------------------------ the cutter: bakes puppets on demand and draws frames
export function createCutter(px = 1, { solid = false } = {}) {
  const cache = new Map();
  const pupOf = (name, scale, variant) => { const id = `${name}|${scale}|${name === 'hero' ? variant || '' : ''}`; let p = cache.get(id);
    if (!p) cache.set(id, p = bake(variantDef(name, variant)(), scale, 7 + (id.length * 31) % 97, solid)); return p; };
  return {
    count: (key, state, variant) => framesOf(key, state, variant).length,
    /** Paints frame i of a state with the ground point at (x, y) in the context's own pixels. flip: -1 faces left. */
    draw(ctx, key, state, i, x, y, { variant, flip = 1, alpha = 1 } = {}) {
      const P = PUPPETS[key], frames = framesOf(key, state, variant), frame = frames[i % frames.length]; if (!frame) return false;
      const K = P.scale * px;
      for (const l of frame) {
        const k = K * (l.k && l.k !== 1 ? l.k : 1), pup = pupOf(l.pup, k, variant), f = flip * (l.flip || 1), pose = l.pose;
        ctx.globalAlpha = alpha * (l.alpha ?? 1) * (pose.$fade ?? 1);
        if (l.root) drawPuppet(ctx, pup, [f * k, 0, 0, k, x + flip * l.root[0] * K, y + l.root[1] * K], pose);            // a piece in the air or lying: placed by its root
        else { const fall = pose.$fall || 0, lift = pose.$air ? Math.max(footDrop(pup, pose), pose.$air * 1.22) : footDrop(pup, pose) * (1 - fall) + 9 * fall - (pose.$bob || 0);
          drawPuppet(ctx, pup, [f * k, 0, 0, k, x + flip * (l.dx || 0) * K, y + (l.dy || 0) * K - lift * k], pose); }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return true;
    },
  };
}
