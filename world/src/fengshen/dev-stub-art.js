// Stand-in for art/index.js, used by the page with ?stub=1 (or ?stub=art): boxes and lines only, enough to judge
// the loop, the camera and the HUD. Follows the art contract in lab/game-studies/PROTOTYPE-SPEC.md section 4.
const INK = '#14110F', MID = '#6B645C', PALE = '#D3CCBE', PAPER = '#EFE7D6', CINNABAR = '#B8321F', AZURITE = '#2F4F7A', LACQUER = '#1B1512', MALACHITE = '#3F7D6A';
export async function loadArt() {
  let W = 0, H = 0, D = 1, S = 1, ground = 0;     // S: the scene is drawn for a view 900 px high and scales with it, as in the real module
  const marks = [], live = [], trails = [];
  let burst = null;
  /** World to device pixels. `par` is the parallax factor of the layer (1 = the lane). */
  const sx = (cam, x, par = 1) => (W / 2 + (x - cam.x) * cam.zoom * S * par + cam.shakeX) * D;
  const sy = (cam, y) => (ground - (y - cam.y) * cam.zoom * S + cam.shakeY) * D;
  const lerp = (a, b, k) => a + (b - a) * k;
  function box(ctx, cam, x, y, w, h, fill) { const z = cam.zoom * S * D; ctx.fillStyle = fill; ctx.fillRect(sx(cam, x) - w * z / 2, sy(cam, y) - h * z, w * z, h * z); }
  return {
    setView(v) { W = v.width; H = v.height; D = v.dpr; S = H / 900; ground = H * .82; },
    setTime() {},
    reset() { marks.length = 0; live.length = 0; trails.length = 0; burst = null; },
    drawBack(ctx, cam) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W * D, H * D);
      ctx.fillStyle = 'rgba(166,159,148,.35)';
      for (let i = 0; i < 12; i++) { const x = sx(cam, 200 + i * 520, .3), w = 300 * D, h = (90 + (i * 53) % 110) * D; ctx.beginPath(); ctx.moveTo(x - w / 2, ground * D); ctx.lineTo(x, ground * D - h); ctx.lineTo(x + w / 2, ground * D); ctx.fill(); }
      ctx.strokeStyle = MID; ctx.lineWidth = D; ctx.beginPath(); ctx.moveTo(0, sy(cam, 0)); ctx.lineTo(W * D, sy(cam, 0)); ctx.stroke();
      ctx.fillStyle = PALE;
      for (let x = 0; x <= 4800; x += 200) ctx.fillRect(sx(cam, x), sy(cam, 0), D, 8 * D);     // distance posts: make camera motion visible
    },
    drawFigures(ctx, cam, game, alpha) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const u of game.units) {
        const x = lerp(u.px, u.x, alpha), zhou = u.side === 'zhou', dead = u.state === 'dead', tall = u.kind === 'captain' ? 112 : u.kind === 'officer' || u.veteran ? 66 : 58, wide = u.kind === 'shield' ? 34 : u.kind === 'captain' ? 40 : u.kind === 'archer' ? 20 : 26;
        ctx.globalAlpha = dead ? Math.max(0, 1 - u.stateT / 1.2) : 1;
        box(ctx, cam, x, u.lane * 22, wide, dead ? 14 : tall, u.flash > 0 ? PAPER : zhou ? AZURITE : LACQUER);
        if (u.veteran && !dead) box(ctx, cam, x, u.lane * 22 + tall, 10, 6, CINNABAR);                              // the veteran's mark
        const z = cam.zoom * S * D, hx = sx(cam, x), hy = sy(cam, u.lane * 22 + 40);
        ctx.strokeStyle = u.state === 'brace' || u.state === 'windup' || u.state === 'draw' ? CINNABAR : zhou ? AZURITE : MALACHITE; ctx.lineWidth = 3 * D;
        const a = u.state === 'brace' ? -.25 : u.state === 'windup' ? -1.3 : u.state === 'attack' ? .2 : u.state === 'draw' ? -.6 : -.9;
        if (!dead) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * u.facing * (u.kind === 'spear' ? 100 : u.kind === 'captain' ? 130 : 40) * z, hy + Math.sin(a) * (u.kind === 'spear' ? 100 : u.kind === 'captain' ? 130 : 40) * z); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2 * D;
      for (const a of game.arrows) { const x = sx(cam, lerp(a.px, a.x, alpha)), y = sy(cam, lerp(a.py, a.y, alpha)), n = Math.hypot(a.vx, a.vy) || 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - a.vx / n * 26 * D, y + a.vy / n * 26 * D); ctx.stroke(); }
      const h = game.hero, x = lerp(h.px, h.x, alpha), y = lerp(h.py, h.y, alpha), z = cam.zoom * S * D;
      box(ctx, cam, x, y + 20, 92, 46, h.safe > .2 ? CINNABAR : '#F7F3EA'); ctx.strokeStyle = INK; ctx.lineWidth = D; ctx.strokeRect(sx(cam, x) - 46 * z, sy(cam, y + 66), 92 * z, 46 * z);
      box(ctx, cam, x + h.facing * 30, y + 60, 22, 26, '#F7F3EA'); box(ctx, cam, x + h.facing * 18, y + 62, 10, 22, CINNABAR);     // head and mane
      box(ctx, cam, x - h.facing * 4, y + 66, 22, 44, AZURITE);                                                             // rider
      const t = h.state === 'strike' ? h.stateT : -1, a = h.state === 'sweep' ? .1 : h.state === 'rally' ? -1.57 : h.hold > 0 ? -2.6 - Math.min(.5, h.hold) : t < 0 ? -1.9 : t < .05 ? -2.4 : t < .17 ? .35 : .9;
      ctx.strokeStyle = t >= .05 && t < .17 ? CINNABAR : INK; ctx.lineWidth = 4 * D;
      ctx.beginPath(); ctx.moveTo(sx(cam, x), sy(cam, y + 96)); ctx.lineTo(sx(cam, x) + Math.cos(a) * h.facing * 120 * z, sy(cam, y + 96) + Math.sin(a) * 120 * z); ctx.stroke();
    },
    drawFront() {},
    onEvent(e) {
      if (e.type === 'hit' || e.type === 'clash' || e.type === 'trample' || e.type === 'land') { marks.push({x: e.x, y: e.type === 'hit' ? 50 : 0, c: e.type === 'hit' ? CINNABAR : MID, r: e.type === 'hit' ? 6 + (e.mult || 1) * 5 : 8}); if (marks.length > 400) marks.shift(); }
      if (e.type === 'hit' || e.type === 'braced') live.push({x: e.x, y: 60, t: 0, c: e.type === 'hit' ? CINNABAR : INK});
      if (e.type === 'sweep' || e.type === 'shock' || e.type === 'rally' || e.type === 'blocked' || e.type === 'crit') live.push({x: e.x, y: e.type === 'shock' ? 0 : 60, t: 0, c: e.type === 'crit' ? '#B08A3C' : e.type === 'blocked' ? AZURITE : CINNABAR, big: e.type !== 'blocked' && e.type !== 'crit'});
      if (e.type === 'trail') trails.push({x0: Math.min(e.x0, e.x1), x1: Math.max(e.x0, e.x1), t: 2.5});
      if (e.type === 'boon') burst = {c: {fire: CINNABAR, water: AZURITE, wood: MALACHITE, metal: '#B08A3C', earth: '#35302B'}[e.element] || MID, t: 0};
    },
    drawEffects(ctx, cam, dt) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = .3;
      for (const m of marks) { ctx.fillStyle = m.c; ctx.fillRect(sx(cam, m.x) - m.r * D, sy(cam, m.y) - 2 * D, m.r * 2 * D, 4 * D); }
      ctx.globalAlpha = 1;
      for (const f of live) { f.t += dt; ctx.strokeStyle = f.c; ctx.lineWidth = 3 * D; ctx.globalAlpha = Math.max(0, 1 - f.t * 4); ctx.beginPath(); ctx.arc(sx(cam, f.x), sy(cam, f.y), (20 + f.t * (f.big ? 520 : 160)) * cam.zoom * S * D, 0, 6.3); ctx.stroke(); }
      for (const tr of trails) { tr.t -= dt; ctx.globalAlpha = Math.max(0, Math.min(1, tr.t)); ctx.fillStyle = CINNABAR; ctx.fillRect(sx(cam, tr.x0), sy(cam, 6), sx(cam, tr.x1) - sx(cam, tr.x0), 5 * D); }
      for (let i = trails.length - 1; i >= 0; i--) if (trails[i].t <= 0) trails.splice(i, 1);
      // the boon's burst: one band of the element's pigment crossing the view
      if (burst) { burst.t += dt; const k = burst.t / .6; ctx.globalAlpha = .5 * Math.max(0, 1 - k); ctx.fillStyle = burst.c; ctx.fillRect((k * 1.3 - .3) * W * D, 0, W * D * .3, H * D); if (k >= 1) burst = null; }
      ctx.globalAlpha = 1;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].t > .25) live.splice(i, 1);
    },
  };
}
