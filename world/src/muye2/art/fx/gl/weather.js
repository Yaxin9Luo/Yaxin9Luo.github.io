// What falls over the field: rain, snow, pigment dust. WebGL2 only: thousands of particles in one instanced draw, each a
// function of its seed and the time (no buffers, nothing on the CPU). From study (c) of the render spike, with the lead's
// note: the snow flakes were too large and too many over the figures; they are smaller, fewer and fainter now.
//   rain: hair strokes of dry ink, slanted with the wind, fainter toward the far ground; small part-rings where it lands
//   snow: lead white flicked off the brush (弹粉), near flakes larger and slower; reads on the grey sky wash the ground lays
//   dust: grit of ochre and warm grey streaked along the wind, dense in ribbons with clear air between (no azurite, no red:
//         red on the field means danger; the scene session's note), multiplied in over the scene's own ochre veil
// The particles move with the ground as the camera rides (parallax by depth) and thin out over the hero's patch.
export const FALL = { rain: { n: 2600, mode: 2 }, snow: { n: 2400, mode: 1 }, dust: { n: 9000, mode: 0 } };
export function createWeather(post) {
  const gl = post.gl;
  const VS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT, uMode, uDpr, uAmt, uWind; uniform vec2 hero, cam;
out vec2 vUV; out vec4 vCol; flat out int vKind;
float h(float n){ return fract(sin(n * 12.9898 + 0.137) * 43758.5453); }
void main(){
  float s = float(gl_InstanceID); vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1) - 0.5;
  float r1 = h(s * 1.17 + 0.3), r2 = h(s * 2.31 + 0.7), r3 = h(s * 3.77 + 0.1), r4 = h(s * 5.13 + 0.9), r5 = h(s * 7.01 + 0.2);
  vec2 css = uRes / uDpr, span = css * 1.3, lo = -css * 0.15, p; float size, rot = r5 * 6.2832, a; vec3 col; vec2 str = vec2(1.0); int kind = int(r4 * 3.99);
  if (uMode < 0.5) {                     // 走石飛砂: grit and dust on the wind, ochre and warm grey, streaked along it, in ribbons with clear air between
    float depth = r3 * r3, sp = mix(260.0, 620.0, depth);
    p = vec2(r1, r2) * span + vec2(uWind < 0.0 ? -sp : sp, sp * 0.06) * uT - cam * mix(0.6, 1.1, depth);
    p.y += sin(p.x * 0.006 + uT * 0.8 + r4 * 3.0) * 18.0;
    p = mod(p - lo, span) + lo;
    float band = sin(p.y * 0.022 + sin(p.x * 0.003 + uT * 0.4) * 1.6 + r5 * 0.3);
    float inBand = smoothstep(0.45, 0.85, band);
    size = mix(0.9, 2.2, depth) * (0.7 + 0.6 * r5); str = vec2(mix(5.0, 14.0, depth) * (0.6 + 0.8 * r4), 0.7); rot = 0.04;
    col = r4 < 0.6 ? vec3(0.62, 0.48, 0.28) : vec3(0.5, 0.46, 0.4);
    a = mix(0.35, 0.8, depth) * inBand;
  } else if (uMode < 1.5) {
    float depth = r3 * r3, sp = mix(26.0, 80.0, depth);
    p = vec2(r1, r2) * span + vec2(10.0 + uWind * 40.0 + 10.0 * depth, sp) * uT - cam * mix(0.5, 1.15, depth); p.x += sin(uT * (0.6 + r4) + r5 * 6.0) * 14.0 * (0.4 + depth);
    p = mod(p - lo, span) + lo; size = mix(1.0, 3.6, depth) * (0.7 + 0.5 * r5);
    col = vec3(0.985, 0.975, 0.955); a = mix(0.32, 0.8, depth);
  } else {
    float depth = r3, sp = mix(520.0, 980.0, depth);
    p = vec2(r1, r2) * span + vec2(0.3 + uWind * 0.3, 1.0) * sp * uT - cam * mix(0.7, 1.1, depth); p = mod(p - lo, span) + lo;
    size = 1.0; str = vec2(mix(0.7, 1.3, depth), mix(10.0, 34.0, depth) * (0.6 + 0.8 * r5)); rot = -0.42 - uWind * 0.2; kind = 4;
    col = vec3(0.2, 0.21, 0.24); a = mix(0.1, 0.38, depth * depth) * (0.5 + 0.5 * r5) * mix(0.45, 1.0, smoothstep(0.0, 0.6, p.y / css.y));
  }
  if (float(gl_InstanceID) > uAmt) a = 0.0;
  vec2 hv = vec2(p.x - hero.x, (p.y - hero.y) * 1.25); a *= mix(0.2, 1.0, smoothstep(50.0, 115.0, length(hv)));
  vec2 q = corner * size * 2.6 * str; q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
  vec2 dp = (p + q) * uDpr;
  gl_Position = a <= 0.0 ? vec4(2.0, 2.0, 0.0, 1.0) : vec4(dp.x / uRes.x * 2.0 - 1.0, 1.0 - dp.y / uRes.y * 2.0, 0.0, 1.0);
  vUV = corner + 0.5; vCol = vec4(col, a); vKind = kind;
}`;
  // a dab: a wet body with a broken dry edge, from noise (no texture)
  const FS = `#version 300 es
