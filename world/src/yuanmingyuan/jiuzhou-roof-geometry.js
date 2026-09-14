import * as THREE from 'three';
import { jiuzhouPlan, QING_CHI_METRES } from './jiuzhou-layout.js';

const v = (z, y) => new THREE.Vector2(z, y);
const interpolate = (a, b, t) => a.clone().lerp(b, t);

function curvePoint(points, t) {
  const a = 1 - t;
  return points[0].clone().multiplyScalar(a ** 3)
    .addScaledVector(points[1], 3 * a * a * t)
    .addScaledVector(points[2], 3 * a * t * t)
    .addScaledVector(points[3], t ** 3);
}

function curveTangent(points, t) {
  const a = 1 - t;
  return points[1].clone().sub(points[0]).multiplyScalar(3 * a * a)
    .addScaledVector(points[2].clone().sub(points[1]), 6 * a * t)
    .addScaledVector(points[3].clone().sub(points[2]), 3 * t * t);
}

function parameterAtZ(points, z) {
  let low = 0, high = 1;
  for (let i = 0; i < 36; i++) {
    const mid = (low + high) / 2;
    if (curvePoint(points, mid).x < z) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

function suffix(points, t) {
  const a = interpolate(points[0], points[1], t), b = interpolate(points[1], points[2], t), c = interpolate(points[2], points[3], t);
  const d = interpolate(a, b, t), e = interpolate(b, c, t);
  return [interpolate(d, e, t), e, c, points[3].clone()];
}

function prefix(points, t) {
  const a = interpolate(points[0], points[1], t), b = interpolate(points[1], points[2], t), c = interpolate(points[2], points[3], t);
  const d = interpolate(a, b, t), e = interpolate(b, c, t);
  return [points[0].clone(), a, d, interpolate(d, e, t)];
}

export function singleJuanpengSection({ depth, eaveY, crownY, centerZ = 0 }) {
  if (!(depth > 0 && crownY > eaveY)) throw new Error('Invalid single juanpeng section.');
  const half = depth / 2, rise = crownY - eaveY;
  const back = [v(centerZ - half, eaveY), v(centerZ - half * .50, eaveY + rise * .03), v(centerZ - half * .26, crownY), v(centerZ, crownY)];
  return { segments: [{ id: 'north-slope', points: back }, { id: 'south-slope', points: back.slice().reverse().map(p => v(2 * centerZ - p.x, p.y)) }], valley: null, crowns: [new THREE.Vector3(0, crownY, centerZ)], eaveSkinY: eaveY };
}

export function cropJuanpengSection(section, minZ, maxZ) {
  if (!(maxZ > minZ)) throw new Error('A cropped roof needs a positive span.');
  const segments = [];
  for (const segment of section.segments) {
    const low = Math.max(minZ, segment.points[0].x), high = Math.min(maxZ, segment.points[3].x);
    if (high - low < 1e-8) continue;
    const start = parameterAtZ(segment.points, low), end = parameterAtZ(segment.points, high);
    const points = prefix(suffix(segment.points, start), (end - start) / (1 - start));
    points[0].x = low; points[3].x = high; segments.push({ id: segment.id, points });
  }
  if (!segments.length) throw new Error('The requested roof crop is outside the section.');
  return { ...section, segments };
}

// One continuous multi-roll roof for Shendetang and documented paired rooms.
// Its dimensions and crown heights remain proportional controls; the roof
// count belongs to the historical building record, not to this helper.
export function multipleJuanpengSection({ depth, crowns, eaveY, valleyY }) {
  if (!(depth > 0 && crowns.length >= 2 && valleyY > eaveY && crowns.every(y => y > valleyY))) throw new Error('Invalid multi-roll roof controls.');
  const pitch = depth / crowns.length, segments = [], pointsAtCrowns = [];
  for (let i = 0; i < crowns.length; i++) {
    const center = -depth / 2 + pitch * (i + .5), left = center - pitch / 2, right = center + pitch / 2;
    const lowY = i === 0 ? eaveY : valleyY, highY = i === crowns.length - 1 ? eaveY : valleyY, crown = crowns[i];
    segments.push({ id: `roll-${i + 1}-north`, points: [v(left, lowY), v(left + pitch * .25, lowY + (crown - lowY) * .08), v(center - pitch * .16, crown), v(center, crown)] });
    segments.push({ id: `roll-${i + 1}-south`, points: [v(center, crown), v(center + pitch * .16, crown), v(right - pitch * .25, highY + (crown - highY) * .08), v(right, highY)] });
    pointsAtCrowns.push(new THREE.Vector3(0, crown, center));
  }
  return { segments, valley: null, crowns: pointsAtCrowns, eaveSkinY: eaveY, valleyY };
}

export function juanpengSegmentPoint(segment, t, x = 0) {
  const p = curvePoint(segment.points, t); return new THREE.Vector3(x, p.y, p.x);
}

// Closed, smoothly sampled sheet. Caps have their own vertices so smoothing
// the sheet cannot turn a clay end or timber bearing edge into a soft bevel.
export function roofSurfacePatchGeometry(sample, { columns = 24, rows = 40, thickness = .18 } = {}) {
  const positions = [], uvs = [], indices = [];
  const point = (i, j, under = false) => { const p = sample(i / columns, j / rows); if (under) p.y -= thickness; return p; };
  const put = (p, u = 0, w = 0) => { const id = positions.length / 3; positions.push(...p.toArray()); uvs.push(u, w); return id; };
  const quad = (a, b, c, d, outward) => {
    const p = new THREE.Vector3().fromArray(positions, a * 3), q = new THREE.Vector3().fromArray(positions, b * 3), r = new THREE.Vector3().fromArray(positions, c * 3);
    if (q.sub(p).cross(r.sub(p)).dot(outward) >= 0) indices.push(a, b, c, a, c, d); else indices.push(a, c, b, a, d, c);
  };
  for (const under of [false, true]) {
    const start = positions.length / 3;
    for (let i = 0; i <= columns; i++) for (let j = 0; j <= rows; j++) put(point(i, j, under), i / columns, j / rows);
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const a = start + i * (rows + 1) + j, b = a + rows + 1;
      quad(a, b, b + 1, a + 1, new THREE.Vector3(0, under ? -1 : 1, 0));
    }
  }
  for (const i of [0, columns]) for (let j = 0; j < rows; j++) {
    const a = point(i, j), b = point(i, j + 1), inside = point(i ? i - 1 : 1, j);
    quad(...[a, b, point(i, j + 1, true), point(i, j, true)].map(p => put(p)), a.clone().sub(inside));
  }
  for (const j of [0, rows]) for (let i = 0; i < columns; i++) {
    const a = point(i, j), b = point(i + 1, j), inside = point(i, j ? j - 1 : 1);
    quad(...[a, b, point(i + 1, j, true), point(i, j, true)].map(p => put(p)), a.clone().sub(inside));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'closed-sampled-roof-patch', thickness, columns, rows }; return geometry;
}

export function clayPanGeometry(points, width = .23) {
  const path = points.map(p => p.clone());
  return roofSurfacePatchGeometry((u, t) => {
    const f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f));
    const p = path[i].clone().lerp(path[i + 1], f - i), tangent = path[i + 1].clone().sub(path[i]);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize(), up = tangent.clone().cross(side).normalize();
    return p.addScaledVector(side, (u - .5) * width).addScaledVector(up, .034 * (2 * u - 1) ** 2);
  }, { columns: 20, rows: (path.length - 1) * 2, thickness: .018 });
}

