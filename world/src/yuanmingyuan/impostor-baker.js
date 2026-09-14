import * as THREE from 'three';
import { IMPOSTOR_MAPS, IMPOSTOR_SCHEMA, IMPOSTOR_PASSES, createImpostorFrames, linearToSrgb, srgbToLinear, packDepth16, unpackDepth16 } from './impostor-format.js';

export function throwIfImpostorAborted(signal) { if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Impostor operation aborted', 'AbortError'); }
const byte = n => Math.round(THREE.MathUtils.clamp(n, 0, 1) * 255);
const encoded = n => byte(linearToSrgb(THREE.MathUtils.clamp(n, 0, 1)));

export function createImpostorManifest({ id, layout, tileSize, source, method, supersample = 1 }) {
  return { schema: IMPOSTOR_SCHEMA, kind: 'yuanmingyuan-material-impostor-study', id, gridSize: layout.gridSize, tileSize, center: layout.center, radius: layout.radius, bounds: layout.bounds, frames: layout.frames,
    sourceGeometryRetained: true, nativeReviewed: false, mainSceneAllowed: false, passes: { ...IMPOSTOR_PASSES }, source: structuredClone(source), capture: { method, supersample, layerOrder: 'row-major octahedron; pixel origin lower-left', depth: 'orthographic front distance; RG uint16 big-endian normalized; 0 near, 1 far', normal: 'canonical source-space surface normal, RGB8 signed unit vector', base: 'sRGB RGB8, alpha linear coverage', normalRoughness: 'normal RGB8, roughness A8', depthMaterial: 'depth RG16, metalness B8, AO A8', emission: 'sRGB RGB8 source emission, A8 coverage', sampling: 'nearest; no generated mipmaps; native aliasing/disocclusion review pending', colorRange: 'linear 0..1; HDR emission unsupported' } };
}

export function downsampleImpostorCapture(input, tileSize, supersample) {
  const size = tileSize * supersample, out = Object.fromEntries(IMPOSTOR_MAPS.map(key => [key, new Uint8Array(tileSize * tileSize * 4)]));
  for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
    const target = (y * tileSize + x) * 4, color = [0, 0, 0], emission = [0, 0, 0], normal = new THREE.Vector3();
    let sum = 0, roughness = 0, metalness = 0, ao = 0, depth = 1;
    for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
      const i = ((y * supersample + sy) * size + x * supersample + sx) * 4, weight = input.base[i + 3] / 255;
      if (!weight) continue;
      sum += weight;
      for (let k = 0; k < 3; k++) { color[k] += srgbToLinear(input.base[i + k] / 255) * weight; emission[k] += srgbToLinear(input.emission[i + k] / 255) * weight; }
      normal.addScaledVector(new THREE.Vector3(input.normalRoughness[i] / 127.5 - 1, input.normalRoughness[i + 1] / 127.5 - 1, input.normalRoughness[i + 2] / 127.5 - 1), weight);
      roughness += input.normalRoughness[i + 3] / 255 * weight; metalness += input.depthMaterial[i + 2] / 255 * weight; ao += input.depthMaterial[i + 3] / 255 * weight;
      depth = Math.min(depth, unpackDepth16(input.depthMaterial[i], input.depthMaterial[i + 1]));
    }
    if (!sum) continue;
    normal.normalize(); const coverage = byte(sum / (supersample ** 2));
    out.base.set([...color.map(n => encoded(n / sum)), coverage], target);
    out.normalRoughness.set([...normal.toArray().map(n => byte(n * .5 + .5)), byte(roughness / sum)], target);
    out.depthMaterial.set([...packDepth16(depth), byte(metalness / sum), byte(ao / sum)], target);
    out.emission.set([...emission.map(n => encoded(n / sum)), coverage], target);
  }
  return out;
}

