// Boss health bars (PLAN-CAMPAIGN section 8, SPEC-CAMPAIGN 1.2), in the look the lead chose: the lacquer tally. A black
// lacquer plate with cut corners and a thin gold-leaf rim, cinnabar lacquer inside; harm just taken stays a moment as a
// pale-gold trail and drains after the red. Over each boss, lieutenant and wounded elite a short tally follows the
// figure (on the page's own overlay canvas, #marks, never the art's); the big and final boss also have a long named
// tally at the top of the screen (DOM for the type, a small canvas for the bar) with gold studs for the phases.
// Black lacquer reads over the new Shang army, which is drawn in white and bone on pale ground.
// Rules kept here: a bar never hides a warned blow (it fades to a ghost over a live Shang warning on the ground);
// the over-head bar is a little narrower than its figure and stands clear above its head ornament; the mass has none.
import {tierOf, phasesOf} from './campaign.js';
import {KEY_FIGURES} from '../art/puppets/imagegen/figures.js';

const JADE_PALE = '#DCEBE2', JADE_DARK = '#4E7D68', JADE_INK = '#2F5A48';      // the antidote's marks: healing, never the bosses' red
const LACQUER = '#1B1512', CIN = '#B8321F', CIN_DARK = '#8E2415', GOLD = '#B08A3C', GOLD_LIGHT = '#E3CC8E', HOLLOW = '#3A2A22';
// the over-head bar's height, and its width as limits in CSS px, by tier
const SIZE = {final: {h: 11, min: 110, max: 170}, big: {h: 10, min: 96, max: 150}, small: {h: 9, min: 74, max: 120}, lieutenant: {h: 7, min: 56, max: 90}, elite: {h: 6, min: 40, max: 64}};
// a figure's drawn height and width in world px when neither the art nor its sheet can say
const GUESS = {final: [250, 160], big: [210, 150], small: [180, 110], lieutenant: [150, 90], elite: [110, 80]};
const GAP = 8;      // CSS px of clear air between the top of the figure (its ornament included) and the bar

/** The figure's drawn box above its feet, in world px: {top, width}. Asked of the art first (SPEC-CAMPAIGN "Page"),
    else, for a generated key figure the art is drawing, its head-top height from the figures' table (KEY_FIGURES[key].height,
    rescaled to the lead's H rule; 袁洪 as a stone has his own), else read once from the first frame of its sheet (the
    first row and the outer columns with ink in them), else guessed. */
