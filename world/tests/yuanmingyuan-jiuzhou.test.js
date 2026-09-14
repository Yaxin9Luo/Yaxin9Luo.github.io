import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { jiuzhouPlan } from '../src/yuanmingyuan/jiuzhou-layout.js';
import { jiuzhouJoinedRoofSection, jiuzhouRoofSectionPoint, joinedJuanpengStripGeometry, clayPanGeometry } from '../src/yuanmingyuan/jiuzhou-roof-geometry.js';
import { JiuzhouBuilder, buildJiuzhouJoinedRoof } from '../src/yuanmingyuan/jiuzhou-architecture.js';
import { buildJiuzhouNineHall, buildJiuzhouCornerHouse, buildJiuzhouTongdaoStage, buildJiuzhouRegularHall, buildJiuzhouConnectingSuites } from '../src/yuanmingyuan/jiuzhou-buildings.js';
import { jiuzhouZhizhaiWindow, jiuzhouLattice } from '../src/yuanmingyuan/jiuzhou-joinery.js';
import { jiuzhouLCornerRoofGeometry } from '../src/yuanmingyuan/jiuzhou-corner-roof.js';
import { buildJiuzhouRuyiBridge, jiuzhouCarvedLeafGeometry } from '../src/yuanmingyuan/jiuzhou-bridges.js';
import { createJiuzhouStudy } from '../src/yuanmingyuan/jiuzhou-study.js';
import { jiuzhouStudyViews } from '../src/yuanmingyuan/jiuzhou-study-views.js';
import { jiuzhouCoveredGallery, jiuzhouGalleryRoutes } from '../src/yuanmingyuan/jiuzhou-courtyards.js';
import { roofTileRollGeometry } from '../src/yuanmingyuan/chinese-architecture-geometry.js';
import { jiuzhouStudySections, jiuzhouFeatureSection, jiuzhouSectionSelection } from '../src/yuanmingyuan/jiuzhou-sections.js';
import { jiuzhouGalleryRoofGeometry } from '../src/yuanmingyuan/jiuzhou-gallery-roof.js';

function rays(mesh, from, direction, far = 100) {
  mesh.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...direction), 0, far).intersectObject(mesh, false);
}
const distinctHeights = hits => [...new Set(hits.map(hit => Math.round(hit.point.y * 1e5) / 1e5))];

