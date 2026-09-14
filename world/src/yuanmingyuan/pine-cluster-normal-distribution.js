import * as THREE from 'three';

export const PINE_CLUSTER_NORMAL_BINS = 6;
export function pineClusterNormalBin(normal) {
  const values = normal.toArray ? normal.toArray() : normal;
  let axis = 0; for (let i = 1; i < 3; i++) if (Math.abs(values[i]) > Math.abs(values[axis])) axis = i;
  return axis * 2 + (values[axis] < 0 ? 1 : 0);
}

/** Four unit directions represent a bin's first normal moment exactly (before
 * HALF_FLOAT rounding). They retain unresolved angular spread instead of
 * replacing the mean with a single longer vector. Their transverse variance
 * is isotropic; this is a tested approximation, not the original full NDF. */
export function pineClusterSigmaNormal(mean, sample) {
  const value = mean.clone(), length = Math.min(1, value.length());
  if (!Number.isInteger(sample) || sample < 0 || sample > 3 || !(length > 0)) throw new Error('Invalid cluster normal quadrature');
  const direction = value.clone().normalize(); value.copy(direction).multiplyScalar(length);
  const a = direction.toArray().map(Math.abs); let axis = 0; for (let i = 1; i < 3; i++) if (a[i] < a[axis]) axis = i;
  const tangent = new THREE.Vector3().crossVectors(direction, new THREE.Vector3().setComponent(axis, 1)).normalize(), bitangent = new THREE.Vector3().crossVectors(direction, tangent);
  return value.addScaledVector(sample < 2 ? tangent : bitangent, (sample % 2 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - length * length)));
}

export function transformPineClusterDistributionNormal(normal, modelView, instance, chartNormal, viewDirection) {
  const transform = new THREE.Matrix3().getNormalMatrix(modelView).multiply(new THREE.Matrix3().getNormalMatrix(instance));
  if (![...transform.elements].every(Number.isFinite) || transform.determinant() === 0) throw new Error('Singular cluster normal transform');
  const result = normal.clone().applyMatrix3(transform).normalize();
  return chartNormal.clone().applyMatrix3(transform).dot(viewDirection) < 0 ? result.negate() : result;
}

export const pineClusterSigmaNormalGLSL = `
vec3 clusterSigmaNormal(vec3 meanNormal, float selector) {
  float momentLength = min(1., length(meanNormal));
  vec3 direction = normalize(meanNormal);
  vec3 absoluteDirection = abs(direction);
  vec3 axis = absoluteDirection.x <= absoluteDirection.y && absoluteDirection.x <= absoluteDirection.z ? vec3(1., 0., 0.) : (absoluteDirection.y <= absoluteDirection.z ? vec3(0., 1., 0.) : vec3(0., 0., 1.));
  vec3 tangent = normalize(cross(direction, axis));
  vec3 bitangent = cross(direction, tangent);
  vec3 offset = selector < 2. ? tangent : bitangent;
  return direction * momentLength + offset * (mod(selector, 2.) < .5 ? 1. : -1.) * sqrt(max(0., 1. - momentLength * momentLength));
}
`;
