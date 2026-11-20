// 牧野 / Muye as a survivors-like: the page (lab/game-studies/SPEC-SURVIVORS.md section 5). It runs the rules in fixed
// steps, hands the picture to the art module, and keeps everything a reader must read as crisp type in the DOM.
// The page draws nothing on the canvas: ink and paint belong to art/, rules to sim.js. Built from the side-view game's
// page (world/src/fengshen/main.js): the loop, the input edges, the two languages, settings, loading and the overlay.
//   ?lang=zh        Chinese          ?stub=1        stand-ins for both modules (?stub=sim or ?stub=art for one)
//   ?perf=1         timing overlay   ?bench=1       a scripted run with a fixed build among 300 foes, for measuring
//   ?seed=7         a fixed field
import './muye.css';
import {createAudio} from './audio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } }};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

const STEP = 1 / 60, RUN = 600, DASH_CD = 3, BASE_SPEED = 215;
// The five elements: pigment, and the colour a sign is written in on that pigment (a light sign on bronze gold is too faint).
const PIGMENT = {fire: '#B8321F', water: '#2F4F7A', wood: '#3F7D6A', metal: '#B08A3C', earth: '#35302B', none: '#6B645C'};
const ON = {metal: '#14110F'};
const ELEMENT_SIGN = {fire: '火', water: '水', wood: '木', metal: '金', earth: '土'};
// One character stands for each thing in the HUD and on a slip. A row of the content table may bring its own (`sign`);
// otherwise a treasure or an art is known by the last character of its Chinese name (枪, 绫, 珠, 圈 …) and a troop or a
// formation by the first (干, 戈, 射; 圆, 锋, 八). The few names where that gives an element's own character are listed.
const SIGN = {sanmei: '昧', houtu: '厚', strongmen: '力', trample: '马', peach: '桃', tuxingsun: '孙', leizhenzi: '震', tigers: '虎', hooks: '钩', acolytes: '童', chariots: '车'};
// The five ranks of a troop (spec 6.2), used when the rules do not export their own table.
const RANKS = [{rank: 1, at: 1, name: {en: 'levy', zh: '卒'}}, {rank: 2, at: 3, name: {en: 'picked men', zh: '锐士'}}, {rank: 3, at: 5, name: {en: 'armoured men', zh: '甲士'}}, {rank: 4, at: 7, name: {en: 'dark-armour guard', zh: '玄甲'}}, {rank: 5, at: 8, name: {en: 'blessed host', zh: '神兵'}}];

/* ---------- copy ---------- */
const COPY = {
  en: {
    back: '← Yaxin Luo', name: 'Muye', other: '牧野', docTitle: 'Muye · Yaxin Luo', eyebrow: 'yaxin luo / a battle in ink', tag: 'You only ride. Everything you own fights by itself.',
    how: ['<b>W</b><b>A</b><b>S</b><b>D</b> or arrows: ride', '<b>Space</b> Jiliang’s spring: through foes, unharmed', '<b>1</b><b>2</b><b>3</b> take a gift · <b>R</b> reroll · <b>B</b> banish', '<b>Esc</b> pause · <b>M</b> sound'],
    tip: 'Ride on without a sharp turn and Jiliang comes into full cry: faster, and he tramples what he rides through. Ride over the battle spirit the fallen leave: enough of it is a level, and a level is a gift.',
    needKeys: 'This game needs a keyboard for now. Touch controls are not built yet.', noStart: 'This browser could not start the game', noStartTail: 'Muye needs a current browser with canvas drawing. A recent Chrome, Edge, Firefox or Safari will do.',
    settings: 'Settings', volume: 'Sound volume', shake: 'Screen shake', calm: 'Reduced motion', calmNote: 'no shake, no slow motion', leave: 'Leave the game',
    start: 'Ride out', again: 'Ride again', sameSeed: n => `Same field (seed ${n})`, resume: 'Resume', paused: 'Paused', yourBuild: 'What you own',
    kinds: {treasure: 'Treasure', art: 'Art', troop: 'Troop', formation: 'Formation', general: 'General', mend: 'Rest'}, rows: {treasure: 'treas.', art: 'arts', troop: 'troops', formation: 'form.', general: 'gen.'},
    groups: {treasure: 'Treasures', troop: 'Troops', general: 'Generals', trample: 'Jiliang', other: 'Other'}, trueForm: 'true form', trueFormOf: name => `True form: ${name}`, joins: name => `${name} joins you`, returnsIn: n => `withdrawn, back in ${n} s`, blessedHost: name => `Blessed host: ${name}`,
    skillAt: name => `squad skill ${name} unlocks at level 3`, patronNeed: name => `fifth rank: level 8, a chest, and ${name} with you`, patronHave: name => `fifth rank: level 8 and a chest (${name} is with you)`, patronOf: names => `patron of ${names}: they can reach the fifth rank`, trueFormNeed: 'true form at level 5 with a chest', unlockSelf: into => `leads to ${into}`, unlockOther: (name, into) => `lets ${name} become ${into}`, unlockForm: into => `leads to his true form: ${into}`, unlockHost: into => `leads to the blessed host: ${into}`, unlockHostOther: (name, into) => `lets ${name} become the blessed host: ${into}`,
    elements: {fire: 'fire', water: 'water', wood: 'wood', metal: 'metal', earth: 'earth'},
    offerFirst: 'Choose your first treasure', chestTitle: 'Chest · call a general to your side', chestHow: 'take one · 1 2 3 · no reroll, no banish', offerLevel: n => `Level ${n}`, offerHow: 'take one · 1 2 3', isNew: 'new', levelTo: (a, b) => `Lv ${a} → ${b}`, evolution: 'evolution', evolvedFrom: name => `from ${name}`,
    reroll: 'Reroll', banish: 'Banish', banishWhich: 'Banish which? 1 2 3 · Esc to cancel', left: n => `${n} left`,
    evolvesWith: (el, sign) => `evolves at level 6 · needs ${el} ${sign} art`, evolvesOwned: (art) => `evolves at level 6: you have ${art}`, readyToEvolve: 'ready to evolve: open a chest', letsEvolve: names => `lets ${names} evolve at level 6`, replaces: name => `replaces ${name}`,
    peach: ['Peach of immortality', 'Nothing is left to learn. Rest, and mend.'],
    hp: 'health', spirit: 'battle spirit', lv: n => `Lv ${n}`, kills: 'felled', dash: 'spring', resonance: 'reson.',
    evolved: name => `Evolved: ${name}`, comes: name => `${name}`, encircled: 'Encircled', chestGave: name => `Chest: ${name}`, chestMend: 'Chest: mended',
    won: 'The field is yours', lost: 'You fell', time: 'time', level: 'level', work: 'What did the work', trample: 'Jiliang’s trample', share: p => `${p}%`, nothing: 'nothing struck a blow',
    sound: on => on ? 'sound on' : 'sound off',
    loading: 'grinding ink…', loadingAt: (mb, pct) => `grinding ink… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: 'the battle starts as soon as the ink is ready',
    hint: 'WASD or arrows ride · Space spring · 1 2 3 take · R reroll · B banish · M sound · Esc pause',
    missing: {sim: 'The rules', art: 'The art module'}, missingTail: 'is not in this checkout yet', broken: 'does not match the contract', stub: 'Run with stand-ins',
  },
  zh: {
    back: '← 罗亚鑫', name: '牧野', other: 'Muye', docTitle: '牧野 · 罗亚鑫', eyebrow: '罗亚鑫 / 水墨战场', tag: '你只管骑。你拥有的一切自己会打。',
    how: ['<b>W</b><b>A</b><b>S</b><b>D</b> 或方向键：骑行', '<b>空格</b> 吉量腾跃：穿过敌人，不受伤害', '<b>1</b><b>2</b><b>3</b> 取一件 · <b>R</b> 重选 · <b>B</b> 剔除', '<b>Esc</b> 暂停 · <b>M</b> 声音'],
    tip: '一直骑、不急转，吉量就进入冲阵：更快，并踩踏所过的敌人。骑过倒下的敌人留下的战意：攒够了就升一级，每升一级得一件。',
    needKeys: '这个游戏目前需要键盘，触屏操作还没有做。', noStart: '这个浏览器没能启动游戏', noStartTail: '《牧野》需要支持画布绘制的新版浏览器：较新的 Chrome、Edge、Firefox 或 Safari 都可以。',
    settings: '设置', volume: '音量', shake: '画面震动', calm: '减少动效', calmNote: '无震动，无慢动作', leave: '离开游戏',
    start: '出阵', again: '再来一局', sameSeed: n => `同一战场（种子 ${n}）`, resume: '继续', paused: '已暂停', yourBuild: '你拥有的',
    kinds: {treasure: '法宝', art: '心法', troop: '兵', formation: '阵法', general: '将', mend: '休整'}, rows: {treasure: '法宝', art: '心法', troop: '兵', formation: '阵', general: '将'},
    groups: {treasure: '法宝', troop: '兵', general: '将', trample: '吉量', other: '其他'}, trueForm: '显圣', trueFormOf: name => `显圣：${name}`, joins: name => `${name}来助`, returnsIn: n => `暂退，${n} 秒后归来`, blessedHost: name => `神兵：${name}`,
    skillAt: name => `三级解锁小队技能「${name}」`, patronNeed: name => `升神兵：八级、一个宝箱，并有${name}在阵`, patronHave: name => `升神兵：八级加一个宝箱（${name}已在阵）`, patronOf: names => `${names}的主将：他们可升为神兵`, trueFormNeed: '五级时开宝箱可显圣', unlockSelf: into => `进化为 ${into}`, unlockOther: (name, into) => `让${name}进化为 ${into}`, unlockForm: into => `可显圣：${into}`, unlockHost: into => `可升神兵：${into}`, unlockHostOther: (name, into) => `让${name}升为神兵：${into}`,
    elements: {fire: '火', water: '水', wood: '木', metal: '金', earth: '土'},
    offerFirst: '选第一件法宝', chestTitle: '宝箱 · 请一位神将', chestHow: '取一位 · 1 2 3 · 不可重选或剔除', offerLevel: n => `第 ${n} 级`, offerHow: '取一件 · 1 2 3', isNew: '新', levelTo: (a, b) => `${a} 级 → ${b} 级`, evolution: '进化', evolvedFrom: name => `由${name}进化`,
    reroll: '重选', banish: '剔除', banishWhich: '剔除哪一张？1 2 3 · Esc 取消', left: n => `剩 ${n} 次`,
    evolvesWith: (el, sign) => `六级时配合${el}系心法进化`, evolvesOwned: (art) => `六级时进化：你已有${art}`, readyToEvolve: '可以进化了：打开一个宝箱', letsEvolve: names => `能让${names}在六级时进化`, replaces: name => `替换${name}`,
    peach: ['仙桃', '已经没有可学的了。歇一歇，回复生命。'],
    hp: '命', spirit: '战意', lv: n => `${n} 级`, kills: '斩', dash: '腾跃', resonance: '共鸣',
    evolved: name => `进化：${name}`, comes: name => `${name}来袭`, encircled: '四面合围', chestGave: name => `宝箱：${name}`, chestMend: '宝箱：回复生命',
    won: '此战告捷', lost: '你倒下了', time: '用时', level: '等级', work: '谁出的力', trample: '吉量踩踏', share: p => `${p}%`, nothing: '没有打出一击',
    sound: on => on ? '声音：开' : '声音：关',
    loading: '正在研墨…', loadingAt: (mb, pct) => `正在研墨… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: '墨一研好就出阵',
    hint: 'WASD 或方向键骑行 · 空格 腾跃 · 1 2 3 取 · R 重选 · B 剔除 · M 声音 · Esc 暂停',
    missing: {sim: '规则模块', art: '美术模块'}, missingTail: '还不在这份代码里', broken: '与约定的接口不符', stub: '用替身模块运行',
  },
};
// Language: `?lang=` first, else the preference the homepage and the blog share.
const SITE_PREFS = 'yaxin.grimoire.preferences';
function sitePrefs() { try { const p = JSON.parse(store.get(SITE_PREFS) || '{}'); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
const asked = params.get('lang');
let lang = asked === 'zh' || asked === 'en' ? asked : sitePrefs().lang === 'zh' ? 'zh' : 'en';
let t = COPY[lang];

/* ---------- the two modules ---------- */
// The real modules are written by other hands and may be missing: import.meta.glob finds them if they exist and leaves an
// empty map if they do not, so a missing file is a message on the page instead of a failed build.
const FILES = {sim: 'src/muye/sim.js', art: 'src/muye/art/index.js'};
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
  const lacking = needs.filter(n => typeof mod[n] !== 'function' && typeof mod[n] !== 'object');
  if (lacking.length) throw Object.assign(new Error(`${FILES[k]} does not export ${lacking.join(', ')}`), {part: k, why: 'broken'});
  return mod;
}

/* ---------- state ---------- */
const canvas = $('field'), ctx = canvas.getContext('2d', {alpha: false});
let sim = null, artMod = null, art = null, game = null;
let mode = 'loading';                 // loading | error | title | play | paused   (game.phase covers offer / won / lost)
let W = 0, H = 0, dpr = 1, used = false, starting = false, endAt = 0, seed = 0;
const cam = {x: 3000, y: 3000, zoom: 1, shakeX: 0, shakeY: 0};
const look = {x: 0, y: 0, vx: 0, vy: 0};      // the camera's lead, on a spring
const shake = {ax: 0, ay: 0, t: 1};
const FALL = {scale: .35, hold: .6, ease: .5};
let fallAt = -1, hurtFlash = 0, toneAt = -1;
const audio = createAudio();
const keys = new Set(), edge = {dash: false, pick: null, reroll: false, banish: null};
const lastAxis = {x: 0, y: 0};
const bench = params.has('bench');
const frameEvents = [];
const perf = {long: [], on: params.has('perf') || bench, frame: new Float32Array(600), sim: new Float32Array(600), draw: new Float32Array(600), i: 0, n: 0};
const touchOnly = navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches;
const newSeed = () => (Date.now() % 100000) + 1;

// Settings on the pause sheet; one record with the side-view game, so a choice made in either holds in both.
const calmByDefault = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = {volume: .8, shake: true, calm: calmByDefault};
try { const saved = JSON.parse(store.get('muye.settings') || '{}'); if (typeof saved.volume === 'number') settings.volume = clamp(saved.volume, 0, 1); if (typeof saved.shake === 'boolean') settings.shake = saved.shake; if (typeof saved.calm === 'boolean') settings.calm = saved.calm; } catch { /* a damaged entry: keep the defaults */ }
const shakeOn = () => settings.shake && !settings.calm;
function applySettings(save) {
  audio.setVolume(settings.volume);
  document.documentElement.classList.toggle('calm', settings.calm);
  if (save) store.set('muye.settings', JSON.stringify(settings));
}

const MAX_PIXELS = 1920 * 1200;
let resScale = 1;
function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(1, W * H))) * resScale;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  // a 1440 x 900 window shows the field at the view study's size; other windows show about the same area of it
  cam.zoom = clamp(Math.sqrt(W * H / (1440 * 900)), .7, 1.6);
  if (art) art.setView({width: W, height: H, dpr});
}
addEventListener('resize', resize);

