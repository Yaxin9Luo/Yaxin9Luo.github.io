import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYuanyingguanStudy } from '../src/yuanmingyuan/yuanyingguan-study.js';
import { organicLoft, houndAnatomy, deerAnatomy, blendedEllipsoids, sculptureNeckSections, carvedLeaf, fountainFlowGeometry, fountainRippleGeometry, createFountainWater } from '../src/yuanmingyuan/yuanyingguan-geometry.js';

// One shared read-only asset avoids rebuilding a detailed architectural group
// per assertion. The lifecycle case replaces it only after all geometry checks.
let asset;

function object(name) {
  const result = asset.group.getObjectByName(name);
  assert.ok(result, `addressable subassembly: ${name}`); return result;
}
function bounds(name) { return new THREE.Box3().setFromObject(object(name)); }
function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of node.material ? [].concat(node.material) : []) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures };
}
function ray(origin, direction, target) {
  return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(typeof target === 'string' ? object(target) : target, true);
}

test('fixtures: posed necks and legs remain consistently oriented and visible when their tangent crosses vertical', () => {
  // Reduced fixtures from the native 6da68c3da8ab9f66 crane/deer failures.
  // Their old meshes had no open edges but 104/77 inconsistently oriented edges.
  const cases = [
    { id: 'crane-neck', sides: 18, steps: 35, sections: [[0, 1.41, .33, .10, .13], [0, 1.70, .44, .065, .09], [0, 1.97, .27, .051, .061], [0, 2.18, .31, .045, .047], [0, 2.31, .49, .064, .065], [0, 2.30, .61, .046, .041]] },
    { id: 'deer-foreleg', sides: 14, steps: 27, sections: [[.23, 1.80, .42, .17, .21], [.26, 1.20, .51, .093, .12], [.26, .69, .49, .06, .07], [.27, .12, .76, .035, .043]] },
    { id: 'hound-foreleg', sides: 13, steps: 23, sections: houndAnatomy().foreleg },
    { id: 'deer-antler', sides: 12, steps: 27, sections: deerAnatomy().antler },
  ];
  for (const { id, sections, sides, steps } of cases) {
    const geometry = organicLoft(sections, sides, steps), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
    try {
      const positions = geometry.attributes.position, index = geometry.index, edges = new Map();
      const key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(value => value.toFixed(5)).join(',');
      for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
        const vertices = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
        for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
          const from = key(a), to = key(b), edge = from < to ? `${from}|${to}` : `${to}|${from}`;
          if (!edges.has(edge)) edges.set(edge, []);
          edges.get(edge).push(from < to ? 1 : -1);
        }
      }
      for (const [edge, directions] of edges) {
        assert.equal(directions.length, 2, `${id}: closed edge ${edge}`);
        assert.equal(directions[0] + directions[1], 0, `${id}: two adjacent faces have opposite directed edges`);
      }
      const path = new THREE.CatmullRomCurve3(sections.map(point => new THREE.Vector3(...point.slice(0, 3)))); mesh.updateMatrixWorld(true);
      for (let i = 0; i < steps * 2; i++) for (const side of [-1, 1]) {
        const center = path.getPoint((i + .5) / (steps * 2)), cast = new THREE.Raycaster(center.clone().add(new THREE.Vector3(side, 0, 0)), new THREE.Vector3(-side, 0, 0), 0, 2);
        const first = cast.intersectObject(mesh)[0];
        assert.ok(first && first.distance < 1, `${id}: front-facing skin before the centerline at sample ${i}, side ${side}`);
      }
    } finally { geometry.dispose(); material.dispose(); }
  }
});

