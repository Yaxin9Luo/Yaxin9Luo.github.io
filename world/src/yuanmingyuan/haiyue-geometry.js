import * as THREE from 'three';
import { V, meshFromTriangles, extrudedPolygon } from './study-geometry.js';
import { crossPlanOutline } from './chinese-architecture-geometry.js';

export const haiyueRectangle = (width, depth) => [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]];
export const haiyueCircle = (radius, segments = 512) => Array.from({ length: segments }, (_, i) => [radius * Math.sin(i * Math.PI * 2 / segments), radius * Math.cos(i * Math.PI * 2 / segments)]);
export const haiyueStairHole = s => [[s.minX, s.minZ], [s.maxX, s.minZ], [s.maxX, s.maxZ], [s.minX, s.maxZ]];

export function haiyueFloorGeometry(width, bottom, top, hole) {
  if (!(width > 0 && top > bottom)) throw new Error('Invalid Haiyue floor dimensions.');
  return extrudedPolygon(haiyueRectangle(width, width), bottom, top, hole ? [haiyueStairHole(hole).reverse()] : []);
}

// A dressed curved voussoir has actual radial bed faces and a restrained bevel.
// This is a closed editable volume; textures are not used to fake its joints.
export function haiyueArcBlockGeometry({ innerRadius, outerRadius, angle, height, bevel = .014, segments = 12 }) {
  if (!(innerRadius > 0 && outerRadius > innerRadius && angle > 0 && height > 0)) throw new Error('Invalid Haiyue arc block.');
  const e = Math.min(bevel, height / 4, (outerRadius - innerRadius) / 4), section = [[innerRadius + e, 0], [outerRadius - e, 0], [outerRadius, e], [outerRadius, height - e], [outerRadius - e, height], [innerRadius + e, height], [innerRadius, height - e], [innerRadius, e]], triangles = [];
  const point = (i, j) => { const a = (i / segments - .5) * angle, [r, y] = section[j % section.length]; return V(Math.sin(a) * r, y, Math.cos(a) * r); };
  for (let i = 0; i < segments; i++) for (let j = 0; j < section.length; j++) {
    const a = point(i, j), b = point(i + 1, j), c = point(i + 1, j + 1), d = point(i, j + 1);
    triangles.push([a, b, c], [a, c, d]);
  }
  for (const i of [0, segments]) {
    const a = (i / segments - .5) * angle, r = (innerRadius + outerRadius) / 2, center = V(Math.sin(a) * r, height / 2, Math.cos(a) * r);
    for (let j = 0; j < section.length; j++) triangles.push(i === 0 ? [center, point(i, j), point(i, j + 1)] : [center, point(i, j + 1), point(i, j)]);
  }
  const g = meshFromTriangles(triangles); g.name = 'haiyue-dressed-curved-stone'; return g;
}

// Explicit axis fans avoid the collapsed cap quads of LatheGeometry profiles
// that end at radius zero. The profile runs from bottom outward and then up.
export function haiyueLatheGeometry(profile, sides = 28) {
  const triangles = [], at = (p, a) => V(p[0] * Math.sin(a), p[1], p[0] * Math.cos(a));
  for (let j = 1; j < profile.length; j++) {
    const p = profile[j - 1], q = profile[j];
    if (p[0] === 0 && q[0] === 0) continue;
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides, c = (i + 1) * Math.PI * 2 / sides;
      if (p[0] === 0) triangles.push([at(p, a), at(q, c), at(q, a)]);
      else if (q[0] === 0) triangles.push([at(p, a), at(p, c), at(q, a)]);
      else triangles.push([at(p, a), at(p, c), at(q, c)], [at(p, a), at(q, c), at(q, a)]);
    }
  }
  const g = meshFromTriangles(triangles); g.name = 'haiyue-closed-profile-turning'; return g;
}

export function haiyueLatticeSegments({ width, height, pitch = .22, frame = .02 }) {
  const minX = -width / 2 + frame, maxX = width / 2 - frame, minY = frame, maxY = height - frame, result = [];
  if (!(maxX > minX && maxY > minY && pitch > 0)) throw new Error('Invalid Haiyue lattice aperture.');
  // Crossing fine members leave real light openings. A horizontal middle band
  // and shorter squared ends distinguish this pattern from a repeated diamond net.
  for (const sign of [-1, 1]) for (let k = Math.floor((minY - maxX) / pitch) - 2; k < Math.ceil((maxY + maxX) / pitch) + 2; k++) {
    const c = k * pitch, candidates = [[minX, sign * minX + c], [maxX, sign * maxX + c], [(minY - c) / sign, minY], [(maxY - c) / sign, maxY]];
    const points = candidates.filter(([x, y]) => x >= minX - 1e-9 && x <= maxX + 1e-9 && y >= minY - 1e-9 && y <= maxY + 1e-9).filter((p, i, a) => a.findIndex(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7) === i);
    if (points.length === 2 && Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) > .035) result.push({ from: points[0], to: points[1], depth: sign * .012 });
  }
  return result;
}

