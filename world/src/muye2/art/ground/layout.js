// The field of a run, by seed: pure data, no images, no DOM. The art draws from it, and the rules may import it to know
// where the landmarks and the water are (lab/game-studies/PLAN-CAMPAIGN.md section 7).
//
//   layoutOf(seed, scene = 'xiqi') -> {
//     scene, seed, course, mirror,              which of the baked river courses, and whether the field is turned over
//     weather: 'clear'|'mist'|'rain'|'snow', hour: 'dawn'|'day'|'dusk',
//     start: [x, y],                            where the hero begins
//     places: [{id, kind, x, y, r}],            landmarks: kind 'altar' | 'granary' | 'camp' | 'platform'; r is the reach
//                                               of the place (a rider inside r is "at" it)
//     waters: [{pts: [[x, y, w]], fords: [[x, y]]}],  the river (and tributary) in world units, half-width w
//     patches, props, mist                       what the art lays on the ground (pieces by atlas cell name)
//   }
// Everything random comes from the seed, so the same seed gives the same field to the art and to the rules.
import { COURSES as XIQI } from './baked/xiqi/courses.js';
import { COURSES as PASSES } from './baked/passes/courses.js';
import { COURSES as MENGJIN } from './baked/mengjin/courses.js';
const COURSES_OF = { xiqi: XIQI, passes: PASSES, mengjin: MENGJIN };

