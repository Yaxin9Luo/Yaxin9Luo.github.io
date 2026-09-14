import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GardenGateBuilder, thickPatch, facadeGeometry } from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import { HILL, spiralPoint, spiralFrame, spiralOffset, XIANFA_IDS, SCREEN_LAYOUT, scenicWallSpec } from '../src/yuanmingyuan/xianfa-landscape-layout.js';
import { moundGeometry, hillHeightSampler, spiralDeckGeometry, spiralParapetGeometry, gateWallGeometry, pavilionRoofSampler, scenicWingContour, paintedWingGeometry, scenicPaintingTexture, waterLanding, fiveSluiceWallGeometry, bridgeScreenGeometry, BRIDGE } from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import { assertClosedWinding, assertGeometryNormals, ray, category, near } from './yuanmingyuan-garden-study-checks.js';

const mesh = g => new THREE.Mesh(g, new THREE.MeshBasicMaterial());
function disposeMesh(m) { m.geometry.dispose(); m.material.dispose(); }

test('fixtures: historic identities keep the separate west bridge unregistered and retain disputed screen counts', () => {
  assert.deepEqual([XIANFA_IDS.screens.groupId, XIANFA_IDS.screens.museumEntryId], ['xianfahua', 'fanghe-xianfahua']);
  assert.equal(XIANFA_IDS.bridge.groupId, null); assert.equal(XIANFA_IDS.bridge.museumEntryId, null); assert.match(XIANFA_IDS.bridge.locationEvidence, /west of Xieqiqu/);
  assert.match(HILL.turnCountEvidence, /does not establish/); assert.match(SCREEN_LAYOUT.countStatus, /disputed/);
});

test('fixtures: the winding road remains 1.5 m wide and flattens toward the west pavilion door', () => {
  let previous = -.01;
  for (let i = 0; i <= 300; i++) {
    const t = i / 300, frame = spiralFrame(t), a = spiralOffset(t, -.75), c = spiralOffset(t, .75);
    near(Math.hypot(a[0] - c[0], a[2] - c[2]), 1.5, 'clear horizontal width', 1e-8);
    assert.ok(frame.point[1] >= previous); previous = frame.point[1]; assert.ok(frame.gradient < .115, `walkable authored grade at ${t}: ${frame.gradient}`);
  }
  near(spiralPoint(1)[1], HILL.summitFloor, 'flush summit arrival'); assert.ok(spiralFrame(1).tangent[0] > .999); near(spiralFrame(1).gradient, 0, 'level summit tangent');
  for (let i = 1; i < 300; i++) for (const offset of [-.93, .93]) {
    const t = i / 300, a = spiralOffset(t - .0001, offset), c = spiralOffset(t + .0001, offset), tangent = spiralFrame(t).tangent;
    assert.ok((c[0] - a[0]) * tangent[0] + (c[2] - a[2]) * tangent[2] > 0, 'inner and outer deck edges never fold at the summit transition');
  }
});

test('fixtures: road slab, glazed parapets and sampled mound are closed with finite normals', () => {
  const geometries = [spiralDeckGeometry(120), spiralParapetGeometry(-1, false, 120), spiralParapetGeometry(1, true, 120), moundGeometry(36)];
  try { for (const g of geometries) { assertGeometryNormals(g); assertClosedWinding(g); } }
  finally { for (const g of geometries) g.dispose(); }
});

test('fixtures: the exact terrain sampler supports both ramp edges instead of burying or suspending a terrace', () => {
  const height = hillHeightSampler(720);
  for (let i = 0; i <= 180; i++) for (const offset of [-.89, -.45, 0, .45, .89]) {
    const p = spiralOffset(i / 180, offset), support = height(p[0], p[2]);
    near(support, p[1] - HILL.pathThickness, 'earth contact at ramp underside', .024);
  }
});

test('fixtures: distinct east and west gate walls have three actual bottom-connected openings', () => {
  for (const east of [false, true]) {
    const m = mesh(gateWallGeometry(east));
    try {
      assertClosedWinding(m.geometry); assertGeometryNormals(m.geometry);
      for (const x of [-4.48, 0, 4.48]) for (const y of [.20, 1.6, 2.2]) assert.equal(ray([x, y, 1], [0, 0, -1], m, 2).length, 0);
      assert.equal(ray([2.5, 1.6, 1], [0, 0, -1], m, 2).length, 1, 'real thick jamb');
    } finally { disposeMesh(m); }
  }
});

