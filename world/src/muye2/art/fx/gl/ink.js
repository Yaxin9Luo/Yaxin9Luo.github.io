// 墨入湿纸: ink (or a mineral pigment) dropped into wet paper, on the ground. WebGL2 only (art/fx/gl/index.js calls it).
// From study (a) of the render spike (lab/game-studies/RENDER-SPIKE.md), made to live on the field:
//   - each bloom is anchored to a ground point and has its own small simulation (CELLS wide, its own extent in world
//     units), laid on the ground plane every frame as one quad, so it rides with the field as the camera moves;
//   - the simulation: water (r), pigment in the water (g), pigment settled in the paper (b), paper that has been wet (a).
//     Water enters dry paper only along the fibres; the pigment rides with the water's flux (so it is carried to the
//     drying rim and pools there); thick pigment settles at once, thin pigment travels; the paper's valleys hold more;
//   - a bloom is a script of splats (clear water first, then the pigment, then drops flung onto dry paper), then it
//     dries (evap) and sinks into the paper (sink) and is gone.
// Readability: the hero's patch is left bare (the splats avoid it and the composite thins over it); fire is laid thin,
// because strong cinnabar on the ground means danger and nothing else.
const CELLS = [256, 160], STEPS = 10, MAX = 5;      // five sheets: a boss's ink and the treasures' washes can overlap
const paper = [239, 231, 214];
const K = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return v.map((c, i) => -Math.log(Math.max(4, c) / paper[i])); };
// what a pigment takes out of the paper at full strength (density 1), and how strong it may get on the ground
export const PIGMENTS = { ink: { k: [2.24, 2.5, 2.66], max: 1.12 }, earth: { k: [2.24, 2.5, 2.66], max: 0.9 }, metal: { k: K('#9A7634'), max: 0.75 }, water: { k: K('#2F4F7A'), max: 0.85 }, wood: { k: K('#3F7D6A'), max: 0.8 }, fire: { k: K('#B8321F'), max: 0.38 } };

