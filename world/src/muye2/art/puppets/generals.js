// The named figures of SPEC-SURVIVORS 6.3 and 6.4: six generals of the Zhou camp with their true forms, the four Mo
// brothers (魔家四将) and Wen Zhong (闻仲) on the black qilin.
//
// Facts (mounts, weapons, treasures) are from research_notes/Fengshen content catalogue.md. Looks follow the conventions
// of the Qing ink album 《封神真形圖》 (Wikimedia Commons; pages 26 to 47 hold 李靖, 哪吒, 雷震子, 杨戬, 土行孙, 邓婵玉 and
// the four heavenly kings) and the Ming plates of 《新刻鍾伯敬先生批評封神演義》: scale armour with tassets, a robe worn
// over armour, a sash flying in an arc behind the head and shoulders, each figure holding the thing he is known by.
// No film, game or animation was used as a model.
//
// Every figure is built on the Zhou soldier's joints (t h au al bu bl lu ll ku kl w ...), so the first game's poses move it.
import { C, FACE, horse } from './base-figures.js';
import { slit, ring, scales, dot } from './engine.js';
import { elementHead } from './troops.js';

const P = (id, parent, at, z, draw, rot = 0, world = false) => ({ id, parent, at, z, draw, rot, world });
const sc = (pts, k) => pts.map((q) => [q[0] * k, q[1] * k, q[2]]);
const mv = (pts, x, y) => pts.map((q) => [q[0] + x, q[1] + y, q[2]]);
const circle = (r, n = 16, x = 0, y = 0) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r]);
const FEET = [{ id: 'll', pt: [2, 30] }, { id: 'kl', pt: [2, 30] }];
// the sash of a guardian figure: an arc behind head and shoulders, two ends streaming
const sashPart = (col, k = 1, z = 1) => P('sash', 't', [0, -30], z, (g) => {
  g.body(sc([[-13, 4], [-27, -16], [-25, -42], [-9, -60], [9, -62], [25, -46], [29, -20], [17, 2], [12, 0], [22, -20], [19, -41], [7, -54], [-7, -52], [-19, -38], [-20, -17], [-9, 2]], k), col, { line: 0.9 });
  g.body(sc([[-11, 2], [-30, 12], [-42, 34], [-58, 44, 1], [-46, 30], [-52, 22, 1], [-36, 20], [-26, 8]], k), col, { line: 0.9 });
  g.body(sc([[14, 2], [30, 14], [36, 34], [48, 44, 1], [30, 36], [22, 18]], k), col, { line: 0.9 });
});

/**
 * A person on the soldier's joints. o: {
 *   bulk: width of the trunk (1 a soldier), arms: 'bare' | colour, fore: colour of the forearm, chest(g): paints the trunk's dress over the body,
 *   body: colour of the trunk, skirt(g), leg: colour, boot: colour, head(g, k7): hair, helm and all above the face, face: colour (default bare paper),
 *   shoulder(g): paints a shoulder piece on each upper arm }
 */
