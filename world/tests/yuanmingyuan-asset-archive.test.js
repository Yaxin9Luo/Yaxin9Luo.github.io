import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createServer as createHTTPServer } from 'node:http';
import { promises as fsPromises } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createServer } from 'vite';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { createFountainWater } from '../src/yuanmingyuan/yuanyingguan-geometry.js';
import { captureYuanmingyuanState, serializeYuanmingyuanArchive, packYuanmingyuanArchive, prepareVegetationExportInputs } from '../scripts/export-yuanmingyuan-assets.mjs';
import { vegetationBarkSource, pineBarkTextures } from '../src/yuanmingyuan/vegetation-textures.js';
import { inspectArchiveGLB, loadYuanmingyuanArchive, restoreYuanmingyuanArchive } from '../src/yuanmingyuan/asset-archive.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quick = () => Promise.resolve();
function specimen() {
  const group = new THREE.Group(); group.name = 'small exact archive fixture'; group.position.set(1.25, 2.7, -3.1); group.rotation.set(.1, .2, .3, 'ZYX'); group.scale.set(-1, 1.5, .75); group.userData = { category: 'architecture', museumEntryId: 'test-courtyard', nativeVisualReview: false };
  const geometry = new THREE.BufferGeometry(); geometry.name = 'indexed winding and nonunit normals';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute([17, 93, 227, 255, 133, 57, 5, 31, 113, 1, 203, 44], 3, true));
  geometry.setIndex(new THREE.Uint16BufferAttribute([0, 1, 2, 2, 1, 3, 0, 0, 1], 1));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); geometry.attributes.position.addUpdateRange(3, 3);
  geometry.addGroup(0, 6, 0); geometry.addGroup(6, 3, 1); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData = { category: 'stone', retainDegenerateTriangle: true };
  const water = createFountainWater('archive-fixture');
  const pixels = new Uint8Array([11, 72, 203, 0, 255, 2, 49, 1, 13, 124, 5, 201, 209, 19, 111, 255]);
  const map = new THREE.DataTexture(pixels, 2, 2); map.name = 'real coloured transparent pixels'; map.colorSpace = THREE.SRGBColorSpace; map.flipY = true; map.wrapS = THREE.MirroredRepeatWrapping; map.wrapT = THREE.RepeatWrapping; map.repeat.set(2.25, .75); map.offset.set(.12, -.07); map.rotation = .13; map.center.set(.4, .7); map.channel = 1; map.needsUpdate = true;
  const roughness = map.clone(); roughness.name = 'shared source independent texture'; roughness.colorSpace = THREE.NoColorSpace; roughness.flipY = false;
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(.3123456789, .087654321, .5123456), map, roughnessMap: roughness, metalness: .43, roughness: .71, transmission: .37, thickness: .123, ior: 1.41, attenuationColor: new THREE.Color(.89, .76, .56), attenuationDistance: Infinity, transparent: true, opacity: .83, depthWrite: false, side: THREE.DoubleSide, shadowSide: THREE.BackSide, normalMap: water.surface.normalMap, normalScale: new THREE.Vector2(.17, .29), alphaTest: .07, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: 1, vertexColors: true });
  material.name = 'stone physical surface'; material.userData = { category: 'stone', finish: 'real-pixel-fixture' };
  const mesh = new THREE.Mesh(geometry, [material, water.surface]); mesh.name = 'multimaterial stone'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.renderOrder = 4; mesh.layers.set(3); mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map, alphaTest: .07, side: THREE.DoubleSide }); group.add(mesh);
  const jetGeometry = new THREE.BufferGeometry(); jetGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .05, .5, 0, 0, 1, .1], 3)); jetGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, .5, 0, 1], 2)); jetGeometry.computeVertexNormals();
  const jet = new THREE.Mesh(jetGeometry, water.flow); jet.name = 'water jet'; jet.userData = { category: 'water', waterContact: { target: 'basin', y: 2.7 } }; jet.matrixAutoUpdate = false; jet.matrix.makeShear(.1, 0, 0, .2, 0, 0); group.add(jet);
  const hidden = new THREE.Mesh(jetGeometry, material); hidden.name = 'hidden retained triangles'; hidden.visible = false; hidden.frustumCulled = false; hidden.matrixWorldAutoUpdate = false; hidden.matrixWorld.makeTranslation(7, 8, 9); group.add(hidden);
  const instanced = new THREE.InstancedMesh(geometry, material, 3); instanced.name = 'three real instances'; instanced.castShadow = true;
  for (let i = 0; i < 3; i++) { instanced.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(i * 1.1, i * .4, -i), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * .3), new THREE.Vector3(1 + i * .1, 1, .8))); instanced.setColorAt(i, new THREE.Color(.1 + i * .2, .8 - i * .17, .3)); }
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage); instanced.instanceMatrix.addUpdateRange(16, 16); instanced.computeBoundingBox(); instanced.computeBoundingSphere(); group.add(instanced);
  group.updateMatrixWorld(true);
  const diagnostics = { assetId: 'tiny-archive', materialClasses: ['stone', 'water'], visualAcceptance: false, waterContacts: [{ flow: 'water jet', surfaceY: 2.7 }], bounds: { unknown: null } };
  const dispose = () => { const captured = captureYuanmingyuanState({ group }); for (const key of ['geometries', 'materials', 'textures']) for (const object of captured.objects[key]) object.dispose(); instanced.dispose(); group.clear(); };
  return { group, diagnostics, update: water.update, dispose };
}

