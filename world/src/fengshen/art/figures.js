// Puppet designs for the game. Units are pixels at scale 1; every part is drawn round its own pivot at (0, 0).
// Figures are drawn facing right and mirrored when they face left. Poses and motion are in poses.js.
//
// Two peoples, told apart by shape and value before hue:
//   Zhou (the player's side): upright, long-legged, long curves; pale hide with open fretwork; a hollow face in pure
//     profile (the paper shows through); azurite dress, cinnabar cords; spears, things that stream.
//   Shang (the foes): squat, square-shouldered, flanged; lacquer black cut with squared spirals; a pale face turned
//     toward us; malachite bronze and a little gold; the 亞-shaped shield, the dagger-axe (戈), the broad axe (钺), the bow.
import { lune, slit, dot, ring, fret, scales, chevrons, petals } from './engine.js';

export const C = {
  jiao: '#14110F', nong: '#35302B', zhong: '#6B645C', dan: '#A69F94', qing: '#D3CCBE',   // ink, five tones 焦浓重淡清
  red: '#B8321F', redDeep: '#8E2417',       // cinnabar 朱砂
  azu: '#2F4F7A', azuThin: '#6F8CB0',       // azurite 石青, full and thin
  mal: '#3F7D6A',                           // malachite 石绿
  gold: '#B08A3C',                          // bronze gold
  lacquer: '#1B1512',                       // lacquer black
  ochre: '#9A7647',                         // ochre 赭石, the earth's pigment
  pale: '#E9E2D2',                          // pale hide: a breath darker than the paper, for a white beast
  white: '#ffffff',                         // not a paint: bare paper
};

const sc = (pts, k) => pts.map((q) => [q[0] * k, q[1] * k, q[2]]);
const P = (id, parent, at, z, draw, rot = 0, world = false) => ({ id, parent, at, z, draw, rot, world });
const TAU = Math.PI * 2;

// the Zhou face: one straight line from brow to nose, a small chin, cut hollow
const FACE = [[-4, 3], [4, 3], [5, -1], [8.2, -2.6, 1], [9.2, -5.6], [9.6, -8], [13.4, -9.6, 1], [10.6, -15], [10.8, -22], [5, -27.5], [-5, -26], [-8, -16], [-7, -5]];

// ------------------------------------------------------------------ the hero and the beast under him
// An original young war-leader of Zhou, not a king: a leather cap with a bronze brow, an azurite coat, pale scale
// skirt, a cinnabar scarf; the long bronze axe; and his own standard (one white yak tail, two ribbons, a length of
// painted cloth) as his top line. He rides one of two beasts from the Classic of Mountains and Seas. Both are built
// on the horse's skeleton (same parts, same pivots), so one gallop serves all three:
//   'jiliang'  吉量: a patterned horse. White body, a mane and tail of cinnabar, eyes like gold.
//   'bo'       驳: horse-shaped, white, with one horn, a tiger's teeth and claws, a black tail.
//   'horse'    the plain dark horse of the earlier rounds, kept for comparison.
// ------------------------------------------------------------------ the rider
// An original young war-leader of Zhou, not a king: a leather cap with a bronze brow, an azurite coat, pale scale
// skirt, a cinnabar scarf; the long bronze axe; and his own standard (one white yak tail, two ribbons, a length of
// painted cloth) as his top line.
function rider(seat) {
  return [
    // ---- the rider: a warrior's dress
    P('cape', 'torso', [-9, -39], 15, (g) => {     // a scarf, knotted at the neck
      g.body([[4, -4], [-10, -7], [-24, -3], [-34, 6], [-40, 18, 1], [-30, 12], [-26, 21, 1], [-19, 10], [-10, 8], [-2, 9], [4, 4]], C.red);
      g.cut((k) => { slit(k, -5, 0, -27, 5, 1.4, 2.5); });
    }, 6),
    P('torso', 'body', seat, 20, (g) => {
      g.body([[-13, -7], [-21, 8], [-18, 23], [-7, 19], [2, 26], [13, 20], [19, 6], [13, -7]], C.qing);                    // a skirt of pale hide scales
      g.cut((k, r) => { scales(k, r, -14, 4, 15, 18, 7); });
      g.body([[-11, 0], [-13, -14], [-14, -30], [-10, -41], [-2, -46], [6, -46], [13, -40], [15.5, -28], [13, -12], [11, 0]], C.azu);
      g.tint([[-15, -7, 1], [16, -7, 1], [16, -1.5, 1], [-15, -1.5, 1]], C.red);
      g.cut((k, r) => { scales(k, r, -8, -34, 11, -14, 7.6); });
    }, 7),
    P('leg', 'torso', [4, -2], 23, (g) => {
      g.body([[-6, -5], [6, -6], [13, 8], [16.5, 20], [14, 27], [12.5, 40], [21, 45, 1], [21, 50, 1], [5, 50, 1], [6, 38], [6, 27], [1, 16], [-7, 6]], C.azuThin);
      g.tint([[2, 26], [16, 24], [24, 52], [2, 52]], C.nong);
      g.cut((k) => { slit(k, 0, 0, 9, 17, 1.5, -1.5); lune(k, 9.5, 31, 3, 0.1); lune(k, 9.5, 37, 3, 0.1); });
    }, -14),
    P('armF', 'torso', [3, -38], 9.5, (g) => {
      g.body([[-4.5, -4], [4.5, -4], [4, 8], [3.2, 26], [4, 31], [0, 34], [-3.8, 31], [-3, 26], [-4.5, 8]], C.azu);
    }, -62),
    P('armU', 'torso', [6, -38], 26, (g) => {
      g.body([[-5, -5], [5, -5], [4.5, 8], [3.2, 19], [-3.2, 19], [-5, 8]], C.azu);
      g.body([[-8, -6], [-2, -10], [6, -8], [9, -1], [4, 5.5], [-4, 4.5], [-9, -1]], C.qing);                             // a shoulder plate of hide
      g.cut((k) => { lune(k, 0, -2, 4.6, 0, 0.5); });
    }, -38),
    P('armL', 'armU', [0, 17], 27, (g) => {
      g.body([[-3.3, -2], [3.3, -2], [2.9, 11], [3.9, 16], [1, 20], [-3, 19], [-3.7, 15], [-2.9, 11]], C.azu);
      g.tint([[-5, 3, 1], [5, 3, 1], [5, 12, 1], [-5, 12, 1]], C.nong);
      g.cut((k) => { slit(k, -2.4, 7.5, 2.4, 7.5, 0.9); });
    }, -46),
    // the long bronze axe (钺), a face cut through its blade
    P('yue', 'armL', [0, 16], 24, (g) => {
      g.strip([[-40, 0], [112, 0]], 2.5, C.nong);
      g.body([[-40, -2.6, 1], [-50, 0, 1], [-40, 2.6, 1]], C.gold, { line: 0.7 });
      g.body([[93, -2.5, 1], [93, -9, 1], [107, -9, 1], [107, -2.5, 1]], C.gold, { line: 0.8 });
      g.body([[92, 2, 1], [91, 9, 1], [78, 31, 1], [100, 38], [122, 31, 1], [109, 9, 1], [108, 2, 1]], C.gold, { line: 1.1 });
      g.cut((k) => { slit(k, 86.5, 19, 96.5, 23.5, 2.4, 0.6); slit(k, 113.5, 19, 103.5, 23.5, 2.4, -0.6); slit(k, 100, 7, 100, 18, 1.2); for (let i = 0; i < 4; i++) { k.beginPath(); k.rect(91.4 + i * 4.6, 28.6, 2.6, 3.4); k.fill(); } });
      g.body([[112, -1.6, 1], [123, 0, 1], [112, 1.6, 1]], C.gold, { line: 0.7 });
      g.body([[89, 2], [84, 10], [86, 25, 1], [91, 12]], C.red, { line: 0.7 });
    }, 16, true),
    P('head', 'torso', [2, -45], 22, (g) => {
      g.body(FACE, C.white);
      g.ink([[2, -14.2], [5.5, -15.8], [9.4, -16.6]], 1.3);
      g.ink([[1.2, -18.4], [6, -21], [10.4, -19.8]], 0.9);
      g.ink([[7.2, -5.2], [9.4, -5.6]], 0.8);
      // a leather cap with a bronze brow
      g.body([[11.5, -22, 1], [10.5, -29], [4, -36], [-5, -35], [-11.5, -27], [-13, -14], [-16.5, -2, 1], [-8, -5], [-6, -16], [1, -23]], C.zhong);
      g.tint([[12, -21, 1], [11, -26], [-1, -27], [-7, -20], [-6, -15], [1, -22]], C.gold);
      g.cut((k) => { lune(k, -2, -29.5, 4.6, -0.4, 0.5); dot(k, -10.5, -8, 1.3); });
      g.body([[0, -35], [-1, -40], [3.5, -44], [8, -40], [6, -35]], C.red);
    }, -4),
    P('plume', 'head', [3, -43], 21, (g) => {     // one tassel of cinnabar from the crown
      g.body([[-1, 1], [-9, -13], [-24, -23], [-42, -24], [-54, -15, 1], [-42, -18.5], [-26, -17], [-12, -8], [2, 3]], C.red, { line: 0.8 });
      g.cut((k) => { for (let i = 0; i < 4; i++) { const t = i / 4; slit(k, -9 - t * 34, -8 - t * 12, -12 - t * 34, -14 - t * 10, 0.9); } });
    }, 0),

    // his standard: a pole with a bronze point, one white yak tail, two ribbons of cinnabar; the painted cloth hangs below
    P('pole', 'torso', [-9, -36], 14, (g) => {
      g.strip([[0, 12], [0, -178]], 2.4, C.nong);
      g.body([[-3.2, -177, 1], [0, -198, 1], [3.2, -177, 1]], C.gold, { line: 0.8 });
      g.body([[-3.6, -170.6, 1], [3.6, -170.6, 1], [3.6, -165.4, 1], [-3.6, -165.4, 1]], C.gold, { line: 0.7 });
      for (const y of [-138, -112]) g.body([[-3, y - 2, 1], [3, y - 2, 1], [3, y + 2, 1], [-3, y + 2, 1]], C.nong, { line: 0.6 });
    }, -8, true),
    P('m1', 'pole', [0, -168], 13.5, (g) => {
      const k = 1.45;   // a tail of yak hair: bare paper inside a heavy cut line, a light wash of ink toward its frayed end
      g.body(sc([[2, -3.5], [-8, -7.5], [-22, -6], [-34, 2], [-42, 15, 1], [-35.5, 12, 1], [-37, 22, 1], [-30, 15.5, 1], [-29, 24, 1], [-23, 15, 1], [-13, 10.5], [-4, 7.5], [2, 4]], k), C.white, { line: 1.7 });
      g.tint(sc([[-16, 3], [-28, -2], [-44, 12], [-40, 26], [-22, 22], [-12, 12]], k), C.qing, 0.85);
      g.tint(sc([[-28, 8], [-40, 10], [-40, 26], [-26, 24]], k), C.dan, 0.5);
      g.ink(sc([[-3, -2.5], [-14, -2.5], [-26, 2], [-34, 10]], k), 0.9); g.ink(sc([[-3, 1], [-13, 2], [-23, 7], [-29, 13]], k), 0.9); g.ink(sc([[-3, 4.5], [-11, 6.5], [-19, 10.5]], k), 0.8);
    }, 4),
    ...[['m2', -138, 1], ['m3', -112, 0.86]].map(([id, y, k], i) => P(id, 'pole', [0, y], 13.4 - i * 0.1, (g) => {
      g.body(sc([[1, -3], [-14, -5], [-30, -1], [-46, 7, 1], [-34, 7], [-40, 15, 1], [-24, 8], [-10, 5], [1, 3]], k), C.red, { line: 0.9 });
      g.cut((kk) => { slit(kk, -5 * k, 0, -28 * k, 3 * k, 1.2, 1.5); });
    }, 4)),
  ];
}

