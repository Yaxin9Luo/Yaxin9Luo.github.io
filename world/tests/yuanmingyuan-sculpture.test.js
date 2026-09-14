import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { seatedBody, copperHead, ZODIAC } from '../src/yuanmingyuan/haiyantang-sculpture.js';

// A geometry-collecting implementation of the asset builder boundary. It uses real
// Three geometry/transforms/raycasting without constructing the surrounding palace.
function builderFixture() {
  const prototypes = new Map(), geometries = new Set(), sources = new Set();
  const m = Object.fromEntries(['stone', 'relief', 'copper', 'copperDark'].map(name => [name, new THREE.MeshStandardMaterial({ color: 0x888888 })]));
  for (const [name, material] of Object.entries(m)) material.userData.category = name.startsWith('copper') ? 'copper' : 'stone';
  const b = {
    m, geometries, sources,
    prototype(key, make) { if (!prototypes.has(key)) prototypes.set(key, make()); return prototypes.get(key); },
    add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], ownedSource = false) {
      const geometry = source.clone();
      const q = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
      geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale)));
      geometries.add(geometry); parent.add(new THREE.Mesh(geometry, material));
      if (ownedSource) { sources.add(source); source.dispose(); }
    },
    box(parent, material, x, y, z, w, h, d) { b.add(parent, new THREE.BoxGeometry(w, h, d), material, [x, y, z], undefined, undefined, true); },
    ellipsoid(parent, material, position, scale, rotation) { b.add(parent, b.prototype('fixture-sphere', () => new THREE.SphereGeometry(1, 18, 12)), material, position, scale, rotation); },
    tube(parent, points, radius, material = m.relief, segments = 20) { const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p))); b.add(parent, new THREE.TubeGeometry(curve, segments, radius, 7, false), material, undefined, undefined, undefined, true); },
    lathe(parent, profile, position, material = m.stone, scale = [1, 1, 1], segments = 24) { b.add(parent, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments), material, position, scale, undefined, true); },
    ring(parent, position, radius, tube, material = m.relief, scale, rotation) { b.add(parent, new THREE.TorusGeometry(radius, tube, 6, 24), material, position, scale, rotation, true); },
    leaf(parent, position, scale, rotation, material = m.relief) { b.add(parent, new THREE.ConeGeometry(.2, 1, 4), material, position, scale, rotation, true); },
    dispose() { for (const g of [...geometries, ...prototypes.values()]) g.dispose(); for (const material of Object.values(m)) material.dispose(); },
  };
  return b;
}

