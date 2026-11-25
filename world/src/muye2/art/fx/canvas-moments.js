// The great moments on Canvas 2D (no WebGL2, or a software rasteriser, or a lost context): the same staging as fx/gl, drawn
// with what Canvas does cheaply, so an old machine still gets the moment and stays smooth:
//   entrance  the field darkens toward its edges (one pre-rendered vignette, multiplied); the painted cloud band at the top
//             (fx/gl/sprites/cloud.webp when present, else a dark wash band); jagged lightning of the boss's light (strokes,
//             gold with a white core); a flash; a broken dark ring sweeping out on the ground; a hard kick
//   blow      a flash; the ring; short ink cracks out of the point; a hard kick
//   seal      the painted seal falls (fx/gl/sprites/seal.webp), lands with flash, ring and cracks, rises away; its print stays
// Cost: a few drawImage and stroke calls a frame (measured in the render spike: well under 1 ms of CPU at 4x throttle).
const TAU = Math.PI * 2, LIGHT = { metal: '#E8B54A', fire: '#E0562C', water: '#7FB2E8', wood: '#7ED3A6', earth: '#E8B54A' };
const BOSS_ELEMENT = { wenzhong: 'metal', zhangguifang: 'metal', moliqing: 'wood', molihong: 'water', molihai: 'metal', molishou: 'earth', kongxuan: 'fire', yuanhong: 'earth', zhouwang: 'fire' };
const HEAVY = { pairedWhips: 1, goldWall: 1.3, greatAxe: 0.9, pearlRing: 0.8 };
const bitmap = (name) => fetch(new URL(`./gl/sprites/${name}.webp`, import.meta.url).href).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(name)))).then((b) => createImageBitmap(b));

