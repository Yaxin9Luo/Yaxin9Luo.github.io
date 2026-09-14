import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, TAU, meshFromTriangles } from './study-geometry.js';

// Local geometry and fountain shading; every returned resource is caller-owned.
function outwardFace(triangles, a, b, c, outward) {
  if (b.clone().sub(a).cross(c.clone().sub(a)).dot(outward) < 0) [b, c] = [c, b];
  triangles.push([a, b, c]);
}

export function archShape(width, height, bottom = 0, center = 0) {
  const r = width / 2, spring = bottom + height - r;
  const shape = new THREE.Shape();
  shape.moveTo(center - r, bottom);
  shape.lineTo(center + r, bottom);
  shape.lineTo(center + r, spring);
  shape.bezierCurveTo(center + r, spring + r * .5523, center + r * .5523, spring + r, center, spring + r);
  shape.bezierCurveTo(center - r * .5523, spring + r, center - r, spring + r * .5523, center - r, spring);
  shape.closePath();
  return shape;
}

export function extrudeShape(shape, depth = .2, bevel = .025) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 3, curveSegments: 16, steps: 1,
  });
}

// A closed ogee-section moulding, not a round wire drawn over the facade.
export function stoneSweep(points, width, depth, axis = V(0, 0, 1), segments = 32, taper = () => 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V(...p)));
  const profile = [[-.50, -.35], [-.44, -.50], [.44, -.50], [.50, -.35], [.43, -.15], [.38, -.02], [.47, .16], [.50, .34], [.38, .50], [-.38, .50], [-.50, .34], [-.47, .16], [-.38, -.02], [-.43, -.15]];
  const rings = [], centers = [], triangles = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    let normal = axis.clone().addScaledVector(tangent, -axis.dot(tangent));
    if (normal.lengthSq() < 1e-8) normal = V(1, 0, 0).addScaledVector(tangent, -tangent.x);
    normal.normalize();
    const across = normal.clone().cross(tangent).normalize(), size = taper(t);
    centers.push(center);
    rings.push(profile.map(([x, y]) => center.clone().addScaledVector(across, x * width * size).addScaledVector(normal, y * depth * size)));
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < profile.length; j++) {
    const next = (j + 1) % profile.length;
    const a = rings[i][j], b = rings[i][next], c = rings[i + 1][next], d = rings[i + 1][j];
    const outward = a.clone().add(b).add(c).add(d).multiplyScalar(.25).sub(centers[i].clone().lerp(centers[i + 1], .5));
    outwardFace(triangles, a, b, c, outward); outwardFace(triangles, a, c, d, outward);
  }
  for (const end of [0, segments]) for (let j = 0; j < profile.length; j++) {
    outwardFace(triangles, centers[end], rings[end][j], rings[end][(j + 1) % profile.length], curve.getTangent(end ? 1 : 0).multiplyScalar(end ? 1 : -1));
  }
  return meshFromTriangles(triangles);
}

// Carry one frame along the curve by the shortest tangent rotation. Reprojecting
// world-up independently at each ring flips the skin by 180 degrees whenever a
// neck or leg crosses vertical; closed topology alone cannot catch that defect.
function transportedFrames(path, steps) {
  const tangents = [], normals = [], across = [], rotation = new THREE.Quaternion();
  for (let i = 0; i <= steps; i++) {
    const tangent = path.getTangent(i / steps).normalize();
    let normal;
    if (i === 0) {
      normal = V(0, 1, 0).addScaledVector(tangent, -tangent.y);
      if (normal.lengthSq() < .001) normal = V(0, 0, 1).addScaledVector(tangent, -tangent.z);
      if (normal.lengthSq() < .001) normal = V(1, 0, 0).addScaledVector(tangent, -tangent.x);
    } else {
      rotation.setFromUnitVectors(tangents[i - 1], tangent);
      normal = normals[i - 1].clone().applyQuaternion(rotation);
      normal.addScaledVector(tangent, -normal.dot(tangent));
    }
    normal.normalize(); tangents.push(tangent); normals.push(normal); across.push(tangent.clone().cross(normal).normalize());
  }
  return { tangents, normals, across };
}

