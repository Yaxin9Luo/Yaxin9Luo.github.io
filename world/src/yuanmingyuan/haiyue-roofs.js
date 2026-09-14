import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { chineseHipPoint, chineseHipRoofGeometry, chineseGablePoint, chineseGableRoofGeometry, chineseCrossGablePoint, chineseCrossGableGeometry, gableInfillGeometry, roofTileRollGeometry, ridgeBeastGeometry } from './chinese-architecture-geometry.js';
import { haiyueCrossSkirtGeometry, haiyueCrossSkirtPoint } from './haiyue-geometry.js';

function tAtDistance(table, distance) {
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid].d < distance) lo = mid; else hi = mid; }
  return THREE.MathUtils.lerp(table[lo].t, table[hi].t, (distance - table[lo].d) / Math.max(1e-9, table[hi].d - table[lo].d));
}

export function haiyueTileRun(b, parent, sample, maxT, variation, { pan = false, eave = true, transverseScale = 1 } = {}) {
  if (maxT < .012) return;
  let previous = sample(0), length = 0; const table = [{ t: 0, d: 0 }];
  for (let i = 1; i <= 48; i++) { const t = maxT * i / 48, p = sample(t); length += p.distanceTo(previous); table.push({ t, d: length }); previous = p; }
  if (length < .08) return;
  const count = Math.ceil(length / .49), pitch = length / count;
  const geometry = b.proto(pan ? 'concave-glazed-pan' : 'convex-glazed-cover', () => { const g = roofTileRollGeometry([V(0, 0, -.5), V(0, .003, 0), V(0, 0, .5)], pan ? .114 : .098, .020, 16); if (pan) g.rotateZ(Math.PI); return g; });
  for (let i = 0; i < count; i++) {
    const a = sample(tAtDistance(table, i * pitch)), c = sample(tAtDistance(table, Math.min(length, (i + 1) * pitch + .048))), tangent = c.clone().sub(a), span = tangent.length(); if (span < .022) continue;
    tangent.normalize(); const across = V(tangent.z, 0, -tangent.x).normalize(), normal = tangent.clone().cross(across).normalize(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, normal, tangent)), p = a.clone().add(c).multiplyScalar(.5).addScaledVector(normal, pan ? .117 : .034);
    const shade = .91 + ((variation * 47 + i * 29) % 31) * .0041, color = new THREE.Color(shade, shade * (1 - ((i + variation) % 3) * .006), shade * .98);
    b.put(parent, geometry, eave && i < 2 ? b.m.greenTile : b.m.yellowTile, p.toArray(), [transverseScale, 1, span], q, color);
  }
  if (eave && !pan) {
    const p = sample(0), tangent = sample(Math.min(.023, maxT)).sub(p).normalize(), normal = tangent.clone().cross(V(tangent.z, 0, -tangent.x)).normalize();
    b.put(parent, b.proto('glazed-eave-disc', () => new THREE.CylinderGeometry(.099, .099, .028, 24)), b.m.greenTile, p.addScaledVector(normal, .038).toArray(), [transverseScale, 1, 1], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tangent.clone().negate()));
  }
}

function roofRafter(b, parent, sample, maxT) {
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const t = maxT * i / 10, p = sample(t), tangent = sample(Math.min(maxT, t + .001)).sub(sample(Math.max(0, t - .001))).normalize();
    p.y -= .16 + .061 / Math.max(.25, Math.hypot(tangent.x, tangent.z)); points.push(p);
  }
  for (let i = 1; i < points.length; i++) b.rod(parent, b.m.red, points[i - 1].toArray(), points[i].toArray(), .061, 10);
  b.put(parent, b.proto('painted-rafter-end', () => new THREE.SphereGeometry(1, 12, 8)), b.m.pale, points[0].toArray(), [.059, .059, .059]);
}

