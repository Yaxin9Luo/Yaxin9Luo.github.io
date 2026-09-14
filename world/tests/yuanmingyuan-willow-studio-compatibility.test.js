import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createWillowLodPilot, enableWillowLodCoverage } from '../src/yuanmingyuan/willow-lod-runtime.js';
import { installVegetationWoodStability } from '../src/yuanmingyuan/vegetation-wood-stability.js';
import { setWillowSampling } from '../src/yuanmingyuan/willow-distance-sampling.js';
import { WILLOW_STUDIO_REVISION, WILLOW_FROZEN_BUNDLE, WILLOW_EXPECTED_ASSET_SOURCES, WILLOW_HISTORICAL_REFERENCES, willowStudioIdentity } from '../src/yuanmingyuan/willow-distance-studio-state.js';

const hash = text => createHash('sha256').update(text).digest('hex');
const standard = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
const occurrences = (text, token) => text.split(token).length - 1;
const woodMarker = 'vegetation-wood-stability-r1:rgb01', bumpMarker = 'willow-bark-bump-guard-r1', coverageKey = '|willow-complementary-coverage-v1';
const root = new URL('../../', import.meta.url);

test('current eight-file asset bundle includes the executable wood helper and separates historical proofs', async () => {
  const raw = Object.fromEntries(await Promise.all(Object.keys(WILLOW_EXPECTED_ASSET_SOURCES).map(async path => [path, await readFile(new URL('../src/yuanmingyuan/' + path, import.meta.url), 'utf8')])));
  const identity = await willowStudioIdentity(raw);
  assert.equal(identity.reviewRevision, WILLOW_STUDIO_REVISION);
  assert.equal(hash(Object.keys(raw).sort().map(path => path + '\0' + raw[path] + '\0').join('')), WILLOW_FROZEN_BUNDLE);
  assert.equal(identity.frozenAssetBundleSha256, WILLOW_FROZEN_BUNDLE);
  assert.equal(identity.nativeReviewed, false); assert.equal(identity.mainSceneAllowed, false);
  for (const reference of WILLOW_HISTORICAL_REFERENCES) {
    const proof = JSON.parse(await readFile(new URL(reference.proof, root), 'utf8'));
    assert.equal(reference.sourceIdentitySha256, proof.sourceIdentity.sha256);
    assert.equal(reference.assetBundleSha256, proof.sourceIdentity.frozenAssetBundleSha256);
    assert.notEqual(identity.sha256, reference.sourceIdentitySha256);
    assert.notEqual(identity.frozenAssetBundleSha256, reference.assetBundleSha256);
  }
  const page = await readFile(new URL('../src/yuanmingyuan/willow-distance-studio.js', import.meta.url), 'utf8');
  assert.match(page.slice(page.indexOf('const rawModules'), page.indexOf("const $")), /'\.\/vegetation-wood-stability\.js'/);
  const complete = { ...raw, './willow-distance-studio.js': page };
  const first = await willowStudioIdentity(complete);
  assert.notEqual(first.sha256, (await willowStudioIdentity({ ...complete, './willow-distance-studio.js': page + '\n' })).sha256);
  for (const path of ['./garden-vegetation.js', './vegetation-wood-stability.js', './willow-lod-runtime.js']) {
    await assert.rejects(willowStudioIdentity({ ...raw, [path]: raw[path] + '\n' }), /mismatch/);
    const missing = { ...raw }; delete missing[path]; await assert.rejects(willowStudioIdentity(missing), /missing/);
  }
});

