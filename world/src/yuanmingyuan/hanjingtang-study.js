import * as THREE from 'three';
import { namedGroup } from './study-geometry.js';
import { getGardenGroup } from './garden-layout.js';
import { HanjingBuilder, column, dougong, paintedBeam, stoneRail, stairs, hipRoof, xieshanRoof, rolledXieshanRoof, doubleXieshanRoof } from './hanjingtang-architecture.js';
import { hanjingTimberFrame, sanyouMoonScreen, mezzanineTimberFloor } from './hanjingtang-joinery.js';
import { lakeStoneGeometry } from './vegetation-geometry.js';
import { hanjingtangLakeStoneMaterial, hanjingtangStoneSource } from './hanjingtang-rockwork.js';
import { hanjingtangPlan, hanjingtangSources } from './hanjingtang-layout.js';
import { createHanjingtangRubbingMaterials, rubbingPageGeometry, hanjingtangRubbingSources } from './hanjingtang-rubbings.js';

function paveRectangle(b, parent, name, x, z, width, depth, top = .064) {
  const group = namedGroup(parent, name, { body: 'individual-court-stones-over-solid-bedding', evidence: 'authored-paving-joint-layout' });
  b.box(group, b.m.foundation, [x, (top - .188) / 2, z], [width, top + .132, depth]);
  const columns = Math.ceil(width / 1.34), rows = Math.ceil(depth / .88), w = width / columns, d = depth / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    b.box(group, (row * 11 + col * 17) % 19 === 0 ? b.m.foundation : b.m.paving, [x - width / 2 + (col + .5) * w, top - .021, z - depth / 2 + (row + .5) * d], [w - .022, .042, d - .022]);
  }
  return group;
}

function hallPlinth(b, parent, spec) {
  const { id, width, depth, floor } = spec, [w, d] = spec.platform ?? [width + 1.6, depth + 1.6];
  const group = namedGroup(parent, `${id}-plinth`, { body: 'layered-solid-stone-plinth', measuredSpans: spec.platform ?? null, floor });
  b.box(group, b.m.foundation, [0, floor / 2 - .09, 0], [w - .12, floor + .12, d - .12]);
  b.box(group, b.m.stone, [0, floor - .10, 0], [w, .20, d]);
  const run = Math.ceil(floor / .16) * .28, clear = Math.min(4.7, width / spec.bays - .45);
  const front = stairs(b, group, `${id}-front-stair`, 0, d / 2 + run, clear, 0, floor, run);
  const rear = stairs(b, group, `${id}-rear-stair`, 0, d / 2 + run, clear, 0, floor, run); rear.rotation.y = Math.PI;
  group.userData.stairNames = [front.name, rear.name];
  for (const side of [-1, 1]) for (let i = 1; i < Math.ceil(w / 2.2); i++) {
    const x = -w / 2 + i * w / Math.ceil(w / 2.2);
    b.box(group, b.m.foundation, [x, floor * .42, side * (d / 2 + .004)], [.012, Math.max(.10, floor - .24), .01]);
  }
  return group;
}

