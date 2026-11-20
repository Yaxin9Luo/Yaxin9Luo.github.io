// 法相: the great image that stands behind a general when he shows his true form. Five line figures in the manner of
// temple murals and water-and-land paintings (looked at: the Chaoyuan murals of Yongle Palace on Wikimedia Commons, and
// the Qing ink album 《封神真形圖》): a line of even strength ("iron wire"), long drapery in bundles of folds, ribbons in
// arcs, an aureole; filled only with thin washes, so that the battle reads through. Drawn by code; no film, game or
// animation was a model. What each holds follows research_notes/Fengshen content catalogue.md.
//
//   FAXIANG[id] = {w, h, pivot: [x, y]}             the picture's size in its own pixels and where its feet stand
//   drawFaxiang(ctx, id, x, y, k = 1, alpha = 1)    paints it with the pivot at (x, y); k scales it
//   bakeFaxiang(id, k = 1) -> canvas                the same on its own transparent canvas (lines never thinner than 1 px)
// Ids: nezha, yangjian, leizhenzi, dengchanyu, huangfeihu. (土行孙 has no image: the earth opens instead.)
const INK = '#40372e', GOLD = '#B08A3C', RED = '#B8321F', AZU = '#3F639A', MAL = '#3F7D6A', OCH = '#9A7647', DARK = '#2a241e', PALE = '#EFE7D6';
const W = 820, H = 960, CX = 410, FEET = 930;
export const FAXIANG = Object.fromEntries(['nezha', 'yangjian', 'leizhenzi', 'dengchanyu', 'huangfeihu'].map((id) => [id, { w: W, h: H, pivot: [CX, FEET] }]));

// ------------------------------------------------------------------ the pen
let c = null, MINW = 0;
/** a smooth path through the points (Catmull-Rom); a point [x, y, 1] is a hard corner */
function trace(pts, closed) {
  const n = pts.length; c.beginPath(); if (n < 2) return; c.moveTo(pts[0][0], pts[0][1]);
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), k1 = p1[2] ? 0 : 1 / 6, k2 = p2[2] ? 0 : 1 / 6;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1, p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2, p2[0], p2[1]); }
  if (closed) c.closePath();
}
/** the same path as points a few pixels apart */
function dense(pts, closed) {
  const n = pts.length, out = [], at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), k1 = p1[2] ? 0 : 1 / 6, k2 = p2[2] ? 0 : 1 / 6;
    const ax = p1[0] + (p2[0] - p0[0]) * k1, ay = p1[1] + (p2[1] - p0[1]) * k1, bx = p2[0] - (p3[0] - p1[0]) * k2, by = p2[1] - (p3[1] - p1[1]) * k2, m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5));
    for (let j = 0; j < m; j++) { const t = j / m, u = 1 - t; out.push([u * u * u * p1[0] + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * p2[1]]); } }
  out.push(closed ? out[0] : [pts[n - 1][0], pts[n - 1][1]]); return out;
}
/** the brush: a line of nearly even strength that swells a little where it turns and, if open, thins to its two ends */
function brush(pts, closed, o = {}) {
  if (pts.length < 2) return; const P = dense(pts, closed), n = P.length, w0 = Math.max(o.w || 2.6, MINW * ((o.w || 2.6) < 2 ? 0.7 : 1)), fine = w0 < 2.2 ? 0.6 : 1;
  const turn = new Float32Array(n), len = new Float32Array(n);
  for (let i = 1; i < n; i++) len[i] = len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  for (let i = 1; i < n - 1; i++) { let d = Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]) - Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; turn[i] = Math.abs(d); }
  const L = len[n - 1], head = Math.min(16, L * 0.25), tail = Math.min(30, L * 0.4), ph = P[0][0] * 0.37 + P[0][1] * 0.11;
  c.strokeStyle = o.col || (o.gold ? GOLD : INK); c.lineCap = 'round';
  for (let i = 0; i < n - 1; i++) { let tsum = 0, cnt = 0; for (let j = i - 3; j <= i + 3; j++) { const q = closed ? ((j % (n - 1)) + (n - 1)) % (n - 1) : j; if (q >= 0 && q < n) { tsum += turn[q]; cnt++; } }
    let w = w0 * (0.84 + Math.min(0.5, (tsum / cnt) * 1.5) * fine + 0.07 * Math.sin(len[i] * 0.05 + ph));
    if (!closed) w *= Math.min(1, 0.55 + 0.45 * (len[i] / (head || 1)), 0.3 + 0.7 * ((L - len[i]) / (tail || 1)));
    c.lineWidth = w; c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[i + 1][0], P[i + 1][1]); c.stroke(); }
}
/** an open line */
const line = (pts, o = {}) => brush(pts, false, o);
/** a closed form: what lies behind it is rubbed out, a thin wash is laid, the outline drawn */
function form(pts, o = {}) {
  trace(pts, true);
  if (o.erase !== false) { c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(); c.restore(); }
  c.fillStyle = PALE; c.globalAlpha = o.veil ?? 0.42; c.fill(); if (o.fill) { c.fillStyle = o.fill; c.globalAlpha = o.a ?? 0.26; c.fill(); } c.globalAlpha = 1;
  if (o.line !== false) brush(pts, true, o);
}
const dot = (x, y, r, col = DARK, a = 0.92) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.globalAlpha = a; c.fill(); c.globalAlpha = 1; };
const circ = (x, y, r, n = 16, sx = 1, sy = 1, a0 = 0) => Array.from({ length: n }, (_, i) => [x + Math.cos(a0 + (i / n) * Math.PI * 2) * r * sx, y + Math.sin(a0 + (i / n) * Math.PI * 2) * r * sy]);
const ring = (x, y, r, o = {}, ry = r) => brush(circ(x, y, 1, Math.max(12, Math.round(r / 3)), r, ry), true, o);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const samp = (P, t) => { const f = t * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)); return lerp(P[i], P[i + 1], f - i); };
/** fold lines between two edges of a cloth: n lines from edge A towards edge B, each a little bowed */
const folds = (A, B, n, o = {}) => { for (let i = 1; i <= n; i++) { const t = i / (n + 1), a = samp(A, t), b = lerp(a, samp(B, t), o.len ?? (0.72 + 0.2 * ((i * 7) % 3) / 2)), m = lerp(a, b, 0.5), bow = (o.bow ?? 8) * (i % 2 ? 1 : -0.6);
  line([a, [m[0] + bow, m[1] + bow * 0.2], b], { w: o.w || 1.5 }); } };
/** points given in a local frame: origin (x, y), turned by ang, mirrored if flip < 0, scaled by s */
const local = (x, y, ang = 0, s = 1, flip = 1) => { const cs = Math.cos(ang), sn = Math.sin(ang); return (px, py, corner) => { const X = px * s * flip, Y = py * s; const p = [x + X * cs - Y * sn, y + X * sn + Y * cs]; if (corner) p.push(1); return p; }; };
/** a ribbon along a path: two edges, a thin wash between, a fold line, a swallow-tail end */
function ribbon(path, wd, col, o = {}) {
  const L = [], R = [], n = path.length;
  for (let i = 0; i < n; i++) { const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, t = i / (n - 1), w = wd * (o.taper ? 1 - 0.5 * t : 1) * (0.72 + 0.4 * Math.abs(Math.sin(t * (o.twist ?? 5) + wd)));
    L.push([path[i][0] - (dy / d) * w, path[i][1] + (dx / d) * w]); R.push([path[i][0] + (dy / d) * w, path[i][1] - (dx / d) * w]); }
  const tip = path[n - 1], back = lerp(path[n - 2], tip, 0.35);
  form([[L[0][0], L[0][1], 1], ...L.slice(1, n - 1), [L[n - 1][0], L[n - 1][1], 1], [back[0], back[1], 1], [R[n - 1][0], R[n - 1][1], 1], ...R.slice(1, n - 1).reverse(), [R[0][0], R[0][1], 1]], { fill: col, a: o.a ?? 0.3, erase: o.erase, veil: o.veil ?? 0.3 });
  if (n > 3) line(path.slice(0, n - 1).map((p, i) => lerp(p, L[i], 0.25)), { w: 1.4 });
}
/** a flame tongue from a base point, pointing along ang, long L */
const flame = (x, y, ang, L, o = {}) => { const T = local(x, y, ang, L / 100, o.flip || 1); form([T(0, -20, 1), T(34, -24), T(62, -6), T(100, -20, 1), T(74, 10), T(46, 22), T(0, 20, 1)], { fill: o.col || RED, a: o.a ?? 0.34, erase: o.erase ?? false, veil: 0.2, w: o.w || 2.2 }); line([T(14, 2), T(40, 0), T(64, -6)], { w: 1.4 }); };
/** a halo behind a head */
const halo = (x, y, r, col) => { form(circ(x, y, r, 24), { fill: col || GOLD, a: 0.1, erase: false, veil: 0.14, w: 2.4 }); ring(x, y, r * 0.9, { gold: true, w: 2 }); };
/** a scroll of cloud: lobes along the top, each with its curl */
function cloud(x, y, k, col, o = {}) {
  const T = local(x, y, 0, k, o.flip || 1);
  form([T(-150, 0), T(-176, -22), T(-150, -52), T(-116, -46), T(-104, -80), T(-58, -92), T(-24, -66), T(6, -104), T(56, -108), T(78, -74), T(118, -86), T(152, -60), T(150, -30), T(196, -22), T(236, -2, 1), T(170, 10), T(60, 18), T(-70, 16)], { fill: col, a: o.a ?? 0.22, veil: 0.55 });
  for (const [cx2, cy2, r, d] of [[-128, -24, 20, 1], [-62, -52, 26, 1], [28, -66, 28, -1], [112, -48, 22, -1]]) line(Array.from({ length: 12 }, (_, i) => { const a = d * (i / 11) * Math.PI * 2.6 + 1.2, rr = r * (1 - (i / 11) * 0.72); return T(cx2 + Math.cos(a) * rr, cy2 + Math.sin(a) * rr); }), { w: 1.8 });
  line([T(-30, 2), T(40, 6), T(120, 0), T(190, -8)], { w: 1.5 });
}

