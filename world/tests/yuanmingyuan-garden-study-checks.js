import assert from 'node:assert/strict';
import * as THREE from 'three';

export function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of node.material ? [].concat(node.material) : []) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); }
  });
  return { geometries, materials, textures };
}

export function object(asset, name) { const node = asset.group.getObjectByName(name); assert.ok(node, `addressable subassembly: ${name}`); return node; }
export function bounds(asset, name) { return new THREE.Box3().setFromObject(object(asset, name)); }
export function ray(origin, direction, target, far = Infinity) { return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, far).intersectObject(target, true); }
export function localRay(origin, direction, target, far = Infinity) {
  const from = target.localToWorld(new THREE.Vector3(...origin)), vector = new THREE.Vector3(...direction).transformDirection(target.matrixWorld);
  return new THREE.Raycaster(from, vector, 0, far).intersectObject(target, true);
}
export const category = hit => hit?.object.material.userData.category;
export function near(actual, expected, label, tolerance = .012) { assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`); }

export function assertGeometryNormals(geometry) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'); assert.ok(positions?.count > 0); assert.equal(normals?.count, positions.count);
  for (let i = 0; i < positions.count; i++) {
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
    if (![positions.getX(i), positions.getY(i), positions.getZ(i), nx, ny, nz].every(Number.isFinite)) assert.fail(`${geometry.name}: non-finite vertex/normal ${i}`);
    const n = Math.hypot(nx, ny, nz); if (n < .90 || n > 1.10) assert.fail(`${geometry.name}: normal ${i} length ${n}`);
  }
}

export function assertClosedWinding(geometry) {
  const p = geometry.attributes.position, edges = new Map(), count = geometry.index?.count ?? p.count;
  const point = index => new THREE.Vector3().fromBufferAttribute(p, index), key = v => [v.x, v.y, v.z].map(value => Math.round(value * 100000)).join(',');
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map(offset => geometry.index ? geometry.index.getX(i + offset) : i + offset), ps = ids.map(point);
    if (ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).lengthSq() < 1e-16) continue;
    const keys = ps.map(key);
    for (let edge = 0; edge < 3; edge++) {
      const a = keys[edge], c = keys[(edge + 1) % 3], sorted = a < c, id = sorted ? `${a}|${c}` : `${c}|${a}`;
      const entry = edges.get(id) ?? { count: 0, balance: 0 }; entry.count++; entry.balance += sorted ? 1 : -1; edges.set(id, entry);
    }
  }
  const failures = [...edges].filter(([, value]) => value.count !== 2 || value.balance !== 0);
  assert.equal(failures.length, 0, `closed consistently wound surface: ${JSON.stringify(failures.slice(0, 3))}`);
}

export function assertOwnedAsset(asset, t) {
  const owned = resources(asset.group); for (const geometry of owned.geometries) assertGeometryNormals(geometry);
  let triangles = 0, meshes = 0;
  asset.group.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
  assert.equal(asset.diagnostics.triangleCount, triangles); assert.equal(asset.diagnostics.meshCount, meshes);
  for (const key of ['geometries', 'materials', 'textures']) assert.equal(asset.diagnostics.resourceOwnership[key], owned[key].size, key);
  const box = new THREE.Box3().setFromObject(asset.group); assert.deepEqual(asset.diagnostics.bounds.min, box.min.toArray()); assert.deepEqual(asset.diagnostics.bounds.max, box.max.toArray());
  const names = asset.diagnostics.subassemblies.map(part => part.name); assert.equal(new Set(names).size, names.length, 'unique stable names');
  assert.ok(asset.diagnostics.subassemblies.every(part => part.body && part.meshCount && part.triangleCount));
  t.diagnostic(JSON.stringify({ triangles, meshes, groups: names.length, materials: owned.materials.size, textures: owned.textures.size, waterStreams: asset.diagnostics.waterEndpoints.length, bounds: asset.diagnostics.bounds }));
}

export function assertViewsResolve(asset, views) {
  for (const [name, view] of Object.entries(views)) {
    assert.ok(view.direction.length === 3 && view.direction.every(Number.isFinite), name);
    for (const group of [...view.groups, ...(view.isolate ?? [])]) object(asset, group);
  }
}

export function assertWaterEndpoints(asset) {
  for (const endpoint of asset.diagnostics.waterEndpoints) {
    const point = object(asset, endpoint.coordinateSpace).localToWorld(new THREE.Vector3(...endpoint.end));
    const basin = object(asset, endpoint.basinId), hits = ray([point.x, point.y + .18, point.z], [0, -1, 0], basin, .50);
    const water = hits.find(hit => category(hit) === 'water' && hit.object.material.userData.role === 'surface'); assert.ok(water, `${endpoint.id}: real receiving surface`);
    assert.equal(water.object.material.userData.role, 'surface'); near(point.y, water.point.y, endpoint.id);
    assert.ok(!hits.some(hit => category(hit) !== 'water' && hit.point.y > point.y + .025), `${endpoint.id}: not under a solid carving`);
  }
}

export function assertInstanceReplacement(asset, create) {
  const first = resources(asset.group), disposals = new Map();
  for (const list of Object.values(first)) for (const resource of list) { disposals.set(resource, 0); resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1)); }
  asset.dispose(); asset.dispose(); assert.equal(asset.group.children.length, 0); assert.ok([...disposals.values()].every(count => count === 1));
  const second = create();
  try {
    for (const [key, list] of Object.entries(resources(second.group))) for (const resource of list) assert.ok(!first[key].has(resource), `${key}: per-instance ownership`);
    second.update(1.25); assert.ok(second.group.children.length > 0);
  } finally { second.dispose(); }
}
