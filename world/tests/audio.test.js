import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldAudio } from '../src/audio.js';

// The fake boundary records Web Audio scheduling/lifecycle calls. These checks
// do not claim acoustic quality or replace the browser's real MP3 decoding.
function audioBoundary(t, fetcher) {
  const originalContext = globalThis.AudioContext, originalFetch = globalThis.fetch;
  const contexts = [], requests = [];
  const parameter = () => ({ value: 0, events: [], setValueAtTime(value, at) { this.events.push({ type: 'set', value, at }); }, setTargetAtTime(value, at) { this.events.push({ type: 'target', value, at }); }, linearRampToValueAtTime(value, at) { this.events.push({ type: 'ramp', value, at }); }, exponentialRampToValueAtTime(value, at) { this.events.push({ type: 'ramp', value, at }); } });
  const node = () => ({ gain: parameter(), frequency: parameter(), playbackRate: parameter(), connect() { return this; }, disconnect() { this.disconnected = true; }, start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; } });
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 16; this.destination = {}; this.sources = []; contexts.push(this); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { return node(); }
    createBufferSource() { const source = node(); this.sources.push(source); return source; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    async decodeAudioData() { return { duration: 60 }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  };
  globalThis.fetch = async (...args) => { requests.push(args); return fetcher ? fetcher(...args) : { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; };
  t.after(() => { globalThis.AudioContext = originalContext; globalThis.fetch = originalFetch; });
  return { contexts, requests };
}

test('sound requires opt-in and a gesture; mute, background and resume reuse one audio graph', async t => {
  const { contexts, requests } = audioBoundary(t);
  const audio = new WorldAudio(); t.after(() => audio.dispose());
  audio.unlock();
  assert.equal(contexts.length, 0);
  assert.equal(requests.length, 0);
  audio.setVolumes({ music: .35, effects: .8 });
  audio.setEnabled(true);
  await audio._musicPromise;
  assert.equal(contexts.length, 1);
  assert.equal(requests.length, 2);
  assert.equal(audio.musicStatus, 'ready');
  audio.update(0);
  assert.equal(audio.musicSources.size, 2);
  audio.setSuspended(true); assert.equal(contexts[0].state, 'suspended');
  audio.setSuspended(false); assert.equal(contexts[0].state, 'running');
  audio.setEnabled(false); assert.equal(audio.master.gain.events.at(-1).value, 0);
  audio.setEnabled(true); audio.unlock(); audio.update(1);
  assert.equal(contexts.length, 1);
  assert.equal(requests.length, 2, 'existing decoded tracks are reused');
  assert.equal(audio.musicSources.size, 2, 'muting and resuming must not layer duplicate scores');
});

test('music loops overlap their envelopes and reading ducks music without changing the saved volume', async t => {
  audioBoundary(t);
  const audio = new WorldAudio(true); t.after(() => audio.dispose());
  audio.unlock(); await audio._musicPromise;
  audio.setVolumes({ music: .5, effects: .65 });
  audio.setEnvironment({ night: 1, reading: false }); audio.update(0);
  const context = audio.context, first = [...audio.musicSources][0], firstEnd = first.envelope.gain.events.at(-1).at;
  audio.setEnvironment({ reading: true }); audio.update(1);
  assert.equal(audio.musicVolume, .5);
  assert.equal(audio.musicBus.gain.events.at(-1).value, .4 * .5 * .45);
  assert.equal(audio.music[0].gain.gain.events.at(-1).value < .001, true);
  assert.equal(audio.music[1].gain.gain.events.at(-1).value, 1);
  context.currentTime = audio.music[0].nextStart - .5; audio.update(58);
  assert.equal(audio.musicSources.size, 4);
  const second = [...audio.musicSources][2];
  assert.ok(second.source.startedAt < firstEnd, 'the next score starts before the old fade ends');
  const active = audio.musicSources.size; audio.update(58.1);
  assert.equal(audio.musicSources.size, active, 'one lookahead interval schedules only one replacement');
  first.source.onended(); assert.equal(audio.musicSources.size, 3);
  assert.equal(first.source.disconnected, true);
});

test('a missing track degrades to the surviving score and disposal blocks late decode results', async t => {
  let resolveNight;
  const { requests } = audioBoundary(t, url => url.includes('day-theme')
    ? Promise.resolve({ ok: false, status: 404 })
    : new Promise(resolve => { resolveNight = resolve; }));
  const audio = new WorldAudio(true);
  audio.unlock(); const pending = audio._musicPromise;
  audio.dispose();
  assert.equal(requests[0][1].signal.aborted, true);
  resolveNight({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  await pending;
  assert.ok(audio.music.every(track => track.buffer === null));
  assert.equal(audio.musicSources.size, 0);
  assert.equal(audio.context, null);
});

test('one unavailable score cannot mute the available one; retry does not refetch cached audio', async t => {
  let fail = true;
  const { requests } = audioBoundary(t, url => Promise.resolve({ ok: !(fail && url.includes('day-theme')), status: 404, arrayBuffer: async () => new ArrayBuffer(4) }));
  const audio = new WorldAudio(true); t.after(() => audio.dispose());
  audio.unlock(); await audio._musicPromise;
  audio.setEnvironment({ night: 0 }); audio.update(0);
  assert.equal(audio.musicStatus, 'ready');
  assert.equal(audio.musicSources.size, 1);
  assert.equal(audio.music[1].gain.gain.events.at(-1).value, 1);
  fail = false; audio._loadMusic(); await audio._musicPromise;
  assert.equal(requests.length, 3);
  assert.ok(audio.music.every(track => track.buffer));
});
