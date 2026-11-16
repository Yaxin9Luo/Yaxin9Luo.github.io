/*
 * The painter's board (from lab/html-in-canvas/05-impasto): oil paint and layers. A module for its side
 * effect; it expects window.SITE (landing.js's `site`), HIC, HAND, NAMEPAINT and, for the effect, PaintSim.
 *
 * 05 · Impasto: oil paint and layers.
 *
 * The page is 04's stack of four sheets (ground, text, research map, annotations) in a cool white palette, and
 * three things are painted:
 *
 *   the name      thick oil paint. The glyph coverage gives a direction field (structure tensor: which way each
 *                 stem runs); bristle streaks are noise smeared along that field; from them a colour layer and a
 *                 thickness layer are painted ONCE per picture, and each frame only re-lights them.
 *   the curve     one loaded brush stroke. A ribbon along the map's path is drawn once into a texture that holds
 *                 "how far along" and "how far across"; the bristles, the dry end and the draw-on come from those.
 *   the paint     thick oil paint on the ground sheet (a height field with a colour). A press lays a loaded dab, a
 *                 drag pulls it out as a brush stroke; nothing flows by itself. It is lit as impasto by the lamp.
 *
 * Lengths are CSS px. Stack space: origin at the window's centre, x right, y down, z towards the viewer.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const els = { ground: $('ground'), text: $('text'), map: $('mapl'), notes: $('notes') };
const button = document.querySelector('.xbtn');
const tags = [...document.querySelectorAll('.tags div')];
const STILL = !!window.__boardStill || matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash.slice(1).split(/[&,]/).includes('still');

/* ---------------------------------------------------------------- pose (as in 04) */
const DEG = Math.PI / 180;
const EYE = 1400;
const GAP_REST = 7, GAP_OPEN = 128;
const OPEN = { yaw: 30 * DEG, pitch: 11 * DEG, scale: .7 };
const TILT = { yaw: 3.4 * DEG, pitch: 2.6 * DEG };
const LIGHT = [.34, .52];
const SHEET_RADIUS = 16;
const pose = { e: 0, ev: 0, target: 0, px: 0, py: 0, yaw: 0, pitch: 0, scale: 1, tx: 0, ty: 0, gap: GAP_REST, R: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
// a section sheet (4 and up) lies flat on the board at rest and lifts clear of the stack when it is opened up
const zOf = i => i >= 4 ? 3 * (pose.gap - GAP_REST) + 2 : (i - 1) * pose.gap;

function updatePose(app) {
  const dt = app.dt, ptr = app.ptr, view = app.view;
  if (app.reduced) { pose.e = pose.target; pose.ev = 0; }
  else {
    const w = 8.6, z = .86;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      pose.ev += (w * w * (pose.target - pose.e) - 2 * z * w * pose.ev) * h;
      pose.e += pose.ev * h;
    }
    if (Math.abs(pose.target - pose.e) < 1e-4 && Math.abs(pose.ev) < 1e-3) { pose.e = pose.target; pose.ev = 0; }   // the spring arrives
  }
  let wantX = 0, wantY = 0;
  if (!app.reduced && ptr.in) { wantX = HIC.clamp(ptr.x / view.W * 2 - 1, -1, 1); wantY = HIC.clamp(ptr.y / view.H * 2 - 1, -1, 1); }
  if (current) { wantX *= .2; wantY *= .2; }   // a sheet being read holds almost still
  if (!ptr.down) {
    const k = 1 - Math.exp(-dt * 5);
    pose.px += (wantX - pose.px) * k;
    pose.py += (wantY - pose.py) * k;
    if (Math.abs(wantX - pose.px) < 4e-4 && Math.abs(wantY - pose.py) < 4e-4) { pose.px = wantX; pose.py = wantY; }
  }
  solvePose(view);
}
// the stack's rotation, gap, scale and shift for pose.e, pose.px and pose.py
function solvePose(view) {
  const e = pose.e, ease = HIC.smooth(0, 1, e);
  pose.yaw = HIC.mix(pose.px * TILT.yaw, OPEN.yaw + pose.px * 3 * DEG, e);
  pose.pitch = HIC.mix(-pose.py * TILT.pitch, OPEN.pitch - pose.py * 2 * DEG, e);
  pose.gap = HIC.mix(GAP_REST, GAP_OPEN * Math.min(view.W / 1440, view.H / 900), e);
  const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  pose.R = [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
  pose.tx = pose.ty = 0;
  pose.scale = 1;
  if (ease > 0) {
    const room = [170, 26, view.W - 30, view.H - 64];
    let scale = OPEN.scale, box = null;
    for (let pass = 0; pass < 3; pass++) {
      pose.scale = scale;
      box = [1e9, 1e9, -1e9, -1e9];
      for (const i of [0, 3]) for (const [u, v] of [[0, 0], [view.W, 0], [0, view.H], [view.W, view.H]]) {
        const q = project({ view }, i, u, v);
        box = [Math.min(box[0], q[0]), Math.min(box[1], q[1]), Math.max(box[2], q[0]), Math.max(box[3], q[1])];
      }
      const over = Math.max((box[2] - box[0]) / (room[2] - room[0]), (box[3] - box[1]) / (room[3] - room[1]));
      if (over <= 1) break;
      scale /= over * 1.01;
    }
    pose.scale = HIC.mix(1, scale, ease);
    pose.tx = ((room[0] + room[2]) / 2 - (box[0] + box[2]) / 2) * ease;
    pose.ty = ((room[1] + room[3]) / 2 - (box[1] + box[3]) / 2) * ease;
  }
}
// In the opened stack the text sheet floats above the ground: seen from the camera, a thing on it at (x, y) covers
// the ground at (x, y) + this. For placing what is painted on the ground so that a button does not hide it.
function openShift(x, y) {
  const view = { W: innerWidth, H: innerHeight }, keep = { e: pose.e, px: pose.px, py: pose.py };
  Object.assign(pose, { e: 1, px: 0, py: 0 });
  solvePose(view);
  const q = project({ view }, 1, x, y), g0 = toSheet({ view }, 0, q[0], q[1]) || [x, y];
  Object.assign(pose, keep);
  solvePose(view);
  return [g0[0] - x, g0[1] - y];
}
function project(app, i, u, v) {
  const { W, H } = app.view, R = pose.R, s = pose.scale, z = zOf(i);
  const lx = u - W / 2, ly = v - H / 2;
  const X = s * (R[0] * lx + R[1] * ly + R[2] * z) + pose.tx;
  const Y = s * (R[3] * lx + R[4] * ly + R[5] * z) + pose.ty;
  const Z = s * (R[6] * lx + R[7] * ly + R[8] * z);
  const w = (EYE - Z) / EYE;
  return [W / 2 + X / w, H / 2 + Y / w];
}
function toSheet(app, i, x, y) {
  const { W, H } = app.view, R = pose.R, s = pose.scale, z = zOf(i), d = EYE;
  const a = x - W / 2, b = y - H / 2;
  const m00 = s * (R[0] * d + a * R[6]), m01 = s * (R[1] * d + a * R[7]);
  const m10 = s * (R[3] * d + b * R[6]), m11 = s * (R[4] * d + b * R[7]);
  const r0 = a * d - pose.tx * d - z * s * (R[2] * d + a * R[8]);
  const r1 = b * d - pose.ty * d - z * s * (R[5] * d + b * R[8]);
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-6) return null;
  return [(r0 * m11 - r1 * m01) / det + W / 2, (m00 * r1 - m10 * r0) / det + H / 2];
}

// the section sheets' state (the sheets themselves are further down)
const SHEET_REST = -.45 * DEG;
const EXTERNAL = !!SECTIONS.external;   // the site's own panel is the sheet: ui.js opens, fills and closes it
const sheets = SECTIONS.ids.map((id, k) => ({ id, el: SECTIONS.el ? SECTIONS.el(id) : $('sheet-' + id), index: 4 + k, open: false, t: 0, v: 0, lang: '', c: [0, 0], angle: SHEET_REST, swap: false }));
let current = null;        // the open sheet
const sheetOf = el => sheets.find(sheet => sheet.el.contains(el)) || null;

/* ---------------------------------------------------------------- the page, in three mounts that share a language */
const emptyRow = '<div></div>';
const langNow = () => textSite ? textSite.lang : window.__boardLang === 'zh' ? 'zh' : 'en';
let groundSite = null, mapSite = null, textSite = null, app = null;
let boxes = { text: [], map: [] };
// what the shaders need to know about the layout, in sheet px
const lay = { ridge: new Float32Array(48).fill(-1), slots: [], nameSize: 86, strokeCount: 0, changedAt: 0, spinC: [0, 0], btns: new Float32Array(16), wells: new Float32Array(9), phases: new Float32Array(12), dots: [-1e4, 0, 18], langA: [-1e4, 0, 14], langB: [-1e4, 0, 14], pal: [-1e4, 0, 27], guides: [0, 0, 0, 0], zh: [0, 0, 0, 0], swatch: [0, 0, 1, 1], card: [0, 0, 0, 0], name: [0, 0, 1, 1], btn: [0, 0, 0, 0], chipA: [0, 0, 0, 0], chipB: [0, 0, 0, 0], hero: [0, 0, 0, 0], win: [0, 0, 0, 0], mapbox: [0, 0, 1, 1], nodes: new Float32Array(24), loop: [0, 0, 0], ver: 0 };

const SPIN = -1.1 * Math.PI / 180;   // the study sheet hangs a little crooked
// geometric point on the map sheet -> the point of its HTML drawn there (and back with -angle)
function spin(x, y, angle = SPIN) {
  const cx = lay.spinC[0], cy = lay.spinC[1], c = Math.cos(angle), s = Math.sin(angle), dx = x - cx, dy = y - cy;
  return [cx + c * dx + s * dy, cy - s * dx + c * dy];
}
// Room for the peony's bloom at the hero's lower right (see board.css): how far the bio's last lines must stop
// short, how close the buttons stand, how much the hero's gaps give. Sizes follow the window: a bloom of about 160 px
// at 1440 wide, 200 at 1920, never under 120.
function reserveBloom(tighter = 0) {
  const root = textSite.root, st = root.style, q = sel => root.querySelector(sel);
  const bioEl = q('.bio'), ctaEl = q('.cta'), win = mapSite.box('.mapwin'), status = groundSite && groundSite.box('.status .now');
  for (const v of ['--keep-w', '--keep-h', '--keep-all', '--cta-gap', '--sq']) st.removeProperty(v);
  lay.bloomWant = 0;
  if (!bioEl || !ctaEl || !win || !document.documentElement.classList.contains('gl')) return;
  let D = HIC.clamp(innerWidth * .111, 120, 200), sq = 0;
  const gap0 = parseFloat(getComputedStyle(ctaEl).columnGap) || 24;
  for (let pass = 0; pass < 6; pass++) {
    const bio = textSite.box(bioEl), btns = [...ctaEl.querySelectorAll('.btn')].slice(0, 4).map(b => textSite.box(b));
    if (!bio || btns.length < 2) return;
    const btnTop = Math.min(...btns.map(b => b[1])), btnBottom = Math.max(...btns.map(b => b[1] + b[3])), rowRight = Math.max(...btns.map(b => b[0] + b[2]));
    const yTop = btnBottom + 3, yBot = (status ? status[1] : innerHeight - 22) - 7;
    // the branch's paint is 74 of its 90 high: the strip under the buttons must hold it at the bloom's scale. The
    // hero's gaps give what they can; past that the bloom is smaller.
    const short = 74 * D / 200 + 5 - (yBot - yTop);
    if (short > 0 && sq < 20) sq = Math.min(20, sq + short * 1.1 + 1);
    else if (short > 0 && pass > 2) D = Math.max(120, D - short * 2.6);
    st.setProperty('--sq', sq.toFixed(1) + 'px');
    const s = D / 200, r = D / 2, cx = win[0] - 20 - r, cy = yTop + 8 * s - 140 * s;      // the bloom: against the study sheet, its stem into the strip
    st.setProperty('--keep-w', Math.max(0, bio[0] + bio[2] - (cx - r - 14) + 8 * tighter).toFixed(1) + 'px');
    st.setProperty('--keep-h', HIC.clamp(bio[1] + bio[3] - (cy - r - 14), 0, bio[3]).toFixed(1) + 'px');
    st.setProperty('--keep-all', bio[3].toFixed(1) + 'px');
    // the buttons: the row must end left of the bloom where the two are level
    const d = Math.max(0, btnTop - 3 - cy), half = d < r + 14 ? Math.sqrt((r + 14) * (r + 14) - d * d) : 0;
    const gapNow = parseFloat(getComputedStyle(ctaEl).columnGap) || gap0, over = rowRight + 5 + 4 * tighter - (cx - half);
    if (over > 0) st.setProperty('--cta-gap', Math.max(8, gapNow - over / (btns.length - 1)).toFixed(1) + 'px');
    lay.bloomWant = D;
  }
}
// measure the layout; where the bloom then comes out smaller than the room asked for it, ask for a little more
// (buttons closer, the bio's last lines shorter, the hero's gaps tighter) and measure again
function measure() {
  if (!textSite || !mapSite) return;
  const run = () => {
    for (let tighter = 0; tighter < 4; tighter++) {
      measureOnce(tighter);
      if (!lay.bloomWant || (lay.bloom && lay.bloom.d >= lay.bloomWant - 8)) break;
    }
  };
  // line ends are read from client rects: take them with the HTML laid flat, not in the tilted stack's fit
  if (app && app.plainGeometry) app.plainGeometry(run); else run();
}
function measureOnce(tighter) {
  reserveBloom(tighter);
  const zhPage = langNow() === 'zh';
  const root = textSite.root, q = sel => root.querySelector(sel), all = sel => [...root.querySelectorAll(sel)];
  // the hand lettering decides the name's box: cap height (en) or character box (zh) from the type size
  const em = parseFloat(getComputedStyle(q('.name')).fontSize) || 95;
  const size = Math.round(zhPage ? em : em * .90), hand = HAND.layout(zhPage ? 'zh' : 'en', size);
  const padX = Math.round(size * .62), padY = Math.round(size * .30);
  document.documentElement.style.setProperty('--nw', hand.w.toFixed(1) + 'px');
  document.documentElement.style.setProperty('--nh', hand.h.toFixed(1) + 'px');
  const name = textSite.box('.name'), row = textSite.box('.namerow'), hero = textSite.box('.hero'), top = textSite.box('.top'), win = mapSite.box('.mapwin');
  if (!name || !hero || !win) return;
  boxes = { text: [top, hero], map: [win] };
  const nameRight = name[0] + name[2];
  lay.nameSize = size;
  lay.strokeCount = hand.count;
  lay.name = [name[0] - padX, name[1] - padY, Math.ceil(hand.w + padX * 2), Math.ceil(hand.h + padY * 2)];
  lay.swatch = [name[0] - padX * .7, name[1] - padY * .58, hand.w + padX * 1.4, hand.h + padY * 1.16];   // the painted ground, roughly
  lay.spinC = [win[0] + win[2] / 2, win[1] + win[3] / 2];
  const nodes = mapSite.nodes();
  const loop = nodes.find(n => n.id === 'lc');

  // annotations: frame and inspector on the name, the two tools where they work
  const sel = els.notes.querySelector('.sel'), insp = els.notes.querySelector('.insp');
  const pad = 6;
  sel.style.cssText = `left:${name[0] - pad}px;top:${name[1] - 2}px;width:${name[2] + pad * 2}px;height:${name[3] + 2}px`;
  insp.style.left = name[0] - pad + 'px';
  insp.style.top = Math.max(top[1] + top[3] - 2, lay.swatch[1] - 36) + 'px';
  if (document.documentElement.classList.contains('flat')) {      // the plain page: the name is type, so say so
    const h1 = els.text.querySelector('.name'), cs = getComputedStyle(h1);
    insp.innerHTML = `<span><em>◇</em><b>Text · H1</b></span><span>${cs.fontFamily.split(',')[0].replace(/["']/g, '')} · ${cs.fontWeight}</span><span>${Math.round(parseFloat(cs.fontSize))} px</span>`;
  } else insp.innerHTML = `<span><em>◇</em><b>Brush</b></span><span>hand-lettered</span><span>${hand.count} strokes</span>`;
  const status = groundSite.box('.status .now');
  const swRight = lay.swatch[0] + lay.swatch[2];
  const d = els.notes.querySelector('.tool.d'), c = els.notes.querySelector('.tool.c');
  // the brush tests its colour in the free corner right of the name; with no room there, beside the palette
  // The brush tests its colour in real empty space: right of the name if there is room, else right of the chips.
  // With room in neither place it rests on the palette row and lays no stroke.
  // The brush stands in the free column right of the chips, its handle up and to the right, clear of the claim's
  // line ends and of the study sheet. With no room there it rests on the palette row and lays no stroke.
  const chipEnd = textSite.box('.chip.g'), claim = textSite.box('.claim');
  let dx = swRight + 36, dy = name[1] + name[3] * .46, lays = false;
  if (chipEnd && claim) {
    // the claim's lines end where its two inline runs end, not at its block box
    const claimEl = q('.claim'), cr = claimEl.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(claimEl);
    const lineRight = Math.max(...[...range.getClientRects()].map(r => r.right));
    const claimRight = claim[0] + (lineRight - cr.left) * (claim[2] / (cr.width || claim[2]));
    const from = Math.max(chipEnd[0] + chipEnd[2] + 36, claimRight + 12 - 76 - 12);
    // the handle rises to the upper right: at the role line's height it is about 120 px right of the stroke's start
    const roleEl = q('.role'), role = roleEl && textSite.box(roleEl);
    let from2 = from;
    if (role) { const rr = roleEl.getBoundingClientRect(); range.selectNodeContents(roleEl); const right = Math.max(...[...range.getClientRects()].map(r => r.right)); from2 = Math.max(from, role[0] + (right - rr.left) * (role[2] / (rr.width || role[2])) + 14 - 112); }
    if (win[0] - from2 >= 76 + 66 + 16) { dx = from2; dy = chipEnd[1] + chipEnd[3] * .55; lays = true; }
  }
  d.classList.toggle('idle', !lays);
  lay.brush = lays ? [dx, dy] : null;
  d.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  d.style.setProperty('--ax', '0px'); d.style.setProperty('--ay', '0px'); d.style.setProperty('--bx', '74px'); d.style.setProperty('--by', '-7px');
  d.style.setProperty('--rx', '76px'); d.style.setProperty('--ry', '10px');
  const target = nodes.find(n => n.id === 'ad');
  if (target) {
    const at = spin(target.x, target.y, -SPIN);
    c.style.translate = `${at[0].toFixed(1)}px ${at[1].toFixed(1)}px`;
    // The pencil rests on bare paper: in the sky of the third phase, between its header and the loop's names, lying
    // down to the right. It is shortened when that gap is shallow. From there it goes to the node to circle it.
    const mb = mapSite.box('.mapbox') || lay.mapbox, mkNow = mapSite.map ? mapSite.map.mk : 1, colW = (mb[2] - 24) / 3, x0 = mb[0] + 2 * (colW + 12);
    const gapTop = mb[1] + 6 + 124 * mkNow + 12, gapBot = (loop ? loop.y - loop.r - 44 * mkNow : gapTop + 70) - 4;
    let size = Math.min(1, (gapBot - gapTop - 14) / 49, (colW - 40) / 150), rest = spin(x0 + 22, gapTop + 7, -SPIN);
    // a low sheet has no sky there: then it lies in the sheet's title strip, short, left of the "hover a node" hint
    if (size < .62) { size = .5; rest = spin(win[0] + win[2] - 150 - 96, win[1] + 13, -SPIN); }
    c.style.setProperty('--rx', (rest[0] - at[0]).toFixed(1) + 'px');
    c.style.setProperty('--ry', (rest[1] - at[1]).toFixed(1) + 'px');
    c.classList.remove('up');
    c.style.setProperty('--s', size.toFixed(3));
  }

  // layout for the shaders (sheet px)
  lay.hero = hero;
  { // where reading must stay calm: the hero's words, to their real line ends and down to the end of the bio
    const range = document.createRange(), reach = el => { if (!el) return 0; const b = textSite.box(el), r = el.getBoundingClientRect(); range.selectNodeContents(el); const right = Math.max(...[...range.getClientRects()].map(q => q.right), r.left); return b[0] + (right - r.left) * (b[2] / (r.width || b[2] || 1)); };
    const bio = textSite.box('.bio'), right = Math.max(reach(q('.claim')), reach(q('.bio')), reach(q('.role')), name[0] + name[2]);
    lay.quiet = bio && right > hero[0] ? [hero[0], hero[1], right - hero[0] + 6, bio[1] + bio[3] - hero[1] + 4] : hero;
  }
  lay.win = win;
  lay.mapbox = mapSite.box('.mapbox') || lay.mapbox;
  lay.btns.fill(0);
  all('.cta .btn').slice(0, 4).forEach((b, i) => lay.btns.set(textSite.box(b), i * 4));
  // the painted strokes: four buttons, two chips
  const kinds = ['orange', 'ultra', 'cobalt', 'viridian', 'pale blue', 'pale mint'];
  lay.slots = [...all('.cta .btn').slice(0, 4), q('.chip'), q('.chip.g')].map((el, i) => { const b = el ? textSite.box(el) : [0, 0, 1, 1]; return { box: b, w: Math.round(b[2]), h: Math.round(b[3]), kind: kinds[i] }; });
  { // all of the text sheet's paint: the top bar, and the name with its buttons and chips (with room for a loose edge)
    let b = [lay.name[0], lay.name[1], lay.name[0] + lay.name[2], lay.name[1] + lay.name[3]];
    for (const sl of lay.slots) b = [Math.min(b[0], sl.box[0]), Math.min(b[1], sl.box[1]), Math.max(b[2], sl.box[0] + sl.box[2]), Math.max(b[3], sl.box[1] + sl.box[3])];
    lay.ink = new Float32Array([top[0] - 30, top[1] - 30, top[2] + 60, top[3] + 60, b[0] - 40, b[1] - 40, b[2] - b[0] + 80, b[3] - b[1] + 80]);
  }
  lay.controls = all('.top a, .top button').map(el => textSite.box(el)).filter(Boolean);
  lay.btnEls = all('.cta .btn');
  lay.navEls = all('.nav a');
  lay.chipA = textSite.box('.chip') || lay.chipA;
  lay.chipB = textSite.box('.chip.g') || lay.chipB;
  const dots = textSite.box('.top .wdots');
  if (dots) lay.dots = [dots[0] + 4 + 5.5, dots[1] + dots[3] / 2, 18];
  else lay.dots = [-1e4, 0, 18];
  { const b = textSite.box('.brand'); lay.crest = b ? [b[0], b[1] + (b[3] - 36) / 2, 36, 36] : [-1e4, 0, 1, 1]; }      // an SVG has no layout box of its own: it leads the brand link
  lay.barEls = [...all('.nav a'), q('.theme-button')].filter(Boolean);
  lay.swellEls = [...all('.explore a').slice(0, 3), q('.lang')];
  const langOn = q('.lang [aria-pressed=true]'), langOff = q('.lang [aria-pressed=false]');
  for (const [el, key] of [[langOn, 'langA'], [langOff, 'langB']]) { const b = el && textSite.box(el); if (b) lay[key] = [b[0] + b[2] / 2, b[1] + b[3] / 2, 14]; }
  lay.wells.fill(-1e4);
  all('.explore a').slice(0, 3).forEach((a, i) => { const b = textSite.box(a); lay.wells.set([b[0] + 8 + 9, b[1] + b[3] / 2, 9.5], i * 3); });
  const mk = mapSite.map ? mapSite.map.mk : 1, colW = (lay.mapbox[2] - 24) / 3;
  for (let i = 0; i < 3; i++) lay.phases.set([lay.mapbox[0] + i * (colW + 12) + 4, lay.mapbox[1] + 6, colW - 8, 124 * mk], i * 4);
  if (status) lay.pal = [status[0] + status[2] + 46, status[1] + status[3] / 2, 27];
  if (status && lay.pal[0] + 4 * 27 + 16 > innerWidth - 540) lay.pal[0] = -1e4;   // no room beside the lab's pills
  lay.guides = [name[1] + name[3] * (zhPage ? .12 : .17), name[1] + name[3] * (zhPage ? .88 : .80), 8, lay.swatch[0] - 12];
  lay.nodes.fill(-1e4);
  lay.ids = [];
  nodes.filter(n => n.id !== 'lc').forEach((n, i) => { lay.nodes[i * 3] = n.x; lay.nodes[i * 3 + 1] = n.y; lay.nodes[i * 3 + 2] = n.id.length; lay.ids[i] = n.id; });
  if (loop) lay.loop = [loop.x, loop.y, loop.r];
  const card = els.map.querySelector('.pcard.show');
  lay.card = card ? mapSite.box(card) : [0, 0, 0, 0];
  { // the node labels on the study sheet, a box for each line of text (name, venue): the mountain paint is a veil there
    lay.labels = new Float32Array(96);
    const box = els.map.querySelector('.mapbox');
    [...(box ? box.querySelectorAll('g.node text.nm, g.node text.vn, .study text.prog') : [])].slice(0, 24).forEach((t, i) => { const q = t.getBBox(); if (q.width) lay.labels.set([lay.mapbox[0] + q.x - 3, lay.mapbox[1] + q.y, q.width + 6, q.height], i * 4); });
  }
  placeBaked();
  const key = [Array.from(lay.labels, Math.round), Object.values(lay.baked).map(b => b.map(Math.round)), lay.name, lay.mapbox, Array.from(lay.btns), lay.slots.map(sl => sl.w + 'x' + sl.h), Array.from(lay.nodes), langNow()].join();
  if (key !== lay.key) {
    lay.key = key;
    lay.ver++;
    lay.changedAt = performance.now();
  }
  if (app && app.dirty) app.dirty();
}
function sync(why) {
  if (why === 'language') {
    const lang = langNow();
    fillSheets();
    // the language button that was pressed has been re-rendered; with a sheet open, keep the keyboard on it
    if (current && document.activeElement === document.body) { const pressed = els.text.querySelector('.lang button[aria-pressed="true"]'); if (pressed) pressed.focus({ preventScroll: true }); }
    if (mapSite && mapSite.lang !== lang) mapSite.setLanguage(lang);
    if (groundSite && groundSite.lang !== lang) groundSite.setLanguage(lang);
  }
  measure();
  requestAnimationFrame(measure);   // the name's box follows the lettering (--nw, --nh): measure again once that has laid out
}
// In Chinese the painted name is 罗亚鑫 itself. The study sheet keeps the map's markup; CSS drops its window chrome.
// The real <h1> stays for selection, find-in-page and screen readers; in canvas mode it is transparent and sized to
// the painted lettering. In Chinese the name is 罗亚鑫 itself.
if (STILL) document.documentElement.classList.add('still');
const LANG0 = window.__boardLang === 'zh' ? 'zh' : 'en';
groundSite = SITE.mount(els.ground, { lang: LANG0, page: lang => emptyRow + emptyRow + SITE.status(lang) });
mapSite = SITE.mount(els.map, { lang: LANG0, page: lang => emptyRow + `<div class="main">${emptyRow}${SITE.mapWindow(lang)}</div>` + emptyRow, onChange: sync, motion: false });
textSite = SITE.mount(els.text, { lang: LANG0, page: lang => SITE.top(lang) + `<main class="main">${SITE.hero(lang)}${emptyRow}</main>` + emptyRow, onChange: sync });
measure();
addEventListener('resize', () => requestAnimationFrame(measure));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(measure));