let fixture, archive, baseline;
before(async () => {
  fixture = specimen(); fixture.update(0); baseline = captureYuanmingyuanState(fixture).state;
  archive = await serializeYuanmingyuanArchive(fixture, { id: 'tiny-archive', sourceSHA256: { 'fixture-source': sha('exact genuine Three fixture') } });
  console.log('ARCHIVE_FIXTURE_METRICS ' + JSON.stringify({ glbBytes: archive.glb.length, runtimeBytes: archive.runtime.length, glbSHA256: sha(archive.glb), runtimeSHA256: sha(archive.runtime), ...archive.metadata.verification }));
});
after(() => fixture?.dispose());

test('standard GLB is parseable and exact sidecar retains every original triangle, byte and classification', async t => {
  assert.equal(archive.metadata.verification.exactRoundtripPassed, true); assert.equal(archive.metadata.verification.quantized, false); assert.equal(archive.metadata.verification.simplified, false); assert.equal(archive.metadata.verification.nativeVisualReview, false);
  assert.ok(archive.metadata.verification.sourceBuffersReusedBytes >= 100, 'unchanged tight-stride attributes reuse original GLB bytes'); assert.ok(archive.metadata.verification.originalBytesAppended > 0, 'raw image pixels and exporter-normalized source normals retain their exact bytes');
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(archive.glb);
  assert.ok(document.getRoot().listMeshes().length >= 3); assert.ok(document.getRoot().listNodes().some(node => node.getName() === 'hidden retained triangles'));
  const result = await restoreYuanmingyuanArchive(archive.glb, archive.metadata, { yieldControl: quick }); t.after(result.dispose);
  assert.deepEqual(captureYuanmingyuanState(result).state, baseline); assert.deepEqual(captureYuanmingyuanState(fixture).state, baseline);
  assert.equal(archive.metadata.verification.counts.triangles, 14); assert.equal(archive.metadata.verification.counts.storedTriangles, 4); assert.equal(archive.metadata.verification.counts.instances, 3);
  const mesh = result.group.getObjectByName('multimaterial stone'), material = mesh.material[0], jet = result.group.getObjectByName('water jet');
  assert.deepEqual([...mesh.geometry.index.array], [0, 1, 2, 2, 1, 3, 0, 0, 1]); assert.deepEqual([...mesh.geometry.attributes.normal.array], [0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2]);
  assert.deepEqual([...material.map.image.data], [11, 72, 203, 0, 255, 2, 49, 1, 13, 124, 5, 201, 209, 19, 111, 255]);
  assert.equal(material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(material.map.flipY, true); assert.equal(material.roughnessMap.colorSpace, THREE.NoColorSpace); assert.equal(material.roughnessMap.source, material.map.source);
  assert.deepEqual(material.normalScale.toArray(), [.17, .29]); assert.deepEqual(material.color.toArray(), [.3123456789, .087654321, .5123456]); assert.equal(material.transmission, .37); assert.equal(material.thickness, .123); assert.equal(material.attenuationDistance, Infinity); assert.equal(material.depthWrite, false); assert.equal(material.side, THREE.DoubleSide); assert.equal(material.shadowSide, THREE.BackSide);
  assert.equal(mesh.castShadow, true); assert.equal(mesh.receiveShadow, true); assert.equal(mesh.layers.mask, 8); assert.equal(mesh.renderOrder, 4); assert.equal(mesh.customDepthMaterial.map, material.map); assert.equal(jet.material.userData.category, 'water'); assert.equal(result.group.rotation.order, 'ZYX');
  assert.equal(result.group.getObjectByName('hidden retained triangles').visible, false); assert.equal(jet.geometry.index, null); assert.deepEqual(mesh.geometry.attributes.position.updateRanges, [{ start: 3, count: 3 }]);
});

test('restored fountain texture animation matches the frozen production water lifecycle including wrapping and invalid times', async t => {
  const result = await restoreYuanmingyuanArchive(archive.glb, archive.metadata, { yieldControl: quick }); t.after(() => { result.dispose(); fixture.update(0); });
  assert.equal(archive.metadata.animations.length, 3);
  for (const time of [0, .125, 2.75, 150, -2, Infinity, NaN]) {
    fixture.update(time); result.update(time); assert.deepEqual(captureYuanmingyuanState(result).state, captureYuanmingyuanState(fixture).state);
  }
  const surface = result.group.getObjectByName('multimaterial stone').material[1], flow = result.group.getObjectByName('water jet').material;
  assert.equal(surface.normalMap, surface.clearcoatNormalMap); assert.equal(flow.normalMap.offset.y, flow.alphaMap.offset.y); assert.deepEqual(flow.normalScale.toArray(), [.2, .3]);
});

test('separate loads own geometry, texture pixels, materials and instance attributes; dispose releases each object once', async t => {
  const first = await restoreYuanmingyuanArchive(archive.glb, archive.metadata, { yieldControl: quick }), second = await restoreYuanmingyuanArchive(archive.glb, archive.metadata, { yieldControl: quick }); t.after(() => { first.dispose(); second.dispose(); });
  const a = first.group.getObjectByName('multimaterial stone'), b = second.group.getObjectByName('multimaterial stone'), instanced = first.group.getObjectByName('three real instances');
  assert.equal(instanced.geometry, a.geometry); assert.equal(instanced.material, a.material[0]); assert.notEqual(a.geometry, b.geometry); assert.notEqual(a.material[0], b.material[0]); assert.notEqual(a.material[0].map.image.data, b.material[0].map.image.data);
  a.geometry.attributes.position.array[0] = 97; a.material[0].map.image.data[0] = 219; a.material[0].transmission = .02; instanced.instanceMatrix.array[12] = 55;
  assert.deepEqual(captureYuanmingyuanState(second).state, baseline); assert.deepEqual(captureYuanmingyuanState(fixture).state, baseline);
  const objects = captureYuanmingyuanState(first).objects, events = new Map();
  for (const resource of [...objects.geometries, ...objects.materials, ...objects.textures, instanced]) { events.set(resource, 0); resource.addEventListener('dispose', () => events.set(resource, events.get(resource) + 1)); }
  first.dispose(); first.dispose(); first.update(10); assert.equal(first.group.children.length, 0); assert.ok([...events.values()].every(count => count === 1));
  assert.equal(first.archive.resourceOwnership.instancedMeshes, 1); assert.equal(first.archive.resourceOwnership.moduleGlobalCache, false);
});

test('manifest loading verifies both hashes, performs two requests and never imports a courtyard factory', async t => {
  const calls = [], descriptor = { id: 'tiny-archive', glb: { url: '/fixture.glb', sha256: sha(archive.glb) }, runtime: { url: '/fixture.runtime.json', sha256: sha(archive.runtime) } };
  const fetchImpl = async (url, options) => { calls.push({ url, signal: options.signal }); return new Response(url.endsWith('.glb') ? archive.glb : archive.runtime); };
  const result = await loadYuanmingyuanArchive(descriptor, { fetchImpl, yieldControl: quick }); t.after(result.dispose);
  assert.deepEqual(captureYuanmingyuanState(result).state, baseline); assert.equal(calls.length, 2);
  await assert.rejects(loadYuanmingyuanArchive({ ...descriptor, runtime: { ...descriptor.runtime, sha256: '0'.repeat(64) } }, { fetchImpl }), /runtime-metadata SHA256 mismatch/);
  await assert.rejects(loadYuanmingyuanArchive({ ...descriptor, id: 'wrong-asset' }, { fetchImpl }), /identity mismatch/);
  await assert.rejects(loadYuanmingyuanArchive(descriptor, { fetchImpl: async () => new Response('missing', { status: 404 }) }), /HTTP 404/);
});

test('abort before loading or during an uncooperative fetch rejects without publishing a late scene', async () => {
  const descriptor = { glb: { url: '/fixture.glb', sha256: sha(archive.glb) }, runtime: { url: '/fixture.runtime.json', sha256: sha(archive.runtime) } };
  const already = new AbortController(); already.abort(); let calls = 0;
  await assert.rejects(loadYuanmingyuanArchive(descriptor, { signal: already.signal, fetchImpl: async () => { calls++; } }), { name: 'AbortError' }); assert.equal(calls, 0);
  const controller = new AbortController(), pending = loadYuanmingyuanArchive(descriptor, { signal: controller.signal, fetchImpl: () => { calls++; return new Promise(() => {}); } });
  await Promise.resolve(); controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(restoreYuanmingyuanArchive(archive.glb, archive.metadata, { signal: already.signal }), { name: 'AbortError' });
});

test('abort after resource construction disposes all allocated geometry, material and texture resources', async () => {
  for (const boundary of ['restore-materials', 'ready']) {
    const controller = new AbortController(), events = [], originals = [];
    for (const Type of [THREE.BufferGeometry, THREE.Material, THREE.Texture, THREE.InstancedMesh]) {
      const original = Type.prototype.dispose; originals.push([Type, original]); Type.prototype.dispose = function () { events.push(this); return original.call(this); };
    }
    try {
      await assert.rejects(restoreYuanmingyuanArchive(archive.glb, archive.metadata, { signal: controller.signal, onProgress: ({ phase }) => { if (phase === boundary) controller.abort(); }, yieldControl: quick }), { name: 'AbortError' });
    } finally { for (const [Type, original] of originals) Type.prototype.dispose = original; }
    const expected = archive.metadata.geometries.length + archive.metadata.materials.length + archive.metadata.textures.length + (boundary === 'ready' ? 1 : 0);
    assert.equal(events.length, expected); assert.equal(new Set(events).size, expected);
  }
});

test('a failed metadata request cancels its sibling GLB download', async () => {
  const descriptor = { glb: { url: '/fixture.glb', sha256: sha(archive.glb) }, runtime: { url: '/fixture.runtime.json', sha256: sha(archive.runtime) } }; let transferSignal;
  await assert.rejects(loadYuanmingyuanArchive(descriptor, { fetchImpl: async (url, { signal }) => {
    if (url.endsWith('.glb')) { transferSignal = signal; return new Promise(() => {}); }
    return new Response('missing', { status: 404 });
  } }), /HTTP 404/);
  assert.equal(transferSignal.aborted, true);
});

test('an unknown factory update is rejected before an archive is returned', async () => {
  const asset = specimen(), jet = asset.group.getObjectByName('water jet'), original = asset.update;
  asset.update = time => { original(time); jet.position.x = time; };
  try { await assert.rejects(serializeYuanmingyuanArchive(asset, { id: 'unverified-animation' }), /changes state outside/); }
  finally { asset.dispose(); }
});

test('corruption, mismatched revisions, missing pixels and unknown animation contracts fail explicitly', async () => {
  const bytes = Buffer.from(archive.glb); bytes[bytes.length - 1] ^= 1; await assert.rejects(restoreYuanmingyuanArchive(bytes, archive.metadata), /GLB SHA256 mismatch/);
  for (const [change, pattern] of [
    [m => { m.threeRevision = '0'; }, /differs from runtime/],
    [m => { m.id = 'wrong-id'; }, /identities differ/],
    [m => { m.buffers[0].sha256 = '0'.repeat(64); }, /Original buffer SHA256 mismatch/],
    [m => { m.buffers[0].byteOffset = -1; }, /Invalid archived typed buffer/],
    [m => { m.images[0].width += 1; }, /Invalid original RGBA pixels/],
    [m => { m.animations[0].kind = 'unverified-motion'; }, /Unsupported archived animation/],
  ]) { const metadata = structuredClone(archive.metadata); change(metadata); await assert.rejects(restoreYuanmingyuanArchive(archive.glb, metadata, { yieldControl: quick }), pattern); }
  assert.equal(inspectArchiveGLB(archive.glb).json.asset.extras.runtimeSidecarRequired, true);
});

test('unsupported shaders and pixel formats cannot silently replace real source content', () => {
  const group = new THREE.Group(), geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const shader = new THREE.ShaderMaterial(), material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(geometry, shader); group.add(mesh);
  try {
    assert.throws(() => captureYuanmingyuanState({ group }), /Unsupported source material/); mesh.material = material;
    material.map = new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
    assert.throws(() => captureYuanmingyuanState({ group }), /only real RGBA8 DataTexture/);
  } finally { material.map.dispose(); geometry.dispose(); material.dispose(); shader.dispose(); }
});

test('single-ID CLI help and invalid arguments finish before any production factory can be selected', () => {
  const script = new URL('../scripts/export-yuanmingyuan-assets.mjs', import.meta.url);
  const help = spawnSync(process.execPath, [script.pathname, '--help'], { encoding: 'utf8' }); assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /one-id/);
  const empty = spawnSync(process.execPath, [script.pathname], { encoding: 'utf8' }); assert.equal(empty.status, 1); assert.match(empty.stderr, /Exactly one --id/);
  const unknown = spawnSync(process.execPath, [script.pathname, '--id', 'missing-fixture'], { encoding: 'utf8' }); assert.equal(unknown.status, 1); assert.match(unknown.stderr, /Unknown single asset id/);
});

