import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { configureWillowNormalOverride } from '../src/yuanmingyuan/willow-distance-rendering.js';
import { createWillowInstancedLevel, willowCoverageAt } from '../src/yuanmingyuan/willow-lod-runtime.js';
import { WILLOW_STUDIO_REVISION, WILLOW_HISTORICAL_REFERENCES, WILLOW_FROZEN_BUNDLE, WILLOW_EXPECTED_ASSET_SOURCES, WILLOW_STUDIO_LIGHTS, willowStudioIdentity, saveWillowCapturePair, advanceWillowTransition, willowReviewNearPlane } from '../src/yuanmingyuan/willow-distance-studio-state.js';

const base = new URL('../src/yuanmingyuan/', import.meta.url);
const read = path => readFile(new URL(path, base), 'utf8');
const record = () => ({ sourceIdentity: { sha256: 'a'.repeat(64) }, mode: 'blend', view: 'midFront', light: 'day', output: 'beauty', sampling: 'centroid', shadowEnabled: false, sequence: 1, createdAt: '2026-09-12T03:04:05.000Z', coverage: { from: 'near', to: 'mid', phase: .375236 }, physical: { width: 2435, height: 2200 }, camera: { position: [1, 2, 3] } });

test('current frozen willow source identity matches; a changed or missing source is rejected', async () => {
  const raw = Object.fromEntries(await Promise.all(Object.keys(WILLOW_EXPECTED_ASSET_SOURCES).map(async path => [path, await read(path)])));
  const result = await willowStudioIdentity(raw); assert.equal(result.frozenAssetCodeVerified, true); assert.equal(result.files.length, 8);
  assert.equal(result.reviewRevision, WILLOW_STUDIO_REVISION);
  assert.equal(result.nativeReviewed, false); assert.equal(result.mainSceneAllowed, false);
  for (const previous of WILLOW_HISTORICAL_REFERENCES) { assert.notEqual(result.sha256, previous.sourceIdentitySha256); assert.notEqual(WILLOW_FROZEN_BUNDLE, previous.assetBundleSha256); }
  await assert.rejects(willowStudioIdentity({ ...raw, './vegetation-wood-stability.js': raw['./vegetation-wood-stability.js'] + '\n' }), /mismatch/);
  const missingWood = { ...raw }; delete missingWood['./vegetation-wood-stability.js']; await assert.rejects(willowStudioIdentity(missingWood), /missing/);
  await assert.rejects(willowStudioIdentity({ ...raw, './willow-lod-runtime.js': raw['./willow-lod-runtime.js'] + '\n' }), /mismatch/);
  const missing = { ...raw }; delete missing['./vegetation-geometry.js']; await assert.rejects(willowStudioIdentity(missing), /missing/);
});

test('visible controls expose all comparisons, fixed fractions, diagnostics and native save without runtime injection', async () => {
  const html = await read('../../willow-distance-studio.html'), main = await read('./willow-distance-studio.js');
  for (const id of ['mode', 'view', 'range', 'light', 'output', 'sampling', 'shadows', 'pair', 'phase', 'play-blend', 'approach', 'pause', 'save', 'dispose']) {
    assert.ok(html.includes(`id="distance-${id}"`), id); assert.ok(main.includes(`$('distance-${id}')`), `${id} wired`);
  }
  for (const value of ['source', 'near', 'mid', 'far', 'blend', 'auto', 'normal', 'depth', 'ao', 'color', 'day', 'night', 'pixel', 'centroid-color', 'centroid']) assert.ok(html.includes(`value="${value}"`), value);
  for (const phase of [0, 25, 50, 75, 100]) assert.ok(html.includes(`data-phase="${phase}"`));
  assert.match(html, /id="distance-phase"[^>]*step="any"/); // Pausing an automatic fade must not quantize the saved frame.
  assert.ok(!main.includes('window.__')); assert.match(main, /specimens: \['willow'\]/);
});

test('fixed day/night light values and exposure match the existing shared Studio', async () => {
  const studio = await read('../studio.js'), main = await read('./willow-distance-studio.js');
  for (const light of Object.values(WILLOW_STUDIO_LIGHTS)) for (const [name, value] of Object.entries(light)) assert.ok(studio.includes(`${name}:${typeof value === 'string' ? `'${value}'` : value}`), `${name}=${value}`);
  assert.match(studio, /toneMappingExposure=1\.1/); assert.match(main, /toneMappingExposure = 1\.1/);
  assert.match(main, /scene\.environmentIntensity = \.35/); assert.match(main, /ground\.position\.y = 0/);
});

test('automatic transition finishes its active pair before reversing, without a midpoint jump', () => {
  const state = { current: 'near', transition: null };
  assert.deepEqual(advanceWillowTransition(state, 'mid', 10), { from: 'near', to: 'mid', phase: 0 });
  assert.deepEqual(advanceWillowTransition(state, 'near', 10.25), { from: 'near', to: 'mid', phase: .5 });
  assert.deepEqual(advanceWillowTransition(state, 'near', 10.5), { from: 'near', to: 'mid', phase: 1 });
  assert.equal(state.current, 'mid'); assert.equal(state.transition, null);
  assert.deepEqual(advanceWillowTransition(state, 'near', 10.6), { from: 'mid', to: 'near', phase: 0 });
  assert.throws(() => advanceWillowTransition(state, 'source', 11), /Invalid/);
});

