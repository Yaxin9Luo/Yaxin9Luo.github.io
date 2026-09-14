import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createWillowSourceFixture } from './helpers/willow-lod-source-fixture.js';
import { VegetationGeometryBatch } from '../src/yuanmingyuan/vegetation-geometry.js';
import { createWillowMidLeaf, buildWillowLodLevels, buildWillowFoliageLevels, simplifyWillowWood, inspectWillowBranchTubes, willowSampledSurfaceError, clusterWillowLeaves, WILLOW_LOD_POLICY } from '../src/yuanmingyuan/willow-lod-geometry.js';
import { createWillowInstancedLevel, createWillowLodPilot, enableWillowLodCoverage, willowCoverageAt, willowLodTierForCamera } from '../src/yuanmingyuan/willow-lod-runtime.js';
import { willowLodReviewViews } from '../src/yuanmingyuan/willow-lod-study-views.js';

const V = (...x) => new THREE.Vector3(...x), geometryHash = geometry => { const hash = createHash('sha256'); for (const a of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)); return hash.digest('hex'); };
let fixture, midLeaf, levels, sourceHashes, report, started;
before(async () => {
  started = performance.now(); fixture = await createWillowSourceFixture({ minimumLeaves: 128 });
  sourceHashes = [fixture.leaf, ...fixture.twigs.map(m => m.geometry)].map(geometryHash);
  midLeaf = await createWillowMidLeaf(fixture.leaf); levels = await buildWillowLodLevels(fixture);
  report = { scope: 'bounded actual R4 leafy shoots; no complete willow/vegetation factory and no GPU', fixture: fixture.diagnostics, leaf: midLeaf.userData, levels: levels.diagnostics, woodSamples: [] };
});
after(async () => {
  if (fixture) assert.deepEqual([fixture.leaf, ...fixture.twigs.map(m => m.geometry)].map(geometryHash), sourceHashes, 'frozen fixture source mutated');
  levels?.dispose(); levels?.dispose(); midLeaf?.dispose(); fixture?.dispose(); fixture?.dispose();
  if (report) { report.totalMilliseconds = performance.now() - started; report.peakRssKiB = process.resourceUsage().maxRSS; report.nativeReviewed = false; report.mainSceneAllowed = false; if (process.env.WILLOW_LOD_REPORT_PATH) await writeFile(process.env.WILLOW_LOD_REPORT_PATH, JSON.stringify(report, null, 2)); }
});

function solidVolume(g) {
  const p = g.attributes.position, index = g.index, a = V(), b = V(), c = V(), origin = g.boundingBox.getCenter(V()), edges = new Map(); let volume = 0;
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e6)).join(',');
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i)).sub(origin); b.fromBufferAttribute(p, index.getX(i + 1)).sub(origin); c.fromBufferAttribute(p, index.getX(i + 2)).sub(origin);
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-24); volume += a.dot(b.clone().cross(c)) / 6;
    const ids = [key(index.getX(i)), key(index.getX(i + 1)), key(index.getX(i + 2))];
    for (let k = 0; k < 3; k++) { const a = ids[k], b = ids[(k + 1) % 3], edge = [a, b].sort().join('|'); if (!edges.has(edge)) edges.set(edge, []); edges.get(edge).push(a < b ? 1 : -1); }
  }
  for (const edge of edges.values()) assert.deepEqual(edge.sort(), [-1, 1], 'tube must remain closed and oriented');
  assert.ok(volume > 0); return volume;
}

test('willow fixture: a complete real source shoot is bounded, and the small leaf retains area and measured shape', () => {
  assert.ok(fixture.diagnostics.sourceLeaves >= 128 && fixture.diagnostics.sourceLeaves < 308); assert.ok(fixture.twigs.length >= 2); assert.equal(fixture.diagnostics.fullFactoryCalled, false);
  assert.equal(midLeaf.userData.triangles, 12); assert.equal(midLeaf.userData.sourceTriangles, 24);
  assert.equal(midLeaf.userData.sourceMidribColorAndNormalSamplesRetained, true);
  assert.ok(midLeaf.userData.measuredSurfaceError.maximum < .0025); assert.ok(midLeaf.userData.area / midLeaf.userData.sourceArea > .985);
  assert.equal(midLeaf.userData.measuredSurfaceError.certifiedHausdorff, false);
  assert.equal(levels.diagnostics.foliage.inputLeaves, fixture.diagnostics.sourceLeaves);
});

