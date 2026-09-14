import { Material, Object3D } from 'three';
import { createBuildingDistanceAsset } from './zhengjuesi-distance-builder.js';

const staticIds = new Set(['zhengjuesi', 'haiyue', 'hanjingtang']);
const callbacks = ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow'];
const errorData = error => ({ name: error?.name ?? 'Error', message: error?.message ?? String(error) });
const cleanup = actions => {
  const errors = [];
  for (const action of actions) { try { action(); } catch (error) { errors.push(error); } }
  return errors;
};

// Place before mounting and building collision BVHs. A later placement needs a
// new query; a different scale also needs a freshly qualified batch error bound.
export function placeMuseumStaticAsset(resource, { position, rotationY, scale } = {}) {
  const original = resource?.collisionGroup ?? resource?.group;
  const roots = [...new Set([original, resource?.group])];
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(rotationY) || !Number.isFinite(scale) || scale <= 0 || roots.some(root => !root?.isObject3D || root.parent)) throw new Error('Place standalone museum roots with a finite position, Y rotation and positive scale before mounting.');
  original.position.fromArray(position); original.rotation.y = rotationY; original.scale.setScalar(scale);
  for (const root of roots) {
    if (root !== original) { root.position.copy(original.position); root.quaternion.copy(original.quaternion); root.scale.copy(original.scale); }
    root.updateMatrix(); root.updateWorldMatrix(true, true);
  }
  return resource;
}

function checkStaticSource(group) {
  group.traverse(node => {
    if (!node.isMesh) {
      if (node.type !== 'Group' && node.type !== 'Object3D') throw new Error(`Unsupported static node: ${node.type}`);
      return;
    }
    if (node.isBatchedMesh || node.geometry?.isInstancedBufferGeometry || Object.values(node.geometry?.attributes ?? {}).some(attribute => attribute.isInstancedBufferAttribute)) throw new Error('Custom instance attributes require a separately verified adapter.');
    if (callbacks.some(key => node[key] !== Object3D.prototype[key])) throw new Error('Object render callbacks require the original owner.');
    const materials = [...(Array.isArray(node.material) ? node.material : [node.material]), node.customDepthMaterial, node.customDistanceMaterial].filter(Boolean);
    if (!materials.length || materials.some(material => !material.isMaterial || material.isShaderMaterial || material.isRawShaderMaterial || material.onBeforeCompile !== Material.prototype.onBeforeCompile || material.customProgramCacheKey !== Material.prototype.customProgramCacheKey)) throw new Error('Custom material shaders require the original owner.');
  });
}

/** Owns the acquired source on entry. Unsupported/no-benefit builds return that
 * same full owner. An abort disposes it and rejects. Successful batches borrow
 * source buffers/textures until dispose; only `group` belongs in the scene.
 * Default 16 m world cells keep distant buildings separately cullable. Pass 0
 * for the original unpartitioned comparison; no geometry is simplified. */
export async function createMuseumStaticBatch(source, { id, signal, placement, sourceProvenance = null, maximumErrorWorld = 1e-5, spatialCellSizeWorld = 16, onProgress, yieldControl } = {}) {
  if (!source?.group?.isObject3D || typeof source.dispose !== 'function') throw new Error('A museum source resource owner is required.');
  let batch = null, released = false;
  const releaseBatch = () => {
    const previous = batch; batch = null;
    return previous ? cleanup([() => previous.group.removeFromParent(), () => previous.dispose()]) : [];
  };
  const releaseAll = () => {
    if (released) return [];
    released = true;
    return [...releaseBatch(), ...cleanup([() => source.group.removeFromParent(), () => source.dispose()])];
  };
  const dispose = () => {
    const errors = releaseAll();
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Museum static asset cleanup failed');
  };
  const details = { mode: 'static-full-geometry-instancing', id, sourceProvenance, requestedMaximumErrorWorld: maximumErrorWorld, spatialCellSizeWorld, actualCandidateCount: 0, exactSourceBuffersRetained: true, completeNativeComparisonPassed: false };
  const fallback = (reason, error) => {
    const cleanupErrors = releaseBatch().map(errorData);
    source.collisionGroup ??= source.group; source.namedGroupRoot ??= source.group;
    source.diagnostics = { ...source.diagnostics, nearBatch: { ...details, applied: false, reason, ...(error ? { error: errorData(error) } : {}), ...(cleanupErrors.length ? { cleanupErrors } : {}) } };
    return source;
  };
  try {
    signal?.throwIfAborted();
    if (placement) placeMuseumStaticAsset(source, placement);
    if (!staticIds.has(id)) return fallback('asset-not-allowlisted');
    if (source.collisionGroup && source.collisionGroup !== source.group) return source;
    checkStaticSource(source.group);
    batch = await createBuildingDistanceAsset(source, {
      id,
      sourceArchiveDigest: sourceProvenance?.kind === 'archive' ? sourceProvenance.digest : undefined,
      maximumErrorWorld,
      candidateProvider: () => [],
      candidateError: () => { throw new Error('The full-detail adapter must not select geometry candidates.'); },
      sparseInstanceLimit: 0,
      spatialCellSizeWorld,
      signal, onProgress,
      ...(yieldControl ? { yieldControl } : {}),
    });
    signal?.throwIfAborted();
    details.builderReport = batch.report;
    if (batch.report.originalTriangles !== batch.report.distanceTriangles || batch.report.originalInstances !== batch.report.representedInstances || batch.report.mergedDraws || batch.report.geometries.some(geometry => geometry.variants.length)) throw new Error('The batch did not preserve the full source representation.');
    if (batch.report.distanceDraws >= batch.report.originalDraws) return fallback('no-draw-reduction');
    batch.group.name = source.group.name;
    return {
      ...source,
      group: batch.group,
      collisionGroup: source.group,
      namedGroupRoot: source.group,
      diagnostics: { ...source.diagnostics, nearBatch: { ...details, applied: true } },
      ...(typeof source.update === 'function' ? { update: source.update.bind(source) } : {}),
      dispose,
    };
  } catch (error) {
    if (signal?.aborted) {
      const errors = releaseAll();
      if (errors.length) throw new AggregateError([signal.reason ?? error, ...errors], 'Museum static asset aborted with cleanup errors');
      throw signal.reason ?? error;
    }
    return fallback('batch-declined', error);
  }
}
