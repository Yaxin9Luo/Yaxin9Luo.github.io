// The finale's staging in brush (SPEC-CAMPAIGN 1.16; events in the shared notes' finale-events.md; the lead's beats of
// 2026-11-26). Created by treasures.js, which lends it the paintings (spic), the brush ribbon, the hero's clear patch (veil)
// and both brush sheets. Everything here is brief or thin; nothing stands over the hero.
//   the seven of 梅山 land   each comes down in a column of his own ink with his true shape half seen in it (fn<Name>), staggered
//   meishan                  a grey wash closes in from the edges of the view for a moment
//   lastWave                 a dry ink ring drawn round the host still on the field: this is the last of it
//   kinWard                  a broken ring of ink turning on the ground under 袁洪 and a dark thread from him to each demon keeping it;
//                            a thread snaps when its demon falls; with the last, the ring breaks into ash
//   rout                     the routed leave dust behind them, Shang standards topple and lie, a pale wind blows after them
//   gateOpen, sortie         dust rolling out of the gate's mouth and warm light from within; dust rank by rank as the guard
//                            comes out; 妲己 and 胡喜媚 ride out in fox-fire, 王贵人 in a ring of string-sound (玉石琵琶精)
//   lastGuard                a hush: one ring of ink opening where the last guard fell
//   纣王 falls                摘星楼 alight on the skyline behind the fight (封神演义 ch. 97), flame climbing it; then the
//                            palace standards fall along the foot of the wall
const TAU = Math.PI * 2;
const ease = (u) => { const q = Math.min(1, Math.max(0, u)); return q * q * (3 - 2 * q); };
// the seven and their paintings, and how wide each is drawn (world units)
const DEMON = { yuanhong: ['fnYuanhong', 440], wulong: ['fnWulong', 300], changhao: ['fnChanghao', 290], daili: ['fnDaili', 300], jindasheng: ['fnJindasheng', 380], zhuzizhen: ['fnZhuzizhen', 360], yangxian: ['fnYangxian', 380] };
const FOX = { daji: 1, ximei: 1 };

