import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, meshFromTriangles } from './study-geometry.js';

// All dimensions are authored working metres. These helpers express construction
// surfaces, not a claim that an unmeasured Qing roof profile has been recovered.
export function chineseHipPoint(options, face, u, t) {
  const { width, depth, topWidth = Math.max(0, width - depth), topDepth = 0, eaveY = 0, rise = 2, cornerLift = .30 } = options;
  const hx = THREE.MathUtils.lerp(width / 2, topWidth / 2, t), hz = THREE.MathUtils.lerp(depth / 2, topDepth / 2, t);
  const y = eaveY + rise * Math.pow(t, 1.72) - Math.min(.13, rise * .06) * Math.sin(Math.PI * t)
    + cornerLift * Math.pow(Math.abs(u), 6) * Math.pow(1 - t, 2);
  if (face === 0) return V(u * hx, y, hz);
  if (face === 1) return V(hx, y, -u * hz);
  if (face === 2) return V(-u * hx, y, -hz);
  return V(-hx, y, u * hz);
}

export function chineseHipRafterPath(options, face, u, radius = .13) {
  const thickness = options.thickness ?? .14, epsilon = .0001;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, normalT = t === 1 ? 1 - epsilon : t, low = Math.max(0, normalT - epsilon), high = Math.min(1, normalT + epsilon);
    const p = chineseHipPoint(options, face, u, t);
    const du = chineseHipPoint(options, face, u + epsilon, normalT).sub(chineseHipPoint(options, face, u - epsilon, normalT));
    const dt = chineseHipPoint(options, face, u, high).sub(chineseHipPoint(options, face, u, low));
    const normal = du.cross(dt).normalize(); if (normal.y < 0) normal.negate();
    // A round rafter needs radius / normal.y of vertical clearance. Keep its
    // horizontal path under the roof: shifting along the normal crosses the
    // ridge at a pyramidal apex and pushes its end cap through the other face.
    p.y -= thickness - .012 + radius / normal.y;
    return p;
  });
}

export function quarriedMasonryBlockGeometry(seed = 0) {
  const geometry = new RoundedBoxGeometry(1, 1, 1, 4, .047), p = geometry.getAttribute('position');
  const phase = seed * 1.713;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + .018 * Math.sin(y * 8 + z * 5 + phase) + .012 * y * z,
      y + .012 * Math.sin(x * 7 - z * 6 + phase * .63),
      z + .018 * Math.sin(x * 8 + y * 7 + phase * 1.17) + .012 * Math.cos(x * 14 - y * 5 + phase));
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), shared = new Map();
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
  for (let i = 0; i < p.count; i++) {
    const k = key(i); if (!shared.has(k)) shared.set(k, new THREE.Vector3());
    shared.get(k).add(new THREE.Vector3().fromBufferAttribute(normals, i));
  }
  for (let i = 0; i < p.count; i++) {
    const n = shared.get(key(i)).clone().normalize(); normals.setXYZ(i, n.x, n.y, n.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'closed-quarried-block-with-dressed-bed-faces', source: 'authored-stone-coursing-not-an-excavation-drawing', seed };
  return geometry;
}

export function clipPavingCell(outline, minX, maxX, minZ, maxZ) {
  let points = outline.map(p => [...p]);
  for (const [axis, boundary, sign] of [[0, minX, 1], [0, maxX, -1], [1, minZ, 1], [1, maxZ, -1]]) {
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const insideA = sign * (a[axis] - boundary) >= 0, insideB = sign * (b[axis] - boundary) >= 0;
      if (insideA) next.push(a);
      if (insideA !== insideB) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    points = next; if (!points.length) break;
  }
  return points;
}

function upwardTriangle(out, a, b, c, top) {
  const positive = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).y >= 0;
  out.push(positive === top ? [a, b, c] : [a, c, b]);
}