// ------------------------------------------------------------------ heads
/** a head in three-quarter view (face about 96 wide, 124 tall at s = 1). o: {brow: fierce|calm, eye3, round, moustache, beard, woman, beak, wash} */
function head(x, y, s, o = {}) {
  const T = local(x, y, 0, s), fierce = o.brow !== 'calm';
  form([T(-44, -30), T(-40, -52), T(-18, -64), T(10, -64), T(34, -52), T(44, -28), T(46, 0), T(42, 22), T(30, 44), T(10, 58), T(-8, 60), T(-28, 48), T(-42, 24), T(-46, -4)], { fill: o.wash || null, a: 0.22, veil: 0.72 });
  form([T(-45, -14), T(-57, -14), T(-62, 8), T(-56, 34), T(-48, 30), T(-46, 6)], { fill: o.wash || null, a: 0.22, veil: 0.72, w: 2.2 }); line([T(-54, -6), T(-55, 12), T(-51, 20)], { w: 1.4 });                // the ear, the lobe long
  if (o.beak) { form([T(2, -6, 1), T(30, -8), T(62, 8), T(84, 34, 1), T(54, 28), T(30, 30), T(8, 26, 1)], { fill: GOLD, a: 0.4, veil: 0.7 }); line([T(12, 12), T(40, 14), T(66, 24)], { w: 1.6 }); form([T(14, 28, 1), T(36, 31), T(50, 40, 1), T(28, 42), T(12, 38)], { fill: GOLD, a: 0.4, veil: 0.7, w: 2 }); }
  else { line([T(6, -18), T(9, 0), T(17, 11), T(9, 16), T(1, 13)], { w: 2.2 }); line([T(-4, 10), T(-3, 15), T(1, 13)], { w: 1.6 });                                                                                 // the nose
    if (o.woman) form([T(1, 29, 1), T(6, 26), T(9, 28), T(12, 26), T(18, 29, 1), T(10, 35)], { fill: RED, a: 0.5, veil: 0.4, w: 1.6 });
    else if (o.snarl) { form([T(-10, 33, 1), T(0, 26), T(9, 28), T(18, 26), T(27, 32, 1), T(20, 40), T(9, 42), T(-2, 40)], { veil: 0.95, w: 2.2 }); line([T(-6, 33), T(9, 34), T(24, 32)], { w: 1.3 }); for (const k of [0, 9, 18]) line([T(k, 28), T(k, 39)], { w: 1.1 }); line([T(2, 16), T(-8, 22), T(-14, 32)], { w: 1.4 }); line([T(16, 15), T(26, 21), T(31, 30)], { w: 1.4 }); }
    else { line([T(-5, 31), T(4, 27), T(9, 29), T(14, 27), T(22, 31)], { w: 2.2 }); line([T(1, 35), T(9, 38), T(17, 35)], { w: 1.5 }); } }
  if (fierce && !o.beak) { line([T(1, -26), T(3, -18)], { w: 1.4 }); line([T(8, -27), T(7, -19)], { w: 1.4 }); }
  for (const [ex, m] of [[-21, 1], [28, -0.86]]) { const E = (px, py, k) => T(ex + px * m, py, k);                                    // near eye, far eye (mirrored, a little narrower)
    if (fierce) form([E(15, -20, 1), E(6, -30), E(-8, -38), E(-17, -40, 1), E(-8, -31), E(4, -25)], { fill: DARK, a: 0.75, veil: 0.2, w: 1.6 });                                                                // a brow like a blade, rising outward
    else line([E(-13, -24), E(0, -29), E(13, -25)], { w: 2 });
    if (o.round) { form(circ(E(0, -13)[0], E(0, -13)[1], 9 * s, 10), { veil: 0.9, w: 2 }); dot(E(-1, -13)[0], E(-1, -13)[1], 3.6 * s); }
    else { line(fierce ? [E(14, -11), E(6, -17), E(-6, -20), E(-16, -18)] : [E(-14, -13), E(-6, -18), E(6, -19), E(15, -13)], { w: 2.2 }); line([E(-12, -12), E(0, -9), E(12, -12)], { w: 1.4 }); dot(E(-1, -14)[0], E(-1, -14)[1], 3.8 * s); } }
  if (o.eye3) { form([T(4, -54, 1), T(10, -44), T(4, -34, 1), T(-2, -44)], { fill: GOLD, a: 0.55, veil: 0.8, gold: true, w: 2.4 }); dot(T(4, -44)[0], T(4, -44)[1], 2.6 * s, GOLD, 1); }
  if (o.moustache) { line([T(4, 24), T(-8, 26), T(-22, 36), T(-30, 52)], { w: 1.8 }); line([T(14, 24), T(24, 27), T(34, 38), T(38, 52)], { w: 1.8 }); }
  if (o.beard) { const L = o.beard; for (let i = -3; i <= 3; i++) line([T(8 + i * 9, 50 - Math.abs(i) * 5), T(8 + i * 11, 80 + L * 20), T(10 + i * 8 - 6, 110 + L * 46 - Math.abs(i) * 8), T(4 + i * 6, 132 + L * 60 - Math.abs(i) * 14)], { w: 1.6 });
    line([T(-34, 34), T(-36, 70), T(-26, 100 + L * 30)], { w: 1.6 }); line([T(38, 30), T(44, 64), T(36, 96 + L * 30)], { w: 1.6 }); }
  return T;
}
/** a face in profile, looking along dir; the back of it is hidden by whatever is drawn after */
function profile(x, y, s, dir) {
  const T = local(x, y, 0, s, dir);
  form([T(-30, -58), T(4, -62), T(24, -46), T(28, -24), T(42, -4, 1), T(31, 2), T(34, 12), T(29, 18), T(32, 27), T(23, 44), T(4, 58), T(-30, 54)], { veil: 0.72 });
  form([T(2, -42, 1), T(16, -39), T(33, -27, 1), T(16, -32)], { fill: DARK, a: 0.75, veil: 0.2, w: 1.6 }); line([T(6, -24), T(18, -25), T(28, -18)], { w: 2 }); line([T(10, -19), T(18, -17), T(26, -19)], { w: 1.3 }); dot(T(20, -21)[0], T(20, -21)[1], 3.2 * s);
  form([T(18, 16, 1), T(32, 15, 1), T(31, 24), T(20, 26)], { veil: 0.95, w: 1.8 }); line([T(22, 16), T(22, 25)], { w: 1 }); line([T(27, 16), T(27, 24)], { w: 1 }); line([T(30, 0), T(24, 4)], { w: 1.5 }); line([T(22, 6), T(14, 14), T(12, 24)], { w: 1.3 });
  return T;
}

