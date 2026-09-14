import * as THREE from 'three';
import { namedGroup } from './study-geometry.js';
import { jiuzhouPlan } from './jiuzhou-layout.js';
import { jiuzhouRoofSectionPoint, singleJuanpengSection } from './jiuzhou-roof-geometry.js';
import { jiuzhouPlatform, jiuzhouPolygonPlatform, jiuzhouSteps, jiuzhouCloudSteps, jiuzhouColumn, jiuzhouPaintedBeam, buildJiuzhouJoinedRoof, buildSingleJuanpengRoof, buildJiuzhouHipBand, buildJiuzhouPointedXieshan } from './jiuzhou-architecture.js';
import { jiuzhouNineHallFacade, jiuzhouDoorway, jiuzhouZhizhaiWindow, jiuzhouLattice } from './jiuzhou-joinery.js';
import { jiuzhouJoinedHeightAt, jiuzhouRoofHeightAt, jiuzhouPostRow, jiuzhouEaveBearing, jiuzhouRafters, jiuzhouTruss } from './jiuzhou-framing.js';
import { buildJiuzhouLCornerRoof } from './jiuzhou-corner-roof.js';

const rectangle = (w, d, z = 0) => [[-w / 2, z - d / 2], [w / 2, z - d / 2], [w / 2, z + d / 2], [-w / 2, z + d / 2]];
const columnXs = (width, bays) => Array.from({ length: bays + 1 }, (_, i) => -width / 2 + i * width / bays);
const recipe = {
  'jiuzhou-yuanmingyuan-hall': { floor: .72, post: 3.84, rise: 3.35, frontPorch: 1.72, backDoor: true, formal: true },
  'jiuzhou-fengsanwusi': { floor: .78, post: 3.92, rise: 3.60, frontPorch: 1.92, backDoor: true, formal: true },
  'jiuzhou-tongdaotang': { floor: .64, post: 3.65, rise: 2.48, frontPorch: 1.40, backDoor: false, interior: 'audience-hall-facing-stage' },
  'jiuzhou-qinghuitang': { floor: .64, post: 3.60, rise: 2.43, frontPorch: 1.36, backDoor: false },
  'jiuzhou-shendetang': { floor: .74, post: 4.02, rise: 3.40, frontPorch: 1.60, rolls: 3, backDoor: false, interior: 'four-interconnected-front-bays-and-west-performance-area' },
  'jiuzhou-jifutang': { floor: .66, post: 3.64, rise: 2.47, frontPorch: 1.35, backDoor: true, formal: true },
  'jiuzhou-xingcunzai': { floor: .66, post: 3.58, rise: 2.42, frontPorch: 1.35, backDoor: false, green: true },
  'jiuzhou-west-chuantang': { floor: .48, post: 3.36, rise: 1.96, frontPorch: .96, backDoor: true, unpainted: true },
  'jiuzhou-dexinxumiao': { floor: .46, post: 3.16, rise: 1.95, frontPorch: .90, rotation: Math.PI, backDoor: false, garden: true },
  'jiuzhou-zhaoyinjing': { floor: .46, post: 3.12, rise: 2.02, frontPorch: .70, rotation: Math.PI, backDoor: false, garden: true },
  'jiuzhou-qiaobi': { floor: .46, post: 3.12, rise: 2.02, frontPorch: .70, rotation: Math.PI, backDoor: false, garden: true },
  'jiuzhou-tiandiyijiachun': { floor: .70, post: 3.72, rise: 2.85, frontPorch: 1.60, backDoor: true, domestic: true },
  'jiuzhou-tiandi-rear-hall': { floor: .66, post: 3.56, rise: 2.66, frontPorch: 1.36, backDoor: true, backFromY: .45, backRun: .60, domestic: true },
  'jiuzhou-quanshiziyu': { floor: .45, post: 3.12, rise: 1.85, frontPorch: .65, backDoor: false, frontStepXs: [-8.064, 8.064], longResidence: true },
  'jiuzhou-tiandi-palace-gate': { floor: .52, post: 3.38, rise: 2.02, frontPorch: .78, backDoor: true, gate: true },
  'jiuzhou-tiandi-west-wing': { floor: .50, post: 3.18, rise: 1.93, frontPorch: .82, rotation: Math.PI / 2, backDoor: false, domestic: true },
  'jiuzhou-tiandi-east-wing': { floor: .50, post: 3.18, rise: 1.93, frontPorch: .82, rotation: -Math.PI / 2, backDoor: false, domestic: true },
  'jiuzhou-middle-east-front': { floor: .54, post: 3.28, rise: 2.14, frontPorch: .98, backDoor: true, domestic: true },
  'jiuzhou-east-court-front': { floor: .52, post: 3.26, rise: 2.09, frontPorch: .96, backDoor: true, domestic: true },
  'jiuzhou-middle-east-rear': { floor: .54, post: 3.28, rise: 2.35, frontPorch: .96, rolls: 2, backDoor: false, domestic: true },
  'jiuzhou-east-court-rear': { floor: .52, post: 3.26, rise: 2.29, frontPorch: .94, rolls: 2, backDoor: false, domestic: true },
  'jiuzhou-tongdao-dressing': { floor: .672, post: 3.36, rise: 2.20, frontPorch: .78, rolls: 2, backDoor: true, domestic: true },
};

