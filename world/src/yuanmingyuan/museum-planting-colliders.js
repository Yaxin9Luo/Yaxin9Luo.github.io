import { Vector3 } from 'three';
import { GROUND_MOTION } from '../ground-motion.js';

const bodies = Object.freeze({
  willow: { name: 'willow-trunk-and-roots', kind: 'planting-trunk', bands: 4 },
  juniper: { name: 'juniper-visible-trunk', kind: 'planting-trunk', bands: 4 },
  'lake-rock': { name: 'lake-rock-main', kind: 'planting-stone', bands: 5 },
});
const EPS = 1e-7;
const directions = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, snap = v => Math.abs(v) < 1e-15 ? 0 : v; return [snap(Math.cos(a)), snap(Math.sin(a))]; });
const finite = p => p && [p.x, p.y, p.z].every(Number.isFinite);
const dot = (n, p) => n[0] * p.x + n[1] * p.y + n[2] * p.z;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

// Clip one triangle to a horizontal slab, in reusable fixed-size buffers.
// A triangle can cross a band without having ANY original vertex in that band.
function clipY(input, count, output, y, above) {
  let written = 0;
  for (let i = 0; i < count; i++) {
    const a = i * 3, b = ((i + 1) % count) * 3, da = (input[a + 1] - y) * above, db = (input[b + 1] - y) * above;
    if (da >= 0) { output[written++] = input[a]; output[written++] = input[a + 1]; output[written++] = input[a + 2]; }
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db); output[written++] = input[a] + (input[b] - input[a]) * t; output[written++] = y; output[written++] = input[a + 2] + (input[b + 2] - input[a + 2]) * t;
    }
  }
  return written / 3;
}

function footprint(planes, bounds) {
  let polygon = [[bounds.minX - 1, bounds.minZ - 1], [bounds.maxX + 1, bounds.minZ - 1], [bounds.maxX + 1, bounds.maxZ + 1], [bounds.minX - 1, bounds.maxZ + 1]];
  for (const [nx, , nz, d] of planes.slice(0, 12)) {
    const next = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = nx * a[0] + nz * a[1] - d, db = nx * b[0] + nz * b[1] - d;
      if (da <= 0) next.push(a);
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    polygon = next;
  }
  return polygon;
}

