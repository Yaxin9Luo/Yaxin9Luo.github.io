/*
 * The painter's board (from lab/html-in-canvas/05-impasto): oil paint, water and layers. A module for its side
 * effect; it expects window.SITE (landing.js's `site`), HIC, HAND, NAMEPAINT and, for the effect, PaintSim.
 *
 * 05 · Impasto: oil paint, water and layers.
 *
 * The page is 04's stack of four sheets (ground, text, research map, annotations) in a cool white palette, and
 * three things are painted:
 *
 *   the name      thick oil paint. The glyph coverage gives a direction field (structure tensor: which way each
 *                 stem runs); bristle streaks are noise smeared along that field; from them a colour layer and a
 *                 thickness layer are painted ONCE per picture, and each frame only re-lights them.
 *   the curve     one loaded brush stroke. A ribbon along the map's path is drawn once into a texture that holds
 *                 "how far along" and "how far across"; the bristles, the dry end and the draw-on come from those.
 *   the water     a small fluid simulation on the ground sheet (velocity, pressure, four pigments). A click drops
 *                 pigment, the pointer stirs it. Pigments do not average into mud: the strongest one wins at each
 *                 point, as floating paints do in marbling, and it is shown as absorption over the white ground.
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
  }
  const e = pose.e, ease = HIC.smooth(0, 1, e);
  let wantX = 0, wantY = 0;
  if (!app.reduced && ptr.in) { wantX = HIC.clamp(ptr.x / view.W * 2 - 1, -1, 1); wantY = HIC.clamp(ptr.y / view.H * 2 - 1, -1, 1); }
  if (current) { wantX *= .2; wantY *= .2; }   // a sheet being read holds almost still
  if (!ptr.down) {
    const k = 1 - Math.exp(-dt * 5);
    pose.px += (wantX - pose.px) * k;
    pose.py += (wantY - pose.py) * k;
  }
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
const lay = { slots: [], nameSize: 86, strokeCount: 0, changedAt: 0, spinC: [0, 0], btns: new Float32Array(16), wells: new Float32Array(9), phases: new Float32Array(12), dots: [-1e4, 0, 18], langA: [-1e4, 0, 14], langB: [-1e4, 0, 14], pal: [-1e4, 0, 27], guides: [0, 0, 0, 0], zh: [0, 0, 0, 0], swatch: [0, 0, 1, 1], card: [0, 0, 0, 0], name: [0, 0, 1, 1], btn: [0, 0, 0, 0], chipA: [0, 0, 0, 0], chipB: [0, 0, 0, 0], hero: [0, 0, 0, 0], win: [0, 0, 0, 0], mapbox: [0, 0, 1, 1], nodes: new Float32Array(24), loop: [0, 0, 0], ver: 0 };

const SPIN = -1.1 * Math.PI / 180;   // the study sheet hangs a little crooked
// geometric point on the map sheet -> the point of its HTML drawn there (and back with -angle)
function spin(x, y, angle = SPIN) {
  const cx = lay.spinC[0], cy = lay.spinC[1], c = Math.cos(angle), s = Math.sin(angle), dx = x - cx, dy = y - cy;
  return [cx + c * dx + s * dy, cy - s * dx + c * dy];
}
function measure() {
  if (!textSite || !mapSite) return;
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
  d.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  d.style.setProperty('--ax', '0px'); d.style.setProperty('--ay', '0px'); d.style.setProperty('--bx', '74px'); d.style.setProperty('--by', '-7px');
  d.style.setProperty('--rx', '76px'); d.style.setProperty('--ry', '10px');
  const target = nodes.find(n => n.id === 'ad');
  if (target) {
    const at = spin(target.x, target.y, -SPIN);
    c.style.translate = `${at[0].toFixed(1)}px ${at[1].toFixed(1)}px`;
    // the pencil lies under the node's label when the sheet has room there, else to the node's upper right
    const mkNow = mapSite.map ? mapSite.map.mk : 1, below = lay.mapbox[1] + lay.mapbox[3] - (target.y + 52 * mkNow);
    c.style.setProperty('--rx', below >= 62 ? '14px' : '26px'); c.style.setProperty('--ry', below >= 62 ? (52 * mkNow + 12).toFixed(0) + 'px' : '-70px');
    c.classList.toggle('up', below < 62);
    // keep the whole pencil on the sheet: shorten it if the sheet's right edge is near
    const room = win[0] + win[2] - 14 - (at[0] + (below >= 62 ? 14 : 26));
    c.style.setProperty('--s', Math.min(1, Math.max(.55, room / 156)).toFixed(3));
  }

  // layout for the shaders (sheet px)
  lay.hero = hero;
  lay.win = win;
  lay.mapbox = mapSite.box('.mapbox') || lay.mapbox;
  lay.btns.fill(0);
  all('.cta .btn').slice(0, 4).forEach((b, i) => lay.btns.set(textSite.box(b), i * 4));
  // the painted strokes: four buttons, two chips
  const kinds = ['orange', 'ultra', 'cobalt', 'viridian', 'pale blue', 'pale mint'];
  lay.slots = [...all('.cta .btn').slice(0, 4), q('.chip'), q('.chip.g')].map((el, i) => { const b = el ? textSite.box(el) : [0, 0, 1, 1]; return { box: b, w: Math.round(b[2]), h: Math.round(b[3]), kind: kinds[i] }; });
  lay.btnEls = all('.cta .btn');
  lay.navEls = all('.nav a');
  lay.chipA = textSite.box('.chip') || lay.chipA;
  lay.chipB = textSite.box('.chip.g') || lay.chipB;
  const dots = textSite.box('.top .wdots');
  if (dots) lay.dots = [dots[0] + 4 + 5.5, dots[1] + dots[3] / 2, 18];
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
  const key = [lay.name, lay.mapbox, Array.from(lay.btns), lay.slots.map(sl => sl.w + 'x' + sl.h), Array.from(lay.nodes), langNow()].join();
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
uniform vec4 uBox;
out vec2 vUV;
void main() {
  vUV = aUV;
  vec2 q = (aPos - uBox.xy) / uBox.zw * 2. - 1.;
  gl_Position = vec4(q, 0., 1.);
}`;
const RIBBON_FS = `
in vec2 vUV;
void main() { o = vec4(vUV.x, vUV.y, 1., 1.); }`;

/* ---------------------------------------------------------------- the water */
const FLUID_COMMON = `
uniform vec2 uTexel;
#define UV (gl_FragCoord.xy / uRes)
`;
const ADVECT_FS = FLUID_COMMON + `
uniform sampler2D uVel, uSrc;
uniform float uDt, uDye, uKeep;
void main() {
  vec2 v = texture(uVel, UV).xy;
  vec2 from = UV - v * uDt / uView;
  vec4 c = texture(uSrc, from);
  if (uDye > .5) {
    float total = c.r + c.g + c.b + c.a;
    c *= 1. - uDt * mix(1. / 40., 1. / 5., smoothstep(.06, .6, total));   // thick paint thins fast, a stain lingers
  } else {
    c *= uKeep;
    vec2 e = min(UV, 1. - UV) * uView;                                    // still water at the sheet's edge
    c.xy *= smoothstep(0., 24., min(e.x, e.y));
  }
  o = c;
}`;
const SPLAT_FS = FLUID_COMMON + `
uniform sampler2D uSrc;
uniform vec2 uAt;       // sheet px
uniform float uSize;    // px
uniform vec4 uValue;
uniform float uPush;    // outward velocity at the blob's rim, px/s
void main() {
  vec2 d = UV * uView - uAt;
  float g = exp(-dot(d, d) / (uSize * uSize));
  vec4 add = uValue * g;
  add.xy += normalize(d + 1e-4) * uPush * g * (1. - g) * 4.;
  o = texture(uSrc, UV) + add;
}`;
const CURL_FS = FLUID_COMMON + `
uniform sampler2D uVel;
void main() {
  float l = texture(uVel, UV - vec2(uTexel.x, 0.)).y, r = texture(uVel, UV + vec2(uTexel.x, 0.)).y;
  float b = texture(uVel, UV - vec2(0., uTexel.y)).x, t = texture(uVel, UV + vec2(0., uTexel.y)).x;
  o = vec4(.5 * ((r - l) - (t - b)));
}`;
const FORCE_FS = FLUID_COMMON + `
uniform sampler2D uVel, uCurl;
uniform float uDt, uSwirl, uDrift;
void main() {
  float l = abs(texture(uCurl, UV - vec2(uTexel.x, 0.)).r), r = abs(texture(uCurl, UV + vec2(uTexel.x, 0.)).r);
  float b = abs(texture(uCurl, UV - vec2(0., uTexel.y)).r), t = abs(texture(uCurl, UV + vec2(0., uTexel.y)).r);
  float c = texture(uCurl, UV).r;
  vec2 n = vec2(r - l, t - b);
  n /= length(n) + 1e-4;
  vec2 v = texture(uVel, UV).xy + uSwirl * uDt * c * vec2(n.y, -n.x);
  // a slow wandering current, so the water is never quite still
  vec2 p = UV * uView * .0042;
  float e = .35;
  float n0 = fbm(p + vec2(0., uTime * .035)), nx = fbm(p + vec2(e, uTime * .035)), ny = fbm(p + vec2(0., e + uTime * .035));
  v += uDrift * uDt * vec2(ny - n0, -(nx - n0)) / e;
  o = vec4(v, 0., 1.);
}`;
const DIVERGENCE_FS = FLUID_COMMON + `
uniform sampler2D uVel;
void main() {
  float l = texture(uVel, UV - vec2(uTexel.x, 0.)).x, r = texture(uVel, UV + vec2(uTexel.x, 0.)).x;
  float b = texture(uVel, UV - vec2(0., uTexel.y)).y, t = texture(uVel, UV + vec2(0., uTexel.y)).y;
  o = vec4(.5 * ((r - l) + (t - b)));
}`;
const PRESSURE_FS = FLUID_COMMON + `
uniform sampler2D uPrs, uDiv;
void main() {
  float l = texture(uPrs, UV - vec2(uTexel.x, 0.)).r, r = texture(uPrs, UV + vec2(uTexel.x, 0.)).r;
  float b = texture(uPrs, UV - vec2(0., uTexel.y)).r, t = texture(uPrs, UV + vec2(0., uTexel.y)).r;
  o = vec4((l + r + b + t - texture(uDiv, UV).r) * .25);
}`;
const GRADIENT_FS = FLUID_COMMON + `
uniform sampler2D uPrs, uVel;
void main() {
  float l = texture(uPrs, UV - vec2(uTexel.x, 0.)).r, r = texture(uPrs, UV + vec2(uTexel.x, 0.)).r;
  float b = texture(uPrs, UV - vec2(0., uTexel.y)).r, t = texture(uPrs, UV + vec2(0., uTexel.y)).r;
  o = vec4(texture(uVel, UV).xy - .5 * vec2(r - l, t - b), 0., 1.);
}`;

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
uniform sampler2D uDye;
uniform vec4 uHero, uWin;
// text
uniform sampler2D uNameC, uNameG, uNameD;   // PaintSim's buffers: finished colour, ground colour, (height, ground height, gloss, when)
uniform sampler2D uAtlasC, uAtlasD;        // the small strokes: colour, (height, gloss)
uniform float uWrite;                       // 0..1: how much of the name has been written
uniform vec4 uSlotBox[6], uSlotUV[6];
uniform vec4 uName, uChipA, uChipB, uNavHover;
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
uniform float uLen, uProgress, uHover, uOrbit;
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
// the canvas: fine weave and broad gesso marks, as a brightness factor
float canvasTone(vec2 p) {
  float weave = sin(p.x * 2.6 + .6 * sin(p.y * .9)) * sin(p.y * 2.6 + .6 * sin(p.x * .9));
  float marks = fbm(vec2(p.x * .012 + p.y * .004, p.y * .16)) - .5;
  float tooth = hash12(floor(p * 1.5)) - .5;
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
vec4 strokeLayer(vec2 p) {
  vec2 uv = (p - uMapBox.xy) / uMapBox.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  vec4 s = texture(uStroke, uv);
  if (s.b < .5) return vec4(0.);
  float along = s.r, across = s.g;
  float bristle = vnoise(vec2(across * 2.6 + 3., along * .01));
  float fineB = vnoise(vec2(across * 7., along * .025 + 9.));
  float t = along / uLen;
  float dry = smoothstep(.80, 1., t);                           // the stroke thins as the brush empties
  float edge = 1. - smoothstep(.70, .98, abs(across) + .34 * (bristle - .5) + .1 * (fineB - .5));
  float gaps = 1. - dry * smoothstep(.42, .62, fineB);
  float reveal = smoothstep(0., 14., uProgress * (uLen + 14.) - along);
  float cover = edge * gaps * reveal;
  float h = cover * (.45 + .4 * bristle + .25 * fineB + .12 * (1. - across * across));
  vec3 col = mix(ULTRA, ULTRA_MID, smoothstep(.3, .75, bristle));
  col = mix(col, ULTRA_LIGHT, smoothstep(.72, .95, fineB) * .6);
  col = mix(col, ULTRA * .6, smoothstep(.35, .1, bristle) * .5);
  return vec4(lit(col, vec2(dFdx(h), dFdy(h)) * 1.5, .75 * cover, 1.), 1.) * cover;
}

void main() {
  vec2 geo = vPos;                 // where on the sheet; p: which point of the sheet's content is drawn there
  vec2 p = turn(geo, uSpin);
  float aa = max(fwidth(geo.x), fwidth(geo.y));
  float sd = box(geo, uRadius);
  float inside = 1. - smoothstep(-aa, aa, sd);
  float onSheet = step(0., p.x) * step(0., p.y) * step(p.x, uView.x) * step(p.y, uView.y);
  vec4 tex = texture(uTex, p / uView) * onSheet;
  vec4 c;
  if (uKind < .5) {
    // ---- ground: gessoed canvas, dots, and the pigment in the water
    float tone = canvasTone(p);
    vec2 cell = mod(p, 20.) - 1.5;
    float dotSize = max(1.1, aa * .9);
    float dots = (1. - smoothstep(dotSize - .5, dotSize + .5, length(cell))) * min(1., 1.2 / aa);
    tone = mix(tone, 1. + (tone - 1.) * 4.5, uDark);                                  // the weave shows more on the dark gesso
    vec3 ground = mix(vec3(.965, .969, .984), vec3(.046, .054, .128), uDark) * tone;
    vec4 d = texture(uDye, p / uView) * onSheet;
    float total = d.r + d.g + d.b + d.a;
    vec4 w = d * d * d;
    w /= max(w.r + w.g + w.b + w.a, 1e-6);                     // the strongest pigment wins: paints float side by side
    vec3 pig = w.r * vec3(.16, .22, .80) + w.g * vec3(.98, .47, .13) + w.b * vec3(.13, .70, .52) + w.a * vec3(1., .99, .95);
    float tint = 1. - w.a;                                      // cream is clear water: it parts the colours
    float film = .12 * smoothstep(.0, .06, total) + .88 * smoothstep(.10, .30, total);                  // floating paint has an edge
    float amount = film * (.30 + .62 * (1. - exp(-total * 2.4))) * tint;
    vec2 dx = vec2(4. / uView.x, 0.), dy = vec2(0., 4. / uView.y);
    vec4 gx = texture(uDye, p / uView + dx) - texture(uDye, p / uView - dx), gy = texture(uDye, p / uView + dy) - texture(uDye, p / uView - dy);
    float rim = length(vec2(gx.r + gx.g + gx.b, gy.r + gy.g + gy.b));
    amount = clamp(amount * (.82 + .9 * smoothstep(.02, .5, rim)), 0., 1.);          // pigment gathers at its edges
    amount *= 1. + .9 * (tone - 1.) * 6.;                                             // and in the canvas's grain
    // calm under the words and inside the map window
    float quiet = max(1. - smoothstep(-10., 90., sdRound(p, uHero, 30.)), 1. - smoothstep(-10., 40., sdRound(p, uWin, 16.)));
    amount *= mix(1., .09, quiet) * mix(1., .72, uOpen * 0.);
    // light board: pigment absorbs (subtractive). Dark board: it floats lit from within, added softly, so it glows
    vec3 lightG = ground * mix(vec3(1.), pig, clamp(amount, 0., .93));
    vec3 glow = pig * pig * (.20 + .5 * amount) * clamp(amount * 1.5, 0., 1.);
    ground = mix(lightG, ground * (1. - .35 * clamp(amount, 0., 1.)) + glow, uDark);
    ground = mix(ground, mix(vec3(.80, .81, .875), vec3(.135, .15, .29), uDark) * tone, dots * (1. - amount * .8));
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
    vec4 paint = over(slotPaint(p, 4, 0.), slotPaint(p, 5, 0.));
    for (int i = 0; i < 4; i++) {
      float wet = uBtnHover == float(i) ? 1. : 0.;
      paint = over(slotPaint(p, i, wet), paint);
      vec4 b = uBtns[i];
      if (wet > .5 && i > 0) paint = over(swatch(p, vec4(b.x + 6., b.y + b.w * .30, b.z - 16., b.w * .30), vec3(.16, .26, .80), vec3(.30, .44, .92), vec3(.5, .62, .96), 0., .8, .9, float(i) * 9.) * .4, paint);
    }
    // top bar: a stroke under the hovered label, dabs for the language, wells of paint for the three places
    paint = over(swatch(p, vec4(uNavHover.x + 7., uNavHover.y + uNavHover.w - 9., uNavHover.z - 14., 5.), ORANGE_DEEP, ORANGE, vec3(1., .66, .25), 0., 1., .7, 2.), paint);
    paint = over(dab(p, uLangA.xy, uLangA.z, ULTRA * 1.15, 3., 0.), over(dab(p, uLangB.xy, uLangB.z - 1., mix(vec3(.80, .83, .96), vec3(.16, .19, .44), uDark), 6., 0.), paint));
    for (int i = 0; i < 3; i++) {
      vec3 wc = i == 0 ? vec3(.13, .22, .80) : i == 1 ? ORANGE : vec3(.04, .46, .34);
      paint = over(dab(p, uWells[i].xy, uWells[i].z, wc, float(i) * 4.3 + 2., 0.), paint);
      vec3 dc = i == 0 ? ORANGE : i == 1 ? vec3(.13, .22, .80) : vec3(.04, .46, .34);
      paint = over(dab(p, uDots.xy + vec2(uDots.z * float(i), 0.), 6.2, dc, float(i) * 2.9 + 7., 0.), paint);
    }
    paint = over(nameLayer(p, selName), paint);
    c = over(tex, paint);
    c = over(c, vec4(1.) * (.13 * uOpen * inside * uFrost));
  } else if (uKind < 2.5) {
    // ---- research map: the window, then the stroke, the dabs and the loop, then the labels
    // the three phases: three thin washes under their titles
    vec4 washes = vec4(0.);
    for (int i = 0; i < 3; i++) {
      vec3 wc = i == 0 ? vec3(.20, .27, .90) : i == 1 ? vec3(.97, .50, .16) : vec3(.07, .62, .45);
      washes = over(wash(p, uPhases[i], wc, 30., 9., i == 1 ? .85 : 1.), washes);
    }
    vec4 paint = over(strokeLayer(p), washes);
    // model and harness: two wet dabs that run into each other, and mix where they meet
    float r = uLoop.z * .5;
    vec2 a = uLoop.xy - vec2(r * .86, 0.), b = uLoop.xy + vec2(r * .86, 0.);
    vec4 la = wash(p, vec4(a - r, 2. * r, 2. * r), vec3(.16, .2, .86), r, 2.5, 2.3), lb = wash(p, vec4(b - r, 2. * r, 2. * r), MINT, r, 2.5, 2.3);
    vec4 loop = over(lb, la);
    float both = smoothstep(.0, .3, min(la.a, lb.a));
    loop = mix(loop, vec4(.08, .36, .58, 1.) * .62, both);
    // the token on the loop's orbit
    vec2 tok = uLoop.xy + uLoop.z * vec2(cos(uOrbit), sin(uOrbit));
    vec4 dabs = dab(p, tok, 4.6, ORANGE, 2.2, 0.);
    for (int i = 0; i < 7; i++) {
      float grow = uHover == float(i) ? 12.5 : 9.5;
      float shown = smoothstep(0., .04, uProgress - .1 - .11 * float(i));
      dabs = over(dab(p, uNodes[i].xy, grow * shown, ULTRA * 1.05, uNodes[i].z + float(i), 1.), dabs);
    }
    paint = over(dabs, over(loop, paint));
    if (uCard.z > 1.) paint *= smoothstep(-1., 1., sdRound(p, uCard, 14.));       // the hover card lies over the paint
    // the window's own picture: cards under the paint, words over it. Words are the dark, thin part of the picture.
    float lum = dot(tex.rgb, vec3(.3, .5, .2)) / max(tex.a, 1e-3);
    float dark = mix(1. - lum, lum, uDark);                    // on the dark sheet the words are the light part
    float words = smoothstep(.25, .6, dark) * tex.a;
    vec4 cardPart = tex * (1. - words), wordPart = tex * words;
    c = over(wordPart, over(paint, cardPart));
    // tape at the sheet's upper corners
    c = over(tape(p, uWin.xy + vec2(30., 3.), -.62, vec2(34., 10.)), c);
    c = over(tape(p, uWin.xy + vec2(uWin.z - 30., 3.), .58, vec2(34., 10.)), c);
    c = over(c, vec4(1.) * (.13 * uOpen * inside * uFrost));
  } else {
    c = tex;
  }
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
let advect, splat, curlP, forceP, divP, prsP, gradP;
const covers = [null, null, null, null];
const dirty = [true, true, true, true];
const paintJob = { key: '', name: null, atlas: null, tex: {}, slotBox: new Float32Array(24), slotUV: new Float32Array(24), box: [0, 0, 1, 1], start: 0, ms: 0 };
const stroke = { rt: null, geo: null, count: 0, len: 1, layVer: -1, start: -1 };
const water = { vel: null, prs: null, div: null, curl: null, dye: null, next: 0, colour: 0, pours: [], seeded: false, lastX: 0, lastY: 0, cloudAt: 3 };

function setOpen(on) {
  pose.target = on ? 1 : 0;
  button.setAttribute('aria-pressed', String(!!on));
  button.querySelector('span').textContent = on ? 'collapse layers' : 'explode layers';
}
let latched = false, held = false;
button.addEventListener('click', () => { latched = !latched; setOpen(latched); button.blur(); });
addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (sheetOf(event.target)) return;   // inside a section sheet Space scrolls and presses, as usual
  if (!app || !app.live || document.querySelector('.experience.reading, .experience.playing, .experience.exhibiting')) return;   // a panel or the 3D world has the keyboard
  if (event.target.closest && event.target.closest('a, button, [role=button], .mascot-guide')) return;
  event.preventDefault();
  if (!held) { held = true; setOpen(!latched); }
});
addEventListener('keyup', event => { if (event.code === 'Space' && held) { held = false; setOpen(latched); } });
addEventListener('blur', () => { if (held) { held = false; setOpen(latched); } });

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
  if (!path || !path.getTotalLength) return;
  const total = path.getTotalLength();
  if (!(total > 10)) return;
  const N = Math.max(120, Math.round(total / 3)), ox = lay.mapbox[0], oy = lay.mapbox[1];
  const data = new Float32Array((N + 1) * 2 * 4);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wobble = Array.from({ length: 24 }, rand);
  for (let i = 0; i <= N; i++) {
    const s = total * i / N;
    const a = path.getPointAtLength(Math.max(0, s - 1.5)), b = path.getPointAtLength(Math.min(total, s + 1.5)), c = path.getPointAtLength(s);
    let tx = b.x - a.x, ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const t = i / N, f = t * 23, i0 = Math.floor(f), fr = f - i0;
    const vary = wobble[i0] + (wobble[Math.min(23, i0 + 1)] - wobble[i0]) * fr;
    // a loaded start, a body that breathes, a thinner end
    const half = (3.3 + 1.5 * vary) * (1 + .5 * Math.exp(-t * 40)) * (1 - .32 * HIC.smooth(.8, 1, t)) * HIC.smooth(0, .012, t + .004);
    for (let side = 0; side < 2; side++) {
      const sgn = side ? 1 : -1, o = (i * 2 + side) * 4;
      data[o] = c.x + ox - ty * half * sgn * 1.25;
      data[o + 1] = c.y + oy + tx * half * sgn * 1.25;
      data[o + 2] = s;
      data[o + 3] = sgn * 1.25;
    }
  }
  if (stroke.geo) { gl.deleteVertexArray(stroke.geo.vao); stroke.geo.buffers.forEach(b => gl.deleteBuffer(b)); }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  stroke.geo = g.geometry(ribbonProgram, [{ name: 'aPos', size: 2, buffer, stride: 16, offset: 0 }, { name: 'aUV', size: 2, buffer, stride: 16, offset: 8 }]);
  stroke.count = (N + 1) * 2;
  stroke.len = total;
  const k = app.view.k;
  stroke.rt = g.fit(stroke.rt, lay.mapbox[2] * k, lay.mapbox[3] * k, { fmt: 'rgba16f' });
  stroke.rt.clear(0, 0, 0, 0);
  g.draw(ribbonProgram, stroke.rt, { vao: stroke.geo.vao, mode: gl.TRIANGLE_STRIP, count: stroke.count }, { uBox: lay.mapbox });
  stroke.layVer = lay.ver;
  if (stroke.start < 0) stroke.start = app.time + .35;
}