// Anatomical loft: sections are [x, y, z, lateralRadius, verticalRadius]. Skin
// winding is defined by the frame instead of being flipped triangle by triangle.
// Adjacent rings share indexed vertices; end caps keep separate planar normals.
export function organicLoft(sections, sides = 18, steps = 28, ridge = 0, minimumRadius = .008) {
  const path = new THREE.CatmullRomCurve3(sections.map(s => V(...s.slice(0, 3))));
  const radii = new THREE.CatmullRomCurve3(sections.map(s => V(s[3], s[4], 0)));
  const frames = transportedFrames(path, steps), positions = [], uv = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, center = path.getPoint(t), r = radii.getPoint(t);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * TAU;
      const fold = 1 + ridge * Math.cos(angle * 3) * Math.sin(t * Math.PI) ** 2;
      const point = center.clone().addScaledVector(frames.across[i], Math.cos(angle) * Math.max(minimumRadius, r.x) * fold).addScaledVector(frames.normals[i], Math.sin(angle) * Math.max(minimumRadius, r.y));
      positions.push(point.x, point.y, point.z); uv.push(j / sides, t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const next = (j + 1) % sides, a = i * sides + j, b = i * sides + next, c = (i + 1) * sides + next, d = (i + 1) * sides + j;
    indices.push(a, c, b, a, d, c);
  }
  for (const end of [0, steps]) {
    const capStart = positions.length / 3;
    for (let j = 0; j < sides; j++) { const at = (end * sides + j) * 3; positions.push(...positions.slice(at, at + 3)); uv.push(j / sides, end / steps); }
    const centerIndex = positions.length / 3, center = path.getPoint(end / steps); positions.push(center.x, center.y, center.z); uv.push(.5, .5);
    for (let j = 0; j < sides; j++) {
      const a = capStart + j, b = capStart + (j + 1) % sides;
      if (end === 0) indices.push(centerIndex, a, b); else indices.push(centerIndex, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.construction = 'parallel-transport-loft-with-consistent-winding';
  return geometry;
}

// Sample a local smooth union rather than displaying the planar ends of
// overlapping anatomical lofts. This is CPU geometry generation, never a render.
// Each ellipsoid is { center, radii, rotation? }; subtraction opens real mouths.
export function blendedEllipsoids(ellipsoids, { resolution = 104, blend = .045, cutouts = [], sweeps = [] } = {}) {
  const prepare = part => {
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))), e = matrix.elements;
    const axes = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]];
    const extent = [0, 1, 2].map(i => Math.sqrt(axes.reduce((sum, axis, j) => sum + (axis[i] * part.radii[j]) ** 2, 0)));
    return { ...part, axes, extent };
  };
  const shapes = ellipsoids.map(prepare), holes = cutouts.map(prepare), sweepParts = sweeps.map(continuousSweepSegments), pad = blend + .065;
  const extents = [...shapes, ...sweepParts.flat()];
  const minimum = [0, 1, 2].map(i => Math.min(...extents.map(p => p.center[i] - p.extent[i])) - pad), maximum = [0, 1, 2].map(i => Math.max(...extents.map(p => p.center[i] + p.extent[i])) + pad);
  const size = maximum.map((v, i) => v - minimum[i]), step = size.map(v => v / resolution), material = new THREE.MeshBasicMaterial();
  const marching = new MarchingCubes(resolution, material, false, false, 160000); marching.isolation = 0; marching.field.fill(-.25);
  const distance = (part, x, y, z) => {
    const dx = x - part.center[0], dy = y - part.center[1], dz = z - part.center[2], a = part.axes, r = part.radii;
    const qx = (dx * a[0][0] + dy * a[0][1] + dz * a[0][2]) / r[0], qy = (dx * a[1][0] + dy * a[1][1] + dz * a[1][2]) / r[1], qz = (dx * a[2][0] + dy * a[2][1] + dz * a[2][2]) / r[2];
    const k0 = Math.hypot(qx, qy, qz), k1 = Math.hypot(qx / r[0], qy / r[1], qz / r[2]);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(...r);
  };
  const writeEllipsoid = (part, subtract) => {
      const lo = [0, 1, 2].map(i => Math.max(1, Math.floor((part.center[i] - part.extent[i] - pad - minimum[i]) / step[i]))), hi = [0, 1, 2].map(i => Math.min(resolution - 2, Math.ceil((part.center[i] + part.extent[i] + pad - minimum[i]) / step[i])));
      for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
        const at = x + resolution * (y + resolution * z), previous = -marching.field[at], d = distance(part, minimum[0] + x * step[0], minimum[1] + y * step[1], minimum[2] + z * step[2]);
        if (subtract) marching.field[at] = -Math.max(previous, -d);
        else { const h = Math.max(blend - Math.abs(previous - d), 0) / blend; marching.field[at] = -(Math.min(previous, d) - h * h * blend * .25); }
      }
  };
  try {
    for (const part of shapes) writeEllipsoid(part, false);
    for (const parts of sweepParts) {
      // One distance field represents the entire sweep. Hard-min its adjacent
      // sections first, then blend the whole neck into head/chest exactly once.
      // Smooth-unioning each sampled ellipsoid inflated their overlaps into beads.
      const field = new Float32Array(marching.field.length).fill(.25);
      for (const part of parts) {
        const lo = [0, 1, 2].map(i => Math.max(1, Math.floor((part.center[i] - part.extent[i] - pad - minimum[i]) / step[i]))), hi = [0, 1, 2].map(i => Math.min(resolution - 2, Math.ceil((part.center[i] + part.extent[i] + pad - minimum[i]) / step[i])));
        for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
          const at = x + resolution * (y + resolution * z), d = part.distance(minimum[0] + x * step[0], minimum[1] + y * step[1], minimum[2] + z * step[2]);
          if (d < field[at]) field[at] = d;
        }
      }
      for (let i = 0; i < field.length; i++) if (field[i] < .25) {
        const previous = -marching.field[i], d = field[i], h = Math.max(blend - Math.abs(previous - d), 0) / blend;
        marching.field[i] = -(Math.min(previous, d) - h * h * blend * .25);
      }
    }
    for (const part of holes) writeEllipsoid(part, true);
    marching.update();
    if (marching.count >= 160000 * 3) throw new Error('Anatomical smooth union exceeded its explicit triangle capacity');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(marching.geometry.attributes.position.array.slice(0, marching.count * 3), 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(marching.geometry.attributes.normal.array.slice(0, marching.count * 3), 3));
    geometry.scale(size[0] / 2, size[1] / 2, size[2] / 2); geometry.translate(...minimum.map((v, i) => v + size[i] / 2));
    const p = geometry.attributes.position, uv = [];
    for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * .8, (p.getY(i) + p.getZ(i)) * .5);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.userData.construction = 'smooth-union-anatomical-surface';
    return geometry;
  } finally { marching.geometry.dispose(); material.dispose(); }
}