/* ---------- what a thing is called, and its sign ---------- */
const KINDS = ['treasure', 'art', 'troop', 'formation', 'general'];
const kindOf = id => KINDS.find(k => rowOf(k, id));
/** A treasure's evolved form is known by its own id in events and in the damage table: find the treasure it came from. */
const evolvedFrom = id => (sim.CONTENT.treasures || []).find(r => r.evolved && r.evolved.id === id);
function rowOf(kind, id) { return sim.BY && sim.BY[kind] ? sim.BY[kind][id] : (sim.CONTENT[kind + 's'] || []).find(r => r.id === id); }
function signOf(kind, id) {
  const row = kind && rowOf(kind, id);
  if (row && row.sign) return row.sign;
  if (SIGN[id]) return SIGN[id];
  const zh = row && row.name && row.name.zh;
  if (!zh) return '·';
  return kind === 'treasure' || kind === 'art' ? zh[zh.length - 1] : zh[0];
}
/** The words of a thing at a level. One past the top level is its last form: a treasure evolved, a general's true form, a blessed host. */
function wordsOf(kind, id, level) {
  if (kind === 'mend') return {name: t.peach[0], text: t.peach[1], element: null};
  const row = rowOf(kind, id); if (!row) return {name: id, text: '', element: null};
  const last = level > maxOf(kind) ? row.evolved || (row.trueForm && {name: row.name, text: row.trueForm.text}) || (row.blessed && {name: row.name, text: row.blessed.text}) : null;
  let d = null;
  try { d = sim.describe ? sim.describe(kind, id, level) : null; } catch { /* a level the rules have no words for: the table's own */ }
  if (!d || !d.name || !d.text) d = last || {name: row.name, text: (row.levels[Math.min(level, row.levels.length) - 1] || {}).text || {en: '', zh: ''}};
  return {name: d.name[lang] || d.name.en, text: d.text[lang] || d.text.en, element: row.element || null};
}
const both = name => name ? (lang === 'zh' ? `${name.zh} ${name.en}` : `${name.en} ${name.zh}`) : '';
/** A troop's rank: the rules' own field if they keep one, else from the level (the fifth is never a level alone). */
const rankTable = () => sim.RANKS || RANKS;
const rankAt = (level, blessed) => blessed || level > maxOf('troop') ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
const rankOfEntry = e => e.rank || rankAt(e.level, e.blessed);
/** Ranks are shown only when the rules have them: their own table, or troops of eight levels. */
const ranked = () => !!sim.RANKS || (sim.MAX && sim.MAX.troop >= 8);
const rankName = (rank, short) => { const q = rankTable()[rank - 1], r = q && q.name && q.name.zh ? q : RANKS[rank - 1]; return short ? r.name.zh[0] : lang === 'zh' ? r.name.zh : `${r.name.zh} ${r.name.en}`; };
/** Whether an owned thing is in its last form, and the level that stands for it in the words. */
const lastForm = (kind, e) => !!(e.evolved || e.trueForm || e.blessed || (kind === 'troop' && e.rank === 5));
const formLevel = (kind, e) => lastForm(kind, e) ? maxOf(kind) + 1 : e.level;
const maxOf = kind => (sim.MAX && sim.MAX[kind]) || (kind === 'general' ? 5 : kind === 'troop' ? 8 : 6);
const pig = element => `--pig:${PIGMENT[element] || PIGMENT.none};--on:${ON[element] || '#FFFDF8'}`;
/** The element a source of damage or a cast belongs to: a treasure, its evolved form, a troop. */
function sourceOf(id) {
  const from = evolvedFrom(id);
  if (from) return {kind: 'treasure', id: from.id, element: from.element, name: from.evolved.name[lang] || from.evolved.name.en, evolved: true};
  const kind = kindOf(id);
  if (kind) { const row = rowOf(kind, id); return {kind, id, element: row.element || null, name: row.name[lang] || row.name.en}; }
  if (id === 'trample') return {kind: null, id, element: null, name: t.trample};
  // a squad's skill counts for its troop, a true form for its general
  const tr = (sim.CONTENT.troops || []).find(r => (r.skill && r.skill.id === id) || (r.blessed && r.blessed.id === id));
  if (tr) return {kind: 'troop', id: tr.id, element: tr.element || null, name: tr.name[lang] || tr.name.en};
  const ge = (sim.CONTENT.generals || []).find(r => r.trueForm && r.trueForm.id === id);
  if (ge) return {kind: 'general', id: ge.id, element: ge.element || null, name: ge.name[lang] || ge.name.en};
  return {kind: null, id, element: null, name: String(id)};
}

