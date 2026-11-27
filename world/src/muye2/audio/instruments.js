// Every sound the game plays is one of these, rendered once into a mono Float32Array and played as a buffer source.
// Pure functions of (name, arg, sample rate): no Web Audio here, so the same code renders in a worker (the game), on
// the main thread (the listening page, an offline render), or in Node (the checks).
import * as S from './synth.js';

/** The rate everything is rendered and mixed at. The game asks for an AudioContext at this rate too, so no buffer is resampled. */
export const RATE = 48000;

const clash = (sr, f) => { const x = S.modal(sr, .35, [1, 1.73, 2.41, 3.11, 4.2, 5.4].map((k, i) => ({f: f * k, a: 1 / (1 + i * .5), t60: .3 / (1 + i * .3), beat: 7}))); S.normalize(x, .9); return x; };
/** Many feet on packed earth, a rank: a short burst of low knocks, spread. */
const tramp = sr => { const out = new Float32Array(Math.ceil(.32 * sr)), r = S.rng(53); for (let k = 0; k < 7; k++) { const x = S.drum(sr, 120 + r() * 30, {len: .07, hit: .5, stick: .45, bend: .1, seed: 54 + k}), at = Math.floor((.02 + (k / 7) * .22 + r() * .02) * sr); for (let i = 0; i < x.length && at + i < out.length; i++) out[at + i] += x[i] * (.6 + .4 * Math.abs(r())); } return S.normalize(out, .9); };
/** A great wooden gate on its posts: a long groan, low. */
const groan = sr => { const a = S.sweep(sr, 1.6, 90, 160, {q: 4, shape: .5, seed: 55, crackle: 1.5}), b = S.rumble(sr, 1.6, {f: 45, seed: 56}); for (let i = 0; i < a.length && i < b.length; i++) a[i] = a[i] * .6 + b[i] * .5; return S.normalize(a, .9); };

/** A section of horns: three players a few cents and a few milliseconds apart, so one note is a body of brass. */
const hornSec = (sr, [f, d]) => { const parts = [[-7, 0, 29, 1.5], [0, .012, 61, 1.2], [6, .025, 73, 1.8]].map(([c, at, seed, scoop]) => [S.horn(sr, f * Math.pow(2, c / 1200), d, {seed, scoop, bright: .9}), Math.round(at * sr)]); const out = new Float32Array(Math.max(...parts.map(([x, o]) => x.length + o))); for (const [x, o] of parts) for (let i = 0; i < x.length; i++) out[o + i] += x[i]; return S.normalize(out, .85); };
/** 鼓阵, massed drums: five great drums, pitched and timed a little apart, struck as one. */
const drumMass = (sr, f) => { const parts = [[1, 0, 1], [.93, .009, .8], [1.07, .017, .8], [.97, .026, .7], [1.04, .035, .7]].map(([k, at, g], i) => [S.drum(sr, f * k, {len: 1.3, bend: .25, seed: 81 + i}), Math.round(at * sr), g]); const out = new Float32Array(Math.max(...parts.map(([x, o]) => x.length + o))); for (const [x, o, g] of parts) for (let i = 0; i < x.length; i++) out[o + i] += x[i] * g; return S.normalize(out, .9); };
/** 铙, the great bronze of Shang and Zhou, struck mouth up: a low inharmonic bell with a splash of metal over it. */
const nao = (sr, f) => { const b = S.bell(sr, f, {bright: .85, second: .6, seed: 77, len: 5.5}), z = S.sweep(sr, .9, 3200, 700, {q: .7, shape: .15, seed: 78, crackle: .5}), d = S.drum(sr, f * .8, {len: 1, bend: .2, seed: 79}); for (let i = 0; i < z.length; i++) b[i] += z[i] * .25; for (let i = 0; i < d.length; i++) b[i] += d[i] * .35; return S.normalize(b, .9); };

