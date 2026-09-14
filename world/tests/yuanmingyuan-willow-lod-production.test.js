import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { createGardenVegetationStudy } from '../src/yuanmingyuan/garden-vegetation.js';
import { buildWillowLodLevels, inspectWillowBranchTubes } from '../src/yuanmingyuan/willow-lod-geometry.js';
import { createWillowLodPilot } from '../src/yuanmingyuan/willow-lod-runtime.js';
import { vegetationGeometrySignatures } from './helpers/yuanmingyuan-vegetation-signatures.js';

const reportPath = process.env.WILLOW_LOD_PRODUCTION_REPORT;
const sources = ['willow-lod-geometry.js', 'willow-lod-runtime.js', 'willow-lod-study-views.js', 'garden-vegetation.js', 'vegetation-wood-stability.js', 'vegetation-geometry.js', 'vegetation-textures.js', 'garden-vegetation-views.js'];
async function sourceHashes() { return Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(new URL('../src/yuanmingyuan/' + file, import.meta.url))).digest('hex')]))); }
function ownedObjects(group) {
  const objects = new Set(); group.traverse(mesh => { if (!mesh.isMesh) return; objects.add(mesh.geometry); objects.add(mesh.material); if (mesh.isInstancedMesh) objects.add(mesh); for (const value of Object.values(mesh.material)) if (value?.isTexture) objects.add(value); }); return objects;
}
function watch(objects) { const counts = new Map([...objects].map(o => [o, 0])); for (const o of objects) o.addEventListener('dispose', () => counts.set(o, counts.get(o) + 1)); return counts; }
function sampledDistance(source, target) {
  // indirect=true keeps the frozen index array byte-for-byte unchanged.
  const bvh = new MeshBVH(target, { indirect: true }), p = source.attributes.position, index = source.index, a = new THREE.Vector3(), b = a.clone(), c = a.clone(), point = a.clone(), hit = { point: a.clone() }; let maximum = 0, samples = 0;
  const sample = position => { bvh.closestPointToPoint(position, hit); maximum = Math.max(maximum, hit.distance); samples++; };
  const vertexStride = Math.max(1, Math.floor(p.count / 700)); for (let i = 0; i < p.count; i += vertexStride) sample(point.fromBufferAttribute(p, i));
  const triangleStride = Math.max(1, Math.floor(index.count / 3 / 700)); for (let i = 0; i < index.count / 3; i += triangleStride) { a.fromBufferAttribute(p, index.getX(i * 3)); b.fromBufferAttribute(p, index.getX(i * 3 + 1)); c.fromBufferAttribute(p, index.getX(i * 3 + 2)); sample(point.copy(a).add(b).add(c).multiplyScalar(1 / 3)); }
  return { maximum, samples, certifiedHausdorff: false };
}