// A roof skin section through the common rear-inner-purlin line. The section
// coordinates and two crown controls come from the published modern fig11-2;
// the Bezier curvature and skin build-up are authored, not surveyed rafters.
// This central strip does not include the main hall's two xieshan side hips.
export function jiuzhouJoinedRoofSection({ floorY = 0, eaveSkinY = floorY + 15.6 * QING_CHI_METRES } = {}) {
  if (![floorY, eaveSkinY].every(Number.isFinite)) throw new Error('Roof elevations must be finite.');
  const controls = jiuzhouPlan.measuredControls.jiuzhouHall.roofJunction, chi = QING_CHI_METRES;
  const mainHalfDepth = (18 + controls.mainRoofProjectionChi) * chi;
  const valleyZ = controls.sharedPurlinZChi * chi, rearCenterZ = -21 * chi;
  const rearEndZ = (controls.rearAdditionRearEaveZChi - controls.mainRoofProjectionChi) * chi;
  const mainCrownY = floorY + controls.mainCrownHeightChi * chi, rearCrownY = floorY + controls.rearCrownHeightChi * chi;
  if (!(eaveSkinY < rearCrownY && rearCrownY < mainCrownY)) throw new Error('Eaves must be below both rounded crowns.');
  const rise = mainCrownY - eaveSkinY;
  const mainBack = [v(-mainHalfDepth, eaveSkinY), v(-mainHalfDepth * .5, eaveSkinY + rise * .03), v(-mainHalfDepth * .26, mainCrownY), v(0, mainCrownY)];
  const cut = parameterAtZ(mainBack, valleyZ), trimmedMainBack = suffix(mainBack, cut);
  // Pin the shared coordinate after the parameter search; both sheets use the
  // same actual vertex, not two almost-coincident independently rounded roofs.
  trimmedMainBack[0].x = valleyZ;
  const valley = trimmedMainBack[0].clone(), rearRun = valleyZ - rearCenterZ;
  if (!(valley.y < rearCrownY)) throw new Error('The shared purlin junction must be below the rear crown.');
  const rearDepth = rearCenterZ - rearEndZ, rearRise = rearCrownY - eaveSkinY;
  const rearBack = [v(rearEndZ, eaveSkinY), v(rearCenterZ - rearDepth * .5, eaveSkinY + rearRise * .03), v(rearCenterZ - rearDepth * .26, rearCrownY), v(rearCenterZ, rearCrownY)];
  const rearFront = [v(rearCenterZ, rearCrownY), v(rearCenterZ + rearRun * .30, rearCrownY), v(valleyZ - rearRun * .36, valley.y + (rearCrownY - valley.y) * .32), valley.clone()];
  const mainFront = mainBack.slice().reverse().map(p => v(-p.x, p.y));
  return {
    segments: [
      { id: 'rear-north-slope', points: rearBack },
      { id: 'rear-south-slope', points: rearFront },
      { id: 'main-north-slope', points: trimmedMainBack },
      { id: 'main-south-slope', points: mainFront },
    ],
    valley: new THREE.Vector3(0, valley.y, valleyZ),
    crowns: [new THREE.Vector3(0, mainCrownY, 0), new THREE.Vector3(0, rearCrownY, rearCenterZ)],
    eaveSkinY,
    evidence: {
      sharedLine: 'He Yan middle fig11-2 and reproduced Yangshi Lei 005-28-6; common rear inner purlin',
      crownHeights: 'Modern reconstructed section labels, not newly measured original roof surfaces',
      authored: ['Bezier skin profile', 'eave skin elevation', 'roof build-up thickness'],
      incompleteWithout: ['main xieshan side hips and gable closures', 'tile courses and valley drainage', 'timber bearings and interior frame'],
    },
  };
}

