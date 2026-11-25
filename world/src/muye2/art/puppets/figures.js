// Puppet definitions made for the field game (the survivors-like view). The engine and the first game's figures are
// copies (engine.js, base-figures.js, base-poses.js); what is new for this view is here.
//
// At game size a foot figure is about 60 px tall, so one design unit is about half a screen pixel. The rule for the
// mass: no shape narrower than 4 units, no cut at all on limbs, one accent per kind that an 8 px blur keeps.
import { C, FACE_PTS } from './base-figures.js';
import { slit, dot, ring } from './engine.js';

const P = (id, parent, at, z, draw, rot = 0, world = false) => ({ id, parent, at, z, draw, rot, world });
const sc = (pts, k) => pts.map((q) => [q[0] * k, q[1] * k, q[2]]);
const J = { jit: 0.03 }, Jl = (line) => ({ jit: 0.03, line });
const L = () => C.lacquer;

// ------------------------------------------------------------------ the Shang mass
// The same people as the detailed Shang (squat, square, flanged, lacquer black, malachite and a little gold), with the
// same joints, so that the first game's poses drive them. kind: 'spear' | 'axe' | 'shield' | 'archer' | 'shaman'.
//   spear:  the accent is the tall flanged crest (malachite), and the long 戈
//   axe:    the accent is the broad bronze axe head
//   shield: the accent is the mask shield: two pale eyes in a black square, two bronze horns
//   archer: the accent is the tall black bow
export function mass(kind) {
  const parts = [], crest = kind === 'spear' ? 15 : kind === 'shaman' ? 0 : 6;
  const armU = (g) => g.body([[-4.6, -4], [4.6, -4], [4.2, 16], [-4.2, 16]], L(), J);
  const armL = (g) => { g.body([[-3.8, -2], [3.8, -2], [3.6, 13], [-3.6, 13]], L(), J); g.body([[-3.2, 12], [3.2, 12], [3.4, 17.5], [-3.4, 17.5]], C.qing, Jl(0.8)); };
  const legU = (g) => g.body([[-6.2, -4], [6.2, -4], [5.4, 20], [-5.4, 20]], L(), J);
  const legL = (g) => g.body([[-4.8, -2, 1], [4.8, -2, 1], [4.6, 17], [12, 19, 1], [12, 23, 1], [-4.8, 23, 1]], L(), J);

  parts.push(P('t', null, [0, 0], 20, (g) => {
    g.body([[-13, -2, 1], [13, -2, 1], [14.5, 18], [5.5, 22, 1], [0, 16], [-5.5, 22, 1], [-14.5, 18]], L(), J);                       // the skirt: one notch
    g.body([[-11, 2, 1], [-13, -10], [-15.5, -27], [-11, -35], [11, -35], [15.5, -27], [13, -10], [11, 2, 1]], L(), J);             // the cuirass, whole
    g.tint([[-15, -6, 1], [15, -6, 1], [15, 0.5, 1], [-15, 0.5, 1]], C.mal);                                                         // one band of malachite
    if (kind === 'shaman') g.body([[-6, -30], [0, -34], [6, -30], [4.5, -14], [0, -9, 1], [-4.5, -14]], C.gold, Jl(0.8));            // a bronze breast plate
  }));
  if (kind === 'shaman') parts.push(P('robe', 't', [0, 0], 21, (g) => {                                                               // a long robe: he does not march, he glides
    g.body([[-12, -3, 1], [12, -3, 1], [17, 20], [20, 41, 1], [9, 37], [0, 42, 1], [-9, 37], [-20, 41, 1], [-17, 20]], L(), J);
    g.tint([[-22, 30, 1], [22, 30, 1], [22, 36, 1], [-22, 36, 1]], C.mal);
  }));
  parts.push(P('h', 't', [1, -33], 22, (g) => {
    const K = 0.94, q = (pts) => sc(pts, K), top = -30 - crest;
    g.body(q([[-6, 3], [6, 3], [9.5, -2], [10, -7], [13, -8.8, 1], [11, -12.5], [10.8, -19], [-8, -19], [-9, -6]]), C.qing, Jl(1));  // the pale face, turned toward us
    g.ink(q([[0, -15.6], [9.6, -16.6]]), 1.8);                                                                                       // one heavy brow
    g.body(q([[11.8, -17, 1], [11, -24], [5, -29.5], [-6, -29.5], [-11.5, -24], [-12, -10], [-15.5, -10, 1], [-15.5, -2, 1], [-9, -2, 1], [-9, -16.5, 1]]), L(), J);
    g.tint(q([[13, -22, 1], [-10, -22, 1], [-10, -16.5, 1], [13, -16.5, 1]]), C.mal);
    if (kind === 'shaman') {                                                                                                          // the shaman: antlers of bronze, the tallest top line in the mass
      for (const d of [-1, 1]) g.body(q([[d * 3, -29, 1], [d * 6, -42], [d * 16, -52, 1], [d * 11, -42], [d * 20, -44, 1], [d * 11, -36], [d * 9, -29, 1]]), C.gold, Jl(0.9));
    } else g.body(q([[-9, -29, 1], [-9, top, 1], [-4.4, top, 1], [-4.4, top + 5, 1], [-0.4, top + 5, 1], [-0.4, top, 1], [4.4, top, 1], [4.4, top + 5, 1], [8.4, top + 5, 1], [8.4, top - (kind === 'spear' ? 4 : 0), 1], [11.4, top - (kind === 'spear' ? 4 : 0), 1], [11.4, -29, 1]]), C.mal, Jl(1));
  }));
  parts.push(P('au', 't', [4, -28], 26, armU), P('al', 'au', [0, 15], 27, armL));
  parts.push(P('bu', 't', [-1, -28], 6, armU), P('bl', 'bu', [0, 15], 5, armL));
  parts.push(P('lu', 't', [3, 1], 16, legU), P('ll', 'lu', [0, 18], 15, legL));
  parts.push(P('ku', 't', [-3, 1], 8, legU), P('kl', 'ku', [0, 18], 7, legL));

  if (kind === 'spear') {
    const ge = (a, b, red) => (g) => {
      g.strip([[a, 0], [b, 0]], 3.4, L());
      g.body([[b - 22, 1.5, 1], [b - 15, 9], [b - 11, 36, 1], [b - 3, 12], [b, 1.5, 1]], C.gold, Jl(1));
      g.body([[b - 12, -1.5, 1], [b - 2, -1.5, 1], [b - 2, -11, 1], [b - 12, -11, 1]], C.gold, Jl(0.8));
      if (red) { g.body([[b, -4, 1], [b + 15, 0, 1], [b, 4, 1]], C.red, Jl(0.8)); g.body([[b - 1, 3], [b - 6, 13], [b - 1, 28, 1], [b + 5, 12]], C.red, Jl(0.7)); }
    };
    parts.push(P('w', 'bl', [0, 16.5], 4, ge(-46, 92, false), 0, true), P('wb', 'bl', [0, 16.5], 4.1, ge(-20, 128, true), 0, true));
    parts.push(P('s', 'al', [0, 13], 30, (g) => { g.body([[-9, -20, 1], [9, -20, 1], [9, -15, 1], [13.5, -15, 1], [13.5, 15, 1], [9, 15, 1], [9, 20, 1], [-9, 20, 1], [-9, 15, 1], [-13.5, 15, 1], [-13.5, -15, 1], [-9, -15, 1]], L(), J); g.tint([[-15, -3, 1], [15, -3, 1], [15, 3, 1], [-15, 3, 1]], C.mal); }, 0, true));
  }
  if (kind === 'axe') parts.push(P('w', 'al', [0, 16.5], 24, (g) => {
    g.strip([[-30, 0], [62, 0]], 3.6, L());
    g.body([[42, -2, 1], [41, -9, 1], [24, -34, 1], [50, -42], [76, -34, 1], [59, -9, 1], [58, -2, 1]], C.gold, Jl(1.2));           // the broad blade: the accent
    g.cut((k) => { slit(k, 50, -30, 50, -14, 2.4); });
  }, 0, true));
  if (kind === 'shield') {
    parts.push(P('w', 'bl', [0, 16.5], 4, (g) => { g.strip([[-12, 0], [40, 0]], 3.4, L()); g.body([[26, -2, 1], [25, -8, 1], [14, -24, 1], [32, -30], [50, -24, 1], [39, -8, 1], [38, -2, 1]], C.gold, Jl(1)); }, 0, true));
    parts.push(P('s', 'al', [0, 13], 30, (g) => {
      for (const d of [-1, 1]) g.body([[d * 5, -31, 1], [d * 10, -46], [d * 22, -53, 1], [d * 16, -41], [d * 15, -31, 1]], C.gold, Jl(1));
      g.body([[-15, -33, 1], [15, -33, 1], [15, -27, 1], [23, -27, 1], [23, 27, 1], [15, 27, 1], [15, 34, 1], [-15, 34, 1], [-15, 27, 1], [-23, 27, 1], [-23, -27, 1], [-15, -27, 1]], L(), J);
      g.tint([[-24, 1, 1], [24, 1, 1], [24, 8, 1], [-24, 8, 1]], C.mal);
      g.cut((k) => { slit(k, -17, -20, -4, -10, 6, 1); slit(k, 17, -20, 4, -10, 6, -1); for (let i = 0; i < 3; i++) { k.beginPath(); k.rect(-12.5 + i * 9.4, 15, 6.2, 8); k.fill(); } });   // two eyes and three teeth, nothing finer
    }, 0, true));
  }
  if (kind === 'archer') {
    parts.push(P('q', 't', [-9, -30], 3, (g) => { g.body([[-6, -6, 1], [6, -6, 1], [5, 30], [-5, 30]], L(), J); for (const [x, top] of [[-3.6, -40], [1, -48]]) g.strip([[x, -5], [x, top]], 2.6, L()); }, -16));
    parts.push(P('w', 'bl', [0, 16.5], 4, (g) => { g.strip([[-15, -54], [-1, -38], [8.5, -16], [9.5, 0], [8.5, 16], [-1, 38], [-15, 54]], 4.6, L()); g.ink([[-17, -55], [-17, 55]], 1.1); }, 0, true));
    parts.push(P('wd', 'bl', [0, 16.5], 4.1, (g) => {
      g.strip([[-24, -49], [-6, -37], [7, -16], [9.5, 0], [7, 16], [-6, 37], [-24, 49]], 4.6, L()); g.ink([[-26, -50], [-45, 0], [-26, 50]], 1.2);
      g.strip([[-45, 0], [36, 0]], 3, L()); g.body([[32, -5, 1], [52, 0, 1], [32, 5, 1]], C.red, Jl(0.8));
    }, 0, true));
  }
  if (kind === 'shaman') {
    parts.push(P('w', 'al', [0, 16.5], 24, (g) => {                                                                                  // a staff with a bronze disc and hanging bells
      g.strip([[-44, 0], [70, 0]], 3, L());
      g.body([[58, -13], [70, -18], [82, -13], [87, 0], [82, 13], [70, 18], [58, 13], [53, 0]], C.gold, Jl(1.1)); g.cut((k) => { ring(k, 70, 0, 8.5, 2.6); dot(k, 70, 0, 2.6); });
      for (const x of [46, 38]) g.body([[x - 2.6, 1, 1], [x + 2.6, 1, 1], [x + 3.4, 11], [x, 15, 1], [x - 3.4, 11]], C.gold, Jl(0.7));
      g.body([[52, 2], [45, 12], [50, 30, 1], [56, 12]], C.mal, Jl(0.7));
    }, 0, true));
    parts.push(P('drum', 'bl', [0, 15], 4.5, (g) => {                                                                                // a hand drum on the far arm
      g.body([[0, -13], [9.5, -9.5], [13, 0], [9.5, 9.5], [0, 13], [-9.5, 9.5], [-13, 0], [-9.5, -9.5]], C.qing, Jl(1.4)); g.tint([[-4, -4], [4, -4], [4, 4], [-4, 4]], C.red);
    }, 0, true));
  }
  return { parts, feet: [{ id: 'll', pt: [3, 23] }, { id: 'kl', pt: [3, 23] }] };
}

