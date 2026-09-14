import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPineShootLodSource, createPineShootLodPilot, pineShootGeometryFingerprint, pineShootSha256 } from '../src/yuanmingyuan/pine-shoot-lod.js';
import { partitionPineShoot, bakePineShootLod } from '../src/yuanmingyuan/pine-shoot-lod-baker.js';
import { PINE_SHOOT_ALPHA_TEST, pineShootCoverageAt } from '../src/yuanmingyuan/pine-shoot-lod-materials.js';
import { renderPineShootNormalBuffer } from '../src/yuanmingyuan/pine-shoot-lod-rendering.js';
import { savePineShootCapture } from '../src/yuanmingyuan/pine-shoot-lod-studio-state.js';

let source, pilot, fingerprint;
before(async () => { source = createPineShootLodSource(); fingerprint = await pineShootGeometryFingerprint(source.geometry); pilot = await createPineShootLodPilot(source); });
after(() => { pilot?.dispose(); source?.dispose(); });

test('real source remains the complete unchanged seed-218 shoot', async () => {
  assert.equal(fingerprint.sha256, '784e8c63493069d2cf3cf7b4d526beb1db1b560c0414b561ad6c2f6c3059e718');
  assert.equal((await pineShootGeometryFingerprint(source.geometry)).sha256, fingerprint.sha256);
  assert.equal(source.geometry.index.count / 3, 4160); assert.equal(source.diagnostics.completeTreeConstructed, false);
  assert.equal(pilot.diagnostics.sourceFingerprint.sha256, fingerprint.sha256);
});

test('every actual needle component belongs to exactly one normal family', () => {
  const parts = partitionPineShoot(source.geometry), triangles = [...parts.wood, ...parts.needles].flatMap(p => p.triangles);
  assert.equal(parts.needles.length, 460); assert.equal(parts.wood.length, 6); assert.equal(triangles.length, 4160); assert.equal(new Set(triangles).size, 4160);
  assert.deepEqual(['xy', 'zy', 'xz'].map(id => parts.families.filter(f => f.basisId === id).reduce((n, f) => n + f.needles.length, 0)), [63, 84, 313]);
  assert.deepEqual(parts.wood.map((_, i) => parts.needles.filter(n => n.branch === i).length), [56, 76, 82, 88, 76, 82]);
  const ids = parts.families.flatMap(f => f.needles.map(n => n.vertices[0]));
  assert.equal(ids.length, 460); assert.equal(new Set(ids).size, 460);
  assert.ok(parts.needles.every(n => n.alignment >= 1 / Math.sqrt(3) - 1e-12));
});

test('all 480 original wood triangles retain their source vertex attributes', () => {
  const original = source.geometry, copied = pilot.baked.woodGeometry, triangles = pilot.baked.partition.wood.flatMap(p => p.triangles);
  assert.equal(copied.index.count / 3, 480);
  triangles.forEach((t, i) => {
    for (let k = 0; k < 3; k++) for (const name of ['position', 'normal', 'color', 'uv']) {
      const a = original.attributes[name], b = copied.attributes[name], ai = original.index.getX(t * 3 + k), bi = copied.index.getX(i * 3 + k);
      for (let c = 0; c < a.itemSize; c++) assert.equal(b.array[bi * b.itemSize + c], a.array[ai * a.itemSize + c]);
    }
  });
  assert.notEqual(copied.attributes.position.array.buffer, original.attributes.position.array.buffer);
});

