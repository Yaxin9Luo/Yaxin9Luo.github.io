import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMuseumPlantingColliders } from '../src/yuanmingyuan/museum-planting-colliders.js';
import { createMuseumNavigation, stepMuseumFlight, museumVisitorCollider } from '../src/yuanmingyuan/visitor-motion.js';
import { sampleGroundSurface, GROUND_MOTION } from '../src/ground-motion.js';
import { curvedBranchGeometry } from '../src/yuanmingyuan/vegetation-geometry.js';

const names = { willow: 'willow-trunk-and-roots', juniper: 'juniper-visible-trunk', 'lake-rock': 'lake-rock-main' };
const rectangle = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const terrain = paths => ({ paths: paths ?? [], colliders: [], surfaceAt: () => ({ height: 4, normal: { x: 0, y: 1, z: 0 }, kind: 'land', walkable: true }) });
const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

function fixture(specifications = [{}]) {
  const group = new THREE.Group(), parts = [], resources = [], geometryDisposals = [];
  for (const [i, spec] of specifications.entries()) {
    const species = spec.species ?? 'willow', part = new THREE.Group(); part.userData = { species, placementId: `actual-body-fixture-${i}` }; part.position.fromArray(spec.position ?? [0, 4, 0]); part.rotation.fromArray([...(spec.rotation ?? [0, 0, 0]), 'XYZ']); part.scale.fromArray(spec.scale ?? [1, 1, 1]);
    const geometry = spec.geometry ?? new THREE.BoxGeometry(1, 5, 1).translate(.25, 2.3, -.15), material = new THREE.MeshStandardMaterial(); geometry.name ||= `${species}-fixture-body`; geometry.addEventListener('dispose', () => geometryDisposals.push(geometry));
    const mesh = new THREE.Mesh(geometry, material); mesh.name = names[species]; if (spec.meshPosition) mesh.position.fromArray(spec.meshPosition); if (spec.meshRotation) mesh.rotation.fromArray([...spec.meshRotation, 'XYZ']); part.add(mesh);
    // Reading geometry on this large-canopy stand-in is a hard failure. Normal
    // Object3D matrix updates/name lookup do not need its geometry or instances.
    const canopy = new THREE.Object3D(); canopy.name = 'forbidden-foliage'; canopy.isMesh = canopy.isInstancedMesh = true; Object.defineProperty(canopy, 'geometry', { get() { throw new Error('foliage-read'); } }); part.add(canopy);
    group.add(part); parts.push(part); resources.push(geometry, material);
  }
  group.updateMatrixWorld(true);
  return { group, parts, resources, geometryDisposals, dispose() { for (const resource of resources) resource.dispose(); group.clear(); } };
}

function inSolid(point, solid, epsilon = 1e-7) { return solid.planes.every(([x, y, z, d]) => x * point.x + y * point.y + z * point.z <= d + epsilon); }
function assertSourceCoverage(pilot, collisions) {
  for (const part of pilot.parts) {
    const mesh = part.getObjectByName(names[part.userData.species]), p = mesh.geometry.attributes.position, index = mesh.geometry.index, solids = collisions.solids.filter(solid => solid.placementId === part.userData.placementId), v = new THREE.Vector3();
    const weights = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.2, .3, .5], [.51, .48, .01]];
    for (let offset = mesh.geometry.drawRange.start; offset < Math.min((index?.count ?? p.count), mesh.geometry.drawRange.start + mesh.geometry.drawRange.count); offset += 3) {
      const points = [0, 1, 2].map(i => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(offset + i) : offset + i).applyMatrix4(mesh.matrixWorld));
      for (const w of weights) { v.set(0, 0, 0); for (let i = 0; i < 3; i++) v.addScaledVector(points[i], w[i]); assert.ok(solids.some(solid => inSolid(v, solid)), `uncovered actual source triangle ${offset / 3}: ${v.toArray()}`); }
    }
  }
}