const boxes = new Map();
function boxOf(art, u, tier) {
  if (art && art.figureBox) { try { const b = art.figureBox(u); if (b && b.top > 0) return {top: b.top, width: b.width || GUESS[tier][1]}; } catch { /* fall through */ } }
  let key = 'shang:' + u.kind, F = KEY_FIGURES[key];
  if (F && art && art.live && art.live.has && art.live.has(key)) {
    if (F.forms && F.forms.stone && u.guardT > 0 && KEY_FIGURES[F.forms.stone]) F = KEY_FIGURES[F.forms.stone];
    return {top: F.height + (F.hover || 0),      // measured in the page: the table's head top already clears the drawn crown
       width: F.shadow ? F.shadow[0] * 2.6 : GUESS[tier][1]};
  }
  let b = boxes.get(u.kind);
  if (b === undefined) {
    b = null;
    try {
      const S = art && art.sprites && art.sprites.get('shang:' + u.kind, ''), F = S && S.frames, f = F && ((F.idle || F.walk || F.run || Object.values(F)[0]) || [])[0];
      if (f) {
        const c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
        const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(S.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
        const d = x.getImageData(0, 0, f[2], f[3]).data;
        let top = f[3], left = f[2], right = 0;
        for (let y = 0; y < f[3]; y++) for (let i = 0; i < f[2]; i++) if (d[(y * f[2] + i) * 4 + 3] > 40) { if (y < top) top = y; if (i < left) left = i; if (i > right) right = i; }
        if (top < f[3]) b = {top: (f[5] - top) * S.k, width: (right - left) * S.k};
      }
    } catch { /* the sheet is not cut yet, or cannot be read */ }
    boxes.set(u.kind, b);
  }
  return b || {top: GUESS[tier][0], width: GUESS[tier][1]};
}

/* ---------- the tally ---------- */
function plate(c, x, y, w, h, cc) { c.beginPath(); c.moveTo(x + cc, y); c.lineTo(x + w - cc, y); c.lineTo(x + w, y + cc); c.lineTo(x + w, y + h - cc); c.lineTo(x + w - cc, y + h); c.lineTo(x + cc, y + h); c.lineTo(x, y + h - cc); c.lineTo(x, y + cc); c.closePath(); }
/** A tally of share `k` with a trail to share `lag`, at x, y (top-left of the inside), w by h. `studs`: the phases as
    gold studs on the rim (the long bar); otherwise as small notches cut into the rim (over the head). */
function tally(c, x, y, w, h, k, lag, phases, studs) {
  const cut = Math.min(4, h * .5);
  plate(c, x - 2, y - 2, w + 4, h + 4, cut + 1); c.fillStyle = LACQUER; c.fill();
  plate(c, x - .5, y - .5, w + 1, h + 1, cut); c.strokeStyle = GOLD; c.lineWidth = 1; c.stroke();
  const ix = x + 1.5, iy = y + 1.5, iw = w - 3, ih = h - 3;
  c.fillStyle = HOLLOW; c.fillRect(ix, iy, iw, ih);
  if (lag > k) { c.fillStyle = GOLD_LIGHT; c.fillRect(ix + iw * k, iy, iw * (lag - k), ih); }
  if (k > 0) { const g = c.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, '#D04B33'); g.addColorStop(.55, CIN); g.addColorStop(1, CIN_DARK); c.fillStyle = g; c.fillRect(ix, iy, Math.max(1, iw * k), ih); }
  for (let i = 1; i < phases.length; i++) {
    const px = Math.round(x + w * phases[i]) + .5;
    if (studs) {      // a gold stud astride the rim, with a point of light, and a hairline down through the lacquer
      c.strokeStyle = 'rgba(176,138,60,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, iy); c.lineTo(px, iy + ih); c.stroke();
      const r = Math.max(3, h * .3);
      // matte bronze, no shine (the user's board rejects bright gold and metallic dots)
      for (const sy of [y - 1, y + h + 1]) { c.fillStyle = LACQUER; c.beginPath(); c.arc(px, sy, r + 1.2, 0, Math.PI * 2); c.fill(); c.fillStyle = GOLD; c.beginPath(); c.arc(px, sy, r, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(27,21,18,.35)'; c.beginPath(); c.arc(px, sy, r * .4, 0, Math.PI * 2); c.fill(); }
    } else { c.fillStyle = GOLD; c.beginPath(); c.moveTo(px - 2.5, y - 2); c.lineTo(px + 2.5, y - 2); c.lineTo(px, y + 1.5); c.closePath(); c.fill(); }
  }
}

/* ---------- warnings: a bar over a live Shang warning fades to a ghost ---------- */
function inZone(zo, x, y) {
  if (zo.shape === 'lane') { const dx = x - zo.x, dy = y - zo.y, cs = Math.cos(zo.dir), sn = Math.sin(zo.dir), a = dx * cs + dy * sn, b = -dx * sn + dy * cs; return a >= -20 && a <= zo.len + 20 && Math.abs(b) <= (zo.w || 80) / 2 + 20; }
  const r = (zo.r || 100) + 20; return (x - zo.x) ** 2 + (y - zo.y) ** 2 <= r * r;
}
function overWarning(game, x, y) { for (const zo of game.zones || []) if (!zo.dead && zo.side === 'shang' && inZone(zo, x, y)) return true; return false; }

/** The trail: it holds a moment after a blow, then drains toward the red. */
function drain(e, k, dt, hold, rate) {
  if (k < e.lag - .001) { if (e.hold <= 0 && !e.draining) e.hold = hold; if (e.hold > 0) { e.hold -= dt; if (e.hold <= 0) e.draining = true; } if (e.draining) e.lag = Math.max(k, e.lag - dt * rate); }
  else { e.lag = k; e.hold = 0; e.draining = false; }
  if (e.lag <= k + .001) e.draining = false;
  return e.lag;
}

/* ---------- the overlay ---------- */
export function createBars({canvas, top}) {
  const ctx = canvas.getContext('2d');
  const lags = new Map();       // unit id -> the trail's state
  let W = 0, H = 0, D = 1, barId = 0, topK = 1, lastTop = null;
  const topTrail = {lag: 1, hold: 0, draining: false};
  const topCanvas = top.querySelector('canvas'), tctx = topCanvas.getContext('2d');
  const api = {
    look: 'c', holdId: 0,
    resize(w, h, dpr) { W = w; H = h; D = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); },
    clear() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); lags.clear(); barId = 0; top.classList.remove('on', 'enraged', 'faint'); },
    /** One frame of the over-head bars. `view`: {cam, ky, alpha}. Returns how many bars were drawn, for checks. */
    draw(game, art, view, dt, bossBarId) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!W || !H) return 0;
      const {cam, ky, alpha} = view, cx = W / 2 + (cam.shakeX || 0), cy = H * .52 + (cam.shakeY || 0), z = cam.zoom;
      ctx.setTransform(D, 0, 0, D, 0, 0);
      let n = 0;
      for (const u of game.foes) {
        if (u.dead || u.state === 'dead' || !(u.hp > 0) || !u.maxHp) continue;
        const tier = tierOf(u); if (!tier) continue;
        if (u.duelFoe && u.id === bossBarId) continue;      // in a duel his long bar is the only one: none over his head
        const k = Math.max(0, Math.min(1, u.hp / u.maxHp));
        if (tier === 'elite' && k >= .999) continue;      // an elite's bar appears with its first wound: 300 figures do not wear 30 full bars
        const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
        const sx = cx + (x - cam.x) * z; if (sx < -100 || sx > W + 100) continue;
        const box = boxOf(art, u, tier), S = SIZE[tier] || SIZE.elite, h = S.h;
        const w = Math.round(Math.max(S.min, Math.min(S.max, box.width * z * .78)));      // a little narrower than the figure
        const by = Math.round(cy + (y - cam.y) * ky * z - box.top * z - GAP - h), bx = Math.round(sx - w / 2);
        if (by < 70 || by > H + 20) continue;
        let e = lags.get(u.id); if (!e) { e = {lag: k, hold: 0, draining: false}; lags.set(u.id, e); }
        const lag = drain(e, k, dt, .4, .8);
        // a ghost over a warned blow: the warning on the ground under the bar must read
        const ghost = overWarning(game, x, y - (box.top * z + GAP) / (ky * z));
        ctx.globalAlpha = ghost ? .28 : 1;
        // a soft shadow lifts the plate off a crowd drawn in white and bone
        ctx.fillStyle = 'rgba(20,17,15,.22)'; plate(ctx, bx - 3, by - 1, w + 6, h + 6, 5); ctx.fill();
        tally(ctx, bx, by, w, h, k, lag, phasesOf(u), false);
        // a boss's own seal at the bar's left end, so he is found in a crowd of 300 (user, second play)
        if ((tier === 'small' || tier === 'big' || tier === 'final') && api.signFor) {
          const q = tier === 'small' ? 20 : 24, qx = bx - q - 4, qy = by + h / 2 - q / 2;
          ctx.fillStyle = LACQUER; plate(ctx, qx, qy, q, q, 3); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = GOLD_LIGHT; ctx.font = `700 ${q - 6}px "EC Serif","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(api.signFor(u) || '·', qx + q / 2, qy + q / 2 + 1); ctx.textBaseline = 'alphabetic';
        }
        if (u.enraged && !ghost) { ctx.fillStyle = CIN; ctx.font = '700 15px "EC Serif","Songti SC",serif'; ctx.textAlign = 'left'; ctx.fillText('怒', bx + w + 6, by + h + 1); }
        ctx.globalAlpha = 1; n++;
      }
      if (lags.size > 400) for (const id of lags.keys()) if (!game.foes.some(f => f.id === id)) lags.delete(id);
      this.drawTop(game, bossBarId, dt);
      return n;
    },
    /** The long bar at the top, with gold studs at the phases. */
    drawTop(game, id, dt) {
      // `holdId`: a duel's fall, when his bar stays a moment, emptied, after he is down (the page sets it)
      let u = id ? game.foes.find(f => f.id === id && ((f.hp > 0 && f.state !== 'dead') || id === api.holdId)) : null;
      if (u) lastTop = u; else if (id && id === api.holdId && lastTop && lastTop.id === id) u = lastTop;      // the rules may have cleared him from the field already
      if (!u) { if (barId) { barId = 0; top.classList.remove('on'); } return; }
      const k = u.hp > 0 && u.state !== 'dead' ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
      if (barId !== id) { barId = id; topTrail.lag = k; topTrail.hold = 0; topTrail.draining = false; top.classList.add('on'); }
      const lag = drain(topTrail, k, dt, .5, .45);
      const r = topCanvas.getBoundingClientRect(), cw = Math.round(r.width * D), ch = Math.round(r.height * D);
      if (!cw || !ch) return;
      if (topCanvas.width !== cw || topCanvas.height !== ch) { topCanvas.width = cw; topCanvas.height = ch; }
      tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, cw, ch); tctx.setTransform(D, 0, 0, D, 0, 0);
      const bh = 14; tally(tctx, 8, (r.height - bh) / 2, r.width - 16, bh, k, lag, phasesOf(u), true);
      topK = k;
      top.classList.toggle('enraged', !!u.enraged);
    },
    /** Whether a warning's ground area lies under the long bar's rectangle on screen (then the bar goes faint). */
    topOverWarning(game, view) {
      if (!barId) return false;
      const r = top.getBoundingClientRect(), {cam, ky} = view, z = cam.zoom, cy = H * .52;
      // the boss it names standing at the top of the view, under it (tester's round 1). Only he: his officers often stand
      // up there, and the bar would be faint half the fight
      if (view.art) for (const u of game.foes) {
        if (u.id !== barId || !(u.hp > 0) || u.state === 'dead') continue; const tier = tierOf(u) || 'big';
        const a = view.alpha ?? 1, x = u.px + (u.x - u.px) * a, y = u.py + (u.y - u.py) * a, box = boxOf(view.art, u, tier);
        const sx = W / 2 + (x - cam.x) * z, sy = cy + (y - cam.y) * ky * z, hw = box.width * z / 2;
        if (sx + hw > r.left && sx - hw < r.right && sy - box.top * z - 30 < r.bottom && sy > r.top) return true;   // his bar, 30 px over his head, counts too
      }
      return api.rectOverWarning(game, view, r);
    },
    /** Whether a Shang warning's ground area lies under a box on screen (the long bar; a banner or herald, which then give way). */
    rectOverWarning(game, view, r) {
      const {cam, ky} = view, z = cam.zoom, cy = H * .52;
      // a disc of ground (world x, y, radius) seen on screen as an ellipse: does its box touch the box?
      const touches = (x, y, rad) => { const sx = W / 2 + (x - cam.x) * z, sy = cy + (y - cam.y) * ky * z; return sx + rad * z > r.left && sx - rad * z < r.right && sy - rad * ky * z < r.bottom && sy + rad * ky * z > r.top; };
      for (const zo of game.zones || []) {
        if (zo.dead || zo.side !== 'shang') continue;
        if (zo.shape === 'lane') {      // along the lane, in steps no longer than its width
          const half = (zo.w || 80) / 2, n = Math.max(2, Math.ceil(zo.len / Math.max(20, half))), cs = Math.cos(zo.dir), sn = Math.sin(zo.dir);
          for (let i = 0; i <= n; i++) { const d = zo.len * i / n; if (touches(zo.x + cs * d, zo.y + sn * d, half)) return true; }
        } else if (touches(zo.x, zo.y, zo.r || 100)) return true;
      }
      return false;
    },
    /** Bosses off the screen (user, second play: "small bosses drown in the crowd, I cannot tell where they are"): a
        lacquer seal at the screen's edge with his sign, its cinnabar point toward him. Drawn after `draw`, on the same
        overlay. `signFor(u)`: his one character. Returns the pointers drawn, for checks. */
    pointers(game, view, signFor, avoid = []) {
      const {cam, ky, alpha} = view, cx = W / 2 + (cam.shakeX || 0), cy = H * .52 + (cam.shakeY || 0), z = cam.zoom, out = [];
      const L = 30, R = W - 30, T = 104, B = H - 30;      // inside the edges, below the timeline and the long bar
      ctx.setTransform(D, 0, 0, D, 0, 0);
      for (const u of game.foes) {
        if (u.dead || u.state === 'dead' || !(u.hp > 0)) continue;
        const tier = tierOf(u); if (tier !== 'small' && tier !== 'big' && tier !== 'final') continue;
        const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
        const sx = cx + (x - cam.x) * z, sy = cy + (y - cam.y) * ky * z;
        if (sx > -10 && sx < W + 10 && sy > 40 && sy < H + 10) continue;      // on screen: his own bar marks him
        // where the line from the screen's centre to him leaves the inner rectangle
        const dx = sx - cx, dy = sy - cy; let k = Infinity;
        if (dx > 0) k = Math.min(k, (R - cx) / dx); if (dx < 0) k = Math.min(k, (L - cx) / dx);
        if (dy > 0) k = Math.min(k, (B - cy) / dy); if (dy < 0) k = Math.min(k, (T - cy) / dy);
        if (!isFinite(k)) continue;
        let px = cx + dx * k, py = cy + dy * k; const a = Math.atan2(dy, dx), big = tier !== 'small', r = big ? 19 : 16;
        for (const q of avoid) if (q && px > q.left - r && px < q.right + r && py > q.top - r && py < q.bottom + r) px = q.right + r + 14;   // not under the build panel
        ctx.save(); ctx.translate(px, py);
        ctx.fillStyle = 'rgba(20,17,15,.25)'; ctx.beginPath(); ctx.arc(1, 2, r + 2, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.rotate(a); ctx.fillStyle = CIN; ctx.beginPath(); ctx.moveTo(r + 11, 0); ctx.lineTo(r - 3, -8); ctx.lineTo(r - 3, 8); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = LACQUER; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = GOLD; ctx.lineWidth = big ? 2.5 : 1.5; ctx.stroke();
        ctx.fillStyle = GOLD_LIGHT; ctx.font = `700 ${big ? 19 : 16}px "EC Serif","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((signFor || api.signFor || (() => ''))(u) || '·', 0, 1); ctx.textBaseline = 'alphabetic';
        // his health as a thin cinnabar arc under the seal
        const hk = Math.max(0, Math.min(1, u.hp / (u.maxHp || 1)));
        ctx.strokeStyle = CIN; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 4, Math.PI * .5 - Math.PI * hk * .5, Math.PI * .5 + Math.PI * hk * .5); ctx.stroke();
        ctx.restore();
        out.push({kind: u.kind, x: Math.round(px), y: Math.round(py)});
      }
      api.lastPointers = out;
      return out.length;
    },
    lastPointers: [],
    /** Antidotes while the hero bleeds (user: "解药在哪啊"): off the screen, a pale jade seal at the edge with its point
        toward it; on the screen, a soft ring on the ground under it and a small marker bobbing over it. `icon`: an
        image of the antidote once the art has one (else the character 药). Returns the marks drawn, for checks. */
    antidotes(game, view, icon, avoid = []) {
      const h = game.hero, out = [];
      if (!h || !(h.bleed > 0) || !(h.hp > 0)) { api.lastAntidotes = out; return 0; }
      const {cam, ky} = view, cx = W / 2 + (cam.shakeX || 0), cy = H * .52 + (cam.shakeY || 0), z = cam.zoom;
      const L = 30, R = W - 30, T = 104, B = H - 30, now = performance.now() / 1000;
      const sign = (r, size) => {
        if (icon && icon.complete && icon.naturalWidth) { const k = size / Math.max(icon.naturalWidth, icon.naturalHeight); ctx.drawImage(icon, -icon.naturalWidth * k / 2, -icon.naturalHeight * k / 2, icon.naturalWidth * k, icon.naturalHeight * k); }
        else { ctx.fillStyle = JADE_INK; ctx.font = `700 ${Math.round(r * 1.05)}px "EC Serif","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('药', 0, 1); ctx.textBaseline = 'alphabetic'; }
      };
      ctx.setTransform(D, 0, 0, D, 0, 0);
      for (const p of game.pickups) {
        if (p.dead || p.kind !== 'antidote') continue;
        const sx = cx + (p.x - cam.x) * z, sy = cy + (p.y - cam.y) * ky * z;
        if (sx > 20 && sx < W - 20 && sy > 70 && sy < H - 10) {
          // on the screen: a ring on the ground that breathes, and a marker bobbing over it
          const pulse = .5 + .5 * Math.sin(now * 4), rr = (24 + 5 * pulse) * z, bob = Math.sin(now * 3.2) * 5;
          ctx.save(); ctx.translate(sx, sy);
          ctx.strokeStyle = `rgba(78,125,104,${.55 + .35 * pulse})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * ky, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(207,227,214,.22)'; ctx.fill();
          ctx.translate(0, -44 * z - 16 + bob);
          ctx.fillStyle = JADE_DARK; ctx.beginPath(); ctx.moveTo(-7, 11); ctx.lineTo(7, 11); ctx.lineTo(0, 21); ctx.closePath(); ctx.fill();
          ctx.fillStyle = JADE_PALE; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = JADE_DARK; ctx.lineWidth = 2; ctx.stroke();
          sign(14, 22); ctx.restore();
          out.push({on: true, x: Math.round(sx), y: Math.round(sy)}); continue;
        }
        const dx = sx - cx, dy = sy - cy; let k = Infinity;
        if (dx > 0) k = Math.min(k, (R - cx) / dx); if (dx < 0) k = Math.min(k, (L - cx) / dx);
        if (dy > 0) k = Math.min(k, (B - cy) / dy); if (dy < 0) k = Math.min(k, (T - cy) / dy);
        if (!isFinite(k)) continue;
        let px = cx + dx * k, py = cy + dy * k; const a = Math.atan2(dy, dx), r = 17;
        for (const q of avoid) if (q && px > q.left - r && px < q.right + r && py > q.top - r && py < q.bottom + r) px = q.right + r + 14;   // not under the build panel
        const pulse = .5 + .5 * Math.sin(now * 4);
        ctx.save(); ctx.translate(px, py);
        ctx.fillStyle = `rgba(156,195,176,${.25 + .25 * pulse})`; ctx.beginPath(); ctx.arc(0, 0, r + 6 + 3 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.rotate(a); ctx.fillStyle = JADE_DARK; ctx.beginPath(); ctx.moveTo(r + 11, 0); ctx.lineTo(r - 3, -8); ctx.lineTo(r - 3, 8); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = JADE_PALE; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = JADE_DARK; ctx.lineWidth = 2; ctx.stroke();
        sign(r, 26); ctx.restore();
        out.push({on: false, x: Math.round(px), y: Math.round(py)});
      }
      api.lastAntidotes = out;
      return out.length;
    },
    lastAntidotes: [],
    signFor: null,      // the page sets it: a boss's one character
    get topShare() { return topK; },
    /** For checks: where the over-head bar of a unit would stand, and its width. */
    placeOf(u, art, cam, ky) { const tier = tierOf(u), box = boxOf(art, u, tier), S = SIZE[tier] || SIZE.elite; return {top: box.top, figureWidth: box.width, width: Math.round(Math.max(S.min, Math.min(S.max, box.width * cam.zoom * .78)))}; },
  };
  return api;
}
