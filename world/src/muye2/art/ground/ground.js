// The ground of a run, in three scenes that follow the eastern campaign (PLAN-CAMPAIGN section 7): outside Xiqi (西岐),
// the passes (东征诸关), and the crossing at Mengjin up to the walls of Zhaoge (孟津 · 朝歌), as blue-green landscape.
// setStretch(scene) changes scene (its files load on first use; preload(scene) ahead); march(t, to) is the 3-5 s change
// between stretches: mist closes, the far band crosses over, the next scene is laid under the mist, the mist opens.
// What it draws, back to front (drawBase): the paper; the land's wash (one picture of the whole field at a quarter size);
// the river of this run's course; the pieces that lie (fields, meadows, rises, tracks, the landmarks' grounds); mist
// lying in bands; and the far band at the top of the screen (Mount Qi and the walls of Xiqi over the mist), which looms
// larger the further north the camera is. drawTone lays the hour and the weather over all of it; drawOver lays falling
// rain or snow over the figures. What stands (trees, rocks, landmarks) is in `props`, sorted with the figures by index.js.
// Which course, mirror, weather, hour, and where everything lies come from layout.js by the game's seed (setSeed).
// Baked by gen/xiqi.gen.mjs scene=<name> into baked/<scene>/; the painted pieces by imagegen/cut.mjs into baked/xiqi/paint*. The marks (warnings, pickups) still come from baked/field.json + marks.webp.
import { layoutOf, WORLD as W0 } from './layout.js';

const FILES = { field: new URL('./baked/field.json', import.meta.url).href, marks: new URL('./baked/marks.webp', import.meta.url).href, grain: new URL('./baked/grain.webp', import.meta.url).href };
const JSONS = import.meta.glob('./baked/*/*.json', { query: '?url', import: 'default', eager: true }), PICS = import.meta.glob('./baked/*/*.webp', { eager: true, query: '?url', import: 'default' });
const url = (scene, name) => PICS[`./baked/${scene}/${name}`], jurl = (scene, name) => JSONS[`./baked/${scene}/${name}`];
export const SCENES = ['xiqi', 'passes', 'mengjin'];
const PAINT = { xiqi: ['paint', 'paint-xiqi'], passes: ['paint', 'paint-xiqi', 'paint-passes'], mengjin: ['paint', 'paint-xiqi', 'paint-mengjin'] };   // painted atlases each scene draws from (in baked/xiqi/)
const bitmap = async (src) => { const r = await fetch(src); if (!r.ok) throw new Error('muye art: cannot load ' + src); return createImageBitmap(await r.blob()); };
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const DOORS = { 'pt-gate': { cell: 'gd-open0', open: true, foot: [770, 640], s: 0.95, rects: [[683, 478, 847, 642]] }, 'pt-citygate': { cell: 'gd-shut0', open: false, foot: [770, 606], s: 0.66, rects: [[579, 495, 656, 597], [682, 479, 785, 607], [807, 497, 888, 608]] } };
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const WORLD = W0, CELL = 620, STAND = 1;
// The day: the paper's tone and one colour screened over the ground for the ink's temperature. Figures are not tinted.
// Evening is never a hue: the paper goes warmer and greyer from 0.62, and in the last tenth dims to a warm grey.
// `far` is how much the far ground (the top of the view) is cooled and darkened: a veil, strongest at the top edge.
export const TIME = { keys: [0, 0.4, 0.62, 0.9, 1], paper: [[233, 230, 219], [239, 231, 214], [239, 231, 214], [228, 219, 203], [204, 194, 178]], temper: [[5, 10, 20], [0, 0, 0], [0, 0, 0], [8, 5, 2], [12, 7, 3]], far: [0.25, 0, 0, 0.7, 1] };
// the hour a run begins at, as a point on that day; the run's own time (setTime, 0..1 over a stretch) moves it on by SPAN
const HOUR = { dawn: 0.0, day: 0.42, dusk: 0.84 }, SPAN = 0.32;
// the weather, as what it does to the ground: a veil of paper (mist, snow), a cooler darker ground (rain), what falls
const WEATHER = { clear: {}, mist: { veil: 0.2, farVeil: 0.55 }, dust: { veil: 0.14, tint: [240, 228, 204], farVeil: 0.5, fall: 'dust' }, rain: { dim: [214, 220, 226], fall: 'rain' }, snow: { veil: 0.5, fall: 'snow', farVeil: 0.35, dim: [236, 240, 246] } };
// What falls, as data, for a renderer that draws it itself (the WebGL2 path): per kind, layers of particles in screen space.
// count: per 1440 x 900 CSS px; size: CSS px [min, max] (rain: streak length; snow: flake radius); speed: CSS px a second down
// the screen; drift: px a second to the right (wind blows left: negative); slant: dx per dy of a rain streak; colour, alpha.
// The ground also lays its own veil and dim fills (drawTone) for each kind; those stay on the ground layer.
// wind: -1..1, negative blows left (the field's wind always blows left)
const WIND = { rain: -0.3, snow: -0.15, dust: -0.85, mist: -0.1, clear: 0 };
export const FALL = {
  rain: { layers: [{ count: 180, size: [14, 36], width: [0.6, 1.3], speed: 620, drift: -174, slant: -0.28, colour: '#282E38', alpha: 0.3 }, { count: 110, size: [22, 58], width: [0.9, 1.8], speed: 900, drift: -252, slant: -0.28, colour: '#282E38', alpha: 0.22 }], splash: { onWater: true, rings: 40 } },
  snow: { layers: [{ count: 320, size: [1.6, 4.2], speed: 46, drift: -12, sway: 30, swayHz: 0.11, colour: '#FFFDF8', alpha: 1 }, { count: 160, size: [2.6, 7], speed: 80, drift: -20, sway: 40, swayHz: 0.09, colour: '#FFFDF8', alpha: 0.85 }] },
  dust: { layers: [{ count: 90, size: [30, 90], width: [0.5, 1.1], speed: 40, drift: -520, slant: -6, colour: '#9C8360', alpha: 0.28 }] },
  mist: { layers: [] }, clear: { layers: [] },
};
// where the landmarks are (world x, y): the first of each kind, and the first ford. Filled by setSeed, kept as one object.
export const LANDMARKS = {};

