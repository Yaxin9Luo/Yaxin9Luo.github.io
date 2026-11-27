// The boss themes for the stage-final duels: original music, written for this game. Each theme has an entrance, a
// loop for each phase (each lifts on the last), a held beat that carries the fight from one phase into the next, and a
// fall. They play on the duel bus, louder than the field music and in a larger hall.
//
// Pitch: MIDI note numbers, in A natural minor (A B C D E F G). That holds the five notes the treasures and the field
// music play (C D E G A), so every cast stays in key; F and B are the two tones the pentatonic lacks, and they give the
// theme its weight (the 曾侯乙 bells show the Zhou bronze could sound all twelve).
//
// Instruments: hornSec (a section of horns: the melody and the low brass), yu (竽: the held chords), choir (men's
// voices on a vowel: the army's chant), drumMass (鼓阵: five great drums as one), drum (single war drums), nao (铙: the
// great bronze, on the strongest beats), se (瑟: the driving ostinato), bell (编钟: the answer and the doubling).

/** "step:midi:len ..." → [[step, midi, len]] (len in sixteenths). */
const part = s => s.trim().split(/\s+/).map(w => { const [st, n, l] = w.split(':').map(Number); return [st, n, l || 4]; });
/** One bar of hits, "x" full, "o" softer: → [[step, 0, 2, accent]], repeated over `bars`. */
const hits = (s, bars = 1) => { const one = s.replace(/\s/g, '').split('').flatMap((c, i) => c === 'x' ? [[i, 0, 2, 1]] : c === 'o' ? [[i, 0, 2, .55]] : []); return Array.from({length: bars}, (_, b) => one.map(([st, n, l, a]) => [st + 16 * b, n, l, a])).flat(); };
/** Chords held a bar each: [[midi...], ...] → notes at each bar's first step. */
const held = (chords, len = 16) => chords.flatMap((c, b) => c.map(m => [b * 16, m, len]));
/** The 瑟 ostinato, 3-3-2 in eighths and sixteenths: root, root, fifth on each bar's chord. */
const drive = roots => roots.flatMap((r, b) => [[0, r], [3, r], [6, r + 7], [8, r], [11, r], [14, r + 7]].map(([st, m]) => [b * 16 + st, m, 2]));

/* ---------- 闻仲 · 雷部太师 ---------- */
// The Grand Tutor of the thunder ministry, the last loyal pillar of Shang: the theme is a march of the old guard, proud
// and grieving. A minor, 140. Its head (A, up to E, stepping down to C and back to D) is the motif that returns in the
// entrance, in each phase, and turned to C major in his fall.
const Am = [57, 60, 64], F = [53, 57, 60], G = [55, 59, 62], Dm = [57, 62, 65], Em = [55, 59, 64], E = [52, 59, 64];
const A_CHORDS = [Am, Am, F, G, Am, F, G, Am], A_ROOTS = [45, 45, 41, 43, 45, 41, 43, 45];
const B_CHORDS = [Dm, Am, F, G, Dm, Am, Em, E], B_ROOTS = [38, 45, 41, 43, 38, 45, 40, 40];
const THEME_A = part(`0:69:6 6:76:2 8:74:2 10:72:2 12:74:4   16:76:12 28:72:2 30:74:2   32:77:6 38:76:2 40:74:4 44:72:4   48:74:8 56:71:4 60:67:4
                      64:69:6 70:76:2 72:74:2 74:72:2 76:74:4   80:81:8 88:79:4 92:77:4   96:79:6 102:77:2 104:76:4 108:74:4   112:72:2 114:71:2 116:69:12`);
const THEME_B = part(`0:74:4 4:77:4 8:81:6 14:79:2   16:76:8 24:72:4 28:74:4   32:72:4 36:77:4 40:76:6 46:74:2   48:74:12 60:79:4
                      64:81:4 68:79:4 72:77:6 78:76:2   80:76:8 88:72:4 92:69:4   96:71:6 102:72:2 104:74:4 108:76:4   112:76:16`);