/* ---------- input ---------- */
const DIRS = {w: [0, -1], ArrowUp: [0, -1], s: [0, 1], ArrowDown: [0, 1], a: [-1, 0], ArrowLeft: [-1, 0], d: [1, 0], ArrowRight: [1, 0]};
const GAME_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ended = () => game.phase === 'won' || game.phase === 'lost';
const offering = () => mode === 'play' && game.phase === 'offer';
const running = () => (mode === 'play' || mode === 'paused') && endAt !== Infinity;
const focusGame = () => canvas.focus({preventScroll: true});
let banishing = false, offerAt = 0;
addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const el = e.target instanceof Element ? e.target.closest('a, button, input') : null;
  const fighting = mode === 'play' && endAt !== Infinity;
  // While a battle is fought the keyboard belongs to it: Tab does not walk off to the links (it may walk the slips of an offer), and no key follows a link.
  if (k === 'Tab' && fighting && !offering()) { e.preventDefault(); focusGame(); return; }
  if ((k === 'Enter' || k === ' ') && el && el.tagName === 'A' && running()) { e.preventDefault(); return; }
  if (GAME_KEYS.includes(k) && (fighting && !(offering() && el) || !el)) e.preventDefault();
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  audio.ensure();
  keys.add(k);
  if (DIRS[k]) { if (DIRS[k][0]) lastAxis.x = DIRS[k][0]; else lastAxis.y = DIRS[k][1]; }
  if (k === 'Escape') { if (banishing) { banishing = false; offerKey = ''; } else if (mode === 'play' && !ended()) pause(true); else if (mode === 'paused') pause(false); }
  if (k === 'Enter' && !el && (mode === 'title' || mode === 'loading' || (mode === 'play' && ended() && endAt === Infinity))) begin();
  if (k === 'm' && !(el && el.tagName === 'INPUT')) toggleSound();
  if (mode !== 'play') return;
  if (k === ' ' && !(offering() && el)) edge.dash = true;
  if (offering()) {
    if (k === '1' || k === '2' || k === '3') choose(+k - 1);
    else if (k === 'r') askReroll();
    else if (k === 'b' || k === 'x') askBanish();
  }
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
function away() { keys.clear(); if (mode === 'play' && !ended() && !bench) pause(true); }
addEventListener('blur', away);
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/** A slip is chosen: taken, or thrown out if the player was banishing. A press in the first quarter second of an offer is not taken, so that a key meant for the fight cannot pick. */
function choose(i) {
  if (!offering() || !game.offer || !game.offer[i] || performance.now() - offerAt < 250) return;
  if (banishing) { if (game.offer[i].kind === 'mend') return; edge.banish = i; banishing = false; audio.banish(); }
  else { edge.pick = i; taken = i; }
}
const fromChest = () => !!game.chestOffer;
function askReroll() { if (!offering()) return; if (fromChest()) { audio.refuse(); return; } if (game.rerolls > 0) { edge.reroll = true; banishing = false; audio.reroll(); } else nudge('reroll'); }
function askBanish() { if (!offering()) return; if (fromChest()) { audio.refuse(); return; } if (game.banishes > 0) { banishing = !banishing; offerKey = ''; } else nudge('banish'); }
function nudge(id) { const el = $(id); el.classList.remove('short'); void el.offsetWidth; el.classList.add('short'); audio.refuse(); }

/** The input for one step: where the reins point (eight directions, a diagonal no faster than a straight), and the edges. */
function readInput() {
  let x = 0, y = 0, l = false, r = false, u = false, d = false;
  for (const k of keys) { const v = DIRS[k]; if (!v) continue; if (v[0] < 0) l = true; else if (v[0] > 0) r = true; else if (v[1] < 0) u = true; else d = true; }
  x = l && r ? lastAxis.x : r ? 1 : l ? -1 : 0; y = u && d ? lastAxis.y : d ? 1 : u ? -1 : 0;
  const n = x && y ? Math.SQRT1_2 : 1;
  const input = {mx: x * n, my: y * n, dash: edge.dash, pick: edge.pick, reroll: edge.reroll, banish: edge.banish};
  edge.dash = edge.reroll = false; edge.pick = edge.banish = null;
  return input;
}
const carry = i => ({mx: i.mx, my: i.my, dash: false, pick: null, reroll: false, banish: null});
/** For ?bench: ride a wide circle through the mass, spring now and then, take the first slip of every offer. */
const bot = {n: 0};
function botInput() { bot.n++; if (bot.n % 30 === 0) benchFoes(420); const a = bot.n / 150; return {mx: Math.cos(a), my: Math.sin(a), dash: bot.n % 240 === 0, pick: game.phase === 'offer' && bot.n % 20 === 0 ? 0 : null, reroll: false, banish: null}; }

/* ---------- events: sound, shake, calls. The paint is the art module's. ---------- */
function kick(dx, dy) {
  if (!shakeOn()) return;
  const k = Math.exp(-shake.t * 16) * Math.cos(shake.t * 52);
  shake.ax = clamp(shake.ax * k + dx, -12, 12); shake.ay = clamp(shake.ay * k + dy, -10, 10); shake.t = 0;
}
/** For checks: a kick as the art would ask for it (see artKick in draw). */
let testKick = null;
const askKick = (x, y) => { testKick = [+x || 0, +y || 0, performance.now()]; return shakeOn(); };
/** The art's own camera kick for a heavy blow: art.kick() -> [dx, dy] in CSS px, 0 when idle. Added to the shake each
    frame, never more than 6 px, and nothing with shake off or reduced motion. */
function artKick() {
  if (!shakeOn()) return [0, 0];
  let k = art.kick ? art.kick() : null;
  if (testKick) { const age = (performance.now() - testKick[2]) / 1000; if (age > .3) testKick = null; else { const w = Math.exp(-age * 16) * Math.cos(age * 52); k = [testKick[0] * w, testKick[1] * w]; } }
  if (!k) return [0, 0];
  const x = +k[0] || 0, y = +k[1] || 0, m = Math.hypot(x, y), c = m > 6 ? 6 / m : 1;
  return [x * c, y * c];
}
const banners = [], PAY_GAP = 1250; let bannerUntil = 0, bannerPay = false;
function banner(text, danger, sub, first, chest) {
  if (banners.some(b => b.text === text)) return;
  if (first) banners.unshift({text, danger, sub}); else if (banners.length < 3) banners.push({text, danger, sub, chest});
}
/** A payoff (an evolution, a blessed host, a true form) is named as itself, whether a chest or a pick brought it:
    its banner goes first, and the chest's own line waiting from the same moment is dropped. */
