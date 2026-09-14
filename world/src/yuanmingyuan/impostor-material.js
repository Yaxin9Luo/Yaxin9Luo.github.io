import * as THREE from 'three';
import { IMPOSTOR_PASSES, selectImpostorFrames } from './impostor-format.js';

// The carrier only bounds ray work. Its face normal and depth are never the
// shaded surface. Single-layer view reprojection remains an approximation.
export const IMPOSTOR_TRACE_GLSL = /* glsl */`
precision highp sampler2DArray;
varying vec3 vImpostorLocalPoint;
uniform sampler2DArray impBase, impNormalRoughness, impDepthMaterial, impEmission;
uniform vec3 impCenter, impBoundsMin, impBoundsMax;
uniform vec3 impFrameDirection[16], impFrameRight[16], impFrameUp[16];
uniform float impRadius, impTileSize, impGridSize;
uniform mat4 impWorld, impInverseWorld, impProjection;
uniform mat3 impWorldNormal;
uniform vec3 impCameraPosition, impCameraForward;
uniform int impDebugMode;
vec3 impShadingViewPosition;
struct ImpHit { float t; float coverage; vec3 albedo; vec3 normal; float roughness; float metalness; float ao; vec3 emission; };
vec3 impLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c)); }
vec2 impOct(vec3 d) {
  d /= abs(d.x) + abs(d.y) + abs(d.z);
  vec2 p = d.xz;
  if (d.y < 0.0) p = (1.0 - abs(p.yx)) * vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  return p * .5 + .5;
}
void impFrames(vec3 direction, out ivec3 frames, out vec3 weights) {
  vec2 q = clamp(impOct(direction), 0.0, 1.0) * (impGridSize - 1.0);
  ivec2 cell = min(ivec2(floor(q)), ivec2(int(impGridSize) - 2));
  vec2 f = q - vec2(cell); int i = cell.y * int(impGridSize) + cell.x, n = int(impGridSize);
  if (f.x + f.y <= 1.0) { frames = ivec3(i, i + 1, i + n); weights = vec3(1.0 - f.x - f.y, f.x, f.y); }
  else { frames = ivec3(i + n + 1, i + n, i + 1); weights = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y); }
}
bool impBounds(vec3 o, vec3 d, out vec2 interval) {
  float nearT = -1e20, farT = 1e20;
  for (int axis = 0; axis < 3; axis++) {
    if (abs(d[axis]) < 1e-12) { if (o[axis] < impBoundsMin[axis] || o[axis] > impBoundsMax[axis]) return false; }
    else { float a = (impBoundsMin[axis] - o[axis]) / d[axis], b = (impBoundsMax[axis] - o[axis]) / d[axis]; nearT = max(nearT, min(a,b)); farT = min(farT, max(a,b)); }
  }
  interval = vec2(max(0.0, nearT), farT); return farT >= interval.x;
}
bool impRead(int frame, vec2 uv, out ImpHit hit, out float height) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return false;
  ivec3 pixel = ivec3(min(ivec2(uv * impTileSize), ivec2(int(impTileSize) - 1)), frame);
  vec4 a = texelFetch(impBase, pixel, 0);
  if (a.a <= .01) return false;
  vec4 n = texelFetch(impNormalRoughness, pixel, 0), m = texelFetch(impDepthMaterial, pixel, 0);
  float depth = (round(m.r * 255.0) * 256.0 + round(m.g * 255.0)) / 65535.0;
  height = (.5 - depth) * (2.0 * impRadius);
  hit.coverage = a.a; hit.albedo = impLinear(a.rgb); hit.normal = normalize(n.rgb * 2.0 - 1.0);
  hit.roughness = n.a; hit.metalness = m.b; hit.ao = m.a;
  hit.emission = impLinear(texelFetch(impEmission, pixel, 0).rgb); return true;
}
bool impReadSurface(ivec3 pixel, out float height, out vec3 surfaceNormal) {
  if (texelFetch(impBase, pixel, 0).a <= .01) return false;
  vec2 rg = texelFetch(impDepthMaterial, pixel, 0).rg;
  float depth = (round(rg.r * 255.0) * 256.0 + round(rg.g * 255.0)) / 65535.0;
  height = (.5 - depth) * (2.0 * impRadius);
  surfaceNormal = normalize(texelFetch(impNormalRoughness, pixel, 0).rgb * 2.0 - 1.0); return true;
}
bool impTrace(vec3 o, vec3 d, out ImpHit result) {
  vec2 interval; if (!impBounds(o, d, interval)) return false;
  ivec3 frames; vec3 weights; impFrames(-d, frames, weights);
  ImpHit candidates[3]; float validity[3]; float front = 1e20, tolerance = 2.0 * impRadius / impTileSize;
  for (int k = 0; k < 3; k++) {
    validity[k] = 0.0; int frame = frames[k]; float denominator = dot(d, impFrameDirection[frame]);
    if (weights[k] <= 1e-6 || denominator > -1e-5) continue;
    vec3 delta = o - impCenter;
    vec2 uvOrigin = vec2(dot(delta, impFrameRight[frame]), dot(delta, impFrameUp[frame])) / (2.0 * impRadius) + .5;
    vec2 velocity = vec2(dot(d, impFrameRight[frame]), dot(d, impFrameUp[frame])) / (2.0 * impRadius);
    ivec2 cell = ivec2(floor(clamp(uvOrigin + velocity * interval.x, vec2(0.0), vec2(1.0 - 1e-7)) * impTileSize));
    ivec2 cellStep = ivec2(0); vec2 nextCell = vec2(1e20), stride = vec2(1e20);
    for (int axis = 0; axis < 2; axis++) if (abs(velocity[axis]) >= 1e-12) {
      cellStep[axis] = velocity[axis] > 0.0 ? 1 : -1;
      nextCell[axis] = ((float(cell[axis]) + (cellStep[axis] > 0 ? 1.0 : 0.0)) / impTileSize - uvOrigin[axis]) / velocity[axis];
      stride[axis] = 1.0 / (impTileSize * abs(velocity[axis]));
    }
    float t = interval.x, cellEpsilon = 2.0 * impRadius / impTileSize * 1e-5;
    // A ray crosses at most 2*N grid boundaries. Empty cells remain empty.
    for (int stepIndex = 0; stepIndex < 516; stepIndex++) {
      if (stepIndex >= int(impTileSize) * 2 + 4 || any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, ivec2(int(impTileSize)))) || t > interval.y) break;
      float exitT = min(min(nextCell.x, nextCell.y), interval.y), height; vec3 surfaceNormal;
      if (impReadSurface(ivec3(cell, frame), height, surfaceNormal)) {
        vec2 sampleUV = (vec2(cell) + .5) / impTileSize;
        vec3 samplePoint = impCenter + impFrameRight[frame] * (sampleUV.x - .5) * (2.0 * impRadius) + impFrameUp[frame] * (sampleUV.y - .5) * (2.0 * impRadius) + impFrameDirection[frame] * height;
        float planeDenominator = dot(d, surfaceNormal);
        float hitT = abs(planeDenominator) < 1e-5 ? 1e20 : dot(samplePoint - o, surfaceNormal) / planeDenominator;
        if (hitT >= t - cellEpsilon && hitT <= exitT + cellEpsilon && hitT >= 0.0) {
          ImpHit hit; float unusedHeight; impRead(frame, (vec2(cell) + .5) / impTileSize, hit, unusedHeight);
          hit.t = hitT; candidates[k] = hit; validity[k] = 1.0; front = min(front, hitT); break;
        }
      }
      if (exitT >= interval.y) break;
      bool crossX = nextCell.x <= nextCell.y, crossY = nextCell.y <= nextCell.x; t = exitT;
      if (crossX) { cell.x += cellStep.x; nextCell.x += stride.x; }
      if (crossY) { cell.y += cellStep.y; nextCell.y += stride.y; }
    }
  }
  if (front == 1e20) return false;
  result.t = front; result.coverage = 0.0; result.albedo = vec3(0.0); result.normal = vec3(0.0); result.emission = vec3(0.0);
  result.roughness = 0.0; result.metalness = 0.0; result.ao = 0.0;
  float sum = 0.0, visibleViewWeight = 0.0;
  for (int k = 0; k < 3; k++) {
    if (validity[k] < .5) continue;
    ImpHit h = candidates[k]; if (abs(h.t - front) > tolerance * 2.0) continue;
    float w = weights[k] * h.coverage; sum += w; visibleViewWeight += weights[k];
    result.albedo += h.albedo * w; result.normal += h.normal * w; result.emission += h.emission * w;
    result.roughness += h.roughness * w; result.metalness += h.metalness * w; result.ao += h.ao * w;
  }
  if (sum <= 0.0) return false;
  result.coverage = sum / visibleViewWeight; result.albedo /= sum; result.normal = normalize(result.normal); result.emission /= sum;
  result.roughness /= sum; result.metalness /= sum; result.ao /= sum; return true;
}
`;

