// The sound of Muye: a Zhou court orchestra going to war, all synthesized (instruments.js renders each sound once into
// a buffer; this plays them). Same calls as the first audio.js, so main.js works unchanged, plus `event(e, hero)`: one
// entry for the sim's whole stream, which voices what the page does not and gives the page's own calls their context
// (where on the screen a cast is, which general takes his true form, that a pickup was the antidote).
//
//   cast bus   treasures, squads, generals' feats, spoils (under the budget) ─┐
//   sfx bus    pickups, the offer, the hero ──────────────────────────────────┤
//   alert bus  warnings, hurt, afflictions, arrivals (never budgeted or ducked) ┼─ pre ─ glue ─ limiter ─ out (volume, on/off)
//   moment bus true forms, evolutions, spoils, stretch calls ─────────────────┤
//   music bus  the score (ducked under great moments and under hurt) ─ trim ──┘
//   every bus sends a share to one hall (a convolution reverb): the music and the bells most.
//
// Pitch: everything pitched sits in one pentatonic collection (C D E G A). The music changes tonic and mode by stretch
// inside it, so a treasure's note, which never changes, is always in tune with whatever is playing.
//
// The treasures fire by themselves, about 70 times a second in a maxed build, so their voices go through a budget:
// at most CAST_VOICES at once, the same treasure not again within 90 ms, fainter the more there have been this second.
import {createBank} from './bank.js';
import {RATE, HELD} from './instruments.js';
import {createMusic} from './music.js';

