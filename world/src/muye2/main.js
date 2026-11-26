// 牧野 / Muye as a survivors-like: the page (lab/game-studies/SPEC-SURVIVORS.md section 5). It runs the rules in fixed
// steps, hands the picture to the art module, and keeps everything a reader must read as crisp type in the DOM.
// The page draws nothing on the canvas: ink and paint belong to art/, rules to sim.js. Built from the side-view game's
// page (world/src/fengshen/main.js): the loop, the input edges, the two languages, settings, loading and the overlay.
//   ?lang=zh        Chinese          ?stub=1        stand-ins for both modules (?stub=sim or ?stub=art for one)
//   ?perf=1         timing overlay   ?bench=1       a scripted run with a fixed build among 300 foes, for measuring
//   ?seed=7         a fixed field
//   ?still=1        for review stills: losing focus does not pause, and __muye.hold freezes the rules
//   ?m1=1           the short run that ends at 闻仲 instead of the whole campaign (the default)
//   ?spoilpics=placeholder   a stand-in painting for every spoil, to lay out the spoils before render-spike's paintings exist
import './muye.css';
import {createAudio} from './audio.js';
import {createContext} from './art/render/context.js';
import {campaignNow, campaignTable, runLength, tierOf, nameOf, SPOIL_SIGN} from './ui/campaign.js';
import {createBars} from './ui/bars.js';
import {createTimeline, timelineHTML, shortClock} from './ui/timeline.js';
import {createMetaStore} from './ui/meta-store.js';
import {createCamp} from './ui/camp.js';
import {meritStandin, META_STANDIN} from './ui/camp-data.js';
import {CODEX} from './ui/codex-data.js';
import {portrait, warm} from './ui/portraits.js';
import {spoilPic, warmSpoil, spoilMarkHTML} from './ui/spoil-pictures.js';
import * as N from './ui/names.js';

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
    kinds: {treasure: 'Treasure', art: 'Art', troop: 'Troop', formation: 'Formation', general: 'General', mend: 'Rest', weapon: 'Weapon', merge: 'Joined pair'}, rows: {treasure: 'treas.', art: 'arts', troop: 'troops', formation: 'form.', general: 'gen.', weapon: 'weapon', spoil: 'spoils'},
    groups: {spoil: 'Spoils', weapon: 'Weapon', treasure: 'Treasures', troop: 'Troops', general: 'Generals', trample: 'Jiliang', other: 'Other'}, trueForm: 'true form', trueFormOf: name => `True form: ${name}`, mortalForm: (name, feat) => feat ? `${name} in true form · ${feat}` : `${name} in true form`, formFrom: (name, title) => `${name} → ${title}`, joins: name => `${name} joins you`, returnsIn: n => `withdrawn, back in ${n} s`, blessedHost: name => `Blessed host: ${name}`,
    skillAt: name => `squad skill ${name} unlocks at level 3`, patronNeed: name => `fifth rank: level 8, a chest, and ${name} with you`, patronHave: name => `fifth rank: level 8 and a chest (${name} is with you)`, patronOf: names => `patron of ${names}: they can reach the fifth rank`, trueFormNeed: 'true form at level 5 with a chest', unlockSelf: into => `leads to ${into}`, unlockOther: (name, into) => `lets ${name} become ${into}`, unlockForm: into => `leads to his true form: ${into}`, unlockHost: into => `leads to the blessed host: ${into}`, unlockHostOther: (name, into) => `lets ${name} become the blessed host: ${into}`,
    elements: {fire: 'fire', water: 'water', wood: 'wood', metal: 'metal', earth: 'earth'},
    offerFirst: 'Choose your first treasure', chestTitle: 'Chest · call a general to your side', chestHow: 'take one · 1 2 3 · no reroll, no banish', offerLevel: n => `Level ${n}`, offerHow: 'take one · 1 2 3', isNew: 'new', levelTo: (a, b) => `Lv ${a} → ${b}`, evolution: 'evolution', evolvedFrom: name => `from ${name}`,
    reroll: 'Reroll', banish: 'Banish', banishWhich: 'Banish which? 1 2 3 · Esc to cancel', left: n => `${n} left`,
    evolvesWith: (el, sign) => `evolves at level 6 · needs ${el} ${sign} art`, evolvesOwned: (art) => `evolves at level 6: you have ${art}`, readyToEvolve: 'ready to evolve: open a chest', letsEvolve: names => `lets ${names} evolve at level 6`, replaces: name => `replaces ${name}`,
    peach: ['Peach of immortality', 'Nothing is left to learn. Rest, and mend.'],
    hp: 'health', spirit: 'battle spirit', lv: n => `Lv ${n}`, kills: 'felled', dash: 'spring', resonance: 'reson.',
    evolved: name => `Evolved: ${name}`, merged: name => `Joined: ${name}`, mergedState: 'joined pair', unknownThing: 'unnamed', comes: name => `${name}`, encircled: 'Encircled', chestGave: name => `Chest: ${name}`, chestMend: 'Chest: mended',
    won: 'The field is yours', lost: 'You fell', time: 'time', level: 'level', work: 'What did the work', trample: 'Jiliang’s trample', share: p => `${p}%`, nothing: 'nothing struck a blow',
    sound: on => on ? 'sound on' : 'sound off',
    loading: 'grinding ink…', loadingAt: (mb, pct) => `grinding ink… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: 'the battle starts as soon as the ink is ready',
    hint: 'WASD or arrows ride · Space spring · 1 2 3 take · R reroll · B banish · M sound · Esc pause',
    missing: {sim: 'The rules', art: 'The art module'}, missingTail: 'is not in this checkout yet', broken: 'does not match the contract', stub: 'Run with stand-ins',
    // the campaign
    lang: 'en', next: 'Next', facing: 'Now:', nextSmall: 'a Shang commander', march: 'On the march', finalStretch: 'Before the walls of Zhaoge',
    stretchKicker: n => `Stretch ${['one', 'two', 'three', 'four'][n] || n + 1}`, finalKicker: 'The last battle', marchKicker: 'The Shang break and run', marchTo: name => `On to ${name.replace(/^The /, 'the ')}`,
    arrives: 'arrives', lieutenant: 'comes to his side', phaseOf: (name, n) => `${name}: phase ${n + 1}`, enraged: name => `${name} is enraged`, weary: name => `${name} flags`, wearySub: 'every blow tells more; he presses in', bossDown: name => `${name} has fallen`, smallDown: name => `${name} is driven off`,
    guards: 'The Imperial Guard', guardsSub: 'King Zhou rides out: every Shang soldier on the field is now one of his guard', zhouEnd: 'King Zhou withdraws into the Star-Plucking Tower as it burns',
    // what afflicts the hero (SPEC-CAMPAIGN 1.11): one chip each by the health bar
    spoilKicker: from => `Spoil · taken from ${from}`, spoilHeal: 'Whole again: your health is full', spoilPayoff: 'His chest holds a sure payoff', spoilFrom: from => `taken from ${from}`, spoilsEnd: 'Spoils', noSpoils: 'No boss fell to you, so no spoil.',
    reachNear: words => `Close: ${words}`, reachFar: px => `Shoots ${px} px`, reachTip: 'reach', mounts: r => r < .9 ? 'under a mount\'s length' : r < 1.1 ? 'a mount\'s length' : r < 1.35 ? 'a little over a mount\'s length' : r < 1.65 ? 'a mount and a half' : `${(Math.round(r * 2) / 2)} mounts' length`,
    afflict: {afoot: ['Unhorsed', 'no spring'], held: ['Held', 'cannot move'], bleed: ['Bleeding', 'ride over an antidote'], dizzy: ['Soul lost', 'no spring'], dazzled: ['Dazzled', 'warnings hard to see'], weak: ['Plague ground', 'treasures weaker']},
    weakBy: n => `treasures ${n}% weaker`, bleedBy: n => `${n}/s · find an antidote`,
    lightTaken: el => `Kong Xuan's light takes your ${el} treasures`, lightBack: el => `Your ${el} treasures return`, takenFor: n => `taken by Kong Xuan's light, back in ${n} s`,
    bleedCut: 'The blood-dissolving blade: you bleed', bleedHint: 'ride over an antidote',  bleedWhere: n => `ride over one of the ${n} antidotes: the jade arrows lead to them`, cured: 'The bleeding stops', soulLost: 'The yellow breath: souls lost', glare: 'The golden crown blazes: warnings are hard to see',
    stone: name => `${name} turns to stone`, wind: name => `${name} turns to a clear wind`, burrow: name => `${name} goes under the earth`, dazzle: 'Sun needles: you are dazzled', antidote: 'Antidote',
    held: {seize: 'Seized', swallow: 'Swallowed', hook: 'Hooked and dragged'},
    leaveWarn: 'Leaving ends this run and earns no merit. A run is never saved: it cannot be resumed later.', leaveRun: 'Leave and lose this run',
    // the scroll case
    tabs: {weapon: 'Weapon', merit: 'Merit', codex: 'Codex'}, pickWeapon: 'Choose your weapon', weaponNote: 'King Wu carries one weapon into the battle. It grows with the run and never changes; your treasures are another matter.',
    heroName: 'King Wu, Ji Fa', chosen: 'chosen', choose: 'choose', lockedFor: n => `<i>locked</i><b>${n}</b> merit`, merit: 'Merit 功德', meritShort: 'merit', meritNow: 'merit to spend', meritNote: 'Earned by every run, won or lost: for the time you held, the bosses you brought down and the payoffs you made.',
    stats: 'Ten lasting gifts · five ranks each', full: 'full', unlocks: 'Unlocks · enter the pools for every later run', owned: 'yours', tiers: 'Difficulty', tierLocked: 'opens when you bring down Yuan Hong',
    save: 'Your record', saveNote: 'Kept in this browser only. Clearing the browser’s site data deletes it for good; copy the code to keep it safe or to move it.', saveOff: 'This browser will not keep a record (private mode, or storage is off): what you earn now is lost when you leave. Copy the code to keep it.', saveNewer: 'A newer version of Muye saved here. It is left untouched; this page plays on a blank record and saves nothing.',
    exportCode: 'Copy code', importBtn: 'Load code', importLabel: 'A code to load', copied: 'Code copied.', copyHere: 'Could not copy: the code is in the box, select it and copy.', imported: 'Record loaded from the code.',
    importConfirm: n => `Replace the record in this browser with the code's (${n} merit)? The present record will be gone.`,
    importBad: {shape: 'That is not a Muye code.', check: 'The code is damaged or cut short.', newer: 'That code is from a newer version of Muye.'},
    codex: 'Codex', codexNote: 'What you have met on the field, with the chapter of the novel and one line from it. The rest opens when you meet it.', codexKinds: {treasure: 'Treasures', general: 'Generals', boss: 'Bosses', spoil: 'Spoils', troop: 'Troops', foe: 'Shang'}, unmet: 'not yet met', codexLocked: 'Not met yet. Meet it on the field and its page opens.', chapter: n => `Investiture of the Gods, chapter ${n}`, noQuote: 'The novel has no line for it.',
    standin: 'Weapons, ranks and unlocks here are stand-ins until the rules publish their tables.',
    // the end sheet
    meritEarned: 'Merit earned', meritWhy: {time: (n, sec) => `held ${clock(n * sec)}`, lieutenant: n => `${n} officer${n > 1 ? 's' : ''} brought down`, small: n => `${n} commander${n > 1 ? 's' : ''} brought down`, big: n => `${n} great boss${n > 1 ? 'es' : ''} brought down`, final: () => 'King Zhou brought down', payoff: n => `${n} payoff${n > 1 ? 's' : ''}`, tier: x => `difficulty ×${+x.toFixed(2)}`, rank: x => `merit ranks ×${+x.toFixed(2)}`}, meritTotal: 'total', meritStandin: 'stand-in reckoning until the rules give their own',
    howFar: 'How far you got', newlyOpen: 'Newly opened', newCodex: n => `${n} new page${n > 1 ? 's' : ''} in the codex`, newTier: name => `${name} is open`, nothingNew: 'nothing new this time', toCamp: 'Back to the scroll case', m1End: 'Wen Zhong has fallen: this build of the campaign ends here.',
  },
  zh: {
    back: '← 罗亚鑫', name: '牧野', other: 'Muye', docTitle: '牧野 · 罗亚鑫', eyebrow: '罗亚鑫 / 水墨战场', tag: '你只管骑。你拥有的一切自己会打。',
    how: ['<b>W</b><b>A</b><b>S</b><b>D</b> 或方向键：骑行', '<b>空格</b> 吉量腾跃：穿过敌人，不受伤害', '<b>1</b><b>2</b><b>3</b> 取一件 · <b>R</b> 重选 · <b>B</b> 剔除', '<b>Esc</b> 暂停 · <b>M</b> 声音'],
    tip: '一直骑、不急转，吉量就进入冲阵：更快，并踩踏所过的敌人。骑过倒下的敌人留下的战意：攒够了就升一级，每升一级得一件。',
    needKeys: '这个游戏目前需要键盘，触屏操作还没有做。', noStart: '这个浏览器没能启动游戏', noStartTail: '《牧野》需要支持画布绘制的新版浏览器：较新的 Chrome、Edge、Firefox 或 Safari 都可以。',
    settings: '设置', volume: '音量', shake: '画面震动', calm: '减少动效', calmNote: '无震动，无慢动作', leave: '离开游戏',
    start: '出阵', again: '再来一局', sameSeed: n => `同一战场（种子 ${n}）`, resume: '继续', paused: '已暂停', yourBuild: '你拥有的',
    kinds: {treasure: '法宝', art: '心法', troop: '兵', formation: '阵法', general: '神将', mend: '休整', weapon: '兵器', merge: '合璧'}, rows: {treasure: '法宝', art: '心法', troop: '兵', formation: '阵', general: '将', weapon: '兵器', spoil: '战利'},
    groups: {spoil: '战利品', weapon: '兵器', treasure: '法宝', troop: '兵', general: '将', trample: '吉量', other: '其他'}, trueForm: '显圣', trueFormOf: name => `显圣：${name}`, mortalForm: (name, feat) => feat ? `${name}显圣 · ${feat}` : `${name}显圣`, formFrom: (name, title) => `${name} → ${title}`, joins: name => `${name}来助`, returnsIn: n => `暂退，${n} 秒后归来`, blessedHost: name => `神兵：${name}`,
    skillAt: name => `三级解锁小队技能「${name}」`, patronNeed: name => `升神兵：八级、一个宝箱，并有${name}在阵`, patronHave: name => `升神兵：八级加一个宝箱（${name}已在阵）`, patronOf: names => `${names}的主将：他们可升为神兵`, trueFormNeed: '五级时开宝箱可显圣', unlockSelf: into => `进化为 ${into}`, unlockOther: (name, into) => `让${name}进化为 ${into}`, unlockForm: into => `可显圣：${into}`, unlockHost: into => `可升神兵：${into}`, unlockHostOther: (name, into) => `让${name}升为神兵：${into}`,
    elements: {fire: '火', water: '水', wood: '木', metal: '金', earth: '土'},
    offerFirst: '选第一件法宝', chestTitle: '宝箱 · 请一位神将', chestHow: '取一位 · 1 2 3 · 不可重选或剔除', offerLevel: n => `第 ${n} 级`, offerHow: '取一件 · 1 2 3', isNew: '新', levelTo: (a, b) => `${a} 级 → ${b} 级`, evolution: '进化', evolvedFrom: name => `由${name}进化`,
    reroll: '重选', banish: '剔除', banishWhich: '剔除哪一张？1 2 3 · Esc 取消', left: n => `剩 ${n} 次`,
    evolvesWith: (el, sign) => `六级时配合${el}系心法进化`, evolvesOwned: (art) => `六级时进化：你已有${art}`, readyToEvolve: '可以进化了：打开一个宝箱', letsEvolve: names => `能让${names}在六级时进化`, replaces: name => `替换${name}`,
    peach: ['仙桃', '已经没有可学的了。歇一歇，回复生命。'],
    hp: '命', spirit: '战意', lv: n => `${n} 级`, kills: '斩', dash: '腾跃', resonance: '共鸣',
    evolved: name => `进化：${name}`, merged: name => `合璧：${name}`, mergedState: '合璧', unknownThing: '无名之物', comes: name => `${name}来袭`, encircled: '四面合围', chestGave: name => `宝箱：${name}`, chestMend: '宝箱：回复生命',
    won: '此战告捷', lost: '你倒下了', time: '用时', level: '等级', work: '谁出的力', trample: '吉量踩踏', share: p => `${p}%`, nothing: '没有打出一击',
    sound: on => on ? '声音：开' : '声音：关',
    loading: '正在研墨…', loadingAt: (mb, pct) => `正在研墨… ${pct != null ? pct + '%' : mb + ' MB'}`, queued: '墨一研好就出阵',
    hint: 'WASD 或方向键骑行 · 空格 腾跃 · 1 2 3 取 · R 重选 · B 剔除 · M 声音 · Esc 暂停',
    missing: {sim: '规则模块', art: '美术模块'}, missingTail: '还不在这份代码里', broken: '与约定的接口不符', stub: '用替身模块运行',
    lang: 'zh', next: '下一将', facing: '决战', nextSmall: '商将', march: '行军中', finalStretch: '朝歌城下',
    stretchKicker: n => `第${'一二三四'[n] || n + 1}段`, finalKicker: '最后一战', marchKicker: '商军溃散', marchTo: name => `进军 · ${name}`,
    arrives: '来袭', lieutenant: '随行', phaseOf: (name, n) => `${name} · 第${'一二三四五'[n] || n + 1}阶段`, enraged: name => `${name}狂暴`, weary: name => `${name}力竭`, wearySub: '每一击都伤他更深，他也逼得更紧', bossDown: name => `${name}败亡`, smallDown: name => `${name}败走`,
    guards: '御林军', guardsSub: '纣王亲征：场上商军尽换御林军', zhouEnd: '纣王退入摘星楼，楼火冲天',
    spoilKicker: from => `战利品 · 得自${from}`, spoilHeal: '气血全复', spoilPayoff: '他的宝箱必出一件大成', spoilFrom: from => `得自${from}`, spoilsEnd: '战利品', noSpoils: '没有斩下 Boss，没有战利品。',
    reachNear: words => `近身 · ${words}`, reachFar: px => `远射 · ${px} 像素`, reachTip: '攻击距离', mounts: r => r < .9 ? '不到一马身' : r < 1.1 ? '一马身' : r < 1.35 ? '一马身多' : r < 1.65 ? '一个半马身' : `${Math.round(r * 2) / 2} 马身`,
    afflict: {afoot: ['落马', '不能腾跃'], held: ['被擒', '不能移动'], bleed: ['失血', '骑过解药'], dizzy: ['失魂', '不能腾跃'], dazzled: ['目眩', '预警难辨'], weak: ['瘟疫', '法宝减弱']},
    weakBy: n => `法宝减弱 ${n}%`, bleedBy: n => `${n}/秒 · 寻解药`,
    lightTaken: el => `五色神光收去${el}系法宝`, lightBack: el => `${el}系法宝归来`, takenFor: n => `被孔宣的五色神光收去，${n} 秒后归还`,
    bleedCut: '化血神刀：血流不止', bleedHint: '骑过解药即止', bleedWhere: n => `骑过${n}剂解药之一即止，青玉箭头指路`, cured: '血已止住', soulLost: '黄气喷出：兵将失魂', glare: '金霞冠放光：预警难辨',
    stone: name => `${name}化为顽石`, wind: name => `${name}化清风而去`, burrow: name => `${name}遁入地下`, dazzle: '太阳神针：双目难睁', antidote: '解药',
    held: {seize: '被擒', swallow: '被吞', hook: '被钩索拖走'},
    leaveWarn: '离开即结束本局，不计功德。对局不会存档，之后无法接着打。', leaveRun: '离开并放弃本局',
    tabs: {weapon: '兵器', merit: '功德', codex: '图鉴'}, pickWeapon: '选一件兵器', weaponNote: '武王只带一件兵器出阵，局内随等级成长，不能更换；法宝另算。',
    heroName: '武王 姬发', chosen: '已选', choose: '选用', lockedFor: n => `<i>未解锁</i><b>${n}</b> 功德`, merit: '功德', meritShort: '功德', meritNow: '可用功德', meritNote: '每局都得，胜负皆有：按坚守的时间、击败的 Boss 和达成的进化计。',
    stats: '十项永久属性 · 每项五级', full: '已满', unlocks: '解锁 · 此后每局进入牌池', owned: '已有', tiers: '难度档', tierLocked: '击败袁洪后开启',
    save: '存档', saveNote: '只存在这个浏览器里。清除浏览器的网站数据会永久丢失；复制存档码可以备份或换浏览器。', saveOff: '这个浏览器不能存档（无痕模式或存储已关）：这次得到的离开就会丢失。请复制存档码保存。', saveNewer: '这里有更新版本《牧野》的存档。为不损坏它，本页用空白记录游戏，不存档。',
    exportCode: '复制存档码', importBtn: '读取存档码', importLabel: '要读取的存档码', copied: '存档码已复制。', copyHere: '没能复制：存档码在框里，请选中后复制。', imported: '已从存档码读取。',
    importConfirm: n => `用存档码里的记录（${n} 功德）替换这个浏览器里的记录？现有记录将被覆盖。`,
    importBad: {shape: '这不是《牧野》的存档码。', check: '存档码损坏或不完整。', newer: '这是更新版本《牧野》的存档码。'},
    codex: '图鉴', codexNote: '在战场上遇到过的，附原著回目和原文一句。其余遇到后才会打开。', codexKinds: {treasure: '法宝', general: '神将', boss: 'Boss', spoil: '战利品', troop: '兵种', foe: '商军'}, unmet: '未遇', codexLocked: '还没遇到。在战场上遇到后这一页才会打开。', chapter: n => `《封神演义》第 ${n} 回`, noQuote: '原著里没有写到它。',
    standin: '兵器、属性与解锁暂为替身数据，待规则模块给出正式表格。',
    meritEarned: '本局功德', meritWhy: {time: (n, sec) => `坚守 ${clock(n * sec)}`, lieutenant: n => `击败 ${n} 员副将`, small: n => `击败 ${n} 员商将`, big: n => `击败 ${n} 员大将`, final: () => '击败纣王', payoff: n => `达成 ${n} 次进化`, tier: x => `难度 ×${+x.toFixed(2)}`, rank: x => `功德加成 ×${+x.toFixed(2)}`}, meritTotal: '合计', meritStandin: '替身算法，待规则给出正式结算',
    howFar: '本局走到', newlyOpen: '新开启', newCodex: n => `图鉴新增 ${n} 页`, newTier: name => `${name}已开启`, nothingNew: '这次没有新开启的', toCamp: '回到卷匣', m1End: '闻仲已败：这一版战役到此为止。',
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
const FILES = {sim: 'src/muye2/sim.js', art: 'src/muye2/art/index.js'};
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
const canvas = $('field'), ctx = createContext(canvas);      // WebGL2 on a hardware GPU, else Canvas 2D (art/render/context.js); the art draws through it as through a 2D context
let sim = null, artMod = null, art = null, game = null;
let mode = 'loading';                 // loading | error | title | play | paused   (game.phase covers offer / won / lost)
let W = 0, H = 0, dpr = 1, used = false, starting = false, endAt = 0, seed = 0;
const cam = {x: 3000, y: 3000, zoom: 1, shakeX: 0, shakeY: 0};
const look = {x: 0, y: 0, vx: 0, vy: 0};
const north = {y: 0, v: 0};      // the lift of the view toward Zhaoge's wall, on a spring      // the camera's lead, on a spring
const shake = {ax: 0, ay: 0, t: 1};
const FALL = {scale: .35, hold: .6, ease: .5};
let fallAt = -1, hurtFlash = 0, toneAt = -1;
const audio = createAudio();
// the campaign's chrome: bars over the bosses, the timeline, the record between runs, the scroll case before a run
const metaStore = createMetaStore((() => { try { return localStorage; } catch { return {getItem: () => null, setItem: () => { throw new Error('no storage'); }}; } })());
const bars = createBars({canvas: $('marks'), top: $('bossbar')});
let timeline = null, camp = null, cp = null;
const fullRun = !params.has('m1');
// what this run did that the end sheet tells: bosses down, codex pages opened, the furthest time
const runLog = {down: [], spoils: [], fresh: [], merit: null, meritParts: null, tierOpened: null};
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

// The canvas is drawn at the screen's full resolution (window size times devicePixelRatio): a smaller backing store is
// stretched by the browser and every figure goes soft (tester's round 1, F1). Only a very high safety cap remains; the
// frame-time watch below lowers resScale only when frames are measured slow, and raises it again when they are fast.
// The cap is the largest backing measured to hold 16 ms through a boss's arrival and an evolution among 300 foes on this
// machine (SPEC-CAMPAIGN 3.7, round 2): 3840×2400 held p95 16.7 ms; 4224×2640 and 4608×2880 (a 2304×1440 window at
// dpr 2) dropped 3-4% of those frames to 33 ms, with the average under the step-down threshold, so nothing caught it.
const MAX_PIXELS = 3840 * 2400;
let resScale = 1;
function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(MAX_PIXELS / Math.max(1, W * H))) * resScale;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  // a 1440 x 900 window shows the field at the view study's size; other windows show about the same area of it
  cam.zoom = clamp(Math.sqrt(W * H / (1440 * 900)), .7, 1.6);
  if (art) art.setView({width: W, height: H, dpr});
  bars.resize(W, H, dpr);
}
addEventListener('resize', resize);

