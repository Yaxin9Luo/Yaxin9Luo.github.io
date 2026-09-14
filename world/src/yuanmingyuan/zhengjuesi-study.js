import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { ZhengjuesiBuilder, zhengjuesiColumn, zhengjuesiPaintedBeam, zhengjuesiCorbels, zhengjuesiDougong, zhengjuesiPanelBay, zhengjuesiSash, zhengjuesiPlinth, zhengjuesiStairs, zhengjuesiStoneRail } from './zhengjuesi-architecture.js';
import { zhengjuesiHipRoof, zhengjuesiXieshanRoof, zhengjuesiGableRoof, zhengjuesiOctagonalRoof } from './zhengjuesi-roofs.js';
import { zhengjuesiArchedWallGeometry, zhengjuesiArchSurroundGeometry, zhengjuesiArchDoorGeometry, zhengjuesiLotusReliefPetalGeometry, octagonPoint } from './zhengjuesi-geometry.js';
import { roofTileRollGeometry } from './chinese-architecture-geometry.js';
import { zhengjuesiPlan, allZhengjuesiBuildings, zhengjuesiBuildingFootprint, zhengjuesiSources } from './zhengjuesi-layout.js';
export { zhengjuesiViews } from './zhengjuesi-study-views.js';

function rectangle(w, d) { return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]; }
function buildingGroup(parent, spec) {
  const g = namedGroup(parent, spec.id, { body: 'source-linked-zhengjuesi-building', label: spec.name, sourceIds: spec.sourceIds, roof: spec.roof, roofEvidence: spec.roofEvidence, dimensions: { width: spec.width, depth: spec.depth, floor: spec.floor, bays: spec.bays }, dimensionEvidence: spec.dimensionEvidence });
  g.position.set(spec.center[0], 0, spec.center[1]); g.rotation.y = spec.rotation ?? 0; return g;
}

export function buildZhengjuesiTimberFrame(b, parent, spec, { floor = spec.floor, height = spec.columnHeight, upper = false } = {}) {
  const group = namedGroup(parent, `${spec.id}-${upper ? 'upper' : 'lower'}-timber-frame`, { body: 'separate-columns-through-beams-and-purlins', sourceIds: spec.sourceIds });
  const { width, depth, bays } = spec, bay = width / bays, radius = spec.kind === 'monk-room' ? .13 : width > 25 ? .30 : .23;
  const hasDougong = spec.roof !== 'yingshan' && spec.kind !== 'monk-room', headerY = floor + height - .22;
  for (const side of [-1, 1]) {
    for (let i = 0; i <= bays; i++) {
      const x = -width / 2 + i * bay;
      zhengjuesiColumn(b, group, x, side * depth / 2, floor, height, radius);
      if (hasDougong) zhengjuesiDougong(b, group, x, floor + height + .04, side * depth / 2, side > 0 ? 0 : Math.PI, width > 25 ? 1 : .85);
    }
    for (let i = 0; i < bays; i++) {
      const x0 = -width / 2 + i * bay, x1 = x0 + bay;
      zhengjuesiPaintedBeam(b, group, [x0, side * depth / 2], [x1, side * depth / 2], headerY, upper ? .38 : .48);
      if (hasDougong) zhengjuesiDougong(b, group, (x0 + x1) / 2, floor + height + .04, side * depth / 2, side > 0 ? 0 : Math.PI, .74);
      const central = i === Math.floor(bays / 2), rearAnnexOpening = spec.rearAnnex && side < 0 && Math.abs((x0 + x1) / 2) < spec.rearAnnex.width / 2;
      if (rearAnnexOpening) continue;
      const panel = namedGroup(group, `${spec.id}-${upper ? 'upper' : 'lower'}-${side > 0 ? 'south' : 'north'}-bay-${i + 1}`, { body: 'recessed-real-lattice-joinery', sourceIds: spec.sourceIds });
      const setback = upper || spec.kind === 'monk-room' ? .22 : spec.galleryDepth ?? (spec.id.includes('wufodian') || spec.id.includes('peidian') ? .90 : .22);
      panel.position.set((x0 + x1) / 2, 0, side * (depth / 2 - setback)); if (side < 0) panel.rotation.y = Math.PI;
      panel.userData.galleryDepth = setback;
      zhengjuesiPanelBay(b, panel, { width: bay - radius * 1.9, height: height - .48, floor: floor + (upper ? .40 : 0), open: !upper && central, leaves: spec.kind === 'monk-room' ? 2 : 4, pitch: spec.kind === 'monk-room' ? .32 : .24, prefix: panel.name });
      if (upper) b.box(panel, b.m.red, [0, floor + .20, 0], [bay - radius, .40, .16]);
    }
  }
  const sideMaterial = spec.kind === 'monk-room' ? b.m.plaster : b.m.redWall;
  for (const side of [-1, 1]) {
    if (spec.roof !== 'yingshan') b.box(group, sideMaterial, [side * (width / 2 - .16), floor + (height - .28) / 2, 0], [.33, height - .28, depth - .30]);
    b.block(group, b.m.foundation, [side * width / 2, floor + .32, 0], [.35, .64, depth + .03]);
    zhengjuesiPaintedBeam(b, group, [side * width / 2, -depth / 2], [side * width / 2, depth / 2], headerY, .44);
  }
  // The row of through-beams reaches the front and rear columns. Inner posts
  // support the larger halls without populating every grid intersection.
  for (let i = 0; i <= bays; i++) {
    const x = -width / 2 + i * bay;
    b.box(group, b.m.darkWood, [x, floor + height + .065, 0], [.24, .31, depth + .48]);
    if (!upper && spec.depthBays >= 3 && i > 0 && i < bays && i % 2 === 1) for (const z of [-depth * .24, depth * .24]) {
      zhengjuesiColumn(b, group, x, z, floor, height + .15, radius * 1.14);
      b.box(group, b.m.green, [x, floor + height + .18, z], [.65, .21, .58]);
    }
  }
  for (const z of [-depth * .24, 0, depth * .24]) b.rod(group, b.m.darkWood, [-width / 2 - .18, floor + height + .30, z], [width / 2 + .18, floor + height + .30, z], .15, 16);
  return group;
}

