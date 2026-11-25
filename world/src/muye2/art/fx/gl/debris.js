// Debris of an impact: clods of ink-dark earth and chips of the ground thrown on arcs (they land and settle, then sink), and
// flecks of the element's pigment (short streaks along their flight, laid over, fading; matte, never shining). Instanced, stateless: each piece is
// a function of its seed and the time since the burst. One draw per burst for the clods, one for the sparks.
export function createDebris(post) {
  const gl = post.gl;
  const VS = `#version 300 es
precision highp float;
uniform vec2 uRes, org; uniform float uT, uDpr, zc, power, seed, sparks;
out vec2 vUV; out vec4 vCol; out float vKind;
float h(float n){ return fract(sin(n * 12.9898 + seed * 3.3) * 43758.5453); }
void main(){
  float s = float(gl_InstanceID); vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1) - 0.5;
  float r1 = h(s * 1.7 + 0.3), r2 = h(s * 2.9 + 0.7), r3 = h(s * 4.1 + 0.1), r4 = h(s * 5.3 + 0.9);
  float a = r1 * 6.2832, sp = (180.0 + 620.0 * r2 * r2) * power, up = (260.0 + 640.0 * r3) * power;
  float g = 1500.0, t = uT;
  vec2 o = org / uDpr; float floorY = o.y + (sin(a) * 0.62) * sp * 0.9;                       // where it comes down: further out on the ground
  vec2 p; float alpha, size, rot = r4 * 6.28 + t * (r2 - 0.5) * 18.0; vec2 str = vec2(1.0);
  if (sparks > 0.5) {                                                                           // a spark: fast, short, bright
    float st = t * 1.6; vec2 v = vec2(cos(a) * sp * 1.6, -up * 1.3);
    p = o + (v * st + vec2(0.0, 0.5 * g * st * st)) * zc;
    vec2 vel = v + vec2(0.0, g * st); rot = atan(vel.y, vel.x) - 1.5708; str = vec2(0.35, 2.6 + 3.0 * r4);
    size = (2.0 + 3.0 * r3) * zc; alpha = smoothstep(0.0, 0.02, t) * (1.0 - smoothstep(0.25 + 0.4 * r4, 0.7 + 0.4 * r4, t));
  } else {                                                                                      // a clod: thrown up, lands, settles, sinks
    vec2 v = vec2(cos(a) * sp, -up * (0.5 + 0.5 * r4));
    float tl = (-v.y + sqrt(v.y * v.y + 2.0 * g * max(0.0, floorY - o.y))) / g;                  // the time it lands
    float tt = min(t, tl + 0.0);
    p = o + (v * tt + vec2(0.0, 0.5 * g * tt * tt)) * zc;
    if (t > tl) { rot = r4 * 6.28 + tl * (r2 - 0.5) * 18.0; }
    size = (2.5 + 9.0 * pow(r3, 2.0)) * zc * (0.7 + 0.3 * power);
    alpha = smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(1.6, 2.6, t));
  }
  vec2 q = c * size * 2.0 * str; q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
  vec2 d = (p + q) * uDpr;
  gl_Position = alpha <= 0.0 ? vec4(2.0, 2.0, 0.0, 1.0) : vec4(d.x / uRes.x * 2.0 - 1.0, 1.0 - d.y / uRes.y * 2.0, 0.0, 1.0);
  vUV = c + 0.5; vCol = vec4(vec3(r4), alpha); vKind = sparks;
}`;
  const FS = `#version 300 es
precision highp float;
uniform vec3 light; in vec2 vUV; in vec4 vCol; in float vKind; out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
void main(){
  vec2 d = (vUV - 0.5) * 2.0;
  if (vKind > 0.5) { float m = vCol.a * smoothstep(1.0, 0.2, length(d * vec2(1.0, 0.5))); vec3 col = light * mix(0.56, 0.74, vCol.r); o = vec4(col * m, m); return; }   // flecks of matte pigment (bronze-gold for gold), not sparks of light
  float r = length(d) + (vn(vUV * 5.0 + vCol.r * 9.0) - 0.5) * 0.7;                              // a chip: an irregular wet clod of ink
  float m = vCol.a * smoothstep(0.85, 0.55, r);
  vec3 col = mix(vec3(0.11, 0.09, 0.08), vec3(0.42, 0.36, 0.28), vCol.r * 0.6) * (0.8 + 0.4 * vn(vUV * 9.0));
  o = vec4(col * m, m);
}`;
  const P = post.program(FS, VS);
  let vao = gl.createVertexArray(); post.onRestore(() => { vao = gl.createVertexArray(); });
  const live = [];
  function burst(o) { live.push({ ...o, t: 0 }); if (live.length > 6) live.shift(); }
  function draw(V, dt) {
    if (!live.length) return; post.screen(); gl.useProgram(P.p); gl.bindVertexArray(vao);
    const c = gl.canvas; gl.uniform2f(P.u.uRes, c.width, c.height); gl.uniform1f(P.u.uDpr, V.dpr); gl.uniform1f(P.u.zc, V.z / V.dpr);
    for (let i = 0; i < live.length; i++) { const b = live[i]; b.t += dt; if (b.t > 2.7) { live.splice(i--, 1); continue; }
      gl.uniform2f(P.u.org, V.sx(b.x), V.sy(b.y)); gl.uniform1f(P.u.uT, b.t); gl.uniform1f(P.u.power, b.power); gl.uniform1f(P.u.seed, b.seed); gl.uniform3f(P.u.light, b.light[0], b.light[1], b.light[2]);
      gl.enable(gl.BLEND);
      gl.uniform1f(P.u.sparks, 0); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.n);
      if (b.sparks) { gl.uniform1f(P.u.sparks, 1); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.sparks); } }
    gl.bindVertexArray(null);
  }
  return { burst, draw, get live() { return live.length; }, reset() { live.length = 0; } };
}