function person(o) {
  const B = o.bulk || 1, x = (pts) => pts.map((q) => [q[0] * B, q[1], q[2]]), bare = o.arms === 'bare', arm = bare ? C.pale : o.arms || C.azu;
  const armU = (g) => { g.body(x([[-4, -4], [4, -4], [3.6, 8], [3, 19], [-3, 19], [-4, 8]]), arm, { line: bare ? 1.2 : 1 }); if (o.shoulder) o.shoulder(g); };
  const armL = (g) => { g.body(x([[-3, -2], [3, -2], [2.6, 12], [3.4, 17], [0.6, 20.5], [-2.8, 19.5], [-3.4, 16], [-2.6, 12]]), bare ? C.pale : o.fore || C.qing, { line: bare ? 1.2 : 1 }); if (o.cuff) g.tint([[-5, 3, 1], [5, 3, 1], [5, 11, 1], [-5, 11, 1]], o.cuff); };
  const legU = (g) => g.body(x([[-4.8, -4], [4.8, -4], [4.2, 11], [3.2, 26], [-3.2, 26], [-4.6, 11]]), o.leg || C.qing);
  const legL = (g) => { g.body(x([[-3.2, -2], [3.2, -2], [3, 13], [3, 24], [10, 26.5, 1], [9.4, 30, 1], [-3.6, 30, 1], [-3, 13]]), o.boot || C.zhong); if (o.greave) g.tint([[-5, 0, 1], [5, 0, 1], [5, 14, 1], [-5, 14, 1]], o.greave); };
  const parts = [
    P('t', null, [0, 0], 20, (g) => {
      if (o.skirt) o.skirt(g, B);
      g.body(x([[-8.5, 2], [-10.5, -12], [-11, -27], [-7, -36], [1.5, -39.5], [9.5, -35], [12, -22], [10.5, -7], [8.5, 2]]), o.body || C.azu, { line: 1.1 });
      if (o.chest) o.chest(g, B);
      g.tint([[-13 * B, -5, 1], [13 * B, -5, 1], [13 * B, 0, 1], [-13 * B, 0, 1]], o.belt || C.red);
    }),
    P('h', 't', [1, -37], 22, (g) => { const k7 = o.headK || 0.74; g.body(sc(FACE, k7), o.face || C.white); g.ink(sc([[2, -14.2], [5.5, -15.8], [9.4, -16.6]], k7), 1.2); o.head(g, k7); }),
    P('au', 't', [2 * B, -31], 26, armU), P('al', 'au', [0, 17], 27, armL), P('bu', 't', [1, -31], 6, armU), P('bl', 'bu', [0, 17], 5, armL),
    P('lu', 't', [2, 1], 16, legU), P('ll', 'lu', [0, 24], 15, legL), P('ku', 't', [-2, 1], 8, legU), P('kl', 'ku', [0, 24], 7, legL),
    ...(o.extra || []),
  ];
  return { parts, feet: FEET };
}
// pieces of dress used by several figures
const tassets = (col, edge, w = 19) => (g, B) => { g.body([[-9 * B, -4, 1], [9 * B, -4, 1], [w * B, 17], [(w - 2) * B, 24, 1], [w * 0.36 * B, 20], [0, 26, 1], [-w * 0.36 * B, 20], [-(w - 2) * B, 24, 1], [-w * B, 17]], col, { line: 1.1 }); if (col === C.gold) g.cut((k, r) => scales(k, r, -11 * B, 3, 12 * B, 16, 6.4)); if (edge) g.tint([[-(w + 2) * B, 13, 1], [(w + 2) * B, 13, 1], [(w + 2) * B, 19, 1], [-(w + 2) * B, 19, 1]], edge); };
const robeSkirt = (col, hem, w = 17) => (g, B) => { g.body([[-8 * B, -4], [-w * B, 14], [-(w + 3) * B, 31, 1], [-5, 28], [0, 32, 1], [5, 28], [(w + 3) * B, 31, 1], [w * B, 14], [8 * B, -4]], col, { line: 1 }); if (hem) g.tint([[-(w + 4) * B, 22, 1], [(w + 4) * B, 22, 1], [(w + 4) * B, 28, 1], [-(w + 4) * B, 28, 1]], hem); };
const scaleChest = (col, bands) => (g, B) => { g.body([[-9.5 * B, 2], [-11.5 * B, -12], [-12.5 * B, -27], [-8 * B, -36.5], [1.5, -40], [10.5 * B, -35.5], [13.5 * B, -22], [11.5 * B, -7], [9.5 * B, 2]], col, { line: 1.1 }); if (col === C.gold) g.cut((k, r) => scales(k, r, -7 * B, -30, 10 * B, -10, 6.6)); if (bands) for (const y of [-29, -13]) g.tint([[-14 * B, y, 1], [15 * B, y, 1], [15 * B, y + 5, 1], [-14 * B, y + 5, 1]], bands); };
const pauldron = (col, edge) => (g) => { g.body([[-15, -9, 1], [-4, -12], [8, -11], [17, -17, 1], [15, -3], [8, 8], [-7, 8], [-15, 1]], col, { line: 1.1 }); if (edge) g.tint([[-17, 2, 1], [17, 2, 1], [17, 8, 1], [-17, 8, 1]], edge); };
const helmHead = (col, o = {}) => (g, k7) => {                                        // a helm, with what the options add: plume colour and length, two pheasant plumes, a crown point, a band, a beard
  if (o.beard) g.body(sc([[-3, 2], [3, 3], [9, -3], [8, 10], [3, 20 + (o.beard > 1 ? 14 : 0), 1], [-3, 10]], k7 / 0.74), o.beardCol || C.nong, { line: 0.8 });
  g.body(sc([[13, -21, 1], [12, -31], [4, -39], [-7, -38], [-14.5, -28], [-16, -14], [-22, 1, 1], [-10, -3], [-7, -16], [1, -23]], k7), col, { line: 1 });
  if (o.band) g.tint(sc([[14, -25, 1], [-12, -27, 1], [-12, -20, 1], [14, -18.5, 1]], k7), o.band);
  const y0 = -28 * (k7 / 0.74);
  if (o.wings) for (const d of [-1, 1]) g.body([[d * 7 - 1, -16], [d * 16 - 1, -27, 1], [d * 11 - 1, -12]], o.wings, { line: 0.7 });
  if (o.crown) g.body([[-6, y0 + 2, 1], [-8, y0 - 8], [-3.6, y0 - 5], [0, y0 - o.crown, 1], [3.6, y0 - 5], [8, y0 - 8], [6, y0 + 2, 1]], C.gold, { line: 0.9 });
  if (o.pheasant) for (const [dx, rise, reach] of [[-3, 66, 84], [2, 80, 64]]) { g.body([[dx - 1.6, y0], [dx - 5, y0 - rise * 0.45], [dx - reach * 0.4, y0 - rise * 0.9], [dx - reach, y0 - rise, 1], [dx - reach * 0.42, y0 - rise * 0.8], [dx - 1, y0 - rise * 0.4], [dx + 2, y0]], o.pheasant, { line: 0.8 }); }
  if (o.plume) { const len = o.plume, dx = 1; g.body([[dx + 1.5, y0 + 1], [dx - 2, y0 - len * 0.5], [dx - len * 0.5, y0 - len], [dx - len * 1.15, y0 - len * 0.95], [dx - len * 1.5, y0 - len * 0.62, 1], [dx - len * 1.05, y0 - len * 0.72], [dx - len * 0.5, y0 - len * 0.62], [dx - 7, y0 - len * 0.26], [dx - 4.4, y0 + 1]], o.plumeCol || C.red, { line: 0.8 }); }
};