// ------------------------------------------------------------------ the warband's mark and ornaments
// Added to the first game's Zhou figures (they are light already): `pennon`, a strip of cinnabar on a short rod behind
// the shoulder that stands above the head (the mark an 8 px blur keeps); at level 5 a tall crest.
export function bandExtras(tier) {
  const parts = [P('pen', 't', [-7, -30], 2, (g) => {
    g.strip([[0, 6], [0, -44]], 1.8, C.nong);
    g.body([[-1, -44, 1], [-1, -22], [-9, -19], [-13, -27, 1], [-9, -33], [-13, -40, 1], [-8, -45]], C.red, { line: 0.8 });
    if (tier >= 3) g.body([[-2.6, -50, 1], [0, -56, 1], [2.6, -50, 1], [1.6, -44], [-1.6, -44]], C.gold, { line: 0.7 });               // level 3: a bronze finial
  }, -6)];
  return parts;
}

// ------------------------------------------------------------------ the Yellow-turban Strongman (黄巾力士)
// A summoned giant: twice a soldier's height, bare to the waist, a yellow head-cloth with long ends, a cinnabar sash.
// Same joints as a Zhou soldier. `rock`: the boulder he lifts to throw (hidden except in the throw's first pose).
// rank 1..5 (SPEC-SURVIVORS 6.2): 1 bare; 2 a leather strap and bronze armbands; 3 a bronze breast disc and shoulder guard;
// 4 a dark kilt edged in ochre and a cloak; 5 a gold collar and edging, a long cloak, longer ends to the head-cloth.
export function strongman(rank = 2) {
  const skin = C.pale, ln = { line: 1.5 }, parts = [], kilt = rank >= 4 ? C.lacquer : C.ochre, edge = rank === 5 ? C.gold : C.ochre;
  const armU = (g) => { g.body([[-6.5, -6], [6.5, -6], [7, 9], [5, 21], [-5, 21], [-7, 9]], skin, ln); if (rank >= 2) g.tint([[-8, 9, 1], [8, 9, 1], [8, 13.5, 1], [-8, 13.5, 1]], C.gold);
    if (rank === 3) g.body([[-16, -9, 1], [-2, -17], [13, -12], [18, -1], [8, 9], [-8, 8], [-17, 2]], C.gold, { line: 1.2 });                // rank 3: great round shoulder guards, the widest thing on him
    if (rank >= 4) g.body([[-10, -8], [0, -13], [10, -8], [11, 1], [3, 7], [-6, 6], [-11, 0]], C.lacquer, { line: 1.1 }); if (rank >= 4) g.tint([[-12, 1], [12, 1], [12, 5], [-12, 5]], edge); };
  const armL = (g) => { g.body([[-5, -2], [5, -2], [4.8, 12], [6, 18], [1.5, 24], [-4.6, 22], [-5.4, 16]], skin, ln); g.tint([[-6, 6, 1], [6, 6, 1], [6, 13, 1], [-6, 13, 1]], C.red); };
  const legU = (g) => g.body([[-7, -4], [7, -4], [6.2, 12], [5, 26], [-5, 26], [-6.4, 12]], rank >= 4 ? C.zhong : C.ochre, { line: 1.2 });
  const legL = (g) => { g.body([[-4.6, -2], [4.6, -2], [4.2, 24], [12, 26.5, 1], [11, 30, 1], [-5, 30, 1]], C.nong, { line: 1 }); g.tint([[-6, 2, 1], [6, 2, 1], [6, 7, 1], [-6, 7, 1]], C.gold); };
  parts.push(P('t', null, [0, 0], 20, (g) => {
    g.body(rank === 3 ? [[-13, -1], [-22, 13], [-23, 27, 1], [-8, 21], [0, 29], [8, 21], [23, 27, 1], [22, 13], [13, -1]] : rank === 1 ? [[-12, -1], [-13, 10], [-11, 18], [-4, 15], [0, 19], [5, 15], [11, 18], [13, 10], [12, -1]] : [[-13, -1], [-16, 12], [-14, 25], [-5, 20], [0, 27], [6, 20], [14, 25], [16, 12], [13, -1]], kilt, { line: 1.2 });   // rank 1 a short cloth; rank 3 a flared skirt
    if (rank === 3) g.tint([[-25, 14, 1], [25, 14, 1], [25, 20, 1], [-25, 20, 1]], C.gold); if (rank >= 4) g.tint([[-18, 13, 1], [18, 13, 1], [18, 19, 1], [-18, 19, 1]], edge);
    g.body([[-13, 2], [-16, -14], [-19, -31], [-13, -41], [3, -45], [15, -40], [19.5, -26], [15, -8], [12, 2]], skin, { line: 1.7 });   // the bare chest
    g.ink([[-8, -25], [0, -21], [9, -26]], 1.2); g.ink([[1, -20], [0, -7]], 0.9); g.ink([[-9, -12], [-2, -10]], 0.8);
    if (rank >= 2) { g.tint([[-19, -34], [-13, -40], [16, -10], [12, -4]], C.nong); }                                                // a leather strap across the chest
    if (rank >= 3) { g.body([[-7, -24], [0, -31], [8, -24], [8, -15], [0, -9], [-7, -15]], C.gold, { line: 1.1 }); g.cut((k) => { ring(k, 0.5, -20, 4, 1.4); }); }   // a bronze breast disc
    if (rank === 5) g.body([[-13, -40], [3, -45], [15, -40], [12, -34], [2, -38], [-10, -34]], C.gold, { line: 1 });                    // a gold collar
    g.tint([[-18, -7, 1], [18, -7, 1], [18, 1.5, 1], [-18, 1.5, 1]], C.red);                                                         // the sash
    g.body([[-13, 0], [-21, 6], [-24, 26, 1], [-17, 14], [-12, 6]], C.red, { line: 0.9 });                                             // its knot and end
  }));
  parts.push(P('h', 't', [2, -43], 22, (g) => {
    g.body(FACE_PTS, C.white); g.ink([[2, -14.2], [5.5, -15.8], [9.4, -16.6]], 1.5); g.ink([[1.2, -18.6], [6, -21.4], [10.4, -20]], 1.3);
    g.body([[-3, 2], [3, 3], [8, -3], [6, 8], [2, 13, 1], [-3, 8]], C.nong, { line: 0.8 });                                            // a short beard
    g.body([[11.5, -21, 1], [11, -29], [4, -37], [-6, -37], [-12.5, -29], [-13, -17], [-6, -18], [1, -23]], C.gold, { line: 1.3 });   // the yellow head-cloth
    g.body([[-9, -31], [-12, -41], [-4, -43], [-3, -35]], C.gold, { line: 1 });                                                        // the knot
    { const e = rank === 1 ? 0.42 : 1 + (rank - 1) * 0.16; g.body([[-11, -27], [-26 * e, -32], [-44 * e, -24 - rank, 1], [-30 * e, -23], [-40 * e, -11, 1], [-22 * e, -17], [-11, -19]], C.gold, { line: 1 }); }   // the long ends, longer with rank
    if (rank >= 4) g.body([[-5, -37], [-8, -48 - rank * 2], [1, -52 - rank * 2, 1], [4, -44], [3, -37]], rank === 5 ? C.gold : C.red, { line: 0.9 });   // a standing knot
    if (rank === 2) g.body([[-9, -33, 1], [-15, -46, 1], [-6, -40], [-1, -50, 1], [3, -39], [9, -45, 1], [8, -33, 1]], C.gold, { line: 1 });        // rank 2: the cloth tied up in three points
    if (rank === 3) { g.body([[-13, -24, 1], [12, -27, 1], [12, -21, 1], [-13, -18, 1]], C.nong, { line: 0.8 }); g.body([[-7, -34, 1], [-22, -52, 1], [-9, -44], [-2, -39]], C.gold, { line: 1 }); g.body([[4, -36, 1], [16, -55, 1], [10, -42], [9, -35]], C.gold, { line: 1 }); }   // rank 3: a dark band and two horns of bronze
  }));
  if (rank === 5) parts.push(P('sash', 't', [0, -36], 1, (g) => {                                                                     // rank 5: a spirit servant's floating sash, in an arc over the head, its ends streaming
    g.body([[-17, 6], [-36, -18], [-33, -50], [-12, -72], [12, -74], [33, -54], [38, -22], [22, 4], [16, 1], [30, -22], [26, -48], [9, -64], [-9, -62], [-25, -45], [-27, -19], [-12, 3]], C.red, { line: 1 });
    g.body([[-14, 3], [-38, 16], [-52, 44], [-72, 56, 1], [-58, 38], [-66, 28, 1], [-46, 26], [-32, 10]], C.red, { line: 1 });
    g.body([[18, 3], [38, 18], [46, 44], [60, 56, 1], [38, 46], [28, 22]], C.red, { line: 1 }); }, 0));
  if (rank === 2 || rank === 3) parts.push(P('c', 't', [-9, -38], 14, (g) => { const L = rank === 2 ? 26 : 38;                                    // a hide over the back: to the waist at rank 2, to the thigh at rank 3
    g.body([[4, -4], [-10, -7], [-22, 3], [-28, L * 0.5], [-31, L, 1], [-23, L - 5], [-17, L + 5, 1], [-11, L - 4], [-5, L + 3, 1], [-3, 18], [4, 4]], rank === 2 ? C.nong : C.ochre, { line: 1 }); if (rank === 3) g.tint([[-33, L - 9], [-2, L - 12], [-2, L - 7], [-33, L - 4]], C.nong); }, 4));
  if (rank === 4) parts.push(P('c', 't', [-9, -38], 14, (g) => { const L = rank === 5 ? 62 : 44; g.body([[4, -4], [-9, -6], [-20, 4], [-27, L * 0.5], [-34, L + 4, 1], [-22, L - 4], [-15, L + 8, 1], [-8, L * 0.7], [-3, 20], [4, 4]], rank === 5 ? C.ochre : C.red, { line: 1 }); if (rank === 5) g.tint([[-38, L - 6], [-2, L * 0.58], [-2, L * 0.58 + 5], [-38, L + 1]], C.gold); }, 4));
  parts.push(P('au', 't', [3, -35], 26, armU), P('al', 'au', [0, 19], 27, armL));
  parts.push(P('bu', 't', [0, -35], 6, armU), P('bl', 'bu', [0, 19], 5, armL));
  parts.push(P('lu', 't', [3, 1], 16, legU), P('ll', 'lu', [0, 24], 15, legL));
  parts.push(P('ku', 't', [-3, 1], 8, legU), P('kl', 'ku', [0, 24], 7, legL));
  parts.push(P('rock', 'al', [0, 20], 28, (g) => { const q = rank === 1 ? 0.7 : rank === 2 ? 0.88 : 1, S = (pts) => pts.map(([x, y]) => [x * q, y * q]);                // the stone he carries grows with him to rank 3
    g.body(S([[-15, -9], [-6, -17], [8, -16], [17, -6], [15, 8], [4, 15], [-10, 13], [-17, 3]]), rank === 5 ? C.ochre : C.zhong, { line: 1.5 }); g.ink(S([[-7, -8], [2, -4], [9, -9]]), 1); g.ink(S([[-4, 5], [6, 4]]), 0.9); }, 0, true));
  return { parts, feet: [{ id: 'll', pt: [2, 30] }, { id: 'kl', pt: [2, 30] }], };
}