function upperFloorAndStair(b, parent, spec) {
  const level = spec.floor + spec.floorLevel, group = namedGroup(parent, `${spec.id}-upper-floor-and-stair`, { body: 'real-floor-void-and-two-flight-timber-stair', support: true, upperFloorY: level, evidence: 'two-storey building supported; stair placement interpreted' });
  const stairHole = [[10.95, -1.8], [14.5, -1.8], [14.5, 4.8], [10.95, 4.8]];
  b.polygon(group, rectangle(spec.width - .30, spec.depth - .30), level - .20, level, b.m.darkWood, [stairHole.reverse()]);
  for (let x = -spec.width / 2 + .7; x < spec.width / 2; x += .65) {
    if (x > 10.7) continue;
    b.box(group, b.m.darkWood, [x, level - .32, 0], [.12, .27, spec.depth - .25]);
  }
  for (const x of [10.84, 14.57]) b.box(group, b.m.darkWood, [x, level - .24, 1.45], [.20, .32, 6.75]);
  const count = 13, rise = spec.floorLevel / 2 / count, run = 4.2, pitch = run / count;
  for (let i = 0; i < count; i++) {
    b.box(group, b.m.darkWood, [11.72, spec.floor + (i + 1) * rise - .055, 4.2 - (i + .5) * pitch], [1.30, .11, pitch + .025]);
    b.box(group, b.m.darkWood, [13.74, spec.floor + spec.floorLevel / 2 + (i + 1) * rise - .055, (i + .5) * pitch], [1.30, .11, pitch + .025]);
  }
  for (const [x, y0, y1, z0, z1] of [[11.13, spec.floor, level - spec.floorLevel / 2, 4.2, 0], [12.31, spec.floor, level - spec.floorLevel / 2, 4.2, 0], [13.15, level - spec.floorLevel / 2, level, 0, 4.2], [14.33, level - spec.floorLevel / 2, level, 0, 4.2]]) {
    b.beam(group, b.m.darkWood, [x, y0 - .12, z0], [x, y1 - .12, z1], .14, .24);
    b.rod(group, b.m.red, [x, y0 + .81, z0], [x, y1 + .81, z1], .038, 12);
    for (let i = 0; i <= 8; i++) { const t = i / 8, z = THREE.MathUtils.lerp(z0, z1, t), y = THREE.MathUtils.lerp(y0, y1, t); b.box(group, b.m.red, [x, y + .41, z], [.060, .82, .060]); }
  }
  b.box(group, b.m.darkWood, [12.74, spec.floor + spec.floorLevel / 2 - .10, -.62], [3.35, .20, 1.28]);
  for (const x of [11.12, 14.35]) b.box(group, b.m.darkWood, [x, spec.floor + spec.floorLevel / 4, -.8], [.15, spec.floorLevel / 2, .15]);
  b.box(group, b.m.darkWood, [13.74, level - .10, 4.50], [1.35, .20, .64]);
  const rails = namedGroup(group, `${spec.id}-stair-opening-rails`, { body: 'timber-guardrails-with-clear-upper-exit', exit: { minX: 13.06, maxX: 14.42, z: 4.8 } });
  function landingRail(a, c, floor) {
    const length = Math.hypot(c[0] - a[0], c[1] - a[1]), count = Math.ceil(length / .38);
    for (const height of [.22, .93]) b.rod(rails, b.m.red, [a[0], floor + height, a[1]], [c[0], floor + height, c[1]], height > .5 ? .045 : .029, 12);
    for (let i = 0; i <= count; i++) {
      const t = i / count, x = THREE.MathUtils.lerp(a[0], c[0], t), z = THREE.MathUtils.lerp(a[1], c[1], t), end = i === 0 || i === count;
      b.box(rails, b.m.red, [x, floor + .455, z], [end ? .085 : .042, .91, end ? .085 : .042]);
      if (end) b.block(rails, b.m.red, [x, floor + .96, z], [.105, .065, .105]);
    }
  }
  // The upper flight exits through the south edge; the remaining open edges
  // receive timber rails. These details are contemporary interpretations.
  for (const [a, c] of [
    [[10.89, -1.86], [14.56, -1.86]], [[10.89, -1.86], [10.89, 4.86]],
    [[14.56, -1.86], [14.56, 4.86]], [[10.89, 4.86], [13.00, 4.86]],
  ]) landingRail(a, c, level);
  landingRail([11.065, -1.26], [14.415, -1.26], spec.floor + spec.floorLevel / 2);
  return group;
}

