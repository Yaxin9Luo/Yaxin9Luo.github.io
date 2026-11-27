// 显圣: the ten Zhou generals in their true forms, in brush (the lead, 2026-11-25, from the user's play: the great image and
// the true-form skills were "非常粗糙…丑陋"; "既然都显圣成神了，尽量做好一点"). WebGL2 only (art/fx/gl/index.js makes it).
//
// The moment of 显圣 (a `trueForm` event): the 法相 (art/puppets/faxiang.js, the figures session) rises behind him and
// stands whole inside the screen, holds a second and a half with one held beat, then leaves in ink. Hair rays gather on
// him first; ink blooms at his feet. A general with no 法相 image gets a brush aureole instead; 土行孙 opens the earth.
//
// Each true-form feat (a `generalSkill` event with `trueForm`) is his own from the novel, with a build-up, a strike and an
// after-trace on the ground:
//   哪吒 三头八臂       eight weapons at once: spear thrusts on every side, the sash a full circle, the ring round it
//   杨戬 天眼照妖       his third eye opens over his brow, its light lies on the ground in a fan, the marked are rimmed in gold
//   雷震子 风雷随身     lightning strikes down the line of his dive; the storm he carries is a cloud that strikes under it
//   土行孙 地裂         under three groups the ground cracks and slabs of earth stand up round them, then sink
//   邓婵玉 五光齐放     five stones in her hand, then a fan of five mineral lights over the whole side
//   黄飞虎 武成王       the ox charges out and back raising dust; every squad takes his presence (gold under them)
//   姜子牙 金台拜将     the apricot banner rises; gold lines to every squad; seven nails of the 七箭书 on the named foe
//   郑伦 白光摄魄       white light pours out of him on every side; the souls of those it takes rise to him
//   龙吉 四海归瓶       the vase rises over her and drinks every shot on the field, then the seas pour down on them
//   黄天化 华光穿心     three nails of flaming light through the strongest, one after another
// Readability: what lasts lies on the ground under the figures; over them only the strike itself, briefly; nothing over
// the hero. The 法相 is a great moment: it may take the screen for its two seconds, behind the figures.
import { createWonders } from './wonders.js';

const TAU = Math.PI * 2;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)), clamp = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const HALO = { fire: 'whalo_fire', water: 'whalo_water', metal: 'whalo_gold', earth: 'whalo_gold', wood: 'whalo_gold' };
const EL = { nezha: 'fire', yangjian: 'metal', leizhenzi: 'wood', tuxingsun: 'earth', dengchanyu: 'water', huangfeihu: 'earth', jiangziya: 'water', zhenglun: 'metal', longji: 'water', huangtianhua: 'fire' };

