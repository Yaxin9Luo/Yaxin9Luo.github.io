// Shots, zones and pickups in motion. Owner: rules·campaign (A).

import {TAU, TICK, wrap, rand, query, queryLane, Qshot, Qhop, Qzone, nearestFoe, inZone} from './core.js';
import {mend, openChest, bigPayoff} from './build.js';
import {hitFoe, hurtAlly, hurtHero, addZone, addPickup, shock} from './harm.js';
import {landAt} from './shapes.js';
import {unhorse} from './hero.js';
import {HERO, ALLY, PICKUPS, CAMPAIGN, BY} from '../content.js';

export function remember(s, id) { s.last[s.li] = id; s.li = (s.li + 1) & 7; }
export function stepShots(g, dt) {
  const h = g.hero, shots = g.shots, m = g.mods;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (s.dead) continue;
    s.px = s.x; s.py = s.y; s.t += dt;
    if (s.orbit) {
      const P = s.P, ring = P.rings[s.ring], a = s.a0 + ring.speed * g.t, R = ring.radius * m.area;
      s.x = h.x + Math.cos(a) * R; s.y = h.y + Math.sin(a) * R; s.r = P.r * m.area;
      if (g.dark && (s.x - g.dark.x) * (s.x - g.dark.x) + (s.y - g.dark.y) * (s.y - g.dark.y) < g.dark.r * g.dark.r) continue;   // in the umbrella's dark a pearl strikes nothing
      const n = query(s.x, s.y, s.r, Qshot);
      for (let k = 0; k < n; k++) { const f = Qshot[k]; if (f.oh <= 0) { f.oh = P.again; hitFoe(g, f, P.dmg * m.dmg, s.src, P, h.x, h.y, null, false); } }
      continue;
    }
    if (s.side === 'shang') {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) { s.dead = true; continue; }
      const dx = s.x - h.x, dy = s.y - h.y, rr = s.r + HERO.r;
      if (dx * dx + dy * dy <= rr * rr && h.dashT <= 0 && h.fallT <= 0) { hurtHero(g, s.dmg, s.kind, s.x, s.y); s.dead = true; continue; }
      for (let k = 0; k < g.allies.length; k++) {
        const a = g.allies[k];
        if (!a.blocks || a.state === 'dead') continue;
        const ax = s.x - a.x, ay = s.y - a.y, ar = s.r + a.r + 6;
        if (ax * ax + ay * ay <= ar * ar) {
          s.dead = true;
          g.events.push({type: 'block', x: s.x, y: s.y, id: a.id, by: s.kind});
          hurtAlly(g, a, s.dmg * ALLY.shot, s.kind);
          break;
        }
      }
      continue;
    }
    // a thrown thing of the hero's side
    if (g.dark && (s.x - g.dark.x) * (s.x - g.dark.x) + (s.y - g.dark.y) * (s.y - g.dark.y) < g.dark.r * g.dark.r) {
      s.dead = true; g.events.push({type: 'taken', x: s.x, y: s.y, id: s.src, kind: s.kind});       // the umbrella takes it out of the air
      continue;
    }
    if (s.back) {
      const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 26) { s.dead = true; g.events.push({type: 'catch', x: h.x, y: h.y, id: s.src}); continue; }
      s.vx = dx / d * s.speed; s.vy = dy / d * s.speed;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0 && !s.back) {
      if (s.returns) { s.back = true; s.life = 9; }
      else {
        s.dead = true;
        if (s.burst) {
          // a piece of mountain: it bursts where its roll ends
          const B = s.burst, R = B.radius * m.area, c = query(s.x, s.y, R, Qhop);
          g.events.push({type: 'land', id: s.src, x: s.x, y: s.y, radius: R, push: 0});
          for (let q = 0; q < c; q++) hitFoe(g, Qhop[q], B.dmg * s.mul, s.src, B, s.x, s.y, s.el, false);
        }
        continue;
      }
    }
    const n = query(s.x, s.y, s.r, Qshot);
    for (let k = 0; k < n; k++) {
      const f = Qshot[k];
      if (s.back) { if (f.backT <= 0) { f.backT = .35; hitFoe(g, f, s.dmg, s.src, null, s.x, s.y, s.el, false); } continue; }
      const L = s.last;
      if (L[0] === f.id || L[1] === f.id || L[2] === f.id || L[3] === f.id || L[4] === f.id || L[5] === f.id || L[6] === f.id || L[7] === f.id) continue;
      remember(s, f.id);
      hitFoe(g, f, s.dmg, s.src, s.hitP, s.x - s.vx, s.y - s.vy, s.el, false);
      if (s.pierce > 0) { s.pierce--; break; }
      let next = null;
      if (s.bounces > 0) {
        s.bounces--;
        const c = query(s.x, s.y, s.hop, Qhop);
        let bd = Infinity;
        for (let q = 0; q < c; q++) {
          const o = Qhop[q];
          if (o.state === 'dead' || L[0] === o.id || L[1] === o.id || L[2] === o.id || L[3] === o.id || L[4] === o.id || L[5] === o.id || L[6] === o.id || L[7] === o.id) continue;
          const d2 = (o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y);
          if (d2 < bd) { bd = d2; next = o; }
        }
      }
      if (next) {
        const dx = next.x - s.x, dy = next.y - s.y, d = Math.hypot(dx, dy) || 1;
        s.vx = dx / d * s.speed; s.vy = dy / d * s.speed; s.life = Math.max(s.life, .8);
        g.events.push({type: 'bounce', x: s.x, y: s.y, id: s.src});
      } else if (s.returns) { s.back = true; s.life = 9; }
      else s.dead = true;
      break;
    }
  }
}

