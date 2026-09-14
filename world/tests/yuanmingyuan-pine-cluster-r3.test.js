import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rasterPineClusterR3, bakePineClusterR3 } from '../src/yuanmingyuan/pine-cluster-r3-baker.js';
import { PINE_CLUSTER_AXES } from '../src/yuanmingyuan/pine-cluster-baker.js';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { pineClusterR3MaterialSet, pineClusterR3ShadowThreshold } from '../src/yuanmingyuan/pine-cluster-r3-materials.js';
import { createPineClusterR3Pilot, pineClusterR3View } from '../src/yuanmingyuan/pine-cluster-r3-pilot.js';
import { createPineClusterR3Rendering } from '../src/yuanmingyuan/pine-cluster-r3-rendering.js';

function plane(z, color) {
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.translate(0, 0, z);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => color).flat(), 3)); return geometry;
}

test('R3 rejects unbounded dimensions or an already-aborted bake before touching source geometry', async () => {
  const source = { get terminalGeometries() { throw new Error('source must not be accessed'); } };
  await assert.rejects(bakePineClusterR3(source, { tileSize: 1e9 }), /Unsupported bounded/);
  await assert.rejects(bakePineClusterR3(source, { subsamples: 9999 }), /Unsupported bounded/);
  const controller = new AbortController(); controller.abort(new Error('cancel before allocate'));
  await assert.rejects(bakePineClusterR3(source, { signal: controller.signal }), /cancel before allocate/);
});

test('R3 first-hit joint fields retain different visible front/back colours, not the hidden sum', () => {
  const front = plane(.2, [1, .1, .05]), back = plane(-.2, [.05, .8, .2]), hidden = plane(0, [0, 0, 1]);
  try {
    const { output, diagnostics } = rasterPineClusterR3([front, back, hidden], PINE_CLUSTER_AXES[2], { tileSize: 8, subsamples: 4 });
    assert.equal(diagnostics.sourceSamples, 32 * 32 * 2);
    for (let side = 0; side < 2; side++) for (let p = 0; p < 64; p++) {
      assert.equal(output[side].coverage[p], 16);
      assert.ok(Math.abs(output[side].depth[p * 2] / 16 - (side ? -.2 : .2)) < 1e-7);
      const bin = side ? 5 : 4, m = (p * 6 + bin) * 7, expected = side ? [.05, .8, .2] : [1, .1, .05];
      assert.equal(output[side].moments[m], 16);
      assert.equal(output[side].moments[m + 3] / 16, side ? -1 : 1);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(output[side].moments[m + 4 + k] / 16 - expected[k]) < 1e-7);
    }
  } finally { front.dispose(); back.dispose(); hidden.dispose(); }
});

test('R3 coverage resolves true union and tiny positive coverage rather than averaging overlap or alpha cutting', () => {
  const a = plane(0, [1, 0, 0]), duplicate = a.clone();
  const sparse = new THREE.BufferGeometry();
  sparse.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, .02, 0, 0, 1, 0], 3));
  sparse.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  sparse.setAttribute('color', new THREE.Float32BufferAttribute(Array(12).fill(1), 3)); sparse.setIndex([0, 1, 2]);
  try {
    const once = rasterPineClusterR3([a], PINE_CLUSTER_AXES[2], { tileSize: 8, subsamples: 8 }), twice = rasterPineClusterR3([a, duplicate], PINE_CLUSTER_AXES[2], { tileSize: 8, subsamples: 8 });
    assert.deepEqual(once.output[0].coverage, twice.output[0].coverage);
    const result = rasterPineClusterR3([sparse], PINE_CLUSTER_AXES[2], { tileSize: 32, subsamples: 16 });
    const covered = [...result.output[0].coverage], area = covered.reduce((sum, x) => sum + x, 0) / (512 ** 2);
    assert.ok(covered.some(x => x > 0 && x < 256)); assert.ok(Math.abs(area - .01) < .001, area);
  } finally { a.dispose(); duplicate.dispose(); sparse.dispose(); }
});

