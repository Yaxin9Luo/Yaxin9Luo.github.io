import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createMuseumMultiDrawBatch } from '../src/yuanmingyuan/museum-multidraw-batch.js';
import { createArchitectureSurface } from '../src/yuanmingyuan/architecture-surface.js';

const renderer = { extensions: { has: name => name === 'WEBGL_multi_draw' }, capabilities: { maxTextureSize: 4096 } };
const options = { id: 'zhengjuesi', renderer, yieldControl: async () => {} };
const meshes = group => { const result = []; group.traverse(node => { if (node.isMesh) result.push(node); }); return result; };
const hash = geometry => {
  const h = createHash('sha256');
  for (const [name, attribute] of [...Object.entries(geometry.attributes), ['index', geometry.index]]) if (attribute) { h.update(name); h.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)); }
  return h.digest('hex');
};

function fixture() {
  const group = new THREE.Group(), named = new THREE.Group(); group.name = 'full-source'; named.name = 'named-court'; named.rotation.y = .23; group.add(named);
  const resources = new Set(), disposalCounts = new Map();
  const own = item => { resources.add(item); item.addEventListener('dispose', () => disposalCounts.set(item, (disposalCounts.get(item) ?? 0) + 1)); return item; };
  const map = own(new THREE.DataTexture(new Uint8Array([28, 109, 144, 255, 123, 43, 76, 230]), 2, 1)); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.repeat.set(2, 3);
  const normal = own(new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1)); normal.colorSpace = THREE.NoColorSpace;
  const material = own(new THREE.MeshPhysicalMaterial({ map, normalMap: normal, roughness: .77, metalness: .18, clearcoat: .2, side: THREE.DoubleSide, vertexColors: true })); material.name = 'real-pbr'; material.normalScale.set(.38, .43);
  const decorate = geometry => { const a = new Uint8Array(geometry.attributes.position.count * 3); for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 61) % 256; geometry.setAttribute('color', new THREE.Uint8BufferAttribute(a, 3, true)); return own(geometry); };
  const box = decorate(new THREE.BoxGeometry()), sphere = decorate(new THREE.SphereGeometry(.45, 8, 6));
  const add = (geometry, position, scale = [1, 1, 1]) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.castShadow = mesh.receiveShadow = true; named.add(mesh); return mesh; };
  const floor = add(box, [0, -.1, 0], [10, .2, 8]); floor.name = 'floor';
  const detail = add(sphere, [0, .45, 2]); detail.name = 'excluded-carving'; detail.userData.navigation = false;
  const post = add(box, [3, 1, 1], [.3, 2, .3]); post.name = 'post';
  const instances = own(new THREE.InstancedMesh(sphere, material, 3)); instances.name = 'colored-instances'; instances.castShadow = instances.receiveShadow = true;
  for (let i = 0; i < 3; i++) {
    instances.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(-3 + i, .5, -2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * .17), new THREE.Vector3(.5, 1.1, .8)));
    instances.setColorAt(i, new THREE.Color(.25 + i * .17, .44, .72));
  }
  named.add(instances);
  let disposed = false;
  return { group, named, material, map, normal, box, sphere, instances, detail, own, add, resources, disposalCounts, updates: 0, disposeCalls: 0, diagnostics: { originalEvidence: true }, update() { this.updates++; }, dispose() { this.disposeCalls++; if (disposed) return; disposed = true; for (const item of resources) item.dispose(); group.clear(); } };
}
function sourceDisposed(source) { for (const resource of source.resources) assert.equal(source.disposalCounts.get(resource), 1); assert.equal(source.disposeCalls, 1); }
function packedResources(owner) { return meshes(owner.group).flatMap(b => [b.geometry, b._matricesTexture, b._indirectTexture, b._colorsTexture].filter(Boolean)); }
function listenDisposals(resources) { const counts = new Map(); for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1)); return counts; }

