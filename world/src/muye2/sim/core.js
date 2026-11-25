// Muye's rules, the shared engine parts: numbers, the seeded generator, the spatial grid, where the mass is, the
// object pools, and the geometry of zones. Nothing here knows the content. Owner: rules·campaign (A); others read.

import {WORLD} from '../content.js';

export const TAU = Math.PI * 2;
export const KB = 8;                       // a shove is a speed that dies away at 8 a second: this many times the distance gives that distance
export const DEAD = .6;                    // the dead stay this long as `dead`
export const TICK = .25;                   // burning, fields and auras act this often
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const setState = (u, s) => { if (u.state !== s) { u.state = s; u.stateT = 0; } };

export function rand(g) {
  const a = g.rs = (g.rs + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------------------- the spatial grid
// Rebuilt from the living foes at the start of every step, so it holds nothing between steps.
export const CELL = 64, GW = Math.ceil(WORLD.w / CELL), GH = Math.ceil(WORLD.h / CELL), NC = GW * GH, MAXR = 40;
export const cellStart = new Int32Array(NC + 1), cellFill = new Int32Array(NC);
export const gridItems = [];
export const cellOf = (x, y) => clamp(x / CELL | 0, 0, GW - 1) + clamp(y / CELL | 0, 0, GH - 1) * GW;

export function buildGrid(g) {
  cellStart.fill(0);
  const foes = g.foes;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f.state === 'dead') continue;
    f.cell = cellOf(f.x, f.y);
    cellStart[f.cell + 1]++;
  }
  for (let i = 0; i < NC; i++) cellStart[i + 1] += cellStart[i];
  cellFill.set(cellStart.subarray(0, NC));
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f.state !== 'dead') gridItems[cellFill[f.cell]++] = f;
  }
}
/** The living foes whose bodies reach into the circle, into `out`; returns how many. */
export function query(x, y, r, out) {
  const R = r + MAXR;
  const x0 = clamp((x - R) / CELL | 0, 0, GW - 1), x1 = clamp((x + R) / CELL | 0, 0, GW - 1);
  const y0 = clamp((y - R) / CELL | 0, 0, GH - 1), y1 = clamp((y + R) / CELL | 0, 0, GH - 1);
  let n = 0;
  for (let cy = y0; cy <= y1; cy++) {
    const base = cy * GW;
    for (let k = cellStart[base + x0], end = cellStart[base + x1 + 1]; k < end; k++) {
      const f = gridItems[k];
      if (f.state === 'dead') continue;
      const dx = f.x - x, dy = f.y - y, rr = r + f.r;
      if (dx * dx + dy * dy <= rr * rr) out[n++] = f;
    }
  }
  return n;
}
/** As `query`, for a lane from (x, y) along `dir`, `len` long and `w` wide. */
export function queryLane(x, y, dir, len, w, out) {
  const c = Math.cos(dir), s = Math.sin(dir);
  const n = query(x + c * len / 2, y + s * len / 2, len / 2 + w / 2, out);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const f = out[i], dx = f.x - x, dy = f.y - y, along = dx * c + dy * s, off = Math.abs(dy * c - dx * s);
    if (along >= -f.r && along <= len + f.r && off <= w / 2 + f.r) out[m++] = f;
  }
  return m;
}
export const Qpick = [], Qnear = [], Qhit = [], Qshot = [], Qhop = [], Qally = [], Qward = [], Qhero = [], Qzone = [], Qaura = [], Qwade = [];
export const PICKED = [], DIRS = [];

export function nearestFoe(x, y, range) {
  const n = query(x, y, range, Qnear);
  let best = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const f = Qnear[i], dx = f.x - x, dy = f.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
/** Up to `count` of the nearest foes, no two within `sep` radians of one another as seen from (x, y), into PICKED. */
export function pickNearest(x, y, range, count, sep) {
  const n = query(x, y, range, Qpick), cs = Math.cos(sep);
  let m = 0;
  while (m < count) {
    let best = null, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const f = Qpick[i], dx = f.x - x, dy = f.y - y, d2 = dx * dx + dy * dy;
      if (d2 >= bd) continue;
      const d = Math.sqrt(d2) || 1;
      let ok = true;
      for (let j = 0; j < m && ok; j++) {
        const p = PICKED[j];
        if (p === f) { ok = false; break; }
        const px = p.x - x, py = p.y - y, pd = Math.hypot(px, py) || 1;
        if (sep > 0 && (dx * px + dy * py) / (d * pd) > cs) ok = false;
      }
      if (ok) { bd = d2; best = f; }
    }
    if (!best) break;
    PICKED[m++] = best;
  }
  return m;
}

