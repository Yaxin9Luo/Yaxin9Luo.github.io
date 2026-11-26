// The music: written parts, not random notes, played by a look-ahead scheduler on the engine's instruments.
// A cue is a loop of bars (16 steps a bar) in layers; a layer sounds only above its intensity threshold, so the same
// cue thins out when the field is quiet and fills when a boss is up. Cues change on a bar line.
//
// Notes are indices into the one pentatonic collection (see engine.pent): 0 = C3, 5 = C4, 10 = C5, -5 = C2.
// Within it: A 羽 for Xiqi (A C D E G, tonic index 4), D 商 for the passes (tonic 1/6), G 徵 for Zhaoge (tonic 3/8),
// E 角 for the last stand (tonic 2/7), C 宫 for the victory.

/** A part from a compact string: "step:note:len step:note ..." (len in steps, optional). */
const part = s => s.trim().split(/\s+/).map(w => { const [st, n, l] = w.split(':').map(Number); return [st, n, l || 4]; });
const steps = (s, note = 0) => s.replace(/\s/g, '').split('').flatMap((c, i) => c === 'x' ? [[i, note, 2, 1]] : c === 'o' ? [[i, note, 2, .55]] : c === '.' ? [] : [[i, note, 2, .3]]);

/* inst: which voice plays the layer; gain; min: the intensity it needs; bars: length of its pattern in bars. */
const CUES = {
  // 西岐之围: the city held. Slow, a heartbeat of the great drum, the 琴 low and alone, the 埙 over it. 羽 on A.
  xiqi: {bpm: 72, bars: 8, tonic: 4, layers: [
    {inst: 'drum', f: 52, gain: .5, bars: 1, notes: steps('x.o.............')},
    {inst: 'drum', f: 80, gain: .22, bars: 2, min: .45, notes: steps('....x.......o.o.' + '....x...o...o.o.')},
    {inst: 'wood', f: 700, gain: .12, bars: 2, min: .7, notes: steps('..x...x...x...x.' + '..x...x...x.x.x.')},
    {inst: 'qin', gain: .32, bars: 2, notes: part('0:-1:8 6:2 10:4 16:-1:8 22:3 26:2 30:1')},
    {inst: 'qinSlideUp', gain: .35, bars: 8, notes: part('124:2')},
    {inst: 'xun', gain: .16, bars: 8, notes: part('32:7:6 38:6:2 40:5:4 44:4:4 48:5:4 52:6:4 56:4:8 96:9:8 104:8:4 108:7:4 112:6:8 120:4:8')},
    {inst: 'chime', gain: .16, bars: 4, min: .3, notes: part('0:9 40:7')},
    {inst: 'bell', gain: .18, bars: 8, min: .6, notes: part('0:4 64:2')},
  ]},
  // 东征诸关: on the march through the passes. A march of drums, the 瑟 running in eighths, the bells' tune. 商 on D.
  dongzheng: {bpm: 96, bars: 8, tonic: 1, layers: [
    {inst: 'drum', f: 52, gain: .5, bars: 1, notes: steps('x.......x.......')},
    {inst: 'drum', f: 80, gain: .26, bars: 1, notes: steps('....x.o.....x.oo')},
    {inst: 'wood', f: 650, gain: .1, bars: 1, min: .5, notes: steps('..x.......x.....')},
    {inst: 'se', gain: .22, bars: 2, notes: part('0:1 2:4 4:6 6:4 8:5 10:4 12:3 14:4 16:1 18:4 20:6 22:7 24:6 26:4 28:3 30:2')},
    {inst: 'bell', gain: .22, bars: 8, min: .25, notes: part('0:11 8:10 12:9 16:8 20:9 24:11 32:12 38:11 40:10 44:9 48:11 64:9 72:8 76:7 80:6 84:7 88:8 96:9 102:8 104:7 108:8 112:6')},
    {inst: 'bellDark', gain: .3, bars: 4, notes: part('0:-4 32:-1')},
    {inst: 'chime', gain: .1, bars: 2, min: .7, notes: part('4:11 12:9 20:11 28:12')},
  ]},
  // 兵临朝歌: before the capital. Everything: the drums in sixteenths, a low bell on every bar, the bells' tune, the
  // stone chimes against it, horns held under. 徵 on G.
  zhaoge: {bpm: 108, bars: 8, tonic: 3, layers: [
    {inst: 'drum', f: 52, gain: .5, bars: 1, notes: steps('x.....x.x.......')},
    {inst: 'drum', f: 80, gain: .24, bars: 1, notes: steps('..oo......o.x.o.')},
    {inst: 'drum', f: 120, gain: .14, bars: 1, min: .5, notes: steps('.o.o.o.o.o.o.o.o')},
    {inst: 'wood', f: 650, gain: .1, bars: 1, min: .3, notes: steps('....x.......x...')},
    {inst: 'bellDark', gain: .3, bars: 1, notes: part('0:-2')},
    {inst: 'bell', gain: .22, bars: 8, notes: part('0:13 6:12 8:11 12:10 16:11 24:8 32:10 36:11 40:12 44:11 48:8 64:8 68:9 72:10 80:11 84:10 88:9 92:8 96:9 104:6 112:8')},
    {inst: 'chime', gain: .1, bars: 1, min: .55, notes: part('0:13 2:11 4:13 6:14 8:13 10:11 12:10 14:11')},
    {inst: 'horn', gain: .14, bars: 4, min: .4, notes: part('0:-2:28 32:-4:28')},
  ]},
  // 帝辛: the last stand at the palace. 角 on E, the darkest mode of the collection, faster, the lowest bells.
  final: {bpm: 120, bars: 8, tonic: 2, layers: [
    {inst: 'drum', f: 52, gain: .55, bars: 1, notes: steps('x..x..x...x..x..')},
    {inst: 'drum', f: 80, gain: .26, bars: 1, notes: steps('..o..o..oo..o.oo')},
    {inst: 'drum', f: 120, gain: .14, bars: 1, notes: steps('o.o.o.o.o.o.o.o.')},
    {inst: 'bellDark', gain: .34, bars: 2, notes: part('0:-3 16:-4 24:-6')},
    {inst: 'chime', gain: .11, bars: 1, notes: part('0:12 2:11 4:10 6:9 8:12 10:11 12:10 14:7')},
    {inst: 'bell', gain: .2, bars: 8, min: .3, notes: part('0:7 8:9 12:10 16:9 24:7 32:6 40:7 48:2 64:7 72:9 76:10 80:12 88:10 96:9 104:7 112:6 120:7')},
    {inst: 'horn', gain: .16, bars: 4, notes: part('0:-3:30 32:-6:30')},
  ]},
  // 行军: between the stretches. Drums alone, the horn calling every eight bars.
  march: {bpm: 104, bars: 8, tonic: 1, layers: [
    {inst: 'drum', f: 52, gain: .45, bars: 1, notes: steps('x.......x.......')},
    {inst: 'drum', f: 80, gain: .26, bars: 1, notes: steps('....x.o.....x.o.')},
    {inst: 'drum', f: 120, gain: .14, bars: 2, notes: steps('o.o.o.o.o.o.o.o.' + 'o.o.o.o.o.ooo.o.')},
    {inst: 'horn', gain: .26, bars: 8, notes: part('0:-4:6 8:1:12 64:-4:6 72:3:12')},
  ]},
  // 休整: the 25 s after a great boss. The 琴 alone, with its slides and harmonics; the 埙 answers. 宫 on C.
  rest: {bpm: 60, bars: 8, tonic: 0, layers: [
    {inst: 'qin', gain: .4, bars: 8, notes: part('0:-5:8 0:0:8 12:2 16:3 24:0:8 40:-1 44:0 48:2:8 56:-5:8 56:0:8 104:3 112:0:8')},
    {inst: 'qinSlideDown', gain: .45, bars: 8, notes: part('32:2 88:4')},
    {inst: 'harm', gain: .2, bars: 8, notes: part('64:10 68:12 72:11 76:9 80:10')},
    {inst: 'xun', gain: .18, bars: 8, notes: part('96:7:6 102:6:2 104:5:8 116:4:12')},
  ]},
};
/** The boss layer: added over whatever stretch cue is playing. More drums, a bell tolling the tonic, a horn for a great one. */
const BOSS = [
  {inst: 'drum', f: 80, gain: .28, bars: 1, notes: steps('x.x.xx.x..x.xx.x')},
  {inst: 'bellDark', gain: .32, bars: 1, notes: [[0, 'T-5', 4], [8, 'T-5', 4]], tier: 'small'},
  {inst: 'horn', gain: .2, bars: 4, notes: [[0, 'T-5', 30], [32, 'T-2', 30]], tier: 'big'},
];
const ENDS = {
  // 胜: a drum roll swelling, the great drum, the bells in a falling and rising run, the stone chimes above, a chord.
  won: (m, t0) => {
    for (let i = 0; i < 16; i++) m.note('drum', 80, t0 + i * .1 * Math.pow(.93, i), .1 + i * .02);
    const t = t0 + 1.25; m.note('drum', 52, t, .7); m.note('bellDark', -5, t, .45);
    [10, 12, 13, 15, 17, 15, 13, 12, 10].forEach((n, i) => m.note('bell', n, t + .05 + i * .16, .22));
    [15, 17, 18, 20].forEach((n, i) => m.note('chime', n, t + 1.6 + i * .08, .12));
    const t2 = t + 2.2; m.note('drum', 52, t2, .6); for (const n of [-5, 0, 3, 5, 7, 10]) m.note(n < 5 ? 'bellDark' : 'bell', n, t2, .22);
    m.note('horn', 0, t2, .26, 2.4); m.note('horn', 3, t2 + .05, .2, 2.4);
    [10, 11, 12, 13, 15].forEach((n, i) => m.note('bell', n, t2 + 2.6 + i * .3, .18)); m.note('drum', 52, t2 + 4.1, .6); m.note('bellDark', -5, t2 + 4.1, .45);
  },
  // 败: the 钲 struck three times (鸣金收兵, the call to fall back), the 琴 going down with its slides, the 埙 last.
  lost: (m, t0) => {
    [0, .55, 1.1].forEach((at, i) => m.raw('zheng', 520, t0 + at, .3 - i * .05));
    const t = t0 + 2; [[4, 'qin'], [3, 'qinSlideDown'], [2, 'qin'], [1, 'qin'], [0, 'qinSlideDown'], [-1, 'qin']].forEach(([n, inst], i) => m.note(inst, n, t + i * .75, .45));
    m.note('xun', 4, t + 4.8, .2, 3); m.note('bellDark', -6, t + 4.8, .3);
  },
};

