import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { clipPavingCell, roofTileRollGeometry } from './chinese-architecture-geometry.js';
import { singleJuanpengSection, jiuzhouRoofSectionPoint, roofSurfacePatchGeometry } from './jiuzhou-roof-geometry.js';
import { jiuzhouTileRun } from './jiuzhou-architecture.js';

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area = p => p.reduce((sum, a, i) => { const c = p[(i + 1) % p.length]; return sum + a[0] * c[1] - c[0] * a[1]; }, 0) / 2;
function halfPlane(polygon, a, c, inside) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], dp = cross(a, c, p), dq = cross(a, c, q), ip = inside ? dp >= 0 : dp <= 0, iq = inside ? dq >= 0 : dq <= 0;
    if (ip) result.push(p);
    if (ip !== iq) { const t = dp / (dp - dq); result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return result;
}
function subtractRectangle(polygon, clip) {
  const outside = []; let remainder = polygon;
  for (let edge = 0; edge < clip.length && remainder.length >= 3; edge++) {
    const a = clip[edge], c = clip[(edge + 1) % clip.length], piece = halfPlane(remainder, a, c, false);
    if (piece.length >= 3 && Math.abs(area(piece)) > 1e-9) outside.push(piece);
    remainder = halfPlane(remainder, a, c, true);
  }
  return outside;
}

export function jiuzhouGalleryRoofControl(points, { width = 2.12, floorStart = .64, floorEnd = floorStart } = {}) {
  const half = (width + 1.22) / 2, lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1])), total = lengths.reduce((a, c) => a + c, 0);
  const profile = singleJuanpengSection({ depth: half * 2, eaveY: 0, crownY: .78 }); let distance = 0;
  const segments = lengths.map((length, i) => {
    const from = points[i], to = points[i + 1], direction = [(to[0] - from[0]) / length, (to[1] - from[1]) / length], normal = [-direction[1], direction[0]], a = i ? -half : 0, c = i + 1 < lengths.length ? length + half : length, start = distance; distance += length;
    const planPoint = (u, v) => [from[0] + direction[0] * u + normal[0] * v, from[1] + direction[1] * u + normal[1] * v];
    const eaveAt = u => THREE.MathUtils.lerp(floorStart, floorEnd, THREE.MathUtils.clamp((start + u) / total, 0, 1)) + .010 + 3.30;
    const sample = (u, v) => { const p = planPoint(u, v); return V(p[0], eaveAt(u) + jiuzhouRoofSectionPoint(profile, v).y, p[1]); };
    const rectangle = [planPoint(a, -half), planPoint(c, -half), planPoint(c, half), planPoint(a, half)];
    return { from, length, direction, normal, a, c, start, planPoint, eaveAt, sample, rectangle };
  });
  const ownerAt = (x, z) => {
    let result = null;
    for (const [index, segment] of segments.entries()) {
      const dx = x - segment.from[0], dz = z - segment.from[1], u = dx * segment.direction[0] + dz * segment.direction[1], v = dx * segment.normal[0] + dz * segment.normal[1];
      if (u < segment.a - 1e-7 || u > segment.c + 1e-7 || Math.abs(v) > half + 1e-7) continue;
      const y = segment.eaveAt(u) + jiuzhouRoofSectionPoint(profile, THREE.MathUtils.clamp(v, -half, half)).y;
      if (result === null || y > result.y + 1e-8) result = { index, y };
    }
    return result;
  };
  const polygons = [];
  for (let i = 0; i < segments.length; i++) {
    let pieces = [segments[i].rectangle];
    for (let previous = 0; previous < i; previous++) pieces = pieces.flatMap(p => subtractRectangle(p, segments[previous].rectangle));
    polygons.push(...pieces);
  }
  return { segments, polygons, ownerAt, half, total };
}

