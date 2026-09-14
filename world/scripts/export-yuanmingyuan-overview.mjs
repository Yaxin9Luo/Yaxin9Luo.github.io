#!/usr/bin/env node
import { readFile, writeFile, mkdir, access, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { MeshBVH } from 'three-mesh-bvh';
import { archiveValue, restoreArchiveValue, restoreYuanmingyuanArchive } from '../src/yuanmingyuan/asset-archive.js';
import { overviewAffineScaleBound, YUANMINGYUAN_OVERVIEW_SCHEMA } from '../src/yuanmingyuan/asset-overview.js';
import { captureYuanmingyuanState, serializeYuanmingyuanArchive, packYuanmingyuanArchive } from './export-yuanmingyuan-assets.mjs';

const world = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(world, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytesOf = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const checkpoint = signal => { if (signal?.aborted) throw signal.reason ?? new DOMException('Overview export aborted', 'AbortError'); };
const defaults = Object.freeze({ normalAngleRadians: Math.PI / 180, colorError: .5 / 255, uvError: 1e-4, textureTexelError: .25, maximumDepth: 12, maximumCells: 200000, hardEdgeAngleRadians: Math.PI / 5 });
function validateOptions(options) {
  for (const key of ['normalAngleRadians', 'colorError', 'uvError', 'textureTexelError', 'hardEdgeAngleRadians']) if (!Number.isFinite(options[key]) || options[key] <= 0) throw new Error(`Invalid overview constraint: ${key}`);
  if (!Number.isInteger(options.maximumDepth) || options.maximumDepth < 0 || options.maximumDepth > 20 || !Number.isInteger(options.maximumCells) || options.maximumCells <= 0) throw new Error('Invalid finite surface certification limits');
}

// Every attribute participates in an exact-byte key. No decimal tolerance,
// mergeVertices quantization, vertex movement, or normal recomputation occurs.
function exactVertices(geometry) {
  const attributes = Object.entries(geometry.attributes), count = geometry.attributes.position.count;
  const map = new Map(), representatives = [], remap = new Uint32Array(count);
  const views = attributes.map(([, a]) => ({ bytes: bytesOf(a.array), stride: a.itemSize * a.array.BYTES_PER_ELEMENT }));
  for (let i = 0; i < count; i++) {
    const key = views.map(({ bytes, stride }) => Buffer.from(bytes.subarray(i * stride, (i + 1) * stride)).toString('base64')).join('|');
    if (!map.has(key)) { map.set(key, representatives.length); representatives.push(i); }
    remap[i] = map.get(key);
  }
  const arrays = {};
  for (const [name, attribute] of attributes) {
    const array = new attribute.array.constructor(representatives.length * attribute.itemSize);
    representatives.forEach((source, target) => array.set(attribute.array.subarray(source * attribute.itemSize, (source + 1) * attribute.itemSize), target * attribute.itemSize));
    arrays[name] = new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized);
  }
  const raw = geometry.index?.array ?? Uint32Array.from({ length: count }, (_, i) => i), indices = Uint32Array.from(raw, index => remap[index]);
  return { arrays, indices, representatives };
}

function topology(indices, positions, angle) {
  const edges = new Map(), vertices = new Set(), parent = new Map(), faceNormals = [], locks = new Uint8Array(positions.length / 3);
  const root = x => { let p = x; while (parent.get(p) !== p) p = parent.get(p); while (parent.get(x) !== x) { const next = parent.get(x); parent.set(x, p); x = next; } return p; };
  const joinVertices = (a, b) => { const x = root(a), y = root(b); if (x !== y) parent.set(y, x); };
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [...indices.subarray(i, i + 3)], points = ids.map(id => new THREE.Vector3().fromArray(positions, id * 3));
    if (new Set(ids).size !== 3 || new THREE.Triangle(...points).getArea() <= 0) return { valid: false, reason: 'degenerate-triangle-retained' };
    faceNormals.push(new THREE.Triangle(...points).getNormal(new THREE.Vector3()));
    for (const v of ids) { vertices.add(v); if (!parent.has(v)) parent.set(v, v); }
    joinVertices(ids[0], ids[1]); joinVertices(ids[1], ids[2]);
    for (let j = 0; j < 3; j++) { const a = ids[j], b = ids[(j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`; if (!edges.has(key)) edges.set(key, []); edges.get(key).push({ a, b, face: i / 3 }); }
  }
  const boundary = [], components = new Map();
  for (const v of vertices) { const id = root(v); if (!components.has(id)) components.set(id, { v: 0, e: 0, f: 0, boundary: 0 }); components.get(id).v++; }
  for (let i = 0; i < indices.length; i += 3) components.get(root(indices[i])).f++;
  for (const entries of edges.values()) {
    const edge = entries[0], component = components.get(root(edge.a)); component.e++;
    if (entries.length > 2 || entries.length === 2 && entries[0].a === entries[1].a) return { valid: false, reason: 'nonmanifold-or-inconsistent-winding-retained' };
    if (entries.length === 1) { boundary.push(`${edge.a}>${edge.b}`); component.boundary++; locks[edge.a] = locks[edge.b] = 1; }
    else if (faceNormals[entries[0].face].dot(faceNormals[entries[1].face]) < Math.cos(angle)) locks[edge.a] = locks[edge.b] = 1;
  }
  return { valid: true, boundary: boundary.sort(), components: [...components.values()].map(c => [c.v - c.e + c.f, c.boundary]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), locks };
}

function attributeRules(arrays, materials, options) {
  const rules = []; let stride = 0;
  for (const [name, a] of Object.entries(arrays)) {
    if (name === 'position') continue;
    let limit = options.uvError, kind = 'vector';
    if (name === 'normal' || name === 'tangent') { kind = 'direction'; limit = options.normalAngleRadians; }
    else if (name === 'color') { kind = 'components'; limit = options.colorError; }
    else if (/^uv[123]?$/.test(name)) {
      const channel = name === 'uv' ? 0 : Number(name.slice(2));
      for (const material of materials) for (const texture of Object.values(material)) if (texture?.isTexture && texture.channel === channel) {
        const matrix = texture.matrixAutoUpdate ? new THREE.Matrix3().setUvTransform(texture.offset.x, texture.offset.y, texture.repeat.x, texture.repeat.y, texture.rotation, texture.center.x, texture.center.y) : texture.matrix;
        const e = matrix.elements, w = texture.image?.width, h = texture.image?.height;
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error('Textured overview requires real image dimensions');
        const pixelsPerUV = Math.hypot(e[0] * w, e[3] * w, e[1] * h, e[4] * h);
        if (pixelsPerUV > 0) limit = Math.min(limit, options.textureTexelError / pixelsPerUV);
      }
    } else throw new Error(`Unsupported overview attribute: ${name}`);
    rules.push({ name, offset: stride, size: a.itemSize, kind, limit }); stride += a.itemSize;
  }
  if (stride > 32) throw new Error('meshoptimizer accepts at most 32 attribute components');
  const count = arrays.position.count, values = new Float32Array(count * stride);
  for (let i = 0; i < count; i++) for (const rule of rules) for (let c = 0; c < rule.size; c++) values[i * stride + rule.offset + c] = arrays[rule.name].getComponent(i, c);
  return { rules, stride, values };
}

function vertexAt(index, positions, attrs) { return { p: new THREE.Vector3().fromArray(positions, index * 3), a: Array.from(attrs.values.subarray(index * attrs.stride, (index + 1) * attrs.stride)) }; }
function midpoint(a, b) { return { p: a.p.clone().add(b.p).multiplyScalar(.5), a: a.a.map((value, i) => (value + b.a[i]) * .5) }; }
const triangleKey = (a, b, c) => (a < b && a < c ? [a, b, c] : b < c ? [b, c, a] : [c, a, b]).join(':');

function attributeBounds(vertices, mapped, attributes, guard) {
  const errors = {};
  for (const rule of attributes.rules) {
    const a = vertices.map(v => v.a.slice(rule.offset, rule.offset + rule.size)), b = mapped.map(v => v.a.slice(rule.offset, rule.offset + rule.size));
    if (rule.kind === 'direction') {
      const av = a.map(v => new THREE.Vector3(...v)), bv = b.map(v => new THREE.Vector3(...v)), ref = [...av, ...bv].reduce((sum, v) => sum.add(v), new THREE.Vector3()).normalize();
      const minimumLength = Math.min(...[...av, ...bv].map(v => v.dot(ref))), delta = Math.max(...av.map((v, i) => v.distanceTo(bv[i]))) + guard;
      errors[rule.name] = minimumLength > 0 ? 2 * Math.asin(Math.min(1, delta / minimumLength)) : Infinity;
      if (rule.size === 4 && a.some((v, i) => Math.abs(v[3] - b[i][3]) > guard)) errors[rule.name] = Infinity;
    } else errors[rule.name] = Math.max(...a.map((v, i) => rule.kind === 'components' ? Math.max(...v.map((value, c) => Math.abs(value - b[i][c]))) : Math.hypot(...v.map((value, c) => value - b[i][c])))) + guard;
  }
  return errors;
}

const cross2 = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function clipPolygon(polygon, a, b, inside) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], dp = cross2(a, b, p), dq = cross2(a, b, q), keep = inside ? dp >= 0 : dp <= 0, next = inside ? dq >= 0 : dq <= 0;
    if (keep) result.push(p);
    if (keep !== next) result.push(p.clone().lerp(q, dp / (dp - dq)));
  }
  return result;
}
function subtractTriangle(polygon, triangle) {
  const outside = []; let inside = polygon;
  for (let i = 0; i < 3 && inside.length; i++) { const a = triangle[i], b = triangle[(i + 1) % 3], part = clipPolygon(inside, a, b, false); if (part.length >= 3) outside.push(part); inside = clipPolygon(inside, a, b, true); }
  return { inside, outside };
}
const polygonArea = polygon => Math.abs(polygon.slice(1, -1).reduce((sum, p, i) => sum + cross2(polygon[0], p, polygon[i + 2]), 0)) / 2;

function planarCertificate(positions, sourceIndices, targetIndices, attributes, guard, maximumError) {
  const sourceTopology = topology(sourceIndices, positions, Math.PI), targetTopology = topology(targetIndices, positions, Math.PI);
  if (!sourceTopology.valid || !targetTopology.valid || JSON.stringify(sourceTopology.boundary) !== JSON.stringify(targetTopology.boundary) || JSON.stringify(sourceTopology.components) !== JSON.stringify(targetTopology.components)) return null;
  const reference = [...sourceIndices.subarray(0, 3)].map(i => vertexAt(i, positions, attributes)), planeTriangle = new THREE.Triangle(...reference.map(v => v.p)), normal = planeTriangle.getNormal(new THREE.Vector3());
  const ids = new Set([...sourceIndices, ...targetIndices]); let deviation = 0;
  const residuals = Object.fromEntries(attributes.rules.map(rule => [rule.name, 0])), minimumLengths = {}, normalReferences = {};
  for (const rule of attributes.rules) if (rule.kind === 'direction') { normalReferences[rule.name] = new THREE.Vector3(...reference[0].a.slice(rule.offset, rule.offset + 3)).normalize(); minimumLengths[rule.name] = Infinity; }
  for (const id of ids) {
    const v = vertexAt(id, positions, attributes), distance = v.p.clone().sub(reference[0].p).dot(normal); deviation = Math.max(deviation, Math.abs(distance));
    if (deviation > guard) return null;
    const bary = planeTriangle.getBarycoord(v.p, new THREE.Vector3());
    for (const rule of attributes.rules) {
      const a = v.a.slice(rule.offset, rule.offset + rule.size), expected = a.map((_, i) => reference[0].a[rule.offset + i] * bary.x + reference[1].a[rule.offset + i] * bary.y + reference[2].a[rule.offset + i] * bary.z);
      const residual = rule.kind === 'components' ? Math.max(...a.map((value, i) => Math.abs(value - expected[i]))) : Math.hypot(...a.slice(0, rule.kind === 'direction' ? 3 : rule.size).map((value, i) => value - expected[i]));
      residuals[rule.name] = Math.max(residuals[rule.name], residual);
      if (rule.kind === 'direction') { minimumLengths[rule.name] = Math.min(minimumLengths[rule.name], new THREE.Vector3(...a).dot(normalReferences[rule.name])); if (rule.size === 4 && a[3] !== reference[0].a[rule.offset + 3]) return null; }
    }
  }
  // A consistently oriented planar triangle chain is determined by its exact
  // oriented boundary. Equal chains cover the same domain, including holes;
  // this avoids treating a finite vertex sample as proof of planar coverage.
  for (const indices of [sourceIndices, targetIndices]) for (let i = 0; i < indices.length; i += 3) if (new THREE.Triangle(...[0, 1, 2].map(k => new THREE.Vector3().fromArray(positions, indices[i + k] * 3))).getNormal(new THREE.Vector3()).dot(normal) < 1 - 1e-10) return null;
  const bounds = {};
  for (const rule of attributes.rules) {
    const delta = 2 * residuals[rule.name] + guard;
    bounds[rule.name] = rule.kind === 'direction' ? minimumLengths[rule.name] > 0 ? 2 * Math.asin(Math.min(1, delta / minimumLengths[rule.name])) : Infinity : delta;
    if (bounds[rule.name] > rule.limit) return null;
  }
  const error = 2 * deviation + guard;
  return error <= maximumError ? { certifiedMaximumError: error, attributeUpperBounds: bounds, planarBoundaryAndAffineAttributeCertificate: true } : null;
}

/** A leaf maps its three vertices to one triangle of the other surface. Both
 * triangles and barycentric attributes are convex: the maximum of the three
 * displacement norms bounds every point of the leaf, not just the samples.
 * The reverse cover guards against a replacement surface filling empty space.
 * Recursion limits cause rejection, never an unverified acceptance. */
export function certifyOverviewSurface({ positions, sourceIndices, targetIndices, attributes = { rules: [], stride: 0, values: new Float32Array() }, maximumError, maximumDepth = defaults.maximumDepth, maximumCells = defaults.maximumCells, signal }) {
  validateOptions({ ...defaults, maximumDepth, maximumCells }); checkpoint(signal);
  if (!Number.isFinite(maximumError) || maximumError <= 0) throw new Error('A positive surface certification error is required');
  let conditioning = 1;
  for (const indices of [sourceIndices, targetIndices]) for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromArray(positions, indices[i + k] * 3)), area = new THREE.Triangle(a, b, c).getArea();
    const ratio = Math.max(a.distanceToSquared(b), b.distanceToSquared(c), c.distanceToSquared(a)) / (2 * area);
    if (!Number.isFinite(ratio) || ratio > 1e8) return { method: 'bidirectional-convex-triangle-cover-v1', certified: false, failure: 'ill-conditioned-triangle-retained' }; conditioning = Math.max(conditioning, ratio);
  }
  const guard = Math.max(1, ...[0, 1, 2].map(c => { let m = 0; for (let i = c; i < positions.length; i += 3) m = Math.max(m, Math.abs(positions[i])); return m; })) * Number.EPSILON * 256 * conditioning;
  const metrics = { method: 'bidirectional-convex-triangle-cover-v1', certified: false, certifiedMaximumError: 0, sampledMaximumNearestDistance: 0, nearestDistanceSamples: 0, numericalGuard: guard, checkedCells: 0, acceptedLeaves: 0, clippedPolygonLeaves: 0, maximumDepthUsed: 0, attributeUpperBounds: {} };
  if (!sourceIndices.length || !targetIndices.length) return { ...metrics, failure: 'empty-surface' };
  const planar = planarCertificate(positions, sourceIndices, targetIndices, attributes, guard, maximumError);
  if (planar) return { ...metrics, ...planar, certified: true };
  function directed(from, to) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(new THREE.BufferAttribute(to, 1));
    const bvh = new MeshBVH(geometry, { indirect: true, targetLeafSize: 8, setBoundingBox: false }), unchanged = new Set();
    for (let i = 0; i < to.length; i += 3) unchanged.add(triangleKey(...to.subarray(i, i + 3)));
    const sample = { point: new THREE.Vector3() };
    const accept = (error, errors) => { metrics.acceptedLeaves++; metrics.certifiedMaximumError = Math.max(metrics.certifiedMaximumError, error); for (const [key, value] of Object.entries(errors)) metrics.attributeUpperBounds[key] = Math.max(metrics.attributeUpperBounds[key] ?? 0, value); };
    function projectedCover(vertices) {
      const sourceTriangle = new THREE.Triangle(...vertices.map(v => v.p)), normal = sourceTriangle.getNormal(new THREE.Vector3()), u = vertices[1].p.clone().sub(vertices[0].p).normalize(), v = new THREE.Vector3().crossVectors(normal, u), origin = vertices[0].p;
      const project = point => { const delta = point.clone().sub(origin); return new THREE.Vector2(delta.dot(u), delta.dot(v)); };
      let remaining = [vertices.map(vertex => project(vertex.p))]; const query = new THREE.Box3().setFromPoints(vertices.map(vertex => vertex.p)).expandByScalar(maximumError + guard), candidates = [];
      bvh.shapecast({ intersectsBounds: box => box.intersectsBox(query), intersectsTriangle: (_triangle, index) => { candidates.push(index); } });
      for (const index of candidates) {
        checkpoint(signal); if (metrics.checkedCells >= maximumCells || remaining.length > 512) return false;
        const target = [0, 1, 2].map(k => vertexAt(to[index * 3 + k], positions, attributes)), targetTriangle = new THREE.Triangle(...target.map(vertex => vertex.p));
        if (targetTriangle.getNormal(new THREE.Vector3()).dot(normal) <= 1e-6) continue;
        const projected = target.map(vertex => project(vertex.p)), denominator = cross2(projected[0], projected[1], projected[2]); if (denominator <= 0) continue;
        const next = [];
        for (const polygon of remaining) {
          const clipped = subtractTriangle(polygon, projected);
          if (clipped.inside.length < 3 || polygonArea(clipped.inside) === 0) { next.push(polygon); continue; }
          metrics.checkedCells++;
          const a = [], b = [];
          for (const point of clipped.inside) {
            const p = origin.clone().addScaledVector(u, point.x).addScaledVector(v, point.y), bary = sourceTriangle.getBarycoord(p, new THREE.Vector3());
            a.push({ p, a: vertices[0].a.map((_, c) => vertices[0].a[c] * bary.x + vertices[1].a[c] * bary.y + vertices[2].a[c] * bary.z) });
            const weights = [cross2(projected[1], projected[2], point), cross2(projected[2], projected[0], point), cross2(projected[0], projected[1], point)].map(weight => weight / denominator);
            if (weights.some(weight => weight < -guard || weight > 1 + guard)) return false;
            const q = target.reduce((sum, vertex, k) => sum.addScaledVector(vertex.p, weights[k]), new THREE.Vector3());
            b.push({ p: q, a: vertices[0].a.map((_, c) => target.reduce((sum, vertex, k) => sum + vertex.a[c] * weights[k], 0)) });
          }
          const error = Math.max(...a.map((vertex, k) => vertex.p.distanceTo(b[k].p))) + guard, errors = attributeBounds(a, b, attributes, guard);
          if (error <= maximumError && attributes.rules.every(rule => errors[rule.name] <= rule.limit)) { accept(error, errors); metrics.clippedPolygonLeaves++; next.push(...clipped.outside.filter(part => polygonArea(part) > 0)); }
          else next.push(polygon);
        }
        remaining = next; if (!remaining.length) return true;
      }
      // Numerical slivers on projected shared edges still have to be covered;
      // there is no area threshold that quietly discards a missing region.
      for (const polygon of remaining) for (let i = 1; i < polygon.length - 1; i++) {
        const points = [polygon[0], polygon[i], polygon[i + 1]].map(point => {
          const p = origin.clone().addScaledVector(u, point.x).addScaledVector(v, point.y), bary = sourceTriangle.getBarycoord(p, new THREE.Vector3());
          return { p, a: vertices[0].a.map((_, c) => vertices[0].a[c] * bary.x + vertices[1].a[c] * bary.y + vertices[2].a[c] * bary.z) };
        });
        if (new THREE.Triangle(...points.map(point => point.p)).getArea() > 0 && cover(points, 0, normal)) return false;
      }
      return true;
    }
    function cover(vertices, depth, orientationNormal = new THREE.Triangle(...vertices.map(vertex => vertex.p)).getNormal(new THREE.Vector3())) {
      checkpoint(signal); metrics.checkedCells++; metrics.maximumDepthUsed = Math.max(metrics.maximumDepthUsed, depth);
      if (metrics.checkedCells > maximumCells) return 'surface-cover-cell-limit';
      const centre = vertices.reduce((sum, v) => sum.add(v.p), new THREE.Vector3()).multiplyScalar(1 / 3), hit = bvh.closestPointToPoint(centre, sample);
      if (!hit) return 'surface-cover-empty-target';
      metrics.nearestDistanceSamples++;
      metrics.sampledMaximumNearestDistance = Math.max(metrics.sampledMaximumNearestDistance, hit.distance);
      if (hit.distance > maximumError) return 'sample-exceeds-geometric-error';
      const target = [0, 1, 2].map(k => vertexAt(to[hit.faceIndex * 3 + k], positions, attributes)), triangle = new THREE.Triangle(...target.map(v => v.p));
      const mapped = vertices.map(v => {
        const p = triangle.closestPointToPoint(v.p, new THREE.Vector3()), bary = triangle.getBarycoord(p, new THREE.Vector3());
        if (!bary) throw new Error('Degenerate certificate target triangle');
        return { p, a: v.a.map((_, i) => target[0].a[i] * bary.x + target[1].a[i] * bary.y + target[2].a[i] * bary.z) };
      });
      const error = Math.max(...vertices.map((v, i) => v.p.distanceTo(mapped[i].p))) + guard, errors = attributeBounds(vertices, mapped, attributes, guard);
      let accepted = error <= maximumError && triangle.getNormal(new THREE.Vector3()).dot(orientationNormal) > 0;
      for (const rule of attributes.rules) if (errors[rule.name] > rule.limit) accepted = false;
      if (accepted) {
        accept(error, errors);
        return null;
      }
      if (depth >= maximumDepth) return 'surface-or-attribute-cover-depth-limit';
      const [a, b, c] = vertices, ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      for (const child of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) { const failed = cover(child, depth + 1, orientationNormal); if (failed) return failed; }
      return null;
    }
    try {
      for (let i = 0; i < from.length; i += 3) {
        if (unchanged.has(triangleKey(...from.subarray(i, i + 3)))) continue;
        const vertices = [0, 1, 2].map(k => vertexAt(from[i + k], positions, attributes));
        if (!projectedCover(vertices)) { const failure = cover(vertices, 0); if (failure) return failure; }
      }
      return null;
    } finally { geometry.dispose(); }
  }
  const failure = directed(sourceIndices, targetIndices) ?? directed(targetIndices, sourceIndices);
  return { ...metrics, certified: !failure, ...(failure ? { failure } : {}) };
}

export async function simplifyOverviewGeometry(geometry, { materials = [], maximumError, signal, ...settings } = {}) {
  const options = { ...defaults, ...settings }, originalTriangles = (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3; validateOptions(options); checkpoint(signal);
  const retained = (reason, extra = {}) => ({ geometry, created: false, report: { originalTriangles, overviewTriangles: originalTriangles, maximumError: 0, retainedReason: reason, ...extra } });
  if (!Number.isFinite(maximumError) || maximumError <= 0) throw new Error('An explicit positive geometric error in local units is required');
  const attributes = Object.entries(geometry.attributes), position = geometry.attributes.position, total = geometry.index?.count ?? position?.count;
  if (!position || position.itemSize !== 3 || !(position.array instanceof Float32Array) || position.normalized || !Number.isInteger(originalTriangles) || !originalTriangles) return retained('unsupported-position-or-triangle-layout');
  if (geometry.drawRange.start !== 0 || geometry.drawRange.count < total || Object.keys(geometry.morphAttributes).length || geometry.isInstancedBufferGeometry) return retained('partial-draw-or-deformation-retained');
  for (const [name, a] of attributes) if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute || a.isFloat16BufferAttribute || a.count !== position.count || !['position', 'normal', 'tangent', 'color', 'uv', 'uv1', 'uv2', 'uv3'].includes(name) || (name === 'normal' && a.itemSize !== 3) || (name === 'tangent' && a.itemSize !== 4) || (name === 'color' && ![3, 4].includes(a.itemSize)) || (/^uv/.test(name) && a.itemSize !== 2)) return retained('unsupported-attribute-layout');
  for (const [, a] of attributes) for (const value of a.array) if (!Number.isFinite(value)) throw new Error('Non-finite source overview attribute');
  if (geometry.index) for (const index of geometry.index.array) if (!Number.isInteger(index) || index < 0 || index >= position.count) throw new Error('Invalid source overview index');
  if (materials.some(m => m.transparent || m.transmission > 0 || m.alphaTest > 0 || m.displacementMap || m.wireframe || m.flatShading || m.userData.category === 'water')) return retained('transparent-cutout-displaced-flat-or-water-surface-retained');
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }]; let end = 0;
  for (const group of groups) { if (group.start !== end || group.count % 3 || !Number.isInteger(group.count) || group.count <= 0) return retained('noncontiguous-material-groups-retained'); end += group.count; }
  if (end !== total) return retained('incomplete-material-groups-retained');
  await MeshoptSimplifier.ready; checkpoint(signal);
  if (!MeshoptSimplifier.supported) throw new Error('meshoptimizer simplification is unavailable');
  const welded = exactVertices(geometry), positions = welded.arrays.position.array, attrs = attributeRules(welded.arrays, materials, options), segments = [], reports = [];
  const weights = attrs.rules.flatMap(rule => Array(rule.size).fill(maximumError / Math.max(rule.kind === 'direction' ? Math.sin(rule.limit / 2) : rule.limit, 1e-12)));
  for (const group of groups) {
    checkpoint(signal); const source = welded.indices.slice(group.start, group.start + group.count), before = topology(source, positions, options.hardEdgeAngleRadians);
    if (!before.valid) { segments.push(source); reports.push({ materialIndex: group.materialIndex, originalTriangles: source.length / 3, overviewTriangles: source.length / 3, retainedReason: before.reason }); continue; }
    const [candidate, approximateError] = MeshoptSimplifier.simplifyWithAttributes(source, positions, 3, attrs.values, attrs.stride, weights, before.locks, 0, maximumError, ['LockBorder', 'ErrorAbsolute', 'Sparse']);
    const base = { materialIndex: group.materialIndex, originalTriangles: source.length / 3, candidateTriangles: candidate.length / 3, meshoptimizerApproximateError: approximateError, lockedVertices: before.locks.reduce((n, value) => n + value, 0) };
    if (!candidate.length || candidate.length >= source.length) { segments.push(source); reports.push({ ...base, overviewTriangles: source.length / 3, retainedReason: 'error-or-topology-prevents-reduction' }); continue; }
    const after = topology(candidate, positions, options.hardEdgeAngleRadians);
    if (!after.valid || JSON.stringify(before.boundary) !== JSON.stringify(after.boundary) || JSON.stringify(before.components) !== JSON.stringify(after.components)) { segments.push(source); reports.push({ ...base, overviewTriangles: source.length / 3, retainedReason: 'topology-or-exact-boundary-check-failed' }); continue; }
    const certificate = certifyOverviewSurface({ positions, sourceIndices: source, targetIndices: candidate, attributes: attrs, maximumError, maximumDepth: options.maximumDepth, maximumCells: options.maximumCells, signal });
    segments.push(certificate.certified ? candidate : source); reports.push({ ...base, overviewTriangles: certificate.certified ? candidate.length / 3 : source.length / 3, topology: { components: before.components, exactOrientedBoundaryEdges: before.boundary.length }, certificate, ...(!certificate.certified ? { retainedReason: certificate.failure } : {}) });
  }
  const count = segments.reduce((sum, indices) => sum + indices.length, 0);
  if (count >= total) return retained('no-certified-reduction', { groups: reports });
  const indices = new Uint32Array(count); let offset = 0; const outputGroups = [];
  segments.forEach((segment, i) => { indices.set(segment, offset); outputGroups.push({ ...groups[i], start: offset, count: segment.length }); offset += segment.length; });
  const remap = new Map(), used = [];
  for (const index of indices) if (!remap.has(index)) { remap.set(index, used.length); used.push(index); }
  const result = new THREE.BufferGeometry(); result.name = geometry.name; result.userData = restoreArchiveValue(archiveValue(geometry.userData));
  for (const [name, source] of Object.entries(geometry.attributes)) {
    const array = new source.array.constructor(used.length * source.itemSize);
    used.forEach((weldedIndex, i) => { const original = welded.representatives[weldedIndex]; array.set(source.array.subarray(original * source.itemSize, (original + 1) * source.itemSize), i * source.itemSize); });
    const a = new THREE.BufferAttribute(array, source.itemSize, source.normalized); a.name = source.name; a.usage = source.usage; a.gpuType = source.gpuType; result.setAttribute(name, a);
  }
  result.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices, index => remap.get(index)), 1)); if (geometry.groups.length) result.groups = outputGroups;
  result.computeBoundingBox(); result.computeBoundingSphere();
  return { geometry: result, created: true, report: { originalTriangles, overviewTriangles: count / 3, originalVertices: position.count, exactWeldedVertices: welded.representatives.length, overviewVertices: used.length, maximumError: Math.max(0, ...reports.filter(r => r.certificate?.certified).map(r => r.certificate.certifiedMaximumError)), attributeLimits: attrs.rules, groups: reports } };
}

/** Borrows source materials, textures, and unchanged geometries. Only new
 * compact geometry and cloned InstancedMesh resources belong to this result.
 * The independent serialized archive subsequently owns every restored object. */
export async function createYuanmingyuanOverview(source, { id, maximumErrorWorld, sourceArchiveDigest, signal, onProgress, ...settings } = {}) {
  if (!Number.isFinite(maximumErrorWorld) || maximumErrorWorld <= 0) throw new Error('Supply an explicit positive maximumErrorWorld');
  if (!source?.group?.isObject3D || source.group.parent) throw new Error('Overview input must be a standalone restored archive root');
  validateOptions({ ...defaults, ...settings }); checkpoint(signal);
  const group = source.group.clone(true), originalNodes = [], nodes = [], owned = new Set(), geometryUsers = new Map(), originalBounds = new THREE.Box3(); let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; for (const resource of owned) resource.dispose(); owned.clear(); group.clear(); };
  try {
    source.group.traverse(n => originalNodes.push(n)); group.traverse(n => { nodes.push(n); if (n.isInstancedMesh) owned.add(n); });
    for (const [i, node] of nodes.entries()) {
      const original = originalNodes[i];
      node.userData = restoreArchiveValue(archiveValue(original.userData)); node.customDepthMaterial = original.customDepthMaterial; node.customDistanceMaterial = original.customDistanceMaterial;
      if (!node.matrixWorldAutoUpdate) throw new Error('Manual world transforms require a separately verified movable overview adapter');
      if (node.isInstancedMesh) for (const key of ['instanceMatrix', 'instanceColor']) if (node[key]) node[key].updateRanges = original[key].updateRanges.map(range => ({ ...range }));
      if (node.isMesh) { if (!geometryUsers.has(node.geometry)) geometryUsers.set(node.geometry, []); geometryUsers.get(node.geometry).push(node); }
    }
    group.updateWorldMatrix(true, true);
    if (group.matrixWorld.determinant() === 0) throw new Error('Source root transform is singular');
    const report = { schema: YUANMINGYUAN_OVERVIEW_SCHEMA, kind: 'yuanmingyuan-overview', id, sourceArchiveDigest, sourceRootWorldMatrix: group.matrixWorld.toArray(), requestedMaximumErrorWorld: maximumErrorWorld, maximumErrorArchiveWorld: 0, fullArchiveRetained: true, materialsAndTexturePixelsUnchanged: true, verticesMoved: false, quantized: false, nativeOverviewVisualReview: false, simplifier: { name: 'meshoptimizer', version: '1.2.0', method: 'simplifyWithAttributes', flags: ['LockBorder', 'ErrorAbsolute', 'Sparse'], targetIndexCount: 0, targetPolicy: 'error bound only; no requested triangle reduction ratio', returnedErrorIsApproximate: true }, certification: { method: 'bidirectional-convex-triangle-cover-v1', allAcceptedGeometryCertified: true, exactMaximumNotComputed: true, boundsMeaning: 'sampled nearest-point lower bound and conservative surface-wide upper bound; includes conditioning-scaled numerical guard', attributes: { ...defaults, ...settings }, floatingPointQualification: 'double precision convex cover with explicit roundoff allowance, not interval-arithmetic formal proof', visualQualification: 'geometry coverage in the declared camera; local interpolated attributes also bounded, but specular shading, shadows, reflections and final pixels still require native review' }, geometries: [] };
    for (const [geometry, users] of geometryUsers) {
      checkpoint(signal); let maximumScale = 0, instanceCount = 0; const materials = new Set();
      const box = geometry.boundingBox?.clone() ?? new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
      for (const node of users) {
        for (const material of [node.material, node.customDepthMaterial, node.customDistanceMaterial].flat().filter(Boolean)) materials.add(material);
        const transforms = node.isInstancedMesh ? Array.from({ length: node.count }, (_, i) => { const matrix = new THREE.Matrix4(); node.getMatrixAt(i, matrix); return new THREE.Matrix4().multiplyMatrices(node.matrixWorld, matrix); }) : [node.matrixWorld];
        instanceCount += transforms.length;
        for (const transform of transforms) { maximumScale = Math.max(maximumScale, overviewAffineScaleBound(transform)); originalBounds.union(box.clone().applyMatrix4(transform)); }
      }
      const result = maximumScale > 0 ? await simplifyOverviewGeometry(geometry, { maximumError: maximumErrorWorld / maximumScale, materials: [...materials], signal, ...settings }) : { geometry, created: false, report: { originalTriangles: (geometry.index?.count ?? geometry.attributes.position.count) / 3, overviewTriangles: (geometry.index?.count ?? geometry.attributes.position.count) / 3, maximumError: 0, retainedReason: 'zero-scale-instance' } };
      if (result.created) { owned.add(result.geometry); for (const node of users) { node.geometry = result.geometry; if (node.isInstancedMesh) { node.computeBoundingBox(); node.computeBoundingSphere(); } } }
      report.geometries.push({ name: geometry.name, users: users.map(node => node.name), instances: instanceCount, maximumSourceWorldScaleBound: maximumScale, ...result.report });
      report.maximumErrorArchiveWorld = Math.max(report.maximumErrorArchiveWorld, result.report.maximumError * maximumScale); onProgress?.({ phase: 'certified-geometry', completed: report.geometries.length, total: geometryUsers.size });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    report.boundsArchiveWorld = { min: originalBounds.min.toArray(), max: originalBounds.max.toArray() };
    report.originalTriangles = report.geometries.reduce((sum, item) => sum + item.originalTriangles * item.instances, 0); report.overviewTriangles = report.geometries.reduce((sum, item) => sum + item.overviewTriangles * item.instances, 0);
    return { group, report, diagnostics: { ...source.diagnostics, representation: 'error-constrained-distant-overview', visualAcceptance: false }, update: source.update, dispose };
  } catch (error) { dispose(); throw error; }
}

async function producerSources() {
  const files = new Map();
  async function visit(file) {
    if (files.has(file)) return; const bytes = await readFile(file); files.set(file, hash(bytes));
    if (!/\.[cm]?js$/.test(file)) return;
    for (const match of bytes.toString().matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const name = match[1]; if (name.startsWith('.')) await visit(resolve(dirname(file), name));
      else if (name === 'three' || name.startsWith('three/') || name === 'three-mesh-bvh' || name === 'meshoptimizer/simplifier') await visit(fileURLToPath(import.meta.resolve(name)));
    }
  }
  await visit(fileURLToPath(import.meta.url));
  for (const path of ['package.json', 'package-lock.json', 'node_modules/meshoptimizer/package.json', 'node_modules/three-mesh-bvh/package.json', 'node_modules/three/package.json']) await visit(resolve(world, path));
  const packageInfo = JSON.parse(await readFile(resolve(world, 'node_modules/meshoptimizer/package.json')));
  if (packageInfo.version !== '1.2.0') throw new Error('This overview certificate adapter is pinned to meshoptimizer 1.2.0');
  return Object.fromEntries([...files].map(([path, digest]) => [path.slice(repo.length + 1), digest]).sort(([a], [b]) => a.localeCompare(b)));
}

function observeOwnedResources(...assets) {
  const resources = new Set(), calls = new Map();
  for (const asset of assets) {
    const { objects } = captureYuanmingyuanState(asset);
    for (const key of ['geometries', 'materials', 'textures']) for (const object of objects[key]) resources.add(object);
    for (const object of objects.nodes) if (object.isInstancedMesh) resources.add(object);
  }
  for (const object of resources) { calls.set(object, 0); object.addEventListener('dispose', () => calls.set(object, calls.get(object) + 1)); }
  return () => {
    const counts = [...calls.values()]; if (counts.some(count => count !== 1)) throw new Error('Overview or restored source resource was not disposed exactly once');
    return { uniqueResources: counts.length, disposedExactlyOnce: counts.length, retainedUntilProcessExit: 'ordinary CPU typed arrays can remain reachable until garbage collection; GPU ownership is disposed' };
  };
}

/** Reads one verified full archive; never imports or invokes a production
 * factory. Publication stays separate from the full-resolution archive. */
export async function exportYuanmingyuanOverview({ id, archiveDirectory, outputDirectory, publicRoot = resolve(world, 'public/assets/yuanmingyuan-overview'), maximumErrorWorld, signal, onProgress }) {
  if (!/^[a-z][a-z0-9-]{0,70}$/.test(id ?? '') || !archiveDirectory) throw new Error('One valid --id and full --archive directory are required');
  if (!Number.isFinite(maximumErrorWorld) || maximumErrorWorld <= 0) throw new Error('An explicit positive --max-error-world is required');
  const full = resolve(archiveDirectory), manifestBytes = await readFile(join(full, 'manifest.json')), fullManifest = JSON.parse(manifestBytes);
  if (fullManifest.id !== id || fullManifest.overview || fullManifest.verification?.exactRoundtripPassed !== true || fullManifest.verification?.simplified !== false || !/^[a-f0-9]{64}$/.test(fullManifest.sourceDigest ?? '')) throw new Error('Input must be a verified full archive, never another LOD');
  const sourceSHA256 = await producerSources(), sourceArchive = { manifestSHA256: hash(manifestBytes), glbSHA256: fullManifest.glb.sha256, runtimeSHA256: fullManifest.runtime.sha256, sourceDigest: fullManifest.sourceDigest };
  const digest = hash(JSON.stringify({ sourceArchive, sourceSHA256, maximumErrorWorld, defaults })), output = resolve(outputDirectory ?? resolve(repo, 'work/yuanmingyuan/asset-overviews', id, digest.slice(0, 16)));
  if (output.startsWith(resolve(world, 'public') + '/') || output === resolve(world, 'public') || output === full) throw new Error('Raw overview reviews must remain separate from public and the full archive');
  try { await access(output); throw new Error(`Overview output already exists: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${output}.pending-${process.pid}`, publicStage = `${output}.transport-${process.pid}`; await mkdir(dirname(output), { recursive: true }); await mkdir(temporary);
  let source, overview, disposed = false, written = false; const started = performance.now(), memoryBefore = process.memoryUsage();
  try {
    checkpoint(signal);
    const readEntry = async entry => {
      if (entry.compression || entry.url !== `${id}.glb` && entry.url !== `${id}.runtime.json`) throw new Error('CLI reads retained raw review archives with local basename entries');
      const bytes = await readFile(join(full, entry.url)); if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error('Full archive entry size or SHA256 changed'); return bytes;
    };
    const runtimeBytes = await readEntry(fullManifest.runtime), glb = await readEntry(fullManifest.glb), metadata = JSON.parse(runtimeBytes);
    source = await restoreYuanmingyuanArchive(glb, metadata, { signal, onProgress });
    overview = await createYuanmingyuanOverview(source, { id, maximumErrorWorld, sourceArchiveDigest: fullManifest.sourceDigest, signal, onProgress });
    const disposal = observeOwnedResources(source, overview), archive = await serializeYuanmingyuanArchive(overview, { id, sourceSHA256 });
    archive.metadata.verification.simplified = true; archive.metadata.verification.comparedAgainst = 'certified offline overview, not the full-resolution source';
    archive.metadata.verification.nativeVisualReview = false;
    const runtime = Buffer.from(JSON.stringify(archive.metadata, null, 2) + '\n');
    overview.report.sourceArchive = sourceArchive; overview.report.producerSHA256 = sourceSHA256;
    const reportBytes = Buffer.from(JSON.stringify(overview.report, null, 2) + '\n');
    const manifest = { schema: 1, id, kind: 'yuanmingyuan-overview-archive', exportedAt: new Date().toISOString(), sourceDigest: digest, sourceArchiveDigest: fullManifest.sourceDigest, sourceSHA256, fullResolutionReplaced: false, nativeOverviewVisualReview: false, glb: { url: `${id}.glb`, sha256: hash(archive.glb), bytes: archive.glb.length }, runtime: { url: `${id}.runtime.json`, sha256: hash(runtime), bytes: runtime.length }, overview: { url: 'overview.json', sha256: hash(reportBytes), bytes: reportBytes.length }, verification: archive.metadata.verification };
    if (JSON.stringify(await producerSources()) !== JSON.stringify(sourceSHA256) || hash(await readFile(join(full, 'manifest.json'))) !== sourceArchive.manifestSHA256) throw new Error('Overview producer or source manifest changed during export');
    const memoryAfterRoundtrip = process.memoryUsage(); overview.dispose(); source.dispose(); disposed = true;
    manifest.resourceDisposal = disposal(); manifest.memoryBytes = { before: memoryBefore, afterRoundtrip: memoryAfterRoundtrip, afterDisposal: process.memoryUsage() }; manifest.elapsedMilliseconds = performance.now() - started;
    await writeFile(join(temporary, `${id}.glb`), archive.glb); await writeFile(join(temporary, `${id}.runtime.json`), runtime); await writeFile(join(temporary, 'overview.json'), reportBytes); await writeFile(join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await rename(temporary, output); written = true;
    const packed = await packYuanmingyuanArchive({ id, archiveDirectory: output, publicRoot: publicStage });
    await writeFile(join(packed.output, 'overview.json'), reportBytes);
    const publicOutput = resolve(publicRoot, id, digest.slice(0, 16) + '-gzip-bin-v1');
    try { await access(publicOutput); throw new Error(`Overview transport already exists: ${publicOutput}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(dirname(publicOutput), { recursive: true }); await rename(packed.output, publicOutput);
    return { output, publicOutput, manifestURL: resolve(publicRoot) === resolve(world, 'public/assets/yuanmingyuan-overview') ? `/assets/yuanmingyuan-overview/${id}/${digest.slice(0, 16)}-gzip-bin-v1/manifest.json` : null, manifest: packed.manifest, overview: overview.report };
  } finally {
    if (!disposed) { overview?.dispose(); source?.dispose(); }
    if (!written) await rm(temporary, { recursive: true, force: true });
    await rm(publicStage, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('Usage: node scripts/export-yuanmingyuan-overview.mjs --id <id> --archive <full-raw-review-directory> --max-error-world <positive-world-units> [--output <new-review-directory>] [--public-root <directory>]\nOne full archive per run. Large archives require the coordinated exclusive CPU slot. No production factory, triangle-count target, or automatic visual approval.');
  else {
    try {
      const options = {};
      for (let i = 0; i < args.length; i += 2) { if (!['--id', '--archive', '--max-error-world', '--output', '--public-root'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Supply documented flags once, each with one value'); options[args[i]] = args[i + 1]; }
      console.log(JSON.stringify(await exportYuanmingyuanOverview({ id: options['--id'], archiveDirectory: options['--archive'], maximumErrorWorld: Number(options['--max-error-world']), outputDirectory: options['--output'], publicRoot: options['--public-root'] }), null, 2));
    } catch (error) { console.error(error.stack); process.exitCode = 1; }
  }
}