// ------------------------------------------------------------------ Jiliang (吉量) and the hero
// The patterned horse of the Classic of Mountains and Seas: a white body, a mane and tail of cinnabar, eyes like gold.
// Drawn on the canon of the Chinese horse (Han reliefs, the flying horse of Wuwei): a heavy chest and haunch on thin
// sharp legs, one line from poll to tail root, a neck that arches, a small head, the eye the darkest thing on it.
// It is marked, not just coloured: a bronze frontlet, bronze bosses on the straps, squared-spiral cartouches on thigh
// and forearm, a streamer from the poll. Designed at a plain horse's size and enlarged by MS under the rider.
export const MS = 1.22;
function jiliang() {
  const coat = C.pale, LW = 1.8, ln = { line: LW, grain: 0.08 };
  const Q = (p) => sc(p, MS), at = (x, y) => [x * MS, y * MS];
  const cut = (g, fn) => g.cut((k, r) => { k.save(); k.scale(MS, MS); fn(k, r); k.restore(); });
  const boss = (g, x, y, r = 2.6) => { g.body(Q([[x - r, y], [x, y - r], [x + r, y], [x, y + r]]), C.gold, { line: 0.8, jit: 0.04 }); cut(g, (k) => dot(k, x, y, 0.8)); };
  // a cartouche of dark ink with a squared spiral (云雷纹) cut through it
  const badge = (g, x, y, r, dir) => { g.body(Q([[x - r, y - r + 2.5], [x - r + 2.5, y - r], [x + r - 2.5, y - r], [x + r, y - r + 2.5], [x + r, y + r - 2.5], [x + r - 2.5, y + r], [x - r + 2.5, y + r], [x - r, y + r - 2.5]]), C.nong, { line: 1, jit: 0.04 }); cut(g, (k) => fret(k, x, y, r - 3, 1.75, dir, 2.2, 0)); };
  // a lock of hair or a ribbon: from its root at (0, 0), length L, lying at angle a (0 = straight back), swelling then tapering to a point
  const lock = (L, a, w, lift = 0.12) => { const c = Math.cos(a), sn = Math.sin(a); return [[2, -w * 0.8], [-L * 0.3, -w * 1.5 - L * lift * 0.5], [-L * 0.68, -w * 0.5 - L * lift], [-L, L * 0.06, 1], [-L * 0.64, w * 0.9 - L * lift * 0.5], [-L * 0.3, w * 0.7], [2, w * 0.8]].map(([x, y, f]) => [x * c - y * sn, x * sn + y * c, f]); };

  // The legs have joints with shape: the forearm ends in the knob of the knee, the gaskin in the point of the hock;
  // the cannon is thin, swells at the fetlock, and the pastern slopes forward into a pointed hoof.
  const legFU = (g) => {
    const p = g.body(Q([[-10, -10], [8, -11], [9.5, 2], [6, 14], [4.4, 23], [5.2, 28.6], [3.6, 32.4], [0, 33.6], [-3.6, 32.2], [-4.6, 28], [-4, 22], [-5.6, 13], [-9.5, 3]]), coat, ln);
    g.tint(Q([[-6, 14], [6.4, 13], [5, 18], [-5, 19]]), C.nong); cut(g, (k) => { for (const x of [-3, 0, 3]) slit(k, x - 1.2, 18, x + 0.4, 14, 0.7); });
    badge(g, -0.4, 0, 7.6, -1); g.last = p;
    g.ink(Q([[-3, 27.6], [0, 29.4], [3.4, 27.8]]), 0.8);                                       // the knee
  };
  const legHU = (g) => {
    const p = g.body(Q([[-15, -14], [10, -16], [15, 0], [10.5, 17], [6.4, 28], [5.4, 34.6], [2.2, 39], [-2.6, 38.6], [-7.2, 35.6, 1], [-5.2, 29], [-8, 16], [-16, 2]]), coat, ln);
    g.tint(Q([[-9, 19], [9.5, 16], [8, 22], [-8, 25]]), C.nong); cut(g, (k) => { for (const x of [-5, -1, 3, 6.5]) slit(k, x - 1.4, 23.5 - x * 0.16, x + 0.4, 18.6 - x * 0.16, 0.7); });
    badge(g, -1, 0, 10.4, 1); g.last = p;
    g.ink(Q([[-5, 33], [-1, 34.6], [4, 32.6]]), 0.8);                                          // the hock
  };
  const legL = (len, hind) => (g) => {
    g.body(Q(hind
      ? [[-3.6, -3.4], [0, -5], [3.6, -3], [3.3, 3], [2.2, 8], [1.8, len * 0.5], [2.1, len * 0.66], [3.7, len * 0.75], [3.3, len * 0.81], [6.4, len - 5.2], [8.8, len - 1, 1], [7.6, len, 1], [-2.6, len, 1], [-1.4, len - 4.8], [-4, len * 0.81], [-3.5, len * 0.72], [-1.9, len * 0.62], [-1.8, len * 0.4], [-2.8, 8], [-4.4, 2]]
      : [[-3.6, -3.4], [0, -5], [3.8, -3], [4.3, 1.6], [2.5, 6.4], [1.7, len * 0.5], [2, len * 0.66], [3.6, len * 0.75], [3.2, len * 0.81], [6.4, len - 5.2], [8.8, len - 1, 1], [7.6, len, 1], [-2.6, len, 1], [-1.4, len - 4.8], [-4, len * 0.81], [-3.5, len * 0.72], [-1.9, len * 0.62], [-1.7, len * 0.4], [-2.7, 6.4], [-4.2, 1.6]]), coat, ln);
    g.tint(Q([[-5, len - 5.2, 1], [11, len - 5.2, 1], [11, len + 1, 1], [-5, len + 1, 1]]), C.jiao);                                                   // the hoof
    g.ink(Q([[-2.6, len * 0.78], [0.4, len * 0.8], [3, len * 0.77]]), 0.7);                                                                            // the fetlock
    g.body(Q([[-3, len * 0.72], [-8.4, len * 0.64], [-15.6, len * 0.48, 1], [-9.4, len * 0.76], [-13.6, len * 0.88, 1], [-3.4, len * 0.85]]), C.red, { line: 0.8 });   // a lock of flame behind it
  };

  const H = (p) => p.map(([x, y, f]) => [x + 8, y + 6, f]);                      // body coordinates -> the hind half's own
  const parts = [
    // the haunch: round and heavy, the belly drawn up to it. Hinged to the forehand under the saddle cloth, so the back can flex.
    P('hind', 'body', at(-8, -6), 9.5, (g) => {
      g.body(Q(H([[8, -23], [-14, -23], [-34, -28], [-50, -25], [-61, -15], [-66, 0], [-63, 13], [-54, 23], [-40, 25], [-26, 19], [-8, 19], [6, 20], [11, 0]])), coat, ln);
      g.tint(Q(H([[-12, -23.6], [-34, -28.6], [-60, -16], [-61, -11.5], [-34, -24], [-12, -19.4]])), C.nong);        // crupper
      for (const [x, y] of [[-24, -23.6], [-42, -24.4], [-57, -15]]) boss(g, x + 8, y + 6);
    }),
    // the forehand: a deep chest carried forward of the legs
    P('body', null, [0, 0], 10, (g) => {
      g.body(Q([[30, -27], [10, -23], [-4, -23], [-10, -2], [-6, 19], [16, 21], [34, 22], [46, 20], [58, 12], [64.5, -2], [61, -16], [52, -24], [40, -30]]), coat, ln);
      g.tint(Q([[28, -27.5], [35, -30], [63.5, -5], [62, 1]]), C.nong);                                                // breast strap
      // the saddle cloth: lacquer black with a cinnabar border, scaled. It covers the hinge and anchors the pale horse.
      g.body(Q([[-22, -25], [0, -28], [22, -26], [27, -6], [24, 15], [10, 21], [-2, 15], [-15, 21], [-26, 10], [-27, -8]]), C.lacquer);
      g.tint(Q([[-28, 6], [-15, 14], [-2, 8], [10, 14], [28, 8], [28, 24], [-28, 24]]), C.red);
      cut(g, (k, r) => { scales(k, r, -18, -18, 22, -1, 8.6); for (const [x, y] of [[-19, 12.5], [-9, 11], [4, 11], [15, 13.5], [22, 9.5]]) dot(k, x, y, 1.6); });
      g.body(Q([[-14, -26], [-11, -33], [0, -30.5], [12, -34], [17, -26.5], [2, -25]]), C.nong);
      for (const [x, y] of [[38, -24], [48, -15.5], [57, -7]]) boss(g, x, y, 3);
      g.body(Q([[60, -1], [57, 8], [60, 20, 1], [63.4, 8]]), C.red, { line: 0.8 });                                       // the tassel at the breast
    }),
    P('neck', 'body', at(40, -16), 11, (g) => {
      g.body(Q([[42, -64], [47, -79, 1], [49.6, -62.6]]), coat, ln);                                                    // far ear
      // the neck arches forward from the withers to the poll and the head hangs from it; the face is long and a little dished
      g.body(Q([[-12, -10], [-2, -27], [13, -44.6], [28, -57.4], [42, -64.5], [50, -61], [56, -52.6], [58.8, -45.6], [62.6, -37], [66.4, -27.6], [65.8, -22.6], [62, -19.4], [57.8, -21], [53.4, -28.6], [48.6, -37], [43, -42], [36, -36], [28, -24], [24, -10], [22, 2], [15, 13], [0, 16], [-12, 6]]), coat, ln);
      g.body(Q([[37, -63.6], [40.6, -81, 1], [45, -64.6]]), coat, ln);                                                  // near ear, pricked
      g.body(Q([[49, -60.4, 1], [53.4, -58.6, 1], [62, -39.6, 1], [59, -38.4, 1]]), C.gold, { line: 0.9, jit: 0.04 });     // the bronze frontlet (当卢)
      cut(g, (k) => { dot(k, 52.6, -55, 1); dot(k, 55.8, -48.4, 1); dot(k, 58.8, -42, 1); });
      g.ink(Q([[44, -60], [48, -46], [57.6, -30]]), 1.2); g.ink(Q([[58.6, -35.4], [65, -31.4]]), 1.2);                    // cheek strap, noseband
      g.body(Q([[47.6, -53.4], [51.4, -56.2], [55.6, -52.6], [51, -50.4]]), C.gold, { line: 1.6, jit: 0.04 });            // eyes like gold, inside the heaviest line on the head
      g.body(Q([[50.2, -54.6, 1], [52.8, -54.6, 1], [52.8, -51.6, 1], [50.2, -51.6, 1]]), C.jiao, { line: 0, jit: 0.03 });
      g.ink(Q([[63.2, -27.6], [65.4, -25], [63.8, -23.4]]), 1.4);                                                       // the nostril, flared
      g.ink(Q([[58, -21.6], [61.8, -19.8]]), 0.8);
      g.ink(Q([[30, -30], [38, -38], [44, -41]]), 0.8);                                                                 // the line of the jaw
    }),
    // the mane: locks of flame lying back along the crest, three groups, each on its own pivot
    ...[[25, -57, [[36, -0.5, 2.6], [52, -0.28, 3]], 'mane1'], [9, -45, [[44, -0.66, 2.8], [60, -0.44, 3.2], [30, -0.92, 2.2]], 'mane2'], [-4, -27, [[50, -0.74, 3], [36, -1.04, 2.6]], 'mane3']].map(([x, y, locks, id], i) => P(id, 'neck', at(x, y), 11.5 + i * 0.01, (g) => {
      for (const [L, a, w] of locks) { g.body(Q(lock(L, a, w)), C.red, { line: 1 }); cut(g, (k) => { const c = Math.cos(a), sn = Math.sin(a); slit(k, -L * 0.14 * c, -L * 0.14 * sn, -L * 0.62 * c + L * 0.1 * sn, -L * 0.62 * sn - L * 0.1 * c, 0.9, 1.2); }); }
    })),
    P('tail', 'hind', at(-52, -8), 9, (g) => {
      for (const [L, a, w, lift] of [[62, -0.6, 3.2, 0.2], [100, -0.46, 4.4, 0.14], [84, -0.36, 3.8, 0.2], [70, -0.26, 3.2, 0.1]]) {     // long locks flowing one way, no two alike
        g.body(Q(lock(L, a, w, lift)), C.red, { line: 1 }); cut(g, (k) => { const c = Math.cos(a), sn = Math.sin(a); slit(k, -L * 0.1 * c, -L * 0.1 * sn, -L * 0.6 * c + L * lift * 0.8 * sn, -L * 0.6 * sn - L * lift * 0.8 * c, 1, 1.6); });
      }
    }, -4),
    P('s1', 'neck', at(40, -64), 11.6, (g) => { g.body(Q(lock(70, -0.5, 2.3, 0.1)), C.red, { line: 0.9 }); cut(g, (k) => slit(k, -10, -4, -44, -19, 0.8, 1)); }, 0),   // a streamer from the poll
    P('fU', 'body', at(46, 12), 12, legFU), P('fL', 'fU', at(0, 29.4), 13, legL(35)),
    P('fU2', 'body', at(40, 11), 5, legFU), P('fL2', 'fU2', at(0, 29.4), 4, legL(35)),
    P('hU', 'hind', at(-38, 12), 12, legHU), P('hL', 'hU', at(0, 35), 13, legL(39, true)),
    P('hU2', 'hind', at(-44, 11), 5, legHU), P('hL2', 'hU2', at(0, 35), 4, legL(39, true)),
  ];
  const foot = (id, len) => ({ id, pt: [1.5 * MS, len * MS] });
  return { parts, seat: [3, -32], feet: [foot('fL', 35), foot('fL2', 35), foot('hL', 39), foot('hL2', 39)] };
}

