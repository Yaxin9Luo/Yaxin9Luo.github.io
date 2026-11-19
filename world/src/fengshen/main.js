// 牧野 / Muye: the game's page (lab/game-studies/PROTOTYPE-SPEC.md section 5, extended by SPEC-V2.md section 8). It runs the simulation in fixed
// steps, hands the picture to the art module, and keeps everything a reader must read as crisp type in the DOM.
// The page draws nothing on the canvas itself: ink and paint belong to art/, rules to sim.js.
//   ?lang=zh        Chinese          ?stub=1        stand-ins for both modules (?stub=sim or ?stub=art for one)
//   ?perf=1         timing overlay   ?bench=1       a scripted rider plays, for measuring
//   ?seed=7         a fixed battle
import './fengshen.css';
import {createAudio} from './audio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } }};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Numbers from the spec that the page needs for display only; the rules themselves live in the simulation.
const STEP = 1 / 60, WORLD_W = 4800, SPEED_PER_MULT = 260, HEAVY = 1.8;
const SWEEP_AT = .35, SWEEP_FULL = .8, COOLDOWN = {gallop: 12, rally: 20};
let LAST_WAVE = 6;      // taken from the simulation when it exports one

// The five elements: one pigment and one sign each (SPEC-V2 section 4). `feeds` is the generating cycle, 相生.
// `on` is the colour of the sign written on the pigment: a light sign on bronze gold is too faint, so metal's is in ink.
const ELEMENTS = {
  fire: {sign: '火', pigment: '#B8321F', feeds: 'earth'}, water: {sign: '水', pigment: '#2F4F7A', feeds: 'wood'}, wood: {sign: '木', pigment: '#3F7D6A', feeds: 'fire'},
  metal: {sign: '金', pigment: '#B08A3C', feeds: 'water', on: '#14110F'}, earth: {sign: '土', pigment: '#35302B', feeds: 'metal'},
};
const BOON_ELEMENT = {emberBlade: 'fire', wildfire: 'fire', coldTide: 'water', spring: 'water', galeLeap: 'wood', arrowRain: 'wood', keenEdge: 'metal', mirrorShields: 'metal', quake: 'earth', deepRoots: 'earth'};
const KIND_SIGN = {shield: '干', spear: '戈', archer: '射', drill: '练'};