test('eight existing named meshes produce 34 small non-walkable solids without reading foliage', () => {
  const pilot = fixture(['willow', 'willow', 'juniper', 'juniper', 'juniper', 'juniper', 'lake-rock', 'lake-rock'].map((species, i) => ({ species, position: [i * 8 - 32, 4, -10] })));
  const before = pilot.resources.filter(r => r.isBufferGeometry).map(g => ({ array: g.attributes.position.array, bytes: g.attributes.position.array.slice(), index: g.index, version: g.attributes.position.version }));
  try {
    const collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
    assert.equal(collisions.solids.length, 34); assert.equal(collisions.diagnostics.sourceMeshCount, 8); assert.equal(collisions.diagnostics.planeCount, 476);
    assert.ok(collisions.solids.every(s => !s.walkable && s.planes.length === 14)); assert.equal(collisions.diagnostics.leavesRead, false); assert.equal(collisions.diagnostics.bvhConstructed, false);
    assertSourceCoverage(pilot, collisions);
    pilot.resources.filter(r => r.isBufferGeometry).forEach((g, i) => { assert.equal(g.attributes.position.array, before[i].array); assert.deepEqual(g.attributes.position.array, before[i].bytes); assert.equal(g.index, before[i].index); assert.equal(g.attributes.position.version, before[i].version); });
    collisions.dispose(); collisions.dispose(); assert.equal(collisions.solids.length, 0); assert.deepEqual(collisions.dynamicColliders(), []); assert.equal(pilot.geometryDisposals.length, 0);
  } finally { pilot.dispose(); }
});

test('world centres, yaw/pitch/roll, nested offsets and nonuniform scales follow actual source vertices', () => {
  const geometry = curvedBranchGeometry({ points: [[0, -.16, 0], [.35, 1, .15], [-.28, 3.1, .32], [.62, 5.3, -.21]], radii: [.65, .40, .23, .08], radialSegments: 9, segments: 15, bark: .03, name: 'real-source-branch-helper-fixture' });
  const pilot = fixture([{ geometry, position: [123.5, 7.25, -81.4], rotation: [.11, 1.14, -.07], scale: [1.3, .85, 1.7], meshPosition: [.2, .1, -.4], meshRotation: [.03, -.2, 0] }]);
  try {
    const collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() }), body = pilot.parts[0].getObjectByName(names.willow), expected = new THREE.Box3().setFromObject(body), bounds = collisions.diagnostics.sources[0].actualDrawnBounds;
    for (const [key, value] of Object.entries({ minX: expected.min.x, minY: expected.min.y, minZ: expected.min.z, maxX: expected.max.x, maxY: expected.max.y, maxZ: expected.max.z })) {
      // Box3's transformed local AABB is conservative; independently measure
      // the transformed actual vertices for the exact component extrema.
      const values = Array.from({ length: geometry.attributes.position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(body.matrixWorld)[key.at(-1).toLowerCase()]);
      const actual = key.startsWith('min') ? Math.min(...values) : Math.max(...values); close(bounds[key], actual); assert.ok(key.startsWith('min') ? actual >= value - 1e-7 : actual <= value + 1e-7);
    }
    assertSourceCoverage(pilot, collisions); assert.equal(collisions.diagnostics.sources[0].worldMatrix.length, 16); collisions.dispose();
  } finally { pilot.dispose(); }
});

test('triangles crossing a middle slab remain covered even without any original vertex there', () => {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([-2, 0, 0, 3, 8, 0, 0, 8, 2, 0, 0, -.3], 3)); geometry.setIndex([0, 1, 2, 0, 3, 1]);
  const pilot = fixture([{ species: 'lake-rock', geometry }]);
  try {
    const collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() }); assert.equal(collisions.solids.length, 5); assertSourceCoverage(pilot, collisions);
    const point = new THREE.Vector3(-2, 0, 0).lerp(new THREE.Vector3(3, 8, 0), .5).add(new THREE.Vector3(0, 4, 0)); assert.ok(collisions.solids.some(s => inSolid(point, s))); collisions.dispose();
  } finally { pilot.dispose(); }
});

test('drawRange excludes unused far geometry from the collision footprint', () => {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([1000, 0, 0, 1000, 1, 1, 1001, 1, 0, -.5, -.1, 0, .5, 5, 0, 0, 2, .4], 3)); geometry.setIndex([0, 1, 2, 3, 4, 5]); geometry.setDrawRange(3, 3);
  const pilot = fixture([{ geometry }]); try { const collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() }); assert.equal(collisions.diagnostics.sources[0].drawnTriangles, 1); assert.ok(collisions.diagnostics.sources[0].actualDrawnBounds.maxX < 1); assertSourceCoverage(pilot, collisions); collisions.dispose(); } finally { pilot.dispose(); }
});