precision highp float;
uniform float uMode; in vec2 vUV; in vec4 vCol; flat in int vKind; out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
void main(){ float m;
  if (vKind == 4) m = vCol.a * smoothstep(0.5, 0.15, abs(vUV.x - 0.5)) * smoothstep(0.0, 0.35, vUV.y) * smoothstep(1.0, 0.55, vUV.y) * (0.55 + 0.45 * smoothstep(0.2, 0.6, fract(vUV.y * 1.3 + vCol.a * 9.0)));
  else { vec2 d = (vUV - 0.5) * 2.0; float sk = float(vKind); float r = length(d * vec2(1.0, sk == 2.0 ? 1.6 : 1.15)) + (vn(vUV * 6.0 + sk * 3.1) - 0.5) * 0.55;
    m = vCol.a * smoothstep(0.75, 0.45, r) * (0.55 + 0.45 * step(0.35, vn(vUV * 14.0 + sk))); }
  o = uMode > 0.5 && uMode < 1.5 ? vec4(vCol.rgb * m, m) : vec4(mix(vec3(1.0), vCol.rgb, m), 1.0); }`;
  const P = post.program(FS, VS);
  // where rain lands: small part-rings on the ground, each a quarter of a second (one pass over the lower screen)
  const RINGS = post.program(post.LIB + `uniform float uT; uniform vec2 cam; void main(){ vec2 p = sp(), P = p / uDpr + cam;
  vec2 cell = floor(vec2(P.x / 38.0, P.y / 22.0)); float m = 0.0;
  for (int i = 0; i < 2; i++){ vec2 id = cell + vec2(i, 0); float ph = fract(uT * (1.2 + h21(id)) + h21(id + 3.1)); vec2 ctr = (id + vec2(h21(id + 1.7), h21(id + 2.9))) * vec2(38.0, 22.0); vec2 d = (P - ctr) * vec2(1.0, 1.0 / 0.62); float rr = 1.0 + 7.0 * ph;
    m = max(m, exp(-pow((length(d) - rr) / 0.7, 2.0)) * smoothstep(-0.2, 0.6, sin(atan(d.y, d.x) * 2.0 + h21(id) * 6.0)) * (1.0 - ph) * step(ph, 0.6)); }
  m *= smoothstep(0.2, 0.4, (p.y / uDpr) / (uRes.y / uDpr));
  o = vec4(vec3(1.0 - 0.13 * m), 1.0); }`);
  let t = 0, vao = gl.createVertexArray();
  post.onRestore(() => { vao = gl.createVertexArray(); });
  /** kind 'rain' | 'snow' | 'dust' | null; amount 0..1; wind -1..1; V: {dpr, hero: [X, Y] device px, cam: [x, y] world, z} */
  function draw(V, dt, kind, amount = 1, wind = 0) {
    const F = FALL[kind]; if (!F || amount <= 0) return; t += dt;
    const c = post.gl.canvas, H = V.hero || [-1e5, -1e5], cx = V.cam[0] * V.z / V.dpr, cy = V.cam[1] * 0.62 * V.z / V.dpr;
    if (kind === 'rain') post.pass(RINGS, null, [], (u) => { gl.uniform1f(u.uT, t); gl.uniform2f(u.cam, cx, cy); }, 'multiply');
    post.screen();
    gl.useProgram(P.p); gl.uniform2f(P.u.uRes, c.width, c.height); gl.uniform1f(P.u.uT, t + 20); gl.uniform1f(P.u.uMode, F.mode); gl.uniform1f(P.u.uDpr, V.dpr); gl.uniform1f(P.u.uAmt, F.n * amount); gl.uniform1f(P.u.uWind, wind);
    gl.uniform2f(P.u.hero, H[0] / V.dpr, H[1] / V.dpr - 40); gl.uniform2f(P.u.cam, cx, cy);
    gl.enable(gl.BLEND); if (F.mode === 1) gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); else gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
    gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, F.n); gl.bindVertexArray(null);
  }
  return { draw };
}
