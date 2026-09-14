import * as THREE from 'three';
import { namedGroup, extrudedPolygon } from './study-geometry.js';
import { clipPavingCell } from './chinese-architecture-geometry.js';
import { haiyueLayout, haiyuePeriod, haiyueMaterialEvidence, haiyueSources } from './haiyue-layout.js';
import { haiyueCircle, haiyueArcBlockGeometry, haiyueFloorGeometry } from './haiyue-geometry.js';
import { HaiyueBuilder, haiyueColumn, haiyuePaintedBeam, haiyueBracket, haiyueSpandrels, haiyuePanelBay, haiyueRailBay, haiyueStraightRail, haiyueTimberStair, haiyueStoneSteps } from './haiyue-architecture.js';
import { haiyueHipRoof, haiyueGableRoof, haiyueXieshanRoof, haiyueCrossTopRoof } from './haiyue-roofs.js';
export { haiyueViews } from './haiyue-study-views.js';

const sourceIds = ['haiyue-lin-2024', 'haiyue-park-site'];
const rotationPoint = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

function buildTerrace(b, parent, spec) {
  // The core ends inside the masonry, retaining 20 mm of hidden structural
  // overlap. It must never share the stone's visible outside cylinder.
  const masonryDepth = .62, coreRadius = spec.radius - masonryDepth + .02, pavingRadius = spec.radius - .75 - .008;
  const g = namedGroup(parent, `haiyue-${spec.id}-terrace`, { body: 'solid-circular-stone-terrace', sourceIds, support: true, dimensions: spec }), polygon = haiyueCircle(coreRadius, 640);
  b.polygon(g, polygon, spec.bottomY, spec.topY - .04, b.m.foundation);
  const count = Math.ceil(Math.PI * 2 * spec.radius / 1.55), rows = Math.round((spec.topY - spec.bottomY) / .45), h = (spec.topY - spec.bottomY) / rows, angle = Math.PI * 2 / count;
  for (let row = 0; row < rows; row++) {
    const stone = b.proto(`arc-course-${spec.id}-${h}`, () => haiyueArcBlockGeometry({ innerRadius: spec.radius - masonryDepth, outerRadius: spec.radius, height: h - .009, angle: angle - .011 / spec.radius, segments: 10 }));
    for (let i = 0; i < count; i++) {
      const shade = .953 + ((i * 19 + row * 29) % 23) * .0037;
      b.put(g, stone, b.m.stone, [0, spec.bottomY + row * h + .005, 0], [1, 1, 1], [0, angle * (i + (row % 2) * .5), 0], new THREE.Color(shade, shade * .998, shade * .984));
    }
  }
  const cap = b.proto(`arc-cap-${spec.id}`, () => haiyueArcBlockGeometry({ innerRadius: spec.radius - .75, outerRadius: spec.radius + .075, height: .155, angle: angle - .008 / spec.radius, bevel: .020, segments: 12 }));
  for (let i = 0; i < count; i++) b.put(g, cap, b.m.stone, [0, spec.topY - .155, 0], [1, 1, 1], [0, i * angle, 0]);
  const paving = namedGroup(g, `haiyue-${spec.id}-dressed-paving`, { body: 'individual-jointed-stone-paving-clipped-to-circular-edge', support: true });
  const pitchX = 1.26, pitchZ = .84, minR = spec.id === 'lower' ? haiyueLayout.terraces[1].radius - .25 : 0;
  for (let iz = Math.floor(-spec.radius / pitchZ); iz <= Math.ceil(spec.radius / pitchZ); iz++) for (let ix = Math.floor(-spec.radius / pitchX); ix <= Math.ceil(spec.radius / pitchX); ix++) {
    const x = (ix + (iz % 2) * .5) * pitchX, z = iz * pitchZ, minX = x - pitchX / 2 + .007, maxX = x + pitchX / 2 - .007, minZ = z - pitchZ / 2 + .007, maxZ = z + pitchZ / 2 - .007;
    if (Math.hypot(x, z) < minR - .9 || Math.hypot(x, z) > spec.radius + .9) continue;
    const corners = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]], inside = corners.every(p => Math.hypot(...p) < pavingRadius - .001), shade = .945 + ((Math.abs(ix * 29 + iz * 43)) % 29) * .0037, color = new THREE.Color(shade, shade * .993, shade * .975);
    if (inside) b.block(paving, b.m.paving, [x, spec.topY - .032, z], [pitchX - .014, .064, pitchZ - .014], [0, 0, 0], color);
    else {
      const outline = clipPavingCell(haiyueCircle(pavingRadius, 512), minX, maxX, minZ, maxZ); if (outline.length < 3) continue;
      b.put(paving, extrudedPolygon(outline, spec.topY - .065, spec.topY), b.m.paving, [0, 0, 0], [1, 1, 1], [0, 0, 0], color);
    }
  }
  const rails = namedGroup(g, `haiyue-${spec.id}-marble-rails`, { body: 'white-marble-balustrade-with-four-actual-route-gaps', sourceIds, evidence: haiyueMaterialEvidence.stone }), railRadius = spec.radius - .37, gapWidth = spec.id === 'lower' ? haiyueLayout.dock.width + .30 : haiyueLayout.terraceStair.width + .35, cut = Math.asin(gapWidth / (2 * railRadius));
  for (let sector = 0; sector < 4; sector++) {
    const start = sector * Math.PI / 2 + cut, end = (sector + 1) * Math.PI / 2 - cut, n = Math.ceil((end - start) * railRadius / 1.72);
    for (let i = 0; i < n; i++) {
      const a = start + (end - start) * i / n, c = start + (end - start) * (i + 1) / n, from = [Math.sin(a) * railRadius, Math.cos(a) * railRadius], to = [Math.sin(c) * railRadius, Math.cos(c) * railRadius], length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const bay = namedGroup(rails, spec.id === 'upper' && sector === 0 && i === 2 ? 'haiyue-rail-study' : `haiyue-${spec.id}-rail-${sector}-${i}`); bay.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2); bay.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
      haiyueRailBay(b, bay, length, spec.topY, { stone: true, endPost: i === n - 1 });
    }
  }
  return g;
}