test('vegetation exporter decodes all original WebP pixels into the required full-resolution lower-left contract', async t => {
  const inputs = await prepareVegetationExportInputs(), maps = pineBarkTextures(inputs.factoryOptions.texturePixels); t.after(() => Object.values(maps).forEach(texture => texture.dispose()));
  assert.equal(inputs.sourceFiles.length, 3);
  for (const [channel, entry] of Object.entries(inputs.factoryOptions.texturePixels)) {
    assert.equal(entry.width, 1024); assert.equal(entry.height, 1024); assert.equal(entry.channels, 4); assert.equal(entry.origin, 'lower-left'); assert.equal(entry.data.byteLength, 1024 * 1024 * 4);
    assert.equal(entry.encodedSha256, vegetationBarkSource.files[channel].sha256); assert.equal(entry.decodedSha256, sha(entry.data)); assert.equal(inputs.pixelProvenance[channel].decodedSha256, sha(entry.data));
    assert.equal(sha(await readFile(new URL('../public' + vegetationBarkSource.files[channel].path, import.meta.url))), entry.encodedSha256);
  }
  assert.equal(maps.map.colorSpace, THREE.SRGBColorSpace); assert.equal(maps.normalMap.colorSpace, THREE.NoColorSpace); assert.equal(maps.roughnessMap.colorSpace, THREE.NoColorSpace);
  assert.equal(maps.map.image.data, inputs.factoryOptions.texturePixels.color.data); assert.equal(maps.map.flipY, false);
  console.log('VEGETATION_EXPORT_PIXEL_PROVENANCE ' + JSON.stringify({ decoder: inputs.decoder, pixels: inputs.pixelProvenance }));
  const root = await mkdtemp(join(tmpdir(), 'yuanmingyuan-invalid-webp-')); t.after(() => rm(root, { recursive: true, force: true })); await mkdir(join(root, 'textures/pine-bark'), { recursive: true }); await writeFile(join(root, 'textures/pine-bark/color.webp'), 'not the source file');
  await assert.rejects(prepareVegetationExportInputs({ textureRoot: root }), /source WebP SHA256 mismatch/);
});

