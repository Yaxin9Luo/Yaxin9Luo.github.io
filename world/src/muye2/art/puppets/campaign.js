// The campaign's mass, redrawn in full colour (PLAN-CAMPAIGN sections 6 and 9). STYLE SHEET ROUND: five Shang kinds, one
// elite, one palace guard, two Zhou squads at ranks 1, 3, 5. Nothing here replaces a key of index.js yet; the pipeline
// shape is the same (PUPPETS-like entries, a cutter), so the kinds can be merged when the rules publish their ids.
//
// The colour rule (殷人尚白、周人尚赤, the lead's):
//   Shang: undyed silk (bare paper) and bone, lacquer black, bronze; a little jade (malachite) on rank. No cinnabar.
//   Zhou:  cinnabar and its deep red, ochre leather, bronze; black only for hair and shoes.
// What each figure is made of, from the outline inward:
//   1. a silhouette that says the kind (the 戈's blade on a pole, the shield's tall mask, the bow's arc, the antlers);
//   2. a costume in three or four big fields (robe, armour, apron 蔽膝, helm) that holds at 60 px;
//   3. pattern inside the fields, read as texture at game size and as craft at 3x: lacquered lamellae laced in bone,
//      squared spirals (雷纹) cut through black bands, bronze bosses, taotie masks on shields, helms and axes.
// Motifs: Houjiazhuang (侯家庄 M1004) bronze helms with a taotie over the brow and a plume tube; lacquered leather
// lamellar; Shang 戈 with no lower edge (胡) against the Zhou 戈 with a long 胡; the Ya Chou (亚丑) axe with its cut
// grinning face for the guard; painted shields with a taotie; the Anyang chariot (many spokes, bronze axle caps, a small
// box); 殷人戎事乘翰 (the Shang rode white horses to war). Zhou: lacquered red leather, a bronze boss (钖) on the shield.
import { C, horse } from './base-figures.js';
import { fret, dot, ring, slit, scales } from './engine.js';
import { KIND, footPose, heroPose, STANDLEGS, SETLEGS, LUNGE, mix } from './base-poses.js';
import { PUPPETS as OLD, createCutter as oldCutter, framesOf as oldFrames } from './index.js';
import { bake, drawPuppet, footDrop, solve } from './engine.js';
import { cloud } from './troops.js';
import './poses-campaign.js';

const P = (id, parent, at, z, draw, rot = 0, world = false) => ({ id, parent, at, z, draw, rot, world });
const R = (x0, y0, x1, y1) => [[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]];
const mv = (pts, x, y, k = 1) => pts.map((q) => [q[0] * k + x, q[1] * k + y, q[2]]);
const fx = (pts) => pts.map((q) => [-q[0], q[1], q[2]]);
const circ = (x, y, r, n = 10, ry = r) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * ry]);

// ------------------------------------------------------------------ palette
export const CP = {
  silk: '#ffffff', bone: '#ECE3D1', boneFar: '#E2D8C4', skin: '#F0E0C6', skinFar: '#E6D3B6',
  lac: C.lacquer, ink: C.jiao, zground: '#3A1410', zhe: '#B07E2C', bronze: C.gold, bronzeDeep: '#7A5E27', gilt: '#C49A3E', jade: C.mal, jadePale: '#8DB3A2',
  red: C.red, redDeep: C.redDeep, redFar: '#9E2A1B', ochre: C.ochre, leather: '#6A472B', grey: C.zhong, nong: C.nong, qing: C.qing, azu: C.azu,
};
const ln = (line, o = {}) => ({ jit: 0.04, line, ...o });

// ------------------------------------------------------------------ pattern vocabulary
// a band of squared spirals cut through a dark band: paper shows through the knife
const fretRow = (g, x0, x1, y, r, w = 0.7) => g.cut((k) => { let d = 1; for (let x = x0 + r; x <= x1 - r; x += r * 2.3) { fret(k, x, y, r, 1.5, d, w, 0); d = -d; } });
// lacquered lamellae, laced in bone: rows of lacing and staggered plate edges, drawn as lines over the black
function lamellae(g, x0, x1, y0, y1, rowH = 4.2, colW = 3.6, col = CP.bone, w = 0.42) {
  let row = 0;
  for (let y = y0; y <= y1 + 0.01; y += rowH, row++) {
    g.ink([[x0, y], [(x0 + x1) / 2, y + 0.5], [x1, y]], w, col);
    for (let x = x0 + (row % 2 ? colW / 2 : 0) + colW * 0.5; x < x1 - 0.8; x += colW) g.ink([[x, y + 0.9], [x, y + rowH - 0.9]], w * 0.8, col);
  }
}
// a diaper of small lozenges (菱纹), woven into undyed silk: a breath of grey at game size, a pattern at 3x
function diaper(g, x0, x1, y0, y1, col) { let row = 0; for (let y = y0 + 1.5; y < y1; y += 3.4, row++) for (let x = x0 + (row % 2 ? 1.7 : 0); x < x1; x += 3.4) g.tint([[x, y - 0.9], [x + 0.9, y], [x, y + 0.9], [x - 0.9, y]], col); }
// a bronze boss with a hole cut in it (甲泡)
const boss = (g, x, y, r = 2, col = CP.bronze) => { g.body(circ(x, y, r, 8), col, ln(0.5)); g.cut((k) => dot(k, x, y, r * 0.34)); };
// a taotie in two tones on a field: horns, eyes with pupils, the nose ridge, the jaw with fangs. (cx, cy) centre, k size; fg the light, bg the pupils.
function taotie(g, cx, cy, k, fg, bg) {
  const M = (pts) => mv(pts, cx, cy, k);
  for (const s of [-1, 1]) {
    const S = (pts) => (s > 0 ? M(pts) : M(fx(pts)));
    g.tint(S([[1.5, -10], [5, -12.5], [9.5, -12], [10.5, -8.5], [8, -9.5], [5, -8], [2.5, -6]]), fg);              // the horn, curling out
    g.tint(S([[2, -4.5], [5.5, -6.5], [9.5, -5], [10, -2], [6.5, -0.5], [3, -1.5]]), fg);                          // the eye
    g.tint(S([[5.5, -4.6], [7.6, -4.6], [7.6, -2.2], [5.5, -2.2]]), bg);                                          // the pupil
    g.tint(S([[11, -6], [13, -3], [12, 2], [10.5, 1]]), fg);                                                     // the ear
    g.tint(S([[1.5, 4], [10, 3.5], [11.5, 6], [6, 7], [5, 10.5, 1], [3.2, 7], [1.5, 7]]), fg);                     // the jaw and a fang
  }
  g.tint(M([[-1.3, -11], [1.3, -11], [1.5, 2], [3, 4.5], [-3, 4.5], [-1.5, 2]]), fg);                               // the nose ridge
}

// ------------------------------------------------------------------ the body (round 3: toward the generated reference)
// A foot figure on the joints of the first game (t h au al bu bl lu ll ku kl), so the existing poses drive it.
// Built like a carved and painted hide puppet: a heavy carved outline on every piece; armour as rows of small plates
// with dark gaps between them; studded and patterned borders on every cloth edge; a two-tier skirt (plates over cloth);
// a sash knotted at the front with hanging ends; a profile face with a heavy brow, an almond eye, moustache and beard;
// fists that close round the haft. The head is drawn 1.18 times larger than before (the reference's head is a fifth
// of the figure), through a scaling proxy, so every helm below keeps its own coordinates.
// o: robe, robeFar, diaper, shade, border {col, stud, fret}, plate {ground, plate, stud, band} (armour; null for none),
//    greaves (bool), tassets (bool), pauldron (bool), jerkin {ground, stud, band} (studded hide), sash {col, tip},
//    beard (hair colour; null clean-shaven), helm fn, skin, leg, shin, wrapCol, shoe, long, lower, armour (extra), chest
const OUT = 1.5, IN = 0.7;                                                     // the carved outline: heavy round the silhouette, light inside
const scaled = (g, K, ox = 0, oy = 0) => ({
  body: (pts, col, o) => g.body(mv(pts, ox, oy, K), col, o), tint: (pts, col, a) => g.tint(mv(pts, ox, oy, K), col, a),
  ink: (pts, w = 0.8, col) => g.ink(mv(pts, ox, oy, K), w * K, col), strip: (pts, w, col, a) => g.strip(mv(pts, ox, oy, K), w * K, col, a),
  cut: (fn, clip) => g.cut((k, r) => { k.save(); k.translate(ox, oy); k.scale(K, K); fn(k, r); k.restore(); }, clip),
  get last() { return g.last; }, set last(v) { g.last = v; }, rnd: g.rnd, c: g.c,
});
// plates in rows inside the last body: each plate a lamella with a pointed foot, the gaps left in the ground's colour
function plates(g, x0, x1, y0, y1, pw, ph, col, o = {}) {
  const gp = o.gap ?? 0.45; let row = 0;
  for (let y = y0; y < y1; y += ph, row++) for (let x = x0 - (row % 2 ? pw / 2 : 0); x < x1; x += pw)
    g.tint([[x + gp, y + gp, 1], [x + pw - gp, y + gp, 1], [x + pw - gp, y + ph - gp - ph * 0.12, 1], [x + pw / 2, y + ph - gp, 1], [x + gp, y + ph - gp - ph * 0.12, 1]], col);
  if (o.lace) for (let y = y0 + ph * 0.32; y < y1; y += ph) g.ink([[x0, y], [x1, y]], 0.32, o.lace);     // the lacing through each row
}
// a border band inside the last body: a band of colour with studs along it, or squared spirals cut through it
function border(g, x0, x1, y0, y1, b) {
  if (!b) return; g.tint(R(x0, y0, x1, y1), b.col);
  const my = (y0 + y1) / 2, r = Math.min(0.85, (y1 - y0) * 0.26);
  if (b.stud) for (let x = x0 + 1.6; x < x1 - 0.8; x += 2.6) g.tint(circ(x, my, r, 6), b.stud);
  else if (b.fret) fretRow(g, x0 + 1, x1 - 1, my, (y1 - y0) * 0.34, 0.5);
  if (b.edge) { g.ink([[x0, y0], [x1, y0]], 0.35, b.edge); g.ink([[x0, y1], [x1, y1]], 0.35, b.edge); }
}
// the Shang whorl (囧纹) on a round bronze disc: a ring, a boss, curved blades turning round it
function whorl(g, x, y, r, col = CP.bronze, dark = CP.bronzeDeep) {
  g.body(circ(x, y, r, 16), col, ln(0.8)); g.tint(circ(x, y, r * 0.78, 14), dark); g.tint(circ(x, y, r * 0.66, 14), col);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.tint([[x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2], [x + Math.cos(a + 0.5) * r * 0.62, y + Math.sin(a + 0.5) * r * 0.62], [x + Math.cos(a + 0.9) * r * 0.5, y + Math.sin(a + 0.9) * r * 0.5]], dark); }
  g.tint(circ(x, y, r * 0.2, 8), col);
}
// a grid of studs (bronze bosses on hide)
function studs(g, x0, x1, y0, y1, step, r, col) { let row = 0; for (let y = y0; y <= y1; y += step, row++) for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) { g.tint(circ(x, y, r, 7), CP.ink); g.tint(circ(x - 0.15, y - 0.15, r * 0.78, 7), col); } }

