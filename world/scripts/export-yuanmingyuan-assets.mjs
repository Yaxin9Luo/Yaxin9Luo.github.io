#!/usr/bin/env node
import { readFile, writeFile, mkdir, access, rename, rm, stat, open, copyFile, statfs } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import sharp from 'sharp';
import { ARCHIVE_MATERIAL_TYPES, ARCHIVE_NODE_TYPES, YUANMINGYUAN_ARCHIVE_SCHEMA, YUANMINGYUAN_ARCHIVE_MAX_PARTS, archiveValue, restoreArchiveValue, inspectArchiveGLB, restoreYuanmingyuanArchive } from '../src/yuanmingyuan/asset-archive.js';

const world = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(world, '..');
const publicArchiveRoot = resolve(world, 'public/assets/yuanmingyuan'), maximumPublicTransferBytes = 96 * 1024 * 1024;
const transportVersion = 'gzip-bin-v2';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytesOf = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
const own = (object, keys) => Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, archiveValue(object[key])]));
const NODE_PROPERTIES = ['name', 'up', 'position', 'quaternion', 'scale', 'matrix', 'matrixWorld', 'matrixAutoUpdate', 'matrixWorldAutoUpdate', 'visible', 'castShadow', 'receiveShadow', 'frustumCulled', 'renderOrder', 'userData', 'pivot'];
const TEXTURE_PROPERTIES = ['name', 'mapping', 'channel', 'wrapS', 'wrapT', 'wrapR', 'magFilter', 'minFilter', 'anisotropy', 'format', 'internalFormat', 'type', 'offset', 'repeat', 'center', 'rotation', 'matrixAutoUpdate', 'matrix', 'generateMipmaps', 'premultiplyAlpha', 'flipY', 'unpackAlignment', 'colorSpace', 'compareFunction', 'userData'];
const MATERIAL_OMIT = new Set(['id', 'uuid', 'type', 'version', '_listeners']);
const semantic = name => ({ uv: 'TEXCOORD_0', uv1: 'TEXCOORD_1', uv2: 'TEXCOORD_2', uv3: 'TEXCOORD_3', color: 'COLOR_0', skinIndex: 'JOINTS_0', skinWeight: 'WEIGHTS_0' }[name] ?? (/^(position|normal|tangent)$/.test(name) ? name.toUpperCase() : '_' + name.toUpperCase()));

export const yuanmingyuanExportFactories = {
  yuanyingguan: ['yuanyingguan-study.js', 'createYuanyingguanStudy'], xieqiqu: ['xieqiqu-study.js', 'createXieqiquStudy'],
  haiyantang: ['haiyantang-study.js', 'createHaiyantangStudy'], fangwaiguan: ['fangwaiguan-study.js', 'createFangwaiguanStudy'],
  huanghuazhen: ['huanghuazhen-study.js', 'createHuanghuazhenStudy'], yangquelong: ['yangquelong-study.js', 'createYangquelongStudy'],
  xianfashan: ['xianfa-landscape-study.js', 'createXianfashanStudy'], 'fanghe-xianfahua': ['xianfa-landscape-study.js', 'createFangheXianfahuaStudy'], xianfaqiao: ['xianfa-landscape-study.js', 'createXianfaqiaoStudy'],
  fanghu: ['fuhai-palaces.js', 'createFanghuStudy'], pengdao: ['fuhai-palaces.js', 'createPengdaoStudy'], vegetation: ['garden-vegetation.js', 'createGardenVegetationStudy'],
  zhengjuesi: ['zhengjuesi-study.js', 'createZhengjuesiStudy'],
};

/** Captures exact source state. Object ids and renderer-version counters are
 * intentionally not serialized; all retained objects have new runtime owners. */
