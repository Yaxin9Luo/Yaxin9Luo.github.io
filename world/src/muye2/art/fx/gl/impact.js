// The impact kit: what a god's blow does to the field. Shared by a boss's entrance, a heavy blow and the great treasures.
// WebGL2 only. The medium stays ink, mineral pigment, gold leaf and paper; the scale is the scroll's, not a man's:
//   - the ground split in a painted fissure: dark ink gaps with a lit rim of paper and, inside, a line of hot gold (or the
//     element's light) that cools over a second; it runs out from the point while the shock passes;
//   - a crater of ink wash under the point, and pale paper-dust billowing up round it;
//   - a shock ring that crosses the screen: on the ground a thick dry brush ring with a gold leading edge; in the air a
//     wave that pushes everything it passes outward (the figures are thrown back with it), a copy of the screen displaced;
//   - the flash: the whole screen lifted toward warm white-gold for a few frames; a bloom of the element's light at the core;
//   - a column of light from the sky onto the point (a god's blow, a seal's fall, lightning's root), bright core, gold halo;
//   - debris: clods of ink-dark earth and chips flung on arcs, and gold sparks (debris.js).
// Cost (render spike, M2 Pro): the fissure is drawn once into a small texture when the blow lands (a few ms at most, once);
// in a frame each impact is one small quad on the ground, all live rings are two full-screen passes of plain arithmetic
// (multiplied and screened in, no copy of the screen), and everything in the air is ONE full-screen pass for all live
// impacts, reading one copy of the screen.
import { createDebris } from './debris.js';

