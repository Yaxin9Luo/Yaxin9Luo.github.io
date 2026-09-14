import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { singleJuanpengSection, jiuzhouRoofSectionPoint } from './jiuzhou-roof-geometry.js';
import { jiuzhouTileRun } from './jiuzhou-architecture.js';
import { roofTileRollGeometry } from './chinese-architecture-geometry.js';

// A single continuous L roof, not two complete intersecting roof meshes.
// The plan's corner-building identity is supported; the pitch, corner join
// and elevations remain explicit architectural interpretation.
export function jiuzhouLCornerRoofControl({ width = 7.68, depth = 13.44, arm = 4.48, overhang = .76, eaveY = 7.92, rise = 1.92 } = {}) {
  const minX = -width / 2 - overhang, maxX = width / 2 + overhang, minZ = -depth / 2 - overhang, maxZ = depth / 2 + overhang;
  const cutX = -width / 2 + arm + overhang, cutZ = -depth / 2 + arm + overhang, cx = -width / 2 + arm / 2, cz = -depth / 2 + arm / 2;
  const across = singleJuanpengSection({ depth: arm + overhang * 2, eaveY, crownY: eaveY + rise });
  const verticalY = x => x >= minX && x <= cutX ? jiuzhouRoofSectionPoint(across, x - cx).y : null;
  const horizontalY = z => z >= minZ && z <= cutZ ? jiuzhouRoofSectionPoint(across, z - cz).y : null;
  const heightAt = (x, z) => {
    if (x < minX || x > maxX || z < minZ || z > maxZ || x > cutX && z > cutZ) return null;
    const a = verticalY(x), c = horizontalY(z); return a === null ? c : c === null ? a : Math.max(a, c);
  };
  return { minX, maxX, minZ, maxZ, cutX, cutZ, cx, cz, heightAt, verticalY, horizontalY, across, eaveY, rise, outline: [[minX, minZ], [maxX, minZ], [maxX, cutZ], [cutX, cutZ], [cutX, maxZ], [minX, maxZ]] };
}

