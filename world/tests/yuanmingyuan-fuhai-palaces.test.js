import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chineseHipPoint, chineseHipRafterPath, chineseHipRoofGeometry, chineseGableRoofGeometry, chineseCrossEaveGeometry, chineseCrossGableGeometry, ridgeBeastGeometry, pyramidalFinialGeometry, roofTileRollGeometry, bracketArmGeometry, bridgeDeckGeometry, quarriedMasonryBlockGeometry, clipPavingCell } from '../src/yuanmingyuan/chinese-architecture-geometry.js';
import { createFanghuStudy, createPengdaoStudy } from '../src/yuanmingyuan/fuhai-palaces.js';
import { createFuhaiCaihuaTexture } from '../src/yuanmingyuan/fuhai-paintwork.js';
import { gardenLayout, getGardenGroup, transformAssetPoint } from '../src/yuanmingyuan/garden-layout.js';
import { extrudedPolygon } from '../src/yuanmingyuan/study-geometry.js';

const V = values => new THREE.Vector3(...values);
function ray(object, origin, direction, far = Infinity) { object.updateMatrixWorld(true); return new THREE.Raycaster(V(origin), V(direction), 0, far).intersectObject(object, true); }
function fixture(geometry, run) {
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  try { run(mesh); } finally { geometry.dispose(); material.dispose(); }
}
function finiteGeometry(geometry) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)), `finite position ${i}`);
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); assert.ok(length > .95 && length < 1.05, `unit normal ${i}: ${length}`);
  }
}
function closedEdges(geometry) {
  const positions = geometry.getAttribute('position'), index = geometry.index, counts = new Map();
  const vertex = i => { const k = index ? index.getX(i) : i; return [positions.getX(k), positions.getY(k), positions.getZ(k)].map(v => Math.round(v * 1e5)).join(','); };
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) for (let e = 0; e < 3; e++) {
    const a = vertex(i + e), b = vertex(i + (e + 1) % 3), key = a < b ? `${a}|${b}` : `${b}|${a}`; counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const nonmanifold = [...counts].filter(([, count]) => count !== 2); assert.equal(nonmanifold.length, 0, JSON.stringify(nonmanifold.slice(0, 3)));
}

