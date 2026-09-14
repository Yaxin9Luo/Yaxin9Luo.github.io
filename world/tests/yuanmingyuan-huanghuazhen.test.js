import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mazePlan, stripPolygon, domeGeometry, piercedWall, bridgeDeckGeometry, carvedBrickMotif, flutedColumnGeometry } from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import { createHuanghuazhenStudy } from '../src/yuanmingyuan/huanghuazhen-study.js';
import { huanghuazhenStudyViews } from '../src/yuanmingyuan/huanghuazhen-views.js';
import { object, bounds, ray, localRay, category, near, assertGeometryNormals, assertClosedWinding, assertOwnedAsset, assertViewsResolve, assertInstanceReplacement, resources } from './yuanmingyuan-garden-study-checks.js';

// The fixture filter never constructs a production factory. Complete studies
// are created lazily and replaced only after disposing the first instance.
let asset;
const study = () => asset ??= createHuanghuazhenStudy();
after(() => asset?.dispose());

test('fixtures: the traced brick maze has four usable routes to the central pavilion', () => {
  const plan = mazePlan(), step = .17, x0 = -31.28, z0 = -58.82, width = 369, height = 567, blocked = new Uint8Array(width * height), visited = new Uint8Array(width * height);
  const segments = plan.paths.flatMap(path => path.points.slice(1).map((b, i) => [path.points[i], b]));
  const cell = ([x, z]) => Math.round((z - z0) / step) * width + Math.round((x - x0) / step);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const x = x0 + column * step, z = z0 + row * step;
    for (const [a, b] of segments) {
      const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      // Half a cell reserves clearance throughout each orthogonal step, not
      // only at its endpoints: .17 m wall half-width + .47 m body radius.
      if ((x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2 < (.64 + step / 2) ** 2) { blocked[row * width + column] = 1; break; }
    }
  }
  const start = cell([0, 0]), queue = [start]; visited[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head], row = Math.floor(at / width), column = at % width;
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const r = row + dr, c = column + dc, next = r * width + c;
      if (r >= 0 && r < height && c >= 0 && c < width && !visited[next] && !blocked[next]) { visited[next] = 1; queue.push(next); }
    }
  }
  for (const [i, entrance] of plan.entrances.entries()) assert.equal(visited[cell(entrance)], 1, `entry ${i} reaches the central platform with 0.94m body clearance inside the walls`);
  assert.equal(plan.paths.filter(path => path.evidence === 'paper-damage-completion-hypothesis').length, 4);
  assert.ok(plan.uncertainty.some(text => text.includes('scale')));
});

test('fixtures: a bent low wall has a thick footprint and the pavilion dome has finite outward normals', () => {
  const polygon = stripPolygon([[0, 0], [3, 0], [3, 3]], .18);
  assert.equal(polygon.length, 6);
  assert.ok(polygon.some(([x]) => x > 3.17));
  const dome = domeGeometry(4, 7, 2.5);
  try {
    const positions = dome.attributes.position, normals = dome.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      assert.ok([positions.getX(i), positions.getY(i), positions.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)].every(Number.isFinite));
      assert.ok(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) > .9);
    }
  } finally { dome.dispose(); }
});

test('fixtures: the dome, arched wall, bridge deck and carved brick each have a closed consistently wound shell', () => {
  const geometries = [domeGeometry(4, 6.28, 2.34), piercedWall(8, 0, 6, .8, [{ x: 0, bottom: 0, width: 3, spring: 3, rise: 1.3 }]), bridgeDeckGeometry(3.8, 4.5), carvedBrickMotif(), flutedColumnGeometry(3.58, .22, .19)];
  try { for (const geometry of geometries) { assertGeometryNormals(geometry); assertClosedWinding(geometry); } }
  finally { for (const geometry of geometries) geometry.dispose(); }
});

test('fixtures: closed architectural shells retain real passage and underside depth', () => {
  const material = new THREE.MeshBasicMaterial(), wallG = piercedWall(8, 0, 6, .8, [{ x: 0, bottom: 0, width: 3, spring: 3, rise: 1.3 }]), deckG = bridgeDeckGeometry(3.8, 4.5), domeG = domeGeometry(4, 6.28, 2.34);
  const wall = new THREE.Mesh(wallG, material), deck = new THREE.Mesh(deckG, material), dome = new THREE.Mesh(domeG, material);
  try {
    for (const y of [.20, 1.6, 3.8]) assert.equal(ray([0, y, 2], [0, 0, -1], wall, 4).length, 0, 'arch is a geometric void');
    assert.ok(ray([2.1, 1.6, 2], [0, 0, -1], wall, 4).length > 0, 'jamb is solid');
    near(ray([0, 2, 0], [0, -1, 0], deck)[0]?.point.y, .28, 'bridge walking surface');
    near(ray([0, -1, 0], [0, 1, 0], deck)[0]?.point.y, .10, 'bridge real underside');
    near(ray([0, 10, 0], [0, -1, 0], dome)[0]?.point.y, 8.62, 'dome outside crown');
    near(ray([0, 6.5, 0], [0, 1, 0], dome)[0]?.point.y, 8.50, 'dome inside crown stays above the room');
  } finally { wallG.dispose(); deckG.dispose(); domeG.dispose(); material.dispose(); }
});

test('the production maze keeps all 44 source wall lines and the raised octagonal pavilion', () => {
  const a = study(), cores = object(a, 'huanghuazhen-maze-wall-cores');
  assert.equal(cores.children.filter(node => node.isGroup).length, 44);
  assert.equal(object(a, 'huanghuazhen-traced-brick-maze').userData.wallHeight, 1.2);
  assert.equal(object(a, 'huanghuazhen-central-octagonal-pavilion').userData.cardinalPassages, 4);
  assert.ok(bounds(a, 'huanghuazhen-pavilion-complete-dome').max.y > 9.8);
  assert.ok(bounds(a, 'huanghuazhen-garden-gate-north-elevation').min.z > bounds(a, 'huanghuazhen-traced-brick-maze').max.z + 10);
  assert.equal(object(a, 'huanghuazhen-garden-gate-north-elevation').userData.facing, 'north');
});

