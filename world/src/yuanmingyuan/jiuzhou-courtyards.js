import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { jiuzhouPlatform, jiuzhouPolygonPlatform, jiuzhouColumn, jiuzhouPaintedBeam, jiuzhouMasonry } from './jiuzhou-architecture.js';
import { jiuzhouDoorway } from './jiuzhou-joinery.js';
import { jiuzhouFeatureSection } from './jiuzhou-sections.js';
import { buildJiuzhouGalleryRoof, buildJiuzhouPlatformGalleryRoof } from './jiuzhou-gallery-roof.js';

const point = ([x, z]) => [(x - 425) * .32, (z - 300) * .32];
export const jiuzhouStudyShoreline = [[141, 138], [245, 134], [306, 147], [368, 129], [411, 110], [449, 122], [521, 144], [572, 153], [622, 145], [679, 166], [697, 215], [709, 253], [764, 282], [803, 298], [793, 352], [755, 382], [666, 388], [605, 419], [541, 410], [504, 453], [440, 450], [407, 460], [359, 441], [302, 436], [274, 412], [212, 408], [169, 386], [150, 340], [118, 288], [122, 229], [139, 190]].map(point);

export function jiuzhouCourtPaving(b, parent, name, { x, z, width, depth, top = .054, pitch = .82 }) {
  const group = namedGroup(parent, name, { body: 'court-stone-paving-with-recessed-joints', originalPavingPatternRecovered: false }); group.position.set(x, 0, z);
  jiuzhouPlatform(b, group, `${name}-stone-cells`, width, depth, top, { bottom: -.18, tilePitch: pitch }); return group;
}

export function jiuzhouGardenWall(b, parent, name, from, to, { height = 2.58, gate = 0, gateWidth = 1.9, wallY = .045 } = {}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), group = namedGroup(parent, name, { body: 'courtyard-lime-wall-with-solid-grey-brick-coping', positionEvidence: 'source-relative-research-plan' });
  group.position.set((from[0] + to[0]) / 2, wallY, (from[1] + to[1]) / 2); group.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  const pieces = gate ? [[-length / 2, gate - gateWidth / 2], [gate + gateWidth / 2, length / 2]] : [[-length / 2, length / 2]];
  for (const [a, c] of pieces) {
    if (c - a < .03) continue;
    b.box(group, b.m.brick, [(a + c) / 2, .27, 0], [c - a, .62, .43]); b.box(group, b.m.plaster, [(a + c) / 2, height / 2 + .21, 0], [c - a, height - .42, .32]);
    for (const y of [.50, height - .08]) b.box(group, b.m.brick, [(a + c) / 2, y, 0], [c - a + .012, .09, .38]);
    const count = Math.ceil((c - a) / .32);
    for (let i = 0; i < count; i++) {
      const x = a + (i + .5) * (c - a) / count;
      b.box(group, i % 13 ? b.m.greyTile : b.m.tileShade, [x, height + .018, 0], [(c - a) / count - .006, .072, .47]);
      b.rod(group, b.m.greyTile, [x, height + .066, -.26], [x, height + .11, .26], .055, 20);
    }
  }
  if (gate) {
    for (const side of [-1, 1]) b.box(group, b.m.brick, [gate + side * (gateWidth + .15) / 2, 1.24, 0], [.21, 2.48, .46]);
    const door = jiuzhouDoorway(b, group, `${name}-actual-gate`, { width: gateWidth - .20, height: Math.min(2.37, height - .10), leaves: 2 }); door.position.x = gate;
    b.box(group, b.m.brick, [gate, height - .05, 0], [gateWidth + .48, .21, .60]);
  }
  return group;
}

