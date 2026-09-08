/** Original, lightweight synthesized sound. No recordings or remote audio assets. */
export class WorldAudio {
  constructor(enabled = false) {
    this.enabled = Boolean(enabled);
    this.context = null;
    this.master = null;
    this.windGain = null;
    this.voices = new Set();
    this.ambient = [];
    this.unlocked = false;
    this.suspended = false;
    this.disposed = false;
    this.lastChime = 0;
    this.chimeIndex = 0;
  }

  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (!this.enabled) return;
    if (!this.context) this._create();
    if (this.context?.state === 'suspended' && !this.suspended) this.context.resume().catch(() => {});
  }

  _create() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext || this.disposed) return;
    try {
      this.context = new AudioContext();
      const context = this.context;
      this.master = context.createGain();
      this.master.gain.value = this.enabled ? .18 : 0;
      this.master.connect(context.destination);

      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * .015) / 1.015;
        samples[i] = previous * 4;
      }
      const wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      this.windGain = context.createGain();
      this.windGain.gain.value = .2;
      wind.connect(filter).connect(this.windGain).connect(this.master);
      wind.start();
      this.ambient.push(wind, filter, this.windGain);

      for (const frequency of [82.407, 123.471]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.value = .023;
        oscillator.connect(gain).connect(this.master);
        oscillator.start();
        this.ambient.push(oscillator, gain);
      }
    } catch {
      this.context?.close().catch(() => {});
      this.context = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled && this.unlocked) this.unlock();
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? .18 : 0, this.context.currentTime, .12);
  }

  setSuspended(suspended) {
    this.suspended = Boolean(suspended);
    if (!this.context) return;
    if (suspended && this.context.state === 'running') this.context.suspend().catch(() => {});
    else if (!suspended && this.enabled && this.unlocked && this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  update(time, speed = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    this.windGain?.gain.setTargetAtTime(.18 + Math.min(speed / 130, .24), this.context.currentTime, .4);
    if (time - this.lastChime > 9) {
      this.lastChime = time;
      const notes = [329.628, 493.883, 587.33, 440, 659.255];
      this._tone(notes[this.chimeIndex++ % notes.length], 2.3, 'sine', .055);
    }
  }

  _tone(frequency, duration, wave = 'sine', volume = .3, endFrequency = frequency, delay = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.voices.size >= 24) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    oscillator.start(start);
    oscillator.stop(start + duration + .025);
  }

  play(effect) {
    if (this.disposed || !this.enabled) return;
    if (effect === 'lumos') this._tone(760, .22, 'sine', .26, 1450);
    else if (effect === 'incendio') { this._tone(130, .4, 'triangle', .3, 55); this._tone(450, .25, 'sawtooth', .035, 85); }
    else if (effect === 'avada') { this._tone(195, .48, 'triangle', .25, 65); this._tone(780, .32, 'sine', .12, 230); }
    else if (effect === 'hit') this._tone(280, .13, 'triangle', .13, 95);
    else if (effect === 'hurt') this._tone(105, .27, 'triangle', .2, 65);
    else if (effect === 'shield') { this._tone(220, .6, 'sine', .17, 440); this._tone(659.255, .8, 'sine', .12); }
    else if (effect === 'block') this._tone(1046.5, .3, 'sine', .2, 698.5);
    else if (effect === 'collect') { this._tone(659.255, .65, 'sine', .19); this._tone(987.767, .8, 'sine', .12, 987.767, .1); }
    else if (effect === 'ring') { this._tone(523.251, .4, 'sine', .19); this._tone(783.991, .6, 'sine', .14, 783.991, .07); }
    else if (effect === 'banish') { this._tone(196, .5, 'triangle', .12, 783.991); this._tone(1174.66, .55, 'sine', .13); }
    else if (effect === 'race') [523.251, 659.255, 783.991, 1046.502].forEach((f, i) => this._tone(f, 1.1, 'sine', .18, f, i * .12));
    else if (effect === 'travel') { this._tone(147, .7, 'sine', .18, 880); this._tone(587.33, 1.25, 'sine', .15, 1174.66, .12); }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
    for (const node of this.ambient) {
      if (typeof node.stop === 'function') { try { node.stop(); } catch { /* Already stopped. */ } }
      node.disconnect();
    }
    this.ambient.length = 0;
    this.master?.disconnect();
    this.context?.close().catch(() => {});
    this.context = null;
  }
}
