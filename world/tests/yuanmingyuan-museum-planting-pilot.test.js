import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMuseumPlantingPilot, createMuseumPlantingPilotPlan, museumPlantingPilotSpec } from '../src/yuanmingyuan/museum-planting-pilot.js';
import { createGardenPlantingLayout } from '../src/yuanmingyuan/garden-planting-layout.js';
import { createTriangleSampler } from '../src/yuanmingyuan/terrain-geometry.js';
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';

const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const rectangle = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const rootNames = { willow: 'willow-trunk-and-roots', juniper: 'juniper-visible-trunk', 'lake-rock': 'lake-rock-main' };
const baseline = createGardenPlantingLayout();

// Two actual upward Float32 triangles. Their deliberately non-layout height and
// gentle slope expose accidentally trusting the authored layout Y=4 estimate.
function terrainFixture({ slope = .012, originY = 7.25, kind = 'land', supportSource = 'terrain-triangle' } = {}) {
  const geometry = new THREE.BufferGeometry(); geometry.name = 'planting-fixture-actual-float32-terrain';
  const points = [[800, -710], [970, -710], [970, -530], [800, -530]];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, z]) => [x, originY + (x - 800) * slope, z]), 3));
  geometry.setIndex([0, 2, 1, 0, 3, 2]); geometry.computeVertexNormals();
  const sampler = createTriangleSampler([geometry]);
  return { geometry, paths: [], courtFootprints: [], waterSurfaces: [], surfaceAt(x, z) { const hit = sampler.sample(x, z); return hit ? { ...hit, kind, walkable: true, supportSource } : null; }, dispose() { sampler.dispose(); geometry.dispose(); } };
}

function sourceFixture({ failAt, abortController, abortAt, disposeFailure } = {}) {
  const calls = [], owners = [], events = [], disposalCounts = new Map();
  const watch = resource => resource.addEventListener('dispose', () => { disposalCounts.set(resource, (disposalCounts.get(resource) ?? 0) + 1); events.push(resource.name || resource.type); });
  return { calls, owners, events, disposalCounts, async create({ specimens, arrange }) {
    const id = specimens[0]; calls.push(id); assert.equal(arrange, false); if (failAt === id) throw new Error('fixture-source-failure');
    const group = new THREE.Group(), part = new THREE.Group(); part.userData.id = id; group.add(part);
    const geometry = new THREE.BoxGeometry(.44, 1, .37); geometry.translate(.07, .2, -.03); geometry.name = `${id}-original-geometry`;
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); texture.name = `${id}-source-texture`;
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .81, side: THREE.DoubleSide }); material.name = `${id}-source-material`;
    const root = new THREE.Mesh(geometry, material); root.name = rootNames[id]; root.castShadow = root.receiveShadow = true; part.add(root);
    const mesh = new THREE.InstancedMesh(geometry, material, 3); mesh.name = `${id}-original-instances`;
    for (let i = 0; i < 3; i++) { const matrix = new THREE.Matrix4().compose(new THREE.Vector3(.4 * i, 2 + i, -.1 * i), new THREE.Quaternion().setFromEuler(new THREE.Euler(.1 * i, -.3 * i, .2)), new THREE.Vector3(1, .7 + i * .1, .9)); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, new THREE.Color().setRGB(.3 + i * .1, .7, .2)); }
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.castShadow = mesh.receiveShadow = true; part.add(mesh);
    for (const resource of [geometry, material, texture, mesh]) watch(resource);
    group.updateMatrixWorld(true); let released = false;
    const owner = { group, specimens: [part], resources: [geometry, material, texture, mesh], dispose() { if (released) return; released = true; for (const resource of this.resources) resource.dispose(); group.clear(); if (disposeFailure === id) throw new Error('fixture-dispose-failure'); } };
    owners.push(owner); if (abortAt === id) abortController.abort(new Error('fixture-abort'));
    return owner;
  } };
}