function verticalTriangleIndex(meshes) {
  const cells = new Map(), pitch = .32, ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), target = new THREE.Vector3();
  for (const mesh of meshes) {
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index, count = index?.count ?? p.count;
    for (let i = 0; i < count; i += 3) {
      const tri = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld));
      const minX = Math.floor(Math.min(...tri.map(v => v.x)) / pitch), maxX = Math.floor(Math.max(...tri.map(v => v.x)) / pitch), minZ = Math.floor(Math.min(...tri.map(v => v.z)) / pitch), maxZ = Math.floor(Math.max(...tri.map(v => v.z)) / pitch);
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) { const key = `${x},${z}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(tri); }
    }
  }
  return (x, z) => {
    ray.origin.set(x, 30, z); let highest = null;
    for (const tri of cells.get(`${Math.floor(x / pitch)},${Math.floor(z / pitch)}`) ?? []) if (ray.intersectTriangle(...tri, false, target) && (highest === null || target.y > highest)) highest = target.y;
    return highest;
  };
}

test('Jiuzhou period and front/rear joinery preserve the dated distinctions', () => {
  assert.match(jiuzhouPlan.period, /1859–1860/);
  const data = jiuzhouPlan.measuredControls.jiuzhouHall;
  assert.deepEqual(data.baysChi, [12, 12, 13, 12, 12]);
  assert.equal(data.roofJunction.sharedPurlinZChi, -12);
  assert.equal(data.lateJoinery.frontPlaneZChi, 12);
  assert.equal(data.lateJoinery.rearAdditionPlaneZChi, -30);
  assert.equal(data.lateJoinery.frontWindowsWestToEast[0].lowerGlassPanes, 2);
  assert.equal(data.lateJoinery.frontWindowsWestToEast[2].centralGlassPanes, 1);
  assert.match(data.lateJoinery.westEndNorthWall, /retained solid wall/);
  assert.equal(jiuzhouPlan.core.length, 25);
});

test('fixture: joined central roof has one actual skin and no internal cap at its shared purlin', () => {
  const section = jiuzhouJoinedRoofSection(), geometry = joinedJuanpengStripGeometry({ section });
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  try {
    for (const x of [-5.7, -2.17, .23, 3.1, 5.7]) for (const z of [-12.61, -10.2, -6.72, -5.3, -3.841, -3.84, -3.839, -2.1, 0, 3.4, 6.91]) {
      const heights = distinctHeights(rays(mesh, [x, 20, z], [0, -1, 0]));
      assert.equal(heights.length, 2, `duplicate or missing physical roof skin at ${x},${z}`);
      assert.ok(Math.abs(heights[0] - heights[1] - .18) < .00004);
      assert.ok(Math.abs(heights[0] - jiuzhouRoofSectionPoint(section, z).y) < .003);
    }
    assert.equal(rays(mesh, [.23, section.valley.y - .09, section.valley.z - .025], [0, 0, 1], .05).length, 0, 'internal vertical sheet blocks the shared valley');
    assert.equal(rays(mesh, [.23, 3.7, -15], [0, 0, 1], 25).length, 0, 'roof skin must not seal the usable room below it');
    assert.equal(geometry.userData.incompleteWholeXieshanRoof, true);
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixture: joined roof is a closed outward volume with smooth crowns and hard outside edges', () => {
  const geometry = joinedJuanpengStripGeometry(), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), index = geometry.index;
  try {
    const edges = new Map(); let volume = 0;
    const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(c => Math.round(c * 1e5)).join(',');
    for (let i = 0; i < p.count; i++) {
      assert.ok([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .00002);
    }
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], a = new THREE.Vector3().fromBufferAttribute(p, ids[0]), b = new THREE.Vector3().fromBufferAttribute(p, ids[1]), c = new THREE.Vector3().fromBufferAttribute(p, ids[2]);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-15, 'zero-area roof face');
      volume += a.dot(b.clone().cross(c)) / 6;
      for (let j = 0; j < 3; j++) { const e = [key(ids[j]), key(ids[(j + 1) % 3])].sort().join('|'); edges.set(e, (edges.get(e) ?? 0) + 1); }
    }
    assert.ok(volume > 0, 'roof winding is inverted');
    for (const [edge, count] of edges) assert.equal(count, 2, `open or non-manifold actual triangle edge ${edge}`);
    for (const crownZ of [0, -6.72]) {
      const crownNormals = [];
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 1e-6 && Math.abs(p.getZ(i) - crownZ) < .00002 && n.getY(i) > 0) crownNormals.push(new THREE.Vector3().fromBufferAttribute(n, i));
      assert.equal(crownNormals.length, 2);
      assert.ok(crownNormals[0].dot(crownNormals[1]) > .99999);
      assert.ok(crownNormals.every(normal => normal.y > .99999));
    }
  } finally { geometry.dispose(); }
});

test('fixture: actual clay pans are concave solid tiles with smooth faces and closed clay ends', () => {
  const geometry = clayPanGeometry([new THREE.Vector3(0, 0, .55), new THREE.Vector3(0, .04, .30), new THREE.Vector3(0, .10, 0)]), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  try {
    const center = distinctHeights(rays(mesh, [0, 1, .27], [0, -1, 0])), edge = distinctHeights(rays(mesh, [.10, 1, .27], [0, -1, 0]));
    assert.equal(center.length, 2); assert.equal(edge.length, 2); assert.ok(edge[0] > center[0] + .02);
    assert.ok(Math.abs(center[0] - center[1] - .018) < .00004);
    let volume = 0;
    for (let i = 0; i < geometry.index.count; i += 3) {
      const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(i + j)));
      volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    }
    assert.ok(volume > 0);
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixture: complete joined roof shells include real side hips and correctly located northern gables', () => {
  const b = new JiuzhouBuilder('jiuzhou-fixture'), root = new THREE.Group();
  try {
    const { group, section } = buildJiuzhouJoinedRoof(b, root, 'fixture-roof', { tiles: false }); b.flush(); root.updateMatrixWorld(true);
    const surfaceGroups = group.children.filter(node => !/gable|drainage/.test(node.name)), surfaces = [];
    for (const node of surfaceGroups) node.traverse(child => { if (child.isMesh) surfaces.push(child); });
    const roofHits = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 25, z), new THREE.Vector3(0, -1, 0)).intersectObjects(surfaces, false);
    for (const x of [-10.8, -8.3, -7.1, -5.919, .23, 5.921, 7.1, 8.3, 10.8]) for (const z of [-6.8, -4.4, -2.1, .17, 2.1, 4.4, 6.8]) assert.ok(roofHits(x, z).length, `uncovered main roof at ${x},${z}`);
    for (const z of [-12.6, -10, -7.1, -5.2]) assert.ok(roofHits(.23, z).length);
    for (const side of [-1, 1]) {
      const gable = root.getObjectByName(`fixture-roof-rear-xuanshan-gable-${side}`), bounds = new THREE.Box3().setFromObject(gable);
      assert.ok(bounds.max.z < section.valley.z + .11, 'asymmetric rear gable was reflected toward the front');
      assert.ok(bounds.min.z < -12.7);
      for (const mesh of gable.children.filter(node => node.isMesh)) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld), hits = roofHits(v.x, v.z);
          assert.ok(hits.length && v.y < hits[0].point.y - .12, `rear gable emerges through the roof at ${v.toArray()}`);
        }
      }
    }
    assert.equal(root.getObjectByName('fixture-roof-common-purlin-central-roof-individual-tiles'), undefined, 'this fixture must remain a small shell check');
  } finally { b.dispose(); root.clear(); }
});

test('fixture: window wood is pierced but the documented false window retains its masonry backing', () => {
  const b = new JiuzhouBuilder('jiuzhou-window-fixture'), root = new THREE.Group();
  try {
    const pierced = new THREE.Group(); root.add(pierced); jiuzhouLattice(b, pierced, 'pierced-fixture', { width: 1.12, height: 1.52, y: 1.4, lining: null });
    const retained = jiuzhouZhizhaiWindow(b, root, 'retained-wall-fixture', { width: 3.27, falseWindow: true }); retained.position.x = 5;
    b.flush(); root.updateMatrixWorld(true);
    let gaps = 0, wood = 0;
    for (let x = -.45; x < .48; x += .047) for (let y = .78; y < 2.03; y += .057) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      if (ray.intersectObject(pierced, true).length) wood++; else gaps++;
    }
    assert.ok(gaps > 180 && wood > 30, `openings=${gaps}, wood=${wood}`);
    for (const x of [3.55, 4.13, 4.69, 5.23, 5.91, 6.44]) for (const y of [1.0, 1.61, 2.4, 3.51, 4.12]) assert.ok(new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1), 0, 2).intersectObject(retained, true).some(h => h.object.material === b.m.brick), `false window became an opening at ${x},${y}`);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: the complete Nine Hall frame and real doors fit below the joined roof', () => {
  const b = new JiuzhouBuilder('jiuzhou-hall-fixture'), root = new THREE.Group();
  try {
    const hall = buildJiuzhouNineHall(b, root, { tiles: false }); hall.position.set(0, 0, 0); root.updateMatrixWorld(true);
    const roof = root.getObjectByName('jiuzhou-qingyan-hall-roof'), surfaces = [];
    roof.traverse(node => { if (node.isMesh && !/gable|bargeboard|drainage/.test(node.name)) surfaces.push(node); });
    const roofHit = verticalTriangleIndex(surfaces);
    const rafters = root.getObjectByName('jiuzhou-qingyan-hall-curved-rafters'); let checked = 0;
    rafters.traverse(mesh => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position;
      // Every actual rafter vertex, including its cap, must stay below the
      // skin. The independent ray uses the generated roof, not heightAt().
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld), hit = roofHit(v.x, v.z);
        assert.ok(hit !== null && v.y <= hit - .155, `rafter above cover: ${v.toArray()} versus ${hit}`); checked++;
      }
    });
    assert.ok(checked > 20000);
    for (const x of [-.48, 0, .48]) for (const y of [1.20, 2.20, 3.10]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(x, y, 5.0), new THREE.Vector3(0, 0, -1), 0, 11).intersectObject(hall, true);
      assert.equal(hit.length, 0, `front central door/interior obstructed at ${x},${y}: ${hit[0]?.object.name}`);
    }
    for (const y of [1.30, 2.4]) assert.ok(new THREE.Raycaster(new THREE.Vector3(.38, y, -10.3), new THREE.Vector3(0, 0, 1), 0, 1).intersectObject(hall, true).length, 'rear central window was replaced by an invented door');
    const shared = []; root.traverse(node => { if (node.userData.body === 'round-longitudinal-roof-purlin' && Math.abs(node.userData.z + 3.84) < .000001) shared.push(node); });
    assert.equal(shared.length, 1, 'main and rear frames must share one actual purlin');
    const glass = []; root.traverse(mesh => { if (mesh.isMesh && mesh.material === b.m.glass) glass.push(mesh); });
    assert.ok(glass.length >= 6);
    const panes = glass.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 6, 0); assert.equal(panes, 13);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: corner house has one continuous closed L roof and a genuine open courtyard corner', () => {
  const geometry = jiuzhouLCornerRoofGeometry(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  try {
    for (const [x, z] of [[-3.5, -5.7], [-1.6, -4.48], [3.6, -4.48], [-1.6, 5.8], [.5, .3], [1.39, -1.6]]) {
      const hits = distinctHeights(rays(mesh, [x, 20, z], [0, -1, 0])); assert.equal(hits.length, 2, `${x},${z} has duplicate/missing skin`); assert.ok(Math.abs(hits[0] - hits[1] - .18) < .00003);
    }
    for (const [x, z] of [[2.0, 0], [3.1, 3.1], [4.4, 6.2]]) assert.equal(rays(mesh, [x, 20, z], [0, -1, 0]).length, 0, 'the L plan courtyard was filled by an overlapping rectangle');
    const p = geometry.attributes.position, index = geometry.index, edges = new Map(); let volume = 0;
    const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], a = new THREE.Vector3().fromBufferAttribute(p, ids[0]), c = new THREE.Vector3().fromBufferAttribute(p, ids[1]), d = new THREE.Vector3().fromBufferAttribute(p, ids[2]);
      assert.ok(c.clone().sub(a).cross(d.clone().sub(a)).lengthSq() > 1e-16); volume += a.dot(c.clone().cross(d)) / 6;
      for (let j = 0; j < 3; j++) { const edge = [key(ids[j]), key(ids[(j + 1) % 3])].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1); }
    }
    assert.ok(volume > 0); for (const count of edges.values()) assert.equal(count, 2);
  } finally { geometry.dispose(); material.dispose(); }
});

test('fixture: corner-house upper floor keeps a real stairwell and both flights meet their landing', () => {
  const b = new JiuzhouBuilder('jiuzhou-corner-fixture'), root = new THREE.Group();
  try {
    const house = buildJiuzhouCornerHouse(b, root, { tiles: false }); house.position.set(0, 0, 0); root.updateMatrixWorld(true);
    const floor = root.getObjectByName('jiuzhou-west-corner-house-upper-floor-with-actual-stair-opening'), stairs = root.getObjectByName('jiuzhou-west-corner-house-two-flight-stair');
    for (const [x, z] of [[-2.45, 2.2], [-2.45, 4.8], [-.75, 3.4]]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0), 0, 1.2).intersectObject(floor, true).length, 0);
    for (const [x, z] of [[-2.45, .8], [-.75, 6.1], [2.2, -4.0]]) assert.ok(new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0), 0, 1.2).intersectObject(floor, true).length);
    for (let i = 0; i < 11; i++) for (const second of [false, true]) {
      const z = second ? 1.98 + (i + .5) * 3.62 / 11 : 5.60 - (i + .5) * 3.62 / 11, x = second ? -.75 : -2.45, expected = .54 + (second ? 1.78 : 0) + 1.78 * (i + 1) / 11;
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0)).intersectObject(stairs, true); assert.ok(hits.length); assert.ok(Math.abs(hits[0].point.y - expected) < .00001);
    }
    const landing = new THREE.Raycaster(new THREE.Vector3(-1.6, 5, 1.55), new THREE.Vector3(0, -1, 0)).intersectObject(stairs, true); assert.ok(Math.abs(landing[0].point.y - 2.32) < .00001);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: Ruyi planks have the documented span and thickness, bearing stone and a clear walking lane', () => {
  const b = new JiuzhouBuilder('jiuzhou-ruyi-fixture'), root = new THREE.Group();
  try {
    const bridge = buildJiuzhouRuyiBridge(b, root); bridge.position.set(0, 0, 0); root.updateMatrixWorld(true);
    const deck = root.getObjectByName('jiuzhou-ruyi-removable-wood-deck'), beams = root.getObjectByName('jiuzhou-ruyi-long-stone-beams'), bounds = new THREE.Box3().setFromObject(deck);
    assert.ok(Math.abs(bounds.min.z + 2.72) < .00001 && Math.abs(bounds.max.z - 2.72) < .00001);
    const mats = new Set(); deck.traverse(node => { if (node.isMesh) mats.add(node.material); }); for (const m of mats) m.side = THREE.DoubleSide;
    for (let i = 0; i < 15; i++) {
      const x = -2.16 + (i + .5) * 4.32 / 15;
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, .28), new THREE.Vector3(0, -1, 0)).intersectObject(deck, true), ys = distinctHeights(hits);
      assert.ok(Math.abs(ys[0] - .34) < .00001 && Math.abs(ys.at(-1) - .244) < .00001);
      for (const z of [-2.64, 2.64]) {
        const support = new THREE.Raycaster(new THREE.Vector3(x, .26, z), new THREE.Vector3(0, -1, 0), 0, .15).intersectObject(beams, true); assert.ok(support.length && Math.abs(support[0].point.y - .244) < .00001);
      }
    }
    for (const x of [-1.75, -.65, .65, 1.75]) for (const y of [.84, 1.60, 2.1]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, y, -7.4), new THREE.Vector3(0, 0, 1), 0, 14.8).intersectObject(bridge, true).length, 0);
    const rails = root.getObjectByName('jiuzhou-ruyi-carved-wood-rail-1'); let openings = 0, solid = 0;
    for (let z = -6.2; z < 6.3; z += .18) for (let y = .68; y < 1.15; y += .058) {
      const hits = new THREE.Raycaster(new THREE.Vector3(3, y, z), new THREE.Vector3(-1, 0, 0), 0, 1.4).intersectObject(rails, true); if (hits.length) solid++; else openings++;
    }
    assert.ok(openings > 100 && solid > 100, `carved rail open=${openings}, solid=${solid}`);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: theatre is north-facing with the measured open front and a real double-eave opening', () => {
  const b = new JiuzhouBuilder('jiuzhou-stage-fixture'), root = new THREE.Group();
  try {
    const stage = buildJiuzhouTongdaoStage(b, root, { tiles: false }); assert.equal(stage.rotation.y, Math.PI); stage.position.set(0, 0, 0); stage.rotation.y = 0; root.updateMatrixWorld(true);
    for (const x of [-1.7, 0, 1.7]) for (const y of [1.2, 2.1, 3.7]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1), 0, 6.9).intersectObject(stage, true).length, 0);
    const lower = root.getObjectByName('jiuzhou-tongdao-stage-lower-eave-roof');
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0)).intersectObject(lower, true).length, 0, 'double-eave lower roof must leave the upper drum open');
    for (const x of [-4.2, 4.2]) assert.ok(new THREE.Raycaster(new THREE.Vector3(x, 20, .3), new THREE.Vector3(0, -1, 0)).intersectObject(lower, true).length);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: bridge foliage has positive carved volume and finite normals', () => {
  const geometry = jiuzhouCarvedLeafGeometry(), p = geometry.attributes.position, n = geometry.attributes.normal;
  try {
    let volume = 0;
    for (let i = 0; i < p.count; i++) assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .00001);
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), c = new THREE.Vector3().fromBufferAttribute(p, i + 1), d = new THREE.Vector3().fromBufferAttribute(p, i + 2); volume += a.dot(c.clone().cross(d)) / 6;
    }
    assert.ok(volume > .00008); assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z > .055);
  } finally { geometry.dispose(); }
});

test('fixture: gallery corner posts leave both legs and the actual turning landing open', () => {
  const b = new JiuzhouBuilder('jiuzhou-turn-fixture'), root = new THREE.Group();
  try {
    jiuzhouCoveredGallery(b, root, 'turn-fixture', [[-9.80, 26.50], [-14.40, 26.50], [-14.40, 19.46]], { floorStart: .72, floorEnd: .78, tiles: false }); root.updateMatrixWorld(true);
    for (const offset of [-.39, 0, .39]) {
      for (const y of [1.2, 2.13, 2.62]) {
        assert.equal(new THREE.Raycaster(new THREE.Vector3(-10.64, y, 26.50 + offset), new THREE.Vector3(-1, 0, 0), 0, 3.76).intersectObject(root, true).length, 0);
        assert.equal(new THREE.Raycaster(new THREE.Vector3(-14.40 + offset, y, 26.50), new THREE.Vector3(0, 0, -1), 0, 6.20).intersectObject(root, true).length, 0);
      }
    }
    for (const x of [-14.79, -14.4, -14.01]) for (const z of [26.11, 26.5, 26.89]) {
      const support = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true); assert.ok(support.length && support[0].point.y >= .72);
    }
  } finally { b.dispose(); root.clear(); }
});

test('fixture: tile instances retain the source triangles, positions, normals and owned disposal', () => {
  const b = new JiuzhouBuilder('jiuzhou-instance-fixture'), root = new THREE.Group(), points = [[0, 0, .52], [0, .03, .40], [0, .07, .27], [0, .12, .14], [0, .18, 0]].map(v => new THREE.Vector3(...v));
  const reference = roofTileRollGeometry(points, .081, .023, 24), batches = [];
  try {
    for (let batch = 0; batch < 2; batch++) {
      const group = new THREE.Group(); root.add(group); batches.push(group);
      for (let i = 0; i < 6; i++) b.instanceTile(group, points.map(p => p.clone().add(new THREE.Vector3(i * .5, batch, 0))), batch ? b.m.tileShade : b.m.greyTile, 'cover');
    }
    b.flush(); root.updateMatrixWorld(true);
    const meshes = batches.map(group => group.children[0]); assert.ok(meshes.every(m => m.isInstancedMesh && m.count === 6)); assert.equal(meshes[0].geometry, meshes[1].geometry); assert.notEqual(meshes[0].material, meshes[1].material);
    for (const [batch, mesh] of meshes.entries()) {
      assert.equal(mesh.geometry.index.count, reference.index.count);
      for (let instance = 0; instance < 6; instance++) {
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(instance, matrix);
        for (let index = 0; index < reference.index.count; index++) {
          const vertex = reference.index.getX(index), actual = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, mesh.geometry.index.getX(index)).applyMatrix4(matrix), expected = new THREE.Vector3().fromBufferAttribute(reference.attributes.position, vertex).add(new THREE.Vector3(instance * .5, batch, 0));
          assert.ok(actual.distanceTo(expected) < .000002, 'instancing changed an actual clay triangle');
          const normal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, vertex), expectedNormal = new THREE.Vector3().fromBufferAttribute(reference.attributes.normal, vertex); assert.ok(normal.distanceTo(expectedNormal) < .000001);
        }
        const hit = new THREE.Raycaster(new THREE.Vector3(instance * .5 + .025, 2 + batch, .24), new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false); assert.ok(hit.some(h => h.instanceId === instance));
      }
    }
    const different = new THREE.Group(); root.add(different);
    for (let i = 0; i < 3; i++) b.instanceTile(different, points.map(p => p.clone().multiply(new THREE.Vector3(1, 1.5, 1)).add(new THREE.Vector3(i * .5, 0, 0))), b.m.greyTile, 'cover');
    b.flush(); assert.notEqual(different.children[0].geometry, meshes[0].geometry, 'unlike tile curvature must retain its own real geometry');
    const events = { geometry: 0, instances: 0 }; meshes[0].geometry.addEventListener('dispose', () => events.geometry++); for (const mesh of meshes) mesh.addEventListener('dispose', () => events.instances++);
    b.dispose(); assert.deepEqual(events, { geometry: 1, instances: 2 }); b.dispose(); assert.deepEqual(events, { geometry: 1, instances: 2 });
  } finally { b.dispose(); root.clear(); reference.dispose(); }
});

test('fixture: section boundaries assign all core buildings and galleries once without construction', () => {
  const counts = Object.fromEntries(Object.keys(jiuzhouStudySections).map(id => [id, 0]));
  for (const spec of jiuzhouPlan.core) counts[jiuzhouFeatureSection('routes', spec.route)]++;
  assert.deepEqual(counts, { central: 7, western: 8, eastern: 10, waterfront: 0 });
  for (const [id] of jiuzhouGalleryRoutes) assert.equal(Object.values(jiuzhouStudySections).filter(s => s.galleries.includes(id)).length, 1);
  assert.throws(() => jiuzhouSectionSelection([])); assert.throws(() => jiuzhouSectionSelection(['missing']));
});

test('fixture: each gallery route keeps its real walking legs open after the corner repair', () => {
  const obstructions = [];
  for (const [id, points, floorStart, floorEnd, options] of jiuzhouGalleryRoutes) {
    const b = new JiuzhouBuilder('jiuzhou-gallery-fixture'), root = new THREE.Group();
    try {
      jiuzhouCoveredGallery(b, root, `jiuzhou-gallery-${id}`, points, { floorStart, floorEnd, tiles: false, ...options, neighbourPaths: jiuzhouGalleryRoutes.filter(route => route[0] !== id).map(route => route[1]) }); root.updateMatrixWorld(true);
      for (const walk of b.walkways) {
        const dx = walk.to[0] - walk.from[0], dz = walk.to[1] - walk.from[1], length = Math.hypot(dx, dz); if (length < 2.1) continue;
        const direction = new THREE.Vector3(dx / length, 0, dz / length), side = new THREE.Vector3(-dz / length, 0, dx / length);
        for (const offset of [-.39, 0, .39]) {
          const origin = new THREE.Vector3(walk.from[0], Math.max(floorStart, floorEnd) + 1.35, walk.from[1]).addScaledVector(direction, .84).addScaledVector(side, offset);
          const hits = new THREE.Raycaster(origin, direction, 0, length - 1.68).intersectObject(root, true); if (hits.length) obstructions.push(`${walk.id}, ${offset}: ${hits[0].object.name}`);
        }
      }
    } finally { b.dispose(); root.clear(); }
  }
  assert.deepEqual(obstructions, [], obstructions.join('\n'));
});

test('fixture: bent gallery roofs have one closed skin and cover their outer corner supports', () => {
  for (const path of [[[-9.8, 26.5], [-14.4, 26.5], [-14.4, 19.46]], [[-9.76, -44.16], [-15.70, -44.16], [-16.80, -42.24]]]) {
    const { geometry } = jiuzhouGalleryRoofGeometry(path), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
    try {
      const p = geometry.attributes.position, n = geometry.attributes.normal, index = geometry.index, edges = new Map(); let volume = 0;
      const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
      for (let i = 0; i < p.count; i++) assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .00001, `invalid gallery normal at ${i}`);
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], a = new THREE.Vector3().fromBufferAttribute(p, ids[0]), c = new THREE.Vector3().fromBufferAttribute(p, ids[1]), d = new THREE.Vector3().fromBufferAttribute(p, ids[2]);
        assert.ok(c.clone().sub(a).cross(d.clone().sub(a)).lengthSq() > 1e-16, 'collapsed gallery roof triangle'); volume += a.dot(c.clone().cross(d)) / 6;
        for (let j = 0; j < 3; j++) { const edge = [key(ids[j]), key(ids[(j + 1) % 3])].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1); }
      }
      assert.ok(volume > 0); for (const [edge, uses] of edges) assert.equal(uses, 2, `unclosed/non-manifold gallery seam ${edge}`);
      const corner = path[1];
      for (const [dx, dz] of [[.3, -.3], [.9, -.4], [.2, -.9], [-.7, .6]]) {
        const heights = distinctHeights(rays(mesh, [corner[0] + dx, 10, corner[1] + dz], [0, -1, 0])); assert.equal(heights.length, 2); assert.ok(Math.abs(heights[0] - heights[1] - .18) < .00002);
      }
    } finally { geometry.dispose(); material.dispose(); }
  }
});

test('fixture: connected suites and both gallery T-junctions remain open through the actual neighbouring walls', () => {
  const cases = [
    { halls: ['jiuzhou-qingyan-hall', 'jiuzhou-tongdaotang', 'jiuzhou-qinghuitang'], suites: true, galleries: [] },
    { halls: ['jiuzhou-tongdaotang'], galleries: ['shende-east', 'shende-to-tongdao'] },
    { halls: ['jiuzhou-middle-east-rear'], galleries: ['central-rear-east', 'inner-east-middle-north-link'] },
  ], obstructions = [];
  for (const scenario of cases) {
    const b = new JiuzhouBuilder('jiuzhou-connections-fixture'), root = new THREE.Group();
    try {
      for (const id of scenario.halls) if (id === 'jiuzhou-qingyan-hall') buildJiuzhouNineHall(b, root, { tiles: false }); else buildJiuzhouRegularHall(b, root, jiuzhouPlan.core.find(s => s.id === id), { tiles: false });
      if (scenario.suites) buildJiuzhouConnectingSuites(b, root);
      for (const [id, points, floorStart, floorEnd, options] of jiuzhouGalleryRoutes) if (scenario.galleries.includes(id)) jiuzhouCoveredGallery(b, root, `jiuzhou-gallery-${id}`, points, { floorStart, floorEnd, tiles: false, ...options, neighbourPaths: jiuzhouGalleryRoutes.filter(route => route[0] !== id).map(route => route[1]) });
      b.flush(); root.updateMatrixWorld(true);
      for (const walk of b.walkways) {
        const dx = walk.to[0] - walk.from[0], dz = walk.to[1] - walk.from[1], length = Math.hypot(dx, dz), trim = length < 2.1 ? .11 : .84, direction = new THREE.Vector3(dx / length, 0, dz / length), side = new THREE.Vector3(-dz / length, 0, dx / length);
        for (const offset of [-.39, 0, .39]) for (const rise of [1.05, 1.95]) {
          const start = new THREE.Vector3(walk.from[0], Math.max(walk.floorStart, walk.floorEnd) + rise, walk.from[1]).addScaledVector(direction, trim).addScaledVector(side, offset), hits = new THREE.Raycaster(start, direction, 0, length - trim * 2).intersectObject(root, true);
          if (hits.length) obstructions.push(`${walk.id},${offset},${rise}: ${hits[0].object.name} at ${hits[0].point.toArray()}`);
        }
      }
      if (scenario.galleries.includes('inner-east-middle-north-link')) for (const x of [14.51, 14.88, 15.25]) {
        const roof = new THREE.Raycaster(new THREE.Vector3(x, 12, -32.65), new THREE.Vector3(0, -1, 0)).intersectObject(root, true); assert.ok(roof.length && roof[0].point.y > 3.9, 'short link lost actual neighbouring eave coverage');
      }
    } finally { b.dispose(); root.clear(); }
  }
  assert.deepEqual(obstructions, [], obstructions.join('\n'));
});

test('full Jiuzhou factory: complete core, actual circulation, roofs and owned resource disposal', async t => {
  const startedAt = new Date().toISOString(), started = performance.now(); let asset, buildMilliseconds;
  const record = { startedAt, node: process.version, platform: process.platform, architecture: process.arch, threeRevision: THREE.REVISION, buildMilliseconds: null, checks: [], stats: null, disposal: null, visualAcceptance: false, note: 'Only the test-process exit status establishes whether all CPU checks passed. No browser/GPU rendering is performed here.' };
  const output = new URL('../../work/yuanmingyuan/jiuzhou-validation/r1-factory-stats.json', import.meta.url);
  const check = async (name, run) => t.test(name, () => { try { run(); record.checks.push({ name, passed: true }); } catch (error) { record.checks.push({ name, passed: false, message: error.message }); throw error; } });
  try {
    const before = performance.now(); asset = createJiuzhouStudy(); buildMilliseconds = performance.now() - before; record.buildMilliseconds = buildMilliseconds; record.stats = asset.diagnostics;
    const root = asset.group; root.updateMatrixWorld(true);
    await check('twenty-five buildings preserve distinct three-route forms and period exclusions', () => {
      assert.equal(asset.diagnostics.buildings.length, 25);
      const ids = new Set(asset.diagnostics.buildings.map(b => b.id)); assert.equal(ids.size, 25);
      for (const spec of jiuzhouPlan.core) assert.ok(root.getObjectByName(spec.id));
      assert.equal(root.getObjectByName('jiuzhou-tongdao-stage').rotation.y, Math.PI);
      assert.equal(root.getObjectByName('jiuzhou-tiandi-west-wing').rotation.y, Math.PI / 2);
      assert.equal(root.getObjectByName('jiuzhou-tiandi-east-wing').rotation.y, -Math.PI / 2);
      assert.ok(root.getObjectByName('jiuzhou-shendetang-roof-continuous-roof'));
      assert.ok(root.getObjectByName('jiuzhou-west-corner-house-L-roof'));
      assert.ok(root.getObjectByName('jiuzhou-fengsanwusi-late-three-bay-flat-wing-1'));
      assert.ok(root.getObjectByName('jiuzhou-qingyan-hall-1859-flat-side-room--1'));
      assert.equal(root.position.length(), 0); assert.deepEqual(asset.diagnostics.placement.globalAnchor, [-550, 4, 169.4]);
      assert.equal(asset.diagnostics.visualAcceptance, false);
    });
    await check('central hall doors and their actual interiors remain clear', () => {
      for (const [id, zFront, distance, floor] of [['jiuzhou-yuanmingyuan-hall', 4.70, 9.4, .72], ['jiuzhou-fengsanwusi', 5.10, 10.20, .78], ['jiuzhou-qingyan-hall', 5.10, 12.7, .704]]) {
        const hall = root.getObjectByName(id), origin = new THREE.Vector3(); hall.getWorldPosition(origin);
        for (const x of [-.48, 0, .48]) for (const rise of [1.05, 1.95]) {
          const hits = new THREE.Raycaster(new THREE.Vector3(origin.x + x, floor + rise, origin.z + zFront), new THREE.Vector3(0, 0, -1), 0, distance).intersectObject(hall, true);
          assert.equal(hits.length, 0, `${id} passage intersects ${hits[0]?.object.name}`);
        }
      }
    });
    await check('covered gallery centres have actual headroom across the composed scene', () => {
      let tested = 0; const obstructions = [];
      for (const walk of asset.diagnostics.walkways.filter(w => w.roofed)) {
        const dx = walk.to[0] - walk.from[0], dz = walk.to[1] - walk.from[1], length = Math.hypot(dx, dz); if (length < 2.1) continue;
        const direction = new THREE.Vector3(dx / length, 0, dz / length), side = new THREE.Vector3(-dz / length, 0, dx / length), y = Math.max(walk.floorStart, walk.floorEnd) + 1.35;
        for (const offset of [-.39, 0, .39]) {
          const origin = new THREE.Vector3(walk.from[0], y, walk.from[1]).addScaledVector(direction, .84).addScaledVector(side, offset);
          const hit = new THREE.Raycaster(origin, direction, 0, length - 1.68).intersectObject(root, true);
          if (hit.length) obstructions.push(`${walk.id}, offset ${offset}: ${hit[0]?.object.name} at ${hit[0]?.point.toArray()}`); tested++;
        }
      }
      assert.ok(tested >= 40); assert.deepEqual(obstructions, [], obstructions.join('\n'));
    });
    await check('three-route courts and the narrow northern landing have real supporting surfaces', () => {
      for (const [x, z, expected] of [[.25, 10.31, .0545], [.22, -25.21, .0545], [-43.80, -3.21, .0545], [-71.29, -6.31, .0545], [57.62, 7.31, .0545], [57.60, -30.05, .4505]]) {
        const hits = new THREE.Raycaster(new THREE.Vector3(x, .90, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true);
        assert.ok(hits.length && Math.abs(hits[0].point.y - expected) < .011, `support at ${x},${z}: ${hits[0]?.point.y}`);
      }
      const quay = root.getObjectByName('jiuzhou-shore-and-island-support'); assert.ok(new THREE.Box3().setFromObject(quay).min.y < -2, 'quay base must reach below the garden-layout water datum');
      assert.ok(new THREE.Box3().setFromObject(root.getObjectByName('jiuzhou-ruyi-stone-abutments')).min.y < -2);
    });
    await check('production has individual clay courses, shared purlin and no beasts on rounded crowns', () => {
      const mainTiles = root.getObjectByName('jiuzhou-qingyan-hall-roof-common-purlin-central-roof-individual-tiles');
      assert.ok(mainTiles?.children.some(n => n.isMesh)); assert.equal(mainTiles.userData.curvedCoverSamples, 24);
      const shared = []; root.traverse(node => { if (node.userData.body === 'round-longitudinal-roof-purlin' && node.name.startsWith('jiuzhou-qingyan-hall') && Math.abs(node.userData.z + 3.84) < .000001) shared.push(node); }); assert.equal(shared.length, 1);
      const rounded = root.getObjectByName('jiuzhou-qingyan-hall-roof'); rounded.traverse(node => assert.doesNotMatch(node.name, /ridge-end|ridge-beast/));
      const caps = root.getObjectByName('jiuzhou-west-corner-house-L-roof-individual-clay-tiles'); assert.ok(caps?.children.some(n => n.isMesh));
    });
    await check('all Studio targets resolve and every mesh has finite vertices, normals and UVs', () => {
      for (const [id, view] of Object.entries(jiuzhouStudyViews)) for (const name of [...view.groups, ...(view.isolate ?? [])]) assert.ok(root.getObjectByName(name), `${id} references absent ${name}`);
      let count = 0;
      root.traverse(mesh => {
        if (!mesh.isMesh) return; count++; assert.ok(mesh.matrixWorld.determinant() > 0, mesh.name);
        const p = mesh.geometry.attributes.position.array, n = mesh.geometry.attributes.normal.array, uv = mesh.geometry.attributes.uv?.array; assert.ok(uv, mesh.name);
        for (let i = 0; i < p.length; i += 3) {
          const normal = n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2];
          if (!Number.isFinite(p[i] + p[i + 1] + p[i + 2]) || !Number.isFinite(normal) || normal < .90 || normal > 1.10) assert.fail(`${mesh.name} invalid vertex/normal ${i / 3}: ${normal}`);
        }
        for (const value of uv) if (!Number.isFinite(value)) assert.fail(`${mesh.name} has a nonfinite UV`);
      }); assert.equal(count, asset.diagnostics.meshCount);
    });
    await check('each unique geometry, material and texture is released exactly once', () => {
      const owned = { geometries: new Set(), materials: new Set(), textures: new Set(), instanceMeshes: new Set() }, events = { geometries: 0, materials: 0, textures: 0, instanceMeshes: 0 };
      root.traverse(mesh => { if (!mesh.isMesh) return; owned.geometries.add(mesh.geometry); if (mesh.isInstancedMesh) owned.instanceMeshes.add(mesh); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { owned.materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) owned.textures.add(value); } });
      for (const [key, resources] of Object.entries(owned)) { assert.equal(resources.size, asset.diagnostics.resourceOwnership[key]); for (const resource of resources) resource.addEventListener('dispose', () => events[key]++); }
      asset.dispose(); for (const [key, resources] of Object.entries(owned)) assert.equal(events[key], resources.size);
      assert.equal(root.children.length, 0); const before = { ...events }; asset.dispose(); assert.deepEqual(events, before);
      record.disposal = { expected: Object.fromEntries(Object.entries(owned).map(([k, v]) => [k, v.size])), events: { ...events }, remainingRootChildren: root.children.length, repeatedDisposeNewEvents: 0, gpuDisposalMeasured: false };
    });
  } catch (error) { record.constructionFailure = { name: error.name, message: error.message, stack: error.stack }; throw error; }
  finally {
    asset?.dispose(); record.elapsedMilliseconds = performance.now() - started; record.processResourceUsageRaw = process.resourceUsage(); record.processMemoryUsage = process.memoryUsage(); record.finishedAt = new Date().toISOString();
    fs.mkdirSync(new URL('../../work/yuanmingyuan/jiuzhou-validation/', import.meta.url), { recursive: true }); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
  }
});
