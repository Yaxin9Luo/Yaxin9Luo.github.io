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
import { buildSprites, FLASH } from './sprites/sprites.js';

const SEAMS = import.meta.glob(['./puppets/index.js', './fx/index.js']);       // either folder may be empty: then the fallback, or no effects
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

export async function loadArt({ onProgress = () => {}, puppets, fx: wantFx = true, pocket = true, budgetMB = 64, dpr = Math.min(2, globalThis.devicePixelRatio || 1), seed = 7 } = {}) {
  let done = 0, total = 14 + 20; const tick = () => onProgress(Math.min(++done, total - 1), total);
  // ---- the seams
  let source = null, sourceName = 'art/puppets';
  if (puppets !== 'fallback' && SEAMS['./puppets/index.js']) { try { const m = await SEAMS['./puppets/index.js'](); if (m.PUPPETS && m.createCutter) source = m; } catch (e) { console.warn('muye art: art/puppets failed to load, using the fallback puppets', e); } }
  if (!source) { source = await import('./sprites/fallback.js'); sourceName = 'fallback (fengshen puppets, derived silhouettes)'; }
  let fx = null;
  if (wantFx && SEAMS['./fx/index.js']) { try { const m = await SEAMS['./fx/index.js'](); if (m.loadFx) fx = await m.loadFx(); } catch (e) { console.warn('muye art: art/fx failed to load, drawing without effects', e); } }
  const fxShots = (() => { const k = fx && fx.shotKinds; if (!k) return FX_SHOTS; const o = {}; for (const id of (k instanceof Set || Array.isArray(k) ? k : Object.keys(k))) o[id] = 1; return o; })();
  const ground = await loadGround(tick, seed), KY = ground.KY, base = done, PUP = source.PUPPETS;
  const sprites = await buildSprites(source, { dpr, budgetMB, core: (k) => !!CORE[k], shadowOf: (k, v) => (PUP[k].noShadow && PUP[k].noShadow.includes(v) ? false : k === 'hero' && !pocket ? { rx: 66, ry: 15, a: 0.8, hard: 0.5 } : SHADOW[k] || (k.startsWith('zhou:') && PUP[k].shadow ? { ...DISC, rx: Math.max(DISC.rx, PUP[k].shadow[0] * 1.15), ry: Math.max(DISC.ry, PUP[k].shadow[1] * 1.35) } : null)), toneOf: (k) => (pocket && MASS_TONE[k] ? TONE : null), sizeOf: (k) => SIZE[k] || 1, onProgress: (a, b) => { done = base + Math.round((a / b) * (total - base)); onProgress(Math.min(done, total - 1), total); } });
  onProgress(total, total);

  // ---- the view
  let W = 1440, H = 900, D = 1, z = 1, ox = 0, oy = 0, now = 0, heroPhase = 0, heroAt = null, lastGame = null, hitT = 9, lastFlash = 0;
  const sx = (x) => ox + x * z, sy = (y) => oy + y * KY * z;
  const V = { W: 1440, H: 900, z: 1, dpr: 1, cx: 0, cy: 0, hw: 0, hh: 0, sx, sy };
  function view(cam) { z = cam.zoom * D; ox = (W / 2 + (cam.shakeX || 0)) * D - cam.x * z; oy = (H * 0.52 + (cam.shakeY || 0)) * D - cam.y * KY * z;
    V.W = Math.round(W * D); V.H = Math.round(H * D); V.z = z; V.dpr = D; V.cx = cam.x; V.cy = cam.y; V.hw = W / 2 / cam.zoom + 30; V.hh = (H * 0.52) / cam.zoom / KY + 40; }

  // ---- one figure: one drawImage (two in the instant it is hurt)
  function sprite(ctx, S, f, X, Y, flip, a, flash) { const s = z * S.k; ctx.setTransform(flip * s, 0, 0, s, X, Y); ctx.globalAlpha = a; ctx.drawImage(S.img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    /* No figure is ever drawn as a white silhouette: there is no hit flash on the figures (chained hits turned allies and named foes into paper cut-outs). A hit is the effects' mark; the hero has his cinnabar edge. */ }
  const at = (list, i) => list[i < 0 ? 0 : i >= list.length ? list.length - 1 : i];
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
      case 'walk': { const L = F.walk || F.idle; return L[Math.floor(frac((x * 0.9 + y * 0.6) / (STRIDE[key] || 46) + (u.id || 0) * 0.37) * L.length)]; }
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
  const P_PROP = 0, P_PICK = 1, P_FOE = 2, P_ALLY = 3, P_HERO = 4, P_SHOT = 5;
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
  const setFor = (key, variant) => sprites.get(key, variant) || sprites.ensure(key, variant);

  const art = {
    standIns,                                                    // kinds that had to borrow another's figure: empty when the wiring is whole
    KY, landmarks: LANDMARKS, stats: { sprites: sprites.stats, puppets: sourceName, fx: !!fx, props: ground.props.length, patches: ground.patches.length }, ground, sprites,
    setView(v) { W = v.width; H = v.height; D = v.dpr || 1; },
    setTime(k) { ground.setTime(k); if (fx && fx.setTime) fx.setTime(k); },
    paperAt: (k) => ground.paperAt(k),
    reset() { heroPhase = 0; heroAt = null; lastGame = null; hitT = 9; lastFlash = 0; if (fx && fx.reset) fx.reset(); },
    onEvent(e, game) { if (fx && fx.onEvent) fx.onEvent(e, game); },
    /** the effects' camera kick for a heavy blow, [dx, dy] in CSS px; [0, 0] when idle or without art/fx */
    kick: () => (fx && fx.kick ? fx.kick() : NO_KICK),

    drawGround(ctx, cam, dt = 0) {
      view(cam); ground.drawBase(ctx, V);
      if (heroAt) ground.mark(ctx, 'clear', sx(heroAt[0]), sy(heroAt[1]) - 20 * z, z, { kx: 3.0, ky: 3.1, a: 0.96 });       // rule 1: a wash of bare paper under and just round him, on the ground layer only
      ground.drawTone(ctx, V);
      if (fx && fx.drawGround) { fx.drawGround(ctx, cam, dt, lastGame); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    },

    drawWorld(ctx, cam, game, alpha = 1, dt = 0) {
      view(cam); now += dt; used = 0; order.length = 0; sprites.touch();
      if (game !== lastGame) { lastGame = game; if (fx && fx.onEvent) fx.onEvent({ type: 'game' }, game); }                 // art/fx reads zones, pickups and shots from the game it was last handed
      const h = game.hero, hx = h.px + (h.x - h.px) * alpha, hy = h.py + (h.y - h.py) * alpha; heroAt = [hx, hy];
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
      put(h.y + HERO_FRONT, P_HERO, h, 0);                                                    // rule 1: what touches him from the front does not cover him
      order.sort(byY);
      for (const e of (game.build && game.build.troops) || []) levels[e.id] = e.level || 1;
      for (let i = 0; i < order.length; i++) { const e = order[i], u = e.ref;
        if (e.type === P_FOE || e.type === P_ALLY) { if (u.state === 'away' || u.state === 'under') continue;                         // a general withdrawn, or gone under the ground: nothing stands there
          keyFor(u, e.type === P_ALLY); let key = vKey, S = PUP[key] ? setFor(key, vVar) : null;
          if (!S) { standIns[key] = 1; key = e.type === P_FOE ? (u.elite && PUP['shang:moliqing'] ? 'shang:moliqing' : 'shang:spear') : 'zhou:spears'; S = setFor(key, PUP[key] && PUP[key].tiers ? '1' : ''); }
          if (!S) continue;
          const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha, f = frameOf(S, u, key, x, y); if (!f) continue;
          let a = u.state === 'dead' ? clamp((0.62 - u.stateT) / 0.3) : 1;
          sprite(ctx, S, f, sx(x), sy(y), u.facing < 0 ? -1 : 1, a, u.flash); }
        else if (e.type === P_PROP) { const front = u.y > hy && u.y - hy < 300 && Math.abs(u.x - hx) < 95 && u.r < 100; ctx.globalAlpha = front ? 0.32 : 1; ground.prop(ctx, u, sx(u.x), sy(u.y), z); }     // rule 5
        else if (e.type === P_PICK) { const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha; ground.mark(ctx, u.kind === 'spirit' ? 'spirit' + (u.size || 0) : u.kind, sx(x), sy(y) - (u.kind === 'spirit' ? (1.5 + 1.5 * Math.sin(now * 3.1 + u.id)) * z : 0), z); }
        else if (e.type === P_HERO) { const v = ((game.build && game.build.resonance) || []).slice(0, 3).join('+'), S = sprites.get('hero', v) || (v && sprites.ensure('hero', v)) || sprites.get('hero', ''); const f = heroFrame(S, h, dt);
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

    drawOver(ctx, cam, dt = 0) { if (fx && fx.drawOver) { fx.drawOver(ctx, cam, dt, lastGame); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } },
  };
  return art;
}
