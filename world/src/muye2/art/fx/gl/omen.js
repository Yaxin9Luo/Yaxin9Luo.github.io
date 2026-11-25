// 天降异象: the sky of the scroll when a great one comes. WebGL2 only, over the figures, over the whole screen:
//   - a sky of let-down ink comes down from the top of the scroll, graded and uneven as a wash (the 祥云 over it are brush
//     cells, drawn by glfx's omenClouds); the field darkens toward its edges;
//   - lightning of his element's light strikes from the cloud to where he lands (jagged, forking, a white-hot core in a
//     halo), three or four times, each a flash;
//   - rays of that light fall through the gaps of the cloud;
//   - flakes of matte bronze-gold pigment drift down out of the cloud, a darker and a paler face as they turn.
// It lasts `life` seconds: the cloud rolls in over 0.45 s, holds, and draws back from 0.7 of the life.
const BOLT_PTS = 16, BOLTS = 4;
export function createOmen(post, Q = { tier: 2 }) {
  const gl = post.gl;
  const P = post.program(post.LIB + `
uniform sampler2D T0, T1; uniform float cAsp; uniform float k, life, dark; uniform vec2 at; uniform vec3 light; uniform vec2 bolt[${BOLTS * BOLT_PTS}]; uniform float boltOn[${BOLTS}]; uniform float seed, tier;
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main(){
  vec2 p = sp(), P = p / uDpr, S = uRes / uDpr, A = at / uDpr; float t = k;
  vec3 c = grabAt(T0, p).rgb;
  float inT = smoothstep(0.0, 0.45, t), outT = 1.0 - smoothstep(life * 0.7, life, t), env = inT * outT;
  // the field darkens toward its edges, a cool ink (the storm), so what breaks through shines
  vec2 v = (P / S - 0.5) * vec2(1.0, 1.25); c *= mix(vec3(1.0), vec3(0.6, 0.62, 0.68), dark * env * smoothstep(0.1, 0.8, length(v)));
  // (the rows below sample a blank texture since the cloud picture was withdrawn; they still set where the sky's edge lies) rows, the back rows darker, higher and
  // slower, tiled across the scroll (every other tile mirrored, so no seam); an ink sky above the back row; they part in a
  // hole above where he lands; their lower rims flare in his light when a bolt strikes near
  float hole = exp(-pow((P.x - A.x) / 190.0, 2.0)) * smoothstep(0.2, 0.6, t);
  float base = S.y * 0.36 * env;
  float flare = 0.0; for (int b = 0; b < ${BOLTS}; b++) flare += boltOn[b] * exp(-abs(P.x - bolt[b * ${BOLT_PTS} + ${BOLT_PTS - 1}].x) / 420.0);
  vec3 acc = vec3(0.0); float got = 0.0, top = 1e9;
  for (int row = 0; row <= 2; row++){ if (float(row) > tier) break; float rr = float(row);
    float h = S.y * (0.34 - 0.06 * rr), w = h * cAsp, xs = P.x + t * (34.0 - 13.0 * rr) + rr * w * 0.37 + seed * 53.0;
    float yb = base - rr * h * 0.32; yb = mix(yb, min(yb, A.y - 300.0 - rr * 50.0), hole);
    float v = (P.y - (yb - h)) / h; top = min(top, yb - h * 0.55);
    if (got > 0.97 || v > 1.0) continue;
    float tile = floor(xs / w), u = fract(xs / w); if (mod(tile, 2.0) > 0.5) u = 1.0 - u;
    vec4 s = v < 0.0 ? vec4(0.0) : texture(T1, vec2(u, v)); s.a *= smoothstep(1.0, 0.8, v);   // the hanging wisps fade out, no cut edge
    float below = v < 0.0 ? 0.0 : texture(T1, vec2(u, min(v + 7.0 / h, 1.0))).a * smoothstep(1.0, 0.8, v + 7.0 / h), rim = s.a * (1.0 - below);
    vec3 col = s.rgb * (1.0 - 0.28 * rr) * mix(1.0, 0.8, hole * 0.5);
    col += light * rim * smoothstep(0.85, 0.6, v) * (0.35 + 1.6 * flare) * (1.0 - 0.3 * rr) + light * s.a * 0.25 * flare * (1.0 - smoothstep(0.4, 1.0, 1.0 - v));
    float a = s.a * env; acc += (1.0 - got) * a * col; got += (1.0 - got) * a; }   // front to back
  // the ink sky above the rows: a wash, darker up, so the cloud tops never show bare paper
  float sky = smoothstep(top + 90.0 + 60.0 * fbm3(vec2(P.x * 0.006, t * 0.2)), top - 60.0, P.y) * env * (1.0 - got);   // its lower edge bleeds unevenly
  float wv = fbm3(vec2(P.x * 0.003 + t * 0.02, P.y * 0.005)); vec3 skyc = PAPER * exp(-(0.45 + 0.6 * wv + 0.4 * smoothstep(top, 0.0, P.y)) * K_INK);   // let-down ink, graded darker upward, uneven as a wash
  acc += (1.0 - got) * sky * skyc; got += (1.0 - got) * sky; vec3 cl = acc + (1.0 - got) * c;
  c = mix(c, cl, 0.97);
  // his light falling through the hole: a broad beam onto where he lands, streaked
  float bx = (P.x - A.x) / (110.0 + 0.35 * max(0.0, P.y - base));
  float beam = exp(-bx * bx * 2.0) * smoothstep(base - 20.0, base + 60.0, P.y) * smoothstep(A.y + 40.0, A.y - 10.0, P.y) * hole * (0.75 + 0.25 * vn(vec2(bx * 6.0, t * 2.0)));
  c = 1.0 - (1.0 - c) * (1.0 - clamp(light * beam * 0.42, 0.0, 1.0));
  // the lightning
  float glow = 0.0, core = 0.0;
  for (int b = 0; b < ${BOLTS}; b++){ float on = boltOn[b]; if (on <= 0.0) continue; float d = 1e9;
    for (int i = 0; i < ${BOLT_PTS - 1}; i++) d = min(d, segd(P, bolt[b * ${BOLT_PTS} + i], bolt[b * ${BOLT_PTS} + i + 1]));
    glow += on * exp(-d / 26.0) * 0.8 + on * exp(-d / 90.0) * 0.35; core = max(core, on * smoothstep(3.2, 0.8, d)); }
  c = 1.0 - (1.0 - c) * (1.0 - clamp(light * glow, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.99, 0.95), clamp(core, 0.0, 1.0));
  o = vec4(c, 1.0);
}`);
  // flakes of bronze-gold pigment drifting down out of the cloud
  const LEAF = post.program(`#version 300 es
precision highp float;
uniform vec3 light; in vec2 vUV; in float vA; in float vF; out vec4 o;
void main(){ vec2 d = abs(vUV - 0.5) * 2.0; float m = vA * step(max(d.x, d.y), 0.92 - 0.25 * fract(vUV.x * 7.3 + vUV.y * 3.1));
  vec3 col = light * mix(0.52, 0.76, vF); m *= 0.85; o = vec4(col * m, m); }   // matte bronze-gold flakes: turning shows a darker and a paler face, never a flash`, `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT, uDpr, seed, life; out vec2 vUV; out float vA; out float vF;
float h(float n){ return fract(sin(n * 12.9898 + seed) * 43758.5453); }
void main(){ float s = float(gl_InstanceID); vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1) - 0.5;
  vec2 S = uRes / uDpr; float r1 = h(s * 1.3), r2 = h(s * 2.7), r3 = h(s * 3.9), t0 = 0.35 + r3 * 1.2, t = uT - t0;
  vec2 p = vec2(r1 * S.x, S.y * (0.1 + 0.3 * r2) + t * (40.0 + 60.0 * r3)); p.x += sin(t * (1.5 + r2) + r1 * 6.0) * 30.0;
  float turn = t * (3.0 + 5.0 * r2) + r1 * 6.0, size = 3.0 + 5.0 * r3;
  vec2 q = c * size * 2.0 * vec2(abs(cos(turn)) + 0.15, 1.0); float a = r2 * 6.28 + t * 0.7; q = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  vA = (t > 0.0 ? 1.0 : 0.0) * smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(life - 1.2, life - 0.2, uT)); vF = pow(abs(sin(turn)), 8.0);
  vec2 d = (p + q) * uDpr; gl_Position = vA <= 0.0 ? vec4(2.0, 2.0, 0.0, 1.0) : vec4(d.x / uRes.x * 2.0 - 1.0, 1.0 - d.y / uRes.y * 2.0, 0.0, 1.0); vUV = c + 0.5; }`);
  let vao = gl.createVertexArray(), cloud = null, asp = 2.05;      // (no cloud picture: the 祥云 are brush cells drawn over this pass, glfx omenClouds)
  const upload = () => {};
  const blank = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return t; };
  let none = blank();
  post.onRestore(() => { vao = gl.createVertexArray(); none = blank(); upload(); });
  const pts = new Float32Array(BOLTS * BOLT_PTS * 2), on = new Float32Array(BOLTS);
  let cur = null;
  /** o: {x, y (ground point he lands at), life, light [r,g,b], strikes: [{t, x, y}] where the lightning comes down, seed, dark 0..1} */
  function start(o) { cur = { ...o, t: 0, strikes: o.strikes || [] }; }
  function bolts(V) {
    // each bolt: from the cloud (above and to one side) to the point, jagged; later bolts land near it
    for (let b = 0; b < BOLTS; b++) {
      const S = cur.strikes[b]; if (!S) { on[b] = 0; continue; }
      const X = V.sx(S.x) / V.dpr, Y = V.sy(S.y) / V.dpr, age = cur.t - S.t, flick = age < 0 ? 0 : age < 0.05 ? 1 : age < 0.09 ? 0.25 : age < 0.13 ? 0.85 : Math.max(0, 1 - (age - 0.13) / 0.2) * 0.5;
      on[b] = flick;
      let s = cur.seed * 13 + b * 7.7; const r = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
      const ex = X, ey = Y - 20, sx = ex + (r() - 0.5) * 240, sy = innerHeight * 0.16;
      for (let i = 0; i < BOLT_PTS; i++) { const u = i / (BOLT_PTS - 1), j = i === 0 || i === BOLT_PTS - 1 ? 0 : (r() - 0.5) * 70 * Math.sin(u * Math.PI);
        pts[(b * BOLT_PTS + i) * 2] = sx + (ex - sx) * u + j; pts[(b * BOLT_PTS + i) * 2 + 1] = sy + (ey - sy) * u + (r() - 0.5) * 10; } }
  }
  function draw(V, dt) {
    if (!cur) return; cur.t += dt; if (cur.t > cur.life) { cur = null; return; }
    bolts(V);
    const W = gl.canvas.width, H = gl.canvas.height;
    // the low tier lays the pass only over the band down to the lowest strike (the cloud, the bolts); no darkened edges below
    let r = [0, 0, W, H]; if (Q.tier === 0) { let low = H * 0.4; for (const S of cur.strikes) low = Math.max(low, V.sy(S.y) + 60 * V.dpr); r = [0, 0, W, Math.min(H, low)]; }
    post.quad(P, r, [post.grab(r), cloud || none], (u) => { gl.uniform1f(u.cAsp, asp); gl.uniform1f(u.k, cur.t); gl.uniform1f(u.life, cur.life); gl.uniform1f(u.dark, cur.dark ?? 1); gl.uniform2f(u.at, V.sx(cur.x), V.sy(cur.y)); gl.uniform3f(u.light, ...cur.light); gl.uniform1f(u.seed, cur.seed % 30); gl.uniform1f(u.tier, Q.tier);
      gl.uniform2fv(u.bolt, pts); gl.uniform1fv(u.boltOn, on); }, null);
    post.screen(); gl.useProgram(LEAF.p); gl.bindVertexArray(vao); gl.uniform2f(LEAF.u.uRes, W, H); gl.uniform1f(LEAF.u.uT, cur.t); gl.uniform1f(LEAF.u.uDpr, V.dpr); gl.uniform1f(LEAF.u.seed, cur.seed % 30); gl.uniform1f(LEAF.u.life, cur.life); gl.uniform3f(LEAF.u.light, ...cur.light);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 160); gl.bindVertexArray(null);
  }
  return { start, draw, get cur() { return cur; }, strikes: () => (cur ? cur.strikes : []), get t() { return cur ? cur.t : -1; }, get live() { return cur ? 1 : 0; }, reset() { cur = null; } };
}
