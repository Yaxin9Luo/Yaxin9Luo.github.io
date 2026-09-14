import { BatchedMesh, Box3, Color, Group, LessEqualDepth, Material, Matrix4, NoBlending, NormalBlending, Object3D, ObjectSpaceNormalMap, Vector3 } from 'three';
import { placeMuseumStaticAsset } from './museum-static-batch.js';

const allowedIds = new Set(['haiyue', 'zhengjuesi']);
const callbacks = ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow'];
const attributeTypes = new Set(['Float32Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array']);
const stockMaterials = new Set(['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshToonMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshNormalMaterial', 'MeshDepthMaterial', 'MeshDistanceMaterial', 'MeshMatcapMaterial', 'ShadowMaterial']);
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
const errorData = error => ({ name: error?.name ?? 'Error', message: error?.message ?? String(error) });
const cleanup = actions => { const errors = []; for (const action of actions) { try { action(); } catch (error) { errors.push(error); } } return errors; };
const checkpoint = signal => { if (signal?.aborted) throw signal.reason ?? new DOMException('Multi-draw conversion aborted', 'AbortError'); };

function affine(matrix) {
  const m = matrix.clone(), e = m.elements, w = e[15];
  if (!e.every(Number.isFinite) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || w === 0) throw new Error('A finite affine transform is required.');
  for (let i = 0; i < 16; i++) e[i] /= w;
  if (!e.every(Number.isFinite) || !(m.determinant() > 0)) throw new Error('Negative or singular transforms require the original owner.');
  return m;
}

function checkInstanceMatrix(matrix) {
  const m = affine(matrix), e = m.elements, columns = [0, 4, 8].map(i => new Vector3(e[i], e[i + 1], e[i + 2]));
  // r185's batching normal shader has no inverse-transpose instance matrix.
  // This tolerance admits Float32 rotation roundoff, not authored shear.
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(columns[i].dot(columns[j])) > columns[i].length() * columns[j].length() * 1e-6) throw new Error('Sheared instance normals require the original owner.');
  return m;
}

function checkMaterial(material) {
  if (!material?.isMaterial || !stockMaterials.has(material.type) || material.isShaderMaterial || material.onBeforeCompile !== Material.prototype.onBeforeCompile || material.customProgramCacheKey !== Material.prototype.customProgramCacheKey || material.onBeforeRender !== Material.prototype.onBeforeRender) throw new Error('Custom material shaders or callbacks require the original owner.');
  if (material.transparent || material.transmission > 0) throw new Error('Transparent/transmissive sorting requires the original owner.');
  if (!material.depthTest || !material.depthWrite || material.depthFunc !== LessEqualDepth || ![NormalBlending, NoBlending].includes(material.blending)) throw new Error('Order-dependent depth or blending requires the original owner.');
  if (material.displacementMap && material.displacementScale !== 0 || material.normalMap && material.normalMapType === ObjectSpaceNormalMap) throw new Error('Displacement or object-space normal maps require the original owner.');
  if (material.wireframe) throw new Error('Wireframe index generation requires the original owner.');
}