function payoff(text) {
  for (let i = banners.length - 1; i >= 0; i--) if (banners[i].chest) banners.splice(i, 1);
  if (banners.some(b => b.text === text)) return;
  // ahead of every ordinary line, behind the payoffs already waiting: several at once are read in the order they happen
  let at = 0; while (at < banners.length && banners[at].pay) at++;
  banners.splice(at, 0, {text, danger: false, sub: '', pay: true});
}
/** Shows the next banner when the one on screen has had its two seconds. */
function bannerTick(now) {
  // a payoff's banner follows another payoff's after 1.25 s, the pace at which the art plays their ceremonies; any other waits the full two seconds
  const ready = banners.length && banners[0].pay && bannerPay ? now >= bannerUntil - 2000 + PAY_GAP : now >= bannerUntil;
  if (!banners.length || !ready || mode === 'paused') return;
  const {text, danger, sub, pay} = banners.shift(), b = $('banner');
  bannerPay = !!pay;
  b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : ''); b.className = danger ? 'danger' : ''; void b.offsetWidth; b.classList.add('show');
  bannerUntil = now + 2000;
}
const foeName = kind => { const r = rowOf('foe', kind); return r && r.name ? r.name[lang] || r.name.en : kind; };
/** A foe comes. One with a name of his own is announced by it, in both languages, with the drum; the others as before. */
let arrived = {kind: '', at: -1e9};
/** A foe comes. One with a name of his own is announced by it, in the page's language, his title under it, with the drum;
    his banner goes before any other waiting. One banner for one foe, whether the rules say it by `arrive`, by `boss`, or by both. */
function arrival(e, last) {
  const now = performance.now(); if (arrived.kind === e.kind && now - arrived.at < 3000) return; arrived = {kind: e.kind, at: now};
  const r = rowOf('foe', e.kind), named = e.name || (r && (r.named || e.named) && r.name), title = e.title || (r && r.title);
  if (named) { banner(named[lang] || named.en, true, title ? title[lang] || title.en : '', true); audio.named(last); }
  else { banner(t.comes(foeName(e.kind)), true); if (last) audio.boss(); else audio.elite(); }
}
let freshSign = null;
const joined = new Set();
function join(id) { if (joined.has(id)) return; joined.add(id); const r = rowOf('general', id); if (r) { banner(t.joins(r.name[lang] || r.name.en)); audio.general(r.element); } freshSign = id; buildKey = ''; }
function handle(e) {
  const h = game.hero;
  switch (e.type) {
    case 'cast': { const s = sourceOf(e.id); audio.cast(e.id, s.element || 'earth', !!e.evolved || !!s.evolved); break; }
    case 'kill': audio.kill(!!e.elite); break;
    case 'pickup': if (e.kind === 'peach') audio.peach(); else if (e.kind === 'lodestone') audio.lodestone(); else if (e.kind !== 'chest') audio.pickup(e.size || 0); break;
    case 'chest': audio.chest();      // gave: 'generals' (an offer follows and says so itself), 'evolve' | 'blessed' | 'trueForm' (their own banners), a kind with an id, or 'mend'
      if (['evolve', 'trueForm', 'rank', 'blessed', 'generals'].includes(e.gave)) break;
      { const w = sim.CHEST && sim.CHEST[e.gave], k = KINDS.includes(e.gave) ? e.gave : e.id && kindOf(e.id), r = k && rowOf(k, e.id), name = r ? r.name[lang] || r.name.en : '';
        if (w) banner(w[lang] || w.en, false, name, false, true); else if (e.gave === 'mend' || e.id === 'peach') banner(t.chestMend, false, '', false, true); else if (name) banner(t.chestGave(name), false, '', false, true); }
      break;
    case 'levelUp': audio.levelUp(); $('xp').classList.remove('up'); void $('xp').offsetWidth; $('xp').classList.add('up'); break;
    case 'take': if (e.kind === 'general' && e.isNew) join(e.id);      // in case the rules send no `summon`
      audio.take(e.kind === 'mend' ? 'wood' : (rowOf(e.kind, e.id) || {}).element || 'earth'); freshSign = e.id; buildKey = ''; break;
    case 'evolve': { const s = sourceOf(e.into || e.id); payoff(t.evolved(s.name)); audio.evolve(s.element); freshSign = e.id; buildKey = ''; break; }
    case 'resonance': audio.resonance(); break;
    case 'elite': arrival(e, false); break;
    case 'boss': arrival(e, true); break;
    case 'arrive': arrival(e, e.kind === 'wenzhong'); break;
    case 'squadSkill': { const r = rowOf('troop', e.troop) || {}; audio.skill(e.troop, e.element || r.element || 'earth', e.blessed ? 5 : e.rank || 2); break; }
    case 'generalSkill': { const r = rowOf('general', e.general) || {}; audio.cast(e.general, e.element || r.element || 'earth', !!e.trueForm); break; }
    case 'summon': join(e.general); break;
    case 'generalFall': audio.withdraw(); buildKey = ''; break;
    case 'generalReturn': audio.general((rowOf('general', e.general) || {}).element, true); freshSign = e.general; buildKey = ''; break;
    case 'trueForm': { const r = rowOf('general', e.general); if (r) { payoff(t.trueFormOf(r.trueForm && r.trueForm.name ? `${r.name[lang] || r.name.en} · ${r.trueForm.name[lang] || r.trueForm.name.en}` : r.name[lang] || r.name.en)); audio.trueForm(r.element); } freshSign = e.general; buildKey = ''; break; }
    case 'rankUp': { const r = rowOf('troop', e.troop); if (r && e.rank < 5) audio.take(r.element); freshSign = e.troop; buildKey = ''; break; }
    case 'blessed': { const r = rowOf('troop', e.troop); if (r) { payoff(t.blessedHost(r.name[lang] || r.name.en)); audio.evolve(r.element); } freshSign = e.troop; buildKey = ''; break; }
    case 'encircle': banner(t.encircled, true); audio.encircle(); break;
    case 'warn': audio.warn(); break;
    case 'hurt': {      // the one thing that shakes the view: the push comes from where the blow came
      hurtFlash = 1; audio.hurt();
      const dx = h.x - (e.fromX ?? h.x), dy = h.y - (e.fromY ?? h.y), d = Math.hypot(dx, dy) || 1;
      kick(dx / d * 7, dy / d * 5 || 3);
      $('hp').classList.remove('struck'); void $('hp').offsetWidth; $('hp').classList.add('struck');
      break;
    }
    case 'block': case 'guard': audio.block(); break;
    case 'dash': audio.dash(); break;
    case 'cry': audio.cry(true); break;
    case 'cryEnd': audio.cry(false); break;
    case 'trample': audio.trample(); break;
    case 'fall': if (!settings.calm) fallAt = 0; audio.fall(); break;
    case 'won': audio.won(); break;
    case 'lost': audio.lost(); break;
    default: break;
  }
}

/* ---------- camera and drawing ---------- */
/** A critically damped spring, integrated exactly, so it moves the same at any frame rate. */
function spring(s, kx, kv, target, dt, omega) {
  const d = s[kx] - target, e = Math.exp(-omega * dt), tmp = (s[kv] + omega * d) * dt;
  s[kx] = target + (d + tmp) * e; s[kv] = (s[kv] - omega * tmp) * e;
}
const LEAD = 64;      // world px the view runs ahead of a horse at its base speed
let paperNow = [239, 231, 214];
function setPaper(p) { paperNow = p; const root = document.documentElement.style; root.setProperty('--paper', `rgb(${p.join(',')})`); root.setProperty('--slip', `rgb(${p.map(v => Math.round(v + (255 - v) * .45)).join(',')})`); }
function draw(alpha, dt, realDt) {
  const h = game.hero, hx = h.px + (h.x - h.px) * alpha, hy = h.py + (h.y - h.py) * alpha;
  // The camera is pinned to the interpolated hero, so the horse never slides against the frame; only the lead is sprung.
  const fallen = h.state === 'fallen' || h.state === 'fall';
  spring(look, 'x', 'vx', fallen ? 0 : clamp((h.vx || 0) / BASE_SPEED, -1.4, 1.4) * LEAD, realDt, 3);
  spring(look, 'y', 'vy', fallen ? 0 : clamp((h.vy || 0) / BASE_SPEED, -1.4, 1.4) * LEAD, realDt, 3);
  cam.x = hx + look.x; cam.y = hy + look.y;
  shake.t += realDt;
  const k = shake.t < .4 ? Math.exp(-shake.t * 16) * Math.cos(shake.t * 52) : 0;
  const ak = mode === 'play' ? artKick() : [0, 0];
  cam.shakeX = shake.ax * k + ak[0]; cam.shakeY = shake.ay * k + ak[1];
  // the time of day follows the run; told to the art module in steps, because a change of tone may cost it a repaint
  const tone = clamp(game.t / RUN, 0, 1);
  if (Math.abs(tone - toneAt) >= .02) { toneAt = tone; art.setTime(tone); if (art.paperAt) setPaper(art.paperAt(tone)); }
  for (const layer of ['drawGround', 'drawWorld', 'drawOver']) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (layer === 'drawWorld') art.drawWorld(ctx, cam, game, alpha, dt); else art[layer](ctx, cam, dt);
    ctx.restore();
  }
}

