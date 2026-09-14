import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPineShootLodSource, pineShootGeometryFingerprint } from '../src/yuanmingyuan/pine-shoot-lod.js';
import { createPineShootRibbonGeometry, createPineShootRibbonPilot } from '../src/yuanmingyuan/pine-shoot-lod-ribbons.js';

let source, pilot;
before(async () => { source = createPineShootLodSource(); pilot = await createPineShootRibbonPilot(source); });
after(() => { pilot?.dispose(); source?.dispose(); });

test('R3 retains the full source and every original wood triangle in source order', async () => {
  assert.equal((await pineShootGeometryFingerprint(source.geometry)).sha256, '784e8c63493069d2cf3cf7b4d526beb1db1b560c0414b561ad6c2f6c3059e718');
  const { geometry, components } = pilot.baked, original = source.geometry;
  assert.equal(geometry.index.count / 3, 2320);
  const woods = components.filter(c => c.kind === 'wood'); assert.equal(woods.length, 6);
  assert.equal(woods.reduce((n, c) => n + c.indexCount / 3, 0), 480);
  for (const wood of woods) for (let k = 0; k < wood.indexCount; k++) {
    const a = original.index.getX(wood.sourceTriangle * 3 + k), b = geometry.index.getX(wood.firstIndex + k);
    for (const [name, attr] of Object.entries(original.attributes)) for (let n = 0; n < attr.itemSize; n++) assert.equal(geometry.attributes[name].array[b * attr.itemSize + n], attr.array[a * attr.itemSize + n]);
  }
  assert.ok(components.every((c, i) => i === 0 || c.sourceTriangle > components[i - 1].sourceTriangle));
});

test('460 real needles keep exact root, midpoint, tip, widths, vertex colors and normals', () => {
  const { geometry, sourceVertices, components } = pilot.baked, original = source.geometry;
  assert.equal(components.filter(c => c.kind === 'needle').length, 460);
  for (const [name, attr] of Object.entries(original.attributes)) {
    const dst = geometry.attributes[name]; assert.notEqual(dst.array.buffer, attr.array.buffer);
    sourceVertices.forEach((id, i) => { for (let k = 0; k < attr.itemSize; k++) assert.equal(dst.array[i * attr.itemSize + k], attr.array[id * attr.itemSize + k]); });
  }
  const retained = new Set(sourceVertices);
  for (const leaf of pilot.baked.partition.needles) for (const row of [0, 2, 4]) for (const side of [0, 1]) assert.ok(retained.has(leaf.vertices[row * 2 + side]));
  assert.ok(source.bounds.clone().expandByScalar(1e-7).containsBox(geometry.boundingBox));
  assert.equal(pilot.diagnostics.displacement.maximum < .0026, true);
  assert.equal(pilot.diagnostics.displacement.maximum > .0025, true);
});

test('actual coarse needle surfaces remain continuous under independent Three rays along the original needle', () => {
  const original = source.geometry, actual = pilot.baked.geometry, material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), caster = new THREE.Raycaster(), position = original.attributes.position, normals = original.attributes.normal;
  const scratch = new THREE.BufferGeometry(); scratch.setAttribute('position', actual.attributes.position); const mesh = new THREE.Mesh(scratch, material); mesh.updateMatrixWorld(true);
  let hits = 0, furthestDisplacement = 0;
  try {
    for (const component of pilot.baked.components.filter(c => c.kind === 'needle')) {
      const indices = Array.from(actual.index.array.slice(component.firstIndex, component.firstIndex + component.indexCount));
      // Both adjacent segments use the exact same midpoint edge, in opposite
      // directions. A ray exactly on this edge can miss on the unchanged source
      // too (recorded component 160); test the shared indices and both sides.
      assert.equal(indices[4], indices[7]); assert.equal(indices[5], indices[6]);
      scratch.setIndex(indices); scratch.computeBoundingSphere();
      for (const t of [.01, .125, .25, .375, .49999, .50001, .625, .75, .875, .99]) {
        const row = Math.min(3, Math.floor(t * 4)), f = t * 4 - row;
        const centreAt = r => new THREE.Vector3().fromBufferAttribute(position, component.sourceVertices[r * 2]).add(new THREE.Vector3().fromBufferAttribute(position, component.sourceVertices[r * 2 + 1])).multiplyScalar(.5);
        const p = centreAt(row).lerp(centreAt(row + 1), f), n = new THREE.Vector3().fromBufferAttribute(normals, component.sourceVertices[row * 2]).lerp(new THREE.Vector3().fromBufferAttribute(normals, component.sourceVertices[(row + 1) * 2]), f).normalize();
        caster.set(p.clone().addScaledVector(n, .03), n.clone().negate()); const hit = caster.intersectObject(mesh)[0];
        assert.ok(hit, 'missing needle interior at source component ' + component.sourceTriangle + ' t=' + t);
        const displacement = Math.abs(hit.distance - .03); assert.ok(displacement < .0027); furthestDisplacement = Math.max(furthestDisplacement, displacement); hits++;
      }
    }
    assert.equal(hits, 4600); assert.ok(furthestDisplacement > .0024);
  } finally { scratch.dispose(); material.dispose(); }
});