export function jiuzhouCoveredGallery(b, parent, name, points, { width = 2.12, floorStart = .64, floorEnd = floorStart, tiles = true, closedSide = 0, neighbourPaths = [], roofMode = 'curved', bayCount = null, roofTrimStart = 0 } = {}) {
  const group = namedGroup(parent, name, { body: 'documented-late-covered-gallery-with-actual-floor-and-posts', exactBayWidthsAndLevelsRecovered: false, source: '1857–1859 modifications in He upper pp36–38' });
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1])), total = lengths.reduce((a, c) => a + c, 0); let travelled = 0;
  const clearSegments = [points, ...neighbourPaths].flatMap((path, pathIndex) => path.slice(1).map((to, edge) => ({ from: path[edge], to, edge: pathIndex === 0 ? edge : -1 })));
  const entersAnotherLeg = (x, z, ownEdge) => clearSegments.some(({ from, to, edge }) => {
    if (edge === ownEdge) return false;
    const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz);
    const t = THREE.MathUtils.clamp(((x - from[0]) * dx + (z - from[1]) * dz) / (length * length), 0, 1);
    return Math.hypot(x - from[0] - dx * t, z - from[1] - dz * t) < width / 2 - .025;
  });
  for (let edge = 0; edge < lengths.length; edge++) {
    const from = points[edge], to = points[edge + 1], length = lengths[edge], bays = bayCount ?? Math.max(1, Math.ceil(length / 3.52)), span = length / bays;
    const segment = namedGroup(group, `${name}-segment-${edge}`, { body: 'stepped-gallery-segment' }); segment.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2); segment.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
    for (let bay = 0; bay < bays; bay++) {
      const x = -length / 2 + (bay + .5) * span, floor = THREE.MathUtils.lerp(floorStart, floorEnd, (travelled + (bay + .5) * span) / total) + .010;
      const unit = namedGroup(segment, `${name}-segment-${edge}-bay-${bay}`, { body: 'open-gallery-bay', walkTop: floor }); unit.position.x = x;
      jiuzhouPlatform(b, unit, `${unit.name}-walk`, span + .012, width + .22, floor, { tilePitch: .54 });
      if (roofMode === 'neighbour-eaves') continue;
      for (const side of [-1, 1]) {
        for (const xx of [-span / 2 + .065, span / 2 - .065]) {
          const along = x + xx, cross = side * width / 2, dx = (to[0] - from[0]) / length, dz = (to[1] - from[1]) / length;
          const px = (from[0] + to[0]) / 2 + dx * along - dz * cross, pz = (from[1] + to[1]) / 2 + dz * along + dx * cross;
          if (!entersAnotherLeg(px, pz, edge)) jiuzhouColumn(b, unit, `${unit.name}-post-${side}-${xx}`, xx, cross, floor, 2.82, { radius: .122, base: [.39, .39, .20] });
        }
        jiuzhouPaintedBeam(b, unit, `${unit.name}-long-fang-${side}`, span, [0, floor + 3.005, side * width / 2], .37, true);
        if (closedSide === side) b.box(unit, b.m.plaster, [0, floor + 1.20, side * width / 2], [span, 2.40, .22]);
      }
      const roofY = floor + 3.30;
      for (const z of [-width / 2, width / 2]) b.rod(unit, b.m.greenWood, [-span / 2, roofY - .22, z], [span / 2, roofY - .22, z], .09, 20);
      // A raised central purlin bears on a short post over the cross-beam.
      for (const xx of [-span / 2 + .07, span / 2 - .07]) {
        b.box(unit, b.m.greenWood, [xx, floor + 3.005, 0], [.19, .37, width + .14]);
        if (roofMode === 'curved') b.box(unit, b.m.greenWood, [xx, roofY + .19, 0], [.18, .76, .18]);
      }
      if (roofMode === 'curved') b.rod(unit, b.m.greenWood, [-span / 2, roofY + .46, 0], [span / 2, roofY + .46, 0], .12, 20);
    }
    b.walkways.push({ id: `${name}-segment-${edge}`, from, to, clearWidth: width - .32, floorStart, floorEnd, roofed: true }); travelled += length;
  }
  travelled = 0;
  for (let corner = 1; corner + 1 < points.length; corner++) {
    travelled += lengths[corner - 1];
    const at = points[corner], incoming = V(at[0] - points[corner - 1][0], 0, at[1] - points[corner - 1][1]).normalize(), outgoing = V(points[corner + 1][0] - at[0], 0, points[corner + 1][1] - at[1]).normalize();
    const determinant = incoming.x * outgoing.z - incoming.z * outgoing.x; if (Math.abs(determinant) < .02) continue;
    const floor = THREE.MathUtils.lerp(floorStart, floorEnd, travelled / total) + .010;
    const joint = namedGroup(group, `${name}-turn-${corner}`, { body: 'shared-corner-posts-outside-both-walking-legs', exactHistoricJointRecovered: false }); joint.position.set(at[0], 0, at[1]);
    jiuzhouPlatform(b, joint, `${joint.name}-continuous-corner-landing`, width + .50, width + .50, floor, { tilePitch: .54 });
    for (const side of [-1, 1]) {
      const a = V(-incoming.z, 0, incoming.x).multiplyScalar(side * width / 2), c = V(-outgoing.z, 0, outgoing.x).multiplyScalar(side * width / 2), delta = c.clone().sub(a);
      const t = (delta.x * outgoing.z - delta.z * outgoing.x) / determinant, post = a.clone().addScaledVector(incoming, t);
      jiuzhouColumn(b, joint, `${joint.name}-shared-post-${side}`, post.x, post.z, floor, 2.82, { radius: .122, rear: true, base: [.39, .39, .20] });
      for (const end of [a, c]) b.rod(joint, b.m.greenWood, [post.x, floor + 3.005, post.z], [end.x, floor + 3.005, end.z], .16, 12);
    }
  }
  if (roofMode === 'curved') buildJiuzhouGalleryRoof(b, group, `${name}-continuous-roof`, points, { width, floorStart, floorEnd, tiles });
  else if (roofMode === 'flat') buildJiuzhouPlatformGalleryRoof(b, group, `${name}-platform-roof`, points, { width, floorStart, floorEnd, trimStart: roofTrimStart });
  else group.userData.coverage = 'short link lies below adjoining main-gallery and hall eaves; requires neighbouring section for composed coverage';
  b.flush(); return group;
}

