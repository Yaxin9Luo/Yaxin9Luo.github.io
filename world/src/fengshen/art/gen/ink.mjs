// A small ink-wash engine. No canvas: every mark is a density of pigment laid into a Float32 sheet, and the sheet is
// turned into colour by absorption (paper x exp(-density)), the way thin ink darkens paper.
//
//   stroke()   a brush pull along a spline: thick-thin by pressure, a loaded side and a thin side, wet pooling at the
//              edge, and dry-brush (飞白): bristle streaks that skip over the paper's tooth as the brush runs dry
//   mountain() a graded wash hung from a ridge line that fades down into bare paper (mist)
//   blot()     a wet stain with a tide line at its rim: dust, mist, a pressed dot
//   white      an opaque body colour (clam-shell white) that covers what is under it: reserved shapes, mist veils
//
// Units are scene pixels; a layer is `s` device pixels per unit, so the same painting code bakes at 1x, 2x or 3x.
import {createRequire} from 'node:module';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json');
export const sharp = require('sharp');

export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) };

/* ---------- chance and noise ---------- */
export function chance(seed) {
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
  const R = (a, b) => a + rnd() * (b - a);
  return {rnd, R, pick: a => a[Math.floor(rnd() * a.length)], gauss: () => (rnd() + rnd() + rnd() - 1.5) / 1.5};
}
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 };
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = .5, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= .5 } return s / n }

/* ---------- pigments: absorption of red, green, blue per unit of density ---------- */
// A tone is a time of day: the paper's colour, the temperature of the ink, and the strength of one accent (the sun).
// Nothing else changes between tones. PAPER and PIG.ink are mutated in place by setTone().
export const TONES = {
  day:  {paper: [239, 231, 214], ink: [1.00, .985, .94], sun: .2},     // #EFE7D6 raw xuan; pine-soot ink, neutral
  dusk: {paper: [226, 203, 166], ink: [1.10, 1.00, .84], sun: .5},    // #E2CBA6 tea-stained silk; a cooler, bluer ink
};
export const PAPER = [...TONES.day.paper];
export const PIG = {
  ink: [...TONES.day.ink],
  red: [.15, 1.05, 1.22],                        // cinnabar 朱砂
  azu: [1.10, .70, .36],                         // azurite 石青, thin
};
export let TONE = TONES.day;
export function setTone(name) { TONE = TONES[name]; PAPER.splice(0, 3, ...TONE.paper); PIG.ink.splice(0, 3, ...TONE.ink); return TONE }

function blur(a, w, h, r, passes = 2) {
  r = Math.max(1, Math.round(r));
  const t = new Float32Array(a.length), k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += a[o + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[o + x] = acc * k; acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)] } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = acc * k; acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x] } }
  }
  return a;
}