export function assertImpostorCaptureMaterial(material, cpu = false) {
  if (!material?.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.transparent || material.opacity !== 1 || material.alphaHash || material.lightMap || material.flatShading) throw new Error('First shoot capture requires opaque smooth MeshStandardMaterial (alphaTest openings allowed)');
  if (Math.max(...material.emissive.toArray()) * material.emissiveIntensity > 1) throw new Error('HDR emission requires a wider capture format');
  if (material.normalMap || material.bumpMap) throw new Error('The first surface-plane prototype requires geometric normals; separate shading-normal capture is not implemented');
  if (cpu && ['map', 'normalMap', 'bumpMap', 'alphaMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'displacementMap'].some(k => material[k])) throw new Error('The tiny CPU reference only supports constant material and vertex colors; texture capture requires GPU');
  if (material.displacementMap) throw new Error('Displacement changes capture bounds and is outside this shoot prototype');
}

export function patchImpostorCaptureShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = /* glsl */`
layout(location = 1) out highp vec4 impCaptureNormal;
layout(location = 2) out highp vec4 impCaptureDepth;
layout(location = 3) out highp vec4 impCaptureEmission;
uniform float impCaptureNear, impCaptureFar;
vec3 impEncode(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - .055, step(vec3(.0031308), c)); }
` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */`
float impZ = clamp((vViewPosition.z - impCaptureNear) / (impCaptureFar - impCaptureNear), 0.0, 1.0);
float impCode = floor(impZ * 65535.0 + .5);
vec2 impRG = vec2(floor(impCode / 256.0), mod(impCode, 256.0)) / 255.0;
vec3 impNormal = normalize(inverseTransformDirection(normal, viewMatrix));
float impAO = 1.0;
#ifdef USE_AOMAP
  impAO = (texture2D(aoMap, vAoMapUv).r - 1.0) * aoMapIntensity + 1.0;
#endif
gl_FragColor = vec4(impEncode(diffuseColor.rgb), diffuseColor.a);
impCaptureNormal = vec4(impNormal * .5 + .5, roughnessFactor);
impCaptureDepth = vec4(impRG, metalnessFactor, impAO);
impCaptureEmission = vec4(impEncode(totalEmissiveRadiance), diffuseColor.a);
`);
  for (const chunk of ['tonemapping_fragment', 'colorspace_fragment', 'fog_fragment', 'premultiplied_alpha_fragment', 'dithering_fragment']) shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, '');
  return shader;
}

function borrowCaptureScene(sourceGroup, cpu = false) {
  const clone = sourceGroup.clone(true), scene = new THREE.Scene(), materials = [];
  clone.position.set(0, 0, 0); clone.quaternion.identity(); clone.scale.set(1, 1, 1); clone.visible = true; clone.matrixAutoUpdate = true; clone.updateMatrix();
  clone.traverse(node => {
    if (node.isInstancedMesh || node.isSkinnedMesh || node.morphTargetInfluences?.length) throw new Error('First capture is one static shoot, not a tree/skin/instance batch');
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) assertImpostorCaptureMaterial(material, cpu);
    node.castShadow = false; node.receiveShadow = false;
  });
  scene.add(clone); scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone, true);
  return { scene, clone, materials, bounds: { min: box.min.toArray(), max: box.max.toArray() }, dispose() { materials.forEach(m => m.dispose()); scene.clear(); } };
}

