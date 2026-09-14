import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { zhengjuesiPlan, allZhengjuesiBuildings, zhengjuesiSources } from '../src/yuanmingyuan/zhengjuesi-layout.js';
import { zhengjuesiViews } from '../src/yuanmingyuan/zhengjuesi-study-views.js';
import { zhengjuesiArchedWallGeometry, zhengjuesiArchSurroundGeometry, zhengjuesiArchDoorGeometry, zhengjuesiOctagonalRoofGeometry, zhengjuesiOctagonalRoofPoint, zhengjuesiLatticeSegments, zhengjuesiLatheGeometry } from '../src/yuanmingyuan/zhengjuesi-geometry.js';
import { ZhengjuesiBuilder, zhengjuesiStairs, zhengjuesiPanelBay } from '../src/yuanmingyuan/zhengjuesi-architecture.js';
import { createZhengjuesiStudy, buildZhengjuesiTimberFrame } from '../src/yuanmingyuan/zhengjuesi-study.js';
import { zhengjuesiPaintworkPixels } from '../src/yuanmingyuan/zhengjuesi-materials.js';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

function finiteFaces(geometry) {
  const p = geometry.attributes.position, index = geometry.index, ids = i => index ? index.getX(i) : i;
  assert.ok(p && p.count > 0);
  for (const a of Object.values(geometry.attributes)) for (const value of a.array) assert.ok(Number.isFinite(value));
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, ids(i)), b = new THREE.Vector3().fromBufferAttribute(p, ids(i + 1)), c = new THREE.Vector3().fromBufferAttribute(p, ids(i + 2));
    assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15, `${geometry.name || geometry.type}: degenerate face ${i / 3}`);
  }
}
function ray(geometry, origin, direction) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
  try { return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(mesh); } finally { material.dispose(); }
}
function closedEdges(geometry) {
  const p = geometry.attributes.position, index = geometry.index, k = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(','), edges = new Map();
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = [0, 1, 2].map(j => k(index ? index.getX(i + j) : i + j));
    for (let j = 0; j < 3; j++) { const start = a[j], end = a[(j + 1) % 3], key = [start, end].sort().join('|'); if (!edges.has(key)) edges.set(key, []); edges.get(key).push(start < end ? 1 : -1); }
  }
  for (const [key, signs] of edges) assert.deepEqual(signs.sort(), [-1, 1], `not closed and oriented: ${key}`);
}

test('fixture: five axial historical roof forms remain separate from the modern Sansheng reconstruction', () => {
  assert.deepEqual(zhengjuesiPlan.axis.map(b => b.roof), ['xieshan', 'xieshan', 'wudian', 'double-octagonal-pyramid', 'yingshan']);
  assert.equal(zhengjuesiPlan.axis[2].modernRoof.startsWith('double-eave-xieshan'), true);
  assert.equal(zhengjuesiPlan.axis[3].dougong, false);
  assert.equal(zhengjuesiPlan.axis[4].storeys, 2);
  assert.equal(zhengjuesiPlan.surveyed, false);
  const ids = new Set(zhengjuesiSources.map(s => s.id));
  for (const b of allZhengjuesiBuildings) { assert.ok(b.sourceIds.every(id => ids.has(id))); assert.ok(b.dimensionEvidence.includes('not an archaeological')); }
});

test('fixture: flat court plan has independent north/south routes and the published room total', () => {
  const p = zhengjuesiPlan;
  assert.equal(p.boundary.divisionX - p.boundary.west, 65);
  for (let i = 1; i < p.axis.length; i++) assert.ok(p.axis[i].center[1] < p.axis[i - 1].center[1]);
  assert.equal(p.monkRooms.length, 8); assert.equal(p.monkRooms.reduce((sum, b) => sum + b.bays, 0), 22);
  assert.ok(p.monkRooms.every(b => b.center[0] > p.boundary.divisionX));
  for (const link of p.raisedLinks) assert.ok(Math.abs(link.maxZ - link.minZ - 12.9) < 1e-10);
  assert.equal(p.treeEvidence.surveyedPositions, null);
  assert.ok(zhengjuesiViews.wenshuJoinery && zhengjuesiViews.mainRear && zhengjuesiViews.gateArch);
});

