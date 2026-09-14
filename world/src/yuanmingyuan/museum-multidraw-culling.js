import { BatchedMesh, Frustum, Matrix4, REVISION, Sphere } from 'three';
import { gardenReflectionCropForDraw } from './garden-reflection-crop.js';

const stock = BatchedMesh.prototype;
const mutators = ['addInstance', 'deleteInstance', 'setMatrixAt', 'setVisibleAt', 'setGeometryIdAt', 'addGeometry', 'deleteGeometry', 'setGeometryAt', 'optimize', 'setInstanceCount', 'setGeometrySize', 'copy'];
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
const now = () => performance.now();
const emptyIds = new Uint32Array(0);
const attached = new WeakMap();
const counters = () => ({ calls: 0, croppedReflectionCalls: 0, cacheHits: 0, hierarchyQueries: 0, nodesTested: 0, nodesRejected: 0, nodesAccepted: 0, sphereTests: 0, sphereTransforms: 0, emittedInstances: 0, indirectUploads: 0, unchangedDrawLists: 0, fallbackCalls: 0, invalidations: 0, queryMilliseconds: 0 });
const checkAbort = signal => { if (signal?.aborted) throw signal.reason ?? new DOMException('Culling preparation aborted', 'AbortError'); };

function treeFor(ids, spheres, leafSize, start = 0, end = ids.length) {
  if (start === end) return null;
  const node = { start, end, minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity, left: null, right: null };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = start; i < end; i++) {
    const j = ids[i] * 4, r = spheres[j + 3], x = spheres[j], y = spheres[j + 1], z = spheres[j + 2];
    node.minX = Math.min(node.minX, x - r); node.maxX = Math.max(node.maxX, x + r);
    node.minY = Math.min(node.minY, y - r); node.maxY = Math.max(node.maxY, y + r);
    node.minZ = Math.min(node.minZ, z - r); node.maxZ = Math.max(node.maxZ, z + r);
    for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], spheres[j + axis]); hi[axis] = Math.max(hi[axis], spheres[j + axis]); }
  }
  if (end - start <= leafSize) return node;
  let axis = 0; for (let a = 1; a < 3; a++) if (hi[a] - lo[a] > hi[axis] - lo[axis]) axis = a;
  const pivot = lo[axis] / 2 + hi[axis] / 2;
  let split = start;
  for (let i = start; i < end; i++) if (spheres[ids[i] * 4 + axis] < pivot) { const id = ids[split]; ids[split++] = ids[i]; ids[i] = id; }
  // Bound depth even for coincident centers or extremely uneven distributions.
  if (split - start < (end - start) / 8 || end - split < (end - start) / 8) {
    ids.subarray(start, end).sort((a, b) => spheres[a * 4 + axis] - spheres[b * 4 + axis] || a - b);
    split = start + Math.floor((end - start) / 2);
  }
  node.left = treeFor(ids, spheres, leafSize, start, split);
  node.right = treeFor(ids, spheres, leafSize, split, end);
  return node;
}

// Only wholly outside/inside nodes bypass stock sphere tests. A roundoff band
// covers sphere-to-box rounding and plane cancellation; ambiguous nodes descend.
function classify(node, planes, mask) {
  let remaining = mask;
  for (let i = 0; i < 6; i++) {
    const bit = 1 << i; if (!(mask & bit)) continue;
    const p = planes[i], { x, y, z } = p.normal;
    const upper = x * (x >= 0 ? node.maxX : node.minX) + y * (y >= 0 ? node.maxY : node.minY) + z * (z >= 0 ? node.maxZ : node.minZ) + p.constant;
    const lower = x * (x >= 0 ? node.minX : node.maxX) + y * (y >= 0 ? node.minY : node.maxY) + z * (z >= 0 ? node.minZ : node.maxZ) + p.constant;
    const margin = 64 * Number.EPSILON * (Math.abs(x) * Math.max(Math.abs(node.minX), Math.abs(node.maxX)) + Math.abs(y) * Math.max(Math.abs(node.minY), Math.abs(node.maxY)) + Math.abs(z) * Math.max(Math.abs(node.minZ), Math.abs(node.maxZ)) + Math.abs(p.constant) + 1);
    if (upper < -margin) return -1;
    if (lower > margin) remaining &= ~bit;
  }
  return remaining;
}