/** The bells answer the horns in the bars where the melody holds: the chord climbing, an octave and more above. */
const answer = (chords, bars) => bars.flatMap(b => chords[b].map(m => m + 12).concat([chords[b][0] + 24]).map((m, i) => [b * 16 + 8 + i * 2, m, 2]));
const BELLS_B = answer(B_CHORDS, [1, 3, 5, 7]);
const wenzhong = {
  bpm: 140,
  phases: {
    1: {layers: [
      {inst: 'drumMass', f: 48, gain: .5, bars: 1, notes: hits('x.....x.x.....x.')},
      {inst: 'drum', f: 80, gain: .26, bars: 1, notes: hits('..o.x..o..o.x.oo')},
      {inst: 'drum', f: 120, gain: .12, bars: 1, notes: hits('o.o.o.o.o.o.o.o.')},
      {inst: 'se', gain: .2, bars: 8, notes: drive(A_ROOTS.map(r => r + 12))},
      {inst: 'yu', gain: .13, bars: 8, notes: held(A_CHORDS)},
      {inst: 'hornSec', gain: .2, bars: 8, notes: A_ROOTS.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .3, bars: 8, notes: THEME_A},
    ]},
    2: {layers: [
      {inst: 'drumMass', f: 48, gain: .5, bars: 1, notes: hits('x..x..x.x..x..x.')},
      {inst: 'drum', f: 80, gain: .26, bars: 1, notes: hits('.ooxo.oxoo.xo.ox')},
      {inst: 'drum', f: 120, gain: .12, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .2, bars: 8, notes: drive(B_ROOTS.map(r => r + 12))},
      {inst: 'choir', gain: .2, bars: 8, notes: held(B_CHORDS)},
      {inst: 'yu', gain: .09, bars: 8, notes: held(B_CHORDS)},
      {inst: 'hornSec', gain: .2, bars: 8, notes: B_ROOTS.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .3, bars: 8, notes: THEME_B},
      {inst: 'bell', gain: .1, bars: 8, notes: BELLS_B},
    ]},
    3: {layers: [
      {inst: 'nao', f: 55, gain: .32, bars: 4, notes: [[0, 0, 2, 1]]},
      {inst: 'drumMass', f: 48, gain: .52, bars: 1, notes: hits('x..x..x.x.x.x..x')},
      {inst: 'drum', f: 80, gain: .28, bars: 1, notes: hits('.ooxo.oxoo.xoxox')},
      {inst: 'drum', f: 120, gain: .13, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .2, bars: 8, notes: drive(A_ROOTS.map(r => r + 12))},
      {inst: 'choir', gain: .22, bars: 8, notes: held(A_CHORDS)},
      {inst: 'yu', gain: .09, bars: 8, notes: held(A_CHORDS)},
      {inst: 'hornSec', gain: .22, bars: 8, notes: A_ROOTS.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .32, bars: 8, notes: THEME_A},
      {inst: 'bell', gain: .11, bars: 8, notes: THEME_A.map(([st, m, l]) => [st, m + 12, l])},
    ]},
  },
  /** He arrives, timed to the page's title card (duelCard): the chant rises under the band's sweep (0 s); the bronze
      and the massed drums on the seal (0.95 s); a drum and the low horns as the card clears (2.0 s); the motif's
      head on the horns; a roll; phase 1. The seal's and the clear's strokes are marked (M.card), so a card that
      arrives at another moment moves them there. */
  intro(M, t0) {
    const b = 60 / this.bpm * 4, s = b / 16;
    for (const m of [45, 52, 57]) M.n('choir', m, t0, .24, 2 * b);
    M.n('hornSec', 45, t0, .16, 1.9);
    for (let i = 0; i < 8; i++) M.hit('drum', 80, t0 + i * .1, .08 + i * .03);
    M.card('seal', .95, [['hit', 'nao', 55, .55], ['hit', 'drumMass', 48, .6]]);
    M.card('clear', 2.0, [['hit', 'drumMass', 48, .55], ['note', 'hornSec', 45, .26, 1.3], ['note', 'hornSec', 52, .18, 1.3]]);
    for (const [st, m, l] of part('0:69:6 6:76:2 8:74:2 10:72:2 12:74:4')) M.n('hornSec', m, t0 + 2 * b + st * s, .32, l * s);
    for (const st of [0, 6, 8, 14]) M.hit('drumMass', 48, t0 + 2 * b + st * s, .5);
    for (let i = 0; i < 16; i++) M.hit('drum', 80, t0 + 3 * b + i * s, .1 + i * .024);
    M.hit('drumMass', 48, t0 + 3 * b + 12 * s, .6); M.n('hornSec', 76, t0 + 3 * b, .28, b); for (const m of E) M.n('yu', m, t0 + 3 * b, .12, b);
    return 4 * b;
  },
  /** The held beat between phases: the bronze, the chant held on the next phase's first chord, a roll into it. */
  held(M, t0, next) {
    const b = 60 / this.bpm * 4, s = b / 16, chord = next === 2 ? B_CHORDS[0] : A_CHORDS[0], root = next === 2 ? B_ROOTS[0] : A_ROOTS[0];
    M.hit('nao', 55, t0, .55); M.hit('drumMass', 48, t0, .65);
    for (const m of chord) M.n('choir', m, t0, .26, 2 * b);
    M.n('hornSec', root, t0, .22, 2 * b);
    for (let i = 0; i < 16; i++) M.hit('drum', 80, t0 + b + i * s, .1 + i * .026);
    M.hit('drumMass', 48, t0 + b + 8 * s, .5); M.hit('drumMass', 48, t0 + b + 12 * s, .55);
    if (next === 3) { M.hit('nao', 49, t0 + b, .45); M.n('hornSec', 76, t0 + b + 8 * s, .28, 4 * s); M.n('hornSec', 79, t0 + b + 12 * s, .3, 4 * s); }
    return 2 * b;
  },
  /** He falls: the bronze, three slow strokes, the chant moving from A minor to C major, the motif in C, slow, on the
      horns; the bells come down; the last bronze. About nine seconds. */
  fall(M, t0) {
    M.hit('nao', 49, t0, .6); M.hit('drumMass', 43, t0, .7); M.hit('drumMass', 43, t0 + 1.3, .5); M.hit('drumMass', 43, t0 + 2.6, .45);
    for (const m of Am) M.n('choir', m, t0, .24, 2.5);
    for (const m of [48, 60, 64, 67]) M.n('choir', m, t0 + 2.6, .26, 4);
    for (const m of [60, 64, 67]) M.n('yu', m, t0 + 2.6, .11, 4);
    let t = t0 + 2.6; for (const [m, d] of [[72, .9], [79, .45], [77, .45], [76, .45], [74, .45], [72, 2.4]]) { M.n('hornSec', m, t, .3, d); t += d; }
    [84, 81, 79, 76, 72].forEach((m, i) => M.n('bell', m, t0 + 6 + i * .2, .13, 1));
    M.hit('nao', 65.4, t0 + 6.2, .4); M.n('hornSec', 48, t0 + 5.6, .2, 3);
    return 9.5;
  },
};

