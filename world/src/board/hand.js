/*
 * hand.js: the name as hand lettering, written down stroke by stroke. Classic script (browser and Node): HAND.
 *
 * A stroke is a centreline [[x, y, pressure], ...] in the unit box of its letter, in the order and direction a
 * hand would make it. Latin letters: y = 0 is the cap line, y = 1 the baseline, the x-height line is at 1/3 (caps
 * are 1.5 x-heights); x in cap-heights. Chinese characters: a 1 x 1 box, strokes in the standard order
 * (罗 8, 亚 6, 鑫 24).
 *
 * HAND.layout(lang, size) places them and turns each centreline into what a flat brush held at a constant angle
 * would do along it: the footprint is widest when the brush travels across its own edge and thinnest along it, it
 * presses in at the start, lifts through the middle, and follows the written pressure to its end. size is the cap
 * height (en) or the character box (zh) in px. Returns {w, h, strokes: [{pts: [[x, y, pressure]...], width, fast}]}
 * in px from the lettering's top-left corner; `fast` strokes (flicks, 撇) should run dry.
 */
(function (root) {
'use strict';

/* ---- Latin: a brush italic. Thick downstrokes, hairline upstrokes and joins. ---- */
const LATIN = {
  Y: { adv: .74, strokes: [
    [[-.12, .12, .3], [.00, .01, .8], [.12, .12, 1.1], [.26, .34, 1.1], [.39, .54, .9]],        // entry swash, then the left arm
    [[.84, -.04, .85], [.70, .20, 1], [.50, .54, 1.05], [.38, .82, 1.05], [.31, 1.03, .8]],       // right arm into the stem
  ] },
  a: { adv: .63, strokes: [
    [[.50, .46, .75], [.36, .36, 1], [.16, .46, 1.05], [.06, .72, 1.05], [.17, .97, 1], [.36, .88, .8], [.50, .60, .5]],
    [[.52, .34, .95], [.53, .66, 1.05], [.56, .92, .95], [.67, 1.0, .55], [.76, .92, .28]],
  ] },
  x: { adv: .60, strokes: [
    [[.02, .37, .95], [.24, .64, 1.05], [.46, .93, 1], [.56, 1.01, .55]],
    [[.58, .34, .8], [.42, .58, .9], [.22, .86, .9], [.08, 1.03, .4]],         // the hairline
  ] },
  i: { adv: .36, strokes: [
    [[.12, .36, .95], [.13, .66, 1.05], [.16, .92, .95], [.26, 1.0, .55], [.34, .93, .28]],
    [[.10, .10, 1], [.17, .15, 1.15], [.21, .21, .7]],                                            // the dot: a short dab
  ] },
  n: { adv: .70, strokes: [
    [[.06, .34, .95], [.08, .66, 1.05], [.08, 1.0, .9]],
    [[.09, .60, .5], [.20, .42, .8], [.38, .36, 1.05], [.50, .52, 1.05], [.52, .88, .95], [.63, 1.0, .55], [.73, .92, .28]],
  ] },
  ' ': { adv: .26, strokes: [] },
  L: { adv: .80, strokes: [
    [[.34, -.06, .7], [.27, .02, 1], [.23, .44, 1.05], [.21, .80, 1.05], [.26, .95, 1.15], [.50, .99, 1.1], [.72, .97, .8], [.86, .88, .3]],   // one stroke: down, a swell at the foot, out
  ] },
  u: { adv: .68, strokes: [
    [[.05, .36, .95], [.07, .70, 1.05], [.18, .96, 1], [.35, .93, .9], [.48, .70, .7], [.52, .44, .5]],
    [[.54, .34, .95], [.55, .66, 1.05], [.58, .92, .95], [.69, 1.0, .55], [.78, .92, .28]],
  ] },
  o: { adv: .70, strokes: [
    [[.42, .37, .7], [.24, .38, 1], [.08, .58, 1.05], [.08, .80, 1.05], [.24, .99, 1], [.40, .96, .7]],    // left half
    [[.30, .35, .8], [.50, .40, 1.05], [.62, .62, 1.05], [.56, .88, 1], [.36, 1.0, .65]],                  // right half, joined at top and bottom
    [[.46, .37, .6], [.62, .33, .55], [.78, .35, .3]],                                    // the exit, a hairline flick
  ] },
};

/* ---- Chinese: 行楷 with a flat brush. Structure kept, weight simplified. ---- */
const JIN = [   // 金, 8 strokes
  [[.50, .00, 1], [.36, .17, .95], [.20, .29, .7], [.02, .37, .3]],     // 撇: tapers to a point
  [[.50, .02, .7], [.66, .17, .95], [.84, .31, 1.15], [.99, .37, .55]], // 捺: swells, then lifts
  [[.30, .43, .9], [.50, .42, .85], [.70, .41, 1]],                     // 横
  [[.21, .60, .9], [.50, .59, .85], [.79, .58, 1]],                     // 横
  [[.50, .43, 1], [.50, .70, .95], [.50, .93, .95]],                    // 竖
  [[.24, .69, .8], [.30, .77, 1.05], [.33, .83, .6]],                   // 点
  [[.77, .68, 1], [.71, .77, .9], [.66, .84, .45]],                     // 撇
  [[.02, .96, 1], [.50, .95, .9], [.98, .93, 1.15]],                    // 横
];
const place = (strokes, ox, oy, sx, sy) => strokes.map(st => st.map(([x, y, w]) => [ox + x * sx, oy + y * sy, w]));
const HANZI = {
  罗: { adv: 1.08, width: 1, strokes: [
    [[.10, .09, 1.05], [.11, .23, .95], [.13, .38, .9]],                                                    // 竖
    [[.09, .10, 1], [.50, .08, .9], [.90, .06, 1.1], [.90, .21, 1], [.87, .38, .9]],                        // 横折
    [[.36, .10, .8], [.36, .23, .8], [.37, .35, .75]],                                                      // 竖
    [[.63, .09, .8], [.63, .22, .8], [.63, .35, .75]],                                                      // 竖
    [[.12, .38, .95], [.50, .37, .9], [.88, .36, 1]],                                                       // 横
    [[.46, .44, 1.05], [.37, .55, .95], [.25, .65, .7], [.13, .71, .3]],                                    // 撇
    [[.40, .53, .9], [.60, .51, .9], [.80, .50, 1.1], [.70, .68, 1.05], [.50, .85, .9], [.28, .97, .6], [.05, 1.04, .25]],   // 横撇: the long sweep
    [[.41, .64, .8], [.50, .70, 1.1], [.56, .76, .6]],                                                      // 点
  ] },
  亚: { adv: 1.08, width: 1, strokes: [
    [[.13, .15, 1.05], [.50, .13, .9], [.87, .11, 1.15]],              // 横
    [[.38, .13, 1.05], [.37, .50, 1], [.36, .86, 1.05]],               // 竖
    [[.62, .12, 1.05], [.63, .50, 1], [.64, .86, 1.05]],               // 竖
    [[.10, .33, .8], [.18, .46, 1.15], [.24, .58, .6]],                // 点
    [[.91, .31, 1.15], [.84, .46, .95], [.77, .57, .65], [.72, .62, .3]],   // 撇
    [[.00, .90, 1.05], [.50, .88, .95], [1.0, .86, 1.2]],              // 横: the firm base
  ] },
  // three 金: the top one wide, its 人 a roof; the lower two tucked under it
  鑫: { adv: 1.06, width: .84, strokes: [...place(JIN, .13, -.06, .74, .57), ...place(JIN, -.07, .50, .57, .54), ...place(JIN, .50, .50, .57, .54)] },
};

// a smooth curve through the points, sampled evenly: [[x, y, w]...]
function sample(pts, n) {
  if (pts.length < 3) { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); out.push(pts[0].map((v, k) => v + (pts[pts.length - 1][k] - v) * t)); } return out; }
  const at = (i, t) => {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(pts.length - 1, i + 1)], p3 = pts[Math.min(pts.length - 1, i + 2)];
    return [0, 1, 2].map(k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
  };
  const out = [];
  for (let j = 0; j < n; j++) { const u = j / (n - 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)); out.push(at(i, u - i)); }
  return out;
}