function continuousSweepSegments(sections) {
  const path = new THREE.CatmullRomCurve3(sections.map(s => V(...s.slice(0, 3)))), radii = new THREE.CatmullRomCurve3(sections.map(s => V(s[3], s[4], 0)));
  const steps = Math.max(4, Math.ceil(path.getLength() / .024)), frames = transportedFrames(path, steps), segments = [];
  for (let i = 0; i < steps; i++) {
    const a = path.getPoint(i / steps), b = path.getPoint((i + 1) / steps), tangent = b.clone().sub(a), length = tangent.length(); tangent.divideScalar(length);
    const normal = frames.normals[i].clone().add(frames.normals[i + 1]); normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    const across = tangent.clone().cross(normal), r0 = radii.getPoint(i / steps), r1 = radii.getPoint((i + 1) / steps), maxRadius = Math.max(r0.x, r0.y, r1.x, r1.y);
    segments.push({
      center: a.clone().lerp(b, .5).toArray(), extent: [Math.abs(b.x - a.x) / 2 + maxRadius, Math.abs(b.y - a.y) / 2 + maxRadius, Math.abs(b.z - a.z) / 2 + maxRadius],
      distance(x, y, z) {
        let qx = x - a.x, qy = y - a.y, qz = z - a.z;
        const along = qx * tangent.x + qy * tangent.y + qz * tangent.z, t = THREE.MathUtils.clamp(along / length, 0, 1);
        qx -= tangent.x * length * t; qy -= tangent.y * length * t; qz -= tangent.z * length * t;
        const rx = r0.x + (r1.x - r0.x) * t, ry = r0.y + (r1.y - r0.y) * t, rz = Math.min(rx, ry);
        const u = (qx * across.x + qy * across.y + qz * across.z) / rx, v = (qx * normal.x + qy * normal.y + qz * normal.z) / ry, w = (qx * tangent.x + qy * tangent.y + qz * tangent.z) / rz;
        const k0 = Math.hypot(u, v, w), k1 = Math.hypot(u / rx, v / ry, w / rz);
        return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry);
      },
    });
  }
  return segments;
}