/* ---------- HUD (DOM: everything a reader must read is crisp type, on paper) ---------- */
const text = (id, s) => { const el = $(id); if (el.textContent !== s) el.textContent = s; };
const clock = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let hudKey = '', buildKey = '', offerKey = '', taken = -1;
function hud() {
  const h = game.hero, need = h.xpNext || (sim.xpNeed ? sim.xpNeed(h.level) : 1);
  $('hp-fill').style.transform = `scaleX(${clamp(h.hp / h.maxHp, 0, 1).toFixed(3)})`;
  text('hp-num', `${Math.max(0, Math.ceil(h.hp))} / ${Math.round(h.maxHp)}`);
  $('xp-fill').style.transform = `scaleX(${clamp(h.xp / need, 0, 1).toFixed(3)})`;
  text('xp-num', `${Math.floor(h.xp)} / ${need}`);
  text('level', t.lv(h.level));
  text('timer', clock(game.t));
  text('kills-num', (game.stats.kills || 0).toLocaleString('en-US'));
  const left = h.dashCd || 0, dash = $('dash');
  dash.classList.toggle('ready', left <= 0);
  $('dash-fill').style.transform = `scaleX(${(1 - clamp(left / DASH_CD, 0, 1)).toFixed(3)})`;
  if (hurtFlash > 0 || $('hurt').style.opacity !== '0') $('hurt').style.opacity = String(Math.max(0, hurtFlash).toFixed(2));

  const key = `${lang}|${mode}|${endAt === Infinity}|${audio.on}`;
  if (key !== hudKey) {
    hudKey = key;
    const playing = (mode === 'play' || mode === 'paused') && endAt !== Infinity;      // the HUD leaves with the end sheet
    for (const id of ['hp', 'spirit', 'timer', 'dash', 'kills']) $(id).hidden = !playing;
    $('build').hidden = !playing; $('xp').style.visibility = playing ? 'visible' : 'hidden';
    text('hp-label', t.hp); text('xp-label', t.spirit); text('kills-label', t.kills); text('dash-label', t.dash); text('sound', t.sound(audio.on));
    $('dash-key').textContent = lang === 'zh' ? '空格' : 'Space';
  }
  const b = game.build, gens = b.generals || [], bk = `${lang}|${b.treasures.map(e => e.id + e.level + (e.evolved ? 'e' : '')).join()}|${b.arts.map(e => e.id + e.level).join()}|${b.troops.map(e => e.id + e.level + 'r' + rankOfEntry(e)).join()}|${gens.map(e => e.id + e.level + (e.trueForm ? 'f' : '') + 'a' + Math.ceil(awayOf(e))).join()}|${b.formation ? b.formation.id + b.formation.level : ''}|${(b.resonance || []).join()}`;
  if (bk !== buildKey) { buildKey = bk; renderBuild(); }

  // the offer follows the rules' phase, so a pick made by key, click or bot all close it the same way
  const o = offering() && !bench ? game.offer : null;
  const ok = o ? `${lang}|${o.map(x => x.kind + x.id + x.level).join()}|${game.rerolls}|${game.banishes}|${banishing}|${fromChest()}` : '';
  if (ok !== offerKey) { const fresh = !offerKey; offerKey = ok; renderOffer(o, fresh); }
  if (ended() && mode === 'play' && endAt !== Infinity && performance.now() >= endAt) { endAt = Infinity; if (bench) begin(); else showEnd(); }
}

/** One sign: a round mark in its element's pigment with one character, the level beside it, the words on hover and focus. */
/** Seconds until a withdrawn general is back; 0 while he fights. */
const AWAY = 20;
function awayOf(e) {
  const u = (game.allies || []).find(a => a.kind === 'general' && a.general === e.id);
  if (u && u.state === 'away') return Math.max(1, AWAY - (u.stateT || 0));
  return Math.max(0, e.away || 0);
}
/** One sign: a mark in its element's pigment with one character, the level beside it, the words on hover and focus.
    A treasure, an art, a troop or a formation is a round mark; a general is a square seal. A troop also shows its rank. */
function signHTML(kind, e) {
  const last = lastForm(kind, e), w = wordsOf(kind, e.id, formLevel(kind, e)), away = kind === 'general' ? awayOf(e) : 0;
  const rank = kind === 'troop' && ranked() ? rankOfEntry(e) : 0;
  const state = away > 0 ? t.returnsIn(Math.ceil(away)) : kind === 'general' && last ? t.trueForm : kind === 'treasure' && last ? t.evolution : rank ? `${rankName(rank)} · ${t.lv(e.level)}` : t.lv(e.level);
  const tip = `${w.name} · ${state} · ${w.text}`;
  const badge = away > 0 ? Math.ceil(away) : last && kind !== 'troop' ? '✦' : e.level;
  return `<button class="sign${kind === 'general' ? ' gseal' : ''}${last ? ' evo' : ''}${away > 0 ? ' away' : ''}${e.id === freshSign ? ' fresh' : ''}" style="${pig(w.element)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${signOf(kind, e.id)}<b>${badge}</b>${rank ? `<em class="r${rank}">${rankName(rank, true)}</em>` : ''}</button>`;
}
function renderBuild() {
  const b = game.build, slots = sim.SLOTS || {treasure: 6, art: 6, troop: 4, formation: 1};
  const row = (kind, list, n = slots[kind]) => `<div class="brow${kind === 'general' ? ' gens' : kind === 'troop' && ranked() ? ' troops' : ''}"><span>${t.rows[kind]}</span>${list.map(e => signHTML(kind, e)).join('')}${list.length < n ? `<i class="sign empty${kind === 'general' ? ' gseal' : ''}" aria-hidden="true"></i>` : ''}</div>`;
  const res = (b.resonance || []).length ? `<div class="brow"><span>${t.resonance}</span>${b.resonance.map(el => { const txt = sim.RESONANCE && sim.RESONANCE[el] && sim.RESONANCE[el].text ? sim.RESONANCE[el].text[lang] : t.elements[el]; return `<button class="sign" style="${pig(el)}" data-tip="${esc(txt)}" aria-label="${esc(txt)}">${ELEMENT_SIGN[el] || '·'}</button>`; }).join('')}</div>` : '';
  // the 将 row is shown once the rules know generals at all
  const gens = sim.CONTENT.generals || b.generals ? row('general', b.generals || [], slots.general || 2) : '';
  $('build').innerHTML = row('treasure', b.treasures) + row('art', b.arts) + row('troop', b.troops) + gens + row('formation', b.formation ? [b.formation] : []) + res;
  freshSign = null;
}

