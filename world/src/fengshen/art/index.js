// The art of the side-view battle: jointed shadow puppets (cut here, once, into sprites) drawn between the ink scene
// (`scene2/`) and the brushwork effects (`fx2/`), all on one sheet of paper. Contracts: section 4 of
// lab/game-studies/PROTOTYPE-SPEC.md and lab/game-studies/SPEC-V2.md.
//
//   const art = await loadArt({lang, onProgress});   // resolves when the figures, the effects and the scene's first
//                                                    // place are ready; onProgress(done, total) counts files and keeps
//                                                    // being called while the later places arrive in the background
//   art.progress(); art.ready(n); art.whenAll;       // {done, total}; has place n (1..5) arrived; a promise for everything
//   art.setView({width, height, dpr});            // CSS pixels and device pixel ratio; call on resize
//   art.drawBack(ctx, cam, dt);                   // the scene behind the figures, then the effects' marks on the ground
//   art.drawFigures(ctx, cam, game, alpha, dt);   // warband, foes, the hero on Jiliang, arrows
//   art.drawEffects(ctx, cam, dt);                // the effects' strokes in front of the figures
//   art.drawFront(ctx, cam, dt);                  // rocks and reeds in front of everything
//   art.onEvent(event, game);                     // a simulation event moves the figures and is passed to the effects
//   art.setTime(k);                               // 0 dawn .. 1 dusk: paper tone and ink temperature only
//
// What the contract leaves open, and what this module does (see also review/NOTES.md):
//   - The canvas is drawn in DEVICE pixels. Every draw call saves the context, sets its own transform and restores it.
//   - cam.x is the world x at the middle of the view. cam.y lifts the camera (world units, up positive; 0 puts the
//     ground line where the scene says it is). cam.zoom scales about the middle of the ground line. shakeX / shakeY
//     are CSS pixels. art.toScreen(cam, x, y) gives the CSS pixel of a world point, for a HUD that points at things.
//   - One world pixel is one design unit: at a view 900 CSS pixels high and zoom 1 it is one CSS pixel.
//   - Puppet dye is laid INTO the paper (multiply); the few paint cells that hang on a figure are laid ON it.
import { setInk, bake, drawPuppet, solve, apply, footDrop } from './engine.js';
import { hero as heroDef, heroPieces, zhou, shang, C, boonMark, MARK_SLOTS, ELEMENT } from './figures.js';
import { heroPose, footPose, fallPose, newHeroMotion, kindOf, STEP } from './poses.js';

import { loadScene } from './scene2/index.js';
import { loadFx } from './fx2/index.js';
import FX from './baked/figures.json';            // the cells of the figures' own small atlas: the standard's cloth, the hoof flames, the arrow

const ATLAS = new URL('./baked/figures.webp', import.meta.url).href;
const VH = 900;                                   // the view height the figures are designed at
// how the puppets' ink is tempered from dawn to dusk (absorption per channel), as the first scene's tones were
const TONE_DAY = [1, 0.985, 0.94], TONE_DUSK = [1.1, 1, 0.84];
const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('art: cannot load ' + src)); i.src = src; });
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const INKS = { jiao: '#14110F', nong: '#35302B', zhong: '#6B645C', dan: '#A69F94', qing: '#D3CCBE', lacquer: '#1B1512' };

