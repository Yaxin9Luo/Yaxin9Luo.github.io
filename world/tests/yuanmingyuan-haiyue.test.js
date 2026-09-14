import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HaiyueBuilder, haiyuePanelBay, haiyueTimberStair } from '../src/yuanmingyuan/haiyue-architecture.js';
import { haiyueTileRun } from '../src/yuanmingyuan/haiyue-roofs.js';
import { createHaiyueStudy } from '../src/yuanmingyuan/haiyue-study.js';
import { haiyuePaintworkPixels } from '../src/yuanmingyuan/haiyue-materials.js';
import { haiyueLayout, haiyuePeriod } from '../src/yuanmingyuan/haiyue-layout.js';
import { haiyueViews } from '../src/yuanmingyuan/haiyue-study-views.js';
import { haiyueArcBlockGeometry, haiyueLatheGeometry, haiyueFloorGeometry, haiyueCrossSkirtGeometry, haiyueCrossSkirtPoint, haiyueStairTreads, haiyueLatticeSegments } from '../src/yuanmingyuan/haiyue-geometry.js';

function checkSolid(g) {
  const p = g.attributes.position, index = g.index, ids = i => index ? index.getX(i) : i, edges = new Map(); let volume = 0;
  for (const attr of Object.values(g.attributes)) for (const value of attr.array) assert.ok(Number.isFinite(value));
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e5)).join(',');
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, ids(i + j))), [a, b, c] = vertices;
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-14, `degenerate ${g.name} ${i / 3}`);
    volume += a.dot(b.clone().cross(c)) / 6;
    const ks = [0, 1, 2].map(j => key(ids(i + j)));
    for (let j = 0; j < 3; j++) { const a = ks[j], b = ks[(j + 1) % 3], k = [a, b].sort().join('|'); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(a < b ? 1 : -1); }
  }
  for (const [edge, directions] of edges) assert.deepEqual(directions.sort(), [-1, 1], `nonmanifold ${g.name}: ${edge}`);
  assert.ok(volume > 0, `inward solid ${g.name}: ${volume}`);
}
function ray(g, p, d) {
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(g, m); mesh.updateMatrixWorld(true);
  try { return new THREE.Raycaster(new THREE.Vector3(...p), new THREE.Vector3(...d)).intersectObject(mesh); } finally { m.dispose(); }
}

test('fixture: late Haiyue excludes the early ensemble and Guangxu bridge, and retains explicit inference', () => {
  assert.deepEqual([haiyuePeriod.xianfeng.mainBaosha, haiyuePeriod.xianfeng.cornerPavilions, haiyuePeriod.xianfeng.curvedGalleries, haiyuePeriod.xianfeng.paifang], [0, 0, 0, 0]);
  assert.deepEqual(haiyueLayout.halls.map(h => h.bays), [5, 5, 3, 3]);
  assert.equal(haiyueLayout.metricAccuracy, 'not-established'); assert.equal(haiyueLayout.main.levels[1].width, 11.5);
  for (const level of haiyueLayout.main.levels) assert.ok(Math.abs(level.bays.reduce((a, b) => a + b, 0) - level.width) < 1e-8);
  for (const dock of haiyueLayout.docks) { const x = Math.sin(dock.rotationY), z = Math.cos(dock.rotationY); if (dock.id === 'west') assert.ok(x < -.99); if (dock.id === 'east') assert.ok(x > .99); if (dock.id === 'north') assert.ok(z < -.99); }
  assert.ok(haiyueViews.stairs && haiyueViews.mainRoof && haiyueViews.dock);
});

test('fixture: curved coursing and turned marble profiles are closed, outward volumes', () => {
  for (const g of [haiyueArcBlockGeometry({ innerRadius: 38.3, outerRadius: 39, angle: .042, height: .39 }), haiyueLatheGeometry([[0, 0], [.15, 0], [.17, .05], [.14, .12], [.08, .25], [0, .28]])]) {
    try { checkSolid(g); } finally { g.dispose(); }
  }
});

test('fixture: the top cross roof skirt is a single closed ring around a genuine aperture', () => {
  const o = { width: 10.8, innerWidth: 8.2, innerArmWidth: 5, eaveY: 18, rise: 1.2 }, g = haiyueCrossSkirtGeometry(o);
  try {
    checkSolid(g);
    assert.equal(ray(g, [.01, 30, .02], [0, -1, 0]).length, 0);
    assert.ok(ray(g, [4.8, 30, 4.8], [0, -1, 0]).length >= 2);
    for (let edge = 0; edge < 12; edge++) for (const t of [0, .5, 1]) assert.ok(haiyueCrossSkirtPoint(o, edge, 1, t).distanceTo(haiyueCrossSkirtPoint(o, (edge + 1) % 12, 0, t)) < 1e-8);
  } finally { g.dispose(); }
});

