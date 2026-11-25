// The Zhou troops of SPEC-SURVIVORS section 6: eight kinds, each in five ranks. A rank is a new figure, designed from the
// outline inward: every step adds mass to the silhouette, so that the five can be put in order from a grey picture at
// game size (a man is about 55 px tall).
//
//   rank 1 卒 levy:        a bare head with a topknot, cloth, a small plain weapon                         (size 1.00)
//   rank 2 锐士 picked:     a helm with a short upright crest, round shoulder pads, a larger weapon head    (1.045)
//   rank 3 甲士 armoured:   wide shoulder plates and a flared armoured skirt, a tall swept crest            (1.09)
//   rank 4 玄甲 dark guard: dark lacquer, winged shoulders, a wider skirt, a taller crest, a cloak, a back flag (1.135)
//   rank 5 神兵 blessed:    two long pheasant plumes, a celestial sash flying in an arc over the head, gold edging
//                          broad enough to see, a great weapon head shaped by the element, a cloud under the feet (1.18)
//
// The joints are those of the first game's Zhou soldier (t h au al bu bl lu ll ku kl w s ...), so its poses drive them.
import { C, FACE } from './base-figures.js';
import { slit, ring, scales, petals } from './engine.js';

const P = (id, parent, at, z, draw, rot = 0, world = false) => ({ id, parent, at, z, draw, rot, world });
const sc = (pts, k) => pts.map((q) => [q[0] * k, q[1] * k, q[2]]);
const at = (pts, x, y, k = 1) => pts.map((q) => [q[0] * k + x, q[1] * k + y, q[2]]);
export const TROOP_ELEMENT = { shields: 'earth', spears: 'metal', archers: 'wood', strongmen: 'earth', chariots: 'metal', tigers: 'fire', acolytes: 'water', hooks: 'wood' };
export const GROW = [1, 1.045, 1.09, 1.135, 1.18];
const PIG = { fire: () => C.red, water: () => C.azu, wood: () => C.mal, metal: () => C.gold, earth: () => C.ochre };
// The head of a blessed weapon, shaped by its element. Drawn along +x from (x, 0); k: size.
//   fire: a flame blade; water: a frost crescent; wood: a leaf blade; metal: a toothed gold edge; earth: a stone mace
export function elementHead(g, el, x, k = 1) {
  const col = PIG[el](), o = { line: 1.1 };
  if (el === 'fire') { g.body(at([[0, -3], [10, -9], [8, -18], [18, -12], [22, -26, 1], [30, -10], [44, -8, 1], [32, 0], [40, 9, 1], [24, 6], [14, 10], [0, 3]], x, 0, k), col, o); g.body(at([[6, -1], [20, -5], [30, -2], [20, 2]], x, 0, k), C.gold, { line: 0.5 }); }
  else if (el === 'water') { g.body(at([[0, -3], [8, -4], [10, -20], [22, -30, 1], [18, -14], [22, 0], [18, 14], [22, 30, 1], [10, 20], [8, 4], [0, 3]], x, 0, k), col, o); g.body(at([[12, -8], [17, 0], [12, 8]], x, 0, k), C.white, { line: 0.6 }); }
  else if (el === 'wood') { g.body(at([[0, -3], [10, -12], [26, -15], [46, 0, 1], [26, 15], [10, 12], [0, 3]], x, 0, k), col, o); g.cut((c) => slit(c, x + 8 * k, 0, x + 38 * k, 0, 1.6 * k)); }
  else if (el === 'metal') { g.body(at([[0, -3], [6, -6], [8, -20, 1], [14, -9], [18, -24, 1], [24, -10], [29, -22, 1], [34, -8], [46, 0, 1], [34, 6], [20, 9], [6, 6], [0, 3]], x, 0, k), col, o); }
  else { g.body(at([[0, -4], [8, -6], [12, -15, 1], [26, -17, 1], [35, -8, 1], [35, 8, 1], [26, 17, 1], [12, 15, 1], [8, 6], [0, 4]], x, 0, k), col, o); g.cut((c) => { for (const [a, b] of [[18, -8], [27, 0], [18, 8]]) { c.beginPath(); c.rect(x + (a - 2.4) * k, (b - 2.4) * k, 4.8 * k, 4.8 * k); c.fill(); } }); }
}