function compressedFixture() {
  const files = {}, descriptor = { id: 'tiny-archive' };
  for (const [kind, raw] of [['glb', archive.glb], ['runtime', archive.runtime]]) {
    const url = `/${kind}.gz`, compressed = gzipSync(raw); files[url] = compressed;
    descriptor[kind] = { url, compression: 'gzip', sha256: sha(raw), bytes: raw.length, transferSha256: sha(compressed), transferBytes: compressed.length };
  }
  return { descriptor, files, fetchImpl: async url => new Response(files[url]) };
}

test('gzip transport restores exact source state after verifying compressed and decompressed bytes', async t => {
  const { descriptor, fetchImpl } = compressedFixture(), progress = [];
  const result = await loadYuanmingyuanArchive(descriptor, { fetchImpl, onProgress: entry => progress.push(entry), yieldControl: quick }); t.after(result.dispose);
  assert.deepEqual(captureYuanmingyuanState(result).state, baseline);
  assert.ok(descriptor.glb.transferBytes < descriptor.glb.bytes); assert.ok(progress.some(entry => entry.phase === 'decompress-model-transfer' && entry.bytes === archive.glb.length));
});

test('gzip transport refuses changed transfer SHA, original SHA, decoded length and invalid gzip checksums', async () => {
  for (const [mutate, pattern] of [
    [({ descriptor }) => { descriptor.glb.transferSha256 = '0'.repeat(64); }, /transfer SHA256 mismatch/],
    [({ descriptor }) => { descriptor.glb.sha256 = '0'.repeat(64); }, /decompressed SHA256 mismatch/],
    [({ descriptor }) => { descriptor.glb.bytes -= 1; }, /decompressed byte length/],
    [({ descriptor }) => { descriptor.glb.transferBytes -= 1; }, /transfer byte length mismatch/],
    [({ descriptor }) => { descriptor.glb.compression = 'unverified-codec'; }, /Unsupported archive transfer compression/],
  ]) { const input = compressedFixture(); mutate(input); await assert.rejects(loadYuanmingyuanArchive(input.descriptor, { fetchImpl: input.fetchImpl }), pattern); }
  const input = compressedFixture(), bytes = input.files[input.descriptor.glb.url]; bytes[bytes.length - 8] ^= 1; input.descriptor.glb.transferSha256 = sha(bytes);
  await assert.rejects(loadYuanmingyuanArchive(input.descriptor, { fetchImpl: input.fetchImpl }));
});