test('branch-local folded families have matching oppositely wound physical front/back faces', () => {
  const g = pilot.baked.cardGeometry, p = g.attributes.position, i = g.index;
  assert.equal(i.count / 3, 272); assert.equal(pilot.diagnostics.totalTriangles, 752);
  const perFace = 9, perFamily = 18, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < pilot.diagnostics.families.length; f++) {
    for (let n = 0; n < perFace; n++) for (let k = 0; k < 3; k++) assert.equal(p.array[(f * perFamily + n) * 3 + k], p.array[(f * perFamily + perFace + n) * 3 + k]);
    for (let signIndex = 0; signIndex < 2; signIndex++) {
      const triangleStart = (f * 2 + signIndex) * 8 * 3, expected = pilot.baked.partition.families[f].n.clone().multiplyScalar(signIndex ? -1 : 1);
      for (let t = triangleStart; t < triangleStart + 24; t += 3) {
        a.fromBufferAttribute(p, i.getX(t)); b.fromBufferAttribute(p, i.getX(t + 1)); c.fromBufferAttribute(p, i.getX(t + 2));
        assert.ok(b.sub(a).cross(c.sub(a)).dot(expected) > 1e-12);
      }
    }
  }
  assert.ok(source.bounds.clone().expandByScalar(1e-7).containsBox(g.boundingBox));
});

test('baked fractional alpha agrees with independent Three ray intersections of source triangles', () => {
  const { tileSize: size, samples, gutter } = pilot.diagnostics, maps = pilot.baked.maps, parts = pilot.baked.partition;
  const full = source.geometry, temporary = [], material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), caster = new THREE.Raycaster();
  let tested = 0, partlyCovered = 0;
  try {
    for (let fi = 0; fi < parts.families.length; fi++) {
      const family = parts.families[fi], g = new THREE.BufferGeometry(); temporary.push(g);
      g.setAttribute('position', full.attributes.position); g.setIndex(family.triangles.flatMap(t => [0, 1, 2].map(k => full.index.getX(t * 3 + k)))); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material); mesh.updateMatrixWorld(true);
      for (const sign of [1, -1]) {
        const tile = fi * 2 + (sign === 1 ? 0 : 1), tx = tile % maps.columns, ty = Math.floor(tile / maps.columns);
        const pixels = [];
        for (let y = gutter; y < size - gutter; y++) for (let x = gutter; x < size - gutter; x++) {
          const alpha = maps.base[((ty * size + y) * maps.width + tx * size + x) * 4 + 3];
          if (alpha) pixels.push([x, y, alpha]);
        }
        for (let n = 0; n < 24; n++) {
          const [x, y, alpha] = pixels[Math.floor((n + .37) * pixels.length / 24)]; let hits = 0;
          for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
            const u = ((x * samples + sx + .5) - gutter * samples) / ((size - gutter * 2) * samples), v = ((y * samples + sy + .5) - gutter * samples) / ((size - gutter * 2) * samples);
            const origin = new THREE.Vector3().addScaledVector(family.u, THREE.MathUtils.lerp(family.bounds.min[0], family.bounds.max[0], u)).addScaledVector(family.v, THREE.MathUtils.lerp(family.bounds.min[1], family.bounds.max[1], v)).addScaledVector(family.n, sign > 0 ? family.bounds.max[2] + 1 : family.bounds.min[2] - 1);
            caster.set(origin, family.n.clone().multiplyScalar(-sign)); if (caster.intersectObject(mesh).length) hits++;
          }
          assert.equal(alpha, Math.round(hits / samples ** 2 * 255)); tested++; if (alpha < 255) partlyCovered++;
        }
      }
    }
    assert.equal(tested, parts.families.length * 48); assert.ok(partlyCovered > 20);
  } finally { temporary.forEach(g => g.dispose()); material.dispose(); }
});

test('normal atlas encodes finite unit vectors in source object space on both sides', () => {
  const { base, normal, width, columns } = pilot.baked.maps, { tileSize: size } = pilot.diagnostics;
  for (let fi = 0; fi < pilot.diagnostics.families.length; fi++) for (const sign of [1, -1]) {
    const tile = fi * 2 + (sign === 1 ? 0 : 1), tx = tile % columns, ty = Math.floor(tile / columns), n = pilot.baked.partition.families[fi].n;
    for (let y = 0; y < size; y += 3) for (let x = 0; x < size; x += 3) {
      const offset = ((ty * size + y) * width + tx * size + x) * 4; if (!base[offset + 3]) continue;
      const v = new THREE.Vector3(...normal.subarray(offset, offset + 3)).multiplyScalar(2 / 255).subScalar(1);
      assert.ok(Math.abs(v.length() - 1) < .008); assert.ok(v.dot(n) * sign >= -.008);
    }
  }
});