export function createInk(post) {
  const gl = post.gl;
  const PREP = post.program(post.LIB + `uniform float seed; void main(){ vec2 q = gl_FragCoord.xy;
    // the paper, made once: r fibre (short random hairs, from noise along a slowly turning direction), g the water a dry
    // cell needs before it takes any, b granulation
    float ang = vn(q * 0.03 + seed) * 12.566; vec2 fd = vec2(cos(ang), sin(ang)), pd = vec2(-fd.y, fd.x);
    float fib = smoothstep(0.55, 0.95, vn(vec2(dot(q, pd) * 0.9, dot(q, fd) * 0.12) + seed * 3.1)) * 0.85 + 0.15 * vn(q * 0.5);
    o = vec4(fib, (0.03 + 0.22 * (1.0 - fib) * (0.7 + 0.6 * vn(q * 0.07))) / 0.3, fbm(q * 0.33), 1.0); }`);
  const STEP = post.program(post.LIB + `
uniform sampler2D T0, T1; uniform float evapA[5], sinkA[5];
float gate(float wr, float t, float wg){ if (wr > 0.008) return 1.0; return smoothstep(t, t + 0.025, wg); }
void main(){
  vec2 px = 1.0 / uRes, uv = gl_FragCoord.xy * px; int k = min(4, int(gl_FragCoord.x / 256.0)); float evap = evapA[k], sink = sinkA[k];
  vec4 c = texture(T0, uv), pc = texture(T1, uv); float fc = pc.r, tc = pc.g * 0.3;
  float wn = c.r, pn = c.g, lp = -4.0 * c.g;
  vec2 offs[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
  for (int i = 0; i < 4; i++){
    vec2 u2 = uv + offs[i] * px; vec4 q = texture(T0, u2), pq = texture(T1, u2);
    float f = q.r - c.r, g = f > 0.0 ? gate(c.r, tc, q.r) : gate(q.r, pq.g * 0.3, c.r);
    float cf = 0.5 * (fc + pq.r); float flux = 0.23 * g * (0.06 + 0.94 * cf * cf) * f;
    wn += flux; pn += flux * (f > 0.0 ? q.g / max(q.r, 0.03) : c.g / max(c.r, 0.03)); lp += q.g;
  }
  float wet = smoothstep(0.004, 0.03, c.r);
  pn += 0.008 * wet * lp;
  float rim = 1.0 - smoothstep(0.02, 0.2, c.r);
  wn = max(0.0, wn - evap * (0.35 + 1.6 * rim));
  float rate = (0.0007 + 0.006 * smoothstep(0.6, 1.4, pn / max(wn, 0.05)) + 0.05 * (1.0 - smoothstep(0.0, 0.12, wn))) * (0.4 + 1.2 * pc.b);
  float dep = max(pn, 0.0) * rate;
  // the edge of the sheet is dry paper that never takes water (nothing reaches the quad's border)
  vec2 lc = vec2(gl_FragCoord.x - float(k) * 256.0, gl_FragCoord.y), e = min(lc, vec2(256.0, uRes.y) - lc); float keep = smoothstep(1.0, 6.0, min(e.x, e.y));
  o = vec4(wn * keep, max(0.0, pn - dep) * keep, c.b * (1.0 - sink) + dep, max(c.a * (1.0 - 0.0006), wet));
}`);
  const SPLAT = post.program(post.LIB + `
uniform sampler2D T0; uniform vec2 at, rad; uniform float water, ink, rough, seed, ring, off;
void main(){
  vec2 px = 1.0 / uRes, uv = gl_FragCoord.xy * px; vec4 c = texture(T0, uv);
  vec2 d = (gl_FragCoord.xy - vec2(off, 0.0) - at) / rad; float ang = atan(d.y, d.x), r = length(d);
  float edge = 1.0 + rough * (fbm(vec2(ang * 2.2 + seed, seed) * 1.7) - 0.5) * 1.4 + rough * 0.25 * (vn(gl_FragCoord.xy * 0.25 + seed) - 0.5);
  float m = smoothstep(edge, edge - 0.12, r) * step(off, gl_FragCoord.x) * step(gl_FragCoord.x, off + 256.0);   // only in its own sheet of the atlas
  if (ring > 0.0) m *= smoothstep(ring - 0.08, ring + 0.04, r);              // a ring: the middle left dry
  o = vec4(max(c.r, water * m), c.g + ink * m * (0.75 + 0.5 * fbm(gl_FragCoord.xy * 0.12 + seed)), c.b, max(c.a, m * step(0.01, water)));
}`);
  // The feathering, the tide line and the wetness depend only on the sheet, not on the screen: worked out once a frame on a
  // texture three times the sheet (FEATHER), so the pass over the screen (COMP) is one read and the paper's grain. At a 4K
  // canvas a boss's bloom covers millions of pixels; this kept the great moments in budget when the canvas cap was lifted.
  const FS = 3, FEATHER = post.program(post.LIB + `
uniform sampler2D T0; uniform float tier, slot; uniform vec2 sim;
vec4 S(vec2 v){ return texture(T0, vec2((slot + clamp(v.x, 0.5 / 256.0, 1.0 - 0.5 / 256.0)) / 5.0, v.y)); }
void main(){
  vec2 vQ = gl_FragCoord.xy / uRes;
  vec4 st = S(vQ);
  float d = st.b + st.g * 0.8;
  // feathering: a short line integral of the pigment along the fibre direction, kept on fine streaks across it
  vec2 q = vQ * sim; float ang = vn(q * 0.04) * 12.566; vec2 fd = vec2(cos(ang), sin(ang)), pd = vec2(-fd.y, fd.x), stp = fd / sim;
  float streak = smoothstep(0.42, 0.9, vn(vec2(dot(q, pd) * 1.6, dot(q, fd) * 0.1)));
  float lic = 0.0; if (tier > 0.5) for (int i = 1; i <= 5; i++){ float k = float(i) * 1.2, fall = 1.0 - k / 8.0; vec4 a1 = S(vQ + stp * k), a2 = S(vQ - stp * k); lic = max(lic, max(a1.b + a1.g * 0.8, a2.b + a2.g * 0.8) * fall); }
  vec2 g = 3.0 / sim; float a0 = S(vQ + vec2(g.x, 0)).a, a1 = S(vQ - vec2(g.x, 0)).a, a2 = S(vQ + vec2(0, g.y)).a, a3 = S(vQ - vec2(0, g.y)).a;
  o = vec4(d, lic * 0.75 * streak * smoothstep(0.3, 0.7, st.a), clamp(length(vec2(a0 - a1, a2 - a3)) * 1.5, 0.0, 1.0), st.r);
}`);
  // laid on the ground as one quad; multiplied into what is drawn. vQ: 0..1 over the sheet, y down
  const COMP = post.program(post.LIB.replace('out vec4 o;', 'out vec4 o; in vec2 vQ;') + `
uniform sampler2D T0; uniform vec3 kp; uniform float maxTone, zpx, tier, uLS; uniform vec2 sim, hero; uniform vec4 heroR;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uLS, P = p / uDpr;      // drawn into the half-size layer (a quad's rows run bottom-up there)
  vec4 f = texture(T0, vQ);
  float d = max(f.r * (0.9 + 0.2 * fbm3(P * 0.35)), f.g);
  // the hero's patch stays bare paper: the bloom thins over it
  vec2 hv = (P - heroR.xy) / heroR.zw; d *= mix(0.15, 1.0, smoothstep(0.7, 1.4, dot(hv, hv)));
  float tone = maxTone * (1.0 - exp(-1.35 * d));
  vec3 col = exp(-tone * kp);
  float wetness = smoothstep(0.0, 0.2, f.a);
  col *= mix(vec3(1.0), vec3(0.915, 0.925, 0.94), wetness);                                // wet paper: a shade darker, a little cooler
  col *= 1.0 - 0.035 * f.b * (1.0 - wetness);                                               // a faint tide line where water dried
  o = vec4(col, 1.0);
}`, post.QUAD_VS);
  let FT = null; const feather = () => FT || (FT = post.target(CELLS[0] * FS, CELLS[1] * FS, true));
  // every bloom is laid at half the canvas's size into one layer, multiplied onto the screen once (a wash needs no more)
  let LS = 2; const BLIT = post.program(post.LIB + `
uniform sampler2D T0;
void main(){ o = texture(T0, gl_FragCoord.xy / uRes); }`); let LT = null;
  function layer() { LS = gl.canvas.width > 3000 ? 3 : 2; const w = Math.ceil(gl.canvas.width / LS), h = Math.ceil(gl.canvas.height / LS); if (!LT || LT.w !== w || LT.h !== h) { if (LT) post.free(LT); LT = post.target(w, h); } return LT; }

  // All five sheets live side by side in one atlas (CELLS[0] x MAX wide), so a step of the simulation is one pass for every
  // bloom: the passes, not their size, were the cost in a great moment (each pass has a fixed cost in the browser's GPU
  // process; ten steps for each of five blooms a frame took a 4K canvas over budget).
  const free = [0, 1, 2, 3, 4], live = [];
  let PAPER = null, AT = null;
  function atlas() { if (!AT) { AT = { A: post.target(CELLS[0] * MAX, CELLS[1], true), B: post.target(CELLS[0] * MAX, CELLS[1], true), i: 0 }; post.clear(AT.A); post.clear(AT.B); } return AT; }
  const cur = () => (AT.i ? AT.B : AT.A), next = () => (AT.i ? AT.A : AT.B);
  function sheet() { const k = free.pop(), A = atlas(); post.screen();   /* flushes the sprites first */ for (const T of [A.A, A.B]) { gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.enable(gl.SCISSOR_TEST); gl.scissor(k * CELLS[0], 0, CELLS[0], CELLS[1]); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); return k; }
  function paperTex() { if (!PAPER) { PAPER = post.target(CELLS[0] * MAX, CELLS[1]); post.pass(PREP, PAPER, [], (u) => gl.uniform1f(u.seed, 7.3)); } return PAPER.tex; }
  post.onRestore(() => { PAPER = null; if (AT) { post.clear(AT.A); post.clear(AT.B); } });

  /** a bloom on the ground at (x, y): w world units wide (its height is 0.62 of that, the ground's squeeze), a script of
   *  splats [time, u, v, ru, rv, water, ink, rough, ring?] in cells, a pigment, and its timing {dry, sink, life} in s */
  function bloom(o) {
    while (live.length >= MAX) { const old = live.shift(); free.push(old.k); }
    const b = { x: o.x, y: o.y, w: o.w || 600, t: 0, life: o.life || 7, dry: o.dry || [1.6, 3.0], sink: o.sink || 4.3, splats: o.splats, done: 0, pig: PIGMENTS[o.pigment] || PIGMENTS.ink, k: sheet(), hero: o.hero !== false };
    live.push(b); return b;
  }
  function splats(b, dt) {
    b.t += dt;
    for (; b.done < b.splats.length && b.splats[b.done][0] <= b.t; b.done++) { const s = b.splats[b.done], src = cur(), dst = next(); AT.i ^= 1;
      const grow = [1.35, 1.15, 1][api.quality ? api.quality.tier : 2];
      post.pass(SPLAT, dst, [src.tex], (u) => { gl.uniform2f(u.at, s[1], s[2]); gl.uniform2f(u.rad, s[3] * grow, s[4] * grow); gl.uniform1f(u.water, s[5]); gl.uniform1f(u.ink, s[6]); gl.uniform1f(u.rough, s[7]); gl.uniform1f(u.seed, s[1] * 0.37 + s[2]); gl.uniform1f(u.ring, s[8] || 0); gl.uniform1f(u.off, b.k * CELLS[0]); }); }
  }
  const EV = new Float32Array(MAX), SK = new Float32Array(MAX);
  function stepAll(dt) {
    EV.fill(0.05); SK.fill(0);      // an empty sheet dries at once
    for (const b of live) { EV[b.k] = b.t < b.dry[0] ? 0.00017 : b.t < b.dry[1] ? 0.0004 : 0.0017; SK[b.k] = b.t < b.sink ? 0 : 0.0016; }
    const tier = api.quality ? api.quality.tier : 2, n = Math.max(1, Math.round([3, 6, STEPS][tier] * Math.min(2, dt * 60)));
    for (let i = 0; i < n; i++) { const src = cur(), dst = next(); AT.i ^= 1; post.pass(STEP, dst, [src.tex, paperTex()], (u) => { gl.uniform1fv(u.evapA, EV); gl.uniform1fv(u.sinkA, SK); }); }
  }
  /** step every bloom by dt and lay it on the ground; V: {sx(x), sy(y), z (device px per unit), dpr, KY, hero: [X, Y] device px or null} */
  // On a tiled GPU (Apple) every switch of render target while the screen is half drawn writes the whole screen out and
  // reads it back: at a 4K canvas that, not the shading, was the ink's cost (a bloom steps ten times a frame). So the
  // stepping and the layer are made after the frame's last draw (after(), from glfx.drawOver), and the ground pass only
  // multiplies the finished layer in: the wash is one frame behind, which a wash does not show.
  let ready = false;
  /** lay the blooms on the ground: the layer made at the end of the last frame */
  function draw() { if (ready && live.length && LT) post.pass(BLIT, null, [LT.tex], null, 'multiply'); }
  /** step every bloom by dt and make the layer for the next frame; V: {sx(x), sy(y), z, dpr, KY, hero: [X, Y] device px or null} */
  function after(V, dt) {
    let L = null; ready = false;
    for (let i = 0; i < live.length; i++) { const b = live[i]; if (b.t > b.life) { free.push(b.k); live.splice(i--, 1); } }
    if (!live.length) return;
    if (dt > 0) { for (const b of live) splats(b, dt); stepAll(dt); }
    for (const b of live) {
      const hw = b.w / 2, hh = (b.w * CELLS[1] / CELLS[0]) / 2 / V.KY, r = [V.sx(b.x - hw), V.sy(b.y - hh), V.sx(b.x + hw), V.sy(b.y + hh)];
      const H = V.hero, d = V.dpr;
      if (!L) { L = layer(); post.clear(L, 1, 1, 1, 1); }
      const F = feather(); post.pass(FEATHER, F, [cur().tex], (u) => { gl.uniform1f(u.tier, api.quality ? api.quality.tier : 2); gl.uniform2f(u.sim, CELLS[0], CELLS[1]); gl.uniform1f(u.slot, b.k); });
      post.quad(COMP, r, [F.tex], (u) => { gl.uniform3f(u.kp, b.pig.k[0], b.pig.k[1], b.pig.k[2]); gl.uniform1f(u.maxTone, b.pig.max); gl.uniform1f(u.tier, api.quality ? api.quality.tier : 2); gl.uniform2f(u.sim, CELLS[0], CELLS[1]);
        gl.uniform4f(u.heroR, H && b.hero ? H[0] / d : -1e5, H && b.hero ? H[1] / d : -1e5, 62 * V.z / d, 30 * V.z / d); if (u.uLS) gl.uniform1f(u.uLS, LS); }, 'multiply', L); }
    ready = !!L;
  }
  const api = { bloom, draw, after, get live() { return live.length; }, CELLS, reset() { while (live.length) free.push(live.pop().k); }, quality: null };
  return api;
}

