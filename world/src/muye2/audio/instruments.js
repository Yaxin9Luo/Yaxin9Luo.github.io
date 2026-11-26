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
  clash,
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
};
export const NAMES = new Set([...Object.keys(INST), ...Object.keys(VAR)]);

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
export function render(name, arg, sr = RATE) { const f = INST[name] || VAR[name]; if (!f) throw new Error('no instrument ' + name); return trim(f(sr, arg), sr); }
/** The hall: a stereo impulse response, short and dark (a long wooden room, never a cathedral). */
export function hall(sr = RATE) { return S.room(sr, {len: 2.6}); }
