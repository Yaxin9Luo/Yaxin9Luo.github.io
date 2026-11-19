// Sound for the side-view prototype: everything is synthesized with Web Audio, so the page loads no audio files.
// Adapted from ../brushfield/audio.js. The context is created on the first key or click (browsers block sound before a gesture).
export function createAudio() {
  let ctx = null, master = null, noise = null, on = true, volume = .8;
  const level = () => on ? .625 * volume : 0;      // the default volume of 0.8 gives the gain of 0.5 the sounds were balanced at
  const voices = {n: 0};
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = level();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const env = (gain, t, a, d, peak) => { gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(peak, t + a); gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function burst({f0 = 1200, f1 = 300, q = 1.2, a = .005, d = .12, peak = .5, type = 'bandpass', at = 0}) {
    if (!ctx || voices.n > 16) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true;
    flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + a + d);
    env(g, t, a, d, peak);
    src.connect(flt); flt.connect(g); g.connect(master);
    voices.n++; src.onended = () => { voices.n--; };
    src.start(t, Math.random() * .5); src.stop(t + a + d + .02);
  }
  function tone({f0 = 220, f1 = 110, a = .004, d = .15, peak = .4, type = 'sine', at = 0}) {
    if (!ctx || voices.n > 16) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    env(g, t, a, d, peak);
    o.connect(g); g.connect(master);
    voices.n++; o.onended = () => { voices.n--; };
    o.start(t); o.stop(t + a + d + .02);
  }
  const vary = (v, by = .12) => v * (1 + (Math.random() - .5) * 2 * by);
  const hoof = (frac, at = 0) => burst({f0: vary(170, .2), f1: 60, q: .8, a: .003, d: .045, peak: .08 + frac * .14, type: 'lowpass', at});
  let stride = 0, clashAt = 0;
  return {
    ensure,
    get on() { return on; },
    get started() { return !!ctx; },
    toggle() { on = !on; if (master) master.gain.value = level(); return on; },
    /** Volume from the settings, 0..1. */
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); if (master) master.gain.value = level(); },
    /** The game said no (a leap too slow, a strike too soon): small and dull, nothing like a hit. */
    refuse() { tone({f0: 92, f1: 70, a: .003, d: .07, peak: .22, type: 'triangle'}); burst({f0: 240, f1: 120, q: .7, a: .002, d: .04, peak: .1, type: 'lowpass'}); },
    swing() { burst({f0: vary(500), f1: vary(2600), q: .9, a: .05, d: .12, peak: .22}); },
    /** A blow of the hero's blade. `mult` is the speed multiplier: a faster charge sounds lower, longer and louder. */
    hit(mult = 1) { const k = Math.min(1, (mult - 1) / 2); burst({f0: vary(1900), f1: 380, q: .7, d: .08 + k * .08, peak: .35 + k * .4}); tone({f0: vary(180 - k * 70), f1: 55, d: .1 + k * .14, peak: .3 + k * .45}); if (k > .4) tone({f0: 62, f1: 34, d: .25, peak: k * .5}); },
    kill() { tone({f0: vary(120), f1: 38, d: .26, peak: .7}); burst({f0: 700, f1: 120, q: .5, d: .2, peak: .4, type: 'lowpass'}); },
    /** Warband and foes trading blows: thin, and no more than about eight a second. */
    clash() { if (!ctx || ctx.currentTime < clashAt) return; clashAt = ctx.currentTime + .12; burst({f0: vary(2600, .25), f1: 1400, q: 5, d: .05, peak: .1}); },
    hurt() { tone({f0: 240, f1: 90, d: .22, peak: .5, type: 'triangle'}); burst({f0: 400, f1: 150, q: .6, d: .16, peak: .4, type: 'lowpass'}); },
    loose() { burst({f0: 3000, f1: 900, q: 2, a: .01, d: .1, peak: .12}); tone({f0: 330, f1: 220, d: .06, peak: .08, type: 'triangle'}); },
    arrowHit() { burst({f0: 900, f1: 300, q: 1.5, a: .002, d: .04, peak: .12}); },
    trample() { tone({f0: vary(95), f1: 45, d: .16, peak: .55}); burst({f0: 300, f1: 90, q: .6, d: .12, peak: .3, type: 'lowpass'}); },
    /** The braced spear: a clang of bronze (partials that are not harmonics) over the thud of the horse stopping. */
    braced() { for (const [f, p, d] of [[820, .22, .5], [1317, .16, .38], [2143, .1, .26], [3390, .05, .16]]) tone({f0: f, f1: f * .985, a: .002, d, peak: p, type: 'triangle'}); burst({f0: 4200, f1: 1800, q: 4, d: .09, peak: .3}); tone({f0: 150, f1: 48, d: .24, peak: .6}); },
    /* ----- the verbs and events of SPEC-V2: each its own shape, so none is taken for another ----- */
    /** The sweep: a long drag of air, wider and lower than the strike's; a full one ends on a low thump. */
    sweep(full) { burst({f0: 320, f1: 1900, q: .7, a: .12, d: .2, peak: .3}); burst({f0: 2400, f1: 500, q: 1.2, a: .01, d: .22, peak: .16, at: .1}); if (full) tone({f0: 98, f1: 44, d: .3, peak: .5, at: .1}); },
    /** The blow on landing: the ground itself, a drum and a spread of grit. `power` 0..2. */
    shock(power = 1) { tone({f0: 70, f1: 30, a: .004, d: .45, peak: .5 + power * .2}); tone({f0: 140, f1: 52, d: .2, peak: .3}); burst({f0: 900, f1: 90, q: .5, a: .004, d: .4 + power * .1, peak: .3 + power * .1, type: 'lowpass'}); },
    /** Full cry on: two quick rising notes over a gust; off: one falling. */
    fullCry(on) { if (on) { burst({f0: 400, f1: 1600, q: .8, a: .15, d: .2, peak: .12}); tone({f0: 262, f1: 262, a: .01, d: .1, peak: .14, type: 'triangle'}); tone({f0: 392, f1: 392, a: .01, d: .16, peak: .14, type: 'triangle', at: .09}); } else tone({f0: 330, f1: 196, a: .01, d: .2, peak: .1, type: 'triangle'}); },
    /** The flame gallop: a rush that climbs, with the first lick of fire in it. */
    dash() { burst({f0: 200, f1: 2600, q: .6, a: .2, d: .3, peak: .34}); tone({f0: 110, f1: 330, a: .05, d: .4, peak: .2, type: 'sawtooth'}); for (let i = 0; i < 4; i++) burst({f0: vary(3200, .3), f1: 1200, q: 3, a: .002, d: .03, peak: .12, at: .08 + i * .07}); },
    /** The burning trail: a second of crackle dying down. */
    trail() { for (let i = 0; i < 14; i++) burst({f0: vary(2600, .5), f1: 800, q: 2.5, a: .002, d: .025 + Math.random() * .03, peak: .1 * (1 - i / 16), at: i * .07 + Math.random() * .04}); burst({f0: 500, f1: 200, q: .5, a: .05, d: 1, peak: .08, type: 'lowpass'}); },
    /** The ember blade's stroke: three small sparks, far quieter than the gallop's trail (it comes with every strike). */
    ember() { for (let i = 0; i < 3; i++) burst({f0: vary(3000, .4), f1: 1000, q: 3, a: .002, d: .03, peak: .07, at: .05 + i * .06}); },
    /** The rally: the standard's call, three notes up a major chord, held. */
    rally() { [196, 247, 294].forEach((f, i) => { for (const det of [1, 1.005]) tone({f0: f * det, f1: f * det, a: .03, d: i === 2 ? .7 : .22, peak: .12, type: 'sawtooth', at: i * .16}); }); },
    /** A volley: many strings at once, then the air. */
    volley() { for (let i = 0; i < 5; i++) { burst({f0: vary(3000, .2), f1: 900, q: 2, a: .008, d: .09, peak: .08, at: i * .025}); tone({f0: vary(340, .1), f1: 220, d: .05, peak: .05, type: 'triangle', at: i * .025}); } burst({f0: 1200, f1: 2400, q: 1, a: .2, d: .3, peak: .06, at: .1}); },
    /** A shield stops it: wood and hide, a flat knock with no ring. */
    block() { tone({f0: vary(210, .1), f1: 150, a: .002, d: .07, peak: .3, type: 'square'}); burst({f0: 700, f1: 300, q: 1.2, a: .002, d: .06, peak: .22, type: 'lowpass'}); },
    /** The gold blow: one bright bell stroke above the hit. */
    crit() { for (const [f, p, d] of [[1568, .16, .5], [2349, .1, .34], [3136, .06, .22]]) tone({f0: f, f1: f * .995, a: .002, d, peak: p, type: 'sine'}); },
    /** The captain's horn: lower and rougher than the wave horn, two long notes a tritone apart. */
    captainHorn(at = 0) { for (const [f, t, d] of [[82, 0, .8], [116, .5, 1.1]]) for (const det of [1, 1.012, .5]) tone({f0: f * det, f1: f * det * .98, a: .1, d, peak: .12, type: 'sawtooth', at: at + t}); burst({f0: 300, f1: 200, q: .6, a: .15, d: 1.4, peak: .05, type: 'lowpass', at}); },
    /** The rout: their horn falling away, and feet. */
    rout() { tone({f0: 220, f1: 98, a: .05, d: .9, peak: .16, type: 'sawtooth'}); tone({f0: 165, f1: 73, a: .05, d: 1.1, peak: .12, type: 'sawtooth', at: .15}); for (let i = 0; i < 8; i++) hoof(.3, .2 + i * .09); },
    /** The stamp on the picked slip. */
    stamp() { tone({f0: 150, f1: 70, a: .002, d: .09, peak: .4}); burst({f0: 900, f1: 300, q: .8, a: .002, d: .05, peak: .2, type: 'lowpass'}); },
    /** One short sound for each element, played when its boon is taken. */
    boon(element) {
      if (element === 'fire') { burst({f0: 300, f1: 3200, q: .8, a: .25, d: .25, peak: .22}); for (let i = 0; i < 7; i++) burst({f0: vary(3400, .3), f1: 1400, q: 3, a: .002, d: .03, peak: .14, at: .1 + i * .06}); tone({f0: 220, f1: 660, a: .2, d: .3, peak: .12, type: 'sawtooth'}); }
      else if (element === 'water') { tone({f0: 880, f1: 294, a: .01, d: .6, peak: .2}); tone({f0: 1320, f1: 440, a: .01, d: .5, peak: .1, at: .12}); burst({f0: 1800, f1: 300, q: .5, a: .08, d: .7, peak: .12, type: 'lowpass'}); }
      else if (element === 'wood') { [392, 494, 587, 784].forEach((f, i) => tone({f0: f, f1: f * .97, a: .002, d: .09, peak: .26, type: 'triangle', at: i * .085})); burst({f0: 1200, f1: 700, q: 4, a: .002, d: .03, peak: .12}); }
      else if (element === 'metal') { for (const [f, p, d] of [[1047, .2, .9], [1571, .13, .7], [2217, .09, .5], [3140, .05, .3]]) tone({f0: f, f1: f * .997, a: .002, d, peak: p}); burst({f0: 5000, f1: 3000, q: 5, a: .002, d: .05, peak: .14}); }
      else { tone({f0: 62, f1: 31, a: .005, d: .8, peak: .7}); tone({f0: 93, f1: 46, a: .005, d: .5, peak: .3, type: 'triangle'}); burst({f0: 220, f1: 50, q: .5, a: .01, d: .7, peak: .3, type: 'lowpass'}); }
    },
    /** The rider falls: a low drop, the body on the ground a little later, and no brightness in it. */
    fall() { tone({f0: 110, f1: 36, a: .02, d: .9, peak: .5}); tone({f0: 73, f1: 49, a: .05, d: 1.3, peak: .22, type: 'triangle'}); burst({f0: 260, f1: 60, q: .6, a: .004, d: .3, peak: .45, type: 'lowpass', at: .55}); },
    leap() { burst({f0: 300, f1: 1500, q: .8, a: .09, d: .16, peak: .14}); },
    /** Landing: `frac` is the horse's speed as a 0..1 fraction of its top speed. */
    land(frac = .5) { tone({f0: vary(105), f1: 40, d: .18, peak: .4 + frac * .3}); burst({f0: 420, f1: 80, q: .6, d: .16, peak: .3 + frac * .2, type: 'lowpass'}); hoof(frac, .07); },
    /** Order calls, one shape each so they can be told apart with eyes on the fight. */
    order(which) {
      if (which === 'charge') [392, 494, 587].forEach((f, i) => tone({f0: f, f1: f * 1.02, a: .01, d: .09, peak: .16, type: 'sawtooth', at: i * .07}));
      else if (which === 'hold') tone({f0: 294, f1: 220, a: .02, d: .32, peak: .2, type: 'sawtooth'});
      else { tone({f0: 392, f1: 392, a: .01, d: .12, peak: .15, type: 'triangle'}); tone({f0: 523, f1: 523, a: .01, d: .16, peak: .15, type: 'triangle', at: .11}); }
    },
    pick() { tone({f0: 440, f1: 660, d: .1, peak: .2, type: 'triangle'}); tone({f0: 660, f1: 990, d: .14, peak: .16, type: 'triangle', at: .08}); },
    /** A horn: two notes a fifth apart, each a pair of detuned saws. `low` for a field cleared or lost. */
    horn(low) { const f = low ? 131 : 174; for (const [m, at, d] of [[1, 0, .55], [1.5, .34, .9]]) for (const det of [1, 1.006]) tone({f0: f * m * det, f1: f * m * det, a: .08, d, peak: .11, type: 'sawtooth', at}); burst({f0: 500, f1: 700, q: .7, a: .1, d: 1, peak: .03, type: 'lowpass'}); },
    /**
     * Hoofbeats that follow the horse. Called every frame with the speed (px/s), the top speed, whether the horse is on the
     * ground, and the frame time. The stride gets longer with speed, so the beat quickens less than the speed does;
     * below 40% of top speed it is an even two-beat, above it the gallop's three quick beats and a gap.
     */
    hooves(speed, top, grounded, dt) {
      if (!ctx || !grounded || speed < 30) return;
      const frac = Math.min(1, speed / top), before = stride;
      stride += speed * dt / (130 + 170 * frac);
      const beats = frac < .4 ? [0, .5] : [0, .14, .28, .46];
      for (const b of beats) if (Math.floor(before - b) !== Math.floor(stride - b)) hoof(frac);
    },
  };
}