test('fixture: floor leaves the west stairwell physically open and supports the landing edge', () => {
  const s = haiyueLayout.main.stairwell, g = haiyueFloorGeometry(11.85, 9.11, 9.35, s);
  try { checkSolid(g); assert.equal(ray(g, [-2.5, 12, 0], [0, -1, 0]).length, 0); assert.ok(ray(g, [-2.5, 12, 3.2], [0, -1, 0]).length >= 2); assert.ok(ray(g, [0, 12, 0], [0, -1, 0]).length >= 2); } finally { g.dispose(); }
});

test('fixture: two U stairs have ordered treads, usable width and no invented metric authority', () => {
  const levels = haiyueLayout.main.levels, well = haiyueLayout.main.stairwell;
  for (let level = 0; level < 2; level++) {
    const treads = haiyueStairTreads({ bottom: levels[level].floorY, top: levels[level + 1].floorY, well, count: well.flightCounts[level] });
    assert.equal(treads.length, well.flightCounts[level] * 2);
    for (const t of treads) { assert.ok(t.width >= 1.1 && t.depth >= .26); assert.ok(t.rise > .15 && t.rise < .20); assert.ok(t.x - t.width / 2 > well.minX && t.x + t.width / 2 < well.maxX); }
    assert.equal(treads.at(-1).y, levels[level + 1].floorY);
    for (let i = 1; i < treads.length; i++) assert.ok(treads[i].y > treads[i - 1].y);
  }
});

test('fixture: lattice members remain in the actual window aperture', () => {
  const members = haiyueLatticeSegments({ width: .85, height: 2.3 }); assert.ok(members.length > 10);
  for (const member of members) for (const [x, y] of [member.from, member.to]) { assert.ok(Math.abs(x) <= .425); assert.ok(y >= 0 && y <= 2.3); }
});

test('fixture: actual timber steps support each foot position and the return meets its upper landing', () => {
  const b = new HaiyueBuilder(), root = new THREE.Group(), well = haiyueLayout.main.stairwell, bottom = 2.6, top = 9.35, count = 18;
  try {
    haiyueTimberStair(b, root, { bottom, top, well, count, id: 'stairs-fixture' }); b.flush(); root.updateMatrixWorld(true);
    for (const t of haiyueStairTreads({ bottom, top, well, count })) {
      const hit = new THREE.Raycaster(new THREE.Vector3(t.x, t.y + .035, t.z), new THREE.Vector3(0, -1, 0), 0, .2).intersectObject(root, true)[0];
      assert.ok(hit && Math.abs(hit.point.y - t.y) < .0001, `missing tread ${t.flight}/${t.step}`);
    }
    const middle = new THREE.Raycaster(new THREE.Vector3(-2.5, 6.10, -2.21), new THREE.Vector3(0, -1, 0), 0, .3).intersectObject(root, true)[0]; assert.ok(Math.abs(middle.point.y - (bottom + top) / 2) < .001);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: central hinged joinery provides an actual walk-through while side panels remain solid', () => {
  const b = new HaiyueBuilder(), root = new THREE.Group();
  try {
    haiyuePanelBay(b, root, { width: 3.41, height: 3.85, floorY: 2.56, open: true }); b.flush(); root.updateMatrixWorld(true);
    for (const x of [-.55, 0, .55]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, 4.0, 2), new THREE.Vector3(0, 0, -1), 0, 4).intersectObject(root, true).length, 0);
    assert.ok(new THREE.Raycaster(new THREE.Vector3(1.36, 2.90, 2), new THREE.Vector3(0, 0, -1), 0, 4).intersectObject(root, true).length);
  } finally { b.dispose(); root.clear(); }
});

test('fixture: real pan/cover tiles follow curved slopes with independent positive transforms', () => {
  const b = new HaiyueBuilder(), root = new THREE.Group();
  try {
    const sample = t => new THREE.Vector3(0, .50 * t ** 1.7, 1.6 * (1 - t));
    haiyueTileRun(b, root, sample, 1, 7); haiyueTileRun(b, root, t => sample(t).add(new THREE.Vector3(.135, 0, 0)), 1, 8, { pan: true }); b.flush(); root.updateMatrixWorld(true);
    assert.ok(b.instances.size >= 3);
    for (const mesh of b.instances) for (let i = 0; i < mesh.count; i++) { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0); }
    assert.ok([...b.instances].some(m => m.material === b.m.greenTile)); assert.ok([...b.instances].some(m => m.material === b.m.yellowTile));
  } finally { b.dispose(); root.clear(); }
});