test('cancelling gzip decompression does not construct or publish a scene', async () => {
  const input = compressedFixture(), controller = new AbortController(); let restored = false;
  await assert.rejects(loadYuanmingyuanArchive(input.descriptor, { fetchImpl: input.fetchImpl, signal: controller.signal, onProgress: ({ phase }) => { if (phase.startsWith('decompress-')) controller.abort(); if (phase === 'restore-materials') restored = true; } }), { name: 'AbortError' });
  assert.equal(restored, false);
});

test('existing-file packer preserves raw review files and publishes only verified gzip files with relative URLs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'yuanmingyuan-gzip-fixture-')); t.after(() => rm(root, { recursive: true, force: true }));
  const review = join(root, 'review'), publicRoot = join(root, 'public'); await mkdir(review);
  const source = { schema: 1, id: 'tiny-archive', sourceDigest: sha('fixture-source'), glb: { url: 'tiny-archive.glb', sha256: sha(archive.glb), bytes: archive.glb.length }, runtime: { url: 'tiny-archive.runtime.json', sha256: sha(archive.runtime), bytes: archive.runtime.length }, verification: archive.metadata.verification };
  await writeFile(join(review, source.glb.url), archive.glb); await writeFile(join(review, source.runtime.url), archive.runtime); await writeFile(join(review, 'manifest.json'), JSON.stringify(source));
  const packed = await packYuanmingyuanArchive({ id: source.id, archiveDirectory: review, publicRoot });
  assert.deepEqual((await readdir(packed.output)).sort(), ['manifest.json', 'tiny-archive.glb.gzip.bin', 'tiny-archive.runtime.json.gzip.bin']);
  assert.equal(packed.manifest.transport.rawArchiveRetained, true); assert.equal(packed.manifest.transport.decompressedBytesVerified, true); assert.equal(packed.manifest.schema, 2);
  assert.equal(sha(await readFile(join(review, source.glb.url))), source.glb.sha256); assert.equal(sha(await readFile(join(review, source.runtime.url))), source.runtime.sha256);
  const result = await loadYuanmingyuanArchive(packed.manifest, { fetchImpl: async url => new Response(await readFile(join(packed.output, url))), yieldControl: quick }); t.after(result.dispose);
  assert.deepEqual(captureYuanmingyuanState(result).state, baseline);
  // Use the actual project static server, not a fetch stub: Vite treats .gz as
  // HTTP content encoding and the client has already decoded it at arrayBuffer.
  const legacy = 'legacy-transport.glb.gz'; await writeFile(join(packed.output, legacy), await readFile(join(packed.output, packed.manifest.glb.url)));
  const server = await createServer({ configFile: false, root, publicDir: publicRoot, logLevel: 'silent', appType: 'custom', server: { host: '127.0.0.1', port: 0, preTransformRequests: false, watch: null } });
  try {
    await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}/`, directory = `${source.id}/${source.sourceDigest.slice(0, 16)}-${packed.manifest.transport.version}/`;
    const httpManifest = await (await fetch(new URL(directory + 'manifest.json', base))).json(), heads = {};
    for (const kind of ['glb', 'runtime']) {
      const url = new URL(directory + httpManifest[kind].url, base).href, head = await fetch(url, { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal(head.headers.get('content-encoding'), null);
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer()); assert.equal(bytes.length, httpManifest[kind].transferBytes); assert.equal(sha(bytes), httpManifest[kind].transferSha256);
      httpManifest[kind].url = url; heads[kind] = { status: head.status, contentEncoding: head.headers.get('content-encoding'), contentType: head.headers.get('content-type'), contentLength: head.headers.get('content-length'), getBytes: bytes.length, transferSHA256: sha(bytes) };
    }
    const actual = await loadYuanmingyuanArchive(httpManifest, { yieldControl: quick }); try { assert.deepEqual(captureYuanmingyuanState(actual).state, baseline); } finally { actual.dispose(); }
    const legacyURL = new URL(directory + legacy, base).href, legacyResponse = await fetch(legacyURL), legacyBytes = new Uint8Array(await legacyResponse.arrayBuffer());
    assert.equal(legacyResponse.status, 200); assert.equal(legacyResponse.headers.get('content-encoding'), 'gzip'); assert.equal(legacyBytes.length, archive.glb.length); assert.equal(sha(legacyBytes), sha(archive.glb));
    await assert.rejects(loadYuanmingyuanArchive({ ...httpManifest, glb: { ...httpManifest.glb, url: legacyURL } }, { yieldControl: quick }), /transfer byte length mismatch/);
    console.log('ARCHIVE_REAL_HTTP_FIXTURE ' + JSON.stringify({ binaryTransport: heads, legacyGzip: { contentEncoding: legacyResponse.headers.get('content-encoding'), browserVisibleBytes: legacyBytes.length, transferBytes: packed.manifest.glb.transferBytes }, exactRuntimeRestore: true }));
  } finally { await server.close(); }
  await assert.rejects(packYuanmingyuanArchive({ id: source.id, archiveDirectory: review, publicRoot }), /already exists/);
  await writeFile(join(review, source.glb.url), Buffer.from('changed archive'));
  const failureRoot = join(root, 'failed-public'); await assert.rejects(packYuanmingyuanArchive({ id: source.id, archiveDirectory: review, publicRoot: failureRoot }), /Raw review archive SHA256 or byte length changed/);
  assert.deepEqual(await readdir(join(failureRoot, source.id)), []);
});

async function splitFixture(t) {
  const root=await mkdtemp(join(tmpdir(),'yuanmingyuan-parts-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const review=join(root,'review');await mkdir(review);
  const source={schema:1,id:'tiny-archive',sourceDigest:sha('parts-source'),glb:{url:'tiny-archive.glb',sha256:sha(archive.glb),bytes:archive.glb.length},runtime:{url:'tiny-archive.runtime.json',sha256:sha(archive.runtime),bytes:archive.runtime.length},verification:archive.metadata.verification};
  await writeFile(join(review,source.glb.url),archive.glb);await writeFile(join(review,source.runtime.url),archive.runtime);await writeFile(join(review,'manifest.json'),JSON.stringify(source));
  const packed=await packYuanmingyuanArchive({id:source.id,archiveDirectory:review,publicRoot:join(root,'public'),partBytes:4096});
  const fetchImpl=async url=>new Response(await readFile(join(packed.output,url)));
  return {...packed,fetchImpl,root};
}

test('split gzip transport retains every original buffer and uses individually verified bounded files',async t=>{
  const p=await splitFixture(t);assert.ok(p.manifest.glb.parts.length>1);assert.equal(p.manifest.glb.url,undefined);
  for(const kind of ['glb','runtime']){const entry=p.manifest[kind];if(!entry.parts)continue;let total=0;const chunks=[];for(const part of entry.parts){assert.ok(part.bytes<=4096);const bytes=await readFile(join(p.output,part.url));assert.equal(bytes.length,part.bytes);assert.equal(sha(bytes),part.sha256);chunks.push(bytes);total+=bytes.length;}assert.equal(total,entry.transferBytes);assert.equal(sha(Buffer.concat(chunks)),entry.transferSha256);}
  const result=await loadYuanmingyuanArchive(p.manifest,{fetchImpl:p.fetchImpl,yieldControl:quick});t.after(result.dispose);assert.deepEqual(captureYuanmingyuanState(result).state,baseline);
  const {loadMuseumArchive}=await import('../src/yuanmingyuan/asset-source.js');
  const server=await createServer({configFile:false,root:p.root,publicDir:join(p.root,'public'),logLevel:'silent',appType:'custom',server:{host:'127.0.0.1',port:0,preTransformRequests:false,watch:null}});
  try{await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}/`,url=new URL(`${p.manifest.id}/${p.manifest.sourceDigest.slice(0,16)}-${p.manifest.transport.version}/manifest.json`,base);
    const native=await loadMuseumArchive(p.manifest.id,url.href,{baseURL:base,load:(d,options)=>loadYuanmingyuanArchive(d,{...options,yieldControl:quick})});try{assert.deepEqual(captureYuanmingyuanState(native).state,baseline);}finally{native.dispose();}
    const response=await fetch(new URL(p.manifest.glb.parts[0].url,url),{method:'HEAD'});assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),null);
  }finally{await server.close();}
});