function buildHall(b, parent, spec) {
  const { id, width, depth, bays, floor, columnHeight } = spec;
  const group = namedGroup(parent, id, { body: 'evidence-linked-hanjingtang-hall', label: spec.name, zone: spec.zone, sourceId: spec.sourceId, spanEvidence: spec.measurements ?? 'authored-proportional', roofType: spec.roof, roofTypeEvidence: spec.roofTypeEvidence ?? 'reported-by-Wang-2015', dimensions: { width, depth, bays, floor, columnHeight } });
  group.position.set(spec.center[0], 0, spec.center[1]); group.rotation.y = spec.rotation ?? 0;
  hallPlinth(b, group, spec);
  hanjingTimberFrame(b, group, `${id}-lower-frame`, { width, depth, bays, floor, columnHeight, sanyou: id === 'hanjingtang-sanyouxuan', open: spec.open });
  let roofY = floor + columnHeight + 1.12, roofWidth = width + 2.4, roofDepth = depth + 2.4;
  if (spec.storeys === 2) {
    const upperFloor = floor + columnHeight + .30, deck = namedGroup(group, `${id}-upper-floor`, { body: 'supported-timber-upper-floor' });
    b.box(deck, b.m.darkWood, [0, upperFloor - .10, 0], [width + .15, .24, depth + .15]);
    const bearing = namedGroup(group, `${id}-upper-floor-bearings`, { body: 'beams-reaching-lower-frame-and-upper-floor' });
    for (const side of [-1, 1]) b.box(bearing, b.m.green, [0, upperFloor - .30, side * depth * .38], [width + .12, .43, .33]);
    const upperWidth = width * .86, upperDepth = depth * .78, upperHeight = columnHeight * .82;
    hipRoof(b, group, `${id}-storey-eaves`, { width: roofWidth, depth: roofDepth, topWidth: upperWidth - .16, topDepth: upperDepth - .16, eaveY: roofY, rise: .83, thickness: .18, cornerLift: .29 }, b.m[spec.tile], { ridge: false });
    hanjingTimberFrame(b, group, `${id}-upper-frame`, { width: upperWidth, depth: upperDepth, bays, floor: upperFloor, columnHeight: upperHeight, upper: true });
    roofY = upperFloor + upperHeight + 1.12; roofWidth = upperWidth + 2.4; roofDepth = upperDepth + 2.4;
  }
  const roofOptions = { width: roofWidth, depth: roofDepth, eaveY: roofY, rise: spec.roofRise };
  if (spec.roof === 'double-xieshan') doubleXieshanRoof(b, group, `${id}-roof`, roofOptions, b.m[spec.tile]);
  else if (spec.roof === 'juanpeng-xieshan') rolledXieshanRoof(b, group, `${id}-roof`, roofOptions, b.m[spec.tile]);
  else xieshanRoof(b, group, `${id}-roof`, roofOptions, b.m[spec.tile]);
  if (spec.mezzanine) chunhuaMezzanine(b, group, spec);
  if (id === 'hanjingtang-sanyouxuan') sanyouInterior(b, group, spec);
  b.buildings.push({ id, name: spec.name, bays, storeys: spec.storeys ?? 1, roof: spec.roof, measurements: spec.measurements ?? null });
  b.flush(); return group;
}

function chunhuaMezzanine(b, parent, spec) {
  const group = namedGroup(parent, 'hanjingtang-chunhua-interior-mezzanine', { body: 'interior-mezzanine-with-central-void-and-two-flight-stair', evidence: 'interior-two-levels-supported; exact-void-stair-and-joinery-proportions-inferred' });
  const level = spec.floor + 4.82, w = spec.width - .72, d = spec.depth - .72;
  const opening = [[-5.9, -5.5], [5.9, -5.5], [5.9, 6.45], [-5.9, 6.45]];
  const stairVoid = [[10.75, 1.55], [14.85, 1.55], [14.85, 7.05], [10.75, 7.05]];
  const floor = namedGroup(group, `${group.name}-floor`, { body: 'solid-floor-with-real-central-and-stair-openings' });
  mezzanineTimberFloor(b, floor, { width: w, depth: d, level, openings: [opening, stairVoid] });
  const posts = namedGroup(group, `${group.name}-bearing-posts`, { body: 'columns-and-beams-meeting-the-mezzanine' });
  for (const x of [-14.8, -6.25, 6.25, 14.8]) for (const z of [-6.1, 6.9]) {
    column(b, posts, x, z, spec.floor, level - spec.floor - .14, .19);
    b.box(posts, b.m.green, [x, level - .27, z], [.64, .31, .62]);
  }
  for (const x of [-6.25, 6.25]) b.box(posts, b.m.green, [x, level - .26, .3], [.42, .34, 13.2]);
  for (const z of [-6.1, 6.9]) b.box(posts, b.m.green, [0, level - .26, z], [w - .22, .34, .42]);
  const rails = namedGroup(group, `${group.name}-open-balustrades`, { body: 'timber-rails-around-actual-floor-void' });
  for (let edge = 0; edge < opening.length; edge++) {
    const a = opening[edge], c = opening[(edge + 1) % opening.length], length = Math.hypot(c[0] - a[0], c[1] - a[1]), count = Math.ceil(length / .90);
    for (let i = 0; i <= count; i++) b.box(rails, b.m.red, [THREE.MathUtils.lerp(a[0], c[0], i / count), level + .46, THREE.MathUtils.lerp(a[1], c[1], i / count)], [.09, .98, .09]);
    for (const y of [.17, .91]) b.rod(rails, b.m.red, [a[0], level + y, a[1]], [c[0], level + y, c[1]], .043, 12);
  }
  const stair = namedGroup(group, `${group.name}-stair`, { body: 'two-connected-timber-flights-with-solid-landing', rise: level - spec.floor, evidence: 'authored-access-interpretation' });
  const half = (level - spec.floor) / 2, count = 15, run = 4.45;
  const stringers = namedGroup(stair, `${stair.name}-sloping-stringers`, { body: 'continuous-timber-stringers-bearing-the-individual-treads' });
  for (const [x, fromZ, toZ, bottom, top] of [[11.10, 6.70, 2.25, spec.floor, spec.floor + half], [12.42, 6.70, 2.25, spec.floor, spec.floor + half], [13.10, 2.25, 6.70, spec.floor + half, level], [14.42, 2.25, 6.70, spec.floor + half, level]]) {
    const from = new THREE.Vector3(x, bottom - .09, fromZ), to = new THREE.Vector3(x, top - .09, toZ), direction = to.clone().sub(from), length = direction.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    b.add(stringers, b.prototype('box', () => new THREE.BoxGeometry()), b.m.darkWood, from.add(to).multiplyScalar(.5).toArray(), [.14, length + .12, .30], rotation);
  }
  for (let i = 0; i < count; i++) {
    const rise = half * (i + 1) / count;
    b.box(stair, b.m.darkWood, [11.76, spec.floor + rise - .055, 6.70 - (i + .5) * run / count], [1.34, .11, run / count + .012]);
    b.box(stair, b.m.red, [11.76, spec.floor + rise - .019, 6.70 - (i + .5) * run / count], [1.38, .038, run / count + .029]);
    const secondRise = half * (i + 1) / count;
    b.box(stair, b.m.darkWood, [13.76, spec.floor + half + secondRise - .055, 2.25 + (i + .5) * run / count], [1.34, .11, run / count + .012]);
    b.box(stair, b.m.red, [13.76, spec.floor + half + secondRise - .019, 2.25 + (i + .5) * run / count], [1.38, .038, run / count + .029]);
  }
  b.box(stair, b.m.darkWood, [12.76, spec.floor + half - .13, 1.95], [3.42, .26, .92]);
  for (const x of [11.12, 14.40]) b.box(stair, b.m.darkWood, [x, spec.floor + half / 2, 1.95], [.14, half, .55]);
  b.box(stair, b.m.darkWood, [13.76, level - .10, 7.09], [1.39, .20, .82]);
  for (const [x, fromZ, toZ, fromY, toY] of [[11.05, 6.70, 2.25, spec.floor, spec.floor + half], [14.47, 2.25, 6.70, spec.floor + half, level]]) {
    b.rod(stair, b.m.red, [x, fromY + .88, fromZ], [x, toY + .88, toZ], .047, 12);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, y = THREE.MathUtils.lerp(fromY, toY, t), z = THREE.MathUtils.lerp(fromZ, toZ, t);
      b.box(stair, b.m.red, [x, y + .44, z], [.075, .88, .075]);
    }
  }
}