function buildDocksAndTerraceStairs(b, parent) {
  const [lower, upper] = haiyueLayout.terraces, ds = haiyueLayout.dock, ts = haiyueLayout.terraceStair;
  for (const dock of haiyueLayout.docks) {
    const group = namedGroup(parent, `haiyue-${dock.id}-dock`, { body: 'cardinal-boat-landing-with-six-stone-treads', sourceIds, support: true, evidence: ds.evidence }); group.rotation.y = dock.rotationY;
    const edge = lower.radius - .03, landingEdge = edge + ds.stairs * ds.pitch, center = landingEdge + ds.landingDepth / 2;
    const coreTop = ds.landingY - .10;
    b.block(group, b.m.foundation, [0, (lower.bottomY + coreTop) / 2, center], [ds.width + .32, coreTop - lower.bottomY, ds.landingDepth]);
    b.block(group, b.m.stone, [0, ds.landingY - .095, center], [ds.width + .4, .19, ds.landingDepth]);
    haiyueStoneSteps(b, group, `haiyue-${dock.id}-landing-stair`, { width: ds.width, edgeZ: edge, bottom: ds.landingY, top: lower.topY, count: ds.stairs, pitch: ds.pitch });
    for (const sign of [-1, 1]) {
      haiyueStraightRail(b, group, [sign * (ds.width / 2 + .08), landingEdge + ds.landingDepth - .14], [sign * (ds.width / 2 + .08), landingEdge], ds.landingY, { stone: true, height: .92 });
      b.rod(group, b.m.stone, [sign * (ds.width / 2 + .12), ds.landingY + .92, landingEdge], [sign * (ds.width / 2 + .12), lower.topY + .92, edge], .070, 16);
    }
    const stair = namedGroup(parent, `haiyue-${dock.id}-terrace-stair`, { body: 'cardinal-upper-terrace-stair', support: true, sourceIds }); stair.rotation.y = dock.rotationY;
    haiyueStoneSteps(b, stair, `haiyue-${dock.id}-twelve-risers`, { width: ts.width, edgeZ: upper.radius - .025, bottom: lower.topY, top: upper.topY, count: ts.count, pitch: ts.pitch });
    for (const side of [-1, 1]) {
      const x = side * (ts.width / 2 + .16), z0 = upper.radius - .025, z1 = z0 + ts.count * ts.pitch;
      b.rod(stair, b.m.stone, [x, upper.topY + .94, z0], [x, lower.topY + .94, z1], .065, 16);
      for (let i = 0; i <= 6; i++) { const t = i / 6, y = upper.topY * (1 - t) + lower.topY * t, z = z0 * (1 - t) + z1 * t; b.block(stair, b.m.stone, [x, y + .46, z], [.15, .92, .15]); }
    }
  }
}

