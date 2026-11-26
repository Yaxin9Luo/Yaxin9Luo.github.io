// The instruments of the proposed sound world, synthesized once into sample buffers (Float32Array), then played as
// buffer sources. Pure functions of the sample rate and a few parameters: no Web Audio here, so the same code runs in
// a page, a worker, or Node for measurement.
//
// Why buffers and not oscillator stacks: a bronze bell is a dozen inharmonic partials, each with its own decay and a
// slow beat between the two halves of a split mode; a plucked string is a delay line with a loss filter. Neither can be
// built from a few oscillators with one envelope without sounding like a 1990s synth. Rendered once, each costs one
// buffer source to play.

const TAU = Math.PI * 2;
/** A small seeded random, so every render of an instrument is the same (measurements repeat). */
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; }
const t60k = (sr, t60) => Math.exp(-6.907755 / Math.max(1e-3, t60 * sr));      // per-sample gain that falls 60 dB in t60 s

/** Sum of exponentially decaying sines, each optionally split into a beating pair. Fast: a recursive oscillator per partial.
    partials: [{f, a, t60, beat = 0 (Hz between the pair), ph}] */
export function modal(sr, len, partials, out = new Float32Array(Math.ceil(len * sr))) {
  const n = out.length;
  for (const p of partials) {
    if (p.f >= sr * .45 || p.a === 0) continue;
    const pair = p.beat ? [[p.f - p.beat / 2, p.a * .55], [p.f + p.beat / 2, p.a * .45]] : [[p.f, p.a]];
    for (const [f, a] of pair) {
      const w = TAU * f / sr, c = 2 * Math.cos(w), k = t60k(sr, p.t60);
      let y1 = Math.sin(p.ph || 0) * a, y2 = Math.sin((p.ph || 0) - w) * a, g = 1;
      const end = Math.min(n, Math.ceil(p.t60 * 1.2 * sr));
      for (let i = 0; i < end; i++) { out[i] += y1 * g; const y = c * y1 - y2; y2 = y1; y1 = y; g *= k; }
    }
  }
  return out;
}
/** A one-pole lowpass / highpass and a biquad bandpass, for shaping noise in place. */
export function onePole(x, sr, fc, high = false) {
  const a = Math.exp(-TAU * fc / sr); let y = 0;
  for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = high ? x[i] - y : y; }
  return x;
}
export function bandpass(x, sr, fc, q) {
  const w = TAU * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
/** A noise burst with an exponential tail, added into `out` at sample `at`. */
function burstInto(out, sr, {at = 0, len = .01, amp = .3, t60 = len, seed = 7, lp = 0, hp = 0, bp = 0, q = 1}) {
  const r = rng(seed), m = Math.ceil(len * sr), x = new Float32Array(m), k = t60k(sr, t60);
  let g = 1; for (let i = 0; i < m; i++) { x[i] = r() * g; g *= k; }
  if (bp) bandpass(x, sr, bp, q); if (lp) onePole(x, sr, lp); if (hp) onePole(x, sr, hp, true);
  const fade = Math.min(m, Math.ceil(.0006 * sr));
  for (let i = 0; i < m && at + i < out.length; i++) out[at + i] += x[i] * amp * (i < fade ? i / fade : 1);
  return out;
}
/** Short fade-in and fade-out, so no buffer clicks at its ends. */
function edges(x, sr, a = .0015, z = .02) {
  const na = Math.ceil(a * sr), nz = Math.min(x.length, Math.ceil(z * sr));
  for (let i = 0; i < na && i < x.length; i++) x[i] *= i / na;
  for (let i = 0; i < nz; i++) x[x.length - 1 - i] *= i / nz;
  return x;
}
export function normalize(x, peak = .9) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) { const k = peak / m; for (let i = 0; i < x.length; i++) x[i] *= k; } return x; }

/* ---------- bronze: 编钟 and 钲 ---------- */
/** A chime bell of the 编钟 kind, struck at its front: the strike tone, the minor third a little above it (the bell's
    second tone, sounding faintly from the front strike), and the inharmonic upper partials of a short almond-shaped
    bell that fall away quickly. Each mode is a split pair: the slow beat (0.5 to 3 Hz) is what makes bronze shimmer. */