test('fixture: hipped roof shells close their seams and their upper tier leaves a real opening', () => {
  fixture(chineseHipRoofGeometry({ width: 12, depth: 8, eaveY: 4, rise: 3, thickness: .18 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    for (const [x, z] of [[0, 0], [1, 1], [-3, -2], [5, .1]]) {
      const top = ray(mesh, [x, 12, z], [0, -1, 0])[0], bottom = ray(mesh, [x, 0, z], [0, 1, 0])[0];
      assert.ok(top && bottom); assert.ok(top.face.normal.y > 0 && bottom.face.normal.y < 0);
      assert.ok(Math.abs(top.point.y - bottom.point.y - .18) < .001);
    }
    const middle = ray(mesh, [0, 12, 3.95], [0, -1, 0])[0], corner = ray(mesh, [5.9, 12, 3.95], [0, -1, 0])[0];
    assert.ok(corner.point.y - middle.point.y > .20, 'corners rise above the middle of the eave');
  });
  fixture(chineseHipRoofGeometry({ width: 12, depth: 8, topWidth: 7, topDepth: 4, eaveY: 4, rise: 1.6, thickness: .18 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    assert.equal(ray(mesh, [0, 12, 0], [0, -1, 0]).length, 0, 'lower roof does not cap the upper-storey opening');
    assert.ok(ray(mesh, [0, 12, 3], [0, -1, 0]).length);
  });
});

test('fixture: gabled roof and individual barrel tiles have usable normals and closed material', () => {
  fixture(chineseGableRoofGeometry({ width: 9, depth: 4, eaveY: 4, rise: 2, thickness: .18 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    assert.ok(ray(mesh, [0, 10, 0], [0, -1, 0])[0].point.y > 5.99);
    assert.ok(ray(mesh, [-4.49, 0, .5], [0, 1, 0])[0].face.normal.y < 0);
  });
  fixture(roofTileRollGeometry([[0, 0, 0], [0, .1, -.3], [0, .2, -.6]], .09, .022, 6), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    const top = ray(mesh, [0, 1, -.3], [0, -1, 0])[0]; assert.ok(top && top.point.y > .18, 'barrel projects above its bedding');
    assert.ok(ray(mesh, [0, -.1, -.3], [0, 1, 0]).length, 'barrel has an underside');
  });
  fixture(bracketArmGeometry(), mesh => { finiteGeometry(mesh.geometry); assert.ok(ray(mesh, [0, 1, 0], [0, -1, 0]).length); });
});

test('fixture: bridge deck has uninterrupted top and underside across its crown', () => {
  fixture(bridgeDeckGeometry([-5, -2], [7, 3], 2.8, .50, .34), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    let peak = 0;
    for (let i = 0; i <= 20; i++) {
      const t = .01 + .98 * i / 20, x = -5 + 12 * t, z = -2 + 5 * t;
      const top = ray(mesh, [x, 3, z], [0, -1, 0])[0], bottom = ray(mesh, [x, -2, z], [0, 1, 0])[0];
      assert.ok(top && bottom); assert.ok(top.face.normal.y > .9 && bottom.face.normal.y < -.9); assert.ok(top.point.y - bottom.point.y > .29); peak = Math.max(peak, top.point.y);
    }
    assert.ok(peak > .83 && peak < .85);
  });
});

test('fixture: cross-plan eaves preserve their cut corners and cross gables have one closed roof surface', () => {
  fixture(chineseCrossEaveGeometry({ width: 14, armWidth: 8, topWidth: 9.4, topArmWidth: 5.8, eaveY: 4, rise: 1.4 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    assert.equal(ray(mesh, [0, 12, 0], [0, -1, 0]).length, 0, 'lower cross eaves retain a true central opening');
    assert.equal(ray(mesh, [5, 12, 5], [0, -1, 0]).length, 0, 'cross-plan cut corner is not filled by a square shell');
    const top = ray(mesh, [0, 12, 5.4], [0, -1, 0])[0], bottom = ray(mesh, [0, 0, 5.4], [0, 1, 0])[0];
    assert.ok(top && bottom && Math.abs(top.point.y - bottom.point.y - .17) < .001);
  });
  fixture(chineseCrossGableGeometry({ width: 8.2, armWidth: 4.4, eaveY: 6, rise: 2.1 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    for (const [x, z] of [[0, 0], [4.0, 0], [-4.0, 0], [0, 4.0], [0, -4.0]]) {
      const hit = ray(mesh, [x, 12, z], [0, -1, 0])[0]; assert.ok(hit && Math.abs(hit.point.y - 8.1) < .001, 'four ridges meet at the same crest');
    }
    assert.equal(ray(mesh, [2.5, 12, 2.5], [0, -1, 0]).length, 0);
    const valley = ray(mesh, [1.2, 12, 1.2], [0, -1, 0])[0], slope = ray(mesh, [1.1, 12, 1.2], [0, -1, 0])[0];
    assert.ok(valley && slope && valley.point.y < slope.point.y, 'roof wings meet in a real valley');
  });
});

test('fixture: authored paintwork is opaque, coloured and independently disposable', () => {
  const first = createFuhaiCaihuaTexture(), second = createFuhaiCaihuaTexture();
  try {
    assert.notEqual(first, second); assert.notEqual(first.image.data, second.image.data); assert.deepEqual(first.image.data, second.image.data);
    assert.equal(first.colorSpace, THREE.SRGBColorSpace); assert.equal(first.userData.historicImage, false);
    let blue = 0, gold = 0, green = 0;
    for (let i = 0; i < first.image.data.length; i += 4) {
      const [r, g, b, a] = first.image.data.subarray(i, i + 4); assert.equal(a, 255);
      if (b > r * 1.6) blue++; if (r > 150 && r > b * 1.4) gold++; if (g > r * 1.7 && g > b * 1.1) green++;
    }
    assert.ok(blue > 10000 && green > 10000 && gold > 10000, 'mineral ground and fine gold design both occupy real texels');
    let disposals = 0; first.addEventListener('dispose', () => disposals++); first.dispose(); assert.equal(disposals, 1); assert.ok(second.image.data.length > 0);
  } finally { second.dispose(); }
});

test('fixture: clay tiles have smoothly varying arc normals and separate hard end caps', () => {
  fixture(roofTileRollGeometry([[0, 0, 0], [0, 0, -.31], [0, 0, -.62]], .10, .02), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal;
    let outerSamples = 0, capSamples = 0, capWithDifferentNormal = false;
    for (let i = 0; i < p.count; i++) {
      const radius = Math.hypot(p.getX(i), p.getY(i)), normal = V([n.getX(i), n.getY(i), n.getZ(i)]);
      if (Math.abs(p.getZ(i) + .31) < 1e-6 && Math.abs(radius - .10) < 1e-6 && p.getY(i) > .001) {
        const radial = V([p.getX(i), p.getY(i), 0]).normalize();
        assert.ok(normal.dot(radial) > .998, 'barrel surface normal follows the circular clay section'); outerSamples++;
      }
      if (Math.abs(p.getZ(i)) < 1e-6 && p.getY(i) > .02 && normal.z > .999) {
        capSamples++;
        for (let j = 0; j < p.count; j++) if (i !== j && Math.hypot(p.getX(i) - p.getX(j), p.getY(i) - p.getY(j), p.getZ(i) - p.getZ(j)) < 1e-7 && Math.abs(n.getZ(j)) < .01) capWithDifferentNormal = true;
      }
    }
    assert.ok(outerSamples >= 18, 'the actual half circle has enough curved samples for close inspection');
    assert.ok(capSamples > 8 && capWithDifferentNormal, 'tile-end face keeps its own hard normal at the clay lip');
    assert.ok(ray(mesh, [0, 1, -.31], [0, -1, 0])[0].point.y > .0999);
  });
});

test('fixture: ridge beasts have rounded depth and an open mouth; pyramidal finials seal their bases', () => {
  fixture(ridgeBeastGeometry(), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    const span = (x, y) => {
      const front = ray(mesh, [x, y, 2], [0, 0, -1])[0], back = ray(mesh, [x, y, -2], [0, 0, 1])[0];
      assert.ok(front && back); return front.point.z - back.point.z;
    };
    const head = span(-.25, .45), tail = span(.24, 1.20);
    assert.ok(head > .48 && head > tail * 2, 'head and tail have independently modelled rounded depth');
    assert.equal(ray(mesh, [-.60, .285, 2], [0, 0, -1]).length, 0, 'the mouth has a real opening between the jaws');
    assert.ok(span(-.60, .425) > .24 && span(-.60, .185) > .22, 'upper and lower jaws remain solid');
  });
  fixture(pyramidalFinialGeometry(), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    const top = ray(mesh, [0, 2, 0], [0, -1, 0])[0], bottom = ray(mesh, [0, -.4, 0], [0, 1, 0])[0];
    assert.ok(top && bottom && top.point.y > 1.17 && bottom.point.y < -.05);
    for (const y of [.08, .35, .81]) {
      const x = ray(mesh, [2, y, 0], [-1, 0, 0])[0], z = ray(mesh, [0, y, 2], [0, 0, -1])[0];
      assert.ok(x && z && Math.abs(x.point.x - z.point.z) < 1e-5, 'finial is a full rotational volume');
    }
  });
  fixture(chineseHipRoofGeometry({ width: 11, depth: 11, topWidth: 0, topDepth: 0, eaveY: 6, rise: 3 }), mesh => {
    finiteGeometry(mesh.geometry); closedEdges(mesh.geometry);
    const heights = [[.3, 0], [-.3, 0], [0, .3], [0, -.3]].map(([x, z]) => ray(mesh, [x, 12, z], [0, -1, 0])[0].point.y);
    assert.ok(Math.max(...heights) - Math.min(...heights) < 1e-5, 'four roof slopes converge symmetrically to the apex');
    assert.ok(ray(mesh, [0, 12, 0], [0, -1, 0])[0].point.y > 8.99);
  });
});

