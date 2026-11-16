/*
 * hic.js: a small engine for HTML-in-Canvas pages. No dependencies. A module for its side effect: it sets window.HIC
 * (the board's scene, hand and paint files share a few globals, as they do in lab/html-in-canvas/05-impasto).
 *
 * The page is written as ordinary HTML: a #stage that holds one or more "layers". Where the browser can draw HTML
 * into a canvas (Chrome and Edge 157+), HIC.start() moves the layers into one full-window WebGL canvas, keeps a live
 * texture of each layer, and calls the scene every frame to draw them with its own shaders. The layers stay real
 * DOM: the engine keeps telling the browser where each one is drawn, so hover, clicks, selection and the caret land
 * on the words the reader sees. Where the browser cannot, nothing is moved and the page stays the HTML it was
 * written as: <html class="flat">.
 *
 *   const app = HIC.start({
 *     layers: [document.getElementById('page')],      // or [{el, mips: true}]
 *     scene: {
 *       init(app) {},                // once, GL is ready: compile programs
 *       resize(app) {},              // the window changed size
 *       picture(app, layer) {},      // a layer has a new picture (layer.ver went up)
 *       frame(app) {},               // draw; app.time, app.dt, app.ptr, app.view, app.layers
 *       unproject(layer, x, y) {},   // optional: window point -> the layer point drawn there, or null
 *     },
 *   });
 *
 * Coordinates. Everything a scene handles is in CSS px with y down, origin at the window's top-left. Layer textures
 * and render targets both have their first row at the top, so `texture(t, p / size)` with p in y-down px is right
 * for either. Shaders get p from fragPx() (target px) or stagePx() (CSS px).
 *
 * Test hooks in the address: #flat (plain page), #stats (frame times), #still (no idle motion).
 */
