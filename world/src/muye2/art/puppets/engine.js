// Puppet engine (adapted from ../puppet/engine.js): hand-cut curves, pierced sprites, a joint rig.
// A puppet is a tree of rigid parts. Each part is baked once into a small sprite (dye, grain, knife cuts,
// a crisp carved line); a frame only places the sprites with one rotation per joint.
// What changed for the fusion: no lamp penumbra and no cloth; dyes are the sheet's own palette; white is left
// as bare paper; the finished puppet is multiplied onto the paper, so the dye sits in the same sheet as the ink.

export const TAU = Math.PI * 2;
export let INK = '#14110F';
export const setInk = (hex) => { INK = hex; for (const k in tiles) delete tiles[k]; };

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Smooth curve through points. A point [x, y, 1] is a sharp corner (where a knife turns).
export function smooth(p, pts, closed = true, k = 1) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const dir = (i) => {
    const q = at(i);
    if (q[2]) return [0, 0];
    const a = at(i - 1), b = at(i + 1);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  p.moveTo(pts[0][0], pts[0][1]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = at(i), b = at(i + 1);
    const l = (Math.hypot(b[0] - a[0], b[1] - a[1]) / 3) * k;
    const da = dir(i), db = dir(i + 1);
    p.bezierCurveTo(a[0] + da[0] * l, a[1] + da[1] * l, b[0] - db[0] * l, b[1] - db[1] * l, b[0], b[1]);
  }
  if (closed) p.closePath();
}
export function jit(pts, rnd, amp) {
  if (!amp) return pts;
  return pts.map((q) => [q[0] + (rnd() - 0.5) * 2 * amp, q[1] + (rnd() - 0.5) * 2 * amp, q[2]]);
}

// ---- grain: mineral pigment settles unevenly. Dark pools in the ink's colour, pale pores that let the paper through.
function valueNoise(rnd, period) {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const i0 = ((xi % period) + period) % period, i1 = (i0 + 1) % period;
    const j0 = ((yi % period) + period) % period, j1 = (j0 + 1) % period;
    const a = g[j0 * period + i0], b = g[j0 * period + i1], c = g[j1 * period + i0], d = g[j1 * period + i1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
const tiles = {};
export function grain() {
  if (tiles.g) return tiles.g;
  const N = 192, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d', { willReadFrequently: true }), im = c.createImageData(N, N), rnd = mulberry(77);
  const n1 = valueNoise(rnd, 8), n2 = valueNoise(rnd, 24), n3 = valueNoise(rnd, 64);
  const k = parseInt(INK.slice(1), 16);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = n1(x / 24, y / 24) * 0.42 + n2(x / 8, y / 8) * 0.3 + n3(x / 3, y / 3) * 0.28 + (rnd() - 0.5) * 0.1;
    const i = (y * N + x) * 4, d = v - 0.5;
    if (d < 0) { im.data[i] = k >> 16; im.data[i + 1] = (k >> 8) & 255; im.data[i + 2] = k & 255; im.data[i + 3] = Math.min(255, -d * 2.0 * 255); }
    else { im.data[i] = 255; im.data[i + 1] = 255; im.data[i + 2] = 255; im.data[i + 3] = Math.min(255, d * 1.5 * 255); }
  }
  c.putImageData(im, 0, 0);
  return (tiles.g = cv);
}

// ---- knife vocabulary (all are filled or stroked under destination-out) ----
export function lune(k, x, y, r, a = 0, fat = 0.5) {            // crescent 月牙
  k.save(); k.translate(x, y); k.rotate(a);
  k.beginPath(); k.moveTo(-r, 0);
  k.quadraticCurveTo(0, -1.7 * r, r, 0);
  k.quadraticCurveTo(0, -1.7 * r * (1 - fat), -r, 0);
  k.fill(); k.restore();
}
export function slit(k, x0, y0, x1, y1, w, bend = 0) {          // willow leaf 柳叶
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
  k.beginPath(); k.moveTo(x0, y0);
  k.quadraticCurveTo(mx + nx * w, my + ny * w, x1, y1);
  k.quadraticCurveTo(mx - nx * w, my - ny * w, x0, y0);
  k.fill();
}
export function dot(k, x, y, r) { k.beginPath(); k.arc(x, y, r, 0, TAU); k.fill(); }
export function ring(k, x, y, r, w) { k.beginPath(); k.arc(x, y, r, 0, TAU); k.lineWidth = w; k.stroke(); }
// 雷纹: a squared spiral, the ground pattern of Shang and Zhou bronzes
export function fret(k, x, y, r, turns = 2, dir = 1, w = 1.2, a0 = 0) {
  k.save(); k.translate(x, y); k.rotate(a0); k.scale(1, dir);
  const n = Math.round(turns * 4), step = (2 * r) / (n / 2 + 0.5), D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let px = -r, py = -r, len = 2 * r;
  k.beginPath(); k.moveTo(px, py);
  for (let i = 0; i < n; i++) { px += D[i % 4][0] * len; py += D[i % 4][1] * len; k.lineTo(px, py); if (i >= 2 && i % 2 === 0) len -= step; if (i === 1) len -= 0; }
  k.lineWidth = w; k.lineCap = 'square'; k.lineJoin = 'miter'; k.stroke(); k.restore();
}
export function scales(k, rnd, x0, y0, x1, y1, s, a = Math.PI) {   // 鱼鳞
  let row = 0;
  for (let y = y0; y <= y1; y += s * 0.82, row++)
    for (let x = x0 + (row % 2 ? s / 2 : 0); x <= x1; x += s)
      lune(k, x + (rnd() - 0.5) * 0.7, y + (rnd() - 0.5) * 0.7, s * (0.4 + rnd() * 0.08), a + (rnd() - 0.5) * 0.35, 0.55);
}
export function chevrons(k, rnd, x0, y0, x1, y1, s, w = 1) {       // 人字
  let row = 0;
  for (let y = y0; y <= y1; y += s * 0.9, row++)
    for (let x = x0; x <= x1; x += s) {
      const cx = x + (rnd() - 0.5) * 0.6, cy = y + (rnd() - 0.5) * 0.6, h = s * 0.42;
      slit(k, cx - h, cy + h * 0.7, cx, cy - h * 0.5, w * 0.55, 0.3); slit(k, cx, cy - h * 0.5, cx + h, cy + h * 0.7, w * 0.55, -0.3);
    }
}
export function petals(k, x, y, r0, r1, n, w, a0 = 0) {            // 雪花
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    slit(k, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, w);
  }
}