function rearAnnex(b, parent, spec) {
  const a = spec.rearAnnex, child = { ...spec, id: `${spec.id}-rear-baosha`, name: '后三间抱厦', center: [0, -spec.depth / 2 - a.depth / 2], width: a.width, depth: a.depth, bays: a.bays, depthBays: 1, columnHeight: 4.7, roofRise: 2.1, roof: 'xieshan', rearAnnex: null };
  const group = buildingGroup(parent, child);
  // The front of the annex is left open beneath the main roof overlap. A low
  // roof interlocks under that eave; it is not another stacked central pavilion.
  const support = namedGroup(group, `${child.id}-platform`, { body: 'rear-annex-platform-continuous-with-main-hall', support: true });
  b.box(support, b.m.foundation, [0, spec.floor / 2 - .06, 0], [a.width + 1.45, spec.floor - .02, a.depth + .80]);
  // The main cap already covers the join. Terminate the annex cap at its edge
  // with an 8 mm joint instead of layering two horizontal stone faces.
  const capMinZ = -(a.depth + .84) / 2, capMaxZ = (a.depth - 1.5) / 2 - .008;
  b.block(support, b.m.stone, [0, spec.floor - .065, (capMinZ + capMaxZ) / 2], [a.width + 1.5, .13, capMaxZ - capMinZ]);
  const frame = namedGroup(group, `${child.id}-open-joinery`, { body: 'three-bay-annex-with-open-main-hall-connection' });
  const bay = a.width / a.bays;
  for (let i = 0; i <= a.bays; i++) for (const z of [-a.depth / 2, a.depth / 2]) zhengjuesiColumn(b, frame, -a.width / 2 + i * bay, z, spec.floor, child.columnHeight, .21);
  for (let i = 0; i < a.bays; i++) {
    const x0 = -a.width / 2 + i * bay, x1 = x0 + bay;
    for (const z of [-a.depth / 2, a.depth / 2]) zhengjuesiPaintedBeam(b, frame, [x0, z], [x1, z], spec.floor + child.columnHeight - .17, .42);
    const panel = namedGroup(frame, `${child.id}-rear-bay-${i}`, { body: 'rear-lattice-and-axial-door' }); panel.position.set((x0 + x1) / 2, 0, -a.depth / 2); panel.rotation.y = Math.PI;
    zhengjuesiPanelBay(b, panel, { width: bay - .42, height: child.columnHeight - .46, floor: spec.floor, open: i === 1, prefix: panel.name });
  }
  for (const side of [-1, 1]) b.box(frame, b.m.redWall, [side * a.width / 2, spec.floor + child.columnHeight / 2, 0], [.32, child.columnHeight, a.depth]);
  zhengjuesiXieshanRoof(b, group, `${child.id}-lower-joined-roof`, { width: a.width + 1.4, depth: a.depth + 1.2, eaveY: spec.floor + child.columnHeight + .44, rise: child.roofRise });
}

export function buildZhengjuesiHall(b, parent, spec) {
  const group = buildingGroup(parent, spec); zhengjuesiPlinth(b, group, spec); buildZhengjuesiTimberFrame(b, group, spec);
  let roofY = spec.floor + spec.columnHeight + (spec.roof === 'yingshan' ? .41 : .82);
  if (spec.storeys === 2) { upperFloorAndStair(b, group, spec); buildZhengjuesiTimberFrame(b, group, spec, { floor: spec.floor + spec.floorLevel, height: spec.upperHeight, upper: true }); roofY = spec.floor + spec.floorLevel + spec.upperHeight + .42; }
  if (spec.roof === 'yingshan') {
    const ends = namedGroup(group, `${spec.id}-continuous-hard-gable-walls`, { body: 'continuous-masonry-end-walls-from-plinth-through-both-storeys-to-gable' });
    for (const side of [-1, 1]) b.box(ends, spec.kind === 'monk-room' ? b.m.plaster : b.m.redWall, [side * spec.width / 2, (spec.floor + roofY) / 2, 0], [.42, roofY - spec.floor + .06, spec.depth + .05]);
  }
  const options = { width: spec.width + (spec.roof === 'yingshan' ? .28 : 2.20), depth: spec.depth + 2.0, eaveY: roofY, rise: spec.roofRise };
  if (spec.roof === 'wudian') zhengjuesiHipRoof(b, group, `${spec.id}-single-wudian`, options);
  else if (spec.roof === 'yingshan') zhengjuesiGableRoof(b, group, `${spec.id}-hard-gable-roof`, options, { endMaterial: spec.kind === 'monk-room' ? b.m.plaster : b.m.redWall, flushGable: true });
  else zhengjuesiXieshanRoof(b, group, `${spec.id}-single-xieshan`, options);
  if (spec.rearAnnex) rearAnnex(b, group, spec);
  b.buildings.push({ id: spec.id, roof: spec.roof, bays: spec.bays, sourceIds: spec.sourceIds }); b.flush(); return group;
}

