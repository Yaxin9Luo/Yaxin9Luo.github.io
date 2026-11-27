// Muye's sound (src/muye2/audio/): the bank is complete and clean, and audio.event() routes the sim's stream without
// voicing anything twice when the page's own calls follow. Runs in Node against a minimal stand-in for Web Audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound} from '../src/muye2/audio/engine.js';
import {createBank} from '../src/muye2/audio/bank.js';
import {render, keyOf} from '../src/muye2/audio/instruments.js';

/** Just enough of an AudioContext: every node connects; sources record their start. */
function fakeContext() {
  const started = [], live = [], param = v => ({value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}});
  const node = extra => ({connect() {}, disconnect() {}, ...extra});
  const ctx = {
    currentTime: 10, sampleRate: 48000, state: 'running', destination: node(), started,
    /** Ends every sound started so far (a real context ends them when they finish). */
    endAll() { for (const s of live.splice(0)) s.onended && s.onended(); },
    createGain: () => node({gain: param(1)}),
    createDynamicsCompressor: () => node({threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0)}),
    createConvolver: () => node({buffer: null, normalize: true}),
    createStereoPanner: () => node({pan: param(0)}),
    createBiquadFilter: () => node({type: '', frequency: param(0), Q: param(1), gain: param(0)}),
    createBuffer: (ch, n) => ({length: n, duration: n / 48000, copyToChannel() {}}),
    createBufferSource: () => node({buffer: null, playbackRate: param(1), start(t) { started.push(t); live.push(this); }, stop() {}, onended: null}),
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

test('杨戬\'s true form is 天眼照妖, his own; his feat\'s gaze is its own voice, not the metal bell', () => {
  const y = sound(); y.S.event({type: 'trueForm', general: 'yangjian'}); y.S.trueForm('metal');
  const z = sound(); z.S.event({type: 'trueForm', general: 'nezha'}); z.S.trueForm('metal');
  assert.ok(n(y.ctx) > 10); assert.notDeepEqual(y.ctx.started.map(t => +t.toFixed(3)), z.ctx.started.map(t => +t.toFixed(3)));
  const g = sound(); g.S.event({type: 'generalSkill', general: 'yangjian', id: 'heavenEye', trueForm: true}); g.S.cast('yangjian', 'metal', true);
  const m = sound(); m.S.event({type: 'generalSkill', general: 'yangjian', id: 'other', trueForm: true}); m.S.cast('yangjian', 'metal', true);
  assert.notEqual(n(g.ctx), n(m.ctx), 'the gaze is three sources, the metal voice two');
});

