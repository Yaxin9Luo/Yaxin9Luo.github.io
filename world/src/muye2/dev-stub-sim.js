// Stand-in for sim.js, used by the page with ?stub=1 (or ?stub=sim). It follows the rules contract of
// lab/game-studies/SPEC-SURVIVORS.md section 4 closely enough to drive the page: the same fields, events and exports,
// a small content table, offers with reroll and banish, levels, chests and an evolution. It is NOT the game's rules:
// every treasure is the same plain blow on the nearest foes, arts and troops only count, and nothing here is tested.
const T = (en, zh) => ({en, zh});
export const WORLD = {w: 6000, h: 6000};
export const STEP = 1 / 60;
export const SLOTS = {treasure: 6, art: 6, troop: 4, formation: 1, general: 2};
export const MAX = {treasure: 6, art: 5, troop: 8, formation: 3, general: 5};
// Section 6.2: five ranks of a troop. The fifth is not a level: level 8, a chest, and the kind's patron general owned.
export const RANKS = [{rank: 1, level: 1, id: 'levy', name: T('levy', '卒')}, {rank: 2, level: 3, id: 'picked', name: T('picked men', '锐士')}, {rank: 3, level: 5, id: 'armoured', name: T('armoured men', '甲士')}, {rank: 4, level: 7, id: 'darkGuard', name: T('dark-armour guard', '玄甲')}, {rank: 5, level: 8, id: 'blessed', name: T('blessed host', '神兵')}];
export const rankOf = (level, blessed) => blessed ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
export const ELEMENTS = {wood: {feeds: 'fire', zh: '木', en: 'wood'}, fire: {feeds: 'earth', zh: '火', en: 'fire'}, earth: {feeds: 'metal', zh: '土', en: 'earth'}, metal: {feeds: 'water', zh: '金', en: 'metal'}, water: {feeds: 'wood', zh: '水', en: 'water'}};
export const fedBy = element => Object.keys(ELEMENTS).find(e => ELEMENTS[e].feeds === element);
const levels = (n, first, more) => Array.from({length: n}, (_, i) => ({text: i === 0 ? first : T(`${more.en} (${i + 1})`, `${more.zh}（${i + 1}）`)}));
const row = (kind, id, element, en, zh, first, evolved) => ({kind, id, element, name: T(en, zh), levels: levels(MAX[kind], first, T('It hits harder and reaches further.', '打得更重，够得更远。')), evolved});
const TROOP_LEVELS = [T('Four men, cloth and a plain weapon.', '四人，布衣，寻常兵器。'), T('Two more men.', '再添两人。'), T('The squad skill unlocks.', '解锁小队技能。'), T('They strike a fifth more often.', '出手快两成。'), T('Two more men; the skill is larger.', '再添两人；技能范围更大。'), T('They strike a fifth more often.', '出手快两成。'), T('The skill gains a second effect of the squad’s element.', '技能多一重本系效果。'), T('Every man hits a quarter harder.', '每人伤害提高四分之一。')];
const troop = (id, element, en, zh, ids, skill, blessedName) => ({kind: 'troop', id, element, name: T(en, zh), skill: {id: ids[0], name: skill}, levels: TROOP_LEVELS.map((x, i) => ({text: i === 2 ? T(`Unlocks ${skill.en}: the squad’s own skill, on a cooldown.`, `解锁「${skill.zh}」：小队自己的技能，自动发动。`) : x})), blessed: {id: ids[1], name: blessedName, text: T(`${skill.en} becomes ${blessedName.en}: a new shape, in the squad’s element.`, `「${skill.zh}」化为「${blessedName.zh}」：新的形态，带本系之力。`)}});
const PATRON = {nezha: [], yangjian: ['spears'], leizhenzi: ['archers'], tuxingsun: ['strongmen', 'shields'], dengchanyu: ['acolytes'], huangfeihu: ['hooks', 'tigers', 'chariots']};
const FORM = {nezha: 'threeHeadsEightArms', yangjian: 'seventyTwoChanges', leizhenzi: 'stormWings', tuxingsun: 'earthOpens', dengchanyu: 'fiveLights', huangfeihu: 'kingWucheng'};
const general = (id, element, en, zh, first, formName, formText) => ({kind: 'general', id, element, name: T(en, zh), patronOf: PATRON[id], levels: [{text: first}, {text: T('He strikes a quarter harder.', '伤害提高四分之一。')}, {text: T('He acts a fifth more often.', '行动快两成。')}, {text: T('His blows reach wider.', '攻击范围更大。')}, {text: T('He is ready to show his true form: open a chest.', '可以显圣了：打开一个宝箱。')}], trueForm: {id: FORM[id], name: formName, text: formText}});
export const CONTENT = {
  treasures: [
    row('treasure', 'fireSpear', 'fire', 'Fire-tipped Spear', '火尖枪', T('A spear of fire thrusts through every foe in a line.', '火枪直刺，贯穿一线上的敌人。'), {id: 'sanmeiSpear', name: T('Samadhi Spear', '三昧神枪'), text: T('Every thrust forks in two and the ground burns along each line.', '每一枪分成两岔，枪路所过之地燃烧。')}),
    row('treasure', 'sash', 'water', 'Armillary Sash', '混天绫', T('A long sash whips an arc round you and pushes foes back.', '长绫绕身一甩，把敌人推开。'), {id: 'riverTurner', name: T('River Turner', '翻江'), text: T('The arc becomes a full circle of wave.', '弧线变成一整圈浪。')}),
    row('treasure', 'ring', 'metal', 'Universe Ring', '乾坤圈', T('A thrown ring bounces between foes.', '掷出的圈在敌人之间弹跳。'), {id: 'boundlessRing', name: T('Boundless Ring', '乾坤无极'), text: T('Three rings that return to you.', '三个圈，掷出后都会飞回。')}),
    row('treasure', 'seal', 'earth', 'Heaven-turning Seal', '番天印', T('A seal slams down on the densest group and stuns it.', '大印砸向最密的敌群，并震晕它们。'), {id: 'overturn', name: T('Heaven and Earth Overturned', '番天覆地'), text: T('The seal leaves a field that crushes.', '印落之处留下一片碾压之地。')}),
    row('treasure', 'whip', 'wood', 'God-beating Whip', '打神鞭', T('A heavy blow on the strongest foe near.', '重重一鞭，打向附近最强的敌人。'), {id: 'investiture', name: T('Investiture', '封神'), text: T('The blow chains to every elite in sight.', '这一鞭连打视野内的每个精英。')}),
  ],
  arts: [
    row('art', 'sanmei', 'fire', 'Samadhi Fire', '三昧真火', T('Everything you own hits harder.', '你的一切攻击都更重。')),
    row('art', 'ganlu', 'water', 'Sweet Dew', '甘露', T('You slowly mend.', '你缓缓回复生命。')),
    row('art', 'fenglei', 'wood', 'Wind and Thunder', '风雷', T('You ride faster and your treasures strike more often.', '骑得更快，法宝出手更勤。')),
    row('art', 'jinguang', 'metal', 'Golden Light', '金光', T('Every attack reaches wider.', '所有攻击的范围更大。')),
    row('art', 'houtu', 'earth', 'Deep Earth', '厚土', T('More health, and every hit hurts less.', '生命更厚，每次受击都更轻。')),
  ],
  troops: [
    troop('shields', 'earth', 'Shield-bearers', '干士', ['shieldWall', 'mountainWall'], T('Shield wall', '盾墙'), T('Mountain wall', '不动如山')),
    troop('spears', 'metal', 'Dagger-axe Men', '戈士', ['massThrust', 'thousandPoints'], T('Massed thrust', '攒刺'), T('Forest of blades', '万刃林')),
    troop('archers', 'wood', 'Archers', '射士', ['arrowRain', 'skyOfArrows'], T('Arrow rain', '箭雨'), T('Thunder arrows', '雷矢')),
    troop('tigers', 'fire', 'Tiger Guards', '虎贲', ['tigerLeap', 'tigerStorm'], T('Tiger leap', '虎跃'), T('Flame tigers', '炎虎')),
  ],
  generals: [
    general('nezha', 'fire', 'Nezha', '哪吒', T('On the wind-fire wheels he darts between groups with spear, ring and sash.', '脚踏风火轮，在敌群之间穿梭，枪刺、圈打、绫扫。'), T('Three heads and eight arms', '三头八臂'), T('Every arm holds a weapon; he strikes on all sides at once.', '每只手都持兵器，四面同时出击。')),
    general('yangjian', 'metal', 'Yang Jian', '杨戬', T('He duels elites with the three-pointed blade; the Howling Hound runs down archers and shamans.', '持三尖刀单挑精英；哮天犬追咬射手和巫祝。'), T('Seventy-two changes', '七十二变'), T('He turns into what beats his foe; the hound becomes a pack of ink hounds.', '变成克制对手之物；哮天犬化作一群墨犬。')),
    general('leizhenzi', 'wood', 'Leizhenzi', '雷震子', T('Winged, he flies over the mass and dives with thunder along a line.', '展翅飞过敌群，带着雷沿一线俯冲。'), T('Wind and thunder', '风雷相随'), T('A storm cloud follows him and strikes by itself.', '一片雷云跟着他，自行落雷。')),
    general('tuxingsun', 'earth', 'Tuxingsun', '土行孙', T('He travels under the ground, comes up under an elite and binds it.', '土遁而行，从精英脚下钻出，用捆仙绳缚住。'), T('The ground opens', '地裂'), T('The ground opens under whole groups.', '整群敌人脚下的地面裂开。')),
    general('dengchanyu', 'water', 'Deng Chanyu', '邓婵玉', T('Her five-light stones stun single foes from far off, first whoever is winding up a blow.', '五光石远远打晕单个敌人，先打正在蓄力的。'), T('Five lights', '五光齐发'), T('A volley of five lights blinds a whole side.', '五光齐发，晃瞎一整面的敌人。')),
    general('huangfeihu', 'earth', 'Huang Feihu', '黄飞虎', T('On the five-coloured ox at the head of the troops; squads near him hit and stand harder.', '骑五色神牛立于阵前；他身边的兵打得更重、站得更稳。'), T('Prince Wucheng', '武成王'), T('When his skill fires, every squad’s skill fires with it.', '他发动技能时，所有兵的技能一同发动。')),
  ],
  formations: [
    row('formation', 'circle', null, 'The Ring', '圆阵', T('The squads stand all round you; fewer hits reach you.', '兵阵环立四周，打到你的攻击更少。')),
    row('formation', 'arrowhead', null, 'The Arrowhead', '锋矢阵', T('The squads go ahead of you; trample and squad damage rise while you move.', '兵阵在你前方；移动时踩踏和士兵的伤害提高。')),
  ],
  foes: [{id: 'spear', name: T('Shang spearman', '商戈兵')}, {id: 'chariot', name: T('Chariot', '战车'), elite: true}, {id: 'moliqing', name: T('Mo Liqing', '魔礼青'), title: T('of the four Mo brothers', '魔家四将'), elite: true, named: true}, {id: 'wenzhong', name: T('Wen Zhong', '闻仲'), title: T('Grand Preceptor of Shang', '商太师'), elite: true, named: true}],
};
const index = rows => Object.fromEntries(rows.map(r => [r.id, r]));
export const BY = {treasure: index(CONTENT.treasures), art: index(CONTENT.arts), troop: index(CONTENT.troops), formation: index(CONTENT.formations), general: index(CONTENT.generals), foe: index(CONTENT.foes)};
export const LIST = {treasure: CONTENT.treasures, art: CONTENT.arts, troop: CONTENT.troops, formation: CONTENT.formations, general: CONTENT.generals};
export function describe(kind, id, level) {
  const r = BY[kind][id];
  if (kind === 'treasure' && level > MAX.treasure) return {name: r.evolved.name, text: r.evolved.text, element: r.element};
  if (kind === 'general' && level > MAX.general) return {name: r.name, text: r.trueForm.text, element: r.element};      // level 6: the true form
  if (kind === 'troop' && level > MAX.troop) return {name: r.name, text: r.blessed.text, element: r.element, rank: 5, rankName: RANKS[4].name};          // level 9: the blessed host
  if (kind === 'troop') { const rank = rankOf(level, false); return {name: r.name, text: r.levels[level - 1].text, element: r.element, rank, rankName: RANKS[rank - 1].name}; }
  return {name: r.name, text: r.levels[level - 1].text, element: r.element};
}
export const xpNeed = level => Math.round(6 + 9 * (level - 1));
const rnd = g => { g.rs = (Math.imul(g.rs, 1664525) + 1013904223) >>> 0; return g.rs / 4294967296; };
const ev = (g, e) => g.events.push(e);
const owned = (g, kind) => kind === 'treasure' ? g.build.treasures : kind === 'art' ? g.build.arts : kind === 'general' ? g.build.generals : g.build.troops;
export function canEvolve(g, e) { return e.level >= MAX.treasure && !e.evolved && g.build.arts.some(a => BY.art[a.id].element === fedBy(BY.treasure[e.id].element)); }
export function give(g, kind, id, level) {
  if (kind === 'formation') { g.build.formation = {id, level: level || 1}; return; }
  const list = owned(g, kind), e = list.find(x => x.id === id);
  if (e) e.level = level || e.level + 1;
  else if (kind === 'general') { list.push({id, level: level || 1, trueForm: false}); const h = g.hero, u = {id: g.nextId++, kind: 'general', general: id, level: level || 1, trueForm: false, x: h.x - 60, y: h.y + 30, px: h.x - 60, py: h.y + 30, facing: 1, dir: 0, hp: 200, maxHp: 200, state: 'walk', stateT: 0, flash: 0, cd: 0, life: 0}; g.allies.push(u); ev(g, {type: 'summon', general: id, x: u.x, y: u.y}); }
  else list.push({id, level: level || 1, evolved: false, cd: 0, ...(kind === 'troop' ? {rank: 1, blessed: false, skillCd: 4} : {})});
  if (kind === 'general') { const u = g.allies.find(a => a.kind === 'general' && a.general === id), b = list.find(x => x.id === id); u.level = b.level; }
  if (kind === 'troop') { const t = list.find(x => x.id === id), was = t.rank; t.rank = rankOf(t.level, t.blessed); if (t.rank !== was) ev(g, {type: 'rankUp', troop: id, rank: t.rank, level: t.level}); }
}
export function addFoe(g, kind, x, y) {
  const big = kind === 'chariot' || kind === 'wenzhong' || kind === 'moliqing', hp = kind === 'wenzhong' ? 1500 : kind === 'moliqing' ? 600 : big ? 220 : 14 + g.t / 20;
  const f = {id: g.nextId++, kind, x, y, px: x, py: y, vx: 0, vy: 0, facing: 1, dir: 0, hp, maxHp: hp, state: 'walk', stateT: 0, flash: 0, elite: big, r: big ? 26 : 12, hitCd: 0};
  if (kind === 'moliqing' || kind === 'wenzhong') f.named = true;
  g.foes.push(f); return f;
}
function makeOffer(g) {
  const pool = [];
  for (const kind of ['treasure', 'art', 'troop', 'general']) for (const r of LIST[kind]) {
    if (kind === 'general' && g.hero.level < 2) continue;      // the real rules: never before level 4, and rare; here early, so that the slip can be seen
    if (g.banished.includes(kind + ':' + r.id)) continue;
    const e = owned(g, kind).find(x => x.id === r.id);
    if (e) { if (e.level < MAX[kind]) pool.push({kind, id: r.id, level: e.level + 1, isNew: false}); }
    else if (owned(g, kind).length < SLOTS[kind]) pool.push({kind, id: r.id, level: 1, isNew: true});
  }
  for (const r of CONTENT.formations) {
    const f = g.build.formation;
    if (g.banished.includes('formation:' + r.id)) continue;
    if (f && f.id === r.id) { if (f.level < MAX.formation) pool.push({kind: 'formation', id: r.id, level: f.level + 1, isNew: false}); }
    else pool.push({kind: 'formation', id: r.id, level: 1, isNew: true});
  }
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice((rnd(g) * pool.length) | 0, 1)[0]);
  return out.length ? out : [{kind: 'mend', id: 'peach', level: 1, isNew: false}];
}
export function createGame(seed = 1, options = {}) {
  const g = {seed, rs: (seed >>> 0) || 1, t: 0, phase: 'fight', options,
    hero: {id: 0, kind: 'hero', x: 3000, y: 3000, px: 3000, py: 3000, vx: 0, vy: 0, facing: 1, dir: 0, hp: 100, maxHp: 100, state: 'idle', stateT: 0, flash: 0, fullCry: false, dashCd: 0, level: 1, xp: 0, xpNext: xpNeed(1), safe: 0, moving: false, rideT: 0, dashT: 0, fallT: 0, dx: 1, dy: 0},
    build: {treasures: [], arts: [], troops: [], generals: [], formation: null, resonance: []},
    offer: null, chestOffer: false, rerolls: 2, banishes: 2, banished: [],
    foes: [], allies: [], shots: [], pickups: [], zones: [], events: [],
    stats: {kills: 0, damage: {}, taken: {}, time: 0, level: 1, picks: 0, chests: 0, spirit: 0, levelTimes: []},
    nextId: 1, spawnT: 0, eliteAt: 45, namedAt: 70, bossed: false};
  if (options.start) give(g, 'treasure', options.start);
  else if (!options.bare) { g.offer = CONTENT.treasures.slice(0, 3).map(r => ({kind: 'treasure', id: r.id, level: 1, isNew: true})); g.phase = 'offer'; ev(g, {type: 'offer', offer: g.offer, opening: true}); }
  return g;
}
function take(g, o) {
  if (o.kind === 'mend') g.hero.hp = Math.min(g.hero.maxHp, g.hero.hp + 30); else give(g, o.kind, o.id, o.level);
  g.stats.picks++; ev(g, {type: 'take', kind: o.kind, id: o.id, level: o.level, isNew: o.isNew, x: g.hero.x, y: g.hero.y});
  g.offer = null; g.phase = 'fight'; g.chestOffer = false;
}
function hurt(g, f, dmg, src) {
  f.hp -= dmg; f.flash = .1; g.stats.damage[src] = (g.stats.damage[src] || 0) + dmg;
  ev(g, {type: 'hit', id: src, target: f.id, dmg, x: f.x, y: f.y});
  if (f.hp <= 0 && f.state !== 'dead') {
    f.state = 'dead'; f.stateT = 0; g.stats.kills++;
    ev(g, {type: 'kill', x: f.x, y: f.y, id: f.id, kind: f.kind, by: src, elite: f.elite});
    g.pickups.push({id: g.nextId++, kind: f.elite ? 'chest' : 'spirit', named: !!f.named, x: f.x, y: f.y, px: f.x, py: f.y, value: f.elite ? 0 : 2, size: 0});
    if (f.kind === 'wenzhong') { g.phase = 'won'; g.stats.time = g.t; ev(g, {type: 'won', x: f.x, y: f.y, t: g.t}); }
  }
}
export function step(g, input = {}, dt = STEP) {
  const h = g.hero;
  if (g.phase === 'won' || g.phase === 'lost') return g;
  if (g.phase === 'offer') {
    if (input.reroll && g.rerolls > 0 && !g.chestOffer) { g.rerolls--; g.offer = makeOffer(g); ev(g, {type: 'offer', offer: g.offer, rerolled: true}); }
    else if (Number.isInteger(input.banish) && g.banishes > 0 && !g.chestOffer && g.offer[input.banish] && g.offer[input.banish].kind !== 'mend') {
      const o = g.offer[input.banish]; g.banishes--; g.banished.push(o.kind + ':' + o.id);
      const fresh = makeOffer(g).find(n => !g.offer.some(x => x.kind === n.kind && x.id === n.id)); g.offer[input.banish] = fresh || {kind: 'mend', id: 'peach', level: 1, isNew: false};
      ev(g, {type: 'offer', offer: g.offer, banished: true});
    } else if (Number.isInteger(input.pick) && g.offer[input.pick]) take(g, g.offer[input.pick]);
    return g;
  }
  g.t += dt; g.stats.time = g.t;
  h.px = h.x; h.py = h.y; for (const f of g.foes) { f.px = f.x; f.py = f.y; } for (const p of g.pickups) { p.px = p.x; p.py = p.y; }
  if (h.fallT > 0) { h.fallT -= dt; h.stateT += dt; if (h.fallT <= 0) { g.phase = 'lost'; ev(g, {type: 'lost', x: h.x, y: h.y, t: g.t}); } return g; }
  // the hero
  const mx = +input.mx || 0, my = +input.my || 0, moving = Math.hypot(mx, my) > .1;
  h.dashCd = Math.max(0, h.dashCd - dt); h.safe = Math.max(0, h.safe - dt);
  if (moving) { h.dx = mx; h.dy = my; h.dir = Math.atan2(my, mx); if (mx) h.facing = Math.sign(mx); }
  if (input.dash && h.dashCd <= 0) { h.dashT = .2; h.dashCd = 3; ev(g, {type: 'dash', x: h.x, y: h.y, dir: h.dir}); }
  h.rideT = moving ? h.rideT + dt : 0;
  const cry = h.rideT > 1.2; if (cry !== h.fullCry) { h.fullCry = cry; ev(g, {type: cry ? 'cry' : 'cryEnd', x: h.x, y: h.y}); }
  const speed = h.dashT > 0 ? 900 : 215 * (cry ? 1.3 : 1);
  if (h.dashT > 0) { h.dashT -= dt; h.vx = h.dx * speed; h.vy = h.dy * speed; } else { h.vx = moving ? mx * speed : 0; h.vy = moving ? my * speed : 0; }
  h.x = Math.max(40, Math.min(WORLD.w - 40, h.x + h.vx * dt)); h.y = Math.max(40, Math.min(WORLD.h - 40, h.y + h.vy * dt));
  h.moving = moving; const st = h.dashT > 0 ? 'dash' : moving ? 'ride' : 'idle'; if (st !== h.state) { h.state = st; h.stateT = 0; } else h.stateT += dt;
  // foes come from every side and walk at the hero
  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.options.spawn !== false) { g.spawnT = Math.max(.12, .9 - g.t / 400); const a = rnd(g) * 6.283; addFoe(g, 'spear', h.x + Math.cos(a) * 820, h.y + Math.sin(a) * 820); }
  if (g.t >= g.eliteAt) { g.eliteAt += 45; const a = rnd(g) * 6.283, f = addFoe(g, 'chariot', h.x + Math.cos(a) * 820, h.y + Math.sin(a) * 820); ev(g, {type: 'elite', x: f.x, y: f.y, kind: 'chariot', id: f.id}); ev(g, {type: 'warn', kind: 'lane', x: f.x, y: f.y, dir: a + Math.PI, length: 900, width: 60, time: 1, id: f.id}); }
  if (g.t >= g.namedAt) { g.namedAt = 1e9; const f = addFoe(g, 'moliqing', h.x - 760, h.y); ev(g, {type: 'arrive', kind: 'moliqing', name: BY.foe.moliqing.name, title: BY.foe.moliqing.title, x: f.x, y: f.y, id: f.id}); ev(g, {type: 'boss', x: f.x, y: f.y, kind: 'moliqing', id: f.id}); }
  if (g.t >= 600 && !g.bossed) { g.bossed = true; const f = addFoe(g, 'wenzhong', h.x + 700, h.y); ev(g, {type: 'arrive', kind: 'wenzhong', name: BY.foe.wenzhong.name, title: BY.foe.wenzhong.title, x: f.x, y: f.y, id: f.id}); ev(g, {type: 'boss', x: f.x, y: f.y, kind: 'wenzhong', id: f.id}); }
  for (const f of g.foes) {
    f.stateT += dt; if (f.flash > 0) f.flash -= dt; if (f.hitCd > 0) f.hitCd -= dt;
    if (f.state === 'dead') continue;
    const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1, v = f.elite ? 120 : 70;
    f.x += dx / d * v * dt; f.y += dy / d * v * dt; f.facing = Math.sign(dx) || 1; f.dir = Math.atan2(dy, dx);
    if (d < f.r + 22) {
      if (h.fullCry && !f.elite && f.hitCd <= 0) { f.hitCd = .8; ev(g, {type: 'trample', x: f.x, y: f.y}); hurt(g, f, 14 + 2 * h.level, 'trample'); }
      else if (h.safe <= 0 && h.dashT <= 0) {
        const dmg = f.elite ? 18 : 6; h.hp = Math.max(0, h.hp - dmg); h.safe = .5; g.stats.taken[f.kind] = (g.stats.taken[f.kind] || 0) + dmg;
        ev(g, {type: 'hurt', x: h.x, y: h.y, dmg, by: f.kind, fromX: f.x, fromY: f.y});
        if (h.hp <= 0) { h.fallT = 1.6; h.state = 'fallen'; h.stateT = 0; h.vx = h.vy = 0; ev(g, {type: 'fall', x: h.x, y: h.y, by: f.kind}); }
      }
    }
  }
  // every treasure: a plain blow on the nearest foes, at its own rhythm
  g.build.treasures.forEach((e, i) => {
    e.cd -= dt; if (e.cd > 0) return;
    e.cd = .8 + i * .35;
    const near = g.foes.filter(f => f.state !== 'dead' && Math.hypot(f.x - h.x, f.y - h.y) < 260 + 20 * e.level).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, e.evolved ? 6 : 2);
    if (!near.length) return;
    ev(g, {type: 'cast', id: e.evolved ? BY.treasure[e.id].evolved.id : e.id, level: e.level, evolved: e.evolved, shape: 'line', x: h.x, y: h.y, dir: Math.atan2(near[0].y - h.y, near[0].x - h.x), length: 260, width: 30, targets: near.map(f => ({x: f.x, y: f.y}))});
    for (const f of near) hurt(g, f, (8 + 4 * e.level) * (e.evolved ? 2 : 1), e.evolved ? BY.treasure[e.id].evolved.id : e.id);
  });
  // squads: a plain blow each, and from the second rank a squad skill on a cooldown
  const nearest = (n, reach) => g.foes.filter(f => f.state !== 'dead' && Math.hypot(f.x - h.x, f.y - h.y) < reach).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, n);
  for (const e of g.build.troops) {
    e.cd -= dt; e.skillCd -= dt;
    if (e.cd <= 0) { e.cd = 1.1; for (const f of nearest(1, 200)) hurt(g, f, 4 + 2 * e.level, e.id); }
    if (e.rank >= 2 && e.skillCd <= 0) { const hit = nearest(3 + e.rank, 320); if (hit.length) { e.skillCd = 7; const r = BY.troop[e.id], sid = e.blessed ? r.blessed.id : r.skill.id; ev(g, {type: 'squadSkill', troop: e.id, rank: e.rank, id: sid, blessed: e.blessed, shape: 'drop', element: r.element, x: hit[0].x, y: hit[0].y, dir: 0, by: [], targets: hit.map(f => ({x: f.x, y: f.y})), radius: 60, delay: 0}); for (const f of hit) hurt(g, f, 10 + 5 * e.level, sid); } else e.skillCd = .5; }
  }
  // generals: each is a unit on the field that fights by himself; one who has fought for 40 s withdraws for 20 s
  // (here by the clock: he takes no blows in this stand-in), in state `away`
  for (const u of g.allies) {
    if (u.kind !== 'general') continue;
    const b = g.build.generals.find(x => x.id === u.general); if (!b) continue;
    u.px = u.x; u.py = u.y; u.stateT += dt; u.trueForm = b.trueForm; u.level = b.level;
    if (u.state === 'away') { if (u.stateT >= 20) { u.state = 'walk'; u.stateT = 0; u.life = 0; u.x = h.x - 60; u.y = h.y + 30; ev(g, {type: 'generalReturn', general: u.general, x: u.x, y: u.y}); } continue; }
    u.x += (h.x - 60 - u.x) * Math.min(1, dt * 4); u.y += (h.y + 30 - u.y) * Math.min(1, dt * 4);
    u.life += dt; if (u.life > 40 && !b.trueForm) { u.state = 'away'; u.stateT = 0; ev(g, {type: 'generalFall', general: u.general, x: u.x, y: u.y}); continue; }
    u.cd -= dt; if (u.cd <= 0) { u.cd = b.trueForm ? .5 : 1; for (const f of nearest(b.trueForm ? 4 : 1, 360)) hurt(g, f, 12 + 6 * b.level, u.general); }
  }
  g.foes = g.foes.filter(f => f.state !== 'dead' || f.stateT < .6);
  // pickups
  for (const p of g.pickups) {
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < 90) { p.x += (h.x - p.x) * Math.min(1, dt * 9); p.y += (h.y - p.y) * Math.min(1, dt * 9); }
    if (d > 24) continue;
    p.dead = true;
    if (p.kind === 'chest') {
      g.stats.chests++;
      if (p.named && g.build.generals.length < SLOTS.general) {      // the named foe's chest: three generals to choose from, no reroll and no banish
        g.offer = CONTENT.generals.filter(r => !g.build.generals.some(e => e.id === r.id)).slice(0, 3).map(r => ({kind: 'general', id: r.id, level: 1, isNew: true}));
        g.phase = 'offer'; g.chestOffer = true; ev(g, {type: 'chest', x: h.x, y: h.y, gave: 'generals', id: null}); ev(g, {type: 'offer', offer: g.offer, chest: true}); continue;
      }
      const gen = g.build.generals.find(x => x.level >= MAX.general && !x.trueForm), host = g.build.troops.find(x => x.level >= MAX.troop && !x.blessed && g.build.generals.some(q => BY.general[q.id].patronOf.includes(x.id)));
      const e = g.build.treasures.find(x => canEvolve(g, x)) || g.build.treasures.find(x => x.level < MAX.treasure);
      if (gen) { gen.trueForm = true; ev(g, {type: 'chest', x: h.x, y: h.y, gave: 'trueForm', id: gen.id}); ev(g, {type: 'trueForm', general: gen.id, id: BY.general[gen.id].trueForm.id, x: h.x, y: h.y}); }
      else if (host) { host.blessed = true; host.rank = 5; ev(g, {type: 'chest', x: h.x, y: h.y, gave: 'blessed', id: host.id}); ev(g, {type: 'blessed', troop: host.id, patron: g.build.generals.find(q => BY.general[q.id].patronOf.includes(host.id)).id, x: h.x, y: h.y}); }
      else if (e && canEvolve(g, e)) { e.evolved = true; ev(g, {type: 'chest', x: h.x, y: h.y, gave: 'evolve', id: e.id}); ev(g, {type: 'evolve', id: e.id, into: BY.treasure[e.id].evolved.id, x: h.x, y: h.y}); }
      else if (e) { e.level++; ev(g, {type: 'chest', x: h.x, y: h.y, gave: 'treasure', id: e.id}); }
    } else { h.xp += p.value; g.stats.spirit += p.value; ev(g, {type: 'pickup', kind: 'spirit', size: p.size, value: p.value, x: h.x, y: h.y}); }
  }
  g.pickups = g.pickups.filter(p => !p.dead);
  if (h.xp >= h.xpNext && g.phase === 'fight') {
    h.xp -= h.xpNext; h.level++; h.xpNext = xpNeed(h.level); g.stats.level = h.level; g.stats.levelTimes.push(g.t);
    ev(g, {type: 'levelUp', level: h.level, x: h.x, y: h.y});
    g.offer = makeOffer(g); g.phase = 'offer'; ev(g, {type: 'offer', offer: g.offer});
  }
  return g;
}
export function counts(g) {
  let foes = 0, elites = 0; for (const f of g.foes) if (f.state !== 'dead') { foes++; if (f.elite) elites++; }
  return {foes, elites, allies: g.allies.length, shots: g.shots.length, zones: g.zones.length, pickups: g.pickups.length};
}