test('fixture: masonry gate is watertight around a real ground-level arch, not a dark false door', () => {
  const g = zhengjuesiArchedWallGeometry();
  try {
    finiteFaces(g); closedEdges(g);
    for (const [x, y] of [[0, .10], [0, 3.35], [.9, 1.8]]) assert.equal(ray(g, [x, y, 4], [0, 0, -1]).length, 0);
    for (const [x, y] of [[0, 3.8], [1.8, 1.6], [-1.9, .1]]) assert.ok(ray(g, [x, y, 4], [0, 0, -1]).length >= 2);
    assert.throws(() => zhengjuesiArchedWallGeometry({ openings: [{ x: 0, radius: 3, spring: 2 }] }));
  } finally { g.dispose(); }
});

test('fixture: stone arch trim has an open centre and each curved leaf fits its half of the crown', () => {
  const g = zhengjuesiArchSurroundGeometry(), leaf = zhengjuesiArchDoorGeometry({ side: -1 });
  try {
    finiteFaces(g); closedEdges(g); finiteFaces(leaf); closedEdges(leaf);
    assert.equal(ray(g, [0, 3.3, 2], [0, 0, -1]).length, 0);
    assert.ok(ray(g, [0, 3.65, 2], [0, 0, -1]).length);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) { const xx = p.getX(i) - 1.4; assert.ok(p.getY(i) < 2.13 + Math.sqrt(Math.max(0, 1.4 ** 2 - xx * xx)) + 1e-5); }
  } finally { g.dispose(); leaf.dispose(); }
});

test('fixture: octagonal roof tiers close every hip but retain the lower tier central opening', () => {
  for (const topApothem of [0, 3.68]) {
    const options = { apothem: 6.35, topApothem, eaveY: 6.18, rise: 1.64, sectors: 8, courses: 12 }, g = zhengjuesiOctagonalRoofGeometry(options);
    try {
      finiteFaces(g); closedEdges(g);
      for (let face = 0; face < 8; face++) for (const t of [0, .4, .8]) assert.ok(zhengjuesiOctagonalRoofPoint(options, face, 1, t).distanceTo(zhengjuesiOctagonalRoofPoint(options, (face + 1) % 8, -1, t)) < 1e-8);
      assert.equal(ray(g, [.01, 14, .02], [0, -1, 0]).length > 0, topApothem === 0);
      assert.ok(ray(g, [0, 14, 5.8], [0, -1, 0]).length);
    } finally { g.dispose(); }
  }
});

test('fixture: diamond sash members stay inside the real aperture and provide two crossing families', () => {
  const s = zhengjuesiLatticeSegments({ width: 1.1, height: 2.1, pitch: .22 });
  assert.ok(s.length > 12); assert.equal(new Set(s.map(p => p.depthOffset)).size, 2);
  for (const segment of s) for (const [x, y] of [segment.from, segment.to]) { assert.ok(Math.abs(x) <= .55); assert.ok(y >= 0 && y <= 2.1); }
});

test('fixture: stone treads rise continuously and the cheek walls stay at the correct side', () => {
  const b = new ZhengjuesiBuilder(), root = new THREE.Group();
  try {
    zhengjuesiStairs(b, root, 'stair-fixture', { width: 3.6, edgeZ: 2.7, top: .96 }); b.flush(); root.updateMatrixWorld(true);
    const cast = (x, z) => new THREE.Raycaster(V3(x, 3, z), V3(0, -1, 0)).intersectObject(root, true)[0];
    for (let i = 0; i < 6; i++) { const z = 2.7 + (i + .5) * .34, hit = cast(0, z); assert.ok(hit); assert.ok(Math.abs(hit.point.y - (.96 - i * .16)) < .002); }
    for (const x of [-1.91, 1.91]) { const hit = cast(x, 3.5); assert.ok(hit && hit.point.y > .1 && hit.point.y < 1.1); }
    assert.equal(cast(0, -.5), undefined);
  } finally { b.dispose(); }
});

function V3(x, y, z) { return new THREE.Vector3(x, y, z); }