test('current dynamicColliders block walking/landing and never create walkable stone tops', () => {
  for (const species of ['willow', 'juniper', 'lake-rock']) {
    const pilot = fixture([{ species }]), ground = terrain(), collisions = createMuseumPlantingColliders(pilot, { terrain: ground }), nav = createMuseumNavigation({ terrain: ground, dynamicColliders: collisions.dynamicColliders });
    try {
      assert.equal(nav.landing({ x: .25, y: 20, z: -.15 }).reason, 'blocked'); assert.equal(nav.landing({ x: 3, y: 20, z: 3 }).valid, true);
      let state = { position: { x: -3, y: 4, z: -.15 }, heading: 0 }; for (let i = 0; i < 12; i++) state = nav.walk(state, { x: 1, run: true }, .1);
      assert.equal(state.blocked, true); assert.ok(state.position.x < -.25 - GROUND_MOTION.radius + .001); assert.ok(state.position.x > -1);
      const sample = sampleGroundSurface(.25, -.15, 20, nav.world); close(sample.y, 4); assert.equal(sample.surfaceId, 'terrain');
      collisions.dispose(); assert.equal(nav.landing({ x: .25, y: 20, z: -.15 }).valid, true);
    } finally { collisions.dispose(); pilot.dispose(); }
  }
});

test('route margins include the current walker radius/skin and reject a thin edge overlap', () => {
  const pilot = fixture();
  try {
    const edge = .75 + GROUND_MOTION.radius + GROUND_MOTION.skin;
    assert.throws(() => createMuseumPlantingColliders(pilot, { terrain: terrain([{ id: 'touching-path', polygon: rectangle(edge, -2, edge + .002, 2) }]) }), error => error.conflicts?.length > 0);
    const collisions = createMuseumPlantingColliders(pilot, { terrain: terrain([{ id: 'clear-path', polygon: rectangle(edge + .003, -2, edge + .005, 2) }]) });
    assert.ok(collisions.diagnostics.clearances.every(row => row.clear)); collisions.dispose();
    assert.throws(() => createMuseumPlantingColliders(pilot, { terrain: terrain(), reservedPolygons: [{ id: 'caller-route', polygon: rectangle(-2, -.16, 2, -.14) }] }), /reserved walking route/);
  } finally { pilot.dispose(); }
});

function assertSweptPathClear(result, solids) {
  const { radius, height, centerOffsetY } = result.body;
  for (const segment of result.segments) for (let i = 0; i <= 100; i++) {
    const p = { x: segment.from.x + (segment.to.x - segment.from.x) * i / 100, y: segment.from.y + (segment.to.y - segment.from.y) * i / 100 + centerOffsetY, z: segment.from.z + (segment.to.z - segment.from.z) * i / 100 };
    for (const solid of solids) assert.ok(!solid.planes.every(([nx, ny, nz, d]) => nx * p.x + ny * p.y + nz * p.z < d + radius * Math.hypot(nx, nz) + height / 2 * Math.abs(ny) - 1e-7), 'resolved flight path entered a body');
  }
}

test('continuous flight uses the actual body dimensions, stops at contact and slides smoothly', () => {
  const pilot = fixture(), collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
  try {
    const actor = museumVisitorCollider({ mode: 'flying', position: { x: -5, y: 6, z: -.15 } }), body = { radius: 1.1, height: actor.top - actor.bottom };
    const hit = collisions.constrainFlight({ x: -5, y: 6, z: -.15 }, { x: 5, y: 6, z: -.15 }, body);
    assert.equal(hit.blocked, true); assert.equal(hit.initialOverlap, false); close(hit.position.x, -.25 - 1.1 - .006, 2e-6); assert.ok(hit.position.x > -2); assertSweptPathClear(hit, collisions.solids);
    const slide = collisions.constrainFlight(hit.position, { x: hit.position.x + 1.5, y: 6, z: 2.8 }, body);
    assert.equal(slide.blocked, true); assert.ok(slide.position.z > 2.7); assert.ok(slide.position.x <= hit.position.x + 1e-5); assertSweptPathClear(slide, collisions.solids);
    const away = collisions.constrainFlight(slide.position, { x: slide.position.x - 1, y: 6, z: slide.position.z }, body); assert.equal(away.blocked, false);
    const small = collisions.constrainFlight({ x: -5, y: 6, z: -.15 }, { x: 5, y: 6, z: -.15 }, { radius: .2, height: .5 }); assert.ok(small.position.x > hit.position.x + .8);
  } finally { collisions.dispose(); pilot.dispose(); }
});

test('flight sweep cannot tunnel through a thin body even when both endpoints are clear', () => {
  const geometry = new THREE.BoxGeometry(.004, 6, 1).translate(0, 3, 0), pilot = fixture([{ geometry }]), collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
  try {
    const from = { x: -3, y: 7, z: 0 }, proposed = stepMuseumFlight(from, { x: 1, boost: true }, .1, { surfaceAt: () => null, waterY: -20 }); assert.ok(proposed.x > 3);
    const hit = collisions.constrainFlight(from, proposed, { radius: .32, height: 3.2 }); assert.equal(hit.blocked, true); assert.ok(hit.position.x < -.326); assert.ok(hit.position.x > -.33); assertSweptPathClear(hit, collisions.solids);
  } finally { collisions.dispose(); pilot.dispose(); }
});

