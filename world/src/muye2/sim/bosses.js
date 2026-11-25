// The named foes: their warned patterns, and what they loose. Owner: rules·campaign (A).

import {TAU, setState, rand} from './core.js';
import {addZone, hurtAlly} from './harm.js';
import {startLane} from './foes.js';
import {BY, CAMPAIGN} from '../content.js';

/** How much longer a ring round `f` is warned for a hero this near him: who rides round or through the boss needs it (SPEC 1.15). */
function ringClose(f, h) {
  const C = CAMPAIGN.ringClose, d = Math.hypot(h.x - f.x, h.y - f.y);
  return C.add * Math.min(1, Math.max(0, (C.none - d) / (C.none - C.full)));
}
/** A named foe begins one of his patterns: the ground is marked for `warn` seconds, then it strikes. */
export function startPattern(g, f, A) {
  if (A.shape === 'lane' && A.chargeSpeed) { startLane(g, f, A); return; }
  const h = g.hero, k = f.dmg / BY.foe[f.kind].dmg, dir = Math.atan2(h.y - f.y, h.x - f.x);
  const warn = (z, more) => { z.pattern = A.id; z.dmg = (A.dmg || 0) * k; z.P = A; z.great = !!A.great; g.events.push({type: 'warn', kind: A.id, shape: z.shape, by: f.kind, id: f.id, time: z.life, x: z.x, y: z.y, hidden: f.glareT > 0, ...more}); return z; };
  // 张奎 goes under the earth and comes up where the blow falls; 袁洪 goes on the wind and comes back beside the hero
  if (A.burrow) { f.under = true; f.ex = h.x; f.ey = h.y; setState(f, 'under'); g.events.push({type: 'burrow', id: f.id, x: f.x, y: f.y}); }
  if (A.vanish) { f.gone = true; setState(f, 'gone'); g.events.push({type: 'transform', id: f.id, form: 'wind', time: A.warn, x: f.x, y: f.y}); }
  switch (A.shape) {
    case 'lane': {                                          // a blast down a lane: he stands
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, 0, A.warn);
      z.shape = 'lane'; z.dir = dir; z.len = A.length; z.w = A.width;
      warn(z, {dir, length: A.length, width: A.width});
      break;
    }
    case 'cone': {
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, A.radius, A.warn);
      z.shape = 'cone'; z.dir = dir; z.angle = A.angle;
      warn(z, {dir, angle: A.angle, radius: A.radius});
      break;
    }
    case 'circles': {
      // the first where the hero is; with `ahead`, the second where he is going; the rest scattered round him
      for (let i = 0; i < A.count; i++) {
        let x = h.x, y = h.y;
        // the second where he is going; if he stands, between him and the one who strikes: the ways out are away
        // (`lead`: where his speed and his turning will have carried him by then, this share of the way)
        if (i === 1 && A.ahead) {
          if (h.moving && A.lead) {
            const v = Math.max(Math.hypot(h.vx, h.vy), A.ahead / (A.warn * A.lead)), T = A.warn * A.lead, w = h.turn, c = h.course;
            if (Math.abs(w) < .05) { x += Math.cos(c) * v * T; y += Math.sin(c) * v * T; }
            else { x += v / w * (Math.sin(c + w * T) - Math.sin(c)); y -= v / w * (Math.cos(c + w * T) - Math.cos(c)); }
          } else { const a = h.moving ? h.head : dir + Math.PI; x += Math.cos(a) * A.ahead; y += Math.sin(a) * A.ahead; }
        }
        else if (i > 0) { const near = A.radius * (A.near || 1.6), a = rand(g) * TAU, d = near + rand(g) * (A.scatter - near); x += Math.cos(a) * d; y += Math.sin(a) * d; }
        warn(addZone(g, 'warn', 'shang', f.kind, x, y, A.radius, A.warn), {radius: A.radius});
      }
      break;
    }
    case 'ring': {
      // `through`: the band is laid through the place the hero is in, as wide as the row's
      const w = A.r - A.r0, r0 = A.through ? Math.max(BY.foe[f.kind].r + 20, Math.hypot(h.x - f.x, h.y - f.y) - w / 2) : A.r0;
      const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, r0 + w, A.warn + ringClose(f, h));
      z.shape = 'ring'; z.r0 = r0;
      warn(z, {radius: r0 + w, inner: r0});
      break;
    }
    case 'rings': {                                         // band after band, each further out and a little later
      // the bands are open on the far side from the hero: who rides in through the boss comes out where none falls
      const late = ringClose(f, h), far = Math.atan2(f.y - h.y, f.x - h.x), gap = CAMPAIGN.ringClose.gap;
      A.bands.forEach((b, i) => {
        const z = addZone(g, 'warn', 'shang', f.kind, f.x, f.y, b[1], A.warn + late + i * A.gap);
        z.shape = 'ring'; z.r0 = b[0]; z.dir = far; z.gap = gap;
        warn(z, {radius: b[1], inner: b[0], order: i, gapDir: far, gap});
      });
      break;
    }
    case 'dark': case 'wall': {
      const z = A.shape === 'dark' ? addZone(g, 'warn', 'shang', f.kind, f.x, f.y, A.radius, A.warn) : addZone(g, 'warn', 'shang', f.kind, h.x, h.y, A.r, A.warn);
      z.P = A;
      if (A.shape === 'dark') z.unit = f; else { z.shape = 'ring'; z.r0 = A.r0; }
      warn(z, A.shape === 'dark' ? {radius: A.radius, life: A.life} : {radius: A.r, inner: A.r0, life: A.life});
      z.dmg = 0;
      break;
    }
    case 'guard': {
      f.cutDmg = (A.cut || 0) * k;
      // 一刀抵三: he takes a guard; for `life` s blows are turned aside (sim/harm.js). PLACEHOLDER: the closing cut at
      // the nearest general comes in M2.
      f.guardT = A.warn + A.life;
      g.events.push({type: 'warn', kind: A.id, shape: 'guard', by: f.kind, id: f.id, time: A.warn, life: A.life, x: f.x, y: f.y});
      break;
    }
    case 'glare': {                                         // 火灵圣母's 金霞冠: her own warnings are hard to see for a while
      f.glareT = A.warn + A.life;
      g.events.push({type: 'glare', id: f.id, time: f.glareT, x: f.x, y: f.y});
      break;
    }
    case 'stone': {                                         // 袁洪 turns to stone under the blade
      f.guardT = A.warn + A.life;
      g.events.push({type: 'transform', id: f.id, form: 'stone', time: f.guardT, x: f.x, y: f.y});
      break;
    }
    case 'summon': {
      f.summonN = A.count || 1;
      f.summon = A.kind;
      g.events.push({type: 'warn', kind: A.id, shape: 'summon', by: f.kind, id: f.id, time: A.warn, x: f.x, y: f.y});
      break;
    }
  }
  f.act = 'slam'; f.actT = A.warn;
  setState(f, 'windup');
}