// ------------------------------------------------------------------ the Shang war chariot: the car
// A box of lacquer on two wheels (one seen), a draught pole, a mask standard at the back. The horses and the crew are
// other puppets laid with it (see `layers` in index.js). The root is the axle; the wheel turns by its own angle.
export function car() {
  const R = 30;
  return { parts: [
    P('box', null, [0, 0], 10, (g) => {
      g.strip([[40, -8], [176, -30]], 3.4, L());                                                                                    // the draught pole
      g.strip([[168, -44], [168, -18]], 3, L());                                                                                    // the yoke
      g.body([[-46, -44, 1], [44, -48, 1], [50, -40], [48, -6, 1], [-48, -6, 1]], L(), J);                                           // the box
      g.tint([[-50, -38, 1], [52, -41, 1], [52, -33, 1], [-50, -30, 1]], C.gold);
      g.cut((k) => { for (let i = 0; i < 4; i++) { k.beginPath(); k.rect(-36 + i * 21, -24, 10, 10); k.fill(); } });                   // a band of squares: the fret, as large as the screen can show
      g.strip([[-40, -44], [-44, -128]], 2.6, L());                                                                                 // the standard
      g.body([[-56, -146, 1], [-32, -146, 1], [-32, -122, 1], [-56, -122, 1]], L(), J); g.cut((k) => { ring(k, -44, -134, 5, 2); });
      g.body([[-44, -120], [-80, -112, 1], [-58, -106], [-76, -96, 1], [-45, -100]], C.mal, Jl(0.8));
    }),
    P('wheel', 'box', [-2, 0], 12, (g) => {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
      g.strip(pts, 4.6, L()); for (let q = 0; q < 4; q++) { const a = (q / 4) * Math.PI; g.strip([[Math.cos(a) * -R, Math.sin(a) * -R], [Math.cos(a) * R, Math.sin(a) * R]], 2.2, L()); }
      g.body([[-5, -5, 1], [5, -5, 1], [5, 5, 1], [-5, 5, 1]], C.gold, Jl(0.8));
    }),
  ], feet: [{ id: 'box', pt: [-2, R] }] };
}

