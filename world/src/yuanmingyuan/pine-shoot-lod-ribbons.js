import * as THREE from 'three';
import { partitionPineShoot } from './pine-shoot-lod-baker.js';
import { pineShootGeometryFingerprint } from './pine-shoot-lod.js';
import { pineShootMaterialSet, attachPineShootMaterials } from './pine-shoot-lod-materials.js';

/** Keep actual needle roots, tips and optional midpoint rows. There is no
 * projected atlas: source colour/normal/width/depth remain on each real needle.
 * A source needle is a ruled strip with linear taper. Between retained rows,
 * its source edge samples bound the piecewise-linear centreline displacement.
 * This is a geometric comparison, not a silhouette or shading certificate. */
export function createPineShootRibbonGeometry(source, { segments = 2, signal } = {}) {
  if (![1, 2].includes(segments)) throw new Error('Pine ribbon segments must be 1 or 2');
  signal?.throwIfAborted(); const began = performance.now(), partition = partitionPineShoot(source), rows = segments === 2 ? [0, 2, 4] : [0, 4];
  const indices = [], selected = new Set(), components = [], errors = [], correspondence = [], position = source.attributes.position, uv = source.attributes.uv;
  if (!uv) throw new Error('Pine ribbon source needs its original needle row coordinates');
  const blocks = [...partition.wood.map(part => ({ part, kind: 'wood' })), ...partition.needles.map(part => ({ part, kind: 'needle' }))].sort((a, b) => a.part.triangles[0] - b.part.triangles[0]);
  for (let bi = 0; bi < blocks.length; bi++) {
    if (bi % 32 === 0) signal?.throwIfAborted();
    const { part, kind } = blocks[bi], start = indices.length;
    if (kind === 'wood') {
      for (const t of part.triangles) for (let k = 0; k < 3; k++) indices.push(source.index.getX(t * 3 + k));
    } else {
      // Do not infer row order solely from component size. These UVs and source
      // triangle windings are the actual frozen needle generator's contract.
      for (let row = 0; row <= 4; row++) for (let side = 0; side < 2; side++) {
        const id = part.vertices[row * 2 + side];
        if (uv.getX(id) !== side || uv.getY(id) !== row / 4) throw new Error('Pine source row topology changed');
      }
      for (let row = 0; row < 4; row++) {
        const a = row * 2, expected = [a, a + 1, a + 2, a + 1, a + 3, a + 2].map(k => part.vertices[k]);
        const actual = part.triangles.slice(row * 2, row * 2 + 2).flatMap(t => [0, 1, 2].map(k => source.index.getX(t * 3 + k)));
        if (actual.some((v, k) => v !== expected[k])) throw new Error('Pine source needle winding changed');
      }
      for (let segment = 0; segment < rows.length - 1; segment++) {
        const a = rows[segment] * 2, b = rows[segment + 1] * 2;
        indices.push(...[a, a + 1, b, a + 1, b + 1, b].map(k => part.vertices[k]));
      }
      for (let row = 0; row <= 4; row++) for (let side = 0; side < 2; side++) {
        const lo = rows.findLast(r => r <= row), hi = rows.find(r => r >= row), t = lo === hi ? 0 : (row - lo) / (hi - lo), id = part.vertices[row * 2 + side];
        const a = new THREE.Vector3().fromBufferAttribute(position, part.vertices[lo * 2 + side]), b = new THREE.Vector3().fromBufferAttribute(position, part.vertices[hi * 2 + side]), actual = new THREE.Vector3().fromBufferAttribute(position, id), point = a.lerp(b, t), error = point.distanceTo(actual);
        errors.push(error); correspondence.push({ sourceVertex: id, point: point.toArray(), error });
      }
    }
    indices.slice(start).forEach(id => selected.add(id)); components.push({ kind, sourceTriangle: part.triangles[0], sourceVertices: part.vertices, firstIndex: start, indexCount: indices.length - start });
  }
  signal?.throwIfAborted(); const sourceVertices = [...selected].sort((a, b) => a - b), remap = new Map(sourceVertices.map((id, i) => [id, i])), geometry = new THREE.BufferGeometry();
  try {
    for (const [name, attr] of Object.entries(source.attributes)) {
      if (attr.isInterleavedBufferAttribute || attr.isInstancedBufferAttribute) throw new Error('Unsupported pine source attribute');
      const array = new attr.array.constructor(sourceVertices.length * attr.itemSize);
      sourceVertices.forEach((id, i) => { for (let k = 0; k < attr.itemSize; k++) array[i * attr.itemSize + k] = attr.array[id * attr.itemSize + k]; });
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attr.itemSize, attr.normalized));
    }
    geometry.setIndex(indices.map(id => remap.get(id))); geometry.name = 'pine-shoot-source-' + segments + '-segment-needle-ribbons'; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData = { body: 'source-anchored-curved-pine-needle-ribbons', segments, needles: 460, woodyShoots: 6, retainedRows: rows };
    errors.sort((a, b) => a - b);
    const diagnostics = { representation: 'source-needle-ribbons', method: 'actual source root/midpoint/tip rows; original per-vertex colour and normals; no atlas projection', sourceTriangles: source.index.count / 3, sourceNeedles: partition.needles.length, representedNeedles: partition.needles.length, originalWoodTriangles: 480, needleTriangles: partition.needles.length * segments * 2, totalTriangles: geometry.index.count / 3, segments, retainedRows: rows, sourceVertices: position.count, retainedVertices: sourceVertices.length, geometryBytes: Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) + geometry.index.array.byteLength, textureBytes: 0, atlas: null, sourceDraws: 1, candidateDraws: 1, elapsedMilliseconds: performance.now() - began, displacement: { method: 'matched source ruled-strip edge rows; geometric only, not a screen or appearance certificate', samples: errors.length, maximum: errors.at(-1), p95: errors[Math.floor(errors.length * .95)], mean: errors.reduce((a, b) => a + b, 0) / errors.length }, nativeReviewed: false, mainSceneAllowed: false };
    let disposed = false;
    return { geometry, partition, components, sourceVertices, correspondence, diagnostics, dispose() { if (disposed) return; disposed = true; geometry.dispose(); } };
  } catch (error) { geometry.dispose(); throw error; }
}