/* ---------- copy ---------- */
const COPY = {
  en: {
    back: '← Yaxin Luo', name: 'Muye', other: '牧野', docTitle: 'Muye · Yaxin Luo', eyebrow: 'yaxin luo / a battle in ink', tag: 'Ride the divine horse Jiliang, lead a warband, break the Shang line.',
    needKeys: 'This game needs a keyboard for now. Touch controls are not built yet.', noStart: 'This browser could not start the game', noStartTail: 'Muye needs a current browser with canvas drawing. A recent Chrome, Edge, Firefox or Safari will do.',
    how: ['<b>A</b><b>D</b> ride', '<b>Space</b> leap: over a set spear, over a raised axe', '<b>J</b> strike · hold, then release: sweep · in the air: a blow as you land', '<b>K</b> flame gallop · <b>L</b> rally the warband', '<b>1</b> follow · <b>2</b> charge · <b>3</b> hold'],
    tip: 'The faster you ride into a blow, the harder it lands. A set spear stops a charge dead and turns a blade from the front: leap over it.',
    hints: {leap: '<kbd>Space</kbd> leap over the spear', sweep: '<kbd>J</kbd> hold, then release: sweep them all', shock: '<kbd>J</kbd> in the air: strike as you land', gallop: '<kbd>K</kbd> flame gallop: nothing stops you', rally: '<kbd>L</kbd> raise the standard: the warband strikes faster', cry: 'Full cry: the horse breaks through them'},
    settings: 'Settings', volume: 'Sound volume', shake: 'Screen shake', calm: 'Reduced motion', calmNote: 'no shake, no slow motion', leave: 'Leave the game',
    start: 'Ride out', again: 'Ride again', resume: 'Resume', paused: 'Paused',
    wave: (w, n) => `wave ${w} / ${LAST_WAVE} · ${n} ${n === 1 ? 'foe' : 'foes'}`, incoming: w => `Wave ${w}`, captainWave: w => `Wave ${w} · the captain`, rout: 'They break', between: 'field cleared',
    orders: {follow: 'follow', charge: 'charge', hold: 'hold'}, kinds: {shield: ['shield', 'shields'], spear: ['spear', 'spears'], archer: ['archer', 'archers'], soldier: ['soldier', 'soldiers'], officer: ['officer', 'officers']},
    band: list => list.length ? list.map(([k, n, names]) => `${n} ${names[n === 1 ? 0 : 1]}`).join(' · ') : 'the warband has fallen',
    skills: {gallop: 'flame gallop', rally: 'rally'}, cry: 'full cry: ride through',
    choose: 'the field is quiet · choose one · 1 2 3', won: 'The field is yours', lost: 'You fell',
    stats: s => `${s.kills} felled · best blow ${Math.round(s.best)} (×${s.bestMult.toFixed(1)}) · ${Math.round(s.time)} s · ${s.lost} of the warband lost`,
    reached: w => `Muye · wave ${w} of ${LAST_WAVE}`,
    elements: {fire: 'Fire', water: 'Water', wood: 'Wood', metal: 'Metal', earth: 'Earth', army: 'Warband'},
    fedBy: (a, b) => `${a} feeds ${b}: this one comes stronger`, feeding: (a, b) => `${a} feeds ${b}: your ${b} boons grow stronger`,
    up: {
      emberBlade: ['Ember blade', 'every strike leaves a burning stroke on the ground'], wildfire: ['Wildfire', 'the flame gallop’s trail runs twice as far and bursts at its end'],
      coldTide: ['Cold tide', 'your sweep sends a wave along the ground that slows them'], spring: ['Spring', 'the warband slowly mends, and mends fully between waves'],
      galeLeap: ['Gale leap', 'you leap half again as high, and the blow on landing throws them back'], arrowRain: ['Arrow rain', 'your archers loose three arrows at a time'],
      keenEdge: ['Keen edge', 'every third strike is a gold blow that cuts through shields'], mirrorShields: ['Mirror shields', 'your shields send arrows back'],
      quake: ['Quake', 'the shock of landing spreads twice as wide and raises spikes of ink that hold them'], deepRoots: ['Deep roots', 'more health, and once a wave a set spear fails to stop you'],
      levy: {shield: ['Levy: shields', 'four shield-bearers join the first file'], spear: ['Levy: spears', 'four spearmen join the second file'], archer: ['Levy: archers', 'four archers join the rear']},
      drill: ['Drill', 'four of the warband become veterans: harder to fell, harder blows'],
      recruit: ['Recruit', 'three soldiers join the warband'], promote: ['Promote', 'every soldier becomes an officer'], sharpen: ['Sharpen', 'your blade cuts a quarter deeper'], mend: ['Mend', 'heal everyone, and more health for you'], swift: ['Swift', 'Jiliang runs faster, so charges land harder'],
    },
    sound: on => on ? 'sound on' : 'sound off', hp: 'health', charge: 'a blow at this speed', blow: (d, m) => `last blow ${d} · ×${m.toFixed(1)}`, braced: 'stopped by a braced spear',
    loading: 'grinding ink…', loadingAt: (mb, pct) => `grinding ink… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: 'the battle starts as soon as the ink is ready', hint: 'A D ride · Space leap · J strike, hold for a sweep · K flame gallop · L rally · 1 2 3 orders · M sound · Esc pause',
    missing: {sim: 'The simulation', art: 'The art module'}, missingTail: 'is not in this checkout yet', broken: 'does not match the contract', stub: 'Run with stand-ins',
  },
  zh: {
    back: '← 罗亚鑫', name: '牧野', other: 'Muye', docTitle: '牧野 · 罗亚鑫', eyebrow: '罗亚鑫 / 水墨战场', tag: '骑神马吉量，率一支周军，冲破商军的阵线。',
    needKeys: '这个游戏目前需要键盘，触屏操作还没有做。', noStart: '这个浏览器没能启动游戏', noStartTail: '《牧野》需要支持画布绘制的新版浏览器：较新的 Chrome、Edge、Firefox 或 Safari 都可以。',
    how: ['<b>A</b><b>D</b> 骑行', '<b>空格</b> 腾跃：越过架好的长戈，越过举起的钺', '<b>J</b> 挥砍 · 按住再松开：横扫 · 空中出刀：落地一击', '<b>K</b> 踏焰 · <b>L</b> 令旗', '<b>1</b> 跟随 · <b>2</b> 冲锋 · <b>3</b> 坚守'],
    tip: '冲得越快，砍得越重。架好的长戈能把冲锋当场拦停，从正面也砍不动它：跃过去。',
    hints: {leap: '<kbd>空格</kbd> 跃过长戈', sweep: '<kbd>J</kbd> 按住再松开：横扫一片', shock: '<kbd>J</kbd> 空中出刀：落地一击', gallop: '<kbd>K</kbd> 踏焰：势不可挡', rally: '<kbd>L</kbd> 举起令旗：部队出手更快', cry: '冲阵：马已跑开，直接撞过去'},
    settings: '设置', volume: '音量', shake: '画面震动', calm: '减少动效', calmNote: '无震动，无慢动作', leave: '离开游戏',
    start: '出阵', again: '再来一局', resume: '继续', paused: '已暂停',
    wave: (w, n) => `第 ${w} / ${LAST_WAVE} 波 · 敌军 ${n}`, incoming: w => `第 ${w} 波`, captainWave: w => `第 ${w} 波 · 主将`, rout: '敌军溃散', between: '战场已肃清',
    orders: {follow: '跟随', charge: '冲锋', hold: '坚守'}, kinds: {shield: ['干', '干'], spear: ['戈', '戈'], archer: ['射', '射'], soldier: ['士兵', '士兵'], officer: ['军官', '军官']},
    band: list => list.length ? list.map(([k, n, names]) => `${names[0]} ${n}`).join(' · ') : '部队已全数阵亡',
    skills: {gallop: '踏焰', rally: '令旗'}, cry: '冲阵：直接撞过去',
    choose: '战场暂歇 · 任选其一 · 1 2 3', won: '此战告捷', lost: '你倒下了',
    stats: s => `斩敌 ${s.kills} · 最重一击 ${Math.round(s.best)}（×${s.bestMult.toFixed(1)}）· ${Math.round(s.time)} 秒 · 部队折损 ${s.lost}`,
    reached: w => `牧野 · 第 ${w} / ${LAST_WAVE} 波`,
    elements: {fire: '火', water: '水', wood: '木', metal: '金', earth: '土', army: '军'},
    fedBy: (a, b) => `${a}生${b}：这一道来得更强`, feeding: (a, b) => `${a}生${b}：你的${b}之力更强`,
    up: {
      emberBlade: ['余烬之刃', '每一刀都在地上留下一道燃烧的笔痕'], wildfire: ['燎原', '踏焰的火痕长出一倍，尽头炸开'],
      coldTide: ['寒潮', '横扫推出一道贴地的浪，把敌人拖慢'], spring: ['泉', '部队缓缓回复，两波之间完全恢复'],
      galeLeap: ['乘风', '跃得更高，落地一击把敌人震退'], arrowRain: ['箭雨', '你的弓手每次连发三箭'],
      keenEdge: ['锋锐', '每第三刀是一记金色重击，能劈开盾牌'], mirrorShields: ['镜盾', '你的盾把箭弹回去'],
      quake: ['地裂', '落地的震波宽出一倍，升起墨刺把敌人钉住'], deepRoots: ['深根', '生命更厚；每波有一次，架好的长戈拦不住你'],
      levy: {shield: ['征召：干', '四名持盾手补入前排'], spear: ['征召：戈', '四名戈手补入第二排'], archer: ['征召：射', '四名弓手补入后排']},
      drill: ['操练', '四名士兵成为老兵：更耐打，下手更重'],
      recruit: ['募兵', '三名士兵加入部队'], promote: ['擢升', '所有士兵升为军官'], sharpen: ['磨刃', '你的刀砍得更深'], mend: ['休整', '全员回满，你的生命更厚'], swift: ['疾足', '吉量跑得更快，冲锋更重'],
    },
    sound: on => on ? '声音：开' : '声音：关', hp: '生命', charge: '此速一击', blow: (d, m) => `上一击 ${d} · ×${m.toFixed(1)}`, braced: '被架好的长戈拦停',
    loading: '正在研墨…', loadingAt: (mb, pct) => `正在研墨… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: '墨一研好就出阵', hint: 'A D 骑行 · 空格 腾跃 · J 挥砍，按住横扫 · K 踏焰 · L 令旗 · 1 2 3 号令 · M 声音 · Esc 暂停',
    missing: {sim: '模拟模块', art: '美术模块'}, missingTail: '还不在这份代码里', broken: '与约定的接口不符', stub: '用替身模块运行',
  },
};
// Language: `?lang=` first, else the preference the homepage and the blog share (one record, `lang` among other things).
const SITE_PREFS = 'yaxin.grimoire.preferences';
function sitePrefs() { try { const p = JSON.parse(store.get(SITE_PREFS) || '{}'); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
const asked = params.get('lang');
let lang = asked === 'zh' || asked === 'en' ? asked : sitePrefs().lang === 'zh' ? 'zh' : 'en';
let t = COPY[lang];

/* ---------- the two modules ---------- */
// The real modules are written by other hands and may be missing: import.meta.glob finds them if they exist and
// leaves an empty map if they do not, so a missing file is a message on the page instead of a failed build.
const FILES = {sim: 'src/fengshen/sim.js', art: 'src/fengshen/art/index.js'};
const real = {sim: import.meta.glob('./sim.js'), art: import.meta.glob('./art/index.js')};
const stubs = {sim: () => import('./dev-stub-sim.js'), art: () => import('./dev-stub-art.js')};
const stubArg = params.get('stub');
const useStub = k => stubArg !== null && (['', '1', 'both', 'true'].includes(stubArg) || stubArg.split(',').includes(k));
async function loadModule(k, needs) {
  let mod;
  if (useStub(k)) mod = await stubs[k]();
  else {
    const load = Object.values(real[k])[0];
    if (!load) throw Object.assign(new Error(`${FILES[k]} is missing`), {part: k, why: 'missing'});
    mod = await load();
  }
  const lacking = needs.filter(n => typeof mod[n] !== 'function');
  if (lacking.length) throw Object.assign(new Error(`${FILES[k]} does not export ${lacking.join(', ')}`), {part: k, why: 'broken'});
  return mod;
}

/* ---------- state ---------- */
const canvas = $('field'), ctx = canvas.getContext('2d', {alpha: false});
let sim = null, artMod = null, art = null, game = null;
let mode = 'loading';                 // loading | error | title | play | paused   (game.phase covers choose / won / lost)
let W = 0, H = 0, dpr = 1, used = false, starting = false, endAt = 0, slipsFor = null;
const cam = {x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0};
const look = {x: 0, v: 0};            // the camera's look-ahead, on a spring
const closeIn = {x: 1, v: 0};         // extra zoom, eased in when the rider falls
const FALL = {scale: .35, hold: .6, ease: .5, zoom: 1.14};
let fallAt = -1;                      // seconds of real time since the `fall` event, or -1
const shake = {ax: 0, ay: 0, t: 1};
const audio = createAudio();
const keys = new Set(), edge = {leap: false, strike: false, gallop: false, rally: false, order: null, pick: null};
const strikeDown = {key: false, mouse: false, sent: false};      // the strike is held while J or the left button is down
let lastDir = 0, hurtFlash = 0;
const bench = params.has('bench');
// A phone or a tablet with no keyboard and no mouse: the game cannot be played there yet, and says so on the title sheet.
const touchOnly = navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches;
const frameEvents = [];      // with ?perf: what happened in a frame, so a long frame can be put down to its cause
const perf = {long: [], on: params.has('perf') || bench, frame: new Float32Array(600), sim: new Float32Array(600), draw: new Float32Array(600), i: 0, n: 0};
// Settings on the pause sheet, remembered between visits. Reduced motion starts from the system's preference.
const calmByDefault = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = {volume: .8, shake: true, calm: calmByDefault};
try { const saved = JSON.parse(store.get('muye.settings') || '{}'); if (typeof saved.volume === 'number') settings.volume = clamp(saved.volume, 0, 1); if (typeof saved.shake === 'boolean') settings.shake = saved.shake; if (typeof saved.calm === 'boolean') settings.calm = saved.calm; } catch { /* a damaged entry: keep the defaults */ }
const shakeOn = () => settings.shake && !settings.calm;
function applySettings(save) {
  audio.setVolume(settings.volume);
  document.documentElement.classList.toggle('calm', settings.calm);
  if (save) store.set('muye.settings', JSON.stringify(settings));
}
const newSeed = () => +params.get('seed') || (Date.now() % 100000) + 1;

// How much of the world the view shows. The art module scales the scene with the view's height itself (one world pixel is
// one CSS pixel at 900 px high and zoom 1), so zoom is a pure framing choice:
//   - ZOOM puts mount and rider (about 170 world px without the standard) at about 14% of the view's height on a 16:10 window;
//   - other window shapes zoom so the same width of world (about 1950 px) stays in view, within limits;
//   - cam.y lifts the ground line from the art's 82% of the height to GROUND_AT.
const ZOOM = .74, GROUND_AT = .78, ART_GROUND = .82, MAX_PIXELS = 1920 * 1200;
let resScale = 1, baseZoom = ZOOM;
/** Zoom and ground line for this frame: the base framing, times the ease-in on a fallen rider. */
function frameCam() { cam.zoom = baseZoom * closeIn.x; cam.y = -(ART_GROUND - GROUND_AT) * 900 / cam.zoom; }
                     // lowered by the loop when frames stay slow
function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  // never more backing pixels than a 1920 x 1200 canvas, whatever the window and the display's pixel ratio
  dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(1, W * H))) * resScale;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  baseZoom = ZOOM * clamp((W / H) / 1.6, .8, 1.3);
  frameCam();
  if (art) art.setView({width: W, height: H, dpr});
}
addEventListener('resize', resize);

