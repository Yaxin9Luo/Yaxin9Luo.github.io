// 呼名落马: 张桂芳 calls a name down a narrow cone and the one named falls from his horse. WebGL2 only.
// The call is drawn as the air itself: down the cone the scene trembles in bands that travel out from his mouth (a copy of
// the screen, read displaced), and on the ground pale dry rings of ink run out with them and break up. No glow, no colour:
// the danger itself is the rules' warning cone, drawn by the stroke effects in cinnabar before the call.
export function createVoice(post) {
  const gl = post.gl;
  const P = post.program(post.LIB.replace('out vec4 o;', 'out vec4 o; in vec2 vQ;') + `
uniform sampler2D T0; uniform vec2 at; uniform float k, zc, dir, halfA, reach;
void main(){
  vec2 p = sp(), P = p / uDpr, A = at / uDpr; float z = zc;
  vec2 g = vec2(P.x - A.x, (P.y - A.y) / 0.62) / z; float r = length(g), an = atan(g.y, g.x);
  float da = abs(mod(an - dir + 3.14159, 6.28318) - 3.14159);
  float inCone = smoothstep(halfA + 0.12, halfA - 0.05, da) * smoothstep(reach * 1.08, reach * 0.8, r) * smoothstep(10.0, 40.0, r);
  float env = smoothstep(0.0, 0.08, k) * exp(-k * 2.2);
  float ph = r / 46.0 - k * 9.0;                                       // bands travelling out at about 400 units a second
  float band = pow(0.5 + 0.5 * cos(ph * 6.28318), 6.0);
  vec2 off = vec2(cos(an), sin(an) * 0.62) * band * 9.0 * z * inCone * env;
  vec3 c = grabAt(T0, p + off * uDpr).rgb;
  // pale dry rings of ink on the bands, broken along their length
  float dry = 0.35 + 0.65 * smoothstep(0.15, 0.45, vn(vec2(an * 24.0, r * 0.05 - k * 3.0)));
  float ring = pow(0.5 + 0.5 * cos(ph * 6.28318), 5.0) * dry * inCone * smoothstep(0.0, 0.06, k) * exp(-k * 1.4) * mix(1.0, 0.45, r / reach);
  c = mix(c, vec3(0.975, 0.96, 0.925), 0.28 * inCone * env * smoothstep(reach, reach * 0.2, r));      // the call as a pale gust: the cone lifted toward bare paper
  c *= exp(-ring * 0.8 * K_INK);
  o = vec4(c, 1.0);
}`, post.QUAD_VS);
  const live = [];
  /** a call from (x, y) toward dir (radians in the ground plane), half-angle half (radians), reach in world units */
  function call(o) { live.push({ ...o, t: 0 }); if (live.length > 3) live.shift(); }
  function draw(V, dt) {
    for (let i = 0; i < live.length; i++) { const b = live[i]; b.t += dt; if (b.t > 1.3) { live.splice(i--, 1); continue; }
      const X = V.sx(b.x), Y = V.sy(b.y), R = b.reach * 1.1 * V.z, r = [X - R, Y - R * 0.62 - 120 * V.z, X + R, Y + R * 0.62 + 40 * V.z];
      const tex = post.grab(r);
      post.quad(P, r, [tex], (u) => { gl.uniform2f(u.at, X, Y); gl.uniform1f(u.k, b.t); gl.uniform1f(u.zc, V.z / V.dpr); gl.uniform1f(u.dir, b.dir); gl.uniform1f(u.halfA, b.half); gl.uniform1f(u.reach, b.reach); }, null); }
  }
  return { call, draw, get live() { return live.length; }, reset() { live.length = 0; } };
}