function extractBody(mesh, part, spec, signal) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.morphTargetInfluences) throw new Error('Planting collision needs the original static named body mesh, never foliage instances.');
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index, matrix = mesh.matrixWorld.elements;
  if (!position || matrix.some(value => !Number.isFinite(value)) || matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1 || !Number.isFinite(mesh.matrixWorld.determinant()) || mesh.matrixWorld.determinant() === 0) throw new Error(`Invalid planting body transform: ${mesh.name}`);
  const available = index?.count ?? position.count, start = geometry.drawRange.start, count = Math.min(geometry.drawRange.count, available - start);
  if (!Number.isInteger(start) || start < 0 || start % 3 || !Number.isInteger(count) || count <= 0 || count % 3) throw new Error(`Invalid planting body draw range: ${mesh.name}`);
  const vertices = new Float64Array(position.count * 3), v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (!finite(v)) throw new Error(`Nonfinite original body vertex: ${mesh.name}`);
    vertices.set([v.x, v.y, v.z], i * 3);
  }
  const vertexId = offset => { const i = index ? index.getX(offset) : offset; if (!Number.isInteger(i) || i < 0 || i >= position.count) throw new Error(`Invalid original body index: ${mesh.name}`); return i * 3; };
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (let offset = start; offset < start + count; offset++) {
    const i = vertexId(offset), x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y); bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  if (bounds.maxY - bounds.minY < EPS) throw new Error(`Planting body has no solid height: ${mesh.name}`);
  const cuts = [bounds.minY];
  if (spec.kind === 'planting-trunk') {
    const e = part.matrixWorld.elements, scaleY = Math.hypot(e[4], e[5], e[6]), rootTop = Math.min(bounds.maxY - EPS, Math.max(bounds.minY + EPS, e[13] + .12 * scaleY));
    // Keep the broad, partly buried root flare in a short first band instead
    // of extending its width up the full trunk. Remaining bands follow wood.
    cuts.push(rootTop); for (let i = 1; i < spec.bands; i++) cuts.push(rootTop + (bounds.maxY - rootTop) * i / (spec.bands - 1));
  } else for (let i = 1; i <= spec.bands; i++) cuts.push(bounds.minY + (bounds.maxY - bounds.minY) * i / spec.bands);
  const bands = cuts.slice(0, -1).map((bottom, i) => ({ bottom, top: cuts[i + 1], support: new Float64Array(12).fill(-Infinity), triangles: 0 }));
  const a = new Float64Array(24), b = new Float64Array(24), c = new Float64Array(24);
  for (let offset = start; offset < start + count; offset += 3) {
    if ((offset - start) % 12288 === 0) signal?.throwIfAborted();
    let low = Infinity, high = -Infinity;
    for (let k = 0; k < 3; k++) { const i = vertexId(offset + k); a.set(vertices.subarray(i, i + 3), k * 3); low = Math.min(low, vertices[i + 1]); high = Math.max(high, vertices[i + 1]); }
    for (const band of bands) {
      if (high < band.bottom || low > band.top) continue;
      const n = clipY(a, 3, b, band.bottom, 1), m = n ? clipY(b, n, c, band.top, -1) : 0; if (!m) continue;
      band.triangles++;
      for (let i = 0; i < m; i++) for (let j = 0; j < 12; j++) band.support[j] = Math.max(band.support[j], directions[j][0] * c[i * 3] + directions[j][1] * c[i * 3 + 2]);
    }
  }
  const padding = 128 * Number.EPSILON * Math.max(1, ...Object.values(bounds).map(Math.abs));
  const solids = bands.filter(band => band.triangles).map((band, i) => {
    const bottom = band.bottom - padding, top = band.top + padding, planes = directions.map(([nx, nz], j) => [nx, 0, nz, band.support[j] + padding]).concat([[0, 1, 0, top], [0, -1, 0, -bottom]]);
    const bounds = { minX: -planes[6][3], maxX: planes[0][3], minZ: -planes[9][3], maxZ: planes[3][3], minY: bottom, maxY: top };
    return { id: `${part.userData.placementId}/planting-body-${i + 1}`, placementId: part.userData.placementId, kind: spec.kind, bottom, top, walkable: false, planes, bounds, footprint: footprint(planes, bounds), sourceMesh: mesh.name, sourceTrianglesContributing: band.triangles };
  });
  return { solids, source: { placementId: part.userData.placementId, species: part.userData.species, mesh: mesh.name, geometry: geometry.name, positionCount: position.count, drawnTriangles: count / 3, worldMatrix: [...matrix], actualDrawnBounds: bounds, cuts, planeDirections: 12, bands: solids.length, numericalPadding: padding, transientWorldVertexBytes: vertices.byteLength } };
}

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function pointSegment(p, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); }
function inside(point, polygon) { let yes = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if (pointSegment(point, a, b) <= EPS) return true; if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; } return yes; }
function polygonGap(a, b) {
  if (inside(a[0], b) || inside(b[0], a)) return 0;
  let gap = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    if (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0) return 0;
    gap = Math.min(gap, pointSegment(p, r, s), pointSegment(q, r, s), pointSegment(r, p, q), pointSegment(s, p, q));
  }
  return gap;
}