export function chineseHipRoofGeometry(options) {
  const { thickness = .14, segments = 28, courses = 16, topDepth = 0 } = options;
  const triangles = [];
  for (let face = 0; face < 4; face++) {
    const point = (u, t, bottom = false) => { const p = chineseHipPoint(options, face, u, t); if (bottom) p.y -= thickness; return p; };
    for (let row = 0; row < courses; row++) for (let column = 0; column < segments; column++) {
      const u = column / segments * 2 - 1, v = (column + 1) / segments * 2 - 1, t = row / courses, s = (row + 1) / courses;
      for (const bottom of [false, true]) {
        const a = point(u, t, bottom), b = point(v, t, bottom), c = point(v, s, bottom), d = point(u, s, bottom);
        upwardTriangle(triangles, a, b, c, !bottom); upwardTriangle(triangles, a, c, d, !bottom);
      }
    }
    // Adjacent faces share corner seams. A closed ridge has no internal cap;
    // a truncated lower tier gets an inner vertical rim around its real opening.
    for (const t of topDepth > 0 ? [0, 1] : [0]) for (let column = 0; column < segments; column++) {
      const u = column / segments * 2 - 1, v = (column + 1) / segments * 2 - 1;
      const a = point(u, t), b = point(v, t), c = point(v, t, true), d = point(u, t, true);
      if (t === 0) triangles.push([a, c, b], [a, d, c]);
      else triangles.push([a, b, c], [a, c, d]);
    }
  }
  return meshFromTriangles(triangles);
}

export function chineseGablePoint({ width, depth, eaveY = 0, rise = 2 }, side, u, t) {
  return V(u * width / 2, eaveY + rise * Math.pow(t, 1.50), side * depth / 2 * (1 - t));
}

export function chineseGableRoofGeometry(options) {
  const { thickness = .14, segments = 24, courses = 14 } = options, triangles = [];
  const point = (side, u, t, bottom = false) => { const p = chineseGablePoint(options, side, u, t); if (bottom) p.y -= thickness; return p; };
  for (const side of [-1, 1]) {
    for (let row = 0; row < courses; row++) for (let col = 0; col < segments; col++) {
      const u = col / segments * 2 - 1, v = (col + 1) / segments * 2 - 1, t = row / courses, s = (row + 1) / courses;
      for (const bottom of [false, true]) {
        const a = point(side, u, t, bottom), b = point(side, v, t, bottom), c = point(side, v, s, bottom), d = point(side, u, s, bottom);
        upwardTriangle(triangles, a, b, c, !bottom); upwardTriangle(triangles, a, c, d, !bottom);
      }
    }
    const strip = (a, b, c, d, outward) => {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (n.dot(outward) >= 0) triangles.push([a, b, c], [a, c, d]);
      else triangles.push([a, c, b], [a, d, c]);
    };
    for (let col = 0; col < segments; col++) {
      const u = col / segments * 2 - 1, v = (col + 1) / segments * 2 - 1;
      strip(point(side, u, 0), point(side, v, 0), point(side, v, 0, true), point(side, u, 0, true), V(0, 0, side));
    }
    for (const u of [-1, 1]) for (let row = 0; row < courses; row++) {
      const t = row / courses, s = (row + 1) / courses;
      strip(point(side, u, t), point(side, u, s), point(side, u, s, true), point(side, u, t, true), V(u, 0, 0));
    }
  }
  return meshFromTriangles(triangles);
}

export function gableInfillGeometry(depth, rise, thickness = .16) {
  const outline = [new THREE.Vector2(-depth / 2, -.16)];
  for (let i = 0; i <= 12; i++) outline.push(new THREE.Vector2(-depth / 2 * (1 - i / 12), rise * Math.pow(i / 12, 1.5) - .06));
  for (let i = 11; i >= 0; i--) outline.push(new THREE.Vector2(depth / 2 * (1 - i / 12), rise * Math.pow(i / 12, 1.5) - .06));
  outline.push(new THREE.Vector2(depth / 2, -.16));
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -thickness / 2); geometry.rotateY(Math.PI / 2);
  return geometry;
}

