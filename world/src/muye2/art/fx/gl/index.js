// The effects that need WebGL2, called by art/fx/index.js when the drawing context has GL (ctx.gl, from
// art/render/context.js). With Canvas 2D none of this runs and the stroke effects of fx/index.js stand alone.
//
//   const glfx = createGLFx(ctx, {elementOf, kick});
//   glfx.onEvent(e, game)                         // the rules' events (the same ones fx/index.js gets)
//   glfx.drawGround(V, dt)                        // after the ground and its stroke effects, before the figures
//   glfx.drawOver(V, dt)                          // over the figures (and over the stroke effects drawn over them)
//   glfx.setWeather(kind, amount, wind)           // 'rain' | 'snow' | 'dust' | null (the scene's, from ground.weatherState())
//   glfx.hold()                                   // seconds the page should hold the rules still now (a held frame), 0 if none
//   V: {sx(x), sy(y) device px of a ground point, z device px per world unit, dpr, KY, hero: [X, Y] device px, cam: [x, y]}
//
// The brief (lead, 2026-11-25, from the user): a world of gods and demons; splendid, not restrained. The medium stays ink,
// mineral pigment, gold leaf and paper; the scale and the drama of the great moments go up several times.
//   arrive / boss, a big boss   -> 天降异象 (omen.js + impact.js + ink.js): the sky of the scroll fills with rolling ink
//                                  cloud, lightning of his element strikes where he lands and round it, the ground splits,
//                                  ink floods out, the shock crosses the screen and throws the crowd back, gold leaf comes
//                                  down. About 3 s. A small boss: less of all of it.
//   land, a heavy pattern       -> a god's blow (impact.js + blow.js): a column of his light, the ground split, the shock
//                                  crossing the screen, debris and sparks, a held frame and a hard kick, ink thrown.
//   evolve: seal (番天印)       -> the seal falls as a mountain (seal.js).
//   evolve: any other           -> for now, the element's pigment blooms round the hero (ink.js).
//   land: callName (张桂芳)     -> the call (voice.js).
import { createPost } from '../../render/post.js';
import { createInk, bossScript, evolveScript } from './ink.js';
import { createBlow } from './blow.js';
import { createWeather } from './weather.js';
import { createVoice } from './voice.js';
import { createImpact } from './impact.js';
import { createOmen } from './omen.js';
import { createSeal } from './seal.js';
import { createQuality } from './quality.js';
import { createTreasures } from './treasures.js';
import { createGods } from './gods.js';
import { createWonders } from './wonders.js';

// the heavy blows (pattern ids of content/bosses.js) and how heavy
const HEAVY = { pairedWhips: 1, threeWhips: 1, goldWall: 1.3, greatAxe: 0.9 };   // (pearlRing's pearls carry it: the god's ring over a 232 band covered the screen)
const LIGHT_OF = { metal: 'gold', fire: 'cinnabar', water: 'azurite', wood: 'malachite', earth: 'gold' };
// the six of 梅山 land with 袁洪 at once: the shock is his alone (fx/gl/finale.js gives each his own column of ink)
const MEISHAN_SIX = { wulong: 1, changhao: 1, daili: 1, jindasheng: 1, zhuzizhen: 1, yangxian: 1 };
// the finale's two bosses get a short entrance kept off the hero (finaleEntrance)
const FINALE_BOSS = { yuanhong: 1, zhouwang: 1 };
const BOSS_ELEMENT = { wenzhong: 'metal', zhangguifang: 'metal', moliqing: 'wood', molihong: 'water', molihai: 'metal', molishou: 'earth', kongxuan: 'fire', yuanhong: 'earth', zhouwang: 'fire' };