test('source IDs/counts are exact, land heights come from stored triangles, and reserves stay clear', () => {
  const terrain = terrainFixture();
  try {
    const before = JSON.stringify(baseline), plan = createMuseumPlantingPilotPlan({ terrain, plantingLayout: baseline });
    assert.equal(plan.valid, true); assert.equal(plan.placements.length, 8); assert.equal(plan.allVisibleTrianglesPerPass, 21340832);
    assert.equal(JSON.stringify(baseline), before);
    for (const p of plan.placements) {
      assert.ok(p.position[1] > 7); assert.equal(p.grounding.samples.length, 17);
      const expected = Math.min(...p.grounding.samples.map(s => terrain.surfaceAt(s.x, s.z).height)) - (p.burial ?? 0); close(p.position[1], expected);
      for (const sample of p.grounding.samples) assert.equal(sample.geometry, terrain.geometry.name);
      assert.ok(p.nearestReserves.every(reserve => reserve.margin > 0));
      if (p.species !== 'lake-rock') { const original = baseline.placements.find(old => old.id === p.id); assert.equal(p.position[0], original.position[0]); assert.equal(p.position[2], original.position[2]); assert.deepEqual(p.rotation, original.rotation); assert.deepEqual(p.scale, original.scale); }
    }
    assert.deepEqual(plan.intendedCounts, { juniper: 4, willow: 2, 'lake-rock': 2 });
    assert.equal(plan.nativeCompositionReviewed, false); assert.equal(plan.historicallySurveyed, false);
  } finally { terrain.dispose(); }
});

