// The mass from generated art (2026-11-25; the user's decision: every figure from generated art). One generated whole
// figure per kind and rank (lab/game-studies/imagegen/raw/mass-*.png, each with its prompt), a rank an edit of the kind's
// rank-1 picture; rigged from its alpha by lab/game-studies/imagegen/mass/autorig*.py and cut by figures-key's cut.py.
// One atlas per picture, here. NOTES.md has the costs.
//
// Foot kinds (`foot`): the joints of the code puppets: t (torso, far arm on it), h, au (near upper arm, copied over the
// sleeve), al (forearm and fist), w (weapon in the fist), lu ll ku kl. Posed by the code pose tables: a joint's angle is the
// table's angle minus the table's angle in the pose the picture is in (REF), so at REF every part is where the picture put
// it and in any other pose each joint turns by exactly what the code puppet's joint turns. The weapon is a world angle in
// the tables: its own turn is its world change less the turns above it.
// Mounted kinds, chariots, beasts (`mount`): body (the rider or crew on it) and legs leg0..legN hinged at the belly, a
// chariot's wheel; a trot by diagonal pairs, a rear, a lunge, a fall that fades.
//
//   const gm = await loadGenMass();  gm.draw(ctx, 'gen:zhou:spearmen', 'walk', i, x, y, { variant: '3', flip, px })
import { solve, footDrop } from '../engine.js';
import { KIND, footPose } from '../base-poses.js';
import '../poses-campaign.js';                                                       // the pose tables cge and cspear

