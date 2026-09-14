import * as THREE from 'three';
import { namedGroup, V } from './study-geometry.js';
import { chineseHipPoint, chineseHipRoofGeometry, chineseGablePoint, chineseGableRoofGeometry, gableInfillGeometry, roofTileRollGeometry, ridgeBeastGeometry } from './chinese-architecture-geometry.js';
import { zhengjuesiOctagonalRoofGeometry, zhengjuesiOctagonalRoofPoint, octagonPoint } from './zhengjuesi-geometry.js';

function pointAtDistance(table, distance) {
  const d = Math.max(0, Math.min(distance, table.at(-1).d));
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid].d < d) lo = mid; else hi = mid; }
  return THREE.MathUtils.lerp(table[lo].t, table[hi].t, (d - table[lo].d) / Math.max(1e-9, table[hi].d - table[lo].d));
}

function tileRun(b, parent, sample, maxT, variation, pan = false) {
  if (maxT < .018) return;
  const table = [{ t: 0, d: 0 }]; let previous = sample(0), distance = 0;
  for (let i = 1; i <= 64; i++) { const t = i * maxT / 64, p = sample(t); distance += p.distanceTo(previous); table.push({ t, d: distance }); previous = p; }
  if (distance < .06) return;
  const count = Math.ceil(distance / .53), step = distance / count;
  const geometry = b.proto(pan ? 'concave-lap-pan-tile' : 'convex-lap-cover-tile', () => {
    const g = roofTileRollGeometry([V(0, 0, -.5), V(0, .002, 0), V(0, 0, .5)], pan ? .119 : .101, .021, 14);
    if (pan) g.rotateZ(Math.PI); return g;
  });
  for (let i = 0; i < count; i++) {
    const startT = pointAtDistance(table, i * step), endT = pointAtDistance(table, Math.min(distance, (i + 1) * step + .057));
    const a = sample(startT), c = sample(endT), tangent = c.clone().sub(a), length = tangent.length(); if (length < .025) continue;
    tangent.normalize(); const cross = V(tangent.z, 0, -tangent.x).normalize(), normal = tangent.clone().cross(cross).normalize(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross, normal, tangent));
    const mid = a.clone().add(c).multiplyScalar(.5).addScaledVector(normal, pan ? .122 : .036);
    const material = i === 0 ? b.m.greenTile : b.m.greyTile;
    const shade = .946 + ((variation * 37 + i * 17) % 23) * .0035;
    b.put(parent, geometry, material, mid.toArray(), [1, 1, length], q, new THREE.Color(shade, shade * .998, shade * .987));
  }
  if (!pan) {
    const p = sample(0), tangent = sample(Math.min(.025, maxT)).sub(p).normalize(), normal = V(tangent.z, 0, -tangent.x).cross(tangent).negate().normalize();
    const cap = b.proto('solid-lotus-tile-end', () => new THREE.CylinderGeometry(.103, .103, .030, 20));
    b.put(parent, cap, b.m.greenTile, p.clone().addScaledVector(normal, .048).toArray(), [1, 1, 1], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tangent.clone().negate()));
  }
}

function rafters(b, parent, sample, maxT, radius = .068) {
  const points = [];
  for (let i = 0; i <= 12; i++) {
    const t = maxT * i / 12, p = sample(t), next = sample(Math.min(maxT, t + .001)), last = sample(Math.max(0, t - .001)), tangent = next.sub(last).normalize();
    const horizontal = Math.hypot(tangent.x, tangent.z); p.y -= .17 + radius / Math.max(.25, horizontal); points.push(p);
  }
  for (let i = 1; i < points.length; i++) b.rod(parent, b.m.red, points[i - 1].toArray(), points[i].toArray(), radius, 10);
  const p = points[0];
  b.put(parent, b.proto('rafter-painted-end', () => new THREE.SphereGeometry(1, 10, 7)), b.m.pale, p.toArray(), [radius * .99, radius * .99, radius * .99]);
}

function ridge(b, parent, width, y, scale = 1) {
  const points = Array.from({ length: 33 }, (_, i) => { const t = i / 16 - 1; return [t * width / 2, y + .19 + .30 * Math.abs(t) ** 7, 0]; });
  b.tube(parent, b.m.greenTile, points, .105, 40, 12);
  b.box(parent, b.m.greyTile, [0, y + .095, 0], [Math.max(.14, width), .18, .22]);
  for (const side of [-1, 1]) {
    const scroll = Array.from({ length: 36 }, (_, i) => { const a = Math.PI * 1.4 * i / 35, r = .10 + .16 * i / 35; return [side * (width / 2 + Math.sin(a) * r * scale), y + .43 + (1 - Math.cos(a)) * r * scale, 0]; });
    b.tube(parent, b.m.greenTile, scroll, .078 * scale, 40, 10);
    b.put(parent, b.proto('authored-ridge-beast', ridgeBeastGeometry), b.m.greyTile, [side * (width / 2 - .24), y + .19, 0], [.55 * scale, .55 * scale, .55 * scale], [0, side < 0 ? Math.PI : 0, 0]);
  }
}