export function createMusic(E) {
  const LOOK = .25, TICK = 60;           // schedule a quarter second ahead; wake every 60 ms
  let cue = null, next = null, boss = null, bar = 0, step = 0, t = 0, timer = null, intensity = .5, lift = 0, stretchCue = 'xiqi';
  const pent = E.pent;
  const FIXED = new Set(['drum', 'wood']);
  /** One note: an instrument, a note index (or a frequency for drums and wood), a time, a gain, a held length for breath. */
  function note(inst, n, when, gain, dur = 1) {
    const f = FIXED.has(inst) ? n : pent(n), bus = 'music';
    if (inst === 'xun' || inst === 'horn') return E.play(inst, inst === 'horn' ? [f, dur, .8] : [f, dur], {gain, when, bus});
    return E.play(inst, f, {gain, when, bus});
  }
  const raw = (inst, f, when, gain) => E.play(inst, f, {gain, when, bus: 'music'});
  const M = {note, raw};
  function resolve(n, C) { return typeof n === 'string' ? C.tonic + Number(n.slice(1)) : n; }
  function scheduleStep(when) {
    const C = CUES[cue]; if (!C) return;
    const spb = 60 / C.bpm / 4, k = Math.min(1, intensity + lift);
    const layers = boss ? C.layers.concat(BOSS.filter(l => !l.tier || l.tier === 'small' || boss !== 'small')) : C.layers;
    for (const L of layers) {
      if ((L.min || 0) > k) continue;
      const len = (L.bars || 1) * 16, at = (bar % (L.bars || 1)) * 16 + step;
      for (const [st, n, dur, acc] of L.notes) if (st === at) {
        const fr = L.f ?? resolve(n, C), g = L.gain * (acc ?? 1) * (.85 + .15 * k);
        if (L.inst === 'drum' || L.inst === 'wood') E.play(L.inst, fr, {gain: g * (.94 + Math.random() * .12), when, bus: 'music'});
        else note(L.inst, fr, when, g, dur * spb);
      }
      void len;
    }
  }
  function tick() {
    const ctx = E.ctx; if (!ctx || !cue) return;
    const horizon = ctx.currentTime + LOOK;
    if (t < ctx.currentTime - .05) {      // the timer slept (a hidden tab, a long frame): skip what is past, keep the bar
      const spb = 60 / CUES[cue].bpm / 4, missed = Math.ceil((ctx.currentTime - t) / spb);
      for (let i = 0; i < missed; i++) { t += spb; step++; if (step === 16) { step = 0; bar = (bar + 1) % CUES[cue].bars; } }
    }
    while (t < horizon) {
      const C = CUES[cue], spb = 60 / C.bpm / 4;
      if (step === 0 && next) { cue = next; next = null; bar = 0; continue; }       // cues change on a bar line
      scheduleStep(t);
      t += spb; step++;
      if (step === 16) { step = 0; bar = (bar + 1) % C.bars; lift *= .5; }
    }
  }
  const api = {
    get cue() { return cue; }, get bossTier() { return boss; }, get stretchCue() { return stretchCue; }, get intensity() { return intensity; },
    /** Starts a cue: at once if nothing plays, else on the next bar line. An ending (won, lost) plays once and stops the loop. */
    play(name) {
      const ctx = E.ctx; if (!ctx) return;
      if (ENDS[name]) { api.stop(); E.duck(0, 0, 0); ENDS[name](M, ctx.currentTime + .1); return; }
      if (!CUES[name]) return;
      if (['xiqi', 'dongzheng', 'zhaoge', 'final'].includes(name)) stretchCue = name;
      if (name === 'rest' || name === 'march') boss = null;
      if (!cue) { cue = name; bar = 0; step = 0; t = ctx.currentTime + .05; } else if (name !== cue) next = name;
      if (!timer && typeof setInterval === 'function' && !E.offline) timer = setInterval(tick, TICK);
      tick();
    },
    stop() { cue = null; next = null; boss = null; if (timer) { clearInterval(timer); timer = null; } },
    /** A boss is up ('small' | 'big' | 'final'), or none (null). The final boss changes the cue itself. */
    boss(tier) { boss = tier || null; if (tier === 'final') api.play('final'); },
    /** How full the field is, 0..1: the page may set it from the foe count; layers come in above their thresholds. */
    setIntensity(x) { intensity = Math.max(0, Math.min(1, x)); },
    /** A boss's phase or rage: the music rises for a few bars. */
    lift() { lift = .4; },
    /** For an offline render: advance the scheduler by hand. */
    tick,
    get timer() { return !!timer; },
    /** Every note the score can ask for, through the engine's dry run (E.play collects instead of playing). */
    wanted() {
      for (const name in CUES) {
        const C = CUES[name], spb = 60 / C.bpm / 4;
        for (const L of C.layers.concat(BOSS)) for (const [, n, dur] of L.notes) {
          if (L.inst === 'drum' || L.inst === 'wood') E.play(L.inst, L.f, {gain: 0, when: 0, bus: 'music'}); else note(L.inst, resolve(n, C), 0, 0, dur * spb);
        }
      }
      for (const name in ENDS) ENDS[name](M, 0);
    },
    CUES,
  };
  return api;
}