export const jiuzhouGalleryRoutes = [
    ['central-fore-west', [[-9.80, 26.50], [-14.40, 26.50], [-14.40, -4.30]], .72, .78],
    ['central-fore-east', [[9.80, 26.50], [14.40, 26.50], [14.40, -4.30]], .72, .78],
    ['central-rear-west', [[-12.80, -18.50], [-14.40, -18.50], [-14.40, -33.60], [-9.76, -33.60]], .78, .704],
    ['central-rear-east', [[12.80, -18.50], [14.40, -18.50], [14.40, -33.60], [9.76, -33.60]], .78, .704],
    ['shende-west', [[-57.70, -38.70], [-57.70, -10.10], [-57.70, 3.82], [-54.72, 3.82]], .74, .46],
    ['shende-east', [[-29.95, -38.70], [-29.95, -10.10], [-29.95, 3.82], [-32.96, 3.82]], .74, .46],
    ['shende-to-tongdao', [[-29.95, -37.70], [-24.30, -37.70]], .74, .64, { roofMode: 'flat', bayCount: 4, roofTrimStart: 1.67 }],
    ['jifu-west', [[-79.40, 0.80], [-79.40, -15.80]], .48, .66],
    ['jifu-east', [[-63.30, 0.80], [-63.30, -15.80]], .48, .66],
    ['tiandi-west', [[43.80, 12.40], [43.80, -10.00], [43.80, -28.35], [45.90, -28.35]], .52, .66],
    ['tiandi-east', [[71.55, 12.40], [71.55, -10.00], [71.55, -28.35], [69.25, -28.35]], .52, .66],
    ['inner-east-middle-north-link', [[15.36, -32.65], [14.40, -32.65]], .54, .704, { roofMode: 'neighbour-eaves' }],
    ['inner-east-middle-court-side', [[25.65, -7.35], [25.65, -20.80]], .54, .54],
    ['inner-east-east-court-side', [[29.40, -7.35], [29.40, -20.80]], .52, .52],
  ];