function sanyouInterior(b, parent, spec) {
  const group = namedGroup(parent, 'hanjingtang-sanyou-interior', { body: 'west-kang-and-round-screen-east-wood-kang', evidence: 'Hanjingtang-archive-and-excavation-discussed-Wang-2015-p364' });
  for (const [x, y, w, d] of [[-3.85, .48, 2.8, 3.5], [-2.92, .20, .86, 3.5], [3.75, .42, 2.5, 3.3]]) {
    b.box(group, b.m.darkWood, [x, spec.floor + y / 2, -.35], [w, y, d]);
    b.box(group, b.m.red, [x, spec.floor + y + .04, -.35], [w + .06, .08, d + .06]);
  }
  const screen = sanyouMoonScreen(b, group);
  screen.position.set(-1.88, spec.floor, -.3); screen.rotation.y = Math.PI / 2;
}

function inscriptionGalleries(b, parent) {
  const { sides, fromZ, toZ, width, bayCount } = hanjingtangPlan.galleries, length = fromZ - toZ, halfBays = bayCount / 2, bay = length / halfBays;
  const group = namedGroup(parent, 'hanjingtang-chunhua-inscription-galleries', { body: 'two-covered-gallery-walls-with-144-stone-panels', sourceId: 'sun-hanjing-site', sourceImages: hanjingtangRubbingSources.map(source => source.id), originalStoneOrderRecovered: false });
  b.inscriptionMaterials = createHanjingtangRubbingMaterials(b);
  for (const [sideIndex, x] of sides.entries()) {
    const side = sideIndex ? 1 : -1, name = `hanjingtang-${side < 0 ? 'west' : 'east'}-inscription-gallery`;
    const gallery = namedGroup(group, name, { body: 'twelve-bay-inscription-gallery', bays: 12, panelCount: 72 });
    gallery.position.set(x, 0, (fromZ + toZ) / 2); gallery.rotation.y = -side * Math.PI / 2;
    const floor = namedGroup(gallery, `${name}-floor-and-wall`, { body: 'continuous-gallery-floor-and-backed-stone-wall' });
    b.box(floor, b.m.foundation, [0, .41, 0], [length + .55, .82, width + .25]);
    b.box(floor, b.m.stone, [0, .85, 0], [length + .64, .10, width + .34]);
    b.box(floor, b.m.plaster, [0, 2.82, -1.48], [length + .12, 3.84, .24]);
    b.box(floor, b.m.foundation, [0, 1.10, -1.30], [length, .30, .08]);
    const frame = namedGroup(gallery, `${name}-timber-frame`, { body: 'open-gallery-posts-and-brackets' });
    for (let i = 0; i <= halfBays; i++) {
      const dx = -length / 2 + i * bay;
      for (const z of [-1.48, 1.18]) {
        column(b, frame, dx, z, .90, 3.62, .18); dougong(b, frame, [dx, 4.52, z], .83, z > 0 ? 0 : Math.PI);
      }
      if (i < halfBays) paintedBeam(b, frame, [dx, 1.18], [dx + bay, 1.18], 4.27, .39);
    }
    for (const z of [-1.89, 1.59]) b.box(frame, b.m.green, [0, 5.32, z], [length + .40, .22, .26]);
    const stones = namedGroup(gallery, `${name}-marble-inscriptions`, { body: '144-panel-system-half-with-real-historic-letter-forms' });
    for (let i = 0; i < halfBays; i++) for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const index = sideIndex * 72 + i * 6 + row * 3 + col, panel = namedGroup(stones, `${name}-panel-${index + 1}`, { body: 'marble-panel-with-historic-rubbing-derived-intaglio', displayIndex: index + 1, sourceId: hanjingtangRubbingSources[Math.floor(index / 2) % 3].id, repeatedPage: true, mergeIntoParent: true });
      const dx = -length / 2 + i * bay + bay / 2 + (col - 1) * .86, y = 1.96 + row * 1.55;
      b.box(panel, b.m.stone, [dx, y, -1.313], [.82, 1.45, .15]);
      b.box(panel, b.m.carving, [dx, y, -1.23], [.765, 1.37, .022]);
      b.add(panel, rubbingPageGeometry(.735, 1.295, index % 2), b.inscriptionMaterials[Math.floor(index / 2) % 3], [dx, y, -1.212], undefined, undefined, true);
    }
    hipRoof(b, gallery, `${name}-roof`, { width: length + 2.2, depth: 5.1, eaveY: 5.48, rise: 1.70, cornerLift: .22, thickness: .17 }, b.m.greyTile);
    b.flush();
  }
  return group;
}

