/*
 * paintname.js: paints the name with PaintSim (the user's own paint simulator, vendor/). Classic script, browser and
 * Node: NAMEPAINT.paint(PaintSim, lang, size, scale) -> the painted buffers.
 *
 * Order of work, as on a real board: a loose blue ground (scrubbed lay-in, broad flat-brush passes, palette-knife
 * scrapes, scumbled dry-brush at the edges, a few loaded dabs), left to set, then the hand lettering from hand.js
 * in thick cream, stroke by stroke. While the letters go on, every pixel a stroke changes is stamped with the moment
 * that stroke reaches it (0..1 over the whole name), so the page can replay the writing from finished buffers.
 */
(function (root) {
'use strict';

const hash = n => { let h = Math.imul(n | 0, 374761393) ^ 0x9E3779B9; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };

function paint(P, lang, size, scale, seed = 11) {
  const L = root.HAND.layout(lang, size);
  const padX = Math.round(size * .62), padY = Math.round(size * .30);
  const W = Math.ceil(L.w + padX * 2), H = Math.ceil(L.h + padY * 2);
  const s = P.create({ width: W, height: H, scale, seed, ground: { base: 'canvas', color: '#F6F7FB', tooth: .34, pitch: 2.3 }, define: { materials: {
    'lay-in': { base: 'oil', color: '#16227F', color2: '#1E2FA8', body: .45, reach: 0, merge: .1, pickup: 0, gloss: .12 },
    'deep': { base: 'oil', color: '#131C73', color2: '#2236B4', blend: .7, body: 1.0, reach: 0, merge: .25, pickup: .03 },
    'cobalt': { base: 'oil', color: '#1F3BC0', color2: '#3A62DE', blend: .7, body: 1.1, reach: 0, merge: .25, pickup: .03 },
    'sky': { base: 'oil', color: '#3F6BE2', color2: '#7FA3F2', blend: .6, body: 1.2, reach: 0, merge: .15, pickup: .02 },
    'night': { base: 'oil', color: '#0A1046', color2: '#141C6E', blend: .5, body: .9, reach: 0, merge: .2, pickup: .02 },
    'scumble': { base: 'oil', color: '#2B48CC', color2: '#5C82EA', body: .5, reach: 0, merge: 0, pickup: 0 },
    'cream': { base: 'oil', color: '#F5EFDD', color2: '#FFFDF5', blend: .5, body: 1.9, reach: 0, merge: .025, pickup: .012, gloss: .30 },
    'cool cream': { base: 'oil', color: '#E6ECF6', color2: '#FFFDF5', blend: .5, body: 1.9, reach: 0, merge: .025, pickup: .012, gloss: .30 },
  } } });
  let n = 0;
  const r = () => hash(seed * 7919 + n++);
  // the ground's loose outline: the lettering's box, grown, with ends that wander
  const x0 = padX * .30, x1 = W - padX * .30, y0 = padY * .42, y1 = H - padY * .42, gw = x1 - x0, gh = y1 - y0;
  const wave = (ax, ay, bx, by, bend) => [[ax, ay], [(ax + bx) / 2 + (r() - .5) * 8, (ay + by) / 2 + bend], [bx, by]];
  // 1. scrubbed lay-in: thin, with a dry brush, so the canvas shows at its ragged ends
  for (let i = 0; i < 7; i++) {
    const y = y0 + gh * (i + .5) / 7 + (r() - .5) * 6;
    s.paint({ material: 'lay-in', brush: { base: 'dry', width: gh / 5.2, load: 900, charge: 1 }, path: wave(x0 - 6 + r() * 26, y, x1 + 6 - r() * 26, y + (r() - .5) * 8, (r() - .5) * 8) });
  }
  // 2. broad passes with a flat brush, wet into wet
  for (let i = 0; i < 11; i++) {
    const y = y0 + gh * (.08 + .84 * r()), a = x0 + gw * r() * .45, b = a + gw * (.38 + .45 * r());
    s.paint({ material: i % 3 === 0 ? 'cobalt' : 'deep', brush: { base: 'flat', width: gh * (.22 + .14 * r()), rag: 14, wobble: .8 }, path: wave(a, y, Math.min(b, x1 + 4), y + (r() - .5) * 14, (r() - .5) * 10) });
  }
  // 3. palette-knife scrapes: slabs with a raised edge that skip and leave ridges
  for (let i = 0; i < 7; i++) {
    const y = y0 + gh * (.12 + .76 * r()), a = x0 + gw * (.04 + .7 * r()), len = gw * (.14 + .2 * r()), tilt = (r() - .5) * .5;
    s.paint({ material: i % 4 === 3 ? 'night' : i % 2 ? 'sky' : 'cobalt', brush: { base: 'knife', width: gh * (.16 + .12 * r()), dry: .5 }, path: [[a, y], [a + len, y + len * tilt]], spline: false, press: .8 });
  }
  // 4. scumble at the ends and along the edges: a nearly dry brush that catches only the tooth
  for (let i = 0; i < 12; i++) {
    const end = i % 3, y = y0 + gh * r();
    const a = end === 0 ? x0 - 14 - r() * 16 : end === 1 ? x1 - gw * .16 * r() - 20 : x0 + gw * r() * .8;
    const yy = end === 2 ? (i % 2 ? y0 - 4 + r() * 6 : y1 + 4 - r() * 6) : y;
    s.paint({ material: 'scumble', brush: { base: 'dry', width: gh * (.10 + .08 * r()), load: 110 }, path: wave(a, yy, a + 34 + r() * 56, yy + (r() - .5) * 34, (r() - .5) * 12) });
  }
  // 5. a few thick, loaded dabs
  for (let i = 0; i < 5; i++) {
    const a = x0 + gw * (.05 + .9 * r()), y = (i % 2 ? y0 + gh * (.06 + .12 * r()) : y1 - gh * (.06 + .12 * r()));
    s.paint({ material: { base: i % 2 ? 'sky' : 'cobalt', body: 2.1 }, brush: { base: 'flat', width: gh * .11, rag: 4 }, path: [[a, y], [a + 14 + r() * 16, y + (r() - .5) * 6]], spline: false });
  }
  s.dry(.86);

  const B = s.buffers, N = B.HT.length, pw = s.pxWidth, ph = s.pxHeight;
  const ground = { r: new Float32Array(B.CR), g: new Float32Array(B.CG), b: new Float32Array(B.CB), h: new Float32Array(B.HT), sp: new Float32Array(B.SP) };
  // the letters, with the moment each pixel is painted
  const when = new Float32Array(N).fill(2);
  const weights = L.strokes.map(st => { let len = 0; for (let i = 1; i < st.pts.length; i++) len += Math.hypot(st.pts[i][0] - st.pts[i - 1][0], st.pts[i][1] - st.pts[i - 1][1]); return len + size * .45; });
  const total = weights.reduce((a, b) => a + b, 0);
  let prevH = new Float32Array(B.HT), prevR = new Float32Array(B.CR), start = 0;
  L.strokes.forEach((st, k) => {
    const pts = st.pts.map(p => [p[0] + padX, p[1] + padY]);
    // a fast stroke (a flick, a 撇) carries less paint and breaks into dry brush towards its end
    s.paint({ material: st.group % 4 === 2 ? 'cool cream' : 'cream', brush: { base: 'round', width: st.width, clump: 3.2, streak: 1.0, rag: st.fast ? 6 : 3.5, wobble: .10, var: .05, edge: .14, dry: st.fast ? .34 : .04 },
      path: pts, spline: false, pressure: st.pts.map(p => Math.min(1, p[2] / 1.05)), load: st.fast ? st.len * 1.25 : undefined });
    // which pixels did this stroke change, and how far along the stroke is each
    const dense = pts;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const p of dense) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
    const m = st.width * 1.2 + 4, X0 = Math.max(0, Math.floor((bx0 - m) * scale)), X1 = Math.min(pw - 1, Math.ceil((bx1 + m) * scale)), Y0 = Math.max(0, Math.floor((by0 - m) * scale)), Y1 = Math.min(ph - 1, Math.ceil((by1 + m) * scale));
    const dur = weights[k] / total;
    for (let y = Y0; y <= Y1; y++) for (let x = X0, i = y * pw + X0; x <= X1; x++, i++) {
      if (B.HT[i] === prevH[i] && B.CR[i] === prevR[i]) continue;
      const ux = (x + .5) / scale, uy = (y + .5) / scale;
      let best = 1e18, at = 0;
      for (let j = 0; j < dense.length; j++) { const d = (dense[j][0] - ux) ** 2 + (dense[j][1] - uy) ** 2; if (d < best) { best = d; at = j; } }
      // where strokes cross, the pixel appears with the first stroke that reaches it, so the ground never shows through
      const moment = start + dur * (at / (dense.length - 1));
      if (moment < when[i]) when[i] = moment;
    }
    prevH.set(B.HT); prevR.set(B.CR);
    start += dur;
  });
  s.dry();
  return { W, H, pw, ph, padX, padY, layout: L, surface: s, ground, when, buffers: B };
}

/*
 * The small strokes of the page (four buttons, two chips), painted on one sheet. slots: [{w, h, kind}] in px;
 * returns the sheet's buffers and where each stroke lies on it. kind: 'orange', 'ultra', 'cobalt', 'viridian',
 * 'pale blue', 'pale mint'. A button's slot may say how much room its tail and its lead have (tail, lead, px).
 */
function strokes(P, slots, scale, seed = 5) {
  const mx = 30, my = 9, gap = 6;
  const W = Math.ceil(Math.max(...slots.map(s => s.w)) + mx * 2 + 4);
  let y = 2;
  const rects = slots.map(s => { const r = [2, y, s.w + mx * 2, s.h + my * 2]; y += r[3] + gap; return r; });
  const H = Math.ceil(y);
  const PAINTS = {
    orange: { base: 'oil', color: '#E2510F', color2: '#F7862B', blend: .6, body: 1.5, reach: 0, merge: 0, pickup: 0 },
    ultra: { base: 'oil', color: '#121C78', color2: '#2233B0', blend: .6, body: 1.15, reach: 0, merge: 0, pickup: 0 },
    cobalt: { base: 'oil', color: '#1B33B4', color2: '#3357D8', blend: .6, body: 1.15, reach: 0, merge: 0, pickup: 0 },
    viridian: { base: 'oil', color: '#06533C', color2: '#0C7A58', blend: .6, body: 1.15, reach: 0, merge: 0, pickup: 0 },
    'pale blue': { base: 'oil', color: '#C3CDF8', color2: '#DDE3FD', blend: .6, body: .55, reach: 0, merge: 0, pickup: 0, gloss: .1 },
    'pale mint': { base: 'oil', color: '#B5E6D2', color2: '#D2F3E5', blend: .6, body: .55, reach: 0, merge: 0, pickup: 0, gloss: .1 },
  };
  const s = P.create({ width: W, height: H, scale, seed, ground: { base: 'canvas', color: '#F6F7FB', tooth: .34, pitch: 2.3 }, define: { materials: PAINTS } });
  let n = 0;
  const r = () => hash(seed * 104729 + n++);
  slots.forEach((slot, i) => {
    const [x, yy, w, h] = rects[i], primary = slot.kind === 'orange', pale = slot.kind.startsWith('pale');
    const cy = yy + h / 2;
    if (pale) {      // a chip: one thin, even pass
      const a = x + mx - 4, b = x + w - mx + 4;
      s.paint({ material: slot.kind, brush: { base: 'flat', width: slot.h * .86, rag: 7, wobble: .5, dry: .2, edge: .2 }, path: [[a, cy + (r() - .5) * 2], [(a + b) / 2, cy + (r() - .5) * 2.4], [b, cy + (r() - .5) * 2]], tone2: 0 });
      return;
    }
    // A button is one pull of a loaded flat brush, each a little different: it lands a few px before the label and
    // leaves a lip there, runs under the label at full load, and past it the hand lifts while the brush runs dry, so
    // the stroke ends in a thin broken tail (as long as the room before the next button: slot.tail). It leans a
    // degree or two, up or down.
    const tail = Math.min(slot.tail === undefined ? 14 : slot.tail, 9 + r() * 11), lead = Math.min(5 + r() * 7, slot.lead === undefined ? 12 : slot.lead);      // a crowded row: short at both ends
    const a = x + mx - lead, b = x + w - mx + tail, len = b - a, lean = (r() - .5) * .075, bw = slot.h * (primary ? .98 : .74 + .1 * r());
    const at = t => [a + len * t, cy + (t - .5) * len * lean];      // a straight pull: a bend near its end would hook the tail
    const under = (w - mx * 2 + lead) / len;      // how far along the label ends
    s.paint({ material: slot.kind, brush: { base: 'flat', width: bw, rag: 12, wobble: .6, dry: 0 }, path: [at(0), at(under * .5), at(under), at(1)], spline: false, pressure: [1, 1, .88, .34], load: len * 1.3, tone2: .05 });
    s.paint({ material: { base: slot.kind, body: primary ? 2.1 : 1.8 }, brush: { base: 'flat', width: bw * .9, rag: 4 }, path: [[a - 1, at(0)[1]], [a + 9 + r() * 9, at(.08)[1]]], spline: false });
    if (primary) s.paint({ material: { base: 'orange', body: 1.2 }, brush: { base: 'flat', width: bw * .5, rag: 6, dry: .3 }, path: [[a + 12, cy - bw * .13], [a + len * under * (.6 + .2 * r()), cy - bw * .08]], spline: false, opacity: .9 });
  });
  s.dry();
  return { W, H, pw: s.pxWidth, ph: s.pxHeight, rects, mx, my, surface: s, buffers: s.buffers };
}

root.NAMEPAINT = { paint, strokes };

})(typeof window !== 'undefined' ? window : globalThis);

export {};
