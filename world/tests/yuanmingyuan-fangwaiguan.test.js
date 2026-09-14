import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFangwaiguanStudy } from '../src/yuanmingyuan/fangwaiguan-study.js';

let asset;
before(() => { asset = createFangwaiguanStudy(); });
after(() => asset?.dispose());
const V = values => new THREE.Vector3(...values);
function object(name) { const o = asset.group.getObjectByName(name); assert.ok(o, name); return o; }
function box(name) { return new THREE.Box3().setFromObject(object(name)); }
function ray(origin, direction, target) { return new THREE.Raycaster(V(origin), V(direction)).intersectObject(typeof target === 'string' ? object(target) : target, true); }
function materialMesh(parent, material) { const mesh = object(parent).children.find(o => o.isMesh && o.material.name === `fangwaiguan-${material}`); assert.ok(mesh, `${parent}: ${material}`); return mesh; }
function verticalSpan(x, z, target) {
  const top = ray([x, 20, z], [0, -1, 0], target)[0], bottom = ray([x, -2, z], [0, 1, 0], target)[0];
  assert.ok(top && bottom, `${typeof target === 'string' ? target : target.name}: closed material at ${x}, ${z}`);
  return [bottom.point.y, top.point.y];
}
function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of o.material ? [].concat(o.material) : []) { materials.add(m); for (const t of Object.values(m)) if (t?.isTexture) textures.add(t); } });
  return { geometries, materials, textures };
}

test('reported hall envelope and independent full-depth elevations retain their evidence boundaries', () => {
  const floor = box('fangwaiguan-reported-footprint').getSize(new THREE.Vector3());
  assert.ok(Math.abs(floor.x - 14) < .001 && Math.abs(floor.z - 7) < .001);
  for (const name of ['south-front-elevation', 'north-back-elevation-inferred', 'west-side-elevation-inferred', 'east-side-elevation-inferred']) {
    const o = object(`fangwaiguan-${name}`); assert.ok(new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y > 9, name);
  }
  assert.ok(box('fangwaiguan-double-eave-blue-green-hipped-roof').getSize(new THREE.Vector3()).z > 7.8);
  assert.equal(object('fangwaiguan-complete-hall').userData.facing, 'south');
  assert.equal(asset.diagnostics.measurements.building.excludesLateralStairs, true);
  assert.ok(box('wuzhuting-five-linked-pavilions').min.z > box('fangwaiguan-complete-hall').max.z);
  assert.equal(asset.diagnostics.visualAcceptance, false); assert.equal(asset.diagnostics.integrationAcceptance, false);
  assert.ok(asset.diagnostics.inferred.some(s => s.includes('Back and side')));
});

test('the visible glazing lies behind real holes and both doors have open central portals', () => {
  for (const check of asset.diagnostics.openingChecks) {
    const elevation = object(check.elevation), p = elevation.localToWorld(V(check.origin)), d = V(check.direction).transformDirection(elevation.matrixWorld);
    const hit = new THREE.Raycaster(p, d).intersectObject(elevation, true)[0];
    assert.ok(hit, check.id); assert.equal(hit.object.material.userData.category, 'glass', check.id);
    assert.ok(hit.distance > 2.1, `${check.id}: glazing is recessed behind the exterior plane`);
  }
  const front = object('fangwaiguan-south-front-elevation');
  for (const y of [1.5, 2.4, 5.95, 7.1]) assert.equal(ray([0, y, 5], [0, 0, -1], front).length, 0, `clear door centreline at ${y}`);
  for (const x of [-.32, 0, .32]) for (const y of [1.05, 1.72, 2.3]) {
    assert.equal(new THREE.Raycaster(V([x, y, 5]), V([0, 0, -1]), 0, 10).intersectObject(object('fangwaiguan-complete-hall'), true).length, 0, 'front and back portals provide actual ground-floor passage');
  }
  for (const [origin, direction] of [[[6.0, 2, 5], [0, 0, -1]], [[6.5, 7, -5], [0, 0, 1]], [[9, 6.3, 2.5], [-1, 0, 0]], [[-9, 6.3, -2.5], [1, 0, 0]]]) assert.ok(ray(origin, direction, 'fangwaiguan-complete-hall').length, 'solid wall remains around openings');
});