/* ---------- 闻仲's attacks, voiced on their landing ---------- */
/** A thunder clap: a split-second crack, then the roll, low and uneven, dying over a second and a half. */
const clap = sr => {
  const n = Math.ceil(1.7 * sr), out = new Float32Array(n), r = S.rng(101);
  const crack = new Float32Array(Math.ceil(.06 * sr)); for (let i = 0; i < crack.length; i++) crack[i] = r() * Math.exp(-i / (.008 * sr));
  S.onePole(crack, sr, 1200, true); for (let i = 0; i < crack.length; i++) out[i] += crack[i] * 1.2;
  let lp = 0, lp2 = 0, am = 0, amT = 0; const a = Math.exp(-2 * Math.PI * 140 / sr);
  for (let i = 0; i < n; i++) { const t = i / sr; if (t >= amT) { am = .4 + Math.abs(r()) * .9; amT = t + .05 + Math.abs(r()) * .12; } lp = (1 - a) * r() + a * lp; lp2 = (1 - a) * lp + a * lp2; out[i] += lp2 * 9 * am * Math.min(1, t / .03) * Math.exp(-t / .55); }
  return S.normalize(out, .9);
};
/** The 墨麒麟's charge: a gallop that quickens down the lane, hooves on hard ground over a dark rush of air. */
const gallop = sr => {
  const out = S.sweep(sr, 1.2, 250, 1100, {q: .7, shape: .5, seed: 102}); for (let i = 0; i < out.length; i++) out[i] *= .35;
  let t = 0, gap = .2; const r = S.rng(103);
  while (t < 1.05) { for (const [k, d] of [[0, 0], [1, .06], [2, .11]]) { const x = S.drum(sr, 130 + r() * 25, {len: .08, hit: .7, stick: .6, bend: .1, seed: 104 + k}), at = Math.floor((t + d) * sr); for (let i = 0; i < x.length && at + i < out.length; i++) out[at + i] += x[i] * (.7 + .3 * k / 2); } t += gap; gap = Math.max(.13, gap * .93); }
  const thud = S.drum(sr, 55, {len: .5, bend: .3, seed: 108}); for (let i = 0; i < thud.length; i++) out[i] += thud[i] * .4;
  return S.normalize(out, .9);
};
/** A golden whip falls: the crack of its tip, a short gold ring, the blow on the ground. */
const whip = sr => {
  const n = Math.ceil(.7 * sr), out = new Float32Array(n), r = S.rng(111);
  for (let i = 0; i < .004 * sr; i++) out[i] += r() * (1 - i / (.004 * sr));
  const ring = S.modal(sr, .4, [{f: 2350, a: .35, t60: .25, beat: 5}, {f: 3710, a: .2, t60: .15}, {f: 1180, a: .25, t60: .3}]);
  const thud = S.drum(sr, 75, {len: .4, bend: .35, stick: .5, seed: 112});
  for (let i = 0; i < n; i++) out[i] += (ring[i] || 0) + (i >= .015 * sr ? (thud[i - Math.floor(.015 * sr)] || 0) * .8 : 0);
  return S.normalize(out, .9);
};
/** A column of fire rising (绝龙岭): a low whump, then the roar climbing, with crackle in it. */
const pillar = sr => { const out = S.sweep(sr, 1.3, 140, 1600, {q: .7, shape: .35, seed: 113, crackle: 3}), d = S.drum(sr, 45, {len: .9, bend: .2, seed: 114}); for (let i = 0; i < d.length; i++) out[i] += d[i] * .6; return S.normalize(out, .9); };
/** His soul goes up toward 封神台: a pure tone gliding up an octave and a fifth, a breath of air rising with it. */
const soul = sr => {
  const n = Math.ceil(2.4 * sr), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, f = 440 * Math.pow(3, Math.min(1, t / 2)) * (1 + .006 * Math.sin(2 * Math.PI * 5 * t)), e = Math.min(1, t / .4) * Math.max(0, 1 - Math.max(0, t - 1.6) / .8); ph += 2 * Math.PI * f / sr; out[i] = (Math.sin(ph) + .15 * Math.sin(2 * ph)) * e; }
  const air = S.sweep(sr, 2.4, 800, 4000, {q: 2, shape: .6, seed: 115}); for (let i = 0; i < n && i < air.length; i++) out[i] += air[i] * .2;
  return S.normalize(out, .8);
};

