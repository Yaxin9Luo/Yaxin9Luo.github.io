import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { captureYuanmingyuanState, serializeYuanmingyuanArchive } from '../scripts/export-yuanmingyuan-assets.mjs';
import { simplifyOverviewGeometry, certifyOverviewSurface, createYuanmingyuanOverview, exportYuanmingyuanOverview } from '../scripts/export-yuanmingyuan-overview.mjs';
import { overviewAffineScaleBound, projectedOverviewError, loadYuanmingyuanOverview } from '../src/yuanmingyuan/asset-overview.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceDigest = sha('small independent full archive fixture');
const quick = () => Promise.resolve();
function surface({ hole = false, grouped = false } = {}) {
  const g = new THREE.PlaneGeometry(4, 4, 8, 8), indices = [[], []], p = g.attributes.position;
  for (let i = 0; i < g.index.count; i += 3) {
    const ids = [...g.index.array.subarray(i, i + 3)], x = ids.reduce((sum, id) => sum + p.getX(id), 0) / 3, y = ids.reduce((sum, id) => sum + p.getY(id), 0) / 3;
    if (hole && Math.abs(x) < .9 && Math.abs(y) < .9) continue;
    indices[grouped && x > 0 ? 1 : 0].push(...ids);
  }
  g.setIndex([...indices[0], ...indices[1]]);
  if (grouped) { g.clearGroups(); g.addGroup(0, indices[0].length, 0); g.addGroup(indices[0].length, indices[1].length, 1); }
  g.setAttribute('color', new THREE.Uint8BufferAttribute(Array.from({ length: p.count * 3 }, (_, i) => [63, 129, 207][i % 3]), 3, true));
  return g;
}
function boundary(geometry, start = 0, count = geometry.index.count) {
  const edges = new Map(), index = geometry.index.array, position = geometry.attributes.position;
  const point = id => [position.getX(id), position.getY(id), position.getZ(id)].join(',');
  for (let i = start; i < start + count; i += 3) for (let j = 0; j < 3; j++) { const a = point(index[i + j]), b = point(index[i + (j + 1) % 3]), key = [a, b].sort().join('>'); edges.set(key, (edges.get(key) ?? 0) + 1); }
  return [...edges].filter(([, n]) => n === 1).map(([key]) => key).sort();
}
function fixture() {
  const group = new THREE.Group(), geometry = surface({ grouped: true }), pixels = new Uint8Array([5, 67, 201, 0, 211, 127, 49, 255, 23, 251, 109, 127, 197, 53, 181, 241]);
  geometry.name = 'two material stone panels';
  const map = new THREE.DataTexture(pixels, 2, 2); map.name = 'unaltered original RGBA pixels'; map.colorSpace = THREE.SRGBColorSpace; map.flipY = true; map.wrapS = THREE.RepeatWrapping; map.repeat.set(2, 1.5); map.needsUpdate = true;
  const material = new THREE.MeshPhysicalMaterial({ color: 0xbba681, map, roughness: .73, side: THREE.DoubleSide, vertexColors: true, clearcoat: .13 }); material.name = 'stone'; material.userData.category = 'stone';
  const alternate = new THREE.MeshStandardMaterial({ color: 0x66463e, roughness: .89, side: THREE.DoubleSide }); alternate.name = 'red plaster';
  const mesh = new THREE.Mesh(geometry, [material, alternate]); mesh.name = 'panel'; mesh.castShadow = mesh.receiveShadow = true; mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide }); mesh.userData = { category: 'architecture', signedZero: -0 }; group.add(mesh);
  const instances = new THREE.InstancedMesh(geometry, [material, alternate], 2); instances.name = 'scaled instances'; instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, 0, 0)); instances.setMatrixAt(1, new THREE.Matrix4().makeShear(.3, 0, .2, 0, 0, 0).scale(new THREE.Vector3(-3, 2, .75)).setPosition(-6, 1, -3)); instances.setColorAt(0, new THREE.Color(.2, .3, .4)); instances.setColorAt(1, new THREE.Color(.8, .7, .6)); instances.instanceMatrix.addUpdateRange(0, 32); group.add(instances);
  const waterGeometry = new THREE.PlaneGeometry(1, 1), waterMaterial = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: .23, transmission: .4, side: THREE.DoubleSide }); waterMaterial.userData = { category: 'water', role: 'surface' }; const water = new THREE.Mesh(waterGeometry, waterMaterial); water.name = 'untouched thin water'; water.position.z = .05; group.add(water);
  group.updateMatrixWorld(true);
  let disposed = false;
  return { group, diagnostics: { assetId: 'overview-fixture', visualAcceptance: false }, dispose() { if (disposed) return; disposed = true; const { objects } = captureYuanmingyuanState({ group }); for (const key of ['geometries', 'materials', 'textures']) for (const object of objects[key]) object.dispose(); instances.dispose(); group.clear(); } };
}

