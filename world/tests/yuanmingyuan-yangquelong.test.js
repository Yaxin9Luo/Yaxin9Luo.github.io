import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYangquelongStudy } from '../src/yuanmingyuan/yangquelong-study.js';
import { GardenGateBuilder, thickPatch, hipRoofSampler } from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import { curvedParapetGeometry, hangingBowl } from '../src/yuanmingyuan/yangquelong-geometry.js';
import { yangquelongStudyViews } from '../src/yuanmingyuan/yangquelong-views.js';
import { object, bounds, ray, localRay, category, near, assertGeometryNormals, assertClosedWinding, assertOwnedAsset, assertViewsResolve, assertWaterEndpoints, assertInstanceReplacement, resources } from './yuanmingyuan-garden-study-checks.js';

let asset;
const study = () => asset ??= createYangquelongStudy();
after(() => asset?.dispose());

test('fixtures: four upturned roof faces meet at their hip seams and retain closed thick substrates', () => {
  const faces = Array.from({ length: 4 }, (_, i) => hipRoofSampler(5.6, 4.1, 7.03, 1.15, 3.7, i)), geometries = [];
  try {
    for (const face of faces) { const g = thickPatch((u, v) => face(u, .005 + v * .995), 12, 18, .13); geometries.push(g); assertGeometryNormals(g); assertClosedWinding(g); }
    for (let i = 0; i <= 24; i++) for (const [a, au, c, cu] of [[0, 1, 2, 1], [1, 1, 2, 0], [0, 0, 3, 1], [1, 0, 3, 0]]) {
      const p = faces[a](au, i / 24), q = faces[c](cu, i / 24); assert.ok(new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...q)) < 1e-7, 'continuous hip seam');
    }
  } finally { for (const geometry of geometries) geometry.dispose(); }
});

test('fixtures: the east parapet is closed and the raised fountain bowl has a receiving surface inside a real cavity', () => {
  const parapet = curvedParapetGeometry(), b = new GardenGateBuilder('fixture-aviary-bowl'), root = new THREE.Group();
  try {
    assertGeometryNormals(parapet); assertClosedWinding(parapet);
    hangingBowl(b, root, 'fixture-bowl', 0, 0, 1.31); const a = b.finish(root, { assetId: 'fixture' });
    try {
      const hits = ray([.55, 2, .18], [0, -1, 0], root), water = hits.find(hit => category(hit) === 'water'), floor = hits.find(hit => category(hit) === 'stone');
      near(water?.point.y, 1.31, 'receiving elevation'); assert.ok(floor?.point.y < 1.27 && floor.point.y > 1.08, 'bowl wall/floor is beneath the visible water');
      for (const geometry of resources(root).geometries) assertGeometryNormals(geometry);
    } finally { a.dispose(); }
  } finally { parapet.dispose(); b.dispose(); }
});

test('the west Chinese roofs and east European curved balustrade remain distinct opposite facades', () => {
  const a = study();
  assert.equal(object(a, 'yangquelong-west-chinese-gate').userData.facing, 'west'); assert.equal(object(a, 'yangquelong-east-european-gate').userData.facing, 'east');
  assert.ok(bounds(a, 'yangquelong-west-high-central-roof').max.y > bounds(a, 'yangquelong-west-side-roof-1').max.y + .6);
  assert.ok(bounds(a, 'yangquelong-west-chinese-gate').max.x < bounds(a, 'yangquelong-east-european-gate').min.x, 'two materially different facades have true intervening depth');
  assert.ok([...resources(object(a, 'yangquelong-west-chinese-gate')).materials].some(material => material.userData.category === 'glazed-tile'));
  assert.ok([...resources(object(a, 'yangquelong-east-european-gate')).materials].every(material => material.userData.category !== 'glazed-tile'));
  assert.ok(object(a, 'yangquelong-north-bird-room')); assert.ok(object(a, 'yangquelong-south-bird-room'));
});

test('the central passage and both bird-room approaches are actual unobstructed openings', () => {
  const a = study();
  for (const z of [-.47, 0, .47]) for (const y of [.85, 1.65, 2.2]) assert.equal(ray([-6, y, z], [1, 0, 0], a.group, 12).length, 0, 'west-to-east body clearance through both open gates');
  for (const x of [-.43, 0, .43]) for (const side of [-1, 1]) assert.equal(ray([x, 1.70, 0], [0, 0, side], a.group, 20.7).length, 0, 'side door and bird-room doorway connect without a hidden wall');
  const floor = object(a, 'yangquelong-main-floor-and-stairs');
  for (const x of [-3.8, -1.8, 0, 1.8, 3.8]) near(ray([x, 1.5, 0], [0, -1, 0], floor)[0]?.point.y, .30, 'continuous raised passage floor');
});