test('source and ribbons use real vertex normal and geometric coverage for PBR, AO and shadows', () => {
  const mesh = pilot.mesh, list = [mesh.material, mesh.customDepthMaterial, mesh.customDistanceMaterial, mesh.userData.pineShootNormalMaterial];
  assert.equal(pilot.textures.length, 0); assert.equal(pilot.diagnostics.textureBytes, 0); assert.equal(pilot.diagnostics.candidateDraws, 1);
  for (const material of list) { assert.equal(material.side, THREE.DoubleSide); assert.equal(material.normalMap ?? null, null); assert.equal(material.map ?? null, null); assert.equal(material.alphaTest, 0); }
  assert.equal(mesh.material.vertexColors, true); assert.equal(mesh.material.alphaToCoverage, false); assert.ok(mesh.castShadow && mesh.receiveShadow);
  assert.equal(mesh.material.roughness, source.mesh.material.roughness); assert.deepEqual(mesh.material.emissive.toArray(), source.mesh.material.emissive.toArray());
  assert.equal(mesh.material.emissiveIntensity, source.mesh.material.emissiveIntensity);
});

test('actual geometric double-sided facing stays close to source around and below the shoot', () => {
  const sourcePos = source.geometry.attributes.position, sourceIndex = source.geometry.index, actual = pilot.baked.geometry;
  const vec = (p, i) => new THREE.Vector3().fromBufferAttribute(p, i);
  const eyes = [-.65, .1, .8].flatMap(y => Array.from({ length: 12 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 6) * 4, y, Math.sin(i * Math.PI / 6) * 4)));
  for (const eye of eyes) {
    let area = 0, reverse = 0;
    for (const component of pilot.baked.components.filter(c => c.kind === 'needle')) for (let strip = 0; strip < 4; strip++) for (let tri = 0; tri < 2; tri++) {
      const si = (component.sourceTriangle + strip * 2 + tri) * 3, pts = [0, 1, 2].map(k => vec(sourcePos, sourceIndex.getX(si + k))), centre = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(3), view = eye.clone().sub(centre).normalize(), normal = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));
      const ai = component.firstIndex + Math.floor(strip / 2) * 6 + tri * 3, q = [0, 1, 2].map(k => vec(actual.attributes.position, actual.index.getX(ai + k))), an = q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));
      const projected = Math.abs(normal.dot(view)); area += projected; if (normal.dot(view) * an.dot(view) < 0) reverse += projected;
    }
    assert.ok(reverse / area < .01, 'geometric facing discrepancy at ' + eye.toArray() + ': ' + reverse / area);
  }
});

test('positive rotated non-uniform instance normals use the same exact TRS path as real vertex normals', () => {
  const sourceNormal = source.geometry.attributes.normal, instances = [[.4, 1.1, -.3, .6, 1.4, 2.1], [-.8, -.3, 1.6, 2.2, .5, 1.3]];
  for (const [x, y, z, sx, sy, sz] of instances) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)), new THREE.Vector3(sx, sy, sz)), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), linear = new THREE.Matrix3().setFromMatrix4(matrix), cols = [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(matrix, i).lengthSq());
    for (let i = 0; i < sourceNormal.count; i += 29) {
      const n = new THREE.Vector3().fromBufferAttribute(sourceNormal, i), expected = n.clone().applyMatrix3(normalMatrix).normalize(), actual = n.clone().divide(new THREE.Vector3(...cols)).applyMatrix3(linear).normalize();
      assert.ok(actual.distanceTo(expected) < 1e-12);
    }
  }
  // The candidate has no object-space normal texture that would override this
  // vertex-stage result. Negative determinants/shear are not certified here.
  assert.equal(pilot.mesh.material.normalMap, null);
});

test('coarser one-segment alternative records its larger actual geometric error', () => {
  const coarse = createPineShootRibbonGeometry(source.geometry, { segments: 1 });
  try { assert.equal(coarse.geometry.index.count / 3, 1400); assert.ok(coarse.diagnostics.displacement.maximum > .008); assert.ok(coarse.diagnostics.displacement.maximum < .0084); }
  finally { coarse.dispose(); }
});

test('R3 abort, transition and idempotent disposal preserve the caller-owned complete source', async () => {
  const abort = new AbortController(); abort.abort(); await assert.rejects(createPineShootRibbonPilot(source, { signal: abort.signal }), /abort/i);
  const other = await createPineShootRibbonPilot(source); let sourceDisposed = 0; const track = () => sourceDisposed++; source.geometry.addEventListener('dispose', track);
  const counts = new Map([other.baked.geometry, ...other.materials].map(r => [r, 0])); for (const resource of counts.keys()) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  try {
    assert.deepEqual(other.setMode('blend', 0), { mode: 'blend', phase: 0, sourceVisible: true, lowVisible: false }); other.setMode('blend', .5); assert.ok(source.group.visible && other.group.visible);
    assert.deepEqual(other.setMode('blend', 1), { mode: 'blend', phase: 1, sourceVisible: false, lowVisible: true });
    assert.throws(() => other.assertMainSceneAllowed(), /no native/); other.dispose(); other.dispose();
    assert.ok([...counts.values()].every(n => n === 1)); assert.equal(sourceDisposed, 0); assert.equal(source.group.visible, true); assert.equal(source.transition.role.value, 0);
  } finally { other.dispose(); source.geometry.removeEventListener('dispose', track); }
});