function expandedDistance(plane, centre, radius, halfHeight, skin) { return dot(plane, centre) - plane[3] - radius * Math.hypot(plane[0], plane[2]) - halfHeight * Math.abs(plane[1]) - skin; }
function sweepSolid(solid, from, delta, radius, halfHeight, skin) {
  let enter = 0, exit = 1, normals = [], mostOutside = -Infinity, nearest;
  const values = solid.planes.map(plane => { const d = expandedDistance(plane, from, radius, halfHeight, skin); if (d > mostOutside) { mostOutside = d; nearest = plane; } return d; });
  if (mostOutside < -skin - EPS) return { fraction: 0, normals: [nearest.slice(0, 3)], initialOverlap: true, id: solid.id };
  if (mostOutside <= EPS) return dot(nearest, delta) < -EPS ? { fraction: 0, normals: [nearest.slice(0, 3)], initialOverlap: false, id: solid.id } : null;
  for (let i = 0; i < solid.planes.length; i++) {
    const plane = solid.planes[i], d = values[i], velocity = dot(plane, delta);
    if (Math.abs(velocity) < 1e-14) { if (d >= -EPS) return null; continue; }
    const t = -d / velocity;
    if (velocity < 0) { if (t > enter + EPS) { enter = t; normals = [plane.slice(0, 3)]; } else if (Math.abs(t - enter) <= EPS) normals.push(plane.slice(0, 3)); }
    else exit = Math.min(exit, t);
    if (enter > exit + EPS) return null;
  }
  return normals.length && enter >= -EPS && enter <= 1 + EPS && exit >= 0 ? { fraction: Math.max(0, Math.min(1, enter)), normals, initialOverlap: false, id: solid.id } : null;
}

/** Extract only original named wood/stone triangles from an existing pilot.
 * No factory, render, BVH, geometry copy/dispose or instanced foliage access.
 * Build after final placement; rebuild if source placement or geometry changes.
 * terrain.paths and optional simple XZ reserves are checked for pedestrian
 * clearance. These solids block rock climbing: no synthetic support surface. */
