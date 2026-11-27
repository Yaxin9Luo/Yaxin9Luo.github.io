// The stage-final duels in brush (闻仲 first; rules in the shared notes' duel-events.md, plan in duel-fx-plan.md). Created by
// treasures.js, which lends it the paintings (spic), the hero's clear patch (veil) and the brush sheets: W (wonders), GW (the
// gods') and DW, the duel's own night sheet (gen/duel.cells.mjs: gold ink and lead white on indigo, 绀纸金泥). Scenes paints
// the arena ground, its seal and the light under the figures; this draws the bound, the living fire, and every pattern.
//   duelBegin        one great bolt brings him down; the seal of the 雷部 spreads across the whole arena; the sky answers
//   arena            the change between phases: a sweep of light over the ground; phase 2 lights the fire at the bound
//   duelPhase        the held beat: the seal flares across the arena, a ring of light goes out from him, bolts in the sky
//   phaseGate        a gold ward closes round him for a moment
//   stagger / shrug  a broken ring at his feet and flecks over his head / a white flick where control met him
//   duelFall         绝龙岭: 云中子's fire pillars rise round him and close; his soul goes up, pale
//   the patterns     drawn from his warn zones while they live (warning) and when they end (landing): lanes, circles, rings
const TAU = Math.PI * 2;
const ease = (u) => { const q = Math.min(1, Math.max(0, u)); return q * q * (3 - 2 * q); };
const clamp = (v) => Math.min(1, Math.max(0, v));
// what each of 闻仲's patterns lands as
// the seal's spread at the begin waits for page-campaign's title card to clear (seconds after duelBegin)
// page-campaign's title card clears 2.0 s into the duel (duel.t, the rules' game time): the seal spreads then; this is the fallback
// when the rules' duel.t is missing
const BEGIN_DELAY = 2.0;
const LAND = { qilinRush: 'charge', qilinReturn: 'charge', pairedWhips: 'whip', threeWhips: 'whip', thirdEye: 'beam', thunderRows: 'thunder', fourGenerals: 'charge', thunderStorm: 'bolt', dragonPillars: 'fire', goldWall: 'whip', goldWallSlam: 'whip' };