/* ---------------------------------------------------------------- the section sheets
 * About Me, Research, Publications, Projects: one layer each, all built the same way. A sheet of paper is lifted off
 * the board and laid over it, below the top bar, which stays in use (its nav swaps sheets, its language switch
 * re-renders the open one). The HTML is SECTIONS.html(); a sheet is drawn as one quad, turned a little about its
 * centre, with its own shadow. Its bits of paint are PaintSim pictures the HTML itself shows, so they scroll with
 * the content and are the same on the plain page. */
const veil = document.querySelector('.pveil');
const TOP_BAR = 64;
const hashParts = () => location.hash.slice(1).split(/[&,]/).filter(Boolean);
const sectionIn = text => { const m = /#?section\/([a-z]+)/.exec(text || ''); return m && sheets.find(sheet => sheet.id === m[1]) || null; };
const opener = { el: null };
let painted = false;
function setHash(id) {
  if (EXTERNAL) return;
  const parts = hashParts().filter(part => !part.startsWith('section/'));
  if (id) parts.unshift('section/' + id);
  history.replaceState(null, '', location.pathname + location.search + (parts.length ? '#' + parts.join('&') : ''));
}
function fillSheets() {
  if (EXTERNAL) { markNav(); return; }
  const lang = langNow();
  for (const sheet of sheets) {
    if (sheet.lang === lang) continue;
    const scroller = sheet.el.querySelector('.pscroll'), top = scroller ? scroller.scrollTop : 0, had = sheet.el.contains(document.activeElement);
    sheet.lang = lang;
    sheet.el.innerHTML = SECTIONS.html(sheet.id, lang);
    if (top) sheet.el.querySelector('.pscroll').scrollTop = top;
    if (had) sheet.el.querySelector('.pclose').focus({ preventScroll: true });
  }
  markNav();
}
function paintSheets() {
  if (painted || !window.PaintSim) return;
  painted = true;
  try {
    const pictures = SECTIONS.paint(PaintSim, 2), root = document.documentElement;
    for (const name in pictures) root.style.setProperty('--' + name, `url(${pictures[name]})`);
    root.classList.add('painted');
  } catch (error) { console.warn('sheet paint', error); }
}
// the nav item of the open sheet is marked (the canvas gives it the brushed underline)
function markNav() {
  if (!EXTERNAL) for (const a of els.text.querySelectorAll('.nav a')) {
    const on = !!current && sectionIn(a.getAttribute('href')) === current;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  }
  lay.navOn = els.text.querySelector('.nav a.on');
  if (current) guardBoard(true);      // the top bar's HTML is new after a language change
}
// while a sheet is open the board is out of reach, except the top bar
function guardBoard(on) {
  for (const el of [els.map, els.ground, els.notes]) el.inert = on;
  for (const el of els.text.children) if (!el.classList.contains('top')) el.inert = on;
}
function openSheet(id, from) {
  const sheet = sheets.find(s => s.id === id);
  if (!sheet || sheet === current) return;
  fillSheets();
  paintSheets();
  const old = current;
  if (old) { old.open = false; old.swap = true; old.el.inert = true; old.el.classList.remove('on'); if (!app || !app.live) old.el.classList.add('shut'); }
  else opener.el = from || document.activeElement;
  current = sheet;
  sheet.open = true;
  sheet.swap = false;
  sheet.el.classList.remove('shut');
  sheet.el.classList.add('on');
  sheet.el.inert = false;
  guardBoard(true);
  veil.classList.add('on');
  setHash(id);
  markNav();
  tags[4].querySelector('span').textContent = id === 'about' ? 'about-me' : id;
  tags[4].dataset.w = tags[4].offsetWidth || 110;
  const scroller = sheet.el.querySelector('.pscroll');
  if (scroller && !EXTERNAL) scroller.scrollTop = 0;
  const close = sheet.el.querySelector('.pclose');
  if (close && !EXTERNAL) close.focus({ preventScroll: true });
}
function closeSheet(later) {
  const sheet = current;
  if (!sheet) return;
  current = null;
  sheet.open = false;
  sheet.swap = false;
  sheet.el.inert = true;
  sheet.el.classList.remove('on');
  guardBoard(false);
  veil.classList.remove('on');
  setHash(null);
  markNav();
  if (!app || !app.live) sheet.el.classList.add('shut');      // the canvas stops drawing it when it has slid away
  let back = opener.el;
  if (!back || !back.isConnected) back = els.text.querySelector('.nav a[href*="#section/' + sheet.id + '"]');
  opener.el = null;
  const focus = () => { if (!EXTERNAL && !current && back && back.focus) back.focus({ preventScroll: true }); };
  // after a press on the board the browser moves focus itself once the press is over; ours goes last
  if (later) setTimeout(focus, 60); else focus();
}
// element px <-> the point of the board (sheet px) it is drawn at
function sheetOut(sheet, u, v) {
  const w = sheet.el.offsetWidth, h = sheet.el.offsetHeight, c = Math.cos(sheet.angle), s = Math.sin(sheet.angle), dx = u - w / 2, dy = v - h / 2;
  return [sheet.c[0] + c * dx - s * dy, sheet.c[1] + s * dx + c * dy];
}
function sheetIn(app, sheet, x, y) {
  const p = toSheet(app, sheet.index, x, y);
  if (!p) return null;
  const w = sheet.el.offsetWidth, h = sheet.el.offsetHeight, c = Math.cos(sheet.angle), s = Math.sin(sheet.angle), dx = p[0] - sheet.c[0], dy = p[1] - sheet.c[1];
  return [w / 2 + c * dx + s * dy, h / 2 - s * dx + c * dy];
}
// The site's panel is one element. When it turns to another page, the picture it had is kept as a "ghost" sheet
// that slides off to the left while the element, with its new content, comes up as the new sheet.
const ghost = { tex: null, fb: null, cw: 0, ch: 0, t: 0, v: 0, c: [0, 0], angle: SHEET_REST };
function keepGhost() {
  const sheet = sheets[0], L = app && app.layers[sheet.index], gl = app && app.g && app.g.gl;
  if (!gl || !L || !L.tex || !L.allocated || !L.cw || app.reduced || sheet.t < .5) return false;
  const [w, h] = L.allocated.split('x').map(Number);
  if (!ghost.tex) { ghost.tex = gl.createTexture(); ghost.fb = gl.createFramebuffer(); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, ghost.fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, L.tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  if (ok) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ghost.tex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 0, 0, w, h, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) return false;
  ghost.cw = L.cw; ghost.ch = L.ch; ghost.t = Math.min(1, sheet.t); ghost.v = 0;
  return true;
}
function stepSheets(app) {
  if (ghost.t > 0) {
    const w = 10.5, z = .78;
    for (let i = 0; i < 4; i++) { const h = Math.min(app.dt, .05) / 4; ghost.v += (w * w * (0 - ghost.t) - 2 * z * w * ghost.v) * h; ghost.t += ghost.v * h; }
    if (ghost.t < .004 || app.reduced) { ghost.t = 0; ghost.v = 0; }
    const away = 1 - ghost.t, H = app.view.H, h = ghost.ch || H - 100, rest = TOP_BAR + 6 + h / 2 + Math.max(0, (H - TOP_BAR - 36 - h) / 2);
    ghost.angle = SHEET_REST - 5 * DEG * away;
    ghost.c = [app.view.W / 2 - 240 * away, rest + 14 * away];
  }
  for (const sheet of sheets) {
    const target = sheet.open ? 1 : 0;
    if (app.reduced) { sheet.t = target; sheet.v = 0; }
    else if (sheet.t !== target || sheet.v) {
      const w = 10.5, z = .78;
      for (let i = 0; i < 4; i++) { const h = Math.min(app.dt, .05) / 4; sheet.v += (w * w * (target - sheet.t) - 2 * z * w * sheet.v) * h; sheet.t += sheet.v * h; }
      if (Math.abs(target - sheet.t) < .0004 && Math.abs(sheet.v) < .002) { sheet.t = target; sheet.v = 0; }
    }
    const away = 1 - sheet.t, H = app.view.H, h = sheet.el.offsetHeight || H - 100, rest = TOP_BAR + 6 + h / 2 + Math.max(0, (H - TOP_BAR - 36 - h) / 2);
    if (sheet.swap) {          // put away for another sheet: it slides off to the left as the new one comes up
      sheet.angle = SHEET_REST - 5 * DEG * away;
      sheet.c = [app.view.W / 2 - 240 * away, rest + 14 * away];
    } else {                   // it comes up from below, turned, and settles
      sheet.angle = SHEET_REST - 3.6 * DEG * away;
      sheet.c = [app.view.W / 2 - 16 * away, rest + 60 * away];
    }
    if (!sheet.open && sheet.t < .004) sheet.swap = false;
  }
}
document.addEventListener('click', event => {
  if (EXTERNAL || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const a = event.target.closest && event.target.closest('a[href*="#section/"]');
  const sheet = a && sectionIn(a.getAttribute('href'));
  if (sheet) { event.preventDefault(); if (sheet === current && !sheetOf(a)) closeSheet(); else openSheet(sheet.id, a); return; }
  if (event.target.closest && event.target.closest('.pclose')) closeSheet();
});
veil.addEventListener('click', () => closeSheet());
addEventListener('keydown', event => {
  if (!current || EXTERNAL) return;
  if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
  if (event.key !== 'Tab') return;
  // Tab goes round inside the sheet; Esc leaves it
  const stops = [...current.el.querySelectorAll('a[href], button, summary, [tabindex="0"]')];
  if (!stops.length) return;
  const first = stops[0], last = stops[stops.length - 1], at = document.activeElement;
  if (!current.el.contains(at)) { event.preventDefault(); first.focus({ preventScroll: true }); }
  else if (event.shiftKey && at === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && at === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
});
addEventListener('hashchange', () => { if (EXTERNAL) return; const sheet = sectionIn(hashParts().find(part => part.startsWith('section/'))); if (sheet) openSheet(sheet.id, null); else closeSheet(); });

const PANEL_VS = `
in vec2 aUV;
uniform mat3 uRot;
uniform vec4 uPose;
uniform float uEye, uAngle;
uniform vec2 uSize, uC;
out vec2 vL;
void main() {
  vL = mix(vec2(-120.), uSize + 120., aUV);
  vec2 d = vL - uSize * .5;
  float c = cos(uAngle), s = sin(uAngle);
  vec2 p = uC + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  vec3 w = uPose.y * (uRot * vec3(p - uView * .5, uPose.x)) + vec3(uPose.zw, 0.);
  float q = (uEye - w.z) / uEye;
  vec4 cl = toClip((uView * .5 + w.xy / q) * uK);
  gl_Position = vec4(cl.xy * q, 0., q);
}`;
const PANEL_FS = `
in vec2 vL;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uA, uLift;
float rbox(vec2 p, vec2 hs, float r) { vec2 d = abs(p) - hs + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
float strip(vec2 p, vec2 c, float angle) {
  float cs = cos(angle), sn = sin(angle);
  vec2 q = vec2(cs * (p.x - c.x) + sn * (p.y - c.y), -sn * (p.x - c.x) + cs * (p.y - c.y));
  vec2 d = abs(q) - vec2(40., 12.) + vec2((hash11(floor(q.y * .9) + c.x) - .5) * 2.5, 0.);
  return smoothstep(.8, -.8, max(d.x, d.y));
}
void main() {
  vec2 p = vL - uSize * .5;
  float d = rbox(p, uSize * .5, 3.) + (vnoise(vL * .05) - .5) * 1.2;
  float inside = smoothstep(.6, -.6, d);
  // light from the upper left: a tight contact shadow and a wide soft one, both further off while the sheet is lifted
  float soft = 1. - smoothstep(-22. * uLift, 46. * uLift, rbox(p - vec2(8., 14.) * uLift, uSize * .5, 6.));
  float tight = 1. - smoothstep(-2., 6., rbox(p - vec2(1.5, 3.), uSize * .5, 3.));
  float sh = min(.62, soft * .34 + tight * .2);
  vec4 tex = texture(uTex, vL / uSize);
  vec3 col = tex.rgb + mix(vec3(.996, .996, 1.), vec3(.082, .092, .20), uDark) * (1. - tex.a);
  col *= 1. + (vnoise(vL * 1.9) - .5) * .010 + (fbm(vL * .018) - .5) * .012;
  col *= 1. - .035 * smoothstep(uSize.y * .55, uSize.y, vL.y) * smoothstep(0., uSize.x, vL.x);   // falls away from the lamp
  vec4 c = vec4(vec3(.04, .05, .15) * sh, sh) * (1. - inside) + vec4(col, 1.) * inside;
  // two strips of tape hold the top corners
  float tape = max(strip(vL, vec2(8., 8.), -.78), strip(vL, vec2(uSize.x - 8., 8.), .74));
  vec4 t = vec4(vec3(.80, .84, .96) * (.96 + .06 * vnoise(vL * .4)), 1.) * .72 * tape;
  c = t + c * (1. - t.a);
  o = c * clamp(uA, 0., 1.);
}`;
const DIM_FS = `
uniform float uA;
void main() { o = vec4(vec3(.05, .07, .19) * uA, uA); }`;

/* ---------------------------------------------------------------- shared GLSL */
const PAINT_GLSL = `
const vec3 ULTRA = vec3(.085, .135, .60);
const vec3 ULTRA_MID = vec3(.21, .27, .86);
const vec3 ULTRA_LIGHT = vec3(.50, .63, .96);
const vec3 CREAM = vec3(.985, .96, .88);
const vec3 ORANGE = vec3(.945, .40, .09);
const vec3 ORANGE_DEEP = vec3(.86, .22, .05);
const vec3 MINT = vec3(.06, .63, .45);
float inBox(vec2 p, vec4 b) { return step(b.x, p.x) * step(b.y, p.y) * step(p.x, b.x + b.z) * step(p.y, b.y + b.w); }
float sdRound(vec2 p, vec4 b, float r) { vec2 d = abs(p - b.xy - b.zw * .5) - b.zw * .5 + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
`;

/* ---------------------------------------------------------------- the curve: a ribbon that holds (along, across) */
const RIBBON_VS = `
in vec2 aPos;       // sheet px
in vec2 aUV;        // length along (px), across (-1..1)
in float aP;        // the hand's pressure there, 0..1
uniform vec4 uBox;
out vec2 vUV;
out float vP;
void main() {
  vUV = aUV;
  vP = aP;
  vec2 q = (aPos - uBox.xy) / uBox.zw * 2. - 1.;
  gl_Position = vec4(q, 0., 1.);
}`;
const RIBBON_FS = `
in vec2 vUV;
in float vP;
void main() { o = vec4(vUV.x, vUV.y, 1., vP); }`;

/* ---------------------------------------------------------------- the paint
 * Thick oil paint on the ground sheet. One float target holds it: a = thickness, rgb = the colour of the paint on
 * top (multiplied by min(8a, 1), so thin edges do not go dark when the picture is filtered). Paint does not flow:
 * it is only laid and moved by a tool. A press sets down a loaded dab; a drag pulls it out as a stroke. Each hair of
 * the brush either still lays the loaded colour or drags along what is under it, so two colours stay streaks. */
const STAMP_FS = `
uniform sampler2D uSrc, uSrcM;      // the paint (colour, thickness) and its material (r iridescent mineral, g gold leaf)
uniform vec2 uMat;
uniform float uOut;
uniform vec2 uSpace;               // the size, in px, of the sheet this paint lies on                // 0 writes the paint, 1 its material
uniform vec2 uA, uB, uDir;        // sheet px: where the tool was and is; the drag's direction
uniform float uR, uLoad, uSeed, uMode, uKnife, uTravel, uGain;
uniform vec3 uColour;
uniform vec4 uBox;                 // the strip a local scrape clears; the box a baked painting lies in
uniform sampler2D uBaked, uBakedR; // a baked painting: premultiplied colour with cover in alpha; r thickness, b metal
#define UV (gl_FragCoord.xy / uRes)
vec3 dec(vec4 v) { return v.rgb / max(clamp(v.a * 8., 0., 1.), .001); }
vec4 enc(vec3 c, float h) { h = max(h, 0.); return vec4(c * clamp(h * 8., 0., 1.), h); }
vec4 m;
void work() {
  vec2 p = UV * uSpace;
  vec4 old = texture(uSrc, UV), oldM = texture(uSrcM, UV);
  o = old;
  m = oldM;
  if (uMode > 6.5) { o = texture(uBaked, UV); m = vec4(texture(uBakedR, UV).rg, 0., 0.); return; }      // the paint of another size of window, carried over
  if (uMode > 4.5) {               // a baked painting: 6 lifts what lies in its box, 5 sets it down there
    vec2 q = (p - uBox.xy) / uBox.zw;
    if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) return;
    if (uMode > 5.5) { o = vec4(0.); m = vec4(0.); return; }
    vec2 gx = vec2(uSpace.x / (uRes.x * uBox.z), 0.), gy = vec2(0., uSpace.y / (uRes.y * uBox.w));      // one target px, in the painting
    vec4 c = textureGrad(uBaked, q, gx, gy);
    vec3 r = textureGrad(uBakedR, q, gx, gy).rgb;
    float cover = c.a * smoothstep(uA.x, uA.x + 14., p.x);      // uA.x: where a shortened painting begins
    if (cover < .004) return;
    float h = (.07 + 2.3 * r.r) * uGain;                                 // thin paint still covers; the impasto stands up
    vec3 col = mix(dec(old), c.rgb / cover, max(cover, 1. - smoothstep(0., .02, old.a)));
    o = enc(col, mix(old.a, h, cover));
    m = mix(oldM, vec4(0., clamp(r.b / cover, 0., 1.), 0., 0.), cover);
    return;
  }
  if (uMode > 3.5) {               // one strip scraped: the knife runs along it from the left
    if (p.x < uBox.x || p.y < uBox.y || p.x > uBox.x + uBox.z || p.y > uBox.y + uBox.w) return;
    float edge = uA.x + 3. * (vnoise(vec2(p.y * .5, uSeed)) - .5);
    o = enc(dec(old), old.a * smoothstep(edge - 3., edge + 1., p.x));
    return;
  }
  if (uMode > 2.5) {               // scraped clean: the knife's edge at x = uA.x takes what is left of it, a ridge runs ahead
    float edge = uA.x + 26. * (vnoise(vec2(p.y * .012, uSeed)) - .5) + 5. * (vnoise(vec2(p.y * .2, uSeed + 3.)) - .5);
    float gone = 1. - smoothstep(edge - 5., edge + 1., p.x);
    float pile = exp(-pow((p.x - edge - 7.) / 5., 2.)) * smoothstep(.02, .12, old.a);
    o = enc(dec(old), min(old.a * (1. - gone) + pile * .22, 1.5));
    return;
  }
  if (uMode > 1.5) {               // a pointer passing over wet paint only nudges it
    vec2 d = p - uB;
    float g = exp(-dot(d, d) / (uR * uR));
    o = mix(old, texture(uSrc, UV - (uB - uA) / uSpace), .32 * g);
    m = mix(oldM, texture(uSrcM, UV - (uB - uA) / uSpace), .32 * g);
    return;
  }
  if (uMode > .5) {                // a loaded dab: a mound with a peak and a lip, the brush twisted as it lifted
    vec2 d = p - uA;
    float ang = atan(d.y, d.x), r = length(d);
    float edge = 1. + .08 * sin(ang * 3. + uSeed * 5.) + .14 * (vnoise(vec2(ang * 1.9 + 9., uSeed * 7.)) - .5);
    float rr = r / (uR * edge);
    if (rr > 1.05) return;
    float body = 1. - smoothstep(.93, 1., rr);
    float turn = ang * 2. - rr * 7.5 + uSeed * 3.;
    float mound = .46 + .30 * pow(max(0., 1. - rr * rr), .8);
    float lip = .24 * exp(-pow((rr - .86) / .075, 2.));
    float twist = (.10 * sin(turn) + .09 * (vnoise(vec2(turn * 2.4, rr * 2. + uSeed)) - .5)) * smoothstep(.06, .4, rr);
    vec2 pk = d - uR * .22 * vec2(cos(uSeed * 9.), sin(uSeed * 9.));
    float peak = .34 * exp(-dot(pk, pk) / (uR * uR * .04));
    float h = (mound + lip + twist + peak) * uGain;
    // wet on wet: what was there comes up in streaks along the twist
    float keep = smoothstep(.04, .2, old.a) * smoothstep(.58, .70, vnoise(vec2(turn * 1.3 + uSeed, rr * 1.5))) * smoothstep(.2, .5, rr);
    float streak = vnoise(vec2(turn * 1.9 + 4., rr * 3. + uSeed));
    vec3 tint = uColour * mix(.80, 1.16, streak);
    tint = mix(tint, tint * 1.4 + .05, .5 * smoothstep(.64, .8, vnoise(vec2(turn * 3.1, uSeed + rr))));
    vec4 laid = enc(mix(tint, dec(old), keep * .9), h + old.a * .22);
    o = mix(old, laid, body);
    m = mix(oldM, mix(vec4(uMat, 0., 0.), oldM, keep * .9), body);
    return;
  }
  // a stroke: the tool's edge swept from uA to uB
  vec2 ab = uB - uA, n = vec2(-uDir.y, uDir.x), q = p - uA;
  float L = length(ab), along = dot(q, uDir), across = dot(q, n), u = across / uR;
  float tip = 3. * (vnoise(vec2(across * .8 + uSeed * 31., 3.)) - .5);
  float w = (1. - smoothstep(.93, 1., abs(u))) * smoothstep(-uR * .55 + tip - 1.5, -uR * .55 + tip, along) * (1. - smoothstep(L + tip, L + tip + 1.5, along));
  if (w <= 0.) return;
  float b1 = vnoise(vec2(across * .42 + uSeed * 17., uSeed * 3.));                       // clumps of hairs
  float b2 = vnoise(vec2(across * 1.5 + uSeed * 5., (uTravel + along) * .028));         // single hairs, wandering slowly
  float bristle = .55 * b1 + .45 * b2;
  vec4 dragged = texture(uSrc, UV - ab / uSpace);
  vec4 under = mix(old, dragged, step(.40, b2));                                        // some hairs pull along what is under them
  float pick = smoothstep(.12, .45, under.a) * step(.56, vnoise(vec2(across * 1.05 + uSeed * 9., 7. + floor(uTravel / 90.))));
  float carry = smoothstep(-.05, .05, uLoad * 1.28 - (.20 + .80 * bristle)) * (1. - .92 * pick);
  float relief = mix(.50 + .85 * bristle, .86 + .10 * b1, uKnife);                       // a brush leaves furrows, a knife a slab
  float skip = mix(1., smoothstep(.22, .36, vnoise(vec2((uTravel + along) * .022, across * .05 + uSeed)) + uLoad * .45), uKnife);
  float ridge = mix(.26, .50, uKnife) * exp(-pow((abs(u) - .86) / .065, 2.)) * (.6 + .8 * vnoise(vec2((uTravel + along) * .05, u * 3. + uSeed)));
  float press = .78 + .44 * vnoise(vec2((uTravel + along) * .035, uSeed * 2.));          // the hand presses unevenly
  float laid = uGain * pow(uLoad, .55) * relief * skip * press;
  // the load is not one flat colour: darker where it is thick in the hairs, a lighter streak here and there
  vec3 tint = uColour * mix(.74, 1.2, b1);
  tint = mix(tint, tint * 1.45 + .05, .55 * smoothstep(.60, .78, b2));
  float h = mix(under.a * .84, laid + under.a * .18, carry) + ridge * (uGain * uLoad * .9 * skip + under.a * .5);
  o = mix(old, enc(mix(dec(under), tint, max(carry, 1. - smoothstep(0., .02, under.a))), h), w);
  vec4 underM = mix(oldM, texture(uSrcM, UV - ab / uSpace), step(.40, b2));
  m = mix(oldM, mix(underM, vec4(uMat, 0., 0.), max(carry, 1. - smoothstep(0., .02, under.a))), w);
}
void main() { work(); if (uOut > .5) o = m; }`;

/* ---------------------------------------------------------------- the sheets */
const SHEET_VS = `
in vec2 aUV;
uniform mat3 uRot;
uniform vec4 uPose;     // z of this sheet, scale, translate xy
uniform float uEye;
uniform float uMargin;
out vec2 vPos;
void main() {
  vPos = mix(vec2(-uMargin), uView + uMargin, aUV);
  vec3 w = uPose.y * (uRot * vec3(vPos - uView * .5, uPose.x)) + vec3(uPose.zw, 0.);
  float q = (uEye - w.z) / uEye;
  vec4 c = toClip((uView * .5 + w.xy / q) * uK);
  gl_Position = vec4(c.xy * q, 0., q);
}`;
const SHEET_FS = PAINT_GLSL + `
in vec2 vPos;
uniform sampler2D uTex;
uniform sampler2D uS0, uS1, uS2;
uniform vec3 uHeights;
uniform float uOpen;
uniform float uKind;               // 0 ground, 1 text, 2 map, 3 annotations
uniform float uFrost;
uniform vec3 uCast;
uniform vec2 uLight;
uniform float uRadius;
uniform vec3 uLamp;                // direction to the lamp that lights the paint
// ground
uniform sampler2D uPaint, uMatTex;
uniform float uRidge[48];          // the research curve's height at 48 places across the map (sheet px, -1 where it does not run)
uniform vec4 uHero, uWin;
// text
uniform sampler2D uNameC, uNameG, uNameD;   // PaintSim's buffers: finished colour, ground colour, (height, ground height, gloss, when)
uniform sampler2D uAtlasC, uAtlasD;        // the small strokes: colour, (height, gloss)
uniform float uWrite;                       // 0..1: how much of the name has been written
uniform vec4 uSlotBox[6], uSlotUV[6];
uniform vec4 uName, uChipA, uChipB, uNavHover;
uniform vec4 uCrest, uSwell;            // the crest's box; how far the three explore dabs (xyz) and the language dab (w) have swollen
uniform vec4 uBtns[4];
uniform float uBtnHover;
uniform vec3 uWells[3];
uniform vec3 uDots, uLangA, uLangB;
uniform float uSpin;               // this sheet's content is turned by this angle about uSpinC
uniform vec3 uSpinAbove;           // and the sheets above by these
uniform vec2 uSpinC;
uniform vec3 uPal;
uniform vec4 uGuides;
uniform vec4 uPhases[3];
// map
uniform sampler2D uStroke;
uniform vec4 uMapBox;
uniform vec3 uNodes[8];
uniform vec3 uLoop;
uniform float uLen, uProgress, uHover, uOrbit, uRidgeEnd;      // uRidgeEnd: where the drawn ridge stops (0..1 across the map box)
uniform sampler2D uMount, uMountR;      // the baked mountains over the map box (colour; r thickness, g gloss)
uniform float uMountOn;
uniform sampler2D uSelf;                // this sheet's own picture, blurred (its cover): where the glyphs are, softly
uniform vec4 uLabels[24];               // the node labels' lines of text, one box each (sheet px): the mountain paint thins to a veil under them
uniform vec4 uInk[2];      // text sheet: the two boxes that hold all of its paint
uniform vec4 uCard;

float box(vec2 p, float r) {
  vec2 d = abs(p - uView * .5) - uView * .5 + r;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r;
}
vec2 turn(vec2 p, float a) { vec2 d = p - uSpinC; float c = cos(a), s = sin(a); return uSpinC + vec2(c * d.x + s * d.y, -s * d.x + c * d.y); }
float shadowOf(sampler2D s, float h, vec2 p, float strength, float ang) {
  if (h <= 0.) return 0.;
  vec2 q = turn(p - h * uLight, ang);
  float soft = 5. + h * .34;
  float cover = textureLod(s, q / uView, log2(max(1., soft / 6.))).a;
  cover = smoothstep(.2, .85, cover) * step(0., q.x) * step(0., q.y) * step(q.x, uView.x) * step(q.y, uView.y);
  float sheet = (1. - smoothstep(-soft, soft, box(q, uRadius))) * uOpen * .02;
  return 1. - (1. - cover * strength * .34 / (1. + h / 170.)) * (1. - sheet);
}
// light on a painted surface from its slope, with the sheen of oil
vec3 lit(vec3 colour, vec2 slope, float gloss, float shade) {
  vec3 n = normalize(vec3(-slope, 1.));
  float d = dot(n, uLamp);
  vec3 h = normalize(uLamp + vec3(0., 0., 1.));
  float spec = pow(max(dot(n, h), 0.), 34.) * gloss;
  float sheen = pow(max(dot(n, h), 0.), 8.) * gloss * .14;
  vec3 c = colour * (.74 + .44 * max(d, 0.)) * shade;
  return c + vec3(1., .985, .95) * (spec * .6 + sheen);
}
// Two more paints. Iridescent mineral: glitter flakes in a dark binder, each flake with its own tilt; a flake's colour
// runs turquoise -> cyan-green -> azurite -> violet with the angle between its normal and the light, and it flashes
// when it faces the light, so the paint twinkles as the lamp or the pointer moves. Gold leaf: a warm metal sheet,
// crinkled, with a bright specular that slides.
uniform sampler2D uNoise;      // 256 x 256 random values, tiling: flake tilts and soft noise cost one lookup, not a hash chain
vec4 tn(vec2 x) { return texture(uNoise, (x + .5) / 256.); }
vec3 gL;        // the light for these two: the board's lamp, pulled towards the pointer when it is near
vec3 mineral(vec2 p, vec3 n, float relief) {
  vec2 h2 = tn(floor(p * 1.3)).rg, big = tn(floor(p * .42) + 11.).ba;
  vec3 fn = normalize(n + vec3((h2 - .5) * 1.5 + (big - .5) * .7, 0.));
  vec3 hv = normalize(gL + vec3(0., 0., 1.));
  float face = max(dot(fn, hv), 0.);
  float ph = fract(dot(fn.xy, gL.xy) * 1.25 + big.x * .5 + .12);
  vec3 ramp = ph < .34 ? mix(vec3(.10, .78, .74), vec3(.20, .86, .62), ph / .34) : ph < .68 ? mix(vec3(.20, .86, .62), vec3(.16, .40, .92), (ph - .34) / .34) : mix(vec3(.16, .40, .92), vec3(.52, .34, .88), (ph - .68) / .32);
  float lit_ = pow(face, 14.);
  float coarse = step(.55, big.y);                                   // some flakes are large and lie flat: they show their colour all the time
  return vec3(.012, .045, .07) + ramp * (.20 + .34 * coarse + 1.3 * lit_ * (.55 + .7 * relief)) * (.6 + .6 * h2.y) + vec3(.9, 1., 1.) * pow(face, 70.) * .55;
}
vec3 goldLeaf(vec2 p, vec3 n) {
  vec2 crinkle = (tn(p * .85).rg - .5) * 1.25 + (tn(p * .2 + 40.).ba - .5) * .9;
  vec3 gn = normalize(n + vec3(crinkle, 0.));
  float s = max(dot(gn, normalize(gL + vec3(0., 0., 1.))), 0.);
  return vec3(.78, .55, .16) * (.42 + .55 * max(dot(gn, gL), 0.)) + vec3(1., .86, .52) * (pow(s, 16.) * .8 + pow(s, 70.) * .9);
}
// the canvas: fine weave and broad gesso marks, as a brightness factor
float weaveOf(vec2 p) { return sin(p.x * 2.6 + .6 * sin(p.y * .9)) * sin(p.y * 2.6 + .6 * sin(p.x * .9)); }
float canvasTone(vec2 p, float weave) {
  vec2 q = vec2(p.x * .012 + p.y * .004, p.y * .16);
  float marks = .55 * tn(q).r + .3 * tn(q * 2.03 + 17.).g + .15 * tn(q * 4.1 + 31.).b - .5;      // the baked noise: three lookups, not a hash chain
  float tooth = tn(floor(p * 1.5)).a - .5;
  return 1. + .011 * weave + .030 * marks + .008 * tooth;
}

// premultiplied "over"
vec4 over(vec4 top, vec4 under) { return top + under * (1. - top.a); }

// PaintSim laid the paint; here it is only lit. A pixel shows the finished paint once the writing has reached it.
float written(float when) { return 1. - smoothstep(uWrite - .003, uWrite + .003, when); }
float nameHeight(vec2 uv) { vec4 d = texture(uNameD, uv); return mix(d.g, d.r, written(d.a)); }
vec4 nameLayer(vec2 p, float sel) {
  vec2 uv = (p - uName.xy) / uName.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  vec4 d = texture(uNameD, uv);
  float on = written(d.a);
  vec4 c = mix(texture(uNameG, uv), texture(uNameC, uv), on);
  if (c.a <= .002) return vec4(0.);
  vec2 e = .6 / uName.zw;
  float hx = nameHeight(uv + vec2(e.x, 0.)) - nameHeight(uv - vec2(e.x, 0.));
  float hy = nameHeight(uv + vec2(0., e.y)) - nameHeight(uv - vec2(0., e.y));
  float here = mix(d.g, d.r, on);
  float around = nameHeight(uv + 4. * e * normalize(uLamp.xy + 1e-4));
  float shade = 1. - .30 * smoothstep(.1, 1.6, around - here);                 // in the lee of a ridge
  float letter = on * step(d.a, 1.5);
  vec3 base = mix(c.rgb, mix(ORANGE_DEEP, ORANGE, .5 + .5 * c.b), sel * (1. - letter) * .9);   // a selection: wet orange over the ground
  float gloss = mix(.22, d.b, on);
  vec3 col = lit(base, vec2(hx, hy) * mix(1.1, .72, letter), clamp(gloss, 0., 1.), mix(shade, 1. - (1. - shade) * .5, letter));
  return vec4(col, 1.) * c.a;
}
// one of the small PaintSim strokes (buttons 0..3, chips 4..5), lit
vec4 slotPaint(vec2 p, int i, float wet) {
  vec4 b = uSlotBox[i];
  vec2 q = (p - b.xy) / b.zw;
  if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) return vec4(0.);
  vec2 uv = uSlotUV[i].xy + q * uSlotUV[i].zw;
  vec4 c = texture(uAtlasC, uv);
  if (c.a <= .002) return vec4(0.);
  vec2 e = .6 / b.zw * uSlotUV[i].zw;
  float hx = texture(uAtlasD, uv + vec2(e.x, 0.)).r - texture(uAtlasD, uv - vec2(e.x, 0.)).r;
  float hy = texture(uAtlasD, uv + vec2(0., e.y)).r - texture(uAtlasD, uv - vec2(0., e.y)).r;
  float gloss = texture(uAtlasD, uv).g;
  // on the dark board the two chips are deep, thin washes (their labels are the bright accent and mint), not pale paint
  vec3 base = i >= 4 ? mix(c.rgb, i == 4 ? vec3(.145, .185, .50) : vec3(.055, .285, .225), uDark) : c.rgb;
  vec3 col = lit(base * (1. + .07 * wet), vec2(hx, hy) * (1.15 + .7 * wet), clamp(gloss * (1. + 1.2 * wet) + .1 * wet, 0., 1.) * (i >= 4 ? 1. - .6 * uDark : 1.), 1.);
  return vec4(col, 1.) * c.a * (i >= 4 ? 1. - .2 * uDark : 1.);
}
// a stroke brushed from left to right over box b: ragged ends, bristle streaks. even: 1 keeps the middle calm for a
// label; relief and gloss say how thick and how wet it is.
vec4 swatch(vec2 p, vec4 b, vec3 deep, vec3 light, vec3 hi, float even, float relief, float gloss, float seed) {
  if (b.z < 1.) return vec4(0.);
  vec2 q = p - b.xy;
  if (q.x < -22. || q.x > b.z + 22. || q.y < -6. || q.y > b.w + 6.) return vec4(0.);
  float streak = vnoise(vec2(q.x * .035 + 7. + seed, q.y * 1.5 + seed));
  float fineS = vnoise(vec2(q.x * .09 + seed, q.y * 3.3 + 2.));
  float ends = 1.5 + 5. * vnoise(vec2(3. + seed, q.y * .7)) + 2. * fineS;
  float endR = 1.5 + 5. * vnoise(vec2(9. + seed, q.y * .55)) + 2. * fineS;
  float l = smoothstep(-ends, -ends + 2.5, q.x), r = 1. - smoothstep(b.z + endR - 2.5, b.z + endR, q.x);
  float edgeY = 2.2 * (vnoise(vec2(q.x * .11 + seed, 1.)) - .5);
  float t = smoothstep(-2.5 + edgeY, -.5 + edgeY, q.y) * (1. - smoothstep(b.w + .5 + edgeY, b.w + 2.5 + edgeY, q.y));
  float dry = smoothstep(.72, 1., (q.x / b.z)) * smoothstep(.55, .8, fineS) * .8;      // the brush runs dry at the end
  float cover = l * r * t * (1. - dry);
  float h = cover * (.5 + .5 * streak + .2 * fineS);
  float mid = even * smoothstep(0., 14., q.x) * (1. - smoothstep(b.z - 14., b.z, q.x));     // calm where the label sits
  vec3 col = mix(deep, light, mix(smoothstep(.2, .7, streak), .72 + .28 * streak, mid));
  col = mix(col, hi, smoothstep(.7, .95, streak) * .7 * (1. - mid));
  h = mix(h, cover * (.6 + .14 * streak), mid);
  vec2 slope = vec2(dFdx(h), dFdy(h)) * 2.2 * relief;
  return vec4(lit(col, slope, gloss * cover, 1.), 1.) * cover;
}
// a thin wash of paint: uneven, darker where it pooled at the rim. loose: how far its outline wanders, px
vec4 wash(vec2 p, vec4 b, vec3 col, float radius, float loose, float strength) {
  if (b.z < 1.) return vec4(0.);
  vec2 away = abs(p - b.xy - b.zw * .5) - b.zw * .5;
  if (max(away.x, away.y) > 2. * loose + 5.) return vec4(0.);
  float wob = loose * (fbm(p * (.5 / max(loose, 2.)) + b.x * .01) - .5) * 2. + 2. * (vnoise(p * .16) - .5);
  float sd = sdRound(p, b, radius) + wob;
  float inside = 1. - smoothstep(-1.2, 1.2, sd);
  float pool = exp(-pow((sd + 2.4) / 2.2, 2.));
  float uneven = .7 + .6 * fbm(p * .05 + 3.);
  float a = inside * (.17 * uneven + .11 * pool) * strength;
  return vec4(col, 1.) * a;
}
// a strip of pale tape, torn at both ends
vec4 tape(vec2 p, vec2 c, float ang, vec2 halfSize) {
  vec2 d = p - c, ax = vec2(cos(ang), sin(ang));
  vec2 q = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
  if (abs(q.x) > halfSize.x + 5. || abs(q.y) > halfSize.y + 2.) return vec4(0.);
  float torn = 2.2 * (vnoise(vec2(q.y * .9, c.x)) - .5) + 1.2 * (vnoise(vec2(q.y * 2.7, c.y)) - .5);
  float cover = (1. - smoothstep(-.7, .7, abs(q.x) - halfSize.x - torn)) * (1. - smoothstep(-.7, .7, abs(q.y) - halfSize.y));
  if (cover <= 0.) return vec4(0.);
  float fibre = vnoise(vec2(q.x * .5, q.y * 3.)) - .5;
  vec3 col = vec3(.80, .835, .93) * (1. + .05 * fibre) * (.97 + .03 * smoothstep(halfSize.y, halfSize.y - 3., abs(q.y)));
  return vec4(col, 1.) * (cover * .74);
}
vec4 dab(vec2 p, vec2 c, float r, vec3 col, float seed, float centre) {
  vec2 d = p - c;
  float len = length(d);
  if (len > r + 2.5) return vec4(0.);
  float ang = atan(d.y, d.x);
  float rag = 1.5 * (vnoise(vec2(ang * 2.2 + seed, seed)) - .5);
  float cover = 1. - smoothstep(r - 1.2, r + .4, len + rag);
  if (cover <= 0.) return vec4(0.);
  float swirl = vnoise(vec2(ang * 1.6 + len * .55 + seed, len * .9));
  float h = cover * (.35 + .65 * sqrt(max(1. - len * len / (r * r), 0.)) + .35 * (swirl - .5));
  vec3 colour = mix(col * .8, col * 1.25 + .05, smoothstep(.3, .8, swirl));
  colour = mix(colour, CREAM, (1. - smoothstep(r * .42, r * .56, len + rag * .4)) * centre);
  return vec4(lit(colour, vec2(dFdx(h), dFdy(h)) * 3.2, .8, 1.), 1.) * cover;
}
float pencil(vec2 p, float dist, float weight) { return dist > 1.2 ? 0. : (1. - smoothstep(.3, 1.1, dist)) * weight * (.55 + .6 * vnoise(p * 1.3)); }
// a node on the ridge: the loaded dot a brush leaves when it presses down to end a stroke. Pressed in, dragged a
// little, lifted: a heavy body with a lip on its leading edge and a short dry flick where the brush left. wet: 1 on
// the hovered node, which is pressed heavier and wetter.
vec4 pressDab(vec2 p, vec2 c, float r, float seed, float wet) {
  vec2 d = p - c;
  if (dot(d, d) > r * r * 7.5) return vec4(0.);
  float ang = -.9 + 1.5 * hash11(seed * 3.7 + 1.), ca = cos(ang), sa = sin(ang);
  vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y) / r;                 // x runs the way the brush moved
  vec4 n = tn(vec2(q.y * 9. + seed * 7., q.x * 1.6 + seed));
  float body = 1. - smoothstep(.86, 1.02, length(vec2(q.x * .92 - .08, q.y * 1.12)) + .12 * (n.r - .5));
  float w = .50 * clamp(1. + q.x / 2.1, 0., 1.);                                 // the flick narrows to nothing behind
  float tail = step(q.x, 0.) * (1. - smoothstep(w - .1, w, abs(q.y + .12 * q.x * q.x))) * step(.34 + .5 * clamp(-q.x / 2.1, 0., 1.), n.g + .25);
  float cover = max(body, tail * .92);
  if (cover <= 0.) return vec4(0.);
  float h = body * (.55 + .5 * sqrt(max(1. - dot(q, q), 0.)) + .42 * exp(-pow((q.x - .58) / .2, 2.)) * (1. - smoothstep(.5, .95, abs(q.y)))) + .22 * tail + .14 * (n.b - .5) * cover;
  h *= 1. + .35 * wet;
  vec2 sl = vec2(dFdx(h), dFdy(h)) * (3. + wet);
  vec3 ink = mix(mix(vec3(.045, .075, .40), vec3(.03, .05, .30), body), mix(vec3(.50, .62, 1.), vec3(.36, .47, .96), body), uDark);      // on the dark sheet the mark is the light one
  vec3 col = lit(ink * (1. - .18 * wet), sl, .7 + .3 * wet, 1.);
  return vec4(col, 1.) * cover;
}
// The mountains under the ridge: brushwork painted once with PaintSim (baked/), stretched over the map box and lit
// here from its thickness. px: the size of a screen pixel on the sheet, for the lookups' level.
vec4 mountains(vec2 p, float px) {
  vec2 uv = (p - uMapBox.xy) / uMapBox.zw, gx = vec2(px / uMapBox.z, 0.), gy = vec2(0., px / uMapBox.w);
  float on = uMountOn * step(0., uv.x) * step(0., uv.y) * step(uv.x, 1.) * step(uv.y, 1.);
  vec4 c = textureGrad(uMount, uv, gx, gy) * on;
  // under a label the paint is a veil: thinner, and flat (no relief, no shine), fading back over some 16 px
  float veil = 1.;
  for (int i = 0; i < 24; i++) {
    vec4 b = uLabels[i];
    vec2 d = abs(p - b.xy - b.zw * .5) - b.zw * .5;
    float sd = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
    veil = min(veil, b.z > 1. ? smoothstep(-5., 17., sd) : 1.);
  }
  veil = veil * veil * (3. - 2. * veil);
  // and right behind the glyphs the paint gives way a little more, to the sheet's own colour: a soft halo, no edge
  vec4 own = textureLod(uSelf, p / uView, 0.);
  float ownLum = dot(own.rgb, vec3(.3, .5, .2)) / max(own.a, 1e-3);
  float halo = smoothstep(.008, .08, mix(.965 - ownLum, ownLum - .085, uDark)) * (1. - veil);
  vec2 e = 1.3 / uMapBox.zw;
  float hx = textureGrad(uMountR, uv + vec2(e.x, 0.), gx, gy).r - textureGrad(uMountR, uv - vec2(e.x, 0.), gx, gy).r;
  float hy = textureGrad(uMountR, uv + vec2(0., e.y), gx, gy).r - textureGrad(uMountR, uv - vec2(0., e.y), gx, gy).r;
  float gloss = textureGrad(uMountR, uv, gx, gy).g;
  vec3 col = lit(c.rgb / max(c.a, .004), vec2(hx, hy) * 5.5 * veil, .45 * gloss * veil, 1.);
  float shown = smoothstep(0., .1, uProgress * 1.12 - uv.x);              // they come up behind the ridge as it is drawn
  return vec4(col, 1.) * (c.a * shown * mix(.40, 1., veil) * (1. - .8 * halo));
}
vec4 strokeLayer(vec2 p) {
  vec2 uv = (p - uMapBox.xy) / uMapBox.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  vec4 s = texture(uStroke, uv);
  if (s.b < .5) return vec4(0.);
  float along = s.r, across = s.g, press = s.a;
  float bristle = vnoise(vec2(across * 2.6 + 3., along * .01));
  float fineB = vnoise(vec2(across * 7., along * .025 + 9.));
  float t = along / uLen;
  float dry = smoothstep(.80, 1., t);                           // the stroke thins as the brush empties
  float edge = 1. - smoothstep(.70, .98, abs(across) + .34 * (bristle - .5) + .1 * (fineB - .5));
  float gaps = 1. - max(dry, .7 * (1. - smoothstep(.2, .42, press))) * smoothstep(.52, .70, fineB);      // fast and light: the hairs break, flying white
  float reveal = smoothstep(0., 14., uProgress * (uLen + 14.) - along);
  float cover = edge * gaps * reveal;
  float h = cover * (.45 + .4 * bristle + .25 * fineB + .12 * (1. - across * across)) * (.42 + .8 * press);
  // the ridge line is laid in the iridescent mineral paint
  vec2 sl = vec2(dFdx(h), dFdy(h)) * 1.5;
  vec3 col = mineral(p, normalize(vec3(-sl, 1.)), clamp(length(sl) * 2.2, 0., 1.)) * (.8 + .3 * bristle);
  col = mix(col, lit(mix(vec3(.03, .05, .26), vec3(.50, .62, 1.), uDark), sl, .7 * cover, 1.), mix(.5, .62, uDark));                       // dark and loaded: the heaviest stroke on the sheet
  return vec4(col, 1.) * cover;
}

void main() {
  vec2 geo = vPos;                 // where on the sheet; p: which point of the sheet's content is drawn there
  vec2 p = turn(geo, uSpin);
  // the pointer carries a small light of its own: paint near it brightens and its ridges glint as it passes
  vec2 toPtr = uPtr.xy - p;
  float nearPtr = exp(-dot(toPtr, toPtr) / 52000.) * uPtr.z;
  gL = normalize(uLamp + normalize(vec3(toPtr, 150.)) * nearPtr * 1.3);
  float aa = max(fwidth(geo.x), fwidth(geo.y));
  float sd = box(geo, uRadius);
  float inside = 1. - smoothstep(-aa, aa, sd);
  float onSheet = step(0., p.x) * step(0., p.y) * step(p.x, uView.x) * step(p.y, uView.y);
  vec4 tex = texture(uTex, p / uView) * onSheet;
  vec4 c;
  if (uKind < .5) {
    // ---- ground: gessoed canvas, dots, and the visitor's paint
    float weave = weaveOf(p);
    float tone = canvasTone(p, weave);
    vec2 cell = mod(p, 20.) - 1.5;
    float dotSize = max(1.1, aa * .9);
    float dots = (1. - smoothstep(dotSize - .5, dotSize + .5, length(cell))) * min(1., 1.2 / aa);
    tone = mix(tone, 1. + (tone - 1.) * 4.5, uDark);                                  // the weave shows more on the dark gesso
    vec3 ground = mix(vec3(.965, .969, .984), vec3(.046, .054, .128), uDark) * tone;
    // the paint: lit as impasto by the board's lamp, from its height field
    vec2 puv = p / uView;
    vec4 pv = texture(uPaint, puv) * onSheet;
    float ph = pv.a;
    // calm under the words and inside the map window
    float quiet = max(1. - smoothstep(-6., 10., sdRound(p, uHero, 12.)), 1. - smoothstep(-10., 8., sdRound(p, uWin, 10.)));
    float wv = .5 + .5 * weave;
    float thin = 1. - smoothstep(.05, .30, ph);
    float cover = smoothstep(.012, .075, ph - .07 * wv * thin);                       // scraped thin, the weave shows through
    vec2 toLamp = normalize(uLamp.xy + 1e-4);
    float near = texture(uPaint, puv + toLamp * 4.5 / uView).a * onSheet, far = texture(uPaint, puv + toLamp * 11. / uView).a * onSheet;      // past the sheet's edge there is no paint to shade the board
    float flat_ = 1. - .75 * quiet;
    vec2 ex = vec2(1.1 / uView.x, 0.), ey = vec2(0., 1.1 / uView.y);
    vec2 slope = vec2(texture(uPaint, puv + ex).a - texture(uPaint, puv - ex).a, texture(uPaint, puv + ey).a - texture(uPaint, puv - ey).a);
    vec3 body = pv.rgb / max(clamp(ph * 8., 0., 1.), .001);
    body = pow(max(body, 0.), vec3(1. + .34 * smoothstep(.35, 1.2, ph)));             // thick paint is deeper and richer
    body *= mix(1., 1.16, uDark);
    float occ = max(0., near - ph) + .6 * max(0., far - ph);
    float shade = 1. - .5 * smoothstep(.02, .5, occ);                                 // furrows fall into soft shadow
    vec3 paintC = lit(body, slope * 3.4 * flat_, .9 * flat_, shade);
    vec3 nP = normalize(vec3(-slope * 3.4 * flat_, 1.)), hP = normalize(normalize(vec3(toPtr, 150.)) + vec3(0., 0., 1.));
    paintC += vec3(1., .985, .95) * pow(max(dot(nP, hP), 0.), 40.) * .7 * nearPtr * flat_ + body * .16 * nearPtr;
    vec2 mat = texture(uMatTex, puv).rg * onSheet;
    if (mat.r + mat.g > .02) {
      vec3 nM = normalize(vec3(-slope * 3.4 * flat_, 1.));
      float relief = clamp(length(slope) * 5., 0., 1.);
      if (mat.r > .02) paintC = mix(paintC, mineral(p, nM, relief) * (.55 + .45 * shade), clamp(mat.r, 0., 1.));
      if (mat.g > .02) {
        paintC = mix(paintC, goldLeaf(p, nM) * (.6 + .4 * shade), clamp(mat.g, 0., 1.));
        cover *= 1. - mat.g * smoothstep(.56, .74, tn(p * .33 + 5.).r) * thin;                // leaf breaks where it is thin: the ground shows
      }
    }
    float contact = (.6 * smoothstep(.03, .45, near) + .4 * smoothstep(.05, .6, far)) * (1. - cover);   // and the paint's edge shadows the canvas
    ground *= 1. - mix(.24, .5, uDark) * contact * flat_;
    float amount = cover * mix(1., .3, quiet);
    ground = mix(ground, paintC, amount);
    ground = mix(ground, mix(vec3(.80, .81, .875), vec3(.135, .15, .29), uDark) * tone, dots * (1. - amount));
    // pencil guides for the name, with a registration tick; then the palette: the page's colours, mixed and set down
    float guide = max(pencil(p, abs(p.y - uGuides.x), .34), pencil(p, abs(p.y - uGuides.y), .42)) * step(uGuides.z, p.x) * step(p.x, uGuides.w);
    guide = max(guide, pencil(p, abs(p.x - (uGuides.z + 12.)), .4) * step(uGuides.x - 9., p.y) * step(p.y, uGuides.y + 9.));
    ground = mix(ground, mix(vec3(.29, .31, .40), vec3(.52, .56, .74), uDark), guide);
    vec4 base = vec4(ground, 1.);
    for (int i = 0; i < 5; i++) {
      vec3 pc = i == 0 ? ULTRA * 1.1 : i == 1 ? vec3(.13, .24, .80) : i == 2 ? ORANGE : i == 3 ? vec3(.04, .46, .34) : vec3(.97, .94, .85);
      vec2 at = uPal.xy + vec2(uPal.z * float(i), 1.5 * sin(float(i) * 2.3));
      vec4 soft = vec4(.05, .06, .2, 1.) * (.16 * (1. - smoothstep(6., 13., length(p - at - vec2(2., 3.)))));
      base = over(dab(p, at, 9.5 + 1.5 * hash11(float(i) + 2.), pc, float(i) * 3.1 + 1., 0.), over(soft, base));
    }
    base *= mix(1., inside, smoothstep(0., .3, uOpen));
    c = over(tex, base);
  } else if (uKind < 1.5) {
    // ---- text: the name in oil, the button and chips as paint, then the page's words
    vec4 nameInk = vec4(0.);
    vec2 nuv = (p - uName.xy) / uName.zw;
    if (nuv.x > 0. && nuv.y > 0. && nuv.x < 1. && nuv.y < 1.) {
      float cov = clamp(tex.b - max(tex.r, tex.g), 0., 1.);
      tex -= vec4(0., 0., cov, cov);                            // take the data-coloured name out of the picture
    }
    // a selection (magenta, a data colour) becomes a wet orange stroke behind the words
    float sel = clamp(min(tex.r, tex.b) - tex.g, 0., 1.);
    float selName = 0.;
    if (nuv.x > 0. && nuv.y > 0. && nuv.x < 1. && nuv.y < 1. && sel > .003) { selName = sel; tex -= vec4(sel, 0., sel, sel); sel = 0.; }
    if (sel > .003) {
      vec3 ink = (tex.rgb - vec3(sel, 0., sel)) ;
      float inkA = clamp(tex.a - sel, 0., 1.);
      float streak = vnoise(vec2(p.x * .03, p.y * 1.7));
      vec3 wet = mix(ORANGE, vec3(1., .62, .22), smoothstep(.35, .8, streak)) * (.92 + .12 * streak);
      tex = over(vec4(ink, inkA), vec4(wet, 1.) * sel * .92);
    }
    // chips and buttons: PaintSim strokes. A hovered button is wetter, with a second pass laid over the blues.
    vec4 paint = vec4(0.);
    vec2 inA = abs(p - uInk[0].xy - uInk[0].zw * .5) - uInk[0].zw * .5, inB = abs(p - uInk[1].xy - uInk[1].zw * .5) - uInk[1].zw * .5;
    if (min(max(inA.x, inA.y), max(inB.x, inB.y)) < 0.) {      // the sheet's paint lies in the top bar and around the name and buttons
    paint = over(slotPaint(p, 4, 0.), slotPaint(p, 5, 0.));
    for (int i = 0; i < 4; i++) {
      float wet = uBtnHover == float(i) ? 1. : 0.;
      paint = over(slotPaint(p, i, wet), paint);
      vec4 b = uBtns[i];
      if (wet > .5 && i > 0) paint = over(swatch(p, vec4(b.x + 6., b.y + b.w * .30, b.z - 16., b.w * .30), vec3(.16, .26, .80), vec3(.30, .44, .92), vec3(.5, .62, .96), 0., .8, .9, float(i) * 9.) * .4, paint);
    }
    // top bar: a stroke under the hovered label, dabs for the language, wells of paint for the three places

    paint = over(dab(p, uLangA.xy, uLangA.z * (1. + .16 * uSwell.w), ULTRA * (1.15 + .2 * uSwell.w), 3., 0.), over(dab(p, uLangB.xy, uLangB.z - 1., mix(vec3(.80, .83, .96), vec3(.16, .19, .44), uDark), 6., 0.), paint));
    for (int i = 0; i < 3; i++) {
      vec3 wc = i == 0 ? vec3(.13, .22, .80) : i == 1 ? ORANGE : vec3(.04, .46, .34);
      paint = over(dab(p, uWells[i].xy, uWells[i].z * (1. + .34 * uSwell[i]), wc * (1. + .22 * uSwell[i]), float(i) * 4.3 + 2., 0.), paint);
      vec3 dc = i == 0 ? ORANGE : i == 1 ? vec3(.13, .22, .80) : vec3(.04, .46, .34);
      paint = over(dab(p, uDots.xy + vec2(uDots.z * float(i), 0.), 6.2, dc, float(i) * 2.9 + 7., 0.), paint);
    }
    paint = over(nameLayer(p, selName), paint);
    }
    paint.rgb *= 1. + nearPtr * (.16 + .5 * smoothstep(.62, 1., max(paint.r, max(paint.g, paint.b))));      // lit paint glints near the pointer
    // the crest catches the lamp: a soft light that travels across it as the pointer passes
    {
      vec2 cc = uCrest.xy + uCrest.zw * .5;
      float rc = uCrest.z * .5, dc = length(p - cc);
      vec2 spot = cc + clamp((uPtr.xy - cc) * .05, vec2(-rc * .55), vec2(rc * .55));
      float glow = exp(-dot(p - spot, p - spot) / (rc * rc * .42)) * (1. - smoothstep(rc - 1.5, rc - .5, dc)) * uPtr.z;
      tex.rgb += vec3(.55, .62, 1.) * glow * .30 * tex.a;
    }
    c = over(tex, paint);
    c = over(c, vec4(1.) * (.13 * uOpen * inside * uFrost));
  } else if (uKind < 2.5) {
    // ---- research map: the window, then the stroke, the dabs and the loop, then the labels
    // the three phases: three thin washes under their titles
    vec4 paint = vec4(0.);
    if (all(greaterThan(p, uWin.xy - 30.)) && all(lessThan(p, uWin.xy + uWin.zw + 30.))) {       // all of the paint lies on the sheet
    vec4 washes = vec4(0.);
    // each passage falls from the ridge to the foot of the sheet as a wash that pools and fades: the curve has mass
    float rx = (p.x - uMapBox.x) / uMapBox.z, foot = uMapBox.y + uMapBox.w - 30.;
    if (rx > 0. && rx < 1. && p.y < foot + 4.) {
      float f = rx * 47.;
      int k = int(floor(f));
      float ya = uRidge[k], yb = uRidge[min(k + 1, 47)];
      if (ya > 0. && yb > 0.) {
        float ry = mix(ya, yb, fract(f)), depth = p.y - ry;
        if (depth > 0.) {
          float t = depth / max(foot - ry, 40.), nz = .6 * tn(vec2(p.x * .016, p.y * .026 + 3.)).r + .4 * tn(vec2(p.x * .05 + 7., p.y * .07)).g;
          float fall = (1. - smoothstep(.0, 1., t + .34 * (nz - .5))) * smoothstep(0., 12., depth) * (1. - smoothstep(foot - 16., foot + 2., p.y));
          float pool = smoothstep(.05, 0., abs(t - (.5 + .5 * (nz - .5)))) * .5 + smoothstep(.035, 0., abs(t - (.86 + .2 * (nz - .5)))) * .35;
          float grain = .8 + .4 * tn(vec2(p.x * .9, p.y * .12)).b;
          vec3 wc = mix(mix(vec3(.20, .30, .92), vec3(.98, .52, .18), smoothstep(.315, .365, rx)), vec3(.07, .62, .45), smoothstep(.65, .70, rx));
          float past = smoothstep(uRidgeEnd - .02, uRidgeEnd + .06, rx);            // the unfinished mountain: fainter up and to the right
          fall *= mix(1., smoothstep(0., 130., depth) * (1. - .65 * smoothstep(uRidgeEnd, 1., rx)), past);
          washes = vec4(wc, 1.) * (mix(.20, .25, uDark) * fall * grain * (1. + pool));
        }
      }
    }
    for (int i = 0; i < 3; i++) {
      vec3 wc = i == 0 ? vec3(.20, .27, .90) : i == 1 ? vec3(.97, .50, .16) : vec3(.07, .62, .45);
      washes = over(wash(p, uPhases[i], wc, 30., 9., i == 1 ? .85 : 1.), washes);
    }
    paint = over(strokeLayer(p), over(mountains(p, aa), washes));
    // model and harness: two wet dabs that run into each other, and mix where they meet
    float r = uLoop.z * .5;
    vec2 a = uLoop.xy - vec2(r * .86, 0.), b = uLoop.xy + vec2(r * .86, 0.);
    vec4 la = wash(p, vec4(a - r, 2. * r, 2. * r), vec3(.16, .2, .86), r, 2.5, 2.3), lb = wash(p, vec4(b - r, 2. * r, 2. * r), MINT, r, 2.5, 2.3);
    vec4 loop = over(lb, la);
    float both = smoothstep(.0, .3, min(la.a, lb.a));
    // where they meet, the two run into each other: a deeper mixing zone
    loop = mix(loop, vec4(.05, .30, .44, 1.) * .78, both);
    // the token on the loop's orbit
    vec2 tok = uLoop.xy + uLoop.z * vec2(cos(uOrbit), sin(uOrbit));
    vec4 dabs = dab(p, tok, 4.6, ORANGE, 2.2, 0.);
    for (int i = 0; i < 7; i++) {
      float wet = uHover == float(i) ? 1. : 0., grow = 8.6 + 1.6 * hash11(float(i) * 5.1 + 2.) + 1.8 * wet;
      float shown = smoothstep(0., .04, uProgress - .1 - .11 * float(i));
      dabs = over(pressDab(p, uNodes[i].xy, max(grow * shown, .01), uNodes[i].z + float(i) * 1.7, wet), dabs);
    }
    paint = over(dabs, over(loop, paint));
    if (uCard.z > 1.) paint *= smoothstep(-1., 1., sdRound(p, uCard, 14.));       // the hover card lies over the paint
    }
    // the window's own picture: cards under the paint, words over it. Words are the dark, thin part of the picture.
    float lum = dot(tex.rgb, vec3(.3, .5, .2)) / max(tex.a, 1e-3);
    float dark = mix(1. - lum, lum, uDark);                    // on the dark sheet the words are the light part
    float words = smoothstep(.2, .46, dark) * tex.a;       // pencil thumbnails count as words: they stay above the paint
    vec4 cardPart = tex * (1. - words), wordPart = tex * words;
    c = over(wordPart, over(paint, cardPart));
    // tape at the sheet's upper corners
    c = over(tape(p, uWin.xy + vec2(30., 3.), -.62, vec2(34., 10.)), c);
    c = over(tape(p, uWin.xy + vec2(uWin.z - 30., 3.), .58, vec2(34., 10.)), c);
    c = over(c, vec4(1.) * (.13 * uOpen * inside * uFrost));
  } else {
    c = tex;
  }
  // a sheet's empty part shows nothing, shadows included: most of the words, map and annotations sheets
  if (uKind > .5 && c.a < .002 && (uOpen < .001 || abs(sd + aa) > 2. * aa)) discard;
  float shade = 1. - (1. - shadowOf(uS0, uHeights.x, geo, uCast.x, uSpinAbove.x)) * (1. - shadowOf(uS1, uHeights.y, geo, uCast.y, uSpinAbove.y)) * (1. - shadowOf(uS2, uHeights.z, geo, uCast.z, uSpinAbove.z));
  c.rgb = mix(c.rgb, vec3(.06, .07, .19) * c.a, shade);
  float edge = (1. - smoothstep(.6 * aa, 1.6 * aa, abs(sd + aa))) * uOpen;
  vec4 line = vec4(.16, .2, .78, 1.) * (edge * .62);
  o = over(line, c);
}`;
const BACK_FS = `
void main() {
  vec2 p = stagePx() / uView;
  float r = length((p - vec2(.5, .46)) * vec2(1., .82));
  vec3 c = mix(mix(vec3(.953, .957, .976), vec3(.078, .088, .19), uDark), mix(vec3(.862, .870, .915), vec3(.03, .036, .09), uDark), smoothstep(.1, .85, r));
  c += (hash12(gl_FragCoord.xy) - .5) / 255.;
  o = vec4(c, 1.);
}`;

/* ---------------------------------------------------------------- scene */
let sheetProgram, backProgram, quad, panelProgram, dimProgram, quadPanel;
let ribbonProgram;
let stampP, noiseTex;
const covers = [null, null, null, null];
const dirty = [true, true, true, true];
// what the last drawn frame showed (see frame): its key, the token's angle, and counts of what changes pictures
const drawn = { key: '', orbit: 0, stamps: 0, covers: 0, frames: 0, small: 0 };
let bakedVer = 0;
const paintJob = { key: '', name: null, atlas: null, tex: {}, slotBox: new Float32Array(24), slotUV: new Float32Array(24), box: [0, 0, 1, 1], start: 0, ms: 0 };
const stroke = { rt: null, geo: null, count: 0, len: 1, layVer: -1, start: -1 };
const swell = [0, 0, 0, 0];
const paint = { mat: null, jobs: [], rt: null, colour: 0, pigment: 0, down: false, at: [0, 0], dir: [1, 0], load: 1, travel: 0, seed: 1, pending: null, hover: null, seeded: false, scrape: -1, passes: 0, layVer: -1 };

function setOpen(on) {
  pose.target = on ? 1 : 0;
  button.setAttribute('aria-pressed', String(!!on));
  button.querySelector('span').textContent = (window.__boardCopy || {})[on ? 'collapse' : 'explode'] || (on ? 'collapse layers' : 'explode layers');
}
// The board opens as its stack of sheets (when the landing says so: see opensExploded in landing.js). Space, a click
// on empty board or on the hint "enters the page": the stack settles into the board. After that a tap on Space
// toggles the layers and holding it shows them while held.
const hint = document.querySelector('.board .enter-hint');
let latched = false, held = false, heldAt = 0, intro = !!window.__boardIntro && !STILL;
let hintTimer = 0;
function showHint(kind) {
  if (!hint) return;
  clearTimeout(hintTimer);
  hint.dataset.kind = kind || '';
  hint.classList.toggle('on', !!kind);
  hint.tabIndex = kind === 'enter' ? 0 : -1;
  if (kind === 'layers') hintTimer = setTimeout(() => showHint(''), 6000);
}
function enter() {
  if (!intro) return false;
  intro = false;
  latched = false;
  setOpen(false);
  try { sessionStorage.setItem('board-entered', '1'); } catch (error) { /* private mode */ }
  document.documentElement.classList.remove('board-intro');
  showHint('layers');
  return true;
}
if (intro) { latched = true; pose.e = 1; pose.target = 1; button.setAttribute('aria-pressed', 'true'); document.documentElement.classList.add('board-intro'); showHint('enter'); }
if (hint) hint.addEventListener('click', () => { enter(); hint.blur(); });
button.addEventListener('click', () => { if (enter()) { button.blur(); return; } latched = !latched; setOpen(latched); showHint(''); button.blur(); });
// the tour, a panel or the 3D world: first the page is entered
document.addEventListener('click', event => { if (intro && event.target.closest && event.target.closest('.mascot-guide, [data-action="mascot-toggle"], [data-action="start"]')) enter(); }, true);
addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (sheetOf(event.target)) return;   // inside a section sheet Space scrolls and presses, as usual
  if (!app || !app.live || document.querySelector('.experience.reading, .experience.playing, .experience.exhibiting')) return;   // a panel or the 3D world has the keyboard
  if (event.target.closest && event.target.closest('a, button, [role=button], .mascot-guide') && !(intro && event.target === hint)) return;
  event.preventDefault();
  if (intro) { enter(); held = false; return; }        // a tap or a hold: either one enters
  if (!held && !event.repeat) { held = true; heldAt = performance.now(); setOpen(!latched); showHint(''); }
});
const letGo = tap => { if (!held) return; held = false; if (tap) latched = !latched; setOpen(latched); };
addEventListener('keyup', event => { if (event.code === 'Space') letGo(performance.now() - heldAt < 260); });
addEventListener('blur', () => letGo(false));

const inBoxes = (list, p, pad) => list.some(b => b && p[0] >= b[0] - pad && p[1] >= b[1] - pad && p[0] <= b[0] + b[2] + pad && p[1] <= b[1] + b[3] + pad);
function fit(app, i, map = (x, y) => toSheet(app, i, x, y)) {
  const x = app.ptr.x, y = app.ptr.y, h = 1.5;
  const c = map(x, y), r = map(x + h, y), l = map(x - h, y), d = map(x, y + h), u = map(x, y - h);
  if (!(c && r && l && d && u)) return null;
  const a = (r[0] - l[0]) / (2 * h), b = (r[1] - l[1]) / (2 * h), cc = (d[0] - u[0]) / (2 * h), dd = (d[1] - u[1]) / (2 * h);
  const det = a * dd - b * cc;
  if (!isFinite(det) || Math.abs(det) < .02) return null;
  const A = dd / det, B = -b / det, C = -cc / det, D = a / det;
  return [A, B, C, D, x - A * c[0] - C * c[1], y - B * c[0] - D * c[1]];
}

/* ---- the name and the small strokes: painted by PaintSim, then handed to the GPU ---- */
function upload(gl, old, w, h, floats, data) {
  if (old) gl.deleteTexture(old);
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (floats) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
// colour as bytes with the paint's coverage in alpha (bare canvas has no thickness)
function colourBytes(r, g, b, h) {
  const n = h.length, out = new Uint8Array(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[j] = Math.min(255, r[i] * 255.99); out[j + 1] = Math.min(255, g[i] * 255.99); out[j + 2] = Math.min(255, b[i] * 255.99);
    out[j + 3] = Math.min(255, Math.max(0, h[i] * 2600));
  }
  return out;
}
function paintAll(app) {
  const gl = app.g.gl, t0 = performance.now(), scale = Math.max(1.5, Math.min(2, app.view.k)), lang = langNow();
  const N = NAMEPAINT.paint(PaintSim, lang, lay.nameSize, scale), B = N.buffers, G = N.ground, n = B.HT.length;
  const data = new Float32Array(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) { data[j] = B.HT[i]; data[j + 1] = G.h[i]; data[j + 2] = B.SP[i]; data[j + 3] = N.when[i]; }
  const T = paintJob.tex;
  T.nameC = upload(gl, T.nameC, N.pw, N.ph, false, colourBytes(B.CR, B.CG, B.CB, B.HT));
  T.nameG = upload(gl, T.nameG, N.pw, N.ph, false, colourBytes(G.r, G.g, G.b, G.h));
  T.nameD = upload(gl, T.nameD, N.pw, N.ph, true, data);
  paintJob.box = lay.name.slice(0, 2).concat([N.W, N.H]);
  if (lay.slots.length === 6) {
    const A = NAMEPAINT.strokes(PaintSim, lay.slots, scale), AB = A.buffers, m = AB.HT.length, ad = new Float32Array(m * 4);
    for (let i = 0, j = 0; i < m; i++, j += 4) { ad[j] = AB.HT[i]; ad[j + 1] = AB.SP[i]; }
    T.atlasC = upload(gl, T.atlasC, A.pw, A.ph, false, colourBytes(AB.CR, AB.CG, AB.CB, AB.HT));
    T.atlasD = upload(gl, T.atlasD, A.pw, A.ph, true, ad);
    lay.slots.forEach((slot, i) => {
      const r = A.rects[i], b = slot.box;
      paintJob.slotBox.set([b[0] - A.mx, b[1] - A.my, r[2], r[3]], i * 4);
      paintJob.slotUV.set([r[0] / A.W, r[1] / A.H, r[2] / A.W, r[3] / A.H], i * 4);
    });
  }
  paintJob.key = lay.key;
  paintJob.lang = lang;
  paintJob.ms = performance.now() - t0;
  if (!paintJob.start || paintJob.wroteLang !== lang) { paintJob.start = app.time + .35; paintJob.wroteLang = lang; }   // the name is written once per language
}
// the boxes move with the layout even when nothing has to be repainted
function placeSlots() {
  lay.slots.forEach((slot, i) => { paintJob.slotBox[i * 4] = slot.box[0] - 16; paintJob.slotBox[i * 4 + 1] = slot.box[1] - 7; });
  paintJob.box[0] = lay.name[0]; paintJob.box[1] = lay.name[1];
}

/* ---- the curve: a ribbon along the map's own path ---- */
function buildStroke(app) {
  const g = app.g, gl = g.gl, path = els.map.querySelector('.mapbox .crv');
  lay.ridge.fill(-1);
  if (path && lay.mapbox[2] > 1) {      // the curve's height across the sheet, for the washes that fall from it
    const total = path.getTotalLength(), W = lay.mapbox[2];
    for (let d = 0; d <= total; d += 2) { const pt = path.getPointAtLength(d), k = Math.round(pt.x / W * 47); if (k >= 0 && k < 48) { const y = lay.mapbox[1] + pt.y; lay.ridge[k] = lay.ridge[k] < 0 ? y : Math.min(lay.ridge[k], y); } }
    for (let k = 1; k < 47; k++) if (lay.ridge[k] < 0 && lay.ridge[k - 1] > 0 && lay.ridge[k + 1] > 0) lay.ridge[k] = (lay.ridge[k - 1] + lay.ridge[k + 1]) / 2;
    // past the curve's end the third mountain is not drawn yet: its slope (mapSVG's ext) carries the wash on, fainter
    const ext = mapSite && mapSite.map && mapSite.map.ext;
    lay.ridgeEnd = 2;
    if (ext) {
      lay.ridgeEnd = ext[0][0] / W;
      for (let k = 0; k < 48; k++) {
        const x = k / 47 * W, j = ext.findIndex((q, n) => n < ext.length - 1 && x >= q[0] && x <= ext[n + 1][0]);
        if (j >= 0 && lay.ridge[k] < 0) lay.ridge[k] = lay.mapbox[1] + ext[j][1] + (ext[j + 1][1] - ext[j][1]) * (x - ext[j][0]) / (ext[j + 1][0] - ext[j][0]);
      }
    }
  }
  if (!path || !path.getTotalLength) return;
  const total = path.getTotalLength();
  if (!(total > 10)) return;
  const N = Math.max(120, Math.round(total / 3)), ox = lay.mapbox[0], oy = lay.mapbox[1];
  const data = new Float32Array((N + 1) * 2 * 5);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wobble = Array.from({ length: 24 }, rand);
  // The ridge is one loaded stroke with an authored pressure: heavy where the brush lands, thin and quick on the long
  // climbs, swelling as it slows over each summit, into each valley floor and at each node (where it pauses and
  // leaves the heavy dot), and lifted into a flick at the end. Only a little irregularity is added.
  const pts = [], press = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const sAt = total * i / N, a = path.getPointAtLength(Math.max(0, sAt - 1.5)), b = path.getPointAtLength(Math.min(total, sAt + 1.5)), c = path.getPointAtLength(sAt);
    let tx = b.x - a.x, ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    pts.push([c.x + ox, c.y + oy, tx, ty, sAt]);
    let node = 0;
    for (let k = 0; k < 7; k++) { const nx = lay.nodes[k * 3], ny = lay.nodes[k * 3 + 1]; if (nx > -1e3) node = Math.max(node, Math.exp(-((c.x + ox - nx) ** 2 + (c.y + oy - ny) ** 2) / 1100)); }
    const slow = 1 - HIC.smooth(.35, .97, Math.abs(ty));
    press[i] = Math.min(1, .2 + .8 * Math.max(node, .9 * slow, Math.exp(-sAt / 30)));
  }
  for (let pass = 0; pass < 3; pass++) { const q = Float32Array.from(press); for (let i = 1; i < N; i++) press[i] = (q[i - 1] + 2 * q[i] + q[i + 1]) / 4; }
  stroke.press = [Math.min(...press), Math.max(...press)];
  for (let i = 0; i <= N; i++) {
    const [x, y, tx, ty, sAt] = pts[i], t = i / N, f = t * 23, i0 = Math.floor(f), fr = f - i0;
    const vary = wobble[i0] + (wobble[Math.min(23, i0 + 1)] - wobble[i0]) * fr;
    const pr = Math.min(1, press[i] * (.94 + .12 * vary)) * (1 - .82 * HIC.smooth(.94, 1, t));
    const half = (1.3 + 3.1 * pr) * HIC.smooth(0, .012, t + .004);
    for (let side = 0; side < 2; side++) {
      const sgn = side ? 1 : -1, o = (i * 2 + side) * 5;
      data[o] = x - ty * half * sgn * 1.25;
      data[o + 1] = y + tx * half * sgn * 1.25;
      data[o + 2] = sAt;
      data[o + 3] = sgn * 1.25;
      data[o + 4] = pr;
    }
  }
  if (stroke.geo) { gl.deleteVertexArray(stroke.geo.vao); stroke.geo.buffers.forEach(b => gl.deleteBuffer(b)); }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  stroke.geo = g.geometry(ribbonProgram, [{ name: 'aPos', size: 2, buffer, stride: 20, offset: 0 }, { name: 'aUV', size: 2, buffer, stride: 20, offset: 8 }, { name: 'aP', size: 1, buffer, stride: 20, offset: 16 }]);
  stroke.count = (N + 1) * 2;
  stroke.len = total;
  const k = app.view.k;
  stroke.rt = g.fit(stroke.rt, lay.mapbox[2] * k, lay.mapbox[3] * k, { fmt: 'rgba16f' });
  stroke.rt.clear(0, 0, 0, 0);
  g.draw(ribbonProgram, stroke.rt, { vao: stroke.geo.vao, mode: gl.TRIANGLE_STRIP, count: stroke.count }, { uBox: lay.mapbox });
  stroke.layVer = lay.ver;
  if (stroke.start < 0) stroke.start = app.time + .35;
}

/* ---- the paint ---- */
// colour (r, g, b), then how much of it is iridescent mineral and gold leaf
const PAINTS = [[.07, .105, .50, 0, 0], [.13, .27, .82, 0, 0], [.93, .35, .055, 0, 0], [.035, .43, .32, 0, 0], [.965, .93, .84, 0, 0],   // ultramarine, cobalt, cadmium orange, viridian, cream
  [.02, .09, .11, 1, 0], [.78, .55, .16, 0, 1]];                                         // 5 iridescent mineral, 6 gold leaf
const CYCLE = [0, 5, 1, 2, 3, 4];      // what a visitor's presses load, in turn
function sizePaint(app) {
  const g = app.g, { W, H } = app.view, s = Math.min(app.view.k, 2, Math.sqrt(4.4e6 / (W * H)));
  const w = Math.round(W * s), h = Math.round(H * s);
  if (paint.rt && paint.rt.w === w && paint.rt.h === h) { paint.forW = W; paint.forH = H; return; }
  const old = paint.rt && paint.seeded ? { rt: paint.rt, mat: paint.mat, W: paint.forW || W, H: paint.forH || H } : null;
  if (old) {      // strokes under the top bar's labels belong to the old layout: off with them before the paint moves
    paint.space = [old.W, old.H];
    for (const it of bar.values()) if (it.kind && it.strip) stamp(app, { uMode: 6, uBox: it.strip });
    paint.space = null;
    bar.clear();
  } else if (paint.rt) { paint.rt.free(); paint.mat.free(); }
  paint.rt = g.rt(w, h, { fmt: 'rgba16f', double: true });
  paint.mat = g.rt(w, h, { fmt: 'rg16f', double: true });
  paint.rt.clear(0, 0, 0, 0);
  paint.mat.clear(0, 0, 0, 0);
  paint.forW = W; paint.forH = H;
  if (!old) { paint.seeded = false; return; }
  // A window of another size: the paint is carried over, stretched with the window (the layout scales with it, so
  // a visitor's strokes stay about where they were). The baked paintings are lifted from where they were and set
  // down again where the new layout has them (stepBaked), without touching the rest.
  g.pass(stampP, paint.mat, { uMode: 7, uBaked: old.rt, uBakedR: old.mat, uSrc: paint.rt, uSrcM: paint.mat, uOut: 1, uSpace: [W, H] });
  g.pass(stampP, paint.rt, { uMode: 7, uBaked: old.rt, uBakedR: old.mat, uSrc: paint.rt, uSrcM: paint.mat, uOut: 0, uSpace: [W, H] });
  old.rt.free(); old.mat.free();
  drawn.stamps++;
  const kx = W / old.W, ky = H / old.H;
  paint.bakedAt = (paint.bakedAt || []).map(b => [b[0] * kx - 3, b[1] * ky - 3, b[2] * kx + 6, b[3] * ky + 6]);
  paint.bakedKey = '';
  paint.jobs = [];
}
function stamp(app, values, on = paint) {
  const v = Object.assign({ uA: [0, 0], uB: [0, 0], uDir: [1, 0], uR: 20, uLoad: 1, uSeed: 0, uMode: 0, uKnife: 0, uTravel: 0, uGain: 1, uColour: [0, 0, 0], uMat: [0, 0], uBox: [0, 0, 0, 0] }, values);
  if (values.pigment != null) { const c = PAINTS[values.pigment]; v.uColour = c.slice(0, 3); v.uMat = c.slice(3); }
  delete v.pigment;
  v.uSpace = on.space || [app.view.W, app.view.H];
  const touchesMat = v.uMode < 2.5 || v.uMode > 4.5;      // scraping only takes the thickness away
  if (touchesMat) app.g.pass(stampP, on.mat, Object.assign({}, v, { uSrc: on.rt, uSrcM: on.mat, uOut: 1 }));
  app.g.pass(stampP, on.rt, Object.assign(v, { uSrc: on.rt, uSrcM: on.mat, uOut: 0 }));
  if (on === paint) paint.passes += touchesMat ? 2 : 1;
  drawn.stamps++;
}
const dab = (app, x, y, pigment, R, seed, gain = 1) => stamp(app, { uMode: 1, uA: [x, y], uR: R, uSeed: seed, pigment: pigment, uGain: gain });
// one stroke along a path of sheet points; the load runs out over `reach` px
function strokeAlong(app, points, { pigment, R, seed, knife = 0, gain = 1, load = 1, reach = 300 }) {
  let travel = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < .01) continue;
    stamp(app, { uA: a, uB: b, uDir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], uR: R, uSeed: seed, uKnife: knife, uGain: gain, uTravel: travel, uLoad: load * Math.exp(-travel / reach), pigment: pigment });
    travel += L;
  }
}
const curve = (x0, y0, x1, y1, bend, steps = 14) => Array.from({ length: steps + 1 }, (_, k) => { const t = k / steps, nx = -(y1 - y0), ny = x1 - x0, s = Math.sin(t * Math.PI) * bend; return [x0 + (x1 - x0) * t + nx * s, y0 + (y1 - y0) * t + ny * s]; });
// The opening strokes are laid with the same stamps a visitor makes, a few per frame. queue() only lists them;
// stepPaint lays them.
function queue(job) { paint.jobs.push(job); }
const qDab = (x, y, pigment, R, seed, gain = 1) => queue({ uMode: 1, uA: [x, y], uR: R, uSeed: seed, pigment, uGain: gain });
function qStroke(points, { pigment, R, seed, knife = 0, gain = 1, load = 1, reach = 300 }) {
  let travel = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < .01) continue;
    queue({ uA: a, uB: b, uDir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], uR: R, uSeed: seed, uKnife: knife, uGain: gain, uTravel: travel, uLoad: load * Math.exp(-travel / reach), pigment });
    travel += L;
  }
}
// One light, from the upper left. A petal is a few curved, tapered strokes from its base to its ruffled edge: a cool
// dark one first on its shadow side, the petal itself, then thick cream where the light falls; a dark accent sits
// between a petal and the one it overlaps. Outer petals are large and open, inner ones small and upright round a
// cupped centre, and the seed pod is a small broken piece of gold.
// The opening marks: a knife stroke low in the left margin and a cobalt one off the right edge. The paintings
// themselves (the peony, the mountains) are baked: see "baked paintings" below.
/* ---------------------------------------------------------------- baked paintings
 * The board's paintings are not stroked on the GPU: they are painted once with PaintSim in Node (baked/*.gen.mjs,
 * see baked/README.md) and kept as two pictures each:
 *
 *   <file>.color.webp    premultiplied RGB, cover in alpha
 *   <file>.relief.webp   R thickness (255 = 3.2 PaintSim units), G gloss x cover, B metal x cover
 *
 * BAKED lists them: the file stem, the picture's size in the units it was painted in (CSS px at its intended size)
 * and the slot it goes in. A slot is a place the layout offers, measured in measure() -> placeBaked():
 *
 *   'ground'  set down into the ground sheet's paint (paint.rt / paint.mat) inside a rect of sheet px, with the
 *             stamp shader's mode 5. From then on it is the board's own paint: lit by the lamp, glinting at the
 *             pointer, painted over, scraped off. lay.baked[name] = [x, y, w, h], or absent when there is no room.
 *             The peony's two parts ('bloom', 'branch') share one space and one scale (README: the stem joins at
 *             the bloom's local (60, 270) = the branch's (960, 15)).
 *   'map'     drawn on the study sheet between the wash and the ridge, stretched from the picture's reference box
 *             (mapSVG(1100, 640)) to the map box, lit in SHEET_FS mountains().
 *
 * A missing file is skipped: import.meta.glob lists only what is in baked/. Add a painting by adding its files,
 * a line here and, for a new 'ground' slot, its rect in placeBaked(). `#nobaked` in the address leaves them all off.
 */