// ------------------------------------------------------------------------------------------- where the mass is
// A coarse count of the foes round the hero, refreshed four times a second: the densest groups are where domes,
// seals and volleys fall, and its heaviest side is where the shields turn.
export const DW = 13, DCELL = 120, DHALF = DW * DCELL / 2, ELITE_WEIGHT = 6;
export const CL = Array.from({length: 12}, () => ({x: 0, y: 0, n: 0}));

export function refreshDense(g) {
  const d = g.dense, h = g.hero, n = d.n, sx = d.sx, sy = d.sy;
  n.fill(0); sx.fill(0); sy.fill(0);
  d.ox = h.x - DHALF; d.oy = h.y - DHALF;
  for (let i = 0; i < g.foes.length; i++) {
    const f = g.foes[i];
    if (f.state === 'dead') continue;
    const cx = (f.x - d.ox) / DCELL | 0, cy = (f.y - d.oy) / DCELL | 0;
    if (cx < 0 || cy < 0 || cx >= DW || cy >= DW || f.x < d.ox || f.y < d.oy) continue;
    const c = cx + cy * DW, w = f.elite ? ELITE_WEIGHT : 1;         // a chariot or a leader counts as a group by itself
    n[c] += w; sx[c] += (f.x - d.ox) * w; sy[c] += (f.y - d.oy) * w;
  }
}
/** The `k` densest groups within `range` of (x, y), densest first, into CL; returns how many. */
export function clusters(g, x, y, range, k) {
  const d = g.dense, n = d.n;
  let m = 0;
  while (m < k) {
    let best = -1, bn = 0;
    for (let c = 0; c < DW * DW; c++) {
      if (n[c] <= bn) continue;
      const px = d.ox + d.sx[c] / n[c] - x, py = d.oy + d.sy[c] / n[c] - y;
      if (px * px + py * py > range * range) continue;
      bn = n[c]; best = c;
    }
    if (best < 0) break;
    const o = CL[m++];
    o.x = d.ox + d.sx[best] / bn; o.y = d.oy + d.sy[best] / bn; o.n = bn; o.c = best;
    n[best] = -bn;                                     // taken: put back below
  }
  for (let i = 0; i < m; i++) n[CL[i].c] = CL[i].n;
  return m;
}

export const foePool = [], shotPool = [], zonePool = [], pickupPool = [], allyPool = [];

/** Is (x, y), with `pad` to spare, on a zone's ground: a circle, a ring, a lane or a cone. */
export function inZone(z, x, y, pad) {
  const dx = x - z.x, dy = y - z.y;
  if (z.shape === 'lane') {
    const c = Math.cos(z.dir), s = Math.sin(z.dir), along = dx * c + dy * s, off = Math.abs(dy * c - dx * s);
    return along >= -pad && along <= z.len + pad && off <= z.w / 2 + pad;
  }
  const d = Math.hypot(dx, dy);
  if (d > z.r + pad) return false;
  if (z.shape === 'ring') {
    if (d < z.r0 - pad) return false;
    if (!z.gap) return true;                                // a gap of half-angle `gap` round `dir` is open (a ring's far side)
    let a = Math.atan2(dy, dx) - z.dir; a -= Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
    return Math.abs(a) > z.gap - pad / Math.max(d, 1);
  }
  if (z.shape === 'cone') return d < 1 || (dx * Math.cos(z.dir) + dy * Math.sin(z.dir)) / d >= Math.cos(z.angle * Math.PI / 360 + pad / Math.max(d, 1));
  return true;
}

export function compact(list, pool) {
  let w = 0;
  for (let i = 0; i < list.length; i++) { const o = list[i]; if (o.dead) pool.push(o); else list[w++] = o; }
  list.length = w;
}