// ================================================================== the six generals
// ---- 哪吒: a boy born of the lotus, on the wind-fire wheels, with the fire-tipped spear, the Cosmos Ring and the sash.
// True form (ch 76): three heads and eight arms, a weapon in every hand (spear, ring, sash, gold brick, the fire cover, two swords).
export function nezha(trueForm = false) {
  const bun = (g, k7) => { g.body(sc([[11, -22, 1], [9, -28], [0, -31], [-9, -27], [-11, -16], [-6, -18], [1, -23]], k7), C.nong, { line: 0.8 }); for (const x of [-7, 4]) { g.body([[x - 4.4, -20], [x, -29], [x + 4.4, -20], [x, -16]], C.nong, { line: 0.7 }); g.strip([[x - 3.6, -19.5], [x + 3.6, -19.5]], 1.6, C.red); } };
  const lotus = (g) => { for (let i = -2; i <= 2; i++) g.body([[i * 6 - 5, -3], [i * 7.4 - 6, 12], [i * 8.4, 23 - Math.abs(i) * 2, 1], [i * 7.4 + 6, 12], [i * 6 + 5, -3]], i % 2 ? C.white : C.red, { line: 1 }); };   // a skirt of lotus petals
  const extra = [sashPart(C.red, trueForm ? 1.25 : 1.05),
    P('w', 'al', [0, 18], 24, (g) => { g.strip([[-52, 0], [74, 0]], 2.6, C.lacquer); g.body([[60, -3, 1], [66, -8], [72, -3, 1], [72, 3, 1], [66, 8], [60, 3, 1]], C.gold, { line: 0.8 }); elementHead(g, 'fire', 72, 0.95); g.body([[62, 3], [54, 12], [58, 28, 1], [66, 12]], C.red, { line: 0.7 }); }, 0, true),   // 火尖枪
    P('ring', 'bl', [0, 19], 4, (g) => { g.strip(circle(11), 3.6, C.gold); }, 0, true),                                              // 乾坤圈
    // the wind-fire wheels: one under each foot, flame behind
    ...['ll', 'kl'].map((leg, i) => P('wheel' + i, leg, [3, 31], i ? 6 : 14, (g) => { g.body([[-8, 0], [-22, -9], [-40, -6, 1], [-26, 0], [-44, 8, 1], [-22, 9]], C.red, { line: 0.9 }); g.strip(circle(11), 3.4, C.gold); g.strip([[-11, 0], [11, 0]], 1.6, C.gold); g.strip([[0, -11], [0, 11]], 1.6, C.gold); g.body([[4, -4], [16, -10, 1], [10, 0], [16, 10, 1], [4, 4]], C.red, { line: 0.7 }); }, 0, true)),
  ];
  if (trueForm) {
    // two more faces, looking forward-down and back; six more arms fanned behind the body, each with its weapon
    extra.push(P('h2', 'h', [-9, -3], 21, (g) => { g.body(sc(FACE, 0.62).map((q) => [-q[0], q[1], q[2]]), C.white, { line: 1 }); g.body([[-9, -15], [-2, -22], [5, -17], [2, -13]], C.nong, { line: 0.7 }); }, 0));
    extra.push(P('h3', 'h', [9, 1], 21.5, (g) => { g.body(sc(FACE, 0.6), C.white, { line: 1 }); g.body([[-4, -14], [3, -20], [9, -15], [5, -12]], C.nong, { line: 0.7 }); }, 14));
    const armX = (id, ang, z, hold) => P(id, 't', [0, -30], z, (g) => { g.body([[-3.4, -3], [3.4, -3], [3, 20], [3.4, 38], [-3.4, 38], [-3, 20]], C.pale, { line: 1.2 }); g.tint([[-4.5, 24, 1], [4.5, 24, 1], [4.5, 30, 1], [-4.5, 30, 1]], C.gold); hold(g); }, ang);
    const sword = (g) => { g.body([[-2.6, 38, 1], [2.6, 38, 1], [2.2, 66], [0, 76, 1], [-2.2, 66]], C.gold, { line: 0.9 }); g.body([[-6, 37, 1], [6, 37, 1], [6, 40, 1], [-6, 40, 1]], C.nong, { line: 0.5 }); };
    extra.push(armX('x1', 152, 3, sword), armX('x2', -152, 3, sword),
      armX('x3', 118, 3.2, (g) => { g.body([[-9, 38, 1], [9, 38, 1], [9, 50, 1], [-9, 50, 1]], C.gold, { line: 1 }); g.cut((k) => slit(k, -5, 44, 5, 44, 1.2)); }),                                  // 金砖
      armX('x4', -118, 3.2, (g) => { g.body([[-13, 40], [-11, 52], [0, 58], [11, 52], [13, 40], [0, 36]], C.red, { line: 1 }); g.tint([[-14, 40, 1], [14, 40, 1], [14, 44, 1], [-14, 44, 1]], C.gold); }),   // 九龙神火罩
      armX('x5', 84, 3.4, (g) => g.strip(circle(9, 14, 0, 46), 3, C.gold)),
      armX('x6', -84, 3.4, (g) => g.body([[-2, 38], [-12, 52], [-6, 70, 1], [0, 54], [8, 72, 1], [10, 52]], C.red, { line: 0.8 })));
  }
  return person({ arms: 'bare', body: C.pale, belt: C.red, leg: C.pale, boot: C.pale, skirt: lotus, head: bun, cuff: C.gold,
    chest: (g) => { g.body([[-8, -32], [9, -32], [6, -16], [0, -9, 1], [-6, -16]], C.red, { line: 0.9 }); g.cut((k) => ring(k, 0.5, -22, 3.4, 1.2)); }, extra });      // a red bib (肚兜)
}

