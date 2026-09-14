import * as THREE from 'three';

export const STUDY_MINIMUM_NEAR = .04;

// Box3.setFromObject includes hidden descendants. Detail presets need the
// bounds of the geometry actually drawn, including every placed instance.
export function visibleStudyBounds(root) {
  root.updateWorldMatrix(true, true);
  const result = new THREE.Box3(), local = new THREE.Box3();
  root.traverseVisible(object => {
    if (!object.isMesh || !object.geometry) return;
    if (object.boundingBox !== undefined) {
      if (object.boundingBox === null) object.computeBoundingBox();
      local.copy(object.boundingBox);
    } else {
      if (object.geometry.boundingBox === null) object.geometry.computeBoundingBox();
      local.copy(object.geometry.boundingBox);
    }
    result.union(local.applyMatrix4(object.matrixWorld));
  });
  return result;
}

// A 4 cm near plane wastes almost all depth precision when viewing a 160 m
// compound from hundreds of metres away. Half the nearest visible box depth
// gives a conservative margin without moving the camera or changing its FOV.
// When the camera enters the box, close inspection keeps the original near.
export function fitStudyCameraClipping(camera, bounds) {
  camera.updateMatrixWorld();
  let closest = Infinity, farthest = -Infinity;
  const point = new THREE.Vector3();
  if (!bounds.isEmpty()) {
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const depth = -point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).z;
          closest = Math.min(closest, depth); farthest = Math.max(farthest, depth);
        }
  }
  const near = Number.isFinite(closest) ? Math.max(STUDY_MINIMUM_NEAR, closest * .5) : STUDY_MINIMUM_NEAR;
  const far = Math.max(1200, near + 1, Number.isFinite(farthest) ? farthest * 1.2 : 0);
  if (camera.near !== near || camera.far !== far) {
    camera.near = near; camera.far = far; camera.updateProjectionMatrix();
  }
  return { near, far, closestVisibleDepth: Number.isFinite(closest) ? closest : null, farthestVisibleDepth: Number.isFinite(farthest) ? farthest : null, method: 'half-nearest-visible-bounds-depth' };
}