// ------------------------------------------------------------------ arms and hands
/** a fist closed round a shaft that runs along ang */
function fist(x, y, ang, s = 1) {
  const T = local(x, y, ang, s);
  form([T(-17, -15), T(0, -18), T(16, -14), T(19, 0), T(16, 15), T(0, 18), T(-17, 14), T(-20, 0)], { veil: 0.85, w: 2.4 });
  for (const k of [-8, 0, 8]) line([T(k, -16), T(k + 2, -2), T(k, 4)], { w: 1.4 }); form([T(-14, 2), T(-2, -1), T(10, 3), T(8, 11), T(-12, 11)], { veil: 0.85, w: 1.8 });
}
/** an arm through shoulder S, elbow E and hand Hd. o: {col (sleeve wash), bare, w, grip (angle of what the hand holds), flare (angle the elbow cloth flies), cuff} */
function arm(S, E, Hd, o = {}) {
  const w = o.w || 24, seg = (A, B, w0, w1, bulge) => { const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, m = lerp(A, B, 0.45);
    return [[A[0] + nx * w0, A[1] + ny * w0, 1], [m[0] + nx * (w0 + w1) * 0.5 * bulge, m[1] + ny * (w0 + w1) * 0.5 * bulge], [B[0] + nx * w1, B[1] + ny * w1, 1], [B[0] - nx * w1, B[1] - ny * w1, 1], [m[0] - nx * (w0 + w1) * 0.5 * bulge, m[1] - ny * (w0 + w1) * 0.5 * bulge], [A[0] - nx * w0, A[1] - ny * w0, 1]]; };
  if (o.flare != null && !o.bare) { const T = local(E[0], E[1], o.flare, w / 24);                                                   // the sleeve's end flies from the elbow, as in the murals
    form([T(-6, -24, 1), T(28, -34), T(58, -30), T(84, -44, 1), T(66, -14), T(98, -6, 1), T(62, 8), T(78, 34, 1), T(40, 24), T(-6, 24, 1)], { fill: o.col, a: 0.3 });
    line([T(4, -8), T(34, -14), T(62, -22)], { w: 1.5 }); line([T(4, 6), T(36, 4), T(70, -4)], { w: 1.5 }); line([T(6, 16), T(34, 18), T(56, 22)], { w: 1.5 }); }
  const soft = (q) => (o.bare ? q.map((p, i) => (i === 2 || i === 3 ? [p[0], p[1]] : p)) : q); const up = soft(seg(S, E, w, w * 0.86, o.bare ? 1.34 : 1.16)); form(up, { fill: o.bare ? null : o.col, a: 0.28, veil: o.bare ? 0.8 : 0.42 });
  if (!o.bare) { line([lerp(up[0], up[2], 0.62), lerp(lerp(up[0], up[2], 0.7), lerp(up[5], up[3], 0.7), 0.5), lerp(up[5], up[3], 0.6)], { w: 1.5 }); line([lerp(up[0], up[2], 0.84), lerp(lerp(up[0], up[2], 0.9), lerp(up[5], up[3], 0.9), 0.5), lerp(up[5], up[3], 0.82)], { w: 1.5 }); }
  else { line([lerp(up[0], up[2], 0.36), lerp(up[5], up[3], 0.36)], { gold: true, w: 4 }); line([lerp(S, E, 0.5), lerp(lerp(S, E, 0.7), up[1], 0.5), lerp(lerp(S, E, 0.92), up[2], 0.5)], { w: 1.4 }); }   // an arm ring, the line of the muscle
  const lo = seg(E, Hd, w * (o.bare ? 0.86 : 0.8), w * 0.56, o.bare ? 1.3 : 1.08); if (o.bare) { lo[0].length = 2; lo[5].length = 2; } form(lo, { fill: o.bare ? null : o.cuff || GOLD, a: 0.3, veil: o.bare ? 0.8 : 0.5 });
  if (!o.bare) { for (const t of [0.14, 0.86]) line([lerp(lo[0], lo[2], t), lerp(lo[5], lo[3], t)], { w: 1.6 }); line([lerp(lo[0], lo[2], 0.2), lerp(lo[5], lo[3], 0.5), lerp(lo[0], lo[2], 0.8)], { w: 1.3 }); line([lerp(lo[5], lo[3], 0.2), lerp(lo[0], lo[2], 0.5), lerp(lo[5], lo[3], 0.8)], { w: 1.3 }); }
  else line([lerp(lo[0], lo[2], 0.82), lerp(lo[5], lo[3], 0.82)], { gold: true, w: 3.2 });
  fist(Hd[0], Hd[1], o.grip ?? Math.atan2(Hd[1] - E[1], Hd[0] - E[0]) + Math.PI / 2, o.bare ? w / 19 : w / 24);
}
/** a shaft from a to b; returns a mapper whose origin is b and whose x runs on past b: (forward, sideways) */
const shaft = (a, b, o = {}) => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), l = Math.hypot(b[0] - a[0], b[1] - a[1]), T = local(a[0], a[1], ang), w = o.w || 4.5;
  form([T(0, -w, 1), T(l, -w, 1), T(l, w, 1), T(0, w, 1)], { fill: o.col || OCH, a: 0.42, veil: 0.7, w: 2 }); return local(b[0], b[1], ang); };

// ------------------------------------------------------------------ the body of a heavenly general
// Drawn about x = 0 with the feet at y = 0 and the crown near -835; the caller sets the transform.
// o: {col (armour wash), robe (wash of the under-robe), belt, long (a robe to the ground, for a woman), wind (-1 | 1: which way the hems fly)}
function robe(o) { const d = o.wind || -1, R = o.robe || OCH, X = (x, y, k) => [x * d, y, k];
  if (o.long) { const hem = [X(-200, -24), X(-150, -6), X(-104, -26), X(-50, -6), X(0, -22), X(54, -4), X(108, -24), X(160, -6), X(236, -30), X(290, -8, 1)];
    form([X(-84, -470, 1), X(-128, -330), X(-168, -170), ...hem, X(196, -120), X(130, -300), X(84, -470, 1)], { fill: R, a: 0.26 }); folds([X(-70, -450), X(70, -450)], hem, 9, { len: 0.94, bow: 10 }); line(hem.map((p) => [p[0], p[1] - 22]), { gold: true, w: 2.2 });
    for (const s of [-1, 1]) form([[s * 30, -8], [s * 46, -22], [s * 78, -14], [s * 84, 0, 1], [s * 28, 0, 1]], { fill: DARK, a: 0.3, w: 2.2 }); return; }
  const hem = [X(-262, -132, 1), X(-214, -150), X(-176, -108), X(-128, -138), X(-84, -106), X(-34, -134), X(18, -108), X(70, -136), X(118, -112), X(158, -136, 1)];
  form([X(-112, -360, 1), X(-168, -250), ...hem, X(140, -250), X(112, -360, 1)], { fill: R, a: 0.24 }); folds([X(-100, -350), X(100, -350)], hem, 8, { len: 0.92, bow: 9 });
}
function legs(o) { for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k];
    form([X(38, -262, 1), X(90, -262, 1), X(88, -160), X(78, -70, 1), X(44, -70, 1), X(36, -160)], { fill: o.col, a: 0.26 });                                              // the greave
    for (const y of [-214, -170, -126]) line([X(40, y), X(63, y + 7), X(87, y)], { w: 1.5 }); line([X(63, -236), X(63, -74)], { w: 1.4 });
    form(circ(63 * s, -262, 27, 12), { fill: GOLD, a: 0.34, w: 2.4 }); ring(63 * s, -262, 15, { gold: true, w: 2 }); dot(63 * s, -262, 4, GOLD, 0.9);                         // the knee boss
    form([X(40, -74, 1), X(82, -74, 1), X(86, -34), X(124, -24), X(150, -30, 1), X(146, -6), X(128, 0, 1), X(34, 0, 1), X(32, -34)], { fill: DARK, a: 0.3 });                // the boot, its toe turned up
    line([X(36, -52), X(60, -46), X(84, -52)], { w: 1.5 }); line([X(34, -10), X(128, -10)], { w: 1.5 }); } }