function body(o) {
  const robe = o.robe, far = o.robeFar || robe, parts = [], skin = o.skin || CP.skin, skinFar = o.skinFar || CP.skinFar, pl = o.plate, B = o.border;
  const darker = (near, col) => (near ? col : (o.farOf && o.farOf[col]) || col);
  const armU = (near) => (g) => {
    g.body([[-4.9, -4], [4.7, -4.8], [5.9, 6], [5.7, 15.5], [-4.7, 16], [-5.7, 6]], near ? robe : far, ln(OUT));
    if (o.diaper) diaper(g, -6, 6, -4, 11, o.diaper);
    g.ink([[1, -2], [0.4, 11]], 0.4, CP.grey);                                                                   // a fold
    border(g, -7, 7, 11.6, 16.5, B);
    if (pl && o.pauldron !== false) {                                                                           // the pauldron: two rows of plates, a studded rim, a disc
      g.body([[-7.8, -6.8], [1, -9.4], [8.8, -5.8], [9, 2.4], [6.4, 6.6], [-6.4, 6.6], [-8.4, 2.4]], pl.ground, ln(OUT));
      plates(g, -9, 10, -7.5, 3.6, 4, 4.2, near ? (o.pauldronPlate || pl.plate) : (pl.plateFar || pl.plate), { lace: pl.lace });
      border(g, -10, 10, 3.4, 6.8, { col: pl.band, stud: pl.stud });
      g.body(circ(0.4, -4.6, 2, 10), pl.stud, ln(IN)); g.cut((k) => dot(k, 0.4, -4.6, 0.6));
    }
    if (o.shoulder) o.shoulder(g, near);
  };
  const armL = (near) => (g) => {
    g.body([[-3.7, -1.5], [3.7, -1.5], [3.5, 11.2], [-3.5, 11.2]], o.forearm || (near ? robe : far), ln(OUT));
    if (pl && o.vambrace !== false) { g.tint(R(-4.5, 0.6, 4.5, 11.4), pl.ground); plates(g, -4.5, 4.5, 0.8, 8.6, 3.2, 3.6, near ? pl.plate : (pl.plateFar || pl.plate)); border(g, -4.5, 4.5, 8.4, 11.4, { col: pl.band, stud: pl.stud }); }
    else if (o.bracer) { g.tint(R(-4.5, 4, 4.5, 11.4), o.bracer); border(g, -4.5, 4.5, 8.8, 11.4, { col: CP.lac, stud: CP.bronze }); }
    // the fist, closed round the haft: knuckles forward, three finger lines, the thumb over them
    g.body([[-3.6, 10.2], [3.4, 10.2], [4.9, 11.8], [5, 15.6], [2.8, 17.2], [-2.6, 17], [-4, 14.6]], near ? skin : skinFar, ln(1.1));
    for (const y of [12.4, 14, 15.6]) g.ink([[0.6, y - 0.3], [3, y], [4.8, y - 0.4]], 0.45, CP.leather);
    g.ink([[-3.2, 11.4], [-0.8, 13.6], [1.8, 13.2]], 0.55, CP.leather);
  };
  const legU = (near) => (g) => {
    g.body([[-6.1, -4], [6.1, -4], [5.3, 21.5], [-5.1, 21.5]], o.leg || (near ? robe : far), ln(OUT));
    g.ink([[0, 0], [0.6, 18]], 0.4, CP.grey);
    if (pl && o.knee !== false) { g.body(circ(0.8, 19.6, 4.8, 14, 4), pl.ground, ln(1.1)); g.tint(circ(0.8, 19.6, 3.6, 12, 2.9), pl.plate); g.tint(circ(0.8, 19.6, 1.1, 8), pl.stud); }
  };
  const legL = (near) => (g) => {
    const greave = pl && o.greaves;
    g.body([[-4.5, -1.2], [4.5, -1.2], [3.9, 18.5], [-3.9, 18.5]], greave ? pl.ground : (o.shin || CP.bone), ln(OUT));
    if (greave) { plates(g, -4.6, 4.6, 2, 17, 3.4, 3.8, near ? pl.plate : (pl.plateFar || pl.plate)); border(g, -4.6, 4.6, -1.2, 2, { col: pl.band, stud: pl.stud }); }
    else if (o.wraps !== false) for (let y = 0.6; y < 17; y += 2.7) g.ink([[-4.2, y + 1.7], [4.2, y]], o.wrapW || 0.75, o.wrapCol || CP.lac);   // puttees, wound
    // the boot: an upturned toe, a pale sole, a tie at the ankle
    g.body([[-4.8, 16.4], [4.3, 16.4], [8.6, 17.8], [12.6, 18.8], [14.9, 20.4, 1], [14.6, 23, 1], [-5.2, 23, 1]], o.shoe || CP.lac, ln(OUT));
    g.tint(R(-6, 21.3, 16, 23.4), o.sole || CP.bone); g.ink([[-4.6, 17.6], [4, 17.2]], 0.6, o.sole || CP.bone);
  };

  parts.push(P('t', null, [0, 0], 20, (g) => {
    const L = o.long ? 40 : 21.5;
    // 1. the robe to the knee (or the ankle), patterned, with its border
    g.body([[-10.5, -6], [10.5, -6], [13.8, 8], [o.long ? 19 : 16, L, 1], [o.long ? -18 : -15, L, 1], [-12.8, 8]], robe, ln(OUT));
    if (o.diaper) diaper(g, -16, 19, -5, L - 5, o.diaper);
    if (o.shade) g.tint([[-22, -8], [-6, -8], [-8, L + 2], [-22, L + 2]], o.shade, 0.55);
    for (const x of [-5, 3]) g.ink([[x, -2], [x - 0.6, L - 6]], 0.45, CP.grey);
    if (o.hem !== null) border(g, -22, 22, L - (o.long ? 7 : 5.4), L + 1, o.hem ? { col: o.hem, fret: true } : B);
    if (o.lower) o.lower(g, L);
    // 2. 蔽膝: the apron from the belt, edged, with a motif
    if (o.apron) { g.body([[5.5, -4], [12.5, -4], [14.6, L - 3], [12.6, L, 1], [7, L, 1]], o.apron, ln(1.1)); border(g, 4, 16, L - 5.6, L - 2.6, { col: o.apronTrim || CP.bronze, stud: o.apronStud }); g.ink([[8, -2], [9, L - 7]], 0.4, CP.grey); }
    // 3. the armoured skirt (tassets) over the robe: plates in three rows, a studded hem
    if (pl && o.tassets !== false) {
      const T = o.longTassets ? 17 : 13.5;
      g.body([[-11.8, -5], [11.8, -5], [14.6, 6], [16.4, T, 1], [1, T + 1.2, 1], [-15.4, T, 1], [-13.8, 6]], pl.ground, ln(OUT));
      plates(g, -16, 17, -3.5, T - 3, 4.4, 4.8, o.tassetPlate || pl.plate, { lace: pl.lace });
      border(g, -17, 18, T - 3.2, T + 1.4, { col: pl.band, stud: pl.stud });
      g.ink([[1, -3], [1, T]], 0.6, CP.ink);                                                                    // the split at the front
    }
    // 4. the upper body: cloth, studded hide, or a cuirass of plates
    const chest = [[-9.5, -3], [-11.8, -15], [-12.4, -29], [-9, -38.5], [1.5, -40.5], [7, -39], [11.6, -33], [13.2, -23], [11.4, -12], [10.5, -3]];
    if (pl) { g.body(chest, pl.ground, ln(OUT)); plates(g, -13, 14, -37.5, -7, 4.6, 5.2, pl.plate, { lace: pl.lace }); border(g, -14, 15, -40.6, -37.4, { col: pl.band, stud: pl.stud }); }
    else if (o.jerkin) { const J = o.jerkin; g.body(chest, J.ground, ln(OUT)); studs(g, -10, 12, -34, -9, 4.2, 0.95, J.stud); border(g, -14, 15, -40.6, -36.8, { col: J.band, stud: J.stud }); g.ink([[1.5, -40], [4, -6]], 0.6, J.band); }
    else { g.body(chest, o.coat || robe, ln(OUT)); if (o.diaper) diaper(g, -13, 14, -38, -6, o.diaper); g.ink([[-6, -36], [-7, -10]], 0.4, CP.grey); }
    if (o.armour) o.armour(g);
    // 5. the crossed collar 交领, bordered
    g.body([[-4.5, -39.4], [2, -41], [8, -37.8], [2.2, -29.2], [-1.6, -35.4]], o.collar || CP.silk, ln(IN));
    g.tint([[5.2, -38.6], [8, -37.8], [2.2, -29.2], [1, -31.6]], (B && B.col) || CP.lac);
    // 6. the belt, studded, and the sash knotted in front with two ends hanging
    g.tint(R(-14, -7.4, 15, -2.4), o.belt || CP.lac); for (let x = -10; x < 12; x += 3) g.tint(circ(x, -4.9, 0.75, 6), o.beltStud || CP.bronze);
    if (o.sash) { const S = o.sash;
      g.body([[10, -4], [9.4, 2], [8.2, 12], [7.4, 18, 1], [9.6, 15.6], [10.8, 19, 1], [11.6, 11], [11.8, 2]], S.col, ln(0.9));   // the long end
      g.body([[11.6, -4], [12.8, 1], [13.8, 8.4, 1], [15, 5], [16.4, 8, 1], [15, -1]], S.col, ln(0.9));                       // the short end
      if (S.tip) { g.tint(R(6, 12, 13, 20), S.tip); }
      g.body([[10.5, -5], [6.4, -9], [4.6, -6.6], [6.2, -3.6]], S.col, ln(0.9)); g.body([[11.5, -5], [15.6, -8.8], [17.4, -6.2], [15, -3.4]], S.col, ln(0.9));   // the loops
      g.body(circ(11, -5, 1.9, 8), S.knot || S.col, ln(0.9));
    } else if (o.beltHook !== false) g.body([[8.5, -7.6], [13.6, -6.8], [14, -2.6], [8.5, -2.2]], CP.bronze, ln(IN));
    if (o.chest) o.chest(g);
  }));
  parts.push(P('h', 't', [1.5, -38.5], 22, (g0) => {
    const g = scaled(g0, 1.18);
    // the face in profile: a forehead, a deep brow, a strong nose, the mouth, a set chin
    g.body([[-4.6, 1], [3.4, 1.4], [5.6, -1.4], [6.4, -3.6], [8, -4.6, 1], [7.6, -5.8], [8.4, -7.2], [9.9, -9.8, 1], [8.4, -11], [9.3, -12.8, 1], [8.7, -15], [4, -18.5], [-5, -18], [-7.4, -10]], skin, ln(1.1));
    g.tint([[4.4, -11], [6.6, -12.3], [8.4, -11.3], [6.6, -10.3]], CP.silk);                                        // the eye, almond
    g.tint(circ(7, -11.5, 0.78, 7), CP.ink);
    g.ink([[4.1, -10.9], [6.6, -12.6], [8.6, -11.4]], 0.75); g.ink([[5, -10.4], [7.6, -10.5]], 0.35);
    g.ink([[3, -13.2], [6.4, -14.6], [9.4, -13.4]], 1.25);                                                           // the brow, heavy, angled
    g.ink([[8.5, -7.4], [7.6, -6.3]], 0.5); g.ink([[7.7, -4], [5.8, -3.7]], 0.55);                                  // the nostril, the mouth
    g.ink([[-1.4, -11.2], [-2.9, -9], [-1.8, -6.4]], 0.6);                                                          // the ear
    if (o.beard) { g.body([[8.1, -5.2], [5.6, -5.6], [2.4, -3.4], [5.4, -4.2], [7.8, -4.2]], o.beard, ln(0.5));      // moustache
      g.body([[7.6, -3.3], [6.8, -0.8], [5.4, 3.4], [3, 10, 1], [2.2, 3.4], [0.2, 1], [-2, -1.8], [1.8, -2.2]], o.beard, ln(0.7));   // a pointed beard
      g.ink([[5, -1], [3.6, 6]], 0.35, CP.grey); }
    o.helm(g);
  }));
  parts.push(P('au', 't', [2.5, -34], 26, armU(true)), P('al', 'au', [0, 14.6], 27, armL(true)));
  parts.push(P('bu', 't', [-1.5, -34], 6, armU(false)), P('bl', 'bu', [0, 14.6], 5, armL(false)));
  parts.push(P('lu', 't', [3, 1], 16, legU(true)), P('ll', 'lu', [0, 20.5], 15, legL(true)));
  parts.push(P('ku', 't', [-3, 1], 8, legU(false)), P('kl', 'ku', [0, 20.5], 7, legL(false)));
  return { parts, feet: [{ id: 'll', pt: [3, 23] }, { id: 'kl', pt: [3, 23] }] };
}