export function zhengjuesiHipRoof(b, parent, name, options, { ridgeCap = true, roofRafters = true } = {}) {
  const group = namedGroup(parent, name, { body: options.topDepth ? 'single-curved-hip-roof-ring' : 'historical-single-eave-wudian-roof', sourceIds: ['qi-zhang-2021'], dimensions: options, dimensionsEvidence: 'curvature-and-dimensions-proportional' });
  const shell = namedGroup(group, `${name}-board-shell`, { body: 'closed-thick-curved-roof-boards' });
  b.put(shell, chineseHipRoofGeometry({ ...options, thickness: .16, segments: 30, courses: 22 }), b.m.greyTile);
  const tiles = namedGroup(group, `${name}-lapping-tiles`, { body: 'separate-concave-pan-and-convex-cover-tiles', coverPitch: .28, tileLength: .53, lap: .057 });
  const framing = namedGroup(group, `${name}-underside-rafters`, { body: 'curved-round-rafters-and-painted-ends' });
  const { width, depth, topWidth = Math.max(0, width - depth), topDepth = 0, eaveY, rise } = options;
  for (let face = 0; face < 4; face++) {
    const along = face % 2 ? depth : width, top = face % 2 ? topDepth : topWidth, columns = Math.max(3, Math.round(along / .28)), pitch = along / columns;
    for (let i = 0; i < columns; i++) for (const pan of [false, true]) {
      const offset = -along / 2 + (i + .42 + (pan ? .5 : 0)) * pitch;
      const maxT = Math.min(1, (along / 2 - Math.abs(offset)) / Math.max(.001, (along - top) / 2));
      const sample = t => chineseHipPoint(options, face, offset / Math.max(.00001, THREE.MathUtils.lerp(along / 2, top / 2, t)), t);
      tileRun(b, tiles, sample, maxT, i + face * 77, pan);
      if (roofRafters && !pan && i % 2 === 0 && maxT > .12) rafters(b, framing, sample, maxT * .995);
    }
  }
  const caps = namedGroup(group, `${name}-hips-and-ridge`, { body: 'continuous-grey-and-green-ridge-caps' });
  for (let face = 0; face < 4; face++) {
    b.tube(caps, b.m.greenTile, Array.from({ length: 33 }, (_, i) => chineseHipPoint(options, face, i / 16 - 1, 0).add(V(0, .035, 0))), .067, 40, 10);
    b.tube(caps, b.m.greyTile, Array.from({ length: 33 }, (_, i) => chineseHipPoint(options, face, 1, i / 32).add(V(0, .14, 0))), .122, 40, 12);
  }
  if (ridgeCap && !topDepth) ridge(b, caps, topWidth, eaveY + rise, Math.min(1.05, width / 19));
  return group;
}

export function zhengjuesiGableRoof(b, parent, name, options, { endMaterial = b.m.redWall, ridgeCap = true, flushGable = false } = {}) {
  const group = namedGroup(parent, name, { body: flushGable ? 'yingshan-roof-with-solid-end-walls' : 'upper-xieshan-gable', dimensions: options });
  b.put(group, chineseGableRoofGeometry({ ...options, thickness: .16, segments: 24, courses: 22 }), b.m.greyTile);
  const tiles = namedGroup(group, `${name}-lapping-tiles`, { body: 'lapping-pan-and-cover-tiles' }), columns = Math.round(options.width / .28);
  for (const side of [-1, 1]) for (let i = 0; i < columns; i++) for (const pan of [false, true]) {
    const u = -1 + 2 * (i + .25 + (pan ? .5 : 0)) / columns;
    const sample = t => chineseGablePoint(options, side, u, t);
    tileRun(b, tiles, sample, .995, i + (side + 1) * 27, pan);
    if (!pan && i % 2 === 0) rafters(b, tiles, sample, .985);
  }
  const barge = namedGroup(group, `${name}-gable-end-boards`, { body: 'closed-gable-infill-and-curved-bargeboards' });
  for (const side of [-1, 1]) {
    b.put(barge, gableInfillGeometry(options.depth, options.rise, flushGable ? .42 : .20), endMaterial, [side * (options.width / 2 - (flushGable ? .1 : .02)), options.eaveY, 0]);
    for (const roofSide of [-1, 1]) {
      const path = Array.from({ length: 31 }, (_, i) => chineseGablePoint(options, roofSide, side, i / 30).add(V(side * .028, flushGable ? .08 : -.06, 0)));
      b.tube(barge, flushGable ? b.m.greyTile : b.m.green, path, flushGable ? .12 : .11, 40, 10);
      if (!flushGable) b.tube(barge, b.m.pale, path.map(p => p.clone().add(V(side * .105, -.01, 0))), .019, 40, 6);
    }
  }
  if (ridgeCap) ridge(b, barge, options.width, options.eaveY + options.rise, Math.min(1.0, options.width / 19));
  return group;
}