test('PBR, cutout shadow, point distance and normal/depth share the real atlas and cutoff', () => {
  const mesh = pilot.cards, set = [mesh.material, mesh.customDepthMaterial, mesh.customDistanceMaterial], base = pilot.textures[0], normal = pilot.textures[1], normalMaterial = mesh.userData.pineShootNormalMaterial;
  assert.ok(mesh.castShadow && mesh.receiveShadow); assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.alphaToCoverage, true);
  assert.equal(mesh.material.normalMap, normal); assert.equal(mesh.material.normalMapType, THREE.ObjectSpaceNormalMap);
  for (const m of set) { assert.equal(m.map, base); assert.equal(m.alphaTest, PINE_SHOOT_ALPHA_TEST); assert.equal(m.side, THREE.FrontSide); }
  assert.equal(normalMaterial.normalMap, normal);
  const shader = { vertexShader: THREE.ShaderLib.normal.vertexShader, fragmentShader: THREE.ShaderLib.normal.fragmentShader, uniforms: {} };
  normalMaterial.onBeforeCompile(shader, {});
  assert.equal(shader.uniforms.pineCoverageMap.value, base); assert.equal(shader.uniforms.pineCoverageThreshold.value, PINE_SHOOT_ALPHA_TEST);
  assert.match(shader.fragmentShader, /texture2D\(pineCoverageMap, vNormalMapUv\)\.a/); assert.match(shader.fragmentShader, /pineLodRole/);
  assert.equal(base.colorSpace, THREE.SRGBColorSpace); assert.equal(normal.colorSpace, THREE.NoColorSpace); assert.ok(base.generateMipmaps);
});

test('LOD endpoints draw exactly one representation and in-between masks complement', () => {
  assert.deepEqual(pilot.setMode('blend', 0), { mode: 'blend', phase: 0, sourceVisible: true, lowVisible: false });
  assert.deepEqual(pilot.setMode('blend', 1), { mode: 'blend', phase: 1, sourceVisible: false, lowVisible: true });
  pilot.setMode('blend', .5); assert.ok(source.group.visible && pilot.group.visible);
  for (const phase of [0, .25, .5, .75, 1]) for (let y = 0; y < 19; y++) for (let x = 0; x < 23; x++) assert.equal(Number(pineShootCoverageAt(x, y, phase, -1)) + Number(pineShootCoverageAt(x, y, phase, 1)), 1);
  pilot.setMode('source'); assert.throws(() => pilot.setMode('blend', 2), /Invalid/);
  assert.throws(() => pilot.assertMainSceneAllowed(), /no native/);
});

test('normal GBuffer uses alpha-aware material and restores renderer/scene after failure', () => {
  const scene = new THREE.Scene(), original = new THREE.MeshStandardMaterial(), special = new THREE.MeshNormalMaterial(), fallback = new THREE.MeshNormalMaterial(), geometry = new THREE.BoxGeometry();
  const mesh = new THREE.Mesh(geometry, original), water = new THREE.Mesh(geometry, original); mesh.userData.pineShootNormalMaterial = special; water.isWater = true; scene.add(mesh, water);
  const background = scene.background = new THREE.Color('#123456'), override = scene.overrideMaterial = new THREE.MeshBasicMaterial(), target = {}, beforeTarget = {};
  let bound = beforeTarget, clear = new THREE.Color('#654321'), alpha = .4;
  const renderer = { autoClear: true, shadowMap: { autoUpdate: true, needsUpdate: true }, getRenderTarget: () => bound, setRenderTarget: x => { bound = x; }, getClearColor: target => target.copy(clear), getClearAlpha: () => alpha, setClearColor: (x, a) => { clear = new THREE.Color(x); alpha = a; }, clear() {}, render() { assert.equal(mesh.material, special); assert.equal(water.visible, false); assert.equal(scene.overrideMaterial, null); assert.equal(this.shadowMap.needsUpdate, false); throw new Error('injected render failure'); } };
  try {
    assert.throws(() => renderPineShootNormalBuffer({ renderer, scene, camera: new THREE.PerspectiveCamera(), target, fallbackMaterial: fallback }), /injected/);
    assert.equal(mesh.material, original); assert.equal(water.visible, true); assert.equal(scene.background, background); assert.equal(scene.overrideMaterial, override); assert.equal(bound, beforeTarget);
    assert.equal(renderer.autoClear, true); assert.deepEqual(renderer.shadowMap, { autoUpdate: true, needsUpdate: true }); assert.equal(clear.getHex(), 0x654321); assert.equal(alpha, .4);
  } finally { geometry.dispose(); [original, special, fallback, override].forEach(m => m.dispose()); }
});

