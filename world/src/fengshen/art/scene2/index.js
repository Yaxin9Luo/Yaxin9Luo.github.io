// The second scene of the side-view battle: the road from the Zhou camp to the walls of Shang, in ink and mineral colour.
// Interface (section 6 of lab/game-studies/SPEC-V2.md):
//
//   const scene = await loadScene({onProgress});   // resolves when the paper, the long sheets and the first place are in;
//                                             // onProgress(loaded, total) counts files, the other places come after
//   scene.ready(n); scene.progress(); scene.whenAll   // has place n (1..5) arrived; {loaded, total}; a promise for all of them
//   scene.setView({width, height, dpr});      // CSS pixels and device pixel ratio; call on resize
//   scene.setTime(k);                         // 0 cold dawn .. 0.5 clear day .. 1 red dusk
//   scene.drawBack(ctx, cam);                 // paper, sky, ranges, hills, the five places, mist, water, banners, the ground
//   scene.drawMid(ctx, cam, dt);              // what grows on the ground line and moves in the wind; advances the scene's clock
//   scene.drawFront(ctx, cam, dt);            // rocks, stakes and reeds in front of everything
//   scene.groundY();                          // CSS pixels from the top of the view to the ground line when cam.y is 0
//   scene.paperAt(k);                         // the paper's colour at time k, [r, g, b], for a page that wants to match it
//
// The camera is the art contract's: cam.x is the world x at the middle of the view, cam.y lifts the camera (world units,
// up positive), cam.zoom scales about the middle of the ground line, shakeX / shakeY are CSS pixels. The canvas is drawn
// in DEVICE pixels; every call saves the context and restores it. World x runs 0..4800; the ground line is at 82% of the
// view's height, as in ../index.js, so the two modules agree about where a world point is.
//
// How it is made (see review/NOTES.md): every sheet is ink (baked in its day colour, cooler and paler with distance) and,
// where there is any, a sheet of mineral colour multiplied under the ink. The time of day is three things only: the paper's
// colour (a fill), the ink's temperature (one colour screened over the scene) and the strength of the mineral colour (an
// alpha). Nothing is rebuilt per frame. When the time of day moves a step, the few small sheets that must be the paper's
// own colour (the mist, and the paper a near thing keeps for itself) are re-filled, one per frame.
const FILES = {
  scene: new URL('./baked/scene.json', import.meta.url).href,
  grain: new URL('./baked/grain.webp', import.meta.url).href,
  ink: { far: new URL('./baked/far.webp', import.meta.url).href, mid: new URL('./baked/mid.webp', import.meta.url).href, hills: new URL('./baked/hills.webp', import.meta.url).href, ground: new URL('./baked/ground.webp', import.meta.url).href },
  colour: { sky: new URL('./baked/sky.c.webp', import.meta.url).href, far: new URL('./baked/far.c.webp', import.meta.url).href, mid: new URL('./baked/mid.c.webp', import.meta.url).href, hills: new URL('./baked/hills.c.webp', import.meta.url).href },
  body: { mid: new URL('./baked/mid.b.webp', import.meta.url).href, hills: new URL('./baked/hills.b.webp', import.meta.url).href },
  atlas: { ink: new URL('./baked/atlas-ink.webp', import.meta.url).href, mist: new URL('./baked/atlas-mist.webp', import.meta.url).href, col: new URL('./baked/atlas-col.webp', import.meta.url).href },
  // the five places, each by itself: its ink, its mineral colour, the paper it keeps, and what stands in front of it
  place: [
    { ink: new URL('./baked/set-1.webp', import.meta.url).href, colour: new URL('./baked/set-1.c.webp', import.meta.url).href, body: new URL('./baked/set-1.b.webp', import.meta.url).href, front: new URL('./baked/atlas-f1.webp', import.meta.url).href },
    { ink: new URL('./baked/set-2.webp', import.meta.url).href, colour: new URL('./baked/set-2.c.webp', import.meta.url).href, body: new URL('./baked/set-2.b.webp', import.meta.url).href, front: new URL('./baked/atlas-f2.webp', import.meta.url).href },
    { ink: new URL('./baked/set-3.webp', import.meta.url).href, colour: new URL('./baked/set-3.c.webp', import.meta.url).href, body: new URL('./baked/set-3.b.webp', import.meta.url).href, front: new URL('./baked/atlas-f3.webp', import.meta.url).href },
    { ink: new URL('./baked/set-4.webp', import.meta.url).href, colour: new URL('./baked/set-4.c.webp', import.meta.url).href, body: new URL('./baked/set-4.b.webp', import.meta.url).href, front: new URL('./baked/atlas-f4.webp', import.meta.url).href },
    { ink: new URL('./baked/set-5.webp', import.meta.url).href, colour: new URL('./baked/set-5.c.webp', import.meta.url).href, body: new URL('./baked/set-5.b.webp', import.meta.url).href, front: new URL('./baked/atlas-f5.webp', import.meta.url).href },
  ],
};
// decoded once into a bitmap that stays decoded: a large <img> drawn every frame can be thrown out of the browser's decode
// cache and decoded again, which costs milliseconds a frame
const loadImage = async (src) => { const r = await fetch(src); if (!r.ok) throw new Error('scene2: cannot load ' + src); const b = await createImageBitmap(await r.blob()); b.src = src; return b; };
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const GRAIN = 0.94, GROUND_AT = 0.82, VH = 900, TIME_STEPS = 32, TAU = Math.PI * 2;
const ORDER = ['sky', 'far', 'mid', 'hills', 'set', 'ground'], FADE_MS = 700;
// one wind for everything that moves: -1..1, slow, never in step for two things with different ph
const wind = (t, ph) => 0.6 * Math.sin(0.9 * t + ph) + 0.4 * Math.sin(2.3 * t + 1.7 * ph);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export async function loadScene({ onProgress } = {}) {
  const scene = await fetch(FILES.scene).then((r) => r.json());
  const GY = scene.ground, L = scene.layers, T = scene.time;
  // Loading is in two parts. First: the paper, every sheet that runs the length of the road (they are small), the things
  // that move, and the first place. loadScene() resolves then. After that the other four places come in order, in the
  // background, and each fades in over 0.7 s if it happens to be in view when it arrives, so nothing pops.
  const sheetNames = ORDER.filter((n) => n !== 'set'), inkNames = sheetNames.filter((n) => L[n].ink && FILES.ink[n]), colNames = sheetNames.filter((n) => L[n].colour && FILES.colour[n]), bodyNames = sheetNames.filter((n) => L[n].body && FILES.body[n]);
  const total = 4 + inkNames.length + colNames.length + bodyNames.length + FILES.place.length * 4; let loaded = 0;
  const load = (src) => loadImage(src).then((b) => { loaded++; if (onProgress) try { onProgress(loaded, total); } catch { /* the page's own business */ } return b; });
  const loadPlace = (i) => Promise.all([load(FILES.place[i].ink), load(FILES.place[i].colour), load(FILES.place[i].body), load(FILES.place[i].front)]);
  const [grainImg, inkAtlasImg, mistAtlasImg, colAtlas, first, ...rest] = await Promise.all([load(FILES.grain), load(FILES.atlas.ink), load(FILES.atlas.mist), load(FILES.atlas.col), loadPlace(0),
    ...inkNames.map((n) => load(FILES.ink[n])), ...colNames.map((n) => load(FILES.colour[n])), ...bodyNames.map((n) => load(FILES.body[n]))]);
  const ink = Object.fromEntries(inkNames.map((n, i) => [n, { c: rest[i] }]));
  const colour = Object.fromEntries(colNames.map((n, i) => [n, rest[inkNames.length + i]]));
  // a mask becomes a canvas that is filled with a colour through its own alpha ('source-in')
  const tintable = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { c, x, key: '' }; };
  // a body is the paper a near thing keeps for itself: a mask filled with the paper's colour, drawn under its ink
  const body = Object.fromEntries(bodyNames.map((n, i) => [n, tintable(rest[inkNames.length + colNames.length + i])]));
  const inkAtlas = { c: inkAtlasImg }, mistAtlas = tintable(mistAtlasImg);
  // a place, once it has come: {ink, colour, body, front, t (when it came, for the fade; -Infinity for what was there at the start)}
  const places = FILES.place.map(() => null);
  const install = (i, [pInk, pCol, pBody, pFront], t) => { const b = tintable(pBody); if (now.flat) tint(b, now.flat); places[i] = { ink: pInk, colour: pCol, body: b, front: pFront, t }; };
  const fadeOf = (pl) => (pl.t === -Infinity ? 1 : clamp((performance.now() - pl.t) / FADE_MS));
  const tint = (t, rgb) => { const key = rgb.join(','); if (t.key === key) return false; t.key = key; t.x.globalCompositeOperation = 'source-in'; t.x.fillStyle = `rgb(${key})`; t.x.fillRect(0, 0, t.c.width, t.c.height); return true; };

  let W = 1440, H = 900, dpr = 1, S = 1, time = -1, step = -1, clock = 0;
  // The paper with its tooth is one canvas the size of the view, rebuilt only when the view or the time of day changes.
  // (A pattern fill every frame put the whole canvas on a slow path: 15 to 60 ms a frame. Never fill with a pattern per frame.)
  const paper = document.createElement('canvas'), pctx = paper.getContext('2d'); let paperKey = '';
  function sheetOfPaper() {
    const w = Math.round(W * dpr), h = Math.round(H * dpr), key = `${w},${h},${now.paper.join(',')}`; if (key === paperKey) return; paperKey = key;
    if (paper.width !== w || paper.height !== h) { paper.width = w; paper.height = h; }
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.globalAlpha = 1; pctx.fillStyle = `rgb(${now.paper.join(',')})`; pctx.fillRect(0, 0, w, h);
    const t = grainImg.width * dpr; for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) pctx.drawImage(grainImg, x, y, t, t);   // black with a little alpha: it darkens as a multiply would
  }
  const now = { paper: [239, 231, 214], temper: [0, 0, 0], mineral: 1, dusk: 0, sun: 0 }, queue = [];

  // ---------------------------------------------------------------- the time of day
  const at = (list, k) => { const K = T.keys; let i = 0; while (i < K.length - 2 && k > K[i + 1]) i++; const f = smooth(K[i], K[i + 1], k), a = list[i], b = list[i + 1]; return Array.isArray(a) ? a.map((v, j) => Math.round(v + (b[j] - v) * f)) : a + (b - a) * f; };
  function setTime(k) {
    k = clamp(k); const s = Math.round(k * TIME_STEPS); if (s === step) return; step = s; time = s / TIME_STEPS;
    now.paper = at(T.paper, time).map((v) => Math.min(255, Math.round(v / GRAIN)));   // the flat colour under the grain; with the grain over it the sheet averages T.paper
    now.flat = at(T.paper, time);                                                      // what kept paper and mist are filled with: the sheet's average
    now.temper = at(T.temper, time); now.mineral = at(T.mineral, time); now.dusk = at(T.dusk, time); now.sun = at(T.sun, time);
    queue.length = 0; queue.push([mistAtlas, now.flat]); for (const n of bodyNames) queue.push([body[n], now.flat]); for (const pl of places) if (pl) queue.push([pl.body, now.flat]);
  }
  const flush = (n) => { while (n-- > 0 && queue.length) { const [t, rgb] = queue.shift(); tint(t, rgb); } };
  function setView(v) { W = v.width; H = v.height; dpr = Math.min(v.dpr || 1, 2); S = H / VH; }
  setTime(0); flush(99);
  install(0, first, -Infinity);
  const whenAll = (async () => { for (let i = 1; i < FILES.place.length; i++) { try { install(i, await loadPlace(i), performance.now()); } catch (err) { console.warn('scene2: place ' + (i + 1) + ' did not load', err); } } })();

  // ---------------------------------------------------------------- where things are
  // z: device pixels per world unit. X(x, p): device x of sheet-space x on a layer of parallax p. Y(y, p): device y of design y.
  function frameOf(cam) {
    const z = S * (cam.zoom || 1) * dpr;
    return { z, ox: (W / 2 + (cam.shakeX || 0)) * dpr, oy: (H * GROUND_AT + (cam.shakeY || 0)) * dpr, cx: cam.x || 0, cy: cam.y || 0, half: (W * dpr) / 2 / z + 2 };
  }
  const uMid = (f, p) => scene.u0 + (f.cx - scene.cam0) * p;
  const Yd = (f, y, p) => f.oy + (y - GY) * f.z + f.cy * f.z * p;
  function drawSheet(ctx, f, name, img) {
    const l = L[name], k = img.width / l.w, m = uMid(f, l.p), u0 = Math.max(0, m - f.half), u1 = Math.min(l.w, m + f.half); if (u1 <= u0) return;
    ctx.drawImage(img, u0 * k, 0, (u1 - u0) * k, img.height, f.ox + (u0 - m) * f.z, Yd(f, l.y0, l.p), (u1 - u0) * f.z, (l.y1 - l.y0) * f.z);
  }
  // a cell of an atlas with its pivot at device (X, Y); k: size in world units; skew leans it (for the wind)
  function cell(ctx, atlas, img, name, X, Y, k, flip = 1, skew = 0) {
    const q = atlas.cells[name]; if (!q) return;
    ctx.setTransform(k * flip, 0, skew * k, k, X, Y);
    ctx.drawImage(img, q[0], q[1], q[2], q[3], -q[4], -q[5], q[2] / q[6], q[3] / q[6]);
  }
  function layer(ctx, f, name) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (body[name]) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; drawSheet(ctx, f, name, body[name].c); }
    if (colour[name]) { const a = name === 'sky' ? now.dusk : now.mineral; if (a > 0.01) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a; drawSheet(ctx, f, name, colour[name]); } }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; if (ink[name]) drawSheet(ctx, f, name, ink[name].c);
  }
  // the places: each its own piece of the sheet, cropped to what is painted. Pieces meet on whole device pixels, so no seam shows.
  function setLayer(ctx, f) {
    const l = L.set, m = uMid(f, l.p); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < places.length; i++) { const pl = places[i], q = l.tiles[i]; if (!pl || q.u1 < m - f.half || q.u0 > m + f.half) continue;
      const a = fadeOf(pl), xa = Math.round(f.ox + (q.u0 - m) * f.z), w = Math.round(f.ox + (q.u1 - m) * f.z) - xa, ya = Yd(f, q.y0, l.p), h = (q.y1 - q.y0) * f.z;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.drawImage(pl.body.c, xa, ya, w, h);
      if (now.mineral > 0.01) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a * now.mineral; ctx.drawImage(pl.colour, xa, ya, w, h); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.drawImage(pl.ink, xa, ya, w, h); }
    ctx.globalAlpha = 1;
  }
  // mist drifts down wind and comes round; each lobe is drawn twice, half a turn apart, so its place is never left bare
  function mist(ctx, f, p, list = scene.place.mist, atlas = scene.atlas.mist, img = mistAtlas.c, span = 1100, speed = 1) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < list.length; i++) {
      const m = list[i]; if (m.p !== p) continue;
      const v = (5 + 3 * hash(i)) * speed, mid = uMid(f, p);
      for (let j = 0; j < 2; j++) {
        const off = ((clock * v + (hash(i + 7) + j * 0.5) * span) % span) - span / 2, u = m.u - off; if (Math.abs(u - mid) > f.half + 520 * m.k) continue;
        const fade = 1 - (Math.abs(off) / (span / 2)) ** 2;
        ctx.globalAlpha = m.a * fade; cell(ctx, atlas, img, m.cell, f.ox + (u - mid) * f.z, Yd(f, m.y + 6 * Math.sin(clock * 0.11 + i), p), m.k * f.z);
      }
    }
    ctx.globalAlpha = 1;
  }
  function onSet(ctx, f) {
    const l = L.set, mid = uMid(f, l.p), P = scene.place, X = (u) => f.ox + (u - mid) * f.z, vis = (u, r) => Math.abs(u - mid) < f.half + r;
    // the fall: streaks of paper running down it
    ctx.globalCompositeOperation = 'source-over';
    const fFall = places[2] ? fadeOf(places[2]) : 0, fWater = places[1] ? fadeOf(places[1]) : 0;                  // what moves on a place waits for the place
    for (const w of P.falls) { if (!vis(w.x, 60) || !fFall) continue;
      for (let j = 0; j < 3; j++) { const q = scene.atlas.mist.cells['fall' + j], h = q[3] / q[6], len = w.y1 - w.y0, o = ((clock * (46 + 9 * j) + j * 70) % h), k = f.z;
        ctx.globalAlpha = (0.55 + 0.25 * Math.sin(clock * 1.3 + j * 2.1)) * fFall;
        // two pieces of the same strip, so the streaks wrap inside the fall without a clip
        const top = Math.min(o, len);
        ctx.setTransform(k, 0, 0, k, X(w.x + (j - 1) * w.w * 0.22), Yd(f, w.y0, l.p));
        if (top > 0) ctx.drawImage(mistAtlas.c, q[0], q[1] + (h - o) * q[6], q[2], top * q[6], -q[4], 0, q[2] / q[6], top);
        if (o < len) ctx.drawImage(mistAtlas.c, q[0], q[1], q[2], (len - o) * q[6], -q[4], o, q[2] / q[6], len - o);
      } }
    // the water: ripples of ink and glints of paper that come and go, sliding with the wind
    for (const w of P.water) { if (mid + f.half < w.x0 || mid - f.half > w.x1 || !fWater) continue;
      for (let i = 0; i < 22; i++) { const g = i % 3 === 0, ph = hash(i * 3.1) * TAU, a = Math.sin(clock * (0.35 + 0.3 * hash(i + 2)) + ph); if (a <= 0) continue;
        const ty = hash(i * 1.7 + 5) ** 1.4, u = w.x0 + hash(i * 2.3 + 1) * (w.x1 - w.x0) - ((clock * 6) % 60), y = w.y0 + ty * (w.y1 - w.y0);
        ctx.globalAlpha = a * (g ? 0.7 : 0.3 - 0.14 * ty) * fWater;
        cell(ctx, g ? scene.atlas.mist : scene.atlas.ink, g ? mistAtlas.c : inkAtlas.c, (g ? 'glint' : 'rip') + (i % (g ? 3 : 4)), X(u), Yd(f, y, l.p), f.z * (0.7 + 0.7 * ty)); } }
    // banners: the cloth in strips, each lifted by a wave that runs from the pole to the tail. Strips meet on whole
    // device pixels, so no seam shows; the cloth is laid on (not multiplied), as paint is.
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of P.banners) { if (!vis(b.x, 140)) continue;
      const q = scene.atlas.col.cells[b.cell], n = 10, sw = q[2] / n, k = b.k * f.z / q[6], g = 0.75 + 0.25 * wind(clock, b.ph), X0 = X(b.x) - q[4] * q[6] * k, Y0 = Yd(f, b.y, l.p) - q[5] * q[6] * k;
      for (let i = 0; i < n; i++) { const t = 1 - i / (n - 1), dy = (Math.sin(clock * 4.2 * g - t * 3.4 + b.ph) * 5 * t + 9 * t * t * (1 - g)) * q[6] * k, xa = Math.round(X0 + i * sw * k), xb = Math.round(X0 + (i + 1) * sw * k);
        ctx.drawImage(colAtlas, q[0] + i * sw, q[1], sw, q[3], xa, Y0 + dy, xb - xa, q[3] * k); } }
    ctx.globalCompositeOperation = 'source-over';
  }
  function birds(ctx, f) {
    const l = L.mid, mid = uMid(f, l.p); ctx.globalCompositeOperation = 'source-over';
    for (const b of scene.place.birds) { const span = 1800, off = (clock * 11 + 640) % span, fade = smooth(0, 200, off) * (1 - smooth(span - 300, span, off)), bx = b.x + 500 - off; if (Math.abs(bx - mid) > f.half + 300) continue;
      for (let i = 0; i < b.n; i++) { const arm = i % 2 ? 1 : -1, r = Math.ceil(i / 2), u = bx + r * 24 + (arm > 0 ? 6 : 0), y = b.y + arm * r * 9 + 3 * Math.sin(clock * 0.7 + i), fr = [0, 1, 2, 1][Math.floor(clock * 2.6 + i * 0.37) % 4];
        ctx.globalAlpha = 0.6 * fade; cell(ctx, scene.atlas.ink, inkAtlas.c, 'bird' + fr, f.ox + (u - mid) * f.z, Yd(f, y, l.p), f.z * (0.9 - 0.03 * r)); } }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the three calls
  function drawBack(ctx, cam) {
    flush(1);
    const f = frameOf(cam);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    sheetOfPaper(); ctx.drawImage(paper, 0, 0);                                     // the paper does not move: the ink does
    layer(ctx, f, 'sky'); mist(ctx, f, 0.06, scene.place.clouds, scene.atlas.ink, inkAtlas.c, 2600, 0.5);
    if (now.sun > 0.01 && scene.place.sun) { const s = scene.place.sun, m = uMid(f, L.sky.p); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = now.sun; cell(ctx, scene.atlas.col, colAtlas, 'sun', f.ox + (s.x - m) * f.z, Yd(f, s.y, L.sky.p), f.z); ctx.globalAlpha = 1; }
    layer(ctx, f, 'far'); layer(ctx, f, 'mid'); birds(ctx, f); mist(ctx, f, 0.42);
    layer(ctx, f, 'hills'); mist(ctx, f, 0.7);
    setLayer(ctx, f); onSet(ctx, f); mist(ctx, f, 0.95);
    layer(ctx, f, 'ground');
    // the ink's temperature: one colour screened over the scene
    if (now.temper[0] + now.temper[1] + now.temper[2] > 2) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1; ctx.fillStyle = `rgb(${now.temper.join(',')})`; ctx.fillRect(0, 0, W * dpr, H * dpr); }
    ctx.restore();
  }
  function drawMid(ctx, cam, dt = 0) {
    clock += Math.min(0.1, dt || 0);
    const f = frameOf(cam);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.8;
    for (const t of scene.place.tufts) { if (Math.abs(t.x - f.cx) > f.half + 60) continue;
      cell(ctx, scene.atlas.ink, inkAtlas.c, t.cell, f.ox + (t.x - f.cx) * f.z, Yd(f, t.y, 1), t.k * f.z, t.flip, 0.16 + 0.14 * wind(clock, t.ph)); }
    ctx.restore();
  }
  function drawFront(ctx, cam) {
    const f = frameOf(cam), P = 1.4;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < scene.place.front.length; i++) { const o = scene.place.front[i], dx = (o.x - f.cx) * P; if (Math.abs(dx) > f.half + 320) continue;
      const pl = places[+o.at.slice(1) - 1]; if (!pl) continue; ctx.globalAlpha = fadeOf(pl);
      cell(ctx, scene.atlas[o.at], pl.front, o.cell, f.ox + dx * f.z, Yd(f, GY + 290, P), o.k * f.z, o.flip || 1, o.sway ? 0.05 + 0.05 * wind(clock, i * 1.3) : 0); }
    ctx.restore();
  }

  return {
    setView, setTime, drawBack, drawMid, drawFront,
    groundY: () => H * GROUND_AT,
    info: { world: scene.world, ground: GROUND_AT, places: scene.places },
    /** has place n (1..5) arrived? The first always has. The page can hold a loading line, or the camera, on this. */
    ready: (n) => !!places[n - 1],
    /** files arrived and files in all */
    progress: () => ({ loaded, total }),
    /** resolves when every place has arrived (or failed: a place that fails is left out and a warning is logged) */
    whenAll,
    /** the paper's average colour at time k, [r, g, b], so that a page can match its own panels to it */
    paperAt: (k) => { const p = at(T.paper, clamp(k)), t = at(T.temper, clamp(k)); return p.map((v, i) => Math.round(255 - (255 - v) * (255 - t[i]) / 255)); },   // with the ink's tint screened over it, as it is on screen
    debug: { scene, get time() { return time; }, get pending() { return queue.length; }, setClock(t) { clock = t; } },
  };
}