test('root Y agrees with an independent Three ray against actual terrain geometry', () => {
  const terrain = terrainFixture(), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(terrain.geometry, material);
  mesh.updateMatrixWorld(true);
  try {
    const plan = createMuseumPlantingPilotPlan({ terrain });
    for (const p of plan.placements) for (const sample of p.grounding.samples) { const hit = new THREE.Raycaster(new THREE.Vector3(sample.x, 50, sample.z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0]; assert.ok(hit); close(sample.height, hit.point.y); }
  } finally { terrain.dispose(); material.dispose(); }
});

test('thin paths, current water, courts and visual corridors reject before any factory call', async () => {
  const record = baseline.placements.find(p => p.id === museumPlantingPilotSpec.placementIds[0]), [x, , z] = record.position;
  for (const feature of ['paths', 'courtFootprints', 'waterSurfaces', 'view']) {
    const terrain = terrainFixture(), provider = sourceFixture();
    // A thin shape intersects the crown envelope without touching its centre.
    const reserve = { id: `real-${feature}`, polygon: rectangle(x + 1.8, z - 3, x + 1.85, z + 3) };
    const options = feature === 'view' ? { reservedPolygons: [{ ...reserve, kind: 'view', clearance: 0 }] } : (terrain[feature].push(reserve), {});
    try { await assert.rejects(createMuseumPlantingPilot({ terrain, createSpecimen: provider.create, ...options }), error => error.plan.rejected.some(p => p.id === record.id)); assert.deepEqual(provider.calls, []); } finally { terrain.dispose(); }
  }
});

test('missing records, estimated-only support, raised paths, wet land and steep roots are explicit failures', () => {
  for (const options of [{ supportSource: 'layout-estimate' }, { kind: 'exhibition-ground-path' }, { kind: 'asset-court' }, { kind: 'lake-bed' }, { slope: 1 }]) {
    const terrain = terrainFixture(options); try { const plan = createMuseumPlantingPilotPlan({ terrain }); assert.equal(plan.valid, false); assert.ok(plan.rejected.length); } finally { terrain.dispose(); }
  }
  const terrain = terrainFixture();
  try { const plan = createMuseumPlantingPilotPlan({ terrain, plantingLayout: { ...baseline, placements: baseline.placements.filter(p => p.id !== museumPlantingPilotSpec.placementIds[0]) } }); assert.equal(plan.valid, false); assert.equal(plan.rejected[0].reasons[0].kind, 'missing-layout-placement'); } finally { terrain.dispose(); }
  assert.throws(() => createMuseumPlantingPilotPlan(), /terrain.surfaceAt/);
});

test('default production entry rejects missing full-resolution stone pixels before building trees', async () => {
  const terrain = terrainFixture();
  try { await assert.rejects(createMuseumPlantingPilot({ terrain }), /verified full-resolution color pixels/); } finally { terrain.dispose(); }
});

test('all repeated meshes/materials/UV/instance attributes keep identity and source transforms', async () => {
  const terrain = terrainFixture(), provider = sourceFixture(); let pilot;
  try {
    pilot = await createMuseumPlantingPilot({ terrain, createSpecimen: provider.create, yieldControl: async () => {} });
    assert.deepEqual(provider.calls, ['willow', 'juniper', 'lake-rock']); assert.equal(pilot.parts.length, 8);
    assert.equal(pilot.diagnostics.uniqueGeometries, 3); assert.equal(pilot.diagnostics.uniqueMaterials, 3); assert.equal(pilot.diagnostics.uniqueTextures, 3);
    assert.equal(pilot.diagnostics.trianglesPerPass, 8 * 48); assert.equal(pilot.diagnostics.sourceFactory, 'caller-supplied-fixture');
    for (const view of pilot.views) for (const name of view.groups) assert.ok(pilot.group.getObjectByName(name), `${view.id}: ${name}`);
    const original = new THREE.Matrix4(), actual = new THREE.Matrix4(), expected = new THREE.Matrix4();
    for (const part of pilot.parts) {
      const id = part.userData.species, owner = provider.owners.find(o => o.specimens[0].userData.id === id), source = owner.group.getObjectByName(`${id}-original-instances`), placed = part.getObjectByName(source.name);
      assert.notEqual(placed, source); assert.equal(placed.geometry, source.geometry); assert.equal(placed.material, source.material); assert.equal(placed.instanceMatrix, source.instanceMatrix); assert.equal(placed.instanceColor, source.instanceColor);
      assert.equal(placed.geometry.attributes.uv, source.geometry.attributes.uv); assert.equal(placed.castShadow, true); assert.equal(placed.receiveShadow, true); assert.equal(placed.frustumCulled, source.frustumCulled);
      assert.notEqual(placed.boundingBox, source.boundingBox); assert.deepEqual(placed.boundingBox, source.boundingBox);
      for (let i = 0; i < placed.count; i++) { source.getMatrixAt(i, original); placed.getMatrixAt(i, actual); expected.multiplyMatrices(part.matrixWorld, original); actual.premultiply(placed.matrixWorld); for (let n = 0; n < 16; n++) close(actual.elements[n], expected.elements[n], 1e-10); }
      const root = pilot.diagnostics.rootContacts.find(r => r.id === part.userData.placementId); assert.ok(root.sourceVerticesAtOrBelowDatum > 0); assert.equal(root.belowCurrentTerrain, root.sourceVerticesAtOrBelowDatum); assert.ok(root.maximumGap <= 0);
    }
  } finally { pilot?.dispose(); terrain.dispose(); }
  pilot.dispose(); for (const owner of provider.owners) for (const resource of owner.resources) assert.equal(provider.disposalCounts.get(resource), 1);
});

test('Three WebGLObjects uploads one attribute identity and releases views only after detachment', async () => {
  const terrain = terrainFixture(), provider = sourceFixture(), uploaded = new Set(), resident = new Set(), destroyed = new Map(), releasedObjects = new Set();
  const attributes = { update(attribute) { uploaded.add(attribute); resident.add(attribute); }, remove(attribute) { if (resident.delete(attribute)) destroyed.set(attribute, (destroyed.get(attribute) ?? 0) + 1); } };
  const objects = WebGLObjects({}, { get(_object, geometry) { return geometry; }, update() {} }, attributes, { releaseStatesOfObject(object) { releasedObjects.add(object); } }, { render: { frame: 1 } });
  const pilot = await createMuseumPlantingPilot({ terrain, createSpecimen: provider.create, yieldControl: async () => {} }), scene = new THREE.Scene(), views = [];
  scene.add(pilot.group); pilot.group.traverse(node => { if (node.isInstancedMesh) { views.push(node); objects.update(node); node.addEventListener('dispose', () => assert.equal(scene.getObjectById(node.id), undefined)); } });
  assert.equal(views.length, 8); assert.equal(uploaded.size, 6);
  pilot.dispose(); pilot.dispose(); assert.equal(releasedObjects.size, 8); assert.equal(resident.size, 0); assert.equal(destroyed.size, 6); for (const value of destroyed.values()) assert.equal(value, 1);
  objects.dispose(); terrain.dispose();
});

test('one bad later source or abort releases all earlier owners exactly once', async () => {
  for (const mode of ['failure', 'abort']) {
    const terrain = terrainFixture(), abortController = new AbortController(), provider = sourceFixture(mode === 'failure' ? { failAt: 'juniper' } : { abortController, abortAt: 'juniper' });
    try { await assert.rejects(createMuseumPlantingPilot({ terrain, createSpecimen: provider.create, signal: abortController.signal, yieldControl: async () => {} }), mode === 'failure' ? /fixture-source-failure/ : /fixture-abort/); for (const owner of provider.owners) for (const resource of owner.resources) assert.equal(provider.disposalCounts.get(resource), 1); } finally { terrain.dispose(); }
  }
});

test('a disposal error does not skip other owners, and repeat disposal is safe', async () => {
  const terrain = terrainFixture(), provider = sourceFixture({ disposeFailure: 'lake-rock' }), pilot = await createMuseumPlantingPilot({ terrain, createSpecimen: provider.create, yieldControl: async () => {} });
  assert.throws(() => pilot.dispose(), AggregateError); pilot.dispose(); for (const owner of provider.owners) for (const resource of owner.resources) assert.equal(provider.disposalCounts.get(resource), 1); terrain.dispose();
});