test('fixture: open central lattice leaves provide a usable gap while side sash is physical wood', () => {
  const b = new ZhengjuesiBuilder(), root = new THREE.Group();
  try {
    zhengjuesiPanelBay(b, root, { width: 4, height: 4.1, open: true, prefix: 'sash-fixture' }); b.flush(); root.updateMatrixWorld(true);
    for (const x of [-.65, 0, .65]) { const hits = new THREE.Raycaster(V3(x, 1.65, 2), V3(0, 0, -1)).intersectObject(root, true); assert.equal(hits.length, 0, `open central passage blocked at ${x}`); }
    assert.ok(new THREE.Raycaster(V3(1.60, .45, 2), V3(0, 0, -1)).intersectObject(root, true).length);
    for (const mesh of b.instances) for (let i = 0; i < mesh.count; i++) { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); assert.ok(m.determinant() > 0); }
  } finally { b.dispose(); }
});

test('fixture: original paintwork is reproducible and invalid components fail before construction', () => {
  const a = zhengjuesiPaintworkPixels({ width: 256, height: 48 }), c = zhengjuesiPaintworkPixels({ width: 256, height: 48 });
  assert.equal(createHash('sha256').update(a.data).digest('hex'), createHash('sha256').update(c.data).digest('hex'));
  assert.ok(new Set(Array.from(a.data).filter((_, i) => i % 4 === 0)).size > 50);
  assert.throws(() => createZhengjuesiStudy({ components: ['unknown'] }), /Unknown/);
  assert.throws(() => createZhengjuesiStudy({ components: [] }), /Unknown/);
});

test('fixture: axis fans remove the actual R1 lathe degeneracy without deleting cap area', () => {
  for (const profile of [[[0, 0], [1, 0], [1, 1], [0, 1]], [[.95, 0], [1, .10], [.6, 1.5], [0, 1.7], [0, 1.6], [.5, 1.4], [.85, 0], [.95, 0]]]) {
    const g = zhengjuesiLatheGeometry(profile, 28);
    try { finiteFaces(g); closedEdges(g); assert.ok(ray(g, [.3, 3, .25], [0, -1, 0]).length >= 2); } finally { g.dispose(); }
  }
});

test('fixture: the documented front/back portico has walkable depth before the recessed screens', () => {
  const b = new ZhengjuesiBuilder(), root = new THREE.Group(), spec = { ...zhengjuesiPlan.axis[2], id: 'portico-fixture', width: 8.8, depth: 7.2, bays: 3, depthBays: 1, columnHeight: 4.5, rearAnnex: null };
  try {
    buildZhengjuesiTimberFrame(b, root, spec); b.flush(); root.updateMatrixWorld(true);
    for (const side of [-1, 1]) for (const x of [-2.7, 2.7]) {
      const hits = new THREE.Raycaster(V3(x, spec.floor + .55, side * 3.65), V3(0, 0, -side), 0, 2.0).intersectObject(root, true);
      assert.equal(hits.length, 0, 'a sash blocks the first two metres of the gallery');
      assert.ok(new THREE.Raycaster(V3(x, spec.floor + .55, side * 3.65), V3(0, 0, -side), 0, 2.6).intersectObject(root, true).length, 'the recessed lower panel is missing');
    }
  } finally { b.dispose(); }
});

