import * as THREE from 'three';
import { pointInPolygon } from './garden-layout.js';

const EPS = 1e-7, TAU = Math.PI * 2;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const pointKey = p => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
export const polygonArea = ring => ring.reduce((sum, p, i) => sum + cross(p, ring[(i + 1) % ring.length]), 0) / 2;
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const smoothstep = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export function closestOnSegment(point, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  const t = length2 ? clamp01(((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length2) : 0;
  const position = [a[0] + dx * t, a[1] + dz * t];
  return { position, t, distance: Math.hypot(point[0] - position[0], point[1] - position[1]) };
}

export function distanceToRing(point, ring) {
  let distance = Infinity;
  for (let i = 0; i < ring.length; i++) distance = Math.min(distance, closestOnSegment(point, ring[i], ring[(i + 1) % ring.length]).distance);
  return distance;
}

export function ringBounds(ring) {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const [x, z] of ring) { bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z); }
  return bounds;
}

// A bounded index is also used by height sampling; no browser, model factory or GPU.
export function createSpatialIndex(items, getBounds, cellSize = 64, padding = 0) {
  const cells = new Map();
  for (const item of items) {
    const b = getBounds(item);
    for (let ix = Math.floor((b.minX - padding) / cellSize); ix <= Math.floor((b.maxX + padding) / cellSize); ix++) {
      for (let iz = Math.floor((b.minZ - padding) / cellSize); iz <= Math.floor((b.maxZ + padding) / cellSize); iz++) {
        const key = `${ix},${iz}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(item);
      }
    }
  }
  return { at: (x, z) => cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? [], clear: () => cells.clear() };
}

function splitIntersections(a, b) {
  if (a.bounds.maxX < b.bounds.minX - EPS || b.bounds.maxX < a.bounds.minX - EPS || a.bounds.maxZ < b.bounds.minZ - EPS || b.bounds.maxZ < a.bounds.minZ - EPS) return;
  const r = subtract(a.to, a.from), s = subtract(b.to, b.from), q = subtract(b.from, a.from), denominator = cross(r, s);
  if (Math.abs(denominator) > EPS) {
    const t = cross(q, s) / denominator, u = cross(q, r) / denominator;
    if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) { a.splits.push(clamp01(t)); b.splits.push(clamp01(u)); }
  } else if (Math.abs(cross(q, r)) < EPS) {
    for (const point of [b.from, b.to]) { const hit = closestOnSegment(point, a.from, a.to); if (hit.distance < EPS) a.splits.push(hit.t); }
    for (const point of [a.from, a.to]) { const hit = closestOnSegment(point, b.from, b.to); if (hit.distance < EPS) b.splits.push(hit.t); }
  }
}

/** Build the boundary of an explicit occupancy predicate. Intersections are split
 * before classification, so overlapping channels produce one water sheet. */
export function polygonBooleanRegions(rings, contains) {
  const segments = rings.flatMap(ring => ring.map((from, i) => {
    const to = ring[(i + 1) % ring.length]; return { from, to, splits: [0, 1], bounds: ringBounds([from, to]) };
  })).filter(segment => Math.hypot(...subtract(segment.to, segment.from)) > EPS);
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) splitIntersections(segments[i], segments[j]);
  const edges = new Map(), vertices = new Map();
  const canonical = p => { const key = pointKey(p); if (!vertices.has(key)) vertices.set(key, p); return vertices.get(key); };
  for (const segment of segments) {
    const sorted = segment.splits.sort((a, b) => a - b), splits = sorted.filter((t, i) => !i || t - sorted[i - 1] > 1e-10);
    const delta = subtract(segment.to, segment.from);
    for (let i = 0; i < splits.length - 1; i++) {
      let a = canonical([segment.from[0] + delta[0] * splits[i], segment.from[1] + delta[1] * splits[i]]);
      let b = canonical([segment.from[0] + delta[0] * splits[i + 1], segment.from[1] + delta[1] * splits[i + 1]]);
      const length = Math.hypot(...subtract(b, a)); if (length < EPS) continue;
      const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], epsilon = Math.min(.0001, length * .01);
      const nx = -(b[1] - a[1]) / length * epsilon, nz = (b[0] - a[0]) / length * epsilon;
      const left = contains([middle[0] + nx, middle[1] + nz]), right = contains([middle[0] - nx, middle[1] - nz]);
      if (left === right) continue;
      if (!left) [a, b] = [b, a];
      edges.set(`${pointKey(a)}>${pointKey(b)}`, { a, b, used: false });
    }
  }
  const outgoing = new Map();
  for (const edge of edges.values()) { const key = pointKey(edge.a); if (!outgoing.has(key)) outgoing.set(key, []); outgoing.get(key).push(edge); }
  const loops = [];
  for (const first of edges.values()) {
    if (first.used) continue;
    const loop = []; let edge = first;
    while (edge && !edge.used) {
      edge.used = true; loop.push(edge.a);
      if (pointKey(edge.b) === pointKey(first.a)) break;
      const candidates = (outgoing.get(pointKey(edge.b)) ?? []).filter(candidate => !candidate.used);
      const angle = Math.atan2(edge.b[1] - edge.a[1], edge.b[0] - edge.a[0]);
      candidates.sort((a, b) => {
        const turn = candidate => (Math.atan2(candidate.b[1] - candidate.a[1], candidate.b[0] - candidate.a[0]) - angle + TAU) % TAU;
        return turn(a) - turn(b);
      });
      edge = candidates[0];
    }
    if (!edge || pointKey(edge.b) !== pointKey(first.a)) throw new Error('Terrain polygon arrangement has an open boundary');
    if (loop.length >= 3 && Math.abs(polygonArea(loop)) > 1e-6) loops.push(loop);
  }
  const regions = loops.filter(loop => polygonArea(loop) > 0).map(outer => ({ outer, holes: [] }));
  for (const hole of loops.filter(loop => polygonArea(loop) < 0)) {
    const enclosing = regions.filter(region => pointInPolygon(hole[0], region.outer)).sort((a, b) => polygonArea(a.outer) - polygonArea(b.outer))[0];
    if (!enclosing) throw new Error('Terrain hole has no enclosing outer boundary');
    enclosing.holes.push(hole);
  }
  return { regions, loops, area: loops.reduce((sum, loop) => sum + polygonArea(loop), 0) };
}

function refineTriangles(vertices, triangles, edgeLimit) {
  let current = triangles;
  const limits = [], acceptedEdges = new Map(), progress = [];
  const checkedLimit = point => {
    const limit = typeof edgeLimit === 'function' ? edgeLimit(point) : edgeLimit;
    if (!(limit > 0) || !Number.isFinite(limit)) throw new Error('Terrain edge length must be positive and finite');
    return limit;
  };
  const vertexLimit = index => limits[index] ?? (limits[index] = checkedLimit(vertices[index]));
  // With unequal requested sizes, new diagonals near a size boundary can need
  // further splits after the original long edge has already reached its limit.
  // Keep the conforming pass active until there are no remaining split edges.
  for (let pass = 0; pass < 32; pass++) {
    const mids = new Map(); let longestSplit = 0; const examples = [];
    const edgeKey = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
    for (const triangle of current) {
      // Grade the opposite edge too: otherwise a coarse edge can continually
      // generate fine, ever thinner triangles that approach it but never fit.
      const triangleLimit = Math.min(...triangle.map(vertexLimit));
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3], key = edgeKey(a, b); if (mids.has(key) || (acceptedEdges.get(key) ?? Infinity) <= triangleLimit) continue;
        const p = vertices[a], q = vertices[b], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const midLimit = checkedLimit(mid), limit = Math.min(triangleLimit, midLimit);
        const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (length > limit * 1.001) { mids.set(key, vertices.length); limits[vertices.length] = midLimit; vertices.push(mid); longestSplit = Math.max(longestSplit, length); if (examples.length < 2) examples.push({ p, q, length, limit }); }
        else acceptedEdges.set(key, limit);
      }
    }
    progress.push({ pass, splitEdges: mids.size, longestSplit, examples });
    if (!mids.size) return { faces: current, passes: pass };
    const next = [];
    for (const original of current) {
      let [a, b, c] = original, ab = mids.get(edgeKey(a, b)), bc = mids.get(edgeKey(b, c)), ca = mids.get(edgeKey(c, a));
      const count = Number(ab !== undefined) + Number(bc !== undefined) + Number(ca !== undefined);
      if (!count) next.push(original);
      else if (count === 3) next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      else {
        // Rotate until the unique split (or the pair of splits) starts at AB.
        while (ab === undefined || (count === 2 && bc === undefined)) { [a, b, c] = [b, c, a]; [ab, bc, ca] = [bc, ca, ab]; }
        if (count === 1) next.push([a, ab, c], [ab, b, c]);
        else {
          next.push([b, bc, ab]);
          // Use the shorter diagonal of the uncut quad for better shaped faces.
          const first = Math.hypot(...subtract(vertices[ab], vertices[c])), second = Math.hypot(...subtract(vertices[a], vertices[bc]));
          if (first <= second) next.push([a, ab, c], [ab, bc, c]);
          else next.push([a, ab, bc], [a, bc, c]);
        }
      }
    }
    current = next;
  }
  throw new Error(`Terrain refinement did not converge after 32 passes (${current.length} triangles): ${JSON.stringify(progress.slice(-2))}`);
}

export function triangulateSurface(regions, { heightAt = () => 0, colorAt, edgeLength = 12, uvScale = .08, name = 'terrain-surface' } = {}) {
  const vertices = [], triangles = [];
  for (const region of regions) {
    const offset = vertices.length, points = [...region.outer, ...region.holes.flat()]; vertices.push(...points);
    const faces = THREE.ShapeUtils.triangulateShape(region.outer.map(p => new THREE.Vector2(...p)), region.holes.map(hole => hole.map(p => new THREE.Vector2(...p))));
    triangles.push(...faces.map(face => face.map(index => index + offset)));
  }
  const refined = edgeLength === Infinity ? { faces: triangles, passes: 0 } : refineTriangles(vertices, triangles, edgeLength), faces = refined.faces;
  const expectedArea = regions.reduce((sum, region) => sum + Math.abs(polygonArea(region.outer)) - region.holes.reduce((holes, hole) => holes + Math.abs(polygonArea(hole)), 0), 0);
  const meshArea = faces.reduce((sum, [a, b, c]) => sum + Math.abs(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]))) / 2, 0);
  if (Math.abs(meshArea - expectedArea) > Math.max(1e-5, expectedArea * 1e-7)) throw new Error(`${name} triangulation does not cover its polygon: ${meshArea} / ${expectedArea}`);
  const position = new Float32Array(vertices.length * 3), uv = new Float32Array(vertices.length * 2), colors = colorAt ? new Float32Array(vertices.length * 3) : null;
  vertices.forEach(([x, z], i) => {
    const y = heightAt(x, z); position.set([x, y, z], i * 3); uv.set([x * uvScale, z * uvScale], i * 2);
    if (colors) { const color = colorAt(x, y, z); colors.set(color.isColor ? color.toArray() : color, i * 3); }
  });
  const indices = faces.flatMap(([a, b, c]) => cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a])) > 0 ? [a, c, b] : [a, b, c]);
  const geometry = new THREE.BufferGeometry(); geometry.name = name;
  geometry.userData = { expectedArea, meshArea, footprintAreaError: Math.abs(meshArea - expectedArea), refinementPasses: refined.passes };
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Query exactly the stored Float32 triangles, not a second analytic heightfield. */
export function createTriangleSampler(geometries, cellSize = 32) {
  const triangles = [];
  for (const geometry of geometries) {
    const p = geometry.getAttribute('position'), indices = geometry.index, count = indices?.count ?? p.count;
    for (let n = 0; n < count; n += 3) {
      const ids = [0, 1, 2].map(i => indices ? indices.getX(n + i) : n + i);
      const [a, b, c] = ids.map(id => [p.getX(id), p.getY(id), p.getZ(id)]);
      const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      // Down-facing intrados and vertical sides are not a floor for walking.
      if (normalY <= 1e-9) continue;
      const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(denominator) < 1e-9) continue;
      triangles.push({ a, b, c, denominator, geometry, triangleIndex: n / 3, bounds: ringBounds([a, b, c].map(([x, , z]) => [x, z])) });
    }
  }
  const index = createSpatialIndex(triangles, triangle => triangle.bounds, cellSize);
  function sampleIndex(spatialIndex,x, z, maxY = Infinity) {
    let best = null;
    for (const triangle of spatialIndex.at(x, z)) {
      const { a, b, c, denominator } = triangle;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator, w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const height = u * a[1] + v * b[1] + w * c[1]; if (height > maxY + 1e-6 || (best && height <= best.height)) continue;
      const normal = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a))).normalize(); if (normal.y < 0) normal.negate();
      best = { height, normal: normal.toArray(), geometry: triangle.geometry, triangleIndex: triangle.triangleIndex };
    }
    return best;
  }
  const locals=new Set();let disposed=false;
  return {sample:(...args)=>sampleIndex(index,...args),triangleCount:triangles.length,
    local(bounds,localCellSize=1){
      if(disposed||![bounds?.minX,bounds?.maxX,bounds?.minZ,bounds?.maxZ,localCellSize].every(Number.isFinite)||bounds.maxX<bounds.minX||bounds.maxZ<bounds.minZ||localCellSize<=0)throw new Error('Invalid local triangle query bounds.');
      const selected=triangles.filter(({bounds:b})=>b.maxX>=bounds.minX&&b.minX<=bounds.maxX&&b.maxZ>=bounds.minZ&&b.minZ<=bounds.maxZ);
      const localIndex=createSpatialIndex(selected,({bounds:b})=>({minX:Math.max(b.minX,bounds.minX),maxX:Math.min(b.maxX,bounds.maxX),minZ:Math.max(b.minZ,bounds.minZ),maxZ:Math.min(b.maxZ,bounds.maxZ)}),localCellSize);let released=false;
      const owner={triangleCount:selected.length,sample:(...args)=>sampleIndex(localIndex,...args),dispose(){if(released)return;released=true;localIndex.clear();locals.delete(owner);}};
      locals.add(owner);return owner;
    },
    dispose(){if(disposed)return;disposed=true;for(const local of locals)local.dispose();index.clear();triangles.length=0;},
  };
}

export function createArchBridgeGeometry(bridge, groundHeightAt, waterY = 2) {
  const [fx, , fz] = bridge.from, [tx, , tz] = bridge.to, length = Math.hypot(tx - fx, tz - fz), direction = [(tx - fx) / length, (tz - fz) / length], across = [-direction[1], direction[0]];
  const width = bridge.width, approach = Math.min(6, length * .2), steps = Math.max(12, Math.ceil(length / 2)), crown = Math.min(1.45, length * .022);
  const stations = [-approach, ...Array.from({ length: steps + 1 }, (_, i) => i / steps * length), length + approach];
  const positions = [], indices = [], profile = [];
  for (const distance of stations) {
    const t = clamp01(distance / length), x = fx + direction[0] * distance, z = fz + direction[1] * distance;
    const end = distance < 0 || distance > length;
    const topY = bridge.deckY + crown * Math.sin(t * Math.PI), springY = waterY + .16;
    const lowerY = springY + (bridge.deckY + crown - .58 - springY) * Math.sin(t * Math.PI);
    const top = [-1, 1].map(side => {
      const px = x + across[0] * width / 2 * side, pz = z + across[1] * width / 2 * side;
      return [px, end ? (groundHeightAt(px, pz) ?? bridge.from[1] - .5) : topY, pz];
    });
    const bottom = top.map(point => [point[0], end ? point[1] - .24 : Math.min(point[1] - .45, lowerY), point[2]]);
    positions.push(...top[0], ...top[1], ...bottom[0], ...bottom[1]); profile.push({ distance, topY: (top[0][1] + top[1][1]) / 2, lowerY: (bottom[0][1] + bottom[1][1]) / 2 });
  }
  for (let n = 0; n < stations.length - 1; n++) {
    const a = n * 4, b = a + 4;
    indices.push(a, a + 1, b, a + 1, b + 1, b, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3, a, b, a + 2, a + 2, b, b + 2, a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
  }
  const last = (stations.length - 1) * 4; indices.push(0, 2, 1, 1, 2, 3, last, last + 1, last + 2, last + 1, last + 3, last + 2);
  const geometry = new THREE.BufferGeometry(); geometry.name = `${bridge.id}-open-arch`;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, profile, length, approach, direction, across, crown, footprint: [[fx - direction[0] * approach - across[0] * width / 2, fz - direction[1] * approach - across[1] * width / 2], [tx + direction[0] * approach - across[0] * width / 2, tz + direction[1] * approach - across[1] * width / 2], [tx + direction[0] * approach + across[0] * width / 2, tz + direction[1] * approach + across[1] * width / 2], [fx - direction[0] * approach + across[0] * width / 2, fz - direction[1] * approach + across[1] * width / 2]] };
}