export function zhengjuesiXieshanRoof(b, parent, name, { width, depth, eaveY, rise, cornerLift = .31 }) {
  const group = namedGroup(parent, name, { body: 'single-eave-xieshan-not-a-stacked-palace-roof', sourceIds: ['qi-zhang-2021'] });
  const topWidth = width - depth * .44, topDepth = depth * .52, breakY = eaveY + rise * .31;
  zhengjuesiHipRoof(b, group, `${name}-hip-skirt`, { width, depth, topWidth, topDepth, eaveY, rise: rise * .31, cornerLift }, { ridgeCap: false });
  zhengjuesiGableRoof(b, group, `${name}-upper-gable`, { width: topWidth, depth: topDepth, eaveY: breakY + .008, rise: rise * .69 });
  return group;
}

export function zhengjuesiOctagonalRoof(b, parent, name, options) {
  const group = namedGroup(parent, name, { body: options.topApothem ? 'octagonal-lower-eave-ring' : 'eight-hip-upper-pyramidal-roof', sourceIds: ['qi-zhang-2021', 'park-wenshu-2016'], noDougong: true, dimensions: options });
  b.put(group, zhengjuesiOctagonalRoofGeometry(options), b.m.greyTile);
  const tiles = namedGroup(group, `${name}-lapping-tiles`, { body: 'full-pan-and-cover-tiles-on-eight-curved-faces' });
  const caps = namedGroup(group, `${name}-eight-hips`, { body: 'continuous-upturned-hip-caps' });
  const top = options.topApothem ?? 0, along = 2 * options.apothem * Math.tan(Math.PI / 8), topAlong = 2 * top * Math.tan(Math.PI / 8), columns = Math.round(along / .28), pitch = along / columns;
  for (let face = 0; face < 8; face++) {
    for (let i = 0; i < columns; i++) for (const pan of [false, true]) {
      const offset = -along / 2 + (i + .25 + (pan ? .5 : 0)) * pitch;
      const maxT = Math.min(.999, (along / 2 - Math.abs(offset)) / Math.max(.001, (along - topAlong) / 2));
      const sample = t => zhengjuesiOctagonalRoofPoint(options, face, offset / Math.max(.00001, THREE.MathUtils.lerp(along / 2, topAlong / 2, t)), t);
      tileRun(b, tiles, sample, maxT, i + face * 55, pan);
      if (!pan && i % 2 === 0 && maxT > .12) rafters(b, tiles, sample, maxT * .99, .060);
    }
    b.tube(caps, b.m.greenTile, Array.from({ length: 33 }, (_, i) => zhengjuesiOctagonalRoofPoint(options, face, i / 16 - 1, 0).add(V(0, .035, 0))), .073, 40, 10);
    b.tube(caps, b.m.greyTile, Array.from({ length: 33 }, (_, i) => zhengjuesiOctagonalRoofPoint(options, face, 1, i / 32).add(V(0, .137, 0))), .115, 40, 12);
    const p = octagonPoint(options.apothem, face, 1, options.eaveY + options.cornerLift + .11);
    b.put(caps, b.proto('authored-ridge-beast', ridgeBeastGeometry), b.m.greyTile, p.toArray(), [.38, .38, .38], [0, face * Math.PI / 4 + Math.PI / 8, 0]);
  }
  if (!top) b.lathe(caps, 'wenshu-pavilion-finial', b.m.gold, [[0, 0], [.30, 0], [.34, .08], [.25, .14], [.22, .25], [.31, .34], [.27, .50], [.16, .64], [.20, .72], [.16, .89], [.09, 1.00], [0, 1.18]], [0, options.eaveY + options.rise, 0], [1, 1, 1], 40);
  return group;
}