const LIGHT = { gold: [1.0, 0.78, 0.36], cinnabar: [1.0, 0.42, 0.22], azurite: [0.55, 0.78, 1.0], malachite: [0.55, 1.0, 0.75], ink: [0.95, 0.85, 0.6] };
export function createImpact(post, Q = { tier: 2 }) {
  const gl = post.gl, debris = createDebris(post), N = 4, FW = 384, FH = 384;
  // ---- once per impact: the fissure, in the ground plane, into a texture (r: distance, g: how far along, b: main 1 / branch .5)
  const BAKE = post.program(post.LIB + `
uniform float seed, reach, cracks, power, box;
float hh(float n){ return fract(sin(n * 91.345 + seed * 7.1) * 47453.31); }
void main(){
  vec2 g = (gl_FragCoord.xy / uRes * 2.0 - 1.0) * box;
  float r = length(g), an = atan(g.y, g.x), best = 1e9, along = 1.0, main = 0.0;
  for (int i = 0; i < 11; i++){ float s = float(i); if (s >= cracks) break;
    float a0 = s / cracks * 6.2832 + (hh(s) - 0.5) * 0.7, L = reach * (0.45 + 0.55 * hh(s + 3.0));
    float w = a0 + (fbm3(vec2(r * 0.012, s * 3.7)) - 0.5) * 0.9 + (vn(vec2(r * 0.06, s)) - 0.5) * 0.12;
    float da = abs(mod(an - w + 3.14159, 6.28318) - 3.14159), d = r * sin(min(da, 1.5));
    if (r < L && da < 1.2) { float t = r / L, wd = mix(15.0, 1.0, pow(t, 0.7)) * (0.7 + 0.6 * hh(s + 5.0)) * (0.6 + 0.4 * power), e = d - wd; if (e < best) { best = e; along = t; main = 1.0; } }
    float b0 = L * (0.3 + 0.3 * hh(s + 9.0)), bl = L * 0.45; vec2 bp = vec2(cos(w), sin(w)) * b0;
    float ba = w + (hh(s + 11.0) < 0.5 ? -0.6 : 0.6); vec2 bu = vec2(cos(ba), sin(ba)), q = g - bp; float tb = dot(q, bu);
    if (tb > 0.0 && tb < bl) { float db = abs(dot(q, vec2(-bu.y, bu.x)) + (vn(vec2(tb * 0.08, s)) - 0.5) * 10.0), e = db - mix(7.0, 0.6, tb / bl) * (0.6 + 0.4 * power); if (e < best) { best = e; along = (b0 + tb) / L; main = 0.5; } }
  }
  o = vec4(clamp((best + 8.0) / 40.0, 0.0, 1.0), clamp(along, 0.0, 1.0), main, 1.0);
}`);
  // ---- before the figures, per impact, a quad round its fissure: crater, the fissure growing out, the gold inside it cooling
  const GROUND = post.program(post.LIB.replace('out vec4 o;', 'out vec4 o; in vec2 vQ;') + `
uniform sampler2D T0, T1; uniform vec2 at; uniform float k, zc, power, seed, box; uniform vec3 light;
void main(){
  vec2 p = sp(), P = p / uDpr, A = at / uDpr; float z = zc, t = k;
  vec3 c = grabAt(T0, p).rgb;
  vec2 g = vec2(P.x - A.x, (P.y - A.y) / 0.62) / z; float r = length(g);
  float crater = smoothstep(90.0 * power, 20.0, r + (vn(g * 0.05 + seed) - 0.5) * 50.0) * smoothstep(0.0, 0.05, t);
  c *= exp(-crater * (0.55 - 0.25 * smoothstep(1.0, 3.0, t)) * K_INK);
  vec4 F = texture(T1, g / box * 0.5 + 0.5);
  float d = F.r * 40.0 - 8.0, along = F.g, grow = smoothstep(0.0, 0.25, t);
  d += 40.0 * smoothstep(grow - 0.05, grow + 0.02, along) * step(0.01, F.b);                          // it runs out from the point
  float gap = smoothstep(1.2, -1.2, d), rim = smoothstep(4.5, 1.0, d) * (1.0 - gap), fade = 1.0 - smoothstep(2.0, 3.2, t);
  c = mix(c, vec3(0.985, 0.965, 0.92), rim * 0.55 * fade);
  c *= exp(-gap * 1.25 * fade * K_INK);
  float hot = smoothstep(0.4, -1.6, d) * exp(-t * 1.6) * (1.0 - along * 0.6);
  c = mix(c, light * 0.69, clamp(hot * 0.9, 0.0, 0.9));                                              // matte bronze-gold pigment in the crack (#B08A3C for gold), not light
  o = vec4(c, 1.0);
}`, post.QUAD_VS);
  // ---- before the figures, all live rings at once: the dark dry ring and its leading edge of gold pigment, multiplied
  const RINGS = post.program(post.LIB + `
uniform vec2 at[${N}]; uniform float k[${N}], power[${N}], seed[${N}]; uniform vec3 light[${N}]; uniform float zc, n;
void main(){
  vec2 P = sp() / uDpr; vec3 ink = vec3(1.0), glow = vec3(0.0);
  for (int i = 0; i < ${N}; i++){ if (float(i) >= n) break; float t = k[i]; if (t > 1.8) continue;
    vec2 A = at[i] / uDpr, g = vec2(P.x - A.x, (P.y - A.y) / 0.62) / zc; float r = length(g), an = atan(g.y, g.x);
    float R = 60.0 + 1700.0 * power[i] * (1.0 - exp(-t * 2.2)), W = 22.0 + 60.0 * t, dr = r - R;
    if (abs(dr) > W * 3.0) continue;
    float broken = 0.45 + 0.55 * smoothstep(0.3, 0.55, vn(vec2(an * 3.0, 2.0 + seed[i])) * 0.6 + vn(vec2(an * 7.0, seed[i])) * 0.4);
    float ring = exp(-pow(dr / W, 2.0)) * broken * exp(-t * 1.4) * (0.6 + 0.4 * vn(vec2(an * 50.0, r * 0.05)));
    ink *= exp(-ring * 0.65 * K_INK);
    float edge = exp(-pow((dr - W * 0.9) / (W * 0.35), 2.0)) * broken * exp(-t * 2.5) * 0.9;
    ink *= mix(vec3(1.0), clamp(light[i] * 0.69 / PAPER, 0.0, 1.0), edge); }                          // its leading edge a line of matte gold pigment
  o = vec4(ink, 1.0);
}`);
  // ---- after the figures, ONE pass for all: the wave that throws them back, dust, the column of light, bloom, the flash
  const OVER = post.program(post.LIB + `
uniform sampler2D T0; uniform vec2 at[${N}]; uniform float k[${N}], power[${N}], seed[${N}], column[${N}]; uniform vec3 light[${N}]; uniform float zc, n, flash, tier;
void main(){
  vec2 p = sp(), P = p / uDpr; float z = zc; vec2 off = vec2(0.0);
  for (int i = 0; i < ${N}; i++){ if (float(i) >= n) break; float t = k[i]; if (t > 1.6) continue;
    vec2 A = at[i] / uDpr, g = vec2(P.x - A.x, (P.y - A.y) / 0.62) / z; float r = length(g), R = 60.0 + 1700.0 * power[i] * (1.0 - exp(-t * 2.2));
    float band = exp(-pow((r - R) / (70.0 + 50.0 * t), 2.0)) * exp(-t * 1.6) * smoothstep(0.0, 0.04, t);
    if (r > 1.0) off -= normalize(vec2(P.x - A.x, P.y - A.y)) * band * 22.0 * z * power[i]; }
  vec3 c = grabAt(T0, p + off * uDpr).rgb;
  for (int i = 0; i < ${N}; i++){ if (float(i) >= n) break; float t = k[i]; vec2 A = at[i] / uDpr; float pw = power[i];
    vec2 dq = vec2(P.x - A.x, (P.y - A.y + t * 60.0 * z)) / z; float dl = length(dq * vec2(1.0, 1.4));
    if (tier > 0.5 && dl < 340.0 * pw && t < 3.0) { float dust = smoothstep(0.48, 0.72, fbm3(dq * 0.012 + vec2(seed[i], -t * 0.5))) * smoothstep(320.0 * pw, 60.0, dl) * smoothstep(0.02, 0.12, t) * exp(-t * 1.1);
      c = mix(c, vec3(0.94, 0.9, 0.82), clamp(dust * 0.8, 0.0, 0.85)); }
    float colW = (26.0 + 30.0 * pw) * z, cx = abs(P.x - A.x + (P.y - A.y) * 0.08), cl = column[i];
    float col = cl * smoothstep(colW * 2.6, 0.0, cx) * smoothstep(A.y + 20.0 * z, A.y - 30.0 * z, P.y) * (0.75 + 0.25 * vn(vec2(P.y * 0.03, t * 30.0)));
    float core = cl * smoothstep(colW * 0.45, 0.0, cx) * smoothstep(A.y + 10.0 * z, A.y - 20.0 * z, P.y);
    float bloom = smoothstep(260.0 * pw, 0.0, length(vec2(P.x - A.x, (P.y - A.y) / 0.7)) / z) * exp(-t * 3.0) * smoothstep(0.0, 0.03, t);
    // light as the painter shows it (the design board: matte mineral gold, never metal shine): pigment and bright paper
    c = mix(c, light[i] * 0.69, clamp(col * 0.55 + bloom * 0.22, 0.0, 0.7));                         // a wash of matte pigment, not light
    c = mix(c, PAPER * 1.03, core * 0.9); }                                                            // its core: paper left bright
  c = mix(c, vec3(1.0, 0.96, 0.86), flash);
  o = vec4(c, 1.0);
}`);
  const OVER_LITE = post.program(post.LIB + `
uniform vec2 at[${N}]; uniform float k[${N}], power[${N}], column[${N}]; uniform vec3 light[${N}]; uniform float zc, n, flash;
void main(){
  vec2 P = sp() / uDpr; float z = zc; vec3 col3 = vec3(0.0); float a = 0.0;
  for (int i = 0; i < ${N}; i++){ if (float(i) >= n) break; float t = k[i]; vec2 A = at[i] / uDpr; float pw = power[i];
    float colW = (26.0 + 30.0 * pw) * z, cx = abs(P.x - A.x + (P.y - A.y) * 0.08), cl = column[i];
    float col = cl * smoothstep(colW * 2.6, 0.0, cx) * smoothstep(A.y + 20.0 * z, A.y - 30.0 * z, P.y);
    float core = cl * smoothstep(colW * 0.45, 0.0, cx) * smoothstep(A.y + 10.0 * z, A.y - 20.0 * z, P.y);
    float bloom = smoothstep(260.0 * pw, 0.0, length(vec2(P.x - A.x, (P.y - A.y) / 0.7)) / z) * exp(-t * 3.0) * smoothstep(0.0, 0.03, t);
    float m = clamp(col * 0.55 + bloom * 0.22, 0.0, 0.7); vec3 c = mix(light[i] * 0.69, PAPER * 1.03, core);
    m = max(m, core * 0.95); col3 = col3 * (1.0 - m) + c * m; a = a + m * (1.0 - a); }
  float f = flash; col3 = col3 * (1.0 - f) + vec3(1.0, 0.96, 0.86) * f; a = a + f * (1.0 - a);
  o = vec4(col3, a);
}`);
  const live = [], free = [];
  /** an impact at ground point (x, y). o: {power 0.5..2, reach (world units of the fissure), cracks (count), light
   *  ('gold'|'cinnabar'|'azurite'|'malachite'|'ink'), column (seconds the column of light stands, 0 none), flash (peak 0..1),
   *  debris (count of clods), sparks (count), life (s)} */
  function hit(o) {
    const b = { x: o.x, y: o.y, t: 0, power: o.power || 1, reach: o.reach || 420, cracks: o.cracks || 8, light: LIGHT[o.light] || LIGHT.gold, column: o.column || 0, flash: o.flash ?? 0.6, life: o.life || 3.4, seed: (o.seed ?? Math.random() * 40) % 40 };
    if (live.length >= N) free.push(live.shift().F);
    b.F = free.pop() || post.target(FW, FH); b.box = b.reach * 1.15;
    post.pass(BAKE, b.F, [], (u) => { gl.uniform1f(u.seed, b.seed); gl.uniform1f(u.reach, b.reach); gl.uniform1f(u.cracks, b.cracks); gl.uniform1f(u.power, b.power); gl.uniform1f(u.box, b.box); });
    live.push(b);
    const dk = [0.35, 0.6, 1][Q.tier];
    debris.burst({ x: o.x, y: o.y, n: Math.round((o.debris ?? 140) * dk), sparks: Math.round((o.sparks ?? 70) * dk), power: b.power, light: b.light, seed: b.seed });
    return b;
  }
  post.onRestore(() => { for (const b of live) post.pass(BAKE, b.F, [], (u) => { gl.uniform1f(u.seed, b.seed); gl.uniform1f(u.reach, b.reach); gl.uniform1f(u.cracks, b.cracks); gl.uniform1f(u.power, b.power); gl.uniform1f(u.box, b.box); }); });
  const A = new Float32Array(N * 2), K = new Float32Array(N), PW = new Float32Array(N), SD = new Float32Array(N), CL = new Float32Array(N), LT = new Float32Array(N * 3);
  function arrays(V) { let fl = 0; live.forEach((b, i) => { A[i * 2] = V.sx(b.x); A[i * 2 + 1] = V.sy(b.y); K[i] = b.t; PW[i] = b.power; SD[i] = b.seed; LT.set(b.light, i * 3);
    CL[i] = b.t < b.column ? Math.min(1, b.t / 0.03) * (1 - b.t / b.column) ** 0.5 : 0; fl = Math.max(fl, b.flash * Math.max(0, 1 - b.t / 0.09) * Math.min(1, b.t / 0.01 + 0.3)); }); return fl; }
  const setArr = (V, fl) => (u) => { gl.uniform2fv(u.at, A); gl.uniform1fv(u.k, K); gl.uniform1fv(u.power, PW); gl.uniform1fv(u.seed, SD); if (u.column) gl.uniform1fv(u.column, CL); gl.uniform3fv(u.light, LT); gl.uniform1f(u.zc, V.z / V.dpr); gl.uniform1f(u.n, live.length); if (u.flash) gl.uniform1f(u.flash, fl); if (u.tier) gl.uniform1f(u.tier, Q.tier); };
  function drawGround(V, dt) {
    for (let i = 0; i < live.length; i++) { const b = live[i]; b.t += dt; if (b.t > b.life) { free.push(b.F); live.splice(i--, 1); continue; } }
    if (!live.length) return;
    const off = api.off || new Set();
    if (!off.has('fissure')) for (const b of live) { const X = V.sx(b.x), Y = V.sy(b.y), e = b.box * V.z, r = [X - e, Y - e * 0.62, X + e, Y + e * 0.62];
      post.quad(GROUND, r, [post.grab(r), b.F.tex], (u) => { gl.uniform2f(u.at, X, Y); gl.uniform1f(u.k, b.t); gl.uniform1f(u.zc, V.z / V.dpr); gl.uniform1f(u.power, b.power); gl.uniform1f(u.seed, b.seed); gl.uniform1f(u.box, b.box); gl.uniform3f(u.light, b.light[0], b.light[1], b.light[2]); }, null); }
    if (!off.has('rings') && live.some((b) => b.t < 1.8)) { const fl = arrays(V);
      post.pass(RINGS, null, [], (u) => { setArr(V, fl)(u); }, 'multiply');
    }
  }
  function drawOver(V, dt) {
    const off = api.off || new Set();
    if (!off.has('over') && live.length && live.some((b) => b.t < 3)) { const fl = arrays(V), W = gl.canvas.width, H = gl.canvas.height, r = [0, 0, W, H];
      if (Q.tier > 0) post.pass(OVER, null, [post.grab(r)], setArr(V, fl), null);
      else post.pass(OVER_LITE, null, [], setArr(V, fl), 'over'); }
    if (!off.has('debris')) debris.draw(V, dt);
  }
  const api = { hit, drawGround, drawOver, get live() { return live.length + debris.live; }, reset() { while (live.length) free.push(live.pop().F); debris.reset(); }, LIGHT, off: null };
  return api;
}
