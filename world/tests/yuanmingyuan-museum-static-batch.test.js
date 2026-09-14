import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createMuseumStaticBatch, placeMuseumStaticAsset } from '../src/yuanmingyuan/museum-static-batch.js';
import { createArchitectureSurface } from '../src/yuanmingyuan/architecture-surface.js';
import { createMuseumSiteController } from '../src/yuanmingyuan/site-controller.js';
import { createHanjingtangRubbingMaterials } from '../src/yuanmingyuan/hanjingtang-rubbings.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const meshList = group => { const result = []; group.traverse(node => { if (node.isMesh) result.push(node); }); return result; };
// Keep the original ownership/abort fixtures on the unpartitioned contract.
// The default 16 m partition is exercised in building-spatial-batch.test.js.
const options = { id: 'zhengjuesi', spatialCellSizeWorld: 0, yieldControl: async () => {} };
function hashGeometry(geometry) {
  const hash = createHash('sha256');
  for (const [name, attribute] of [...Object.entries(geometry.attributes), ['index', geometry.index]]) {
    if (!attribute) continue; hash.update(name); hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  return hash.digest('hex');
}
function fixture({ extraNodes = 0 } = {}) {
  const group = new THREE.Group(), facade = new THREE.Group(); group.name = 'static-building'; facade.name = 'named-facade'; facade.rotation.y = .19; facade.userData.sourceId = 'fixture-source'; group.add(facade);
  const geometry = new THREE.BoxGeometry(), texture = new THREE.DataTexture(new Uint8Array([72, 106, 159, 255]), 1, 1), material = new THREE.MeshStandardMaterial({ map: texture, roughness: .72 }), glass = new THREE.MeshPhysicalMaterial({ transparent: true, transmission: .1, opacity: .3 });
  const owned = new Set(), counts = new Map(), events = [];
  function own(resource) { if (owned.has(resource)) return resource; owned.add(resource); resource.addEventListener('dispose', () => { counts.set(resource, (counts.get(resource) ?? 0) + 1); events.push('source-resource'); }); return resource; }
  [geometry, texture, material, glass].forEach(own);
  for (const [name, position, scale, navigation] of [['floor', [0, -.1, 0], [10, .2, 8], true], ['excluded-decoration', [0, 1, 2], [.3, 2, .3], false], ['post', [3, 1, 1], [.3, 2, .3], true]]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.userData = { navigation, historicPart: name }; mesh.castShadow = mesh.receiveShadow = true; facade.add(mesh);
  }
  const instances = own(new THREE.InstancedMesh(geometry, material, 2)); instances.name = 'colored-original-instances'; instances.castShadow = instances.receiveShadow = true;
  for (let i = 0; i < 2; i++) { instances.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(-3 + i, .3, -2), new THREE.Quaternion(), new THREE.Vector3(.3, .6, .3))); instances.setColorAt(i, new THREE.Color(.4, .5 + i * .1, .7)); }
  facade.add(instances);
  const pane = new THREE.Mesh(geometry, glass); pane.name = 'transparent-pane'; pane.position.set(0, 1, 0); pane.scale.set(1.7, 2, .03); facade.add(pane);
  for (let i = 0; i < extraNodes; i++) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i + 6, .5, 0); facade.add(mesh); }
  let disposed = false;
  return { group, facade, geometry, material, texture, owned, counts, events, own, updates: 0, diagnostics: { originalEvidence: true }, update() { this.updates++; }, dispose() { if (disposed) return; disposed = true; for (const item of owned) item.dispose(); group.clear(); } };
}
function assertDisposed(source) { for (const resource of source.owned) assert.equal(source.counts.get(resource), 1); }

