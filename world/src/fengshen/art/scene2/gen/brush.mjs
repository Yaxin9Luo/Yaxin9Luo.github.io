// The hand: what the brush knows how to draw. Every function takes the layer, a place, and a chance (seeded), and no
// two calls make the same thing. Light is on the upper left for the whole picture; the wind blows to the left.
// Coordinates are design units (one world pixel); the ground line is y = GY.
import {chance, fbm, vnoise, clamp, smooth} from './ink.mjs';
export const GY = 1000;

/* ---------- rock, in axe-cut strokes (斧劈皴) ---------- */
// a ridge through hand-set points: straight runs, corners a little worn, then small steps
export function ridgeOf(pts, seed, crag = 5) {
  const lin = x => {
    if (x <= pts[0][0]) return pts[0][1] + (pts[0][0] - x) * .35;
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) }
    const l = pts[pts.length - 1]; return l[1] + (x - l[0]) * .35;
  };
  return x => (lin(x - 5) + 2 * lin(x) + lin(x + 5)) / 4 - Math.abs(fbm(x * .035 + seed, 5, 3) - .5) * 2 * crag - (vnoise(x * .16 + seed, 8) - .5) * crag * .35;
}
export const slope = (rf, x, d = 7) => (rf(x + d) - rf(x - d)) / (2 * d);        // > 0: the ground falls to the right (shaded)