function namedHall(parent, spec, kind) {
  const group = namedGroup(parent, spec.id, { body: kind, label: spec.name, route: spec.route, sourceIds: ['heUpper', 'heMiddle', 'heLower'], roofType: spec.roof, period: jiuzhouPlan.period, dimensionEvidence: spec.evidence, planRegistration: 'modern-research-plan-proportional', originalMeasuredCoordinates: false });
  group.position.set(spec.center[0], 0, spec.center[1]); return group;
}

function facade(b, parent, name, { width, xs, z, floor, height, door = true, manyDoors = false, reverse = false }) {
  const group = namedGroup(parent, name, { body: 'enclosed-door-and-window-facade', exactJoineryPatternRecovered: false }); group.position.z = z; if (reverse) group.rotation.y = Math.PI;
  for (let i = 0; i < xs.length - 1; i++) {
    const x = (xs[i] + xs[i + 1]) / 2, clear = xs[i + 1] - xs[i] - .35;
    const doorway = door && (manyDoors ? i % 3 === 1 : i === Math.floor((xs.length - 1) / 2));
    if (doorway) {
      const leaf = jiuzhouDoorway(b, group, `${name}-door-${i + 1}`, { width: Math.min(clear, 3.7), height, floor, leaves: clear > 2.8 ? 4 : 2, transom: height > 3.8 }); leaf.position.x = x;
    } else {
      const leaf = jiuzhouZhizhaiWindow(b, group, `${name}-window-${i + 1}`, { width: clear - .10, floor: 0, rear: false, kind: 'ordinary' }); leaf.position.set(x, floor, 0); leaf.scale.y = height / 4.36;
    }
  }
  return group;
}

function sideWall(b, parent, name, { x, centerZ = 0, depth, floor, height, doorway = false, doorWidth = null, doorCenter = 0, rotation = Math.PI / 2 }) {
  const group = namedGroup(parent, name, { body: doorway ? 'masonry-side-wall-with-real-door-opening' : 'masonry-side-wall', inferredDetails: true }); group.position.set(x, floor, centerZ); group.rotation.y = rotation;
  const clear = doorWidth ?? Math.min(2.32, depth * .40), doorH = Math.min(3.20, height - .22);
  const spans = doorway ? [[-depth / 2, doorCenter - clear / 2], [doorCenter + clear / 2, depth / 2]] : [[-depth / 2, depth / 2]];
  if (doorway) {
    for (const [a, c] of spans) b.box(group, b.m.plaster, [(a + c) / 2, height / 2, 0], [c - a, height, .30]);
    b.box(group, b.m.plaster, [doorCenter, (doorH + height) / 2, 0], [clear, height - doorH, .30]);
    const door = jiuzhouDoorway(b, group, `${name}-open-side-door`, { width: clear - .14, height: doorH - .05, leaves: 2 }); door.position.x = doorCenter;
  } else b.box(group, b.m.plaster, [0, height / 2, 0], [depth, height, .30]);
  for (const [a, c] of spans) b.box(group, b.m.brick, [(a + c) / 2, .24, .017], [c - a, .48, .32]);
  for (const side of [-1, 1]) {
    b.box(group, b.m.brick, [side * (depth - .14) / 2, height / 2, .018], [.14, height, .34]);
  }
  return group;
}

function platformStairs(b, group, id, { width, depth, floor, back = true, backFromY = .035, backRun = 1.4, frontStepXs = [0] }) {
  jiuzhouPlatform(b, group, `${id}-platform`, width + 1.92, depth + 1.92, floor);
  const run = 1.40, stairWidth = Math.min(3.55, width / 3);
  for (const x of frontStepXs) jiuzhouSteps(b, group, `${id}-front-steps-${x}`, { x, frontZ: depth / 2 + .96 + run, width: frontStepXs.length > 1 ? 1.80 : stairWidth, toY: floor, run });
  if (back) jiuzhouSteps(b, group, `${id}-back-steps`, { frontZ: depth / 2 + .96 + backRun, width: stairWidth, toY: floor, fromY: backFromY, run: backRun, reverse: true });
}