// ------------------------------------------------------------------ helms and heads
// The Shang bronze helm (Houjiazhuang): a dome down over the ears, a taotie over the brow, a studded brow band, an ear
// disc, a neck guard of plates with a studded edge, a tube at the crown for the plume.
const shangHelm = (plume, o = {}) => (g) => {
  const col = o.col || CP.bronze, ng = o.neck || CP.lac, np = o.neckPlate || CP.bone;
  g.body([[-6, -10], [-10.6, -6], [-11, 1.6], [-5, 3.4], [-2.4, -2], [-2.6, -8]], ng, ln(OUT));                    // the neck guard
  plates(g, -12, -2, -8.6, 0.8, 3.2, 3.2, np); border(g, -12, -2, 0.2, 3.6, { col: o.band || CP.lac, stud: col });
  g.body([[-8, -5.5], [-8.8, -14], [-6.5, -21.5], [-0.5, -24.5], [5.8, -22.5], [9.2, -16.5], [9.8, -13.4, 1], [3.8, -12.6], [1.5, -9.6], [0.6, -5], [-3.5, -2.8], [-8, -3]], col, ln(OUT));
  g.tint([[-8.6, -14.4], [9.8, -15.2], [9.8, -12.6], [-8.6, -11.6]], o.band || CP.lac); for (let x = -6.4; x < 9; x += 2.3) g.tint(circ(x, -13.4 - x * 0.04, 0.6, 6), col);   // the brow band, studded
  g.tint([[2.6, -19.6], [5, -21], [8.4, -18.6], [9, -16], [5.6, -16.6], [3, -15.6]], CP.lac); g.tint(circ(5.8, -17.7, 0.9, 6), col);   // the taotie's eye
  g.cut((k) => { fret(k, -3, -18.5, 2.4, 1.5, 1, 0.6, 0); });
  g.body(circ(-3.4, -8.6, 2.4, 10), col, ln(0.9)); g.tint(circ(-3.4, -8.6, 1.4, 8), CP.bronzeDeep); g.tint(circ(-3.4, -8.6, 0.6, 6), col);   // the ear disc
  if (o.wings) { g.body([[-6.5, -15], [-12, -19], [-17, -27], [-19.5, -36, 1], [-14, -29], [-9.6, -25], [-5.6, -20]], col, ln(1)); g.ink([[-7, -17], [-16, -30]], 0.5, CP.bronzeDeep); g.ink([[-6.5, -19.5], [-12.5, -26]], 0.45, CP.bronzeDeep);
    g.body([[6.5, -19], [9.5, -24], [11, -31, 1], [8.5, -26], [5, -22]], col, ln(0.9)); }
  if (o.horns) for (const [x, d] of [[-1, -1], [3.5, 1]]) g.body([[x - 1.3, -22.5], [x + d * 3, -29], [x + d * 7.5, -31, 1], [x + d * 4, -27], [x + 1.8, -22]], col, ln(0.9));
  g.strip([[-0.2, -24], [-0.9, -29]], 2.4, col); g.tint(circ(-0.5, -26, 0.5, 5), CP.ink);                        // the plume tube
  if (plume) plume(g);
};
// plumes: a tuft of black horsehair; a white yak tail; a great plume of white horsehair for the palace
const tuft = (col = CP.lac) => (g) => { g.body([[-1, -28], [-5, -34.5], [-12.5, -35.5, 1], [-8.5, -31.5], [-15.5, -28.5, 1], [-8, -27.4], [-12, -23, 1], [-3.4, -25.6]], col, ln(0.9)); g.ink([[-3, -29], [-11, -33]], 0.35, CP.grey); };
const yak = (col = CP.silk, L = 1) => (g) => { g.body([[-0.6, -28.5], [-4, -38 * L], [-13, -46 * L], [-24, -47 * L, 1], [-16, -41 * L], [-24, -37 * L, 1], [-13, -33 * L], [-20, -27 * L, 1], [-6, -27]], col, ln(0.9)); for (const [a, b] of [[[-3, -31], [-12, -40 * L]], [[-4, -29], [-15, -34 * L]], [[-2, -33], [-9, -43 * L]]]) g.ink([a, b], 0.4, CP.grey); };
const greatPlume = (g) => {                                                                                          // a gilt finial, and a long white horsehair plume falling back from it (as the reference's red one)
  g.strip([[-0.5, -28], [-0.6, -38]], 1.8, CP.gilt); g.body(circ(-0.6, -39.5, 2, 8), CP.gilt, ln(0.7));
  g.body([[-0.4, -31], [-6, -35], [-13, -33.5], [-19, -27], [-22, -16], [-21, -6, 1], [-18, -13], [-16.5, -4, 1], [-14.4, -14], [-11, -7, 1], [-10.4, -18], [-6.4, -25], [-1, -28]], CP.silk, ln(1.1));
  for (const [a2, b2] of [[[-3, -31], [-18, -20]], [[-5, -30], [-15, -16]], [[-6, -28], [-11, -14]]]) g.ink([a2, b2], 0.4, CP.grey);
  g.body([[-3, -26.5], [3, -26.5], [2.4, -32], [-2.4, -32]], CP.gilt, ln(0.7)); g.tint(R(-3, -30, 3, -28.6), CP.lac);
};
const egrets = greatPlume;

