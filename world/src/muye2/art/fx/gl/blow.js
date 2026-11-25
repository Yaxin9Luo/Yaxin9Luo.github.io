// 重击: a heavy blow lands (a boss's warned blow coming down). WebGL2 only. From study (b) of the render spike, with the
// lead's notes on it: the shock ring was weak and brown; the blow must land with more weight. So the weight is ink:
//   - the ground is struck: a broken ring of dark dry ink thrown out fast, short cracks of ink radiating from the point,
//     a puff of pale paper-dust lifted off the ground (light made of paper, never a glow);
//   - the light of the blow: the ground and figures round it lifted toward bare warm paper for a fifth of a second,
//     broken by dry rays;
//   - heat shimmer: a column above the point refracts what is behind it (a copy of the screen, read displaced);
//   - ink thrown on the picture plane: a lumpy blot along the throw, thin streaks with dry gaps ending in teardrops, drops
//     of every size; wet it is a little bluer; it dries and breaks up through the paper's grain within 1.5 s;
//   - the camera kick is the effects' own (fx.kick), made larger for these blows.
// The hero's patch stays clear of the thrown ink. Everything is drawn in one pass over a rectangle round the point.
export function createBlow(post) {
  const gl = post.gl;
  const SPLASH = `
uniform vec2 dir; uniform float zc, power, seed;
float seg(vec2 p, vec2 a, vec2 b, float ra, float rb){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }
float hh(float n){ return fract(sin(n * 91.345 + seed) * 47453.31); }
float splash(vec2 p, vec2 c, vec2 f, float g, float R, out float far){
  vec2 n = vec2(-f.y, f.x), q = vec2(dot(p - c, f), dot(p - c, n));
  vec2 w = q + R * 1.1 * vec2(fbm3(q * 0.018 / zc + 1.3 + seed) - 0.5, fbm3(q * 0.018 / zc + 7.7) - 0.5) * 2.0;
  float d = length(w * vec2(0.66, 1.0)) - R * (0.7 + 0.6 * fbm3(vec2(atan(w.y, w.x) * 1.8, 2.0 + seed)));
  far = 0.0; float best = d;
  for (int i = 0; i < 22; i++){ float s = float(i);
    float wide = step(0.82, hh(s + 9.1)); float a = (hh(s) - 0.5) * mix(1.15, 3.6, wide); vec2 u = vec2(cos(a), sin(a));
    float L = R * (1.2 + 4.8 * pow(hh(s + 7.7), 0.8)) * (1.0 - 0.55 * wide) * g, w0 = (1.6 + 3.6 * hh(s + 2.2)) * zc;
    vec2 a0 = u * R * 0.45, a1 = u * (R * 0.5 + L);
    float ds = seg(q, a0, a1, w0, 0.35 * zc), t = clamp(dot(q - a0, u) / max(L, 1.0), 0.0, 1.0);
    ds += 4.0 * zc * smoothstep(0.42, 0.25, vn(vec2(t * L * 0.06 / zc + s * 13.0, s))) * smoothstep(0.15, 0.4, t);
    vec2 tip = u * (R * 0.5 + L * (1.08 + 0.12 * hh(s + 3.3))), dq = q - tip;
    ds = min(ds, length(vec2(dot(dq, u) * 0.62, dot(dq, vec2(-u.y, u.x)))) - w0 * (0.55 + 0.5 * hh(s + 4.4)));
    if (ds < best) { best = ds; far = t; } d = min(d, ds); }
  for (int i = 0; i < 40; i++){ float s = float(i) + 40.0; float a = (hh(s) - 0.5) * (hh(s + 5.0) < 0.75 ? 1.4 : 4.4); vec2 u = vec2(cos(a), sin(a));
    float rr = R * (1.6 + 6.4 * hh(s + 1.0)) * g, r0 = (0.7 + 4.2 * pow(hh(s + 2.0), 3.0)) * zc;
    vec2 dq = q - u * rr; float dd = length(vec2(dot(dq, u) * 0.7, dot(dq, vec2(-u.y, u.x)))) - r0; if (dd < best) { best = dd; far = 1.0; } d = min(d, dd); }
  return d;
}
`;
  // once per blow: when, as the splash grows (g 0..1), each texel is first reached; the distance at full growth; how far out
  const BAKE = post.program(post.LIB + SPLASH + `
uniform vec2 ext0, ext1;
void main(){
  vec2 Q = mix(ext0, ext1, gl_FragCoord.xy / uRes), f = normalize(dir); float z = zc, far = 0.0, need = 1.5, fr;
  float GS[6] = float[6](0.12, 0.25, 0.4, 0.6, 0.8, 1.0); float d1 = 0.0;
  for (int i = 0; i < 6; i++){ float d = splash(Q, f * 26.0 * z, f, GS[i], 27.0 * z * (0.7 + 0.3 * power), fr); if (i == 5) { d1 = d; far = fr; } if (d < 0.0 && need > 1.0) need = GS[i]; }
  o = vec4(min(need, 1.0) * (need > 1.0 ? 0.0 : 1.0) + (need > 1.0 ? 1.0 : 0.0) * 1.0, far, clamp((d1 + 8.0) / 24.0, 0.0, 1.0), need > 1.0 ? 0.0 : 1.0);
}`);
  // in a frame: heat shimmer rising off the point, and the thrown ink read from the bake
  const P = post.program(post.LIB.replace('out vec4 o;', 'out vec4 o; in vec2 vQ;') + `
uniform sampler2D T0, T1; uniform vec2 at, hero, ext0, ext1; uniform float k, zc, zc0, power;
void main(){
  vec2 p = sp(), P = p / uDpr, A = at / uDpr; float tb = k, z = zc;
  float col = exp(-pow((P.x - A.x) / (95.0 * z), 2.0)) * smoothstep(A.y + 30.0 * z, A.y - 30.0 * z, P.y) * smoothstep(A.y - 460.0 * z, A.y - 140.0 * z, P.y);
  float sh = exp(-tb * 1.6) * smoothstep(0.0, 0.08, tb) * power;
  vec2 off = vec2(vn(vec2(P.x * 0.045 / z, P.y * 0.03 / z + tb * 5.5)) - 0.5, vn(vec2(P.x * 0.03 / z + 7.0, P.y * 0.045 / z + tb * 5.0)) - 0.5) * vec2(7.0, 4.0) * z * col * sh;
  vec3 c = grabAt(T0, p + off * uDpr).rgb;
  vec2 Q = (P - A) * (zc0 / zc), uv = (Q - ext0) / (ext1 - ext0);
  vec4 S = texture(T1, uv); float gr = 1.0 - exp(-tb * 22.0);
  if (S.a > 0.5 && gr >= S.r) {
    float d = S.b * 24.0 - 8.0, far = S.g, n = fbm3(P * 0.07 / z), nf = vn(P * 0.55);
    d += (vn(P * 0.6) - 0.5) * 1.6 + (n - 0.5) * 3.0 * z;
    float inside = smoothstep(0.9, -0.9, d) * smoothstep(S.r, S.r + 0.08, gr), rim = 1.0 - smoothstep(0.0, 6.0 * z, -d), wet = exp(-tb * 3.5);
    float dens = inside * (0.8 + 0.2 * rim * (0.35 + 0.65 * wet)) * (0.8 + 0.3 * n) * mix(1.0, 0.72, far);
    dens *= smoothstep(0.0, 0.18, 1.15 - smoothstep(0.35, 1.45, tb) * 1.4 - nf * 0.9 + 0.2 * rim) * mix(1.0, 0.82, 1.0 - wet);
    vec2 hv = vec2(P.x - hero.x, (P.y - hero.y) * 1.3) / z; dens *= mix(0.25, 1.0, smoothstep(55.0, 110.0, length(hv)));
    c *= exp(-dens * 1.35 * mix(K_INK, K_INK * vec3(1.06, 1.0, 0.86), wet)); }
  o = vec4(c, 1.0);
}`, post.QUAD_VS);
  const BW = 384, BH = 352, free = [];
  const live = [];
  /** a blow at ground point (x, y): dir (radians, on the screen) the way the ink is thrown; power 0.5 .. 1.2 */
  function hit(o) {
    if (live.length > 4) free.push(live.shift().S);
    const b = { x: o.x, y: o.y, dir: o.dir || 0, power: o.power || 1, t: 0, seed: (o.seed || live.length * 7.3) % 50, zc0: o.zc || 1, S: free.pop() || post.target(BW, BH) };
    b.ext0 = [-420 * b.zc0, -480 * b.zc0]; b.ext1 = [420 * b.zc0, 300 * b.zc0];
    post.pass(BAKE, b.S, [], (u) => { gl.uniform2f(u.dir, Math.cos(b.dir), Math.sin(b.dir)); gl.uniform1f(u.zc, b.zc0); gl.uniform1f(u.power, b.power); gl.uniform1f(u.seed, b.seed); gl.uniform2f(u.ext0, ...b.ext0); gl.uniform2f(u.ext1, ...b.ext1); });
    live.push(b);
  }
  /** the struck ground (ring, cracks), under the figures; steps the clock */
  function drawGround(V, dt) {
    for (let i = 0; i < live.length; i++) { const b = live[i]; b.t += dt; if (b.t > 1.7) { free.push(b.S); live.splice(i--, 1); continue; } }      // the struck ground is the impact kit's now
  }
  /** over the figures: shimmer, light, dust, thrown ink. V: {sx, sy, z (device px per unit), dpr, hero: [X, Y] device px} */
  function draw(V, dt) {
    for (let i = 0; i < live.length; i++) { const b = live[i];
      const X = V.sx(b.x), Y = V.sy(b.y), e = 420 * V.z, r = [X - e, Y - 480 * V.z, X + e, Y + 300 * V.z];
      const tex = post.grab(r), H = V.hero || [-1e5, -1e5];
      post.quad(P, r, [tex, b.S.tex], (u) => { gl.uniform2f(u.at, X, Y); gl.uniform2f(u.hero, H[0] / V.dpr, H[1] / V.dpr - 40 * V.z / V.dpr); gl.uniform2f(u.ext0, ...b.ext0); gl.uniform2f(u.ext1, ...b.ext1);
        gl.uniform1f(u.k, b.t); gl.uniform1f(u.zc, V.z / V.dpr); gl.uniform1f(u.zc0, b.zc0); gl.uniform1f(u.power, b.power); }, null); }
  }
  return { hit, draw, drawGround, get live() { return live.length; }, reset() { while (live.length) free.push(live.pop().S); } };
}
