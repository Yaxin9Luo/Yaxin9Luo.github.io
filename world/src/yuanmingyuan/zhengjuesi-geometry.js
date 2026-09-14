import * as THREE from 'three';
import { meshFromTriangles, V } from './study-geometry.js';

const finitePositive = (value, name) => { if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`); };

// Unlike a regular rectangular lathe grid, each zero-radius endpoint has one
// vertex. The adjacent surface is a triangle fan, never a collapsed quad. This
// preserves the exact revolved profile and also handles a hollow bell profile.
export function zhengjuesiLatheGeometry(profile, sides = 24) {
  const positions = [], normals = [], uv = [], index = [], rings = [];
  for (let j = 0; j < profile.length; j++) {
    const [radius, y] = profile[j], before = profile[Math.max(0, j - 1)], after = profile[Math.min(profile.length - 1, j + 1)], dr = after[0] - before[0], dy = after[1] - before[1];
    const ring = [], count = radius < 1e-9 ? 1 : sides + 1;
    for (let i = 0; i < count; i++) {
      const a = i / sides * Math.PI * 2, n = V(Math.sin(a) * dy, -dr, Math.cos(a) * dy).normalize();
      ring.push(positions.length / 3); positions.push(radius * Math.sin(a), y, radius * Math.cos(a)); normals.push(n.x, n.y, n.z); uv.push(i / sides, j / (profile.length - 1));
    }
    rings.push(ring);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const lower = rings[j], upper = rings[j + 1];
    if (lower.length === 1 && upper.length === 1) continue;
    for (let i = 0; i < sides; i++) {
      if (lower.length === 1) index.push(lower[0], upper[i + 1], upper[i]);
      else if (upper.length === 1) index.push(lower[i], lower[i + 1], upper[0]);
      else index.push(lower[i], lower[i + 1], upper[i + 1], lower[i], upper[i + 1], upper[i]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData = { body: 'closed-revolved-profile-with-real-axis-fans', profile, sides };
  return geometry;
}
function solidFaceShape(points, depth, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(p => new THREE.Vector2(...p))), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24, steps: 1 });
  geometry.translate(0, 0, -depth / 2); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

// An opening that reaches the ground is a notch in the exterior polygon, not a
// hole sharing an edge with its exterior (which produces non-manifold caps).
export function zhengjuesiArchedWallGeometry({ width = 4.7, height = 4.7, depth = .62, openings = [{ x: 0, radius: 1.4, spring: 2.13 }], segments = 40 } = {}) {
  for (const [k, v] of Object.entries({ width, height, depth })) finitePositive(v, k);
  const sorted = [...openings].sort((a, b) => a.x - b.x), points = [[-width / 2, 0]]; let edge = -width / 2;
  for (const { x, radius, spring } of sorted) {
    if (!(radius > 0 && spring > 0 && spring + radius < height && x - radius > edge && x + radius < width / 2)) throw new Error('Arch overlaps the wall edge, another arch, or its crown.');
    points.push([x - radius, 0], [x - radius, spring]);
    for (let i = 1; i <= segments; i++) { const a = Math.PI * (1 - i / segments); points.push([x + radius * Math.cos(a), spring + radius * Math.sin(a)]); }
    points.push([x + radius, 0]); edge = x + radius;
  }
  points.push([width / 2, 0], [width / 2, height], [-width / 2, height]);
  const geometry = solidFaceShape(points, depth); geometry.userData = { body: 'closed-masonry-with-true-ground-level-arch-notches', openings: sorted }; return geometry;
}

export function zhengjuesiArchSurroundGeometry({ radius = 1.4, spring = 2.13, band = .24, depth = .15, segments = 40 } = {}) {
  const points = [[-radius - band, 0], [-radius - band, spring]];
  for (let i = 1; i <= segments; i++) { const a = Math.PI * (1 - i / segments); points.push([(radius + band) * Math.cos(a), spring + (radius + band) * Math.sin(a)]); }
  points.push([radius + band, 0], [radius, 0], [radius, spring]);
  for (let i = 1; i <= segments; i++) { const a = Math.PI * i / segments; points.push([radius * Math.cos(a), spring + radius * Math.sin(a)]); }
  points.push([-radius, 0]);
  const geometry = solidFaceShape(points, depth); geometry.userData = { body: 'continuous-stone-arch-and-jambs-with-an-open-centre' }; return geometry;
}

// A true half-door follows the stone arch, so a rotated door does not become a
// rectangular board protruding through the crown. Hinge is at x=0 in leaf space.
export function zhengjuesiArchDoorGeometry({ radius = 1.4, spring = 2.13, side = -1, depth = .10, segments = 24 } = {}) {
  const gap = .024, points = [[0, .025], [-side * (radius - gap), .025], [-side * (radius - gap), spring + radius - gap]];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments, x = side * radius * t, y = spring + Math.sqrt(Math.max(0, radius * radius - x * x));
    points.push([x - side * radius, y - gap]);
  }
  const geometry = solidFaceShape(points, depth); geometry.userData = { body: 'arched-wood-door-leaf', side }; return geometry;
}

export function octagonPoint(apothem, face, u, y = 0) {
  const angle = face * Math.PI / 4, half = apothem * Math.tan(Math.PI / 8);
  return V(Math.sin(angle) * apothem + Math.cos(angle) * half * u, y, Math.cos(angle) * apothem - Math.sin(angle) * half * u);
}

export function zhengjuesiOctagonalRoofPoint(options, face, u, t) {
  const { apothem, topApothem = 0, eaveY, rise, cornerLift = .35 } = options;
  const a = THREE.MathUtils.lerp(apothem, topApothem, t);
  // Curved roof boards flatten near the eave and rise toward the crown. The
  // corner term agrees on both sides of every hip; no eight disconnected cones.
  const y = eaveY + rise * Math.pow(t, 1.52) - .07 * Math.sin(Math.PI * t)
    + cornerLift * Math.pow(Math.abs(u), 5) * (1 - t) ** 2;
  return octagonPoint(a, face, u, y);
}

export function zhengjuesiOctagonalRoofGeometry(options) {
  const { apothem, topApothem = 0, thickness = .16, sectors = 12, courses = 20 } = options;
  if (!(apothem > topApothem && topApothem >= 0 && thickness > 0)) throw new Error('Invalid octagonal roof radii.');
  const triangles = [];
  const point = (f, u, t, bottom) => { const p = zhengjuesiOctagonalRoofPoint(options, f, u, t); if (bottom) p.y -= thickness; return p; };
  const add = (a, b, c, normal) => { const n = b.clone().sub(a).cross(c.clone().sub(a)); triangles.push(n.dot(normal) > 0 ? [a, b, c] : [a, c, b]); };
  for (let face = 0; face < 8; face++) {
    for (let row = 0; row < courses; row++) for (let col = 0; col < sectors; col++) {
      const u = -1 + 2 * col / sectors, v = -1 + 2 * (col + 1) / sectors, t = row / courses, s = (row + 1) / courses;
      for (const bottom of [false, true]) {
        const a = point(face, u, t, bottom), b = point(face, v, t, bottom), c = point(face, v, s, bottom), d = point(face, u, s, bottom), normal = V(0, bottom ? -1 : 1, 0);
        add(a, b, c, normal); add(a, c, d, normal);
      }
    }
    for (const t of topApothem > 0 ? [0, 1] : [0]) for (let col = 0; col < sectors; col++) {
      const u = -1 + 2 * col / sectors, v = -1 + 2 * (col + 1) / sectors;
      const a = point(face, u, t, false), b = point(face, v, t, false), c = point(face, v, t, true), d = point(face, u, t, true);
      const outward = octagonPoint(1, face, 0).multiplyScalar(t ? -1 : 1);
      add(a, b, c, outward); add(a, c, d, outward);
    }
  }
  const geometry = meshFromTriangles(triangles); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: topApothem ? 'closed-octagonal-roof-ring-with-real-central-opening' : 'closed-eight-hip-pyramidal-roof', roofOptions: { ...options } };
  return geometry;
}

export function zhengjuesiLatticeSegments({ width, height, pitch = .28, margin = .025 } = {}) {
  finitePositive(width, 'width'); finitePositive(height, 'height'); finitePositive(pitch, 'pitch');
  const xmin = -width / 2 + margin, xmax = width / 2 - margin, ymin = margin, ymax = height - margin;
  if (xmax <= xmin || ymax <= ymin) return [];
  const result = [];
  // Two sets of diagonals are clipped to the actual sash aperture. They never
  // continue beyond the frame, and there is no alpha plane filling the opening.
  for (const slope of [-1, 1]) for (let c = -width - height; c <= width + height; c += pitch * Math.SQRT2) {
    const intersections = [[xmin, slope * xmin + c], [xmax, slope * xmax + c], [(ymin - c) / slope, ymin], [(ymax - c) / slope, ymax]]
      .filter(([x, y]) => x >= xmin - 1e-8 && x <= xmax + 1e-8 && y >= ymin - 1e-8 && y <= ymax + 1e-8);
    const unique = intersections.filter((p, i) => !intersections.slice(0, i).some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7));
    if (unique.length === 2 && Math.hypot(unique[0][0] - unique[1][0], unique[0][1] - unique[1][1]) > .05) result.push({ from: unique[0], to: unique[1], depthOffset: slope > 0 ? .011 : -.011 });
  }
  return result;
}

export function zhengjuesiCloudCorbelGeometry({ width = .8, height = .54, depth = .13, side = 1 } = {}) {
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0, height); shape.lineTo(side * width, height);
  shape.bezierCurveTo(side * width * .9, height * .67, side * width * .65, height * .99, side * width * .62, height * .68);
  shape.bezierCurveTo(side * width * .64, height * .41, side * width * .3, height * .78, side * width * .38, height * .30);
  shape.bezierCurveTo(side * width * .44, height * .02, side * width * .08, height * .23, 0, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 20 });
  g.translate(0, 0, -depth / 2); return g;
}

// A shallow relief panel, not a texture carrying illegible invented writing.
export function zhengjuesiLotusReliefPetalGeometry({ length = .46, width = .17, relief = .055, steps = 14 } = {}) {
  const triangles = [], sample = (u, v) => V(length * v, width * Math.sin(Math.PI * v) * u, relief * Math.sin(Math.PI * v) * (1 - u * u));
  for (let i = 0; i < steps; i++) for (let j = 0; j < 8; j++) {
    const a = sample(j / 4 - 1, i / steps), b = sample((j + 1) / 4 - 1, i / steps), c = sample((j + 1) / 4 - 1, (i + 1) / steps), d = sample(j / 4 - 1, (i + 1) / steps);
    triangles.push([a, c, b], [a, d, c]);
    const aa = a.clone().setZ(-.012), bb = b.clone().setZ(-.012), cc = c.clone().setZ(-.012), dd = d.clone().setZ(-.012);
    triangles.push([aa, bb, cc], [aa, cc, dd]);
  }
  for (const side of [-1, 1]) for (let i = 0; i < steps; i++) {
    const a = sample(side, i / steps), b = sample(side, (i + 1) / steps), c = b.clone().setZ(-.012), d = a.clone().setZ(-.012);
    if (side > 0) triangles.push([a, b, c], [a, c, d]); else triangles.push([a, c, b], [a, d, c]);
  }
  return meshFromTriangles(triangles);
}