// A solid swept tile section: outer and inner half circles, side lips, both end
// caps. It is not a cylinder painted onto a flat rectangular roof.
export function roofTileRollGeometry(points, radius = .09, thickness = .021, arcs = 20) {
  const path = points.map(p => p.isVector3 ? p : V(...p)), inner = radius - thickness;
  const positions = [], uv = [], indices = [], frames = [], rings = [[], []];
  const vertex = (p, u, v) => { const index = positions.length / 3; positions.push(...p.toArray()); uv.push(u, v); return index; };
  const triangle = (a, b, c, normal) => {
    const va = V(...positions.slice(a * 3, a * 3 + 3)), vb = V(...positions.slice(b * 3, b * 3 + 3)), vc = V(...positions.slice(c * 3, c * 3 + 3));
    indices.push(...(vb.sub(va).cross(vc.sub(va)).dot(normal) >= 0 ? [a, b, c] : [a, c, b]));
  };
  const quad = (points, normal) => {
    const ids = points.map((p, i) => vertex(p, i % 2, i < 2 ? 0 : 1));
    triangle(ids[0], ids[1], ids[2], normal); triangle(ids[0], ids[2], ids[3], normal);
  };
  for (let row = 0; row < path.length; row++) {
    const tangent = path[Math.min(row + 1, path.length - 1)].clone().sub(path[Math.max(row - 1, 0)]).normalize();
    const side = V(tangent.z, 0, -tangent.x).normalize(), up = tangent.clone().cross(side).normalize(); frames.push({ tangent, side, up });
    for (const layer of [0, 1]) {
      const ring = [], r = layer ? inner : radius;
      for (let column = 0; column <= arcs; column++) {
        const angle = Math.PI * column / arcs;
        ring.push(path[row].clone().addScaledVector(side, r * Math.cos(angle)).addScaledVector(up, r * Math.sin(angle)));
      }
      rings[layer].push(ring);
    }
  }
  // Each cylindrical sheet owns its vertices. End caps and the two clay lips
  // duplicate their boundary vertices so smoothing cannot round the tile ends.
  for (const layer of [0, 1]) {
    const start = positions.length / 3;
    for (let row = 0; row < path.length; row++) for (let column = 0; column <= arcs; column++) vertex(rings[layer][row][column], column / arcs, row / (path.length - 1));
    for (let row = 0; row < path.length - 1; row++) for (let column = 0; column < arcs; column++) {
      const a = start + row * (arcs + 1) + column, b = a + 1, d = a + arcs + 1, c = d + 1;
      indices.push(...(layer ? [a, c, b, a, d, c] : [a, b, c, a, c, d]));
    }
  }
  for (const column of [0, arcs]) for (let row = 0; row < path.length - 1; row++) quad([
    rings[0][row][column], rings[1][row][column], rings[1][row + 1][column], rings[0][row + 1][column],
  ], frames[row].up.clone().multiplyScalar(-1));
  for (const row of [0, path.length - 1]) for (let column = 0; column < arcs; column++) quad([
    rings[0][row][column], rings[0][row][column + 1], rings[1][row][column + 1], rings[1][row][column],
  ], frames[row].tangent.clone().multiplyScalar(row === 0 ? -1 : 1));
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { body: 'closed-half-barrel-clay-tile', curvedSurfaceArcs: arcs, smoothSheets: true, hardEndCaps: true };
  return geometry;
}

export function sweptSectionGeometry(points, section) {
  const path = points.map(p => p.isVector3 ? p : V(...p)), triangles = [], rings = [];
  for (let i = 0; i < path.length; i++) {
    const tangent = path[Math.min(i + 1, path.length - 1)].clone().sub(path[Math.max(i - 1, 0)]).normalize();
    const side = V(tangent.z, 0, -tangent.x).normalize(), up = tangent.clone().cross(side).normalize();
    rings.push(section.map(p => path[i].clone().addScaledVector(side, p.x).addScaledVector(up, p.y)));
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < section.length; j++) {
    const next = (j + 1) % section.length, a = rings[i][j], b = rings[i][next], c = rings[i + 1][next], d = rings[i + 1][j];
    triangles.push([a, b, c], [a, c, d]);
  }
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(section, [])) {
    triangles.push([rings[0][c], rings[0][b], rings[0][a]], [rings.at(-1)[a], rings.at(-1)[b], rings.at(-1)[c]]);
  }
  return meshFromTriangles(triangles);
}