function gateNameTranscription(b, parent, y, z) {
  const g = namedGroup(parent, 'zhengjuesi-gate-chinese-transcription', { body: 'known-Chinese-name-in-authored-regular-strokes', originalCalligraphy: false, missingScripts: ['Manchu', 'Tibetan', 'Mongolian'], sourceIds: ['park-zhengjuesi'] });
  b.block(g, b.m.stone, [0, y, z], [3.1, .73, .095]);
  const glyphs = [
    [[[12, 17], [88, 17]], [[52, 17], [52, 85]], [[52, 49], [80, 49]], [[27, 46], [27, 85]], [[10, 85], [90, 85]]],
    [[[24, 10], [29, 22]], [[45, 7], [49, 20]], [[76, 9], [66, 24]], [[16, 43], [16, 32], [83, 32], [83, 43]], [[30, 69], [30, 44], [68, 44], [68, 68]], [[49, 50], [47, 69], [37, 82], [21, 91]], [[56, 70], [56, 85], [60, 91], [82, 91], [87, 77]]],
    [[[25, 23], [79, 23]], [[52, 8], [52, 44]], [[10, 44], [90, 44]], [[11, 61], [90, 61]], [[65, 48], [65, 88], [58, 94], [47, 89]], [[29, 70], [40, 80]]],
  ];
  for (let char = 0; char < glyphs.length; char++) for (const stroke of glyphs[char]) for (let i = 1; i < stroke.length; i++) {
    const p = stroke[i - 1], q = stroke[i];
    b.beam(g, b.m.darkWood, [(char - 1) * .64 + (p[0] - 50) * .0056, y + (50 - p[1]) * .0056, z + .055], [(char - 1) * .64 + (q[0] - 50) * .0056, y + (50 - q[1]) * .0056, z + .055], .025, .014);
  }
}

export function buildZhengjuesiGate(b, parent, spec = zhengjuesiPlan.axis[0]) {
  const group = buildingGroup(parent, spec); zhengjuesiPlinth(b, group, spec);
  const walls = namedGroup(group, `${spec.id}-vaulted-masonry`, { body: 'three-true-stone-arch-bays-central-through-vault', sourceIds: spec.sourceIds });
  const openings = [-1, 0, 1].map(side => ({ x: side * 4.7, radius: side ? 1.13 : 1.4, spring: 2.13 }));
  const g = zhengjuesiArchedWallGeometry({ width: spec.width, height: 4.64, depth: spec.depth, openings }); b.put(walls, g, b.m.redWall, [0, spec.floor, 0]);
  for (const face of [-1, 1]) for (const o of openings) {
    const frame = zhengjuesiArchSurroundGeometry({ radius: o.radius, spring: o.spring, band: .23, depth: .16 });
    b.put(walls, frame, b.m.stone, [o.x, spec.floor, face * (spec.depth / 2 + .035)]);
  }
  for (const o of openings) {
    const central = o.x === 0;
    for (const side of [-1, 1]) {
      const leaf = namedGroup(group, `${spec.id}-${central ? 'central-open' : o.x < 0 ? 'west-closed' : 'east-closed'}-leaf-${side}`, { body: central ? 'arched-hinged-open-timber-door' : 'closed-timber-door-in-recessed-stone-arch' });
      leaf.position.set(o.x + side * o.radius, spec.floor, central ? .55 : .16); if (central) leaf.rotation.y = side * 1.37;
      b.put(leaf, b.proto(`arch-leaf-${o.radius}-${side}`, () => zhengjuesiArchDoorGeometry({ radius: o.radius, spring: o.spring, side })), b.m.red);
      const localX = -side * o.radius / 2;
      for (let yy = .48; yy < 2.7; yy += .34) for (let xx = .19; xx < o.radius - .05; xx += .28) b.put(leaf, b.proto('gate-brass-boss', () => new THREE.SphereGeometry(1, 12, 8)), b.m.brass, [-side * xx, yy, .067], [.030, .030, .015]);
      b.put(leaf, b.proto('door-ring', () => new THREE.TorusGeometry(.095, .012, 8, 28)), b.m.brass, [localX, 1.41, .087]);
    }
  }
  for (const x of [-6.82, -2.34, 2.34, 6.82]) for (const z of [-spec.depth / 2, spec.depth / 2]) zhengjuesiColumn(b, walls, x, z, spec.floor + 4.50, .74, .16);
  for (const side of [-1, 1]) zhengjuesiPaintedBeam(b, walls, [-spec.width / 2, side * spec.depth / 2], [spec.width / 2, side * spec.depth / 2], spec.floor + 4.91, .38);
  gateNameTranscription(b, group, spec.floor + 4.03, spec.depth / 2 + .16);
  zhengjuesiXieshanRoof(b, group, `${spec.id}-grey-xieshan`, { width: spec.width + 1.9, depth: spec.depth + 2.15, eaveY: spec.floor + 5.18, rise: spec.roofRise, cornerLift: .24 });
  b.buildings.push({ id: spec.id, roof: spec.roof, bays: spec.bays, sourceIds: spec.sourceIds }); b.flush(); return group;
}