export function bell(sr, f, {len = null, bright = 1, seed = 3, second = .4} = {}) {
  const T = len || Math.min(4.2, Math.max(1.2, 3.4 * Math.pow(220 / f, .45)));
  const P = [
    [.5, .16, 1.15, .6], [1, 1, 1, 1.1], [1.19, second, .85, 1.6], [2.42, .55 * bright, .48, 2.2], [2.97, .38 * bright, .36, 2.9],
    [3.76, .3 * bright, .27, 3.5], [4.86, .2 * bright, .2, 4.4], [6.1, .14 * bright, .14, 5.5], [7.43, .09 * bright, .1, 6.6], [9.1, .06 * bright, .07, 8],
  ];
  const r = rng(seed), out = new Float32Array(Math.ceil((T * 1.25 + .05) * sr));
  modal(sr, 0, P.map(([k, a, t, b]) => ({f: f * k * (1 + r() * .004), a, t60: T * t, beat: b * (.7 + .3 * r()), ph: r() * Math.PI})), out);
  burstInto(out, sr, {len: .012, amp: .5, t60: .006, seed, bp: Math.min(sr * .4, f * 9), q: .8});          // the mallet on bronze
  burstInto(out, sr, {len: .05, amp: .12, t60: .03, seed: seed + 1, lp: 900});                             // the thump of the strike
  return normalize(edges(out, sr), .9);
}
/** 钲, the handbell beaten to call men back (鸣金收兵): brighter, rougher, shorter, with a wide fast beat. */
export function zheng(sr, f, {seed = 5} = {}) {
  const T = 1.3, P = [[1, 1, 1, 6], [1.48, .7, .8, 9], [2.27, .6, .55, 13], [2.83, .5, .45, 11], [3.92, .35, .3, 15], [5.1, .25, .2, 17], [6.6, .15, .14, 19]];
  const r = rng(seed), out = new Float32Array(Math.ceil((T * 1.2 + .05) * sr));
  modal(sr, 0, P.map(([k, a, t, b]) => ({f: f * k, a, t60: T * t, beat: b, ph: r() * 3})), out);
  burstInto(out, sr, {len: .02, amp: .7, t60: .01, seed, hp: 1500});
  return normalize(edges(out, sr), .9);
}

/* ---------- stone: 磬 ---------- */
/** A stone chime: the modes of a thick L-shaped slab (not harmonic: about 1, 2.3, 2.9, 4.2, 5.6), a hard click, a
    clean ring that is brighter and shorter than bronze, and no beat to speak of. */
export function chime(sr, f, {len = null, seed = 9} = {}) {
  const T = len || Math.min(2.6, Math.max(.7, 1.9 * Math.pow(440 / f, .35)));
  const P = [[1, 1, 1], [2.32, .42, .55], [2.89, .36, .45], [4.15, .26, .3], [5.61, .16, .2], [7.24, .1, .13], [9.03, .06, .09]];
  const r = rng(seed), out = new Float32Array(Math.ceil((T * 1.2 + .03) * sr));
  modal(sr, 0, P.map(([k, a, t], i) => ({f: f * k * (1 + r() * .003), a, t60: T * t, beat: i === 0 ? .25 : 0, ph: r() * 3})), out);
  burstInto(out, sr, {len: .006, amp: .9, t60: .002, seed, hp: 2500});                                    // stone on stone: a hard click
  return normalize(edges(out, sr), .9);
}

/* ---------- skins and wood: 鼓, 柷 ---------- */
/** A drum: the modes of a stretched skin (Bessel zeros: 1, 1.59, 2.14, 2.30, 2.65, 2.92, ...), the pitch thrown up by
    the blow and settling (the skin's tension rises with its swing), the air of the shell under it, and the stick. */