// the Zhou heads: a cloth cap (幘) with a red band and knot; a bronze helm with a crest of red; a gilt helm with two pheasant plumes
const zhouTopknot = (g) => {
  g.body([[-7.6, -6], [-8, -14], [-5.5, -19.2], [1, -20.6], [6.5, -18.6], [8.8, -14.6], [4.4, -15.4], [1.2, -12], [-1, -6.5], [-4.6, -3.6]], CP.nong, ln(OUT));   // the hair
  g.ink([[-3, -18], [-6, -8]], 0.35, CP.grey); g.ink([[0, -19], [-2.6, -10]], 0.35, CP.grey);
  g.body([[-4.4, -18.5], [-4, -26], [1.6, -27.4], [4.2, -22], [2.8, -18.8]], CP.nong, ln(1));                                                       // the knot, in a cloth
  g.tint(R(-7, -22.4, 7, -19.6), CP.red); for (let x = -5; x < 5; x += 2.4) g.tint(circ(x, -21, 0.55, 5), CP.bronze);
  g.body([[-4.2, -21], [-11, -22], [-17, -17.5, 1], [-10, -18.4], [-14, -13, 1], [-6, -18.4]], CP.red, ln(0.8));                                   // the band's ends, flying
};
const zhouHelm = (rank) => (g) => {
  const gilt = rank >= 5, col = gilt ? CP.gilt : CP.bronze;
  g.body([[-6, -10], [-10.6, -6], [-11, 1.6], [-5, 3.4], [-2.4, -2], [-2.6, -8]], CP.zground, ln(OUT));           // the neck guard: red plates, a studded edge
  plates(g, -12, -2, -8.6, 0.8, 3.2, 3.2, gilt ? CP.gilt : CP.red); border(g, -12, -2, 0.2, 3.6, { col: CP.lac, stud: col });
  g.body([[-8, -6], [-8.8, -14.5], [-6.2, -21.6], [0, -24], [6, -22], [9.2, -16.2], [9.8, -13.4, 1], [4, -13.2], [1.6, -10], [0, -6], [-4, -3.6]], col, ln(OUT));
  g.strip([[-6, -21.6], [-0.5, -23.8], [5.8, -21.4]], 1.6, CP.redDeep);                                                         // a ridge, lacquered red
  g.tint([[-8.6, -14.8], [9.8, -15.4], [9.8, -12.8], [-8.6, -12]], CP.red); for (let x = -6.4; x < 9; x += 2.3) g.tint(circ(x, -13.6, 0.6, 6), col);
  g.body(circ(-3.4, -8.6, 2.4, 10), col, ln(0.9)); g.tint(circ(-3.4, -8.6, 1.4, 8), CP.redDeep); g.tint(circ(-3.4, -8.6, 0.6, 6), col);
  if (rank === 3) g.body([[-0.5, -23.6], [-3, -31], [-9, -37], [-19, -38, 1], [-13, -33], [-20, -29.5, 1], [-9.5, -27.5], [-4.2, -22.8]], CP.red, ln(1));   // a swept crest of red horsehair
  if (rank >= 5) {
    for (const [dx, a, L] of [[-1, -1.1, 62], [1.5, -0.86, 70]]) { const ex = dx + Math.cos(a) * L * -0.55, ey = -24 + Math.sin(a) * L;   // two long pheasant plumes, arcing back
      g.body([[dx - 1.4, -23], [dx - L * 0.16, ey * 0.56 - 8], [ex - 6, ey + 6], [ex - 14, ey + 18, 1], [ex - 3, ey + 9], [dx - L * 0.11, ey * 0.56 - 5], [dx + 1.4, -23]], CP.ochre, ln(0.9));
      g.ink([[dx, -24], [dx - L * 0.15, ey * 0.56 - 6.5], [ex - 5, ey + 7]], 0.5, CP.nong);
      for (let i = 1; i < 6; i++) { const q = i / 6, x = dx + (ex - 8 - dx) * q, y = -24 + (ey + 10 + 24) * q - Math.sin(q * Math.PI) * 6; g.ink([[x - 1.5, y - 1.2], [x + 1.5, y + 1.2]], 0.7, CP.nong); } }
    g.tint([[1.6, -19.6], [5, -21.2], [8.6, -17.8], [9, -15.6], [5.6, -16.2], [2.8, -15.6]], CP.red);
  }
};

// ------------------------------------------------------------------ Shang weapons
// The Shang 戈: a straight blade (援) on a short tang (内), no lower edge; the tang cast with a taotie; a butt-cap; a white tassel.
const shangGe = (len = 66, o = {}) => (g) => {
  g.strip([[-30, 0], [len, 0]], 3, CP.lac);
  for (const x of [-12, 14, len - 18]) g.strip([[x, 0], [x + 3, 0]], 3.6, CP.bronze);                                         // bronze bands on the haft
  g.body([[-30, -2.2, 1], [-35, -1.4], [-37, 0, 1], [-35, 1.4], [-30, 2.2, 1]], CP.bronze, ln(0.5));                          // 鐏
  const x = len - 4, L = o.big ? 36 : 32;
  g.body([[x - 5.5, -1.8, 1], [x + 5.5, -1.8, 1], [x + 5.5, 3.2, 1], [x - 5.5, 3.2, 1]], CP.bronze, ln(0.6));                    // 阑: the stop along the haft
  g.body([[x - 3.8, 3], [x + 3.6, 3], [x + 4, L * 0.5], [x + 5, L * 0.86], [x + 3.4, L + 4, 1], [x - 0.6, L * 0.82], [x - 3.4, L * 0.46]], CP.bronze, ln(0.9));   // 援: a dagger blade, its point lifting
  g.ink([[x + 0.1, 4], [x + 1.4, L * 0.92]], 0.5, CP.bronzeDeep);                                                             // the spine
  g.body([[x - 3, -1.8, 1], [x + 3, -1.8, 1], [x + 3.4, -11], [x, -13, 1], [x - 3, -10.6]], CP.bronze, ln(0.7));                 // 内, cast with an eye
  g.cut((k) => { ring(k, x + 0.2, -7.4, 1.6, 0.55); dot(k, x + 0.2, -7.4, 0.6); });
  g.strip([[len - 1, 0], [len + 3, 0]], 3.4, CP.bronze);
  g.body([[x - 8, -1.6], [x - 13, -6], [x - 24, -9, 1], [x - 16, -4], [x - 26, -3, 1], [x - 12, 0]], o.tassel || CP.silk, ln(0.6));   // a streamer, behind
};
// a Shang knife: curved blade, a ring at the pommel cast as a beast's head
const shangKnife = (g) => {
  g.body([[-6, -1.6], [2, -2], [24, -3.5], [38, -6.5], [44, -9.5, 1], [40, -3], [26, 2.4], [2, 2]], CP.bronze, ln(0.8));
  g.ink([[4, -0.3], [36, -5.2]], 0.45, CP.bronzeDeep);
  g.body(circ(-8.5, 0, 3.4, 10), CP.bronze, ln(0.6)); g.cut((k) => dot(k, -8.5, 0, 1.6));
  g.strip([[-4, 0], [2, 0]], 3.6, CP.lac);
};
// the Shang shield (干): tall, lacquered, painted with a taotie in bone; bronze rim
const shangShield = (k = 1) => (g) => {
  const W = 15 * k, H = 28 * k;
  g.body([[-W, -H, 1], [W, -H, 1], [W - 2 * k, 0], [W, H, 1], [-W, H, 1], [-W + 2 * k, 0]], CP.lac, ln(1.1));
  taotie(g, 0, -2 * k, 1.25 * k, CP.bone, CP.lac);
  g.strip([[-W + 1.6, -H + 1.6, 1], [W - 1.6, -H + 1.6, 1], [W - 3.4, 0, 1], [W - 1.6, H - 1.6, 1], [-W + 1.6, H - 1.6, 1], [-W + 3.4, 0, 1], [-W + 1.6, -H + 1.6, 1]], 1.1, CP.bronze);
  g.tint(R(-W, H - 7 * k, W, H - 4.4 * k), CP.bone); fretRow(g, -W + 2, W - 2, H - 5.7 * k, 1.1, 0.5);
};
// the Shang bow: a long recurve, black lacquer, bone bindings, bronze tips; at rest and drawn
const shangBow = (drawn) => (g) => {
  const pts = drawn ? [[-25, -50], [-15, -47], [-5, -36], [6, -17], [9, 0], [6, 17], [-5, 36], [-15, 47], [-25, 50]] : [[-13, -55], [-5, -48], [3, -36], [8.6, -16], [9.6, 0], [8.6, 16], [3, 36], [-5, 48], [-13, 55]];
  g.strip(pts, 4.4, CP.lac);
  for (const i of [2, 4, 6]) { const [x, y] = pts[i]; g.strip([[x - 1.4, y - 1.8], [x + 1.4, y + 1.8]], 5.6, CP.bone); }
  for (const i of [0, 8]) { const [x, y] = pts[i]; g.body(circ(x, y, 2.3, 7), CP.bronze, ln(0.5)); }
  if (drawn) { g.ink([[-25, -50], [-46, 0], [-25, 50]], 0.8); g.strip([[-46, 0], [34, 0]], 2.2, CP.ochre); g.body([[32, -3.4, 1], [44, 0, 1], [32, 3.4, 1]], CP.bronze, ln(0.6));
    g.body([[-46, -1.5], [-38, -4.5, 1], [-36, -1], [-36, 1], [-38, 4.5, 1], [-46, 1.5]], CP.silk, ln(0.5)); }
  else g.ink([[-13, -55], [-13, 55]], 0.8);
};
// the Ya Chou (亚丑) axe of the guard: a broad blade, a grinning face cut through it, teeth, a lacquered and gilded haft, a yak tail
const guardYue = (g) => {
  g.strip([[-34, 0], [70, 0]], 3.4, CP.lac);
  for (const x of [-22, -4, 30]) g.strip([[x, 0], [x + 4, 0]], 4, CP.gilt);
  g.body([[46, -1.5, 1], [64, -1.5, 1], [63, -8, 1], [47, -8, 1]], CP.bronze, ln(0.6));                                       // the tang behind the haft
  g.body([[45, 1.5, 1], [65, 1.5, 1], [68, 12], [78, 38, 1], [57, 45], [34, 38, 1], [43, 12]], CP.bronze, ln(1.1));       // the blade, flaring, seated on the haft
  g.ink([[35, 38.5], [57, 44.4], [77, 38.5]], 0.7, CP.bronzeDeep);                                                           // the edge
  // the grinning face, cut through: its brow toward the blade's top (+x), eyes either side of the nose
  g.cut((k) => { for (const y of [15, 29]) { k.beginPath(); k.ellipse(61, y, 2.6, 4, 0, 0, Math.PI * 2); k.fill(); }
    k.beginPath(); k.moveTo(50, 11); k.quadraticCurveTo(43, 22, 50, 33); k.quadraticCurveTo(46.5, 22, 50, 11); k.fill();
    for (const y of [16, 20, 24, 28]) { k.beginPath(); k.rect(45.6, y, 2.4, 1.8); k.fill(); } });
  g.ink([[67, 22], [55, 22], [53.4, 19.6], [53.4, 24.4]], 0.7, CP.bronzeDeep);                                                 // the nose
  g.ink([[66.5, 11], [66.5, 33]], 0.6, CP.bronzeDeep);                                                                         // the brow
  g.body([[70, -2], [76, -3], [78, 0], [76, 3], [70, 2]], CP.gilt, ln(0.5));
  g.body([[70, -2], [64, -8], [50, -14, 1], [60, -6], [46, -6, 1], [62, -1]], CP.silk, ln(0.7));
};