function trunk(o) { const A = o.col;
  for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k];                                                                                                          // the skirt of plates
    form([X(8, -474, 1), X(92, -474, 1), X(142, -390), X(156, -296), X(100, -262), X(20, -282, 1)], { fill: A, a: 0.28 });
    for (let r = 0; r < 5; r++) line([X(12 + r, -444 + r * 36), X(70 + r * 4, -434 + r * 36), X(108 + r * 10, -444 + r * 37)], { w: 1.4 }); for (const k of [0.3, 0.62]) line([lerp(X(8, -474), X(92, -474), k), lerp(X(20, -282), X(156, -296), k)], { w: 1.2 });
    line([X(20, -288), X(100, -268), X(154, -302)], { gold: true, w: 3 }); }
  form([[-34, -474, 1], [34, -474, 1], [40, -340], [0, -282, 1], [-40, -340]], { fill: o.belt || RED, a: 0.32 }); folds([[-24, -470], [24, -470]], [[-30, -330], [0, -290], [30, -330]], 3, { len: 0.9, bow: 4 });   // the apron between
  form([[-102, -652, 1], [-62, -676], [62, -676], [102, -652, 1], [94, -560], [80, -498, 1], [-80, -498, 1], [-94, -560]], { fill: A, a: 0.28 });                                                                 // the cuirass
  for (let r = 0; r < 5; r++) for (let q = -4; q <= 4; q++) { const px = q * 21 + (r % 2) * 10.5, py = -636 + r * 26; if (Math.abs(px) < 84 - r * 2 && Math.hypot(px, py + 590) > 34) line([[px - 10, py], [px, py + 11], [px + 10, py]], { w: 1.3 }); }
  line([[-86, -660], [-30, -606]], { w: 1.8 }); line([[86, -660], [30, -606]], { w: 1.8 });                                                                                                                    // straps to the mirror
  form(circ(0, -590, 30, 14), { fill: GOLD, a: 0.4, gold: true, w: 2.6 }); ring(0, -590, 19, { w: 1.6 }); ring(0, -590, 8, { gold: true, w: 2 });                                                                 // the heart mirror
  form([[-88, -506, 1], [0, -498], [88, -506, 1], [90, -468, 1], [0, -460], [-90, -468, 1]], { fill: o.belt || RED, a: 0.4 });                                                                                   // the belt
  form(circ(0, -483, 25, 12, 1.1, 1), { fill: GOLD, a: 0.45, gold: true, w: 2.6 }); dot(-9, -488, 3); dot(9, -488, 3); line([[-13, -496], [-5, -493]], { w: 1.6 }); line([[13, -496], [5, -493]], { w: 1.6 }); line([[-7, -474], [0, -478], [7, -474]], { w: 1.6 });   // its beast-mask boss
  for (const s of [-1, 1]) ribbon([[s * 24, -462], [s * 40, -410], [s * 30, -350], [s * 52, -290], [s * 44, -232]], 8, o.belt || RED, { taper: true, erase: true, a: 0.4, twist: 3 });                          // the belt's hanging ends
  for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k];                                                                                                                                              // the shoulder guards, tips turned up
    form([X(66, -672, 1), X(124, -680), X(176, -664), X(196, -690, 1), X(190, -610), X(156, -562), X(104, -572, 1), X(90, -624)], { fill: A, a: 0.32 });
    for (let r = 0; r < 3; r++) line([X(98 + r * 4, -650 + r * 26), X(134, -640 + r * 26), X(178 - r * 8, -650 + r * 26)], { w: 1.4 }); line([X(104, -576), X(154, -566), X(188, -612)], { gold: true, w: 3 }); }
  form([[-60, -676, 1], [0, -640, 1], [60, -676, 1], [44, -692], [0, -670], [-44, -692]], { fill: o.belt || RED, a: 0.36 }); form(circ(0, -650, 12, 8), { fill: o.belt || RED, a: 0.4, w: 2 });                 // a knotted scarf at the neck
}
/** the sash of a heavenly figure: an arc behind the head and shoulders, and two long ends that fly */
function sash(col, o = {}) { const k = o.k || 1, d = o.wind || -1;
  ribbon([[-120, -630], [-230 * k, -700], [-268 * k, -820], [-170 * k, -884], [0, -902], [170 * k, -884], [268 * k, -820], [230 * k, -700], [120, -630]], 15, col, { erase: false, twist: 7 });
  ribbon([[-130 * d, -610], [-236 * d, -540], [-262 * d, -420], [-212 * d, -310], [-282 * d, -200], [-250 * d, -96], [-320 * d, -30]], 17, col, { erase: false, taper: true, twist: 6 });
  ribbon([[130 * d, -610], [226 * d, -530], [214 * d, -410], [262 * d, -300], [226 * d, -190], [262 * d, -110]], 17, col, { erase: false, taper: true, twist: 6 }); }
/** a general's helm over a head made with head(): dome, brow band, wings at the temples, neck guard, a crest. T is the head's mapper, s its scale. */
function helm(T, s, col, o = {}) {
  for (const q of [-1, 1]) form([T(q * 46 - 2, -34, 1), T(q * 62, -6), T(q * 76, 40), T(q * 66, 62, 1), T(q * 48, 40)], { fill: col, a: 0.3, w: 2.2 });                                           // the neck guard
  form([T(-50, -40, 1), T(-48, -78), T(-22, -102), T(12, -104), T(40, -84), T(50, -42, 1), T(20, -60), T(-14, -60)], { fill: col, a: 0.32 }); line([T(-49, -46), T(-14, -64), T(20, -64), T(50, -48)], { gold: true, w: 3.4 });
  for (const q of [-1, 1]) form([T(q * 48, -50, 1), T(q * 78, -74), T(q * 104, -104, 1), T(q * 88, -64), T(q * 110, -58, 1), T(q * 80, -44), T(q * 58, -34, 1)], { fill: GOLD, a: 0.36, w: 2.2 });  // the wings
  form(circ(T(-4, -112)[0], T(-4, -112)[1], 11 * s, 8), { fill: GOLD, a: 0.5, gold: true, w: 2.2 });
  if (o.crown) form([T(-36, -92, 1), T(-44, -138, 1), T(-22, -118), T(-4, -160, 1), T(14, -118), T(36, -138, 1), T(30, -92, 1)], { fill: GOLD, a: 0.5, gold: true, w: 2.6 });
  else { const b = T(-4, -122), d = o.wind || -1; form([[b[0] - 6, b[1], 1], [b[0] - 10 * d, b[1] - 40], [b[0] - 50 * d, b[1] - 70], [b[0] - 112 * d, b[1] - 50, 1], [b[0] - 70 * d, b[1] - 40], [b[0] - 96 * d, b[1] - 10, 1], [b[0] - 44 * d, b[1] - 22], [b[0] + 6, b[1], 1]], { fill: RED, a: 0.4 });   // a red tassel, flying
    line([[b[0] - 6 * d, b[1] - 10], [b[0] - 34 * d, b[1] - 44], [b[0] - 80 * d, b[1] - 46]], { w: 1.4 }); }
}

