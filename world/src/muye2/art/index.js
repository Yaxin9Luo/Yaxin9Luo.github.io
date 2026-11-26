// The art of the field game, to the contract in lab/game-studies/SPEC-SURVIVORS.md, section 5.
//
//   const art = await loadArt({onProgress});       // onProgress(done, total)
//   art.setView({width, height, dpr});             // CSS px and the pixel ratio the canvas is drawn at
//   art.setTime(k);                                // 0 dawn .. 0.5 day .. 1 dusk
//   art.drawGround(ctx, cam);                      // paper, river, patches, the time of day, ground effects
//   art.drawWorld(ctx, cam, game, alpha, dt);      // warnings on the ground, then everything that stands, sorted by y
//   art.drawOver(ctx, cam, dt);                    // effects above the figures
//   art.onEvent(event, game);
//   art.paperAt(k) -> [r, g, b]   art.reset()   art.kick() -> [dx, dy]   art.stats   art.landmarks
//
// The view: a ground point (x, y) is at screen (x, y * KY), with the camera's point at (width / 2, height * 0.52).
// One size at every depth. What stands is upright and sorted by its ground y; what lies is squeezed by KY.
//
// READABILITY RULES kept here:
//   1. The hero is the largest figure, and stands on a patch of ground lifted toward the paper's tone.
//   2. The warband is lighter than any Shang and each man stands on a disc of azurite, which survives a blur.
//   3. Mass foes are dark simple silhouettes with one accent (from art/puppets; derived here if that folder is missing).
//   4. Strong cinnabar on the GROUND means danger and nothing else: lanes and rings of warning from game.zones.
//      (art/fx draws the zones, the pickups and the pearls and hoop when it is loaded; without it they are drawn here,
//      from ground/baked/marks.webp, so the game is never without its warnings.)
//   5. Standing scenery in front of the hero goes thin, so a pine never hides him.
import { loadGround, LANDMARKS } from './ground/ground.js';
import { SCENE_OF } from './ground/layout.js';
import { buildSprites, FLASH } from './sprites/sprites.js';
import { SCHEDULE, BY } from '../content.js';

const SEAMS = import.meta.glob(['./puppets/index.js', './fx/index.js']);       // either folder may be empty: then the fallback, or no effects
const KEYFIGS = import.meta.glob('./puppets/imagegen/figures.js');           // the generated key figures (hero, generals, bosses), drawn live: see that file
const ALLY = { shields: 'zhou:shield', spears: 'zhou:spear', archers: 'zhou:archer', strongmen: 'zhou:strongman' };
const SIZE = { hero: 1.34, 'zhou:shield': 1.36, 'zhou:spear': 1.36, 'zhou:archer': 1.36 };                 // on top of the puppets' own sizes
const AZURITE = [47, 79, 122];
const DISC = { rx: 21, ry: 8, a: 0.3, ring: AZURITE };                                                   // rule 2: the warband's mark is a thin azurite ring of ink round an ordinary shadow, never a filled disc
const SHADOW = { hero: { rx: 58, ry: 12, dx: 2, a: 0.55, rgb: [74, 68, 61], dry: 1 },      // a dry wash with a broken edge, mid ink, the horse's footprint
  'zhou:shield': DISC, 'zhou:spear': DISC, 'zhou:archer': DISC, 'zhou:strongman': { ...DISC, rx: 36, ry: 11 } };
const STRIDE = { hero: 250, 'shang:captain': 90, 'shang:leader': 120, 'zhou:strongman': 90, 'shang:chariot': 170 };
const PIGMENT = { pearls: '#2F4F7A', ring: '#B08A3C', sash: '#2F4F7A', seal: '#35302B', whip: '#B08A3C', banner: '#3F7D6A', spear: '#B8321F' };
// cut at load: the hero and the foes of every minute. Troops, generals and named foes are cut when they first appear.
const CORE = { hero: 1, 'shang:spear': 1, 'shang:axe': 1, 'shang:shield': 1, 'shang:archer': 1, 'shang:shaman': 1, 'shang:chariot': 1 };
// What art/fx draws from game.shots when it is there. If fx exports `shotKinds` (a Set, an array or an object of kinds),
// that is used instead, so this list cannot drift from it.
const FX_SHOTS = { pearls: 1, ring: 1, boulder: 1, blade: 1, talisman: 1 };
const NO_KICK = [0, 0];
// The hero is never flashed white (in a crowd, chained hits made him a paper ghost). A hit shows as a cinnabar edge round
// him: his silhouette in cinnabar, a little larger, drawn BEHIND him, for HIT.life seconds, begun at most once every HIT.every.
const HIT = { life: 0.16, every: 0.34, grow: 0.07, a: 0.8 };
const INK = '#14110F', TAU = Math.PI * 2, HERO_FRONT = 46;
// Rule 1, at density (tester S-1.3). Foes near the hero are NEVER thinned: they are the ones that hurt him, and a faded
// foe reads as dying. He is kept forward by his size, by being drawn in front of what touches him, by a wash of bare
// paper on the GROUND under and just round him, and by the mass being flat and dull everywhere.
// The mass of Shang is cut duller and darker than its puppets: its gold and green are accents of a dark shape, never
// the loudest colour on the screen (that is the hero's cinnabar) and never the pickups' gold.
const MASS_TONE = { 'shang:spear': 1, 'shang:axe': 1, 'shang:shield': 1, 'shang:archer': 1 }, TONE = { flat: [[27, 21, 18], [84, 77, 68]], at: 0.3 };      // the ordinary mass in two flat dark tones: lacquer, and one dull tone for what was gold, green and bone
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), frac = (v) => v - Math.floor(v);
const tierOf = (level) => (level >= 5 ? '5' : level >= 3 ? '3' : '1');

