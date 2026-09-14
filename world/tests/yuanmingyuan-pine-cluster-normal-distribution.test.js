import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { bakePineCluster } from '../src/yuanmingyuan/pine-cluster-baker.js';
import { pineClusterCoverageHash, pineClusterMaterialSet } from '../src/yuanmingyuan/pine-cluster-materials.js';
import { pineClusterNormalBin, pineClusterSigmaNormal, transformPineClusterDistributionNormal } from '../src/yuanmingyuan/pine-cluster-normal-distribution.js';

test('unit normal quadrature retains the unnormalized first moment instead of inflating it', () => {
  for (let i = 0; i < 80; i++) {
    const mean = new THREE.Vector3(Math.sin(i * 1.1), Math.cos(i * .37), Math.cos(i * .7)).normalize().multiplyScalar(.05 + i / 80 * .95), recovered = new THREE.Vector3();
    for (let sample = 0; sample < 4; sample++) { const n = pineClusterSigmaNormal(mean, sample); assert.ok(Math.abs(n.length() - 1) < 1e-12); recovered.addScaledVector(n, .25); }
    assert.ok(mean.distanceTo(recovered) < 1e-12);
  }
  assert.throws(() => pineClusterSigmaNormal(new THREE.Vector3(), 0), /Invalid/);
});

test('coverage and normal selection use independent stable hash domains', () => {
  let count = 0, sumA = 0, sumB = 0, sumAB = 0, accepted = 0, acceptedMean = 0;
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) for (let layer = 0; layer < 3; layer++) {
    const a = pineClusterCoverageHash(x, y, layer), b = pineClusterCoverageHash(x + 173, y + 977, layer + 53);
    count++; sumA += a; sumB += b; sumAB += a * b;
    if (a < .18) { accepted++; acceptedMean += b; }
  }
  assert.ok(Math.abs(sumAB / count - sumA * sumB / (count * count)) < .001);
  assert.ok(Math.abs(acceptedMean / accepted - .5) < .006);
});

test('chart facing preserves original shading normals across the tangent plane with nonuniform rotated instances', () => {
  const chart = new THREE.Vector3(0, 0, 1), shading = new THREE.Vector3(.95, .2, -.08).normalize();
  for (let i = 0; i < 12; i++) {
    const instance = new THREE.Matrix4().compose(new THREE.Vector3(i, 2, -i), new THREE.Quaternion().setFromEuler(new THREE.Euler(.13 * i, .21 * i, -.09 * i)), new THREE.Vector3(.6 + i * .03, 1.7, .9)), modelView = new THREE.Matrix4().makeRotationY(.31);
    const transform = new THREE.Matrix3().getNormalMatrix(modelView.clone().multiply(instance)), forward = chart.clone().applyMatrix3(transform).normalize(), expected = shading.clone().applyMatrix3(transform).normalize();
    assert.ok(transformPineClusterDistributionNormal(shading, modelView, instance, chart, forward).distanceTo(expected) < 1e-12);
    assert.ok(transformPineClusterDistributionNormal(shading, modelView, instance, chart, forward.clone().negate()).distanceTo(expected.clone().negate()) < 1e-12);
  }
});

test('one real terminal streams its six weighted normal bins while retaining source RGB/coverage and bounded fields', async () => {
  const source = createPineClusterSource(); let baked;
  try {
    baked = await bakePineCluster(source, { tileSize: 32, subsamples: 1, grid: 4, terminals: [4] });
    assert.equal(baked.diagnostics.partial, true); assert.equal(baked.normalBins.length, baked.base.length * 6); assert.equal(baked.layers * 6, 252);
    const half = THREE.DataUtils.fromHalfFloat; let checked = 0, maximumMomentError = 0;
    for (let layer = 24; layer < 30; layer++) for (let pixel = 0; pixel < 32 * 32; pixel++) {
      const o = (layer * 32 * 32 + pixel) * 4, alpha = half(baked.base[o + 3]); if (alpha < .001) continue;
      const expected = new THREE.Vector3(...[0, 1, 2].map(k => half(baked.normal[o + k]) / alpha * 2 - 1)), actual = new THREE.Vector3(); let sum = 0;
      for (let bin = 0; bin < 6; bin++) {
        const offset = ((layer * 6 + bin) * 32 * 32 + pixel) * 4, weight = half(baked.normalBins[offset + 3]); if (!weight) continue;
        actual.add(new THREE.Vector3(...[0, 1, 2].map(k => (half(baked.normalBins[offset + k]) / weight * 2 - 1) * weight))); sum += weight;
      }
      assert.ok(Math.abs(sum - alpha) < .001); actual.divideScalar(sum); maximumMomentError = Math.max(maximumMomentError, actual.distanceTo(expected)); checked++;
    }
    assert.ok(checked > 300); assert.ok(maximumMomentError < .004, maximumMomentError);
    console.log(JSON.stringify({ checkedNormalCells: checked, maximumHalfFloatFirstMomentError: maximumMomentError, maximumRowFragments: baked.diagnostics.scratch.maximumRowFragments, peakRSSKiB: process.resourceUsage().maxRSS, gpuUsed: false }));
  } finally { baked?.dispose(); source.dispose(); }
});