/* ---------- shared for the three later themes ---------- */
/** The white-note collection's next note up: a melody moved one step within the mode (纣王's theme turned to minor). */
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const stepUp = m => { const o = Math.floor(m / 12), i = WHITE.indexOf(m % 12); return i < 6 ? o * 12 + WHITE[i + 1] : (o + 1) * 12; };
/** A run of chimes climbing over a bar: the five lights, the fan of a tail. */
const run = (bars, notes, every = 2) => bars.flatMap(b => notes.map((m, i) => [b * 16 + i * every, m, 2]));
/** The standard entrance's marked strokes: the bronze and the massed drums on the seal; a drum and low horns as the card clears. */
const cardStrokes = (M, naoF, roots) => {
  M.card('seal', .95, [['hit', 'nao', naoF, .55], ['hit', 'drumMass', 48, .6]]);
  M.card('clear', 2.0, [['hit', 'drumMass', 48, .55], ...roots.map((m, i) => ['note', 'hornSec', m, i ? .18 : .26, 1.3])]);
};
/** The common held beat: bronze, drums, the chant on the next phase's first chord, the low root, a roll into it. */
const heldBeat = (T, M, t0, chord, root, choirInst = 'choir', extra = null) => {
  const b = 60 / T.bpm * 4, s = b / 16;
  M.hit('nao', 55, t0, .55); M.hit('drumMass', 48, t0, .65);
  for (const m of chord) M.n(choirInst, m, t0, .26, 2 * b);
  M.n('hornSec', root, t0, .22, 2 * b);
  for (let i = 0; i < 16; i++) M.hit('drum', 80, t0 + b + i * s, .1 + i * .026);
  M.hit('drumMass', 48, t0 + b + 8 * s, .5); M.hit('drumMass', 48, t0 + b + 12 * s, .55);
  if (extra) extra(b, s);
  return 2 * b;
};

