// The drawing context for the field: WebGL2 (glctx.js) when the machine has a real GPU, Canvas 2D otherwise. The page asks
// for it once, in place of canvas.getContext('2d'), and draws through it as before; nothing else on the page changes.
//
//   import { createContext } from './art/render/context.js';
//   const ctx = createContext(canvas);          // ctx.kind: 'gl' | 'canvas'; ctx.why: why Canvas 2D, when it is
//
// Canvas 2D is used when:
//   - the address has ?render=canvas (for testing; ?render=gl insists on WebGL2, software or not);
//   - the browser has no WebGL2;
//   - WebGL2 would run on a software rasteriser (SwiftShader when the GPU is blocklisted): failIfMajorPerformanceCaveat.
//     Canvas 2D is faster there (render spike: 32 ms against 42 ms a frame at full load);
//   - the WebGL2 context is lost and does not come back within LOST_MS: then a Canvas 2D sheet is laid exactly over the
//     field canvas (it takes no input: clicks and focus still go to the field) and the same ctx object draws on it from
//     then on. A context that comes back in time is rebuilt and the textures are uploaded again as they are drawn.
import { createGL2D } from './glctx.js';

const LOST_MS = 1500;
const PROPS = ['globalAlpha', 'globalCompositeOperation', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'filter', 'font', 'textAlign', 'textBaseline'];
const METHODS = ['save', 'restore', 'setTransform', 'resetTransform', 'getTransform', 'transform', 'translate', 'scale', 'rotate', 'drawImage', 'fillRect', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'rect', 'arc', 'ellipse', 'stroke', 'fill', 'fillText', 'strokeText', 'measureText', 'setLineDash', 'clip', 'createLinearGradient', 'createRadialGradient', 'getImageData'];

export function createContext(canvas, { render = new URLSearchParams(globalThis.location ? location.search : '').get('render') } = {}) {
  // Canvas 2D has no strips: ctx.drawStrip (glctx's bent sprite) draws the cell unbent
  const unbent = function (img, sx, sy, sw, sh, dx, dy, dw, dh) { this.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); };
  const plain = (why) => { const c = canvas.getContext('2d', { alpha: false }); if (c) { c.kind = 'canvas'; c.why = why; c.drawStrip = unbent; c.prewarm = () => {}; } return c; };
  if (render === 'canvas') return plain('asked for (?render=canvas)');
  if (!globalThis.WebGL2RenderingContext) return plain('no WebGL2 in this browser');
  let ctx = null;
  try { ctx = createGL2D(canvas, { software: render === 'gl' }); } catch (e) { console.warn('muye: WebGL2 failed to start, drawing with Canvas 2D', e); return plain('WebGL2 failed to start'); }
  if (!ctx) return plain('no WebGL2 with a hardware GPU');          // a canvas that refused webgl2 can still give a 2d context
  ctx.kind = 'gl'; ctx.why = '';
  let timer = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ctx._lost(); clearTimeout(timer); timer = setTimeout(() => toCanvas(ctx, canvas), LOST_MS); });
  canvas.addEventListener('webglcontextrestored', () => { if (ctx.kind !== 'gl') return; clearTimeout(timer); ctx._restored(); });
  return ctx;
}

// the context did not come back: draw with Canvas 2D on a sheet laid over the field, through the same object
function toCanvas(ctx, canvas) {
  if (ctx.kind !== 'gl') return;
  const sheet = document.createElement('canvas');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.style.cssText = 'position:fixed;pointer-events:none;display:block;margin:0';
  canvas.after(sheet);
  const c = sheet.getContext('2d', { alpha: false });
  const fit = () => { const r = canvas.getBoundingClientRect(); const s = sheet.style; if (s.left !== r.left + 'px' || s.width !== r.width + 'px' || s.top !== r.top + 'px' || s.height !== r.height + 'px') { s.left = r.left + 'px'; s.top = r.top + 'px'; s.width = r.width + 'px'; s.height = r.height + 'px'; }
    if (sheet.width !== canvas.width || sheet.height !== canvas.height) { sheet.width = canvas.width; sheet.height = canvas.height; } };
  fit();
  for (const p of PROPS) Object.defineProperty(ctx, p, { get: () => c[p], set: (v) => { c[p] = v; }, configurable: true });
  for (const m of METHODS) ctx[m] = typeof c[m] === 'function' ? c[m].bind(c) : () => {};
  const st = c.setTransform.bind(c); ctx.setTransform = (...a) => { fit(); st(...a); };      // the page sets the transform first in every layer: the sheet follows the field's size there
  ctx.flush = () => {}; ctx.target = () => {}; ctx.silhouette = null; ctx.prewarm = () => {};
  ctx.drawStrip = (img, sx, sy, sw, sh, dx, dy, dw, dh) => c.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);   // unbent on Canvas 2D
  ctx.kind = 'canvas'; ctx.why = 'WebGL2 context lost'; ctx.canvas = sheet; ctx.gl = null;
  console.warn('muye: the WebGL2 context was lost and did not come back; drawing with Canvas 2D');
}