// ---- drawing a part ----
class Measure {
  constructor() { this.b = [1e9, 1e9, -1e9, -1e9]; this.rnd = () => 0.5; }
  add(pts, m = 0) { for (const q of pts) { const b = this.b; b[0] = Math.min(b[0], q[0] - m); b[1] = Math.min(b[1], q[1] - m); b[2] = Math.max(b[2], q[0] + m); b[3] = Math.max(b[3], q[1] + m); } }
  body(pts) { this.add(pts, 1); } tint() {} cut() {}
  strip(pts, w) { this.add(pts, w); } ink(pts, w = 1) { this.add(pts, w); }
}

export class G {
  constructor(ctx, S, rnd) {
    this.c = ctx; this.S = S; this.rnd = rnd; this.out = []; this.inks = []; this.last = null;
    this.pat = ctx.createPattern(grain(), 'repeat');
  }
  path(pts, closed = true, amp = 0.22) { const p = new Path2D(); smooth(p, jit(pts, this.rnd, amp), closed); return p; }
  texture(p, a) {
    const c = this.c;
    c.save(); c.clip(p);
    c.globalAlpha = a; c.fillStyle = this.pat;
    c.translate(this.rnd() * 90, this.rnd() * 90); c.scale(0.8, 0.8); c.fillRect(-800, -800, 1600, 1600);
    c.restore();
  }
  // a piece of dyed hide: flat dye, grain, dye pooled a little darker at the edge. col '#ffffff' is bare paper.
  body(pts, col, o = {}) {
    const c = this.c, p = this.path(pts, true, o.jit ?? 0.22), white = col === '#ffffff';
    if (this.solid) { c.fillStyle = '#000'; c.fill(p); this.last = p; this.out.push({ p, w: 1, col: '#000' }); return p; }
    c.save(); c.globalAlpha = o.alpha ?? 1; c.fillStyle = col; c.fill(p); c.restore();
    if (!white) {
      this.texture(p, o.grain ?? 0.34);
      c.save(); c.clip(p); c.strokeStyle = INK; c.lineJoin = 'round';
      c.globalAlpha = 0.08; c.lineWidth = 5; c.stroke(p);
      c.globalAlpha = 0.12; c.lineWidth = 2.2; c.stroke(p);
      c.restore();
    }
    this.last = p;
    if (o.line !== 0) this.out.push({ p, w: o.line ?? 0.95, col: o.lineCol || INK });
    return p;
  }
  // a second dye inside the last body
  tint(pts, col, alpha = 1) {
    if (this.solid) return;
    const c = this.c, p = this.path(pts, true, 0.15);
    c.save(); c.clip(this.last); c.globalAlpha = alpha; c.fillStyle = col; c.fill(p); c.restore();
    c.save(); c.clip(this.last); this.texture(p, 0.3); c.restore();
  }
  // knife work: whatever fn draws is removed from the last body
  cut(fn, clip = true) {
    if (this.solid) return;
    const c = this.c;
    c.save(); if (clip && this.last) c.clip(this.last);
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.strokeStyle = '#000';
    fn(c, this.rnd); c.restore();
  }
  // a thin strip of hide or a shaft: a stroked open curve
  strip(pts, w, col, alpha = 1) {
    const c = this.c, p = this.path(pts, false, 0.12);
    c.save(); c.globalAlpha = this.solid ? 1 : alpha; c.strokeStyle = this.solid ? '#000' : col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(p); c.restore();
  }
  // a line left standing, drawn last
  ink(pts, w = 0.8, col = INK) { if (this.solid) return; this.inks.push({ p: this.path(pts, false, 0.08), w, col }); }
  finish() {
    const c = this.c;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const o of this.out) { c.globalAlpha = 0.96; c.strokeStyle = o.col; c.lineWidth = o.w; c.stroke(o.p); }
    for (const o of this.inks) { c.globalAlpha = 0.96; c.strokeStyle = o.col; c.lineWidth = o.w; c.stroke(o.p); }
    c.globalAlpha = 1;
  }
}