export function createDuel({ W, GW, DW, spic, veil, kick = () => {}, hold = () => {} }) {
  let fallThud = false, fallX = null, fallY = null, sealAt = -9, skyAt = -9, clock = 0, G = null, duel = null, beginAt = -9, phaseAt = -9, fallAt = -9, endAt = -9, arenaAt = -9, phase = 0;
  const zones = new Map(), lands = [], scorches = [], marks = [];
  const D = (c, n, X, Y, rot, kx, ky, a, u0, u1) => { const S = DW && DW.cell(n) ? DW : GW && GW.cell(n) ? GW : W; if (a > 0.004) S.draw(c, n, X, Y, rot, kx, ky, a, u0, u1); };
  const cell = (n) => (DW && DW.cell(n)) || (GW && GW.cell(n)) || W.cell(n);
  const boss = () => { const fs = G && G.foes; if (fs && duel) for (const f of fs) if (f.id === duel.id) return f; return null; };
  const inDuel = () => !!(G && G.campaign && G.campaign.duel);
  /** whether this zone or blow is the duel boss's (the paper effects stand aside for it) */
  const owns = (srcKind) => inDuel() && G.campaign.duel.kind === srcKind;

  function onEvent(e, game) { if (game) G = game; const t = e.type;
    if (t === 'duelBegin') { duel = { id: e.id, kind: e.kind, x: e.arena.x, y: e.arena.y, r: e.arena.r }; beginAt = clock; phase = 0; kick(26); return; }
    if (t === 'arena') { if (duel) { duel.x = e.x; duel.y = e.y; duel.r = e.r; } phase = e.phase || 0; arenaAt = clock; return; }
    if (t === 'duelPhase') { phaseAt = clock; kick(20); return; }
    if (t === 'phaseGate') { marks.push({ k: 'gate', id: e.id, x: e.x, y: e.y, at: clock }); return; }
    if (t === 'stagger') { marks.push({ k: 'stagger', id: e.id, x: e.x, y: e.y, at: clock, life: e.time || 1.2 }); return; }
    if (t === 'shrug') { marks.push({ k: 'shrug', id: e.id, x: e.x, y: e.y, at: clock }); return; }
    if (t === 'poiseReady') { marks.push({ k: 'ready', id: e.id, x: e.x, y: e.y, at: clock }); return; }
    // where he fell: the rules let him go, figures-key holds him kneeling there through the hold, and the pillars close on that spot
    if (t === 'duelFall') { fallAt = clock; fallX = e.x; fallY = e.y; fallThud = false; return; }
    if (t === 'duelEnd') { endAt = clock; return; }
  }

  // ---------------------------------------------------------------- the zones: warning while they live, landing when they end
  const sealNow = () => (sealAt >= beginAt ? sealAt : (G && G.campaign && G.campaign.duel && typeof G.campaign.duel.t === 'number' ? Infinity : beginAt + BEGIN_DELAY));
  function watch() { const zs = G && G.zones; const kind = duel && duel.kind;
    { const d = G && G.campaign && G.campaign.duel; if (duel && sealAt < beginAt && d && typeof d.t === 'number' && d.t >= BEGIN_DELAY) sealAt = clock; }
    if (zs && kind && inDuel()) for (const z of zs) { if (z.dead || z.side !== 'shang' || z.src !== kind || !z.pattern) continue; let o = zones.get(z);
      if (!o) zones.set(z, (o = { pat: z.pattern, shape: z.shape || (z.kind === 'wall' ? 'wall' : 'circle'), born: clock }));
      Object.assign(o, { x: z.x, y: z.y, r: z.r, r0: z.r0, dir: z.dir, len: z.len, w: z.w, gap: z.gap, p: z.life > 0 && isFinite(z.life) ? clamp(z.t / z.life) : 1, left: z.life > 0 && isFinite(z.life) ? z.life - z.t : 0, kind: z.kind, seen: clock }); }
    for (const [z, o] of zones) if (o.seen !== clock) { zones.delete(z); if (o.kind !== 'wall') land(o); } }
  function land(o) { const how = LAND[o.pat] || (o.shape === 'lane' ? 'thunder' : 'bolt'); lands.push({ ...o, how, at: clock });
    if (how === 'thunder' || how === 'bolt' || how === 'beam') scorches.push({ ...o, at: clock });
    kick(how === 'thunder' ? 16 : how === 'fire' ? 10 : 7);
    // the thunder is his loudest blow: a held beat of two or three frames, and the sky answers
    if (how === 'thunder' && clock - skyAt > 0.3) { hold(0.045); skyAt = clock; } if (lands.length > 60) lands.shift(); if (scorches.length > 40) scorches.shift(); }
  // a lane's two ends and its width on screen
  function laneOf(o, V) { const c = Math.cos(o.dir || 0), s = Math.sin(o.dir || 0), L = o.len || 600, X0 = V.sx(o.x), Y0 = V.sy(o.y), X1 = V.sx(o.x + c * L), Y1 = V.sy(o.y + s * L);
    return { X0, Y0, X1, Y1, rot: Math.atan2(Y1 - Y0, X1 - X0), Ls: Math.hypot(X1 - X0, Y1 - Y0), ws: (o.w || 80) * V.z * Math.hypot(s, c * V.KY) }; }
  // a cell laid along a lane, its pivot at the lane's start, stretched to its length; width ws on screen (the band's hairs are 144 wide)
  function alongLane(c, n, l, a, wcell = 144, u0 = 0, u1 = 1) { const C = cell(n); if (C) D(c, n, l.X0, l.Y0, l.rot, l.Ls / C[7], l.ws / wcell, a, u0, u1); }
  // a ring of a lane-cell laid round a circle on the ground in pieces (bands of 绝龙岭, the bound), with an optional gap
  function ringOf(c, V, n, x, y, r, wWorld, a, gapDir = null, gap = 0, N = 24) { const C = cell(n); if (!C) return;
    for (let i = 0; i < N; i++) { const b0 = (i / N) * TAU, b1 = ((i + 1.08) / N) * TAU, bm = (b0 + b1) / 2;
      if (gapDir != null) { let d = bm - gapDir; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < gap / 2) continue; }
      const X0 = V.sx(x + Math.cos(b0) * r), Y0 = V.sy(y + Math.sin(b0) * r), X1 = V.sx(x + Math.cos(b1) * r), Y1 = V.sy(y + Math.sin(b1) * r), L = Math.hypot(X1 - X0, Y1 - Y0);
      // a fifth of the cell's length laid over the segment: draw() places that slice where it lies in the cell, so the slice is
      // stretched to the segment's length and the cell moved back by the slice's start
      const u0 = 0.02 + (i % 5) * 0.19, rot = Math.atan2(Y1 - Y0, X1 - X0), kx = L / (C[7] * 0.2 * 0.98), sx0 = kx * (C[7] * u0 - C[5]);
      D(c, n, X0 - Math.cos(rot) * sx0, Y0 - Math.sin(rot) * sx0, rot, kx, (wWorld * V.z * Math.hypot(Math.cos(bm), Math.sin(bm) * V.KY)) / 144, a * veil(V, (X0 + X1) / 2, (Y0 + Y1) / 2), u0, u0 + 0.2); } }

  function warnDraw(c, V, layer) { if (layer !== 'ground') return; const z = V.z;
    // the soonest strike of each pattern now: only the lanes of that beat are lit (thunderRows' second beat comes 0.9 s after
    // the first, inside any fixed window, so lit is "in the next beat", not "within so long of its strike")
    const firstLeft = new Map(); for (const o of zones.values()) if (o.shape === 'lane') firstLeft.set(o.pat, Math.min(firstLeft.get(o.pat) ?? 1e9, o.left));
    for (const o of zones.values()) { const a = 0.55 + 0.45 * o.p;
      // (the tester, 16 rides: thunderRows' warnings read like its strikes) a warned lane is restrained: its gold-ruled edges, and a
      // dry wash over its whole length from the start (0.25, rising to 0.45 as the time runs out; the lead: a lane told at once),
      // its ends closed and a light gold hatch across it (dedge), all well under the strike's white; the gaps stay dark
      // (thunderRows' six rows tile the arena: the odd ones strike first, the even 0.9 s later, so the safe ground is the later
      // lanes) the lanes of the next beat are lit; a lane still waiting its turn is nearly bare
      if (o.shape === 'lane') { const l = laneOf(o, V), soon = clamp(1 - o.left / 1.2), next = o.left <= (firstLeft.get(o.pat) ?? 0) + 0.3;
        // (the lead, round 3: push it as far as it goes short of the strike) waiting: thin edges at 0.2 over a faint ink veil (0.2),
        // so safe ground goes darker; next: the
        // wash up to 0.6 with a slow pulse quickening in its last 0.4 s, and dry sparks crawling along it, so "live" is told by motion
        if (!next) { alongLane(c, 'dveil', l, 0.2); alongLane(c, 'dedge0', l, 0.2); continue; }
        const hz = o.left < 0.4 ? 7 : 2.5, pulse = 0.82 + 0.18 * Math.sin(clock * TAU * hz);
        alongLane(c, 'dedge', l, 0.8 + 0.2 * soon);
        // the dry wash laid twice (both band paintings), so its hairs cover the lane and its value reads at a glance
        for (const n of ['dlane_0', 'dlane_1']) alongLane(c, n, l, (0.3 + 0.3 * soon) * pulse);
        // and once more screened (light added), so it lifts the pale centre of the arena as well as the night ground
        c.globalCompositeOperation = 'screen'; alongLane(c, 'dlane_0', l, (0.35 + 0.35 * soon) * pulse); c.globalCompositeOperation = 'source-over';
        for (let j = 0; j < 5; j++) { const u = (clock * 0.45 + j / 5 + (o.order || 0) * 0.1) % 1, side = Math.sin(clock * 9 + j * 2.1) * 0.3, X = l.X0 + (l.X1 - l.X0) * u - Math.sin(l.rot) * side * l.ws, Y = l.Y0 + (l.Y1 - l.Y0) * u + Math.cos(l.rot) * side * l.ws;
          D(c, `wcut_${j & 1}`, X, Y, clock * 6 + j, 0.28 * z, 0.28 * z, (0.6 + 0.4 * soon) * veil(V, X, Y)); }
        // 邓辛张陶 ride in: a small seal at the head of each lane
        if (o.pat === 'fourGenerals') { const k = 90 * z / cell('dseal')[7]; D(c, 'dseal', l.X0, l.Y0, clock, k, k * V.KY, 0.9); } }
      else if (o.shape === 'ring') { const fire = o.pat === 'dragonPillars', w = (o.r || 160) - (o.r0 || 0);
        // 绝龙岭's bands: a little of the white lane under the fire (0.25: more turns the band white, scenes) so the band is the
        // lightest thing on the warm dark ground and still reads as fire (the lead: dragonPillars' warning the clearest in phase 2)
        if (fire) ringOf(c, V, 'dlane_0', o.x, o.y, ((o.r || 160) + (o.r0 || 0)) / 2, w, a * 0.25, o.gap ? o.dir : null, o.gap || 0);
        ringOf(c, V, fire ? 'dband_0' : 'dlane_0', o.x, o.y, ((o.r || 160) + (o.r0 || 0)) / 2, w, a, o.gap ? o.dir : null, o.gap || 0); }
      else { const X = V.sx(o.x), Y = V.sy(o.y), k = (o.r || 100) * 2 * z / 236; D(c, 'ddisc', X, Y, clock * 0.4, k, k * V.KY, (0.14 + 0.16 * o.p) * veil(V, X, Y)); D(c, 'dring', X, Y, -clock * 0.3, k * 1.02, k * 1.02 * V.KY, a * veil(V, X, Y));
        // (restrained like the lanes: a faint disc, the ruled ring at its edge) a ring filling inward as the time runs
        const kf = k * (1 - 0.85 * o.p); D(c, 'dring', X, Y, -clock * 0.5, kf, kf * V.KY, 0.35 + 0.4 * o.p); } } }

  function landDraw(c, V, layer) { const z = V.z, over = layer === 'over';
    for (let i = 0; i < lands.length; i++) { const o = lands[i], t = clock - o.at, life = o.how === 'fire' ? 0.9 : 0.7; if (t > life) { if (over) lands.splice(i--, 1); continue; }
      if (o.shape === 'lane') { const l = laneOf(o, V), c0 = Math.cos(o.dir || 0), s0 = Math.sin(o.dir || 0), at = (s) => [V.sx(o.x + c0 * (o.len || 600) * s), V.sy(o.y + s0 * (o.len || 600) * s)];
        // the ground flashes pale for a few frames along the lane, then the light goes
        if (!over) { const fl = t < 0.08 ? 1 : Math.max(0, 1 - (t - 0.08) / 0.25); alongLane(c, 'dlane_1', l, fl); alongLane(c, 'dlane_0', l, fl * 0.8);
          // the strike frames: the whole lane white-gold
          if (o.how === 'thunder' && t < 0.16) { const Cb = cell('gbeam_0');
            // the flat white band of the strike: full through the hold, then thinned to a quarter if it lies across the hero
            const H = V.hero, onHero = H && t > 0.05 && (() => { const dx = l.X1 - l.X0, dy = l.Y1 - l.Y0, q = Math.max(0, Math.min(1, ((H[0] - l.X0) * dx + (H[1] - 40 * z - l.Y0) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(l.X0 + dx * q - H[0], l.Y0 + dy * q - H[1] + 40 * z) < l.ws / 2 + 60 * z; })();
            if (Cb) D(c, 'gbeam_0', l.X0, l.Y0, l.rot, l.Ls / Cb[7], l.ws / 160, 0.85 * (1 - t / 0.16) * (onHero ? 0.25 : 1)); }
          if (o.how === 'thunder' || o.how === 'beam') { const C = cell('dcrack_0'); if (C) D(c, `dcrack_${(o.order || 0) & 1}`, l.X0, l.Y0, l.rot, l.Ls / C[7], 0.9 * z, Math.max(0, 1 - t / 0.6)); }
          continue; }
        if (o.how === 'thunder') { const n = Math.max(2, Math.round((o.len || 600) / 300)), H = c.canvas.height; for (let k = 0; k < n; k++) { const [X, Y] = at((k + 0.5) / n), a = t < 0.25 ? 1 : Math.max(0, 1 - (t - 0.25) / 0.2), ky = Math.max(0.62 * z, (Y + 40) / 740);
            D(c, `dbolt_${k & 1}`, X, Y, 0, 0.85 * z, ky * (0.9 + 0.1 * Math.sin(k * 3)), a * veil(V, X, Y - 150 * z)); } }
        else if (o.how === 'beam') { const C = cell('gbeam_0'); if (C) D(c, `gbeam_${o.order & 1}`, l.X0, l.Y0 - 40 * z, l.rot, l.Ls / C[7], 0.6 * z, Math.max(0, 1 - t / 0.45) * veil(V, (l.X0 + l.X1) / 2, (l.Y0 + l.Y1) / 2)); }
        else { const C = cell('dwhip_0'); if (C) D(c, `dwhip_${(o.order || 0) & 1}`, l.X0, l.Y0 - 30 * z, l.rot, l.Ls / C[7], (o.pat === 'fourGenerals' ? 1.3 : 0.7) * z, Math.max(0, 1 - t / 0.5) * veil(V, (l.X0 + l.X1) / 2, (l.Y0 + l.Y1) / 2)); }
        continue; }
      if (o.shape === 'ring') { const R = ((o.r || 160) + (o.r0 || 0)) / 2;
        if (o.how === 'fire') { if (over) continue; const n = Math.max(5, Math.round(TAU * R / 190)); for (let k = 0; k < n; k++) { const b = (k / n) * TAU; if (o.gap) { let d = b - o.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < o.gap / 2) continue; }
            const X = V.sx(o.x + Math.cos(b) * R), Y = V.sy(o.y + Math.sin(b) * R), up = ease(t / 0.25), a = 0.85 * Math.min(1, t / 0.06) * (1 - clamp((t - 0.55) / 0.35)); const vk = Math.floor(b * 7), kf = 0.5 * z * (vk % 2 ? -1 : 1); D(c, `dflame_${((vk % 3) + 3) % 3}`, X, Y, 0, kf, 0.5 * z * up, a * veil(V, X, Y - 110 * z)); } }
        else if (!over) ringOf(c, V, 'dlane_1', o.x, o.y, R, (o.r || 160) - (o.r0 || 0), Math.max(0, 1 - t / 0.4));
        continue; }
      // a circle: the whip falls on it, or a bolt
      const X = V.sx(o.x), Y = V.sy(o.y), k = (o.r || 100) / 110;
      if (!over) { const fl = t < 0.06 ? 1 : Math.max(0, 1 - (t - 0.06) / 0.3), kr = (o.r || 100) * 2 * z / 236; D(c, 'dring', X, Y, 0, kr * (1 + 0.4 * t), kr * (1 + 0.4 * t) * V.KY, fl);
        for (let j = 0; j < 3; j++) { const C = cell('dcrack_0'); if (C) D(c, `dcrack_${j & 1}`, X, Y, j * 2.1 + 0.4, (o.r || 100) * 1.1 * z / C[7], 0.6 * z, Math.max(0, 1 - t / 0.6)); } continue; }
      if (o.how === 'bolt') D(c, `dbolt_${(o.x | 0) & 1}`, X, Y, 0, 0.6 * z * k, 0.6 * z * k, (t < 0.25 ? 1 : Math.max(0, 1 - (t - 0.25) / 0.2)) * veil(V, X, Y - 150 * z));
      else { const C = cell('dwhip_0'), s2 = ease(t / 0.12); if (C) D(c, `dwhip_${(o.x | 0) & 1}`, X - 160 * z * k, Y - 220 * z * k * (1 - s2), 0.9, 380 * z * k / C[7], 0.8 * z * k, Math.max(0, 1 - t / 0.5) * veil(V, X, Y)); } } }

  // the burn a strike leaves along its lane, two seconds
  function scorchDraw(c, V) { const z = V.z;
    for (let i = 0; i < scorches.length; i++) { const o = scorches[i], t = clock - o.at; if (t > 2.2) { scorches.splice(i--, 1); continue; } const a = 0.75 * Math.min(1, (t - 0.1) / 0.1) * (1 - clamp((t - 1.4) / 0.8)); if (a <= 0) continue;
      if (o.shape === 'lane') { const l = laneOf(o, V), C = cell('dscorch_0'); if (!C) continue;
        // a struck row of the 雷部 lies spent across its whole width (the lead: step onto the row that just burned), others a thin burn
        if (o.how === 'thunder') alongLane(c, `dscorch_${(o.order || 0) & 1}`, l, Math.min(1, a * 1.2), 52); else D(c, `dscorch_${(o.order || 0) & 1}`, l.X0, l.Y0, l.rot, l.Ls / C[7], 0.9 * z, a); }
      else { const X = V.sx(o.x), Y = V.sy(o.y), C = cell('dscorch_0'); for (let j = 0; j < 2; j++) if (C) D(c, `dscorch_${j}`, X - Math.cos(j * 1.6) * 60 * z, Y - Math.sin(j * 1.6) * 30 * z, j * 1.6, 120 * z / C[7], 0.8 * z, a); } } }

  // ---------------------------------------------------------------- the arena's own life
  function arenaDraw(c, V, layer) { if (!duel) return; const z = V.z, a0 = endAt > beginAt ? Math.max(0, 1 - (clock - endAt) / 1) : 1; if (a0 <= 0) { if (layer === 'over') duel = null; return; }
    const ax = duel.x, ay = duel.y, r = duel.r, CX = V.sx(ax), CY = V.sy(ay);
    if (layer === 'ground') {
      // the bound: a ruled gold line round the arena, thin; in 绝龙岭 a low fire living along it
      ringOf(c, V, 'dlane_0', ax, ay, r, 26, 0.75 * a0, null, 0, 40);
      if (phase >= 2) { const n = 16; for (let k = 0; k < n; k++) { const b = (k / n) * TAU + 0.07, X = V.sx(ax + Math.cos(b) * r), Y = V.sy(ay + Math.sin(b) * r), fl = 0.75 + 0.25 * Math.sin(clock * 6 + k * 1.7);
          D(c, 'dfire', X, Y, 0, 0.24 * z, 0.24 * z * fl * clamp((clock - arenaAt) / 0.8), 0.45 * a0 * veil(V, X, Y - 40 * z)); } }
      // the seal of the 雷部 spreading across the whole arena at the begin and at each beat, then giving way to scenes' seal
      for (const [at0, k0] of [[sealNow(), 1], [phaseAt, 1]]) { const t = clock - at0; if (t < 0 || t > 2.4) continue; const s = ease(t / 1.2), k = (r * 2 * s) * z / cell('dseal')[7], a = Math.min(1, t / 0.15) * (1 - clamp((t - 1.4) / 1));
        D(c, 'dseal', CX, CY, t * 0.3, k, k * V.KY, 0.95 * a * k0);
        // a ring of light running out ahead of it to the bound
        const q = ease(t / 0.9), kr = (r * 2 * q) * z / cell('dring')[7]; D(c, 'dring', CX, CY, 0, kr, kr * V.KY, (1 - q) * 0.9); }
      // the change of phase: a sweep of pale light over the ground
      { const t = clock - arenaAt; if (t > 0 && t < 0.8 && arenaAt > beginAt + 0.5) { const q = ease(t / 0.6), X = V.sx(ax - r + 2 * r * q); for (let j = -2; j <= 2; j++) { const C = cell('dlane_1'); D(c, 'dlane_1', X, V.sy(ay + j * r * 0.4) - 0, Math.PI / 2, (r * 0.8 * z) / C[7], 1.4 * z, (1 - q) * 0.7); } } }
      return; }
    // over: the sky answers at the begin and at each beat: great bolts at the top of the view, off the hero
    for (const at0 of [sealNow(), phaseAt]) { const t = clock - at0; if (t < 0 || t > 0.9) continue; const Wd = c.canvas.width, H = c.canvas.height;
      for (let k = 0; k < 4; k++) { const tk = t - k * 0.12; if (tk < 0 || tk > 0.3) continue; const X = Wd * (0.14 + 0.24 * k + 0.05 * Math.sin(at0 * 7 + k)), Y = H * 0.36;
        D(c, `dbolt_${k & 1}`, X, Y, 0, 1.1 * z, 0.75 * z, (tk < 0.15 ? 1 : 1 - (tk - 0.15) / 0.15) * veil(V, X, Y - 200 * z)); } }
    // the sky answers his thunder: two bolts at the top of the view
    { const t = clock - skyAt; if (t >= 0 && t < 0.35) { const Wd = c.canvas.width, H = c.canvas.height; for (let k = 0; k < 2; k++) { const X = Wd * (0.25 + 0.5 * k + 0.08 * Math.sin(skyAt * 9 + k)), Y = H * 0.3; D(c, `dbolt_${k & 1}`, X, Y, 0, 0.9 * z, 0.6 * z, (t < 0.12 ? 1 : 1 - (t - 0.12) / 0.23) * veil(V, X, Y - 150 * z)); } } }
    // the begin: one great bolt brings him down onto the middle of the arena
    { const t = clock - beginAt, b = boss(); if (t >= 0 && t < 0.5) { const X = V.sx(b ? b.x : ax), Y = V.sy(b ? b.y : ay); D(c, 'dbolt_0', X, Y, 0, 1.3 * z, 1.3 * z, (t < 0.2 ? 1 : 1 - (t - 0.2) / 0.3) * veil(V, X, Y - 300 * z)); } } }

  // ---------------------------------------------------------------- marks on him, and his fall
  // how much larger he is drawn in his duel: figures-key's art.grow(u) (×1.5, eased in over the duel's first 0.6 s), mirrored
  // from the rules' duel.t, since the art object does not reach the effects; the marks over his head and his brow go up with him
  const grow = () => { const d = G && G.campaign && G.campaign.duel; return d && duel ? 1 + 0.5 * clamp((d.t || 0) / 0.6) : 1; };
  function marksDraw(c, V) { const z = V.z, gr = grow();
    for (let i = 0; i < marks.length; i++) { const m = marks[i], t = clock - m.at, life = m.k === 'stagger' ? m.life : m.k === 'gate' ? 0.55 : 0.35; if (t > life) { marks.splice(i--, 1); continue; }
      const f = boss(), X = V.sx(f ? f.x : m.x), Y = V.sy(f ? f.y : m.y), q = t / life;
      if (m.k === 'gate') { const k = (1.1 - 0.2 * ease(q)) * z; GW && D(c, 'gring', X, Y, 0, k, k * V.KY, (1 - q) * 0.95); D(c, 'dring', X, Y - 80 * gr * z, 0, 0.9 * gr * z, 1.4 * gr * z, (1 - q) * 0.8); }
      else if (m.k === 'stagger') { D(c, 'dring', X, Y, clock * 2, 0.9 * z, 0.9 * z * V.KY, 0.8 * (1 - clamp((t - life + 0.3) / 0.3)));
        for (let j = 0; j < 3; j++) { const b = clock * 4 + j * TAU / 3; D(c, 'wcut_0', X + Math.cos(b) * 34 * gr * z, Y - 150 * gr * z + Math.sin(b) * 10 * z, b, 0.22 * z, 0.22 * z, 0.9); } }
      else { const k = (0.2 + 0.25 * q) * z; D(c, m.k === 'ready' ? 'wcut_1' : 'wcut_0', X, Y - 90 * gr * z, q * 2, k, k, (1 - q) * 0.9); } } }
  // the fall (duelFall, held 3 s), the reward: 通天神火柱, nine pillars of fire at full height rising one by one round him and closing
  // in over two seconds, the arena lit warm by them; then a quiet beat while his soul goes up, pale, toward 封神台
  function fallDraw(c, V, layer) { const t = clock - fallAt; if (fallAt < 0 || t > 3.4) return; const z = V.z, f = boss(), x = fallX != null ? fallX : f ? f.x : duet(0), y = fallY != null ? fallY : f ? f.y : duet(1);
    const close = ease(clamp((t - 0.6) / 1.6)), out = 1 - clamp((t - 2.1) / 0.5), R = 300 - 150 * close;
    // the nine round him, turning a little as they close, so they read as a ring round a point
    const at9 = (k) => { const b = (k / 9) * TAU + 0.35 - 0.5 * close; return [b, x + Math.cos(b) * R, y + Math.sin(b) * R]; };
    if (layer === 'ground') { const X0 = V.sx(x), Y0 = V.sy(y), kl = (duel ? duel.r : 600) * 2.2 * z / cell('whalo_fire')[7]; D(c, 'whalo_fire', X0, Y0, t * 0.1, kl, kl * V.KY, 0.3 * clamp(t / 0.6) * out);
      // the ring they stand on, ruled in gold, closing with them
      const kr = (R * 2 * z) / cell('dring')[7]; D(c, 'dring', X0, Y0, t * 0.2, kr, kr * V.KY, 0.7 * clamp(t / 0.4) * out);
      // a pool of firelight on the ground at each one's root
      // each root's firelight: a warm wash and over it gold added to the ground (screen), so the roots stand in light, not float
      for (let k = 0; k < 9; k++) { const tk = t - k * 0.09; if (tk < 0) continue; const [, px, py] = at9(k), X = V.sx(px), Y = V.sy(py), a = Math.min(1, tk / 0.15) * out;
        D(c, 'whalo_fire', X, Y, k, 0.6 * z, 0.6 * z * V.KY, 0.6 * a); c.globalCompositeOperation = 'screen'; D(c, 'whalo_gold', X, Y, k * 2, 0.42 * z, 0.42 * z * V.KY, 0.9 * a); c.globalCompositeOperation = 'source-over'; }
      // the ground round him lit as they close
      c.globalCompositeOperation = 'screen'; D(c, 'whalo_gold', X0, Y0, t * 0.3, 1.1 * z * (0.6 + 0.4 * close), 1.1 * z * (0.6 + 0.4 * close) * V.KY, 0.75 * close * out); c.globalCompositeOperation = 'source-over'; }
    // the settle (figures-key: the 墨麒麟 folds down 0.15 to 0.7 s, settles 0.7 to 1.0 s): dust thrown out from under it along his
    // body's width (≈ 1.6 × 143 × 1.5 units), rolling out and up, pale on the dark ground (screened in); the far puffs under the
    // figures, the near ones over them
    // and as its belly meets the ground (0.7 s) a short ground shock: a ring of ink and dust going out flat from under him, under
    // the flames, with a small kick of the screen
    { const td = t - 0.7; if (td > 0 && !fallThud) { fallThud = true; kick(6); }
      if (layer === 'ground' && td > 0 && td < 0.4) { const q = td / 0.4, X0 = V.sx(x), Y0 = V.sy(y), kr = (0.5 + 1.1 * ease(q)) * grow() * z;
        D(c, 'gshock_0', X0, Y0, 0, kr, kr * V.KY / 0.55, 0.85 * (1 - q)); D(c, 'whalo_gold', X0, Y0, 0, kr * 0.7, kr * 0.7 * V.KY, 0.25 * (1 - q)); } }
    { const td = t - 0.7; if (td > 0 && td < 1.0) { const q = td / 1.0, Wd = 1.6 * 143 * grow();
      for (let j = 0; j < 8; j++) { const near = j % 2 === 1; if (near !== (layer === 'over')) continue; const sd = (j / 7) * 2 - 1, px = x + sd * Wd * 0.5 * (1 + 0.5 * q), py = y + (near ? 14 : -10) * (1 + q), X = V.sx(px), Y = V.sy(py) - 30 * q * z, k = (0.7 + 0.8 * q) * z, a = Math.min(1, td / 0.08) * (1 - q);
        c.globalCompositeOperation = 'screen'; D(c, `wdust_${j % 2}`, X, Y, sd * 0.4, (sd < 0 ? -1 : 1) * k, k * 0.8, 0.7 * a * veil(V, X, Y)); c.globalCompositeOperation = 'source-over'; D(c, `wdust_${(j + 1) % 2}`, X, Y + 4 * z, 0, k * 0.9, k * 0.6, 0.35 * a * veil(V, X, Y)); } } }
    // each pillar: rising from its root one after another round the ring, licking (three paintings cross-faded), swaying; the far
    // half drawn under the figures, the near half over them
    if (out > 0) for (let k = 0; k < 9; k++) { const tk = t - k * 0.09; if (tk < 0) continue; const [b, px, py] = at9(k); if ((Math.sin(b) < 0) !== (layer === 'ground')) continue;
      const X = V.sx(px), Y = V.sy(py), rise = ease(clamp(tk / 0.35)), fl = clock * 6 + k * 1.7, i0 = Math.floor(fl) % 3, fr = fl - Math.floor(fl), s = 0.62 * z * (1 + 0.04 * Math.sin(clock * 11 + k)) * (k % 2 ? -1 : 1), ky = Math.abs(s) * rise * (1 + 0.06 * Math.sin(clock * 13 + k * 2)), sway = 0.05 * Math.sin(clock * 5 + k), a = 0.95 * Math.min(1, tk / 0.1) * out * veil(V, X, Y - 130 * z);
      D(c, `dflame_${i0}`, X, Y, sway, s, ky, a * Math.min(1, 2 * (1 - fr))); D(c, `dflame_${(i0 + 1) % 3}`, X, Y, sway, s, ky, a * Math.min(1, 2 * fr)); }
    if (layer === 'ground') return;
    // the fire's light on him: warm light added over his figure (kneeling there), stronger as they close
    { const X = V.sx(x), Y = V.sy(y) - 100 * z; c.globalCompositeOperation = 'screen'; D(c, 'whalo_fire', X, Y, t * 0.2, 1.3 * z, 1.5 * z, 0.4 * close * out); c.globalCompositeOperation = 'source-over'; }
    // his soul: a column of pale light under it and the wisp going up, slow, in the quiet after the fire
    const s = t - 2.0; if (s > 0) { const X = V.sx(x), Yb = V.sy(y), Y = Yb - (140 + 420 * ease(s / 1.3)) * z, a = Math.min(1, s / 0.25) * (1 - clamp((s - 1.1) / 0.3));
      D(c, 'dpillar', X, Yb, 0, 1.4 * z, 1.4 * z, 0.6 * a); D(c, 'gsoul', X, Y, 0, 2.2 * z, 2.2 * z, a); } }
  const duet = (i) => (duel ? (i ? duel.y : duel.x) : 0);

  function drawGround(c, V, game, dt) { clock += dt; if (game) G = game; watch(); if (!duel && !lands.length && !scorches.length) return; scorchDraw(c, V); arenaDraw(c, V, 'ground'); warnDraw(c, V, 'ground'); landDraw(c, V, 'ground'); fallDraw(c, V, 'ground'); }
  // 闻仲's third eye opens on his brow while its lanes are warned (the 天眼 painting, small)
  function browEye(c, V) { let on = 0; for (const o of zones.values()) if (o.pat === 'thirdEye') on = Math.max(on, o.p); const f = boss(); if (!on || !f) return;
    // figures-key paints his third eye open on his brow and sets u.eyeAt (world units, pose and size applied) each frame; here
    // only the opening's flare and a ring of gold going out from it
    const ea = f.eyeAt, X = ea ? V.sx(ea[0]) : V.sx(f.x), Y = ea ? V.sy(ea[1]) : V.sy(f.y) - 137 * grow() * V.z, q = clamp(on / 0.3); if (q >= 1) return; const a = (1 - q) * veil(V, X, Y), kr = (0.25 + 0.5 * q) * V.z;
    D(c, 'whalo_gold', X, Y, q, kr, kr, 0.9 * a); D(c, 'gshock_0', X, Y, 0, kr * 0.8, kr * 0.8, 0.7 * a); }
  function drawOver(c, V, game) { if (game) G = game; if (!duel && !lands.length && !marks.length) return; browEye(c, V); landDraw(c, V, 'over'); arenaDraw(c, V, 'over'); marksDraw(c, V); fallDraw(c, V, 'over'); }
  // how strongly the player's side is drawn during a duel (glctx.alphaMul over his treasures, generals and squads): 0.55 while
  // the fight goes on, 0.3 for the second a set piece owns (the begin, a phase beat, the fall, and 四将, the 雷部 rows, 绝龙岭)
  const SIGNATURE = { thunderRows: 1, fourGenerals: 1, dragonPillars: 1 };
  function duck() { if (!inDuel() && !(fallAt > 0 && clock - fallAt < 3.2)) return 1;
    let set = clock - sealNow() < 2.4 || clock - phaseAt < 2.6 || (fallAt > 0 && clock - fallAt < 3.2);
    if (!set) for (const o of zones.values()) if (SIGNATURE[o.pat]) { set = true; break; }
    if (!set) for (const o of lands) if (SIGNATURE[o.pat] && clock - o.at < 0.8) { set = true; break; }
    return set ? 0.3 : 0.55; }
  function reset() { zones.clear(); lands.length = scorches.length = marks.length = 0; duel = null; beginAt = phaseAt = fallAt = endAt = arenaAt = -9; phase = 0; }
  return { onEvent, drawGround, drawOver, reset, owns, duck, inDuel };
}