// ------------------------------------------------------------------ the Zhou war chariot (戎车), by rank
// Pale wood and azurite where the Shang car is lacquer. 1: a plain cart; 2: a rail and a pennon; 3: bronze fittings and a
// standard; 4: a lacquered box edged in bronze and a canopy (华盖) over the crew; 5: a gold canopy with tassels, a great
// banner and blades on the axle.
export function zhouCar(rank = 1) {
  const R = (rank === 1 ? 22 : rank === 2 ? 28 : rank === 3 ? 31.5 : 26 + rank * 1.6), wood = rank >= 4 ? C.lacquer : C.qing, band = rank >= 3 ? C.gold : C.azu;
  return { parts: [
    P('box', null, [0, 0], 10, (g) => {
      g.strip([[36, -8], [150, -26]], 3, C.nong); g.strip([[144, -38], [144, -14]], 2.6, C.nong);
      const h = rank === 1 ? 22 : 30 + rank * 3;                                                                                       // rank 1: a low open car
      g.body([[-42, -6 - h, 1], [40, -9 - h, 1], [46, -h], [44, -6, 1], [-44, -6, 1]], wood, { line: 1.3 });
      g.tint([[-46, -h, 1], [48, -h - 3, 1], [48, -h + 4, 1], [-46, -h + 7, 1]], band);
      if (rank >= 2) g.cut((k) => { for (let i = 0; i < 3; i++) { k.beginPath(); k.rect(-30 + i * 24, -h + 13, 12, 9); k.fill(); } });
      if (rank === 2) { g.strip([[-38, -6 - h], [-42, -h - 74]], 2.2, C.nong); g.body([[-42, -h - 74, 1], [-66, -h - 70], [-96, -h - 60, 1], [-74, -h - 58], [-90, -h - 46, 1], [-64, -h - 52], [-42, -h - 54, 1]], C.red, { line: 0.9 });   // rank 2: a tall pennon with a swallow tail
        g.body([[-46, -6 - h, 1], [-46, -h - 22], [-34, -h - 26, 1], [-30, -6 - h, 1]], wood, { line: 1.1 }); }                                  // and a raised board at the back
      if (rank === 3) {                                                                                                              // rank 3: a great flag with two long tails over the back,
        g.strip([[-38, -6 - h], [-43, -h - 92]], 2.6, C.lacquer); g.body([[-43, -h - 92, 1], [-43, -h - 52, 1], [-78, -h - 52], [-118, -h - 40, 1], [-90, -h - 62], [-80, -h - 72], [-92, -h - 82], [-120, -h - 96, 1], [-78, -h - 92]], C.red, { line: 0.9 });
        g.tint([[-62, -h - 93], [-55, -h - 93], [-55, -h - 51], [-62, -h - 51]], C.azu); g.body([[-43, -h - 92], [-36, -h - 104, 1], [-40, -h - 92]], C.gold, { line: 0.6 });
        g.body([[-50, -6 - h, 1], [-52, -h - 26], [-30, -h - 30, 1], [-28, -6 - h, 1]], C.gold, { line: 1.1 }); g.body([[30, -9 - h, 1], [34, -h - 26], [52, -h - 22, 1], [48, -6 - h, 1]], C.gold, { line: 1.1 });   // bronze boards fore and aft,
        g.strip([[44, -h - 22], [48, -h - 70]], 2, C.lacquer); g.body([[48, -h - 70, 1], [48, -h - 48, 1], [22, -h - 52, 1], [30, -h - 60], [22, -h - 70, 1]], C.gold, { line: 0.8 }); }                          // and a second flag at the front
      if (rank >= 4) {                                                                                                               // the canopy
        const top = -h - 78 - (rank - 4) * 10, w = 46 + (rank - 4) * 8, col = rank === 5 ? C.gold : C.red;
        g.strip([[2, -6 - h], [2, top + 8]], 2.6, C.lacquer);
        g.body([[2 - w, top + 14, 1], [2 - w * 0.6, top + 3], [2, top - 4], [2 + w * 0.6, top + 3], [2 + w, top + 14, 1]], col, { line: 1.1 });
        g.tint([[1 - w, top + 9, 1], [3 + w, top + 9, 1], [3 + w, top + 15, 1], [1 - w, top + 15, 1]], rank === 5 ? C.red : C.gold);
        for (let i = -2; i <= 2; i++) g.body([[2 + i * w * 0.46 - 2, top + 14], [2 + i * w * 0.46, top + 24 + (rank - 4) * 6, 1], [2 + i * w * 0.46 + 2, top + 14]], rank === 5 ? C.red : C.gold, { line: 0.5 });
        g.body([[0, top - 4], [2, top - 13, 1], [4, top - 4]], C.gold, { line: 0.6 });
      }
      if (rank === 5) { g.strip([[-40, -6 - h], [-46, -h - 128]], 2.6, C.lacquer); g.body([[-46, -h - 128, 1], [-46, -h - 74, 1], [-84, -h - 74, 1], [-76, -h - 100], [-84, -h - 128, 1]], C.gold, { line: 1 }); g.tint([[-68, -h - 129], [-60, -h - 129], [-60, -h - 73], [-68, -h - 73]], C.red); }
    }),
    P('wheel', 'box', [-2, 0], 12, (g) => {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
      g.strip(pts, 3.6 + rank * 0.3, rank >= 4 ? C.lacquer : C.nong); for (let q = 0; q < 4; q++) { const a = (q / 4) * Math.PI; g.strip([[Math.cos(a) * -R, Math.sin(a) * -R], [Math.cos(a) * R, Math.sin(a) * R]], 2, rank >= 4 ? C.lacquer : C.nong); }
      g.body([[-5, -5, 1], [5, -5, 1], [5, 5, 1], [-5, 5, 1]], rank >= 3 ? C.gold : C.zhong, { line: 0.8 });
      if (rank === 5) for (const d of [-1, 1]) g.body([[d * 4, -2], [d * 24, -6, 1], [d * 15, 0], [d * 24, 6, 1], [d * 4, 2]], C.gold, { line: 0.7 });   // blades on the axle
      if (rank === 3) for (const d of [-1, 1]) g.body([[d * 4, -2.5, 1], [d * 15, 0, 1], [d * 4, 2.5, 1]], C.gold, { line: 0.6 });                    // rank 3: short spikes on the hub
    }),
  ], feet: [{ id: 'box', pt: [-2, R] }] };
}