/* ---------- 孔宣 · 五色神光 ---------- */
// The peacock of the five lights, proud and otherworldly: D Dorian (its raised sixth, B, is the light in it), 150.
// The 竽 and the bells carry the tune, not the horns; chimes run like light off feathers. Phase 3 is the peacock
// itself: the tune an octave up on the bells, the chant on 'o', the tail's five-note fan every bar.
const Dm_ = [57, 62, 65], C_ = [55, 60, 64], G_ = [55, 59, 62], F_ = [53, 57, 60], Am_ = [57, 60, 64];
const K_A = [Dm_, C_, G_, Dm_, F_, C_, G_, Am_], K_AR = [38, 36, 43, 38, 41, 36, 43, 45];
const K_B = [F_, G_, Am_, Am_, F_, G_, C_, C_], K_BR = [41, 43, 45, 45, 41, 43, 36, 36];
const K_MEL_A = part(`0:74:3 3:77:3 6:81:4 10:79:2 12:77:2 14:76:2   16:76:6 22:72:2 24:74:4 28:76:4   32:79:3 35:83:3 38:81:4 42:79:2 44:74:4   48:77:12 60:76:2 62:74:2
                      64:72:3 67:77:3 70:81:4 74:84:2 76:81:4   80:79:6 86:76:2 88:72:4 92:74:4   96:71:4 100:74:4 104:79:4 108:83:4   112:81:8 120:76:4 124:74:4`);
const K_MEL_B = part(`0:77:8 8:81:4 12:84:4   16:83:8 24:79:4 28:81:4   32:76:6 38:77:2 40:79:4 44:81:4   48:76:16
                      64:84:6 70:83:2 72:81:4 76:79:4   80:83:8 88:86:4 92:84:4   96:84:6 102:83:2 104:79:4 108:76:4   112:74:12 124:76:4`);
const FAN = [74, 76, 79, 81, 83];      // the five lights: D E G A B, climbing
const kongxuan = {
  bpm: 150,
  phases: {
    1: {layers: [
      {inst: 'drumMass', f: 48, gain: .45, bars: 1, notes: hits('x.......x..x....')},
      {inst: 'drum', f: 80, gain: .24, bars: 1, notes: hits('..x...x...x...xx')},
      {inst: 'drum', f: 120, gain: .12, bars: 1, notes: hits('o.oo.o.oo.o.oo.o')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(K_AR.map(r => r + 12))},
      {inst: 'hornSec', gain: .18, bars: 8, notes: K_AR.map((r, b) => [b * 16, r, 16])},
      {inst: 'yu', gain: .12, bars: 8, notes: held(K_A)},
      {inst: 'yu', gain: .26, bars: 8, notes: K_MEL_A},
      {inst: 'bell', gain: .1, bars: 8, notes: K_MEL_A.map(([st, m, l]) => [st, m, l])},
      {inst: 'chime', gain: .07, bars: 8, notes: run([3, 7], FAN, 1)},
    ]},
    2: {layers: [
      {inst: 'drumMass', f: 48, gain: .48, bars: 1, notes: hits('x..x....x..x..x.')},
      {inst: 'drum', f: 80, gain: .25, bars: 1, notes: hits('.ox.o.x.oox.o.xo')},
      {inst: 'drum', f: 120, gain: .12, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(K_BR.map(r => r + 12))},
      {inst: 'hornSec', gain: .2, bars: 8, notes: K_BR.map((r, b) => [b * 16, r, 16])},
      {inst: 'choirO', gain: .18, bars: 8, notes: held(K_B)},
      {inst: 'yu', gain: .26, bars: 8, notes: K_MEL_B},
      {inst: 'bell', gain: .11, bars: 8, notes: K_MEL_B},
      {inst: 'chime', gain: .07, bars: 8, notes: run([0, 1, 2, 3, 4, 5, 6, 7], FAN.map(m => m + 12), 2)},
    ]},
    3: {layers: [
      {inst: 'nao', f: 62, gain: .3, bars: 4, notes: [[0, 0, 2, 1]]},
      {inst: 'drumMass', f: 48, gain: .5, bars: 1, notes: hits('x..x..x.x..x.x..')},
      {inst: 'drum', f: 80, gain: .27, bars: 1, notes: hits('.ox.o.xoo.xoo.xo')},
      {inst: 'drum', f: 120, gain: .13, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(K_AR.map(r => r + 12))},
      {inst: 'hornSec', gain: .22, bars: 8, notes: K_AR.map((r, b) => [b * 16, r, 16])},
      {inst: 'choirO', gain: .2, bars: 8, notes: held(K_A)},
      {inst: 'yu', gain: .24, bars: 8, notes: K_MEL_A},
      {inst: 'hornSec', gain: .2, bars: 8, notes: K_MEL_A.map(([st, m, l]) => [st, m - 12, l])},
      {inst: 'bell', gain: .12, bars: 8, notes: K_MEL_A.map(([st, m, l]) => [st, m + 12, l])},
      {inst: 'chime', gain: .08, bars: 8, notes: run([0, 1, 2, 3, 4, 5, 6, 7], FAN.map(m => m + 12), 1)},
    ]},
  },
  /** He rides down 金鸡岭: the five lights climb in the chimes over the chant, the seal, the clear, the tune's head on the 竽 and bells. */
  intro(M, t0) {
    const b = 60 / this.bpm * 4, s = b / 16;
    for (const m of [50, 57, 62]) M.n('choirO', m, t0, .22, 2 * b);
    FAN.forEach((m, i) => M.n('chime', m + 12, t0 + .1 + i * .12, .1, 1));
    cardStrokes(M, 62, [38, 45]);
    for (const [st, m, l] of part('0:74:3 3:77:3 6:81:4 10:79:2 12:77:2 14:76:2')) { M.n('yu', m, t0 + 2 * b + st * s, .3, l * s); M.n('bell', m, t0 + 2 * b + st * s, .12, 1); }
    for (const st of [0, 8, 11]) M.hit('drumMass', 48, t0 + 2 * b + st * s, .5);
    for (let i = 0; i < 16; i++) M.hit('drum', 120, t0 + 3 * b + i * s, .08 + i * .02);
    M.hit('drumMass', 48, t0 + 3 * b + 12 * s, .6); for (const m of G_) M.n('yu', m, t0 + 3 * b, .14, b);
    return 4 * b;
  },
  held(M, t0, next) { return heldBeat(this, M, t0, next === 2 ? K_B[0] : K_A[0], next === 2 ? K_BR[0] : K_AR[0], 'choirO', next === 3 ? (b, s) => FAN.forEach((m, i) => M.n('chime', m + 12, t0 + b + 8 * s + i * s, .12, 1)) : null); },
  /** Subdued and carried west (准提道人): no blow ends him. The lights fall like feathers, the chant opens to G, the tune slows on the 竽. */
  fall(M, t0) {
    M.hit('nao', 62, t0, .5); M.hit('drumMass', 43, t0, .55);
    for (const m of Dm_) M.n('choirO', m, t0, .22, 2.4);
    [86, 83, 81, 79, 76, 74, 71].forEach((m, i) => M.n('chime', m, t0 + .3 + i * .16, .1, 1));
    for (const m of [43, 55, 59, 62]) M.n('choirO', m, t0 + 2.4, .24, 4);
    for (const m of G_) M.n('yu', m, t0 + 2.4, .1, 4);
    let t = t0 + 2.4; for (const [m, d] of [[74, .8], [79, .5], [83, .5], [81, 1.6]]) { M.n('yu', m, t, .26, d); M.n('bell', m + 12, t, .1, 1); t += d; }
    M.hit('nao', 49, t0 + 6.2, .32);
    return 9;
  },
};

