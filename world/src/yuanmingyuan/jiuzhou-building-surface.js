import * as THREE from 'three';

export const JIUZHOU_SURFACE_ID = 'jiuzhou-building-surface-r3';
const active = new WeakSet();
const finishes = Object.freeze({
  'jiuzhou-grey-clay-tile': { family: 'unglazed-clay', color: 0x757577, roughness: .91, period: .48, relief: .00080, roughnessRange: .12, albedoRange: .42 },
  'jiuzhou-grey-fired-clay-variation': { family: 'unglazed-clay', color: 0x666668, roughness: .92, period: .48, relief: .00080, roughnessRange: .12, albedoRange: .42 },
  'jiuzhou-grey-fired-clay-edge': { family: 'unglazed-clay', color: 0x808082, roughness: .90, period: .48, relief: .00080, roughnessRange: .12, albedoRange: .42 },
  'jiuzhou-warm-white-stone': { family: 'dressed-stone', roughness: .77, period: .18, relief: .00018, roughnessRange: .07, albedoRange: .024 },
  'jiuzhou-carved-stone': { family: 'dressed-stone', roughness: .74, period: .18, relief: .00016, roughnessRange: .06, albedoRange: .020 },
  'jiuzhou-vermilion-timber': { family: 'oiled-painted-wood', roughness: .51, period: .12, relief: .000045, roughnessRange: .045, albedoRange: 0 },
  'jiuzhou-green-oiled-posts': { family: 'oiled-painted-wood', roughness: .53, period: .12, relief: .000045, roughnessRange: .045, albedoRange: 0 },
  'jiuzhou-deep-red-recessed-wood': { family: 'finished-wood', roughness: .59, period: .14, relief: .000060, roughnessRange: .050, albedoRange: 0 },
  'jiuzhou-spotted-bamboo-joinery': { family: 'painted-joinery', roughness: .60, period: .12, relief: .000035, roughnessRange: .035, albedoRange: 0 },
  'jiuzhou-dragon-phoenix-hexi': { family: 'polychrome', roughness: .64, period: .12, relief: .000030, roughnessRange: .030, albedoRange: 0 },
  'jiuzhou-green-bogu-paintwork': { family: 'polychrome', roughness: .66, period: .12, relief: .000030, roughnessRange: .030, albedoRange: 0 },
  'jiuzhou-caihua-mineral-blue': { family: 'polychrome', roughness: .68, period: .12, relief: .000030, roughnessRange: .030, albedoRange: 0 },
  'jiuzhou-caihua-mineral-green': { family: 'polychrome', roughness: .68, period: .12, relief: .000030, roughnessRange: .030, albedoRange: 0 },
  'jiuzhou-caihua-pale-outlines': { family: 'polychrome', roughness: .70, period: .12, relief: .000025, roughnessRange: .025, albedoRange: 0 },
});
export const jiuzhouSurfaceFinishes = Object.freeze(Object.fromEntries(Object.entries(finishes).map(([name, value]) => [name, Object.freeze(value)])));