function raisedBase(b, parent, { width, depth, floorY, ground = 2.2, id, stairs = true, baosha = null }) {
  const g = namedGroup(parent, `${id}-stone-platform`, { body: 'continuous-raised-white-stone-platform', support: true });
  const bottom = ground - .05, coreTop = floorY - .10;
  if (baosha) {
    // One joined platform avoids overlapping coplanar caps at the main-hall /
    // annex doorway. Its perimeter is the union of the previous two footprints.
    const outline = padding => {
      const x = (width + padding) / 2, z = (depth + padding) / 2, a = (baosha.width + padding) / 2, front = depth / 2 + baosha.depth + padding / 2;
      return [[-x, -z], [x, -z], [x, z], [a, z], [a, front], [-a, front], [-a, z], [-x, z]];
    };
    b.polygon(g, outline(1.2), bottom, coreTop, b.m.foundation);
    const edge = outline(1.35), bevel = .018;
    const inset = edge.map((p, i) => {
      const before = edge[(i + edge.length - 1) % edge.length], after = edge[(i + 1) % edge.length], a = new THREE.Vector2(p[0] - before[0], p[1] - before[1]).normalize(), c = new THREE.Vector2(after[0] - p[0], after[1] - p[1]).normalize();
      const n0 = new THREE.Vector2(-a.y, a.x), n1 = new THREE.Vector2(-c.y, c.x), offset = n0.clone().add(n1).multiplyScalar(bevel / (1 + n0.dot(n1)));
      return new THREE.Vector2(p[0] + offset.x, -p[1] - offset.y);
    });
    const cap = new THREE.ExtrudeGeometry(new THREE.Shape(inset), { depth: .146, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: bevel, bevelThickness: .012 });
    cap.rotateX(-Math.PI / 2); cap.translate(0, floorY - .158, 0); cap.name = 'haiyue-continuous-hall-and-baosha-stone-cap'; b.put(g, cap, b.m.stone);
  } else {
    b.box(g, b.m.foundation, [0, (bottom + coreTop) / 2, 0], [width + 1.2, coreTop - bottom, depth + 1.2]);
    b.block(g, b.m.stone, [0, floorY - .085, 0], [width + 1.35, .17, depth + 1.35]);
  }
  if (stairs) for (const side of baosha ? [-1] : [-1, 1]) { const step = namedGroup(g, `${id}-${side > 0 ? 'front' : 'back'}-stone-stair`); step.rotation.y = side < 0 ? Math.PI : 0; haiyueStoneSteps(b, step, 'paired-entrance-treads', { width: 3.65, edgeZ: (depth + 1.35) / 2 - .015, bottom: ground, top: floorY, count: 3, pitch: .30 }); }
  return g;
}