function signature(batch) {
  const g = batch.geometry, p = g?.attributes.position, i = g?.index, t = batch._matricesTexture;
  return [g, p, p?.array, p?.version, i, i?.array, i?.version, t, t?.image?.data, t?.version, batch._instanceInfo, batch._instanceInfo?.length, batch._geometryInfo, batch._geometryInfo?.length, batch._multiDrawStarts, batch._multiDrawCounts, batch._indirectTexture, batch._indirectTexture?.image?.data];
}
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

function prepare(batch, leafSize, signal) {
  if (REVISION !== '185' || !batch.isBatchedMesh) throw new Error('Only the inspected Three r185 BatchedMesh is supported.');
  for (const name of ['onBeforeRender', 'onBeforeShadow', 'getMatrixAt', 'getBoundingSphereAt', ...mutators]) {
    if (batch[name] !== stock[name] && !attached.get(batch)?.wrappers.has(batch[name])) throw new Error(`Custom BatchedMesh method: ${name}`);
  }
  if (!batch.perObjectFrustumCulled || batch.sortObjects || batch.customSort !== null) throw new Error('Stock unsorted per-instance culling is required.');
  const count = batch._instanceInfo.length, spheres = new Float64Array(count * 4), starts = new Int32Array(count), counts = new Int32Array(count), visible = [];
  const matrix = new Matrix4(), sphere = new Sphere(), index = batch.geometry.index, byteSize = index ? index.array.BYTES_PER_ELEMENT : 1;
  for (let id = 0; id < count; id++) {
    if (!(id % 512)) checkAbort(signal);
    const info = batch._instanceInfo[id]; if (!info.active || !info.visible) continue;
    batch.getMatrixAt(id, matrix);
    batch.getBoundingSphereAt(info.geometryIndex, sphere).applyMatrix4(matrix);
    if (![sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius].every(Number.isFinite) || sphere.radius < 0) throw new Error('Finite nonnegative stock spheres are required.');
    spheres.set([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], id * 4);
    const range = batch._geometryInfo[info.geometryIndex]; starts[id] = range.start * byteSize; counts[id] = range.count; visible.push(id);
  }
  const sortedIds = Uint32Array.from(visible), ids = sortedIds.slice(), root = treeFor(ids, spheres, leafSize), bits = new Uint32Array(Math.ceil(count / 32));
  return { spheres, starts, counts, sortedIds, ids, root, bits, signature: signature(batch), count, visibleCount: visible.length };
}