// A mass is BUILT from strokes, not shaded. In order: an ochre ground (warm, under everything); a pale ink tone lost at
// the foot; azurite laid in facets on the crests and malachite on the shoulders under them; the shaded faces in one wet
// tone; then, at every corner of the ridge that turns over into shade, a spine with side-brush slashes pulled from it
// (their starts make the one hard edge, their tails run dry); the skyline, pressed on the shaded side and broken on the
// lit side; clefts in burnt ink. The ink goes on after the colour, so the line runs through it.
// tone scales every ink load, so a far mass is the same drawing in paler ink. k scales the size of the marks.
export function rock(L, pts, o) {
  const {seed = 1, foot = 1e9, tone = 1, fade = 200, x0 = pts[0][0] - 40, x1 = pts[pts.length - 1][0] + 40, lost = 'left', k = 1, och = 0, azu = 0, mal = 0, trees = 0, accent = 1, inner = [], fl = lost === 'left' ? 170 : 60, fr = lost === 'left' ? 60 : 170} = o;
  const C = chance(Math.round(seed * 131)), rf = ridgeOf(pts, seed, o.crag ?? 4);
  // nothing hangs from a ridge that has already come down to the foot (no wash leaks into the mist under the mass)
  const feather = x => smooth(x0, x0 + fl, x) * (1 - smooth(x1 - fr, x1, x)) * (1 - smooth(foot - 34, foot - 4, rf(x)));
  // the body: paper kept for the mass, so that it hides what is behind it and is lost at the foot like the wash
  if (o.body) L.mountain(rf, {pig: 'white', dens: o.body * 1.5, fade: fade * .82, fadeVar: .5, pow: .5, edge: 0, blotch: .2, tide: 0, gran: 0, x0, x1, floor: foot + 16, feather: 1, mod: feather, seed});
  // 0. the ochre ground: strongest on the lit faces, thin, grainy
  if (och) L.mountain(rf, {dens: och, fade: fade * .8, fadeVar: .7, pow: 1.5, edge: 0, pig: 'och', blotch: .8, tide: .5, gran: 1.0, x0, x1, floor: foot + 16, feather: 1, mod: x => feather(x) * (1 - .45 * smooth(.1, .6, slope(rf, x, 9))), seed: seed + 3});
  // 1. the ground tone (清): thin, gone before the foot
  L.mountain(rf, {dens: .075 * tone, fade, fadeVar: .6, pow: 1.4, edge: .3, edgeW: 1.4, blotch: .4, tide: .3, x0, x1, floor: foot + 16, feather: 1, mod: feather, seed});
  // 1b. mineral colour: facets, never a gradient. Azurite straddles each crest and runs down its shaded side; malachite
  // lies on the shoulders below and to the lit side. Coarse pigment: grainy, with dry tails.
  if (azu || mal) {
    const crests = (o.crests || []).map(c => [...c]);
    for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] <= pts[i - 1][1] && pts[i][1] < pts[i + 1][1] && pts[i][1] < foot - 60) crests.push([pts[i][0], 1]);
    for (const [px, big = 1] of crests) {
      const f = feather(px); if (f < .3) continue;
      // the same hand as the ink slashes: short side-brush cuts, dry at the tail, grainy; a few, unequal, with paper between
      const na = azu ? 2 + Math.floor(C.R(0, 2.2) * big) : 0;
      for (let j = 0; j < na; j++) {
        const xs = px + (C.R(-8, 4) + j * C.R(9, 20)) * k, ys = rf(xs) + C.R(1, 4), len = Math.min(foot - ys - 20, C.R(30, 84) * k * big * (1 - .15 * j)), w = C.R(4, 10) * k, dx = C.R(.2, .7);
        if (len < 10) continue;
        L.stroke([[xs, ys, w * .6], [xs + dx * len * .35, ys + len * .35, w], [xs + dx * len * .75, ys + len * .75, w * .7], [xs + dx * len, ys + len, w * .1]],
          {pig: 'azu', load: azu * C.R(.7, 1.15) * f * (j ? .8 : 1), load1: azu * .3 * f, dry: C.R(.12, .3), dry1: C.R(.75, .93), dryPow: C.R(.7, 1.1), side: -.7, streak: .9, rag: .3, gran: 1.5, pool: .3, soft: .08});
      }
      const nm = mal ? 1 + Math.floor(C.R(0, 2.4) * big) : 0;
      for (let j = 0; j < nm; j++) {
        const left = C.rnd() < .7, xs = px + (left ? -C.R(12, 60) : C.R(26, 70)) * k * big, ys = rf(xs) + C.R(5, 18) * k + (left ? 0 : C.R(50, 100) * k), len = Math.min(foot - ys - 14, C.R(24, 66) * k * big), w = C.R(4, 10) * k, dx = left ? -C.R(.4, 1.1) : C.R(.2, .6);
        if (len < 10) continue;
        L.stroke([[xs, ys, w * .5], [xs + dx * len * .4, ys + len * .32, w], [xs + dx * len * .8, ys + len * .7, w * .7], [xs + dx * len, ys + len * .9, w * .1]],
          {pig: 'mal', load: mal * C.R(.65, 1.2) * f, load1: mal * .3 * f, dry: C.R(.15, .3), dry1: C.R(.75, .93), side: left ? .6 : -.6, streak: .9, rag: .3, gran: 1.5, pool: .25, soft: .08});
      }
    }
  }
  // 2. the shaded faces, one wet tone (淡) under everything that follows, with a hard top under the ridge
  L.mountain(rf, {dens: .1 * tone, fade: fade * .55, fadeVar: .7, pow: 1.1, edge: 1.1, edgeW: 1.6, blotch: .5, tide: .5, x0, x1, floor: foot + 16, feather: 1, mod: x => feather(x) * smooth(.15, .6, slope(rf, x, 9)), seed: seed + 2});
  // 3. spines and their slashes (重)
  const slash = (xs, ys, len, w, load, dry1, dx = C.R(.2, 1.0)) => { const bend = C.R(-.12, .12) * len; if (len < 6) return;
    L.stroke([[xs, ys, w * .6], [xs + dx * len * .3 + bend * .3, ys + len * .3, w], [xs + dx * len * .7 + bend, ys + len * .7, w * .78], [xs + dx * len, ys + len, w * .12]],
      {load, load1: load * .45, dry: C.R(.08, .22), dry1, dryPow: C.R(.8, 1.2), side: -.8, pool: .28, streak: .9, rag: .28, soft: .08}) };
  const spines = inner.map(([x, y, len, tk = .7]) => [x, y, len, tk]);
  for (let i = 1; i < pts.length - 1; i++) { const [px, py] = pts[i], sa = (py - pts[i - 1][1]) / (px - pts[i - 1][0]), sb = (pts[i + 1][1] - py) / (pts[i + 1][0] - px);
    if (sb > .45 && sb - sa > .5 && py < foot - 30) spines.push([px, rf(px), (foot - py) * C.R(.5, .8), 1]) }
  for (const [px, top, len, tk] of spines) {
    const f = feather(px); if (f < .25) continue;
    const lean = C.R(-.2, .04);
    // Slashes come in clusters along the break, two to four at a time, each cluster with its own angle; between
    // clusters the rock face is left bare. No two neighbours share a length.
    let t = C.R(0, .06);
    while (t < .92) {
      const n = 2 + Math.floor(C.R(0, 2.6)), ang = C.R(.2, 1.0), big = C.R(.6, 1.25);
      for (let j = 0; j < n && t < .95; j++) {
        const xs = px + 1 + lean * len * t + C.R(-2, 2), ys = top + 3 + len * t;
        slash(xs, ys, Math.min(foot - ys, C.R(16, 100) * k * big * (1 - .4 * t)), C.R(5, 19) * k * (1 - .3 * t), tone * tk * (.34 - .14 * t) * C.R(.65, 1.2) * f, C.R(.7, .93), ang + C.R(-.14, .14));
        t += C.R(5, 13) * k / len;
      }
      t += C.R(.1, .3);                                                                   // a bare face
    }
    // the spine itself: one pressed line, lifted two thirds of the way down
    L.stroke([[px, top + 1, 1.5 * k], [px + lean * len * .3, top + len * .3, 2.1 * k], [px + lean * len * .66, top + len * .66, .5 * k]], {load: tone * tk * .5 * f, dry: .05, dry1: .7, streak: .5, rag: .2, pool: .2});
    // a cleft or two in burnt ink (焦): short, thin, the darkest marks on the mass
    for (let j = 0; j < Math.round(C.R(.6, 2.2) * accent * tk); j++) { const t = C.R(.08, .5), xs = px + 4 + lean * len * t + C.R(2, 16) * k, ys = top + 6 + len * t, l = C.R(10, 24) * k;
      L.stroke([[xs, ys, .5], [xs + l * .25, ys + l * .5, C.R(1, 1.8) * k], [xs + l * .5, ys + l, .3]], {load: tone * .95 * f, dry: 0, dry1: .5, pool: .1, streak: .3, rag: .15}) }
  }
  // 4. the skyline: cuts hanging from the shaded slopes; a pressed line there, a thin broken one on the lit side
  let x = x0 + 30;
  while (x < x1 - 20) {
    const g = slope(rf, x), f = feather(x);
    if (g > .35 && f > .2 && rf(x) < foot - 30) { if (C.rnd() < .55) slash(x + C.R(-5, 5), rf(x) + C.R(1, 4), Math.min(foot - rf(x), C.R(16, 64) * k), C.R(5, 12) * k, tone * .22 * C.R(.7, 1.15) * f, C.R(.75, .92)); x += C.R(14, 44) / k }
    else if (g < -.2 && f > .3 && C.rnd() < .5 && rf(x) < foot - 24) { const xs = x, ys = rf(xs) + C.R(5, 16), len = C.R(24, 60) * k, w = C.R(1.2, 3) * k, dx = -C.R(.5, .9), dy = Math.min(1.1, -g * C.R(.7, 1.1) + .25);
      L.stroke([[xs, ys, w * .4], [xs + dx * len * .5, ys + dy * len * .5, w], [xs + dx * len, ys + dy * len, w * .2]], {load: tone * .16 * f, dry: C.R(.4, .55), dry1: C.R(.8, .93), streak: .8, rag: .3, pool: 0}); x += C.R(40, 100) / k }
    else x += C.R(22, 50);
  }
  x = x0 + C.R(10, 40);
  while (x < x1 - 10) {
    const g = slope(rf, x, 12), dark = g > .15, len = dark ? C.R(50, 120) : C.R(24, 70), p = [];
    for (let u = 0; u <= len; u += 6) { const xx = x + u, t = u / len, gg = Math.abs(slope(rf, xx, 4)); p.push([xx, rf(xx) + .6, (dark ? 1.6 : .8) * k * (.35 + .9 * Math.min(1, gg)) * (.4 + .9 * Math.sin(Math.PI * Math.min(1, t * 1.2 + .05)))]) }
    const f = feather(x + len / 2);
    if (p.length > 2 && f > .25 && rf(x + len / 2) < foot) L.stroke(p, {load: tone * (dark ? .42 : .2) * C.R(.75, 1.15) * f, dry: dark ? C.R(0, .2) : C.R(.3, .5), dry1: dark ? C.R(.4, .7) : C.R(.75, .92), streak: .5, rag: .2, pool: dark ? .2 : 0});
    x += len + (dark ? C.R(4, 26) : C.R(30, 110));
  }
  // 5. trees on the shoulders: a few wet dots of burnt ink, in small groups
  for (let g = 0; g < trees; g++) { const cx = C.R(x0 + fl * .6, x1 - fr * .6), n = 2 + Math.floor(C.R(0, 3)); if (rf(cx) > foot - 20) continue;
    for (let i = 0; i < n + 2; i++) { const xx = cx + C.gauss() * 11 * k, yy = rf(xx) + C.R(0, 2), h = C.R(4, 9) * k; L.stroke([[xx, yy, .5], [xx + C.R(-.6, .6), yy - h * .5, C.R(1.1, 1.9) * k], [xx + C.R(-1, 1), yy - h, .3]], {load: tone * .9 * feather(xx), streak: .3, pool: .2, dry1: .3}) } }
  return rf;
}