export function stepZones(g, dt) {
  const h = g.hero, zones = g.zones, count = zones.length;
  g.dark = null;
  for (let i = 0; i < count; i++) {
    const z = zones[i];
    if (z.dead) continue;
    z.t += dt;
    if (z.follow) { z.x = h.x; z.y = h.y; }
    if (z.unit) {
      // it goes with a unit (a general's storm, the rope on a bound foe) and ends with it
      // held by id as well: a unit the pool has given to someone else since is not the one this zone went with
      if (!z.unitId) z.unitId = z.unit.id;
      if (z.unit.id !== z.unitId || z.unit.dead || z.unit.state === 'dead' || z.unit.state === 'away') { z.dead = true; continue; }
      z.x = z.unit.x; z.y = z.unit.y;
    }
    if (z.kind === 'ward') continue;
    if (z.kind === 'fall' || z.kind === 'rain') {
      if (z.t >= z.life) { z.dead = true; landAt(g, z.x, z.y, z.P, z.src, z.level, z.evolved, z.mul, z.el); }
      continue;
    }
    if (z.kind === 'wall' && z.side === 'zhou' && z.t < z.life) {
      // a raised wall: the mass cannot walk through it
      const c = Math.cos(z.dir), sn = Math.sin(z.dir), k = queryLane(z.x, z.y, z.dir, z.len, z.w, Qzone);
      for (let q = 0; q < k; q++) {
        const f = Qzone[q];
        if (f.heavy) continue;
        const off = (f.y - z.y) * c - (f.x - z.x) * sn, push = (z.w / 2 + f.r - Math.abs(off)) * (off >= 0 ? 1 : -1);
        f.x += -sn * push; f.y += c * push;
      }
    }
    if (z.side === 'shang') {
      if (z.kind === 'dark') {
        // the umbrella's darkness: while it lasts the hero's thrown treasures are taken out of the air inside it
        if (z.t >= z.life) z.dead = true; else g.dark = z;
        continue;
      }
      if (z.kind === 'wall') {
        // the golden wall: a ring nobody rides through (the spring passes it)
        if (z.t >= z.life) { z.dead = true; continue; }
        if (h.dashT <= 0 && h.fallT <= 0) {
          const dx = h.x - z.x, dy = h.y - z.y, d = Math.hypot(dx, dy) || 1, inside = d < (z.r0 + z.r) / 2;
          const want = inside ? Math.min(d, z.r0 - HERO.r) : Math.max(d, z.r + HERO.r);
          if (want !== d) { h.x = z.x + dx / d * want; h.y = z.y + dy / d * want; }
        }
        continue;
      }
      if (LASTING.has(z.kind)) { if (z.t >= z.life) z.dead = true; else lasting(g, z, dt); continue; }
      if (z.t < z.life) continue;
      z.dead = true;
      // a level's offer waits until the blow has landed and 0.6 s more (a charge: until it has run)
      if (inZone(z, h.x, h.y, HERO.r + 30)) g.holdT = Math.max(g.holdT, z.kind === 'lane' ? 1.3 : .6);
      if (z.kind !== 'warn') continue;
      const A = z.P;
      if (A && A.shape === 'dark') {
        const dz = addZone(g, 'dark', 'shang', z.src, z.x, z.y, A.radius, A.life);
        dz.unit = z.unit; dz.pattern = A.id;
        g.events.push({type: 'land', id: A.id, shape: 'circle', x: z.x, y: z.y, radius: A.radius, side: 'shang', life: A.life});
        continue;
      }
      if (A && A.shape === 'wall') {
        const wz = addZone(g, 'wall', 'shang', z.src, z.x, z.y, A.r, A.life);
        wz.shape = 'ring'; wz.r0 = A.r0; wz.pattern = A.id;
        g.events.push({type: 'land', id: A.id, shape: 'ring', x: z.x, y: z.y, radius: A.r, inner: A.r0, side: 'shang', life: A.life});
        const sz = addZone(g, 'warn', 'shang', z.src, z.x, z.y, A.slam.radius, A.slam.warn);
        sz.dmg = A.slam.dmg; sz.pattern = A.id + 'Slam'; sz.great = !!A.great;
        g.events.push({type: 'warn', kind: sz.pattern, shape: 'circle', by: z.src, id: 0, time: A.slam.warn, x: z.x, y: z.y, radius: A.slam.radius});
        continue;
      }
      // the warned blow lands: on the hero if he is still on its ground, and on the soldiers who are
      // a great blow throws those round it outward (SPEC-CAMPAIGN.md 1.10); the hero is not thrown by it
      const sh = z.great ? shock(g, z.x, z.y, (z.shape === 'lane' ? z.w : z.r) * CAMPAIGN.shock.blow.reach, CAMPAIGN.shock.blow.strength) : null;
      g.events.push({type: 'land', id: z.pattern || z.src, shape: z.shape, x: z.x, y: z.y, radius: z.r, inner: z.r0, dir: z.dir, length: z.len, width: z.w, angle: z.angle, gap: z.gap, side: 'shang', great: !!z.great, shock: sh});
      const P = z.P;
      if (P && P.leaves) leave(g, z, P.leaves);
      if (!z.dmg) continue;
      if (inZone(z, h.x, h.y, HERO.r * .5) && hurtHero(g, z.dmg, z.src, z.x, z.y, z.pattern || z.src) && P) {
        if (P.unhorse) unhorse(g, P.unhorse, z.src);
        if (P.effect) strike(g, P, z);
      }
      for (const a of g.allies) if (a.state !== 'dead' && a.state !== 'away' && inZone(z, a.x, a.y, 0)) {
        hurtAlly(g, a, z.dmg, z.src);
        if (P && P.effect === 'soul') { soul.push(a.id); a.cd = Math.max(a.cd, P.time); const e = a.kind === 'general' && g.build.generals.find(x => x.id === a.general); if (e) e.skillCd = Math.max(e.skillCd, P.time); }
      }
      if (soul.length) { g.events.push({type: 'soulLost', units: soul.slice(), time: P.time, x: z.x, y: z.y}); soul.length = 0; }
      continue;
    }
    if (z.t >= z.life) { z.dead = true; continue; }
    if (z.spin) z.dir = wrap(z.dir + z.spin * dt);
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick += TICK;
    const n = z.shape === 'lane' ? queryLane(z.x, z.y, z.dir, z.len, z.w, Qzone) : query(z.x, z.y, z.r, Qzone);
    for (let k = 0; k < n; k++) {
      const f = Qzone[k];
      if (z.slow) { f.slow = Math.max(f.slow, z.slow); f.slowT = TICK * 2; }
      if (z.dps) hitFoe(g, f, z.dps * TICK, z.src, null, 0, 0, null, true);
    }
    if (z.chase) {
      // a dome that hunts: toward the nearest foe outside it
      const t = nearestFoe(z.x, z.y, 320);
      if (t) { const dx = t.x - z.x, dy = t.y - z.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, z.chase * TICK); z.x += dx / d * v; z.y += dy / d * v; }
    }
  }
}