export function buildZhengjuesiWenshu(b, parent, spec = zhengjuesiPlan.axis[3]) {
  const group = buildingGroup(parent, spec), floor = spec.floor, apothem = spec.wallApothem;
  const platform = namedGroup(group, `${spec.id}-octagonal-stone-platform`, { body: 'solid-octagonal-platform-with-connected-axis-landings', support: true, floor });
  const polygon = a => Array.from({ length: 8 }, (_, face) => { const p = octagonPoint(a, face, 1); return [p.x, p.z]; });
  b.polygon(platform, polygon(apothem + .66), -.08, floor - .12, b.m.foundation);
  b.polygon(platform, polygon(apothem + .72), floor - .16, floor, b.m.stone);
  const frontStair = zhengjuesiStairs(b, platform, `${spec.id}-south-stair`, { width: 3.65, edgeZ: apothem + .72, top: floor });
  const backStair = zhengjuesiStairs(b, platform, `${spec.id}-north-stair`, { width: 3.65, edgeZ: apothem + .72, top: floor }); backStair.rotation.y = Math.PI;
  // Side stairs make the raised north-south stone links and courtyard connected
  // without filling the pavilion floor with a ramp or a fabricated statue.
  for (const side of [-1, 1]) { const s = zhengjuesiStairs(b, platform, `${spec.id}-side-stair-${side}`, { width: 2.4, edgeZ: apothem + .72, top: floor }); s.rotation.y = side * Math.PI / 2; }
  const frame = namedGroup(group, `${spec.id}-no-dougong-frame`, { body: 'eight-sided-column-and-cloud-corbel-frame-without-dougong', noDougong: true, sourceIds: ['qi-zhang-2021', 'park-wenshu-2016'] });
  for (let face = 0; face < 8; face++) {
    const a = octagonPoint(apothem, face, -1), c = octagonPoint(apothem, face, 1), mid = octagonPoint(apothem, face, 0), width = a.distanceTo(c);
    zhengjuesiColumn(b, frame, a.x, a.z, floor, 5.61, .235);
    zhengjuesiPaintedBeam(b, frame, [a.x, a.z], [c.x, c.z], floor + 5.20, .52);
    zhengjuesiCorbels(b, frame, [a.x, a.z], [c.x, c.z], floor + 4.95, .68);
    zhengjuesiPaintedBeam(b, frame, [a.x, a.z], [c.x, c.z], floor + 5.84, .33);
    const facade = namedGroup(frame, `${spec.id}-facet-${face + 1}`, { body: 'eight-sided-red-panel-and-diamond-lattice-facade', opening: face === 0 || face === 4 });
    facade.position.set(mid.x, 0, mid.z); facade.rotation.y = face * Math.PI / 4;
    zhengjuesiPanelBay(b, facade, { width: width - .43, height: 4.60, floor, open: face === 0 || face === 4, leaves: 4, pitch: .20, prefix: facade.name });
    zhengjuesiSash(b, facade, { width: width - .43, height: .38, bottom: floor + 4.43, lowerPanel: .07, pitch: .15 });
    const inner = octagonPoint(3.70, face, -1);
    zhengjuesiColumn(b, frame, inner.x, inner.z, floor, 9.34, .265);
  }
  const lower = { apothem: 6.35, topApothem: 3.95, eaveY: floor + spec.lowerEaveAboveFloor, rise: 1.56, cornerLift: .42, thickness: .16 };
  zhengjuesiOctagonalRoof(b, group, `${spec.id}-lower-eaves`, lower);
  const upperFrame = namedGroup(group, `${spec.id}-upper-octagonal-drum`, { body: 'hollow-clerestory-drum-bearing-the-upper-roof', noDougong: true });
  for (let face = 0; face < 8; face++) {
    const a = octagonPoint(3.70, face, -1), c = octagonPoint(3.70, face, 1), mid = octagonPoint(3.70, face, 0), width = a.distanceTo(c), y = floor + 8.20;
    zhengjuesiPaintedBeam(b, upperFrame, [a.x, a.z], [c.x, c.z], floor + 8.01, .39);
    zhengjuesiPaintedBeam(b, upperFrame, [a.x, a.z], [c.x, c.z], floor + 9.40, .40);
    const faceGroup = namedGroup(upperFrame, `${spec.id}-clerestory-${face + 1}`, { body: 'pierced-diamond-clerestory' }); faceGroup.position.set(mid.x, 0, mid.z); faceGroup.rotation.y = face * Math.PI / 4;
    zhengjuesiSash(b, faceGroup, { width: width - .44, height: .99, bottom: y, lowerPanel: .30, pitch: .21 });
    b.box(faceGroup, b.m.red, [0, floor + 7.66, 0], [width - .38, .58, .15]);
  }
  zhengjuesiOctagonalRoof(b, group, `${spec.id}-upper-crown`, { apothem: 4.92, topApothem: 0, eaveY: floor + spec.upperEaveAboveFloor, rise: 3.20, cornerLift: .31, thickness: .16 });
  group.userData.statue = { modelled: false, reason: zhengjuesiPlan.missingObjects[0].reason, sourceIds: ['cafa-wenshu-2020', 'dpm-zhang-2021'] };
  b.buildings.push({ id: spec.id, roof: spec.roof, bays: 8, noDougong: true, sourceIds: spec.sourceIds }); b.flush(); return group;
}

