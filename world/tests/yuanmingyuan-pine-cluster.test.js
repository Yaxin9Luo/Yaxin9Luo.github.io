import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { PINE_CLUSTER_RECORDS } from '../src/yuanmingyuan/pine-cluster-records.js';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { loadPineClusterBake, pineClusterSha256 } from '../src/yuanmingyuan/pine-cluster-io.js';
import { rasterPineClusterTriangle, pineClusterPolygonArea, pineClusterUnionArea, pineClusterCoverageMip, bakePineCluster } from '../src/yuanmingyuan/pine-cluster-baker.js';
import { transformPineClusterNormal, pineClusterCoverageHash, pineClusterWeightedCoverage } from '../src/yuanmingyuan/pine-cluster-materials.js';
import { createPineClusterPilot } from '../src/yuanmingyuan/pine-cluster-pilot.js';
import { PINE_CLUSTER_VIEWS, pineClusterStudioIdentity, savePineClusterCapture } from '../src/yuanmingyuan/pine-cluster-studio-state.js';

const directory = new URL('../public/assets/pine-cluster-r2/', import.meta.url);
const fetcher = async url => { try { return new Response(await readFile(new URL(url.split('/').at(-1), directory))); } catch { return new Response('', { status: 404 }); } };
const source = createPineClusterSource(), baked = await loadPineClusterBake({ fetcher }), pilot = await createPineClusterPilot(source, { baked });
after(() => { pilot.dispose(); source.dispose(); });

test('saved actual branch records replay exactly without constructing a full tree', () => {
  const result = JSON.parse(execFileSync(process.execPath, [new URL('../scripts/pine-cluster-record.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' }));
  assert.equal(result.completeTreeConstructed, false); assert.equal(result.recordCounts.liveShoots, 3276); assert.equal(result.recordCounts.instancedShoots, 3275); assert.equal(result.recordCounts.detailMeshes, 1); assert.equal(result.recordCounts.branchCalls, 956); assert.equal(result.resourcesDisposed, 3);
  assert.equal(new Set(source.records.shoots.map(r => r.id)).size, 28); assert.equal(source.records.branches.length, 8);
});

test('source retains all 27 original Float32 instances plus the actual detail Mesh', () => {
  const matrix = new THREE.Matrix4(); let count = 0;
  for (const mesh of source.meshes.filter(m => m.userData.sourceRecordIds)) {
    for (let i = 0; i < mesh.userData.sourceRecordIds.length; i++) {
      const record = source.records.shoots.find(r => r.id === mesh.userData.sourceRecordIds[i]);
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, matrix); assert.deepEqual(matrix.elements, record.matrix); assert.equal(mesh.instanceColor.getX(i), record.tint); }
      else { assert.equal(record.kind, 'Mesh'); assert.ok(matrix.fromArray(record.matrix).elements.every((v, j) => Math.abs(v - mesh.matrix.elements[j]) < 1e-14)); }
      count++;
    }
  }
  assert.equal(count, 28); assert.equal(source.diagnostics.triangles, 117306); assert.equal(source.diagnostics.completeTreeConstructed, false);
});

test('bake soups preserve actual transformed source positions and colours', () => {
  let maximum = 0;
  for (let terminal = 0; terminal < 7; terminal++) {
    const soup = source.terminalGeometries[terminal]; let offset = 0;
    for (const record of source.records.shoots.filter(r => r.terminal === terminal)) {
      const geometry = source.geometries.get(record.seed), transform = new THREE.Matrix4().fromArray(record.matrix);
      for (let i = 0; i < geometry.attributes.position.count; i += 11) {
        const actual = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(transform), recorded = new THREE.Vector3().fromBufferAttribute(soup.attributes.position, offset + i);
        maximum = Math.max(maximum, actual.distanceTo(recorded));
        assert.ok(Math.abs(soup.attributes.color.getY(offset + i) - geometry.attributes.color.getY(i) * record.tint) < 3e-8);
      }
      offset += geometry.attributes.position.count;
    }
    assert.equal(offset, soup.attributes.position.count);
  }
  assert.ok(maximum < 3.2e-7, 'only the documented CPU Float32 soup write may round positions');
});

test('analytical coverage retains subpixel slivers and respects off-tile clipping', () => {
  const thin = [[.17, .21], [7.8, .210002], [7.4, .210009]], cover = new Float32Array(64);
  const result = rasterPineClusterTriangle(thin, 8, cover), expected = pineClusterPolygonArea(thin);
  assert.ok(expected > 0 && expected < 1e-4); assert.ok(Math.abs(result.areaTotal - expected) < 1e-14); assert.ok(cover.some(v => v > 0));
  const outside = new Float32Array(16); rasterPineClusterTriangle([[-2, 0], [2, 0], [2, 2]], 4, outside);
  assert.ok(Math.abs(outside.reduce((a, b) => a + b, 0) - 3) < 1e-7);
});