export function bracketArmGeometry(length = 1.1, height = .20, depth = .22) {
  const x = length / 2, y = height / 2;
  const shape = new THREE.Shape(); shape.moveTo(-x, y); shape.lineTo(x, y); shape.lineTo(x, -.02 * height);
  shape.bezierCurveTo(x * .98, -height * .26, x * .84, -height * .27, x * .78, -height * .18);
  shape.bezierCurveTo(x * .73, -height * .18, x * .72, -y, x * .53, -y);
  shape.lineTo(-x * .53, -y);
  shape.bezierCurveTo(-x * .72, -y, -x * .73, -height * .18, -x * .78, -height * .18);
  shape.bezierCurveTo(-x * .84, -height * .27, -x * .98, -height * .26, -x, -.02 * height); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, curveSegments: 6, steps: 1, bevelSize: .008, bevelThickness: .008 });
  geometry.translate(0, 0, -depth / 2); return geometry;
}

export function crossPlanOutline(width, armWidth) {
  const a = width / 2, b = armWidth / 2;
  return [[-a, -b], [-b, -b], [-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b]];
}

export function chineseCrossEavePoint({ width, armWidth, topWidth, topArmWidth, eaveY, rise, cornerLift = .28 }, edge, u, t) {
  const outer = crossPlanOutline(width, armWidth), inner = crossPlanOutline(topWidth, topArmWidth), next = (edge + 1) % outer.length;
  const convex = index => {
    const a = outer[(index + outer.length - 1) % outer.length], b = outer[index], c = outer[(index + 1) % outer.length];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0 ? 1 : 0;
  };
  const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(outer[edge][0], outer[next][0], u), THREE.MathUtils.lerp(inner[edge][0], inner[next][0], u), t);
  const z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(outer[edge][1], outer[next][1], u), THREE.MathUtils.lerp(inner[edge][1], inner[next][1], u), t);
  const y = eaveY + rise * t ** 1.72 - .065 * Math.sin(Math.PI * t) + cornerLift * ((1 - u) ** 6 * convex(edge) + u ** 6 * convex(next)) * (1 - t) ** 2;
  return V(x, y, z);
}

export function chineseCrossEaveGeometry(options) {
  const { thickness = .17 } = options, triangles = [], rows = 16, columns = 12;
  for (let edge = 0; edge < 12; edge++) {
    const point = (u, t, under = false) => { const p = chineseCrossEavePoint(options, edge, u, t); p.y -= under ? thickness : 0; return p; };
    for (const under of [false, true]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const u = column / columns, v = (column + 1) / columns, t = row / rows, s = (row + 1) / rows;
      const a = point(u, t, under), b = point(v, t, under), c = point(v, s, under), d = point(u, s, under);
      upwardTriangle(triangles, a, b, c, !under); upwardTriangle(triangles, a, c, d, !under);
    }
    for (const t of [0, 1]) for (let column = 0; column < columns; column++) {
      const a = point(column / columns, t), b = point((column + 1) / columns, t), c = point((column + 1) / columns, t, true), d = point(column / columns, t, true);
      const outward = V(b.z - a.z, 0, a.x - b.x).multiplyScalar(t ? -1 : 1);
      if (b.clone().sub(a).cross(c.clone().sub(a)).dot(outward) > 0) triangles.push([a, b, c], [a, c, d]);
      else triangles.push([a, c, b], [a, d, c]);
    }
  }
  return meshFromTriangles(triangles);
}

export function chineseCrossGablePoint({ width, armWidth, eaveY, rise }, x, z) {
  return V(x, eaveY + rise * Math.max(0, 1 - Math.min(Math.abs(x), Math.abs(z)) / (armWidth / 2)) ** 1.5, z);
}

