// A WebGL2 stand-in for the part of CanvasRenderingContext2D the Muye art module draws with, so that module runs unchanged.
// Made by context.js (createContext), which also chooses Canvas 2D when WebGL2 is missing, slow or lost. Measured in the
// render spike (lab/game-studies/RENDER-SPIKE.md): pixel-identical to Canvas 2D, about 2.4 draw calls a frame, a third of
// Canvas 2D's CPU per frame.
//
// Every drawImage, fillRect and stroke becomes a textured quad in one big vertex buffer; quads are drawn in order, in batches
// of up to UNITS textures, cut only when the blend mode changes or a seventeenth texture comes. Textures are made the first
// time an image is drawn (canvas, ImageBitmap, <img>) and kept by the image object; a canvas whose size changed since is
// uploaded again (the paper); a canvas redrawn at the same size must be told: ctx.invalidate(canvas).
// Premultiplied alpha throughout, so the blends are Canvas 2D's:
//   source-over (1, 1-As)   multiply (Cd, 1-As)   screen (1, 1-Cs)   lighter (1, 1)
// Paths: lines and ellipse/arc outlines are strips of quads with a feathered line texture (soft edges, no MSAA);
// a filled full circle is one quad of a soft disc; any other filled path is a triangle fan without antialiasing.
// The frame is flushed by itself at the end of the task that drew it (a microtask), so callers need not flush.
// Beyond Canvas 2D: ctx.silhouette = [r, g, b] draws images as flat shapes of that colour (their alpha only);
// ctx.target(fb, w, h) draws into a framebuffer; ctx.gl, ctx.onRestore(f), ctx.generation for effects with GL of their own.
const UNITS = 16, MAXQ = 16384, FLOATS = 6;                 // per vertex: x, y, u, v, colour (packed), texture unit

const VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aCol; in float aTex;
uniform vec2 uRes; uniform float uFlip;
out vec2 vUV; out vec4 vCol; flat out int vTex;
void main(){ vUV = aUV; vCol = aCol; vTex = int(aTex + 0.5);
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, (1.0 - aPos.y / uRes.y * 2.0) * uFlip, 0.0, 1.0); }`;
const FS = `#version 300 es
precision mediump float;
in vec2 vUV; in vec4 vCol; flat in int vTex;
uniform sampler2D uT[${UNITS}];
out vec4 o;
void main(){ vec4 c; int t = vTex & 31;
  ${Array.from({ length: UNITS }, (_, i) => `${i ? 'else ' : ''}if (t == ${i}) c = texture(uT[${i}], vUV);`).join('\n  ')}
  if (vTex >= 32) c = vec4(c.a);                       // silhouette: the image's shape, in the vertex colour
  o = c * vCol; }`;

const BLEND = { 'source-over': [1, 0x0303], multiply: [0x0306, 0x0303], screen: [1, 0x0301], lighter: [1, 1] };   // [src, dst] colour factors

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
}

const colours = new Map();
function parseColour(s) {
  if (typeof s !== 'string') return [0, 0, 0, 0];
  let c = colours.get(s); if (c) return c;
  let m;
  if (s[0] === '#') { const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7); c = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, s.length === 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1]; }
  else if ((m = /rgba?\(([^)]+)\)/.exec(s))) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); c = [v[0] / 255, v[1] / 255, v[2] / 255, v.length > 3 ? v[3] : 1]; }
  else c = [0, 0, 0, 1];
  if (colours.size > 4096) colours.clear(); colours.set(s, c); return c;
}

export function createGL2D(canvas, { antialias = false, units = UNITS, software = false, viaCanvas = false } = {}) {
  units = Math.min(units, UNITS);
  // failIfMajorPerformanceCaveat: no context on a software rasteriser (SwiftShader, when the GPU is blocklisted): Canvas 2D is faster there
  const gl = canvas.getContext('webgl2', { alpha: false, antialias, premultipliedAlpha: true, preserveDrawingBuffer: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: !software });
  if (!gl) return null;
  const buf = new ArrayBuffer(MAXQ * 4 * FLOATS * 4), f32 = new Float32Array(buf), u32 = new Uint32Array(buf);
  let prog, uRes, uFlip, vao, vbo, texOf = new WeakMap();
  // the GL objects, made at once and made again when a lost context comes back (textures are uploaded again as drawn)
  function setup() {
    prog = compile(gl, VS, FS); gl.useProgram(prog);
    uRes = gl.getUniformLocation(prog, 'uRes'); uFlip = gl.getUniformLocation(prog, 'uFlip');
    gl.uniform1iv(gl.getUniformLocation(prog, 'uT'), Int32Array.from({ length: UNITS }, (_, i) => i));
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.STREAM_DRAW);
    const stride = FLOATS * 4, at = (n) => gl.getAttribLocation(prog, n);
    gl.enableVertexAttribArray(at('aPos')); gl.vertexAttribPointer(at('aPos'), 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(at('aUV')); gl.vertexAttribPointer(at('aUV'), 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(at('aCol')); gl.vertexAttribPointer(at('aCol'), 4, gl.UNSIGNED_BYTE, true, stride, 16);
    gl.enableVertexAttribArray(at('aTex')); gl.vertexAttribPointer(at('aTex'), 1, gl.FLOAT, false, stride, 20);
    const idx = new Uint16Array(MAXQ * 6); for (let q = 0, v = 0; q < MAXQ * 6; q += 6, v += 4) { idx[q] = v; idx[q + 1] = v + 1; idx[q + 2] = v + 2; idx[q + 3] = v + 1; idx[q + 4] = v + 3; idx[q + 5] = v + 2; }
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    texOf = new WeakMap(); stats.textureBytes = 0;
  }

  // ---- textures, by image object
  const stats = { textures: 0, textureBytes: 0, uploads: 0, uploadMs: 0, drawCalls: 0, quads: 0, flushes: {}, unsupported: {} };
  let scratch = null;
  setup();
  function upload(img, rec) {
    const t0 = performance.now(), w = img.width, h = img.height;
    let src = img;
    // ImageBitmaps ignore UNPACK_PREMULTIPLY_ALPHA; Chrome's are premultiplied already (pixel-checked against Canvas 2D). viaCanvas
    // passes them through a canvas instead: same pixels, but it cost about 250 MB more footprint (the canvas copies stay alive)
    if (viaCanvas && typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) { scratch = scratch || document.createElement('canvas'); scratch.width = w; scratch.height = h; const c = scratch.getContext('2d'); c.clearRect(0, 0, w, h); c.drawImage(img, 0, 0); src = scratch; }
    gl.bindTexture(gl.TEXTURE_2D, rec.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    // sheets (the figures, the brush sheet) are minified when the camera zooms out (to 0.7 on small windows): mipmapped, so line
    // work does not shimmer; magnification stays LINEAR. Tiny textures (the solid, the disc) need none. A third more memory.
    const mip = w >= 256 && h >= 256 && !img.noMip;      // noMip: a sheet only seen briefly (the code hero unhorsed, art/sprites/sprites.js)
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src === scratch) { scratch.width = scratch.height = 1; }
    const bytes = Math.round(w * h * 4 * (mip ? 4 / 3 : 1)); stats.textureBytes += bytes - (rec.bytes || 0); rec.bytes = bytes; rec.w = w; rec.h = h; rec.iw = 1 / w; rec.ih = 1 / h;
    stats.uploads++; stats.uploadMs += performance.now() - t0; (stats.list || (stats.list = [])).push([img.constructor.name, w, h]);
  }
  function texture(img) {
    let rec = texOf.get(img);
    if (!rec) { rec = { tex: gl.createTexture(), w: 0, h: 0, iw: 1, ih: 1, bytes: 0, unit: -1, gen: -1 }; texOf.set(img, rec); stats.textures++; upload(img, rec); }
    else if (rec.w !== img.width || rec.h !== img.height || rec.dirty) { rec.dirty = false; upload(img, rec); }
    return rec;
  }
  const solid = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); return c; })();
  const disc = (() => { const c = document.createElement('canvas'), n = 64; c.width = c.height = n; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(n / 2, n / 2, n / 2 - 1, 0, Math.PI * 2); x.fill(); return c; })();
  const line = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 16; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 16); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.25, '#fff'); g.addColorStop(0.75, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 16); return c; })();

  // ---- the batch
  const bound = new Array(UNITS).fill(null); let nUnits = 0, gen = 0, nq = 0, blend = 'source-over', W = canvas.width, H = canvas.height, flip = 1;
  let fbNow = null, scheduled = false;
  // GPU time of each whole frame (from its first draw to the end of its task), when the browser has the timer extension:
  // stats.gpu holds the last 240 frames in ms. The effects choose their quality from it (fx/gl/quality.js).
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'), gpuQ = []; let qNow = null;
  stats.gpu = []; stats.gpuTimer = !!tq;  if (globalThis.location && /[?&]bench=1/.test(location.search)) globalThis.__glStats = stats;   // the render-spike harness reads GPU frame times in bench runs
  function gpuRead() { while (gpuQ.length) { const q = gpuQ[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { stats.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); if (stats.gpu.length > 240) stats.gpu.shift(); } gl.deleteQuery(q); gpuQ.shift(); } }
  const afterQ = [];   // work for offscreen targets, run once the frame's drawing is flushed (a tiled GPU then need not store and reload the screen mid-frame)
  // a test reading the canvas inside the frame must flush the batch first (the bench and test drivers only; ?bench=1 or __tester)
  if (globalThis.location && (/[?&]bench=1/.test(location.search) || globalThis.__tester)) globalThis.__glFlush = () => { if (!lost) flush('probe'); };
  const endOfTask = () => { scheduled = false; flush('end'); if (afterQ.length && !lost) { for (const f of afterQ.splice(0)) { try { f(); } catch (e) { console.warn('glctx: afterFrame', e); } } flush('end'); } else afterQ.length = 0; if (qNow) { gl.endQuery(tq.TIME_ELAPSED_EXT); gpuQ.push(qNow); qNow = null; } };
  function frameStart() { scheduled = true; queueMicrotask(endOfTask); if (tq && !lost && gpuQ.length < 8) { gpuRead(); qNow = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, qNow); } }
  function flush(reason = 'end') {
    if (!nq) return;
    if (lost) { nq = 0; nUnits = 0; gen++; return; }
    if (!fbNow) { W = canvas.width; H = canvas.height; gl.viewport(0, 0, W, H); }
    gl.useProgram(prog); gl.bindVertexArray(vao); gl.uniform2f(uRes, W, H); gl.uniform1f(uFlip, flip);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32, 0, nq * 4 * FLOATS);
    for (let i = 0; i < nUnits; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, bound[i].tex); }
    const b = BLEND[blend] || BLEND['source-over']; gl.blendFuncSeparate(b[0], b[1], 1, 0x0303);
    gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_SHORT, 0); gl.bindVertexArray(null);
    stats.drawCalls++; stats.quads += nq; stats.flushes[reason] = (stats.flushes[reason] || 0) + 1;
    nq = 0; nUnits = 0; gen++;
  }
  function unitFor(rec) {
    if (rec.gen === gen) return rec.unit;
    if (nUnits === units) flush('textures');
    rec.gen = gen; rec.unit = nUnits; bound[nUnits++] = rec; return rec.unit;
  }
  function setBlend(op) { if (!BLEND[op]) { ctx.stats.unsupported[op] = (ctx.stats.unsupported[op] || 0) + 1; op = 'source-over'; } if (op !== blend) { flush('blend'); blend = op; } }
  // one quad: local corners (x0,y0)-(x1,y1) through the current transform, texture rect (u0,v0)-(u1,v1) in texels
  function quad(rec, x0, y0, x1, y1, u0, v0, u1, v1, col) {
    if (nq === MAXQ) flush('full');
    if (!scheduled) frameStart();
    const u = unitFor(rec) + sil, m = T, o = nq * 4 * FLOATS, iw = rec.iw, ih = rec.ih;
    u0 *= iw; u1 *= iw; v0 *= ih; v1 *= ih;
    const ax = m[0] * x0, bx = m[1] * x0, ax1 = m[0] * x1, bx1 = m[1] * x1, cy = m[2] * y0, dy = m[3] * y0, cy1 = m[2] * y1, dy1 = m[3] * y1;
    f32[o] = ax + cy + m[4]; f32[o + 1] = bx + dy + m[5]; f32[o + 2] = u0; f32[o + 3] = v0; u32[o + 4] = col; f32[o + 5] = u;
    f32[o + 6] = ax1 + cy + m[4]; f32[o + 7] = bx1 + dy + m[5]; f32[o + 8] = u1; f32[o + 9] = v0; u32[o + 10] = col; f32[o + 11] = u;
    f32[o + 12] = ax + cy1 + m[4]; f32[o + 13] = bx + dy1 + m[5]; f32[o + 14] = u0; f32[o + 15] = v1; u32[o + 16] = col; f32[o + 17] = u;
    f32[o + 18] = ax1 + cy1 + m[4]; f32[o + 19] = bx1 + dy1 + m[5]; f32[o + 20] = u1; f32[o + 21] = v1; u32[o + 22] = col; f32[o + 23] = u;
    nq++;
  }
  // a quad given by four device-space points (for strokes and fans; transform already applied)
  function quadPts(rec, p, u0, v0, u1, v1, col) {
    if (nq === MAXQ) flush('full');
    if (!scheduled) frameStart();
    const u = unitFor(rec), o = nq * 4 * FLOATS, iw = rec.iw, ih = rec.ih, uv = [u0 * iw, v0 * ih, u1 * iw, v0 * ih, u0 * iw, v1 * ih, u1 * iw, v1 * ih];
    for (let k = 0; k < 4; k++) { const q = o + k * FLOATS; f32[q] = p[k * 2]; f32[q + 1] = p[k * 2 + 1]; f32[q + 2] = uv[k * 2]; f32[q + 3] = uv[k * 2 + 1]; u32[q + 4] = col; f32[q + 5] = u; }
    nq++;
  }
  // a quad from four device-space points with a texel uv for each (p and uv: [x0,y0, x1,y1, x2,y2, x3,y3], corners in the
  // order top-left, top-right, bottom-left, bottom-right of the strip segment); silhouette honoured
  function quadUV(rec, p, uv, col) {
    if (nq === MAXQ) flush('full');
    if (!scheduled) frameStart();
    const u = unitFor(rec) + sil, o = nq * 4 * FLOATS, iw = rec.iw, ih = rec.ih;
    for (let k = 0; k < 4; k++) { const q = o + k * FLOATS; f32[q] = p[k * 2]; f32[q + 1] = p[k * 2 + 1]; f32[q + 2] = uv[k * 2] * iw; f32[q + 3] = uv[k * 2 + 1] * ih; u32[q + 4] = col; f32[q + 5] = u; }
    nq++;
  }
  const SP = new Float32Array(8), SU = new Float32Array(8), CX = new Float32Array(17), CY = new Float32Array(17), NX = new Float32Array(17), NY = new Float32Array(17);
  const pack = (r, g, b, a) => ((Math.round(a * 255) << 24) | (Math.round(b * a * 255) << 16) | (Math.round(g * a * 255) << 8) | Math.round(r * a * 255)) >>> 0;   // premultiplied, little-endian RGBA

  // ---- the 2D state
  let T = [1, 0, 0, 1, 0, 0], sil = 0, lost = false;
  const stack = [], restoreFns = [];
  let path = [], sub = null;
  const ctx = {
    canvas, gl, stats,
    silhouette: null, generation: 0, globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', imageSmoothingEnabled: true, imageSmoothingQuality: 'low', filter: 'none', font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    save() { stack.push([T.slice(), this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap]); },
    restore() { const s = stack.pop(); if (!s) return; [T, this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap] = s; },
    setTransform(a, b, c, d, e, f) { if (typeof a === 'object' && a) { T = [a.a, a.b, a.c, a.d, a.e, a.f]; return; } T[0] = a; T[1] = b; T[2] = c; T[3] = d; T[4] = e; T[5] = f; },
    resetTransform() { T = [1, 0, 0, 1, 0, 0]; },
    getTransform() { return { a: T[0], b: T[1], c: T[2], d: T[3], e: T[4], f: T[5] }; },
    transform(a, b, c, d, e, f) { const m = T; T = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; },
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); }, scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }, rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); },
    drawImage(img, a, b, c, d, e, f, g, h) {
      const ga = this.globalAlpha; if (ga <= 0 || !img || !img.width) return;
      setBlend(this.globalCompositeOperation); const rec = texture(img), sc = this.silhouette, a1 = ga > 1 ? 1 : ga, col = sc ? pack(sc[0] / 255, sc[1] / 255, sc[2] / 255, a1) : pack(1, 1, 1, a1); sil = sc ? 32 : 0;
      if (e === undefined) { if (c === undefined) { c = img.width; d = img.height; } quad(rec, a, b, a + c, b + d, 0, 0, img.width, img.height, col); }
      else quad(rec, e, f, e + g, f + h, a, b, a + c, b + d, col);
      sil = 0;
    },
    /** drawImage's nine-argument form, bent: the cell is laid as a strip of n quads (default 8, at most 16) that sways along a
     *  travelling wave whose sideways swing grows toward the free end; it batches with every other sprite. For sashes, cloaks,
     *  plumes, banners, the standard, manes and tails. wave (all optional, lengths in the destination's local units):
     *    from   'left' | 'right' | 'top' | 'bottom': the edge that is fixed (where it hangs from); the rest swings. Default 'top'
     *    amp    the swing at the free end;  phase (radians) where the wave is now;  waves  wavelengths along it (default 0.8)
     *    lean   a steady bend at the free end (the wind, his speed);  snap  0..1, a kick that bows the middle out (on a blow)
     *    grow   how the swing grows from the fixed end (s^grow, default 1.6);  n  segments
     *  The bend moves each point sideways only, and the edges follow its curve, so the cell keeps its width. On Canvas 2D
     *  (context.js) the same call draws the cell unbent. */
    drawStrip(img, sx, sy, sw, sh, dx, dy, dw, dh, wave) {
      const ga = this.globalAlpha; if (ga <= 0 || !img || !img.width) return;
      const w = wave || {}, n = Math.max(1, Math.min(16, w.n | 0 || 8)), from = w.from || 'top', amp = w.amp || 0, phase = w.phase || 0, waves = w.waves ?? 0.8, lean = w.lean || 0, snap = w.snap || 0, grow = w.grow ?? 1.6;
      if (!amp && !lean && !snap) return this.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      setBlend(this.globalCompositeOperation); const rec = texture(img), sc = this.silhouette, a1 = ga > 1 ? 1 : ga, col = sc ? pack(sc[0] / 255, sc[1] / 255, sc[2] / 255, a1) : pack(1, 1, 1, a1); sil = sc ? 32 : 0;
      const vert = from === 'top' || from === 'bottom', rev = from === 'right' || from === 'bottom', L = vert ? dh : dw, hw = (vert ? dw : dh) / 2;
      // the centre line, fixed end first: s = 0 .. 1 along it, displaced sideways by d(s)
      for (let i = 0; i <= n; i++) { const s = i / n, d = (amp * Math.sin(phase - 6.283185 * waves * s) + lean + snap * amp * 1.5 * Math.sin(3.14159 * s)) * Math.pow(s, grow), a = (rev ? 1 - s : s) * L;
        if (vert) { CX[i] = dx + hw + d; CY[i] = dy + a; } else { CX[i] = dx + a; CY[i] = dy + hw + d; } }
      // normals along the curve, pointing to +x for a hanging cell and +y for a lying one, so the edges keep their sides
      for (let i = 0; i <= n; i++) { const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1); let tx = CX[i1] - CX[i0], ty = CY[i1] - CY[i0]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        let nx = -ty, ny = tx; if (vert ? nx < 0 : ny < 0) { nx = -nx; ny = -ny; } NX[i] = nx * hw; NY[i] = ny * hw; }
      const m = T, X = (x, y) => m[0] * x + m[2] * y + m[4], Y = (x, y) => m[1] * x + m[3] * y + m[5];
      for (let i = 0; i < n; i++) { const j = i + 1, s0 = i / n, s1 = j / n;
        // corners: low side at the segment's start, high side at its start, low side at its end, high side at its end
        const lx0 = CX[i] - NX[i], ly0 = CY[i] - NY[i], hx0 = CX[i] + NX[i], hy0 = CY[i] + NY[i], lx1 = CX[j] - NX[j], ly1 = CY[j] - NY[j], hx1 = CX[j] + NX[j], hy1 = CY[j] + NY[j];
        SP[0] = X(lx0, ly0); SP[1] = Y(lx0, ly0); SP[2] = X(hx0, hy0); SP[3] = Y(hx0, hy0); SP[4] = X(lx1, ly1); SP[5] = Y(lx1, ly1); SP[6] = X(hx1, hy1); SP[7] = Y(hx1, hy1);
        const t0 = rev ? 1 - s0 : s0, t1 = rev ? 1 - s1 : s1;
        if (vert) { const v0 = sy + sh * t0, v1 = sy + sh * t1; SU[0] = sx; SU[1] = v0; SU[2] = sx + sw; SU[3] = v0; SU[4] = sx; SU[5] = v1; SU[6] = sx + sw; SU[7] = v1; }
        else { const u0 = sx + sw * t0, u1 = sx + sw * t1; SU[0] = u0; SU[1] = sy; SU[2] = u0; SU[3] = sy + sh; SU[4] = u1; SU[5] = sy; SU[6] = u1; SU[7] = sy + sh; }
        quadUV(rec, SP, SU, col); }
      sil = 0;
    },
    /** A mesh of the image laid on a grid of cols x rows cells (the key figures' skinned joints, art/puppets/imagegen/figures.js):
     *  xy holds the (cols + 1) * (rows + 1) corner points row by row in the current transform's units, uv the same corners in
     *  image px. Batches with every other sprite. Canvas 2D (context.js) has no drawGrid: callers fall back to drawImage. */
    drawGrid(img, cols, rows, xy, uv) {
      const ga = this.globalAlpha; if (ga <= 0 || !img || !img.width) return;
      setBlend(this.globalCompositeOperation); const rec = texture(img), sc = this.silhouette, a1 = ga > 1 ? 1 : ga, col = sc ? pack(sc[0] / 255, sc[1] / 255, sc[2] / 255, a1) : pack(1, 1, 1, a1); sil = sc ? 32 : 0;
      const m = T, R = (cols + 1) * 2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = j * R + i * 2, c = a + R;   // corners: a (top-left), a + 2, c (bottom-left), c + 2
        for (let k = 0; k < 4; k++) { const q = k === 0 ? a : k === 1 ? a + 2 : k === 2 ? c : c + 2, x = xy[q], y = xy[q + 1];
          SP[k * 2] = m[0] * x + m[2] * y + m[4]; SP[k * 2 + 1] = m[1] * x + m[3] * y + m[5]; SU[k * 2] = uv[q]; SU[k * 2 + 1] = uv[q + 1]; }
        quadUV(rec, SP, SU, col); }
      sil = 0;
    },
    fillRect(x, y, w, h) { const c = parseColour(this.fillStyle); setBlend(this.globalCompositeOperation); quad(texture(solid), x, y, x + w, y + h, 1, 1, 3, 3, pack(c[0], c[1], c[2], c[3] * this.globalAlpha)); },
    clearRect(x, y, w, h) { flush('clear'); if (x <= 0 && y <= 0 && x + w >= W && y + h >= H && T[0] === 1 && T[3] === 1) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } },
    beginPath() { path = []; sub = null; },
    moveTo(x, y) { sub = [this._x(x, y), this._y(x, y)]; path.push(sub); },
    lineTo(x, y) { if (!sub) return this.moveTo(x, y); sub.push(this._x(x, y), this._y(x, y)); },
    closePath() { if (sub && sub.length > 2) sub.push(sub[0], sub[1]); },
    rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); },
    arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); },
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      let span = a1 - a0; if (ccw) span = -((a0 - a1) % (Math.PI * 2) || Math.PI * 2); const full = Math.abs(span) >= Math.PI * 2 - 1e-6;
      const scr = Math.sqrt(Math.abs(T[0] * T[3] - T[1] * T[2])) * Math.max(rx, ry), n = Math.max(8, Math.min(96, Math.ceil(scr * Math.abs(span) / 6)));
      const cr = Math.cos(rot), sr = Math.sin(rot);
      if (!sub || full) { sub = []; path.push(sub); }
      for (let i = 0; i <= n; i++) { const t = a0 + (span * i) / n, px = Math.cos(t) * rx, py = Math.sin(t) * ry, lx = x + px * cr - py * sr, ly = y + px * sr + py * cr; sub.push(this._x(lx, ly), this._y(lx, ly)); }
      if (full) { sub.circle = [x, y, rx, ry, rot, T.slice()]; }
    },
    _x(x, y) { return T[0] * x + T[2] * y + T[4]; }, _y(x, y) { return T[1] * x + T[3] * y + T[5]; },
    stroke() {
      const c = parseColour(this.strokeStyle), col = pack(c[0], c[1], c[2], c[3] * this.globalAlpha); setBlend(this.globalCompositeOperation);
      const k = Math.sqrt(Math.abs(T[0] * T[3] - T[1] * T[2])), hw = Math.max(0.5, (this.lineWidth * k) / 2) + 0.5, rec = texture(line);   // half width in device px, + a feathered half pixel
      const p = [0, 0, 0, 0, 0, 0, 0, 0];
      for (const s of path) for (let i = 0; i + 3 < s.length; i += 2) { const x0 = s[i], y0 = s[i + 1], x1 = s[i + 2], y1 = s[i + 3], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * hw, ny = (dx / l) * hw, ex = this.lineCap === 'butt' ? 0 : (dx / l) * hw * 0.6, ey = this.lineCap === 'butt' ? 0 : (dy / l) * hw * 0.6;
        p[0] = x0 - nx - ex; p[1] = y0 - ny - ey; p[2] = x1 - nx + ex; p[3] = y1 - ny + ey; p[4] = x0 + nx - ex; p[5] = y0 + ny - ey; p[6] = x1 + nx + ex; p[7] = y1 + ny + ey; quadPts(rec, p, 1, 0, 3, 16, col); }
    },
    fill() {
      const c = parseColour(this.fillStyle), col = pack(c[0], c[1], c[2], c[3] * this.globalAlpha); setBlend(this.globalCompositeOperation);
      for (const s of path) {
        if (s.circle) { const [x, y, rx, ry, rot, M] = s.circle, keep = T; T = M; this.save(); T = M.slice(); const cr = Math.cos(rot), sr = Math.sin(rot); this.transform(cr, sr, -sr, cr, x, y); quad(texture(disc), -rx, -ry, rx, ry, 0, 0, 64, 64, col); this.restore(); T = keep; continue; }
        const rec = texture(solid), p = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 2; i + 3 < s.length; i += 2) { p[0] = s[0]; p[1] = s[1]; p[2] = s[i]; p[3] = s[i + 1]; p[4] = s[i + 2]; p[5] = s[i + 3]; p[6] = s[i + 2]; p[7] = s[i + 3]; quadPts(rec, p, 1, 1, 3, 3, col); }
      }
    },
    // not drawn by the art module in a frame; present so a stray call does not throw
    fillText() { stats.unsupported.fillText = (stats.unsupported.fillText || 0) + 1; }, strokeText() {}, measureText: (t) => ({ width: String(t).length * 6 }), setLineDash() {}, clip() { stats.unsupported.clip = (stats.unsupported.clip || 0) + 1; },
    createLinearGradient() { stats.unsupported.gradient = (stats.unsupported.gradient || 0) + 1; return { addColorStop() {} }; }, createRadialGradient() { return this.createLinearGradient(); },
    getImageData() { throw new Error('glctx: getImageData is not supported'); },

    // ---- beyond Canvas 2D
    flush() { flush('end'); },
    /** upload an image now (when a loader has it, between frames), not on its first draw in the middle of a fight: a large
     *  ImageBitmap's first upload measured 26 to 265 ms in the real page (render spike, Round 7). No-op when lost. */
    prewarm(img) { if (lost || !img || !img.width) return; flush('prewarm'); texture(img); },
    /** run f once this frame's drawing has been flushed (offscreen passes: the ink's simulation) */
    afterFrame(f) { afterQ.push(f); if (!scheduled) frameStart(); },
    /** draw into a framebuffer (null: the canvas). The y axis is flipped for a framebuffer so its texture reads upright. */
    target(fb, w, h) { flush('target'); fbNow = fb || null; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); W = w || canvas.width; H = h || canvas.height; flip = fb ? -1 : 1; gl.viewport(0, 0, W, H); },
    /** call when a frame starts with passes of one's own before any sprite (so its GPU time is counted) */
    frame() { if (!scheduled) frameStart(); },
    renderer: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); })(),
    begin() { W = canvas.width; H = canvas.height; gl.viewport(0, 0, W, H); },
    get lost() { return lost; },
    /** for context.js: the context was lost (drawing is dropped) or has come back (everything is made again) */
    _lost() { lost = true; nq = 0; nUnits = 0; qNow = null; gpuQ.length = 0; },
    _restored() { lost = false; setup(); bound.fill(null); nq = 0; nUnits = 0; gen++; fbNow = null; this.generation++; for (const f of restoreFns) try { f(gl); } catch (e) { console.warn('glctx: an effect could not be rebuilt', e); } },
    onRestore(f) { restoreFns.push(f); },
    /** limit drawing to the device-px rectangle [x0, y0, x1, y1] (y down), or null for the whole target */
    scissor(r) { flush('scissor'); if (!r) { gl.disable(gl.SCISSOR_TEST); return; } const x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.ceil(r[2]), y1 = Math.ceil(r[3]);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, fbNow ? y0 : H - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0)); },
    invalidate(img) { const r = texOf.get(img); if (r) r.dirty = true; },
    textureOf: (img) => texture(img).tex,
  };
  return ctx;
}