test('adjacent triangles do not double the area or erase exact diagonals', () => {
  const cover = new Float32Array(64);
  rasterPineClusterTriangle([[.2, .3], [3.4, .3], [3.4, 2.1]], 8, cover);
  rasterPineClusterTriangle([[.2, .3], [3.4, 2.1], [.2, 2.1]], 8, cover);
  assert.ok(Math.abs(cover.reduce((a, b) => a + Math.min(1, b), 0) - 3.2 * 1.8) < 1e-6);
  assert.ok(cover.every(v => v >= 0 && v <= 1.000001));
});

test('overlapping projected faces use geometric union instead of doubling opacity', () => {
  const cover = new Float32Array(16), triangle = [[.1, .12], [.85, .12], [.1, .82]], expected = .75 * .70 / 2;
  for (let i = 0; i < 10; i++) rasterPineClusterTriangle(i % 2 ? [...triangle].reverse() : triangle, 4, cover);
  assert.ok(Math.abs(cover.reduce((a, b) => a + b, 0) - expected) < 1e-7);
  const overlap = new Float32Array(16);
  for (const [left, right] of [[.1, .7], [.4, .9]]) {
    rasterPineClusterTriangle([[left, .2], [right, .2], [right, .8]], 4, overlap);
    rasterPineClusterTriangle([[left, .2], [right, .8], [left, .8]], 4, overlap);
  }
  assert.ok(Math.abs(overlap.reduce((a, b) => a + b, 0) - .8 * .6) < 1e-7);
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]], diamond = [[.5, -.5], [1.5, .5], [.5, 1.5], [-.5, .5]];
  assert.ok(Math.abs(pineClusterUnionArea([square, diamond]) - 2) < 1e-12);
  assert.ok(Math.abs(pineClusterUnionArea([square, [[1, 0], [2, 0], [2, 1], [1, 1]]]) - 2) < 1e-12);
});

test('actual saved half-float fields retain coverage and all seven sprays', () => {
  const pixels = baked.width * baked.height; let maximumRelativeError = 0;
  for (let layer = 0; layer < 42; layer++) {
    let sum = 0, positive = 0;
    for (let i = 0; i < pixels; i++) {
      const offset = (layer * pixels + i) * 4, alpha = THREE.DataUtils.fromHalfFloat(baked.base[offset + 3]); sum += alpha;
      assert.ok(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1); assert.equal(baked.base[offset + 3], baked.normal[offset + 3]);
      if (alpha) positive++;
      for (let c = 0; c < 3; c++) { const color = THREE.DataUtils.fromHalfFloat(baked.base[offset + c]); assert.ok(Number.isFinite(color) && color >= 0); if (!alpha) assert.equal(color, 0); }
    }
    assert.ok(positive > 100); const expected = baked.diagnostics.metrics[layer].coverageSum;
    maximumRelativeError = Math.max(maximumRelativeError, Math.abs(sum - expected) / expected);
  }
  assert.ok(maximumRelativeError < .0005);
});

test('premultiplied mip averaging preserves mean alpha and straight colour', () => {
  const data = new Float32Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) { const a = i % 9 === 0 ? .0137 : i % 5 / 5; data.set([.07 * a, .31 * a, .12 * a, a], i * 4); }
  const expectedMean = data.filter((_, i) => i % 4 === 3).reduce((a, b) => a + b, 0) / 64;
  let level = { data, width: 8, height: 8 };
  while (level.width > 1) { level = pineClusterCoverageMip(level); for (let i = 0; i < level.data.length; i += 4) if (level.data[i + 3]) assert.ok(Math.abs(level.data[i + 1] / level.data[i + 3] - .31) < 1e-7); }
  assert.ok(Math.abs(level.data[3] - expectedMean) < 1e-7);
});

test('two real depth slabs stay separate and every continuous sheet is connected', () => {
  const geometry = baked.geometry, p = geometry.attributes.position;
  assert.equal(baked.sheets.length, 42); assert.equal(geometry.index.count / 3, 1344);
  for (const sheet of baked.sheets) {
    for (let i = sheet.vertexOffset; i < sheet.vertexOffset + sheet.vertexCount; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(p, i), depth = point.dot(new THREE.Vector3(...sheet.frame.normal));
      assert.ok(depth >= sheet.depthRange[0] - 3e-7 && depth <= sheet.depthRange[1] + 3e-7); assert.equal(geometry.attributes.clusterLayer.getX(i), sheet.layer);
    }
  }
  assert.equal(pilot.diagnostics.totalTriangles, 2170); assert.equal(pilot.diagnostics.drawCallsPerPass, 2);
});