function geometryLayout(geometry) {
  if (!geometry?.isBufferGeometry || geometry.isInstancedBufferGeometry || Object.keys(geometry.morphAttributes).length) throw new Error('Animated or custom instanced geometry requires the original owner.');
  const position = geometry.getAttribute('position'), index = geometry.getIndex();
  if (!position || position.itemSize !== 3 || !(position.array instanceof Float32Array) || position.normalized || position.count < 3) throw new Error('A nonempty Float32 position attribute is required.');
  const count = index?.count ?? position.count;
  if (count % 3 || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) throw new Error('Partial drawRange or non-triangle geometry requires the original owner.');
  const attributes = Object.keys(geometry.attributes).sort().map(name => {
    const a = geometry.getAttribute(name);
    if (!a.isBufferAttribute || a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute || a.isFloat16BufferAttribute || !attributeTypes.has(a.array?.constructor.name) || !Number.isInteger(a.itemSize) || a.itemSize < 1 || a.itemSize > 4 || a.count !== position.count) throw new Error(`Unsupported attribute layout: ${name}.`);
    if (a.array instanceof Float32Array && !a.array.every(Number.isFinite)) throw new Error(`Non-finite attribute: ${name}.`);
    return [name, a.itemSize, a.normalized, a.array.constructor.name, a.gpuType, a.usage];
  });
  if (index) {
    if (!index.isBufferAttribute || index.isInterleavedBufferAttribute || index.itemSize !== 1 || index.normalized || !(index.array instanceof Uint16Array || index.array instanceof Uint32Array)) throw new Error('Unsupported index layout.');
    const restart = index.array instanceof Uint16Array ? 65535 : 4294967295;
    if (!index.array.every(i => i < position.count && i !== restart)) throw new Error('Out-of-range or primitive-restart indices require the original owner.');
  }
  // WebGLRenderer ignores geometry.groups for one material. Material arrays
  // are refused before this function: addGeometry itself does not honor groups.
  return { key: JSON.stringify([attributes, index ? [index.array.constructor.name, index.gpuType, index.usage] : null]), box: new Box3().setFromBufferAttribute(position), vertices: position.count, indices: index?.count ?? 0, triangles: count / 3 };
}

function flags(node, root) {
  let visible = node.visible, groupOrder = root.renderOrder, found = false;
  for (let p = node.parent; p && p !== root; p = p.parent) {
    visible &&= p.visible;
    if (p.isGroup && !found) { groupOrder = p.renderOrder; found = true; }
  }
  return { visible, castShadow: node.castShadow, receiveShadow: node.receiveShadow, frustumCulled: node.frustumCulled, layers: node.layers.mask, renderOrder: node.renderOrder, groupOrder };
}

function matrixError(originalWorld, encodedWorld, box) {
  let result = 0; const a = originalWorld.elements, b = encodedWorld.elements;
  // The norm of this linear difference is convex, so all box vertices bound
  // every original vertex, including vertices outside the index draw range.
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const dx = (a[0] - b[0]) * x + (a[4] - b[4]) * y + (a[8] - b[8]) * z + a[12] - b[12];
    const dy = (a[1] - b[1]) * x + (a[5] - b[5]) * y + (a[9] - b[9]) * z + a[13] - b[13];
    const dz = (a[2] - b[2]) * x + (a[6] - b[6]) * y + (a[10] - b[10]) * z + a[14] - b[14];
    result = Math.max(result, Math.hypot(dx, dy, dz));
  }
  return result;
}

/** Acquires the source owner. Place it before conversion and mount only the
 * returned group. Full original geometry remains the collision/named-group
 * owner; standard PBR materials/textures are borrowed without modification.
 * Unsupported input or absent WEBGL_multi_draw returns that exact source.
 * Aborts reject after releasing both source and newly packed resources.
 * This is an opt-in native-review candidate, not automatic scene admission. */