export function buildJiuzhouNineHall(b, parent, { tiles = true } = {}) {
  const spec = jiuzhouPlan.core.find(p => p.id === 'jiuzhou-qingyan-hall'), group = namedHall(parent, spec, 'documented-five-bay-hall-with-1855-three-bay-addition');
  const floor = .704, xs = [-9.76, -5.92, -2.08, 2.08, 5.92, 9.76], goldXs = xs.slice(1, -1);
  // The late platform rooms make the rear platform wider than the three-bay
  // roof. Their outline is a working interpretation; the hall's frontage and
  // platform height retain the published dimensioned controls.
  jiuzhouPolygonPlatform(b, group, `${spec.id}-late-platform`, rectangle(21.568, 19.328, -2.88), floor);
  jiuzhouSteps(b, group, `${spec.id}-front-steps`, { frontZ: 8.184, width: 3.72, toY: floor });
  jiuzhouCloudSteps(b, group, `${spec.id}-north-cloud-step-access`, { frontZ: 13.944, width: 3.4, toY: floor, reverse: true });
  const roof = buildJiuzhouJoinedRoof(b, group, `${spec.id}-roof`, { floor, tiles });
  const heightAt = (x, z) => jiuzhouJoinedHeightAt(roof.section, roof.mainSection, x, z);
  const frame = namedGroup(group, `${spec.id}-timber-frame`, { body: 'measured-column-grid-and-authored-bearing-frame', sharedRearInnerPurlinZ: -3.84 });
  jiuzhouPostRow(b, frame, `${spec.id}-front-eave-row`, { xs, z: 5.76, floor, height: 3.84 });
  jiuzhouEaveBearing(b, frame, `${spec.id}-front-eave-bearings`, { xs, z: 5.76, floor, postHeight: 3.84, roofAt: heightAt });
  for (const z of [-3.84, 3.84]) jiuzhouPostRow(b, frame, `${spec.id}-gold-row-${z}`, { xs: goldXs, z, floor, height: 4.80, radius: .208, rear: z < 0 });
  jiuzhouPostRow(b, frame, `${spec.id}-rear-inner-row`, { xs: goldXs, z: -9.60, floor, height: 4.80, radius: .208, rear: true });
  jiuzhouPostRow(b, frame, `${spec.id}-rear-eave-row`, { xs: goldXs, z: -11.52, floor, height: 3.84, rear: true });
  jiuzhouEaveBearing(b, frame, `${spec.id}-rear-eave-bearings`, { xs: goldXs, z: -11.52, floor, postHeight: 3.84, roofAt: heightAt, rear: true });
  for (const side of [-1, 1]) for (const z of [-5.76, -1.28, 1.28]) jiuzhouColumn(b, frame, `${spec.id}-end-post-${side}-${z}`, side * 9.76, z, floor, 3.84);
  jiuzhouTruss(b, frame, `${spec.id}-main-raised-beams`, { xLines: goldXs, pairs: [[-3.84, 3.84], [-2.112, 2.112], [-.384, .384]], roofAt: heightAt, lowerBearingY: floor + 4.80 + .384, purlinHalfWidth: 8.04 });
  jiuzhouTruss(b, frame, `${spec.id}-rear-raised-beams`, { xLines: [-2.08, 2.08], pairs: [[-9.60, -3.84], [-8.352, -5.088], [-7.104, -6.336]], roofAt: heightAt, lowerBearingY: floor + 4.80 + .384, purlinHalfWidth: 5.72, rear: true, omitPurlinZ: [-3.84] });
  jiuzhouRafters(b, group, `${spec.id}-curved-rafters`, { section: roof.section, width: 22.08, heightAt });
  jiuzhouNineHallFacade(b, group, { floor }); jiuzhouNineHallFacade(b, group, { floor, rear: true });
  for (const side of [-1, 1]) {
    sideWall(b, group, `${spec.id}-${side < 0 ? 'west' : 'east'}-gable-wall`, { x: side * 9.76, centerZ: -.96, depth: 9.60, floor, height: 4.43, doorway: true, doorCenter: side * 3.84, doorWidth: 1.44, rotation: side * Math.PI / 2 });
    const back = jiuzhouZhizhaiWindow(b, group, `${spec.id}-${side < 0 ? 'false-west' : 'east'}-rear-wing-window`, { width: 3.27, floor, rear: true, falseWindow: side < 0 }); back.position.x = side * 7.84; back.position.z = -5.76; back.rotation.y = Math.PI; back.scale.y = .92;
    const additions = namedGroup(group, `${spec.id}-rear-side-window-${side}`, { body: 'two-zhizhai-sections-on-rear-addition-gable', exactUnspecifiedPanePatternsRecovered: false }); additions.position.set(side * 5.92, 0, -6.72); additions.rotation.y = side * Math.PI / 2;
    for (const x of [-1.44, 1.44]) { const window = jiuzhouZhizhaiWindow(b, additions, `${additions.name}-${x}`, { width: 2.60, floor, rear: true }); window.position.x = x; }
    buildJiuzhouFlatRoom(b, group, `${spec.id}-1859-flat-side-room-${side}`, { x: side * 7.84, z: -9.60, width: 3.84, depth: 5.76, floor, roofY: floor + 4.46, frontDoor: false, sideDoor: side, foundation: false });
  }
  sideWall(b, group, `${spec.id}-west-enclosed-back-porch-partition`, { x: -7.84, centerZ: -3.84, depth: 3.84, floor, height: 4.28, doorway: true, doorWidth: 1.60, rotation: 0 });
  sideWall(b, group, `${spec.id}-east-retained-back-porch-partition`, { x: 7.84, centerZ: -3.84, depth: 3.84, floor, height: 4.28, rotation: 0 });
  group.userData.access = { frontDoor: [0, floor, 3.84], westSideDoor: [-9.76, floor, -4.80], sideDoorPositionInferred: true, rearInnerLineIsWindows: true, porchRows: [5.76, -11.52] };
  b.buildings.push({ id: spec.id, roof: spec.roof, bays: 5, rearAdditionBays: 3, floor, columnHeights: [3.84, 4.8], evidence: spec.evidence });
  b.flush(); return group;
}