export function buildJiuzhouCourtyards(b, parent, { tiles = true, sections = ['central', 'western', 'eastern'] } = {}) {
  const group = namedGroup(parent, 'jiuzhou-courts-and-late-galleries', { body: 'distinct-central-western-and-eastern-court-system', planEvidence: '1859 original checked against modern 1860 reconstruction', dimensionEvidence: 'proportional-except-listed-controls' });
  const include = (kind, id) => sections.includes(jiuzhouFeatureSection(kind, id));
  const courts = [
    ['central-front', 0, 10.30, 24.20, 27.60], ['central-rear', 0, -25.28, 23.90, 10.40],
    ['shende-garden', -43.84, -3.15, 25.20, 13.90], ['jifu-front', -71.36, -6.35, 14.80, 15.00], ['xingcun-front', -71.36, -27.92, 13.60, 3.96],
    ['tongdao-theatre-court', -22.72, -34.20, 10.60, 6.10],
    ['tiandi-front', 57.60, 7.30, 29.40, 8.16], ['tiandi-rear', 57.60, -14.80, 24.28, 8.66],
    ['inner-east-middle', 21.12, -13.00, 10.30, 13.40], ['inner-east-east', 32.96, -13.00, 8.50, 13.40],
  ];
  for (const [id, x, z, width, depth] of courts) if (include('courts', id)) jiuzhouCourtPaving(b, group, `jiuzhou-${id}-court`, { x, z, width, depth });

  for (const [id, points, floorStart, floorEnd, options] of jiuzhouGalleryRoutes) if (include('galleries', id)) jiuzhouCoveredGallery(b, group, `jiuzhou-gallery-${id}`, points, { floorStart, floorEnd, tiles, ...options, neighbourPaths: jiuzhouGalleryRoutes.filter(route => route[0] !== id).map(route => route[1]) });
  // This raised connection occupies the narrow court instead of two sets of
  // opposed stairs intersecting between the rear hall and fifteen-bay house.
  if (sections.includes('eastern')) jiuzhouCourtPaving(b, group, 'jiuzhou-quanshi-shared-raised-landing', { x: 57.60, z: -30.025, width: 3.52, depth: 1.07, top: .45, pitch: .53 });
  const walls = [
    ['west-outer', [-94.0, -37.5], [-94.0, 8.0]], ['west-front', [-94.0, 9.20], [-59.1, 9.20], { gate: 8.0 }],
    ['west-north', [-92.0, -41.0], [-60.7, -41.0]], ['jifu-shende', [-61.45, -38.70], [-61.45, 2.4], { gate: -7.0 }],
    ['west-garden-front', [-59.0, 11.30], [-28.4, 11.30], { gate: .25 }],
    ['inner-east-dividing', [27.52, -20.4], [27.52, -7.80], { gate: 3.3 }],
    ['inner-east-south', [16.0, 1.35], [38.50, 1.35], { gate: 3.7 }],
    ['tiandi-east-boundary', [81.00, -37.20], [81.00, 12.85], { gate: 9.0 }],
    ['tiandi-south-east', [64.80, 18.90], [84.50, 18.90], { gate: 3.2 }],
    ['tiandi-south-west', [39.0, 18.90], [50.40, 18.90]],
    ['north-fifteen-rooms', [36.80, -38.40], [78.60, -38.40]],
  ];
  for (const [id, a, c, options] of walls) if (include('walls', id)) jiuzhouGardenWall(b, group, `jiuzhou-wall-${id}`, a, c, options);
  // The open theatre's rear access connects at ground level to the dressing
  // house. A speculative elevated spectators' bridge is deliberately absent.
  if (sections.includes('central')) jiuzhouCourtPaving(b, group, 'jiuzhou-stage-dressing-ground-link', { x: -21.12, z: -20.89, width: 3.32, depth: 1.45, top: .055, pitch: .52 });
  b.flush(); return group;
}

export function buildJiuzhouShore(b, parent) {
  const group = namedGroup(parent, 'jiuzhou-shore-and-island-support', { body: 'local-island-foundation-and-layered-quay', originalSurveyRecovered: false, source: 'approximate tracing of modern 1860 plan, checked against original 1859 outline', noLakeBed: true });
  b.polygon(group, jiuzhouStudyShoreline, -2.65, .015, b.m.foundation);
  b.polygon(group, jiuzhouStudyShoreline, -.08, .025, b.m.earth);
  for (let i = 0; i < jiuzhouStudyShoreline.length; i++) {
    const a = jiuzhouStudyShoreline[i], c = jiuzhouStudyShoreline[(i + 1) % jiuzhouStudyShoreline.length];
    for (let row = 0; row < 6; row++) {
      const shift = row % 2 ? .07 : 0, from = [a[0] + shift, a[1] + shift], to = [c[0] + shift, c[1] + shift];
      jiuzhouMasonry(b, group, from, to, .10 - row * .44, .43, row % 2 ? b.m.foundation : b.m.paving);
    }
  }
  // Traversable north and south landings, rather than an isolated central
  // palace floating over the generalized existing garden-layout water.
  jiuzhouCourtPaving(b, group, 'jiuzhou-north-waterfront-walk', { x: 0, z: -54.24, width: 31.0, depth: 2.32, top: .055 });
  jiuzhouCourtPaving(b, group, 'jiuzhou-south-axis-forecourt', { x: 0, z: 42.0, width: 31.0, depth: 7.60, top: .054 });
  b.flush(); return group;
}
