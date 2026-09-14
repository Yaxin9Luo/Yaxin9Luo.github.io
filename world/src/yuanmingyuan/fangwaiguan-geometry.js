import * as THREE from 'three';
import { V, TAU, meshFromTriangles, extrudedPolygon } from './study-geometry.js';

// Every helper returns caller-owned geometry. No module-scoped mutable cache.
function face(triangles, a, b, c, outward) {
  if (b.clone().sub(a).cross(c.clone().sub(a)).dot(outward) < 0) [b, c] = [c, b];
  triangles.push([a, b, c]);
}
function smoothCoincident(geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, sums = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`;
    if (!sums.has(key)) sums.set(key, { normal: V(0, 0, 0), indices: [] });
    const sum = sums.get(key); sum.normal.add(V(n.getX(i), n.getY(i), n.getZ(i))); sum.indices.push(i);
  }
  for (const { normal, indices } of sums.values()) {
    if (normal.lengthSq() < 1e-10) continue;
    normal.normalize(); for (const i of indices) n.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return geometry;
}

export function openingShape({ x = 0, bottom, width, height, kind = 'segmental' }) {
  const shape = new THREE.Shape(), r = width / 2;
  if (kind === 'oval') {
    shape.absellipse(x, bottom + height / 2, r, height / 2, 0, TAU, false); return shape;
  }
  const spring = bottom + height - width * .19;
  shape.moveTo(x - r, bottom); shape.lineTo(x + r, bottom); shape.lineTo(x + r, spring);
  shape.bezierCurveTo(x + r * .62, bottom + height, x - r * .62, bottom + height, x - r, spring);
  shape.closePath(); return shape;
}
export function openingOutline(opening, padding = 0, z = 0) {
  const shape = openingShape({ ...opening, bottom: opening.bottom - padding, width: opening.width + padding * 2, height: opening.height + padding * 2 });
  return shape.getPoints(32).map(p => [p.x, p.y, z]);
}
export function wallWithOpenings(width, bottom, top, thickness, openings) {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, bottom), new THREE.Vector2(width / 2, bottom), new THREE.Vector2(width / 2, top), new THREE.Vector2(-width / 2, top)]);
  for (const opening of openings) shape.holes.push(new THREE.Path(openingShape(opening).getPoints(36)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -thickness); return geometry;
}

// Solid, ogee-section moulding: the silhouette has flat beds and recessed curves.
export function mouldingSweep(points, width, depth, segments = 28, axis = V(0, 0, 1)) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V(...p)));
  const profile = [[-.5, -.45], [.5, -.45], [.5, -.2], [.37, -.08], [.34, .12], [.47, .27], [.5, .43], [.38, .5], [-.38, .5], [-.5, .43], [-.47, .27], [-.34, .12], [-.37, -.08], [-.5, -.2]];
  const rings = [], centers = [], triangles = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    let normal = axis.clone().addScaledVector(tangent, -axis.dot(tangent));
    if (normal.lengthSq() < .001) normal = V(1, 0, 0).addScaledVector(tangent, -tangent.x);
    normal.normalize(); const across = normal.clone().cross(tangent).normalize(); centers.push(center);
    rings.push(profile.map(([u, v]) => center.clone().addScaledVector(across, width * u).addScaledVector(normal, depth * v)));
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < profile.length; j++) {
    const k = (j + 1) % profile.length, [a, b, c, d] = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]];
    const outward = a.clone().add(b).add(c).add(d).multiplyScalar(.25).sub(centers[i].clone().lerp(centers[i + 1], .5));
    face(triangles, a, b, c, outward); face(triangles, a, c, d, outward);
  }
  for (const end of [0, segments]) for (let j = 0; j < profile.length; j++) face(triangles, centers[end], rings[end][j], rings[end][(j + 1) % profile.length], curve.getTangent(end ? 1 : 0).multiplyScalar(end ? 1 : -1));
  return meshFromTriangles(triangles);
}

export function squarePearBaluster(height = 1, radius = .18) {
  const profile = [[.92, 0], [.92, .08], [.65, .12], [.57, .23], [.86, .31], [1, .43], [.89, .55], [.48, .67], [.40, .80], [.64, .85], [.90, .90], [.90, 1]];
  const sides = 16, rings = profile.map(([r, y]) => Array.from({ length: sides }, (_, i) => {
    const a = TAU * i / sides, c = Math.cos(a), s = Math.sin(a);
    return V(Math.sign(c) * Math.abs(c) ** .64 * r * radius, y * height, Math.sign(s) * Math.abs(s) ** .64 * r * radius);
  })), triangles = [];
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, [a, b, c, d] = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]], out = a.clone().setY(0);
    face(triangles, a, b, c, out); face(triangles, a, c, d, out);
  }
  for (const end of [0, rings.length - 1]) for (let i = 0; i < sides; i++) face(triangles, V(0, profile[end][1] * height, 0), rings[end][i], rings[end][(i + 1) % sides], V(0, end ? 1 : -1, 0));
  return smoothCoincident(meshFromTriangles(triangles));
}

export function stairPoint(side, t, offset = 0) {
  const a = t * Math.PI / 2, x = side * (7.65 + 4.4 * Math.cos(a)), z = 8.65 - 5.1 * Math.sin(a);
  const tangent = V(-side * 4.4 * Math.sin(a), 0, -5.1 * Math.cos(a)).normalize();
  const outward = V(side * Math.cos(a), 0, -Math.sin(a)).normalize();
  return { point: V(x, 0, z).addScaledVector(outward, offset), tangent, outward };
}
export function curvedStairTread(side, start, end, width, underside, top) {
  const polygon = [];
  for (let i = 0; i <= 5; i++) { const p = stairPoint(side, start + (end - start) * i / 5, width / 2).point; polygon.push([p.x, p.z]); }
  for (let i = 5; i >= 0; i--) { const p = stairPoint(side, start + (end - start) * i / 5, -width / 2).point; polygon.push([p.x, p.z]); }
  return extrudedPolygon(polygon, underside, top);
}

// A solid ramped rail curb overlaps the stair edges, so balusters never hover
// over a changing step height. The central walkable treads remain horizontal.
export function stairCurbGeometry(side, offset, width, rise, cap = .32) {
  const rings = [], centers = [], triangles = [], segments = 56;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, left = stairPoint(side, t, offset - width / 2).point, right = stairPoint(side, t, offset + width / 2).point, top = t * rise + cap;
    rings.push([left.clone().setY(-.04), right.clone().setY(-.04), right.clone().setY(top), left.clone().setY(top)]);
    centers.push(left.clone().lerp(right, .5).setY((top - .04) / 2));
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4, [a, b, c, d] = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]], out = a.clone().add(b).add(c).add(d).multiplyScalar(.25).sub(centers[i].clone().lerp(centers[i + 1], .5));
    face(triangles, a, b, c, out); face(triangles, a, c, d, out);
  }
  for (const end of [0, segments]) for (let j = 0; j < 4; j++) face(triangles, centers[end], rings[end][j], rings[end][(j + 1) % 4], stairPoint(side, end ? 1 : 0).tangent.multiplyScalar(end ? 1 : -1));
  return meshFromTriangles(triangles);
}

// Two-sided, closed roof shell. topDepth > 0 avoids collapsed ridge triangles.
export function hipRoofGeometry({ width, depth, topWidth, topDepth, eaveY, topY, thickness = .16, curve = .12 }) {
  const triangles = [], rows = 12, columns = 20;
  const ringPoint = (side, u, v, under) => {
    const w = THREE.MathUtils.lerp(width, topWidth, v), d = THREE.MathUtils.lerp(depth, topDepth, v);
    const y = THREE.MathUtils.lerp(eaveY, topY, v) - curve * Math.sin(v * Math.PI) - (under ? thickness : 0);
    return side === 0 ? V((u - .5) * w, y, d / 2) : side === 1 ? V(w / 2, y, (.5 - u) * d) : side === 2 ? V((.5 - u) * w, y, -d / 2) : V(-w / 2, y, (u - .5) * d);
  };
  for (const under of [false, true]) for (let side = 0; side < 4; side++) for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const a = ringPoint(side, c / columns, r / rows, under), b = ringPoint(side, (c + 1) / columns, r / rows, under), d = ringPoint(side, c / columns, (r + 1) / rows, under), e = ringPoint(side, (c + 1) / columns, (r + 1) / rows, under);
    face(triangles, a, b, e, V(0, under ? -1 : 1, 0)); face(triangles, a, e, d, V(0, under ? -1 : 1, 0));
  }
  for (const v of [0, 1]) for (let side = 0; side < 4; side++) for (let c = 0; c < columns; c++) {
    const a = ringPoint(side, c / columns, v, false), b = ringPoint(side, (c + 1) / columns, v, false), d = ringPoint(side, c / columns, v, true), e = ringPoint(side, (c + 1) / columns, v, true), out = a.clone().setY(0).multiplyScalar(v ? -1 : 1);
    face(triangles, a, b, e, out); face(triangles, a, e, d, out);
  }
  return meshFromTriangles(triangles);
}

// One closed clay tile following the roof fall. t increases uphill: the low end
// of every later course is lifted over the preceding tile, leaving a real lap.
// Barrel edges bear on neighbouring concave pan tiles; neither is a long strip.
export function hipRoofTileGeometry(roof, { side, u0, u1, t0, t1, barrel = false, overlap = false }) {
  if (!Number.isInteger(side) || side < 0 || side > 3 || u0 < 0 || u1 > 1 || u0 >= u1 || t0 < 0 || t1 > 1 || t0 >= t1) throw new RangeError('A roof tile needs one nondegenerate patch within a roof face.');
  const { width, depth, topWidth, topDepth, eaveY, topY, curve = .12 } = roof;
  const rows = 3, columns = barrel ? 10 : 4, triangles = [], thickness = .012;
  const point = (u, v, under) => {
    const t = THREE.MathUtils.lerp(t0, t1, v), s = THREE.MathUtils.lerp(u0, u1, u);
    const w = THREE.MathUtils.lerp(width, topWidth, t), d = THREE.MathUtils.lerp(depth, topDepth, t);
    const tileWidth = (side % 2 ? d : w) * (u1 - u0);
    const crown = barrel ? Math.sin(Math.PI * u) * Math.min(.055, tileWidth * .54) : (2 * u - 1) ** 2 * Math.min(.014, tileWidth * .12);
    const lift = (barrel ? .024 : .012) + (overlap ? thickness * (1 - v) : 0);
    const y = THREE.MathUtils.lerp(eaveY, topY, t) - curve * Math.sin(t * Math.PI) + lift + crown - (under ? thickness : 0);
    return side === 0 ? V((s - .5) * w, y, d / 2) : side === 1 ? V(w / 2, y, (.5 - s) * d) : side === 2 ? V((.5 - s) * w, y, -d / 2) : V(-w / 2, y, (s - .5) * d);
  };
  for (const under of [false, true]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = point(column / columns, row / rows, under), b = point((column + 1) / columns, row / rows, under), c = point((column + 1) / columns, (row + 1) / rows, under), d = point(column / columns, (row + 1) / rows, under);
    const outward = V(0, under ? -1 : 1, 0);
    face(triangles, a, b, c, outward); face(triangles, a, c, d, outward);
  }
  for (const u of [0, 1]) for (let row = 0; row < rows; row++) {
    const a = point(u, row / rows, false), b = point(u, (row + 1) / rows, false), c = point(u, (row + 1) / rows, true), d = point(u, row / rows, true);
    const outward = point(u, (row + .5) / rows, false).sub(point(1 - u, (row + .5) / rows, false));
    face(triangles, a, b, c, outward); face(triangles, a, c, d, outward);
  }
  for (const v of [0, 1]) for (let column = 0; column < columns; column++) {
    const a = point(column / columns, v, false), b = point((column + 1) / columns, v, false), c = point((column + 1) / columns, v, true), d = point(column / columns, v, true);
    const outward = point((column + .5) / columns, v, false).sub(point((column + .5) / columns, 1 - v, false));
    face(triangles, a, b, c, outward); face(triangles, a, c, d, outward);
  }
  const geometry = meshFromTriangles(triangles);
  geometry.userData = { body: barrel ? 'individual-hollow-barrel-tile' : 'individual-concave-pan-tile', thickness, uphillOverlap: overlap, evidence: 'authored-tile-proportions-not-an-excavated-Fangwaiguan-tile' };
  return geometry;
}
export function pavilionRoofGeometry(radius, innerRadius, eaveY, topY, sides = 8) {
  const triangles = [], rows = 10;
  const point = (side, u, t, under) => {
    const a = Math.PI / 8 + side * TAU / sides, b = a + TAU / sides;
    const r = THREE.MathUtils.lerp(radius, innerRadius, t);
    return V(THREE.MathUtils.lerp(Math.cos(a), Math.cos(b), u) * r, THREE.MathUtils.lerp(eaveY, topY, t) - .14 * Math.sin(t * Math.PI) + .08 * (2 * u - 1) ** 4 * (1 - t) - (under ? .13 : 0), THREE.MathUtils.lerp(Math.sin(a), Math.sin(b), u) * r);
  };
  for (const under of [false, true]) for (let side = 0; side < sides; side++) for (let row = 0; row < rows; row++) for (let j = 0; j < 12; j++) {
    const a = point(side, j / 12, row / rows, under), b = point(side, (j + 1) / 12, row / rows, under), c = point(side, (j + 1) / 12, (row + 1) / rows, under), d = point(side, j / 12, (row + 1) / rows, under), out = V(0, under ? -1 : 1, 0);
    face(triangles, a, b, c, out); face(triangles, a, c, d, out);
  }
  for (const t of [0, 1]) for (let side = 0; side < sides; side++) for (let j = 0; j < 12; j++) {
    const a = point(side, j / 12, t, false), b = point(side, (j + 1) / 12, t, false), c = point(side, (j + 1) / 12, t, true), d = point(side, j / 12, t, true), out = a.clone().setY(0).multiplyScalar(t ? -1 : 1);
    face(triangles, a, b, c, out); face(triangles, a, c, d, out);
  }
  return meshFromTriangles(triangles);
}

export function bambooPoleGeometry(length = 1, radius = .075) {
  const points = [], nodes = Math.max(2, Math.round(length / .42));
  for (let i = 0; i <= nodes; i++) {
    const y = length * i / nodes, taper = 1 - .075 * i / nodes;
    for (const [dy, factor] of [[-.035, 1], [-.017, 1.14], [.015, 1.14], [.034, 1]]) if (y + dy >= 0 && y + dy <= length) points.push(new THREE.Vector2(radius * factor * taper, y + dy));
  }
  points.unshift(new THREE.Vector2(0, 0), new THREE.Vector2(radius, 0));
  points.push(new THREE.Vector2(radius * .925, length), new THREE.Vector2(0, length));
  return new THREE.LatheGeometry(points, 12);
}

export function reliefLeaf() {
  const shape = new THREE.Shape(); shape.moveTo(0, -.45);
  shape.bezierCurveTo(-.08, -.34, -.35, -.34, -.27, -.13); shape.lineTo(-.38, -.05); shape.lineTo(-.23, .1);
  shape.bezierCurveTo(-.38, .16, -.22, .42, -.11, .31); shape.bezierCurveTo(-.13, .5, -.03, .51, 0, .6);
  shape.bezierCurveTo(.03, .51, .13, .5, .11, .31); shape.bezierCurveTo(.22, .42, .38, .16, .23, .1);
  shape.lineTo(.38, -.05); shape.lineTo(.27, -.13); shape.bezierCurveTo(.35, -.34, .08, -.34, 0, -.45); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: .075, bevelEnabled: true, bevelSize: .018, bevelThickness: .024, bevelSegments: 2, curveSegments: 12 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, p.getZ(i) + .12 * (y + .45) ** 3 + .035 * Math.cos(x * 8) * Math.sin((y + .45) * Math.PI)); }
  g.computeVertexNormals(); return g;
}
export function reliefShell(width = 1, height = .65, depth = .18) {
  const triangles = [], columns = 48, rows = 18;
  const point = (u, t, back) => { const a = -.48 * Math.PI + .96 * Math.PI * u, r = .055 + .945 * t; return V(Math.sin(a) * width * .5 * r, Math.cos(a) * height * r, back ? -.04 : depth * r ** 1.4 + .022 * Math.cos(u * TAU * 9) * Math.sin(t * Math.PI)); };
  for (const back of [false, true]) for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const a = point(c / columns, r / rows, back), b = point((c + 1) / columns, r / rows, back), e = point((c + 1) / columns, (r + 1) / rows, back), d = point(c / columns, (r + 1) / rows, back), out = V(0, 0, back ? -1 : 1);
    face(triangles, a, b, e, out); face(triangles, a, e, d, out);
  }
  for (const side of [0, 1]) for (let r = 0; r < rows; r++) {
    const a = point(side, r / rows, false), b = point(side, (r + 1) / rows, false), c = point(side, (r + 1) / rows, true), d = point(side, r / rows, true);
    face(triangles, a, b, c, V(side ? 1 : -1, 0, 0)); face(triangles, a, c, d, V(side ? 1 : -1, 0, 0));
  }
  for (const end of [0, 1]) for (let c = 0; c < columns; c++) {
    const a = point(c / columns, end, false), b = point((c + 1) / columns, end, false), e = point((c + 1) / columns, end, true), d = point(c / columns, end, true), out = V(0, end ? 1 : -1, 0);
    face(triangles, a, b, e, out); face(triangles, a, e, d, out);
  }
  return meshFromTriangles(triangles);
}