test('willow fixture: every mid leaf uses the actual source pose and tint without deleting a leaf', () => {
  const g = levels.mid[0].geometry, point = V(), color = V(); let output = 0;
  for (const mesh of fixture.leaves) for (let instance = 0; instance < mesh.count; instance++) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(instance, matrix);
    for (let i = 0; i < midLeaf.attributes.position.count; i++, output++) {
      point.fromBufferAttribute(midLeaf.attributes.position, i).applyMatrix4(matrix);
      assert.ok(point.distanceTo(V().fromBufferAttribute(g.attributes.position, output)) < 2e-6);
      color.fromBufferAttribute(midLeaf.attributes.color, i).multiply(V(mesh.instanceColor.getX(instance), mesh.instanceColor.getY(instance), mesh.instanceColor.getZ(instance)));
      assert.ok(color.distanceTo(V().fromBufferAttribute(g.attributes.color, output)) < Math.sqrt(3) / 255);
    }
  }
  assert.equal(output, g.attributes.position.count); assert.equal(levels.diagnostics.foliage.unrepresentedSourceLeaves, 0);
  assert.ok(Math.abs(levels.diagnostics.foliage.midRenderedArea / levels.diagnostics.foliage.originalArea - midLeaf.userData.area / midLeaf.userData.sourceArea) < 1e-5);
  assert.ok(levels.diagnostics.foliage.farRenderedArea / levels.diagnostics.foliage.originalArea > .98);
});

test('willow fixture: adaptive wood retains every tube, full cross-sections, capped ends and actual curved extent', () => {
  const batch = new VegetationGeometryBatch('actual-three-source-tubes'); fixture.twigs.forEach(mesh => batch.add(mesh.geometry)); const combined = batch.finish();
  try {
    assert.equal(inspectWillowBranchTubes(combined).length, fixture.twigs.length);
    for (const error of [.014, .045]) {
      const result = simplifyWillowWood(combined, { error });
      try { assert.equal(inspectWillowBranchTubes(result).length, fixture.twigs.length); assert.equal(result.userData.outputTubes, fixture.twigs.length); assert.ok(result.index.count < combined.index.count); } finally { result.dispose(); }
    }
    for (const mesh of fixture.twigs) for (const error of [.014, .045]) {
      const result = simplifyWillowWood(mesh.geometry, { error });
      try {
        const distance = willowSampledSurfaceError(mesh.geometry, result), ratio = solidVolume(result) / solidVolume(mesh.geometry);
        assert.ok(distance.maximum <= error + 1e-5, `${mesh.name} actual surface deviation ${distance.maximum}`); assert.ok(ratio > .8 && ratio < 1.2, `tube volume ratio ${ratio}`);
        report.woodSamples.push({ name: mesh.name, error, ...result.userData, sampledSurfaceError: distance, volumeRatio: ratio });
      } finally { result.dispose(); }
    }
    const broken = combined.clone(); broken.index.setX(2, 1); assert.throws(() => simplifyWillowWood(broken), /topology/); broken.dispose();
  } finally { combined.dispose(); }
});

test('willow fixture: far clustering conserves source contributions and rejects unsafe gaps or normal mixtures', () => {
  const leaf = (id, x, normal = V(0, 0, 1)) => ({ sourceIndex: id, centre: V(x, .06, .06), surfaceAnchor: V(x, .06, .06), normal, axis: V(0, 1, 0), color: V(.18 + id * .015, .29, .11), area: .001, radius: .065 });
  const records = [leaf(0, .04), leaf(1, .07), leaf(2, .09, V(0, 0, -1)), leaf(3, .05, V(1, 0, 0)), leaf(4, .9)];
  const result = clusterWillowLeaves(records), represented = [...result.singles.map(r => r.sourceIndex), ...result.aggregates.flatMap(a => a.sourceIndices)].sort();
  assert.deepEqual(represented, [0, 1, 2, 3, 4]); assert.equal(result.aggregates.length, 1); assert.equal(result.aggregates[0].count, 3); assert.ok(Math.abs(result.diagnostics.originalArea - result.diagnostics.area) < 1e-12);
  assert.ok(result.aggregates[0].errorBound < .22); assert.equal(clusterWillowLeaves(records, { maximumError: .01 }).aggregates.length, 0);
  assert.equal(result.diagnostics.areaIsSumNotVisibilityCoverage, true);
  const matrix = new THREE.Matrix4(); fixture.leaves[0].getMatrixAt(0, matrix); const before = matrix.clone(); matrix.scale(V(1, 1.2, 1)); fixture.leaves[0].setMatrixAt(0, matrix);
  try { assert.throws(() => buildWillowFoliageLevels(fixture.leaves, { sourceRoot: fixture.group, sourceLeaf: fixture.leaf, midLeaf }), /uniform/); } finally { fixture.leaves[0].setMatrixAt(0, before); }
});