test('the duel events drive the theme: begin, phases (0-based in the sim), fall; the bossDown sting gives way to his fall', () => {
  const {S, ctx} = sound(), M = S.music;
  S.event({type: 'stretch', index: 0}); S.event({type: 'duelBegin', id: 9, kind: 'wenzhong'}); assert.deepEqual(M.duelState, {id: 'wenzhong', phase: 1});
  ctx.endAll(); const before = n(ctx); S.event({type: 'bossPhase', id: 9, kind: 'wenzhong', phase: 1}); S.encircle(); assert.equal(n(ctx), before, 'no boss-phase sting over the held beat');
  S.event({type: 'duelPhase', id: 9, phase: 1}); assert.equal(M.cue, 'wenzhong2'); S.event({type: 'duelPhase', id: 9, phase: 2}); assert.equal(M.cue, 'wenzhong3');
  ctx.endAll(); const k = n(ctx); S.event({type: 'bossDown', id: 9, kind: 'wenzhong', tier: 'big'}); assert.equal(n(ctx), k, 'no sting over the fall');
  S.event({type: 'duelFall', id: 9}); assert.equal(M.duelState, null); assert.ok(n(ctx) > k, 'his fall plays');
  for (const type of ['stagger', 'shrug', 'phaseGate', 'wardBroken']) { const t = sound(); t.S.event({type, id: 1}); assert.ok(n(t.ctx) > 0, type); }
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

test('a duel holds the music: entrance, then phase 1 on time; a held beat into each phase; the field waits for his fall', () => {
  const {S} = sound(), M = S.music;
  S.event({type: 'stretch', index: 0}); assert.equal(M.cue, 'xiqi');
  S.duel('wenzhong'); assert.deepEqual(M.duelState, {id: 'wenzhong', phase: 1}); assert.equal(M.cue, 'wenzhong1');
  S.event({type: 'march'}); assert.equal(M.cue, 'wenzhong1', 'a field cue does not cut into the duel');
  S.duelPhase(3); assert.equal(M.cue, 'wenzhong3'); S.duelPhase(2); assert.equal(M.cue, 'wenzhong3', 'phases only go forward');
  S.duelEnd(); assert.equal(M.duelState, null); assert.equal(M.cue, 'march', 'the field\'s last asked cue comes back after the fall');
});

test('a defeat during a duel ends it', () => {
  const {S} = sound(); S.duel('wenzhong'); S.lost(); assert.equal(S.music.duelState, null); assert.equal(S.music.cue, null);
});

test('a duel\'s own sounds render when his stretch begins and are freed when the duel ends; the field\'s stay', () => {
  const S0 = createSound({context: fakeContext(), bank: BANK}), set = S0.duelSet('wenzhong'), field = new Set(S0.wanted('field').map(([n, a]) => keyOf(n, a)));
  assert.ok(set.length > 30 && set.every(([n, a]) => !field.has(keyOf(n, a))), `${set.length} sounds, none shared with the field`);
  const asked = [], freed = [], spy = {stats: {}, room: null, roomBig: null, want: l => asked.push(...l.map(([n, a]) => keyOf(n, a))), free: k => freed.push(...k), get: () => null};
  const S = createSound({context: fakeContext(), bank: spy}); S.ensure();
  S.event({type: 'stretch', index: 0}); assert.equal(asked.length, set.length, 'stretch 0 asks for 闻仲\'s set');
  S.event({type: 'duelBegin', id: 4, kind: 'wenzhong'}); assert.equal(asked.length, set.length, 'not asked twice');
  S.event({type: 'duelFall', id: 4}); assert.equal(freed.length, 0, 'his fall still plays');
  S.event({type: 'duelEnd', id: 4}); assert.equal(freed.length, set.length, 'freed when the duel ends');
  S.event({type: 'stretch', index: 0}); assert.equal(asked.length, 2 * set.length, 'a new run asks again');
  S.leave(); assert.equal(freed.length, 2 * set.length, 'leaving the run frees it');
});

test('闻仲\'s attacks have voices on their landing; the four generals are told apart by their warnings', () => {
  for (const id of ['thunderRows', 'thunderStorm', 'pairedWhips', 'threeWhips', 'qilinRush', 'qilinReturn', 'dragonPillars', 'thirdEye', 'goldWall']) { const {S, ctx} = sound(); S.event({type: 'land', id, side: 'shang', shape: 'circle', x: 0, y: 0}, {x: 0, y: 0}); assert.ok(n(ctx) > 0, id); }
  const kinds = []; for (const who of ['dengzhong', 'xinhuan']) { const {S, ctx} = sound(); S.event({type: 'warn', kind: 'fourGenerals', who}); S.event({type: 'land', id: 'fourGenerals', side: 'shang'}); kinds.push(n(ctx)); }
  assert.ok(kinds.every(k => k > 1));
  const {S, ctx} = sound(); S.event({type: 'land', id: 'thunderRows:fire', side: 'shang'}); S.event({type: 'land', id: 'fireSpear', x: 0}); assert.equal(n(ctx), 0, 'lasting ground and the hero\'s own landings are not voiced here');
});

test('the duel title card moves the seal\'s stroke to its own moment, never doubling it', () => {
  const {S, ctx} = sound(); S.duel('wenzhong'); ctx.endAll(); const k = n(ctx);
  ctx.currentTime += .5; S.duelCard('seal', 'wenzhong'); assert.equal(n(ctx) - k, 2, 'the bronze and the massed drums, now');
  S.duelCard('seal', 'wenzhong'); assert.equal(n(ctx) - k, 2, 'a second call does nothing');
});

test('every duel theme runs entrance → phases → fall from its events', () => {
  for (const kind of ['wenzhong', 'kongxuan', 'yuanhong', 'zhouwang']) {
    const {S} = sound(), M = S.music;
    S.event({type: 'duelBegin', id: 1, kind}); assert.equal(M.cue, kind + 1, kind);
    S.event({type: 'duelPhase', id: 1, phase: 1}); assert.equal(M.cue, kind + 2, kind);
    S.event({type: 'duelPhase', id: 1, phase: 2}); assert.equal(M.cue, kind + 3, kind);
    S.event({type: 'duelFall', id: 1}); assert.equal(M.duelState, null, kind);
  }
});

test('纣王\'s victory waits for his fall to play out', () => {
  const {S, ctx} = sound();
  S.event({type: 'duelBegin', id: 1, kind: 'zhouwang'}); S.event({type: 'duelFall', id: 1}); ctx.endAll();
  const before = ctx.started.length; S.won();
  const first = Math.min(...ctx.started.slice(before));
  assert.ok(first >= ctx.currentTime + 10.5, `the victory starts ${(first - ctx.currentTime).toFixed(1)} s after his fall began`);
});

test('纣王\'s set is asked for as 袁洪\'s duel ends; sounds the two share are not freed', () => {
  const asked = [], freed = [], spy = {stats: {}, room: null, roomBig: null, want: l => asked.push(...l.map(([n, a]) => keyOf(n, a))), free: k => freed.push(...k), get: () => null};
  const S = createSound({context: fakeContext(), bank: spy}); S.ensure();
  S.event({type: 'stretch', index: 2}); S.event({type: 'duelBegin', id: 2, kind: 'yuanhong'});
  const yh = new Set(S.duelSet('yuanhong').map(([n, a]) => keyOf(n, a))), zw = new Set(S.duelSet('zhouwang').map(([n, a]) => keyOf(n, a)));
  S.event({type: 'duelEnd', id: 2});
  assert.ok([...zw].every(k => asked.includes(k)), '纣王\'s whole set asked');
  assert.ok(freed.every(k => yh.has(k) && !zw.has(k)), 'only 袁洪\'s own sounds freed');
});

test('the fire pillars and the soul rising are 闻仲\'s fall only', () => {
  const counts = {}; for (const kind of ['wenzhong', 'zhouwang']) { const {S, ctx} = sound(); S.event({type: 'duelBegin', id: 1, kind}); ctx.endAll(); const k = n(ctx); S.event({type: 'duelFall', id: 1}); counts[kind] = n(ctx) - k; }
  assert.ok(counts.wenzhong > counts.zhouwang, JSON.stringify(counts));
});