const HERO_S = 0.82;                                   // the hero's puppet scale
// Ranks (SPEC-V2 section 1): the three lanes are real ranks in depth, drawn 22 px apart, each smaller and paler by a
// clear step, so that three units at one x read as three soldiers standing behind one another.
const LANE = [{ k: 1, up: 0, fade: 1 }, { k: 0.9, up: 22, fade: 0.9 }, { k: 0.81, up: 44, fade: 0.8 }];
const LOUD = { brace: 1, draw: 1, windup: 1, attack: 1, block: 1, horn: 1 };   // a figure that is about to hurt is never paled by its rank
// Every figure, by `side:kind` (`:v` a veteran: bronze cap and shoulder plates). The bare names are the first prototype's.
const DEFS = {
  'zhou:shield': () => zhou({ weapon: 'sword', shield: 'tall', helm: 1 }), 'zhou:shield:v': () => zhou({ weapon: 'sword', shield: 'tall', helm: 1, rank: true }),
  'zhou:spear': () => zhou({ weapon: 'ge', helm: 0 }), 'zhou:spear:v': () => zhou({ weapon: 'ge', helm: 0, rank: true }),
  'zhou:archer': () => zhou({ weapon: 'bow', hand: 'bl', helm: 3, thin: true }), 'zhou:archer:v': () => zhou({ weapon: 'bow', hand: 'bl', helm: 3, thin: true, rank: true }),
  'shang:shield': () => shang({ weapon: 'yue', shield: 'mask', hand: 'bl', shieldHand: 'al', helm: 0 }),
  'shang:captain': () => shang({ weapon: 'yue', long: true, helm: 2, standard: true, horn: true }),
  soldier: () => zhou({ weapon: 'spear', helm: 1 }),
  officer: () => zhou({ weapon: 'sword', rank: true, cape: true, helm: 2 }),
  spear: () => shang({ weapon: 'ge', long: true, shield: true, hand: 'bl', shieldHand: 'al', helm: 1 }),
  axe: () => shang({ weapon: 'yue', long: true, helm: 2 }),
  archer: () => shang({ weapon: 'bow', hand: 'bl', helm: 0, dense: true }),
};
const scaleOf = (key) => { const [a, b] = key.split(':'); return (b ? kindOf(b, a) : kindOf(a)).scale; };
const ARMY_BOON = { spring: 1, arrowRain: 1, mirrorShields: 1 };
const SCR = { w: 620, h: 540, ox: 300, oy: 430 };       // the scratch buffer a puppet is assembled in (design units)
const HERO_BOX = [-290, -420, 310, 100];

// What swings by itself on the hero: each a point on a stick from its pivot (one verlet link; the pieces are rigid),
// pulled to its rest place by a spring, pushed by one wind, dragged by its pivot. The stride lifts every pivot at about
// 1.5 Hz, so stiff pieces are tuned well above that and soft cloth well below, all heavily damped.
// id, parent, rest direction of the piece's mass, length, Hz, damping ratio, sail (how much wind it takes), droop
const LINKS = [
  ['tail', 'hind', [-40, 8], 40, 2.9, 0.7, 0.5, 1.0], ['cape', 'torso', [-28, 10], 30, 3.0, 0.65, 0.6, 0.5], ['plume', 'head', [-30, -25], 38, 3.4, 0.6, 0.4, 0.2],
  ['mane1', 'neck', [-30, 10], 30, 3.2, 0.65, 0.5, 0.5], ['mane2', 'neck', [-30, 18], 34, 2.9, 0.65, 0.55, 0.5], ['mane3', 'neck', [-26, 26], 32, 2.7, 0.65, 0.6, 0.5],
  ['s1', 'neck', [-40, 20], 54, 0.95, 0.7, 1, 0.9],
  ['m1', 'pole', [-24, 6], 26, 1.05, 0.65, 1, 0.9], ['m2', 'pole', [-24, 6], 24, 0.95, 0.65, 1, 0.9], ['m3', 'pole', [-24, 6], 22, 0.9, 0.65, 1, 0.9],
  ['$flag', 'pole', [-1, 0.08], 70, 0.8, 0.65, 1.2, 1.0],
];
const DT = 1 / 120, TAU = Math.PI * 2;
const gust = (t) => 240 * (Math.sin(1.9 * t) + 0.6 * Math.sin(4.7 * t + 1.3));     // one wind for everything

/**
 * Loads the figures, the effects and the scene. Resolves when the figures are cut, the effects are in and the scene's
 * first place has arrived; the scene's later places come in the background. onProgress(done, total) counts files (the
 * scene's own files, the effects as one, the figures' atlas as one) and is called on every arrival, also after this
 * resolves, until done === total.
 */