(function () {
'use strict';

const HIC = window.HIC = {};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mix = (a, b, t) => a + (b - a) * t;
HIC.clamp = clamp;
HIC.mix = mix;
HIC.smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const HASH = () => location.hash.slice(1).split(/[&,]/);
// #flat / #stats / #still in the address, or ?fx=off for the plain page
const flag = name => HASH().includes(name) || (name === 'flat' && new URLSearchParams(location.search).get('fx') === 'off');

/* ================================================================== detection */

// Support is decided by probing for the feature, never by browser name or version. Two generations of the API
// exist: the current one (<canvas content="drawable">, texElementSubImage2D, updateElementGeometry) and an earlier
// one (<canvas layoutsubtree>, texElementImage2D) that some Chromium builds before 157 have switched on.
HIC.features = function () {
  const f = { markup: null, paint: false, geometry: false, webgl: null };
  try {
    const proto = name => (window[name] && window[name].prototype) || null;
    const cp = proto('HTMLCanvasElement');
    const probe = document.createElement('canvas');
    probe.setAttribute('content', 'drawable');
    if (probe.content === 'drawable') f.markup = 'drawable';
    else if (cp && 'layoutSubtree' in cp) f.markup = 'layoutsubtree';
    f.paint = !!cp && 'requestPaint' in cp;
    f.geometry = !!cp && 'updateElementGeometry' in cp;
    const gp = proto('WebGL2RenderingContext');
    if (gp) f.webgl = 'texElementSubImage2D' in gp ? 'texElementSubImage2D' : 'texElementImage2D' in gp ? 'texElementImage2D' : null;
  } catch (error) { /* an exotic browser: treat as unsupported */ }
  return f;
};
HIC.supported = function () {
  const f = HIC.features();
  return !!(f.markup && f.paint && f.webgl);
};

/* ================================================================== shader library */

// Put in front of every shader. The part after //@fragment is left out of vertex shaders.
const LIB = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uRes;     // size of the target being drawn, px
uniform vec2 uView;    // stage size, CSS px
uniform float uK;      // target px per CSS px
uniform float uFlip;   // 1 when the target is the screen (GL has y up there)
uniform float uTime;   // seconds
uniform vec4 uPtr;     // pointer: xy in CSS px (eased), z = 1 while over the page, w = 1 while pressed
uniform float uDark;   // 1 on the dark board

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0., amp = .5;
  for (int i = 0; i < 5; i++) { sum += amp * vnoise(p); p = p * 2.03 + 17.7; amp *= .5; }
  return sum;
}
vec3 toLinear(vec3 c) { return pow(max(c, 0.), vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.), vec3(1. / 2.2)); }
// a point in target px (y down) -> clip space, for vertex shaders
vec4 toClip(vec2 px) { vec2 c = px / uRes * 2. - 1.; c.y *= mix(1., -1., uFlip); return vec4(c, 0., 1.); }
//@fragment
out vec4 o;
// this fragment, in target px with y down, and in CSS px of the stage
vec2 fragPx() { return vec2(gl_FragCoord.x, mix(gl_FragCoord.y, uRes.y - gl_FragCoord.y, uFlip)); }
vec2 stagePx() { return fragPx() / uK; }
`;
const LIB_VERTEX = LIB.split('//@fragment')[0];
const FULLSCREEN_VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}';
HIC.LIB = LIB;

// name -> [internal format, format, type]
const FORMATS = {
  rgba8: ['RGBA8', 'RGBA', 'UNSIGNED_BYTE'],
  rgba16f: ['RGBA16F', 'RGBA', 'HALF_FLOAT'],
  rg16f: ['RG16F', 'RG', 'HALF_FLOAT'],
  r16f: ['R16F', 'RED', 'HALF_FLOAT'],
  r8: ['R8', 'RED', 'UNSIGNED_BYTE'],
};

/* ================================================================== start */

HIC.start = function (options) {
  const scene = options.scene || {};
  const root = document.documentElement;
  const stage = options.stage || document.getElementById('stage');
  const minWidth = options.minWidth || 900;
  const minHeight = options.minHeight || 560;
  const pixelBudget = options.pixelBudget || 5.2e6;
  const reduced = !!window.__boardStill || matchMedia('(prefers-reduced-motion: reduce)').matches || flag('still');

  const layers = (options.layers || []).map((entry, index) => {
    const layer = entry.nodeType ? { el: entry } : Object.assign({}, entry);
    layer.id = layer.el.id || 'layer' + index;
    layer.index = index;
    layer.tex = null;
    layer.ver = 0;       // goes up with every new picture
    layer.need = true;
    layer.w = layer.h = 0;   // texture size, px
    layer.M = null;      // the matrix the layer is placed with: element px -> window px
    return layer;
  });

  const view = { W: 1, H: 1, dpr: 1, k: 1, pw: 1, ph: 1 };
  const ptr = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, vx: 0, vy: 0, in: false, down: false, moved: 0, type: 'mouse' };
  const diag = { mode: 'boot', why: '', api: 'none', uploads: 0, paints: 0, log: [] };
  const app = { options, scene, stage, layers, view, ptr, diag, reduced, time: 0, dt: 0, frameCount: 0, live: false };
  HIC.app = app;

  function note(message) {
    diag.log.push(String(message));
    if (flag('stats') || window.__test) console.log('hic:', message);
  }
  app.note = note;

  let canvas = null;
  let gl = null;
  let g = null;
  let rafId = 0;
  let lastNow = 0;
  let watchdog = 0;

  /* ---------------------------------------------------------------- flat: the plain page */

  function goFlat(why) {
    if (diag.mode === 'flat') return;
    diag.mode = 'flat';
    diag.why = why;
    app.live = false;
    note('flat: ' + why);
    cancelAnimationFrame(rafId);
    rafId = 0;
    clearTimeout(watchdog);
    if (canvas) {
      for (const layer of layers) {
        layer.el.removeAttribute('drawable');
        layer.el.style.transform = '';
        layer.el.style.pointerEvents = '';
        stage.appendChild(layer.el);
      }
      canvas.style.display = 'none';
    }
    stage.style.display = '';
    root.classList.remove('gl');
    root.classList.add('flat');
    root.dataset.flat = why;
    if (options.onMode) options.onMode('flat', why);
  }

  function goLive() {
    if (diag.mode === 'live' || !gl) return;
    diag.mode = 'live';
    diag.why = '';
    app.live = true;
    canvas.style.display = 'block';
    stage.style.display = 'none';   // empty while the canvas holds the layers; it must not sit over the canvas
    for (const layer of layers) {
      layer.el.setAttribute('drawable', '');
      layer.need = true;
      layer.M = null;
      layer.lastM = '';
      canvas.appendChild(layer.el);
    }
    root.classList.remove('flat');
    root.classList.add('gl');
    delete root.dataset.flat;
    sizeCanvas();
    canvas.requestPaint();
    lastNow = 0;
    if (!rafId) rafId = requestAnimationFrame(tick);
    if (options.onMode) options.onMode('live', '');
  }

  // what the reader chose with the "effects" switch; null = no choice, the page decides
  let wanted = null;
  app.setEffects = function (on) {
    wanted = on;
    decideMode();
  };
  app.effects = () => diag.mode === 'live';

  function fits() {
    return innerWidth >= minWidth && innerHeight >= minHeight;
  }
  function decideMode() {
    if (!gl) return;
    if (diag.why === 'context lost' || diag.why === 'no picture' || diag.why === 'error') return;   // broken: stay flat
    if (wanted === false) goFlat('off');
    else if (!fits()) goFlat('small');
    else goLive();
  }

  /* ---------------------------------------------------------------- can we run at all */

  if (!stage || !layers.length) { root.classList.add('flat'); return null; }
  const features = HIC.features();
  if (flag('flat')) { root.classList.add('flat'); root.dataset.flat = 'forced'; diag.mode = 'flat'; diag.why = 'forced'; return app; }
  if (!(features.markup && features.paint && features.webgl)) {
    root.classList.add('flat');
    root.dataset.flat = 'unsupported';
    diag.mode = 'flat';
    diag.why = 'unsupported';
    return app;
  }

  canvas = document.createElement('canvas');
  canvas.id = 'hic';
  canvas.setAttribute('content', 'drawable');
  canvas.setAttribute('layoutsubtree', '');
  canvas.setAttribute('aria-label', document.title);
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;display:none;outline:none;z-index:0';
  stage.parentNode.insertBefore(canvas, stage);
  app.canvas = canvas;

  try {
    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: true, premultipliedAlpha: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: !!options.preserve,
    });
  } catch (error) { note('webgl: ' + error); }
  const currentApi = gl && typeof gl.texElementSubImage2D === 'function' && typeof canvas.updateElementGeometry === 'function';
  const earlierApi = gl && typeof gl.texElementImage2D === 'function';
  if (!gl || !(currentApi || earlierApi) || typeof canvas.requestPaint !== 'function') {
    canvas.remove();
    canvas = null;
    root.classList.add('flat');
    root.dataset.flat = 'unsupported';
    diag.mode = 'flat';
    diag.why = 'unsupported';
    return app;
  }
  diag.api = currentApi ? 'current' : 'earlier';
  app.gl = gl;
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  /* ---------------------------------------------------------------- GL helpers: the `g` object scenes use */

  let base = {};   // uniforms every program gets

  function compile(vertexSource, fragmentSource, name) {
    const program = gl.createProgram();
    const shaders = [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]].map(([type, source]) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      return shader;
    });
    gl.linkProgram(program);
    return { p: program, shaders, u: null, ok: null, name: name || '', unit: 0 };
  }

  // Checks a program on first use and reads its uniforms. Throws with the compiler's message if it failed.
  function ready(P) {
    if (P.ok !== null) return P;
    if (!gl.getProgramParameter(P.p, gl.LINK_STATUS)) {
      const log = P.shaders.map(s => gl.getShaderInfoLog(s) || '').join('') + (gl.getProgramInfoLog(P.p) || '');
      P.ok = false;
      note('shader ' + P.name + ': ' + log);
      throw new Error('shader ' + P.name + ': ' + log.slice(0, 900));
    }
    P.ok = true;
    P.u = {};
    const count = gl.getProgramParameter(P.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(P.p, i);
      P.u[info.name.replace('[0]', '')] = { l: gl.getUniformLocation(P.p, info.name), t: info.type, array: info.name.endsWith('[0]') };
    }
    return P;
  }

  function setUniform(P, name, value) {
    const u = P.u[name];
    if (!u || value === undefined || value === null) return;
    switch (u.t) {
      case gl.FLOAT: if (u.array) gl.uniform1fv(u.l, value); else gl.uniform1f(u.l, value); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.l, value); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.l, value); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.l, value); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(u.l, value); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.l, false, value); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.l, false, value); break;
      case gl.SAMPLER_2D:
        gl.activeTexture(gl.TEXTURE0 + P.unit);
        gl.bindTexture(gl.TEXTURE_2D, value.tex || value);   // a layer, a render target or a raw texture
        gl.uniform1i(u.l, P.unit++);
        break;
    }
  }

  function makeBuffer(w, h, opts) {
    const format = FORMATS[opts.fmt || 'rgba8'];
    const filter = opts.linear === false ? gl.NEAREST : gl.LINEAR;
    const wrap = opts.wrap === 'repeat' ? gl.REPEAT : opts.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    const levels = opts.mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl[format[0]], w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const buffer = { tex, fb, db: null };
    if (opts.depth) {
      buffer.db = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, buffer.db);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, buffer.db);
    }
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | (opts.depth ? gl.DEPTH_BUFFER_BIT : 0));
    return buffer;
  }
  function freeBuffer(buffer) {
    if (!buffer) return;
    gl.deleteTexture(buffer.tex);
    gl.deleteFramebuffer(buffer.fb);
    if (buffer.db) gl.deleteRenderbuffer(buffer.db);
  }

  function bindTarget(target) {
    if (target) {
      const buffer = target.b ? target.b : target.a;   // a double target is written into its back buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fb);
      gl.viewport(0, 0, target.w, target.h);
      base.uRes = [target.w, target.h];
      base.uK = target.w / view.W;
      base.uFlip = 0;
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, view.pw, view.ph);
      base.uRes = [view.pw, view.ph];
      base.uK = view.k;
      base.uFlip = 1;
    }
  }

  // g.clip = [x0, y0, x1, y1] (window px, from the top left) keeps draws onto the screen inside that box, for a scene
  // that redraws only the part of the picture that changed (the context then needs options.preserve)
  function applyState(state, onScreen) {
    const s = state || {};
    if (onScreen && g.clip) {
      const k = view.k, c = g.clip, x = Math.max(0, Math.floor(c[0] * k)), y = Math.max(0, Math.floor(view.ph - c[3] * k));
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, y, Math.max(0, Math.ceil(c[2] * k) - x), Math.max(0, Math.ceil(view.ph - c[1] * k) - y));
    } else gl.disable(gl.SCISSOR_TEST);
    if (s.blend === 'add') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
    else if (s.blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }   // premultiplied
    else gl.disable(gl.BLEND);
    if (s.depth) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); } else gl.disable(gl.DEPTH_TEST);
    if (s.cull) { gl.enable(gl.CULL_FACE); gl.cullFace(s.cull === 'front' ? gl.FRONT : gl.BACK); } else gl.disable(gl.CULL_FACE);
  }

  g = app.g = {
    gl,
    LIB,
    ready,
    aniso,

    /* a fragment program for full-target passes; the library is put in front */
    prog(fragmentSource, name) { return compile(FULLSCREEN_VS, LIB + fragmentSource, name); },

    /* a program with its own vertex shader, for geometry. Vertex shaders get the library too (toClip, noise). */
    mesh(vertexSource, fragmentSource, name) { return compile(LIB_VERTEX + vertexSource, LIB + fragmentSource, name); },

    /* render target. opts: fmt ('rgba8', 'rgba16f', 'rg16f', 'r16f', 'r8'), double (two buffers that swap after a
       pass), linear (default true), mips, wrap ('repeat', 'mirror'), depth */
    rt(w, h, opts = {}) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      const first = makeBuffer(w, h, opts);
      const second = opts.double ? makeBuffer(w, h, opts) : null;
      return {
        w, h, opts, a: first, b: second, fresh: true,
        get tex() { return this.a.tex; },
        swap() { const t = this.a; this.a = this.b; this.b = t; },
        mip() { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.a.tex); gl.generateMipmap(gl.TEXTURE_2D); },
        clear(r = 0, gr = 0, b = 0, a = 0) {
          for (const buffer of [this.a, this.b]) {
            if (!buffer) continue;
            gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fb);
            gl.viewport(0, 0, w, h);
            gl.disable(gl.SCISSOR_TEST);
            gl.clearColor(r, gr, b, a);
            gl.clear(gl.COLOR_BUFFER_BIT | (opts.depth ? gl.DEPTH_BUFFER_BIT : 0));
          }
        },
        free() { freeBuffer(first); freeBuffer(second); },
      };
    },

    /* keep a target, or remake it when the wanted size changed: s.A = g.fit(s.A, w, h, opts). A.fresh tells which. */
    fit(target, w, h, opts) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      if (target && target.w === w && target.h === h) { target.fresh = false; return target; }
      if (target) target.free();
      return g.rt(w, h, opts);
    },

    /* a texture from data (Uint8Array / Float32Array) or an image. opts: fmt, mips, linear, wrap ('clamp') */
    texture(source, w, h, opts = {}) {
      const format = FORMATS[opts.fmt || 'rgba8'];
      const filter = opts.linear === false ? gl.NEAREST : gl.LINEAR;
      const wrap = opts.wrap === 'clamp' ? gl.CLAMP_TO_EDGE : gl.REPEAT;
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (ArrayBuffer.isView(source) || source === null) gl.texImage2D(gl.TEXTURE_2D, 0, gl[format[0]], w, h, 0, gl[format[1]], gl[format[2]], source);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (opts.mips) gl.generateMipmap(gl.TEXTURE_2D);
      return { tex, w, h };
    },

    /* use a program: the engine's uniforms first, then the caller's */
    uniforms(P, values) {
      ready(P);
      gl.useProgram(P.p);
      P.unit = 0;
      for (const name in base) setUniform(P, name, base[name]);
      for (const name in values) setUniform(P, name, values[name]);
    },

    /* full-target pass into a render target (a double target swaps afterwards). state: {blend} */
    pass(P, target, values, state) {
      bindTarget(target);
      applyState(state);
      g.uniforms(P, values);
      gl.bindVertexArray(g.vao0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (target.b) target.swap();
    },

    /* full-window pass onto the screen. state: {blend} */
    screen(P, values, state) {
      bindTarget(null);
      applyState(state, true);
      g.uniforms(P, values);
      gl.bindVertexArray(g.vao0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    /* geometry into a target (null = the screen). what: {vao, mode, count, instances, indexed}; state: {blend, depth, cull} */
    draw(P, target, what, values, state) {
      bindTarget(target);
      applyState(state, !target);
      g.uniforms(P, values);
      gl.bindVertexArray(what.vao);
      const mode = what.mode === undefined ? gl.TRIANGLES : what.mode;
      if (what.indexed) {
        if (what.instances) gl.drawElementsInstanced(mode, what.count, what.indexType || gl.UNSIGNED_SHORT, 0, what.instances);
        else gl.drawElements(mode, what.count, what.indexType || gl.UNSIGNED_SHORT, 0);
      } else if (what.instances) gl.drawArraysInstanced(mode, 0, what.count, what.instances);
      else gl.drawArrays(mode, 0, what.count);
      if (target && target.b && !(state && state.keep)) target.swap();
    },

    /* clear a target (null = the screen) */
    clear(target, r = 0, gr = 0, b = 0, a = 1, depth = true) {
      bindTarget(target);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(r, gr, b, a);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | (depth ? gl.DEPTH_BUFFER_BIT : 0));
    },

    /* a vertex array. attributes: [{name, size, data (Float32Array) | buffer, stride, offset, divisor}] bound to the
       locations of program P; index: Uint16Array. Returns {vao, buffers}. */
    geometry(P, attributes, index) {
      ready(P);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffers = [];
      for (const a of attributes) {
        let buffer = a.buffer;
        if (!buffer) {
          buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, a.data, a.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        } else gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        buffers.push(buffer);
        const location = gl.getAttribLocation(P.p, a.name);
        if (location < 0) continue;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, a.size, gl.FLOAT, false, a.stride || 0, a.offset || 0);
        if (a.divisor) gl.vertexAttribDivisor(location, a.divisor);
      }
      let indexBuffer = null;
      if (index) {
        indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
      }
      gl.bindVertexArray(null);
      return { vao, buffers, indexBuffer };
    },

    /* refill a buffer made by geometry() */
    update(buffer, data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    },
  };
  g.vao0 = gl.createVertexArray();

  // A separable gaussian blur, for scenes: g.blur(source, target, sigma). Sigma in target texels (up to about 8);
  // the source may be any size, so this also downsamples.
  let blurProgram = null;
  g.blur = function (source, target, radius) {
    if (!blurProgram) {
      blurProgram = g.prog(`