test('each curved flight has supported horizontal treads and a continuous upper landing', () => {
  for (const path of asset.diagnostics.walkPaths) {
    let last = 0;
    for (const point of path.points) {
      const hit = ray([point[0], point[1] + .08, point[2]], [0, -1, 0], path.treadGroup)[0];
      assert.ok(hit, path.id); assert.ok(Math.abs(hit.point.y - point[1]) < .001, `${path.id}: authored tread point lies on actual step`);
      assert.ok(hit.face.normal.y > .99, 'tread is horizontal'); assert.ok(point[1] > last); last = point[1];
    }
    const first = path.points[0], underside = ray([first[0], -.2, first[2]], [0, 1, 0], path.treadGroup)[0], ground = ray([first[0], .1, first[2]], [0, -1, 0], 'fangwaiguan-court-paving')[0];
    assert.ok(underside && ground); assert.ok(underside.point.y <= ground.point.y + .002, 'no floating stair footing');
    assert.ok(first[1] - ground.point.y < .18, 'usable first riser');
    const side = path.id.includes('west') ? -1 : 1;
    for (const x of [7.70, 7.90, 8.04]) {
      const hit = ray([side * x, 5.1, 3.6], [0, -1, 0], 'fangwaiguan-upper-floor-and-balcony')[0];
      assert.ok(hit && Math.abs(hit.point.y - path.endDatum) < .001, 'stair head meets the continuous upper floor');
    }
    for (const z of [3.95, 4.20, 4.45]) {
      const start = V([side * 7.3, 5.94, z]);
      assert.equal(new THREE.Raycaster(start, V([-side, 0, 0]), .01, 7.3).intersectObject(object('fangwaiguan-complete-hall'), true).length, 0, 'usable balcony passage in front of the pilasters');
    }
    assert.equal(new THREE.Raycaster(V([0, 5.94, 4.2]), V([0, 0, -1]), 0, 2.7).intersectObject(object('fangwaiguan-complete-hall'), true).length, 0, 'balcony enters the upstairs door');
  }
});

test('five bamboo pavilions are physically joined by four covered walkways', () => {
  const group = object('wuzhuting-five-linked-pavilions'), pavilions = group.children.filter(o => o.userData.role === 'one-of-five-linked-bamboo-pavilions'), links = object('wuzhuting-four-linked-galleries').children.filter(o => o.isGroup);
  assert.equal(pavilions.length, 5); assert.equal(links.length, 4);
  for (const p of pavilions) {
    const owned = resources(p); assert.ok([...owned.materials].some(m => m.userData.category === 'bamboo'));
    assert.ok([...owned.materials].some(m => m.userData.category === 'glazed-tile'));
  }
  for (const link of links) {
    const [a, c] = link.userData.connects.map(name => object(name).getWorldPosition(new THREE.Vector3()));
    for (let i = 0; i <= 32; i++) {
      const p = a.clone().lerp(c, i / 32), hits = ray([p.x, .61, p.z], [0, -1, 0], group);
      assert.ok(hits.some(h => Math.abs(h.point.y - .42) < .01), `${link.name}: continuous floor across both pavilion junctions`);
    }
    // Architecture must leave passage height, not only a floor hidden under a lattice wall.
    const direction = c.clone().sub(a).normalize(), length = a.distanceTo(c), across = new THREE.Vector3(-direction.z, 0, direction.x);
    for (const offset of [-.48, 0, .48]) for (const height of [1.12, 1.72, 2.22]) {
      const origin = a.clone().addScaledVector(across, offset).setY(height);
      const hits = new THREE.Raycaster(origin, direction, .4, length - .4).intersectObject(group, true);
      assert.equal(hits.length, 0, `${link.name}: clear passage at offset ${offset}, height ${height}`);
    }
    for (let i = 0; i <= 32; i++) {
      const p = a.clone().lerp(c, i / 32);
      const cover = ray([p.x, 20, p.z], [0, -1, 0], group).find(h => ['glazed-tile', 'copper'].includes(h.object.material.userData.category));
      assert.ok(cover && cover.point.y > 3.4, `${link.name}: roof cover continues through both pavilion junctions`);
    }
  }
});