const BAKED = {
  bloom: { file: 'peony-bloom', size: [260, 270], slot: 'ground' },
  branch: { file: 'peony-branch', size: [960, 90], slot: 'ground' },
  mountains: { file: 'mountains', size: [1100, 640], slot: 'map' },
};
const bakedUrls = location.hash.includes('nobaked') ? {} : import.meta.glob('./baked/*.webp', { eager: true, query: '?url', import: 'default' });
const baked = { tex: {} };
function loadBaked(app) {
  for (const [name, item] of Object.entries(BAKED)) {
    const urls = ['color', 'relief'].map(kind => bakedUrls[`./baked/${item.file}.${kind}.webp`]);
    if (!urls[0] || !urls[1]) continue;
    // the colour is premultiplied already: the browser must not multiply it again, or convert its colours
    Promise.all(urls.map(url => fetch(url).then(r => r.blob()).then(blob => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })))).then(([c, r]) => {
      baked.tex[name] = { c: app.g.texture(c, c.width, c.height, { mips: true, wrap: 'clamp' }), r: app.g.texture(r, r.width, r.height, { mips: true, wrap: 'clamp' }) };
      bakedVer++;
    }).catch(error => app.note('baked ' + name + ': ' + error));
  }
}
// Where the peony goes on the ground sheet (sheet px). The bloom is the largest circle that touches nothing: it keeps
// 12 px clear of every line of the hero's words (their real ends, not the column), of the painted buttons and chips,
// of the study sheet and its shadow, of the status line and the palette, of the brush and of the window's edge. Its
// diameter is at most 200 px. The branch runs left from the bloom's stem in the strip between the buttons and the
// status line (bloom and branch share one scale: the join is the bloom's (60, 270) and the branch's (960, 15)).
function placeBaked() {
  lay.baked = {};
  lay.bloom = null;
  if (!textSite || !groundSite || !lay.win || lay.win[2] < 2 || !lay.slots.length) return;
  const W = innerWidth, H = innerHeight, CLEAR = 12;
  const status = groundSite.box('.status .now'), top = textSite.box('.top');
  const btns = lay.slots.slice(0, 4).map(sl => sl.box), btnBottom = Math.max(...btns.map(b => b[1] + b[3]));
  const yTop = btnBottom + 3, yBot = (status ? status[1] : H - 22) - 7;
  // what the bloom must not touch: boxes [x0, y0, x1, y1]
  const walls = [[-1e4, -1e4, 8 - CLEAR, 1e4], [W - 8 + CLEAR, -1e4, 1e4, 1e4], [-1e4, -1e4, 1e4, (top ? top[1] + top[3] : 80)], [-1e4, (status ? status[1] : H - 22), 1e4, 1e4]];
  const add = (b, grow = 0) => { if (b && b[2] > 0) walls.push([b[0] - grow, b[1] - grow, b[0] + b[2] + grow, b[1] + b[3] + grow]); };
  const root = textSite.root, range = document.createRange();
  for (const el of root.querySelectorAll('.role, .claim, .bio')) {      // each line of words, to its real end
    const b = textSite.box(el), r = el.getBoundingClientRect();
    if (!b || !r.width || !r.height) continue;
    range.selectNodeContents(el);
    const lineH = parseFloat(getComputedStyle(el).lineHeight) || 30;
    for (const q of range.getClientRects()) if (q.height < lineH * 1.7) add([b[0] + (q.left - r.left) * (b[2] / r.width), b[1] + (q.top - r.top) * (b[3] / r.height), q.width * (b[2] / r.width), q.height * (b[3] / r.height)]);      // lines only, not the block
  }
  for (const sl of lay.slots) add(sl.box, 3);                             // the painted buttons and chips, with their loose ends
  add(lay.swatch, 4);
  add(lay.win, 8);                                                        // the study sheet, its tape and the shadow at its edge
  walls.push([lay.win[0] - 8, lay.win[1] + lay.win[3], lay.win[0] + lay.win[2] + 22, lay.win[1] + lay.win[3] + 22]);      // the shadow under it
  if (lay.pal[0] > 0) add([lay.pal[0] - 14, lay.pal[1] - 14, 4 * lay.pal[2] + 28, 28]);
  if (lay.brush) add([lay.brush[0] - 12, lay.brush[1] - 196, 176, 214]);  // the Designer's brush, its stroke and its tag
  { const left = Math.max(18, lay.hero[0]), r0 = Math.min(22, left * .5); add([0, H * .46, r0 * 1.6 + 6, H * .26]); }       // the knife stroke in the left margin
  const room = (x, y) => { let d = 1e9; for (const w of walls) { const dx = Math.max(w[0] - x, 0, x - w[2]), dy = Math.max(w[1] - y, 0, y - w[3]); d = Math.min(d, Math.hypot(dx, dy)); if (d <= CLEAR) return 0; } return d - CLEAR; };
  const hits = (box, grow) => walls.some(w => box[0] < w[2] + grow && box[2] > w[0] - grow && box[1] < w[3] + grow && box[3] > w[1] - grow);
  // the branch for a bloom of radius r at (x, y): its join, and the box its paint fills (x from 29 of 960, y 9 to 83 of 90)
  const branchOf = (x, y, r) => { const s = r / 100, jx = x - 68 * s, jy = y + 140 * s; return { s, jx, jy, paint: [jx - 931 * s, jy - 6 * s, jx, jy + 68 * s] }; };
  // In the opened stack the text sheet floats over the ground, so its buttons and chips cover other ground than at
  // rest (about 70 px to the right). Of two places nearly as large, the bloom takes the one no button hides there;
  // it does not give up size for it: beside the buttons there is no place both large and clear of that.
  const btnRight = Math.max(...btns.map(b => b[0] + b[2])), lift = openShift(btnRight, btnBottom - 18);
  const covers = lay.slots.map(sl => [sl.box[0] + lift[0], sl.box[1] + lift[1], sl.box[0] + sl.box[2] + lift[0], sl.box[1] + sl.box[3] + lift[1]]);
  const hidden = (x, y, r) => covers.some(w => Math.hypot(Math.max(w[0] - x, 0, x - w[2]), Math.max(w[1] - y, 0, y - w[3])) < r);
  let withBranch = null, alone = null, cut = null;
  for (let y = 60; y < H - 20; y += 4) for (let x = 12; x < W - 12; x += 4) {
    let r = Math.min(100, room(x, y));
    if (r < 30) continue;
    if (!alone || r > alone.r) alone = { x, y, r };
    { // with only the branch's right end, where it rises to the bloom beside the buttons (for a strip too shallow)
      const br = branchOf(x, y, r), x0 = Math.max(btnRight + 8, br.jx - 330 * br.s);
      if (br.paint[3] <= yBot && br.jx - x0 > 40 * br.s && !hits([x0, br.paint[1], br.jx + 8 * br.s, br.paint[3]], 2) && (!cut || r > cut.r)) cut = { x, y, r, from: x0 };
    }
    // with its branch in the strip: the stem and leaves under the flower need room too, so the radius may have to give
    for (let pass = 0; pass < 3 && r >= 30; pass++) {
      const br = branchOf(x, y, r);
      if (br.paint[1] < yTop) break;                                      // too high for the strip at any size
      if (br.paint[3] > yBot) { r = Math.min(r - 2, (yBot - y) / 2.08); continue; }
      // the right third of the branch (bud, leaves, the rising stem) uses its whole height: it must clear the buttons
      if (hits([br.jx - 330 * br.s, br.paint[1], br.jx + 8 * br.s, br.paint[3]], 2)) { r -= 4; continue; }      // (a branch longer than the hero is wide loses its far end: see `from`)
      const score = hidden(x, y, r) ? r * .93 : r;
      if (!withBranch || score > withBranch.score) withBranch = { x, y, r, score };
      break;
    }
  }
  // a bloom that carries its branch into the strip comes first; where the strip is too shallow for one (a small
  // window), the bloom stands alone in the largest free place, with the branch only if that lies clear too
  // a bloom that carries its whole branch into the strip comes first; where the strip is too shallow for one at
  // 120 px (a small window), the bloom keeps the part of the branch that fits beside the buttons; failing that it
  // stands alone in the largest free place
  let pick = withBranch && withBranch.r >= 34 ? withBranch : null, branch = true, from = -1e4;
  if (pick && branchOf(pick.x, pick.y, pick.r).paint[0] < lay.hero[0] - 8) from = lay.hero[0] - 8;      // the twig's end, past the hero's left edge, is left off
  if (cut && (!pick || (pick.r < 60 && cut.r > pick.r + 6))) { pick = cut; from = cut.from; }
  if (!pick && alone && alone.r >= 40) { pick = alone; branch = false; }
  if (!pick) return;                                       // no room worth a flower: the board goes without
  const { s, jx, jy } = branchOf(pick.x, pick.y, pick.r);
  lay.bloom = { x: pick.x, y: pick.y, d: 2 * pick.r, branch, strip: !!withBranch && pick === withBranch, cut: pick === cut, free: alone ? 2 * alone.r : 0, want: lay.bloomWant, lift };
  lay.bakedFrom = from;
  lay.baked.bloom = [jx - 60 * s, jy - 270 * s, 260 * s, 270 * s];
  if (branch) lay.baked.branch = [jx - 960 * s, jy - 15 * s, 960 * s, 90 * s];
}
// set the ground's baked paintings down where the layout has them now; what lay in their old places is lifted first
function stepBaked(app) {
  const want = Object.keys(lay.baked || {}).filter(name => baked.tex[name]), key = want.map(name => name + lay.baked[name].map(v => v.toFixed(1))).join() + (lay.bakedFrom > 0 ? Math.round(lay.bakedFrom) : '');
  if (key === paint.bakedKey || paint.jobs.length || paint.scrape >= 0 || paint.down || performance.now() - lay.changedAt < 260) return;
  for (const box of paint.bakedAt || []) stamp(app, { uMode: 6, uBox: box });
  paint.bakedAt = want.map(name => lay.baked[name]);
  for (const name of want) stamp(app, { uMode: 5, uBox: lay.baked[name], uA: [name === 'branch' ? lay.bakedFrom : -1e4, 0], uBaked: baked.tex[name].c, uBakedR: baked.tex[name].r, uGain: 1 });
  paint.bakedKey = key;
}
function seedPaint(app) {
  const { W, H } = app.view, win = lay.win;
  paint.jobs = [];
  paint.bakedKey = '';      // the baked paintings go down again after these (stepPaint)
  paint.bakedAt = [];
  const left = Math.max(18, lay.hero[0]), r0 = Math.min(22, left * .5);
  qDab(r0 * .3, H * .50, 0, r0, 2.1, 1.05);
  qStroke(curve(r0 * .3, H * .505, r0 * .45, H * .70, .035, 12), { pigment: 0, R: r0, seed: 4.2, knife: 1, gain: 1.05, reach: 420 });
  qStroke(curve(-6, H * .655, left * .7, H * .61, -.12, 5), { pigment: 5, R: Math.min(9, left * .22), seed: 7.7, gain: .95, reach: 90 });
  const rr = Math.min(20, Math.max(12, (W - win[0] - win[2]) * .5));
  qDab(W - rr * .3, H * .30, 1, rr * .95, 5.3, 1);
  qStroke(curve(W - rr * .3, H * .305, W - rr * .1, H * .50, -.05, 10), { pigment: 1, R: rr * .86, seed: 9.4, gain: 1, reach: 150 });
  paint.seeded = true;
  paint.layVer = lay.ver;
}
// The top bar speaks in the same paint. A label under the pointer (or the keyboard) gets a short loaded stroke laid
// beneath it in real time, a little different each time; when it is left the stroke stays a moment and is scraped
// off with a knife. The stroke is the iridescent mineral paint; the open section keeps one in cadmium orange.
const bar = new Map();
const rnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function stepBar(app, dt) {
  (lay.barEls || []).forEach((el, index) => {
    if (!el.isConnected) return;
    let it = bar.get(el);
    if (!it) bar.set(el, it = { kind: '', p: 1, n: 0, hold: 0, wipe: -1, strip: null });
    const want = el.classList.contains('on') ? 'active' : el.matches(':hover, :focus-visible') && !paint.down ? 'hover' : '';
    if (it.wipe >= 0) {                                   // the knife takes it off
      it.wipe += app.reduced ? 1 : dt / .2;
      const s = it.strip;
      stamp(app, { uMode: 4, uBox: s, uA: [s[0] - 4 + (s[2] + 10) * Math.min(1, it.wipe), 0], uSeed: it.n });
      if (it.wipe >= 1) { it.wipe = -1; it.kind = ''; }
      return;
    }
    if (want && !it.kind) {                               // lay a new stroke: a lip where the brush lands, then the pull
      const b = textSite.box(el), nav = el.matches('.nav a'), active = want === 'active', r = k => rnd(index * 7 + 1, ++it.n * 13 + k);
      const x0 = b[0] + (nav ? 10 : 5) + r(1) * 3, len = b[2] - (nav ? 19 : 10) + (r(2) - .5) * 9, y0 = b[1] + b[3] - (nav ? 6.5 : 4.5) + (r(3) - .5) * 1.6;
      Object.assign(it, { kind: want, p: 0, hold: 0, from: [x0, y0], to: [x0 + len, y0 + Math.tan((r(4) - .5) * 6 * DEG) * len], len, last: [x0, y0],
        R: 5.3 * (.9 + .22 * r(5)), gain: 1.02 * (.86 + .28 * r(6)), dur: .18 + .06 * r(7), pigment: active ? 2 : 5, seed: 3 + r(8) * 60, travel: 0 });
      it.strip = [x0 - it.R * 2.2, Math.min(it.from[1], it.to[1]) - it.R * 2.2, len + it.R * 5, Math.abs(it.to[1] - it.from[1]) + it.R * 4.4];
      dab(app, x0, y0, it.pigment, it.R * 1.28, it.seed, it.gain * .8);
    }
    if (it.kind && it.p < 1) {
      it.p = Math.min(1, it.p + (app.reduced || STILL ? 1 : dt / it.dur));
      const e = 1 - Math.pow(1 - it.p, 1.7), at = [it.from[0] + (it.to[0] - it.from[0]) * e, it.from[1] + (it.to[1] - it.from[1]) * e], L = Math.hypot(at[0] - it.last[0], at[1] - it.last[1]);
      if (L > .2) {
        stamp(app, { uA: it.last, uB: at, uDir: [(at[0] - it.last[0]) / L, (at[1] - it.last[1]) / L], uR: it.R, uSeed: it.seed, uGain: it.gain, uTravel: it.travel, uLoad: Math.exp(-it.travel / (it.len * .8)), pigment: it.pigment });
        it.travel += L; it.last = at;
      }
    }
    if (it.kind && it.p >= 1 && want !== it.kind) {        // left, or changed between hovered and open: a moment, then the knife
      it.hold += dt;
      if (it.hold > (want ? .04 : .34) || app.reduced) { it.wipe = 0; it.hold = 0; }
    } else it.hold = 0;
  });
}
// pressing a label loads its stroke a little more
function pressBar(app, event) {
  const el = event.target.closest && event.target.closest('.nav a, .theme-button'), it = el && bar.get(el);
  const p = it && it.kind && toSheet(app, 0, event.clientX, event.clientY);
  if (p) dab(app, HIC.clamp(p[0], it.from[0], it.to[0]), (it.from[1] + it.to[1]) / 2, it.pigment, it.R * 1.7, it.seed + p[0], it.gain * 1.1);
}
function beginPaint(app, x, y) {
  paint.pigment = CYCLE[paint.colour++ % CYCLE.length];
  Object.assign(paint, { down: true, at: [x, y], load: 1, travel: 0, seed: 1 + Math.random() * 90, pending: [x, y] });
  document.documentElement.classList.add('painting');
}
function endPaint() { paint.down = false; document.documentElement.classList.remove('painting'); }
function scrapeClean() { if (paint.scrape < 0 && app && app.live) { paint.scrape = 0; paint.jobs = []; endPaint(); app.dirty(); } }
function stepPaint(app) {
  const view = app.view, dt = Math.min(app.dt, 1 / 30);
  paint.passes = 0;
  // the opening strokes wait for the page's layout (the palette row, the gutter); a new layout sets them down again
  if (!paint.seeded && lay.ver > 0 && lay.win[2] > 1) { seedPaint(app); bar.clear(); }
  if (paint.seeded) stepBaked(app);
  if (paint.jobs.length && paint.scrape < 0) {       // the opening painting, a few strokes a frame
    const n = STILL || app.reduced ? paint.jobs.length : 22;
    for (const job of paint.jobs.splice(0, n)) stamp(app, job);
  }
  if (paint.scrape >= 0) {
    paint.scrape += dt / (app.reduced ? .001 : .62);
    const f = Math.min(1, paint.scrape), x = -40 + (view.W + 90) * (f * f * (3 - 2 * f));
    stamp(app, { uMode: 3, uA: [x, 0], uSeed: 4.4 });
    if (f >= 1) { paint.rt.clear(0, 0, 0, 0); paint.mat.clear(0, 0, 0, 0); paint.scrape = -1; paint.colour = 0; seedPaint(app); bar.clear(); }
    return;
  }
  if (pose.e < .5 || bar.size) stepBar(app, dt);
  const here = toSheet(app, 0, app.ptr.x, app.ptr.y);
  if (paint.pending) {
    dab(app, paint.pending[0], paint.pending[1], paint.pigment, 23 + (paint.seed % 9), paint.seed, 1);
    paint.pending = null;
  }
  if (paint.down && !app.ptr.down) endPaint();
  if (paint.down && here) {
    const dx = here[0] - paint.at[0], dy = here[1] - paint.at[1], L = Math.hypot(dx, dy);
    if (L > 1.5) {
      // keep the heading steady over short moves, so the hairs do not jump from frame to frame
      const k = Math.min(1, L / 14), hx = paint.dir[0] * (1 - k) + dx / L * k, hy = paint.dir[1] * (1 - k) + dy / L * k, hl = Math.hypot(hx, hy) || 1;
      paint.dir = paint.travel > 0 ? [hx / hl, hy / hl] : [dx / L, dy / L];
      const steps = Math.min(4, Math.ceil(L / 26));
      for (let i = 0; i < steps; i++) {
        const a = [paint.at[0] + dx * i / steps, paint.at[1] + dy * i / steps], b = [paint.at[0] + dx * (i + 1) / steps, paint.at[1] + dy * (i + 1) / steps];
        stamp(app, { uA: a, uB: b, uDir: paint.dir, uR: 19, uSeed: paint.seed, uTravel: paint.travel, uLoad: Math.exp(-paint.travel / 330), pigment: paint.pigment });
        paint.travel += L / steps;
      }
      paint.at = here;
    }
  } else if (!paint.down && here && app.ptr.in && !STILL && paint.hover) {
    const dx = here[0] - paint.hover[0], dy = here[1] - paint.hover[1], L = Math.hypot(dx, dy);
    if (L > 1.2 && L < 70 && !current && pose.e < .02 && here[1] > TOP_BAR + 8) stamp(app, { uMode: 2, uA: paint.hover, uB: here, uR: 13 });      // not in the top bar: its strokes are laid and scraped by the bar itself
  }
  paint.hover = here;
}