test('error-constrained planar reduction keeps the exact hole boundary and normalized attributes', async t => {
  const geometry = surface({ hole: true }); t.after(() => geometry.dispose()); const original = geometry.index.array.slice();
  const result = await simplifyOverviewGeometry(geometry, { maximumError: .025, materials: [new THREE.MeshStandardMaterial()] }); t.after(() => { if (result.created) result.geometry.dispose(); });
  assert.equal(result.created, true); assert.ok(result.report.overviewTriangles < result.report.originalTriangles); assert.ok(result.report.maximumError < 1e-9);
  assert.deepEqual(boundary(result.geometry), boundary(geometry)); assert.deepEqual(geometry.index.array, original);
  assert.equal(result.geometry.attributes.color.array.constructor, Uint8Array); assert.equal(result.geometry.attributes.color.normalized, true);
  assert.equal(result.report.groups[0].certificate.planarBoundaryAndAffineAttributeCertificate, true);
  const mesh = new THREE.Mesh(result.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); t.after(() => mesh.material.dispose()); mesh.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)).intersectObject(mesh).length, 0);
  assert.ok(new THREE.Raycaster(new THREE.Vector3(1.5, .1, 5), new THREE.Vector3(0, 0, -1)).intersectObject(mesh).length > 0);
});

test('each material group keeps its own oriented boundary and material index', async t => {
  const geometry = surface({ grouped: true }); t.after(() => geometry.dispose());
  const result = await simplifyOverviewGeometry(geometry, { maximumError: .03 }); t.after(() => { if (result.created) result.geometry.dispose(); });
  assert.equal(result.created, true); assert.equal(result.geometry.groups.length, 2);
  for (let i = 0; i < 2; i++) { const source = geometry.groups[i], output = result.geometry.groups[i]; assert.equal(output.materialIndex, source.materialIndex); assert.deepEqual(boundary(result.geometry, output.start, output.count), boundary(geometry, source.start, source.count)); }
});

test('bidirectional certificate catches geometry that fills a hole even when all retained vertices came from source', () => {
  const positions = new Float32Array([-2,-2,0, 2,-2,0, 2,2,0, -2,2,0, -.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0]);
  const ring = new Uint32Array([0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7]), filled = new Uint32Array([0,1,2,0,2,3]);
  const result = certifyOverviewSurface({ positions, sourceIndices: ring, targetIndices: filled, maximumError: .05, maximumCells: 2000 });
  assert.equal(result.certified, false); assert.ok(result.failure); assert.ok(result.sampledMaximumNearestDistance > .05 || result.failure.includes('limit'));
});

test('a sparse vertex-only comparison cannot pass an interior bump; full surface certificate rejects it', () => {
  const positions = new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0, 0,0,.4]);
  const raised = new Uint32Array([0,1,4,1,2,4,2,3,4,3,0,4]), flat = new Uint32Array([0,1,2,0,2,3]);
  const result = certifyOverviewSurface({ positions, sourceIndices: raised, targetIndices: flat, maximumError: .03, maximumCells: 2000 }); assert.equal(result.certified, false); assert.ok(result.sampledMaximumNearestDistance > .03);
});

test('finite certification limits retain source geometry instead of accepting an approximate error', async t => {
  const geometry = surface(); geometry.attributes.position.setZ(40, .003); geometry.computeVertexNormals(); t.after(() => geometry.dispose());
  const result = await simplifyOverviewGeometry(geometry, { maximumError: .02, maximumCells: 1, maximumDepth: 0 }); t.after(() => { if (result.created) result.geometry.dispose(); });
  assert.equal(result.created, false); assert.equal(result.geometry, geometry); assert.equal(result.report.maximumError, 0);
  assert.ok(result.report.groups.some(group => group.retainedReason));
});

