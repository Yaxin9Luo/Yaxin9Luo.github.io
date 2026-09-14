import * as THREE from 'three';
import { setWillowSampling } from './willow-distance-sampling.js';

export const PINE_SHOOT_ALPHA_TEST = .18;
const patched = new WeakMap();
export function pineShootCoverageAt(x, y, phase, role) {
  const fract = x => x - Math.floor(x), threshold = fract(52.9829189 * fract(Math.floor(x) * .06711056 + Math.floor(y) * .00583715));
  return role === 0 || (role > 0 ? threshold < phase : threshold >= phase);
}

/** A page-owned material state; old/new geometry uses complementary pixels in
 * every pass. Coverage/alpha clipping remains independent of the LOD mask. */
export function patchPineShootTransition(material, state) {
  if (patched.has(material)) throw new Error('Pine material already has a transition owner');
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    if (!shader.fragmentShader.includes('#include <clipping_planes_fragment>')) throw new Error('Pine transition requires a standard clipping shader stage');
    shader.uniforms.pineLodPhase = state.phase; shader.uniforms.pineLodRole = state.role;
    shader.fragmentShader = 'uniform float pineLodPhase;\nuniform float pineLodRole;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (abs(pineLodRole) > .5) {
        float threshold = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(.06711056, .00583715))));
        if (pineLodRole > 0. ? threshold >= pineLodPhase : threshold < pineLodPhase) discard;
      }`);
  };
  material.customProgramCacheKey = function() { return key.call(this) + '|pine-shoot-transition-v1'; };
  material.needsUpdate = true; patched.set(material, state); return material;
}

export function pineShootMaterialSet({ baseMap = null, normalMap = null, transition, name = 'pine-shoot' } = {}) {
  if (!transition?.phase || !transition?.role) throw new Error('A page-owned transition state is required');
  const cards = !!baseMap, side = cards ? THREE.FrontSide : THREE.DoubleSide;
  const surface = new THREE.MeshStandardMaterial({ name, color: 0xffffff, vertexColors: !cards, roughness: .77, metalness: 0, side, shadowSide: side, emissive: '#263724', emissiveIntensity: .045, map: baseMap, normalMap, normalMapType: THREE.ObjectSpaceNormalMap, alphaTest: cards ? PINE_SHOOT_ALPHA_TEST : 0, alphaToCoverage: cards, transparent: false, depthWrite: true });
  const depth = new THREE.MeshDepthMaterial({ name: name + '-shadow-depth', depthPacking: THREE.RGBADepthPacking, map: baseMap, side, alphaTest: cards ? PINE_SHOOT_ALPHA_TEST : 0 });
  const distance = new THREE.MeshDistanceMaterial({ name: name + '-point-shadow-distance', map: baseMap, side, alphaTest: cards ? PINE_SHOOT_ALPHA_TEST : 0 });
  const normal = new THREE.MeshNormalMaterial({ name: name + '-normal-depth', side, normalMap, normalMapType: THREE.ObjectSpaceNormalMap, blending: THREE.NoBlending });
  normal.toneMapped = false;
  if (cards) {
    normal.onBeforeCompile = shader => {
      shader.uniforms.pineCoverageMap = { value: baseMap }; shader.uniforms.pineCoverageThreshold = { value: PINE_SHOOT_ALPHA_TEST };
      shader.fragmentShader = 'uniform sampler2D pineCoverageMap;\nuniform float pineCoverageThreshold;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (texture2D(pineCoverageMap, vNormalMapUv).a < pineCoverageThreshold) discard;');
    };
    normal.customProgramCacheKey = () => 'pine-shoot-coverage-normal-v1';
  }
  const materials = [surface, depth, distance, normal];
  for (const material of materials) { patchPineShootTransition(material, transition); setWillowSampling(material, 'centroid'); }
  return { surface, depth, distance, normal, materials };
}

export function attachPineShootMaterials(mesh, set) {
  mesh.material = set.surface; mesh.customDepthMaterial = set.depth; mesh.customDistanceMaterial = set.distance;
  mesh.userData.pineShootNormalMaterial = set.normal; mesh.castShadow = true; mesh.receiveShadow = true;
}

