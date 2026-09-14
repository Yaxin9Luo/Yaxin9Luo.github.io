// Offline instrumentation of the unchanged real pine control flow. No whole
// tree meshes, bark textures, archive, browser or renderer are constructed.
import * as THREE from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seededGardenRandom, pineShootGeometry, VegetationGeometryBatch } from '../src/yuanmingyuan/vegetation-geometry.js';

const sha = value => createHash('sha256').update(value).digest('hex');
const sourceURL = new URL('../src/yuanmingyuan/garden-vegetation.js', import.meta.url);
const source = await readFile(sourceURL, 'utf8');
const rootsText = source.slice(source.indexOf('function roots('), source.indexOf('\nfunction willow('));
const pineText = source.slice(source.indexOf('function pine('), source.indexOf('\nfunction juniperSpray('));
if (!rootsText || !pineText) throw new Error('Actual private pine/roots functions were not found');
const V = (...a) => new THREE.Vector3(...a), UP = V(0, 1, 0), ONE = V(1, 1, 1), TAU = Math.PI * 2;
const pose = (p = [0, 0, 0], q = new THREE.Quaternion(), s = ONE) => new THREE.Matrix4().compose(Array.isArray(p) ? V(...p) : p, q, s);
const aim = (v, r = 0) => new THREE.Quaternion().setFromUnitVectors(UP, v.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, r));
const curveOf = ps => new THREE.CatmullRomCurve3(ps.map(p => Array.isArray(p) ? V(...p) : p.clone()), false, 'centripetal');
const shoots = [], branches = [], geometries = new Map();
let arm = -1, fork = -1, terminal = -1, cluster = 0, branchCalls = 0, batchIndex = 0;
function record(matrix, tint, geometryIndex, kind) {
  shoots.push({ id: `arm-${arm}/fork-${fork}/terminal-${terminal}/shoot-${cluster++}`, arm, fork, terminal, geometryIndex, seed: [218, 591, 832][geometryIndex], kind,
    matrix: kind === 'InstancedMesh' ? [...new Float32Array(matrix.elements)] : matrix.toArray(), tint: kind === 'InstancedMesh' ? Math.fround(tint) : 1 });
}
class RecorderInstances {
  constructor(name) { this.name = name; this.geometryIndex = batchIndex++; }
  add(matrix, tint) { record(matrix, tint, this.geometryIndex, 'InstancedMesh'); }
}
const b = {
  m: { leaves: {} }, counts: { needleFascicles: 0, livePineShoots: 0 },
  group() { return {}; }, pineBarkMaterial() { return {}; }, flush() {}, instanceFlush() {},
  mesh(parent, geometry) { return { applyMatrix4(matrix) { record(matrix, 1, geometries.get(geometry), 'Mesh'); } }; },
  branch(batch, points, radii, options) {
    branchCalls++;
    if (batch.name === 'pine-mature-plated-boughs') { arm++; fork = -1; terminal = -1; }
    if (batch.name !== 'pine-layered-curved-boughs') return;
    if (radii[0] === .029) { fork++; terminal = -1; }
    else { terminal++; cluster = 0; }
    branches.push({ id: `arm-${arm}/fork-${fork}/${terminal < 0 ? 'secondary' : 'terminal-' + terminal}`, arm, fork, terminal, points: points.map(p => Array.isArray(p) ? p : p.toArray()), radii, options });
  },
};
const geometryFactory = options => { const g = pineShootGeometry(options); geometries.set(g, [218, 591, 832].indexOf(options.seed)); return g; };
const evaluate = new Function('seededGardenRandom', 'VegetationGeometryBatch', 'VegetationInstanceBatch', 'pineShootGeometry', 'THREE', 'V', 'UP', 'ONE', 'TAU', 'pose', 'aim', 'curveOf', rootsText + '\n' + pineText + '\nreturn pine;');
const started = performance.now();
try { evaluate(seededGardenRandom, VegetationGeometryBatch, RecorderInstances, geometryFactory, THREE, V, UP, ONE, TAU, pose, aim, curveOf)(b, { userData: {} }); }
finally { for (const geometry of geometries.keys()) geometry.dispose(); }
const selectedShoots = shoots.filter(x => x.arm === 3 && x.fork === 6), selectedBranches = branches.filter(x => x.arm === 3 && x.fork === 6);
if (selectedShoots.length !== 28 || selectedBranches.length !== 8 || shoots.length !== 3276 || new Set(shoots.map(x => x.id)).size !== 3276) throw new Error('Unexpected actual pine record topology');
const recordSet = {
  version: 1, id: 'pine-arm-3-secondary-6', source: { path: 'src/yuanmingyuan/garden-vegetation.js', sha256: sha(source), pineFunctionSha256: sha(pineText), rootsFunctionSha256: sha(rootsText), geometrySha256: sha(await readFile(new URL('../src/yuanmingyuan/vegetation-geometry.js', import.meta.url))), method: 'Execute actual private pine/roots function bytes with a branch/instance recorder; no mature branch geometry or full tree constructed', authoredIndividual: true, historicalBranchSurvey: false },
  wholePineRecordCounts: { liveShoots: shoots.length, instancedShoots: shoots.filter(x => x.kind === 'InstancedMesh').length, detailMeshes: shoots.filter(x => x.kind === 'Mesh').length, branchCalls, sourceShootGeometries: geometries.size, allRecordsSha256: sha(JSON.stringify({ shoots, branches })) },
  coordinates: 'Actual pine root-local metres, before gardenVegetationSpecs pine placement [1,0,-3]; no jitter, rearrangement or rescaling', shoots: selectedShoots, branches: selectedBranches,
};
const destination = new URL('../src/yuanmingyuan/pine-cluster-records.js', import.meta.url);
const serialized = '// Generated by scripts/pine-cluster-record.mjs from the unchanged source control flow.\nexport const PINE_CLUSTER_RECORDS = ' + JSON.stringify(recordSet, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== serialized) throw new Error('Saved cluster records differ from the actual source recorder');
} else await writeFile(destination, serialized);
const report = { ...recordSet.source, milliseconds: performance.now() - started, recordCounts: recordSet.wholePineRecordCounts, selectedShoots: selectedShoots.length, selectedBranches: selectedBranches.length, output: fileURLToPath(destination), outputSha256: sha(await readFile(destination)), completeTreeConstructed: false, resourcesDisposed: geometries.size };
const reportDir = new URL('../../work/yuanmingyuan/pine-cluster-r1/', import.meta.url);
if (!process.argv.includes('--check')) { await mkdir(reportDir, { recursive: true }); await writeFile(new URL('recording.json', reportDir), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report, null, 2));
