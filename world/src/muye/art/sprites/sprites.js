// The sprite-frame pipeline: every figure's poses are cut ONCE, at load, from the puppets into frames on one atlas,
// and a unit is then one drawImage. (Measured in the view study: 500 units in about 1 ms; jointing 500 puppets a frame
// costs five to ten times that.) Frames face right; the drawing mirrors them by the unit's facing.
//
//   const sprites = await buildSprites(source, {dpr, budgetMB, onProgress, shadowOf});
//   source: {PUPPETS, createCutter}            art/puppets/index.js, or sprites/fallback.js in the same shape
//   sprites.get(key, variant) -> set | null     set: {img, flash, k, frames: {state: [f, ...]}}   f = [sx, sy, w, h, px, py]
//   sprites.ensure(key, variant)                cuts a variant that was not cut at load (the hero's resonance), in its own sheet
//   sprites.stats -> {ms, frames, megabytes, resolution, ...}
//
// Each frame is cut into a scratch cell the size of the puppet's box, trimmed to what was painted, and packed, so the
// atlas holds ink and almost no empty paper. The contact shadow is in the frame. The atlas is multiplied by the
// paper's colour once (puppets are dye in the paper). A second atlas at half size holds every frame in plain paper
// white: laid over a figure for the instant it is hurt.
// Memory: frames are cut at the display's pixel density unless that would pass the budget (40 MB by default); then
// everything is cut smaller by one factor and drawn enlarged.
const PAPER = [239, 231, 214], TAU = Math.PI * 2, PAD = 3, PROBE = 6;
export const FLASH = 3;                                         // the flash sheet is cut at a third of the size
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
function shadowAt(c, x, y, rx, ry, a = 0.3, rgb = [30, 26, 22], hard = 0) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${rgb},${a * (hard ? 0.82 : 1)})`); g.addColorStop(hard || 0.62, `rgba(${rgb},${a * (hard ? 1 : 0.72)})`); g.addColorStop(1, `rgba(${rgb},0)`);   // hard: a disc with an edge (a mark), not a shadow
  c.save(); c.setTransform(rx, 0, 0, ry, x, y); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore(); }
function intoPaper(cv) { const t = canvasOf(cv.width, cv.height), x = t.getContext('2d'); x.fillStyle = `rgb(${PAPER})`; x.fillRect(0, 0, t.width, t.height); x.globalCompositeOperation = 'multiply'; x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(cv, 0, 0); return t; }
function flashOf(cv, colour = '#fff6e4') { const t = canvasOf(cv.width / FLASH, cv.height / FLASH), x = t.getContext('2d'); x.drawImage(cv, 0, 0, t.width, t.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = colour; x.fillRect(0, 0, t.width, t.height); return t; }
const NOSHADOW = { dead: 1, wreck: 1, fall: 1 };
// A friend's mark: an ordinary soft shadow, and round it one thin ring of ink in the side's pigment, drawn in two pulls that
// do not quite meet, heavier at the front. Never a filled disc.
function inkRing(c, x, y, rx, ry, a, rgb, res) { shadowAt(c, x, y, rx * 0.86, ry * 0.86, a); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.lineCap = 'round';
  for (const [a0, a1, w, al] of [[0.18, 2.96, 1.5, 0.9], [3.4, 6.0, 0.9, 0.6]]) { c.strokeStyle = `rgba(${rgb},${al})`; c.lineWidth = Math.max(1, w * res); c.beginPath(); c.ellipse(x, y, rx, ry, 0, a0, a1); c.stroke(); } c.restore(); }
// A shadow as a dry ink wash: a faint wet middle and, over it, dry pulls of the brush that break and stop short, so the
// edge is ragged and paper shows through. The same seed every time, so it does not flicker from frame to frame.
function dryWash(c, x, y, rx, ry, a, rgb) {
  let seed = 7919; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.lineCap = 'butt';
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${rgb},${a * 0.5})`); g.addColorStop(0.7, `rgba(${rgb},${a * 0.22})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.setTransform(rx * 0.86, 0, 0, ry * 0.8, x, y); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.setTransform(1, 0, 0, 1, 0, 0);
  const rows = Math.max(7, Math.round(ry * 2 / Math.max(1.3, ry / 5)));
  for (let i = 0; i < rows; i++) { const v = -1 + (2 * (i + 0.5)) / rows, half = Math.sqrt(Math.max(0, 1 - v * v)) * rx * (0.82 + 0.3 * rnd()), yy = y + v * ry + (rnd() - 0.5) * ry * 0.12; let xx = x - half + (rnd() - 0.5) * rx * 0.25; const end = x + half + (rnd() - 0.5) * rx * 0.25;
    while (xx < end) { const len = rx * (0.12 + 0.5 * rnd()), x1 = Math.min(end, xx + len); c.strokeStyle = `rgba(${rgb},${a * (0.35 + 0.65 * rnd())})`; c.lineWidth = Math.max(1, (ry * 2 / rows) * (0.45 + 0.6 * rnd())); c.beginPath(); c.moveTo(xx, yy); c.lineTo(x1, yy + (rnd() - 0.5) * 1.2); c.stroke(); xx = x1 + rx * (0.03 + 0.2 * rnd() * rnd()); } }
  c.restore(); }
const statesOf = (P, variant) => (P.tiers && P.tiers[variant || 1]) || P.states;
const TRIM = 0.3;                                              // about how much of a puppet's box its frames fill, for the first estimate

export async function buildSprites(source, { dpr = 1, budgetMB = 40, onProgress = () => {}, shadowOf = () => null, sizeOf = () => 1, toneOf = () => null, core = () => true } = {}) {
  const t0 = performance.now(), { PUPPETS, createCutter } = source;
  // Only the kinds `core(key, variant)` names are cut at load; any other kind or tier is cut the first time it is asked for
  // (`ensure`), in a sheet of its own. The puppets hold far more kinds than one run shows, and all of them at once would
  // pass the memory budget many times.
  const jobs = []; for (const key in PUPPETS) { const P = PUPPETS[key]; if (P.tiers) { for (const tier in P.tiers) if (core(key, String(tier))) jobs.push([key, String(tier)]); } else if (core(key, '')) jobs.push([key, '']); }
  const areaOf = ([key, v]) => { const P = PUPPETS[key], s = P.scale * sizeOf(key), b = P.box; let n = 0; for (const st in statesOf(P, v)) n += statesOf(P, v)[st].length; return (b[2] - b[0]) * (b[3] - b[1]) * s * s * n; };
  const estimate = jobs.reduce((a, j) => a + areaOf(j), 0) * TRIM * 1.12 * 4 / 1048576;       // MB at density 1
  const CORE_SHARE = 0.82;                                       // of the budget: the rest is for what is cut later
  let res = Math.min(dpr, Math.sqrt(budgetMB * CORE_SHARE / estimate)), out = null, tries = 0;
  const probe = canvasOf(8, 8), pctx = probe.getContext('2d', { willReadFrequently: true });

  // cut one kind (one variant of it) into loose trimmed frames
  function cut(cutter, key, variant, res) {
    const P = PUPPETS[key], size = sizeOf(key), K = P.scale * size * res, [x0, y0, x1, y1] = P.box, cw = Math.ceil((x1 - x0) * K) + 4, ch = Math.ceil((y1 - y0) * K) + 4, gx = Math.round(-x0 * K) + 2, gy = Math.round(-y0 * K) + 2;
    const sc = canvasOf(cw, ch), c = sc.getContext('2d'), pw = Math.ceil(cw / PROBE), ph = Math.ceil(ch / PROBE), so = shadowOf(key, variant), sh = so === false ? null : so || (P.shadow && { rx: P.shadow[0], ry: P.shadow[1], a: P.shadow[2] }), list = [];   /* false: this variant takes no shadow (it stands on its own cloud) */
    if (probe.width < pw || probe.height < ph) { probe.width = Math.max(probe.width, pw); probe.height = Math.max(probe.height, ph); }
    const states = statesOf(P, variant);
    for (const st in states) for (let i = 0; i < states[st].length; i++) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, cw, ch);
      if (sh && !NOSHADOW[st] && sh.dry) dryWash(c, gx + (sh.dx || 0) * size * res, gy + res + (sh.dy || 0) * size * res, sh.rx * size * res, sh.ry * size * res, sh.a, sh.rgb);
      else if (sh && !NOSHADOW[st] && sh.ring) inkRing(c, gx + (sh.dx || 0) * size * res, gy + res + (sh.dy || 0) * size * res, sh.rx * size * res, sh.ry * size * res, sh.a, sh.ring, res);
      else if (sh && !NOSHADOW[st]) shadowAt(c, gx + (sh.dx || 0) * size * res, gy + res + (sh.dy || 0) * size * res, sh.rx * size * res, sh.ry * size * res, sh.a, sh.rgb, sh.hard);
      cutter.draw(c, key, st, i, gx, gy, { variant: variant || undefined }); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
      pctx.clearRect(0, 0, pw, ph); pctx.drawImage(sc, 0, 0, cw, ch, 0, 0, pw, ph); const d = pctx.getImageData(0, 0, pw, ph).data; let ax = pw, ay = ph, bx = -1, by = -1;
      for (let y = 0; y < ph; y++) for (let x = 0, o = y * pw * 4 + 3; x < pw; x++, o += 4) if (d[o]) { if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; }
      if (bx < 0) { ax = ay = 0; bx = by = 0; }
      const rx = Math.max(0, ax * PROBE - PROBE), ry = Math.max(0, ay * PROBE - PROBE), rw = Math.min(cw, (bx + 2) * PROBE) - rx, rh = Math.min(ch, (by + 2) * PROBE) - ry, f = canvasOf(rw, rh);
      const fc = f.getContext('2d'); fc.drawImage(sc, rx, ry, rw, rh, 0, 0, rw, rh); const tone = toneOf(key);
      if (tone) { const im = fc.getImageData(0, 0, f.width, f.height), p = im.data; for (let o = 0; o < p.length; o += 4) { if (!p[o + 3]) continue; const l = 0.2126 * p[o] + 0.7152 * p[o + 1] + 0.0722 * p[o + 2];
          if (tone.flat) { const q = tone.flat[l / 255 < tone.at ? 0 : 1]; p[o] = q[0]; p[o + 1] = q[1]; p[o + 2] = q[2]; }
          else { p[o] = (l + (p[o] - l) * tone.sat) * tone.mul; p[o + 1] = (l + (p[o + 1] - l) * tone.sat) * tone.mul; p[o + 2] = (l + (p[o + 2] - l) * tone.sat) * tone.mul; } } fc.putImageData(im, 0, 0); }   /* a kind cut duller and darker than its puppet (the mass) */ list.push({ key, variant, st, i, cv: f, w: rw, h: rh, px: gx - rx, py: gy - ry });
    }
    return list;
  }
  // pack loose frames on shelves into one sheet; multiply it into the paper; cut its flash sheet
  function pack(list, k) {
    const order = list.slice().sort((a, b) => b.h - a.h), area = order.reduce((a, f) => a + (f.w + PAD) * (f.h + PAD), 0), W = Math.min(4096, Math.max(256, Math.ceil(Math.sqrt(area * 1.06) / 64) * 64)); let x = PAD, y = PAD, row = 0;
    for (const f of order) { if (x + f.w + PAD > W) { x = PAD; y += row + PAD; row = 0; } f.x = x; f.y = y; x += f.w + PAD; row = Math.max(row, f.h); }
    const H = y + row + PAD, sheet = canvasOf(W, H), c = sheet.getContext('2d'); for (const f of order) c.drawImage(f.cv, f.x, f.y);
    const img = intoPaper(sheet), hero = list.length && list[0].key === 'hero', flash = null, edge = hero ? flashOf(img, '#B8321F') : null, sets = {};   /* the hero has no white flash: a cinnabar silhouette for the edge of a hit */
    for (const f of list) { const id = f.key + '|' + (f.variant || ''), S = sets[id] || (sets[id] = { img, flash, edge, k, frames: {}, side: PUPPETS[f.key].side }); (S.frames[f.st] || (S.frames[f.st] = []))[f.i] = [f.x, f.y, f.w, f.h, f.px, f.py]; }
    const by = {}; for (const f of list) by[f.key] = (by[f.key] || 0) + Math.round(f.w * f.h * 4 / 1024); return { sets, pixels: W * H * (1 + 1 / (FLASH * FLASH)), w: W, h: H, by };
  }
  // the cutter draws at the puppet's own scale times px; a kind shown larger (sizeOf) is cut by a cutter of a larger px
  const cutters = new Map(), cutterFor = (px) => { const id = px.toFixed(4); if (!cutters.has(id)) cutters.set(id, createCutter(px)); return cutters.get(id); };
  while (true) {
    cutters.clear(); const loose = [];
    for (let n = 0; n < jobs.length; n++) { const [key, v] = jobs[n]; loose.push(...cut(cutterFor(res * sizeOf(key)), key, v, res)); onProgress(n + 1, jobs.length + 1); if (n % 2 === 1) await new Promise((r) => setTimeout(r)); }
    const mine = loose.filter((f) => f.key === 'hero'), rest = loose.filter((f) => f.key !== 'hero'); out = pack(rest, 1 / res); out.count = loose.length;
    if (mine.length) { const o = pack(mine, 1 / res); for (const id in o.sets) { out.sets[id] = o.sets[id]; o.sets[id].lazy = 'hero'; o.sets[id].mb = o.pixels * 4 / 1048576; } out.pixels += o.pixels; Object.assign(out.by, o.by); out.hero = [o.w, o.h]; }   // the hero has a sheet to himself: a new resonance replaces it
    const mb = out.pixels * 4 / 1048576; if (mb <= budgetMB * CORE_SHARE * 1.04 || ++tries > 2) break;
    res *= Math.sqrt(budgetMB * CORE_SHARE / mb) * 0.98;                                                   // over the budget: cut everything again, smaller
  }
  onProgress(jobs.length + 1, jobs.length + 1);
  const sets = out.sets, extra = { pixels: 0, sheets: 0 }, stats = { ms: +(performance.now() - t0).toFixed(1), frames: out.count, megabytes: +(out.pixels * 4 / 1048576).toFixed(1), atlas: [out.w, out.h], heroSheet: out.hero, resolution: +res.toFixed(3), kbByKind: out.by, dpr, budgetMB, passes: tries + 1, estimateMB: +(estimate * res * res).toFixed(1) };
  let live = out.pixels * 4 / 1048576, frame = 0;
  return {
    stats, sets,
    get(key, variant) { const S = sets[key + '|' + (variant || '')]; if (S) S.used = frame; return S || null; },
    /** Cut a kind, tier or variant that was not cut at load, in a sheet of its own. Several variants of one kind live side
     *  by side (men of a squad at different ranks, a general and his true form). The hero's old variant is dropped at once
     *  (it is the largest sheet); anything else is dropped only when the budget is passed, the longest unused first.
     *  Call `touch()` once a frame so "unused" can be told. Once the budget is nearly spent, new cuts are made smaller. */
    ensure(key, variant) { const id = key + '|' + (variant || ''); if (sets[id]) return sets[id]; if (!PUPPETS[key]) return null; const t = performance.now();
      if (key === 'hero') for (const old in sets) if (sets[old].lazy === key) { live -= sets[old].mb || 0; delete sets[old]; }
      if (live > budgetMB) { const olds = Object.keys(sets).filter((o) => sets[o].lazy && sets[o].lazy !== 'hero' && frame - (sets[o].used || 0) > 240).sort((p, q) => (sets[p].used || 0) - (sets[q].used || 0));
        for (const o of olds) { if (live <= budgetMB * 0.9) break; live -= sets[o].mb || 0; delete sets[o]; stats.evicted = (stats.evicted || 0) + 1; } }
      const r = live > budgetMB ? res * 0.6 : live > budgetMB * 0.85 ? res * 0.8 : res, o = pack(cut(cutterFor(r * sizeOf(key)), key, variant, r), 1 / r), S = o.sets[id]; if (!S) return null;
      S.lazy = key; S.mb = o.pixels * 4 / 1048576; S.used = frame; live += S.mb; sets[id] = S; const ms = performance.now() - t;
      stats.megabytes = +live.toFixed(1); stats.lazyCuts = (stats.lazyCuts || 0) + 1; stats.lazyMs = +ms.toFixed(1); stats.lazyMaxMs = Math.max(stats.lazyMaxMs || 0, +ms.toFixed(1)); stats.lazyMB = +S.mb.toFixed(1); return S; },
    /** once a frame: what is asked for after this counts as used in this frame */
    touch() { frame++; },
  };
}