export function createFinale({ W, GW, spic, ribbon, veil, ink }) {
  let clock = 0, G = null, prevBy = [], routAt = -9, lastWaveAt = -9, edgeAt = -9, gateAt = -9, gateK = 1, endAt = -9, lastPuff = -9, endGate = null;
  const lands = [], snaps = [], ashes = [], standards = [], puffs = [], rings = [], lieutenants = [];
  let fleeing = [], hostLast = null, fell = false;
  const foe = (id) => { const fs = G && G.foes; if (fs) for (let i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i]; return null; };
  const live = (f) => f && f.state !== 'dead';
  const GD = (c, n, X, Y, rot, kx, ky, a) => { if (GW && GW.ready && a > 0.004) GW.draw(c, n, X, Y, rot, kx, ky, a); };
  const cellW = (sheet, n) => { const C = sheet && sheet.cell(n); return C ? C[7] : 100; }, cellH = (sheet, n) => { const C = sheet && sheet.cell(n); return C ? C[8] : 100; };
  const gateOf = (id) => { const gs = (G && G.gates) || []; return gs.find((g) => g.id === id) || gs.find((g) => g.opensAfter === 'yuanhong') || gs[0] || null; };

  function onEvent(e, game) { if (game) G = game; const t = e.type;
    if (t === 'arrive' && DEMON[e.kind]) { const n = lands.filter((o) => o.at > clock - 0.6).length; lands.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, at: clock + n * 0.25 }); return; }
    if (t === 'arrive' && (FOX[e.kind] || e.kind === 'wanggui')) { lieutenants.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, at: clock }); return; }
    if (t === 'meishan') { edgeAt = clock; return; }
    if (t === 'lastWave') { lastWaveAt = clock; return; }
    if (t === 'kinWard') { const by = e.by || [];
      for (const id of prevBy) if (!by.includes(id)) { const d = foe(id), y = foe(e.id); snaps.push({ ax: y ? y.x : e.x, ay: y ? y.y : e.y, bx: d ? d.x : e.x + 200, by: d ? d.y : e.y, at: clock }); }
      if (!by.length && prevBy.length) { const y = foe(e.id); ashes.push({ x: y ? y.x : e.x, y: y ? y.y : e.y, at: clock }); }
      prevBy = by.slice(); return; }
    if (t === 'rout') { routAt = clock; topple(); return; }
    if (t === 'marchEnd') { for (const p of fleeing.slice(0, 20)) puffs.push({ x: p.x, y: p.y, dx: 0, dy: -1, at: clock, life: 0.7, k: 0.8 }); fleeing = []; return; }
    if (t === 'gateOpen') { const g = gateOf(e.id); if (!g || g.opensAfter !== 'yuanhong') return; gateAt = clock; gateK = 1; endGate = g;
      for (let i = 0; i < 8; i++) puffs.push({ x: g.x + (i / 7 - 0.5) * Math.min(g.hw || 120, 160) * 1.6, y: g.y + 20, dx: (i / 7 - 0.5) * 0.6, dy: 1, at: clock + i * 0.06, life: 1.6, k: 1.3 }); return; }
    if (t === 'sortie') { if (clock - lastPuff < 0.2) return; lastPuff = clock; puffs.push({ x: e.x, y: e.y, dx: 0, dy: 1, at: clock, life: 0.9, k: 0.9 }); return; }
    if (t === 'hostReserve') { gateAt = clock; gateK = 0.6; for (let i = 0; i < 5; i++) puffs.push({ x: e.x + (i - 2) * 40, y: e.y + 20, dx: (i - 2) * 0.15, dy: 1, at: clock + i * 0.08, life: 1.3, k: 1.1 }); return; }
    if (t === 'lastGuard') { const p = hostLast || { x: e.x, y: e.y }; rings.push({ x: p.x, y: p.y, at: clock }); return; }
    if (t === 'bossDown' && e.kind === 'zhouwang') { endAt = clock; return; }
  }

  // ---------------------------------------------------------------- the rout: up to twelve standards topple, spread over the host
  function topple() { const fs = ((G && G.foes) || []).filter((f) => live(f) && (f.flee || f.state === 'flee') && !f.tier), h = G && G.hero; if (!fs.length) return;
    if (h) fs.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const n = Math.min(12, fs.length), step = fs.length / n;
    for (let i = 0; i < n; i++) { const f = fs[Math.floor(i * step)]; standards.push({ x: f.x, y: f.y, side: i % 2 ? 1 : -1, at: clock + 0.1 + i * 0.13, life: 5.2, len: 150 }); } }

  // ---------------------------------------------------------------- the ground layer: under the figures
  function drawGround(c, V, game, dt) { clock += dt; if (game) G = game; const z = V.z;
    // the last wave: a dry ink ring drawn round the host, then fading
    if (clock - lastWaveAt < 3.2) { const t = clock - lastWaveAt, h = G && G.hero; if (h) { const R = 760, a = 0.45 * (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 2.3));
        ribbon(c, `wsweep_${Math.floor(clock * 3) % 2}`, (s) => [V.sx(h.x + Math.cos(s * TAU - 1.2) * R), V.sy(h.y + Math.sin(s * TAU - 1.2) * R * 0.8)], 0.7 * z, a, 0, ease(t / 0.9), 28, V); } }
    // the ward on 袁洪 and its threads
    const yh = ((G && G.foes) || []).find((f) => f.kind === 'yuanhong' && live(f)); const ids = yh && yh.kinK > 0 ? String(yh.kinKey || '').split(',').filter(Boolean) : [];
    if (yh && ids.length) { const X = V.sx(yh.x), Y = V.sy(yh.y), k = 360 * z / cellW(GW, 'gshock_0');
      GD(c, 'gshock_0', X, Y, clock * 0.4, k, k * V.KY, 0.7 * veil(V, X, Y - 30 * z));
      for (let j = 0; j < ids.length; j++) { const d = foe(+ids[j]) || foe(ids[j]); if (!live(d)) continue; const pulse = 0.7 + 0.3 * Math.sin(clock * 3 + j);
        const P = (s) => { const x = yh.x + (d.x - yh.x) * s, y = yh.y + (d.y - yh.y) * s; return [V.sx(x), V.sy(y) - (70 - 20 * s - 46 * Math.sin(s * Math.PI)) * z]; };
        ribbon(c, `wlash_${j % 3}`, P, 0.45 * z, 0.75 * pulse, 0, 1, 12, V); } }
    // a thread snapping: its two ends whip back toward 袁洪 and the demon and fade
    for (let i = 0; i < snaps.length; i++) { const o = snaps[i], q = (clock - o.at) / 0.45; if (q > 1) { snaps.splice(i--, 1); continue; }
      const P = (s) => [V.sx(o.ax + (o.bx - o.ax) * s), V.sy(o.ay + (o.by - o.ay) * s) - (70 - 20 * s) * z + Math.sin(s * 14 + q * 9) * 14 * q * z];
      ribbon(c, 'wlash_1', P, 0.32 * z, (1 - q) * 0.8, 0, 0.5 * (1 - q), 8, V); ribbon(c, 'wlash_0', P, 0.32 * z, (1 - q) * 0.8, 1 - 0.5 * (1 - q), 1, 8, V); }
    // the ward broken: the ring opens out and goes to ash
    for (let i = 0; i < ashes.length; i++) { const o = ashes[i], q = (clock - o.at) / 0.9; if (q > 1) { ashes.splice(i--, 1); continue; } const X = V.sx(o.x), Y = V.sy(o.y), k = 360 * z * (1 + 0.5 * q) / cellW(GW, 'gshock_0');
      GD(c, 'gshock_0', X, Y, clock * 0.4, k, k * V.KY, 0.7 * (1 - q) * veil(V, X, Y - 30 * z));
      for (let j = 0; j < 10; j++) { const b = j / 10 * TAU, r = (150 + 160 * q) * z, px = X + Math.cos(b) * r, py = Y + Math.sin(b) * r * V.KY - 60 * q * z; W.draw(c, `wdust_${j % 2}`, px, py, b, 0.5 * z, 0.5 * z, (1 - q) * 0.7 * veil(V, px, py)); } }
    // the rout's dust: one stroke per group of the routed, trailing behind them
    if (clock - routAt < 5) { const cells = new Map(); fleeing = [];
      for (const f of (G && G.foes) || []) { if (!live(f) || !(f.flee || f.state === 'flee')) continue; fleeing.push({ x: f.x, y: f.y }); const key = Math.floor(f.x / 220) + ',' + Math.floor(f.y / 220); let b = cells.get(key); if (!b) { if (cells.size >= 24) continue; cells.set(key, (b = { x: 0, y: 0, vx: 0, vy: 0, n: 0 })); } b.x += f.x; b.y += f.y; b.vx += f.vx || 0; b.vy += f.vy || 0; b.n++; }
      const a0 = Math.min(1, (clock - routAt) / 0.4);
      for (const b of cells.values()) { const x = b.x / b.n, y = b.y / b.n, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, X = V.sx(x - ux * 70), Y = V.sy(y - uy * 70);
        W.draw(c, `wdust_${(b.n + Math.floor(clock * 5)) % 2}`, X, Y, Math.atan2(uy * V.KY, ux), (0.6 + 0.08 * Math.min(6, b.n)) * z, 0.55 * z, 0.45 * a0 * veil(V, X, Y)); } }
    // the toppled standards: falling over, a puff of dust, lying, then gone
    for (let i = 0; i < standards.length; i++) { const o = standards[i], t = clock - o.at; if (t < 0) continue; if (t > o.life) { standards.splice(i--, 1); continue; }
      const u = ease(t / 0.35), X = V.sx(o.x), Y = V.sy(o.y), a = Math.min(1, t / 0.08) * (t > o.life - 0.8 ? (o.life - t) / 0.8 : 1);
      spic('fnFallenStandard', X + o.side * (1 - u) * 20 * z, Y - (1 - u) * 60 * z, o.side * (1 - u) * 1.1, o.len * z, a * 0.92 * veil(V, X, Y), o.side, 0.45 + 0.55 * u);
      if (t > 0.3 && t < 0.9) W.draw(c, `wdust_${i % 2}`, X, Y + 6 * z, 0, 0.7 * z, 0.5 * z, (1 - (t - 0.3) / 0.6) * 0.6); }
    // the gate: warm light fanning out of its mouth onto the field, then fading
    if (endGate && clock - gateAt < 2.6) { const t = clock - gateAt, g = endGate, X = V.sx(g.x), Y = V.sy(g.y), a = gateK * (t < 0.4 ? t / 0.4 : t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) / 1.2));
      const kh = Math.min(g.hw || 120, 160) * 2.2 * z / cellW(W, 'whalo_gold'); W.draw(c, 'whalo_gold', X, Y + 40 * z, 0, kh, kh * V.KY * 0.7, 0.5 * a * veil(V, X, Y));
      for (let j = 0; j < 5; j++) { const r = Math.PI / 2 + (j / 4 - 0.5) * 0.9, L = (320 + 60 * Math.sin(j * 3)) * z * (0.6 + 0.4 * ease(t / 0.6)); W.draw(c, `wray_${j % 2}`, X, Y + 10 * z, r - Math.PI / 2, 0.9 * z, L / cellH(W, 'wray_0'), 0.32 * a); } }
    // dust puffs (the gate, the sortie, the routed gone at the march's end)
    for (let i = 0; i < puffs.length; i++) { const o = puffs[i], t = clock - o.at; if (t < 0) continue; if (t > o.life) { puffs.splice(i--, 1); continue; } const q = t / o.life, X = V.sx(o.x + o.dx * 140 * q), Y = V.sy(o.y + o.dy * 140 * q);
      W.draw(c, `wdust_${i % 2}`, X, Y, 0, o.k * (0.7 + 0.6 * q) * z, o.k * (0.6 + 0.4 * q) * z, 0.55 * Math.min(1, t / 0.1) * (1 - q) * veil(V, X, Y)); }
    // the last guard: one ring of ink opening from where he fell
    for (const f of (G && G.foes) || []) if (f.host && live(f)) hostLast = { x: f.x, y: f.y };
    for (let i = 0; i < rings.length; i++) { const o = rings[i], q = (clock - o.at) / 1.2; if (q > 1) { rings.splice(i--, 1); continue; } const X = V.sx(o.x), Y = V.sy(o.y), k = (120 + 900 * ease(q)) * z / cellW(GW, 'gshock_0');
      GD(c, 'gshock_0', X, Y, 0, k, k * V.KY, 0.5 * (1 - q)); }
    // 纣王's end: the palace standards fall along the foot of the wall once the tower is alight
    if (endAt > 0 && !fell && clock - endAt > 1.5 && (endGate || gateOf(null))) { fell = true; const g = endGate || gateOf(null); for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, d = 260 + Math.floor(i / 2) * 260; standards.push({ x: g.x + s * d, y: g.y + 40, side: -s, at: clock + i * 0.14, life: 30, len: 190 }); } }
  }

  // ---------------------------------------------------------------- the layer over the figures: brief moments only
  function drawOver(c, V, game) { if (game) G = game; const z = V.z, H = c.canvas.height, Wd = c.canvas.width;
    // the seven come down
    for (let i = 0; i < lands.length; i++) { const o = lands[i], t = clock - o.at; if (t < 0) continue; if (t > 1.35) { lands.splice(i--, 1); continue; }
      const u = foe(o.id), x = u ? u.x : o.x, y = u ? u.y : o.y, X = V.sx(x), Y = V.sy(y), [pic, w] = DEMON[o.kind], drop = (1 - ease(t / 0.45)) * 300 * z;
      const a = Math.min(1, t / 0.15) * (t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.6));
      spic(pic, X, Y - drop - w * 0.42 * z, 0, w * z, 0.85 * a * veil(V, X, Y - w * 0.4 * z));
      if (o.kind === 'changhao') ribbon(c, 'wtoll_0', (s) => [X + Math.sin(s * 9 + t * 4) * 40 * z, Y - drop - (1 - s) * 330 * z], 3 * z, 0.6 * a, 0, ease(t / 0.4), 12, V);
      if (t > 0.4 && t < 1.2) { const q = (t - 0.4) / 0.8, k = (160 + 260 * q) * z / cellW(GW, 'gshock_0'); GD(c, 'gshock_1', X, Y, 0, k, k * V.KY, 0.45 * (1 - q)); } }
    // 妲己 and 胡喜媚 in fox-fire; 王贵人 in a ring of string-sound
    for (let i = 0; i < lieutenants.length; i++) { const o = lieutenants[i], t = clock - o.at; if (t > 1.4) { lieutenants.splice(i--, 1); continue; } const u = foe(o.id), X = V.sx(u ? u.x : o.x), Y = V.sy(u ? u.y : o.y), a = Math.min(1, t / 0.15) * Math.max(0, 1 - Math.max(0, t - 0.8) / 0.6);
      if (FOX[o.kind]) for (let j = 0; j < 3; j++) { const b = t * 3 + j * TAU / 3, px = X + Math.cos(b) * 60 * z, py = Y - (70 + 30 * Math.sin(b)) * z; GD(c, 'gsoul', px, py, Math.cos(b) * 0.4, 0.7 * z, 0.7 * z, 0.8 * a * veil(V, px, py)); }
      else ribbon(c, `wtoll_${i % 2}`, (s) => { const b = s * TAU, R = (70 + 120 * ease(t / 0.6)) * z; return [X + Math.cos(b) * R, Y - 40 * z + Math.sin(b) * R * V.KY]; }, 3.6 * z, a, 0, 1, 24, V); }
    // meishan: grey wash closing in from the edges of the view for a moment
    if (clock - edgeAt < 1.7) { const t = clock - edgeAt, a = (t < 0.4 ? t / 0.4 : t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 0.6)) * 0.5, k = Wd / 900;
      for (let j = 0; j < 7; j++) { const x = (j + 0.5) * Wd / 7; W.draw(c, `wcloud_${j % 2}`, x, H * 0.04, 0, (j % 2 ? -k : k), k * 0.8, a); W.draw(c, `wcloud_${(j + 1) % 2}`, x, H * 0.97, Math.PI, k, k * 0.8, a * 0.8); }
      for (let j = 0; j < 4; j++) { const y = (j + 0.5) * H / 4; W.draw(c, `wcloud_${j % 2}`, Wd * 0.02, y, Math.PI / 2, k * 0.8, k * 0.7, a * 0.8); W.draw(c, `wcloud_${(j + 1) % 2}`, Wd * 0.98, y, -Math.PI / 2, k * 0.8, k * 0.7, a * 0.8); } }
    // the rout: a pale wind blowing after the routed from behind the hero
    if (clock - routAt < 1.8 && G && G.hero) { const t = clock - routAt, h = G.hero; let sx = 0, sy = 0; for (const p of fleeing) { sx += p.x - h.x; sy += p.y - h.y; } const d = Math.atan2(sy, sx || 1), a = Math.min(1, t / 0.3) * Math.max(0, 1 - Math.max(0, t - 0.9) / 0.9);
      for (let j = 0; j < 3; j++) { const r = 160 + 320 * ease(t / 1.6) + j * 90, b = d + (j - 1) * 0.35, X = V.sx(h.x + Math.cos(b) * r), Y = V.sy(h.y + Math.sin(b) * r) - 60 * z, k = 0.55 * z;
        GD(c, `gwind_${j % 2}`, X, Y, Math.atan2(Math.sin(b) * V.KY, Math.cos(b)), k, k * 0.7, 0.35 * a * veil(V, X, Y)); } }
    // 纣王's end: 摘星楼 alight on the skyline, the fire climbing it from the foot (2.5 s), then burning on
    if (endAt > 0) { const t = clock - endAt, g = endGate || gateOf(null), h = G && G.hero, HX = h ? V.sx(h.x) : Wd / 2; let X = g ? V.sx(g.x + 700) : Wd * 0.7;
      if (Math.abs(X - HX) < Wd * 0.18) X = HX + (X < HX ? -1 : 1) * Wd * 0.18; X = Math.min(Wd * 0.88, Math.max(Wd * 0.12, X));
      const len = H * 0.19, Yb = Math.max(H * 0.36, Math.min(g ? V.sy(g.y) - 40 * z : H * 0.36, H * 0.42)), top = Yb - len * 512 / 322, up = ease(t / 1.6), cut = Yb - (Yb - top) * up;
      const a = Math.min(1, t / 0.4) * 0.95 * veil(V, X, Yb - len);
      if (c.scissor) c.scissor([0, cut, Wd, H]); spic('fnZhaixing', X, Yb - (512 - 231) * len / 322, 0, len, a); if (c.scissor) c.scissor(null);
      if (t < 2.5) for (let j = 0; j < 3; j++) { const fx = X + (j - 1) * len * 0.18, fy = cut + 10 * z; W.draw(c, `wflame_${(j + Math.floor(t * 8)) % 2}`, fx, fy, 0, 0.42 * z, (0.42 + 0.14 * Math.sin(t * 13 + j)) * z, 0.6 * Math.min(1, t / 0.2) * (1 - Math.max(0, t - 2) / 0.5)); } }
  }

  function reset() { lands.length = snaps.length = ashes.length = standards.length = puffs.length = rings.length = lieutenants.length = 0; prevBy = []; fleeing = []; hostLast = null; endGate = null; fell = false; routAt = lastWaveAt = edgeAt = gateAt = endAt = lastPuff = -9; }
  return { onEvent, drawGround, drawOver, reset };
}
