// 法相: the great image that stands behind a general when he shows his true form. One painted picture per god, made from
// his true form's own picture (the same design) redrawn as a temple-mural line painting: an even dark ink line, thin warm
// washes, matte gold on the aureole, crown and weapon (lab/game-studies/imagegen/prompts/true2/faxiang.txt). The pictures
// are faxiang-<id>.webp beside this file; they are decoded before this module resolves, so baking stays synchronous.
//
//   FAXIANG[id] = {w, h, pivot: [x, y], head: [x, y]}  its size in its own pixels, where its feet stand (bottom centre), its head
//   drawFaxiang(ctx, id, x, y, k = 1, alpha = 1)    paints it with the pivot at (x, y); k scales it
//   bakeFaxiang(id, k = 1) -> canvas                the same on its own transparent canvas
// The pictures are scaled to H figure pixels tall, as the code-drawn figures were (art/fx sizes them by figure pixels).
const IDS = ['nezha', 'yangjian', 'leizhenzi', 'tuxingsun', 'dengchanyu', 'huangfeihu', 'jiangziya', 'zhenglun', 'longji', 'huangtianhua'];
const H = 960, BASE = import.meta.url.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
const IMG = {};
await Promise.all(IDS.map(async (id) => {
  const im = new Image(); im.src = BASE + 'faxiang-' + id + '.webp';
  try { await im.decode(); IMG[id] = im; } catch { /* a missing picture leaves that god without a great image */ }
}));
// head: the centre of each god's aureole in the picture's pixels (measured from the baked pictures), for the held beat
const HEAD = {nezha: [352, 211], yangjian: [345, 234], leizhenzi: [327, 210], tuxingsun: [277, 257], dengchanyu: [395, 100], huangfeihu: [590, 142], jiangziya: [527, 132], zhenglun: [575, 150], longji: [568, 143], huangtianhua: [506, 135]};
export const FAXIANG = Object.fromEntries(Object.entries(IMG).map(([id, im]) => { const w = Math.round((im.width * H) / im.height), k = w / im.width; return [id, { w, h: H, pivot: [Math.round(w / 2), H], head: HEAD[id] && [Math.round(HEAD[id][0] * k), Math.round(HEAD[id][1] * k)] }]; }));

/** k: scale. */
export function bakeFaxiang(id, k = 1) {
  const F = FAXIANG[id], im = IMG[id], cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(F.w * k)); cv.height = Math.max(1, Math.ceil(F.h * k));
  const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(im, 0, 0, cv.width, cv.height); return cv;
}
const cache = new Map();
export function drawFaxiang(ctx, id, x, y, k = 1, alpha = 1) {
  if (!FAXIANG[id]) return; const key = id + '|' + k; if (!cache.has(key)) cache.set(key, bakeFaxiang(id, k));
  const F = FAXIANG[id]; ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(cache.get(key), Math.round(x - F.pivot[0] * k), Math.round(y - F.pivot[1] * k)); ctx.restore();
}
