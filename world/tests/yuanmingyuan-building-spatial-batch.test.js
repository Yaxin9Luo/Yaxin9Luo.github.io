import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBuildingDistanceAsset } from '../src/yuanmingyuan/zhengjuesi-distance-builder.js';
import { zhengjuesiDistanceCandidates, zhengjuesiDistanceCandidateError } from '../src/yuanmingyuan/zhengjuesi-distance-geometry.js';
import { createBuildingDistanceAsset as createBeforeSpatial } from './fixtures/building-distance-before-spatial.js';
import { createMuseumStaticBatch, placeMuseumStaticAsset } from '../src/yuanmingyuan/museum-static-batch.js';

const meshes = group => { const result = []; group.traverse(node => { if (node.isMesh) result.push(node); }); return result; };
const triangles = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
const options = { id: 'fixture', maximumErrorWorld: 1e-5, candidateProvider: () => [], candidateError: () => { throw new Error('No geometry candidate is allowed.'); }, yieldControl: async () => {} };
const bytes = attribute => attribute && { itemSize: attribute.itemSize, normalized: attribute.normalized, type: attribute.array.constructor.name, data: Array.from(attribute.array) };
function digestGeometry(geometry) {
  const hash = createHash('sha256');
  for (const [name, attr] of [...Object.entries(geometry.attributes), ['index', geometry.index]]) {
    if (!attr) continue;
    hash.update(name); hash.update(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
  }
  return hash.digest('hex');
}
function fixture({ transformed = false, transparent = true, extraGeometry = false } = {}) {
  const group = new THREE.Group(); group.name = 'source-static-clusters'; group.userData = { historicalSource: 'fixture-only' };
  if (transformed) { group.position.set(-37, 6.3, 29); group.rotation.y = .37; group.scale.setScalar(1.23); }
  const texture = new THREE.DataTexture(new Uint8Array([122, 63, 18, 255]), 1, 1), geometry = new THREE.BoxGeometry(1.2, 1.8, .8), secondGeometry = extraGeometry ? new THREE.BoxGeometry(.7, 1.1, .9) : geometry;
  const material = new THREE.MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture, roughness: .64, vertexColors: true }), glass = new THREE.MeshPhysicalMaterial({ map: texture, opacity: .3, transparent: true }); material.name = 'actual-shared-PBR'; geometry.name = 'actual-shared-box';
  const color = new Float32Array(geometry.attributes.position.count * 3); color.fill(.7); geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  const owned = new Set([texture, geometry, secondGeometry, material, glass]), disposals = new Map(), events = [];
  for (const item of owned) item.addEventListener('dispose', () => { disposals.set(item, (disposals.get(item) ?? 0) + 1); events.push('source'); });
  for (const [cluster, centre] of [[0, [-47, 3, -34]], [1, [7, 4, 7]], [2, [68, 21, -45]], [3, [-10, -19, 61]]]) {
    const parent = new THREE.Group(); parent.name = 'named-courtyard-' + cluster; parent.position.fromArray(centre); parent.rotation.y = transformed ? -.18 : 0; parent.renderOrder = 2; group.add(parent);
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(i % 3 === 0 ? secondGeometry : geometry, material); mesh.name = `authored-${cluster}-${i}`; mesh.position.set((i % 4) * 1.2, .1 * (i % 2), Math.floor(i / 4) * 1.3); mesh.scale.set(.62, 1 + .02 * i, .71); mesh.rotation.y = transformed ? .07 * i : 0;
      mesh.castShadow = mesh.receiveShadow = true; mesh.layers.set(3); mesh.userData = { navigation: i !== 0, historicPart: `${cluster}/${i}` }; parent.add(mesh);
    }
    const instances = new THREE.InstancedMesh(geometry, material, 5); instances.name = 'colored-' + cluster; instances.castShadow = instances.receiveShadow = true; instances.layers.set(3); instances.userData.navigation = false;
    for (let i = 0; i < 5; i++) {
      instances.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(1.5 + i * .55, 1, 4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .13 * i), new THREE.Vector3(.55, .8, .62)));
      instances.setColorAt(i, new THREE.Color(.2 + .1 * i, .35, .8 - .1 * i));
    }
    instances.addEventListener('dispose', () => { disposals.set(instances, (disposals.get(instances) ?? 0) + 1); events.push('source'); }); owned.add(instances); parent.add(instances);
  }
  if (transparent) { const mesh = new THREE.Mesh(geometry, glass); mesh.name = 'retained-glass'; mesh.position.set(0, 2, 0); mesh.userData.navigation = false; group.add(mesh); }
  let disposed = false;
  return { group, geometry, material, texture, owned, disposals, events, dispose() { if (disposed) return; disposed = true; for (const item of owned) item.dispose(); group.clear(); } };
}
function snapshot(owner) {
  const nodes = [];
  owner.group.traverse(node => {
    const entry = { type: node.type, name: node.name, userData: node.userData, matrix: node.matrix.toArray(), matrixWorld: node.matrixWorld.toArray(), visible: node.visible, castShadow: node.castShadow, receiveShadow: node.receiveShadow, frustumCulled: node.frustumCulled, renderOrder: node.renderOrder, layers: node.layers.mask };
    if (node.isMesh) Object.assign(entry, {
      geometry: { name: node.geometry.name, attributes: Object.fromEntries(Object.entries(node.geometry.attributes).map(([name, value]) => [name, bytes(value)])), index: bytes(node.geometry.index), groups: node.geometry.groups, drawRange: node.geometry.drawRange },
      material: { name: node.material.name, type: node.material.type, color: node.material.color.toArray(), vertexColors: node.material.vertexColors, roughness: node.material.roughness, metalness: node.material.metalness, map: node.material.map?.uuid, normalMap: node.material.normalMap?.uuid, roughnessMap: node.material.roughnessMap?.uuid, transparent: node.material.transparent },
      count: node.count, instanceMatrix: bytes(node.instanceMatrix), instanceColor: bytes(node.instanceColor), boundingBox: node.boundingBox && [node.boundingBox.min.toArray(), node.boundingBox.max.toArray()], boundingSphere: node.boundingSphere && [node.boundingSphere.center.toArray(), node.boundingSphere.radius],
    });
    nodes.push(entry);
  });
  return { report: owner.report, nodes };
}
function sourceRecords(source) {
  source.group.updateWorldMatrix(true, true);
  return meshes(source.group).flatMap((node, ordinal) => Array.from({ length: node.isInstancedMesh ? node.count : 1 }, (_, instance) => {
    const local = new THREE.Matrix4(); if (node.isInstancedMesh) node.getMatrixAt(instance, local);
    const world = new THREE.Matrix4().multiplyMatrices(node.matrixWorld, local), box = new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position).applyMatrix4(world);
    return { node, ordinal, instance, world, box, key: `${ordinal}/${instance}` };
  }));
}
function expandedBindings(output) {
  return meshes(output.group).flatMap(node => (node.userData.sourceBindings ?? []).flatMap(binding => binding.count === undefined ? [{ node, ordinal: binding.sourceNodeOrdinal, instance: binding.sourceInstance, firstVertex: binding.firstVertex, vertexCount: binding.vertexCount }] : Array.from({ length: binding.count }, (_, i) => ({ node, ordinal: binding.sourceNodeOrdinal, instance: binding.sourceInstanceStart + i, outputInstance: binding.outputInstanceStart + i }))));
}
function cellOf(box, size) { const centre = box.getCenter(new THREE.Vector3()); return centre.toArray().map(value => Math.floor(value / size)); }
function assertEachSourceOnce(source, output) {
  const original = sourceRecords(source).filter(record => !record.node.material.transparent), actual = expandedBindings(output), expected = new Map(original.map(record => [record.key, record])), seen = new Set();
  for (const binding of actual) {
    const key = `${binding.ordinal}/${binding.instance}`;
    assert.ok(expected.has(key), `Unexpected source binding ${key}`); assert.ok(!seen.has(key), `Duplicate source binding ${key}`); seen.add(key);
    assert.deepEqual(binding.node.userData.spatialCell, cellOf(expected.get(key).box, output.report.spatialBatching.cellSizeWorld));
  }
  assert.deepEqual([...seen].sort(), [...expected.keys()].sort());
  return { expected, actual };
}

