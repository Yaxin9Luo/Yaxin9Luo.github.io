import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hipRoofTileGeometry } from '../src/yuanmingyuan/fangwaiguan-geometry.js';

// Small fixtures can run while another asset owns the complete-factory slot.
function inspectClosedTile(geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, edges = new Map(); let volume = 0;
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
  const vertex = i => new THREE.Vector3().fromBufferAttribute(p, i);
  for (let i = 0; i < p.count; i += 3) {
    const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
    assert.ok(a.toArray().concat(b.toArray(), c.toArray()).every(Number.isFinite));
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-14, 'no collapsed triangle');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const from = key(i + j), to = key(i + (j + 1) % 3), id = [from, to].sort().join('/');
      if (!edges.has(id)) edges.set(id, []); edges.get(id).push([from, to]);
      assert.ok(Math.abs(vertex(i + j).length()) < 30);
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, i + j).length() - 1) < 1e-5);
    }
  }
  for (const uses of edges.values()) {
    assert.equal(uses.length, 2, 'each physical edge belongs to two faces');
    assert.equal(uses[0][0], uses[1][1], 'faces share the edge with opposite winding');
    assert.equal(uses[0][1], uses[1][0]);
  }
  assert.ok(volume > 1e-7, 'closed tile has positive material volume');
}

test('individual barrel and pan tiles stay watertight on all hips, including the narrow ridge end', () => {
  const roof = { width: 11.86, depth: 4.65, topWidth: 8.10, topDepth: .10, eaveY: 11.63, topY: 12.76 };
  for (let side = 0; side < 4; side++) for (const barrel of [false, true]) for (const [t0, t1] of [[0, .23], [.8, 1]]) {
    const geometry = hipRoofTileGeometry(roof, { side, barrel, u0: .48, u1: .50, t0, t1, overlap: t0 > 0 });
    try { inspectClosedTile(geometry); } finally { geometry.dispose(); }
  }
});

test('a real course lap rises above the lower pan, overlaps it and retains clay thickness', () => {
  const roof = { width: 4, depth: 4, topWidth: 4, topDepth: 2, eaveY: 0, topY: 0, curve: 0 };
  const material = new THREE.MeshBasicMaterial(), group = new THREE.Group();
  const lower = new THREE.Mesh(hipRoofTileGeometry(roof, { side: 0, u0: .475, u1: .525, t0: 0, t1: .575 }), material);
  const upper = new THREE.Mesh(hipRoofTileGeometry(roof, { side: 0, u0: .475, u1: .525, t0: .5, t1: 1, overlap: true }), material);
  group.add(lower, upper); group.updateMatrixWorld(true);
  const hit = (z, mesh, below = false) => new THREE.Raycaster(new THREE.Vector3(0, below ? -1 : 1, z), new THREE.Vector3(0, below ? 1 : -1, 0)).intersectObject(mesh, true)[0];
  try {
    const before = hit(1.51, group), after = hit(1.49, group);
    assert.ok(before && after); assert.equal(before.object, lower); assert.equal(after.object, upper);
    assert.ok(after.point.y - before.point.y > .010 && after.point.y - before.point.y < .013, 'the lap is actual height, not a painted seam');
    const lowTop = hit(1.45, lower), upperBottom = hit(1.45, upper, true);
    assert.ok(lowTop && upperBottom && upperBottom.point.y < lowTop.point.y, 'the uphill tile physically bears on the preceding tile');
    assert.ok(Math.abs(hit(1.25, upper).point.y - hit(1.25, upper, true).point.y - .012) < 1e-6, 'tile has a closed 12 mm clay body');
  } finally { lower.geometry.dispose(); upper.geometry.dispose(); material.dispose(); }
});
