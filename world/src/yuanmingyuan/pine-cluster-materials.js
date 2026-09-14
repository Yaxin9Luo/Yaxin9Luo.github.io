import * as THREE from 'three';
import { patchPineShootTransition } from './pine-shoot-lod-materials.js';
import { setWillowSampling } from './willow-distance-sampling.js';
import { pineClusterSigmaNormalGLSL } from './pine-cluster-normal-distribution.js';

/** Same covector transform as the shader, including rotated nonuniform
 * instances. A zero-scale instance has no valid normal and is rejected. */
export function transformPineClusterNormal(normal, modelView, instance = new THREE.Matrix4(), viewDirection = new THREE.Vector3(0, 0, 1)) {
  if (!Number.isFinite(instance.determinant()) || Math.abs(instance.determinant()) < 1e-14 || Math.abs(modelView.determinant()) < 1e-14) throw new Error('Singular cluster normal transform');
  const result = normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(instance)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(modelView)).normalize();
  return result.dot(viewDirection) < 0 ? result.negate() : result;
}
export function pineClusterCoverageHash(x, y, layer, instance = 0, objectSeed = 360) {
  let h = (Math.imul(x >>> 0, 1664525) + Math.imul(y >>> 0, 1013904223)) >>> 0;
  h = (h ^ Math.imul((layer + 1) >>> 0, 374761393)) >>> 0;
  h = (h ^ Math.imul(instance >>> 0, 668265263) ^ Math.imul(objectSeed >>> 0, 1597334677)) >>> 0;
  h = Math.imul(h ^ h >>> 16, 2246822519) >>> 0; h = Math.imul(h ^ h >>> 13, 3266489917) >>> 0; h = (h ^ h >>> 16) >>> 0;
  return (h & 0xffffff) / 16777216;
}
export function pineClusterWeightedCoverage(alpha, weight) { return 1 - Math.pow(1 - Math.min(.9999, Math.max(0, alpha)), Math.max(0, weight)); }

const vertexHeader = `
attribute float clusterLayer;
attribute float clusterAxis;
centroid varying vec2 vClusterUv;
varying float vClusterLayer;
varying float vClusterAxis;
varying float vClusterInstance;
varying vec3 vClusterNormalX;
varying vec3 vClusterNormalY;
varying vec3 vClusterNormalZ;
centroid varying vec3 vClusterView;
`;
const vertexTransform = `
  vClusterUv = uv;
  vClusterLayer = clusterLayer;
  vClusterAxis = clusterAxis;
  vClusterInstance = 0.;
  mat3 clusterTransform = normalMatrix;
  #ifdef USE_INSTANCING
    vClusterInstance = float(gl_InstanceID);
    clusterTransform = clusterTransform * transpose(inverse(mat3(instanceMatrix)));
  #endif
  vClusterNormalX = clusterTransform[0];
  vClusterNormalY = clusterTransform[1];
  vClusterNormalZ = clusterTransform[2];
  vClusterView = -mvPosition.xyz;
`;
const fragmentHeader = `
uniform highp sampler2DArray clusterBase;
uniform highp sampler2DArray clusterNormals;
uniform float clusterObjectSeed;
centroid varying vec2 vClusterUv;
varying float vClusterLayer;
varying float vClusterAxis;
varying float vClusterInstance;
varying vec3 vClusterNormalX;
varying vec3 vClusterNormalY;
varying vec3 vClusterNormalZ;
centroid varying vec3 vClusterView;
float clusterCoverageThreshold(vec2 pixel, float layer) {
  uvec2 xy = uvec2(floor(pixel));
  uint h = (xy.x * 1664525u + xy.y * 1013904223u) ^ (uint(layer + 1.) * 374761393u);
  h = h ^ (uint(floor(vClusterInstance + .5)) * 668265263u) ^ (uint(clusterObjectSeed) * 1597334677u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = (h ^ (h >> 13u)) * 3266489917u;
  h = h ^ (h >> 16u);
  return float(h & 0xffffffu) / 16777216.;
}
`;
const coverageStage = `
  float clusterSlice = floor(vClusterLayer + .5);
  vec4 clusterField = texture(clusterBase, vec3(vClusterUv, clusterSlice));
  vec3 clusterView = isOrthographic ? vec3(0., 0., 1.) : normalize(vClusterView);
  vec3 clusterCos = abs(vec3(dot(normalize(vClusterNormalX), clusterView), dot(normalize(vClusterNormalY), clusterView), dot(normalize(vClusterNormalZ), clusterView)));
  vec3 clusterWeights = pow(clusterCos, vec3(4.));
  clusterWeights /= max(dot(clusterWeights, vec3(1.)), 1e-12);
  float clusterWeight = vClusterAxis < .5 ? clusterWeights.x : (vClusterAxis < 1.5 ? clusterWeights.y : clusterWeights.z);
  float clusterAlpha = 1. - pow(1. - min(.9999, max(0., clusterField.a)), clusterWeight);
  if (clusterAlpha <= clusterCoverageThreshold(gl_FragCoord.xy, clusterSlice)) discard;
`;
const normalStage = `
  vec3 clusterAverageNormal = texture(clusterNormals, vec3(vClusterUv, clusterSlice)).rgb / max(clusterField.a, 1e-10) * 2. - 1.;
  normal = normalize(vClusterNormalX * clusterAverageNormal.x + vClusterNormalY * clusterAverageNormal.y + vClusterNormalZ * clusterAverageNormal.z);
  if (dot(normal, clusterView) < 0.) normal = -normal;
`;
const distributionNormalStage = `
  vec4 clusterBinFields[6];
  float clusterTotalBinWeight = 0.;
  for (int bin = 0; bin < 6; bin++) {
    clusterBinFields[bin] = texture(clusterNormalBins, vec3(vClusterUv, clusterSlice * 6. + float(bin)));
    clusterTotalBinWeight += clusterBinFields[bin].a;
  }
  float clusterSelector = clusterCoverageThreshold(gl_FragCoord.xy + vec2(173., 977.), clusterSlice + 53.) * clusterTotalBinWeight;
  vec4 clusterChosenBin = vec4(0.);
  for (int bin = 0; bin < 6; bin++) {
    if (clusterSelector < clusterBinFields[bin].a) { clusterChosenBin = clusterBinFields[bin]; break; }
    clusterSelector -= clusterBinFields[bin].a;
  }
  vec3 clusterAverageNormal = clusterChosenBin.a > 0. ? clusterChosenBin.rgb / clusterChosenBin.a * 2. - 1. : texture(clusterNormals, vec3(vClusterUv, clusterSlice)).rgb / max(clusterField.a, 1e-10) * 2. - 1.;
  if (dot(clusterAverageNormal, clusterAverageNormal) < 1e-12) clusterAverageNormal = vClusterAxis < .5 ? vec3(1., 0., 0.) : (vClusterAxis < 1.5 ? vec3(0., 1., 0.) : vec3(0., 0., 1.));
  vec3 clusterSampleNormal = clusterSigmaNormal(clusterAverageNormal, floor(clusterCoverageThreshold(gl_FragCoord.xy + vec2(4093., 6977.), clusterSlice + 131.) * 4.));
  normal = normalize(vClusterNormalX * clusterSampleNormal.x + vClusterNormalY * clusterSampleNormal.y + vClusterNormalZ * clusterSampleNormal.z);
  // The chart was baked from source triangle facing, including shading normals
  // that cross their geometric tangent plane. Do not face-forward each sample.
  vec3 clusterChartNormal = vClusterAxis < .5 ? vClusterNormalX : (vClusterAxis < 1.5 ? vClusterNormalY : vClusterNormalZ);
  if (dot(clusterChartNormal, clusterView) < 0.) normal = -normal;
`;