test('omitted and zero spatial options match the frozen default builder in both original batching paths', async () => {
  const source = fixture({ transformed: true, extraGeometry: true }), before = new Map([...source.owned].filter(item => item.isBufferGeometry).map(g => [g, digestGeometry(g)]));
  try {
    for (const sparseInstanceLimit of [0, 32]) {
      const baseline = await createBeforeSpatial(source, { ...options, sparseInstanceLimit });
      try {
        for (const value of [undefined, 0]) {
          const actual = await createBuildingDistanceAsset(source, { ...options, sparseInstanceLimit, ...(value === undefined ? {} : { spatialCellSizeWorld: value }) });
          try { assert.deepEqual(snapshot(actual), snapshot(baseline)); assert.equal(actual.report.spatialBatching, undefined); }
          finally { actual.dispose(); }
        }
      } finally { baseline.dispose(); }
    }
    for (const [g, hash] of before) assert.equal(digestGeometry(g), hash);
    assert.equal(source.disposals.size, 0);
  } finally { source.dispose(); }
});

test('world-centre chunks preserve every original instance, borrowed attributes, material, color, normal and placed surface', async () => {
  const source = fixture({ transformed: true }), inputNodes = meshes(source.group), before = digestGeometry(source.geometry), originals = sourceRecords(source), originalMatrices = originals.map(record => record.node.instanceMatrix && Array.from(record.node.instanceMatrix.array));
  const output = await createBuildingDistanceAsset(source, { ...options, sparseInstanceLimit: 0, spatialCellSizeWorld: 16 });
  try {
    const { expected, actual } = assertEachSourceOnce(source, output);
    assert.equal(output.report.originalTriangles, output.report.distanceTriangles); assert.equal(output.report.originalInstances, output.report.representedInstances); assert.equal(output.report.spatialBatching.partitionedInstances, expected.size); assert.equal(output.report.mergedDraws, 0);
    assert.ok(output.report.distanceDraws < output.report.originalDraws); assert.ok(output.report.spatialBatching.occupiedCells >= 4);
    let measured = 0, normalError = 0;
    for (const binding of actual) {
      const original = expected.get(`${binding.ordinal}/${binding.instance}`), node = binding.node, instance = new THREE.Matrix4(); node.getMatrixAt(binding.outputInstance, instance);
      assert.equal(node.geometry, original.node.geometry); assert.equal(node.material, original.node.material); assert.equal(node.material.map, source.texture); assert.equal(node.material.normalMap, source.texture); assert.equal(node.material.roughnessMap, source.texture);
      assert.equal(node.layers.mask, original.node.layers.mask); assert.equal(node.castShadow, original.node.castShadow); assert.equal(node.receiveShadow, original.node.receiveShadow); assert.equal(node.parent.renderOrder, 2);
      const world = new THREE.Matrix4().multiplyMatrices(node.matrixWorld, instance), worldBounds = node.boundingBox.clone().applyMatrix4(node.matrixWorld), sphere = node.boundingSphere.clone().applyMatrix4(node.matrixWorld), sourceNormal = new THREE.Matrix3().getNormalMatrix(original.world), outputNormal = new THREE.Matrix3().getNormalMatrix(world);
      for (let i = 0; i < node.geometry.attributes.position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(node.geometry.attributes.position, i), a = p.clone().applyMatrix4(original.world), b = p.clone().applyMatrix4(world);
        measured = Math.max(measured, a.distanceTo(b));
        assert.ok(worldBounds.clone().expandByScalar(1e-12).containsPoint(b)); assert.ok(sphere.distanceToPoint(b) <= 1e-12);
        assert.ok(worldBounds.clone().expandByScalar(output.report.maximumErrorArchiveWorld + 1e-12).containsPoint(a));
        const n = new THREE.Vector3().fromBufferAttribute(node.geometry.attributes.normal, i);
        normalError = Math.max(normalError, n.clone().applyMatrix3(sourceNormal).normalize().distanceTo(n.clone().applyMatrix3(outputNormal).normalize()));
      }
      const expectedColor = new THREE.Color(1, 1, 1), actualColor = new THREE.Color(1, 1, 1);
      if (original.node.instanceColor) original.node.getColorAt(original.instance, expectedColor);
      if (node.instanceColor) node.getColorAt(binding.outputInstance, actualColor);
      assert.deepEqual(actualColor.toArray(), expectedColor.toArray());
    }
    assert.ok(measured <= output.report.maximumErrorArchiveWorld + 1e-12); assert.ok(normalError < 1e-7); assert.equal(digestGeometry(source.geometry), before);
    assert.deepEqual(originals.map(record => record.node.instanceMatrix && Array.from(record.node.instanceMatrix.array)), originalMatrices);
    const pane = meshes(output.group).find(node => node.name === 'retained-glass'), originalPane = inputNodes.at(-1);
    assert.equal(pane.geometry, originalPane.geometry); assert.equal(pane.material, originalPane.material); assert.deepEqual(pane.userData, originalPane.userData);
    // Source bounds stay lazy; owned per-chunk bounds do not modify prototypes.
    assert.equal(source.geometry.boundingBox, null); assert.equal(source.geometry.boundingSphere, null);
    const released = output.dispose(); assert.equal(released.borrowedSourceResourcesDisposed, 0); assert.equal(released.geometries, 0); assert.equal(released.materials, 0); assert.equal(released.instancedMeshes, output.report.instancedDraws); assert.deepEqual(output.dispose(), released); assert.equal(source.disposals.size, 0);
  } finally { output.dispose(); source.dispose(); }
});