// ---- 杨戬: armour under a robe worn off one shoulder, a plumed helm, the three-pointed two-edged blade. The hound is its own puppet.
export function yangjian(trueForm = false) {
  const extra = [sashPart(trueForm ? C.gold : C.azuThin, 1.05),
    P('robe', 't', [0, 0], 21, (g) => { g.body([[9, -36], [-6, -30], [-14, -8], [-20, 16], [-24, 34, 1], [-10, 30], [-4, 14], [2, -8], [10, -22]], C.azu, { line: 1 }); g.tint([[-25, 26], [-6, 22], [-6, 28], [-25, 33]], C.gold); }, 0),   // the robe over the armour, on the far shoulder
    P('w', 'al', [0, 18], 24, (g) => { g.strip([[-56, 0], [70, 0]], 2.8, C.lacquer);
      g.body([[66, -3, 1], [74, -5], [80, -17, 1], [84, -5], [104, 0, 1], [84, 5], [80, 17, 1], [74, 5], [66, 3, 1]], trueForm ? C.gold : C.qing, { line: 1.1 });       // 三尖两刃刀: three points, two edges
      g.cut((k) => slit(k, 76, 0, 96, 0, 1.4)); g.body([[62, 3], [54, 12], [58, 26, 1], [66, 12]], C.red, { line: 0.7 }); }, 0, true)];
  if (trueForm) extra.push(P('nimbus', 'h', [0, -14], 0.5, (g) => g.strip(circle(24), 3, C.gold)));
  return person({ bulk: 1.08, arms: C.azu, fore: C.qing, cuff: C.gold, body: C.gold, chest: scaleChest(C.gold, null), skirt: tassets(C.gold, C.azu, 20), leg: C.qing, boot: C.lacquer, greave: C.gold,
    shoulder: pauldron(C.gold, C.azu), head: helmHead(C.gold, { band: C.azu, wings: C.gold, pheasant: trueForm ? C.gold : null, plume: trueForm ? 16 : 30 }), extra });
}
/** 哮天犬: a lean white hound. ink: one of the ink hounds of the true form. */
export function hound(ink = false) {
  const col = ink ? C.lacquer : C.white, ln = { line: ink ? 0.6 : 1.5 };
  const leg = (g) => g.body([[-3, -3], [3, -3], [2.2, 12], [1.6, 22], [5, 25, 1], [-2.6, 25, 1], [-2.4, 12]], col, ln);
  return { parts: [
    P('body', null, [0, 0], 10, (g) => { g.body([[-26, -8], [-10, -11], [10, -11], [24, -9], [28, -1], [22, 6], [6, 4], [-8, 6], [-24, 4], [-30, -2]], col, ln); g.body([[-27, -6], [-38, -16], [-46, -30, 1], [-36, -20], [-28, -10]], col, ln); }),   // the tail curls up
    P('neck', 'body', [22, -6], 11, (g) => { g.body([[-6, 4], [-2, -10], [8, -20], [20, -22], [34, -17, 1], [32, -12], [20, -11], [12, -6], [6, 6]], col, ln); g.body([[8, -20], [6, -32, 1], [14, -22]], col, ln); if (!ink) { g.ink([[24, -17], [27, -16]], 1.4); g.tint([[2, -4], [9, -8], [11, -3], [4, 1]], C.red); } }, 0),   // a red collar
    P('fU', 'body', [20, 2], 12, leg, -8), P('fU2', 'body', [15, 2], 5, leg, 14), P('hU', 'body', [-22, 2], 12, leg, 10), P('hU2', 'body', [-26, 2], 5, leg, -16),
  ], feet: [{ id: 'fU', pt: [1, 25] }, { id: 'hU', pt: [1, 25] }, { id: 'fU2', pt: [1, 25] }, { id: 'hU2', pt: [1, 25] }] };
}

// ---- 雷震子: winged, with the golden staff. (The novel's face of indigo and hair of cinnabar, ch 21, are from memory of the text, not the catalogue.)
// True form: larger wings; the storm cloud that follows him is another puppet (`stormCloud`).
export function leizhenzi(trueForm = false) {
  const wing = (id, z, k, rot) => P(id, 't', [-6, -30], z, (g) => {
    const W = (trueForm ? 1.3 : 1) * k;
    g.body(sc([[2, 0], [-10, -22], [-34, -44], [-66, -52], [-92, -42, 1], [-74, -38], [-88, -24, 1], [-66, -24], [-76, -8, 1], [-52, -12], [-56, 6, 1], [-34, -2], [-30, 16, 1], [-14, 6], [0, 8]], W), C.mal, { line: 1.1 });
    g.cut((c) => { for (let i = 0; i < 5; i++) slit(c, (-22 - i * 12) * W, (-30 - i * 3) * W, (-16 - i * 11) * W, (-8 + i * 1) * W, 1.6 * W, 1); });
    g.tint(sc([[2, 0], [-10, -22], [-24, -34], [-16, -8], [0, 8]], W), C.gold);
  }, rot);
  const hair = (g, k7) => { g.body([[10, -16, 1], [8, -24], [14, -34, 1], [4, -28], [2, -40, 1], [-4, -29], [-12, -38, 1], [-11, -26], [-22, -28, 1], [-14, -18], [-20, -8, 1], [-9, -12], [-4, -18]], C.red, { line: 0.9 }); g.body([[9.5, -4], [13, -1, 1], [10, 0]], C.white, { line: 0.6 }); };   // hair like cinnabar, a tusk
  return person({ bulk: 1.1, arms: 'bare', body: C.pale, face: C.azuThin, leg: C.ochre, boot: C.nong, belt: C.red, head: hair, cuff: C.gold,
    chest: (g) => { g.ink([[-7, -24], [0, -20], [8, -25]], 1.1); g.ink([[1, -19], [0, -8]], 0.9); },
    skirt: (g) => { g.body([[-12, -3], [-16, 12], [-13, 26], [-4, 21], [0, 27], [5, 21], [13, 26], [16, 12], [12, -3]], C.ochre, { line: 1.1 }); g.body([[-12, -2], [-22, 8], [-26, 26, 1], [-16, 14]], C.red, { line: 0.8 }); },
    extra: [wing('wingB', 2, 0.9, 16), wing('wingA', 3, 1, -6),
      P('w', 'al', [0, 18], 24, (g) => { g.strip([[-50, 0], [62, 0]], 4.2, C.gold); for (const q of [-50, 62]) g.body([[q - 4, -4, 1], [q + 4, -4, 1], [q + 4, 4, 1], [q - 4, 4, 1]], C.red, { line: 0.6 }); }, 0, true)] });   // 黄金棍
}
/** The storm that follows 雷震子's true form: a dark cloud with a bolt under it. */
export function stormCloud() {
  return { parts: [P('cloud', null, [0, 0], 0, (g) => {
    g.body([[-52, 0], [-62, -12], [-50, -26], [-32, -22], [-22, -36], [0, -40], [16, -28], [34, -34], [56, -24], [64, -8], [52, 4], [20, 8], [-24, 8]], C.zhong, { line: 1.6 });
    g.ink([[-46, -10], [-36, -18], [-26, -10], [-34, -4]], 1.2); g.ink([[-10, -22], [4, -28], [12, -18], [2, -12], [-4, -18]], 1.2); g.ink([[30, -18], [42, -24], [50, -14], [42, -8]], 1.2);
    g.body([[-4, 8], [8, 8], [-2, 30], [10, 30], [-12, 64, 1], [-4, 38], [-14, 38]], C.gold, { line: 0.9 });
  })], feet: [{ id: 'cloud', pt: [0, 8] }] };
}