function attach(batch, { leafSize, viewCacheSize, signal }) {
  if (attached.has(batch)) throw new Error('A culling helper is already attached.');
  const preparationStart = now();
  let data = prepare(batch, leafSize, signal), mesh = batch, disposed = false, suspended = null, cache = [], installed = null, installedVersion = -1;
  const preparationMilliseconds = now() - preparationStart;
  const stats = counters(), descriptors = new Map(), replacements = new Map(), wrappers = new Set(), frustum = new Frustum(), matrix = new Matrix4(), sphere = new Sphere();
  const name = batch.name; let geometry = batch.geometry;
  stats.sphereTransforms = data.visibleCount;
  const clear = () => { cache.length = 0; installed = null; installedVersion = -1; data = null; };
  function invalidate(reason = 'explicit-invalidation') { if (disposed) return; stats.invalidations++; suspended = reason; clear(); }
  function fallback(args, reason) { installed = null; installedVersion = -1; stats.fallbackCalls++; lastReason = reason; return stock.onBeforeRender.apply(mesh, args); }
  let lastReason = null;
  function query() {
    stats.hierarchyQueries++; const { root, ids, spheres, bits, sortedIds } = data;
    if (!root) return emptyIds;
    bits.fill(0); let all = false;
    const mark = id => { bits[id >>> 5] |= 1 << (id & 31); };
    function visit(node, mask) {
      stats.nodesTested++; const result = classify(node, frustum.planes, mask);
      if (result < 0) { stats.nodesRejected++; return; }
      if (result === 0) {
        stats.nodesAccepted++;
        if (node === root) { all = true; return; }
        for (let i = node.start; i < node.end; i++) mark(ids[i]);
      } else if (node.left) { visit(node.left, result); visit(node.right, result); }
      else for (let i = node.start; i < node.end; i++) {
        const id = ids[i], j = id * 4; sphere.center.set(spheres[j], spheres[j + 1], spheres[j + 2]); sphere.radius = spheres[j + 3];
        stats.sphereTests++; if (frustum.intersectsSphere(sphere)) mark(id);
      }
    }
    visit(root, 63);
    if (all) return sortedIds;
    // Bit iteration preserves stock ascending instance order without sorting
    // a spatially ordered result or scanning every rejected instance.
    const selected = [];
    for (let word = 0; word < bits.length; word++) {
      let value = bits[word]; while (value) { const bit = 31 - Math.clz32(value & -value); selected.push(word * 32 + bit); value = (value & (value - 1)) >>> 0; }
    }
    return Uint32Array.from(selected);
  }
  function publish(entry) {
    const texture = mesh._indirectTexture, array = texture.image.data, ids = entry.ids;
    const stillInstalled = installed && installedVersion === texture.version && mesh._multiDrawCount === installed.ids.length && !mesh._visibilityChanged;
    if (stillInstalled && (entry === installed || ids === installed.ids || same(ids, installed.ids))) {
      installed = entry; stats.unchangedDrawLists++; return;
    }
    for (let i = 0; i < ids.length; i++) { const id = ids[i]; mesh._multiDrawStarts[i] = data.starts[id]; mesh._multiDrawCounts[i] = data.counts[id]; array[i] = id; }
    texture.needsUpdate = true; mesh._multiDrawCount = ids.length; mesh._visibilityChanged = false;
    installed = entry; installedVersion = texture.version; stats.indirectUploads++;
  }
  function render(...args) {
    if (!mesh || disposed) return stock.onBeforeRender.apply(this, args);
    stats.calls++; const start = now(); let stockStarted = false;
    const runStock = reason => { stockStarted = true; return fallback(args, reason); };
    try {
      const [renderer, , camera, geometryArg, material] = args;
      if (suspended) return runStock(suspended);
      if (!same(data.signature, signature(mesh))) { invalidate('tracked-buffer-or-layout-changed'); return runStock(suspended); }
      if (mesh.getMatrixAt !== stock.getMatrixAt || mesh.getBoundingSphereAt !== stock.getBoundingSphereAt) { invalidate('custom-bound-method'); return runStock(suspended); }
      if (mesh._visibilityChanged && stats.calls > 1) { invalidate('untracked-visibility-change'); return runStock(suspended); }
      if (camera.isArrayCamera || !mesh.perObjectFrustumCulled || mesh.sortObjects || mesh.customSort !== null || material?.wireframe || material?.transparent || geometryArg !== mesh.geometry) return runStock('view-or-draw-mode-requires-stock');
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
      // This matrix is only a CPU query. The real camera, pixel projection and
      // render target viewport stay untouched. Its crop also enters the LRU key.
      const crop = gardenReflectionCropForDraw(renderer, camera);
      if (crop) { matrix.premultiply(crop.clipMatrix); stats.croppedReflectionCalls++; }
      if (!matrix.elements.every(Number.isFinite)) return runStock('nonfinite-projection');
      const key = [...matrix.elements, camera.coordinateSystem, Boolean(camera.reversedDepth)];
      let entry = cache.find(item => same(item.key, key));
      if (entry) { stats.cacheHits++; cache.splice(cache.indexOf(entry), 1); cache.push(entry); }
      else {
        frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
        if (frustum.planes.some(p => ![p.normal.x, p.normal.y, p.normal.z, p.constant].every(Number.isFinite) || p.normal.lengthSq() === 0)) return runStock('nonfinite-frustum-plane');
        entry = { key, ids: query() };
        if (viewCacheSize) { cache.push(entry); if (cache.length > viewCacheSize) cache.shift(); }
      }
      stats.emittedInstances += entry.ids.length; publish(entry); lastReason = null;
    } catch (error) {
      if (stockStarted) throw error;
      // Any unexpected optimizer state gives the stock callback the complete
      // untouched batch. Errors from stock itself are not swallowed/retried.
      invalidate(`optimizer-error: ${error.message}`);
      return fallback(args, suspended);
    } finally { stats.queryMilliseconds += now() - start; }
  }
  function replace(key, fn) { descriptors.set(key, Object.getOwnPropertyDescriptor(batch, key)); replacements.set(key, fn); wrappers.add(fn); batch[key] = fn; }
  function dispose() {
    if (disposed) return; disposed = true; clear();
    geometry.removeEventListener('dispose', dispose);
    for (const [key, fn] of replacements) if (mesh[key] === fn) {
      const descriptor = descriptors.get(key); if (descriptor) Object.defineProperty(mesh, key, descriptor); else delete mesh[key];
    }
    attached.delete(mesh); descriptors.clear(); replacements.clear(); wrappers.clear(); mesh = null; batch = null; geometry = null;
  }
  try {
    replace('onBeforeRender', render);
    for (const key of mutators) replace(key, function (...args) { invalidate(`public-mutation:${key}`); return stock[key].apply(this, args); });
    geometry.addEventListener('dispose', dispose); attached.set(batch, { wrappers });
  } catch (error) { dispose(); throw error; }
  return {
    invalidate, dispose,
    snapshot() {
      const typedArrayBytes = data ? data.spheres.byteLength + data.starts.byteLength + data.counts.byteLength + data.ids.byteLength + data.sortedIds.byteLength + data.bits.byteLength + [...new Set([...cache, installed].filter(Boolean).map(e => e.ids).filter(ids => ids !== data.sortedIds))].reduce((n, ids) => n + ids.byteLength, 0) : 0;
      return { name, disposed, suspended, lastReason, preparationMilliseconds, instances: data?.count ?? null, staticVisibleInstances: data?.visibleCount ?? null, cachedViews: cache.length, typedArrayBytes, ...stats };
    },
  };
}