const CAST_VOICES = 6, SPOIL_SOURCES = 6, VOICES = 48, MUSIC_VOICES = 28, MUSIC_GAIN = .2, CAST_GAIN = .6, PAUSED_DB = -9;
const ELEMENTS = ['fire', 'water', 'wood', 'metal', 'earth'];
const PENT = [0, 2, 4, 7, 9];
/** The frequency of pentatonic index i, where 0 is C3 (130.81 Hz), 5 is C4, -5 is C2. */
export const pent = i => 130.8128 * Math.pow(2, (12 * Math.floor(i / 5) + PENT[((i % 5) + 5) % 5]) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DRY = {}, NO_BANK = {stats: {}, want() {}, get: () => null, room: null};      // for the throwaway instance that lists the sounds

/** `context`: an OfflineAudioContext to render into (the listening page's measurements); none in the game.
    `bank`: a bank to share between instances (the listening page makes one per render); else each makes its own. */
export function createSound({context = null, bank: shared = null} = {}) {
  const offline = !!context, bank = shared || createBank({sync: offline});
  let ctx = null, out = null, buses = null, trim = null, room = null, on = true, volume = .8, music = null, paused = false;
  let voices = 0, musicVoices = 0, castVoices = 0, spoilSources = 0, density = 0, densityAt = 0, kills = 0, killsAt = 0, crowdAt = -9;
  let collect = null, fakeT = 0;                       // the dry run that lists every sound the game will ask for
  let cur = null;                                       // the event being handled, for the page's own calls that follow it
  const lastCast = new Map(), live = new Map();         // live: the bosses on the field, id -> tier
  const level = () => on ? volume : 0;
  const now = () => collect ? fakeT : ctx.currentTime;
  const alive = () => !!(ctx || collect);

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume && !offline) ctx.resume(); return true; }
    if (offline) ctx = context;
    else {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return false;
      try { ctx = new AC({latencyHint: 'interactive', sampleRate: RATE}); } catch { ctx = new AC(); }
    }
    out = ctx.createGain(); out.gain.value = level();
    // glue: a gentle compressor that holds the whole together; then a fast limiter that only stops overs
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = .01; glue.release.value = .25;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08;
    const pre = ctx.createGain(); pre.gain.value = .45;
    pre.connect(glue); glue.connect(lim); lim.connect(out); out.connect(ctx.destination);
    room = ctx.createConvolver(); room.normalize = false;
    const roomOut = ctx.createGain(); roomOut.gain.value = 1.6; room.connect(roomOut); roomOut.connect(pre);
    const hallIn = () => { const [L, R] = bank.room, ir = ctx.createBuffer(2, L.length, RATE); ir.copyToChannel(L, 0); ir.copyToChannel(R, 1); room.buffer = ir; };
    if (bank.room) hallIn(); else bank.onReady = () => { if (!room.buffer && bank.room) hallIn(); };
    trim = ctx.createGain(); trim.gain.value = paused ? Math.pow(10, PAUSED_DB / 20) : 1; trim.connect(pre);
    const bus = (g, send, to = pre) => { const b = ctx.createGain(); b.gain.value = g; b.connect(to); const s = ctx.createGain(); s.gain.value = send; b.connect(s); s.connect(room); return b; };
    buses = {cast: bus(CAST_GAIN, .18), sfx: bus(.8, .12), alert: bus(1.4, .06), music: bus(MUSIC_GAIN, .35, trim), moment: bus(.6, .3)};
    if (wanted) { const w = wanted; wanted = null; music.play(w.cue); if (w.boss) music.boss(w.boss); }
    return true;
  }
  let wanted = null;      // a cue asked for before the first gesture made the context: it starts on ensure()

  /** Plays a rendered sound. `at` seconds from now (or `when`, absolute), `rate` its playback rate, `gain` linear,
      `pan` -1..1, `bus` the bus name, `kind` 'cast' | 'spoil' for the budgets. Returns the source, or null if dropped. */
  function play(name, arg, {gain = .5, rate = 1, at = 0, when = null, pan = 0, bus = 'sfx', kind = '', len = null, bend = 0} = {}) {
    let rel = .08;
    if ((name === 'horn' || name === 'xun') && Array.isArray(arg)) {      // a breath held for `d` s: one of three rendered lengths, cut to d
      const d = arg[1], D = HELD.find(x => x >= d - .02) ?? HELD[HELD.length - 1];
      if (D - d > .05) { len = len ?? d; rel = .3; }
      arg = name === 'horn' ? [arg[0], D, (arg[2] ?? 1) < .9 ? .8 : 1] : [arg[0], D];
    }
    if (collect) { collect.push([name, arg]); return null; }
    if (!ctx || !on || (bus === 'music' ? musicVoices >= MUSIC_VOICES : voices >= VOICES)) return null;
    const b = bank.get(ctx, name, arg); if (!b) return null;
    const t = when ?? now() + at, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = rate;
    if (bend) { src.playbackRate.setValueAtTime(rate, t); src.playbackRate.exponentialRampToValueAtTime(rate * Math.pow(2, bend / 12), t + Math.min(1.5, b.duration * .8)); }
    g.gain.value = gain;
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    src.connect(g); node.connect(buses[bus] || buses.sfx);
    const mus = bus === 'music'; if (mus) musicVoices++; else voices++; if (kind === 'cast') castVoices++; if (kind === 'spoil') spoilSources++;
    src.onended = () => { if (mus) musicVoices--; else voices--; if (kind === 'cast') castVoices--; if (kind === 'spoil') spoilSources--; node.disconnect(); if (node !== g) g.disconnect(); };
    src.start(t); if (len) { g.gain.setValueAtTime(gain, t + len); g.gain.exponentialRampToValueAtTime(.0005, t + len + rel); src.stop(t + len + rel + .02); }
    return src;
  }
  /** Turns a bus down by `db` for `hold` seconds, then back over `back`: the music under great moments and hurt, the casts under hurt. */
  function duckBus(name, base, db, hold, back) {
    if (!ctx) return; const g = buses[name].gain, t = now(), low = base * Math.pow(10, -db / 20);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(low, t + .04); g.setValueAtTime(low, t + hold); g.linearRampToValueAtTime(base, t + hold + back);
  }
  const duck = (db = 6, hold = .5, back = .6) => duckBus('music', MUSIC_GAIN, db, hold, back);
  const duckCasts = (db, hold, back) => duckBus('cast', CAST_GAIN, db, hold, back);
  const vary = (v, by = .04) => v * (1 + (Math.random() - .5) * 2 * by);
  // a pitch of its own for every treasure: its id picks one of eight notes of the collection, C4 to E5
  const degree = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % 8; };
  /** The page's call that follows an event takes that event's context, once. */
  const takeCur = test => { if (cur && !cur.used && test(cur.e)) { cur.used = true; return cur; } return null; };

  /** The five elements' voices. k: strength after the budget's ducking; d: the note (index from C4); big: evolved or true form. */
  const VOICE = {
    // fire: a roar of air rising, embers in it, a small bell on its note
    fire(k, d, big, o) { play(big ? 'fireBig' : 'fire', undefined, {gain: .3 * k, rate: vary(1, .06), ...o}); play('bell', pent(5 + d) * 2, {gain: .07 * k, at: .03, ...o}); },
    // water: a drop, and a 瑟 string plucked on its note
    water(k, d, big, o) { play('drop', pent(5 + d), {gain: .22 * k, ...o}); play('se', pent(5 + d), {gain: .26 * k, at: .01, ...o}); if (big) play('se', pent(10 + d), {gain: .16 * k, at: .09, ...o}); },
    // wood: the 柷 box, a dry knock tuned to its note, twice when evolved
    wood(k, d, big, o) { play('wood', pent(5 + d), {gain: .4 * k, ...o}); if (big) play('wood', pent(7 + d), {gain: .28 * k, at: .075, ...o}); },
    // metal: a bell of the 编钟 on its note
    metal(k, d, big, o) { play('bell', pent(10 + d), {gain: .22 * k, ...o}); if (big) play('bell', pent(5 + d), {gain: .18 * k, at: .02, ...o}); },
    // earth: a stone chime low on its note, over a thud
    earth(k, d, big, o) { play('chime', pent(d), {gain: .3 * k, ...o}); play('drumSoft', 70, {gain: .3 * k, ...o}); if (big) play('rumble', undefined, {gain: .2 * k, ...o}); },
  };
  const voice = el => VOICE[el] || VOICE.earth;
  const castOpts = {bus: 'cast', kind: 'cast'};

  /* ---------- the spoils: each its own working ---------- */
  const SPOIL = {
    qingyunSword: (k, o) => { play('shing', undefined, {gain: .3 * k, ...o}); play('wind', undefined, {gain: .2 * k, rate: 1.4, ...o}); },                 // a black wind of blades
    hunyuanUmbrella: (k, o) => { play('wood', pent(2), {gain: .2 * k, ...o}); play('harm', pent(12), {gain: .14 * k, ...o}); },                             // a shot swallowed; light returned
    jadePipa: (k, o) => { [0, 2, 4, 7].forEach((d, i) => play('se', pent(7 + d), {gain: .2 * k, at: i * .035, ...o})); play('fire', undefined, {gain: .2 * k, at: .1, ...o}); },   // the lute strummed: wind and fire
    marten: (k, o) => { play('tear', undefined, {gain: .22 * k, rate: 1.6, ...o}); play('wood', pent(14), {gain: .16 * k, ...o}); },                         // a quick bite
    callName: (k, o) => { play('horn', [pent(2), .35, .8], {gain: .18 * k, ...o}); play('drum', 80, {gain: .2 * k, at: .3, ...o}); },                       // his name called; he falls
    goldWhips: (k, o) => { play('shing', undefined, {gain: .3 * k, rate: .7, ...o}); play('bell', pent(8), {gain: .25 * k, at: .05, ...o}); play('bell', pent(10), {gain: .2 * k, at: .14, ...o}); },
    bloodBlade: (k, o) => { play('shing', undefined, {gain: .3 * k, rate: .85, ...o}); play('tear', undefined, {gain: .18 * k, at: .05, ...o}); },
    yellowBreath: (k, o) => { play('wind', undefined, {gain: .18 * k, rate: .7, ...o}); play('chime', pent(-1), {gain: .2 * k, ...o}); },
    plague: (k, o) => { play('wind', undefined, {gain: .2 * k, rate: .55, ...o}); play('harm', pent(6), {gain: .12 * k, bend: -1, ...o}); },
    goldenCrown: (k, o) => { [0, 1, 2, 3, 4].forEach((d, i) => play('chime', pent(12 + d), {gain: .12 * k, at: i * .03, ...o})); play('bell', pent(10), {gain: .2 * k, ...o}); },
    boneBanner: (k, o) => { play('zheng', 300, {gain: .18 * k, rate: .7, ...o}); play('wind', undefined, {gain: .18 * k, rate: .5, ...o}); },
    earthTravel: (k, o) => { play('rumble', undefined, {gain: .45 * k, ...o}); play('drum', 55, {gain: .4 * k, ...o}); },
    fiveLights: (k, o) => { [0, 1, 2, 3, 4].forEach((d, i) => play('bell', pent(8 + d), {gain: .14 * k, at: i * .05, ...o})); play('whoosh', undefined, {gain: .2 * k, ...o}); },
    changeForm: (k, o) => { play('chime', pent(0), {gain: .35 * k, ...o}); play('drum', 52, {gain: .35 * k, ...o}); },                                         // turned to stone
  };

  /** A true form, the great image: the ground gives (a deep drum and the lowest bell), a run of stone chimes climbs, the
      bells answer as a chord, horns hold under it, and the element's voice crowns it. The music bows out for 1.6 s. */
  function trueFormDefault(element) {
    duck(9, 1.6, 1.4);
    play('drum', 52, {gain: .6, bus: 'moment'}); play('drum', 52, {gain: .45, at: .32, bus: 'moment'}); play('rumble', undefined, {gain: .35, bus: 'moment'});
    play('bellDark', pent(-5), {gain: .45, at: .02, bus: 'moment'});
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((d, i) => play('chime', pent(8 + d), {gain: .1 + i * .01, at: .1 + i * .045, bus: 'moment'}));
    [[0, .5], [3, .55], [5, .6], [7, .65], [10, .7]].forEach(([d, at]) => play('bell', pent(d), {gain: .22, at, bus: 'moment'}));
    play('horn', [pent(-5), 1.6, 1], {gain: .3, at: .45, bus: 'moment'}); play('horn', [pent(-2), 1.4, .9], {gain: .22, at: .5, bus: 'moment'});
    voice(element)(1.3, 5, true, {bus: 'moment', at: .5});
  }
  /** A general's own true form, where one is written. 杨戬's is being redesigned round the third eye: his slot is here,
      and until it is written it plays the common true form. */
  const FEATS = {
    yangjian: null,       // the third eye opens: to be written with the redesigned feat
  };

  let streak = 0, streakAt = -9, pickAt = -9, killAt = -9, warnAt = -9, trampleAt = -9, blockAt = -9, namedAt = -9, wardAt = -9, sortieAt = -9, stride = 0;
  let downBig = new Set(), stretchNo = 0;
  const bossTier = () => { let best = null; const rank = {small: 1, big: 2, final: 3}; for (const t of live.values()) if (!best || rank[t] > rank[best]) best = t; return best; };
  const setBoss = () => { if (!music) return; const t = bossTier(); if (ctx) music.boss(t); else if (wanted) wanted.boss = t; };
  const cue = name => { if (!music) return; if (ctx) music.play(name); else wanted = {cue: name, boss: null}; };

  const api = {
    ensure,
    get ctx() { return ctx; }, get buses() { return buses; }, get bank() { return bank; }, play, duck, pent,
    get on() { return on; },
    get started() { return !!ctx; },
    get offline() { return offline; },
    /** For checks: what the budget and the bank are doing. */
    get mix() { return {voices, musicVoices, castVoices, spoilSources, density: +density.toFixed(2), rendered: bank.stats.rendered, late: bank.stats.late, ready: bank.stats.ready, worker: bank.stats.worker, cue: music ? music.cue : null}; },
    get music() { return music; },
    toggle() { on = !on; if (out) out.gain.value = level(); return on; },
    setVolume(v) { volume = clamp(v, 0, 1); if (out) out.gain.value = level(); },
    /** Every sound the game can ask for, as [name, arg]. Listed by a dry run on a throwaway instance: the run moves
        the clock and the repeat guards, and would leave them set in this one. */
    wanted() { return createSound({context: DRY, bank: NO_BANK}).dryRun(); },
    /** The dry run itself: every voice once (or over its range), the clock jumping between calls, nothing played. */
    dryRun() {
      const list = []; collect = list; fakeT = 100; const step = () => { fakeT += 10; };
      try {
        for (const el of ELEMENTS) for (let d = 0; d < 8; d++) for (const big of [false, true]) VOICE[el](1, d, big, {});
        for (const el of ELEMENTS) for (const big of [false, true]) VOICE[el](1, 3, big, {}), VOICE[el](1, 5, big, {}), VOICE[el](1, 0, big, {});
        for (const id in SPOIL) SPOIL[id](1, {});
        for (let i = 0; i < 16; i++) { fakeT += .1; api.pickup(i % 3); }
        const calls = [() => api.peach(), () => voiceAntidote(), () => api.lodestone(), () => api.chest(), () => api.levelUp(), () => api.slip(), () => api.reroll(), () => api.banish(), () => api.refuse(true),
          () => api.withdraw(), () => api.spoil(false), () => api.spoil(true), () => api.named(true), () => api.named(false), () => api.resonance(), () => api.elite(), () => api.boss(),
          () => api.encircle(true), () => api.warn(), () => api.hurt(), () => api.block(), () => api.dash(), () => api.cry(true), () => api.cry(false), () => api.trample(), () => api.kill(true), () => api.kill(false),
          () => api.fall(), () => api.hooves(400, 300, .1), () => api.bossPhase(), () => api.enrage(), () => api.gateOpen(false), () => api.gateOpen(true), () => api.merge('fire'),
          () => api.guards(), () => api.landmark(), () => api.rear(), () => api.unhorsed(), () => api.remount(), () => api.transform('wind'), () => api.transform('stone'), () => api.transform('back'), () => api.burrow(), () => api.emerge(),
          () => api.meishan(), () => api.lastWave(), () => api.kinWard(false), () => api.kinWard(true), () => api.rout(), () => api.host(), () => api.sortie(), () => api.hostReserve(), () => api.lastGuard(), () => api.lightReturned()];
        for (const el of ELEMENTS) calls.push(() => api.take(el), () => api.evolve(el), () => api.skill('x' + el, el, 5), () => api.general(el, false), () => api.general(el, true), () => trueFormDefault(el), () => api.merge(el));
        for (const i of [0, 1, 2]) calls.push(() => stretchCall(i));
        for (const tier of ['small', 'big', 'final']) calls.push(() => bossDownCall(tier));
        for (const k of ['bleed', 'held', 'soulLost', 'glare', 'dazzle', 'lightTaken', 'cured', 'freed']) calls.push(() => api.afflict(k));
        for (const c of calls) { step(); c(); }
        music.wanted(list);
      } finally { collect = null; }
      return list;
    },
    /** Starts rendering the bank (in the game, at once, in a worker). */
    prewarm() { bank.want(api.wanted()); return bank.stats; },

    /* ---------- the one entry for the sim's stream ---------- */
    /** Every event of the sim, before the page's own handling. `hero`: for the stereo place of what is heard. */
    event(e, hero) {
      const pan = hero && e.x != null ? clamp((e.x - hero.x) / 420, -1, 1) * .7 : 0;
      cur = {e, pan, used: false};
      switch (e.type) {
        case 'kill': if (alive()) { const t = now(); kills = kills * Math.exp(-(t - killsAt) * .5) + 1; killsAt = t; } if (live.delete(e.id)) setBoss(); return;      // a boss killed outside the campaign's rules sends no bossDown
        case 'spoilStrike': api.spoilStrike(e.id, pan); return;
        case 'bleed': case 'held': case 'soulLost': case 'glare': case 'dazzle': case 'lightTaken': case 'cured': case 'freed': api.afflict(e.type); return;
        case 'lightReturned': api.lightReturned(); return;
        case 'stretch': stretchNo = e.index || 0; stretchCall(stretchNo); return;
        case 'march': live.clear(); api.march(); return;
        case 'marchEnd': if (e.rest > 0) api.rest(true); return;
        case 'rest': api.rest(true); return;
        case 'restEnd': api.rest(false); return;
        case 'arrive': case 'boss': if (e.tier === 'small' || e.tier === 'big' || e.tier === 'final') { live.set(e.id ?? e.kind, e.tier); setBoss(); } return;
        case 'bossDown': live.delete(e.id ?? e.kind); if (e.tier === 'big') downBig.add(e.kind); bossDownCall(e.tier); return;
        case 'bossPhase': api.bossPhase(); return;
        case 'enrage': api.enrage(); return;
        case 'spoil': api.spoil(e.tier === 'big'); return;
        case 'gateOpen': api.gateOpen(downBig.has('yuanhong')); return;
        case 'guards': api.guards(); return;
        case 'landmark': api.landmark(pan); return;
        case 'rear': case 'drum': api.rear(pan); return;
        case 'unhorsed': api.unhorsed(); return;
        case 'remount': api.remount(); return;
        case 'transform': api.transform(e.form, pan); return;
        case 'burrow': api.burrow(pan); return;
        case 'emerge': api.emerge(pan); return;
        case 'rout': api.rout(); return;
        // the finale (finale-events.md): 梅山七怪 land with 袁洪; the last common host; his kin's ward; 朝歌's gate; 纣王's sortie
        case 'meishan': api.meishan(); return;
        case 'lastWave': api.lastWave(); return;
        case 'kinWard': api.kinWard(e.share >= 1 || !(e.by && e.by.length)); return;
        case 'host': api.host(); return;
        case 'sortie': api.sortie(pan); return;
        case 'hostReserve': api.hostReserve(); return;
        case 'lastGuard': api.lastGuard(); return;
        default: return;
      }
    },
    /** How full the field is: the page's foe count, each frame or a few times a second. The music's layers follow it. */
    crowd(n) { if (!music) return; crowdAt = alive() ? now() : 0; music.setIntensity(clamp(n / 200, 0, 1)); },
    /** The pause sheet is up: the music steps back; it comes forward again on resume. */
    pause(p) { paused = !!p; if (trim) { const t = now(), g = trim.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(p ? Math.pow(10, PAUSED_DB / 20) : 1, t + .3); } },
    /** The run is left (back to the camp): the music stops. */
    leave() { live.clear(); downBig = new Set(); wanted = null; if (music) music.stop(); },

    /* ---------- the build ---------- */
    cast(id, element, evolved, pan = 0) {
      if (!alive()) return false;
      const c = takeCur(e => (e.type === 'cast' && e.id === id) || (e.type === 'generalSkill' && e.general === id)); if (c) pan = c.pan;
      const t = now(), since = t - (lastCast.get(id) ?? -9);
      density *= Math.exp(-(t - densityAt) * 1.2); densityAt = t; density += 1;
      if (since < .09 || castVoices >= CAST_VOICES) return false;
      lastCast.set(id, t);
      const duckK = Math.min(1, .45 + since / .45 * .55), thin = 1 / (1 + Math.max(0, density - 3) / 5);
      voice(element)(duckK * thin, degree(id), !!evolved, {...castOpts, pan});
      return true;
    },
    /** A boss's spoil works. Its own budget, and no spoil twice within 0.25 s. */
    spoilStrike(id, pan = 0) {
      if (!alive()) return false; const t = now(), key = 'spoil:' + id;
      if (t - (lastCast.get(key) ?? -9) < .25 || spoilSources >= SPOIL_SOURCES) return false;
      lastCast.set(key, t); const thin = 1 / (1 + Math.max(0, density - 3) / 6);
      (SPOIL[id] || SPOIL.changeForm)(thin, {bus: 'cast', kind: 'spoil', pan}); return true;
    },
    skill(id, element, rank = 2) {
      if (!alive()) return false;
      const c = takeCur(e => e.type === 'squadSkill' && e.troop === id), pan = c ? c.pan : 0;
      const t = now(), key = 'skill:' + id;
      if (t - (lastCast.get(key) ?? -9) < .33 || castVoices >= CAST_VOICES) return false;
      lastCast.set(key, t); const thin = 1 / (1 + Math.max(0, density - 3) / 5), o = {...castOpts, pan};
      for (const at of [0, .09]) play('drum', 80, {gain: .26 * thin, at, ...o, rate: vary(1, .03)});
      voice(element)(thin, degree(id), rank >= 4, o);
      if (rank >= 5) play('bell', pent(15), {gain: .1 * thin, at: .1, ...o});
      return true;
    },
    resonance() { play('chime', pent(10), {gain: .16}); play('chime', pent(13), {gain: .14, at: .12}); },
    evolve(element) {
      if (takeCur(e => e.type === 'merge')) return api.merge(element);
      duck(5, .8, 1);
      play('drum', 52, {gain: .45, bus: 'moment'}); [0, 2, 4].forEach((d, i) => play('bell', pent(5 + d), {gain: .22, at: .04 + i * .09, bus: 'moment'}));
      play('bell', pent(-5), {gain: .3, bus: 'moment'}); [12, 14, 16].forEach((d, i) => play('chime', pent(d), {gain: .12, at: .35 + i * .08, bus: 'moment'}));
      voice(element)(1.2, 0, true, {bus: 'moment'});
    },
    /** 合璧: two evolved treasures become one. The evolution's figure twice, the second a fifth higher, on one drum. */
    merge(element) {
      duck(7, 1.1, 1.1);
      play('drum', 52, {gain: .5, bus: 'moment'}); play('drum', 52, {gain: .4, at: .28, bus: 'moment'}); play('bellDark', pent(-5), {gain: .35, bus: 'moment'});
      [0, 2, 4].forEach((d, i) => play('bell', pent(5 + d), {gain: .2, at: .04 + i * .08, bus: 'moment'}));
      [3, 5, 7].forEach((d, i) => play('bell', pent(5 + d), {gain: .2, at: .32 + i * .08, bus: 'moment'}));
      [12, 13, 14, 15, 17].forEach((d, i) => play('chime', pent(d), {gain: .11, at: .6 + i * .06, bus: 'moment'}));
      voice(element)(1.2, 3, true, {bus: 'moment', at: .3});
    },
    general(element, back) {
      const k = back ? .55 : 1;
      play('horn', [pent(-2), .45, .8], {gain: .32 * k, bus: 'moment'}); play('horn', [pent(1), .9, .9], {gain: .34 * k, at: .42, bus: 'moment'});
      if (!back) { play('drum', 52, {gain: .4, at: .42, bus: 'moment'}); voice(element)(1, 3, true, {bus: 'moment', at: .45}); }
    },
    /** A general withdraws: the 钲 that calls men back (鸣金收兵). */
    withdraw() { play('zheng', 520, {gain: .35}); play('zheng', 520, {gain: .22, at: .28}); },
    trueForm(element) {
      if (takeCur(e => e.type === 'spoil')) return;            // the page's old call for a spoil: the event has voiced it
      const c = takeCur(e => e.type === 'trueForm'), feat = c && FEATS[c.e.general];
      if (feat) feat(element); else trueFormDefault(element);
    },
    /** A boss's spoil is the hero's (the herald scroll unrolls): paper, a deep bell, the bells descending as it opens, a
        great drum under its last fold; horns for a great boss's. */
    spoil(big) {
      duck(8, big ? 2.4 : 1.8, 1.2);
      play('paper', undefined, {gain: .25, rate: .5, bus: 'moment'}); play('wind', undefined, {gain: .15, bus: 'moment'});
      play('bellDark', pent(-5), {gain: .45, at: .05, bus: 'moment'});
      [12, 10, 9, 7, 5].forEach((d, i) => play('bell', pent(d), {gain: .2, at: .25 + i * .12, bus: 'moment'}));
      play('drum', 52, {gain: .5, at: .9, bus: 'moment'});
      if (big) { play('horn', [pent(-3), 1.8, 1], {gain: .3, at: .9, bus: 'moment'}); play('horn', [pent(0), 1.6, 1], {gain: .25, at: 1.0, bus: 'moment'}); }
    },

    /* ---------- pickups and the offer ---------- */
    pickup(size = 0) {
      if (!alive()) return; const t = now(); if (t - pickAt < .045) return;
      streak = t - streakAt < .34 ? Math.min(streak + 1, 14) : 0; streakAt = pickAt = t;
      play('chime', pent(10 + (streak % 10)), {gain: (.07 + size * .03) / (1 + density / 10), len: .25 + size * .1});
    },
    peach() { if (takeCur(e => e.type === 'pickup' && e.kind === 'antidote')) return voiceAntidote(); play('harm', pent(10), {gain: .15}); play('harm', pent(12), {gain: .13, at: .12}); play('xun', [pent(8), .35], {gain: .06, at: .05}); },
    lodestone() { for (let i = 0; i < 8; i++) play('chime', pent(9 + i), {gain: .12, at: i * .04, len: .5}); },
    chest() { play('wood', 300, {gain: .4}); play('drum', 80, {gain: .25}); [12, 14, 15, 17].forEach((d, i) => play('bell', pent(d), {gain: .14, at: .1 + i * .07})); },
    levelUp() { [5, 7, 8, 10].forEach((d, i) => play('bell', pent(d) * 2, {gain: .16, at: i * .07})); play('drum', 80, {gain: .2, at: .21}); },
    slip() { play('paper', undefined, {gain: .18, rate: vary(1, .1)}); },
    take(element) { voice(element)(1.1, 5, true, {bus: 'sfx'}); play('drum', 80, {gain: .32}); },
    reroll() { for (let i = 0; i < 3; i++) play('paper', undefined, {gain: .14, rate: 1.1 - i * .1, at: i * .06}); },
    banish() { play('whoosh', undefined, {gain: .2, rate: .6}); play('wood', 150, {gain: .3, at: .05}); },
    refuse(force) { if (!force && takeCur(e => e.type === 'lightTaken')) return; play('wood', 180, {gain: .3}); },

    /* ---------- arrivals and the campaign ---------- */
    /** A named foe arrives: three strokes of the great drum, quickening; a low horn that bends down; the lowest bell.
        Once in 2.5 s, so a host that lands together (梅山七怪) is announced once. */
    named(last) {
      if (!alive()) return; const t = now(); if (t - namedAt < 2.5) return; namedAt = t;
      duck(6, 1.8, 1);
      [0, .42, .7].forEach((at, i) => play('drum', 52, {gain: .55 + i * .05, at, bus: 'moment'}));
      play('horn', [last ? pent(-4) : pent(-3), 1.5, .9], {gain: .32, at: .95, bus: 'moment', bend: -1.5});
      play('bellDark', last ? pent(-6) : pent(-5), {gain: .4, at: .95, bus: 'moment'});
    },
    elite() { play('horn', [pent(-3), .8, .7], {gain: .28, bus: 'alert'}); },
    boss() { play('horn', [pent(-4), 1, .8], {gain: .3, bus: 'alert'}); play('horn', [pent(-1), 1.4, .9], {gain: .3, at: .6, bus: 'alert'}); play('drum', 52, {gain: .5, at: .6, bus: 'alert'}); },
    stretch: i => stretchCall(i),
    march() { cue('march'); },
    rest(r) { if (!music) return; if (r) { live.clear(); cue('rest'); } else { cue(music.stretchCue); setBoss(); } },
    bossArrives(tier) { live.set('page:' + tier, tier); setBoss(); },
    bossDown: tier => bossDownCall(tier),
    bossPhase() { play('drum', 52, {gain: .5, bus: 'alert'}); play('drum', 52, {gain: .4, at: .12, bus: 'alert'}); play('bellDark', pent(-4), {gain: .35, at: .12, bus: 'alert'}); if (music) music.lift(); },
    enrage() { drumRoll(); play('horn', [pent(1), .6, 1], {gain: .25, at: .5, bus: 'alert'}); play('horn', [pent(4), .8, 1], {gain: .3, at: .3, bus: 'alert'}); if (music) music.lift(); },
    /** Hemmed in. The page also calls it after a boss's phase or rage: then the event has voiced it already. */
    encircle(force) { if (!force && takeCur(e => e.type === 'bossPhase' || e.type === 'enrage')) return; drumRoll(); play('horn', [pent(1), .6, 1], {gain: .25, at: .5, bus: 'alert'}); },
    /** A gate opens: a rumble, the bar's knock, a drum. 朝歌's own gate, after 袁洪 falls, is the great one: it groans
        open between three strokes of the great drum, slowing, and the lowest bell. */
    gateOpen(great) {
      if (!great) { play('rumble', undefined, {gain: .4}); play('wood', 90, {gain: .35, at: .1}); play('drum', 52, {gain: .35, at: .3}); return; }
      duck(10, 3, 1.5);
      play('groan', undefined, {gain: .42, bus: 'moment'}); play('wood', 90, {gain: .4, bus: 'moment'});
      [0, .7, 1.6].forEach((at, i) => play('drum', 52, {gain: .5 - i * .05, at, bus: 'moment'}));
      play('bellDark', pent(-6), {gain: .45, at: 1.6, bus: 'moment'}); play('horn', [pent(-3), 2, .7], {gain: .26, at: 1.7, bus: 'moment', bend: -1});
    },
    /** Zhou's guard changes: a drum roll and the horn call. */
    guards() { drumRoll(.7); play('horn', [pent(-2), .5, .9], {gain: .26, at: .5, bus: 'moment'}); play('horn', [pent(1), .9, 1], {gain: .28, at: .9, bus: 'moment'}); },
    landmark(pan = 0) { play('bell', pent(12), {gain: .14, pan}); play('bell', pent(14), {gain: .1, at: .12, pan}); },
    rear(pan = 0) { play('drum', 80, {gain: .3, pan, bus: 'alert'}); play('drum', 80, {gain: .22, at: .07, pan, bus: 'alert'}); },
    /** The remnant routs (after 闻仲, after 袁洪): the 钲 calls Shang back (鸣金收兵, struck three times as in a defeat, but
        theirs), then Zhou's drums quicken after them and the horn rises: the field is won. */
    rout() {
      duck(6, 1.6, 1);
      [0, .45, .9].forEach((at, i) => play('zheng', 520, {gain: .32 - i * .05, at, bus: 'moment'}));
      [1.2, 1.45, 1.62, 1.75, 1.85, 1.93, 2].forEach((at, i) => play('drum', 80, {gain: .22 + i * .04, at, bus: 'moment'}));
      play('drum', 52, {gain: .5, at: 2.1, bus: 'moment'}); play('horn', [pent(1), .6, 1], {gain: .26, at: 2.1, bus: 'moment'}); play('horn', [pent(3), 1.4, 1], {gain: .28, at: 2.6, bus: 'moment'});
    },
    /** 梅山七怪 land with 袁洪 (after his own arrival's drums): the demons' roar, low horns bending against each other over a
        rumble, and the lowest bell. */
    meishan() {
      duck(8, 2.5, 1.5); play('rumble', undefined, {gain: .3, at: .25, bus: 'moment'});
      [[-5, 0], [-4, .03], [-2, .06]].forEach(([d, det], i) => play('horn', [pent(d) * (1 + det), 2.2, .8], {gain: .16, at: .3 + i * .12, bus: 'moment', bend: -2}));
      play('bellDark', pent(-7), {gain: .38, at: 1.6, bus: 'moment'});
    },
    /** The Shang on the field are the last of their host: the Shang horn, once, low, and a great drum. */
    lastWave() { play('horn', [pent(-4), 1.6, .8], {gain: .24, at: .2, bus: 'moment', bend: -1}); play('drum', 52, {gain: .45, at: .2, bus: 'moment'}); },
    /** 袁洪's kin ward him: raised, a low beating hum; broken (the last demon falls), a bell bending down and stone chimes. */
    kinWard(broken) {
      if (!broken) { if (!alive() || now() - wardAt < 4) return; wardAt = now(); play('harm', pent(-1), {gain: .2, bus: 'alert'}); play('harm', pent(-1) * 1.02, {gain: .16, bus: 'alert'}); return; }
      play('bell', pent(5), {gain: .3, bus: 'alert', bend: -5}); [12, 10, 8].forEach((d, i) => play('chime', pent(d), {gain: .14, at: .15 + i * .07, bus: 'alert'}));
    },
    /** 纣王's host comes through the gate: the Shang horns, then the last cue. */
    host() { duck(8, 1.5, 1); play('horn', [pent(-4), 1.4, 1], {gain: .26, bus: 'moment'}); play('horn', [pent(-1), 1.8, 1], {gain: .24, at: .5, bus: 'moment'}); play('drum', 52, {gain: .48, at: .5, bus: 'moment'}); live.set('host', 'final'); setBoss(); },
    /** The second rank of the guard steps out of the gate: a drum roll and the Shang horn. */
    hostReserve() { drumRoll(.8); play('horn', [pent(-4), 1.2, .9], {gain: .24, at: .5, bus: 'moment'}); },
    /** A rank of the guard comes through: feet on the earth, at most six ranks a second. */
    sortie(pan = 0) { if (!alive()) return; const t = now(); if (t - sortieAt < .18) return; sortieAt = t; play('tramp', undefined, {gain: .16, rate: vary(1, .08), pan}); },
    /** The last of the guard falls: 纣王 stands alone. A low bell, a drum, the music lifts. */
    lastGuard() { play('drum', 52, {gain: .6, bus: 'moment'}); play('bellDark', pent(-6), {gain: .45, at: .05, bus: 'moment'}); [10, 9, 7, 5].forEach((d, i) => play('bell', pent(d), {gain: .18, at: .3 + i * .1, bus: 'moment'})); if (music) music.lift(); },

    /* ---------- danger ---------- */
    /** A telegraph on the ground: two hard knocks of wood, high, where nothing else in the mix sits. */
    warn() { if (!alive() || now() - warnAt < .33) return; const c = takeCur(e => e.type === 'warn'), pan = c ? c.pan * .6 : 0; warnAt = now(); for (const at of [0, .11]) play('wood', 1400, {gain: .9, at, pan, bus: 'alert'}); },
    hurt() {
      duck(6, .25, .4); duckCasts(5, .25, .35);
      play('drum', 70, {gain: .75, bus: 'alert', rate: vary(1)}); play('tear', undefined, {gain: .22, rate: .6, bus: 'alert'});
      play('chime', pent(4) * 1.059, {gain: .2, bus: 'alert', len: .3}); play('chime', pent(4), {gain: .2, bus: 'alert', len: .3});      // a minor second: a wince
    },
    block() { if (!alive() || now() - blockAt < .12) return; blockAt = now(); play('clash', 1300, {gain: .45, rate: vary(1, .08)}); },
    /** The afflictions, one sound each, on the alert bus: what has happened to the hero must be heard. */
    afflict(kind) {
      const A = {
        bleed: () => { play('tear', undefined, {gain: .3, bus: 'alert'}); [0, .12, .3].forEach((at, i) => play('drop', 500 - i * 60, {gain: .18, at: .1 + at, bus: 'alert'})); },
        held: () => { play('wood', 220, {gain: .35, bus: 'alert'}); play('qinSlideDown', pent(-3), {gain: .4, bus: 'alert', len: .8}); },
        soulLost: () => { play('harm', pent(12), {gain: .25, bus: 'alert', bend: -5}); play('harm', pent(12) * 1.03, {gain: .2, bus: 'alert', bend: -6}); play('zheng', 400, {gain: .12, rate: .6, bus: 'alert'}); },
        glare: () => { [0, 1, 2, 3].forEach((d, i) => play('chime', pent(14 + d), {gain: .14, at: i * .02, bus: 'alert'})); play('shing', undefined, {gain: .25, rate: 1.2, bus: 'alert'}); },
        lightTaken: () => { play('bell', pent(10), {gain: .3, bus: 'alert', bend: -7}); play('whoosh', undefined, {gain: .2, rate: .5, bus: 'alert'}); },
        cured: () => { play('harm', pent(10), {gain: .25}); play('harm', pent(13), {gain: .2, at: .1}); },
        freed: () => { play('qinSlideUp', pent(1), {gain: .3, len: .7}); },
      };
      A.dazzle = A.glare;
      (A[kind] || A.held)();
    },
    lightReturned() { play('bell', pent(6), {gain: .26, bend: 7}); play('chime', pent(13), {gain: .12, at: .3}); },
    unhorsed() { play('drum', 70, {gain: .5, bus: 'alert'}); play('tear', undefined, {gain: .16, rate: .45, bus: 'alert'}); play('horn', [pent(2), .4, .5], {gain: .14, at: .1, bus: 'alert', bend: -3}); },
    remount() { play('horn', [pent(3), .35, .9], {gain: .16}); for (let i = 0; i < 3; i++) play('hoof', 140, {gain: .14, at: .05 + i * .08}); },
    /** A boss turns to wind, to stone, or back; goes under the earth; comes up. */
    transform(form, pan = 0) { if (form === 'wind') play('wind', undefined, {gain: .3, rate: 1.2, pan, bus: 'alert'}); else if (form === 'stone') { play('chime', pent(-1), {gain: .35, pan, bus: 'alert'}); play('drumSoft', 70, {gain: .3, pan, bus: 'alert'}); } else play('whoosh', undefined, {gain: .24, rate: .8, pan, bus: 'alert'}); },
    burrow(pan = 0) { play('rumble', undefined, {gain: .35, pan, bus: 'alert'}); },
    emerge(pan = 0) { play('rumble', undefined, {gain: .3, rate: 1.3, pan, bus: 'alert'}); play('drum', 52, {gain: .45, pan, bus: 'alert'}); },
    fall() { duck(12, 2, 2); play('drum', 52, {gain: .6, bus: 'alert'}); play('bellDark', pent(-6), {gain: .45, at: .1, bus: 'alert'}); play('horn', [pent(-3), 2, .8], {gain: .3, at: .4, bus: 'alert', bend: -3}); },
    won() { live.clear(); if (music && ctx) music.play('won'); },
    lost() { live.clear(); if (music && ctx) music.play('lost'); },

    /* ---------- the hero ---------- */
    dash() { play('whoosh', undefined, {gain: .3}); for (let i = 0; i < 4; i++) play('hoof', 140, {gain: .18, at: .02 + i * .06, rate: vary(1, .1)}); },
    cry(start) { if (start) { play('horn', [pent(0), .3, .9], {gain: .15}); play('horn', [pent(3), .5, 1], {gain: .16, at: .18}); } else play('horn', [pent(1), .5, .5], {gain: .08, bend: -2}); },
    trample() { if (!alive() || now() - trampleAt < .07) return; trampleAt = now(); play('drum', 70, {gain: .25, rate: vary(1, .1)}); },
    /** A foe falls: a short low thup, at most twelve a second, fainter when many treasures sound. An elite: a drum and a bell. */
    kill(elite) {
      if (!alive()) return; if (elite) { play('drum', 52, {gain: .4}); play('bell', pent(3), {gain: .1}); return; }
      if (now() - killAt < .085) return; killAt = now(); play('thup', undefined, {gain: .16 / (1 + density / 6), rate: vary(1, .2)});
    },
    /** Hoofbeats that follow the horse: `speed` in px/s against `top`. Also where the music learns how busy the field is, if the page does not say. */
    hooves(speed, top, dt) {
      if (!alive()) return;
      if (music && ctx && now() - crowdAt > 2) { const t = now(); music.setIntensity(clamp(kills * Math.exp(-(t - killsAt) * .5) / 30 + (live.size ? .3 : 0), 0, 1)); }
      if (speed < 30) return;
      const frac = Math.min(1, speed / top), before = stride, after = before + speed * dt / (110 + 120 * frac); stride = after;
      for (const b of frac < .5 ? [0, .5] : [0, .14, .28, .46]) if (Math.floor(before - b) !== Math.floor(after - b)) play('hoof', 140, {gain: .05 + frac * .06, rate: vary(1, .12)});
    },
    afflictions: ['bleed', 'held', 'soulLost', 'glare', 'dazzle', 'lightTaken', 'cured', 'freed'],
  };
  /** The antidote is taken (bleeding stops at once): a cool rising harmonic and a 埙 note, distinct from the peach. */
  function voiceAntidote() { play('harm', pent(8), {gain: .16}); play('harm', pent(11), {gain: .14, at: .1}); play('xun', [pent(13), .4], {gain: .07, at: .06}); }
  function drumRoll(k = 1) { for (let i = 0; i < 6; i++) play('drum', 80, {gain: (.25 + i * .04) * k, at: i * .09, bus: 'alert'}); }
  /** A stretch begins: a drum roll, the great drum, horns, a low bell on the stretch's tonic; its music starts. */
  function stretchCall(i) {
    duck(6, 2, 1);
    [0, .18, .3, .4, .48, .55].forEach((at, k) => play('drum', 80, {gain: .2 + k * .05, at, bus: 'moment'}));
    play('drum', 52, {gain: .6, at: .62, bus: 'moment'}); play('horn', [pent(-3), .5, .9], {gain: .32, at: .62, bus: 'moment'}); play('horn', [pent(1), 1.5, 1], {gain: .34, at: 1.1, bus: 'moment'});
    play('bell', pent(-5 + [4, 1, 3][i % 3]), {gain: .35, at: .62, bus: 'moment'});
    if (!collect) { if (i === 0) { live.clear(); downBig = new Set(); } cue(['xiqi', 'dongzheng', 'zhaoge'][i] || 'zhaoge'); }
  }
  /** A boss falls: the low bell, a drum, the chimes descending; horns for a great one. 纣王's fall is the victory's. */
  function bossDownCall(tier) {
    if (!collect) setBoss();
    if (tier === 'final') return;
    duck(8, 1.4, 1.2);
    play('bellDark', pent(-5), {gain: .5, bus: 'moment'}); play('drum', 52, {gain: .55, bus: 'moment'});
    [12, 11, 10, 9, 8, 7].forEach((d, i) => play('chime', pent(d), {gain: .13, at: .2 + i * .07, bus: 'moment'}));
    if (tier !== 'small') { play('horn', [pent(0), 1.2, 1], {gain: .3, at: .3, bus: 'moment'}); play('horn', [pent(3), 1.6, 1], {gain: .28, at: .9, bus: 'moment'}); }
  }
  music = createMusic(api);
  if (!offline && !shared) api.prewarm();      // in the game: the bank renders from page load, in a worker, long before the first gesture
  return api;
}
