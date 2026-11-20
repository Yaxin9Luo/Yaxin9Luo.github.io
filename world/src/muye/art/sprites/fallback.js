// What the art module cuts its frames from when `art/puppets/` is missing or fails to load: the same shape
// ({PUPPETS, createCutter}, see art/puppets/index.js), made from the side-view game's puppets (world/src/fengshen/art,
// read only). The mass of Shang is DERIVED here: each puppet filled in lacquer black with one piece kept in colour
// (the weapon's head, or the mask shield). The shaman, the strongman, the leader and the chariot are stand-ins.
// Open the preview with ?puppets=fallback to see it.
import { bake, drawPuppet, footDrop } from '../../../fengshen/art/engine.js';
import { hero as heroDef, zhou, shang, RIDER_PARTS } from '../../../fengshen/art/figures.js';
import { heroPose, footPose, kindOf } from '../../../fengshen/art/poses.js';

const FOOT = 0.54;
const rider = (o = {}) => ({ fullCry: false, state: 'ride', stateT: 1, x: 0, y: 0, vx: 320, vy: 0, facing: 1, hold: 0, cd: { gallop: 0, rally: 0 }, buffs: [], boons: [], topSpeed: 520, ...o });
const horsePose = (h, gait, phase) => { const base = heroPose(h, { gait, phase, t: 0 }, 0), pose = { ...base }; if (base.$torso != null) pose.torso = base.$torso; if (base.$head != null) pose.head = base.$head; return pose; };
const WALK = Array.from({ length: 6 }, (_, i) => ['walk', 0.3, i / 6]);
// a foot figure: frames are [state, t, phase] for footPose
const foot = (side, kind, def, scale, shadow, o = {}) => { const K = kindOf(kind, side), fr = (s, t, ph = 0) => ({ pose: footPose(kind, s, t, ph, 0.3, { side }) });
  return { side, scale: scale * K.scale, box: K.box, shadow, def, ...o, states: { walk: WALK.map((f) => fr(...f)), idle: [fr('idle', 0.4)], windup: [fr(kind === 'archer' ? 'draw' : 'windup', 0.4)], attack: [fr('attack', 0.1)], hurt: [fr('stun', 0.15)], dead: [fr('dead', 0.7)] } }; };
const mass = (kind, def, accent) => foot('shang', kind, def, FOOT, [19, 5.5, 0.3], { derive: accent });
const BAND = { shield: () => zhou({ weapon: 'sword', shield: 'tall', helm: 1 }), spear: () => zhou({ weapon: 'ge', helm: 0 }), archer: () => zhou({ weapon: 'bow', hand: 'bl', helm: 3, thin: true }) };
const captain = () => shang({ weapon: 'yue', long: true, helm: 2, standard: true, horn: true });
const HIDE_RIDER = Object.fromEntries(RIDER_PARTS.map((id) => [id, true]));

export const PUPPETS = {
  hero: { side: 'zhou', scale: 0.68, box: [-250, -400, 300, 60], shadow: [46, 11, 0.5], def: heroDef, horse: true,
    states: { gallop: Array.from({ length: 12 }, (_, i) => ({ pose: horsePose(rider(), 'gallop', i / 12) })), cry: Array.from({ length: 12 }, (_, i) => ({ pose: horsePose(rider({ fullCry: true, vx: 420 }), 'gallop', i / 12) })),
      stand: [{ pose: horsePose(rider({ vx: 0 }), 'stand', 0) }], spring: [0.12, 0.62].map((ph) => ({ pose: horsePose(rider({ state: 'dash', stateT: 0.3, vx: 520 }), 'gallop', ph) })),
      hurt: [{ pose: horsePose(rider({ state: 'hurt', stateT: 0.04 }), 'gallop', 0.3) }], fall: [{ pose: horsePose(rider({ vx: 0 }), 'stand', 0), alpha: 0.6 }] } },
  'shang:spear': mass('spear', () => shang({ weapon: 'ge', long: true, shield: true, hand: 'bl', shieldHand: 'al', helm: 1 }), ['w', 'wb']),
  'shang:axe': mass('axe', () => shang({ weapon: 'yue', long: true, helm: 2 }), ['w']),
  'shang:archer': mass('archer', () => shang({ weapon: 'bow', hand: 'bl', helm: 0, dense: true }), ['w', 'wd']),
  'shang:shield': mass('shield', () => shang({ weapon: 'yue', shield: 'mask', hand: 'bl', shieldHand: 'al', helm: 0 }), ['s']),
  'shang:shaman': foot('shang', 'captain', captain, FOOT * 0.9, [22, 6, 0.3]),                    // stand-in
  'shang:captain': foot('shang', 'captain', captain, FOOT * 1.75, [40, 9, 0.35]),
  'shang:leader': foot('shang', 'captain', captain, FOOT * 2.3, [54, 12, 0.35]),                  // stand-in
  'zhou:strongman': foot('zhou', 'shield', () => zhou({ weapon: 'sword', shield: 'tall', helm: 1, rank: true }), FOOT * 1.9, [36, 9, 0.5]),   // stand-in
  // stand-in: two of Jiliang without the rider, darkened to lacquer, and a box and wheel as plain shapes
  'shang:chariot': { side: 'shang', scale: FOOT, box: [-190, -270, 500, 70], shadow: [120, 12, 0.3], states: { run: Array.from({ length: 6 }, (_, i) => ({ car: i / 6 })), wreck: [{ car: 0, alpha: 0.6 }] } },
};
for (const k in BAND) { const P = foot('zhou', k, BAND[k], FOOT * 0.92, [18, 5.5, 0.5]); P.tiers = { 1: P.states, 3: P.states, 5: P.states }; PUPPETS['zhou:' + k] = P; }