/* ---------- the offer ---------- */
/** The one small line under a slip's sentence that says what the pick means for the build beyond itself. */
/** What a slip unlocks, when the rules say it completes a payoff: `unlocks: {kind: 'evolve' | 'bless' | 'trueForm', id, into}`. */
function unlockLine(o) {
  const u = o.unlocks; if (!u) return '';
  const nm = x => x && x.name ? x.name[lang] || x.name.en : '', self = u.id === o.id;
  let words = '', el = null;
  if (u.kind === 'evolve') { const r = rowOf('treasure', u.id); if (!r || !r.evolved) return ''; el = r.element; words = self ? t.unlockSelf(nm(r.evolved)) : t.unlockOther(nm(r), nm(r.evolved)); }
  else if (u.kind === 'bless' || u.kind === 'blessed') { const r = rowOf('troop', u.id); if (!r || !r.blessed) return ''; el = r.element; words = self ? t.unlockHost(nm(r.blessed)) : t.unlockHostOther(nm(r), nm(r.blessed)); }
  else if (u.kind === 'trueForm') { const r = rowOf('general', u.id); if (!r || !r.trueForm) return ''; el = r.element; words = t.unlockForm(nm(r.trueForm)); }
  return words ? `<span class="cycle ready" style="--pig2:${PIGMENT[el] || PIGMENT.none}">${esc(words)}</span>` : '';
}
function cycleLine(o) {
  const said = unlockLine(o); if (said) return said;
  const b = game.build, row = rowOf(o.kind, o.id);
  if (!row) return '';
  if (o.kind === 'treasure' && row.evolved && sim.fedBy && o.level <= maxOf('treasure')) {
    const feeder = sim.fedBy(row.element), art = b.arts.find(a => (rowOf('art', a.id) || {}).element === feeder);
    if (art && o.level >= maxOf('treasure')) return `<span class="cycle ready" style="--pig2:${PIGMENT[feeder]}">${t.readyToEvolve}</span>`;
    if (art) return `<span class="cycle" style="--pig2:${PIGMENT[feeder]}">${t.evolvesOwned(wordsOf('art', art.id, art.level).name)}</span>`;
    return `<span class="cycle" style="--pig2:${PIGMENT[feeder]}">${t.evolvesWith(t.elements[feeder], ELEMENT_SIGN[feeder])}</span>`;
  }
  if (o.kind === 'art' && sim.fedBy) {
    const fed = b.treasures.filter(e => !e.evolved && sim.fedBy((rowOf('treasure', e.id) || {}).element) === row.element);
    if (fed.length && o.isNew) return `<span class="cycle ready" style="--pig2:${PIGMENT[row.element]}">${t.letsEvolve(fed.map(e => wordsOf('treasure', e.id, e.level).name).join(lang === 'zh' ? '、' : ', '))}</span>`;
  }
  if (o.kind === 'troop' && ranked()) {
    const patron = (sim.CONTENT.generals || []).find(g => (g.patronOf || []).includes(o.id)) || (row.patron && rowOf('general', row.patron)), has = patron && (b.generals || []).some(g => g.id === patron.id), pname = patron && (patron.name[lang] || patron.name.en);
    if (o.level < 3 && row.skill && row.skill.name) return `<span class="cycle">${t.skillAt(row.skill.name[lang] || row.skill.name.en)}</span>`;
    if (patron && o.level >= 5 && o.level <= maxOf('troop')) return `<span class="cycle${has ? ' ready' : ''}" style="--pig2:${PIGMENT[patron.element] || PIGMENT.none}">${has ? t.patronHave(pname) : t.patronNeed(pname)}</span>`;
  }
  if (o.kind === 'general') {
    if (o.level > maxOf('general')) return '';
    const mine = (sim.CONTENT.troops || []).filter(r => ((row.patronOf || []).includes(r.id) || r.patron === o.id) && b.troops.some(e => e.id === r.id));
    if (mine.length && o.isNew) return `<span class="cycle ready" style="--pig2:${PIGMENT[row.element] || PIGMENT.none}">${t.patronOf(mine.map(r => r.name[lang] || r.name.en).join(lang === 'zh' ? '、' : ', '))}</span>`;
    return `<span class="cycle">${t.trueFormNeed}</span>`;
  }
  if (o.kind === 'formation' && o.isNew && b.formation && b.formation.id !== o.id) return `<span class="cycle">${t.replaces(wordsOf('formation', b.formation.id, b.formation.level).name)}</span>`;
  return '';
}
function slipHTML(o, i) {
  const max = o.kind === 'mend' ? 0 : maxOf(o.kind), row = rowOf(o.kind, o.id), w = wordsOf(o.kind, o.id, o.level);
  const troop = o.kind === 'troop' && ranked(), general = o.kind === 'general';
  // one past the top level is the last form: a treasure evolved, a general's true form, a troop's fifth rank
  const evo = max > 0 && o.level > max, rank = troop ? rankAt(o.level, evo) : 0, before = troop && !o.isNew ? rankAt(o.level - 1, false) : rank;
  const tag = o.kind === 'mend' ? '' : evo ? `<span class="tag evo">${general ? t.trueForm : troop ? rankName(5) : t.evolution}</span>` : o.isNew ? `<span class="tag new">${t.isNew}</span>` : troop && rank !== before ? `<span class="tag rank">${rankName(before, lang !== 'zh')} → ${rankName(rank, lang !== 'zh')}</span>` : `<span class="tag">${t.levelTo(o.level - 1, o.level)}</span>`;
  // pips: one a level; a troop's pips stand taller where a rank begins; the ring at the end is the last form
  const hasLast = row && (o.kind === 'treasure' ? row.evolved : general ? row.trueForm !== false : troop);
  const pips = max ? `<span class="pips${max > 6 ? ' many' : ''}" aria-hidden="true">${Array.from({length: max}, (_, n) => `<i class="${n + 1 < o.level ? 'on' : n + 1 === o.level ? 'next' : ''}${troop && [1, 3, 5, 7].includes(n + 1) ? ' mark' : ''}"></i>`).join('')}${hasLast ? `<i class="star${evo ? ' next' : ''}"></i>` : ''}</span>` : '<span></span>';
  const under = evo && o.kind === 'treasure' && row ? `<small>${t.evolvedFrom(row.name[lang] || row.name.en)}</small>` : troop ? `<small>${rankName(rank)}${evo ? '' : ` · ${t.lv(o.level)}`}</small>` : general && evo && row.trueForm && row.trueForm.name ? `<small>${row.trueForm.name[lang] || row.trueForm.name.en}</small>` : general && lang !== 'zh' && row ? `<small>${row.name.zh}</small>` : '';
  return `<button class="slip${evo ? ' evo' : ''}${general ? ' general' : ''}" data-pick="${i}" style="${pig(w.element)};--i:${i}">
    <span class="top"><kbd>${i + 1}</kbd><span class="kind">${t.kinds[o.kind] || o.kind}${w.element ? ` · ${t.elements[w.element]}` : ''}</span>${tag}</span>
    <span class="head"><i class="sign${general ? ' gseal' : ''}" aria-hidden="true">${signOf(o.kind === 'mend' ? null : o.kind, o.id)}</i><span><strong>${esc(w.name)}</strong>${under}</span></span>
    <span class="what">${esc(w.text)}</span>${pips}${cycleLine(o) || '<span></span>'}</button>`;
}
function renderOffer(o, fresh) {
  const box = $('offer'), slips = $('slips');
  $('veil').classList.toggle('on', !!o);
  if (!o) {
    easeAt = 1e-6;      // the fight comes back slowly: half a second before foes move at full speed
    // a pick is fast: the taken slip flashes its pigment and all three are gone in a fifth of a second
    if (taken >= 0 && slips.children[taken] && !settings.calm) { slips.classList.add('taken'); slips.children[taken].classList.add('chosen'); const was = taken; taken = -1; setTimeout(() => { if (!offerKey) { box.hidden = true; slips.className = ''; slips.innerHTML = ''; } }, 200); void was; }
    else { box.hidden = true; slips.className = ''; slips.innerHTML = ''; }
    banishing = false; taken = -1;
    return;
  }
  if (fresh) { offerAt = performance.now(); audio.slip(); }
  const opening = game.hero.level === 1 && !game.build.treasures.length && !game.stats.picks;
  const chest = fromChest(), cw = sim.CHEST && sim.CHEST.generals;
  $('offer-title').innerHTML = chest ? `${cw ? cw[lang] || cw.en : t.chestTitle}<small>${t.chestHow}</small>` : `${banishing ? t.banishWhich : opening ? t.offerFirst : t.offerLevel(game.hero.level)}${banishing ? '' : `<small>${t.offerHow}</small>`}`;
  box.classList.toggle('chest', chest); $('offer-tools').hidden = chest;
  box.classList.toggle('banishing', banishing);
  slips.className = ''; slips.innerHTML = o.map(slipHTML).join('');
  if (!fresh) for (const s of slips.children) s.style.animation = 'none';      // a reroll or a change of language swaps the words; nothing drops in again
  for (const [id, n, label] of [['reroll', game.rerolls, t.reroll], ['banish', game.banishes, t.banish]]) { const el = $(id); el.querySelector('span').textContent = label; el.querySelector('b').textContent = t.left(n); el.disabled = n <= 0; }
  box.hidden = false;
}