export function jiuzhouLCornerRoofGeometry(options = {}) {
  const c = jiuzhouLCornerRoofControl(options), thickness = .18, pitch = .14;
  const axis = (min, max, extras) => [...new Set([min, max, ...extras, ...Array.from({ length: Math.ceil((max - min) / pitch) - 1 }, (_, i) => min + (i + 1) * (max - min) / Math.ceil((max - min) / pitch))])].sort((a, b) => a - b);
  const xs = axis(c.minX, c.maxX, [c.cutX, c.cx]), zs = axis(c.minZ, c.maxZ, [c.cutZ, c.cz]), vertices = [], uv = [], ids = new Map(), triangles = [], edgeUses = new Map();
  const vertex = (i, j) => {
    const key = `${i},${j}`; if (ids.has(key)) return ids.get(key);
    const id = vertices.length / 3, y = c.heightAt(xs[i], zs[j]);
    vertices.push(xs[i], y, zs[j]); uv.push(xs[i] / .5, zs[j] / .5); ids.set(key, id); return id;
  };
  const triangle = (a, b, d) => {
    triangles.push(a, b, d);
    for (const [x, y] of [[a, b], [b, d], [d, a]]) { const key = [x, y].sort((i, j) => i - j).join(','); if (!edgeUses.has(key)) edgeUses.set(key, { a: x, b: y, count: 0 }); edgeUses.get(key).count++; }
  };
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) {
    if (c.heightAt((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) === null) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), d = vertex(i, j + 1), e = vertex(i + 1, j + 1);
    triangle(a, d, e); triangle(a, e, b);
  }
  const topCount = vertices.length / 3, topTriangles = triangles.length;
  for (let i = 0; i < topCount; i++) { vertices.push(vertices[i * 3], vertices[i * 3 + 1] - thickness, vertices[i * 3 + 2]); uv.push(uv[i * 2], uv[i * 2 + 1]); }
  for (let i = 0; i < topTriangles; i += 3) triangles.push(triangles[i] + topCount, triangles[i + 2] + topCount, triangles[i + 1] + topCount);
  for (const edge of edgeUses.values()) if (edge.count === 1) {
    const start = vertices.length / 3;
    for (const id of [edge.a, edge.b, edge.a + topCount, edge.b + topCount]) { vertices.push(...vertices.slice(id * 3, id * 3 + 3)); uv.push(...uv.slice(id * 2, id * 2 + 2)); }
    triangles.push(start, start + 3, start + 1, start, start + 2, start + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(triangles); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData = { body: 'single-closed-L-plan-juanpeng-roof', thickness, continuousTopSkin: true, geometryProfileInferred: true }; return g;
}

function visibleIntervals(sample, predicate) {
  const intervals = []; let start = null;
  for (let i = 0; i <= 100; i++) {
    const t = i / 100, visible = predicate(sample(t));
    if (visible && start === null) start = t;
    if ((!visible || i === 100) && start !== null) { const end = visible ? t : Math.max(start, (i - 1) / 100); if (end - start > .025) intervals.push([start, end]); start = null; }
  }
  return intervals;
}

export function buildJiuzhouLCornerRoof(b, parent, name, { tiles = true, ...options } = {}) {
  const c = jiuzhouLCornerRoofControl(options), group = namedGroup(parent, name, { body: 'continuous-L-shaped-juanpeng-roof', originalCornerJunctionDetailRecovered: false });
  b.add(group, jiuzhouLCornerRoofGeometry(options), b.m.tileShade, undefined, undefined, undefined, true);
  const cover = tiles ? namedGroup(group, `${name}-individual-clay-tiles`, { body: 'nonduplicated-clay-tiles-trimmed-at-L-valleys' }) : null;
  const rafters = namedGroup(group, `${name}-underlying-rafters`, { body: 'separate-rafters-stopped-before-roof-intersections' });
  for (const vertical of [true, false]) {
    const low = vertical ? c.minZ : c.minX, high = vertical ? c.maxZ : c.maxX, rows = Math.floor((high - low) / .26);
    for (let row = 0; row < rows; row++) {
      const fixed = low + (row + .5) * (high - low) / rows;
      for (const side of [-1, 1]) {
        const sample = t => {
          const value = (1 - t) * (options.arm ?? 4.48) / 2 + (1 - t) * (options.overhang ?? .76);
          const x = vertical ? c.cx + side * value : fixed, z = vertical ? fixed : c.cz + side * value;
          return V(x, vertical ? c.verticalY(x) : c.horizontalY(z), z);
        };
        const visible = p => {
          const own = vertical ? c.verticalY(p.x) : c.horizontalY(p.z), other = vertical ? c.horizontalY(p.z) : c.verticalY(p.x);
          return own !== null && (other === null || own >= other + (vertical ? 0 : .002));
        };
        const intervals = visibleIntervals(sample, visible);
        for (const [start, end] of intervals) {
          if (tiles) jiuzhouTileRun(b, cover, t => sample(THREE.MathUtils.lerp(start, end, t)), row, { pan: row > 0 && row < rows - 1 });
          if (row % 2 === 0 && end - start > .10) {
            const points = Array.from({ length: 25 }, (_, i) => { const p = sample(THREE.MathUtils.lerp(Math.min(end, start + .028), Math.max(start, end - .028), i / 24)); p.y -= .18 + .11; return p; });
            b.tube(rafters, b.m.red, points, .052, 44, 12);
          }
        }
      }
      if (tiles) {
        const points = Array.from({ length: 13 }, (_, i) => { const delta = -.18 + .36 * i / 12, x = vertical ? c.cx + delta : fixed, z = vertical ? fixed : c.cz + delta; return V(x, c.heightAt(x, z) + .08, z); });
        const other = vertical ? c.horizontalY(fixed) : c.verticalY(fixed);
        if (other === null || other < c.eaveY + c.rise - .015) b.add(cover, roofTileRollGeometry(points, .081, .023, 24), b.m.greyTile, undefined, undefined, undefined, true);
      }
    }
  }
  return { group, control: c };
}
