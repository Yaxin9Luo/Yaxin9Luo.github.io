import * as THREE from 'three';
import {createGroveTree} from './grove-foliage.js';
import {attachWindShadows} from './environment-wind.js';

export const FOLIAGE_LOD = Object.freeze({
  chunkSize: 40,
  nearEnterPixels: 260, nearExitPixels: 220,
  nearEnterDistance: 34, nearExitDistance: 43,
  farEnterPixels: 76, farExitPixels: 96,
  farEnterDistance: 125, farExitDistance: 108,
});
const names = ['near', 'mid', 'far'];
const triangleCount = mesh => (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;

/** Deliberately no camera-frustum visibility flag: offscreen crowns can cast
 * shadows into the visible ground, or be visible in the lake reflection. */
export function selectFoliageDetail(previous, projectedPixels, distance, policy = FOLIAGE_LOD) {
  if (![projectedPixels, distance].every(Number.isFinite)) return 0;
  if (previous === 0 && (projectedPixels >= policy.nearExitPixels || distance <= policy.nearExitDistance)) return 0;
  if (projectedPixels > policy.nearEnterPixels || distance < policy.nearEnterDistance) return 0;
  if (previous === 2 && projectedPixels <= policy.farExitPixels && distance >= policy.farExitDistance) return 2;
  if (projectedPixels < policy.farEnterPixels && distance > policy.farEnterDistance) return 2;
  return 1;
}

export function placementMatrix(placement, target = new THREE.Matrix4()) {
  return target.compose(new THREE.Vector3(placement.x, placement.y, placement.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(placement.rx || 0, placement.r || 0, placement.rz || 0)),
    new THREE.Vector3(placement.sx ?? placement.s ?? 1, placement.sy ?? placement.s ?? 1, placement.sz ?? placement.s ?? 1));
}

export function createFoliageLOD(root, definitions, policy = FOLIAGE_LOD) {
  const group = new THREE.Group(); group.name = 'Spatial botanical groves'; root.add(group);
  const chunks = [], entries = [], families = new Map();
  const stats = {enabled: true, treeCount: 0, nearCount: 0, midCount: 0, farCount: 0, chunkCount: 0,
    activeBatches: 0, submittedTriangles: 0, fullDetailTriangles: 0, transitions: 0, updates: 0};
  for (const {kind, seed, placements} of definitions) {
    if (!placements.length) continue;
    const variants = names.map(level => createGroveTree(kind, seed, level));
    // All tiers use the exact same material and clock. Pigment is independent
    // of tessellation and no leaves, flowers or fine shoots are deleted.
    for (const variant of variants.slice(1)) {
      for (const part of ['branchesMesh', 'leavesMesh']) {
        const material = variant[part].material;
        if (material !== variants[0][part].material && !material.userData.sharedAsset) material.dispose();
      }
      variant.branchesMesh.material = variants[0].branchesMesh.material;
      variant.leavesMesh.material = variants[0].leavesMesh.material;
    }
    families.set(kind, variants);
    const sourceBounds = new THREE.Box3().setFromObject(variants[0]), sourceSphere = sourceBounds.getBoundingSphere(new THREE.Sphere());
    const cells = new Map();
    for (const placement of placements) {
      const key = `${Math.floor(placement.x / policy.chunkSize)},${Math.floor(placement.z / policy.chunkSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      const matrix = placementMatrix(placement), sphere = sourceSphere.clone().applyMatrix4(matrix);
      const entry = {placement, matrix, sphere, tier: 0, projectedPixels: Infinity, distance: 0};
      cells.get(key).push(entry); entries.push(entry);
    }
    for (const [cell, trees] of cells) {
      const chunk = {kind, cell, entries: trees, levels: [], counts: [trees.length, 0, 0]};
      for (let tier = 0; tier < 3; tier++) {
        const meshes = ['branchesMesh', 'leavesMesh'].map(part => {
          const source = variants[tier][part], mesh = new THREE.InstancedMesh(source.geometry, source.material, trees.length);
          mesh.name = `${kind} ${part === 'leavesMesh' ? 'crowns' : 'branches'} ${cell} ${names[tier]}`;
          mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = true;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.userData.foliageLOD = {kind, cell, level: names[tier]};
          attachWindShadows(mesh); group.add(mesh); return mesh;
        });
        chunk.levels.push(meshes);
      }
      chunks.push(chunk);
    }
  }
  function rebuild(chunk) {
    chunk.counts.fill(0);
    for (const tree of chunk.entries) {
      const index = chunk.counts[tree.tier]++;
      for (const mesh of chunk.levels[tree.tier]) mesh.setMatrixAt(index, tree.matrix);
    }
    for (let tier = 0; tier < 3; tier++) for (const mesh of chunk.levels[tier]) {
      mesh.count = chunk.counts[tier]; mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.count) {
        mesh.computeBoundingSphere(); mesh.boundingSphere.radius += .12;
        mesh.computeBoundingBox(); mesh.boundingBox.expandByScalar(.12);
      }
    }
  }
  function measure() {
    stats.nearCount = stats.midCount = stats.farCount = stats.activeBatches = stats.submittedTriangles = 0;
    for (const chunk of chunks) for (let tier = 0; tier < 3; tier++) {
      stats[`${names[tier]}Count`] += chunk.counts[tier];
      for (const mesh of chunk.levels[tier]) if (mesh.count) {
        stats.activeBatches++; stats.submittedTriangles += triangleCount(mesh) * mesh.count;
      }
    }
  }
  for (const chunk of chunks) rebuild(chunk);
  stats.treeCount = entries.length; stats.chunkCount = chunks.length;
  measure(); stats.fullDetailTriangles = stats.submittedTriangles;
  const cameraPosition = new THREE.Vector3(), sphere = new THREE.Sphere();
  return {
    group, stats, chunks, families,
    // Explicit measurement control. Turning selection off restores the exact
    // near geometry everywhere; it never changes textures or render settings.
    setEnabled(enabled) {
      stats.enabled = Boolean(enabled);
      if (!stats.enabled) {
        for (const chunk of chunks) {
          for (const entry of chunk.entries) entry.tier = 0;
          rebuild(chunk);
        }
        measure();
      }
      return stats;
    },
    update(camera = null, viewport = null) {
      const height = viewport?.height ?? viewport?.y;
      if (!stats.enabled || !camera || !(height > 0)) return stats;
      camera.updateWorldMatrix(true, false); camera.getWorldPosition(cameraPosition); group.updateWorldMatrix(true, false);
      let changed = false;
      for (const chunk of chunks) {
        let dirty = false;
        for (const entry of chunk.entries) {
          sphere.copy(entry.sphere).applyMatrix4(group.matrixWorld);
          const distance = Math.max(0, sphere.center.distanceTo(cameraPosition) - sphere.radius);
          const pixels = camera.isOrthographicCamera ? sphere.radius * height * Math.abs(camera.projectionMatrix.elements[5])
            : sphere.radius * height * Math.abs(camera.projectionMatrix.elements[5]) / Math.max(distance, .01);
          const tier = selectFoliageDetail(entry.tier, pixels, distance, policy);
          entry.distance = distance; entry.projectedPixels = pixels;
          if (entry.tier !== tier) {entry.tier = tier; stats.transitions++; dirty = true;}
        }
        if (dirty) {rebuild(chunk); changed = true;}
      }
      if (changed) measure();
      stats.updates++; return stats;
    },
  };
}