/* ---------- 袁洪 · 梅山 ---------- */
// The white ape of 梅山, trickster and shape-changer: E Phrygian (the half-step E–F is its snarl), 164, a riff on
// stabbing horns over wood and drums; phase 2 turns to the descending A–G–F–E of the same mode; phase 3, inside the
// 山河社稷图, the riff in full with the chant on 'o' held under it, as if the painted mountains sang.
const Em_ = [55, 59, 64], F2 = [53, 57, 60], G2 = [55, 59, 62], Am2 = [57, 60, 64];
const Y_A = [Em_, Em_, F2, Em_, Em_, F2, G2, Em_], Y_AR = [40, 40, 41, 40, 40, 41, 43, 40];
const Y_B = [Am2, G2, F2, Em_, Am2, G2, F2, Em_], Y_BR = [45, 43, 41, 40, 45, 43, 41, 40];
const Y_RIFF = part(`0:64:2 2:64:2 4:65:2 6:64:2 8:67:3 11:65:3 14:64:2   16:71:4 20:72:2 22:71:2 24:69:4 28:67:4   32:65:2 34:65:2 36:67:2 38:65:2 40:69:3 43:67:3 46:65:2   48:64:12 60:62:2 62:64:2
                     64:76:2 66:76:2 68:77:2 70:76:2 72:79:3 75:77:3 78:76:2   80:81:4 84:79:2 86:77:2 88:76:4 92:74:4   96:74:3 99:76:3 102:77:2 104:79:4 108:77:4   112:76:8 120:77:2 122:76:2 124:74:2 126:72:2`);