function meshTopology(geometry) {
  const positions = geometry.attributes.position, ids = new Map(), vertexIds = [], edges = new Map(), adjacency = new Map();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
    if (!ids.has(key)) ids.set(key, ids.size);
    vertexIds[i] = ids.get(key);
  }
  const index = geometry.index, count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(j => vertexIds[index ? index.getX(i + j) : i + j]);
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], c = triangle[(j + 1) % 3];
      if (a === c) continue;
      const key = a < c ? `${a}:${c}` : `${c}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(c)) adjacency.set(c, new Set());
      adjacency.get(a).add(c); adjacency.get(c).add(a);
    }
  }
  const seen = new Set(), stack = [adjacency.keys().next().value];
  while (stack.length) { const v = stack.pop(); if (seen.has(v)) continue; seen.add(v); for (const n of adjacency.get(v) ?? []) if (!seen.has(n)) stack.push(n); }
  return { closed: [...edges.values()].every(n => n === 2), connected: seen.size === adjacency.size };
}

// Replacing the continuous robe with separate limb spheres or an open skirt fails.
test('the main robe is one closed continuous surface spanning shoulders, sleeves and crossed lap', () => {
  const b = builderFixture(), figure = new THREE.Group();
  try {
    seatedBody(b, figure, 'rat');
    const meshes = []; figure.traverse(o => { if (o.isMesh) meshes.push(o); });
    const main = meshes.find(o => o.geometry.name === 'continuous-shoulder-sleeve-crossed-lap-robe');
    assert.ok(main);
    const topology = meshTopology(main.geometry);
    assert.ok(topology.closed, 'the robe must have no open hem, neck seam or missing surface strip');
    assert.ok(topology.connected, 'shoulders, sleeves and lap must share one surface');
    main.geometry.computeBoundingBox();
    const box = main.geometry.boundingBox, size = box.getSize(new THREE.Vector3());
    assert.ok(box.max.y > 1.45 && box.min.y < .22, 'robe includes the shoulders and seated hem');
    assert.ok(size.x > 1.1 && size.z > .9, 'robe includes sleeve and crossed-lap breadth');
  } finally { b.dispose(); }
});

test('both hand roots enter the actual sleeve surface instead of floating in front of it', () => {
  const b = builderFixture(), figure = new THREE.Group();
  try {
    seatedBody(b, figure, 'rat');
    const meshes = []; figure.traverse(o => { if (o.isMesh) meshes.push(o); });
    const robe = meshes.find(o => o.geometry.name === 'continuous-shoulder-sleeve-crossed-lap-robe');
    const palms = meshes.filter(o => /resting-hand-(palm|with-knuckle-contours)/.test(o.geometry.name));
    assert.equal(palms.length, 2);
    for (const palm of palms) {
      const root = new THREE.Vector3().fromBufferAttribute(palm.geometry.attributes.position, 0);
      const origin = root.clone().add(new THREE.Vector3(0, 0, .8));
      const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1)).intersectObject(robe);
      assert.ok(hits.length && hits[0].point.z >= root.z + .006, 'a wrist must penetrate the continuous sleeve, not cast an isolated shadow across a gap');
    }
  } finally { b.dispose(); }
});

// A dark disk painted over a closed muzzle fails: the water jet needs an aperture.
test('all twelve returned mouth positions open into an actual recessed water passage', () => {
  const b = builderFixture();
  try {
    for (const [id] of ZODIAC) {
      const figure = new THREE.Group(), outlet = copperHead(b, figure, id);
      figure.updateMatrixWorld(true);
      assert.ok(outlet.length === 3 && outlet.every(Number.isFinite), id);
      for (const dx of [-.008, 0, .008]) {
        const origin = new THREE.Vector3(outlet[0] + dx, outlet[1], outlet[2] + .05);
        const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1), 0, .5).intersectObject(figure, true);
        assert.ok(!hits.length || hits[0].distance > .105, `${id}: visible passage must recess beyond a painted mouth disk`);
      }
      const skin = [];
      figure.traverse(o => {
        if (!o.isMesh) return;
        assert.equal(o.material.userData.category, 'copper');
        if (o.geometry.name.includes('continuous-cranium-cheek-muzzle')) skin.push(o.geometry);
        const normals = o.geometry.attributes.normal;
        for (let i = 0; i < normals.count; i++) assert.ok(Number.isFinite(normals.getX(i) + normals.getY(i) + normals.getZ(i)) && Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) > .9, `${id}: finite unit normals`);
      });
      assert.equal(skin.length, 1, `${id}: one connected cranium-to-muzzle surface`);
      assert.deepEqual(meshTopology(skin[0]), { closed: true, connected: true }, id);
      assert.equal(figure.getObjectByName(`zodiac-${id}-head-copper`).userData.originalStatus, ['dragon','snake','goat','rooster','dog'].includes(id) ? 'missing-inferred' : 'extant-original-reference-available');
    }
  } finally { b.dispose(); }
});

test('sculpture factories do not share mutable geometry and generated normals stay finite', () => {
  const a = builderFixture(), b = builderFixture(), first = new THREE.Group(), second = new THREE.Group();
  try {
    seatedBody(a, first, 'rat'); copperHead(a, first, 'rat');
    seatedBody(b, second, 'rat'); copperHead(b, second, 'rat');
    for (const ga of a.geometries) assert.ok(!b.geometries.has(ga));
    for (const geometry of b.geometries) {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      assert.equal(p.count, n.count);
      for (let i = 0; i < p.count; i++) {
        assert.ok([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite));
        assert.ok(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > .9);
      }
    }
    a.dispose();
    assert.ok(new THREE.Box3().setFromObject(second).getSize(new THREE.Vector3()).y > 1.5);
  } finally { b.dispose(); }
});