export function jiuzhouGalleryRoofGeometry(points, options = {}) {
  const control = jiuzhouGalleryRoofControl(points, options), all = control.polygons.flat(), pitch = .12, thickness = .18;
  const axis = coordinate => {
    const values = all.map(p => p[coordinate]), low = Math.min(...values), high = Math.max(...values), count = Math.ceil((high - low) / pitch);
    return [...new Set([...values, ...Array.from({ length: count + 1 }, (_, i) => low + (high - low) * i / count)].map(v => Math.round(v * 1e8) / 1e8))].sort((a, c) => a - c);
  };
  const xs = axis(0), zs = axis(1), position = [], uv = [], index = [], ids = new Map(), edges = new Map();
  const vertex = (x, z) => {
    const key = `${Math.round(x * 1e7)},${Math.round(z * 1e7)}`; if (ids.has(key)) return ids.get(key);
    const id = position.length / 3, roof = control.ownerAt(x, z); if (roof === null) throw new Error('Gallery roof vertex fell outside the actual union.');
    position.push(x, roof.y, z); uv.push(x / .5, z / .5); ids.set(key, id); return id;
  };
  const triangle = (a, c, d) => {
    const p = V(...position.slice(a * 3, a * 3 + 3)), q = V(...position.slice(c * 3, c * 3 + 3)), r = V(...position.slice(d * 3, d * 3 + 3));
    if (q.sub(p).cross(r.sub(p)).lengthSq() < 1e-18) return;
    index.push(a, c, d);
    for (const [i, j] of [[a, c], [c, d], [d, a]]) { const key = [i, j].sort((x, z) => x - z).join(','); if (!edges.has(key)) edges.set(key, { i, j, count: 0 }); edges.get(key).count++; }
  };
  for (const polygon of control.polygons) {
    const px = polygon.map(p => p[0]), pz = polygon.map(p => p[1]), minX = Math.min(...px), maxX = Math.max(...px), minZ = Math.min(...pz), maxZ = Math.max(...pz);
    for (let i = 0; i + 1 < xs.length; i++) {
      if (xs[i + 1] < minX || xs[i] > maxX) continue;
      for (let j = 0; j + 1 < zs.length; j++) {
        if (zs[j + 1] < minZ || zs[j] > maxZ) continue;
        const cell = clipPavingCell(polygon, xs[i], xs[i + 1], zs[j], zs[j + 1]); if (cell.length < 3 || Math.abs(area(cell)) < 1e-10) continue;
        const v = cell.map(p => vertex(...p));
        for (let k = 1; k + 1 < v.length; k++) triangle(v[0], v[k + 1], v[k]);
      }
    }
  }
  const topCount = position.length / 3, topIndexCount = index.length;
  for (let i = 0; i < topCount; i++) { position.push(position[i * 3], position[i * 3 + 1] - thickness, position[i * 3 + 2]); uv.push(uv[i * 2], uv[i * 2 + 1]); }
  for (let i = 0; i < topIndexCount; i += 3) index.push(index[i] + topCount, index[i + 2] + topCount, index[i + 1] + topCount);
  for (const edge of edges.values()) if (edge.count === 1) {
    const at = position.length / 3;
    for (const id of [edge.i, edge.j, edge.i + topCount, edge.j + topCount]) { position.push(...position.slice(id * 3, id * 3 + 3)); uv.push(...uv.slice(id * 2, id * 2 + 2)); }
    index.push(at, at + 3, at + 1, at, at + 2, at + 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'continuous-gallery-roof-union', oneUpperSkin: true, thickness, originalJunctionDetailRecovered: false }; return { geometry, control };
}

export function buildJiuzhouGalleryRoof(b, parent, name, points, { tiles = true, ...options } = {}) {
  const { geometry, control } = jiuzhouGalleryRoofGeometry(points, options), group = namedGroup(parent, name, { body: 'joined-gallery-roof-with-trimmed-tile-courses', exactHistoricJointRecovered: false });
  b.add(group, geometry, b.m.tileShade, undefined, undefined, undefined, true);
  if (tiles) {
    const cover = namedGroup(group, `${name}-individual-tiles`, { body: 'actual-24-arc-clay-tiles-stopped-at-roof-junctions' });
    for (const [segmentIndex, segment] of control.segments.entries()) {
      const count = Math.max(1, Math.ceil((segment.c - segment.a) / .26));
      for (let row = 0; row < count; row++) {
        const u = THREE.MathUtils.lerp(segment.a, segment.c, (row + .5) / count);
        for (const side of [-1, 1]) {
          const sample = t => segment.sample(u, side * control.half * (1 - t)); let start = null;
          for (let step = 0; step <= 96; step++) {
            const t = step / 96, p = sample(t), visible = control.ownerAt(p.x, p.z)?.index === segmentIndex;
            if (visible && start === null) start = t;
            if ((!visible || step === 96) && start !== null) {
              const end = visible ? t : Math.max(start, (step - 1) / 96);
              if (end - start > .035) jiuzhouTileRun(b, cover, s => sample(THREE.MathUtils.lerp(start, end, s)), row, { pan: row > 0 && row < count - 1 });
              start = null;
            }
          }
        }
        const crown = segment.sample(u, 0);
        if (control.ownerAt(crown.x, crown.z)?.index === segmentIndex) {
          const cap = Array.from({ length: 13 }, (_, i) => segment.sample(u, -.19 + .38 * i / 12).add(V(0, .096, 0)));
          b.add(cover, roofTileRollGeometry(cap, .083, .024, 24), b.m.greyTile, undefined, undefined, undefined, true);
        }
      }
    }
  }
  return group;
}

export function buildJiuzhouPlatformGalleryRoof(b, parent, name, points, { width = 2.12, floorStart, floorEnd, trimStart = 0 }) {
  if (points.length !== 2) throw new Error('The documented western platform gallery uses one straight four-bay range.');
  const a = points[0], c = points[1], length = Math.hypot(c[0] - a[0], c[1] - a[1]), dx = (c[0] - a[0]) / length, dz = (c[1] - a[1]) / length, half = (width + 1.22) / 2;
  const group = namedGroup(parent, name, { body: 'platform-gallery-with-inferred-roof-details-meeting-adjacent-eaves', source: 'He upper p38: four-bay platform gallery west of Tongdaotang reported in archival research; category has textual evidence', exactRoofSectionRecovered: false, roofPitchConstructionDrainageAndCopingInferred: true, platformRoofSectionAndDrainageInferred: true, neighbouringRoofCoversFirstMetres: trimStart });
  const sample = (u, t) => {
    const along = THREE.MathUtils.lerp(trimStart, length, u), cross = THREE.MathUtils.lerp(-half, half, t), y = THREE.MathUtils.lerp(floorStart, floorEnd, along / length) + 3.33;
    return V(a[0] + dx * along - dz * cross, y, a[1] + dz * along + dx * cross);
  };
  b.add(group, roofSurfacePatchGeometry(sample, { columns: Math.ceil(length / .25), rows: 12, thickness: .10 }), b.m.tileShade, undefined, undefined, undefined, true);
  const columns = Math.ceil((length - trimStart) / .42), rows = Math.ceil(half * 2 / .42), angle = -Math.atan2(dz, dx);
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    const p = sample((i + .5) / columns, (j + .5) / rows); p.y += .012;
    b.box(group, (i * 7 + j) % 13 ? b.m.greyTile : b.m.tileShade, p.toArray(), [(length - trimStart) / columns - .006, .024, half * 2 / rows - .006], [0, angle, 0]);
  }
  for (const side of [0, 1]) for (let i = 0; i < columns; i++) {
    const p = sample((i + .5) / columns, side); p.y += .085;
    b.box(group, b.m.greyTile, p.toArray(), [(length - trimStart) / columns - .006, .17, .15], [0, angle, 0]);
  }
  return group;
}
