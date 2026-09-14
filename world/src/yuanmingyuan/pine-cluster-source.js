import * as THREE from 'three';
import { pineShootGeometry, curvedBranchGeometry, VegetationGeometryBatch, seededGardenRandom, gardenValueNoise } from './vegetation-geometry.js';
import { pineShootMaterialSet, attachPineShootMaterials } from './pine-shoot-lod-materials.js';
import { PINE_CLUSTER_RECORDS } from './pine-cluster-records.js';

/** Exact procedural bark grain used by the retained source's small branches.
 * Mature plated limbs and trunk are outside this one-secondary-branch crop. */
export function pineClusterBarkTexture() {
  const size = 256, data = new Uint8Array(size * size * 4), rng = seededGardenRandom(1092);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const broad = gardenValueNoise(x / size * 19, y / size * 3, .34, 39), fine = gardenValueNoise(x / size * 71 + 3, y / size * 13, 1.79, 78);
    const value = Math.round(237 - (Math.max(0, broad) ** 3 * 57 + Math.max(0, fine) * 16) + (rng() - .5) * 9);
    data.set([value, value, value, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'pine-cluster-original-small-branch-grain'; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}

export function pineClusterBranchGeometry(records = PINE_CLUSTER_RECORDS) {
  const batch = new VegetationGeometryBatch('pine-cluster-eight-original-support-branches');
  for (const record of records.branches) {
    const geometry = curvedBranchGeometry({ points: record.points, radii: record.radii, ...record.options });
    try { batch.add(geometry); } finally { geometry.dispose(); }
  }
  return batch.finish();
}

export function createPineClusterSource() {
  const records = PINE_CLUSTER_RECORDS, group = new THREE.Group(), transition = { phase: { value: 0 }, role: { value: 0 } };
  const geometries = new Map(), instances = [], meshes = [], materials = pineShootMaterialSet({ transition, name: 'pine-cluster-original-shoots' });
  const barkTexture = pineClusterBarkTexture(), bark = pineShootMaterialSet({ transition, name: 'pine-cluster-original-support-wood' });
  bark.surface.roughness = .96; bark.surface.side = THREE.FrontSide; bark.surface.emissiveIntensity = 0;
  bark.surface.map = barkTexture; bark.surface.bumpMap = barkTexture; bark.surface.bumpScale = .018;
  const terminalGeometries = [], branchGeometry = pineClusterBranchGeometry(records);
  let disposed = false;
  try {
    for (const seed of [218, 591, 832]) geometries.set(seed, pineShootGeometry({ seed }));
    for (const [seed, geometry] of geometries) {
      const entries = records.shoots.filter(r => r.seed === seed && r.kind === 'InstancedMesh'), mesh = new THREE.InstancedMesh(geometry, materials.surface, entries.length);
      mesh.name = 'pine-cluster-source-' + seed; mesh.instanceMatrix.array.set(entries.flatMap(r => r.matrix));
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(entries.flatMap(r => [r.tint, r.tint, r.tint])), 3);
      mesh.userData.sourceRecordIds = entries.map(r => r.id); attachPineShootMaterials(mesh, materials);
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); instances.push(mesh); meshes.push(mesh); group.add(mesh);
    }
    for (const record of records.shoots.filter(r => r.kind === 'Mesh')) {
      const mesh = new THREE.Mesh(geometries.get(record.seed), materials.surface); mesh.name = 'pine-cluster-source-original-detail-mesh';
      mesh.applyMatrix4(new THREE.Matrix4().fromArray(record.matrix)); mesh.userData.sourceRecordIds = [record.id]; attachPineShootMaterials(mesh, materials); meshes.push(mesh); group.add(mesh);
    }
    const branchMesh = new THREE.Mesh(branchGeometry); attachPineShootMaterials(branchMesh, bark); branchMesh.name = branchGeometry.name; meshes.push(branchMesh); group.add(branchMesh);
    // These CPU-only terminal soups are bake inputs. Source drawing retains the
    // original instancing and detail-Mesh transforms above without resampling.
    for (let terminal = 0; terminal < 7; terminal++) {
      const batch = new VegetationGeometryBatch('pine-cluster-terminal-bake-input-' + terminal);
      for (const record of records.shoots.filter(r => r.terminal === terminal)) batch.add(geometries.get(record.seed), new THREE.Matrix4().fromArray(record.matrix), record.tint);
      terminalGeometries.push(batch.finish());
    }
    group.name = 'pine-cluster-arm-3-fork-6-source'; group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group), triangles = records.shoots.reduce((n, r) => n + geometries.get(r.seed).index.count / 3, branchGeometry.index.count / 3);
    return { group, records, geometries, terminalGeometries, branchGeometry, transition, bounds, meshes, materials: [...materials.materials, ...bark.materials], textures: [barkTexture],
      diagnostics: { id: records.id, shoots: records.shoots.length, terminalSprays: 7, supportBranches: 8, triangles, woodTriangles: branchGeometry.index.count / 3, drawCallsPerPass: meshes.length, originalShootTriangles: records.shoots.length * 4160, originalInstances: 27, originalDetailMeshes: 1, source: records.source, coordinates: records.coordinates, completeTreeConstructed: false, nativeReviewed: false },
      dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); instances.forEach(m => m.dispose()); for (const g of [...geometries.values(), ...terminalGeometries, branchGeometry]) g.dispose(); for (const m of [...materials.materials, ...bark.materials]) m.dispose(); barkTexture.dispose(); },
    };
  } catch (error) { group.clear(); instances.forEach(m => m.dispose()); for (const g of [...geometries.values(), ...terminalGeometries, branchGeometry]) g.dispose(); [...materials.materials, ...bark.materials].forEach(m => m.dispose()); barkTexture.dispose(); throw error; }
}
