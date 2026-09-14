import * as THREE from 'three';
import { pineClusterSigmaNormalGLSL } from './pine-cluster-normal-distribution.js';
import { patchPineShootTransition } from './pine-shoot-lod-materials.js';
import { setWillowSampling } from './willow-distance-sampling.js';

export function pineClusterR3ShadowThreshold(x, y) {
  x = ((Math.floor(x) % 8) + 8) % 8; y = ((Math.floor(y) % 8) + 8) % 8;
  return (32 * ((x + y) % 2) + 16 * (y % 2) + 8 * ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) + 4 * (Math.floor(y / 2) % 2) + 2 * ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) + Math.floor(y / 4) % 2 + .5) / 64;
}

const vertexHeader = `
centroid varying vec2 vR3Uv;
varying vec3 vR3NormalX;
varying vec3 vR3NormalY;
varying vec3 vR3NormalZ;
`;
const vertexBody = `
vR3Uv = uv;
mat3 r3Transform = normalMatrix;
#ifdef USE_INSTANCING
  r3Transform = r3Transform * transpose(inverse(mat3(instanceMatrix)));
#endif
vR3NormalX = r3Transform[0]; vR3NormalY = r3Transform[1]; vR3NormalZ = r3Transform[2];
`;
const fragmentHeader = `
uniform highp sampler2DArray r3Visibility;
uniform highp sampler2DArray r3Normals;
uniform highp sampler2DArray r3Colors;
uniform float r3View;
uniform float r3Multisampled;
centroid varying vec2 vR3Uv;
varying vec3 vR3NormalX;
varying vec3 vR3NormalY;
varying vec3 vR3NormalZ;
float r3ShadowThreshold(vec2 point) {
  vec2 p = mod(floor(point), 8.);
  return (32. * mod(p.x + p.y, 2.) + 16. * mod(p.y, 2.) + 8. * mod(floor(p.x / 2.) + floor(p.y / 2.), 2.) + 4. * mod(floor(p.y / 2.), 2.) + 2. * mod(floor(p.x / 4.) + floor(p.y / 4.), 2.) + mod(floor(p.y / 4.), 2.) + .5) / 64.;
}
vec3 r3ViewNormal(vec3 sourceNormal) {
  return normalize(vR3NormalX * sourceNormal.x + vR3NormalY * sourceNormal.y + vR3NormalZ * sourceNormal.z);
}
`;
const fields = `
float r3Coverage = clamp(texture(r3Visibility, vec3(vR3Uv, r3View)).a, 0., 1.);
if (r3Coverage <= 0.) discard;
`;
const jointFields = `
vec4 r3BinNormals[6];
vec4 r3BinColors[6];
float r3TotalWeight = 0.;
vec3 r3MeanNormal = vec3(0.);
for (int r3Bin = 0; r3Bin < 6; r3Bin++) {
  r3BinNormals[r3Bin] = texture(r3Normals, vec3(vR3Uv, r3View * 6. + float(r3Bin)));
  r3BinColors[r3Bin] = texture(r3Colors, vec3(vR3Uv, r3View * 6. + float(r3Bin)));
  r3TotalWeight += r3BinNormals[r3Bin].a;
  r3MeanNormal += r3BinNormals[r3Bin].rgb;
}
normal = r3ViewNormal(dot(r3MeanNormal, r3MeanNormal) > 1e-15 ? r3MeanNormal : vec3(0., 0., 1.));
`;

/** These are the actual installed Three PBR chunks, evaluated with a finite
 * weighted normal/colour distribution. Visibility is resolved BEFORE the
 * distribution; no hash chooses a full-strength colour or normal per pixel.
 * First moments are exact, higher angular moments remain an approximation. */