function fixture({ centroid = false } = {}) {
  const grain = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  grain.name = 'tiny-authored-bark';
  const bark = new THREE.MeshStandardMaterial({ name: 'yuanming-living-grey-brown-bark', vertexColors: true, roughness: .96, map: grain, bumpMap: grain, bumpScale: .018 });
  const stem = new THREE.MeshStandardMaterial({ name: 'yuanming-petioles-and-twigs', vertexColors: true, roughness: .88 });
  const leaf = new THREE.MeshStandardMaterial({ name: 'yuanming-leaf-lamina', vertexColors: true, roughness: .77, side: THREE.DoubleSide });
  const calls = [], keyCalls = [], renderer = {};
  for (const material of [bark, stem]) {
    material.onBeforeCompile = function(shader, receivedRenderer) {
      calls.push({ receiver: this, renderer: receivedRenderer });
      assert.equal(occurrences(shader.fragmentShader, woodMarker), 0);
      assert.equal(occurrences(shader.vertexShader, 'attribute vec2 willowLodFade'), 0);
      shader.fragmentShader = '/* prior-source-pbr */\n' + shader.fragmentShader;
    };
    material.customProgramCacheKey = function() { keyCalls.push(this); return 'prior-source:' + this.uuid; };
  }
  installVegetationWoodStability({ bark, stem });
  if (centroid) for (const material of [bark, stem]) setWillowSampling(material, 'centroid');
  const group = new THREE.Group(); group.name = 'garden-willow';
  const geometry = new THREE.BoxGeometry(.12, .6, .12);
  const records = [bark, stem, leaf].map((material, i) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'tiny-source-' + i; mesh.position.x = i * .3; group.add(mesh);
    return { name: mesh.name, geometry, material };
  });
  const sourceState = [bark, stem, leaf].map(material => ({ material, hook: material.onBeforeCompile, key: material.customProgramCacheKey, version: material.version }));
  const pilot = createWillowLodPilot({ source: { group }, levels: { mid: records, far: records } });
  return { group, pilot, bark, stem, leaf, grain, geometry, calls, keyCalls, renderer, sourceState,
    dispose() { pilot.dispose(); group.clear(); geometry.dispose(); bark.dispose(); stem.dispose(); leaf.dispose(); grain.dispose(); } };
}

test('all three tiers retain source PBR hooks, clone receivers and distinct wood cache chains before coverage', () => {
  const f = fixture();
  try {
    for (const [tier, representation] of Object.entries(f.pilot.representations)) {
      let wood = 0;
      for (const mesh of representation.group.children) {
        const material = mesh.material;
        if (material.name === f.leaf.name) continue;
        const priorCalls = f.calls.length, shader = standard();
        material.onBeforeCompile(shader, f.renderer);
        assert.equal(f.calls.length, priorCalls + 1, tier);
        assert.equal(f.calls.at(-1).receiver, material); assert.equal(f.calls.at(-1).renderer, f.renderer);
        assert.equal(occurrences(shader.fragmentShader, 'prior-source-pbr'), 1);
        assert.equal(occurrences(shader.fragmentShader, woodMarker), 1);
        assert.equal(occurrences(shader.fragmentShader, bumpMarker), material.name === f.bark.name ? 1 : 0);
        assert.equal(occurrences(shader.vertexShader, 'attribute vec2 willowLodFade'), 1);
        assert.equal(occurrences(shader.fragmentShader, 'float willowDither'), 1);
        const role = material.name === f.bark.name ? 'rgb01+bump' : 'rgb01';
        assert.equal(material.customProgramCacheKey(), 'prior-source:' + material.uuid + '|vegetation-wood-stability-r1:' + role + coverageKey);
        assert.equal(f.keyCalls.at(-1), material);
        assert.notEqual(material, role === 'rgb01+bump' ? f.bark : f.stem);
        if (role === 'rgb01+bump') { assert.equal(material.map, f.grain); assert.equal(material.bumpMap, f.grain); assert.equal(material.bumpScale, .018); assert.equal(material.roughness, .96); }
        wood++;
      }
      assert.equal(wood, 2, tier);
    }
    for (const { material, hook, key, version } of f.sourceState) {
      assert.equal(material.onBeforeCompile, hook); assert.equal(material.customProgramCacheKey, key); assert.equal(material.version, version);
    }
    assert.equal(f.pilot.diagnostics.nativeReviewed, false); assert.equal(f.pilot.diagnostics.mainSceneAllowed, false);
  } finally { f.dispose(); }
});

test('an existing centroid wrapper remains linked after cloning without repeating source PBR or coverage', () => {
  const f = fixture({ centroid: true });
  try {
    for (const representation of Object.values(f.pilot.representations)) {
      const bark = representation.group.children.find(mesh => mesh.material.name === f.bark.name).material;
      const shader = standard(); bark.onBeforeCompile(shader, f.renderer);
      assert.match(shader.vertexShader, /centroid varying vec4 vColor/);
      assert.match(shader.fragmentShader, /centroid varying vec4 vColor/);
      assert.match(shader.fragmentShader, /centroid varying vec3 vNormal/);
      assert.equal(occurrences(shader.fragmentShader, woodMarker), 1);
      assert.equal(occurrences(shader.fragmentShader, bumpMarker), 1);
      assert.equal(occurrences(shader.fragmentShader, 'float willowDither'), 1);
      assert.equal(bark.customProgramCacheKey(), 'prior-source:' + bark.uuid + '|vegetation-wood-stability-r1:rgb01+bump|willow-centroid-diagnostic-v1:centroid' + coverageKey);
    }
  } finally { f.dispose(); }
});

