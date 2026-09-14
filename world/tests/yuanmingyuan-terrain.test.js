import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pointInPolygon } from '../src/yuanmingyuan/garden-layout.js';
import { polygonBooleanRegions, polygonArea, triangulateSurface, createTriangleSampler, createArchBridgeGeometry, closestOnSegment } from '../src/yuanmingyuan/terrain-geometry.js';
import { createGardenTerrain } from '../src/yuanmingyuan/garden-terrain.js';

const rectangle = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const close = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
function areaOfGeometry(geometry) {
  const p = geometry.attributes.position, indices = geometry.index; let area = 0;
  for (let i = 0; i < indices.count; i += 3) area += Math.abs(polygonArea([0, 1, 2].map(j => { const id = indices.getX(i + j); return [p.getX(id), p.getZ(id)]; })));
  return area;
}
const lake = { id: 'fixture-lake', polygon: rectangle(-22, -17, 24, 20), surfaceY: 2, bedY: -.3, sourceIds: ['fixture'], kind: 'lake' };
const ornamental = { id: 'fixture-formal-basin', polygon: rectangle(27, -31, 43, -24), surfaceY: 2, bedY: .5, sourceIds: ['fixture'], kind: 'ornamental-basin' };
const fixture = {
  id: 'terrain-test-small-fixture', registration: { status: 'unregistered' },
  exhibition: { seaY: 0, groundY: 4, coast: { polygon: rectangle(-50, -40, 50, 40) } },
  waterBodies: [lake], ornamentalWaters: [ornamental], channels: [{ id: 'fixture-channel', polygon: rectangle(20, -2, 42, 3), surfaceY: 2, bedY: .6, sourceIds: ['fixture'] }],
  islands: [{ id: 'fixture-island', polygon: rectangle(-6, -5, 6, 6), waterId: lake.id }],
  gardens: [{ id: 'fixture-garden', boundary: rectangle(-46, -36, 46, 36), groundY: 4, wallTopY: 6.6 }],
  landforms: [{ id: 'fixture-hill', polygon: rectangle(-22, 24, 8, 34), center: [-7, 4, 29], baseY: 4, peakY: 10 }],
  bridges: [{ id: 'fixture-bridge', from: [-30, 4.5, 0], to: [-5, 4.5, 0], width: 3, deckY: 4.5 }],
};
const court = { id: 'fixture-sunken-court', polygon: rectangle(32, 24, 42, 32), floorY: -2, rimY: 4 };
let terrain;
test.before(() => { terrain = createGardenTerrain({ layout: fixture, assetCourts: [court], gates: [{ id: 'test-gate', gardenIds: ['fixture-garden'], position: [46, 24], width: 8 }] }); terrain.group.updateMatrixWorld(true); });
test.after(() => terrain?.dispose());

test('water union removes overlaps and retains an actual island hole', () => {
  const a = rectangle(0, 0, 6, 6), b = rectangle(4, 0, 10, 6), island = rectangle(2, 2, 4, 4);
  const result = polygonBooleanRegions([a, b, island], p => (pointInPolygon(p, a) || pointInPolygon(p, b)) && !pointInPolygon(p, island));
  close(result.area, 56); assert.equal(result.regions.length, 1); assert.equal(result.regions[0].holes.length, 1);
  const geometry = triangulateSurface(result.regions, { edgeLength: 2 }); close(areaOfGeometry(geometry), 56);
  const sampler = createTriangleSampler([geometry]); assert.equal(sampler.sample(3, 3), null); close(sampler.sample(5, 3).height, 0); sampler.dispose(); geometry.dispose();
});

test('boolean arrangement handles shared collinear edges and court holes at a shore', () => {
  const a = rectangle(0, 0, 5, 5), b = rectangle(5, 0, 10, 5), cut = rectangle(4, -1, 6, 2);
  const result = polygonBooleanRegions([a, b, cut], p => (pointInPolygon(p, a) || pointInPolygon(p, b)) && !pointInPolygon(p, cut));
  close(result.area, 46); assert.equal(result.regions.length, 1); assert.equal(result.regions[0].holes.length, 0);
});