// ---- 土行孙: very short, a plain robe, the iron staff, the Immortal-binding Rope coiled at his belt. He comes up out of the ground (`mound`).
export function tuxingsun(trueForm = false) {
  const head = (g, k7) => { g.body(sc([[11, -22, 1], [9, -28], [0, -31], [-9, -27], [-11, -16], [-6, -18], [1, -23]], k7), C.nong, { line: 0.8 }); g.body([[-4, -22], [-5, -31], [0, -34], [5, -31], [4, -22]], C.nong, { line: 0.7 }); g.strip([[-5, -24], [5, -24]], 1.6, C.ochre); if (trueForm) g.strip(circle(20, 16, 0, -12), 2.6, C.gold); };
  return person({ bulk: 1.3, headK: 0.95, arms: C.ochre, fore: C.pale, body: C.ochre, belt: C.nong, leg: C.zhong, boot: C.nong, head,
    skirt: robeSkirt(C.ochre, trueForm ? C.gold : C.nong, 15),
    chest: (g) => { g.ink([[3, -37], [-3, -20], [-1, -2]], 1.1); g.strip(circle(6, 12, -9, 4), 2.4, C.gold); g.strip(circle(3, 10, -9, 4), 1.6, C.gold); },                // 捆仙绳, coiled
    extra: [P('w', 'al', [0, 18], 24, (g) => { g.strip([[-40, 0], [52, 0]], 4, C.lacquer); for (const q of [-36, 46]) g.body([[q - 3, -3.6, 1], [q + 3, -3.6, 1], [q + 3, 3.6, 1], [q - 3, 3.6, 1]], C.zhong, { line: 0.6 }); }, 0, true)] });   // 宾铁棍
}
/** The broken ground he rises from: a low mound of clods, drawn in front of his legs. big: the true form's opening. */
export function mound(big = false) {
  const k = big ? 1.7 : 1;
  return { parts: [P('mound', null, [0, 0], 0, (g) => {
    g.body(sc([[-34, 4], [-30, -8], [-18, -14], [-8, -9], [2, -18], [14, -10], [24, -15], [34, -5], [36, 4]], k), C.ochre, { line: 1.4 });
    g.ink(sc([[-22, -6], [-14, -2], [-6, -6]], k), 1.1); g.ink(sc([[8, -9], [16, -4], [26, -8]], k), 1.1);
    for (const [x, y] of [[-42, -4], [44, -8], [-50, 2]]) g.body(sc([[x - 5, y + 3], [x, y - 4], [x + 6, y + 2], [x, y + 5]], k), C.zhong, { line: 0.9 });
  })], feet: [{ id: 'mound', pt: [0, 5] }] };
}

// ---- 邓婵玉: a woman in light armour and a skirt, hair in a high knot with a pin, a sabre, and the five-light stone in her throwing hand.
// True form: five stones in a fan, each with its light.
export function dengchanyu(trueForm = false) {
  const head = (g, k7) => { g.body(sc([[11, -22, 1], [9, -29], [0, -32], [-10, -28], [-13, -14], [-15, 6, 1], [-8, -2], [-6, -18], [1, -23]], k7), C.nong, { line: 0.8 }); g.body([[-5, -22], [-8, -34], [-2, -40], [5, -35], [4, -22]], C.nong, { line: 0.8 }); g.strip([[-10, -31], [8, -34]], 1.6, C.gold); g.body([[7, -35], [14, -40, 1], [10, -32]], C.gold, { line: 0.5 }); g.body([[-7, -30], [-18, -26], [-26, -12, 1], [-14, -20]], C.red, { line: 0.7 }); };
  const stone = (g, x, y, col) => { g.body(circle(4.4, 10, x, y), C.white, { line: 1.2 }); g.body(circle(1.8, 8, x, y), col, { line: 0 }); };
  const LIGHTS = [C.red, C.azu, C.mal, C.gold, C.ochre];
  return person({ bulk: 0.94, arms: C.azuThin, fore: C.pale, cuff: C.gold, body: C.azuThin, chest: (g) => { g.body([[-8, -31], [9, -31], [10, -10], [0, -6], [-9, -10]], C.gold, { line: 1 }); g.cut((k, r) => scales(k, r, -6, -27, 8, -11, 5.6)); }, belt: C.red, leg: C.qing, boot: C.zhong,
    skirt: robeSkirt(C.red, C.gold, 15), shoulder: (g) => g.body([[-7, -6], [0, -9], [7, -6], [8, 1], [0, 6], [-8, 1]], C.gold, { line: 1 }), head,
    extra: [sashPart(C.azuThin, 0.92),
      P('w', 'bl', [0, 18], 4, (g) => { g.body([[4, -2.6, 1], [26, -4], [42, -7, 1], [46, 0], [40, 4], [4, 2.6, 1]], C.gold, { line: 0.9 }); g.strip([[-6, 0], [4, 0]], 2.4, C.nong); g.body([[2, -5, 1], [5, -5, 1], [5, 5, 1], [2, 5, 1]], C.nong, { line: 0.5 }); }, 0, true),   // the sabre, in the far hand
      P('stone', 'al', [0, 19], 28, (g) => { if (!trueForm) { stone(g, 3, 0, C.red); for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; g.strip([[3 + Math.cos(a) * 7, Math.sin(a) * 7], [3 + Math.cos(a) * 13, Math.sin(a) * 13]], 1.3, LIGHTS[i]); } }
        else LIGHTS.forEach((col, i) => { const a = -1.1 + i * 0.55, x = 6 + Math.cos(a) * 22, y = Math.sin(a) * 22; g.strip([[x + Math.cos(a) * 6, y + Math.sin(a) * 6], [x + Math.cos(a) * 22, y + Math.sin(a) * 22]], 2, col); stone(g, x, y, col); }); }, 0, true)] });
}