export function captureYuanmingyuanState(asset) {
  if (!asset?.group?.isObject3D) throw new Error('A factory asset with group is required');
  const state = { buffers: [], attributes: [], geometries: [], images: [], textures: [], materials: [], nodes: [], root: 0, diagnostics: archiveValue(asset.diagnostics ?? {}) };
  const objects = { buffers: [], attributes: [], geometries: [], images: [], textures: [], materials: [], nodes: [] }, maps = Object.fromEntries(Object.keys(objects).map(key => [key, new Map()]));
  const record = (table, object, make) => { if (maps[table].has(object)) return maps[table].get(object); const id = state[table].length; maps[table].set(object, id); state[table].push(null); objects[table].push(object); state[table][id] = make(); return id; };
  const buffer = array => record('buffers', array, () => {
    if (!ArrayBuffer.isView(array) || !['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array'].includes(array.constructor.name)) throw new Error('Unsupported source typed array; no implicit conversion permitted');
    return { arrayType: array.constructor.name, length: array.length, byteLength: array.byteLength, sha256: hash(bytesOf(array)) };
  });
  const attribute = a => record('attributes', a, () => {
    if (a.isInterleavedBufferAttribute || !a.isBufferAttribute) throw new Error('Interleaved attributes require a separately verified exact adapter');
    return { buffer: buffer(a.array), itemSize: a.itemSize, normalized: a.normalized, name: a.name, usage: a.usage, gpuType: a.gpuType, updateRanges: archiveValue(a.updateRanges), instanced: !!a.isInstancedBufferAttribute, ...(a.isInstancedBufferAttribute ? { meshPerAttribute: a.meshPerAttribute } : {}) };
  });
  const geometry = g => record('geometries', g, () => {
    if (Object.keys(g.morphAttributes).length || g.isInstancedBufferGeometry) throw new Error('Morph or custom instanced geometry requires a verified archive adapter');
    return { attributes: Object.fromEntries(Object.entries(g.attributes).map(([key, value]) => [key, attribute(value)])), index: g.index ? attribute(g.index) : null, properties: own(g, ['name', 'groups', 'drawRange', 'boundingBox', 'boundingSphere', 'userData']) };
  });
  const texture = t => record('textures', t, () => {
    if (!t.isDataTexture || t.format !== THREE.RGBAFormat || t.type !== THREE.UnsignedByteType || !(t.image?.data instanceof Uint8Array || t.image?.data instanceof Uint8ClampedArray) || t.mipmaps.length) throw new Error(`Texture ${t.name}: only real RGBA8 DataTexture inputs are currently verified; no canvas substitution, resize or quantization`);
    const image = record('images', t.source, () => ({ buffer: buffer(t.image.data), width: t.image.width, height: t.image.height }));
    if (t.image.data.length !== t.image.width * t.image.height * 4) throw new Error('Invalid source RGBA byte count');
    return { image, properties: own(t, TEXTURE_PROPERTIES) };
  });
  const material = m => record('materials', m, () => {
    if (!ARCHIVE_MATERIAL_TYPES.includes(m.type) || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) throw new Error(`Unsupported source material or shader callback: ${m.name}/${m.type}`);
    const properties = {}, slots = {};
    for (const [key, value] of Object.entries(m)) {
      if (MATERIAL_OMIT.has(key) || value === undefined) continue;
      if (value?.isTexture) slots[key] = texture(value);
      else properties[key] = archiveValue(value);
    }
    return { type: m.type, properties, textures: slots };
  });
  const node = object => record('nodes', object, () => {
    if (!ARCHIVE_NODE_TYPES.includes(object.type) || object.isSkinnedMesh || object.morphTargetInfluences?.length || object.morphTexture) throw new Error(`Unsupported source node: ${object.type}`);
    for (const key of ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow']) if (object[key] !== THREE.Object3D.prototype[key]) throw new Error(`Custom ${key} callback requires a verified archive adapter`);
    const item = { type: object.isInstancedMesh ? 'InstancedMesh' : object.type, properties: own(object, NODE_PROPERTIES), layers: object.layers.mask, rotationOrder: object.rotation.order, children: object.children.map(node) };
    if (object.isMesh) {
      item.geometry = geometry(object.geometry); item.material = Array.isArray(object.material) ? object.material.map(material) : material(object.material);
      for (const key of ['customDepthMaterial', 'customDistanceMaterial']) item[key] = object[key] ? material(object[key]) : null;
    }
    if (object.isInstancedMesh) { item.instanceMatrix = attribute(object.instanceMatrix); item.instanceColor = object.instanceColor ? attribute(object.instanceColor) : null; item.count = object.count; item.properties.boundingBox = archiveValue(object.boundingBox); item.properties.boundingSphere = archiveValue(object.boundingSphere); }
    return item;
  });
  state.root = node(asset.group); return { state, objects, maps };
}

function textureAnimations(asset, captured) {
  if (typeof asset.update !== 'function') return [];
  const bindings = new Map();
  for (const material of captured.objects.materials) if (material.userData.category === 'water') {
    const role = material.userData.role, slots = role === 'surface' ? ['normalMap', 'clearcoatNormalMap'] : role === 'flow' ? ['normalMap', 'alphaMap'] : [];
    for (const slot of slots) if (material[slot]) {
      const id = captured.maps.textures.get(material[slot]);
      if (bindings.has(id) && bindings.get(id).role !== role) throw new Error('A texture cannot have conflicting animation roles');
      bindings.set(id, { kind: 'fountain-texture-offset-v1', texture: id, role });
    }
  }
  const baseline = JSON.stringify(captured.state);
  try {
    for (const time of [.75, 2.75, 37.5, 150, -2]) {
      asset.update(time);
      const probe = captureYuanmingyuanState(asset).state;
      for (const binding of bindings.values()) {
        const expected = restoreArchiveValue(captured.state.textures[binding.texture].properties.offset).toArray();
        if (binding.role === 'surface') { expected[0] = time * .008 % 1; expected[1] = time * .005 % 1; } else expected[1] = -time * .72 % 1;
        const actual = probe.textures[binding.texture]?.properties.offset.data;
        if (!actual || JSON.stringify(actual) !== JSON.stringify(expected.map(archiveValue))) throw new Error('Source update does not match the versioned fountain texture animation');
        probe.textures[binding.texture].properties.offset = captured.state.textures[binding.texture].properties.offset;
      }
      if (JSON.stringify(probe) !== baseline) throw new Error('Source update changes state outside the verified fountain texture bindings');
    }
  } finally { asset.update(0); }
  return [...bindings.values()];
}

// Scoped, real-pixel implementation of exactly the exporter operations used by
// this pinned Three revision. It refuses resampling and always encodes PNG.
class PixelCanvas {
  constructor(width = 0, height = 0) { this.width = width; this.height = height; this.data = null; this.flip = false; }
  pixels() { if (!this.data || this.data.length !== this.width * this.height * 4) this.data = new Uint8ClampedArray(this.width * this.height * 4); return this.data; }
  getContext() {
    const canvas = this;
    return {
      fillStyle: '#000000', translate() {}, scale(x, y) { if (x !== 1 || y !== -1) throw new Error('Unsupported exporter canvas transform'); canvas.flip = !canvas.flip; },
      fillRect() { const color = this.fillStyle === '#00ffff' ? [0, 255, 255, 255] : this.fillStyle === '#000000' ? [0, 0, 0, 255] : null; if (!color) throw new Error('Unsupported exporter canvas fill'); for (let i = 0; i < canvas.pixels().length; i += 4) canvas.data.set(color, i); },
      getImageData() { return { data: canvas.pixels().slice(), width: canvas.width, height: canvas.height }; },
      putImageData(image) { if (image.width !== canvas.width || image.height !== canvas.height) throw new Error('Exporter requested pixel resampling'); canvas.data = new Uint8ClampedArray(image.data); },
      drawImage(image) { const data = image.data ?? image.pixels?.(); if (!data || image.width !== canvas.width || image.height !== canvas.height) throw new Error('Exporter requested unavailable pixels or resampling'); canvas.data = new Uint8ClampedArray(data); },
    };
  }
  async convertToBlob({ type = 'image/png' } = {}) {
    if (type !== 'image/png') throw new Error('Lossy image encoding is disabled');
    let image = sharp(Buffer.from(this.pixels()), { raw: { width: this.width, height: this.height, channels: 4 } }); if (this.flip) image = image.flip();
    return new Blob([await image.png().toBuffer()], { type });
  }
}

let exporting = false;
async function standardGLB(group, candidates, warnings) {
  if (exporting) throw new Error('Archive exports must run serially'); exporting = true;
  const keys = ['OffscreenCanvas', 'ImageData', 'FileReader'], previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), oldWarn = console.warn;
  try {
    globalThis.OffscreenCanvas = PixelCanvas; globalThis.ImageData = class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
    globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onload?.(); this.onloadend?.(); }, error => this.onerror?.(error)); } };
    console.warn = (...args) => warnings.push(args.map(String).join(' '));
    const exporter = new GLTFExporter().register(writer => ({
      writeMesh(mesh, definition) {
        for (const [name, a] of Object.entries(mesh.geometry.attributes)) if (!candidates.has(a.array)) candidates.set(a.array, definition.primitives[0]?.attributes[semantic(name)]);
        if (mesh.geometry.index && definition.primitives.length === 1) candidates.set(mesh.geometry.index.array, definition.primitives[0].indices);
      },
    }));
    return new Uint8Array(await exporter.parseAsync(group, { binary: true, onlyVisible: false, maxTextureSize: Infinity, includeCustomExtensions: true }));
  } finally {
    console.warn = oldWarn; keys.forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]); else delete globalThis[key]; }); exporting = false;
  }
}