// The hero on Jiliang: one puppet of 31 parts.
export function hero() {
  const m = jiliang();
  return { parts: [...m.parts, ...rider(m.seat)], feet: m.feet };
}

// The same pieces off the horse, for the fall: the rider without what he held (his hip is the root, so one rotation
// turns the whole figure), the standard by itself (the pole is the root, its tail and ribbons hang on it), the axe.
export function heroPieces() {
  const all = rider([0, 0]), held = ['pole', 'm1', 'm2', 'm3', 'yue'];
  return {
    rider: { parts: all.filter((q) => !held.includes(q.id)).map((q) => (q.id === 'torso' ? { ...q, parent: null, at: [0, 0] } : q)) },
    standard: { parts: all.filter((q) => ['pole', 'm1', 'm2', 'm3'].includes(q.id)).map((q) => (q.id === 'pole' ? { ...q, parent: null, at: [0, 0], world: false } : q)) },
    axe: { parts: all.filter((q) => q.id === 'yue').map((q) => ({ ...q, parent: null, at: [0, 0], world: false })) },
  };
}
export const RIDER_PARTS = ['cape', 'torso', 'leg', 'armF', 'armU', 'armL', 'yue', 'head', 'plume', 'pole', 'm1', 'm2', 'm3'];

// ------------------------------------------------------------------ Zhou foot soldiers
// o: { weapon: 'spear'|'sword', shield, rank, pennon, thin (a paler tunic), helm: 0 tassel | 1 knot | 2 crest }
export function zhou(o) {
  const v = o.helm || 0, tunic = o.thin ? C.azuThin : C.azu;
  const parts = [];
  const armU = (g) => {
    g.body([[-3.6, -4], [3.6, -4], [3.2, 8], [2.6, 19], [-2.6, 19], [-3.6, 8]], tunic);
    g.body([[-6.5, -6], [0, -8.5], [6.5, -6], [7.5, 0.5], [2, 5.5], [-4.5, 4.5], [-7.5, 0]], o.rank ? C.gold : C.qing);
    g.cut((k) => { lune(k, 0, -1, 4.2, 0, 0.55); });
  };
  const armL = (g) => {
    g.body([[-2.6, -2], [2.6, -2], [2.2, 12], [3.1, 17], [0.6, 20.5], [-2.4, 19.5], [-3, 16], [-2.2, 12]], C.qing);
    g.cut((k) => slit(k, -1.8, 8, 1.8, 8, 0.9));
  };
  const legU = (g) => {
    g.body([[-4.4, -4], [4.4, -4], [3.8, 11], [2.9, 26], [-2.9, 26], [-4.2, 11]], C.qing);
    g.cut((k) => slit(k, 0, 0, 0.4, 19, 1.4, 0.8));
  };
  const legL = (g) => {
    g.body([[-2.9, -2], [2.9, -2], [2.6, 13], [2.6, 24], [9.4, 26.5, 1], [8.8, 30, 1], [-3.3, 30, 1], [-2.7, 13]], C.zhong);
    g.cut((k) => { lune(k, 0, 6, 2.6, 0, 0.6); lune(k, 0, 12, 2.6, 0, 0.6); lune(k, 0, 18, 2.6, 0, 0.6); });
  };

  parts.push(P('t', null, [0, 0], 20, (g) => {
    g.body([[-9, -3], [-12.5, 10], [-11.5, 22], [-6, 18], [-1.5, 24], [4, 18], [9.5, 23], [11.5, 11], [9, -3]], C.qing);
    g.cut((k, r) => { chevrons(k, r, -6.5, 6.5, 7, 14.5, 6.6, 1.5); });
    g.body([[-7, 2], [-8.5, -12], [-9, -27], [-6, -35], [1.5, -38], [7.5, -34], [10, -22], [8.5, -7], [7, 2]], tunic);
    g.cut((k, r) => scales(k, r, -5, -27, 8, -11, 7.4));
    g.tint([[-11, -5, 1], [11, -5, 1], [11, -0.5, 1], [-11, -0.5, 1]], C.red);
  }));

  if (o.cape) parts.push(P('c', 't', [-6, -32], 14, (g) => {
    g.body([[3, -4], [-8, -5], [-17, 4], [-23, 24], [-29, 48, 1], [-19, 41], [-14, 52, 1], [-8, 36], [-3, 18], [3, 4]], C.red);
    g.cut((k) => { slit(k, -4, 2, -19, 34, 1.8, -3); slit(k, -3, 12, -11, 34, 1.4, -1.5); });
  }, 4));

  parts.push(P('h', 't', [1, -36], 22, (g) => {
    const K = 0.7;
    g.body(sc(FACE, K), C.white);
    g.ink(sc([[2, -14.2], [5.5, -15.8], [9.4, -16.6]], K), 1.15);
    g.ink(sc([[1.2, -18.4], [6, -21], [10.4, -19.8]], K), 0.8);
    // a leather cap, close to the skull
    g.body(sc([[11.5, -22, 1], [10.5, -29], [4, -36], [-5, -35], [-11.5, -27], [-13, -14], [-16.5, -2, 1], [-8, -5], [-6, -16], [1, -23]], K), o.rank ? C.gold : C.zhong);
    g.cut((k) => { lune(k, -1, -19, 3.8, -0.5, 0.55); });
    if (v === 0) g.body([[1, -25], [-2, -31], [-11, -35], [-20, -29, 1], [-10, -30], [-3, -26.5]], C.red, { line: 0.8 });         // a tassel, streaming
    if (v === 1) { g.body([[-3, -24.5], [-3, -30], [1, -34], [5.5, -30], [4, -24.5]], C.nong, { line: 0.8 }); g.body([[-2, -27], [-9, -29], [-15, -25, 1], [-8, -25.5]], C.red, { line: 0.7 }); }   // a knot and its ribbon
    if (v === 3) for (const [x, a] of [[-2, -0.5], [3, -0.2]]) g.body([[x - 1.6, -24], [x - 2.4 + a * 10, -40], [x + a * 34, -56, 1], [x + 3 + a * 14, -40], [x + 2, -24]], C.red, { line: 0.8 });   // two pheasant feathers, upright: the archer
    if (v === 2) { g.body([[0, -25], [-4, -40], [-16, -53], [-33, -57], [-45, -50, 1], [-32, -52], [-18, -47], [-8, -36], [3, -25]], C.red, { line: 0.8 });
      g.cut((k) => { for (let i = 0; i < 4; i++) { const t = i / 4; slit(k, -6 - t * 26, -38 - t * 15, -9.5 - t * 26, -44 - t * 11, 1.1); } }); }
  }));

  parts.push(P('au', 't', [2, -31], 26, armU), P('al', 'au', [0, 17], 27, armL));
  parts.push(P('bu', 't', [1, -31], 6, armU), P('bl', 'bu', [0, 17], 5, armL));
  parts.push(P('lu', 't', [2, 1], 16, legU), P('ll', 'lu', [0, 24], 15, legL));
  parts.push(P('ku', 't', [-2, 1], 8, legU), P('kl', 'ku', [0, 24], 7, legL));

  const hand = o.hand || 'al', wz = hand === 'al' ? 24 : 4;
  if (o.weapon === 'spear') parts.push(P('w', hand, [0, 18], wz, (g) => {
    g.strip([[-48, 0], [58, 0]], 2.1, C.nong);
    g.body([[57, -1.5, 1], [65, -4.6], [84, 0, 1], [65, 4.6], [57, 1.5, 1]], C.gold, { line: 0.9 });
    g.body([[57, 1], [51, 7], [52, 18, 1], [58, 8]], C.red, { line: 0.7 });
    if (o.pennon) { g.body([[49, -1, 1], [36, -4], [14, -19, 1], [27, -17], [12, -29, 1], [38, -26], [49, -21, 1]], C.red, { line: 0.8 });
      g.cut((k) => { dot(k, 39, -12, 2.8); slit(k, 22, -22, 33, -21, 1.1); }); }
  }, 0, true));
  if (o.weapon === 'sword') parts.push(P('w', hand, [0, 18], wz, (g) => {
    g.body([[4, -2.2, 1], [18, -3], [34, -2], [43, 0, 1], [34, 2.2], [18, 3], [4, 2.2, 1]], C.gold, { line: 0.9 });
    g.cut((k) => slit(k, 9, 0, 32, -0.4, 0.8));
    g.body([[2.4, -5.5, 1], [5, -5.5, 1], [5, 5.5, 1], [2.4, 5.5, 1]], C.nong, { line: 0.6 });
    g.strip([[-5, 0], [3, 0]], 2.2, C.nong);
  }, 0, true));
  // 戈 in the Zhou shape: a long shaft, a slim blade set across it, a cord of cinnabar. Carried (w) and, gripped near the
  // butt so that it reaches two bodies forward, braced (wb): one of the two is shown (pose.$hide).
  if (o.weapon === 'ge') {
    const ge = (a, b) => (g) => {
      g.strip([[a, 0], [b, 0]], 2.2, C.nong);
      g.body([[b - 15, 1.2, 1], [b - 10, 7], [b - 8, 25, 1], [b - 3, 9], [b - 1, 1.2, 1]], C.gold, { line: 0.9 });
      g.body([[b - 1, -1.5, 1], [b + 15, 0, 1], [b - 1, 1.5, 1]], C.gold, { line: 0.8 });
      g.body([[b - 14, -1], [b - 21, -8], [b - 19, -21, 1], [b - 12, -9]], C.red, { line: 0.7 });
    };
    parts.push(P('w', hand, [0, 18], wz, ge(-44, 80), 0, true), P('wb', hand, [0, 18], wz + 0.1, ge(-14, 122), 0, true));
  }
  // 射: a recurved bow of dark wood, and a quiver of pale hide on the back
  if (o.weapon === 'bow') {
    parts.push(P('q', 't', [-7, -29], 3, (g) => {
      g.body([[-4.6, -5], [4.6, -5], [3.6, 27], [-3.6, 27]], C.qing, { line: 1 });
      g.tint([[-6, 0, 1], [6, 0, 1], [6, 4, 1], [-6, 4, 1]], C.azu);
      for (const [x, top] of [[-2.6, -30], [1.6, -35]]) { g.strip([[x, -4], [x, top]], 1.2, C.nong); g.body([[x - 2.2, top + 8, 1], [x, top - 1, 1], [x + 2.2, top + 8, 1]], C.red, { line: 0.5 }); }
    }, -14));
    parts.push(P('w', hand, [0, 18], wz, (g) => {
      g.strip([[-13, -42], [-2, -31], [6, -13], [7, 0], [6, 13], [-2, 31], [-13, 42]], 2.6, C.nong);
      g.strip([[-13, -42], [-9, -48]], 1.8, C.nong); g.strip([[-13, 42], [-9, 48]], 1.8, C.nong);
      g.ink([[-11, -46], [-11, 46]], 0.7);
    }, 0, true));
    parts.push(P('wd', hand, [0, 18], wz + 0.1, (g) => {
      g.strip([[-19, -38], [-5, -30], [5, -13], [7, 0], [5, 13], [-5, 30], [-19, 38]], 2.6, C.nong);
      g.strip([[-19, -38], [-16, -44]], 1.8, C.nong); g.strip([[-19, 38], [-16, 44]], 1.8, C.nong);
      g.ink([[-17, -42], [-34, 0], [-17, 42]], 0.8);
      g.strip([[-34, 0], [28, 0]], 1.8, C.nong);
      g.body([[26, -3, 1], [38, 0, 1], [26, 3, 1]], C.gold, { line: 0.7 });
    }, 0, true));
  }
  // 干: a tall shield of pale hide, round-headed, a band of azurite and a boss; it covers him from knee to brow
  if (o.shield === 'tall') parts.push(P('s', o.shieldHand || 'bl', [0, 14], o.shieldZ ?? 30, (g) => {
    g.body([[-11.5, -33], [-6, -40], [0, -42], [6, -40], [11.5, -33], [13, 0], [11.5, 31], [0, 36], [-11.5, 31], [-13, 0]], C.qing, { line: 1.3 });
    g.tint([[-14, -7, 1], [14, -7, 1], [14, 5, 1], [-14, 5, 1]], C.azu);
    g.cut((k) => { ring(k, 0, -1, 4.2, 1.3); slit(k, -7, -26, 7, -26, 1.2, 1.6); slit(k, -7, 20, 7, 20, 1.2, -1.6); petals(k, 0, -1, 6.4, 9.4, 6, 1.1, 0.3); });
    g.body([[-2.4, -41, 1], [2.4, -41, 1], [1.6, -34], [-1.6, -34]], C.red, { line: 0.6 });
  }, 0, true));
  if (o.shield && o.shield !== 'tall') parts.push(P('s', o.shieldHand || 'bl', [0, 14], o.shieldZ ?? 30, (g) => {
    g.body([[0, -15], [10.5, -10.5], [15, 0], [10.5, 10.5], [0, 15], [-10.5, 10.5], [-15, 0], [-10.5, -10.5]], C.qing);
    g.tint([[0, -5], [3.5, -3.5], [5, 0], [3.5, 3.5], [0, 5], [-3.5, 3.5], [-5, 0], [-3.5, -3.5]], C.azu);
    g.cut((k) => { ring(k, 0, 0, 10.4, 1.5); petals(k, 0, 0, 5.6, 8.6, 8, 1.3, 0.2); });
  }, 0, true));

  return { parts, feet: [{ id: 'll', pt: [2, 30] }, { id: 'kl', pt: [2, 30] }] };
}