export function jiuzhouRoofSectionPoint(section, z, x = 0) {
  const first = section.segments[0].points[0].x, last = section.segments.at(-1).points[3].x;
  if (!Number.isFinite(z) || z < first - 1e-8 || z > last + 1e-8) throw new Error('Roof section sample is outside its actual span.');
  const segment = section.segments.find(s => z <= s.points[3].x + 1e-8) ?? section.segments.at(-1);
  const t = parameterAtZ(segment.points, THREE.MathUtils.clamp(z, segment.points[0].x, segment.points[3].x));
  const p = curvePoint(segment.points, t);
  return new THREE.Vector3(x, p.y, z);
}

export function joinedJuanpengStripGeometry({ width = 11.84, thickness = .18, samplesPerSlope = 72, section = jiuzhouJoinedRoofSection() } = {}) {
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(thickness) && thickness > 0 && Number.isInteger(samplesPerSlope) && samplesPerSlope >= 12)) throw new Error('Invalid joined roof strip dimensions or sampling.');
  const positions = [], normals = [], uvs = [], indices = [], across = 4;
  const put = (p, n, u, w) => { const id = positions.length / 3; positions.push(...p.toArray()); normals.push(...n.toArray()); uvs.push(u, w); return id; };
  const quad = (a, b, c, d, outward) => {
    const p = new THREE.Vector3().fromArray(positions, a * 3), q = new THREE.Vector3().fromArray(positions, b * 3), r = new THREE.Vector3().fromArray(positions, c * 3);
    if (q.sub(p).cross(r.sub(p)).dot(outward) > 0) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  };
  const lastZ = section.segments.at(-1).points[3].x, firstZ = section.segments[0].points[0].x;
  for (const segment of section.segments) {
    const rows = Array.from({ length: samplesPerSlope + 1 }, (_, j) => {
      const p = curvePoint(segment.points, j / samplesPerSlope), tangent = curveTangent(segment.points, j / samplesPerSlope);
      return { p, normal: new THREE.Vector3(0, tangent.x, -tangent.y).normalize() };
    });
    // Independent normal vertices at each slope boundary keep the drainage
    // valley sharp. Crown tangents match on both sides and remain smooth.
    for (const under of [false, true]) {
      const start = positions.length / 3;
      for (let i = 0; i <= across; i++) for (const { p, normal } of rows) {
        put(new THREE.Vector3(-width / 2 + width * i / across, p.y - (under ? thickness : 0), p.x), normal.clone().multiplyScalar(under ? -1 : 1), i / across, (p.x - firstZ) / (lastZ - firstZ));
      }
      for (let i = 0; i < across; i++) for (let j = 0; j < samplesPerSlope; j++) {
        const a = start + i * rows.length + j, b = a + rows.length;
        quad(a, b, b + 1, a + 1, new THREE.Vector3(0, under ? -1 : 1, 0));
      }
    }
    // Only outside edges are closed. There are no internal vertical caps at
    // the shared valley or either rounded crown.
    for (const side of [-1, 1]) for (let j = 0; j < samplesPerSlope; j++) {
      const a = rows[j].p, b = rows[j + 1].p, n = new THREE.Vector3(side, 0, 0), x = side * width / 2;
      const ids = [new THREE.Vector3(x, a.y, a.x), new THREE.Vector3(x, b.y, b.x), new THREE.Vector3(x, b.y - thickness, b.x), new THREE.Vector3(x, a.y - thickness, a.x)].map((p, i) => put(p, n, p.z, i < 2 ? 1 : 0));
      quad(...ids, n);
    }
  }
  for (const [segment, t, direction] of [[section.segments[0], 0, -1], [section.segments.at(-1), 1, 1]]) {
    const p = curvePoint(segment.points, t), n = new THREE.Vector3(0, 0, direction);
    for (let i = 0; i < across; i++) {
      const x = -width / 2 + width * i / across, next = x + width / across;
      const ids = [new THREE.Vector3(x, p.y, p.x), new THREE.Vector3(next, p.y, p.x), new THREE.Vector3(next, p.y - thickness, p.x), new THREE.Vector3(x, p.y - thickness, p.x)].map((point, j) => put(point, n, point.x, j < 2 ? 1 : 0));
      quad(...ids, n);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'closed-central-common-purlin-juanpeng-strip', samplesPerSlope, incompleteWholeXieshanRoof: true, commonPurlinZ: section.valley?.z ?? null, inferredSkinProfile: true };
  return geometry;
}
