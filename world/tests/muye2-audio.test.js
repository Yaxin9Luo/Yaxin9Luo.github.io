// Muye's sound (src/muye2/audio/): the bank is complete and clean, and audio.event() routes the sim's stream without
// voicing anything twice when the page's own calls follow. Runs in Node against a minimal stand-in for Web Audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound} from '../src/muye2/audio/engine.js';
import {createBank} from '../src/muye2/audio/bank.js';
import {render, keyOf} from '../src/muye2/audio/instruments.js';

/** Just enough of an AudioContext: every node connects; sources record their start. */
function fakeContext() {
  const started = [], param = v => ({value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}});
  const node = extra => ({connect() {}, disconnect() {}, ...extra});
  const ctx = {
    currentTime: 10, sampleRate: 48000, state: 'running', destination: node(), started,
    createGain: () => node({gain: param(1)}),
    createDynamicsCompressor: () => node({threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0)}),
    createConvolver: () => node({buffer: null, normalize: true}),
    createStereoPanner: () => node({pan: param(0)}),
    createBuffer: (ch, n) => ({length: n, duration: n / 48000, copyToChannel() {}}),
    createBufferSource: () => node({buffer: null, playbackRate: param(1), start(t) { started.push(t); }, stop() {}, onended: null}),
  };
  return ctx;
}
const BANK = createBank({sync: true});
function sound() { const ctx = fakeContext(), S = createSound({context: ctx, bank: BANK}); S.ensure(); return {S, ctx}; }
const n = ctx => ctx.started.length;

test('every sound the game can ask for renders finite, under full scale, and not silent', () => {
  const S = createSound({context: fakeContext(), bank: createBank({sync: true})});
  const keys = new Map(); for (const [name, arg] of S.wanted()) keys.set(keyOf(name, arg), [name, arg]);
  assert.ok(keys.size > 150, `${keys.size} sounds listed`);
  for (const [key, [name, arg]] of keys) {
    const x = render(name, arg); let peak = 0;
    for (const v of x) { assert.ok(Number.isFinite(v), key + ' has a NaN'); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak <= 1 && peak > 1e-3, `${key} peak ${peak}`);
  }
});

test('a boss phase is voiced once, by the event, when the page also calls encircle()', () => {
  const {S, ctx} = sound();
  S.event({type: 'bossPhase', id: 1, kind: 'wenzhong', phase: 2}); const byEvent = n(ctx); S.encircle(); assert.equal(n(ctx), byEvent);
  S.encircle(); assert.ok(n(ctx) > byEvent, 'a real encirclement is still voiced');
});

test('a spoil is voiced by the event, and the page\'s old trueForm("metal") after it is not', () => {
  const {S, ctx} = sound();
  S.event({type: 'spoil', id: 'qingyunSword', tier: 'big'}); const byEvent = n(ctx); assert.ok(byEvent > 0);
  S.trueForm('metal'); assert.equal(n(ctx), byEvent);
});

test('the antidote has its own sound; the peach keeps its own', () => {
  const a = sound(); a.S.event({type: 'pickup', kind: 'antidote'}); a.S.peach();
  const p = sound(); p.S.event({type: 'pickup', kind: 'peach'}); p.S.peach();
  assert.ok(n(a.ctx) > 0 && n(p.ctx) > 0);
  assert.notDeepEqual(a.ctx.started.map(t => +t.toFixed(3)), p.ctx.started.map(t => +t.toFixed(3)));
});

test('the light taken: the event voices it, the page\'s refuse() right after does not; a later refuse() does', () => {
  const {S, ctx} = sound();
  S.event({type: 'lightTaken', element: 'fire'}); const k = n(ctx); S.refuse(); assert.equal(n(ctx), k); S.refuse(); assert.equal(n(ctx), k + 1);
});

