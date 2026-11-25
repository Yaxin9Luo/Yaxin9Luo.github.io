// 番天印 evolved: the seal falls on the field as a mountain. 「打將下來，一聲響」 (the novel). A full-screen moment:
//   - the sky darkens (the omen, without lightning) and gold leaf comes down;
//   - the seal comes down out of the top of the screen, huge and turning a little, its shadow on the ground growing and
//     darkening under it;
//   - it lands (the impact kit at its greatest: the ground split far round, the screen-wide shock, the flash, debris);
//   - it stands a moment in the crater, then rises away in gold light and is gone;
//   - where it stood, its impression: a square of cinnabar with the characters left white, as a seal prints on paper,
//     laid flat on the ground, sinking over three seconds.
// The seal and its print are painted once, at load, with Canvas 2D (gradients and text are fine there); in a frame they
// are drawn through the GL context like any sprite.
const PAPER = '#EFE7D6';
function paintSeal() {
  // a block of bronze in three-quarter view: the front face (the name), the right side face in shadow, the lit top, and on
  // it a crouching qilin; gold leaf on the edges that catch the light. The foot of the front face is the seal's point.
  const W = 460, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const F = [30, 250, 330, 330], dx = 90, dy = -60;                  // front face x, y, w, h; the depth of the block on screen
  const poly = (pts, fill, stroke, lw = 4) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); } };
  const [fx, fy, fw, fh] = F;
  // side face: deep shadowed bronze, a band of meander
  const gs = x.createLinearGradient(fx + fw, 0, fx + fw + dx, 0); gs.addColorStop(0, '#3a2a16'); gs.addColorStop(1, '#1e150b');
  poly([[fx + fw, fy], [fx + fw + dx, fy + dy], [fx + fw + dx, fy + fh + dy], [fx + fw, fy + fh]], gs, '#b8923f', 3);
  // top face: lit
  const gt = x.createLinearGradient(fx, fy + dy, fx + fw, fy); gt.addColorStop(0, '#c9a256'); gt.addColorStop(1, '#8a6a33');
  poly([[fx, fy], [fx + dx, fy + dy], [fx + fw + dx, fy + dy], [fx + fw, fy]], gt, '#f3d98d', 4);
  // the qilin on top: body, head turned to us, mane in flames, legs folded
  x.save(); x.translate(fx + fw / 2 + dx / 2, fy + dy / 2 + 8);
  x.fillStyle = '#2b1f12'; x.strokeStyle = '#e8c46e'; x.lineWidth = 4;
  x.beginPath(); x.ellipse(0, -40, 120, 52, 0, Math.PI, 0); x.lineTo(120, 0); x.lineTo(-120, 0); x.closePath(); x.fill(); x.stroke();               // the crouching body
  x.beginPath(); x.moveTo(-70, -60); x.bezierCurveTo(-120, -110, -100, -175, -40, -170); x.bezierCurveTo(10, -168, 20, -120, -10, -92); x.closePath(); x.fill(); x.stroke();   // the head
  x.fillStyle = '#f3d98d'; x.beginPath(); x.arc(-48, -138, 6, 0, 6.28); x.fill(); x.beginPath(); x.arc(-78, -140, 5, 0, 6.28); x.fill();                 // eyes
  x.strokeStyle = '#e8c46e'; x.lineWidth = 5; x.beginPath(); x.moveTo(-30, -170); x.quadraticCurveTo(-10, -205, 15, -190); x.moveTo(-60, -172); x.quadraticCurveTo(-60, -210, -35, -212); x.stroke();   // horns
  x.strokeStyle = '#c99a45'; x.lineWidth = 6; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(-10 + i * 18, -78 - (i % 2) * 6); x.quadraticCurveTo(i * 18, -112 - (i % 3) * 10, 22 + i * 18, -96); x.stroke(); }   // the mane, flames along the back
  x.strokeStyle = 'rgba(232,196,110,0.75)'; x.lineWidth = 3; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(-50 + i * 24, -28, 13, 3.3, 6.1); x.stroke(); }   // scales
  x.restore();
  // front face: bronze, lit from the upper left, with a meander band at top and foot and the carved name in a panel
  const g = x.createLinearGradient(fx, fy, fx + fw, fy + fh); g.addColorStop(0, '#a98545'); g.addColorStop(0.5, '#6e5129'); g.addColorStop(1, '#3a2a16');
  poly([[fx, fy], [fx + fw, fy], [fx + fw, fy + fh], [fx, fy + fh]], g, '#f3d98d', 5);
  x.strokeStyle = '#e2bd63'; x.lineWidth = 4;
  for (const by of [fy + 24, fy + fh - 26]) { x.strokeRect(fx + 10, by - 13, fw - 20, 26);
    for (let i = 0; i < 9; i++) { const bx = fx + 20 + i * 34; x.beginPath(); x.moveTo(bx, by + 8); x.lineTo(bx, by - 6); x.lineTo(bx + 20, by - 6); x.lineTo(bx + 20, by + 4); x.lineTo(bx + 9, by + 4); x.lineTo(bx + 9, by - 1); x.stroke(); } }
  x.fillStyle = 'rgba(20,14,8,0.5)'; x.fillRect(fx + 60, fy + 54, fw - 120, fh - 108); x.strokeStyle = '#e2bd63'; x.lineWidth = 3; x.strokeRect(fx + 60, fy + 54, fw - 120, fh - 108);
  x.fillStyle = '#f5d47e'; x.font = 'bold 66px "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "SimSun", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['番', '天', '印'].forEach((ch, i) => x.fillText(ch, fx + fw / 2, fy + 100 + i * 66));
  return c;
}
// the print: cinnabar with the characters left white (白文), a broken edge as a seal leaves on paper
function paintPrint() {
  const S = 320, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#b8321f'; x.fillRect(16, 16, S - 32, S - 32);
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.font = 'bold 128px "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "SimSun", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('番', S * 0.7, S * 0.3); x.fillText('天', S * 0.7, S * 0.7); x.font = 'bold 200px "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "SimSun", serif'; x.fillText('印', S * 0.3, S * 0.5);
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { const a = r(), e = r() < 0.5, px = e ? (r() < 0.5 ? 16 + r() * 8 : S - 24 + r() * 8) : 16 + r() * (S - 32), py = e ? 16 + r() * (S - 32) : (r() < 0.5 ? 16 + r() * 8 : S - 24 + r() * 8); x.globalAlpha = a; x.beginPath(); x.arc(px, py, 1 + r() * 3, 0, 6.28); x.fill(); }   // the worn edge
  for (let i = 0; i < 400; i++) { x.globalAlpha = 0.2 + r() * 0.4; x.beginPath(); x.arc(16 + r() * (S - 32), 16 + r() * (S - 32), 0.5 + r() * 1.5, 0, 6.28); x.fill(); }          // where the ink did not take
  return c;
}
function paintShadow() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(20,16,12,0.85)'); g.addColorStop(0.6, 'rgba(20,16,12,0.5)'); g.addColorStop(1, 'rgba(20,16,12,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; }