test('different complete shapes share one draw object without losing any attributes, topology, material pixels or colored instance', async t => {
  const source = fixture(), originals = meshes(source.group), hashes = new Map([source.box, source.sphere].map(g => [g, hash(g)]));
  const placement = { position: [-530, 4, 183], rotationY: -.41, scale: 1.13 }, provenance = { kind: 'archive', digest: 'a'.repeat(64) };
  const owner = await createMuseumMultiDrawBatch(source, { ...options, placement, sourceProvenance: provenance });
  assert.notEqual(owner, source); const report = owner.diagnostics.multiDrawBatch;
  const resources = packedResources(owner), counts = listenDisposals(resources);
  try {
    assert.equal(report.applied, true); assert.equal(report.completeNativeComparisonPassed, false); assert.equal(report.sourceProvenance, provenance);
    assert.equal(report.originalDraws, 4); assert.equal(report.batches, 1); assert.equal(report.representedInstances, 6); assert.equal(report.packedGeometries, 2);
    assert.equal(report.originalTriangles, report.representedTriangles); assert.equal(owner.collisionGroup, source.group); assert.equal(owner.namedGroupRoot, source.group);
    assert.equal(owner.namedGroupRoot.getObjectByName('named-court'), source.named); assert.equal(source.group.parent, null);
    const batch = meshes(owner.group)[0]; assert.equal(batch.isBatchedMesh, true); assert.equal(batch.material, source.material); assert.equal(batch.material.map, source.map); assert.equal(batch.material.normalMap, source.normal);
    assert.equal(batch.material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(batch.material.normalMap.colorSpace, THREE.NoColorSpace); assert.deepEqual(batch.material.map.repeat.toArray(), [2, 3]);
    assert.equal(batch.perObjectFrustumCulled, true); assert.equal(batch.castShadow, true); assert.equal(batch.receiveShadow, true); assert.equal(batch.material.side, THREE.DoubleSide);
    let maximum = 0, normalError = 0, represented = 0;
    for (const binding of batch.userData.sourceBindings) {
      const original = originals[binding.sourceNodeOrdinal], geometry = original.geometry, range = batch.getGeometryRangeAt(binding.geometryId, {});
      for (const [name, attr] of Object.entries(geometry.attributes)) {
        const packed = batch.geometry.attributes[name];
        assert.equal(packed.array.constructor, attr.array.constructor); assert.equal(packed.normalized, attr.normalized); assert.equal(packed.itemSize, attr.itemSize); assert.equal(packed.gpuType, attr.gpuType);
        assert.deepEqual(packed.array.slice(range.vertexStart * attr.itemSize, (range.vertexStart + attr.count) * attr.itemSize), attr.array);
      }
      for (let i = 0; i < geometry.index.count; i++) assert.equal(batch.geometry.index.getX(range.indexStart + i) - range.vertexStart, geometry.index.getX(i));
      for (let i = 0; i < binding.count; i++) {
        const from = new THREE.Matrix4(), to = new THREE.Matrix4(); if (original.isInstancedMesh) original.getMatrixAt(i, from);
        from.premultiply(original.matrixWorld); batch.getMatrixAt(binding.outputInstanceStart + i, to); to.premultiply(batch.matrixWorld);
        const sourceNormal = new THREE.Matrix3().getNormalMatrix(from), outputNormal = new THREE.Matrix3().getNormalMatrix(to);
        for (let v = 0; v < geometry.attributes.position.count; v++) {
          const p = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, v);
          maximum = Math.max(maximum, p.clone().applyMatrix4(from).distanceTo(p.clone().applyMatrix4(to)));
          const n = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, v);
          normalError = Math.max(normalError, n.clone().applyNormalMatrix(sourceNormal).distanceTo(n.clone().applyNormalMatrix(outputNormal)));
        }
        const actual = batch.getColorAt(binding.outputInstanceStart + i, new THREE.Color());
        if (original.instanceColor) { const expected = new THREE.Color(); original.getColorAt(i, expected); assert.deepEqual(actual.toArray(), expected.toArray()); }
        else assert.deepEqual(actual.toArray(), [1, 1, 1]);
        represented++;
      }
    }
    assert.equal(represented, 6); assert.ok(maximum <= report.maximumMatrixEncodingErrorWorld + 1e-11, JSON.stringify({ maximum, bound: report.maximumMatrixEncodingErrorWorld, normalError })); assert.ok(maximum < 1e-5); assert.ok(normalError < 1e-6);
    t.diagnostic(JSON.stringify({ fixture: 'placed-box-sphere-colored-instances', originalDraws: report.originalDraws, batchObjects: report.batches, instances: represented, triangles: report.representedTriangles, packedGeometryBytes: report.packedGeometryBytes, matrixAndDrawTextureBytes: report.matrixAndDrawTextureBytes, maximumMeasuredVertexErrorWorld: maximum, maximumReportedErrorWorld: report.maximumMatrixEncodingErrorWorld, maximumMeasuredNormalVectorError: normalError }));
    for (const [geometry, before] of hashes) assert.equal(hash(geometry), before);
    owner.update(12); assert.equal(source.updates, 1); assert.equal(owner.diagnostics.originalEvidence, true);
    assert.ok(report.packedGeometryBytes > 0); assert.ok(report.matrixAndDrawTextureBytes > 0);
  } finally { owner.dispose(); owner.dispose(); }
  sourceDisposed(source); for (const resource of resources) assert.equal(counts.get(resource), 1); assert.equal(owner.group.children.length, 0);
});

