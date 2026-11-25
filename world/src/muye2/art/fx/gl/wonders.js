// The brush sheet of the great moments (fx/baked/wonders.webp + wonders.json, baked by `SET=wonders node gen/fx.gen.mjs`
// from gen/wonders.cells.mjs): real strokes laid with PaintSim, drawn here through glctx like any sprite.
// A cell is [page, sx, sy, sw, sh (px), pivot x, pivot y (units from the trimmed corner), w, h (units), axis].
//   W.ready, W.loaded           both loaded (a flag, a promise)
//   W.draw(c, name, X, Y, rot, kx, ky, a, u0 = 0, u1 = 1)
//       the cell's pivot at (X, Y) device px, turned by rot, kx and ky device px per unit (negative mirrors), alpha a;
//       only the part of it from u0 to u1 across its width (drawing a stroke on, or laying it in strips along a path)
//   W.bitmap(name)              the cell cut out as an ImageBitmap and its pivot in px: {bm, px, py, scale} (for seal.js)
const IMG_URL = new URL('../baked/wonders.webp', import.meta.url).href, JSON_URL = new URL('../baked/wonders.json', import.meta.url).href;
export function createWonders() {
  let img = null, cells = null, scale = 1; const cut = new Map();
  const loaded = Promise.all([fetch(JSON_URL).then((r) => r.json()), fetch(IMG_URL).then((r) => r.blob()).then((b) => createImageBitmap(b))]).then(([j, bm]) => { cells = j.cells; scale = j.pages.wonders.scale; img = bm; }).catch((e) => console.warn('fx: the brush sheet did not load', e));
  function draw(c, name, X, Y, rot, kx, ky, a, u0 = 0, u1 = 1) {
    const C = cells && cells[name]; if (!C || a <= 0 || u1 <= u0) return;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    c.setTransform(cs * kx, sn * kx, -sn * ky, cs * ky, X, Y); c.globalAlpha = Math.min(1, a);
    c.drawImage(img, C[1] + C[3] * u0, C[2], C[3] * (u1 - u0), C[4], -C[5] + C[7] * u0, -C[6], C[7] * (u1 - u0), C[8]);
  }
  async function bitmap(name) { if (cut.has(name)) return cut.get(name); const C = cells[name]; const bm = await createImageBitmap(img, C[1], C[2], C[3], C[4]); const o = { bm, px: C[5] * scale, py: C[6] * scale, scale }; cut.set(name, o); return o; }
  return { draw, bitmap, loaded, get image() { return img; }, cell: (n) => cells && cells[n], get ready() { return !!(img && cells); } };
}