export function sculptureNeckSections(kind) {
  if (kind === 'deer') return [[0, 1.74, .49, .235, .29], [0, 2.10, .72, .21, .275], [.02, 2.45, .87, .145, .22], [.04, 2.73, 1.06, .118, .16]];
  if (kind === 'crane') return [[0, 1.38, .28, .092, .12], [.035, 1.60, .40, .058, .073], [-.025, 1.88, .23, .042, .048], [.008, 2.14, .30, .038, .044], [.008, 2.29, .47, .053, .055]];
  throw new Error(`No anatomical neck profile for ${kind}`);
}

function ellipsoidChain(sections, spacing = .065) {
  const path = new THREE.CatmullRomCurve3(sections.map(s => V(...s.slice(0, 3)))), radii = new THREE.CatmullRomCurve3(sections.map(s => V(s[3], s[4], 0)));
  const steps = Math.max(3, Math.ceil(path.getLength() / spacing)), frames = transportedFrames(path, steps), parts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, r = radii.getPoint(t), matrix = new THREE.Matrix4().makeBasis(frames.normals[i], frames.across[i], frames.tangents[i]);
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);
    parts.push({ center: path.getPoint(t).toArray(), radii: [Math.max(.01, r.y), Math.max(.01, r.x), Math.max(spacing * .90, Math.min(r.x, r.y) * .85)], rotation: [rotation.x, rotation.y, rotation.z] });
  }
  return parts;
}

export function houndSculptureGeometry() {
  const shapes = [
    { center: [0, 1.10, -.12], radii: [.235, .29, .56] }, { center: [0, 1.08, -.73], radii: [.22, .27, .31] }, { center: [0, 1.10, .37], radii: [.275, .385, .40] },
    ...ellipsoidChain([[0, 1.16, .54, .19, .24], [0, 1.38, .75, .175, .205], [0, 1.57, .96, .142, .17]], .09),
    { center: [0, 1.60, 1.075], radii: [.148, .18, .23], rotation: [.22, 0, 0] }, { center: [0, 1.49, 1.34], radii: [.112, .095, .245], rotation: [.10, 0, 0] },
    { center: [0, 1.455, 1.55], radii: [.078, .067, .11] }, { center: [0, 1.355, 1.345], radii: [.092, .046, .245] },
  ];
  for (const side of [-1, 1]) {
    const z = .40 + (side < 0 ? .12 : -.09);
    shapes.push({ center: [side * .17, 1.08, z], radii: [.14, .285, .185] }, { center: [side * .225, .91, z + .02], radii: [.119, .225, .125] }, { center: [side * .21, 1.045, -.70], radii: [.165, .28, .235] }, { center: [side * .27, .83, -.65], radii: [.13, .20, .165] });
  }
  return blendedEllipsoids(shapes, { resolution: 128, blend: .040, cutouts: [{ center: [0, 1.405, 1.55], radii: [.064, .028, .23] }] });
}

export function deerSculptureGeometry() {
  const shapes = [
    { center: [0, 1.75, -.24], radii: [.31, .375, .61] }, { center: [0, 1.73, -.82], radii: [.345, .39, .35] }, { center: [0, 1.67, .45], radii: [.335, .445, .42] },
    { center: [.05, 2.79, 1.18], radii: [.132, .155, .22], rotation: [.30, 0, 0] }, { center: [.05, 2.675, 1.41], radii: [.094, .084, .22], rotation: [.17, 0, 0] }, { center: [.05, 2.65, 1.555], radii: [.070, .058, .093] },
  ];
  for (const side of [-1, 1]) shapes.push({ center: [side * .20, 1.58, .40], radii: [.178, .375, .255] }, { center: [side * .245, 1.27, .50], radii: [.115, .225, .142] }, { center: [side * .225, 1.52, -.78], radii: [.195, .37, .25] }, { center: [side * .285, 1.22, -.65], radii: [.128, .23, .16] });
  return blendedEllipsoids(shapes, { resolution: 136, blend: .045, sweeps: [sculptureNeckSections('deer')], cutouts: [{ center: [.05, 2.61, 1.565], radii: [.059, .012, .115] }] });
}