export function patchImpostorShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = 'varying vec3 vImpostorLocalPoint;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvImpostorLocalPoint = transformed;');
  shader.fragmentShader = IMPOSTOR_TRACE_GLSL + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', /* glsl */`
// Only the uses in main/lighting are redirected, after the original varying declaration.
#define vViewPosition impShadingViewPosition
#ifdef USE_FOG
  #define vFogDepth impShadingViewPosition.z
#endif
void main() {
  vec3 impO = (impInverseWorld * vec4(impCameraPosition, 1.0)).xyz;
  vec3 impD = normalize(vImpostorLocalPoint - impO);
  if (isOrthographic) {
    vec3 carrierWorld = (impWorld * vec4(vImpostorLocalPoint, 1.0)).xyz;
    vec3 originWorld = carrierWorld - impCameraForward * dot(carrierWorld - impCameraPosition, impCameraForward);
    impO = (impInverseWorld * vec4(originWorld, 1.0)).xyz;
    impD = normalize((impInverseWorld * vec4(impCameraForward, 0.0)).xyz);
  }
  ImpHit impHit; if (!impTrace(impO, impD, impHit)) discard;
  vec3 impP = impO + impD * impHit.t;
  vec4 impView = viewMatrix * impWorld * vec4(impP, 1.0), impClip = impProjection * impView;
  float impDepth = impClip.z / impClip.w * .5 + .5;
  if (impDepth < 0.0 || impDepth > 1.0) discard;
  gl_FragDepth = impDepth;
  impShadingViewPosition = -impView.xyz;
  vec3 impSurfaceNormal = normalize(mat3(viewMatrix) * impWorldNormal * impHit.normal);
`);
  shader.fragmentShader = shader.fragmentShader
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(impHit.albedo * diffuse, impHit.coverage * opacity);')
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = impHit.emission;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = impHit.roughness;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = impHit.metalness;')
    .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0; vec3 normal = impSurfaceNormal; vec3 nonPerturbedNormal = normal;')
    .replace('#include <normal_fragment_maps>', '')
    .replace('#include <logdepthbuf_fragment>', '')
    .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= impHit.ao;')
    .replace('#include <opaque_fragment>', /* glsl */`
if (impDebugMode == 1) outgoingLight = impHit.albedo;
if (impDebugMode == 2) outgoingLight = impHit.normal * .5 + .5;
if (impDebugMode == 3) outgoingLight = vec3((dot(impP - impCenter, -impD) / (2.0 * impRadius)) + .5);
if (impDebugMode == 4) outgoingLight = vec3(impHit.roughness, impHit.metalness, impHit.ao);
if (impDebugMode == 5) outgoingLight = impHit.emission;
gl_FragColor = vec4(outgoingLight, diffuseColor.a);
`);
  return shader;
}

export function impostorCameraState(mesh, camera, layout) {
  mesh.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false);
  if (Math.abs(mesh.matrixWorld.determinant()) < 1e-12) throw new Error('Singular impostor site transform');
  const world = mesh.matrixWorld.clone(), inverseWorld = world.clone().invert();
  const position = camera.getWorldPosition(new THREE.Vector3()), forward = camera.getWorldDirection(new THREE.Vector3());
  const localCamera = position.clone().applyMatrix4(inverseWorld), localDirection = forward.clone().transformDirection(inverseWorld);
  const outward = camera.isOrthographicCamera ? localDirection.clone().negate() : localCamera.clone().sub(new THREE.Vector3().fromArray(layout.center));
  if (outward.lengthSq() < 1e-12) outward.copy(localDirection).negate();
  return { world, inverseWorld, worldNormal: new THREE.Matrix3().getNormalMatrix(world), position, forward, localCamera, localDirection, frames: selectImpostorFrames(outward.toArray(), layout.gridSize), cameraUUID: camera.uuid, projection: camera.projectionMatrix.clone() };
}

export function createImpostorMaterial(layout, tileSize, textures) {
  const uniforms = {
    impBase: { value: textures.base }, impNormalRoughness: { value: textures.normalRoughness }, impDepthMaterial: { value: textures.depthMaterial }, impEmission: { value: textures.emission },
    impCenter: { value: new THREE.Vector3().fromArray(layout.center) }, impBoundsMin: { value: new THREE.Vector3().fromArray(layout.bounds.min) }, impBoundsMax: { value: new THREE.Vector3().fromArray(layout.bounds.max) },
    impRadius: { value: layout.radius }, impTileSize: { value: tileSize }, impGridSize: { value: layout.gridSize },
    impWorld: { value: new THREE.Matrix4() }, impInverseWorld: { value: new THREE.Matrix4() }, impWorldNormal: { value: new THREE.Matrix3() }, impProjection: { value: new THREE.Matrix4() },
    impCameraPosition: { value: new THREE.Vector3() }, impCameraForward: { value: new THREE.Vector3() }, impDebugMode: { value: 0 },
  };
  for (const [key, member] of [['impFrameDirection', 'direction'], ['impFrameRight', 'right'], ['impFrameUp', 'up']]) uniforms[key] = { value: Array.from({ length: 16 }, (_, i) => new THREE.Vector3().fromArray(layout.frames[i % layout.frames.length][member])) };
  const material = new THREE.MeshStandardMaterial({ name: 'pine-shoot-impostor-study-only', color: 0xffffff, roughness: 1, metalness: 0, side: THREE.BackSide, alphaToCoverage: true, depthTest: true, depthWrite: true });
  material.customProgramCacheKey = () => 'yuanmingyuan-impostor-material-study-r3-surface-dda';
  material.onBeforeCompile = shader => patchImpostorShader(shader, uniforms);
  material.userData.impostorPasses = { ...IMPOSTOR_PASSES };
  return { material, uniforms, update(mesh, camera, renderer) {
    if (renderer?.capabilities?.logarithmicDepthBuffer || renderer?.capabilities?.reversedDepthBuffer) throw new Error('This study has no logarithmic/reversed-depth pass');
    const state = impostorCameraState(mesh, camera, layout);
    for (const [key, value] of [['impWorld', state.world], ['impInverseWorld', state.inverseWorld], ['impWorldNormal', state.worldNormal], ['impProjection', state.projection], ['impCameraPosition', state.position], ['impCameraForward', state.forward]]) uniforms[key].value.copy(value);
    return state;
  } };
}
