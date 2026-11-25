// The treasures as wonders from the book, in brushwork (the lead and the user, 2026-11-25: effects are painting in motion,
// strokes a painter's hand made; no pasted pictures, no glow). Strokes come from the brush sheet (wonders.js), the wash from
// the wet-paper simulation (ink.js); everything is drawn through glctx with ordinary source-over.
//   九龙神火罩 (fireCover)  nine fire dragons written in a few strokes of cinnabar and ink (wdrg_*, wdrg_head_*): each is
//       laid in strips along its flight path, so the stroke bends with the flight; it is drawn on head first as it comes
//       down out of the sky; they coil round the burning ground in three tiers (the middle tier turning the other way), the
//       back half behind the figures and the front over them, half lost in pale 祥云 (陈容's 九龙图: never whole); on the
//       ground a broken ring of cinnabar wash (whalo_fire) and a cinnabar wash bleeding into the paper; when the cover
//       lifts they climb away, tail first gone, and break into wash. Evolved: bigger, faster.
//   乾坤圈 (ring)  one circular stroke of gold-ochre (wring_*) turning as it flies, a dry-brush wake behind it (wring_trail_*);
//       evolved, a broken wash halo of gold behind it (whalo_gold)
//   打神鞭 (whip)  a lash (wlash_*): one calligraphic stroke cracking out from beside him to each target and curling, then
//       drawn back; a small brushed talisman (wfu_*) left on each one struck. Evolved, the lash leaps from target to target.
// The stroke effects stand aside (fx/index.js asks has(kind)) once the brush sheet has loaded.
import { createWonders } from './wonders.js';
const TAU = Math.PI * 2;
// a wash bleeding out round a point, in cells of the 256 x 160 sheet: wet ring, pigment at four points, one drop flung
const RING_SCRIPT = [[0.02, 128, 84, 104, 58, 0.5, 0, 0.6, 0.5], [0.12, 60, 84, 14, 9, 1, 1.6, 0.55], [0.18, 196, 84, 13, 8, 1, 1.5, 0.55], [0.24, 128, 40, 12, 7, 1, 1.4, 0.55], [0.3, 128, 128, 15, 9, 1, 1.6, 0.55], [0.5, 220, 40, 2.2, 1.8, 0.6, 1.5, 0.3]];
// water: a soft wet ring with azurite let down thin (the pigment is strong; at full ink it lands as blots)
const WATER_SCRIPT = [[0.02, 128, 84, 112, 62, 0.6, 0, 0.5, 0.5]].concat([0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2; return [0.1 + i * 0.03, 128 + Math.cos(a) * 92, 84 + Math.sin(a) * 50, 26, 12, 0.85, 0.32, 0.6]; }));   // a ring of thin wash along the wetted ring, never a pool
const BREAK_SCRIPT = [[0.02, 128, 80, 96, 40, 0.55, 0, 0.8], [0.1, 90, 82, 22, 9, 1, 1.3, 0.6], [0.16, 150, 76, 18, 8, 1, 1.1, 0.6], [0.24, 200, 70, 10, 5, 0.9, 1, 0.5], [0.3, 50, 90, 8, 4, 0.9, 0.9, 0.5]];
export function createTreasures(ctx, ink, W = createWonders(), onKick = () => {}) {
  // The fight stays readable (the lead, after the user's second play, 2026-11-25): an ordinary cast's paint over the figures is
  // counted each frame, and once the frame's ordinary paint passes a few percent of the screen every later stroke is drawn
  // fainter (grow by number, reach and speed; never by thickness and opacity). The great moments are left out of the count.
  const Wsrc = W, COVER = 0.05; let budgetOn = false, cov = 0, covMax = 1;
  W = Object.create(Wsrc);
  W.draw = (c, name, X, Y, rot, kx, ky, a, u0 = 0, u1 = 1) => { if (budgetOn && a > 0) { const C = Wsrc.cell(name);
      if (C) { cov += Math.abs(C[7] * kx * C[8] * ky) * (u1 - u0) * 0.35 * Math.min(1, a); if (cov > covMax) a *= Math.max(0.15, covMax / cov); } }
    return Wsrc.draw(c, name, X, Y, rot, kx, ky, a, u0, u1); };
  const covers = new Map(), columns = [], silks = [], lanes = new Map(); let clock = 0, frame = 0, G0 = null, waterAt = -9;
  const PAINTED = { fireCover: 1, ring: 1, whip: 1, sash: 1, fireSpear: 1, pearls: 1, banner: 1, knife: 1, bell: 1, fan: 1, mirror: 1, rope: 1, lotus: 1, tower: 1, zhaoyao: 1, seal: 1 };
  const has = (kind) => W.ready && !!(PAINTED[kind] || BOSS_SIG[kind]);
  function onEvent(e) {
    if (e.type === 'hit' && e.id === 'ring' && !e.dot) { if (ringHits.length >= 6) return; ringHits.push({ x: e.x, y: e.y, at: clock, v: frame % 2 }); return; }
    if (e.type === 'cast' && e.id === 'whip') { const ts = e.targets || [{ x: e.x, y: e.y }], ev = !!e.evolved, h = G0 && G0.hero;
      // 打神鞭: a lash cracks out from beside him to each target (evolved, 封神: the lash leaps on from target to target);
      // it never starts over him, and nothing of it stays over him
      ts.forEach((p, i) => { let ax, ay; if (i && ev) { ax = ts[i - 1].x; ay = ts[i - 1].y; } else if (h) { const d = Math.hypot(p.x - h.x, p.y - h.y) || 1; ax = h.x + (p.x - h.x) / d * 75; ay = h.y + (p.y - h.y) / d * 75; } else { ax = p.x - 200; ay = p.y; }
        columns.push({ ax, ay, x: p.x, y: p.y, at: clock + i * (ev ? 0.06 : 0.035), ev, side: i % 2 ? 1 : -1, v: i % 3 }); }); }
    if (e.type === 'cast' && e.id === 'sash') { const h = G0 && G0.hero, ev = !!e.evolved || (e.angle || 0) >= 359; turn = -turn;
      silks.push({ at: clock, x: e.x, y: e.y, dx: h ? e.x - h.x : 0, dy: h ? e.y - h.y : 0, follow: !e.fixed, R: e.radius || 165, ang: ev ? TAU : ((e.angle || 120) * Math.PI) / 180, dir: e.dir || 0, ev, turn, lv: e.level || 1, life: ev ? 1.2 : 0.8, v: silks.length % 2 });
      /* no wet wash under the silk: at the page's scale its drops read as a ring of pools (the lead, twice); the water bands carry the water */ }
    if (e.type === 'cast' && e.id === 'fireSpear') { const L = e.length || 230, ev = !!e.evolved, d = e.dir || 0, k = 0.5 + 0.2 * Math.min(1.5, (e.width || 34) / 34 - 1) + (ev ? 0.15 : 0);
      thrusts.push({ at: clock, x: e.x, y: e.y, d, L, k, v: thrusts.length % 2 });
      if (ev || e.fork) { const fa = e.forkAngle || 0.45, fl = (e.forkLength || 0.65) * L; for (const s of [-1, 1]) thrusts.push({ at: clock + 0.03, x: e.x, y: e.y, d: d + s * fa, L: fl, k: k * 0.8, v: (thrusts.length + 1) % 2 }); }
      if (ink && ev && clock - fireAt > 1.2) { fireAt = clock; ink.bloom({ x: e.x + Math.cos(d) * L * 0.5, y: e.y + Math.sin(d) * L * 0.5, w: L * 1.4, splats: BREAK_SCRIPT, pigment: 'fire', life: 3.5, dry: [0.8, 1.5], sink: 2.2, hero: true }); } }
    // the hero's weapons (content/weapons.js): each blow one stroke, leaving from the weapon (until the figures give its tip on the
    // blow frame, 40 units ahead of him along the blow); the stroke effects draw nothing for them
    // the first stretch's bosses: each pattern's blow with a signature in brush, over the stroke module's warning and land
    if (e.type === 'spoilStrike') { spoilEvent(e); return; }
    if (e.type === 'held') heldHow = e.how || 'seize';
    if (e.type === 'land' && e.side === 'shang' && BOSS_SIG[e.id]) sigs.push({ id: e.id, at: clock, x: e.x, y: e.y, d: e.dir || 0, R: e.radius || 100, r0: e.inner || 0, L: e.length || 500, w: e.width || 70, ang: ((e.angle || 36) * Math.PI) / 180, gap: e.gap || 0, v: sigs.length % 2 });
    // the generals: 显圣 (a true form) and 雷震子's dive
    // (显圣 and the true-form feats are gods.js's)
    if (e.type === 'generalSkill' && e.id === 'thunderDive' && !e.trueForm) dives.push({ at: clock, x: e.x, y: e.y, d: e.dir || 0, L: 380 });
    // rank 5, the blessed host (神兵): its skill as the work of immortals, laid over the stroke version
    if (e.type === 'squadSkill' && e.blessed) hosts.push({ id: e.id, at: clock, x: e.x, y: e.y, d: e.dir || 0, el: e.element, targets: e.targets, v: hosts.length % 3 });
    // the eight new treasures (SPEC-CAMPAIGN 2.3)
    if (e.type === 'cast' && !e.weapon && NEW8[e.id]) { const ev = !!e.evolved, d = e.dir || 0;
      if (e.shape === 'drop') for (const [i, p] of (e.targets || [{ x: e.x, y: e.y }]).entries()) news.push({ id: e.id, at: clock + i * 0.04, x: p.x, y: p.y, delay: e.delay || 0.3, r: e.radius || 60, ev, v: i % 2, lv: e.level || 1 });
      else news.push({ id: e.id, at: clock, x: e.x, y: e.y, d, R: e.radius || 160, ang: ((e.angle || 120) * Math.PI) / 180, L: e.length || 400, w: e.width || 40, life: e.life || 0.8, sweep: e.sweep || 0, ev, v: news.length % 2 }); }
    if (e.type === 'cast' && e.weapon) { const id = e.id, ev = !!e.evolved; wturn = -wturn;
      const tip = undefined;      // the weapon's tip, read on the blow's first drawn frame (after drawWorld has posed the hero: blowAt is 0)
      if (e.shape === 'line') blows.push({ tip, kind: 'line', at: clock, x: e.x, y: e.y, d: e.dir || 0, L: e.length || 240, k: (e.width || 34) / 34, ev, v: blows.length % 2 });
      else if (e.shape === 'arc') blows.push({ tip, kind: id === 'glaive' || id === 'mountainSplitter' ? 'cleave' : id === 'steelWhip' || id === 'ninefold' ? 'lash' : 'sweep', at: clock, x: e.x, y: e.y, d: e.dir || 0, R: e.radius || 130, ang: ((e.angle || 180) * Math.PI) / 180, ev, turn: wturn, v: blows.length % 2 }); }
  }
  let tipFn = null, turn = 1, fireAt = -9, wturn = 1; const thrusts = [], blows = [];
  const NEW8 = { knife: 1, bell: 1, fan: 1, mirror: 1, lotus: 1, tower: 1, zhaoyao: 1, seal: 1 }, news = [], prints = [];
  function newsDraw(c, V, G) {
    for (let i = 0; i < news.length; i++) { const o = news[i], t = clock - o.at; if (t < 0) continue;
      const end = o.id === 'seal' ? o.delay + 0.22 : o.id === 'tower' ? o.delay + 0.5 : o.id === 'lotus' ? o.delay + 0.45 : o.id === 'knife' ? o.delay + 0.35 : o.id === 'mirror' ? o.life + 0.2 : o.id === 'zhaoyao' ? 0.9 : 0.45;   // over the figures under 0.4 s after the blow if (t > end) { news.splice(i--, 1); continue; }
      const X = V.sx(o.x), Y = V.sy(o.y), z = V.z, fade = Math.min(1, (end - t) / 0.25);
      if (o.id === 'seal') { const k = (o.ev ? 0.46 : 0.4) * z, s0 = t - o.delay;      // a figure and a half wide whatever its reach: the print on the ground shows the reach      // 番天印 in brush: it drops in a blink, strikes, is gone; the print stays on the ground
        if (s0 < -0.1) continue; if (s0 < 0) { const u = 1 + s0 / 0.1; W.draw(c, 'wseal', X, Y - (1 - u * u) * 340 * z, 0, k, k, 0.9 * veil(V, X, Y - 60 * z)); continue; }
        if (!o.hit) { o.hit = 1; prints.push({ x: o.x, y: o.y, r: o.r, at: clock, v: o.v, ev: o.ev }); onKick(3 + 0.6 * Math.min(6, o.lv)); }
        W.draw(c, 'wseal', X, Y, 0, k, k * (s0 < 0.04 ? 0.92 : 1), Math.max(0, 1 - s0 / 0.12) * veil(V, X, Y - 60 * z)); continue; }
      if (o.id === 'knife') { const u = Math.min(1, t / o.delay), sx0 = X - 260 * z, sy0 = Y - 420 * z, kx = sx0 + (X - sx0) * u * u, ky = sy0 + (Y - 30 * z - sy0) * u * u;   // 斩仙飞刀: it dives, then the cut
        if (u < 1) W.draw(c, 'wknife', kx, ky, Math.atan2(Y - sy0, X - sx0) + Math.sin(t * 30) * 0.15, 0.9 * z, 0.9 * z, 1); else W.draw(c, `wcut_${o.v}`, X, Y - 30 * z, 0, (o.ev ? 1.2 : 0.9) * z, (o.ev ? 1.2 : 0.9) * z, fade * Math.min(1, (t - o.delay) / 0.03)); continue; }
      if (o.id === 'lotus') { const u = Math.min(1, t / o.delay), k = (o.r / 60) * 0.7 * z;              // 遁龙桩: the post comes down, three gold rings close round it
        W.draw(c, 'wpost', X, Y - (1 - u * u) * 500 * z, 0, k, k, fade); if (u >= 1) { const q = Math.min(1, (t - o.delay) / 0.15); for (let r = 0; r < 3; r++) { const kr = (o.r / 62) * (1.8 - 1.0 * q) * z * (1 - r * 0.08); W.draw(c, `wringt_${r % 2}`, X, Y - (20 + r * 55) * k, 0, kr, kr * 0.35, fade * Math.max(0, 1 - Math.max(0, t - o.delay - 0.25) / 0.15)); } } continue; }
      if (o.id === 'tower') { const u = Math.min(1, t / o.delay), k = (o.r / 90) * (o.ev ? 0.85 : 0.65) * z, rise = Math.max(0, (t - o.delay - 0.2) / 0.25);   // 玲珑宝塔: it comes down over them, stands, rises away
        if (u >= 1 && rise < 1) W.draw(c, 'whalo_gold', X, Y, 0, k * 1.1, k * 1.1 * V.KY, (1 - rise) * 0.8);
        W.draw(c, 'wtower', X, Y - ((1 - u) ** 2 * 600 + rise * rise * 700) * z, 0, k, k, 1 - rise); continue; }
      if (o.id === 'mirror') { const dd = o.d + o.sweep * t, mx = V.sx(o.x + Math.cos(dd) * 90), my = V.sy(o.y + Math.sin(dd) * 90) - 50 * z, a = Math.min(1, t / 0.06) * Math.max(0, 1 - Math.max(0, t - 0.2) / 0.15);   // 阴阳镜: the mirror held out beside him for a moment (its light runs along the ground: lightsGround)
        if (a > 0) W.draw(c, 'wmirror', mx, my, 0, 0.7 * z, 0.7 * z, a * veil(V, mx, my)); continue; }
      const T = Math.min(1, t / 0.18), a = Math.min(1, t / 0.04) * fade, span = Math.min(Math.PI * 2, o.ang), a0 = o.d - span / 2;
      if (o.id === 'bell') { W.draw(c, 'wbell', X, Y - 178 * z, Math.sin(t * 20) * 0.12 * (1 - T), 0.5 * z, 0.5 * z, a);   // 落魂钟: rung above his canopy (never over his figure), its toll rolls out in dry rings
        for (let r = 0; r < (o.ev ? 4 : 3); r++) { const tr = t - r * 0.09; if (tr < 0) continue; const R = o.R * (0.3 + 0.75 * Math.min(1, tr / 0.4)); ribbon(c, `wtoll_${(r + o.v) % 2}`, (s) => [V.sx(o.x + Math.cos(a0 + span * s) * R), V.sy(o.y + Math.sin(a0 + span * s) * R) - 20 * z], 0.6 * z, a * (1 - Math.min(1, tr / 0.6)), 0, 1, Math.max(6, Math.round(span * 5)), V); } continue; }
      if (o.id === 'fan') { for (let r = 0; r < 3; r++) { const R = o.R * (0.5 + 0.25 * r);           // 五火七禽扇: fire fanned out in three fronts, seven birds of fire flying out of it
          ribbon(c, `wfanfire_${(r + o.v) % 2}`, (s) => [V.sx(o.x + Math.cos(a0 + span * s) * R), V.sy(o.y + Math.sin(a0 + span * s) * R) - 10 * z], (0.5 + 0.12 * r) * z, a * (1 - r * 0.15), 0, Math.min(1, (t - r * 0.05) / 0.12), Math.max(6, Math.round(span * 5)), V); }
        for (let b = 0; b < 7; b++) { const ang = a0 + span * (b + 0.5) / 7, rr = o.R * (0.4 + 1.0 * Math.min(1, t / 0.7)), bx = V.sx(o.x + Math.cos(ang) * rr), by = V.sy(o.y + Math.sin(ang) * rr) - (60 + 30 * Math.sin(t * 9 + b)) * z;
          W.draw(c, `wbird_${b % 2}`, bx, by, Math.atan2(Math.sin(ang) * V.KY, Math.cos(ang)), (Math.cos(ang) < 0 ? -1 : 1) * 0.7 * z, 0.7 * z, a); } continue; }
      if (o.id === 'zhaoyao') { const mx = V.sx(o.x + Math.cos(o.d) * 90), my = V.sy(o.y + Math.sin(o.d) * 90) - 50 * z, am = a * Math.max(0, 1 - Math.max(0, t - 0.2) / 0.15);   // 照妖鉴: the mirror turned on them beside him for a moment; its light a fan along the ground (lightsGround)
        if (am > 0) W.draw(c, 'wmirror', mx, my, 0, 0.65 * z, 0.65 * z, am * veil(V, mx, my)); } } }
  function sealsGround(c, V) { const z = V.z;
    for (const o of news) { if (o.id !== 'seal') continue; const t = clock - o.at; if (t < 0 || t > o.delay) continue; const u = t / o.delay, k = (o.r / 80) * z * (0.4 + 0.6 * u); W.draw(c, `wscorch_${o.v}`, V.sx(o.x), V.sy(o.y), 0, k, k * 0.7, 0.15 + 0.35 * u * u); }
    for (let i = 0; i < prints.length; i++) { const o = prints[i], t = clock - o.at; if (t > 1) { prints.splice(i--, 1); continue; } const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, X = V.sx(o.x), Y = V.sy(o.y), k = (o.r / 70) * z * (o.ev ? 1.15 : 1);
      W.draw(c, `wscorch_${o.v}`, X, Y, 0, k, k * 0.8, a); W.draw(c, `wscorch_${1 - o.v}`, X, Y, 1.3, k * 0.7, k * 0.6, a * 0.8);
      for (let j = 0; j < 4; j++) { const b = j * 1.57 + o.v, d = o.r * 0.75; W.draw(c, `wcut_${j % 2}`, V.sx(o.x + Math.cos(b) * d), V.sy(o.y + Math.sin(b) * d), b, 0.6 * z, 0.35 * z, a); } } }
  function lightsGround(c, V) { for (const o of news) { const t = clock - o.at; if (t < 0 || (o.id !== 'mirror' && o.id !== 'zhaoyao')) continue; const z = V.z, end = o.id === 'mirror' ? o.life + 0.2 : 0.9, fade = Math.max(0, Math.min(1, (end - t) / 0.25)), a = Math.min(1, t / 0.06) * fade, X = V.sx(o.x), Y = V.sy(o.y);
      if (o.id === 'mirror') { const dd = o.d + o.sweep * t; W.draw(c, `wray_${o.v}`, X, Y, Math.atan2(Math.sin(dd) * V.KY, Math.cos(dd)) - Math.PI / 2, (o.w / 40) * z, (o.L / 600) * z, a * 0.8); continue; }
      const span = Math.min(Math.PI * 2, o.ang), a0 = o.d - span / 2, T = Math.min(1, t / 0.18); for (let k = 0; k < 5; k++) { const ang = a0 + span * (k + 0.5) / 5; W.draw(c, `wray_${k % 2}`, X, Y, Math.atan2(Math.sin(ang) * V.KY, Math.cos(ang)) - Math.PI / 2, 0.6 * z, (o.R / 600) * z * T, a * 0.8); } } }
  const hosts = [];
  const HOST_LIFE = { mountainWall: 2.0, thousandPoints: 0.7, skyOfArrows: 1.6, mountainThrow: 1.5, ironTide: 1.1, ironFlood: 1.1, fiveTalismans: 1.6, heavenNet: 1.2, twentyFour: 2.2 };
  function hostsDraw(c, V, layer) {
    for (let i = 0; i < hosts.length; i++) { const o = hosts[i], t = clock - o.at, L = HOST_LIFE[o.id] || 1.2; if (t > L) { if (layer === 'over') hosts.splice(i--, 1); continue; }
      const z = V.z, rise = Math.min(1, t / 0.25), out = Math.max(0, (t - L + 0.4) / 0.4), a = (1 - out), X = V.sx(o.x), Y = V.sy(o.y);
      const P = (r, ang, lift = 0) => [V.sx(o.x + Math.cos(ang) * r), V.sy(o.y + Math.sin(ang) * r) - lift * z];
      if (o.id === 'mountainWall') { if (layer === 'ground') { W.draw(c, 'whalo_gold', X, Y, 0, 1.9 * z, 1.9 * z * V.KY, a * 0.8); continue; }    // 不动如山: a ring of peaks rises round them
        for (let k = 0; k < 10; k++) { const ang = (k / 10) * TAU + 0.3, [px, py] = P(250, ang), back = Math.sin(ang) < 0; if (back) continue; W.draw(c, `wpeak_${k % 3}`, px, py + (1 - rise) * 120 * z + out * 80 * z, 0, 0.55 * z * (k % 2 ? 1 : -1), 0.55 * z * rise, a); } continue; }
      if (layer === 'ground') { if (o.id === 'mountainWall' || o.id === 'twentyFour') {} if (o.id === 'mountainWall') continue; if (o.id === 'twentyFour' || o.id === 'fiveTalismans' || o.id === 'heavenNet') W.draw(c, 'whalo_gold', X, Y, clock * 0.2, 1.6 * z, 1.6 * z * V.KY, a * 0.7);
        if (o.id === 'mountainWall' || true) { /* the back half of the peaks, behind the men */ } continue; }
      if (o.id === 'thousandPoints') { for (let k = 0; k < 21; k++) { const tk = t - k * 0.012; if (tk < 0) continue; const ang = o.d + (k / 20 - 0.5) * 1.1;   // 万刃齐发: a fan of fifteen thrusts
          ribbon(c, `wspear_${k % 2}`, (s2) => P(30 + 460 * s2, ang, 34), 1.3 * z, (1 - Math.max(0, (tk - 0.2) / 0.4)), Math.max(0, (tk - 0.16) / 0.3), Math.min(1, tk / 0.08), 6, V); } continue; }
      if (o.id === 'skyOfArrows') { const ts = o.targets && o.targets.length ? o.targets : [{ x: o.x, y: o.y }];        // 遮天箭雨: the sky dark with arrows falling into each cluster
        for (const [ti, p] of ts.entries()) for (let k = 0; k < 30; k++) { const h = ((k * 97 + ti * 31) % 100) / 100, tk = t - h * 0.7; if (tk < 0 || tk > 0.5) continue; const u = tk / 0.5, ang = (k * 2.39996), r = 150 * Math.sqrt(((k * 53) % 100) / 100);
          const ex = V.sx(p.x + Math.cos(ang) * r), ey = V.sy(p.y + Math.sin(ang) * r), sx0 = ex - 160 * z, sy0 = ey - 520 * z; W.draw(c, `warrow_${k % 2}`, sx0 + (ex - sx0) * u, sy0 + (ey - sy0) * u, Math.atan2(ey - sy0, ex - sx0), 1.25 * z, 1.25 * z, a * Math.min(1, u * 4)); } continue; }
      if (o.id === 'mountainThrow') { const u = Math.min(1, t / 1.25), r = 560 * u, [px, py] = P(r, o.d, 140 * Math.sin(Math.PI * u));   // 移山: a mountain flung
        W.draw(c, `wpeak_${o.v}`, px, py, Math.sin(t * 2) * 0.2, 0.6 * z, 0.6 * z, a); continue; }
      if (o.id === 'ironTide' || o.id === 'ironFlood') { const fire = o.id === 'ironFlood';                              // 铁流 / 铁骑: a tide rolling along the charge
        for (let k = 0; k < 3; k++) { const off = (k - 1) * 50, f0 = Math.max(0, t / 0.8 - 0.25), f1 = Math.min(1, t / 0.6); const nx = -Math.sin(o.d), ny = Math.cos(o.d);
          ribbon(c, fire ? `wfanfire_${k % 2}` : `wwave_${k % 2}`, (s2) => [V.sx(o.x + Math.cos(o.d) * 620 * s2 + nx * off), V.sy(o.y + Math.sin(o.d) * 620 * s2 + ny * off) - 8 * z], (fire ? 0.55 : 0.8) * z, a, f0, f1, 10, V); } continue; }
      if (o.id === 'fiveTalismans') { for (let k = 0; k < 5; k++) { const ang = (k / 5) * TAU + t * 2.4, r = 60 + 220 * Math.min(1, t / 0.6), [px, py] = P(r, ang, 70);   // 五雷符: five great talismans wheel out, lines of light between them
          W.draw(c, `wfu_${k % 3}`, px, py, Math.sin(t * 6 + k) * 0.2, 1.4 * z, 1.4 * z, a); const [qx, qy] = P(r, ang + TAU / 5, 70); W.draw(c, `wray_${k % 2}`, px, py, Math.atan2(qy - py, qx - px) - Math.PI / 2, 0.4 * z, (Math.hypot(qx - px, qy - py) / 600), a * 0.8); } continue; }
      if (o.id === 'heavenNet') { const R = 260 * (1 - 0.45 * Math.min(1, Math.max(0, (t - 0.3) / 0.6)));                // 天罗地网: a net of gold lines thrown over them and drawn in
        for (let k = -3; k <= 3; k++) for (const rot of [0.4, -0.4]) { const ox = k * R / 3.5; const cx = V.sx(o.x + Math.cos(rot) * ox), cy = V.sy(o.y + Math.sin(rot + Math.PI / 2) * ox * 0.6);
          W.draw(c, `wray_${(k + 3) % 2}`, cx, cy - R * z * 0.62, rot, 0.7 * z, (R * 2 * 0.62 / 600) * z * Math.min(1, t / 0.2), a); } W.draw(c, 'whalo_gold', X, Y, 0, (R / 150) * z, (R / 150) * z * V.KY, a * 0.9); continue; }
      if (o.id === 'twentyFour') { for (let k = 0; k < 24; k++) { const ang = (k / 24) * TAU, [px, py] = P(270, ang); if (Math.sin(ang) < -0.2) continue;   // 二十四: twenty-four banners stand round them
          W.draw(c, 'wflag', px, py + (1 - rise) * 60 * z, Math.sin(clock * 1.4 + k) * 0.04, 0.18 * z, 0.18 * z * rise, a); } continue; } } }
  // ---------------------------------------------------------------- SPEC-CAMPAIGN 1.11: lasting Shang ground and the hero's states
  // Ground that says "do not stand here" laid under the figures (fire: burnt ground and low flames; plague: dragged sick hair;
  // bone: 卞吉's banner and the ring it seizes within; wind: dry ink streaming down its lane; pillar: the fallen beam), dimmed
  // while the hero is dazzled. The hero's marks over him: held (the rope, or ink closing over him when swallowed), bleed
  // (drops running), dizzy (a spiral over his head), dazzled (ruled light in his eyes), weak (plague hair at his feet).
  const LAST = { fire: 1, plague: 1, bone: 1, wind: 1, pillar: 1 }, hs = (n) => { const x = Math.sin(n * 127.1 + 3.7) * 43758.5453; return x - Math.floor(x); };
  let heldHow = 'seize';
  function zoneSpots(z, n, f) { for (let k = 0; k < n; k++) { const s1 = hs(z.id * 13 + k), s2 = hs(z.id * 7 + k * 3.1);
      if (z.shape === 'lane') { const L = (z.len || 400) * (k + 0.5) / n, off = (s2 - 0.5) * (z.w || 80) * 0.8; f(z.x + Math.cos(z.dir) * L - Math.sin(z.dir) * off, z.y + Math.sin(z.dir) * L + Math.cos(z.dir) * off, k, s1); }
      else { const r = (z.r || 80) * Math.sqrt(s1) * 0.85, b = s2 * TAU; f(z.x + Math.cos(b) * r, z.y + Math.sin(b) * r, k, s1); } } }
  function lastingDraw(c, V, G, layer) { const zs = G && G.zones; if (!zs) return; const h = G.hero, dim = h && h.dazzled > 0 ? 0.35 : 1, z0 = V.z;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.dead || z.side !== 'shang' || !LAST[z.kind]) continue;
      const life = z.life || 5, t = z.t || 0, a = dim * Math.min(1, t / 0.3) * Math.max(0, Math.min(1, (life - t) / 0.6)); if (a <= 0) continue; const X = V.sx(z.x), Y = V.sy(z.y), R = z.r || 80;
      if (z.kind === 'fire') { const n = z.shape === 'lane' ? Math.max(3, Math.round((z.len || 400) / 110)) : Math.max(3, Math.round(R / 30));
        if (layer === 'ground') zoneSpots(z, n, (x, y, k) => W.draw(c, `wscorch_${k % 2}`, V.sx(x), V.sy(y), 0, 0.7 * z0, 0.7 * z0, a * 0.9));
        else zoneSpots(z, n, (x, y, k, s1) => { const f = 0.5 + 0.5 * Math.sin(clock * 9 + k * 2.3); const X1 = V.sx(x), Y1 = V.sy(y); W.draw(c, `wflame_${k % 2}`, X1, Y1, (s1 - 0.5) * 0.15, (Math.sin(clock * 5 + k) > 0 ? 1 : -1) * 0.6 * z0, (0.5 + 0.12 * f) * z0, a * 0.95 * veil(V, X1, Y1)); });
        continue; }
      if (layer !== 'ground' && z.kind !== 'bone' && z.kind !== 'wind') continue;
      if (z.kind === 'plague') { const n = Math.max(4, Math.round(R / 18)); zoneSpots(z, n, (x, y, k) => W.draw(c, `wplague_${k % 2}`, V.sx(x), V.sy(y), 0, 0.75 * z0, 0.75 * z0 * V.KY * 1.6, a * 0.95));
        ribbon(c, `wtoll_${z.id % 2}`, (s2) => [V.sx(z.x + Math.cos(s2 * TAU) * R), V.sy(z.y + Math.sin(s2 * TAU) * R)], 1.2 * z0, a * 0.6, 0, 1, 24, null); continue; }
      if (z.kind === 'pillar') { W.draw(c, 'wbeam', X, Y, (hs(z.id) - 0.5) * 0.5, (R * 3.6 / 340) * z0, 1.3 * z0, a); continue; }
      if (z.kind === 'bone') { if (layer === 'ground') ribbon(c, `wtoll_${z.id % 2}`, (s2) => [V.sx(z.x + Math.cos(s2 * TAU + clock * 0.3) * R), V.sy(z.y + Math.sin(s2 * TAU + clock * 0.3) * R)], 1.6 * z0, a * 0.75, 0, 0.92, 24, null);
        else W.draw(c, 'wbone', X, Y, Math.sin(clock * 1.3 + z.id) * 0.03, 0.62 * z0, 0.62 * z0, a * veil(V, X, Y - 120 * z0)); continue; }
      if (z.kind === 'wind' && layer === 'over') { const L = z.len || 400, w = z.w || 90, d = z.dir || 0;
        for (let k = 0; k < 6; k++) { const off = (k / 5 - 0.5) * w * 0.9, ph = (clock * 0.9 + k * 0.29) % 1, lane = (s2) => [V.sx(z.x + Math.cos(d) * L * s2 - Math.sin(d) * off), V.sy(z.y + Math.sin(d) * L * s2 + Math.cos(d) * off) - (10 + 6 * k) * z0];
          ribbon(c, `wtoll_${k % 2}`, lane, 3.6 * z0, a, Math.max(0, ph - 0.55), ph, 12, V); } } } }
  function statesDraw(c, V, G) { const h = G && G.hero; if (!h || h.fallT > 0) return; const z = V.z, X = V.sx(h.x), Y = V.sy(h.y), head = Y - 118 * z;
    if (h.held > 0) { if (heldHow === 'swallow') { const q = Math.min(1, h.held * 2); for (let k = 0; k < 2; k++) ribbon(c, `wlash_${k}`, (s2) => { const b = k * Math.PI + s2 * Math.PI * 1.15; return [X + Math.cos(b) * 62 * z, Y - 52 * z + Math.sin(b) * 70 * z]; }, 0.55 * z, q, 0, 1, 30, null); }   // 朱子真 has swallowed him: two ink strokes close round him like jaws
      else W.draw(c, `wrope_${Math.floor(clock * 3) % 2}`, X, Y - 10 * z, 0, 0.75 * z, 0.75 * z, Math.min(1, h.held * 3)); }
    if (h.bleed > 0) for (let k = 0; k < 3; k++) { const u = (clock * 0.8 + k / 3) % 1; W.draw(c, 'wdrip', X + [-34, 30, 44][k] * z, Y - (78 - 60 * u) * z, 0, 1.1 * z, 1.1 * z, Math.sin(Math.PI * u)); }
    if (h.bleed > 0) W.draw(c, 'wscorch_1', X, Y + 6 * z, 0, 0.45 * z, 0.35 * z, 0.7);
    if (h.dizzy > 0) W.draw(c, 'wswirl', X, head, 0, (Math.sin(clock * 6) > 0 ? 1 : -1) * 0.8 * z, 0.8 * z, Math.min(1, h.dizzy * 3));
    if (h.dazzled > 0) for (let k = 0; k < 3; k++) W.draw(c, `wray_${k % 2}`, X, head + 14 * z, Math.PI + (k - 1) * 0.45, 0.4 * z, 0.09 * z, Math.min(0.75, h.dazzled * 3));
    if (h.weak > 0) W.draw(c, `wplague_${Math.floor(clock * 2) % 2}`, X, Y + 4 * z, 0, 0.45 * z, 0.45 * z * V.KY * 1.6, Math.min(1, h.weak * 2)); }
  // ---------------------------------------------------------------- spoils (SPEC-CAMPAIGN 2.11): each boss's own power in the hero's hand
  // Every `spoilStrike` in brush, as its boss's own blow was, inside the readability rule: what lasts or spreads lies on the
  // ground under the figures; over them only brief marks (under 0.4 s), never over the hero.
  const spoilFx = [], swallowed = new Map(); let umbrellaR = 0;
  function spoilEvent(e) { spoilFx.push({ ...e, at: clock, v: spoilFx.length % 2 }); if (spoilFx.length > 40) spoilFx.shift(); }
  const SPOIL_LIFE = { bite: 0.4, swallow: 0.3, dive: 0.5, ring: 0.5, windfire: 0.55, leap: 0.4, call: 1.4, whips: 0.45, line: 0.35, light: 0.4, flash: 0.6, fan: 0.6, burst: 0.5, banner: 0.6, cloud: 0.5, stone: 2.2 };
  function spoilsDraw(c, V, G, layer) { const z = V.z, P = (x, y, lift = 0) => [V.sx(x), V.sy(y) - lift * z];
    for (let i = 0; i < spoilFx.length; i++) { const o = spoilFx[i], t = clock - o.at, life = o.shape === 'stone' ? (o.time || 2) + 0.2 : SPOIL_LIFE[o.shape] || 0.5; if (t > life) { if (layer === 'over') spoilFx.splice(i--, 1); continue; }
      const u = t / life, fade = 1 - Math.max(0, (u - 0.6) / 0.4), R = o.radius || 100, brief = Math.max(0, 1 - t / 0.3);
      if (o.id === 'qingyunSword') {          // 青云剑: a black wind of blades spinning out from him
        if (layer === 'ground') for (let k = 0; k < 8; k++) { const b0 = (k / 8) * TAU + t * 4; ribbon(c, `wlash_${k % 3}`, (s2) => P(o.x + Math.cos(b0 + s2 * 1.3) * (60 + R * s2), o.y + Math.sin(b0 + s2 * 1.3) * (60 + R * s2), 10), 0.9 * z, fade, Math.max(0, u * 1.6 - 0.7), Math.min(1, u * 3.5), 12, null); }
        else if (brief > 0) for (let k = 0; k < 8; k++) { const b = (k / 8) * TAU + 0.5 + t * 4, [X, Y] = P(o.x + Math.cos(b) * R * (0.5 + 0.4 * Math.min(1, t / 0.2)), o.y + Math.sin(b) * R * (0.5 + 0.4 * Math.min(1, t / 0.2)), 30); W.draw(c, `wcut_${k % 2}`, X, Y, b + 1.2, 0.75 * z, 0.75 * z, brief * veil(V, X, Y)); }
        continue; }
      if (o.id === 'jadePipa' && o.shape === 'windfire') {   // 碧玉琵琶: wind and fire come together on them
        if (layer === 'ground') { ribbon(c, `wfanfire_${o.v}`, (s2) => P(o.x + Math.cos(s2 * TAU + t * 4) * R * 0.8, o.y + Math.sin(s2 * TAU + t * 4) * R * 0.8), 0.75 * z, fade, 0, Math.min(1, u * 3), 18, V);
          for (let k = 0; k < 5; k++) { const b = (k / 5) * TAU + t * 2, [X, Y] = P(o.x + Math.cos(b) * R * 0.35, o.y + Math.sin(b) * R * 0.35); W.draw(c, `wflame_${k % 2}`, X, Y, 0, (k % 2 ? -1 : 1) * 0.55 * z, 0.5 * z * Math.min(1, u * 4), fade); }
          ribbon(c, `wtoll_${o.v}`, (s2) => P(o.x + Math.cos(s2 * TAU) * R * (0.7 + 0.6 * u), o.y + Math.sin(s2 * TAU) * R * (0.7 + 0.6 * u), 12), 0.9 * z, fade * 0.7, 0, 1, 20, V); }
        continue; }
      if (o.id === 'marten' && o.shape === 'bite') {   // the bite: three claw strokes; devoured, a splash of ink as well
        if (layer === 'over' && t < 0.35) { const [X, Y] = P(o.x, o.y, 40), q = Math.min(1, t / 0.05) * (1 - t / 0.35); for (let k = 0; k < 3; k++) W.draw(c, `wcut_${k % 2}`, X + (k - 1) * 14 * z, Y, 0.9 + k * 0.08, 0.6 * z, 0.6 * z, q * veil(V, X, Y)); }
        else if (layer === 'ground' && o.devour) W.draw(c, `wscorch_${o.v}`, V.sx(o.x), V.sy(o.y), 0, 0.6 * z, 0.5 * z, fade);
        continue; }
      if (o.id === 'marten') {                 // 花狐貂's leap: a swift dry stroke to the foe, then the bite (its body is the figures')
        if (layer === 'over') { const [X0, Y0] = P(o.fromX ?? o.x, o.fromY ?? o.y, 40), [X1, Y1] = P(o.x, o.y, 40); if (t < 0.2) ribbon(c, `wlash_${o.v}`, (s2) => [X0 + (X1 - X0) * s2, Y0 + (Y1 - Y0) * s2 - Math.sin(s2 * Math.PI) * 60 * z], 0.7 * z, 1 - 0.5 * t / 0.2, Math.max(0, t / 0.2 - 0.5), Math.min(1, t / 0.08), 10, V);
          }
        continue; }
      if (o.id === 'callName') {               // 呼名落马: his name called, rings of sound on the one named
        const f = foeOf(G, o.target), x = f ? f.x : o.x, y = f ? f.y : o.y;
        if (layer === 'ground') { const q = Math.min(1, t / 0.1); ribbon(c, `wlash_${o.v}`, (s2) => P(x + Math.cos(s2 * TAU * 0.92 + o.v) * 46, y + Math.sin(s2 * TAU * 0.92 + o.v) * 46), 0.7 * z, fade, 0, q, 18, null); }   // his name has fallen on him
        if (layer === 'ground') for (let r = 0; r < 3; r++) { const tr = t - r * 0.12; if (tr < 0) continue; const q = Math.min(1, tr / 0.45), rr = 30 + (R - 30) * q; ribbon(c, `wtoll_${(r + o.v) % 2}`, (s2) => P(x + Math.cos(s2 * TAU) * rr, y + Math.sin(s2 * TAU) * rr), 3.6 * z, 1 - q * q, 0, 1, 24, V); }
        else if (t < 0.45) { const q = t / 0.45; ribbon(c, `wtoll_${o.v}`, (s2) => P(x + Math.cos(s2 * TAU) * (26 + 30 * q), y + Math.sin(s2 * TAU) * (26 + 40 * q), 70), 3.4 * z, (1 - q) * veil(V, V.sx(x), V.sy(y) - 70 * z), 0, 1, 16, null); }
        continue; }
      if (o.id === 'goldWhips') {              // 雌雄金鞭: two gold whips fall on the strongest and leap on
        for (const tg of o.targets || []) { const [X, Y] = P(tg.x, tg.y);
          if (layer === 'ground') { if (!tg.chain) { W.draw(c, 'whalo_gold', X, Y, o.v, 0.5 * z, 0.5 * z * V.KY, fade); for (let k = 0; k < 4; k++) W.draw(c, `wcut_${k % 2}`, X, Y, k * 1.57 + o.v, 0.45 * z, 0.25 * z, fade * 0.9); } else W.draw(c, 'whalo_gold', X, Y, 0, 0.25 * z, 0.25 * z * V.KY, fade * 0.8); continue; }
          if (tg.chain) { if (t < 0.25) { const src = (o.targets || []).find((q) => !q.chain) || tg, [X0, Y0] = P(src.x, src.y, 40); ribbon(c, `wringt_0`, (s2) => [X0 + (X - X0) * s2, Y0 + (Y - 40 * z - Y0) * s2 - Math.sin(s2 * Math.PI) * 40 * z], 0.3 * z, 1 - t / 0.25, 0, Math.min(1, t / 0.1), 6, V); } continue; }
          if (t < 0.3) { const q = Math.min(1, t / 0.08); W.draw(c, `wray_${o.v}`, X, Y - 20 * z, Math.PI, 1.3 * z, (0.7 * q) * z, (1 - t / 0.3) * veil(V, X, Y)); } }
        continue; }
      if (o.id === 'hunyuanUmbrella' && o.shape === 'light') {   // every eighth shot it swallowed comes back as light on them
        if (layer === 'ground') W.draw(c, 'whalo_gold', V.sx(o.x), V.sy(o.y), 0, (R / 150) * z * (0.7 + 0.5 * u), (R / 150) * z * V.KY * (0.7 + 0.5 * u), fade);
        else if (brief > 0) for (let k = 0; k < 5; k++) W.draw(c, `wray_${k % 2}`, V.sx(o.x), V.sy(o.y) - 30 * z, (k / 5) * TAU, 0.6 * z, 0.3 * z, brief);
        continue; }
      if (o.id === 'hunyuanUmbrella' && o.shape === 'swallow') { if (layer === 'over') { const [X, Y] = P(o.x, o.y, 30), q = 1 - t / 0.3; W.draw(c, 'wswirl', X, Y, t * 12, 0.5 * z * q, 0.5 * z * q, q); } continue; }   // a shot twisted into the umbrella's dark
      if (o.id === 'earthTravel' && o.shape === 'dive') { if (layer === 'ground') { W.draw(c, `wscorch_${o.v}`, V.sx(o.x), V.sy(o.y), 0, 0.7 * z * (1 - 0.4 * u), 0.55 * z * (1 - 0.4 * u), fade); W.draw(c, 'wmound', V.sx(o.x), V.sy(o.y), 0, 0.8 * z, 0.8 * z * (1 - u), fade); } continue; }   // he goes under: the earth closes over him
      if (o.id === 'bloodBlade') {             // 化血神刀: one flash of the blade down the line (the bleeding: bleedDraw)
        if (layer === 'ground') { const L = o.length || 420; ribbon(c, `wthrust_${o.v}`, (s2) => P(o.x + Math.cos(o.dir) * L * s2, o.y + Math.sin(o.dir) * L * s2), 0.5 * z, fade * 0.8, Math.max(0, u * 1.4 - 0.4), Math.min(1, t / 0.06), 8, null); }   // the cut it leaves on the ground, deep cinnabar
        if (layer === 'over' && t < 0.25) { const L = o.length || 420, [X0, Y0] = P(o.x, o.y, 40); ribbon(c, `wcut_${o.v}`, (s2) => [X0 + Math.cos(o.dir) * L * z * s2, Y0 + Math.sin(o.dir) * L * z * V.KY * s2], 1.1 * z, 1 - t / 0.25, Math.max(0, t / 0.25 - 0.3), Math.min(1, t / 0.06), 8, V); }
        continue; }
      if (o.id === 'yellowBreath') {           // 陈奇's 哈: the ring of breath takes their souls (the ring itself: breathDraw)
        if (layer === 'ground') ribbon(c, `wtoll_${o.v}`, (s2) => P(o.x + Math.cos(s2 * TAU) * R * (0.5 + 0.6 * u), o.y + Math.sin(s2 * TAU) * R * (0.5 + 0.6 * u)), 3 * z, fade, 0, 1, 24, null);
        continue; }
      if (o.id === 'goldenCrown') {            // 金霞冠: it blazes; all near are blind
        if (layer === 'ground') { const k = (R / 190) * z * (0.3 + 0.9 * Math.min(1, u * 1.6)); W.draw(c, 'whalo_gold', V.sx(o.x), V.sy(o.y), 0, k, k * V.KY, fade * 0.7); }
        else if (t < 0.25) for (let k = 0; k < 10; k++) { const b = (k / 10) * TAU, [X, Y] = P(o.x + Math.cos(b) * 120, o.y + Math.sin(b) * 120, 30); W.draw(c, `wray_${k % 2}`, X, Y, Math.atan2(Math.sin(b) * V.KY, Math.cos(b)) - Math.PI / 2, 0.3 * z, 0.3 * z, (1 - t / 0.25) * 0.8); }
        continue; }
      if (o.id === 'fiveLights') {             // 孔宣's five-coloured light: a fan of five pigments sweeping out toward the mass
        if (layer !== 'ground') continue; const span = ((o.angle || 140) * Math.PI) / 180, a0 = (o.dir || 0) - span / 2, CELLS = ['wtoll_0', 'wwave_0', 'wthrust_0', 'wtoll_1', 'wringt_0'];
        for (let k = 0; k < 5; k++) { const rr = R * (0.35 + 0.15 * k), sweep = Math.min(1, u * 2.2 - k * 0.08); if (sweep <= 0) continue; ribbon(c, k === 3 ? 'wtoll_1' : CELLS[k], (s2) => P(o.x + Math.cos(a0 + span * s2) * rr, o.y + Math.sin(a0 + span * s2) * rr), [3.2, 1, 1, 3.2, 0.4][k] * z, fade, 0, sweep, 16, null); }
        continue; }
      if (o.id === 'earthTravel') {            // 张奎's earth bursts where he comes up
        if (layer === 'ground') { W.draw(c, `wscorch_${o.v}`, V.sx(o.x), V.sy(o.y), 0, (R / 60) * z, (R / 60) * z, fade); W.draw(c, `wscorch_${1 - o.v}`, V.sx(o.x), V.sy(o.y), 1.2, (R / 80) * z, (R / 80) * z, fade); W.draw(c, 'wmound', V.sx(o.x), V.sy(o.y), 0, 1.1 * z, 1.1 * z * Math.max(0, 1 - u * 1.5), fade); for (let k = 0; k < 5; k++) { const b = (k / 5) * TAU + o.v, [X, Y] = P(o.x + Math.cos(b) * R * 0.6, o.y + Math.sin(b) * R * 0.6); W.draw(c, `wcut_${k % 2}`, X, Y, b, 0.8 * z, 0.5 * z, fade); } }
        continue; }
      if (o.id === 'changeForm') {             // 八九玄功: turned to stone a moment; a ring of dry ink and ochre holds round him
        if (layer === 'ground') ribbon(c, `wtoll_${o.v}`, (s2) => P(o.x + Math.cos(s2 * TAU) * 60, o.y + Math.sin(s2 * TAU) * 70), 3.4 * z, fade, 0, Math.min(1, u * 8), 24, null); W.draw(c, `wscorch_${o.v}`, V.sx(o.x), V.sy(o.y), 0, 0.6 * z, 0.45 * z, fade * 0.7);
        continue; }
    }
    // what stays: the umbrella open round him (shots it swallows twist into ink), the pipa's burning ground, the plague cloud, the
    // bone banner, the yellow breath round him, the bleeding of those the blade cut, the mound of the one under the earth
    const sp = G && G.build && G.build.spoils, h = G && G.hero; if (!sp || !h) return; const has = (id) => sp.some((q) => q.id === id), entry = (id) => sp.find((q) => q.id === id);
    const HX = V.sx(h.x), HY = V.sy(h.y), under = (entry('earthTravel') || {}).under;
    if (layer === 'ground') {
      // behind him (the figures are drawn over these): the five-coloured light, 青云剑 and the jade lute at his back, the clear wind trailing
      if (!under) { if (has('fiveLights')) W.draw(c, 'wfive', HX, HY + 4 * z, 0, 0.75 * z, 0.75 * z, 0.6 + 0.1 * Math.sin(clock * 2));
        // 青云剑 and the jade lute slung behind him: drawn before the figures, their ends showing past him
        if (has('qingyunSword')) W.draw(c, 'wsword', HX - 30 * z, HY - 20 * z, -0.35, 0.5 * z, 0.5 * z, 0.95);
        if (has('jadePipa')) W.draw(c, 'wpipa', HX + 34 * z, HY - 24 * z, 0.45, 0.45 * z, 0.45 * z, 0.95);
        if (has('changeForm')) { const sp2 = Math.hypot(h.vx || 0, h.vy || 0); if (sp2 > 20) { const bx = -(h.vx || 0) / sp2, by = -(h.vy || 0) / sp2; for (let k = 0; k < 3; k++) ribbon(c, `wtoll_${k % 2}`, (s2) => P(h.x + bx * (30 + 170 * s2) + (k - 1) * 14 * -by, h.y + by * (30 + 170 * s2) + (k - 1) * 14 * bx, 30 + 12 * k), 1.4 * z, 0.55 - 0.12 * k, 0, 1, 8, null); } } }
      if (has('hunyuanUmbrella')) { umbrellaR = (entry('hunyuanUmbrella').radius) || 170; ribbon(c, 'wtoll_1', (s2) => P(h.x + Math.cos(s2 * TAU + clock * 0.4) * umbrellaR, h.y + Math.sin(s2 * TAU + clock * 0.4) * umbrellaR), 2 * z, 0.5, 0, 0.94, 24, null); }
      if (has('yellowBreath')) for (let k = 0, R2 = (entry('yellowBreath').radius || 150) * 0.93; k < 10; k++) { const b = (k / 10) * TAU + clock * 0.3, [X, Y] = P(h.x + Math.cos(b) * R2, h.y + Math.sin(b) * R2); W.draw(c, `wplague_${k % 2}`, X, Y, b, 0.6 * z, 0.6 * z * V.KY * 1.6, 1); }
      for (const zn of G.zones || []) { if (zn.dead || zn.side !== 'zhou') continue; const a = Math.min(1, (zn.t || 0) / 0.3) * Math.max(0, Math.min(1, ((zn.life || 3) - (zn.t || 0)) / 0.5)); if (a <= 0) continue;
        if (zn.src === 'jadePipa') { for (let k = 0; k < 4; k++) { const b = hs(zn.id + k) * TAU, r = zn.r * 0.6 * Math.sqrt(hs(zn.id * 3 + k)), [X, Y] = P(zn.x + Math.cos(b) * r, zn.y + Math.sin(b) * r); W.draw(c, `wscorch_${k % 2}`, X, Y, 0, 0.6 * z, 0.6 * z, a * 0.8); W.draw(c, `wflame_${k % 2}`, X, Y, 0, (Math.sin(clock * 5 + k) > 0 ? 1 : -1) * 0.45 * z, 0.4 * z, a * 0.85); } }
        else if (zn.src === 'plague') { ribbon(c, `wtoll_${zn.id % 2}`, (s2) => P(zn.x + Math.cos(s2 * TAU) * zn.r, zn.y + Math.sin(s2 * TAU) * zn.r), 1.6 * z, a * 0.8, 0, 1, 24, null); const n = Math.max(7, Math.round(zn.r / 14)); for (let k = 0; k < n; k++) { const b = hs(zn.id + k) * TAU, r = zn.r * 0.85 * Math.sqrt(hs(zn.id * 5 + k)), [X, Y] = P(zn.x + Math.cos(b) * r, zn.y + Math.sin(b) * r); W.draw(c, `wplague_${k % 2}`, X, Y, 0, 0.8 * z, 0.8 * z * V.KY * 1.6, a); } }
        else if (zn.src === 'boneBanner') ribbon(c, `wtoll_${zn.id % 2}`, (s2) => P(zn.x + Math.cos(s2 * TAU + clock * 0.3) * zn.r, zn.y + Math.sin(s2 * TAU + clock * 0.3) * zn.r), 2 * z, a * 0.8, 0, 0.92, 22, null);
        }
      return; }
    // over: the banner standing beside him (a thin pole and a pale cloth, clear of him), the shots the umbrella swallows, the bleeding
    for (const zn of G.zones || []) if (!zn.dead && zn.src === 'boneBanner' && zn.side === 'zhou') { const [X, Y] = P(zn.x + 95, zn.y - 20), a = Math.min(1, (zn.t || 0) / 0.2) * Math.max(0, Math.min(1, ((zn.life || 7) - (zn.t || 0)) / 0.4)); W.draw(c, 'wbone', X, Y, Math.sin(clock * 1.3) * 0.03, 0.55 * z, 0.55 * z, a * 0.9); }
    // over him, clear of his body: the umbrella open above his head, the crown on it; under the earth, the mound he is
    if (under) W.draw(c, 'wmound', HX, HY, 0, 0.75 * z, 0.75 * z * (0.9 + 0.1 * Math.sin(clock * 14)), 1);
    // (what is attached to him is an open form above his canopy or under him, never over his figure: tester round 2)
    else { if (has('hunyuanUmbrella')) W.draw(c, 'wumbrella', HX, HY - 150 * z, Math.sin(clock * 1.1) * 0.04, 0.5 * z, 0.5 * z, 0.92);
      if (has('goldenCrown')) W.draw(c, 'wcrown', HX, HY - (has('hunyuanUmbrella') ? 236 : 158) * z, 0, 0.4 * z, 0.4 * z, 0.95); }
    for (const f of G.foes || []) if (f.burnSrc === 'bloodBlade' && f.burnT > 0 && f.state !== 'dead') { const [X, Y] = P(f.x, f.y), q = (clock * 0.9 + (f.id % 7) / 7) % 1; W.draw(c, 'wdrip', X + 10 * z, Y - (60 - 40 * q) * z, 0, 0.8 * z, 0.8 * z, Math.sin(Math.PI * q) * 0.9); }
  }
  const foeOf = (G, id) => { const fs = G && G.foes; if (fs && id != null) for (let i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i]; return null; };
  // ---------------------------------------------------------------- the first stretch's boss patterns
  const BOSS_SIG = { blackWind: 1, fireSnakes: 1, pearlRing: 1, fourStrings: 1, windFire: 1, lunge: 1, qilinRush: 1, qilinReturn: 1 }, sigs = [];
  function sigsDraw(c, V) {
    for (let i = 0; i < sigs.length; i++) { const o = sigs[i], t = clock - o.at; if (t > 0.7) { sigs.splice(i--, 1); continue; }
      const z = V.z, a = 1 - Math.max(0, (t - 0.3) / 0.4), to = Math.min(1, t / 0.12), from = Math.max(0, (t - 0.25) / 0.45), P = (r, b, lift = 0) => [V.sx(o.x + Math.cos(b) * r), V.sy(o.y + Math.sin(b) * r) - lift * z];
      if (o.id === 'blackWind') { for (let k = 0; k < 5; k++) { const b = o.d + (k / 4 - 0.5) * o.ang;      // 魔礼青's black wind: dry ink fanning out the cone, sword cuts carried in it
          ribbon(c, `wtoll_${k % 2}`, (s2) => P(30 + o.R * s2, b + Math.sin(s2 * 6 + k) * 0.05, 20), 1.6 * z, a, from, to, 8, V); }
        for (let k = 0; k < 4; k++) { const [px, py] = P(o.R * (0.35 + 0.15 * k), o.d + (k - 1.5) * o.ang * 0.25, 20); W.draw(c, `wcut_${k % 2}`, px, py, 0, 0.7 * z, 0.7 * z, a * to); } continue; }
      if (o.id === 'fireSnakes') { ribbon(c, `wthrust_${o.v}`, (s2) => P(o.R * (1.1 - 0.5 * s2), s2 * TAU * 1.1 + o.v * 3, 8), 0.35 * z, a, from, to, 14, V); continue; }   // a snake of fire: one cinnabar stroke coiling in to where it strikes
      if (o.id === 'pearlRing') { const r = o.r0 + (o.R - o.r0) * Math.min(1, t / 0.3); for (let k = 0; k < 12; k++) { const [px, py] = P(r * (0.94 + 0.12 * ((k * 7) % 5) / 4), (k / 12 + 0.02 * Math.sin(k * 5)) * TAU, 22); W.draw(c, 'wpearl', px, py, 0, 1.1 * z, 1.1 * z, a); } continue; }   // 混元珍珠伞's pearls fly out
      if (o.id === 'fourStrings') { const R = (o.r0 + o.R) / 2 || o.R; const b0 = o.gap ? o.d + o.gap : o.v, sp = o.gap ? TAU - 2 * o.gap : TAU; ribbon(c, `wtoll_${o.v}`, (s2) => P(R * (1 + 0.04 * Math.sin(s2 * 19)), b0 + s2 * sp), 3.6 * z, 1 * a, 0, to, 28, V); continue; }   // the band open on the far side (SPEC 1.15)   // 碧玉琵琶: a string plucked: a ring of sound in dry ink with an ochre hair
      const nx = -Math.sin(o.d), ny = Math.cos(o.d), lane = (off, lift) => (s2) => [V.sx(o.x + Math.cos(o.d) * o.L * s2 + nx * off), V.sy(o.y + Math.sin(o.d) * o.L * s2 + ny * off) - lift * z];
      if (o.id === 'windFire') { ribbon(c, `wfanfire_${o.v}`, lane(0, 6), 0.6 * z, a, from, to, 10, V); for (const off of [-o.w * 0.4, o.w * 0.4]) ribbon(c, `wtoll_${o.v}`, lane(off, 30), 1.4 * z, a, from, to, 10, V); continue; }   // 魔礼海's wind and fire
      for (let k = 0; k < 3; k++) { const off = (k - 1) * o.w * 0.35, wob = (s2) => { const p = lane(off + Math.sin(s2 * 7 + k * 2) * o.w * 0.12, 4 + 10 * k)(s2); return p; }; ribbon(c, `wtoll_${(k + o.v) % 2}`, wob, (o.id === 'lunge' ? 2 : 2.8) * z, a * (1 - 0.15 * k), Math.max(from, k * 0.08), to, 12, V); }   // a charge: the ink wake it tears along the ground (闻仲's qilin, the marten)
    } }
  // ---------------------------------------------------------------- the generals
  const GEN_EL = { nezha: 'fire', yangjian: 'metal', leizhenzi: 'wood', tuxingsun: 'earth', dengchanyu: 'earth', huangfeihu: 'metal' }, HALO = { fire: 'whalo_fire', water: 'whalo_water' };
  const manifests = [], dives = [], tracks = new Map();
  const genUnit = (G, id) => { const as = G && G.allies; if (as) for (const a of as) if (a.kind === 'general' && a.general === id && a.state !== 'dead') return a; return null; };
  function generalsDraw(c, V, G, layer) { const z = V.z, as = (G && G.allies) || [];
    for (const a of as) { if (a.kind !== 'general' || a.state === 'dead') continue; const X = V.sx(a.x), Y = V.sy(a.y), el = GEN_EL[a.general] || 'metal';
      // 哪吒 rides the wind-fire wheels: his path burns behind him (in his true form, wider and longer)
      if (a.general === 'nezha') { let tr = tracks.get(a.id); if (!tr) tracks.set(a.id, (tr = [])); const last = tr[tr.length - 1]; if (layer === 'ground' && (!last || Math.hypot(a.x - last[0], a.y - last[1]) > 14)) { tr.push([a.x, a.y, clock]); }
        while (tr.length && clock - tr[0][2] > 0.8) tr.shift();      // (in his true form no longer: the wide burning comb read as a heap; gods.js paints the form)
        if (layer === 'ground' && tr.length > 2) { const n = tr.length, life = 0.8;
          for (const side of [-1, 1]) ribbon(c, `wfanfire_${side > 0 ? 1 : 0}`, (s2) => { const q = tr[Math.min(n - 1, Math.floor(s2 * (n - 1)))], q2 = tr[Math.min(n - 1, Math.floor(s2 * (n - 1)) + 1)], dx = q2[0] - q[0], dy = q2[1] - q[1], l = Math.hypot(dx, dy) || 1; return [V.sx(q[0] - dy / l * 12 * side), V.sy(q[1] + dx / l * 12 * side)]; }, 0.3 * z, Math.min(1, (clock - tr[0][2]) / life + 0.2), 0, 1, Math.min(24, n), V); } }
      // 雷震子 in his true form: the storm goes with him, strokes of wind wheeling round him
      if (a.general === 'leizhenzi' && a.trueForm && layer === 'ground') for (let k = 0; k < 3; k++) { const b0 = clock * 2.6 + k * 2.1, R = 150; ribbon(c, `wtoll_${k % 2}`, (s2) => { const b = b0 + s2 * 1.6; return [V.sx(a.x + Math.cos(b) * R * (0.8 + 0.2 * s2)), V.sy(a.y + Math.sin(b) * R * (0.8 + 0.2 * s2)) - (30 + 40 * s2) * z]; }, 1.2 * z, 0.85, 0, 1, 10, V); }
      // a true form stands on an aureole: a wash ring with a broken edge and fine rays, behind him
      if (a.trueForm && layer === 'ground') W.draw(c, HALO[el] || 'whalo_gold', X, Y - 70 * z, clock * 0.15, 0.9 * z, 0.9 * z, 0.55); }
    if (layer !== 'over') return;
    // 显圣: the moment: the aureole opens behind him, huge, and rays of his light stand round it
    for (let i = 0; i < manifests.length; i++) { const m = manifests[i], t = clock - m.at; if (t > 3) { manifests.splice(i--, 1); continue; }
      const u = genUnit(G, m.gen), x = u ? u.x : m.x, y = u ? u.y : m.y, X = V.sx(x), Y = V.sy(y) - 110 * z, open = Math.min(1, t / 0.5), e2 = open * open * (3 - 2 * open), a = Math.min(1, (3 - t) / 0.8);
      W.draw(c, HALO[m.el] || 'whalo_gold', X, Y, t * 0.2, (0.6 + 1.5 * e2) * z, (0.6 + 1.5 * e2) * z, a * 0.85);
      for (let k = 0; k < 12; k++) { const ang = (k / 12) * TAU + t * 0.1; W.draw(c, `wray_${k % 2}`, X, Y, ang, 0.5 * z, (0.3 + 0.55 * e2) * z, a * 0.7); } }
    // 雷震子's dive: wind streaming along it, and where it strikes, a crack of thunder in his light (impact, from glfx)
    for (let i = 0; i < dives.length; i++) { const d = dives[i], t = clock - d.at; if (t > 0.7) { dives.splice(i--, 1); continue; }
      const to = Math.min(1, t / 0.12), from = Math.max(0, (t - 0.2) / 0.5); for (let k = -1; k <= 1; k++) { const nx = -Math.sin(d.d) * k * 30, ny = Math.cos(d.d) * k * 30;
        ribbon(c, `wtoll_${(k + 1) % 2}`, (s2) => [V.sx(d.x + Math.cos(d.d) * d.L * s2 + nx), V.sy(d.y + Math.sin(d.d) * d.L * s2 + ny) - (60 * (1 - s2) + 20) * z], 1.4 * z, 1 - from, from, to, 10, V); } } }
  // 捆仙绳: the rope wound round each one it holds (the rules' bind zones)
  function ropesDraw(c, V, G) { const zs = G && G.zones; if (!zs) return; for (const z of zs) { if (z.dead || z.kind !== 'bind' || z.src !== 'rope' || z.shape === 'lane') continue; const k = ((z.r || 30) / 40) * V.z, a = Math.min(1, (z.t || 0) / 0.1) * Math.min(1, ((z.life || 1) - (z.t || 0)) / 0.2);
      W.draw(c, `wrope_${z.id % 2}`, V.sx(z.x), V.sy(z.y), 0, k, k, a); } }
  const WEAPON_SHOTS = { bow: 1, zhentian: 1 };
  function blowsDraw(c, V) {
    for (let i = 0; i < blows.length; i++) { const o = blows[i], t = clock - o.at, slow = o.kind === 'cleave' ? 1.15 : 1; if (t > 0.36 * slow) { blows.splice(i--, 1); continue; }   // over the figures for under 0.4 s
      if (o.tip === undefined) { const tp = tipFn ? tipFn() : null; o.tip = tp && isFinite(tp.tipX) && !(tp.since > 0.1) ? [tp.tipX, tp.tipY] : null; }
      const to = Math.min(1, t / (0.07 * slow)), from = Math.max(0, (t - 0.1 * slow) / (0.26 * slow)), a = 1 - from * 0.6;
      if (o.kind === 'line') { const s0 = 40, E = [V.sx(o.x + Math.cos(o.d) * o.L), V.sy(o.y + Math.sin(o.d) * o.L) - 34 * V.z]; ribbon(c, `wspear_${o.v}`, o.tip ? (s) => [o.tip[0] + (E[0] - o.tip[0]) * s, o.tip[1] + (E[1] - o.tip[1]) * s] : (s) => [V.sx(o.x + Math.cos(o.d) * (s0 + (o.L - s0) * s)), V.sy(o.y + Math.sin(o.d) * (s0 + (o.L - s0) * s)) - 34 * V.z], (o.ev ? 0.95 : 0.75) * o.k * V.z, a, from, to, 6, V); continue; }
      const span = Math.min(Math.PI * 2, o.ang), a0 = o.d - o.turn * span / 2, R = o.R * (o.kind === 'lash' ? 0.9 : 1);
      const P0 = (s) => { const b = a0 + o.turn * span * s, r = R * (o.kind === 'lash' ? 0.75 + 0.25 * s : 1); return [V.sx(o.x + Math.cos(b) * r), V.sy(o.y + Math.sin(b) * r) - (30 + (o.kind === 'lash' ? 16 * Math.sin(s * 9) : 0)) * V.z]; };
      const P = o.tip ? (s) => { const q = P0(s), w = Math.max(0, 1 - s / 0.2); return [q[0] + (o.tip[0] - q[0]) * w, q[1] + (o.tip[1] - q[1]) * w]; } : P0;      // it leaves from the weapon's tip and runs into the swing
      const name = o.kind === 'cleave' ? `wcleave_${o.v}` : o.kind === 'lash' ? `wlash_${o.v}` : `wsweep_${o.v}`, k = (o.kind === 'cleave' ? 0.85 : o.kind === 'lash' ? 0.6 : 0.7) * (o.ev ? 1.2 : 1) * V.z;
      ribbon(c, name, P, k, a, from, to, Math.max(8, Math.round(span * 6)), V); } }
  function arrowsDraw(c, V, G) { const ss = G && G.shots; if (!ss) return;
    for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.dead || s.side === 'shang' || !WEAPON_SHOTS[s.kind]) continue; const vx = (s.x - s.px) * V.z, vy = (s.y - s.py) * V.KY * V.z;
      const X = V.sx(s.x), Y = V.sy(s.y) - 30 * V.z, k = (s.kind === 'zhentian' ? 0.85 : 0.65) * V.z; W.draw(c, `warrow_${s.kind === 'zhentian' ? 1 : 0}`, X, Y, Math.atan2(vy, vx), k, k, veil(V, X, Y) * 0.5 + 0.5); } }
  // ---------------------------------------------------------------- 九龙神火罩
  function watchCovers(G) { const zs = G && G.zones; if (zs) for (const z of zs) { if (z.dead || z.src !== 'fireCover' || z.kind !== 'burn') continue; let o = covers.get(z.id);
      if (!o) { covers.set(z.id, (o = { born: clock, gone: -1, ev: !!z.evolved, lv: z.level || 1, x: z.x, y: z.y, r: z.r || 78 }));
        if (ink) ink.bloom({ x: z.x, y: z.y, w: (z.r || 78) * 4.2, splats: RING_SCRIPT, pigment: 'fire', life: 6, dry: [1.2, 2.4], sink: 3.6, hero: true }); }
      o.x = z.x; o.y = z.y; o.r = z.r || o.r; o.seen = frame; }
    for (const [id, o] of covers) { if (o.seen !== frame && o.gone < 0) { o.gone = clock; if (ink) ink.bloom({ x: o.x, y: o.y - o.r * 1.2, w: o.r * 5, splats: BREAK_SCRIPT, pigment: 'fire', life: 5, dry: [1, 2], sink: 3, hero: true }); }
      if (o.gone >= 0 && clock - o.gone > 0.9) covers.delete(id); } }
  // the hero's patch (DESIGN.md 6): the player's own effects thin to a quarter over him, whole again by twice that
  function veil(V, X, Y) { const H = V.hero; if (!H || H[0] < -1e4) return 1; const dx = (X - H[0]) / (70 * V.z), dy = (Y - (H[1] - 60 * V.z)) / (95 * V.z), d = Math.sqrt(dx * dx + dy * dy); return d >= 2 ? 1 : d <= 1 ? 0.06 : 0.06 + 0.94 * (d - 1); }   // the space round the hero stays clear (the lead, 2026-11-25)
  // how many come: 3 + its level, nine when evolved (DESIGN.md 7: 「現出九條火龍」 is the treasure at its height)
  const count = (o) => (o.ev ? 9 : Math.min(8, 3 + (o.lv || 1)));
  // dragon j of a cover: where its body runs (tail s = 0 to head s = 1) in device px, how much of it is drawn, its alpha
  function dragon(o, j, V) {
    const t = clock - o.born, inU = Math.min(1, t / 0.7), outU = o.gone >= 0 ? Math.min(1, (clock - o.gone) / 0.9) : 0, sp = o.ev ? 1.7 : 1.25;
    const tier = j % 3, dir = tier === 1 ? -1 : 1, size = (o.ev ? 0.62 : 0.5) * (1 - 0.12 * tier) * o.r / 100;
    const R = o.r * (o.ev ? 1.9 : 1.6) * (1 - 0.24 * tier) * (1 + (1 - inU) * 1.4 + outU * 0.8), bodyLen = 470 * size, span = Math.min(1.6, bodyLen / R);
    const b = ((j / 3) | 0) * (TAU / 3) + tier * 1.05 + dir * (t * sp + (1 - inU) * 2.2), lift0 = 46 + tier * (o.ev ? 120 : 96) + (1 - inU) ** 2 * 700 + outU * outU * 800;
    const P = (s) => { const a = b - dir * span * (1 - s), lift = lift0 + 22 * Math.sin(a * 2 + j) + (1 - s) * 18; return [V.sx(o.x + Math.cos(a) * R), V.sy(o.y + Math.sin(a) * R) - lift * V.z]; };
    const back = Math.sin(b) < -0.15; return { P, size, back, shown: [Math.min(1, outU * 1.3), 1], from: 1 - inU, a: Math.min(1, t / 0.15) * (1 - outU * outU) * (back ? 0.55 : 1), v: j % 3, hv: j % 2 };   // the far side paler, as if behind smoke
  }
  function drawDragon(c, d, V) {
    const k = d.size * V.z, last = ribbon(c, `wdrg_${d.v}`, d.P, k, d.a, Math.max(d.from, d.shown[0]), 1, 12, V);
    if (last && d.from < 0.999) { const [p, rot, ky] = last; W.draw(c, `wdrg_head_${d.hv}`, p[0], p[1], rot, k * 0.72, ky * 0.72, d.a * veil(V, p[0], p[1])); }
  }
  function coverGround(c, V) { for (const o of covers.values()) { const t = clock - o.born, outU = o.gone >= 0 ? Math.min(1, (clock - o.gone) / 0.9) : 0, a = Math.min(1, t / 0.4) * (1 - outU), X = V.sx(o.x), Y = V.sy(o.y), k = o.r * (o.ev ? 1.6 : 1.3) / 160 * V.z * (0.92 + 0.08 * Math.min(1, t / 0.6));
      W.draw(c, 'whalo_fire', X, Y, 0, k, k * V.KY, a * 0.85);
      for (let j = 0; j < count(o); j++) { const d = dragon(o, j, V); if (d.back) drawDragon(c, d, V); } } }
  function coverOver(c, V, ground = false) { if (!ground) return; for (const o of covers.values()) {   // a lasting dome: all of it under the figures (the tester's cover check)
 const t = clock - o.born, outU = o.gone >= 0 ? Math.min(1, (clock - o.gone) / 0.9) : 0;
      for (let j = 0; j < count(o); j++) { const d = dragon(o, j, V); if (!d.back) drawDragon(c, d, V); }
      // pale 祥云 the dragons are half lost in, drifting slowly across the dome
      for (let i = 0; i < 3; i++) { const k = o.r / 120 * V.z * (o.ev ? 1.2 : 1), dx = ((i - 1) * 1.3 + Math.sin(t * 0.4 + i) * 0.2) * o.r, lift = (60 + i * 70) * V.z;
        W.draw(c, `wcloud_${2 + (i % 2)}`, V.sx(o.x + dx), V.sy(o.y + (i - 1) * o.r * 0.4) - lift, 0, (i % 2 ? -k : k), k, Math.min(1, t / 0.5) * (1 - outU) * 0.9); } } }
  // ---------------------------------------------------------------- 乾坤圈
  // the ring flies low, a thin gold circle the size of what it hits (a figure and a half), under the figures; each foe it strikes
  // gets one quick thin flash over him, gone in 0.35 s. Many rings read as many quick flashes, never as stacked discs.
  const ringHits = [];
  function ringsGround(c, V, G) { const ss = G && G.shots; if (!ss) return;
    for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.dead || s.side === 'shang' || s.kind !== 'ring') continue;
      const X = V.sx(s.x), Y = V.sy(s.y) - 14 * V.z, k = 1.1 * V.z, vx = (s.x - s.px) * V.z, vy = (s.y - s.py) * V.KY * V.z, sp = Math.hypot(vx, vy);
      if (sp > 0.5) { const rot = Math.atan2(vy, vx), kx = k * Math.min(0.9, 0.3 + sp / (10 * V.z)); W.draw(c, `wring_trail_${i % 2}`, X - Math.cos(rot) * 230 * kx, Y - Math.sin(rot) * 230 * kx, rot, kx, k * 0.3, 0.55); }
      W.draw(c, `wringt_${i % 2}`, X, Y, clock * 13 + i * 2, k, k * 0.62, 0.9 * veil(V, X, Y)); } }
  function ringsOver(c, V) { for (let i = 0; i < ringHits.length; i++) { const o = ringHits[i], t = clock - o.at; if (t > 0.28) { ringHits.splice(i--, 1); continue; }
      const u = t / 0.28, X = V.sx(o.x), Y = V.sy(o.y) - 44 * V.z, k = 1.1 * V.z * (1 + 0.25 * u); W.draw(c, `wringt_${o.v}`, X, Y, o.v * 0.3 + u, k, k * 0.7, (1 - u) * (1 - u) * 0.6 * veil(V, X, Y)); } }
  // ---------------------------------------------------------------- 打神鞭: the lash and the talismans it leaves
  const talismans = [];
  function columnsOver(c, V) {
    for (let i = 0; i < columns.length; i++) { const o = columns[i], t = clock - o.at; if (t < 0) continue; if (t > 0.3) { columns.splice(i--, 1); continue; }
      if (t >= 0.07 && !o.hit) { o.hit = 1; talismans.push({ x: o.x, y: o.y, at: clock, v: o.v, life: 0.3 }); }
      const dx = o.x - o.ax, dy = o.y - o.ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, bend = o.side * L * 0.28, mx = (o.ax + o.x) / 2 + nx * bend, my = (o.ay + o.y) / 2 + ny * bend;
      const P = (s) => { const u = 1 - s, x = u * u * o.ax + 2 * u * s * mx + s * s * o.x, y = u * u * o.ay + 2 * u * s * my + s * s * o.y; return [V.sx(x), V.sy(y) - (36 + 30 * Math.sin(s * Math.PI)) * V.z]; };
      const to = Math.min(1, t / 0.06), from = Math.max(0, (t - 0.1) / 0.18), a = t < 0.1 ? 1 : 1 - from * 0.7;      // cracked out in 0.06 s, drawn back from the hand by 0.28 s
      ribbon(c, `wlash_${o.v}`, P, (o.ev ? 0.48 : 0.4) * V.z, a, from, to, 14, V); }   // thin: many lashes read as many cracks, never as a net (tester round 2)
    for (let i = 0; i < talismans.length; i++) { const o = talismans[i], t = clock - o.at; if (t > o.life) { talismans.splice(i--, 1); continue; }
      const X = V.sx(o.x), Y = V.sy(o.y) - (56 + 10 * Math.max(0, 1 - t / 0.08)) * V.z, a = Math.min(1, t / 0.05) * Math.min(1, (o.life - t) / 0.15), k = 0.4 * V.z;
      W.draw(c, `wfu_${o.v}`, X, Y, Math.sin(t * 9 + o.v) * 0.12, k, k, a * veil(V, X, Y)); } }
  // lay a cell (drawn along +x) along a path P(s), s = 0 .. 1 in device px, in N strips: its stroke bends with the path;
  // k: device px per unit across it; only s in [from, to] is drawn; the back stays up whichever way the path runs
  function ribbon(c, name, P, k, a, from = 0, to = 1, N = 10, V = null) {
    const C = W.cell(name); if (!C || a <= 0) return null; let last = null;
    for (let i = 0; i < N; i++) { const u0 = i / N, u1 = Math.min(1, (i + 1) / N + 0.015); if (u1 < from || u0 > to) continue;
      const P0 = P(u0), P1 = P(u1), dx = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dx, dy) || 1, rot = Math.atan2(dy, dx), kx = len / ((u1 - u0) * C[7]), ky = (Math.cos(rot) < 0 ? -1 : 1) * k;
      const lx = (-C[5] + C[7] * u0) * kx; W.draw(c, name, P0[0] - Math.cos(rot) * lx, P0[1] - Math.sin(rot) * lx, rot, kx, ky, a * (V ? veil(V, P0[0], P0[1]) : 1), u0, u1); last = [P1, rot, ky]; }
    return last;
  }
  // ---------------------------------------------------------------- 混天绫: the red silk round its arc, Ma Yuan's water rolling out under it
  function silkCentre(o) { const h = G0 && G0.hero; return h && o.follow ? [h.x + o.dx, h.y + o.dy] : [o.x, o.y]; }
  function silksDraw(c, V, layer) {
    for (let i = 0; i < silks.length; i++) { const o = silks[i], t = clock - o.at; if (t > o.life + 0.5) { if (layer === 'over') silks.splice(i--, 1); continue; }
      const [cx, cy] = silkCentre(o), a0 = o.dir - o.turn * o.ang / 2, span = o.turn * o.ang * (o.ev ? 2 : 1), k = o.R / (o.ev ? 260 : 300) * V.z;
      if (layer === 'ground') { const rings = o.ev ? 3 : 1 + Math.min(2, (o.lv - 1) >> 1);       // the water: bands rolling outward behind the silk
        for (let r = 0; r < rings; r++) { const tw = t - 0.04 - r * 0.12; if (tw < 0) continue; const R = o.R * (1.02 + r * 0.22 + 0.5 * Math.min(1, tw / 0.6)), wa = Math.min(1, tw / 0.08) * (1 - Math.max(0, (tw - 0.35) / 0.5));
          const sp = o.ev ? TAU : Math.abs(o.ang) * 1.05, b0 = o.ev ? clock * 0.3 * o.turn : o.dir - sp / 2;
          ribbon(c, `wwave_${(r + o.v) % 2}`, (s) => [V.sx(cx + Math.cos(b0 + sp * s) * R), V.sy(cy + Math.sin(b0 + sp * s) * R)], 0.32 * V.z, wa * 0.6, 0, Math.min(1, tw / 0.14), o.ev ? 28 : 14, V); } continue; }
      const draw = Math.min(1, t / (o.ev ? 0.2 : 0.12)), pull = Math.max(0, (t - o.life * 0.55) / (o.life * 0.45)), gone = Math.max(0, 1 - Math.max(0, t - 0.18) / 0.12), ks = Math.min(k, 0.5 * V.z); if (gone <= 0) continue;   // over the figures for under 0.4 s    // unfurled from the hand, then pulled back from its root
      if (!o.ev) { ribbon(c, `wsilk_${o.v}`, (s) => { const a = a0 + span * s; return [V.sx(cx + Math.cos(a) * o.R), V.sy(cy + Math.sin(a) * o.R) - (30 + 20 * Math.sin(s * 6 + t * 4)) * V.z]; }, ks, 0.8 * gone * Math.min(1, t / 0.04) * (1 - pull * 0.6), pull, draw, 18, V); continue; }
      // 翻江 evolved: not a band but a turning wave: five lengths of silk chasing each other round him, each its own pull of the
      // brush (gaps between them: the broken edge), rising and falling as a wave runs round, thinner toward their ends
      for (let q = 0; q < 5; q++) { const tq = t - q * 0.05; if (tq < 0) continue; const len = 0.32 + 0.08 * (q % 2), b0 = a0 + o.turn * (q / 5 * Math.PI * 2 + tq * 4.2), dq = Math.min(1, tq / 0.12);
        ribbon(c, `wsilk_${(o.v + q) % 2}`, (s) => { const a = b0 + o.turn * len * Math.PI * 2 * s, rr = o.R * (0.92 + 0.16 * Math.sin(a * 3 - tq * 7) + 0.1 * s); return [V.sx(cx + Math.cos(a) * rr), V.sy(cy + Math.sin(a) * rr) - (26 + 26 * Math.sin(a * 2 + tq * 6)) * V.z]; },
          ks * (0.75 - 0.08 * q), gone * Math.min(1, tq / 0.04) * (1 - pull * 0.7), pull, dq, 18, V); } } }
  // ---------------------------------------------------------------- 火尖枪: each burning lane is one thrust of cinnabar with hooked fire
  function watchLanes(G) { const zs = G && G.zones; if (zs) for (const z of zs) { if (z.dead || z.src !== 'fireSpear' || z.kind !== 'burn') continue; let o = lanes.get(z.id);
      if (!o) { lanes.set(z.id, (o = { born: clock, gone: -1, x: z.x, y: z.y, dir: z.dir || 0, len: z.len || 240, ev: !!z.evolved }));
        if (ink && lanes.size < 4) ink.bloom({ x: z.x + Math.cos(o.dir) * o.len * 0.5, y: z.y + Math.sin(o.dir) * o.len * 0.5, w: o.len * 1.3, splats: BREAK_SCRIPT, pigment: 'fire', life: 4, dry: [0.8, 1.6], sink: 2.4, hero: true }); }
      o.seen = frame; }
    for (const [id, o] of lanes) { if (o.seen !== frame && o.gone < 0) o.gone = clock; if (o.gone >= 0 && clock - o.gone > 0.5) lanes.delete(id); } }
  function thrustsDraw(c, V) { for (let i = 0; i < thrusts.length; i++) { const o = thrusts[i], t = clock - o.at; if (t < 0) continue; if (t > 0.38) { thrusts.splice(i--, 1); continue; }
      const draw = Math.min(1, t / 0.06), a = t < 0.12 ? 1 : 1 - (t - 0.12) / 0.26, from = Math.max(0, (t - 0.14) / 0.24);     // thrust out in 0.06 s, held, then gone from the hand first
      const L = Math.min(o.L, 240); ribbon(c, `wthrust_${o.v}`, (s) => [V.sx(o.x + Math.cos(o.d) * L * s), V.sy(o.y + Math.sin(o.d) * L * s) - 34 * V.z], Math.min(o.k, 0.6) * V.z, a, from, draw, 8, V); } }   // reach by the lane on the ground, not by a stroke across the screen
  function lanesDraw(c, V) { for (const o of lanes.values()) { const t = clock - o.born, out = o.gone >= 0 ? Math.min(1, (clock - o.gone) / 0.5) : 0, draw = Math.min(1, t / 0.1), a = (t < 0.3 ? 1 : 0.8) * (1 - out);
      const P = (s) => [V.sx(o.x + Math.cos(o.dir) * o.len * s), V.sy(o.y + Math.sin(o.dir) * o.len * s) - 18 * V.z];
      ribbon(c, `wthrust_${Math.floor(clock * 6 + o.x) % 2}`, P, (o.ev ? 0.75 : 0.55) * V.z, a, out, draw, 8, V); } }       // the fire flickers by swapping two strokes of one value
  // ---------------------------------------------------------------- 定海珠: paper pearls ringed in azurite, water trailing
  function pearlsDraw(c, V, G, layer) { const ss = G && G.shots, h = G && G.hero; if (!ss) return; let ev = 0, rs = 0, n = 0;
    for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (s.dead || s.side === 'shang' || s.kind !== 'pearls') continue; const far = h && s.y < h.y; if (layer !== 'ground') continue;   // the orbit lasts: under the figures
      if (s.evolved && h) { ev = 1; rs += Math.hypot(s.x - h.x, s.y - h.y); n++; }
      const X = V.sx(s.x), Y = V.sy(s.y) - 28 * V.z, k = (s.r ? s.r / 14 : 1) * (far ? 0.75 : 0.9) * V.z, vx = (s.x - s.px) * V.z, vy = (s.y - s.py) * V.KY * V.z, sp = Math.hypot(vx, vy), a = far ? 0.65 : 1;
      if (sp > 0.3) { const rot = Math.atan2(vy, vx), back = 160 * k; W.draw(c, `wpearl_trail_${i % 2}`, X - Math.cos(rot) * back, Y - Math.sin(rot) * back, rot, k, k, a * 0.85); }
      W.draw(c, 'wpearl', X, Y, 0, k, k, a * veil(V, X, Y)); }
    if (ev && layer === 'ground' && n) { const R = rs / n, k = (R / 140) * V.z; W.draw(c, 'whalo_water', V.sx(h.x), V.sy(h.y), 0, k, k * V.KY, 0.7); } }   // 二十四诸天: a wash ring of azurite on the ground under the orbit
  // ---------------------------------------------------------------- 杏黄旗: a broken wash ring of gold round him; evolved, the great banner and golden lotus
  function bannerDraw(c, V, G, layer) { const zs = G && G.zones, h = G && G.hero; if (!zs || !h) return; let z = null; for (const q of zs) if (q.kind === 'ward' && q.src === 'banner' && !q.dead) { z = q; break; } if (!z) return;
    const X = V.sx(h.x), Y = V.sy(h.y), r = z.r || 125, k = (r / 140) * V.z, b = G.build && G.build.treasures, ev = z.evolved || !!(b && b.find((t) => t.id === 'banner' && t.evolved));
    if (layer === 'ground') { W.draw(c, 'whalo_gold', X, Y, 0, k, k * V.KY, 0.75); if (ev) W.draw(c, 'whalo_gold', X, Y, 0, -k * 1.2, k * 1.2 * V.KY, 0.5);
      if (ev) { const sw = Math.sin(clock * 1.4) * 0.03; W.draw(c, 'wflag', V.sx(h.x - 165), V.sy(h.y - 50), sw, 0.46 * V.z, 0.46 * V.z, 0.95); } return; }   // the banner: over the crowd, and on screen when he is high in the view
    if (ev) for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU + clock * 0.25, Xf = V.sx(h.x + Math.cos(b) * r * 1.05), Yf = V.sy(h.y + Math.sin(b) * r * 1.05) - 16 * V.z; W.draw(c, `wlotus_${j % 2}`, Xf, Yf, 0, 0.7 * V.z, 0.7 * V.z, 0.95 * veil(V, Xf, Yf)); } }
  function drawGround(V, dt, G) { clock += dt; frame++; if (G) G0 = G; watchCovers(G); watchLanes(G); if (!W.ready) return; const c = ctx; c.save(); c.globalCompositeOperation = 'source-over'; coverGround(c, V); coverOver(c, V, true); silksDraw(c, V, 'ground'); lanesDraw(c, V); thrustsDraw(c, V); hostsDraw(c, V, 'ground');   /* 火尖枪's thrusts with their lanes, under the figures */ generalsDraw(c, V, G, 'ground'); pearlsDraw(c, V, G, 'ground'); lightsGround(c, V); sealsGround(c, V); ropesDraw(c, V, G0); spoilsDraw(c, V, G0, 'ground'); bannerDraw(c, V, G, 'ground'); bannerDraw(c, V, G, 'over'); ringsGround(c, V, G0); lastingDraw(c, V, G0, 'ground'); c.restore(); }
  function drawOver(V, dt, G) { if (!W.ready) return; const c = ctx, cv = ctx.canvas; covMax = COVER * (cv && cv.width ? cv.width * cv.height : 2880 * 1800); cov = 0; budgetOn = true; c.save(); c.globalCompositeOperation = 'source-over'; coverOver(c, V); silksDraw(c, V, 'over'); blowsDraw(c, V); arrowsDraw(c, V, G); newsDraw(c, V, G); budgetOn = false; sigsDraw(c, V); lastingDraw(c, V, G0, 'over'); statesDraw(c, V, G0); hostsDraw(c, V, 'over'); generalsDraw(c, V, G, 'over'); budgetOn = true; ringsOver(c, V); spoilsDraw(c, V, G0, 'over'); columnsOver(c, V); budgetOn = false; c.restore(); }
  return { useTip: (f) => { tipFn = typeof f === 'function' ? f : null; }, onEvent, drawGround, drawOver, has, wonders: W, reset() { prints.length = 0; covers.clear(); columns.length = 0; talismans.length = 0; silks.length = 0; lanes.clear(); thrusts.length = 0; blows.length = 0; news.length = 0; hosts.length = 0; manifests.length = 0; dives.length = 0; sigs.length = 0; tracks.clear(); }, get live() { return covers.size + columns.length + silks.length + lanes.size; } };
}