// ------------------------------------------------------------------------------------------- the later bosses' marks (SPEC 1.11)
const LASTING = new Set(['fire', 'plague', 'bone', 'wind', 'pillar']), soul = [], ELS = ['wood', 'fire', 'earth', 'metal', 'water'];
/** What a struck hero suffers, by the pattern's `effect`. */
function strike(g, P, z) {
  const h = g.hero;
  if (P.effect === 'bleed') {
    if (h.bleed <= 0) {
      g.events.push({type: 'bleed', dps: P.bleed, by: z.src, x: h.x, y: h.y});
      for (let i = 0; i < 2; i++) { const a = rand(g) * TAU, d = 300 + rand(g) * 200; addPickup(g, 'antidote', h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0); }
    }
    h.bleed = Math.max(h.bleed, P.bleed);
  } else if (P.effect === 'soul' || P.effect === 'dizzy') { h.dizzy = Math.max(h.dizzy, P.time); }
  else if (P.effect === 'dazzle') { h.dazzled = Math.max(h.dazzled, P.time); g.events.push({type: 'dazzle', time: P.time, by: z.src, x: h.x, y: h.y}); }
  else if (P.effect === 'held') { h.held = Math.max(h.held, P.time); g.events.push({type: 'held', time: P.time, by: z.src, how: P.how || 'seize', x: h.x, y: h.y}); }
  else if (P.effect === 'light') {
    const el = ELS[g.lightN++ % ELS.length];
    g.lightTaken[el] = g.t + P.time;
    g.events.push({type: 'lightTaken', element: el, time: P.time, ids: g.build.treasures.filter(t => (BY.treasure[t.id] || {}).element === el).map(t => t.id), x: h.x, y: h.y});
  }
}
/** A blow that leaves something lasting on the ground where it fell. */
function leave(g, z, L) {
  const o = addZone(g, L.kind, 'shang', z.src, z.x, z.y, L.r || z.r, L.life);
  if (z.shape === 'lane') { o.shape = 'lane'; o.dir = z.dir; o.len = z.len; o.w = z.w; }
  o.dmg = (L.dmg || 0) * (z.dmg && z.P && z.P.dmg ? z.dmg / z.P.dmg : 1); o.slow = L.slow || 0; o.hold = L.hold || 0; o.dps = L.push || 0; o.pattern = z.pattern;
  o.P = L;
  g.events.push({type: 'land', id: z.pattern + ':' + L.kind, shape: o.shape, x: o.x, y: o.y, radius: o.r, dir: o.dir, length: o.len, width: o.w, side: 'shang', life: L.life, kind: L.kind});
}
/** Lasting ground of the Shang, each step: fire burns, plague drags and weakens, the bone banner seizes, wind pushes, a fallen beam blocks. */
function lasting(g, z, dt) {
  const h = g.hero, on = h.fallT <= 0 && inZone(z, h.x, h.y, HERO.r * .5);
  if (z.kind === 'fire') {
    z.tick -= dt;
    if (z.tick > 0) return;
    z.tick += .5;
    if (on) hurtHero(g, z.dmg, z.src, z.x, z.y, '');      // lasting ground, not the warned blow itself
    for (const a of g.allies) if (a.state !== 'dead' && a.state !== 'away' && inZone(z, a.x, a.y, 0)) hurtAlly(g, a, z.dmg * .5, z.src);
  } else if (z.kind === 'plague') {
    if (on) { h.drag = Math.min(h.drag, 1 - z.slow); h.dragT = .1; h.weak = Math.max(h.weak, z.P.weak || 0); h.weakT = .1; }
  } else if (z.kind === 'bone') {
    if (on && h.dashT <= 0 && h.held <= 0 && h.boneCd <= 0) {
      h.held = z.hold; h.boneCd = z.hold + 2;
      hurtHero(g, z.dmg, z.src, z.x, z.y, '');
      g.events.push({type: 'held', time: z.hold, by: z.src, how: 'seize', x: h.x, y: h.y});
    }
  } else if (z.kind === 'wind') {
    if (on && h.dashT <= 0) { h.x += Math.cos(z.dir) * z.dps * dt; h.y += Math.sin(z.dir) * z.dps * dt; }
  } else if (z.kind === 'pillar') {
    const R = z.r;
    const out = (u, r) => { const dx = u.x - z.x, dy = u.y - z.y, d = Math.hypot(dx, dy); if (d < R + r) { const k = d > 1e-6 ? (R + r) / d : 0; u.x = d > 1e-6 ? z.x + dx * k : z.x + R + r; u.y = d > 1e-6 ? z.y + dy * k : z.y; } };
    if (h.dashT <= 0) out(h, HERO.r);
    const n = query(z.x, z.y, R, Qzone);
    for (let i = 0; i < n; i++) if (!Qzone[i].heavy) out(Qzone[i], Qzone[i].r);
  }
}