export function buildJiuzhouFlatRoom(b, parent, name, { x, z, width, depth, floor, roofY, frontDoor = true, sideDoor = 0, foundation = true, bays = 1 }) {
  const group = namedGroup(parent, name, { body: 'late-platform-room-with-inferred-roof-details', source: 'He upper p36: platform-room additions reported in archival research; category has textual evidence', roofComparison: 'He middle p43 fig18-5: modern reconstruction of late Qingyan Hall platform roofs, not a measured detail for every room', exactRoofSectionRecovered: false, roofPitchConstructionDrainageAndCopingInferred: true, exactHeightAndRoofDrainageInferred: true }); group.position.set(x, 0, z);
  if (foundation) jiuzhouPlatform(b, group, `${name}-platform`, width + .44, depth + .40, floor);
  const height = roofY - floor - .23;
  for (const side of [-1, 1]) sideWall(b, group, `${name}-side-${side}`, { x: side * width / 2, depth, floor, height, doorway: sideDoor === side, rotation: side * Math.PI / 2 });
  facade(b, group, `${name}-front`, { width, xs: columnXs(width, bays), z: depth / 2, floor, height, door: frontDoor });
  facade(b, group, `${name}-back`, { width, xs: columnXs(width, bays), z: -depth / 2, floor, height, door: false, reverse: true });
  b.box(group, b.m.darkWood, [0, roofY - .16, 0], [width + .03, .20, depth + .03]);
  b.box(group, b.m.tileShade, [0, roofY - .043, 0], [width + .16, .07, depth + .16]);
  for (const side of [-1, 1]) {
    b.box(group, b.m.brick, [0, roofY + .12, side * depth / 2], [width + .20, .30, .18]);
    b.box(group, b.m.brick, [side * width / 2, roofY + .12, 0], [.18, .30, depth + .20]);
    for (let i = 0; i < Math.ceil(width / .35); i++) b.box(group, b.m.greyTile, [-width / 2 + (i + .5) * width / Math.ceil(width / .35), roofY + .28, side * depth / 2], [width / Math.ceil(width / .35) - .01, .055, .24]);
  }
  return group;
}

