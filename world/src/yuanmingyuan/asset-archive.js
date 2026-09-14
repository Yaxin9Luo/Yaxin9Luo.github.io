import * as THREE from 'three';

export const YUANMINGYUAN_ARCHIVE_SCHEMA = 1;
export const YUANMINGYUAN_ARCHIVE_MAX_PARTS = 1024;
export const ARCHIVE_MATERIAL_TYPES = ['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshBasicMaterial', 'MeshDepthMaterial', 'MeshDistanceMaterial'];
export const ARCHIVE_NODE_TYPES = ['Group', 'Object3D', 'Mesh', 'InstancedMesh'];
const arrays = { Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array };
const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
const mathTypes = ['Color', 'Vector2', 'Vector3', 'Vector4', 'Euler', 'Quaternion', 'Matrix3', 'Matrix4', 'Plane', 'Box3', 'Sphere'];

export function archiveValue(value) {
  if (Object.is(value, -0)) return { $number: '-0' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  for (const type of mathTypes) if (value?.[`is${type}`] || type === 'Euler' && value?.isEuler) {
    const data = type === 'Plane' ? [...value.normal.toArray(), value.constant] : type === 'Box3' ? [...value.min.toArray(), ...value.max.toArray()] : type === 'Sphere' ? [...value.center.toArray(), value.radius] : value.toArray();
    return { $three: type, data: data.map(archiveValue) };
  }
  if (Array.isArray(value)) return value.map(archiveValue);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (blockedKeys.has(key) || key.startsWith('$')) throw new Error(`Unsupported archive key: ${key}`);
      if (entry !== undefined) result[key] = archiveValue(entry);
    }
    return result;
  }
  throw new Error(`Unsupported archive value: ${value?.constructor?.name ?? typeof value}`);
}

export function restoreArchiveValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(restoreArchiveValue);
  if ('$number' in value) {
    if (!['Infinity', '-Infinity', 'NaN', '-0'].includes(value.$number)) throw new Error('Invalid archived number');
    return Number(value.$number);
  }
  if ('$three' in value) {
    const type = value.$three, data = value.data.map(restoreArchiveValue);
    if (!mathTypes.includes(type)) throw new Error(`Unknown archived math type: ${type}`);
    if (type === 'Plane') return new THREE.Plane(new THREE.Vector3(...data.slice(0, 3)), data[3]);
    if (type === 'Box3') return new THREE.Box3(new THREE.Vector3(...data.slice(0, 3)), new THREE.Vector3(...data.slice(3, 6)));
    if (type === 'Sphere') return new THREE.Sphere(new THREE.Vector3(...data.slice(0, 3)), data[3]);
    return new THREE[type]().fromArray(data);
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (blockedKeys.has(key) || key.startsWith('$')) throw new Error(`Invalid archive key: ${key}`);
    result[key] = restoreArchiveValue(entry);
  }
  return result;
}

export function archiveBytes(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('Archive input must contain binary bytes');
}

export function inspectArchiveGLB(input) {
  const bytes = archiveBytes(input), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 28 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('Invalid GLB header or declared length');
  const jsonLength = view.getUint32(12, true), binHeader = 20 + jsonLength;
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || binHeader + 8 > bytes.length || view.getUint32(binHeader + 4, true) !== 0x004e4942) throw new Error('Invalid GLB chunks');
  const binLength = view.getUint32(binHeader, true);
  if (binHeader + 8 + binLength !== bytes.length || binLength % 4) throw new Error('Invalid GLB binary length');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, binHeader)));
  if (json.buffers?.length !== 1 || json.buffers[0].uri || json.buffers[0].byteLength > binLength) throw new Error('Archive GLB must have one embedded buffer');
  if ((json.images ?? []).some(image => image.uri)) throw new Error('Archive GLB cannot contain external image requests');
  return { json, binary: bytes.subarray(binHeader + 8) };
}