test('real four-shoot terminal first hits agree with independent Three raycasts including reverse visibility', () => {
  const source = createPineClusterSource(), geometry = source.terminalGeometries[4], material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material), raycaster = new THREE.Raycaster();
  mesh.updateMatrixWorld(true); let checked = 0;
  try {
    const frame = PINE_CLUSTER_AXES[2], captured = [], result = rasterPineClusterR3([geometry], frame, { tileSize: 32, subsamples: 4, sampleVisitor: s => { if ((s.x * 31 + s.y * 17) % 97 === 0) captured.push(s); } });
    for (const sample of captured) {
      const x = result.low[0] + (sample.x + .5) / result.size * (result.high[0] - result.low[0]), y = result.low[1] + (sample.y + .5) / result.size * (result.high[1] - result.low[1]), sign = sample.side ? -1 : 1;
      raycaster.set(new THREE.Vector3(x, y, sample.side ? result.low[2] - 1 : result.high[2] + 1), new THREE.Vector3(0, 0, -sign));
      const hit = raycaster.intersectObject(mesh, false)[0]; assert.ok(hit); assert.ok(Math.abs(hit.point.z - sample.depth) < 2e-9);
      const expectedColor = hit.barycoord.toArray().reduce((out, w, i) => { const id = geometry.index.getX(hit.faceIndex * 3 + i); for (let k = 0; k < 3; k++) out[k] += w * geometry.attributes.color.array[id * 3 + k]; return out; }, [0, 0, 0]);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(expectedColor[k] - sample.color[k]) < 2e-8);
      // Three faceforwards hit.normal to the ray; source DoubleSide instead
      // changes sign by geometric facing, including tangent-crossing normals.
      const normal = new THREE.Vector3();
      for (let i = 0; i < 3; i++) normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, geometry.index.getX(hit.faceIndex * 3 + i)), hit.barycoord.getComponent(i));
      normal.normalize().multiplyScalar(hit.face.normal.z * sign < 0 ? -1 : 1);
      assert.ok(normal.distanceTo(new THREE.Vector3(...sample.normal)) < 1e-8); checked++;
    }
    assert.ok(checked > 40); console.log(JSON.stringify({ stage: 'R3-independent-source-ray-oracle', checked, sourceTriangles: geometry.index.count / 3, scratch: result.diagnostics, peakRSSKiB: process.resourceUsage().maxRSS, gpu: false }));
  } finally { material.dispose(); source.dispose(); }
});

test('R3 tiny terminal bake has joint premultiplied fields, all six distinct views, and bounded ownership', async () => {
  const source = createPineClusterSource(); let baked, disposals = 0;
  try {
    baked = await bakePineClusterR3(source, { terminals: [4], tileSize: 16, subsamples: 4, grid: 4 });
    assert.equal(baked.diagnostics.partial, true); assert.equal(baked.views.length, 6); assert.equal(baked.diagnostics.mainSceneAllowed, false);
    assert.equal(baked.normals.length, baked.colors.length); assert.equal(baked.normals.length, baked.visibility.length * 6);
    assert.ok(baked.diagnostics.metrics.every(m => m.maximumHalfWeightError < .001));
    const half = THREE.DataUtils.fromHalfFloat;
    for (let p = 0; p < baked.normals.length; p += 4) { assert.equal(baked.normals[p + 3], baked.colors[p + 3]); const w = half(baked.normals[p + 3]); assert.ok(Math.hypot(...[0, 1, 2].map(k => half(baked.normals[p + k]))) <= w + .001); }
    baked.geometry.addEventListener('dispose', () => disposals++); baked.dispose(); baked.dispose(); assert.equal(disposals, 1); assert.equal(baked.normals, null);
    assert.equal(source.group.children.length, 5);
  } finally { baked?.dispose(); source.dispose(); }
});