export async function loadArt({ onProgress = () => {}, puppets, fx: wantFx = true, pocket = true, budgetMB = 320, dpr = Math.min(3, globalThis.devicePixelRatio || 1), seed = 7 } = {}) {
  // the sheets are cut at the size they are drawn: the display's density times the camera's zoom, which the page sets from the
  // window's area (main.js: clamp(sqrt(W*H / (1440*900)), .7, 1.6)); cut at the density alone they were stretched up to 1.6 times
  // on a large screen and looked soft. (Old machines no longer matter; the budget is raised to hold it.)
  const viewZoom = Math.min(1.6, Math.max(0.7, Math.sqrt(((globalThis.innerWidth || 1440) * (globalThis.innerHeight || 900)) / (1440 * 900))));
  // the page draws the field at window x devicePixelRatio (up to 3), capped at 3840 x 2400 px of area (main.js, 2026-11-25): the density
  // the field is really drawn at is the smaller of the two
  const W0 = globalThis.innerWidth || 1440, H0 = globalThis.innerHeight || 900, fieldDpr = Math.min(dpr, Math.sqrt((3840 * 2400) / (W0 * H0)));   // main.js resize(): the same area cap
  const bakeDpr = fieldDpr * Math.max(1, viewZoom);
  let done = 0, total = 14 + 20; const tick = () => onProgress(Math.min(++done, total - 1), total);
  // ---- the seams
  let source = null, sourceName = 'art/puppets';
  if (puppets !== 'fallback' && SEAMS['./puppets/index.js']) { try { const m = await SEAMS['./puppets/index.js'](); if (m.PUPPETS && m.createCutter) source = m; } catch (e) { console.warn('muye art: art/puppets failed to load, using the fallback puppets', e); } }
  if (!source) { source = await import('./sprites/fallback.js'); sourceName = 'fallback (fengshen puppets, derived silhouettes)'; }
  let fx = null;
  if (wantFx && SEAMS['./fx/index.js']) { try { const m = await SEAMS['./fx/index.js'](); if (m.loadFx) fx = await m.loadFx(); } catch (e) { console.warn('muye art: art/fx failed to load, drawing without effects', e); } }
  // the key figures from generated art: a unit whose kind has one is drawn live from its jointed parts, not from a baked sheet
  // (a dozen big figures of twenty frames each would pass the sprite budget). Without the folder, the code puppets stand in.
  let live = null;
  if (puppets !== 'fallback' && KEYFIGS['./puppets/imagegen/figures.js']) { try { live = await (await KEYFIGS['./puppets/imagegen/figures.js']()).loadKeyFigures(undefined, { paper: '#EFE7D6' }); } catch (e) { console.warn('muye art: the key figures failed to load, using the code puppets', e); } }
  const fxShots = (() => { const k = fx && fx.shotKinds; if (!k) return FX_SHOTS; const o = {}; for (const id of (k instanceof Set || Array.isArray(k) ? k : Object.keys(k))) o[id] = 1; return o; })();
  const ground = await loadGround(tick, seed), KY = ground.KY, base = done, PUP = source.PUPPETS;
  const sprites = await buildSprites(source, { dpr: bakeDpr, budgetMB, core: (k) => !!CORE[k] && !(k === 'hero' && live && live.has('hero:wuwang')),   /* the hero is the live 武王: his code puppet is cut only if he is ever unhorsed (ensure, below), not 69 MB at load */ shadowOf: (k, v) => (PUP[k].noShadow && PUP[k].noShadow.includes(v) ? false : k === 'hero' && !pocket ? { rx: 66, ry: 15, a: 0.8, hard: 0.5 } : SHADOW[k] || (k.startsWith('zhou:') && PUP[k].shadow ? { ...DISC, rx: Math.max(DISC.rx, PUP[k].shadow[0] * 1.15), ry: Math.max(DISC.ry, PUP[k].shadow[1] * 1.35) } : null)), toneOf: (k) => (pocket && MASS_TONE[k] && !PUP[k].generated ? TONE : null), sizeOf: (k) => SIZE[k] || 1, onProgress: (a, b) => { done = base + Math.round((a / b) * (total - base)); onProgress(Math.min(done, total - 1), total); } });
  onProgress(total, total);

  // ---- the view
  let W = 1440, H = 900, D = 1, z = 1, ox = 0, oy = 0, now = 0, lastAlpha = 1, liveWarm = false, heroPhase = 0, heroAt = null, heroO = {}, warmKeys = new Set(), coming = [], comingAt = -99, brings = [], bringsAt = -99, castAt = -9, castReach = 0, castHeavy = false, warns = new Map(), lastGame = null, hitT = 9, lastFlash = 0, marchLen = 0;
  const sx = (x) => ox + x * z, sy = (y) => oy + y * KY * z;
  const V = { W: 1440, H: 900, z: 1, dpr: 1, cx: 0, cy: 0, hw: 0, hh: 0, sx, sy };
  function view(cam) { z = cam.zoom * D; ox = (W / 2 + (cam.shakeX || 0)) * D - cam.x * z; oy = (H * 0.52 + (cam.shakeY || 0)) * D - cam.y * KY * z;
    V.W = Math.round(W * D); V.H = Math.round(H * D); V.z = z; V.dpr = D; V.cx = cam.x; V.cy = cam.y; V.hw = W / 2 / cam.zoom + 30; V.hh = (H * 0.52) / cam.zoom / KY + 40; }

  // ---- one figure: one drawImage (two in the instant it is hurt)
  function sprite(ctx, S, f, X, Y, flip, a, flash) { const s = z * S.k; ctx.setTransform(flip * s, 0, 0, s, X, Y); ctx.globalAlpha = a; ctx.drawImage(S.img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    /* No figure is ever drawn as a white silhouette: there is no hit flash on the figures (chained hits turned allies and named foes into paper cut-outs). A hit is the effects' mark; the hero has his cinnabar edge. */ }
  const at = (list, i) => list[i < 0 ? 0 : i >= list.length ? list.length - 1 : i];
  // the generated mass's back-banner (elites, 御林军, Zhou ranks 4 and 5): left out of the baked frame and drawn here, before
  // the figure, bent as cloth with ctx.drawStrip where the context has it (plain drawImage otherwise). Its place in each frame
  // comes from the puppets (liveBanner), found once per frame of the sheet.
  const bannerOfFrame = new WeakMap(), waves = new WeakMap();
  function liveBanner(ctx, P, S, f, u, X, Y, face, a, dt) {
    let B = bannerOfFrame.get(f);
    if (B === undefined) { B = null; const st0 = (P.tiers && P.tiers[vVar]) || P.states;
      for (const st in S.frames) { const i = S.frames[st].indexOf(f); if (i >= 0) { const e = st0[st] && st0[st][i] && st0[st][i][0]; if (e && e.gen) B = P.liveBanner(vVar, e); break; } }
      bannerOfFrame.set(f, B); }
    if (!B || !B.m) return;
    let W = waves.get(u); if (!W) waves.set(u, (W = { ph: (u.id || 0) * 0.7, snap: 0 }));
    const sn = clamp(Math.hypot(u.vx || 0, u.vy || 0) / 140); W.ph += dt * (3 + 2.5 * sn);
    if (u.state === 'attack' && (u.stateT || 0) < 0.1) W.snap = 1; W.snap = Math.max(0, W.snap - dt * 4);
    const m = B.m; ctx.setTransform(face * z, 0, 0, z, X, Y); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.globalAlpha = a * B.fade;
    if (ctx.drawStrip) ctx.drawStrip(B.img, 0, 0, B.w, B.h, B.ox, B.oy, B.w, B.h, { from: 'right', amp: B.h * 0.07 * (0.4 + 0.6 * sn), phase: W.ph, waves: 0.8, lean: B.h * 0.06 * sn, snap: W.snap });
    else ctx.drawImage(B.img, B.ox, B.oy, B.w, B.h);
  }
  // ?drawcheck: per kind on screen, what was drawn (for the mass's pipeline check, lab/game-studies/imagegen/mass/drawcheck.mjs):
  // drawn, frames from a generated atlas (not a code puppet), frames standing taller than a shadow, stand-ins. Off otherwise.
  const DC = /[?&]drawcheck/.test((globalThis.location && location.search) || '') ? (globalThis.__muyeDrawCheck = { kinds: {}, gen: source.GEN_KEYS || [] }) : null;
  const dcInfo = new WeakMap();
  function noteDraw(key, S, f, P) { const r = DC.kinds[key] || (DC.kinds[key] = { drawn: 0, generated: 0, tall: 0, standIn: 0 }); r.drawn++;
    let I = dcInfo.get(f); if (!I) { let gen = false; const st0 = (P.tiers && P.tiers[vVar]) || P.states;
      for (const st in S.frames) { const i = S.frames[st].indexOf(f); if (i >= 0) { const e = st0[st] && st0[st][i] && st0[st][i][0]; gen = !!(e && e.gen); break; } }
      I = { gen, tall: f[5] * S.k > 20 }; dcInfo.set(f, I); }                                // f[5]: sheet px above the foot point; S.k: game px per sheet px
    if (I.gen) r.generated++; if (I.tall) r.tall++; }
  // the hero's 花狐貂 (spoil `marten`): the generated beast in its friendly dress (variant 'f', a cinnabar and gold caparison: it reads as Zhou's), drawn from the
  // body the rules move. circle and back: the gallop, by distance; leap: the stretched lunge; bite: the lunge held, then the gather.
  const beastUnit = new WeakMap();
  function drawBeast(ctx, m, alpha, dt) {
    const key = 'shang:marten'; if (!PUP[key] || !PUP[key].generated) return; const S = setFor(key, 'f'); if (!S) return;
    let u = beastUnit.get(m); if (!u) beastUnit.set(m, (u = { id: 9001 }));
    const x = (m.px ?? m.x) + (m.x - (m.px ?? m.x)) * alpha, y = (m.py ?? m.y) + (m.y - (m.py ?? m.y)) * alpha;
    u.state = m.state === 'leap' || m.state === 'bite' ? 'attack' : 'walk'; u.stateT = m.state === 'bite' ? 0.12 + (m.stateT || 0) : m.state === 'leap' ? 0 : m.stateT || 0;
    u.facing = Math.cos(m.dir || 0) >= 0 ? 1 : -1; u.vx = (m.x - (m.px ?? m.x)) * 60; u.vy = (m.y - (m.py ?? m.y)) * 60;
    vVar = 'f'; const f = frameOf(S, u, key, x, y); if (!f) return;
    if (DC) noteDraw('spoil:marten', S, f, PUP[key]);
    sprite(ctx, S, f, sx(x), sy(y), faceOf(u, dt), 1, 0);
  }
  // a unit's facing, eased: a turn is a short squash through the flip (0.12 s end to end), not an instant mirror
  const turning = new WeakMap(), TURN = 0.12;
  function faceOf(u, dt) { const t = u.facing < 0 ? -1 : 1; let v = turning.get(u);
    if (v === undefined || v === t) { if (v === undefined) turning.set(u, t); return t; }
    v = t > v ? Math.min(t, v + (2 * dt) / TURN) : Math.max(t, v - (2 * dt) / TURN); turning.set(u, v);
    return Math.abs(v) < 0.12 ? (v < 0 ? -0.12 : 0.12) : v; }
  // what the hero's live figure needs besides his unit: the weapon, the time since it struck, whether a foe is in its reach (else the rules
  // retry every 0.12 s and the arm must not keep winding up), and his eased facing
  // a general's key figure: his 显圣 true form when he has one ('zhou:<id>-true'), else the ordinary figure only while not in true form
  // (a true form with no figure yet keeps the code puppet's 法相)
  const generalKey = (u) => (u.kind !== 'general' ? '' : u.trueForm ? (live && live.has('zhou:' + u.general + '-true') ? 'zhou:' + u.general + '-true' : '') : 'zhou:' + u.general);
  // the hero travelling under the earth (spoil earthTravel, s.under while his spring lasts): he is not drawn
  // the player's mark on the ground (F9, read in grey): an ink ring brushed round where he stands, open at the back, with a
  // cinnabar seal carved 周 at its front; nothing else on the field has it. Painted once (RES canvas px a world px), world size RX.
  const SEAL = { RX: 58, RES: 3, cv: null };
  function sealCanvas() {
    if (SEAL.cv) return SEAL.cv;
    const r = SEAL.RES, rx = SEAL.RX * r, ry = rx * KY, pad = 22 * r, c = document.createElement('canvas'); c.width = Math.ceil(2 * (rx + pad)); c.height = Math.ceil(2 * (ry + pad));
    const x = c.getContext('2d'), cx = c.width / 2, cy = c.height / 2; let h = 7;
    const rnd = () => ((h = (h * 16807) % 2147483647) / 2147483647);
    x.lineCap = 'round';
    // the ring: one brush stroke of dabs round the ellipse, landing heavy at the back left, thinning, and lifting dry before it
    // closes (an open gap); dry hairs streak along its edges
    const a0 = -2.05, span = Math.PI * 2 - 0.6, n = 420;
    for (let i = 0; i < n; i++) { const u = i / n, a = a0 + span * u, p = (u < 0.06 ? 0.75 + 4 * u : 1) * (u > 0.7 ? Math.max(0.12, 1 - (u - 0.7) / 0.3) : 1);
      const w = (4.2 + 1.6 * Math.sin(u * 23) * 0.5 + 1.2 * (rnd() - 0.5)) * p * r, wob = (Math.sin(u * 9.0) * 1.2 + (rnd() - 0.5) * 0.6) * r;
      const px = cx + (rx + wob) * Math.cos(a), py = cy + (ry + wob * KY) * Math.sin(a);
      x.fillStyle = `rgba(20,16,12,${(0.55 + 0.3 * rnd()) * (u > 0.85 ? 0.7 : 1)})`; x.beginPath(); x.ellipse(px, py, w, w * (0.55 + 0.25 * KY), a + Math.PI / 2, 0, Math.PI * 2); x.fill(); }
    for (let k = 0; k < 7; k++) { const off = (rnd() - 0.5) * 7 * r, e = a0 + span * (0.55 + 0.45 * rnd());
      x.strokeStyle = `rgba(20,16,12,${0.25 + 0.3 * rnd()})`; x.lineWidth = (0.5 + 0.8 * rnd()) * r; x.beginPath(); x.ellipse(cx, cy, rx + off, ry + off * KY, 0, a0 + 0.3 * rnd(), e); x.stroke(); }
    // the seal: a small square of cinnabar at the front of the ring, 周 cut white out of it
    const sz = 17 * r, sx0 = cx - sz / 2, sy0 = cy + ry - sz * 0.55;
    x.fillStyle = '#8f2417'; x.fillRect(sx0, sy0, sz, sz); x.strokeStyle = 'rgba(22,18,14,0.8)'; x.lineWidth = 1.2 * r; x.strokeRect(sx0, sy0, sz, sz);
    x.fillStyle = '#f3ead8'; x.font = `bold ${Math.round(sz * 0.78)}px "Songti SC", "STSong", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('周', cx, sy0 + sz * 0.53);
    return (SEAL.cv = c);
  }
  const heroUnder = (game) => { const L = (game.build && game.build.spoils) || []; for (const s of L) if (s.id === 'earthTravel' && s.under) return true; return false; };
  // the hero on foot drawn as a unit of the key figures: walk when he moves, stagger when hurt
  const afootUnit = (h) => { const sc = now - castAt; return { id: 'hero', state: h.hurtT > 0 ? 'stun' : sc < 0.6 ? 'attack' : h.moving ? 'walk' : 'idle', stateT: h.hurtT > 0 ? 0.25 - h.hurtT : sc < 0.6 ? sc : h.stateT || 0, facing: h.facing, speed: 130 }; };   // his weapon's cast plays the thrust
  const REACH = { spear: 145, halberd: 110, glaive: 125, bow: 600, steelWhip: 95 };   // the rules' reach (SPEC-CAMPAIGN 2.4: 105, 70, 85, 600, 55) plus 40 px: he gathers as a foe closes
  function heroMotion(game, h, hx, hy, dt) {
    const w = game.build && game.build.weapon, m = game.mods || {};
    let reach = false; if (w) { const r = (REACH[w.id] || 200) * (m.area || 1), r2 = r * r;
      for (const f of game.foes) if (f.state !== 'dead' && (f.x - hx) ** 2 + (f.y - hy) ** 2 < r2) { reach = true; break; } }
    return { weapon: w ? { id: w.id, cd: w.cd / (m.weaponRate || 1) } : null, since: now - castAt, reach, reachPx: castReach || null, heavy: castHeavy, face: faceOf(h, dt) };   // reachPx: the last cast's own reach (× g.mods.area), so the drawn blow reaches as far as the rules'
  }
  // Which frame of its sheet a unit shows. State names are the rules' own; every kind falls back to what it has.
  function frameOf(S, u, key, x, y) {
    const F = S.frames, st = u.state, t = u.stateT || 0, P = PUP[key];
    if (F.run) {                                                                             // chariots: the Shang's, and the Zhou squad's
      if (st === 'dead') return at(F.wreck || F.idle || F.run, Math.floor(t / 0.22));
      const L = st === 'skill' && F.charge ? F.charge : F.run;
      return st === 'walk' || st === 'charge' || st === 'skill' ? L[Math.floor(frac((x + y * 0.6) / (STRIDE[key] || 170)) * L.length)] : (F.idle || F.run)[0]; }
    switch (st) {
      case 'dead': return at(F.dead || F.hurt || F.idle, Math.floor(t / 0.14));
      case 'windup': { let L = F.windup || F.idle;
        if (F.chant && u.kind === 'shaman') return F.chant[Math.floor(t * 3) % F.chant.length];
        if (F.windup2 && (u.act === 'aim' ? !F.rush : wall(u))) L = F.windup2;                // the leader's set for the charge; Wen Zhong's whip pointed for the golden wall
        return at(L, Math.floor(t / 0.4)); }
      case 'attack': return at(F.attack || F.throw || F.idle, Math.floor(t / 0.12));
      case 'skill': { const L = (P && P.skill && F[P.skill.state]) || F.skill || F.attack || F.idle; return at(L, Math.floor(t / 0.22)); }   // a squad's skill, a general's
      case 'charge': if (F.rush) return F.rush[Math.floor(frac((x + y * 0.6) / 200) * F.rush.length)]; if (F.attack2) return F.attack2[0];   // falls through to the walk for kinds with no charge of their own
      case 'walk': { const L = F.walk || F.idle; return L[Math.floor(frac((x * 0.9 + y * 0.6) / (STRIDE[key] || (P && P.stride) || 46) + (u.id || 0) * 0.37) * L.length)]; }
      case 'stun': return (F.hurt || F.idle)[0];
      default: return (F.idle || F.walk)[0];
    }
  }
  // is this named foe calling its wall? (the rules give the foe no pattern id; the warning's zone has it)
  function wall(u) { if (!lastGame) return false; for (const zo of lastGame.zones) if (!zo.dead && zo.side === 'shang' && zo.pattern === 'goldWall') return true; return false; }
  function heroFrame(S, h, dt) {
    const F = S.frames, t = h.stateT || 0;
    if (h.state === 'fall' && F.fall) return at(F.fall, t < 0.35 ? 0 : t < 0.58 ? 1 : t < 0.78 ? 2 : t < 1.2 ? 3 : 4);
    if (h.state === 'dash' && F.spring) return at(F.spring, t < 0.12 ? 0 : 1);
    if (h.state === 'idle' || (!h.moving && h.state !== 'hurt')) return F.stand[0];
    heroPhase = frac(heroPhase + (Math.hypot(h.vx || 0, h.vy || 0) * dt) / STRIDE.hero); const L = h.fullCry ? F.cry : F.gallop;
    if (h.state === 'hurt' && F.hurt && t < 0.12) return F.hurt[0];
    return L[Math.floor(heroPhase * L.length)];
  }

  // ---- what stands in view, pooled and sorted by ground y
  const pool = [], order = []; let used = 0;
  const put = (y, type, ref, x) => { let e = pool[used]; if (!e) e = pool[used] = { y: 0, type: 0, ref: null, x: 0, yy: 0 }; used++; e.y = y; e.type = type; e.ref = ref; e.x = x; order.push(e); return e; };
  const byY = (a, b) => a.y - b.y;
  const P_PROP = 0, P_PICK = 1, P_FOE = 2, P_ALLY = 3, P_HERO = 4, P_SHOT = 5, P_BEAST = 6;
  const levels = {}, firstTier = {}, RANK = ['1', '1', '2', '3', '4', '5'];
  // The sheet for a unit, by the figures' own rule (puppets `keyOf`): a soldier by his kind and HIS rank, a general by
  // his id, plain or in his true form, a foe by its kind. Only when the figures have no such key does a stand-in show.
  let vKey = '', vVar = '';
  function keyFor(u, ally) {
    if (!ally) { vKey = 'shang:' + u.kind; vVar = ''; return; }
    if (u.kind === 'general') { vKey = 'zhou:' + u.general; vVar = u.trueForm ? 'true' : '1'; if (PUP[vKey]) return; }
    vKey = 'zhou:' + u.kind; const P = PUP[vKey];
    if (P) { vVar = P.tiers ? (P.tiers[u.rank] ? RANK[u.rank] || String(u.rank) : tierFor(vKey, u.rank || levels[u.kind] || 1)) : ''; return; }
    vKey = ALLY[u.kind] || 'zhou:spear'; vVar = tierFor(vKey, levels[u.kind] || 1); standIns[u.kind === 'general' ? 'general ' + u.general : u.kind] = 1;
  }
  const standIns = {};
  function tierFor(key, level) { const P = PUP[key]; if (!P || !P.tiers) return ''; let best = ''; for (const t in P.tiers) if (+t <= level && (best === '' || +t > +best)) best = t; return best || firstTier[key] || (firstTier[key] = Object.keys(P.tiers)[0]); }
  function warmOffer(offer, ctx) {
    for (const o of offer) { if (!o || (o.kind !== 'troop' && o.kind !== 'general')) continue;
      const key = 'zhou:' + o.id; if (!PUP[key] || (o.kind === 'general' && live && live.has(key))) continue;
      const vs = o.kind === 'general' ? [o.trueForm ? 'true' : '1'] : PUP[key].tiers ? Object.keys(PUP[key].tiers) : [''];   // a squad's men show the tier of their own rank: all of them
      for (const v of vs) if (!sprites.get(key, v)) { const S = sprites.ensureStep ? sprites.ensureStep(key, v, 8) : sprites.ensure(key, v); if (S && ctx.prewarm) ctx.prewarm(S.img); return; } }   // about 8 ms of cutting a frame; its texture uploaded once it is done, not on first draw                   // one cut a frame
  }
  // the Shang kinds the schedule's waves and elites bring by t + 30 s that have no sheet and no live figure (rebuilt once a second)
  function comingKinds(t) {
    if (Math.abs(t - comingAt) < 1) return coming; comingAt = t; const want = new Set();
    for (const w of SCHEDULE.waves || []) if (w.t <= t + 30) for (const k in w.mix) if (w.mix[k] > 0) want.add('shang:' + k);
    for (const e of SCHEDULE.elites || []) if (e.t <= t + 30) want.add('shang:' + e.kind);
    coming = [...want].filter((k) => PUP[k] && !(live && live.has(k)) && !sprites.get(k, '')); return coming;
  }
  // what a boss brings that would otherwise be cut whole on its first frame mid-fight (a frame of 55 ms or more): his retinue in
  // every phase, what his patterns summon, and his spoil's beast in the hero's dress (花狐貂: 'shang:marten', variant 'f'); listed
  // from 30 s before he is due (game.campaign.next) and while he is on the field (rebuilt once a second), cut a step a frame
  function bossBrings(game) {
    if (Math.abs(game.t - bringsAt) < 1) return brings; bringsAt = game.t; const c = game.campaign, kinds = new Set(), want = [];
    if (c && c.next && c.next.t <= game.t + 30) kinds.add(c.next.kind);
    if (c) for (const f of c.live || []) if (!f.dead && f.state !== 'dead') kinds.add(f.kind);
    for (const k of kinds) { const row = BY.foe[k]; if (!row) continue;
      for (const R of row.retinue || []) want.push(['shang:' + R.kind, '']);
      for (const p of row.patterns || []) if (p.shape === 'summon' && p.kind) want.push(['shang:' + p.kind, '']);
      const sp = BY.spoilOf[k]; if (sp && sp.id === 'marten') want.push(['shang:marten', 'f']); }
    brings = want.filter(([k, v], i) => PUP[k] && !(live && live.has(k)) && !sprites.get(k, v) && want.findIndex((w) => w[0] === k && w[1] === v) === i); return brings;
  }
  const setFor = (key, variant) => sprites.get(key, variant) || sprites.ensure(key, variant);

  // For art/fx: draw one unit again exactly as drawWorld drew it in this frame (same frame, place, size; no shadow, no hit edge),
  // with the context's current state (fx sets a silhouette colour and a scissor band). Returns [left, top, right, bottom] in device px, or null.
  function drawUnitAgain(ctx, u) {
    const g = lastGame; if (!g || !u || u.state === 'away') return null;   // a withdrawn general stands at the hero's point: nothing of him is drawn
    const a = lastAlpha, x = (u.px ?? u.x) + (u.x - (u.px ?? u.x)) * a, y = (u.py ?? u.y) + (u.y - (u.py ?? u.y)) * a, X = sx(x), Y = sy(y);
    let box = null;
    if (u === g.hero) {
      if (heroUnder(g)) return null;
      if (live && live.has('hero:wuwang-afoot') && u.state === 'afoot') box = live.drawUnit(ctx, 'hero:wuwang-afoot', afootUnit(u), X, Y, z, now, x, y, 1, false, faceOf(u, 0), {});
      else if (live && live.has('hero:wuwang') && u.state !== 'afoot') box = live.drawHero(ctx, 'hero:wuwang', u, X, Y, z, heroPhase, now, 0, '', 0, false, heroO);
      else { const v = ((g.build && g.build.resonance) || []).slice(0, 3).join('+'), S = sprites.get('hero', v) || sprites.ensure('hero', ''); if (!S) return null;
        const save = heroPhase, f = heroFrame(S, u, 0); heroPhase = save; box = spriteBox(S, f, X, Y, u.facing < 0 ? -1 : 1); sprite(ctx, S, f, X, Y, u.facing < 0 ? -1 : 1, 1, 0); }
    } else {
      const ally = (g.allies || []).includes(u);
      if (live) { const lk = ally ? generalKey(u) : 'shang:' + u.kind;
        if (lk && live.has(lk)) box = live.drawUnit(ctx, lk, u, X, Y, z, now, x, y, 1, false, faceOf(u, 0), { warn: u.state === 'windup' ? warns.get(u.id) : null }); }
      if (!box) { keyFor(u, ally); let key = vKey, S = PUP[key] ? sprites.get(key, vVar) : null;
        if (!S) { key = !ally ? (u.elite && PUP['shang:moliqing'] ? 'shang:moliqing' : 'shang:spear') : 'zhou:spears'; S = sprites.get(key, PUP[key] && PUP[key].tiers ? '1' : ''); }
        if (!S) return null; const f = frameOf(S, u, key, x, y); if (!f) return null; const fl = u.facing < 0 ? -1 : 1; box = spriteBox(S, f, X, Y, fl); sprite(ctx, S, f, X, Y, fl, 1, 0); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    return box && box[2] > box[0] ? { left: box[0], top: box[1], right: box[2], bottom: box[3] } : null;
  }
  function spriteBox(S, f, X, Y, flip) { const s = z * S.k, xa = X - flip * f[4] * s, xb = X + flip * (f[2] - f[4]) * s; return [Math.min(xa, xb), Y - f[5] * s, Math.max(xa, xb), Y + (f[3] - f[5]) * s]; }
  // For art/fx: the hero's weapon this frame, { tipX, tipY } in device px of its striking end (the bow: the grip), id, since (seconds since
  // the weapon's cast event), blowAt (seconds after the cast when the blow frame lands: 0, the blow lands on the cast). null when 武王 is not drawn live.
  drawUnitAgain.heroWeapon = () => (live && live.tip && lastGame && lastGame.hero && lastGame.hero.state !== 'afoot' ? live.tip : null);
  if (fx && fx.useFigures) { try { fx.useFigures(drawUnitAgain); } catch (e) { console.warn('muye art: fx.useFigures failed', e); } }

  const art = {
    standIns,                                                    // kinds that had to borrow another's figure: empty when the wiring is whole
    get live() { return live; },                                  // the key figures (debug and tools)
    drawUnitAgain, heroWeapon: () => drawUnitAgain.heroWeapon(),   // the same drawer as handed to fx.useFigures: (ctx, unit) -> {left, top, right, bottom} | null
    KY, landmarks: LANDMARKS, stats: { sprites: sprites.stats, puppets: sourceName, fx: !!fx, keyFigures: live ? Object.keys(live.figs) : [], props: ground.props.length, patches: ground.patches.length }, ground, sprites,
    setView(v) { W = v.width; H = v.height; D = v.dpr || 1;
      // the window grew after load (a small window maximised): the sheets were cut for the old size and would be magnified.
      // Ask for a finer cut (the field's density times the zoom main.js gives this window); sprites re-cuts in the background
      if (sprites.raise) sprites.raise(D * Math.max(1, Math.min(1.6, Math.max(0.7, Math.sqrt((W * H) / (1440 * 900)))))); },
    setTime(k) { ground.setTime(k); if (fx && fx.setTime) fx.setTime(k); },
    /** the campaign's scenes (ground/ground.js): setStretch('xiqi' | 'passes' | 'mengjin'); march(t 0..1, to) during the change, march(null) after; preload(scene) ahead */
    northView: () => (ground.northView ? ground.northView() : null), setStretch: (s) => ground.setStretch(s), march: (t, to) => ground.march(t, to), preload: (s) => ground.preload(s),
    paperAt: (k) => ground.paperAt(k),
    reset() { heroPhase = 0; heroAt = null; castAt = -9; warns.clear(); lastGame = null; hitT = 9; lastFlash = 0; if (fx && fx.reset) fx.reset(); },
    /** The page calls this ahead of a named foe's arrival (cp.next): his key figure's parts are uploaded a few a frame before he comes. kind: a foe kind ('wenzhong') or a key ('shang:wenzhong'). */
    warm(kind) { const k = String(kind).includes(':') ? String(kind) : 'shang:' + kind; if (live && live.has(k)) warmKeys.add(k); },
    onEvent(e, game) { if (e.type === 'cast' && e.weapon) { castAt = now; castReach = e.length || e.radius || 0; castHeavy = !!e.heavy; } if (e.type === 'warn' && e.id != null) warns.set(e.id, { shape: e.shape, time: e.time, kind: e.kind }); if (fx && fx.onEvent) fx.onEvent(e, game); },   // the hero's weapon struck: his arm's beat keys off it
    /** the effects' camera kick for a heavy blow, [dx, dy] in CSS px; [0, 0] when idle or without art/fx */
    kick: () => (fx && fx.kick ? fx.kick() : NO_KICK),
    /** seconds the page should hold the rules still now (a held frame on a great blow), 0 if none */
    hold: () => (fx && fx.hold ? fx.hold() : 0),

    drawGround(ctx, cam, dt = 0) {
      view(cam); ground.drawBase(ctx, V);
      if (heroAt) ground.mark(ctx, 'clear', sx(heroAt[0]), sy(heroAt[1]) - 20 * z, z, { kx: 3.0, ky: 3.1, a: 0.8 });      /* 0.96 on bare paper; on the coloured ground of the campaign scenes a full patch reads as a spotlight */       // rule 1: a wash of bare paper under and just round him, on the ground layer only
      ground.drawTone(ctx, V);
      // the player's mark under him, over the ground's tone and under art/fx's danger on the ground
      if (heroAt && lastGame && lastGame.hero && lastGame.hero.hp > 0 && !heroUnder(lastGame)) { const cv = sealCanvas(), k = z / SEAL.RES;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(cv, sx(heroAt[0]) - (cv.width / 2) * k, sy(heroAt[1]) - (cv.height / 2) * k, cv.width * k, cv.height * k); }
      if (fx && fx.drawGround) { fx.drawGround(ctx, cam, dt, lastGame); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    },

    drawWorld(ctx, cam, game, alpha = 1, dt = 0) {
      view(cam); now += dt; lastAlpha = alpha;
      used = 0; order.length = 0; sprites.touch();
      if (live && !liveWarm) liveWarm = live.prewarm(ctx, 12);
      if (live && warmKeys.size) for (const k of warmKeys) { if (live.warm(ctx, k)) warmKeys.delete(k); break; }   // art.warm(kind): a boss's parts uploaded before he arrives
      // while an offer holds the game still, cut the sheets of what it offers (one a frame): a squad or general the player picks
      // then appears without a synchronous cut (a read-back of 50 ms or more) in the middle of the fight
      if (game.phase === 'offer' && game.offer) warmOffer(game.offer, ctx);
      // the code-drawn hero (shown only when 武王 is unhorsed) is not cut at load beside the live hero: cut him here, a step of
      // about 8 ms a frame from the first frame (never mid-fight at the moment he falls), while no offer is warming its own
      else if (live && sprites.ensureStep && !sprites.get('hero', '')) { const S = sprites.ensureStep('hero', '', 8); if (S && ctx.prewarm) ctx.prewarm(S.img); }
      else if (sprites.recutStep && !sprites.recutStep(8)) { /* the window grew: re-cutting, a step a frame */ }
      // then the Shang kinds the schedule brings within the next 30 s (content.js SCHEDULE, read only), a step of about 8 ms a
      // frame: the first cavalry (from 4:00), wasps or fire crows are otherwise cut in one go on their first frame (a 60 ms frame)
      // what the boss due next (or on the field) brings with him, the same way
      else if (sprites.ensureStep && bossBrings(game).length) {
        const [k, v] = brings[0], S = sprites.get(k, v) || sprites.ensureStep(k, v, 8); if (S) { brings.shift(); if (ctx.prewarm) ctx.prewarm(S.img); } }
      else if (sprites.ensureStep && comingKinds(game.t).length) {
        const k = coming[0], S = sprites.get(k, '') || sprites.ensureStep(k, '', 8); if (S) { coming.shift(); if (ctx.prewarm) ctx.prewarm(S.img); } }
      if (game !== lastGame) { lastGame = game; if (ground.setSeed && game.seed != null) ground.setSeed(game.seed); if (fx && fx.onEvent) fx.onEvent({ type: 'game' }, game); }      // the field of this run comes from its seed (ground/layout.js)                 // art/fx reads zones, pickups and shots from the game it was last handed
      const h = game.hero, hx = h.px + (h.x - h.px) * alpha, hy = h.py + (h.y - h.py) * alpha; heroAt = [hx, hy];
      /* the campaign's scene and march drive the ground (rules: sim/campaign.js; scene 0..3 -> ground/layout.js SCENE_OF) */
      const cg = game.campaign; if (cg && ground.setStretch && ground.follow !== false) { const sc = SCENE_OF[cg.scene] || 'xiqi';
        if (cg.march > 0) { const to = SCENE_OF[cg.marchTo] || sc; marchLen = Math.max(marchLen, cg.march); if (to !== sc) { ground.preload(to); ground.march(clamp(1 - cg.march / marchLen), to); } }
        else { marchLen = 0; ground.march(null); ground.setStretch(sc); if (game.t > 60 && cg.scene < 2) ground.preload(SCENE_OF[cg.scene + 1]); }
        for (const m of game.landmarks || []) if (m.taken) ground.setSpent(String(m.id).split(':').pop());
        if (ground.setGate) for (const gt of game.gates || []) ground.setGate(String(gt.id).split(':').pop(), !!gt.open); }
      const x0 = V.cx - V.hw - 160, x1 = V.cx + V.hw + 160, y0 = V.cy - V.hh - 60, y1 = V.cy + V.hh + 260;
      // rule 4: danger on the ground, in cinnabar, under everything that stands
      if (!fx) for (const zo of game.zones || []) { if (zo.dead) continue; const k = zo.life > 0 && isFinite(zo.life) ? clamp(zo.t / zo.life) : 1;
        if (zo.side === 'shang') { const a = 0.5 + 0.5 * k * k;
          if (zo.shape === 'lane') { const dx = Math.cos(zo.dir), dy = Math.sin(zo.dir) * KY, L = Math.hypot(dx, dy) * zo.len, wd = (zo.w || 80) * Math.hypot(Math.sin(zo.dir), Math.cos(zo.dir) * KY); ground.mark(ctx, 'lane', sx(zo.x), sy(zo.y), z, { kx: L / 600, ky: Math.max(0.5, wd / 78), rot: Math.atan2(dy, dx), a }); }
          else ground.mark(ctx, 'warn', sx(zo.x), sy(zo.y), z, { k: (zo.r || 100) / 100, a }); }
        else if (zo.r > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.3; ctx.strokeStyle = PIGMENT[zo.src] || INK; ctx.lineWidth = 2 * D; ctx.beginPath(); ctx.ellipse(sx(zo.x), sy(zo.y), zo.r * z, zo.r * KY * z, 0, 0, TAU); ctx.stroke(); } }
      ctx.globalAlpha = 1;
      for (const p of ground.props) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + 300) put(p.y, P_PROP, p, 0);
      if (!fx) for (const p of game.pickups || []) if (!p.dead && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) put(p.y - 2, P_PICK, p, 0);
      for (const f of game.foes) if (f.x > x0 - 200 && f.x < x1 + 200 && f.y > y0 && f.y < y1 + 120) put(f.state === 'dead' ? f.y - 14 : f.y, P_FOE, f, 0);
      for (const a of game.allies || []) if (a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) put(pocket && a.y > hy && (a.y - hy) * KY < 80 && Math.abs(a.x - hx) < 84 ? hy + HERO_FRONT - 1 : a.y, P_ALLY, a, 0);   // his own men never stand over him either
      for (const s of game.shots || []) if (!s.dead && s.kind !== 'arrow' && !(fx && fxShots[s.kind]) && s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) put(s.y, P_SHOT, s, 0);
      // the hero's own beast (spoil `marten`, 魔礼寿's 花狐貂 taken): a body the rules move (sim/spoils.js: x, y, px, py, dir, state, stateT)
      const beast = game.build && game.build.spoils && game.build.spoils.find((x) => x.id === 'marten');
      if (beast && beast.x != null && beast.x > x0 && beast.x < x1 && beast.y > y0 && beast.y < y1) put(beast.y, P_BEAST, beast, 0);
      put(h.y + HERO_FRONT, P_HERO, h, 0);                                                    // rule 1: what touches him from the front does not cover him
      order.sort(byY);
      for (const e of (game.build && game.build.troops) || []) levels[e.id] = e.level || 1;
      for (let i = 0; i < order.length; i++) { const e = order[i], u = e.ref;
        if (e.type === P_FOE || e.type === P_ALLY) { if (u.state === 'away' || u.state === 'under') continue;                         // a general withdrawn, or gone under the ground: nothing stands there
          if (live) { const lk = e.type === P_ALLY ? generalKey(u) : 'shang:' + u.kind;      // a general in his true form keeps the code puppet's 法相 for now
            if (lk && live.has(lk)) { const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
              const bx = live.drawUnit(ctx, lk, u, sx(x), sy(y), z, now, x, y, u.state === 'dead' ? clamp((0.62 - u.stateT) / 0.3) : 1, true, faceOf(u, dt), { warn: u.state === 'windup' ? warns.get(u.id) : null });
              if (DC) { const r = DC.kinds['live:' + lk] || (DC.kinds['live:' + lk] = { drawn: 0, generated: 0, tall: 0, standIn: 0 }); r.drawn++; r.generated++;   // live key figures: drawn from their generated parts; tall when the drawn box stands above a shadow
                if (bx && bx[3] - bx[1] > 24 * z) r.tall++; }
              continue; } }
          keyFor(u, e.type === P_ALLY); let key = vKey, S = PUP[key] ? setFor(key, vVar) : null;
          if (!S) { standIns[key] = 1; if (DC) (DC.kinds[key] || (DC.kinds[key] = { drawn: 0, generated: 0, tall: 0, standIn: 0 })).standIn++; key = e.type === P_FOE ? (u.elite && PUP['shang:moliqing'] ? 'shang:moliqing' : 'shang:spear') : 'zhou:spears'; S = setFor(key, PUP[key] && PUP[key].tiers ? '1' : ''); }
          if (!S) continue;
          const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha, f = frameOf(S, u, key, x, y); if (!f) continue;
          let a = u.state === 'dead' ? clamp((0.62 - u.stateT) / 0.3) : 1;
          if (DC) noteDraw(key, S, f, PUP[key]);
          const face = faceOf(u, dt); if (PUP[key] && PUP[key].liveBanner) liveBanner(ctx, PUP[key], S, f, u, sx(x), sy(y), face, a, dt);
          sprite(ctx, S, f, sx(x), sy(y), face, a, u.flash); }
        else if (e.type === P_BEAST) drawBeast(ctx, u, alpha, dt);
        else if (e.type === P_PROP) { const big = u.r >= 100, front = u.y > hy && (ground.hides ? ground.hides(u, hx, hy) : u.y - hy < (big ? 640 : 300) && Math.abs(u.x - hx) < (big ? u.r * 1.5 : 95)); ctx.globalAlpha = front ? (big ? 0.42 : 0.32) : 1;      /* a landmark the hero is behind goes thin too */ ground.prop(ctx, u, sx(u.x), sy(u.y), z); }     // rule 5
        else if (e.type === P_PICK) { const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha; ground.mark(ctx, u.kind === 'spirit' ? 'spirit' + (u.size || 0) : u.kind, sx(x), sy(y) - (u.kind === 'spirit' ? (1.5 + 1.5 * Math.sin(now * 3.1 + u.id)) * z : 0), z); }
        else if (e.type === P_HERO && heroUnder(game)) { /* under the earth with 张奎's 地行术: nothing of him shows; art/fx draws the mound */ }
        else if (e.type === P_HERO && live && live.has('hero:wuwang-afoot') && h.state === 'afoot') {   // unhorsed: 武王 on foot from the generated art, his cinnabar edge kept
          hitT += dt; if (h.flash > 0 && h.flash >= lastFlash && hitT > HIT.every) hitT = 0; lastFlash = h.flash || 0;
          live.drawUnit(ctx, 'hero:wuwang-afoot', afootUnit(h), sx(hx), sy(hy), z, now, hx, hy, 1, true, faceOf(h, dt), {}); }
        else if (e.type === P_HERO && live && live.has('hero:wuwang') && h.state !== 'afoot') {      // 武王 from the generated art; on foot (unhorsed) the code hero stands in until a 武王 afoot exists
          hitT += dt; if (h.flash > 0 && h.flash >= lastFlash && hitT > HIT.every) hitT = 0; lastFlash = h.flash || 0;
          if (h.moving && h.state !== 'idle') heroPhase = frac(heroPhase + (Math.hypot(h.vx || 0, h.vy || 0) * dt) / STRIDE.hero);
          heroO = heroMotion(game, h, hx, hy, dt);
          live.drawHero(ctx, 'hero:wuwang', h, sx(hx), sy(hy), z, heroPhase, now, hitT < HIT.life ? HIT.a * (1 - hitT / HIT.life) : 0, '#B8321F', HIT.grow, true, heroO); }
        else if (e.type === P_HERO) { const v = ((game.build && game.build.resonance) || []).slice(0, 3).join('+'), S = sprites.get('hero', v) || (v && sprites.ensure('hero', v)) || sprites.ensure('hero', ''); const f = heroFrame(S, h, dt);
          hitT += dt; if (h.flash > 0 && h.flash >= lastFlash && hitT > HIT.every) hitT = 0; lastFlash = h.flash || 0;
          if (hitT < HIT.life && S.edge) { const s2 = z * S.k, g = HIT.grow; ctx.setTransform((h.facing < 0 ? -1 : 1) * s2, 0, 0, s2, sx(hx), sy(hy)); ctx.globalAlpha = HIT.a * (1 - hitT / HIT.life);
            ctx.drawImage(S.edge, f[0] / FLASH, f[1] / FLASH, f[2] / FLASH, f[3] / FLASH, -f[4] - f[2] * g / 2, -f[5] - f[3] * g / 2, f[2] * (1 + g), f[3] * (1 + g)); }
          sprite(ctx, S, f, sx(hx), sy(hy), h.facing < 0 ? -1 : 1, 1, 0); }
        else { const x = (u.px ?? u.x) + (u.x - (u.px ?? u.x)) * alpha, y = (u.py ?? u.y) + (u.y - (u.py ?? u.y)) * alpha, X = sx(x), Y = sy(y) - 24 * z;
          if (u.kind === 'orb') ground.mark(ctx, 'orb', X, Y, z, { kx: u.vx < 0 ? -1 : 1, ky: 1 });
          else { const r = (PIGMENT[u.kind] ? Math.max(4, u.r || 6) * 0.7 : Math.min(8, Math.max(4, (u.r || 6) * 0.5))) * z;   /* a shot with no drawing of its own stays a small mark, never a black ball */
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = PIGMENT[u.kind] || '#6B645C'; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU);
            if (u.kind === 'ring') { ctx.strokeStyle = PIGMENT.ring; ctx.lineWidth = 3 * z; ctx.stroke(); } else { ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9 * z; ctx.stroke(); } } }
      }
      // arrows fly over the field: two paths, one a side
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = 'round';
      for (const side of ['zhou', 'shang']) { let any = false; ctx.beginPath();
        for (const s of game.shots || []) { if (s.dead || s.kind !== 'arrow' || s.side !== side) continue; const x = (s.px ?? s.x) + (s.x - (s.px ?? s.x)) * alpha, y = (s.py ?? s.y) + (s.y - (s.py ?? s.y)) * alpha, X = sx(x), Y = sy(y) - 26 * z;
          const vx = s.vx || 1, vy = (s.vy || 0) * KY, n = Math.hypot(vx, vy) || 1, ux = vx / n, uy = vy / n, L = 17 * z; any = true;
          ctx.moveTo(X - ux * L, Y - uy * L); ctx.lineTo(X, Y); ctx.moveTo(X - ux * 4 * z - uy * 3 * z, Y - uy * 4 * z + ux * 3 * z); ctx.lineTo(X, Y); ctx.lineTo(X - ux * 4 * z + uy * 3 * z, Y - uy * 4 * z - ux * 3 * z);
          ctx.moveTo(X - ux * L - uy * 2.4 * z, Y - uy * L + ux * 2.4 * z); ctx.lineTo(X - ux * (L - 4 * z), Y - uy * (L - 4 * z)); ctx.lineTo(X - ux * L + uy * 2.4 * z, Y - uy * L - ux * 2.4 * z); }
        if (any) { ctx.strokeStyle = side === 'shang' ? '#1B1512' : '#3B4658'; ctx.lineWidth = (side === 'shang' ? 1.7 : 1.3) * z; ctx.stroke(); } }
      ctx.globalAlpha = 1;
    },

    drawOver(ctx, cam, dt = 0) { view(cam);
      if (fx && fx.gl && ground.weatherState) { const w = ground.weatherState(); ground.ownFall = true; fx.setWeather(w.fall || null, w.amount ?? 1, w.wind || 0); }      // on WebGL2 the effects draw what falls; on Canvas 2D the ground's sheets do
      if (ground.drawOver) ground.drawOver(ctx, V); if (fx && fx.drawOver) { fx.drawOver(ctx, cam, dt, lastGame); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } },
  };
  return art;
}