const Y_MEL_B = part(`0:69:6 6:72:2 8:71:4 12:69:4   16:67:8 24:71:4 28:74:4   32:72:6 38:71:2 40:69:4 44:65:4   48:64:8 56:65:2 58:64:2 60:65:2 62:67:2
                      64:81:6 70:79:2 72:77:4 76:76:4   80:74:8 88:79:4 92:77:4   96:77:4 100:76:4 104:74:4 108:72:4   112:71:4 116:72:4 120:71:8`);
const yuanhong = {
  bpm: 164,
  phases: {
    1: {layers: [
      {inst: 'drumMass', f: 48, gain: .48, bars: 1, notes: hits('x..x..x...x..x..')},
      {inst: 'drum', f: 80, gain: .25, bars: 1, notes: hits('..o.x.o...o.x.oo')},
      {inst: 'wood', f: 640, gain: .09, bars: 1, notes: hits('x.xx.x.xx.x.xx.x')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(Y_AR.map(r => r + 12))},
      {inst: 'hornSec', gain: .2, bars: 8, notes: Y_AR.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .3, bars: 8, notes: Y_RIFF},
    ]},
    2: {layers: [
      {inst: 'drumMass', f: 48, gain: .5, bars: 1, notes: hits('x..x..x.x..x..x.')},
      {inst: 'drum', f: 80, gain: .26, bars: 1, notes: hits('.ooxo.oxoo.xo.ox')},
      {inst: 'drum', f: 120, gain: .12, bars: 1, notes: hits('o.oo.oo.o.oo.oo.')},
      {inst: 'wood', f: 640, gain: .09, bars: 1, notes: hits('x.xx.x.xx.x.xx.x')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(Y_BR.map(r => r + 12))},
      {inst: 'choir', gain: .18, bars: 8, notes: held(Y_B)},
      {inst: 'hornSec', gain: .2, bars: 8, notes: Y_BR.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .3, bars: 8, notes: Y_MEL_B},
      {inst: 'bell', gain: .09, bars: 8, notes: answer(Y_B, [1, 3, 5, 7])},
    ]},
    3: {layers: [
      {inst: 'nao', f: 52, gain: .32, bars: 4, notes: [[0, 0, 2, 1]]},
      {inst: 'drumMass', f: 48, gain: .52, bars: 1, notes: hits('x..x..x.x.x.x..x')},
      {inst: 'drum', f: 80, gain: .27, bars: 1, notes: hits('.ooxo.oxoo.xoxox')},
      {inst: 'drum', f: 120, gain: .13, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(Y_AR.map(r => r + 12))},
      {inst: 'choirO', gain: .21, bars: 8, notes: held(Y_A)},
      {inst: 'yu', gain: .08, bars: 8, notes: held(Y_A)},
      {inst: 'hornSec', gain: .22, bars: 8, notes: Y_AR.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .32, bars: 8, notes: Y_RIFF},
      {inst: 'bell', gain: .11, bars: 8, notes: Y_RIFF.filter(([st]) => st % 4 === 0).map(([st, m]) => [st, m + 12, 2])},
    ]},
  },
  /** He comes down 梅山: the wood chatters, a low horn bends, the seal, the clear, the riff's first bar, a roll. */
  intro(M, t0) {
    const b = 60 / this.bpm * 4, s = b / 16;
    for (let i = 0; i < 12; i++) M.hit('wood', 640, t0 + i * .07, .04 + i * .008);
    for (const m of [40, 47, 52]) M.n('choir', m, t0, .2, 2 * b);
    cardStrokes(M, 52, [40, 47]);
    for (const [st, m, l] of part('0:64:2 2:64:2 4:65:2 6:64:2 8:67:3 11:65:3 14:64:2')) M.n('hornSec', m, t0 + 2 * b + st * s, .32, l * s);
    for (const st of [0, 3, 6, 10, 13]) M.hit('drumMass', 48, t0 + 2 * b + st * s, .5);
    for (let i = 0; i < 16; i++) M.hit('drum', 80, t0 + 3 * b + i * s, .1 + i * .024);
    M.hit('drumMass', 48, t0 + 3 * b + 12 * s, .6); M.n('hornSec', 65, t0 + 3 * b, .26, b);
    return 4 * b;
  },
  held(M, t0, next) { return heldBeat(this, M, t0, next === 2 ? Y_B[0] : Y_A[0], next === 2 ? Y_BR[0] : Y_AR[0], next === 3 ? 'choirO' : 'choir'); },
  /** 杨戬's scroll holds him and the blade takes his head: the riff cut off, one stroke of metal, the bronze, the chant
      on E falling to C, quiet. */
  fall(M, t0) {
    M.hit('nao', 52, t0, .6); M.hit('drumMass', 40, t0, .65);
    M.n('hornSec', 64, t0, .3, .25); M.n('hornSec', 65, t0 + .25, .3, .25);
    for (const m of Em_) M.n('choirO', m, t0 + .6, .24, 2.4);
    for (const m of [48, 55, 60, 64]) M.n('choirO', m, t0 + 3, .24, 4);
    for (const m of [60, 64, 67]) M.n('yu', m, t0 + 3, .1, 4);
    [76, 74, 72, 71, 67, 64].forEach((m, i) => M.n('bell', m, t0 + 3.4 + i * .2, .12, 1));
    M.hit('nao', 49, t0 + 6.4, .35);
    return 9;
  },
};