test('review clipping keeps the actual tree range visible while improving distant leaf depth precision', () => {
  for (const distance of [10, 16, 80, 750, 900, 1200]) {
    const near = willowReviewNearPlane(distance); assert.ok(near < distance - 8); assert.ok(near > .05);
  }
  assert.equal(willowReviewNearPlane(750), 15);
  const z = 750, far = 2500, step = near => z * z * (far - near) / (far * near * ((2 ** 24) - 1));
  assert.ok(step(15) < .003); assert.ok(step(.05) > .5);
  assert.throws(() => willowReviewNearPlane(NaN), /Invalid/);
});

test('PNG encoding and sequential uploads retain the metadata snapshot of that exact draw', async () => {
  const value = record(), calls = []; let encoded, draws = 0;
  const task = saveWillowCapturePair({ canvas: { toBlob(callback, type) { assert.equal(type, 'image/png'); encoded = callback; } }, render() { draws++; }, metadata: () => value,
    async upload(name, blob) { calls.push({ event: 'start', name, blob }); await Promise.resolve(); calls.push({ event: 'end', name }); } });
  value.coverage.phase = .9; value.camera.position[0] = 99; value.physical.width = 2; value.sampling = 'pixel'; value.shadowEnabled = true; encoded(new Blob(['native-image-test-stub'], { type: 'image/png' }));
  const result = await task, json = JSON.parse(await result.json.text());
  assert.equal(draws, 1); assert.equal(json.coverage.phase, .375236); assert.deepEqual(json.camera.position, [1, 2, 3]); assert.equal(json.physical.width, 2435);
  assert.equal(json.sampling, 'centroid'); assert.equal(json.shadowEnabled, false); assert.match(result.files[0], /centroid-shadow-off/);
  assert.deepEqual(calls.map(call => call.event), ['start', 'end', 'start', 'end']); assert.match(calls[0].name, /\.png$/); assert.match(calls[2].name, /\.json$/);
  for (const name of result.files) assert.match(name, /^[a-z0-9][a-z0-9._-]{0,200}\.(png|json)$/i);
  assert.deepEqual(Object.values(json.files), result.files);
});

test('failed JSON upload reports the already saved PNG and never deletes evidence', async () => {
  const calls = [];
  await assert.rejects(saveWillowCapturePair({ canvas: { toBlob(done) { done(new Blob(['png'])); } }, render() {}, metadata: record,
    async upload(name) { calls.push(name); if (name.endsWith('.json')) throw new Error('disk full'); } }), error => {
    assert.equal(error.message, 'disk full'); assert.deepEqual(error.retainedFiles, [calls[0]]); return true;
  }); assert.equal(calls.length, 2);
});

test('abort during asynchronous PNG encoding prevents both writes', async () => {
  const controller = new AbortController(); let encoded, writes = 0;
  const task = saveWillowCapturePair({ canvas: { toBlob(done) { encoded = done; } }, render() {}, metadata: record, upload() { writes++; }, signal: controller.signal });
  controller.abort(); encoded(new Blob(['png'])); await assert.rejects(task, { name: 'AbortError' }); assert.equal(writes, 0);
});

test('real GTAO normal override, colour, depth and distance shaders use identical complementary coverage', () => {
  const ao = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(38, 1, .05, 2500), 16, 16);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const level = createWillowInstancedLevel([{ name: 'tiny-coverage-fixture', geometry, material }], [{}, {}]);
  try {
    const info = configureWillowNormalOverride(ao); configureWillowNormalOverride(ao); ao.setSize(2435, 2200);
    assert.equal(ao.normalMaterial.side, THREE.DoubleSide); assert.equal(info.resolutionScale, 1);
    assert.deepEqual([ao.normalRenderTarget.width, ao.normalRenderTarget.height], [2435, 2200]);
    assert.equal(ao.normalRenderTarget.depthTexture, ao.depthTexture); assert.deepEqual(ao.normalMaterial.defaultAttributeValues.willowLodFade, [0, 0]);
    level.setCoverage(0, .375, -1); level.setCoverage(1, .375, 1);
    const fade = level.meshes[0].geometry.getAttribute('willowLodFade'); assert.deepEqual([...fade.array], [.375, -1, .375, 1]);
    const signatures = [];
    for (const [object, shaderName] of [[ao.normalMaterial, 'normal'], [level.meshes[0].material, 'standard'], [level.meshes[0].customDepthMaterial, 'depth'], [level.meshes[0].customDistanceMaterial, 'distance']]) {
      const shader = { vertexShader: THREE.ShaderLib[shaderName].vertexShader, fragmentShader: THREE.ShaderLib[shaderName].fragmentShader }; object.onBeforeCompile(shader, null);
      assert.equal(shader.vertexShader.match(/attribute vec2 willowLodFade/g).length, 1);
      signatures.push(shader.fragmentShader.match(/if \(abs\(vWillowLodFade.y\)[\s\S]*?discard;/)[0]);
    }
    assert.equal(new Set(signatures).size, 1);
    for (const phase of [0, .25, .5, .75, 1]) for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) assert.notEqual(willowCoverageAt(x, y, phase, -1), willowCoverageAt(x, y, phase, 1));
    assert.equal(info.msaaBoundaryParity, 'requires native inspection');
  } finally { level.dispose(); geometry.dispose(); material.dispose(); ao.dispose(); }
});