// 金瓜: the gold-melon mace of the palace (「用金瓜擊頂」, ch. 6; 「左邊鉞斧右金瓜」, ch. 20): a ribbed gilt melon on a lacquered staff
const goldMelon = (g) => {
  g.strip([[-30, 0], [70, 0]], 3.2, CP.lac);
  for (const x of [-20, 0, 24, 48]) g.strip([[x, 0], [x + 4, 0]], 3.8, CP.gilt);
  g.body([[-30, -2.4, 1], [-36, 0, 1], [-30, 2.4, 1]], CP.gilt, ln(0.5));
  g.body([[67, -4.6], [74, -6], [74, 6], [67, 4.6]], CP.gilt, ln(0.6));                                                          // the collar
  g.body([[70, -4], [72, -9], [76, -5], [79, -10], [80, -4]], CP.jade, ln(0.5)); g.body([[70, 4], [72, 9], [76, 5], [79, 10], [80, 4]], CP.jade, ln(0.5));   // calyx leaves
  g.body(circ(86, 0, 12, 18, 10), CP.gilt, ln(1.1));                                                                             // the melon
  for (const y of [-6.5, -2.2, 2.2, 6.5]) g.ink([[75, y * 0.6], [80, y * 1.15], [86, y * 1.3], [92, y * 1.15], [97.5, y * 0.6]], 0.55, CP.bronzeDeep);   // its ribs
  g.tint([[78, -6], [86, -8.5], [93, -6], [86, -4.6]], '#E2C47A', 0.8);                                                         // the light on it
  g.body([[97, -1.6], [101.5, -2.4], [102.5, 0], [101.5, 2.4], [97, 1.6]], CP.gilt, ln(0.5));                                    // the stalk
  g.body([[64, 2], [58, 8], [52, 24, 1], [58, 15], [59, 27, 1], [62, 9]], CP.silk, ln(0.6));                                     // a white tassel
};
// the Zhou long spear (矛, 「短劍長矛次第先」 ch. 53): a leaf blade on a socket, a red tassel, a bronze butt
const zhouMao = (rank) => (g) => {
  const len = rank === 1 ? 80 : rank === 3 ? 90 : 98, gilt = rank >= 5, col = gilt ? CP.gilt : CP.bronze, k = rank === 5 ? 1.25 : 1;
  g.strip([[-36, 0], [len, 0]], rank === 1 ? 2.4 : 2.8, rank === 1 ? CP.leather : CP.redDeep);
  if (rank >= 3) for (const x of [-20, 14, len - 30]) g.strip([[x, 0], [x + 3, 0]], 3.6, col);
  g.body([[-36, -1.8, 1], [-42, 0, 1], [-36, 1.8, 1]], col, ln(0.5));                                                           // 镦
  g.body([[len - 3, -2.4], [len + 6, -2], [len + 6, 2], [len - 3, 2.4]], col, ln(0.6));                                          // the socket
  g.body([[len + 5, -2], [len + 12, -5.6 * k], [len + 22 * k, -3.6 * k], [len + 32 * k, 0, 1], [len + 22 * k, 3.6 * k], [len + 12, 5.6 * k], [len + 5, 2]], col, ln(0.9));   // the leaf blade
  g.ink([[len + 6, 0], [len + 30 * k, 0]], 0.5, CP.bronzeDeep);
  if (rank >= 3) g.cut((k2) => { slit(k2, len + 10, -2.6 * k, len + 20 * k, -1.8 * k, 0.7); slit(k2, len + 10, 2.6 * k, len + 20 * k, 1.8 * k, 0.7); });   // blood grooves
  const T = rank === 1 ? 0.7 : rank === 3 ? 1 : 1.3;
  g.body([[len - 2, 1.5], [len - 6, 7 * T], [len - 12, 18 * T, 1], [len - 5, 11 * T], [len - 3, 20 * T, 1], [len + 1, 8 * T], [len + 2, 2]], CP.red, ln(0.7));   // the tassel
  if (gilt) g.tint([[len - 5, 8], [len + 1, 8], [len + 1, 13], [len - 5, 13]], CP.gilt);
};
// ------------------------------------------------------------------ Shang kinds
const SHANG = { robe: CP.silk, robeFar: CP.boneFar, diaper: '#D6CDBC', shade: '#E2D9C7', border: { col: CP.lac, stud: CP.bone }, beard: CP.lac, shin: CP.bone };
const shangPlate = (plate, farP, stud = CP.bronze, band = CP.lac) => ({ ground: CP.lac, plate, plateFar: farP, stud, band });