test('hall roof tiers share a solid bearing and pavilion roof centres are capped', () => {
  const drum = materialMesh('fangwaiguan-double-eave-blue-green-hipped-roof', 'painted-wood-joinery');
  for (const [x, z] of [[-5.70, .8], [5.70, -.8], [2, 2.11], [-2, -2.11]]) {
    const lower = verticalSpan(x, z, materialMesh('fangwaiguan-lower-hipped-roof', 'blue-green-glazed-roof'));
    const upper = verticalSpan(x, z, materialMesh('fangwaiguan-upper-hipped-roof', 'blue-glazed-roof-bands'));
    const support = verticalSpan(x, z, drum);
    assert.ok(support[0] <= lower[1] && support[1] >= lower[0], 'lower roof bears on the timber transition');
    assert.ok(support[0] <= upper[1] && support[1] >= upper[0], 'upper roof bears on the timber transition');
  }
  for (const pavilion of object('wuzhuting-five-linked-pavilions').children.filter(o => o.userData.role === 'one-of-five-linked-bamboo-pavilions')) {
    const p = pavilion.getWorldPosition(new THREE.Vector3()), roof = `${pavilion.name}-double-eave-roof`;
    const span = verticalSpan(p.x, p.z, roof);
    assert.ok(span[0] > 5 && span[1] - span[0] > .02, `${pavilion.name}: finial closes the roof centre`);
  }
});

test('both hall roof tiers have separate barrel and pan courses with visible physical laps', () => {
  for (const [name, beforeZ, afterZ, lapZ, barrelX] of [
    ['fangwaiguan-lower-hipped-roof', 3.565, 3.561, 3.540, -.103],
    ['fangwaiguan-upper-hipped-roof', 1.948, 1.944, 1.920, -.103],
  ]) {
    const pans = `${name}-pan-tiles`, barrels = `${name}-barrel-tiles`;
    const before = ray([0, 20, beforeZ], [0, -1, 0], pans)[0], after = ray([0, 20, afterZ], [0, -1, 0], pans)[0];
    assert.ok(before && after, `${name}: both sides of the first course joint have real pan tiles`);
    assert.ok(after.point.y - before.point.y > .010 && after.point.y - before.point.y < .020, `${name}: physical clay overlap is visible above the roof fall`);
    const heights = [...new Set(ray([0, 20, lapZ], [0, -1, 0], pans).map(h => Math.round(h.point.y * 1e5) / 1e5))];
    assert.ok(heights.length >= 2 && Math.max(...heights) - Math.min(...heights) > .007, `${name}: the new course covers the preceding tile`);
    const crown = ray([barrelX, 20, afterZ], [0, -1, 0], barrels)[0];
    assert.ok(crown && crown.point.y - after.point.y > .035, `${name}: barrel tiles have a curved crown above the pan`);
    for (const m of resources(object(name)).materials) if (m.name.includes('firing-variation')) assert.equal(m.userData.category, 'glazed-tile');
  }
  const wall = materialMesh('fangwaiguan-south-front-elevation', 'mineral-plaster').material;
  assert.ok(wall.map?.isDataTexture, 'broad plaster receives a mineral tint field');
  const tones = [];
  for (let i = 0; i < wall.map.image.data.length; i += 4) tones.push(wall.map.image.data[i]);
  const spread = Math.max(...tones) - Math.min(...tones);
  assert.ok(spread >= 3 && spread <= 18 && Math.min(...tones) > 230, 'colour movement is restrained and does not simulate ruined or dirty masonry');
  assert.equal(wall.map.colorSpace, THREE.SRGBColorSpace);
});