test('willow fixture: repeated complete tiers use genuine instances and independent renderer resource ownership', () => {
  const placements = [{ position: [0, 0, 0] }, { position: [11, 2, -7], rotation: [0, .83, 0], scale: [.84, .84, .84] }];
  const population = createWillowInstancedLevel(levels.mid, placements), owned = Object.values(population.resources).flat(), events = new Map(owned.map(o => [o, 0]));
  owned.forEach(o => o.addEventListener('dispose', () => events.set(o, events.get(o) + 1)));
  let sourceDispose = 0; const listener = () => { sourceDispose++; }; levels.mid.forEach(r => r.geometry.addEventListener('dispose', listener));
  try {
    population.meshes.forEach((mesh, index) => {
      assert.equal(mesh.count, 2); assert.ok(mesh.isInstancedMesh); assert.notEqual(mesh.geometry.attributes.position, levels.mid[index].geometry.attributes.position); assert.equal(mesh.geometry.attributes.position.array, levels.mid[index].geometry.attributes.position.array);
      assert.notEqual(mesh.material, levels.mid[index].material); assert.equal(mesh.material.roughness, levels.mid[index].material.roughness); assert.equal(mesh.material.map, levels.mid[index].material.map);
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(1, matrix); assert.ok(matrix.determinant() > 0); assert.ok(V().setFromMatrixPosition(matrix).distanceTo(V(11, 2, -7)) < 1e-6);
      assert.ok(mesh.customDepthMaterial.isMeshDepthMaterial && mesh.customDistanceMaterial.isMeshDistanceMaterial);
    });
    population.setCoverage(1, .4, 1); assert.equal(population.meshes[0].geometry.attributes.willowLodFade.getX(0), 0); assert.ok(Math.abs(population.meshes[0].geometry.attributes.willowLodFade.getX(1) - .4) < 1e-7);
    assert.throws(() => createWillowInstancedLevel(levels.mid, [{ scale: [-1, -1, -1] }]), /positive/);
  } finally { population.dispose(); population.dispose(); for (const count of events.values()) assert.equal(count, 1); assert.equal(sourceDispose, 0); levels.mid.forEach(r => r.geometry.removeEventListener('dispose', listener)); }
});

test('willow fixture: near geometry/poses stay exact and complementary transition coverage reaches both endpoints', () => {
  const pilot = createWillowLodPilot({ source: fixture, levels });
  try {
    for (const source of [...fixture.leaves, ...fixture.twigs]) {
      const near = pilot.representations.near.group.getObjectByName(source.name); assert.ok(near);
      assert.equal(geometryHash(source.geometry), geometryHash({ attributes: Object.fromEntries(Object.entries(near.geometry.attributes).filter(([name]) => name !== 'willowLodFade')), index: near.geometry.index }));
      if (source.isInstancedMesh) { assert.deepEqual(near.instanceMatrix.array, source.instanceMatrix.array); assert.notEqual(near.instanceMatrix.array, source.instanceMatrix.array); assert.deepEqual(near.instanceColor.array, source.instanceColor.array); }
    }
    for (const phase of [0, .25, .5, .75, 1]) {
      pilot.setBlend('near', 'mid', phase);
      assert.equal(pilot.representations.near.group.visible, phase < 1); assert.equal(pilot.representations.mid.group.visible, phase > 0); assert.equal(pilot.representations.far.group.visible, false);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) assert.equal(Number(willowCoverageAt(x, y, phase, -1)) + Number(willowCoverageAt(x, y, phase, 1)), 1);
    }
  } finally { pilot.dispose(); pilot.dispose(); }
});

test('willow fixture: the same coverage stage is present in standard colour, depth, distance and normal shader templates', () => {
  const classes = [[THREE.MeshStandardMaterial, 'standard'], [THREE.MeshDepthMaterial, 'depth'], [THREE.MeshDistanceMaterial, 'distance'], [THREE.MeshNormalMaterial, 'normal']];
  for (const [Material, id] of classes) {
    const material = new Material(), shader = { vertexShader: THREE.ShaderLib[id].vertexShader, fragmentShader: THREE.ShaderLib[id].fragmentShader, uniforms: {} };
    try { enableWillowLodCoverage(material); enableWillowLodCoverage(material); material.onBeforeCompile(shader, null); assert.equal(shader.fragmentShader.match(/float willowDither/g).length, 1); assert.ok(shader.vertexShader.includes('vWillowLodFade = willowLodFade;')); assert.deepEqual(material.defaultAttributeValues.willowLodFade, [0, 0]); } finally { material.dispose(); }
  }
  report.shaderCheck = 'Four real Three shader templates patched; GPU compilation and normal-pass image parity are not yet tested.';
});

test('willow fixture: camera distance uses actual pixel size and hysteresis, and views import no model', () => {
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 3000), box = new THREE.Box3(V(-4.3, 0, -4.3), V(4.3, 8.6, 4.3));
  const select = (z, previous = 'near') => { camera.position.set(0, 4.3, z); camera.lookAt(0, 4.3, 0); camera.updateMatrixWorld(); return willowLodTierForCamera({ camera, worldBounds: box, viewportHeight: 2200, previous }); };
  assert.equal(select(16).tier, 'near'); assert.equal(select(80).tier, 'mid'); assert.equal(select(650, 'mid').tier, 'mid'); assert.equal(select(900, 'mid').tier, 'far');
  const stable = select(650, 'far'); assert.equal(stable.tier, 'far'); assert.ok(stable.farErrorPixels <= WILLOW_LOD_POLICY.farErrorPixels * (1 + WILLOW_LOD_POLICY.hysteresis));
  assert.deepEqual(willowLodReviewViews.transition.phases, [0, .25, .5, .75, 1]); report.distanceExamples = { near16: select(16), mid80: select(80), far900: select(900, 'mid') };
});