export class Layer {
  /** w, h in units; s device pixels per unit; ox, oy: where unit (0, 0) sits inside the sheet, in units */
  constructor(w, h, s = 1, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.s = s; this.W = Math.round(w * s); this.H = Math.round(h * s);
    this.base = {ox, oy}; this.xf = {ox, oy, k: 1, flip: 1};
    const N = this.W * this.H;
    this.d = {ink: new Float32Array(N)}; this.wh = null; this.N = N; this._tooth = null; this.seed = 1;
  }
  at(x, y, k = 1, flip = 1) { this.xf = {ox: this.base.ox + x, oy: this.base.oy + y, k, flip}; return this }
  home() { this.xf = {...this.base, k: 1, flip: 1}; return this }
  pig(name) { return this.d[name] || (this.d[name] = new Float32Array(this.N)) }
  // the paper's tooth, 0..1: soft and fibrous, no weave. A function of unit coordinates, so it does not change with s.
  get tooth() {
    if (this._tooth) return this._tooth;
    const T = this._tooth = new Float32Array(this.N), s = this.s, W = this.W;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < W; x++) { const ux = x / s, uy = y / s; T[y * W + x] = .5 * vnoise(ux * 1.15, uy * 1.15) + .32 * vnoise(ux * 2.9 + 40, uy * 2.5) + .18 * vnoise(ux * .22, uy * .3 + 9) }
    return T;
  }
  // lay a patch of density (tmp over the box x0, y0, bw, bh) into a pigment; white covers instead of staining
  _lay(tmp, x0, y0, bw, bh, pig) {
    const W = this.W;
    if (pig === 'white') {
      const wh = this.wh || (this.wh = new Float32Array(this.N)), ds = Object.values(this.d);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = clamp(tmp[y * bw + x]); if (v <= 0) continue; const i = (y0 + y) * W + x0 + x; for (const d of ds) d[i] *= 1 - v; wh[i] += v - wh[i] * v }
    } else if (pig === 'lift') {   // water on wet ink: takes pigment away, covers nothing
      const ds = Object.values(this.d);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = clamp(tmp[y * bw + x]); if (v <= 0) continue; const i = (y0 + y) * W + x0 + x; for (const d of ds) d[i] *= 1 - v; if (this.wh) this.wh[i] *= 1 - v }
    } else {
      const d = this.pig(pig);
      // ink over ink does not add for ever: a sheet that is already black takes little more
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = tmp[y * bw + x]; if (v > 0) { const i = (y0 + y) * W + x0 + x; d[i] += v * Math.max(.12, 1 - d[i] / 3.3) } }
    }
  }

  /** Catmull-Rom through [x, y, halfWidth] points (units, in the current frame) -> device samples with arc length */
  path(pts) {
    const {ox, oy, k, flip} = this.xf, s = this.s;
    const P = pts.map(p => [(ox + flip * p[0] * k) * s, (oy + p[1] * k) * s, Math.max(0, p[2]) * k * s]);
    if (P.length === 1) P.push([P[0][0] + .01, P[0][1], P[0][2]]);
    const out = []; let S = 0;
    const g = i => P[clamp(i, 0, P.length - 1)];
    for (let i = 0; i < P.length - 1; i++) {
      const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
      const n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 2.2));
      for (let j = i ? 1 : 0; j <= n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const q = m => .5 * (2 * b[m] + (c[m] - a[m]) * t + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * t2 + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * t3);
        const x = q(0), y = q(1), w = Math.max(0, q(2));
        if (out.length) S += Math.hypot(x - out[out.length - 1].x, y - out[out.length - 1].y);
        out.push({x, y, w, s: S});
      }
    }
    return out;
  }

  /**
   * One pull of the brush.
   *   load, load1   pigment at the start and the end of the pull
   *   dry, dry1     0 wet .. 1 almost nothing leaves the bristles; dryPow bends how fast it runs dry
   *   side          -1..1: one side of the brush carries more ink than the other (side-loaded)
   *   pool          wet pigment gathered at the edge
   *   streak        bristle streaks inside a wet stroke
   *   rag           raggedness of the edge;  soft: feathered edge as a share of the width
   *   bleed         share of the ink that spreads into the paper, over bleedR units
   */
  stroke(pts, o = {}) {
    const P = this.path(pts), n = P.length, S = P[n - 1].s || 1, s = this.s, W = this.W, H = this.H, T = this.tooth;
    const {load = 1, load1 = load, dry = 0, dry1 = dry, dryPow = 1.4, side = 0, pool = .18, streak = .25, rag = .12, soft = .12, bleed = 0, bleedR = 2.5, pig = 'ink', gran = .5} = o;
    const seed = o.seed ?? (this.seed += 7.31), flip = this.xf.flip, ks = s * this.xf.k;
    let wmax = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of P) { wmax = Math.max(wmax, p.w); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
    const pad = wmax * 1.3 + 3 + (bleed ? bleedR * ks * 2.5 : 0);
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(W - 1, Math.ceil(x1 + pad)); y1 = Math.min(H - 1, Math.ceil(y1 + pad));
    if (x1 < x0 || y1 < y0) return this;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, tmp = new Float32Array(bw * bh);
    const wu = wmax / ks, anyDry = dry > 0 || dry1 > 0;
    for (let i = 0; i < n - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
      const m = Math.max(a.w, b.w) * 1.3 + 2;
      const sx0 = Math.max(x0, Math.floor(Math.min(a.x, b.x) - m)), sx1 = Math.min(x1, Math.ceil(Math.max(a.x, b.x) + m));
      const sy0 = Math.max(y0, Math.floor(Math.min(a.y, b.y) - m)), sy1 = Math.min(y1, Math.ceil(Math.max(a.y, b.y) + m));
      for (let py = sy0; py <= sy1; py++) for (let px = sx0; px <= sx1; px++) {
        let t = ((px - a.x) * dx + (py - a.y) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (a.x + dx * t), ey = py - (a.y + dy * t), dist = Math.sqrt(ex * ex + ey * ey), w = a.w + (b.w - a.w) * t;
        if (dist > w * 1.3 + 1.5) continue;
        const ux = px / s, uy = py / s, tooth = T[py * W + px];
        const wc = Math.min(w, 4 * ks);
        const wr = w + wc * rag * 2 * (.6 * vnoise(ux * .5 + seed, uy * .5) + .4 * vnoise(ux * 1.7, uy * 1.7 + seed) - .5);
        const softPx = Math.max(1.1, soft * wc);
        let e = smooth(0, softPx, wr - dist + softPx * .5);
        if (e <= 0) continue;
        if (w < .9) e *= w / .9 + .08;
        const u = clamp((dx * ey - dy * ex >= 0 ? 1 : -1) * flip * dist / (w || 1), -1, 1), sl = (a.s + t * L), sr = sl / S;
        const b1 = vnoise(u * wu * .62 + seed * 3.1, sl / ks * .03 + seed), b2 = vnoise(u * wu * 1.5 + seed * 1.7, sl / ks * .1);
        let v = (load + (load1 - load) * sr) * (1 + side * u) * (1 + gran * (tooth - .5) * (.3 + dry)) * (1 + pool * smooth(.5, 1, Math.abs(u))) * (1 - streak * (b1 - .5));
        if (anyDry) { const dr = dry + (dry1 - dry) * Math.pow(sr, dryPow); if (dr > 0) v *= smooth(dr - .09, dr + .09, b1 * .48 + b2 * .2 + tooth * .32 + .0) * (1 + dr * .25) }
        v *= e;
        const j = (py - y0) * bw + px - x0; if (v > tmp[j]) tmp[j] = v;
      }
    }
    if (bleed > 0) { const bl = blur(Float32Array.from(tmp), bw, bh, bleedR * ks * .6, 2); for (let i = 0; i < tmp.length; i++) tmp[i] = tmp[i] * (1 - bleed * .45) + bl[i] * bleed }
    this._lay(tmp, x0, y0, bw, bh, pig);
    return this;
  }

  /** A wet stain: an ellipse with an uneven edge, a pale body and a tide line at the rim. */
  blot(cx, cy, rx, ry, o = {}) {
    const {dens = .2, rim = .5, rimW = .12, soft = .25, rough = .35, freq = .03, pig = 'ink', gran = .5, rot = 0} = o;
    const {ox, oy, k, flip} = this.xf, s = this.s, W = this.W, H = this.H, T = this.tooth, seed = o.seed ?? (this.seed += 3.7);
    const X = (ox + flip * cx * k) * s, Y = (oy + cy * k) * s, RX = rx * k * s, RY = ry * k * s, R = Math.max(RX, RY) * (1.25 + rough);
    const x0 = Math.max(0, Math.floor(X - R)), x1 = Math.min(W - 1, Math.ceil(X + R)), y0 = Math.max(0, Math.floor(Y - R)), y1 = Math.min(H - 1, Math.ceil(Y + R));
    if (x1 < x0 || y1 < y0) return this;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, tmp = new Float32Array(bw * bh), ca = Math.cos(rot * flip), sa = Math.sin(rot * flip);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = px - X, dy = py - Y, ex = (dx * ca + dy * sa) / RX, ey = (-dx * sa + dy * ca) / RY;
      const r = Math.sqrt(ex * ex + ey * ey) + (fbm(px / s * freq + seed, py / s * freq, 3) - .5) * 2 * rough;
      if (r > 1.05) continue;
      const body = 1 - smooth(1 - soft, 1, r), tide = rim * Math.exp(-(((r - (1 - soft * .6)) / rimW) ** 2));
      tmp[(py - y0) * bw + px - x0] = dens * (body + tide * body ** .3) * (1 + gran * (T[py * W + px] - .5));
    }
    this._lay(tmp, x0, y0, bw, bh, pig);
    return this;
  }

  /**
   * A wash hung from a ridge: densest under the ridge line, fading down into bare paper.
   * ridge(x) -> y in units (scene frame). fade: units of fall; edge: the wet line that gathers along the ridge.
   */
  mountain(ridge, o = {}) {
    const {dens = .3, fade = 160, fadeVar = .5, pow = 1.25, edge = .5, edgeW = 1.6, blotch = .35, gran = .5, pig = 'ink', x0 = -1e9, x1 = 1e9, rough = 1.2, band = 0, tide = .3, feather = 40, mod = null} = o;
    const {ox, oy} = this.xf, s = this.s, W = this.W, H = this.H, T = this.tooth, seed = o.seed ?? (this.seed += 5.3), d = pig === 'white' ? null : this.pig(pig);
    const tmpCol = new Float32Array(H);
    for (let X = 0; X < W; X++) {
      const xu = X / s - ox; if (xu < x0 || xu > x1) continue;
      const side = smooth(x0, x0 + feather, xu) * (1 - smooth(x1 - feather, x1, xu)) * (mod ? mod(xu) : 1); if (side <= 0) continue;
      const yr = (ridge(xu) + oy + (vnoise(xu * .7 + seed, 3) - .5) * rough) * s;
      const f = fade * s * (1 - fadeVar * .5 + fadeVar * fbm(xu * .006 + seed, 7, 2));
      const ya = Math.max(0, Math.floor(yr - 1)), yb = Math.min(H - 1, Math.ceil(yr + f));
      if (!d) tmpCol.fill(0, ya, yb + 1);
      for (let Y = ya; Y <= yb; Y++) {
        const dd = Y - yr, cov = clamp(dd + .5); if (cov <= 0) continue;
        const t = dd / f; let body = Math.pow(1 - smooth(0, 1, t), pow);
        const yu = Y / s, n = fbm(xu * .007 + seed, yu * .013, 3), n2 = fbm(xu * .021 + seed * 2, yu * .03, 3);
        body *= 1 + blotch * ((n - .5) * 2 + (n2 - .5) * 1.1);
        if (tide) body *= 1 + tide * (Math.exp(-(((n - .47) / .012) ** 2)) + .7 * Math.exp(-(((n2 - .55) / .014) ** 2)));
        if (band) body *= 1 - band * smooth(.25, .45, t) * (1 - smooth(.5, .8, t)) * vnoise(xu * .004 + seed, 1);
        const v = dens * side * cov * (body + edge * Math.exp(-dd / (edgeW * s)) * (.6 + .8 * vnoise(xu * .05 + seed, 5))) * (1 + gran * (T[Y * W + X] - .5));
        if (d) d[Y * W + X] += v; else tmpCol[Y] = v;
      }
      if (!d) this._lay(tmpCol.subarray(ya, yb + 1), X, ya, 1, yb - ya + 1, 'white');
    }
    return this;
  }

  /** soften everything laid so far in one pigment (a wash left to spread) */
  soften(pig, r) { blur(this.pig(pig), this.W, this.H, r * this.s, 2); return this }

  /** straight-alpha RGBA of the layer alone. Exact over bare paper; over other paint the ink still multiplies. */
  rgba() {
    const N = this.N, out = new Uint8ClampedArray(N * 4), names = Object.keys(this.d), wh = this.wh;
    for (let i = 0; i < N; i++) {
      let ar = 0, ag = 0, ab = 0;
      for (const nm of names) { const v = this.d[nm][i]; if (v > 0) { const k = PIG[nm]; ar += v * k[0]; ag += v * k[1]; ab += v * k[2] } }
      const w = wh ? wh[i] : 0;
      if (ar === 0 && w === 0) continue;
      const tr = Math.exp(-ar), tg = Math.exp(-ag), tb = Math.exp(-ab);
      const kr = (1 - w) * tr, kg = (1 - w) * tg, kb = (1 - w) * tb, mn = Math.min(kr, kg, kb), a = 1 - mn;
      if (a < .004) continue;
      // out over dst = dst * K + C, written as source-over with alpha a (dst taken as paper for the coloured part)
      out[i * 4] = PAPER[0] * (w * tr + kr - mn) / a; out[i * 4 + 1] = PAPER[1] * (w * tg + kg - mn) / a; out[i * 4 + 2] = PAPER[2] * (w * tb + kb - mn) / a; out[i * 4 + 3] = a * 255;
    }
    return out;
  }
  image() { return sharp(Buffer.from(this.rgba().buffer), {raw: {width: this.W, height: this.H, channels: 4}}) }
}