/* ---------- input ---------- */
const LEFT = ['a', 'ArrowLeft'], RIGHT = ['d', 'ArrowRight'];
const GAME_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
/** A battle is on (fighting or paused) and its end sheet is not up yet. */
const running = () => (mode === 'play' || mode === 'paused') && endAt !== Infinity;
const focusGame = () => canvas.focus({preventScroll: true});
addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const el = e.target instanceof Element ? e.target.closest('a, button, input') : null;
  const fighting = mode === 'play' && endAt !== Infinity;
  // While a battle is fought the keyboard belongs to it: Tab does not walk off to the links, and no key follows a link.
  if (k === 'Tab' && fighting) { e.preventDefault(); focusGame(); return; }
  if ((k === 'Enter' || k === ' ') && el && el.tagName === 'A' && running()) { e.preventDefault(); return; }
  if (GAME_KEYS.includes(k) && (fighting || !el)) e.preventDefault();      // on a sheet, arrows and Space still work the controls they are on
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  audio.ensure();
  keys.add(k);
  if (LEFT.includes(k)) lastDir = -1; else if (RIGHT.includes(k)) lastDir = 1;
  if (k === 'Escape') { if (mode === 'play' && !ended()) pause(true); else if (mode === 'paused') pause(false); }
  if (k === 'Enter' && !el && (mode === 'title' || mode === 'loading' || (mode === 'play' && ended() && endAt === Infinity))) begin();      // on a button, Enter is that button's click
  if (k === 'm' && !(el && el.tagName === 'INPUT')) toggleSound();
  if (mode !== 'play') return;
  if (k === ' ' || k === 'w' || k === 'ArrowUp') edge.leap = true;
  if (k === 'j') { edge.strike = true; strikeDown.key = true; }
  if (k === 'k') edge.gallop = true;
  if (k === 'l') edge.rally = true;
  if (k === '1' || k === '2' || k === '3') {
    if (game.phase === 'choose') edge.pick = +k - 1;
    else edge.order = ['follow', 'charge', 'hold'][+k - 1];
  }
});
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.delete(k); if (k === 'j') strikeDown.key = false; });
function away() { keys.clear(); strikeDown.key = strikeDown.mouse = false; if (mode === 'play' && !ended() && !bench) pause(true); }
addEventListener('blur', away);
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
canvas.addEventListener('pointerdown', e => { audio.ensure(); if (mode === 'play' && e.button === 0) { edge.strike = true; strikeDown.mouse = true; } });
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, () => { strikeDown.mouse = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/**
 * The input for one step. Edges are handed over once, to the first step after the key went down. The strike is sent three
 * ways so that the simulation can tell a tap from a hold: `strike` on the step it goes down, `strikeHeld` while it is
 * down, `strikeUp` on the step it is let go. A tap shorter than a frame still gives one held step and then the release.
 */
function readInput() {
  const l = LEFT.some(k => keys.has(k)), r = RIGHT.some(k => keys.has(k)), held = strikeDown.key || strikeDown.mouse || edge.strike;
  const input = {move: l && r ? lastDir : r ? 1 : l ? -1 : 0, leap: edge.leap, strike: edge.strike, strikeHeld: held, strikeUp: strikeDown.sent && !held, gallop: edge.gallop, rally: edge.rally, order: edge.order, pick: edge.pick};
  strikeDown.sent = held;
  edge.leap = edge.strike = edge.gallop = edge.rally = false; edge.order = edge.pick = null;
  return input;
}
/** A further step inside the same frame: it rides and holds as the first did, and repeats no edge. */
const carry = i => ({move: i.move, leap: false, strike: false, strikeHeld: i.strikeHeld, strikeUp: false, gallop: false, rally: false, order: null, pick: null});
/** For ?bench: ride back and forth through the foes, strike in passing, leap braced spears, take the first upgrade. */
const bot = {dir: 1, n: 0, leapt: false, hold: 0};
function botInput() {
  const h = game.hero; bot.n++;
  let any = false, near = 1e9, ahead = null, ad = 1e9;
  for (const u of game.units) {
    if (u.side !== 'shang' || u.state === 'dead') continue;
    any = true; const d = (u.x - h.x) * bot.dir; near = Math.min(near, Math.abs(d));
    if (d > 0 && d < ad) { ad = d; ahead = u; }
  }
  if (h.x < 240) bot.dir = 1; else if (h.x > WORLD_W - 240) bot.dir = -1; else if (any && !ahead && near > 380) bot.dir = -bot.dir;
  const leap = !!ahead && ahead.state === 'brace' && ad < 250 && ad > 110, edgeLeap = leap && !bot.leapt; bot.leapt = leap;
  // every ten seconds or so, hold a sweep into the nearest of them; the gallop and the rally whenever they are ready and foes are near
  const wasHeld = bot.hold > 0;
  if (bot.hold > 0) bot.hold--; else if (ad < 260 && bot.n % 600 === 300) bot.hold = 34;
  const ready = k => h.cd && h.cd[k] <= 0 && near < 600;
  return {move: bot.dir, leap: edgeLeap, strike: bot.hold === 33 || (bot.hold === 0 && !wasHeld && ad < 200 && bot.n % 8 === 0), strikeHeld: bot.hold > 0, strikeUp: wasHeld && bot.hold === 0,
    gallop: ready('gallop') && bot.n % 120 === 60, rally: ready('rally') && bot.n % 120 === 90, order: bot.n === 30 ? 'charge' : null, pick: game.phase === 'choose' && bot.n % 45 === 0 ? 0 : null};
}

/* ---------- events: sound, shake, the HUD's notes. The paint is the art module's. ---------- */
/** A short push of the camera along the blow, in CSS pixels; it rings out in about a fifth of a second. */
function kick(dx, dy) {
  if (!shakeOn()) return;
  const k = Math.exp(-shake.t * 16) * Math.cos(shake.t * 52);
  shake.ax = clamp(shake.ax * k + dx, -14, 14); shake.ay = clamp(shake.ay * k + dy, -10, 10); shake.t = 0;
}
function note(text, heavy) { const b = $('blow'); b.textContent = text; b.className = heavy ? 'heavy' : ''; void b.offsetWidth; b.classList.add('show'); }
let bannerAt = -1e9;
function banner(text) { hideHint(); bannerAt = performance.now(); const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function handle(e) {
  const h = game.hero;
  switch (e.type) {
    case 'swing': audio.swing(); break;
    case 'hit': {
      const dir = e.dir || h.facing, m = e.mult || 1;
      kick(dir * (2.5 + (m - 1) * 3.5 + (e.kill ? 3 : 0)), 0);
      if (e.kill) audio.kill(); audio.hit(m);
      note(t.blow(Math.round(e.dmg), m), m >= HEAVY);
      break;
    }
    case 'clash': audio.clash(); break;
    case 'trample': kick(0, 3); audio.trample(); break;
    case 'braced': kick(-h.facing * 12, 0); audio.braced(); note(t.braced, true); if (teach.on && !teach.leapt && !teach.stopped) { teach.stopped = showHint('leap'); } break;
    case 'hurt': hurtFlash = 1; kick(-h.facing * 5, 2); audio.hurt(); $('hp').classList.remove('struck'); void $('hp').offsetWidth; $('hp').classList.add('struck'); break;
    case 'leap': audio.leap(); break;
    case 'land': kick(0, 2 + 3 * clamp((e.speed || 0) / h.topSpeed, 0, 1)); audio.land(clamp((e.speed || 0) / h.topSpeed, 0, 1)); break;
    case 'loose': audio.loose(); break;
    case 'arrowHit': audio.arrowHit(); break;
    case 'order': audio.order(e.order); break;
    case 'wave': {
      const last = e.wave >= LAST_WAVE;      // the captain's wave is called by name, and by his horn
      banner(last ? t.captainWave(e.wave) : t.incoming(e.wave)); audio.horn(false); if (last) audio.captainHorn(.5);
      const k = toneOf(e.wave); if (Math.abs(k - tone) > 1e-6) setTone(k);      // normally set already, when the last wave was cleared
      break;
    }
    // No banner: the slips hang where it would be, and the top line says it. The paper takes the next wave's tone now:
    // the art module repaints its sheets on a change of tone, which costs one long frame, and here the field is still.
    case 'cleared': audio.horn(true); if (e.wave < LAST_WAVE) setTone(toneOf(e.wave + 1)); break;
    case 'upgrade': case 'boon': celebrate(e); break;
    case 'sweep': if (e.side === 'shang') { audio.sweep(true); kick(0, 3); break; }      // the captain's sweep, not the hero's
      kick((e.dir || h.facing) * (e.full ? 7 : 4), 0); audio.sweep(!!e.full); learn('sweep'); break;
    case 'shock': kick(0, 4 + 3 * clamp(e.power || 1, 0, 2)); audio.shock(clamp(e.power || 1, 0, 2)); if (e.kind !== 'burst') learn('shock'); break;      // a wildfire burst is a shock too, but not the blow on landing
    case 'fullCry': audio.fullCry(!!e.on); if (e.on && game.t > 12 && hintOnce('cry')) { learned.add('cry'); store.set('muye.learned', JSON.stringify([...learned])); } break;      // nothing to press: once told, it is known
    case 'dash': audio.dash(); learn('gallop'); break;
    case 'trail': if (e.kind === 'ember') audio.ember(); else audio.trail(); break;
    case 'rally': audio.rally(); learn('rally'); break;
    case 'volley': audio.volley(); break;
    case 'blocked': audio.block(); break;
    case 'crit': audio.crit(); break;
    case 'captainHorn': audio.captainHorn(0); break;
    case 'rout': audio.rout(); banner(t.rout); break;
    case 'won': audio.horn(false); break;
    case 'fall': if (!settings.calm) fallAt = 0; kick((e.dir || -h.facing) * 9, 3); audio.fall(); break;
    case 'lost': audio.horn(true); break;
    default: break;
  }
}

/* ---------- teaching the leap, and saying no ---------- */
// In a visitor's first battle only: the first time a spearman sets his spear ahead of the horse, a line in the empty paper
// names the key; once more if a spear stops the horse; never again after the horse has cleared a set spear.
const teach = {on: false, braced: false, stopped: false, leapt: false};
let hintKey = null, hintAt = -1e9;
/** Show a hint; false when its place is taken (the slips hang there, or a wave is being called) and it must wait. */
function showHint(key) { if (game.phase === 'choose' || performance.now() - bannerAt < 2100) return false; const el = $('hint'); hintKey = key; hintAt = performance.now(); el.innerHTML = t.hints[key]; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); return true; }
function hideHint() { $('hint').classList.remove('show'); hintKey = null; }
function watchSpears() {
  if (!teach.on || teach.leapt) return;
  const h = game.hero;
  for (const u of game.units) {
    if (u.kind !== 'spear' || u.side !== 'shang' || u.state !== 'brace') continue;
    const ahead = (u.x - h.x) * h.facing;
    if (h.y > 0 && Math.abs(u.x - h.x) < 40) { teach.leapt = true; if (hintKey === 'leap') hideHint(); return; }
    if (!teach.braced && h.y <= 0 && ahead > 0 && ahead < 560 && u.facing === -h.facing) { teach.braced = showHint('leap'); }
  }
}
// The verbs of SPEC-V2 are taught the same way, one line each, when the verb first becomes useful: a sweep when two foes
// stand in its reach, the blow on landing when the horse is in the air over a foe, the gallop and the rally when they
// are ready and there is something to use them on. A verb used once is learned for good (remembered between visits)
// and is never hinted again; a verb is hinted at most once in a battle, and never on top of another hint.
const learned = new Set();
try { for (const k of JSON.parse(store.get('muye.learned') || '[]')) learned.add(k); } catch { /* a damaged entry: teach again */ }
const hinted = new Set();
function learn(key) { if (hintKey === key) hideHint(); if (learned.has(key)) return; learned.add(key); store.set('muye.learned', JSON.stringify([...learned])); }
function hintOnce(key) {
  if (bench || learned.has(key) || hinted.has(key) || performance.now() - hintAt < 6500) return false;
  if (!showHint(key)) return false;
  hinted.add(key); return true;
}
function watchVerbs() {
  const h = game.hero;
  if (bench || h.hold === undefined || h.state === 'fallen' || ended()) return;      // a v1 simulation has none of these verbs
  let ahead = 0, crowd = 0, under = false, fighting = 0;
  for (const u of game.units) {
    if (u.state === 'dead') continue;
    const d = (u.x - h.x) * h.facing;
    if (u.side === 'shang') { if (d > 0 && d < 240) ahead++; if (d > 0 && d < 520) crowd++; if (Math.abs(u.x - h.x) < 170) under = true; }
    else if ((u.state === 'windup' || u.state === 'attack' || u.state === 'draw') && Math.abs(u.x - h.x) < 450) fighting++;
  }
  if (h.y > 30 && under) hintOnce('shock');
  else if (h.y <= 0 && ahead >= 2) hintOnce('sweep');
  else if (h.cd && h.cd.gallop <= 0 && crowd >= 3 && game.wave >= 2) hintOnce('gallop');
  else if (h.cd && h.cd.rally <= 0 && fighting >= 2) hintOnce('rally');
}
// A leap asked for below the horse's leaping speed, or a strike asked for while the last one is still recovering, does
// nothing in the simulation and sends no event. The page can tell (the key went down, no `leap` or `swing` came back)
// and answers with a small dull sound, a nudge of the speed bar, and a `refuse` event for the art module to picture.
let refuseArt = true, refusedAt = -1e9;
function refuse(what) {
  const h = game.hero, now = performance.now();
  if (now - refusedAt > 350) { refusedAt = now; audio.refuse(); }      // a key hammered during a strike says no once, not eight times a second
  const el = what === 'leap' ? $('charge') : what === 'gallop' || what === 'rally' ? $(`skill-${what}`) : null;      // the mark that says why not: too slow, or not ready yet
  if (el) { el.classList.remove('short'); void el.offsetWidth; el.classList.add('short'); }
  if (refuseArt) try { art.onEvent({type: 'refuse', what, x: h.x, y: h.y}, game); } catch { refuseArt = false; }      // an art module that does not know the event
}

/* ---------- camera and drawing ---------- */
/** A critically damped spring, integrated exactly, so it moves the same at any frame rate. */
function spring(s, target, dt, omega) {
  const d = s.x - target, e = Math.exp(-omega * dt), tmp = (s.v + omega * d) * dt;
  s.x = target + (d + tmp) * e; s.v = (s.v - omega * tmp) * e;
}
/** Where the look-ahead wants to be: the hero 38% from the trailing edge at top speed, a little ahead when standing. */
/** The width of the view in world pixels. */
const viewW = () => W / (H / 900 * cam.zoom);
function lead() { const h = game.hero; if (h.state === 'fallen') return 0; return viewW() * .12 * (.25 * h.facing + .75 * clamp(h.vx / h.topSpeed, -1, 1)); }
function draw(alpha, dt, realDt) {
  const h = game.hero, hx = h.px + (h.x - h.px) * alpha;
  // The camera is pinned to the interpolated hero, so the horse never slides against the frame; only the look-ahead is sprung.
  spring(closeIn, h.state === 'fallen' && !settings.calm ? FALL.zoom : 1, realDt, 3.2); frameCam();
  spring(look, lead(), realDt, 2.8);
  const vw = viewW();
  // At the world's ends the view runs on past the last ground (END_PAD world px of the art's margin), so the horse stops
  // well inside the frame; what lies beyond the end is faded into bare paper below.
  cam.x = clamp(hx + look.x, vw / 2 - END_PAD, WORLD_W - vw / 2 + END_PAD);
  shake.t += realDt;
  const k = shake.t < .4 ? Math.exp(-shake.t * 16) * Math.cos(shake.t * 52) : 0;
  cam.shakeX = shake.ax * k; cam.shakeY = shake.ay * k;
  for (const layer of ['drawBack', 'drawFigures', 'drawEffects', 'drawFront']) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (layer === 'drawFigures') art.drawFigures(ctx, cam, game, alpha, dt); else if (layer === 'drawEffects') art.drawEffects(ctx, cam, dt); else art[layer](ctx, cam);
    ctx.restore();
  }
  drawEnds();
}
/** The world's two ends: the picture dissolves into bare paper over END_FADE world px, starting just behind the horse's wall. */
const END_PAD = 700, END_FADE = 300;
// The scene's paper on screen at dawn (k = 0), day (0.5) and dusk (1), from art/scene2/review/NOTES.md. The page keeps
// its own paper to it: the fade at the world's ends, the chip a hint is written on, and the slips and sheets (a little lighter).
const PAPER = [[233, 231, 222], [239, 231, 214], [230, 184, 144]];
function paperAt(k) { const u = clamp(k, 0, 1) * 2, i = u >= 1 ? 1 : 0, f = u - i; return PAPER[i].map((v, c) => Math.round(v + (PAPER[i + 1][c] - v) * f)); }
let tone = 0;
function drawEnds() {
  const z = H / 900 * cam.zoom * dpr, sx = x => (W / 2 + cam.shakeX) * dpr + (x - cam.x) * z;
  const left = sx(-10), right = sx(WORLD_W + 10);
  if (left <= 0 && right >= canvas.width) return;
  const c = paperNow.join(',');
  for (const [edge, dir] of [[left, -1], [right, 1]]) {
    if (dir < 0 ? edge <= 0 : edge >= canvas.width) continue;
    // one fill per end: past its last stop a gradient keeps that stop's colour, so the fade and the bare paper beyond it have no seam
    const g = ctx.createLinearGradient(edge, 0, edge + dir * END_FADE * z, 0);
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.55, `rgba(${c},.8)`); g.addColorStop(1, `rgba(${c},.97)`);
    ctx.fillStyle = g;
    if (dir < 0) ctx.fillRect(0, 0, edge, canvas.height); else ctx.fillRect(edge, 0, canvas.width - edge, canvas.height);
  }
}
/** The time of day of a wave: dawn for the first, dusk for the last. */
const toneOf = wave => clamp((wave - 1) / Math.max(1, LAST_WAVE - 1), 0, 1);
/** Tell the art module the time of day, and keep the paper's tone for the fade at the world's ends. */
function setTone(k) {
  tone = k; art.setTime(k);
  setPaper(art.paperAt ? art.paperAt(k) : paperAt(k));
  paperDue = [1.2];      // then look once at what the scene really painted, when its change of tone has settled
}
let paperNow = PAPER[0], paperDue = [];
function setPaper(p) {
  paperNow = p;
  const root = document.documentElement.style;
  root.setProperty('--paper', `rgb(${p.join(',')})`);
  root.setProperty('--slip', `rgb(${p.map(v => Math.round(v + (255 - v) * .45)).join(',')})`);
}
// The panels must be the same paper as the picture, at every time of day. The art module does not hand the scene's paper
// to the page, so the page looks: five small patches of sky along the top edge are drawn down to one pixel each on a
// scratch canvas and read there (never read from the main canvas itself: repeated reads would move it off the fast path).
// The median is taken, and only if the patches agree and are near the table's value, so a cloud, a bird or a boon's
// burst crossing the sky is not mistaken for paper.
const probe = document.createElement('canvas'); probe.width = 5; probe.height = 1;
const probeCtx = probe.getContext('2d', {willReadFrequently: true});
function samplePaper() {
  if (art.paperAt || !probeCtx || !canvas.width) return;
  try {
    const w = Math.max(4, Math.round(14 * dpr)), h = Math.max(2, Math.round(6 * dpr)), y = Math.round(5 * dpr);
    [.12, .3, .5, .7, .88].forEach((f, i) => probeCtx.drawImage(canvas, Math.round(canvas.width * f), y, w, h, i, 0, 1, 1));
    const d = probeCtx.getImageData(0, 0, 5, 1).data, table = paperAt(tone), p = [0, 1, 2].map(c => [0, 1, 2, 3, 4].map(i => d[i * 4 + c]).sort((a, b) => a - b));
    if (p.some(ch => ch[3] - ch[1] > 10) || p.some((ch, c) => Math.abs(ch[2] - table[c]) > 34)) return;
    setPaper(p.map(ch => ch[2]));
  } catch { /* a canvas that cannot be read: the table's colour stays */ }
}