export function createGLFx(ctx, { elementOf = () => 'ink', kick = () => {} } = {}) {
  const post = createPost(ctx), ink = createInk(post), blow = createBlow(post), weather = createWeather(post), voice = createVoice(post);
  const Q = createQuality(ctx), impact = createImpact(post, Q), omen = createOmen(post, Q), wonders = createWonders(), _warm = wonders.loaded.then(() => ctx.prewarm && ctx.prewarm(wonders.image)), godsSheet = createWonders('gods'), _warmG = godsSheet.loaded.then(() => ctx.prewarm && ctx.prewarm(godsSheet.image)), seal = createSeal(ctx, impact, omen, wonders), treasures = createTreasures(ctx, ink, wonders, (a) => kick(a), godsSheet);
  const gods = createGods(ctx, wonders, { ink, kick: (a) => kick(a), hold: (s) => hard(0, s), gw: godsSheet });
  ink.quality = Q;
  let zNow = 1, G = null, wx = null, wAmt = 1, wWind = 0, lastBoss = { t: -9, x: 0, y: 0 }, clock = 0, blowsAt = -9, holdUntil = 0;
  const q = new URLSearchParams(globalThis.location ? location.search : ''); if (q.get('fxweather')) wx = q.get('fxweather');   // for review: ?fxweather=snow
  // a boss coming out of ink: until the lightning he is a figure of lacquer ink; then his colours rise from his hooves to
  // his crown along a line of gold light (art/index.js drawUnitAgain redraws him as he was drawn this frame)
  let drawAgain = null; const inked = [];
  const INK_RGB = [27, 21, 18], GOLD_RGB = [255, 214, 120];
  function inkFigures(V) {
    if (!drawAgain || !inked.length || !G) return;
    for (let i = 0; i < inked.length; i++) { const m = inked[i], u = (G.foes || []).find((f) => f.id === m.id); const age = clock - m.at;
      if (!u || age > m.until) { inked.splice(i--, 1); continue; }
      const k = Math.max(0, Math.min(1, (age - m.from) / (m.until - m.from))), kk = k * k * (3 - 2 * k);
      if (!m.box) { ctx.scissor([0, 0, 0, 0]); m.box = drawAgain(ctx, u); ctx.scissor(null); if (!m.box) continue; }
      const b = m.box, line = b.bottom - kk * (b.bottom - b.top + 12), H = b.bottom - b.top;
      ctx.save(); ctx.silhouette = INK_RGB; ctx.globalCompositeOperation = 'source-over';
      ctx.scissor([b.left - 4, b.top - 8, b.right + 4, line]); m.box = drawAgain(ctx, u) || m.box;       // above the line: still ink
      if (k > 0 && k < 1) { ctx.silhouette = GOLD_RGB; ctx.globalCompositeOperation = 'screen';           // the line of gold light
        ctx.scissor([b.left - 4, line - H * 0.05, b.right + 4, line + 2]); drawAgain(ctx, u);
        ctx.scissor([b.left - 4, line - H * 0.14, b.right + 4, line - H * 0.05]); ctx.globalAlpha = 0.45; drawAgain(ctx, u); }
      ctx.scissor(null); ctx.silhouette = null; ctx.restore(); }
  }
  const OFF = new Set((q.get('fxoff') || '').split(','));      // for profiling: ?fxoff=omen,ink,fissure,rings,over,debris,blow
  impact.off = OFF;
  const plan = [];                      // [time, fn]: the beats of a moment, in the effects' clock
  const at = (dt, fn) => plan.push([clock + dt, fn]);
  const hard = (a, hold) => { kick(a); holdUntil = Math.max(holdUntil, clock + hold); };

  // the sky closes only for the great ones: the three great bosses of the campaign and 纣王 (the lead, 2026-11-25); any other
  // boss comes with a short, small entrance: one strike of his light, ink thrown at his feet, a small kick
  const GREAT = { wenzhong: 1, kongxuan: 1, yuanhong: 1, zhouwang: 1 };
  function smallEntrance(e) {
    const el = BOSS_ELEMENT[e.kind] || 'metal', seed = Math.abs(Math.round(e.x * 7 + e.y * 3)) % 30;
    at(0.15, () => { impact.hit({ x: e.x, y: e.y + 6, power: 0.75, reach: e.shock ? e.shock.radius * 1.1 : 260, cracks: 6, light: LIGHT_OF[el], column: 0.08, flash: 0.22, debris: 50, sparks: 30, life: 2.2, seed });
      ink.bloom({ x: e.x, y: e.y + 8, w: 380, splats: bossScript(0.5), pigment: 'ink', life: 4.5, hero: true }); hard(10, 0.04); });
  }
  // the finale's two (袁洪 lands with his six in a crowd, 纣王 rides out of the gate with his host): a short entrance kept off the
  // hero (the lead, 2026-11-26: the shared one spread black ink and cracks over him for seconds); it clears within about a second
  function finaleEntrance(e) {
    const el = BOSS_ELEMENT[e.kind] || 'metal', light = impact.LIGHT[LIGHT_OF[el]] || impact.LIGHT.gold, h = G && G.hero, d = h ? Math.hypot(e.x - h.x, e.y - h.y) : 900, reach = Math.max(140, Math.min(420, d - 160));
    const seed = Math.abs(Math.round(e.x * 7 + e.y * 3)) % 30;
    omen.start({ x: e.x, y: e.y, life: 1.4, light, strikes: [{ t: 0.3, x: e.x, y: e.y + 6 }], seed, dark: 0.5 });
    if (e.id != null) inked.push({ id: e.id, at: clock, from: 0.3, until: 1.2, box: null });
    at(0.3, () => { impact.hit({ x: e.x, y: e.y + 6, power: 1.1, reach, cracks: 5, light: LIGHT_OF[el], column: 0.14, flash: 0.5, debris: 90, sparks: 70, life: 1.1, seed, ring: false }); hard(18, 0.08); });
  }
  function entrance(e) {
    if (FINALE_BOSS[e.kind]) return finaleEntrance(e);
    if (!GREAT[e.kind]) return smallEntrance(e);
    const big = e.tier !== 'small', el = BOSS_ELEMENT[e.kind] || 'metal', light = impact.LIGHT[LIGHT_OF[el]] || impact.LIGHT.gold;
    let s = Math.abs(Math.round(e.x * 7 + e.y * 3)) % 997 + 1; const r = () => ((s = (s * 16807 + 7) % 2147483647) / 2147483647);
    const strikes = [{ t: 0.42, x: e.x, y: e.y + 6 }];
    if (big) for (let i = 1; i < 4; i++) { const a = r() * 6.28, d = 220 + r() * 260; strikes.push({ t: 0.42 + i * 0.16 + r() * 0.08, x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.8 }); }
    const seed = s % 30;
    omen.start({ x: e.x, y: e.y, life: big ? 3.2 : 2.2, light, strikes, seed, dark: big ? 1 : 0.6 });
    if (e.id != null) inked.push({ id: e.id, at: clock, from: 0.45, until: big ? 2.1 : 1.6, box: null });
    strikes.forEach((S, i) => at(S.t, () => {
      if (i === 0) { impact.hit({ x: S.x, y: S.y, power: big ? 1.6 : 1.1, reach: e.shock ? e.shock.radius * 1.15 : big ? 560 : 380, cracks: big ? 10 : 8, light: LIGHT_OF[el], column: 0.18, flash: big ? 0.75 : 0.5, debris: big ? 200 : 120, sparks: 100, life: 3.6, seed });
        ink.bloom({ x: e.x, y: e.y + 10, w: big ? 900 : 620, splats: bossScript(big ? 1.25 : 0.9), pigment: 'ink', life: 7, hero: true }); hard(big ? 26 : 16, big ? 0.12 : 0.08); }
      else { impact.hit({ x: S.x, y: S.y, power: 0.6, reach: 200, cracks: 5, light: LIGHT_OF[el], column: 0.1, flash: 0.25, debris: 40, sparks: 40, life: 2.4, seed: (seed + i * 7) % 40 }); kick(8); }
    }));
  }
  function godBlow(e) {
    const w = HEAVY[e.id] || 1.2, power = Math.max(0.6, Math.min(1.4, ((e.radius || 110) / 110) * w)), second = clock - blowsAt < 0.25; blowsAt = clock;
    const boss = nearestBoss(e), el = (boss && BOSS_ELEMENT[boss.kind]) || 'metal', seed = Math.abs(e.x * 0.13 + e.y * 0.07) % 40;
    impact.hit({ x: e.x, y: e.y, power: second ? power * 0.8 : power, reach: e.shock ? e.shock.radius * 1.15 : 300 + 160 * power, cracks: 8, light: LIGHT_OF[el], column: 0.12, flash: second ? 0.3 : 0.55, debris: second ? 90 : 150, sparks: 80, life: 3, seed });
    blow.hit({ x: e.x, y: e.y, dir: dirOf(e, boss), power: second ? power * 0.8 : power * 1.15, seed, zc: zNow });
    hard(second ? 14 : 22 * power, second ? 0.05 : 0.09);
  }
  function onEvent(e, game) {
    if (game) G = game; treasures.onEvent(e); gods.onEvent(e, G);
    const t = e.type;
    if ((t === 'arrive' && e.tier !== 'lieutenant' && !MEISHAN_SIX[e.kind] && (e.tier || e.kind)) || t === 'boss') {
      if (clock - lastBoss.t < 2 && Math.hypot(e.x - lastBoss.x, e.y - lastBoss.y) < 200) return;      // 'arrive' and 'boss' come together
      lastBoss = { t: clock, x: e.x, y: e.y }; entrance(e);
    } else if (t === 'evolve') {
      const h = G && G.hero; if (!h) return;
      if (e.id === 'seal') { const d = h.facing < 0 ? -1 : 1; seal.start({ x: h.x + d * 240, y: h.y - 60 }, (a) => hard(a, 0.14)); }
      // (no wet wash at an evolution: its drops read as pools round him; the stroke ceremony and the treasure's own wonder carry it)
    } else if (t === 'land' && e.side === 'shang' && e.id === 'callName') {
      voice.call({ x: e.x, y: e.y, dir: typeof e.dir === 'number' ? e.dir : 0, half: ((e.angle || 36) * Math.PI) / 360, reach: e.radius || 440 });
    } else if (t === 'land' && e.side === 'shang' && (HEAVY[e.id] || e.great)) godBlow(e);
    else if (t === 'trueForm') hard(18, 0.08);      // 显圣: gods.js stands the 法相 up (no omen sky: its ink band would cover the image's head)
    else if (t === 'generalSkill' && e.id === 'thunderDive' && !e.trueForm) { const L = 380, d = e.dir || 0; at(0.12, () => impact.hit({ x: e.x + Math.cos(d) * L, y: e.y + Math.sin(d) * L, power: 0.7, reach: 240, cracks: 5, light: LIGHT_OF.wood, column: 0.12, flash: 0.2, debris: 40, sparks: 30, life: 2, seed: 9 })); }   // great: the rules' shock blows (SPEC-CAMPAIGN 1.10)
  }
  function nearestBoss(e) { let best = null, bd = 1e9; for (const f of (G && G.foes) || []) { if (!f.tier || f.state === 'dead') continue; const d = Math.hypot(f.x - e.x, f.y - e.y); if (d < bd) { bd = d; best = f; } } return best && bd < 900 ? best : null; }
  // the sky closing, in brush: rows of 祥云 (wonders' wcloud_0/1: spiral heads in ink line, a gold hair on a lower rim) over
  // the omen's wash sky, the back rows higher, smaller, paler and slower; they part above the one who comes
  function omenClouds(V) { const o = omen.cur; if (!o || !wonders.ready) return; const c = ctx, H = c.canvas.height, Wd = c.canvas.width, t = o.t;
    const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); }, env = sm(0, 0.45, t) * (1 - sm(o.life * 0.7, o.life, t)), Ax = V.sx(o.x);
    if (env <= 0) return; c.save(); c.globalCompositeOperation = 'source-over';
    for (let rr = 2; rr >= 0; rr--) { const k0 = H * (0.2 - 0.035 * rr) / 170, w = 480 * k0 * 1.25, y0 = H * (0.05 + 0.085 * (2 - rr)) - H * 0.3 * (1 - env), off = ((t * (32 - 11 * rr) * V.z + rr * 137) % (8 * w));
      for (let x = -off - w, i = 0; x < Wd + w; x += w, i++) { const n = Math.floor((x + off) / w + 0.5) + rr * 31, h = (q) => ((Math.sin(n * 12.9898 + q * 78.233) * 43758.5453) % 1 + 1) % 1;   // each tile its own: not a wallpaper
        if (h(1) < 0.22) continue; const k = k0 * (0.75 + 0.5 * h(2)), cx = x + w / 2 + (h(3) - 0.5) * w * 0.5, y = y0 + (h(4) - 0.5) * H * 0.06, d = Math.abs(cx - Ax) / (300 * V.z), part = d < 1 ? (1 - d) * (1 - d) : 0;
        wonders.draw(c, `wcloud_${h(5) < 0.5 ? 0 : 1}`, cx, y - part * H * 0.22, 0, (h(6) < 0.5 ? -k : k), k, env * (0.95 - 0.2 * rr) * (0.7 + 0.3 * h(7)) * (1 - 0.6 * part)); } }
    c.restore(); }
  // the ink is thrown away from whoever struck; else away from the hero
  function dirOf(e, boss) { const from = boss || (G && G.hero); if (!from) return 0.4; return Math.atan2((e.y - from.y) * 0.62, e.x - from.x); }
  return {
    onEvent,
    drawGround(V, dt) { clock += dt; zNow = V.z / V.dpr; Q.frame(omen.live + impact.live + seal.live > 0); for (let i = 0; i < plan.length; i++) if (plan[i][0] <= clock) { const f = plan[i][1]; plan.splice(i--, 1); f(); }
      if (ink.live && !OFF.has('ink')) ink.draw(); if (impact.live) impact.drawGround(V, dt); if (seal.live) seal.drawGround(V, dt); if (blow.live) blow.drawGround(V, dt); treasures.drawGround(V, dt, G); gods.drawGround(V, dt, G); },
    drawOver(V, dt) { if (voice.live) voice.draw(V, dt); inkFigures(V); treasures.drawOver(V, dt, G); gods.drawOver(V); if (omen.live && !OFF.has('omen')) { omen.draw(V, dt); omenClouds(V); } if (impact.live) impact.drawOver(V, dt); if (seal.live) seal.drawOver(V, dt); if (blow.live && !OFF.has('blow')) blow.draw(V, dt); if (wx) weather.draw(V, dt, wx, wAmt, wWind); treasures.drawLast(V); if (ink.live && !OFF.has('ink')) { const Vn = { ...V }; if (ctx.afterFrame) ctx.afterFrame(() => ink.after(Vn, dt)); else ink.after(Vn, dt); } },   // the ink steps after the frame's last draw (ink.js)
    setWeather(kind, amount = 1, wind = 0) { wx = kind || null; wAmt = amount; wWind = wind; },
    hold: () => Math.max(0, holdUntil - clock),
    useFigures: (f) => { drawAgain = f; treasures.useTip(f && f.heroWeapon); },
    reset() { ink.reset(); blow.reset(); voice.reset(); impact.reset(); omen.reset(); seal.reset(); treasures.reset(); gods.reset(); plan.length = 0; inked.length = 0; },
    /** the great moments this module plays itself: the stroke effects stand aside for them */
    owns: (e) => (e.type === 'evolve' && e.id === 'seal') || gods.owns(e),
    /** whether the painted wonder of this treasure is drawn here (the stroke effects then leave out their own) */
    has: (kind) => treasures.has(kind),
    get quality() { return { tier: Q.tier, why: Q.why }; },
    get live() { return ink.live + blow.live + impact.live + omen.live + seal.live; },
  };
}