function buildTower(b, parent, spec) {
  const group = buildingGroup(parent, spec); zhengjuesiPlinth(b, group, spec);
  const frame = namedGroup(group, `${spec.id}-open-timber-frame`, { body: 'open-bell-or-drum-tower' });
  for (const x of [-spec.width / 2, spec.width / 2]) for (const z of [-spec.depth / 2, spec.depth / 2]) zhengjuesiColumn(b, frame, x, z, spec.floor, spec.columnHeight, .22);
  const corners = rectangle(spec.width, spec.depth);
  for (let i = 0; i < 4; i++) { zhengjuesiPaintedBeam(b, frame, corners[i], corners[(i + 1) % 4], spec.floor + spec.columnHeight - .17, .40); zhengjuesiCorbels(b, frame, corners[i], corners[(i + 1) % 4], spec.floor + spec.columnHeight - .45); }
  const instrument = namedGroup(group, `${spec.id}-${spec.kind}`, { body: 'authored-period-instrument-not-an-identified-surviving-object' });
  if (spec.kind === 'bell') {
    b.lathe(instrument, 'hollow-cast-bronze-bell', b.m.brass, [[.95, 0], [1.01, .10], [.97, .22], [.81, .54], [.69, 1.30], [.48, 1.66], [.22, 1.78], [0, 1.79], [0, 1.69], [.20, 1.66], [.40, 1.57], [.59, 1.24], [.70, .52], [.85, .17], [.87, 0], [.95, 0]], [0, spec.floor + .92, 0], [1, 1, 1], 48);
    b.box(instrument, b.m.darkWood, [0, spec.floor + 3.27, 0], [4.5, .31, .33]);
    b.put(instrument, b.proto('bell-hanger', () => new THREE.TorusGeometry(.16, .055, 12, 28)), b.m.brass, [0, spec.floor + 2.85, 0]);
    b.rod(instrument, b.m.brass, [0, spec.floor + 2.85, 0], [0, spec.floor + 3.26, 0], .045, 14);
  } else {
    b.lathe(instrument, 'barrel-drum', b.m.red, [[0, -.66], [.87, -.66], [1.02, -.39], [1.10, 0], [1.02, .39], [.87, .66], [0, .66]], [0, spec.floor + 1.73, 0], [1, 1, 1], 48);
    for (const yy of [-.66, .66]) b.put(instrument, b.proto('drum-skin', () => new THREE.CylinderGeometry(.85, .85, .022, 48)), b.m.drum, [0, spec.floor + 1.73 + yy, 0]);
    for (const x of [-.69, .69]) { b.box(instrument, b.m.darkWood, [x, spec.floor + .48, 0], [.16, .96, 1.5]); b.box(instrument, b.m.darkWood, [x, spec.floor + .92, 0], [.22, .18, 1.6]); }
  }
  zhengjuesiXieshanRoof(b, group, `${spec.id}-roof`, { width: spec.width + 1.7, depth: spec.depth + 1.7, eaveY: spec.floor + spec.columnHeight + .42, rise: spec.roofRise });
  b.buildings.push({ id: spec.id, roof: spec.roof, bays: 1, sourceIds: spec.sourceIds }); b.flush(); return group;
}