export function createGods(ctx, W = createWonders(), { ink = null, kick = () => {}, hold = () => {}, gw = null } = {}) {
  // the gods' sheet (gen/gods.cells.mjs) beside the wonders: a cell whose name starts with 'g' comes from it
  const W0 = W, GW = gw || createWonders('gods'); if (!gw) GW.loaded.then(() => ctx.prewarm && ctx.prewarm(GW.image));      // the gods' brush sheet, shared with the treasures (index.js)
  const sheet = (n) => (n.charCodeAt(0) === 103 ? GW : W0);
  // 泰山 (gen/tai.gen.mjs): a picture of its own, painted with the field's ink-wash engine; its foot sits at TAI_FOOT of its height
  let TAI = null; const TAI_FOOT = 868 / 896;
  // 杨戬's changes (gen/beasts.prep.mjs): six freehand ink-wash animals, generated and cut out; how long each stands in world units
  // 天眼: the third eye (generated ink and dull gold, fx/gen/spoils.prep.mjs: fnEye), opening upright over his brow
  let EYE = null;
  // the eye's height and where it opens (world units above his feet: about his true-form height), and the sweep of its gaze
  // the eye sits just above his aureole (the true form's figure stands ~165 units tall to the aureole's top), as his, not floating
  const EYE_H = 190, EYE_LIFT = 242, SWEEP0 = 0.35, SWEEP = 0.35;
  // the wonders (gen/pics.prep.mjs): 哪吒's weapons, 姜子牙's list, banner and whip, 龙吉's wave and vase, painted ink-wash pictures
  let PICS = null;
  fetch(new URL('../baked/pics/pics.json', import.meta.url).href).then((r) => r.json()).then(async (meta) => { const img = {}; for (const n of Object.keys(meta)) { img[n] = await createImageBitmap(await (await fetch(new URL(`../baked/pics/${n}.webp`, import.meta.url).href)).blob()); if (ctx.prewarm) ctx.prewarm(img[n]); warm.push(img[n]); } PICS = { meta, img }; }).catch((e) => console.warn('gods: the wonders did not load', e));
  // draw a picture with its ink centre at (X, Y) device px, turned by rot, `len` device px across its width (ky: its height
  // over that scale), mirrored when flip < 0; only from u0 to u1 of its width (a list unrolling, a spear drawn on). False if not loaded.
  function pic(n, X, Y, rot, len, a, flip = 1, u0 = 0, u1 = 1, ky = 1) { const bm = PICS && PICS.img[n]; if (!bm || a <= 0.004 || u1 <= u0) return !!bm; const M = PICS.meta[n], k = len / M.w, cs = Math.cos(rot), sn = Math.sin(rot);
    ctx.setTransform(cs * k * flip, sn * k * flip, -sn * k * ky, cs * k * ky, X, Y); ctx.globalAlpha = Math.min(1, a); const sx = M.w * u0, sw = M.w * (u1 - u0); ctx.drawImage(bm, sx, 0, sw, M.h, sx - M.cx, -M.cy, sw, M.h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return true; }
  fetch(new URL('../baked/spoils/fnEye.webp', import.meta.url).href).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bm) => { EYE = bm; if (ctx.prewarm) ctx.prewarm(bm); warm.push(bm); }).catch(() => {});
  // 地裂 (gen/chasm.gen.mjs): the earth opened, painted with the same engine; centred, 520 units across at 1.4 px a unit
  let CHASM = null; fetch(new URL('../baked/gchasm.webp', import.meta.url).href).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bm) => { CHASM = bm; if (ctx.prewarm) ctx.prewarm(bm); warm.push(bm); }).catch((e) => console.warn('gods: 地裂 did not load', e));
  fetch(new URL('../baked/gtai.webp', import.meta.url).href).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bm) => { TAI = bm; if (ctx.prewarm) ctx.prewarm(bm); warm.push(bm); }).catch((e) => console.warn('gods: 泰山 did not load', e));
  W = { draw: (c, n, ...r) => sheet(n).draw(c, n, ...r), cell: (n) => sheet(n).cell(n), get ready() { return W0.ready && GW.ready; } };
  let clock = 0, G = null, FX = null, FXload = null;
  const breaks = [];
  const stages = [], feats = [], baked = new Map();
  const unitOf = (g) => { const as = G && G.allies; if (as) for (let i = 0; i < as.length; i++) if (as[i].kind === 'general' && as[i].general === g) return as[i]; return null; };
  const foeOf = (id) => { const fs = G && G.foes; if (fs && id != null) for (let i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i]; return null; };
  function veil(V, X, Y) { const H = V.hero; if (!H || H[0] < -1e4) return 1; const dx = (X - H[0]) / (70 * V.z), dy = (Y - (H[1] - 60 * V.z)) / (95 * V.z), d = Math.sqrt(dx * dx + dy * dy); return d >= 2 ? 1 : d <= 1 ? 0.06 : 0.06 + 0.94 * (d - 1); }
  // a large picture over the figures (a mountain, a wave, the list, a cage): it thins to the clear floor wherever its box
  // (left, top, right, bottom in device px) takes in the hero and a figure's width round him
  function boxVeil(V, x0, y0, x1, y1) { const H = V.hero; if (!H || H[0] < -1e4) return 1; const m = 70 * V.z, hx = H[0], hy = H[1] - 60 * V.z;
    const dx = Math.max(x0 - m - hx, 0, hx - x1 - m), dy = Math.max(y0 - m - hy, 0, hy - y1 - m), d = Math.hypot(dx, dy) / (70 * V.z); return d >= 1 ? 1 : 0.06 + 0.94 * d; }
  // the same along a straight stroke from (X0, Y0) to (X1, Y1)
  function lineVeil(V, X0, Y0, X1, Y1) { let a = 1; for (let i = 0; i <= 8; i++) a = Math.min(a, veil(V, X0 + (X1 - X0) * i / 8, Y0 + (Y1 - Y0) * i / 8)); return a; }
  // lay a cell drawn along +x along a path P(s) in device px (as treasures.js)
  function ribbon(c, name, P, k, a, from = 0, to = 1, N = 10, V = null) {
    const C = W.cell(name); if (!C || a <= 0) return;
    for (let i = 0; i < N; i++) { const u0 = i / N, u1 = Math.min(1, (i + 1) / N + 0.015); if (u1 < from || u0 > to) continue;
      const P0 = P(u0), P1 = P(u1), dx = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dx, dy) || 1, rot = Math.atan2(dy, dx), kx = len / ((u1 - u0) * C[7]), ky = (Math.cos(rot) < 0 ? -1 : 1) * k;
      const lx = (-C[5] + C[7] * u0) * kx; W.draw(c, name, P0[0] - Math.cos(rot) * lx, P0[1] - Math.sin(rot) * lx, rot, kx, ky, a * (V ? veil(V, P0[0], P0[1]) : 1), u0, u1); } }
  // a cell along a straight line from (X0, Y0) to (X1, Y1), drawn on from u0 to u1 of its length
  const along = (c, name, X0, Y0, X1, Y1, k, a, u0 = 0, u1 = 1, V = null) => ribbon(c, name, (s) => [X0 + (X1 - X0) * s, Y0 + (Y1 - Y0) * s], k, a, u0, u1, 8, V);

  // ---------------------------------------------------------------- the 法相 images (the figures session's)
  function faxiang(g) { if (!FX && !FXload) FXload = import('../../puppets/faxiang.js').then((m) => { FX = m; }).catch((e) => console.warn('gods: 法相 figures did not load', e)); return FX && FX.FAXIANG && FX.FAXIANG[g] ? FX.FAXIANG[g] : null; }
  // the height a 法相 stands at: three quarters of the screen, less if its width would not fit in 96% of it
  function tallOf(g) { const F = faxiang(g), cw = ctx.canvas.width, ch = ctx.canvas.height; return F ? Math.min(ch * 0.74, (cw * 0.96 * F.h) / F.w) : ch * 0.74; }
  function bake(g, hPx) { const F = faxiang(g); if (!F) return null; const k = Math.max(0.1, Math.round((hPx / F.h) * 10) / 10), key = g + '|' + k; let b = baked.get(key);
    if (!b) { b = { cv: FX.bakeFaxiang(g, k), k, px: F.pivot[0] * k, py: F.pivot[1] * k, h: F.h * k, head: F.head ? [F.head[0] * k, F.head[1] * k] : null }; baked.set(key, b); if (ctx.prewarm) ctx.prewarm(b.cv); } return b; }

  // ---------------------------------------------------------------- events
  // first use costs a frame (the sheet and the 法相 reach the GPU only when first sampled): a summoned general's 法相 is
  // baked while the field is quiet, and each new image is drawn once, invisibly, into a corner
  const warm = [];
  // each warmed image drawn whole, shrunk to 2 px, nearly clear: its first real draw then costs no upload and no mip level (the
  // first 天眼 cast cost a 100 to 300 ms frame when only a 4 px corner had been drawn)
  function warmUp() { for (const im of warm.splice(0)) { ctx.globalAlpha = 0.004; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(im, 0, 0, im.width, im.height, 0, 0, 2, 2); ctx.globalAlpha = 1; } }
  GW.loaded.then(() => warm.push(GW.image));
  function prebake(g) { const idle = globalThis.requestIdleCallback || ((f) => setTimeout(f, 200)); const go = () => { if (!faxiang(g)) { if (FXload) FXload.then(() => idle(go)); return; } const b = bake(g, tallOf(g)); if (b) warm.push(b.cv); }; idle(go); }
  function onEvent(e, game) {
    if (game) G = game;
    if (e.type === 'summon' && e.general) prebake(e.general);
    if (e.type === 'trueForm' && e.general) { faxiang(e.general); stages.push({ g: e.general, at: clock, x: e.x, y: e.y, beat: false }); if (ink) ink.bloom({ x: e.x, y: e.y + 10, w: 420, splats: BLOOM, pigment: EL[e.general] === 'fire' ? 'fire' : 'ink', life: 3.2, hero: true }); return true; }
    if (e.type === 'wardBroken') { breaks.push({ id: e.id, x: e.x, y: e.y, at: clock }); if (breaks.length > 8) breaks.shift(); return false; }
    if (e.type === 'generalSkill' && e.trueForm) { const f = { ...e, at: clock, v: feats.length % 2 }; feats.push(f); if (feats.length > 24) feats.shift();
      kick(e.general === 'tuxingsun' || e.general === 'huangfeihu' ? 7 : 4); return true; }
    return false;
  }
  const owns = (e) => (e.type === 'trueForm' && !!e.general) || (e.type === 'generalSkill' && !!e.trueForm);

  // ---------------------------------------------------------------- 显圣: rise, hold, leave
  const T_GATHER = 0.3, T_RISE = 0.75, T_BEAT = 0.9, T_HOLD = 2.25, T_END = 2.85;
  function stageGround(c, V) {
    for (let i = 0; i < stages.length; i++) { const o = stages[i], t = clock - o.at; if (t > T_END) { stages.splice(i--, 1); continue; }
      const u = unitOf(o.g), gx = u ? u.x : o.x, gy = u ? u.y : o.y, z = V.z, cw = ctx.canvas.width, ch = ctx.canvas.height;
      const rise = ease(clamp((t - T_GATHER + 0.05) / (T_RISE - T_GATHER))), leave = clamp((t - T_HOLD) / (T_END - T_HOLD)), a = rise * (1 - leave);
      if (!o.beat && t >= T_BEAT) { o.beat = true; kick(9); hold(0.07); }
      // where it stands: centred near him across, its feet low on the screen, so the whole figure is inside the frame
      // as tall as three quarters of the screen, unless it is so wide (郑伦's beast, the riders) that it would not fit across;
      // centred near him, held inside the screen by its own width
      const feet = ch * 0.93, tall = tallOf(o.g), b = bake(o.g, tall), half = b ? b.cv.width / 2 : cw * 0.24, Xs = Math.max(half + cw * 0.02, Math.min(cw - half - cw * 0.02, V.sx(gx)));
      // the ground under it: a wash of gold that opens with it (its stage)
      W.draw(c, HALO[EL[o.g]] || 'whalo_gold', Xs, feet - tall * 0.02, 0, (tall / 380) * 1.3 * (0.6 + 0.4 * rise), (tall / 380) * 1.3 * (0.6 + 0.4 * rise) * V.KY, 0.55 * a);
      // 土行孙: the earth opens round him as his figure rises out of it
      if (o.g === 'tuxingsun') earthStage(c, V, o, t, gx, gy, a);
      if (b) { const lift = (1 - rise) * ch * 0.18 - leave * ch * 0.05, sy = 1 + 0.03 * leave;
        // the held beat: for an instant it stands brighter (drawn twice), and a ring of matte gold opens behind its head
        const beat = Math.max(0, 1 - Math.abs(t - T_BEAT - 0.06) / 0.12), hx = b.head ? b.head[0] - b.px : 0, hy = b.head ? b.head[1] - b.py : -b.h * 0.84;
        if (beat > 0 || (t > T_BEAT && t < T_HOLD)) { const ring = ease(clamp((t - T_BEAT) / 0.4)); W.draw(c, 'whalo_gold', Xs + hx, feet + hy - lift, t * 0.1, (b.h / 900) * (0.7 + 0.6 * ring), (b.h / 900) * (0.7 + 0.6 * ring), 0.75 * a * (0.6 + 0.4 * beat)); }
        ctx.setTransform(1, 0, 0, sy, Xs, feet - lift); ctx.globalAlpha = Math.min(1, 0.95 * a); ctx.drawImage(b.cv, -b.px, -b.py);
        if (beat > 0) { ctx.globalAlpha = 0.35 * beat * a; ctx.drawImage(b.cv, -b.px, -b.py); }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
        // it leaves in ink: dry strokes blow up off it as it thins
        if (leave > 0) for (let k = 0; k < 9; k++) { const x0 = Xs + (k / 8 - 0.5) * b.h * 0.42, y0 = feet - b.h * (0.15 + 0.08 * (k % 4)), up = ease(leave);
          ribbon(c, `wtoll_${k % 2}`, (s) => [x0 + Math.sin(s * 3 + k) * 26 * z, y0 - (s * 0.55 + up * 0.5) * b.h], 2.4 * z, (1 - leave) * 0.9, Math.max(0, up - 0.2), Math.min(1, up * 1.6 + 0.2), 10, null); }
      } else {      // no image: a brush aureole of his element behind him, rays out of it
        const X = V.sx(gx), Y = V.sy(gy) - 70 * z, k = (0.9 + 0.8 * rise) * z;
        W.draw(c, HALO[EL[o.g]] || 'whalo_gold', X, Y, t * 0.2, k * 1.2, k * 1.2, 0.85 * a);
        for (let j = 0; j < 14; j++) { const ang = (j / 14) * TAU + t * 0.2; W.draw(c, `wray_${j % 2}`, X + Math.cos(ang) * 120 * k, Y + Math.sin(ang) * 120 * k, ang - Math.PI / 2, 0.35 * z, 0.5 * k, 0.6 * a); } } } }
  function stageOver(c, V) {
    for (const o of stages) { const t = clock - o.at; if (t > T_GATHER + 0.1) continue; const u = unitOf(o.g), X = V.sx(u ? u.x : o.x), Y = V.sy(u ? u.y : o.y) - 60 * V.z, q = t / (T_GATHER + 0.1);
      for (let j = 0; j < 12; j++) { const ang = (j / 12) * TAU + 0.3, d = 300 * (1 - ease(q)) * V.z; W.draw(c, `wray_${j % 2}`, X + Math.cos(ang) * d, Y + Math.sin(ang) * d * 0.8, ang + Math.PI / 2, 0.3 * V.z, 0.35 * V.z, Math.sin(Math.PI * q) * veil(V, X, Y)); } } }
  // 土行孙: no image, the earth itself opens round him and stands up
  function earthStage(c, V, o, t, gx, gy, a) { const z = V.z, R = 260, open = ease(clamp(t / 0.4)), close = clamp((t - T_HOLD) / (T_END - T_HOLD));
    if (CHASM) { const w = 520 * (R / 158) * z * (0.5 + 0.5 * open) * (1 - 0.4 * close), h = w * CHASM.height / CHASM.width, X = V.sx(gx), Y = V.sy(gy) + 10 * z; ctx.setTransform(1, 0, 0, 1, X - w / 2, Y - h / 2); ctx.globalAlpha = a * (1 - close) * Math.min(1, open * 2); ctx.drawImage(CHASM, 0, 0, CHASM.width, CHASM.height, 0, 0, w, h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }      // the earth opens round him (gen/chasm.gen.mjs)

    for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU, s = clamp((t - (j % 3) * 0.06) / 1.2), X = V.sx(gx + Math.cos(b) * R * 0.75), Y = V.sy(gy + Math.sin(b) * R * 0.75) - 40 * s * z;
      if (s > 0 && s < 1) W.draw(c, `wdust_${j % 2}`, X, Y, j, (0.8 + 1.4 * s) * z, (0.7 + 1 * s) * z, a * (1 - s) * (1 - close)); } }

  // ---------------------------------------------------------------- the feats
  // Each in three beats: GATHER (his own pose and a brief build of strokes at him, about 0.2 s), STRIKE (the god's blow
  // laid on the foes at full size, a held frame and a shock when it lands), TRACE (pools, rifts, rings left on the ground
  // under the figures, fading over a second and more). What stands over the figures is the strike alone, and only briefly.
  const STRIKE = { arc: 0.34, eye: 0.35, line: 0.24, bindOne: 0.2, cone: 0.22, charge: 0.3, command: 0.74, snort: 0.2, vase: 0.5, nail: 0.18 };
  const LIFE = { arc: 2.4, eye: 1.4, line: 2.2, bindOne: 2.6, cone: 1.8, charge: 2.4, command: 2.4, snort: 1.8, vase: 2.4, nail: 2.2 };
  const NEZHA8 = ['gspear_0', 'gsword_0', 'wring', 'gbrick', 'gspear_1', 'gsword_1', 'gsilk', 'gcage'];
  const NEZHA_PIC = ['spear', 'sword', 'ring', 'brick', 'spear', 'sword', 'sash', 'cage'];
  function picks(x, y, R, n, cone = null) { const fs = (G && G.foes) || [], out = [];
    for (const f of fs) { if (f.state === 'dead') continue; const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d > R) continue;
      if (cone) { let da = Math.atan2(dy, dx) - cone[0]; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > cone[1]) continue; } out.push({ x: f.x, y: f.y, id: f.id, d }); }
    out.sort((a, b) => a.d - b.d); const step = Math.max(1, Math.floor(out.length / n)), r = []; for (let i = 0; i < out.length && r.length < n; i += step) r.push(out[i]); return r; }
  function prepare(o) { const u = unitOf(o.general), gx = u ? u.x : o.x, gy = u ? u.y : o.y;
    if (o.shape === 'arc') { const fs = (G && G.foes) || [], h = G && G.hero; o.picks = [];      // a wheel round him: in each of eight directions the nearest foe within 300, else the ground 240 out that way
      for (let k = 0; k < 8; k++) { const b = ((k + 0.5) / 8) * TAU; let best = null, bd = 1e9; for (const f of fs) { if (f.state === 'dead') continue; const dx = f.x - gx, dy = f.y - gy, d = Math.hypot(dx, dy); if (d > 300 || d < 60) continue; if (h && Math.hypot(f.x - h.x, f.y - h.y) < 110) continue; let da = Math.atan2(dy, dx) - b; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > TAU / 16) continue; if (d < bd) { bd = d; best = f; } }
        o.picks.push(best ? { x: best.x, y: best.y, id: best.id } : { x: gx + Math.cos(b) * 240, y: gy + Math.sin(b) * 240 }); } }
    if (o.shape === 'cone') o.picks = picks(gx, gy, o.radius || 440, 5, [o.dir || 0, ((o.angle || 130) * Math.PI) / 360]);
    if (o.shape === 'vase') { const pr = (o.targets || []).find((p) => p.pour && (!G || !G.hero || Math.hypot(p.x - G.hero.x, p.y - G.hero.y) >= 380)), fs = (G && G.foes) || [], h = G && G.hero; let best = pr || null, bn = -1;
      if (!best) for (const f of fs) { if (f.state === 'dead' || Math.hypot(f.x - gx, f.y - gy) > 760 || (h && (Math.hypot(f.x - h.x, f.y - h.y) < 380 || Math.hypot(f.x - h.x, f.y - h.y) > 600))) continue; let n = 0; for (const g2 of fs) if (g2.state !== 'dead' && Math.abs(g2.x - f.x) < 110 && Math.abs(g2.y - f.y) < 90) n++; if (n > bn) { bn = n; best = f; } }
      o.wave = best ? { x: best.x, y: best.y } : null; }      // the great wave: the first group it pours on, else the thickest group in reach, away from the hero
    if (o.shape === 'command') { const n = o.nail; o.at2 = n ? { x: n.x, y: n.y, id: n.id } : (picks(gx, gy, 600, 1)[0] || { x: gx + 300, y: gy }); } }
  const at = (p) => { const f = foeOf(p.id); return f && f.state !== 'dead' ? f : p; };
  // the held blow: once, as the strike lands
  function land(o, t, power) { if (o.hit || t < STRIKE[o.shape]) return; o.hit = true; kick(power); hold(0.06); }
  // the shock under a landing, and the trace left there
  function shockAt(c, V, x, y, t0, t, k) { const s = t - t0; if (s < 0) return; const z = V.z, X = V.sx(x), Y = V.sy(y);
    if (s < 0.45) { const q = ease(s / 0.45); D(c, `gshock_${(x | 0) & 1}`, X, Y, 0, (0.35 + 0.75 * q) * k * z, (0.35 + 0.75 * q) * k * z * V.KY / 0.55, (1 - q) * 0.95); }
    D(c, `gsplash_${(y | 0) & 1}`, X, Y, 0, 0.45 * k * z * Math.min(1, s / 0.06), 0.55 * k * z * V.KY / 0.55 * Math.min(1, s / 0.06), Math.max(0, 1 - Math.max(0, s - 0.25) / 0.35));
    if (s > 0.15) D(c, `gpool_${(x | 0) & 1}`, X, Y, 0, 0.42 * k * z, 0.42 * k * z * V.KY / 0.55, 0.5 * clamp((s - 0.15) / 0.2) * (1 - clamp((s - 0.9) / 1.2))); }
  // the god stays in view: over the figures, what is laid within a figure's width of the general thins as it does round the hero
  let GCL = null;
  const gclear = (X, Y) => { if (!GCL) return 1; const dx = (X - GCL[0]) / (75 * GCL[2]), dy = (Y - GCL[1]) / (100 * GCL[2]), d = Math.sqrt(dx * dx + dy * dy); return d >= 1.6 ? 1 : d <= 0.8 ? 0.15 : 0.15 + 0.85 * (d - 0.8) / 0.8; };
  const D = (c, name, X, Y, rot, kx, ky, a, u0, u1) => W.draw(c, name, X, Y, rot, kx, ky, a * gclear(X, Y), u0, u1);
  function featsDraw(c, V, layer) { const z = V.z;
    for (let i = 0; i < feats.length; i++) { const o = feats[i], t = clock - o.at, life = LIFE[o.shape] || 2; if (t > life) { if (layer === 'over') feats.splice(i--, 1); continue; }
      if (!o.prepared) { o.prepared = true; prepare(o); }
      const u = unitOf(o.general), gx = u ? u.x : o.x, gy = u ? u.y : o.y, T0 = STRIKE[o.shape] || 0.2, P = (x, y, lift = 0) => [V.sx(x), V.sy(y) - lift * z], ground = layer === 'ground';
      const gather = clamp(t / T0), [GX, GY] = P(gx, gy, 60);
      GCL = ground ? null : [GX, GY - 10 * z, z];
      switch (o.shape) {
        case 'arc': {          // 哪吒 三头八臂: one composed turn. The eight weapons come into his hands round him; the wheel they make opens
          // out over the foes and turns once, the sash a red ring through them, fire dragged behind each; it lands, and closes back.
          const WR = 230, open = ease(clamp((t - T0) / 0.14)), close = clamp((t - T0 - 0.7) / 0.25), spin = 1.2 * ease(clamp((t - T0) / 0.5)), r = (60 + (WR - 60) * open) * (1 - 0.8 * close);
          const wAt = (k, extra = 0) => { const b = ((k + 0.5) / 8) * TAU + spin + extra; return [gx + Math.cos(b) * r, gy + Math.sin(b) * r, b]; };
          if (ground) { land(o, t, 12);
            // the sash: a red ring through the eight weapons, drawn under the figures, laid as the wheel opens
            if (t > T0 - 0.05 && close < 1) ribbon(c, 'gsilk_0', (q) => P(gx + Math.cos(q * TAU + spin) * r, gy + Math.sin(q * TAU + spin) * r, 30), 0.55 * z, (1 - close) * Math.min(1, (t - T0 + 0.05) / 0.1), 0, 1, 24, null);
            for (let k = 0; k < 8; k++) { const [x, y] = wAt(k); if (t > T0 + 0.5 && !o['s' + k]) o['s' + k] = [x, y]; if (o['s' + k]) shockAt(c, V, o['s' + k][0], o['s' + k][1], T0 + 0.5, t, 0.65); }
            break; }
          // a blade points out from the wheel's centre as seen on screen, and is never longer than reaches back to it (the wheel is flattened by the view)
          const [CX, CY] = P(gx, gy, 50), blade = (n, X, Y, L, A) => { const dx = X - CX, dy = Y - CY, d = Math.hypot(dx, dy) || 1; return pic(n, X, Y, Math.atan2(dy, dx), Math.min(L, 1.05 * d), A); };
          for (let k = 0; k < 8; k++) { const n = NEZHA8[k], t0 = (k / 8) * T0 * 0.85; if (t < t0) continue;
            const shown = clamp((t - t0) / 0.06), [x, y, b] = wAt(k), [X, Y] = P(x, y, 50), big = t < T0 ? 0.32 : 0.32 + 0.3 * open * (1 - close), a = shown * (1 - close), rot = b + Math.PI / 2;
            // fire dragged behind each weapon as the wheel turns
            if (t > T0 && close < 1) ribbon(c, 'wfanfire_0', (q) => { const [x2, y2] = wAt(k, -0.5 * (1 - q)); return P(x2, y2, 50); }, 0.3 * z, 0.5 * (1 - close) * open, 0, 1, 6, V);
            const PK = NEZHA_PIC[k], A8 = a * veil(V, X, Y), L8 = (big / 0.62) * z * Math.min(1, r / 170);
            // the painted weapons (generated ink references), each by its own law: blades point out along the wheel, the ring faces us, the sash lies along the turn, the fire cover stands
            if (PK === 'ring' ? pic('ring', X, Y, t * 3, 120 * L8, A8) : PK === 'cage' ? pic('cage', X, Y - 20 * L8, 0, 120 * L8, A8) : PK === 'brick' ? pic('brick', X, Y, rot * 0.1, 105 * L8, A8) : PK === 'sash' ? pic('sash', X, Y, rot, 240 * L8, A8) : blade(PK, X, Y, (PK === 'spear' ? 235 : 195) * L8, A8)) continue;
            if (n === 'wring') W.draw(c, 'wringt_0', X, Y, t * 8, big * 1.4 * z, big * 1.4 * z, a * veil(V, X, Y));
            else if (n === 'gcage') W.draw(c, 'gcage', X, Y + 30 * z, 0, big * 0.6 * z, big * 0.6 * z, a * veil(V, X, Y));
            else if (n === 'gbrick') W.draw(c, 'gbrick', X, Y + 20 * z, rot * 0.1, big * 0.9 * z, big * 0.9 * z, a * veil(V, X, Y));
            else if (n === 'gsilk') W.draw(c, 'gsilk_0', X, Y, rot, big * 0.6 * z, big * 0.8 * z, a * veil(V, X, Y), 0.4, 1);
            else W.draw(c, n, X - Math.cos(b) * 60 * big * z, Y - Math.sin(b) * 40 * big * z, b, big * 0.7 * z, big * 0.9 * z, a * veil(V, X, Y), n.startsWith('gsword') ? 0.3 : 0.45, 1); }
          break; }
        case 'eye': {         // 杨戬 天眼照妖 (the lead, round 2: the weight of a true form): the third eye, as tall as he is, tears open
          // above him (an ink slit splits, the lids part, the gold iris flares, a ring of ink and gold shocks out), holds open, and shuts
          // by 1.2 s. From 0.35 to 0.7 s its gaze, a blade of gold-white light, sweeps the fan from the eye down across the ground,
          // throwing ink shadows behind the foes it crosses (that sweep is the hit: the marked are rimmed in gold as it passes them,
          // index.js eyeRims with eyeReveal below); then only thin gold rays lie on the ground, and fade.
          // the fan's origin is where he stood as it opened (rules-build), even if he moves before it lands
          const ox = o.x != null ? o.x : gx, oy = o.y != null ? o.y : gy;
          const half = ((o.angle || 70) * Math.PI) / 360, R = o.radius || 420, d = o.dir || 0, sw = clamp((t - SWEEP0) / SWEEP), b0 = d - half + 2 * half * ease(sw);
          // the eye over him, held inside the view (below the HUD's top band) when he stands near an edge
          const cwE = ctx.canvas.width, chE = ctx.canvas.height, hE = EYE_H * z, EX = Math.max(hE * 0.4, Math.min(cwE - hE * 0.4, V.sx(ox))), EY = Math.max(chE * 0.11 + hE * 0.5, Math.min(chE - hE * 0.5, V.sy(oy) - EYE_LIFT * z));
          if (ground) { const X0 = V.sx(ox), Y0 = V.sy(oy), fan = clamp((t - SWEEP0) / 0.15) * (1 - clamp((t - 0.9) / 0.5));
            if (fan > 0) { for (let k = 0; k < 9; k++) { const b = d + (k / 8 - 0.5) * 2 * half * 0.92; if (b > b0 + 0.05) continue; const L2 = R * (0.8 + 0.2 * Math.sin(k * 2.3)), XE = V.sx(ox + Math.cos(b) * L2), YE = V.sy(oy + Math.sin(b) * L2);
                // (wray is an upright cell, its foot at the pivot and its light running down +y: turned to point along the ray)
                const Cr = W.cell(`wray_${k % 2}`), Lr = Math.hypot(XE - X0, YE - Y0); if (Cr) W.draw(c, `wray_${k % 2}`, X0, Y0, Math.atan2(YE - Y0, XE - X0) - Math.PI / 2, 1.8 * z, Lr / Cr[8], 0.34 * fan * veil(V, (X0 + XE) / 2, (Y0 + YE) / 2)); }
              for (const s2 of [-1, 1]) { const b = d + s2 * half, XE = V.sx(ox + Math.cos(b) * R), YE = V.sy(oy + Math.sin(b) * R); along(c, `gthread_${s2 > 0 ? 1 : 0}`, X0, Y0, XE, YE, 0.8 * z, 0.85 * fan, 0, 1, V); } }
            // the ink shadows: behind each foe the blade is crossing, a short dark stroke thrown away from the eye
            if (sw > 0 && sw < 1) { let n = 0; for (const f of (G && G.foes) || []) { if (f.state === 'dead') continue; const dx = f.x - ox, dy = f.y - oy, dd = Math.hypot(dx, dy); if (dd > R || dd < 40) continue; let da = Math.atan2(dy, dx) - b0; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.14) continue; if (++n > 24) break;
                const ux = dx / dd, uy = dy / dd, XF = V.sx(f.x), YF = V.sy(f.y), XS = V.sx(f.x + ux * 90), YS = V.sy(f.y + uy * 90); along(c, `wsweep_${n & 1}`, XF, YF, XS, YS, 0.22 * z, 0.45 * (1 - Math.abs(da) / 0.14), 0, 1, V); } }
            land(o, t, 5); break; }
          if (!EYE) break;
          // the eye opening: the slit tears (0 to 0.12 s), the lids part (to 0.38 s), held open, shut by 1.2 s; kept off the hero
          const tear = clamp(t / 0.12), open = ease(clamp((t - 0.1) / 0.28)) * (1 - ease(clamp((t - 0.85) / 0.35))), hgt = EYE_H * z, k2 = hgt / EYE.height, Hh = V.hero;
          const off = Hh && Math.abs(Hh[0] - EX) < hgt * 0.45 && Math.abs(Hh[1] - 60 * z - EY) < hgt * 0.6 ? 0.35 : 1;
          if (t < 0.4) { const q = t / 0.4; D(c, 'wcut_0', EX, EY, Math.PI / 2, hgt / 120 * tear, 0.6 * z, (1 - q) * off); }
          if (open > 0.02) { ctx.setTransform(k2, 0, 0, k2 * (0.06 + 0.94 * open), EX, EY); ctx.globalAlpha = Math.min(1, t / 0.1) * off; ctx.drawImage(EYE, -EYE.width / 2, -EYE.height / 2); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
          // the flare and the shock ring going out from it, ink and gold (upright: a ring in the air, not on the ground)
          if (t > 0.12 && t < 0.75) { const q = (t - 0.12) / 0.63, kr = (0.6 + 2.2 * ease(q)) * z; W.draw(c, 'whalo_gold', EX, EY, q, kr, kr, (1 - q) * 0.9 * off); D(c, 'gshock_0', EX, EY, 0, kr * 0.9, kr * 0.9, (1 - q) * 0.8 * off); }
          // the gaze: a blade of gold-white light from the eye to the ground, sweeping the fan
          if (sw > 0 && sw < 1) { const XG = V.sx(ox + Math.cos(b0) * R), YG = V.sy(oy + Math.sin(b0) * R), Cb = W.cell('gbeam_0'), Lb = Math.hypot(XG - EX, YG - EY), rb = Math.atan2(YG - EY, XG - EX), a3 = Math.sin(sw * Math.PI) * 0.4 + 0.6;
            if (Cb) { W.draw(c, 'gbeam_0', EX, EY, rb, Lb / Cb[7], 0.55 * z, a3 * veil(V, (EX + XG) / 2, (EY + YG) / 2)); W.draw(c, 'gbeam_1', EX, EY, rb - 0.025, Lb / Cb[7], 0.3 * z, 0.45 * a3); }
            W.draw(c, 'whalo_gold', XG, YG, 0, 0.7 * z, 0.7 * z * V.KY, 0.9 * a3); }
          break; }
        case 'line': {         // 雷震子: the wings beat (two great winds), lightning down the line, the staff splits the ground
          const L = o.length || 380, d = o.dir || 0, pt = (f) => [o.x + Math.cos(d) * L * f, o.y + Math.sin(d) * L * f], end = o.smash || { x: pt(1)[0], y: pt(1)[1] };
          if (ground) { land(o, t, 12); for (let k = 0; k < 3; k++) { const p = pt(0.3 + k * 0.35); shockAt(c, V, p[0], p[1], T0 + k * 0.07 + 0.04, t, 0.9); }
            if (t > T0 + 0.2) for (let k = 0; k < 3; k++) { const b = (k / 3) * TAU + o.v + d, [X0, Y0] = P(end.x, end.y), [X1, Y1] = P(end.x + Math.cos(b) * 150, end.y + Math.sin(b) * 150); along(c, `grift_${k % 2}`, X0, Y0, X1, Y1, 0.5 * z, 1 - clamp((t - 1.2) / 1), 0, clamp((t - T0 - 0.2) / 0.12), null); }
            break; }
          if (t < T0 + 0.1) for (const sd of [-1, 1]) { const C = W.cell(`gwind_${(sd + 1) / 2}`), a0 = d + sd * 0.5; D(c, `gwind_${(sd + 1) / 2}`, GX, GY - 20 * z, a0 - sd * 0.5 * gather, (L * 1.1 * z) / C[7] * V.z / z, sd * 0.9 * z, (1 - clamp((t - T0) / 0.1)) * veil(V, GX + Math.cos(a0) * 300 * z, GY), 0, ease(gather)); }
          for (let k = 0; k < 3; k++) { const tk = t - T0 - k * 0.07; if (tk < 0 || tk > 0.22) continue; const p = pt(0.3 + k * 0.35), [X, Y] = P(p[0], p[1]); D(c, `gbolt_${k % 2}`, X, Y, (k - 1) * 0.06, 0.95 * z, 0.95 * z * Math.min(1, tk / 0.04), (1 - clamp((tk - 0.12) / 0.1)) * veil(V, X, Y - 200 * z)); }
          break; }
        case 'bindOne': {      // 土行孙 地裂: under each group the earth tears open; clods fly; the rifts lie there while the ground holds
          const qs = o.quake || [];
          if (ground) { land(o, t, 12); for (const q of qs) { const R = (q.radius || 125) * 1.35, dark = clamp(t / T0);
              // the earth opens under them: fast, a hair overshot, held while the ground holds them, then it closes
              if (CHASM && t > T0 - 0.02) { const s = clamp((t - T0 + 0.02) / 0.14), open = s < 1 ? ease(s) * 1.06 : 1.06 - 0.06 * clamp((t - T0 - 0.12) / 0.1), close = 1 - clamp((t - 1.9) / 0.7);
                const w = (520 * (q.radius || 125) / 190) * z * open * (0.6 + 0.4 * close), h = w * CHASM.height / CHASM.width, [X, Y] = P(q.x, q.y);
                ctx.setTransform(1, 0, 0, 1, X - w / 2, Y - h / 2); ctx.globalAlpha = Math.min(1, s * 3) * close; ctx.drawImage(CHASM, 0, 0, CHASM.width, CHASM.height, 0, 0, w, h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
              shockAt(c, V, q.x, q.y, T0, t, 1.3);
              if (t < T0) for (let k = 0; k < 3; k++) D(c, `wdust_${k % 2}`, ...P(q.x + (k - 1) * 50, q.y + Math.sin(t * 60 + k) * 4), 0, 0.9 * z, 0.7 * z, gather * 0.7); }
            break; }
          for (const q of qs) for (let k = 0; k < 5; k++) { const tk = t - T0 - (k % 3) * 0.03; if (tk < 0 || tk > 0.7) continue; const b = (k / 5) * TAU + 0.3, s2 = tk / 0.7, r = (30 + 90 * s2) * (q.radius || 125) / 125,      // the earth thrown up: dust boiling out of the rifts
              [X, Y] = P(q.x + Math.cos(b) * r, q.y + Math.sin(b) * r * 0.6, 60 * s2); D(c, `wdust_${k % 2}`, X, Y, k, (0.9 + 1.2 * s2) * z, (0.8 + 0.9 * s2) * z, (1 - s2) * 0.9 * veil(V, X, Y)); }
          break; }
        case 'cone': {         // 邓婵玉 五光齐放: five stones lit in her hand, then five broad bands of mineral light laid hard across the cone,
          // one pigment each, and every face in it blinded
          const ps = o.picks.length ? o.picks : [{ x: gx + Math.cos(o.dir || 0) * 300, y: gy + Math.sin(o.dir || 0) * 300 }], R = o.radius || 440, ang = ((o.angle || 130) * Math.PI) / 180, d = o.dir || 0, [HX, HY] = P(gx, gy, 52);
          if (ground) { land(o, t, 10); for (let k = 0; k < 5; k++) { const p = at(ps[k % ps.length]); shockAt(c, V, p.x, p.y, T0 + 0.1 + k * 0.03, t, 0.6); }
            if (t > T0) for (let k = 0; k < 10; k++) { const b = d - ang / 2 + (ang * (k + 0.5)) / 10; along(c, `wlight5_${k % 5}`, ...P(gx, gy), ...P(gx + Math.cos(b) * R, gy + Math.sin(b) * R), 0.9 * z, 0.4 * (1 - clamp((t - T0) / 1.2)), 0, 1, null); }
            break; }
          if (t < T0) { for (let k = 0; k < 5; k++) { const b = (k / 5) * TAU + t * 10, X = HX + Math.cos(b) * 26 * z, Y = HY + 10 * z + Math.sin(b) * 18 * z; D(c, `gstone_${k}`, X, Y, b + Math.PI / 2, 0.35 * z, 0.35 * z, gather * veil(V, X, Y), 0.85, 1); } break; }
          // the five bands: laid one after another across the cone, held, then they go
          for (let k = 0; k < 5; k++) { const tk = t - T0 - k * 0.035; if (tk < 0 || tk > 0.7) continue; const b = d - ang / 2 + (ang * (k + 0.5)) / 5, [X1, Y1] = P(gx + Math.cos(b) * R, gy + Math.sin(b) * R, 20), C = W.cell(`gband_${k}`), len = Math.hypot(X1 - HX, Y1 - HY), rot = Math.atan2(Y1 - HY, X1 - HX);
            along(c, `gband_${k}`, HX, HY, X1, Y1, 1.1 * z, 1 - clamp((tk - 0.36) / 0.24), 0, clamp(tk / 0.07), V); }      // narrow beams of light, a fixed width; the glow round each is the cell's own
          // every face in the cone: the five lights burst on it
          for (let k = 0; k < 5; k++) { const p = at(ps[k % ps.length]), tk = t - T0 - 0.1 - k * 0.03; if (tk < 0 || tk > 0.45) continue; const [X, Y] = P(p.x, p.y, 50), s = tk / 0.45; D(c, 'gstar5', X, Y, k, (0.3 + 0.3 * ease(s)) * z, (0.3 + 0.3 * ease(s)) * z, (1 - s) * veil(V, X, Y)); }
          break; }
        case 'charge': {       // 黄飞虎 武成王: the ox charges; at its end the mountain of 泰山 comes down on them; every squad takes his ground
          const L = o.length || 380, d = o.dir || 0, T = o.time || 0.5, wd = o.width || 70, ex = o.x + Math.cos(d) * (L + 60), ey = o.y + Math.sin(d) * (L + 60), TM = T + 0.05;
          if (ground) { if (t >= TM && !o.hit) { o.hit = true; kick(14); hold(0.08); }
            for (let k = 0; k < 9; k++) { const f = (k + 0.5) / 9; if (t > f * T) D(c, `wscorch_${k % 2}`, ...P(o.x + Math.cos(d) * L * f + Math.sin(d) * (k % 2 ? 16 : -16), o.y + Math.sin(d) * L * f), k, 0.4 * z, 0.28 * z, 0.9 * (1 - clamp((t - 1.2) / 1))); }
            for (let k = 0; k < 7; k++) { const f = (k + 0.5) / 7, s = t - f * T; if (s > 0 && s < 1.2) D(c, `wdust_${k % 2}`, ...P(o.x + Math.cos(d) * L * f, o.y + Math.sin(d) * L * f), k, (1.2 + s) * z, (1 + s * 0.6) * z, 1 - s / 1.2); }
            // 泰山 comes down behind the foes where the charge ends, whole on screen: half the screen's height, falling from
            // above with its weight in the last instant, standing while the dust settles, then lost in its own mist
            if (TAI && t > TM - 0.12 && t < TM + 1.6) { const cw = ctx.canvas.width, ch = ctx.canvas.height, h = ch * 0.5, w = h * TAI.width / TAI.height, fy = TAI_FOOT * h;
              const X = Math.max(w / 2 + cw * 0.02, Math.min(cw - w / 2 - cw * 0.02, V.sx(ex))), Yf = Math.max(fy + ch * 0.03, Math.min(ch * 0.97, V.sy(ey) + 30 * z));
              const s = clamp((t - TM + 0.12) / 0.14), drop = (1 - s * s) * ch * 0.3, fade = 1 - clamp((t - TM - 0.9) / 0.7);
              ctx.setTransform(1, 0, 0, 1, X - w / 2, Yf - fy - drop); ctx.globalAlpha = Math.min(1, s * 1.5) * fade; ctx.drawImage(TAI, 0, 0, TAI.width, TAI.height, 0, 0, w, h); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
              o.mt = o.mt || [ex, ey]; }
            if (o.mt) shockAt(c, V, o.mt[0], o.mt[1], TM, t, 2.2);
            if (t > TM) { const s = clamp((t - TM) / 0.4), fade = 1 - clamp((t - 1.6) / 0.8); squads((x, y) => D(c, 'gring', ...P(x, y), 0, (0.55 + 0.25 * ease(s)) * z, (0.55 + 0.25 * ease(s)) * z * V.KY / 0.55 * 0.7, fade)); }
            break; }
          // what the ranks receive: over each allied squad his mountain in gold line, rising a little and fading, as the
          // gold ring of his ground opens under their feet
          if (t > TM && t < TM + 1.3) squads((x, y) => { const s = (t - TM) / 1.3, [X, Y] = P(x, y, 110 + 30 * ease(s)); D(c, 'gmark', X, Y, 0, 0.8 * z, 0.8 * z, Math.min(1, s * 6) * (1 - clamp((s - 0.6) / 0.4)) * veil(V, X, Y)); });
          break; }
        case 'command': {      // 姜子牙 金台拜将: the banner rises by him; the investiture list unrolls over the named foe; its slips fall and
          // stand round him; then the whip comes down on him: the peak, held. Gold threads of his command run to every squad.
          const p = at(o.at2), [NX, NY] = P(p.x, p.y, 40), up = ease(clamp(t / 0.22)), cw = ctx.canvas.width, ch = ctx.canvas.height;
          const Wd = 620 * z, SX0 = Math.max(16, Math.min(cw - Wd - 16, NX - Wd * 0.5)), SY = Math.max(ch * 0.16, NY - 260 * z);
          if (ground) { land(o, t, 13); shockAt(c, V, p.x, p.y, T0, t, 1.5);
            if (t > 0.2) squads((x, y) => { const [X0, Y0] = P(gx, gy), [X1, Y1] = P(x, y), C = W.cell('gthread_0'), L2 = Math.hypot(X1 - X0, Y1 - Y0); if (C) D(c, `gthread_${(x | 0) & 1}`, X0, Y0, Math.atan2(Y1 - Y0, X1 - X0), L2 / C[7], 0.9 * z, 0.9 * (1 - clamp((t - 1.6) / 0.6)), 0, clamp((t - 0.2) / 0.25)); });
            break; }
          if (t < 1.3) { const [X, Y] = P(gx + 36, gy, 0), fa = (1 - clamp((t - 1) / 0.3)) * veil(V, X, Y - 120 * z);
            if (!pic('banner', X + 40 * z, Y - 105 * z * up, Math.sin(clock * 2) * 0.03, 160 * z, fa * gclear(X + 40 * z, Y - 105 * z), 1, 0, 1, up)) D(c, 'wflag', X, Y, Math.sin(clock * 2) * 0.03, 0.4 * z, 0.4 * z * up, (1 - clamp((t - 1) / 0.3)) * veil(V, X, Y - 120 * z)); }
          if (t > 0.18 && t < 1.4) { const q = ease(clamp((t - 0.18) / 0.3)), C = W.cell('gscroll'), fade = 1 - clamp((t - 1.05) / 0.35);
            const SA = fade * boxVeil(V, SX0, SY - 60 * z, SX0 + Wd * q, SY + 60 * z);
            if (!pic('scroll', SX0 + (PICS ? PICS.meta.scroll.cx : 0) * Wd / 900, SY, 0, Wd, SA, 1, 0, Math.max(0.12, q), 0.8)) D(c, 'gscroll', SX0, SY, 0, Wd / C[7], 0.5 * z, fade * boxVeil(V, SX0, SY - 60 * z, SX0 + Wd * q, SY + 60 * z), 0, q); }
          // the slips: seven, out of the list, falling to stand in a ring round him (the 七箭书's seven nails)
          for (let k = 0; k < 7; k++) { const tk = t - 0.42 - k * 0.03; if (tk < 0 || tk > 1.1) continue; const q = ease(clamp(tk / 0.2)), b = (k / 7) * TAU + 0.3;
            const XA = SX0 + Wd * (0.2 + 0.6 * (k / 6)), YA = SY + 40 * z, XB = NX + Math.cos(b) * 70 * z, YB = NY - 120 * z + Math.sin(b) * 34 * z;
            D(c, `gslip_${k % 2}`, XA + (XB - XA) * q, YA + (YB - YA) * q, (1 - q) * (k % 2 ? 0.5 : -0.5) + Math.sin(b) * 0.08, 0.55 * z, 0.55 * z, (1 - clamp((tk - 0.8) / 0.3)) * veil(V, XB, YB + 60 * z)); }
          // the whip: down on him from above, the peak of the feat
          if (t > T0 - 0.1 && t < T0 + 0.45) { const s = clamp((t - T0 + 0.1) / 0.1), C = W.cell('wlash_0'), side = V.hero && V.hero[0] > NX ? 1 : -1, X0 = NX - side * 340 * z, Y0 = NY - 300 * z, len = Math.hypot(NX - X0, NY - Y0);
            const wr = Math.atan2(NY - Y0, NX - X0), WA = (1 - clamp((t - T0 - 0.25) / 0.2)) * veil(V, NX, NY), wk = PICS ? PICS.meta.whip.cx * len / 900 : 0;
            if (!pic('whip', X0 + Math.cos(wr) * wk, Y0 + Math.sin(wr) * wk, wr, len, WA, 1, 0, Math.max(0.05, s), 0.7 * side)) D(c, 'wlash_0', X0, Y0, Math.atan2(NY - Y0, NX - X0), len / (C[7] * 0.85), 1.4 * z, (1 - clamp((t - T0 - 0.25) / 0.2)) * veil(V, NX, NY), 0, s);
            if (t > T0) for (let j = 0; j < 2; j++) D(c, `wcut_${j}`, NX, NY, 0.7 + j * 1.3, 0.9 * z * ease(clamp((t - T0) / 0.08)), 0.9 * z, (1 - clamp((t - T0 - 0.15) / 0.25)) * veil(V, NX, NY)); }      // the blow lands: two cuts of ink across him
          break; }
        case 'snort': {        // 郑伦 白光摄魄: he draws breath; two great beams of white light pour out; the souls they take rise to him
          const R = o.radius || 360, full = (o.angle || 0) >= 359, d = o.dir || 0, [OX, OY] = P(o.x, o.y, 55);
          if (ground) { land(o, t, 7); if (t > T0) W.draw(c, 'whalo_water', ...P(o.x, o.y), 0, (R / 160) * z, (R / 160) * z * V.KY, 0.45 * (1 - clamp((t - T0 - 0.5) / 1))); break; }
          if (t < T0) { for (let j = 0; j < 10; j++) { const b = (j / 10) * TAU, r = 200 * (1 - ease(gather)) * z + 20 * z, X = OX + Math.cos(b) * r, Y = OY + Math.sin(b) * r * 0.7; D(c, `wray_${j % 2}`, X, Y, b + Math.PI / 2, 0.3 * z, 0.4 * z, Math.sin(Math.PI * gather) * veil(V, X, Y)); } }
          else if (t < T0 + 0.5) { const n = full ? 4 : 2, s = t - T0; for (let k = 0; k < n; k++) { const b = full ? (k / n) * TAU + o.v * 0.4 : d + (k - 0.5) * 0.18, C = W.cell(`gbeam_${k % 2}`);
              D(c, `gbeam_${k % 2}`, OX, OY, b, (R * 1.15 * z) / C[7], 0.8 * z, (1 - clamp((s - 0.3) / 0.2)) * lineVeil(V, OX + Math.cos(b) * 60 * z, OY + Math.sin(b) * 60 * z, OX + Math.cos(b) * R * 1.15 * z, OY + Math.sin(b) * R * 1.15 * z), 0, clamp(s / 0.1)); } }
          const caught = o.captured || []; for (let k = 0; k < Math.min(12, Math.max(caught.length, full ? 6 : 2)); k++) { const tk = t - T0 - 0.1 - k * 0.03, q = clamp(tk / 0.55); if (tk < 0 || q >= 1) continue;
            const b = full ? (k / 12) * TAU : d + (k % 3 - 1) * 0.3, sx0 = o.x + Math.cos(b) * R * 0.65, sy0 = o.y + Math.sin(b) * R * 0.65, [X, Y] = P(sx0 + (o.x - sx0) * ease(q), sy0 + (o.y - sy0) * ease(q), 40 + 80 * Math.sin(Math.PI * q));
            D(c, 'gsoul', X, Y, Math.atan2(o.y - sy0, o.x - sx0) * 0.2, 0.7 * z, 0.7 * z, Math.sin(Math.PI * q) * veil(V, X, Y)); }
          break; }
        case 'vase': {         // 龙吉 四海归瓶: the vase rises and drinks every shot; then the seas break on them as waves
          const [VX, VY] = P(gx, gy, 250), up = ease(clamp(t / 0.25)), n = Math.min(10, o.swallowed || 0), pours = (o.targets || []).filter((p) => p.pour).slice(0, 4), tgt = pours.length ? pours : (o.targets || []).slice(0, 1);
          if (ground) { land(o, t, 9); const rr = 60 + 120 * ease(clamp(t / 0.5)); for (let j = 0; j < 2; j++) ribbon(c, `wwave_${j}`, (q) => P(gx + Math.cos(q * TAU + j * 2) * rr * (1 + 0.15 * j), gy + Math.sin(q * TAU + j * 2) * rr * (1 + 0.15 * j)), 0.4 * z, 1 - clamp((t - 0.8) / 0.6), 0, clamp(t / 0.35), 20, null);
            for (const p of (o.wave ? [o.wave, ...pours.slice(1)] : tgt)) { shockAt(c, V, p.x, p.y, T0 + 0.2, t, 1.2); if (t > T0 + 0.25) W.draw(c, 'whalo_water', ...P(p.x, p.y), 0, 0.6 * z, 0.6 * z * V.KY, 0.6 * (1 - clamp((t - 1.2) / 1))); } break; }
          if (t < 1.1 && !pic('vase', VX, VY, Math.sin(clock * 3) * 0.05, 115 * z * Math.max(0.05, up), (1 - clamp((t - 0.85) / 0.25)) * veil(V, VX, VY) * gclear(VX, VY))) D(c, 'wvase', VX, VY, Math.sin(clock * 3) * 0.05, 0.7 * z * up, 0.7 * z * up, (1 - clamp((t - 0.85) / 0.25)) * veil(V, VX, VY));
          if (t > 0.1 && t < 0.55) for (let k = 0; k < Math.max(n, 3); k++) { const b = (k / Math.max(3, n)) * TAU + 0.4, [X0, Y0] = P(gx + Math.cos(b) * 560, gy + Math.sin(b) * 380, 60); ribbon(c, `wwave_${k % 2}`, (s) => { const w = 1 - s; return [X0 + (VX - X0) * s + Math.sin(s * 6 + k) * 30 * w * z, Y0 + (VY - 30 * z - Y0) * s]; }, 0.3 * z, (n ? 1 : 0.5) * (1 - clamp((t - 0.4) / 0.15)), clamp((t - 0.25) / 0.3), clamp((t - 0.1) / 0.25), 10, V); }
          // one great wave, on the first group: several overlapping read as arches
          for (const p of o.wave ? [o.wave] : []) { const s = clamp((t - T0 + 0.05) / 0.25); if (s <= 0 || t > T0 + 0.7) continue; const [X0, Y] = P(p.x, p.y, 0), fade = 1 - clamp((t - T0 - 0.35) / 0.35), k = 0.65 * z * (0.55 + 0.45 * ease(s)), kf = 0.65 * z, H = V.hero, cw = ctx.canvas.width;
            // it breaks beside the hero, never over him: pushed out sideways until its whole outline clears him, rolling away from him
            let X = X0; if (H && Math.abs(X - H[0]) < 320 * kf + 150 * z) X = H[0] + (X >= H[0] ? 1 : -1) * (320 * kf + 150 * z); X = Math.max(320 * kf, Math.min(cw - 320 * kf, X)); const Yw = Math.max(380 * kf + ctx.canvas.height * 0.04, Math.min(ctx.canvas.height * 0.97, Y));
            const WA2 = Math.min(1, s * 2) * fade * boxVeil(V, X - 320 * k, Yw - 380 * k, X + 320 * k, Yw + 30 * z), wl = 680 * k, wm = PICS && PICS.meta.wave;
            // the painted wave breaks to its left: mirrored when it stands right of the hero, so it always rolls away from him
            if (!(wm && pic('wave', X, Yw + 20 * z - (1 - ease(s)) * 60 * z - (wm.h - wm.cy) * wl / wm.w, 0, wl, WA2, X >= (H ? H[0] : 0) ? -1 : 1)))
              D(c, `gwave_${X >= (H ? H[0] : 0) ? 0 : 1}`, X, Yw + 20 * z - (1 - ease(s)) * 60 * z, 0, k, k, WA2); }
          break; }
        case 'nail': {         // 黄天化 华光穿心: the light gathers in his hand; then one hard lance of light, white-hot in matte gold, through
          // the heart of the strongest, struck three times (the three nails), each time a burst of flame at the heart
          const ts = o.targets || [], d = o.dir || 0, [X0, Y0] = P(gx, gy, 55), p = at(ts[0] || { x: gx + Math.cos(d) * 420, y: gy + Math.sin(d) * 420 }), dd = Math.hypot(p.x - gx, p.y - gy) || 1;
          // through the heart and on: at least 650 long, so it reads even when he stands by the hero and his target is near
          const ux = (p.x - gx) / dd, uy = (p.y - gy) / dd, past = Math.max(300, 650 - dd), [XT, YT] = P(p.x, p.y, 45), [XE, YE] = P(p.x + ux * past, p.y + uy * past, 45), [XS, YS] = P(gx + ux * 50, gy + uy * 50, 55), n = o.count || 3;
          if (ground) { land(o, t, 14); for (let k = 0; k < n; k++) shockAt(c, V, p.x, p.y, T0 + 0.06 + k * 0.14, t, 1.0);
            if (t > T0 + 0.08) along(c, 'wthrust_0', ...P(gx + ux * 50, gy + uy * 50), ...P(p.x + ux * past * 0.8, p.y + uy * past * 0.8), 0.7 * z, 0.7 * (1 - clamp((t - 1.1) / 0.9)), 0, 1, null); break; }
          if (t < T0 + 0.06) D(c, 'gflare', X0, Y0, t * 4, (0.25 + 0.45 * gather) * z, (0.25 + 0.45 * gather) * z, Math.min(1, gather * 1.5) * veil(V, X0, Y0));
          if (t > T0 && t < T0 + 0.75) { const s = clamp((t - T0) / 0.06), pulse = Math.max(...Array.from({ length: n }, (_, k) => Math.max(0, 1 - Math.abs(t - T0 - 0.06 - k * 0.14) / 0.07))), C = W.cell('glance'), len = Math.hypot(XE - X0, YE - Y0), rot = Math.atan2(YE - Y0, XE - X0);
            along(c, 'glance', XS, YS, XE, YE, (0.75 + 0.35 * pulse) * z, 1 - clamp((t - T0 - 0.5) / 0.25), 0, s, V); }
          for (let k = 0; k < n; k++) { const s2 = t - T0 - 0.06 - k * 0.14; if (s2 > 0 && s2 < 0.3) D(c, 'gflare', XT, YT, d + k, (0.6 + 0.5 * ease(s2 / 0.3)) * z, (0.6 + 0.5 * ease(s2 / 0.3)) * z, (1 - s2 / 0.3) * veil(V, XT, YT)); }
          break; }
      } } GCL = null; }
  function squads(f) { const as = G && G.allies; if (!as) return; const sq = {}; for (const a of as) { if (a.kind === 'general' || a.state === 'dead' || a.state === 'away') continue; const q = sq[a.kind] || (sq[a.kind] = [0, 0, 0]); q[0]++; q[1] += a.x; q[2] += a.y; } for (const k in sq) { const q = sq[k]; f(q[1] / q[0], q[2] / q[0]); } }

  // ---------------------------------------------------------------- 雷震子's storm (a zone that moves with him) and 土行孙's held ground
  function zonesDraw(c, V, layer) { const zs = G && G.zones; if (!zs) return; const z = V.z;
    for (const zn of zs) { if (zn.dead || zn.side !== 'zhou') continue;
      if (zn.kind === 'storm') { const X = V.sx(zn.x), Y = V.sy(zn.y), r = zn.r || 150;
        if (layer === 'ground') { W.draw(c, 'whalo_gold', X, Y, clock * 0.4, (r / 190) * z, (r / 190) * z * V.KY, 0.35); continue; }
        W.draw(c, 'wcloud_0', X, Y - 170 * z, Math.sin(clock) * 0.04, (r / 260) * z, (r / 300) * z, 0.75 * veil(V, X, Y - 170 * z));
        const ph = clock * 3.1 + zn.id, slot = Math.floor(ph), q = ph - slot; if (q < 0.25) { const h1 = Math.sin(slot * 12.9 + zn.id) * 43758.5, b = (h1 - Math.floor(h1)) * TAU, [XB, YB] = [V.sx(zn.x + Math.cos(b) * r * 0.6), V.sy(zn.y + Math.sin(b) * r * 0.4)]; W.draw(c, `wbolt_${slot % 2}`, XB, YB, 0, 0.45 * z, 0.45 * z, (1 - q / 0.25) * veil(V, XB, YB - 80 * z)); } }
      else if (false && zn.kind === 'hold' && zn.src === 'tuxingsun' && layer === 'ground')      /* (the chasm of the feat is his held ground now) */ { const a = clamp((zn.t || 0) / 0.2) * clamp(((zn.life || 2.5) - (zn.t || 0)) / 0.4); for (let k = 0; k < 3; k++) { const b = (k / 3) * TAU + zn.id; along(c, `wcrack_${k % 2}`, V.sx(zn.x), V.sy(zn.y), V.sx(zn.x + Math.cos(b) * zn.r), V.sy(zn.y + Math.sin(b) * zn.r), 0.38 * z, a * 0.7, 0, 1, null); } } } }

  // ---------------------------------------------------------------- 天眼: what it leaves
  // how far the latest gaze has reached a foe (0 until the blade crosses him, then 1): the rim and seal appear as it passes
  function eyeReveal(f) { let best = null; for (const o of feats) if (o.shape === 'eye' && (!best || o.at > best.at)) best = o; if (!best) return 1;
    const gx = best.x, gy = best.y, half = ((best.angle || 70) * Math.PI) / 360, d = best.dir || 0;
    let da = Math.atan2(f.y - gy, f.x - gx) - (d - half); da = Math.atan2(Math.sin(da), Math.cos(da)); if (da < 0) da += TAU; const frac = Math.min(1, da / (2 * half));
    const tSweep = best.at + Math.max(best.land || 0, SWEEP0 + SWEEP * frac); return clamp((clock - tSweep) / 0.06); }

  // a small eye over each marked foe while his mark lasts (f.eyeUntil, game seconds), at most 30 drawn
  function eyeSeals(V) { const fs = G && G.foes; if (!EYE || !fs) return; const z = V.z, now = G.t || 0; let n = 0;
    for (const f of fs) { if (f.state === 'dead' || !(f.eyeUntil > now)) continue; if (++n > 30) break;
      const X = V.sx(f.x), Y = V.sy(f.y) - (f.tier ? 160 : 100) * z, hgt = 34 * z, k = hgt / EYE.height, a = clamp((f.eyeUntil - now) / 0.3) * eyeReveal(f) * 0.95 * veil(V, X, Y);
      ctx.setTransform(k, 0, 0, k, X, Y); ctx.globalAlpha = a; ctx.drawImage(EYE, -EYE.width / 2, -EYE.height / 2); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
  // a ward broken (wardBroken), the pay-off: a gold ward ring round him cracks all the way round, swells and bursts; shards of ink
  // and gold fly out and a flash of gold goes up from him (0.9 s)
  function breaksDraw(c, V, layer) { const z = V.z;
    for (let i = 0; i < breaks.length; i++) { const o = breaks[i], t = clock - o.at; if (t > 0.9) { if (layer === 'over') breaks.splice(i--, 1); continue; }
      const u = foeOf(o.id), x = u ? u.x : o.x, y = u ? u.y : o.y, X = V.sx(x), Y = V.sy(y), q = t / 0.9, sw = 1 + 0.7 * ease(clamp((t - 0.25) / 0.5)), R = 170 * sw, a = 1 - clamp((t - 0.35) / 0.55);
      if (layer === 'ground') { const kr = (R * 2 * z) / 360; W.draw(c, 'whalo_gold', X, Y, q * 0.4, kr, kr * V.KY, a); D(c, 'gshock_0', X, Y, 0, kr * 0.9, kr * 0.9 * V.KY / 0.55, a * 0.85);
        // the cracks: gold lines running round and out through the ring, all the way round
        const run = clamp(t / 0.25); for (let k = 0; k < 14; k++) { const b = (k / 14) * TAU + 0.2, r0 = R * 0.75, r1 = R * (1.05 + 0.25 * Math.sin(k * 3.7)) * run, j = 0.18 * Math.sin(k * 5.1);
          along(c, `gthread_${k & 1}`, V.sx(x + Math.cos(b) * r0), V.sy(y + Math.sin(b) * r0), V.sx(x + Math.cos(b + j) * r1), V.sy(y + Math.sin(b + j) * r1), 0.7 * z, a, 0, 1, V); }
        continue; }
      if (t > 0.25) { const s2 = (t - 0.25) / 0.65; for (let k = 0; k < 16; k++) { const b = (k / 16) * TAU + 0.1, r = (R * 0.9 + 220 * ease(s2)) * z, px = X + Math.cos(b) * r, py = Y + Math.sin(b) * r * V.KY - (70 * s2 - 40 * s2 * s2) * z;
          W.draw(c, `wcut_${k & 1}`, px, py, b, 0.4 * z, 0.4 * z, (1 - s2) * veil(V, px, py)); } }
      if (t < 0.3) { const f2 = t < 0.06 ? 1 : 1 - (t - 0.06) / 0.24; W.draw(c, 'whalo_gold', X, Y - 90 * z, 0, 1.2 * z, 1.2 * z, f2 * veil(V, X, Y - 90 * z)); } } }

  return {
    onEvent, owns, eyeReveal,
    drawGround(V, dt, game) { clock += dt; if (game) G = game; if (!W.ready) return; const c = ctx; c.save(); if (warm.length) warmUp(); stageGround(c, V); featsDraw(c, V, 'ground'); zonesDraw(c, V, 'ground'); breaksDraw(c, V, 'ground'); c.restore(); },
    drawOver(V) { if (!W.ready) return; const c = ctx; c.save(); stageOver(c, V); featsDraw(c, V, 'over'); zonesDraw(c, V, 'over'); breaksDraw(c, V, 'over'); eyeSeals(V); c.restore(); },
    get live() { return stages.length + feats.length; },
    reset() { stages.length = 0; feats.length = 0; breaks.length = 0; },
  };
}

// splats for the ink at his feet (cells of the 256 x 160 sheet, as ink.js): [time, u, v, ru, rv, water, ink, rough, ring?]
const BLOOM = [[0, 128, 80, 70, 40, 1, 0, 0.5], [0.08, 128, 84, 46, 26, 0.6, 0.9, 0.6], [0.3, 128, 80, 96, 56, 0.5, 0.25, 0.7, 0.62]];