// ---- 黄飞虎 (武成王): heavy armour, a long spear, a king's crowned helm; he rides the five-coloured ox (`ox`).
export function huangfeihu(trueForm = false) {
  return person({ bulk: 1.16, arms: C.azu, fore: C.gold, body: C.gold, chest: scaleChest(C.gold, trueForm ? C.red : C.azu), skirt: tassets(C.gold, C.red, 21), leg: C.qing, boot: C.lacquer, greave: C.gold, belt: C.red,
    shoulder: pauldron(C.gold, C.red), head: helmHead(C.gold, { band: C.red, wings: C.gold, crown: trueForm ? 18 : 11, beard: 2, plume: 20 }),
    extra: [sashPart(trueForm ? C.gold : C.red, 1.1), P('c', 't', [-6, -32], 14, (g) => g.body([[3, -4], [-8, -5], [-19, 4], [-26, 26], [-34, 52, 1], [-21, 44], [-14, 56, 1], [-8, 36], [-3, 18], [3, 4]], C.red, { line: 0.9 }), 4),
      P('w', 'al', [0, 18], 24, (g) => { g.strip([[-64, 0], [84, 0]], 2.8, C.lacquer); g.body([[80, -3.6, 1], [92, -5.5], [112, 0, 1], [92, 5.5], [80, 3.6, 1]], C.gold, { line: 1 }); g.body([[78, 3], [68, 13], [72, 30, 1], [82, 13]], C.red, { line: 0.7 }); }, 0, true)] });
}
/** 五色神牛: a great ox, its hide in bands of the five pigments. Joints named as the horse's, so the horse's gaits move it. */
export function ox(trueForm = false) {
  const ln = { line: 1.6 }, hide = C.dan;
  const legU = (g) => g.body([[-8, -8], [8, -8], [7, 6], [5, 22], [-5, 22], [-7, 6]], hide, ln), legL = (g) => { g.body([[-4.6, -3], [4.6, -3], [4, 14], [5.5, 20], [-5.5, 20], [-4, 14]], hide, ln); g.tint([[-7, 14, 1], [7, 14, 1], [7, 21, 1], [-7, 21, 1]], C.lacquer); };
  const parts = [
    P('hind', 'body', [-10, -4], 9.5, (g) => { g.body([[10, -26], [-14, -27], [-38, -24], [-52, -12], [-55, 4], [-48, 20], [-30, 24], [-8, 20], [10, 20], [14, 0]], hide, ln); g.tint([[-30, -27], [-18, -27], [-14, 24], [-27, 25]], C.ochre); g.tint([[-50, -16], [-42, -22], [-38, 23], [-46, 21]], C.red); }),
    P('body', null, [0, 0], 10, (g) => { g.body([[26, -30], [6, -27], [-8, -26], [-14, -2], [-10, 20], [14, 23], [34, 24], [50, 18], [58, 4], [58, -14], [48, -28], [38, -34]], hide, ln);
      g.tint([[-6, -27], [6, -28], [8, 23], [-5, 22]], C.mal); g.tint([[20, -31], [32, -33], [34, 25], [22, 24]], C.azu); g.tint([[44, -31], [54, -22], [56, 12], [46, 21]], C.gold);
      g.body([[-18, -27], [0, -31], [20, -29], [24, -8], [20, 12], [-2, 14], [-20, 8]], trueForm ? C.gold : C.red, { line: 1 }); g.tint([[-22, 2], [26, 4], [26, 10], [-22, 9]], trueForm ? C.red : C.gold); }),   // the saddle cloth
    P('neck', 'body', [46, -16], 11, (g) => { g.body([[-12, -8], [0, -22], [16, -26], [32, -22], [44, -12], [50, 2], [48, 12], [40, 16], [32, 10], [22, 4], [10, 10], [-4, 12], [-14, 4]], hide, ln);
      g.body([[20, -24], [16, -40], [30, -52, 1], [24, -38], [30, -24]], C.white, { line: 1.3 }); g.body([[10, -24], [2, -38], [10, -50, 1], [8, -36], [18, -26]], C.white, { line: 1.3 });                       // the horns
      g.body([[32, -8], [35, -11], [38, -8], [35, -6]], C.lacquer, { line: 0 }); g.ink([[45, 8], [48, 10]], 1.2); g.strip(circle(4.4, 10, 42, 17), 1.8, C.gold); }),                                              // the eye, the nostril, a nose ring
    P('tail', 'hind', [-52, -6], 9, (g) => { g.strip([[0, 0], [-8, 14], [-6, 30]], 2.2, hide); g.body([[-9, 28], [-12, 42, 1], [-3, 40], [-2, 28]], C.lacquer, { line: 0.6 }); }, 0),
    P('fU', 'body', [42, 16], 12, legU), P('fL', 'fU', [0, 20], 13, legL), P('fU2', 'body', [34, 15], 5, legU), P('fL2', 'fU2', [0, 20], 4, legL),
    P('hU', 'hind', [-32, 16], 12, legU), P('hL', 'hU', [0, 20], 13, legL), P('hU2', 'hind', [-40, 15], 5, legU), P('hL2', 'hU2', [0, 20], 4, legL),
  ];
  return { parts, seat: [4, -28], feet: ['fL', 'fL2', 'hL', 'hL2'].map((id) => ({ id, pt: [0, 21] })) };
}