// ------------------------------------------------------------------ Shang foot soldiers
// o: { weapon: 'ge'|'yue'|'bow', long (a long-shafted 戈), shield, standard, helm: 0|1|2 (height of the flanged crest) }
// Lacquer black, but pierced like any puppet: gaps between the plates, a beast's face through the breast, fret on the
// shoulders. The face is pale hide turned toward us (七分脸), with cut lines. Edges are a knife's: clean curves and straights.
export function shang(o) {
  const v = o.helm || 0, J = { jit: 0.05 }, Jl = (line) => ({ jit: 0.05, line });
  const parts = [];
  const fr = (k, ...q) => { if (!o.dense) fret(k, ...q); };      // dense: the limb plates left whole, so the figure is darker (the archer, who carries no mass of bronze)
  const armU = (g) => {
    g.body([[-4, -4], [4, -4], [3.6, 8], [3, 17], [-3, 17], [-3.6, 8]], C.lacquer, J);
    g.cut((k) => { fr(k, 0, 10, 2.9, 1.25, 1, 1.6, 0); });
    // the shoulder plate: a low dome on a straight edge, a squared spiral cut through it
    g.body([[-9.5, 3, 1], [-9.5, -3], [-6, -9], [6, -9], [9.5, -3], [9.5, 3, 1]], C.lacquer, J);
    g.cut((k) => { fr(k, 0, -3, 5, 1.75, 1, 2.1, 0); });
  };
  const armL = (g) => {
    g.body([[-3, -2], [3, -2], [2.8, 11], [-2.8, 11]], C.lacquer, J);
    g.cut((k) => { fr(k, 0, 4.6, 2.4, 1.25, -1, 1.5, 0); });
    g.body([[-2.6, 10.5], [2.6, 10.5], [3.3, 15], [0.6, 18.5], [-3, 17.4], [-3.3, 14]], C.qing, Jl(0.9));     // the hand: pale hide
  };
  const legU = (g) => {
    g.body([[-6, -4], [6, -4], [5.4, 9], [4.6, 20], [-4.6, 20], [-5.8, 9]], C.lacquer, J);
    g.cut((k) => { fr(k, 0, 3.6, 4.3, 1.75, 1, 1.9, 0); fr(k, 0, 14, 3.3, 1.25, -1, 1.7, 0); });
  };
  const legL = (g) => {
    g.body([[-4.4, -2, 1], [4.4, -2, 1], [4.2, 17], [11.5, 19, 1], [11.5, 23, 1], [-4.4, 23, 1]], C.lacquer, J);
    g.tint([[-6, 2.5, 1], [6, 2.5, 1], [6, 5.5, 1], [-6, 5.5, 1]], C.mal);
    g.cut((k) => { fr(k, 0, 12, 3.2, 1.25, 1, 1.7, 0); });
  };

  parts.push(P('t', null, [0, 0], 20, (g) => {
    // three hanging plates below the belt, paper between them
    for (const x of [-9.8, 0, 9.8]) {
      g.body([[x - 3.5, -1, 1], [x + 3.5, -1, 1], [x + 3.9, 17], [x, 21.5, 1], [x - 3.9, 17]], C.lacquer, J);
      g.cut((k) => { fr(k, x, 4.6, 2.6, 1.25, x < 0 ? -1 : 1, 1.6, 0); fr(k, x, 12, 2.6, 1.25, x < 0 ? 1 : -1, 1.6, 0); });
    }
    // the cuirass: a beast's face (兽面) through the breast, then two gaps where the plates meet
    g.body([[-10, 2, 1], [-12.5, -10], [-15, -27], [-10.5, -34], [10.5, -34], [15, -27], [12.5, -10], [10, 2, 1]], C.lacquer, J);
    g.cut((k) => {
      slit(k, -11.5, -28.5, -2, -22, 3.8, 0.8); slit(k, 11.8, -28.5, 2.4, -22, 3.8, -0.8);            // eyes
      k.fillRect(-0.9, -21.5, 1.9, 7);                                                               // the ridge
      fr(k, -6.4, -11.4, 4.6, 1.75, -1, 2, 0); fr(k, 6.8, -11.4, 4.6, 1.75, 1, 2, 0);             // 云雷纹 on the belly plates, either side of the ridge
      slit(k, -10, -4.6, 10, -4.6, 1.3, 0.8);                                                         // the one gap, where breast meets belt
    });
    g.tint([[-14, -3.2, 1], [14, -3.2, 1], [14, 0.6, 1], [-14, 0.6, 1]], C.mal);
    g.body([[-2.6, -4.6, 1], [2.6, -4.6, 1], [2.6, 1.4, 1], [-2.6, 1.4, 1]], C.gold, Jl(0.7));
  }));

  parts.push(P('h', 't', [1, -33], 22, (g) => {
    const K = 0.94, q = (pts) => sc(pts, K);
    // the face: pale hide, turned toward us; a heavy brow, a slanted eye, the line of the cheek, a set mouth
    g.body(q([[-6, 3], [6, 3], [9.5, -2], [10, -7], [13, -8.8, 1], [11, -12.5], [10.8, -19], [-8, -19], [-9, -6]]), C.qing, Jl(1));
    g.cut((k) => { slit(k, 1 * K, -13.4 * K, 8.6 * K, -11 * K, 1.5, -0.5); slit(k, 4 * K, -3 * K, 9.4 * K, -3.5 * K, 0.9, 0.3); });
    g.ink(q([[0, -16.4], [9.6, -17.4]]), 1.6); g.ink(q([[-1, -9], [1.5, -3], [-1, 1]]), 0.8); g.ink(q([[-5.5, -12], [-5, -4]]), 0.7);
    // the helm: a black dome and a square neck guard
    g.body(q([[11.8, -17, 1], [11, -24], [5, -29.5], [-6, -29.5], [-11.5, -24], [-12, -10], [-15.5, -10, 1], [-15.5, -2, 1], [-9, -2, 1], [-9, -16.5, 1]]), C.lacquer, J);
    g.tint(q([[13, -21, 1], [-10, -21, 1], [-10, -16.5, 1], [13, -16.5, 1]]), C.mal);
    g.cut((k) => { k.fillRect(-14 * K, -7.4 * K, 4 * K, 2.4); slit(k, -8 * K, -26 * K, 7 * K, -26 * K, 1.5, -1.2); });
    // the flange along the crown (扉棱): three teeth of bronze. This is the people's top line.
    const top = -35.5 - v * 4.5;
    g.body(q([[-8.5, -29, 1], [-8.5, top, 1], [-4.6, top, 1], [-4.6, top + 4.5, 1], [-1.6, top + 4.5, 1], [-1.6, top, 1], [2.4, top, 1], [2.4, top + 4.5, 1], [5.4, top + 4.5, 1], [5.4, top, 1], [9.3, top, 1], [9.3, -29, 1]]), C.mal, Jl(1));
    if (v === 2) g.body(q([[-11, top - 0.5, 1], [-11, top - 7, 1], [-2.5, top - 7, 1], [-2.5, top - 4, 1], [-7, top - 4, 1], [-7, top - 0.5, 1]]), C.gold, Jl(0.8));   // a hooked finial: rank
  }));

  parts.push(P('au', 't', [4, -28], 26, armU), P('al', 'au', [0, 15], 27, armL));
  parts.push(P('bu', 't', [-1, -28], 6, armU), P('bl', 'bu', [0, 15], 5, armL));
  parts.push(P('lu', 't', [3, 1], 16, legU), P('ll', 'lu', [0, 18], 15, legL));
  parts.push(P('ku', 't', [-3, 1], 8, legU), P('kl', 'ku', [0, 18], 7, legL));

  const hand = o.hand || 'al', wz = hand === 'al' ? 24 : 4;
  // 戈: a dagger-axe. The blade stands across the shaft and points at the enemy; a tang behind it; the lower edge runs down the wood.
  if (o.weapon === 'ge') parts.push(P('w', hand, [0, 16.5], wz, (g) => {
    const L = o.long ? 26 : 0;
    g.strip([[-46, 0], [64 + L, 0]], 2.6, C.lacquer);
    g.body([[38 + L, 1.5, 1], [45 + L, 8], [48.5 + L, 31, 1], [54.5 + L, 11], [57.5 + L, 1.5, 1]], C.gold, Jl(0.9));
    g.body([[47.5 + L, -1.5, 1], [55.5 + L, -1.5, 1], [55.5 + L, -9, 1], [47.5 + L, -9, 1]], C.gold, Jl(0.8));
    g.cut((k) => { slit(k, 49.5 + L, 22, 50.4 + L, 6, 0.9); dot(k, 51.5 + L, -5.2, 1.3); });
    g.body([[62 + L, -2.8, 1], [68 + L, -2.8, 1], [68 + L, 2.8, 1], [62 + L, 2.8, 1]], C.mal, Jl(0.7));
    g.body([[-46, -2.6, 1], [-52, -2.6, 1], [-52, 2.6, 1], [-46, 2.6, 1]], C.mal, Jl(0.7));
  }, 0, true));
  // the same 戈 set against a charge: gripped near the butt, so it reaches far forward of the shield; a tuft of cinnabar
  // hangs at the point while it is set. This is the only cinnabar on a Shang figure. One of the two is shown (pose.$hide).
  if (o.weapon === 'ge' && o.long) parts.push(P('wb', hand, [0, 16.5], wz + 0.1, (g) => {
    const L = 62;
    g.strip([[-20, 0], [64 + L, 0]], 3, C.lacquer);
    g.body([[38 + L, 1.5, 1], [45 + L, 8], [48.5 + L, 31, 1], [54.5 + L, 11], [57.5 + L, 1.5, 1]], C.gold, Jl(0.9));
    g.body([[47.5 + L, -1.5, 1], [55.5 + L, -1.5, 1], [55.5 + L, -9, 1], [47.5 + L, -9, 1]], C.gold, Jl(0.8));
    g.cut((k) => { slit(k, 49.5 + L, 22, 50.4 + L, 6, 0.9); dot(k, 51.5 + L, -5.2, 1.3); });
    g.body([[60 + L, -3.4, 1], [73 + L, 0, 1], [60 + L, 3.4, 1]], C.red, Jl(0.8));                     // the point
    g.body([[61 + L, 3], [57 + L, 12], [61.5 + L, 25, 1], [66 + L, 11]], C.red, Jl(0.7));              // the tuft
    g.body([[-20, -2.6, 1], [-26, -2.6, 1], [-26, 2.6, 1], [-20, 2.6, 1]], C.mal, Jl(0.7));
  }, 0, true));
  // 钺: a broad axe, short in the haft
  if (o.weapon === 'yue') parts.push(P('w', hand, [0, 16.5], wz, (g) => {
    const L = o.long ? 16 : 0;      // the axeman's is long in the haft and broad: it has to read when it is raised
    g.strip([[-12 - L, 0], [44 + L, 0]], 2.8, C.lacquer);
    g.body([[28 + L, -2, 1], [27.5 + L, -7, 1], [16 + L, -24, 1], [33 + L, -29.5], [50 + L, -24, 1], [38.5 + L, -7, 1], [38 + L, -2, 1]], C.gold, Jl(1));
    g.cut((k) => { slit(k, 24 + L, -19.6, 31 + L, -17, 1.7, 0.4); slit(k, 42 + L, -19.6, 35 + L, -17, 1.7, -0.4); slit(k, 33 + L, -13, 33 + L, -5, 1); });
    g.body([[28 + L, 2, 1], [38 + L, 2, 1], [38 + L, 7, 1], [28 + L, 7, 1]], C.gold, Jl(0.8));
  }, 0, true));
  if (o.weapon === 'bow') {
    // a quiver on the back, its arrows standing above the helm: the archer's own top line
    parts.push(P('q', 't', [-9, -30], 3, (g) => {
      g.body([[-5.5, -6, 1], [5.5, -6, 1], [4.4, 30], [-4.4, 30]], C.lacquer, J);
      g.tint([[-6.5, -1, 1], [6.5, -1, 1], [6.5, 3, 1], [-6.5, 3, 1]], C.mal);
      for (const [x, top] of [[-3.6, -40], [0, -47], [3.6, -42]]) { g.strip([[x, -5], [x, top]], 1.5, C.lacquer); g.body([[x - 2.6, top + 9, 1], [x, top - 1, 1], [x + 2.6, top + 9, 1]], C.lacquer, Jl(0.6)); }
    }, -16));
    // a tall bow, so that it reads at game size: the limbs stand well above the helmet when it is raised
    parts.push(P('w', hand, [0, 16.5], wz, (g) => {
      g.strip([[-14, -50], [-1, -36], [7.5, -15], [8.5, 0], [7.5, 15], [-1, 36], [-14, 50]], 3.6, C.lacquer);
      g.strip([[-14, -50], [-22, -55]], 2.4, C.lacquer); g.strip([[-14, 50], [-22, 55]], 2.4, C.lacquer);
      g.ink([[-16, -51.5], [-16, 51.5]], 0.9);                                   // the string at rest
    }, 0, true));
    // the same bow drawn: the limbs bent back, the string pulled to a point, the arrow a firm dark line with a mark of
    // cinnabar at its head. Only one of the two is shown (pose.$hide).
    parts.push(P('wd', hand, [0, 16.5], wz + 0.1, (g) => {
      g.strip([[-22, -46], [-5, -35], [6.5, -15], [8.5, 0], [6.5, 15], [-5, 35], [-22, 46]], 3.6, C.lacquer);
      g.strip([[-22, -46], [-30, -49]], 2.4, C.lacquer); g.strip([[-22, 46], [-30, 49]], 2.4, C.lacquer);
      g.ink([[-24, -47], [-42, 0], [-24, 47]], 1);
      g.strip([[-42, 0], [34, 0]], 2.6, C.lacquer);
      g.body([[30, -4.2, 1], [47, 0, 1], [30, 4.2, 1]], C.red, Jl(0.8));
    }, 0, true));
  }
  // the standard: a pole, a cross bar, a rigid board with a key-cut edge and one staring eye. Nothing on it streams.
  if (o.standard) parts.push(P('f', 't', [-6, -22], 3, (g) => {
    g.strip([[0, 16], [0, -104]], 2.6, C.lacquer);
    g.strip([[-15, -94], [15, -94]], 2.4, C.lacquer);
    g.body([[-3, -104, 1], [-3, -110, 1], [-7, -110, 1], [-7, -117, 1], [7, -117, 1], [7, -110, 1], [3, -110, 1], [3, -104, 1]], C.gold, Jl(0.8));
    g.body([[-12, -92, 1], [12, -92, 1], [12, -80, 1], [15.5, -80, 1], [15.5, -72, 1], [12, -72, 1], [12, -60, 1], [15.5, -60, 1], [15.5, -52, 1], [12, -52, 1], [12, -42, 1], [3.5, -42, 1], [3.5, -36, 1], [-3.5, -36, 1], [-3.5, -42, 1], [-12, -42, 1], [-12, -52, 1], [-15.5, -52, 1], [-15.5, -60, 1], [-12, -60, 1], [-12, -72, 1], [-15.5, -72, 1], [-15.5, -80, 1], [-12, -80, 1]], C.lacquer, J);
    g.tint([[-16, -92, 1], [16, -92, 1], [16, -86, 1], [-16, -86, 1]], C.mal);
    g.cut((k) => { ring(k, 0, -70, 5.6, 2); dot(k, 0, -70, 1.6); slit(k, -8, -54, 8, -54, 1.5, 2.2); slit(k, -7, -47, 7, -47, 1.1); fret(k, -6.5, -80.5, 2.6, 1.5, 1, 1.2, 0); fret(k, 6.5, -80.5, 2.6, 1.5, -1, 1.2, 0); });
    for (const x of [-13.5, 13.5]) g.body([[x - 2.2, -92, 1], [x + 2.2, -92, 1], [x + 2.2, -84, 1], [x, -80, 1], [x - 2.2, -84, 1]], C.gold, Jl(0.7));
  }, 3, true));
  // the shield-bearer's shield: the 亞 shape grown to cover him, an animal mask cut through it, two bronze horns above
  if (o.shield === 'mask') parts.push(P('s', o.shieldHand || 'bl', [0, 13], o.shieldZ ?? 30, (g) => {
    for (const d of [-1, 1]) g.body([[d * 5, -30, 1], [d * 9, -44], [d * 19, -50, 1], [d * 15, -40], [d * 14, -30, 1]], C.gold, Jl(0.9));
    g.body([[-14, -32, 1], [14, -32, 1], [14, -26, 1], [21, -26, 1], [21, 26, 1], [14, 26, 1], [14, 33, 1], [-14, 33, 1], [-14, 26, 1], [-21, 26, 1], [-21, -26, 1], [-14, -26, 1]], C.lacquer, J);
    g.tint([[-22, 0, 1], [22, 0, 1], [22, 6, 1], [-22, 6, 1]], C.mal);
    g.cut((k) => { slit(k, -16, -19, -4.5, -11, 4, 0.9); slit(k, 16, -19, 4.5, -11, 4, -0.9); slit(k, 0, -25, 0, -8, 1.6); fret(k, -12.5, -4.6, 3.4, 1.5, -1, 1.7, 0); fret(k, 12.5, -4.6, 3.4, 1.5, 1, 1.7, 0);
      for (let i = 0; i < 5; i++) { k.beginPath(); k.rect(-12.4 + i * 5.3, 13, 3.4, 6.4); k.fill(); } slit(k, -13, 24.5, 13, 24.5, 1.2, 1.2); });
    g.body([[-3, 0.6, 1], [3, 0.6, 1], [3, 6.6, 1], [-3, 6.6, 1]], C.gold, Jl(0.7));
  }, 0, true));
  // the captain's horn: bronze, a long curve, lifted to the mouth (hidden otherwise)
  if (o.horn) parts.push(P('horn', o.hornHand || 'al', [0, 15], 28, (g) => {
    g.body([[-3, -3], [10, -5], [24, -12], [36, -25], [41, -40, 1], [47, -38, 1], [42, -20], [29, -4], [12, 3], [-3, 3]], C.gold, Jl(1));
    g.tint([[18, -12], [24, -18], [32, -8], [26, -2]], C.mal);
    g.cut((k) => { slit(k, 2, 0, 12, -1, 1); });
  }, 0, true));
  // the shield: 亞-shaped, broad, lacquer black; a staring face with square teeth
  if (o.shield && o.shield !== 'mask') parts.push(P('s', o.shieldHand || 'bl', [0, 13], o.shieldZ ?? 30, (g) => {
    g.body([[-9, -21, 1], [9, -21, 1], [9, -16.5, 1], [14, -16.5, 1], [14, 16.5, 1], [9, 16.5, 1], [9, 21, 1], [-9, 21, 1], [-9, 16.5, 1], [-14, 16.5, 1], [-14, -16.5, 1], [-9, -16.5, 1]], C.lacquer, J);
    g.tint([[-15, -3, 1], [15, -3, 1], [15, 2, 1], [-15, 2, 1]], C.mal);
    g.cut((k) => { slit(k, -10.5, -12.5, -3, -8, 2.6, 0.7); slit(k, 10.5, -12.5, 3, -8, 2.6, -0.7); slit(k, 0, -15, 0, -6, 1.1); for (let i = 0; i < 4; i++) { k.beginPath(); k.rect(-8.2 + i * 4.5, 8, 2.8, 4.4); k.fill(); } });
    g.body([[-2.6, -3.6, 1], [2.6, -3.6, 1], [2.6, 2.6, 1], [-2.6, 2.6, 1]], C.gold, Jl(0.7));
  }, 0, true));

  return { parts, feet: [{ id: 'll', pt: [3, 23] }, { id: 'kl', pt: [3, 23] }] };
}