function gardenRockery(b, parent) {
  const group = namedGroup(parent, 'hanjingtang-scholar-rock-gardens', { body: 'southern-screen-rockery-and-three-sided-sanyou-rockery', evidence: 'rockery-zones-supported; individual-stones-and-assemblage-authored', surfaceSource: hanjingtangStoneSource.url, originalRockIdentitiesRecovered: false });
  const material = b.stoneMaterial;
  // The reviewed geometry is used at its original metre scale. Turns and
  // burial vary the assembly without stretching the 1.5 m texture projection.
  // Four stones still occupy the southern rockery; the inner pair flank a
  // continuous walking lane instead of relying on holes through a rock.
  const locations = [
    [-5.0, 50, .16, .0], [-2.9, 50.2, -.62, .78], [2.9, 50.3, .74, .21], [5.2, 50.0, -1.08, 1.02],
    [-44.0, 12.8, .52, .24], [-43.2, 18.0, -1.12, .94], [-40.4, 23.2, .27, .62], [-34.4, 24.0, -.88, 1.16],
    [-43.1, 5.1, 1.22, .42], [-40.0, -.40, -.25, .15], [-34.4, -1.4, .83, .66],
  ];
  for (const [index, [x, z, angle, burial]] of locations.entries()) {
    const rock = namedGroup(group, `hanjingtang-taihu-rock-${index + 1}`, { body: 'closed-porous-scholar-rock', originalRockIdentity: 'unidentified', unitScale: true, burialMetres: burial, sourceGeometry: 'vegetation.lakeStoneGeometry-R4', reviewPending: true });
    rock.position.set(x, .14 - burial, z); rock.rotation.y = angle;
    b.add(rock, b.prototype('hanjing-reviewed-lake-stone', () => lakeStoneGeometry()), material);
    // Buried mass bears on a below-ground foundation; it is not a hovering
    // shell. The existing court paving and hall plinths are untouched.
    b.box(rock, b.m.foundation, [0, -.10, 0], [2.20, .18, 1.44]);
  }
  return group;
}