export function craneSculptureGeometry() {
  const shapes = [
    { center: [0, 1.22, .10], radii: [.215, .29, .31] }, { center: [0, 1.235, -.16], radii: [.195, .225, .34] }, { center: [0, 1.03, -.01], radii: [.185, .19, .20] }, { center: [0, 1.14, -.40], radii: [.115, .11, .22] },
    { center: [.006, 2.30, .535], radii: [.059, .061, .105] },
  ];
  for (const side of [-1, 1]) shapes.push({ center: [side * .185, 1.245, -.14], radii: [.091, .19, .345], rotation: [-.22, 0, side * .06] }, { center: [side * .135, 1.085, -.40], radii: [.071, .095, .205], rotation: [-.28, 0, 0] });
  return blendedEllipsoids(shapes, { resolution: 132, blend: .023, sweeps: [sculptureNeckSections('crane')] });
}

// Keep the adjoining anatomical sections together so their inserted ends can
// be checked without constructing the complete architectural study.
export function houndAnatomy(side = 1) {
  const z = .40 + (side < 0 ? .12 : -.09), x = side * .21;
  return {
    torso: [[0, 1.02, -1.0, .045, .055], [0, 1.07, -.78, .25, .31], [0, 1.08, -.45, .22, .28], [0, 1.10, -.05, .245, .33], [0, 1.12, .40, .30, .42], [0, 1.10, .69, .20, .31], [0, 1.20, .82, .065, .12]],
    foreleg: [[x * .30, 1.19, z - .015, .055, .075], [x * .72, 1.13, z, .125, .16], [x, .94, z + .015, .13, .16], [x * 1.11, .57, z + .03, .070, .083], [x * 1.07, .17, z + .13, .043, .046], [x * 1.10, .07, z + .30, .060, .040]],
    neck: [[0, 1.12, .53, .22, .27], [0, 1.35, .77, .19, .23], [0, 1.59, .99, .16, .20], [0, 1.60, 1.19, .155, .17], [0, 1.48, 1.40, .12, .085], [0, 1.45, 1.61, .065, .068]],
  };
}

export function deerAnatomy(side = 1) {
  return {
    neck: [[0, 1.78, .57, .28, .35], [0, 2.10, .74, .235, .32], [.02, 2.46, .90, .16, .27], [.04, 2.75, 1.03, .13, .17], [.05, 2.82, 1.23, .13, .15], [.05, 2.64, 1.55, .08, .068]],
    antler: [[.05 + side * .06, 2.80, 1.11, .035, .035], [.05 + side * .10, 2.96, 1.09, .075, .068], [side * .26, 3.25, 1.0, .07, .065], [side * .40, 3.61, .80, .054, .05], [side * .58, 3.94, .68, .039, .035], [side * .78, 4.15, .77, .01, .01]],
    branches: [[.24, 3.22, 1.01, .06, .37, .35], [.38, 3.56, .83, .31, .40, .24], [.53, 3.84, .70, -.06, .46, -.05]].map(([x, y, z, dx, dy, dz]) => [[side * x, y, z, .023, .021], [side * (x + dx * .55), y + dy * .68, z + dz * .6, .026, .024], [side * (x + dx), y + dy, z + dz, .008, .008]]),
  };
}

export function fountainFlowGeometry(points, radius) {
  const sections = points.map((p, i) => [...p, radius * .76 * (1 - .38 * i / (points.length - 1)), radius * .76 * (1 - .38 * i / (points.length - 1))]);
  return organicLoft(sections, 10, 32, 0, .002);
}