test('full-detail batching retains original buffers, materials, UV, instance colors and placed transforms', async () => {
  const source = fixture(), before = hashGeometry(source.geometry), originals = meshList(source.group), placement = { position: [-230, 4, 180], rotationY: .23, scale: 1.13 };
  const provenance = { kind: 'archive', digest: 'a'.repeat(64), packaging: { compression: 'gzip', sourceSHA256: 'b'.repeat(64) } };
  source.archive = { id: 'zhengjuesi', sourceSHA256: provenance.packaging.sourceSHA256 };
  const owner = await createMuseumStaticBatch(source, { ...options, placement, sourceProvenance: provenance });
  try {
    const { builderReport: report } = owner.diagnostics.nearBatch;
    assert.equal(owner.diagnostics.nearBatch.applied, true); assert.equal(owner.diagnostics.originalEvidence, true);
    assert.equal(owner.diagnostics.nearBatch.sourceProvenance, provenance); assert.equal(report.sourceArchiveDigest, provenance.digest); assert.equal(owner.archive, source.archive);
    assert.equal(report.originalDraws, 5); assert.equal(report.distanceDraws, 2); assert.equal(report.originalTriangles, 72); assert.equal(report.distanceTriangles, 72); assert.equal(report.mergedDraws, 0);
    assert.equal(hashGeometry(source.geometry), before); assert.deepEqual(report.sourceRootWorldMatrix, source.group.matrixWorld.toArray());
    assert.equal(owner.group.name, source.group.name); assert.equal(owner.collisionGroup, source.group); assert.equal(owner.namedGroupRoot.getObjectByName('named-facade'), source.facade);
    for (const node of meshList(owner.group)) { assert.equal(node.geometry, source.geometry); assert.ok(originals.some(original => original.material === node.material)); }
    const batch = meshList(owner.group).find(mesh => mesh.isInstancedMesh); assert.equal(batch.material.map, source.texture);
    let measured = 0;
    for (const binding of batch.userData.sourceBindings) for (let i = 0; i < binding.count; i++) {
      const original = originals[binding.sourceNodeOrdinal], from = new THREE.Matrix4(), to = new THREE.Matrix4();
      if (original.isInstancedMesh) original.getMatrixAt(binding.sourceInstanceStart + i, from);
      batch.getMatrixAt(binding.outputInstanceStart + i, to);
      for (const vertex of [new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5)]) measured = Math.max(measured, vertex.clone().applyMatrix4(from).applyMatrix4(original.matrixWorld).distanceTo(vertex.clone().applyMatrix4(to).applyMatrix4(batch.matrixWorld)));
      if (original.instanceColor) { const a = new THREE.Color(), b = new THREE.Color(); original.getColorAt(binding.sourceInstanceStart + i, a); batch.getColorAt(binding.outputInstanceStart + i, b); assert.deepEqual(a.toArray(), b.toArray()); }
    }
    assert.ok(measured <= report.maximumErrorArchiveWorld + 1e-12); assert.ok(measured <= 1e-5);
    owner.update(10); assert.equal(source.updates, 1);
    batch.addEventListener('dispose', () => source.events.push('batch-instance'));
  } finally { owner.dispose(); owner.dispose(); }
  assertDisposed(source); assert.equal(source.events[0], 'batch-instance');
});

test('one drawing group and an off-scene original query preserve navigation exclusions', async () => {
  const source = fixture(), owner = await createMuseumStaticBatch(source, { ...options, placement: { position: [70, 4, -35], rotationY: -.43, scale: 1.13 } }), scene = new THREE.Scene();
  const correct = createArchitectureSurface(owner.collisionGroup), incorrect = createArchitectureSurface(owner.group);
  try {
    scene.add(owner.group); assert.equal(source.group.parent, null); assert.equal(meshList(scene).length, 2);
    const p = new THREE.Vector3(0, 0, 2).applyMatrix4(source.facade.matrixWorld), query = { x: p.x, y: p.y, z: p.z, radius: .2, height: 2.2 };
    assert.equal(correct.capsuleBlocked(query), false); assert.equal(incorrect.capsuleBlocked(query), true);
    assert.equal(correct.surfaceAt(p.x, p.z).height, 4); assert.ok(incorrect.surfaceAt(p.x, p.z).height > 6.2);
    assert.throws(() => placeMuseumStaticAsset(owner, { position: [0, 0, 0], rotationY: 0, scale: 1 }), /before mounting/);
  } finally { correct.dispose(); incorrect.dispose(); owner.dispose(); }
  assert.equal(meshList(scene).length, 0); assertDisposed(source);
});