test('fixture: original paint pixels are deterministic and invalid component requests allocate no model', () => {
  const a = haiyuePaintworkPixels(192, 48), b = haiyuePaintworkPixels(192, 48), hash = p => createHash('sha256').update(p.data).digest('hex');
  assert.equal(hash(a), hash(b)); assert.ok(new Set(a.data).size > 80);
  assert.throws(() => createHaiyueStudy({ components: [] }), /Unknown/); assert.throws(() => createHaiyueStudy({ components: ['unknown'] }), /Unknown/);
  for (const view of Object.values(haiyueViews)) if (view.groups.length) assert.ok(view.isolate?.length);
});

// The resource owner runs fixtures only until a serial full-factory slot is
// granted. This one production construction serves every production subtest.
test('production: complete late Haiyue, real supports, stair clearance and disposal', async t => {
  const sourceFiles = ['haiyue-layout.js', 'haiyue-geometry.js', 'haiyue-materials.js', 'haiyue-architecture.js', 'haiyue-roofs.js', 'haiyue-study.js', 'haiyue-study-views.js', 'haiyue-museum-content.js', 'haiyue-stone-rail.js', 'study-geometry.js', 'chinese-architecture-geometry.js'];
  const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(new URL('../src/yuanmingyuan/' + file, import.meta.url))).digest('hex')]));
  const report = { sourceBefore: sourceHashes(), startedAt: new Date().toISOString(), status: 'running', before: process.memoryUsage(), checks: [] }, started = performance.now(), path = process.env.HAIYUE_REPORT_PATH; let study;
  const check = async (name, fn) => t.test(name, () => { try { fn(); report.checks.push(name); } catch (e) { (report.failures ??= []).push({ name, message: e.message, stack: e.stack }); throw e; } });
  try {
    const construction = performance.now(); study = createHaiyueStudy(); report.factoryMilliseconds = performance.now() - construction; report.afterBuild = process.memoryUsage(); report.diagnostics = study.diagnostics;
    const { group, resources } = study;
    await check('late ensemble contains five buildings and every declared review group', () => {
      assert.equal(study.diagnostics.buildings.length, 5); assert.equal(study.diagnostics.buildings[0].baosha, 0); assert.equal(study.diagnostics.buildings[0].levels, 3);
      for (const view of Object.values(haiyueViews)) for (const name of [...view.groups, ...(view.isolate ?? [])]) assert.ok(group.getObjectByName(name), `missing ${name}`);
      assert.ok(study.diagnostics.bounds.min[1] <= -2.299); assert.ok(study.diagnostics.bounds.max[1] > 20);
    });
    await check('all stored geometry and positive instance transforms are finite and nondegenerate', () => {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (const g of resources.geometries) {
        const p = g.attributes.position, idx = g.index, get = i => idx ? idx.getX(i) : i;
        for (const attr of Object.values(g.attributes)) for (const v of attr.array) assert.ok(Number.isFinite(v));
        for (let i = 0; i < (idx?.count ?? p.count); i += 3) { a.fromBufferAttribute(p, get(i)); b.fromBufferAttribute(p, get(i + 1)); c.fromBufferAttribute(p, get(i + 2)); assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15, `${g.name || g.type} degenerate triangle ${i / 3}`); }
      }
      for (const m of resources.instances) for (let i = 0; i < m.count; i++) { const matrix = new THREE.Matrix4(); m.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite)); assert.ok(matrix.determinant() > 0); }
    });
    await check('the actual four docks, twelve-riser climbs and terraces have continuous supports', () => {
      group.updateMatrixWorld(true);
      for (const dock of haiyueLayout.docks) {
        const body = group.getObjectByName(`haiyue-${dock.id}-dock`), stair = group.getObjectByName(`haiyue-${dock.id}-terrace-stair`), ds = haiyueLayout.dock;
        for (let i = 0; i < ds.stairs; i++) {
          const radius = 39 - .03 + (i + .5) * ds.pitch, x = Math.sin(dock.rotationY) * radius, z = Math.cos(dock.rotationY) * radius, y = .4 - i * (.4 - ds.landingY) / ds.stairs;
          const hit = new THREE.Raycaster(new THREE.Vector3(x, y + .04, z), new THREE.Vector3(0, -1, 0), 0, .1).intersectObject(body, true)[0]; assert.ok(hit && Math.abs(hit.point.y - y) < .004, `dock ${dock.id} step ${i}`);
        }
        for (let i = 0; i < 12; i++) {
          const radius = 31.3 - .025 + (i + .5) * .32, x = Math.sin(dock.rotationY) * radius, z = Math.cos(dock.rotationY) * radius, y = 2.2 - i * .15;
          const hit = new THREE.Raycaster(new THREE.Vector3(x, y + .04, z), new THREE.Vector3(0, -1, 0), 0, .1).intersectObject(stair, true)[0]; assert.ok(hit && Math.abs(hit.point.y - y) < .004, `upper stair ${dock.id}/${i}`);
        }
        const start = new THREE.Vector3(Math.sin(dock.rotationY) * 35.30, 1.50, Math.cos(dock.rotationY) * 35.30), direction = new THREE.Vector3(Math.sin(dock.rotationY), 0, Math.cos(dock.rotationY));
        const outerRail = group.getObjectByName('haiyue-lower-marble-rails'); assert.equal(new THREE.Raycaster(start, direction, 0, 4.5).intersectObject(outerRail, true).length, 0, `dock gap ${dock.id}`);
      }
      for (const [x, z, y] of [[15, 10, 2.2], [-15, -10, 2.2], [32, 10, .4], [-32, -10, .4]]) {
        const body = group.getObjectByName(`haiyue-${y > 1 ? 'upper' : 'lower'}-terrace`), hit = new THREE.Raycaster(new THREE.Vector3(x, y + .06, z), new THREE.Vector3(0, -1, 0), 0, .1).intersectObject(body, true)[0]; assert.ok(hit && Math.abs(hit.point.y - y) < .009, `terrace ${x}/${z}`);
      }
    });
    await check('both actual internal stairs reach the floors without overhead obstruction', () => {
      const main = group.getObjectByName('haiyue-main-pavilion'), levels = haiyueLayout.main.levels, well = haiyueLayout.main.stairwell;
      for (let level = 0; level < 2; level++) for (const step of haiyueStairTreads({ bottom: levels[level].floorY, top: levels[level + 1].floorY, well, count: well.flightCounts[level] })) {
        const hit = new THREE.Raycaster(new THREE.Vector3(step.x, step.y + .04, step.z), new THREE.Vector3(0, -1, 0), 0, .15).intersectObject(main, true)[0]; assert.ok(hit && Math.abs(hit.point.y - step.y) < .002, `no production tread ${level}/${step.step}`);
        const overhead = new THREE.Raycaster(new THREE.Vector3(step.x, step.y + .06, step.z), new THREE.Vector3(0, 1, 0), 0, 1.82).intersectObject(main, true)[0]; assert.equal(overhead, undefined, `stair headroom ${level}/${step.flight}/${step.step}: ${overhead?.object.name}`);
      }
      for (const level of [1, 2]) { const floor = group.getObjectByName(`haiyue-main-floor-${level + 1}`), y = levels[level].floorY; assert.equal(new THREE.Raycaster(new THREE.Vector3(-2.50, y + .07, .2), new THREE.Vector3(0, -1, 0), 0, .15).intersectObject(floor, true).length, 0, 'floor caps stair void'); }
    });
    await check('four passing halls retain real front/back doors and the annex floors join', () => {
      for (const spec of haiyueLayout.halls) {
        const hall = group.getObjectByName(`haiyue-${spec.id}`), y = spec.floorY + 1.62;
        for (const x of [-.50, 0, .50]) {
          const start = hall.localToWorld(new THREE.Vector3(x, y, 10)), direction = new THREE.Vector3(0, 0, -1).applyQuaternion(hall.getWorldQuaternion(new THREE.Quaternion()));
          assert.equal(new THREE.Raycaster(start, direction, 0, 20).intersectObject(hall, true).length, 0, `hall axial opening ${spec.id}/${x}`);
        }
        for (const z of spec.baosha ? [-4, 0, 3.9, 5.7, 8] : [-3, 0, 3]) {
          const start = hall.localToWorld(new THREE.Vector3(.25, spec.floorY + .055, z)), hit = new THREE.Raycaster(start, new THREE.Vector3(0, -1, 0), 0, .14).intersectObject(hall, true)[0];
          assert.ok(hit && Math.abs(hit.point.y - spec.floorY) < .004, `hall/annex support ${spec.id}/${z}`);
        }
      }
    });
    await check('each instance resource is disposed exactly once and the graph is released', () => {
      const snapshot = [...resources.geometries, ...resources.materials, ...resources.textures, ...resources.instances], events = new Map(snapshot.map(r => [r, 0]));
      for (const r of snapshot) r.addEventListener('dispose', () => events.set(r, events.get(r) + 1)); study.dispose(); study.dispose();
      for (const n of events.values()) assert.equal(n, 1); assert.equal(group.children.length, 0); report.disposal = { count: snapshot.length, exactlyOnce: true, idempotent: true, graphCleared: true };
    });
    report.status = report.failures?.length ? 'failed' : 'passed';
  } catch (e) { report.status = 'failed'; report.error = { message: e.message, stack: e.stack }; throw e; }
  finally { study?.dispose(); report.totalMilliseconds = performance.now() - started; report.afterDispose = process.memoryUsage(); report.sourceAfter = sourceHashes(); assert.deepEqual(report.sourceAfter, report.sourceBefore, 'Source changed during actual production'); report.peakRssKiB = process.resourceUsage().maxRSS; if (path) writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); }
});