test('aborted small bake never mutates the retained source', async () => {
  const controller = new AbortController(); let yields = 0;
  await assert.rejects(bakePineShootLod(source.geometry, { tileSize: 32, samples: 1, gutter: 2, signal: controller.signal, yieldControl: async () => { if (++yields === 2) controller.abort(); } }), /abort/i);
  assert.equal((await pineShootGeometryFingerprint(source.geometry)).sha256, fingerprint.sha256);
  assert.throws(() => partitionPineShoot(new THREE.BoxGeometry()), /real indexed/);
});

test('native capture freezes metadata before encoding and retains partial writes', async () => {
  let state = 1; const writes = [], canvas = { toBlob(done) { state = 2; done(new Blob(['PNG'], { type: 'image/png' })); } };
  const metadata = () => ({ createdAt: '2026-09-12T00:00:00.000Z', sequence: 1, sourceIdentity: { sha256: 'a'.repeat(64) }, state: { mode: 'low', phase: 0 }, view: 'front', light: 'day', output: 'beauty', water: false, retainedFrame: state });
  const capture = await savePineShootCapture({ canvas, render() {}, metadata, upload: async (filename, data) => writes.push({ filename, data }) });
  assert.equal(capture.record.retainedFrame, 1); assert.equal(writes.length, 2); assert.equal(JSON.parse(await writes[1].data.text()).retainedFrame, 1);
  await assert.rejects(savePineShootCapture({ canvas, render() {}, metadata, upload: async filename => { if (filename.endsWith('.json')) throw new Error('disk failure'); } }), error => error.message === 'disk failure' && error.retainedFiles.length === 1 && error.retainedFiles[0].endsWith('.png'));
});

test('candidate disposal is idempotent and never disposes the caller-owned source', async () => {
  const other = await createPineShootLodPilot(source, { tileSize: 32, samples: 1, gutter: 2 });
  let sourceDisposed = 0; const count = () => sourceDisposed++; source.geometry.addEventListener('dispose', count);
  const seen = new Map(); for (const resource of [other.baked.woodGeometry, other.baked.cardGeometry, ...other.textures, ...other.materials]) { seen.set(resource, 0); resource.addEventListener('dispose', () => seen.set(resource, seen.get(resource) + 1)); }
  other.dispose(); other.dispose(); assert.ok([...seen.values()].every(v => v === 1)); assert.equal(sourceDisposed, 0); source.geometry.removeEventListener('dispose', count);
  assert.equal((await pineShootGeometryFingerprint(source.geometry)).sha256, fingerprint.sha256);
});

test('atlas byte identities are reproducible on a tiny real-source bake', async () => {
  const a = await bakePineShootLod(source.geometry, { tileSize: 32, samples: 1, gutter: 2 }), b = await bakePineShootLod(source.geometry, { tileSize: 32, samples: 1, gutter: 2 });
  try { assert.equal(await pineShootSha256(a.maps.base), await pineShootSha256(b.maps.base)); assert.equal(await pineShootSha256(a.maps.normal), await pineShootSha256(b.maps.normal)); }
  finally { a.dispose(); b.dispose(); }
});