function wallRun(b, parent, from, to, height = 2.50, { opening = 0, material = b.m.redWall } = {}) {
  const d = V(to[0] - from[0], 0, to[1] - from[1]), length = d.length(), angle = -Math.atan2(d.z, d.x), g = namedGroup(parent, `${parent.name}-wall-${parent.children.length}`, { body: 'solid-wall-with-real-optional-gateway', support: false });
  g.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2); g.rotation.y = angle;
  const pieces = opening ? [[-(length + opening) / 4, (length - opening) / 2], [(length + opening) / 4, (length - opening) / 2]] : [[0, length]];
  for (const [x, width] of pieces) { b.box(g, material, [x, height / 2, 0], [width, height, .44]); b.block(g, b.m.foundation, [x, .23, 0], [width + .045, .46, .50]); b.block(g, b.m.greyTile, [x, height + .04, 0], [width + .11, .10, .59]); }
  const tile = b.proto('wall-coping-tile', () => roofTileRollGeometry([V(0, 0, -.26), V(0, 0, .26)], .13, .025, 14));
  for (const [x, width] of pieces) for (let i = 0, count = Math.ceil(width / .22); i < count; i++) b.put(g, tile, b.m.greyTile, [x - width / 2 + (i + .5) * width / count, height + .075, 0]);
  if (opening) { for (const x of [-opening / 2, opening / 2]) b.box(g, b.m.red, [x, 1.16, 0], [.14, 2.32, .53]); b.box(g, b.m.darkWood, [0, 2.29, 0], [opening + .3, .17, .58]); }
  return g;
}

function lotusWallRelief(b, parent, x, z, angle = 0) {
  const group = namedGroup(parent, `${parent.name}-lotus-panel-${x}`, { body: 'authored-stone-lotus-relief-on-splayed-entrance-wall', sourceIds: ['wu-zhengjuesi'] }); group.position.set(x, 1.20, z); group.rotation.y = angle;
  b.put(group, b.proto('lotus-oval-panel', () => new THREE.CylinderGeometry(1, 1, .085, 64)), b.m.stone, [0, 0, 0], [1.00, 1, .48], [Math.PI / 2, 0, 0]);
  const petal = b.proto('gate-lotus-petal', () => zhengjuesiLotusReliefPetalGeometry());
  for (const size of [1, .65]) for (let p = 0; p < 9; p++) b.put(group, petal, b.m.stone, [0, 0, .06 + (1 - size) * .035], [size, size, size], [0, 0, p * Math.PI * 2 / 9 + (size === 1 ? 0 : .18)]);
}

function buildWalls(b, parent) {
  const bounds = zhengjuesiPlan.boundary, group = namedGroup(parent, 'zhengjuesi-court-walls', { body: 'separate-historic-enclosure-with-independent-south-and-north-gates' });
  for (const x of [bounds.west, bounds.divisionX, bounds.east]) wallRun(b, group, [x, bounds.north], [x, bounds.south], 2.50, { opening: x === bounds.divisionX ? 2.6 : 0 });
  wallRun(b, group, [bounds.west, bounds.north], [bounds.divisionX, bounds.north], 2.5, { opening: 3.0 });
  wallRun(b, group, [bounds.divisionX, bounds.north], [bounds.east, bounds.north], 2.5);
  const south = namedGroup(parent, 'zhengjuesi-south-wall', { body: 'splayed-south-walls-with-stone-lotus-panels-and-side-gates' });
  for (const side of [-1, 1]) {
    wallRun(b, south, [side * 7.1, 75], [side * 15.0, 80], 2.44);
    wallRun(b, south, [side * 15.0, 80], [side * 32.5, 80], 2.44, { opening: 2.25 });
    wallRun(b, south, [side * 32.5, 75], [side * 32.5, 80], 2.44);
    lotusWallRelief(b, south, side * 11.0, 77.72, -side * Math.atan2(5, 7.9));
  }
  wallRun(b, south, [32.5, 75], [50.5, 75], 2.44);
  // Courtyard partitions terminate at the hall footprint. Side gates remain
  // open, providing a continuous route around the raised main buildings.
  for (const [z, halfWidth] of [[39, 10.4], [0, 15.4]]) for (const side of [-1, 1]) wallRun(b, group, [side * halfWidth, z], [side * 32.5, z], 2.34, { opening: 2.6 });
  b.flush(); return group;
}

function pave(b, parent, name, x, z, width, depth, top = .025, spacing = 1.22) {
  const g = namedGroup(parent, name, { body: 'individual-fine-jointed-grey-court-paving-on-continuous-bed', support: true });
  b.box(g, b.m.foundation, [x, top / 2 - .085, z], [width, top + .13, depth]);
  const columns = Math.ceil(width / spacing), rows = Math.ceil(depth / (spacing * .62)), w = width / columns, d = depth / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) b.block(g, b.m.paving, [x - width / 2 + (col + .5) * w, top - .015, z - depth / 2 + (row + .5) * d], [w - .008, .03, d - .008], undefined, new THREE.Color().setScalar(.967 + ((row * 31 + col * 17) % 17) * .003));
  return g;
}