export function buildHaiyueMainLevel(b, parent, level, index) {
  const g = namedGroup(parent, `haiyue-main-level-${index + 1}`, { body: 'four-faced-pavilion-frame-with-distinct-inner-room-and-gallery', sourceIds, width: level.width, roomWidth: level.roomWidth, floorY: level.floorY, evidence: haiyueLayout.main.dimensionsEvidence });
  const coords = [-level.width / 2]; for (const bay of level.bays) coords.push(coords.at(-1) + bay);
  const placed = new Set(), outerRadius = index === 0 ? .23 : index === 1 ? .19 : .165, floor = level.floorY;
  for (let face = 0; face < 4; face++) {
    const angle = face * Math.PI / 2;
    for (const x of coords) {
      const p = rotationPoint(x, level.width / 2, angle), key = p.map(v => v.toFixed(6)).join(',');
      if (!placed.has(key)) { haiyueColumn(b, g, ...[p[0], p[1]], floor, level.columnHeight, outerRadius); placed.add(key); }
      haiyueBracket(b, g, p[0], floor + level.columnHeight, p[1], angle, index === 0 ? .89 : .73);
    }
    for (let i = 0; i < coords.length - 1; i++) {
      const a = rotationPoint(coords[i], level.width / 2, angle), c = rotationPoint(coords[i + 1], level.width / 2, angle), span = coords[i + 1] - coords[i];
      haiyuePaintedBeam(b, g, a, c, floor + level.columnHeight - .17, index === 0 ? .44 : .34);
      const spandrel = namedGroup(g, 'haiyue-veranda-carved-flower-board'); spandrel.position.set((a[0] + c[0]) / 2, 0, (a[1] + c[1]) / 2); spandrel.rotation.y = angle; haiyueSpandrels(b, spandrel, span, floor + level.columnHeight - .39);
      if (span > 2.7) haiyueBracket(b, g, (a[0] + c[0]) / 2, floor + level.columnHeight + .005, (a[1] + c[1]) / 2, angle, .63);
    }
    const roomBays = index === 2 ? level.bays : Array(3).fill(level.roomWidth / 3), roomCoords = [-level.roomWidth / 2]; for (const bay of roomBays) roomCoords.push(roomCoords.at(-1) + bay);
    for (let i = 0; i < roomBays.length; i++) {
      const panel = namedGroup(g, `haiyue-level-${index + 1}-face-${face}-lattice-${i}`, { body: index === 2 ? 'upper-floor-window-above-guard-panel' : 'recessed-inner-room-sash-and-door' }), p = rotationPoint((roomCoords[i] + roomCoords[i + 1]) / 2, level.roomWidth / 2 - .08, angle);
      panel.position.set(p[0], 0, p[1]); panel.rotation.y = angle;
      haiyuePanelBay(b, panel, { width: roomBays[i] - outerRadius * 1.8, height: level.columnHeight - .48, floorY: floor, open: index < 2 && i === 1, lowWall: index === 2 ? .72 : 0 });
    }
    if (level.roomWidth < level.width) {
      const inner = [-level.roomWidth / 2, -level.roomWidth / 6, level.roomWidth / 6, level.roomWidth / 2];
      for (const x of inner) { const p = rotationPoint(x, level.roomWidth / 2, angle), key = p.map(v => v.toFixed(6)).join(','); if (!placed.has(key)) { haiyueColumn(b, g, p[0], p[1], floor, level.columnHeight + .10, outerRadius * .93); placed.add(key); } }
      for (let i = 0; i < inner.length - 1; i++) haiyuePaintedBeam(b, g, rotationPoint(inner[i], level.roomWidth / 2, angle), rotationPoint(inner[i + 1], level.roomWidth / 2, angle), floor + level.columnHeight -.14, .34);
      if (index === 1) haiyueStraightRail(b, g, rotationPoint(-level.width / 2, level.width / 2 + .04, angle), rotationPoint(level.width / 2, level.width / 2 + .04, angle), floor, { stone: false, height: 1.03 });
    }
  }
  // Through beams sit at head level above each room. The floor trimmers are
  // separate below the occupied storey and do not close the stairwell.
  for (const x of [-level.roomWidth / 2, level.roomWidth / 2]) b.box(g, b.m.darkWood, [x, floor + level.columnHeight + .10, 0], [.22, .26, level.roomWidth + .2]);
  return g;
}