function layout(lang, size) {
  const zh = lang === 'zh', text = zh ? '罗亚鑫' : 'Yaxin Luo';
  // the brush's edge: nearly level for the Chinese (thin 横, heavy 竖), about 40 degrees for the italic
  const edge = zh ? -.20 : -.50, thin = zh ? .50 : .30;
  const strokes = [];
  let x = zh ? size * .06 : size * .26, index = 0;
  const top = zh ? size * .06 : size * .14;
  for (const ch of text) {
    const g = (zh ? HANZI : LATIN)[ch];
    const lift = zh ? [.0, .010, -.006][index % 3] : [0, .012, -.008, .014, -.010, 0, .008, -.010, .012][index % 9];
    const lean = zh ? 0 : .16;                                   // about 9 degrees, the same for every letter
    const scale = zh ? 1 : [1, 1.02, .99, 1, 1.02, 1, 1.01, .99, 1.03][index % 9];
    const width = size * (zh ? .225 * (g.width || 1) : .285);
    for (const st of g.strokes) {
      const placed = st.map(([px, py, w]) => zh
        ? [x + px * size, top + (py + lift - (px - .5) * .05) * size, w]      // the line rises a little to the right
        : [x + (px * scale + (1 - py) * lean) * size, top + (1 - (1 - py) * scale + lift) * size, w]);
      let len = 0;
      for (let i = 1; i < placed.length; i++) len += Math.hypot(placed[i][0] - placed[i - 1][0], placed[i][1] - placed[i - 1][1]);
      const n = Math.max(6, Math.min(36, Math.round(len / (size * .035)) + 2));
      const pts = sample(placed, n);
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const across = Math.abs(Math.sin(dir - edge));          // 1: travelling across the brush's edge
        const t = i / (n - 1);
        const press = 1 + .16 * Math.exp(-t * 14) - .10 * Math.sin(Math.PI * Math.min(1, t * 1.15));   // press in, lift through the middle
        pts[i][2] = Math.max(.12, pts[i][2] * (thin + (1 - thin) * across) * press);
      }
      const last = st[st.length - 1][2];
      strokes.push({ pts, width, group: index, len, fast: last < .5 });
    }
    x += g.adv * size;
    index++;
  }
  return { w: x + size * (zh ? .02 : .10), h: zh ? size * 1.14 : size * 1.34, strokes, count: strokes.length };
}

root.HAND = { LATIN, HANZI, layout };
})(typeof window !== 'undefined' ? window : globalThis);

export {};