export function buildJiuzhouRegularHall(b, parent, spec, { tiles = true } = {}) {
  const p = recipe[spec.id]; if (!p) throw new Error(`No evidence-specific hall recipe for ${spec.id}`);
  const { floor, post, rise } = p, { width, depth, id } = spec, group = namedHall(parent, spec, p.rolls ? 'connected-multi-roll-residential-hall' : p.gate ? 'palace-gate-with-open-central-passage' : 'enclosed-garden-hall'); group.rotation.y = p.rotation ?? 0;
  platformStairs(b, group, id, { width, depth, floor, back: p.backDoor, backFromY: p.backFromY, backRun: p.backRun, frontStepXs: p.frontStepXs });
  const rw = width + 2.32, rd = depth + 2.32, eaveY = floor + post + 1.08, xieshan = spec.roof.includes('xieshan') && !p.rolls;
  let roof, section, heightAt;
  if (spec.roof === 'xieshan') {
    roof = buildJiuzhouPointedXieshan(b, group, `${id}-roof`, { width: rw, depth: rd, eaveY, rise, tiles });
    // A conservative underside for non-juanpeng garden seats. Do not reuse a
    // rounded rafter path under a pointed roof with a different profile.
    heightAt = (x, z) => eaveY + rise * .15; section = null;
  } else {
    roof = buildSingleJuanpengRoof(b, group, `${id}-roof`, { width: rw, depth: rd, eaveY, rise, xieshan, rolls: p.rolls ?? 1, tiles }); section = roof.section;
    heightAt = (x, z) => jiuzhouRoofHeightAt({ section, width: rw, depth: rd, xieshan }, x, z);
    jiuzhouRafters(b, group, `${id}-curved-rafters`, { section, width: rw, heightAt, rear: p.green });
  }
  const xs = id === 'jiuzhou-fengsanwusi' ? [-12.96, -10.08, -6.24, -2.08, 2.08, 6.24, 10.08, 12.96] : columnXs(width, spec.bays), innerZ = depth / 2 - p.frontPorch;
  const frame = namedGroup(group, `${id}-timber-frame`, { body: 'source-relative-post-grid-and-bearing-beams', measuredGrid: false });
  for (const side of [-1, 1]) {
    jiuzhouPostRow(b, frame, `${id}-eave-row-${side}`, { xs, z: side * depth / 2, floor, height: post, rear: p.green });
    if (section) jiuzhouEaveBearing(b, frame, `${id}-eave-bearings-${side}`, { xs, z: side * depth / 2, floor, postHeight: post, roofAt: heightAt, rear: p.green });
  }
  const joineryH = post + .53;
  facade(b, group, `${id}-front-facade`, { width, xs, z: innerZ, floor, height: joineryH, door: true, manyDoors: p.longResidence });
  facade(b, group, `${id}-back-facade`, { width, xs, z: -innerZ, floor, height: joineryH, door: p.backDoor, reverse: true });
  for (const side of [-1, 1]) {
    const suiteDoor = id === 'jiuzhou-tongdaotang' && side > 0 || id === 'jiuzhou-qinghuitang' && side < 0;
    sideWall(b, group, `${id}-end-wall-${side}`, { x: side * width / 2, depth: innerZ * 2, floor, height: joineryH + .22, doorway: suiteDoor || id === 'jiuzhou-shendetang' && side < 0, doorWidth: suiteDoor ? 2.20 : null, doorCenter: suiteDoor ? (id === 'jiuzhou-tongdaotang' ? 1.20 : -.64) : 0, rotation: side * Math.PI / 2 });
  }
  if (section) {
    const xLines = xs.filter(x => Math.abs(x) < rw / 2 - (xieshan ? rd * .19 : .25) - .35);
    if (!xLines.length) xLines.push(-width * .25, width * .25);
    const rolls = p.rolls ?? 1, pitch = rd / rolls;
    for (let i = 0; i < rolls; i++) {
      const center = section.crowns[i].z, pairs = [[center - pitch * .31, center + pitch * .31], [center - pitch * .18, center + pitch * .18], [center - pitch * .045, center + pitch * .045]];
      const lower = Math.min(...pairs[0].map(z => heightAt(0, z))) - 1.08;
      const bearing = namedGroup(frame, `${id}-roll-${i + 1}-bearing-frame`, { body: 'continuous-interior-roll-bearing', exactInternalPostArrangementRecovered: false });
      for (const z of pairs[0]) {
        for (let j = 0; j < xLines.length; j++) jiuzhouColumn(b, bearing, `${bearing.name}-post-${z}-${j}`, xLines[j], z, floor, Math.max(post, lower - floor), { rear: p.green });
        for (let j = 0; j + 1 < xLines.length; j++) jiuzhouPaintedBeam(b, bearing, `${bearing.name}-beam-${z}-${j}`, xLines[j + 1] - xLines[j], [(xLines[j] + xLines[j + 1]) / 2, lower + .192, z], .384, p.green);
      }
      jiuzhouTruss(b, frame, `${id}-roll-${i + 1}-raised-beams`, { xLines, pairs, roofAt: heightAt, lowerBearingY: lower + .384, rear: p.green, purlinHalfWidth: xieshan ? rw / 2 - rd * .19 - .18 : width / 2 });
    }
  }
  if (id === 'jiuzhou-shendetang') {
    const performance = namedGroup(group, `${id}-west-performance-and-audience-floor`, { body: 'shared-front-depth-performance-space', source: 'He upper p36: four communicating bays, west end actors doors, eastern audience', noInventedRaisedStage: true });
    for (let i = 0; i < 20; i++) b.woodBox(performance, [-width * .40 + (i + .5) * width * .78 / 20, floor + .012, depth * .31], [width * .78 / 20 - .008, .024, depth * .18], b.m.darkWood);
  }
  if (id === 'jiuzhou-fengsanwusi') for (const side of [-1, 1]) buildJiuzhouFlatRoom(b, group, `${id}-late-three-bay-flat-wing-${side}`, { x: side * (width / 2 + 3.72), z: 0, width: 7.44, depth: depth - .30, floor, roofY: floor + 3.67, bays: 3 });
  if (p.garden) group.userData.evidenceLimit = 'Three distinct garden buildings retained in the plan; detailed elevations have lower evidence coverage than the central halls.';
  b.buildings.push({ id, roof: spec.roof, bays: spec.bays, floor, rotation: group.rotation.y, roofRolls: p.rolls ?? 1, measuredDimensions: false });
  b.flush(); return group;
}

