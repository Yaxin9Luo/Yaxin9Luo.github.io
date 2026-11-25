// What the pre-run place shows: the weapons, the ten permanent stats, the unlocks and the difficulty tiers. The rules·build
// session owns these tables (`CONTENT.weapons`, `META` in content/weapons.js and content/meta.js); until they exist the
// page shows these STAND-INS, with the shapes it reads written into SPEC-CAMPAIGN.md ("Page"). Numbers here mean nothing.
const T = (en, zh) => ({en, zh});

export const WEAPONS_STANDIN = [
  {id: 'spear', sign: '枪', name: T('Spear', '枪'), text: T('Thrusts straight ahead along the way you ride.', '朝前进方向直刺一线。'), suits: T('for riding through the ranks', '适合冲阵')},
  {id: 'halberd', sign: '戟', name: T('Halberd', '戟'), text: T('Sweeps a half circle round you.', '身周横扫半圈。'), suits: T('for when you are surrounded', '适合被围')},
  {id: 'broadsword', sign: '刀', name: T('Broadsword', '大刀'), text: T('A slow, heavy, wide cut that throws foes back.', '慢而重的大范围劈砍，击退。'), suits: T('for the thick of the crowd', '适合人堆')},
  {id: 'bow', sign: '弓', name: T('Bow', '弓'), text: T('Shoots the nearest elite from afar.', '远射最近的精英。'), suits: T('for keeping your distance', '适合放风筝')},
  {id: 'whip', sign: '鞭', name: T('Iron whip', '鞭'), text: T('Short fast blows, harder on bosses.', '短距连击，对 Boss 加伤。'), suits: T('for bringing down bosses', '适合打 Boss')},
];
const levels = (fmt) => [20, 45, 80, 130, 200].map((cost, i) => ({cost, text: fmt(i + 1)}));
export const META_STANDIN = {
  start: {weapons: ['spear', 'halberd']},
  stats: [
    {id: 'hp', name: T('Health', '生命'), levels: levels(n => T(`+${n * 10}% health`, `生命 +${n * 10}%`))},
    {id: 'speed', name: T('Speed', '移速'), levels: levels(n => T(`+${n * 3}% riding speed`, `移速 +${n * 3}%`))},
    {id: 'gather', name: T('Reach', '拾取范围'), levels: levels(n => T(`+${n * 12}% pickup reach`, `拾取范围 +${n * 12}%`))},
    {id: 'spirit', name: T('Battle spirit', '经验获取'), levels: levels(n => T(`+${n * 6}% battle spirit`, `经验获取 +${n * 6}%`))},
    {id: 'merit', name: T('Merit', '功德获取'), levels: levels(n => T(`+${n * 8}% merit`, `功德获取 +${n * 8}%`))},
    {id: 'chest', name: T('Chests', '宝箱出现率'), levels: levels(n => T(`+${n * 6}% chest chance`, `宝箱出现率 +${n * 6}%`))},
    {id: 'rerolls', name: T('Rerolls', '重选次数'), levels: levels(n => T(`+${n} reroll${n > 1 ? 's' : ''}`, `重选 +${n} 次`))},
    {id: 'banishes', name: T('Banishes', '剔除次数'), levels: levels(n => T(`+${n} banish${n > 1 ? 'es' : ''}`, `剔除 +${n} 次`))},
    {id: 'dashCd', name: T('Spring', '冲刺冷却'), levels: levels(n => T(`spring ready ${n * 6}% sooner`, `腾跃冷却 -${n * 6}%`))},
    {id: 'startLevel', name: T('Head start', '开局等级'), levels: levels(n => T(`start at level ${n + 1}`, `开局 ${n + 1} 级`))},
  ],
  unlocks: [
    {kind: 'weapon', id: 'broadsword', cost: 120}, {kind: 'weapon', id: 'bow', cost: 160}, {kind: 'weapon', id: 'whip', cost: 220},
    {kind: 'general', id: 'leizhenzi', cost: 90}, {kind: 'general', id: 'tuxingsun', cost: 90}, {kind: 'general', id: 'dengchanyu', cost: 120}, {kind: 'general', id: 'huangfeihu', cost: 150},
    {kind: 'treasure', id: 'seal', cost: 60}, {kind: 'treasure', id: 'banner', cost: 60}, {kind: 'treasure', id: 'whip', cost: 80}, {kind: 'treasure', id: 'fireCover', cost: 80},
  ],
  tiers: [
    {tier: 0, name: T('First tier', '第一档'), text: T('The campaign as written.', '原定的战役。'), merit: 1},
    {tier: 1, name: T('Second tier', '第二档'), text: T('Foes tougher and harder-hitting. More merit.', '敌人更强，功德更多。'), merit: 1.3},
    {tier: 2, name: T('Third tier', '第三档'), text: T('Tougher again.', '再强一档。'), merit: 1.6},
  ],
  tierOpensOn: 'yuanhong',
};
/** The page's stand-in for merit while the rules give none: time, bosses, payoffs. Marked as a stand-in on the end sheet. */
export function meritStandin(game, bossesDown) {
  const parts = [{why: 'time', n: Math.floor((game.stats.time || game.t) / 30), each: 1}];
  const small = bossesDown.filter(b => b.tier === 'small' || b.tier === 'lieutenant').length, big = bossesDown.filter(b => b.tier === 'big').length, fin = bossesDown.filter(b => b.tier === 'final').length;
  if (small) parts.push({why: 'small', n: small, each: 15});
  if (big) parts.push({why: 'big', n: big, each: 40});
  if (fin) parts.push({why: 'final', n: fin, each: 100});
  const pay = Array.isArray(game.stats.payoffs) ? game.stats.payoffs.length : +game.stats.payoffs || 0;
  if (pay) parts.push({why: 'payoff', n: pay, each: 10});
  for (const p of parts) p.merit = p.n * p.each;
  return parts;
}