export function haiyueCloudSpandrelGeometry(width = 1, height = .52, depth = .075) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(width, 0); s.bezierCurveTo(width * .94, -height * .30, width * .68, -height * .42, width * .58, -height * .36); s.bezierCurveTo(width * .72, -height * .77, width * .34, -height * .85, width * .32, -height * .54); s.bezierCurveTo(width * .17, -height * .65, width * .12, -height, 0, -height); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .009, bevelThickness: .009, curveSegments: 18 }); g.translate(0, 0, -depth / 2); return g;
}

// Square skirt with a real cross-shaped aperture for the four gables above.
// Both rings have corresponding radial rays, so the concave valley corners
// meet without intersecting duplicate gabled roofs.
export function haiyueCrossSkirtPoint({ width, innerWidth, innerArmWidth, eaveY, rise, cornerLift = .28 }, edge, u, t) {
  const inner = crossPlanOutline(innerWidth, innerArmWidth), p = inner[edge], q = inner[(edge + 1) % inner.length];
  const project = v => { const s = width / 2 / Math.max(Math.abs(v[0]), Math.abs(v[1])); return [v[0] * s, v[1] * s]; };
  const a = project(p), b = project(q), outerX = THREE.MathUtils.lerp(a[0], b[0], u), outerZ = THREE.MathUtils.lerp(a[1], b[1], u);
  const x = THREE.MathUtils.lerp(outerX, THREE.MathUtils.lerp(p[0], q[0], u), t), z = THREE.MathUtils.lerp(outerZ, THREE.MathUtils.lerp(p[1], q[1], u), t);
  const corner = (Math.abs(outerX * outerZ) / (width * width / 4)) ** 6;
  return V(x, eaveY + rise * t ** 1.68 + cornerLift * corner * (1 - t) ** 2 - .055 * Math.sin(Math.PI * t), z);
}

export function haiyueCrossSkirtGeometry(options) {
  const { columns = 10, courses = 14, thickness = .14 } = options, triangles = [];
  for (let edge = 0; edge < 12; edge++) {
    const p = (u, t, under = false) => { const v = haiyueCrossSkirtPoint(options, edge, u, t); v.y -= under ? thickness : 0; return v; };
    for (const under of [false, true]) for (let j = 0; j < courses; j++) for (let i = 0; i < columns; i++) {
      const u = i / columns, v = (i + 1) / columns, t = j / courses, s = (j + 1) / courses;
      const a = p(u, t, under), b = p(v, t, under), c = p(v, s, under), d = p(u, s, under);
      if (under) triangles.push([a, b, c], [a, c, d]); else triangles.push([a, c, b], [a, d, c]);
    }
    for (let i = 0; i < columns; i++) for (const t of [0, 1]) {
      const u = i / columns, v = (i + 1) / columns, a = p(u, t), b = p(v, t), c = p(v, t, true), d = p(u, t, true);
      if (t) triangles.push([a, c, b], [a, d, c]); else triangles.push([a, b, c], [a, c, d]);
    }
  }
  const g = meshFromTriangles(triangles); g.name = 'haiyue-cross-gable-skirt-with-real-aperture'; return g;
}

export function haiyueStairTreads({ bottom, top, well, count }) {
  if (!(top > bottom && Number.isInteger(count) && count > 0)) throw new Error('Invalid Haiyue stair.');
  const rise = (top - bottom) / (2 * count), pitch = well.run / count, x0 = well.minX + .16 + well.flightWidth / 2, x1 = well.maxX - .16 - well.flightWidth / 2;
  return Array.from({ length: count * 2 }, (_, i) => {
    const second = i >= count, j = i % count;
    return { x: second ? x1 : x0, z: second ? well.entryZ - well.run + (j + .5) * pitch : well.entryZ - (j + .5) * pitch, y: bottom + (i + 1) * rise, width: well.flightWidth, depth: pitch, flight: second ? 1 : 0, step: j, rise };
  });
}