test('actual mitered wall meshes preserve body clearance along all four previously recorded maze routes', () => {
  const a = study(), core = object(a, 'huanghuazhen-maze-wall-cores');
  const { routes } = JSON.parse(readFileSync(new URL('../../work/yuanmingyuan/maze-aviary-preparation/maze-route-audit.json', import.meta.url), 'utf8'));
  for (const route of routes) for (let i = 0; i + 1 < route.turns.length; i++) {
    const [x, z] = route.turns[i], [xx, zz] = route.turns[i + 1], length = Math.hypot(xx - x, zz - z), steps = Math.max(1, Math.ceil(length / .33));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, px = x + (xx - x) * t, pz = z + (zz - z) * t;
      for (let side = 0; side < 8; side++) {
        const angle = side * Math.PI / 4;
        assert.equal(ray([px + Math.cos(angle) * .47, 1.7, pz + Math.sin(angle) * .47], [0, -1, 0], core, 1.67).length, 0, `${route.entrance} route ${i}/${step}: actual wall miter clearance`);
      }
    }
  }
});

test('four entrance gates and the pavilion have real passages at pedestrian height', () => {
  const a = study();
  for (const name of ['north', 'west', 'east', 'south']) {
    const gate = object(a, `huanghuazhen-${name}-maze-gate`);
    for (const x of [-.47, 0, .47]) for (const y of [.70, 1.6, 2.15]) assert.equal(localRay([x, y, 2.0], [0, 0, -1], gate, 4).length, 0, `${name}: clear physical gate opening`);
  }
  const pavilion = object(a, 'huanghuazhen-central-octagonal-pavilion');
  for (const direction of [[1, 0, 0], [0, 0, 1]]) for (const offset of [-.47, 0, .47]) {
    const start = direction[0] ? [-8, 2.72, offset] : [offset, 2.72, -8];
    assert.equal(ray(start, direction, pavilion, 16).length, 0, 'pavilion is traversable through the occupied interior');
  }
  const gate = object(a, 'huanghuazhen-garden-gate-north-elevation');
  for (const x of [-.47, 0, .47]) assert.equal(localRay([x, 1.65, 2.0], [0, 0, -1], gate, 4).length, 0, 'garden gate leaves are held open');
});

test('all four pavilion stairs have grounded treads and join a solid floor without a large step', () => {
  const a = study(), platform = object(a, 'huanghuazhen-central-round-platform'), paving = object(a, 'huanghuazhen-garden-paving');
  for (let axis = 0; axis < 4; axis++) {
    const angle = axis * Math.PI / 2;
    let previous = 0;
    for (let radius = 7.35; radius > 0; radius -= .08) {
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const hits = [...ray([x, 1.35, z], [0, -1, 0], platform), ...ray([x, 1.35, z], [0, -1, 0], paving)].sort((a, b) => b.point.y - a.point.y);
      assert.ok(hits.length, `axis ${axis}: continuous ground/floor`); const y = hits[0].point.y;
      assert.ok(y - previous <= .195, `axis ${axis}: no hidden platform lip, ${previous} -> ${y}`); previous = y;
    }
    near(previous, 1.08, `axis ${axis}: platform floor`);
  }
  near(ray([0, .3, 6.94], [0, -1, 0], platform)[0]?.point.y, .18, 'first step height');
  assert.ok(ray([0, -.20, 6.94], [0, 1, 0], platform)[0]?.point.y < 0, 'first stair has a solid grounded underside');
});

test('the water channels are cut out of paving and bridges retain thick decks above receiving water', () => {
  const a = study(), paving = object(a, 'huanghuazhen-garden-paving');
  for (const [x, z, name] of [[20, 40.5, 'huanghuazhen-perimeter-moat'], [12, 48.9, 'huanghuazhen-garden-gate-channel']]) {
    assert.equal(ray([x, 2, z], [0, -1, 0], paving).length, 0);
    const hits = ray([x, 2, z], [0, -1, 0], object(a, name));
    near(hits.find(hit => category(hit) === 'water')?.point.y, -.30, `${name}: surface`);
    near(hits.find(hit => category(hit) === 'stone')?.point.y, -.75, `${name}: submerged floor`);
  }
  near(ray([0, 2, 48.9], [0, -1, 0], object(a, 'huanghuazhen-garden-gate-bridge'))[0]?.point.y, .28, 'bridge deck at the arch crown');
});

test('all production vertices, normals, owned resources and native view names are auditable', t => { const a = study(); assertOwnedAsset(a, t); assertViewsResolve(a, huanghuazhenStudyViews); });

test('the study records uncertainties and animates only its own surface textures', () => {
  const a = study(), water = [...resources(a.group).materials].find(material => material.userData.role === 'surface');
  assert.ok(a.diagnostics.provisionalScale.isProvisional); assert.equal(a.diagnostics.visualAcceptance, false); assert.equal(a.diagnostics.integrationAcceptance, false);
  assert.ok(a.diagnostics.uncertainty.some(text => text.includes('scale'))); const before = water.normalMap.offset.clone(); a.update(3.2); assert.notDeepEqual(water.normalMap.offset, before); a.update(0);
});

test('full study resources dispose once and a later factory invocation owns independent resources', () => { assertInstanceReplacement(study(), createHuanghuazhenStudy); asset = undefined; });
