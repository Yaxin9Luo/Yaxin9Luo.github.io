import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const factoryModule = await import('../src/yuanmingyuan/haiyantang-study.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});

function createStudy() {
  assert.equal(typeof factoryModule?.createHaiyantangStudy, 'function', 'the independent Haiyantang asset factory must exist');
  return factoryModule.createHaiyantangStudy();
}

function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? [].concat(object.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures };
}

// Catches a facade-only asset, a collapsed rear waterworks, or incorrect axis placement.
test('west hall has depth and two storeys while I-form waterworks occupies the separate east side', () => {
  const asset = createStudy();
  try {
    assert.ok(asset.group.isGroup);
    const west = asset.group.getObjectByName('west-main-hall');
    const east = asset.group.getObjectByName('east-waterworks');
    assert.ok(west && east, 'both historical building volumes are individually addressable');
    const westBounds = new THREE.Box3().setFromObject(west);
    const eastBounds = new THREE.Box3().setFromObject(east);
    assert.ok(westBounds.getSize(new THREE.Vector3()).z > 8, 'west building must have full depth');
    assert.ok(eastBounds.max.z < westBounds.min.z, 'waterworks is a distinct building to the east');
    assert.ok(eastBounds.getSize(new THREE.Vector3()).z > 20, 'rear works must retain its longitudinal extent');
    assert.equal(west.userData.bayCount, 11);
    assert.equal(west.userData.storeys, 2);
    for (const name of ['waterworks-west-crossbar', 'waterworks-reservoir-connector', 'waterworks-east-crossbar']) assert.ok(east.getObjectByName(name), name);
    const connector = new THREE.Box3().setFromObject(east.getObjectByName('waterworks-reservoir-connector'));
    for (const name of ['waterworks-west-crossbar', 'waterworks-east-crossbar']) {
      const bar = new THREE.Box3().setFromObject(east.getObjectByName(name));
      assert.ok(bar.getSize(new THREE.Vector3()).x > connector.getSize(new THREE.Vector3()).x + 2, 'both crossbars must project beyond the I-form stem');
    }
    assert.ok(asset.diagnostics.provisionalScale.isProvisional);
    assert.equal(asset.diagnostics.sourceViews.length, 3);
    assert.ok(asset.diagnostics.inferredFeatures.length > 0);
    for (const name of ['west-stair-north', 'west-stair-south', 'giant-clam', 'zodiac-fountain-basin', 'north-small-fountain', 'south-small-fountain']) assert.ok(asset.group.getObjectByName(name), name);
  } finally { asset.dispose(); }
});

// Catches NaN custom surfaces, absent/reversed-through-zero normals, and lying geometry diagnostics.
test('every rendered vertex and normal is finite and geometry diagnostics count actual triangles', () => {
  const asset = createStudy();
  try {
    let renderedTriangles = 0;
    for (const geometry of resources(asset.group).geometries) {
      const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
      assert.ok(position?.count > 0);
      assert.equal(normal?.count, position.count);
      for (let i = 0; i < position.count; i++) {
        for (const attribute of [position, normal]) for (const component of [attribute.getX(i), attribute.getY(i), attribute.getZ(i)]) assert.ok(Number.isFinite(component), `${geometry.name}: finite vertex ${i}`);
        const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
        assert.ok(length > .9 && length < 1.1, `${geometry.name}: usable normal ${i}`);
      }
    }
    asset.group.traverse(object => {
      if (!object.isMesh) return;
      renderedTriangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    });
    assert.equal(asset.diagnostics.triangleCount, renderedTriangles);
    const bounds = new THREE.Box3().setFromObject(asset.group);
    assert.ok(!bounds.isEmpty());
    assert.ok(bounds.min.y >= -.1, 'asset has a coherent ground datum');
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(value));
    assert.deepEqual(asset.diagnostics.bounds.min, bounds.min.toArray());
    assert.deepEqual(asset.diagnostics.bounds.max, bounds.max.toArray());
    assert.ok(asset.diagnostics.subassemblies.every(part => part.meshCount > 0 && part.triangleCount > 0));
  } finally { asset.dispose(); }
});

