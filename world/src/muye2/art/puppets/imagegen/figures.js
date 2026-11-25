// Key figures from generated art (hero, generals, bosses): image parts cut by lab/game-studies/imagegen/cut.py,
// packed in one atlas per figure, jointed and posed with the same engine as the code-drawn puppets (../engine.js).
// A figure is two puppets: the mount (root: body) and the rider (root: torso), the rider seated on the mount's
// saddle point in every frame. Units are atlas pixels; a kind's `scale` turns them into game pixels.
//
//   const figs = await loadKeyFigures();                 // fetches the atlases
//   figs.draw(ctx, 'shang:zhouwang', 'move', i, x, y, { flip, px })   // same contract as the code cutters
//   figs.count('shang:zhouwang', 'move')
import { apply } from '../engine.js';
import { mountPose, weaponBeat, lerpPose, trail, WEAPON_TIME } from './motion.js';

const BASE = import.meta.url.replace(/[?#].*$/, '').replace(/[^/]*$/, '');   // the folder of this file (Vite rewrites new URL('./', …) without the slash)
const D2R = Math.PI / 180;
const REACH_AT = 126;   // the hero's height when his weapon parts were cut to the rules' reach (rigs/wuwang-motion.json)

// ---- per figure: file, game height of the rider's head above the ground (px at game size), timing hints.
// Sizes (user's revision of 2026-11-25; H agreed with the mass session) in H = a rank-1 foot soldier's head top above his feet, 62 px at zoom 1
// (weapons, back-banners, plumes above the crown and halos not counted; KEY_FIGURES height is measured the same way): generals and the hero on
// foot 1.35H (84), the hero and mounted generals and officers 1.8H (112), small bosses 1.5H on foot (93) / 2.0H mounted (124), the three great
// ones 2.3H (143), 纣王 2.6H (161); 土行孙 stays short (71). 法相 and book giants only exceed it.
export const KEY_FIGURES = {
  'shang:zhouwang': { file: 'zhouwang', height: 161, side: 'shang', shadow: [42, 8, 0.45], attack: { up: [-100, 40], hit: [34, 84], fol: [20, 70] } },
  'shang:wenzhong': { file: 'wenzhong', height: 143, side: 'shang', shadow: [39, 7, 0.42], attack: { up: [-70, 20], hit: [30, 50], fol: [18, 36] } },
  'zhou:jiangziya': { file: 'jiangziya', height: 112, side: 'zhou', shadow: [32, 6, 0.4], attack: { up: [-55, -25], hit: [14, 22], fol: [8, 12] } },
  'shang:zhangguifang': { file: 'zhangguifang', height: 124, side: 'shang', shadow: [33, 6, 0.4], attack: { up: [-35, 62], hit: [30, 86], fol: [22, 80] } },
  'shang:dengzhong': { file: 'dengzhong', height: 124, side: 'shang', shadow: [35, 7, 0.4] },
  'shang:zhangjie': { file: 'zhangjie', height: 124, side: 'shang', shadow: [35, 6, 0.4], attack: { up: [-35, 62], hit: [30, 86], fol: [22, 80] } },
  'shang:taorong': { file: 'taorong', height: 124, side: 'shang', shadow: [35, 6, 0.4] },
  'shang:moliqing': { file: 'moliqing', height: 93, side: 'shang', foot: true, shadow: [17, 4, 0.4], attack: { up: [-35, 62], hit: [38, 88], fol: [26, 84] } },
  'shang:molihai': { file: 'molihai', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.4], attack: { up: [-35, 62], hit: [38, 88], fol: [26, 84] } },
  'shang:molishou': { file: 'molishou', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.4], attack: { up: [-70, 10], hit: [40, 46], fol: [26, 34] } },
  'shang:molihong': { file: 'molihong', height: 93, side: 'shang', foot: true, shadow: [17, 4, 0.4], attack: { up: [-50, -10], hit: [30, 30], fol: [18, 20] } },
  'shang:xinhuan': { file: 'xinhuan', height: 93, side: 'shang', foot: true, hover: 19, shadow: [17, 4, 0.25], attack: { up: [-80, 10], hit: [40, 50], fol: [26, 36] } },
  'zhou:nezha': { file: 'nezha', height: 84, side: 'zhou', foot: true, hover: 7, shadow: [20, 4, 0.35], attack: { up: [-40, 40], hit: [36, 60], fol: [24, 50] } },
  'zhou:leizhenzi': { file: 'leizhenzi', height: 84, side: 'zhou', foot: true, hover: 19, shadow: [17, 4, 0.25], attack: { up: [-70, 20], hit: [44, 60], fol: [28, 44] } },
  'zhou:tuxingsun': { file: 'tuxingsun', height: 71, side: 'zhou', foot: true, shadow: [19, 5, 0.3], attack: { up: [-40, -30], hit: [30, 40], fol: [20, 30] } },
  'zhou:dengchanyu': { file: 'dengchanyu', height: 112, side: 'zhou', shadow: [30, 6, 0.4], attack: { up: [-70, -10], hit: [22, 10], fol: [12, 6] } },
  'zhou:yangjian': { file: 'yangjian', height: 112, side: 'zhou', shadow: [29, 6, 0.4], attack: { up: [-40, 55], hit: [30, 85], fol: [22, 80] } },
  'zhou:huangfeihu': { file: 'huangfeihu', height: 112, side: 'zhou', shadow: [32, 6, 0.4], attack: { up: [-40, 55], hit: [30, 85], fol: [22, 80] } },
  'zhou:zhenglun': { file: 'zhenglun', height: 112, side: 'zhou', shadow: [32, 6, 0.4], attack: { up: [-70, 10], hit: [36, 50], fol: [22, 36] } },
  'zhou:longji': { file: 'longji', height: 112, side: 'zhou', shadow: [28, 5, 0.3], attack: { up: [-50, -20], hit: [24, 10], fol: [14, 6] } },
  'zhou:huangtianhua': { file: 'huangtianhua', height: 112, side: 'zhou', shadow: [31, 6, 0.4], attack: { up: [-80, 10], hit: [40, 50], fol: [24, 36] } },
  'shang:kongxuan': { file: 'kongxuan', height: 143, side: 'shang', shadow: [36, 6, 0.42], attack: { up: [-90, 40], hit: [34, 84], fol: [20, 70] } },
  'shang:yuanhong': { file: 'yuanhong', height: 143, side: 'shang', shadow: [37, 7, 0.42], forms: { stone: 'shang:yuanhong-stone' }, attack: { up: [-40, -20], hit: [30, 20], fol: [18, 12] } },
  'shang:yuanhong-stone': { file: 'yuanhong-stone', height: 124, side: 'shang', foot: true, still: true, shadow: [25, 5, 0.4] },
  'shang:wulong': { file: 'wulong', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.4], attack: { up: [-70, 10], hit: [40, 50], fol: [26, 36] } },
  'shang:changhao': { file: 'changhao', height: 93, side: 'shang', foot: true, shadow: [17, 4, 0.4], attack: { up: [-35, 62], hit: [38, 88], fol: [26, 84] } },
  'shang:daili': { file: 'daili', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.4], attack: { up: [-70, 10], hit: [40, 50], fol: [26, 36] } },
  'shang:zhuzizhen': { file: 'zhuzizhen', height: 93, side: 'shang', foot: true, shadow: [20, 5, 0.4], attack: { up: [-70, 10], hit: [40, 50], fol: [26, 36] } },
  'shang:yangxian': { file: 'yangxian', height: 93, side: 'shang', foot: true, shadow: [17, 4, 0.4], attack: { up: [-35, 62], hit: [38, 88], fol: [26, 84] } },
  'shang:jindasheng': { file: 'jindasheng', height: 124, side: 'shang', shadow: [36, 6, 0.4], attack: { up: [-70, 10], hit: [40, 50], fol: [26, 36] } },
  // stretch two and three (tester round 1, F5): small bosses mounted 2.0H, officers mounted 1.8H, the three fox-spirits on foot 1.5H, 武王 unhorsed 1.35H
  'shang:yuhua': { file: 'yuhua', height: 124, side: 'shang', shadow: [30, 6, 0.4], attack: { up: [-90, 30], hit: [30, 60], fol: [18, 44] } },
  'shang:chenqi': { file: 'chenqi', height: 124, side: 'shang', shadow: [32, 6, 0.4], attack: { up: [-100, 20], hit: [36, 50], fol: [22, 36] } },
  'shang:lvyue': { file: 'lvyue', height: 124, side: 'shang', shadow: [32, 6, 0.4], attack: { up: [-60, -20], hit: [20, 10], fol: [12, 6] } },
  'shang:huoling': { file: 'huoling', height: 124, side: 'shang', shadow: [30, 6, 0.4], attack: { up: [-80, 20], hit: [30, 50], fol: [18, 36] } },
  'shang:bianji': { file: 'bianji', height: 124, side: 'shang', shadow: [30, 6, 0.4], attack: { up: [-40, 55], hit: [30, 85], fol: [22, 80] } },
  'shang:zhangkui': { file: 'zhangkui', height: 124, side: 'shang', shadow: [32, 6, 0.4], attack: { up: [-90, 40], hit: [34, 84], fol: [20, 70] } },
  'shang:gaolanying': { file: 'gaolanying', height: 112, side: 'shang', shadow: [28, 5, 0.4], attack: { up: [-80, 20], hit: [30, 50], fol: [18, 36] } },
  'shang:lurenjie': { file: 'lurenjie', height: 112, side: 'shang', shadow: [28, 5, 0.4], attack: { up: [-35, 62], hit: [30, 86], fol: [22, 80] } },
  'shang:leikun': { file: 'leikun', height: 112, side: 'shang', shadow: [28, 5, 0.4], attack: { up: [-100, 40], hit: [34, 84], fol: [20, 70] } },
  'shang:leipeng': { file: 'leipeng', height: 112, side: 'shang', shadow: [28, 5, 0.4], attack: { up: [-80, 10], hit: [40, 50], fol: [24, 36] } },
  'shang:daji': { file: 'daji', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.35], attack: { up: [-60, 10], hit: [30, 40], fol: [18, 30] } },
  'shang:ximei': { file: 'ximei', height: 93, side: 'shang', foot: true, shadow: [18, 4, 0.35], attack: { up: [-60, -10], hit: [24, 20], fol: [14, 12] } },
  'shang:wanggui': { file: 'wanggui', height: 93, side: 'shang', foot: true, shadow: [16, 4, 0.35], attack: { up: [-40, -10], hit: [16, 10], fol: [10, 6] } },
  'hero:wuwang-afoot': { file: 'wuwang-afoot', height: 84, side: 'zhou', foot: true, shadow: [18, 4, 0.45], attack: { up: [40, -4], hit: [-30, 2], fol: [-14, 2] } },   // his spear is cut level: the thrust is the arm drawing back then driving forward, the spear kept near 0
  // 显圣 true forms (the general revealed as a god, temple-mural iconography in this hand): apparitions up to 2.6H
  'zhou:yangjian-true': { travel: true, file: 'yangjian-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-40, 55], hit: [30, 85], fol: [22, 80] } },
  'zhou:nezha-true': { travel: true, file: 'nezha-t2', height: 124, side: 'zhou', foot: true, hover: 7, shadow: [26, 6, 0.3], attack: { up: [-10, -6], hit: [8, 6], fol: [5, 3] } },
  'zhou:huangfeihu-true': { travel: true, file: 'huangfeihu-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-30, 20], hit: [20, 10], fol: [12, 6] } },
  'zhou:leizhenzi-true': { travel: true, file: 'leizhenzi-t2', height: 124, side: 'zhou', foot: true, hover: 19, shadow: [22, 5, 0.25], attack: { up: [-50, 20], hit: [30, 40], fol: [18, 28] } },
  'zhou:dengchanyu-true': { travel: true, file: 'dengchanyu-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-60, -10], hit: [22, 10], fol: [12, 6] } },
  'zhou:tuxingsun-true': { travel: true, file: 'tuxingsun-t2', height: 124, side: 'zhou', foot: true, shadow: [26, 6, 0.35], attack: { up: [-30, -10], hit: [24, 12], fol: [14, 8] } },
  'zhou:zhenglun-true': { travel: true, file: 'zhenglun-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-60, 10], hit: [32, 40], fol: [20, 28] } },
  'zhou:jiangziya-true': { travel: true, file: 'jiangziya-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-50, -20], hit: [14, 22], fol: [8, 12] } },
  'zhou:huangtianhua-true': { travel: true, drop: ['nail'], file: 'huangtianhua-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-70, 10], hit: [36, 45], fol: [22, 32] } },
  'zhou:longji-true': { travel: true, file: 'longji-t2', height: 143, side: 'zhou', shadow: [40, 8, 0.35], attack: { up: [-50, -20], hit: [24, 10], fol: [14, 6] } },
  'hero:wuwang': { file: 'wuwang', height: 112, side: 'zhou', shadow: [26, 6, 0.45], bannerSway: 0.35, motion: true,
    // the hand's weapon, one part each (w_*); keyframes of shoulder (armU), elbow (armF), the weapon in the hand (w), the torso's lean and the head.
    // Angles add down the arm: the weapon's angle on screen is armU + armF + w (+ torso). ride: the carry at the gallop.
    weapons: {
      spear: { part: 'w_spear', reach: 105, hand: 0.31, ride: { armU: 0, armF: -10, w: -10 }, wind: { torso: -8, head: 4, armU: 55, armF: -55, w: -2 }, hit: { torso: 12, head: -8, armU: -75, armF: 70, w: -8 }, fol: { torso: 7, head: -4, armU: -50, armF: 45, w: -4 } },
      halberd: { part: 'w_halberd', reach: 70, hand: 0.45, ride: { armU: -10, armF: -20, w: -55 }, wind: { torso: -14, head: 6, armU: -70, armF: -50, w: -40 }, hit: { torso: 20, head: -8, armU: -75, armF: 55, w: 42 }, fol: { torso: 12, head: -3, armU: -30, armF: 45, w: 70 } },
      glaive: { part: 'w_glaive', reach: 85, hand: 0.38, ride: { armU: -10, armF: -20, w: -55 }, wind: { torso: -13, head: 5, armU: -65, armF: -45, w: -50 }, hit: { torso: 16, head: -6, armU: -70, armF: 55, w: 40 }, fol: { torso: 10, head: -3, armU: -25, armF: 40, w: 65 } },
      bow: { part: 'w_bow', tip: 'grip', ride: { armU: -10, armF: -10, w: 80 }, wind: { torso: 6, head: -2, armU: -88, armF: 84, w: 90 }, hit: { torso: -10, head: 4, armU: -62, armF: 48, w: 112 }, fol: { torso: -4, armU: -40, armF: 30, w: 100 } },
      steelWhip: { part: 'w_whip', reach: 55, hand: 0.55, tip: 'left', ride: { armU: -10, armF: -20, w: 160 }, wind: { torso: -10, head: 4, armU: -70, armF: -50, w: 150 }, hit: { torso: 14, head: -6, armU: -60, armF: 50, w: 210 }, fol: { torso: 8, armU: -20, armF: 30, w: 230 } },
    } },
};

// drop: part ids not drawn at all (a figure's prop that could be taken for another's mark, e.g. 黄飞虎's 华盖)
function puppetOf(meta, img, layer, paper, drop) {
  const parts = meta.parts.filter((p) => p.layer === layer).map((p, i) => {
    const cv = document.createElement('canvas'); const [x, y, w, h] = p.rect;
    cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.drawImage(img, x, y, w, h, 0, 0, w, h);
    if (paper) { c.globalCompositeOperation = 'multiply'; c.fillStyle = paper; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; c.drawImage(img, x, y, w, h, 0, 0, w, h); }   // the dye in the paper, as the baked sheets are
    return { id: p.id, parent: p.parent && meta.parts.find((q) => q.id === p.parent && q.layer === layer) ? p.parent : null, at: p.at, z: p.z, rot: 0, cv, ox: p.o[0], oy: p.o[1], w, h, i };
  });
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const depth = (p) => (p.parent ? 1 + depth(byId[p.parent]) : 0);
  parts.sort((a, b) => depth(a) - depth(b));
  const order = parts.filter((p) => !(drop && drop.includes(p.id))).sort((a, b) => a.z - b.z);
  return { parts, byId, order, feet: (meta.feet || []).filter((f) => byId[f.id]) };
}

// lowest point of the feet in a pose, unit scale, root at the origin
function lowest(pup, pose) {
  const M = solveS(pup, [1, 0, 0, 1, 0, 0], pose); let y = -1e9;
  for (const f of pup.feet) y = Math.max(y, apply(M[f.id], f.pt[0], f.pt[1])[1]);
  return y;
}

// ------------------------------------------------------------------ poses
// angles in degrees, positive turns clockwise on screen (the figure faces right): + on a leg swings the hoof back.
const S = (t) => Math.sin(t * Math.PI * 2);
const idlePose = (t) => ({
  mount: { body: 0.6 * S(t), tail: 5 * S(t + 0.2), legA: 0, legA2: 0, mwingN: 6 * S(t), mwingF: -6 * S(t + 0.1), $bob: 1.2 * S(t) },
  rider: { torso: 1 * S(t + 0.1), head: -2 * S(t + 0.3), arm: 3 * S(t + 0.2), weapon: -2 * S(t + 0.25), cloak: 4 * S(t + 0.4), plume: 8 * S(t + 0.5), banner: 6 * S(t + 0.45), flag: 6 * S(t + 0.45), whip2: 3 * S(t + 0.3) },
});
// a walking trot: diagonal pairs (A with D, B with C). The lifted fore leg (A) plants by unbending its knee.
const movePose = (t) => {
  const a = S(t), b = S(t + 0.5);
  return {
    mount: { mwingN: 22 * S(t), mwingF: -22 * S(t + 0.08), body: 1.6 * S(2 * t + 0.1), tail: 8 + 6 * S(2 * t), legA: -16 * a - 4, legA2: Math.max(0, -a) * -34 + 6, legB: -18 * b, legC: 18 * b, legD: 18 * a, $bob: 3 * Math.abs(S(t + 0.12)) },
    rider: { torso: 2 * S(2 * t + 0.35), head: -1.5 * S(2 * t + 0.5), arm: 4 * S(2 * t + 0.4), weapon: -3 * S(2 * t + 0.45), cloak: 10 + 5 * S(2 * t + 0.5), plume: 18 + 8 * S(2 * t + 0.6), banner: 14 + 7 * S(2 * t + 0.55), flag: 14 + 7 * S(2 * t + 0.55), whip2: 4 * S(2 * t + 0.4) },
  };
};
// the attack: gathered (arm up and back, the mount checks), the blow, the follow-through. Each figure gives its own
// arm and weapon angles [arm, weapon] for the three, because the weapons are held differently (upright dao and axe,
// a raised whip, a level staff); the default is the overhead chop of an upright blade.
const CHOP = { up: [-95, 45], hit: [30, 80], fol: [18, 66] };
const attackPoses = ({ up, hit, fol } = CHOP) => [
  // gathered: the mount rears, forelegs up, the rider leans back with the weapon high: readable from across the screen
  { mount: { body: -17, legA: -62, legA2: -44, legB: -48, legC: 16, legD: 12, tail: 20 }, rider: { torso: -15, head: -6, arm: up[0], weapon: up[1], cloak: 20, plume: 34, banner: 24, whip2: -40 } },
  // the blow: the mount comes down and lunges, the rider thrown forward
  { mount: { body: 8, legA: 26, legA2: 0, legB: 28, legC: -26, legD: -18, tail: 22 }, rider: { torso: 17, head: 8, arm: hit[0], weapon: hit[1], cloak: 30, plume: 40, banner: 32, whip2: 44 }, run: 0.14 },
  { mount: { body: 4, legA: 12, legA2: 0, legB: 14, legC: -12, legD: -8, tail: 14 }, rider: { torso: 9, head: 4, arm: fol[0], weapon: fol[1], cloak: 20, plume: 28, banner: 20, whip2: 26 }, run: 0.1 },
];
const hurtPoses = [{ mount: { body: -9, legA: -36, legA2: -28, legB: -22, legC: 10, legD: 6, tail: -6 }, rider: { torso: -16, head: -12, arm: -20, weapon: -12, cloak: -10, plume: -20, banner: -14, flag: -14, whip2: -16 } }];
// the fall: struck, thrown backward out of the saddle, down; the mount rears and bolts forward out of the picture.
// off: the rider's root [back, down, -] as shares of the mount's height; run: the mount's run forward (share), fade: its alpha.
const fallPoses = [
  { mount: { body: -12, legA: -40, legA2: -30, legB: -30, legC: 14, legD: 12, tail: -4 }, rider: { torso: -30, head: -18, arm: -56, weapon: -36, cloak: -20, plume: -30, banner: -6, whip2: -30 } },
  { mount: { body: -22, legA: -56, legA2: -40, legB: -44, legC: 26, legD: 20, tail: 10 }, rider: { torso: -72, head: -24, arm: -96, weapon: -50, cloak: -40, plume: -50, banner: 60, whip2: -60 }, off: [-0.5, 0.5], run: 0.15 },
  { mount: movePose(0.25).mount, rider: { torso: -92, head: -4, arm: -110, weapon: -70, cloak: -70, plume: -70, banner: 92, whip2: -90 }, off: [-0.7, 1], run: 0.75, mfade: 0.6 },
  { mount: movePose(0.6).mount, rider: { torso: -92, head: 2, arm: -112, weapon: -74, cloak: -72, plume: -72, banner: 94, whip2: -92 }, off: [-0.7, 1], run: 1.6, mfade: 0 },
];
// ---- figures on foot (the 魔家 brothers, 辛环): one puppet, root `torso` at the hips. Legs: thighN/shinN (near),
// thighF/shinF (far); arms: arm → weapon (near), arm2 → item2 (far); wingN/wingF for a flyer.
const footIdle = (t) => ({ torso: 1.2 * S(t), head: -2 * S(t + 0.3), arm: 3 * S(t + 0.2), weapon: -2 * S(t + 0.25), arm2: -3 * S(t + 0.1), item2: 2 * S(t + 0.3),
  thighN: 0, shinN: 0, thighF: 0, shinF: 0, cloak: 4 * S(t + 0.4), plume: 8 * S(t + 0.5), wingN: 8 * S(t), wingF: -8 * S(t + 0.1), $bob: 1.2 * S(t) });
const footMove = (t) => { const a = S(t), c = Math.cos(t * Math.PI * 2);
  return { torso: 3 + 1.5 * S(2 * t), head: -2 * S(2 * t + 0.3), arm: -10 * a, weapon: 4 * a, arm2: 12 * a, item2: -4 * a,
    thighN: -26 * a, shinN: Math.max(0, c) * 34, thighF: 26 * a, shinF: Math.max(0, -c) * 34, cloak: 12 + 6 * S(2 * t), plume: 18 + 8 * S(2 * t + 0.5),
    wingN: 26 * S(2 * t), wingF: -26 * S(2 * t + 0.1), $bob: 3 * Math.abs(S(t + 0.25)) }; };
const footAttack = ({ up, hit, fol } = CHOP) => [
  { torso: -16, head: -8, arm: up[0], weapon: up[1], arm2: 36, item2: 12, thighN: -10, shinN: 16, thighF: 22, shinF: 8, cloak: 16, plume: 30, wingN: -50, wingF: 40 },
  { torso: 18, head: 8, arm: hit[0], weapon: hit[1], arm2: -36, item2: -12, thighN: -40, shinN: 2, thighF: 34, shinF: 24, cloak: 28, plume: 38, wingN: 40, wingF: -40, $run: 0.16 },
  { torso: 8, head: 3, arm: fol[0], weapon: fol[1], arm2: -18, item2: -6, thighN: -26, shinN: 6, thighF: 24, shinF: 14, cloak: 16, plume: 24, wingN: 14, wingF: -14 },
];
const footHurt = [{ torso: -18, head: -14, arm: -30, weapon: -10, arm2: 30, item2: 10, thighN: 10, shinN: 20, thighF: -14, shinF: 10, cloak: -12, plume: -20, wingN: -30, wingF: 30 }];
const footFall = [
  { torso: -24, head: -16, arm: -60, weapon: -20, arm2: 40, item2: 20, thighN: 16, shinN: 26, thighF: -10, shinF: 30, cloak: -20, plume: -30, wingN: -40, wingF: 40 },
  { torso: -55, head: -18, arm: -90, weapon: -40, arm2: 60, item2: 30, thighN: 30, shinN: 40, thighF: 10, shinF: 50, cloak: -40, plume: -50, wingN: -60, wingF: 50, $lie: true },
  { torso: -88, head: -4, arm: -110, weapon: -60, arm2: 80, item2: 40, thighN: 12, shinN: 10, thighF: 4, shinF: 16, cloak: -70, plume: -70, wingN: -80, wingF: 70, $lie: true },
  { torso: -90, head: 2, arm: -112, weapon: -64, arm2: 82, item2: 42, thighN: 10, shinN: 8, thighF: 2, shinF: 14, cloak: -72, plume: -72, wingN: -84, wingF: 74, $lie: true },
];
const footStates = (F) => ({ idle: Array.from({ length: 4 }, (_, i) => ({ mount: {}, rider: footIdle(i / 4) })), move: Array.from({ length: 8 }, (_, i) => ({ mount: {}, rider: footMove(i / 8) })),
  attack: footAttack(F.attack).map((r) => ({ mount: {}, rider: r })), hurt: footHurt.map((r) => ({ mount: {}, rider: r })), fall: footFall.map((r) => ({ mount: {}, rider: r })) });

const statesFor = (F) => {
  if (F.still) { const R0 = [{ mount: {}, rider: {} }]; return { idle: R0, move: R0, attack: R0, hurt: R0, fall: R0, walk: R0, gallop: R0, stand: R0, windup: R0, strike: R0, dead: R0 }; }
  const S2 = F.foot ? footStates(F) : { idle: Array.from({ length: 4 }, (_, i) => idlePose(i / 4)), move: Array.from({ length: 8 }, (_, i) => movePose(i / 8)),
    attack: attackPoses(F.attack), hurt: hurtPoses, fall: fallPoses };
  // a mount drawn with straight forelegs (no lifted leg in the picture): when the leg swings forward the hoof folds back at the knee
  if (F.spread != null) { const W = S2.attack[0]; S2.attack = [{ ...W, rider: { ...W.rider, banner: F.spread } }, ...S2.attack.slice(1)]; }   // 孔宣: the gathered frame raises his five-coloured train
  if (F.bannerSway != null) for (const L of Object.values(S2)) for (const P of L) if (P.rider && P.rider.banner != null) P.rider = { ...P.rider, banner: P.rider.banner * F.bannerSway };   // a tall standard sways less
  if (F.straightFore) for (const L of Object.values(S2)) for (const P of L) if (P.mount && P.mount.legA != null) P.mount = { ...P.mount, legA2: Math.max(0, -P.mount.legA) * 1.1 };
  return { ...S2, walk: S2.move, gallop: S2.move, stand: S2.idle, windup: S2.attack.slice(0, 1), strike: S2.attack.slice(1), dead: S2.fall };
};
const STATES = statesFor({});

export async function loadKeyFigures(keys = Object.keys(KEY_FIGURES), { base = BASE, suffix = '', paper = null, dev = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) * 1.25 } = {}) {   // dev: device px per game px at the closest zoom the camera uses (dpr x 1.25)   // base/suffix: a review copy at another resolution; paper: '#EFE7D6' multiplies the parts into the paper at load (the game; the review sheets do it per layer)
  const figs = {};
  if (/[?&]drawcheck=nolive/.test((globalThis.location && location.search) || '')) keys = keys.filter((k) => k.startsWith('hero:'));   // the draw check's own test: no live key figure but the hero
  await Promise.all(keys.map(async (key) => { try {   // one figure's missing or broken atlas leaves that figure to the code puppet, never the others
    const F = KEY_FIGURES[key], meta = await (await fetch(base + F.file + suffix + '.json')).json();
    const img = new Image(); img.src = base + F.file + suffix + '.webp'; await img.decode();
    const mount = puppetOf(meta, img, 'mount', paper, F.drop), rider = puppetOf(meta, img, 'rider', paper, F.drop);
    // measure: rider's head top above the ground in the idle pose, to set the game scale
    const fig = { F, meta, mount, rider, seat: meta.seat, scale: 1, states: statesFor(F), foot: !!F.foot };
    const g = groundDrop(fig, STATES.idle[0]); const top = headTop(fig, STATES.idle[0]);
    fig.scale = F.height / (g - top);
    sharpen(fig, dev);
    for (const pup of [fig.mount, fig.rider]) for (const p of pup.parts) { p.uid = UID++; p.skin = skinOf(p); }   // after sharpen: uv in the final canvas px
    figs[key] = fig;
  } catch (e) { console.warn('key figure ' + key + ' not loaded: ' + (e && e.message)); } }));
  const TAU = Math.PI * 2, frac = (v) => v - Math.floor(v);
  const seen = new Map();
  const lastSt = new Map(), strikes = new Map();
  const lastPos = new Map();   // unit id -> [x, y, time, smoothed speed]   // unit id -> [state, time it left a wind-up]: a named foe's pattern ends its wind-up with no 'attack' state, so the blow is played here   // unit id -> 'under' while it is under the earth, then the time it came up
  const queue = Object.values(figs).flatMap((f) => [...f.mount.parts, ...f.rider.parts].map((p) => p.cv));
  return {
    /** Upload part images to a GL context ahead of need, at most n a call (ctx.prewarm from art/render/glctx.js); true when all are done. */
    /** Upload one figure's part images ahead of its arrival (art.warm(kind) from the page, ~25 s before a boss comes): n a call; true when done. */
    warm(ctx, key, n = 24) { const f = figs[key]; if (!f || !ctx || !ctx.prewarm) return true; f._w = f._w || [...f.mount.parts, ...f.rider.parts].map((p) => p.cv); for (let i = 0; i < n && f._w.length; i++) ctx.prewarm(f._w.pop()); return !f._w.length; },
    prewarm(ctx, n = 12) { if (!ctx || !ctx.prewarm) return true; for (let i = 0; i < n && queue.length; i++) ctx.prewarm(queue.pop()); return !queue.length; },
    figs, states: STATES, has: (key) => !!figs[key],
    /** For the art module: which frame a unit of the rules shows. Its states: walk, idle, windup, attack, skill, charge, stun, dead. */
    pick(key, u, now, x, y) {
      const st = u.state, t = u.stateT || 0, S = figs[key].states;
      switch (st) {
        case 'dead': return ['fall', Math.min(S.fall.length - 1, Math.floor(t / 0.14))];
        case 'windup': return ['windup', 0];
        case 'attack': case 'skill': return ['strike', Math.min(S.strike.length - 1, Math.floor(t / 0.14))];
        case 'stun': return ['hurt', 0];
        case 'walk': case 'charge': return ['move', Math.floor(frac((x * 0.9 + y * 0.6) / 260 + (u.id || 0) * 0.37) * S.move.length)];
        default: return ['idle', Math.floor(frac(now * 0.9 + (u.id || 0) * 0.29) * S.idle.length)];
      }
    },
    /** For the art module: the hero (武王) by his rules state; phase is his stride (0..1); edge > 0 draws his cinnabar hit edge behind him. */
    drawHero(ctx, key, h, X, Y, z, phase, now, edge = 0, edgeColour = '#B8321F', grow = 0.07, shadow = true, o = {}) {
      const fig = figs[key], S = fig.states, t = h.stateT || 0, flip = o.face ?? (h.facing < 0 ? -1 : 1);
      let P;
      if (fig.F.motion) P = heroPose(fig, h, phase, now, o);
      else {
        let st = 'move', i = Math.floor(phase * S.move.length) % S.move.length;
        if (h.state === 'fall') { st = 'fall'; i = t < 0.35 ? 0 : t < 0.58 ? 1 : t < 0.78 ? 2 : 3; }
        else if (h.state === 'dash') { st = 'attack'; i = 1; }
        else if (h.state === 'hurt' && t < 0.12) { st = 'hurt'; i = 0; }
        else if (h.state === 'idle' || !h.moving) { st = 'idle'; i = Math.floor(frac(now * 0.9) * S.idle.length); }
        P = S[st][i % S[st].length];
      }
      if (edge > 0) {   // his silhouette in cinnabar, a little larger, behind him
        const n = Math.ceil(fig.F.height * 2.6 * z), c = this._edge || (this._edge = document.createElement('canvas'));
        if (c.width !== n) { c.width = n; c.height = n; } const e = c.getContext('2d'); e.setTransform(1, 0, 0, 1, 0, 0); e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, n, n);
        drawFigure(e, fig, P, n / 2, n * 0.72, fig.scale * z, flip, 1); e.setTransform(1, 0, 0, 1, 0, 0); e.globalCompositeOperation = 'source-in'; e.fillStyle = edgeColour; e.fillRect(0, 0, n, n);
        ctx.setTransform(1 + grow, 0, 0, 1 + grow, X - (n / 2) * (1 + grow), Y - n * 0.72 * (1 + grow) + n * 0.02); ctx.globalAlpha = edge; ctx.drawImage(c, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      }
      const sh = shadow && fig.F.shadow; if (sh && !P.off) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(30,26,22,${sh[2]})`); g.addColorStop(1, 'rgba(30,26,22,0)');
        ctx.setTransform(sh[0] * z * Math.max(0.3, Math.abs(flip)), 0, 0, sh[1] * z, X, Y + z); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); }
      const box = drawFigure(ctx, fig, P, X, Y, fig.scale * z, flip, 1);
      if (fig.F.weapons && fig._Mr && shadow) {   // the weapon's striking end this frame, for art/fx (heroWeapon): the far end of the cell, or the grip for the bow
        const w = (o.weapon && fig.F.weapons[o.weapon.id]) || fig.F.weapons.spear, p = fig.rider.byId[w.part], m = fig._Mr[w.part];
        if (p && m) { const lx = w.tip === 'grip' ? 0 : w.tip === 'left' ? p.ox : p.ox + p.w, ly = w.tip === 'grip' ? 0 : p.oy + p.h / 2; const [tx, ty] = apply(m, lx, ly);
          this.tip = { tipX: tx, tipY: ty, id: o.weapon ? o.weapon.id : 'spear', since: o.since ?? 9, blowAt: 0 }; } }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return box;
    },
    /** For the art module: shadow and figure of a unit at screen (X, Y), scale z (the camera's zoom times the pixel ratio). */
    drawUnit(ctx, key, u, X, Y, z, now, x, y, alpha = 1, shadow = true, face = null, o = {}) {   // face: the eased facing (-1..1, art/index.js faceOf)
      if (u.state === 'gone' || u.state === 'under') { if (u.state === 'under') seen.set(u.id, 'under'); return null; }   // on the wind, under the earth: the effects draw that
      const F0 = figs[key].F;
      if (F0.forms && F0.forms.stone && u.guardT > 0 && figs[F0.forms.stone]) key = F0.forms.stone;                   // 袁洪 turned to a stone by the road
      let rise = 1; if (!o.rising) { if (seen.get(u.id) === 'under') { seen.set(u.id, now); } const r0 = seen.get(u.id); if (typeof r0 === 'number') { rise = Math.min(1, (now - r0) / 0.45); if (rise >= 1) seen.delete(u.id); } }   // o.rising: the inner draw of the rise itself (it must not rise again)
      if (rise < 1) {   // coming up out of the ground: drawn lower and clipped at the ground line
        const h = figs[key].F.height * z; ctx.save(); ctx.beginPath(); ctx.rect(X - 4 * h, Y - 4 * h, 8 * h, 4 * h + 2 * z); ctx.clip();
        const b = this.drawUnit(ctx, key, { ...u, state: 'attack', stateT: 0.02 }, X, Y + (1 - rise) * h * 1.05, z, now, x, y, alpha, false, face, { ...o, rising: true }); ctx.restore(); return b; }
      { const L = lastSt.get(u.id); if (L && L[0] === 'windup' && u.state !== 'windup' && u.state !== 'charge' && u.state !== 'dead') lastSt.set(u.id, [u.state, now]); else if (!L || L[0] !== u.state) lastSt.set(u.id, [u.state, L && L[1] != null && now - L[1] < 0.6 ? L[1] : null]);
        const L2 = lastSt.get(u.id); if (L2[1] != null && now - L2[1] < 0.6 && u.state !== 'windup') u = { ...u, state: 'attack', stateT: now - L2[1] }; }
      if (!o.rising) { const L = lastPos.get(u.id), dt = L ? now - L[2] : 0;   // his speed on the ground, smoothed over ~0.15 s
        if (!L) lastPos.set(u.id, [x, y, now, 0]); else if (dt > 0.001) { const v = Math.hypot(x - L[0], y - L[1]) / dt, k = Math.min(1, dt / 0.15); L[3] += (v - L[3]) * k; L[0] = x; L[1] = y; L[2] = now; }
        o = { ...o, v: (lastPos.get(u.id) || [0, 0, 0, 0])[3] }; }
      // a true form's strike: the time of his last cast and the period between casts (strikes: id -> [cast, period]), so the
      // blow travels on past the rules' 0.3 s attack state and he gathers a little before the next one is due
      if ((figs[key].F.glide || figs[key].F.travel) && !o.rising) { const r = strikes.get(u.id), st0 = now - (u.stateT || 0);
        if (u.state === 'attack' && (!r || st0 - r[0] > 0.35)) strikes.set(u.id, [st0, r ? Math.min(2, Math.max(0.4, st0 - r[0])) : 0]);
        const r2 = strikes.get(u.id); if (r2) { let sk = now - r2[0]; const d = sk - r2[1];
          if (sk >= 0.7 && r2[1] && d > -0.22 && d < 0.35) { const f = d < 0 ? 0.6 * (d + 0.22) / 0.22 : d < 0.15 ? 0.6 : 0.6 * Math.max(0, 1 - (d - 0.15) / 0.2); sk = -0.22 + 0.25 * f; }
          o = { ...o, strike: sk }; } }
      const fig = figs[key], P = unitPose(fig, u, now, x, y, o), st = u.state === 'dead' ? 'fall' : '', sh = shadow && fig.F.shadow, flip = face ?? (u.facing < 0 ? -1 : 1);
      if (sh && st !== 'fall') { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(30,26,22,${sh[2]})`); g.addColorStop(0.6, `rgba(30,26,22,${sh[2] * 0.6})`); g.addColorStop(1, 'rgba(30,26,22,0)');
        ctx.setTransform(sh[0] * z, 0, 0, sh[1] * z, X, Y + z); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); }
      const box = drawFigure(ctx, fig, P, X, Y, fig.scale * z, flip, alpha); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return box;
    },
    count: (key, state) => ((figs[key] ? figs[key].states : STATES)[state] || []).length,
    /** paint frame i of a state with the ground point at (x, y). flip -1 faces left. px multiplies the game scale. */
    draw(ctx, key, state, i, x, y, { flip = 1, px = 1, alpha = 1 } = {}) {
      const fig = figs[key], frames = fig && fig.states[state]; if (!frames) return false;
      const P = frames[i % frames.length];
      const box = drawFigure(ctx, fig, P, x, y, fig.scale * px, flip, alpha);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return box;   // truthy: the box [left, top, right, bottom] in the context's px
    },
  };
}

// ---- the hero's motion, built each frame (motion.js): the gallop from his speed and stride, the rider's seat and lean, the weapon's
// beats from the rules' weapon (o.weapon = g.build.weapon {id, cd}; o.since = seconds since its last cast; o.reach = a foe in reach),
// cloth that trails with speed and snaps on a blow, hurt and the fall.
function heroPose(fig, h, phase, now, o) {
  const F = fig.F, st = h.state, t = h.stateT || 0;
  if (st === 'fall') {   // the old fall frames, with the arm and weapon of the new rig
    const L = fig.states.fall, P = L[t < 0.35 ? 0 : t < 0.58 ? 1 : t < 0.78 ? 2 : 3], W = F.weapons[(o.weapon && o.weapon.id) || 'spear'] || F.weapons.spear;
    return { ...P, rider: { ...P.rider, armU: -60, armF: -40, [W.part]: -30, $hide: hideBut(F, W.part) } };
  }
  const speed = st === 'dash' ? 420 : h.moving ? Math.hypot(h.vx || 0, h.vy || 0) : 0, still = speed < 8, g = Math.min(1, speed / 300), cry = !!h.fullCry;
  const mount = mountPose(phase, speed, cry, still);
  if (still) { const b = Math.sin(now * 2.2); mount.neck = -2 + 3 * Math.sin(now * 0.7) * Math.sin(now * 1.9); mount.tail = -6 + 5 * Math.sin(now * 1.3); mount.body = 0.4 * b; mount.$bob = 0.8 * b; }
  // the rider: sits into the stride (the seat moves with the body; he absorbs half the rock), leans into speed
  const rock = Math.sin((phase + 0.1) * Math.PI * 2);
  const R = { torso: 4 * g + (cry ? 3 : 0) - mount.body * 0.6 + 1.5 * g * rock, head: -2 * g - 1.2 * g * rock, legN: 5 * g * Math.sin(phase * Math.PI * 2 + 1), legF: -4 * g * Math.sin(phase * Math.PI * 2 + 1) };
  // the weapon
  const w = o.weapon || { id: 'spear', cd: 9 }, W = F.weapons[w.id] || F.weapons.spear;
  const beat = weaponBeat(w.id, o.reach ? w.cd : 9, o.since ?? 9), A = W[beat[0]], B = W[beat[1]], wp = lerpPose(A, B, beat[2]);
  const T = WEAPON_TIME[w.id] || WEAPON_TIME.spear, sn = o.since ?? 9, snap = sn < T.F + T.R ? 1 - sn / (T.F + T.R) : 0;
  R.torso += wp.torso || 0; R.head += (wp.head || 0) - (wp.torso || 0) * 0.5;   // the head stays on the foe while the body works
  R.armU = wp.armU; R.armF = wp.armF + 4 * g * rock; R.hand = 0; R[W.part] = wp.w;
  if (st === 'dash') { mount.body = (mount.body || 0) - 4; R.torso += 8; }   // the spring: he lies along the neck
  const tr = trail(now, speed, snap); R.cloak = tr.cloak; R.plume = tr.plume; R.banner = tr.banner * (F.bannerSway ?? 1); R.canopy = -0.25 * (tr.banner * (F.bannerSway ?? 1)) - 2 * g;   // the 华盖 leans back a little with speed: his mark of shape (no general has one)
  // hurt (0.25 s): the blow throws him back, the horse checks and throws its head
  if (st === 'hurt') { const k = Math.max(0, 1 - t / 0.25), e = k * k * (3 - 2 * k);
    R.torso -= 16 * e; R.head -= 12 * e; R.armU -= 20 * e; R.cloak -= 14 * e; mount.body = (mount.body || 0) - 7 * e; mount.neck = (mount.neck || 0) - 16 * e; mount.legA = (mount.legA || 0) - 22 * e; mount.legB = (mount.legB || 0) - 14 * e; }
  R.$hide = hideBut(F, W.part);
  { // anticipation and weight: he gathers (the torso settles and widens, the horse sinks onto its haunches), then stretches into the blow
    const an = beat[1] === 'wind' ? beat[2] : beat[0] === 'wind' ? 1 - beat[2] : 0, st = beat[1] === 'hit' ? beat[2] : beat[0] === 'hit' ? 1 - beat[2] : 0;
    if (an || st) { R.$sq = { torso: [1 + 0.05 * an - 0.04 * st, 1 - 0.08 * an + 0.07 * st] }; mount.$sq = { body: [1 + 0.02 * an - 0.01 * st, 1 - 0.04 * an + 0.02 * st] }; } }
  // the drawn reach follows the rules' (SPEC-CAMPAIGN 2.4 × g.mods.area, read off the cast event): the weapon is drawn longer along its shaft
  { const base = W.reach, rp = o.reachPx || base; let k = base ? Math.min(2.2, Math.max(0.5, (rp / base) * (REACH_AT / F.height))) : 1;   // the weapons were sized for his blow to reach the rules' number at height REACH_AT   // the heavy whip blow's cast already carries its wider radius
    if (Math.abs(k - 1) > 0.001) R.$scale = { [W.part]: (k - W.hand) / (1 - W.hand) }; }
  const wave = { amp: 0.4 + 0.6 * g, phase: now * (3 + 2.5 * g) * 2, lean: 0, snap }; R.$wave = wave; mount.$wave = wave;
  return { mount, rider: R };   // no lunge of the whole figure: the blow's tip must sit at the rules' reach
}
// ---- every other live figure: the same standard, from the unit's rules state. o.warn = { shape, time } of the pattern he is
// winding up (art/index.js keeps it from the 'warn' event); u.actT counts down to the blow.
const frac = (v) => v - Math.floor(v);
const FREE = /^(weapon|w_\w+|hound|cloud|item2)$/;
const easeS = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function lerpP(A, B, t) {   // two whole poses {mount, rider, run, off, mfade}
  const o = { mount: lerpPose(A.mount || {}, B.mount || {}, t), rider: lerpPose(A.rider || {}, B.rider || {}, t) };
  for (const k of ['run', 'mfade']) if (A[k] != null || B[k] != null) o[k] = (A[k] ?? (k === 'mfade' ? 1 : 0)) + ((B[k] ?? (k === 'mfade' ? 1 : 0)) - (A[k] ?? (k === 'mfade' ? 1 : 0))) * t;
  if (A.off || B.off) { const a = A.off || [0, 0], b = B.off || [0, 0]; o.off = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  if (B.rider && B.rider.$lie && t > 0.5) o.rider.$lie = true; else if (A.rider && A.rider.$lie && t <= 0.5) o.rider.$lie = true;
  return o;
}
// The gathering before a warned blow, by the kind of pattern (the warn event's shape), so each reads differently from across the field:
//  a charge down a lane: head down, a forefoot pawing, the weapon couched at the hero (no rearing)
//  a blast, breath or shout aimed forward (cone, glare): leaning in, the weapon levelled at the hero and held
//  something round himself (ring, rings, bands, wall, dark, guard, summon): upright, the weapon raised high over the head, the mount's head up
//  a burst at close range (blast, burst): crouched low, the weapon cocked back, the mount sunk on its haunches
//  a throw or a strike at a point (one, circles, pair, scatter, and anything else): the rear, the weapon high and back (the figure's own gathered frame)
const SHAPE_GROUP = { lane: 'lane', line: 'lane', charge: 'lane', rush: 'lane', cone: 'cone', glare: 'cone', ring: 'round', rings: 'round', bands: 'round', wall: 'round', dark: 'round', guard: 'round', summon: 'round', blast: 'burst', burst: 'burst' };
function gatherFor(F, A, shape, foot, now) {
  const at = F.attack || CHOP, g = SHAPE_GROUP[shape];
  if (g === 'lane') return foot ? { mount: {}, rider: { ...A[0].rider, torso: 16, head: -6, arm: at.hit[0] * 0.6, weapon: at.hit[1], thighN: -20, shinN: 18, thighF: 22, shinF: 10 } }
    : { mount: { body: 5, neck: 12, legA: -45 * Math.abs(Math.sin(now * 8)), legA2: 40, legB: 10, legC: -10, legD: -6, tail: 16 }, rider: { torso: 14, head: -6, arm: at.hit[0] * 0.6, weapon: at.hit[1] } };
  if (g === 'cone') return { mount: foot ? {} : { body: 3, neck: 8, legA: -8, legB: 6, tail: 10 }, rider: { ...(foot ? A[0].rider : {}), torso: 9, head: shape === 'glare' ? -12 : 4, arm: at.hit[0], weapon: at.hit[1], arm2: -20, item2: -10 } };
  if (g === 'round') return { mount: foot ? {} : { body: -5, neck: -14, legA: -10, legB: 4, tail: 6 }, rider: { ...(foot ? A[0].rider : {}), torso: -10, head: -8, arm: at.up[0] - 25, weapon: at.up[1] - 10, arm2: 40, item2: 20 } };
  if (g === 'burst') return { mount: foot ? {} : { body: 6, neck: 10, legA: 14, legA2: 30, legB: 12, legC: -14, legD: -10, tail: 20 }, rider: { ...(foot ? A[0].rider : {}), torso: 16, head: 2, arm: at.up[0] * 0.5 + 30, weapon: at.up[1] + 20, thighN: foot ? -10 : 0, shinN: foot ? 30 : 0, thighF: foot ? 20 : 0, shinF: foot ? 30 : 0 } };
  return A[0];
}
// a god's strike (true forms): his joints may turn only maxTurn, so the travel is his whole figure's. Rows: seconds from the
// cast, lean (deg, at the root), lunge (share of his height), lift (share of his height), squash [x, y]; the arm and weapon
// go rest, up, hit, fol, rest with them (F.attack). Gathered back and up, the blow forward and down, the follow-through, home.
const STRIKE = [[-0.22, 0, 0, 0, 1, 1], [0.03, -9, -0.03, 0.05, 1.04, 0.94], [0.1, 11, 0.14, -0.015, 0.95, 1.06], [0.3, 5, 0.09, 0, 1, 1], [0.7, 0, 0, 0, 1, 1]];
function godStrike(F, base, s, foot) {
  const at = F.attack || CHOP, W = [null, at.up, at.hit, at.fol, null], br = base.rider;
  let i = 0; while (i < STRIKE.length - 2 && s > STRIKE[i + 1][0]) i++;
  const a = STRIKE[i], b = STRIKE[i + 1], q = easeS(Math.max(0, Math.min(1, (s - a[0]) / (b[0] - a[0])))), L = (j) => a[j] + (b[j] - a[j]) * q;
  const aw = (w, j) => (w ? w[j] : j ? br.weapon || 0 : br.arm || 0), A = (j) => aw(W[i], j) + (aw(W[i + 1], j) - aw(W[i], j)) * q;
  const rider = { ...br, arm: A(0), weapon: A(1), $sq: { torso: [L(4), L(5)] }, $lift: L(3) }, mount = { ...base.mount };
  if (foot) { rider.torso = (br.torso || 0) + L(1); rider.$run = L(2); }
  else { mount.body = (mount.body || 0) + 0.8 * L(1); mount.$lift = L(3); rider.torso = (br.torso || 0) + 0.4 * L(1); }
  return { mount, rider, run: foot ? 0 : L(2) };
}
function unitPose(fig, u, now, x, y, o = {}) {
  const F = fig.F, S = fig.states, st = u.state, t = u.stateT || 0, foot = fig.foot;
  if (F.still) return S.idle[0];
  if (st === 'dead') { const L = S.fall, q = Math.min(L.length - 1, t / 0.14), i = Math.floor(q); return i >= L.length - 1 ? L[L.length - 1] : lerpP(L[i], L[i + 1], easeS(q - i)); }
  // the gait follows how fast he really moves on the ground (o.v, px/s, measured by drawUnit), so a rush or a slide the rules give
  // any state name still gallops; the state names are the fallback when no measure exists yet
  const named = st === 'walk' || st === 'charge' || st === 'gallop' || st === 'skill', v = o.v;
  const moving = v != null ? v > 25 && st !== 'windup' && st !== 'stun' : named, fast = st === 'charge' || st === 'gallop' || (v != null && v > 220);
  const speed = moving ? (v != null ? Math.min(340, v * 1.15) : fast ? 300 : Math.min(200, (u.speed || 90) * 1.2)) : 0, g = Math.min(1, speed / 300), still = !moving;
  const stride = foot ? 0.9 * F.height + 40 : 2.1 * F.height + 30, phase = frac((x * 0.9 + y * 0.6) / stride + (u.id || 0) * 0.37);
  let base;
  if (foot) base = { mount: {}, rider: still ? footIdle(frac(now * 0.9 + (u.id || 0) * 0.29)) : footMove(phase) };
  else { const m = mountPose(phase, speed, fast, still); if (still) { const b = Math.sin(now * 2.2 + (u.id || 0)); m.neck = -2 + 3 * Math.sin(now * 0.7 + (u.id || 0)); m.tail = -6 + 5 * Math.sin(now * 1.3); m.body = 0.4 * b; m.$bob = 0.8 * b; }
    const rock = Math.sin((phase + 0.1) * Math.PI * 2);
    base = { mount: m, rider: { torso: 3 * g - (m.body || 0) * 0.6 + 1.5 * g * rock + 1 * Math.sin(now * 1.7 + (u.id || 0)), head: -1.5 * g * rock, arm: 3 * Math.sin(now * 1.5 + (u.id || 0)) + 3 * g * rock, weapon: -2 * Math.sin(now * 1.5 + 0.4) } }; }
  let P = base, snap = 0;
  const A = S.attack;
  if (st === 'windup') {   // the gathering, held and trembling until the blow; the pattern's shape bends it so each warned blow reads
    const k = o.warn && o.warn.time > 0 && u.actT != null ? Math.min(1, Math.max(0, 1 - u.actT / o.warn.time)) : Math.min(1, t / 0.45);
    const G = gatherFor(F, A, o.warn && o.warn.shape, foot, now);
    P = lerpP(base, G, easeS(Math.min(1, k * 1.8)));
    if (k > 0.6) { const q = (k - 0.6) / 0.4; P.rider.arm = (P.rider.arm || 0) + Math.sin(now * 47) * 3 * q; P.rider.torso += Math.sin(now * 39) * 1.2 * q; }
  } else if (st === 'attack' || (st === 'skill' && t < 0.6)) {
    P = t < 0.08 ? lerpP(A[0], A[1], easeS(t / 0.08)) : t < 0.3 ? lerpP(A[1], A[2], easeS((t - 0.08) / 0.22)) : lerpP(A[2], base, easeS(Math.min(1, (t - 0.3) / 0.3)));
    snap = Math.max(0, 1 - t / 0.4);
  } else if (st === 'stun') P = lerpP(base, S.hurt[0], t < 0.1 ? easeS(t / 0.1) : Math.max(0.55, 1 - (t - 0.1)));
  else if (st === 'rest' && !foot) {   // winded after a charge: head low, flanks heaving
    const k = Math.min(1, t / 0.25), hv = Math.sin(now * 6 + (u.id || 0));
    P = { mount: { ...base.mount, neck: (base.mount.neck || 0) + 16 * k, body: (base.mount.body || 0) + 2 * k + 0.8 * hv, $bob: 1.2 * hv }, rider: { ...base.rider, torso: (base.rider.torso || 0) + 6 * k, arm: (base.rider.arm || 0) + 10 * k } }; }
  // a true form's strike (o.strike: seconds from his cast, set by drawUnit) takes the place of the attack keys above
  if (F.glide && o.strike != null && o.strike > -0.22 && o.strike < 0.7 && st !== 'dead') { P = godStrike(F, base, o.strike, foot); snap = o.strike > 0.1 && o.strike < 0.5 ? 1 - (o.strike - 0.1) / 0.4 : 0; }
  // a fully rigged true form (F.travel) strikes on the same clock with its own attack keys: gathered before the cast, the blow,
  // the follow-through, and home by 0.7 s, past the rules' 0.3 s attack state
  else if (F.travel && o.strike != null && o.strike > -0.22 && o.strike < 0.7 && st !== 'dead' && st !== 'windup') { const s = o.strike;
    P = s < 0 ? lerpP(base, A[0], easeS((s + 0.22) / 0.22)) : s < 0.08 ? lerpP(A[0], A[1], easeS(s / 0.08)) : s < 0.3 ? lerpP(A[1], A[2], easeS((s - 0.08) / 0.22)) : lerpP(A[2], base, easeS((s - 0.3) / 0.4));
    snap = s > 0 && s < 0.4 ? 1 - s / 0.4 : 0; }
  if (F.glide) {   // a god does not stride: legs still, the figure floats with a slow bob and his cloud drifts (no holes where feet covered cloud)
    const M = P.mount === base.mount && P === base ? (P = { ...P, mount: { ...P.mount }, rider: { ...P.rider } }).mount : P.mount, Rr = P.rider;
    for (const k of ['legA', 'legB', 'legC', 'legD', 'legA2', 'legB2', 'legC2', 'legD2']) M[k] = 0;
    for (const k of ['thighN', 'thighF', 'shinN', 'shinF', 'legN']) Rr[k] = 0;
    const b = Math.sin(now * 1.6 + (u.id || 0)), hgt = F.height / fig.scale; if (foot) Rr.$bob = 3 * b - 3 + (Rr.$lift || 0) * hgt; else M.$bob = 3 * b - 3 + (M.$lift || 0) * hgt;
    Rr.cloud = 3 * Math.sin(now * 0.9); M.cloud = 3 * Math.sin(now * 0.9);
    Rr.hound = st === 'windup' ? 12 : st === 'attack' ? -34 * Math.max(0, 1 - t / 0.5) : 4 * Math.sin(now * 3.1);   // 哮天犬 crouches, then leaps with the blow
    if (!foot) { M.neck = (M.neck || 0) + 3 * Math.sin(now * 1.1); M.tail = 8 * Math.sin(now * 1.7); } }
  const tr = trail(now + (u.id || 0) * 0.3, speed, snap), R = P === base ? { ...P.rider } : P.rider;
  if (F.maxTurn) {   // a god is cut from one great picture: body parts turn only as far as the cut has paint under them; his weapon, hound and cloud turn freely
    const L = F.maxTurn, cl = (o2, root) => { for (const k in o2) if (k[0] !== '$' && typeof o2[k] === 'number' && !FREE.test(k) && k !== root) { const l = k === 'cloak' ? L / 2 : L; o2[k] = Math.max(-l, Math.min(l, o2[k])); } };   // the ribbons are the biggest cut: half the turn
    const rr = foot ? 'torso' : null; if (P.rider === R) { const c = { ...R }; cl(c, rr); Object.assign(R, c); } else cl(R, rr); if (P.mount) { P.mount = { ...P.mount }; cl(P.mount, 'body'); }
    for (const k of F.fixed || []) R[k] = 0; }   // parts whose cut opens at any turn
  { // squash and stretch: the wind-up settles and widens him, the blow stretches him out
    const an = st === 'windup' ? Math.min(1, t / 0.4) : 0, sx = st === 'attack' && t < 0.25 ? 1 - t / 0.25 : 0;
    if ((an || sx) && !R.$sq) R.$sq = { torso: [1 + 0.05 * an - 0.04 * sx, 1 - 0.08 * an + 0.07 * sx] }; }
  // a god's ribbons and aureole are big cut pieces: they sway a little and bend as strips
  { const c = F.glide ? 0.3 : 1; R.cloak = (R.cloak || 0) + (tr.cloak - 6) * c; R.plume = (R.plume || 0) + (tr.plume - 10) * c; }
  R.banner = (R.banner || 0) + tr.banner * (F.bannerSway ?? 1); R.flag = (R.flag || 0) + tr.banner;
  const wave = { amp: 0.4 + 0.6 * g, phase: now * (3 + 2.5 * g) * 2 + (u.id || 0), lean: 0, snap };
  R.$wave = wave; const Mo = P.mount === base.mount && P === base ? { ...P.mount } : P.mount; Mo.$wave = wave;
  return { ...P, mount: Mo, rider: R };
}

const HIDE = new Map();
function hideBut(F, part) { let m = HIDE.get(part); if (!m) { m = {}; for (const k in F.weapons) if (F.weapons[k].part !== part) m[F.weapons[k].part] = 1; HIDE.set(part, m); } return m; }

// The atlases hold about two atlas px per device px (dpr 2, zoom 1); drawn that much smaller with plain bilinear sampling (no mipmaps in
// art/render/glctx.js) the fine ink lines break up and go soft. So each part is shrunk once at load, by halving steps with high-quality
// smoothing (an area filter, as a mipmap would be), to ~1.15 px per device px at the closest zoom; the GL sampler then draws near 1:1.
function shrink(src, w, h) {
  let c = src;
  while (c.width / 2 >= w && c.height / 2 >= h) { const n = document.createElement('canvas'); n.width = Math.ceil(c.width / 2); n.height = Math.ceil(c.height / 2);
    const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n; }
  if (c.width === w && c.height === h) return c;
  const n = document.createElement('canvas'); n.width = w; n.height = h; const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h); return n;
}
function sharpen(fig, dev) {
  const f = fig.scale * dev * 1.15; if (!(f < 0.85)) return;
  for (const pup of [fig.mount, fig.rider]) for (const p of pup.parts) p.cv = shrink(p.cv, Math.max(2, Math.round(p.w * f)), Math.max(2, Math.round(p.h * f)));
}

function grow(box, pup, M, hide) {   // widen box [l, t, r, b] by every part's corners under its matrix (not the hidden ones)
  for (const p of pup.parts) { const m = M[p.id]; if (!m || (hide && hide[p.id])) continue; for (const [cx, cy] of [[p.ox, p.oy], [p.ox + p.w, p.oy], [p.ox, p.oy + p.h], [p.ox + p.w, p.oy + p.h]]) { const [x, y] = apply(m, cx, cy);
    if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y; if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y; } }
  return box;
}
function lowestAll(pup, pose) {
  const M = solveS(pup, [1, 0, 0, 1, 0, 0], pose); let y = -1e9;
  for (const p of pup.parts) { const m = M[p.id]; for (const [cx, cy] of [[p.ox, p.oy], [p.ox + p.w, p.oy], [p.ox, p.oy + p.h], [p.ox + p.w, p.oy + p.h]]) y = Math.max(y, apply(m, cx, cy)[1]); }
  return y;
}
function riderBase(fig, Mm) {   // the rider's root matrix: the mount body's matrix moved to the saddle point
  const mb = Mm[fig.seat.id], [sx, sy] = apply(mb, fig.seat.pt[0], fig.seat.pt[1]);
  return [mb[0], mb[1], mb[2], mb[3], sx, sy];
}
function groundDrop(fig, P) { if (fig.F && fig.F.fly != null) return lowestAll(fig.mount, P.mount);   /* the height is measured standing on the cloud; the hover is added when drawn */ return fig.foot ? lowest(fig.rider, P.rider) - (P.rider.$bob || 0) : lowest(fig.mount, P.mount) - (P.mount.$bob || 0); }
function headTop(fig, P) {
  const Mr = fig.foot ?solveS(fig.rider, [1, 0, 0, 1, 0, 0], P.rider) :solveS(fig.rider, riderBase(fig,solveS(fig.mount, [1, 0, 0, 1, 0, 0], P.mount)), P.rider);
  const hasHead = !!fig.rider.byId.head; let top = 1e9; for (const p of fig.rider.parts) { if (hasHead && p.id !== 'head') continue; const m = Mr[p.id];   // a figure with no head (a stone): the top of any part
    for (const [cx, cy] of [[p.ox, p.oy], [p.ox + p.w, p.oy], [p.ox + p.w / 2, p.oy]]) top = Math.min(top, apply(m, cx, cy)[1]); }
  return top;
}

// Cloth and hair bend as a strip where the context can (ctx.drawStrip of art/render/glctx.js; Canvas 2D draws them unbent):
// the edge each part hangs from. pose.$wave = { amp (share of the cell's free length), phase, lean, snap } drives them all.
// the 华盖 sways from its pole's foot, its dome and fringe swinging most; a god's loose ribbon tails (ribbon, ribbon2) hang from their top edge and float
const HANG = { tail: 'top', cloak: 'right', plume: 'right', banner: 'right', flag: 'right', canopy: 'bottom', ribbon: 'top', ribbon2: 'top' };
const AMP = { tail: 0.09, cloak: 0.06, plume: 0.1, banner: 0.05, flag: 0.06, canopy: 0.03, ribbon: 0.08, ribbon2: 0.08 };
const WV = { from: 'top', amp: 0, phase: 0, waves: 0.8, lean: 0, snap: 0, grow: 1.6, n: 8 };
// ---- the pose solved, with squash: pose.$sq = { id: [sx, sy] } scales a part (and what hangs from it) in its own frame.
// M0[id] is where the part would be held rigidly by its parent (its own turn zero): the skinned joint bends from there.
const M0 = {};
function solveS(pup, base, pose = {}) {
  const M = {}, sq = pose.$sq;
  for (const p of pup.parts) {
    const ang = (pose[p.id] ?? p.rot ?? 0) * D2R, c = Math.cos(ang), s = Math.sin(ang), q = sq && sq[p.id];
    const pm = p.parent ? M[p.parent] : base, x = p.parent ? p.at[0] : 0, y = p.parent ? p.at[1] : 0;
    const e = pm[0] * x + pm[2] * y + pm[4], f = pm[1] * x + pm[3] * y + pm[5];
    if (p.skin) { const m0 = M0[p.uid] || (M0[p.uid] = [0, 0, 0, 0, 0, 0]); m0[0] = pm[0]; m0[1] = pm[1]; m0[2] = pm[2]; m0[3] = pm[3]; m0[4] = e; m0[5] = f; }
    let a = pm[0] * c + pm[2] * s, b = pm[1] * c + pm[3] * s, cc = -pm[0] * s + pm[2] * c, d = -pm[1] * s + pm[3] * c;
    if (q) { a *= q[0]; b *= q[0]; cc *= q[1]; d *= q[1]; }
    M[p.id] = [a, b, cc, d, e, f];
  }
  return M;
}
// ---- skinned joints (where ctx.drawGrid exists, the WebGL context): a jointed part is laid as a small grid whose points near its
// pivot follow the parent and those past a band follow the part itself, blended smoothly between, so a knee, hock, elbow or neck
// BENDS instead of hinging with an overlap or a gap. Canvas 2D draws the parts rigid, as before.
const NOSKIN = /^(w_|weapon$|item2$|banner$|flag$|tail$|cloak$|plume$|breath$|canopy$|ribbon2?$)/;
let UID = 0;
const RIGID = /[?&]rigid\b/.test((globalThis.location && location.search) || '');   // ?rigid: the old hinged joints, for comparison
function skinOf(p) {
  if (!p.parent || NOSKIN.test(p.id) || Math.min(p.w, p.h) < 6) return null;
  const cx = p.ox + p.w / 2, cy = p.oy + p.h / 2, l = Math.hypot(cx, cy); if (l < 4) return null;
  const ax = cx / l, ay = cy / l, along = Math.abs(ax) > Math.abs(ay), cols = along ? 6 : 2, rows = along ? 2 : 6, n = (cols + 1) * (rows + 1);
  let L = 0; for (const [x, y] of [[p.ox, p.oy], [p.ox + p.w, p.oy], [p.ox, p.oy + p.h], [p.ox + p.w, p.oy + p.h]]) L = Math.max(L, x * ax + y * ay);
  const loc = new Float32Array(n * 2), uv = new Float32Array(n * 2), wt = new Float32Array(n), xy = new Float32Array(n * 2);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const k = j * (cols + 1) + i, x = p.ox + (p.w * i) / cols, y = p.oy + (p.h * j) / rows;
    loc[k * 2] = x; loc[k * 2 + 1] = y; uv[k * 2] = (p.cv.width * i) / cols; uv[k * 2 + 1] = (p.cv.height * j) / rows;
    const t = Math.max(0, Math.min(1, (x * ax + y * ay) / (0.5 * L))); wt[k] = t * t * (3 - 2 * t); }
  return { cols, rows, loc, uv, wt, xy };
}
function drawPup(ctx, pup, base, pose) {
  const M = solveS(pup, base, pose), hide = pose && pose.$hide, wv = pose && pose.$wave, strip = wv && ctx.drawStrip, grid = ctx.drawGrid && !RIGID && !(pose && pose.$rigid);
  for (const p of pup.order) {
    if (hide && hide[p.id]) continue;
    let m = M[p.id]; const sc = pose && pose.$scale && pose.$scale[p.id]; if (sc) { m = [m[0] * sc, m[1] * sc, m[2], m[3], m[4], m[5]]; M[p.id] = m; }   // drawn longer along its own x (a weapon's shaft)
    if (grid && p.skin) { const K = p.skin, m0 = M0[p.uid];   // the skinned joint: each grid point between the rigid hold and the part's own turn
      for (let k = 0, n = K.wt.length; k < n; k++) { const x = K.loc[k * 2], y = K.loc[k * 2 + 1], w = K.wt[k];
        const ax = m0[0] * x + m0[2] * y + m0[4], ay = m0[1] * x + m0[3] * y + m0[5], bx = m[0] * x + m[2] * y + m[4], by = m[1] * x + m[3] * y + m[5];
        K.xy[k * 2] = ax + (bx - ax) * w; K.xy[k * 2 + 1] = ay + (by - ay) * w; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawGrid(p.cv, K.cols, K.rows, K.xy, K.uv); continue; }
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const h = strip && HANG[p.id];
    if (h) { const L = h === 'top' || h === 'bottom' ? p.h : p.w; WV.from = h; WV.amp = wv.amp * AMP[p.id] * L; WV.phase = wv.phase + p.i * 0.7; WV.lean = (wv.lean || 0) * AMP[p.id] * L; WV.snap = wv.snap || 0;
      ctx.drawStrip(p.cv, 0, 0, p.cv.width, p.cv.height, p.ox, p.oy, p.w, p.h, WV); }
    else ctx.drawImage(p.cv, p.ox, p.oy, p.w, p.h);
  }
  return M;
}

function drawFigure(ctx, fig, P, x, y, k, flip, alpha) {
  if (fig.foot) {   // on foot: feet on the ground; lying, the lowest edge of any part on the ground (a little sunk, as cloth lies)
    const R = P.rider, drop = R.$lie ? lowestAll(fig.rider, R) - 6 : lowest(fig.rider, R) - (R.$bob || 0);
    const run = (R.$run || 0) * fig.F.height / fig.scale;   // a lunge forward on the blow
    const hover = R.$lie ? 0 : (fig.F.hover || 0) / fig.scale;   // a flyer (辛环) keeps off the ground until he falls
    ctx.globalAlpha = alpha; return grow([1e9, 1e9, -1e9, -1e9], fig.rider, drawPup(ctx, fig.rider, [flip * k, 0, 0, k, x + flip * run * k, y - (drop + hover) * k], R), R.$hide);
  }
  const fly = fig.F.fly != null, standDrop = fly ? lowestAll(fig.mount, STATES.idle[0].mount) : lowest(fig.mount, STATES.idle[0].mount);
  const drop = (fly ? lowestAll(fig.mount, P.mount) + fig.F.fly / fig.scale : lowest(fig.mount, P.mount)) - (P.mount.$bob || 0), run = (P.run || 0) * standDrop * 1.4;
  const base = [flip * k, 0, 0, k, x + flip * run * k, y - drop * k];
  let Mm = null;
  if ((P.mfade ?? 1) > 0) { ctx.globalAlpha = alpha * (P.mfade ?? 1); Mm = drawPup(ctx, fig.mount, base, P.mount); }
  ctx.globalAlpha = alpha;
  let rb;
  if (P.off) {   // thrown from the saddle: moved back and down from where the seat is at a stand; lying, the seat rests just above the ground
    const s = riderBase(fig,solveS(fig.mount, [1, 0, 0, 1, 0, 0], STATES.idle[0].mount)), seatY = s[5] - standDrop;   // seat height above the ground (negative)
    const sx = s[4] + P.off[0] * standDrop * 1.1, sy = seatY * (1 - P.off[1]) - standDrop * 0.1 * P.off[1];
    rb = [flip * k, 0, 0, k, x + flip * sx * k, y + sy * k];
  } else rb = riderBase(fig, Mm);
  const box = Mm ? grow([1e9, 1e9, -1e9, -1e9], fig.mount, Mm) : [1e9, 1e9, -1e9, -1e9];
  const Mr = drawPup(ctx, fig.rider, rb, P.rider); fig._Mr = Mr; return grow(box, fig.rider, Mr, P.rider.$hide);   // [left, top, right, bottom] of what was drawn, in the context's px
}