/** One soldier. kind: shields | spears | archers | tigers | acolytes | hooks; rank 1..5. */
export function soldier(kind, rank) {
  const el = TROOP_ELEMENT[kind], pig = PIG[el](), parts = [], acolyte = kind === 'acolytes', tiger = kind === 'tigers';
  const tunic = rank === 1 ? C.azuThin : C.azu, dark = rank >= 4, armour = [null, C.dan, C.gold, C.lacquer, C.lacquer][rank - 1], trim = rank === 5 ? C.gold : pig;
  // the shoulders: nothing, a round pad, a wide plate, a winged plate, a winged plate edged in gold
  const armU = (g) => { g.body([[-3.8, -4], [3.8, -4], [3.4, 8], [2.8, 19], [-2.8, 19], [-3.8, 8]], tunic);
    if (acolyte) return;
    if (rank === 2) g.body([[-6.5, -6], [0, -9], [6.5, -6], [7, 1], [0, 5], [-7, 1]], C.dan, { line: 1 });
    if (rank === 3) g.body([[-12, -6], [-2, -11], [9, -9], [13, -1], [8, 7], [-6, 7], [-13, 1]], C.gold, { line: 1.1 });
    if (rank >= 4) { g.body([[-15, -9, 1], [-4, -12], [8, -11], [17, -17, 1], [15, -3], [8, 8], [-7, 8], [-15, 1]], C.lacquer, { line: 1.1 }); g.tint([[-17, 2, 1], [17, 2, 1], [17, 8.5, 1], [-17, 8.5, 1]], trim); } };
  const armL = (g) => { g.body([[-2.8, -2], [2.8, -2], [2.4, 12], [3.2, 17], [0.6, 20.5], [-2.6, 19.5], [-3.2, 16], [-2.4, 12]], dark ? C.zhong : C.qing); if (rank >= 3 && !acolyte) g.tint([[-4, 2, 1], [4, 2, 1], [4, 11, 1], [-4, 11, 1]], rank === 3 ? C.gold : C.lacquer); };
  const legU = (g) => g.body([[-4.6, -4], [4.6, -4], [4, 11], [3, 26], [-3, 26], [-4.4, 11]], dark ? C.zhong : C.qing);
  const legL = (g) => { g.body(rank >= 3 ? [[-4.2, -3], [4.2, -3], [4, 13], [3.2, 24], [10.4, 26.5, 1], [9.8, 30, 1], [-3.8, 30, 1], [-3.6, 13]] : [[-3, -2], [3, -2], [2.8, 13], [2.8, 24], [9.6, 26.5, 1], [9, 30, 1], [-3.4, 30, 1], [-2.8, 13]], dark ? C.lacquer : rank === 3 ? C.gold : C.zhong);
    if (rank >= 4) g.tint([[-5.5, -1, 1], [5.5, -1, 1], [5.5, 4, 1], [-5.5, 4, 1]], trim); };

  parts.push(P('t', null, [0, 0], 20, (g) => {
    if (acolyte) {                                                                                                                  // a Daoist's robe: the hem wider with every rank; at 5 it trails
      const w = 11 + rank * 2.6;
      g.body([[-8, -4], [-w, 14], [-w - 3, 30, 1], [-5, 27], [0, 31, 1], [5, 27], [w + 3, 30, 1], [w, 14], [8, -4]], rank >= 4 ? C.azu : C.azuThin, { line: 1 });
      if (rank >= 3) g.tint([[-w - 4, 21, 1], [w + 4, 21, 1], [w + 4, 27.5, 1], [-w - 4, 27.5, 1]], rank === 5 ? C.gold : C.qing);
    } else if (rank <= 2) g.body([[-9, -3], [-12.5, 10], [-11.5, 22], [-6, 18], [-1.5, 24], [4, 18], [9.5, 23], [11.5, 11], [9, -3]], C.qing);
    else {                                                                                                                          // a flared skirt of plates, wider with rank
      const w = [0, 0, 17, 20, 22][rank - 1];
      g.body([[-9, -4, 1], [9, -4, 1], [w, 17], [w - 2, 24, 1], [w * 0.36, 20], [0, 26, 1], [-w * 0.36, 20], [-w + 2, 24, 1], [-w, 17]], armour, { line: 1.1 });
      if (rank === 3) g.cut((k, r) => scales(k, r, -11, 3, 12, 16, 6.4));
      else g.tint([[-w - 2, 13, 1], [w + 2, 13, 1], [w + 2, rank === 5 ? 20 : 18, 1], [-w - 2, rank === 5 ? 20 : 18, 1]], trim);
    }
    const body = [[-7.5, 2], [-9, -12], [-9.5, -27], [-6, -35], [1.5, -38], [8, -34], [10.5, -22], [9, -7], [7.5, 2]];
    const wide = [[-9.5, 2], [-11.5, -12], [-12.5, -27], [-8, -36.5], [1.5, -40], [10.5, -35.5], [13.5, -22], [11.5, -7], [9.5, 2]];
    if (acolyte) { g.body(body, rank >= 4 ? C.azu : C.azuThin, { line: 1 }); g.ink([[2, -36], [-3, -20], [-1, -2]], 1); if (rank >= 2) g.tint([[2, -38], [8, -34], [3, -18], [-3, -20]], C.qing); }
    else if (rank === 1) g.body(body, tunic);
    else if (rank === 2) { g.body(body, tunic); g.tint([[-10, -31], [11, -31], [11, -8], [-10, -8]], C.dan); g.cut((k) => slit(k, -5, -19, 7, -19, 1)); }
    else if (rank === 3) { g.body(wide, C.gold, { line: 1.1 }); g.cut((k, r) => scales(k, r, -7, -30, 10, -10, 6.6)); }
    else { g.body(wide, C.lacquer, { line: 1.1 }); for (const y of [-29, -13]) g.tint([[-14, y, 1], [15, y, 1], [15, y + (rank === 5 ? 6 : 4.5), 1], [-14, y + (rank === 5 ? 6 : 4.5), 1]], trim);
      if (rank === 5) g.body([[-4, -22.5, 1], [6, -22.5, 1], [6, -14, 1], [-4, -14, 1]], pig === C.gold ? C.red : pig, { line: 0.8 }); }
    g.tint([[-12, -5, 1], [12, -5, 1], [12, -0.5, 1], [-12, -0.5, 1]], C.red);                                                       // the cinnabar belt: every Zhou figure has it
    if (tiger) { g.body([[-10, -37], [9, -38], [13, -22], [6, -12], [-4, -9], [-12, -20]], C.gold, { line: 1 }); g.cut((k) => { for (let i = 0; i < 4; i++) slit(k, -8 + i * 4.6, -33, -5 + i * 4.6, -17, 1.6, 1); }); }   // a tiger's pelt over the shoulders
  }));
  // rank 5: the celestial sash of a guardian figure: from the shoulders it flies up in an arc over the head, and its two ends stream behind
  if (rank === 5) parts.push(P('sash', 't', [0, -30], 1, (g) => {
    const col = pig === C.red ? C.gold : pig;
    g.body([[-13, 4], [-27, -16], [-25, -42], [-9, -60], [9, -62], [25, -46], [29, -20], [17, 2], [12, 0], [22, -20], [19, -41], [7, -54], [-7, -52], [-19, -38], [-20, -17], [-9, 2]], col, { line: 0.9 });
    g.body([[-11, 2], [-30, 12], [-42, 34], [-58, 44, 1], [-46, 30], [-52, 22, 1], [-36, 20], [-26, 8]], col, { line: 0.9 });
    g.body([[14, 2], [30, 14], [36, 34], [48, 44, 1], [30, 36], [22, 18]], col, { line: 0.9 });
  }, 0));
  // the cloak (rank 4), the tiger guard's hanging pelt
  if (rank === 4 || (tiger && rank < 5)) { const L = rank === 4 ? 36 : 14 + rank * 4, col = tiger ? C.gold : C.red;
    parts.push(P('c', 't', [-6, -32], 14, (g) => {
      g.body([[3, -4], [-8, -5], [-18, 4], [-22 - L * 0.14, L * 0.55], [-28 - L * 0.2, L + 6, 1], [-18, L - 2], [-12, L + 8, 1], [-7, L * 0.7], [-3, 18], [3, 4]], col, { line: 0.9 });
      if (tiger) g.cut((k) => { for (let i = 0; i < 3; i++) slit(k, -6 - i * 2, 6 + i * (L / 4), -17 - i * 1.5, 9 + i * (L / 4), 1.6, 1); });
    }, 4)); }
  // rank 4: one flag on a rod behind the shoulder
  if (rank === 4 && !acolyte) parts.push(P('flag', 't', [-8, -30], 2, (g) => { g.strip([[0, 6], [0, -58]], 1.8, C.lacquer); g.body([[-1, -58, 1], [-1, -34, 1], [-19, -40], [-13, -46], [-21, -56, 1]], pig === C.red ? C.gold : pig, { line: 0.8 }); }, -8));
  parts.push(P('h', 't', [1, -36], 22, (g) => {
    const k7 = 0.7;
    g.body(sc(FACE, k7), C.white); g.ink(sc([[2, -14.2], [5.5, -15.8], [9.4, -16.6]], k7), 1.15);
    if (acolyte) {                                                                                                                  // two buns; a small crown at 3; a tall crown at 4; a lotus crown of gold with two ribbons at 5
      g.body(sc([[11, -22, 1], [9, -28], [0, -31], [-9, -27], [-11, -16], [-6, -18], [1, -23]], k7), C.nong, { line: 0.8 });
      if (rank < 3) for (const x of rank === 1 ? [-1] : [-6, 3]) g.body([[x - 3.8, -19], [x, -26 - rank], [x + 3.8, -19], [x, -15.5]], C.nong, { line: 0.7 });
      else { const h = [0, 0, 11, 19, 27][rank - 1]; g.body([[-7, -19.5, 1], [-9, -19.5 - h * 0.6], [-4, -19.5 - h * 0.45], [-1, -19.5 - h], [2, -19.5 - h * 0.45], [7, -19.5 - h * 0.6], [5.5, -19.5, 1]], rank === 5 ? C.gold : C.qing, { line: 1 }); g.strip([[-11, -22 - h * 0.3], [10, -23 - h * 0.3]], 1.5, C.nong);
        if (rank === 5) for (const d of [-1, 1]) g.body([[d * 9, -24], [d * 15 - 6, -8], [d * 12 - 14, 16, 1], [d * 10 - 5, -6]], C.gold, { line: 0.6 }); }
      return; }
    if (rank === 1) { g.body(sc([[11, -22, 1], [9, -28], [0, -31], [-9, -27], [-11, -15], [-6, -17], [1, -23]], k7), C.nong, { line: 0.8 }); g.body([[-3, -20], [-4.6, -26.5], [0, -29], [3.6, -25.5], [2.4, -20]], C.nong, { line: 0.7 }); g.strip([[-4, -21], [3.4, -21.4]], 1.4, C.red); return; }   // a topknot tied with a red cord
    const big = rank >= 3, helm = rank >= 4 ? C.lacquer : C.gold, y0 = big ? -27 : -25;
    g.body(sc(big ? [[13, -21, 1], [12, -31], [4, -39], [-7, -38], [-14.5, -28], [-16, -14], [-22, 1, 1], [-10, -3], [-7, -16], [1, -23]] : [[11.5, -22, 1], [10.5, -29], [4, -36], [-5, -35], [-11.5, -27], [-13, -14], [-16.5, -2, 1], [-8, -5], [-6, -16], [1, -23]], k7), helm, { line: 1 });
    if (rank >= 4) { g.tint(sc([[14, -25, 1], [-12, -27, 1], [-12, -20, 1], [14, -18.5, 1]], k7), trim); for (const d of [-1, 1]) g.body([[d * 7 - 1, -16], [d * 15 - 1, -24 - (rank - 4) * 3, 1], [d * 11 - 1, -12]], trim, { line: 0.7 }); }     // wings on the helm
    if (tiger) for (const x of [-7, 3]) g.body([[x - 2.8, y0 + 1.5], [x - 1, y0 - 8 - rank], [x + 4.4, y0 - 1]], C.gold, { line: 0.8 });   // the tiger's ears: the tiger guard's own top line
    if (rank === 2) { g.body([[-3.6, y0 + 1], [-4.6, y0 - 11], [-1, y0 - 15, 1], [3, y0 - 11], [3.2, y0 + 1]], C.red, { line: 0.8 }); return; }   // a short upright crest
    const plume = (dx, len, col) => g.body([[dx + 1.5, y0 + 1], [dx - 2, y0 - len * 0.5], [dx - len * 0.5, y0 - len], [dx - len * 1.15, y0 - len * 0.95], [dx - len * 1.5, y0 - len * 0.62, 1], [dx - len * 1.05, y0 - len * 0.72], [dx - len * 0.5, y0 - len * 0.62], [dx - 7, y0 - len * 0.26], [dx - 4.4, y0 + 1]], col, { line: 0.8 });
    if (rank === 3) plume(1, 23, C.red);
    if (rank === 4) plume(1, 31, C.red);
    if (rank === 5) {                                                                                                               // two pheasant plumes, long, barred, sweeping back and up; a cinnabar tuft between them
      for (const [dx, rise, reach] of [[-3, 66, 84], [2, 80, 64]]) { g.body([[dx - 1.6, y0], [dx - 5, y0 - rise * 0.45], [dx - reach * 0.4, y0 - rise * 0.9], [dx - reach, y0 - rise, 1], [dx - reach * 0.42, y0 - rise * 0.8], [dx - 1, y0 - rise * 0.4], [dx + 2, y0]], C.gold, { line: 0.8 });
        g.cut((k) => { for (let i = 1; i < 5; i++) { const t = i / 5.5, x = dx - reach * (0.1 + t * 0.8), y = y0 - rise * (0.5 + t * 0.48); slit(k, x - 3, y - 4, x + 3, y + 4, 1.5); } }); }
      plume(1, 17, C.red);
    }
  }));
  parts.push(P('au', 't', [2, -31], 26, armU), P('al', 'au', [0, 17], 27, armL));
  parts.push(P('bu', 't', [1, -31], 6, armU), P('bl', 'bu', [0, 17], 5, armL));
  parts.push(P('lu', 't', [2, 1], 16, legU), P('ll', 'lu', [0, 24], 15, legL));
  parts.push(P('ku', 't', [-2, 1], 8, legU), P('kl', 'ku', [0, 24], 7, legL));

  const shaft = (g, a, b) => { g.strip([[a, 0], [b, 0]], 2.2 + rank * 0.22, rank >= 3 ? C.lacquer : C.nong); if (rank >= 3) for (const x of [b * 0.22, b * 0.44]) g.body([[x - 2.6, -2.6, 1], [x + 2.6, -2.6, 1], [x + 2.6, 2.6, 1], [x - 2.6, 2.6, 1]], rank === 5 ? C.gold : C.red, { line: 0.5 }); };
  if (kind === 'shields') {
    // the shield: a small round-headed board; taller with a boss; broad with a spiked head; lacquer, broader still; a great lacquer shield edged thick in gold with the element's face
    const h = [24, 30, 36, 41, 46][rank - 1], w = [9, 11, 14, 16.5, 19][rank - 1], face = dark ? C.lacquer : C.qing, edge = rank === 5 ? C.gold : rank === 4 ? pig : C.azu;
    parts.push(P('s', 'bl', [0, 14], 30, (g) => {
      const head = rank >= 3 ? [[-w * 0.5, -h + 3], [0, -h - 10 - rank * 2, 1], [w * 0.5, -h + 3]] : [[-w * 0.5, -h], [0, -h - 2], [w * 0.5, -h]];
      g.body([[-w, -h + 8], ...head, [w, -h + 8], [w + 1.5, 0], [w, h - 6], [0, h], [-w, h - 6], [-w - 1.5, 0]], face, { line: 1.3 });
      if (rank >= 2) g.tint([[-w - 2, -6, 1], [w + 2, -6, 1], [w + 2, rank === 5 ? 7 : 5, 1], [-w - 2, rank === 5 ? 7 : 5, 1]], edge);
      if (rank >= 4) for (const y of [-h + 9, h - 13]) g.tint([[-w - 2, y, 1], [w + 2, y, 1], [w + 2, y + (rank === 5 ? 7 : 5), 1], [-w - 2, y + (rank === 5 ? 7 : 5), 1]], edge);
      if (rank >= 2) g.cut((k) => { ring(k, 0, -0.5, 4.4, 1.5); if (rank >= 3) petals(k, 0, -0.5, 6.6, 9.6, 6, 1.2, 0.3); });
      if (rank === 5) g.body([[-7, -h * 0.5], [0, -h * 0.5 - 9], [7, -h * 0.5], [0, -h * 0.5 + 9]], pig, { line: 0.9 });
    }, 0, true));
    parts.push(P('w', 'al', [0, 18], 24, (g) => {                                                                                    // a dagger; a sword; a broad sword; a heavy blade; a stone mace
      if (rank === 5) { g.strip([[-6, 0], [26, 0]], 3.4, C.lacquer); elementHead(g, el, 24, 0.9); return; }
      const L = [22, 36, 44, 50][rank - 1], wd = [2, 3, 4.4, 5.4][rank - 1];
      g.body([[4, -wd, 1], [L * 0.6, -wd - 1], [L - 7, -wd * 0.8], [L, 0, 1], [L - 7, wd * 0.8], [L * 0.6, wd + 1], [4, wd, 1]], C.gold, { line: 0.9 }); g.body([[2.4, -wd - 3, 1], [5, -wd - 3, 1], [5, wd + 3, 1], [2.4, wd + 3, 1]], C.nong, { line: 0.6 }); g.strip([[-5, 0], [3, 0]], 2.2, C.nong);
    }, 0, true));
  }
  if (kind === 'spears' || kind === 'hooks') {
    const head = (b) => (g) => {
      const col = C.gold;
      if (rank === 5) { elementHead(g, el, b - 2, kind === 'spears' ? 1.05 : 0.95); if (kind === 'hooks') g.body([[b + 8, 3], [b + 20, 18], [b + 8, 30, 1], [b + 13, 17], [b + 2, 6]], PIG[el](), { line: 0.9 }); return; }
      if (kind === 'spears') {                                                                                                      // a plain point; a point and a side blade (戈); a larger one with a long tassel; a halberd with a crescent
        g.body([[b - 1, -1.6 - rank * 0.3, 1], [b + 13 + rank * 3, 0, 1], [b - 1, 1.6 + rank * 0.3, 1]], col, { line: 0.8 });
        if (rank >= 2) { const s = 0.8 + rank * 0.16; g.body([[b - 15 * s, 1.2, 1], [b - 10 * s, 8 * s], [b - 8 * s, 27 * s, 1], [b - 3, 9 * s], [b - 1, 1.2, 1]], col, { line: 0.9 }); g.body([[b - 14, -1], [b - 22, -9], [b - 20, -16 - rank * 4, 1], [b - 12, -10]], C.red, { line: 0.7 }); }
        if (rank === 4) g.body([[b - 4, -2], [b + 4, -14], [b + 16, -19, 1], [b + 8, -9], [b + 14, 2, 1], [b + 4, -3]], col, { line: 0.9 });
      } else {                                                                                                                      // 挠钩: one hook; two; three with a point; a great double hook
        const s = 0.8 + rank * 0.14;
        g.body([[b - 2, -1.6, 1], [b + 9 * s, -3], [b + 15 * s, -11 * s], [b + 11 * s, -24 * s, 1], [b + 9 * s, -11 * s], [b + 3, -6]], col, { line: 0.9 });
        if (rank >= 2) g.body([[b - 2, 1.6, 1], [b + 9 * s, 3], [b + 15 * s, 11 * s], [b + 11 * s, 24 * s, 1], [b + 9 * s, 11 * s], [b + 3, 6]], col, { line: 0.9 });
        if (rank >= 3) g.body([[b - 1, 1.6, 1], [b + 18 * s, 0, 1], [b - 1, -1.6, 1]], col, { line: 0.7 });
        if (rank >= 2) g.strip([[-40, 0], [-46, 9], [-41, 18], [-49, 27 + rank * 2]], 1.5, C.nong);                                    // the chain's free end
      }
    };
    const L = [70, 78, 86, 94, 100][rank - 1], piece = (a, b) => (g) => { shaft(g, a, b); head(b)(g); };
    parts.push(P('w', 'al', [0, 18], 24, piece(-44, L), 0, true), P('wb', 'al', [0, 18], 24.1, piece(-14, L + 40), 0, true));
  }
  if (kind === 'archers') {
    const b = [0.74, 1, 1.14, 1.26, 1.4][rank - 1], col = dark ? C.lacquer : C.nong, th = 2.4 + rank * 0.35;
    // rank 1: a levy's short bow and a few arrows in a case at the hip; from rank 2 the quiver rides on the back and its arrows fan above the head
    if (rank === 1) parts.push(P('q', 't', [-6, -3], 3, (g) => { g.body([[-4, -4], [4, -4], [3.4, 16], [-3.4, 16]], C.qing, { line: 1 }); for (const x of [-2, 2]) { g.strip([[x, -4], [x, -13]], 1.2, C.nong); g.body([[x - 2, -9, 1], [x, -15, 1], [x + 2, -9, 1]], C.red, { line: 0.5 }); } }, 34));
    else parts.push(P('q', 't', [-7, -29], 3, (g) => { const hq = 24 + rank * 3; g.body([[-4.6 - rank * 0.4, -5], [4.6 + rank * 0.4, -5], [3.6, hq], [-3.6, hq]], dark ? C.lacquer : C.qing, { line: 1 }); g.tint([[-7, 0, 1], [7, 0, 1], [7, 4.5, 1], [-7, 4.5, 1]], rank >= 4 ? trim : C.azu);
      for (let i = 0; i < 1 + rank; i++) { const x = -4.5 + i * (9 / rank), top = -26 - (i % 2) * 5 - rank * 3.4 - (rank === 2 ? 7 : 0); g.strip([[x, -4], [x, top]], 1.3, C.nong); g.body([[x - 2.6, top + 9, 1], [x, top - 1, 1], [x + 2.6, top + 9, 1]], rank === 5 ? pig : C.red, { line: 0.5 }); } }, -14));
    const tips = (g, pts) => { if (rank < 3) return; for (const d of [-1, 1]) { const [x, y] = pts; g.body(sc([[x - 2, d * y], [x + 5, d * (y + 10 + rank)], [x - 6, d * (y + 6)]], b), rank === 5 ? pig : C.gold, { line: 0.7 }); } };
    parts.push(P('w', 'bl', [0, 18], 4, (g) => { g.strip(sc([[-13, -42], [-2, -31], [6, -13], [7, 0], [6, 13], [-2, 31], [-13, 42]], b), th, col); g.ink(sc([[-11, -44], [-11, 44]], b), 0.7); tips(g, [-13, 41]);
      if (rank === 5) for (const d of [-1, 1]) g.body(sc([[2, d * 22], [14, d * 30, 1], [6, d * 14]], b), pig, { line: 0.7 }); }, 0, true));
    parts.push(P('wd', 'bl', [0, 18], 4.1, (g) => { g.strip(sc([[-19, -38], [-5, -30], [5, -13], [7, 0], [5, 13], [-5, 30], [-19, 38]], b), th, col); g.ink(sc([[-17, -40], [-34, 0], [-17, 40]], b), 0.8); tips(g, [-19, 37]);
      g.strip([[-34 * b, 0], [28 * b, 0]], 1.8, C.nong); if (rank === 5) elementHead(g, el, 24 * b, 0.55); else g.body([[26 * b, -3, 1], [38 * b, 0, 1], [26 * b, 3, 1]], C.gold, { line: 0.7 }); }, 0, true));
  }
  if (tiger) parts.push(P('w', 'al', [0, 18], 24, (g) => {                                                                            // a club; a blade; a great blade (大刀); a great blade with rings; a flame blade
    const L = [34, 46, 56, 64, 60][rank - 1];
    g.strip([[-26, 0], [L * 0.45, 0]], 2.4 + rank * 0.3, rank >= 3 ? C.lacquer : C.nong);
    if (rank === 5) { elementHead(g, el, L * 0.42, 1.25); return; }
    if (rank === 1) { g.body([[L * 0.4, -3, 1], [L, -5.5], [L + 5, 0], [L, 5.5], [L * 0.4, 3, 1]], C.zhong, { line: 1 }); return; }
    const up = 5 + rank * 2.4;
    g.body([[L * 0.42, -3, 1], [L * 0.7, -up * 0.8], [L, -up - 3, 1], [L + 5, 0], [L * 0.9, 5], [L * 0.42, 3, 1]], C.gold, { line: 1 });
    if (rank >= 3) g.body([[L * 0.44, 2], [L * 0.36, 12], [L * 0.44, 25, 1], [L * 0.5, 11]], C.red, { line: 0.7 });
    if (rank === 4) g.cut((k) => { for (let i = 0; i < 3; i++) ring(k, L * (0.6 + i * 0.12), -up * 0.42, 2, 1); });
  }, 0, true));
  if (acolyte) {
    parts.push(P('w', 'al', [0, 18], 24, (g) => {                                                                                    // a talisman held up: a slip of yellow paper with a sign in cinnabar; larger with rank; at 5 a frost crescent rides on it
      const s = [0.9, 1.1, 1.3, 1.5, 1.7][rank - 1]; g.body([[2, -5 * s, 1], [2 + 15 * s, -5 * s, 1], [2 + 15 * s, 5 * s, 1], [2, 5 * s, 1]], C.gold, { line: 0.8 }); g.tint([[6, -2.4 * s, 1], [2 + 11 * s, -2.4 * s, 1], [2 + 11 * s, 2.4 * s, 1], [6, 2.4 * s, 1]], C.red);
      if (rank === 5) elementHead(g, el, 2 + 17 * s, 0.8);
    }, 0, true));
    if (rank >= 2) parts.push(P('wh', 'bl', [0, 18], 4, (g) => { g.strip([[-6, 0], [16, 0]], 1.8, C.nong); const e = rank * 5; g.body([[16, -2], [26, -6], [36 + e, 2, 1], [28, 3], [34 + e, 13, 1], [24, 7], [16, 2]], C.white, { line: 1.2 }); }, 30, true));   // a fly-whisk
    if (rank >= 3) parts.push(P('sw', 't', [-6, -26], 2, (g) => { const top = -30 - rank * 6; g.strip([[0, 20], [0, top]], 2.8, dark ? C.lacquer : C.nong); g.body([[-5, -12, 1], [5, -12, 1], [5, -8.5, 1], [-5, -8.5, 1]], C.gold, { line: 0.6 }); g.body([[-3, top], [0, top - 8], [3, top]], C.red, { line: 0.6 }); g.body([[1, top + 2], [-10, top + 10], [-13, top + 26, 1], [-5, top + 12]], C.red, { line: 0.6 }); }, -24));   // a sword on the back
    if (rank >= 4) parts.push(P('halo', 'h', [0, -14], 1, (g) => { const r = rank === 5 ? 21 : 15, pts = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } g.strip(pts, rank === 5 ? 3.2 : 2, rank === 5 ? C.gold : pig); }));
  }
  return { parts, feet: [{ id: 'll', pt: [2, 30] }, { id: 'kl', pt: [2, 30] }] };
}

