// Full-screen and quad passes for effects that need WebGL2 beyond glctx's sprites: shaders, framebuffers, a copy of what is
// on the screen. Made from a glctx context (ctx.gl); everything is made again when a lost context comes back.
//
//   const post = createPost(ctx);
//   const P = post.program(fragmentSource [, vertexSource]);      // GLSL ES 3.00 bodies; post.LIB is a prelude with noise
//   const t = post.target(w, h, hdr);                                // {tex, fb, w, h}; hdr: half float when the GPU can render it
//   post.pass(P, t | null, [textures], (u) => { gl.uniform...(u.name, ...) }, blend);   // null: the screen
//   post.quad(P, [x0, y0, x1, y1] device px, [textures], set, blend, T);                  // a rectangle of the screen (or of target T, scaled)
//   const tex = post.grab([x0, y0, x1, y1]);                         // a copy of that part of the screen, as drawn so far
//
// Conventions: every texture here has row 0 at the TOP of the screen (glctx's framebuffer convention). In a shader, sp() is
// the fragment's position in device px from the top left, whatever the target; uRes the target's size; uDpr the pixel ratio.
// blend: null (replace), 'over' (premultiplied source-over), 'multiply' (dst * src), or [src, dst] factors.
export function createPost(ctx) {
  const gl = ctx.gl, made = [];
  let empty = gl.createVertexArray(), FLOAT = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const BL = { over: [gl.ONE, gl.ONE_MINUS_SRC_ALPHA], multiply: [gl.DST_COLOR, gl.ZERO] };
  function compile(fs, vs) {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('post: ' + gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('post: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function program(fs, vs = FULL_VS) { const P = { fs, vs }; Object.assign(P, compile(fs, vs)); made.push(['program', P]); return P; }
  function makeTarget(T) { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); const f = T.hdr && FLOAT;
    if (T.rgb) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, T.w, T.h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);      // a copy of an opaque screen (copyTexSubImage needs the screen's own channels)
    else gl.texImage2D(gl.TEXTURE_2D, 0, f ? gl.RGBA16F : gl.RGBA8, T.w, T.h, 0, gl.RGBA, f ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    T.tex = tex; T.fb = fb; return T; }
  function target(w, h, hdr = false) { const T = makeTarget({ w, h, hdr }); made.push(['target', T]); return T; }
  function free(T) { if (!T) return; gl.deleteTexture(T.tex); gl.deleteFramebuffer(T.fb); const i = made.findIndex((m) => m[1] === T); if (i >= 0) made.splice(i, 1); }
  function clear(T, r = 0, g = 0, b = 0, a = 0) { ctx.flush(); gl.bindFramebuffer(gl.FRAMEBUFFER, T ? T.fb : null); gl.viewport(0, 0, T ? T.w : ctx.canvas.width, T ? T.h : ctx.canvas.height); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  function begin(P, T, tex, set, blend, rect) {
    ctx.flush();
    const W = T ? T.w : ctx.canvas.width, H = T ? T.h : ctx.canvas.height;
    gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, T ? T.fb : null); gl.viewport(0, 0, W, H); gl.useProgram(P.p); gl.bindVertexArray(empty);
    for (let i = 0; i < tex.length; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); const nm = 'T' + i; if (P.u[nm]) gl.uniform1i(P.u[nm], i); }
    if (P.u.uRes) gl.uniform2f(P.u.uRes, W, H); if (P.u.uOut) gl.uniform1f(P.u.uOut, T ? 0 : 1); if (P.u.uDpr) gl.uniform1f(P.u.uDpr, ctx.canvas.clientWidth ? ctx.canvas.width / ctx.canvas.clientWidth : 1);
    if (P.u.uRect) gl.uniform4f(P.u.uRect, rect[0], rect[1], rect[2], rect[3]);
    if (set) set(P.u);
    const b = typeof blend === 'string' ? BL[blend] : blend;
    if (b) { gl.enable(gl.BLEND); gl.blendFuncSeparate(b[0], b[1], gl.ZERO, gl.ONE); } else gl.disable(gl.BLEND);
  }
  /** flush the sprites and make the screen the target, for a draw of one's own (instanced particles) */
  function screen() { ctx.flush(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height); }
  function end() { gl.enable(gl.BLEND); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  function pass(P, T, tex = [], set = null, blend = null) { begin(P, T, tex, set, blend, [0, 0, 0, 0]); gl.drawArrays(gl.TRIANGLES, 0, 3); end(); }
  // a quad covering the device-px rectangle r of the screen (QUAD_VS); off screen: nothing
  // T: into a target instead (r stays in the screen's device px, scaled to the target's size)
  function quad(P, r, tex = [], set = null, blend = null, T = null) { const W = ctx.canvas.width, H = ctx.canvas.height; if (r[2] < 0 || r[3] < 0 || r[0] > W || r[1] > H) return; const sx = T ? T.w / W : 1, sy = T ? T.h / H : 1; begin(P, T, tex, set, blend, T ? [r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy] : r); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); end(); }
  // a copy of part of the screen as drawn so far (for refraction): one texture the size of the screen, reused
  let grabT = null;
  function grab(r) {
    ctx.flush(); const W = ctx.canvas.width, H = ctx.canvas.height;
    if (!grabT || grabT.w !== W || grabT.h !== H) { if (grabT) free(grabT); const alpha = (gl.getContextAttributes() || {}).alpha; grabT = makeTarget({ w: W, h: H, rgb: !alpha }); made.push(['target', grabT]); }
    const x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(W, Math.ceil(r[2])), y1 = Math.min(H, Math.ceil(r[3]));
    if (x1 <= x0 || y1 <= y0) return grabT.tex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, grabT.tex);
    // the screen's row 0 is at its bottom; the copy keeps the screen's own rows, so it is read with the screen's y (see GRAB in LIB)
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, x0, H - y1, x0, H - y1, x1 - x0, y1 - y0);
    return grabT.tex;
  }
  ctx.onRestore(() => { empty = gl.createVertexArray(); FLOAT = !!gl.getExtension('EXT_color_buffer_float'); grabT = null;
    for (const [kind, o] of made) { if (kind === 'program') Object.assign(o, compile(o.fs, o.vs)); else makeTarget(o); } for (const f of after) f(); });
  const after = [];
  return { gl, program, target, free, clear, pass, quad, grab, screen, LIB, QUAD_VS, get hdr() { return FLOAT; }, onRestore: (f) => after.push(f) };
}

const FULL_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
// a rectangle of the screen, uRect = [x0, y0, x1, y1] device px from the top left; vQ runs 0..1 across it (y down)
const QUAD_VS = `#version 300 es
uniform vec4 uRect; uniform vec2 uRes; out vec2 vQ;
void main(){ vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1); vQ = c; vec2 p = mix(uRect.xy, uRect.zw, c);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0); }`;
const LIB = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uOut; uniform float uDpr;
out vec4 o;
vec2 sp(){ return vec2(gl_FragCoord.x, uOut > 0.5 ? uRes.y - gl_FragCoord.y : gl_FragCoord.y); }
// read a grab() copy at device px p (y down)
vec4 grabAt(sampler2D t, vec2 p){ return texture(t, vec2(p.x, uRes.y - p.y) / uRes); }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.875; }
const vec3 PAPER = vec3(239.0, 231.0, 214.0) / 255.0;
const vec3 K_INK = vec3(2.24, 2.50, 2.66);          // density 1 -> lacquer black #1B1512 on the paper
`;