function wall(b, parent, name, from, to, height = 3.15) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), group = namedGroup(parent, name, { body: 'white-garden-wall-with-grey-tiled-coping' });
  group.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2); group.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  b.box(group, b.m.foundation, [0, .22, 0], [length, .52, .57]);
  b.box(group, b.m.plaster, [0, (height + .38) / 2, 0], [length, height - .38, .36]);
  b.box(group, b.m.darkTile, [0, height + .015, 0], [length + .06, .12, .62]);
  for (let i = 0; i < Math.ceil(length / .24); i++) {
    const x = -length / 2 + (i + .5) * length / Math.ceil(length / .24);
    b.rod(group, b.m.greyTile, [x, height + .07, -.34], [x, height + .07, .34], .077, 16);
  }
  return group;
}

function entryGates(b, parent) {
  const group = namedGroup(parent, 'hanjingtang-gates-and-boundary', { body: 'five-bay-south-gate-paired-secondary-gates-and-north-entry' });
  const south = namedGroup(group, 'hanjingtang-south-palace-gate', { body: 'five-bay-gate-on-reported-semicircular-platform', sourceId: 'sun-hanjing-site', measuredPlatform: { width: 19.7, height: 1.6 }, depthEvidence: 'inferred' }); south.position.z = 116;
  const radius = 19.7 / 2, outline = [[-radius, -3.8], [radius, -3.8], [radius, 0]];
  for (let i = 1; i <= 48; i++) outline.push([radius * Math.cos(i / 48 * Math.PI), 6.2 * Math.sin(i / 48 * Math.PI)]);
  const platform = namedGroup(south, 'hanjingtang-south-gate-platform', { body: 'closed-semicircular-stone-platform' });
  b.polygon(platform, outline, -.16, 1.43, b.m.foundation); b.polygon(platform, outline, 1.43, 1.60, b.m.stone);
  stairs(b, south, 'hanjingtang-south-gate-front-stairs', 0, 9.0, 5.0, 0, 1.60, 2.8);
  stairs(b, south, 'hanjingtang-south-gate-rear-stairs', 0, 6.6, 5.0, 0, 1.60, 2.8).rotation.y = Math.PI;
  hanjingTimberFrame(b, south, 'hanjingtang-south-gate-frame', { width: 17.8, depth: 5.8, bays: 5, floor: 1.60, columnHeight: 4.20 });
  xieshanRoof(b, south, 'hanjingtang-south-gate-roof', { width: 20.2, depth: 8.2, eaveY: 6.92, rise: 2.85 }, b.m.greenTile);
  for (const side of [-1, 1]) {
    const gate = buildHall(b, group, { id: `hanjingtang-${side < 0 ? 'west' : 'east'}-chuigatemen`, name: '垂花门', zone: 'south-side-entry', center: [side * 28, 117], width: 5.2, depth: 3.0, bays: 1, floor: .48, columnHeight: 3.20, roof: 'juanpeng-xieshan', roofRise: 1.65, tile: 'greenTile', sourceId: 'wang-2015-hanjing-plan' });
    const pendants = namedGroup(gate, `${gate.name}-hanging-flower-columns`, { body: 'suspended-carved-flower-posts-borne-by-roof-beams' });
    for (const x of [-2.35, 2.35]) {
      b.lathe(pendants, b.m.red, [[0, 0], [.14, 0], [.17, .16], [.12, .26], [.11, .60], [0, .60]], [x, 3.27, 1.68], 24);
      b.lathe(pendants, b.m.gold, [[0, 0], [.10, .04], [.19, .13], [.17, .24], [.10, .30], [0, .30]], [x, 3.02, 1.68], 32);
    }
  }
  const north = buildHall(b, group, { id: 'hanjingtang-north-palace-gate', name: '北宫门', zone: 'north', center: [0, -66], width: 10.8, depth: 4.7, bays: 3, floor: .36, columnHeight: 3.70, roof: 'xieshan', roofRise: 2.4, tile: 'greyTile', sourceId: 'wang-2015-hanjing-plan' });
  north.userData.bayCountEvidence = 'inferred';
  wall(b, group, 'hanjingtang-west-boundary', [-47.5, -67], [-47.5, 117]);
  wall(b, group, 'hanjingtang-east-boundary', [47.5, -67], [47.5, 117]);
  for (const side of [-1, 1]) wall(b, group, `hanjingtang-north-wall-${side}`, [side * 5.2, -67], [side * 47.5, -67]);
  for (const [index, [a, c]] of [[-47.5, -31.2], [-24.8, -9.85], [9.85, 24.8], [31.2, 47.5]].entries()) wall(b, group, `hanjingtang-south-wall-${index}`, [a, 117], [c, 117]);
  const screen = namedGroup(group, 'hanjingtang-south-court-spirit-screen', { body: 'freestanding-screen-with-two-flanking-passages', sourceId: 'wang-2015-hanjing-plan' }); screen.position.z = 104;
  b.box(screen, b.m.foundation, [0, .18, 0], [9.4, .42, 1.4]); b.box(screen, b.m.plaster, [0, 2.06, 0], [8.65, 3.7, .48]);
  for (const side of [-1, 1]) {
    b.box(screen, b.m.stone, [0, 2.10, side * .26], [7.92, 2.92, .10]);
    b.box(screen, b.m.carving, [0, 2.10, side * .325], [7.53, 2.54, .08]);
  }
  hipRoof(b, screen, 'hanjingtang-spirit-screen-tiled-cap', { width: 9.55, depth: 1.8, eaveY: 4.0, rise: .64, cornerLift: .12, thickness: .14 }, b.m.greyTile, { rafters: false });
  b.flush(); return group;
}