test('split transport rejects missing, duplicate, reordered, corrupted and cross-origin parts',async t=>{
  const p=await splitFixture(t);
  for(const [mutate,pattern]of [
    [d=>d.glb.parts.pop(),/part byte totals/],
    [d=>{d.glb.parts[1].url=d.glb.parts[0].url;},/Invalid archive transfer part/],
    [d=>d.glb.parts.reverse(),/transfer SHA256 mismatch/],
    [d=>{d.glb.parts[0].sha256='0'.repeat(64);},/part byte length or SHA256/],
    [d=>{d.glb.url='ambiguous.gzip.bin';},/Invalid archive transfer parts/],
  ]){const d=structuredClone(p.manifest);mutate(d);await assert.rejects(loadYuanmingyuanArchive(d,{fetchImpl:p.fetchImpl}),pattern);}
  const {loadMuseumArchive}=await import('../src/yuanmingyuan/asset-source.js'),d=structuredClone(p.manifest);d.glb.parts[0].url='https://another.test/a';let loaded=false;
  await assert.rejects(loadMuseumArchive(d.id,'/manifest.json',{baseURL:'https://museum.test/',fetcher:async()=>new Response(JSON.stringify(d)),load:async()=>{loaded=true;}}),/share the exhibition origin/);assert.equal(loaded,false);
});