/* ---------- HUD and sheets (DOM: everything a reader must read is crisp type) ---------- */
const ended = () => game.phase === 'won' || game.phase === 'lost';
const text = (id, s) => { const el = $(id); if (el.textContent !== s) el.textContent = s; };
let hudKey = '', boonKey = '';
/** The living warband by kind, in the order of its files: [[kind, count, names], ...]. */
function zhouKinds() {
  const n = {};
  for (const u of game.units) if (u.side === 'zhou' && u.state !== 'dead') n[u.kind] = (n[u.kind] || 0) + 1;
  return ['shield', 'spear', 'archer', 'officer', 'soldier'].filter(k => n[k]).map(k => [k, n[k], t.kinds[k]]);
}
function hud() {
  const h = game.hero, mult = 1 + Math.abs(h.vx) / SPEED_PER_MULT, hold = h.hold || 0;
  text('hp-num', `${Math.max(0, Math.ceil(h.hp))} / ${h.maxHp}`);
  $('hp-fill').style.transform = `scaleX(${clamp(h.hp / h.maxHp, 0, 1).toFixed(3)})`;
  $('hp').classList.toggle('low', h.hp / h.maxHp < .3);
  text('mult', `×${mult.toFixed(1)}`);
  $('speed-fill').style.transform = `scaleX(${clamp(Math.abs(h.vx) / h.topSpeed, 0, 1).toFixed(3)})`;
  const charge = $('charge').classList;
  charge.toggle('heavy', mult >= HEAVY);
  // full cry: the multiplier's line thickens and its label says what the horse now does
  charge.toggle('cry', !!h.fullCry); text('charge-label', h.fullCry ? t.cry : t.charge);
  // the held blow: a small mark beside the multiplier that grows, darkens when a sweep is ready and reddens when it is full
  const mark = $('hold').classList;
  mark.toggle('on', hold > 0); mark.toggle('ready', hold >= SWEEP_AT); mark.toggle('full', hold >= SWEEP_FULL);
  if (hold > 0) $('hold-fill').style.transform = `scaleY(${clamp(hold / SWEEP_FULL, 0, 1).toFixed(3)})`;
  // the two gifts: each a small line that fills as it comes back
  if (h.cd) for (const k of ['gallop', 'rally']) {
    const left = h.cd[k] || 0, el = $(`skill-${k}`);
    el.classList.toggle('ready', left <= 0);
    el.querySelector('.fill').style.transform = `scaleX(${(1 - clamp(left / COOLDOWN[k], 0, 1)).toFixed(3)})`;
  }
  if (hurtFlash > 0 || $('hurt').style.opacity !== '0') $('hurt').style.opacity = String(Math.max(0, hurtFlash).toFixed(2));

  const c = sim.counts(game), kinds = zhouKinds(), boons = h.boons || [];
  const key = `${lang}|${game.wave}|${c.foes}|${kinds.map(k => k[0] + k[1]).join()}|${game.order}|${game.phase}|${audio.on}|${h.topSpeed}|${mode}|${endAt === Infinity}|${!!h.cd}`;
  if (key !== hudKey) {
    hudKey = key;
    text('wave', mode === 'title' || ended() || game.wave < 1 ? '' : game.phase === 'choose' || c.foes === 0 ? t.between : t.wave(game.wave, c.foes));
    text('band', t.band(kinds));
    for (const b of document.querySelectorAll('#orders button')) { b.setAttribute('aria-pressed', String(b.dataset.order === game.order)); b.querySelector('span').textContent = t.orders[b.dataset.order]; }
    $('skills').hidden = !h.cd;
    for (const k of ['gallop', 'rally']) $(`skill-${k}`).querySelector('span').textContent = t.skills[k];
    text('sound', t.sound(audio.on));
    $('heavy-tick').style.left = `${clamp((HEAVY - 1) * SPEED_PER_MULT / h.topSpeed, 0, 1) * 100}%`;
    const playing = (mode === 'play' || mode === 'paused') && endAt !== Infinity;      // the gauges leave with the end sheet: the simulation has stopped, so they would be stale
    $('vitals').hidden = !playing;
  }
  const bk = `${lang}|${boons.map(b => b.id).join()}|${comingBoon}|${landedBoon}`;
  if (bk !== boonKey) { boonKey = bk; renderBoons(boons); }
  // the three slips follow the simulation's phase, so a pick made by key, click or bot all clear them the same way
  const want = game.phase === 'choose' && mode === 'play' && !bench ? game.choices : null;      // not under the pause sheet
  if (!ceremony && want !== slipsFor) { slipsFor = want; showSlips(want); }
  if (ended() && mode === 'play' && endAt !== Infinity && performance.now() >= endAt) { endAt = Infinity; if (bench) begin(); else showEnd(); }
}

