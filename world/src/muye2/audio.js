// Sound for Muye as a survivors-like: everything is synthesized with Web Audio (no files), started on the first gesture.
// The build fires by itself, many times a second, so the treasures' voices go through a mix budget:
//   - each treasure has a short voice in its element's character, at a pitch of its own;
//   - the same treasure is not voiced again within 90 ms, and comes back at full strength only after 450 ms;
//   - at most CAST_VOICES treasure voices sound at once; a new one that finds no room is dropped, not queued;
//   - the more casts there have been in the last second, the quieter each is, so six treasures make a texture.
// Everything else (pickups, level, evolution, warnings, hurts) is outside that budget and stays readable over it.
const CAST_VOICES = 6, VOICES = 22;
export function createAudio() {
  let ctx = null, master = null, castBus = null, noise = null, on = true, volume = .8;
  let voices = 0, castVoices = 0, density = 0, densityAt = 0;
  const lastCast = new Map();
  const level = () => on ? .625 * volume : 0;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = level();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ctx.destination);
    castBus = ctx.createGain(); castBus.gain.value = .8; castBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  function start(src, g, t, len, bus, cast) {
    g.connect(bus || master);
    voices++; if (cast) castVoices++;
    src.onended = () => { voices--; if (cast) castVoices--; };
    src.start(t, src.buffer ? Math.random() * .5 : 0); src.stop(t + len + .02);
  }
  function burst({f0 = 1200, f1 = 300, q = 1.2, a = .005, d = .12, peak = .5, type = 'bandpass', at = 0, bus, cast}) {
    if (!ctx || voices >= VOICES) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true;
    flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + a + d);
    env(g, t, a, d, peak); src.connect(flt); flt.connect(g);
    start(src, g, t, a + d, bus, cast);
  }
  function tone({f0 = 220, f1 = f0, a = .004, d = .15, peak = .4, type = 'sine', at = 0, bus, cast}) {
    if (!ctx || voices >= VOICES) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    env(g, t, a, d, peak); o.connect(g);
    start(o, g, t, a + d, bus, cast);
  }
  const vary = (v, by = .08) => v * (1 + (Math.random() - .5) * 2 * by);
  // a pitch of its own for every treasure: its id picks a degree of a pentatonic scale
  const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
  const degree = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return SCALE[Math.abs(h) % SCALE.length]; };
  /** One voice per element, played on the cast bus under the budget. `k` is its strength after ducking, `p` its pitch. */
  const VOICE = {
    fire(k, p, big) { burst({f0: 700 * p, f1: 2600 * p, q: 1.1, a: .03, d: .1, peak: .3 * k, bus: castBus, cast: true}); if (big) burst({f0: 3000, f1: 900, q: 2.5, a: .002, d: .16, peak: .16 * k, at: .05, bus: castBus, cast: true}); },
    water(k, p, big) { tone({f0: 520 * p, f1: 260 * p, a: .01, d: .2, peak: .26 * k, bus: castBus, cast: true}); if (big) burst({f0: 1400, f1: 300, q: .6, a: .05, d: .3, peak: .12 * k, type: 'lowpass', bus: castBus, cast: true}); },
    wood(k, p, big) { tone({f0: 300 * p, f1: 285 * p, a: .002, d: .06, peak: .34 * k, type: 'triangle', bus: castBus, cast: true}); if (big) tone({f0: 450 * p, f1: 430 * p, a: .002, d: .08, peak: .24 * k, type: 'triangle', at: .07, bus: castBus, cast: true}); },
    metal(k, p, big) { tone({f0: 1100 * p, f1: 1094 * p, a: .002, d: .22, peak: .16 * k, bus: castBus, cast: true}); tone({f0: 1650 * p, f1: 1640 * p, a: .002, d: .14, peak: .09 * k, bus: castBus, cast: true}); if (big) tone({f0: 2200 * p, f1: 2190 * p, a: .002, d: .3, peak: .08 * k, bus: castBus, cast: true}); },
    earth(k, p, big) { tone({f0: 95 * p, f1: 45, a: .003, d: big ? .3 : .16, peak: .46 * k, bus: castBus, cast: true}); burst({f0: 300, f1: 80, q: .6, a: .003, d: .1, peak: .16 * k, type: 'lowpass', bus: castBus, cast: true}); },
  };
  let streak = 0, streakAt = 0, pickAt = 0, killAt = 0, warnAt = 0, trampleAt = 0, blockAt = 0;
  return {
    ensure,
    get on() { return on; },
    get started() { return !!ctx; },
    /** For checks: what the budget is doing. */
    get mix() { return {voices, castVoices, density: +density.toFixed(2)}; },
    toggle() { on = !on; if (master) master.gain.value = level(); return on; },
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); if (master) master.gain.value = level(); },
    /** A treasure (or a soldier's attack) goes off. Returns whether it was voiced, for the budget's own check. */
    cast(id, element, evolved) {
      if (!ctx) return false;
      const now = ctx.currentTime, since = now - (lastCast.get(id) ?? -9);
      density *= Math.exp(-(now - densityAt) * 1.2); densityAt = now; density += 1;      // about the casts of the last second
      if (since < .09 || castVoices >= CAST_VOICES) return false;
      lastCast.set(id, now);
      const duck = Math.min(1, .45 + since / .45 * .55), thin = 1 / (1 + Math.max(0, density - 3) / 5);
      (VOICE[element] || VOICE.earth)(duck * thin, degree(id) * (evolved ? .75 : 1), !!evolved);
      return true;
    },
    /** Battle spirit gathered: notes that climb while the streak lasts, and start again after a third of a second without one. */
    pickup(size = 0) {
      if (!ctx) return; const now = ctx.currentTime; if (now - pickAt < .04) return;
      streak = now - streakAt < .34 ? Math.min(streak + 1, 14) : 0; streakAt = pickAt = now;
      const f = 660 * SCALE[streak % 5] * (1 + Math.floor(streak / 5));
      tone({f0: f, f1: f * 1.01, a: .003, d: .07 + size * .03, peak: .1 + size * .04, type: 'triangle'});
    },
    peach() { tone({f0: 392, f1: 523, a: .01, d: .18, peak: .2, type: 'triangle'}); tone({f0: 523, f1: 784, a: .01, d: .24, peak: .16, type: 'triangle', at: .1}); },
    lodestone() { for (let i = 0; i < 6; i++) tone({f0: 440 * SCALE[i % 5] * (1 + (i > 4)), f1: 440 * SCALE[i % 5], a: .003, d: .08, peak: .12, type: 'triangle', at: i * .045}); },
    chest() { tone({f0: 196, f1: 196, a: .01, d: .3, peak: .22, type: 'sawtooth'}); for (const [f, at] of [[784, .08], [988, .16], [1175, .24]]) tone({f0: f, f1: f, a: .003, d: .3, peak: .12, at}); },
    /** A level: four rising notes; the offer opens on the last. */
    levelUp() { [392, 494, 587, 784].forEach((f, i) => tone({f0: f, f1: f * 1.004, a: .004, d: i === 3 ? .34 : .1, peak: .2, type: 'triangle', at: i * .07})); },
    /** The offer's own small sounds. */
    slip() { burst({f0: 1800, f1: 600, q: .8, a: .004, d: .05, peak: .1}); },
    take(element) { (VOICE[element] || VOICE.wood)(1.2, 1, true); tone({f0: 150, f1: 70, a: .002, d: .09, peak: .3}); },
    reroll() { for (let i = 0; i < 3; i++) burst({f0: 2200 - i * 300, f1: 700, q: 1, a: .003, d: .045, peak: .1, at: i * .05}); },
    banish() { tone({f0: 300, f1: 110, a: .004, d: .2, peak: .22, type: 'triangle'}); burst({f0: 900, f1: 200, q: .7, a: .004, d: .16, peak: .12, type: 'lowpass'}); },
    refuse() { tone({f0: 92, f1: 70, a: .003, d: .07, peak: .22, type: 'triangle'}); },
    /** An evolution: a held chord, a bell over it, a low ground under it. */
    evolve(element) { for (const [f, p] of [[196, .16], [294, .14], [392, .14], [587, .1]]) for (const det of [1, 1.006]) tone({f0: f * det, f1: f * det, a: .05, d: 1.1, peak: p, type: 'sawtooth'}); for (const [f, at] of [[1175, .1], [1568, .25], [2349, .4]]) tone({f0: f, f1: f * .997, a: .003, d: .9, peak: .12, at}); tone({f0: 65, f1: 40, a: .01, d: .9, peak: .5}); (VOICE[element] || VOICE.fire)(1.3, .5, true); },
    /** A squad's skill: a drum for the men, then the element's own voice, larger at higher rank. Under the same budget as the treasures, and no squad twice within a third of a second. */
    skill(id, element, rank = 2) {
      if (!ctx) return false;
      const now = ctx.currentTime, key = 'skill:' + id;
      if (now - (lastCast.get(key) ?? -9) < .33 || castVoices >= CAST_VOICES) return false;
      lastCast.set(key, now);
      const thin = 1 / (1 + Math.max(0, density - 3) / 5);
      for (const at of [0, .07]) tone({f0: 140, f1: 70, a: .003, d: .09, peak: .3 * thin, type: 'triangle', at, bus: castBus, cast: true});
      (VOICE[element] || VOICE.earth)(thin, .5 * degree(id), rank >= 4);
      if (rank >= 5) tone({f0: 1568, f1: 1560, a: .003, d: .5, peak: .08 * thin, at: .1, bus: castBus, cast: true});
      return true;
    },
    /** A general joins: a short call on two horns, a fifth apart, and his element's voice. He returns after withdrawing with the call alone, quieter. */
    general(element, back) { const k = back ? .5 : 1; for (const [f, at, d] of [[196, 0, .22], [294, .2, .5]]) for (const det of [1, 1.007]) tone({f0: f * det, f1: f * det, a: .03, d, peak: .13 * k, type: 'sawtooth', at}); if (!back) (VOICE[element] || VOICE.earth)(1, 1, true); },
    withdraw() { tone({f0: 294, f1: 196, a: .02, d: .4, peak: .1, type: 'sawtooth'}); },
    /** A true form: the ground first, then an open fifth stacked three octaves, then bells falling. Rarer and larger than an evolution. */
    trueForm(element) {
      tone({f0: 55, f1: 41, a: .02, d: 1.6, peak: .34});
      for (const [f, p] of [[98, .14], [147, .14], [196, .12], [294, .12], [392, .1], [588, .08]]) for (const det of [1, 1.005]) tone({f0: f * det, f1: f * det, a: .12, d: 1.5, peak: p, type: 'sawtooth', at: .08});
      for (const [f, at] of [[2349, .3], [1760, .45], [1568, .6], [1175, .75]]) tone({f0: f, f1: f * .997, a: .003, d: 1, peak: .1, at});
      (VOICE[element] || VOICE.earth)(1.2, .5, true);
    },
    /** A named foe arrives: three strokes of a great drum and a low horn that bends down. */
    named(last) { for (let i = 0; i < 3; i++) { tone({f0: 80, f1: 40, a: .004, d: .34, peak: .5, at: i * .3}); burst({f0: 240, f1: 70, q: .6, a: .004, d: .12, peak: .2, type: 'lowpass', at: i * .3}); } for (const det of [1, 1.01, .5]) tone({f0: (last ? 98 : 110) * det, f1: (last ? 69 : 82) * det, a: .15, d: 1.4, peak: .13, type: 'sawtooth', at: .9}); },
    resonance() { for (const [f, at] of [[523, 0], [784, .12]]) tone({f0: f, f1: f, a: .01, d: .5, peak: .12, at}); },
    /** An elite comes: one low horn. The captain and the leader: two, a tritone apart. */
    elite() { for (const det of [1, 1.01]) tone({f0: 110 * det, f1: 108 * det, a: .08, d: .7, peak: .16, type: 'sawtooth'}); },
    boss() { for (const [f, at, d] of [[82, 0, .9], [116, .55, 1.3]]) for (const det of [1, 1.012, .5]) tone({f0: f * det, f1: f * det * .98, a: .1, d, peak: .14, type: 'sawtooth', at}); },
    encircle() { for (let i = 0; i < 3; i++) tone({f0: 147, f1: 147, a: .02, d: .22, peak: .16, type: 'sawtooth', at: i * .26}); },
    /** A telegraph on the ground: two dry pips, never more than three a second. */
    warn() { if (!ctx || ctx.currentTime - warnAt < .33) return; warnAt = ctx.currentTime; for (const at of [0, .11]) tone({f0: 880, f1: 870, a: .002, d: .06, peak: .2, type: 'square', at}); },
    hurt() { tone({f0: 240, f1: 90, a: .003, d: .22, peak: .5, type: 'triangle'}); burst({f0: 400, f1: 150, q: .6, d: .16, peak: .4, type: 'lowpass'}); },
    block() { if (!ctx || ctx.currentTime - blockAt < .12) return; blockAt = ctx.currentTime; tone({f0: vary(210), f1: 150, a: .002, d: .07, peak: .24, type: 'square'}); },
    dash() { burst({f0: 300, f1: 2400, q: .7, a: .08, d: .16, peak: .26}); tone({f0: 130, f1: 300, a: .03, d: .2, peak: .14, type: 'sawtooth'}); },
    cry(on) { if (on) { tone({f0: 262, f1: 262, a: .01, d: .09, peak: .12, type: 'triangle'}); tone({f0: 392, f1: 392, a: .01, d: .14, peak: .12, type: 'triangle', at: .08}); } else tone({f0: 330, f1: 196, a: .01, d: .18, peak: .08, type: 'triangle'}); },
    trample() { if (!ctx || ctx.currentTime - trampleAt < .07) return; trampleAt = ctx.currentTime; tone({f0: vary(95), f1: 45, a: .003, d: .12, peak: .36}); },
    /** A foe falls: a tick, at most twelve a second, and fainter when many treasures are sounding. */
    kill(elite) { if (!ctx) return; if (elite) { tone({f0: 120, f1: 38, a: .004, d: .3, peak: .6}); return; } if (ctx.currentTime - killAt < .085) return; killAt = ctx.currentTime; burst({f0: vary(1500, .2), f1: 500, q: 1.2, a: .002, d: .035, peak: .07 / (1 + density / 6)}); },
    fall() { tone({f0: 110, f1: 36, a: .02, d: .9, peak: .5}); tone({f0: 73, f1: 49, a: .05, d: 1.3, peak: .22, type: 'triangle'}); burst({f0: 260, f1: 60, q: .6, a: .004, d: .3, peak: .45, type: 'lowpass', at: .55}); },
    won() { [392, 523, 659, 784, 1047].forEach((f, i) => { for (const det of [1, 1.005]) tone({f0: f * det, f1: f * det, a: .03, d: i === 4 ? 1.2 : .3, peak: .12, type: 'sawtooth', at: i * .16}); }); },
    lost() { for (const [f, at] of [[131, 0], [98, .4]]) for (const det of [1, 1.006]) tone({f0: f * det, f1: f * det, a: .08, d: .9, peak: .12, type: 'sawtooth', at}); },
    /** Hoofbeats that follow the horse: `speed` in px/s against `top`. */
    hooves(speed, top, dt) {
      if (!ctx || speed < 30) return;
      const frac = Math.min(1, speed / top), before = this._stride || 0, after = before + speed * dt / (110 + 120 * frac);
      this._stride = after;
      for (const b of frac < .5 ? [0, .5] : [0, .14, .28, .46]) if (Math.floor(before - b) !== Math.floor(after - b)) burst({f0: vary(170, .2), f1: 60, q: .8, a: .003, d: .04, peak: .05 + frac * .07, type: 'lowpass'});
    },
  };
}
