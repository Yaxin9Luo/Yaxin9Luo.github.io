// The second set of effects for the side-view battle: every blow is a small painting made in time.
// Contract: section 7 of lab/game-studies/SPEC-V2.md.
//
//   const fx = await loadFx();
//   fx.onEvent(event, game);          // a simulation event becomes brushwork
//   fx.drawUnder(ctx, cam, dt);       // marks on the ground, beneath the figures (and what the battle has left there)
//   fx.drawOver(ctx, cam, dt);        // strokes in front of the figures; the boon burst across the screen
//   fx.setTime(k);                    // 0 morning .. 1 dusk
//
// How it works. gen/fx2.gen.mjs bakes single strokes with PaintSim into an atlas. An effect is a short score that
// lays several of those strokes in time: each stroke is DRAWN ON (a rectangle that widens along the way the brush
// travelled), held, then dries (a dry-brush twin of the same stroke takes its place) and thins in a few steps.
// Thrown drops fly and land. What lands or is laid on the ground stays under the figures as a mark: it fades to a
// low strength within a few seconds, and a stretch of ground holds only two, so the ground reads as a few strokes.
// A foe showing its warning (windup, brace, draw) is never left under paint for more than two or three frames.
//
// What the contract leaves open, and what this module does:
//   - There is no setView. The view is read from ctx.canvas: device pixels, the ground line at GROUND of the height,
//     one world unit = canvas.height / 900 device pixels at zoom 1. Same camera as art/index.js (cam.x, y, zoom, shakeX/Y).
//     loadFx({ground, viewHeight}) changes the two numbers if the second scene needs it.
//   - Strokes that belong to the hero (the cut, the sweep, the streaks of the charge) follow him: the module keeps the
//     `game` object it was last given in onEvent and reads game.hero from it while drawing.
//   - Which boons are owned is read from game.hero.boons and from `boon` events.
//   - Event fields beyond SPEC-V2 that are honoured if present: swing/hit/sweep/shock {element} (forces an element's
//     version), hit {crit}, blocked {dir, reflect}, braced {broken}, loose {side}. {type: 'fx:clear'} empties everything;
//     {type: 'fx:count'} writes the number of live strokes onto the event (over, under, waiting), for the preview.
const FILES = {
  json: new URL('./baked/fx2.json', import.meta.url).href,
  main: new URL('./baked/fx2.webp', import.meta.url).href,
  big: new URL('./baked/fx2-big.webp', import.meta.url).href,
  soft: new URL('./baked/fx2-soft.webp', import.meta.url).href,
};
const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('fx2: cannot load ' + src)); i.src = src; });
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// the five elements: pigment, and which element feeds which (相生: wood feeds fire, fire earth, earth metal, metal water, water wood)
const TONE = { fire: 'red', water: 'blue', wood: 'green', metal: 'gold', earth: 'ochre' };
const FED_BY = { fire: 'wood', earth: 'fire', metal: 'earth', water: 'metal', wood: 'water' };
const BOON_EL = { emberBlade: 'fire', wildfire: 'fire', coldTide: 'water', spring: 'water', galeLeap: 'wood', arrowRain: 'wood', keenEdge: 'metal', mirrorShields: 'metal', quake: 'earth', deepRoots: 'earth' };
const TOP = 76, BOTTOM = -84;                                   // the band of world y in which a mark may be left on the ground
// The marks that stay (tester F-2.4: the ground under a long fight became one stripe). A mark starts at the strength it was
// left with, falls to FLOOR of that within FADE_S seconds, and stays there. Each STRETCH of ground holds PER marks: when
// another lands, the oldest there fades out over GONE_S. What a drop leaves is too small to count and is gone in DROP_S.
const STRETCH = 160, PER = 2, FADE_S = 3.5, FLOOR = 0.3, GONE_S = 0.6, DROP_S = 1.4, MARKS_MAX = 260;
// Telegraphs (same finding): a foe in one of these states is showing its warning. After TELE_FRAMES frames a stroke in front
// of the figures that reaches into such a foe's box is drawn at TELE_OVER of its strength, and a mark under it at TELE_UNDER.
const TELE = { windup: 1, brace: 1, draw: 1 }, TELE_S = 1.5 / 60, TELE_OVER = 0.22, TELE_UNDER = 0.4, TELE_HALF = 30, TELE_TALL = 84;
const HERO_Y = 66;                                              // sim: a swing is reported at hero.y + 60% of his height