test('attribute/index layouts, material identity, shadow flags, layers and nested renderOrder stay in separate buckets', async () => {
  const source = fixture(); source.group.remove(source.named);
  const meshSets = [];
  for (let i = 0; i < 9; i++) {
    const nested = new THREE.Group(); nested.renderOrder = i === 8 ? 9 : 0; source.group.add(nested);
    let geometry = source.box, material = source.material;
    if (i === 1) { geometry = source.own(source.box.clone()); geometry.deleteAttribute('uv'); }
    if (i === 2) geometry = source.own(source.box.toNonIndexed());
    if (i === 3) { geometry = source.own(source.box.clone()); geometry.setIndex(new THREE.Uint32BufferAttribute(source.box.index.array, 1)); }
    if (i === 4) material = source.own(source.material.clone());
    const set = [];
    for (let j = 0; j < 2; j++) { const m = new THREE.Mesh(geometry, material); m.position.set(i * 3, 0, j); m.castShadow = i !== 5; m.receiveShadow = i !== 5; m.layers.set(i === 6 ? 2 : 0); m.renderOrder = i === 7 ? 7 : 0; nested.add(m); set.push(m); }
    meshSets.push(set);
  }
  const owner = await createMuseumMultiDrawBatch(source, options);
  try {
    assert.equal(owner.diagnostics.multiDrawBatch.applied, true); assert.equal(meshes(owner.group).length, 9);
    for (const batch of meshes(owner.group)) {
      assert.equal(batch.instanceCount, 2); const ordinal = batch.userData.sourceBindings[0].sourceNodeOrdinal, original = meshSets.flat()[ordinal];
      assert.equal(batch.material, original.material); assert.equal(batch.layers.mask, original.layers.mask); assert.equal(batch.castShadow, original.castShadow); assert.equal(batch.receiveShadow, original.receiveShadow); assert.equal(batch.renderOrder, original.renderOrder); assert.equal(batch.parent.renderOrder, original.parent.renderOrder);
      assert.equal(Boolean(batch.geometry.index), Boolean(original.geometry.index)); assert.deepEqual(Object.keys(batch.geometry.attributes).sort(), Object.keys(original.geometry.attributes).sort());
    }
  } finally { owner.dispose(); } sourceDisposed(source);
});