/** Coverage is a stable, layer-decorrelated stochastic test in all passes.
 * No fixed alpha cutoff and no order-dependent translucent overlap. This is
 * unbiased in expectation, but finite-pixel grain/motion remains a native gate. */
export function pineClusterMaterialSet({ base, normal, normalBins = null, transition, objectSeed = 360 }) {
  if (!Number.isInteger(objectSeed) || objectSeed < 0 || objectSeed >= 16777216) throw new Error('Cluster coverage seed must fit exactly in a float');
  const surface = new THREE.MeshStandardMaterial({ name: 'pine-cluster-lit-volume-sheets', color: 0xffffff, roughness: .77, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, emissive: '#263724', emissiveIntensity: .045, transparent: false, alphaTest: 0, alphaToCoverage: false, depthWrite: true });
  const depth = new THREE.MeshDepthMaterial({ name: 'pine-cluster-coverage-shadow', depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const distance = new THREE.MeshDistanceMaterial({ name: 'pine-cluster-coverage-distance', side: THREE.DoubleSide });
  const gbuffer = new THREE.MeshNormalMaterial({ name: 'pine-cluster-coverage-normal', side: THREE.DoubleSide, blending: THREE.NoBlending }); gbuffer.toneMapped = false;
  const materials = [surface, depth, distance, gbuffer];
  for (const material of materials) {
    material.onBeforeCompile = shader => {
      for (const token of ['#include <project_vertex>']) if (!shader.vertexShader.includes(token)) throw new Error('Cluster vertex shader contract missing: ' + token);
      if (!shader.fragmentShader.includes('#include <clipping_planes_fragment>')) throw new Error('Cluster fragment shader contract missing');
      shader.uniforms.clusterBase = { value: base }; shader.uniforms.clusterNormals = { value: normal };
      if (normalBins) shader.uniforms.clusterNormalBins = { value: normalBins };
      shader.uniforms.clusterObjectSeed = { value: objectSeed };
      shader.vertexShader = vertexHeader + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vertexTransform);
      shader.fragmentShader = fragmentHeader + (normalBins ? 'uniform highp sampler2DArray clusterNormalBins;\n' + pineClusterSigmaNormalGLSL : '') + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + coverageStage);
      if (material === surface) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= clusterField.rgb / max(clusterField.a, 1e-10);');
      if (material === surface || material === gbuffer) {
        if (!shader.fragmentShader.includes('#include <normal_fragment_maps>')) throw new Error('Cluster normal shader stage is missing');
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (normalBins ? distributionNormalStage : normalStage) + (!normalBins && material === surface ? '\nroughnessFactor = clamp(roughnessFactor + .20 * (1. - min(1., length(clusterAverageNormal))), .77, .97);' : ''));
      }
    };
    material.customProgramCacheKey = () => 'pine-cluster-volume-field-' + (normalBins ? 'r2-' : 'r1-') + material.type;
    patchPineShootTransition(material, transition); setWillowSampling(material, 'centroid');
  }
  return { surface, depth, distance, normal: gbuffer, materials };
}
