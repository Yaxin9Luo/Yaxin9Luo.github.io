import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { haiyueLayout, haiyueMaterialEvidence } from '../src/yuanmingyuan/haiyue-layout.js';
import { haiyueViews } from '../src/yuanmingyuan/haiyue-study-views.js';
import { haiyueCircle, haiyueArcBlockGeometry } from '../src/yuanmingyuan/haiyue-geometry.js';
import { namedGroup, extrudedPolygon } from '../src/yuanmingyuan/study-geometry.js';
import { clipPavingCell } from '../src/yuanmingyuan/chinese-architecture-geometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Execute the actual private terrace body up to the unrelated balustrades.
// The recorder retains only the core, two stone prototypes and paving bounds:
// no buildings, materials/textures, complete terrace mesh or GPU are allocated.
function terraceSection(spec) {
  const source = readFileSync(new URL('../src/yuanmingyuan/haiyue-study.js', import.meta.url), 'utf8');
  const start = source.indexOf('function buildTerrace('), end = source.indexOf('  const rails =', start);
  assert.ok(start >= 0 && end > start);
  const execute = new Function('THREE', 'namedGroup', 'haiyueCircle', 'haiyueArcBlockGeometry', 'extrudedPolygon', 'clipPavingCell', 'haiyueLayout', 'haiyueMaterialEvidence', 'sourceIds', source.slice(start, end) + '\nreturn g;\n}\nreturn buildTerrace;')(
    THREE, namedGroup, haiyueCircle, haiyueArcBlockGeometry, extrudedPolygon, clipPavingCell, haiyueLayout, haiyueMaterialEvidence, ['haiyue-lin-2024', 'haiyue-park-site'],
  );
  const prototypes = new Map(), result = { maximumPavingRadius: 0, pavingCells: 0 }, m = { foundation: {}, stone: {}, paving: {} };
  const recordPoint = (x, z) => { result.maximumPavingRadius = Math.max(result.maximumPavingRadius, Math.hypot(x, z)); };
  const b = {
    m,
    polygon(parent, polygon, bottom, top) { result.core = extrudedPolygon(polygon, bottom, top); },
    proto(key, make) { if (!prototypes.has(key)) prototypes.set(key, make()); return prototypes.get(key); },
    put(parent, geometry, material, position, scale, rotation) {
      if (material === m.paving) {
        result.pavingCells++;
        const p = geometry.attributes.position; for (let i = 0; i < p.count; i++) recordPoint(p.getX(i), p.getZ(i));
        geometry.dispose();
      } else if (!result.course && prototypes.keys().next().value?.startsWith('arc-course')) result.course = { geometry, position, rotation };
    },
    block(parent, material, position, size) {
      if (material !== m.paving) return;
      result.pavingCells++;
      for (const x of [-1, 1]) for (const z of [-1, 1]) recordPoint(position[0] + x * size[0] / 2, position[2] + z * size[2] / 2);
    },
  };
  execute(b, new THREE.Group(), spec); result.prototypes = prototypes;
  result.dispose = () => { result.core.dispose(); for (const g of prototypes.values()) g.dispose(); };
  return result;
}

test('terrace repair: the real core is behind the outer masonry with a hidden structural overlap', () => {
  for (const spec of haiyueLayout.terraces) {
    const sample = terraceSection(spec), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    try {
      const core = new THREE.Mesh(sample.core, material), outer = new THREE.Mesh(sample.course.geometry, material);
      outer.position.set(...sample.course.position); outer.rotation.set(...sample.course.rotation); core.updateMatrixWorld(true); outer.updateMatrixWorld(true);
      const y = spec.bottomY + (spec.topY - spec.bottomY) / Math.round((spec.topY - spec.bottomY) / .45) / 2;
      for (const angle of [-.014, -.007, 0, .009, .015]) {
        const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), origin = direction.clone().multiplyScalar(spec.radius + .3); origin.y = y;
        const ray = new THREE.Raycaster(origin, direction.negate()), outside = ray.intersectObject(outer)[0], inside = ray.intersectObject(core)[0];
        assert.ok(outside && inside, `${spec.id}: actual side intersection missing`);
        assert.ok(inside.distance - outside.distance > .59, `${spec.id}: outer skin and core are coincident (${inside.distance - outside.distance})`);
        assert.ok(Math.hypot(inside.point.x, inside.point.z) > spec.radius - .62 + .015, `${spec.id}: hidden core/stone support lost`);
        assert.ok(Math.abs(Math.hypot(outside.point.x, outside.point.z) - spec.radius) < .0002, `${spec.id}: the accepted outer outline moved`);
      }
    } finally { material.dispose(); sample.dispose(); }
  }
});

test('terrace repair: dressed paving stops inside the cap with a real narrow joint', () => {
  for (const spec of haiyueLayout.terraces) {
    const sample = terraceSection(spec);
    try {
      assert.ok(sample.pavingCells > 100);
      const joint = spec.radius - .75 - sample.maximumPavingRadius;
      assert.ok(joint > .006 && joint < .011, `${spec.id}: cap/paving joint ${joint}`);
    } finally { sample.dispose(); }
  }
});