test('source geometric face orientation and six-bin quadrature approximate angular lighting without changing light intensity', () => {
  const source = createPineClusterSource();
  try {
    const geometry = source.terminalGeometries[4], p = geometry.attributes.position, normals = geometry.attributes.normal;
    for (let axis = 0; axis < 3; axis++) {
      const direction = new THREE.Vector3().setComponent(axis, 1), bins = Array.from({ length: 6 }, () => ({ area: 0, mean: new THREE.Vector3() })), original = [];
      for (let i = 0; i < geometry.index.count; i += 3) {
        const ids = [0, 1, 2].map(j => geometry.index.getX(i + j)), v = ids.map(id => new THREE.Vector3().fromBufferAttribute(p, id));
        const dot = new THREE.Vector3().crossVectors(v[1].sub(v[0]), v[2].sub(v[0])).dot(direction), area = Math.abs(dot) / 2; if (!area) continue;
        const normal = new THREE.Vector3(); for (const id of ids) normal.add(new THREE.Vector3().fromBufferAttribute(normals, id)); normal.normalize().multiplyScalar(dot < 0 ? -1 : 1);
        const bin = bins[pineClusterNormalBin(normal)]; bin.area += area; bin.mean.addScaledVector(normal, area); original.push({ area, normal });
      }
      const total = bins.reduce((n, b) => n + b.area, 0), quadrature = [];
      for (const bin of bins) if (bin.area) for (let i = 0; i < 4; i++) quadrature.push({ area: bin.area / 4, normal: pineClusterSigmaNormal(bin.mean.clone().divideScalar(bin.area), i) });
      let squared = 0, maximum = 0;
      for (let d = 0; d < 128; d++) {
        const y = 1 - 2 * (d + .5) / 128, radius = Math.sqrt(1 - y * y), angle = d * 2.399963, light = new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
        const integrate = list => list.reduce((n, s) => n + s.area * Math.max(0, s.normal.dot(light)), 0) / total, delta = integrate(quadrature) - integrate(original);
        squared += delta * delta; maximum = Math.max(maximum, Math.abs(delta));
      }
      assert.ok(Math.sqrt(squared / 128) < .01); assert.ok(maximum < .03);
    }
  } finally { source.dispose(); }
});

test('R2 beauty and GBuffer use the same distribution while depth/coverage and PBR remain stock', () => {
  const base = new THREE.DataArrayTexture(), normal = new THREE.DataArrayTexture(), normalBins = new THREE.DataArrayTexture(), transition = { phase: { value: 0 }, role: { value: 0 } }, set = pineClusterMaterialSet({ base, normal, normalBins, transition });
  try {
    let stage;
    for (const [material, library] of [[set.surface, THREE.ShaderLib.standard], [set.normal, THREE.ShaderLib.normal], [set.depth, THREE.ShaderLib.depth], [set.distance, THREE.ShaderLib.distance]]) {
      const shader = { uniforms: {}, vertexShader: library.vertexShader, fragmentShader: library.fragmentShader }; material.onBeforeCompile(shader, {});
      assert.match(shader.fragmentShader, /clusterAlpha <= clusterCoverageThreshold/);
      if ([set.surface, set.normal].includes(material)) {
        const current = shader.fragmentShader.slice(shader.fragmentShader.indexOf('vec4 clusterBinFields[6]'), shader.fragmentShader.indexOf('if (dot(clusterChartNormal, clusterView) < 0.) normal = -normal;') + 65);
        if (stage) assert.equal(current, stage); else stage = current;
        assert.doesNotMatch(shader.fragmentShader, /roughnessFactor = clamp/); assert.match(shader.fragmentShader, /clusterSigmaNormal\(clusterAverageNormal/);
      }
    }
    assert.equal(set.surface.roughness, .77); assert.equal(set.surface.color.getHex(), 0xffffff); assert.equal(set.surface.emissiveIntensity, .045);
  } finally { set.materials.forEach(m => m.dispose()); [base, normal, normalBins].forEach(t => t.dispose()); }
});