/* ---------- boons: the slips, the ceremony of the pick, the row of signs ---------- */
/** One offered slip, whatever shape the simulation gives it: an id, or {id, element, kind}. */
function choiceOf(c) {
  const o = typeof c === 'string' ? {id: c} : c || {};
  let id = o.id, kind = o.kind;
  const known = sim.SLIPS && sim.SLIPS[id] || {};      // the simulation's own table, when it has one
  const levy = /^levy[:_-]?(shield|spear|archer)s?$/i.exec(id || '');
  if (levy) { kind = known.kind || levy[1].toLowerCase(); id = 'levy'; }
  const element = o.element || known.element || BOON_ELEMENT[id] || null, e = ELEMENTS[element];
  const words = id === 'levy' ? t.up.levy[kind] || ['Levy', ''] : t.up[id] || [String(id), ''];
  return {id, kind, element, name: words[0], text: words[1], sign: e ? e.sign : KIND_SIGN[id === 'levy' ? kind : id] || '军', pigment: e ? e.pigment : '#6B645C', on: (e && e.on) || '#FFFDF8', label: t.elements[element || 'army']};
}
/** 相生: say so on the slip when the pick would be fed by an element already owned, or would feed one. */
function feedLine(element, owned) {
  if (!element) return '';
  const feeder = Object.keys(ELEMENTS).find(k => ELEMENTS[k].feeds === element), fed = ELEMENTS[element].feeds;
  if (owned.has(feeder)) return `<span class="feed" style="--pig:${ELEMENTS[feeder].pigment}">${t.fedBy(t.elements[feeder], t.elements[element])}</span>`;
  if (owned.has(fed)) return `<span class="feed" style="--pig:${ELEMENTS[element].pigment}">${t.feeding(t.elements[element], t.elements[fed])}</span>`;
  return '';
}
let slipChoices = null, ceremony = null, comingBoon = null, landedBoon = null, lastPick = 0;      // coming, landed: boon ids
function showSlips(choices) {
  const el = $('slips');
  el.className = '';
  if (!choices) { el.hidden = true; el.innerHTML = ''; slipChoices = null; return; }
  hideHint();      // the slips hang where a hint would be
  const owned = new Set((game.hero.boons || []).map(b => b.element));
  slipChoices = choices.map(choiceOf);
  el.dataset.title = t.choose; el.setAttribute('aria-label', t.choose);
  el.innerHTML = slipChoices.map((c, i) => `<button class="slip${c.element ? '' : ' army'}" data-pick="${i}" style="--pig:${c.pigment};--on:${c.on};--i:${i}">
    <span class="top"><kbd>${i + 1}</kbd><span class="el"><i class="sign">${c.sign}</i>${c.label}</span></span>
    <strong>${c.name}</strong><span class="what">${c.text}</span>${feedLine(c.element, owned)}<i class="stamp" aria-hidden="true">${c.sign}</i></button>`).join('');
  el.hidden = false;
}
function renderBoons(boons) {
  const el = $('boons');
  el.hidden = !boons.length;
  el.innerHTML = boons.map((b, i) => {
    const e = ELEMENTS[b.element] || ELEMENTS.earth, words = t.up[b.id] || [b.id, ''], tip = `${t.elements[b.element] || ''} · ${words[0]}: ${words[1]}`;
    return `<button class="boon${b.id === comingBoon ? ' coming' : ''}${b.id === landedBoon ? ' landed' : ''}" role="listitem" style="--pig:${e.pigment};--on:${e.on || '#FFFDF8'}" data-tip="${tip}" aria-label="${tip}">${e.sign}</button>`;
  }).join('');
}
function endCeremony() {
  if (!ceremony) return;
  for (const id of ceremony.timers) clearTimeout(id);
  ceremony = null; landedBoon = comingBoon; comingBoon = null; slipsFor = null; slipChoices = null;
  const el = $('slips'); el.hidden = true; el.innerHTML = ''; el.className = '';
}
/**
 * The pick, as something felt: the chosen slip is stamped with its sign and the others fall away; the art module throws
 * the element's pigment across the picture (it has the same `boon` event); the element's own sound plays; then the slip
 * shrinks into its place in the row of owned boons (an army slip goes to the warband's line).
 */