export function createCutter(px = 1) {
  const cache = new Map(), pupOf = (key, def, k, solid) => { const id = key + '|' + k + '|' + solid; if (!cache.has(id)) cache.set(id, bake(def(), k, 11 + key.length * 7, solid)); return cache.get(id); };
  const lift = (pup, pose, horse) => (horse ? Math.max(footDrop(pup, pose), (pose.$air || 0) * 1.22) : footDrop(pup, pose) * (1 - (pose.$fall || 0)) + 9 * (pose.$fall || 0) - (pose.$bob || 0));
  const scratch = document.createElement('canvas'), sx = scratch.getContext('2d');
  function car(ctx, x, y, s, phase, alpha) {
    const kh = 0.6 * px, hp = pupOf('horse', heroDef, kh, false), W = Math.ceil(720 * s), H = Math.ceil(360 * s), ox = 200 * s, oy = 300 * s;
    scratch.width = W; scratch.height = H;
    for (const [dx, dy, ph] of [[232, -9, 0.45], [206, 0, 0]]) { const pose = { ...heroPose(rider(), { gait: 'gallop', phase: (phase + ph) % 1, t: 0 }, 0) }; pose.$hide = { ...(pose.$hide || {}), ...HIDE_RIDER }; drawPuppet(sx, hp, [kh, 0, 0, kh, ox + dx * s, oy + dy * s - lift(hp, pose, true) * kh], pose); }
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-atop'; sx.fillStyle = 'rgba(27,21,18,0.8)'; sx.fillRect(0, 0, W, H); sx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha; ctx.drawImage(scratch, x - ox, y - oy);
    const c = ctx, bx = x, by = y - 46 * s; c.fillStyle = '#1b1512'; c.beginPath(); c.moveTo(bx - 60 * s, by - 26 * s); c.lineTo(bx + 60 * s, by - 30 * s); c.lineTo(bx + 52 * s, by + 22 * s); c.lineTo(bx - 52 * s, by + 22 * s); c.closePath(); c.fill();
    c.strokeStyle = '#b08a3c'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(bx - 58 * s, by - 22 * s); c.lineTo(bx + 58 * s, by - 26 * s); c.stroke();
    c.strokeStyle = '#1b1512'; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(bx + 54 * s, by + 8 * s); c.lineTo(x + 250 * s, y - 80 * s); c.stroke(); c.lineWidth = 3 * s; c.beginPath(); c.moveTo(bx - 46 * s, by - 26 * s); c.lineTo(bx - 52 * s, by - 150 * s); c.stroke(); c.fillRect(bx - 66 * s, by - 170 * s, 26 * s, 22 * s);
    const wr = 44 * s, wy = y - wr, a0 = phase * (Math.PI / 4); c.lineWidth = 6 * s; c.beginPath(); c.ellipse(bx, wy, wr * 0.86, wr, 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 2.4 * s;
    for (let q = 0; q < 8; q++) { const a = a0 + (q / 8) * Math.PI * 2; c.beginPath(); c.moveTo(bx, wy); c.lineTo(bx + Math.cos(a) * wr * 0.82, wy + Math.sin(a) * wr * 0.96); c.stroke(); }
    c.globalAlpha = 1;
  }
  return {
    count: (key, state, variant) => (((PUPPETS[key].tiers && PUPPETS[key].tiers[variant || 1]) || PUPPETS[key].states)[state] || []).length,
    draw(ctx, key, state, i, x, y) {
      const P = PUPPETS[key], f = (P.states[state] || [])[i]; if (!f) return false; const k = P.scale * px;
      if (f.car != null) { car(ctx, x, y, k, f.car, f.alpha ?? 1); return true; }
      const pup = pupOf(key, P.def, k, !!P.derive), up = lift(pup, f.pose, P.horse) * k; ctx.globalAlpha = (f.alpha ?? 1) * (P.derive ? 0.94 : 1); drawPuppet(ctx, pup, [k, 0, 0, k, x, y - up], f.pose);
      if (P.derive) { const col = pupOf(key, P.def, k, false), hide = {}; for (const p of col.parts) hide[p.id] = !P.derive.includes(p.id); ctx.globalAlpha = 1; drawPuppet(ctx, col, [k, 0, 0, k, x, y - up], { ...f.pose, $hide: { ...(f.pose.$hide || {}), ...hide } }); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return true;
    },
  };
}