export function buildJiuzhouTongdaoStage(b, parent, { tiles = true } = {}) {
  const spec = jiuzhouPlan.core.find(p => p.id === 'jiuzhou-tongdao-stage'), group = namedHall(parent, spec, 'north-facing-double-eave-theatre-stage'); group.rotation.y = Math.PI;
  const floor = .672, xs = [-3.84, -2.24, 2.24, 3.84], post = 4.16;
  jiuzhouPlatform(b, group, `${spec.id}-stone-platform`, 8.48, 8.48, floor);
  const deck = namedGroup(group, `${spec.id}-wood-stage-floor`, { body: 'supported-individual-stage-floorboards' });
  for (let i = 0; i < 28; i++) b.woodBox(deck, [-3.84 + (i + .5) * 7.68 / 28, floor + .025, 0], [7.68 / 28 - .006, .05, 7.68], b.m.darkWood);
  for (const side of [-1, 1]) jiuzhouPostRow(b, group, `${spec.id}-post-row-${side}`, { xs, z: side * 3.84, floor, height: post });
  for (const side of [-1, 1]) jiuzhouPaintedBeam(b, group, `${spec.id}-side-fang-${side}`, 7.68, [side * 3.84, floor + post + .192, 0], .384, false, Math.PI / 2);
  const lowerEave = floor + 5.12, topWidth = 6.22, topDepth = 5.46, lowerRise = 1.10;
  buildJiuzhouHipBand(b, group, `${spec.id}-lower-eave-roof`, { width: 10.34, depth: 10.34, topWidth, topDepth, eaveY: lowerEave, rise: lowerRise, cornerLift: .28 }, { tiles });
  const drum = namedGroup(group, `${spec.id}-upper-bearing-drum`, { body: 'hollow-bearing-between-double-eaves' });
  b.polygon(drum, rectangle(topWidth + .25, topDepth + .25), lowerEave + lowerRise - .23, lowerEave + lowerRise + .57, b.m.greenWood, [rectangle(topWidth - .25, topDepth - .25)]);
  for (const side of [-1, 1]) jiuzhouPaintedBeam(b, drum, `${spec.id}-upper-fang-${side}`, topWidth, [0, lowerEave + lowerRise + .37, side * topDepth / 2], .34);
  buildJiuzhouPointedXieshan(b, group, `${spec.id}-upper-xieshan-roof`, { width: topWidth + 1.16, depth: topDepth + 1.16, eaveY: lowerEave + lowerRise + .52, rise: 2.14, tiles });
  const bearing = namedGroup(group, `${spec.id}-lower-roof-bearings`, { body: 'posts-and-ties-bearing-the-lower-roof-and-upper-drum', frameInterpretation: true });
  for (const side of [-1, 1]) for (const x of [-2.24, 2.24]) {
    b.box(bearing, b.m.red, [x, (floor + post + .384 + lowerEave + lowerRise - .23) / 2, side * 2.73], [.22, lowerEave + lowerRise - .23 - (floor + post + .384), .22]);
    b.box(bearing, b.m.red, [x, floor + post + .25, side * 3.20], [.26, .27, 1.42]);
  }
  // Actors enter through actual rear doors. There is no invented aerial
  // gallery between the viewing hall and the stage.
  const screen = namedGroup(group, `${spec.id}-rear-stage-screen`, { body: 'solid-stage-back-with-two-actor-doorways', exactDecorativeSchemeInferred: true }); screen.position.set(0, floor, -3.52);
  const doorWidth = 1.40, doorHeight = 2.78;
  for (const [x, w] of [[-3.50, .68], [0, 2.56], [3.50, .68]]) b.woodBox(screen, [x, 1.68, 0], [w, 3.36, .17], b.m.greenWood);
  for (const side of [-1, 1]) {
    const door = jiuzhouDoorway(b, screen, `${spec.id}-actor-door-${side}`, { width: doorWidth, height: doorHeight, leaves: 2 }); door.position.x = side * 2.22;
    b.woodBox(screen, [side * 2.22, (3.36 + doorHeight) / 2, 0], [doorWidth + .20, 3.36 - doorHeight, .17], b.m.greenWood);
  }
  const stair = jiuzhouSteps(b, group, `${spec.id}-rear-access-steps`, { frontZ: 5.64, width: 3.20, toY: floor, reverse: true }); stair.userData.originalStairOutlineRecovered = false;
  group.userData.evidenceLimit = 'Double eaves and stage dimensions are documented; xieshan upper roof is the published researchers’ interpretation, not an unambiguous measured elevation.';
  b.buildings.push({ id: spec.id, bays: 3, floor, frontBayWidths: [1.60, 4.48, 1.60], postHeight: post, roof: spec.roof, faces: 'north' }); b.flush(); return group;
}