test('R3 deterministic shader integrates every original PBR stage and keeps true fractional MSAA coverage', () => {
  const textures = [new THREE.DataArrayTexture(), new THREE.DataArrayTexture(), new THREE.DataArrayTexture()], set = pineClusterR3MaterialSet({ visibility: textures[0], normals: textures[1], colors: textures[2], transition: { role: { value: 0 }, phase: { value: 0 } } });
  try {
    for (const [material, library] of [[set.surface, THREE.ShaderLib.standard], [set.normal, THREE.ShaderLib.normal], [set.depth, THREE.ShaderLib.depth], [set.distance, THREE.ShaderLib.distance]]) {
      const shader = { uniforms: {}, vertexShader: library.vertexShader, fragmentShader: library.fragmentShader }; material.onBeforeCompile(shader, {});
      assert.doesNotMatch(shader.fragmentShader, /clusterCoverageThreshold|clusterSelector|random|roughnessFactor = clamp/);
      assert.doesNotMatch(shader.fragmentShader, /#include <alphatest_fragment>/);
      if (material === set.surface) {
        for (const chunk of ['lights_physical_fragment', 'lights_fragment_begin', 'lights_fragment_maps', 'lights_fragment_end']) assert.equal(shader.fragmentShader.split('#include <' + chunk + '>').length - 1, 1);
        assert.match(shader.fragmentShader, /r3Bin < 6/); assert.match(shader.fragmentShader, /r3Sigma < 4/);
        assert.match(shader.fragmentShader, /reflectedLight = r3Integrated/); assert.match(shader.fragmentShader, /gl_FragColor.a = r3Coverage/);
        assert.ok(shader.fragmentShader.indexOf('float r3Weight =') > shader.fragmentShader.indexOf('#include <lights_fragment_end>'));
      }
      if (material === set.normal) { assert.match(shader.fragmentShader, /vec4\(normal \* .5 \+ .5, r3Coverage\)/); assert.doesNotMatch(shader.fragmentShader, /gl_FragColor.a = 1.0/); }
      if (material === set.depth || material === set.distance) assert.match(shader.fragmentShader, /r3Coverage <= r3ShadowThreshold\(gl_FragCoord.xy\)/);
    }
    assert.equal(set.surface.roughness, .77); assert.equal(set.surface.metalness, 0); assert.equal(set.surface.color.getHex(), 0xffffff); assert.equal(set.surface.emissiveIntensity, .045);
    assert.equal(set.surface.alphaToCoverage, true); assert.equal(set.normal.alphaToCoverage, true); assert.equal(set.surface.depthWrite, true);
  } finally { set.materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); }
});

test('single-sample shadow coverage is ordered area sampling, with a bounded 1/64 error and no alpha .5 cutoff', () => {
  const thresholds = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { thresholds.push(pineClusterR3ShadowThreshold(x, y)); assert.equal(pineClusterR3ShadowThreshold(x, y), pineClusterR3ShadowThreshold(x - 16, y + 24)); }
  assert.equal(new Set(thresholds).size, 64);
  for (let i = 0; i <= 256; i++) { const alpha = i / 256, actual = thresholds.filter(t => alpha > t).length / 64; assert.ok(Math.abs(actual - alpha) <= 1 / 128); }
});

test('actual perspective, reflected, orthographic and nonuniform object cameras select exactly one signed field', () => {
  const centre = new THREE.Vector3(2, 4, -1), world = new THREE.Matrix4().compose(new THREE.Vector3(9, 1, -2), new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, .7, .4)), new THREE.Vector3(.7, 1.8, 1.2));
  for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
    const direction = new THREE.Vector3().setComponent(axis, side ? -1 : 1), target = centre.clone().applyMatrix4(world), eye = centre.clone().addScaledVector(direction, 20).applyMatrix4(world);
    for (const camera of [new THREE.PerspectiveCamera(), new THREE.OrthographicCamera(-1, 1, 1, -1)]) {
      camera.position.copy(eye); camera.up.set(.12, 1, .06).normalize(); camera.lookAt(target); camera.updateMatrixWorld(true);
      assert.equal(pineClusterR3View(camera, world, centre), axis * 2 + side);
    }
  }
  const invalid = world.clone(); invalid.elements[3] = .01;
  assert.throws(() => pineClusterR3View(new THREE.PerspectiveCamera(), invalid, centre), /affine/);
});