export async function createPineShootRibbonPilot(source, options = {}) {
  if (!source?.geometry || source.diagnostics?.triangles !== 4160) throw new Error('Expected one retained 4,160-triangle pine shoot source');
  options.signal?.throwIfAborted(); const before = await pineShootGeometryFingerprint(source.geometry); options.signal?.throwIfAborted();
  const baked = createPineShootRibbonGeometry(source.geometry, options), group = new THREE.Group(), transition = { phase: { value: 0 }, role: { value: 0 } };
  let materials;
  try {
    materials = pineShootMaterialSet({ transition, name: 'pine-shoot-source-needle-ribbons' });
    const mesh = new THREE.Mesh(baked.geometry); mesh.name = 'pine-shoot-all-original-wood-and-continuous-needles'; attachPineShootMaterials(mesh, materials); group.name = 'pine-shoot-source-ribbon-pilot'; group.add(mesh);
    const after = await pineShootGeometryFingerprint(source.geometry); options.signal?.throwIfAborted(); if (before.sha256 !== after.sha256) throw new Error('The retained pine source changed during ribbon creation');
    let disposed = false, mode = 'source', phase = 0;
    function setMode(value, amount = 0) {
      if (disposed || !['source', 'low', 'blend'].includes(value) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw new Error('Invalid pine shoot display state');
      mode = value; phase = amount; source.group.visible = value === 'source' || value === 'blend' && amount < 1; group.visible = value === 'low' || value === 'blend' && amount > 0;
      source.transition.phase.value = transition.phase.value = amount; source.transition.role.value = value === 'blend' ? -1 : 0; transition.role.value = value === 'blend' ? 1 : 0;
      return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible };
    }
    setMode('source');
    const diagnostics = { ...baked.diagnostics, sourceFingerprint: before, sourceGeometryChanged: false, sourceAndCandidateIndependentOwners: true, passes: { pbr: true, actualGeometryDepth: true, actualGeometryDistance: true, actualGeometryNormal: true, reflectionUsesActualCamera: true }, normalContract: 'ordinary vertex normals, real DoubleSide triangle winding; no object-space normal texture overriding instance transforms', limits: ['This is a middle-distance candidate, not a complete-tree far tier.', 'Position error does not certify subpixel needles, lighting, shadows or transitions.', 'Full-tree visibility, reflection/shadow demand and branch-cluster far representations remain separate work.', 'Lower triangle count is not a measured GPU speedup.'] };
    return { group, mesh, textures: [], materials: materials.materials, baked, source, diagnostics, setMode, get state() { return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible }; }, assertMainSceneAllowed() { throw new Error('Pine shoot ribbon pilot has no native or main-scene admission'); }, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); materials.materials.forEach(m => m.dispose()); baked.dispose(); source.transition.role.value = 0; source.transition.phase.value = 0; source.group.visible = true; } };
  } catch (error) { group.clear(); materials?.materials.forEach(m => m.dispose()); baked.dispose(); throw error; }
}