/** Explicitly called by the standalone study. Never runs during source import. */
export async function bakeImpostorGPU({ renderer, source, gridSize = 4, tileSize = 128, supersample = 2, signal, onProgress = () => {}, yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0)) }) {
  throwIfImpostorAborted(signal);
  if (!renderer?.isWebGLRenderer || renderer.capabilities.logarithmicDepthBuffer || renderer.capabilities.reversedDepthBuffer) throw new Error('Standard-depth WebGL2 renderer required');
  if (!Number.isInteger(tileSize) || tileSize < 4 || tileSize > 256 || ![1, 2].includes(supersample)) throw new Error('Small capture allows tile 4–256 and 1× or 2× supersampling');
  const gl = renderer.getContext();
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < 4 || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) < 4) throw new Error('Four RGBA8 capture attachments required');
  const borrowed = borrowCaptureScene(source.group), layout = createImpostorFrames(borrowed.bounds, gridSize), size = tileSize * supersample;
  const target = new THREE.WebGLRenderTarget(size, size, { count: 4, type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, samples: 0, generateMipmaps: false });
  target.textures.forEach(t => { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; });
  const output = Object.fromEntries(IMPOSTOR_MAPS.map(key => [key, new Uint8Array(tileSize * tileSize * gridSize ** 2 * 4)]));
  const readback = Object.fromEntries(IMPOSTOR_MAPS.map(key => [key, new Uint8Array(size * size * 4)]));
  const radius = layout.radius, near = radius * .05, far = radius * 2.05, cameraDistance = radius * 1.05;
  const camera = new THREE.OrthographicCamera(-radius, radius, radius, -radius, near, far), C = new THREE.Vector3().fromArray(layout.center);
  const uniforms = { impCaptureNear: { value: near }, impCaptureFar: { value: far } };
  borrowed.clone.traverse(node => { if (!node.isMesh) return; const convert = original => { const m = original.clone(); m.alphaToCoverage = false; m.toneMapped = false; m.fog = false; m.customProgramCacheKey = () => 'impostor-four-target-capture-r1'; m.onBeforeCompile = shader => patchImpostorCaptureShader(shader, uniforms); borrowed.materials.push(m); return m; }; node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material); });
  const state = { target: renderer.getRenderTarget(), cube: renderer.getActiveCubeFace(), mip: renderer.getActiveMipmapLevel(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, shadowEnabled: renderer.shadowMap.enabled, xrEnabled: renderer.xr.enabled, viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest() };
  const started = performance.now(); let captured = 0;
  try {
    renderer.xr.enabled = false; renderer.shadowMap.enabled = false; renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = true; renderer.setClearColor(0x000000, 0);
    for (const frame of layout.frames) {
      throwIfImpostorAborted(signal);
      camera.position.copy(C).addScaledVector(new THREE.Vector3().fromArray(frame.direction), cameraDistance); camera.up.fromArray(frame.up); camera.lookAt(C); camera.updateMatrixWorld(true);
      renderer.setRenderTarget(target); renderer.clear(true, true, true); renderer.render(borrowed.scene, camera);
      for (let attachment = 0; attachment < IMPOSTOR_MAPS.length; attachment++) {
        throwIfImpostorAborted(signal);
        await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size, readback[IMPOSTOR_MAPS[attachment]], 0, attachment);
      }
      throwIfImpostorAborted(signal);
      const layer = downsampleImpostorCapture(readback, tileSize, supersample);
      for (const key of IMPOSTOR_MAPS) output[key].set(layer[key], frame.index * tileSize * tileSize * 4);
      captured++; onProgress({ captured, total: gridSize ** 2, elapsedMs: performance.now() - started }); await yieldFrame();
    }
    throwIfImpostorAborted(signal);
    return { manifest: createImpostorManifest({ id: source.diagnostics.id, layout, tileSize, source: source.diagnostics, method: 'WebGL2 real-geometry MRT', supersample }), maps: output, metrics: { captured, elapsedMs: performance.now() - started, outputBytes: Object.values(output).reduce((n, b) => n + b.byteLength, 0), captureTargetCount: 1, captureColorAttachments: 4, targetsDisposed: true, sourceDisposed: false } };
  } finally {
    target.dispose(); borrowed.dispose(); renderer.setRenderTarget(state.target, state.cube, state.mip); renderer.setViewport(state.viewport); renderer.setScissor(state.scissor); renderer.setScissorTest(state.scissorTest); renderer.setClearColor(state.clear, state.alpha); renderer.autoClear = state.autoClear; renderer.toneMapping = state.toneMapping; renderer.shadowMap.enabled = state.shadowEnabled; renderer.xr.enabled = state.xrEnabled;
  }
}

/** Small real-triangle reference, deliberately limited to 16² × 9 rays. It is
 * not a fallback atlas for the world and never substitutes for a GPU bake. */