export async function loadArt({ lang = 'en', onProgress } = {}) {
  const prog = { scene: { loaded: 0, total: 0 }, own: 0 }, OWN = 2;
  const report = () => { if (onProgress) try { onProgress(prog.scene.loaded + prog.own, prog.scene.total + OWN); } catch { /* the page's own business */ } };
  const mine = (p) => p.then((v) => { prog.own++; report(); return v; });
  const [scene2, fx2, atlas] = await Promise.all([
    loadScene({ onProgress: (loaded, total) => { prog.scene = { loaded, total }; report(); } }),
    mine(loadFx()), mine(loadImage(ATLAS)),
  ]);
  const fx = FX, WORLD = scene2.info.world;

  let W = 1440, H = 900, dpr = 1, S = 1, time = 0, inkStep = -1;
  let ucv = null, uctx = null;
  let pups = null, markPups = null, scratch = null, sctx = null, groundFrac = scene2.info.ground, volleyT = 9;
  const motion = new Map();                                  // per unit: {phase, seed}
  const hm = { ...newHeroMotion(), torso: { x: 5, v: 0 }, head: { x: -3, v: 0 }, pts: {}, ang: {}, shown: {}, step: -1, facing: 1, at: null, clock: 0, pose: null };

  // ---------------------------------------------------------------- view and tone
  function temper() {
    const a = TONE_DAY, b = TONE_DUSK, k = inkStep / 8;
    const t = (hex, d) => '#' + [0, 1, 2].map((i) => Math.round(255 * clamp((parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255) * Math.exp(-(b[i] - a[i]) * d * k))).toString(16).padStart(2, '0')).join('');
    for (const [name, d] of [['jiao', 1.2], ['nong', 1.2], ['zhong', 1], ['dan', 0.8], ['qing', 0.6], ['lacquer', 1.2]]) C[name] = t(INKS[name], d);
    setInk(C.jiao);
  }
  function cutAll(solid) {
    const px = S * dpr, off = heroPieces();
    pups = { hero: bake(heroDef(), HERO_S * px, 1, solid), rider: bake(off.rider, HERO_S * px, 3, solid), standard: bake(off.standard, HERO_S * px, 4, solid), heroAxe: bake(off.axe, HERO_S * px, 5, solid) };
    Object.keys(DEFS).forEach((key, i) => { pups[key] = bake(DEFS[key](), scaleOf(key) * px, 11 + i * 7, solid); });
    markPups = {};
    for (const el in ELEMENT) { markPups[el] = { shield: bake(boonMark('shield', el), 0.9 * px, 9, solid) }; for (const slot of MARK_SLOTS) markPups[el][slot] = bake(boonMark(slot, el), HERO_S * px, 9, solid); }
  }
  function rebake() {
    temper(); cutAll(false);
    const px = S * dpr;
    scratch = document.createElement('canvas'); scratch.width = Math.ceil(SCR.w * px * 1.7); scratch.height = Math.ceil(SCR.h * px * 1.7);   // room for the captain at 1.5
    sctx = scratch.getContext('2d');
  }
  function setView(v) {
    const nd = Math.min(v.dpr || 1, 2), ns = v.height / VH, changed = nd !== dpr || Math.abs(ns - S) > 1e-4 || !pups;
    W = v.width; H = v.height; dpr = nd; S = ns;
    scene2.setView({ width: W, height: H, dpr }); groundFrac = scene2.groundY() / H;
    if (fx2.setView) fx2.setView({ width: W, height: H, dpr });
    if (changed) rebake();
  }
  function setTime(k) {
    time = clamp(k); const step = Math.round(time * 8);
    scene2.setTime(time); fx2.setTime(time);
    if (step !== inkStep) { inkStep = step; if (pups) rebake(); }                // the puppets' ink follows the tone, in eight steps
  }
  inkStep = 0; setView({ width: 1440, height: 900, dpr: 1 });

  // ---------------------------------------------------------------- where things are
  // z: device pixels per world unit; (ox, oy): the device pixel of world (cam.x, cam.y)
  function frameOf(cam) {
    const zoom = cam.zoom || 1, z = S * zoom * dpr;
    return { z, zoom, ox: (W / 2 + (cam.shakeX || 0)) * dpr, oy: (H * groundFrac + (cam.shakeY || 0)) * dpr, cx: cam.x || 0, cy: cam.y || 0 };
  }
  const toScreen = (cam, x, y = 0) => { const f = frameOf(cam); return [(f.ox + (x - f.cx) * f.z) / dpr, (f.oy - (y - f.cy) * f.z) / dpr]; };

  // ---------------------------------------------------------------- the frame
  // Order of a frame: drawBack (the scene, then the effects' marks on the ground), drawFigures, drawEffects (the
  // effects' strokes over the figures), drawFront.
  function drawBack(ctx, cam, dt = 1 / 60) {
    ctx.save(); scene2.drawBack(ctx, cam); scene2.drawMid(ctx, cam, dt); ctx.restore();
    ctx.save(); fx2.drawUnder(ctx, cam, dt); ctx.restore();
  }
  function drawFront(ctx, cam, dt = 1 / 60) { ctx.save(); scene2.drawFront(ctx, cam, dt); ctx.restore(); }
  function drawEffects(ctx, cam, dt = 1 / 60) { ctx.save(); fx2.drawOver(ctx, cam, dt); ctx.restore(); }

  // ---------------------------------------------------------------- paint
  // a cell of the atlas, round its pivot at device pixel (x, y); k: size in world units; flip mirrors it before it is turned
  function cell(ctx, name, x, y, z, o = {}) {
    const q = fx.cells[name]; if (!q) return;
    const [cx, cy, cw, ch, px, py] = q, s = fx.scale, k = (o.k ?? 1) * z;
    ctx.setTransform(k * (o.flip || 1), 0, 0, k, x, y); ctx.rotate(o.rot || 0);
    ctx.globalAlpha = o.a ?? 1; ctx.globalCompositeOperation = o.op || 'source-over';
    ctx.drawImage(atlas, cx * s, cy * s, cw * s, ch * s, -px, -py, cw, ch);
  }
  function onEvent(e, game) {
    const x = e.x ?? 0;
    // what an event does to the figures, whichever effects module paints it
    switch (e.type) {
      case 'refuse': hm.refuse = { what: e.what === 'strike' ? 'strike' : 'leap', t: 0 }; break;   // sent by the page, not the simulation: an action that was pressed and not taken
      case 'fall': hm.fallDir = e.dir || 0; break;                               // which way the blow throws him; drawFigures plays the fall from hero.state
      case 'shock': hm.slamT = 0; break;                                         // the leap strike has landed: the SLAMMED pose
      case 'volley': volleyT = 0; break;                                         // the Zhou archers aim high together
      case 'blocked': { let best = null, d = 70; if (game && game.units) for (const u of game.units) if (u.kind === 'shield' && u.state !== 'dead' && Math.abs(u.x - x) < d) { d = Math.abs(u.x - x); best = u; }
        if (best) (motion.get(best.id) || motion.set(best.id, { phase: 0, seed: 0 }).get(best.id)).block = 0; break; }
      case 'captainHorn': if (game && game.units) for (const u of game.units) if (u.kind === 'captain') (motion.get(u.id) || motion.set(u.id, { phase: 0, seed: 0 }).get(u.id)).horn = 0; break;
      default: break;
    }
    fx2.onEvent(e, game);                                                        // every event goes to the effects; what they do not know they ignore
  }

  // ---------------------------------------------------------------- puppets
  // A puppet is assembled opaque-over-opaque in the scratch buffer (near parts hide far parts), then multiplied onto
  // the sheet: dye over paper, as the ink is. (X, Y): device pixel of its root. Returns a part's matrix in device pixels.
  function stamp(ctx, pup, k, flip, X, Y, pose, box, fade, op = 'multiply') {
    const ox = Math.round(SCR.ox * k), oy = Math.round(SCR.oy * k);
    const bx = Math.max(0, Math.floor(ox + box[0] * k)), by = Math.max(0, Math.floor(oy + box[1] * k));
    const bw = Math.min(scratch.width - bx, Math.ceil((box[2] - box[0]) * k)), bh = Math.min(scratch.height - by, Math.ceil((box[3] - box[1]) * k));
    if (bw <= 0 || bh <= 0) return null;
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(bx, by, bw, bh);
    const fxp = X - Math.floor(X), fyp = Y - Math.floor(Y);
    const M = drawPuppet(sctx, pup, [flip * k, 0, 0, k, ox + fxp, oy + fyp], pose);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = op; ctx.globalAlpha = fade;
    ctx.drawImage(scratch, bx, by, bw, bh, Math.floor(X) - ox + bx, Math.floor(Y) - oy + by, bw, bh);
    const tx = Math.floor(X) - ox, ty = Math.floor(Y) - oy;
    return (id) => { const m = M[id]; return [m[0], m[1], m[2], m[3], m[4] + tx, m[5] + ty]; };
  }
  // the buffer is cleared for the mirrored box too, before a mirrored figure is drawn
  function stampFig(ctx, pup, k, flip, X, Y, pose, box, fade, op) {
    return stamp(ctx, pup, k, flip, X, Y, pose, flip > 0 ? box : [-box[2], box[1], -box[0], box[3]], fade, op);
  }

  // the hero's springs and links, advanced in fixed steps in his own frame (x forward), so it runs the same at any frame rate
  function heroDynamics(h, pose, dt, x) {
    const facing = h.facing || 1, speed = Math.abs(h.vx);
    let init = hm.facing !== facing || !hm.pts.tail; hm.facing = facing;
    const n = init ? 1 : Math.max(1, Math.min(10, Math.round(dt / DT))), s = HERO_S, droop = clamp(1 - speed / 380);
    for (let i = 0; i < n; i++) {
      hm.clock += DT;
      for (const [sp, target, fr, z] of [[hm.torso, pose.$torso, 2.3, 0.6], [hm.head, pose.$head - 0.6 * (hm.torso.x - pose.$torso), 3.2, 0.6]]) {
        if (init) { sp.x = target; sp.v = 0; continue; }
        const w = TAU * fr; sp.v += (w * w * (target - sp.x) - 2 * z * w * sp.v) * DT; sp.x += sp.v * DT;
      }
      const full = { ...pose, torso: hm.torso.x, head: hm.head.x, ...hm.ang };
      const M = solve(pups.hero, [s, 0, 0, s, x * facing, -(Math.max(footDrop(pups.hero, full), pose.$air * 1.22) * s + h.y)], full), G = gust(hm.clock);
      for (const [id, parent, dir, L, fr, z, sail, hang] of LINKS) {
        const flag = id === '$flag', pm = M[parent], pv = flag ? apply(pm, 0, -86) : [M[id][4], M[id][5]];
        const rest = flag ? 0 : (pups.hero.byId[id].rot || 0);
        // at a stand everything hangs; at a gallop it streams back along its rest direction
        let a0 = Math.atan2(pm[1], pm[0]) + rest * Math.PI / 180 + Math.atan2(dir[1], dir[0]) - hang * droop * 1.05;
        // in full cry and in the flame gallop everything that streams is pulled flat out behind
        const cry = pose.$cry ? 0.7 * Math.atan2(Math.sin(Math.PI - a0), Math.cos(Math.PI - a0)) : 0; a0 += cry;
        const tx = pv[0] + Math.cos(a0) * L * s, ty = pv[1] + Math.sin(a0) * L * s;
        let p = hm.pts[id]; if (init || !p) p = hm.pts[id] = { x: tx, y: ty, px: tx, py: ty };
        const w = TAU * fr, vx = (p.x - p.px) / DT, vy = (p.y - p.py) / DT;
        const nx = p.x + vx * DT + (w * w * (tx - p.x) - 2 * z * w * vx - G * sail) * DT * DT, ny = p.y + vy * DT + (w * w * (ty - p.y) - 2 * z * w * vy) * DT * DT;
        p.px = p.x; p.py = p.y;
        const dx = nx - pv[0], dy = ny - pv[1], d = Math.hypot(dx, dy) || 1; p.x = pv[0] + dx / d * L * s; p.y = pv[1] + dy / d * L * s;   // the stick keeps its length
        let da = Math.atan2(p.y - pv[1], p.x - pv[0]) - (a0 - cry + hang * droop * 1.05); da = Math.atan2(Math.sin(da), Math.cos(da));
        hm.ang[id] = flag ? da : rest + da * 180 / Math.PI;
      }
      const st = Math.floor(hm.clock * STEP + 1e-6);                             // what is shown changes on the same beat as the poses
      if (st !== hm.step || init) { hm.step = st; hm.shown = { torso: hm.torso.x, head: hm.head.x, ...hm.ang }; }
      init = false;
    }
    return hm.shown;
  }


  // ---------------------------------------------------------------- the fall
  // The rider, his standard and his axe leave the horse as three rigid puppets of their own. Their places come from
  // hand-set keys (poses.js); what hangs on them (plume, scarf, yak tail, ribbons, the cloth) follows on loose springs
  // and settles. The rider keeps three quarters of the horse's onward travel, so he comes down just behind it.
  const SOFT = { plume: [1.7, 0.3], cape: [1.5, 0.35], m1: [1.3, 0.3], m2: [1.5, 0.28], m3: [1.7, 0.28], $flag: [1.2, 0.3] };
  function fallState(h, x, f) {
    let F = hm.fall;
    if (!F || h.stateT < F.lastT) {
      const facing = h.facing || 1, dir = hm.fallDir || -facing, m = hm.at && hm.at('torso');
      const seat = m ? (f.oy - m[5]) / f.z + f.cy : 150 * HERO_S;
      F = hm.fall = { x0: x, facing, dir, seat: clamp(seat, 80, 220), soft: {}, shown: {}, step: -1, clock: 0, lastT: 0 };
    }
    F.lastT = h.stateT; F.pose = fallPose(h.stateT);
    F.base = F.x0 + 0.75 * (x - F.x0);
    return F;
  }
  function drawFall(ctx, f, F, dt, f12) {
    const P = F.pose, s = F.dir * F.facing, k = HERO_S * f.z, lie = 13 * HERO_S;
    const R = P.rider, St = P.standard, A = P.axe, seat = F.seat;
    const rx = F.base + F.dir * 150 * HERO_S * R.e, ry = lie + (seat - lie) * R.h + R.lift * HERO_S;
    const sx = F.base + F.dir * St.d * HERO_S, sy = seat * St.y + St.lift * HERO_S;
    const ax = F.base - F.dir * A.d * HERO_S, ay = seat * A.y + A.lift * HERO_S;
    // what hangs: sprung toward the key's angle, shown on the same stepped beat as the poses
    const want = { plume: R.plume, cape: R.cape, m1: St.m, m2: St.m * 0.9, m3: St.m * 1.1, $flag: St.flag };
    const n = Math.max(1, Math.min(10, Math.round(dt / DT)));
    for (let i = 0; i < n; i++) {
      F.clock += DT;
      for (const id in SOFT) { const [fr, z] = SOFT[id], w = TAU * fr; let q = F.soft[id]; if (!q) q = F.soft[id] = { x: want[id], v: 0 };
        q.v += (w * w * (want[id] - q.x) - 2 * z * w * q.v) * DT; q.x += q.v * DT; }
      const st = Math.floor(F.clock * STEP + 1e-6); if (st !== F.step) { F.step = st; for (const id in SOFT) F.shown[id] = F.soft[id].x; }
    }
    const sh = F.shown, dev = (wx, wy) => [f.ox + (wx - f.cx) * f.z, f.oy - (wy - f.cy) * f.z];
    const BOX = [-190, -190, 190, 190];
    let [X, Y] = dev(sx, sy);
    const sm = stampFig(ctx, pups.standard, k, F.facing, X, Y, { pole: s * St.rot, m1: sh.m1, m2: sh.m2, m3: sh.m3 }, [-250, -250, 250, 250], 1);
    if (sm) { const pm = sm('pole'), fp = apply(pm, 0, -86); cell(ctx, `flag_${P.still ? 2 : f12 % fx.flagFrames}`, fp[0], fp[1], 0.8 * f.z, { flip: F.facing, rot: Math.atan2(pm[1], pm[0] * F.facing) + 0.08 + sh.$flag }); }
    [X, Y] = dev(ax, ay); stampFig(ctx, pups.heroAxe, k, F.facing, X, Y, { yue: A.rot }, BOX, 1);
    [X, Y] = dev(rx, ry); stampFig(ctx, pups.rider, k, F.facing, X, Y, { torso: s * R.rot, leg: R.leg, armU: R.armU, armL: R.armL, armF: R.armF, head: R.head, plume: sh.plume, cape: sh.cape }, BOX, 1);
  }

  function drawHero(ctx, f, h, alpha, dt) {
    const x = h.px + (h.x - h.px) * alpha, y = h.py + (h.y - h.py) * alpha;
    if (hm.slamT != null) { hm.slamT += dt; if (hm.slamT > 1) hm.slamT = null; }
    const fall = h.state === 'fallen' ? fallState(h, x, f) : (hm.fall = null);
    // when the rider lies behind the horse, the horse is turned to face him (the puppeteer flips the whole figure)
    const flip = fall && fall.pose.turn ? fall.dir : (h.facing || 1);
    if (flip !== (h.facing || 1)) h = { ...h, facing: flip };
    const base = heroPose({ ...h, y }, hm, dt), pose = { ...base, ...heroDynamics({ ...h, y }, base, dt, x) };
    if (fall) pose.$hide = base.$hide;
    // a refusal, on the figure itself. Leap refused (too slow): Jiliang tosses its head and stamps a forefoot.
    // Strike refused (pressed in the recovery): the axe arm jerks and is checked. Two held poses each, then back.
    const rf = hm.refuse;
    if (rf && !fall) { rf.t += dt; const t = Math.floor(rf.t * STEP + 1e-6) / STEP;
      if (rf.what === 'leap') { const up = t < 0.09 ? 1 : t < 0.21 ? 0.55 : 0, down = t >= 0.09 && t < 0.3 ? 1 : 0;
        pose.neck -= 15 * up - 5 * down; pose.fU -= 36 * up; pose.fL += 62 * up; if (pose.torso != null) pose.torso -= 5 * up;
        if (t >= 0.3) hm.refuse = null; }
      else { const j = t < 0.07 ? 1 : t < 0.15 ? -0.4 : 0; pose.armU -= 20 * j; pose.armL -= 10 * j; pose.yue -= 22 * j; if (t >= 0.15) hm.refuse = null; } }
    const k = HERO_S * f.z, height = Math.max(footDrop(pups.hero, pose), pose.$air * 1.22) * HERO_S;
    const X = f.ox + (x - f.cx) * f.z, Y = f.oy - (y - f.cy + height) * f.z;
    const at = stampFig(ctx, pups.hero, k, flip, X, Y, pose, HERO_BOX, 1); if (!at) return;
    const ang = (m) => Math.atan2(m[1], m[0] * flip);                             // a part's own angle, whichever way the figure faces
    const speed = Math.abs(h.vx), f12 = Math.floor(hm.clock * 12 + 1e-6);
    // the aura: where a hoof is near the ground and the horse is moving, a short wisp of cinnabar trails from it
    const blaze = h.state === 'dash' ? 1.8 : h.fullCry ? 1.3 : 1;                // the hooves burn harder in full cry, and hardest in the flame gallop
    if (speed > 90) pups.hero.feet.forEach((ft, i) => {
      const p = apply(at(ft.id), ft.pt[0], ft.pt[1]), up = (f.oy + f.cy * f.z + 4 * f.z - p[1]) / f.z; if (up > 70) return;
      cell(ctx, `wisp_red_${(f12 + i * 3) % 4}`, p[0] - 2 * flip * f.z, p[1] + f.z, f.z, { flip, a: Math.min(1, 1.3 - up / 70) * Math.min(1, 0.9 * blaze) * clamp((speed - 90) / 240), k: (0.9 + 0.12 * (i % 2)) * blaze });
    });
    // the cloth of the standard: a painted loop, hung on the pole under the yak tail, swinging on its own link
    if (fall) { drawFall(ctx, f, fall, dt, f12); hm.at = at; return; }
    // boon marks: each owned boon recolours one piece in its element's pigment (axe blade, two ribbons, scarf, plume)
    if (h.boons && h.boons.length) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.96;
      h.boons.slice(0, MARK_SLOTS.length).forEach((b, i) => { const mp = markPups[b.element] && markPups[b.element][MARK_SLOTS[i]]; if (mp) drawPuppet(ctx, mp, at(MARK_SLOTS[i]), {}); }); ctx.globalAlpha = 1; }
    const pm = at('pole'), fp = apply(pm, 0, -86);
    cell(ctx, `flag_${f12 % fx.flagFrames}`, fp[0], fp[1], 0.8 * f.z, { flip, rot: ang(pm) + 0.08 + (pose.$flag || 0) });
    hm.at = at;
  }

  function drawFigures(ctx, cam, game, alpha = 1, dt = 1 / 60) {
    const f = frameOf(cam), halfW = (W * dpr) / 2 / f.z + 160, seen = new Set();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    volleyT += dt; let armyEl = null; for (const b of (game.hero && game.hero.boons) || game.boons || []) if (ARMY_BOON[b.id]) armyEl = b.element;
    // The foot figures stand in ranks and must cover one another: dye multiplied on dye turns a block three deep into one
    // black mass. So they are assembled back rank first on a layer of their own, each one opaque over those behind it,
    // and the whole layer is laid into the paper once.
    const cv = ctx.canvas, many = game.units && game.units.length > 0;
    if (many) { if (!ucv || ucv.width !== cv.width || ucv.height !== cv.height) { ucv = document.createElement('canvas'); ucv.width = cv.width; ucv.height = cv.height; uctx = ucv.getContext('2d'); }
      uctx.setTransform(1, 0, 0, 1, 0, 0); uctx.globalAlpha = 1; uctx.globalCompositeOperation = 'source-over'; uctx.clearRect(0, 0, ucv.width, ucv.height); }
    const units = game.units ? [...game.units].sort((a, b) => (b.lane || 0) - (a.lane || 0) || (a.state === 'dead' ? -1 : 0) - (b.state === 'dead' ? -1 : 0)) : [];
    for (const u of units) {
      seen.add(u.id);
      let m = motion.get(u.id); if (!m) motion.set(u.id, m = { phase: (u.id * 0.37) % 1, seed: (u.id * 0.618) % 1 });
      const side = u.side, K = kindOf(u.kind, side); if (!K) continue;
      const key = `${side}:${u.kind}`, pup = (u.veteran && pups[key + ':v']) || pups[key] || pups[u.kind]; if (!pup) continue;
      const x = u.px + (u.x - u.px) * alpha;
      m.phase = (m.phase + Math.abs(u.x - u.px) * 60 * dt / K.stride) % 1;
      if (m.block != null) m.block += dt; if (m.horn != null) m.horn += dt;
      if (Math.abs(x - f.cx) > halfW) continue;
      const lane = LANE[u.lane || 0] || LANE[0], flip = u.facing || 1, blocking = m.block != null && m.block < 0.34;
      const pose = footPose(u.kind, u.state, u.stateT + alpha / 60, m.phase, m.seed, { side, block: m.block, horn: m.horn, volley: side === 'zhou' && volleyT < 1.6 }), fall = pose.$fall || 0;
      const sc = K.scale * lane.k, k = sc * f.z, drop = footDrop(pup, pose) * (1 - fall) + 9 * fall - (pose.$bob || 0);
      const jolt = u.flash > 0 ? Math.sin(u.flash * 190) * 3 * Math.min(1, u.flash * 8) : 0;
      const X = f.ox + (x + jolt - f.cx) * f.z, Y = f.oy - (lane.up - f.cy + drop * sc) * f.z;
      const fade = (LOUD[u.state] || blocking ? 1 : lane.fade) * (pose.$fade ?? 1), at = stampFig(uctx, pup, k, flip, X, Y, pose, K.box, fade, 'source-over');
      // an army boon is seen on the Zhou shields: boss and band in its element's pigment
      if (at && armyEl && side === 'zhou' && u.kind === 'shield' && u.state !== 'dead' && markPups[armyEl]) { uctx.globalCompositeOperation = 'source-over'; uctx.globalAlpha = 0.95 * fade; drawPuppet(uctx, markPups[armyEl].shield, at('s'), {}); }
    }
    if (many) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1; ctx.drawImage(ucv, 0, 0); }
    if (motion.size > seen.size + 40) for (const id of motion.keys()) if (!seen.has(id)) motion.delete(id);
    if (game.hero) drawHero(ctx, f, game.hero, alpha, dt);
    // arrows: one line of ink each, turned along its flight
    if (game.arrows) for (const a of game.arrows) {
      const x = a.px + (a.x - a.px) * alpha, y = a.py + (a.y - a.py) * alpha; if (Math.abs(x - f.cx) > halfW) continue;
      cell(ctx, 'arrow', f.ox + (x - f.cx) * f.z, f.oy - (y - f.cy) * f.z, f.z, { rot: Math.atan2(-a.vy, a.vx) });
    }
    ctx.restore();
  }

  return {
    setView, setTime, drawBack, drawFigures, drawFront, drawEffects, onEvent, toScreen,
    /** files arrived and files in all, as onProgress reports them */
    progress: () => ({ done: prog.scene.loaded + prog.own, total: prog.scene.total + OWN }),
    /** has place n (1..5) of the road arrived? and a promise for all of them */
    ready: (n) => scene2.ready(n), whenAll: scene2.whenAll,
    /** numbers a page may want: the world's length, where the ground line is in the view (0..1), the units' scale */
    info: { world: WORLD, get ground() { return groundFrac; }, lang },
    /** for the preview and for tests of the art: bake a silhouette set, read counts */
    debug: {
      get pups() { return pups; }, hero: hm, kinds: Object.keys(DEFS), scene: scene2, fx: fx2,
      silhouettes(on) { if (on) cutAll(true); else rebake(); },
    },
  };
}