test('retained support wood is a lossless independent geometry copy', () => {
  assert.notEqual(pilot.wood.geometry, source.branchGeometry);
  for (const key of Object.keys(source.branchGeometry.attributes)) { assert.notEqual(pilot.wood.geometry.attributes[key].array, source.branchGeometry.attributes[key].array); assert.deepEqual(pilot.wood.geometry.attributes[key].array, source.branchGeometry.attributes[key].array); }
  assert.deepEqual(pilot.wood.geometry.index.array, source.branchGeometry.index.array);
});

test('normal transform agrees with actual transformed tangent planes under nonuniform instances', () => {
  const normal = new THREE.Vector3(.24, .71, -.38).normalize(), tangent = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 0, 1)).normalize(), bitangent = new THREE.Vector3().crossVectors(normal, tangent);
  for (let i = 0; i < 80; i++) {
    const instance = new THREE.Matrix4().compose(new THREE.Vector3(i / 30, 4, -2), new THREE.Quaternion().setFromEuler(new THREE.Euler(i * .07, i * .13, -.31)), new THREE.Vector3(.3 + i / 100, 1.4, .58));
    const camera = new THREE.PerspectiveCamera(); camera.position.set(7, i / 10 - 3, 11); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const modelView = camera.matrixWorldInverse.clone().multiply(new THREE.Matrix4().makeRotationZ(.23)), transform = modelView.clone().multiply(instance), origin = new THREE.Vector3().applyMatrix4(transform);
    const a = tangent.clone().applyMatrix4(transform).sub(origin), b = bitangent.clone().applyMatrix4(transform).sub(origin), view = i % 2 ? new THREE.Vector3(0, 0, 1) : origin.clone().negate().normalize();
    const expected = a.cross(b).normalize(); if (expected.dot(view) < 0) expected.negate();
    assert.ok(expected.dot(transformPineClusterNormal(normal, modelView, instance, view)) > 1 - 1e-12);
  }
  assert.throws(() => transformPineClusterNormal(normal, new THREE.Matrix4(), new THREE.Matrix4().makeScale(0, 1, 1)), /Singular/);
});

test('per-layer stochastic coverage has the intended opacity and non-correlated overlap', () => {
  const a = .217, b = .41; let first = 0, second = 0, union = 0;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const one = pineClusterCoverageHash(x, y, 0) < a, two = pineClusterCoverageHash(x, y, 1) < b; first += one; second += two; union += one || two;
  }
  assert.ok(Math.abs(first / 65536 - a) < .006); assert.ok(Math.abs(second / 65536 - b) < .006); assert.ok(Math.abs(union / 65536 - (a + b - a * b)) < .006);
  assert.notEqual(pineClusterCoverageHash(121, 38, 2, 0), pineClusterCoverageHash(121, 38, 2, 1));
  assert.notEqual(pineClusterCoverageHash(121, 38, 2, 0, 361), pineClusterCoverageHash(121, 38, 2, 0, 360));
  const alpha = .61, parts = [pineClusterWeightedCoverage(alpha, .2), pineClusterWeightedCoverage(alpha, .3), pineClusterWeightedCoverage(alpha, .5)];
  assert.ok(Math.abs(1 - parts.reduce((remaining, value) => remaining * (1 - value), 1) - alpha) < 1e-12);
});

test('all actual Three material shader templates use the same current-camera coverage', () => {
  const sets = [[pilot.cards.material, THREE.ShaderLib.standard], [pilot.cards.customDepthMaterial, THREE.ShaderLib.depth], [pilot.cards.customDistanceMaterial, THREE.ShaderLib.distance], [pilot.cards.userData.pineShootNormalMaterial, THREE.ShaderLib.normal]];
  for (const [material, lib] of sets) {
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) }; material.onBeforeCompile(shader, {});
    assert.match(shader.vertexShader, /transpose\(inverse\(mat3\(instanceMatrix\)\)\)/); assert.match(shader.vertexShader, /centroid varying vec2 vClusterUv/);
    assert.match(shader.fragmentShader, /isOrthographic \?/); assert.match(shader.fragmentShader, /clusterCoverageThreshold\(gl_FragCoord.xy/); assert.match(shader.fragmentShader, /pineLodRole/);
    assert.equal(material.alphaTest, 0); assert.equal(material.transparent, false);
    if (material === pilot.cards.material || material === pilot.cards.userData.pineShootNormalMaterial) assert.match(shader.fragmentShader, /dot\(clusterChartNormal, clusterView\) < 0/);
  }
  for (const texture of pilot.textures.slice(0, 2)) { assert.equal(texture.isDataArrayTexture, true); assert.equal(texture.type, THREE.HalfFloatType); assert.equal(texture.image.depth, 42); assert.equal(texture.generateMipmaps, true); assert.equal(texture.colorSpace, THREE.NoColorSpace); }
  assert.equal(pilot.textures[2].image.depth, 252); assert.equal(pilot.textures[2].generateMipmaps, true);
});