let celebrated = {id: null, t: -1};
function celebrate(e) {
  // the simulation sends `upgrade` for every pick and `boon` as well for an element boon: one pick, one ceremony
  if (celebrated.id === e.id && Math.abs(game.t - celebrated.t) < .5) return;
  celebrated = {id: e.id, t: game.t};
  const slipOf = sim.SLIPS && sim.SLIPS[e.id], element = e.element || (slipOf && slipOf.element) || BOON_ELEMENT[e.id] || null;
  if (element) audio.boon(element); else audio.pick();
  const el = $('slips');
  if (el.hidden || !slipChoices || ceremony) return;
  let i = slipChoices.findIndex(c => c.id === e.id || (c.id === 'levy' && /^levy/i.test(e.id || '')));
  if (i < 0) i = lastPick;
  const slip = el.children[i];
  if (!slip || settings.calm) return;      // with reduced motion the slips simply leave
  ceremony = {timers: []};
  el.classList.add('picked'); slip.classList.add('chosen');
  comingBoon = element ? e.id : null;      // by id: the simulation may add the boon to the hero a step after it says so
  ceremony.timers.push(setTimeout(() => audio.stamp(), 110));
  ceremony.timers.push(setTimeout(() => {
    const target = element ? $('boons').querySelector('.coming') : $('band');
    if (!target) return;
    const a = slip.getBoundingClientRect(), b = target.getBoundingClientRect(), k = clamp(b.height / a.height, .08, 1);
    slip.classList.add('flying');
    slip.style.transform = `translate(${(b.left + b.width / 2 - a.left - a.width / 2).toFixed(1)}px, ${(b.top + b.height / 2 - a.top - a.height / 2).toFixed(1)}px) scale(${k.toFixed(3)})`;
  }, 620));
  ceremony.timers.push(setTimeout(endCeremony, 1100));
}
/** Put the keyboard on the sheet's main button, so Enter does what the sheet says and nothing else. */
function focusGo() { const b = $('sheet-body').querySelector('.go'); if (b && !bench) b.focus({preventScroll: true}); }
function sheet(html, cls = '') { $('sheet').className = `sheet show ${cls}`; $('sheet-body').innerHTML = html; }
function hideSheet() { $('sheet').className = 'sheet'; }
function showTitle() {
  sheet(`<span class="seal" aria-hidden="true">周</span><p class="eyebrow">${t.eyebrow}</p><h1>${t.name}<small>${t.other}</small></h1><p class="tag">${t.tag}</p>
    <ul class="how">${t.how.map(x => `<li>${x}</li>`).join('')}</ul><p class="tip">${t.tip}</p>
    ${touchOnly ? `<p class="notice">${t.needKeys}</p>` : ''}<div class="actions"><button class="go" data-do="begin">${t.start}</button><span class="note" id="load-line" role="status"></span></div>`, 'title');
  loadLine(); focusGo();
}
/* Loading. The title sheet is up as soon as this script runs; the rules, the figures, the effects and the first place
   come in behind it. The line beside the button reports what has really arrived: a share when the art module reports
   one (`onProgress(done, total)`, an option it may or may not know), else the megabytes received so far. */