export const WORLD = 6000, START = [3000, 3000];
const rng = (seed) => { let s = (seed >>> 0) ^ 0x9E3779B9; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, list) => { let sum = 0; for (const e of list) sum += e[1]; let v = r() * sum; for (const e of list) { if ((v -= e[1]) < 0) return e[0]; } return list[0][0]; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Catmull-Rom along a list of points, t in 0..1 -> [x, y, w, dx, dy]
function along(P, t) {
  const n = P.length - 1, f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, g = (k) => P[clamp(k, 0, n)], a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
  const q = (m) => 0.5 * (2 * b[m] + (c[m] - a[m]) * u + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u * u + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u * u);
  const dq = (m) => 0.5 * ((c[m] - a[m]) + 2 * (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * u + 3 * (3 * b[m] - a[m] - 3 * c[m] + d[m]) * u * u);
  const dx = dq(0), dy = dq(1), l = Math.hypot(dx, dy) || 1; return [q(0), q(1), b[2] + (c[2] - b[2]) * u, dx / l, dy / l];
}
export const WEATHER = [['clear', 40], ['mist', 25], ['rain', 18], ['snow', 17]], HOURS = [['dawn', 30], ['day', 40], ['dusk', 30]];
// each scene's own odds: mist and wind-blown dust in the passes (渑池: 走石飛砂), the river crossing under heavy cloud
export const SCENE_WEATHER = { xiqi: WEATHER, passes: [['clear', 25], ['mist', 35], ['dust', 22], ['snow', 18]], mengjin: [['clear', 35], ['mist', 20], ['rain', 25], ['dust', 20]] };
// how many of each landmark a run has, and how far a rider reaches into it
export const PLACE_KINDS = { platform: { n: 1, r: 260 }, altar: { n: 2, r: 220 }, granary: { n: 2, r: 240 }, camp: { n: 2, r: 260 }, gate: { r: 0 } };
// which landmarks each scene has (a gate is not a reward: it is where the pass or the city is shut; its r is its half-width)
// (the same set as the rules' LANDMARKS: one altar, two granaries, one 封神台 (platform), two camps, in every scene)
const SET = ['platform', 'granary', 'granary', 'altar', 'camp', 'camp'], SCENE_PLACES = { xiqi: SET, passes: SET, mengjin: SET };

export function layoutOf(seed = 1, scene = 'xiqi') {
  const COURSES = COURSES_OF[scene] || XIQI, r = rng(seed * 7919 + (scene === 'passes' ? 101 : scene === 'mengjin' ? 211 : 0)), R = (a, b) => a + r() * (b - a);
  const course = Math.floor(r() * COURSES.length) % COURSES.length, mirror = r() < 0.5, mx = (x) => (mirror ? WORLD - x : x), C0 = COURSES[course];
  const weather = pick(r, SCENE_WEATHER[scene] || WEATHER), hour = scene === 'mengjin' && r() < 0.4 ? 'dusk' : pick(r, HOURS);
  if (scene === 'passes') return passes();
  if (scene === 'mengjin') return mengjin();
  const waters = COURSES[course].waters.map((w) => ({ pts: w.pts.map(([x, y, hw]) => [mx(x), y, hw]), fords: w.fords.map((t) => { const a = along(w.pts, t); return [Math.round(mx(a[0])), Math.round(a[1])]; }), bars: w.bars }));
  // distance to water (beyond its bank), sampled
  const samples = []; for (const w of waters) for (let t = 0; t <= 1; t += 0.004) { const a = along(w.pts, t); samples.push([a[0], a[1], a[2], a[3], a[4]]); }
  const wet = (x, y) => { let d = 1e9; for (const s of samples) d = Math.min(d, Math.hypot(s[0] - x, s[1] - y) - s[2]); return d; };
  const places = [], patches = [], props = [], mist = [];
  const free = (x, y, rad) => places.every((p) => Math.hypot(p.x - x, p.y - y) > rad);
  // ---- landmarks: inside the field, away from the start and the water, apart from each other
  let id = 0;
  for (const kind of SCENE_PLACES.xiqi) {
    for (let tries = 0; tries < 400; tries++) {
      const x = R(800, WORLD - 800), y = R(800, WORLD - 900), spread = tries < 250 ? 1500 : 1100;
      if (Math.hypot(x - START[0], y - START[1]) < 950 || wet(x, y) < 380 || !free(x, y, spread)) continue;
      places.push({ id: kind + (id++), kind, x: Math.round(x), y: Math.round(y), r: PLACE_KINDS[kind].r }); break;
    }
  }
  const near = (x, y, rad) => places.some((p) => Math.hypot(p.x - x, p.y - y) < rad);
  const prop = (cell, x, y, flip = r() < 0.5 ? -1 : 1, rad = 16) => props.push({ cell, x: Math.round(x), y: Math.round(y), flip, r: rad });
  const patch = (cell, x, y, flip = r() < 0.5 ? -1 : 1) => patches.push({ cell, x: Math.round(x), y: Math.round(y), flip });
  // ---- each landmark is a place: its painted ground and standing part, and trees round it
  dress(places, prop, patch, R, r);
  // ---- tracks armies have worn across the field: long lines of trodden ground, chained piece to piece
  for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) { let x = R(-200, 600), y = R(900, WORLD - 900), dy = R(-0.25, 0.25); if (r() < 0.5) { x = WORLD + 200 - x; }
    const dir = x < WORLD / 2 ? 1 : -1; for (let j = 0; j < 6; j++) { if (wet(x, y) > 120 && !near(x, y, 450)) patch('march' + (j % 2), x, y); x += dir * 1350; y += dy * 1350 + R(-80, 80); if (x < -400 || x > WORLD + 400) break; } }
  // ---- rises with groves and rocks on them: the edges of clearings
  for (let i = 0, n = 8 + Math.floor(r() * 4); i < n; i++) for (let tries = 0; tries < 60; tries++) {
    const x = R(300, WORLD - 300), y = R(400, WORLD - 300); if (Math.hypot(x - START[0], y - START[1]) < 800 || wet(x, y) < 220 || near(x, y, 650)) continue;
    patch('rise' + Math.floor(r() * 2), x, y);
    for (let j = 0, m = 3 + Math.floor(r() * 5); j < m; j++) { const a = R(0, Math.PI * 2), d = R(60, 340); const kind = r(); prop(kind < 0.55 ? 'pt-pine' + Math.floor(r() * 4) : kind < 0.85 ? 'pt-tree' + [0, 1, 3][Math.floor(r() * 3)] : 'pt-rock' + Math.floor(r() * 5), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6); }
    if (r() < 0.6) prop('pt-rock' + Math.floor(r() * 5), x + R(-200, 200), y + R(80, 200), undefined, 60);
    break;
  }
  // ---- by the water: willows, reeds, rocks, a road down to each ford
  for (const w of waters) {
    for (let t = 0.02; t < 1; t += R(0.03, 0.07)) { const a = along(w.pts, t), s = r() < 0.5 ? -1 : 1, d = (a[2] + R(50, 140)) * s, x = a[0] - a[4] * d, y = a[1] + a[3] * d;
      if (x < 100 || x > WORLD - 100 || y < 100 || y > WORLD - 100 || near(x, y, 400)) continue; const k = r(); if (k < 0.6) prop('pt-tree' + [0, 1, 3][Math.floor(r() * 3)], x, y); else if (k < 0.75) prop('pt-rock' + Math.floor(r() * 5), x, y); }
    for (const [fx, fy] of w.fords) { patch('track' + Math.floor(r() * 2), fx, fy - 520); patch('track' + Math.floor(r() * 2), fx, fy + 520); }
  }
  // ---- the open ground: meadows and bare earth, sparse stones, few things standing; kept quietest round the start
  for (let j = 0; j * 540 < WORLD; j++) for (let i = 0; i * 540 < WORLD; i++) {
    const x = (i + 0.1 + 0.8 * r()) * 540, y = (j + 0.1 + 0.8 * r()) * 540; if (wet(x, y) < 120 || near(x, y, 420)) continue; const k = r();
    if (k < 0.42) patch('meadow' + Math.floor(r() * 3), x, y); else if (k < 0.62) patch('earth' + Math.floor(r() * 2), x, y); else if (k < 0.74) patch('stones' + Math.floor(r() * 2), x, y);
    for (let q = 0, m = 2 + Math.floor(r() * 3); q < m; q++) { const tx = x + R(-260, 260), ty = y + R(-260, 260); if (wet(tx, ty) > 60 && !near(tx, ty, 380)) patch(r() < 0.82 ? 'tuft' + Math.floor(r() * 4) : 'stones' + Math.floor(r() * 2), tx, ty); }
    if (r() < 0.22 && Math.hypot(x - START[0], y - START[1]) > 500) { const q = r(); prop(q < 0.4 ? 'pt-pine' + Math.floor(r() * 4) : q < 0.7 ? 'pt-tree' + [0, 1, 3][Math.floor(r() * 3)] : 'pt-rock' + Math.floor(r() * 5), x + R(-200, 200), y + R(-200, 200)); }
  }
  // ---- mist lying in bands across the field (more of it in mist)
  for (let i = 0, n = weather === 'mist' ? 34 : weather === 'clear' ? 18 : 22; i < n; i++) mist.push({ cell: 'mist' + Math.floor(r() * 3), x: Math.round(R(-200, WORLD + 200)), y: Math.round(R(200, WORLD)), k: R(1.6, 2.8), a: R(0.35, 0.7), drift: R(4, 12) });
  // the world's own order: what lies is drawn in this order; what stands is sorted by y with the figures
  patches.sort((a, b) => (ORDER[a.cell.replace(/\d+$/, '')] ?? (a.cell.endsWith('.g') ? ORDER_LAST : 2)) - (ORDER[b.cell.replace(/\d+$/, '')] ?? (b.cell.endsWith('.g') ? ORDER_LAST : 2)));
  return { scene, seed, course, mirror, weather, hour, start: START.slice(), places, waters, patches, props, mist };

  // ------------------------------------------------------------------ scene two: the passes
  function passes() {
    const cor = C0.corridor.map(([x, y, w]) => [mx(x), y, w]), corAt = (y) => { let i = 0; while (i < cor.length - 2 && y > cor[i + 1][1]) i++; const a = cor[i], b = cor[i + 1], u = clamp((y - a[1]) / (b[1] - a[1]), 0, 1), e = u * u * (3 - 2 * u); return [a[0] + (b[0] - a[0]) * e, a[2] + (b[2] - a[2]) * e]; };
    const waters = C0.waters.map((w) => ({ pts: w.pts.map(([x, y, hw]) => [mx(x), y, hw]), fords: w.fords.map((t) => { const a = along(w.pts, t); return [Math.round(mx(a[0])), Math.round(a[1])]; }), bars: w.bars }));
    const places = [], patches = [], props = [], mist = [], P = (cell, x, y, flip = r() < 0.5 ? -1 : 1, rad = 16) => props.push({ cell, x: Math.round(x), y: Math.round(y), flip, r: rad }), G = (cell, x, y, flip = r() < 0.5 ? -1 : 1) => patches.push({ cell, x: Math.round(x), y: Math.round(y), flip });
    const start = [Math.round(corAt(5500)[0]), 5500];
    // the gates across the corridor: walls with a tower, shut until the stretch's boss falls (rules); the corridor is narrow there
    C0.gates.forEach((gy, i) => { const [gx, hw] = corAt(gy); places.push({ id: 'gate' + i, kind: 'gate', x: Math.round(gx), y: gy, r: Math.round(hw) }); G('gate.g', gx, gy, 1); P('pt-gate', gx, gy, 1, Math.round(hw)); });
    let id = 0; for (const kind of SCENE_PLACES.passes) for (let tries = 0; tries < 600; tries++) { const y = R(500, 5300), [cx, hw] = corAt(y), x = cx + R(-1, 1) * Math.max(0, hw - 280);
      if (Math.hypot(x - start[0], y - start[1]) < 800 || C0.gates.some((g) => Math.abs(g - y) < 480) || !places.every((q) => Math.hypot(q.x - x, q.y - y) > Math.max(480, 950 - tries))) continue;
      places.push({ id: kind + (id++), kind, x: Math.round(x), y: Math.round(y), r: PLACE_KINDS[kind].r }); break; }
    dress(places, P, G, R, r);
    // the walls of the valley: cliffs standing along both edges, close together, the mountain beyond them strewn with pines and rocks
    for (let y = -200; y < WORLD + 300; y += R(170, 260)) { const [cx, hw] = corAt(y); for (const s of [-1, 1]) { const x = cx + s * (hw + R(20, 120)); P('pc-cliff' + Math.floor(r() * 4), x, y, s < 0 ? 1 : -1, 90);
      for (let j = 0; j < 2; j++) { const xx = cx + s * (hw + R(260, 900)), yy = y + R(-120, 120), k = r(); if (k < 0.5) P('pt-pine' + Math.floor(r() * 4), xx, yy); else if (k < 0.8) P('pt-rock' + Math.floor(r() * 5), xx, yy, undefined, 40); } } }
    // the valley floor: scree at the edges, stones and tufts, the stream's willows; mist in the passes
    for (let y = 0; y < WORLD; y += 200) { const [cx, hw] = corAt(y); for (let q = 0; q < 7; q++) { const x = cx + R(-1, 1) * hw, k = r(); if (Math.abs(x - cx) > hw - 160) G('stones' + Math.floor(r() * 2), x, y + R(-100, 100)); else if (k < 0.55) G('tuft' + Math.floor(r() * 4), x, y + R(-100, 100)); else if (k < 0.7) G('stones' + Math.floor(r() * 2), x, y + R(-100, 100)); else if (k < 0.78) G('earth' + Math.floor(r() * 2), x, y); }
      if (r() < 0.16) { const x = cx + R(-1, 1) * (hw - 120); if (!places.some((q) => Math.hypot(q.x - x, q.y - y) < 420) && !C0.gates.some((g) => Math.abs(g - y) < 260)) P('pt-rock' + Math.floor(r() * 5), x, y + R(-80, 80), undefined, 40); } }
    for (let i = 0, n = weather === 'mist' ? 34 : 20; i < n; i++) { const y = R(0, WORLD), [cx] = corAt(y); mist.push({ cell: 'mist' + Math.floor(r() * 3), x: Math.round(cx + R(-900, 900)), y: Math.round(y), k: R(1.6, 2.8), a: R(0.35, 0.7), drift: R(4, 12) }); }
    patches.sort((a, b) => (ORDER[a.cell.replace(/\d+$/, '')] ?? (a.cell.endsWith('.g') ? ORDER_LAST : 2)) - (ORDER[b.cell.replace(/\d+$/, '')] ?? (b.cell.endsWith('.g') ? ORDER_LAST : 2)));
    return { scene, seed, course, mirror, weather, hour, start, places, waters, corridor: cor, gates: C0.gates.slice(), patches, props, mist };
  }
  // ------------------------------------------------------------------ scene three: the crossing at Mengjin to the walls of Zhaoge
  function mengjin() {
    const waters = C0.waters.map((w) => ({ pts: w.pts.map(([x, y, hw]) => [mx(x), y, hw]), fords: w.fords.map((t) => { const a = along(w.pts, t); return [Math.round(mx(a[0])), Math.round(a[1])]; }), bars: w.bars }));
    const samples = []; for (const w of waters) for (let t = 0; t <= 1; t += 0.004) { const a = along(w.pts, t); samples.push(a); }
    const wet = (x, y) => { let d = 1e9; for (const s of samples) d = Math.min(d, Math.hypot(s[0] - x, s[1] - y) - s[2]); return d; }, riverY = (x) => { let best = null; for (const s of samples) if (!best || Math.abs(s[0] - x) < Math.abs(best[0] - x)) best = s; return best; };
    const places = [], patches = [], props = [], mist = [], P = (cell, x, y, flip = r() < 0.5 ? -1 : 1, rad = 16) => props.push({ cell, x: Math.round(x), y: Math.round(y), flip, r: rad }), G = (cell, x, y, flip = r() < 0.5 ? -1 : 1) => patches.push({ cell, x: Math.round(x), y: Math.round(y), flip });
    const ford = waters[0].fords[0], fr = riverY(ford[0]), start = [ford[0] + 200, Math.round(fr[1] + 140)], wallY = C0.wall, gateX = C0.gate;
    // the walls of Zhaoge across the north edge, its great gate in the middle (where King Zhou comes out)
    places.push({ id: 'citygate', kind: 'gate', x: gateX, y: wallY, r: 420 });
    // the wall: one wing of the painted gate, 325 units wide, repeated and turned over by turns along the whole north edge
    // the wall: two plain stretches and a tower cut from the painted gate (imagegen/raw/z1-gate), a tower every fifth piece
    for (const s of [-1, 1]) for (let i = 0, x = gateX + s * 500; x > -300 && x < WORLD + 300; i++) { const tower = i % 5 === 3; P('pt-citywall' + (tower ? 2 : (i + (s > 0 ? 1 : 0)) % 2), x, wallY + (tower ? 2 : 0), 1, 200); x += s * (tower ? 100 : 82); }
    G('citygate.g', gateX, wallY, 1); P('pt-citygate', gateX, wallY, 1, 420);
    // behind the wall the palace city: 摘星楼 and 鹿台 rising over it under the cloud (drawn before the wall: its foot is north of it)
    P('pt-zgterrace0', gateX + 470, wallY - 120, 1, 60); P('pt-zgtower0', gateX - 470, wallY - 45, 1, 60);
    // the palace standards: lining the way out of the gate, and along the foot of the wall
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P('pt-banner' + [0, 1, 2, 4, 3][(i * 2 + (s > 0 ? 1 : 0)) % 5], gateX + s * (215 + i * 30), wallY + 150 + i * 190, 1, 14);
    for (let x = gateX - 2300; x < gateX + 2400; x += 380) if (Math.abs(x - gateX) > 520) P('pt-banner' + [0, 1, 2, 4][Math.floor(r() * 4)], x + R(-40, 40), wallY + 70, 1, 14);
    // the crossing: boats along the sand tongue, the lords' camp on the south bank by it
    for (let i = 0; i < 4; i++) { const x = ford[0] + (i - 1.5) * 420 + R(-80, 80), y = fr[1] + (i % 2 ? -0.45 : 0.3) * fr[2] + R(-40, 40); P('pt-boat' + (i % 2), x, y, r() < 0.5 ? -1 : 1, 50); }
    G('lords.g', ford[0] + 900, Math.round(fr[1] + fr[2] + 700));
    let id = 0; for (const kind of SCENE_PLACES.mengjin) for (let tries = 0; tries < 800; tries++) { const x = R(800, WORLD - 800), y = R(wallY + 900, 4000);
      if (wet(x, y) < 400 || Math.hypot(x - gateX, y - wallY) < 1100 || Math.hypot(x - ford[0] - 900, y - fr[1] - fr[2] - 700) < 950 || !places.every((q) => Math.hypot(q.x - x, q.y - y) > Math.max(700, 1300 - tries))) continue; places.push({ id: kind + (id++), kind, x: Math.round(x), y: Math.round(y), r: PLACE_KINDS[kind].r }); break; }
    dress(places, P, G, R, r);
    const near = (x, y, rad) => places.some((p) => Math.hypot(p.x - x, p.y - y) < rad);
    for (let j = 0; j * 540 < WORLD; j++) for (let i = 0; i * 540 < WORLD; i++) { const x = (i + 0.1 + 0.8 * r()) * 540, y = (j + 0.1 + 0.8 * r()) * 540; if (y < wallY + 200 || wet(x, y) < 140 || near(x, y, 420)) continue; const k = r();
      if (k < 0.3) G('earth' + Math.floor(r() * 2), x, y); else if (k < 0.45) G('meadow' + Math.floor(r() * 3), x, y); else if (k < 0.6) G('stones' + Math.floor(r() * 2), x, y);
      for (let q = 0, m = 2 + Math.floor(r() * 2); q < m; q++) G(r() < 0.8 ? 'tuft' + Math.floor(r() * 4) : 'stones' + Math.floor(r() * 2), x + R(-260, 260), y + R(-260, 260));
      if (r() < 0.12) P(r() < 0.6 ? 'pt-tree' + [0, 1, 3][Math.floor(r() * 3)] : 'pt-rock' + Math.floor(r() * 5), x + R(-200, 200), y + R(-200, 200)); }
    for (let t = 0.02; t < 1; t += R(0.04, 0.08)) { const a = along(waters[0].pts, t), s = r() < 0.5 ? -1 : 1, d = (a[2] + R(60, 160)) * s; if (Math.abs(a[0] - ford[0]) < 500) continue; P('pt-tree' + [0, 1, 3][Math.floor(r() * 3)], a[0] - a[4] * d, a[1] + a[3] * d); }
    // rises with groves and rocks on the plain north of the river (the Shang farmland is open; these are its edges)
    for (let i = 0, n = 7 + Math.floor(r() * 3); i < n; i++) for (let tries = 0; tries < 60; tries++) { const x = R(300, WORLD - 300), y = R(wallY + 900, 4000); if (wet(x, y) < 300 || near(x, y, 650)) continue;
      G('rise' + Math.floor(r() * 2), x, y); for (let j = 0, m = 3 + Math.floor(r() * 4); j < m; j++) { const a = R(0, Math.PI * 2), d = R(60, 320), k = r(); P(k < 0.5 ? 'pt-tree' + [0, 1, 3][Math.floor(r() * 3)] : k < 0.8 ? 'pt-pine' + Math.floor(r() * 4) : 'pt-rock' + Math.floor(r() * 5), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6); } break; }
    for (let i = 0; i < 3; i++) { let x = R(-200, 600), y = R(wallY + 900, 3800); if (r() < 0.5) x = WORLD + 200 - x; const dir = x < WORLD / 2 ? 1 : -1; for (let j = 0; j < 6; j++) { if (!near(x, y, 450)) G('march' + (j % 2), x, y); x += dir * 1350; y += R(-200, 200); } }
    for (let i = 0, n = weather === 'mist' ? 30 : 16; i < n; i++) mist.push({ cell: 'mist' + Math.floor(r() * 3), x: Math.round(R(-200, WORLD + 200)), y: Math.round(R(wallY + 300, WORLD)), k: R(1.6, 2.8), a: R(0.35, 0.7), drift: R(4, 12) });
    patches.sort((a, b) => (ORDER[a.cell.replace(/\d+$/, '')] ?? (a.cell.endsWith('.g') ? ORDER_LAST : 2)) - (ORDER[b.cell.replace(/\d+$/, '')] ?? (b.cell.endsWith('.g') ? ORDER_LAST : 2)));
    return { scene, seed, course, mirror, weather, hour, start, places, waters, wall: wallY, gate: gateX, patches, props, mist };
  }
}
// what each landmark is made of: its painted ground (`<kind>.g`) under the figures, its painted standing part, a few trees
function dress(places, P, G, R, r) {
  for (const p of places) { if (p.kind === 'gate') continue; const f = r() < 0.5 ? -1 : 1;
    G(p.kind + '.g', p.x, p.y, 1); P('pt-' + p.kind, p.kind === 'granary' ? p.x + (365 - 700) * 0.72 : p.kind === 'camp' ? p.x + (740 - 760) * 0.7 : p.x, p.kind === 'granary' ? p.y + (525 - 500) * 0.72 / 0.62 : p.kind === 'camp' ? p.y + (455 - 560) * 0.7 / 0.62 : p.y, 1, p.kind === 'platform' ? 230 : p.kind === 'camp' ? 120 : 160);
    // the granary's back pair and barn stand at their own feet (source px x 0.72 from the yard's anchor), so a rider can pass behind the front one
    if (p.kind === 'camp') for (const [n, fx, fy] of [['pt-camp-b', 960, 525], ['pt-camp-c', 1080, 672], ['pt-camp-d', 1100, 465]]) P(n, p.x + (fx - 760) * 0.7, p.y + (fy - 560) * 0.7 / 0.62, 1, 70);
    if (p.kind === 'granary') { P('pt-granary2', p.x + (670 - 700) * 0.72, p.y + (420 - 500) * 0.72 / 0.62, 1, 120); P('pt-barn', p.x + (1100 - 700) * 0.72, p.y + (470 - 500) * 0.72 / 0.62, 1, 120); }
    for (let i = 0; i < 2; i++) { const a = R(0, Math.PI * 2), d = R(480, 640); P(r() < 0.6 ? 'pt-pine' + Math.floor(r() * 4) : 'pt-tree' + [0, 1, 3][Math.floor(r() * 3)], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, f); } }
}
const ORDER = { rise: 0, fields: 1, meadow: 2, earth: 2, march: 2.5, stones: 3, track: 3, tuft: 3.5, moss: 3.5 };   // what lies is drawn in this order (a landmark's painted ground last)
const ORDER_LAST = 4;

// ------------------------------------------------------------------ for the rules: the field of a scene as the rules count scenes
// index 0 西岐, 1 the passes, 2 孟津 · 朝歌, 3 the walls of 朝歌 (the same field as 2). Pure; the same seed gives the art's field.
//   start: [x, y]                    where the riders stand when the scene opens (move them there at march t = 0.5)
//   places: [{id, kind, x, y, r}]    landmarks; kind as the rules' LANDMARKS ('fengshen' | 'altar' | 'granary' | 'camp');
//                                    r is the drawn yard (the building stands in the middle 0.6 r: spawn nobody there)
//   gates: [{id, x, y, hw, opensAfter}]  walls across the passes (scene 1): nobody crosses y within 40 of a shut gate's line;
//                                    opensAfter 'small0' | 'small1' (the stretch's small bosses, nearest the start first).
//                                    Scene 2 and 3: the city gate {id: 'citygate', x: 3000, y: wall, hw: 420} (纣王 comes out of it)
//   waters: [{pts: [[x, y, hw]], fords: [[x, y]]}]   river centre line with half-widths; fords are where it is crossed
//   bounds(y) -> [xmin, xmax]        the walkable left and right at row y; top / bottom: [ymin, ymax]
//   inside(x, y) -> bool             walkable (bounds and walls; shut gates are the rules' own state)
export const SCENE_OF = ['xiqi', 'passes', 'mengjin', 'mengjin'];
export function fieldOf(seed, index = 0) {
  const L = layoutOf(seed, SCENE_OF[index] || 'xiqi'), E = 40, kind = (k) => (k === 'platform' ? 'fengshen' : k);
  const places = L.places.filter((p) => p.kind !== 'gate').map((p) => ({ id: index + ':' + p.id, kind: kind(p.kind), x: p.x, y: p.y, r: p.r }));
  let gates = [], bounds = () => [E, WORLD - E], top = E;
  if (L.corridor) {
    const cor = L.corridor, at = (y) => { let i = 0; while (i < cor.length - 2 && y > cor[i + 1][1]) i++; const a = cor[i], b = cor[i + 1], u = clamp((y - a[1]) / (b[1] - a[1]), 0, 1), e = u * u * (3 - 2 * u); return [a[0] + (b[0] - a[0]) * e, a[2] + (b[2] - a[2]) * e]; };
    bounds = (y) => { const [cx, hw] = at(y); return [Math.max(E, cx - hw + E), Math.min(WORLD - E, cx + hw - E)]; };
    gates = L.places.filter((p) => p.kind === 'gate').sort((a, b) => Math.abs(a.y - L.start[1]) - Math.abs(b.y - L.start[1])).map((p, i) => ({ id: index + ':' + p.id, x: p.x, y: p.y, hw: p.r, opensAfter: 'small' + i }));
  }
  if (L.wall) { top = L.wall + 80; gates = [{ id: index + ':citygate', x: L.gate, y: L.wall, hw: 420, opensAfter: 'yuanhong' }]; }
  const ys = [top, WORLD - E];
  return { scene: L.scene, index, start: L.start, places, gates, waters: L.waters, bounds, ys, inside: (x, y) => { if (y < ys[0] || y > ys[1]) return false; const [a, b] = bounds(y); return x >= a && x <= b; } };
}