// ================================================================== the named foes
// The four Mo brothers stand as the four heavenly kings do in the album: giants in dark scale armour, bearded, crowned,
// a sash in an arc behind, each with his treasure (the chapter 40 allotment): 魔礼青 the Azure Cloud Sword, 魔礼红 the
// Primordial Umbrella, 魔礼海 the jade pipa on his arm and a spear, 魔礼寿 the flower-fox marten.
export function mo(which) {
  const TINT = { qing: C.mal, hong: C.red, hai: C.azu, shou: C.ochre }[which], FACE_COL = { qing: C.azuThin, hong: C.red, hai: C.qing, shou: C.dan }[which];
  const extra = [sashPart(TINT, 1.3)];
  if (which === 'qing') extra.push(P('w', 'al', [0, 18], 24, (g) => { g.body([[6, -5, 1], [40, -7], [74, -5], [92, 0, 1], [74, 5], [40, 7], [6, 5, 1]], C.qing, { line: 1.3 }); g.cut((k) => slit(k, 14, 0, 78, 0, 1.6)); g.body([[2, -11, 1], [7, -11, 1], [7, 11, 1], [2, 11, 1]], C.gold, { line: 0.8 }); g.strip([[-10, 0], [4, 0]], 3.4, C.lacquer);
    g.body([[70, -6], [80, -22, 1], [84, -8], [96, -18, 1], [92, -3]], C.mal, { line: 0.8 }); }, 0, true));                                                                // 青云剑, a thread of the black wind at its point
  if (which === 'hong') extra.push(P('w', 'al', [0, 18], 24, (g) => { g.strip([[-30, 0], [70, 0]], 3, C.lacquer);
    g.body([[70, -44, 1], [58, -30], [52, 0], [58, 30], [70, 44, 1], [80, 22], [84, 0], [80, -22]], C.red, { line: 1.3 }); g.tint([[54, -6, 1], [86, -6, 1], [86, 6, 1], [54, 6, 1]], C.gold);
    for (const y of [-40, -22, 22, 40]) g.body(circle(2.6, 8, 66 - Math.abs(y) * 0.18, y * 1.08), C.white, { line: 0.8 }); g.body([[84, -3, 1], [96, 0, 1], [84, 3, 1]], C.gold, { line: 0.7 }); }, 0, true));   // 混元珍珠伞, open, pearls on its rim
  if (which === 'hai') { extra.push(P('pipa', 'bl', [0, 14], 30, (g) => { g.body([[-10, -4], [-8, -16], [0, -22], [8, -16], [10, -4], [7, 12], [3, 22], [3, 50], [-3, 50], [-3, 22], [-7, 12]], C.mal, { line: 1.3 }); for (const x of [-3, -1, 1, 3]) g.ink([[x, -14], [x * 0.6, 44]], 0.6); g.body([[-7, 44, 1], [7, 44, 1], [7, 47, 1], [-7, 47, 1]], C.gold, { line: 0.5 }); }, -150, true));   // 碧玉琵琶
    extra.push(P('w', 'al', [0, 18], 24, (g) => { g.strip([[-56, 0], [76, 0]], 3, C.lacquer); g.body([[72, -4, 1], [84, -6], [104, 0, 1], [84, 6], [72, 4, 1]], C.gold, { line: 1 }); }, 0, true)); }
  if (which === 'shou') extra.push(P('marten', 'al', [0, 18], 28, (g) => {                                                                                                // 花狐貂 on his hand: a small white beast with wings and a long tail
    g.body([[-6, -4], [4, -9], [18, -8], [26, -14, 1], [30, -6], [38, -4, 1], [30, 0], [22, 4], [6, 5], [-6, 2]], C.white, { line: 1.3 }); g.body([[-5, -2], [-18, -10], [-30, -6], [-40, -16, 1], [-30, 0], [-16, 0]], C.white, { line: 1.2 });
    g.body([[8, -8], [2, -24], [-10, -30, 1], [-2, -18], [-12, -16, 1], [4, -8]], C.ochre, { line: 0.9 }); g.cut((k) => { for (const x of [0, 8, 16]) dot(k, x, -1, 1.5); }); g.ink([[30, -6], [32, -5]], 1.2); }, 0, true));
  // four builds, so that they differ without their treasures: 青 tall and lean under a high crown point; 红 the broadest, a wide skirt, winged helm;
  // 海 middling, long-bearded; 寿 thick-set and low, a plain banded helm. (Their stances are set where the frames are made, in index.js.)
  const BUILD = { qing: { bulk: 1.08, skirt: 18, headK: 0.72, helm: { crown: 24, beard: 2 } }, hong: { bulk: 1.62, skirt: 30, headK: 0.8, helm: { wings: C.gold, crown: 8, beard: 1 } },
    hai: { bulk: 1.3, skirt: 23, headK: 0.74, helm: { wings: C.gold, crown: 14, beard: 2 } }, shou: { bulk: 1.34, skirt: 21, headK: 0.84, helm: { beard: 1 } } }[which];
  return person({ bulk: BUILD.bulk, headK: BUILD.headK, arms: C.lacquer, fore: C.zhong, cuff: TINT, body: C.lacquer, face: FACE_COL, chest: scaleChest(C.lacquer, TINT), skirt: tassets(C.lacquer, TINT, BUILD.skirt), leg: C.zhong, boot: C.lacquer, greave: TINT, belt: C.gold,
    shoulder: pauldron(C.lacquer, TINT), head: helmHead(C.lacquer, { band: TINT, ...BUILD.helm, beardCol: which === 'hong' ? C.lacquer : C.nong }), extra });
}
/** 闻仲 (闻太师): an old grand tutor in a court robe over armour, a tall cap, a long white beard, a golden whip in each hand. He rides the black qilin (`qilin`). */
export function wenzhong() {
  const whip = (g) => { g.strip([[-6, 0], [6, 0]], 3, C.lacquer); for (let i = 0; i < 7; i++) g.body([[6 + i * 9, -3.6, 1], [14 + i * 9, -3.2, 1], [14 + i * 9, 3.2, 1], [6 + i * 9, 3.6, 1]], C.gold, { line: 0.8 }); g.body([[69, -2.4, 1], [78, 0, 1], [69, 2.4, 1]], C.gold, { line: 0.7 }); };   // a jointed golden whip (鞭): a bar of knuckles, not a lash
  const head = (g, k7) => { g.body(sc([[-3, 2], [3, 3], [9, -3], [9, 14], [4, 40, 1], [-3, 16]], 1), C.white, { line: 1.2 });                                       // the long white beard
    g.body(sc([[12, -21, 1], [11, -30], [3, -35], [-8, -34], [-13, -26], [-14, -14], [-6, -17], [1, -23]], k7), C.lacquer, { line: 1 }); g.body([[-7, -24, 1], [-8, -46], [-2, -52], [6, -48], [7, -24, 1]], C.lacquer, { line: 1 }); g.tint([[-9, -30, 1], [9, -30, 1], [9, -25, 1], [-9, -25, 1]], C.gold);
    for (const d of [-1, 1]) g.body([[d * 7, -27], [d * 22, -30, 1], [d * 21, -25, 1], [d * 7, -23]], C.lacquer, { line: 0.8 }); };                                                 // the cap's two wings
  return person({ bulk: 1.2, arms: C.red, fore: C.gold, body: C.red, belt: C.gold, leg: C.zhong, boot: C.lacquer, head,
    chest: (g, B) => { g.body([[-6, -32], [8, -32], [9, -12], [0, -8], [-7, -12]], C.gold, { line: 1 }); g.cut((k, r) => scales(k, r, -4, -28, 7, -13, 5.4)); },
    skirt: robeSkirt(C.red, C.gold, 20), shoulder: pauldron(C.lacquer, C.gold),
    extra: [sashPart(C.gold, 1.2), P('w', 'al', [0, 18], 24, whip, 0, true), P('w2', 'bl', [0, 18], 4, whip, 0, true)] });
}
/** 墨麒麟: the horse's frame in black, with one horn, a mane and tail of malachite flame and cloud at its feet when it runs. */
export function qilin() {
  const d = horse({ coat: C.lacquer, mane: C.mal });
  d.parts.push(P('horn', 'neck', [56 * 1.22, -62 * 1.22], 12, (g) => g.body([[-4, 4], [2, -14], [16, -34, 1], [8, -10], [5, 5]], C.gold, { line: 1 }), 0));
  d.parts.push(P('beard', 'neck', [60 * 1.22, -20 * 1.22], 10.5, (g) => g.body([[-3, 0], [-6, 14], [0, 26, 1], [4, 12], [3, 0]], C.mal, { line: 0.8 }), 0));
  return d;
}