// Catches lost/duplicated figures, bronze bodies, merged head ownership, and unsupported identity claims.
test('twelve named seated figures keep stone bodies separate from copper heads and disclose five missing originals', () => {
  const asset = createStudy();
  try {
    const expected = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'];
    const slots = asset.diagnostics.zodiacSlots;
    assert.equal(slots.length, 12);
    assert.deepEqual(slots.map(slot => slot.id).sort(), [...expected].sort());
    assert.equal(slots.filter(slot => slot.side === 'north').length, 6);
    assert.equal(slots.filter(slot => slot.side === 'south').length, 6);
    assert.deepEqual(slots.filter(slot => slot.originalHeadStatus === 'missing-inferred').map(slot => slot.id).sort(), ['dog', 'dragon', 'goat', 'rooster', 'snake']);
    for (const slot of slots) {
      const figure = asset.group.getObjectByName(`zodiac-${slot.id}`);
      assert.ok(figure, slot.id);
      const body = figure.getObjectByName(`zodiac-${slot.id}-body-stone`);
      const head = figure.getObjectByName(`zodiac-${slot.id}-head-copper`);
      assert.ok(body && head, `${slot.id}: separate editable body and head`);
      assert.ok([...resources(body).materials].every(material => material.userData.category === 'stone'));
      assert.ok([...resources(head).materials].some(material => material.userData.category === 'copper'));
      assert.ok(![...resources(head).materials].some(material => material.userData.category === 'stone'));
      assert.equal(slot.meshEvidence, 'authored-proportional-study');
      assert.equal(slot.positionEvidence, 'inferred-order');
    }
  } finally { asset.dispose(); }
});

// Catches glazing and lattice hidden behind an uncut, otherwise correct-looking wall volume.
test('visitors can see the waterworks glazing through real openings on the long and end elevations', () => {
  const asset = createStudy();
  try {
    const works = asset.group.getObjectByName('east-waterworks');
    for (const [position, direction] of [
      [[-30, 2.73, -28.43], [1, 0, 0]],
      [[30, 2.73, -28.43], [-1, 0, 0]],
      [[8.01, 2.73, -7], [0, 0, -1]],
      [[8.01, 2.73, -49], [0, 0, 1]],
    ]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(...position), new THREE.Vector3(...direction)).intersectObject(works, true);
      assert.ok(hits.length > 0, 'window has visible geometry');
      assert.ok(['glass', 'timber'].includes(hits[0].object.material.userData.category), `first surface from ${position} is ${hits[0].object.material.userData.category}, not recessed glazing`);
    }
  } finally { asset.dispose(); }
});

// Catches an inward-wound custom fluted shaft whose far side is visible through its front.
test('central freestanding column presents its outward front surface to a visitor', () => {
  const asset = createStudy();
  try {
    const columnAssembly = asset.group.getObjectByName('central-ornamental-pediment');
    const hits = new THREE.Raycaster(new THREE.Vector3(1.4, 7.0, 12), new THREE.Vector3(0, 0, -1)).intersectObject(columnAssembly, true);
    assert.ok(hits.length > 0);
    assert.ok(hits[0].point.z > 6.85, 'front face of the column must be visible before its central axis at z = 6.68');
  } finally { asset.dispose(); }
});

// Catches a generic window-sill wall continuing across the lower part of the principal door.
test('principal west door remains exposed from its threshold to the upper door panels', () => {
  const asset = createStudy();
  try {
    const hall = asset.group.getObjectByName('west-main-hall');
    for (const height of [5.38, 5.55, 7.10]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(.13, height, 12), new THREE.Vector3(0, 0, -1)).intersectObject(hall, true);
      assert.ok(hits.length > 0, `door at height ${height}`);
      assert.equal(hits[0].object.material.userData.category, 'timber', `unobstructed door panel above the threshold at ${height}`);
    }
  } finally { asset.dispose(); }
});

// Catches an air gap beneath any stair flight or landing, even when scene bounds include ground.
test('both west stair foundations physically meet the modeled paving beneath their flights and landings', () => {
  const asset = createStudy();
  try {
    const paving = asset.group.getObjectByName('study-paved-setting');
    const samples = [
      ['flight-1', 18.496, 21.60475],
      ['landing-2', 12.275, 15.45],
      ['flight-3', 9.6125, 13.5125],
      ['landing-4', 6.6, 11.315],
      ['flight-5', 4.7625, 9.715],
    ];
    for (const [name, side] of [['west-stair-north', -1], ['west-stair-south', 1]]) {
      const stair = asset.group.getObjectByName(name);
      for (const [partName, x, z] of samples) {
        const ground = new THREE.Raycaster(new THREE.Vector3(side * x, 8, z), new THREE.Vector3(0, -1, 0)).intersectObject(paving, true)[0];
        const underside = new THREE.Raycaster(new THREE.Vector3(side * x, -.1, z), new THREE.Vector3(0, 1, 0)).intersectObject(stair.getObjectByName(partName), true)[0];
        assert.ok(ground && underside, `${name}/${partName}: footing and paving must both exist at this point`);
        assert.ok(underside.point.y <= ground.point.y + .002, `${name}/${partName}: open foundation gap of ${underside.point.y - ground.point.y}`);
        assert.ok(underside.point.y >= -.002, 'footings meet the study ground datum without a concealed deep drop');
      }
    }
  } finally { asset.dispose(); }
});