export function shangGeMan(elite = false) {
  const d = body({ ...SHANG, apron: CP.lac, apronTrim: CP.bronze, apronStud: CP.bone, sash: { col: CP.silk, tip: CP.lac, knot: CP.lac },
    plate: shangPlate(CP.bone, CP.boneFar), pauldronPlate: elite ? CP.bronze : null, tassetPlate: elite ? CP.bronze : null,
    armour: elite ? (g) => { g.body([[-1.5, -38], [8, -38.4], [12.4, -32], [13.4, -22], [11.6, -12.4], [0.4, -12], [-3.4, -24]], CP.bronze, ln(1.2)); border(g, -4, 14, -15, -12, { col: CP.lac, stud: CP.bone }); whorl(g, 6.2, -25, 5.4); } : null,
    helm: shangHelm(elite ? yak(CP.silk, 1.08) : tuft(), { horns: elite, neckPlate: elite ? CP.bronze : CP.bone }) });
  d.parts.push(P('w', 'al', [0, 13.4], 24, shangGe(elite ? 74 : 66, { big: elite }), 0, true));
  if (elite) d.parts.push(P('flag', 't', [-8, -36], 3, (g) => {                                                                // a back banner: white, a black clan sign 亚, a fringe of tongues
    g.strip([[0, 8], [0, -64]], 2, CP.lac); g.body([[-1, -66], [1.6, -71, 1], [3.4, -66]], CP.bronze, ln(0.5));
    g.body([[-1, -62, 1], [-24, -62, 1], [-24, -30, 1], [-1, -30, 1]], CP.silk, ln(0.9));
    g.tint([[-19, -57, 1], [-14.5, -57, 1], [-14.5, -54, 1], [-10.5, -54, 1], [-10.5, -57, 1], [-6, -57, 1], [-6, -52.5, 1], [-9, -52.5, 1], [-9, -39.5, 1], [-6, -39.5, 1], [-6, -35, 1], [-10.5, -35, 1], [-10.5, -38, 1], [-14.5, -38, 1], [-14.5, -35, 1], [-19, -35, 1], [-19, -39.5, 1], [-16, -39.5, 1], [-16, -52.5, 1], [-19, -52.5, 1]], CP.lac);
    for (let i = 0; i < 4; i++) { const x = -3.5 - i * 6; g.body([[x + 2.4, -30], [x - 2.4, -30], [x - 1, -22, 1], [x, -24], [x + 1, -22, 1]], CP.lac, ln(0.5)); }
  }, -8));
  return d;
}
export function shangShieldMan() {
  const d = body({ ...SHANG, apron: CP.lac, apronTrim: CP.bone, apronStud: CP.bronze, bracer: CP.bronze, sash: { col: CP.lac, tip: CP.silk },
    jerkin: { ground: CP.lac, stud: CP.bronze, band: CP.bone },                                                              // a coat of hide set with bronze bosses
    helm: shangHelm((g) => g.body([[-0.8, -28.5], [-2.5, -35], [-1, -40, 1], [0.8, -35], [0.6, -28.5]], CP.silk, ln(0.8))) });
  d.parts.push(P('s', 'al', [0, 12.4], 30, shangShield(1.05), 0, true));
  d.parts.push(P('w', 'bl', [0, 13.4], 4, shangKnife, 0, true));
  return d;
}
export function shangArcher() {
  const d = body({ ...SHANG, beard: null, hem: CP.lac, bracer: CP.leather, sash: { col: CP.lac, tip: CP.silk },
    armour: (g) => g.ink([[-6, -38], [10.6, -9]], 1.8, CP.leather),                                                          // the quiver strap
    helm: (g) => { g.body([[-7.6, -5], [-8.6, -13.6], [-6.2, -20.4], [0, -22.6], [6.6, -20.6], [9.4, -15.4], [4, -14.6], [1.4, -10.6], [0, -5.5], [-3.6, -3.4]], CP.lac, ln(OUT));   // a leather cap,
      border(g, -9, 10, -15.6, -12.8, { col: CP.bone, stud: CP.lac });                                                        // banded in bone, studded
      g.body([[-3, -21.6], [-8, -31], [-16, -40, 1], [-9, -33.5], [-4.5, -28], [0.6, -21.6]], CP.silk, ln(0.8)); g.ink([[-1.5, -22], [-14.5, -38.5]], 0.4, CP.grey); } });
  d.parts.push(P('q', 't', [-10, -31], 3, (g) => {                                                                                  // the quiver: lacquer, bronze bands, white fletchings
    g.body([[-5, -5, 1], [5, -5, 1], [4.4, 28, 1], [-4.4, 28, 1]], CP.lac, ln(0.8)); for (const y of [-1, 10, 22]) g.tint(R(-6, y, 6, y + 2), CP.bronze);
    for (const [x, top] of [[-3, -16], [0, -19], [3, -15]]) { g.strip([[x, -5], [x, top + 4]], 1.4, CP.ochre); g.body([[x - 1.8, top + 7], [x - 1.8, top + 1], [x, top - 1.5, 1], [x + 1.8, top + 1], [x + 1.8, top + 7]], CP.silk, ln(0.5)); }
  }, -14));
  d.parts.push(P('w', 'bl', [0, 13.4], 4, shangBow(false), 0, true), P('wd', 'bl', [0, 13.4], 4.1, shangBow(true), 0, true));
  return d;
}
// the shaman (巫): a white robe to the ankle with a broad black border, a bronze mask with great eyes, antlers bound with
// white ribbons, a jade disc (璧) on the breast; a staff with a bronze sun and bells; a hand drum
export function shangShaman() {
  const d = body({ ...SHANG, long: true, hem: CP.lac,
    lower: (g, L) => { g.tint([[5, -4], [12, -4], [17.5, L - 6], [8, L - 6]], CP.lac); g.cut((k) => { for (let y = 2; y < L - 9; y += 6) fret(k, 10.6 + y * 0.12, y, 2, 1.5, y % 12 ? 1 : -1, 0.55, 0); }); },
    armour: (g) => { g.tint(R(-14, -39, -6.8, -3), CP.lac); g.cut((k) => { for (let y = -35; y < -6; y += 5.6) fret(k, -10.2, y, 1.8, 1.5, 1, 0.5, 0); }); },
    chest: (g) => { g.body(circ(5, -22, 5.2, 14), CP.jade, ln(0.7)); g.cut((k) => dot(k, 5, -22, 1.9)); g.ink([[1, -38], [5, -27]], 0.5); g.ink([[9, -37], [5, -27]], 0.5); },
    helm: (g) => {
      for (const d2 of [-1, 1]) { const x = d2 < 0 ? -3 : 3;                                                                    // antlers
        g.body([[x - 1, -16], [x + d2 * 3, -30], [x + d2 * 12, -42], [x + d2 * 9, -47, 1], [x + d2 * 15, -46, 1], [x + d2 * 14, -40], [x + d2 * 20, -42, 1], [x + d2 * 17, -36], [x + d2 * 7, -28], [x + d2 * 4, -16]], CP.bronze, ln(0.8)); }
      g.body([[-2.6, -26], [-10, -24], [-16, -16, 1], [-11, -19], [-13, -10, 1], [-7, -20], [-1, -22]], CP.silk, ln(0.6));         // ribbons
      g.body([[-7, -4], [-8, -15], [-4, -21], [5, -21.5], [10.5, -16], [11.2, -8], [9, -2], [3, 1.6], [-3, 0.8]], CP.bronze, ln(0.95));   // the mask
      g.tint([[3.2, -15], [6.8, -17.2], [10.8, -14], [7, -11.2]], CP.silk); g.tint(circ(7, -14.2, 1.3, 8), CP.lac);              // a great eye
      g.ink([[2, -18.6], [9.6, -19.4]], 0.8, CP.lac); g.tint([[4, -6], [10.6, -6.4], [9.6, -3.4], [4.4, -3]], CP.lac);             // brow, mouth
      g.cut((k) => { for (const x of [5.4, 7.2, 9]) { k.beginPath(); k.rect(x, -5.8, 0.9, 1.6); k.fill(); } fret(k, -3, -12, 2.4, 1.5, 1, 0.55, 0); });
    } });
  d.parts.push(P('w', 'al', [0, 13.4], 24, (g) => {                                                                                // the staff: a bronze sun with rays, bells, a white streamer
    g.strip([[-44, 0], [70, 0]], 2.8, CP.lac);
    const sun = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 9.5 : 14; sun.push([78 + Math.cos(a) * r, Math.sin(a) * r]); }
    g.body(sun, CP.bronze, ln(0.9)); g.cut((k) => { ring(k, 78, 0, 6, 1.4); dot(k, 78, 0, 2.2); });
    for (const x of [48, 40]) { g.ink([[x, 1], [x, 5]], 0.6); g.body([[x - 2.6, 5, 1], [x + 2.6, 5, 1], [x + 3.4, 12.5], [x, 14.5, 1], [x - 3.4, 12.5]], CP.bronze, ln(0.6)); }
    g.body([[56, 2], [50, 14], [54, 34, 1], [57, 18], [62, 30, 1], [60, 12]], CP.silk, ln(0.6));
  }, 0, true));
  d.parts.push(P('drum', 'bl', [0, 14.6], 4.5, (g) => {                                                                            // the hand drum: hide stretched on a ring, a painted eye
    g.body(circ(0, 0, 12.5, 16), CP.bone, ln(1.1)); g.strip(circ(0, 0, 11.4, 16).concat([circ(0, 0, 11.4, 16)[0]]), 1.4, CP.lac);
    g.tint(circ(0, 0, 4.6, 10), CP.lac); g.tint(circ(0.6, -0.4, 1.6, 8), CP.bone); g.strip([[0, 12], [0, 22]], 2.4, CP.lac);
  }, 0, true));
  return d;
}
// the palace guard of 纣王 (殿前禁军): taller; a gilt scale coat over a white silk robe bordered in gold and black; a black
// cape edged in gilt; a gilt helm with a taotie and three egret plumes; jade pendants at the belt; the great Ya Chou axe
export function shangGuard() {
  const d = body({ ...SHANG, diaper: '#CDAE6A', border: { col: CP.lac, stud: CP.gilt }, hem: CP.lac, apron: CP.gilt, apronTrim: CP.lac, apronStud: CP.gilt, belt: CP.zhe, beltStud: CP.gilt,
    sash: { col: CP.silk, tip: CP.gilt, knot: CP.gilt }, plate: shangPlate(CP.gilt, CP.zhe, CP.gilt, CP.zhe), greaves: true, longTassets: true,
    lower: (g, L) => border(g, -22, 22, L - 10, L - 6, { col: CP.gilt, stud: CP.lac }),
    armour: (g) => whorl(g, 4.6, -23.5, 6.4, CP.gilt, CP.zhe),
    shoulder: (g, near) => { taotie(g, 0.4, -1.2, 0.42, CP.lac, CP.gilt); },                                                // a mask on each pauldron
    chest: (g) => { for (const [x, y, r] of [[12.6, 2, 2.6], [13.2, 7.6, 2.2], [12.4, 12.6, 2.6]]) { g.body(circ(x, y, r, 10), CP.jade, ln(0.6)); g.cut((k) => dot(k, x, y, r * 0.36)); } g.ink([[12.8, -1], [12.4, 10]], 0.5, CP.lac); },
    helm: shangHelm(greatPlume, { col: CP.gilt, wings: true, neckPlate: CP.gilt, band: CP.zhe }) });
  d.parts.push(P('cape', 't', [-7, -37], 2, (g) => {                                                                               // the cape: lacquer black, a studded gilt border, a band of spirals
    g.body([[2, -2], [-6, -3], [-14, 6], [-20, 26], [-24, 46, 1], [-13, 43], [-4, 47, 1], [2, 24], [6, 4]], CP.lac, ln(OUT));
    g.ink([[-6, 2], [-15, 40]], 0.5, CP.grey); g.ink([[-1, 4], [-6, 42]], 0.5, CP.grey);
    border(g, -26, 6, 37, 41, { col: CP.gilt, stud: CP.lac }); border(g, -26, 6, 41, 48, { col: CP.lac, fret: true });
  }, -4));
  d.parts.push(P('w', 'al', [0, 13.4], 24, goldMelon, 0, true));
  return d;
}

// ------------------------------------------------------------------ the Shang chariot
// The Anyang chariot: a small box of lacquer on a wide wheel of many spokes, bronze axle caps (軎) and linchpins, the
// draught pole curving up to the yoke, a tall white banner with a black clan sign. Two white horses (戎事乘翰), black-maned.
export function shangCar() {
  const Rw = 34, NS = 18;
  return { parts: [
    P('box', null, [0, 0], 10, (g) => {
      g.strip([[34, -14], [110, -18], [160, -34], [176, -46]], 3.6, CP.lac);                                                    // the pole, curving up
      g.body([[166, -52, 1], [182, -52, 1], [184, -42], [174, -38], [164, -42]], CP.bronze, ln(0.8));                                 // the yoke saddle
      g.body([[-44, -50, 1], [42, -54, 1], [48, -46], [46, -8, 1], [-46, -8, 1]], CP.lac, ln(1.1));                                   // the box
      g.tint([[-44, -38, 1], [46, -41, 1], [46, -20, 1], [-44, -20, 1]], CP.bone);                                                  // a painted panel...
      taotie(g, -18, -29.5, 0.82, CP.lac, CP.bone); taotie(g, 18, -30.5, 0.82, CP.lac, CP.bone);                                     // ...two taotie on it
      g.tint([[-48, -46, 1], [50, -49.4, 1], [50, -42.6, 1], [-48, -40.6, 1]], CP.bronze); g.cut((k) => { for (let x = -40; x < 44; x += 8) dot(k, x, -43.8 - (x + 44) * 0.035, 1.1); });
      g.tint(R(-48, -16, 50, -8), CP.bronze); fretRow(g, -42, 44, -12, 1.6, 0.6);
      g.strip([[-40, -50], [-46, -176]], 2.4, CP.lac); g.body([[-48, -180], [-45, -190, 1], [-42, -180]], CP.bronze, ln(0.6));        // the banner pole
      g.body([[-46, -176, 1], [-96, -170], [-104, -152, 1], [-92, -146], [-100, -130, 1], [-46, -134, 1]], CP.silk, ln(1));            // the banner
      g.tint([[-58, -168, 1], [-52, -168, 1], [-52, -163, 1], [-58, -163, 1]], CP.lac);
      g.tint([[-84, -167, 1], [-78, -167, 1], [-78, -162, 1], [-74, -162, 1], [-74, -148, 1], [-78, -148, 1], [-78, -143, 1], [-84, -143, 1], [-84, -148, 1], [-88, -148, 1], [-88, -162, 1], [-84, -162, 1]], CP.lac);   // 亚
      g.ink([[-60, -150], [-66, -158], [-60, -164]], 0.9, CP.lac);
    }),
    P('wheel', 'box', [-2, 0], 12, (g) => {
      const ring2 = circ(0, 0, Rw, 28); g.strip([...ring2, ring2[0]], 5, CP.lac); g.strip([...circ(0, 0, Rw - 3.6, 28), circ(0, 0, Rw - 3.6, 28)[0]], 0.8, CP.bronze);
      for (let q = 0; q < NS; q++) { const a = (q / NS) * Math.PI * 2; g.strip([[Math.cos(a) * 6, Math.sin(a) * 6], [Math.cos(a) * (Rw - 2), Math.sin(a) * (Rw - 2)]], 1.3, CP.lac); }
      g.body(circ(0, 0, 7, 12), CP.bronze, ln(0.8)); g.cut((k) => { ring(k, 0, 0, 4.2, 0.9); dot(k, 0, 0, 1.6); });                      // the nave and its 軎
    }),
  ], feet: [{ id: 'box', pt: [-2, Rw] }] };
}