// Millimetre-high annular wave crests catch light around the actual landing.
// Their empty centre leaves the recorded stream endpoint on the basin surface.
export function fountainRippleGeometry() {
  const positions = [], uv = [], indices = [], sides = 64, rows = 6;
  for (const radius of [.30, .64, 1.0]) {
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let side = 0; side < sides; side++) {
      const t = row / rows, a = side / sides * TAU, r = radius + (t - .5) * .18;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = .001 + .009 * Math.sin(t * Math.PI) ** 2 * (1.1 - radius * .3);
      positions.push(x, y, z); uv.push(x + .5, z + .5);
    }
    for (let row = 0; row < rows; row++) for (let side = 0; side < sides; side++) {
      const a = start + row * sides + side, b = start + row * sides + (side + 1) % sides, c = b + sides, d = a + sides;
      indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// Clear water gets its colour from stone and reflected light. Surface ripples
// and the moving jet highlights need independent UVs and material responses.
export function createFountainWater(prefix) {
  const textures = []; let seed = 782137;
  const noise = new SimplexNoise({ random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } });
  const surfaceHeight = (u, v) => .75 * noise.noise4d(Math.cos(u), Math.sin(u), Math.cos(v), Math.sin(v)) + .25 * noise.noise4d(Math.cos(u) * 2.3, Math.sin(u) * 2.3, Math.cos(v) * 2.3, Math.sin(v) * 2.3);
  function texture(kind) {
    const size = 64, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * TAU, v = y / size * TAU, at = (y * size + x) * 4;
      if (kind === 'flow-opacity') {
        const highlight = (.5 + .5 * Math.sin(v * 3 + .45 * Math.sin(u))) ** 3;
        pixels[at] = pixels[at + 1] = pixels[at + 2] = 156 + 99 * highlight;
      } else if (kind === 'surface-normal') {
        // A seamless 4D noise heightfield has connected irregular slopes rather
        // than two crossing periodic waves that read as a tiled grid in R3.
        const dx = (surfaceHeight(u + .045, v) - surfaceHeight(u - .045, v)) / .09, dy = (surfaceHeight(u, v + .045) - surfaceHeight(u, v - .045)) / .09;
        pixels[at] = THREE.MathUtils.clamp(128 - dx * 5, 90, 166); pixels[at + 1] = THREE.MathUtils.clamp(128 - dy * 5, 90, 166);
        pixels[at + 2] = 255;
      } else {
        pixels[at] = 128 + 8 * Math.cos(u * 2 + Math.sin(v * 3));
        pixels[at + 1] = 128 + 17 * Math.cos(v * 3 + .45 * Math.sin(u));
        pixels[at + 2] = 255;
      }
      pixels[at + 3] = 255;
    }
    const map = new THREE.DataTexture(pixels, size, size); map.name = `${prefix}-water-${kind}`;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(kind === 'surface-normal' ? .22 : 1, kind === 'surface-normal' ? .22 : 5);
    map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
    textures.push(map); return map;
  }
  const surfaceNormal = texture('surface-normal'), flowNormal = texture('flow-normal'), flowOpacity = texture('flow-opacity');
  const common = { color: 0xf8fbfc, metalness: 0, ior: 1.333, transparent: true, depthWrite: false, attenuationColor: 0xf1f6f6, attenuationDistance: 12 };
  const surface = new THREE.MeshPhysicalMaterial({ ...common, color: 0xcbd6d8, roughness: .085, transmission: .74, thickness: .24, opacity: 1, normalMap: surfaceNormal, normalScale: new THREE.Vector2(.65, .65), clearcoat: 1, clearcoatRoughness: .09, clearcoatNormalMap: surfaceNormal, clearcoatNormalScale: new THREE.Vector2(.38, .38) });
  const flow = new THREE.MeshPhysicalMaterial({ ...common, color: 0xffffff, roughness: .08, transmission: .56, thickness: .035, opacity: .91, normalMap: flowNormal, normalScale: new THREE.Vector2(.20, .30), alphaMap: flowOpacity, clearcoat: .8, clearcoatRoughness: .10 });
  for (const [role, material] of [['surface', surface], ['flow', flow]]) {
    material.name = `${prefix}-fountain-water-${role}`;
    material.userData = { category: 'water', role, evidence: 'illustrative-water-response-not-historic-flow-measurement' };
  }
  return {
    surface, flow, textures,
    update(time) {
      if (!Number.isFinite(time)) return;
      surfaceNormal.offset.set(time * .008 % 1, time * .005 % 1);
      flowNormal.offset.y = flowOpacity.offset.y = -time * .72 % 1;
    },
  };
}