// a range a long way off: one wet wash with a soft top, a breath of azurite, and no line but where a shaded slope turns
export function ghost(L, pts, o) {
  const {seed = 1, dens = .07, azu = 0, och = 0, fade = 160, x0 = pts[0][0], x1 = pts[pts.length - 1][0], feather = 140, line = .12} = o;
  const C = chance(Math.round(seed * 977)), rf = ridgeOf(pts, seed, o.crag ?? 3);
  if (och) L.mountain(rf, {dens: och, fade: fade * .9, edge: 0, pig: 'och', blotch: .6, x0, x1, feather, seed: seed + 2});
  L.mountain(rf, {dens, fade, pow: 1.15, edge: .55, edgeW: 2.2, blotch: .3, tide: .25, x0, x1, feather, seed});
  L.mountain(rf, {dens: dens * .8, fade: fade * .5, pow: 1, edge: .8, edgeW: 2, blotch: .5, tide: 0, x0, x1, feather, seed: seed + 4, mod: x => smooth(.1, .5, slope(rf, x, 12))});   // the shaded slopes, one tone darker
  if (azu) L.mountain(rf, {dens: azu, fade: fade * .6, edge: .2, edgeW: 3, pig: 'azu', blotch: .6, gran: .9, x0, x1, feather, seed: seed + 1});
  let x = x0 + feather * .6;
  while (line && x < x1 - feather * .6) { const len = C.R(30, 90);
    if (slope(rf, x + len / 2, 10) > .2) { const p = []; for (let u = 0; u <= len; u += 8) p.push([x + u, rf(x + u) + .8, 1.1 * (.4 + .8 * Math.sin(Math.PI * Math.min(1, u / len * 1.1 + .05)))]); L.stroke(p, {load: line * C.R(.7, 1.2), dry: .2, dry1: .8, streak: .5, rag: .2, pool: 0})
      if (C.rnd() < .6) { const l = C.R(14, 40), xs = x + len * .3; L.stroke([[xs, rf(xs) + 3, 2], [xs + l * .3, rf(xs) + l * .5, 4], [xs + l * .5, rf(xs) + l, .6]], {load: line * .7, dry: .2, dry1: .9, streak: .9, rag: .3, side: -.7}) } }
    x += len + C.R(20, 90) }
  return rf;
}