/** The cloud scroll a blessed (rank 5) figure stands on, in place of a shadow. k: its width against a soldier's. */
export function cloud() {
  return { parts: [P('cloud', null, [0, 0], 0, (g) => {
    g.body([[-27, 0], [-33, -6], [-27, -13], [-17, -10], [-12, -17], [-1, -19], [8, -13], [17, -17], [28, -12], [33, -4], [26, 2], [10, 5], [-12, 5]], C.white, { line: 1.5 });
    g.ink([[-25, -5], [-20, -9], [-15, -5], [-19, -2]], 1); g.ink([[-6, -10], [1, -14], [6, -9], [1, -6], [-2, -9]], 1); g.ink([[14, -9], [21, -12], [26, -7], [21, -4]], 1);
  })], feet: [{ id: 'cloud', pt: [0, 4] }] };
}

/** The squad's standard, carried by one man of a squad from rank 2: a pennon, a standard, a larger one, a great banner. */
export function standard(rank, el) {
  const pig = PIG[el] ? PIG[el]() : C.red, d = soldier('spears', Math.max(1, rank - 1));
  const parts = d.parts.filter((p) => p.id !== 'w' && p.id !== 'wb');
  parts.push(P('w', 'al', [0, 18], 24, (g) => { const H = [0, 74, 104, 134, 168][rank - 1], col = rank >= 4 ? pig : C.red;
    g.strip([[-36, 0], [H, 0]], 2.6, rank >= 3 ? C.lacquer : C.nong); g.body([[H, -3, 1], [H + 14, 0, 1], [H, 3, 1]], C.gold, { line: 0.7 });
    if (rank === 2) g.body([[H - 2, 2], [H - 28, 4], [H - 17, 28, 1], [H - 12, 12], [H - 2, 17]], C.red, { line: 0.8 });
    else { const w = [0, 0, 26, 36, 50][rank - 1], l = [0, 0, 38, 54, 74][rank - 1];                                                   // the cloth hangs from the pole: l along it, w out from it
      g.body([[H - 3, 2, 1], [H - 3 - l, 2, 1], [H - 3 - l + 9, 2 + w * 0.5], [H - 3 - l, 2 + w, 1], [H - 3, 2 + w, 1]], col, { line: 0.9 });
      g.tint([[H - 3 - l * 0.42, 1, 1], [H - 3 - l * 0.3, 1, 1], [H - 3 - l * 0.3, 3 + w, 1], [H - 3 - l * 0.42, 3 + w, 1]], rank >= 4 ? C.gold : C.azu);
      if (rank >= 4) { g.tint([[H - 2, 1, 1], [H - 8, 1, 1], [H - 8, 3 + w, 1], [H - 2, 3 + w, 1]], C.gold); g.cut((k) => ring(k, H - 3 - l * 0.68, 2 + w * 0.5, w * 0.2, 1.8)); }
      if (rank === 5) { for (const y of [w + 2, w + 12]) g.body([[H - 6, y], [H - 34, y + 6], [H - 62, y - 1, 1], [H - 34, y + 10]], C.gold, { line: 0.6 }); elementHead(g, el, H + 6, 0.7); } }
  }, -78, true));
  return { parts, feet: d.feet };
}