test('cancelling between transfer parts stops later requests without publishing geometry',async t=>{
  const p=await splitFixture(t),controller=new AbortController(),calls=[];let restored=false;
  await assert.rejects(loadYuanmingyuanArchive(p.manifest,{signal:controller.signal,fetchImpl:async url=>{calls.push(url);return p.fetchImpl(url);},onProgress:({phase})=>{if(phase==='parts-model-transfer')controller.abort();if(phase==='restore-materials')restored=true;}}),{name:'AbortError'});
  assert.ok(calls.includes(p.manifest.glb.parts[0].url));assert.equal(calls.includes(p.manifest.glb.parts[1].url),false);assert.equal(restored,false);
});

test('real HTTP v1 and v2 transports restore directly but refuse redirects without contacting a second origin',async t=>{
  const {loadMuseumArchive}=await import('../src/yuanmingyuan/asset-source.js');
  let files,manifestBytes,redirect=false,externalRequests=0;
  const external=createHTTPServer((request,response)=>{externalRequests++;response.writeHead(200,{'content-type':'application/octet-stream','access-control-allow-origin':'*'});response.end(files[request.url]);});
  const local=createHTTPServer((request,response)=>{
    if(request.url==='/manifest.json'){response.writeHead(200,{'content-type':'application/json'});response.end(manifestBytes);return;}
    if(!files[request.url]){response.writeHead(404);response.end();return;}
    if(redirect){response.writeHead(302,{location:`http://127.0.0.1:${external.address().port}${request.url}`});response.end();return;}
    response.writeHead(200,{'content-type':'application/octet-stream'});response.end(files[request.url]);
  });
  for(const server of [external,local]){
    t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  }
  const baseURL=`http://127.0.0.1:${local.address().port}/`;
  for(const version of ['gzip-bin-v1','gzip-bin-v2']){
    const input=compressedFixture();files=input.files;
    input.descriptor.transport={version};
    if(version==='gzip-bin-v2')for(const kind of ['glb','runtime']){
      const entry=input.descriptor[kind],bytes=files[entry.url];delete files[entry.url];delete entry.url;entry.parts=[];
      const size=Math.ceil(bytes.length/3);
      for(let offset=0;offset<bytes.length;offset+=size){const chunk=bytes.subarray(offset,offset+size),url=`/${kind}.part-${entry.parts.length+1}.gzip.bin`;files[url]=chunk;entry.parts.push({url,bytes:chunk.length,sha256:sha(chunk)});}
    }
    manifestBytes=JSON.stringify(input.descriptor);redirect=false;
    const options={baseURL,expectedManifestSHA256:sha(manifestBytes),load:(descriptor,options)=>loadYuanmingyuanArchive(descriptor,{...options,yieldControl:quick})};
    const direct=await loadMuseumArchive(input.descriptor.id,'/manifest.json',options);
    try{assert.deepEqual(captureYuanmingyuanState(direct).state,baseline);}finally{direct.dispose();}
    redirect=true;const signals=[];let restored=false;
    await assert.rejects(loadMuseumArchive(input.descriptor.id,'/manifest.json',{
      ...options,load:async(descriptor,options)=>{
        const owner=await loadYuanmingyuanArchive(descriptor,{...options,yieldControl:quick,fetchImpl:(url,options)=>{signals.push(options.signal);return fetch(url,options);},onProgress:({phase})=>{if(phase==='restore-materials')restored=true;}});
        t.after(owner.dispose);return owner;
      },
    }),{name:'TypeError'});
    assert.equal(externalRequests,0,`${version} must not request any redirected bytes`);
    assert.equal(restored,false);assert.equal(signals.length,2);assert.ok(signals.every(signal=>signal.aborted),'redirect failure cancels both sibling transfers');
  }
});