// Catches an oversized first riser or a fix that lowers the existing upper stair connections.
test('west stair entry rises evenly from the pavement while upper landings keep their elevations', () => {
  const asset = createStudy();
  try {
    const paving = asset.group.getObjectByName('study-paved-setting');
    for (const [name, side] of [['west-stair-north', -1], ['west-stair-south', 1]]) {
      const stair = asset.group.getObjectByName(name), flight = stair.getObjectByName('flight-1');
      const ground = new THREE.Raycaster(new THREE.Vector3(side * 18.496, 8, 21.60475), new THREE.Vector3(0, -1, 0)).intersectObject(paving, true)[0].point.y;
      const entry = new THREE.Raycaster(new THREE.Vector3(side * 18.496, 8, 21.60475), new THREE.Vector3(0, -1, 0)).intersectObject(flight, true)[0];
      assert.ok(entry && entry.point.y - ground >= .12 && entry.point.y - ground <= .18, `${name}: first rise above paving is ${entry?.point.y - ground}`);
      const heights = [];
      // Dense visitor-centreline rays derive the actual tread sequence from the mesh.
      // The independent acceptance constraint is a 0.12–0.18 unit riser, including entry.
      for (let i = 0; i < 181; i++) {
        const t = (i + .371) / 181, one = 1 - t;
        const x = side * (one * one * 18.7 + 2 * one * t * 16.7 + t * t * 13.1);
        const z = one * one * 22 + 2 * one * t * 18 + t * t * 15.9;
        const hit = new THREE.Raycaster(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0)).intersectObject(flight, true)[0];
        assert.ok(hit, 'every point along the first flight has a usable surface');
        if (!heights.length || Math.abs(hit.point.y - heights.at(-1)) > .0001) heights.push(hit.point.y);
      }
      let previous = ground;
      for (const height of heights) {
        const rise = height - previous;
        assert.ok(rise >= .12 && rise <= .18, `${name}: unsupported entry or irregular rise ${rise}`);
        previous = height;
      }
      for (const [part, x, z, expected] of [
        ['landing-2', 12.275, 15.45, 2.125],
        ['landing-4', 6.6, 11.315, 3.685],
        ['flight-5', 3.80, 8.565, 5.105],
      ]) {
        const hit = new THREE.Raycaster(new THREE.Vector3(side * x, 8, z), new THREE.Vector3(0, -1, 0)).intersectObject(stair.getObjectByName(part), true)[0];
        assert.ok(hit && Math.abs(hit.point.y - expected) < .001, `${name}/${part}: upper landing connection was moved`);
      }
      assert.equal(stair.userData.risingFlights, 3);
      assert.equal(stair.userData.intermediateLandings, 2);
    }
  } finally { asset.dispose(); }
});