test('fixture: circular roof rafters remain beneath steep solid roof slopes', () => {
  const shapes = [
    { width: 13.6, depth: 13.6, topWidth: 9.384, topDepth: 9.384, eaveY: 6, rise: 2.08, cornerLift: .36, thickness: .17 },
    { width: 10.884, depth: 10.884, topWidth: 0, topDepth: 0, eaveY: 8.81, rise: 3, cornerLift: .24, thickness: .17 },
  ];
  for (const options of shapes) fixture(chineseHipRoofGeometry(options), roof => {
    const penetrations = geometry => {
      const p = geometry.getAttribute('position'); let checked = 0, exposed = 0;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), surface = ray(roof, [x, 20, z], [0, -1, 0])[0];
        if (!surface) continue; checked++; if (y > surface.point.y - .002) exposed++;
      }
      assert.ok(checked > 50); return exposed;
    };
    if (options.topDepth) {
      const formerPath = Array.from({ length: 13 }, (_, i) => { const p = chineseHipPoint(options, 0, .40, i / 12); p.y -= .20; return p; });
      const former = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(formerPath), 20, .13, 7, false);
      try { assert.ok(penetrations(former) > 0, 'ray casts reproduce the former red-rafter penetration'); } finally { former.dispose(); }
    }
    for (let face = 0; face < 4; face++) for (const u of [-.78, 0, .78]) {
      const path = chineseHipRafterPath(options, face, u);
      const parts = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 36, .13, 10, false),
        ...[path[0], path.at(-1)].map(p => new THREE.SphereGeometry(.13, 8, 6).translate(p.x, p.y, p.z))];
      const timber = mergeGeometries(parts);
      try {
        finiteGeometry(timber); assert.equal(penetrations(timber), 0, 'timber and rounded end caps stay below all actual roof faces');
      } finally { timber.dispose(); for (const geometry of parts) geometry.dispose(); }
    }
  });
});

