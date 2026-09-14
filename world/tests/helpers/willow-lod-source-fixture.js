import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WILLOW_STUDIO_REVISION, WILLOW_EXPECTED_ASSET_SOURCES } from '../../src/yuanmingyuan/willow-distance-studio-state.js';
import { seededGardenRandom, lanceolateLeafGeometry, curvedBranchGeometry, VegetationInstanceBatch } from '../../src/yuanmingyuan/vegetation-geometry.js';

const sourceUrl = new URL('../../src/yuanmingyuan/garden-vegetation.js', import.meta.url);
const frozenSourceSha = WILLOW_EXPECTED_ASSET_SOURCES['./garden-vegetation.js'];
const historicalSourceSha = 'efd2285a842d94a9f07f9b5d10df9bbeb7e813196c762b7f69fe5ca806115e47';
// Exact helper/roots/willow text in the retained R2 snapshot; Builder is not executed.
const frozenBotanicalSha = '591d550e81d0ca75ec1bad7f58d7e63d36481dcdd2d3511c4eb8ea13ad94e997';
const hash = value => createHash('sha256').update(value).digest('hex');

// Offline test instrument, not a second botanical model. Execute the exact
// frozen private willow function and helpers, interrupting on a branch boundary
// after a small number of real leaf transforms. No trunk/bough geometry, textures,
// other specimens, or full tree factory are constructed.
export async function createWillowSourceFixture({ minimumLeaves = 64 } = {}) {
  if (!Number.isInteger(minimumLeaves) || minimumLeaves < 1 || minimumLeaves > 256) throw new Error('Willow source fixture is limited to 1–256 leaves');
  const source = await readFile(sourceUrl, 'utf8'), sourceSha256 = hash(source);
  if (sourceSha256 !== frozenSourceSha) throw new Error('Frozen willow source changed; review the source capture before updating its hash');
  const helpers = source.slice(source.indexOf('const V ='), source.indexOf('export const gardenVegetationSources'));
  const roots = source.slice(source.indexOf('function roots('), source.indexOf('function willow('));
  const willow = source.slice(source.indexOf('function willow('), source.indexOf('function pine('));
  if (hash(helpers + roots + willow) !== frozenBotanicalSha) throw new Error('Frozen willow botanical text changed');
  const stop = Symbol('bounded willow source capture'), batches = [], branches = [], sourceLeaves = [];
  let capturedLeaf, totalLeaves = 0, stopped = false;
  class RecordGeometryBatch { constructor(name) { this.name = name; this.positions = []; } }
  class RecordInstanceBatch extends VegetationInstanceBatch {
    constructor(name) { super(name); batches.push(this); }
    add(matrix, tint) { super.add(matrix, tint); sourceLeaves.push({ matrix: matrix.clone(), tint }); totalLeaves++; }
  }
  const group = new THREE.Group(); group.name = 'garden-willow';
  const builder = {
    counts: { leaves: 0, curvedBranches: 0 },
    group(parent, name, data) { const child = new THREE.Group(); child.name = name; child.userData = data; parent.add(child); return child; },
    branch(batch, points, radii, options) {
      // Finish the current actual shoot, rather than cut a leaf run in half.
      if (totalLeaves >= minimumLeaves) { stopped = true; throw stop; }
      if (batch.name === 'willow-hanging-twigs' || batch.name === 'willow-detail-twig') branches.push({ batch: batch.name, points: points.map(p => Array.isArray(p) ? [...p] : p.toArray()), radii: [...radii], ...options });
    },
  };
  const invoke = new Function('THREE', 'seededGardenRandom', 'lanceolateLeafGeometry', 'VegetationGeometryBatch', 'VegetationInstanceBatch', `${helpers}\n${roots}\n${willow}\nreturn willow;`)(THREE, seededGardenRandom, options => { capturedLeaf = lanceolateLeafGeometry(options); return capturedLeaf; }, RecordGeometryBatch, RecordInstanceBatch);
  try { invoke(builder, group); } catch (error) { if (error !== stop) { capturedLeaf?.dispose(); throw error; } }
  if (!stopped || totalLeaves > minimumLeaves + 180) { capturedLeaf?.dispose(); throw new Error('Bounded willow fixture failed to stop at a shoot boundary'); }
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .77, side: THREE.DoubleSide, emissive: '#263724', emissiveIntensity: .045 });
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .88 });
  const leaves = batches.filter(batch => batch.matrices.length).map(batch => batch.finish(capturedLeaf, leafMaterial));
  const twigs = branches.map((record, i) => { const geometry = curvedBranchGeometry(record); const mesh = new THREE.Mesh(geometry, stemMaterial); mesh.name = `willow-fixture-source-twig-${i}`; return mesh; });
  group.add(...leaves, ...twigs); group.updateMatrixWorld(true);
  let disposed = false;
  return {
    group, leaves, twigs, leaf: capturedLeaf, leafMaterial, sourceLeaves,
    diagnostics: { sourceRevision: WILLOW_STUDIO_REVISION, sourceSha256, historicalSourceSha256: historicalSourceSha, extractedCodeSha256: hash(helpers + roots + willow), requestedMinimumLeaves: minimumLeaves, sourceLeaves: totalLeaves, completeLeafyShoots: branches.length, fullFactoryCalled: false, otherSpecimensBuilt: false, sourceFunctionCopiedIntoRuntime: false },
    dispose() { if (disposed) return; disposed = true; leaves.forEach(mesh => mesh.dispose()); capturedLeaf.dispose(); twigs.forEach(mesh => mesh.geometry.dispose()); leafMaterial.dispose(); stemMaterial.dispose(); group.clear(); },
  };
}