test('the real dressed-stone candidate retains identical default selection, bounds, encoding and output buffers', async () => {
  const geometry = new RoundedBoxGeometry(1, 1, 1, 2, .022), material = new THREE.MeshStandardMaterial(), group = new THREE.Group(), instances = new THREE.InstancedMesh(geometry, material, 2);
  geometry.name = 'zhengjuesi-prototype-dressed-stone'; group.add(instances); group.position.set(-19.3, 2.1, 7.8); group.rotation.y = .12;
  for (const [index, [position, scale]] of [[[5, 3, 5], [.4, .04, .35]], [[60, 3, 5], [30, .19, 20]]].entries()) instances.setMatrixAt(index, new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion(), new THREE.Vector3(...scale)));
  const settings = { ...options, maximumErrorWorld: .04, candidateProvider: zhengjuesiDistanceCandidates, candidateError: zhengjuesiDistanceCandidateError }, before = digestGeometry(geometry), baseline = await createBeforeSpatial({ group }, settings);
  try {
    for (const spatialCellSizeWorld of [0, 16]) {
      const actual = await createBuildingDistanceAsset({ group }, { ...settings, spatialCellSizeWorld });
      try {
        if (!spatialCellSizeWorld) assert.deepEqual(snapshot(actual), snapshot(baseline));
        else { assert.deepEqual(actual.report.geometries, baseline.report.geometries); assert.equal(actual.report.distanceTriangles, baseline.report.distanceTriangles); assertEachSourceOnce({ group }, actual); }
        assert.equal(actual.report.originalTriangles, 600); assert.equal(actual.report.distanceTriangles, 312); assert.equal(actual.report.geometries[0].retainedInstances, 1); assert.equal(actual.report.geometries[0].variants[0].instances, 1);
      } finally { actual.dispose(); }
    }
    assert.equal(digestGeometry(geometry), before);
  } finally { baseline.dispose(); instances.dispose(); geometry.dispose(); material.dispose(); }
});