export function drum(sr, f, {len = .8, hit = 1, stick = .25, seed = 11, bend = .3} = {}) {
  const P = [[1, 1, 1], [1.59, .55, .55], [2.14, .42, .4], [2.30, .36, .35], [2.65, .26, .28], [2.92, .2, .22], [3.16, .15, .18], [3.5, .12, .14]];
  const n = Math.ceil((len * 1.15 + .02) * sr), out = new Float32Array(n), r = rng(seed);
  for (const [k, a, t] of P) {            // the bend: the frequency of each mode falls from (1 + bend) to 1 in about 40 ms
    const amp = a * (k === 1 ? 1 : hit), kk = t60k(sr, len * t);
    let ph = r() * .2, g = amp;
    for (let i = 0; i < n; i++) { const tt = i / sr, ff = f * k * (1 + bend * hit * Math.exp(-tt / .04)); ph += TAU * ff / sr; out[i] += Math.sin(ph) * g; g *= kk; if (g < 1e-5) break; }
  }
  { let ph = 0, g = .7; const kk = t60k(sr, len * .55); for (let i = 0; i < n; i++) { ph += TAU * f * .62 / sr; out[i] += Math.sin(ph) * g * Math.min(1, i / (.004 * sr)); g *= kk; } }   // the shell's air, below the skin
  burstInto(out, sr, {len: .03, amp: stick * hit, t60: .012, seed, bp: 1800, q: .9});
  burstInto(out, sr, {len: .12, amp: .25 * hit, t60: .07, seed: seed + 3, lp: 400});
  return normalize(edges(out, sr, .0008), .92);
}
/** Wood struck: the 柷 box and clappers. A few stiff modes and a knock, all gone in a tenth of a second. */
export function wood(sr, f, {len = .12, seed = 13} = {}) {
  const r = rng(seed), out = new Float32Array(Math.ceil((len + .03) * sr));
  modal(sr, 0, [[1, 1, 1], [2.57, .5, .5], [4.21, .3, .35], [5.9, .15, .25]].map(([k, a, t]) => ({f: f * k * (1 + r() * .01), a, t60: len * t})), out);
  burstInto(out, sr, {len: .01, amp: .6, t60: .004, seed, bp: f * 3, q: 1.2});
  return normalize(edges(out, sr, .0005, .01), .9);
}

/* ---------- strings: 琴 and 瑟 ---------- */
/** A plucked string by Karplus-Strong with a fractional, time-varying delay, so the note can slide (the 琴's 上/下 and
    its 吟猱 vibrato). `glide`: [[t, semitones], ...] a path of the stopped pitch over time. The string is plucked at
    `pos` (0..0.5, nearer the bridge is brighter) and loses its highs at `damp` (0 bright .. 1 dull). The 琴's body is a
    long box with low resonances; two of them are added under the string. */
export function pluck(sr, f, {len = 3, pos = .18, damp = .45, glide = null, vib = 0, seed = 17, body = .35, loss = 1} = {}) {
  const n = Math.ceil(len * sr), out = new Float32Array(n), r = rng(seed);
  const maxD = Math.ceil(sr / (f * .5)) + 4, buf = new Float32Array(maxD * 2);
  // the excitation: noise, lowpassed for a finger rather than a pick, then combed at the pluck position
  const D0 = sr / f, ex = new Float32Array(Math.ceil(D0));
  for (let i = 0; i < ex.length; i++) ex[i] = r();
  onePole(ex, sr, 2500 + 5000 * (1 - damp));
  const P = Math.max(1, Math.round(pos * D0));
  for (let i = ex.length - 1; i >= P; i--) ex[i] -= ex[i - P];
  let w = 0;
  for (let i = 0; i < ex.length; i++) buf[w++] = ex[i];
  const S = .5 - .22 * damp, rho = Math.pow(.001, 1 / (len * .9 * f * loss));       // loop filter: a two-point average, weighted; rho sets the decay
  let last = 0, gi = 0;
  const semis = t => { if (!glide) return 0; while (gi < glide.length - 1 && glide[gi + 1][0] <= t) gi++; const a = glide[gi], b = glide[gi + 1]; if (!b || t <= a[0]) return a[1]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); };
  const L = buf.length;
  for (let i = 0; i < n; i++) {
    const t = i / sr, ff = f * Math.pow(2, (semis(t) + vib * Math.sin(TAU * 5.2 * t) * Math.min(1, t * 2)) / 12);
    const D = Math.min(maxD * 2 - 2, sr / ff - .5);                          // -0.5: the averaging filter's own half sample
    let rp = w - D; while (rp < 0) rp += L;
    const i0 = Math.floor(rp), fr = rp - i0, x = buf[i0 % L] * (1 - fr) + buf[(i0 + 1) % L] * fr;
    const y = rho * ((1 - S) * x + S * last); last = x;
    buf[w % L] = y; w++; out[i] = y;
  }
  if (body) {      // the body: two low resonances, mixed under the string
    const b1 = bandpass(Float32Array.from(out), sr, 98, 4), b2 = bandpass(Float32Array.from(out), sr, 196, 5);
    for (let i = 0; i < n; i++) out[i] += (b1[i] * 1.4 + b2[i]) * body;
  }
  return normalize(edges(out, sr, .0008, .05), .9);
}
/** A 琴 harmonic (泛音): the string touched at a node, a pure glassy tone with little else. */
export function harmonic(sr, f, {len = 2.2, seed = 19} = {}) {
  const r = rng(seed), out = new Float32Array(Math.ceil(len * sr));
  modal(sr, 0, [{f, a: 1, t60: len, beat: .3}, {f: f * 2.003, a: .12, t60: len * .4}, {f: f * 3.01, a: .04, t60: len * .25}], out);
  burstInto(out, sr, {len: .01, amp: .15, t60: .004, seed, bp: f * 2, q: 2});
  return normalize(edges(out, sr, .003), .85);
}