// mist that cuts a mass: water lifted through the wash in a long lobe, soft everywhere
export const cutMist = (L, x, y, rx, ry, d = .85) => L.blot(x, y, rx, ry, {pig: 'lift', dens: d, rim: 0, soft: .9, rough: .35, freq: .008, gran: 0});

/* ---------- trees ---------- */
// A pine as the hand draws one: a trunk that bends twice and thins, pressed on its shaded side; boughs that reach
// further down wind (left) and hang a little; on each bough fans of needles (攒针): strokes thrown up and out from one
// point over a wet dab, so a bough is dark below and bristles above. A small pine is flat dabs only.
function fan(L, cx, cy, r, tilt, load, C) {
  L.blot(cx, cy - r * .22, r * 1.0, r * .46, {dens: load * .42, rim: .35, soft: .4, rough: .45, freq: .06});
  for (let i = 0, n = 7 + Math.floor(C.R(0, 5)); i < n; i++) { const a = tilt + (i / (n - 1) - .5) * C.R(2.3, 2.9) + C.R(-.1, .1), len = r * C.R(.7, 1.2);
    L.stroke([[cx + C.R(-1.5, 1.5), cy, C.R(.7, 1.1)], [cx + Math.sin(a) * len * .55, cy - Math.cos(a) * len * .55, .7], [cx + Math.sin(a) * len, cy - Math.cos(a) * len, .12]], {load: load * C.R(.8, 1.25), dry: 0, dry1: C.R(.2, .5), pool: 0, rag: .1, streak: .3}) }
}
export function pine(L, x, y, h, C, o = {}) {
  if (h < 46) return pineFar(L, x, y, h, C, (o.load ?? .8) * .85);
  const load = o.load ?? .8, lean = o.lean ?? C.R(-.34, .12), b1 = C.R(-.1, .1), b2 = C.R(-.06, .06), tw = Math.max(1.2, h * .034 * (o.thick ?? 1));
  const tx = t => x + lean * h * t + b1 * h * Math.sin(t * Math.PI * 1.2) + b2 * h * Math.sin(t * Math.PI * 2.6), ty = t => y - h * t;
  const P = []; for (let i = 0; i <= 6; i++) { const t = i / 6; P.push([tx(t), ty(t), tw * (1.3 - 1.0 * t)]) }
  L.stroke(P, {load: load * .92, dry: .1, dry1: .5, side: .7, streak: .7, rag: .22, pool: .1});
  L.stroke([[P[0][0] - tw * 2.6, P[0][1] + tw * .5, tw * .35], [P[0][0] - tw * .7, P[0][1] - tw, tw * .8], [tx(.1), ty(.1), tw * .45]], {load: load * .8, dry1: .4, pool: 0});
  for (let i = 0, n = 2 + Math.floor(h / 40); i < n; i++) { const t = C.R(.08, .5); L.stroke([[tx(t) + tw * .2, ty(t), .5], [tx(t) + tw * .5, ty(t) - 3, 1], [tx(t) + tw * .3, ty(t) - 6, .3]], {load, pool: 0}) }   // bark
  const n = o.tiers ?? 3 + Math.floor(C.R(0, 2.6)); let side = C.rnd() < .7 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const t = .46 + .5 * (i + C.R(.15, .6)) / n, bx = tx(t), by = ty(t);
    const reach = h * (.5 - .3 * t) * C.R(.75, 1.3) * (side < 0 ? 1.3 : .8), droop = C.R(-.05, .22) * reach;
    L.stroke([[bx, by, tw * .5], [bx + side * reach * .5, by - reach * .14 + droop * .2, tw * .36], [bx + side * reach, by + droop - reach * .05, tw * .12]], {load: load * .9, dry1: .5, pool: 0, rag: .15});
    const m = 2 + Math.floor(C.R(0, 2.2));
    for (let j = 0; j < m; j++) { const u = (j + C.R(.3, .9)) / m; fan(L, bx + side * reach * (.25 + .85 * u), by - reach * .14 * (1 - u) + droop * u - 1, h * C.R(.1, .16), side * C.R(.1, .5), load, C) }
    side = C.rnd() < .75 ? -side : side;
  }
  fan(L, tx(1) - h * .03, ty(1) + 2, h * C.R(.12, .17), -.3, load * 1.05, C); fan(L, tx(.9) + h * C.R(.04, .1), ty(.9) + 3, h * .1, .4, load, C);
}
// a far pine: a leaning trunk and a few flat dabs
export function pineFar(L, x, y, h, C, load = .6) {
  const lean = C.R(-.2, .1);
  L.stroke([[x, y, 1.1], [x + lean * h * .5, y - h * .5, .8], [x + lean * h, y - h, .35]], {load: load * 1.1, rag: .1, pool: 0});
  const n = 3 + Math.floor(C.R(0, 2.2));
  for (let i = 0; i < n; i++) { const t = (i + .6) / n, yy = y - h * (.3 + .7 * t), w = h * (.36 - .22 * t) * C.R(.75, 1.35), cx = x + lean * h * (.3 + .7 * t) + C.R(-3, 1); L.stroke([[cx - w * 1.2, yy + C.R(0, 2), .5], [cx + C.R(-1, 1), yy - 1, C.R(1.4, 2.6)], [cx + w * .8, yy + C.R(0, 2.5), .4]], {load: load * C.R(.75, 1.25), streak: .4, dry1: .35, pool: .2}) }
}
// A bare tree with crab-claw twigs (蟹爪): each limb one pull that thins, forks unequally, and ends in hooked claws.
export function bare(L, x, y, h, C, o = {}) {
  const load = o.load ?? .8, maxD = o.depth ?? 3;
  const limb = (x, y, a, len, w, d) => {
    const n = 4, pts = [[x, y, w]], mids = []; let cx = x, cy = y;
    for (let i = 1; i <= n; i++) { a += C.R(-.3, .3) - .05 * Math.sign(a) * (d ? 1 : 0); cx += Math.sin(a) * len / n; cy -= Math.cos(a) * len / n; pts.push([cx, cy, w * (1 - .78 * i / n) + .15]); mids.push([cx, cy, a]) }
    L.stroke(pts, {load: load * (1 - .06 * d), dry: .08, dry1: C.R(.4, .7), streak: .55, rag: .22, pool: .05, side: .5});
    if (d < maxD) { const k = 2 + (C.rnd() < .45 ? 1 : 0); let s = C.rnd() < .5 ? 1 : -1;
      for (let j = 0; j < k; j++) { const m = mids[Math.min(n - 1, 1 + Math.floor(C.R(0, n - 1)))]; limb(m[0], m[1], m[2] + s * C.R(.45, 1.15) - .12, len * C.R(.42, .72), Math.max(.5, w * C.R(.45, .62)), d + 1); s = -s } }
    else for (let j = 0, k = 2 + Math.floor(C.R(0, 2)); j < k; j++) { const m = mids[n - 1 - (j % 2)], s = j % 2 ? 1 : -1, l = len * C.R(.3, .55), a2 = m[2] + s * C.R(.5, 1.2);
      L.stroke([[m[0], m[1], .7], [m[0] + Math.sin(a2) * l * .6, m[1] - Math.cos(a2) * l * .5, .55], [m[0] + Math.sin(a2) * l - s * 0, m[1] - Math.cos(a2) * l * .45 + l * .32, .15]], {load: load * .85, dry1: .5, pool: 0, rag: .1}) }
  };
  limb(x, y, o.lean ?? C.R(-.25, .1), h * .52, Math.max(1.2, h * .034), 0);
  L.stroke([[x - h * .06, y + 1, .5], [x - h * .012, y - h * .03, h * .02], [x + h * .01, y - h * .09, .4]], {load: load * .8, dry1: .4, pool: 0});
}
// a reed or grass leaf, as orchid leaves are drawn: thin, swelling, thin, bowed by its own weight; some break and hang
export function leaf(L, x, y, h, lean, C, o = {}) {
  const w = C.R(1.7, 3.3) * (o.w || 1), bow = C.R(.15, .5) * (lean >= 0 ? 1 : -1), hang = C.R(0, 1) < .22;
  const tip = hang ? [x + lean * h * .8 + bow * h * .7, y - h * C.R(.45, .62)] : [x + lean * h + bow * h * .5, y - h * C.R(.88, 1)];
  L.stroke([[x, y, w * .45], [x + lean * h * .3, y - h * .46, w], [x + lean * h * .62 + bow * h * .16, y - h * .84, w * .6], [...tip, .12]], {load: (o.load || 2) * C.R(.75, 1.15), dry: 0, dry1: C.R(.25, .7), dryPow: 2, streak: .55, rag: .1, pool: .1, side: C.R(-.3, .3)});
}
// a reed with its plume: a thin stalk, bowed down wind, and a soft dry head
export function reed(L, x, y, h, C, o = {}) {
  const lean = -C.R(.08, .4), load = o.load ?? 1;
  L.stroke([[x, y, 1.1], [x + lean * h * .4, y - h * .55, .9], [x + lean * h, y - h, .4]], {load: load * .9, dry1: .4, pool: 0, rag: .1});
  const hx = x + lean * h, hy = y - h, l = h * C.R(.16, .28);
  L.stroke([[hx, hy, .6], [hx - l * .5, hy - l * .25, C.R(1.8, 3.2)], [hx - l, hy + l * .2, .3]], {load: load * .6, dry: .35, dry1: .8, streak: .8, rag: .5, pool: 0});
}
// a dry horizontal pull: ground, water, a far shore. Never ruled: it tilts, swells and runs out.
export function drag(L, x, y, len, w, load, C, o = {}) {
  const tilt = C.R(-.02, .03) * len * (o.tilt ?? 1);
  return L.stroke([[x, y + C.R(-1, 1), w * .3], [x + len * C.R(.3, .45), y + tilt * .4 + C.R(-1.5, 1.5), w], [x + len * .8, y + tilt * .8 + C.R(-1, 2), w * .6], [x + len, y + tilt + C.R(-1, 2), w * .15]],
    {load, dry: o.dry ?? .42, dry1: C.R(.78, .93), dryPow: C.R(.7, 1.1), streak: .8, rag: .32, pool: 0, pig: o.pig || 'ink'});
}