// The atlases are imported, not fetched by made-up names: the build emits exactly the files that exist (and only those),
// and a kind or rank not made yet is simply absent from these maps (no probing, no 404s).
const METAS = import.meta.glob('./mass2-*.json', { import: 'default' });
const IMGS = import.meta.glob('./mass2-*.webp', { query: '?url', import: 'default', eager: true });
const JOINTS = ['t', 'h', 'au', 'al', 'hd', 'lu', 'll', 'ku', 'kl'];
const DRAWN_LEGS = { lu: -10, ll: 6, ku: 12, kl: 4 };                          // the calm stride every generated figure stands in
const R5 = (stem) => Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, `${stem}-${r}`]));
// kind: atlases by variant ('' for a kind without ranks), how it is posed, game px per atlas px, shadow
export const GEN_MASS = {
  // stretch one, Shang
  'gen:shang:ge': { files: { '': 'mass2-ge-1', e: 'mass2-ge-e' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:archer': { files: { '': 'mass2-archer-1', e: 'mass2-archer-e' }, table: 'archer', side: 'shang', scale: 0.5, shadow: [18, 5.5, 0.3], archer: true },
  'gen:shang:axe': { files: { '': 'mass2-axe-1', e: 'mass2-axe-e' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [20, 5.5, 0.3] },
  'gen:shang:shield': { motion: 'shove', files: { '': 'mass2-shield-1', e: 'mass2-shield-e' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [21, 5.5, 0.3] },
  'gen:shang:shaman': { motion: 'cast', files: { '': 'mass2-shaman-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [22, 6, 0.3] },
  'gen:shang:drummer': { motion: 'drum', files: { '': 'mass2-drummer-b' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [20, 5.5, 0.3] },
  'gen:shang:cavalry': { files: { '': 'mass2-cavalry-1', e: 'mass2-cavalry-e' }, mount: true, side: 'shang', scale: 0.5, shadow: [56, 10, 0.3] },
  'gen:shang:chariot': { files: { '': 'mass2-chariot-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [130, 13, 0.3] },
  // 御林军 (纣王's palace guard), stretch two, stretch three (beasts: no rider; their legs and body only)
  'gen:shang:yulin': { files: { '': 'mass2-yulin-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [21, 6, 0.35] },
  'gen:shang:goldMelon': { files: { '': 'mass2-goldMelon-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [22, 6, 0.35] },
  'gen:shang:axeGuard': { files: { '': 'mass2-axeGuard-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [23, 6, 0.35] },
  'gen:shang:zhendian': { files: { '': 'mass2-zhendian-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [44, 11, 0.4] },
  'gen:shang:drumGuard': { motion: 'drum', files: { '': 'mass2-drumGuard-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [22, 6, 0.3] },
  // the rules' further kinds (content/foes.js): 卞吉's house guard, 余德's pox adept, a 邬文化 giant (cut at twice a soldier's size)
  'gen:shang:bianGuard': { files: { '': 'mass2-bianGuard-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [20, 6, 0.35] },
  'gen:shang:pox': { motion: 'cast', files: { '': 'mass2-pox-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:giant': { motion: 'smash', files: { '': 'mass2-giant-1' }, table: 'cge', side: 'shang', scale: 0.5, shadow: [46, 12, 0.4] },
  // 花狐貂: 魔礼寿's beast (foe `marten`), and the hero's own as the spoil (variant 'f': dressed for Zhou, a cinnabar and gold caparison, red mane and wing tips, a pennant); wings beat. Stride and shadow go with its size: 1.3 H at the shoulder.
  'gen:shang:marten': { files: { '': 'mass2-marten-1', f: 'mass2-marten-f' }, mount: true, side: 'shang', scale: 0.5, shadow: [36, 8, 0.3], stride: 100 },
  // swarms: one picture each, flying (fly: atlas px above the ground), a beat of bob and tilt
  'gen:shang:fireCrow': { files: { '': 'mass2-fireCrow-1' }, mount: true, flyer: true, fly: 70, side: 'shang', scale: 0.5, shadow: [12, 3.5, 0.18] },
  'gen:shang:wasp': { files: { '': 'mass2-wasp-1' }, mount: true, flyer: true, fly: 60, side: 'shang', scale: 0.5, shadow: [11, 3, 0.18] },
  'gen:shang:crossbow': { motion: 'bow', files: { '': 'mass2-crossbow-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:rattan': { motion: 'chop', files: { '': 'mass2-rattan-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:fireDragon': { files: { '': 'mass2-fireDragon-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:plague': { motion: 'cast', files: { '': 'mass2-plague-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:immortal': { motion: 'cast', files: { '': 'mass2-immortal-1' }, table: 'cspear', side: 'shang', scale: 0.52, shadow: [20, 5.5, 0.3] },
  'gen:shang:flyingTiger': { files: { '': 'mass2-flyingTiger-1' }, table: 'cspear', side: 'shang', scale: 0.5, shadow: [19, 5.5, 0.3] },
  'gen:shang:bladeCart': { files: { '': 'mass2-bladeCart-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [80, 11, 0.3] },
  'gen:shang:centipede': { files: { '': 'mass2-centipede-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [70, 9, 0.3] },
  'gen:shang:snake': { files: { '': 'mass2-snake-1' }, mount: true, flyer: true, fly: 0, side: 'shang', scale: 0.5, shadow: [70, 9, 0.3] },
  'gen:shang:boar': { files: { '': 'mass2-boar-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [40, 8, 0.3] },
  'gen:shang:goat': { files: { '': 'mass2-goat-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [38, 8, 0.3] },
  'gen:shang:dog': { files: { '': 'mass2-dog-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [38, 8, 0.3] },
  'gen:shang:buffalo': { files: { '': 'mass2-buffalo-1' }, mount: true, side: 'shang', scale: 0.5, shadow: [56, 10, 0.3] },
  // the nine Zhou squads, ranks 1..5
  'gen:zhou:spearmen': { files: { 1: 'mass2-spear-1c', 2: 'mass2-spear-2', 3: 'mass2-spear-3', 4: 'mass2-spear-4', 5: 'mass2-spear-5' }, table: 'cspear', side: 'zhou', scale: 0.5, shadow: [18, 5.5, 0.5] },
  'gen:zhou:shields': { motion: 'shove', files: R5('mass2-shields'), table: 'cspear', side: 'zhou', scale: 0.5, shadow: [19, 5.5, 0.5] },
  'gen:zhou:archers': { files: R5('mass2-archers'), table: 'archer', side: 'zhou', scale: 0.5, shadow: [18, 5.5, 0.5], archer: true },
  'gen:zhou:strongmen': { motion: 'smash', files: R5('mass2-strongmen'), table: 'cge', side: 'zhou', scale: 0.55, shadow: [34, 9, 0.5] },
  'gen:zhou:crows': { motion: 'chop', files: R5('mass2-crows'), table: 'cspear', side: 'zhou', scale: 0.5, shadow: [18, 5.5, 0.5] },
  'gen:zhou:disciples': { motion: 'cast', files: R5('mass2-disciples'), table: 'cspear', side: 'zhou', scale: 0.5, shadow: [18, 5.5, 0.5] },
  'gen:zhou:yamen': { files: R5('mass2-yamen'), table: 'cge', side: 'zhou', scale: 0.52, shadow: [20, 6, 0.5] },
  'gen:zhou:ironRiders': { files: R5('mass2-ironRiders'), mount: true, side: 'zhou', scale: 0.5, shadow: [56, 10, 0.5] },
  'gen:zhou:chariots': { files: R5('mass2-chariots'), mount: true, side: 'zhou', scale: 0.5, shadow: [130, 13, 0.5] },
};

// The atlases are cut at RES times the 1:1 of the scales above (a soldier 248 atlas px for 62 game px): sharp at dpr 2 and the
// camera's closest zoom. Scales above stay in 1:1 terms; here they become game px per atlas px, and atlas-px offsets grow.
export const RES = 2;
for (const G of Object.values(GEN_MASS)) { G.scale /= RES; if (G.fly) G.fly *= RES; }

function puppetOf(meta, img, paws = false) {
  let parts = meta.parts.map((p, i) => { const [x, y, w, h] = p.rect, cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d', { willReadFrequently: true }).drawImage(img, x, y, w, h, 0, 0, w, h);
    return { id: p.id, parent: p.parent || null, at: p.at, z: p.z, rot: 0, cv, ox: p.o[0], oy: p.o[1], w, h, i }; });
  let byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const linked = (p) => !p.parent || (byId[p.parent] && linked(byId[p.parent]));   // a part whose parent was cut empty (a hidden leg) is left out
  parts = parts.filter(linked); byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const depth = (p) => (p.parent ? 1 + depth(byId[p.parent]) : 0);
  parts.sort((a, b) => depth(a) - depth(b));
  let feet = (meta.feet || []).filter((f) => byId[f.id]);
  // a beast's or a horse's foot points are read from the pixels: the lowest opaque row of each lower leg, under the paw or the
  // hoof (the rig's points sat above the 花狐貂's claws, and it sank into the ground as it walked)
  if (paws) feet = feet.map((f) => { const p = byId[f.id], d = p.cv.getContext('2d').getImageData(0, 0, p.w, p.h).data;
    for (let y = p.h - 1; y >= 0; y--) { let n = 0, sx = 0; for (let x = 0; x < p.w; x++) if (d[(y * p.w + x) * 4 + 3] > 100) { n++; sx += x; } if (n >= 2) return { id: f.id, pt: [p.ox + sx / n, p.oy + y] }; }
    return f; });
  return { parts, byId, order: [...parts].sort((a, b) => a.z - b.z), feet };
}
// the table's pose -> angles for the generated joints (the tables have no wrist: the hand keeps the forearm's line)
function toGen(pose, ref) {
  const q = { $bob: pose.$bob, $fall: pose.$fall, $fade: pose.$fade };
  for (const j of JOINTS) q[j] = (pose[j] ?? ref[j] ?? 0) - (ref[j] ?? 0);
  const wWorld = (pose.w ?? (pose.$hide && pose.$hide.w ? pose.wd ?? ref.w : ref.w)) - ref.w;
  q.w = wWorld - (q.t + q.au + q.al + q.hd);
  return q;
}
const WALK6 = Array.from({ length: 6 }, (_, i) => i / 6);
// ---- the blow, by weapon (the figures-key vocabulary: gathered, the blow, the follow-through; then the recovery).
// Angles are turns from the picture as drawn, degrees, + clockwise with the figure facing right (+ on the weapon brings an
// upright haft's head forward and down). `w` here is the weapon's own turn in the world; the hand's share is taken out below.
// Legs: lu/ll the near thigh and shin, ku/kl the far: a lunge drives the near leg forward and the far leg back.
const LUNGE = { lu: -30, ll: 14, ku: 24, kl: 8 }, HALF = { lu: -14, ll: 6, ku: 12, kl: 4 };
const MOTIONS = {
  // dagger-axe, axe, halberd, hook: raised back over the head, brought down forward, follows through
  chop: { gather: [{ t: -5, au: -24, al: -12, hd: -6, w: -16 }, { t: -12, h: -4, au: -52, al: -22, hd: -12, w: -42, lu: -6, ku: 10 }],
          blow: [{ t: 14, h: 6, au: 26, al: 12, hd: 22, w: 108, ...LUNGE, $bob: -3 }, { t: 10, h: 4, au: 18, al: 8, hd: 16, w: 96, ...LUNGE }, { t: 4, h: 2, au: 8, al: 3, hd: 6, w: 44, ...HALF }] },
  // spear: levelled and drawn back, then driven forward with a lunge
  thrust: { gather: [{ t: -4, au: 6, al: 22, hd: 10, w: 62, $slide: 0.4 }, { t: -10, h: -3, au: 12, al: 30, hd: 14, w: 84, lu: -6, ku: 10, $slide: 0.7 }],
            blow: [{ t: 16, h: 6, au: -16, al: -8, hd: 0, w: 90, ...LUNGE, $bob: -2, $slide: 0.85 }, { t: 12, h: 4, au: -10, al: -4, w: 88, ...LUNGE, $slide: 0.8 }, { t: 5, h: 2, au: 0, al: 8, hd: 4, w: 44, ...HALF, $slide: 0.35 }] },
  // the club of the Yellow-Turban strongmen and the giant: the same chop, heavier and slower to come back
  smash: { gather: [{ t: -8, au: -30, al: -14, hd: -8, w: -24 }, { t: -16, h: -6, au: -64, al: -26, hd: -14, w: -58, lu: -8, ku: 12, $bob: 2 }],
           blow: [{ t: 18, h: 8, au: 34, al: 14, hd: 24, w: 118, ...LUNGE, $bob: -5 }, { t: 14, h: 6, au: 26, al: 10, hd: 18, w: 108, ...LUNGE, $bob: -4 }, { t: 6, h: 2, au: 10, al: 4, hd: 8, w: 52, ...HALF }] },
  // the shield man: crouched behind it, then the whole body drives it forward
  shove: { gather: [{ t: -6, h: -2, lu: -4, ku: 8, $bob: 2 }, { t: -12, h: -4, lu: -8, ll: 10, ku: 14, kl: 6, $bob: 4 }],
           blow: [{ t: 18, h: 6, ...LUNGE, lu: -36, $bob: -2 }, { t: 12, h: 4, ...LUNGE }, { t: 4, h: 2, ...HALF }] },
  // a bow on the body (no arm cut): leans back to draw, snaps forward as it looses
  bow: { gather: [{ t: -5, h: -3, au: -10 }, { t: -9, h: -5, au: -18, lu: -4, ku: 6 }], blow: [{ t: 7, h: 4, au: 6, lu: -10, ku: 8 }, { t: 4, h: 2, au: 3 }, { t: 1, au: 1 }] },
  // the drummer: the stick raised, then beaten down; the drum-pole of the guard likewise
  drum: { gather: [{ t: -3, au: -26, al: -16, hd: -8, w: -18 }, { t: -6, h: -3, au: -46, al: -26, hd: -14, w: -34 }],
          blow: [{ t: 6, h: 4, au: 18, al: 10, hd: 16, w: 44, $bob: -2 }, { t: 3, h: 2, au: 8, al: 4, hd: 8, w: 22 }, { t: 1, au: 2, w: 6 }] },
  // adepts and shamans: the staff raised high, the head back, then thrust out toward the foe
  cast: { gather: [{ t: -4, h: -4, au: -30, al: -18, hd: -6, w: -10 }, { t: -9, h: -8, au: -62, al: -30, hd: -10, w: -18 }],
          blow: [{ t: 10, h: 6, au: -18, al: -12, hd: 10, w: 34, ...HALF }, { t: 7, h: 4, au: -10, al: -6, hd: 6, w: 24, ...HALF }, { t: 2, h: 1, au: -2, w: 6 }] },
};
const motionOf = (G) => G.motion || (G.archer ? 'bow' : G.table === 'cge' ? 'chop' : 'thrust');
const ZERO = Object.fromEntries(JOINTS.map((j) => [j, 0]));
function blowPose(k) {                                     // a key of MOTIONS -> the generated joints (the weapon's world turn made local)
  const q = { ...ZERO, ...k, $bob: k.$bob || 0, $slide: k.$slide || 0 };
  q.w = (k.w || 0) - (q.t + q.au + q.al + q.hd);
  return q;
}
function footStates(G) {
  const K = KIND[`${G.side}:${G.table}`] || KIND[G.table], ref = { ...K.base, ...DRAWN_LEGS }, f = (s, t, ph = 0) => toGen(footPose(G.table, s, t, ph, 0.3, { side: G.side }), ref);
  const M = MOTIONS[motionOf(G)];
  // walk: the table's stride, its arm swing and bob, and the hand following the swing a little
  const walk = WALK6.map((ph) => { const q = f('walk', 0.3, ph); q.hd = 0.5 * q.au; q.w -= q.hd; return q; });
  return {
    walk, idle: [f('idle', 0.4)], hurt: [f('stun', 0.15)], dead: [f('dead', 0.12), f('dead', 0.3), f('dead', 0.7)],
    // windup frames are held 0.4 s each (art/index frameOf); attack frames 0.12 s: the blow lands on the attack's first frame
    windup: M.gather.map(blowPose), attack: [...M.blow.map(blowPose), f('idle', 0.4)],
  };
}
// ---- mounts: legs numbered left to right (hind to fore), each a thigh legN (hinged at the hip) and a shank legNk
// (at the knee or hock); + swings a hoof back. A gallop: the hind pair and then the fore pair strike, each pair a little
// apart; the body pitches and rises; the rider (cavalry) rides it out and strikes with his spear (`w`).
const S = (t) => Math.sin(t * Math.PI * 2), C = (t) => Math.cos(t * Math.PI * 2);
function gallopLegs(n, ph, amp = 30) {
  const q = {};
  for (let i = 0; i < n; i++) {
    const fore = i >= n / 2, off = (fore ? 0.42 : 0) + (i % 2) * 0.12 + Math.floor(i / 2) * 0.03;   // figures-key's rotary gallop: hind 0, 0.12; fore 0.42, 0.54
    const sw = S(ph + off), lift = Math.max(0, C(ph + off));                       // lift: the leg coming forward, off the ground
    q['leg' + i] = amp * sw;
    q['leg' + i + 'k'] = (fore ? 58 : -0.55 * 58) * lift;                          // the hind hock at 0.55 of the fore knee (figures-key)                                  // the fore knee folds the hoof back; the hind hock folds it forward
  }
  return q;
}
function mountPose(n, ph, o = {}) {
  return { body: (o.body || 0) + (o.pitch ?? 3.5) * S(2 * ph + 0.15), $bob: o.bob ?? 5 * Math.abs(S(ph + 0.1)), wheel: ph * 360 * (o.wheel ?? 1), $fade: o.fade,
    rider: (o.rider || 0) - 2.5 * S(2 * ph + 0.3) * (o.amp === 0 ? 0 : 1), $slide: o.slide || 0,
    wing: o.wing ?? 9 * S(2 * ph + 0.2),                                            // a winged beast's wings beat twice a stride (no wing part: ignored) w: (o.w || 0) + 3 * S(2 * ph + 0.45) * (o.amp === 0 ? 0 : 1),
    ...gallopLegs(n, ph, o.amp ?? 30), ...(o.legs ? o.legs : {}) };
}
const legSet = (n, fore, hind, foreK = 0, hindK = 0) => { const q = {}; for (let i = 0; i < n; i++) { const f = i >= n / 2; q['leg' + i] = f ? fore : hind; q['leg' + i + 'k'] = f ? foreK : hindK; } return q; };
function mountStates(n) {
  const still = (o) => mountPose(n, 0, { amp: 0, bob: 0, pitch: 0, ...o });
  return {
    walk: Array.from({ length: 8 }, (_, i) => mountPose(n, i / 8)),
    idle: [still({ bob: 1 })],
    // the warning: the horse checks and half rears, the rider rises with his spear drawn back
    windup: [still({ body: -6, rider: -8, w: -14, wing: -10, legs: legSet(n, -20, 8, 30, 0) }), still({ body: -11, rider: -14, w: -26, wing: -16, legs: legSet(n, -42, 14, 60, -10) })],
    // the charge: the horse comes down stretched out, the rider thrown forward with the spear levelled; then gathers again
    attack: [still({ body: 6, rider: 16, w: 82, slide: 0.8, wing: 12, legs: legSet(n, -34, 30, 6, -6), bob: -2 }), still({ body: 4, rider: 12, w: 78, slide: 0.75, wing: 6, legs: legSet(n, -18, 18, 20, -10) }),
             mountPose(n, 0.25, { rider: 5, w: 30 }), mountPose(n, 0.5)],
    hurt: [still({ body: 5, rider: -10, w: -8, legs: legSet(n, -10, 6, 14, 0) })],
    dead: [still({ body: -12, rider: -24, w: -30, legs: legSet(n, -30, 6, 40, 0) }), mountPose(n, 0.2, { body: 8, rider: -60, w: -50, fade: 0.6 }), mountPose(n, 0.4, { body: 14, rider: -80, w: -60, fade: 0.2 })],
  };
}
// flyers: the body alone; a quick bob and a tilt for the wing-beat, a dive for the attack, a tumble that fades
function flyerStates() {
  const q = (body, bob, fade) => ({ body, $bob: bob, $fade: fade });
  return { walk: WALK6.map((ph) => q(4 * S(ph), 6 + 6 * S(ph * 2))), idle: [q(0, 8)], windup: [q(-14, 14)], attack: [q(16, 0)], hurt: [q(10, 4)],
    dead: [q(30, -10, 0.8), q(60, -30, 0.5), q(90, -50, 0.2)] };
}

export async function loadGenMass(keys = Object.keys(GEN_MASS)) {
  const pups = {}, states = {}, missing = {};
  await Promise.all(keys.flatMap((key) => Object.entries(GEN_MASS[key].files).map(async ([v, file]) => {
    const meta = METAS[`./${file}.json`], url = IMGS[`./${file}.webp`];
    if (!meta || !url) { (missing[key] = missing[key] || []).push(v || 'base'); return; }   // not made yet
    try { const img = new Image(); img.src = url; await img.decode(); pups[key + '|' + v] = puppetOf(await meta(), img, !!GEN_MASS[key].mount && !GEN_MASS[key].flyer); }
    catch (e) { console.warn(`muye mass: ${file} failed to load`, e); }
  })));
  for (const key of keys) { const G = GEN_MASS[key], any = Object.keys(G.files).map((v) => pups[key + '|' + v]).find(Boolean);
    if (!any) continue;                                                       // puppets/index.js logs the fallback, once per game key
    try { states[key] = G.flyer ? flyerStates() : G.mount ? mountStates(any.parts.filter((p) => /^leg\d+$/.test(p.id)).length) : footStates(G); }
    catch (e) { console.warn(`muye mass: ${key} could not be posed; its code puppet stands in`, e); continue; }
    if (missing[key]) console.info(`muye mass: ${key} variants ${missing[key].join(', ')} not made yet; the nearest made rank stands in`); }
  // a rank not made yet shows the nearest made rank below it (then above)
  const pupOf = (key, v) => { if (pups[key + '|' + (v || '')]) return pups[key + '|' + (v || '')]; const r = +v || 1; for (let d = 1; d < 5; d++) { if (pups[key + '|' + (r - d)]) return pups[key + '|' + (r - d)]; } for (let d = 1; d < 5; d++) if (pups[key + '|' + (r + d)]) return pups[key + '|' + (r + d)]; return pups[key + '|']; };
  return {
    has: (key, v) => !!states[key] && !!pupOf(key, v),
    count: (key, state) => ((states[key] || {})[state] || []).length,
    draw(ctx, key, state, i, x, y, { variant, flip = 1, px = 1, alpha = 1, banner = false } = {}) {
      if (this.faultEmpty) return true;                                          // ?drawcheck=empty: the draw check's injected fault (nothing drawn)
      const G = GEN_MASS[key], pup = pupOf(key, variant), frames = (states[key] || {})[state]; if (!pup || !frames) return false;
      let pose = frames[i % frames.length]; if (pose.hd && !pup.byId.hd) pose = { ...pose, w: (pose.w || 0) + pose.hd };   // a puppet cut before the hand was its own part
      const k = G.scale * px, fall = pose.$fall || 0, lift = footDrop(pup, pose) * (1 - fall) + 18 * RES * fall - (pose.$bob || 0) * RES + (G.fly || 0);
      ctx.globalAlpha = alpha * (pose.$fade ?? 1);
      const M = solve(pup, [flip * k, 0, 0, k, x, y - lift * k], pose), wp = pup.byId.w;
      if (wp && pose.$slide) { const m = M.w, d = -pose.$slide * (wp.oy + wp.h); M.w = [m[0], m[1], m[2], m[3], m[4] + m[2] * d, m[5] + m[3] * d]; }   // the haft slid up through the fist
      for (const p of pup.order) { if (p.id === 'banner' && !banner) continue;   // the back-banner is drawn live by the art module (bannerAt)
        const m = M[p.id]; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.drawImage(p.cv, p.ox, p.oy, p.w, p.h); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return true;
    },
    shadow: (key) => GEN_MASS[key].shadow,
    /** The live back-banner of a kind (elites, 御林军, Zhou ranks 4 and 5), or null: its picture multiplied into the paper,
     *  and where it stands in frame i of state s, as a matrix in game px about the unit's foot point, facing right. */
    bannerAt(key, variant, s, i) {
      const G = GEN_MASS[key], pup = pupOf(key, variant), b = pup && pup.byId.banner, frames = (states[key] || {})[s]; if (!b || !frames) return null;
      const pose = frames[i % frames.length], k = G.scale, fall = pose.$fall || 0, lift = footDrop(pup, pose) * (1 - fall) + 18 * RES * fall - (pose.$bob || 0) * RES + (G.fly || 0);
      if (!b.paper) { const c = document.createElement('canvas'); c.width = b.w; c.height = b.h; const x = c.getContext('2d'); x.fillStyle = '#EFE7D6'; x.fillRect(0, 0, b.w, b.h);
        x.globalCompositeOperation = 'multiply'; x.drawImage(b.cv, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(b.cv, 0, 0); b.paper = c; }
      return { img: b.paper, ox: b.ox, oy: b.oy, w: b.w, h: b.h, m: solve(pup, [k, 0, 0, k, 0, -lift * k], pose).banner, fade: pose.$fade ?? 1 };
    },
  };
}