export function stepPickups(g, dt) {
  const h = g.hero, ps = g.pickups, gather = g.mods.gather, g2 = gather * gather;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.dead) continue;
    p.px = p.x; p.py = p.y; p.t += dt;
    const dx = h.x - p.x, dy = h.y - p.y, d2 = dx * dx + dy * dy;
    if (!p.pull && d2 > g2) continue;
    if (h.fallT > 0) continue;
    if (d2 <= HERO.touch * HERO.touch) {
      p.dead = true;
      g.events.push({type: 'pickup', kind: p.kind, size: p.size, value: p.value, x: h.x, y: h.y});
      if (p.kind === 'spirit') { h.xp += p.value * g.mods.spirit; g.stats.spirit += p.value * g.mods.spirit; }
      else if (p.kind === 'peach') mend(g, PICKUPS.peachMend * g.mods.mend);
      else if (p.kind === 'lodestone') { for (const o of ps) if (o.kind === 'spirit') o.pull = true; }
      else if (p.kind === 'chest') { if (p.value !== 2 || !bigPayoff(g, p.x, p.y)) openChest(g, p.x, p.y, p.value === 1); }   // a big boss's chest: a payoff, always (B's bigPayoff)
      else if (p.kind === 'antidote') { if (h.bleed > 0) { h.bleed = 0; g.events.push({type: 'cured', x: h.x, y: h.y}); } }
      continue;
    }
    if ((p.kind === 'chest' || p.kind === 'antidote') && !p.pull) continue;          // a chest is ridden over, not drawn in
    const d = Math.sqrt(d2), v = Math.min(d, (p.pull ? 900 : 560) * dt);
    p.x += dx / d * v; p.y += dy / d * v;
  }
}