export function buildHaiyueMain(b, parent) {
  const spec = haiyueLayout.main, g = namedGroup(parent, spec.id, { body: 'late-period-three-storey-four-faced-haiyue', sourceIds, historicalMetricAccuracy: 'not-established' });
  raisedBase(b, g, { width: spec.levels[0].width, depth: spec.levels[0].width, floorY: spec.floorY, id: spec.id, stairs: false });
  for (let face = 0; face < 4; face++) { const step = namedGroup(g, `haiyue-main-ground-stair-${face}`); step.rotation.y = face * Math.PI / 2; haiyueStoneSteps(b, step, 'two-main-platform-risers', { width: 3.65, edgeZ: (spec.levels[0].width + 1.35) / 2 - .015, bottom: 2.2, top: spec.floorY, count: 3, pitch: .29 }); }
  const stairs = namedGroup(g, 'haiyue-main-stairs', { body: 'continuous-west-interior-stair-to-both-upper-floors', sourceIds, evidence: spec.stairwell.evidence });
  for (let level = 0; level < spec.levels.length; level++) {
    const l = spec.levels[level];
    if (level > 0) {
      const floor = namedGroup(g, `haiyue-main-floor-${level + 1}`, { body: 'load-bearing-timber-floor-with-true-stair-opening', support: true, floorY: l.floorY });
      b.put(floor, haiyueFloorGeometry(l.width + .40, l.floorY - .22, l.floorY, spec.stairwell), b.m.darkWood);
      for (const face of [0, 1, 2, 3]) { const angle = face * Math.PI / 2, half = (l.width + .4) / 2, a = rotationPoint(-half, half, angle), c = rotationPoint(half, half, angle); haiyuePaintedBeam(b, floor, a, c, l.floorY - .32, .27, .24); }
      for (const x of [spec.stairwell.minX - .09, spec.stairwell.maxX + .09]) b.box(floor, b.m.darkWood, [x, l.floorY - .23, (spec.stairwell.minZ + spec.stairwell.maxZ) / 2], [.18, .30, spec.stairwell.maxZ - spec.stairwell.minZ + .20]);
      haiyueTimberStair(b, stairs, { bottom: spec.levels[level - 1].floorY, top: l.floorY, well: spec.stairwell, count: spec.stairwell.flightCounts[level - 1], id: `haiyue-stair-to-floor-${level + 1}` });
      const w = spec.stairwell;
      for (const xx of [w.minX - .045, w.maxX + .045]) haiyueStraightRail(b, floor, [xx, w.minZ], [xx, w.maxZ], l.floorY, { stone: false, height: .96 });
      haiyueStraightRail(b, floor, [w.minX - .045, w.minZ], [w.maxX + .045, w.minZ], l.floorY, { stone: false, height: .96 });
    }
    buildHaiyueMainLevel(b, g, l, level);
  }
  const [lower, middle, upper] = spec.levels;
  haiyueHipRoof(b, g, 'haiyue-main-first-eave', { width: 18.0, depth: 18.0, topWidth: 11.82, topDepth: 11.82, eaveY: lower.floorY + lower.columnHeight + .78, rise: 1.17, cornerLift: .31 }, { hasRidge: false });
  haiyueHipRoof(b, g, 'haiyue-main-second-eave', { width: 14.0, depth: 14.0, topWidth: 8.73, topDepth: 8.73, eaveY: middle.floorY + middle.columnHeight + .78, rise: 1.13, cornerLift: .29 }, { hasRidge: false });
  haiyueCrossTopRoof(b, g, { eaveY: upper.floorY + upper.columnHeight + .69 });
  b.buildings.push({ id: spec.id, levels: 3, exteriorBays: [5, 3, 3], baosha: 0, roof: 'cross-ridge' }); return g;
}