// ------------------------------------------------------------------ Zhou squads, 尚赤, ranks 1 3 5
// 1 卒: a red cloth tunic, a bare topknot bound in red, a plain weapon. 3 甲士: a bronze helm with a red crest, red-lacquered
// lamellar with bronze bosses, wide shoulder plates, an apron. 5 神兵: gilt helm with two pheasant plumes, gilt lamellar, a
// celestial sash in an arc over the head, a cloud underfoot. The Zhou 戈 has the long lower edge (胡) the Shang one lacks.
const zhouGe = (rank) => (g) => {
  const len = rank === 1 ? 60 : rank === 3 ? 70 : 78, gilt = rank >= 5, col = gilt ? CP.gilt : CP.bronze;
  g.strip([[-30, 0], [len, 0]], rank === 1 ? 2.6 : 3, rank === 1 ? CP.leather : CP.redDeep);
  if (rank >= 3) for (const x of [-16, 10, len - 22]) g.strip([[x, 0], [x + 3, 0]], 3.8, col);
  const x = len - 6;
  g.body([[x - 3.4, -2.8, 1], [x + 3.4, -2.8, 1], [x + 4, 6], [x + 5, 22], [x + 3, 34], [x - 0.6, 40, 1], [x - 2.4, 30], [x - 3.2, 18], [x - 4, 11], [x - 20, 9.5, 1], [x - 22, 5.5, 1], [x - 4, 3]], col, ln(0.9));   // 援 and 胡
  g.cut((k) => { for (const xx of [x - 8, x - 13, x - 18]) { k.beginPath(); k.rect(xx, 6.4, 1.6, 2.2); k.fill(); } });               // the lashing holes (穿)
  g.body([[x - 3, -2.8, 1], [x + 3, -2.8, 1], [x + 2, -11, 1], [x - 3, -11, 1]], col, ln(0.6));
  if (rank >= 3) g.body([[x - 6, 2], [x - 12, 6], [x - 16, 22, 1], [x - 10, 14], [x - 9, 24, 1], [x - 6, 8]], CP.red, ln(0.7));   // a red tassel
  if (false) { g.body([[x + 4, 22], [x + 12, 18], [x + 20, 6, 1], [x + 14, 20], [x + 22, 22, 1], [x + 10, 28], [x + 3, 34]], CP.red, ln(0.6)); g.body([[x + 5, 24], [x + 11, 22], [x + 8, 28]], CP.gilt, ln(0.4)); }   // a tongue of fire along the edge
};
const zhouSword = (rank) => (g) => {
  const L = rank === 1 ? 26 : rank === 3 ? 34 : 40, col = rank >= 5 ? CP.gilt : CP.bronze;
  g.strip([[-6, 0], [2, 0]], 3.2, CP.leather); g.body([[2, -4, 1], [4, -4, 1], [4, 4, 1], [2, 4, 1]], col, ln(0.5));
  g.body([[4, -2.2], [L, -1.6], [L + 6, 0, 1], [L, 1.6], [4, 2.2]], col, ln(0.8)); g.ink([[5, 0], [L + 2, 0]], 0.45, CP.bronzeDeep);
};
// the Zhou shield: a board of red lacquer, a bronze boss (钖) cast as a face, a border; plain hide at rank 1
const zhouShield = (rank) => (g) => {
  const W = rank === 1 ? 11 : rank === 3 ? 14 : 15.5, H = rank === 1 ? 20 : rank === 3 ? 26 : 29;
  g.body([[-W, -H + 4], [-W + 4, -H, 1], [W - 4, -H, 1], [W, -H + 4], [W - 1.5, 0], [W, H - 4], [W - 4, H, 1], [-W + 4, H, 1], [-W, H - 4], [-W + 1.5, 0]], rank === 1 ? CP.ochre : CP.red, ln(1.1));
  if (rank === 1) { g.ink([[-W + 3, -6], [W - 3, -6]], 0.6, CP.leather); g.ink([[-W + 3, 6], [W - 3, 6]], 0.6, CP.leather); return; }
  g.strip([[-W + 2, -H + 5, 1], [-W + 5, -H + 2, 1], [W - 5, -H + 2, 1], [W - 2, -H + 5, 1], [W - 3.4, 0, 1], [W - 2, H - 5, 1], [W - 5, H - 2, 1], [-W + 5, H - 2, 1], [-W + 2, H - 5, 1], [-W + 3.4, 0, 1], [-W + 2, -H + 5, 1]], 1.2, rank >= 5 ? CP.gilt : CP.lac);
  g.tint(R(-W, -2, W, 2), CP.redDeep); g.cut((k) => { for (let x = -W + 3; x < W - 2; x += 4) { k.beginPath(); k.rect(x, -1, 2, 2); k.fill(); } });
  g.body(circ(0, -10, rank >= 5 ? 7 : 6, 12), rank >= 5 ? CP.gilt : CP.bronze, ln(0.7)); g.tint([[-3.6, -12], [-1, -13.2], [-1, -10.6]], CP.lac); g.tint([[3.6, -12], [1, -13.2], [1, -10.6]], CP.lac);
  g.cut((k) => dot(k, 0, -7.4, 1));
  if (rank >= 5) { g.body(circ(0, 12, 5, 10), CP.gilt, ln(0.6)); g.cut((k) => { fret(k, 0, 12, 2.6, 1.5, 1, 0.6, 0); }); }
};
export function zhouSoldier(kind, rank) {
  const armoured = rank >= 3, gilt = rank >= 5;
  const o = { robe: CP.red, robeFar: CP.redFar, diaper: rank >= 3 ? CP.redDeep : null, shade: CP.redDeep, skin: CP.skin,
    border: rank === 1 ? { col: CP.ochre, stud: CP.redDeep } : gilt ? { col: CP.gilt, stud: CP.red } : { col: CP.lac, stud: CP.bronze },
    hem: null, sash: rank === 1 ? { col: CP.ochre, tip: CP.redDeep } : gilt ? { col: CP.red, tip: CP.gilt, knot: CP.gilt } : { col: CP.ochre, tip: CP.lac, knot: CP.bronze },
    belt: rank === 1 ? CP.leather : CP.lac, beard: rank === 1 ? null : CP.nong,
    leg: rank === 1 ? CP.qing : CP.redDeep, shin: rank === 1 ? CP.qing : CP.lac, wrapCol: rank === 1 ? CP.grey : CP.redDeep, bracer: rank === 1 ? CP.leather : null,
    apron: armoured ? (gilt ? CP.gilt : CP.lac) : null, apronTrim: CP.red, apronStud: CP.bronze,
    plate: armoured ? (gilt ? { ground: CP.redDeep, plate: CP.gilt, plateFar: CP.zhe, stud: CP.red, band: CP.red } : { ground: CP.zground, plate: CP.red, plateFar: CP.redFar, stud: CP.bronze, band: CP.lac }) : null,
    greaves: gilt, armour: gilt ? (g) => whorl(g, 5, -24, 5.2, CP.gilt, CP.redDeep) : null,
    helm: rank === 1 ? zhouTopknot : zhouHelm(rank) };
  const d = body(o);
  if (kind === 'spearmen') d.parts.push(P('w', 'bl', [0, 13.4], 4, zhouMao(rank), 0, true), P('wb', 'bl', [0, 13.4], 4.1, zhouMao(rank), 0, true));
  if (kind === 'spears') d.parts.push(P('w', 'bl', [0, 13.4], 4, zhouGe(rank), 0, true), P('wb', 'bl', [0, 13.4], 4.1, zhouGe(rank), 0, true));
  if (kind === 'shields') { d.parts.push(P('s', 'bl', [0, 12.4], 4, zhouShield(rank), 0, true)); d.parts.push(P('w', 'al', [0, 13.4], 24, zhouSword(rank), 0, true)); }
  if (gilt) d.parts.push(P('sash', 't', [0, -36], 1, (g) => {                                                                       // the celestial sash, in an arc over the head, its ends streaming
    g.body([[-13, 4], [-28, -16], [-26, -44], [-10, -60], [10, -61], [26, -46], [30, -20], [19, 3], [14, 0], [24, -20], [21, -42], [7, -54], [-7, -53], [-20, -40], [-22, -17], [-9, 2]], CP.red, ln(0.9));
    g.tint([[-28, -26], [-23, -46], [-9, -59], [9, -60], [25, -47], [29, -27], [27, -26], [22, -44], [8, -56], [-8, -55], [-21, -43], [-25, -25]], CP.gilt);
    g.body([[-11, 2], [-30, 14], [-42, 38], [-58, 48, 1], [-46, 32], [-52, 24, 1], [-37, 22], [-25, 8]], CP.red, ln(0.9));
  }, 0));
  return d;
}

// ------------------------------------------------------------------ poses and frames
const ZCUT = { shields: 'zhou:shield', spears: 'zhou:cspear', spearmen: 'zhou:cspear' };
// tables cge, cspear: see poses-campaign.js (imported above) './poses-campaign.js';
const DEFS = {
  'c:ge': () => shangGeMan(false), 'c:ge!': () => shangGeMan(true), 'c:shield': shangShieldMan, 'c:archer': shangArcher, 'c:shaman': shangShaman, 'c:guard': shangGuard,
  'c:car': shangCar, 'c:horse': () => horse({ coat: CP.silk, mane: CP.grey }), cloud,
};
for (const k of ['shields', 'spears', 'spearmen']) for (const r of [1, 3, 5]) DEFS[`c:zhou:${k}:${r}`] = () => zhouSoldier(k, r);
// 铁骑 (「鐵騎橫排衝陣將」 ch. 53): a Zhou 长矛手 on a red horse with a white belly (騵: 周人戎事乘騵); gold mane at rank 5
for (const r of [1, 3, 5]) DEFS[`c:zhou:horse:${r}`] = () => horse({ coat: '#A85E3C', mane: r >= 5 ? CP.gilt : CP.lac });