test('fixtures: eight tiled roof substrates meet at every hip with physical closed undersides', () => {
  const faces = Array.from({ length: 8 }, (_, i) => pavilionRoofSampler(i, 4.16, 1.19, 11.25, 1.62));
  for (let i = 0; i < 8; i++) {
    const g = thickPatch(faces[i], 6, 10, .15);
    try { assertClosedWinding(g); assertGeometryNormals(g); } finally { g.dispose(); }
    for (let j = 0; j <= 24; j++) assert.ok(new THREE.Vector3(...faces[i](1, j / 24)).distanceTo(new THREE.Vector3(...faces[(i + 1) % 8](0, j / 24))) < 1e-8);
  }
});

test('fixtures: paired scenic wings taper; painted façades stay on thin closed walls with open front archways', () => {
  let previous = Infinity;
  for (let row = 0; row < 6; row++) {
    const spec = scenicWallSpec(row, 1), g = facadeGeometry(scenicWingContour(spec.width, spec.height, row), -spec.depth / 2, spec.depth / 2), paint = paintedWingGeometry(spec.width, spec.height, row, spec.depth / 2 + .008);
    try {
      assertClosedWinding(g); assertGeometryNormals(g); assertClosedWinding(paint); assertGeometryNormals(paint);
      assert.ok(spec.z < previous); previous = spec.z; assert.ok(spec.depth <= .7);
      if (row === 0) { const m = mesh(g.clone()); try { assert.equal(ray([0, 1.7, 2], [0, 0, -1], m, 4).length, 0); } finally { disposeMesh(m); } }
    } finally { g.dispose(); paint.dispose(); }
  }
  const t = scenicPaintingTexture(2, false, 48); try { assert.equal(t.image.data.length, 48 * 48 * 4); assert.equal(t.colorSpace, THREE.SRGBColorSpace); assert.match(t.userData.evidence, /not a surviving Qing/); } finally { t.dispose(); }
});

test('fixtures: semicircular landing reaches one real water plane without coplanar tread shimmer', () => {
  const b = new GardenGateBuilder('xianfa-landing-fixture'), root = new THREE.Group();
  try {
    waterLanding(b, root, 'landing', 0, 1);
    b.box(root, b.m.water, [3, -.303, 0], [8, .006, 12], 0);
    const a = b.finish(root, { assetId: 'fixture' });
    try {
      const hits = ray([4.18, 2, 0], [0, -1, 0], root), water = hits.find(h => category(h) === 'water'), stone = hits.find(h => category(h) === 'stone');
      near(water?.point.y, -.30, 'surface'); near(stone?.point.y, -.306, 'lowest tread', .001); assert.ok(water.point.y > stone.point.y + .004);
      for (const [x, y] of [[2.9, 0], [3.31, -.1], [3.68, -.2]]) near(ray([x, 2, 0], [0, -1, 0], root)[0]?.point.y, y, 'each supported tread');
    } finally { a.dispose(); }
  } finally { b.dispose(); }
});

test('fixtures: the photographed bridge has five genuine waterways and an independent through-door', () => {
  const sluice = mesh(fiveSluiceWallGeometry()), gate = mesh(bridgeScreenGeometry());
  try {
    for (const m of [sluice, gate]) { assertClosedWinding(m.geometry); assertGeometryNormals(m.geometry); }
    for (const x of BRIDGE.pierX) assert.equal(ray([x, -.5, 5], [0, 0, -1], sluice, 10).length, 0, 'open water arch');
    for (const x of [-.45, 0, .45]) for (const y of [1.6, 2.7, 3.2]) assert.equal(ray([x, y, 2], [0, 0, -1], gate, 4).length, 0, 'real central door');
    assert.ok(ray([2.6, 2.4, 2], [0, 0, -1], gate, 4).length > 0, 'substantial screen beside door');
  } finally { disposeMesh(sluice); disposeMesh(gate); }
});