export function createCanvasMoments({ kick = () => {}, sx, sy, view }) {
  const S = { seal: null, cloud: null, print: null, vignette: null };
  bitmap('seal').then((b) => (S.seal = b)).catch(() => {});
  bitmap('cloud').then((b) => (S.cloud = b)).catch(() => {});
  const live = []; let clock = 0;
  function vignette(w, h) { if (S.vignette && S.vignette.width === 256) return S.vignette; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 40, 128, 128, 180);
    g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgb(150,152,165)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return (S.vignette = c); }
  function printCanvas() { if (S.print) return S.print; const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.fillStyle = '#b8321f'; x.fillRect(12, 12, n - 24, n - 24);
    x.globalCompositeOperation = 'destination-out'; x.font = 'bold 104px "Kaiti SC","STKaiti","KaiTi","Songti SC","SimSun",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('番', n * 0.7, n * 0.3); x.fillText('天', n * 0.7, n * 0.7); x.font = 'bold 160px "Kaiti SC","STKaiti","KaiTi","Songti SC","SimSun",serif'; x.fillText('印', n * 0.3, n * 0.5); return (S.print = c); }
  function onEvent(e, G) {
    if ((e.type === 'arrive' && e.tier && e.tier !== 'lieutenant') || e.type === 'boss') {
      if (live.some((m) => m.kind === 'entrance' && clock - m.at < 2)) return;
      live.push({ kind: 'entrance', at: clock, x: e.x, y: e.y, light: LIGHT[BOSS_ELEMENT[e.kind] || 'metal'], big: e.tier !== 'small', seed: (e.x * 7 + e.y * 3) | 0 });
    } else if (e.type === 'land' && e.side === 'shang' && (HEAVY[e.id] || e.great)) { live.push({ kind: 'blow', at: clock, x: e.x, y: e.y, power: HEAVY[e.id] || 1.2, seed: (e.x * 3 + e.y) | 0 }); kick(20); }
    else if (e.type === 'evolve' && e.id === 'seal' && G && G.hero) { const d = G.hero.facing < 0 ? -1 : 1; live.push({ kind: 'seal', at: clock, x: G.hero.x + d * 240, y: G.hero.y - 60, seed: 5 }); }
  }
  const owns = (e) => e.type === 'evolve' && e.id === 'seal';
  // a ring on the ground and cracks out of a point (device px)
  function ring(c, X, Y, t, z, power) { if (t < 0 || t > 1.4) return; const R = (60 + 1500 * power * (1 - Math.exp(-t * 2.2))) * z, a = Math.exp(-t * 1.6);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.55 * a; c.strokeStyle = '#1b1512'; c.lineWidth = (14 + 40 * t) * z; c.setLineDash([R * 0.5, R * 0.12]); c.beginPath(); c.ellipse(X, Y, R, R * 0.62, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.restore(); }
  function cracks(c, X, Y, t, z, seed, n = 9) { const a = Math.min(1, t / 0.2) * (1 - Math.max(0, (t - 1.6) / 1.2)); if (a <= 0) return; let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.85 * a; c.strokeStyle = '#1b1512'; c.lineCap = 'round';
    for (let i = 0; i < n; i++) { let ang = (i / n) * TAU + (r() - 0.5) * 0.6, x = X, y = Y; const L = (140 + 220 * r()) * z * Math.min(1, t / 0.25), steps = 7;
      for (let k = 0; k < steps; k++) { const nx = x + Math.cos(ang) * L / steps, ny = y + Math.sin(ang) * 0.62 * L / steps; c.lineWidth = (7 - k) * z; c.beginPath(); c.moveTo(x, y); c.lineTo(nx, ny); c.stroke(); x = nx; y = ny; ang += (r() - 0.5) * 0.7; } }
    c.restore(); }
  function bolt(c, X, Y, top, seed, on, col) { if (on <= 0) return; let s = seed * 7 + 3; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280); const pts = []; const sx0 = X + (r() - 0.5) * 240;
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([sx0 + (X - sx0) * u + (i && i < 12 ? (r() - 0.5) * 70 * Math.sin(u * Math.PI) : 0), top + (Y - top) * u]); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [w, st, a] of [[14, col, 0.35 * on], [6, col, 0.9 * on], [2.2, '#fffaf0', on]]) { c.globalAlpha = a; c.strokeStyle = st; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    c.restore(); }
  function flash(c, t, peak) { const a = peak * Math.max(0, 1 - t / 0.1); if (a <= 0 || t < 0) return; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a; c.fillStyle = '#fff6dc'; c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); }
  function drawGround(c, dt) {
    clock += dt;
    for (let i = 0; i < live.length; i++) { const m = live[i], t = clock - m.at, z = view().z; if (t > 3.6) { live.splice(i--, 1); continue; }
      const X = sx(m.x), Y = sy(m.y);
      if (m.kind === 'entrance') { if (t >= 0.42 && !m.hit) { m.hit = 1; kick(m.big ? 26 : 16); } ring(c, X, Y, t - 0.42, z, m.big ? 1.3 : 0.9); cracks(c, X, Y, t - 0.42, z, m.seed); }
      if (m.kind === 'blow') { ring(c, X, Y, t, z, m.power); cracks(c, X, Y, t, z, m.seed, 7); }
      if (m.kind === 'seal') { const T = t - 0.55; if (T >= 0 && !m.hit) { m.hit = 1; kick(30); } if (T >= 0) { ring(c, X, Y, T, z, 1.6); cracks(c, X, Y, T, z, m.seed, 11);
          const a = Math.min(1, T / 0.06) * (1 - Math.max(0, (T - 1.6) / 1.4)), p = printCanvas(), k = 330 * z / p.width; c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = Math.max(0, a) * 0.9; c.setTransform(k, 0, 0, k * 0.62, X - p.width * k / 2, Y - p.height * k * 0.31); c.drawImage(p, 0, 0); c.restore(); } }
    }
  }
  function drawOver(c, dt) {
    const W = c.canvas.width, H = c.canvas.height;
    for (const m of live) { const t = clock - m.at, z = view().z, X = sx(m.x), Y = sy(m.y);
      if (m.kind === 'entrance' || m.kind === 'seal') { const life = m.kind === 'seal' ? 2.6 : m.big ? 3.2 : 2.2, env = Math.min(1, t / 0.45) * Math.max(0, Math.min(1, (life - t) / (life * 0.3)));
        if (env > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.globalAlpha = env; c.drawImage(vignette(W, H), 0, 0, W, H); c.globalCompositeOperation = 'source-over';
          if (S.cloud) { const h = H * 0.34 * env, w = (S.cloud.width / S.cloud.height) * h, off = (t * 20 * z) % (2 * w);
            // a hole above the one who comes (an arch cut out of the band); every other tile mirrored, so no seam
            if (m.kind === 'entrance') { const hw = 260 * z; c.beginPath(); c.rect(0, 0, W, H); c.moveTo(X - hw, -1); c.quadraticCurveTo(X, H * 0.9, X + hw, -1); c.closePath(); c.clip('evenodd'); }
            for (let x = -off, i = 0; x < W; x += w, i++) { if (i & 1) { c.save(); c.translate(x + w, 0); c.scale(-1, 1); c.drawImage(S.cloud, 0, -h * 0.05, w, h); c.restore(); } else c.drawImage(S.cloud, x, -h * 0.05, w, h); } }
          else { const g = c.createLinearGradient(0, 0, 0, H * 0.25); g.addColorStop(0, 'rgba(27,21,18,0.95)'); g.addColorStop(1, 'rgba(27,21,18,0)'); c.fillStyle = g; c.globalAlpha = env; c.fillRect(0, 0, W, H * 0.25); }
          c.restore(); } }
      if (m.kind === 'entrance') { for (let b = 0; b < (m.big ? 3 : 1); b++) { const tb = t - 0.42 - b * 0.18, on = tb < 0 ? 0 : tb < 0.05 ? 1 : tb < 0.09 ? 0.3 : tb < 0.15 ? 0.8 : Math.max(0, 1 - (tb - 0.15) / 0.2) * 0.4;
          bolt(c, b ? X + ((m.seed * (b + 3)) % 300) - 150 : X, b ? Y + ((m.seed * (b + 7)) % 120) - 60 : Y, H * 0.12, m.seed + b, on, m.light); } flash(c, t - 0.42, m.big ? 0.6 : 0.4); }
      if (m.kind === 'blow') flash(c, t, 0.45);
      if (m.kind === 'seal' && S.seal) { const FALL = 0.55; let y, k = 1, a = 1; if (t < FALL) { const e = (t / FALL) ** 3; y = H * 0.18 + (Y - H * 0.18) * e; k = 1.5 - 0.5 * e; } else if (t < 0.8) y = Y; else if (t < 1.6) { const u = (t - 0.8) / 0.8; y = Y - u * u * H * 0.7; a = 1 - u; } else continue;
        const s = (560 / S.seal.height) * z * k; c.save(); c.setTransform(s, 0, 0, s, X - 196 * s, y - 498 * s); c.globalAlpha = Math.max(0, a); c.drawImage(S.seal, 0, 0); c.restore(); flash(c, t - FALL, 0.7); }
    }
  }
  return { onEvent, drawGround, drawOver, owns, get live() { return live.length; } };
}