test('real BatchedMesh callbacks cull each instance separately for main, reflected and shadow cameras', async () => {
  const source = fixture(); source.group.remove(source.named);
  for (const x of [-100, 0, 100]) { const m = new THREE.Mesh(source.box, source.material); m.position.x = x; m.castShadow = true; source.group.add(m); }
  const owner = await createMuseumMultiDrawBatch(source, options), batch = meshes(owner.group)[0], depth = new THREE.MeshDepthMaterial();
  try {
    for (const [x, y, shadow] of [[0, 4, false], [100, -4, false], [-100, 7, true]]) {
      const camera = new THREE.PerspectiveCamera(35, 1.4, .1, 60); camera.position.set(x, y, 12); camera.lookAt(x, 0, 0); camera.updateMatrixWorld(true);
      if (shadow) batch.onBeforeShadow(renderer, null, camera, camera, batch.geometry, depth); else batch.onBeforeRender(renderer, null, camera, batch.geometry, batch.material);
      const expected = x === -100 ? 0 : x === 0 ? 1 : 2;
      assert.equal(batch._multiDrawCount, 1); assert.equal(batch._indirectTexture.image.data[0], expected);
      const geometryId = batch.getGeometryIdAt(expected), range = batch.getGeometryRangeAt(geometryId, {});
      assert.equal(batch._multiDrawCounts[0], source.box.index.count); assert.equal(batch._multiDrawStarts[0], range.indexStart * batch.geometry.index.array.BYTES_PER_ELEMENT);
    }
    batch.setVisibleAt(1, false); const camera = new THREE.PerspectiveCamera(35, 1.4, .1, 60); camera.position.set(0, 4, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    batch.onBeforeRender(renderer, null, camera, batch.geometry, batch.material); assert.equal(batch._multiDrawCount, 0);
  } finally { depth.dispose(); owner.dispose(); } sourceDisposed(source);
});

test('only the packed root is rendered; actual named source and navigation exclusions remain queryable', async () => {
  const source = fixture(), owner = await createMuseumMultiDrawBatch(source, options), scene = new THREE.Scene(), query = createArchitectureSurface(owner.collisionGroup);
  try {
    scene.add(owner.group); assert.equal(source.group.parent, null); assert.equal(meshes(scene).length, 1);
    const p = new THREE.Vector3(0, 0, 2).applyMatrix4(source.named.matrixWorld), hit = query.surfaceAt(p.x, p.z);
    assert.ok(Math.abs(hit.height) < 1e-7); assert.equal(owner.namedGroupRoot.getObjectByName('excluded-carving'), source.detail);
  } finally { query.dispose(); owner.dispose(); } assert.equal(scene.children.length, 0); sourceDisposed(source);
});

test('packing promotes indices without dropping unused vertices or changing triangle references', async () => {
  const source = fixture(); source.group.clear();
  const originals = [];
  for (let j = 0; j < 2; j++) {
    const geometry = source.own(new THREE.BufferGeometry()), positions = new Float32Array(32770 * 3);
    positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0]); positions[positions.length - 1] = .125 + j;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(new THREE.Uint16BufferAttribute([0, 1, 2], 1)); originals.push(geometry);
    const mesh = new THREE.Mesh(geometry, source.material); mesh.position.x = j * 2; source.group.add(mesh);
  }
  const owner = await createMuseumMultiDrawBatch(source, options);
  try {
    assert.equal(owner.diagnostics.multiDrawBatch.applied, true); const batch = meshes(owner.group)[0];
    assert.ok(batch.geometry.index.array instanceof Uint32Array); assert.equal(batch.geometry.attributes.position.count, 65540);
    for (const record of batch.userData.sourceGeometries) {
      const original = originals.find(g => g.uuid === record.sourceGeometry), range = batch.getGeometryRangeAt(record.geometryId, {});
      assert.deepEqual(batch.geometry.attributes.position.array.slice(range.vertexStart * 3, (range.vertexStart + range.vertexCount) * 3), original.attributes.position.array);
      for (let i = 0; i < 3; i++) assert.equal(batch.geometry.index.getX(range.indexStart + i) - range.vertexStart, original.index.getX(i));
    }
    assert.equal(owner.diagnostics.multiDrawBatch.originalTriangles, 2); assert.equal(owner.diagnostics.multiDrawBatch.representedTriangles, 2);
  } finally { owner.dispose(); } sourceDisposed(source);
});