test('negative and exact-boundary centres are deterministic and large cross-cell primitives remain whole', async () => {
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry(40, 2, 3), material = new THREE.MeshStandardMaterial();
  for (const [i, x] of [-32, -16, -1e-8, 0, 16 - 1e-8, 16, 32].entries()) { const mesh = new THREE.Mesh(geometry, material); mesh.name = 'boundary-' + i; mesh.position.set(x, 4, -16); group.add(mesh); }
  const output = await createBuildingDistanceAsset({ group }, { ...options, sparseInstanceLimit: 0, spatialCellSizeWorld: 16 });
  try {
    const { actual } = assertEachSourceOnce({ group }, output);
    assert.deepEqual(actual.map(binding => binding.node.userData.spatialCell[0]), [-2, -1, -1, 0, 0, 1, 2]);
    assert.equal(output.report.distanceTriangles, 84); assert.equal(output.report.representedInstances, 7); assert.ok(meshes(output.group).every(mesh => mesh.boundingBox.getSize(new THREE.Vector3()).x >= 40));
  } finally { output.dispose(); geometry.dispose(); material.dispose(); }
});

test('optional sparse merging also stays within cells and encodes every original surface once', async () => {
  const source = fixture({ transformed: true, transparent: false, extraGeometry: true }), output = await createBuildingDistanceAsset(source, { ...options, sparseInstanceLimit: 32, spatialCellSizeWorld: 16 });
  try {
    const { expected, actual } = assertEachSourceOnce(source, output);
    assert.ok(output.report.mergedDraws > 0); assert.equal(output.report.spatialBatching.batchChunks, output.report.mergedDraws + output.report.instancedDraws); assert.equal(output.report.distanceTriangles, output.report.originalTriangles);
    for (const binding of actual) {
      if (binding.outputInstance !== undefined) continue;
      const original = expected.get(`${binding.ordinal}/${binding.instance}`);
      for (let i = 0; i < binding.vertexCount; i++) {
        const a = new THREE.Vector3().fromBufferAttribute(original.node.geometry.attributes.position, i).applyMatrix4(original.world), b = new THREE.Vector3().fromBufferAttribute(binding.node.geometry.attributes.position, binding.firstVertex + i).applyMatrix4(binding.node.matrixWorld);
        assert.ok(a.distanceTo(b) <= output.report.maximumErrorArchiveWorld + 1e-12);
      }
    }
    output.dispose(); assert.equal(source.disposals.size, 0);
  } finally { output.dispose(); source.dispose(); }
});