function hallFrame(b, parent, spec, { annex = false } = {}) {
  const g = namedGroup(parent, `${spec.id}-joinery`, { body: 'open-circumferential-gallery-and-recessed-passing-hall', sourceIds }), bay = spec.width / spec.bays, floor = spec.floorY;
  for (const side of [-1, 1]) {
    for (let i = 0; i <= spec.bays; i++) {
      const x = -spec.width / 2 + i * bay; haiyueColumn(b, g, x, side * spec.depth / 2, floor, spec.columnHeight, .21); haiyueBracket(b, g, x, floor + spec.columnHeight, side * spec.depth / 2, side > 0 ? 0 : Math.PI, .77);
    }
    for (let i = 0; i < spec.bays; i++) {
      const x0 = -spec.width / 2 + i * bay, x1 = x0 + bay, x = (x0 + x1) / 2;
      haiyuePaintedBeam(b, g, [x0, side * spec.depth / 2], [x1, side * spec.depth / 2], floor + spec.columnHeight - .15, .40);
      const sp = namedGroup(g, `${spec.id}-open-gallery-flower-board`); sp.position.set(x, 0, side * spec.depth / 2); sp.rotation.y = side > 0 ? 0 : Math.PI; haiyueSpandrels(b, sp, bay, floor + spec.columnHeight - .38);
      if ((annex && side < 0) || (spec.baosha && side > 0 && Math.abs(x) < spec.baosha.width / 2)) continue;
      const roomHalf = spec.width / 2 - (annex ? .08 : 1.02), left = Math.max(x0, -roomHalf + .09), right = Math.min(x1, roomHalf - .09);
      if (right - left < .45) continue;
      const panel = namedGroup(g, `${spec.id}-${side > 0 ? 'front' : 'rear'}-sash-${i}`, { body: 'recessed-lattice-door-and-window' }); panel.position.set((left + right) / 2, 0, side * (spec.depth / 2 - (annex ? .12 : spec.galleryDepth))); panel.rotation.y = side > 0 ? 0 : Math.PI;
      haiyuePanelBay(b, panel, { width: right - left - .39, height: spec.columnHeight - .45, floorY: floor, open: i === Math.floor(spec.bays / 2) });
    }
  }
  for (const side of [-1, 1]) {
    const x = side * (spec.width / 2 - (annex ? .08 : 1.02)), depth = spec.depth - (annex ? .06 : spec.galleryDepth * 2);
    b.block(g, b.m.stone, [x, floor + .21, 0], [.21, .42, depth]);
    b.box(g, b.m.plaster, [x, floor + (spec.columnHeight - .48) / 2 + .35, 0], [.18, spec.columnHeight - 1.15, depth]);
    haiyuePaintedBeam(b, g, [side * spec.width / 2, -spec.depth / 2], [side * spec.width / 2, spec.depth / 2], floor + spec.columnHeight - .17, .40);
  }
  return g;
}

export function buildHaiyueHall(b, parent, spec) {
  const g = namedGroup(parent, `haiyue-${spec.id}`, { body: 'late-period-haiyue-side-hall', title: spec.title, sourceIds, evidence: haiyueLayout.hallEvidence }); g.position.set(spec.center[0], 0, spec.center[1]); g.rotation.y = spec.rotationY;
  raisedBase(b, g, { ...spec, id: spec.id }); hallFrame(b, g, spec);
  const eaveY = spec.floorY + spec.columnHeight + .76;
  haiyueHipRoof(b, g, `${spec.id}-lower-eave`, { width: spec.width + 2.1, depth: spec.depth + 2.0, topWidth: spec.width - .9, topDepth: spec.depth - 1.8, eaveY, rise: .69, cornerLift: .29 }, { hasRidge: false });
  const clerestory = namedGroup(g, `${spec.id}-upper-frieze`, { body: 'short-red-upper-roof-support-and-painted-floral-band' });
  for (const side of [-1, 1]) {
    b.box(clerestory, b.m.redWall, [0, eaveY + 1.0, side * (spec.depth - 2.0) / 2], [spec.width - 1.1, .70, .15]);
    haiyuePaintedBeam(b, clerestory, [-(spec.width - 1.1) / 2, side * (spec.depth - 2) / 2], [(spec.width - 1.1) / 2, side * (spec.depth - 2) / 2], eaveY + 1.28, .23);
  }
  for (const side of [-1, 1]) b.box(clerestory, b.m.redWall, [side * (spec.width - 1.1) / 2, eaveY + 1.0, 0], [.16, .70, spec.depth - 2]);
  haiyueXieshanRoof(b, g, `${spec.id}-upper-xieshan`, { width: spec.width + .20, depth: spec.depth + .20, eaveY: eaveY + 1.48, rise: 2.25, cornerLift: .27 });
  if (spec.baosha) {
    const a = spec.baosha, child = { ...spec, id: `${spec.id}-three-bay-baosha`, width: a.width, depth: a.depth, bays: a.bays, baosha: null, galleryDepth: .12, columnHeight: 4.12 }, annex = namedGroup(g, `haiyue-${child.id}`, { body: 'three-bay-projection-with-open-main-hall-interface', evidence: a.evidence }); annex.position.z = spec.depth / 2 + a.depth / 2;
    // The main raisedBase already includes the complete annex footprint.
    hallFrame(b, annex, child, { annex: true });
    const roof = namedGroup(annex, `${child.id}-transverse-roof`); roof.rotation.y = Math.PI / 2;
    // The short ridge lies along the projecting axis. A broad, authored hip
    // skirt leaves three bays visible and fits beneath the main upper eave.
    const width = a.depth + 1.35, depth = a.width + 1.25, topWidth = 2.1, topDepth = depth * .56, y = child.floorY + child.columnHeight + .48;
    haiyueHipRoof(b, roof, `${child.id}-hip-skirt`, { width, depth, topWidth, topDepth, eaveY: y, rise: .66, cornerLift: .28 }, { hasRidge: false });
    // The gabled cap is constructed independently of the narrow skirt formula.
    // It shares the skirt opening and does not duplicate two crossing roofs.
    haiyueGableRoof(b, roof, `${child.id}-gable-cap`, { width: topWidth, depth: topDepth, eaveY: y + .668, rise: 1.30 });
    haiyueStoneSteps(b, annex, `${child.id}-front-stair`, { width: 3.55, edgeZ: (a.depth + 1.35) / 2 -.015, bottom: 2.2, top: spec.floorY, count: 3, pitch: .30 });
  }
  b.buildings.push({ id: `haiyue-${spec.id}`, bays: spec.bays, baoshaBays: spec.baosha?.bays ?? 0, roof: 'double-eave-xieshan', evidence: spec.baosha ? 'modern-late-period-figure-14' : 'explicitly-inferred-from-figure-15' }); return g;
}