const load = {bytes: 0, done: 0, total: 0, queued: false};
try { new PerformanceObserver(list => { for (const e of list.getEntries()) load.bytes += e.transferSize || e.encodedBodySize || 0; loadLine(); }).observe({type: 'resource', buffered: true}); } catch { /* no observer: the line shows no number */ }
function loadLine() {
  const el = $('load-line'); if (!el) return;
  if (mode !== 'loading') { el.textContent = ''; return; }
  const pct = load.total > 0 ? Math.min(99, Math.round(100 * load.done / load.total)) : null;
  el.textContent = load.queued ? t.queued : load.bytes || pct != null ? t.loadingAt((load.bytes / 1048576).toFixed(1), pct) : t.loading;
}
function showEnd() {
  const won = game.phase === 'won';
  sheet(`<p class="eyebrow">${t.reached(game.wave)}</p><h2>${won ? t.won : t.lost}</h2><p class="tag">${t.stats(game.stats)}</p>
    <button class="go" data-do="begin">${t.again}</button>`, 'end');
  focusGo();
}
function showError(err) {
  const part = err.part, who = part ? t.missing[part] : '', why = err.why === 'missing' ? t.missingTail : t.broken;
  const q = new URLSearchParams(location.search); q.set('stub', '1');
  // A visitor is told plainly what the game needs; the reason and the way round it (the stand-in modules) are for whoever is building it.
  const dev = import.meta.env.DEV || params.has('stub') || params.has('perf');
  sheet(`<p class="eyebrow">${t.name}</p><h2>${t.noStart}</h2><p class="tag">${t.noStartTail}</p>
    ${dev ? `<p class="note">${part ? `${who} ${why}. ` : ''}${String(err.message).replace(/[<&]/g, '')}</p><a class="go" style="display:inline-grid;place-items:center;text-decoration:none" href="?${q}">${t.stub}</a>` : ''}`, 'error');
}
function pause(on) {
  mode = on ? 'paused' : 'play';
  if (on) {
    const v = Math.round(settings.volume * 100);
    sheet(`<h2>${t.paused}</h2><p class="note">${t.hint}</p>
      <fieldset class="settings"><legend>${t.settings}</legend>
        <label class="row"><span>${t.volume}</span><input type="range" id="set-volume" min="0" max="100" step="5" value="${v}"><output id="set-volume-out">${v}</output></label>
        <label class="row"><input type="checkbox" id="set-shake"${settings.shake ? ' checked' : ''}${settings.calm ? ' disabled' : ''}><span>${t.shake}</span></label>
        <label class="row"><input type="checkbox" id="set-calm"${settings.calm ? ' checked' : ''}><span>${t.calm} <small>${t.calmNote}</small></span></label>
      </fieldset>
      <div class="actions"><button class="go" data-do="resume">${t.resume}</button><button class="plain" data-do="leave">${t.leave}</button></div>`, 'pause');
    focusGo();
  } else { hideSheet(); focusGame(); }
  last = performance.now(); acc = 0; hudKey = '';
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'set-volume') { settings.volume = clamp(el.value / 100, 0, 1); $('set-volume-out').textContent = el.value; }
  else if (el.id === 'set-shake') settings.shake = el.checked;
  else if (el.id === 'set-calm') { settings.calm = el.checked; $('set-shake').disabled = el.checked; }
  else return;
  applySettings(true);
});
document.addEventListener('change', e => { if (e.target.id === 'set-volume') { audio.ensure(); audio.order('follow'); } });      // let the new volume be heard
async function begin() {
  if (mode === 'loading') { load.queued = true; loadLine(); return; }      // asked for early: the battle starts the moment it can
  if (mode === 'error' || starting) return;
  audio.ensure();
  if (used) {
    game = sim.createGame(newSeed());
    // a new battle starts on a clean sheet; the contract has no call for that, so use reset() if the art has one, else load it again
    if (art.reset) art.reset();
    else if (art.debug && art.debug.clearMarks) art.debug.clearMarks();
    else { starting = true; try { art = await artMod.loadArt({lang}); art.setView({width: W, height: H, dpr}); } finally { starting = false; } }
  }
  teach.on = !bench && !store.get('muye.played'); teach.braced = teach.stopped = teach.leapt = false; hideHint(); hinted.clear(); hintAt = -1e9;
  endCeremony(); landedBoon = comingBoon = null; celebrated = {id: null, t: -1}; boonKey = ''; slowK = 0; strikeDown.key = strikeDown.mouse = strikeDown.sent = false; edge.gallop = edge.rally = false;
  strikeBuf = 0;
  used = true; endAt = 0; fallAt = -1; closeIn.x = 1; closeIn.v = 0; frameCam(); $('blow').className = ''; $('blow').textContent = ''; hurtFlash = 0; shake.t = 1; bot.n = 0; bot.dir = 1;
  edge.leap = edge.strike = false; edge.order = edge.pick = null;
  // for measuring at the art budget's load (about 30 figures): jumpTo is outside the contract, so use it only if the simulation has it
  if (bench && sim.jumpTo) sim.jumpTo(game, LAST_WAVE, {shield: 6, spear: 6, archer: 4, soldiers: 10, officers: 6});      // v2 names, and v1's
  setTone(0);
  look.x = lead(); look.v = 0;
  mode = 'play'; hideSheet(); hudKey = ''; focusGame();
  last = performance.now(); acc = 0;
}
function toggleSound() { audio.ensure(); audio.toggle(); hudKey = ''; }
function setLang(next) {
  const changed = next !== lang;
  lang = next; t = COPY[lang];
  if (changed) {      // a choice made here is the site's choice too, and the address says it, so a copied link opens in the same language
    store.set(SITE_PREFS, JSON.stringify({...sitePrefs(), lang}));
    const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(history.state, '', url);
  }
  document.title = t.docTitle;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  $('back').textContent = t.back; $('back').href = `/?lang=${lang}`; $('lang').textContent = lang === 'zh' ? 'EN' : '中文';
  text('hp-label', t.hp); text('charge-label', t.charge); $('blow').className = ''; $('blow').textContent = '';
  hudKey = ''; boonKey = ''; if (!ceremony) slipsFor = null;
  if (mode === 'title' || mode === 'loading') showTitle(); else if (mode === 'paused') pause(true); else if (mode === 'play' && ended() && endAt === Infinity) showEnd();
}
document.addEventListener('click', e => {
  // the way back: in the middle of a battle it does not leave, it pauses, and the pause sheet has the button that leaves
  if (e.target.closest('#back') && running()) { e.preventDefault(); if (mode === 'play') pause(true); const b = $('sheet-body').querySelector('[data-do=leave]'); if (b) b.focus({preventScroll: true}); return; }
  const b = e.target.closest('button'); if (!b) return;
  audio.ensure();
  if (b.dataset.do === 'begin') begin();
  else if (b.dataset.do === 'resume') pause(false);
  else if (b.dataset.do === 'leave') { location.href = $('back').href; return; }
  else if (b.dataset.pick && mode === 'play') edge.pick = +b.dataset.pick;
  else if (b.dataset.order && mode === 'play') edge.order = b.dataset.order;
  else if (b.id === 'lang') setLang(lang === 'zh' ? 'en' : 'zh');
  else if (b.id === 'sound') toggleSound();
  if (mode === 'play' && endAt !== Infinity) focusGame(); else if (!b.dataset.do) b.blur();      // in a battle the keyboard goes straight back to the game
});

/* ---------- the torn edge of the HUD's paper ---------- */
/**
 * A panel of HUD paper has no ruled side and no shadow: its edge wanders a few pixels and fades out. The shape is drawn
 * once here as a mask (a wandering outline, filled, with a soft halo) and handed to the style sheet; the panel itself
 * is then a plain fill of the scene's paper colour under that mask, so a change of the colour costs nothing to repaint.
 */
function edgeMask(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), m = 18;
  let s = seed, drift = 0;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const walk = () => (drift = drift * .8 + (rnd() - .5) * 4.4);
  x.beginPath();
  for (let px = m; px < w - m; px += 8) x.lineTo(px, m + walk());
  for (let py = m; py < h - m; py += 8) x.lineTo(w - m + walk(), py);
  for (let px = w - m; px > m; px -= 8) x.lineTo(px, h - m + walk());
  for (let py = h - m; py > m; py -= 8) x.lineTo(m + walk(), py);
  x.closePath();
  x.shadowColor = '#000'; x.shadowBlur = 9; x.fillStyle = '#000'; x.fill();
  return `url(${c.toDataURL('image/png')})`;
}
try {
  document.documentElement.style.setProperty('--edge-tall', edgeMask(400, 360, 7));
  document.documentElement.style.setProperty('--edge-wide', edgeMask(600, 96, 11));
} catch { /* no mask: the panels are plain paper */ }

/* ---------- warming up ---------- */
/**
 * Things the browser does on first use cost a long frame if that first use is in the middle of a battle. They are used
 * once here, under the title sheet: the slips, the stamp and the boon signs are laid out and painted off screen (which
 * loads the serif's bold cut and the system's Chinese face for the five signs), and the element tooltips with them.
 */