test('placement synchronizes both standalone roots and their real world surfaces', async () => {
  const source = fixture(), originals = meshList(source.group), owner = await createMuseumStaticBatch(source, options);
  try {
    placeMuseumStaticAsset(owner, { position: [700, 12, -440], rotationY: 1.27, scale: 2.4 });
    assert.deepEqual(owner.group.matrixWorld.toArray(), source.group.matrixWorld.toArray());
    const batch = meshList(owner.group).find(mesh => mesh.isInstancedMesh); let maximum = 0;
    // Compare corresponding authored vertices. Rotated conservative batch AABBs
    // can grow even when these real surfaces agree.
    for (const binding of batch.userData.sourceBindings) for (let i = 0; i < binding.count; i++) {
      const original = originals[binding.sourceNodeOrdinal], a = new THREE.Matrix4(), b = new THREE.Matrix4();
      if (original.isInstancedMesh) original.getMatrixAt(binding.sourceInstanceStart + i, a);
      batch.getMatrixAt(binding.outputInstanceStart + i, b);
      for (let j = 0; j < source.geometry.attributes.position.count; j++) {
        const point = new THREE.Vector3().fromBufferAttribute(source.geometry.attributes.position, j);
        maximum = Math.max(maximum, point.clone().applyMatrix4(a).applyMatrix4(original.matrixWorld).distanceTo(point.clone().applyMatrix4(b).applyMatrix4(batch.matrixWorld)));
      }
    }
    assert.ok(maximum <= owner.diagnostics.nearBatch.builderReport.maximumErrorArchiveWorld * 2.4 + 1e-12);
    const query = createArchitectureSurface(owner.collisionGroup);
    try { const p = new THREE.Vector3(1, 0, 2).applyMatrix4(source.facade.matrixWorld); assert.equal(query.surfaceAt(p.x, p.z, { maxY: 13 }).height, 12); } finally { query.dispose(); }
  } finally { owner.dispose(); }
});

test('identical bytes in different geometry objects retain the original owner when draws cannot decrease', async () => {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial(), geometry = [new THREE.BoxGeometry(), new THREE.BoxGeometry()]; let disposals = 0;
  geometry.forEach((g, i) => { const mesh = new THREE.Mesh(g, material); mesh.position.x = i * 2; group.add(mesh); });
  const source = { group, dispose() { if (disposals++) return; geometry.forEach(g => g.dispose()); material.dispose(); group.clear(); } };
  const owner = await createMuseumStaticBatch(source, { ...options, id: 'hanjingtang', sourceProvenance: { kind: 'factory', digest: 'c'.repeat(64) } });
  assert.equal(owner, source); assert.equal(disposals, 0); assert.equal(owner.diagnostics.nearBatch.reason, 'no-draw-reduction'); assert.equal(owner.diagnostics.nearBatch.builderReport.sourceArchiveDigest, undefined);
  assert.equal(owner.collisionGroup, owner.group); assert.equal(owner.namedGroupRoot, owner.group); owner.dispose(); assert.equal(disposals, 1);
});

test('actual Hanjing inscription shader falls back without changing its real material or source owner', async () => {
  const source = fixture(), resources = { textures: new Set(), materials: new Set() }, rubbings = createHanjingtangRubbingMaterials(resources);
  for (const resource of [...resources.materials, ...resources.textures]) source.own(resource);
  const panel = source.facade.getObjectByName('post'); panel.material = rubbings[0]; const originalShader = panel.material.onBeforeCompile;
  const owner = await createMuseumStaticBatch(source, { ...options, id: 'hanjingtang' });
  assert.equal(owner, source); assert.equal(owner.diagnostics.nearBatch.reason, 'batch-declined'); assert.match(owner.diagnostics.nearBatch.error.message, /Custom material shaders/);
  assert.equal(panel.material, rubbings[0]); assert.equal(panel.material.onBeforeCompile, originalShader); assert.equal(source.counts.size, 0);
  owner.dispose(); assertDisposed(source);
});

test('reflected and sheared authored transforms retain the full original model', async () => {
  for (const kind of ['reflection', 'shear']) {
    const source = fixture(), post = source.facade.getObjectByName('post');
    if (kind === 'reflection') post.scale.x = -1;
    else { post.matrixAutoUpdate = false; post.matrix.makeShear(.2, 0, 0, 0, 0, 0); }
    const owner = await createMuseumStaticBatch(source, options);
    assert.equal(owner, source); assert.equal(owner.diagnostics.nearBatch.reason, 'batch-declined'); assert.equal(source.counts.size, 0);
    assert.match(owner.diagnostics.nearBatch.error.message, kind === 'reflection' ? /positive nonsingular/ : /Sheared/);
    owner.dispose(); assertDisposed(source);
  }
});