function outerGlazedPaifang(b, root) {
  const group = namedGroup(root, 'hanjingtang-south-square-three-glazed-paifang', { body: 'south-east-and-west-glazed-archways-around-formal-square', sourceId: 'wang-2015-hanjing-plan', detailEvidence: 'three-glazed-paifang-supported; bay-pattern-roof-profiles-and-glaze-colours-inferred' });
  paveRectangle(b, group, 'hanjingtang-outer-square-cross-path-north-south', 0, 143.2, 5.4, 42.5);
  paveRectangle(b, group, 'hanjingtang-outer-square-cross-path-east-west', 0, 141.0, 61.0, 5.4);
  for (const [index, [x, z, rotation]] of [[0, 164, 0], [-30.5, 141, Math.PI / 2], [30.5, 141, -Math.PI / 2]].entries()) {
    const archway = namedGroup(group, `hanjingtang-glazed-paifang-${index + 1}`, { body: 'glazed-masonry-archway-with-three-open-passages' }); archway.position.set(x, 0, z); archway.rotation.y = rotation;
    for (const [px, height] of [[-6.1, 5.08], [-2.35, 6.04], [2.35, 6.04], [6.1, 5.08]]) {
      b.box(archway, b.m.stone, [px, .23, 0], [1.07, .46, 1.18]);
      b.box(archway, b.m.carving, [px, .58, 0], [.84, .34, .90]);
      b.box(archway, b.m.greenTile, [px, (height + .66) / 2, 0], [.47, height - .66, .54]);
      for (const dy of [.89, height - .28, height]) b.box(archway, b.m.yellowTile, [px, dy, 0], [.61, .17, .69]);
      for (const side of [-1, 1]) b.box(archway, b.m.yellowTile, [px, (height + 1.08) / 2, side * .278], [.25, height - 1.39, .042]);
    }
    for (const [bay, [a, c, y]] of [[-6.1, -2.35, 4.80], [-2.35, 2.35, 5.78], [2.35, 6.1, 4.80]].entries()) {
      b.box(archway, b.m.greenTile, [(a + c) / 2, y, 0], [c - a + .24, .54, .66]);
      for (const side of [-1, 1]) {
        b.box(archway, b.m.yellowTile, [(a + c) / 2, y, side * .355], [c - a - .46, .27, .060]);
        for (let i = 0; i < 7; i++) b.add(archway, b.prototype('paifang-relief-roundel', () => new THREE.TorusGeometry(.072, .014, 8, 24)), b.m.greenTile, [a + .52 + i * (c - a - 1.04) / 6, y, side * .399]);
      }
      const roof = namedGroup(archway, `${archway.name}-bay-roof-${bay}`, { body: 'glazed-roof-unit-borne-by-masonry-lintel' }); roof.position.x = (a + c) / 2;
      hipRoof(b, roof, `${roof.name}-tiles`, { width: c - a + 1.23, depth: 2.25, eaveY: y + .20, rise: .92, cornerLift: .18, thickness: .15 }, b.m.yellowTile, { rafters: false });
    }
  }
  b.flush(); return group;
}

