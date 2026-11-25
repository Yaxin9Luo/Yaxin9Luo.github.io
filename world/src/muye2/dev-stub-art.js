// Stand-in for art/index.js, used by the page with ?stub=1 (or ?stub=art): discs and lines only, enough to judge the
// loop, the camera, the offer and the HUD. Follows the art contract of lab/game-studies/SPEC-SURVIVORS.md section 5:
// a parallel projection with no horizon, a ground point (x, y) at screen (x, y * KY), one size at every depth.
const KY = .62, PAPER = [239, 231, 214], INK = '#14110F', MID = '#6B645C', CINNABAR = '#B8321F', AZURITE = '#2F4F7A', GOLD = '#B08A3C', LACQUER = '#1B1512', MALACHITE = '#3F7D6A';
const PIG = {fire: CINNABAR, water: AZURITE, wood: MALACHITE, metal: GOLD, earth: '#35302B'};
export async function loadArt({onProgress} = {}) {
  if (onProgress) onProgress(1, 1);
  let W = 0, H = 0, D = 1;
  const live = [];
  const sx = (cam, x) => (W / 2 + (x - cam.x) * cam.zoom + cam.shakeX) * D;
  const sy = (cam, y) => (H * .52 + (y - cam.y) * KY * cam.zoom + cam.shakeY) * D;
  const lerp = (a, b, k) => a + (b - a) * k;
  const disc = (ctx, cam, x, y, r, fill, lift = 0) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(sx(cam, x), sy(cam, y) - lift * cam.zoom * D, r * cam.zoom * D, r * cam.zoom * D, 0, 0, 6.3); ctx.fill(); };
  return {
    setView(v) { W = v.width; H = v.height; D = v.dpr; },
    setTime() {},
    paperAt: () => PAPER,
    reset() { live.length = 0; },
    drawGround(ctx, cam) {
      ctx.fillStyle = `rgb(${PAPER})`; ctx.fillRect(0, 0, W * D, H * D);
      // a grid of marks on the ground, so that movement of the camera can be seen
      ctx.fillStyle = 'rgba(107,100,92,.35)';
      const step = 200, x0 = Math.floor((cam.x - W / cam.zoom / 2) / step) * step, y0 = Math.floor((cam.y - H / cam.zoom / KY / 2) / step) * step;
      for (let x = x0; x < cam.x + W / cam.zoom / 2 + step; x += step) for (let y = y0; y < cam.y + H / cam.zoom / KY / 2 + step; y += step) { if (x < 0 || y < 0 || x > 6000 || y > 6000) continue; ctx.fillRect(sx(cam, x) - 2 * D, sy(cam, y) - D, 4 * D, 2 * D); }
    },
    drawWorld(ctx, cam, game, alpha) {
      const all = [];
      for (const z of game.zones || []) { ctx.strokeStyle = z.side === 'shang' ? CINNABAR : MID; ctx.lineWidth = 2 * D; ctx.beginPath(); ctx.ellipse(sx(cam, z.x), sy(cam, z.y), (z.r || 60) * cam.zoom * D, (z.r || 60) * KY * cam.zoom * D, 0, 0, 6.3); ctx.stroke(); }
      for (const p of game.pickups) all.push({y: p.y, draw: () => { const k = p.kind === 'chest' ? 9 : 4 + (p.size || 0) * 2, X = sx(cam, lerp(p.px, p.x, alpha)), Y = sy(cam, lerp(p.py, p.y, alpha)); ctx.fillStyle = p.kind === 'chest' ? LACQUER : p.kind === 'peach' ? CINNABAR : GOLD; ctx.beginPath(); ctx.moveTo(X, Y - k * 1.6 * D); ctx.lineTo(X + k * D, Y - k * .6 * D); ctx.lineTo(X, Y + k * .4 * D); ctx.lineTo(X - k * D, Y - k * .6 * D); ctx.fill(); }});
      for (const f of game.foes) all.push({y: f.y, draw: () => { ctx.globalAlpha = f.state === 'dead' ? Math.max(0, 1 - f.stateT / .6) : 1; disc(ctx, cam, lerp(f.px, f.x, alpha), lerp(f.py, f.y, alpha), (f.r || 12), f.flash > 0 ? '#F7F3EA' : f.elite ? MALACHITE : LACQUER, (f.r || 12)); ctx.globalAlpha = 1; }});
      for (const a of game.allies || []) all.push({y: a.y, draw: () => disc(ctx, cam, lerp(a.px, a.x, alpha), lerp(a.py, a.y, alpha), 11, AZURITE, 11)});
      const h = game.hero, hx = lerp(h.px, h.x, alpha), hy = lerp(h.py, h.y, alpha);
      all.push({y: h.y, draw: () => {
        if (h.fullCry) { ctx.strokeStyle = CINNABAR; ctx.lineWidth = 3 * D; ctx.beginPath(); ctx.ellipse(sx(cam, hx), sy(cam, hy), 34 * cam.zoom * D, 34 * KY * cam.zoom * D, 0, 0, 6.3); ctx.stroke(); }
        disc(ctx, cam, hx, hy, 24, h.state === 'fallen' ? MID : h.safe > .3 ? CINNABAR : '#F7F3EA', 24); ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * D; ctx.stroke();
        disc(ctx, cam, hx - h.facing * 4, hy, 10, AZURITE, 50); disc(ctx, cam, hx - h.facing * 14, hy, 6, CINNABAR, 68);
      }});
      for (const s of game.shots || []) all.push({y: s.y, draw: () => disc(ctx, cam, lerp(s.px ?? s.x, s.x, alpha), lerp(s.py ?? s.y, s.y, alpha), s.r || 5, s.side === 'shang' ? INK : AZURITE, 20)});
      all.sort((a, b) => a.y - b.y);
      for (const o of all) o.draw();
    },
    onEvent(e, game) {
      if (e.type === 'cast') { const row = Object.values(PIG); live.push({kind: 'cast', x: e.x, y: e.y, to: e.targets || [{x: e.x + Math.cos(e.dir || 0) * (e.length || e.radius || 120), y: e.y + Math.sin(e.dir || 0) * (e.length || e.radius || 120)}], c: row[(e.id || '').length % 5], t: 0, life: .22}); }
      else if (e.type === 'warn') live.push({kind: 'warn', x: e.x, y: e.y, dir: e.dir || 0, len: e.length || 0, r: e.radius || 0, t: 0, life: e.time || 1});
      else if (e.type === 'levelUp' || e.type === 'evolve' || e.type === 'trample') live.push({kind: 'ring', x: e.x, y: e.y, c: e.type === 'trample' ? MID : CINNABAR, t: 0, life: .4});
    },
    drawOver(ctx, cam, dt) {
      for (const f of live) {
        f.t += dt; const k = f.t / f.life; ctx.globalAlpha = Math.max(0, 1 - k);
        if (f.kind === 'cast') { ctx.strokeStyle = f.c; ctx.lineWidth = 4 * D; for (const p of f.to) { ctx.beginPath(); ctx.moveTo(sx(cam, f.x), sy(cam, f.y) - 30 * D); ctx.lineTo(sx(cam, p.x), sy(cam, p.y) - 10 * D); ctx.stroke(); } }
        else if (f.kind === 'warn') { ctx.globalAlpha = .5; ctx.strokeStyle = CINNABAR; ctx.lineWidth = 6 * D; ctx.beginPath(); if (f.len) { ctx.moveTo(sx(cam, f.x), sy(cam, f.y)); ctx.lineTo(sx(cam, f.x + Math.cos(f.dir) * f.len), sy(cam, f.y + Math.sin(f.dir) * f.len)); } else ctx.ellipse(sx(cam, f.x), sy(cam, f.y), f.r * cam.zoom * D, f.r * KY * cam.zoom * D, 0, 0, 6.3); ctx.stroke(); }
        else { ctx.strokeStyle = f.c; ctx.lineWidth = 3 * D; ctx.beginPath(); ctx.ellipse(sx(cam, f.x), sy(cam, f.y), (20 + k * 90) * cam.zoom * D, (20 + k * 90) * KY * cam.zoom * D, 0, 0, 6.3); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].t >= live[i].life) live.splice(i, 1);
    },
  };
}