const originalLightingChunks = ['lights_physical_fragment', 'lights_fragment_begin', 'lights_fragment_maps', 'lights_fragment_end'];
function weightedOriginalPBR() {
  return `
ReflectedLight r3Integrated = ReflectedLight(vec3(0.), vec3(0.), vec3(0.), vec3(0.));
// Keep loop counts uniform: stock derivative-based geometry roughness must
// never execute in a visibility-dependent branch.
for (int r3Bin = 0; r3Bin < 6; r3Bin++) {
  float r3BinWeight = r3BinNormals[r3Bin].a;
  vec3 r3Moment = r3BinNormals[r3Bin].rgb / max(r3BinWeight, 1e-12);
  if (dot(r3Moment, r3Moment) < 1e-15) r3Moment = vec3(0., 0., 1.);
  diffuseColor.rgb = r3BinColors[r3Bin].rgb / max(r3BinColors[r3Bin].a, 1e-12);
  for (int r3Sigma = 0; r3Sigma < 4; r3Sigma++) {
    normal = r3ViewNormal(clusterSigmaNormal(r3Moment, float(r3Sigma)));
    nonPerturbedNormal = normal;
    reflectedLight = ReflectedLight(vec3(0.), vec3(0.), vec3(0.), vec3(0.));
    ${originalLightingChunks.map(name => '#include <' + name + '>').join('\n')}
    float r3Weight = r3BinWeight / max(r3TotalWeight, 1e-12) * .25;
    r3Integrated.directDiffuse += reflectedLight.directDiffuse * r3Weight;
    r3Integrated.directSpecular += reflectedLight.directSpecular * r3Weight;
    r3Integrated.indirectDiffuse += reflectedLight.indirectDiffuse * r3Weight;
    r3Integrated.indirectSpecular += reflectedLight.indirectSpecular * r3Weight;
  }
}
reflectedLight = r3Integrated;
`;
}

export function pineClusterR3MaterialSet({ visibility, normals, colors, transition, view = { value: 4 }, multisampled = { value: 1 } }) {
  const surface = new THREE.MeshStandardMaterial({ name: 'pine-cluster-r3-deterministic-original-pbr', color: 0xffffff, roughness: .77, metalness: 0, emissive: '#263724', emissiveIntensity: .045, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, transparent: false, alphaTest: 0, alphaToCoverage: true, depthWrite: true });
  const depth = new THREE.MeshDepthMaterial({ name: 'pine-cluster-r3-filtered-coverage-shadow', depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const distance = new THREE.MeshDistanceMaterial({ name: 'pine-cluster-r3-filtered-coverage-point-shadow', side: THREE.DoubleSide });
  const normal = new THREE.MeshNormalMaterial({ name: 'pine-cluster-r3-multisample-normal', side: THREE.DoubleSide, alphaToCoverage: true, blending: THREE.NoBlending }); normal.toneMapped = false;
  const materials = [surface, depth, distance, normal];
  for (const material of materials) {
    material.onBeforeCompile = shader => {
      for (const [source, token] of [[shader.vertexShader, '#include <project_vertex>'], [shader.fragmentShader, '#include <clipping_planes_fragment>']]) if (!source.includes(token)) throw new Error('R3 shader contract missing: ' + token);
      Object.assign(shader.uniforms, { r3Visibility: { value: visibility }, r3Normals: { value: normals }, r3Colors: { value: colors }, r3View: view, r3Multisampled: multisampled });
      shader.vertexShader = vertexHeader + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vertexBody);
      const shadow = material === depth || material === distance;
      shader.fragmentShader = fragmentHeader + (material === surface ? pineClusterSigmaNormalGLSL : '') + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + fields + (shadow ? 'if (r3Coverage <= r3ShadowThreshold(gl_FragCoord.xy)) discard;\n' : 'if (r3Multisampled < .5 && r3Coverage <= r3ShadowThreshold(gl_FragCoord.xy)) discard;\n'));
      // ShadowMap copies alphaTest=.5 from A2C surfaces; it must not turn the
      // already filtered coverage into a second arbitrary hard cutoff.
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '');
      if (material === surface || material === normal) {
        if (!shader.fragmentShader.includes('#include <normal_fragment_maps>')) throw new Error('R3 normal stage is absent');
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + jointFields);
      }
      if (material === surface) {
        for (const chunk of originalLightingChunks) if (!shader.fragmentShader.includes('#include <' + chunk + '>')) throw new Error('R3 PBR accumulation stage changed: ' + chunk);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', weightedOriginalPBR());
        // Remove only the ORIGINAL subsequent stages, not the copies inside
        // the weighted loop inserted above.
        for (const chunk of originalLightingChunks.slice(1)) { const token = '#include <' + chunk + '>', at = shader.fragmentShader.lastIndexOf(token); shader.fragmentShader = shader.fragmentShader.slice(0, at) + shader.fragmentShader.slice(at + token.length); }
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = r3Coverage;');
      } else if (material === normal) {
        shader.fragmentShader = shader.fragmentShader.replace(/#ifdef OPAQUE\s+gl_FragColor\.a = 1\.0;\s+#endif/, '');
        shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );', 'gl_FragColor = vec4(normal * .5 + .5, r3Coverage);');
      }
    };
    material.customProgramCacheKey = () => 'pine-cluster-r3-visible-joint-pbr24-' + material.type;
    patchPineShootTransition(material, transition); setWillowSampling(material, 'centroid');
  }
  return { surface, depth, distance, normal, materials, view, multisampled };
}