test('an exactness budget failure preserves geometry and does not relax the requested bound', async () => {
  const source = fixture(), before = hashGeometry(source.geometry), owner = await createMuseumStaticBatch(source, { ...options, maximumErrorWorld: 1e-15 });
  assert.equal(owner, source); assert.match(owner.diagnostics.nearBatch.error.message, /Matrix encoding/); assert.equal(owner.diagnostics.nearBatch.requestedMaximumErrorWorld, 1e-15); assert.equal(hashGeometry(source.geometry), before); assert.equal(source.counts.size, 0);
  owner.dispose(); assertDisposed(source);
});

test('assets outside the static allowlist never enter the batching pipeline', async () => {
  const source = fixture(), owner = await createMuseumStaticBatch(source, { id: 'fanghe-xianfahua', onProgress() { throw new Error('Must not batch water'); } });
  assert.equal(owner, source); assert.equal(owner.diagnostics.nearBatch.reason, 'asset-not-allowlisted'); owner.update(3); assert.equal(source.updates, 1); assert.equal(source.counts.size, 0);
  owner.dispose(); assertDisposed(source);
});

test('pre-abort, mid-build abort and abort immediately after construction all dispose the source', async () => {
  for (const when of ['before', 'during', 'after']) {
    const source = fixture(), controller = new AbortController(); let returned;
    if (when === 'before') controller.abort();
    // Retained transparent draws do not emit the builder's instance progress.
    // Finish with an opaque node so the queued abort follows completed output.
    source.facade.add(source.facade.getObjectByName('colored-original-instances'));
    try {
      await assert.rejects(createMuseumStaticBatch(source, { ...options, signal: controller.signal, onProgress({ completed, total }) {
        if (when === 'during' && completed === 2) controller.abort();
        if (when === 'after' && completed === total) queueMicrotask(() => controller.abort());
      } }).then(value => { returned = value; return value; }), { name: 'AbortError' });
      assertDisposed(source); assert.equal(source.group.children.length, 0);
    } finally { returned?.dispose(); source.dispose(); }
  }
});

test('site controller queues a cancelled real batch, then mounts only the next drawing group', async () => {
  const sourceA = fixture({ extraNodes: 13 }), sourceB = fixture(), entered = deferred(), gate = deferred(), scene = new THREE.Scene(), calls = [], mounted = [];
  const controller = createMuseumSiteController({ sites: [{ id: 'a', assetId: 'zhengjuesi' }, { id: 'b', assetId: 'haiyue' }], load: async (site, { signal }) => {
    calls.push(site.id);
    return createMuseumStaticBatch(site.id === 'a' ? sourceA : sourceB, { id: site.assetId, signal, spatialCellSizeWorld: 0, yieldControl: async () => { if (site.id === 'a') { entered.resolve(); await gate.promise; } } });
  }, mount: owner => { mounted.push(owner); scene.add(owner.group); const surface = createArchitectureSurface(owner.collisionGroup); return () => { surface.dispose(); }; } });
  try {
    const first = controller.select('a'); await entered.promise; const second = controller.select('b'); await settle(); assert.deepEqual(calls, ['a']); gate.resolve();
    assert.equal(await first, null); await second; assert.deepEqual(calls, ['a', 'b']); assert.equal(mounted.length, 1); assert.equal(controller.snapshot.status, 'ready'); assertDisposed(sourceA);
    assert.equal(sourceB.counts.size, 0); assert.equal(sourceB.group.parent, null); assert.equal(meshList(scene).length, 2);
    controller.dispose(); controller.dispose(); assertDisposed(sourceB); assert.equal(meshList(scene).length, 0);
  } finally { gate.resolve(); controller.dispose(); sourceA.dispose(); sourceB.dispose(); }
});

test('a throwing detach listener cannot skip batch and source disposal', async () => {
  const source = fixture(), owner = await createMuseumStaticBatch(source, options), scene = new THREE.Scene(); let batchDisposed = 0;
  meshList(owner.group).filter(mesh => mesh.isInstancedMesh).forEach(mesh => mesh.addEventListener('dispose', () => { batchDisposed++; }));
  owner.group.addEventListener('removed', () => { throw new Error('fixture detach listener failed'); }); scene.add(owner.group);
  assert.throws(() => owner.dispose(), /fixture detach listener failed/); assert.equal(batchDisposed, 1); assertDisposed(source); assert.equal(meshList(scene).length, 0);
  owner.dispose(); assertDisposed(source);
});