test('R3 GBuffer retains physical resolution/MSAA in source and candidate without changing AO or output alpha', () => {
  const renderer = { capabilities: { maxSamples: 4 }, getPixelRatio: () => 2 }, post = createPineClusterR3Rendering(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
  try { post.resize(1200, 900, 2); const metadata = post.metadata(); assert.deepEqual([metadata.width, metadata.height], [2400, 1800]); assert.equal(metadata.samples, 4); assert.deepEqual(metadata.normalBuffer, [2400, 1800]); assert.equal(metadata.gtao.radius, 1.6); assert.equal(metadata.gtao.blend, .55); assert.match(metadata.normalCoverage, /source and R3 both/); assert.match(metadata.finalOutputAlpha, /opaque/); }
  finally { post.dispose(); post.dispose(); }
});

test('R3 runtime fixture borrows source and selects the real shadow camera, preserving resources on repeated disposal', () => {
  // Small synthetic ownership fixture, not a claim that a partial asset is a
  // production cluster. The source-specific baker tests above stay partial.
  const source = { group: new THREE.Group(), bounds: new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)), records: { id: 'fixture', source: { sha256: 'fixture' } }, branchGeometry: new THREE.BoxGeometry(.1, .1, .1), transition: { role: { value: 0 }, phase: { value: 0 } } };
  const geometry = new THREE.BoxGeometry(1, 1, 1), visibility = new Uint16Array(6 * 4); visibility.fill(THREE.DataUtils.toHalfFloat(1));
  let bakedDisposals = 0, sourceDisposals = 0;
  source.branchGeometry.addEventListener('dispose', () => sourceDisposals++);
  const baked = { geometry, visibility, normals: new Uint16Array(6 * 6 * 4), colors: new Uint16Array(6 * 6 * 4), width: 1, height: 1, views: Array.from({ length: 6 }, (_, layer) => ({ layer, start: layer * 6, count: 6 })), diagnostics: { revision: 'r3', partial: false, sourceRecordId: 'fixture', sourceSha256: 'fixture' }, dispose() { bakedDisposals++; geometry.dispose(); } };
  const pilot = createPineClusterR3Pilot(source, { baked }), counts = new Map();
  for (const resource of [...pilot.textures, ...pilot.materials, pilot.wood.geometry]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  const camera = new THREE.PerspectiveCamera(), shadow = new THREE.OrthographicCamera(-2, 2, 2, -2), renderer = { getRenderTarget: () => ({ samples: 4 }) };
  camera.position.set(0, 0, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true); shadow.position.set(-4, 0, 0); shadow.lookAt(0, 0, 0); shadow.updateMatrixWorld(true);
  try {
    pilot.cards.onBeforeRender(renderer, null, camera, geometry, pilot.cards.material); assert.equal(pilot.diagnostics.lastViews['color-or-reflection'].layer, 4); assert.deepEqual(geometry.drawRange, { start: 24, count: 6 });
    pilot.cards.onBeforeShadow(renderer, pilot.cards, camera, shadow); assert.equal(pilot.diagnostics.lastViews.shadow.layer, 1); assert.deepEqual(geometry.drawRange, { start: 6, count: 6 });
    pilot.cards.onBeforeRender(renderer, null, camera, geometry, pilot.cards.material); assert.deepEqual(geometry.drawRange, { start: 24, count: 6 });
    pilot.setMode('low'); assert.equal(source.group.visible, false); assert.throws(() => pilot.assertMainSceneAllowed(), /no native/);
  } finally { pilot.dispose(); pilot.dispose(); assert.equal(bakedDisposals, 1); assert.equal(sourceDisposals, 0); assert.equal(source.group.visible, true); assert.ok([...counts.values()].every(n => n === 1)); source.branchGeometry.dispose(); }
});
