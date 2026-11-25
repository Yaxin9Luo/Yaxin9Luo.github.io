// The arts (心法): what each adds, per level, to the sums the engine reads. Owner: rules·build (B).

import {T} from './base.js';
import {MAX} from './build.js';

// `gives` is added once per level to the sums the engine reads: dmg, rate, area, dur, speed, spirit (shares),
// regen (health a second), mend (share added to what a peach mends), hp, armour, gather (px), ride (seconds the
// ride clock runs further past the full cry: about eight foes a second of it), trample (share), muster and troopHp
// (shares: squads), generalRate (share) and back (seconds: generals), weaponDmg and weaponRate (shares: the weapon),
// dashCd (share off the spring's wait; A's hero.js reads g.mods.dashCd).
export const pct = v => Math.round(v * 100);
export const art = (id, element, name, gives, say) => ({
  id, element, name, gives,
  levels: Array.from({length: MAX.art}, (_, i) => ({text: say(i + 1)})),
});
export const arts = [
  art('sanmei', 'fire', T('Samadhi Fire', '三昧真火'), {dmg: .08},
    n => T(`Treasures, squads and the horse all hit ${pct(.08 * n)}% harder.`, `法宝、兵阵与战马的伤害都提高 ${pct(.08 * n)}%。`)),
  art('changming', 'fire', T('Ever-burning Lamp', '长明'), {dur: .15},
    n => T(`Fires, fields, stuns and slows you cause last ${pct(.15 * n)}% longer.`, `你造成的燃烧、力场、震晕与减速多持续 ${pct(.15 * n)}%。`)),
  art('ganlu', 'water', T('Sweet Dew', '甘露'), {regen: .4, mend: .2},
    n => T(`You mend ${(.4 * n).toFixed(1)} health every second, and a peach mends ${pct(.2 * n)}% more.`, `每秒回复 ${(.4 * n).toFixed(1)} 点生命，仙桃的回复量提高 ${pct(.2 * n)}%。`)),
  art('lingtai', 'water', T('Spirit Terrace', '灵台'), {spirit: .12},
    n => T(`Battle spirit you gather counts for ${pct(.12 * n)}% more, so levels come sooner.`, `拾取的战意多算 ${pct(.12 * n)}%，升级更快。`)),
  art('fenglei', 'wood', T('Wind and Thunder', '风雷'), {speed: .05, rate: .07, ride: .18, trample: 1},
    n => T(`You ride ${pct(.05 * n)}% faster, every treasure strikes ${pct(.07 * n)}% more often, and in full cry the horse tramples ${pct(1 * n)}% harder and rides down ${n === 1 ? 'one more foe' : 'more foes'} before its stride breaks.`, `骑行速度提高 ${pct(.05 * n)}%，所有法宝出手频率提高 ${pct(.07 * n)}%；全速冲锋时，践踏的伤害提高 ${pct(1 * n)}%，战马能多踏翻几个敌人才会被拖住。`)),
  art('jinguang', 'metal', T('Golden Light', '金光'), {area: .1},
    n => T(`Every attack is ${pct(.1 * n)}% larger: longer lines, wider arcs and circles.`, `所有攻击的范围扩大 ${pct(.1 * n)}%：线更长，弧与圈更大。`)),
  art('jubao', 'metal', T('Treasure Bowl', '聚宝'), {gather: 35},
    n => T(`Battle spirit flies to you from ${35 * n} px further away.`, `战意从更远 ${35 * n} 像素之外飞向你。`)),
  art('houtu', 'earth', T('Deep Earth', '厚土'), {hp: 20, armour: 1, trample: 3.5},
    n => T(`${20 * n} more health, every hit hurts ${n} less, and the horse tramples ${pct(3.5 * n)}% harder.`, `生命上限加 ${20 * n}，每次受击少掉 ${n} 点，战马践踏的伤害提高 ${pct(3.5 * n)}%。`)),
  art('lianbing', 'wood', T('Drilling the Host', '练兵'), {muster: .15, troopHp: .06},
    n => T(`Squads muster their fallen men ${pct(.15 * n)}% faster, and every soldier has ${pct(.06 * n)}% more health.`, `各队补员快 ${pct(.15 * n)}%，每名士兵生命提高 ${pct(.06 * n)}%。`)),
  art('jiangxing', 'fire', T('Star of Generals', '将星'), {generalRate: .08, back: 2},
    n => T(`Generals' skills come round ${pct(.08 * n)}% sooner, and a general who withdraws is back ${2 * n} s sooner.`, `神将技能就绪快 ${pct(.08 * n)}%；退下的神将早 ${2 * n} 秒归阵。`)),
  art('wuyi', 'metal', T('Arms', '武艺'), {weaponDmg: .1, weaponRate: .06},
    n => T(`Your weapon hits ${pct(.1 * n)}% harder and strikes ${pct(.06 * n)}% more often.`, `你的兵器伤害提高 ${pct(.1 * n)}%，出手频率提高 ${pct(.06 * n)}%。`)),
  art('dunshu', 'earth', T('Earth Escape', '土遁'), {dashCd: .08, hp: 10, armour: .5},
    n => T(`The spring comes back ${pct(.08 * n)}% sooner, ${10 * n} more health, and every hit hurts ${n / 2} less.`, `纵跃冷却缩短 ${pct(.08 * n)}%，生命上限加 ${10 * n}，每次受击少掉 ${n / 2} 点。`)),
];