const scene = {
  init(app) {
    const g = app.g;
    sheetProgram = g.mesh(SHEET_VS, SHEET_FS, 'sheet');
    backProgram = g.prog(BACK_FS, 'back');
    ribbonProgram = g.mesh(RIBBON_VS, RIBBON_FS, 'ribbon');
    stampP = g.prog(STAMP_FS, 'stamp');
    loadBaked(app);
    { const data = new Uint8Array(256 * 256 * 4); let x = 12345; for (let i = 0; i < data.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; data[i] = x >>> 24; } noiseTex = g.texture(data, 256, 256, { fmt: 'rgba8' }); }
    quad = g.geometry(sheetProgram, [{ name: 'aUV', size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) }]);
    panelProgram = g.mesh(PANEL_VS, PANEL_FS, 'panel');
    dimProgram = g.prog(DIM_FS, 'dim');
    quadPanel = g.geometry(panelProgram, [{ name: 'aUV', size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) }]);
  },
  resize() { dirty.fill(true); requestAnimationFrame(measure); },
  picture(app, layer) { dirty[layer.index] = true; },
  press(app, event) {
    if (!app.live || event.button) return;
    if (current) {      // a press on the board beside the open sheet puts it away, and drops no pigment
      if (!(event.target.closest && event.target.closest('.sheet, .labbar, .xbtn, .top a, .top button, .mascot-guide'))) { if (EXTERNAL) SECTIONS.onDismiss(); else closeSheet(true); }
      return;
    }
    pressBar(app, event);
    if (event.target.closest && event.target.closest('.labbar, .xbtn, .enter-hint, a, button, .node, [role=button], .mascot-guide, .pcard')) return;
    if (!event.target.closest || !event.target.closest('#hic, #stage')) return;   // a panel over the board took the press
    if (enter()) return;                                 // the first press on empty board enters the page
    if (pose.target > 0 || pose.e > .05) return;         // the layers are apart: no paint
    if (event.target.closest('.name, .role, .claim, .bio, .chips, .cta, .mapwin, .top, .status')) return;   // words are selected, not painted over
    const p = toSheet(app, 0, event.clientX, event.clientY);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] > app.view.W || p[1] > app.view.H) return;
    beginPaint(app, p[0], p[1]);
  },
  release() { endPaint(); },
  unproject(layer, x, y, app) {
    const i = layer.index;
    if (i >= 4) { const sheet = sheets[i - 4]; return sheet === current ? sheetIn(app, sheet, x, y) : null; }
    if (i === 3) return null;
    if (current) {      // under an open sheet only the top bar answers
      if (i !== 1) return null;
      const q = toSheet(app, 1, x, y);
      return q && q[1] < TOP_BAR && inBoxes(boxes.text, q, 6) ? q : null;
    }
    let p = toSheet(app, i, x, y);
    if (!p) return null;
    if (i === 2) {
      if (!inBoxes(boxes.map, p, 14)) return null;
      // With the stack apart the study sheet's top left corner floats over the top bar's controls (the language
      // button). Its margin and title strip hold nothing to press, so there a control underneath answers.
      if (pose.e > .3 && p[1] < lay.win[1] + 46) { const q = toSheet(app, 1, x, y); if (q && inBoxes(lay.controls || [], q, 3)) return null; }
      return spin(p[0], p[1]);
    }
    if (i === 1) return inBoxes(boxes.text, p, 6) ? p : null;
    if (i === 2) return inBoxes(boxes.map, p, 4) ? p : null;
    return p;
  },
  rest(layer, app) { return layer.index >= 4 ? fit(app, layer.index, (x, y) => sheetIn(app, sheets[layer.index - 4], x, y)) : fit(app, layer.index); },
  frame(app, force) {
    const g = app.g, gl = g.gl, view = app.view, layers = app.layers, ptr = app.ptr;
    updatePose(app);
    sizePaint(app);
    // repaint when the lettering's size, the language or a stroke's size changed; while a window is being dragged, wait
    if (paintJob.key !== lay.key && (!paintJob.key || performance.now() - lay.changedAt > 220)) paintAll(app);
    if (!paintJob.tex.nameC) return;
    placeSlots();
    const writeFor = paintJob.wroteLang === 'zh' ? 2.5 : 1.8, wt = HIC.clamp((app.time - paintJob.start) / writeFor, 0, 1);
    const write = STILL ? 1.01 : wt >= 1 ? 1.01 : wt;
    if (stroke.layVer !== lay.ver || !stroke.rt) buildStroke(app);
    stepPaint(app);
    for (let i = 0; i < 4; i++) {
      if (!dirty[i] && covers[i]) continue;
      covers[i] = g.fit(covers[i], view.W / 4, view.H / 4, { mips: true });
      g.blur(layers[i], covers[i], 1.5);
      covers[i].mip();
      dirty[i] = false;
      drawn.covers++;
    }
    if (pose.e > .003) app.freshMips(layers[3]);      // the annotations are drawn 1:1 at rest: mips only for the opened stack
    const e = Math.max(0, pose.e), R = pose.R;
    const rot = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
    // the lamp sits upper left and leans a little towards the pointer
    const lx = -.52 + .22 * pose.px, ly = -.60 + .18 * pose.py, lz = .62, ll = Math.hypot(lx, ly, lz);
    const progress = STILL ? 1 : HIC.clamp((app.time - stroke.start) / 2.6, 0, 1);
    const eased = progress < 1 ? 1 - Math.pow(1 - progress, 2.2) : 1;
    const on = els.map.querySelector('.mapbox .node.on');
    const hover = on && lay.ids ? lay.ids.indexOf(on.dataset.id) : -1;
    const btnHover = (lay.btnEls || []).findIndex(el => el.matches(':hover, :focus-visible'));
    const navOn = (lay.navEls || []).find(el => el.matches(':hover, :focus-visible')) || (lay.navOn && lay.navOn.isConnected ? lay.navOn : null);
    const navHover = navOn ? textSite.box(navOn) : [-1e4, 0, 0, 0];
    (lay.swellEls || []).forEach((el, k) => { const want = el && el.matches(':hover, :focus-within') ? 1 : 0; swell[k] += (want - swell[k]) * (app.reduced ? 1 : 1 - Math.exp(-app.dt * 14)); if (Math.abs(want - swell[k]) < .002) swell[k] = want; });
    stepSheets(app);
    const lifted = Math.max(HIC.clamp(ghost.t, 0, 1), ...sheets.map(sheet => HIC.clamp(sheet.t, 0, 1)));
    // A frame is drawn only when something it shows has changed: everything the picture depends on is in this key.
    // When the key stands, the last picture stands too (the canvas keeps it), and only the token on the loop's
    // orbit, the one thing that never rests, is drawn again inside its own small box.
    const orbit = STILL ? -.6 : app.time * .7;
    const key = [view.pw, view.ph, app.dark, pose.e, pose.px, pose.py, ptr.sx, ptr.sy, ptr.in, ptr.down,
      layers.map(layer => layer.ver), write, eased, hover, btnHover, navHover, Array.from(swell, v => v.toFixed(3)), drawn.stamps, drawn.covers, paint.scrape,
      sheets.map(sheet => [sheet.t.toFixed(4), sheet.c, sheet.angle.toFixed(5), sheet.open]), ghost.t.toFixed(4), ghost.tex ? 1 : 0, lay.ver, lay.key, lay.card, paintJob.key, stroke.layVer,
      current && current.id, bakedVer].join('|');
    let clip = null;
    if (!force && key === drawn.key) {
      if (STILL || !stroke.rt || !lay.loop || orbit === drawn.orbit) return;
      clip = [1e9, 1e9, -1e9, -1e9];
      for (const o of [orbit, drawn.orbit]) {
        const at = spin(lay.loop[0] + lay.loop[2] * Math.cos(o), lay.loop[1] + lay.loop[2] * Math.sin(o), -SPIN);
        for (const [du, dv] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { const q = project(app, 2, at[0] + du, at[1] + dv); clip = [Math.min(clip[0], q[0]), Math.min(clip[1], q[1]), Math.max(clip[2], q[0]), Math.max(clip[3], q[1])]; }
      }
    }
    drawn.key = key;
    drawn.orbit = orbit;
    drawn.frames++;
    if (clip) drawn.small++;
    g.clip = clip;
    if (e > 0) g.screen(backProgram, {});      // at rest the ground covers the whole window
    for (let i = 0; i < 4; i++) {
      const above = [i + 1, i + 2, i + 3].map(k => k < 4 ? k : -1);
      const uniforms = {
        uTex: layers[i], uRot: rot, uPose: [zOf(i), pose.scale, pose.tx, pose.ty], uEye: EYE,
        uMargin: i === 0 ? 900 * (1 - HIC.smooth(0, .3, e)) + 3 : 3,
        uS0: covers[above[0] < 0 ? i : above[0]], uS1: covers[above[1] < 0 ? i : above[1]], uS2: covers[above[2] < 0 ? i : above[2]],
        uHeights: above.map(k => k < 0 ? 0 : (k - i) * pose.gap),
        uOpen: e, uKind: i, uFrost: i === 3 ? 0 : 1,
        uCast: above.map(k => k === 3 ? 1 - HIC.smooth(0, .6, e) : 1 - .35 * e),
        uLight: [LIGHT[0] * (1 - .5 * e), LIGHT[1] * (1 - .5 * e)],
        uNoise: noiseTex, uRadius: SHEET_RADIUS, uLamp: [lx / ll, ly / ll, lz / ll],
        uSpin: i === 2 ? SPIN : 0, uSpinAbove: above.map(k => k === 2 ? SPIN : 0), uSpinC: lay.spinC, uWin: lay.win,
      };
      if (i === 0) Object.assign(uniforms, { uPaint: paint.rt, uMatTex: paint.mat, uHero: lay.quiet || lay.hero, uPal: lay.pal, uGuides: lay.guides });
      if (i === 1) Object.assign(uniforms, { uInk: lay.ink, uCrest: lay.crest || [-1e4, 0, 1, 1], uSwell: swell,  uNameC: paintJob.tex.nameC, uNameG: paintJob.tex.nameG, uNameD: paintJob.tex.nameD, uAtlasC: paintJob.tex.atlasC || paintJob.tex.nameC, uAtlasD: paintJob.tex.atlasD || paintJob.tex.nameD, uSlotBox: paintJob.slotBox, uSlotUV: paintJob.slotUV, uWrite: write, uName: paintJob.box, uBtns: lay.btns, uBtnHover: btnHover, uNavHover: navHover, uChipA: lay.chipA, uChipB: lay.chipB, uWells: lay.wells, uDots: lay.dots, uLangA: lay.langA, uLangB: lay.langB });
      if (i === 2 && stroke.rt) Object.assign(uniforms, { uStroke: stroke.rt, uMapBox: lay.mapbox, uRidge: lay.ridge, uRidgeEnd: lay.ridgeEnd || 2, uNodes: lay.nodes, uPhases: lay.phases, uLoop: lay.loop, uLen: stroke.len, uProgress: eased, uCard: lay.card, uHover: hover, uOrbit: orbit, uMount: baked.tex.mountains ? baked.tex.mountains.c : noiseTex, uMountR: baked.tex.mountains ? baked.tex.mountains.r : noiseTex, uMountOn: baked.tex.mountains ? 1 : 0, uLabels: lay.labels, uSelf: covers[2] });
      g.draw(sheetProgram, null, { vao: quad.vao, mode: gl.TRIANGLE_STRIP, count: 4 }, uniforms, { blend: true });
    }
    if (lifted > .003) {
      g.screen(dimProgram, { uA: .34 * lifted * (1 - .8 * e) }, { blend: true });      // the board dims; its pigment keeps moving
      if (ghost.t > .003 && ghost.tex) {      // the page just left: it goes under the one coming up
        const a = HIC.clamp(ghost.t, 0, 1);
        g.draw(panelProgram, null, { vao: quadPanel.vao, mode: gl.TRIANGLE_STRIP, count: 4 }, {
          uTex: ghost.tex, uRot: rot, uPose: [zOf(sheets[0].index), pose.scale, pose.tx, pose.ty], uEye: EYE, uSize: [ghost.cw, ghost.ch], uC: ghost.c, uAngle: ghost.angle,
          uA: HIC.smooth(0, .5, a), uLift: 1 + 1.8 * (1 - a) + 1.2 * e,
        }, { blend: true });
      }
      for (const sheet of [...sheets].sort((a, b) => a.open - b.open)) {             // one being put away goes under the open one
        const a = HIC.clamp(sheet.t, 0, 1), L = layers[sheet.index];
        if (a <= .003 || !L.tex || !L.cw) continue;
        g.draw(panelProgram, null, { vao: quadPanel.vao, mode: gl.TRIANGLE_STRIP, count: 4 }, {
          uTex: L, uRot: rot, uPose: [zOf(sheet.index), pose.scale, pose.tx, pose.ty], uEye: EYE, uSize: [L.cw, L.ch], uC: sheet.c, uAngle: sheet.angle,
          uA: HIC.smooth(0, .5, a), uLift: 1 + 1.8 * (1 - a) + 1.2 * e,
        }, { blend: true });
      }
    }
    g.clip = null;
    if (clip) return;
    const show = HIC.smooth(.55, 1, e);
    let labelTop = 1e9;
    for (let i = 3; i >= 0; i--) labelTop = Math.min(labelTop, project(app, i, 0, 24)[1] - 6);
    for (let i = 0; i < 5; i++) {
      const tag = tags[i];
      if (i === 4) {
        const on = current ? show * HIC.clamp(current.t, 0, 1) : 0;
        if (on <= 0) { if (tag.style.opacity !== '0') tag.style.opacity = '0'; continue; }
        const q = sheetOut(current, 0, 24), p = project(app, current.index, q[0], q[1]), column = project(app, 0, 0, 24)[0] - 18;
        const y = Math.min(p[1] - 6, labelTop - 24);      // the labels read 05 to 01 from the top
        tag.style.opacity = on.toFixed(3);
        tag.style.setProperty('--lead', Math.max(10, p[0] - column + 12).toFixed(1) + 'px');
        tag.style.transform = `translate(${(column - tag.dataset.w).toFixed(1)}px,${y.toFixed(1)}px)`;
        continue;
      }
      if (show <= 0) { if (tag.style.opacity !== '0') tag.style.opacity = '0'; continue; }
      const p = project(app, i, 0, 24), column = project(app, 0, 0, 24)[0] - 18;
      tag.style.opacity = show.toFixed(3);
      tag.style.setProperty('--lead', Math.max(10, p[0] - column + 12).toFixed(1) + 'px');
      tag.style.transform = `translate(${(column - tag.dataset.w).toFixed(1)}px,${(p[1] - 6).toFixed(1)}px)`;
    }
  },
};