export const jiuzhouHallRecipes = recipe;

export function buildJiuzhouConnectingSuites(b, parent) {
  const group = namedGroup(parent, 'jiuzhou-late-three-bay-connecting-suites', { body: 'enclosed-suites-between-central-and-flanking-halls', source: 'He upper pp34,38: enclosed connections and three-bay platform rooms reported in archival research; category has textual evidence', roofComparison: 'He middle p43 fig18-5: modern reconstruction, not an original Qing roof section', exactRoofSectionRecovered: false, roofPitchConstructionDrainageAndCopingInferred: true, exactRoomDimensionsAndDivisionsRecovered: false });
  const suites = [
    { id: 'jiuzhou-tongdao-inner-three-bay-suite', x: -13.28, z: -43.80, width: 7.04, depth: 3.20, walks: [[[-18.20, -43.44], [-15.80, -43.44]], [[-16.00, -43.44], [-10.60, -44.16]], [[-11.00, -44.16], [-8.50, -44.16]]] },
    { id: 'jiuzhou-qinghui-inner-three-bay-suite', x: 11.68, z: -43.36, width: 3.84, depth: 3.20, walks: [[[8.50, -44.16], [11.00, -44.16]], [[10.50, -44.16], [12.85, -42.56]], [[12.10, -42.56], [14.90, -42.56]]] },
  ];
  for (const spec of suites) {
    const room = namedGroup(group, spec.id, { body: 'three-bay-platform-suite-with-shared-end-wall-doors', bays: 3, exactRoofSectionRecovered: false, roofPitchConstructionDrainageAndCopingInferred: true, planAndRoofHeightInferred: true }); room.position.set(spec.x, 0, spec.z);
    const floor = .64, roofY = 4.30, height = roofY - floor - .23;
    jiuzhouPlatform(b, room, `${spec.id}-supported-floor`, spec.width + .03, spec.depth + .10, floor);
    // The adjoining halls own the end walls and their real doors. Duplicate
    // coplanar walls or a second pair of leaves would block the same opening.
    for (const side of [-1, 1]) facade(b, room, `${spec.id}-windows-${side}`, { width: spec.width, xs: columnXs(spec.width, 3), z: side * spec.depth / 2, floor, height, door: false, reverse: side < 0 });
    b.box(room, b.m.darkWood, [0, roofY - .15, 0], [spec.width + .05, .20, spec.depth + .04]);
    b.box(room, b.m.tileShade, [0, roofY - .035, 0], [spec.width + .14, .07, spec.depth + .16]);
    const cells = Math.ceil(spec.width / .43);
    for (const side of [-1, 1]) for (let cell = 0; cell < cells; cell++) b.box(room, b.m.greyTile, [-spec.width / 2 + (cell + .5) * spec.width / cells, roofY + .045, side * (spec.depth / 2 + .06)], [spec.width / cells - .006, .13, .19]);
    for (const [i, [from, to]] of spec.walks.entries()) b.walkways.push({ id: `${spec.id}-door-to-door-passage-${i}`, from, to, floorStart: .704, floorEnd: .64, clearWidth: 1.68, roofed: true });
  }
  b.flush(); return group;
}