// Carved leaves have lobed silhouettes, a thick cupped body, a central ridge,
// folded margins and a recurved tip. They are not spheres with a line on top.
export function carvedLeaf(kind = 'acanthus') {
  const shape = new THREE.Shape();
  if (kind === 'grape') {
    shape.moveTo(0, -.48); shape.bezierCurveTo(-.06, -.3, -.26, -.4, -.24, -.23);
    shape.bezierCurveTo(-.4, -.28, -.53, -.04, -.31, .04); shape.lineTo(-.43, .21); shape.lineTo(-.2, .22);
    shape.lineTo(-.19, .43); shape.lineTo(-.05, .35); shape.lineTo(0, .57); shape.lineTo(.05, .35); shape.lineTo(.19, .43); shape.lineTo(.2, .22);
    shape.lineTo(.43, .21); shape.lineTo(.31, .04); shape.bezierCurveTo(.53, -.04, .4, -.28, .24, -.23);
    shape.bezierCurveTo(.26, -.4, .06, -.3, 0, -.48);
  } else {
    shape.moveTo(-.055, -.48); shape.bezierCurveTo(-.11, -.28, -.35, -.39, -.26, -.21);
    shape.bezierCurveTo(-.44, -.15, -.35, .06, -.21, .015); shape.lineTo(-.17, .09);
    shape.bezierCurveTo(-.39, .15, -.23, .34, -.11, .28); shape.bezierCurveTo(-.15, .45, -.03, .49, 0, .58);
    shape.bezierCurveTo(.03, .49, .15, .45, .11, .28); shape.bezierCurveTo(.23, .34, .39, .15, .17, .09);
    shape.lineTo(.21, .015); shape.bezierCurveTo(.35, .06, .44, -.15, .26, -.21);
    shape.bezierCurveTo(.35, -.39, .11, -.28, .055, -.48); shape.closePath();
  }
  const boundary = shape.getSpacedPoints(64).slice(0, 64), vertices = boundary.map(point => point.clone()), positions = [], uv = [], indices = [];
  let faces = THREE.ShapeUtils.triangulateShape(boundary, []);
  for (const face of faces) {
    const [a, b, c] = face.map(index => vertices[index]);
    if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0) [face[1], face[2]] = [face[2], face[1]];
  }
  // Earcut respects the concave leaf silhouette; subdivision supplies interior
  // samples for the cupped surface without folding a radial fan over its lobes.
  for (let pass = 0; pass < 2; pass++) {
    const midpoints = new Map(), next = [];
    const midpoint = (a, b) => {
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (!midpoints.has(key)) { midpoints.set(key, vertices.length); vertices.push(vertices[a].clone().lerp(vertices[b], .5)); }
      return midpoints.get(key);
    };
    for (const [a, b, c] of faces) { const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a); next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
    faces = next;
  }
  const sample = (x, y, back) => {
    const t = THREE.MathUtils.clamp((y + .48) / 1.06, 0, 1), curl = .19 * t ** 5 - .035 * x * x;
    let edgeDistance = Infinity;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length], dx = b.x - a.x, dy = b.y - a.y;
      const along = THREE.MathUtils.clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      edgeDistance = Math.min(edgeDistance, Math.hypot(x - a.x - along * dx, y - a.y - along * dy));
    }
    const ridge = .046 * Math.exp(-x * x / .011) * Math.sin(t * Math.PI), cup = .065 * (1 - Math.exp(-edgeDistance * 12));
    return [x, y, curl + (back ? -.035 - cup * .25 : .030 + cup + ridge)];
  };
  for (const back of [false, true]) for (const { x, y } of vertices) { positions.push(...sample(x, y, back)); uv.push(x + .5, y + .5); }
  const layer = vertices.length, edges = new Map();
  for (const [a, b, c] of faces) {
    indices.push(a, b, c, a + layer, c + layer, b + layer);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      if (edges.has(key)) edges.delete(key); else edges.set(key, [from, to]);
    }
  }
  for (const [a, b] of edges.values()) indices.push(a, b + layer, b, a, a + layer, b + layer);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.userData.construction = 'smooth-indexed-cupped-carved-leaf'; return geometry;
}