// Catches rails reduced to round wire or an arrival platform missing between the two flights.
test('the rising stone handrails have broad sections and the stairs join a continuous principal landing', () => {
  const asset = createStudy();
  try {
    for (const [name, side] of [['west-stair-north', -1], ['west-stair-south', 1]]) {
      const flight = asset.group.getObjectByName(name).getObjectByName('flight-1');
      for (const t of [.12, .73]) {
        const one = 1 - t, x = side * (one * one * 18.7 + 2 * one * t * 16.7 + t * t * 13.1), z = one * one * 22 + 2 * one * t * 18 + t * t * 15.9;
        const tangent = new THREE.Vector3(side * (2 * one * (16.7 - 18.7) + 2 * t * (13.1 - 16.7)), 0, 2 * one * (18 - 22) + 2 * t * (15.9 - 18));
        const across = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        for (const [railName, edge] of [['inner-profiled-handrail', -1], ['outer-profiled-handrail', 1]]) {
          const rail = flight.getObjectByName(railName);
          assert.ok(rail, 'each stair edge has an independently editable stone handrail');
          for (const offset of [-.14, 0, .14]) {
            const p = new THREE.Vector3(x, 8, z).addScaledVector(across, edge * 1.22 + offset);
            const hit = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0)).intersectObject(rail, true)[0];
            assert.ok(hit && hit.face.normal.y > .55, 'the rail has a broad upward-facing stone surface');
          }
        }
      }
    }
    const landing = asset.group.getObjectByName('west-principal-arrival-landing');
    assert.ok(landing, 'arrival surface must connect the upper stair ends with the central entrance');
    for (const [x, z] of [[0, 7.6], [0, 9.4], [-3.7, 8.1], [3.7, 8.1]]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0)).intersectObject(landing, true)[0];
      assert.ok(hit && Math.abs(hit.point.y - 5.105) < .001, 'the principal landing retains the existing top-tread elevation');
    }
  } finally { asset.dispose(); }
});

// A single fan surface disappears from behind and cannot read as a carved stone bowl.
test('the giant clam has a substantial closed shell with a visible front and back', () => {
  const asset = createStudy();
  try {
    const clam = asset.group.getObjectByName('giant-clam');
    for (const [x, y] of [[.32, 2.8], [-.8, 2.6], [.7, 3.1]]) {
      const front = new THREE.Raycaster(new THREE.Vector3(x, y, 15), new THREE.Vector3(0, 0, -1)).intersectObject(clam, true).find(hit => hit.object.material.userData.category === 'stone');
      const back = new THREE.Raycaster(new THREE.Vector3(x, y, 8), new THREE.Vector3(0, 0, 1)).intersectObject(clam, true).find(hit => hit.object.material.userData.category === 'stone');
      assert.ok(front && back, 'both faces of the carved shell must exist');
      assert.ok(front.point.z - back.point.z >= .14, 'shell walls need modeled thickness, not a double-sided material');
    }
  } finally { asset.dispose(); }
});

// Catches the isolated rectangular screen that left the clam composition disconnected from its shoulders.
test('the clam screen has solid grounded shoulders on both sides of its central field', () => {
  const asset = createStudy();
  try {
    const frame = asset.group.getObjectByName('shell-wall-and-central-cartouche');
    for (const x of [-4.2, 4.2]) {
      const front = new THREE.Raycaster(new THREE.Vector3(x, 2.6, 14), new THREE.Vector3(0, 0, -1)).intersectObject(frame, true)[0];
      const bottom = new THREE.Raycaster(new THREE.Vector3(x, -.1, 9.72), new THREE.Vector3(0, 1, 0)).intersectObject(frame, true)[0];
      assert.ok(front && bottom, 'the shaped shoulder has both a wall and a foundation');
      assert.ok(bottom.point.y <= .133, 'screen shoulders meet the paving datum');
      assert.equal(front.object.material.userData.category, 'stone');
    }
  } finally { asset.dispose(); }
});

// Catches shared mutable caches, missing texture disposal, double disposal, or retained scene nodes.
test('two simultaneous factories own disjoint resources and disposal releases each resource exactly once', () => {
  const a = createStudy(), b = createStudy();
  const first = resources(a.group), second = resources(b.group);
  const observed = new Map();
  for (const kind of ['geometries', 'materials', 'textures']) {
    assert.ok(first[kind].size > 0, kind);
    for (const resource of first[kind]) {
      assert.ok(!second[kind].has(resource), `independent ${kind}`);
      observed.set(resource, 0);
      resource.addEventListener('dispose', () => observed.set(resource, observed.get(resource) + 1));
    }
  }
  const otherEvents = [];
  for (const kind of ['geometries', 'materials', 'textures']) for (const resource of second[kind]) resource.addEventListener('dispose', () => otherEvents.push(resource));
  a.dispose(); a.dispose();
  assert.equal(a.group.children.length, 0);
  assert.ok([...observed.values()].every(count => count === 1));
  assert.equal(otherEvents.length, 0);
  assert.ok(b.group.children.length > 0);
  assert.ok(!new THREE.Box3().setFromObject(b.group).isEmpty());
  b.dispose();
  assert.equal(otherEvents.length, second.geometries.size + second.materials.size + second.textures.size);
});
