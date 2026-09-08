/** Overlap the head and tail into one continuous noise cycle. */
export function windCycle(sampleRate,duration=4,seed=197){
  const count=Math.max(8,Math.round(sampleRate*duration)),overlap=Math.max(2,Math.round(sampleRate*.12));
  const raw=new Float32Array(count+overlap);let value=0,state=seed>>>0;
  for(let i=0;i<raw.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;value=(value+(state/4294967296*2-1)*.04)/1.04;raw[i]=value*3;}
  const result=raw.slice(overlap);
  for(let i=0;i<overlap;i++){const t=i/(overlap-1),blend=t*t*(3-2*t);result[count-overlap+i]=raw[count+i]*(1-blend)+raw[i]*blend;}
  return result;
}

/** Local CC0 score, spatial environmental beds, and original action sounds. */
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
    this._syncContextState();
  }

  _syncContextState() {
    const context=this.context;
    if(!context||this.disposed||context.state==='closed')return;
    const target=this.suspended?'suspended':this.enabled&&this.unlocked?'running':null;
    if(!target||context.state===target)return;
    if(this._stateRequest?.context===context&&this._stateRequest.target===target)return;
    const request=this._stateRequest={context,target};
    const operation=target==='running'?context.resume():context.suspend();
    Promise.resolve(operation).then(()=>{
      if(this._stateRequest===request)this._stateRequest=null;
      if(this.context===context&&!this.disposed)this._syncContextState();
    },()=>{if(this._stateRequest===request)this._stateRequest=null;});
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
      if(context.createDynamicsCompressor){
        this.limiter=context.createDynamicsCompressor();this.limiter.threshold.value=-4;this.limiter.knee.value=4;this.limiter.ratio.value=8;this.limiter.attack.value=.005;this.limiter.release.value=.15;
        this.master.connect(this.limiter).connect(context.destination);
      }else this.master.connect(context.destination);

      if(context.createConvolver){
        this.reverb=context.createConvolver();const impulse=context.createBuffer(2,Math.round(context.sampleRate*.9),context.sampleRate);
        for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel),noise=windCycle(context.sampleRate,.9,271+channel);for(let i=0;i<data.length;i++)data[i]=noise[i]*Math.exp(-i/context.sampleRate*7);}
        this.reverb.buffer=impulse;this.reverb.normalize=false;this.reverbGain=context.createGain();this.reverbGain.gain.value=.12;
        this.effectsBus.connect(this.reverb).connect(this.reverbGain).connect(this.master);
      }

      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const samples = buffer.getChannelData(0);
      samples.set(windCycle(context.sampleRate));this.noiseBuffer=buffer;
      const wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;this.windFilter=filter;
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
      water.connect(waterFilter).connect(this.waterGain);
      if(context.createPanner){this.waterPanner=context.createPanner();this.waterPanner.panningModel='HRTF';this.waterPanner.distanceModel='inverse';this.waterPanner.refDistance=8;this.waterPanner.maxDistance=160;this.waterPanner.rolloffFactor=1;this.waterPanner.positionX.value=0;this.waterPanner.positionY.value=7;this.waterPanner.positionZ.value=35;this.waterGain.connect(this.waterPanner).connect(this.ambientBus);this.ambient.push(this.waterPanner);}
      else this.waterGain.connect(this.ambientBus);
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
    this._syncContextState();
  }

  setVolumes({ music = this.musicVolume, effects = this.effectsVolume } = {}) {
    if (Number.isFinite(music)) this.musicVolume = Math.min(1, Math.max(0, music));
    if (Number.isFinite(effects)) this.effectsVolume = Math.min(1, Math.max(0, effects));
  }

  setEnvironment(value) { this.environment = { ...this.environment, ...value }; }

  setListener(position,forward){
    const listener=this.context?.listener;if(!listener?.positionX)return;
    const now=this.context.currentTime;
    for(const [name,value]of Object.entries({positionX:position.x,positionY:position.y,positionZ:position.z,forwardX:forward.x,forwardY:forward.y,forwardZ:forward.z,upX:0,upY:1,upZ:0}))listener[name].setTargetAtTime(value,now,.04);
  }

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
    if (!this.enabled || this.suspended || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime, { night, reading, position } = this.environment;
    const altitude = Math.max(0, (position?.y ?? 18) - 12);
    const library = Math.hypot((position?.x ?? 0) + 70, (position?.z ?? 0) - 7) < 22;
    const wind = (.10 + Math.min(speed / 120, .32) + Math.min(altitude / 350, .18)) * (library ? .3 : 1);
    this.windGain?.gain.setTargetAtTime(wind, now, .6);
    this.windFilter?.frequency.setTargetAtTime(420+Math.min(speed,50)*16,now,.25);
    const fountain = Math.hypot(position?.x ?? 0, (position?.z ?? 0) - 35);
    const shore = (position?.y ?? 18) < 0 ? .22 : 0;
    this.waterGain?.gain.setTargetAtTime(this.waterPanner?.45:Math.max(shore, .30 * Math.max(0, 1 - fountain / 38)), now, 1.2);
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

  _rustle(duration,volume,frequency,delay=0){
    if(!this.context||this.context.state!=='running'||!this.noiseBuffer||this.voices.size>=24)return;
    const context=this.context,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),start=context.currentTime+delay;
    source.buffer=this.noiseBuffer;filter.type='bandpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter).connect(gain).connect(this.effectsBus);
    const voice={oscillator:source,gain,filter};this.voices.add(voice);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(voice);};source.start(start);source.stop(start+duration+.01);
  }

  play(effect) {
    if (this.disposed || this.suspended || !this.enabled) return;
    if (effect === 'boost') {this._rustle(.65,.4,700);this._tone(90,.38,'sine',.04,145);}
    else if (effect === 'cast-start') {this._rustle(.18,.12,1300);this._tone(370,.17,'sine',.07,740);}
    else if (effect === 'travel-start') {this._rustle(.32,.32,550);this._tone(100,.23,'sine',.07,240);}
    else if (effect === 'lumos') {this._tone(760, .22, 'sine', .21, 1450);this._rustle(.16,.08,1700);}
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
    else if (effect === 'page') {this._rustle(.22,.18,1600);this._rustle(.12,.08,2100,.12);this._tone(360,.08,'triangle',.022,210);}
    else if (effect === 'clock') [440, 659.25, 880].forEach((f,i) => this._tone(f, .8, 'sine', .12, f, i*.09));
    else if (effect === 'travel') {this._rustle(.65,.25,850);this._tone(147, .7, 'sine', .14, 880);this._tone(587.33, 1.25, 'sine', .12, 1174.66, .12);}
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
    for (const { oscillator, gain, filter } of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
      gain.disconnect();
      filter?.disconnect();
    }
    this.voices.clear();
    for (const node of this.ambient) {
      if (typeof node.stop === 'function') { try { node.stop(); } catch { /* Already stopped. */ } }
      node.disconnect();
    }
    this.ambient.length = 0;
    this.master?.disconnect();
    this.reverb?.disconnect();this.reverbGain?.disconnect();this.limiter?.disconnect();this.noiseBuffer=null;
    this.context?.close().catch(() => {});
    this.context = null;
  }
}