export async function createMuseumMultiDrawBatch(source, { id, renderer, signal, placement, sourceProvenance = null, maximumErrorWorld = 1e-5, onProgress, yieldControl = yieldTask } = {}) {
  if (!source?.group?.isObject3D || typeof source.dispose !== 'function') throw new Error('A museum source resource owner is required.');
  const batches = [], layouts = new Map(), buckets = new Map(); let group = null, released = false;
  const report = { mode: 'static-full-geometry-multidraw', id, sourceProvenance, applied: false, completeNativeComparisonPassed: false, requiredExtension: 'WEBGL_multi_draw', extensionAvailable: null, maximumAllowedMatrixErrorWorld: maximumErrorWorld, maximumMatrixEncodingErrorWorld: 0, sourceMeshes: 0, originalDraws: 0, representedInstances: 0, originalTriangles: 0, representedTriangles: 0, batches: 0, packedGeometries: 0, packedGeometryBytes: 0, matrixAndDrawTextureBytes: 0, sourceGeometryBuffersUnchanged: true, perObjectFrustumCulled: true, indexEncoding: 'lossless-base-vertex-rebase-with-capacity-selected-unsigned-index-width' };
  const releasePacked = () => {
    const errors = cleanup([() => group?.removeFromParent()]);
    // BatchedMesh.dispose() in r185 is non-idempotent and stops on the first
    // throwing event listener. Mirror its four owned resources independently,
    // without disposing its borrowed material, then clear texture references.
    for (const batch of batches.splice(0)) {
      errors.push(...cleanup([...new Set([batch.geometry, batch._matricesTexture, batch._indirectTexture, batch._colorsTexture].filter(Boolean))].map(resource => () => resource.dispose())));
      batch._matricesTexture = batch._indirectTexture = batch._colorsTexture = null;
      batch.userData = {}; batch._instanceInfo.length = 0; batch._geometryInfo.length = 0;
    }
    errors.push(...cleanup([() => group?.clear()])); group = null; layouts.clear(); buckets.clear();
    return errors;
  };
  const releaseAll = () => {
    if (released) return []; released = true;
    return [...releasePacked(), ...cleanup([() => source.group.removeFromParent(), () => source.dispose()])];
  };
  const dispose = () => {
    const errors = releaseAll();
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Museum multi-draw cleanup failed');
  };
  const fallback = (reason, error) => {
    const errors = releasePacked();
    source.collisionGroup ??= source.group; source.namedGroupRoot ??= source.group;
    source.diagnostics = { ...source.diagnostics, multiDrawBatch: { ...report, applied: false, reason, ...(error ? { error: errorData(error) } : {}), ...(errors.length ? { cleanupErrors: errors.map(errorData) } : {}) } };
    return source;
  };
  const progress = async (phase, completed, total) => { onProgress?.({ phase, completed, total }); checkpoint(signal); await yieldControl(); checkpoint(signal); };

  try {
    checkpoint(signal);
    if (!Number.isFinite(maximumErrorWorld) || maximumErrorWorld <= 0 || typeof yieldControl !== 'function') throw new Error('A positive matrix error budget and async yield function are required.');
    if (placement) placeMuseumStaticAsset(source, placement);
    if (!allowedIds.has(id)) return fallback('asset-not-allowlisted');
    if (source.collisionGroup && source.collisionGroup !== source.group) return fallback('source-already-has-a-render-adapter');
    if (source.group.parent || source.group.isMesh) return fallback('source-must-be-a-standalone-group');
    report.extensionAvailable = renderer?.extensions?.has?.('WEBGL_multi_draw') === true;
    if (!report.extensionAvailable) return fallback('multi-draw-extension-absent-or-unverified');
    const maxTextureSize = renderer?.capabilities?.maxTextureSize;
    if (!Number.isInteger(maxTextureSize) || maxTextureSize < 4) return fallback('texture-capacity-unverified');
    source.group.updateWorldMatrix(true, true);
    const rootMatrix = affine(source.group.matrixWorld), inverse = rootMatrix.clone().invert(), nodes = [];
    source.group.traverse(node => {
      if (callbacks.some(key => node[key] !== Object3D.prototype[key])) throw new Error('Object render callbacks require the original owner.');
      if (node.animations?.length) throw new Error('Animated objects require the original owner.');
      if (node.isMesh) nodes.push(node);
      else if (node.type !== 'Group' && node.type !== 'Object3D' || node.layers.mask !== 1) throw new Error('Custom scene nodes or camera-dependent group ordering require the original owner.');
    });
    report.sourceMeshes = nodes.length;
    await progress('multidraw-analysis', 0, nodes.length);
    for (let ordinal = 0; ordinal < nodes.length; ordinal++) {
      checkpoint(signal); const node = nodes[ordinal], geometry = node.geometry, material = node.material;
      if (node.isSkinnedMesh || node.isBatchedMesh || node.morphTargetInfluences?.length || node.morphTexture) throw new Error('Skinned/morphed/pre-batched meshes require the original owner.');
      if (Array.isArray(material)) throw new Error('Material groups require the original owner.');
      for (const m of [material, node.customDepthMaterial, node.customDistanceMaterial].filter(Boolean)) checkMaterial(m);
      if (!material) throw new Error('A material is required.');
      if (!layouts.has(geometry)) layouts.set(geometry, geometryLayout(geometry));
      const layout = layouts.get(geometry), count = node.isInstancedMesh ? node.count : 1, f = flags(node, source.group);
      if (!Number.isInteger(count) || count < 0 || node.isInstancedMesh && (!(node.instanceMatrix?.array instanceof Float32Array) || node.instanceMatrix.itemSize !== 16 || node.instanceMatrix.normalized || count > node.instanceMatrix.count)) throw new Error('Unsupported instance matrix layout.');
      if (node.instanceColor && (!(node.instanceColor.array instanceof Float32Array) || node.instanceColor.itemSize !== 3 || node.instanceColor.normalized || count > node.instanceColor.count)) throw new Error('Unsupported instance color layout.');
      if (!count) continue;
      const localNode = affine(new Matrix4().multiplyMatrices(inverse, node.matrixWorld));
      const key = JSON.stringify([material.uuid, layout.key, f, node.customDepthMaterial?.uuid, node.customDistanceMaterial?.uuid]);
      if (!buckets.has(key)) buckets.set(key, { material, flags: f, depth: node.customDepthMaterial, distance: node.customDistanceMaterial, geometries: new Map(), nodes: [], instances: 0, vertices: 0, indices: 0 });
      const bucket = buckets.get(key);
      if (!bucket.geometries.has(geometry)) { bucket.geometries.set(geometry, null); bucket.vertices += layout.vertices; bucket.indices += layout.indices; }
      bucket.nodes.push({ node, ordinal, localNode, count }); bucket.instances += count;
      report.originalDraws++; report.representedInstances += count; report.originalTriangles += layout.triangles * count;
      if (ordinal % 32 === 31) await progress('multidraw-analysis', ordinal + 1, nodes.length);
    }
    if (!buckets.size || buckets.size >= report.originalDraws) return fallback('no-object-draw-reduction');
    group = new Group(); group.name = source.group.name; group.userData = { ...source.group.userData };
    group.visible = source.group.visible; group.layers.mask = source.group.layers.mask; group.renderOrder = source.group.renderOrder;
    group.position.copy(source.group.position); group.quaternion.copy(source.group.quaternion); group.scale.copy(source.group.scale);
    group.matrixAutoUpdate = false; group.matrix.copy(rootMatrix);
    // r185 updateWorldMatrix does not recompute a manually copied matrix unless
    // marked dirty (or forced). Children must inherit the actual site placement.
    group.matrixWorldNeedsUpdate = true;
    let bucketOrdinal = 0, encodedInstances = 0;
    for (const bucket of buckets.values()) {
      checkpoint(signal);
      const matrixSide = Math.max(4, Math.ceil(Math.sqrt(bucket.instances * 4) / 4) * 4), drawSide = Math.ceil(Math.sqrt(bucket.instances));
      if (matrixSide > maxTextureSize || drawSide > maxTextureSize || bucket.indices * 4 > 2147483647 || bucket.vertices > 2147483647) throw new Error('Batch capacity exceeds the actual renderer limits.');
      const batch = new BatchedMesh(bucket.instances, bucket.vertices, bucket.indices, bucket.material); batches.push(batch);
      batch.name = `museum-multidraw/${bucketOrdinal++}/${bucket.material.name}`;
      batch.perObjectFrustumCulled = true; batch.sortObjects = false;
      batch.customDepthMaterial = bucket.depth; batch.customDistanceMaterial = bucket.distance;
      for (const name of ['visible', 'castShadow', 'receiveShadow', 'frustumCulled', 'renderOrder']) batch[name] = bucket.flags[name];
      batch.layers.mask = bucket.flags.layers;
      const ordered = new Group(); ordered.renderOrder = bucket.flags.groupOrder; ordered.add(batch); group.add(ordered);
      batch.userData = { representation: 'full-geometry-multidraw', sourceBindings: [], sourceGeometries: [] };
      for (const geometry of bucket.geometries.keys()) {
        const geometryId = batch.addGeometry(geometry); bucket.geometries.set(geometry, geometryId); report.packedGeometries++;
        const range = batch.getGeometryRangeAt(geometryId, {});
        batch.userData.sourceGeometries.push({ sourceGeometry: geometry.uuid, sourceName: geometry.name, geometryId, ...range });
        // BatchedMesh copies bytes/itemSize/normalized but not these attribute
        // properties. Restore the common signature's actual GPU interpretation.
        for (const [name, attribute] of Object.entries(geometry.attributes)) { batch.geometry.attributes[name].gpuType = attribute.gpuType; batch.geometry.attributes[name].setUsage(attribute.usage); }
        if (geometry.index) { batch.geometry.index.gpuType = geometry.index.gpuType; batch.geometry.index.setUsage(geometry.index.usage); }
        await progress('multidraw-geometries', report.packedGeometries, layouts.size);
      }
      const matrix = new Matrix4(), rounded = new Matrix4(), originalWorld = new Matrix4(), encodedWorld = new Matrix4(), color = new Color();
      for (const record of bucket.nodes) {
        const { node, ordinal, localNode, count } = record, geometryId = bucket.geometries.get(node.geometry), layout = layouts.get(node.geometry), start = batch.instanceCount;
        for (let instance = 0; instance < count; instance++) {
          checkpoint(signal); matrix.identity(); if (node.isInstancedMesh) node.getMatrixAt(instance, matrix);
          originalWorld.multiplyMatrices(node.matrixWorld, matrix);
          matrix.premultiply(localNode); matrix.copy(checkInstanceMatrix(matrix));
          const instanceId = batch.addInstance(geometryId); batch.setMatrixAt(instanceId, matrix); batch.getMatrixAt(instanceId, rounded);
          encodedWorld.multiplyMatrices(rootMatrix, rounded);
          const error = matrixError(affine(originalWorld), encodedWorld, layout.box);
          if (!Number.isFinite(error) || error > maximumErrorWorld) throw new Error('Float32 matrix encoding exceeds the explicit world error budget.');
          report.maximumMatrixEncodingErrorWorld = Math.max(report.maximumMatrixEncodingErrorWorld, error);
          if (node.instanceColor) { node.getColorAt(instance, color); if (!color.toArray().every(Number.isFinite)) throw new Error('Non-finite instance color.'); batch.setColorAt(instanceId, color); }
          report.representedTriangles += layout.triangles; encodedInstances++;
          if (encodedInstances % 1024 === 0) await progress('multidraw-instances', encodedInstances, report.representedInstances);
        }
        batch.userData.sourceBindings.push({ sourceNode: node.name, sourceNodeOrdinal: ordinal, sourceInstanceStart: 0, outputInstanceStart: start, count, geometryId });
      }
      batch.computeBoundingBox(); batch.computeBoundingSphere();
      report.packedGeometryBytes += Object.values(batch.geometry.attributes).reduce((n, a) => n + a.array.byteLength, batch.geometry.index?.array.byteLength ?? 0);
      report.matrixAndDrawTextureBytes += [batch._matricesTexture, batch._indirectTexture, batch._colorsTexture].reduce((n, texture) => n + (texture?.image.data.byteLength ?? 0), 0);
    }
    await progress('multidraw-complete', encodedInstances, report.representedInstances);
    if (encodedInstances !== report.representedInstances || report.originalTriangles !== report.representedTriangles) throw new Error('Multi-draw did not preserve every source instance/triangle.');
    group.updateWorldMatrix(true, true); report.batches = batches.length; report.applied = true;
    report.originalRootWorldMatrix = rootMatrix.toArray(); layouts.clear(); buckets.clear();
    return { ...source, group, collisionGroup: source.group, namedGroupRoot: source.group, diagnostics: { ...source.diagnostics, multiDrawBatch: report }, ...(typeof source.update === 'function' ? { update: source.update.bind(source) } : {}), dispose };
  } catch (error) {
    if (signal?.aborted) {
      const errors = releaseAll();
      if (errors.length) throw new AggregateError([signal.reason ?? error, ...errors], 'Multi-draw aborted with cleanup errors');
      throw signal.reason ?? error;
    }
    return fallback('multidraw-declined', error);
  }
}