function warm() {
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:-2000px;top:0;width:700px;opacity:.01;pointer-events:none';
  const signs = Object.values(ELEMENTS).map(e => e.sign).join('') + Object.values(KIND_SIGN).join('');
  box.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,206px);gap:14px"><button class="slip chosen" style="--pig:#B8321F;--on:#FFFDF8;--i:0"><span class="top"><kbd>1</kbd><span class="el"><i class="sign">${signs}</i>${Object.values(t.elements).join(' ')}</span></span><strong>${t.up.quake[0]} ${COPY.zh.up.quake[0]}</strong><span class="what">${t.up.quake[1]}</span><span class="feed">${t.fedBy('', '')}</span><i class="stamp">${signs}</i></button></div><button class="boon landed" style="--pig:#2F4F7A;--on:#FFFDF8">${signs}</button><div id="warm-banner" style="font:700 38px var(--serif)">${t.captainWave(6)} ${t.rout}</div>`;
  document.body.append(box);
  setTimeout(() => box.remove(), 1500);
}

/* ---------- loop ---------- */
let last = 0, acc = 0, slow = 0, ema = STEP, held = {move: 0}, slowK = 0, stepN = 0;
// A strike pressed just before the last one has finished is kept for STRIKE_BUFFER steps (0.15 s) and comes out the moment
// the recovery ends; only if it runs out is the press refused.
const STRIKE_BUFFER = 9;
let strikeBuf = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000 || 0, 0, .1); last = now;
  const t0 = performance.now();
  // When the rider falls the picture slows: time runs at FALL.scale for FALL.hold seconds, then eases back to full speed.
  let scale = 1;
  if (fallAt >= 0 && mode === 'play') {
    const k = clamp((fallAt - FALL.hold) / FALL.ease, 0, 1);
    scale = FALL.scale + (1 - FALL.scale) * k * k * (3 - 2 * k);
    fallAt += dt; if (k >= 1) fallAt = -1;
  }
  // A display at 60 or 120 Hz delivers frames a few tenths of a millisecond early or late; taken literally that gives the
  // odd frame with no step in it (one frame more before a key shows) and the odd frame with two. Read such a frame as exact.
  // While the slips hang, the field runs slow under them (SPEC-V2 section 8), and comes back up to speed after the pick.
  slowK += ((game.phase === 'choose' && mode === 'play' && !settings.calm && !bench ? 1 : 0) - slowK) * Math.min(1, dt * 7);
  scale *= 1 - .7 * slowK;
  let tick = dt; for (const n of [1, 2]) if (Math.abs(dt - STEP / n) < .0007) tick = STEP / n;
  const simDt = tick * scale;
  if (mode === 'play') {
    acc += simDt;
    if (edge.pick != null && game.phase === 'choose') acc = Math.max(acc, STEP);      // time is slow under the slips, but the pick is taken on this frame
    let first = true;
    while (acc >= STEP) {
      // every step in a frame rides the same way; the edges go to the first one only
      const input = bench ? botInput() : first ? readInput() : carry(held);
      if (input.pick != null) lastPick = input.pick;
      const pressed = input.strike;
      if (strikeBuf > 0 && !pressed) input.strike = true;      // the kept press, offered again
      held = input; first = false;
      const hero = game.hero, grounded = hero.y <= 0, able = !bench && !ended() && hero.state !== 'fallen';
      let leapt = false, swung = false, dashed = false, rallied = false;
      sim.step(game, input, STEP);
      acc -= STEP;
      if (game.events.length) { for (const e of game.events) { if (e.type === 'leap') leapt = true; else if (e.type === 'swing' || e.type === 'sweep') swung = true; else if (e.type === 'dash') dashed = true; else if (e.type === 'rally') rallied = true; art.onEvent(e, game); handle(e); if (perf.on && frameEvents.length < 12) frameEvents.push(e.type); } game.events.length = 0; }
      if (able && game.hero.state !== 'fallen') {
        if (input.leap && grounded && !leapt) refuse('leap');
        if (swung || !grounded) strikeBuf = 0;      // it came out (in the air a strike arms the blow on landing, which has no event yet)
        else if (pressed) strikeBuf = STRIKE_BUFFER;
        else if (strikeBuf > 0 && --strikeBuf === 0) refuse('strike');
        if (game.hero.cd) { if (input.gallop && !dashed) refuse('gallop'); if (input.rally && !rallied) refuse('rally'); }
      }
      watchSpears(); if (++stepN % 6 === 0) watchVerbs();
      if (ended() && !endAt) { endAt = performance.now() + 900; store.set('muye.played', '1'); }
    }
    const h = game.hero;
    audio.hooves(Math.abs(h.vx), h.topSpeed, h.y <= 0 && h.state !== 'stopped' && !ended(), simDt);
    if (hurtFlash > 0) hurtFlash -= dt * 3;
  }
  const t1 = performance.now();
  draw(mode === 'play' ? acc / STEP : 1, mode === 'paused' ? 0 : simDt, mode === 'paused' ? 0 : dt);
  const tD = performance.now();
  hud();
  if (paperDue.length && mode !== 'paused') { paperDue = paperDue.map(v => v - dt); if (paperDue[0] <= 0) { paperDue.shift(); samplePaper(); } }
  const t2 = performance.now();
  // old machines: if frames stay long, draw fewer pixels (each drop makes the art module cut its sprites again, so wait before judging again)
  // The test is a smoothed frame time above 21 ms (under about 48 frames a second) held for two seconds; counting slow frames
  // one by one misses a machine that alternates a fast frame with a very slow one.
  if (mode === 'play' && dt > 0) {
    ema += (dt - ema) * .05;
    slow = ema > .021 ? slow + dt : Math.min(slow, 0) + (slow < 0 ? dt : 0);
    if (slow > 2 && resScale > .5) { resScale -= .25; slow = -3; ema = STEP; resize(); }
  }
  if (perf.on) {
    if (dt > .03 && perf.long.length < 200) perf.long.push({at: +(game.t).toFixed(2), frame: Math.round(dt * 1000), sim: +(t1 - t0).toFixed(1), draw: +(tD - t1).toFixed(1), hud: +(t2 - tD).toFixed(1), phase: game.phase, wave: game.wave, ev: frameEvents.splice(0).join(',')});
    frameEvents.length = 0;
    perf.frame[perf.i] = dt * 1000; perf.sim[perf.i] = t1 - t0; perf.draw[perf.i] = t2 - t1; perf.i = (perf.i + 1) % 600; perf.n = Math.min(600, perf.n + 1);
    if (perf.i % 30 === 0) { const s = perfStats(), f = (o, d = 2) => `${o.avg.toFixed(d)} · p95 ${o.p95.toFixed(d)}`; $('perf').textContent = `frame ${f(s.frame, 1)} ms\nsim   ${f(s.sim)}\ndraw  ${f(s.draw)}\n${s.figures} figures · ${canvas.width}×${canvas.height} px (×${dpr.toFixed(2)})`; }
  }
}
function perfStats() {
  const out = {};
  for (const k of ['frame', 'sim', 'draw']) { const a = Array.from(perf[k].subarray(0, perf.n)).sort((x, y) => x - y), n = a.length || 1; out[k] = {avg: a.reduce((s, v) => s + v, 0) / n, p95: a[Math.floor(n * .95)] || 0, max: a[n - 1] || 0}; }
  return {...out, figures: game ? game.units.length + 1 : 0, dpr, resScale, zoom: cam.zoom, backing: [canvas.width, canvas.height], samples: perf.n};
}

/* ---------- start ---------- */
const hook = window.__fengshen = {get game() { return game; }, get mode() { return mode; }, get art() { return art; }, perfStats, perf, cam, begin, teach, learned, settings, setTone, showHint, ready: false, modules: {sim: useStub('sim') ? 'stub' : 'real', art: useStub('art') ? 'stub' : 'real'}};
(async function start() {
  const t0 = performance.now();
  setLang(lang);      // the title sheet, at once
  try {
    if (!ctx) throw new Error('this browser gave no 2D canvas');
    [sim, artMod] = await Promise.all([loadModule('sim', ['createGame', 'step', 'counts']), loadModule('art', ['loadArt'])]);
    art = await artMod.loadArt({lang, onProgress: (done, total) => { load.done = done; load.total = total; loadLine(); }});
    if (Number.isInteger(sim.LAST_WAVE)) LAST_WAVE = sim.LAST_WAVE;
    game = sim.createGame(newSeed());
  } catch (err) {
    mode = 'error'; hook.error = String(err.message || err); showError(err);
    console.warn('[muye]', err);
    return;
  }
  resize(); applySettings(false);
  cam.x = game.hero.x; look.x = lead();
  setTone(0);
  mode = 'title'; loadLine(); hudKey = '';
  warm();
  if (perf.on) $('perf').hidden = false;
  hook.ready = Math.round(performance.now() - t0) || 1;
  last = performance.now();
  requestAnimationFrame(frame);
  if (bench || load.queued) begin();
})();