uniform sampler2D uSrc;
uniform vec2 uDir;      // one texel step, in uv, along the blur
uniform float uSigma;   // in steps
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 sum = texture(uSrc, uv);
  float total = 1.;
  for (int i = 1; i <= 12; i++) {
    float x = float(i) * 2. - .5;                  // pairs of texels, sampled between them
    float w = exp(-.5 * x * x / (uSigma * uSigma)) * 2.;
    sum += (texture(uSrc, uv + uDir * x) + texture(uSrc, uv - uDir * x)) * w;
    total += 2. * w;
  }
  o = sum / total;
}`, 'blur');
    }
    const scratch = target.scratch = g.fit(target.scratch, target.w, target.h, target.opts.double ? Object.assign({}, target.opts, { double: false }) : target.opts);
    const sigma = Math.max(.6, radius);
    g.pass(blurProgram, scratch, { uSrc: source, uDir: [1 / target.w, 0], uSigma: sigma });
    g.pass(blurProgram, target, { uSrc: scratch, uDir: [0, 1 / target.h], uSigma: sigma });
  };

  /* ---------------------------------------------------------------- size */

  let devicePx = null;   // [w, h] of the canvas in device pixels, when the browser reports it
  if (typeof ResizeObserver === 'function') {
    const boxed = typeof ResizeObserverEntry !== 'undefined' && 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;
    const observer = new ResizeObserver(([entry]) => {
      const size = entry.devicePixelContentBoxSize && entry.devicePixelContentBoxSize[0];
      const next = size ? [size.inlineSize, size.blockSize] : null;
      const changed = !next !== !devicePx || (next && (next[0] !== devicePx[0] || next[1] !== devicePx[1]));
      devicePx = next;
      if (changed && diag.mode === 'live') { sizeCanvas(); canvas.requestPaint(); }
    });
    try { observer.observe(canvas, boxed ? { box: 'device-pixel-content-box' } : {}); } catch (error) { observer.observe(canvas); }
  }

  function sizeCanvas() {
    view.W = root.clientWidth || innerWidth;
    view.H = innerHeight;
    view.dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
    const scale = Math.min(view.dpr, Math.sqrt(pixelBudget / (view.W * view.H)));
    // The grid matches the device pixels the canvas covers (reported by the resize observer below), so the picture
    // is not resampled at any zoom; over the pixel budget it is a whole fraction of them.
    // (Used only when it agrees with devicePixelRatio to within rounding: under device emulation the two differ.)
    const real = devicePixelRatio || 1;
    const exact = devicePx && scale >= real - 1e-3 && Math.abs(devicePx[0] - view.W * real) <= 2 && Math.abs(devicePx[1] - view.H * real) <= 2;
    const w = exact ? devicePx[0] : Math.max(2, Math.round(view.W * scale));
    const h = exact ? devicePx[1] : Math.max(2, Math.round(view.H * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    view.pw = w;
    view.ph = h;
    view.k = w / view.W;
    for (const layer of layers) { layer.need = true; layer.lastM = ''; }
    if (app.live && scene.resize) guard('resize', () => scene.resize(app));
  }

  /* ---------------------------------------------------------------- pictures of the layers */

  const uploads = { sizeOption: null, signature: 3 };

  function finishUpload(layer, w, h) {
    // a layer with lazyMips set (by the scene) keeps a plain picture while it is drawn 1:1; app.freshMips builds
    // the mip chain when the scene is about to draw it smaller
    layer.staleMips = !!(layer.mips && layer.lazyMips);
    if (layer.mips && !layer.staleMips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    layer.w = w;
    layer.h = h;
    layer.ver++;
    layer.need = false;
    diag.uploads++;
  }

  app.freshMips = function (layer) {
    if (!layer.staleMips || !layer.tex) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    layer.staleMips = false;
  };

  function allocate(layer, w, h) {
    const key = w + 'x' + h;
    if (layer.allocated === key) return;
    layer.allocated = key;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  function upload(layer) {
    if (!layer.tex) layer.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // the layer's own CSS size (layout size: transforms do not count), at the canvas's pixel scale
    const cssW = layer.el.offsetWidth || view.W;
    const cssH = layer.el.offsetHeight || view.H;
    layer.cw = cssW;
    layer.ch = cssH;
    const scale = Math.min(view.k * (layer.raster || 1), 4096 / Math.max(cssW, cssH));
    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    try {
      if (diag.api === 'current') {
        let done = false;
        if (uploads.sizeOption !== false) {
          // ask for the picture at exactly our size; the first call finds out whether the browser takes the option
          allocate(layer, w, h);
          const probing = uploads.sizeOption === null;
          try {
            if (probing) while (gl.getError()) { /* drain */ }
            gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, layer.el, { width: w, height: h });
            done = !probing || gl.getError() === 0;
            if (probing) uploads.sizeOption = done;
          } catch (error) {
            if (error instanceof TypeError || probing) uploads.sizeOption = false; else throw error;
          }
          if (done) finishUpload(layer, w, h);
        }
        if (!done) {
          const size = canvas.getElementImageDefaultSize ? canvas.getElementImageDefaultSize(layer.el) : { width: w, height: h };
          const dw = Math.max(1, Math.round(size.width));
          const dh = Math.max(1, Math.round(size.height));
          allocate(layer, dw, dh);
          gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, layer.el);
          finishUpload(layer, dw, dh);
        }
      } else {
        // the earlier API: the browser picks the size. Not testable in Chrome 157; kept on a best-effort basis.
        if (uploads.signature === 3) {
          try { gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, layer.el); }
          catch (error) { if (error instanceof TypeError) uploads.signature = 6; else throw error; }
        }
        if (uploads.signature === 6) gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, layer.el);
        layer.allocated = '';
        finishUpload(layer, Math.round(cssW * devicePixelRatio), Math.round(cssH * devicePixelRatio));
      }
    } catch (error) {
      if (diag.uploadError !== String(error)) { diag.uploadError = String(error); note('upload ' + layer.id + ': ' + error); }
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  // The browser tells us which layers changed; this is the only moment their pictures can be taken.
  function onPaint(event) {
    diag.paints++;
    if (diag.mode !== 'live') return;
    const changed = event.changedElements ? new Set(event.changedElements) : null;
    for (const layer of layers) {
      if (!changed || changed.has(layer.el)) layer.need = true;
      if (layer.need) {
        upload(layer);
        if (!layer.need && scene.picture) guard('picture', () => scene.picture(app, layer));
      }
    }
  }

  /* a scene changed a layer's HTML and wants its picture now (the browser also notices by itself) */
  app.dirty = function (layer) {
    if (layer) layer.need = true; else for (const l of layers) l.need = true;
    if (diag.mode === 'live') canvas.requestPaint();
  };

  /* ---------------------------------------------------------------- hit geometry: where the words are */

  function setMatrix(layer, m) {
    const key = m.map(v => +v.toFixed(4)).join();
    if (key === layer.lastM) return;
    layer.lastM = key;
    layer.M = m;
    try {
      if (diag.api === 'current') canvas.updateElementGeometry(layer.el, { canvasTransform: new DOMMatrix(m) });
      else layer.el.style.transform = `matrix(${key})`;
    } catch (error) {
      if (!diag.geometryError) { diag.geometryError = String(error); note('geometry: ' + error); }
    }
  }

  /* Run fn with every layer's HTML laid flat where its own layout has it, so that client rects taken inside fn are
     the layout's (a scene that tilts its layers otherwise hands back their boxes in the tilted fit). The next frame
     puts the HTML back under the picture. */
  app.plainGeometry = function (fn) {
    if (diag.mode === 'live') for (const layer of layers) setMatrix(layer, [1, 0, 0, 1, layer.el.offsetLeft || 0, layer.el.offsetTop || 0]);
    return fn();
  };

  function unprojectSafe(layer, x, y) {
    let point = null;
    try { point = scene.unproject(layer, x, y, app); } catch (error) {
      if (!diag.unprojectError) { diag.unprojectError = String(error); note('unproject: ' + error); }
    }
    if (!point || !isFinite(point[0] + point[1])) return null;
    return point;
  }

  // Each frame: place every layer's HTML where it is drawn. A scene that bends or moves a layer gives unproject();
  // around the pointer we fit a local affine map from a few unproject calls and place the HTML with its inverse,
  // so the letter drawn under the pointer is the letter the browser finds there.
  function syncGeometry() {
    if (!scene.unproject) {
      for (const layer of layers) setMatrix(layer, [1, 0, 0, 1, layer.el.offsetLeft || 0, layer.el.offsetTop || 0]);
      return;
    }
    if (ptr.down) return;   // while a press lasts the map stays put, so a drag selects along the words it started on
    const x = ptr.x;
    const y = ptr.y;
    let hovered = null;
    let centre = null;
    for (let i = layers.length - 1; i >= 0 && !hovered; i--) {
      const layer = layers[i];
      const point = unprojectSafe(layer, x, y);
      if (point && point[0] >= 0 && point[1] >= 0 && point[0] <= (layer.cw || view.W) && point[1] <= (layer.ch || view.H)) {
        hovered = layer;
        centre = point;
      }
    }
    for (const layer of layers) {
      const events = !hovered || layer === hovered ? 'auto' : 'none';
      if (layer.events !== events) { layer.events = events; layer.el.style.pointerEvents = events; }
      if (layer !== hovered) {
        const rest = scene.rest ? scene.rest(layer, app) : null;
        if (rest) setMatrix(layer, rest); else if (!layer.M) setMatrix(layer, [1, 0, 0, 1, 0, 0]);
        continue;
      }
      // Jacobian of window -> element around the pointer, by central differences
      const h = 1.5;
      const right = unprojectSafe(layer, x + h, y), left = unprojectSafe(layer, x - h, y);
      const below = unprojectSafe(layer, x, y + h), above = unprojectSafe(layer, x, y - h);
      let a = 1, b = 0, c = 0, d = 1;
      if (right && left) { a = (right[0] - left[0]) / (2 * h); b = (right[1] - left[1]) / (2 * h); }
      if (below && above) { c = (below[0] - above[0]) / (2 * h); d = (below[1] - above[1]) / (2 * h); }
      let det = a * d - b * c;
      if (!isFinite(det) || Math.abs(det) < .02) { a = d = 1; b = c = 0; det = 1; }
      // its inverse maps element -> window, which is what the browser wants
      const A = d / det, B = -b / det, C = -c / det, D = a / det;
      setMatrix(layer, [A, B, C, D, x - A * centre[0] - C * centre[1], y - B * centre[0] - D * centre[1]]);
    }
  }

  /* window point -> a layer's own px, undoing the matrix it is currently placed with */
  app.toLocal = function (layer, x, y) {
    const m = layer.M || [1, 0, 0, 1, 0, 0];
    const det = m[0] * m[3] - m[1] * m[2] || 1;
    const dx = x - m[4], dy = y - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (m[0] * dy - m[1] * dx) / det];
  };

  /* [x, y, w, h] of a descendant in its layer's px, whatever matrix the layer is placed with */
  app.box = function (layer, node) {
    let x = 0, y = 0;
    for (let n = node; n && n !== layer.el; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    if (!node.offsetParent && node.getBBox) {   // SVG content: go through client rects and the layer's matrix
      const r = node.getBoundingClientRect();
      const p = app.toLocal(layer, r.left, r.top), q = app.toLocal(layer, r.right, r.bottom);
      return [p[0], p[1], q[0] - p[0], q[1] - p[1]];
    }
    return [x, y, node.offsetWidth, node.offsetHeight];
  };

  /* ---------------------------------------------------------------- pointer */

  function onPointer(event) {
    ptr.x = event.clientX;
    ptr.y = event.clientY;
    ptr.type = event.pointerType || 'mouse';
    if (!ptr.in) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
    ptr.in = true;
    ptr.moved = performance.now();
  }
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', event => {
    onPointer(event);
    ptr.down = true;
    ptr.px = event.clientX;
    ptr.py = event.clientY;
    if (app.live && scene.press) guard('press', () => scene.press(app, event));
  }, { passive: true });
  addEventListener('pointerup', event => { ptr.down = false; if (app.live && scene.release) guard('release', () => scene.release(app, event)); }, { passive: true });
  addEventListener('pointercancel', () => { ptr.down = false; }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.in = false; });
  addEventListener('blur', () => { ptr.down = false; });

  /* ---------------------------------------------------------------- frames */

  const stats = { el: null, ms: 0, fps: 0, frames: 0, since: 0 };

  function guard(what, fn) {
    try { fn(); } catch (error) {
      note(what + ': ' + (error && error.stack || error));
      console.error(error);
      diag.why = '';
      goFlat('error');
    }
  }

  function tick(now) {
    rafId = 0;
    if (diag.mode !== 'live') return;
    rafId = requestAnimationFrame(tick);
    if (document.hidden) { lastNow = 0; return; }
    const dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : 1 / 60;
    lastNow = now;
    app.dt = dt;
    if (!app.clock) app.time += dt;
    const follow = 1 - Math.exp(-dt * 14);
    const oldX = ptr.sx, oldY = ptr.sy;
    ptr.sx += (ptr.x - ptr.sx) * follow;
    ptr.sy += (ptr.y - ptr.sy) * follow;
    if (Math.abs(ptr.x - ptr.sx) < .02 && Math.abs(ptr.y - ptr.sy) < .02) { ptr.sx = ptr.x; ptr.sy = ptr.y; }   // it arrives, so a scene can come to rest
    ptr.vx = mix(ptr.vx, (ptr.sx - oldX) / dt, .3);
    ptr.vy = mix(ptr.vy, (ptr.sy - oldY) / dt, .3);
    base.uView = [view.W, view.H];
    base.uTime = app.time;
    base.uDark = app.dark ? 1 : 0;
    base.uPtr = [ptr.sx, ptr.sy, ptr.in ? 1 : 0, ptr.down ? 1 : 0];
    if (!layers.every(layer => layer.ver)) return;   // no pictures yet
    const t0 = performance.now();
    guard('frame', () => {
      scene.frame(app);
      syncGeometry();
    });
    app.frameCount++;
    if (stats.el) {
      stats.ms = mix(stats.ms, performance.now() - t0, .1);
      stats.frames++;
      if (now - stats.since > 500) {
        stats.fps = stats.frames * 1000 / (now - stats.since);
        stats.frames = 0;
        stats.since = now;
        stats.el.textContent = `${stats.fps.toFixed(0)} fps · ${stats.ms.toFixed(1)} ms js · ${view.pw}×${view.ph} · ${diag.uploads} uploads · ${diag.api}`;
      }
    }
  }

  /* test hook: draw frames by hand at a fixed step, so stills are repeatable. HIC.app.step(60, 1 / 60) */
  app.step = function (count = 1, dt = 1 / 60) {
    app.clock = true;
    for (let i = 0; i < count; i++) {
      app.time += dt;
      app.dt = dt;
      base.uView = [view.W, view.H];
      base.uTime = app.time;
    base.uDark = app.dark ? 1 : 0;
      ptr.sx = ptr.x; ptr.sy = ptr.y;
      base.uPtr = [ptr.sx, ptr.sy, ptr.in ? 1 : 0, ptr.down ? 1 : 0];
      if (layers.every(layer => layer.ver)) guard('frame', () => { scene.frame(app); syncGeometry(); });
    }
  };

  /* ---------------------------------------------------------------- go */

  canvas.addEventListener('paint', onPaint);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); diag.why = ''; goFlat('context lost'); });
  addEventListener('resize', () => {
    if (!gl) return;
    decideMode();
    if (diag.mode === 'live') { sizeCanvas(); canvas.requestPaint(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => app.dirty());

  if (flag('stats')) {
    stats.el = document.createElement('pre');
    stats.el.style.cssText = 'position:fixed;left:10px;top:10px;margin:0;padding:6px 9px;background:rgba(0,0,0,.78);color:#9f9;font:11px/1.4 ui-monospace,monospace;z-index:99;pointer-events:none;border-radius:6px';
    document.body.appendChild(stats.el);
  }

  let initialised = false;
  guard('init', () => { if (scene.init) scene.init(app); initialised = true; });
  if (!initialised) return app;
  decideMode();

  // if no picture of the page ever arrives, show the plain page instead of an empty stage
  const watch = () => {
    watchdog = setTimeout(() => {
      if (document.hidden) { document.addEventListener('visibilitychange', watch, { once: true }); return; }
      if (diag.mode === 'live' && !diag.uploads) { diag.why = ''; goFlat('no picture'); }
    }, 3500);
  };
  watch();
  return app;
};

})();

export default window.HIC;