test('height sampling agrees with a raycast of the stored, refined triangles', () => {
  const geometry = triangulateSurface([{ outer: rectangle(-10, -10, 10, 10), holes: [] }], { edgeLength: 2.6, heightAt: (x, z) => .4 * Math.sin(x) + .2 * z * z });
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material), sampler = createTriangleSampler([geometry]); mesh.updateMatrixWorld(true);
  for (const [x, z] of [[.17, -.32], [-8.71, 4.13], [6.66, -1.43], [0, 0]]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh);
    assert.ok(hits.length); close(sampler.sample(x, z).height, hits[0].point.y); assert.ok(sampler.sample(x, z).normal[1] > 0);
  }
  sampler.dispose(); geometry.dispose(); material.dispose();
});

test('a long narrow shoreline converges across adaptive size changes without reducing detail', () => {
  const limit = ([x]) => x < 512 || x > 1720 ? 4.5 : 20;
  const geometry = triangulateSurface([{ outer: rectangle(0, 0, 2048, 40), holes: [] }], { edgeLength: limit });
  close(areaOfGeometry(geometry), 81920, .01);
  const p = geometry.attributes.position, indices = geometry.index;
  for (let i = 0; i < indices.count; i += 3) for (let edge = 0; edge < 3; edge++) {
    const a = indices.getX(i + edge), b = indices.getX(i + (edge + 1) % 3), x = p.getX(a), z = p.getZ(a), xx = p.getX(b), zz = p.getZ(b);
    const required = Math.min(limit([x, z]), limit([xx, zz]), limit([(x + xx) / 2, (z + zz) / 2]));
    assert.ok(Math.hypot(xx - x, zz - z) <= required * 1.002);
  }
  geometry.dispose();
});

test('lake beds are below level water and island holes remain land', () => {
  assert.equal(terrain.surfaceAt(12, 10).kind, 'lake-bed'); assert.ok(terrain.heightAt(12, 10) < 1);
  assert.equal(terrain.surfaceAt(0, 4).kind, 'land'); assert.ok(terrain.heightAt(0, 4) > 2);
  for (const water of terrain.waterSurfaces) { assert.equal(water.worldY, 2); const sampler = createTriangleSampler([water.geometry]); assert.equal(sampler.sample(0, 0), null); sampler.dispose(); }
  close(terrain.diagnostics.landArea + terrain.diagnostics.waterArea + 80, 8000); assert.equal(terrain.diagnostics.metresCalibrated, false);
});

test('land and bed have matching shore vertices with no filled water plane', () => {
  const land = terrain.group.getObjectByName('yuanming-continuous-land').geometry, bed = terrain.group.getObjectByName('yuanming-connected-lake-beds').geometry;
  const a = createTriangleSampler([land]), b = createTriangleSampler([bed]);
  for (const [x, z] of [[-22, -17], [24, 20], [-6, -5]]) { close(a.sample(x, z).height, 2); close(b.sample(x, z).height, 2); }
  assert.equal(a.sample(12, 10), null); a.dispose(); b.dispose();
});

test('asset court has an actual terrain hole and a lower excavation floor', () => {
  const land = terrain.group.getObjectByName('yuanming-continuous-land'), material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(land.geometry, material); mesh.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(37, 30, 28), new THREE.Vector3(0, -1, 0)).intersectObject(mesh).length, 0);
  assert.equal(terrain.surfaceAt(37, 28).kind, 'court-excavation'); close(terrain.heightAt(37, 28), -2); close(terrain.heightAt(31.99, 28), 4, .01); material.dispose();
});

test('bridges have a genuine arch opening, a sampled deck and bank approaches', () => {
  const bridge = terrain.bridges[0], midpoint = [-17.5, 0]; assert.equal(terrain.surfaceAt(...midpoint).kind, 'bridge'); assert.ok(terrain.heightAt(...midpoint) > 4.5);
  assert.equal(terrain.surfaceAt(...midpoint, { includeBridges: false }).kind, 'lake-bed');
  assert.equal(terrain.surfaceAt(...midpoint, { maxY: 3 }).kind, 'lake-bed');
  const mesh = terrain.group.getObjectByName('fixture-bridge-open-arch');
  const sideways = new THREE.Raycaster(new THREE.Vector3(midpoint[0], 2.8, -10), new THREE.Vector3(0, 0, 1)); assert.equal(sideways.intersectObject(mesh).length, 0);
  close(terrain.heightAt(-35, 0), terrain.heightAt(-35, 0, { includeBridges: false }), .04);
  assert.ok(bridge.geometry.attributes.position.count > 30);
});