export async function archiveSHA256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', archiveBytes(bytes));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function checkAbort(signal) { if (signal?.aborted) throw signal.reason ?? new DOMException('Archive loading aborted', 'AbortError'); }
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

function applyProperties(object, properties) {
  for (const [key, encoded] of Object.entries(properties)) {
    if (blockedKeys.has(key) || !(key in object)) throw new Error(`Unsupported archived property: ${key}`);
    const value = restoreArchiveValue(encoded);
    if (object[key]?.copy && value && object[key].constructor === value.constructor) object[key].copy(value);
    else object[key] = value;
  }
}

function validateMetadata(metadata, json) {
  if (metadata?.schema !== YUANMINGYUAN_ARCHIVE_SCHEMA || metadata.kind !== 'yuanmingyuan-runtime-archive') throw new Error('Unsupported Yuanmingyuan archive schema');
  if (metadata.threeRevision !== THREE.REVISION) throw new Error(`Archive Three.js revision ${metadata.threeRevision} differs from runtime ${THREE.REVISION}`);
  if (json.asset?.extras?.yuanmingyuanArchiveId !== metadata.id) throw new Error('GLB and runtime metadata identities differ');
  for (const name of ['buffers', 'attributes', 'geometries', 'images', 'textures', 'materials', 'nodes', 'animations']) if (!Array.isArray(metadata[name])) throw new Error(`Missing archive table: ${name}`);
  if (!Number.isInteger(metadata.root) || !metadata.nodes[metadata.root]) throw new Error('Missing archive root');
}

/** Creates a fresh owned scene directly from exact source bytes, without a
 * factory, image decoder, GLTFLoader material conversion or module-level cache. */