test('pavilion frames, rafters, lower shells and upper drums have actual material overlap', () => {
  for (const pavilion of object('wuzhuting-five-linked-pavilions').children.filter(o => o.userData.role === 'one-of-five-linked-bamboo-pavilions')) {
    const { radius } = pavilion.userData.dimensionsInferred, p = pavilion.getWorldPosition(new THREE.Vector3()), roof = `${pavilion.name}-double-eave-roof`;
    const lower = materialMesh(roof, 'blue-green-glazed-roof'), upper = materialMesh(roof, 'blue-glazed-roof-bands');
    for (const angle of [Math.PI / 8, Math.PI * 5 / 8, Math.PI * 9 / 8, Math.PI * 13 / 8]) {
      const x = p.x + Math.cos(angle) * (radius * .61 + .015), z = p.z + Math.sin(angle) * (radius * .61 + .015);
      const shell = verticalSpan(x, z, lower), rafter = verticalSpan(x, z, `${pavilion.name}-roof-rafters`);
      assert.ok(rafter[1] >= shell[0] && rafter[0] <= shell[1], `${pavilion.name}: rafter supports lower shell`);
      const footX = p.x + Math.cos(angle) * (radius - .12), footZ = p.z + Math.sin(angle) * (radius - .12);
      const foot = verticalSpan(footX, footZ, `${pavilion.name}-roof-rafters`), frame = verticalSpan(footX, footZ, `${pavilion.name}-bamboo-frame`);
      assert.ok(foot[0] <= frame[1], `${pavilion.name}: rafter foot meets the bamboo frame`);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const distance = (radius * .61 + .015) * Math.cos(Math.PI / 8), x = p.x + dx * distance, z = p.z + dz * distance;
      const support = verticalSpan(x, z, `${pavilion.name}-roof-transition-drum`), lo = verticalSpan(x, z, lower), hi = verticalSpan(x, z, upper);
      assert.ok(support[0] <= lo[1] && support[1] >= lo[0], `${pavilion.name}: drum connects to lower shell`);
      assert.ok(support[0] <= hi[1] && support[1] >= hi[0], `${pavilion.name}: drum supports upper shell`);
    }
  }
});

test('transparent channel and pool have cut-out paving, visible floors and substantial side walls', () => {
  for (const [name, x, z, waterY, floorY] of [['fangwaiguan-water-channel', 5, 16.8, -.22, -.93], ['wuzhuting-front-fountain-basin', 1.0, 25, -.13, -.72]]) {
    assert.equal(ray([x, 1, z], [0, -1, 0], 'fangwaiguan-court-paving').length, 0, `${name}: actual paving cutout`);
    const hits = ray([x, 1, z], [0, -1, 0], name);
    assert.ok(hits.some(h => h.object.material.userData.category === 'water' && Math.abs(h.point.y - waterY) < .002), `${name}: correct water level`);
    assert.ok(hits.some(h => h.object.material.userData.category === 'stone' && Math.abs(h.point.y - floorY) < .002), `${name}: submerged solid floor`);
  }
  const bank = ray([5, 1, 14.5], [0, -1, 0], 'fangwaiguan-water-channel')[0]; assert.ok(bank.point.y > .26);
  const rim = ray([2.15, 1, 25], [0, -1, 0], 'wuzhuting-front-fountain-basin')[0]; assert.ok(rim.point.y > .24);
});

test('diagnostics count actual finite geometry and retain independent disposable resources', () => {
  const owned = resources(asset.group); let meshes = 0, triangles = 0;
  asset.group.traverse(o => {
    if (!o.isMesh) return; meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    assert.ok(o.matrixWorld.determinant() > 0, `${o.name}: no negative-scale mirroring`);
    const p = o.geometry.attributes.position, n = o.geometry.attributes.normal;
    assert.equal(p.count, n.count);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)), o.name);
      const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); assert.ok(length > .90 && length < 1.10, `${o.name}: usable normal at ${i}`);
    }
  });
  assert.equal(asset.diagnostics.meshCount, meshes); assert.equal(asset.diagnostics.triangleCount, triangles); assert.equal(asset.diagnostics.resourceOwnership.geometries, owned.geometries.size);
  const full = new THREE.Box3().setFromObject(asset.group); assert.deepEqual(asset.diagnostics.bounds.min, full.min.toArray()); assert.deepEqual(asset.diagnostics.bounds.max, full.max.toArray());
  for (const m of owned.materials) if (m.userData.category === 'copper') assert.ok(Math.abs(m.roughness * 220 / 255 - .604) < .002, 'copper factor accounts for the roughness texture');
  let disposed = 0; for (const set of Object.values(owned)) for (const resource of set) resource.addEventListener('dispose', () => disposed++);
  asset.dispose(); const total = Object.values(owned).reduce((sum, set) => sum + set.size, 0); assert.equal(disposed, total); asset.dispose(); assert.equal(disposed, total);
  const second = createFangwaiguanStudy();
  try {
    const secondOwned = resources(second.group);
    for (const key of Object.keys(owned)) for (const resource of secondOwned[key]) assert.ok(!owned[key].has(resource), `factory-local ${key}`);
  } finally { second.dispose(); }
});