test('curved triangulated surface gets a measured lower bound and full cover upper bound', async t => {
  const geometry = new THREE.PlaneGeometry(4, 4, 6, 6); geometry.deleteAttribute('uv'); const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setZ(i, .0005 * position.getX(i) ** 2); geometry.computeVertexNormals(); t.after(() => geometry.dispose());
  const result = await simplifyOverviewGeometry(geometry, { maximumError: .03, maximumCells: 5000 }); t.after(() => { if (result.created) result.geometry.dispose(); });
  assert.equal(result.created, true); assert.equal(result.report.overviewTriangles, 22);
  const proof = result.report.groups[0].certificate; assert.equal(proof.certified, true); assert.ok(proof.clippedPolygonLeaves > 0); assert.ok(proof.sampledMaximumNearestDistance > .0004); assert.ok(proof.certifiedMaximumError < .0005); assert.ok(proof.sampledMaximumNearestDistance <= proof.certifiedMaximumError); assert.ok(proof.checkedCells < 1000);
  console.log('OVERVIEW_CURVED_FIXTURE ' + JSON.stringify({ sourceTriangles: result.report.originalTriangles, overviewTriangles: result.report.overviewTriangles, ...proof }));
});

test('water, cutouts, degenerate, partial draw, and unsupported attributes are retained exactly', async t => {
  for (const scenario of ['water', 'alpha', 'degenerate', 'partial', 'attribute']) {
    const geometry = surface(), material = new THREE.MeshStandardMaterial(); t.after(() => { geometry.dispose(); material.dispose(); });
    if (scenario === 'water') material.userData.category = 'water';
    if (scenario === 'alpha') material.alphaTest = .3;
    if (scenario === 'degenerate') geometry.index.array[1] = geometry.index.array[0];
    if (scenario === 'partial') geometry.setDrawRange(0, 3);
    if (scenario === 'attribute') geometry.setAttribute('unverified', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
    const result = await simplifyOverviewGeometry(geometry, { materials: [material], maximumError: 1 }); assert.equal(result.created, false, scenario); assert.equal(result.geometry, geometry);
  }
});

test('exact non-indexed welding preserves normal and UV seams without quantization', async t => {
  const source = new THREE.BoxGeometry(2, 2, 2, 2, 2, 2), geometry = source.toNonIndexed(); source.dispose(); t.after(() => geometry.dispose());
  const sourceTuples = new Set(Array.from({ length: geometry.attributes.position.count }, (_, i) => ['position', 'normal', 'uv'].flatMap(name => Array.from(geometry.attributes[name].array.subarray(i * geometry.attributes[name].itemSize, (i + 1) * geometry.attributes[name].itemSize))).join(',')));
  const result = await simplifyOverviewGeometry(geometry, { maximumError: .05, maximumCells: 3000 }); t.after(() => { if (result.created) result.geometry.dispose(); });
  for (let i = 0; i < result.geometry.attributes.position.count; i++) assert.ok(sourceTuples.has(['position', 'normal', 'uv'].flatMap(name => Array.from(result.geometry.attributes[name].array.subarray(i * result.geometry.attributes[name].itemSize, (i + 1) * result.geometry.attributes[name].itemSize))).join(',')));
  assert.equal(geometry.index, null);
});

test('overview retains real texture pixels, instancing, shadow flags, and independent ownership', async t => {
  const source = fixture(); t.after(source.dispose); const baseline = captureYuanmingyuanState(source).state;
  const result = await createYuanmingyuanOverview(source, { id: 'overview-fixture', sourceArchiveDigest: sourceDigest, maximumErrorWorld: .04 }); t.after(result.dispose);
  assert.deepEqual(captureYuanmingyuanState(source).state, baseline); assert.ok(result.report.overviewTriangles < result.report.originalTriangles);
  const a = source.group.getObjectByName('scaled instances'), b = result.group.getObjectByName('scaled instances'); assert.equal(b.isInstancedMesh, true); assert.equal(b.count, a.count); assert.deepEqual(b.instanceMatrix.array, a.instanceMatrix.array); assert.deepEqual(b.instanceColor.array, a.instanceColor.array); assert.deepEqual(b.instanceMatrix.updateRanges, a.instanceMatrix.updateRanges);
  assert.equal(result.group.getObjectByName('panel').geometry, b.geometry); assert.notEqual(b.geometry, a.geometry);
  const panel = result.group.getObjectByName('panel'); for (const [i, material] of panel.material.entries()) assert.equal(material, source.group.getObjectByName('panel').material[i]); assert.equal(panel.castShadow, true); assert.equal(panel.receiveShadow, true); assert.ok(Object.is(panel.userData.signedZero, -0)); assert.equal(panel.customDepthMaterial, source.group.getObjectByName('panel').customDepthMaterial);
  assert.equal(result.group.getObjectByName('untouched thin water').geometry, source.group.getObjectByName('untouched thin water').geometry);
  assert.ok(result.report.geometries[0].maximumSourceWorldScaleBound >= 3); assert.ok(result.report.maximumErrorArchiveWorld <= .04);
  let newGeometryDisposed = 0, borrowedDisposed = 0, newInstanceDisposed = 0; b.geometry.addEventListener('dispose', () => newGeometryDisposed++); a.geometry.addEventListener('dispose', () => borrowedDisposed++); b.addEventListener('dispose', () => newInstanceDisposed++);
  result.dispose(); result.dispose(); assert.equal(newGeometryDisposed, 1); assert.equal(newInstanceDisposed, 1); assert.equal(borrowedDisposed, 0); assert.deepEqual(captureYuanmingyuanState(source).state, baseline);
});

test('the affine scale bound covers shear, reflection, and every sampled displacement direction', () => {
  const matrix = new THREE.Matrix4().makeShear(2, .5, .3, -.4, .2, 1.1).scale(new THREE.Vector3(-2, .3, 4)), bound = overviewAffineScaleBound(matrix);
  const linear = new THREE.Matrix3().setFromMatrix4(matrix);
  for (let i = 0; i < 200; i++) { const v = new THREE.Vector3(Math.sin(i * 1.17), Math.cos(i * .71), Math.sin(i * .43 + 1)).normalize(); assert.ok(v.applyMatrix3(linear).length() <= bound + 1e-12); }
  assert.throws(() => overviewAffineScaleBound(new THREE.Matrix4().makePerspective(-1, 1, 1, -1, .1, 100)), /affine/);
});

function cameraAt(z = 100) { const camera = new THREE.PerspectiveCamera(50, 1.5, .1, 2000); camera.position.set(0, 0, z); camera.updateMatrixWorld(true); return camera; }
const bounds = { min: [-2,-2,-2], max: [2,2,2] };
test('selection uses physical drawing-buffer pixels, zoom and nearest depth; off-axis displacement is bounded', () => {
  const camera = cameraAt(), common = { camera, physicalWidth: 1500, physicalHeight: 1000, bounds, error: .025 };
  const normal = projectedOverviewError(common), highDPI = projectedOverviewError({ ...common, physicalWidth: 3000, physicalHeight: 2000 }); assert.equal(normal.eligible, true); assert.equal(highDPI.eligible, false); assert.ok(highDPI.projectedErrorPhysicalPixels > normal.projectedErrorPhysicalPixels * 1.99);
  camera.zoom = 2; camera.updateProjectionMatrix(); assert.equal(projectedOverviewError(common).eligible, false);
  camera.zoom = 1; camera.updateProjectionMatrix(); const offset = new THREE.Matrix4().makeTranslation(90, 0, 0), offAxis = projectedOverviewError({ ...common, placementMatrix: offset }); assert.ok(offAxis.projectedErrorPhysicalPixels > normal.projectedErrorPhysicalPixels);
  for (let i = 0; i < 200; i++) {
    const a = new THREE.Vector3(Math.sin(i) * 2, Math.cos(i * .7) * 2, Math.sin(i * .3) * 2).applyMatrix4(offset), displacement = new THREE.Vector3(Math.sin(i * .53), Math.cos(i * .43), Math.sin(i * 1.11)).normalize().multiplyScalar(.025), b = a.clone().add(displacement);
    const pa = a.project(camera), pb = b.project(camera), pixels = Math.hypot((pa.x - pb.x) * 750, (pa.y - pb.y) * 500); assert.ok(pixels <= offAxis.projectedErrorPhysicalPixels + 1e-8);
  }
  camera.position.z = 3; camera.updateMatrixWorld(true); assert.equal(projectedOverviewError(common).eligible, false); assert.throws(() => projectedOverviewError({ ...common, pixelBudget: 1 }), /budget/);
});

test('orthographic zoom controls error and a greater distance does not relax the budget', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 2000); camera.position.z = 100; camera.updateMatrixWorld(true);
  const a = projectedOverviewError({ camera, bounds, physicalWidth: 1000, physicalHeight: 1000, error: .02 }); assert.equal(a.eligible, false); assert.equal(a.distanceCanImproveError, false); assert.equal(a.minimumCentreDepth, null);
  camera.position.z = 1000; camera.updateMatrixWorld(true); const b = projectedOverviewError({ camera, bounds, physicalWidth: 1000, physicalHeight: 1000, error: .02 }); assert.equal(a.projectedErrorPhysicalPixels, b.projectedErrorPhysicalPixels);
});