/* ---------- what a thing is called, and its sign ---------- */
const KINDS = ['treasure', 'art', 'troop', 'formation', 'general', 'weapon', 'spoil'];
const kindOf = id => KINDS.find(k => rowOf(k, id));
const evolvedFrom = id => N.evolvedFrom(sim, id), weaponFrom = id => N.weaponFrom(sim, id);
const rowOf = (kind, id) => N.rowOf(sim, kind, id), formRow = (kind, id) => N.formRow(sim, kind, id), mergeElement = m => N.mergeElement(sim, m);
/** The words of a thing at a level, its divine title (ui/names.js: one past the top level is its last form). */
const wordsOf = (kind, id, level) => N.wordsOf({sim, lang, t}, kind, id, level), titleOf = row => N.titleOf({sim, lang, t}, row);
function signOf(kind, id) {
  const f = kind && formRow(kind, id);
  const m = f && (f.merge || (f.kind === 'merge' ? f.row : null));   // a 合璧 pair: one sign on its slip and in the build
  if (m) { const zh = m.name.zh; return m.sign || zh[zh.length - 1]; }
  if (f && f.row.id !== id) return signOf(f.kind, f.row.id);
  const row = kind && rowOf(kind, id);
  if (row && row.sign) return row.sign;
  if (SIGN[id]) return SIGN[id];
  if (SPOIL_SIGN[id]) return SPOIL_SIGN[id];
  const zh = row && row.name && row.name.zh;
  if (!zh) return '·';
  return kind === 'treasure' || kind === 'art' ? zh[zh.length - 1] : zh[0];
}
/** A general's name now: his title while he is in true form in this run, else his name. */
const generalNow = row => { const e = game && game.build && (game.build.generals || []).find(g => g.id === row.id); return e && e.trueForm ? titleOf(row) : row.name[lang] || row.name.en; };
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
const maxOf = kind => N.maxOf(sim, kind);
const pig = element => `--pig:${PIGMENT[element] || PIGMENT.none};--on:${ON[element] || '#FFFDF8'}`;
/** The element a source of damage or a cast belongs to: a treasure, its evolved form, a troop. */
function sourceOf(id) {
  // the damage table keeps a treasure's own id after its payoff: name it by its form in this run (a 合璧 pair, its evolution)
  const b = game && game.build, pair = b && (b.treasures || []).find(e => e.merged && (e.parts || []).some(p => p.id === id));
  if (pair || rowOf('merge', id)) { const m = rowOf('merge', pair ? pair.id : id); if (m) return {kind: 'treasure', id: m.id, element: mergeElement(m), name: m.name[lang] || m.name.en, evolved: true}; }
  const own = b && rowOf('treasure', id) && (b.treasures || []).find(e => e.id === id && e.evolved);
  if (own) return sourceOf(rowOf('treasure', id).evolved.id);
  if (b && b.weapon && b.weapon.id === id && b.weapon.evolved && rowOf('weapon', id)) return sourceOf(rowOf('weapon', id).evolved.id);
  const from = evolvedFrom(id);
  if (from) return {kind: 'treasure', id: from.id, element: from.element, name: from.evolved.name[lang] || from.evolved.name.en, evolved: true};
  const wf = weaponFrom(id);
  if (wf) return {kind: 'weapon', id: wf.id, element: null, name: wf.evolved.name[lang] || wf.evolved.name.en, evolved: true};
  const kind = kindOf(id);
  if (kind) { const row = rowOf(kind, id), host = kind === 'troop' && row.blessed && b && (b.troops || []).some(e => e.id === id && e.blessed); return {kind, id, element: row.element || null, name: kind === 'general' ? generalNow(row) : host ? row.blessed.name[lang] || row.blessed.name.en : row.name[lang] || row.name.en, evolved: host || undefined}; }
  if (id === 'trample') return {kind: null, id, element: null, name: t.trample};
  // a squad's skill counts for its troop, a true form for its general
  const tr = (sim.CONTENT.troops || []).find(r => (r.skill && r.skill.id === id) || (r.blessed && r.blessed.id === id));
  if (tr) return {kind: 'troop', id: tr.id, element: tr.element || null, name: tr.name[lang] || tr.name.en};
  const ge = (sim.CONTENT.generals || []).find(r => r.trueForm && r.trueForm.id === id);
  if (ge) return {kind: 'general', id: ge.id, element: ge.element || null, name: titleOf(ge)};
  return {kind: null, id, element: null, name: t.unknownThing};
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
  if (mode === 'title' && camp && camp.key(k, !!(el && el.tagName === 'INPUT'))) { e.preventDefault(); return; }
  if (mode !== 'play') return;
  if (k === ' ' && !(offering() && el)) edge.dash = true;
  if (offering()) {
    if (k === '1' || k === '2' || k === '3') choose(+k - 1);
    else if (k === 'r') askReroll();
    else if (k === 'b' || k === 'x') askBanish();
  }
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
/** The window lost focus. Keys held are let go; a fight pauses. During an offer the rules' clock is already stopped, and
    a pause sheet would lie over the slips (a fault carried from the live page): the offer simply waits. */
function away() { keys.clear(); if (params.has('still')) return; if (mode === 'play' && !ended() && !bench && !offering()) pause(true); }
addEventListener('blur', away);
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/** A slip is chosen: taken, or thrown out if the player was banishing. A press in the first quarter second of an offer is not taken, so that a key meant for the fight cannot pick. */
function choose(i) {
  if (!offering() || !game.offer || !game.offer[i] || $('offer').hidden || performance.now() - offerAt < 250) return;
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
    frame, never more than KICK_MAX (the lead raised it for the great moments: about 24 px for a boss's blow, 30 for the
    seal), and nothing with shake off or reduced motion. */
const KICK_MAX = 30;
function artKick() {
  if (!shakeOn()) return [0, 0];
  let k = art.kick ? art.kick() : null;
  if (testKick) { const age = (performance.now() - testKick[2]) / 1000; if (age > .3) testKick = null; else { const w = Math.exp(-age * 16) * Math.cos(age * 52); k = [testKick[0] * w, testKick[1] * w]; } }
  if (!k) return [0, 0];
  const x = +k[0] || 0, y = +k[1] || 0, m = Math.hypot(x, y), c = m > KICK_MAX ? KICK_MAX / m : 1;
  return [x * c, y * c];
}
const banners = [], PAY_GAP = 1250; let bannerUntil = 0, bannerPay = false;
function banner(text, danger, sub, first, chest, of = 0) {
  if (banners.some(b => b.text === text)) return;
  if (first) banners.unshift({text, danger, sub, of}); else if (banners.length < 3) banners.push({text, danger, sub, chest, of});
}
/** A payoff (an evolution, a blessed host, a true form) is named as itself, whether a chest or a pick brought it:
    its banner goes first, and the chest's own line waiting from the same moment is dropped. */
function payoff(text, sub = '') {
  for (let i = banners.length - 1; i >= 0; i--) if (banners[i].chest) banners.splice(i, 1);
  if (banners.some(b => b.text === text)) return;
  // ahead of every ordinary line, behind the payoffs already waiting: several at once are read in the order they happen
  let at = 0; while (at < banners.length && banners[at].pay) at++;
  banners.splice(at, 0, {text, danger: false, sub, pay: true});
}
/** Shows the next banner when the one on screen has had its two seconds. */
function bannerTick(now) {
  // a payoff's banner follows another payoff's after 1.25 s, the pace at which the art plays their ceremonies; any other waits the full two seconds
  const ready = banners.length && banners[0].pay && bannerPay ? now >= bannerUntil - 2000 + PAY_GAP : now >= bannerUntil;
  if (!banners.length || !ready || mode === 'paused' || now < heraldUntil - ($('herald').classList.contains('up') ? 0 : 600)) return;      // the herald speaks alone (a raised spoil scroll stands where banners show: they wait it out)
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
  const tier = e.tier || (r && r.named ? tierOf({kind: e.kind, named: true}) : '');
  if (metaStore.see(tier ? 'boss' : 'foe', e.kind)) runLog.fresh.push([tier ? 'boss' : 'foe', e.kind]);
  if (named && (tier === 'big' || tier === 'final' || tier === 'small')) {
    // a boss: the herald unrolls with his name and title, in the page's language, and his long bar (big and final) comes with it
    const n = nameOf(sim, e.kind, lang);
    herald(tier === 'small' ? t.arrives : tier === 'final' ? t.finalKicker : t.arrives, n.name, title ? title[lang] || title.en : n.title, tier, n.zhName[0], e.kind);
    audio.named(tier !== 'small');
  } else if (named && tier === 'lieutenant') { /* a boss's officers come with him: his herald and their own bars say so; a banner each would trail in after the fight */ }
  else if (named) { banner(named[lang] || named.en, true, title ? title[lang] || title.en : '', true); audio.named(false); }
  else { banner(t.comes(foeName(e.kind)), true); if (last) audio.boss(); else audio.elite(); }
}
/** The herald: a long strip of paper unrolled between two rollers across the upper middle, for the campaign's great moments
    (a stretch, a march, a boss's arrival, the guard). One at a time; a newer one replaces it. */
let heraldUntil = 0;
/** The words of a boss's phase where the design names them (SPEC-CAMPAIGN 1.4a); none otherwise. */
const PHASE_WORDS = {zhouwang: [{zh: '午门亲征', en: 'He rides out of the Meridian Gate'}, {zh: '困在垓心', en: 'Hemmed in at the heart of the ring'}, {zh: '气力难撑', en: 'His strength fails him'}]};
const phaseWords = (kind, n) => { const w = PHASE_WORDS[kind] && PHASE_WORDS[kind][n]; return w ? w[lang] : ''; };
const heralds = [];
/** Several great moments can come in one step (纣王 arrives as the guard changes; a boss arrives as a stretch begins):
    each herald has its own 3 s, in turn, a boss's arrival first. */
function herald(kicker, name, sub, tone = '', seal = '', face = '', extra = '', pic = '') {
  const item = [kicker, name, sub, tone, seal, face, extra, pic], first = ['big', 'small', 'final'].includes(tone) && face;
  if (performance.now() >= heraldUntil && !heralds.length) { heraldShow(...item); return; }
  if (first) heralds.unshift(item); else heralds.push(item);
}
function heraldTick(now) { if (heralds.length && now >= heraldUntil && mode !== 'paused') heraldShow(...heralds.shift()); }
const HERALD_MS = {spoil: 4600, 'spoil big-spoil': 5400};
function heraldShow(kicker, name, sub, tone = '', seal = '', face = '', extra = '', pic = '') {
  const h = $('herald'), img = h.querySelector('.hface'), url = face ? portrait(face) : '';
  img.hidden = !url; if (url) img.src = url; if (url) seal = '';      // his own face, when the figures have cut it; else his seal
  let pi = h.querySelector('.hpic'); if (!pi) { pi = document.createElement('img'); pi.className = 'hpic'; pi.alt = ''; pi.decoding = 'async'; pi.onerror = () => { pi.hidden = true; h.classList.remove('pic'); }; h.querySelector('.paper').append(pi); }
  pi.hidden = !pic; if (pic) pi.src = pic; else pi.removeAttribute('src');      // a spoil's painting, large, at the scroll's right
  h.querySelector('.kicker').textContent = kicker; h.querySelector('strong').textContent = name; h.querySelector('.sub').textContent = sub || ''; h.querySelector('.extra').textContent = extra || '';
  h.className = url ? 'face' : ''; h.dataset.seal = seal; h.querySelector('.paper').dataset.seal = seal; void h.offsetWidth; h.className = `show ${tone}${url ? ' face' : ''}${pic ? ' pic' : ''}`;
  const ms = HERALD_MS[tone] || 3200; h.style.setProperty('--herald-ms', `${ms}ms`);
  const now = performance.now(); heraldUntil = now + ms;
  if (tone.startsWith('spoil')) spoilShown(now, ms, tone.includes('big'));
}
/** A boss's spoil is the hero's (SPEC-CAMPAIGN 2.11): greater than any chest. The rules hold a moment; the herald unrolls
    with the fallen boss's face, the spoil's name and what it does, and for a big boss the full heal and his sure payoff. */
const WAIT = 1e15;      // a spoil taken but not yet shown (its herald waits its turn)
let spoilHoldUntil = 0, spoilShowUntil = 0, spoilReadUntil = 0, spoilPending = 0;
function spoilTaken(e) {
  const r = rowOf('spoil', e.id); if (!r) return;
  const big = e.tier === 'big' || r.tier === 'big', from = nameOf(sim, e.from || r.from, lang).name;
  runLog.spoils.push({id: e.id, from: e.from || r.from, t: game.t});
  if (metaStore.see('spoil', e.id)) runLog.fresh.push(['spoil', e.id]);
  const extra = big ? [e.heal !== false ? t.spoilHeal : '', t.spoilPayoff].filter(Boolean).join(' · ') : '';
  spoilPending++; spoilShowUntil = spoilReadUntil = WAIT;
  herald(t.spoilKicker(from), r.name[lang] || r.name.en, r.text[lang] || r.text.en, big ? 'spoil big-spoil' : 'spoil', SPOIL_SIGN[e.id] || '', e.from || r.from, extra, spoilPic(e.id));
  audio.trueForm('metal'); freshSign = e.id; buildKey = '';
}
/** When its scroll unrolls (at once, or after a herald already speaking): the field holds still for a moment in the
    middle of the screen, then the scroll slides up to the top and play resumes under it. The boss's chest (an offer)
    opens after a short read at the top, and the scroll gives way to its slips; the end sheet waits for the whole reading. */
const SPOIL_HOLD = 1200, SPOIL_HOLD_BIG = 1400, SPOIL_SLIDE = 450, SPOIL_READ = 1600;
let spoilUpAt = 0;
function spoilShown(now, ms, big) {
  spoilPending = Math.max(0, spoilPending - 1);
  spoilHoldUntil = now + (big ? SPOIL_HOLD_BIG : SPOIL_HOLD); spoilUpAt = spoilHoldUntil;
  spoilShowUntil = spoilPending ? WAIT : spoilHoldUntil + SPOIL_SLIDE + SPOIL_READ; spoilReadUntil = spoilPending ? WAIT : now + ms;
}
const stretchName = i => { const C = campaignTable(sim), s = C.stretches[i] || (i === C.stretches.length ? C.final : null); return s ? s.name[lang] || s.name.en : ''; };
/** A boss is down (the rules' `bossDown`, or a kill of a unit with a tier): remembered for the end sheet, and announced. */
const downIds = new Set();
function bossDown(e) {
  if (downIds.has(e.id)) return; downIds.add(e.id);
  for (let i = banners.length - 1; i >= 0; i--) if (banners[i].of === e.id) banners.splice(i, 1);      // his phase or rage, still waiting, is no news now
  const tier = e.tier || '', n = nameOf(sim, e.kind, lang);
  runLog.down.push({kind: e.kind, tier, t: game.t});
  if (tier === 'final') herald(t.finalKicker, n.name, t.zhouEnd, 'final');
  else if (tier === 'big') banner(t.bossDown(n.name), false, '', true);
  else if (tier === 'small') banner(t.smallDown(n.name), false, '', true);
}
let freshSign = null;
const joined = new Set();
function join(id) { if (joined.has(id)) return; joined.add(id); const r = rowOf('general', id); if (r) { banner(t.joins(r.name[lang] || r.name.en)); audio.general(r.element); } freshSign = id; buildKey = ''; }
function handle(e) {
  const h = game.hero;
  audio.event(e, h);
  switch (e.type) {
    case 'cast': { const s = sourceOf(e.id); audio.cast(e.id, s.element || 'earth', !!e.evolved || !!s.evolved); break; }
    case 'kill': audio.kill(!!e.elite);
      if (metaStore.see('foe', e.kind)) runLog.fresh.push(['foe', e.kind]);
      { const u = game.foes.find(f => f.id === e.id), r = rowOf('foe', e.kind), tier = u ? tierOf(u) : r && r.named ? tierOf({kind: e.kind, named: true}) : ''; if (tier && tier !== 'elite' && !sim.CAMPAIGN) bossDown({id: e.id, kind: e.kind, tier}); }      // the rules send bossDown once the campaign is in
      break;
    case 'pickup': if (e.kind === 'antidote') audio.peach(); else if (e.kind === 'peach') audio.peach(); else if (e.kind === 'lodestone') audio.lodestone(); else if (e.kind !== 'chest') audio.pickup(e.size || 0); break;
    case 'chest': audio.chest();      // gave: 'generals' (an offer follows and says so itself), 'evolve' | 'blessed' | 'trueForm' (their own banners), a kind with an id, or 'mend'
      if (['evolve', 'trueForm', 'rank', 'blessed', 'generals'].includes(e.gave)) break;
      { const w = sim.CHEST && sim.CHEST[e.gave], k = KINDS.includes(e.gave) ? e.gave : e.gave === 'merge' ? 'merge' : e.id && kindOf(e.id), name = k && e.id ? wordsOf(k, e.id, 1).name : '';
        if (w) banner(w[lang] || w.en, false, name, false, true); else if (e.gave === 'mend' || e.id === 'peach') banner(t.chestMend, false, '', false, true); else if (name) banner(t.chestGave(name), false, '', false, true); }
      break;
    case 'levelUp': audio.levelUp(); $('xp').classList.remove('up'); void $('xp').offsetWidth; $('xp').classList.add('up'); break;
    case 'take': if (e.kind === 'general' && e.isNew) join(e.id);      // in case the rules send no `summon`
      if (e.kind !== 'mend' && metaStore.see(e.kind, e.id)) runLog.fresh.push([e.kind, e.id]);
      audio.take(e.kind === 'mend' ? 'wood' : (rowOf(e.kind, e.id) || {}).element || 'earth'); freshSign = e.id; buildKey = ''; break;
    case 'merge': { const m = rowOf('merge', e.id); if (m) { payoff(t.merged(m.name[lang] || m.name.en), (e.parts || m.parts || []).map(p => wordsOf('treasure', p, maxOf('treasure') + 1).name).join(' + ')); audio.evolve(mergeElement(m)); } freshSign = e.id; buildKey = ''; break; }
    case 'evolve': { const s = sourceOf(e.into || e.id); payoff(t.evolved(s.name)); audio.evolve(s.element); freshSign = e.id; buildKey = ''; break; }
    case 'resonance': audio.resonance(); break;
    case 'elite': arrival(e, false); break;
    case 'boss': arrival(e, true); break;
    case 'arrive': arrival(e, e.kind === 'wenzhong'); break;
    case 'squadSkill': { const r = rowOf('troop', e.troop) || {}; audio.skill(e.troop, e.element || r.element || 'earth', e.blessed ? 5 : e.rank || 2); break; }
    case 'generalSkill': { const r = rowOf('general', e.general) || {}; audio.cast(e.general, e.element || r.element || 'earth', !!e.trueForm); break; }
    case 'summon': join(e.general); if (metaStore.see('general', e.general)) runLog.fresh.push(['general', e.general]); break;
    case 'generalFall': audio.withdraw(); buildKey = ''; break;
    case 'generalReturn': audio.general((rowOf('general', e.general) || {}).element, true); freshSign = e.general; buildKey = ''; break;
    case 'trueForm': { const r = rowOf('general', e.general); if (r) { payoff(t.trueFormOf(titleOf(r)), t.mortalForm(r.name[lang] || r.name.en, r.trueForm && r.trueForm.name ? r.trueForm.name[lang] || r.trueForm.name.en : '')); audio.trueForm(r.element); if (metaStore.see('form', r.id)) runLog.fresh.push(['form', r.id]); } freshSign = e.general; buildKey = ''; break; }
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
    case 'won': audio.won(); runLog.merit = e.merit ?? null; break;
    case 'lost': audio.lost(); runLog.merit = e.merit ?? null; break;
    // the campaign (SPEC-CAMPAIGN 1.1)
    case 'stretch': herald(e.index === 0 && game.t < 1 ? t.stretchKicker(0) : t.stretchKicker(e.index), (e.name && (e.name[lang] || e.name.en)) || stretchName(e.index), '', 'stretch'); timeline && timeline.reset(); break;
    case 'march': herald(t.march, t.marchTo(stretchName(e.to)), '', 'march'); break;
    case 'marchEnd': break;
    case 'rout': if (e.count > 0) banner(t.marchKicker, false); break;      // after the fallen boss's own line
    case 'summoned': break;
    case 'weary': { const n = nameOf(sim, e.kind, lang); banner(t.weary(n.name), false, t.wearySub, false, false, e.id); break; }      // past his band (SPEC 1.14): told once; dropped if he falls first
    case 'bossPhase': { const n = nameOf(sim, e.kind, lang); banner(t.phaseOf(n.name, e.phase), true, phaseWords(e.kind, e.phase), false, false, e.id); $('bossbar').classList.remove('phase'); void $('bossbar').offsetWidth; $('bossbar').classList.add('phase'); audio.encircle(); break; }
    case 'enrage': banner(t.enraged(nameOf(sim, e.kind, lang).name), true, '', false, false, e.id); audio.encircle(); break;
    case 'bossDown': bossDown(e); break;
    case 'spoil': spoilTaken(e); break;
    case 'guards': herald(t.finalKicker, t.guards, t.guardsSub, 'guards'); break;
    // the rest of the run (SPEC-CAMPAIGN 1.11): what the bosses do to the hero, said once, plainly; the strip keeps the time
    case 'lightTaken': banner(t.lightTaken(t.elements[e.element] || e.element), true, '', true); buildKey = ''; audio.refuse(); break;
    case 'lightReturned': banner(t.lightBack(t.elements[e.element] || e.element), false); buildKey = ''; break;
    case 'held': banner((t.held[e.how] || t.afflict.held[0]), true, t.afflict.held[1], true); break;
    case 'bleed': { const n = game.pickups.filter(p => !p.dead && p.kind === 'antidote').length; banner(t.bleedCut, true, n ? t.bleedWhere(n) : t.bleedHint, true); break; }
    case 'cured': banner(t.cured, false); break;
    case 'soulLost': banner(t.soulLost, true); break;
    case 'glare': banner(t.glare, true); break;
    case 'dazzle': banner(t.dazzle, true); break;
    case 'transform': { const u = game.foes.find(f => f.id === e.id); if (u) banner((e.form === 'wind' ? t.wind : t.stone)(nameOf(sim, u.kind, lang).name), true, '', false, false, e.id); break; }
    case 'burrow': { const u = game.foes.find(f => f.id === e.id); if (u) banner(t.burrow(nameOf(sim, u.kind, lang).name), true, '', false, false, e.id); break; }
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
  // a window with no size yet (a tab opened in the background, a frame before layout): nothing is drawn until it has one
  if (!(W > 0 && H > 0) || canvas.width !== Math.round(W * dpr)) { resize(); if (!(W > 0 && H > 0)) return; }
  const h = game.hero, hx = h.px + (h.x - h.px) * alpha, hy = h.py + (h.y - h.py) * alpha;
  // The camera is pinned to the interpolated hero, so the horse never slides against the frame; only the lead is sprung.
  const fallen = h.state === 'fallen' || h.state === 'fall';
  spring(look, 'x', 'vx', fallen ? 0 : clamp((h.vx || 0) / BASE_SPEED, -1.4, 1.4) * LEAD, realDt, 3);
  spring(look, 'y', 'vy', fallen ? 0 : clamp((h.vy || 0) / BASE_SPEED, -1.4, 1.4) * LEAD, realDt, 3);
  cam.x = hx + look.x; cam.y = hy + look.y;
  // near Zhaoge's wall the view looks further north, so the palace city behind it shows (the scene gives the bounds:
  // art.northView() -> {wall, from, lift} in world px). Eased on a spring; the hero is never nearer the bottom than 18%.
  let lift = 0;
  // 0 at wall + from, full at the walkable edge (wall + 80)
  if (art.northView && !fallen) { try { const nv = art.northView(); if (nv && nv.wall != null && nv.from > 80) { const q = clamp((nv.wall + nv.from - hy) / (nv.from - 80), 0, 1); lift = (nv.lift || 0) * q * q * (3 - 2 * q); } } catch { lift = 0; } }
  lift = Math.min(lift, Math.max(0, (.82 - .52) * H / ((art.KY || .62) * cam.zoom)));      // he moves down the screen as the view lifts
  spring(north, 'y', 'v', lift, realDt, 5);
  cam.y -= north.y;
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
  // the bosses' bars, on the page's own sheet above the picture; none before a run or after it
  cp = campaignNow(sim, game);
  const fighting = (mode === 'play' || mode === 'paused') && endAt !== Infinity;
  if (fighting && cp.bar !== barWho) { barWho = cp.bar; const u = game.foes.find(f => f.id === cp.bar); if (u) { const n = nameOf(sim, u.kind, lang), bb = $('bossbar'); bb.querySelector('strong').textContent = n.name; bb.querySelector('small').textContent = n.title; bb.querySelector('.bseal').textContent = n.zhName[0]; bb.className = ''; } }
  if (fighting) { bars.draw(game, art, {cam, ky: art.KY || .62, alpha}, realDt, cp.bar); bars.pointers(game, {cam, ky: art.KY || .62, alpha}, bossSign, [buildRect()]); bars.antidotes(game, {cam, ky: art.KY || .62}, antidoteIcon(), [buildRect()]); $('bossbar').classList.toggle('faint', bars.topOverWarning(game, {cam, ky: art.KY || .62, alpha, art})); }
  else if (barsShown) bars.clear();
  barsShown = fighting;
}
let barsShown = false, barWho = -1;

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
    $('build').hidden = !playing; $('timeline').hidden = !playing; $('xp').style.visibility = playing ? 'visible' : 'hidden';
    text('hp-label', t.hp); text('xp-label', t.spirit); text('kills-label', t.kills); text('dash-label', t.dash); text('sound', t.sound(audio.on));
    $('dash-key').textContent = lang === 'zh' ? '空格' : 'Space';
  }
  if (timeline && cp && (mode === 'play' || mode === 'paused') && endAt !== Infinity) timeline.update(cp, game, lang, t);
  afflictions(h, (mode === 'play' || mode === 'paused') && endAt !== Infinity && game.phase !== 'lost' && h.hp > 0);      // gone when he falls, as the antidote pointers are
  if (cp && cp.next && cp.next.kind && cp.next.t - game.t < 25) { warm(cp.next.kind); warmFigure(cp.next.kind); warmSpoil(spoilOfKind(cp.next.kind)); }      // his herald's portrait and his figure's images, before he comes
  const b = game.build, gens = b.generals || [], lt = game.lightTaken || {}, bk = `${lang}|${Object.keys(lt).map(k => lt[k] > game.t ? k + Math.ceil(lt[k] - game.t) : '').join('')}|${b.weapon ? b.weapon.id + b.weapon.level + (b.weapon.evolved ? 'e' : '') : ''}|${b.treasures.map(e => e.id + e.level + (e.evolved ? 'e' : '')).join()}|${b.arts.map(e => e.id + e.level).join()}|${b.troops.map(e => e.id + e.level + 'r' + rankOfEntry(e)).join()}|${gens.map(e => e.id + e.level + (e.trueForm ? 'f' : '') + 'a' + Math.ceil(awayOf(e))).join()}|${b.formation ? b.formation.id + b.formation.level : ''}|${(b.resonance || []).join()}|${(b.spoils || []).map(x => x.id).join()}`;
  if (bk !== buildKey) { buildKey = bk; renderBuild(); }

  // the offer follows the rules' phase, so a pick made by key, click or bot all close it the same way
  const o = offering() && !bench && performance.now() >= spoilShowUntil ? game.offer : null;      // a chest's slips wait while a spoil is shown
  const ok = o ? `${lang}|${o.map(x => x.kind + x.id + x.level).join()}|${game.rerolls}|${game.banishes}|${banishing}|${fromChest()}` : '';
  if (ok !== offerKey) { const fresh = !offerKey; offerKey = ok; renderOffer(o, fresh); }
  if (ended() && mode === 'play' && endAt !== Infinity && performance.now() >= Math.max(endAt, game.phase === 'won' ? spoilReadUntil : 0)) {      // a spoil taken from the last boss is read before the sheet
    endAt = Infinity; if (bench) begin(); else showEnd(); }
}

/** The art uploads a coming boss's figure ahead of need (art.warm, figures-key session), once per kind. */
const figureWarmed = new Set();
/** The antidote's own picture, when the art has one (render-spike: any antidote*.webp under art/fx/baked/); else the pointers show 药. */
const ANTIDOTE_ICONS = import.meta.glob('./art/fx/baked/**/antidote*.webp', {eager: true, query: '?url', import: 'default'});
let antidoteImg;
function antidoteIcon() {
  if (antidoteImg !== undefined) return antidoteImg;
  const urls = Object.entries(ANTIDOTE_ICONS).sort(([a], [b]) => (b.includes('icon') ? 1 : 0) - (a.includes('icon') ? 1 : 0)), url = urls.length ? urls[0][1] : '';
  antidoteImg = null; if (url) { antidoteImg = new Image(); antidoteImg.decoding = 'async'; antidoteImg.src = url; }
  return antidoteImg;
}
function warmFigure(kind) { if (figureWarmed.has(kind) || !art || !art.warm) return; figureWarmed.add(kind); try { art.warm(kind); } catch { /* the art cannot: he loads on first draw */ } }
/** What afflicts the hero now (SPEC-CAMPAIGN 1.11), as chips by the health bar: a seal, the name, and how long or how much. */
const AFFLICT_SIGN = {afoot: '落', held: '擒', bleed: '血', dizzy: '魂', dazzled: '眩', weak: '瘟'};
let afflictKey = '';
function afflictions(h, on) {
  const list = [];
  if (on) {
    if (h.state === 'afoot' || h.afoot > 0) list.push(['afoot', h.afoot]);
    if (h.held > 0 || h.state === 'held') list.push(['held', h.held]);
    if (h.bleed > 0) list.push(['bleed', null, t.bleedBy(Math.round(h.bleed))]);
    if (h.dizzy > 0) list.push(['dizzy', h.dizzy]);
    if (h.dazzled > 0) list.push(['dazzled', h.dazzled]);
    if (h.weak > 0) list.push(['weak', null, t.weakBy(Math.round(h.weak * 100))]);
  }
  const key = lang + list.map(([k, s, w]) => k + (s > 0 ? Math.ceil(s * 10) : '') + (w || '')).join('|');
  if (key === afflictKey) return; afflictKey = key;
  const el = $('afflict');
  el.innerHTML = list.map(([k, s, w]) => `<span class="ail ail-${k}" title="${esc(t.afflict[k][1])}"><i>${AFFLICT_SIGN[k]}</i><b>${t.afflict[k][0]}</b><em>${s > 0 ? `${s.toFixed(1)} s` : esc(w || t.afflict[k][1])}</em></span>`).join('');
  document.documentElement.classList.toggle('afflicted', list.length > 0); document.documentElement.style.setProperty('--ail-rows', list.length);
  $('hp').classList.toggle('bleeding', list.some(([k]) => k === 'bleed'));
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
  const state = away > 0 ? t.returnsIn(Math.ceil(away)) : kind === 'general' && last ? t.trueForm : w.merged ? `${t.mergedState} · ${(e.parts || (rowOf('merge', e.id) || {}).parts || []).map(p => wordsOf('treasure', p.id || p, maxOf('treasure') + 1).name).join(' + ')}` : (kind === 'treasure' || kind === 'weapon') && last ? t.evolution : rank ? `${rankName(rank)} · ${t.lv(e.level)}` : t.lv(e.level);
  const taken = kind === 'treasure' && game.lightTaken && w.element && game.lightTaken[w.element] > game.t ? Math.ceil(game.lightTaken[w.element] - game.t) : 0;
  const tip = taken ? `${w.name} · ${t.takenFor(taken)}` : kind === 'general' && w.mortal && !(away > 0) ? `${w.name}\n${t.mortalForm(w.mortal, w.feat)}\n${w.text}` : `${w.name} · ${state}${kind === 'weapon' ? ` · ${reachWords(e)}` : ''} · ${w.text}`;
  const badge = taken || (away > 0 ? Math.ceil(away) : last && kind !== 'troop' ? '✦' : e.level);
  return `<button class="sign${kind === 'general' ? ' gseal' : ''}${kind === 'weapon' ? ' wpn' : ''}${taken ? ' taken' : ''}${last ? ' evo' : ''}${away > 0 ? ' away' : ''}${e.id === freshSign ? ' fresh' : ''}" style="${pig(w.element)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${signOf(kind, e.id)}<b>${badge}</b>${rank ? `<em class="r${rank}">${rankName(rank, true)}</em>` : ''}</button>`;
}
/** A boss's one character on his bar and his pointer: the first of his name (the 魔家 brothers by their own). */
const bossSign = u => { const z = nameOf(sim, u.kind, 'zh').zhName; return z.startsWith('魔礼') ? z[2] : z[0]; };
bars.signFor = bossSign;
let buildBox = null, buildBoxAt = 0;
/** The build panel's box on screen, read at most twice a second (for the pointers to keep clear of it). */
function buildRect() { const now = performance.now(); if (now - buildBoxAt > 500) { buildBoxAt = now; const r = $('build').getBoundingClientRect(); buildBox = r.width ? r : null; } return buildBox; }
/** A spoil's sign: a lacquer seal with its character in gold, its words and whom it came from on hover and focus. */
const spoilOfKind = kind => { const all = sim.BY && sim.BY.spoil ? Object.values(sim.BY.spoil) : sim.CONTENT.spoils || []; const r = all.find(s => s.from === kind); return r ? r.id : ''; };
function spoilSignHTML(x) {
  const r = rowOf('spoil', x.id); if (!r) return '';
  const tip = `${r.name[lang] || r.name.en} · ${t.spoilFrom(nameOf(sim, x.from || r.from, lang).name)} · ${r.text[lang] || r.text.en}`;
  return `<button class="sign spoil${spoilPic(x.id) ? ' pic' : ''}${x.id === freshSign ? ' fresh' : ''}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${spoilPic(x.id) ? spoilMarkHTML(x.id, esc) : esc(SPOIL_SIGN[x.id] || r.name.zh[0])}</button>`;
}
/** The weapon's reach in words, from its row at the level it has (the four hand weapons are close; the bow shoots):
    a mount's length is 70 px (content/weapons.js). */
function reachWords(e) {
  const row = rowOf('weapon', e.id); if (!row || !row.base) return '';
  const at = {...row.base}; for (const l of (row.levels || []).slice(0, e.level || 1)) Object.assign(at, l); if (e.evolved && row.evolved) Object.assign(at, row.evolved);
  if (row.shape === 'shoot') return t.reachFar(Math.round(at.range || 0));
  const px = at.length || at.radius || 0; return px ? t.reachNear(t.mounts(px / 70)) : '';
}
function renderBuild() {
  const b = game.build, slots = sim.SLOTS || {treasure: 6, art: 6, troop: 4, formation: 1};
  const row = (kind, list, n = slots[kind]) => `<div class="brow${kind === 'general' ? ' gens' : kind === 'troop' && ranked() ? ' troops' : ''}"><span>${t.rows[kind]}</span>${list.map(e => signHTML(kind, e)).join('')}${list.length < n ? `<i class="sign empty${kind === 'general' ? ' gseal' : ''}" aria-hidden="true"></i>` : ''}</div>`;
  const res = (b.resonance || []).length ? `<div class="brow"><span>${t.resonance}</span>${b.resonance.map(el => { const txt = sim.RESONANCE && sim.RESONANCE[el] && sim.RESONANCE[el].text ? sim.RESONANCE[el].text[lang] : t.elements[el]; return `<button class="sign" style="${pig(el)}" data-tip="${esc(txt)}" aria-label="${esc(txt)}">${ELEMENT_SIGN[el] || '·'}</button>`; }).join('')}</div>` : '';
  // the 将 row is shown once the rules know generals at all
  const gens = sim.CONTENT.generals || b.generals ? row('general', b.generals || [], slots.general || 2) : '';
  // the weapon is its own cell, outside the treasures' slots (PLAN-CAMPAIGN section 4)
  const weapon = b.weapon ? `<div class="brow"><span>${t.rows.weapon}</span>${signHTML('weapon', b.weapon)}<small class="reach">${esc(reachWords(b.weapon))}</small></div>` : '';
  // the spoils: their own row, outside the slots, no levels; each tells what it does and whom it came from (SPEC-CAMPAIGN 2.11)
  const spoils = (b.spoils || []).length ? `<div class="brow spoils"><span>${t.rows.spoil}</span><div class="sset${b.spoils.length > 5 ? ' many' : ''}">${b.spoils.map(spoilSignHTML).join('')}</div></div>` : '';
  $('build').innerHTML = weapon + spoils + row('treasure', b.treasures) + row('art', b.arts) + row('troop', b.troops) + gens + row('formation', b.formation ? [b.formation] : []) + res;
  freshSign = null;
}

/* ---------- the offer ---------- */
/** The one small line under a slip's sentence that says what the pick means for the build beyond itself. */
/** What a slip unlocks, when the rules say it completes a payoff: `unlocks: {kind: 'evolve' | 'bless' | 'trueForm', id, into}`. */
function unlockLine(o) {
  const u = o.unlocks; if (!u) return '';
  const nm = x => x && x.name ? x.name[lang] || x.name.en : '', self = u.id === o.id;
  let words = '', el = null;
  if (u.kind === 'evolve' && u.weapon) { const r = rowOf('weapon', u.id); if (!r || !r.evolved) return ''; words = self ? t.unlockSelf(nm(r.evolved)) : t.unlockOther(nm(r), nm(r.evolved)); }
  else if (u.kind === 'evolve') { const r = rowOf('treasure', u.id); if (!r || !r.evolved) return ''; el = r.element; words = self ? t.unlockSelf(nm(r.evolved)) : t.unlockOther(nm(r), nm(r.evolved)); }
  else if (u.kind === 'bless' || u.kind === 'blessed') { const r = rowOf('troop', u.id); if (!r || !r.blessed) return ''; el = r.element; words = self ? t.unlockHost(nm(r.blessed)) : t.unlockHostOther(nm(r), nm(r.blessed)); }
  else if (u.kind === 'trueForm') { const r = rowOf('general', u.id); if (!r || !r.trueForm) return ''; el = r.element; words = t.unlockForm(titleOf(r)); }
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
  const max = o.kind === 'mend' || o.kind === 'merge' ? 0 : maxOf(o.kind), row = rowOf(o.kind, o.id), w = wordsOf(o.kind, o.id, o.level);
  if (o.kind === 'merge' && !w.element) w.element = mergeElement(row);
  const troop = o.kind === 'troop' && ranked(), general = o.kind === 'general';
  // one past the top level is the last form: a treasure evolved, a general's true form, a troop's fifth rank
  const evo = max > 0 && o.level > max, rank = troop ? rankAt(o.level, evo) : 0, before = troop && !o.isNew ? rankAt(o.level - 1, false) : rank;
  const tag = o.kind === 'mend' ? '' : o.kind === 'merge' ? `<span class="tag evo">${t.kinds.merge}</span>` : evo ? `<span class="tag evo">${general ? t.trueForm : troop ? rankName(5) : t.evolution}</span>` : o.isNew ? `<span class="tag new">${t.isNew}</span>` : troop && rank !== before ? `<span class="tag rank">${rankName(before, lang !== 'zh')} → ${rankName(rank, lang !== 'zh')}</span>` : `<span class="tag">${t.levelTo(o.level - 1, o.level)}</span>`;
  // pips: one a level; a troop's pips stand taller where a rank begins; the ring at the end is the last form
  const hasLast = row && (o.kind === 'treasure' || o.kind === 'weapon' ? row.evolved : general ? row.trueForm !== false : troop);
  const pips = max ? `<span class="pips${max > 6 ? ' many' : ''}" aria-hidden="true">${Array.from({length: max}, (_, n) => `<i class="${n + 1 < o.level ? 'on' : n + 1 === o.level ? 'next' : ''}${troop && [1, 3, 5, 7].includes(n + 1) ? ' mark' : ''}"></i>`).join('')}${hasLast ? `<i class="star${evo ? ' next' : ''}"></i>` : ''}</span>` : '<span></span>';
  const parts = o.kind === 'merge' && row && row.parts ? row.parts.map(p => wordsOf('treasure', p, maxOf('treasure') + 1).name).join(' + ') : '';
  const under = parts ? `<small>${esc(parts)}</small>` : evo && (o.kind === 'treasure' || o.kind === 'weapon') && row ? `<small>${t.evolvedFrom(row.name[lang] || row.name.en)}</small>` : troop ? `<small>${rankName(rank)}${evo ? '' : ` · ${t.lv(o.level)}`}</small>` : general && evo && row ? `<small>${esc(t.formFrom(row.name[lang] || row.name.en, titleOf(row)))}${row.trueForm && row.trueForm.name ? ` · ${esc(row.trueForm.name[lang] || row.trueForm.name.en)}` : ''}</small>` : general && lang !== 'zh' && row ? `<small>${row.name.zh}</small>` : '';
  return `<button class="slip${evo || o.kind === 'merge' ? ' evo' : ''}${general ? ' general' : ''}" data-pick="${i}" style="${pig(w.element)};--i:${i}">
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
  if (camp) { hideSheet(true); $('camp').hidden = false; document.documentElement.classList.add('in-camp'); camp.render(true); loadLine(); const go = $('camp').querySelector('.go'); if (go && !bench) go.focus({preventScroll: true}); return; }
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
  const groupOf = s => s.id === 'trample' ? 'trample' : ['spoil', 'weapon', 'treasure', 'troop', 'general'].includes(s.kind) ? s.kind : 'other';
  const groups = ['spoil', 'weapon', 'treasure', 'troop', 'general', 'trample', 'other'].map(g => ({g, rows: list.filter(x => groupOf(x.s) === g)})).filter(x => x.rows.length).map(x => ({...x, sum: x.rows.reduce((n, r) => n + r.v, 0)})).sort((a, b) => b.sum - a.sum);
  const item = ({v, s}) => `<li><i class="sign${s.kind === 'general' ? ' gseal' : ''}${s.evolved ? ' evo' : ''}" style="${pig(s.element)}" aria-hidden="true">${signOf(s.kind, s.id)}</i><span class="name">${esc(s.name)}</span><span class="bar" style="${pig(s.element)}"><i style="width:${(100 * v / list[0].v).toFixed(1)}%"></i></span><span class="amount">${Math.round(v).toLocaleString('en-US')} · ${t.share(Math.round(100 * v / total))}</span></li>`;
  return `<div class="groups">${groups.map(({g, rows, sum}) => `<section><h4><span>${t.groups[g]}</span><b>${Math.round(sum).toLocaleString('en-US')} · ${t.share(Math.round(100 * sum / total))}</b></h4>${g === 'trample' ? '' : `<ol class="ranked">${rows.slice(0, 8).map(item).join('')}</ol>`}</section>`).join('')}</div>`;
}
function showEnd() {
  settle();
  const won = game.phase === 'won', s = game.stats, C = campaignTable(sim);
  const why = (runLog.meritParts || []).filter(p => p.x != null ? Math.abs(p.x - 1) > 1e-6 : p.merit > 0).map(p => p.why === 'tier' || p.why === 'rank' ? `<li><span>${t.meritWhy[p.why](p.x)}</span><b></b></li>` : `<li><span>${t.meritWhy[p.why] ? t.meritWhy[p.why](p.n, (sim.MERIT && sim.MERIT.time) || 30) : p.why}</span><b>+${p.merit}</b></li>`).join('');
  const pages = runLog.fresh.filter(([k, id]) => CODEX[k] && CODEX[k][id]).length;      // codex pages this run opened
  const opened = [pages ? t.newCodex(pages) : '', runLog.tierOpened ? t.newTier(runLog.tierOpened.name[lang] || runLog.tierOpened.name.en) : ''].filter(Boolean);
  const downMarks = runLog.down.filter(d => d.tier && d.tier !== 'elite').map(d => `<span class="dn">${esc(nameOf(sim, d.kind, lang).name)} · ${shortClock(d.t)}</span>`).join('');
  const m1 = won && !fullRun && runLog.down.some(d => d.kind === 'wenzhong');
  sheet(`<i class="endseal${won ? '' : ' lost'}" aria-hidden="true">${won ? '捷' : '败'}</i><p class="eyebrow">${t.name}</p><h2>${won ? (runLog.down.some(d => d.tier === 'final') ? t.zhouEnd : t.won) : t.lost}</h2>${m1 ? `<p class="note">${t.m1End}</p>` : ''}
    <div class="figures"><div><b>${clock(s.time || game.t)}</b><span>${t.time}</span></div><div><b>${game.hero.level}</b><span>${t.level}</span></div><div><b>${(s.kills || 0).toLocaleString('en-US')}</b><span>${t.kills}</span></div><div class="merit-fig"><b>+${(runLog.meritTotal || 0).toLocaleString('en-US')}</b><span>${t.meritEarned}</span></div></div>
    <div class="end-cols"><section><h3>${t.meritEarned}</h3><ul class="why">${why}<li class="sum"><span>${t.meritTotal}</span><b>${(runLog.meritTotal || 0).toLocaleString('en-US')}</b></li></ul>${runLog.meritStandin ? `<p class="note small">${t.meritStandin}</p>` : ''}</section>
    <section><h3>${t.howFar}</h3><div class="timeline end-line"><div class="tl-track">${timelineHTML(C, lang, {end: s.time || game.t})}</div></div><p class="downs">${downMarks}</p>
    <h3>${t.spoilsEnd}</h3>${runLog.spoils.length ? `<ul class="spoils-end">${runLog.spoils.map(x => { const r = rowOf('spoil', x.id); return r ? `<li><i class="sign spoil${spoilPic(x.id) ? ' pic' : ''}" aria-hidden="true">${spoilMarkHTML(x.id, esc)}</i><span><b>${esc(r.name[lang] || r.name.en)}</b><em>${esc(t.spoilFrom(nameOf(sim, x.from, lang).name))} · ${shortClock(x.t)}</em></span></li>` : ''; }).join('')}</ul>` : `<p class="opened">${t.noSpoils}</p>`}
    <h3>${t.newlyOpen}</h3><p class="opened">${opened.length ? opened.map(esc).join(' · ') : t.nothingNew}</p></section></div>
    <h3>${t.work}</h3>${rankedHTML()}
    <div class="actions"><button class="go" data-do="begin">${t.again}</button><button class="plain" data-do="same">${t.sameSeed(seed)}</button><button class="plain" data-do="camp">${t.toCamp}</button></div>`, 'end');
  focusGo();
}
/** Back to the scroll case: from the end sheet, or by leaving a run (which then earns nothing). */
function toCamp() {
  audio.leave();
  heralds.length = 0;
  mode = 'title'; endAt = 0; document.documentElement.classList.remove('paused'); bars.clear(); $('herald').className = ''; hudKey = '';
  $('veil').classList.remove('on'); $('offer').hidden = true; banners.length = 0;
  showTitle();
}
function showError(err) {
  const part = err.part, who = part ? t.missing[part] : '', why = err.why === 'missing' ? t.missingTail : t.broken;
  const q = new URLSearchParams(location.search); q.set('stub', '1');
  const dev = import.meta.env.DEV || params.has('stub') || params.has('perf');
  sheet(`<p class="eyebrow">${t.name}</p><h2>${t.noStart}</h2><p class="tag-line">${t.noStartTail}</p>
    ${dev ? `<p class="note">${part ? `${who} ${why}. ` : ''}${esc(err.message)}</p><a class="go" style="display:inline-grid;place-items:center;text-decoration:none" href="?${q}">${t.stub}</a>` : ''}`, 'error');
}
function ownedHTML() {
  const b = game.build, all = [...(b.weapon ? [['weapon', b.weapon]] : []), ...b.treasures.map(e => ['treasure', e]), ...b.arts.map(e => ['art', e]), ...b.troops.map(e => ['troop', e]), ...(b.generals || []).map(e => ['general', e]), ...(b.formation ? [['formation', b.formation]] : [])];
  if (!all.length) return '';
  return `<h3>${t.yourBuild}</h3><ul class="owned">${all.map(([kind, e]) => { const last = lastForm(kind, e), w = wordsOf(kind, e.id, formLevel(kind, e)); return `<li><i class="sign${kind === 'general' ? ' gseal' : ''}${last ? ' evo' : ''}" style="${pig(w.element)}" aria-hidden="true">${signOf(kind, e.id)}</i><span><b>${esc(w.name)}</b><em>${kind === 'troop' && ranked() ? `${rankName(rankOfEntry(e))} · ${t.lv(e.level)}` : last ? (kind === 'general' ? `${t.trueForm} · ${esc(w.mortal || '')}` : w.merged ? t.mergedState : t.evolution) : t.lv(e.level)}</em><br>${esc(w.text)}</span></li>`; }).join('')}</ul>`;
}
function pause(on) {
  mode = on ? 'paused' : 'play';
  audio.pause(on);
  document.documentElement.classList.toggle('paused', on);      // battle banners do not lie over the sheet
  if (on) {
    const v = Math.round(settings.volume * 100);
    sheet(`<h2>${t.paused}</h2><p class="leave-warn">${t.leaveWarn}</p><p class="note">${t.hint}</p>${ownedHTML()}
      <fieldset class="settings"><legend>${t.settings}</legend>
        <label class="row"><span>${t.volume}</span><input type="range" id="set-volume" min="0" max="100" step="5" value="${v}"><output id="set-volume-out">${v}</output></label>
        <label class="row"><input type="checkbox" id="set-shake"${settings.shake ? ' checked' : ''}${settings.calm ? ' disabled' : ''}><span>${t.shake}</span></label>
        <label class="row"><input type="checkbox" id="set-calm"${settings.calm ? ' checked' : ''}><span>${t.calm} <small>${t.calmNote}</small></span></label>
      </fieldset>
      <div class="actions"><button class="go" data-do="resume">${t.resume}</button><button class="plain danger" data-do="camp">${t.leaveRun}</button></div>`, 'pause');
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
  if (used) seed = sameSeed === true ? seed : +params.get('seed') || newSeed();
  game = sim.createGame(seed, runOptions());
  if (used) {
    if (art.reset) art.reset();
    else { starting = true; try { art = await artMod.loadArt({}); art.setView({width: W, height: H, dpr}); } finally { starting = false; } }
  }
  $('camp').hidden = true; document.documentElement.classList.remove('in-camp');
  runLog.down.length = 0; runLog.spoils.length = 0; runLog.fresh.length = 0; spoilHoldUntil = 0; spoilShowUntil = 0; spoilReadUntil = 0; spoilPending = 0; spoilUpAt = 0; runLog.merit = null; runLog.meritParts = null; runLog.tierOpened = null; runLog.saved = false; downIds.clear();
  bars.clear(); if (timeline) timeline.reset(); barWho = -1; heraldUntil = 0; heralds.length = 0; afflictKey = '-'; $('herald').className = '';
  used = true; endAt = 0; fallAt = -1; hurtFlash = 0; shake.t = 1; bot.n = 0; toneAt = -1; banishing = false; taken = -1; freshSign = null; document.documentElement.classList.remove('paused'); joined.clear(); banners.length = 0; bannerUntil = 0; easeAt = 0;
  edge.dash = edge.reroll = false; edge.pick = edge.banish = null;
  look.x = look.y = look.vx = look.vy = 0; north.y = north.v = 0;
  if (bench) benchSetup();
  mode = 'play'; hideSheet(true); hudKey = buildKey = offerKey = ''; focusGame();      // at once: the first offer opens on this frame and nothing may lie over it
  last = performance.now(); acc = 0;
}
/** What createGame receives (SPEC-CAMPAIGN 1.6): the camp's weapon, ranks and tier; the whole campaign unless ?m1=1 stops the run at 闻仲. */
function runOptions() { const o = camp ? camp.options() : {}; if (!fullRun) o.until = 'wenzhong'; return o; }
/** The run is over: its merit is added to the record and saved, with the codex pages it opened. Nothing is saved before this. */
function settle() {
  if (runLog.saved) return; runLog.saved = true;
  const m = metaStore.meta, M = sim.META || META_STANDIN;
  let parts = game.stats.meritParts || null, total = runLog.merit ?? game.stats.merit ?? null, standin = false;
  if (total == null) {      // the rules give no merit yet: the page's stand-in, with the tier's and the ranks' share
    standin = true; parts = meritStandin(game, runLog.down);
    const base = parts.reduce((n, p) => n + p.merit, 0), tierX = (M.tiers.find(x => x.tier === m.tier) || {merit: 1}).merit, rankX = 1 + .08 * (m.ranks.merit || 0);
    if (tierX !== 1) parts.push({why: 'tier', x: tierX}); if (rankX !== 1) parts.push({why: 'rank', x: +rankX.toFixed(2)});
    total = Math.round(base * tierX * rankX);
  }
  runLog.meritParts = parts; runLog.meritTotal = total; runLog.meritStandin = standin;
  m.merit += total; m.earned += total; m.runs++;
  const bosses = runLog.down.filter(d => d.tier && d.tier !== 'elite').length;
  if ((game.stats.time || game.t) > m.best.t) m.best.t = game.stats.time || game.t; if (bosses > m.best.bosses) m.best.bosses = bosses;
  if (runLog.down.some(d => d.kind === (M.tierOpensOn || 'yuanhong')) && m.tier + 1 >= m.tiersOpen && m.tiersOpen < M.tiers.length) { m.tiersOpen++; runLog.tierOpened = M.tiers[m.tiersOpen - 1]; }
  m.last = [...m.last, {t: Math.round(game.t), won: game.phase === 'won', merit: total, bosses}].slice(-5);
  metaStore.save();
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
  hudKey = buildKey = ''; barWho = -1; if (timeline) timeline.reset();
  if (mode === 'title' || mode === 'loading') showTitle(); else if (mode === 'paused') pause(true); else if (mode === 'play' && ended() && endAt === Infinity) showEnd();
}
document.addEventListener('click', e => {
  if (e.target.closest('#back') && running()) { e.preventDefault(); if (mode === 'play') pause(true); const b = $('sheet-body').querySelector('[data-do=leave]'); if (b) b.focus({preventScroll: true}); return; }
  const b = e.target.closest('button'); if (!b) return;
  audio.ensure();
  if (b.dataset.do === 'begin') begin();
  else if (b.dataset.do === 'same') begin(true);
  else if (b.dataset.do === 'resume') pause(false);
  else if (b.dataset.do === 'camp') { toCamp(); return; }
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
const HOLD_MAX = .3; let heldFor = 0;
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
  // a held frame on a great blow (art.hold(): seconds left, from the effects): the rules stand still and no input is
  // taken, while the picture, its effects, the shake and the kick go on. None with reduced motion.
  let frozen = false;
  if (mode === 'play' && !settings.calm && art.hold && game.phase === 'fight') { try { frozen = art.hold() > 0; } catch { frozen = false; } }
  // a hold that does not end is a fault in the effects, not a held frame: never more than HOLD_MAX in a row
  heldFor = frozen ? heldFor + dt : 0; if (heldFor > HOLD_MAX) frozen = false;
  if (mode === 'play' && game.phase === 'fight' && performance.now() < spoilHoldUntil) frozen = true;      // the spoil's held moment (its own length, not HOLD_MAX)
  if (mode === 'play' && !hook.hold && !frozen) {
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
    audio.crowd(game.foes.length);
    if (game.phase === 'fight') audio.hooves(Math.hypot(h.vx || 0, h.vy || 0), BASE_SPEED * 1.3, simDt);
    if (hurtFlash > 0) hurtFlash -= dt * 3;
  }
  const t1 = performance.now();
  const still = mode === 'paused' || stopped;
  draw(mode === 'play' ? acc / STEP : 1, still ? 0 : simDt, mode === 'paused' ? 0 : dt);
  const tD = performance.now();
  hud(); heraldTick(now); bannerTick(now);
  if (spoilUpAt && now >= spoilUpAt) { spoilUpAt = 0; const h = $('herald'); if (h.classList.contains('spoil')) h.classList.add('up'); }
  { const h = $('herald'); if (h.classList.contains('up') && !h.classList.contains('gone') && !$('offer').hidden) { h.classList.add('gone'); heraldUntil = Math.min(heraldUntil, now + 250); } }      // the chest's slips take the screen
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
    if (perf.i % 30 === 0) { const s = perfStats(), f = (o, d = 2) => `${o.avg.toFixed(d)} · p95 ${o.p95.toFixed(d)}`; $('perf').textContent = `${ctx.kind || 'canvas'}${ctx.why ? ` (${ctx.why})` : ''} · frame ${f(s.frame, 1)} ms\nsim   ${f(s.sim)}\ndraw  ${f(s.draw)}\n${s.foes} foes · ${s.allies} allies · ${s.shots} shots · ${canvas.width}×${canvas.height} px\nsound ${s.mix.castVoices}/${s.mix.voices} voices · density ${s.mix.density}`; }
  }
}
function perfStats() {
  const out = {};
  for (const k of ['frame', 'sim', 'draw']) { const a = Array.from(perf[k].subarray(0, perf.n)).sort((x, y) => x - y), n = a.length || 1; out[k] = {avg: a.reduce((s, v) => s + v, 0) / n, p95: a[Math.floor(n * .95)] || 0, max: a[n - 1] || 0}; }
  const c = game && sim.counts ? sim.counts(game) : {};
  return {...out, foes: c.foes ?? (game ? game.foes.length : 0), allies: c.allies ?? 0, shots: c.shots ?? 0, dpr, resScale, zoom: cam.zoom, backing: [canvas.width, canvas.height], mix: audio.mix, samples: perf.n};
}

/* ---------- start ---------- */
const hook = window.__muye = {get game() { return game; }, get mode() { return mode; }, get art() { return art; }, get sim() { return sim; }, get seed() { return seed; }, perfStats, perf, cam, begin, kick: askKick, settings, audio, ready: false, bars, metaStore, get camp() { return camp; }, get campaign() { return cp; }, herald, toCamp, modules: {sim: useStub('sim') ? 'stub' : 'real', art: useStub('art') ? 'stub' : 'real'}};
(async function start() {
  const t0 = performance.now();
  setLang(lang);      // the title sheet, at once
  try {
    if (!ctx) throw new Error('this browser gave no 2D canvas');
    [sim, artMod] = await Promise.all([loadModule('sim', ['createGame', 'step', 'CONTENT']), loadModule('art', ['loadArt'])]);
    art = await artMod.loadArt({onProgress: (done, total) => { load.done = done; load.total = total; loadLine(); }});
    seed = +params.get('seed') || newSeed();
    camp = createCamp({root: $('camp'), sim, store: metaStore, words: () => t, onBegin: () => begin(), onChange: () => audio.ensure()});
    timeline = createTimeline($('timeline'), sim);
    game = sim.createGame(seed, runOptions());
  } catch (err) {
    mode = 'error'; hook.error = String(err.message || err); showError(err);
    console.warn('[muye]', err);
    return;
  }
  resize(); applySettings(false);
  if (art.paperAt) setPaper(art.paperAt(0));
  mode = 'title'; showTitle(); hudKey = '';
  if (perf.on) $('perf').hidden = false;
  hook.ready = Math.round(performance.now() - t0) || 1;
  last = performance.now();
  requestAnimationFrame(frame);
  if (bench || load.queued) begin();
})();
