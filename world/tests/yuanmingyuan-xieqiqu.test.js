import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createXieqiquStudy } from '../src/yuanmingyuan/xieqiqu-study.js';
import { galleryCurve } from '../src/yuanmingyuan/xieqiqu-geometry.js';

// Keep one detailed asset for the read-only checks. The last case releases it
// before constructing its successor; no two complete factories run in parallel.
let asset;
before(() => { asset = createXieqiquStudy(); });
after(() => asset?.dispose());

function object(name) {
  const node = asset.group.getObjectByName(name);
  assert.ok(node, `addressable subassembly: ${name}`); return node;
}
function bounds(name) { return new THREE.Box3().setFromObject(object(name)); }
function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of node.material ? [].concat(node.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures };
}
function ray(origin, direction, target, far = Infinity) {
  const cast = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, far);
  return cast.intersectObject(typeof target === 'string' ? object(target) : target, true);
}
function category(hit) { return hit?.object.material.userData.category; }
function near(actual, expected, message, tolerance = .008) { assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`); }

test('the complete hall, paired curving galleries and two octagonal pavilions form a deep U-shaped group', () => {
  assert.ok(asset.group.isGroup);
  assert.equal(object('xieqiqu-main-hall').userData.storeys, 3);
  const hall = bounds('xieqiqu-main-building-fabric'), third = bounds('xieqiqu-third-storey');
  assert.ok(hall.getSize(new THREE.Vector3()).z >= 16, 'the hall has complete north–south depth');
  assert.ok(third.getSize(new THREE.Vector3()).x < hall.getSize(new THREE.Vector3()).x, 'the third storey rises above lower wings');
  assert.ok(bounds('xieqiqu-central-complete-roof').max.y > third.max.y, 'a complete roof covers the upper storey');
  assert.ok(bounds('xieqiqu-south-haitang-pool').min.z > hall.max.z, 'large southern pool remains in the forecourt');
  assert.ok(bounds('xieqiqu-north-chrysanthemum-pool').max.z < hall.min.z, 'small northern pool stays behind the building');
  for (const [id, sign] of [['west', -1], ['east', 1]]) {
    const gallery = bounds(`xieqiqu-${id}-curved-gallery`), pavilion = bounds(`xieqiqu-${id}-octagonal-music-pavilion`);
    assert.ok(sign * pavilion.getCenter(new THREE.Vector3()).x > hall.max.x);
    assert.ok(pavilion.max.z > gallery.max.z && gallery.min.z < hall.max.z);
    assert.equal(object(`xieqiqu-${id}-octagonal-music-pavilion`).userData.storeys, 2);
    assert.ok(bounds(`${id}-wing-upper-terrace`).max.y < third.max.y, 'wings retain their balustraded flat terraces');
    assert.ok(bounds(`xieqiqu-south-${id}-curved-stair`).min.z > 0);
    assert.ok(bounds(`xieqiqu-north-${id}-rectangular-stair`).max.z < 0);
  }
});

test('the separate reservoir lies northwest and its low annex is on the north side of the east elevation', () => {
  const reservoir = object('xieqiqu-northwest-reservoir'), high = bounds('reservoir-two-storey-main-building'), low = bounds('reservoir-north-low-service-annex');
  assert.equal(reservoir.userData.facing, 'east');
  assert.equal(reservoir.userData.serves, 'xieqiqu-north-and-south-fountains');
  assert.equal(reservoir.userData.notHaiyantangXihai, true);
  assert.equal(reservoir.userData.mechanism, 'not-reconstructed');
  assert.ok(high.max.x < bounds('xieqiqu-main-building-fabric').min.x);
  assert.ok(high.max.z < bounds('xieqiqu-main-building-fabric').min.z);
  assert.ok(low.getCenter(new THREE.Vector3()).z < high.min.z && low.max.y < high.max.y);
  assert.ok(high.getSize(new THREE.Vector3()).x > 10, 'the east-facing block has substantial depth');
});

test('all vertices and normals are finite and diagnostics count actual owned render resources', t => {
  const owned = resources(asset.group); let triangles = 0, meshes = 0;
  for (const geometry of owned.geometries) {
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    assert.ok(positions?.count > 0, geometry.name); assert.equal(normals?.count, positions.count);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
      if (![x, y, z, nx, ny, nz].every(Number.isFinite)) assert.fail(`${geometry.name}: non-finite vertex or normal at ${i}`);
      const length = Math.hypot(nx, ny, nz);
      if (length < .90 || length > 1.10) assert.fail(`${geometry.name}: unusable normal ${i}, length ${length}`);
    }
  }
  asset.group.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
  assert.equal(asset.diagnostics.triangleCount, triangles); assert.equal(asset.diagnostics.meshCount, meshes);
  for (const key of ['geometries', 'materials', 'textures']) assert.equal(asset.diagnostics.resourceOwnership[key], owned[key].size, key);
  const full = new THREE.Box3().setFromObject(asset.group);
  assert.deepEqual(asset.diagnostics.bounds.min, full.min.toArray()); assert.deepEqual(asset.diagnostics.bounds.max, full.max.toArray());
  for (const name of ['stone', 'masonry', 'plaster', 'glazed-tile', 'copper', 'timber', 'glass', 'water', 'soil']) assert.ok([...owned.materials].some(material => material.userData.category === name), name);
  const names = asset.diagnostics.subassemblies.map(part => part.name);
  assert.equal(new Set(names).size, names.length, 'subassembly names are stable and unique');
  assert.ok(asset.diagnostics.subassemblies.every(part => part.meshCount > 0 && part.triangleCount > 0 && part.body));
  t.diagnostic(JSON.stringify({ triangles, meshes, groups: names.length, materials: owned.materials.size, textures: owned.textures.size, waterStreams: asset.diagnostics.waterEndpoints.length, bounds: asset.diagnostics.bounds }));
});

test('masonry retains real glazed openings and every curved arcade can be crossed and walked lengthwise', () => {
  for (const check of asset.diagnostics.openingChecks) {
    const hits = ray(check.origin, check.direction, check.group, check.maxDistance);
    if (check.expectedCategory === 'unobstructed-passage') assert.equal(hits.length, 0, check.id);
    else assert.equal(category(hits[0]), check.expectedCategory, `${check.id}: first visible surface`);
  }
  for (const [id, side] of [['west', -1], ['east', 1]]) {
    const gallery = object(`xieqiqu-${id}-curved-gallery`), pavilion = object(`xieqiqu-${id}-octagonal-music-pavilion`), path = galleryCurve(side);
    for (let i = 0; i < 60; i++) {
      const a = path.getPointAt(i / 60).setY(1.65), c = path.getPointAt((i + 1) / 60).setY(1.65), length = a.distanceTo(c), direction = c.sub(a).normalize();
      const cast = new THREE.Raycaster(a, direction, 0, length);
      assert.equal(cast.intersectObjects([gallery, pavilion], true).length, 0, `${id} arcade longitudinal path ${i}`);
    }
    const doorway = object(`main-${id}-ground-elevation`);
    assert.equal(ray([side * 17.0, 1.65, 3.8], [-side, 0, 0], doorway, 3).length, 0, `${id} gallery enters the hall through a masonry void`);
    for (const t of [.01, .35, .7, .99]) {
      const p = path.getPointAt(t), floor = ray([p.x, .65, p.z], [0, -1, 0], gallery)[0];
      near(floor?.point.y, .34, `${id} arcade walking floor ${t}`);
    }
    const p = pavilion.position;
    assert.equal(ray([p.x, 1.65, p.z - 8], [0, 0, 1], pavilion, 16).length, 0, `${id} pavilion north–south portal pair is traversable`);
  }
});

test('the two different flower pools cut through paving, with thick rims, visible floors and water', () => {
  assert.equal(object('xieqiqu-south-haitang-pool').userData.flower, 'haitang');
  assert.equal(object('xieqiqu-north-chrysanthemum-pool').userData.flower, 'chrysanthemum');
  const large = bounds('xieqiqu-south-haitang-pool').getSize(new THREE.Vector3()), small = bounds('xieqiqu-north-chrysanthemum-pool').getSize(new THREE.Vector3());
  assert.ok(large.x > small.x * 2 && large.z > small.z, 'different flower plans are not duplicate equal-sized basins');
  for (const [name, x, z, rimX] of [['xieqiqu-south-haitang-pool', 7.6, 26, 14.911], ['xieqiqu-north-chrysanthemum-pool', 3.7, -27, 5.304]]) {
    for (const floorName of ['xieqiqu-court-paving', 'xieqiqu-court-stone-joints']) assert.equal(ray([x, 2, z], [0, -1, 0], floorName).length, 0, `${name}: ${floorName} is cut away`);
    const hits = ray([x, 2, z], [0, -1, 0], name);
    near(hits.find(hit => category(hit) === 'water')?.point.y, .13, `${name}: water level`);
    near(hits.find(hit => category(hit) === 'stone')?.point.y, -.45, `${name}: submerged floor`);
    assert.ok(ray([rimX, 2, z], [0, -1, 0], name).some(hit => category(hit) === 'stone' && hit.point.y > .48), `${name}: raised solid rim`);
  }
});

test('each jet meets its named receiving water surface without landing on a solid pedestal', () => {
  assert.ok(asset.diagnostics.waterEndpoints.length > 0);
  for (const endpoint of asset.diagnostics.waterEndpoints) {
    const point = object(endpoint.coordinateSpace).localToWorld(new THREE.Vector3(...endpoint.end));
    const water = ray([point.x, point.y + .13, point.z], [0, -1, 0], endpoint.basinId).find(hit => category(hit) === 'water');
    assert.ok(water, `${endpoint.id}: receiving surface`);
    assert.equal(water.object.material.userData.role, 'surface', `${endpoint.id}: receiving water uses the surface material`);
    assert.ok([...resources(object(endpoint.coordinateSpace)).materials].some(material => material.userData.role === 'flow'), `${endpoint.id}: its jet uses the separate flow material`);
    near(point.y, water.point.y, `${endpoint.id}: receiving elevation`, .018);
    const fountain = point.z > 0 ? 'xieqiqu-south-fountain' : 'xieqiqu-north-fountain';
    const solids = ray([point.x, 12, point.z], [0, -1, 0], fountain).filter(hit => category(hit) !== 'water');
    assert.ok(!solids.some(hit => hit.point.y > point.y + .022), `${endpoint.id}: water does not finish under solid carving or on a plinth`);
  }
});

test('the public update hook animates independent water textures while the pool geometry stays fixed', () => {
  const owned = resources(asset.group), flow = [...owned.materials].find(material => material.userData.role === 'flow');
  const endpoint = JSON.stringify(asset.diagnostics.waterEndpoints), position = flow.alphaMap.offset.clone();
  asset.update(.5);
  assert.notDeepEqual(flow.alphaMap.offset, position);
  assert.equal(JSON.stringify(asset.diagnostics.waterEndpoints), endpoint);
  assert.deepEqual(new THREE.Box3().setFromObject(asset.group).min.toArray(), asset.diagnostics.bounds.min);
  asset.update(0);
});

test('the upturned stone fish, bronze sheep and swallows have separate bodies and physical supports', () => {
  const animals = object('south-fountain-animal-sculptures');
  assert.equal(animals.children.filter(child => child.userData.body === 'western-upturned-tail-stone-fish').length, 4);
  assert.equal(animals.children.filter(child => child.userData.body === 'copper-sheep-fountain-sculpture').length, 2);
  assert.equal(animals.children.filter(child => child.userData.body === 'copper-swallow-fountain-sculpture').length, 2);
  for (let i = 1; i <= 4; i++) {
    const name = `xieqiqu-south-upturned-stone-fish-${i}`, body = bounds(`${name}-body`), plinth = bounds(`${name}-wave-plinth`);
    near(plinth.min.y, -.45, `${name}: stone support meets the pool floor`);
    assert.ok(body.min.y < plinth.max.y && body.max.y > plinth.max.y, `${name}: upturned body meets its carved wave support`);
    assert.ok([...resources(object(`${name}-body`)).materials].every(material => material.userData.category === 'stone'));
  }
  for (let i = 1; i <= 2; i++) {
    const side = i === 1 ? -1 : 1, sheep = bounds(`xieqiqu-south-copper-sheep-${i}-body`), sheepBase = bounds(`south-sheep-plinth-${side}`);
    near(sheep.min.y, sheepBase.max.y, `sheep ${i}: flat hooves meet stone`);
    const swallowName = `xieqiqu-south-copper-swallow-${i}`, swallow = bounds(`${swallowName}-body`), base = object(`south-swallow-stem-${side}`);
    near(swallow.min.y, new THREE.Box3().setFromObject(base).max.y, `swallow ${i}: flat feet meet support`);
    const centre = object(swallowName).position;
    near(ray([centre.x, 1.3, centre.z], [0, -1, 0], base)[0]?.point.y, 1.10, `swallow ${i}: pedestal has a filled top`);
    assert.ok(object(`${swallowName}-open-beak-spout`));
    for (const bodyName of [`xieqiqu-south-copper-sheep-${i}-body`, `${swallowName}-body`]) assert.ok([...resources(object(bodyName)).materials].every(material => material.userData.category === 'copper'));
  }
  assert.ok(!asset.group.getObjectByName('zodiac-rat'), 'Xieqiqu does not reuse Haiyantang zodiac figures');
});

test('grand stairs have grounded solid first risers and the lakeside landing reaches the submerged floor', () => {
  for (const contact of asset.diagnostics.contacts) {
    const [x, , z] = contact.point, ground = ray([x, .4, z], [0, -1, 0], contact.ground)[0];
    const underside = ray([x, -.1, z], [0, 1, 0], contact.id)[0], tread = ray([x, .4, z], [0, -1, 0], contact.id)[0];
    assert.ok(ground && underside && tread, `${contact.id}: complete foundation and tread`);
    assert.ok(underside.point.y <= ground.point.y + .002, `${contact.id}: foundation contact`);
    near(tread.point.y - ground.point.y, contact.firstTread, `${contact.id}: usable first step`);
  }
  const lake = object('xieqiqu-south-lake-foreground'), landing = object('south-lake-balustrade-and-viewing-landing');
  const hits = ray([10, .5, 46], [0, -1, 0], lake);
  near(hits.find(hit => category(hit) === 'water')?.point.y, -.20, 'foreground lake water');
  near(hits.find(hit => category(hit) === 'stone')?.point.y, -.85, 'foreground lake bottom');
  near(ray([0, 1, 41.8], [0, -1, 0], landing)[0]?.point.y, .14, 'solid viewing landing top');
  assert.ok(ray([0, -1.0, 41.8], [0, 1, 0], landing)[0]?.point.y <= -.85, 'viewing landing reaches the lake floor');
  assert.ok(ray([10, -1.0, 40.89], [0, 1, 0], lake)[0]?.point.y <= -.85, 'shore wall has no air gap above the lake floor');
});

test('historical metric uncertainty and the outstanding native visual review remain explicit', () => {
  const d = asset.diagnostics;
  assert.equal(d.visualAcceptance, false); assert.equal(d.integrationAcceptance, false); assert.equal(asset.group.userData.visualAcceptance, false);
  assert.equal(d.provisionalScale.isProvisional, true); assert.equal(asset.group.userData.allDimensionsProportional, true);
  assert.equal(d.timeLayer, '1859–1860-before-destruction');
  assert.equal(d.sourceViews.filter(source => source.type === 'historic-engraving').length, 3);
  assert.ok(d.sourceViews.some(source => source.id === 'park-xieqiqu'));
  assert.ok(d.inferred.some(text => text.includes('Every metre dimension')));
  assert.ok(d.inferred.some(text => text.includes('counts, poses, anatomy')));
  assert.ok(d.sourceLimitations.some(text => text.includes('dimensions are not legible')));
  assert.equal(asset.group.userData.publicSourceImagesEmbedded, false);
});

test('each factory owns all rendered resources and disposes them exactly once without a shared cache', () => {
  let owned = resources(asset.group); const emitted = new Map(), previous = new Set();
  for (const set of Object.values(owned)) for (const resource of set) {
    const id = resource.uuid; previous.add(id); emitted.set(id, 0);
    resource.addEventListener('dispose', () => emitted.set(id, emitted.get(id) + 1));
  }
  asset.dispose(); asset.dispose();
  assert.ok([...emitted.values()].every(count => count === 1), 'all resource dispose events occur once');
  assert.equal(asset.group.children.length, 0); owned = null;
  const subsequent = createXieqiquStudy();
  try {
    for (const set of Object.values(resources(subsequent.group))) for (const resource of set) assert.ok(!previous.has(resource.uuid), 'successive factories do not share resources');
    assert.equal(subsequent.diagnostics.resourceOwnership.moduleGlobalCache, false);
  } finally { subsequent.dispose(); subsequent.dispose(); }
});
