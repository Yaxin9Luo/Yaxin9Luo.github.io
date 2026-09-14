import * as THREE from 'three';
import { V, TAU, meshFromTriangles, extrudedPolygon } from './study-geometry.js';

// Pure, caller-owned geometry. No materials, scene objects or global caches.
export function galleryCurve(side) {
  return new THREE.CubicBezierCurve3(V(side * 15, 0, 3.8), V(side * 24, 0, 4.0), V(side * 36.4, 0, 15.5), V(side * 38, 0, 28.2));
}

export function galleryOffset(curve, t, distance = 0, y = 0) {
  const p = curve.getPointAt(t), tangent = curve.getTangentAt(t).normalize();
  return V(p.x - tangent.z * distance, y, p.z + tangent.x * distance);
}

export function curvedStrip(curve, halfWidth, bottom, top, segments = 80) {
  const points = [];
  for (let i = 0; i <= segments; i++) { const p = galleryOffset(curve, i / segments, halfWidth); points.push([p.x, p.z]); }
  for (let i = segments; i >= 0; i--) { const p = galleryOffset(curve, i / segments, -halfWidth); points.push([p.x, p.z]); }
  return extrudedPolygon(points, bottom, top);
}

// Deform a local XY arch bay and its Z thickness along a real continuous path.
// The bay maps x=-width/2..width/2 onto equal arc-length fractions t0..t1.
export function bendBayGeometry(source, curve, t0, t1, width, offset) {
  const geometry = source.clone(), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const t = THREE.MathUtils.clamp(t0 + (x / width + .5) * (t1 - t0), 0, 1), p = galleryOffset(curve, t, offset + z, y);
    positions.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals(); return geometry;
}

export function flowerOutline(kind, centerX, centerZ, rx, rz, count = 160) {
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU;
    const r = kind === 'chrysanthemum' ? 1 + .105 * Math.cos(a * 16) : 1 + .115 * Math.cos(a * 4) + .032 * Math.cos(a * 8);
    return [centerX + Math.sin(a) * rx * r, centerZ + Math.cos(a) * rz * r];
  });
}

// Four hipped slopes, a closed thick eave, and separate overlapping round-ended
// fish-scale tiles. Returned geometry is all newly owned by the calling builder.
export function fishScaleRoofGeometry(width, depth, eave, rise) {
  const roofFaces = [], edgeFaces = [], tileFaces = [], ridges = [], polygon = [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]];
  const inner = polygon.map(([x, z]) => [Math.sign(x) * Math.max(0, (width - depth) / 2), Math.sign(z) * Math.max(0, (depth - width) / 2)]);
  const sample = (face, u, v, lift = 0) => {
    const next = (face + 1) % 4;
    const x0 = inner[face][0] + (inner[next][0] - inner[face][0]) * u, z0 = inner[face][1] + (inner[next][1] - inner[face][1]) * u;
    const x1 = polygon[face][0] + (polygon[next][0] - polygon[face][0]) * u, z1 = polygon[face][1] + (polygon[next][1] - polygon[face][1]) * u;
    const corner = Math.abs(u - .5) * 2;
    return V(x0 + (x1 - x0) * v, eave + rise * (1 - v) ** .90 + .24 * v ** 8 + .13 * corner ** 6 * v ** 6 + lift, z0 + (z1 - z0) * v);
  };
  function upward(list, a, b, c) { if (b.clone().sub(a).cross(c.clone().sub(a)).y < 0) [b, c] = [c, b]; list.push([a, b, c]); }
  for (let face = 0; face < 4; face++) {
    const edgeLength = face % 2 ? depth : width, rows = Math.max(10, Math.ceil(Math.min(width, depth) / .54)), columns = Math.max(6, Math.ceil(edgeLength / .235));
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const a = sample(face, col / columns, row / rows), b = sample(face, (col + 1) / columns, row / rows), c = sample(face, (col + 1) / columns, (row + 1) / rows), d = sample(face, col / columns, (row + 1) / rows);
      upward(roofFaces, a, b, c); upward(roofFaces, a, c, d);
    }
    for (let row = 1; row < rows; row++) {
      const v = (row + .10) / rows, dv = .69 / rows;
      const tileCount = Math.max(3, Math.floor(columns * (.28 + .72 * v)));
      for (let tile = 0; tile < tileCount; tile++) {
        const center = (tile + .5 + (row % 2 ? .12 : -.12)) / tileCount, hu = .53 / tileCount;
        const uv = [[center - hu, v - dv], [center + hu, v - dv], [center + hu, v + dv * .25]];
        for (let j = 1; j <= 8; j++) { const a = j / 8 * Math.PI; uv.push([center + Math.cos(a) * hu, v + dv * .25 + Math.sin(a) * dv * .69]); }
        const front = uv.map(([u, t]) => sample(face, THREE.MathUtils.clamp(u, .001, .999), THREE.MathUtils.clamp(t, .002, 1), .037 + .019 * Math.sin((u - center) / hu * Math.PI / 2) ** 2));
        const back = front.map(p => p.clone().add(V(0, -.031, 0))), centerPoint = sample(face, center, v, .040), centerBack = centerPoint.clone().add(V(0, -.031, 0));
        for (let j = 0; j < front.length; j++) {
          const next = (j + 1) % front.length; upward(tileFaces, centerPoint, front[j], front[next]);
          let a = centerBack, b = back[next], c = back[j]; if (b.clone().sub(a).cross(c.clone().sub(a)).y > 0) [b, c] = [c, b]; tileFaces.push([a, b, c]);
          const aa = front[j], bb = front[next], cc = back[next], dd = back[j]; tileFaces.push([aa, cc, bb], [aa, dd, cc]);
        }
      }
    }
    const rim = [];
    for (let col = 0; col <= columns; col++) {
      const p = sample(face, col / columns, 1), low = p.clone().setY(eave - .18); rim.push(p.toArray());
      if (col) { const previous = sample(face, (col - 1) / columns, 1), previousLow = previous.clone().setY(eave - .18); edgeFaces.push([previous, p, low], [previous, low, previousLow]); }
    }
    ridges.push({ type: 'eave', points: rim });
    ridges.push({ type: 'hip', points: Array.from({ length: 25 }, (_, i) => sample(face, 0, i / 24, .045).toArray()) });
  }
  return { roof: meshFromTriangles(roofFaces), edges: meshFromTriangles(edgeFaces), tiles: meshFromTriangles(tileFaces), underside: extrudedPolygon(polygon, eave - .23, eave - .18), ridges };
}