export async function loadFx({ ground = 0.82, viewHeight = 900 } = {}) {
  const [atlas, main, big, soft] = await Promise.all([fetch(FILES.json).then((r) => r.json()), loadImage(FILES.main), loadImage(FILES.big), loadImage(FILES.soft)]);
  const IMG = [main, big, soft], CELL = atlas.cells;                 // a cell names its sheet by number: 0 main, 1 big, 2 soft
  const count = {};                                             // how many variants a stem has: 'lick' -> 4
  for (const name in CELL) { const m = /^(.*)_(\d+)$/.exec(name); if (m) count[m[1]] = Math.max(count[m[1]] || 0, +m[2] + 1); }

  let time = 0, G = null, clock = 0;
  const own = new Set();                                        // boon ids
  let seed = 20261118;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };   // for the look only
  const R = (a, b) => a + rnd() * (b - a);
  const pick = (stem) => CELL[`${stem}_${Math.floor(rnd() * (count[stem] || 1))}`];

  // ---------------------------------------------------------------- the marks: a pool, two live lists
  const pool = [], under = [], over = [];
  const blank = () => ({ c: null, dry: null, cells: null, x: 0, y: 0, rot: 0, dir: 1, kx: 1, ky: 1, t: 0, tin: 0, hold: 0, tout: 0, tail: 0, vx: 0, vy: 0, g: 0, drag: 0, aim: 0, a: 1, att: 0, scr: 0, land: 0, gy: 0, stay: 0, grow: 0, per: 0, ph: 0, white: 0 });
  /** lay one stroke. o: t (delay), in (seconds to draw it on), hold, out (seconds to thin), tail (it leaves from its start instead of fading), sink (it goes back the way it came),
      rot, dir, k | kx, ky, a, dry (cell name), under, att (follows the hero), scr (screen space), vx, vy, g, drag, aim (turns along its flight),
      land (dies on the ground and leaves itself there), stay (strength it is left at when it ends), grow, cells + per (a cycle of cells) */
  function put(c, x, y, o) {
    if (typeof c === 'string') c = CELL[c];
    if (!c) return null;
    const m = pool.pop() || blank();
    m.c = c; m.x = x; m.y = y; m.t = -(o.t || 0); m.tin = o.in || 0; m.hold = o.hold ?? 0.1; m.tout = o.out ?? 0.15; m.tail = o.sink ? 2 : o.tail ? 1 : 0;
    m.rot = o.rot || 0; m.dir = o.dir || 1; m.kx = o.kx ?? o.k ?? 1; m.ky = o.ky ?? o.k ?? 1; m.a = o.a ?? 1;
    m.dry = o.dry ? CELL[o.dry] : null; m.cells = o.cells || null; m.per = o.per || 0.09; m.ph = o.ph || 0;
    m.vx = o.vx || 0; m.vy = o.vy || 0; m.g = o.g || 0; m.drag = o.drag || 0; m.aim = o.aim ? 1 : 0;
    m.att = o.att ? 1 : 0; m.scr = o.scr ? 1 : 0; m.land = o.land ? 1 : 0; m.gy = o.gy || 0; m.stay = o.stay || 0; m.grow = o.grow || 0; m.white = o.white ? 1 : 0;
    (o.under ? under : over).push(m);
    return m;
  }

  // ---------------------------------------------------------------- drawing one stroke
  // (X, Y): device pixel of its pivot; z: device pixels a unit; the part of it between r0 and r1 along its axis
  function blit(ctx, c, X, Y, z, dir, kx, ky, rot, alpha, r0, r1) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    ctx.setTransform(dir * kx * z * cos, kx * z * sin, -dir * ky * z * sin, ky * z * cos, X, Y);
    ctx.globalAlpha = alpha;
    const img = IMG[c[0]], sx = c[1], sy = c[2], sw = c[3], sh = c[4], w = c[7], h = c[8], ax = c[9];
    if (r0 <= 0 && r1 >= 1 || ax === 0) ctx.drawImage(img, sx, sy, sw, sh, -c[5], -c[6], w, h);
    else if (ax === 1) ctx.drawImage(img, sx + sw * r0, sy, sw * (r1 - r0), sh, -c[5] + w * r0, -c[6], w * (r1 - r0), h);
    else if (ax === 2) ctx.drawImage(img, sx, sy + sh * (1 - r1), sw, sh * (r1 - r0), -c[5], -c[6] + h * (1 - r1), w, h * (r1 - r0));
    else ctx.drawImage(img, sx, sy + sh * r0, sw, sh * (r1 - r0), -c[5], -c[6] + h * r0, w, h * (r1 - r0));
  }

  // ---------------------------------------------------------------- the marks that stay: a short list, each fading, capped per stretch of ground
  const marks = [], markPool = [], stretches = new Map();
  function leave(c, x, y, dir, kx, ky, rot, a) {
    if (typeof c === 'string') c = CELL[c];
    if (!c || y > TOP || y < BOTTOM) return;
    const q = markPool.pop() || {}; q.c = c; q.x = x; q.y = y; q.dir = dir; q.kx = kx; q.ky = ky; q.rot = rot; q.a = a; q.age = 0; q.die = -1;
    q.r = Math.max(c[7] * kx, c[8] * ky) * 0.6; q.small = c[7] * kx < 30;
    marks.push(q);
    if (q.small) return;
    const i = Math.floor(x / STRETCH); let L = stretches.get(i); if (!L) stretches.set(i, L = []);
    L.push(q); while (L.length > PER) { const old = L.shift(); if (old.die < 0) old.die = 0; }          // the oldest on this stretch gives way
  }
  // the foes that are showing a warning this frame: [x, y of the feet] pairs, read from the game
  const tele = []; let teleN = 0;
  function readTelegraphs() {
    teleN = 0; const us = G && G.units; if (!us) return;
    for (let i = 0; i < us.length; i++) { const u = us[i]; if (u.side === 'zhou' || !TELE[u.state]) continue;
      if (teleN * 2 >= tele.length) tele.push(0, 0); tele[teleN * 2] = u.x; tele[teleN * 2 + 1] = (u.lane || 0) * 18; teleN++; }
  }
  const nearTelegraph = (x, r) => { for (let i = 0; i < teleN; i++) if (Math.abs(tele[i * 2] - x) < TELE_HALF + r) return true; return false; };
  function drawMarks(ctx, f, dt) {
    const half = f.w / 2 / f.z + 120, x0 = f.cx - half, x1 = f.cx + half; let n = 0;
    if (marks.length > MARKS_MAX) for (let i = 0, over_ = marks.length - MARKS_MAX; i < marks.length && over_ > 0; i++) if (marks[i].die < 0) { marks[i].die = 0; over_--; }
    for (let i = 0; i < marks.length; i++) {
      const q = marks[i]; q.age += dt;
      let al = q.small ? q.a * (1 - q.age / DROP_S) : q.a * (FLOOR + (1 - FLOOR) * Math.pow(Math.max(0, 1 - q.age / FADE_S), 2));
      if (q.die >= 0) { q.die += dt; al *= 1 - q.die / GONE_S; }
      if (al <= 0.004) { if (!q.small) { const L = stretches.get(Math.floor(q.x / STRETCH)), j = L ? L.indexOf(q) : -1; if (j >= 0) L.splice(j, 1); } markPool.push(q); continue; }
      marks[n++] = q;
      if (q.x < x0 || q.x > x1) continue;
      if (teleN && nearTelegraph(q.x, q.r)) al *= TELE_UNDER;
      blit(ctx, q.c, f.ox + (q.x - f.cx) * f.z, f.oy - (q.y - f.cy) * f.z, f.z, q.dir, q.kx, q.ky, q.rot, al, 0, 1);
    }
    marks.length = n;
  }
  // does a stroke in front of the figures reach into the box of a foe that is showing its warning? Its cell's rectangle, turned
  // and placed, against x +- TELE_HALF and TELE_TALL above the foe's feet. Loose on purpose: a telegraph wins a doubt.
  function overTelegraph(m, c, wx, wy, g) {
    const cos = Math.cos(m.rot), sin = Math.sin(m.rot), kx = m.kx * g, ky = m.ky * g, lx0 = -c[5] * kx, lx1 = (c[7] - c[5]) * kx, ly0 = -c[6] * ky, ly1 = (c[8] - c[6]) * ky;
    let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9;
    for (let i = 0; i < 4; i++) { const lx = i & 1 ? lx1 : lx0, ly = i & 2 ? ly1 : ly0, X = wx + m.dir * (lx * cos - ly * sin), Y = wy - (lx * sin + ly * cos);
      if (X < ax) ax = X; if (X > bx) bx = X; if (Y < ay) ay = Y; if (Y > by) by = Y; }
    for (let i = 0; i < teleN; i++) { const tx = tele[i * 2], ty = tele[i * 2 + 1]; if (bx > tx - TELE_HALF && ax < tx + TELE_HALF && by > ty && ay < ty + TELE_TALL) return true; }
    return false;
  }

  // ---------------------------------------------------------------- the view, from the canvas itself
  const F = { z: 1, zs: 1, ox: 0, oy: 0, cx: 0, cy: 0, w: 0, h: 0 };
  let dpr = 1, dprAge = 0;
  function frameOf(ctx, cam) {
    const cv = ctx.canvas;
    if (dprAge-- <= 0) { dprAge = 60; dpr = cv.clientWidth ? cv.width / cv.clientWidth : 1; }
    F.zs = cv.height / viewHeight; F.z = F.zs * (cam.zoom || 1); F.w = cv.width; F.h = cv.height;
    F.ox = cv.width / 2 + (cam.shakeX || 0) * dpr; F.oy = cv.height * ground + (cam.shakeY || 0) * dpr; F.cx = cam.x || 0; F.cy = cam.y || 0;
    return F;
  }

  function run(ctx, f, list, dt, front) {
    const h = G && G.hero, hx = h ? h.x : 0, hy = h ? h.y : 0, pale = 1 - 0.3 * time;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const m = list[i]; m.t += dt;
      const a = m.t;
      if (a < 0) { list[n++] = m; continue; }
      if (m.vx || m.vy || m.g) {
        m.x += m.vx * dt; m.y += (m.scr ? -m.vy : m.vy) * dt; m.vy -= m.g * dt;
        if (m.drag) { const d = Math.max(0, 1 - m.drag * dt); m.vx *= d; m.vy *= d; }
        if (m.aim) m.rot = Math.atan2(-m.vy, m.vx * m.dir);
        if (m.land && m.y <= m.gy && m.vy < 0) { leave(m.c, m.x, m.gy, m.dir, m.kx * 1.2, m.ky * 0.6, 0, m.stay || 0.5); pool.push(m); continue; }
      }
      const life = m.tin + m.hold + m.tout;
      if (a >= life) { if (m.stay && !m.land) leave(m.dry || m.c, m.x + (m.att ? hx : 0), m.y + (m.att ? hy : 0), m.dir, m.kx, m.ky, m.rot, m.stay); pool.push(m); continue; }
      list[n++] = m;
      let c = m.cells ? m.cells[Math.floor((a + m.ph) / m.per) % m.cells.length] : m.c, al = m.a, r0 = 0;
      let r1 = m.tin > 0 ? Math.min(1, a / m.tin + 0.02) : 1; const u = (a - m.tin - m.hold) / m.tout;
      if (u > 0) {
        if (m.dry) { c = m.dry; if (m.att) { m.att = 0; m.x += hx; m.y += hy; } }   // once dry it belongs to the sheet, not the rider: it stays where the blow was
        if (m.tail === 2) r1 = 1 - u; else if (m.tail) r0 = u; else al *= u < 0.34 ? 0.8 : u < 0.67 ? 0.5 : 0.22;       // it thins in three steps, as a stroke repainted drier each time
      }
      if (m.white) al *= pale;
      const g = 1 + m.grow * a;
      if (m.scr) blit(ctx, c, m.x * f.zs, m.y * f.zs, f.zs, m.dir, m.kx * g, m.ky * g, m.rot, al, r0, r1);
      else {
        const wx = m.x + (m.att ? hx : 0), wy = m.y + (m.att ? hy : 0), X = f.ox + (wx - f.cx) * f.z;
        if (X < -500 * f.z || X > f.w + 500 * f.z) continue;
        if (front && teleN && a > TELE_S && overTelegraph(m, c, wx, wy, g)) al *= TELE_OVER;       // a telegraph is never under paint for more than two or three frames
        blit(ctx, c, X, f.oy - (wy - f.cy) * f.z, f.z, m.dir, m.kx * g, m.ky * g, m.rot, al, r0, r1);
      }
    }
    list.length = n;
  }

  // ---------------------------------------------------------------- small things many effects share
  const fed = (el) => { const by = FED_BY[el]; for (const id of own) if (BOON_EL[id] === by) return by; return null; };
  const strong = (el) => (fed(el) ? 1.3 : 1);                   // 相生: a fed element's strokes are 30% stronger
  /** thrown drops: n of them from (x, y), about the angle `ang` (0 forward, + up), within `spread`, at about `speed` */
  function drops(stem, n, x, y, dir, ang, spread, speed, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = ang + R(-spread, spread), v = speed * 1.25 * R(0.55, 1.15);
      put(pick(stem), x, y, { t: (o.t || 0) + R(0, 0.02), dir, k: (o.k || 1) * R(0.7, 1.25), vx: dir * Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v, g: o.g ?? 1700, aim: 1, land: !o.scr, gy: R(-16, 4), stay: 0.5, hold: o.life ?? 1.2, out: 0.1, scr: o.scr });
    }
  }
  const dust = (x, k = 1, t = 0) => { put(pick('thud'), x, 0, { t, k, hold: 0.12, out: 0.3, grow: 0.5, under: rnd() < 0.5 }); };
  const scuff = (x, k = 1, dir = 1, a = 0.5) => leave(pick('scuff'), x, R(-12, -2), dir, k, k * 0.8, 0, a);
  function deathMark(x, t = 0.08) { put(pick('death'), x - 6, R(-12, -3), { t, in: 0.12, hold: 0.5, out: 0.05, under: 1, stay: 0.6, dir: rnd() < 0.5 ? 1 : -1, k: R(0.9, 1.15) }); }
  function thread(el, x, y, o) { const by = fed(el); if (by) put('thread_' + TONE[by], x, y, { ...o, out: 0.14 }); }

  // ---------------------------------------------------------------- the strike: 撇, one falling stroke
  // Hung on the hero: from above the horse's head, forward and down onto the foe. A hair of ink runs the path first (the
  // gather); the loaded stroke is drawn on in two frames and its dry tail ends on the foe (the strike); it is replaced by
  // its dry twin after three more frames and is gone by 0.2 s; a hook flicks back off the stop and drops are thrown on.
  // With an element the main stroke is that element's own stroke (see gen): a flame, three wet lines, a stem that splits,
  // one straight gold line, a blunt slab of ink.
  const CUT = { x0: 66, y0: 206, rot: 1.16, len: 150, bow: 26 };
  const CUT_MAIN = { fire: ['cut_fire', 'cut_fire_dry', 0], water: ['cut_water', null, 1], wood: ['cut_wood', 'cut_wood_dry', 0], metal: ['cut_metal', null, 1], earth: ['cut_earth', 'cut_earth_dry', 0] };
  function strike(e, dir, el) {
    const h = G && G.hero, by = h ? h.y : (e.y ?? HERO_Y) - HERO_Y, vx = h ? h.vx || 0 : 0, s = el ? strong(el) : 1;
    // the blow's multiplier is not known until it lands; the rider's speed says what it will be (sim: 1 + closing speed / 200)
    const mm = clamp(e.mult || 1 + Math.abs(vx) / 200, 1, 3.6), k = (0.66 + 0.25 * (mm - 1)) * (s > 1 ? 1.1 : 1);
    const cs = Math.cos(CUT.rot), sn = Math.sin(CUT.rot), o = { att: 1, dir, rot: CUT.rot, k };
    const X = dir * (CUT.x0 + CUT.len * cs * (1 - k)), Y = CUT.y0 - CUT.len * sn * (1 - k);          // it always ends on the foe: a larger stroke begins higher
    const at = (t) => { const lx = CUT.len * t * k, ly = -CUT.bow * Math.sin(Math.PI * Math.pow(t, 0.8)) * k; return [X + dir * (lx * cs - ly * sn), Y - (lx * sn + ly * cs)]; };
    const EX = X + dir * CUT.len * k * cs, EY = Y - CUT.len * k * sn, wx = (h ? h.x : e.x) + EX, wy = by + EY;     // where it stops: on the hero, and in the world
    const [main, dry, runsOn] = CUT_MAIN[el] || ['cut_red', 'cut_red_dry', 0];
    put('cut_line', X, Y, { ...o, in: 0.035, hold: 0.03, out: 0.05 });
    put(main, X, Y, { ...o, t: 0.03, in: 0.035, hold: 0.05, out: runsOn ? 0.07 : 0.1, dry, tail: runsOn });
    if (!el || el === 'fire') put('cut_white', X, Y, { ...o, t: 0.03, in: 0.035, hold: 0.03, out: 0.04, white: 1 });
    if (el) thread(el, X - dir * 8, Y + 14, { ...o, t: 0.035, in: 0.035, hold: 0.07, k: k * 0.72 });
    const hookTone = el === 'metal' ? 'gold' : el === 'earth' ? 'ink' : !el || el === 'fire' ? 'red' : null;
    if (hookTone) put(pick('hook_' + hookTone), EX, EY, { att: 1, dir, t: 0.07, in: 0.035, hold: 0.05, out: 0.08, rot: 0.25, k: 0.9 * s });
    drops('drop_' + (el ? TONE[el] : 'red'), el ? 5 : 4, wx, wy, dir, -0.5, 0.7, 300 * s, { t: 0.07, vx });
    if (el === 'fire') {            // a few licks go on rising where it passed; the stop sets the ground alight
      for (let i = 0; i < 3; i++) { const p = at(0.2 + 0.26 * i); put(pick('lickS'), p[0], p[1] - 4, { att: 1, dir: -dir, t: 0.06 + 0.02 * i, in: 0.05, hold: 0.06, out: 0.1, sink: 1, k: R(0.9, 1.2) * s, rot: R(-0.3, 0.1), vy: 80 }); }
      emberGround(wx + dir * 6, dir, s);
    } else if (el === 'water') {    // the lines run on along the ground; drips fall from where they passed
      for (let i = 0; i < 2; i++) put(pick('wave'), wx - dir * 10, by + 16 - i * 12, { dir, t: 0.07 + 0.03 * i, in: 0.1, hold: 0.08, out: 0.14, tail: 1, rot: 0.2 - i * 0.14, k: (0.6 - 0.1 * i) * s });
      for (let i = 0; i < 3; i++) { const p = at(0.3 + 0.22 * i); put(pick('drip'), p[0], p[1] - 8, { att: 1, t: 0.07 + 0.03 * i, in: 0.1, hold: 0.06, out: 0.1, tail: 1, k: R(1.2, 1.7) * s }); }
    } else if (el === 'wood') {     // it goes on splitting past the stop
      for (const [r, kk, t] of [[0.5, 0.8, 0.07], [-0.2, 0.6, 0.09]]) put(pick('branch'), EX - dir * 10, EY + 6, { att: 1, dir, t, in: 0.07, hold: 0.06, out: 0.12, tail: 1, rot: r, k: kk * s });
      for (let i = 0; i < 5; i++) put(pick('leaf'), wx + dir * R(10, 90), wy + R(-40, 50), { t: 0.1 + R(0, 0.06), dir, rot: R(-1, 1), hold: 0.25, out: 0.1, vx: dir * R(40, 120) + vx, vy: R(-20, 60), g: 160, land: 1, gy: R(-14, 2), k: R(0.8, 1.2) });
    } else if (el === 'metal') {    // a small cross where it stops; nothing else: metal is clean
      put('glint', EX, EY, { att: 1, t: 0.055, hold: 0.06, out: 0.06, k: 1.5 * s, rot: 0.3 });
      for (let i = 0; i < 2; i++) put(pick('spoke_gold'), EX, EY, { att: 1, dir, t: 0.07, in: 0.03, hold: 0.04, out: 0.08, tail: 1, rot: CUT.rot + R(-0.9, 0.9), k: R(0.5, 0.8) });
    } else if (el === 'earth') {    // the ground takes it
      put(pick('slab'), wx - dir * 60, R(-8, 0), { dir, t: 0.07, in: 0.05, hold: 0.25, out: 0.05, k: 0.9 * s, ky: 0.6 * s, under: 1, stay: 0.55 });
      drops('clod', 5, wx, 10, dir, 1.0, 0.7, 260 * s, { t: 0.08, vx: vx * 0.5 });
      dust(wx, 0.9, 0.07);
    }
  }
  // the burning stroke an ember blade leaves on the ground: 2 s
  function emberGround(x, dir, s = 1) {
    put('ember', x - dir * 50, R(-10, -2), { dir, t: 0.1, in: 0.08, hold: 1.95, out: 0.3, under: 1, k: s, stay: 0.45 });
    for (let i = 0; i < 4; i++) flame(x - dir * 44 + dir * i * 30 * s, R(-9, -1), dir, 0.12 + i * 0.03, 1.9 - i * 0.1, R(0.7, 1) * s, i % 2 === 0, true);
  }
  // one flame: a lick that is redrawn every beat (four drawings in turn), leaning back from the way the hero rides
  const LICKS = ['lick', 'lickS', 'lickL'].map((stem) => Array.from({ length: count[stem] }, (_, i) => CELL[`${stem}_${i}`]));
  function flame(x, y, dir, t, burn, k, back, small) {
    put(LICKS[small ? 1 : 0][0], x, y, { t, in: 0.09, hold: burn, out: 0.3, cells: LICKS[small ? 1 : 0], per: R(0.08, 0.11), ph: R(0, 1), dir: -dir, k, under: back, grow: -0.12 / (burn + 0.4) });
  }

  // ---------------------------------------------------------------- the sweep: 蚕头雁尾 that opens into 飞白
  function sweep(e, dir, full, el) {
    const h = G && G.hero, hx = h ? h.x : e.x, hy = h ? h.y : 0, s = (full ? 1.28 : 1) * (el ? strong(el) : 1), X = dir * 4, Y = 108;
    const o = { att: 1, dir, rot: 0.03, k: s };
    const wet = el === 'water';
    put('heng_line', X, Y, { ...o, in: 0.04, hold: 0.04, out: 0.06, ...(full ? { ky: s * 1.3 } : null) });
    if (wet) put('heng_water', X, Y, { ...o, t: 0.03, in: 0.06, hold: 0.07, out: 0.12, tail: 1 });
    else { put('heng_red', X, Y, { ...o, t: 0.03, in: 0.05, hold: full ? 0.09 : 0.06, out: 0.12, dry: 'heng_red_dry', ...(full ? { ky: s * 1.15 } : null) });
      put('heng_white', X, Y, { ...o, t: 0.03, in: 0.05, hold: 0.04, out: 0.04, white: 1 }); }
    if (el) thread(el, X + dir * 20, Y + 22, { ...o, t: 0.05, in: 0.07, hold: 0.16, k: s * 1.2 });
    // the fan: dry tines leave the goose tail and spread, in the world (the horse rides on from under them)
    const fx_ = X + dir * 236 * s, fy = Y + 2 * s, tx = hx + fx_, ty = hy + fy, n = full ? 5 : 2, spread = full ? 0.62 : 0.4;
    if (!wet) put('fan_red', fx_, fy, { att: 1, dir, t: 0.07, in: 0.04, hold: full ? 0.08 : 0.06, out: 0.12, dry: 'fan_red_dry', rot: -0.06, k: (full ? 1.05 : 0.8) * s });
    if (!wet) for (let i = 0; i < n; i++) { const a = -spread + 2 * spread * (i + R(0.2, 0.8)) / n, tone = i % 2 ? 'tine_ink' : 'tine_red';
      put(pick(tone), tx + dir * 20, ty, { dir, t: 0.09 + R(0, 0.03), in: 0.05, hold: 0.03, out: 0.12, tail: 1, rot: -a * 0.9 - 0.1, k: R(0.7, 1) * s }); }
    put(pick('tine_ink'), hx + dir * 40, R(-8, -2), { dir, t: 0.06, in: 0.1, hold: 0.2, out: 0.1, kx: 1.4 * s, ky: 0.7, under: 1, stay: 0.4 });      // what it drags along the ground
    drops(wet ? 'drop_blue' : 'drop_red', full ? 7 : 3, tx + dir * 30, ty, dir, 0.25, 0.6, full ? 480 : 340, { t: 0.09, vx: h ? h.vx || 0 : 0 });
    if (full) dust(hx + dir * 150, 1.1, 0.1);
    if (wet) tide(hx + dir * 250 * s, dir, strong('water'));
  }
  // coldTide: a wave runs 420 along the ground. Long wet lines laid end to end, a crest that travels at their head.
  function tide(x, dir, s) {
    const L = 420 * s, T = 0.42;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) put(pick('wave'), x + dir * i * L * 0.48, -2 - j * 9 + R(-2, 2), { dir, t: 0.08 + i * T * 0.48 + j * 0.035, in: T * 0.5, hold: 0.3 - j * 0.06, out: 0.2, kx: L * 0.52 / 310 * (1 - j * 0.08), ky: 0.85 - j * 0.2, under: j > 0, stay: j ? 0 : 0.3 });
    put(pick('crest'), x, -2, { dir, t: 0.08, in: 0.06, hold: T - 0.06, out: 0.14, vx: dir * L / T, k: 1.15 * s, grow: -0.5 });
    put(pick('crest'), x - dir * 40, -4, { dir, t: 0.12, in: 0.06, hold: T - 0.12, out: 0.12, vx: dir * L / T, k: 0.7 * s, under: 1 });
    for (let i = 0; i < 7; i++) drops('drop_blue', 1, x + dir * L * (i + 0.5) / 7, 30, dir, 1.0, 0.5, 240, { t: 0.08 + T * (i + 0.5) / 7 });
    thread('water', x, 10, { dir, t: 0.1, in: T, hold: 0.3, kx: L / 224, ky: 1.4 });
  }

  // ---------------------------------------------------------------- the leap strike: 竖 driven into the ground, and a ring thrown along it
  function shock(e, el) {
    const x = e.x, p = clamp(e.power ?? 1, 0.6, 1.8), s = el ? strong(el) : 1, wide = (el === 'earth' ? 2 : 1) * (0.7 + 0.3 * p) * s, flip = rnd() < 0.5 ? 1 : -1;
    const o = { dir: flip, k: 0.8 + 0.2 * p };
    put('slam_line', x, 0, { ...o, in: 0.035, hold: 0.04, out: 0.06 });
    if (el === 'wood') put('slam_wood', x, 0, { ...o, t: 0.02, in: 0.04, hold: 0.08, out: 0.1, tail: 1 });
    else if (el === 'earth') put('slam_earth', x, 0, { ...o, t: 0.02, in: 0.04, hold: 0.12, out: 0.12, tail: 1 });
    else { put('slam_red', x, 0, { ...o, t: 0.02, in: 0.04, hold: 0.06, out: 0.1, dry: 'slam_red_dry' });
      put('slam_white', x, 0, { ...o, t: 0.02, in: 0.04, hold: 0.04, out: 0.04, white: 1 }); }
    put(pick('blot'), x, 4, { t: 0.06, hold: 0.1, out: 0.2, k: 0.9 * p, a: 0.8, under: 1, stay: 0.3, ky: 0.5 * p });
    if (!el) put(pick('core'), x, 8, { t: 0.06, hold: 0.06, out: 0.1, k: 0.9 * p, rot: -1.2 });
    const ring = el === 'earth' ? 'ring_ochre' : el === 'wood' ? 'ring_green' : 'ring_red';
    for (const d of [-1, 1]) {
      put('ring_ink', x, -6, { dir: d, t: 0.05, in: 0.09, hold: 0.06, out: 0.12, kx: wide * 1.08, ky: 1.2, under: 1, stay: 0.35 });
      put(ring, x, -5, { dir: d, t: 0.06, in: 0.09, hold: el === 'earth' ? 0.5 : 0.06, out: 0.14, kx: wide, ky: el === 'earth' ? 1.4 : 1 });
      for (let i = 0; i < 2; i++) put(pick('spoke_ink'), x + d * 20, 6, { dir: d, t: 0.07, in: 0.04, hold: 0.05, out: 0.14, tail: 1, rot: -0.5 - i * 0.5, k: 0.8 * p });
    }
    drops(el === 'wood' ? 'leaf' : el === 'earth' ? 'clod' : 'drop_red', Math.round(5 * p), x, 10, 1, Math.PI / 2, 1.2, 330 * p, { t: 0.07 });
    dust(x, 1.1 * p, 0.06); scuff(x, 1.2 * p);
    if (el) for (const d of [-1, 1]) thread(el, x + d * 10, 3, { dir: d, t: 0.08, in: 0.12, hold: 0.2, kx: wide * 0.66, under: 1 });
    if (el === 'wood') {            // galeLeap: the shock splits and branches away along the ground, and throws leaves
      for (const d of [-1, 1]) for (let i = 0; i < 3; i++) put(pick('branch'), x + d * (16 + i * 62 * wide), 2 + i * 3, { dir: d, t: 0.08 + i * 0.045, in: 0.1, hold: 0.18, out: 0.22, rot: -0.1 - i * 0.07, k: (1.0 - i * 0.14) * s, under: i === 1, stay: i === 1 ? 0.3 : 0 });
      for (let i = 0; i < 10; i++) { const d = i % 2 ? 1 : -1; put(pick('leaf'), x + d * R(20, 80), R(10, 50), { t: 0.1 + R(0, 0.1), dir: d, rot: R(-1, 1), hold: 0.6, out: 0.1, vx: d * R(260, 520), vy: R(40, 200), g: 500, drag: 2.2, land: 1, gy: R(-14, 2), aim: 1 }); }
    } else if (el === 'earth') {    // quake: spikes of ink stand up out of the ring, the nearest first, and hold for a second
      for (const d of [-1, 1]) for (let i = 0; i < 4; i++) { const dx = (44 + i * 66 + R(-10, 10)) * s;
        put(pick('spike'), x + d * dx, R(-10, 0), { dir: -d, t: 0.09 + i * 0.035, in: 0.06, hold: 1.0, out: 0.16 + i * 0.03, sink: 1, k: (1.0 - i * 0.13) * R(0.9, 1.1) * s, rot: d * (0.06 + i * 0.05), under: i % 2 === 1 });
        leave(pick('scuff'), x + d * dx, -6, d, 0.8, 0.7, 0, 0.5); }
      drops('clod', 9, x, 12, 1, Math.PI / 2, 1.3, 380 * s, { t: 0.09 });
      put(pick('slab'), x - 75 * s, -12, { t: 0.07, in: 0.05, hold: 0.9, out: 0.05, k: s, ky: 0.5 * s, under: 1, stay: 0.5 });
    }
  }

  // ---------------------------------------------------------------- break-through: streaks torn off the horse while it is in full cry
  const cry = { on: false, next: 0 };
  function streak(h, strong_) {
    const dir = h.facing || 1;
    put(pick('streak'), h.x + dir * R(-30, 46), h.y + R(34, 150), { dir: -dir, in: 0.06, hold: 0.03, out: 0.13, tail: 1, rot: R(-0.05, 0.05), k: R(0.7, 1.1) * (strong_ ? 1.35 : 1), under: rnd() < 0.3 });
  }
  function fullCry(on) {
    cry.on = !!on; cry.next = 0;
    const h = G && G.hero; if (!on || !h) return;
    const dir = h.facing || 1;
    for (let i = 0; i < 5; i++) streak(h, true);
    put(pick('hook_red'), h.x + dir * 70, h.y + 96, { dir, in: 0.04, hold: 0.08, out: 0.12, rot: -0.9, k: 1.3 });
    put(pick('puff'), h.x - dir * 20, 0, { dir, hold: 0.1, out: 0.25, k: 1.3, grow: 0.6 });
  }

  // ---------------------------------------------------------------- flame gallop: a running line of flames that burns 2.5 s
  const trail = { planted: new Map(), lastX: 0, lastDir: 1, quiet: 9, armed: false };
  const STEP_X = 26, BURN = 2.5;
  function dash() {
    const h = G && G.hero; if (!h) return; const dir = h.facing || 1;
    for (let i = 0; i < 3; i++) put(pick('spoke_red'), h.x - dir * 10, 14 + i * 12, { dir: -dir, in: 0.04, hold: 0.06, out: 0.14, tail: 1, rot: -0.1 - i * 0.25, k: 1.3 });
    put(LICKS[2][0], h.x - dir * 30, -4, { dir: -dir, in: 0.08, hold: 0.14, out: 0.2, cells: LICKS[2], k: 0.8 });
    dust(h.x - dir * 20, 1.1);
  }
  function plant(x0, x1) {
    const h = G && G.hero, dir = x1 === x0 ? (h ? h.facing || 1 : 1) : Math.sign(x1 - x0), wild = own.has('wildfire'), s = (wild ? 1.25 : 1) * strong('fire');
    for (let i = Math.floor(Math.min(x0, x1) / STEP_X); i <= Math.floor(Math.max(x0, x1) / STEP_X); i++) {
      if ((trail.planted.get(i) || -9) > clock - BURN) continue;
      trail.planted.set(i, clock);
      const x = i * STEP_X + R(-5, 5), back = i % 2 === 0;
      flame(x, back ? R(2, 8) : R(-14, -6), dir, R(0, 0.04), BURN - 0.4 + R(-0.2, 0.1), (back ? R(0.8, 1.05) : R(1.05, 1.4)) * s, back, !back);
      if (i % 3 === 0) put(pick('scuff'), x, -6, { t: 0.05, hold: BURN - 0.2, out: 0.2, k: 0.7, under: 1, stay: 0.5 });      // the char under the fire stays
      if (i % 4 === 1) drops('drop_red', 1, x, 24, dir, 1.9, 0.5, 200, { t: R(0.2, 1.6), k: 0.7 });
    }
    if (trail.planted.size > 400) for (const [i, t] of trail.planted) if (t < clock - BURN) trail.planted.delete(i);
    trail.lastX = x1; trail.lastDir = dir; trail.quiet = 0; trail.armed = true;
    thread('fire', Math.min(x0, x1), 4, { in: 0.1, hold: 0.6, kx: Math.max(0.3, Math.abs(x1 - x0) / 224), under: 1 });
  }
  function wildBurst(x, dir) {      // wildfire: the trail bursts at its end
    const s = strong('fire');
    for (let i = 0; i < 5; i++) put(LICKS[2][i % 2], x + dir * (i - 2) * 26, R(-8, 4), { dir: i < 2 ? 1 : -1, t: 0.03 * Math.abs(i - 2), in: 0.09, hold: 0.22, out: 0.25, cells: LICKS[2], per: 0.1, ph: i * 0.05, k: (1.15 - 0.16 * Math.abs(i - 2)) * s, rot: (i - 2) * 0.2, under: i % 2 === 1 });
    for (let i = 0; i < 6; i++) put(pick('spoke_red'), x, 18, { dir: i % 2 ? 1 : -1, t: 0.05, in: 0.04, hold: 0.06, out: 0.14, tail: 1, rot: -R(0.2, 1.3), k: R(0.9, 1.4) * s });
    put(pick('blot'), x, 2, { t: 0.02, hold: 0.2, out: 0.2, k: 1.3, ky: 0.6, under: 1, stay: 0.4 });
    drops('drop_red', 9, x, 20, 1, Math.PI / 2, 1.2, 460, { t: 0.06 }); drops('drop_ink', 3, x, 20, 1, Math.PI / 2, 1.2, 380, { t: 0.06 });
    scuff(x, 1.4, dir, 0.6);
  }

  // ---------------------------------------------------------------- rally: 提, banner-coloured marks rising in a ring
  function rally() {
    const h = G && G.hero; if (!h) return; const x = h.x, dir = h.facing || 1, N = 12;
    for (const d of [-1, 1]) { put('ring_ink', x, -6, { dir: d, in: 0.1, hold: 0.3, out: 0.25, kx: 1.1, ky: 1.5, under: 1, stay: 0.3 }); put('ring_red', x, -5, { dir: d, t: 0.02, in: 0.08, hold: 0.3, out: 0.18, kx: 1.04, ky: 1.4, under: 1 }); }
    for (let i = 0; i < N; i++) {
      const th = (i + 0.5) / N * Math.PI * 2, front = Math.sin(th) < 0, cx = Math.cos(th), away = Math.abs(Math.atan2(Math.sin(th), cx * dir)) / Math.PI;   // 0 ahead of him .. 1 behind
      put(pick(i % 4 === 1 ? 'ti_white' : 'ti_red'), x + cx * 152, Math.sin(th) * 24 - 5, { t: 0.04 + away * 0.2, in: 0.08, hold: 0.3, out: 0.18, dir, k: (front ? 1.25 : 0.95) * R(0.9, 1.1), vy: R(46, 70), drag: 1.6, under: !front, white: i % 4 === 1 });
    }
    // every man of the warband in reach takes a small mark over his head
    if (G.units) for (const u of G.units) if (u.side === 'zhou' && u.state !== 'dead' && Math.abs(u.x - x) < 450)
      put(pick('ti_red'), u.x - 4, 62 + (u.lane || 0) * 16, { t: 0.15 + Math.abs(u.x - x) / 1500, in: 0.08, hold: 0.4, out: 0.2, k: 0.6, vy: 40, drag: 1.5, dir: u.facing || 1 });
    dust(x, 0.9, 0.05);
  }

  // ---------------------------------------------------------------- impacts
  // A hit is ink under colour, one pressed dot, strokes thrown on from it, and drops. Everything is at its fullest on
  // the frame of contact. Size, the number of strokes and how far the drops fly all rise with the multiplier.
  // Tester F-2.9: the picture must grow with the multiplier. All of these rise with m: the size of every stroke (s), the
  // number of thrown strokes (2, 3, 4, 5 at 1x, 2x, 3x, 3.5x) and of those that spring back, the number of drops and how far
  // they are thrown. From 2.5x a counter-stroke goes through the foe against the blow, so the best blows cannot be mistaken.
  // A hit that is one of many from a single verb (every foe a sweep or a shock touches, a tick of fire) is small: the verb's
  // own stroke is the picture there, and a fan of full hits is what hid the foes.
  function hit(e, dir, el) {
    const m = clamp(e.mult || 1, 0.6, 3.6), lite = e.by === 'sweep' || e.by === 'leapStrike', tone = el ? TONE[el] : 'red', x = e.x, y = e.y ?? 36;
    if (e.by === 'wildfire' || e.by === 'trail' || e.by === 'ember') { put(pick('spoke_red'), x, y, { dir, in: 0.03, hold: 0.03, out: 0.08, tail: 1, rot: -R(0.6, 1.4), k: 0.4 }); if (e.kill) deathMark(x + dir * 14); return; }
    const s = (0.38 + 0.38 * m) * (el ? strong(el) : 1) * (lite ? 0.62 : 1);
    put(pick('blot'), x + dir * 10, y, { dir, hold: 0.05 + 0.015 * m, out: 0.12, k: s * 0.9, a: 0.9 });
    put(pick('core'), x, y, { dir, hold: 0.05 + 0.015 * m, out: 0.1, k: s * 0.8, rot: R(-0.3, 0.3) });
    // one thrown stroke leads; lesser ones of unlike weight follow it; a little springs back
    if (!lite) put(CELL['spoke_' + tone + '_0'], x + dir * 8, y, { dir, in: 0.03, hold: 0.04 + 0.015 * m, out: 0.1 + 0.02 * m, rot: -0.3 + R(-0.12, 0.12), k: 0.95 * s });
    const n = Math.round(0.2 + 1.3 * m) - (lite ? 1 : 0), spread = 0.55 + 0.12 * m;
    for (let i = 0; i < n; i++) { const a = (i % 2 ? -1 : 1) * spread * (0.35 + 0.65 * (i + 1) / n) + 0.25, stem = i === 1 ? 'spoke_ink' : i === 3 ? 'spoke_white' : 'spoke_' + tone;
      put(CELL[`${stem}_${1 + (i % ((count[stem] || 2) - 1 || 1))}`] || pick(stem), x + dir * 6, y, { dir, t: 0.008 * i, in: 0.03, hold: 0.03 + 0.015 * m, out: 0.09 + 0.02 * m, tail: 1, rot: -a, k: R(0.55, 0.8) * s, white: stem === 'spoke_white' }); }
    if (!lite) for (let i = 0; i < Math.round(m - 1); i++) put(pick('spoke_' + tone), x, y, { dir: -dir, in: 0.03, hold: 0.04, out: 0.1, tail: 1, rot: R(-0.9, 0.5), k: 0.45 * s });
    if (!lite && m >= 2.5) {        // the counter-stroke: 捺 against 撇, from low behind the foe up through it
      const kk = 0.34 + 0.13 * m, o = { dir, rot: -0.62, k: kk, t: 0.015 };
      put('cut_line', x - dir * 62 * kk, y - 34 * kk, { ...o, t: 0, in: 0.03, hold: 0.03, out: 0.04 });
      put(el ? CUT_MAIN[el][0] : 'cut_red', x - dir * 62 * kk, y - 34 * kk, { ...o, in: 0.03, hold: 0.05, out: 0.08, dry: el ? CUT_MAIN[el][1] : 'cut_red_dry', tail: el ? CUT_MAIN[el][2] : 0 });
      if (!el) put('cut_white', x - dir * 62 * kk, y - 34 * kk, { ...o, in: 0.03, hold: 0.03, out: 0.03, white: 1 });
      drops('drop_' + tone, 3, x + dir * 50 * kk, y + 60 * kk, dir, 0.9, 0.4, 420, { t: 0.05 });
    }
    drops(el === 'wood' ? 'leaf' : el === 'earth' ? 'clod' : 'drop_' + tone, Math.round((lite ? 1 : 2) + 2 * m), x + dir * 10, y, dir, 0.35, 0.75, 110 + 150 * m, { k: 0.75 + 0.15 * m });
    if (!lite && m >= 1.6) drops('drop_ink', Math.round(m), x, y, dir, 0.6, 0.9, 100 + 120 * m);
    leave(pick('splat'), x + dir * (20 + 30 * m), R(-14, -2), dir, 0.3 + 0.25 * m, 0.3 + 0.2 * m, R(-0.1, 0.1), e.kill ? 0.5 : 0.36);
    if (el) thread(el, x - dir * 20, y + 4, { dir, in: 0.04, hold: 0.1, kx: 0.6 * s, rot: -0.15 });
    if (e.crit) keen(x, y, dir, strong('metal'));
    if (e.kill) deathMark(x + dir * 14);
  }
  // keenEdge: every third strike is a gold blow that cuts through shields: one thin straight line, clean through
  function keen(x, y, dir, s = 1) {
    put(pick('edge'), x - dir * 150 * s, y + 26, { dir, in: 0.03, hold: 0.13, out: 0.1, tail: 1, dry: 'edge_dry', rot: 0.17, kx: 1.15 * s, ky: 1.6 });
    put(pick('edge'), x - dir * 90 * s, y + 6, { dir, t: 0.02, in: 0.03, hold: 0.08, out: 0.08, tail: 1, rot: 0.17, kx: 0.6 * s, ky: 0.9 });
    put('glint', x, y, { t: 0.02, hold: 0.09, out: 0.08, k: 1.7 * s, rot: 0.17 });
    put(pick('hook_gold'), x + dir * 16, y - 6, { dir, t: 0.05, in: 0.04, hold: 0.06, out: 0.1, rot: 0.1 });
    drops('drop_gold', 5, x, y, dir, 0.1, 0.5, 420 * s, { t: 0.03 });
    thread('metal', x - dir * 120, y + 36, { dir, in: 0.04, hold: 0.12, rot: 0.17, k: 1.1 });
  }
  function clash(e) {              // foot soldiers at each other: quiet, in ink; red only for a death
    const d = e.side === 'shang' ? -1 : 1, x = e.x, y = e.y ?? 34;
    put(pick('spoke_ink'), x, y, { dir: d, in: 0.03, hold: 0.04, out: 0.1, tail: 1, rot: R(-0.7, 0.1), k: 0.42 });
    put(pick('spoke_white'), x, y, { dir: d, in: 0.03, hold: 0.04, out: 0.1, tail: 1, rot: R(-0.1, 0.6), k: 0.42, white: 1 });
    put(pick('tick'), x, y, { dir: d, hold: 0.06, out: 0.1, k: 0.9 });
    if (e.kill) { put(pick('spoke_red'), x, y, { dir: d, in: 0.03, hold: 0.06, out: 0.12, rot: R(-0.5, 0.2), k: 0.6 }); drops('drop_red', 3, x, y, d, 0.3, 0.8, 190); deathMark(x); }
  }
  // the shield block: a bar of ink set square against the blow, and paper-white chips sprung back off it. No red: nobody is hurt.
  function blocked(e, dir) {
    const x = e.x, y = e.y ?? 36;
    put('bar_ink', x, y, { dir, hold: 0.1, out: 0.14, k: 1.05, rot: R(-0.12, 0.12) });
    put(pick('chips'), x - dir * 8, y, { dir: -dir, in: 0.04, hold: 0.06, out: 0.12, tail: 1, k: 1.1, white: 1 });
    for (let i = 0; i < 2; i++) put(pick('spoke_gold'), x - dir * 4, y, { dir: -dir, in: 0.03, hold: 0.04, out: 0.1, tail: 1, rot: R(-1, 1), k: 0.4 });
    drops('drop_white', 3, x - dir * 8, y, -dir, 0.4, 0.8, 240, { k: 0.8 });
    if (e.reflect || (own.has('mirrorShields') && e.arrow)) {       // mirrorShields: the arrow goes back as one straight gold line
      const s = strong('metal');
      put(pick('edge'), x, y + 4, { dir: e.back || 1, t: 0.03, in: 0.04, hold: 0.1, out: 0.12, tail: 1, dry: 'edge_dry', rot: -0.38, kx: 0.9 * s, ky: 1.3 });
      put('glint', x, y + 4, { t: 0.02, hold: 0.08, out: 0.08, k: 1.2 * s });
      thread('metal', x, y - 4, { dir: e.back || 1, t: 0.03, in: 0.05, hold: 0.1, rot: -0.38, k: 0.8 });
    }
  }
  function braced(e, dir) {         // the hero stopped dead on a spear: the bar again, and his own red thrown back at him
    const x = e.x, y = e.y ?? 34;
    if (e.broken) return rootBreak(x, dir);
    put('bar_ink', x, y, { dir, hold: 0.14, out: 0.16, k: 1.3 });
    put(pick('chips'), x - dir * 8, y, { dir: -dir, in: 0.04, hold: 0.08, out: 0.14, tail: 1, k: 1.4, white: 1 });
    for (let i = 0; i < 3; i++) put(pick('spoke_red'), x - dir * 6, y, { dir: -dir, in: 0.03, hold: 0.07, out: 0.14, tail: 1, rot: -0.5 + i * 0.45, k: R(0.6, 0.9) });
    drops('drop_red', 4, x - dir * 10, y, -dir, 0.5, 0.7, 260);
    dust(x, 0.9, 0.03); scuff(x, 1, dir);
  }
  // deepRoots: once a wave the braced spear does not hold: a slab of ink goes through it
  function rootBreak(x, dir) {
    const s = strong('earth');
    put(pick('slab'), x - dir * 70, 30, { dir, in: 0.05, hold: 0.16, out: 0.12, tail: 1, k: 1.15 * s });
    put(pick('slab'), x - dir * 40, 8, { dir, t: 0.03, in: 0.05, hold: 0.3, out: 0.2, k: 0.9 * s, ky: 0.5, under: 1, stay: 0.5 });
    for (let i = 0; i < 3; i++) put(pick('spoke_ochre'), x + dir * 60, 30, { dir, t: 0.05, in: 0.03, hold: 0.07, out: 0.14, tail: 1, rot: -0.6 + i * 0.5, k: R(0.8, 1.2) });
    drops('clod', 7, x + dir * 60, 30, dir, 0.4, 0.8, 380 * s, { t: 0.05 });
    thread('earth', x - dir * 60, 52, { dir, in: 0.05, hold: 0.16 }); dust(x, 1.2, 0.04);
  }
  function trample(e, dir) {
    const x = e.x, full = cry.on, k = full ? 1.3 : 0.95;
    dust(x, k);
    for (let i = 0; i < 2; i++) leave(pick('hoof'), x + dir * (i * 26 - 8) + R(-4, 4), R(-12, -2), dir, 1.1, 0.7, R(-0.3, 0.3), 0.6);
    scuff(x, k, dir);
    put(pick('spoke_ink'), x, 10, { dir, in: 0.03, hold: 0.05, out: 0.12, tail: 1, rot: -0.35, k: 0.7 * k });
    if (full) { for (let i = 0; i < 2; i++) put(pick('tine_ink'), x - dir * 20, 14 + i * 16, { dir, in: 0.05, hold: 0.04, out: 0.14, tail: 1, rot: -0.2 - i * 0.3, k: 0.7 }); drops('drop_ink', 3, x, 10, dir, 0.7, 0.6, 300); }
    if (e.kill) { deathMark(x + dir * 10); drops('drop_red', 3, x, 12, dir, 0.6, 0.7, 220); leave(pick('splat'), x + dir * 16, R(-12, -4), dir, 0.55, 0.5, 0, 0.36); }
  }
  function arrowHit(e) {
    const x = e.x, y = e.y ?? 0, d = rnd() < 0.5 ? 1 : -1;
    put(pick('tick'), x, y, { dir: d, hold: 0.07, out: 0.12, k: 1.1, rot: R(-0.4, 0.4) });
    if (y < 10) { put(pick('puff'), x, 0, { dir: d, hold: 0.06, out: 0.2, k: 0.5, grow: 0.6 }); leave(pick('tick'), x, R(-8, -2), d, 0.9, 0.6, 0, 0.5); }
  }
  // the hero is hurt, or is struck from the saddle: the enemy's own cut, in lacquer black, across him
  function hurt(e, big) {
    const h = G && G.hero, x = e.x, y = (h ? h.y : 0) + (big ? 150 : 120), d = e.dir || (h ? -(h.facing || 1) : -1), k = big ? 1.05 : 0.5;
    put('cut_ink', x - d * 80 * k, y, { dir: d, in: 0.04, hold: big ? 0.2 : 0.08, out: 0.2, dry: 'cut_ink_dry', rot: 0.5, k });
    if (big) { put('cut_white', x - d * 80 * k, y, { dir: d, in: 0.04, hold: 0.06, out: 0.06, rot: 0.5, k, white: 1 }); put(pick('hook_ink'), x + d * 70, y - 96, { dir: d, t: 0.05, in: 0.04, hold: 0.1, out: 0.12, rot: 0.2, k: 1.2 });
      put(pick('blot'), x, y - 50, { dir: d, hold: 0.1, out: 0.2, k: 1.2 }); put('dot_green', x - d * 84, y + 2, { hold: 0.14, out: 0.1 }); }
    for (let i = 0; i < (big ? 5 : 2); i++) put(pick('spoke_red'), x, y - 50 * k, { dir: d, t: 0.03, in: 0.03, hold: 0.06, out: 0.14, tail: 1, rot: R(-0.7, 0.5), k: R(0.6, 1) * (big ? 1.2 : 0.7) });
    drops('drop_red', big ? 9 : 3, x, y - 50 * k, d, 0.3, 0.8, big ? 400 : 240, { t: 0.03 });
  }
  // the captain's horn: broken arcs opening away from the mouth, one after another: sound, drawn as three dry strokes
  function horn(e) {
    let c = null; if (G && G.units) for (const u of G.units) if (u.kind === 'captain' && u.state !== 'dead') c = u;
    const x = c ? c.x : e.x ?? 0, y = (e.y ?? 0) + 118, d = c ? c.facing || -1 : -1;
    put('dot_green', x + d * 14, y, { hold: 0.2, out: 0.1, k: 1.2 });
    for (let i = 0; i < 3; i++) for (const side of [1, -1]) put(`horn_${i}`, x + d * 10, y, { dir: d * side, t: 0.03 + i * 0.07, hold: 0.1, out: 0.15, k: side > 0 ? 1.15 : 0.8, a: side > 0 ? 1 : 0.7, grow: 0.5 });
    if (G && G.units) for (const u of G.units) if (u.side === 'shang' && u !== c && u.state !== 'dead' && Math.abs(u.x - x) < 340)
      put(pick('spoke_green'), u.x, 64 + (u.lane || 0) * 16, { dir: u.facing || -1, t: 0.2 + Math.abs(u.x - x) / 900, in: 0.04, hold: 0.2, out: 0.15, rot: -1.2, k: 0.42 });
  }
  // spring: the warband mends: a wet line runs down beside each man and ends in a drop
  function mend(units) {
    const s = strong('water');
    for (const u of units) if (u.side === 'zhou' && u.state !== 'dead') { put(pick('drip'), u.x - 12, 70 + (u.lane || 0) * 16, { t: R(0, 0.2), in: 0.16, hold: 0.15, out: 0.14, tail: 1, k: 1.1 * s }); thread('water', u.x - 30, 4, { t: 0.2, in: 0.1, hold: 0.3, kx: 0.25, under: 1 }); }
  }
  // arrowRain: three arrows leave one bow: a small fork of malachite at the string
  function loose(e) {
    if (!own.has('arrowRain')) return;
    let side = e.side; if (!side && G && G.units) { let best = 1e9; for (const u of G.units) if (u.kind === 'archer' && Math.abs(u.x - e.x) < best) { best = Math.abs(u.x - e.x); side = u.side; } }
    if (side !== 'zhou') return;
    const d = e.dir || 1, s = strong('wood');
    for (let i = 0; i < 3; i++) put(pick('spoke_green'), e.x, e.y ?? 40, { dir: d, in: 0.04, hold: 0.06, out: 0.12, tail: 1, rot: -0.75 + i * 0.22, k: 0.7 * s });
    put(pick('leaf'), e.x, e.y ?? 40, { dir: d, hold: 0.3, out: 0.1, vx: -d * 40, vy: 30, g: 200, land: 1, gy: -6 });
    thread('wood', e.x, (e.y ?? 40) + 6, { dir: d, in: 0.05, hold: 0.1, rot: -0.55, k: 0.5 });
  }

  // ---------------------------------------------------------------- a boon is taken: one burst of its pigment across the whole screen, over in 0.9 s
  // Screen space: x 0 .. U (the width in units), y 0 at the top .. 900 at the bottom.
  function burst(el, ctxW) {
    const U = ctxW, H = viewHeight, by = fed(el), o = { scr: 1 };
    if (el === 'fire') {            // licks rise from the lower edge, from the middle outward
      const n = 6;
      for (let i = 0; i < n; i++) { const mid = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
        put(`B_lick_${i % 2}`, U * (i + 0.5 + R(-0.2, 0.2)) / n, H + 16, { ...o, dir: i % 2 ? 1 : -1, t: mid * 0.16, in: 0.1, hold: 0.2 - mid * 0.06, out: 0.2, sink: 1, kx: (0.8 - 0.15 * mid), ky: (1.3 - 0.45 * mid) * R(0.9, 1.1), rot: R(-0.1, 0.1) });
        put(LICKS[2][i % 2], U * (i + 1 + R(-0.15, 0.15)) / n, H + 8, { ...o, dir: i % 2 ? -1 : 1, t: 0.1 + mid * 0.16, in: 0.1, hold: 0.2, out: 0.2, sink: 1, cells: LICKS[2], per: 0.09, k: 1.5 }); }
      drops('drop_red', 16, U / 2, H - 80, 1, Math.PI / 2, 1.3, 900, { scr: 1, t: 0.12, k: 2.2, life: 0.6, g: 1400 });
    } else if (el === 'water') {    // long wet lines run level across, one after another, each from the other side; drips fall from them
      for (let i = 0; i < 4; i++) { const d = i % 2 ? -1 : 1, y = H * (0.2 + 0.19 * i) + R(-14, 14);
        put(`B_wave_${i % 2}`, d > 0 ? -30 : U + 30, y, { ...o, dir: d, t: i * 0.07, in: 0.26, hold: 0.1, out: 0.3, tail: 1, kx: (U + 80) / 870, ky: 1.3 - i * 0.18, rot: R(-0.04, 0.04) });
        for (let j = 0; j < 4; j++) put(pick('drip'), U * R(0.08, 0.92), y + 10, { ...o, t: i * 0.07 + 0.22 + R(0, 0.12), in: 0.16, hold: 0.1, out: 0.16, k: R(2, 3.4) }); }
      put(pick('crest'), U * 0.9, H * 0.2 - 4, { ...o, t: 0.2, in: 0.06, hold: 0.14, out: 0.16, k: 3 });
    } else if (el === 'wood') {     // a bough grows from the lower corner and splits, and splits again; leaves come at the tips
      const k = U / 640, x0 = U * 0.04, y0 = H * 0.9, P = (t) => [x0 + 580 * t * k, y0 - 230 * Math.pow(t, 1.3) * k];
      put('B_trunk', x0, y0, { ...o, in: 0.2, hold: 0.3, out: 0.24, tail: 1, k });
      const b = [[0.3, 1, -0.25, 1.25], [0.42, 0, 0.12, 1.1], [0.62, 1, -0.05, 0.95], [0.72, 0, 0.3, 0.8]];
      b.forEach(([t, v, rot, kk], i) => { const p = P(t); put(`B_bough_${v}`, p[0], p[1], { ...o, t: 0.08 + t * 0.2, in: 0.16, hold: 0.34 - i * 0.02, out: 0.2, tail: 1, k: kk * k * 0.8, rot });
        const ex = p[0] + 330 * kk * k * 0.8, ey = p[1] + (v ? -150 : 40) * kk * k * 0.8;
        for (let j = 0; j < 2; j++) put(pick('branch'), ex - 30, ey, { ...o, t: 0.24 + t * 0.2 + j * 0.03, in: 0.1, hold: 0.26, out: 0.18, tail: 1, k: 1.5, rot: (v ? -0.5 : 0.2) + j * 0.5 });
        for (let j = 0; j < 4; j++) put(pick('leaf'), ex + R(0, 200), ey + R(-130, 60), { ...o, t: 0.32 + t * 0.2 + R(0, 0.08), hold: 0.18, out: 0.1, k: R(2, 3.2), rot: R(-1, 1), vy: -R(20, 90), vx: R(-30, 60) }); });
    } else if (el === 'metal') {    // thin straight lines cross the screen, each drawn in one frame; a small cross where two meet
      const L = [[0.0, 0.3, 0.42], [1.0, 0.16, 2.62], [0.0, 0.74, -0.2], [1.0, 0.86, 3.5], [0.34, 0.0, 1.2], [0.72, 1.0, -1.32]];
      L.forEach(([fx, fy, ang], i) => { const x = fx * U - Math.cos(ang) * 60, y = fy * H - Math.sin(ang) * 60;
        put(`edge_${i % 3}`, x, y, { ...o, t: i * 0.055, in: 0.04, hold: 0.24 - i * 0.02, out: 0.12, tail: 1, dry: 'edge_dry', rot: ang, kx: U * 1.25 / 300, ky: 2.4 - (i % 3) * 0.5 }); });
      for (const [fx, fy, t] of [[0.33, 0.56, 0.1], [0.62, 0.36, 0.16], [0.5, 0.64, 0.22], [0.74, 0.7, 0.28]]) put('glint', fx * U, fy * H, { ...o, t, hold: 0.1, out: 0.1, k: 3, rot: R(-0.3, 0.3) });
      drops('drop_gold', 10, U / 2, H / 2, 1, 0, 3.1, 700, { scr: 1, t: 0.12, k: 2, life: 0.4, g: 300 });
    } else if (el === 'earth') {    // slabs of ink come down and stand; what they throw out along the ground is ochre
      [[0.52, 1.35, 0, 0.1], [0.2, 1.0, 0.07, -0.16], [0.82, 1.12, 0.12, 0.22]].forEach(([fx, k, t, rot], i) => { const x = fx * U + R(-20, 20), y = H * 0.9;
        put(`B_slab_${i % 2}`, x, y, { ...o, t, in: 0.08, hold: 0.32 - t, out: 0.24, tail: 1, k, rot });
        put('B_foot', x, y, { ...o, t: t + 0.08, hold: 0.2, out: 0.2, tail: 1, k: k * 1.1, grow: 0.4 });
        drops('clod', 6, x, y - 30, 1, Math.PI / 2, 1.2, 800, { scr: 1, t: t + 0.08, k: 2.6, life: 0.5, g: 2200 }); });
    }
    if (by) for (let i = 0; i < 3; i++) put('thread_' + TONE[by], U * 0.05, H * (0.3 + 0.2 * i), { ...o, t: 0.1 + i * 0.06, in: 0.2, hold: 0.25, out: 0.2, tail: 1, kx: U * 0.9 / 224, ky: 2.4, rot: R(-0.06, 0.06) });
  }
  let pendingBurst = null;         // a burst needs the width of the screen: it is laid at the next drawOver

  // ---------------------------------------------------------------- events
  function onEvent(e, game) {
    if (game) { G = game; const b = game.hero && game.hero.boons; if (b) for (const q of b) own.add(q.id || q); }
    const h = G && G.hero, dir = e.dir || (h ? h.facing : 1) || 1;
    switch (e.type) {
      case 'swing': strike(e, dir, e.element || (own.has('emberBlade') ? 'fire' : null)); break;
      case 'crit': if (e.x != null) keen(e.x, e.y ?? 36, dir, strong('metal')); break;
      case 'sweep': sweep(e, dir, !!e.full, e.element || (own.has('coldTide') ? 'water' : null)); break;
      case 'shock': shock(e, e.element || (own.has('quake') ? 'earth' : own.has('galeLeap') ? 'wood' : null)); break;
      case 'fullCry': fullCry(e.on); break;
      case 'dash': dash(); break;
      case 'trail': plant(e.x0 ?? e.x ?? 0, e.x1 ?? e.x ?? 0); break;
      case 'rally': rally(); break;
      case 'hit': hit(e, dir, e.element || null); break;
      case 'clash': clash(e); break;
      case 'blocked': blocked(e, dir); break;
      case 'braced': braced(e, dir); break;
      case 'trample': trample(e, dir); break;
      case 'arrowHit': arrowHit(e); break;
      case 'loose': loose(e); break;
      case 'hurt': hurt(e, false); break;
      case 'fall': hurt(e, true); if (h) { dust(h.x, 1.2, 0.5); } break;
      case 'leap': put(pick('puff'), e.x, 0, { dir, hold: 0.08, out: 0.25, grow: 0.5 }); for (let i = 0; i < 2; i++) leave(pick('hoof'), e.x - dir * i * 22, R(-10, -3), dir, 1.1, 0.7, 0, 0.55); break;
      case 'land': { const k = clamp((e.speed || 300) / 520, 0.5, 1.1); dust(e.x, 0.7 + 0.5 * k); scuff(e.x, 0.8 + 0.4 * k, dir); break; }
      case 'captainHorn': horn(e); break;
      case 'mend': case 'cleared': if ((e.type === 'mend' || own.has('spring')) && G && G.units) mend(e.type === 'mend' && e.x != null ? [{ side: 'zhou', x: e.x, lane: 0 }] : G.units); break;
      case 'boon': if (e.id) own.add(e.id); pendingBurst = e.element || BOON_EL[e.id] || null; break;
      case 'fx:count': e.marks = marks.length; e.over = 0; e.under = 0; for (const m of over) if (m.t >= 0) e.over++; for (const m of under) if (m.t >= 0) e.under++; e.waiting = over.length + under.length - e.over - e.under; break;   // for the preview: what is alive
      case 'fx:clear': pool.push(...under, ...over); under.length = over.length = 0; markPool.push(...marks); marks.length = 0; stretches.clear(); own.clear(); trail.planted.clear(); cry.on = false; pendingBurst = null; break;
      default: break;
    }
  }

  function drawUnder(ctx, cam, dt = 1 / 60) {
    const f = frameOf(ctx, cam);
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    readTelegraphs(); drawMarks(ctx, f, dt); run(ctx, f, under, dt, false);
    ctx.restore();
  }
  function drawOver(ctx, cam, dt = 1 / 60) {
    const f = frameOf(ctx, cam), h = G && G.hero;
    clock += dt;
    if (pendingBurst) { burst(pendingBurst, f.w / f.zs); pendingBurst = null; }
    if (cry.on && h && dt > 0) { cry.next -= dt; if (cry.next <= 0) { cry.next = R(0.035, 0.07); streak(h, false); } }
    if (trail.armed) { trail.quiet += dt; if (trail.quiet > 0.14) { trail.armed = false; if (own.has('wildfire')) wildBurst(trail.lastX, trail.lastDir); } }
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    run(ctx, f, over, dt, true);
    ctx.restore();
  }
  function setTime(k) { time = clamp(k); }

  return { onEvent, drawUnder, drawOver, setTime };
}