function yunzhenBaosha(b, parent) {
  const group = namedGroup(parent, 'hanjingtang-yunzhen-front-rear-baosha', { body: 'paired-baosha-at-front-and-rear-of-seven-bay-hall', evidence: 'two-baosha-supported; width-height-junction-inferred' });
  for (const side of [-1, 1]) {
    const porch = namedGroup(group, `hanjingtang-yunzhen-${side > 0 ? 'front' : 'rear'}-baosha`, { body: 'open-baosha-with-shared-hall-threshold' }); porch.position.set(0, 0, -37 + side * 6.3);
    b.box(porch, b.m.foundation, [0, .28, 0], [8.2, .72, 4.5]); b.box(porch, b.m.stone, [0, .67, 0], [8.4, .10, 4.6]);
    hanjingTimberFrame(b, porch, `${porch.name}-frame`, { width: 6.9, depth: 3.2, bays: 3, floor: .72, columnHeight: 3.43, open: true });
    xieshanRoof(b, porch, `${porch.name}-roof`, { width: 9.3, depth: 5.6, eaveY: 5.27, rise: 1.65, cornerLift: .17 }, b.m.greenTile);
    const stair = stairs(b, porch, `${porch.name}-stairs`, 0, 3.65, 2.8, 0, .72, 1.35); if (side < 0) stair.rotation.y = Math.PI;
  }
  return group;
}

function courtyards(b, root) {
  const group = namedGroup(root, 'hanjingtang-connected-courtyards', { body: 'south-formal-court-inscription-court-and-north-residential-court' });
  paveRectangle(b, group, 'hanjingtang-south-formal-court', 0, 93, 62, 46);
  paveRectangle(b, group, 'hanjingtang-inscription-court', 0, 42, 40.7, 38);
  paveRectangle(b, group, 'hanjingtang-chunhua-moon-terrace', 0, 23.0, 46.2, 5.7, .90);
  for (const side of [-1, 1]) stairs(b, group, `hanjingtang-moon-terrace-flank-stairs-${side}`, side * 17.1, 28.07, 3.0, .064, .90, 2.22);
  paveRectangle(b, group, 'hanjingtang-north-residential-court', 0, -13.5, 39.5, 26.1);
  paveRectangle(b, group, 'hanjingtang-north-exit-court', 0, -53.5, 38.0, 20.8);
  for (const side of [-1, 1]) {
    paveRectangle(b, group, `hanjingtang-south-flank-path-${side}`, side * 22.2, 69, 4.6, 18.2, .90);
    const southStair = stairs(b, group, `hanjingtang-south-flank-path-stairs-${side}`, 0, 2.52, 3.2, .064, .90, 2.52); southStair.position.set(side * 22.2, 0, 78.1);
    paveRectangle(b, group, `hanjingtang-upper-flank-path-${side}`, side * 19.1, 3.1, 3.2, 42.0, .90);
    const northStair = stairs(b, group, `hanjingtang-upper-flank-path-stairs-${side}`, 0, 2.52, 2.65, .064, .90, 2.52); northStair.position.set(side * 19.1, 0, -17.9); northStair.rotation.y = Math.PI;
  }
  paveRectangle(b, group, 'hanjingtang-sanyou-path', -24.0, 11, 11.6, 2.9, .54);
  const sanyouStair = stairs(b, group, 'hanjingtang-sanyou-to-main-gallery-stairs', 0, .84, 2.45, .54, .90, .84); sanyouStair.position.set(-20.7, 0, 11); sanyouStair.rotation.y = -Math.PI / 2;
  const north = namedGroup(group, 'hanjingtang-north-waterside-approach', { body: 'northern-open-hall-and-stone-water-terrace', evidence: 'Deshenggai-waterside-relation-supported; footprint-and-levels-inferred' });
  paveRectangle(b, north, 'hanjingtang-north-stone-path', 0, -78, 3.8, 21.5);
  b.box(north, b.m.foundation, [0, -.74, -95], [18.6, 2.50, 15.8]); b.box(north, b.m.stone, [0, .43, -95], [18.8, .10, 16.0]);
  buildHall(b, north, { id: 'hanjingtang-deshenggai', name: '得胜概', zone: 'north-water', center: [0, -94], width: 12.6, depth: 5.8, bays: 3, floor: .48, columnHeight: 3.55, roof: 'xieshan', roofRise: 2.55, tile: 'greenTile', open: true, sourceId: 'wang-2015-hanjing-plan' });
  stoneRail(b, north, 'hanjingtang-north-water-rail-west', [-9.25, -102.5], [-2.1, -102.5], .48);
  stoneRail(b, north, 'hanjingtang-north-water-rail-east', [2.1, -102.5], [9.25, -102.5], .48);
  b.flush(); return group;
}