export function buildJiuzhouCornerHouse(b, parent, { tiles = true } = {}) {
  const spec = jiuzhouPlan.core.find(p => p.id === 'jiuzhou-west-corner-house'), group = namedHall(parent, spec, 'L-plan-western-court-corner-house');
  const outline = [[-3.84, -6.72], [3.84, -6.72], [3.84, -2.24], [.64, -2.24], [.64, 6.72], [-3.84, 6.72]], floor = .54, upper = 4.10;
  const platformOutline = [[-4.46, -7.34], [4.46, -7.34], [4.46, -1.62], [1.26, -1.62], [1.26, 7.34], [-4.46, 7.34]];
  jiuzhouPolygonPlatform(b, group, `${spec.id}-L-platform`, platformOutline, floor);
  const entry = jiuzhouSteps(b, group, `${spec.id}-south-entry-steps`, { x: -1.60, frontZ: 8.64, width: 2.30, toY: floor, run: 1.30 }); entry.userData.stairPositionInferred = true;
  const opening = [[-3.28, 1.74], [.08, 1.74], [.08, 5.86], [-3.28, 5.86]], deck = namedGroup(group, `${spec.id}-upper-floor-with-actual-stair-opening`, { body: 'solid-L-floor-with-stairwell', originalFloorAndStairLayoutRecovered: false });
  b.polygon(deck, outline, upper - .20, upper, b.m.darkWood, [opening]);
  // Board joints are recessed grooves on the backing floor, with no fictive
  // bridge across the stairwell. The two positive openings are real geometry.
  for (let z = -6.66; z < 6.65; z += .29) {
    const xmax = z < -2.24 ? 3.80 : .60;
    const spans = z > 1.74 && z < 5.86 ? [[-3.80, -3.28], [.08, xmax]] : [[-3.80, xmax]];
    for (const [a, c] of spans) if (c - a > .025) b.woodBox(deck, [(a + c) / 2, upper + .014, z], [c - a, .028, .283], b.m.darkWood);
  }
  for (const [story, level, height] of [[0, floor, 3.26], [1, upper, 3.00]]) {
    const frame = namedGroup(group, `${spec.id}-storey-${story + 1}`, { body: 'L-plan-windowed-timber-storey', storeyHeightInferred: true });
    for (let edge = 0; edge < outline.length; edge++) {
      const a = outline[edge], c = outline[(edge + 1) % outline.length], length = Math.hypot(c[0] - a[0], c[1] - a[1]), bays = Math.max(1, Math.round(length / 3.2));
      const side = namedGroup(frame, `${spec.id}-storey-${story + 1}-wall-${edge}`, { body: 'post-and-window-side-of-L-court' }); side.position.set((a[0] + c[0]) / 2, 0, (a[1] + c[1]) / 2); side.rotation.y = Math.PI - Math.atan2(c[1] - a[1], c[0] - a[0]);
      const xs = columnXs(length, bays);
      facade(b, side, `${side.name}-joinery`, { width: length, xs, z: -.06, floor: level, height: height + .14, door: story === 0 && edge === 4 });
      jiuzhouPostRow(b, side, `${side.name}-columns`, { xs, z: 0, floor: level, height, radius: .16, rear: story === 1 });
    }
  }
  const stair = namedGroup(group, `${spec.id}-two-flight-stair`, { body: 'two-connected-solid-timber-flights', interpretation: 'walkable-layout-within-inferred-two-storey-corner-house', fromY: floor, toY: upper });
  const n = 11, run = 3.62, landingZ = 1.48, half = (upper - floor) / 2;
  for (let i = 0; i < n; i++) {
    const lowerY = floor + half * (i + 1) / n, upperY = floor + half + half * (i + 1) / n;
    b.woodBox(stair, [-2.45, lowerY - .055, 5.60 - (i + .5) * run / n], [1.30, .11, run / n + .014], b.m.darkWood);
    b.woodBox(stair, [-.75, upperY - .055, 1.98 + (i + .5) * run / n], [1.30, .11, run / n + .014], b.m.darkWood);
  }
  b.woodBox(stair, [-1.60, floor + half - .11, landingZ], [3.20, .22, 1.02], b.m.darkWood);
  for (const [x, fromZ, toZ, bottom, top] of [[-3.10, 5.60, 1.98, floor, floor + half], [-1.80, 5.60, 1.98, floor, floor + half], [-1.40, 1.98, 5.60, floor + half, upper], [-.10, 1.98, 5.60, floor + half, upper]]) {
    const a = new THREE.Vector3(x, bottom - .10, fromZ), c = new THREE.Vector3(x, top - .10, toZ), direction = c.clone().sub(a), rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    b.add(stair, b.prototype('box', () => new THREE.BoxGeometry()), b.m.darkWood, a.clone().lerp(c, .5).toArray(), [.13, direction.length() + .12, .21], rotation);
    b.rod(stair, b.m.greenWood, [x, bottom + .88, fromZ], [x, top + .88, toZ], .038, 16);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, y = THREE.MathUtils.lerp(bottom, top, t), z = THREE.MathUtils.lerp(fromZ, toZ, t); b.rod(stair, b.m.greenWood, [x, y, z], [x, y + .88, z], .028, 12);
    }
  }
  for (const [a, c] of [[[-3.28, 1.74], [-3.28, 5.86]], [[.08, 1.74], [.08, 5.86]], [[-3.28, 1.74], [.08, 1.74]]]) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    b.rod(stair, b.m.greenWood, [a[0], upper + .94, a[1]], [c[0], upper + .94, c[1]], .038, 16);
    for (let i = 0; i <= Math.ceil(len / .48); i++) { const t = i / Math.ceil(len / .48), x = THREE.MathUtils.lerp(a[0], c[0], t), z = THREE.MathUtils.lerp(a[1], c[1], t); b.rod(stair, b.m.greenWood, [x, upper, z], [x, upper + .94, z], .027, 12); }
  }
  buildJiuzhouLCornerRoof(b, group, `${spec.id}-L-roof`, { tiles, eaveY: upper + 3.82 });
  group.userData.evidenceLimit = 'The published plan identifies a corner house. Exact storeys, L roof intersection, internal stairs and elevations remain an explicitly authored interpretation.';
  b.buildings.push({ id: spec.id, roof: spec.roof, floor, upperFloor: upper, measuredDimensions: false, originalStairLayoutRecovered: false }); b.flush(); return group;
}