test('inherited visibility and stock custom shadow materials stay attached without mutating the source', async () => {
  const source = fixture(), depth = source.own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })), distance = source.own(new THREE.MeshDistanceMaterial());
  source.named.visible = false;
  for (const node of meshes(source.group)) { node.customDepthMaterial = depth; node.customDistanceMaterial = distance; node.frustumCulled = false; }
  const owner = await createMuseumMultiDrawBatch(source, options);
  try {
    assert.equal(owner.diagnostics.multiDrawBatch.applied, true); const batch = meshes(owner.group)[0];
    assert.equal(batch.visible, false); assert.equal(batch.frustumCulled, false); assert.equal(batch.perObjectFrustumCulled, true);
    assert.equal(batch.customDepthMaterial, depth); assert.equal(batch.customDistanceMaterial, distance);
    assert.equal(source.named.visible, false); assert.equal(owner.diagnostics.multiDrawBatch.representedInstances, 6);
  } finally { owner.dispose(); } sourceDisposed(source);
});

for (const [name, mutate] of [
  ['partial drawRange', s => s.box.setDrawRange(3, 6)],
  ['material arrays/groups', s => { s.detail.material = [s.material, s.material]; }],
  ['custom shader', s => { s.material.onBeforeCompile = () => {}; }],
  ['material render callback', s => { s.material.onBeforeRender = () => {}; }],
  ['object render callback', s => { s.detail.onAfterRender = () => {}; }],
  ['negative determinant', s => { s.detail.scale.x = -1; }],
  ['zero scale', s => { s.detail.scale.y = 0; }],
  ['shear', s => { s.detail.matrixAutoUpdate = false; s.detail.matrix.makeShear(.2, 0, 0, 0, 0, 0); }],
  ['projective matrix', s => { s.detail.matrixAutoUpdate = false; s.detail.matrix.elements[3] = .01; }],
  ['transparency', s => { s.material.transparent = true; }],
  ['transmission', s => { s.material.transmission = .2; }],
  ['disabled depth test', s => { s.material.depthTest = false; }],
  ['disabled depth write', s => { s.material.depthWrite = false; }],
  ['order-dependent depth function', s => { s.material.depthFunc = THREE.AlwaysDepth; }],
  ['additive blending', s => { s.material.blending = THREE.AdditiveBlending; }],
  ['morph targets', s => { s.box.morphAttributes.position = [s.box.attributes.position.clone()]; }],
  ['interleaved input', s => { s.box.setAttribute('uv', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Float32Array(s.box.attributes.position.count * 3), 3), 2, 1)); }],
  ['nonfinite attribute', s => { s.box.attributes.normal.array[0] = NaN; }],
  ['custom instance attribute', s => { s.box.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(s.box.attributes.position.count * 3), 3)); }],
]) test(`${name} returns the same intact source owner`, async () => {
  const source = fixture(); mutate(source); const children = [...source.group.children], geometryHashes = [hash(source.box), hash(source.sphere)];
  const owner = await createMuseumMultiDrawBatch(source, options);
  assert.equal(owner, source); assert.equal(owner.diagnostics.multiDrawBatch.applied, false); assert.equal(owner.diagnostics.multiDrawBatch.reason, 'multidraw-declined');
  assert.deepEqual(source.group.children, children); assert.deepEqual([hash(source.box), hash(source.sphere)], geometryHashes); assert.equal(source.disposalCounts.size, 0);
  owner.dispose(); sourceDisposed(source);
});

test('missing extension, unverified capability, allowlist and no benefit safely retain source instead of expanding draw calls', async () => {
  for (const [extra, reason] of [[{ renderer: null }, 'multi-draw-extension-absent-or-unverified'], [{ renderer: { ...renderer, extensions: { has: () => false } } }, 'multi-draw-extension-absent-or-unverified'], [{ renderer: { extensions: renderer.extensions } }, 'texture-capacity-unverified'], [{ id: 'hanjingtang' }, 'asset-not-allowlisted']]) {
    const source = fixture(), owner = await createMuseumMultiDrawBatch(source, { ...options, ...extra }); assert.equal(owner, source); assert.equal(owner.diagnostics.multiDrawBatch.reason, reason); owner.dispose(); sourceDisposed(source);
  }
  const source = fixture(); source.group.clear(); source.group.add(source.instances);
  const owner = await createMuseumMultiDrawBatch(source, options); assert.equal(owner, source); assert.equal(owner.diagnostics.multiDrawBatch.reason, 'no-object-draw-reduction'); owner.dispose(); sourceDisposed(source);
});