export async function loadGround(step = () => {}, seed = 7, firstScene = 'xiqi') {
  const field = await fetch(FILES.field).then((r) => r.json()); step();
  const KY = field.ky;
  const [marksImg, grain] = await Promise.all([FILES.marks, FILES.grain].map((u) => bitmap(u).then((b) => { step(); return b; })));
  // the code-painted atlases (shared by every scene) and the painted ones, loaded once each
  const atlases = {}; const atlas = (name) => atlases[name] || (atlases[name] = (async () => { const j = jurl('xiqi', name + '.json'); if (!j) return null; const a = await fetch(j).then((r) => r.json()); a.img = await bitmap(url('xiqi', name + '.webp')); return a; })());
  const xmeta = await fetch(jurl('xiqi', 'xiqi.json')).then((r) => r.json());
  const [groundImg, propsImg, mistImg] = await Promise.all(['ground.webp', 'props.webp', 'mist.webp'].map((n) => bitmap(url('xiqi', n))));
  const CODE_G = { ...xmeta.ground, img: groundImg }, CODE_P = { ...xmeta.props, img: propsImg }, MIST = { ...xmeta.mist, img: mistImg };
  // a scene's own files: its far band and, per course, its land and water tiles (a course's pictures load when it is needed)
  const bundles = {}, done = {};
  const bundle = (scene) => bundles[scene] || (bundles[scene] = (async () => { const meta = scene === 'xiqi' ? xmeta : await fetch(jurl(scene, scene + '.json')).then((r) => r.json());
    const [far, ...paints] = await Promise.all([bitmap(url(scene, 'far.webp')), ...PAINT[scene].map(atlas)]); return (done[scene] = { scene, meta, far, paints: paints.filter(Boolean), courses: {} }); })());
  const course = (B, ci) => B.courses[ci] || (B.courses[ci] = Promise.all([bitmap(url(B.scene, B.meta.land.files[ci])), ...B.meta['river' + ci].map((t) => bitmap(url(B.scene, t.file)).then((img) => ({ ...t, img })))]).then(([land, ...tiles]) => { B.courses[ci].ready = { land, tiles }; return B.courses[ci].ready; }));

  const G = { skip: new Set() }, gates = new Map(); let L = null, B = null, cur = null, scene = firstScene, seedNow = seed, time = 0.5, light = 0.5, weather = WEATHER.clear, now = 0, spent = new Set();
  let marchT = -1, marchTo = null, marchFrom = null;
  async function relayout() {
    L = layoutOf(seedNow, scene); G.layout = L; B = await bundle(scene);
    // pieces that lie, pieces that stand (with what index.js reads: stem, cell, x, y, flip, r, type)
    G.patches = L.patches.map((p) => ({ ...p }));
    G.props = L.props.map((p) => ({ ...p, stem: p.cell.replace(/\d+$/, ''), type: 'prop', r: p.r ?? ((findCell(p.cell, true) || [])[7] || 16) }));
    for (const k in LANDMARKS) delete LANDMARKS[k];
    for (const p of L.places) if (!LANDMARKS[p.kind]) LANDMARKS[p.kind] = [p.x, p.y];
    if (L.waters[0] && L.waters[0].fords[0]) LANDMARKS.ford = L.waters[0].fords[0];
    weather = WEATHER[L.weather] || WEATHER.clear; setLight(); spent = new Set(); gates.clear();
    cur = await course(B, L.course);
  }
  G.setSeed = async (s) => { if (L && seedNow === s) return; seedNow = s; await relayout(); };
  /** change scene ('xiqi' | 'passes' | 'mengjin'): the field of this seed in that scene */
  /** a gate of the passes or of Zhaoge opening (rules: g.gates, event gateOpen): setGate(id, open); the doors cross over in 0.9 s */
  G.setGate = (id, open) => { const g = gates.get(id); if (g ? g.open !== open : open) gates.set(id, { open, t: now }); };
  G.setStretch = async (name) => { if (!SCENES.includes(name) || (L && scene === name)) return; scene = name; await relayout(); };
  /** start loading a scene's files (call some seconds before its march) */
  const pre = new Map(); G.preload = (name) => { const k = name + ':' + seedNow; if (!pre.has(k)) pre.set(k, bundle(name).then((b) => course(b, layoutOf(seedNow, name).course))); return pre.get(k); };
  /** the march between stretches, t 0..1 over its 3-5 seconds (null to end): mist closes by 0.3, the far band crosses over
   *  from 0.35 to 0.65, the next scene is laid at 0.5 (under full mist; the rules move the riders then), the mist opens from 0.7 */
  G.march = (t, to) => { if (t == null) { marchT = -1; marchTo = marchFrom = null; return; } marchT = clamp(t); if (to && to !== marchTo) { marchTo = to; marchFrom = scene; G.preload(to); }
    if (marchT >= 0.5 && marchTo && scene !== marchTo && bundles[marchTo]) { bundles[marchTo].then(() => G.setStretch(marchTo)); } };
  G.marchVeil = () => (marchT < 0 ? 0 : 0.95 * smooth(0, 0.3, marchT) * (1 - smooth(0.7, 1, marchT)));
  function findCell(name, stand) { for (const a of (B && B.paints) || []) if (a.cells[name]) return a.cells[name]; return (stand ? CODE_P : CODE_G).cells[name]; }
  await relayout(); step();
  setTimeout(() => { for (let ci = 0; ci < B.meta.land.files.length; ci++) course(B, ci); }, 20000);      // this scene's other courses, for the next ride
  function setLight() { light = clamp((HOUR[L.hour] ?? 0.42) + time * SPAN); }

  // ---------------------------------------------------------------- the paper, cached; the weather's falling sheets, made once
  const paper = document.createElement('canvas'), pctx = paper.getContext('2d'); let paperKey = '';
  const at2 = (list, k) => { const K = TIME.keys; let i = 0; while (i < K.length - 2 && k > K[i + 1]) i++; const f = smooth(K[i], K[i + 1], k); return list[i].map((v, j) => Math.round(v + (list[i + 1][j] - v) * f)); };
  const DAY = TIME.paper[1];
  const farAt = (k) => { const K = TIME.keys; let i = 0; while (i < K.length - 2 && k > K[i + 1]) i++; return TIME.far[i] + (TIME.far[i + 1] - TIME.far[i]) * smooth(K[i], K[i + 1], k); };
  const veil = document.createElement('canvas'); veil.width = 1; veil.height = 256; { const c = veil.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgb(178,184,196)'); g.addColorStop(0.35, 'rgb(222,225,231)'); g.addColorStop(0.68, 'rgb(255,255,255)'); g.addColorStop(1, 'rgb(255,255,255)'); c.fillStyle = g; c.fillRect(0, 0, 1, 256); }
  const fog = document.createElement('canvas'); fog.width = 1; fog.height = 256; { const c = fog.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(239,231,214,1)'); g.addColorStop(0.3, 'rgba(239,231,214,.55)'); g.addColorStop(0.6, 'rgba(239,231,214,.15)'); g.addColorStop(1, 'rgba(239,231,214,0)'); c.fillStyle = g; c.fillRect(0, 0, 1, 256); }
  // the sky over Zhaoge: ink and dull purple, heaviest at the top, a breath of red low in it (multiplied over the far band)
  const doom = document.createElement('canvas'); doom.width = 1; doom.height = 256; { const c = doom.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgb(112,98,112)'); g.addColorStop(0.45, 'rgb(168,146,150)'); g.addColorStop(0.75, 'rgb(226,200,190)'); g.addColorStop(1, 'rgb(255,255,255)'); c.fillStyle = g; c.fillRect(0, 0, 1, 256); }
  const bell = document.createElement('canvas'); bell.width = 1; bell.height = 256; { const c = bell.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(239,231,214,0)'); g.addColorStop(0.38, 'rgba(239,231,214,.8)'); g.addColorStop(0.55, 'rgba(239,231,214,.6)'); g.addColorStop(1, 'rgba(239,231,214,0)'); c.fillStyle = g; c.fillRect(0, 0, 1, 256); }
  function sheet(kind) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let s = kind === 'rain' ? 11 : 23; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (kind === 'rain') { x.strokeStyle = 'rgba(40,46,56,0.32)'; x.lineCap = 'round'; for (let i = 0; i < 46; i++) { const px = r() * 256, py = r() * 256, l = 14 + r() * 22; x.lineWidth = 0.6 + r() * 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px - l * 0.28, py + l); x.stroke(); x.beginPath(); x.moveTo(px + 256, py); x.lineTo(px + 256 - l * 0.28, py + l); x.stroke(); x.beginPath(); x.moveTo(px, py - 256); x.lineTo(px - l * 0.28, py - 256 + l); x.stroke(); } }
    else if (kind === 'dust') { x.lineCap = 'round'; for (let i = 0; i < 26; i++) { const px = r() * 256, py = r() * 256, l = 30 + r() * 70; x.strokeStyle = `rgba(156,131,96,${0.18 + r() * 0.2})`; x.lineWidth = 0.5 + r() * 0.8; for (const dx of [0, 256, -256]) { x.beginPath(); x.moveTo(px + dx, py); x.quadraticCurveTo(px + dx + l / 2, py - 3, px + dx + l, py + 2); x.stroke(); } } }
    else { for (let i = 0; i < 90; i++) { const px = r() * 256, py = r() * 256, rad = 1.2 + r() * 2.6, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,253,248,0.95)'); g.addColorStop(1, 'rgba(255,253,248,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); } }
    return c; }
  const sheets = {}; const fallOf = (k) => sheets[k] || (sheets[k] = sheet(k));
  function sheetOfPaper(w, h, dpr) { const key = `${w},${h},${dpr}`; if (key === paperKey) return; paperKey = key; paper.width = w; paper.height = h;
    pctx.fillStyle = `rgb(${DAY.map((v) => Math.min(255, Math.round(v / 0.94)))})`; pctx.fillRect(0, 0, w, h); const t = grain.width * dpr; for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) pctx.drawImage(grain, x, y, t, t); }
  // a piece by name: the painted atlas (imagegen/cut.mjs) first, then the code-painted ones
  const pick = (name, code) => { for (const a of B.paints) if (a.cells[name]) return [a, a.img]; return [code, code.img]; }, lying = (name) => pick(name, CODE_G), standing = (name) => pick(name, CODE_P);
  const piece = (ctx, atlas, image, name, X, Y, z, flip = 1, k = 1) => { const q = atlas.cells[name]; if (!q) return; ctx.setTransform(flip * z * k, 0, 0, z * k, X, Y); ctx.drawImage(image, q[0], q[1], q[2], q[3], -q[4], -q[5], q[2] / q[6], q[3] / q[6]); };

  /* live getters (Object.assign below would read a getter once and copy the value) */
  Object.defineProperties(G, { places: { get: () => L.places, enumerable: true }, waters: { get: () => L.waters, enumerable: true } });
  Object.assign(G, {
    KY, field, marksImg, propsImg, landmarks: LANDMARKS,
    setTime(k) { time = clamp(k); setLight(); },
    /** for review: force the weather and the hour ({weather, hour}); undefined keeps the seed's */
    /** the camera's northward look at Zhaoge's wall (the page eases its centre toward it): null without a wall, else
     *  {wall: world y of the wall's line, from: how far south of it the look begins, lift: world units the centre moves north at the wall} */
    northView: () => (L && L.wall != null && marchT < 0 ? { wall: L.wall, from: 900, lift: 230 } : null),
    setScene(o = {}) { if (o.weather) { L.weather = o.weather; weather = WEATHER[o.weather] || WEATHER.clear; } if (o.hour) L.hour = o.hour; setLight(); },
    scene: () => ({ scene, seed: L.seed, course: L.course, mirror: L.mirror, weather: L.weather, hour: L.hour, light: +light.toFixed(3), places: L.places.length, props: G.props.length, patches: G.patches.length }),
    /** a landmark whose reward is taken: its living part (the altar's incense) goes out */
    setSpent(id, on = true) { if (on) spent.add(id); else spent.delete(id); },
    /** for review: a good place to stand for a kind of view: 'open' | 'river' | a landmark kind */
    spots(kind) { if (kind === 'open') return L.start; if (kind === 'gate') { const g = L.places.find((q) => q.kind === 'gate'); return g ? [g.x - 150, g.y + 420] : L.start; } if (kind === 'river') { const w = L.waters[0], f = w.fords[0]; return L.scene === 'mengjin' ? L.start : [f[0] + 380, f[1] - 150]; } const p = L.places.find((q) => q.kind === kind); return p ? [p.x - 120, p.y + (kind === 'platform' ? 200 : 330)] : null; },
    /** the paper's colour on screen at time k, [r, g, b] */
    paperAt(k) { const l = clamp((HOUR[L.hour] ?? 0.42) + clamp(k) * SPAN), p = at2(TIME.paper, l), t = at2(TIME.temper, l); return p.map((v, i) => Math.round(255 - (255 - Math.min(v, DAY[i])) * (255 - t[i]) / 255)); },

    /** paper, land, river, the pieces that lie, mist, the far band. V: {W, H (device px), z, dpr, cx, cy, sx(x), sy(y), hw, hh} */
    drawBase(ctx, V) {
      now = performance.now() / 1000;
      if (!(V.W > 0 && V.H > 0) || !cur) return;   /* a window with no size yet (a tab opened in the background): nothing to draw on */
      sheetOfPaper(V.W, V.H, V.dpr); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(paper, 0, 0);
      const m = L.mirror, z = V.z, mx = (x) => (m ? WORLD - x : x);
      // the land: one picture of the whole field (and its misted edges), a quarter size, drawn over the view only
      if (!G.skip.has('land')) { const LAND = B.meta.land, s = LAND.s, x0 = LAND.x0, y0 = LAND.y0, img = cur.land, vx0 = V.cx - V.hw - 40, vx1 = V.cx + V.hw + 40, vy0 = V.cy - V.hh - 40, vy1 = V.cy + V.hh + 40;
        const ux0 = m ? WORLD - vx1 : vx0, ux1 = m ? WORLD - vx0 : vx1, sx0 = clamp((ux0 - x0) * s, 0, img.width), sx1 = clamp((ux1 - x0) * s, 0, img.width), sy0 = clamp((vy0 - y0) * KY * s, 0, img.height), sy1 = clamp((vy1 - y0) * KY * s, 0, img.height);
        if (sx1 > sx0 && sy1 > sy0) { const wx0 = sx0 / s + x0, wx1 = sx1 / s + x0, wy0 = sy0 / s / KY + y0;
          ctx.setTransform(m ? -z / s : z / s, 0, 0, z / s, V.sx(mx(wx0)), V.sy(wy0)); ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, 0, 0, sx1 - sx0, sy1 - sy0); } }
      // the river's tiles (painted in squeezed ground: a tile at (x, y) covers world x..x+w, y/KY..)
      if (!G.skip.has('river')) for (const t of cur.tiles) { const tx0 = m ? WORLD - t.x - t.w : t.x; if (tx0 > V.cx + V.hw || tx0 + t.w < V.cx - V.hw || t.y / KY > V.cy + V.hh || (t.y + t.h) / KY < V.cy - V.hh) continue;
        ctx.setTransform(m ? -z : z, 0, 0, z, V.sx(m ? WORLD - t.x : t.x), V.sy(t.y / KY)); ctx.drawImage(t.img, 0, 0); }
      if (!G.skip.has('patches')) for (const p of G.patches) { const [A, I] = lying(p.cell), q = A.cells[p.cell]; if (!q || Math.abs(p.x - V.cx) > V.hw + q[2] / q[6] || Math.abs(p.y - V.cy) > V.hh + q[3] / q[6] / KY) continue; piece(ctx, A, I, p.cell, V.sx(p.x), V.sy(p.y), z, p.flip); }
      // mist lying on the ground, drifting slowly down wind (left)
      ctx.globalAlpha = 1;
      if (!G.skip.has('mist')) for (const f of L.mist) { const q = MIST.cells[f.cell]; if (!q) continue; let x = f.x - ((now * f.drift) % 1200); if (Math.abs(x - V.cx) > V.hw + q[2] * f.k || Math.abs(f.y - V.cy) > V.hh + q[3] * f.k / KY) continue; ctx.globalAlpha = f.a; piece(ctx, MIST, MIST.img, f.cell, V.sx(x), V.sy(f.y), z, 1, f.k); }
      ctx.globalAlpha = 1;
      // the far band: its foot sits where the field's north edge would be, but never lower than half the screen nor higher
      // than a sixth of it; its size follows its foot, so the range is small and far from mid-field and looms near the north
      if (!G.skip.has('far')) { const D = V.dpr, Wc = V.W / D, Hc = V.H / D, foot = clamp(V.sy(-120) / D, Hc * 0.21, Hc * 0.47), FAR = B.meta.far, bs = Math.max(foot / FAR.foot, Wc / (FAR.w - 120)), Wb = Wc / bs;
        const u = clamp((V.cx + 300) / (WORLD + 600)), u0 = (m ? 1 - u : u) * (FAR.w - Wb);
        const band = (img, a) => { if (!img || a <= 0.01) return; ctx.globalAlpha = a; ctx.setTransform(m ? -bs * D : bs * D, 0, 0, bs * D, m ? V.W : 0, (foot - FAR.foot * bs) * D); ctx.drawImage(img, u0, 0, Wb, FAR.h, 0, 0, Wb, FAR.h); ctx.globalAlpha = 1; };
        // during a march the far band crosses over from the scene being left to the next (both are the same size)
        const other = marchT >= 0 ? done[scene === marchTo ? marchFrom : marchTo] : null, x = marchT >= 0 ? smooth(0.35, 0.65, marchT) : 0;
        if (other) { const mine = scene === marchTo ? x : 1 - x; band(B.far, 1); band(other.far, 1 - mine); } else band(B.far, 1);
        // over Zhaoge an ominous cloud bank (painted, imagegen/raw/z1-sky) rolls along the top, heavier as the city nears; tiles turned over by turns
        if (scene === 'mengjin' && !G.skip.has('sky')) { const [A, I] = standing('zg-sky0'), q = A.cells['zg-sky0']; if (q) { const a = (0.6 + 0.4 * smooth(3400, 1100, V.cy)) * (other ? 1 - x : 1), h = Math.max(foot * 0.95, 160) * D, w = h * q[2] / q[3], off = (u0 * bs * D * 0.35) % (2 * w);
          ctx.globalAlpha = a; for (let i = 0, X = -off; X < V.W; X += w * 0.8, i++) { const f = i % 2 ? -1 : 1; ctx.setTransform(f, 0, 0, 1, f < 0 ? X + w : X, -0.12 * h); ctx.drawImage(I, q[0], q[1], q[2], q[3], 0, 0, w, h); } ctx.globalAlpha = 1; } }
        // the sky keeps the paper's grain: lay the cached paper back over the band's empty top, a band of soft height
        // and the ground below it goes into mist toward the band: a soft veil of paper under its foot
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(bell, 0, 0, 1, 256, 0, (foot - 60 * bs - 20) * D, V.W, (110 * bs + 110) * D); ctx.globalAlpha = 1;
        G.foot = foot * D; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    /** the hour and the weather, laid over the ground: a few fills */
    drawTone(ctx, V) {
      const p = at2(TIME.paper, light), t = at2(TIME.temper, light), r = p.map((v, i) => Math.min(255, Math.round((v / DAY[i]) * 255)));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      const mv = G.marchVeil(); if (mv > 0.01) { ctx.globalAlpha = mv; ctx.fillStyle = 'rgb(239,234,222)'; ctx.fillRect(0, 0, V.W, V.H); ctx.globalAlpha = 1; }
      if (weather.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${weather.tint})`; ctx.fillRect(0, 0, V.W, V.H); ctx.globalCompositeOperation = 'source-over'; }
      if (weather.veil) { ctx.globalAlpha = weather.veil; ctx.fillStyle = L.weather === 'snow' ? 'rgb(250,249,245)' : 'rgb(239,234,222)'; ctx.fillRect(0, 0, V.W, V.H); ctx.globalAlpha = 1; }
      if (weather.farVeil) { ctx.globalAlpha = weather.farVeil; ctx.drawImage(fog, 0, 0, 1, 256, 0, 0, V.W, Math.max(1, (G.foot || V.H * 0.2) * 1.8)); ctx.globalAlpha = 1; }
      if (weather.dim) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${weather.dim})`; ctx.fillRect(0, 0, V.W, V.H); }
      if (r[0] + r[1] + r[2] < 762) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${r})`; ctx.fillRect(0, 0, V.W, V.H); }
      if (t[0] + t[1] + t[2] > 2) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgb(${t})`; ctx.fillRect(0, 0, V.W, V.H); }
      if (scene === 'mengjin' && L.wall != null) { const k = 0.35 + 0.65 * smooth(3200, 1100, V.cy); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k; ctx.drawImage(doom, 0, 0, 1, 256, 0, 0, V.W, Math.max(1, (G.foot || V.H * 0.2) * 1.5)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }   /* the sky over Zhaoge darkens as the city nears */
      const far = farAt(light); if (far > 0.02) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = far; ctx.drawImage(veil, 0, 0, 1, 256, 0, 0, V.W, V.H); ctx.globalAlpha = 1; }   /* the far ground cooler and darker: one stretched strip */
      ctx.globalCompositeOperation = 'source-over';
    },
    /** the weather now, as data (see FALL): {kind, fall, veil, farVeil, dim, wind}. A renderer that draws the falling
     *  particles itself sets `ground.ownFall = true`; drawOver then draws nothing. */
    weatherState: () => ({ kind: L.weather, fall: weather.fall || null, layers: (FALL[L.weather] || FALL.clear).layers, amount: L.weather === 'dust' ? 0.45 : 1, wind: WIND[L.weather] ?? 0, veil: weather.veil || 0, farVeil: weather.farVeil || 0, dim: weather.dim || null }),
    ownFall: false,
    /** what falls, over the figures: two sheets of rain or snow at two speeds. Thin, so the battle still reads. */
    drawOver(ctx, V) {
      const kind = weather.fall; if (!kind || G.ownFall || !(V.W > 0)) return; const img = fallOf(kind), D = V.dpr, k = (kind === 'rain' ? 1.3 : 1.6) * D;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
      for (const [sp, a, sc] of kind === 'rain' ? [[620, 0.55, 1], [900, 0.4, 1.6]] : kind === 'dust' ? [[520, 0.8, 1.4], [760, 0.55, 2.2]] : [[46, 1, 1.3], [80, 0.85, 2.2]]) {
        const s = k * sc, T = 256 * s, oy = kind === 'dust' ? (now * 18 * D) % T : (now * sp * D) % T, ox = kind === 'rain' ? (now * sp * 0.28 * D) % T : kind === 'dust' ? (now * sp * D) % T : (Math.sin(now * 0.7) * 30 * D + now * 12 * D) % T;
        ctx.globalAlpha = a; for (let y = -T + oy; y < V.H; y += T) for (let x = -T - ox; x < V.W; x += T) ctx.drawImage(img, x, y, T, T); }
      ctx.globalAlpha = 1;
    },
    mark(ctx, name, X, Y, z, o = {}) { const q = field.marks.cells[name]; if (!q) return; const kx = (o.kx ?? o.k ?? 1) * z, ky = (o.ky ?? o.k ?? 1) * z, rot = o.rot || 0, c = Math.cos(rot), s2 = Math.sin(rot), f = o.flat ? KY : 1;
      ctx.setTransform(kx * c, kx * s2 * f, -ky * s2, ky * c * f, X, Y); ctx.globalAlpha = o.a ?? 1; ctx.drawImage(marksImg, q[0], q[1], q[2], q[3], -q[4], -q[5], q[2] / q[6], q[3] / q[6]); ctx.globalAlpha = 1; },
    /* the doors drawn over a painted gate: the passes' gate is painted shut and opens; Zhaoge's is painted open and is shut until 纣王 comes out.
       rects are the doorways in the source picture's pixels, foot and scale as in imagegen/rigs.json */
    prop(ctx, p, X, Y, z) {
      // a thing whose foot is up in the far band's mist is lost in it (it would otherwise stand on the distant range)
      /* Zhaoge's wall, gate, palace and standards come out of the band's mist together, as the wall's own line clears the band */
      const north = L.wall != null && p.y < L.wall + 700, Yf = north ? Y + (L.wall - p.y) * KY * z : Y;
      const f = (G.foot ? (north ? smooth(G.foot - 10 * z, G.foot + 50 * z, Yf) : smooth(G.foot - 60 * z, G.foot + 10 * z, Y)) : 1) * (1 - G.marchVeil()); if (f <= 0.01) return; if (f < 1) ctx.globalAlpha *= f;      /* lost in the band's mist, or in the march's */
      if (p.cell === 'incense' && spent.size && L.places.some((q) => spent.has(q.id) && Math.hypot(q.x - p.x, q.y - 150 - p.y) < 20)) return; const [A, I] = standing(p.cell); piece(ctx, A, I, p.cell, X, Y, z, p.flip, 1);
      const D = DOORS[p.cell]; if (D) { const gp = L.places.find((q) => q.kind === 'gate' && Math.abs(q.x - p.x) < 2 && Math.abs(q.y - p.y) < 2), st = gp && gates.get(gp.id), k = st ? (st.open ? smooth(0, 0.9, now - st.t) : 1 - smooth(0, 0.9, now - st.t)) : 0, a = D.open ? k : 1 - k;
        const [B2, I2] = standing(D.cell), q = B2.cells[D.cell]; if (q && a > 0.01) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * a; ctx.setTransform(p.flip * z, 0, 0, z, X, Y);
          for (const [x0, y0, x1, y1] of D.rects) ctx.drawImage(I2, q[0], q[1], q[2], q[3], (x0 - D.foot[0]) * D.s, (y0 - D.foot[1]) * D.s, (x1 - x0) * D.s, (y1 - y0) * D.s); ctx.globalAlpha = a0; } } },
  });
  return G;
}