test('fixtures: sculpture junction caps are buried within the adjoining volume', () => {
  const leaks = [];
  function checkRoot(id, child, childSides, childSteps, parent, parentSides, parentSteps, ridge = .015) {
    const childGeometry = organicLoft(child, childSides, childSteps, .015), geometry = organicLoft(parent, parentSides, parentSteps, ridge);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
    try {
      mesh.updateMatrixWorld(true);
      const positions = childGeometry.attributes.position, direction = new THREE.Vector3(.37, .71, .59).normalize();
      for (let i = 0; i < childSides; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i), cast = new THREE.Raycaster(point, direction, .000001);
        const distances = [...new Set(cast.intersectObject(mesh).map(hit => hit.distance.toFixed(5)))];
        if (distances.length % 2 !== 1) leaks.push(`${id}: exposed root vertex ${i}`);
      }
    } finally { childGeometry.dispose(); geometry.dispose(); material.dispose(); }
  }
  for (const side of [-1, 1]) {
    const dog = houndAnatomy(side), deer = deerAnatomy(side);
    checkRoot(`hound-shoulder-${side}`, dog.foreleg, 13, 23, dog.torso, 20, 34, .035);
    checkRoot(`hound-neck-${side}`, dog.neck, 20, 29, dog.torso, 20, 34, .035);
    checkRoot(`antler-skull-${side}`, deer.antler, 12, 27, deer.neck, 22, 34);
    for (const [index, branch] of deer.branches.entries()) checkRoot(`antler-tine-${side}-${index}`, branch, 10, 18, deer.antler, 12, 27);
  }
  assert.deepEqual(leaks, [], 'a capped loft must enter its adjoining volume before its visible taper begins');
});

test('fixtures: clear surface water and moving jets have separate shading and local resources', () => {
  const water = createFountainWater('fixture'), other = createFountainWater('second-fixture');
  try {
    assert.notEqual(water.surface, water.flow);
    assert.notEqual(water.surface.normalMap, water.flow.normalMap, 'surface ripples must not lock to jet motion');
    for (const material of [water.surface, water.flow]) {
      assert.ok(material.transmission > .5 && material.transmission < .85 && material.depthWrite === false, 'clear water retains a reflected component so it does not disappear over pale stone');
      const channels = material.color.toArray();
      assert.ok(Math.max(...channels) - Math.min(...channels) < .10, 'water has no opaque mint tint');
    }
    assert.ok(water.flow.alphaMap, 'fine flow highlights soften the solid tube silhouette');
    assert.ok(water.textures.every(texture => !other.textures.includes(texture)), 'separate factory invocations own their textures');
    const normal = water.flow.normalMap.offset.clone(), alpha = water.flow.alphaMap.offset.clone();
    water.update(.5);
    assert.notDeepEqual(water.flow.normalMap.offset, normal); assert.notDeepEqual(water.flow.alphaMap.offset, alpha);
    assert.equal(water.flow.normalMap.offset.y, water.flow.alphaMap.offset.y, 'normal and density variations travel together down the stream');
    assert.notEqual(water.surface.normalMap.offset.y, water.flow.normalMap.offset.y);
    water.update(0); assert.ok(Math.abs(water.flow.alphaMap.offset.y) < .000001, 'capture time can be set deterministically');
  } finally { for (const value of [water, other]) for (const resource of [value.surface, value.flow, ...value.textures]) resource.dispose(); }
});

test('fixtures: smooth anatomical unions remove internal caps and subtract a real mouth opening', () => {
  const geometry = blendedEllipsoids([{ center: [0, 0, 0], radii: [.4, .35, .6] }, { center: [0, .30, -.25], radii: [.38, .5, .35] }], { resolution: 28, blend: .05, cutouts: [{ center: [0, 0, .55], radii: [.12, .05, .25] }] });
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  try {
    mesh.updateMatrixWorld(true);
    const fromMouth = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
    assert.ok(fromMouth[0].point.z < .4, 'the mouth is recessed into the head rather than painted onto a capped tube');
    const fromInside = new THREE.Raycaster(new THREE.Vector3(0, .2, -.15), new THREE.Vector3(1, 0, 0)).intersectObject(mesh);
    assert.equal(fromInside.length, 1, 'the overlapping anatomy has a single outer skin');
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i)));
      assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .001, 'union normals remain unit length after non-uniform voxel scaling');
    }
    for (const hit of fromInside) assert.ok(normals.getX(hit.face.a) > .5 && hit.face.normal.x > .5, 'the outer smooth normal and face winding point away from the fused body');
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixtures: carved leaves have a closed consistently wound smooth skin instead of faceted caps', () => {
  for (const kind of ['acanthus', 'grape']) {
    const geometry = carvedLeaf(kind);
    try {
      assert.ok(geometry.index, `${kind}: surfaces share vertices for interpolated normals`);
      const edges = new Map(), index = geometry.index.array, positions = geometry.attributes.position, normals = geometry.attributes.normal;
      for (let i = 0; i < index.length; i += 3) for (let e = 0; e < 3; e++) {
        const a = index[i + e], b = index[i + (e + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const value = edges.get(key) ?? { count: 0, direction: 0 }; value.count++; value.direction += a < b ? 1 : -1; edges.set(key, value);
      }
      assert.equal([...edges.values()].filter(value => value.count !== 2 || value.direction !== 0).length, 0, `${kind}: every edge joins two oppositely wound faces`);
      for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .001, `${kind}: unit normal ${i}`);
    } finally { geometry.dispose(); }
  }
});

