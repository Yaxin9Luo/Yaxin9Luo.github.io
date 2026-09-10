import * as THREE from 'three';

// World-space breeze: east and slightly south. One clock drives all foliage
// tiers, grass and their depth passes; this is independent of render quality.
export const environmentWind = {
  direction: new THREE.Vector2(1, .55).normalize(),
  frequency: .9,
  time: {value: 0},
};

export function updateEnvironmentWind(seconds, reducedMotion = false) {
  environmentWind.time.value = reducedMotion ? 0 : seconds;
}

export function applyEnvironmentWind(material, {amplitude = .07, minHeight = .35, maxHeight = 6} = {}) {
  const previous = material.onBeforeCompile;
  const key = `academy-world-wind-v3-${amplitude}-${minHeight}-${maxHeight}`;
  material.onBeforeCompile = shader => {
    previous?.call(material, shader);
    shader.uniforms.environmentWindTime = environmentWind.time;
    shader.uniforms.environmentWindDirection = {value: environmentWind.direction};
    shader.vertexShader = 'uniform float environmentWindTime;\nuniform vec2 environmentWindDirection;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      mat4 plantTransform = modelMatrix;
      #ifdef USE_INSTANCING
        plantTransform = modelMatrix * instanceMatrix;
      #endif
      vec3 plantWorld = (plantTransform * vec4(position, 1.)).xyz;
      float plantPhase = plantWorld.x * .12 + plantWorld.z * .09 + position.y * .53;
      float plantGust = sin(environmentWindTime * .9 + plantPhase) * .78
        + sin(environmentWindTime * .37 + plantPhase * .61) * .22;
      vec3 worldBend = vec3(environmentWindDirection.x, 0., environmentWindDirection.y)
        * plantGust * ${amplitude.toFixed(5)} * smoothstep(${minHeight.toFixed(5)}, ${maxHeight.toFixed(5)}, position.y);
      // Undo the instance's rotation and scale so separately rotated plants
      // still bend along the same world-space breeze.
      transformed += vec3(dot(worldBend, plantTransform[0].xyz) / max(dot(plantTransform[0].xyz, plantTransform[0].xyz), .0001),
        dot(worldBend, plantTransform[1].xyz) / max(dot(plantTransform[1].xyz, plantTransform[1].xyz), .0001),
        dot(worldBend, plantTransform[2].xyz) / max(dot(plantTransform[2].xyz, plantTransform[2].xyz), .0001));`);
  };
  material.customProgramCacheKey = () => key;
  material.userData.environmentWind = {amplitude, minHeight, maxHeight};
  return material;
}

export function attachWindShadows(mesh) {
  const settings = mesh.material?.userData.environmentWind;
  if (!settings) return mesh;
  mesh.customDepthMaterial = applyEnvironmentWind(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, side: mesh.material.side}), settings);
  mesh.customDistanceMaterial = applyEnvironmentWind(new THREE.MeshDistanceMaterial({side: mesh.material.side}), settings);
  return mesh;
}