/* ---- the water ---- */
const PIGMENTS = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];   // ultramarine, orange, mint, cream
function sizeWater(app) {
  const g = app.g, W = app.view.W, H = app.view.H;
  const sw = Math.round(W / 3), sh = Math.round(H / 3);
  if (water.vel && water.vel.w === sw && water.vel.h === sh) return;
  for (const key of ['vel', 'prs', 'div', 'curl', 'dye']) if (water[key]) water[key].free();
  water.vel = g.rt(sw, sh, { fmt: 'rg16f', double: true });
  water.prs = g.rt(sw, sh, { fmt: 'r16f', double: true });
  water.div = g.rt(sw, sh, { fmt: 'r16f' });
  water.curl = g.rt(sw, sh, { fmt: 'r16f' });
  water.dye = g.rt(Math.round(W), Math.round(H), { fmt: 'rgba16f', double: true });
  water.seeded = false;
}
function addDye(app, x, y, size, pigment, amount) {
  const v = PIGMENTS[pigment].map(c => c * amount);
  app.g.pass(splat, water.dye, { uSrc: water.dye, uAt: [x, y], uSize: size, uValue: v, uPush: 0 });
}
function addPush(app, x, y, size, vx, vy, outward) {
  app.g.pass(splat, water.vel, { uSrc: water.vel, uAt: [x, y], uSize: size, uValue: [vx, vy, 0, 0], uPush: outward || 0 });
}
function drop(app, x, y, pigment, strength = 1) {
  water.pours.push({ x, y, pigment, t: 0, life: .55, strength, angle: Math.random() * 6.28 });
}
function seedWater(app) {
  // a few soft stains already in the water when the page opens, in the margins and the gutter
  const { W, H } = app.view, win = lay.win, hero = lay.hero;
  const gutter = (hero[0] + hero[2] + win[0]) / 2;
  const spots = [[W * .022, H * .34, 0, 44, .8], [gutter + 2, H * .22, 1, 26, .7], [gutter - 4, H * .74, 2, 30, .7], [W * .985, H * .60, 0, 40, .8], [W * .33, H * .972, 1, 30, .6], [W * .60, H * .028, 2, 30, .6], [gutter, H * .48, 3, 18, .9]];
  for (const [x, y, pigment, size, amount] of spots) {
    addDye(app, x, y, size, pigment, amount);
    addPush(app, x, y, size * 2.5, Math.sin(x) * 60, Math.cos(y) * 60, 40);
  }
  water.seeded = true;
}
function stepWater(app) {
  const g = app.g, dt = Math.min(app.dt, 1 / 30), view = app.view;
  const texel = [1 / water.vel.w, 1 / water.vel.h];
  if (!water.seeded) seedWater(app);
  // pointer: a gentle stir
  const here = toSheet(app, 0, app.ptr.sx, app.ptr.sy);
  if (here && app.ptr.in && !STILL) {
    const vx = (here[0] - water.lastX) / dt, vy = (here[1] - water.lastY) / dt, speed = Math.hypot(vx, vy);
    if (speed > 8 && speed < 6000) addPush(app, here[0], here[1], 46, HIC.clamp(vx, -900, 900) * .22, HIC.clamp(vy, -900, 900) * .22, 0);
  }
  if (here) { water.lastX = here[0]; water.lastY = here[1]; }
  // pigment being poured
  for (const pour of water.pours) {
    const f = pour.t / pour.life, size = 26 + 30 * f;
    addDye(app, pour.x, pour.y, size, pour.pigment, 1.9 * dt / pour.life * pour.strength * (1.2 - f));
    addPush(app, pour.x, pour.y, size * 2.2, 0, 0, (STILL ? 50 : 150) * (1 - f) * pour.strength);
    if (!STILL) {   // an off-centre twist, so the bloom curls instead of staying a disc
      const a = pour.angle + f * 5;
      addPush(app, pour.x + Math.cos(a) * size, pour.y + Math.sin(a) * size, size * .9, -Math.sin(a) * 190, Math.cos(a) * 190, 0);
    }
    pour.t += dt;
  }
  water.pours = water.pours.filter(p => p.t < p.life);
  // idle: now and then a faint cloud drifts in from a margin
  if (!STILL && app.time > water.cloudAt) {
    water.cloudAt = app.time + 5 + Math.random() * 4;
    const { W, H } = view, side = Math.floor(Math.random() * 4);
    const x = side === 0 ? W * .03 : side === 1 ? W * .97 : W * (.1 + .8 * Math.random());
    const y = side < 2 ? H * (.15 + .7 * Math.random()) : side === 2 ? H * .05 : H * .95;
    const pigment = water.colour++ % 3;
    addDye(app, x, y, 26 + 14 * Math.random(), pigment, .5);
    addPush(app, x, y, 150, (W / 2 - x) * .09, (H / 2 - y) * .09, 0);
  }
  g.pass(curlP, water.curl, { uVel: water.vel, uTexel: texel });
  g.pass(forceP, water.vel, { uVel: water.vel, uCurl: water.curl, uTexel: texel, uDt: dt, uSwirl: STILL ? 0 : 16, uDrift: STILL ? 0 : 5 });
  g.pass(divP, water.div, { uVel: water.vel, uTexel: texel });
  for (let i = 0; i < 18; i++) g.pass(prsP, water.prs, { uPrs: water.prs, uDiv: water.div, uTexel: texel });
  g.pass(gradP, water.vel, { uPrs: water.prs, uVel: water.vel, uTexel: texel });
  g.pass(advect, water.vel, { uVel: water.vel, uSrc: water.vel, uTexel: texel, uDt: dt, uDye: 0, uKeep: Math.exp(-dt * .45) });
  g.pass(advect, water.dye, { uVel: water.vel, uSrc: water.dye, uTexel: texel, uDt: dt, uDye: 1, uKeep: 1 });
}