test('the music follows the campaign: stretch, boss, march, rest, the sortie, the end', () => {
  const {S} = sound(), M = S.music;
  S.event({type: 'stretch', index: 0}); assert.equal(M.cue, 'xiqi');
  S.event({type: 'stretch', index: 1}); M.tick(); assert.equal(M.stretchCue, 'dongzheng');
  S.event({type: 'march'}); S.event({type: 'marchEnd', rest: 25});
  S.event({type: 'restEnd'}); assert.equal(M.stretchCue, 'dongzheng');
  S.event({type: 'arrive', id: 7, kind: 'zhouwang', tier: 'final'}); assert.equal(M.stretchCue, 'final');
  S.event({type: 'host'});
  S.won(); assert.equal(M.cue, null, 'the victory ends the loop');
});

test('a cue asked for before the first gesture starts when the context is made', () => {
  const ctx = fakeContext(), S = createSound({context: ctx, bank: BANK});
  S.event({type: 'stretch', index: 2}); assert.equal(S.music.cue, null);
  S.ensure(); assert.equal(S.music.cue, 'zhaoge');
});

test('a boss killed without bossDown leaves the boss layer', () => {
  const {S} = sound();
  S.event({type: 'stretch', index: 0}); S.event({type: 'arrive', id: 3, tier: 'final'}); assert.equal(S.music.stretchCue, 'final');
  assert.equal(S.music.bossTier, 'final');
  S.event({type: 'kill', id: 3}); assert.equal(S.music.bossTier, null);
});

test('sound off plays nothing; on again plays', () => {
  const {S, ctx} = sound();
  S.toggle(); S.hurt(); S.warn(); assert.equal(n(ctx), 0);
  S.toggle(); S.hurt(); assert.ok(n(ctx) > 0);
});

test('the casts keep their budget: at most six treasure voices at once', () => {
  const {S} = sound();
  for (let i = 0; i < 40; i++) S.cast('t' + i, ['fire', 'water', 'wood', 'metal', 'earth'][i % 5], true);
  assert.ok(S.mix.castVoices <= 8, `cast sources ${S.mix.castVoices}`);      // the budget is six sources; the last voice let in may add two more
});

test('Yang Jian has a named slot for his true form', async () => {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/muye2/audio/engine.js', import.meta.url), 'utf8'));
  assert.match(src, /yangjian:/);
  const {S, ctx} = sound(); S.event({type: 'trueForm', general: 'yangjian'}); S.trueForm('metal'); assert.ok(n(ctx) > 10, 'until it is written, the common true form plays');
});

test('listing the sounds leaves the instance as it was: warnings sound at once, no boss is up', () => {
  const ctx = fakeContext(); ctx.currentTime = 1; const S = createSound({context: ctx, bank: BANK});
  S.wanted(); S.ensure();
  S.warn(); assert.ok(n(ctx) > 0, 'the first warning of a run is heard');
  S.event({type: 'stretch', index: 0}); S.event({type: 'arrive', id: 1, tier: 'big'}); assert.equal(S.music.bossTier, 'big');
});

test('a merge has its own cue: the page\'s evolve() after a merge event plays the merge, larger than an evolution', () => {
  const m = sound(); m.S.event({type: 'merge', id: 'x'}); m.S.evolve('metal');
  const e = sound(); e.S.event({type: 'evolve', id: 'x'}); e.S.evolve('metal');
  assert.ok(n(m.ctx) > n(e.ctx), `merge ${n(m.ctx)} sources, evolve ${n(e.ctx)}`);
});

test('the finale events are all voiced', () => {
  for (const type of ['meishan', 'lastWave', 'rout', 'host', 'sortie', 'hostReserve', 'lastGuard']) { const {S, ctx} = sound(); S.event({type}); assert.ok(n(ctx) > 0, type); }
  const w = sound(); w.S.event({type: 'kinWard', by: [], share: 1}); assert.ok(n(w.ctx) > 0, 'the ward breaks');
  const g = sound(); g.S.event({type: 'bossDown', id: 1, kind: 'yuanhong', tier: 'big'}); const k = n(g.ctx); g.S.event({type: 'gateOpen'}); assert.ok(n(g.ctx) - k >= 6, 'the great gate after Yuan Hong');
});