// Four gabled arms meet along continuous valley lines. This is one shell, not
// two full gable meshes crossing through each other's interiors.
export function chineseCrossGableGeometry(options) {
  const { width, armWidth, thickness = .17 } = options, a = width / 2, b = armWidth / 2, triangles = [];
  const point = (x, z, under = false) => { const p = chineseCrossGablePoint(options, x, z); p.y -= under ? thickness : 0; return p; };
  const rectangles = [[-b, b, -b, b, 32, 32], [b, a, -b, b, 8, 32], [-a, -b, -b, b, 8, 32], [-b, b, b, a, 32, 8], [-b, b, -a, -b, 32, 8]];
  for (const [x0, x1, z0, z1, nx, nz] of rectangles) for (const under of [false, true]) for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const x = THREE.MathUtils.lerp(x0, x1, ix / nx), xx = THREE.MathUtils.lerp(x0, x1, (ix + 1) / nx), z = THREE.MathUtils.lerp(z0, z1, iz / nz), zz = THREE.MathUtils.lerp(z0, z1, (iz + 1) / nz);
    const p = point(x, z, under), q = point(xx, z, under), r = point(xx, zz, under), s = point(x, zz, under);
    if ((x + xx) * (z + zz) >= 0) { upwardTriangle(triangles, p, q, r, !under); upwardTriangle(triangles, p, r, s, !under); }
    else { upwardTriangle(triangles, p, q, s, !under); upwardTriangle(triangles, q, r, s, !under); }
  }
  const outline = crossPlanOutline(width, armWidth);
  for (let edge = 0; edge < outline.length; edge++) {
    const from = outline[edge], to = outline[(edge + 1) % outline.length], steps = Math.abs(from[0]) === a && from[0] === to[0] || Math.abs(from[1]) === a && from[1] === to[1] ? 32 : 8;
    for (let i = 0; i < steps; i++) {
      const x = THREE.MathUtils.lerp(from[0], to[0], i / steps), z = THREE.MathUtils.lerp(from[1], to[1], i / steps), xx = THREE.MathUtils.lerp(from[0], to[0], (i + 1) / steps), zz = THREE.MathUtils.lerp(from[1], to[1], (i + 1) / steps);
      const p = point(x, z), q = point(xx, zz), r = point(xx, zz, true), s = point(x, z, true), outward = V(to[1] - from[1], 0, from[0] - to[0]);
      if (q.clone().sub(p).cross(r.clone().sub(p)).dot(outward) > 0) triangles.push([p, q, r], [p, r, s]);
      else triangles.push([p, r, q], [p, s, r]);
    }
  }
  return meshFromTriangles(triangles);
}

export function ridgeBeastGeometry() {
  // A swelling, rounded body and curled tail are formed by elliptical rings.
  // The snout, forehead and lower jaw overlap this core as solid clay volumes;
  // the mouth remains a real recess between the upper and lower jaws.
  const stations = [[0, .025, .28, .235], [.035, .18, .35, .29], [.09, .38, .29, .31], [.16, .61, .215, .275], [.25, .85, .155, .20], [.32, 1.05, .15, .14], [.24, 1.23, .17, .10], [.065, 1.31, .105, .05], [-.015, 1.335, .012, .012]];
  const curve = new THREE.CatmullRomCurve3(stations.map(([x, y, rx]) => V(x, y, rx))), depthCurve = new THREE.CatmullRomCurve3(stations.map(([, , , rz]) => V(0, 0, rz)));
  const positions = [], uv = [], indices = [], rows = 56, columns = 40;
  for (let row = 0; row <= rows; row++) {
    const p = curve.getPoint(row / rows), rz = Math.max(.006, depthCurve.getPoint(row / rows).z);
    for (let column = 0; column <= columns; column++) {
      const angle = Math.PI * 2 * column / columns; positions.push(p.x + Math.max(.006, p.z) * Math.cos(angle), p.y, rz * Math.sin(angle)); uv.push(column / columns, row / rows);
    }
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column, b = a + 1, d = a + columns + 1, c = d + 1; indices.push(a, c, b, a, d, c);
  }
  for (const row of [0, rows]) {
    const p = curve.getPoint(row / rows), center = positions.length / 3; positions.push(p.x, p.y, 0); uv.push(.5, .5);
    for (let column = 0; column < columns; column++) { const a = row * (columns + 1) + column; indices.push(...(row ? [center, a + 1, a] : [center, a, a + 1])); }
  }
  const core = new THREE.BufferGeometry(); core.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); core.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); core.setIndex(indices); core.computeVertexNormals();
  const parts = [core];
  const ellipsoid = (position, scale) => { const g = new THREE.SphereGeometry(1, 36, 24); g.scale(...scale); g.translate(...position); parts.push(g); };
  ellipsoid([-.20, .45, 0], [.265, .225, .28]);
  ellipsoid([-.26, .615, 0], [.225, .17, .24]);
  ellipsoid([-.475, .425, 0], [.265, .118, .235]);
  ellipsoid([-.47, .185, 0], [.255, .076, .215]);
  for (const side of [-1, 1]) ellipsoid([-.13, .37, side * .225], [.19, .17, .12]);
  const geometry = mergeGeometries(parts); for (const part of parts) part.dispose();
  geometry.userData = { body: 'rounded-glazed-ridge-beast-with-open-mouth', evidence: 'authored-volume-informed-by-comparable-historic-ridge-ornament' };
  return geometry;
}