// This single production construction is intentionally behind a test name so
// the serial resource owner can run only the small fixtures until CPU is granted.
test('production: complete Zhengjuesi source asset, true supports and resource ownership', async t => {
  const started = performance.now(), before = process.memoryUsage(), report = { startedAt: new Date().toISOString(), status: 'running', before, checks: [] }; let study;
  const reportPath = process.env.ZHENGJUESI_REPORT_PATH;
  try {
    study = createZhengjuesiStudy(); report.buildMilliseconds = performance.now() - started; report.diagnostics = study.diagnostics; report.afterBuild = process.memoryUsage(); report.peakRssKiB = process.resourceUsage().maxRSS;
    const { group, resources } = study;
    const check = (name, fn) => t.test(name, () => { try { fn(); } catch (error) { report.failures ??= []; report.failures.push({ name, message: error.message }); throw error; } });
    await check('all 23 source-linked buildings and the distinct historical roof forms exist', () => {
      assert.equal(study.diagnostics.buildings.length, 23);
      for (const spec of allZhengjuesiBuildings) assert.ok(group.getObjectByName(spec.id), spec.id);
      assert.ok(group.getObjectByName('zhengjuesi-sanshengdian-single-wudian'));
      assert.equal(group.getObjectByName('zhengjuesi-wenshuting-no-dougong-frame').userData.noDougong, true);
      assert.ok(study.diagnostics.bounds.max[1] < 18 && study.diagnostics.bounds.max[1] > 12);
      report.checks.push('23 buildings and distinct historical forms');
    });
    await check('every actual stored triangle and instance transform is finite and nondegenerate', () => {
      for (const g of resources.geometries) finiteFaces(g);
      for (const mesh of resources.instances) for (let i = 0; i < mesh.count; i++) { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); assert.ok(m.elements.every(Number.isFinite)); assert.ok(m.determinant() > 0); }
      report.checks.push('all stored faces and actual instance transforms');
    });
    await check('production arch, temple axis floors, stone links and side paths have real support', () => {
      group.updateMatrixWorld(true);
      const supportGroups = []; group.traverse(n => { if (n.userData.support) supportGroups.push(n); });
      const top = (x, z, ceiling = 2) => new THREE.Raycaster(V3(x, ceiling, z), V3(0, -1, 0)).intersectObjects(supportGroups, true)[0]?.point.y;
      const probes = [[0, 92, .025], [0, 75, .48], [0, 39, .64], [0, 0, .96], [0, -20, .96], [0, -32.7, .96], [0, -45, .96], [0, -56.5, .96], [0, -71, .025], [20, -20, .025], [-20, 20, .025], [36, 0, .025]];
      for (const [x, z, expected] of probes) assert.ok(Math.abs(top(x, z) - expected) < .035, `wrong support ${x},${z}: ${top(x, z)} vs ${expected}`);
      const gate = group.getObjectByName('zhengjuesi-shanmen-vaulted-masonry');
      assert.equal(new THREE.Raycaster(V3(0, 2, 79), V3(0, 0, -1), 0, 8).intersectObject(gate, true).length, 0);
      const mainFrame = group.getObjectByName('zhengjuesi-sanshengdian-lower-timber-frame');
      for (const side of [-1, 1]) assert.equal(new THREE.Raycaster(V3(10, 1.50, side * 9.61), V3(0, 0, -side), 0, 2.0).intersectObject(mainFrame, true).length, 0, 'real main-hall portico is obstructed');
      report.checks.push('12 production floor/link/side-path probes and open stone vault');
    });
    await check('Zuishanglou second-floor opening remains a true hole with a real landing', () => {
      const g = group.getObjectByName('zhengjuesi-zuishanglou-upper-floor-and-stair'), roof = 7;
      const hole = new THREE.Raycaster(V3(12.70, roof, -56.5 + 2), V3(0, -1, 0)).intersectObject(g, true)[0];
      assert.ok(!hole || hole.point.y < 4.2, `stair void is covered by a floor: ${hole?.point.y}`);
      const deck = new THREE.Raycaster(V3(0, roof, -56.5), V3(0, -1, 0)).intersectObject(g, true)[0]; assert.ok(deck && Math.abs(deck.point.y - 5.06) < .001);
      report.checks.push('real second-floor stair void and landing');
    });
    await check('each resource belongs to this instance and is disposed exactly once', () => {
      const disposed = new Map(), snapshot = [...resources.geometries, ...resources.materials, ...resources.textures, ...resources.instances];
      for (const resource of snapshot) { disposed.set(resource, 0); resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1)); }
      study.dispose(); study.dispose();
      for (const count of disposed.values()) assert.equal(count, 1);
      assert.equal(group.children.length, 0); report.disposal = { count: snapshot.length, exactlyOnce: true, idempotent: true };
      report.checks.push('exclusive ownership and idempotent disposal');
    });
    report.status = report.failures?.length ? 'failed' : 'passed';
  } catch (error) { report.status = 'failed'; report.error = { name: error.name, message: error.message, stack: error.stack }; throw error; }
  finally { study?.dispose(); report.totalMilliseconds = performance.now() - started; report.afterDispose = process.memoryUsage(); report.peakRssKiB = process.resourceUsage().maxRSS; if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); }
});