const scene = {
  init(app) {
    const g = app.g;
    sheetProgram = g.mesh(SHEET_VS, SHEET_FS, 'sheet');
    backProgram = g.prog(BACK_FS, 'back');
    ribbonProgram = g.mesh(RIBBON_VS, RIBBON_FS, 'ribbon');
    advect = g.prog(ADVECT_FS, 'advect');
    splat = g.prog(SPLAT_FS, 'splat');
    curlP = g.prog(CURL_FS, 'curl');
    forceP = g.prog(FORCE_FS, 'force');
    divP = g.prog(DIVERGENCE_FS, 'divergence');
    prsP = g.prog(PRESSURE_FS, 'pressure');
    gradP = g.prog(GRADIENT_FS, 'gradient');
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
    if (event.target.closest && event.target.closest('.labbar, .xbtn, a, button, .node, [role=button], .mascot-guide, .pcard')) return;
    if (!event.target.closest || !event.target.closest('#hic, #stage')) return;   // a panel over the board took the press
    const p = toSheet(app, 0, event.clientX, event.clientY);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] > app.view.W || p[1] > app.view.H) return;
    drop(app, p[0], p[1], water.colour++ % 4, 1);
  },
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
    if (i === 2) { if (!inBoxes(boxes.map, p, 14)) return null; return spin(p[0], p[1]); }
    if (i === 1) return inBoxes(boxes.text, p, 6) ? p : null;
    if (i === 2) return inBoxes(boxes.map, p, 4) ? p : null;
    return p;
  },
  rest(layer, app) { return layer.index >= 4 ? fit(app, layer.index, (x, y) => sheetIn(app, sheets[layer.index - 4], x, y)) : fit(app, layer.index); },
  frame(app) {
    const g = app.g, gl = g.gl, view = app.view, layers = app.layers;
    updatePose(app);
    sizeWater(app);
    // repaint when the lettering's size, the language or a stroke's size changed; while a window is being dragged, wait
    if (paintJob.key !== lay.key && (!paintJob.key || performance.now() - lay.changedAt > 220)) paintAll(app);
    if (!paintJob.tex.nameC) return;
    placeSlots();
    const writeFor = paintJob.wroteLang === 'zh' ? 2.5 : 1.8, wt = HIC.clamp((app.time - paintJob.start) / writeFor, 0, 1);
    const write = STILL ? 1.01 : wt >= 1 ? 1.01 : wt;
    if (stroke.layVer !== lay.ver || !stroke.rt) buildStroke(app);
    stepWater(app);
    for (let i = 0; i < 4; i++) {
      if (!dirty[i] && covers[i]) continue;
      covers[i] = g.fit(covers[i], view.W / 4, view.H / 4, { mips: true });
      g.blur(layers[i], covers[i], 1.5);
      covers[i].mip();
      dirty[i] = false;
    }
    const e = Math.max(0, pose.e), R = pose.R;
    g.screen(backProgram, {});
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
        uRadius: SHEET_RADIUS, uLamp: [lx / ll, ly / ll, lz / ll],
        uSpin: i === 2 ? SPIN : 0, uSpinAbove: above.map(k => k === 2 ? SPIN : 0), uSpinC: lay.spinC, uWin: lay.win,
      };
      if (i === 0) Object.assign(uniforms, { uDye: water.dye, uHero: lay.hero, uPal: lay.pal, uGuides: lay.guides });
      if (i === 1) Object.assign(uniforms, { uNameC: paintJob.tex.nameC, uNameG: paintJob.tex.nameG, uNameD: paintJob.tex.nameD, uAtlasC: paintJob.tex.atlasC || paintJob.tex.nameC, uAtlasD: paintJob.tex.atlasD || paintJob.tex.nameD, uSlotBox: paintJob.slotBox, uSlotUV: paintJob.slotUV, uWrite: write, uName: paintJob.box, uBtns: lay.btns, uBtnHover: btnHover, uNavHover: navHover, uChipA: lay.chipA, uChipB: lay.chipB, uWells: lay.wells, uDots: lay.dots, uLangA: lay.langA, uLangB: lay.langB });
      if (i === 2 && stroke.rt) Object.assign(uniforms, { uStroke: stroke.rt, uMapBox: lay.mapbox, uNodes: lay.nodes, uPhases: lay.phases, uLoop: lay.loop, uLen: stroke.len, uProgress: eased, uCard: lay.card, uHover: hover, uOrbit: STILL ? -.6 : app.time * .7 });
      g.draw(sheetProgram, null, { vao: quad.vao, mode: gl.TRIANGLE_STRIP, count: 4 }, uniforms, { blend: true });
    }
    stepSheets(app);
    const lifted = Math.max(HIC.clamp(ghost.t, 0, 1), ...sheets.map(sheet => HIC.clamp(sheet.t, 0, 1)));
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