test('fixture: quay stones are closed rough-faced blocks and paving keeps real joints', () => {
  fixture(quarriedMasonryBlockGeometry(4), stone => {
    finiteGeometry(stone.geometry); closedEdges(stone.geometry);
    for (const [origin, direction] of [[[2, .15, .1], [-1, 0, 0]], [[-2, .15, .1], [1, 0, 0]], [[.1, 2, .15], [0, -1, 0]], [[.1, -2, .15], [0, 1, 0]], [[.1, .15, 2], [0, 0, -1]], [[.1, .15, -2], [0, 0, 1]]]) assert.ok(ray(stone, origin, direction).length);
    for (const x of [-.38, 0, .38]) for (const y of [-.38, 0, .38]) assert.ok(ray(stone, [x, y, 2], [0, 0, -1]).length, 'broad stone face retains square corners rather than a ball silhouette');
  });
  const outline = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  const clipped = clipPavingCell(outline, .5, 3, .5, 3);
  fixture(extrudedPolygon(clipped, .337, .366), paving => {
    closedEdges(paving.geometry); finiteGeometry(paving.geometry);
    for (const [x, z] of [[.7, .7], [.7, 2.5], [2.5, .7]]) assert.ok(ray(paving, [x, 2, z], [0, -1, 0]).length);
    assert.equal(ray(paving, [2, 2, 2], [0, -1, 0]).length, 0, 'the missing island corner remains water');
  });
  fixture(extrudedPolygon(clipPavingCell([[0, 0], [2, 0], [2, 2], [0, 2]], .014, 1.986, .014, 1.186), .337, .366), paving => {
    assert.equal(ray(paving, [1, 2, 1.199], [0, -1, 0]).length, 0, 'horizontal slab joint is an actual gap');
    assert.ok(ray(paving, [1, 2, 1.17], [0, -1, 0]).length);
  });
});

function object(asset, name) { const found = asset.group.getObjectByName(name); assert.ok(found, name); return found; }
function raftersAreCovered(asset, roofName) {
  const roof = object(asset, `${roofName}-shell`), rafters = object(asset, `${roofName}-curved-timber-rafters`); let checked = 0;
  rafters.updateMatrixWorld(true);
  rafters.traverse(node => {
    if (!node.isMesh) return; const positions = node.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 37) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      const top = ray(roof, [p.x, 45, p.z], [0, -1, 0])[0]; if (!top) continue;
      checked++; assert.ok(p.y < top.point.y, `${roofName}: timber at ${p.toArray()} emerges above its roof`);
    }
  });
  assert.ok(checked > 100, `${roofName}: sampled actual production timber`);
}
function resources(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const material of node.material ? [].concat(node.material) : []) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
  return { geometries, materials, textures };
}
function verticalSpan(target, x, z) {
  const upper = ray(target, [x, 50, z], [0, -1, 0])[0], lower = ray(target, [x, -4, z], [0, 1, 0])[0];
  assert.ok(upper && lower, `${target.name}: closed section at ${x}, ${z}`); return [lower.point.y, upper.point.y];
}
function integrity(asset) {
  const owned = resources(asset.group); let meshes = 0, triangles = 0;
  asset.group.traverse(node => {
    if (!node.isMesh) return; meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    assert.ok(node.matrixWorld.determinant() > 0, node.name); finiteGeometry(node.geometry);
  });
  assert.equal(asset.diagnostics.meshCount, meshes); assert.equal(asset.diagnostics.triangleCount, triangles);
  assert.equal(asset.diagnostics.resourceOwnership.geometries, owned.geometries.size); assert.equal(asset.diagnostics.resourceOwnership.materials, owned.materials.size); assert.equal(asset.diagnostics.resourceOwnership.textures, owned.textures.size);
  assert.ok(meshes < 1100, 'small ornaments are batched into their architectural parents');
  const bounds = new THREE.Box3().setFromObject(asset.group); assert.deepEqual(asset.diagnostics.bounds.min, bounds.min.toArray()); assert.deepEqual(asset.diagnostics.bounds.max, bounds.max.toArray());
  assert.equal(asset.diagnostics.visualAcceptance, false); assert.equal(asset.diagnostics.integrationAcceptance, false); assert.equal(asset.diagnostics.measurements.noSurveyedBuildingDimensions, true);
  assert.deepEqual(asset.diagnostics.placement.globalAnchor, getGardenGroup(asset.diagnostics.assetId).position);
  assert.ok(asset.diagnostics.sources.some(source => source.type === 'historic-painting-catalogue'));
  assert.ok([...owned.materials].some(material => material.userData.category === 'painted-wood'));
  assert.ok([...owned.materials].some(material => material.userData.category === 'timber'));
  assert.ok(![...owned.materials].some(material => material.userData.category === 'water'), 'lake surface and bed remain terrain-owned');
  return owned;
}
function disposeOnce(asset, owned) {
  let disposed = 0; for (const set of Object.values(owned)) for (const resource of set) resource.addEventListener('dispose', () => disposed++);
  const expected = Object.values(owned).reduce((total, set) => total + set.size, 0);
  asset.dispose(); assert.equal(disposed, expected); assert.equal(asset.group.children.length, 0); asset.dispose(); assert.equal(disposed, expected);
}