function buildCourts(b, parent) {
  const g = namedGroup(parent, 'zhengjuesi-continuous-courts', { body: 'flat-courts-linked-by-real-stone-thresholds-and-treads', support: true });
  pave(b, g, 'zhengjuesi-main-court-stones', 0, .5, 64.4, 148.0);
  pave(b, g, 'zhengjuesi-east-court-stones', 41.5, .5, 17.4, 148.0);
  pave(b, g, 'zhengjuesi-south-approach-stones', 0, 86.25, 5.0, 18.5);
  for (const link of zhengjuesiPlan.raisedLinks) {
    const group = pave(b, g, `zhengjuesi-${link.id}`, 0, (link.minZ + link.maxZ) / 2, link.width, link.maxZ - link.minZ + .06, link.y);
    // pave already provides the full-height stone bed beneath these raised links.
    for (const side of [-1, 1]) zhengjuesiStoneRail(b, group, [side * link.width / 2, link.minZ + .9], [side * link.width / 2, link.maxZ - .9], link.y, { height: .79 });
  }
  b.walkways.push({ id: 'south-north-axis', from: [0, 95], to: [0, -74], evidence: 'documented entrance relationship; interpreted local path dimensions' });
  b.flush(); return g;
}

function diagnosticsFor(group, b) {
  group.updateMatrixWorld(true);
  let meshes = 0, transforms = 0, nominalTriangles = 0, geometryBytes = 0, instanceBytes = 0, storedTriangles = 0;
  for (const geometry of b.geometries) { storedTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3; for (const a of Object.values(geometry.attributes)) geometryBytes += a.array.byteLength; if (geometry.index) geometryBytes += geometry.index.array.byteLength; }
  group.traverse(node => { if (!node.isMesh) return; meshes++; const count = node.isInstancedMesh ? node.count : 1; transforms += count; nominalTriangles += count * (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; if (node.instanceMatrix) instanceBytes += node.instanceMatrix.array.byteLength; if (node.instanceColor) instanceBytes += node.instanceColor.array.byteLength; });
  const bounds = new THREE.Box3().setFromObject(group);
  return { buildings: b.buildings, meshCount: meshes, instanceCount: transforms, geometryCount: b.geometries.size, materialCount: b.materials.size, textureCount: b.textures.size, storedTriangles, nominalTriangles, geometryBytes, instanceBytes, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, surveyed: false, sourceIds: zhengjuesiSources.map(s => s.id), missingObjects: zhengjuesiPlan.missingObjects };
}

/** Independent editable architecture. No terrain, vegetation, water, sky or
 * global museum placement is constructed here. `components` supports a bounded
 * native review of the gate or pavilion without constructing the complete site.
 */
export function createZhengjuesiStudy({ components = null, includeCourts = components === null } = {}) {
  if (components) {
    const valid = new Set(allZhengjuesiBuildings.flatMap(spec => [spec.id, spec.id.replace('zhengjuesi-', '')]));
    if (!Array.isArray(components) || !components.length || components.some(id => !valid.has(id))) throw new Error('Unknown or empty Zhengjuesi component selection.');
  }
  const b = new ZhengjuesiBuilder(), group = new THREE.Group(); group.name = 'yuanmingyuan-zhengjuesi-study';
  group.userData = { label: '正觉寺', period: zhengjuesiPlan.period, localCoordinates: zhengjuesiPlan.coordinates, surveyed: false };
  const wanted = components ? new Set(components) : null, selected = spec => !wanted || wanted.has(spec.id) || wanted.has(spec.id.replace('zhengjuesi-', ''));
  try {
    if (includeCourts) { buildCourts(b, group); buildWalls(b, group); }
    for (const spec of zhengjuesiPlan.axis) if (selected(spec)) {
      if (spec.kind === 'arched-masonry-gate') buildZhengjuesiGate(b, group, spec);
      else if (spec.kind === 'octagonal-hall') buildZhengjuesiWenshu(b, group, spec);
      else buildZhengjuesiHall(b, group, spec);
    }
    for (const spec of zhengjuesiPlan.wings) if (selected(spec)) buildZhengjuesiHall(b, group, spec);
    for (const spec of zhengjuesiPlan.towers) if (selected(spec)) buildTower(b, group, spec);
    const monks = namedGroup(group, 'zhengjuesi-monks-court', { body: 'eight-buildings-twenty-two-monk-rooms', exactRoomAllocation: false, sourceIds: ['park-zhengjuesi'] });
    for (const spec of zhengjuesiPlan.monkRooms) if (selected(spec)) buildZhengjuesiHall(b, monks, spec);
    b.flush();
    const diagnostics = diagnosticsFor(group, b), bounds = zhengjuesiPlan.boundary;
    return { group, diagnostics, groundY: 0, resources: { geometries: b.geometries, materials: b.materials, textures: b.textures, instances: b.instances },
      assetCourts: includeCourts ? [{ id: 'zhengjuesi-courts', footprint: [[bounds.west, bounds.north], [bounds.east, bounds.north], [bounds.east, 80], [bounds.west, 80]], rimY: .025, floorY: -.15, evidence: 'local proportional court apron; transform with the placed asset' }] : [],
      buildingFootprints: allZhengjuesiBuildings.filter(selected).map(spec => ({ id: spec.id, polygon: zhengjuesiBuildingFootprint(spec, .2) })),
      dispose() { b.dispose(); group.clear(); },
    };
  } catch (error) { b.dispose(); group.clear(); throw error; }
}