export function createHaiyueStudy({ components = null } = {}) {
  const valid = new Set(['terraces', 'main', ...haiyueLayout.halls.map(h => h.id)]);
  if (components !== null && (!Array.isArray(components) || !components.length || components.some(c => !valid.has(c)))) throw new Error('Unknown or empty Haiyue component selection.');
  const selected = components ? new Set(components) : valid, b = new HaiyueBuilder(), group = new THREE.Group(); group.name = 'haiyue-kaijin-late-period-study'; group.userData = { sourceIds, period: haiyuePeriod.target, metricAccuracy: 'not-established' };
  try {
    if (selected.has('terraces')) { for (const terrace of haiyueLayout.terraces) buildTerrace(b, group, terrace); buildDocksAndTerraceStairs(b, group); }
    if (selected.has('main')) buildHaiyueMain(b, group);
    for (const hall of haiyueLayout.halls) if (selected.has(hall.id)) buildHaiyueHall(b, group, hall);
    b.flush(); group.updateMatrixWorld(true);
    let meshes = 0, instances = 0, nominalTriangles = 0, geometryBytes = 0, storedTriangles = 0, instanceBytes = 0;
    group.traverse(o => { if (!o.isMesh) return; meshes++; const n = o.isInstancedMesh ? o.count : 1; instances += n; nominalTriangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * n; if (o.instanceMatrix) instanceBytes += o.instanceMatrix.array.byteLength; if (o.instanceColor) instanceBytes += o.instanceColor.array.byteLength; });
    for (const geo of b.geometries) { storedTriangles += (geo.index?.count ?? geo.attributes.position.count) / 3; for (const a of Object.values(geo.attributes)) geometryBytes += a.array.byteLength; if (geo.index) geometryBytes += geo.index.array.byteLength; }
    const bounds = new THREE.Box3().setFromObject(group), diagnostics = { period: haiyuePeriod, buildings: b.buildings, metrics: { meshes, instances, storedTriangles, nominalTriangles, geometryBytes, instanceBytes, geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size }, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, historicalMetricAccuracy: 'not-established', materialEvidence: haiyueMaterialEvidence, sourceUrls: Object.values(haiyueSources).map(s => s.url), fullFactory: components === null };
    return { group, groundY: selected.has('terraces') ? haiyueLayout.groundY : 2.2, waterline: haiyueLayout.waterline, diagnostics, resources: { geometries: b.geometries, materials: b.materials, textures: b.textures, instances: b.instances }, dispose: () => { b.dispose(); group.clear(); } };
  } catch (e) { b.dispose(); throw e; }
}