/* ---------- sheets ---------- */
function focusGo() { const b = $('sheet-body').querySelector('.go'); if (b && !bench) b.focus({preventScroll: true}); }
function sheet(html, cls = '') { $('sheet').className = `sheet show ${cls}`; $('sheet-body').innerHTML = html; }
function hideSheet(atOnce) { $('sheet').className = atOnce ? 'sheet cut' : 'sheet'; }
function showTitle() {
  sheet(`<span class="seal" aria-hidden="true">周</span><p class="eyebrow">${t.eyebrow}</p><h1>${t.name}<small>${t.other}</small></h1><p class="tag-line">${t.tag}</p>
    <ul class="how">${t.how.map(x => `<li>${x}</li>`).join('')}</ul><p class="tip">${t.tip}</p>
    ${touchOnly ? `<p class="notice">${t.needKeys}</p>` : ''}<div class="actions"><button class="go" data-do="begin">${t.start}</button><span class="note" id="load-line" role="status"></span></div>`, 'title');
  loadLine(); focusGo();
}
const load = {bytes: 0, done: 0, total: 0, queued: false};
try { new PerformanceObserver(list => { for (const e of list.getEntries()) load.bytes += e.transferSize || e.encodedBodySize || 0; loadLine(); }).observe({type: 'resource', buffered: true}); } catch { /* no observer: the line shows no number */ }
function loadLine() {
  const el = $('load-line'); if (!el) return;
  if (mode !== 'loading') { el.textContent = ''; return; }
  const pct = load.total > 0 ? Math.min(99, Math.round(100 * load.done / load.total)) : null;
  el.textContent = load.queued ? t.queued : load.bytes || pct != null ? t.loadingAt((load.bytes / 1048576).toFixed(1), pct) : t.loading;
}
/** What did the work: damage by source, ranked, each with its sign, so the player can read which parts of the build mattered. */
function rankedHTML() {
  const sums = new Map(); for (const [id, v] of Object.entries(game.stats.damage || {})) { if (!(v > 0)) continue; const src = sourceOf(id), key = src.kind + ':' + src.id + (src.evolved ? '*' : ''); const had = sums.get(key); if (had) had.v += v; else sums.set(key, {v, s: src}); }
  const list = [...sums.values()].sort((a, b) => b.v - a.v), total = list.reduce((n, x) => n + x.v, 0);
  if (!list.length) return `<p class="note">${t.nothing}</p>`;
  // grouped by kind, the heaviest group first; each source under its group, its bar against the heaviest single source
  const groupOf = s => s.id === 'trample' ? 'trample' : ['treasure', 'troop', 'general'].includes(s.kind) ? s.kind : 'other';
  const groups = ['treasure', 'troop', 'general', 'trample', 'other'].map(g => ({g, rows: list.filter(x => groupOf(x.s) === g)})).filter(x => x.rows.length).map(x => ({...x, sum: x.rows.reduce((n, r) => n + r.v, 0)})).sort((a, b) => b.sum - a.sum);
  const item = ({v, s}) => `<li><i class="sign${s.kind === 'general' ? ' gseal' : ''}${s.evolved ? ' evo' : ''}" style="${pig(s.element)}" aria-hidden="true">${signOf(s.kind, s.id)}</i><span class="name">${esc(s.name)}</span><span class="bar" style="${pig(s.element)}"><i style="width:${(100 * v / list[0].v).toFixed(1)}%"></i></span><span class="amount">${Math.round(v).toLocaleString('en-US')} · ${t.share(Math.round(100 * v / total))}</span></li>`;
  return `<div class="groups">${groups.map(({g, rows, sum}) => `<section><h4><span>${t.groups[g]}</span><b>${Math.round(sum).toLocaleString('en-US')} · ${t.share(Math.round(100 * sum / total))}</b></h4>${g === 'trample' ? '' : `<ol class="ranked">${rows.slice(0, 8).map(item).join('')}</ol>`}</section>`).join('')}</div>`;
}
function showEnd() {
  const won = game.phase === 'won', s = game.stats;
  sheet(`<p class="eyebrow">${t.name}</p><h2>${won ? t.won : t.lost}</h2>
    <div class="figures"><div><b>${clock(s.time || game.t)}</b><span>${t.time}</span></div><div><b>${game.hero.level}</b><span>${t.level}</span></div><div><b>${(s.kills || 0).toLocaleString('en-US')}</b><span>${t.kills}</span></div></div>
    <h3>${t.work}</h3>${rankedHTML()}
    <div class="actions"><button class="go" data-do="begin">${t.again}</button><button class="plain" data-do="same">${t.sameSeed(seed)}</button></div>`, 'end');
  focusGo();
}
function showError(err) {
  const part = err.part, who = part ? t.missing[part] : '', why = err.why === 'missing' ? t.missingTail : t.broken;
  const q = new URLSearchParams(location.search); q.set('stub', '1');
  const dev = import.meta.env.DEV || params.has('stub') || params.has('perf');
  sheet(`<p class="eyebrow">${t.name}</p><h2>${t.noStart}</h2><p class="tag-line">${t.noStartTail}</p>
    ${dev ? `<p class="note">${part ? `${who} ${why}. ` : ''}${esc(err.message)}</p><a class="go" style="display:inline-grid;place-items:center;text-decoration:none" href="?${q}">${t.stub}</a>` : ''}`, 'error');
}
function ownedHTML() {
  const b = game.build, all = [...b.treasures.map(e => ['treasure', e]), ...b.arts.map(e => ['art', e]), ...b.troops.map(e => ['troop', e]), ...(b.generals || []).map(e => ['general', e]), ...(b.formation ? [['formation', b.formation]] : [])];
  if (!all.length) return '';
  return `<h3>${t.yourBuild}</h3><ul class="owned">${all.map(([kind, e]) => { const last = lastForm(kind, e), w = wordsOf(kind, e.id, formLevel(kind, e)); return `<li><i class="sign${kind === 'general' ? ' gseal' : ''}${last ? ' evo' : ''}" style="${pig(w.element)}" aria-hidden="true">${signOf(kind, e.id)}</i><span><b>${esc(w.name)}</b><em>${kind === 'troop' && ranked() ? `${rankName(rankOfEntry(e))} · ${t.lv(e.level)}` : last ? (kind === 'general' ? t.trueForm : t.evolution) : t.lv(e.level)}</em><br>${esc(w.text)}</span></li>`; }).join('')}</ul>`;
}
function pause(on) {
  mode = on ? 'paused' : 'play';
  document.documentElement.classList.toggle('paused', on);      // battle banners do not lie over the sheet
  if (on) {
    const v = Math.round(settings.volume * 100);
    sheet(`<h2>${t.paused}</h2><p class="note">${t.hint}</p>${ownedHTML()}
      <fieldset class="settings"><legend>${t.settings}</legend>
        <label class="row"><span>${t.volume}</span><input type="range" id="set-volume" min="0" max="100" step="5" value="${v}"><output id="set-volume-out">${v}</output></label>
        <label class="row"><input type="checkbox" id="set-shake"${settings.shake ? ' checked' : ''}${settings.calm ? ' disabled' : ''}><span>${t.shake}</span></label>
        <label class="row"><input type="checkbox" id="set-calm"${settings.calm ? ' checked' : ''}><span>${t.calm} <small>${t.calmNote}</small></span></label>
      </fieldset>
      <div class="actions"><button class="go" data-do="resume">${t.resume}</button><button class="plain" data-do="leave">${t.leave}</button></div>`, 'pause');
    focusGo();
  } else { hideSheet(); focusGame(); }
  last = performance.now(); acc = 0; hudKey = ''; offerKey = '';
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'set-volume') { settings.volume = clamp(el.value / 100, 0, 1); $('set-volume-out').textContent = el.value; }
  else if (el.id === 'set-shake') settings.shake = el.checked;
  else if (el.id === 'set-calm') { settings.calm = el.checked; $('set-shake').disabled = el.checked; }
  else return;
  applySettings(true);
});
document.addEventListener('change', e => { if (e.target.id === 'set-volume') { audio.ensure(); audio.pickup(1); } });

async function begin(sameSeed) {
  if (mode === 'loading') { load.queued = true; loadLine(); return; }
  if (mode === 'error' || starting) return;
  audio.ensure();
  if (used) {
    seed = sameSeed === true ? seed : +params.get('seed') || newSeed();
    game = sim.createGame(seed);
    if (art.reset) art.reset();
    else { starting = true; try { art = await artMod.loadArt({}); art.setView({width: W, height: H, dpr}); } finally { starting = false; } }
  }
  used = true; endAt = 0; fallAt = -1; hurtFlash = 0; shake.t = 1; bot.n = 0; toneAt = -1; banishing = false; taken = -1; freshSign = null; document.documentElement.classList.remove('paused'); joined.clear(); banners.length = 0; bannerUntil = 0; easeAt = 0;
  edge.dash = edge.reroll = false; edge.pick = edge.banish = null;
  look.x = look.y = look.vx = look.vy = 0;
  if (bench) benchSetup();
  mode = 'play'; hideSheet(true); hudKey = buildKey = offerKey = ''; focusGame();      // at once: the first offer opens on this frame and nothing may lie over it
  last = performance.now(); acc = 0;
}
/** ?bench=1: a fixed build in the middle of 320 foes, so that the rules, the art and the sound are measured at the load the spec names. */
function benchSetup() {
  game = sim.createGame(seed, {start: (sim.CONTENT.treasures[0] || {}).id});
  if (sim.give) {
    sim.CONTENT.treasures.slice(0, 6).forEach((r, i) => sim.give(game, 'treasure', r.id, 3 + (i % 3)));
    sim.CONTENT.arts.slice(0, 4).forEach(r => sim.give(game, 'art', r.id, 2));
    sim.CONTENT.troops.slice(0, 3).forEach(r => sim.give(game, 'troop', r.id, 2));
    if (sim.CONTENT.formations[0]) sim.give(game, 'formation', sim.CONTENT.formations[0].id, 1);
  }
  benchFoes(260);
}
/** Keeps the bench at 320 living foes: the fixed build fells them fast, and the measure is of the load, not of the clearing. */
const BENCH_FOES = 320;
function benchFoes(near) {
  if (!sim.addFoe) return;
  const kinds = ['spear', 'spear', 'axe', 'shield', 'archer'].filter(k => !sim.BY || !sim.BY.foe || sim.BY.foe[k]);
  const alive = sim.counts ? sim.counts(game).foes : game.foes.length;
  for (let i = alive; i < BENCH_FOES; i++) { const a = (i + bot.n) * 2.39996, r = near + (i % 40) * 14; sim.addFoe(game, kinds[i % kinds.length] || 'spear', game.hero.x + Math.cos(a) * r, game.hero.y + Math.sin(a) * r); }
}
function toggleSound() { audio.ensure(); audio.toggle(); hudKey = ''; }
function setLang(next) {
  const changed = next !== lang;
  lang = next; t = COPY[lang];
  if (changed) {
    store.set(SITE_PREFS, JSON.stringify({...sitePrefs(), lang}));
    const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(history.state, '', url);
  }
  document.title = t.docTitle;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  $('back').textContent = t.back; $('back').href = `/?lang=${lang}`; $('lang').textContent = lang === 'zh' ? 'EN' : '中文';
  hudKey = buildKey = '';
  if (mode === 'title' || mode === 'loading') showTitle(); else if (mode === 'paused') pause(true); else if (mode === 'play' && ended() && endAt === Infinity) showEnd();
}
document.addEventListener('click', e => {
  if (e.target.closest('#back') && running()) { e.preventDefault(); if (mode === 'play') pause(true); const b = $('sheet-body').querySelector('[data-do=leave]'); if (b) b.focus({preventScroll: true}); return; }
  const b = e.target.closest('button'); if (!b) return;
  audio.ensure();
  if (b.dataset.do === 'begin') begin();
  else if (b.dataset.do === 'same') begin(true);
  else if (b.dataset.do === 'resume') pause(false);
  else if (b.dataset.do === 'leave') { location.href = $('back').href; return; }
  else if (b.dataset.do === 'reroll') askReroll();
  else if (b.dataset.do === 'banish') askBanish();
  else if (b.dataset.pick) choose(+b.dataset.pick);
  else if (b.id === 'lang') setLang(lang === 'zh' ? 'en' : 'zh');
  else if (b.id === 'sound') toggleSound();
  if (mode === 'play' && endAt !== Infinity) focusGame(); else if (!b.dataset.do) b.blur();
});

