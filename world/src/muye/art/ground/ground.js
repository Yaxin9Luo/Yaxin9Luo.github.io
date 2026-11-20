// The ground of the field of Muye: plain paper, one river painted across the whole field, large painted patches laid
// by a seeded layout, five landmarks, and the list of things that stand (which the world drawing sorts with the figures).
// Nothing is tiled: the river is one painting cut into pieces, and every patch is a painting without an edge, laid
// anywhere, mirrored or not, over any other. Baked by gen/ground.gen.mjs.
const FILES = {
  json: new URL('./baked/field.json', import.meta.url).href, ground: new URL('./baked/ground.webp', import.meta.url).href,
  props: new URL('./baked/props.webp', import.meta.url).href, marks: new URL('./baked/marks.webp', import.meta.url).href, grain: new URL('./baked/grain.webp', import.meta.url).href,
};
const RIVER = import.meta.glob('./baked/river-*.webp', { eager: true, query: '?url', import: 'default' });
const bitmap = async (src) => { const r = await fetch(src); if (!r.ok) throw new Error('muye art: cannot load ' + src); return createImageBitmap(await r.blob()); };
const hash = (i, j, k) => { let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const WORLD = 6000, CELL = 620, STAND = 1.5;            // STAND: standing scenery is drawn this much larger than it was painted, to stand beside a hero this large
// The day: the paper's tone and one colour screened over the ground for the ink's temperature. Figures are not tinted.
// Evening is never a hue: the paper goes a little warmer and greyer from 0.62, and in the last tenth dims to a warm grey.
// `far` is how much the far ground (the top of the view) is cooled and darkened: a veil, strongest at the top edge.
export const TIME = { keys: [0, 0.4, 0.62, 0.9, 1], paper: [[233, 230, 219], [239, 231, 214], [239, 231, 214], [228, 219, 203], [204, 194, 178]], temper: [[5, 10, 20], [0, 0, 0], [0, 0, 0], [8, 5, 2], [12, 7, 3]], far: [0.25, 0, 0, 0.7, 1] };
// where the landmarks are (world x, y). The ford is on the river and comes from the bake.
export const LANDMARKS = { camp: [1500, 1650], wood: [4550, 1500], village: [1350, 4500], altar: [4650, 4550] };

export async function loadGround(step = () => {}, seed = 7) {
  const field = await fetch(FILES.json).then((r) => r.json()); step();
  const names = Object.keys(RIVER).sort((a, b) => +a.match(/(\d+)\.webp/)[1] - +b.match(/(\d+)\.webp/)[1]);
  const [groundImg, propsImg, marksImg, grain, ...riverImgs] = await Promise.all([FILES.ground, FILES.props, FILES.marks, FILES.grain, ...names.map((n) => RIVER[n])].map((u) => bitmap(u).then((b) => { step(); return b; })));
  const KY = field.ky, tiles = field.river.tiles.map((t, i) => ({ ...t, img: riverImgs[i] })).filter((t) => t.img);
  LANDMARKS.ford = field.river.ford;
  const path = field.river.path, nearRiver = (x, y) => { let d = 1e9; for (const p of path) d = Math.min(d, Math.hypot(p[0] - x, (p[1] - y) * KY)); return d; };
  const nearMark = (x, y, r) => Object.values(LANDMARKS).some((m) => Math.hypot(m[0] - x, m[1] - y) < r);

  // ---------------------------------------------------------------- the layout, by seed
  // Cells of CELL. A cell is empty (about one in five) or holds one patch chosen by weight, shifted anywhere in it and
  // mirrored or not; three small bits in every cell; props singly and, here and there, a grove. Nothing with a face of
  // its own stands within sight of its like. Cells on the river or at a landmark are left to them.
  const PICK = [['earth', 3, 26], ['scrub', 3, 24], ['damp', 3, 18], ['stones', 2, 12], ['track', 2, 10], ['burnt', 2, 3]];
  const PROP = [['pine', 4, 40], ['boulder', 4, 32], ['dead', 2, 14], ['tent', 2, 3], ['stakes', 1, 3], ['banner', 1, 2], ['wreck', 1, 3]];
  const ONCE = { tent: 1700, stakes: 2200, banner: 2400, wreck: 2200 };
  const weigh = (list, r) => { let s = 0; for (const e of list) s += e[2]; r *= s; for (const e of list) { if ((r -= e[2]) < 0) return e; } return list[0]; };
  const patches = [], props = [];
  const prop = (stem, n, x, y, flip = 1) => { const cell = n > 1 ? stem + Math.floor(hash(Math.round(x), Math.round(y), 3) * n) : stem; props.push({ stem, cell, x, y, flip, r: (field.props.cells[cell] || [])[7] || 16 }); };
  for (let j = 0; j * CELL < WORLD; j++) for (let i = 0; i * CELL < WORLD; i++) {
    const h = (k) => hash(i, j, k + seed * 101), cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL, taken = nearMark(cx, cy, 560);
    if (!taken && h(1) > 0.12) { const [stem, n] = weigh(PICK, h(2)), x = (i + 0.15 + 0.7 * h(4)) * CELL, y = (j + 0.15 + 0.7 * h(5)) * CELL; if (nearRiver(x, y) > 190) patches.push({ cell: stem + Math.floor(h(3) * n), x, y, flip: h(6) < 0.5 ? -1 : 1 }); }
    for (let q = 0; q < 6; q++) { const x = (i + h(120 + q)) * CELL, y = (j + h(130 + q)) * CELL; if (nearRiver(x, y) > 70) patches.push({ cell: 'bit' + Math.floor(h(140 + q) * 4), x, y, flip: h(150 + q) < 0.5 ? -1 : 1 }); }
    if (taken) continue;
    const np = h(7) < 0.35 ? 0 : h(7) < 0.75 ? 1 : 2;
    for (let q = 0; q < np; q++) { let [stem, n] = weigh(PROP, h(10 + q * 5)); const x = (i + h(12 + q * 5)) * CELL, y = (j + h(13 + q * 5)) * CELL; if (nearRiver(x, y) < 90 || nearMark(x, y, 470)) continue;
      if (ONCE[stem] && (props.some((o) => o.stem === stem && Math.hypot(o.x - x, o.y - y) < ONCE[stem]) || nearMark(x, y, 1500))) { stem = 'boulder'; n = 4; }
      prop(stem, n, x, y, stem === 'banner' ? 1 : h(14 + q * 5) < 0.5 ? -1 : 1); }
    if (h(30) > 0.88) for (let q = 0, n = 3 + Math.floor(h(31) * 3), gx = (i + h(32)) * CELL, gy = (j + h(33)) * CELL; q < n; q++) { const x = gx + (h(50 + q) - 0.5) * 240, y = gy + (h(60 + q) - 0.5) * 260; if (nearRiver(x, y) > 90) prop('pine', 4, x, y, h(70 + q) < 0.5 ? -1 : 1); }
  }
  // ---------------------------------------------------------------- the landmarks: places worth riding past
  const at = (c, dx, dy) => [c[0] + dx, c[1] + dy / KY];       // offsets are given as they look on screen; the ground is squeezed by KY
  const g = (cell, c, dx = 0, dy = 0, flip = 1) => { const [x, y] = at(c, dx, dy); patches.push({ cell, x, y, flip }); };
  const s = (cell, c, dx, dy, flip = 1) => { const [x, y] = at(c, dx, dy); props.push({ stem: cell, cell, x, y, flip, r: (field.props.cells[cell] || [])[7] || 16 }); };
  { const c = LANDMARKS.camp; g('campGround', c); g('earth1', c, -360, 150); g('scrub0', c, 420, -160, -1);   // the ruined camp
    s('tornTent', c, -150, -40); s('tent0', c, 130, -110); s('tent1', c, -330, 60, -1); s('tornTent', c, 250, 90, -1); s('fallen', c, 10, 60); s('stakes', c, -60, 190); s('wreck', c, 380, 10); s('banner', c, -260, -140); s('boulder1', c, 300, -200); s('dead0', c, -430, -90); }
  { const c = LANDMARKS.wood; g('woodGround', c); g('woodGround', c, 260, 120, -1); g('scrub2', c, -420, 60); g('damp1', c, 120, -160);   // the pine wood: the one dense place
    for (let q = 0; q < 38; q++) { const a = hash(q, 5, 77) * Math.PI * 2, r = Math.sqrt(hash(q, 9, 77)) * 1, x = c[0] + 130 + Math.cos(a) * r * 470, y = c[1] + 40 + (Math.sin(a) * r * 300) / KY; props.push({ stem: 'pine', cell: 'pine' + (q % 4), x, y, flip: q % 3 ? 1 : -1, r: 16 }); }
    s('boulder2', c, -210, 130); s('boulder0', c, 380, -150, -1); s('boulder3', c, 60, 210); }
  { const c = LANDMARKS.village; g('villageGround', c); g('burnt0', c, -360, -230); g('burnt1', c, 330, 210, -1); g('earth2', c, 60, 300);   // the burnt village
    s('ruin0', c, -280, -100); s('ruin1', c, -40, -30); s('ruin2', c, 230, -110); s('ruin0', c, 120, 130, -1); s('ruin1', c, -250, 120, -1); s('dead1', c, 380, -40); s('dead0', c, -420, 10, -1); s('dead1', c, 20, -230); s('boulder3', c, 300, 250); }
  { const c = LANDMARKS.altar; g('altarGround', c); g('stones1', c, -330, 150); g('earth0', c, 60, 250);        // the altar on its mound
    s('altar', c, 0, 20); s('pine2', c, -270, -40); s('pine0', c, 290, 0, -1); s('boulder0', c, -200, 170); s('boulder1', c, 240, 180, -1); }
  { const c = LANDMARKS.ford; s('boulder2', c, -260, -150); s('pine1', c, 250, -210); s('dead0', c, -300, 170); g('track0', c, -40, 330); g('track1', c, 60, -330); }   // the ford: tracks lead down to it from both sides
  props.forEach((p) => { p.type = 'prop'; });

  // ---------------------------------------------------------------- the paper, cached
  const paper = document.createElement('canvas'), pctx = paper.getContext('2d'); let paperKey = '', time = 0.5;
  const at2 = (list, k) => { const K = TIME.keys; let i = 0; while (i < K.length - 2 && k > K[i + 1]) i++; const f = smooth(K[i], K[i + 1], k); return list[i].map((v, j) => Math.round(v + (list[i + 1][j] - v) * f)); };
  const DAY = TIME.paper[1];
  const farAt = (k) => { const K = TIME.keys; let i = 0; while (i < K.length - 2 && k > K[i + 1]) i++; return TIME.far[i] + (TIME.far[i + 1] - TIME.far[i]) * smooth(K[i], K[i + 1], k); };
  // the veil for the far ground: a strip 1 x 256, cool grey at the top fading to nothing two thirds down (made once)
  const veil = document.createElement('canvas'); veil.width = 1; veil.height = 256; { const c = veil.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgb(178,184,196)'); g.addColorStop(0.35, 'rgb(222,225,231)'); g.addColorStop(0.68, 'rgb(255,255,255)'); g.addColorStop(1, 'rgb(255,255,255)'); c.fillStyle = g; c.fillRect(0, 0, 1, 256); }
  function sheetOfPaper(w, h, dpr) { const key = `${w},${h},${dpr}`; if (key === paperKey) return; paperKey = key; paper.width = w; paper.height = h;
    pctx.fillStyle = `rgb(${DAY.map((v) => Math.min(255, Math.round(v / 0.94)))})`; pctx.fillRect(0, 0, w, h); const t = grain.width * dpr; for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) pctx.drawImage(grain, x, y, t, t); }
  const piece = (ctx, atlas, image, name, X, Y, z, flip = 1, k = 1) => { const q = atlas.cells[name]; if (!q) return; ctx.setTransform(flip * z * k, 0, 0, z * k, X, Y); ctx.drawImage(image, q[0], q[1], q[2], q[3], -q[4], -q[5], q[2] / q[6], q[3] / q[6]); };

  return {
    KY, field, props, patches, landmarks: LANDMARKS, marksImg, propsImg,
    setTime(k) { time = clamp(k); },
    /** the paper's colour on screen at time k, [r, g, b] */
    paperAt(k) { const p = at2(TIME.paper, clamp(k)), t = at2(TIME.temper, clamp(k)); return p.map((v, i) => Math.round(255 - (255 - Math.min(v, DAY[i])) * (255 - t[i]) / 255)); },
    /** paper, the river, the patches in view. V: {W, H (device px), z, dpr, cx, cy, sx(x), sy(y), hw, hh (half the view in world units)} */
    drawBase(ctx, V) {
      if (!(V.W > 0 && V.H > 0)) return;   /* a window with no size yet (a tab opened in the background): nothing to draw on */
      sheetOfPaper(V.W, V.H, V.dpr); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(paper, 0, 0);
      for (const t of tiles) { if (t.x > V.cx + V.hw || t.x + t.w < V.cx - V.hw || t.y / KY > V.cy + V.hh || (t.y + t.h) / KY < V.cy - V.hh) continue; ctx.setTransform(V.z, 0, 0, V.z, V.sx(t.x), V.sy(t.y / KY)); ctx.drawImage(t.img, 0, 0); }
      for (const p of patches) { const q = field.ground.cells[p.cell]; if (!q || Math.abs(p.x - V.cx) > V.hw + q[2] / 2 || Math.abs(p.y - V.cy) > V.hh + q[3] / KY) continue; piece(ctx, field.ground, groundImg, p.cell, V.sx(p.x), V.sy(p.y), V.z, p.flip); }
    },
    /** the time of day, laid over the ground: the paper's tone multiplied in, the ink's temperature screened on. Two fills. */
    drawTone(ctx, V) {
      const p = at2(TIME.paper, time), t = at2(TIME.temper, time), r = p.map((v, i) => Math.min(255, Math.round((v / DAY[i]) * 255)));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      if (r[0] + r[1] + r[2] < 762) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${r})`; ctx.fillRect(0, 0, V.W, V.H); }
      if (t[0] + t[1] + t[2] > 2) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgb(${t})`; ctx.fillRect(0, 0, V.W, V.H); }
      const far = farAt(time); if (far > 0.02) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = far; ctx.drawImage(veil, 0, 0, 1, 256, 0, 0, V.W, V.H); ctx.globalAlpha = 1; }   /* the far ground cooler and darker: one stretched strip */
      ctx.globalCompositeOperation = 'source-over';
    },
    mark(ctx, name, X, Y, z, o = {}) { const q = field.marks.cells[name]; if (!q) return; const kx = (o.kx ?? o.k ?? 1) * z, ky = (o.ky ?? o.k ?? 1) * z, rot = o.rot || 0, c = Math.cos(rot), s2 = Math.sin(rot), f = o.flat ? KY : 1;
      ctx.setTransform(kx * c, kx * s2 * f, -ky * s2, ky * c * f, X, Y); ctx.globalAlpha = o.a ?? 1; ctx.drawImage(marksImg, q[0], q[1], q[2], q[3], -q[4], -q[5], q[2] / q[6], q[3] / q[6]); ctx.globalAlpha = 1; },
    prop(ctx, p, X, Y, z) { piece(ctx, field.props, propsImg, p.cell, X, Y, z, p.flip, p.stem === 'boulder' || p.cell.startsWith('boulder') ? 1.15 : STAND); },
  };
}