// the seal in brush: the brush sheet's wseal (gen/wonders.cells.mjs), axe-cut bronze strokes, 雷纹 and a taotie in ink line,
// a beast knob, gold hairs on its edges; until the sheet has loaded, the Canvas-painted block stands in
export function createSeal(ctx, impact, omen, wonders) {
  let seal = paintSeal(), foot = [195, 580], sealH = 600; const print = paintPrint(), shadow = paintShadow();
  if (wonders) wonders.loaded.then(() => wonders.bitmap('wseal')).then((o) => { seal = o.bm; foot = [o.px, o.py]; sealH = o.bm.height; }).catch((e) => console.warn('fx: the brush seal did not load; the painted block stands in', e));
  const FALL = 0.55, REST = 0.25, RISE = 0.8, LIFE = 4.2;
  let cur = null;
  /** the seal falls on ground point (x, y); kick(a) shakes the camera */
  function start(o, kick) { cur = { ...o, t: 0, landed: false, kick }; omen.start({ x: o.x, y: o.y, life: 2.6, light: impact.LIGHT.gold, strikes: [], seed: 3, dark: 0.8 }); }
  function drawGround(V, dt) {
    if (!cur) return; cur.t += dt; const t = cur.t; if (t > LIFE) { cur = null; return; }
    if (!cur.landed && t >= FALL) { cur.landed = true; impact.hit({ x: cur.x, y: cur.y, power: 2.0, reach: 700, cracks: 11, light: 'gold', flash: 0.85, debris: 220, sparks: 120, life: 3.6, seed: 11 }); cur.kick && cur.kick(30); }
    const X = V.sx(cur.x), Y = V.sy(cur.y), z = V.z, size = 300 * z;
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    if (t < FALL + REST) { const u = Math.min(1, t / FALL), k = 0.35 + 0.65 * u * u; ctx.globalAlpha = 0.25 + 0.7 * u * u; ctx.setTransform(size * 2.2 * k / 128, 0, 0, size * 2.2 * 0.62 * k / 128, X - size * 1.1 * k, Y - size * 0.68 * k); ctx.drawImage(shadow, 0, 0); }
    if (t >= FALL) { const a = Math.min(1, (t - FALL) / 0.06) * (1 - Math.max(0, (t - 2.2) / (LIFE - 2.2))); ctx.globalAlpha = a * 0.9; const s = size * 1.25 / print.width;
      ctx.setTransform(s, 0, 0, s * 0.62, X - print.width * s / 2, Y - print.height * s * 0.62 / 2); ctx.drawImage(print, 0, 0); }
    ctx.restore();
  }
  function drawOver(V) {
    if (!cur) return; const t = cur.t, X = V.sx(cur.x), Y = V.sy(cur.y), z = V.z, H = V.dpr * innerHeight;
    let y, k, a = 1, rot = 0;
    if (t < FALL) { const u = t / FALL, e = u * u * u; y = H * 0.18 + (Y - H * 0.18) * e; k = 1.5 - 0.5 * e; rot = (1 - u) * 0.1; }      // it comes out of the cloud and drops, faster and faster
    else if (t < FALL + REST) { y = Y + 6 * z; k = 1; }
    else if (t < FALL + REST + RISE) { const u = (t - FALL - REST) / RISE; y = Y - u * u * H * 0.7; k = 1 + u * 0.3; a = 1 - u; }
    else return;
    const footX = foot[0], footY = foot[1], S = (560 / sealH) * z * k;      // about 560 world units tall: a mountain beside the figures
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    const draw = (sc, al) => { const c = Math.cos(rot), s = Math.sin(rot), q = S * sc; ctx.globalAlpha = al; ctx.setTransform(q * c, q * s, -q * s, q * c, X - (q * c * footX - q * s * footY), y - (q * s * footX + q * c * footY)); ctx.drawImage(seal, 0, 0); };      // its foot on the point
    if (t >= FALL + REST) { ctx.silhouette = [176, 138, 60]; draw(1.05, a * 0.35); ctx.silhouette = null; }   // rising away: a pale bronze-gold wash of its shape behind it (pigment, not a glow)
    draw(1, a);
    ctx.restore();
  }
  return { start, drawGround, drawOver, get live() { return cur ? 1 : 0; }, reset() { cur = null; } };
}