test('packer checks both 1024-part limits before writing parts and removes only its pending output on failure',async t=>{
  const root=await mkdtemp(join(tmpdir(),'yuanmingyuan-part-limit-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();group.add(new THREE.Mesh(geometry,material));
  const sourceAsset={group,diagnostics:{fixture:'second entry exceeds the protocol part limit'},dispose(){geometry.dispose();material.dispose();group.clear();}};
  t.after(sourceAsset.dispose);
  const tiny=await serializeYuanmingyuanArchive(sourceAsset,{id:'part-limit',sourceSHA256:{fixture:sha('part limit source')}});
  assert.ok(gzipSync(tiny.glb,{level:9}).length<=1024);assert.ok(gzipSync(tiny.runtime,{level:9}).length>1024,'only the second archive entry exceeds the part cap');
  const review=join(root,'review'),publicRoot=join(root,'public');await mkdir(review);
  const source={schema:1,id:'part-limit',sourceDigest:sha('part limit source'),glb:{url:'part-limit.glb',sha256:sha(tiny.glb),bytes:tiny.glb.length},runtime:{url:'part-limit.runtime.json',sha256:sha(tiny.runtime),bytes:tiny.runtime.length},verification:tiny.metadata.verification};
  const rawFiles={[source.glb.url]:tiny.glb,[source.runtime.url]:tiny.runtime,'manifest.json':Buffer.from(JSON.stringify(source))};
  for(const [name,bytes]of Object.entries(rawFiles))await writeFile(join(review,name),bytes);
  const old=await packYuanmingyuanArchive({id:source.id,archiveDirectory:review,publicRoot});
  const oldFiles={};for(const name of await readdir(old.output))oldFiles[name]=await readFile(join(old.output,name));
  const oldManifest=rawFiles['manifest.json'];source.sourceDigest=sha('new part limit source');rawFiles['manifest.json']=Buffer.from(JSON.stringify(source));await writeFile(join(review,'manifest.json'),rawFiles['manifest.json']);
  const originalWriteFile=fsPromises.writeFile;let partWrites=0;
  fsPromises.writeFile=async(path,...args)=>{
    if(/\.part-\d+\.gzip\.bin$/.test(String(path))){partWrites++;throw new Error('Part writing started before both entries passed the count preflight');}
    return originalWriteFile(path,...args);
  };
  syncBuiltinESMExports();
  try{await assert.rejects(packYuanmingyuanArchive({id:source.id,archiveDirectory:review,publicRoot,partBytes:1}),/Archive runtime requires \d+ parts; maximum is 1024/);}
  finally{fsPromises.writeFile=originalWriteFile;syncBuiltinESMExports();}
  assert.equal(partWrites,0,'no GLB or runtime part may be written before the second count passes');
  assert.deepEqual(await readdir(join(publicRoot,source.id)),[old.output.split('/').at(-1)],'the failed version and its pending directory are absent');
  for(const [name,bytes]of Object.entries(rawFiles))assert.deepEqual(await readFile(join(review,name)),bytes);
  for(const [name,bytes]of Object.entries(oldFiles))assert.deepEqual(await readFile(join(old.output,name)),bytes);
  assert.equal(JSON.parse(oldManifest).sourceDigest,old.manifest.sourceDigest);
});

test('the runtime restores exactly 1024 real compressed parts and rejects 1025 before fetching model bytes',async t=>{
  const input=compressedFixture(),entry=input.descriptor.glb,bytes=input.files[entry.url];
  delete input.files[entry.url];delete entry.url;entry.parts=[];
  const size=Math.floor(bytes.length/1024);assert.ok(size>0);
  for(let i=0;i<1024;i++){
    const chunk=bytes.subarray(i*size,i===1023?bytes.length:(i+1)*size),url=`/model-part-${i}.gzip.bin`;
    input.files[url]=chunk;entry.parts.push({url,bytes:chunk.length,sha256:sha(chunk)});
  }
  const owner=await loadYuanmingyuanArchive(input.descriptor,{fetchImpl:input.fetchImpl,yieldControl:quick});t.after(owner.dispose);
  assert.deepEqual(captureYuanmingyuanState(owner).state,baseline);
  entry.parts.push({...entry.parts[0],url:'/model-part-1024.gzip.bin'});let modelRequests=0;
  await assert.rejects(loadYuanmingyuanArchive(input.descriptor,{fetchImpl:async url=>{if(url.startsWith('/model-part-'))modelRequests++;return input.fetchImpl(url);}}),/Invalid archive transfer parts: model-transfer/);
  assert.equal(modelRequests,0);
});