export async function restoreYuanmingyuanArchive(input, metadata, { signal, onProgress, yieldControl = yieldTask } = {}) {
  checkAbort(signal);
  const { json, binary } = inspectArchiveGLB(input); validateMetadata(metadata, json);
  if (await archiveSHA256(input) !== metadata.glb.sha256) throw new Error('Archive GLB SHA256 mismatch');
  checkAbort(signal);
  const geometries = new Set(), materials = new Set(), textures = new Set(), disposableNodes = new Set(); let disposed = false, group = null;
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const set of [disposableNodes, geometries, materials, textures]) { for (const resource of set) resource.dispose(); set.clear(); }
    group?.clear();
  };
  const checkpoint = async (phase, completed) => { onProgress?.({ phase, completed }); await yieldControl(); checkAbort(signal); };
  try {
    const buffers = [];
    for (const [i, record] of metadata.buffers.entries()) {
      checkAbort(signal);
      const Type = arrays[record.arrayType], bv = json.bufferViews?.[record.bufferView], offset = record.byteOffset ?? 0;
      if (!Type || !bv || bv.buffer !== 0 || !Number.isInteger(bv.byteOffset ?? 0) || (bv.byteOffset ?? 0) < 0 || !Number.isInteger(bv.byteLength) || bv.byteLength < 0 || !Number.isInteger(record.length) || record.length < 0 || !Number.isInteger(offset) || offset < 0 || record.length * Type.BYTES_PER_ELEMENT !== record.byteLength || offset + record.byteLength > bv.byteLength || (bv.byteOffset ?? 0) + bv.byteLength > binary.byteLength) throw new Error(`Invalid archived typed buffer ${i}`);
      const source = binary.subarray((bv.byteOffset ?? 0) + offset, (bv.byteOffset ?? 0) + offset + record.byteLength);
      if (await archiveSHA256(source) !== record.sha256) throw new Error(`Original buffer SHA256 mismatch: ${i}`);
      const bytes = new Uint8Array(record.byteLength);
      for (let start = 0; start < bytes.length; start += 8 * 1024 * 1024) {
        bytes.set(source.subarray(start, Math.min(source.length, start + 8 * 1024 * 1024)), start);
        if (bytes.length > 8 * 1024 * 1024) await checkpoint('copy-binary', i);
      }
      buffers.push(new Type(bytes.buffer));
      if (i % 16 === 15) await checkpoint('restore-buffers', i + 1);
    }
    const attributes = metadata.attributes.map(record => {
      if (!buffers[record.buffer] || !Number.isInteger(record.itemSize) || record.itemSize < 1 || buffers[record.buffer].length % record.itemSize) throw new Error('Invalid archived attribute');
      const attribute = record.instanced ? new THREE.InstancedBufferAttribute(buffers[record.buffer], record.itemSize, record.normalized, record.meshPerAttribute) : new THREE.BufferAttribute(buffers[record.buffer], record.itemSize, record.normalized);
      attribute.name = record.name; attribute.usage = record.usage; attribute.gpuType = record.gpuType; attribute.updateRanges = restoreArchiveValue(record.updateRanges); return attribute;
    });
    const geometryList = [];
    for (const [i, record] of metadata.geometries.entries()) {
      const geometry = new THREE.BufferGeometry(); geometries.add(geometry);
      for (const [name, id] of Object.entries(record.attributes)) { if (!attributes[id]) throw new Error(`Missing attribute ${name}`); geometry.setAttribute(name, attributes[id]); }
      if (record.index !== null) { if (!attributes[record.index]) throw new Error('Missing geometry index'); geometry.setIndex(attributes[record.index]); }
      applyProperties(geometry, record.properties); geometryList.push(geometry);
      if (i % 16 === 15) await checkpoint('restore-geometries', i + 1);
    }
    const images = metadata.images.map(record => {
      const data = buffers[record.buffer];
      if (!data || !Number.isInteger(record.width) || !Number.isInteger(record.height) || record.width < 1 || record.height < 1 || data.length !== record.width * record.height * 4) throw new Error('Invalid original RGBA pixels');
      return new THREE.Source({ data, width: record.width, height: record.height });
    });
    const textureList = metadata.textures.map(record => {
      if (!images[record.image]) throw new Error('Missing archived image');
      const texture = new THREE.DataTexture(); textures.add(texture); texture.source = images[record.image]; applyProperties(texture, record.properties); texture.needsUpdate = true; return texture;
    });
    const materialList = metadata.materials.map(record => {
      if (!ARCHIVE_MATERIAL_TYPES.includes(record.type)) throw new Error(`Unsupported archived material ${record.type}`);
      const material = new THREE[record.type](); materials.add(material); applyProperties(material, record.properties);
      for (const [slot, id] of Object.entries(record.textures)) { if (!(slot in material) || !textureList[id]) throw new Error(`Missing archived texture ${slot}`); material[slot] = textureList[id]; }
      material.needsUpdate = true; return material;
    });
    await checkpoint('restore-materials', materialList.length);
    const nodes = metadata.nodes.map(record => {
      if (!ARCHIVE_NODE_TYPES.includes(record.type)) throw new Error(`Unsupported archived node ${record.type}`);
      let node;
      if (record.type === 'Mesh' || record.type === 'InstancedMesh') {
        const material = Array.isArray(record.material) ? record.material.map(id => materialList[id]) : materialList[record.material];
        if (!geometryList[record.geometry] || !material || Array.isArray(material) && material.some(m => !m)) throw new Error('Missing mesh resource');
        node = record.type === 'InstancedMesh' ? new THREE.InstancedMesh(geometryList[record.geometry], material, 0) : new THREE.Mesh(geometryList[record.geometry], material);
        if (record.type === 'InstancedMesh') {
          disposableNodes.add(node);
          node.instanceMatrix = attributes[record.instanceMatrix]; node.instanceColor = record.instanceColor === null ? null : attributes[record.instanceColor]; node.count = record.count;
          if (!node.instanceMatrix?.isInstancedBufferAttribute || node.instanceMatrix.count < node.count) throw new Error('Invalid instance matrices');
        }
        for (const key of ['customDepthMaterial', 'customDistanceMaterial']) if (record[key] !== null) { if (!materialList[record[key]]) throw new Error(`Missing ${key}`); node[key] = materialList[record[key]]; }
      } else node = new THREE[record.type]();
      node.rotation.order = record.rotationOrder; applyProperties(node, record.properties); node.layers.mask = record.layers;
      return node;
    });
    const parentCount = new Uint8Array(nodes.length);
    for (const [id, record] of metadata.nodes.entries()) for (const child of record.children) {
      if (!Number.isInteger(child) || !nodes[child] || child <= id || ++parentCount[child] !== 1) throw new Error('Invalid archive tree');
      nodes[id].add(nodes[child]);
    }
    if (parentCount[metadata.root] || parentCount.some((count, i) => i !== metadata.root && count !== 1)) throw new Error('Disconnected archive tree');
    group = nodes[metadata.root]; group.updateMatrixWorld(true);
    for (const binding of metadata.animations) {
      if (binding.kind !== 'fountain-texture-offset-v1' || !textureList[binding.texture] || !['surface', 'flow'].includes(binding.role)) throw new Error('Unsupported archived animation');
    }
    const update = time => {
      if (disposed || !Number.isFinite(time)) return;
      for (const binding of metadata.animations) {
        const offset = textureList[binding.texture].offset;
        if (binding.role === 'surface') offset.set(time * .008 % 1, time * .005 % 1);
        else offset.y = -time * .72 % 1;
      }
    };
    await checkpoint('ready', nodes.length);
    return { group, diagnostics: restoreArchiveValue(metadata.diagnostics), update, dispose, archive: { id: metadata.id, glbSHA256: metadata.glb.sha256, sourceSHA256: metadata.sourceSHA256, resourceOwnership: { geometries: geometries.size, materials: materials.size, textures: textures.size, instancedMeshes: disposableNodes.size, moduleGlobalCache: false, disposalIsIdempotent: true } } };
  } catch (error) { dispose(); throw error; }
}

