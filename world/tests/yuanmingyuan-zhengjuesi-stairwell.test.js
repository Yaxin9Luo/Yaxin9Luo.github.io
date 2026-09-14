import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { namedGroup } from '../src/yuanmingyuan/study-geometry.js';
import { ZhengjuesiBuilder } from '../src/yuanmingyuan/zhengjuesi-architecture.js';
import { zhengjuesiPlan } from '../src/yuanmingyuan/zhengjuesi-layout.js';

// Run the exact private stair builder in isolation, without constructing the
// heavy roof or changing the frozen module's public API merely for a test.
const source = readFileSync(new URL('../src/yuanmingyuan/zhengjuesi-study.js', import.meta.url), 'utf8');
const body = source.match(/function upperFloorAndStair\(b, parent, spec\) \{[\s\S]*?(?=\nfunction rearAnnex\()/)?.[0];
assert.ok(body, 'The bounded actual stair function must remain identifiable.');
const rectangle = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
const build = new Function('THREE', 'namedGroup', 'rectangle', `${body}\nreturn upperFloorAndStair;`)(THREE, namedGroup, rectangle);

test('actual Zuishang floor is an outward closed volume around the open stairwell', () => {
  const b = new ZhengjuesiBuilder(), root = new THREE.Group(), spec = zhengjuesiPlan.axis[4]; let material;
  try {
    build(b, root, spec); b.flush();
    const geometry = [...b.geometries][0], p = geometry.attributes.position, index = geometry.index, ids = i => index ? index.getX(i) : i, edges = new Map(), key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e5)).join(',');
    let volume = 0;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const [a, c, d] = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, ids(i + j))); assert.ok(c.clone().sub(a).cross(d.clone().sub(a)).lengthSq() > 1e-15); volume += a.dot(c.clone().cross(d)) / 6;
      const points = [0, 1, 2].map(j => key(ids(i + j)));
      for (let j = 0; j < 3; j++) { const a = points[j], c = points[(j + 1) % 3], k = [a, c].sort().join('|'); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(a < c ? 1 : -1); }
    }
    for (const [edge, signs] of edges) assert.deepEqual(signs.sort(), [-1, 1], `floor edge winding ${edge}`);
    const expected = ((spec.width - .30) * (spec.depth - .30) - (14.5 - 10.95) * (4.8 + 1.8)) * .20;
    assert.ok(Math.abs(volume - expected) < 1e-3, `${volume} vs ${expected}`);
    material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide }); const mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
    const floorY = spec.floor + spec.floorLevel, insideY = floorY - .10;
    const cast = (p, d) => new THREE.Raycaster(new THREE.Vector3(...p), new THREE.Vector3(...d)).intersectObject(mesh)[0];
    assert.equal(cast([12.7, floorY + 1, 2], [0, -1, 0]), undefined, 'hole capped by floor');
    for (const [d, normal] of [[[1, 0, 0], [-1, 0, 0]], [[-1, 0, 0], [1, 0, 0]], [[0, 0, 1], [0, 0, -1]], [[0, 0, -1], [0, 0, 1]]]) {
      const hit = cast([12.7, insideY, 2], d); assert.ok(hit, 'a hole wall is back-facing from the opening'); assert.ok(hit.face.normal.dot(new THREE.Vector3(...normal)) > .999);
    }
    assert.ok(cast([0, floorY + 1, 0], [0, -1, 0]).face.normal.y > .999);
    assert.ok(cast([0, floorY - 1, 0], [0, 1, 0]).face.normal.y < -.999);
  } finally { b.dispose(); material?.dispose(); root.clear(); }
});

test('upper opening rails leave the actual stair exit clear and protect the other edges', () => {
  const b = new ZhengjuesiBuilder(), root = new THREE.Group(), spec = zhengjuesiPlan.axis[4];
  try {
    build(b, root, spec); b.flush(); root.updateMatrixWorld(true);
    const rails = root.getObjectByName(`${spec.id}-stair-opening-rails`), y = spec.floor + spec.floorLevel + .93;
    assert.ok(rails);
    const cast = (origin, direction) => new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, 1).intersectObject(rails, true);
    for (const x of [13.2, 13.74, 14.28]) assert.equal(cast([x, y, 4.30], [0, 0, 1]).length, 0, 'upper stair exit is blocked');
    for (const [origin, direction] of [ [[12, y, -1.4], [0, 0, -1]], [[11.2, y, 1], [-1, 0, 0]], [[14.1, y, 1], [1, 0, 0]], [[12, y, 4.30], [0, 0, 1]] ]) assert.ok(cast(origin, direction).length, 'opening edge lacks a rail');
  } finally { b.dispose(); root.clear(); }
});