test('terrace repair: stair inspection retains both real floor holes and their guards', () => {
  assert.deepEqual(haiyueViews.stairs.isolate, ['haiyue-main-stairs', 'haiyue-main-floor-2', 'haiyue-main-floor-3']);
  assert.deepEqual(haiyueViews.stairs.groups, haiyueViews.stairs.isolate);
  assert.ok(haiyueViews.stairs.crop.min[0] < .15 && haiyueViews.stairs.crop.max[0] > .42);
  assert.ok(haiyueViews.floorStair.isolate.includes('haiyue-main-floor-3'));
  assert.ok(haiyueViews.floorStair.isolate.includes('haiyue-stair-to-floor-3'));
});

function platformSample(spec, dock = false) {
  const source = readFileSync(new URL('../src/yuanmingyuan/haiyue-study.js', import.meta.url), 'utf8');
  const start = source.indexOf(dock ? 'function buildDocksAndTerraceStairs(' : 'function raisedBase('), end = source.indexOf(dock ? '\nfunction raisedBase(' : '\nexport function buildHaiyueMainLevel(', start);
  const body = source.slice(start, end), noOp = () => {};
  const execute = new Function('THREE', 'namedGroup', 'extrudedPolygon', 'haiyueStoneSteps', 'haiyueStraightRail', 'haiyueLayout', 'sourceIds', body + `\nreturn ${dock ? 'buildDocksAndTerraceStairs' : 'raisedBase'};`)(THREE, namedGroup, extrudedPolygon, noOp, noOp, haiyueLayout, []);
  const root = new THREE.Group(), materials = { foundation: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), stone: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }) }, meshes = [];
  const put = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); meshes.push(mesh); };
  const b = { m: materials, put, box(parent, material, position, scale) { put(parent, new THREE.BoxGeometry(), material, position, scale); }, block(parent, material, position, scale) { put(parent, new RoundedBoxGeometry(1, 1, 1, 2, .022), material, position, scale); }, polygon(parent, outline, bottom, top, material) { put(parent, extrudedPolygon(outline, bottom, top), material); }, rod: noOp };
  execute(b, root, spec); root.updateMatrixWorld(true);
  return { root, materials, meshes, dispose() { for (const mesh of meshes) mesh.geometry.dispose(); for (const material of Object.values(materials)) material.dispose(); } };
}

test('platform repair: hall core stops below its visible cap and preserves support', () => {
  const spec = { ...haiyueLayout.halls[3], stairs: false }, sample = platformSample(spec);
  try {
    const hits = new THREE.Raycaster(new THREE.Vector3(1, spec.floorY + .3, .5), new THREE.Vector3(0, -1, 0)).intersectObject(sample.root, true);
    const cap = hits.find(h => h.object.material === sample.materials.stone), core = hits.find(h => h.object.material === sample.materials.foundation);
    assert.ok(Math.abs(cap.point.y - spec.floorY) < 1e-6);
    assert.ok(cap.point.y - core.point.y >= .099, `coplanar hall platform: ${cap.point.y - core.point.y}`);
    assert.ok(core.point.y > spec.floorY - .17, 'core must overlap inside the cap');
  } finally { sample.dispose(); }
});

test('platform repair: all four dock cores are underneath their landing caps', () => {
  const sample = platformSample(null, true), ds = haiyueLayout.dock;
  try {
    const radius = haiyueLayout.terraces[0].radius - .03 + ds.stairs * ds.pitch + ds.landingDepth / 2;
    for (const dock of haiyueLayout.docks) {
      const hits = new THREE.Raycaster(new THREE.Vector3(Math.sin(dock.rotationY) * radius, ds.landingY + .3, Math.cos(dock.rotationY) * radius), new THREE.Vector3(0, -1, 0)).intersectObject(sample.root, true);
      const cap = hits.find(h => h.object.material === sample.materials.stone), core = hits.find(h => h.object.material === sample.materials.foundation);
      assert.ok(cap && core); assert.ok(cap.point.y - core.point.y >= .099, `${dock.id}: coplanar dock landing`);
      assert.ok(Math.abs(cap.point.y - ds.landingY) < 1e-6);
    }
  } finally { sample.dispose(); }
});

test('platform repair: north/south main hall and annex share a continuous T-shaped cap', () => {
  for (const spec of haiyueLayout.halls.filter(h => h.baosha)) {
    const sample = platformSample({ ...spec, stairs: false });
    try {
      assert.equal(sample.meshes.filter(m => m.material === sample.materials.stone).length, 1);
      for (const [x, z] of [[0, 0], [0, 3.4], [5, 4], [0, 5.7], [5, 7.5]]) {
        const hits = new THREE.Raycaster(new THREE.Vector3(x, spec.floorY + .05, z), new THREE.Vector3(0, -1, 0), 0, .06).intersectObject(sample.root, true);
        assert.ok(hits.length > 0, `unsupported joined cap at ${x},${z}`);
        assert.ok(hits.every(h => Math.abs(h.point.y - spec.floorY) < 1e-5));
      }
      const cap = sample.meshes.find(m => m.material === sample.materials.stone); cap.geometry.computeBoundingBox();
      const box = new THREE.Box3().setFromObject(cap);
      assert.ok(Math.abs(box.max.x - (spec.width + 1.35) / 2) < .0001);
      assert.ok(Math.abs(box.max.z - (spec.depth / 2 + spec.baosha.depth + .675)) < .0001);
    } finally { sample.dispose(); }
  }
});