test('small real archive export roundtrips overview materials and only publishes gzip binary transports', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'yuanmingyuan-overview-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const source = fixture(); t.after(source.dispose); const full = await serializeYuanmingyuanArchive(source, { id: 'overview-fixture' });
  const fullDirectory = join(directory, 'full'); await mkdir(fullDirectory);
  const manifest = { schema: 1, id: 'overview-fixture', sourceDigest, glb: { url: 'overview-fixture.glb', bytes: full.glb.length, sha256: sha(full.glb) }, runtime: { url: 'overview-fixture.runtime.json', bytes: full.runtime.length, sha256: sha(full.runtime) }, verification: full.metadata.verification };
  await writeFile(join(fullDirectory, manifest.glb.url), full.glb); await writeFile(join(fullDirectory, manifest.runtime.url), full.runtime); await writeFile(join(fullDirectory, 'manifest.json'), JSON.stringify(manifest));
  const result = await exportYuanmingyuanOverview({ id: manifest.id, archiveDirectory: fullDirectory, maximumErrorWorld: .04, outputDirectory: join(directory, 'overview'), publicRoot: join(directory, 'public') });
  assert.equal(sha(await readFile(join(fullDirectory, manifest.glb.url))), manifest.glb.sha256); assert.equal(sha(await readFile(join(fullDirectory, manifest.runtime.url))), manifest.runtime.sha256);
  assert.ok(result.overview.overviewTriangles < result.overview.originalTriangles); assert.equal(result.manifest.fullResolutionReplaced, false); assert.equal(result.manifest.verification.simplified, true); assert.equal(result.manifest.nativeOverviewVisualReview, false); assert.equal(result.manifest.resourceDisposal.uniqueResources, result.manifest.resourceDisposal.disposedExactlyOnce);
  assert.match(result.manifest.glb.url, /\.glb\.gzip\.bin$/); assert.match(result.manifest.runtime.url, /\.json\.gzip\.bin$/);
  const fetched = [], fetchImpl = async (url, { signal } = {}) => { if (signal?.aborted) throw signal.reason; const path = join(result.publicOutput, url); fetched.push(url); return new Response(await readFile(path)); };
  const restored = await loadYuanmingyuanOverview(result.manifest, { fetchImpl, yieldControl: quick }); t.after(restored.dispose);
  const panel = restored.group.getObjectByName('panel'); assert.deepEqual([...panel.material[0].map.image.data], [...source.group.getObjectByName('panel').material[0].map.image.data]); assert.equal(panel.material[0].map.colorSpace, THREE.SRGBColorSpace); assert.equal(panel.material[0].map.flipY, true); assert.equal(panel.material[0].side, THREE.DoubleSide); assert.equal(panel.receiveShadow, true); assert.equal(panel.castShadow, true);
  assert.equal(restored.evaluate().reason, 'native-overview-review-required'); const evaluation = restored.evaluate({ camera: cameraAt(1000), physicalWidth: 3000, physicalHeight: 2000, approvedOverviewSHA256: result.manifest.overview.sha256 }); assert.equal(evaluation.selection, 'overview');
  restored.dispose(); restored.dispose(); assert.equal(restored.evaluate().reason, 'overview-disposed');
  await assert.rejects(loadYuanmingyuanOverview({ ...result.manifest, overview: { ...result.manifest.overview, sha256: '0'.repeat(64) } }, { fetchImpl }), /SHA256/);
  const controller = new AbortController(); controller.abort(new Error('cancel fixture')); await assert.rejects(loadYuanmingyuanOverview(result.manifest, { fetchImpl, signal: controller.signal }), /cancel fixture/);
  assert.equal(fetched.filter(url => url.endsWith('.glb.gzip.bin')).length, 1);
  console.log('OVERVIEW_SMALL_FIXTURE ' + JSON.stringify({ originalTriangles: result.overview.originalTriangles, overviewTriangles: result.overview.overviewTriangles, maximumErrorArchiveWorld: result.overview.maximumErrorArchiveWorld, reportSHA256: result.manifest.overview.sha256, glbBytes: result.manifest.glb.bytes, transferBytes: result.manifest.glb.transferBytes, resources: result.manifest.resourceDisposal, nativeVisualReview: false }));
});