// ---------------------------------------------------------------- scripts, in cells of a 256 x 160 sheet (centre 128, 80)
const C = [128, 80];
/** a boss arrives: the ground wetted in three pulls, ink pressed in at his feet, drops flung onto dry paper */
export function bossScript(scale = 1) {
  const [x, y] = C, s = scale;
  return [
    [0.05, x, y + 4, 120 * s, 70 * s, 0.5, 0, 0.9], [0.13, x - 70 * s, y + 14 * s, 95 * s, 48 * s, 0.48, 0, 0.8], [0.2, x + 75 * s, y - 6 * s, 80 * s, 46 * s, 0.48, 0, 0.8],
    [0.45, x + 6, y + 2, 30 * s, 11 * s, 1.0, 2.4, 0.55], [0.58, x - 34 * s, y + 10 * s, 16 * s, 8 * s, 1.0, 1.4, 0.6], [0.66, x + 40 * s, y - 3 * s, 14 * s, 7 * s, 1.0, 1.3, 0.6],
    [0.8, x - 6, y + 20 * s, 34 * s, 6 * s, 0.9, 0.8, 0.7],
    [0.9, x + 118 * s, y - 30 * s, 2.6, 2.0, 0.6, 1.6, 0.3], [0.92, x - 116 * s, y + 30 * s, 2.2, 1.8, 0.6, 1.6, 0.3], [0.95, x + 104 * s, y + 36 * s, 1.7, 1.5, 0.6, 1.6, 0.3], [0.97, x - 100 * s, y - 44 * s, 1.5, 1.3, 0.6, 1.5, 0.3],
  ];
}
/** a treasure evolves round the hero: a ring of paper wetted round him (his own patch left dry), then the element's
 *  pigment let down thin at six points along it, so it spreads into one broken ring of wash */
export function evolveScript() {
  const [x, y] = C, out = [[0.02, x, y + 6, 112, 62, 0.5, 0, 0.6, 0.45]];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4, r = 0.72, t = 0.18 + i * 0.07;
    out.push([t, x + Math.cos(a) * 112 * r, y + 6 + Math.sin(a) * 62 * r, 30 + (i % 3) * 6, 14 + (i % 2) * 3, 0.9, 0.42, 0.6]); }   // let down thin and wide: a ring of wash, not six pools (the lead: round pools read as blots)
  return out;
}