/** 花狐貂 let loose: "like a white elephant, wings grown from its sides" (ch 40). The hound's frame, heavier, with wings, tusks and a long tail. */
export function marten() {
  const d = hound(false);
  d.parts.push(P('wing', 'body', [-2, -9], 9, (g) => { g.body([[4, 2], [-6, -18], [-26, -34], [-50, -36, 1], [-36, -26], [-46, -16, 1], [-28, -14], [-32, -2, 1], [-12, -4]], C.ochre, { line: 1 }); g.cut((c) => { for (let i = 0; i < 3; i++) slit(c, -12 - i * 9, -20 - i * 3, -8 - i * 8, -6, 1.4, 1); }); }, 0));
  d.parts.push(P('tusk', 'neck', [26, -12], 12, (g) => { g.body([[0, 0], [10, 4], [18, -4, 1], [8, 8], [-2, 5]], C.gold, { line: 0.8 }); g.body([[-30, 0], [-46, -6], [-64, 2, 1], [-46, 2]], C.white, { line: 0 }); }, 0));
  d.parts.push(P('spots', 'body', [0, 0], 10.5, (g) => { for (const [x, y] of [[-16, -3], [-4, -5], [8, -3], [18, -4]]) g.body(circle(2.4, 8, x, y), C.ochre, { line: 0 }); }, 0));
  return d;
}