function ridge(b, parent, width, y, rotationY = 0, scale = 1) {
  const g = namedGroup(parent, 'haiyue-glazed-ridge'); g.rotation.y = rotationY;
  const path = Array.from({ length: 33 }, (_, i) => { const x = i / 16 - 1; return [x * width / 2, y + .16 + .22 * Math.abs(x) ** 7, 0]; });
  b.tube(g, b.m.greenTile, path, .095, 40, 12);
  b.box(g, b.m.greenTile, [0, y + .071, 0], [width, .15, .20]);
  for (const side of [-1, 1]) {
    const curl = Array.from({ length: 29 }, (_, i) => { const a = i / 28 * Math.PI * 1.45, r = .12 + i / 28 * .12; return [side * (width / 2 + r * Math.sin(a) * scale), y + .35 + (1 - Math.cos(a)) * r * scale, 0]; });
    b.tube(g, b.m.greenTile, curl, .070 * scale, 34, 10);
    b.put(g, b.proto('authored-glazed-ridge-beast', ridgeBeastGeometry), b.m.greenTile, [side * (width / 2 - .24), y + .16, 0], [.52 * scale, .52 * scale, .52 * scale], [0, side < 0 ? Math.PI : 0, 0]);
  }
}

export function haiyueHipRoof(b, parent, name, options, { hasRidge = true } = {}) {
  const g = namedGroup(parent, name, { body: options.topDepth ? 'curved-hip-roof-ring-with-open-upper-storey' : 'curved-hip-roof', sourceIds: ['haiyue-lin-2024'], dimensions: options });
  b.put(g, chineseHipRoofGeometry({ ...options, thickness: .15, segments: 30, courses: 20 }), b.m.greenTile);
  const tiles = namedGroup(g, `${name}-separate-tiles`, { body: 'separate-pan-cover-and-green-marginal-tiles', materialEvidence: 'comparative-reconstruction-colours' });
  const rafters = namedGroup(g, `${name}-rafters`), { width, depth, topWidth = Math.max(0, width - depth), topDepth = 0 } = options;
  for (let face = 0; face < 4; face++) {
    const along = face % 2 ? depth : width, top = face % 2 ? topDepth : topWidth, columns = Math.max(3, Math.round(along / .27)), pitch = along / columns;
    for (let i = 0; i < columns; i++) for (const pan of [false, true]) {
      const offset = -along / 2 + (i + .26 + (pan ? .5 : 0)) * pitch, maxT = Math.min(1, (along / 2 - Math.abs(offset)) / Math.max(.001, (along - top) / 2));
      const sample = t => chineseHipPoint(options, face, offset / Math.max(.00001, THREE.MathUtils.lerp(along / 2, top / 2, t)), t);
      haiyueTileRun(b, tiles, sample, maxT, i + face * 61, { pan });
      if (!pan && i % 2 === 0 && maxT > .12) roofRafter(b, rafters, sample, maxT * .994);
    }
    b.tube(g, b.m.greenTile, Array.from({ length: 31 }, (_, i) => chineseHipPoint(options, face, i / 15 - 1, 0).add(V(0, .027, 0))), .060, 36, 10);
    b.tube(g, b.m.greenTile, Array.from({ length: 31 }, (_, i) => chineseHipPoint(options, face, 1, i / 30).add(V(0, .13, 0))), .108, 36, 12);
  }
  if (hasRidge && !topDepth) ridge(b, g, topWidth, options.eaveY + options.rise);
  return g;
}

export function haiyueGableRoof(b, parent, name, options) {
  const g = namedGroup(parent, name, { body: 'single-gabled-upper-roof-shell', dimensions: options });
  b.put(g, chineseGableRoofGeometry({ ...options, thickness: .15, segments: 30, courses: 20 }), b.m.yellowTile);
  const tiles = namedGroup(g, `${name}-tiles`), columns = Math.round(options.width / .27);
  for (const side of [-1, 1]) for (let i = 0; i < columns; i++) for (const pan of [false, true]) {
    const u = -1 + 2 * (i + .25 + (pan ? .5 : 0)) / columns, sample = t => chineseGablePoint(options, side, u, t);
    haiyueTileRun(b, tiles, sample, .999, i + (side + 1) * 37, { pan });
    if (!pan && i % 2 === 0) roofRafter(b, tiles, sample, .99);
  }
  for (const side of [-1, 1]) {
    b.put(g, gableInfillGeometry(options.depth, options.rise, .17), b.m.redWall, [side * (options.width / 2 - .035), options.eaveY, 0]);
    for (const slope of [-1, 1]) {
      const points = Array.from({ length: 29 }, (_, i) => chineseGablePoint(options, slope, side, i / 28).add(V(side * .04, -.035, 0)));
      b.tube(g, b.m.greenTile, points, .102, 36, 12);
      b.tube(g, b.m.gold, points.map(p => p.clone().add(V(side * .09, -.025, 0))), .014, 36, 6);
    }
  }
  ridge(b, g, options.width, options.eaveY + options.rise, 0, Math.min(1, options.width / 12)); return g;
}