/** The sheet itself: warm, a little uneven, with long fibres. RGB, w x h device pixels. */
export function paper(w, h, s = 1, seed = 11) {
  const out = Buffer.alloc(w * h * 3), C = chance(seed), fib = new Float32Array(w * h);
  for (let i = 0; i < w * h / (s * s) / 1500; i++) {   // fibres: short curved hairs, lighter or darker
    let x = C.R(0, w), y = C.R(0, h), a = C.R(0, Math.PI * 2); const len = C.R(6, 22) * s, v = C.R(-1, 1) > -.2 ? C.R(.2, .7) : -C.R(.2, .6), cv = C.R(-.03, .03);
    for (let j = 0; j < len; j++) { const xi = x | 0, yi = y | 0; if (xi >= 0 && yi >= 0 && xi < w && yi < h) fib[yi * w + xi] = v; x += Math.cos(a); y += Math.sin(a); a += cv + C.R(-.03, .03) }
  }
  if (s > 1) blur(fib, w, h, 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ux = x / s, uy = y / s, i = y * w + x;
    const m = (fbm(ux * .0035, uy * .0045, 4) - .5) * .05 + (vnoise(ux * 1.3, uy * 1.3) - .5) * .022 + (vnoise(ux * .06, uy * .5) - .5) * .012 - fib[i] * .016;
    const vg = 1;
    const k = (1 + m) * vg;
    out[i * 3] = clamp(PAPER[0] * k, 0, 255); out[i * 3 + 1] = clamp(PAPER[1] * (k - m * .12), 0, 255); out[i * 3 + 2] = clamp(PAPER[2] * (k - m * .35 - (1 - vg) * .5), 0, 255);
  }
  return sharp(out, {raw: {width: w, height: h, channels: 3}});
}