test('default leaf surface and later page sampling remain byte-identical to the previous coverage path', () => {
  const f = fixture(), previous = enableWillowLodCoverage(f.leaf.clone());
  try {
    const clone = f.pilot.representations.near.group.children.find(mesh => mesh.material.name === f.leaf.name).material;
    const leafHook = f.leaf.onBeforeCompile, leafKey = f.leaf.customProgramCacheKey, leafVersion = f.leaf.version;
    let expected = standard(), actual = standard();
    previous.onBeforeCompile(expected, null); clone.onBeforeCompile(actual, null);
    assert.deepEqual(actual, expected); assert.equal(clone.customProgramCacheKey(), previous.customProgramCacheKey());
    assert.equal(f.leaf.onBeforeCompile, leafHook); assert.equal(f.leaf.customProgramCacheKey, leafKey); assert.equal(f.leaf.version, leafVersion);
    for (const mode of ['centroid', 'centroid-color', 'pixel']) {
      setWillowSampling(previous, mode); setWillowSampling(clone, mode);
      expected = standard(); actual = standard();
      previous.onBeforeCompile(expected, null); clone.onBeforeCompile(actual, null);
      assert.deepEqual(actual, expected); assert.equal(clone.customProgramCacheKey(), previous.customProgramCacheKey());
      assert.equal(occurrences(actual.fragmentShader, woodMarker), 0); assert.equal(occurrences(actual.fragmentShader, bumpMarker), 0);
    }
  } finally { previous.dispose(); f.dispose(); }
});

test('distance/depth coverage remains separate and only owned clone resources are disposed', () => {
  const f = fixture(), sourceEvents = new Map([f.bark, f.stem, f.leaf, f.grain, f.geometry].map(resource => [resource, 0])), ownedEvents = new Map();
  for (const resource of sourceEvents.keys()) resource.addEventListener('dispose', () => sourceEvents.set(resource, sourceEvents.get(resource) + 1));
  try {
    for (const representation of Object.values(f.pilot.representations)) for (const mesh of representation.group.children) {
      for (const material of [mesh.material, mesh.customDepthMaterial, mesh.customDistanceMaterial]) {
        if (!ownedEvents.has(material)) { ownedEvents.set(material, 0); material.addEventListener('dispose', () => ownedEvents.set(material, ownedEvents.get(material) + 1)); }
      }
      for (const [material, shaderName] of [[mesh.customDepthMaterial, 'depth'], [mesh.customDistanceMaterial, 'distance']]) {
        const shader = { vertexShader: THREE.ShaderLib[shaderName].vertexShader, fragmentShader: THREE.ShaderLib[shaderName].fragmentShader };
        material.onBeforeCompile(shader, null);
        assert.equal(occurrences(shader.fragmentShader, 'float willowDither'), 1);
        assert.equal(occurrences(shader.fragmentShader, woodMarker), 0); assert.equal(occurrences(shader.fragmentShader, bumpMarker), 0);
      }
    }
    f.pilot.dispose(); f.pilot.dispose();
    assert.equal(ownedEvents.size, 27);
    for (const count of ownedEvents.values()) assert.equal(count, 1);
    for (const count of sourceEvents.values()) assert.equal(count, 0);
    const sourceShader = standard(); f.bark.onBeforeCompile(sourceShader, f.renderer);
    assert.equal(occurrences(sourceShader.fragmentShader, bumpMarker), 1);
  } finally { f.dispose(); }
});

test('same preview controls disclose the new revision and never inherit historical native acceptance', async () => {
  const html = await readFile(new URL('../willow-distance-studio.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/yuanmingyuan/willow-distance-studio.js', import.meta.url), 'utf8');
  assert.match(html, /R3 当前源模型/); assert.match(html, /全部距离档尚未验收/); assert.match(html, /不继承旧视觉结论/);
  assert.match(main, /reviewRevision: WILLOW_STUDIO_REVISION/); assert.match(main, /distanceTiersNativeReviewed: false/);
  assert.match(main, /nativeAdmissionAllowed: false/); assert.match(main, /historicalReferenceOnly: true/);
  for (const mode of ['source', 'near', 'mid', 'far', 'blend', 'auto']) assert.ok(html.includes('value="' + mode + '"'));
});
