// The effects of the survivors-like, redone (review/DESIGN.md). Contract: SPEC-SURVIVORS section 5.
//
//   const fx = await loadFx();        // resolves at once; the stroke sheets load behind it (nothing blocks the first frame)
//   fx.onEvent(event, game);          // a rules event; `game` is kept and read while drawing
//   fx.drawGround(ctx, cam, dt);      // under the figures: what lies on the ground, and what passes behind them
//   fx.drawOver(ctx, cam, dt);        // over the figures
//   fx.setTime(k); fx.reset();
//
// The view is the art module's: device px per world unit = cam.zoom * dpr; the camera's point at (width / 2, height * 0.52);
// a ground point (x, y) is drawn at (x, 0.62 y); a height h is drawn h straight up.
//
// Every effect lives in three beats (DESIGN.md "Time"): GATHER, a pale ink bone or a shadow, low contrast; BURST, the
// pressed stroke at full value for a few frames; LINGER, the stroke goes dry, breaks up and sinks into the paper.
// What the player must read comes first: round the hero and round every foe winding up a blow, the player's own
// effects thin out (veil); nothing a past blow leaves on the ground stays darker than the lightest foe after 0.4 s, and
// it is gone by 1.2 s.
//
// Every effect is drawn here; the first pass (legacy.js) is gone.
import { createGLFx } from './gl/index.js';
import { createCanvasMoments } from './canvas-moments.js';   // the great moments drawn cheaply when there is no GL (old machines, lost context)      // the WebGL2 effects (ink in wet paper, heavy blows, weather): only when the context has GL
const FILES = { json: new URL('./baked/atlas.json', import.meta.url).href, main: new URL('./baked/fx-main.webp', import.meta.url).href, soft: new URL('./baked/fx-soft.webp', import.meta.url).href, big: new URL('./baked/fx-big.webp', import.meta.url).href };
// the sheets are kept as ImageBitmaps: an <img> may be dropped from the decoded-image cache and decoded again in the middle of a
// draw (a trace at 4x throttle put 2.2 ms of 'Decode Image' inside every slow frame); a bitmap stays decoded
const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => { if (globalThis.createImageBitmap) createImageBitmap(i).then(ok, () => ok(i)); else ok(i); }; i.onerror = () => no(new Error('fx: cannot load ' + src)); i.src = src; });
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), TAU = Math.PI * 2, PI = Math.PI;
const ease = (u) => 1 - (1 - u) * (1 - u), easeIn = (u) => u * u, smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { n = Math.imul(n | 0, 374761393); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
// a mark left on the ground by a blow: full for the blow itself, then under the lightest foe's value by 0.4 s, gone by 1.2 s
const sink = (s) => (s < 0.12 ? 1 : s < 0.4 ? 1 - ((s - 0.12) / 0.28) * 0.74 : s < 1.2 ? 0.26 * (1 - (s - 0.4) / 0.8) : 0);
const TROOP = { shields: 'earth', spears: 'metal', archers: 'wood', strongmen: 'earth', chariots: 'metal', tigers: 'fire', acolytes: 'water', hooks: 'wood' };
const GEN = { nezha: 'fire', yangjian: 'metal', leizhenzi: 'wood', tuxingsun: 'earth', dengchanyu: 'water', huangfeihu: 'earth' };
const NEW = { fireCover: 1, sash: 1, seal: 1, fireSpear: 1, pearls: 1, whip: 1, ring: 1, banner: 1 };          // the treasures
// the kinds of the rules' shots this module draws; the art module reads this so it never draws them a second time
export const SHOT_KINDS = new Set(['pearls', 'ring', 'boulder', 'blade', 'talisman', 'stone']);
const CLEAR = { rx: 70, ry: 58, up: 44, floor: 0.06 };   /* floor .06: nothing opaque over the hero (the lead, 2026-11-25) */     // the hero's patch: an ellipse round his middle (units), what is left at its heart
const VEIL = 0.3;                                          // what is left of the player's effects over a foe winding up a blow

export async function loadFx({ ky = 0.62, horizon = 0.52 } = {}) {
  const KY = ky;
  const atlas = await fetch(FILES.json).then((r) => r.json());
  const IMG = [null, null, null], WARM = [0, 0, 0], CELL = atlas.cells, count = {};
  loadImage(FILES.main).then((i) => (IMG[0] = i)).catch((e) => console.warn(e));
  loadImage(FILES.soft).then((i) => (IMG[1] = i)).catch((e) => console.warn(e));
  setTimeout(() => loadImage(FILES.big).then((i) => (IMG[2] = i)).catch((e) => console.warn(e)), 400);      // the 法相 and the named foes' emblems: not needed in the first seconds
  for (const name in CELL) { const m = /^(.*)_(\d+)$/.exec(name); if (m) count[m[1]] = Math.max(count[m[1]] || 0, +m[2] + 1); }
  const C = (stem, i) => CELL[`${stem}_${((i % count[stem]) + count[stem]) % count[stem]}`];


  let TALLY = null, TAG = '', TIME_G = 0;      // debug hooks: globalThis.__fxTally = {} counts draws by maker; globalThis.__fxTime = [] records ms, live effects, density per frame
  let G = null, time = 0, clock = 0, frame = 0, level = 0, ctx = null;
  // SPEC-CAMPAIGN 1.11: while the hero is dazzled every Shang warning and zone is drawn dimmed; a warning sent `hidden` (火灵圣母's
  // glare) is drawn faint, not absent. DIM multiplies every stroke's alpha while those are drawn.
  let DIM = 1; const hiddenZ = new WeakSet();
  const F = { z: 1, ox: 0, oy: 0, cx: 0, cy: 0, w: 0, h: 0, hsx: -1e9, hsy: -1e9, x0: 0, x1: 0, y0: 0, y1: 0, dpr: 1 };
  let dprAge = 0;
  function frameOf(c, cam) {
    const cv = c.canvas;
    if (dprAge-- <= 0) { dprAge = 30; F.dpr = cv.clientWidth ? cv.width / cv.clientWidth : globalThis.devicePixelRatio || 1; }
    F.z = (cam.zoom || 1) * F.dpr; F.w = cv.width; F.h = cv.height;
    F.ox = cv.width / 2 + (cam.shakeX || 0) * F.dpr; F.oy = cv.height * horizon + (cam.shakeY || 0) * F.dpr; F.cx = cam.x || 0; F.cy = cam.y || 0;
    const h = G && G.hero; F.hsx = h ? sx(h.x) : -1e9; F.hsy = h ? sy(h.y) - CLEAR.up * F.z : -1e9;
    const hw = F.w / 2 / F.z + 200, hh = F.h / F.z / KY; F.x0 = F.cx - hw; F.x1 = F.cx + hw; F.y0 = F.cy - hh * horizon - 300; F.y1 = F.cy + hh * (1 - horizon) + 300;
  }
  const sx = (x) => F.ox + (x - F.cx) * F.z, sy = (y) => F.oy + (y - F.cy) * KY * F.z;

  // ---------------------------------------------------------------- one cell
  // (X, Y) device px of the pivot; rot on the screen (or in the ground plane when sq = KY); kx, ky in units; r0..r1 the part shown
  function spr(c, X, Y, rot, kx, ky, a, sq = 1, r0 = 0, r1 = 1) {
    if (!c || a <= 0.004 || r1 <= r0) return; const img = IMG[c[0]]; if (!img) return; if (TALLY) TALLY[TAG] = (TALLY[TAG] || 0) + 1;
    const z = F.z, cs = Math.cos(rot), sn = Math.sin(rot);
    ctx.setTransform(kx * z * cs, kx * z * sn * sq, -ky * z * sn, ky * z * cs * sq, X, Y);
    ctx.globalAlpha = (a > 1 ? 1 : a) * DIM;
    const sxp = c[1], syp = c[2], sw = c[3], sh = c[4], w = c[7], h = c[8], ax = c[9];
    if ((r0 <= 0 && r1 >= 1) || ax === 0) ctx.drawImage(img, sxp, syp, sw, sh, -c[5], -c[6], w, h);
    else if (ax === 1) ctx.drawImage(img, sxp + sw * r0, syp, sw * (r1 - r0), sh, -c[5] + w * r0, -c[6], w * (r1 - r0), h);
    else if (ax === 2) ctx.drawImage(img, sxp, syp + sh * (1 - r1), sw, sh * (r1 - r0), -c[5], -c[6] + h * (1 - r1), w, h * (r1 - r0));
    else ctx.drawImage(img, sxp, syp + sh * r0, sw, sh * (r1 - r0), -c[5], -c[6] + h * r0, w, h * (r1 - r0));
  }
  // a cell painted along +x (length L units) laid on the screen chord (X0, Y0) -> (X1, Y1); up: keep its top side up on the screen
  function chord(c, X0, Y0, X1, Y1, L, ky, a, r0 = 0, r1 = 1, up = true) {
    const dx = X1 - X0, dy = Y1 - Y0, rot = Math.atan2(dy, dx), len = Math.hypot(dx, dy) / F.z;
    spr(c, X0, Y0, rot, len / L, up && dx < 0 ? -ky : ky, a, 1, r0, r1);
  }

  // ---------------------------------------------------------------- the veil: the hero first, danger second
  const danger = []; let nDanger = 0;      // [X, Y, r] in device px, or a lane [X0, Y0, X1, Y1, half width]
  function gatherDanger() {
    nDanger = 0; if (!G) return;
    const zs = G.zones || [];
    for (let i = 0; i < zs.length && nDanger < 24; i++) { const z = zs[i]; if (z.side !== 'shang' || z.dead) continue;
      const d = danger[nDanger] || (danger[nDanger] = [0, 0, 0, 0, 0, 0]);
      if (z.shape === 'lane' || z.kind === 'lane') { const L = z.len || 400; d[0] = 1; d[1] = sx(z.x); d[2] = sy(z.y); d[3] = sx(z.x + Math.cos(z.dir) * L); d[4] = sy(z.y + Math.sin(z.dir) * L); d[5] = ((z.w || 60) / 2 + 30) * F.z; }
      else { d[0] = 0; d[1] = sx(z.x); d[2] = sy(z.y); d[5] = ((z.r || 80) + 24) * F.z; }
      nDanger++; }
    const fs = G.foes || [];
    for (let i = 0; i < fs.length && nDanger < 40; i++) { const u = fs[i]; if (u.state !== 'windup' && u.state !== 'charge') continue; if (u.x < F.x0 || u.x > F.x1 || u.y < F.y0 || u.y > F.y1) continue;
      const big = u.elite || u.kind === 'chariot' || u.kind === 'captain' || u.kind === 'leader', d = danger[nDanger] || (danger[nDanger] = [0, 0, 0, 0, 0, 0]);
      d[0] = 0; d[1] = sx(u.x); d[2] = sy(u.y) - (big ? 50 : 26) * F.z; d[5] = (big ? 90 : 40) * F.z; nDanger++; }
  }
  function veil(X, Y) {
    const dx = (X - F.hsx) / (CLEAR.rx * F.z), dy = (Y - F.hsy) / (CLEAR.ry * F.z), dh = dx * dx + dy * dy;
    let v = dh >= 2.2 ? 1 : dh <= 0.6 ? CLEAR.floor : CLEAR.floor + ((1 - CLEAR.floor) * (dh - 0.6)) / 1.6;
    for (let i = 0; i < nDanger; i++) { const d = danger[i]; let q;
      if (d[0]) { const ex = d[3] - d[1], ey = d[4] - d[2], l2 = ex * ex + ey * ey || 1, t = clamp(((X - d[1]) * ex + (Y - d[2]) * ey) / l2), px = d[1] + ex * t - X, py = d[2] + ey * t - Y; q = Math.sqrt(px * px + py * py) / d[5]; }
      else { const px = X - d[1], py = Y - d[2]; q = Math.sqrt(px * px + py * py) / d[5]; }
      if (q < 1.5) { const w = q <= 1 ? VEIL : VEIL + ((1 - VEIL) * (q - 1)) / 0.5; if (w < v) v = w; } }
    return v;
  }

  // the veil of a long stroke: taken where it passes nearest the hero, so a blow that crosses him does not hide him
  function veilSeg(X0, Y0, X1, Y1) { const ex = X1 - X0, ey = Y1 - Y0, t = clamp(((F.hsx - X0) * ex + (F.hsy - Y0) * ey) / (ex * ex + ey * ey || 1)); return veil(X0 + ex * t, Y0 + ey * t); }
  // ---------------------------------------------------------------- live effects
  const live = [];
  const add = (o) => { o.t = 0; if (TALLY) o.tag = (new Error().stack.split('\n')[2] || '').trim().replace(/\(.*\//, '(').replace(/\?[^:]*/, ''); live.push(o); return o; };
  function step(dt) { let n = 0; for (let i = 0; i < live.length; i++) { const o = live[i]; o.t += dt; if (o.tick) o.tick(o, dt); if (o.t < o.life) live[n++] = o; } live.length = n; }
  const drawAll = (layer) => { for (let i = 0; i < live.length; i++) { const o = live[i], f = o[layer]; if (TALLY) TAG = o.tag; if (f) f(o); } };

  // ================================================================ 九龙神火罩: the cover falls; nine dragons of fire coil down round it
  // The cover is only a gold rim and a pale bell: the force is the dragons (第46回: 现出九条火龙，将罩盘绕). Their count is the
  // level (3, 4, 5, 6, 7, 9); the evolved form is nine small covers, each with one long dragon and a leaf of wood burning into it.
  const DRAGONS = [2, 2, 2, 3, 3, 3, 3];      // by level; nine only when it evolves (九龙焚天: nine covers, a dragon each)
  // 九龙焚天: the cover hangs in the sky over the hero and the nine dragons leave it one after another, each down an S to its place
  const arrivals = [], STAGGER = 0.13, FLIGHT = 0.36;
  function castNine(e) {
    const h = G && G.hero, x0 = h ? h.x : e.x, y0 = h ? h.y : e.y, ts = e.targets || [];
    arrivals.length = 0; ts.forEach((p, i) => arrivals.push({ x: p.x, y: p.y, at: clock + STAGGER * i + FLIGHT }));
    add({ x: x0, y: y0 - 230, ts: ts.map((p) => ({ x: p.x, y: p.y })), life: STAGGER * ts.length + FLIGHT + 0.3, ground: null, over: nineOver });
  }
  function nineOver(o) {
    const t = o.t, n = o.ts.length, hz = 330, X = sx(o.x), Y = sy(o.y) - hz * F.z, rimA = clamp(t / 0.12) * (1 - clamp((t - STAGGER * n - 0.1) / 0.3));
    spr(CELL.cover_ghost, X, Y + 8 * F.z, 0, 2.4, 2.1, 0.6 * rimA); spr(CELL.cover_rim, X, Y, clock * 0.8, 2.3, 2.3, rimA, KY); spr(CELL.cover_rim, X, Y - 70 * F.z, -clock * 0.6, 1.4, 1.4, 0.7 * rimA, KY);      // 九龙焚天: the great bell hangs over him
    for (let i = 0; i < n; i++) { const u = (t - STAGGER * i) / FLIGHT; if (u <= 0 || u >= 1.25) continue;
      const p = o.ts[i], mx = (o.x + p.x) / 2, my = (o.y + p.y) / 2, dx = p.x - o.x, dy = p.y - o.y, L = Math.hypot(dx, dy) || 1, sw = (i % 2 ? 1 : -1) * Math.min(260, 80 + L * 0.7), cx = mx - (dy / L) * sw, cy = my + (dx / L) * sw;
      const at = (q) => { q = clamp(q); const a = (1 - q) * (1 - q), b = 2 * q * (1 - q), c = q * q; P0[0] = sx(a * o.x + b * cx + c * p.x); P0[1] = sy(a * o.y + b * cy + c * p.y) - (hz * (1 - q) + 30 * q + 110 * Math.sin(PI * q)) * F.z; return P0; };
      const head = Math.min(1, u), M = 6, a0 = u > 1 ? 1 - (u - 1) / 0.25 : 1;
      for (let j = M - 1; j >= 0; j--) { const q0 = head - j * 0.07, q1 = head - (j + 1) * 0.07; if (q1 < 0) continue; at(q1); const X1 = P0[0], Y1 = P0[1]; at(q0);
        const v = veil(P0[0], P0[1]); if (j === M - 1) chord(CELL.drg_tail, P0[0], P0[1], X1, Y1, 62, 0.95, a0 * v); else chord(j === 0 ? C('drg', i + Math.floor(t * 9)) : C('drg_dry', i + j), X1, Y1, P0[0], P0[1], 64, 0.98, a0 * v * (1 - 0.08 * j)); }
      at(head - 0.04); const X1 = P0[0], Y1 = P0[1]; at(head); const ddx = P0[0] - X1, ddy = P0[1] - Y1; spr(C('drg_head', i), P0[0], P0[1], Math.atan2(ddy, ddx), 1.35, ddx < 0 ? -1.35 : 1.35, a0 * veil(P0[0], P0[1])); }
  }
  function castDome(e) {
    const delay = e.delay ?? 0.5;
    if (e.evolved) castNine(e);
    for (const p of e.targets || [{ x: e.x, y: e.y }]) add({ x: p.x, y: p.y, r: e.radius || 78, life: delay + 0.08, delay, ev: !!e.evolved, ground: domeFallGround, over: domeFallOver });
  }
  function domeFallGround(o) { const u = clamp(o.t / o.delay), k = o.r / 100; spr(C('scorch', 1), sx(o.x), sy(o.y), 0.6, k * (0.8 + 0.2 * u), k * (0.8 + 0.2 * u), 0.22 * u, KY); }
  function domeFallOver(o) {
    const u = clamp(o.t / o.delay), zH = 320 * (1 - easeIn(u)), k = o.r / 100, X = sx(o.x), Y = sy(o.y) - zH * F.z, v = veil(X, Y);
    spr(CELL.cover_ghost, X, Y + 4 * F.z, 0, k, k * 0.9, 0.3 * u * v);
    spr(CELL.cover_rim, X, Y, clock * 0.6, k, k, (0.35 + 0.65 * u) * v, KY);
  }
  const domes = new Map();
  function watchDome(z) {
    let o = domes.get(z.id);
    if (!o) { o = add({ id: z.id, zone: z, x: z.x, y: z.y, r: z.r || 78, T: 0, zl: z.life || 2.8, lv: z.level || 1, ev: !!z.evolved, gone: -1, life: 1e9, dr: 0, seed: hash(z.id * 977) * TAU, tick: domeTick, ground: domeGround, over: domeOver });
      if (o.ev) { let best = null, bd = 1e12; for (const a of arrivals) { const d = (a.x - z.x) ** 2 + (a.y - z.y) ** 2; if (d < bd && !a.used) { bd = d; best = a; } } if (best) { best.used = 1; o.dr = Math.max(0, best.at - clock); } }      // it coils only when its dragon has arrived
      domes.set(z.id, o); }
    o.seen = frame; o.x = z.x; o.y = z.y; o.r = z.r || o.r; o.T = z.t; o.zl = z.life || o.zl;
  }
  function domeTick(o, dt) { if (o.seen !== frame && o.gone < 0) o.gone = 0; if (o.gone >= 0) { o.gone += dt; o.T += dt; if (o.gone > 0.75) { o.life = 0; domes.delete(o.id); } } }
  // the coil of dragon k: s = 0 is the head (lowest, leading), s = 1 the tail (high, behind)
  // dragon k of a cover comes 0.22 s after the one before: at any moment one or two are in full pigment, the rest gathering or pale
  const STEP_K = 0.22, FULL = 0.5;
  const dragonT = (o, k) => o.T - o.dr - (o.ev ? 0 : k * STEP_K);
  function coil(o, k, s, out) {
    const N = o.ev ? 1 : DRAGONS[Math.min(6, o.lv)], Tk = dragonT(o, k), burst = ease(clamp(Tk / 0.3)), end = o.gone >= 0 ? clamp(o.gone / 0.6) : clamp((o.T - (o.zl - 0.3)) / 0.9);
    const turn = o.ev ? 1.4 : 1.0, rk = o.r * (o.ev ? 1.05 : 0.95 + 0.12 * (k % 2)), span = o.r * (o.ev ? 1.5 : 1.15);
    const th = o.seed + (k * TAU) / N + 1.6 * o.T - s * turn * PI, rho = rk * (1 - 0.14 * s + 0.24 * Math.sin(TAU * s + k * 2.1 + o.T * 1.3));      // one clear S in the body
    const zz = o.r * 0.16 + s * span + (1 - burst) * o.r * 1.8 + end * o.r * 0.9 + 5 * Math.sin(3 * o.T + k * 1.7) + o.r * 0.12 * Math.sin(TAU * s + k);
    out[0] = sx(o.x + Math.cos(th) * rho); out[1] = sy(o.y + Math.sin(th) * rho) - zz * F.z; out[2] = Math.sin(th);
  }
  const P0 = [0, 0, 0], P1 = [0, 0, 0];
  // the body is dry brush with paper through it; only the head and the leading segment are in full pigment, and only while the
  // dragon is new (FULL s); then the whole of it goes pale and dry and smoulders at a third
  function drawDragons(o, front) { if (glfx && glfx.has('fireCover')) return;          // the painted dragons (fx/gl/treasures.js) fly instead
    const N = o.ev ? 1 : DRAGONS[Math.min(6, o.lv)], M = level === 2 ? 3 : o.ev ? 7 : 6, flick = Math.floor(o.T * 9);
    const end = o.gone >= 0 ? clamp(o.gone / 0.6) : clamp((o.T - (o.zl - 0.3)) / 0.9);
    for (let k = 0; k < N; k++) {
      const Tk = dragonT(o, k); if (Tk <= 0) continue;
      const reveal = clamp(Tk / 0.3) * 1.2, fresh = Tk < FULL, glow = fresh ? 1 : Math.max(0.32, 1 - ((Tk - FULL) / 0.4) * 0.68), a0 = (1 - end) * glow;
      const thick = o.ev ? 1.0 : 0.95 + 0.03 * Math.min(6, o.lv), hk = thick * 1.65;
      for (let i = M - 1; i >= 0; i--) {        // tail to head: the head is laid last, on top
        const s0 = i / M, s1 = (i + 1) / M; if (s0 > reveal) continue;
        coil(o, k, s1, P1); coil(o, k, s0, P0); const isFront = P0[2] + P1[2] > 0; if (isFront !== front) continue;
        const v = veil(P0[0], P0[1]), a = a0 * v * (isFront ? 1 : 0.4) * (1 - 0.5 * s0);       // lost toward the tail, as Chen Rong's are in cloud
        if (i === M - 1) chord(CELL.drg_tail, P0[0], P0[1], P1[0], P1[1], 62, thick * 0.9, a * 0.7);
        else chord(fresh && i === 0 ? C('drg', k + flick) : C('drg_dry', k + i), P1[0], P1[1], P0[0], P0[1], 64, thick, a * (i === 0 || !fresh ? 1 : 0.85));
      }
      coil(o, k, 0.1, P1); coil(o, k, 0, P0); const isFront = P0[2] > 0;
      if (isFront === front && reveal > 0) { const dx = P0[0] - P1[0], dy = P0[1] - P1[1], rot = Math.atan2(dy, dx); spr(C('drg_head', k), P0[0], P0[1], rot, hk, dx < 0 ? -hk : hk, a0 * veil(P0[0], P0[1]) * (isFront ? 1 : 0.45)); }
    }
  }
  function domeGround(o) {
    const X = sx(o.x), Y = sy(o.y), k = o.r / 100, v = veil(X, Y), end = o.gone >= 0 ? clamp(o.gone / 0.6) : 0;
    spr(C('scorch', o.id), X, Y, o.seed, k * 1.05, k * 1.05, 0.5 * clamp(o.T / 0.15) * (1 - end) * v, KY);
    if (o.T < 0.5) spr(CELL.cover_rim, X, Y, o.seed, k, k, (1 - o.T / 0.5) * 0.8 * v, KY);
    drawFlames(o, false); drawDragons(o, false);
  }
  function domeOver(o) { drawFlames(o, true); drawDragons(o, true); drawAsh(o); }
  // fire standing in the cover: the burst throws a ring of tall tongues at the rim; then a few tongues come and go inside
  function drawFlames(o, front) {
    const end = o.gone >= 0 ? clamp(o.gone / 0.5) : 0, k = o.r / 90;
    if (o.T < 0.45) { const n = o.ev ? 2 : o.lv <= 3 ? 5 : 3, g = (o.T < 0.07 ? ease(o.T / 0.07) : 1 - smooth((o.T - 0.07) / 0.38)) * (o.lv <= 3 && !o.ev ? 1.2 : 1);
      for (let j = 0; j < n; j++) { const a = o.seed + (j * TAU) / n, fr = Math.sin(a) > 0; if (fr !== front) continue;
        const X = sx(o.x + Math.cos(a) * o.r * 0.95), Y = sy(o.y + Math.sin(a) * o.r * 0.95); spr(C('fl', j % 2), X, Y, 0, k * 0.9 * (Math.cos(a) < 0 ? -1 : 1), k * 0.9 * g, veil(X, Y)); } }
    const m = level === 2 ? 1 : o.ev ? 1 : 2 + (o.lv >> 2);
    for (let j = 0; j < m; j++) { const ph = o.T * 2.6 + j * 0.37, slot = Math.floor(ph), u = ph - slot, h1 = hash(o.id * 131 + slot * 17 + j), h2 = hash(o.id * 71 + slot * 29 + j * 3);
      const a = h1 * TAU, d = Math.sqrt(h2) * o.r * 0.72, fr = Math.sin(a) > 0; if (fr !== front || o.T < 0.2) continue;
      const X = sx(o.x + Math.cos(a) * d), Y = sy(o.y + Math.sin(a) * d), g = Math.sin(PI * u);
      spr(o.T > 1.1 ? C('fl_dry', slot + j) : C('fl', (slot + j) % 2), X, Y, 0, k * 0.8 * (h1 > 0.5 ? 1 : -1), k * 0.8 * g, (o.T > 1.1 ? 0.6 : 1) * (1 - end) * veil(X, Y)); }
    if (o.ev && front && o.T > 0.15 && o.T < 1.2) for (let j = 0; j < 2; j++) { const u = clamp((o.T - 0.15 - j * 0.3) / 0.6); if (u <= 0 || u >= 1) continue;     // a leaf of wood falls into it and becomes fire (木生火)
      const X = sx(o.x + (j ? 0.5 : -0.4) * o.r), Y = sy(o.y) - (o.r * 1.6 * (1 - u)) * F.z; spr(u < 0.6 ? C('leaf', j) : C('ember', j), X, Y, u * 5 + j, 1.2, 1.2, 1 - u * 0.5); }
  }
  function drawAsh(o) {
    const end = o.gone >= 0 ? clamp(o.gone / 0.75) : clamp((o.T - (o.zl - 0.3)) / 1.05); if (end <= 0) return;
    for (let j = 0; j < (level === 2 ? 3 : level ? 5 : 8); j++) { const a = o.seed + j * 0.9, d = o.r * (0.4 + 0.6 * hash(o.id + j * 13)), X = sx(o.x + Math.cos(a) * d), Y = sy(o.y + Math.sin(a) * d) - (o.r * (0.4 + 0.8 * hash(j * 7 + o.id)) + end * 90) * F.z;
      spr(C('ash', j), X, Y, 0, 1.2, 1.2, (1 - end) * 0.9); }
  }

  // ================================================================ 混天绫: a ribbon of red silk whips the arc, and drives the water before it
  // 第12回: 七尺混天绫望空一展. The silk is a thick-thin line that pinches where it twists; the water is bundles of Ma Yuan's
  // line rolled outward, crests that break where it pushes. Levels: bands of water 1, 2, 3 and crests 1, 2, 3 along a longer
  // arc; evolved (翻江): the silk whirls a full turn and a ring of wave rolls outward, crests standing on it, a gold hair under it.
  let sashTurn = 1;
  function castSash(e) {
    if (!e.fixed) castSash.at = clock; sashTurn = -sashTurn; const h = G && G.hero;
    add({ fixed: !!e.fixed, dx: h ? e.x - h.x : 0, dy: h ? e.y - h.y : 0, x: e.x, y: e.y, R: e.radius || 165, ang: ((e.angle || 120) * PI) / 180, dir: e.dir || 0, lv: e.level || 1, ev: !!e.evolved || (e.angle || 0) >= 359, turn: sashTurn, life: e.evolved || (e.angle || 0) >= 359 ? 1.0 : 0.7, seed: (hash(frame) * 1000) | 0, ground: sashGround, over: sashOver });
  }
  function sashAt(o) { const h = G && G.hero; return h && !o.fixed ? [h.x + o.dx, h.y + o.dy] : [o.x, o.y]; }
  const SQ = [0, 0];
  function arcPt(cx, cy, rad, a, hgt) { SQ[0] = sx(cx + Math.cos(a) * rad); SQ[1] = sy(cy + Math.sin(a) * rad) - hgt * F.z; return SQ; }
  function band(o, cx, cy, rad, a0, span, n, p0, p1, hgt, stem, L, ky, alpha, outward, varOff, env = true) {
    for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n; if (u1 <= p0 || u0 >= p1) continue;
      const b0 = a0 + span * u0, b1 = a0 + span * u1, [X0, Y0] = arcPt(cx, cy, rad, b0, hgt), [X1, Y1] = arcPt(cx, cy, rad, b1, hgt);
      const r0 = clamp((p0 - u0) / (u1 - u0)), r1 = clamp((p1 - u0) / (u1 - u0)); let k = ky * (env ? 0.3 + 0.7 * Math.sin(PI * Math.min(1, (u0 + u1) / 2 * 1.04)) : 1);
      if (outward) { const rot = Math.atan2(Y1 - Y0, X1 - X0), am = (b0 + b1) / 2, nx = Math.cos(am), ny = Math.sin(am) * KY; if (Math.sin(rot) * nx - Math.cos(rot) * ny < 0) k = -k; }
      const a = alpha * veil((X0 + X1) / 2, (Y0 + Y1) / 2), st2 = env && stem === 'wave' && u1 < p1 - 0.24 ? 'wave_break' : stem; chord(C(st2, i + varOff), X0, Y0, X1, Y1, L, k, a, r0, r1, !outward); }
  }
  function sashGround(o) {
    const [cx, cy] = sashAt(o), t = o.t;
    if (o.ev) { for (let j = 0; j < 4; j++) { const s = t - 0.25 - j * 0.06; if (s < 0) continue; const a = (j * TAU) / 4 + o.seed, rad = o.R * 0.85, X = sx(cx + Math.cos(a) * rad), Y = sy(cy + Math.sin(a) * rad), k = (o.R * 0.3 / 100) * (0.6 + 0.6 * s); spr(C('ripple', j), X, Y, a, k, k, 0.5 * (1 - clamp(s / 0.7)), KY); }
      const g = ease(clamp((t - 0.08) / 0.45)), rad = o.R * (0.45 + 0.7 * g); spr(CELL.gold_ring, sx(cx), sy(cy), o.seed, rad / 100, rad / 100, 0.75 * (1 - clamp((t - 0.35) / 0.4)) * clamp(t / 0.1), KY); return; }
    const a0 = o.dir - (o.turn * o.ang) / 2;
    for (const u of o.lv >= 3 ? [0.5, 1] : [1]) { const s = t - 0.2 - u * 0.1; if (s < 0) continue; const a = a0 + o.turn * o.ang * u, rad = o.R * 1.05, X = sx(cx + Math.cos(a) * rad), Y = sy(cy + Math.sin(a) * rad), k = (o.R * 0.32 / 100) * (0.6 + 0.7 * s); spr(C('ripple', o.seed + u * 2), X, Y, a, k, k, 0.5 * (1 - clamp(s / 0.6)) * veil(X, Y), KY); }
  }
  function sashOver(o) {
    const [cx, cy] = sashAt(o), t = o.t, lv = Math.min(6, o.lv);
    if (o.ev) {
      const p = ease(clamp((t - 0.03) / 0.22)), q = clamp((t - 0.3) / 0.3), rad = o.R * (0.5 + 0.12 * p);
      band(o, cx, cy, rad, o.dir, o.turn * TAU, level === 2 ? 8 : 12, q, p, 32, 'silk', 110, 1.15 * o.turn, 1, false, o.seed, false);
      for (let b = 0; b < (level === 2 ? 1 : level ? 2 : 3); b++) { const g = ease(clamp((t - 0.08 - 0.05 * b) / 0.42)), r2 = o.R * (0.42 + 0.72 * g) - b * 16, fade = 1 - clamp((t - 0.4 - 0.05 * b) / 0.4);
        if (g > 0 && fade > 0) band(o, cx, cy, r2, o.dir + b * 0.4, TAU, level === 2 ? 10 : 14, 0, 1, 4, 'wave', 130, 1.1 - 0.2 * b, fade, true, b, false); }
      const n = level === 2 ? 6 : 10;
      for (let j = 0; j < n; j++) { const a = o.dir + (j * TAU) / n + 0.2, g = ease(clamp((t - 0.12) / 0.42)), rad2 = o.R * (0.42 + 0.72 * g) + 8, s = t - 0.14 - 0.02 * j; if (s < 0) continue;
        const up = s < 0.1 ? ease(s / 0.1) : 1 - smooth(clamp((s - 0.22) / 0.4)), X = sx(cx + Math.cos(a) * rad2), Y = sy(cy + Math.sin(a) * rad2), mx = Math.cos(a) < 0 ? -1 : 1;
        if (up > 0) spr(j % 2 ? CELL.crest_big : C('crest', j), X, Y, 0, mx * (j % 2 ? 1.05 : 1.4), up * (j % 2 ? 1.1 : 1.6), veil(X, Y)); }      // 翻江: the crests stand twice a man's height
      return; }
    const a0 = o.dir - (o.turn * o.ang) / 2, span = o.turn * o.ang, n = Math.max(3, Math.ceil((o.R * o.ang) / 92));
    if (t < 0.09) { const [X, Y] = arcPt(cx, cy, 34, a0, 44); spr(CELL.silk_tip, X, Y, o.turn > 0 ? -2.4 : -0.8, 0.6, 0.6 * o.turn, 0.9 * (1 - t / 0.09)); }      // gather: the silk curled in the hand
    const p = ease(clamp((t - 0.04) / 0.14)), q = clamp((t - 0.2) / 0.26);
    band(o, cx, cy, o.R * 0.9, a0, span, n, q, p, 30, 'silk', 110, (1.2 + 0.05 * lv) * o.turn, 1, false, o.seed);
    if (p < 1 && p > 0.05) { const a = a0 + span * p, [X, Y] = arcPt(cx, cy, o.R * 0.9, a, 30), [X1, Y1] = arcPt(cx, cy, o.R * 0.9, a + span * 0.05, 30); chord(CELL.silk_tip, X, Y, X1, Y1, 70, 0.8 * o.turn, veil(X, Y)); }
    const B = lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
    for (let b = 0; b < B; b++) { const pb = ease(clamp((t - 0.07 - 0.03 * b) / 0.16)), qb = clamp((t - 0.24 - 0.03 * b) / 0.3), fade = 1 - smooth(clamp((t - 0.26) / 0.38));
      band(o, cx, cy, o.R * (1.0 + 0.09 * b) + 30 * qb, a0, span, n, qb * 0.6, pb, 6, 'wave', 130, 0.95 - 0.12 * b, fade, true, b + o.seed); }
    const nC = lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
    for (let j = 0; j < nC; j++) { const u = 1 - j * 0.33, s = t - 0.08 - 0.16 * u; if (s < 0) continue;
      const a = a0 + span * u, rad = o.R * 1.1 + 24 * clamp(s / 0.3), X = sx(cx + Math.cos(a) * rad), Y = sy(cy + Math.sin(a) * rad), up = s < 0.08 ? ease(s / 0.08) : 1 - smooth(clamp((s - 0.16) / 0.3)), mx = Math.cos(a) < 0 ? -1 : 1, v = veil(X, Y);
      if (up > 0) spr(j === 0 ? CELL.crest_lead : C('crest', j + o.seed), X, Y, 0, mx * (j === 0 ? 0.8 + 0.04 * lv : 0.85 + 0.05 * lv), up * (j === 0 ? 0.8 + 0.04 * lv : 0.85 + 0.05 * lv), v);
      if (s > 0.12 && s < 0.5) for (let d = 0; d < 3; d++) { const w = s - 0.12, vx = Math.cos(a + (d - 1) * 0.4) * 180, vy = Math.sin(a + (d - 1) * 0.4) * 180, zz = 40 + 200 * w - 700 * w * w; if (zz > 0) spr(C('spray', d + j), sx(cx + Math.cos(a) * rad + vx * w), sy(cy + Math.sin(a) * rad + vy * w) - zz * F.z, 0, 1, 1, v * (1 - w / 0.38)); } }
  }

  // ================================================================ 番天印: the seal falls from the sky. Shadow first, then weight, then ink thrown outward
  // 第46回: 番天印...一声响. Levels: the seal and its print grow; thrown ink 6, 10, 14; a second shock ring from 3; slabs of earth
  // from 6. Evolved (番天覆地): the print stays as a field of split earth with embers in its cracks (火生土), drawn from the zone.
  function castSeal(e) {
    const delay = e.delay ?? 0.6, lv = Math.min(6, e.level || 1);
    for (const p of e.targets || [{ x: e.x, y: e.y }]) add({ x: p.x, y: p.y, r: e.radius || 95, delay, lv, ev: !!e.evolved, life: delay + 1.25, seed: (hash(frame * 13 + p.x) * 1e4) | 0, ground: sealGround, over: sealOver });
  }
  function sealGround(o) {
    const t = o.t, s = t - o.delay;
    if (s >= 0 && !o.kicked) { o.kicked = 1; kickA = Math.max(kickA, (o.ev ? 9 : 3 + 0.9 * o.lv)); kickT = 0; }
    const X = sx(o.x), Y = sy(o.y), k = o.r / 100, v = veil(X, Y);
    if (s < 0) { const u = t / o.delay; spr(CELL.seal_shade, X, Y, 0, k * (0.4 + 0.65 * u), k * (0.4 + 0.65 * u), (0.12 + 0.78 * u * u) * v, KY); return; }
    const m = sink(s);
    spr(CELL.seal_print, X, Y, 0, k * 0.92, k * 0.92, m * v, KY);
    const nT = o.lv >= 6 ? 12 : o.lv >= 3 ? 9 : 7, far = clamp(s / 0.06);           // 泼墨, heavy: loaded strokes thrown outward from under the block, running into flying white
    for (let j = 0; j < (level === 2 ? (nT + 1) >> 1 : nT); j++) { const h1 = hash(o.seed * 7 + j), h2 = hash(o.seed * 5 + j), a = (j * TAU) / nT + (h1 - 0.5) * 1.3, r0 = o.r * (0.25 + 0.3 * h1), Xj = sx(o.x + Math.cos(a) * r0), Yj = sy(o.y + Math.sin(a) * r0), L = (j % 3 === 1 ? 0.4 : 0.7 + 0.6 * h2) * (0.75 + 0.45 * k);
      spr(C('throw', o.seed + j), Xj, Yj, a, L, (0.8 + 0.4 * h1) * (0.8 + 0.3 * k), m * veil(Xj, Yj), KY, 0, far); }
    const nS = o.lv >= 6 ? 8 : o.lv >= 3 ? 6 : 4, reach = clamp(s / 0.07);      // and smaller ink, scattered, each its own length and turn
    for (let j = 0; j < (level === 2 ? nS >> 1 : nS); j++) { const h1 = hash(o.seed + j), h2 = hash(o.seed * 3 + j), a = (j * TAU) / nS + (h1 - 0.5) * 0.9, r0 = o.r * (0.55 + 0.35 * h2), Xj = sx(o.x + Math.cos(a) * r0), Yj = sy(o.y + Math.sin(a) * r0), L = (0.3 + 0.45 * h2) * (0.7 + 0.3 * k);
      spr(C('splash', o.seed + j), Xj, Yj, a + (h2 - 0.5) * 0.8, L, (0.6 + 0.4 * h1) * (0.7 + 0.3 * k), 0.85 * m * veil(Xj, Yj), KY, 0, reach); }
    for (let j = 0; j < (o.lv >= 6 ? 6 : o.lv >= 3 ? 4 : 3); j++) { const a = (j * TAU) / 5 + hash(o.seed + 40 + j) * 1.2, Xj = sx(o.x + Math.cos(a) * o.r * 0.5), Yj = sy(o.y + Math.sin(a) * o.r * 0.5);
      spr(C('crack', j + o.seed), Xj, Yj, a, k, k, 0.8 * m * veil(Xj, Yj), KY, 0, clamp(s / 0.06)); }
    for (let j = 0; j < (o.lv >= 6 ? 3 : o.lv >= 3 ? 2 : 1); j++) { const e2 = clamp((s - j * 0.08) / 0.36); if (e2 <= 0 || e2 >= 1) continue; const kk = k * (0.85 + 1.1 * ease(e2)) - j * 0.2 * k; spr(C('quake', j + o.seed), X, Y, o.seed + j, kk, kk, (1 - e2) * 0.85 * v, KY); }
  }
  function sealOver(o) {
    const t = o.t, s = t - o.delay, X = sx(o.x), k = o.r / 100, bk = (0.8 + 0.2 * clamp((o.r - 95) / 55)) * (o.ev ? 1.1 : 1), FALL = 4 / 60;   // the size of what it lands on; more seals at higher level, not a bigger one
    if (s < 0) { const w = clamp((s + FALL) / FALL); if (w <= 0) return; const zz = 720 * (1 - w), Y = sy(o.y) - zz * F.z, v = veil(X, Y);      // it falls in four frames
      spr(CELL.seal_smear, X, Y - 60 * bk * F.z, 0, bk * 1.2, bk * 1.8, 0.7 * v);
      spr(CELL.seal_block, X, Y, 0, bk, bk * 1.06, v); return; }
    const Y = sy(o.y), v = veil(X, Y);
    if (s < 1.5 / 60) spr(CELL.seal_dark, X, Y, 0, bk * 1.12, bk * 0.84, Math.max(v, 0.7));                                                   // one frame of 焦墨
    else if (s < 0.1) spr(CELL.seal_block, X, Y, 0, bk * (s < 0.05 ? 1.08 : 1), bk * (s < 0.05 ? 0.88 : 1), v);
    else if (s < 0.2) { const w = (s - 0.1) / 0.1; spr(CELL.seal_block, X, Y - 420 * w * w * F.z, 0, bk, bk, (1 - w) * (1 - w) * v); }   // gone by 0.2 s: an ordinary cast never stands over the fight (the lead, 2026-11-25)
    if (s < 0.3) for (let j = 0; j < 3; j++) { const a = 0.3 + j * 1.2 + hash(o.seed + j * 5), Xj = sx(o.x + Math.cos(a) * o.r * 0.95), Yj = sy(o.y + Math.abs(Math.sin(a)) * o.r * 0.95), g = s / 0.3; spr(C('dust', j + o.seed), Xj, Yj, 0, k * (0.7 + 0.7 * g) * (j % 2 ? -1 : 1), k * (0.7 + 0.6 * g), 0.75 * (1 - g) * veil(Xj, Yj)); }
    if (s < 0.26) for (let j = 0; j < 3; j++) { const a = (j * TAU) / 6 + 0.4, w = s, zz = 260 * w - 1500 * w * w; if (zz <= 0) continue; const d = o.r * 0.8 + 220 * w, Xj = sx(o.x + Math.cos(a) * d), Yj = sy(o.y + Math.sin(a) * d) - zz * F.z; spr(C('slab', j), Xj, Yj, w * 8 * (j % 2 ? 1 : -1), 1.2 + 0.1 * Math.min(6, o.lv), 1.2 + 0.1 * Math.min(6, o.lv), veil(Xj, Yj)); }
    if (o.ev && s < 0.4) for (let j = 0; j < 4; j++) { const a = j * 1.57 + 0.8, w = s, d = o.r * 0.6 + 260 * w, zz = 40 + 300 * w - 900 * w * w; if (zz > 0) spr(C('ember', j), sx(o.x + Math.cos(a) * d), sy(o.y + Math.sin(a) * d) - zz * F.z, a, 1.4, 1.4, 1 - w / 0.4); }
  }
  const fields = new Map();
  function watchField(z) {
    let o = fields.get(z.id);
    if (!o) { o = add({ id: z.id, x: z.x, y: z.y, r: z.r || 95, T: 0, zl: z.life || 4, gone: -1, life: 1e9, tick: fieldTick, ground: fieldGround, over: fieldOver }); fields.set(z.id, o); }
    o.seen = frame; o.x = z.x; o.y = z.y; o.r = z.r || o.r; o.T = z.t; o.zl = z.life || o.zl;
  }
  function fieldTick(o, dt) { if (o.seen !== frame && o.gone < 0) o.gone = 0; if (o.gone >= 0) { o.gone += dt; if (o.gone > 0.5) { o.life = 0; fields.delete(o.id); } } }
  const fieldA = (o) => clamp((o.T - 0.25) / 0.3) * (o.gone >= 0 ? 1 - o.gone / 0.5 : 1) * (0.46 + 0.05 * Math.sin(o.T * 4.4));
  function fieldGround(o) { const X = sx(o.x), Y = sy(o.y), k = o.r / 100; spr(CELL.seal_shadow, X, Y, 0, (o.r / 62) * 0.55, (o.r / 62) * 0.55, 0.5 * clamp((o.T - 0.25) / 0.3) * (o.gone >= 0 ? 1 - o.gone / 0.5 : 1) * veil(X, Y), KY); spr(C('field', o.id), X, Y, 0, k * 0.95, k * 0.95, fieldA(o) * veil(X, Y), KY); }
  function fieldOver(o) { return;   /* 番天覆地 lasts: it lies on the ground (fieldGround), nothing hangs over the fight (tester round 2: the hanging seal blocks) */ const a = fieldA(o); if (a <= 0) return; { const sa = clamp((o.T - 0.25) / 0.3) * (o.gone >= 0 ? 1 - o.gone / 0.5 : 1), Xs = sx(o.x), Ys = sy(o.y) - (o.r * 1.0 + 12 * Math.sin(o.T * 2.2)) * F.z; spr(CELL.seal_block, Xs, Ys, 0, o.r / 80, o.r / 80, sa * Math.max(0.6, veil(Xs, Ys))); }      // it hangs above heads: never fainter than 0.6, or it reads as a grey box      // 番天覆地: the seal hangs over the ground it holds down
 for (let j = 0; j < 3; j++) { const ph = o.T * 1.7 + j * 0.33, u = ph - Math.floor(ph), ang = j * 2.1 + o.id, X = sx(o.x + Math.cos(ang) * o.r * 0.4), Y = sy(o.y + Math.sin(ang) * o.r * 0.4); spr(C('fl', j), X, Y, 0, 0.45, 0.5 * Math.sin(PI * u), a * 1.6 * veil(X, Y)); } }


  // ================================================================ 火尖枪: a thrust of fire through a line of foes
  // Gather (2 frames): a pale hair along the line. Burst: the thrust drawn on from the hand to the leaf of flame at its head,
  // fire ticks leaning back along it. Linger: it goes dry from the hand; ticks rise. Levels: thrusts 1, 2, 3 (the rules), longer
  // and wider. Evolved 三昧神枪: each thrust forks at its head; a hair of malachite runs along it (木生火); the ground it crossed
  // burns as a row of small tongues leaning with the thrust (drawn from the rules' lane zones), at a third once it has flared.
  function castSpear(e) {
    const L = e.length || 230, w = e.width || 34, lv = Math.min(6, e.level || 1), ev = !!e.evolved;
    if (ev && !(frame - (castSpear.last || -99) < 20)) { castSpear.last = frame; add({ life: 0.55, seed: frame, over: (o) => { const h = G && G.hero; if (!h) return; const u = o.t / 0.55;      // 三昧神枪: true fire stands round him as he thrusts
      for (let j = 0; j < 10; j++) { const a = (j / 10) * TAU + o.seed, X = sx(h.x + Math.cos(a) * 95), Y = sy(h.y + Math.sin(a) * 95); spr(C('fl', j % 2), X, Y, 0, (j % 2 ? 1 : -1) * 0.9, 1.1 * Math.sin(PI * clamp(u * 1.3 - (j % 3) * 0.05)), (u < 0.4 ? 1 : 0.55) * veil(X, Y - 30 * F.z)); } } }); }
    add({ x: e.x, y: e.y, dir: e.dir || 0, L, k: 0.75 + 0.5 * (w / 34 - 1) + (ev ? 0.15 : 0), ev, fork: ev || e.fork, fa: e.forkAngle || 0.45, fl: e.forkLength || 0.65, life: 0.55, seed: (hash(frame * 7) * 1e4) | 0, over: spearOver });
  }
  function spearLine(o, x0, y0, d, L, k, t0, main) {
    const t = o.t - t0; if (t < 0) return [x0 + Math.cos(d) * L, y0 + Math.sin(d) * L];
    const x1 = x0 + Math.cos(d) * L, y1 = y0 + Math.sin(d) * L, X0 = sx(x0), Y0 = sy(y0) - 34 * F.z, X1 = sx(x1), Y1 = sy(y1) - 34 * F.z, v = veil((X0 + X1) / 2, (Y0 + Y1) / 2);
    if (t < 0.035 && main) chord(C('hair', o.seed), X0, Y0, X1, Y1, 200, 1, 0.8 * v);
    const p = clamp((t - 0.02) / 0.06), q = clamp((t - 0.16) / 0.22), dry = t > 0.16;
    if (p > 0) { k = Math.min(k, 1.1);       // wider levels show in ticks and length, never in a thicker shaft (it reads as a girder)
      chord(C('thrust', o.seed), X0, Y0, X1, Y1, 260, k, (1 - smooth(q)) * v, 0, p);
      if (dry && !level) chord(CELL.thrust_dry, X0, Y0, X1, Y1, 260, k, 0.8 * Math.sin(PI * clamp(q * 0.9 + 0.1)) * v, 0, 1);      // goes dry: faded through, never cut square
      if (p >= 1 && t < 0.3) { const rot = Math.atan2(Y1 - Y0, X1 - X0); spr(CELL.spearhead, X1, Y1, rot, k * 1.1, (X1 < X0 ? -k : k) * 1.1, (1 - clamp((t - 0.16) / 0.14)) * v); }
      if (o.ev && main && t < 0.3 && level < 2) chord(C('bark', o.seed), X0, Y0 - 5 * F.z, X1, Y1 - 5 * F.z, 200, 0.3, 0.75 * v * (1 - clamp((t - 0.16) / 0.14)), 0, p); }      // a thread of wood: 木生火
    if (t > 0.12 && t < 0.5 && (main || !level)) for (let j = 0; j < (level === 2 ? 1 : 3); j++) { const u = (t - 0.12) / 0.38, f = 0.3 + 0.25 * j, X = X0 + (X1 - X0) * f, Y = Y0 + (Y1 - Y0) * f - u * 40 * F.z; spr(C('ember', o.seed + j), X, Y, -1.5 + j * 0.3, 1.2, 1.2, (1 - u) * v); }
    return [x1, y1];
  }
  // many thrusts at once in a full build: past a budget a frame, the forks and embers of the older ones are left out
  let spearLines = 0;
  function spearOver(o) {
    spearLines++; const rich = spearLines <= (level === 2 ? 4 : level ? 8 : 16);
    const [tx, ty] = spearLine(o, o.x + Math.cos(o.dir) * 30, o.y + Math.sin(o.dir) * 30, o.dir, o.L - 30, o.k, 0, true);
    if (o.fork && rich) for (const sgn of [-1, 1]) forkLine(o, tx - Math.cos(o.dir) * 14, ty - Math.sin(o.dir) * 14, o.dir + sgn * o.fa, o.fl * o.L, sgn);
  }
  // 三昧神枪: the fork is a tongue of flame leaving the head as a hair, curling outward at its end; drawn on, then faded through
  function forkLine(o, x0, y0, d, L, sgn) {
    const t = o.t - 0.05; if (t < 0) return; const x1 = x0 + Math.cos(d) * L, y1 = y0 + Math.sin(d) * L, X0 = sx(x0), Y0 = sy(y0) - 34 * F.z, X1 = sx(x1), Y1 = sy(y1) - 34 * F.z;
    const p = ease(clamp(t / 0.08)), a = (1 - smooth(clamp((t - 0.13) / 0.27))) * veilSeg(X0, Y0, X1, Y1), ky = Math.min(1, 0.55 + 0.35 * o.k);
    chord(C('fork', o.seed + (sgn > 0 ? 1 : 0)), X0, Y0, X1, Y1, 260, sgn > 0 ? -ky : ky, a, 0, p, false);
    if (t > 0.1 && t < 0.45) { const u = (t - 0.1) / 0.35; spr(C('ember', o.seed + sgn), X1, Y1 - u * 36 * F.z, u * 4, 1, 1, (1 - u) * veil(X1, Y1)); }
  }
  const lanes = new Map();
  function watchLane(z) {
    let o = lanes.get(z.id);
    if (!o) { o = add({ id: z.id, x: z.x, y: z.y, dir: z.dir || 0, len: z.len || 240, T: 0, gone: -1, life: 1e9, tick: laneTick, ground: laneGround, over: laneOver }); lanes.set(z.id, o); }
    o.seen = frame; o.T = z.t;
  }
  function laneTick(o, dt) { if (o.seen !== frame && o.gone < 0) o.gone = 0; if (o.gone >= 0) { o.gone += dt; if (o.gone > 0.5) { o.life = 0; lanes.delete(o.id); } } }
  const laneA = (o) => (o.T < 0.25 ? 0.85 : 0.32) * (o.gone >= 0 ? 1 - o.gone / 0.5 : 1);
  // many lanes burn at once in a full build: the newest few keep their tongues, the rest only their ash, and at the densest one blot in three
  let laneRank = 0;
  function laneGround(o) { if (glfx && glfx.has('fireSpear')) return; if (o.x < F.x0 - o.len && o.x > F.x1 + o.len) return; o.rank = laneRank++; if (level && o.rank < lanes.size - (level === 2 ? 8 : 14)) return; const n = level === 2 ? 2 : level ? 3 : Math.max(2, Math.round(o.len / 60)); for (let j = 0; j < n; j++) { const f = (j + 0.5) / n, X = sx(o.x + Math.cos(o.dir) * o.len * f), Y = sy(o.y + Math.sin(o.dir) * o.len * f); spr(C('ash', j + o.id), X, Y, 0, 2, 1.2, 0.5 * laneA(o) * veil(X, Y)); } }
  function laneOver(o) {
    if (glfx && glfx.has('fireSpear')) return;
    if (o.rank < lanes.size - (level === 2 ? 3 : level ? 5 : 8)) return;
    const n = level === 2 ? 2 : level ? 3 : Math.max(3, Math.round(o.len / 45)), a = laneA(o), lean = Math.cos(o.dir) < 0 ? -1 : 1;
    for (let j = 0; j < n; j++) { const ph = o.T * 3 + j * 0.31, u = ph - Math.floor(ph), f = (j + 0.5) / n, X = sx(o.x + Math.cos(o.dir) * o.len * f), Y = sy(o.y + Math.sin(o.dir) * o.len * f);
      spr(C('tick', j + Math.floor(ph)), X, Y, 0, -lean * 1.1, 1.1 * (0.5 + 0.5 * Math.sin(PI * u)), a * veil(X, Y)); }
  }

  // ================================================================ 打神鞭: twenty-one joints come down out of the sky on the strongest foe
  // Gather (2 frames): a ruled gold hair from the sky to the foe. Burst: the rod swings down along it, a smear behind; it lands
  // with a fold of thunder (wood) and a crack. Linger: the rod lifts away, the crack sinks. Levels: blows 1, 2 (the rules); the
  // crack widens with the radius. Evolved 封神: the blow chains: a thunder fold runs from each foe struck to the next, an azurite
  // hair along it (水生木), and the rod comes down on each in turn.
  function castWhip(e) { castWhip.at = clock;
    const ts = e.targets || [{ x: e.x, y: e.y }], ev = !!e.evolved, r = e.radius || 44, h = G && G.hero;
    ts.forEach((p, i) => add({ x: p.x, y: p.y, r, ev, i, lv: e.level || 1, prev: i ? ts[i - 1] : null, side: h && p.x < h.x ? -1 : 1, life: 0.8 + i * (ev ? 0.07 : 0.04), t0: i * (ev ? 0.07 : 0.04), seed: (hash(frame * 3 + i) * 1e4) | 0, ground: whipGround, over: whipOver }));
  }
  // the rod is held over the target from the side away from the hero (never across him): seen whole at the top of the swing for
  // three frames, a broad dry smear on the way down, lying on the target an instant after the blow, then lifted away. Evolved:
  // one rod, on the first target; the chain of light carries the blow on.
  const ROD = 160;
  function whipOver(o) {
    const t = o.t - o.t0; if (t < 0) return;
    const X = sx(o.x), Y = sy(o.y) - 10 * F.z, kk = 1 + 0.03 * Math.min(6, o.lv || 1), L = ROD * kk * F.z, sd = o.side;
    const BX = X + sd * L * 0.62, BY = Y - L * 0.72;             // the hand: up and out, on the side away from the hero
    const aUp = Math.atan2(-1, sd * 0.25), aDown = Math.atan2(Y - BY, X - BX);
    const rod = o.ev && o.i > 0 ? false : true;
    if (t < 0.05 && rod) chord(C('ray', 0), BX, BY - L * 0.6, X, Y, 200, 1.2, 0.9 * veil(X, Y));      // gather: the gold path
    if (rod && t >= 0.03 && t < 0.09) { const Xt = BX + Math.cos(aUp) * L, Yt = BY + Math.sin(aUp) * L; chord(CELL.whip_rod, BX, BY, Xt, Yt, ROD, kk * 1.25, veilSeg(BX, BY, Xt, Yt), 0, 1, false); }
    if (rod && t >= 0.08 && t < 0.2) { const u = (t - 0.08) / 0.12; spr(CELL.whip_arc, BX, BY + L * 0.02, sd > 0 ? -0.15 : 0.15, (sd > 0 ? -1 : 1) * (L / F.z) / 170, (L / F.z) / 150, (u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6) * 0.85 * veil(X, Y)); }
    if (rod && t >= 0.12 && t < 0.42) { const lift = t > 0.2 ? ease((t - 0.2) / 0.22) : 0, a = aDown - sd * lift * 0.9, Xt = BX + Math.cos(a) * L, Yt = BY + Math.sin(a) * L - lift * 40 * F.z;
      chord(CELL.whip_rod, BX, BY - lift * 40 * F.z, Xt, Yt, ROD, kk * 1.25, (1 - lift) * veilSeg(BX, BY, Xt, Yt), 0, 1, false); }
    if (t >= 0.12 && t < 0.37) { const u = (t - 0.12) / 0.25; for (let j = 0; j < 2; j++) { const a = (sd > 0 ? -0.4 : -2.7) + j * (sd > 0 ? -1.2 : 1.2) + (o.seed % 7) * 0.08, X1 = X + Math.cos(a) * 150 * F.z, Y1 = Y + Math.sin(a) * 80 * F.z;
      chord(C('bolt', j + o.seed), X, Y, X1, Y1, 200, 1.05, (u < 0.5 ? 1 : 1 - (u - 0.5) * 2) * veilSeg(X, Y, X1, Y1), 0, clamp(u * 5)); } }      // thunder: bold, drawn in three frames, gone in a quarter second
    if (o.ev && t > 0.13 && t < 0.75) { const u = (t - 0.13) / 0.62; for (let j = 0; j < 3; j++) { const Xf = X + (j - 1) * 22 * F.z + Math.sin(u * 6 + j) * 6 * F.z, Yf = Y - (20 + 150 * u + j * 18) * F.z; spr(CELL.fu, Xf, Yf, Math.sin(u * 5 + j) * 0.4, 1.5, 1.5, (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8) * veil(Xf, Yf)); } }      // 封神: the struck are named on talismans that rise from them
    if (o.ev && o.prev && t < 0.22) { const P = o.prev, Xp = sx(P.x), Yp = sy(P.y) - 24 * F.z; chord(C('chain', o.i), Xp, Yp, X, Y - 16 * F.z, 200, 1.6, (t < 0.1 ? 1 : 1 - (t - 0.1) / 0.12) * veilSeg(Xp, Yp, X, Y), 0, clamp(t / 0.05), false); }
  }
  function whipGround(o) { const t = o.t - o.t0 - 0.12; if (t < 0) return; if (!o.kicked) { o.kicked = 1; kickA = Math.max(kickA, 2.5 + 0.4 * Math.min(6, o.lv || 1)); kickT = 0; }
    const m = sink(t), X = sx(o.x), Y = sy(o.y), k = (o.r / 50) * (o.ev ? 1.2 : 1), v = veil(X, Y);
    spr(CELL.whip_hit, X, Y, o.seed, k * 0.75, k * 0.75, m * v, KY);
    for (let j = 0; j < 3; j++) spr(C('crack', j + o.seed), X, Y, j * 2.1 + o.seed, k * 0.8, k * 0.8, m * 0.9 * v, KY, 0, clamp(t / 0.05));
    spr(C('quake', o.seed), X, Y, 0, k * 0.5 * (1 + t * 2.4), k * 0.5 * (1 + t * 2.4), (1 - clamp(t / 0.3)) * 0.85 * v, KY); }

  // ================================================================ 乾坤圈 and 定海珠: drawn from the rules' shots
  // The ring: a bronze hoop at four turns of its spin, a ruled gold hair behind it; at each bounce a burst of short hair rays;
  // evolved (乾坤无极) an ochre hair beside the gold (土生金). The pearls: discs of paper rimmed in azurite with a gold glint,
  // each trailing three hairs of water; the far half of the orbit smaller and paler; evolved (二十四诸天) the outer ring
  // trails gold (金生水).
  function drawShots(layer) {
    const ss = G && G.shots; if (!ss) return;
    for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.dead || s.side === 'shang' || !SHOT_KINDS.has(s.kind)) continue; if (s.x < F.x0 || s.x > F.x1 || s.y < F.y0 || s.y > F.y1) continue;
      const far = G.hero && s.y < G.hero.y; if ((layer === 'ground') !== (s.kind === 'pearls' && far)) continue;      // a pearl on the far side passes behind the figures
      const X = sx(s.x), Y = sy(s.y) - 28 * F.z, vx = (s.x - s.px) * F.z, vy = (s.y - s.py) * KY * F.z, sp = Math.hypot(vx, vy), v = veil(X, Y), rot = Math.atan2(vy, vx);
      if (s.kind === 'boulder') { const k = (s.r || 26) / 24, roll = Math.floor((s.x + s.y) / 30) % 3; spr(C('dust', i), X, Y + 26 * F.z, 0, k * 0.8, k * 0.6, 0.6 * v); spr(C('boulder', roll), X, Y + 4 * F.z, 0, k, k, v); continue; }
      if (s.kind === 'stone') { if (sp > 0.5) spr(C('ray', i), X, Y, rot + PI, 0.3, 1.2, 0.8 * v); spr(CELL.stone5, X, Y, clock * 8, 1.4, 1.4, v); continue; }
      if (s.kind === 'talisman') { spr(CELL.fu, X, Y, clock * 12 + i, 1.2, 1.2, v); continue; }
      if (s.kind === 'blade') { spr(C('spin', Math.floor(clock * 20 + i) % 2), X, Y, clock * 20, 1.3, 1.3, v); if (sp > 0.5) spr(C('ray', i), X, Y, rot + PI, 0.25, 1, 0.7 * v); continue; }
      if (s.kind === 'pearls') { if (glfx && glfx.has('pearls')) continue; const k = (s.r ? s.r / 14 : 1) * (far ? 0.85 : 1);
        if (sp > 0.5) spr(s.evolved && s.ring ? CELL.pearl_tail_gold : C('pearl_tail', i), X, Y, rot + PI, k, k, (far ? 0.45 : 0.8) * v);
        spr(CELL.pearl, X, Y, 0, k, k, (far ? 0.7 : 1) * v); }
      else if (!(glfx && glfx.has('ring'))) { const k = (s.r ? s.r / 16 : 1) * (s.evolved ? 1.3 : 1.05), spin = Math.floor(clock * 22 + i) % 4, ph = [0, 1, 2, 3, 2, 1][Math.floor(clock * 22 + i) % 6];
        if (sp > 0.5) { spr(C('ray', i), X, Y, rot + PI, s.evolved ? 0.75 : 0.55, 1.4, 0.85 * v); if (s.evolved) spr(C('hair', i), X, Y + 3 * F.z, rot + PI, 0.4, 1, 0.7 * v); }
        if (s.evolved && sp > 0.5) for (let j = 3; j >= 1; j--) spr(C('hoop', (ph + j) % 4), X - vx * j * 2.2, Y - vy * j * 2.2, rot * 0.2, k * (1 - 0.1 * j), k * (1 - 0.1 * j), (0.5 - 0.13 * j) * v);      // 乾坤无极: the ring leaves its own turning after it
        spr(C('hoop', ph), X, Y, rot * 0.2, s.evolved ? k * 1.35 : k, s.evolved ? k * 1.35 : k, v); if (s.evolved) spr(CELL.gold_ring, X, Y, clock * 3, k * 0.32, k * 0.32, 0.8 * v); } }
  }
  function boulderBurst(e) {          // 移山: where the rolled mountain stops it bursts: slabs, a shock ring, dust
    add({ x: e.x, y: e.y, r: e.radius || 150, life: 1.3, seed: frame, ground: (o) => { const s = o.t, k = o.r / 100, X = sx(o.x), Y = sy(o.y); if (!o.kicked) { o.kicked = 1; kickA = Math.max(kickA, 5); kickT = 0; } spr(C('quake', o.seed), X, Y, 0, k * (0.8 + ease(clamp(s / 0.35))), k * (0.8 + ease(clamp(s / 0.35))), (1 - clamp(s / 0.35)) * veil(X, Y), KY); for (let j = 0; j < 4; j++) spr(C('crack', j), X, Y, j * 1.6, k, k, sink(s) * veil(X, Y), KY, 0, clamp(s / 0.06)); },
      over: (o) => { const s = o.t; if (s > 0.3) return; for (let j = 0; j < 8; j++) { const a = j * 0.785, d = o.r * 0.3 + 300 * s, zz = 300 * s - 1600 * s * s; if (zz <= 0) continue; spr(C('slab', j), sx(o.x + Math.cos(a) * d), sy(o.y + Math.sin(a) * d) - zz * F.z, s * 9, 1.8, 1.8, 1); } } });
  }
  function ringBounce(e) { if (hitsThisFrame >= (level === 2 ? 2 : 5)) return; hitsThisFrame++; add({ x: e.x, y: e.y, life: 0.22, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y) - 28 * F.z, u = o.t / 0.22, v = veil(X, Y); for (let j = 0; j < (level === 2 ? 2 : 4); j++) spr(C('ray', j), X, Y, o.seed + j * (level === 2 ? 3.14 : 1.57), 0.12 + 0.12 * ease(u), 1, (1 - u) * v, 1, clamp(u * 0.3), clamp(u * 3)); } }); }

  // ================================================================ 杏黄旗: a ward of pale apricot round the hero; a blow on it opens golden flowers
  // Standing: a broken apricot ring on the ground and the banner on it (four banners evolved). Taking a blow: the ring thickens
  // for an instant, golden flowers open round it (第50回: 旗現金花) and fall as petals; ochre dashes run outward with the push.
  const wardZ = (o) => { const zs = G && G.zones; if (zs) for (let i = 0; i < zs.length; i++) if (zs[i].kind === 'ward' && zs[i].src === 'banner' && !zs[i].dead) return zs[i]; return null; };
  function wardStanding() {
    if (glfx && glfx.has('banner')) return;
    const z = wardZ(); if (!z) return; const h = G.hero, X = sx(h.x), Y = sy(h.y), k = (z.r || 125) / 100;
    spr(CELL.ward_ring, X, Y, clock * 0.15, k, k, 0.55, KY);
    if (z.evolved) { spr(CELL.ward_ring, X, Y, -clock * 0.1, k * 1.18, k * 1.18, 0.6, KY); for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU + clock * 0.25, Xf = sx(h.x + Math.cos(b) * z.r * 1.1), Yf = sy(h.y + Math.sin(b) * z.r * 1.1); spr(C('flower', j), Xf, Yf, clock * 0.5 + j, 1.1, 1.1, 0.85 * veil(Xf, Yf)); } }      // 戊己杏黄旗: golden lotus turn round the ward (and the great banner, in wardOver)
    const n = z.evolved ? 4 : 1; for (let j = 0; j < n; j++) { const a = -1.5708 + j * 1.5708 + 0.5, Xf = sx(h.x + Math.cos(a) * z.r), Yf = sy(h.y + Math.sin(a) * z.r); spr(CELL.flag, Xf, Yf, 0, 0.9, 0.9, 0.9); }
  }
  // 戊己杏黄旗: the great banner stands behind him, tall enough to fly over the crowd's heads (drawn over the figures, veiled round him)
  function wardOver() { if (glfx && glfx.has('banner')) return; const b = G && G.build && G.build.treasures, own = b && b.find((t) => t.id === 'banner' && t.evolved); if (!own || !G.hero) return; const h = G.hero, Xb = sx(h.x - 70), Yb = sy(h.y - 30), sway = Math.sin(clock * 1.6) * 0.04; spr(CELL.flag, Xb, Yb - 40 * F.z, sway, 3.4, 4.2, 0.85 * veil(Xb, Yb - 200 * F.z)); }
  // what an evolved treasure leaves standing between its casts, as the great banner does: 翻江's silk turns slowly round him just
  // outside his patch; 封神's rod stands in the air beside him on the right (beside, never over him), a talisman slip hanging from it. Both step aside while their
  // own cast is at its height (the sash comes back after 0.45 s: it is cast every 1.4 s), and come back over a fifth of a second.
  const owned = (id) => { const b = G && G.build && G.build.treasures; return !!(b && b.find((t) => t.id === id && t.evolved)); };
  function evolvedStanding() {
    const h = G && G.hero; if (!h) return;
    if (owned('sash') && !(glfx && glfx.has('sash'))) { const back = clamp((clock - (castSash.at || -9) - 0.45) / 0.2); if (back > 0) {
      const a0 = clock * 0.9, hg = 30 + 8 * Math.sin(clock * 1.7); band(null, h.x, h.y, 128, a0, PI * 1.3, 7, 0, 1, hg, 'silk', 110, 1.15, back, false, 3);
      const [X, Y] = arcPt(h.x, h.y, 128, a0 + PI * 1.3, hg), [X1, Y1] = arcPt(h.x, h.y, 128, a0 + PI * 1.36, hg); chord(CELL.silk_tip, X, Y, X1, Y1, 70, 0.8, back * veil(X, Y)); } }
    if (owned('whip') && !(glfx && glfx.has('whip'))) { const back = clamp((clock - (castWhip.at || -9) - 0.4) / 0.25); if (back > 0) {
      const bob = Math.sin(clock * 1.3) * 6 * F.z, X = sx(h.x + 112), Y = sy(h.y) - 20 * F.z + bob, Xt = X + 18 * F.z, Yt = Y - ROD * 0.8 * F.z, v = veilSeg(X, Y, Xt, Yt);
      chord(CELL.whip_rod, X, Y, Xt, Yt, ROD, 1.15, back * Math.max(0.8, v), 0, 1, false);
      chord(C('ray', 1), Xt + 6 * F.z, Yt - 30 * F.z, X, Y, 200, 0.5, 0.55 * back * Math.max(0.7, v), 0, 1, false);
      const sw = Math.sin(clock * 2.1) * 0.18, Xf = Xt + 2 * F.z, Yf = Yt + 34 * F.z; spr(CELL.fu, Xf, Yf, sw, 1.3, 1.3, back * Math.max(0.8, veil(Xf, Yf))); } }
  }
  function castWard(e) {
    if (!e.blocked && !e.evolved) return;
    add({ x: e.x, y: e.y, r: e.radius || 125, life: 0.9, seed: frame, ground: (o) => { const h = G && G.hero, cx = h ? h.x : o.x, cy = h ? h.y : o.y, u = o.t, k = o.r / 100;
        if (u < 0.25) spr(CELL.ward_ring, sx(cx), sy(cy), 0, k * (1 + u * 0.4), k * (1 + u * 0.4), 1 - u / 0.25, KY);
        spr(C('quake', o.seed), sx(cx), sy(cy), o.seed, k * (1 + ease(clamp(u / 0.35)) * 0.6), k * (1 + ease(clamp(u / 0.35)) * 0.6), 0.8 * (1 - clamp(u / 0.35)), KY); },
      over: (o) => { const h = G && G.hero, cx = h ? h.x : o.x, cy = h ? h.y : o.y, n = 7;
        for (let j = 0; j < n; j++) { const a = (j / n) * TAU + o.seed, X = sx(cx + Math.cos(a) * o.r), Y = sy(cy + Math.sin(a) * o.r) - 24 * F.z, u = o.t, g = u < 0.12 ? ease(u / 0.12) : 1 - clamp((u - 0.35) / 0.3);
          if (g > 0) spr(C('flower', j), X, Y, u * 0.8, 1.2 * g, 1.2 * g, 1);
          if (u > 0.3) { const w = u - 0.3, Xp = X + Math.sin(j + w * 6) * 10 * F.z, Yp = Y + w * 60 * F.z; spr(C('petal', j), Xp, Yp, w * 4 + j, 1.2, 1.2, 1 - w / 0.6); } } } });
  }

  // ================================================================ what is worth riding to (S-1.9: nothing a foe carries)
  // Battle spirit: a wisp of paper white with an ink hair and a cinnabar heart, on a pale shadow; it bobs. Peach: paper white,
  // a cinnabar blush, two leaves. Lodestone: an ink stone with an azurite band. Chest: ochre lacquer, cinnabar clasp.
  function drawPickups() {
    const ps = G && G.pickups; if (!ps) return;
    for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (p.dead || p.x < F.x0 + 100 || p.x > F.x1 - 100 || p.y < F.y0 || p.y > F.y1) continue;
      const X = sx(p.x), Y = sy(p.y);
      if (p.kind === 'spirit') { const s = p.size != null ? p.size : p.value >= 10 ? 2 : p.value >= 3 ? 1 : 0; spr(CELL.wisp_ground, X, Y, 0, 0.36 + 0.12 * s, 0.36 + 0.12 * s, 0.7, KY); spr(C('wisp', s), X, Y - (3 + 1.5 * Math.sin(clock * 3 + p.id)) * F.z, 0, 0.6, 0.6, 1); }      // battle spirit: small, so a field full of it does not read as eggs
      else { const c = CELL[p.kind]; if (!c) continue; spr(CELL.wisp_ground, X, Y, 0, 1.6, 1.6, 0.8, KY); spr(c, X, Y - (p.kind === 'chest' ? 0 : 2 + 2 * Math.sin(clock * 2.4 + p.id)) * F.z, 0, 1.2, 1.2, 1); } }
  }
  function gathered(e) {
    if (e.kind === 'spirit') { if ((e.size || 0) === 0 && level) return; add({ x: e.x, y: e.y, s: e.size || 0, life: 0.3, over: (o) => { const u = o.t / 0.3, X = sx(o.x), Y = sy(o.y) - (10 + 70 * ease(u)) * F.z; spr(C('wisp', o.s), X, Y, 0, 1 - u * 0.6, 1 + u * 0.6, 1 - u); } }); return; }
    if (e.kind === 'peach') { add({ x: e.x, y: e.y, life: 0.6, over: (o) => { for (let j = 0; j < 4; j++) { const u = o.t / 0.6, X = sx(o.x + Math.cos(j * 1.6) * 30 * u), Y = sy(o.y + Math.sin(j * 1.6) * 20 * u) - (30 + 60 * u) * F.z; spr(C('leaf', j), X, Y, j + u * 3, 1.1, 1.1, 1 - u); } } }); return; }
    if (e.kind === 'lodestone') { add({ x: e.x, y: e.y, life: 0.5, ground: (o) => { const u = o.t / 0.5, r = 6 * (1 - ease(u)); spr(CELL.gold_ring, sx(o.x), sy(o.y), 0, r, r, 0.7 * (1 - u), KY); } }); return; }
  }


  // ================================================================ the squads' skills (section 6.1; events squadSkill, rankUp, blessed)
  // Each skill is the squad acting as one: a wall, a crown of points, a darkening and a rain, a boulder, a charge, a leap,
  // a talisman's spell, a cast of hooks. From rank 4 the element's own marks are laid over it (RIDER); rank 5 is a new skill
  // with its own shape, and the squad stands on a halo of brush strokes in its element.
  const RIDER_CELL = { fire: 'ember', water: 'frost', wood: 'leaf', metal: 'ray', earth: 'slab' };
  function rider(o, x, y, r, t0) {        // the second effect of rank 4: the element's marks scattered where the skill struck
    if (o.rank < 4) return; const u = (o.t - t0) / 0.45; if (u <= 0 || u >= 1) return;
    for (let j = 0; j < 6; j++) { const a = j * 1.05 + o.seed, d = r * (0.3 + 0.6 * hash(o.seed + j)), X = sx(x + Math.cos(a) * d), Y = sy(y + Math.sin(a) * d) - (o.el === 'earth' ? 0 : 20 + 30 * u) * F.z;
      spr(C(RIDER_CELL[o.el] || 'ember', j), X, Y, o.el === 'metal' ? -1.57 : u * 2 + j, o.el === 'water' ? 0.35 : o.el === 'metal' ? 0.15 : 1.1, o.el === 'water' ? 0.35 : 1.1, (1 - u) * veil(X, Y)); }
  }
  const menOf = (ids) => { const out = []; const as = G && G.allies; if (as && ids) for (const a of as) if (ids.includes(a.id)) out.push([a.x, a.y]); return out; };
  function squadSkill(e) {
    const o = { ...e, t: 0, rank: e.rank || 2, el: e.element || TROOP[e.troop] || 'earth', seed: (hash(frame * 31 + (e.x | 0)) * 1e4) | 0, men: menOf(e.by) };
    const f = SKILL[e.shape]; if (f) f(o);
  }
  const SKILL = {
    arc(o) {          // 盾墙 / 不动如山: shields lock along the arc and shove the front back
      const full = (o.angle || 150) >= 359, ang = ((o.angle || 150) * PI) / 180, R = o.radius || 150, n = Math.max(5, Math.round((R * ang) / 34));
      o.life = 0.9; o.ground = (o) => { const s = o.t - 0.12; if (s < 0) return; for (let j = 0; j < (full ? 2 : 1); j++) { const e2 = clamp((s - j * 0.1) / 0.4); if (e2 >= 1) continue; const k = (R / 100) * (0.95 + 0.4 * ease(e2)); spr(C('quake', o.seed + j), sx(o.x), sy(o.y), o.dir, k, k, (1 - e2) * 0.85 * veil(sx(o.x), sy(o.y)), KY); } rider(o, o.x, o.y, R, 0.12); };
      o.over = (o) => { const up = o.t < 0.1 ? ease(o.t / 0.1) : 1, fade = (1 - clamp((o.t - 0.25) / 0.3)) * 0.85, push = 26 * ease(clamp((o.t - 0.1) / 0.2));
        for (let j = 0; j < n; j++) { const a = (full ? 0 : o.dir - ang / 2) + (ang * (j + 0.5)) / n, X = sx(o.x + Math.cos(a) * (R * 0.75 + push)), Y = sy(o.y + Math.sin(a) * (R * 0.75 + push)); if (fade <= 0) break;
          const hj = hash(o.seed * 17 + j); if (hj < 0.08) continue; spr(C('wall', j + o.seed), X + (hj - 0.5) * 8 * F.z, Y, (hj - 0.5) * 0.16, (o.blessed ? 1.2 : 1) * (0.85 + 0.3 * hj) * (Math.cos(a) < 0 ? -1 : 1), up * (o.blessed ? 1.25 : 1) * (0.88 + 0.24 * hash(j + o.seed)), fade * veil(X, Y)); }
        if (o.t > 0.1 && o.t < 0.6) for (let j = 0; j < 4; j++) { const a = (full ? j * 1.57 : o.dir + (j - 1.5) * ang / 4) + 0.3, X = sx(o.x + Math.cos(a) * R * 1.05), Y = sy(o.y + Math.sin(a) * R * 1.05), g = (o.t - 0.1) / 0.5; spr(C('dust', j), X, Y, 0, 0.8 + 0.6 * g, 0.7 + 0.5 * g, 0.75 * (1 - g) * veil(X, Y)); } };
      add(o);
    },
    lines(o) {        // 攒刺 / 万刃齐发: a crown of points, every man thrusting outward at once
      o.life = 0.5; o.over = (o) => { const p = clamp(o.t / 0.06), a = 1 - clamp((o.t - 0.18) / 0.25);
        for (const l of o.lines || []) { const X0 = sx(l.x), Y0 = sy(l.y) - 26 * F.z, X1 = sx(l.x + Math.cos(l.dir) * l.length), Y1 = sy(l.y + Math.sin(l.dir) * l.length) - 26 * F.z, v = veil((X0 + X1) / 2, (Y0 + Y1) / 2);
          const Xh = X0 + (X1 - X0) * 0.62, Yh = Y0 + (Y1 - Y0) * 0.62; chord(C('hair', o.seed), X0, Y0, Xh, Yh, 200, 0.9, 0.8 * a * v, 0, p); if (p > 0.6) chord(C('blade', o.seed), Xh, Yh, X1, Y1, 220, 0.55, a * v, 0, (p - 0.6) / 0.4); if (p >= 1 && o.t < 0.2) spr(C('ray', 0), X1, Y1, Math.atan2(Y1 - Y0, X1 - X0), 0.15, 1, (1 - o.t / 0.2) * v); }
        const l0 = (o.lines || [])[0]; if (l0) rider(o, l0.x, l0.y, 120, 0.05); };
      add(o);
    },
    drop(o) {         // 箭雨 / 遮天箭雨 (and the acolytes' fire): a wet wash grows where they will fall; a rain of thin streaks at one slant;
      // a few stand in the ground after. Rank 5's three volleys darken the sky side of the picture for an instant instead.
      if (o.troop === 'acolytes') { talisman(o, o.x, o.y); return; }
      const d = o.delay ?? 0.9, R = o.radius || 120, many = (o.targets || []).length > 1; o.life = d + 1.3;
      o.ground = (o) => { (o.targets || [o]).forEach((p, ti) => { const X = sx(p.x), Y = sy(p.y), v = veil(X, Y), k = R / 100;
        if (o.t < d) { const u = o.t / d; spr(C('rain_wash', o.seed + ti), X, Y, o.seed + ti, k * (0.55 + 0.45 * ease(u)), k * (0.55 + 0.45 * ease(u)), (0.25 + 0.6 * u) * (many ? 0.7 : 1) * v, KY); return; }
        const m = sink(o.t - d); spr(C('rain_wash', o.seed + ti), X, Y, o.seed + ti, k, k, 0.85 * m * v, KY);
        for (let j = 0; j < (o.blessed ? 10 : 7); j++) { const a = hash(o.seed + j * 7 + ti) * TAU, r = Math.sqrt(hash(o.seed + j * 13 + ti)) * R * 0.9, Xj = sx(p.x + Math.cos(a) * r), Yj = sy(p.y + Math.sin(a) * r); spr(C('arrow_stuck', j), Xj, Yj, 0.35, 0.95, 0.95 * clamp((o.t - d) / 0.04), m * veil(Xj, Yj)); }
        rider(o, p.x, p.y, R, d); }); };
      const SL = 0.42;          // one slant for the whole rain
      o.over = (o) => { const s = o.t - (d - 0.22); if (s < 0) return;
        if (o.blessed && many && s < 0.45) { const g = s < 0.12 ? s / 0.12 : 1 - (s - 0.12) / 0.33; for (let j = 0; j < 3; j++) spr(C('rain_wash', j), F.w * (0.2 + 0.3 * j), F.h * 0.02, j, (F.w / F.z) / 380, (F.h / F.z) / 900, 0.55 * g); }      // the sky darkens
        if (s > 0.3) return;
        for (const p of o.targets || [o]) for (let j = 0; j < (level === 2 ? 14 : 30); j++) { const q = clamp((s - (j % 6) * 0.025) / 0.14); if (q <= 0 || q >= 1) continue;
          const a = hash(o.seed + j * 7) * TAU, r = Math.sqrt(hash(o.seed + j * 13)) * R * 1.1, X1 = sx(p.x + Math.cos(a) * r), Y1 = sy(p.y + Math.sin(a) * r), fall = 300 * F.z * (1 - q), X0 = X1 - fall * Math.sin(SL), Y0 = Y1 - fall * Math.cos(SL);
          chord(C('arrow_fall', j), X0 - 40 * F.z * Math.sin(SL), Y0 - 40 * F.z * Math.cos(SL), X0, Y0, 46, 1.2, veil(X1, Y1)); } };
      add(o);
    },
    throw(o) { if (o.troop === 'acolytes') talisman(o, o.x, o.y); },      // the boulders and blades are the rules' shots, drawn in drawShots
    charge(o) {       // 冲阵 / 铁流: dust and ruled bronze along the lane behind each chariot; the chariots themselves run it
      const T = o.time || 0.6; o.life = T * (o.lanes && o.lanes.some((l) => l.back) ? 2 : 1) + 0.6;
      o.ground = (o) => { for (const l of o.lanes || []) { const out = clamp(o.t / T), back = l.back ? clamp((o.t - T) / T) : 0, fade = 1 - clamp((o.t - T * (l.back ? 2 : 1)) / 0.5);
        const X0 = sx(l.x), Y0 = sy(l.y), X1 = sx(l.x + Math.cos(l.dir) * l.length), Y1 = sy(l.y + Math.sin(l.dir) * l.length), v = veil((X0 + X1) / 2, (Y0 + Y1) / 2);
        for (let k = 0; k < 2; k++) { const off = (k - 0.5) * (l.width || 64) * 0.4 * F.z, nx = -(Y1 - Y0), ny = X1 - X0, nl = Math.hypot(nx, ny) || 1; chord(C('rut', k + o.seed), X0 + (nx / nl) * off, Y0 + (ny / nl) * off, X1 + (nx / nl) * off, Y1 + (ny / nl) * off, 200, (l.width || 64) / 80, 0.8 * fade * v, back * 0.6, out); }
        rider(o, l.x + Math.cos(l.dir) * l.length * 0.5, l.y + Math.sin(l.dir) * l.length * 0.5, l.length * 0.4, T * 0.5); } };
      add(o);
    },
    leap(o) {         // 虎跃 / 群虎扑阵: a dry red streak over the leap; three claw rakes, tongues of fire and dust where each lands
      const T = o.time || 0.45, R = o.radius || 90; o.life = T + 1.3;
      o.ground = (o) => { const s = o.t - T; if (s < 0) return; if (!o.kicked) { o.kicked = 1; kickA = Math.max(kickA, o.blessed ? 5 : 2.5); kickT = 0; }
        for (const p of o.targets || []) { const X = sx(p.x), Y = sy(p.y), m = sink(s), k = R / 90; spr(C('claw', o.seed), X, Y, o.dir || 0, k, k, m * veil(X, Y), KY); spr(C('quake', o.seed), X, Y, 0, k * 0.6 * (1 + 1.5 * s), k * 0.6 * (1 + 1.5 * s), (1 - clamp(s / 0.3)) * 0.8 * veil(X, Y), KY); rider(o, p.x, p.y, R, T); } };
      o.over = (o) => { const sxo = o.men[0] || [o.x, o.y];
        for (const p of o.targets || []) { if (o.t < T) { const u = o.t / T, X0 = sx(sxo[0]), Y0 = sy(sxo[1]) - 30 * F.z, X1 = sx(p.x), Y1 = sy(p.y) - 30 * F.z; chord(CELL.leap_trail, X0, Y0 - 60 * F.z * Math.sin(PI * u), X1, Y1, 200, 1.2, 0.8 * veil(X1, Y1), 0, u); continue; }
          const s = o.t - T, g = s < 0.06 ? ease(s / 0.06) : 1 - clamp((s - 0.12) / 0.3); if (g <= 0) continue;
          for (let j = 0; j < 3; j++) { const a = j * 2.1 + o.seed, X = sx(p.x + Math.cos(a) * R * 0.6), Y = sy(p.y + Math.sin(a) * R * 0.6); spr(C('fl', j % 2), X, Y, 0, 0.7 * (j % 2 ? 1 : -1), 0.75 * g, veil(X, Y)); } } };
      add(o);
    },
    pull(o) {         // 挠钩 / 天罗地网: chains fly from every man into the group, then haul it into one knot and hold it
      const R = o.radius || 150, H = o.hold || 1.4; o.life = H + 0.5;
      o.ground = (o) => { if (!o.blessed) return; const X = sx(o.x), Y = sy(o.y), k = (R / 100) * (1 - 0.35 * ease(clamp((o.t - 0.15) / 0.4))), a = clamp(o.t / 0.12) * (1 - clamp((o.t - H) / 0.4)); spr(CELL.net, X, Y, o.seed, k, k, 0.8 * a * veil(X, Y), KY); };
      o.over = (o) => { const men = o.men.length ? o.men : [[o.x - 200, o.y]], fly = clamp(o.t / 0.12), haul = ease(clamp((o.t - 0.15) / 0.35)), fade = 1 - clamp((o.t - H) / 0.4);
        men.forEach((m, j) => { if (Math.hypot(m[0] - o.x, m[1] - o.y) > R + 320) return; const a = Math.atan2(m[1] - o.y, m[0] - o.x) + (hash(o.seed + j) - 0.5) * 1.2, r = R * (1 - 0.75 * haul), tx = o.x + Math.cos(a) * r, ty = o.y + Math.sin(a) * r, X0 = sx(m[0]), Y0 = sy(m[1]) - 24 * F.z, X1 = sx(tx), Y1 = sy(ty) - 20 * F.z;
          chord(C('chain_hook', j), X0, Y0, X1, Y1, 205, 1.1, fade * veilSeg(X0, Y0, X1, Y1), 0, fly, false); });
        rider(o, o.x, o.y, R * 0.4, 0.2); };
      add(o);
    },
    frost(o) { talisman(o, o.x, o.y); }, bind(o) { talisman(o, o.x, o.y); }, wall(o) { talisman(o, o.x, o.y); },
  };
  // 符法: a paper talisman flies from the acolytes to the place; the spell itself is the zone it leaves (drawn from the zones)
  function talisman(o, x, y) {
    const fx0 = o.fromX ?? (o.men[0] || [x - 200])[0], fy0 = o.fromY ?? (o.men[0] || [0, y])[1];
    add({ x, y, fx0, fy0, life: 0.5, seed: o.seed, el: o.el, rank: o.rank, over: (q) => { const u = clamp(q.t / 0.2); if (u < 1) { const X = sx(fx0 + (x - fx0) * u), Y = sy(fy0 + (y - fy0) * u) - (30 + 90 * Math.sin(PI * u)) * F.z; spr(CELL.fu, X, Y, u * 9, 1.4, 1.4, 1); return; }
      const s = q.t - 0.2, X = sx(x), Y = sy(y) - 20 * F.z; spr(CELL.fu, X, Y - s * 80 * F.z, s * 5, 1.4 * (1 - s / 0.3), 1.4, 1 - s / 0.3); rider(q, x, y, 80, 0.2); } });
  }
  // what the skills leave on the ground while it lasts (zones of Zhou with a troop as source): frost, a binding vine, a wall
  // of earth, burning ground, a knot held by hooks, a blessed squad's halo
  function troopZones() {
    const zs = G && G.zones; if (!zs) return;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.dead || z.side === 'shang' || !TROOP[z.src]) continue; if (z.x < F.x0 - 300 || z.x > F.x1 + 300 || z.y < F.y0 - 300 || z.y > F.y1 + 300) continue;
      const life = z.life || 3, a = clamp(z.t / 0.12) * clamp((life - z.t) / 0.35), X = sx(z.x), Y = sy(z.y), v = veil(X, Y), r = z.r || 100, id = z.id || i;
      if (z.kind === 'frost') { for (let j = 0; j < 5; j++) { const b = hash(id * 7 + j) * TAU, d = Math.sqrt(hash(id * 3 + j)) * r * 0.8, Xj = sx(z.x + Math.cos(b) * d), Yj = sy(z.y + Math.sin(b) * d); spr(C('frost', j + id), Xj, Yj, b, 1.4, 1.4, a * veil(Xj, Yj), KY); } spr(C('ripple', id), X, Y, id, r / 100, r / 100, 0.65 * a * v, KY); spr(C('rain_wash', id), X, Y, id, r / 100, r / 100, 0.3 * a * v, KY); }
      else if (z.kind === 'burn') { const n = level === 2 ? 1 : 2; for (let j = 0; j < n; j++) { const ph = z.t * 2.4 + j * 0.37, slot = Math.floor(ph), u = ph - slot, b = hash(id * 131 + slot * 17 + j) * TAU, d = Math.sqrt(hash(id * 71 + slot * 29 + j)) * r * 0.75, Xj = sx(z.x + Math.cos(b) * d), Yj = sy(z.y + Math.sin(b) * d);
          spr(z.t > 0.35 ? C('fl_dry', slot + j) : C('fl', (slot + j) % 2), Xj, Yj, 0, 0.55, 0.55 * Math.sin(PI * u), (z.t > 0.35 ? 0.5 : 0.85) * a * veil(Xj, Yj)); }
        spr(C('scorch', id), X, Y, id, r / 100, r / 100, 0.4 * a * v, KY); }
      else if ((z.kind === 'bind' || z.kind === 'wall') && (z.shape === 'lane' || z.len)) { const L = z.len || 240, X1 = sx(z.x + Math.cos(z.dir) * L), Y1 = sy(z.y + Math.sin(z.dir) * L);
        if (z.kind === 'bind') chord(C('vine', id), X, Y - 6 * F.z, X1, Y1 - 6 * F.z, 200, 1.1, a * v, 0, clamp(z.t / 0.15), false);
        else { const n = Math.max(3, Math.round(L / 34)), up = z.t < 0.12 ? ease(z.t / 0.12) : 1; for (let j = 0; j < n; j++) { const f = (j + 0.5) / n, Xj = sx(z.x + Math.cos(z.dir) * L * f), Yj = sy(z.y + Math.sin(z.dir) * L * f); spr(C('slab', j + id), Xj, Yj, 0, 2.2, 2.4 * up * a, veil(Xj, Yj)); } } }
      else if (z.kind === 'hold') { const pull = 1 - 0.12 * ease(clamp(z.t / 0.3)), k = (r / 100) * pull; spr(C('cinch', id), X, Y - 14 * F.z, id, k, k, 0.9 * a * v, KY); }
      else if (z.kind === 'halo') spr(C('halo_' + TROOP[z.src], 0), X, Y, z.t * 0.2, r / 100, r / 100, 0.55 * v, KY); }
  }
  // the blessed host (rank 5) stands on a halo of its element; drawn from the men themselves, so it follows them
  const HALO = {};
  function blessedHalos() {
    const as = G && G.allies; if (!as) return; for (const k in HALO) HALO[k][0] = 0;
    for (let i = 0; i < as.length; i++) { const a = as[i]; if (a.rank !== 5 || a.state === 'dead' || a.kind === 'general') continue; const h = HALO[a.kind] || (HALO[a.kind] = [0, 0, 0, 0, 0]); if (!h[0]) { h[1] = h[2] = 0; h[3] = 1e9; h[4] = -1e9; } h[0]++; h[1] += a.x; h[2] += a.y; h[3] = Math.min(h[3], a.x); h[4] = Math.max(h[4], a.x); }
    for (const k in HALO) { const h = HALO[k]; if (!h[0] || !TROOP[k]) continue; const x = h[1] / h[0], y = h[2] / h[0], r = Math.max(70, (h[4] - h[3]) / 2 + 40), X = sx(x), Y = sy(y); spr(C('halo_' + TROOP[k], 0), X, Y, clock * 0.12, r / 100, r / 100, 0.5 * veil(X, Y), KY); }
  }
  // a rank won: gold rises from the squad's men; the blessed host's moment: its halo opens and the element's pigment rings out
  function rankUp(e) {
    const men = []; const as = G && G.allies; if (as) for (const a of as) if (a.kind === e.troop && a.state !== 'dead') men.push([a.x, a.y]); if (!men.length) men.push([e.x, e.y]);
    const el = TROOP[e.troop] || 'earth', big = e.rank === 5;
    add({ men, life: big ? 1.2 : 0.7, ground: (o) => { if (!big) return; const u = o.t / 1.2; let cx = 0, cy = 0; for (const m of men) { cx += m[0]; cy += m[1]; } cx /= men.length; cy /= men.length; const k = 0.6 + 1.2 * ease(clamp(u * 2)); spr(C('halo_' + el, 0), sx(cx), sy(cy), u, k, k, 0.9 * (1 - clamp((u - 0.5) * 2)), KY); },
      over: (o) => { const u = o.t / (big ? 1.2 : 0.7); for (const [j, m] of men.entries()) { const X = sx(m[0]), Y = sy(m[1]) - (30 + 60 * ease(u)) * F.z; spr(C('ray', j), X, Y, -1.5708, big ? 0.45 : 0.3, 1.2, (1 - u) * 0.9); if (big) spr(C(RIDER_CELL[el], j), X + (j % 2 ? 10 : -10) * F.z, Y + 20 * F.z, -1.5, 1.2, 1.2, 1 - u); } } });
  }


  // ================================================================ the generals (section 6.3)
  // Their plain blows in their element's stroke; each skill as the novel has it; the true form (显圣) as the one full-sheet
  // moment of the game: hair rays gather on him, his element's aureole opens round him (flame tongues, crests, a ring of
  // drums, rays, slabs), and four great strokes sweep in from the corners of the sheet, never across its middle; 1.8 s in all.
  const genUnit = (gid) => { const as = G && G.allies; if (as) for (const a of as) if (a.kind === 'general' && a.general === gid) return a; return null; };
  function generalBlow(e) {
    const el = GEN[e.id], X0 = () => sx(e.x), seed = (hash(frame * 17) * 1e4) | 0;
    if (e.shape === 'line') { const L = e.length || 150, k = (e.width || 30) / 34;
      add({ life: 0.4, over: (o) => { const x1 = e.x + Math.cos(e.dir) * L, y1 = e.y + Math.sin(e.dir) * L, X0 = sx(e.x), Y0 = sy(e.y) - 34 * F.z, X1 = sx(x1), Y1 = sy(y1) - 34 * F.z, p = clamp(o.t / 0.05), a = 1 - clamp((o.t - 0.12) / 0.25), v = veil(X1, Y1);
        if (el === 'fire') { chord(C('thrust', seed), X0, Y0, X1, Y1, 260, k * 0.9, a * v, 0, p); if (p >= 1 && o.t < 0.2) spr(CELL.spearhead, X1, Y1, Math.atan2(Y1 - Y0, X1 - X0), k, X1 < X0 ? -k : k, a * v); }
        else chord(C('throw', seed), X0, Y0, X1, Y1, 150, k * 0.8, a * v, 0, p); } }); return; }
    if (e.shape === 'arc') { const R = e.radius || 90, full = (e.angle || 0) >= 359;
      add({ life: 0.45, over: (o) => { const u = o.t / 0.45, n = full ? 8 : 3; for (let j = 0; j < n; j++) { const a = full ? (j / n) * TAU + o.t * 6 : e.dir + (j - 1) * 0.35, X0 = sx(e.x), Y0 = sy(e.y) - 30 * F.z, X1 = sx(e.x + Math.cos(a) * R), Y1 = sy(e.y + Math.sin(a) * R) - 30 * F.z;
          chord(el === 'metal' ? C('blade', j) : C('bolt', j), X0, Y0, X1, Y1, el === 'metal' ? 220 : 200, el === 'metal' ? 1.2 : 0.6, (1 - u) * veil(X1, Y1), 0, clamp(u * 6)); } },
        ground: (o) => { if (el !== 'earth') return; const k = R / 100; spr(C('quake', seed), sx(e.x), sy(e.y), 0, k * (1 + o.t), k * (1 + o.t), (1 - o.t / 0.45) * 0.8, KY); } }); return; }
    if (e.shape === 'drop') for (const p of e.targets || [e]) add({ life: 0.5, over: (o) => { const X = sx(p.x), Y = sy(p.y) - 10 * F.z, u = o.t / 0.5; if (o.t < 0.18) chord(C('bolt', seed), X + 40 * F.z, Y - 300 * F.z, X, Y, 200, 1.1, (1 - o.t / 0.18) * veil(X, Y), 0, clamp(o.t / 0.04)); },
      ground: (o) => { const m = sink(o.t), k = (e.radius || 62) / 60; spr(CELL.whip_hit, sx(p.x), sy(p.y), seed, k * 0.6, k * 0.6, m * veil(sx(p.x), sy(p.y)), KY); } });
  }
  // each general's skill carries one bold stroke in his element from him to where it lands, so it is his at a glance in a crowd
  function signature(e, el, seed) { const u = genUnit(e.general), x0 = u ? u.x : e.x, y0 = u ? u.y : e.y, ts = e.targets || [], t0 = ts[0], d = e.dir || 0;
    const tx = t0 ? t0.x : x0 + Math.cos(d) * (e.radius || e.length || 200), ty = t0 ? t0.y : y0 + Math.sin(d) * (e.radius || e.length || 200);
    const line = (cell, L, ky, life, z = 34) => add({ life, over: (o) => { const X0 = sx(x0), Y0 = sy(y0) - z * F.z, X1 = sx(tx), Y1 = sy(ty) - z * F.z, p = clamp(o.t / 0.06), a = 1 - clamp((o.t - 0.12) / (life - 0.12)); chord(cell, X0, Y0, X1, Y1, L, ky, a * veilSeg(X0, Y0, X1, Y1), 0, p, false); } });
    if (e.general === 'nezha') { line(C('thrust', seed), 260, 1.3, 0.45); add({ life: 0.3, over: (o) => { const X0 = sx(x0), Y0 = sy(y0) - 34 * F.z, X1 = sx(tx), Y1 = sy(ty) - 34 * F.z; if (o.t > 0.05) spr(CELL.spearhead, X1, Y1, Math.atan2(Y1 - Y0, X1 - X0), 1.4, X1 < X0 ? -1.4 : 1.4, (1 - o.t / 0.3) * veil(X1, Y1)); } }); }
    else if (e.general === 'yangjian') line(C('wind', seed), 200, 0.9, 0.5, 20);                // the hound's run: a black streak
    else if (e.general === 'tuxingsun') { for (const p of ts.length ? ts : [{ x: tx, y: ty }]) { const n = 5; for (let j = 0; j < n; j++) { const f = (j + 1) / (n + 1), x = x0 + (p.x - x0) * f, y = y0 + (p.y - y0) * f; add({ x, y, life: 0.5, t0: j * 0.04, seed: seed + j, ground: (o) => { const s2 = o.t - o.t0; if (s2 < 0) return; spr(C('crack', o.seed), sx(o.x), sy(o.y), o.seed, 0.5, 0.5, sink(s2) * veil(sx(o.x), sy(o.y)), KY, 0, clamp(s2 / 0.05)); } }); }
        add({ x: p.x, y: p.y, life: 0.6, seed, over: (o) => { for (let j = 0; j < 5; j++) { const b = -PI / 2 + (j - 2) * 0.35, f = ease(clamp(o.t / 0.3)), X = sx(o.x) + Math.cos(b) * 50 * f * F.z, Y = sy(o.y) + Math.sin(b) * 110 * f * F.z; spr(C('slab', j + o.seed), X, Y, b + PI / 2, 0.9, 0.9, (1 - clamp((o.t - 0.3) / 0.3)) * veil(X, Y)); } spr(C('dust', o.seed), sx(o.x), sy(o.y), 0, 1.5 + o.t, 1.2 + o.t, 0.8 * (1 - o.t / 0.6) * veil(sx(o.x), sy(o.y))); } }); } }      // the ground runs to him and bursts upward
    else if (e.general === 'huangfeihu') { banners(0.9); line(C('rut', seed), 200, 1.4, 0.6, 0); }
  }
  function generalSkill(e) {
    const el = e.element || GEN[e.general], seed = (hash(frame * 23) * 1e4) | 0;
    if (e.trueForm) echo(e.general);
    signature(e, el, seed);
    if (e.shape === 'arc') { castSash({ x: e.x, y: e.y, radius: e.radius, angle: e.angle, dir: e.dir, level: e.trueForm ? 6 : 3, evolved: (e.angle || 0) >= 359, fixed: true }); return; }
    if (e.shape === 'hound') { const n = e.trueForm ? 6 : 1, ts = e.targets || [];
      add({ life: 0.7, over: (o) => { for (let j = 0; j < Math.max(n, ts.length); j++) { const p = ts[j % Math.max(1, ts.length)] || e, u = clamp((o.t - j * 0.05) / 0.3); if (u <= 0) continue; const off = (j - n / 2) * 22, x = e.x + (p.x - e.x) * ease(u) + off * 0.3, y = e.y + (p.y - e.y) * ease(u) + off, z = 70 * Math.sin(PI * Math.min(1, u)), X = sx(x), Y = sy(y) - z * F.z;
          if (u < 1) spr(C('hound', j), X, Y, Math.atan2((p.y - e.y) * KY, p.x - e.x) * 0.3, p.x < e.x ? -1.3 : 1.3, 1.3, veil(X, Y)); else { const s2 = o.t - j * 0.05 - 0.3; spr(C('splash', j + seed), sx(p.x), sy(p.y), j, 0.5, 0.6, (1 - s2 / 0.35) * veil(X, Y), KY, 0, clamp(s2 / 0.05)); } } } }); return; }
    if (e.shape === 'line') { const L = e.length || 380, w = (e.width || 64) / 64, T = e.time || 0.35;      // 雷震子 dives along it: wind-and-thunder, bold folds and a green wake
      add({ life: T + 0.5, over: (o) => { const u = clamp(o.t / T), fade = 1 - clamp((o.t - T) / 0.4), X0 = sx(e.x), Y0 = sy(e.y) - 40 * F.z, X1 = sx(e.x + Math.cos(e.dir) * L), Y1 = sy(e.y + Math.sin(e.dir) * L) - 40 * F.z;
        chord(C('wind', seed), X0, Y0 + 20 * F.z, X1, Y1 + 20 * F.z, 200, w * 1.1, 0.8 * fade * veilSeg(X0, Y0, X1, Y1), 0, u, false); for (let k = 0; k < 2; k++) chord(C('bolt', k + seed), X0, Y0 + (k - 0.5) * 40 * F.z, X1, Y1 + (k - 0.5) * 40 * F.z, 200, w * 1.4, fade * veilSeg(X0, Y0, X1, Y1), Math.max(0, u - 0.5), u); } }); return; }
    if (e.shape === 'bindOne') { for (const p of e.targets || []) add({ x: p.x, y: p.y, life: 0.6, ground: (o) => { const m = sink(o.t), X = sx(o.x), Y = sy(o.y); for (let j = 0; j < 3; j++) spr(C('crack', j), X, Y, j * 2.1, 0.6, 0.6, m * veil(X, Y), KY, 0, clamp(o.t / 0.06)); spr(C('dust', 1), X, Y, 0, 0.8 + o.t, 0.8, (1 - o.t / 0.6) * 0.8); } }); return; }
    if (e.shape === 'stone') return;      // the stones are the rules' shots
    if (e.shape === 'cone') { const R = e.radius || 440, ang = ((e.angle || 130) * PI) / 180, cols = ['red', 'blue', 'green', 'metal', 'earth'];      // 五光齐放: five lights fan out over the whole side, once
      add({ life: 0.7, over: (o) => { const p = clamp(o.t / 0.08), a = o.t < 0.2 ? 1 : 1 - clamp((o.t - 0.2) / 0.45); for (let j = 0; j < 15; j++) { const b = e.dir - ang / 2 + (ang * (j + 0.5)) / 15, X0 = sx(e.x), Y0 = sy(e.y) - 40 * F.z, X1 = sx(e.x + Math.cos(b) * R), Y1 = sy(e.y + Math.sin(b) * R) - 20 * F.z;
        const c = j % 5 === 3 ? C('ray', j) : j % 5 === 4 ? C('hit_earth', j) : C('hit_' + ['fire', 'water', 'wood'][j % 5], j); chord(c, X0, Y0, X1, Y1, j % 5 === 3 ? 200 : 30, j % 5 === 3 ? 1.6 : 2.4, a * veil(X1, Y1), 0, p); } } }); return; }
    if (e.shape === 'rally') { const h = G && G.hero, R = e.radius || 280; add({ life: 0.9, ground: (o) => { const cx = (genUnit(e.general) || e).x, cy = (genUnit(e.general) || e).y, k = (R / 100) * ease(clamp(o.t / 0.4)); spr(CELL.gold_ring, sx(cx), sy(cy), 0, k, k, 0.7 * (1 - clamp((o.t - 0.4) / 0.5)), KY); spr(C('halo_earth', 0), sx(cx), sy(cy), o.t, k * 0.8, k * 0.8, 0.5 * (1 - clamp((o.t - 0.3) / 0.6)), KY); },
      over: (o) => { const as = G && G.allies; if (!as || o.t > 0.6) return; let j = 0; for (const a of as) { if (a.kind === 'general' || a.state === 'dead' || j++ > 40) continue; spr(C('ray', j), sx(a.x), sy(a.y) - (40 + 80 * o.t) * F.z, -1.5708, 0.25, 1, 1 - o.t / 0.6); } } }); return; }
  }
  function summonMoment(e, back) {      // he comes down: rays gather on him, a cloud under him; a withdrawal is ink scattered and the cloud
    add({ x: e.x, y: e.y, g: e.general, life: back ? 0.7 : 0.9, seed: frame, over: (o) => { const u = genUnit(o.g), x = u ? u.x : o.x, y = u ? u.y : o.y, X = sx(x), Y = sy(y), t = o.t;
      spr(C('cloud', o.seed), X, Y + 4 * F.z, 0, 0.8, 0.5 * (1 - clamp((t - 0.3) / 0.5)), 0.6 * (1 - clamp((t - 0.3) / 0.5)));
      if (!back && t < 0.5) for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU, d = 160 * (1 - ease(t / 0.5)); spr(C('ray', j), X + Math.cos(a) * d * F.z, Y - 60 * F.z + Math.sin(a) * d * 0.6 * F.z, a + PI, 0.3, 1, 1 - t / 0.5); } } });
  }
  function generalFall(e) { add({ x: e.x, y: e.y, life: 1, seed: frame, ground: (o) => { const m = sink(o.t); for (let j = 0; j < 6; j++) spr(C('splash', j + o.seed), sx(o.x), sy(o.y), j * 1.05, 0.5, 0.6, m * 0.8, KY, 0, clamp(o.t / 0.06)); }, over: (o) => spr(C('cloud', o.seed), sx(o.x), sy(o.y) - 30 * F.z * o.t, 0, 0.6, 0.4, 0.6 * (1 - o.t)) }); }
  const AUREOLE = { fire: (j) => (j % 3 ? C('fl_dry', j) : C('fl', 4 + (j % 2))), water: (j) => (j % 2 ? CELL.crest_big : C('crest', j)), wood: () => CELL.drum, metal: (j) => C('ray', j), earth: (j) => C('slab', j) };
  // 显圣: the 法相. A great image of the general's true form rises behind him over the field (several riders tall), in pale ink line,
  // thin mineral colour and gold; it stands about 1.2 s while the small figure changes, then sinks into the paper. It is drawn
  // under the danger marks and the figures, so nothing that can hurt is hidden. 土行孙 has no image: the earth opens round him.
  // A treasure's evolution uses the element's aureole and gather, without an image.
  function trueForm(e) {
    // the 法相: every general the figures module paints (all ten since 2026-11-25), with its old mandorla where one was cut
    const el = e.el || GEN[e.general] || 'fire', img = e.general && CELL['mandorla_' + e.general]; if (e.general) figures(e.general); const fig = img || !!e.general;      // (whether the figure has loaded is asked each frame: the module resolves once its pictures are decoded)
    if (e.general === 'tuxingsun') { earthOpens(e); return; }
    if (e.general === 'huangfeihu') banners(1.6);
    add({ g: e.general, x: e.x, y: e.y, el, img, life: fig ? 2 : 1.6, seed: frame,
      under: fig ? (o) => { const x = o.x, y = o.y, t = o.t,      /* it stands where he showed himself: a picture that slid after a running figure read as a sticker */ rise = ease(clamp((t - 0.1) / 0.35)), sinkU = clamp((t - 1.55) / 0.45), a = rise * (1 - sinkU);
        if (a > 0) { const tall = Math.max(o.img ? o.img[6] * 0.85 : 0, FIG_UNITS * 930), fit = Math.min(1, (0.72 * F.h) / (tall * F.z)); let Y = clamp(sy(y), F.h * 0.5, F.h * 0.95); const Xa = clamp(sx(x), F.w * 0.22, F.w * 0.78), top = Y - tall * fit * F.z; if (top < F.h * 0.1) Y += F.h * 0.1 - top;      // a general far off still shows himself on the sheet, on his side of it      // the taller of the mandorla and the figure      // kept on the sheet, below the HUD: no taller than 72% of it, and lower if he stands high
          const Yi = Y + (1 - rise) * 120 * F.z + sinkU * 60 * F.z, strong = t < 0.55 ? 1 : 1 - 0.22 * clamp((t - 0.55) / 0.4);      // stronger while it rises, then it thins
          if (o.img) spr(o.img, Xa, Yi, 0, 0.85 * fit, 0.85 * fit * (1 - 0.35 * sinkU), 0.7 * a); figure(o.g, Xa, Yi, 1 - 0.35 * sinkU, strong * a, fit); } } : null,
      over: (o) => { const u = o.g ? genUnit(o.g) : G && G.hero, x = u ? u.x : o.x, y = u ? u.y : o.y, X = sx(x), Y = sy(y) - 60 * F.z, t = o.t;
        if (t < 0.25) for (let j = 0; j < 10; j++) { const a = (j / 10) * TAU + 0.3, d = 260 * (1 - ease(t / 0.25)); spr(C('ray', j), X + Math.cos(a) * d * F.z, Y + Math.sin(a) * d * F.z, a + PI, 0.4, 1, 0.6 * (t / 0.25) * (1 - t / 0.25) * 4); }      // gather: hair rays converge on him
        if (o.img || (o.g && FIG.mod && FIG.mod.FAXIANG[o.g])) return;
        const open = ease(clamp((t - 0.2) / 0.3)), fade = 1 - clamp((t - 1.0) / 0.6), n = o.el === 'wood' ? 12 : o.el === 'metal' ? 24 : 14;
        if (open > 0 && fade > 0) { spr(CELL.mandorla, X, sy(y) + 6 * F.z, 0, 1.15 * open, 1.1 * open, 0.8 * fade * veil(X, Y));
          for (let j = 0; j < n; j++) { const a = (j / n) * TAU + t * 0.4, r = (90 + 60 * open) * F.z, Xj = X + Math.cos(a) * r, Yj = Y + Math.sin(a) * r * 0.85, v = veil(Xj, Yj);
            if (o.el === 'metal') spr(AUREOLE.metal(j), Xj, Yj, a, 0.6 * open, 1.4, fade * v);
            else if (o.el === 'water') spr(AUREOLE.water(j), Xj, Yj, a + PI / 2, Math.cos(a) < 0 ? -0.8 : 0.8, 0.8 * open, fade * v);
            else spr(AUREOLE[o.el](j), Xj, Yj, o.el === 'fire' || o.el === 'earth' ? a + PI / 2 : 0, o.el === 'wood' ? 2 : o.el === 'earth' ? 2.2 : 0.55, (o.el === 'wood' ? 2 : o.el === 'earth' ? 2.4 : 0.6) * open, fade * v); } } } });
  }
  // the figures of the 法相 are drawn by art/puppets/faxiang.js (the figures session): loaded when a general is first summoned,
  // baked to a canvas at the scale of the field (a figure about 560 units tall), so they add nothing to the first load
  const FIG = { mod: null, loading: null, baked: {} }, FIG_UNITS = 0.5;          // units per figure pixel
  function figures(g) {
    if (!FIG.mod && !FIG.loading) FIG.loading = import('../puppets/faxiang.js').then((m) => { FIG.mod = m; }).catch((e) => console.warn('fx: 法相 figures did not load', e));
    if (FIG.mod && g) bakeFig(g);
  }
  function bakeFig(g) { const k = Math.round(FIG_UNITS * F.z * 20) / 20, b = FIG.baked[g]; if (b && b.k === k) return b; if (!FIG.mod || !FIG.mod.FAXIANG[g]) return null; const cv = FIG.mod.bakeFaxiang(g, k); return (FIG.baked[g] = { k, cv, px: FIG.mod.FAXIANG[g].pivot[0] * k, py: FIG.mod.FAXIANG[g].pivot[1] * k }); }
  // (the old figures in the palest washes took a second pass; the painted pictures of 2026-11-25 are opaque, so none does)
  const FIG_DENSE = {};
  function figure(g, X, Y, sy_, a, fit = 1) { if (a <= 0.004) return; const b = FIG.baked[g] || bakeFig(g); if (!b) return; const s = (FIG_UNITS * F.z * fit) / b.k;
    ctx.setTransform(s, 0, 0, s * sy_, X, Y); ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(b.cv, -b.px, -b.py);
    const d = FIG_DENSE[g]; if (d) { ctx.globalAlpha = Math.min(1, a * d); ctx.drawImage(b.cv, -b.px, -b.py); } }
  // a quick pale echo of the 法相 each time the true form's skill fires
  function echo(g) { const img = CELL['mandorla_' + g]; if (g === 'tuxingsun') { const u = genUnit(g); if (u) earthOpens({ x: u.x, y: u.y, small: 1 }); return; } if (!img) return;
    add({ g, life: 0.35, under: (o) => { const u = genUnit(o.g); if (!u) return; const k = 0.92 + 0.08 * o.t / 0.35; const a = Math.sin(PI * o.t / 0.35); spr(img, sx(u.x), sy(u.y), 0, 0.85 * k, 0.85 * k, 0.22 * a); figure(g, sx(u.x), sy(u.y), k, 0.3 * a); } }); }
  // 地裂: the earth opens in a great ring round 土行孙: cracks run out, slabs stand up round the rim, dust; then it closes
  function earthOpens(e) { const R = e.small ? 170 : 320, L = e.small ? 0.7 : 1.6; if (!e.small && G && G.hero) { const h = G.hero, hw = (F.w / F.z) * 0.3, hh = (F.h / F.z / KY) * 0.25; e = { ...e, x: clamp(e.x, h.x - hw, h.x + hw), y: clamp(e.y, h.y - hh, h.y + hh) }; }      // he is often far off: the ground opens where the player can see it, on his side kickA = Math.max(kickA, e.small ? 3 : 8); kickT = 0;
    add({ x: e.x, y: e.y, life: L, seed: frame, under: (o) => { const X = sx(o.x), Y = sy(o.y), open = ease(clamp(o.t / 0.25)), close = clamp((o.t - (L - 0.45)) / 0.45), a = open * (1 - close), m = sink(o.t - (L - 0.9));
        spr(C('rain_wash', o.seed), X, Y, o.seed, (R / 100) * open, (R / 100) * open, 0.32 * a, KY);                         // the ground falls away inside the ring
        for (let j = 0; j < 8; j++) spr(C('crack', j + o.seed), X, Y, j * 0.785 + o.seed, (R / 80) * open, (R / 80) * open, 0.95 * a, KY);
        const nT = e.small ? 8 : 16; for (let j = 0; j < nT; j++) { const b = (j / nT) * TAU + hash(o.seed + j) * 0.3, Xj = sx(o.x + Math.cos(b) * R * 0.9), Yj = sy(o.y + Math.sin(b) * R * 0.9);      // ink thrown out from the rim, heavy as the seal's
          spr(C('throw', j + o.seed), Xj, Yj, b, 0.9 + 0.6 * hash(j), 1.2, m * veil(Xj, Yj), KY, 0, clamp(o.t / 0.08)); } },
      over: (o) => { const open = ease(clamp(o.t / 0.22)), close = clamp((o.t - (L - 0.45)) / 0.45), n = e.small ? 8 : 18; for (let j = 0; j < n; j++) { const b = (j / n) * TAU, X = sx(o.x + Math.cos(b) * R), Y = sy(o.y + Math.sin(b) * R), h = open * (1 - close) * (0.8 + 0.5 * hash(o.seed + j)), lift = 40 * Math.sin(PI * clamp(o.t / 0.5)) * F.z;
          if (h > 0.02) spr(C('slab', j + o.seed), X, Y - lift, (hash(j) - 0.5) * 0.5, 2.4, 2.8 * h, veil(X, Y)); if (o.t < 0.7) spr(C('dust', j), X, Y - 14 * F.z, 0, 1.6 + o.t * 3, 1.2 + o.t * 1.5, 0.75 * (1 - o.t / 0.7) * veil(X, Y)); } } });
  }
  // 王命 with the true form: a banner rises over every squad
  function banners(T) { const as = G && G.allies; if (!as) return; const sq = {}; for (const a of as) { if (a.kind === 'general' || a.state === 'dead') continue; const q = sq[a.kind] || (sq[a.kind] = [0, 0, 0]); q[0]++; q[1] += a.x; q[2] += a.y; }
    let j = 0; for (const k in sq) { const q = sq[k], x = q[1] / q[0], y = q[2] / q[0], i = j++; add({ x, y, life: T, over: (o) => { const up = ease(clamp((o.t - 0.1 * i) / 0.3)), f = 1 - clamp((o.t - T + 0.4) / 0.4), X = sx(o.x), Y = sy(o.y) - (60 + 60 * up) * F.z; spr(CELL.flag, X, Y, 0, 1.6, 1.6 * up, f * veil(X, Y)); } }); } }
  // what the generals leave: 雷震子's storm (a cloud that moves with him and strikes under it), 土行孙's rope and the opened earth
  function generalZones() {
    const zs = G && G.zones; if (!zs) return;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.dead || !GEN[z.src]) continue; const X = sx(z.x), Y = sy(z.y), r = z.r || 120, id = z.id || i, life = z.life || 3, a = clamp(z.t / 0.15) * clamp((life - z.t) / 0.3);
      if (glfx && (z.kind === 'storm' || (z.kind === 'hold' && z.src === 'tuxingsun'))) continue;      // the true forms' zones are painted in fx/gl/gods.js
      if (z.kind === 'storm') { spr(C('cloud', id), X, Y - 150 * F.z, Math.sin(z.t) * 0.05, r / 90, r / 110, 0.85 * a * veil(X, Y - 150 * F.z)); const ph = z.t * 3.3, slot = Math.floor(ph), u = ph - slot; if (u < 0.35) { const b = hash(id * 13 + slot) * TAU, d = Math.sqrt(hash(id * 7 + slot)) * r, Xb = sx(z.x + Math.cos(b) * d), Yb = sy(z.y + Math.sin(b) * d); chord(C('bolt', slot), Xb + 10 * F.z, Yb - 140 * F.z, Xb, Yb, 200, 0.8, (1 - u / 0.35) * a * veil(Xb, Yb), 0, clamp(u / 0.08)); } }
      else if (z.kind === 'bind') spr(C('rope', id), X, Y, 0, 1, 1, a * veil(X, Y));
      else if (z.kind === 'quake' || z.kind === 'hold' || z.kind === 'pit') { spr(C('field', id), X, Y, id, r / 100, r / 100, 0.5 * a * veil(X, Y), KY); for (let j = 0; j < 4; j++) spr(C('crack', j + id), X, Y, j * 1.6, r / 90, r / 90, 0.7 * a * veil(X, Y), KY); } }
  }

  // ================================================================ the Shang: danger, the only strong cinnabar on the ground
  // Every warned blow: its edge is struck at once at full strength (the read must not wait), its ground fills as the delay
  // runs out, and once, in its last quarter second, the edge thickens: the blow is coming (one beat, not a flash).
  // Never veiled, never thinned by density: danger is the second read.
  const PRESS = (z) => { const left = z.life - z.t; return left < 0.25 ? 1 + 0.22 * Math.sin(PI * clamp(1 - left / 0.25)) : 1; };
  function edgeLine(x0, y0, dir, L, a, k) { spr(CELL.warn_edge, sx(x0), sy(y0), dir, L / 200, k, a, KY); }
  function shangGround() {
    const zs = G && G.zones; if (!zs) return; const dz = G.hero && G.hero.dazzled > 0 ? 0.35 : 1;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.dead || z.side !== 'shang') continue; DIM = dz * (hiddenZ.has(z) ? 0.3 : 1); if (z.x < F.x0 - 700 || z.x > F.x1 + 700 || z.y < F.y0 - 700 || z.y > F.y1 + 700) continue;
      const X = sx(z.x), Y = sy(z.y), life = z.life || 1, p = clamp(z.t / life), inA = clamp(z.t / 0.08), r = z.r || 80, id = z.id || i;
      if (z.kind === 'dark') { darkGround(z, X, Y, r, id); continue; }
      if (z.kind === 'wall') { wallDraw(z, false); continue; }
      const pk = PRESS(z), dark = z.P && z.P.shape === 'dark';
      if (dark) {             // the umbrella opens: not a blow, so not cinnabar: ink gathers and a ring of pearls is laid
        spr(C('rain_wash', id), X, Y, id, r / 100 * (0.4 + 0.6 * ease(p)), r / 100 * (0.4 + 0.6 * ease(p)), 0.45 * inA, KY);
        const n = 18, shown = Math.ceil(n * ease(p)); for (let j = 0; j < shown; j++) { const b = (j / n) * TAU + id; spr(CELL.pearl, sx(z.x + Math.cos(b) * r), sy(z.y + Math.sin(b) * r), 0, 1.1, 1.1, 0.9 * inA); }
        continue; }
      if (z.shape === 'lane' || z.kind === 'lane') {
        const L = z.len || 400, w = z.w || 60, d = z.dir || 0, c = Math.cos(d), s = Math.sin(d), nx = -s * w / 2, ny = c * w / 2;
        edgeLine(z.x + nx, z.y + ny, d, L, inA, pk); edgeLine(z.x - nx, z.y - ny, d, L, inA, pk);
        spr(CELL.warn_tick_0, sx(z.x + L * c - nx), sy(z.y + L * s - ny), d + PI / 2, w / 28, pk, inA, KY);                 // the far end closed
        const f = ease(p), cx = z.x + c * L * f / 2, cy = z.y + s * L * f / 2; spr(CELL.warn_fill, sx(cx), sy(cy), d, L * f / 200, w / 200, 0.3 + 0.25 * p, KY);
        const nC = Math.max(2, Math.round(L / 90)), head = f * L; for (let j = 0; j < nC; j++) { const at = ((j + 0.5) / nC) * L; if (at > head) break; const q = at / L; spr(CELL.warn_chev, sx(z.x + c * at), sy(z.y + s * at), d, w / 70 + 0.5, w / 70 + 0.5, (0.55 + 0.45 * q) * inA, KY); }
        continue; }
      if (z.shape === 'cone') {
        const d = z.dir || 0, half = ((z.angle || 60) * PI) / 360;
        edgeLine(z.x, z.y, d - half, r, inA, pk); edgeLine(z.x, z.y, d + half, r, inA, pk);
        const nT = Math.max(5, Math.round((r * half * 2) / 24)); for (let j = 0; j < nT; j++) { const b = d - half + (2 * half * j) / nT; spr(C('warn_tick', j), sx(z.x + Math.cos(b) * r), sy(z.y + Math.sin(b) * r), b + PI / 2, (r * half * 2) / nT / 24, 1.2 * pk, inA, KY); }
        const f = ease(p); for (let k = 1; k <= 3; k++) { const rr = (r * k) / 4; if (rr > r * f + 1) break; for (let j = 0; j <= 0; j++) { const b = d; spr(CELL.warn_chev, sx(z.x + Math.cos(b) * rr), sy(z.y + Math.sin(b) * rr), b, 0.9 + k * 0.25, 0.9 + k * 0.25, 0.85 * inA, KY); } }
        for (let j = 0; j < 3; j++) { const b = d + (j - 1) * half * 0.62, rr = r * f * 0.55; spr(CELL.warn_fill, sx(z.x + Math.cos(b) * rr), sy(z.y + Math.sin(b) * rr), b, (r * f) / 190, (r * half * f) / 260, 0.3 + 0.2 * p, KY); }
        continue; }
      if (z.shape === 'ring') {
        const r0 = z.r0 || r * 0.6, k1 = r / 100, k0 = r0 / 100, near = 0.4 + 0.6 * clamp(1 - (life - z.t - 0.25) / 0.7), ra = inA * near;   // band after band: the next to strike is the strongest
        const gap = z.gap || 0, gd = z.dir || 0, inGap = (b) => gap > 0 && Math.abs(Math.atan2(Math.sin(b - gd), Math.cos(b - gd))) < gap;   // SPEC 1.15: the band left open on the boss's far side
        if (!gap) { spr(CELL.warn_ring, X, Y, id, k1 * pk, k1 * pk, ra, KY); spr(CELL.warn_ring, X, Y, id + 2, k0, k0, 0.5 * ra, KY); }
        else { for (const [rr, a, kk] of [[r, ra, pk], [r0, 0.5 * ra, 1]]) { const m = Math.max(12, Math.round((TAU * rr) / 24)); for (let j = 0; j < m; j++) { const b = (j + 0.5) / m * TAU; if (inGap(b)) continue; spr(C('warn_tick', j), sx(z.x + Math.cos(b) * rr), sy(z.y + Math.sin(b) * rr), b + PI / 2, (TAU * rr) / m / 24, 1.2 * kk, a, KY); } }
          for (const e of [-1, 1]) { const b = gd + e * gap; edgeLine(z.x + Math.cos(b) * r0, z.y + Math.sin(b) * r0, b, r - r0, ra, pk); } }      // the two edges of the way through
        const n = Math.max(10, Math.round((TAU * (r + r0)) / 2 / 46)), shown = Math.ceil(n * ease(p)); for (let j = 0; j < shown; j++) { const b = (j / n) * TAU + id * 0.37; if (inGap(b)) continue; spr(C('warn_tick', j), sx(z.x + Math.cos(b) * r0), sy(z.y + Math.sin(b) * r0), b + 0.25, (r - r0) / 30, 1, 0.6 * ra, KY); }
        continue; }
      // a circle
      spr(CELL.warn_fill, X, Y, id, (r / 100) * ease(p), (r / 100) * ease(p), 0.35 + 0.3 * p, KY);
      spr(CELL.warn_ring, X, Y, id, (r / 100) * pk, (r / 100) * pk, inA, KY); }
  }
  // 混元珍珠伞: the dark the umbrella throws while it lasts: a low ink wash (lighter than the foes), a slow ring of pearls on its rim
  function darkGround(z, X, Y, r, id) {
    const life = z.life || 5, a = clamp(z.t / 0.25) * clamp((life - z.t) / 0.4);
    spr(C('rain_wash', id), X, Y, id, r / 100, r / 100, 0.5 * a, KY); spr(C('ripple', id), X, Y, id, r / 100, r / 100, 0.3 * a, KY);
    const n = 16; for (let j = 0; j < n; j++) { const b = (j / n) * TAU + z.t * 0.35; spr(CELL.pearl, sx(z.x + Math.cos(b) * r), sy(z.y + Math.sin(b) * r), 0, 1, 1, 0.85 * a); }
  }
  // 金遁: a ring of gold slabs standing; the far half drawn under the figures, the near half over them (veiled round the hero)
  function wallDraw(z, front) {
    const life = z.life || 3, up = z.t < 0.14 ? ease(z.t / 0.14) : z.t > life - 0.25 ? clamp((life - z.t) / 0.25) : 1, R = ((z.r0 || 128) + (z.r || 160)) / 2, n = Math.max(12, Math.round((TAU * R) / 42)), id = z.id || 0;
    for (let j = 0; j < n; j++) { const b = (j / n) * TAU, s = Math.sin(b); if ((s > 0) !== front) continue; const X = sx(z.x + Math.cos(b) * R), Y = sy(z.y + s * R); spr(C('gold_wall', j + id), X, Y, 0, 1.15, 1.25 * up, front ? veil(X, Y - 40 * F.z) : 1); }
  }
  function shangOver() { const zs = G && G.zones; if (!zs) return; const dz = G.hero && G.hero.dazzled > 0 ? 0.35 : 1; for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (!z.dead && z.side === 'shang' && z.kind === 'wall') { DIM = dz * (hiddenZ.has(z) ? 0.3 : 1); wallDraw(z, true); } } DIM = 1; }

  // the blows land, each in its own stroke (and none in cinnabar: that was the warning)
  const SHANG_LAND = {
    blackWind: (e) => {   // 青云剑: a black wind out of the cone, spear points flying in it (第40回: 黑风卷起，有万千戈矛)
      const d = e.dir || 0, half = ((e.angle || 60) * PI) / 360, r = e.radius || 400;
      add({ x: e.x, y: e.y, life: 0.95, seed: frame, ground: (o) => { const m = sink(o.t - 0.2); for (let j = 0; j < 5; j++) { const b = d + (j / 4 - 0.5) * 2 * half * 0.8; spr(C('hair', j), sx(o.x + Math.cos(b) * 40), sy(o.y + Math.sin(b) * 40), b, (r * 0.85) / 200, 3, 0.8 * m, KY, 0, clamp(o.t / 0.25)); } },
        over: (o) => { const u = clamp((o.t - 0.45) / 0.5); for (let j = 0; j < 5; j++) { const b = d + (j / 4 - 0.5) * 2 * half * 0.85, h = (34 + 30 * hash(o.seed + j)) * F.z, f0 = 30 + 0.5 * r * clamp(o.t / 0.5 - 0.3), f1 = 60 + r * ease(clamp(o.t / 0.32 + j * 0.03)), X0 = sx(o.x + Math.cos(b) * f0), Y0 = sy(o.y + Math.sin(b) * f0) - h, X1 = sx(o.x + Math.cos(b) * f1), Y1 = sy(o.y + Math.sin(b) * f1) - h, v = Math.min(veil(X1, Y1), veilSeg(X0, Y0, X1, Y1));
          if (f1 > f0 + 10) chord(C('wind', j + o.seed), X0, Y0, X1, Y1, 200, 0.75 + 0.3 * hash(j), (1 - u) * 0.85 * v, 0, 1, false);
          spr(C('blade', j), X1, Y1, Math.atan2(Y1 - Y0, X1 - X0), 0.24, 1.2, (1 - u) * v); } } }); },
    fireSnakes: (e) => {  // fire snakes rise where each circle was
      const r = e.radius || 70; add({ x: e.x, y: e.y, life: 0.8, seed: frame, ground: (o) => spr(C('scorch', o.seed), sx(o.x), sy(o.y), o.seed, r / 90, r / 90, 0.55 * sink(o.t), KY),
        over: (o) => { const u = o.t / 0.8; for (let j = 0; j < 4; j++) { const b = j * 1.57 + o.seed, X = sx(o.x + Math.cos(b) * r * 0.45), Y = sy(o.y + Math.sin(b) * r * 0.45); spr(C(u < 0.4 ? 'fl' : 'fl_dry', j + o.seed), X, Y, (j - 1.5) * 0.15, 1.1, 1.35 * Math.sin(PI * clamp(u * 1.2 + j * 0.05)), veil(X, Y)); } } }); },
    pearlRing: (e) => {   // the umbrella's pearls fly out across the band
      const r0 = e.inner || 150, r = e.radius || 232; add({ x: e.x, y: e.y, life: 0.6, seed: frame, ground: (o) => spr(C('ripple', o.seed), sx(o.x), sy(o.y), 0, (r0 + (r - r0) * ease(o.t / 0.3)) / 100, (r0 + (r - r0) * ease(o.t / 0.3)) / 100, 0.6 * sink(o.t), KY),
        over: (o) => { const u = clamp(o.t / 0.3), rr = r0 + (r - r0) * ease(u); for (let j = 0; j < 20; j++) { const b = (j / 20) * TAU, X = sx(o.x + Math.cos(b) * rr), Y = sy(o.y + Math.sin(b) * rr) - 22 * F.z; spr(CELL.pearl, X, Y, 0, 1.9, 1.9, (1 - clamp((o.t - 0.3) / 0.3)) * veil(X, Y)); spr(C('pearl_tail', j), X, Y, Math.atan2(Math.sin(b) * KY, Math.cos(b)), -0.5, 0.8, 0.6 * (1 - u) * veil(X, Y)); } } }); },
    fourStrings: (e) => { // 碧玉琵琶: the strings struck: a band of sound, ink rings travelling out
      const r0 = e.inner || 70, r = e.radius || 150; add({ x: e.x, y: e.y, life: 0.7, seed: frame, ground: (o) => { const u = ease(clamp(o.t / 0.35)), m = sink(o.t); for (let j = 0; j < 3; j++) { const rr = r0 + (r - r0) * clamp(u - j * 0.15); spr(C('ripple', j + o.seed), sx(o.x), sy(o.y), j, rr / 100, rr / 100, 0.75 * m, KY); } spr(C('quake', o.seed), sx(o.x), sy(o.y), o.seed, r / 100, r / 100, 0.5 * m, KY); } }); },
    windFire: (e) => {    // 风火: wind and fire down the lane, a sheet of it, then dry
      const d = e.dir || 0, L = e.length || 600, w = e.width || 90, c = Math.cos(d), s = Math.sin(d);
      add({ x: e.x, y: e.y, life: 1, seed: frame, ground: (o) => { const m = sink(o.t - 0.2); for (let j = 0; j < 5; j++) { const f = (j + 0.5) / 5; spr(C('scorch', j + o.seed), sx(o.x + c * L * f), sy(o.y + s * L * f), j, w / 80, w / 80, 0.45 * m, KY); } },
        over: (o) => { const head = clamp(o.t / 0.3) * L, n = Math.round(L / 40); for (let j = 0; j < n; j++) { const at = (j + 0.5) * (L / n); if (at > head) break; const age = o.t - (at / L) * 0.3, u = clamp(age / 0.6), off = (hash(o.seed + j) - 0.5) * w * 0.8, X = sx(o.x + c * at - s * off), Y = sy(o.y + s * at + c * off); if (u >= 1) continue; spr(C(u < 0.35 ? 'fl' : 'fl_dry', j), X, Y, c * 0.35, 1.05, 1.2 * Math.sin(PI * u), veil(X, Y)); }
          const u = clamp((o.t - 0.35) / 0.5); for (let j = 0; j < 3; j++) { const off = (j - 1) * w * 0.3, f0 = Math.max(0, head - 260), X0 = sx(o.x + c * f0 - s * off), Y0 = sy(o.y + s * f0 + c * off) - 40 * F.z, X1 = sx(o.x + c * head - s * off), Y1 = sy(o.y + s * head + c * off) - 40 * F.z; if (head > 20) chord(C('wind', j + o.seed), X0, Y0, X1, Y1, 200, 0.6, 0.7 * (1 - u) * veilSeg(X0, Y0, X1, Y1), 0, 1, false); } } }); },
    pairedWhips: (e) => { // 雌雄金鞭: a gold whip comes down where each circle was: a ray of gold, a flat hard print, slabs
      const r = e.radius || 135; kickA = Math.max(kickA, 3); kickT = 0;
      add({ x: e.x, y: e.y, life: 0.9, seed: frame, ground: (o) => { const m = sink(o.t); spr(CELL.whip_hit, sx(o.x), sy(o.y), o.seed, r / 70, r / 70, 0.85 * m, KY); for (let j = 0; j < 4; j++) spr(C('crack', j + o.seed), sx(o.x), sy(o.y), j * 1.6, r / 95, r / 95, 0.7 * m, KY); },
        over: (o) => { const u = o.t / 0.25; if (u < 1) { const X = sx(o.x), Y = sy(o.y); chord(C('ray', o.seed), X + 60 * F.z, Y - 320 * F.z, X, Y, 210, 1.6, (1 - u) * veil(X, Y), 0, clamp(u * 4)); } for (let j = 0; j < 5; j++) { const b = j * 1.26 + o.seed, f = ease(clamp(o.t / 0.4)), X = sx(o.x + Math.cos(b) * r * 0.8 * f), Y = sy(o.y + Math.sin(b) * r * 0.8 * f) - 50 * Math.sin(PI * clamp(o.t / 0.5)) * F.z; spr(C('slab', j), X, Y, b, 0.8, 0.8, (1 - clamp((o.t - 0.4) / 0.3)) * veil(X, Y)); } } }); },
    goldWallSlam: (e) => { // the wall falls in on the one inside it
      const r = e.radius || 120; kickA = Math.max(kickA, 4); kickT = 0;
      add({ x: e.x, y: e.y, life: 1, seed: frame, ground: (o) => { const m = sink(o.t); spr(CELL.seal_shadow, sx(o.x), sy(o.y), 0, r / 62, r / 62, 0.5 * m, KY); for (let j = 0; j < 5; j++) spr(C('crack', j + o.seed), sx(o.x), sy(o.y), j * 1.26, r / 90, r / 90, 0.8 * m, KY); for (let j = 0; j < 6; j++) spr(C('splash', j), sx(o.x), sy(o.y), j * 1.05, r / 120, r / 120, 0.6 * m, KY, 0, clamp(o.t / 0.06)); },
        over: (o) => { for (let j = 0; j < 6; j++) { const b = (j / 6) * TAU, X = sx(o.x + Math.cos(b) * r * 0.9), Y = sy(o.y + Math.sin(b) * r * 0.9); spr(C('dust', j), X, Y - 20 * F.z * o.t, 0, 1.2 + o.t, 1 + o.t, 0.7 * (1 - o.t) * veil(X, Y)); } } }); },
    goldWall: (e) => {    // the wall rises: dust out from its foot
      const r = e.radius || 160; add({ x: e.x, y: e.y, life: 0.6, seed: frame, over: (o) => { for (let j = 0; j < 10; j++) { const b = (j / 10) * TAU, X = sx(o.x + Math.cos(b) * r), Y = sy(o.y + Math.sin(b) * r); spr(C('dust', j), X, Y, 0, 1 + o.t, 0.8 + o.t, 0.7 * (1 - o.t / 0.6) * veil(X, Y)); } } }); },
    umbrellaDark: (e) => add({ x: e.x, y: e.y, life: 0.5, seed: frame, over: (o) => { const r = e.radius || 290, rr = r * (1 - ease(clamp(o.t / 0.3)) * 0.85); for (let j = 0; j < 14; j++) { const b = (j / 14) * TAU, X = sx(o.x + Math.cos(b) * rr), Y = sy(o.y + Math.sin(b) * rr) - 30 * F.z; spr(C('wake', j), X, Y, Math.atan2(-Math.sin(b) * KY, -Math.cos(b)), 0.8, 0.5, 0.6 * (1 - o.t / 0.5) * veil(X, Y)); } } }),
  };
  // the weight of a warned blow: ink thrown out over the ground it covered and a kick, so it lands as hard as it was announced
  function landWeight(e) { const r = e.radius || 90, lane = e.shape === 'lane', cone = e.shape === 'cone', L = e.length || r, d = e.dir || 0, n = lane ? Math.max(3, Math.round(L / 110)) : cone ? 3 : 1;
    kickA = Math.max(kickA, 3 + Math.min(3, r / 80)); kickT = 0;
    for (let i = 0; i < n; i++) { const f = lane ? (i + 0.5) / n * L : cone ? (i + 1) / (n + 1) * r : e.shape === 'ring' ? 0 : 0, x = e.x + Math.cos(d) * f, y = e.y + Math.sin(d) * f, k = lane ? (e.width || 80) / 70 : cone ? r / 200 : r / 75;
      add({ x, y, life: 0.9, seed: frame + i, k, ring: e.shape === 'ring' ? (e.inner + r) / 2 : 0, gap: e.gap || 0, gd: e.dir || 0, ground: (o) => { const m = sink(o.t), X = sx(o.x), Y = sy(o.y); if (o.ring) { for (let j = 0; j < 10; j++) { const b = (j / 10) * TAU + o.seed; if (o.gap && Math.abs(Math.atan2(Math.sin(b - o.gd), Math.cos(b - o.gd))) < o.gap) continue; const Xj = sx(o.x + Math.cos(b) * o.ring), Yj = sy(o.y + Math.sin(b) * o.ring); spr(C('splash', j), Xj, Yj, b, 0.9, 0.9, 0.75 * m * veil(Xj, Yj), KY, 0, clamp(o.t / 0.06)); } return; }
        for (let j = 0; j < 6; j++) spr(C('splash', j + o.seed), X, Y, j * 1.05 + o.seed, o.k * 0.8, o.k * 0.8, 0.8 * m * veil(X, Y), KY, 0, clamp(o.t / 0.06)); spr(C('quake', o.seed), X, Y, 0, o.k * 0.6 * (1 + 2 * o.t), o.k * 0.6 * (1 + 2 * o.t), 0.7 * (1 - clamp(o.t / 0.35)) * veil(X, Y), KY); } }); } }
  function shangLand(e) { if (e.id === 'callName') return;      /* 张桂芳's call is a voice, not a blow: no landing mark (with WebGL2, fx/gl/voice.js draws it) */
    const f = SHANG_LAND[e.id]; if (f) { if (!(glfx && glfx.has(e.id))) f(e);   /* the first stretch's blows painted in fx/gl/treasures.js */
      if (e.id !== 'umbrellaDark' && e.id !== 'goldWall') landWeight(e); return; }
    add({ x: e.x, y: e.y, life: 0.8, seed: frame, ground: (o) => { const m = sink(o.t), r = (e.radius || 80) / 100; for (let j = 0; j < 4; j++) spr(C('splash', j + o.seed), sx(o.x), sy(o.y), j * 1.57, r * 0.8, r * 0.8, 0.6 * m, KY, 0, clamp(o.t / 0.06)); } }); }
  // a named foe comes on the field: a cloud breaks under his feet, ink thrown out, the bone of the light standing up behind him
  // a named foe comes: for about a second an ink cloud and a wind roll in from the side he comes from, his treasure's emblem
  // stands large and pale behind him as he lands, and the splash of his landing; then it is gone. No cinnabar, veiled where it
  // passes the hero and over any warning.
  function arrive(e) { const h = G && G.hero, hx = h ? h.x : e.x - 300, hy = h ? h.y : e.y, d = Math.atan2((e.y - hy) * KY, e.x - hx), em = CELL['emblem_' + e.kind];
    add({ x: e.x, y: e.y, life: 1.15, seed: frame, d, em, id: e.id,
      ground: (o) => { const s = o.t - 0.45; if (s < 0) return; const m = sink(s); for (let j = 0; j < 8; j++) spr(C('splash', j + o.seed), sx(o.x), sy(o.y), j * 0.785, 1.4, 1.4, 0.8 * m * veil(sx(o.x), sy(o.y)), KY, 0, clamp(s / 0.08)); if (s < 0.06 && !o.kicked) { o.kicked = 1; kickA = Math.max(kickA, 4); kickT = 0; } },
      over: (o) => { const u = foeAt(o.id), x = u ? u.x : o.x, y = u ? u.y : o.y, X = sx(x), Y = sy(y), t = o.t;
        const roll = ease(clamp(t / 0.45)), fade = 1 - clamp((t - 0.7) / 0.45);           // the cloud rolls in from the edge on his side to his feet
        const Ex = F.w / 2 + Math.cos(o.d) * F.w * 0.6, Ey = F.h * horizon + Math.sin(o.d) * F.h * 0.6;
        for (let j = 0; j < 3; j++) { const q = clamp(roll - j * 0.08), Cx = Ex + (X - Ex) * q, Cy = Ey + (Y - Ey) * q - (20 + j * 26) * F.z; spr(C('cloud', j + o.seed), Cx, Cy, 0, 1.3 - 0.2 * j, 0.7, 0.42 * fade * veil(Cx, Cy)); }
        for (let j = 0; j < 3; j++) { const q = clamp(roll * 1.1 - j * 0.1), X0 = Ex + (X - Ex) * Math.max(0, q - 0.4), Y0 = Ey + (Y - Ey) * Math.max(0, q - 0.4) - (50 + j * 40) * F.z, X1 = Ex + (X - Ex) * q, Y1 = Ey + (Y - Ey) * q - (50 + j * 40) * F.z; if (q > 0.05 && q < 1) chord(C('wind', j), X0, Y0, X1, Y1, 200, 0.6, 0.55 * fade * veilSeg(X0, Y0, X1, Y1), 0, 1, false); }
        if (o.em && t > 0.35) { const g = ease(clamp((t - 0.35) / 0.25)), f2 = 1 - clamp((t - 0.8) / 0.35); spr(o.em, X, Y - 10 * F.z, 0, 2 * (0.85 + 0.15 * g), 2 * (0.85 + 0.15 * g), 0.45 * g * f2 * veil(X, Y - 260 * F.z)); } } });
  }
  const foeAt = (id) => { const fs = G && G.foes; if (fs && id != null) for (let i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i]; return null; };
  // 花狐貂 is let out of its bag: ink coils at his feet for the delay (not a blow: no cinnabar)
  function summonWarn(e) { const T = e.time || 0.8; add({ x: e.x, y: e.y, life: T + 0.2, seed: frame, ground: (o) => { const u = clamp(o.t / T); spr(C('ripple', o.seed), sx(o.x), sy(o.y), o.t * 3, 0.5 + 0.4 * u, 0.5 + 0.4 * u, 0.7 * (o.t < T ? 1 : 1 - (o.t - T) / 0.2), KY);
      const X = sx(o.x), Y = sy(o.y); spr(C('cloud', o.seed), X, Y - 10 * F.z, 0, 0.45, 0.3 * clamp(o.t / 0.3), 0.6 * (o.t < T ? 1 : 1 - (o.t - T) / 0.2)); } }); }   // all under the figures: the summoned beast stands on it, never under it
  // a named foe or a leader charging down his lane throws dust behind him
  let dustAge = 0;
  function chargeDust(dt) { dustAge += dt; if (dustAge < 0.06) return; dustAge = 0; const fs = G && G.foes; if (!fs) return;
    for (let i = 0; i < fs.length; i++) { const u = fs[i]; if (u.state !== 'charge' || u.x < F.x0 || u.x > F.x1 || u.y < F.y0 || u.y > F.y1) continue;
      add({ x: u.x, y: u.y, life: 0.5, seed: frame + i, ground: (o) => { const X = sx(o.x), Y = sy(o.y), m = 1 - o.t / 0.5; spr(C('dust', o.seed), X, Y - 6 * F.z * o.t, 0, 0.9 + o.t, 0.7 + o.t, 0.6 * m * veil(X, Y)); } }); } }
  // the umbrella takes a treasure out of the air: it is wound in to a point, a ripple closes
  function taken(e) { add({ x: e.x, y: e.y, life: 0.35, seed: frame, over: (o) => { const u = o.t / 0.35, X = sx(o.x), Y = sy(o.y) - 30 * F.z; spr(C('ripple', o.seed), X, Y, o.t * 6, 0.5 * (1 - u), 0.5 * (1 - u), 0.9 * veil(X, Y)); spr(CELL.pearl, X, Y, 0, 1.4, 1.4, (1 - u) * veil(X, Y)); } }); }
  // 花狐貂 bites: three ink claw cuts on the man
  function bite(e) { add({ x: e.x, y: e.y, life: 0.3, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y) - 26 * F.z; spr(C('claw', o.seed), X, Y, -0.6, 0.6, 0.6, (1 - o.t / 0.3) * veil(X, Y), 1, 0, clamp(o.t / 0.06)); } }); }
  // the marten is let out, or comes: a puff of cloud and dust where it lands
  function summoned(e) { add({ x: e.x, y: e.y, life: 0.6, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y); spr(C('cloud', o.seed), X, Y, 0, 0.5 + 0.3 * o.t, 0.35, 0.8 * (1 - o.t / 0.6) * veil(X, Y)); spr(C('dust', o.seed), X, Y, 0, 1, 1, 0.6 * (1 - o.t / 0.6) * veil(X, Y)); } }); }


  // ================================================================ moments: what the player must read about himself
  const ELEMENT_OF = (id) => ELEMENT[id] || GEN[id] || 'earth';
  // a level: a gold ring goes out along the ground and gold flicks rise round him
  function levelUp(e) { add({ x: e.x, y: e.y, life: 0.6, seed: frame, ground: (o) => { const k = (60 + 90 * ease(o.t / 0.6)) / 100; for (let j = 0; j < 3; j++) spr(CELL.gold_ring, sx(o.x), sy(o.y), j, k * (1 - j * 0.06), k * (1 - j * 0.06), 1 - o.t / 0.6, KY); spr(CELL.halo_metal, sx(o.x), sy(o.y), 0, k * 0.9, k * 0.9, 0.6 * (1 - o.t / 0.6), KY); },
    over: (o) => { for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU, X = sx(o.x + Math.cos(a) * 80), Y = sy(o.y + Math.sin(a) * 80) - 70 * F.z * o.t; spr(C('rise', j), X, Y, 0, 1.4, 1.4, 0.8 * Math.sin(PI * o.t / 0.6), 1, 0, clamp(o.t / 0.15)); } } }); }
  function chestOpened(e) { add({ x: e.x, y: e.y, life: 0.7, seed: frame, ground: (o) => { const k = (40 + 80 * ease(o.t / 0.7)) / 100; for (let j = 0; j < 2; j++) spr(CELL.gold_ring, sx(o.x), sy(o.y), j, k * (1 - j * 0.08), k * (1 - j * 0.08), 1 - o.t / 0.7, KY); spr(CELL.halo_metal, sx(o.x), sy(o.y), 0, k, k, 0.5 * (1 - o.t / 0.7), KY); },
    over: (o) => { const X = sx(o.x), Y = sy(o.y) - 40 * F.z, u = o.t / 0.7; for (let j = 0; j < 10; j++) { const a = -PI / 2 + (j - 4.5) * 0.3; spr(C('ray', j), X, Y, a, 0.35 + 0.35 * ease(clamp(u * 3)), 1.8, (1 - u) * veil(X, Y - 60 * F.z)); } spr(CELL.chest, X, Y + 30 * F.z - 30 * F.z * ease(clamp(u * 2)), 0, 1.2, 1.2, 1 - easeIn(u)); } }); }
  // the five elements answering one another: the element's halo rings out once
  function resonance(e) { const el = e.element || 'earth'; add({ x: e.x, y: e.y, life: 0.6, ground: (o) => { const k = 0.6 + 0.7 * ease(o.t / 0.6); spr(CELL['halo_' + el] || CELL.halo_earth, sx(o.x), sy(o.y), 0, k, k, 0.8 * (1 - o.t / 0.6), KY); } }); }
  // a treasure evolves: its element's moment, the same frame as a general's true form (mandorla, aureole, four sweeps), on the hero
  // a treasure evolves: a second and a half of ceremony on the hero. Its own image rises large over him in full colour, the
  // element's aureole opens round him, a gold ring goes out along the ground, the camera kicks; then the image sinks.
  const EVO_IMAGE = {
    fireCover: (X, Y, k, a) => { spr(CELL.cover_ghost, X, Y, 0, 2.6 * k, 2.4 * k, 0.8 * a); spr(CELL.cover_rim, X, Y + 40 * F.z * k, clock, 2.4 * k, 2.4 * k, a, KY); for (let j = 0; j < 9; j++) { const b = (j / 9) * TAU + clock; spr(C('drg_head', j), X + Math.cos(b) * 170 * F.z * k, Y + Math.sin(b) * 70 * F.z * k, b + PI / 2, 1.05 * k, 1.05 * k, 0.8 * a); } },
    fireSpear: (X, Y, k, a) => { chord(C('thrust', 0), X, Y + 120 * F.z * k, X, Y - 200 * F.z * k, 260, 2 * k, a); spr(CELL.spearhead, X, Y - 200 * F.z * k, -PI / 2, 2.4 * k, 2.4 * k, a); for (const s of [-1, 1]) chord(C('thrust', 1), X, Y, X + s * 110 * F.z * k, Y - 170 * F.z * k, 260, 1.4 * k, 0.8 * a); },
    sash: (X, Y, k, a) => { for (let j = 0; j < 12; j++) { const b0 = (j / 12) * TAU + clock * 2, b1 = b0 + TAU / 12 + 0.05; chord(C('silk', j), X + Math.cos(b0) * 150 * F.z * k, Y + Math.sin(b0) * 80 * F.z * k, X + Math.cos(b1) * 150 * F.z * k, Y + Math.sin(b1) * 80 * F.z * k, 110, 1.6 * k, a); } spr(CELL.crest_big, X, Y + 60 * F.z * k, 0, 2 * k, 2 * k, a); },
    seal: (X, Y, k, a) => { spr(CELL.seal_block, X, Y + 60 * F.z * k, 0, 2 * k, 2 * k, a); },
    whip: (X, Y, k, a) => { chord(CELL.whip_rod, X - 20 * F.z * k, Y + 140 * F.z * k, X + 20 * F.z * k, Y - 180 * F.z * k, 160, 1.8 * k, a, 0, 1, false); for (let j = 0; j < 2; j++) chord(C('chain', j), X - 140 * F.z * k, Y - 60 * F.z * k * j, X + 140 * F.z * k, Y + 40 * F.z * k * j, 200, 1.4 * k, 0.8 * a, 0, 1, false); },
    pearls: (X, Y, k, a) => { for (let j = 0; j < 24; j++) { const b = (j / 24) * TAU + clock; spr(CELL.pearl, X + Math.cos(b) * 160 * F.z * k, Y + Math.sin(b) * 90 * F.z * k, 0, 2.2 * k, 2.2 * k, a); } },
    ring: (X, Y, k, a) => { spr(C('hoop', Math.floor(clock * 12) % 4), X, Y, 0, 4.5 * k, 4.5 * k, a); spr(CELL.gold_ring, X, Y, clock, 1.6 * k, 1.6 * k, 0.8 * a); },
    banner: (X, Y, k, a) => { spr(CELL.flag, X, Y + 140 * F.z * k, 0, 4 * k, 4.4 * k, a); },
  };
  // the payoffs (an evolution, a true form) come close together late in a run: each is a moment of its own, so a second one
  // waits until the first has begun to sink (the rules act at once; only the picture is queued), never more than four waiting
  const CER = { until: 0, q: [] };
  function ceremony(fn, e, dur) { if (clock < CER.until || CER.q.length) { if (CER.q.length < 4) CER.q.push([fn, e, dur]); return; } CER.until = clock + dur; fn(e); }
  function evolved(e) { const h = G && G.hero; if (!h) return; trueForm({ el: ELEMENT_OF(e.id), x: h.x, y: h.y }); kickA = Math.max(kickA, 6); kickT = 0; const img = EVO_IMAGE[e.id];
    add({ life: 1.6, seed: frame, ground: (o) => { const h2 = G && G.hero; if (!h2) return; for (let j = 0; j < 2; j++) { const u = clamp((o.t - j * 0.15) / 0.8), k = 0.8 + 2.6 * ease(u); spr(CELL.gold_ring, sx(h2.x), sy(h2.y), j, k, k, (1 - u) * 0.9, KY); } },
      over: img ? (o) => { const h2 = G && G.hero; if (!h2) return; const rise = ease(clamp(o.t / 0.3)), fade = 1 - clamp((o.t - 1.1) / 0.5), X = sx(h2.x), Y = sy(h2.y) - (110 + 50 * rise) * F.z; img(X, Y, 0.8 + 0.2 * rise, rise * fade * veil(X, Y)); } : null }); }
  // an elite or a leader comes: in view, an ink ring and a dark ripple at his feet; out of view, ink chevrons at the edge on his side
  function arrival(e, boss) {
    const inView = e.x > F.cx - F.w / 2 / F.z && e.x < F.cx + F.w / 2 / F.z && (e.y - F.cy) * KY * F.z > -F.oy && (e.y - F.cy) * KY * F.z < F.h - F.oy;
    if (inView) { add({ x: e.x, y: e.y, life: 0.8, seed: frame, ground: (o) => { const m = sink(o.t - 0.2), k = (boss ? 1.5 : 0.9) * (0.7 + 0.3 * ease(o.t / 0.3)); spr(C('ripple', o.seed), sx(o.x), sy(o.y), 0, k, k, 0.9 * m, KY); for (let j = 0; j < (boss ? 6 : 3); j++) spr(C('splash', j + o.seed), sx(o.x), sy(o.y), j * 1.05, k * 0.8, k * 0.8, 0.6 * m, KY, 0, clamp(o.t / 0.06)); } }); return; }
    add({ x: e.x, y: e.y, life: boss ? 2.2 : 1.5, seed: frame, over: (o) => { const h = G && G.hero, hx = h ? h.x : F.cx, hy = h ? h.y : F.cy, a = Math.atan2((o.y - hy) * KY, o.x - hx), m = 46 * F.dpr, cx = F.w / 2, cy = F.h / 2, tx = Math.cos(a), ty = Math.sin(a), s = Math.min((cx - m) / Math.abs(tx || 1e-6), (cy - m) / Math.abs(ty || 1e-6)), fade = clamp(o.t / 0.12) * clamp((o.life - o.t) / 0.3);
      for (let j = 0; j < (boss ? 3 : 2); j++) spr(CELL.chev_ink, cx + tx * (s - j * 22 * F.dpr), cy + ty * (s - j * 22 * F.dpr), a, boss ? 1.4 : 1.1, boss ? 1.4 : 1.1, fade * (1 - j * 0.25)); } }); }
  // the hero hurt: one cut from the side the blow came from; fallen: the cut held, ink thrown, dust
  function wound(e, fall) { const d = e.fromX != null ? Math.atan2((e.y - e.fromY) * KY, e.x - e.fromX) : hash(frame) * TAU;
    add({ x: e.x, y: e.y, d, life: fall ? 0.7 : 0.3, seed: frame, over: (o) => { const L = (fall ? 170 : 130) * F.z, X = sx(o.x), Y = sy(o.y) - 40 * F.z, u = o.t / o.life; chord(C('cut', o.seed), X - Math.cos(o.d) * L * 0.5, Y - Math.sin(o.d) * L * 0.5, X + Math.cos(o.d) * L * 0.5, Y + Math.sin(o.d) * L * 0.5, 140, fall ? 1.8 : 1.4, 1 - easeIn(u), 0, clamp(o.t / 0.05)); },
      ground: fall ? (o) => { const m = sink(o.t); for (let j = 0; j < 5; j++) spr(C('splash', j + o.seed), sx(o.x), sy(o.y), j * 1.25, 0.9, 0.9, 0.7 * m, KY, 0, clamp(o.t / 0.06)); } : null }); }
  // the horse: hoof prints and dust at full cry, speed hair behind him at the cry and the spring
  function hoof(x, y, d, k = 1) { add({ x, y, d, life: 0.9, seed: frame, ground: (o) => { const X = sx(o.x), Y = sy(o.y), m = sink(o.t); spr(C('hoof', o.seed), X, Y, o.d, k, k, 0.8 * m * veil(X, Y), KY); spr(C('dust', o.seed), X, Y, 0, 0.5 + o.t, 0.4 + o.t, 0.5 * (1 - o.t / 0.9) * veil(X, Y)); } }); }
  function streaks(x, y, d, n, len) { add({ x, y, d, n, life: 0.25, seed: frame, over: (o) => { const h = G && G.hero, X = sx(h ? h.x : o.x), Y = sy(h ? h.y : o.y), u = o.t / 0.25; for (let j = 0; j < o.n; j++) { const z = (18 + 14 * j) * F.z, off = (hash(o.seed + j) - 0.5) * 30 * F.z; chord(C('hair', j), X - Math.cos(o.d) * 30 * F.z + off, Y - z, X - Math.cos(o.d) * (30 + len) * F.z + off, Y - z - Math.sin(o.d) * len * KY * F.z, 200, 2, 0.95 * (1 - u), clamp(u * 2), 1, false); } } }); }
  // a soldier's own blow (not his squad's skill): one small mark, and only a few a frame
  let blowsThisFrame = 0;
  function troopBlow(e) {
    if (blowsThisFrame >= (level === 2 ? 1 : level ? 3 : 6)) return; blowsThisFrame++;
    const el = TROOP[e.id] || 'earth', d = e.dir || 0;
    if (e.shape === 'line') { const L = Math.min(e.length || 70, 110); add({ x: e.x, y: e.y, life: 0.16, over: (o) => { const X0 = sx(o.x), Y0 = sy(o.y) - 26 * F.z, X1 = sx(o.x + Math.cos(d) * L), Y1 = sy(o.y + Math.sin(d) * L) - 26 * F.z, u = o.t / 0.16; chord(C('hair', o.t | 0), X0, Y0, X1, Y1, 200, 0.8, (1 - u) * veilSeg(X0, Y0, X1, Y1), 0, clamp(u * 3), false); spr(C('blade', 0), X1, Y1, Math.atan2(Y1 - Y0, X1 - X0), 0.12, 0.8, (1 - u) * veil(X1, Y1)); } }); return; }
    if (e.shape === 'arc') { const r = e.radius || 60; add({ x: e.x, y: e.y, life: 0.2, seed: frame, ground: (o) => { const k = (r / 100) * (0.8 + 0.2 * o.t / 0.2); spr(C('ripple', o.seed), sx(o.x), sy(o.y), d, k, k, 0.5 * (1 - o.t / 0.2) * veil(sx(o.x), sy(o.y)), KY); } }); return; }
    if (e.shape === 'drop') { for (const p of e.targets || [{ x: e.x, y: e.y }]) add({ x: p.x, y: p.y, life: 0.6 + (e.delay || 0), t0: e.delay || 0, seed: frame, ground: (o) => { const t = o.t - o.t0; if (t < 0) return; const m = sink(t), r = e.radius || 60; for (let j = 0; j < 5; j++) { const a = hash(o.seed * 5 + j) * TAU, q = Math.sqrt(hash(o.seed * 3 + j)) * r, X = sx(o.x + Math.cos(a) * q), Y = sy(o.y + Math.sin(a) * q); spr(C('arrow_stuck', j), X, Y, 0, 1, clamp(t / 0.05), m * veil(X, Y)); } } }); return; }
    if (e.shape === 'toss') { const p = (e.targets && e.targets[0]) || { x: e.x + Math.cos(d) * 140, y: e.y + Math.sin(d) * 140 }; add({ x: p.x, y: p.y, life: 0.5, seed: frame, ground: (o) => { const t = o.t - 0.14; if (t < 0) return; const X = sx(o.x), Y = sy(o.y); spr(C('dust', o.seed), X, Y, 0, 0.8 + t, 0.6 + t, 0.7 * (1 - t / 0.36) * veil(X, Y)); } }); }
  }
  function killMark(e) { if (level === 2 && !e.elite) return; add({ x: e.x, y: e.y, life: e.elite ? 1 : 0.6, seed: frame, ground: (o) => { const X = sx(o.x), Y = sy(o.y), m = sink(o.t); spr(C('kill', o.seed), X, Y, o.seed, 1, 1, 0.7 * m * veil(X, Y), KY); if (e.elite) spr(C('ripple', o.seed), X, Y, 0, 0.8, 0.8, 0.7 * m, KY); } }); }
  function guardFlick(e) { if (blowsThisFrame >= 4) return; blowsThisFrame++; add({ x: e.x, y: e.y, life: 0.12, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y) - 30 * F.z; spr(C('ray', o.seed), X, Y, -0.5 - (o.seed % 5) * 0.45, 0.18, 1, (1 - o.t / 0.12) * veil(X, Y)); } }); }

  // ================================================================ events
  const PAINTED_CASTS = { sash: 1, fireSpear: 1, banner: 1, whip: 1, seal: 1 };   /* the seal in brush (fx/gl/treasures.js): the old sprite blocks stood over the fight (tester round 2) */        // casts the brush sheet draws whole; the cover's fall stays strokes
  const CASTS = { fireCover: castDome, sash: castSash, seal: castSeal, fireSpear: castSpear, whip: castWhip, banner: castWard, ring: () => {}, pearls: () => {} };
  const ELEMENT = { fireCover: 'fire', fireSpear: 'fire', sash: 'water', pearls: 'water', whip: 'wood', ring: 'metal', seal: 'earth', banner: 'earth', shields: 'earth', spears: 'metal', archers: 'wood', strongmen: 'earth', chariots: 'metal', tigers: 'fire', acolytes: 'water', hooks: 'wood' };
  let hitsThisFrame = 0;
  function hitNew(e) {
    if (e.dot || hitsThisFrame >= (level === 2 ? 2 : level ? 4 : 7)) return; hitsThisFrame++;
    if (e.id === 'dengchanyu') { add({ x: e.x, y: e.y, life: 0.22, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y) - 30 * F.z, u = o.t / 0.22, v = veil(X, Y); for (let j = 0; j < 5; j++) spr(C('hit_' + ['fire', 'water', 'wood', 'metal', 'earth'][j], o.seed), X, Y, j * 1.257 + o.seed, 1.3 + u, 1.3 + u, (1 - u) * v, 1, 0, clamp(u * 4)); spr(C('ray', 0), X, Y, -1.57, 0.3 * (1 + u), 2.5, (1 - u) * v); } }); return; }      // the stone ends in a flash of the five lights
    if (e.id !== 'sash' && e.id !== 'seal' && e.id !== 'fireCover') { const el = ELEMENT_OF(e.id); add({ x: e.x, y: e.y, seed: frame + hitsThisFrame, life: 0.16, over: (o) => { const X = sx(o.x), Y = sy(o.y) - 26 * F.z, u = o.t / 0.16; spr(C('hit_' + el, o.seed), X, Y, -0.4 - (o.seed % 5) * 0.5, 0.8, 0.8, (1 - u) * veil(X, Y), 1, 0, clamp(u * 3)); } }); return; }
    if (e.id === 'sash') add({ x: e.x, y: e.y, life: 0.3, seed: frame, over: (o) => { const X = sx(o.x), Y = sy(o.y) - (24 + 60 * o.t) * F.z; spr(C('spray', o.seed), X, Y, 0, 1, 1, (1 - o.t / 0.3) * veil(X, Y)); } });
  }
  function onEvent(e, game) {
    if (game) G = game;
    if (glfx) glfx.onEvent(e, game); else if (noGL()) moments().onEvent(e, game);
    const mine = e.id && NEW[e.id];
    if (e.type === 'cast' && mine) { if (glfx && PAINTED_CASTS[e.id] && glfx.has(e.id)) return; const f = CASTS[e.id]; if (f) f(e); return; }      // a treasure the brush sheet paints whole (fx/gl/treasures.js) is drawn there
    if ((e.type === 'land' || e.type === 'hit') && mine) { if (e.type === 'hit') hitNew(e); return; }
    if ((e.type === 'bounce' || e.type === 'catch') && mine) { ringBounce(e); return; }
    if (e.type === 'pickup') { gathered(e); return; }
    if (e.type === 'squadSkill') { squadSkill(e); return; }
    if (e.type === 'generalSkill') { if (!(glfx && glfx.owns(e))) generalSkill(e); return; }      // a true-form feat is painted in fx/gl/gods.js
    if ((e.type === 'cast' || e.type === 'land') && GEN[e.id]) { if (e.type === 'cast') generalBlow(e); return; }
    if (e.type === 'summon' && GEN[e.general]) figures(e.general);
    if (e.type === 'summon' || e.type === 'generalReturn') { summonMoment(e, e.type === 'generalReturn'); return; }
    if (e.type === 'generalFall') { generalFall(e); return; }
    if (e.type === 'trueForm') { if (!(glfx && glfx.owns(e))) ceremony(trueForm, e, 1.3); return; }      // 显圣: fx/gl/gods.js stands the 法相 up
    if (e.type === 'rankUp' || e.type === 'blessed') { if (e.type === 'rankUp') rankUp(e); return; }
    if (e.type === 'land' && TROOP[e.id] && e.id === 'strongmen') { boulderBurst(e); return; }
    if (e.side === 'shang' && e.type === 'land') { shangLand(e); return; }
    if (e.type === 'warn') { if (e.hidden && G && G.zones) for (const z of G.zones) if (z.side === 'shang' && z.x === e.x && z.y === e.y) hiddenZ.add(z); if (e.shape === 'summon') summonWarn(e); return; }
    if (e.type === 'arrive') { arrive(e); return; }
    if (e.type === 'taken') { taken(e); return; }
    if (e.type === 'bite') { bite(e); return; }
    if (e.type === 'summoned') { summoned(e); return; }
    switch (e.type) {
      case 'cast': if (TROOP[e.id]) troopBlow(e); break;
      case 'hit': hitNew(e); break;
      case 'kill': killMark(e); break;
      case 'trample': hoof(e.x, e.y, e.dir || 0); break;
      case 'cry': { const h = G && G.hero; if (h) streaks(h.x, h.y, h.dir || 0, 4, 190); break; }
      case 'dash': streaks(e.x, e.y, e.dir || 0, 5, 260); for (let i = 0; i < 3; i++) hoof(e.x + Math.cos(e.dir || 0) * i * 50, e.y + Math.sin(e.dir || 0) * i * 50, e.dir || 0, 1.1); break;
      case 'block': case 'guard': guardFlick(e); break;
      case 'allyFall': add({ x: e.x, y: e.y, life: 0.5, seed: frame, ground: (o) => spr(C('dust', o.seed), sx(o.x), sy(o.y), 0, 0.7, 0.5, 0.6 * (1 - o.t / 0.5), 1) }); break;
      case 'chest': chestOpened(e); break;
      case 'levelUp': levelUp(e); break;
      case 'resonance': resonance(e); break;
      case 'evolve': if (!(glfx && glfx.owns(e)) && !(cmo && noGL() && cmo.owns(e))) ceremony(evolved, e, 1.25); break;
      case 'elite': arrival(e, false); break;
      case 'boss': arrival(e, true); break;
      case 'encircle': { const h = G && G.hero; if (h) for (let i = 0; i < 4; i++) arrival({ x: h.x + Math.cos(i * 1.5708) * 3000, y: h.y + Math.sin(i * 1.5708) * 3000 }, false); break; }
      case 'hurt': wound(e, false); break;
      case 'fall': wound(e, true); break;
      case 'fx:clear': reset(); break;
      case 'fx:count': e.live = live.length; e.level = level; break;
    }
  }
  function reset() { if (glfx) glfx.reset(); CER.q.length = 0; CER.until = 0; castSash.at = castWhip.at = -9; live.length = 0; domes.clear(); fields.clear(); lanes.clear(); }

  // ---------------------------------------------------------------- the WebGL2 effects (fx/gl), made the first time a GL context draws
  // without GL: the Canvas versions of the great moments (entrance, heavy blow, seal), made on the first frame without GL, so the painted sprites are loaded before the first moment
  let cmo = null; const noGL = () => !!ctx && (!ctx.gl || ctx.lost || glBroken);
  const moments = () => cmo || (cmo = createCanvasMoments({ kick: (a) => { kickA = Math.max(kickA, a); kickT = 0; }, sx, sy, view: () => F }));
  let glfx = null, glBroken = false; const GV = { sx: (x) => sx(x), sy: (y) => sy(y), z: 1, dpr: 1, KY, hero: [0, 0], cam: [0, 0] };
  function glReady(c) {
    if (!c.gl || c.lost || glBroken) return null;
    if (!glfx) { try { glfx = createGLFx(c, { elementOf: (id) => ELEMENT_OF(id), kick: (a) => { kickA = Math.max(kickA, a); kickT = 0; } }); if (G) glfx.onEvent({ type: 'game' }, G); if (pendingWeather) glfx.setWeather(...pendingWeather); if (unitDrawer) glfx.useFigures(unitDrawer); } catch (e) { glBroken = true; console.warn('fx: the WebGL2 effects could not start; the stroke effects stand alone', e); return null; } }
    const h = G && G.hero; GV.z = F.z; GV.dpr = F.dpr; GV.hero[0] = h ? sx(h.x) : -1e5; GV.hero[1] = h ? sy(h.y) : -1e5; GV.cam[0] = F.cx; GV.cam[1] = F.cy; return glfx;
  }
  function drawGround(c, cam, dt = 1 / 60) {
    const T0 = globalThis.__fxTime ? performance.now() : 0;
    ctx = c; frame++; clock += dt; hitsThisFrame = 0; if (c.prewarm) for (let i = 0; i < 3; i++) if (IMG[i] && !WARM[i]) { WARM[i] = 1; c.prewarm(IMG[i]); break; }      // the stroke sheets go up to the GPU as they load, one a frame, not on first use mid-fight (fx-big's 950x836 took 29 ms when a boss's emblem first showed) blowsThisFrame = 0; spearLines = 0; frameOf(c, cam);
    const foesN = G && G.foes ? G.foes.length : 0; level = foesN > 220 || live.length > 120 ? 2 : foesN > 110 || live.length > 60 ? 1 : 0;
    const zs = G && G.zones; if (zs) for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.dead) continue; if (z.src === 'fireCover' && z.kind === 'burn') watchDome(z); else if (z.src === 'seal' && z.kind === 'crush') watchField(z); else if (z.src === 'fireSpear' && z.kind === 'burn') watchLane(z); }
    if (CER.q.length && clock >= CER.until) { const [fn, ev, dur] = CER.q.shift(); CER.until = clock + dur; fn(ev); }
    laneRank = 0; step(dt); chargeDust(dt); gatherDanger(); kickT += dt; if (kickT > 0.2) kickA = 0;
    TALLY = globalThis.__fxTally || null; { const g = glReady(c); if (g) { c.save(); g.drawGround(GV, dt); c.restore(); } else if (noGL()) moments().drawGround(c, dt); }
    c.save(); drawAll('under'); TAG = 'shang'; shangGround(); DIM = 1; TAG = 'halos'; blessedHalos(); TAG = 'troopZones'; troopZones(); TAG = 'generalZones'; generalZones(); TAG = 'ward'; wardStanding(); TAG = 'pickups'; drawPickups(); TAG = 'shots'; drawShots('ground'); drawAll('ground'); c.restore();
    if (T0) TIME_G = performance.now() - T0;
  }
  function drawOver(c, cam, dt = 1 / 60) {
    const T0 = globalThis.__fxTime ? performance.now() : 0;
    ctx = c; frameOf(c, cam);
    c.save(); TAG = 'shots'; drawShots('over'); wardOver(); evolvedStanding(); drawAll('over'); TAG = 'shang'; shangOver(); c.restore();
    { const g = glReady(c); if (g) g.drawOver(GV, dt); else if (cmo) cmo.drawOver(c, dt); }
    if (T0) { const ms = TIME_G + performance.now() - T0, q = globalThis.__fxTime; if (q.length < 200000) q.push(ms, live.length, level); }
  }
  // a camera kick in CSS px for the page to add to its shake (asked of the page and art sessions): short, decaying, mostly vertical
  let kickA = 0, kickT = 1;
  function kick() { if (kickA <= 0 || kickT > 0.2) return KICK0; const d = 1 - kickT / 0.2; KICK[0] = kickA * 0.25 * d * Math.sin(kickT * 90); KICK[1] = kickA * d * Math.cos(kickT * 70); return KICK; }
  const KICK = [0, 0], KICK0 = [0, 0];
  function setTime(k) { time = clamp(k); }
  /** the scene's weather for the falling particles (WebGL2 only): kind 'rain' | 'snow' | 'dust' | null, amount 0..1, wind -1..1 */
  function setWeather(kind, amount, wind) { pendingWeather = [kind, amount, wind]; if (glfx) glfx.setWeather(kind, amount, wind); }
  let pendingWeather = null;
  /** seconds the page should hold the rules still now (a held frame on a god's blow), 0 if none; WebGL2 only */
  const hold = () => (glfx ? glfx.hold() : 0);
  /** the art module's drawer of a unit as it was drawn this frame (art/index.js drawUnitAgain); for the GL effects' redraws */
  let unitDrawer = null; const useFigures = (f) => { unitDrawer = f; if (glfx) glfx.useFigures(f); };
  return { onEvent, drawGround, drawOver, setTime, reset, kick, setWeather, hold, useFigures, get gl() { return !!glfx; }, shotKinds: SHOT_KINDS, get ready() { return !!(IMG[0] && IMG[1]); } };
}