test('actual Three frustum culling excludes distant clusters while retaining every visible source and projected surface', async t => {
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 2, 1), material = new THREE.MeshStandardMaterial();
  for (const x of [-112, 8, 128]) for (let i = 0; i < 16; i++) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x + (i % 4), 1, 3 + Math.floor(i / 4)); group.add(mesh); }
  const source = { group }, baseline = await createBuildingDistanceAsset(source, { ...options, sparseInstanceLimit: 0 }), output = await createBuildingDistanceAsset(source, { ...options, sparseInstanceLimit: 0, spatialCellSizeWorld: 16 });
  try {
    const camera = new THREE.PerspectiveCamera(40, 1, .04, 1200); camera.position.set(9.5, 10, 34); camera.lookAt(9.5, 1, 4.5); camera.updateMatrixWorld(true);
    const projectionView = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), frustum = new THREE.Frustum().setFromProjectionMatrix(projectionView), visible = owner => meshes(owner.group).filter(mesh => frustum.intersectsObject(mesh)), submittedTriangles = owner => visible(owner).reduce((sum, node) => sum + triangles(node.geometry) * (node.count ?? 1), 0);
    const original = sourceRecords(source), bound = expandedBindings(output), outputBySource = new Map(bound.map(binding => [`${binding.ordinal}/${binding.instance}`, binding])); let visibleOriginals = 0, maximumProjectedError = 0;
    for (const record of original) {
      if (!frustum.intersectsObject(record.node)) continue;
      visibleOriginals++;
      const binding = outputBySource.get(record.key); assert.ok(binding); assert.ok(frustum.intersectsObject(binding.node), 'A visible original must remain in a submitted chunk');
      const local = new THREE.Matrix4(); binding.node.getMatrixAt(binding.outputInstance, local);
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i), a = p.clone().applyMatrix4(record.world).applyMatrix4(projectionView), b = p.clone().applyMatrix4(local).applyMatrix4(binding.node.matrixWorld).applyMatrix4(projectionView);
        maximumProjectedError = Math.max(maximumProjectedError, a.distanceTo(b));
      }
    }
    assert.equal(visibleOriginals, 16); assert.equal(visible(baseline).length, 1); assert.equal(visible(output).length, 1); assert.equal(submittedTriangles(baseline), 576); assert.equal(submittedTriangles(output), 192); assert.equal(output.report.originalTriangles, output.report.distanceTriangles); assert.equal(output.report.distanceDraws, 3); assert.ok(maximumProjectedError < 1e-12);
    t.diagnostic(JSON.stringify({ method: 'CPU Three.Frustum.intersectsObject; no renderer', originalDraws: 48, unpartitionedBatchDraws: 1, chunkedBatchDraws: 3, visibleSourceInstances: visibleOriginals, unpartitionedSubmittedTriangles: submittedTriangles(baseline), chunkedSubmittedTriangles: submittedTriangles(output), totalTrianglesRetained: output.report.distanceTriangles, maximumProjectedError }));
  } finally { output.dispose(); baseline.dispose(); geometry.dispose(); material.dispose(); }
});