// ------------------------------------------------------------------ boon marks
// An owned boon recolours one piece: the mark is that piece (or its head) cut again in the element's pigment and laid
// over it with the same matrix. Slots, in the order boons are taken: the axe's blade, the standard's two ribbons, the
// scarf, the plume. `shield` is the mark an army boon puts on a Zhou shield (its boss and band).
export const ELEMENT = { fire: 'red', water: 'azu', wood: 'mal', metal: 'gold', earth: 'ochre' };
export const MARK_SLOTS = ['yue', 'm2', 'm3', 'cape', 'plume'];
export function boonMark(slot, element) {
  const col = C[ELEMENT[element]] || C.red, one = (draw) => ({ parts: [P('k', null, [0, 0], 0, draw)] });
  if (slot === 'yue') return one((g) => {
    g.body([[92, 2, 1], [91, 9, 1], [78, 31, 1], [100, 38], [122, 31, 1], [109, 9, 1], [108, 2, 1]], col, { line: 1.1 });
    g.cut((k) => { slit(k, 86.5, 19, 96.5, 23.5, 2.4, 0.6); slit(k, 113.5, 19, 103.5, 23.5, 2.4, -0.6); slit(k, 100, 7, 100, 18, 1.2); });
  });
  if (slot === 'm2' || slot === 'm3') { const k = slot === 'm2' ? 1 : 0.86; return one((g) => {
    g.body(sc([[1, -3], [-14, -5], [-30, -1], [-46, 7, 1], [-34, 7], [-40, 15, 1], [-24, 8], [-10, 5], [1, 3]], k), col, { line: 0.9 }); g.cut((kk) => { slit(kk, -5 * k, 0, -28 * k, 3 * k, 1.2, 1.5); }); }); }
  if (slot === 'cape') return one((g) => { g.body([[4, -4], [-10, -7], [-24, -3], [-34, 6], [-40, 18, 1], [-30, 12], [-26, 21, 1], [-19, 10], [-10, 8], [-2, 9], [4, 4]], col); g.cut((k) => { slit(k, -5, 0, -27, 5, 1.4, 2.5); }); });
  if (slot === 'plume') return one((g) => { g.body([[-1, 1], [-9, -13], [-24, -23], [-42, -24], [-54, -15, 1], [-42, -18.5], [-26, -17], [-12, -8], [2, 3]], col, { line: 0.8 }); });
  if (slot === 'shield') return one((g) => { g.body([[-13, -7, 1], [13, -7, 1], [13, 5, 1], [-13, 5, 1]], col, { line: 0.9 }); g.cut((k) => { ring(k, 0, -1, 4.2, 1.3); }); });
  return null;
}