/* ---------- 纣王 · 帝辛 ---------- */
// The last king, the grandest and the last: G Mixolydian (its F natural is the old royal sound), 128, half-time and
// heavy, the tune on the horns with the chant on both vowels; phase 2, 垓心, hemmed in, turns to A minor; phase 3, 摘星楼
// burning, plays his royal tune moved one step up the same notes, so the king's theme comes back in A minor: the
// same music, ruined. He is not killed: he goes into the burning tower, and the victory waits for his fall to end.
const Gz = [55, 59, 62], Fz = [53, 57, 60], Cz = [55, 60, 64], Dmz = [57, 62, 65], Amz = [57, 60, 64], Emz = [55, 59, 64];
const Z_A = [Gz, Gz, Fz, Cz, Gz, Fz, Dmz, Gz], Z_AR = [43, 43, 41, 36, 43, 41, 38, 43];
const Z_B = [Amz, Fz, Gz, Emz, Amz, Fz, Dmz, Emz], Z_BR = [45, 41, 43, 40, 45, 41, 38, 40];
const Z_MEL = part(`0:67:8 8:74:4 12:71:4   16:72:6 22:71:2 24:69:4 28:67:4   32:69:8 40:72:4 44:77:4   48:76:12 60:74:4
                    64:79:8 72:74:4 76:71:4   80:77:6 86:76:2 88:74:4 92:72:4   96:74:6 102:72:2 104:69:4 108:65:4   112:67:16`);
const Z_MEL_B = part(`0:69:4 4:72:4 8:76:6 14:74:2   16:72:8 24:69:4 28:72:4   32:71:4 36:74:4 40:79:6 46:77:2   48:76:12 60:74:4
                      64:81:4 68:79:4 72:76:6 78:74:2   80:77:8 88:76:4 92:72:4   96:74:6 102:72:2 104:71:4 108:69:4   112:71:8 120:72:4 124:71:4`);