function abortable(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason ?? new DOMException('Archive loading aborted', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', aborted);
    if (signal.aborted) { promise.catch(() => {}); aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true }); promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

async function decompressGzip(input, expectedBytes, { signal, onProgress, phase }) {
  if (typeof globalThis.DecompressionStream !== 'function') throw new Error('This runtime requires DecompressionStream("gzip") for archived assets');
  const output = new Uint8Array(expectedBytes), reader = new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(); let written = 0, reported = 0;
  try {
    onProgress?.({ phase: `decompress-${phase}`, bytes: 0, totalBytes: expectedBytes }); checkAbort(signal);
    while (true) {
      const { value, done } = await abortable(reader.read(), signal); checkAbort(signal); if (done) break;
      if (written + value.byteLength > output.byteLength) throw new Error(`Archive decompressed byte length exceeds manifest: ${phase}`);
      output.set(value, written); written += value.byteLength;
      if (written - reported >= 8 * 1024 * 1024) { reported = written; onProgress?.({ phase: `decompress-${phase}`, bytes: written, totalBytes: expectedBytes }); }
    }
    if (written !== expectedBytes) throw new Error(`Archive decompressed byte length differs from manifest: ${phase}`);
    onProgress?.({ phase: `decompress-${phase}`, bytes: written, totalBytes: expectedBytes }); checkAbort(signal); return output;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Descriptor hashes come from the offline manifest. No shared cache or hidden
 * dependency requests are created; cancellation never publishes a late scene. */
export async function loadYuanmingyuanArchive(descriptor, { signal, fetchImpl = globalThis.fetch, onProgress, yieldControl } = {}) {
  checkAbort(signal);
  const controller = new AbortController(), forwardAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const loadingSignal = controller.signal;
  const read = async (entry, phase) => {
    if (!entry || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') || (!entry.url && !entry.parts)) throw new Error(`Missing archive URL or SHA256: ${phase}`);
    if (entry.compression !== undefined && !['none', 'gzip'].includes(entry.compression)) throw new Error(`Unsupported archive transfer compression: ${entry.compression}`);
    const compressed = entry.compression === 'gzip';
    if (compressed && (!/^[0-9a-f]{64}$/.test(entry.transferSha256 ?? '') || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !Number.isSafeInteger(entry.transferBytes) || entry.transferBytes < 1)) throw new Error(`Missing gzip transfer hashes or byte lengths: ${phase}`);
    const fetchBytes=async url=>{const response=await abortable(Promise.resolve().then(()=>{checkAbort(loadingSignal);return fetchImpl(url,{signal:loadingSignal,redirect:'error'});}),loadingSignal);if(!response.ok)throw new Error(`Archive ${phase} HTTP ${response.status}`);const bytes=await abortable(response.arrayBuffer(),loadingSignal);checkAbort(loadingSignal);return bytes;};
    let transfer;
    if(entry.parts!==undefined){
      if(entry.url!==undefined||!compressed||!Array.isArray(entry.parts)||entry.parts.length<1||entry.parts.length>YUANMINGYUAN_ARCHIVE_MAX_PARTS)throw new Error(`Invalid archive transfer parts: ${phase}`);
      let total=0;const urls=new Set();
      for(const part of entry.parts){if(typeof part?.url!=='string'||!part.url||urls.has(part.url)||!Number.isSafeInteger(part.bytes)||part.bytes<1||!/^([a-f0-9]{64})$/.test(part.sha256??''))throw new Error(`Invalid archive transfer part: ${phase}`);urls.add(part.url);total+=part.bytes;}
      if(!Number.isSafeInteger(total)||total!==entry.transferBytes)throw new Error(`Archive ${phase} part byte totals mismatch`);
      transfer=new Uint8Array(total);let offset=0;
      // One part at a time bounds transient response storage. The aggregate
      // compressed and decoded hashes still protect ordering and reconstruction.
      for(const part of entry.parts){const bytes=await fetchBytes(part.url);if(bytes.byteLength!==part.bytes||await abortable(archiveSHA256(bytes),loadingSignal)!==part.sha256)throw new Error(`Archive ${phase} part byte length or SHA256 mismatch`);transfer.set(new Uint8Array(bytes),offset);offset+=bytes.byteLength;onProgress?.({phase:`parts-${phase}`,bytes:offset,totalBytes:total});checkAbort(loadingSignal);}
    }else transfer=await fetchBytes(entry.url);
    if (compressed && transfer.byteLength !== entry.transferBytes) throw new Error(`Archive ${phase} transfer byte length mismatch`);
    if (compressed && await abortable(archiveSHA256(transfer), loadingSignal) !== entry.transferSha256) throw new Error(`Archive ${phase} transfer SHA256 mismatch; serve the stored gzip file bytes unchanged`);
    const bytes = compressed ? await decompressGzip(transfer, entry.bytes, { signal: loadingSignal, onProgress, phase }) : transfer;
    if (entry.bytes !== undefined && bytes.byteLength !== entry.bytes) throw new Error(`Archive ${phase} byte length mismatch`);
    if (await abortable(archiveSHA256(bytes), loadingSignal) !== entry.sha256) throw new Error(`Archive ${phase} ${compressed ? 'decompressed ' : ''}SHA256 mismatch`);
    onProgress?.({ phase, bytes: bytes.byteLength }); checkAbort(loadingSignal); return bytes;
  };
  try {
    const [metadataBytes, glb] = await Promise.all([read(descriptor.runtime, 'runtime-metadata'), read(descriptor.glb, 'model-transfer')]);
    checkAbort(loadingSignal); const metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
    if (metadata.glb.sha256 !== descriptor.glb.sha256 || descriptor.id && descriptor.id !== metadata.id) throw new Error('Archive descriptor identity mismatch');
    return await restoreYuanmingyuanArchive(glb, metadata, { signal: loadingSignal, onProgress, yieldControl });
  } catch (error) { controller.abort(error); throw error; }
  finally { signal?.removeEventListener('abort', forwardAbort); }
}