/* ---------- breath: 埙 and the horn ---------- */
/** A 埙 note: the vessel flute is almost a pure tone, a breath of noise around it, a small scoop up into the pitch, and
    a slow vibrato that comes in late. `dur` the held length. */
export function xun(sr, f, dur, {seed = 23, breath = .22, vib = .18} = {}) {
  const n = Math.ceil((dur + .35) * sr), out = new Float32Array(n), r = rng(seed);
  const att = Math.min(.12, dur * .3), rel = .3;
  const noise = new Float32Array(n); for (let i = 0; i < n; i++) noise[i] = r();
  bandpass(noise, sr, f * 1.02, 6); const nz2 = Float32Array.from(noise); bandpass(nz2, sr, f * 2.5, 3);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = t < att ? Math.pow(t / att, 1.5) : t < dur ? 1 - .1 * (t - att) / Math.max(.01, dur) : Math.max(0, (1 - .1) * (1 - (t - dur) / rel));
    const v = vib * Math.min(1, Math.max(0, (t - .35) / .5)), ff = f * Math.pow(2, (-.5 * Math.exp(-t / .05) + v * Math.sin(TAU * 4.6 * t) * .25) / 12);
    ph += TAU * ff / sr;
    out[i] = env * (Math.sin(ph) + .07 * Math.sin(2 * ph + .4) + .035 * Math.sin(3 * ph)) + env * breath * (noise[i] * 2.5 + nz2[i] * .6) * (1 + .5 * Math.exp(-t / .06));
  }
  return normalize(edges(out, sr, .002, .05), .85);
}
/** A horn (角): a lip-blown bore, rich in harmonics that open with the breath and close as it fails, a scoop into
    pitch, a ragged edge. Rendered additively with each harmonic's level riding the breath, which is how brass brightens. */
export function horn(sr, f, dur, {seed = 29, bright = 1, scoop = 1.5, rough = .3} = {}) {
  const n = Math.ceil((dur + .4) * sr), out = new Float32Array(n), r = rng(seed), H = Math.min(18, Math.floor(sr * .4 / f));
  const ph = new Float64Array(H + 1), jit = new Float32Array(n);
  { let j = 0; for (let i = 0; i < n; i++) { if (i % 64 === 0) j = r(); jit[i] = j; } onePole(jit, sr, 30); }
  const att = Math.min(.18, dur * .35), rel = .32;
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = t < att ? Math.sin(Math.PI / 2 * t / att) : t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel);
    const ff = f * Math.pow(2, (-scoop * Math.exp(-t / .07) + rough * jit[i] * .4) / 12), q = Math.pow(bright * env, .55), w = TAU * ff / sr;
    ph[1] += w;      // every harmonic's phase is h times the first's, so sin(h·θ) comes by the recurrence, one sine a sample
    const s1 = Math.sin(ph[1]), c2 = 2 * Math.cos(ph[1]);
    let s = 0, a = 1, sp = 0, sh = s1;
    for (let h = 1; h <= H; h++) { s += sh * a / h; a *= q; const sn = c2 * sh - sp; sp = sh; sh = sn; }
    out[i] = s * env;
  }
  burstInto(out, sr, {len: dur + .2, amp: .04, t60: dur + .2, seed, bp: f * 4, q: 1.5});
  return normalize(edges(out, sr, .003, .08), .85);
}