test('local guide queries retain exact rendered heights, water rejection and bridge support',()=>{
  const local=terrain.createGuideSupport({minX:-40,maxX:40,minZ:-35,maxZ:35});
  try{
    for(const maxY of [3,8,Infinity])for(const x of [-50,-35,-22,-17.5,-6,0,12,24,35,37,45])for(const z of [-36,-32,-17,-5,0,4,10,20,28,36]){
      const expected=terrain.surfaceAt(x,z,{maxY}),actual=local.surfaceAt(x,z,{maxY});
      assert.equal(actual?.height,expected?.height);assert.deepEqual(actual?.normal,expected?.normal);assert.equal(actual?.waterY,expected?.waterY);assert.equal(actual?.walkable,expected?.walkable);
    }
  }finally{local.dispose();}
});

test('standalone arch sampling never treats its downward intrados as a floor', () => {
  const built = createArchBridgeGeometry({ id: 'standalone', from: [0, 4.5, 0], to: [30, 4.5, 0], width: 4, deckY: 4.5 }, () => 4);
  const sampler = createTriangleSampler([built.geometry]); assert.ok(sampler.sample(15, 0).height > 4.5); assert.equal(sampler.sample(15, 0, 4.5), null); close(sampler.sample(-6, 0).height, 4); sampler.dispose(); built.geometry.dispose();
});

test('wall gates remove collision and physical wall segments across the entrance', () => {
  const gate = terrain.diagnostics.wallOpenings.find(opening => opening.id === 'test-gate'); assert.ok(gate); close(gate.position[0], 46); close(gate.position[1], 24);
  for (const collider of terrain.colliders.filter(collider => collider.kind === 'garden-wall')) assert.ok(closestOnSegment([46, 24], collider.from, collider.to).distance >= 3.99);
  const wall = terrain.group.getObjectByName('yuanming-garden-plaster-walls');
  const ray = new THREE.Raycaster(new THREE.Vector3(49, 5, 24), new THREE.Vector3(-1, 0, 0), 0, 6); assert.equal(ray.intersectObject(wall).length, 0);
});

test('stone shore supports walking and terrain retains layered vertex colours', () => {
  assert.equal(terrain.surfaceAt(35, -32).kind, 'stone-promenade');
  assert.equal(terrain.surfaceAt(25, -22).kind, 'stone-promenade');
  const colors = terrain.group.getObjectByName('yuanming-continuous-land').geometry.attributes.color; let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < colors.count; i++) { lo = Math.min(lo, colors.getY(i)); hi = Math.max(hi, colors.getY(i)); } assert.ok(hi - lo > .08);
  assert.ok(terrain.group.getObjectByName('yuanming-coastal-rock-strata')); assert.equal(terrain.heightAt(1000, 1000), 0);
});

test('asset support override and disposal preserve ownership boundaries', () => {
  const small = createGardenTerrain({ layout: { ...fixture, bridges: [], gardens: [], ornamentalWaters: [] }, assetCourts: [{ ...court, sampleHeight: () => ({ height: 3.35, normal: [0, 1, 0] }) }] });
  close(small.heightAt(37, 28), 3.35); assert.equal(small.surfaceAt(37, 28).supportSource, 'asset-sampler');
  close(small.heightAt(37, 28, { maxY: 2 }), -2);
  const water = small.waterSurfaces[0].geometry; let releases = 0; water.addEventListener('dispose', () => releases++); small.dispose(); small.dispose(); assert.equal(releases, 1); assert.equal(small.group.children.length, 0);
  assert.throws(() => createGardenTerrain({ layout: fixture, assetCourts: [{ ...court, floorY: 5 }] }), /higher rimY/);
  for(const rimBlend of [-.01,14.01,NaN,Infinity])assert.throws(()=>createGardenTerrain({layout:fixture,assetCourts:[{...court,rimBlend}]}),/rimBlend/);
});