test('Haiyue is admitted to this opt-in converter and excessive matrix error remains a source fallback', async () => {
  const source = fixture(), owner = await createMuseumMultiDrawBatch(source, { ...options, id: 'haiyue' }); assert.notEqual(owner, source); owner.dispose(); sourceDisposed(source);
  const exacting = fixture(), fallback = await createMuseumMultiDrawBatch(exacting, { ...options, maximumErrorWorld: 1e-15 }); assert.equal(fallback, exacting); assert.match(fallback.diagnostics.multiDrawBatch.error.message, /encoding/); fallback.dispose(); sourceDisposed(exacting);
});

test('actual texture capacity and already-adapted owners decline without disposing the original render owner', async () => {
  const source = fixture(), smallRenderer = { ...renderer, capabilities: { maxTextureSize: 4 } };
  for (let i = 0; i < 12; i++) source.add(source.box, [i, 0, 5]);
  const tooLarge = await createMuseumMultiDrawBatch(source, { ...options, renderer: smallRenderer }); assert.equal(tooLarge, source); assert.match(tooLarge.diagnostics.multiDrawBatch.error.message, /capacity/); assert.equal(source.disposeCalls, 0);
  tooLarge.dispose(); sourceDisposed(source);
  const other = fixture(), collision = new THREE.Group(); other.collisionGroup = collision; other.namedGroupRoot = collision;
  const retained = await createMuseumMultiDrawBatch(other, options); assert.equal(retained, other); assert.equal(retained.collisionGroup, collision); assert.equal(retained.namedGroupRoot, collision); retained.dispose(); sourceDisposed(other);
});

test('abort before or during packing disposes the acquired source exactly once', async () => {
  for (const phase of ['before', 'multidraw-geometries', 'multidraw-complete']) {
    const source = fixture(), controller = new AbortController(), reason = new Error(`cancel-${phase}`);
    if (phase === 'before') controller.abort(reason);
    await assert.rejects(createMuseumMultiDrawBatch(source, { ...options, signal: controller.signal, onProgress: p => { if (p.phase === phase) controller.abort(reason); } }), error => error === reason);
    sourceDisposed(source);
  }
});

test('abort at a real async checkpoint releases both packed textures and geometry without publishing a partial owner', async () => {
  const source = fixture(), controller = new AbortController(), captured = [], originalAdd = THREE.BatchedMesh.prototype.addGeometry;
  let packed = [], counts;
  THREE.BatchedMesh.prototype.addGeometry = function (...args) { if (!captured.includes(this)) captured.push(this); return originalAdd.apply(this, args); };
  try {
    await assert.rejects(createMuseumMultiDrawBatch(source, { ...options, signal: controller.signal, yieldControl: async () => {
      await new Promise(resolve => setImmediate(resolve));
      if (captured.length) { packed = captured.flatMap(b => [b.geometry, b._matricesTexture, b._indirectTexture]); counts = listenDisposals(packed); controller.abort(); }
    } }), { name: 'AbortError' });
    assert.ok(packed.length >= 3); for (const item of packed) assert.equal(counts.get(item), 1);
    assert.equal(captured[0]._matricesTexture, null); assert.equal(source.group.children.length, 0); sourceDisposed(source);
  } finally { THREE.BatchedMesh.prototype.addGeometry = originalAdd; }
});

test('a throwing packed resource or detach listener cannot skip remaining texture/source release', async () => {
  const source = fixture(), owner = await createMuseumMultiDrawBatch(source, options), resources = packedResources(owner), counts = listenDisposals(resources), scene = new THREE.Scene();
  const batch = meshes(owner.group)[0]; batch.geometry.addEventListener('dispose', () => { throw new Error('geometry-listener'); });
  owner.group.addEventListener('removed', () => { throw new Error('detach-listener'); }); scene.add(owner.group);
  assert.throws(() => owner.dispose(), AggregateError); owner.dispose();
  for (const resource of resources) assert.equal(counts.get(resource), 1); sourceDisposed(source);
  assert.equal(batch._matricesTexture, null); assert.equal(batch._colorsTexture, null); assert.equal(scene.children.length, 0);
});