function glbChunks(json, binaryParts, byteLength) {
  json.buffers[0].byteLength = byteLength;
  const encoded = Buffer.from(JSON.stringify(json)), paddedJSON = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(paddedJSON);
  const binLength = Math.ceil(byteLength / 4) * 4, header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJSON.length + binLength, 8); header.writeUInt32LE(paddedJSON.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(binLength, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return [header, paddedJSON, binHeader, ...binaryParts, Buffer.alloc(binLength - byteLength)];
}

function countState(captured) {
  let meshes = 0, triangles = 0, storedTriangles = 0, instances = 0;
  for (const geometry of captured.objects.geometries) storedTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
  for (const object of captured.objects.nodes) if (object.isMesh) { meshes++; const n = object.isInstancedMesh ? object.count : 1; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * n; instances += object.isInstancedMesh ? n : 0; }
  return { meshes, triangles, storedTriangles, instances, geometries: captured.state.geometries.length, materials: captured.state.materials.length, textures: captured.state.textures.length, nodes: captured.state.nodes.length };
}

function observeDisposal(group) {
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), instancedMeshes: new Set() }, listeners = new Map();
  group.traverse(object => {
    if (object.geometry) resources.geometries.add(object.geometry);
    if (object.isInstancedMesh) resources.instancedMeshes.add(object);
    for (const material of [object.material, object.customDepthMaterial, object.customDistanceMaterial].flat().filter(Boolean)) {
      resources.materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.textures.add(value);
    }
  });
  for (const set of Object.values(resources)) for (const object of set) {
    const record = { count: 0, listener: () => { record.count++; } }; listeners.set(object, record); object.addEventListener('dispose', record.listener);
  }
  return () => {
    for (const [object, record] of listeners) object.removeEventListener('dispose', record.listener);
    const counts = Object.fromEntries(Object.entries(resources).map(([key, set]) => [key, set.size]));
    const failures = [...listeners.values()].filter(record => record.count !== 1);
    if (failures.length) throw new Error(`Owned resource disposal count differed from one: ${failures.length} of ${listeners.size}`);
    return { ...counts, resources: listeners.size, eachDisposedExactlyOnce: true };
  };
}

/** Standard GLB plus exact original buffers and runtime metadata. The standard
 * GLB material subset alone is not the visual-equivalence contract. */
async function prepareArchiveParts(asset, { id, sourceSHA256 = {}, validateSource } = {}) {
  if (!/^[a-z][a-z0-9-]{0,70}$/.test(id ?? '')) throw new Error('One stable lowercase asset id is required');
  asset.update?.(0); asset.group.updateMatrixWorld(true);
  const captured = captureYuanmingyuanState(asset);
  validateSource?.(captured, countState(captured));
  const animations = textureAnimations(asset, captured), candidates = new Map(), warnings = [];
  const original = await standardGLB(asset.group, candidates, warnings), { json, binary } = inspectArchiveGLB(original), parts = [binary]; let length = binary.length, reused = 0, appended = 0;
  json.asset.extras = { ...json.asset.extras, yuanmingyuanArchiveId: id, runtimeSidecarRequired: true };
  const componentTypes = { Int8Array: 5120, Uint8Array: 5121, Uint16Array: 5123, Int16Array: 5122, Uint32Array: 5125, Int32Array: 5124, Float32Array: 5126 };
  const runtimeBuffers = captured.state.buffers.map((record, i) => {
    const source = captured.objects.buffers[i], index = candidates.get(source), accessor = json.accessors?.[index], bv = accessor && json.bufferViews[accessor.bufferView], offset = accessor?.byteOffset ?? 0;
    // Metadata reads the contiguous byte range directly. A GLTF bufferView may
    // declare a tight stride; reuse still requires equality of every raw byte.
    const canReuse = accessor && !accessor.sparse && accessor.componentType === componentTypes[record.arrayType] && offset + source.byteLength <= bv.byteLength && Buffer.from(binary.buffer, binary.byteOffset + (bv.byteOffset ?? 0) + offset, source.byteLength).equals(Buffer.from(source.buffer, source.byteOffset, source.byteLength));
    if (canReuse) { reused += source.byteLength; return { ...record, bufferView: accessor.bufferView, byteOffset: offset }; }
    const padding = (4 - length % 4) % 4; if (padding) { parts.push(Buffer.alloc(padding)); length += padding; }
    const bufferView = json.bufferViews.length; json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: source.byteLength }); parts.push(bytesOf(source)); length += source.byteLength; appended += source.byteLength;
    return { ...record, bufferView, byteOffset: 0 };
  });
  const chunks = glbChunks(json, parts, length), metadata = { schema: YUANMINGYUAN_ARCHIVE_SCHEMA, kind: 'yuanmingyuan-runtime-archive', threeRevision: THREE.REVISION, id, sourceSHA256, ...captured.state, buffers: runtimeBuffers, animations, verification: { mode: 'exact-source-buffers-and-Three-runtime-state', compression: 'none; PNG only for standard preview image layer', quantized: false, simplified: false, geometryReordered: false, sourceBuffersReusedBytes: reused, originalBytesAppended: appended, standardExporterWarnings: warnings, counts: countState(captured), nativeVisualReview: false } };
  if (JSON.stringify(captureYuanmingyuanState(asset).state) !== JSON.stringify(captured.state)) throw new Error('Exporter mutated the original factory state');
  return { chunks, metadata, captured };
}