const Z_MEL_3 = Z_MEL.map(([st, m, l]) => [st, stepUp(m), l]);
const Z_3 = [Amz, Amz, Gz, Dmz, Amz, Gz, Emz, Amz], Z_3R = [45, 45, 43, 38, 45, 43, 40, 45];
const zhouwang = {
  bpm: 128,
  phases: {
    1: {layers: [
      {inst: 'nao', f: 49, gain: .26, bars: 4, notes: [[0, 0, 2, 1]]},
      {inst: 'drumMass', f: 43, gain: .55, bars: 1, notes: hits('x.......x...x...')},
      {inst: 'drum', f: 80, gain: .24, bars: 1, notes: hits('....x.......x.o.')},
      {inst: 'drum', f: 120, gain: .11, bars: 1, notes: hits('o.o.o.o.o.o.o.o.')},
      {inst: 'se', gain: .17, bars: 8, notes: drive(Z_AR.map(r => r + 12))},
      {inst: 'yu', gain: .12, bars: 8, notes: held(Z_A)},
      {inst: 'choirO', gain: .16, bars: 8, notes: held(Z_A.map(c => c.map(m => m - 12)))},
      {inst: 'hornSec', gain: .22, bars: 8, notes: Z_AR.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .32, bars: 8, notes: Z_MEL},
    ]},
    2: {layers: [
      {inst: 'drumMass', f: 43, gain: .55, bars: 1, notes: hits('x..x..x.x..x..x.')},
      {inst: 'drum', f: 80, gain: .27, bars: 1, notes: hits('.ooxo.oxoo.xo.ox')},
      {inst: 'drum', f: 120, gain: .13, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(Z_BR.map(r => r + 12))},
      {inst: 'choir', gain: .2, bars: 8, notes: held(Z_B)},
      {inst: 'hornSec', gain: .22, bars: 8, notes: Z_BR.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .32, bars: 8, notes: Z_MEL_B},
      {inst: 'bell', gain: .1, bars: 8, notes: answer(Z_B, [1, 3, 5, 7])},
    ]},
    3: {layers: [
      {inst: 'nao', f: 55, gain: .34, bars: 4, notes: [[0, 0, 2, 1]]},
      {inst: 'drumMass', f: 43, gain: .5, bars: 1, notes: hits('x..x..x.x..x..x.')},
      {inst: 'drum', f: 80, gain: .28, bars: 1, notes: hits('.ooxo.oxoo.xoxox')},
      {inst: 'drum', f: 120, gain: .14, bars: 1, notes: hits('oooooooooooooooo')},
      {inst: 'se', gain: .18, bars: 8, notes: drive(Z_3R.map(r => r + 12))},
      {inst: 'choir', gain: .2, bars: 8, notes: held(Z_3)},
      {inst: 'choirO', gain: .16, bars: 8, notes: held(Z_3.map(c => c.map(m => m - 12)))},
      {inst: 'yu', gain: .08, bars: 8, notes: held(Z_3)},
      {inst: 'hornSec', gain: .24, bars: 8, notes: Z_3R.map((r, b) => [b * 16, r, 16])},
      {inst: 'hornSec', gain: .34, bars: 8, notes: Z_MEL_3},
      {inst: 'bell', gain: .12, bars: 8, notes: Z_MEL_3.map(([st, m, l]) => [st, m + 12, l])},
    ]},
  },
  /** He rides out of 午门: the lowest bronze, the chant on G in both vowels, the seal, the clear, his royal tune's head. */
  intro(M, t0) {
    const b = 60 / this.bpm * 4, s = b / 16;
    M.hit('nao', 49, t0, .4);
    for (const m of [43, 50, 55]) { M.n('choir', m, t0, .2, 2 * b); M.n('choirO', m - 12, t0, .14, 2 * b); }
    cardStrokes(M, 49, [43, 50]);
    for (const [st, m, l] of part('0:67:8 8:74:4 12:71:4')) M.n('hornSec', m, t0 + 2 * b + st * s, .34, l * s);
    for (const st of [0, 8, 12]) M.hit('drumMass', 43, t0 + 2 * b + st * s, .55);
    for (let i = 0; i < 16; i++) M.hit('drum', 80, t0 + 3 * b + i * s, .1 + i * .026);
    M.hit('drumMass', 43, t0 + 3 * b + 12 * s, .65); M.n('hornSec', 72, t0 + 3 * b, .3, b); for (const m of Fz) M.n('yu', m, t0 + 3 * b, .14, b);
    return 4 * b;
  },
  held(M, t0, next) { return heldBeat(this, M, t0, next === 2 ? Z_B[0] : Z_3[0], next === 2 ? Z_BR[0] : Z_3R[0], 'choir', (b, s) => { M.hit('nao', 49, t0 + b, .45); for (const m of (next === 2 ? Z_B[0] : Z_3[0])) M.n('choirO', m - 12, t0, .16, 2 * b); }); },
  /** He goes into the burning tower: the bronze tolls three times, the chant moves A minor to F and back to an open
      fifth on A, and his royal tune's head, in G as it was at 午门, sounds once more on one horn, far off. */
  fall(M, t0) {
    [0, 1.8, 3.6].forEach((at, i) => M.hit('nao', 49, t0 + at, .55 - i * .08));
    M.hit('drumMass', 43, t0, .65);
    for (const m of Amz) M.n('choir', m, t0, .24, 2.4);
    for (const m of Fz) M.n('choir', m, t0 + 2.4, .24, 2.4);
    for (const m of [45, 52, 57, 64]) M.n('choirO', m, t0 + 4.8, .22, 4.5);
    let t = t0 + 5.2; for (const [m, d] of [[67, 1.2], [74, .6], [71, 1.8]]) { M.n('hornSec', m, t, .2, d); t += d; }
    return 11;
  },
};

export const DUELS = {wenzhong, kongxuan, yuanhong, zhouwang};
/** Whose duel ends each stretch (index → boss): his theme's sounds are rendered when the stretch begins. */
export const STRETCH_DUEL = {0: 'wenzhong', 1: 'kongxuan', 2: 'yuanhong'};
/** A duel that follows another with no stretch between: its theme is rendered as the first one ends (纣王's after 袁洪's). */
export const NEXT_DUEL = {yuanhong: 'zhouwang'};