const INST = {
  bell: (sr, f) => S.bell(sr, f), bellDark: (sr, f) => S.bell(sr, f, {bright: .5, second: .25, seed: 4}),
  zheng: (sr, f) => S.zheng(sr, f), chime: (sr, f) => S.chime(sr, f),
  drum: (sr, f) => S.drum(sr, f, {len: f < 60 ? 1.4 : f < 100 ? .8 : .4, bend: f < 60 ? .25 : .35}),
  drumSoft: (sr, f) => S.drum(sr, f, {len: .5, hit: .5, stick: .1, seed: 12}),
  wood: (sr, f) => S.wood(sr, f),
  qin: (sr, f) => S.pluck(sr, f, {len: 3.2, pos: .2, damp: .5, body: .35}),
  qinSlideUp: (sr, f) => S.pluck(sr, f, {len: 3, pos: .2, damp: .5, glide: [[0, 0], [.35, 0], [.6, 2]], vib: .12, seed: 18}),
  qinSlideDown: (sr, f) => S.pluck(sr, f, {len: 3, pos: .2, damp: .5, glide: [[0, 2], [.3, 2], [.6, 0]], vib: .1, seed: 20}),
  se: (sr, f) => S.pluck(sr, f, {len: 1.6, pos: .1, damp: .25, body: .12, seed: 21}),
  harm: (sr, f) => S.harmonic(sr, f),
  hoof: (sr, f) => S.drum(sr, f, {len: .09, hit: .6, stick: .5, bend: .1, seed: 14}),
  clash, drumMass, nao,
  drop: (sr, f) => S.drop(sr, f),
};
const VAR = {     // voices with a length or a sweep, keyed by name (and for the breath instruments, a [frequency, length] pair)
  xun: (sr, [f, d]) => S.xun(sr, f, d), horn: (sr, [f, d, b]) => S.horn(sr, f, d, {bright: b ?? 1}),
  fire: sr => S.sweep(sr, .34, 500, 2600, {q: 1.1, crackle: 1.2}), fireBig: sr => S.sweep(sr, .7, 300, 3200, {q: .8, crackle: 2.5, seed: 32}),
  whoosh: sr => S.sweep(sr, .3, 400, 3000, {q: .9, shape: .6, seed: 33}), shing: sr => S.sweep(sr, .35, 3000, 7000, {q: 3, shape: .2, seed: 34}),
  paper: sr => S.sweep(sr, .12, 2500, 5000, {q: .7, shape: .3, seed: 35}), wind: sr => S.sweep(sr, 1.2, 250, 900, {q: .6, shape: .5, seed: 36}),
  tear: sr => S.sweep(sr, .3, 2200, 500, {q: 2, shape: .1, seed: 38, crackle: 3}), rumble: sr => S.rumble(sr, 1.1),
  thup: sr => S.sweep(sr, .05, 900, 300, {q: .8, shape: .1, seed: 39}),
  tramp, groan,
  clap, gallop, whip, pillar, soul,
  hornSec, choir: (sr, [f, d]) => S.choir(sr, f, d), choirO: (sr, [f, d]) => S.choir(sr, f, d, {vowel: 'o', seed: 63}), yu: (sr, [f, d]) => S.yu(sr, f, d),
};
export const NAMES = new Set([...Object.keys(INST), ...Object.keys(VAR)]);

/** The duel's voices carry nothing worth keeping above 11 kHz, so they are rendered at half the rate (half the memory);
    the browser resamples them on playback. The court ensemble stays at RATE. */
const HALF = new Set(['hornSec', 'choir', 'choirO', 'yu', 'drumMass', 'gallop', 'pillar', 'soul']);
/** The sounds only a duel uses: rendered when its stretch begins, freed after his fall (bank.free). */
export const DUEL_ONLY = new Set(['hornSec', 'choir', 'choirO', 'yu', 'drumMass', 'nao', 'clap', 'gallop', 'whip', 'pillar', 'soul']);
export const rateOf = name => HALF.has(name) ? RATE / 2 : RATE;
/** The instruments whose argument is [frequency, held seconds]: rendered at one of the HELD lengths and cut. */
export const BREATH = new Set(['horn', 'xun', 'hornSec', 'choir', 'choirO', 'yu']);

/** The bank's key for a sound: its name and its argument rounded, so the same note asked twice is one buffer. */
export function keyOf(name, arg) { return name + ':' + (Array.isArray(arg) ? arg.map(v => +(+v).toFixed(2)).join(',') : arg === undefined ? '' : (+arg).toFixed(2)); }
/** The held lengths a horn or a 埙 is rendered at; a note of another length plays the next longer one, cut and faded. */
export const HELD = [1.6, 4];
/** Cuts a sound where it has fallen 48 dB below its peak for good, with a 10 ms fade: the tail under that is never heard
    over the game, and it is most of a bell's memory. */
function trim(x, sr) {
  let p = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; }
  const floor = p * .004; let end = x.length; while (end > 0 && Math.abs(x[end - 1]) < floor) end--;
  const n = Math.min(x.length, end + Math.round(.01 * sr)), f = Math.round(.01 * sr);
  const y = n < x.length ? x.slice(0, n) : x; for (let i = 0; i < f && i < n; i++) y[n - 1 - i] *= i / f;
  return y;
}
/** Renders one sound. */
export function render(name, arg, sr = rateOf(name)) { const f = INST[name] || VAR[name]; if (!f) throw new Error('no instrument ' + name); return trim(f(sr, arg), sr); }
/** The hall: a stereo impulse response, short and dark (a long wooden room, never a cathedral). */
export function hall(sr = RATE) { return S.room(sr, {len: 2.6}); }
/** The duel's hall: larger and longer, for the boss themes only. */
export function hallBig(sr = RATE) { return S.room(sr, {len: 4.8, predelay: .035, dark: .75, seed: 91}); }