app = HIC.start({ layers: [{ el: els.ground, mips: true }, { el: els.text, mips: true }, { el: els.map, mips: true }, { el: els.notes, mips: true }, ...sheets.map(sheet => ({ el: sheet.el, mips: true }))], scene, preserve: true, minWidth: (window.__boardMin || {}).width, minHeight: (window.__boardMin || {}).height });
app.layers[3].lazyMips = true;
const labMode = app.options.onMode;
app.options.onMode = (mode, why) => {
  if (mode === 'flat') for (const el of [els.text, els.map, els.ground, els.notes, ...sheets.map(sheet => sheet.el)]) app.stage.appendChild(el);
  if (mode === 'flat') for (const sheet of sheets) sheet.el.classList.toggle('shut', sheet !== current);
  if (mode === 'flat' && EXTERNAL) for (const sheet of sheets) { SECTIONS.home(sheet.id).appendChild(sheet.el); sheet.el.inert = false; sheet.el.classList.remove('shut'); }
  if (labMode) labMode(mode, why);
  measure();
};
if (document.documentElement.classList.contains('flat')) measure();
for (const tag of tags) tag.dataset.w = tag.offsetWidth || 110;
// The Designer's brush and the Critic's pencil work in short bursts: one stroke or one circle (.go), the mark stays a
// while (.kept), then fades in a few steps (--mo). Between bursts nothing on the annotations sheet moves, so the
// sheet keeps its picture: an animation that never ends would have it uploaded again every frame.
function runTool(el, run, period, first) {
  if (!el || STILL) return;
  const quiet = () => !app || !app.live || app.reduced || document.hidden || current || pose.target > 0 || pose.e > .02 || el.classList.contains('idle') || els.map.querySelector('.pcard.show');      // nor while a card is being read
  const burst = () => {
    if (quiet()) { setTimeout(burst, 1500); return; }
    el.classList.remove('kept');
    el.style.removeProperty('--mo');
    el.classList.add('go');
    setTimeout(() => el.classList.replace('go', 'kept'), run * 1000 + 50);
    for (let k = 1; k <= 8; k++) setTimeout(() => { if (k < 8) el.style.setProperty('--mo', (1 - k / 8).toFixed(3)); else { el.classList.remove('kept'); el.style.removeProperty('--mo'); } }, (period * .7 + k * period * .2 / 8) * 1000);
    setTimeout(burst, period * 1000);
  };
  setTimeout(burst, first * 1000);
}
runTool(els.notes.querySelector('.tool.d'), 2.7, 15, 1.2);
runTool(els.notes.querySelector('.tool.c'), 3.91, 17, 7);
// "Save this board": the canvas as it is now, with whatever pigment the visitor dropped. The drawing buffer is not
// kept between frames, so a frame is drawn and read in the same task.
{ const scrape = document.querySelector('.xbtn.scrape'); if (scrape) scrape.addEventListener('click', event => { scrapeClean(); event.currentTarget.blur(); }); }
document.querySelector('.xbtn.save').addEventListener('click', event => {
  if (!app.live) return;
  try {
    scene.frame(app, true);
    app.canvas.toBlob(blob => {
      if (!blob) return;
      window.__impasto.saved = blob.size;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'yaxin-luo-board.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  } catch (error) { app.note('save: ' + error); }
  event.currentTarget.blur();
});
fillSheets();
if (!EXTERNAL) { const sheet = sectionIn(hashParts().find(part => part.startsWith('section/'))); if (sheet) openSheet(sheet.id, null); }
setTimeout(paintSheets, 1500);      // the sheets' bits of paint, ahead of the first opening
let sheetKey = '';
window.__board = { app, measure, markNav, sheet(open, label, key) {
    if (!sheets.length) return;
    if (!open) { sheetKey = ''; closeSheet(); return; }
    enter();
    const again = current === sheets[0], turned = again && key !== undefined && key !== sheetKey;
    sheetKey = key;
    openSheet(sheets[0].id, null);
    // another page in the same element: its old picture slides off, the new one comes up from below
    if (turned && keepGhost()) { sheets[0].t = 0; sheets[0].v = 0; app.dirty(); }
    if (label) tags[4].querySelector('span').textContent = label;
  }, lang: langNow, setLanguage(lang) { if (textSite && textSite.lang !== lang) textSite.setLanguage(lang); }, setOpen };
window.__impasto = { drawn, sheets, ghost, get current() { return current; }, openSheet, closeSheet, pose, setOpen, project, toSheet, paint, dab: (x, y, pigment = CYCLE[paint.colour++ % CYCLE.length], R = 26) => { dab(app, x, y, pigment, R, 1 + Math.random() * 90); app.dirty(); }, strokeAlong: (points, options) => { strokeAlong(app, points, options); app.dirty(); }, scrapeClean, enter, get intro() { return intro; }, lay, paintJob, stroke };
})();