/** Attaches only CPU culling callbacks. This helper never owns/disposes source
 * geometry, materials, textures or the original collision/named-group owner.
 * Public bound-changing APIs suspend acceleration and use stock Three until
 * callers dispose/re-attach after the object becomes static again. Raw private
 * mutations without Three version flags require invalidate() before rendering.
 * Dispose before the owning batch resource; geometry disposal also detaches.
 */
export async function attachMuseumMultiDrawCulling(group, { leafSize = 32, viewCacheSize = 3, signal, yieldControl = yieldTask } = {}) {
  if (!group?.isObject3D || !Number.isInteger(leafSize) || leafSize < 1 || leafSize > 256 || !Number.isInteger(viewCacheSize) || viewCacheSize < 0 || viewCacheSize > 8 || typeof yieldControl !== 'function') throw new Error('A scene root and bounded culling options are required.');
  const controllers = [], skipped = [], batches = []; let disposed = false;
  group.traverse(node => { if (node.isBatchedMesh) batches.push(node); }); group = null;
  const dispose = () => { if (disposed) return; disposed = true; signal?.removeEventListener('abort', dispose); for (const c of controllers) c.dispose(); };
  try {
    checkAbort(signal); signal?.addEventListener('abort', dispose, { once: true });
    for (const batch of batches) {
      checkAbort(signal);
      try { controllers.push(attach(batch, { leafSize, viewCacheSize, signal })); }
      catch (error) { checkAbort(signal); skipped.push({ name: batch.name, reason: error.message }); }
      await yieldControl(); checkAbort(signal);
    }
  } catch (error) { dispose(); throw error; } finally { batches.length = 0; }
  return { dispose, invalidate: reason => controllers.forEach(c => c.invalidate(reason)), snapshot: () => ({ mode: 'r185-static-sphere-hierarchy', disposed, appliedBatches: controllers.length, leafSize, viewCacheSize, skipped: [...skipped], batches: controllers.map(c => c.snapshot()) }) };
}