export function createHanjingtangStudy({ stonePixels } = {}) {
  const b = new HanjingBuilder('hanjingtang'), root = new THREE.Group(); root.name = 'yuanmingyuan-hanjingtang-study';
  root.userData = { body: 'hanjingtang-chunhuaxuan-core-study', period: hanjingtangPlan.period, historicReconstructionComplete: false };
  try {
    // Validate prepared pixel ownership before spending time on any building.
    b.stoneMaterial = hanjingtangLakeStoneMaterial(b, stonePixels);
    courtyards(b, root);
    const halls = namedGroup(root, 'hanjingtang-halls-and-private-gardens', { body: 'named-halls-following-three-route-topology' });
    for (const spec of hanjingtangPlan.core) buildHall(b, halls, spec);
    yunzhenBaosha(b, halls); b.flush();
    inscriptionGalleries(b, root);
    gardenRockery(b, root); b.flush();
    entryGates(b, root);
    outerGlazedPaifang(b, root);
    b.flush(); b.releasePrototypes(); root.updateMatrixWorld(true);
    let meshCount = 0, triangleCount = 0; const usedMaterials = new Set();
    root.traverse(node => { if (node.isMesh) { meshCount++; triangleCount += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; usedMaterials.add(node.material); } });
    for (const material of b.materials) if (!usedMaterials.has(material)) { material.dispose(); b.materials.delete(material); }
    const bounds = new THREE.Box3().setFromObject(root), anchor = getGardenGroup('hanjingtang');
    const diagnostics = {
      assetId: 'hanjingtang', meshCount, triangleCount,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() },
      resourceOwnership: { geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, sharedAcrossFactories: false, temporaryGeometryDisposals: b.temporaryDisposals },
      buildings: b.buildings, sources: hanjingtangSources, imageSources: hanjingtangRubbingSources,
      placement: { groupId: 'hanjingtang', globalAnchor: [...anchor.position], localFacing: '+Z south', rootTranslationApplied: false, coordinatesSurveyed: false },
      measurements: { sanyouxuan: { span: [11.1, 7.2], platform: [11.9, 8.3], source: 'Wang 2015 p364 reports local site measurements', approximate: true }, southGatePlatform: { width: 19.7, height: 1.6, source: 'Sun site study reports platform dimensions', originalProfileRecovered: false }, otherBuildingDimensionsSurveyed: false },
      historicalPanelCount: 144, historicalGalleryBayCount: 24, distinctRubbingPageRegions: 6,
      historicOriginalStoneOrderRecovered: false,
      imagesDecoded: b.inscriptionMaterials.every(material => material.userData.imageDecoded),
      stoneSurface: { source: hanjingtangStoneSource.url, license: hanjingtangStoneSource.license, geologicalIdentity: hanjingtangStoneSource.geologicalIdentity, physicalTileMetres: [...hanjingtangStoneSource.tileMetres], geometryScale: 'original unit scale; rotation and burial only', textures: Object.fromEntries(['map', 'normalMap', 'roughnessMap'].map(key => [key, { encodedSha256: b.stoneMaterial[key].userData.encodedSha256, decodedSha256: b.stoneMaterial[key].userData.decodedSha256, width: b.stoneMaterial[key].image.width, height: b.stoneMaterial[key].image.height }])), nativeAcceptance: false },
      landscapeSockets: [
        { kind: 'pine', position: [-40.8, 0, 19.4], source: 'Sanyouxuan exterior pine, bamboo and plum reported' },
        { kind: 'bamboo', position: [-41.6, 0, 1.0], source: 'Sanyouxuan exterior pine, bamboo and plum reported' },
        { kind: 'plum', position: [-30.4, 0, 22.2], source: 'Sanyouxuan exterior pine, bamboo and plum reported' },
      ],
      omitted: ['north-west subsidiary Jinglianzhai/Lixinlou/Daiyuelou/Chengboxizhao group pending its own plan registration', '1814 east-route theatre alterations', 'lake bed, water surface and living vegetation'],
      visualAcceptance: false, integrationAcceptance: false,
    };
    return { group: root, diagnostics, dispose() { b.dispose(); root.clear(); } };
  } catch (error) { b.dispose(); root.clear(); throw error; }
}

export { prepareHanjingtangRubbings } from './hanjingtang-rubbings.js';
export { prepareHanjingtangAssets } from './hanjingtang-rockwork.js';
export { hanjingtangStudyViews } from './hanjingtang-study-views.js';