/** A named foe's turn when he is free to act: the first of his patterns that is ready and in reach begins. Returns true when he stands for it. */
export function stepNamed(g, f, row, d, dt) {
  const pats = row.patterns;
  for (let k = 0; k < pats.length; k++) f.pcd[k] -= dt;
  for (let k = pats.length - 1; k >= 0; k--) {
    const A = pats[k];
    if (f.pcd[k] > 0 || d > A.within || (A.from && f.phase < A.from) || (A.shape === 'summon' && !A.count && g.foes.some(o => o.kind === A.kind && o.state !== 'dead'))) continue;
    f.pcd[k] = A.cd * f.cdK; startPattern(g, f, A);
    return true;
  }
  return false;
}

/** The marten eats soldiers: the nearest one, a bite at a time; with none left it comes for the hero. Returns true while it has prey (it does its own walking). */
export function stepMarten(g, f, row, dt) {
  let prey = null, bd = Infinity;
  for (const a of g.allies) {
    if (a.kind === 'general' || a.state === 'dead' || a.mvT > 0) continue;
    const pd = (a.x - f.x) * (a.x - f.x) + (a.y - f.y) * (a.y - f.y);
    if (pd < bd) { bd = pd; prey = a; }
  }
  if (!prey) return false;
  const pd = Math.sqrt(bd) || 1, sp = f.speed * g.haste * (f.slow > 0 ? 1 - f.slow : 1);
  if (pd > f.r + prey.r) { f.x += (prey.x - f.x) / pd * sp * dt; f.y += (prey.y - f.y) / pd * sp * dt; setState(f, 'walk'); }
  else if (f.cd <= 0) { f.cd = row.between; setState(f, 'attack'); g.events.push({type: 'bite', x: prey.x, y: prey.y, id: f.id, target: prey.id}); hurtAlly(g, prey, row.bite, f.kind); }
  f.facing = prey.x >= f.x ? 1 : -1;
  return true;
}

/** The end of 一刀抵三's guard: a heavy cut at the nearest general or soldier (SPEC 1.11 `cut`). */
export function guardCut(g, f) {
  let best = null, bd = 400 * 400;
  for (const a of g.allies) {
    if (a.state === 'dead' || a.state === 'away' || a.mvT > 0) continue;
    const d = (a.x - f.x) * (a.x - f.x) + (a.y - f.y) * (a.y - f.y);
    if (d < bd) { bd = d; best = a; }
  }
  if (!best) return;
  g.events.push({type: 'cut', id: f.id, target: best.id, x: best.x, y: best.y});
  hurtAlly(g, best, f.cutDmg, f.kind);
}