test('flight may pass above/beside a trunk; vertical rock descent is blocked without rock support', () => {
  const pilot = fixture([{ species: 'lake-rock' }]), collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
  try {
    const body = { radius: .4, height: 3.2 };
    assert.equal(collisions.constrainFlight({ x: -5, y: 11, z: 0 }, { x: 5, y: 11, z: 0 }, body).blocked, false);
    assert.equal(collisions.constrainFlight({ x: -5, y: 6, z: 2 }, { x: 5, y: 6, z: 2 }, body).blocked, false);
    const hit = collisions.constrainFlight({ x: .25, y: 13, z: -.15 }, { x: .25, y: 5, z: -.15 }, body); assert.equal(hit.blocked, true); close(hit.position.y, 8.8 + 1.6 + .006, 3e-6); assertSweptPathClear(hit, collisions.solids);
  } finally { collisions.dispose(); pilot.dispose(); }
});

test('a second obstacle stops the remaining slide at the corner instead of tunnelling or resetting', () => {
  const pilot = fixture([
    { geometry: new THREE.BoxGeometry(.5, 5, 10).translate(0, 2.3, 0) },
    { geometry: new THREE.BoxGeometry(10, 5, .5).translate(0, 2.3, 0), species: 'lake-rock' },
  ]), collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
  try {
    const hit = collisions.constrainFlight({ x: -3, y: 6, z: -3 }, { x: 4, y: 6, z: 2 }, { radius: .4, height: 3.2 });
    assert.equal(hit.blocked, true); assert.equal(hit.initialOverlap, false); assert.equal(hit.limited, false); assert.ok(hit.contacts.length >= 2);
    close(hit.position.x, -.25 - .4 - .006, 3e-6); close(hit.position.z, -.25 - .4 - .006, 3e-6); assertSweptPathClear(hit, collisions.solids);
  } finally { collisions.dispose(); pilot.dispose(); }
});

test('stationary activation detects a physical overlap but allows a clear hover and a tangent contact', () => {
  const pilot = fixture(), collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
  try {
    const body = { radius: .4, height: 3.2 }, inside = { x: .25, y: 6, z: -.15 }, outside = { x: -3, y: 6, z: 0 };
    const overlap = collisions.constrainFlight(inside, inside, body); assert.equal(overlap.initialOverlap, true); assert.equal(overlap.blocked, true); assert.deepEqual(overlap.position, inside); assert.deepEqual(overlap.segments, []);
    const clear = collisions.constrainFlight(outside, outside, body); assert.equal(clear.blocked, false); assert.deepEqual(clear.segments, []);
    const contact = collisions.constrainFlight(outside, inside, body).position;
    assert.equal(collisions.constrainFlight(contact, contact, body).blocked, false);
  } finally { collisions.dispose(); pilot.dispose(); }
});

test('invalid/missing bodies and initial overlaps fail explicitly; collision disposal never owns source geometry', () => {
  const pilot = fixture(); let collisions;
  try {
    assert.throws(() => createMuseumPlantingColliders(pilot), /terrain.paths/);
    const controller = new AbortController(); controller.abort(); assert.throws(() => createMuseumPlantingColliders(pilot, { terrain: terrain(), signal: controller.signal }), /abort/i);
    collisions = createMuseumPlantingColliders(pilot, { terrain: terrain() });
    assert.throws(() => collisions.constrainFlight({ x: 0, y: 6, z: 0 }, { x: 1, y: 6, z: 0 }), /radius\/height/);
    const from = { x: .25, y: 6, z: -.15 }, hit = collisions.constrainFlight(from, { x: 5, y: 6, z: 0 }, { radius: .4, height: 3.2 }); assert.equal(hit.initialOverlap, true); assert.deepEqual(hit.position, from);
    collisions.dispose(); collisions.dispose(); assert.equal(pilot.geometryDisposals.length, 0); assert.throws(() => collisions.constrainFlight(from, from, { radius: .4, height: 3.2 }), /disposed/);
    const body = pilot.parts[0].getObjectByName(names.willow); body.name = 'incorrect-name'; assert.throws(() => createMuseumPlantingColliders(pilot, { terrain: terrain() }), /Missing original/); body.name = names.willow;
    body.matrixAutoUpdate = false; body.matrix.elements[3] = .01; assert.throws(() => createMuseumPlantingColliders(pilot, { terrain: terrain() }), /Invalid planting body transform/);
  } finally { collisions?.dispose(); pilot.dispose(); }
});