// This test only runs when the root grants the single production CPU slot and
// supplies an evidence path. A routine fixture run never creates a whole tree.
test('willow production: one frozen willow, actual levels, source identity and disposal', { skip: !reportPath }, async () => {
  let source, levels, pilot; const started = performance.now(), report = { startedAt: new Date().toISOString(), status: 'running', scope: 'one willow only; no other specimen, browser, GPU or landscape population', sourceBefore: await sourceHashes(), before: process.memoryUsage() };
  try {
    const t0 = performance.now(); source = createGardenVegetationStudy({ specimens: ['willow'] }); report.sourceFactoryMilliseconds = performance.now() - t0; report.afterSource = process.memoryUsage();
    const baseline = JSON.parse(await readFile(new URL('./fixtures/yuanmingyuan-vegetation-r3-nonstone.json', import.meta.url), 'utf8')).signatures.find(s => s.id === 'willow');
    const signature = vegetationGeometrySignatures(source.group).find(s => s.id === 'willow'); assert.equal(signature.sha256, baseline.sha256); report.sourceSignature = signature; report.sourceDiagnostics = source.diagnostics;
    const sourceResources = ownedObjects(source.group), sourceDisposals = watch(sourceResources);
    const t1 = performance.now(); levels = await buildWillowLodLevels(source); report.levelBuildMilliseconds = performance.now() - t1; report.afterLevels = process.memoryUsage(); report.levels = levels.diagnostics;
    assert.equal(levels.diagnostics.foliage.inputLeaves, 304297); assert.equal(levels.diagnostics.foliage.unrepresentedSourceLeaves, 0); assert.ok(levels.diagnostics.mid.triangles < 7925316);
    const levelDisposals = watch(new Set([...levels.mid, ...levels.far].map(r => r.geometry)));
    for (const record of [...levels.mid, ...levels.far]) {
      const p = record.geometry.attributes.position, index = record.geometry.index;
      for (const attribute of Object.values(record.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      for (const value of index.array) assert.ok(value < p.count);
      if (record.name.includes('foliage')) continue;
      assert.equal(inspectWillowBranchTubes(record.geometry).length, record.geometry.userData.sourceTubes);
      const original = source.group.getObjectByName(record.name.replace(/-(mid|far)$/, ''));
      const forward = sampledDistance(original.geometry, record.geometry), reverse = sampledDistance(record.geometry, original.geometry);
      (report.woodSurfaceChecks ??= []).push({ name: record.name, sourceToLod: forward, lodToSource: reverse, requestedError: record.geometry.userData.requestedError });
      assert.ok(Math.max(forward.maximum, reverse.maximum) <= record.geometry.userData.requestedError + .001, `${record.name}: sampled curved surface exceeds tolerance`);
    }
    const t2 = performance.now(); pilot = createWillowLodPilot({ source, levels }); report.pilotMilliseconds = performance.now() - t2; report.afterPilot = process.memoryUsage();
    const pilotResources = new Set(Object.values(pilot.representations).flatMap(r => Object.values(r.resources).flat())), pilotDisposals = watch(pilotResources);
    for (const original of signature.meshes) {
      const a = source.group.getObjectByName(original.name), b = pilot.representations.near.group.getObjectByName(original.name); assert.ok(b);
      for (const name of Object.keys(a.geometry.attributes)) assert.equal(a.geometry.attributes[name].array, b.geometry.attributes[name].array);
      if (a.isInstancedMesh) { assert.notEqual(a.instanceMatrix.array, b.instanceMatrix.array); assert.deepEqual(a.instanceMatrix.array, b.instanceMatrix.array); assert.deepEqual(a.instanceColor.array, b.instanceColor.array); }
    }
    for (const phase of [0, .25, .5, .75, 1]) { pilot.setBlend('near', 'mid', phase); pilot.setBlend('mid', 'far', phase); }
    assert.equal(vegetationGeometrySignatures(source.group).find(s => s.id === 'willow').sha256, baseline.sha256);
    pilot.dispose(); pilot.dispose(); for (const count of pilotDisposals.values()) assert.equal(count, 1); for (const count of sourceDisposals.values()) assert.equal(count, 0);
    levels.dispose(); levels.dispose(); for (const count of levelDisposals.values()) assert.equal(count, 1); for (const count of sourceDisposals.values()) assert.equal(count, 0);
    source.dispose(); source.dispose(); for (const count of sourceDisposals.values()) assert.equal(count, 1);
    report.disposal = { verified: true, idempotent: true, observedSourceResources: sourceResources.size, generatedGeometries: levelDisposals.size, independentPilotResources: pilotResources.size, sourcePrivateUnusedMaterialsNotEnumerated: true };
    report.sourceAfter = await sourceHashes(); assert.deepEqual(report.sourceAfter, report.sourceBefore); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = { message: error.message, stack: error.stack }; throw error; }
  finally { pilot?.dispose(); levels?.dispose(); source?.dispose(); report.totalMilliseconds = performance.now() - started; report.peakRssKiB = process.resourceUsage().maxRSS; report.afterDispose = process.memoryUsage(); report.nativeReviewed = false; report.mainSceneAllowed = false; await writeFile(reportPath, JSON.stringify(report, null, 2)); }
});