app = HIC.start({ layers: [{ el: els.ground, mips: true }, { el: els.text, mips: true }, { el: els.map, mips: true }, { el: els.notes, mips: true }, ...sheets.map(sheet => ({ el: sheet.el, mips: true }))], scene, minWidth: (window.__boardMin || {}).width, minHeight: (window.__boardMin || {}).height });
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
// "Save this board": the canvas as it is now, with whatever pigment the visitor dropped. The drawing buffer is not
// kept between frames, so a frame is drawn and read in the same task.
document.querySelector('.xbtn.save').addEventListener('click', event => {
  if (!app.live) return;
  try {
    scene.frame(app);
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
    const again = current === sheets[0], turned = again && key !== undefined && key !== sheetKey;
    sheetKey = key;
    openSheet(sheets[0].id, null);
    // another page in the same element: its old picture slides off, the new one comes up from below
    if (turned && keepGhost()) { sheets[0].t = 0; sheets[0].v = 0; app.dirty(); }
    if (label) tags[4].querySelector('span').textContent = label;
  }, lang: langNow, setLanguage(lang) { if (textSite && textSite.lang !== lang) textSite.setLanguage(lang); }, setOpen };
window.__impasto = { sheets, ghost, get current() { return current; }, openSheet, closeSheet, pose, setOpen, project, toSheet, water, drop: (x, y, pigment) => drop(app, x, y, pigment == null ? water.colour++ % 4 : pigment), lay, paintJob, stroke };
})();