test('full Fuhai factories: evidence, roof bearings, doors, bridges and disposable resources', async t => {
  let fanghu, pengdao; const evidence = {};
  try {
    const start = performance.now(); fanghu = createFanghuStudy(); evidence.fanghu = { buildMs: performance.now() - start, ...fanghu.diagnostics };
    await t.test('Fanghu has nine rear halls, three front pavilions and connected ascending courts', () => {
      assert.equal(fanghu.diagnostics.buildings.filter(building => building.role === 'one-of-nine-halls').length, 9);
      assert.equal(fanghu.diagnostics.buildings.filter(building => building.role === 'one-of-three-water-pavilions').length, 3);
      const base = object(fanghu, 'fanghu-shan-shaped-white-stone-terraces');
      for (const [x, z] of [[0, 55], [-33, 40], [33, 40]]) assert.ok(ray(base, [x, 2.0, z], [0, -1, 0]).length, 'all three pavilion foundations reach the stone promontories');
      for (const [x, z] of [[16, 38], [-16, 38], [20, 57], [-20, 57]]) assert.equal(ray(base, [x, 2, z], [0, -1, 0]).length, 0, 'water remains between the three arms');
      for (const [x, z, y] of [[0, 29, 1.8], [15.6, 3, 2.4], [15.6, -25, 3.0]]) {
        const hit = ray(fanghu.group, [x, y + .10, z], [0, -1, 0])[0]; assert.ok(hit && Math.abs(hit.point.y - y) < .05);
      }
      for (const name of ['fanghu-row-1-central-hall', 'fanghu-row-2-central-hall', 'fanghu-row-3-central-hall']) {
        const hall = object(fanghu, name), p = hall.getWorldPosition(new THREE.Vector3());
        for (const x of [-.45, 0, .45]) assert.equal(ray(hall, [p.x + x, p.y + 1.7, p.z + 12], [0, 0, -1], 24).length, 0, 'central hall doors are real through-openings');
      }
    });
    await t.test('Fanghu pavilion lower and upper roof shells overlap their bearing drums', () => {
      for (const suffix of ['central', 'west', 'east']) {
        const name = `fanghu-front-${suffix}-pavilion`, pavilion = object(fanghu, name), p = pavilion.getWorldPosition(new THREE.Vector3());
        const lower = object(fanghu, `${name}-lower-roof`), options = lower.userData.dimensions;
        for (const [dx, dz] of [[options.topWidth / 2 + .08, 0], [-options.topWidth / 2 - .08, 0], [0, options.topDepth / 2 + .08], [0, -options.topDepth / 2 - .08]]) {
          const lo = verticalSpan(object(fanghu, `${name}-lower-roof-shell`), p.x + dx, p.z + dz), hi = verticalSpan(object(fanghu, `${name}-upper-roof-shell`), p.x + dx, p.z + dz), bearing = verticalSpan(object(fanghu, `${name}-roof-bearing-drum`), p.x + dx, p.z + dz);
          assert.ok(bearing[0] <= lo[1] && bearing[1] >= lo[0], `${name}: drum meets lower roof`); assert.ok(bearing[0] <= hi[1] && bearing[1] >= hi[0], `${name}: drum meets upper roof`);
        }
        assert.equal(ray(object(fanghu, `${name}-lower-roof-shell`), [p.x, 40, p.z], [0, -1, 0]).length, 0);
        assert.ok(ray(object(fanghu, `${name}-upper-roof-shell`), [p.x, 40, p.z], [0, -1, 0]).length, 'upper roof closes the centre');
      }
    });
    await t.test('Fanghu differentiates the central square pavilion from two enclosed cross-plan pavilions', () => {
      assert.equal(object(fanghu, 'fanghu-front-central-pavilion').userData.historicalName, '迎薰亭');
      assert.ok(object(fanghu, 'fanghu-front-central-pavilion-inner-enclosure'));
      for (const side of ['west', 'east']) {
        const name = `fanghu-front-${side}-pavilion`, pavilion = object(fanghu, name), p = pavilion.getWorldPosition(new THREE.Vector3()), plinth = object(fanghu, `${name}-plinth`);
        assert.equal(pavilion.userData.body, 'cross-plan-enclosed-water-pavilion');
        assert.equal(ray(plinth, [p.x + 5.5, p.y + 1, p.z + 5.5], [0, -1, 0]).length, 0, 'cross-plan corners remain cut out in the actual plinth');
        for (const x of [-.45, 0, .45]) assert.equal(ray(pavilion, [p.x + x, p.y + 2, p.z + 9], [0, 0, -1], 18).length, 0, 'enclosing the side pavilions preserves their through doors');
        const gables = object(fanghu, `${name}-upper-roof-four-painted-gables`); assert.equal(gables.children.filter(child => child.userData.body === 'painted-timber-gable-infill').length, 4);
      }
      const materials = [...resources(object(fanghu, 'fanghu-row-1-central-hall')).materials];
      assert.ok(materials.some(material => material.name.includes('paintwork') && material.map?.userData.historicImage === false));
      assert.ok(materials.some(material => material.userData.category === 'paper'), 'lining gives selected windows depth while doorways stay open');
    });
    await t.test('Fanghu pyramidal roof converges to one supported solid finial', () => {
      const name = 'fanghu-front-central-pavilion', pavilion = object(fanghu, name), p = pavilion.getWorldPosition(new THREE.Vector3());
      const shell = object(fanghu, `${name}-upper-roof-shell`), finial = object(fanghu, `${name}-upper-roof-glazed-ridges-and-eaves-pyramidal-finial`);
      const roofHeights = [[.3, 0], [-.3, 0], [0, .3], [0, -.3]].map(([dx, dz]) => ray(shell, [p.x + dx, 40, p.z + dz], [0, -1, 0])[0].point.y);
      assert.ok(Math.max(...roofHeights) - Math.min(...roofHeights) < 1e-4, 'production roof slopes meet at the same point without a short straight ridge');
      const apex = ray(shell, [p.x, 40, p.z], [0, -1, 0])[0], base = ray(finial, [p.x, p.y, p.z], [0, 1, 0])[0], top = ray(finial, [p.x, 40, p.z], [0, -1, 0])[0];
      assert.ok(apex && base && top && base.point.y < apex.point.y && top.point.y > apex.point.y + 1, 'solid finial overlaps the real roof apex');
      const bounds = new THREE.Box3().setFromObject(finial), size = bounds.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.x - size.z) < 1e-4 && size.y > size.x, 'single finial is a rounded vertical body');
      let ridgeBeasts = 0; object(fanghu, `${name}-upper-roof`).traverse(node => { if (node.userData.body === 'rounded-glazed-ridge-end-beast') ridgeBeasts++; });
      assert.equal(ridgeBeasts, 0, 'a pyramidal apex does not receive two ridge-end beasts');
    });
    await t.test('Fanghu central pavilion rafters stay below both real roof tiers', () => {
      for (const tier of ['lower', 'upper']) raftersAreCovered(fanghu, `fanghu-front-central-pavilion-${tier}-roof`);
    });
    const firstResources = integrity(fanghu), firstObjects = Object.fromEntries(Object.entries(firstResources).map(([key, set]) => [key, new WeakSet(set)]));
    disposeOnce(fanghu, firstResources); for (const set of Object.values(firstResources)) set.clear(); fanghu = null;
    const secondStart = performance.now(); pengdao = createPengdaoStudy(); evidence.pengdao = { buildMs: performance.now() - secondStart, ...pengdao.diagnostics };
    await t.test('Pengdao gate has sixteen loft brackets, crossed upper windows and an open north-south passage', () => {
      const gate = object(pengdao, 'pengdao-jingzhongge');
      for (let face = 1; face <= 4; face++) {
        const elevation = object(pengdao, `pengdao-jingzhongge-loft-loft-dougong-face-${face}`);
        assert.equal(elevation.children.filter(child => child.userData.body === 'tiered-solid-dougong').length, 4);
      }
      const loftRoof = object(pengdao, 'pengdao-jingzhongge-loft-xieshan'), bounds = new THREE.Box3().setFromObject(loftRoof); assert.ok(bounds.max.y > 11 && bounds.min.y < 9);
      for (const x of [-.40, 0, .40]) {
        assert.equal(ray(gate, [x, 2.0, 22], [0, 0, -1], 13).length, 0, 'gate centre is open');
        assert.equal(ray(object(pengdao, 'pengdao-main-island-courtyard'), [x, 2.0, 20.2], [0, 0, -1], 34).length, 0, 'gate, five-bay baosha and seven-bay hall align without an opaque centre wall');
      }
      assert.equal(pengdao.diagnostics.buildings.find(building => building.role === 'seven-bay-main-hall').bays, 7);
      assert.equal(pengdao.diagnostics.buildings.find(building => building.role === 'five-bay-front-baosha').bays, 5);
      const roof = object(pengdao, 'pengdao-seven-bay-two-juan-hall-roof'); assert.equal(roof.children.filter(child => child.userData.body === 'one-of-two-joined-roof-volumes').length, 2);
    });
    await t.test('Pengdao loft floor has a timber bearing above the lower gate frame', () => {
      const gate = object(pengdao, 'pengdao-jingzhongge'), p = gate.getWorldPosition(new THREE.Vector3());
      for (const x of [-2.1, 2.1]) for (const z of [-1.75, 1.75]) {
        const support = ray(gate, [p.x + x, p.y + 4.70, p.z + z], [0, 1, 0])[0];
        assert.ok(support && support.point.y < p.y + 5.0, 'a transfer bearing reaches the lower framing instead of leaving the loft floor floating above it');
        const post = verticalSpan(object(pengdao, 'pengdao-jingzhongge-loft-transfer-frame'), p.x + x, p.z + z), floor = verticalSpan(object(pengdao, 'pengdao-jingzhongge-loft-floor'), p.x + x, p.z + z);
        assert.ok(post[1] >= floor[0] && post[0] <= floor[1], 'short post intersects the actual loft floor');
      }
      for (const x of [-2.1, 2.1]) for (const z of [-3, 3]) {
        const beam = verticalSpan(object(pengdao, 'pengdao-jingzhongge-loft-transfer-frame'), p.x + x, p.z + z), frame = verticalSpan(object(pengdao, 'pengdao-jingzhongge-gate-frame-columns-and-beams'), p.x + x, p.z + z);
        assert.ok(beam[0] <= frame[1] && beam[1] >= frame[0], 'transfer beam bears on the gate frame');
      }
    });
    await t.test('Pengdao gate and east pavilion rafters stay below their real roof slopes', () => {
      raftersAreCovered(pengdao, 'pengdao-jingzhongge-gate-eaves');
      for (const tier of ['lower', 'upper']) raftersAreCovered(pengdao, `pengdao-yinghai-xianshan-pavilion-${tier}-roof`);
    });
    await t.test('Pengdao shoreline uses coursed blocks and its stone paving has backed open joints', () => {
      for (const id of ['pengdao-main', 'pengdao-west', 'pengdao-east']) {
        assert.equal(object(pengdao, `${id}-rock-facing`).userData.body, 'staggered-courses-of-quarried-shoreline-blocks');
        assert.ok(object(pengdao, `${id}-jointed-stone-paving`).children.length > 0);
      }
      const anchor = getGardenGroup('pengdao-yaotai').position, west = gardenLayout.islands.find(island => island.id === 'pengdao-west').anchor;
      const wx = west[0] - anchor[0], wz = west[2] - anchor[2], island = object(pengdao, 'pengdao-west'); let slabs = 0, backedJoints = 0;
      for (let i = 0; i <= 400; i++) {
        const hit = ray(island, [wx - 4 + i * .02, 2, wz + 3.17], [0, -1, 0])[0]; assert.ok(hit, 'each paving joint has masonry beneath it');
        if (Math.abs(hit.point.y - .366) < .001) slabs++;
        else if (Math.abs(hit.point.y - .34) < .001) backedJoints++;
      }
      assert.ok(slabs > 350 && backedJoints >= 3, 'independent ray sweep sees raised slabs and multiple recessed joints');
    });
    await t.test('Pengdao bridges align with the layout, span real gaps and land on supported stone', () => {
      const anchor = getGardenGroup('pengdao-yaotai'), foundation = object(pengdao, 'pengdao-three-island-foundations');
      assert.equal(foundation.children.filter(child => child.userData.body === 'rock-faced-island-quay-foundation').length, 3);
      for (const island of foundation.children.filter(child => child.userData.body === 'rock-faced-island-quay-foundation')) assert.deepEqual(island.userData.globalAnchor, gardenLayout.islands.find(record => record.id === island.name).anchor);
      for (const check of pengdao.diagnostics.walkways) {
        const bridge = object(pengdao, check.id), layout = gardenLayout.bridges.find(bridge => bridge.id === check.id), deck = object(pengdao, `${check.id}-solid-deck`);
        const from = transformAssetPoint(anchor, [check.from[0], check.deckY, check.from[1]]), to = transformAssetPoint(anchor, [check.to[0], check.deckY, check.to[1]]);
        for (let i = 0; i < 3; i++) { assert.ok(Math.abs(from[i] - layout.from[i]) < 1e-8); assert.ok(Math.abs(to[i] - layout.to[i]) < 1e-8); }
        for (let i = 1; i < 24; i++) {
          const t = i / 24, x = THREE.MathUtils.lerp(check.from[0], check.to[0], t), z = THREE.MathUtils.lerp(check.from[1], check.to[1], t);
          const hit = ray(deck, [x, 2, z], [0, -1, 0])[0]; assert.ok(hit && hit.face.normal.y > .9, 'continuous walkable deck');
        }
        const center = [(check.from[0] + check.to[0]) / 2, (check.from[1] + check.to[1]) / 2];
        assert.equal(ray(foundation, [center[0], 2, center[1]], [0, -1, 0]).length, 0, 'bridge crosses open lake between the separate islands');
        for (const [index, p] of [check.from, check.to].entries()) {
          const stone = ray(foundation, [p[0], .8, p[1]], [0, -1, 0])[0]; assert.ok(stone, `${check.id}: endpoint lies on its island`);
          // Probe inside the bearing area: a vertical ray at the exact boundary
          // of a sloping end cap need not intersect the deck's underside.
          const t = index === 0 ? .015 : .985, x = THREE.MathUtils.lerp(check.from[0], check.to[0], t), z = THREE.MathUtils.lerp(check.from[1], check.to[1], t);
          const deckSpan = verticalSpan(deck, x, z), bearing = verticalSpan(object(pengdao, `${check.id}-stone-abutments`), x, z);
          assert.ok(bearing[1] >= deckSpan[0] && bearing[0] <= stone.point.y, 'abutment joins deck and island');
        }
        const a = V([check.from[0], 1.75, check.from[1]]), c = V([check.to[0], 1.75, check.to[1]]), d = c.clone().sub(a), across = new THREE.Vector3(-d.z, 0, d.x).normalize();
        for (const offset of [-.78, 0, .78]) assert.equal(new THREE.Raycaster(a.clone().addScaledVector(across, offset), d.clone().normalize(), .2, d.length() - .2).intersectObject(bridge, true).length, 0, 'railings leave a usable passage');
      }
    });
    const secondResources = integrity(pengdao);
    for (const key of Object.keys(firstObjects)) for (const resource of secondResources[key]) assert.ok(!firstObjects[key].has(resource), 'factories do not share disposable resources');
    disposeOnce(pengdao, secondResources); pengdao = null;
    t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(evidence).map(([id, data]) => [id, { buildMs: data.buildMs, meshCount: data.meshCount, triangleCount: data.triangleCount, bounds: data.bounds, resourceOwnership: data.resourceOwnership }]))));
  } finally { fanghu?.dispose(); pengdao?.dispose(); }
});