test('R2 geometry and premultiplied base/coverage are byte identical to retained R1', async () => {
  const previous = new URL('../public/assets/pine-cluster-r1/', import.meta.url);
  for (const name of ['base-coverage-half.bin', 'volume-sheets.json']) assert.deepEqual(await readFile(new URL(name, directory)), await readFile(new URL(name, previous)));
});

test('retained R1 fields still load with their original normal path for a causal comparison', async () => {
  const folder = new URL('../public/assets/pine-cluster-r1/', import.meta.url), previous = await loadPineClusterBake({ baseURL: '/assets/pine-cluster-r1/', fetcher: async url => new Response(await readFile(new URL(url.split('/').at(-1), folder))) });
  try { assert.equal(previous.normalBins, null); assert.equal(previous.diagnostics.version, 1); assert.equal(previous.geometry.index.count / 3, 1344); }
  finally { previous.dispose(); }
});

test('display states retain source ownership and use complementary endpoint visibility', () => {
  assert.equal(pilot.setMode('source').sourceVisible, true); assert.equal(pilot.group.visible, false);
  assert.equal(pilot.setMode('low').lowVisible, true); assert.equal(source.group.visible, false);
  assert.equal(pilot.setMode('blend', 0).lowVisible, false); assert.equal(pilot.setMode('blend', 1).sourceVisible, false);
  assert.equal(pilot.setMode('blend', .5).lowVisible, true); assert.equal(source.transition.role.value, -1);
  assert.throws(() => pilot.assertMainSceneAllowed(), /no native/); pilot.setMode('source');
});

test('identity checks actual frozen source bytes and camera choices include oblique views', async () => {
  const raw = Object.fromEntries(await Promise.all(['vegetation-geometry.js', 'garden-vegetation.js'].map(async path => ['./' + path, await readFile(new URL('../src/yuanmingyuan/' + path, import.meta.url), 'utf8')])));
  const identity = await pineClusterStudioIdentity(raw); assert.equal(identity.sourceDependenciesVerified, true);
  assert.equal(await pineClusterSha256(raw['./garden-vegetation.js']), PINE_CLUSTER_RECORDS.source.sha256);
  await assert.rejects(pineClusterStudioIdentity({ ...raw, './garden-vegetation.js': raw['./garden-vegetation.js'] + '\n' }), /mismatch/);
  for (const key of ['front', 'oblique', 'side', 'back', 'top', 'underside']) assert.ok(PINE_CLUSTER_VIEWS[key]);
});

test('loading rejects corrupt or aborted pixels before creating a candidate', async () => {
  await assert.rejects(loadPineClusterBake({ fetcher: async url => url.endsWith('.bin') ? new Response(new Uint8Array(1)) : fetcher(url) }), /digest mismatch/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(loadPineClusterBake({ signal: controller.signal, fetcher }), { name: 'AbortError' });
  await assert.rejects(bakePineCluster(source, { signal: controller.signal }), { name: 'AbortError' });
});

test('capture pairs one exact metadata frame with PNG and keeps upload failure evidence', async () => {
  let frames = 0; const names = [], canvas = { toBlob(callback) { callback(new Blob(['native-png'], { type: 'image/png' })); } };
  const metadata = () => ({ createdAt: '2026-09-12T10:00:00Z', sourceIdentity: { sha256: 'c'.repeat(64) }, state: { mode: 'low', phase: .5 }, view: 'oblique', light: 'night', output: 'beauty', water: true, sequence: 4, physical: [2457, 1802], frame: frames });
  const result = await savePineClusterCapture({ canvas, render() { frames++; }, metadata, upload: async name => names.push(name) });
  assert.equal(result.record.frame, 1); assert.equal(names.length, 2); assert.match(names[0], /pine-cluster/);
  await assert.rejects(savePineClusterCapture({ canvas, render() {}, metadata, upload: async name => { if (name.endsWith('.json')) throw new Error('metadata upload failed'); } }), error => error.retainedFiles?.length === 1);
});

test('candidate disposal is idempotent and does not dispose caller source', async () => {
  const independent = await createPineClusterPilot(source, { baked: await loadPineClusterBake({ fetcher }) });
  const counters = new Map(); const owned = [...independent.materials, ...independent.textures, independent.cards.geometry, independent.wood.geometry];
  let sourceDisposed = 0; source.geometries.get(218).addEventListener('dispose', () => sourceDisposed++);
  for (const resource of owned) { counters.set(resource, 0); resource.addEventListener('dispose', () => counters.set(resource, counters.get(resource) + 1)); }
  independent.setMode('low'); independent.dispose(); independent.dispose();
  assert.equal(sourceDisposed, 0); assert.equal(source.group.visible, true); assert.ok([...counters.values()].every(count => count === 1)); assert.throws(() => independent.setMode('source'), /Invalid/);
});