test('museum default uses world 16 m chunks with one draw group and borrowed-source disposal in order', async () => {
  const source = fixture({ transparent: false }), placement = { position: [-190, 4, 221], rotationY: -.28, scale: .83 }, owner = await createMuseumStaticBatch(source, { id: 'haiyue', placement, yieldControl: async () => {} });
  try {
    const near = owner.diagnostics.nearBatch; assert.equal(near.applied, true); assert.equal(near.spatialCellSizeWorld, 16); assert.equal(near.builderReport.spatialBatching.cellSizeWorld, 16); assert.equal(owner.collisionGroup, source.group); assert.equal(owner.namedGroupRoot, source.group);
    assertEachSourceOnce(source, { group: owner.group, report: near.builderReport });
    assert.deepEqual(owner.group.matrixWorld.toArray(), source.group.matrixWorld.toArray());
    const scene = new THREE.Scene(); scene.add(owner.group); assert.equal(source.group.parent, null); assert.equal(meshes(scene).length, near.builderReport.distanceDraws);
    for (const mesh of meshes(owner.group)) mesh.addEventListener('dispose', () => source.events.push('batch'));
    owner.dispose(); owner.dispose(); assert.equal(scene.children.length, 0); assert.equal(source.events.slice(0, near.builderReport.instancedDraws).every(kind => kind === 'batch'), true);
    for (const item of source.owned) assert.equal(source.disposals.get(item), 1);
  } finally { owner.dispose(); }
});

test('spatial no-gain and invalid-size cases preserve the complete owner; explicit zero retains old one-batch behavior', async () => {
  for (const size of [undefined, 0, -1, Infinity, NaN]) {
    const group = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(); let disposed = 0;
    for (const x of [4, 100]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, 4, 4); group.add(mesh); }
    const source = { group, dispose() { if (disposed++) return; geometry.dispose(); material.dispose(); group.clear(); } }, owner = await createMuseumStaticBatch(source, { id: 'zhengjuesi', ...(size === undefined ? {} : { spatialCellSizeWorld: size }), yieldControl: async () => {} });
    try {
      assert.equal(disposed, 0);
      if (size === 0) { assert.notEqual(owner, source); assert.equal(owner.diagnostics.nearBatch.applied, true); assert.equal(owner.diagnostics.nearBatch.builderReport.distanceDraws, 1); assert.equal(owner.diagnostics.nearBatch.builderReport.spatialBatching, undefined); }
      else { assert.equal(owner, source); assert.equal(meshes(owner.group).length, 2); assert.equal(owner.diagnostics.nearBatch.reason, size === undefined ? 'no-draw-reduction' : 'batch-declined'); }
    } finally { owner.dispose(); }
    assert.equal(disposed, 1);
  }
});

test('placed roots can move together after partition without dropping projected geometry', async () => {
  const source = fixture({ transparent: false }), owner = await createMuseumStaticBatch(source, { id: 'zhengjuesi', yieldControl: async () => {} });
  try {
    assert.equal(owner.diagnostics.nearBatch.applied, true);
    const count = meshes(owner.group).length;
    placeMuseumStaticAsset(owner, { position: [281, 4.3, -179], rotationY: .41, scale: 1 });
    assert.equal(meshes(owner.group).length, count); assert.deepEqual(owner.group.matrixWorld.toArray(), owner.collisionGroup.matrixWorld.toArray());
    const original = new Map(sourceRecords(source).map(record => [record.key, record]));
    for (const binding of expandedBindings(owner)) {
      const record = original.get(`${binding.ordinal}/${binding.instance}`), matrix = new THREE.Matrix4(); binding.node.getMatrixAt(binding.outputInstance, matrix);
      for (let i = 0; i < binding.node.geometry.attributes.position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(binding.node.geometry.attributes.position, i), a = point.clone().applyMatrix4(record.world), b = point.clone().applyMatrix4(matrix).applyMatrix4(binding.node.matrixWorld);
        assert.ok(a.distanceTo(b) <= owner.diagnostics.nearBatch.builderReport.maximumErrorArchiveWorld + 1e-12);
      }
    }
  } finally { owner.dispose(); }
});