const one = (pup, pose, o = {}) => [{ pup, pose, ...o }];
const WALK6 = Array.from({ length: 6 }, (_, i) => ['walk', 0.3, i / 6]);
const foot = (pup, kind, side, list, extra = {}) => { const st = {}; for (const [name, frames] of Object.entries(list)) st[name] = frames.map((f) => one(pup, footPose(kind, f[0], f[1], f[2] || 0, 0.3, { side }), extra)); return st; };
// the Shang 戈 is swung like the axe (two hands, over the head, down); the guard's great axe likewise
const ARC = { walk: WALK6, idle: [['idle', 0.4]], windup: [['windup', 0.5]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.12], ['dead', 0.3], ['dead', 0.7]] };
const SH = (rx, ry, a) => [rx, ry, a];
const FOOT = 0.54;
const shamanStates = () => { const K = KIND['shang:shaman'], st = { ...K.base, ...STANDLEGS };
  return { ...foot('c:shaman', 'shaman', 'shang', { walk: WALK6, idle: [['idle', 0.4]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.12], ['dead', 0.3], ['dead', 0.7]] }),
    windup: [one('c:shaman', { ...st, ...K.windup })], chant: [one('c:shaman', { ...st, ...K.windup }), one('c:shaman', { ...st, t: -3, h: -8, au: -126, al: -44, bu: -172, bl: 14, w: -80, drum: 0, lu: -10, ll: 8, ku: 10, kl: 4 })] }; };
// the chariot: far horse, near horse, crew (the driver and a 戈 man), the car
export const CAMPAIGN = {
  'shang:ge': { side: 'shang', scale: FOOT * 1.04, box: [-120, -210, 160, 60], shadow: SH(19, 5.5, 0.3), states: foot('c:ge', 'cge', 'shang', ARC) },
  'shang:ge!': { side: 'shang', elite: true, scale: FOOT * 1.14, box: [-120, -230, 170, 60], shadow: SH(21, 6, 0.32), states: foot('c:ge!', 'cge', 'shang', ARC) },
  'shang:shield': { side: 'shang', scale: FOOT * 1.04, box: [-160, -190, 150, 60], shadow: SH(21, 5.5, 0.3), states: foot('c:shield', 'shield', 'shang', { ...ARC, block: [['block', 0.2]] }) },
  'shang:archer': { side: 'shang', scale: FOOT * 0.98, box: [-140, -180, 150, 60], shadow: SH(18, 5.5, 0.3), states: foot('c:archer', 'archer', 'shang', { ...ARC, windup: [['draw', 0.5]] }) },
  'shang:shaman': { side: 'shang', scale: FOOT * 1.1, box: [-130, -200, 160, 60], shadow: SH(22, 6, 0.3), states: shamanStates() },
  'shang:jingua': { side: 'shang', guard: true, scale: FOOT * 1.24, box: [-120, -230, 170, 60], shadow: SH(23, 6.5, 0.35), states: foot('c:guard', 'cge', 'shang', ARC) },
};
for (const k of ['shields', 'spears', 'spearmen']) { const tiers = {}; for (const r of [1, 3, 5]) { const g = [1, 1, 1.09, 1, 1.18][r - 1], pup = `c:zhou:${k}:${r}`, table = ZCUT[k].split(':')[1];
    const st = foot(pup, table, 'zhou', { walk: WALK6, idle: [['idle', 0.4]], windup: [['windup', 0.4]], attack: [['attack', 0.1]], hurt: [['stun', 0.15]], dead: [['dead', 0.12], ['dead', 0.3], ['dead', 0.7]] });
    for (const n in st) st[n] = st[n].map((fr) => [...(r === 5 && n !== 'dead' ? [{ pup: 'cloud', pose: {}, k: g, dy: 3 }] : []), ...fr.map((l) => ({ ...l, k: g, ...(r === 5 && n !== 'dead' ? { dy: -5 } : {}) }))]);
    tiers[r] = st; }
  CAMPAIGN['zhou:' + k] = { side: 'zhou', scale: FOOT, box: [-200, -260, 240, 70], shadow: SH(18, 5.5, 0.5), noShadow: ['5'], tiers, states: tiers[1] }; }

// the chariot, built from the old chariot's frames: the same horse poses, the new car, horses and crew
{ const old = OLD['shang:chariot'].states, swap = { 'horse:shang': 'c:horse', 'crew:driver': 'c:ge', 'crew:axe': 'c:ge', car: 'c:car' };
  const conv = (fr) => fr.map((l) => ({ ...l, pup: swap[l.pup] || l.pup, ...(l.pup === 'crew:driver' || l.pup === 'crew:axe' ? { k: (l.k || 1) * 1.14, dy: (l.dy || 0) - 12 } : {}) }));
  CAMPAIGN['shang:chariot'] = { side: 'shang', scale: 0.8, box: [-200, -240, 330, 50], shadow: SH(150, 13, 0.3), states: { run: old.run.map(conv), wreck: old.wreck.map(conv) } }; }

export const framesOfC = (key, state, variant) => { const P2 = CAMPAIGN[key]; if (!P2) return oldFrames(key, state, variant); return ((P2.tiers && P2.tiers[variant || 1]) || P2.states)[state] || []; };

// ------------------------------------------------------------------ the cutter (the same contract as index.js's)
export function createCampaignCutter(px = 1, { solid = false } = {}) {
  const cache = new Map(), old = oldCutter(px, { solid });
  const pupOf = (name, scale) => { const id = `${name}|${scale}`; let p = cache.get(id); if (!p) cache.set(id, p = bake(DEFS[name](), scale, 7 + (id.length * 31) % 97, solid)); return p; };
  return {
    count: (key, state, variant) => framesOfC(key, state, variant).length,
    draw(ctx, key, state, i, x, y, { variant, flip = 1, alpha = 1 } = {}) {
      const P2 = CAMPAIGN[key]; if (!P2) return old.draw(ctx, key, state, i, x, y, { variant, flip, alpha });
      const frames = framesOfC(key, state, variant), frame = frames[i % frames.length]; if (!frame) return false;
      const K = P2.scale * px;
      for (const l of frame) {
        const k = K * (l.k && l.k !== 1 ? l.k : 1), pup = pupOf(l.pup, k), f = flip * (l.flip || 1), pose = l.pose;
        ctx.globalAlpha = alpha * (l.alpha ?? 1) * (pose.$fade ?? 1);
        if (l.root) drawPuppet(ctx, pup, [f * k, 0, 0, k, x + flip * l.root[0] * K, y + l.root[1] * K], pose);
        else { const fall = pose.$fall || 0, lift = pose.$air ? Math.max(footDrop(pup, pose), pose.$air * 1.22) : footDrop(pup, pose) * (1 - fall) + 9 * fall - (pose.$bob || 0);
          drawPuppet(ctx, pup, [f * k, 0, 0, k, x + flip * (l.dx || 0) * K, y + (l.dy || 0) * K - lift * k], pose); }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; return true;
    },
  };
}
export { SETLEGS, LUNGE, mix };

// ------------------------------------------------------------------ 铁骑: frames
// The horse is the hero's frame (jiliang) at a smaller size, its gait from heroPose; the rider is a 长矛手 seated on it,
// placed at the saddle of each frame (the horse's lift is measured per frame, so the rider rides the gallop's rise and fall).
{ const HS = 0.44, RK = (r) => (1.1 * FOOT * [1, 1, 1.09, 1, 1.18][r - 1]) / HS;
  const seatOf = (r, pose) => { const d = DEFS[`c:zhou:horse:${r}`](), byId = Object.fromEntries(d.parts.map((q) => [q.id, q])), depth = (p) => (p.parent ? 1 + depth(byId[p.parent]) : 0);
    const pup = { parts: [...d.parts].sort((a, b) => depth(a) - depth(b)), feet: d.feet }, drop = footDrop(pup, pose), M = solve(pup, [1, 0, 0, 1, 0, 0], pose).body;
    return [M[2] * -33 + M[4] + 2, -drop + M[3] * -33 + M[5]]; };
  const hp = (phase, state = 'ride', t = 1, speed = 320) => heroPose({ x: 0, y: 0, vx: state === 'ride' ? speed : 0, vy: 0, facing: 1, state, stateT: t, hold: 0, boons: [], topSpeed: 520 }, { gait: state === 'ride' ? 'gallop' : 'stand', phase, t: 0 }, 0);
  const SIT = { lu: -70, ll: 74, ku: -58, kl: 70, $bob: 0 };
  const rider = (r, pose, horse, extra = {}) => { const [x, y] = seatOf(r, horse); return { pup: `c:zhou:spearmen:${r}`, pose: { ...pose, ...SIT, ...extra, $hide: { ...(pose.$hide || {}), ku: true, kl: true } }, root: [x, y], k: RK(r) }; };
  const fp = (s2, t2) => footPose('cspear', s2, t2, 0, 0.3, { side: 'zhou' });
  const tiers = {};
  for (const r of [1, 3, 5]) { const H = `c:zhou:horse:${r}`, fr = (h, p, extra) => [{ pup: H, pose: h }, rider(r, p, h, extra)];
    tiers[r] = {
      walk: Array.from({ length: 6 }, (_, i) => fr(hp(i / 6), fp('idle', 0.4), { t: 10 })),
      idle: [fr(hp(0, 'idle'), fp('idle', 0.4))],
      windup: [fr(hp(0.3), { ...fp('idle', 0.4), t: 14, au: -66, al: -12, bu: -50, bl: -30, w: -2, wb: 4 })],
      attack: [fr(hp(0.55, 'ride', 1, 520), { ...fp('idle', 0.4), t: 28, au: -84, al: -4, bu: -30, bl: -60, w: 6 })],
      hurt: [fr(hp(0, 'stopped', 0.2), fp('stun', 0.15))],
      dead: [fr(hp(0, 'stopped', 0.25), { ...fp('stun', 0.2), t: -40 }),
        [{ pup: H, pose: hp(0.3), dx: 70, alpha: 0.85 }, { pup: `c:zhou:spearmen:${r}`, pose: fp('dead', 0.3), dx: -20, k: RK(r) }],
        [{ pup: H, pose: hp(0.6), dx: 170, alpha: 0.4 }, { pup: `c:zhou:spearmen:${r}`, pose: fp('dead', 0.7), dx: -20, k: RK(r) }]],
    }; }
  CAMPAIGN['zhou:cavalry'] = { side: 'zhou', scale: HS, box: [-260, -330, 330, 60], shadow: SH(46, 9, 0.45), tiers, states: tiers[1] }; }
