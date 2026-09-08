/** Local CC0 score, restrained environmental beds, and original action sounds. */
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
    this.musicVolume = .6;
    this.effectsVolume = .7;
    this.environment = { night: 1, reading: false, position: { x: 18, y: 18, z: 74 } };
    this.music = [
      { id: 'day', url: '/audio/academy/day-theme.mp3', buffer: null, nextStart: null },
      { id: 'night', url: '/audio/academy/night-theme.mp3', buffer: null, nextStart: null },
    ];
    this.musicSources = new Set();
    this.musicStatus = 'idle';
    this._musicPromise = null;
    this._fetchAbort = null;
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
      this.master.gain.value = this.enabled ? .75 : 0;
      this.effectsBus = context.createGain();
      this.effectsBus.gain.value = .22 * this.effectsVolume;
      this.effectsBus.connect(this.master);
      this.ambientBus = context.createGain();
      this.ambientBus.gain.value = .28 * this.effectsVolume;
      this.ambientBus.connect(this.master);
      this.musicBus = context.createGain();
      this.musicBus.gain.value = .4 * this.musicVolume;
      this.musicBus.connect(this.master);
      for (const track of this.music) { track.gain = context.createGain(); track.gain.gain.value = track.id === 'night' ? 1 : 0; track.gain.connect(this.musicBus); }
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
      wind.connect(filter).connect(this.windGain).connect(this.ambientBus);
      wind.start();
      this.ambient.push(wind, filter, this.windGain);

      const water = context.createBufferSource();
      water.buffer = buffer; water.loop = true; water.playbackRate.value = .64;
      const waterFilter = context.createBiquadFilter();
      waterFilter.type = 'lowpass'; waterFilter.frequency.value = 1250;
      this.waterGain = context.createGain(); this.waterGain.gain.value = 0;
      water.connect(waterFilter).connect(this.waterGain).connect(this.ambientBus);
      water.start(); this.ambient.push(water, waterFilter, this.waterGain);
      this._loadMusic();
    } catch {
      this.context?.close().catch(() => {});
      this.context = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled && this.unlocked) this.unlock();
    if (this.enabled && this.musicStatus === 'unavailable') this._loadMusic();
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? .75 : 0, this.context.currentTime, .12);
  }

  setSuspended(suspended) {
    this.suspended = Boolean(suspended);
    if (!this.context) return;
    if (suspended && this.context.state === 'running') this.context.suspend().catch(() => {});
    else if (!suspended && this.enabled && this.unlocked && this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  setVolumes({ music = this.musicVolume, effects = this.effectsVolume } = {}) {
    if (Number.isFinite(music)) this.musicVolume = Math.min(1, Math.max(0, music));
    if (Number.isFinite(effects)) this.effectsVolume = Math.min(1, Math.max(0, effects));
  }

  setEnvironment(value) { this.environment = { ...this.environment, ...value }; }

  _loadMusic() {
    if (this._musicPromise || !this.context || this.disposed) return;
    const context = this.context;
    this._fetchAbort = new AbortController();
    const abort = this._fetchAbort;
    const timeout = setTimeout(() => abort.abort(), 20000);
    this.musicStatus = 'loading';
    this._musicPromise = Promise.allSettled(this.music.map(async track => {
      if (track.buffer) return;
      const response = await fetch(track.url, { signal: abort.signal });
      if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (this.disposed || this.context !== context) return;
      track.buffer = buffer;
      track.nextStart = null;
    })).then(() => {
      if (this.disposed || this.context !== context) return;
      this.musicStatus = this.music.some(track => track.buffer) ? 'ready' : 'unavailable';
    }).finally(() => { clearTimeout(timeout); this._musicPromise = null; });
  }

  _scheduleMusic() {
    const context = this.context;
    for (const track of this.music) {
      if (!track.buffer || (track.nextStart !== null && track.nextStart > context.currentTime + 1)) continue;
      const source = context.createBufferSource(), envelope = context.createGain();
      source.buffer = track.buffer;
      const start = Math.max(context.currentTime + .025, track.nextStart ?? 0);
      const duration = track.buffer.duration, fade = Math.min(3, duration / 8);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(1, start + fade);
      envelope.gain.setValueAtTime(1, start + duration - fade);
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(envelope).connect(track.gain);
      const voice = { source, envelope };
      this.musicSources.add(voice);
      source.onended = () => { source.disconnect(); envelope.disconnect(); this.musicSources.delete(voice); };
      source.start(start);
      source.stop(start + duration + .02);
      track.nextStart = start + duration - fade;
    }
  }

  update(time, speed = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime, { night, reading, position } = this.environment;
    const altitude = Math.max(0, (position?.y ?? 18) - 12);
    const library = Math.hypot((position?.x ?? 0) + 70, (position?.z ?? 0) - 7) < 22;
    const wind = (.10 + Math.min(speed / 120, .32) + Math.min(altitude / 350, .18)) * (library ? .3 : 1);
    this.windGain?.gain.setTargetAtTime(wind, now, .6);
    const fountain = Math.hypot(position?.x ?? 0, (position?.z ?? 0) - 35);
    const shore = (position?.y ?? 18) < 0 ? .22 : 0;
    this.waterGain?.gain.setTargetAtTime(Math.max(shore, .30 * Math.max(0, 1 - fountain / 38)), now, 1.2);
    const duck = reading ? .45 : 1;
    this.musicBus?.gain.setTargetAtTime(.4 * this.musicVolume * duck, now, .7);
    this.effectsBus?.gain.setTargetAtTime(.22 * this.effectsVolume * (reading ? .45 : 1), now, .2);
    this.ambientBus?.gain.setTargetAtTime(.28 * this.effectsVolume * (reading ? .45 : 1), now, .8);
    for (const track of this.music) {
      const level = track.id === 'night' ? Math.sin(night * Math.PI / 2) : Math.cos(night * Math.PI / 2);
      const other = this.music.find(candidate => candidate !== track);
      track.gain?.gain.setTargetAtTime(other?.buffer ? level : 1, now, 2.0);
    }
    this._scheduleMusic();
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
    oscillator.connect(gain).connect(this.effectsBus || this.master);
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
    else if (effect === 'page') { this._tone(360, .10, 'triangle', .08, 210); this._tone(740, .13, 'sine', .04, 520, .06); }
    else if (effect === 'clock') [440, 659.25, 880].forEach((f,i) => this._tone(f, .8, 'sine', .12, f, i*.09));
    else if (effect === 'travel') { this._tone(147, .7, 'sine', .18, 880); this._tone(587.33, 1.25, 'sine', .15, 1174.66, .12); }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._fetchAbort?.abort();
    for (const voice of this.musicSources) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Source may have ended. */ }
      voice.source.disconnect(); voice.envelope.disconnect();
    }
    this.musicSources.clear();
    for (const track of this.music) { track.gain?.disconnect(); track.buffer = null; }
    this.musicBus?.disconnect(); this.effectsBus?.disconnect(); this.ambientBus?.disconnect();
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