export function bakeImpostorCPUFixture({ source, gridSize = 3, tileSize = 8, signal }) {
  throwIfImpostorAborted(signal);
  if (!Number.isInteger(tileSize) || tileSize < 4 || tileSize > 16 || ![2, 3].includes(gridSize) || source.diagnostics.triangles > 10000) throw new Error('CPU capture is restricted to a small real geometry fixture');
  const borrowed = borrowCaptureScene(source.group, true), layout = createImpostorFrames(borrowed.bounds, gridSize), radius = layout.radius, C = new THREE.Vector3().fromArray(layout.center), ray = new THREE.Raycaster();
  const maps = Object.fromEntries(IMPOSTOR_MAPS.map(k => [k, new Uint8Array(tileSize * tileSize * gridSize ** 2 * 4)]));
  let hits = 0;
  try {
    for (const frame of layout.frames) {
      const N = new THREE.Vector3().fromArray(frame.direction), R = new THREE.Vector3().fromArray(frame.right), U = new THREE.Vector3().fromArray(frame.up);
      for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
        throwIfImpostorAborted(signal);
        const origin = C.clone().addScaledVector(N, radius * 1.05).addScaledVector(R, ((x + .5) / tileSize - .5) * 2 * radius).addScaledVector(U, ((y + .5) / tileSize - .5) * 2 * radius);
        ray.set(origin, N.clone().negate()); ray.near = radius * .05; ray.far = radius * 2.05;
        const hit = ray.intersectObject(borrowed.clone, true)[0]; if (!hit) continue;
        const mesh = hit.object, g = mesh.geometry, material = Array.isArray(mesh.material) ? mesh.material[hit.face.materialIndex] : mesh.material;
        const inverse = mesh.matrixWorld.clone().invert(), localPoint = hit.point.clone().applyMatrix4(inverse), positions = g.attributes.position;
        const a = new THREE.Vector3().fromBufferAttribute(positions, hit.face.a), b = new THREE.Vector3().fromBufferAttribute(positions, hit.face.b), c = new THREE.Vector3().fromBufferAttribute(positions, hit.face.c), bary = THREE.Triangle.getBarycoord(localPoint, a, b, c, new THREE.Vector3());
        const normal = new THREE.Vector3(), color = material.color.clone();
        for (const [index, weight] of [[hit.face.a, bary.x], [hit.face.b, bary.y], [hit.face.c, bary.z]]) normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index), weight);
        normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)); if (normal.dot(ray.ray.direction) > 0) normal.negate();
        if (material.vertexColors && g.attributes.color) { const vertex = new THREE.Vector3(); for (const [index, weight] of [[hit.face.a, bary.x], [hit.face.b, bary.y], [hit.face.c, bary.z]]) vertex.addScaledVector(new THREE.Vector3().fromBufferAttribute(g.attributes.color, index), weight); color.multiply(new THREE.Color().setRGB(vertex.x, vertex.y, vertex.z, THREE.LinearSRGBColorSpace)); }
        const i = (frame.index * tileSize ** 2 + y * tileSize + x) * 4, depth = (hit.distance - ray.near) / (ray.far - ray.near);
        maps.base.set([...color.toArray().map(encoded), 255], i); maps.normalRoughness.set([...normal.toArray().map(n => byte(n * .5 + .5)), byte(material.roughness)], i); maps.depthMaterial.set([...packDepth16(depth), byte(material.metalness), 255], i); maps.emission.set([...material.emissive.toArray().map(n => encoded(n * material.emissiveIntensity)), 255], i); hits++;
      }
    }
    return { manifest: createImpostorManifest({ id: source.diagnostics.id, layout, tileSize, source: source.diagnostics, method: 'tiny CPU triangle-ray diagnostic; not production bake' }), maps, metrics: { rays: tileSize ** 2 * gridSize ** 2, hits, sourceDisposed: false } };
  } finally { borrowed.dispose(); }
}