function createMicrostructure(clay = false) {
  const size = 512, data = new Uint8Array(size * size * 4);
  const hash = (x, y, seed) => {
    let h = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
  };
  const noise = (u, v, cells, seed) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    let a = x - ix, c = y - iy; a = a * a * (3 - 2 * a); c = c * c * (3 - 2 * c);
    const h = (dx, dy) => hash((ix + dx) % cells, (iy + dy) % cells, seed);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(0, 0), h(1, 0), a), THREE.MathUtils.lerp(h(0, 1), h(1, 1), a), c);
  };
  const encode = x => Math.round(255 * THREE.MathUtils.clamp(x, 0, 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, i = 4 * (y * size + x);
    const fine = noise(u, v, 128, 31), mid = noise(u, v, clay ? 48 : 43, 89), broad = noise(u, v, clay ? 12 : 11, 173);
    data[i] = encode(.5 + .38 * (fine - .5) + .32 * (mid - .5) + .12 * (broad - .5));
    data[i + 1] = encode(.5 + .62 * (broad - .5) + .25 * (mid - .5));
    data[i + 2] = encode(.5 + .50 * (broad - .5) + .25 * (mid - .5)); data[i + 3] = 255;
    if (clay) {
      // Centimetre firing clouds carry albedo; fine relief remains a separate
      // channel. A periodic soft warp breaks the value-noise lattice without
      // adding grout, dirt marks, extra geometry or higher-frequency speckles.
      const warpU = .12 * (noise(u, v, 6, 431) - .5);
      const warpV = .12 * (noise(u, v, 6, 577) - .5);
      const smoke = noise(u + 2 + warpU, v + 2 + warpV, 6, 173);
      const firing = .55 * smoke + .30 * noise(u + 2 + warpV, v + 2 - warpU, 12, 227)
        + .15 * noise(u + 2 - warpU, v + 2 + warpV, 24, 359);
      data[i + 1] = encode(.5 + .60 * (smoke - .5) + .25 * (mid - .5) + .15 * (fine - .5));
      data[i + 2] = encode(.5 + 1.90 * (firing - .5));
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = clay ? 'jiuzhou-clay-grain-r3' : 'jiuzhou-authored-microfinish-r1'; texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  texture.userData = { provenance: 'original-authored-scalar-microstructure', historicalImage: false, channels: 'R height / G roughness / B slight mineral albedo', sourcePaintPixelsChanged: false };
  return texture;
}

const declaration = /* glsl */`
varying vec3 vJzFinishWorld;
uniform sampler2D jzFinishMap;
uniform vec4 jzFinish; // period in world metres, height in metres, roughness span, mineral albedo span
vec3 jzMicrofinish(vec3 worldPosition, vec3 viewNormal) {
  vec3 axisWeight = pow(abs(inverseTransformDirection(viewNormal, viewMatrix)), vec3(4.0));
  axisWeight /= max(dot(axisWeight, vec3(1.0)), 1e-8);
  vec3 uvw = worldPosition / jzFinish.x;
  vec3 dx = dFdx(uvw), dy = dFdy(uvw);
  return textureGrad(jzFinishMap, uvw.yz, dx.yz, dy.yz).rgb * axisWeight.x
       + textureGrad(jzFinishMap, uvw.zx, dx.zx, dy.zx).rgb * axisWeight.y
       + textureGrad(jzFinishMap, uvw.xy, dx.xy, dy.xy).rgb * axisWeight.z;
}
vec3 jzPhysicalRelief(vec3 viewPosition, vec3 baseNormal, float heightMetres, float faceSign) {
  // Surface-gradient construction. Keep metric derivatives unnormalized:
  // normalizing them makes apparent relief change with camera distance.
  vec3 sx = dFdx(viewPosition), sy = dFdy(viewPosition);
  vec3 r1 = cross(sy, baseNormal), r2 = cross(baseNormal, sx);
  float determinant = dot(sx, r1) * faceSign;
  if (abs(determinant) < 1e-16) return baseNormal;
  vec3 gradient = sign(determinant) * (dFdx(heightMetres) * r1 + dFdy(heightMetres) * r2);
  return normalize(abs(determinant) * baseNormal - gradient);
}
`;
const once = (source, anchor, replacement) => {
  if (source.split(anchor).length !== 2) throw new Error('Jiuzhou surface shader anchor changed: ' + anchor);
  return source.replace(anchor, replacement);
};

// Per-tile firing colour is constant over the actual instance, independent of
// camera and of a later outer placement. No vertex or instance buffer is added.
const clayVertex = /* glsl */`
varying vec3 vJzClayFiring;
uniform vec3 jzClayOrigin;
uniform mat4 jzClayFrame;
uint jzClayHash(uint value) {
  value ^= value >> 13u;
  value *= 1274126177u;
  return value ^ (value >> 16u);
}
vec3 jzClayFiringAt(vec3 positionMetres) {
  // This 0.1 mm rounding affects only a deterministic colour seed, not geometry.
  ivec3 point = ivec3(floor(positionMetres * 10000.0 + 0.5));
  uint value = uint(point.x) * 374761393u ^ uint(point.y) * 668265263u ^ uint(point.z) * 2246822519u;
  return vec3(float(jzClayHash(value) & 16777215u),
    float(jzClayHash(value ^ 2654435769u) & 16777215u),
    float(jzClayHash(value ^ 2246822507u) & 16777215u)) / 16777215.0;
}
`;

function compileFinish(shader, material, texture, spec, diagnostics, clayFrame) {
  shader.uniforms.jzFinishMap = { value: texture };
  shader.uniforms.jzFinish = { value: new THREE.Vector4(spec.period, spec.relief, spec.roughnessRange, spec.albedoRange) };
  shader.vertexShader = once(shader.vertexShader, '#include <common>', '#include <common>\nvarying vec3 vJzFinishWorld;');
  shader.vertexShader = once(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
  vec4 jzFinishPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    jzFinishPosition = instanceMatrix * jzFinishPosition;
  #endif
  vJzFinishWorld = (modelMatrix * jzFinishPosition).xyz;`);
  if (clayFrame) {
    shader.uniforms.jzClayOrigin = { value: clayFrame.origin.clone() };
    shader.uniforms.jzClayFrame = { value: clayFrame.frame.clone() };
    shader.vertexShader = once(shader.vertexShader, '#include <common>', '#include <common>\n' + clayVertex);
    shader.vertexShader = once(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
    vec4 jzTileCentre = vec4(jzClayOrigin, 1.0);
    #ifdef USE_INSTANCING
      jzTileCentre = instanceMatrix * jzTileCentre;
    #endif
    vJzClayFiring = jzClayFiringAt((jzClayFrame * jzTileCentre).xyz);`);
  }
  shader.fragmentShader = once(shader.fragmentShader, '#include <common>', '#include <common>\n' + declaration + (clayFrame ? '\nvarying vec3 vJzClayFiring;\n' : ''));
  shader.fragmentShader = once(shader.fragmentShader, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec3 jzSurfaceSample = jzMicrofinish(vJzFinishWorld, normal);
  diffuseColor.rgb *= 1.0 + jzFinish.w * (jzSurfaceSample.b - 0.5);
  roughnessFactor = clamp(roughnessFactor + jzFinish.z * (jzSurfaceSample.g - 0.5), 0.04, 1.0);
  normal = jzPhysicalRelief(-vViewPosition, normal, jzFinish.y * (jzSurfaceSample.r - 0.5), faceDirection);`);
  if (clayFrame) {
    // The phase is constant within each true source instance; explicit metric
    // derivatives remain unchanged. Adjacent courses do not share one cloud.
    shader.fragmentShader = once(shader.fragmentShader,
      'jzMicrofinish(vJzFinishWorld, normal)',
      'jzMicrofinish(vJzFinishWorld + 0.48 * vJzClayFiring.yzx, normal)');
    shader.fragmentShader = once(shader.fragmentShader,
      'roughnessFactor = clamp(roughnessFactor + jzFinish.z * (jzSurfaceSample.g - 0.5), 0.04, 1.0);',
      `float jzFiringValue = 1.0 + 0.32 * (vJzClayFiring.x - 0.5);
      float jzFiringWarmth = 0.012 * (vJzClayFiring.y - 0.5);
      diffuseColor.rgb *= jzFiringValue * (vec3(1.0) + jzFiringWarmth * vec3(1.0, 0.12, -1.0));
      roughnessFactor = clamp(roughnessFactor + 0.040 * (vJzClayFiring.z - 0.5)
        + jzFinish.z * (jzSurfaceSample.g - 0.5), 0.86, 0.98);`);
  }
  diagnostics.shaderPreparations++;
  diagnostics.preparedMaterials = [...new Set([...diagnostics.preparedMaterials, material.name])];
}

/**
 * Borrow source geometry, instance matrices and paint textures.
 * Static internal placement is guarded; dispose the finish before its source.
 */
export function applyJiuzhouBuildingSurface({ group, signal } = {}) {
  signal?.throwIfAborted();
  if (!group?.isObject3D || active.has(group)) throw new Error('A single unleased Jiuzhou source group is required');
  group.updateWorldMatrix(true, true);
  const inverseRoot = group.matrixWorld.clone().invert();
  const bindings = [], copies = new Map(), shared = new Map(), textures = new Map();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const chosen = list.filter(m => finishes[m?.name]);
    if (!chosen.length) return;
    if (mesh.isSkinnedMesh || mesh.isBatchedMesh || mesh.morphTargetInfluences?.length) throw new Error('Static Jiuzhou source meshes are required');
    for (const material of chosen) {
      if (!material.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.userData?.jiuzhouSurface || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) throw new Error('Unexpected or already modified Jiuzhou material: ' + material.name);
    }
    const clay = chosen.some(m => finishes[m.name].family === 'unglazed-clay');
    let clayFrame;
    if (clay) {
      mesh.geometry.computeBoundingBox();
      clayFrame = {
        origin: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()),
        frame: new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld),
        instanceMatrix: mesh.instanceMatrix, instanceCount: mesh.count,
      };
      if (![...clayFrame.origin.toArray(), ...clayFrame.frame.elements].every(Number.isFinite)) throw new Error('Finite original clay frame required');
    }
    bindings.push({ mesh, geometry: mesh.geometry, original: mesh.material, clayFrame });
  });
  if (!bindings.length) throw new Error('No authored Jiuzhou building finish found');
  const diagnostics = {
    id: JIUZHOU_SURFACE_ID,
    scope: 'clay R3; other building finishes retain R1 response; no earth/paving/foundation/glazing or geometry changes',
    privateMaterials: 0, privateTextures: 0, borrowedPaintPixelsChanged: false,
    shaderPreparations: 0, preparedMaterials: [], nativeReviewed: false, disposed: false, materials: [],
    claySeed: { basis: 'original geometry centre transformed by actual instanceMatrix and source-relative mesh frame', cameraDependent: false, addedInstanceBuffers: 0, instancedMeshes: 0, instances: 0, nonInstancedMeshes: 0 },
  };
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const { mesh, original, assigned } of bindings) {
      if (mesh.material === assigned) mesh.material = original;
      else if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(m => copies.get(m) ?? m);
      else mesh.material = copies.get(mesh.material) ?? mesh.material;
    }
    const failures = [];
    for (const material of copies.keys()) { try { material.dispose(); } catch (error) { failures.push(error); } }
    for (const texture of textures.values()) { try { texture.dispose(); } catch (error) { failures.push(error); } }
    active.delete(group); signal?.removeEventListener('abort', dispose); diagnostics.disposed = true;
    if (failures.length) throw new AggregateError(failures, 'Jiuzhou private finish release failed');
  };
  try {
    for (const binding of bindings) {
      const local = new Map();
      const assign = source => {
        const spec = finishes[source?.name]; if (!spec) return source;
        const clay = spec.family === 'unglazed-clay', cache = clay ? local : shared;
        if (cache.has(source)) return cache.get(source);
        if (!textures.has(clay)) textures.set(clay, createMicrostructure(clay));
        const copy = source.clone(); copies.set(copy, source); cache.set(source, copy);
        copy.userData = { ...source.userData, jiuzhouSurface: { id: JIUZHOU_SURFACE_ID, family: spec.family, originalMaterialName: source.name } };
        copy.normalMap = null; copy.roughnessMap = null;
        if (spec.color !== undefined) copy.color.setHex(spec.color);
        copy.roughness = spec.roughness;
        copy.onBeforeCompile = shader => compileFinish(shader, copy, textures.get(clay), spec, diagnostics, clay ? binding.clayFrame : null);
        copy.customProgramCacheKey = () => JIUZHOU_SURFACE_ID + (clay ? ':clay' : ':finish');
        diagnostics.materials.push({ name: source.name, family: spec.family, colorBefore: source.color.getHexString(), colorAfter: copy.color.getHexString(), roughnessBefore: source.roughness, roughnessAfter: copy.roughness, map: source.map?.name ?? null, mapIdentityPreserved: source.map === copy.map, periodMetres: spec.period, reliefMetres: spec.relief, albedoSpan: spec.albedoRange });
        return copy;
      };
      binding.assigned = Array.isArray(binding.original) ? binding.original.map(assign) : assign(binding.original);
      signal?.throwIfAborted(); binding.mesh.material = binding.assigned;
      if (binding.clayFrame) {
        if (binding.mesh.isInstancedMesh) { diagnostics.claySeed.instancedMeshes++; diagnostics.claySeed.instances += binding.mesh.count; }
        else diagnostics.claySeed.nonInstancedMeshes++;
      }
    }
    diagnostics.privateMaterials = copies.size; diagnostics.privateTextures = textures.size;
    active.add(group); signal?.addEventListener('abort', dispose, { once: true });
    return { diagnostics, dispose, assertCurrent() {
      if (disposed) throw new Error('Jiuzhou surface lease disposed');
      group.updateWorldMatrix(true, true); const inverse = group.matrixWorld.clone().invert();
      for (const { mesh, geometry, assigned, clayFrame } of bindings) {
        if (mesh.geometry !== geometry || mesh.material !== assigned) throw new Error('Jiuzhou source binding changed during surface lease');
        if (clayFrame) {
          const current = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
          if (current.elements.some((v, i) => Math.abs(v - clayFrame.frame.elements[i]) > 1e-7) || mesh.instanceMatrix !== clayFrame.instanceMatrix || mesh.count !== clayFrame.instanceCount) throw new Error('Jiuzhou clay source-relative placement changed during surface lease');
        }
      }
    } };
  } catch (error) {
    try { dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Jiuzhou finish preparation and cleanup failed', { cause: error }); }
    throw error;
  }
}