// ---- rig ----
const PAD = 4;
// solid = true bakes the silhouette: every piece filled black, no cuts
export function bake(def, S, seed = 1, solid = false) {
  const parts = def.parts.map((d, i) => {
    const ms = new Measure(); d.draw(ms);
    const [x0, y0, x1, y1] = ms.b;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0 + 2 * PAD) * S); cv.height = Math.ceil((y1 - y0 + 2 * PAD) * S);
    const c = cv.getContext('2d', { willReadFrequently: true });   // on the CPU: the sprite cutter reads these back, and a GPU canvas stalls on the read
    c.scale(S, S); c.translate(PAD - x0, PAD - y0);
    const g = new G(c, S, mulberry(seed * 977 + i * 131 + 7)); g.solid = solid;
    d.draw(g); g.finish();
    return { ...d, cv, ox: x0 - PAD, oy: y0 - PAD, w: cv.width / S, h: cv.height / S, i };
  });
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const order = [...parts].sort((a, b) => a.z - b.z);
  const depth = (p) => (p.parent ? 1 + depth(byId[p.parent]) : 0);
  parts.sort((a, b) => depth(a) - depth(b));
  return { parts, byId, order, feet: def.feet || [], S };
}

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const rot = (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };

// world matrices for every part. base = [a,b,c,d,e,f] places the root.
export function solve(pup, base, pose = {}) {
  const M = {};
  for (const p of pup.parts) {
    const ang = pose[p.id] ?? p.rot ?? 0;
    if (!p.parent) { M[p.id] = mul(base, rot(ang)); continue; }
    const pm = M[p.parent], x = p.at[0], y = p.at[1];
    if (p.world) {
      const m = mul([base[0], base[1], base[2], base[3], 0, 0], rot(ang));
      m[4] = pm[0] * x + pm[2] * y + pm[4]; m[5] = pm[1] * x + pm[3] * y + pm[5];
      M[p.id] = m;
    } else M[p.id] = mul(pm, mul([1, 0, 0, 1, x, y], rot(ang)));
  }
  return M;
}
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// pose.$hide = {id: true} leaves a part out (a bow at rest and the same bow drawn are two parts on one pivot)
export function drawPuppet(ctx, pup, base, pose) {
  const M = solve(pup, base, pose), hide = pose && pose.$hide;
  for (const p of pup.order) {
    if (hide && hide[p.id]) continue;
    const m = M[p.id];
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(p.cv, p.ox, p.oy, p.w, p.h);
  }
  return M;
}

// how far below the root the lowest foot sits in this pose (unit scale)
export function footDrop(pup, pose) {
  const M = solve(pup, [1, 0, 0, 1, 0, 0], pose);
  let y = -1e9;
  for (const f of pup.feet) { const m = M[f.id]; y = Math.max(y, m[1] * f.pt[0] + m[3] * f.pt[1] + m[5]); }
  return y;
}