// ------------------------------------------------------------------ the five
const at = (x, y, s, fn) => { c.save(); c.translate(x, y); c.scale(s, s); fn(); c.restore(); };
const DRAW = {
  // 杨戬: the third eye open (the one mark of gold on his face), the three-pointed two-edged blade, the hound at his feet
  yangjian() { at(CX + 30, FEET - 6, 1, () => {
    halo(4, -748, 118, AZU); sash(AZU, { wind: -1 });
    const o = { col: AZU, robe: MAL, belt: RED, wind: -1 }; robe(o); legs(o); trunk(o);
    const T = head(4, -748, 1.04, { brow: 'fierce', eye3: true, moustache: true }); helm(T, 1.04, AZU, { wind: -1 });
    const sh = shaft([196, -4], [236, -760], { w: 5 });                                                                               // the blade stands in his right hand
    form([sh(0, -9, 1), sh(20, -30), sh(60, -44), sh(104, -46, 1), sh(80, -18), sh(96, -12), sh(160, 0, 1), sh(96, 12), sh(80, 18), sh(104, 46, 1), sh(60, 44), sh(20, 30), sh(0, 9, 1)], { veil: 0.9, w: 2.6 }); line([sh(8, 0), sh(144, 0)], { w: 1.5 }); line([sh(22, -20), sh(60, -32), sh(92, -40)], { w: 1.3 }); line([sh(22, 20), sh(60, 32), sh(92, 40)], { w: 1.3 });
    form([sh(-26, -11, 1), sh(0, -13, 1), sh(0, 13, 1), sh(-26, 11, 1)], { fill: GOLD, a: 0.5, gold: true }); ribbon([sh(-22, 10), sh(-60, 50), sh(-110, 40), sh(-150, 80)], 9, RED, { taper: true, erase: false, a: 0.42 });
    arm([128, -640], [206, -560], [222, -470], { col: AZU, flare: -0.5, grip: 1.52 });
    arm([-128, -640], [-214, -540], [-96, -478], { col: AZU, flare: Math.PI + 0.5 });                                                 // the other fist on his belt
    // 哮天犬: a lean hound seated at his feet, looking up at him
    const D = local(-276, -2, 0, 1.06);
    line([D(-84, -22), D(-122, -34), D(-134, -76), D(-112, -100)], { w: 2.6 });
    form([D(0, 0, 1), D(-2, -90), D(6, -124), D(10, -168), D(22, -192), D(60, -198), D(90, -208, 1), D(84, -217), D(48, -228), D(26, -238), D(-8, -204), D(-32, -152), D(-64, -92), D(-88, -40), D(-84, 0, 1), D(-22, 0, 1), D(-30, -10), D(-16, -12), D(-14, 0, 1)], { veil: 0.9 });
    form([D(26, -236, 1), D(2, -268, 1), D(-4, -226)], { veil: 0.9, w: 2.2 }); dot(D(56, -217)[0], D(56, -217)[1], 3.6); dot(D(88, -210)[0], D(88, -210)[1], 3); line([D(60, -200), D(80, -203)], { w: 1.5 });
    line([D(-14, -2), D(-12, -86)], { w: 1.6 }); line([D(-40, -2), D(-66, -34), D(-60, -74), D(-34, -90)], { w: 1.6 }); line([D(-6, -160), D(8, -150), D(22, -156)], { gold: true, w: 3.4 });
  }); },
  // 哪吒: three faces, eight arms each with its weapon (ch 76: the fire-tipped spear, the Cosmos Ring, the sash, the gold brick,
  // the nine-dragon fire cover, the two yin-yang swords), on the wind-fire wheels, in an aureole of flame
  nezha() { at(CX, FEET - 90, 0.84, () => {
    for (let i = 0; i < 26; i++) { const a = -Math.PI * 1.36 + (i / 25) * Math.PI * 1.72; flame(Math.cos(a) * 244, -640 + Math.sin(a) * 244, a + 0.28 * (i % 2 ? 1 : -1), i % 2 ? 118 : 84, { flip: i % 2 ? 1 : -1, a: 0.4 }); }
    form(circ(0, -640, 250, 32), { fill: RED, a: 0.08, erase: false, veil: 0.12, w: 2.6 }); ring(0, -640, 228, { gold: true, w: 2.6 }); ring(0, -640, 214, { w: 1.4 });
    const S = (s) => [s * 92, -628], bare = { bare: true, w: 25 };
    // the back arms: the two swords, the brick, the fire cover
    for (const s of [-1, 1]) { const h = [s * 214, -770], tip = [h[0] + s * 78, h[1] - 180], sh = shaft(h, tip, { w: 3, col: null }), l = Math.hypot(78, 180);
      form([sh(-l + 26, -12, 1), sh(-30, -13), sh(22, 0, 1), sh(-30, 13), sh(-l + 26, 12, 1)], { veil: 0.94, w: 2.6 }); line([sh(-l + 30, 0), sh(6, 0)], { w: 1.4 }); form([sh(-l + 16, -28, 1), sh(-l + 28, -28, 1), sh(-l + 28, 28, 1), sh(-l + 16, 28, 1)], { fill: GOLD, a: 0.6, gold: true, w: 2.4 });
      form([sh(-l - 50, -6, 1), sh(-l - 24, -6, 1), sh(-l - 24, 6, 1), sh(-l - 50, 6, 1)], { fill: GOLD, a: 0.5, gold: true, w: 2 }); arm(S(s), [s * 206, -676], h, { ...bare, grip: Math.atan2(-180, s * 78) }); }
    { const h = [-318, -636]; arm(S(-1), [-206, -600], h, bare); const T = local(h[0], h[1] - 50, -0.12); form([T(-52, -32, 1), T(52, -32, 1), T(52, 30, 1), T(-52, 30, 1)], { fill: GOLD, a: 0.5, gold: true, w: 3 }); line([T(-52, -12), T(52, -12)], { gold: true, w: 2 }); line([T(-52, 10), T(52, 10)], { gold: true, w: 2 }); for (const q of [-18, 18]) line([T(q, -32), T(q, -12)], { gold: true, w: 1.8 }); line([T(0, -12), T(0, 10)], { gold: true, w: 1.8 }); }   // 金砖
    { const h = [318, -636]; arm(S(1), [206, -600], h, bare); const T = local(h[0], h[1] - 26, 0.1, 1.4); form([T(-52, 0, 1), T(-46, -46), T(-20, -78), T(0, -86), T(20, -78), T(46, -46), T(52, 0, 1)], { fill: RED, a: 0.42 }); line([T(-52, -5), T(52, -5)], { gold: true, w: 4 });
      for (const q of [-30, -10, 10, 30]) line([T(q, -10), T(q * 0.86, -34), T(q * 0.6, -58), T(q * 0.2, -78)], { w: 1.5 }); form(circ(T(0, -96)[0], T(0, -96)[1], 13, 8), { fill: GOLD, a: 0.55, gold: true, w: 2.4 }); }                    // 九龙神火罩
    // the wind-fire wheels
    for (const s of [-1, 1]) { const wx = s * 78, wy = 46; for (const [dy, L, da] of [[-40, 170, -0.5], [-10, 220, -0.22], [26, 180, 0.02], [-52, 110, -0.9]]) flame(wx + s * 30, wy + dy, s > 0 ? da : Math.PI - da, L, { flip: s, a: 0.36 });
      form(circ(wx, wy, 68, 24, 1, 0.92), { fill: GOLD, a: 0.24, w: 2.8 }); ring(wx, wy, 52, { gold: true, w: 2.8 }, 48); ring(wx, wy, 60, { w: 1.4 }, 55);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI + 0.3; line([[wx - Math.cos(a) * 52, wy - Math.sin(a) * 48], [wx + Math.cos(a) * 52, wy + Math.sin(a) * 48]], { w: 1.6 }); } form(circ(wx, wy, 13, 10), { fill: GOLD, a: 0.6, gold: true, w: 2.2 }); }
    // the body: a boy's, bare-armed, in a lotus skirt
    for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k]; form([X(14, -330, 1), X(96, -330, 1), X(118, -230), X(108, -130), X(74, -74, 1), X(32, -74, 1), X(16, -140), X(12, -230)], { fill: MAL, a: 0.26 }); folds([X(24, -320), X(90, -320)], [X(36, -86), X(70, -86)], 4, { len: 0.95, bow: 9 });
      line([X(32, -92), X(52, -86), X(72, -92)], { gold: true, w: 3.2 }); form([X(36, -76, 1), X(70, -76, 1), X(74, -40), X(104, -26), X(110, -8), X(88, -2, 1), X(34, -2, 1), X(32, -40)], { veil: 0.85 }); for (const k of [84, 94, 102]) line([X(k, -22), X(k + 2, -6)], { w: 1.3 }); }   // bare feet on the wheels
    for (let i = -3; i <= 3; i++) { const T = local(i * 30, -468, -i * 0.2); form([T(-28, 0, 1), T(-36, 110), T(0, 214, 1), T(36, 110), T(28, 0, 1)], { fill: i % 2 ? MAL : RED, a: 0.34 }); line([T(0, 20), T(0, 180)], { w: 1.4 }); line([T(-14, 30), T(-16, 120)], { w: 1.2 }); line([T(14, 30), T(16, 120)], { w: 1.2 }); }   // lotus petals
    form([[-100, -642, 1], [-56, -664], [56, -664], [100, -642, 1], [92, -550], [80, -470, 1], [-80, -470, 1], [-92, -550]], { veil: 0.8 }); line([[-64, -598], [-24, -576], [0, -582], [24, -576], [64, -598]], { w: 1.8 }); line([[0, -578], [0, -500]], { w: 1.3 });
    form([[-52, -664, 1], [52, -664, 1], [46, -560], [0, -498, 1], [-46, -560]], { fill: RED, a: 0.42 }); form(circ(0, -590, 16, 10), { fill: GOLD, a: 0.5, gold: true, w: 2.2 }); line([[-38, -640], [0, -620], [38, -640]], { gold: true, w: 2.4 });   // the red bib
    form([[-88, -488, 1], [0, -478], [88, -488, 1], [90, -450, 1], [0, -442], [-90, -450, 1]], { fill: GOLD, a: 0.4 }); form(circ(0, -466, 19, 10), { fill: RED, a: 0.5, w: 2.2 });
    for (let i = -2; i <= 2; i++) { const T = local(i * 36, -668, -i * 0.34); form([T(-21, 0, 1), T(-23, 28), T(0, 56, 1), T(23, 28), T(21, 0, 1)], { fill: i % 2 ? RED : MAL, a: 0.36, w: 2.2 }); }                                           // a lotus collar
    // three faces, each fierce
    profile(-62, -754, 0.98, -1); profile(66, -754, 0.98, 1);
    const T = head(2, -756, 1.04, { brow: 'fierce', snarl: true });
    for (const s of [-1, 1]) { form(circ(T(s * 30, -86)[0], T(0, -86)[1], 25, 12, 1, 1.12), { fill: DARK, a: 0.45, w: 2.4 }); line([T(s * 30 - 20, -68), T(s * 30, -64), T(s * 30 + 20, -68)], { gold: true, w: 3.4 }); ribbon([T(s * 44, -70), T(s * 84, -64), T(s * 104, -24), T(s * 132, -6)], 6, RED, { taper: true, erase: false, a: 0.45 }); }   // two knots of hair, bound
    form([T(-46, -34, 1), T(-42, -58), T(-18, -70), T(10, -70), T(36, -58), T(46, -32, 1), T(24, -52), T(2, -46), T(-20, -52)], { fill: DARK, a: 0.42, w: 2.2 });
    // the spear across the hips in the low hands; the ring and the sash in the front hands
    const a = [-300, -470], b = [300, -196], sh = shaft(b, a, { w: 6.5 });
    form([sh(0, -12, 1), sh(26, -24), sh(50, -56, 1), sh(58, -22), sh(96, -34, 1), sh(84, -9), sh(156, 0, 1), sh(84, 9), sh(96, 34, 1), sh(58, 22), sh(50, 56, 1), sh(26, 24), sh(0, 12, 1)], { fill: RED, a: 0.44, veil: 0.6 });   // the head of flame
    line([sh(6, 0), sh(126, 0)], { gold: true, w: 2.6 }); form([sh(-26, -14, 1), sh(0, -16, 1), sh(0, 16, 1), sh(-26, 14, 1)], { fill: GOLD, a: 0.5, gold: true }); ribbon([sh(-24, 10), sh(-50, 50), sh(-30, 96)], 7, RED, { taper: true, erase: false, a: 0.45 });
    const gA = Math.atan2(a[1] - b[1], a[0] - b[0]); arm(S(-1), [-204, -508], [-150, -401.5], { ...bare, w: 27, grip: gA }); arm(S(1), [200, -424], [120, -278], { ...bare, w: 27, grip: gA });
    { const h = [-184, -552]; ring(h[0] - 14, h[1] - 62, 62, { gold: true, w: 11 }); ring(h[0] - 14, h[1] - 62, 69, { w: 1.6 }); ring(h[0] - 14, h[1] - 62, 55, { w: 1.6 }); arm([-84, -626], [-124, -536], h, { ...bare, w: 26, grip: 0 }); }   // 乾坤圈
    { const h = [184, -552]; ribbon([[h[0] - 10, h[1] - 10], [h[0] + 44, h[1] - 44], [h[0] + 96, h[1]], [h[0] + 74, h[1] + 84], [h[0] + 146, h[1] + 156], [h[0] + 112, h[1] + 256], [h[0] + 176, h[1] + 336]], 17, RED, { taper: true, erase: false, a: 0.44, twist: 7 }); arm([84, -626], [124, -536], h, { ...bare, w: 26, grip: 0 }); }   // 混天绫
  }); },
  // 雷震子: a beaked face, the wings spread, the golden staff, a storm cloud under him
  leizhenzi() {
    at(CX, FEET - 92, 0.9, () => {
      for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k], base = s > 0 ? 0 : Math.PI;                                  // the wings: an arm of bone, then feather by feather
        const bone = [X(76, -610), X(150, -716), X(222, -784), X(284, -816), X(326, -820)];
        for (let i = 0; i < 9; i++) { const t = i / 8, p = samp(bone.slice(2), t), ang = base + s * (-1.0 + t * 1.9), L = 104 + Math.sin(t * 3) * 18, T = local(p[0], p[1], ang);
          form([T(0, -14, 1), T(L * 0.5, -20), T(L, 0, 1), T(L * 0.5, 18), T(0, 14, 1)], { fill: i % 2 ? MAL : AZU, a: 0.3, w: 2.2 }); line([T(6, 0), T(L * 0.9, 0)], { w: 1.3 }); }
        for (let i = 0; i < 7; i++) { const t = i / 6, p = samp(bone.slice(0, 4), 0.15 + t * 0.85), ang = base + s * (1.5 - t * 0.5), L = 150 + t * 40, T = local(p[0], p[1], ang);
          form([T(0, -18, 1), T(L * 0.5, -23), T(L, 0, 1), T(L * 0.5, 21), T(0, 18, 1)], { fill: MAL, a: 0.3, w: 2.2 }); line([T(6, 0), T(L * 0.9, 0)], { w: 1.3 }); }
        form([X(64, -620, 1), X(134, -736), X(222, -810), X(288, -842), X(340, -830, 1), X(288, -792), X(226, -750), X(170, -680), X(118, -570, 1)], { fill: OCH, a: 0.3 });
        for (let i = 0; i < 7; i++) { const p = samp(bone, 0.1 + i * 0.12); line([[p[0] - s * 12, p[1] + 26], [p[0], p[1] + 44], [p[0] + s * 16, p[1] + 30]], { w: 1.4 }); } line(bone.map((p) => [p[0], p[1] - 14]), { gold: true, w: 2.6 }); }
      for (const s of [-1, 1]) ribbon([[s * 96, -470], [s * 180, -400], [s * 150, -290], [s * 220, -200], [s * 196, -110]], 14, RED, { erase: false, taper: true, a: 0.4 });
      // the body: bare to the waist, a tiger skirt, bare shins lost in the cloud
      for (const s of [-1, 1]) { const X = (x, y, k) => [x * s, y, k]; form([X(16, -300, 1), X(112, -300, 1), X(130, -180), X(104, -20, 1), X(34, -20, 1), X(14, -160)], { fill: MAL, a: 0.26 }); folds([X(26, -290), X(104, -290)], [X(40, -30), X(98, -30)], 4, { len: 0.95, bow: 8 }); }
      { const hem = [[-150, -262, 1], [-104, -240], [-60, -268], [-10, -238], [40, -266], [92, -240], [150, -264, 1]]; form([[-84, -470, 1], [-120, -380], ...hem, [120, -380], [84, -470, 1]], { fill: OCH, a: 0.34 }); folds([[-70, -460], [70, -460]], hem, 6, { len: 0.9 });
        for (const [x, y] of [[-70, -400], [-20, -360], [40, -410], [80, -340], [-90, -320], [10, -300]]) line([[x - 14, y - 6], [x, y + 4], [x + 14, y - 8]], { w: 3.2 }); }
      form([[-124, -650, 1], [-66, -676], [66, -676], [124, -650, 1], [108, -550], [86, -470, 1], [-86, -470, 1], [-108, -550]], { fill: AZU, a: 0.2, veil: 0.7 }); line([[-88, -598], [-50, -570], [-8, -580]], { w: 2 }); line([[88, -598], [50, -570], [8, -580]], { w: 2 }); line([[-96, -520], [-80, -480]], { w: 1.3 }); line([[96, -520], [80, -480]], { w: 1.3 }); line([[0, -574], [0, -492]], { w: 1.4 }); for (const y of [-548, -520]) line([[-34, y], [0, y + 6], [34, y]], { w: 1.3 });
      form([[-88, -492, 1], [0, -484], [88, -492, 1], [90, -456, 1], [0, -448], [-90, -456, 1]], { fill: RED, a: 0.42 }); form(circ(0, -470, 20, 10), { fill: GOLD, a: 0.5, gold: true, w: 2.4 });
      ribbon([[-70, -664], [-20, -640], [30, -650], [70, -664]], 9, RED, { erase: true, a: 0.42, twist: 2 });
      const T = head(4, -752, 1.06, { brow: 'fierce', beak: true, round: true, wash: AZU });
      form([T(-48, -24, 1), T(-70, -70, 1), T(-44, -62), T(-52, -118, 1), T(-22, -80), T(-12, -140, 1), T(8, -84), T(34, -128, 1), T(34, -72), T(66, -92, 1), T(48, -30, 1), T(22, -52), T(-12, -52)], { fill: RED, a: 0.44 });   // hair that stands like flame
      line([T(-30, -56), T(-34, -86)], { w: 1.4 }); line([T(-4, -58), T(-6, -100)], { w: 1.4 }); line([T(22, -58), T(28, -94)], { w: 1.4 }); form([T(-46, -14, 1), T(-78, -40, 1), T(-58, 6)], { fill: AZU, a: 0.22, veil: 0.7, w: 2.2 });
      // the golden staff, raised across him in both hands
      const a = [-250, -380], b = [290, -840], l = Math.hypot(b[0] - a[0], b[1] - a[1]), sh = shaft(a, b, { w: 10, col: GOLD }); for (const k of [0, -l + 34]) form([sh(k - 34, -11, 1), sh(k, -11, 1), sh(k, 11, 1), sh(k - 34, 11, 1)], { fill: RED, a: 0.5, w: 2.2 });
      const gA = Math.atan2(b[1] - a[1], b[0] - a[0]); arm([-134, -634], [-226, -540], [-140, -474], { bare: true, w: 30, grip: gA }); arm([134, -634], [240, -630], [170, -738], { bare: true, w: 30, grip: gA });
    });
    cloud(CX + 150, FEET - 52, 0.95, DARK, { flip: -1, a: 0.1 }); cloud(CX - 90, FEET - 26, 1.3, DARK, { a: 0.16 }); cloud(CX + 110, FEET - 2, 1.1, DARK, { flip: -1, a: 0.12 });
    for (const [x0, s] of [[CX - 220, 1], [CX + 250, -1]]) form([[x0, FEET - 30, 1], [x0 + 20 * s, FEET - 30, 1], [x0 + 2 * s, FEET - 6, 1], [x0 + 18 * s, FEET - 6, 1], [x0 - 22 * s, FEET + 28, 1], [x0 - 6 * s, FEET + 2, 1], [x0 - 18 * s, FEET + 2, 1]], { fill: GOLD, a: 0.7, gold: true, w: 2 });
  },
  // 邓婵玉: a woman general, the five-light stone raised, five discs of light behind her
  dengchanyu() { at(CX - 10, FEET - 4, 0.9, () => {
    [RED, AZU, GOLD, MAL, OCH].forEach((col, i) => { const a = -Math.PI * 0.9 + (i / 4) * Math.PI * 0.8, x = Math.cos(a) * 310, y = -600 + Math.sin(a) * 280;
      for (let k = 0; k < 16; k++) { const b = (k / 16) * Math.PI * 2; line([[x + Math.cos(b) * 78, y + Math.sin(b) * 78], [x + Math.cos(b) * (k % 2 ? 90 : 100), y + Math.sin(b) * (k % 2 ? 90 : 100)]], { w: 1.5 }); }
      form(circ(x, y, 70, 24), { fill: col, a: 0.3, erase: false, veil: 0.2, w: 2.4 }); ring(x, y, 56, { gold: true, w: 2 }); ring(x, y, 22, { w: 1.4 }); });
    sash(AZU, { wind: 1, k: 0.8 });
    c.save(); c.scale(0.9, 1); const o = { col: RED, robe: MAL, belt: AZU, long: true, wind: 1 }; robe(o); trunk(o); c.restore();
    const T = head(2, -748, 0.94, { brow: 'calm', woman: true });
    form([T(-48, 44, 1), T(-56, -10), T(-46, -50), T(-18, -72), T(12, -72), T(40, -56), T(48, -30, 1), T(20, -52), T(-12, -48), T(-34, -24), T(-38, 20)], { fill: DARK, a: 0.5 });                              // her hair, drawn back
    form([T(-22, -66, 1), T(-34, -104), T(-20, -136), T(4, -146), T(26, -132), T(34, -100), T(22, -68, 1)], { fill: DARK, a: 0.5 }); line([T(-30, -92), T(0, -84), T(32, -94)], { gold: true, w: 3.6 }); line([T(-10, -84), T(-4, -140)], { w: 1.3 }); line([T(10, -84), T(12, -138)], { w: 1.3 });
    form([T(30, -110, 1), T(60, -132), T(92, -124, 1), T(66, -112), T(82, -96, 1), T(50, -98)], { fill: GOLD, a: 0.55, gold: true, w: 2.2 }); line([T(84, -98), T(88, -70), T(84, -52)], { gold: true, w: 1.8 }); dot(T(84, -46)[0], T(84, -46)[1], 4, RED, 0.8);   // a phoenix pin and its drop
    dot(T(32, 8)[0], T(32, 8)[1], 7, RED, 0.2); dot(T(-58, 36)[0], T(-58, 36)[1], 4, GOLD, 0.9);
    // the sabre low in her left hand: a curved blade, a guard, a tassel
    const hl = [-170, -430], Sb = local(hl[0], hl[1], 2.05);
    form([Sb(24, -8, 1), Sb(120, -16), Sb(214, -34), Sb(262, -66, 1), Sb(232, -18), Sb(130, 10), Sb(24, 10, 1)], { veil: 0.92, w: 2.6 }); line([Sb(30, 2), Sb(126, -2), Sb(226, -30)], { w: 1.4 });
    form([Sb(14, -20, 1), Sb(26, -20, 1), Sb(26, 22, 1), Sb(14, 22, 1)], { fill: GOLD, a: 0.6, gold: true, w: 2.4 }); form([Sb(-40, -6, 1), Sb(14, -6, 1), Sb(14, 8, 1), Sb(-40, 8, 1)], { fill: OCH, a: 0.5, w: 2 }); ribbon([Sb(-40, 0), Sb(-70, 20), Sb(-80, 60), Sb(-110, 80)], 7, RED, { taper: true, erase: false, a: 0.45 });
    arm([-112, -640], [-196, -548], hl, { col: RED, w: 21, flare: Math.PI - 0.3, grip: 2.05 });
    const hr = [170, -850]; arm([112, -640], [214, -700], hr, { col: RED, w: 21, flare: 0.6, grip: 0 });
    for (let k = 0; k < 5; k++) { const b = -Math.PI * 0.92 + (k / 4) * Math.PI * 0.84; line([[hr[0] + Math.cos(b) * 34, hr[1] - 30 + Math.sin(b) * 34], [hr[0] + Math.cos(b) * 78, hr[1] - 30 + Math.sin(b) * 78]], { w: 2.4, col: [RED, AZU, GOLD, MAL, OCH][k] }); }
    form(circ(hr[0], hr[1] - 30, 22, 12, 1, 0.9), { fill: GOLD, a: 0.4, veil: 0.9, gold: true, w: 2.8 }); line([[hr[0] - 10, hr[1] - 34], [hr[0] + 4, hr[1] - 26]], { w: 1.4 });                              // the stone, its five lights
  }); },
  // 黄飞虎 (武成王): on the five-coloured ox, under a king's canopy
  huangfeihu() { at(CX - 6, FEET - 4, 1, () => {
    // the canopy on its pole, behind him
    const cx = -50; shaft([cx, -330], [cx, -884], { w: 5 });
    form([[cx - 214, -838, 1], [cx - 124, -884], [cx, -904], [cx + 126, -884], [cx + 216, -838, 1], [cx, -822]], { fill: GOLD, a: 0.36, erase: false }); folds([[cx - 24, -900], [cx + 24, -900]], [[cx - 204, -838], [cx, -822], [cx + 206, -838]], 7, { len: 1, bow: 3 });
    form([[cx - 214, -838, 1], [cx, -822], [cx + 216, -838, 1], [cx + 212, -776, 1], [cx, -758], [cx - 210, -776, 1]], { fill: RED, a: 0.34, erase: false }); line([[cx - 212, -806], [cx, -790], [cx + 214, -806]], { gold: true, w: 2.4 });
    for (let i = 0; i < 11; i++) { const t = i / 10, p = samp([[cx - 210, -776], [cx, -758], [cx + 212, -776]], t); line([p, [p[0] + 3, p[1] + 44]], { gold: true, w: 2.4 }); dot(p[0] + 3, p[1] + 50, 5, RED, 0.6); }
    for (const s of [-1, 1]) ribbon([[cx + s * 212, -800], [cx + s * 250, -720], [cx + s * 226, -640], [cx + s * 262, -560]], 9, s > 0 ? AZU : MAL, { erase: false, taper: true, a: 0.4 });
    form(circ(cx, -916, 15, 10), { fill: GOLD, a: 0.6, gold: true, w: 2.4 });
    // the ox, walking to the right: far legs, body in five colours, head, near legs
    const leg = (x, far) => { form([[x - 30, -170, 1], [x + 30, -170, 1], [x + 20, -80], [x + 24, -26, 1], [x - 22, -26, 1], [x - 18, -80]], { fill: far ? DARK : null, a: 0.14, veil: 0.8 }); form([[x - 24, -26, 1], [x + 26, -26, 1], [x + 36, 0, 1], [x - 30, 0, 1]], { fill: DARK, a: 0.4, w: 2.2 }); line([[x + 4, -24], [x + 6, 0]], { w: 1.4 }); };
    leg(-250, 1); leg(170, 1);
    line([[-330, -330], [-372, -300], [-384, -200], [-364, -130]], { w: 2.6 }); form([[-380, -136, 1], [-350, -130, 1], [-356, -70], [-382, -80]], { fill: DARK, a: 0.4, w: 2.2 });
    const back = [[-330, -326], [-250, -352], [-120, -348], [20, -344], [140, -378], [226, -340]], belly = [[-320, -180], [-220, -130], [-60, -122], [80, -128], [200, -150], [240, -210]], hull = [...back, [262, -260], ...belly.slice().reverse(), [-344, -250]];
    form(hull, { veil: 0.82 });
    [RED, OCH, MAL, AZU, GOLD].forEach((col, i) => { const t0 = i / 5, t1 = (i + 1) / 5, a0 = samp(back, t0), a1 = samp(back, t1), b0 = samp(belly, t0), b1 = samp(belly, t1);
      c.save(); c.beginPath(); c.moveTo(a0[0], a0[1] - 60); c.lineTo(a1[0] + (i === 4 ? 80 : 0), a1[1] - 60); c.lineTo(b1[0] + (i === 4 ? 80 : 0), b1[1] + 60); c.lineTo(b0[0] - (i ? 0 : 60), b0[1] + 60); c.lineTo(a0[0] - (i ? 0 : 60), a0[1] - 60); c.closePath(); c.clip(); trace(hull, true); c.fillStyle = col; c.globalAlpha = 0.3; c.fill(); c.restore(); c.globalAlpha = 1;
      if (i) line([a0, [(a0[0] + b0[0]) / 2 + 8, (a0[1] + b0[1]) / 2], b0], { w: 1.5 }); });
    form([[196, -350, 1], [262, -388], [318, -380], [362, -332], [390, -264], [400, -214], [388, -180], [344, -174], [292, -196], [250, -228], [224, -250, 1]], { veil: 0.86 }); line([[246, -330], [258, -282], [246, -238]], { w: 1.6 });   // the head, lowered: a broad brow, a blunt muzzle
    form([[362, -234, 1], [398, -226], [402, -196], [386, -178], [346, -174], [350, -208]], { fill: DARK, a: 0.16, veil: 0.6, w: 2 }); dot(388, -204, 4); line([[356, -186], [374, -192], [392, -188]], { w: 1.6 });
    form([[304, -300, 1], [320, -312], [340, -304, 1], [322, -292]], { veil: 0.95, w: 2.2 }); dot(323, -302, 5); line([[298, -316], [322, -326], [346, -312]], { w: 2.8 });
    form([[300, -384, 1], [308, -430], [336, -462], [376, -474, 1], [348, -446], [334, -420], [330, -382, 1]], { veil: 0.9, w: 2.4 });                                                       // the far horn
    form([[250, -386, 1], [238, -436], [258, -484], [304, -510, 1], [280, -474], [272, -436], [286, -390, 1]], { veil: 0.9, w: 2.6 }); line([[254, -420], [270, -424]], { w: 1.4 }); line([[252, -446], [268, -452]], { w: 1.4 });   // the near horn
    form([[250, -366, 1], [212, -384], [180, -366, 1], [208, -344], [244, -346]], { veil: 0.9, w: 2.2 }); line([[196, -364], [226, -362]], { w: 1.3 });                                        // the ear
    line([[230, -244], [250, -200], [236, -150], [212, -128]], { w: 1.6 }); ring(398, -168, 13, { gold: true, w: 3.4 });
    line([[226, -330], [250, -250], [240, -170]], { gold: true, w: 3 }); for (const [x, y] of [[236, -290], [250, -230], [244, -180]]) dot(x, y, 6, RED, 0.6);                                                               // a collar of red tassels
    leg(-200, 0); leg(120, 0);
    form([[-170, -356, 1], [50, -352, 1], [84, -250], [70, -160, 1], [-40, -150], [-160, -160, 1], [-196, -250]], { fill: RED, a: 0.36 }); line([[-186, -196], [-160, -170], [-40, -162], [70, -170], [80, -200]], { gold: true, w: 3 }); folds([[-150, -340], [40, -340]], [[-150, -180], [60, -180]], 5, { len: 0.8, bow: 4 });   // the saddle cloth
    // the king, seated: the trunk of a general, the near leg astride
    at(cx, -22, 0.74, () => {
      halo(4, -748, 118, GOLD); sash(RED, { wind: -1, k: 0.86 }); const o = { col: GOLD, robe: RED, belt: RED, wind: -1 }; trunk(o);
      form([[10, -474, 1], [96, -474], [170, -400], [196, -290], [150, -250], [84, -270], [40, -360]], { fill: GOLD, a: 0.3 }); for (let r = 0; r < 4; r++) line([[30 + r * 14, -440 + r * 44], [96 + r * 14, -420 + r * 44], [150 + r * 12, -400 + r * 40]], { w: 1.4 }); line([[84, -276], [150, -256], [194, -294]], { gold: true, w: 3 });   // the thigh under plates
      form([[92, -272, 1], [176, -266, 1], [180, -200], [168, -140, 1], [112, -140, 1], [100, -200]], { fill: GOLD, a: 0.26 }); for (const y of [-236, -196]) line([[100, y], [140, y + 8], [180, y]], { w: 1.5 });
      form([[108, -144, 1], [170, -144, 1], [176, -104], [224, -92], [250, -100, 1], [244, -74], [224, -68, 1], [104, -68, 1], [102, -104]], { fill: DARK, a: 0.32 }); line([[104, -80], [226, -80]], { w: 1.5 });
      const T = head(4, -748, 1.04, { brow: 'fierce', moustache: true, beard: 1 }); helm(T, 1.04, GOLD, { crown: true });
      const a = [210, -150], b = [280, -900], sh = shaft(a, b, { w: 5 }); form([sh(0, -8, 1), sh(30, -18), sh(120, 0, 1), sh(30, 18), sh(0, 8, 1)], { veil: 0.92 }); line([sh(8, 0), sh(104, 0)], { w: 1.4 });
      for (let i = 0; i < 6; i++) ribbon([sh(-6, 0), sh(-40, (i - 2.5) * 16), sh(-78, (i - 2.5) * 26 + 10)], 5, RED, { taper: true, erase: false, a: 0.5, twist: 2 });                                                        // the red tassel under the point
      arm([128, -640], [214, -570], [243, -500], { col: GOLD, cuff: RED, flare: -0.4, grip: Math.atan2(b[1] - a[1], b[0] - a[0]) }); arm([-128, -640], [-214, -540], [-96, -474], { col: GOLD, cuff: RED, flare: Math.PI + 0.5 });
    });
  }); },
};

/** k: scale. Lines are kept at least about 1 px wide on the canvas, so a small bake still reads. */
export function bakeFaxiang(id, k = 1) { const cv = document.createElement('canvas'); cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k); c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); MINW = 1.35 / k; DRAW[id](); c = null; return cv; }
const cache = new Map();
export function drawFaxiang(ctx, id, x, y, k = 1, alpha = 1) { const key = id + '|' + k; if (!cache.has(key)) cache.set(key, bakeFaxiang(id, k)); ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(cache.get(key), Math.round(x - CX * k), Math.round(y - FEET * k)); ctx.restore(); }