export function createMuseumPlantingColliders(pilot, { terrain, reservedPolygons = [], signal } = {}) {
  if (!pilot?.group?.isObject3D || !Array.isArray(pilot.parts) || !pilot.parts.length || !Array.isArray(terrain?.paths)) throw new Error('Planting collision requires an existing pilot and current terrain.paths.');
  const reserves = [...terrain.paths, ...reservedPolygons];
  for (const r of reserves) if (!Array.isArray(r.polygon) || r.polygon.length < 3 || !r.polygon.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) || !Number.isFinite(r.clearance ?? 0) || (r.clearance ?? 0) < 0) throw new Error(`Invalid planting collision reserve: ${r.id}`);
  signal?.throwIfAborted(); pilot.group.updateWorldMatrix(true, true);
  const solids = [], sources = [], clearances = [], ids = new Set();
  for (const part of pilot.parts) {
    signal?.throwIfAborted(); const { species, placementId } = part.userData, spec = bodies[species];
    if (!spec || typeof placementId !== 'string' || ids.has(placementId)) throw new Error('Only unique registered willow/juniper/lake-rock placements are supported.');
    ids.add(placementId); const mesh = part.getObjectByName(spec.name); if (!mesh) throw new Error(`Missing original planting body: ${placementId}/${spec.name}`);
    const extracted = extractBody(mesh, part, spec, signal); solids.push(...extracted.solids); sources.push(extracted.source);
    for (const reserve of reserves) {
      const gap = Math.min(...extracted.solids.map(solid => polygonGap(solid.footprint, reserve.polygon))), required = GROUND_MOTION.radius + GROUND_MOTION.skin + (reserve.clearance ?? 0);
      clearances.push({ placementId, reserveId: reserve.id ?? 'unnamed', gap, required, clear: gap > required + EPS });
    }
  }
  const conflicts = clearances.filter(record => !record.clear);
  if (conflicts.length) { const error = new Error('Planting collision body reaches a reserved walking route.'); error.conflicts = conflicts; throw error; }
  let disposed = false;
  const diagnostics = { representation: 'actual-body-triangles-clipped-to-vertical-convex-bands', sourceMeshCount: sources.length, solidCount: solids.length, planeCount: solids.reduce((sum, solid) => sum + solid.planes.length, 0), sources, clearances, pathCount: terrain.paths.length, sourceGeometryChanged: false, leavesRead: false, bvhConstructed: false, rockSupport: 'blocked-no-climbing-or-landing-surface', nativeInteractionReviewed: false, flightQueries: 0, flightBlocked: 0, initialOverlaps: 0, limitations: ['Convex bands fill wood/stone concavities and stone windows. Buried root flare is conservatively retained in a short base band.', 'Fine branches and foliage remain non-solid. This interface does not change ground support, terrain clearance, other architecture or NPC integration.', 'Initially overlapping flight bodies are reported in place; callers must choose a collision-free initial spawn/activation position.'] };
  function constrainFlight(from, proposed, { radius, height, centerOffsetY = 0, skin = GROUND_MOTION.skin } = {}) {
    if (disposed) throw new Error('Planting collision owner was disposed.');
    if (!finite(from) || !finite(proposed) || ![radius, height, centerOffsetY, skin].every(Number.isFinite) || radius <= 0 || height <= 0 || skin < 0) throw new Error('Flight collision needs finite endpoints and the current body radius/height.');
    diagnostics.flightQueries++;
    let position = { ...from }, remaining = { x: proposed.x - from.x, y: proposed.y - from.y, z: proposed.z - from.z };
    const contacts = [], segments = [], contactNormals = []; let blocked = false, initialOverlap = false, iterations = 0;
    for (; iterations < 4; iterations++) {
      // A stationary query still has to report an invalid activation/spawn.
      // Later zero remainders were already swept to a safe contact position.
      const length = Math.hypot(remaining.x, remaining.y, remaining.z); if (length < 1e-10 && iterations > 0) break;
      const centre = { x: position.x, y: position.y + centerOffsetY, z: position.z };
      let first = null;
      for (const solid of solids) {
        const b = solid.bounds, end = { x: centre.x + remaining.x, y: centre.y + remaining.y, z: centre.z + remaining.z };
        if (Math.max(centre.x, end.x) + radius + skin < b.minX || Math.min(centre.x, end.x) - radius - skin > b.maxX || Math.max(centre.z, end.z) + radius + skin < b.minZ || Math.min(centre.z, end.z) - radius - skin > b.maxZ || Math.max(centre.y, end.y) + height / 2 + skin < b.minY || Math.min(centre.y, end.y) - height / 2 - skin > b.maxY) continue;
        const hit = sweepSolid(solid, centre, remaining, radius, height / 2, skin);
        if (hit && (!first || hit.fraction < first.fraction - EPS)) first = hit;
        else if (hit && first && Math.abs(hit.fraction - first.fraction) <= EPS) { first.normals.push(...hit.normals); first.initialOverlap ||= hit.initialOverlap; }
      }
      if (!first) { const next = { x: position.x + remaining.x, y: position.y + remaining.y, z: position.z + remaining.z }; if (length > 1e-10) segments.push({ from: position, to: next }); position = next; remaining = { x: 0, y: 0, z: 0 }; break; }
      blocked = true; contacts.push({ id: first.id, fraction: first.fraction, normals: first.normals });
      if (first.initialOverlap) { initialOverlap = true; break; }
      const t = Math.max(0, first.fraction - 1e-6 / length), next = lerp(position, { x: position.x + remaining.x, y: position.y + remaining.y, z: position.z + remaining.z }, t);
      segments.push({ from: position, to: next }); position = next;
      remaining = { x: remaining.x * (1 - t), y: remaining.y * (1 - t), z: remaining.z * (1 - t) };
      contactNormals.push(...first.normals);
      // Project only inward displacement. Outward and tangent movement retain
      // their speed; a contact never resets to a remotely cached safe position.
      for (let pass = 0; pass < 3; pass++) for (const normal of contactNormals) { const inward = dot(normal, remaining); if (inward < 0) { remaining.x -= inward * normal[0]; remaining.y -= inward * normal[1]; remaining.z -= inward * normal[2]; } }
    }
    if (blocked) diagnostics.flightBlocked++; if (initialOverlap) diagnostics.initialOverlaps++;
    return { position, blocked, initialOverlap, reason: initialOverlap ? 'initial-overlap' : blocked ? 'planting-body' : null, contacts, segments, iterations, limited: iterations === 4 && Math.hypot(remaining.x, remaining.y, remaining.z) > 1e-8, body: { radius, height, centerOffsetY, skin } };
  }
  return { solids, diagnostics, dynamicColliders: () => disposed ? [] : solids, constrainFlight, dispose() { if (disposed) return; disposed = true; solids.length = 0; } };
}