test('fixtures: a continuously tapered neck never inflates into repeated beads at sampling joints', () => {
  const sections = [[0, 0, 0, .13, .14], [0, .5, 0, .10, .11], [0, 1, 0, .07, .08]];
  const geometry = blendedEllipsoids([], { resolution: 48, blend: .023, sweeps: [sections] }), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  try {
    mesh.updateMatrixWorld(true); let previous = Infinity;
    for (let i = 0; i <= 32; i++) {
      const y = .1 + i / 32 * .8, hit = new THREE.Raycaster(new THREE.Vector3(1, y, 0), new THREE.Vector3(-1, 0, 0)).intersectObject(mesh)[0];
      assert.ok(hit, `continuous neck skin at ${y}`);
      assert.ok(Math.abs(hit.point.x - (.13 - .06 * y)) < .002, 'the sampled silhouette follows its authored taper');
      assert.ok(hit.point.x <= previous + .0001, 'a narrowing neck cannot grow outward again at each sampled section'); previous = hit.point.x;
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixtures: the posed crane neck preserves smooth narrow cross-sections through its curved middle', () => {
  const sections = sculptureNeckSections('crane'), path = new THREE.CatmullRomCurve3(sections.map(section => new THREE.Vector3(...section.slice(0, 3)))), radii = new THREE.CatmullRomCurve3(sections.map(section => new THREE.Vector3(section[3], section[4], 0)));
  const geometry = blendedEllipsoids([], { resolution: 64, blend: .023, sweeps: [sections] }), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  try {
    mesh.updateMatrixWorld(true);
    for (let i = 0; i <= 28; i++) {
      const t = .25 + i / 28 * .5, center = path.getPoint(t), expected = radii.getPoint(t).x;
      const hit = new THREE.Raycaster(center.clone().add(new THREE.Vector3(1, 0, 0)), new THREE.Vector3(-1, 0, 0)).intersectObject(mesh)[0];
      assert.ok(hit, `neck skin at ${t}`);
      assert.ok(Math.abs(hit.point.x - center.x - expected) < .006, `neck section ${i} does not develop a separate inflated blob`);
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixtures: small eyelids retain their authored scale without becoming horn-like knobs', () => {
  const geometry = organicLoft([[0, 0, 0, .002, .002], [0, .015, .02, .003, .003], [0, 0, .04, .001, .001]], 10, 10, 0, .001);
  try {
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.getSize(new THREE.Vector3()).x < .007, 'the original 8 mm loft radius floor cannot enlarge millimetre eyelids');
  } finally { geometry.dispose(); }
});

test('fixtures: landing wave crests remain shallow and leave the true water endpoint uncovered', () => {
  const geometry = fountainRippleGeometry(), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  try {
    mesh.updateMatrixWorld(true); geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.min.y >= 0 && geometry.boundingBox.max.y < .012, 'the landing detail is a water crest rather than a raised solid torus');
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0, .5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(mesh).length, 0, 'the source endpoint remains on the underlying water plane');
    assert.ok(new THREE.Raycaster(new THREE.Vector3(.30, .5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(mesh).length > 0, 'crests face upward to receive daylight highlights');
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixtures: thinner animated flow geometry retains the exact source and receiving-water endpoint', () => {
  const points = [[0, 1.40, 1.655], [0, 1.98, 2.4], [0, 1.35, 3.1], [0, -.25, 3.6]], geometry = fountainFlowGeometry(points, .021);
  try {
    const positions = geometry.attributes.position, sides = 10, steps = 32;
    for (const [row, target] of [[0, points[0]], [steps, points.at(-1)]]) {
      const center = new THREE.Vector3();
      for (let i = 0; i < sides; i++) center.add(new THREE.Vector3().fromBufferAttribute(positions, row * sides + i));
      center.divideScalar(sides);
      assert.ok(center.distanceTo(new THREE.Vector3(...target)) < .000001, 'moving texture never moves the physical stream outlet or landing');
    }
  } finally { geometry.dispose(); }
});

describe('complete architectural factory checks', () => {
  before(() => { asset = createYuanyingguanStudy(); });
  after(() => asset?.dispose());

  test('complete hall, fountain and throne preserve the north–south vista and separate measured envelopes', () => {
    assert.ok(asset.group.isGroup);
    const hall = bounds('yuanyingguan-complete-hall'), niche = bounds('dashuifa-sculpted-stone-niche'), throne = bounds('guanshuifa-carved-throne');
    assert.ok(hall.max.z < niche.min.z, 'the complete hall is north of the water niche');
    assert.ok(niche.max.z < throne.min.z, 'the throne is south of the central fountain');
    assert.ok(hall.getSize(new THREE.Vector3()).z >= 20.9, 'the hall is a full-depth building');
    const floor = bounds('yuanyingguan-building-footprint');
    assert.ok(Math.abs(floor.getSize(new THREE.Vector3()).x - 28) < .001);
    assert.ok(Math.abs(floor.getSize(new THREE.Vector3()).z - 21) < .001);
    assert.deepEqual(object('yuanyingguan-terrace').userData.measuredDimensions, { x: 35, z: 31 });
    assert.equal(object('guanshuifa').userData.facing, 'north');
    assert.equal(object('yuanyingguan-five-roof-hypothesis').children.filter(child => child.isGroup).length, 5);
    const west = bounds('dashuifa-west-circular-basin'), east = bounds('dashuifa-east-circular-basin');
    assert.ok(Math.abs(east.getCenter(new THREE.Vector3()).x - west.getCenter(new THREE.Vector3()).x - 62) < .001);
    assert.equal(asset.diagnostics.measurements.pairedPools.diameter, 18);
    assert.equal(object('measured-fountain-court').userData.surroundingGrade, 1.3);
    assert.ok(bounds('guanshuifa-west-copper-crane').max.x < 0, 'the west crane keeps its geographical name after the throne group is rotated');
  });

  test('reported diagnostics describe actual finite geometry, with usable normals and distinct materials', t => {
    const owned = resources(asset.group); let triangles = 0, meshes = 0;
    for (const geometry of owned.geometries) {
      const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
      assert.ok(positions?.count > 0, geometry.name); assert.equal(positions.count, normals?.count);
      for (let i = 0; i < positions.count; i++) {
        for (const attribute of [positions, normals]) assert.ok(Number.isFinite(attribute.getX(i)) && Number.isFinite(attribute.getY(i)) && Number.isFinite(attribute.getZ(i)), `${geometry.name}: finite vertex and normal ${i}`);
        const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
        assert.ok(length > .90 && length < 1.10, `${geometry.name}: usable normal ${i}`);
      }
    }
    asset.group.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
    assert.equal(asset.diagnostics.triangleCount, triangles); assert.equal(asset.diagnostics.meshCount, meshes);
    assert.equal(asset.diagnostics.resourceOwnership.geometries, owned.geometries.size);
    const full = new THREE.Box3().setFromObject(asset.group);
    assert.deepEqual(asset.diagnostics.bounds.min, full.min.toArray()); assert.deepEqual(asset.diagnostics.bounds.max, full.max.toArray());
    for (const category of ['stone', 'masonry', 'plaster', 'glazed-tile', 'copper', 'timber', 'glass', 'water']) assert.ok([...owned.materials].some(material => material.userData.category === category), category);
    assert.ok(asset.diagnostics.subassemblies.every(part => part.meshCount > 0 && part.triangleCount > 0));
    t.diagnostic(JSON.stringify({ triangles, meshes, groups: asset.diagnostics.subassemblies.length, materials: owned.materials.size, textures: owned.textures.size, waterStreams: asset.diagnostics.waterEndpoints.length, bounds: asset.diagnostics.bounds }));
  });

  test('main door and side glazing are visible through actual masonry openings', () => {
    for (const check of asset.diagnostics.openingChecks) {
      const hit = ray(check.origin, check.direction, check.group)[0];
      assert.ok(hit, check.id); assert.equal(hit.object.material.userData.category, check.expectedCategory, `${check.id}: first visible surface`);
    }
    for (const y of [4.04, 4.13, 4.34]) {
      const hit = ray([.14, y, -25], [0, 0, -1], 'yuanyingguan-complete-hall')[0];
      assert.ok(hit); assert.equal(hit.object.material.userData.category, 'timber', `the door is not blocked by a generic plinth band at y=${y}`);
    }
    for (const id of ['west', 'east']) {
      const gate = object(`guanshuifa-${id}-side-gate`), point = gate.localToWorld(new THREE.Vector3(.16, 1.66, 4)), direction = new THREE.Vector3(0, 0, -1).transformDirection(gate.matrixWorld);
      assert.equal(new THREE.Raycaster(point, direction).intersectObject(gate, true).length, 0, `${id} side gate retains a walk-through portal`);
    }
  });

  test('all three pools cut through the paving and retain water below a substantial stone rim', () => {
    const cases = [
      ['dashuifa-central-animal-basin', 5.1, -12.4, 0, -.78],
      ['dashuifa-west-circular-basin', -25.9, -4.1, -22.06, -5],
      ['dashuifa-east-circular-basin', 36.1, -4.1, 39.94, -5],
    ];
    for (const [id, x, z, rimX, rimZ] of cases) {
      assert.equal(ray([x, 2, z], [0, -1, 0], 'court-paving').length, 0, `${id}: no paving underneath water`);
      const hits = ray([x, 2, z], [0, -1, 0], id), water = hits.find(hit => hit.object.material.userData.category === 'water');
      assert.ok(water && Math.abs(water.point.y - .12) < .001, `${id}: consistent water plane`);
      assert.ok(hits.some(hit => hit.object.material.userData.category === 'stone' && Math.abs(hit.point.y + .42) < .001), `${id}: submerged floor`);
      const rim = ray([rimX, 2, rimZ], [0, -1, 0], id).find(hit => hit.object.material.userData.category === 'stone');
      assert.ok(rim && rim.point.y > .40, `${id}: raised solid rim`);
    }
  });

  test('every authored water stream finishes on the water surface of its named receiving basin', () => {
    assert.ok(asset.diagnostics.waterEndpoints.length > 0);
    for (const endpoint of asset.diagnostics.waterEndpoints) {
      const holder = object(endpoint.coordinateSpace), point = holder.localToWorld(new THREE.Vector3(...endpoint.end)), target = object(endpoint.basinId);
      const hits = ray([point.x, point.y + .12, point.z], [0, -1, 0], target);
      const water = hits.find(hit => hit.object.material.userData.category === 'water');
      assert.ok(water, `${endpoint.id}: a receiving water surface must exist`);
      assert.equal(water.object.material.userData.role, 'surface', `${endpoint.id}: receiving water uses the surface material`);
      assert.ok([...resources(holder).materials].some(material => material.userData.role === 'flow'), `${endpoint.id}: its jet uses the separate flow material`);
      assert.ok(Math.abs(water.point.y - point.y) < .018, `${endpoint.id}: endpoint ${point.y} must meet water at ${water.point.y}`);
    }
  });

  test('the public update hook moves water texture details without changing the receiving geometry', () => {
    const owned = resources(asset.group), flow = [...owned.materials].find(material => material.userData.role === 'flow');
    const endpoint = JSON.stringify(asset.diagnostics.waterEndpoints), position = flow.alphaMap.offset.clone();
    asset.update(.5);
    assert.notDeepEqual(flow.alphaMap.offset, position);
    assert.equal(JSON.stringify(asset.diagnostics.waterEndpoints), endpoint);
    assert.deepEqual(new THREE.Box3().setFromObject(asset.group).min.toArray(), asset.diagnostics.bounds.min);
    asset.update(0);
  });

  test('one deer and ten sculpted hounds retain individual bodies, mouths and stone support', () => {
    const animals = object('dashuifa-eleven-animal-fountain');
    const dogs = animals.children.filter(node => node.userData.role === 'one-of-ten-hounds');
    assert.equal(dogs.length, 10); assert.equal(animals.children.filter(node => node.userData.role === 'one-deer-with-ten-hounds').length, 1);
    for (const hound of dogs) {
      const body = hound.getObjectByName(`${hound.name}-body`), mouth = hound.getObjectByName(`${hound.name}-open-mouth-spout`);
      assert.ok(body && mouth);
      assert.ok([...resources(body).materials].every(material => material.userData.category === 'copper'));
      const box = new THREE.Box3().setFromObject(body);
      assert.ok(Math.abs(box.min.y - .37) < .008, `${hound.name}: paws meet their plinth`);
      assert.ok(box.getSize(new THREE.Vector3()).y > 1.5, 'hound includes anatomical shoulders and a raised tail');
    }
    assert.ok(Math.abs(bounds('dashuifa-deer-body').min.y - .37) < .008, 'cloven deer hooves meet the central plinth');
    for (const id of ['west', 'east']) {
      const body = bounds(`guanshuifa-${id}-crane-body`), base = bounds(`guanshuifa-${id}-crane-pedestal`);
      assert.ok(Math.abs(body.min.y - base.max.y) < .008, `${id} crane has no gap above its pedestal`);
    }
    assert.ok(!asset.group.getObjectByName('zodiac-rat'), 'Dashuifa has no substituted Haiyantang zodiac figures');
  });

  test('stairs and viewing stage have solid foundations and usable first risers', () => {
    for (const contact of asset.diagnostics.contacts) {
      const target = contact.id === 'guanshuifa-stage' ? object('guanshuifa-solid-curved-stage') : object(contact.id);
      const [x, , z] = contact.point, ground = ray([x, 5, z], [0, -1, 0], contact.ground)[0];
      const underside = ray([x, -.1, z], [0, 1, 0], target)[0];
      const tread = ray([x, .40, z], [0, -1, 0], target)[0];
      assert.ok(ground && underside && tread, `${contact.id}: complete solid contact`);
      assert.ok(underside.point.y <= ground.point.y + .002, `${contact.id}: no open foundation gap`);
      assert.ok(Math.abs(tread.point.y - ground.point.y - .17) < .008, `${contact.id}: first riser is 0.17m`);
    }
  });

  test('historical uncertainty remains explicit and native visual acceptance is never inferred from triangles', () => {
    assert.equal(asset.diagnostics.visualAcceptance, false); assert.equal(asset.diagnostics.integrationAcceptance, false);
    assert.equal(asset.group.userData.visualAcceptance, false);
    assert.equal(asset.diagnostics.sourceViews.length, 4); assert.equal(asset.diagnostics.measurements.building.reportedAccuracy, .5);
    assert.ok(asset.diagnostics.inferred.some(text => text.includes('Northern building plan')));
    assert.ok(asset.diagnostics.inferred.some(text => text.includes('five') || text.includes('Five')));
    assert.ok(asset.diagnostics.sourceLimitations.some(text => text.includes('p130 depicts Fangwaiguan')));
    assert.equal(object('guanshuifa-five-screen-backdrop').userData.panelCount, 5);
  });

  test('all rendered resources are owned, disposed once, and a subsequent factory call creates independent resources', () => {
    let owned = resources(asset.group); const disposed = new Map(), previous = new Set();
    for (const set of Object.values(owned)) for (const resource of set) {
      previous.add(resource.uuid); disposed.set(resource.uuid, 0);
      const id = resource.uuid; resource.addEventListener('dispose', () => disposed.set(id, disposed.get(id) + 1));
    }
    asset.dispose(); asset.dispose();
    assert.ok([...disposed.values()].every(count => count === 1), 'every geometry, material and texture emits one dispose event');
    assert.equal(asset.group.children.length, 0);
    owned = null;
    const subsequent = createYuanyingguanStudy();
    try {
      for (const set of Object.values(resources(subsequent.group))) for (const resource of set) assert.ok(!previous.has(resource.uuid), 'factory calls do not share GPU resources');
    } finally { subsequent.dispose(); subsequent.dispose(); }
  });
});