// Connected bas-relief with grape-shaped lobes sculpted into one stone surface.
export function grapeRelief() {
  const rings = 18, sides = 32, triangles = [];
  const berries = [[-.19, .18], [.07, .24], [.23, .08], [-.17, -.04], [.055, -.04], [.18, -.21], [-.06, -.25], [0, -.43]];
  const sample = (u, v, back) => {
    const angle = u * TAU, radius = v;
    const x = Math.cos(angle) * .38 * radius * (.84 + .12 * Math.sin(angle * 7));
    const y = Math.sin(angle) * .56 * radius;
    let depth = .02;
    for (const [bx, by] of berries) depth += .165 * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / .008);
    return V(x, y, back ? -.035 : depth * (1 - .4 * radius ** 8));
  };
  for (const back of [false, true]) {
    const center = sample(0, 0, back);
    for (let j = 0; j < sides; j++) outwardFace(triangles, center, sample(j / sides, 1 / rings, back), sample((j + 1) / sides, 1 / rings, back), V(0, 0, back ? -1 : 1));
    for (let i = 1; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = sample(j / sides, i / rings, back), b = sample((j + 1) / sides, i / rings, back), c = sample((j + 1) / sides, (i + 1) / rings, back), d = sample(j / sides, (i + 1) / rings, back);
      outwardFace(triangles, a, b, c, V(0, 0, back ? -1 : 1)); outwardFace(triangles, a, c, d, V(0, 0, back ? -1 : 1));
    }
  }
  for (let j = 0; j < sides; j++) {
    const a = sample(j / sides, 1, false), b = sample((j + 1) / sides, 1, false), c = sample((j + 1) / sides, 1, true), d = sample(j / sides, 1, true), out = a.clone().setZ(0);
    outwardFace(triangles, a, b, c, out); outwardFace(triangles, a, c, d, out);
  }
  const raw = meshFromTriangles(triangles); raw.deleteAttribute('normal'); const smooth = mergeVertices(raw); raw.dispose(); smooth.computeVertexNormals(); return smooth;
}

export function shellGeometry(width, height, depth, ribs = 11) {
  const triangles = [], segments = 48, rows = 18;
  const point = (u, v, back) => {
    const angle = -.48 * Math.PI + .96 * Math.PI * u, radius = .09 + .91 * v;
    const ridge = .035 * Math.cos(u * ribs * TAU) * Math.sin(v * Math.PI * .9);
    return V(Math.sin(angle) * width * .5 * radius, Math.cos(angle) * height * radius, (back ? -.10 : .13) + depth * radius ** 1.8 + (back ? 0 : ridge));
  };
  for (const back of [false, true]) for (let i = 0; i < rows; i++) for (let j = 0; j < segments; j++) {
    const a = point(j / segments, i / rows, back), b = point((j + 1) / segments, i / rows, back), c = point((j + 1) / segments, (i + 1) / rows, back), d = point(j / segments, (i + 1) / rows, back);
    outwardFace(triangles, a, b, c, V(0, 0, back ? -1 : 1)); outwardFace(triangles, a, c, d, V(0, 0, back ? -1 : 1));
  }
  for (const side of [0, 1]) for (let i = 0; i < rows; i++) {
    const a = point(side, i / rows, false), b = point(side, (i + 1) / rows, false), c = point(side, (i + 1) / rows, true), d = point(side, i / rows, true);
    outwardFace(triangles, a, b, c, V(side ? 1 : -1, -1, 0)); outwardFace(triangles, a, c, d, V(side ? 1 : -1, -1, 0));
  }
  for (const end of [0, 1]) for (let j = 0; j < segments; j++) {
    const a = point(j / segments, end, false), b = point((j + 1) / segments, end, false), c = point((j + 1) / segments, end, true), d = point(j / segments, end, true), out = V(0, end ? 1 : -1, 0);
    outwardFace(triangles, a, b, c, out); outwardFace(triangles, a, c, d, out);
  }
  return meshFromTriangles(triangles);
}

export function ringGeometry(outer, inner, bottom, top, segments = 96) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, curveSegments: segments / 4, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0); return geometry;
}