/* ---------- air: the noise voices ---------- */
/** Air moving: noise through a band that sweeps from f0 to f1 over `len`, rising and falling. Fire's roar, a flung
    blade, a dash. */
export function sweep(sr, len, f0, f1, {q = 1.2, seed = 31, shape = .35, crackle = 0} = {}) {
  const n = Math.ceil(len * sr), r = rng(seed), out = new Float32Array(n);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, fc = f0 * Math.pow(f1 / f0, t), w = TAU * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const v = r(), y = (al * v - al * x2 - (-2 * Math.cos(w)) * y1 - (1 - al) * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y;
    const env = t < shape ? Math.sin(Math.PI / 2 * t / shape) : Math.pow(1 - (t - shape) / (1 - shape), 1.6);
    out[i] = y * env;
  }
  if (crackle) for (let k = 0; k < crackle * len * 60; k++) {         // embers: tiny random clicks
    const at = Math.floor(Math.abs(r()) * (n - 400)), a = .3 + .5 * Math.abs(r()), m = 40 + Math.floor(Math.abs(r()) * 120);
    for (let i = 0; i < m; i++) out[at + i] += r() * a * Math.exp(-i / (m * .25));
  }
  return normalize(edges(out, sr), .85);
}
/** A drop into water: a sine that leaps up in pitch as the bubble closes, with a little splash. */
export function drop(sr, f, {len = .18, seed = 37} = {}) {
  const n = Math.ceil(len * sr), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, ff = f * (1 + 1.6 * Math.min(1, t / (len * .5)) ** 1.5); ph += TAU * ff / sr; out[i] = Math.sin(ph) * Math.exp(-t / (len * .3)) * Math.min(1, t / .002); }
  burstInto(out, sr, {len: .05, amp: .25, t60: .03, seed, hp: 3000});
  return normalize(edges(out, sr, .0005), .85);
}
/** A low rumble of the ground: filtered noise with a slow swell, under a thud. */
export function rumble(sr, len, {f = 60, seed = 41} = {}) {
  const n = Math.ceil(len * sr), r = rng(seed), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r();
  onePole(out, sr, f * 2); onePole(out, sr, f * 2);
  for (let i = 0; i < n; i++) { const t = i / n; out[i] *= Math.sin(Math.PI * Math.min(1, t * 4)) * (1 - t); }
  return normalize(edges(out, sr), .85);
}

/** A long room, built as an impulse response: early reflections off near walls, then a diffuse tail that darkens as
    it dies (air and wood soak up the highs first). For the ConvolverNode. Stereo: two decorrelated tails. */
export function room(sr, {len = 2.4, predelay = .018, dark = 1, seed = 43} = {}) {
  const n = Math.ceil(len * sr), L = new Float32Array(n), R = new Float32Array(n);
  for (const [ch, sd] of [[L, seed], [R, seed + 101]]) {
    const r = rng(sd), k = t60k(sr, len * .85);
    let g = 1, lp = 0;
    for (let i = Math.ceil(predelay * sr); i < n; i++) {
      const t = i / sr, a = Math.exp(-TAU * Math.max(800, 9000 * Math.exp(-t * 2.2 * dark)) / sr);     // the tail's lowpass closes with time
      lp = (1 - a) * r() + a * lp; ch[i] = lp * g * Math.min(1, (t - predelay) / .012); g *= k;
    }
    for (let e = 0; e < 7; e++) { const at = Math.ceil((predelay + .004 + Math.abs(r()) * .05) * sr); ch[at] += r() * .5; }
  }
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); m = m || 1;
  for (let i = 0; i < n; i++) { L[i] /= m * 6; R[i] /= m * 6; }
  return [L, R];
}