/* ---------- loop ---------- */
const EASE_IN = .5; let easeAt = 0;
let last = 0, acc = 0, slow = 0, fast = 0, raisedAt = -1e9, raiseAfter = 0, ema = STEP, held = {mx: 0, my: 0};
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000 || 0, dt = clamp(rawDt, 0, .1); last = now;
  const t0 = performance.now();
  let scale = 1;
  if (fallAt >= 0 && mode === 'play') {      // when the rider falls the picture slows, then eases back
    const k = clamp((fallAt - FALL.hold) / FALL.ease, 0, 1);
    scale = FALL.scale + (1 - FALL.scale) * k * k * (3 - 2 * k);
    fallAt += dt; if (k >= 1) fallAt = -1;
  }
  let tick = dt; for (const n of [1, 2]) if (Math.abs(dt - STEP / n) < .0007) tick = STEP / n;      // a 60 or 120 Hz frame is read as exact: one step a frame
  if (easeAt && mode === 'play') { const k = easeAt / EASE_IN; if (k >= 1) easeAt = 0; else { scale *= .25 + .75 * k * k; easeAt += dt; } }      // counted in the frames' own time: a late frame cannot skip it
  const simDt = tick * scale, stopped = mode === 'play' && game.phase === 'offer';
  if (mode === 'play') {
    acc += simDt;
    if (stopped && (edge.pick != null || edge.reroll || edge.banish != null)) acc = Math.max(acc, STEP);      // a pick is taken on this frame
    let first = true;
    while (acc >= STEP) {
      const input = bench ? botInput() : first ? readInput() : carry(held);
      held = input; first = false;
      const couldDash = (game.hero.dashCd || 0) <= 0;
      sim.step(game, input, STEP);
      acc -= STEP;
      if (game.events.length) { for (const e of game.events) { art.onEvent(e, game); handle(e); if (perf.on && frameEvents.length < 12) frameEvents.push(e.type); } game.events.length = 0; }
      if (input.dash && !couldDash && game.phase === 'fight' && !bench) { const el = $('dash'); el.classList.remove('short'); void el.offsetWidth; el.classList.add('short'); audio.refuse(); }
      if (ended() && !endAt) endAt = performance.now() + 1000;
    }
    const h = game.hero;
    if (game.phase === 'fight') audio.hooves(Math.hypot(h.vx || 0, h.vy || 0), BASE_SPEED * 1.3, simDt);
    if (hurtFlash > 0) hurtFlash -= dt * 3;
  }
  const t1 = performance.now();
  const still = mode === 'paused' || stopped;
  draw(mode === 'play' ? acc / STEP : 1, still ? 0 : simDt, mode === 'paused' ? 0 : dt);
  const tD = performance.now();
  hud(); bannerTick(now);
  const t2 = performance.now();
  // Old machines: if the smoothed frame time stays above 21 ms for two seconds, draw fewer pixels; when frames have been
  // fast for five seconds, try more again. A frame over a quarter second is a hidden tab or a stall, not a slow machine:
  // it is not counted, and the measure starts afresh after it. A step up that had to be taken back is not tried again for a minute.
  if (rawDt > .25 || document.hidden) { ema = STEP; slow = Math.min(slow, 0); fast = 0; }
  else if (mode === 'play' && dt > 0 && game.phase === 'fight') {
    ema += (dt - ema) * .05;
    slow = ema > .021 ? slow + dt : Math.min(slow, 0) + (slow < 0 ? dt : 0);
    fast = ema < .0175 ? fast + dt : 0;
    if (slow > 2 && resScale > .5) { if (now - raisedAt < 10000) raiseAfter = now + 60000; resScale -= .25; slow = -3; fast = 0; ema = STEP; resize(); }
    else if (fast > 5 && resScale < 1 && now >= raiseAfter) { resScale += .25; raisedAt = now; fast = 0; slow = -3; ema = STEP; resize(); }
  }
  if (perf.on) {
    if (dt > .03 && perf.long.length < 200) perf.long.push({at: +(game.t).toFixed(2), frame: Math.round(dt * 1000), sim: +(t1 - t0).toFixed(1), draw: +(tD - t1).toFixed(1), hud: +(t2 - tD).toFixed(1), phase: game.phase, ev: frameEvents.join(',')});
    frameEvents.length = 0;
    perf.frame[perf.i] = dt * 1000; perf.sim[perf.i] = t1 - t0; perf.draw[perf.i] = t2 - t1; perf.i = (perf.i + 1) % 600; perf.n = Math.min(600, perf.n + 1);
    if (perf.i % 30 === 0) { const s = perfStats(), f = (o, d = 2) => `${o.avg.toFixed(d)} · p95 ${o.p95.toFixed(d)}`; $('perf').textContent = `frame ${f(s.frame, 1)} ms\nsim   ${f(s.sim)}\ndraw  ${f(s.draw)}\n${s.foes} foes · ${s.allies} allies · ${s.shots} shots · ${canvas.width}×${canvas.height} px\nsound ${s.mix.castVoices}/${s.mix.voices} voices · density ${s.mix.density}`; }
  }
}
function perfStats() {
  const out = {};
  for (const k of ['frame', 'sim', 'draw']) { const a = Array.from(perf[k].subarray(0, perf.n)).sort((x, y) => x - y), n = a.length || 1; out[k] = {avg: a.reduce((s, v) => s + v, 0) / n, p95: a[Math.floor(n * .95)] || 0, max: a[n - 1] || 0}; }
  const c = game && sim.counts ? sim.counts(game) : {};
  return {...out, foes: c.foes ?? (game ? game.foes.length : 0), allies: c.allies ?? 0, shots: c.shots ?? 0, dpr, resScale, zoom: cam.zoom, backing: [canvas.width, canvas.height], mix: audio.mix, samples: perf.n};
}

/* ---------- start ---------- */
const hook = window.__muye = {get game() { return game; }, get mode() { return mode; }, get art() { return art; }, get sim() { return sim; }, get seed() { return seed; }, perfStats, perf, cam, begin, kick: askKick, settings, audio, ready: false, modules: {sim: useStub('sim') ? 'stub' : 'real', art: useStub('art') ? 'stub' : 'real'}};
(async function start() {
  const t0 = performance.now();
  setLang(lang);      // the title sheet, at once
  try {
    if (!ctx) throw new Error('this browser gave no 2D canvas');
    [sim, artMod] = await Promise.all([loadModule('sim', ['createGame', 'step', 'CONTENT']), loadModule('art', ['loadArt'])]);
    art = await artMod.loadArt({onProgress: (done, total) => { load.done = done; load.total = total; loadLine(); }});
    seed = +params.get('seed') || newSeed();
    game = sim.createGame(seed);
  } catch (err) {
    mode = 'error'; hook.error = String(err.message || err); showError(err);
    console.warn('[muye]', err);
    return;
  }
  resize(); applySettings(false);
  if (art.paperAt) setPaper(art.paperAt(0));
  mode = 'title'; loadLine(); hudKey = '';
  if (perf.on) $('perf').hidden = false;
  hook.ready = Math.round(performance.now() - t0) || 1;
  last = performance.now();
  requestAnimationFrame(frame);
  if (bench || load.queued) begin();
})();