test('grille bays contain separate bars and open air, with masonry depth around each opening', () => {
  const a = study(), grille = object(a, 'yangquelong-west-large-grille--1');
  assert.equal(localRay([0, 1.65, 1], [0, 0, -1], grille, 2).length, 0, 'air between metal rods');
  const bar = localRay([-1.565, 1.65, 1], [0, 0, -1], grille, 2)[0]; assert.equal(category(bar), 'metal-grille', 'physical border bar');
  const west = object(a, 'yangquelong-west-chinese-gate');
  assert.ok(localRay([4.94 + 1.85, 2.2, 2], [0, 0, -1], west, 4).some(hit => category(hit) === 'stone'), 'stone jamb surrounding the lattice');
  assert.ok(bounds(a, 'yangquelong-north-bird-room-west-wall').getSize(new THREE.Vector3()).x > .40, 'window dressings project from a thick wall');
});

test('both flights of entrance steps meet court and raised floor with supported small risers', () => {
  const a = study(), floor = object(a, 'yangquelong-main-floor-and-stairs'), court = object(a, 'yangquelong-court-paving');
  for (const side of [-1, 1]) {
    let previous = 0;
    for (let radius = 5.40; radius > 3.80; radius -= .06) {
      const x = side * radius, hits = [...ray([x, .75, 0], [0, -1, 0], floor), ...ray([x, .75, 0], [0, -1, 0], court)].sort((a, b) => b.point.y - a.point.y);
      assert.ok(hits.length); const y = hits[0].point.y; assert.ok(y - previous <= .113, `step ${side}: ${previous} -> ${y}`); previous = y;
    }
    near(previous, .30, 'steps join the door floor');
    assert.ok(ray([side * 5.03, -.3, 0], [0, 1, 0], floor)[0]?.point.y < 0, 'grounded first riser underside');
  }
});

test('west receiving pools and eastern channel are excavated through paving with solid submerged bottoms', () => {
  const a = study(), paving = object(a, 'yangquelong-court-paving');
  for (const [x, z, name, level] of [[-6.6, -4.17, 'yangquelong-west-pool-north', .17], [-6.6, 5.53, 'yangquelong-west-pool-south', .17], [15.5, 6.0, 'yangquelong-east-water-channel', -.30]]) {
    assert.equal(ray([x, 2, z], [0, -1, 0], paving).length, 0, `${name}: no paving crosses the water`);
    const hits = ray([x, 2, z], [0, -1, 0], object(a, name)); near(hits.find(hit => category(hit) === 'water')?.point.y, level, `${name}: water`);
    assert.ok(hits.some(hit => category(hit) === 'stone' && hit.point.y < level - .20), `${name}: submerged stone floor`);
  }
  near(ray([15.5, 2, 0], [0, -1, 0], object(a, 'yangquelong-east-arched-stone-bridge'))[0]?.point.y, .28, 'bridge spans above the water');
});

test('every fountain stream lands on its named basin water and separate flow/surface materials animate', () => {
  const a = study(); assert.equal(a.diagnostics.waterEndpoints.length, 6); assertWaterEndpoints(a);
  const materials = [...resources(a.group).materials], surface = materials.find(material => material.userData.role === 'surface'), flow = materials.find(material => material.userData.role === 'flow');
  assert.ok(surface && flow && surface !== flow); const old = flow.alphaMap.offset.clone(), endpoints = JSON.stringify(a.diagnostics.waterEndpoints); a.update(2.75);
  assert.notDeepEqual(flow.alphaMap.offset, old); assert.equal(JSON.stringify(a.diagnostics.waterEndpoints), endpoints); a.update(0);
});

test('the factory reports actual finite geometry, owned resources and resolvable review presets', t => { const a = study(); assertOwnedAsset(a, t); assertViewsResolve(a, yangquelongStudyViews); });

test('authored dimensions, open door state and unidentified sculpture remain explicitly unaccepted', () => {
  const a = study(); assert.ok(a.diagnostics.provisionalScale.isProvisional); assert.equal(a.diagnostics.visualAcceptance, false); assert.equal(a.diagnostics.integrationAcceptance, false);
  assert.ok(a.diagnostics.uncertainty.some(text => text.includes('cannot be identified'))); assert.equal(a.diagnostics.navigation.gateState, 'open-authored-review-state');
});

test('full study resources dispose once and a later instance is independent', () => { assertInstanceReplacement(study(), createYangquelongStudy); asset = undefined; });