export async function serializeYuanmingyuanArchive(asset, options = {}) {
  const { chunks, metadata, captured } = await prepareArchiveParts(asset, options), glb = Buffer.concat(chunks);
  // Keep the existing serialized field order and public API unchanged.
  const verification = metadata.verification; delete metadata.verification;
  metadata.glb = { sha256: hash(glb), bytes: glb.length }; metadata.verification = verification;
  let restored, disposal;
  try {
    restored = await restoreYuanmingyuanArchive(glb, metadata);
    disposal = observeDisposal(restored.group);
    if (JSON.stringify(captureYuanmingyuanState(restored).state) !== JSON.stringify(captured.state)) throw new Error('Exact roundtrip changed buffers, pixels, materials, graph or classification');
    for (const time of [2.75, 150, -2]) {
      asset.update?.(time); restored.update(time);
      if (JSON.stringify(captureYuanmingyuanState(restored).state) !== JSON.stringify(captureYuanmingyuanState(asset).state)) throw new Error('Restored update differs from original factory update');
    }
  } finally { asset.update?.(0); restored?.dispose(); if (disposal) metadata.verification.restoredResourceDisposal = disposal(); }
  metadata.verification.exactRoundtripPassed = true;
  return { glb, metadata, runtime: Buffer.from(JSON.stringify(metadata, null, 2) + '\n') };
}

const stagedSchema = 'yuanmingyuan-source-witness-v1';
const stagedTimes = [.75, 2.75, 37.5, 150, -2];
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const stateSHA = value => hash(JSON.stringify(value));
const checkSignal = signal => { if (signal?.aborted) throw signal.reason ?? new DOMException('Archive operation aborted', 'AbortError'); };
async function hashFile(path) { const digest = createHash('sha256'); for await (const bytes of createReadStream(path)) digest.update(bytes); return digest.digest('hex'); }

/** Phase A consumes this one source owner, writes one GLB without the final
 * Buffer.concat copy, and exits with an UNVERIFIED candidate. No restore here.
 * The pinned standard exporter still has its own buffers/Blob allocations. */