export function pyramidalFinialGeometry() {
  const profile = new THREE.Path(); profile.moveTo(0, -.055); profile.lineTo(.29, -.055); profile.lineTo(.34, .025);
  profile.bezierCurveTo(.35, .07, .34, .12, .28, .16); profile.bezierCurveTo(.23, .18, .15, .24, .14, .31);
  profile.lineTo(.20, .34); profile.lineTo(.20, .40); profile.lineTo(.135, .43);
  profile.bezierCurveTo(.115, .52, .18, .55, .24, .59); profile.bezierCurveTo(.38, .69, .37, .94, .25, 1.065);
  profile.bezierCurveTo(.18, 1.145, .08, 1.17, 0, 1.18);
  const geometry = new THREE.LatheGeometry(profile.getPoints(12), 64);
  const positions = geometry.attributes.position, clean = [];
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [geometry.index.getX(i), geometry.index.getX(i + 1), geometry.index.getX(i + 2)], p = ids.map(index => V(positions.getX(index), positions.getY(index), positions.getZ(index)));
    if (p[1].sub(p[0]).cross(p[2].sub(p[0])).lengthSq() > 1e-16) clean.push(...ids);
  }
  geometry.setIndex(clean); geometry.normalizeNormals();
  geometry.userData = { body: 'closed-waisted-pearl-pyramidal-finial', evidence: 'finial-type-supported-dimensions-and-lotus-mouldings-inferred' };
  return geometry;
}

export function stoneLotusPetalGeometry() {
  const shape = new THREE.Shape(); shape.moveTo(0, 0);
  shape.bezierCurveTo(-.17, .15, -.16, .39, 0, .55);
  shape.bezierCurveTo(.16, .39, .17, .15, 0, 0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .030, bevelEnabled: true, bevelSize: .012, bevelThickness: .015, bevelSegments: 2, curveSegments: 8 });
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + .034 * Math.sin(Math.PI * p.getY(i) / .55));
  geometry.computeVertexNormals(); return geometry;
}

export function bridgeDeckGeometry(from, to, width = 2.8, deckY = .42, crown = .34) {
  const a = V(from[0], deckY, from[1]), b = V(to[0], deckY, to[1]);
  const points = Array.from({ length: 25 }, (_, i) => { const p = a.clone().lerp(b, i / 24); p.y += crown * Math.sin(Math.PI * i / 24); return p; });
  return sweptSectionGeometry(points, [new THREE.Vector2(-width / 2, 0), new THREE.Vector2(-width / 2, -.30), new THREE.Vector2(width / 2, -.30), new THREE.Vector2(width / 2, 0)]);
}