export function haiyueXieshanRoof(b, parent, name, { width, depth, eaveY, rise, cornerLift = .29 }) {
  const g = namedGroup(parent, name, { body: 'one-xieshan-tier-with-closed-hip-skirt-and-gable' }), topWidth = width - depth * .43, topDepth = depth * .53;
  haiyueHipRoof(b, g, `${name}-hip-skirt`, { width, depth, topWidth, topDepth, eaveY, rise: rise * .30, cornerLift }, { hasRidge: false });
  haiyueGableRoof(b, g, `${name}-gable`, { width: topWidth, depth: topDepth, eaveY: eaveY + rise * .30 + .008, rise: rise * .70 }); return g;
}

export function haiyueCrossTopRoof(b, parent, { width = 10.8, innerWidth = 8.2, innerArmWidth = 5, eaveY, skirtRise = .86, rise = 1.65 }) {
  const g = namedGroup(parent, 'haiyue-main-top-roof', { body: 'four-gabled-cross-ridge-over-one-closed-square-skirt', evidence: 'Cross ridge is described in the earlier repair record and retained by modern late-period figure 12; precise profile is authored.' }), o = { width, innerWidth, innerArmWidth, eaveY, rise: skirtRise };
  b.put(g, haiyueCrossSkirtGeometry(o), b.m.greenTile);
  const tiles = namedGroup(g, 'haiyue-main-cross-skirt-tiles');
  for (let edge = 0; edge < 12; edge++) {
    const length = haiyueCrossSkirtPoint(o, edge, 0, 0).distanceTo(haiyueCrossSkirtPoint(o, edge, 1, 0)), columns = Math.max(3, Math.round(length / .27));
    for (let i = 0; i < columns; i++) for (const pan of [false, true]) { const u = (i + .24 + (pan ? .5 : 0)) / columns; haiyueTileRun(b, tiles, t => haiyueCrossSkirtPoint(o, edge, u, t), .998, edge * 59 + i, { pan, transverseScale: .88 }); }
    b.tube(g, b.m.greenTile, Array.from({ length: 17 }, (_, i) => haiyueCrossSkirtPoint(o, edge, i / 16, 0).add(V(0, .06, 0))), .064, 24, 10);
  }
  const cross = { width: innerWidth, armWidth: innerArmWidth, eaveY: eaveY + skirtRise + .008, rise };
  b.put(g, chineseCrossGableGeometry(cross), b.m.yellowTile);
  const topTiles = namedGroup(g, 'haiyue-main-cross-gable-tiles'), count = Math.round(innerWidth / .27), a = innerWidth / 2, d = innerArmWidth / 2;
  for (let axis = 0; axis < 2; axis++) for (const side of [-1, 1]) for (let i = 0; i < count; i++) for (const pan of [false, true]) {
    const along = -a + (i + .24 + (pan ? .5 : 0)) / count * innerWidth, across = Math.min(d, Math.abs(along)); if (across < .07) continue;
    const sample = t => axis === 0 ? chineseCrossGablePoint(cross, along, side * across * (1 - t)) : chineseCrossGablePoint(cross, side * across * (1 - t), along);
    haiyueTileRun(b, topTiles, sample, .993, axis * 79 + i + (side + 1) * 31, { pan, eave: Math.abs(along) > d });
  }
  for (let axis = 0; axis < 2; axis++) for (const side of [-1, 1]) {
    const inset = new THREE.Group(); g.add(inset); inset.name = 'haiyue-top-gable-infill'; inset.rotation.y = axis * Math.PI / 2;
    b.put(inset, gableInfillGeometry(innerArmWidth, rise, .15), b.m.redWall, [side * (innerWidth / 2 - .035), cross.eaveY, 0]);
    for (const slope of [-1, 1]) { const points = Array.from({ length: 25 }, (_, i) => chineseCrossGablePoint(cross, side * a, slope * d * (1 - i / 24)).add(V(side * .035, -.04, 0))); b.tube(inset, b.m.greenTile, points, .11, 30, 12); }
  }
  ridge(b, g, innerWidth, cross.eaveY + rise, 0, .84); ridge(b, g, innerWidth, cross.eaveY + rise + .009, Math.PI / 2, .84);
  return g;
}