export async function writeYuanmingyuanArchiveSource(asset, { id, sourceSHA256 = {}, outputDirectory, maximumGLBBytes = 0xffffffff, validateSource, beforeCommit, signal, onProgress } = {}) {
  let temporary, created = false, committed = false, disposed = false, observe;
  const started = performance.now(), memoryBefore = process.memoryUsage();
  try {
    observe = observeDisposal(asset.group); checkSignal(signal);
    if (typeof outputDirectory !== 'string' || !outputDirectory || !Number.isSafeInteger(maximumGLBBytes) || maximumGLBBytes < 1 || maximumGLBBytes > 0xffffffff) throw new Error('A private output directory and finite GLB byte ceiling are required');
    const output = resolve(outputDirectory), publicDirectory = resolve(world, 'public');
    if (output === publicDirectory || output.startsWith(publicDirectory + '/')) throw new Error('Unverified raw archives cannot be written inside public');
    try { await access(output); throw new Error(`Candidate directory already exists: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    temporary = `${output}.pending-${process.pid}`; await mkdir(dirname(output), { recursive: true }); await mkdir(temporary); created = true;
    onProgress?.({ phase: 'candidate-pending', directory: temporary }); checkSignal(signal);
    asset.update?.(0); asset.group.updateMatrixWorld(true);
    const sourceState = captureYuanmingyuanState(asset).state, samples = [];
    // These hashes come from running the actual source owner, independently of
    // the serialized animation table and independently of the runtime decoder.
    try { for (const time of stagedTimes) { checkSignal(signal); asset.update?.(time); const state = captureYuanmingyuanState(asset).state; samples.push({ time, stateSHA256: stateSHA(state), textures: state.textures }); } }
    finally { asset.update?.(0); }
    const witness = { schema: stagedSchema, id, sourceSHA256, producerProcessId: process.pid, state: sourceState, stateSHA256: stateSHA(sourceState), samples };
    const { chunks, metadata, captured } = await prepareArchiveParts(asset, { id, sourceSHA256, validateSource });
    if (JSON.stringify(captured.state) !== JSON.stringify(sourceState)) throw new Error('Source changed between independent witness capture and GLB preparation');
    const bytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    if (bytes > maximumGLBBytes) throw new Error(`GLB ${bytes} exceeds this job's ${maximumGLBBytes} byte ceiling`);
    const glbName = `${id}.glb`, glbPath = join(temporary, glbName), file = await open(glbPath, 'wx'), digest = createHash('sha256'); let written = 0;
    try {
      for (const chunk of chunks) for (let start = 0; start < chunk.length; start += 8 * 1024 * 1024) {
        checkSignal(signal); const part = chunk.subarray(start, Math.min(chunk.length, start + 8 * 1024 * 1024)); let offset = 0;
        while (offset < part.length) { const result = await file.write(part, offset, part.length - offset); if (!result.bytesWritten) throw new Error('GLB write made no progress'); offset += result.bytesWritten; }
        digest.update(part); written += part.length; onProgress?.({ phase: 'write-glb', bytes: written, totalBytes: bytes });
      }
      await file.sync();
    } finally { await file.close(); }
    const sha256 = digest.digest('hex');
    if (written !== bytes || await hashFile(glbPath) !== sha256) throw new Error('Written GLB differs from source chunks');
    metadata.glb = { sha256, bytes };
    const runtime = jsonBytes(metadata), witnessBytes = jsonBytes(witness), runtimeName = `${id}.runtime.candidate.json`, witnessName = 'source-witness.json';
    await writeFile(join(temporary, runtimeName), runtime, { flag: 'wx' }); await writeFile(join(temporary, witnessName), witnessBytes, { flag: 'wx' });
    if (stateSHA(captureYuanmingyuanState(asset).state) !== witness.stateSHA256) throw new Error('Source changed while writing the candidate');
    await beforeCommit?.(); checkSignal(signal);
    disposed = true; asset.dispose(); const sourceResourceDisposal = observe();
    const candidate = { schema: stagedSchema, id, status: 'source-written-independent-restore-pending', sourceDigest: stateSHA(sourceSHA256), sourceSHA256, exportedAt: new Date().toISOString(), producerProcessId: process.pid, glb: { url: glbName, sha256, bytes }, runtime: { url: runtimeName, sha256: hash(runtime), bytes: runtime.length }, witness: { url: witnessName, sha256: hash(witnessBytes), bytes: witnessBytes.length }, verification: metadata.verification, sourceResourceDisposal, sourceDiagnosticsAcceptance: asset.diagnostics?.visualAcceptance ?? false, memoryBytes: { before: memoryBefore, afterSourceDisposal: process.memoryUsage() }, maxRSSBytes: process.resourceUsage().maxRSS * 1024, elapsedMilliseconds: performance.now() - started };
    await writeFile(join(temporary, 'candidate.json'), jsonBytes(candidate), { flag: 'wx' }); checkSignal(signal);
    await rename(temporary, output); committed = true;
    onProgress?.({ phase: 'source-disposed', sourceResourceDisposal, output }); return { output, candidate };
  } finally {
    try { if (!disposed) { disposed = true; asset?.dispose(); if (observe) onProgress?.({ phase: 'failure-source-disposed', sourceResourceDisposal: observe() }); } }
    finally { if (created && !committed) await rm(temporary, { recursive: true, force: true }); }
  }
}

/** Phase B must run in another process. It has no factory parameter: restored
 * objects must match the separately captured source state, pixels and samples.
 * Only this phase creates a packable manifest; A's candidate files stay intact. */
export async function verifyYuanmingyuanArchiveSource({ archiveDirectory, signal, onProgress } = {}) {
  const review = resolve(archiveDirectory), candidatePath = join(review, 'candidate.json'), candidateBytes = await readFile(candidatePath), candidate = JSON.parse(candidateBytes);
  const { id } = candidate, started = performance.now(); checkSignal(signal);
  if (candidate.schema !== stagedSchema || candidate.status !== 'source-written-independent-restore-pending' || !/^[a-z][a-z0-9-]{0,70}$/.test(id ?? '') || candidate.sourceDigest !== stateSHA(candidate.sourceSHA256) || candidate.producerProcessId === process.pid || !Number.isInteger(candidate.producerProcessId) || candidate.sourceResourceDisposal?.eachDisposedExactlyOnce !== true) throw new Error('Independent verification requires a disposed source candidate from a different process');
  const manifestPath = join(review, 'manifest.json'), runtimePath = join(review, `${id}.runtime.json`);
  for (const path of [manifestPath, runtimePath]) { try { await access(path); throw new Error(`Verified output already exists: ${path}`); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const verificationLock=join(review,'.verification.pending');await mkdir(verificationLock);
  try {
  onProgress?.({phase:'verification-pending',directory:verificationLock});checkSignal(signal);
  const readEntry = async (entry, name) => {
    if (entry?.url !== name || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) throw new Error(`Invalid candidate entry ${name}`);
    const bytes = await readFile(join(review, name)); checkSignal(signal);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error(`Candidate SHA256 or byte length changed: ${name}`); return bytes;
  };
  const witness = JSON.parse(await readEntry(candidate.witness, 'source-witness.json')), metadata = JSON.parse(await readEntry(candidate.runtime, `${id}.runtime.candidate.json`));
  if (witness.schema !== stagedSchema || witness.id !== id || witness.producerProcessId !== candidate.producerProcessId || JSON.stringify(witness.sourceSHA256) !== JSON.stringify(candidate.sourceSHA256) || witness.stateSHA256 !== stateSHA(witness.state) || JSON.stringify(metadata.sourceSHA256) !== JSON.stringify(witness.sourceSHA256) || metadata.id !== id || JSON.stringify(witness.samples?.map(s => s.time)) !== JSON.stringify(stagedTimes)) throw new Error('Independent source witness identity or state is invalid');
  const glb = await readEntry(candidate.glb, `${id}.glb`); let restored, observe, restoredResourceDisposal, success = false;
  const runtimeTemporary = runtimePath + `.pending-${process.pid}`, manifestTemporary = manifestPath + `.pending-${process.pid}`; let runtimeWritten = false, manifestWritten = false, runtimeCommitted = false;
  try {
    restored = await restoreYuanmingyuanArchive(glb, metadata, { signal, onProgress }); observe = observeDisposal(restored.group);
    const state = captureYuanmingyuanState(restored).state;
    for (const table of new Set([...Object.keys(witness.state), ...Object.keys(state)])) if (JSON.stringify(state[table]) !== JSON.stringify(witness.state[table])) throw new Error(`Independent source witness mismatch: ${table}`);
    for (const sample of witness.samples) { checkSignal(signal); restored.update(sample.time); const actual = captureYuanmingyuanState(restored).state; if (stateSHA(actual) !== sample.stateSHA256 || JSON.stringify(actual.textures) !== JSON.stringify(sample.textures)) throw new Error(`Independent source animation witness mismatch at ${sample.time}`); }
    const restoredCounts = countState(captureYuanmingyuanState(restored));
    if (JSON.stringify(restoredCounts) !== JSON.stringify(candidate.verification?.counts) || JSON.stringify(restoredCounts) !== JSON.stringify(metadata.verification?.counts)) throw new Error('Independent restored counts differ from the candidate');
    restored.dispose(); restored.dispose(); restoredResourceDisposal = observe(); observe = null;
    if (hash(await readFile(candidatePath)) !== hash(candidateBytes) || await hashFile(join(review, candidate.glb.url)) !== candidate.glb.sha256 || await hashFile(join(review, candidate.runtime.url)) !== candidate.runtime.sha256 || await hashFile(join(review, candidate.witness.url)) !== candidate.witness.sha256) throw new Error('Candidate files changed during independent verification');
    checkSignal(signal);
    metadata.verification = { ...metadata.verification, exactRoundtripPassed: true, restoredResourceDisposal, independentSourceWitness: { sha256: candidate.witness.sha256, sourceProcessId: candidate.producerProcessId, verifierProcessId: process.pid, baselineStateSHA256: witness.stateSHA256, actualSourceSampleTimes: stagedTimes } };
    const runtime = jsonBytes(metadata), manifest = { schema: 1, id, exportedAt: candidate.exportedAt, sourceDigest: candidate.sourceDigest, sourceSHA256: candidate.sourceSHA256, glb: candidate.glb, runtime: { url: `${id}.runtime.json`, sha256: hash(runtime), bytes: runtime.length }, verification: metadata.verification, nativeArchiveVisualReview: false, sourceDiagnosticsAcceptance: candidate.sourceDiagnosticsAcceptance, sourceResourceDisposal: candidate.sourceResourceDisposal, stagedExport: { candidateSHA256: hash(candidateBytes), sourceProcessId: candidate.producerProcessId, verifierProcessId: process.pid, sourceCandidateRetained: true, sourceMaxRSSBytes: candidate.maxRSSBytes, verifierMaxRSSBytes: process.resourceUsage().maxRSS * 1024, elapsedVerificationMilliseconds: performance.now() - started } };
    await writeFile(runtimeTemporary, runtime, { flag: 'wx' }); runtimeWritten = true;
    await writeFile(manifestTemporary, jsonBytes(manifest), { flag: 'wx' }); manifestWritten = true; checkSignal(signal);
    await rename(runtimeTemporary, runtimePath); runtimeCommitted = true; await rename(manifestTemporary, manifestPath); success = true;
    return { output: review, manifest };
  } finally {
    restored?.dispose(); if (observe) onProgress?.({ phase: 'failure-restored-disposed', restoredResourceDisposal: observe() });
    if (!success) { if (runtimeWritten) await rm(runtimeTemporary, { force: true }); if (manifestWritten) await rm(manifestTemporary, { force: true }); if (runtimeCommitted) await rm(runtimePath, { force: true }); }
  }
  } finally { await rm(verificationLock,{recursive:true,force:true}); }
}

/** Matches the browser prepareVegetationTexturePixels contract: full RGBA,
 * lower-left origin, verified encoded source and decoded pixel provenance. */
export async function prepareVegetationExportInputs({ textureRoot = resolve(world, 'public') } = {}) {
  const { vegetationBarkSource, validateVegetationTexturePixels } = await import('../src/yuanmingyuan/vegetation-textures.js');
  const texturePixels = {}, sourceFiles = [], encodedSources = {}, pixelProvenance = {};
  for (const [channel, source] of Object.entries(vegetationBarkSource.files)) {
    const file = resolve(textureRoot, '.' + source.path), encoded = await readFile(file), encodedSha256 = hash(encoded);
    if (encodedSha256 !== source.sha256) throw new Error(`Vegetation source WebP SHA256 mismatch: ${channel}`);
    const { data, info } = await sharp(encoded).flip().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== vegetationBarkSource.width || info.height !== vegetationBarkSource.height || info.channels !== 4) throw new Error(`Vegetation source pixel dimensions or channels differ: ${channel}`);
    const decodedSha256 = hash(data);
    texturePixels[channel] = Object.freeze({ data: new Uint8Array(data), width: info.width, height: info.height, channels: 4, origin: 'lower-left', encodedSha256, decodedSha256 });
    sourceFiles.push(file); encodedSources[relative(repo, file)] = encodedSha256;
    pixelProvenance[channel] = { path: source.path, width: info.width, height: info.height, channels: 4, origin: 'lower-left', encodedSha256, decodedSha256 };
  }
  validateVegetationTexturePixels(texturePixels);
  return { factoryOptions: { texturePixels: Object.freeze(texturePixels) }, sourceFiles, encodedSources, pixelProvenance, decoder: { implementation: 'sharp', version: sharp.versions.sharp, webpVersion: sharp.versions.webp, operation: 'full-size decode, vertical flip, RGBA output; no resize or generated replacement' } };
}

export async function prepareXianfashanExportInputs() {
  const {readXianfashanTexturePixels}=await import('./prepare-xianfashan-texture-pixels.mjs');
  const {xianfashanTextureSources}=await import('../src/yuanmingyuan/xianfashan-materials.js');
  const texturePixels=await readXianfashanTexturePixels(),sourceFiles=[],encodedSources={},pixelProvenance={};
  for(const [name,source]of Object.entries(xianfashanTextureSources))for(const [channel,file]of Object.entries(source.files)){
    const path=resolve(world,'public','.'+file.path),entry=texturePixels[name][channel];sourceFiles.push(path);encodedSources[relative(repo,path)]=entry.encodedSha256;
    pixelProvenance[`${name}/${channel}`]={path:file.path,width:entry.width,height:entry.height,channels:4,origin:entry.origin,encodedSha256:entry.encodedSha256,decodedSha256:entry.decodedSha256};
  }
  return {factoryOptions:{texturePixels},sourceFiles,encodedSources,pixelProvenance,decoder:{implementation:'sharp',version:sharp.versions.sharp,webpVersion:sharp.versions.webp,operation:'full-size decode, vertical flip, RGBA output; no resize or generated replacement'}};
}

async function sourceGraph(start, extraFiles = []) {
  const seen = new Map();
  async function visit(file) {
    if (seen.has(file)) return; const bytes = await readFile(file); seen.set(file, hash(bytes));
    if (!/\.[cm]?js$/.test(file)) return;
    const text = bytes.toString();
    for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier === 'three' || specifier.startsWith('three/') ? fileURLToPath(import.meta.resolve(specifier)) : null;
      if (!target) continue;
      if (!target.startsWith(world + '/')) throw new Error(`Source dependency escapes world: ${target}`); await visit(target);
    }
  }
  await visit(start); await visit(fileURLToPath(import.meta.url));
  for (const file of extraFiles) await visit(file);
  for (const file of ['package.json', 'package-lock.json', 'node_modules/three/package.json', 'node_modules/three/build/three.module.js', 'node_modules/three/examples/jsm/exporters/GLTFExporter.js']) await visit(resolve(world, file));
  return Object.fromEntries([...seen].map(([file, sha256]) => [relative(repo, file), sha256]).sort(([a], [b]) => a.localeCompare(b)));
}
export { sourceGraph as captureYuanmingyuanArchiveSources };

/** Produces only gzip transport files in public. The unchanged raw review
 * archive remains separate; this operation never imports a source factory. */
export async function packYuanmingyuanArchive({ id, archiveDirectory, publicRoot = publicArchiveRoot, partBytes = 64 * 1024 * 1024, scratchRoot, minimumPublicFreeBytes = 0, signal, onProgress }) {
  if(!Number.isSafeInteger(partBytes)||partBytes<1||partBytes>=maximumPublicTransferBytes)throw new Error('Archive part size must be a positive integer below the publication ceiling');
  if(!Number.isSafeInteger(minimumPublicFreeBytes)||minimumPublicFreeBytes<0)throw new Error('Publication free-space reserve must be a nonnegative byte count');
  checkSignal(signal);
  const review = resolve(archiveDirectory), sourceManifestBytes = await readFile(join(review, 'manifest.json')), source = JSON.parse(sourceManifestBytes);
  if (!/^[a-z][a-z0-9-]{0,70}$/.test(id ?? '') || source.id !== id || !/^[a-f0-9]{64}$/.test(source.sourceDigest ?? '')) throw new Error('Existing archive identity or source digest is invalid');
  if (source.verification?.exactRoundtripPassed !== true) throw new Error('Only a review archive with a verified exact roundtrip can be packed for public transport');
  const producerPath = fileURLToPath(import.meta.url), runtimePath = resolve(world, 'src/yuanmingyuan/asset-archive.js');
  const producerSHA256 = hash(await readFile(producerPath)), runtimeDecoderSHA256 = hash(await readFile(runtimePath));
  const versionDirectory = source.sourceDigest.slice(0, 16) + '-' + transportVersion, output = resolve(publicRoot, id, versionDirectory);
  try { await access(output); throw new Error(`Transport directory already exists; existing bytes are preserved: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${output}.pending-${process.pid}`; await mkdir(dirname(output), { recursive: true }); await mkdir(temporary); let success = false, scratchCreated = false;
  const scratch = scratchRoot ? resolve(scratchRoot, `${id}-${source.sourceDigest.slice(0,16)}.pending-${process.pid}`) : temporary;
  try {
    onProgress?.({phase:'public-pending',directory:temporary});
    if(scratchRoot){await mkdir(dirname(scratch),{recursive:true});await mkdir(scratch);scratchCreated=true;onProgress?.({phase:'gzip-scratch-pending',directory:scratch});}
    const entries = {};
    for (const kind of ['glb', 'runtime']) {
      const entry = source[kind], name = kind === 'glb' ? `${id}.glb` : `${id}.runtime.json`;
      if (entry?.url !== name || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) throw new Error(`Invalid raw review archive entry: ${kind}`);
      const transportName = name + '.gzip.bin', destination = join(scratch, transportName), originalHash = createHash('sha256'); let originalBytes = 0;
      const observe = new Transform({ transform(chunk, encoding, done) { originalHash.update(chunk); originalBytes += chunk.length; done(null, chunk); } });
      await pipeline(createReadStream(join(review, name)), observe, createGzip({ level: 9 }), createWriteStream(destination, { flags: 'wx' }), {signal});
      if (originalBytes !== entry.bytes || originalHash.digest('hex') !== entry.sha256) throw new Error(`Raw review archive SHA256 or byte length changed: ${kind}`);
      const transferBytes = (await stat(destination)).size;
      const partCount = Math.ceil(transferBytes / partBytes);
      if (partCount > YUANMINGYUAN_ARCHIVE_MAX_PARTS) throw new Error(`Archive ${kind} requires ${partCount} parts; maximum is ${YUANMINGYUAN_ARCHIVE_MAX_PARTS}. Increase partBytes to at least ${Math.ceil(transferBytes / YUANMINGYUAN_ARCHIVE_MAX_PARTS)}.`);
      const transferHash = createHash('sha256'); for await (const chunk of createReadStream(destination)) transferHash.update(chunk);
      const decodedHash = createHash('sha256'); let decodedBytes = 0;
      for await (const chunk of Readable.toWeb(createReadStream(destination)).pipeThrough(new DecompressionStream('gzip'))) { checkSignal(signal); decodedHash.update(chunk); decodedBytes += chunk.byteLength; }
      if (decodedBytes !== entry.bytes || decodedHash.digest('hex') !== entry.sha256) throw new Error(`Gzip decompression changed raw archive bytes: ${kind}`);
      entries[kind] = { url: transportName, compression: 'gzip', sha256: entry.sha256, bytes: entry.bytes, transferSha256: transferHash.digest('hex'), transferBytes };
      onProgress?.({phase:'gzip-verified',kind,bytes:transferBytes,sourceBytes:entry.bytes});checkSignal(signal);
    }
    if(minimumPublicFreeBytes){const disk=await statfs(temporary),available=disk.bavail*disk.bsize,needed=Object.values(entries).reduce((sum,entry)=>sum+entry.transferBytes,0)+minimumPublicFreeBytes;if(available<needed)throw new Error(`Publication needs ${needed} available bytes including reserve; only ${available} remain`);}
    // Check both compressed entry counts before creating any part files.
    for (const kind of ['glb', 'runtime']) {
      const entry = entries[kind], name = kind === 'glb' ? `${id}.glb` : `${id}.runtime.json`, destination = join(scratch, entry.url), transferBytes = entry.transferBytes;
      if(transferBytes>partBytes){
        const parts=[],joinedHash=createHash('sha256');let joinedBytes=0;
        for await(const chunk of createReadStream(destination,{highWaterMark:partBytes})){
          checkSignal(signal);
          const url=`${name}.part-${String(parts.length+1).padStart(3,'0')}.gzip.bin`,path=join(temporary,url);
          await writeFile(path,chunk,{flag:'wx'});const stored=await readFile(path);
          if(stored.length!==chunk.length||hash(stored)!==hash(chunk))throw new Error(`Archive part write mismatch: ${url}`);
          joinedHash.update(stored);joinedBytes+=stored.length;parts.push({url,bytes:stored.length,sha256:hash(stored)});
        }
        if(joinedBytes!==transferBytes||joinedHash.digest('hex')!==entries[kind].transferSha256)throw new Error(`Archive part concatenation mismatch: ${kind}`);
        delete entries[kind].url;entries[kind].parts=parts;await rm(destination);
      }else if(scratchRoot){checkSignal(signal);await copyFile(destination,join(temporary,entry.url),1);if(await hashFile(join(temporary,entry.url))!==entry.transferSha256)throw new Error(`Copied gzip SHA256 differs: ${kind}`);}
    }
    if (hash(await readFile(producerPath)) !== producerSHA256 || hash(await readFile(runtimePath)) !== runtimeDecoderSHA256) throw new Error('Transport producer or runtime source changed during packing');
    const manifest = { ...source, schema: 2, ...entries, transport: { version: transportVersion, encoding: 'gzip', filenameSuffix: '.gzip.bin', lossless: true, rawArchiveRetained: true, maximumFileBytesExclusive: maximumPublicTransferBytes, sourceManifestSHA256: hash(sourceManifestBytes), producerSHA256, runtimeDecoderSHA256, decompressedBytesVerified: true }, nativeArchiveVisualReview: false };
    await writeFile(join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); checkSignal(signal); await rename(temporary, output); success = true;
    return { output, manifestURL: resolve(publicRoot) === publicArchiveRoot ? `/assets/yuanmingyuan/${id}/${versionDirectory}/manifest.json` : null, manifest };
  } finally { try { if (!success) await rm(temporary, { recursive: true, force: true }); } finally { if (scratchCreated) await rm(scratch, {recursive:true,force:true}); } }
}

export async function exportOneYuanmingyuanAsset({ id, outputDirectory, publicRoot }) {
  if (!yuanmingyuanExportFactories[id]) throw new Error(`Unknown single asset id: ${id}`);
  const inputs = id === 'vegetation' ? await prepareVegetationExportInputs() : id === 'xianfashan' ? await prepareXianfashanExportInputs() : { sourceFiles: [] };
  const [file, name] = yuanmingyuanExportFactories[id], modulePath = resolve(world, 'src/yuanmingyuan', file), sourceSHA256 = await sourceGraph(modulePath, inputs.sourceFiles), digest = hash(Buffer.from(JSON.stringify(sourceSHA256)));
  for (const [path, expected] of Object.entries(inputs.encodedSources ?? {})) if (sourceSHA256[path] !== expected) throw new Error(`Asset source changed after pixel decoding: ${path}`);
  const output = resolve(outputDirectory ?? resolve(repo, 'work/yuanmingyuan/asset-archives', id, digest.slice(0, 16)));
  if (output === resolve(world, 'public') || output.startsWith(resolve(world, 'public') + '/')) throw new Error('Raw review archives must stay outside public; only verified gzip transports may be written there');
  try { await access(output); throw new Error(`Export directory already exists; choose a new directory: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${output}.pending-${process.pid}`; await mkdir(dirname(output), { recursive: true }); await mkdir(temporary);
  const started = performance.now(), memoryBefore = process.memoryUsage(); let asset, success = false, sourceDisposed = false;
  try {
    const module = await import(pathToFileURL(modulePath)); asset = module[name](inputs.factoryOptions);
    const disposal = observeDisposal(asset.group), memoryAfterConstruction = process.memoryUsage();
    const archive = await serializeYuanmingyuanArchive(asset, { id, sourceSHA256 });
    if (JSON.stringify(await sourceGraph(modulePath, inputs.sourceFiles)) !== JSON.stringify(sourceSHA256)) throw new Error('Source bytes changed during export');
    const memoryAfterRoundtrip = process.memoryUsage(); sourceDisposed = true; asset.dispose(); const sourceResourceDisposal = disposal();
    const manifest = { schema: 1, id, exportedAt: new Date().toISOString(), sourceDigest: digest, sourceSHA256, ...(inputs.pixelProvenance ? { sourcePixels: inputs.pixelProvenance, sourcePixelDecoder: inputs.decoder } : {}), glb: { url: `${id}.glb`, sha256: hash(archive.glb), bytes: archive.glb.length }, runtime: { url: `${id}.runtime.json`, sha256: hash(archive.runtime), bytes: archive.runtime.length }, verification: archive.metadata.verification, nativeArchiveVisualReview: false, sourceDiagnosticsAcceptance: asset.diagnostics?.visualAcceptance ?? false, sourceResourceDisposal, memoryBytes: { before: memoryBefore, afterConstruction: memoryAfterConstruction, afterRoundtrip: memoryAfterRoundtrip, afterSourceDisposal: process.memoryUsage(), note: 'dispose events release renderer ownership; CPU arrays remain reachable until process exit or collection' }, elapsedMilliseconds: performance.now() - started };
    await writeFile(join(temporary, `${id}.glb`), archive.glb); await writeFile(join(temporary, `${id}.runtime.json`), archive.runtime); await writeFile(join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await rename(temporary, output); success = true;
    const transport = await packYuanmingyuanArchive({ id, archiveDirectory: output, publicRoot }); return { output, manifest, transport };
  } finally {
    try { if (!sourceDisposed) asset?.dispose(); }
    finally { if (!success) await rm(temporary, { recursive: true, force: true }); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('Usage: node scripts/export-yuanmingyuan-assets.mjs --id <one-id> [--output <new-review-directory>] [--public-root <directory>]\nCompress an existing review without a factory: --id <one-id> --pack-existing <review-directory>\nIds: ' + Object.keys(yuanmingyuanExportFactories).join(', ') + '\nFull factories require the separately coordinated exclusive CPU slot.');
  else {
    try {
      const options = {};
      for (let i = 0; i < args.length; i += 2) { if (!['--id', '--output', '--pack-existing', '--public-root'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('Supply one --id and documented path flags, with no repeated flags'); options[args[i]] = args[i + 1]; }
      if (!options['--id']) throw new Error('Exactly one --id is required; no implicit all-factory export');
      if (options['--pack-existing'] && options['--output']) throw new Error('--pack-existing reads its review directory and cannot be combined with --output');
      console.log(JSON.stringify(await (options['--pack-existing'] ? packYuanmingyuanArchive({ id: options['--id'], archiveDirectory: options['--pack-existing'], publicRoot: options['--public-root'] }) : exportOneYuanmingyuanAsset({ id: options['--id'], outputDirectory: options['--output'], publicRoot: options['--public-root'] })), null, 2));
    } catch (error) { console.error(error.stack); process.exitCode = 1; }
  }
}
