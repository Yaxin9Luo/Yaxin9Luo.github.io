import * as THREE from 'three';
import { WILLOW_LOD_POLICY } from './willow-lod-geometry.js';

const V = (...p) => new THREE.Vector3(...p), patched = new WeakSet();
const fragmentCoverage = `
  if (abs(vWillowLodFade.y) > 0.5) {
    float willowDither = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
    if (vWillowLodFade.y > 0.0 ? willowDither >= vWillowLodFade.x : willowDither < vWillowLodFade.x) discard;
  }
`;

// This also has to be installed on an external normal override, such as
// GTAOPass.normalMaterial. Ordinary non-willow geometry gets [0,0] and keeps
// all its fragments. Installing the patch alone does not claim GPU validation.
export function enableWillowLodCoverage(material) {
  if (patched.has(material)) return material;
  const before = material.onBeforeCompile, cacheKey = material.customProgramCacheKey;
  material.onBeforeCompile = function(shader, renderer) {
    before.call(this, shader, renderer);
    if (!shader.vertexShader.includes('#include <begin_vertex>') || !shader.fragmentShader.includes('#include <clipping_planes_fragment>')) throw new Error('Willow coverage needs the standard Three geometry shader stages');
    shader.vertexShader = 'attribute vec2 willowLodFade;\nvarying vec2 vWillowLodFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWillowLodFade = willowLodFade;');
    shader.fragmentShader = 'varying vec2 vWillowLodFade;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + fragmentCoverage);
  };
  material.customProgramCacheKey = function() { return `${cacheKey.call(this)}|willow-complementary-coverage-v1`; };
  material.defaultAttributeValues = { ...material.defaultAttributeValues, willowLodFade: [0, 0] };
  material.needsUpdate = true; patched.add(material); return material;
}

export function willowCoverageAt(x, y, phase, role) {
  if (![x, y, phase, role].every(Number.isFinite) || phase < 0 || phase > 1 || ![-1, 0, 1].includes(role)) throw new Error('Invalid willow coverage sample');
  const fract = value => value - Math.floor(value), dither = fract(52.9829189 * fract(Math.floor(x) * .06711056 + Math.floor(y) * .00583715));
  return role === 0 || (role > 0 ? dither < phase : dither >= phase);
}

// Attribute objects own separate renderer buffers, while immutable CPU arrays
// are shared. Disposing a population cannot delete another population's GL
// buffer or the frozen source's attributes. No source array is ever edited.
function geometryView(source) {
  const geometry = new THREE.BufferGeometry(); geometry.name = `${source.name}-willow-population-view`;
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (attribute.isInterleavedBufferAttribute || attribute.isInstancedBufferAttribute) throw new Error('Unexpected mutable/interleaved willow prototype attribute');
    geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized).setUsage(attribute.usage));
  }
  if (source.index) geometry.setIndex(new THREE.BufferAttribute(source.index.array, 1));
  geometry.boundingBox = source.boundingBox?.clone() ?? null; geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  return geometry;
}

function placementMatrix(record = {}) {
  const position = record.position ?? [0, 0, 0], rotation = record.rotation ?? [0, 0, 0], scale = typeof record.scale === 'number' ? [record.scale, record.scale, record.scale] : record.scale ?? [1, 1, 1];
  if (![position, rotation, scale].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) || scale.some(v => v <= 0) || Math.max(...scale) - Math.min(...scale) > 1e-8) throw new Error('Willow placement needs finite XYZ/Euler and positive uniform scale');
  return new THREE.Matrix4().compose(V(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), V(...scale));
}

function materialsFor(source) {
  if (!source?.isMeshStandardMaterial) throw new Error('Willow LOD borrows a standard PBR source material');
  // Material.clone() omits shader hooks. These owned surfaces retain the source
  // PBR chain before adding coverage; callbacks still receive the surface as this.
  const surface = source.clone();
  surface.onBeforeCompile = source.onBeforeCompile;
  surface.customProgramCacheKey = source.customProgramCacheKey;
  enableWillowLodCoverage(surface);
  const depth = enableWillowLodCoverage(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: source.side }));
  const distance = enableWillowLodCoverage(new THREE.MeshDistanceMaterial({ side: source.side }));
  return { surface, depth, distance };
}

function attachMaterials(mesh, materials) {
  mesh.customDepthMaterial = materials.depth; mesh.customDistanceMaterial = materials.distance;
  mesh.castShadow = true; mesh.receiveShadow = true;
}

function disposeOwned(group, meshes, geometries, materials) {
  meshes.forEach(mesh => mesh.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); group.clear();
}

// Actual GPU instancing of the complete 3D tier. Each prototype is drawn once
// for all placements. Textures and immutable source arrays remain borrowed.
export function createWillowInstancedLevel(records, placements) {
  if (!records?.length || !placements?.length) throw new Error('Willow population needs prototypes and placements');
  const transforms = placements.map(placementMatrix), group = new THREE.Group(), meshes = [], geometries = [], materials = [], fades = [];
  group.name = 'willow-instanced-geometry-population';
  try {
    for (const record of records) {
      const geometry = geometryView(record.geometry); geometries.push(geometry);
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(placements.length * 2), 2).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('willowLodFade', fade); fades.push(fade);
      const materialSet = materialsFor(record.material); materials.push(...Object.values(materialSet));
      const mesh = new THREE.InstancedMesh(geometry, materialSet.surface, placements.length); mesh.name = record.name; meshes.push(mesh);
      transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); attachMaterials(mesh, materialSet); mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
    }
    let disposed = false;
    return {
      group, meshes, resources: { geometries, materials, instances: meshes },
      setCoverage(index, phase = 0, role = 0) {
        if (disposed || !Number.isInteger(index) || index < 0 || index >= placements.length || !Number.isFinite(phase) || phase < 0 || phase > 1 || ![-1, 0, 1].includes(role)) throw new Error('Invalid willow instance fade');
        for (const fade of fades) { fade.setXY(index, phase, role); fade.needsUpdate = true; }
      },
      diagnostics: { placements: placements.length, prototypeDraws: meshes.length, ordinaryTriangles: true, texturesBorrowed: true, immutableCpuArraysShared: true, gpuAttributeOwnershipIndependent: true, nativeReviewed: false, mainSceneAllowed: false },
      dispose() { if (disposed) return; disposed = true; disposeOwned(group, meshes, geometries, materials); },
    };
  } catch (error) { disposeOwned(group, meshes, geometries, materials); throw error; }
}

function createNearRepresentation(willow) {
  willow.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(willow.matrixWorld).invert(), group = new THREE.Group(), meshes = [], geometries = [], materials = [], fades = [];
  group.name = 'willow-near-frozen-source';
  try {
    willow.traverse(source => {
      if (!source.isMesh) return;
      const geometry = geometryView(source.geometry); geometries.push(geometry);
      // All the original leaf instances in one mesh share this tree's fade.
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(2), 2, false, source.isInstancedMesh ? source.count : 1).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('willowLodFade', fade); fades.push(fade);
      const materialSet = materialsFor(source.material); materials.push(...Object.values(materialSet));
      const mesh = new THREE.InstancedMesh(geometry, materialSet.surface, source.isInstancedMesh ? source.count : 1); mesh.name = source.name; meshes.push(mesh);
      if (source.isInstancedMesh) { mesh.instanceMatrix.copy(source.instanceMatrix); if (source.instanceColor) mesh.instanceColor = source.instanceColor.clone(); }
      else mesh.setMatrixAt(0, new THREE.Matrix4());
      mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, source.matrixWorld)); attachMaterials(mesh, materialSet); mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
    });
    let disposed = false;
    return { group, resources: { geometries, materials, instances: meshes }, setCoverage(_index, phase, role) { for (const fade of fades) { fade.setXY(0, phase, role); fade.needsUpdate = true; } }, dispose() { if (disposed) return; disposed = true; disposeOwned(group, meshes, geometries, materials); } };
  } catch (error) { disposeOwned(group, meshes, geometries, materials); throw error; }
}

export function willowLodTierForCamera({ camera, worldBounds, viewportHeight, worldScale = 1, previous = 'near', policy = WILLOW_LOD_POLICY }) {
  if (!camera?.isPerspectiveCamera || !(viewportHeight > 0 && worldScale > 0) || worldBounds.isEmpty()) throw new Error('Willow tier selection needs a perspective camera and actual bounds');
  camera.updateWorldMatrix(true, false);
  const centre = worldBounds.getCenter(V()).applyMatrix4(camera.matrixWorldInverse), size = worldBounds.getSize(V()), radius = size.length() / 2;
  const depth = Math.max(camera.near, -centre.z - radius), pixelsPerMetre = viewportHeight * camera.projectionMatrix.elements[5] / (2 * depth);
  const crownPixels = Math.max(size.x, size.y, size.z) * pixelsPerMetre, farErrorPixels = Math.max(policy.farSpatialError, policy.branchFarError) * worldScale * pixelsPerMetre;
  const nearLimit = policy.nearCrownPixels * (previous === 'near' ? 1 - policy.hysteresis : 1 + policy.hysteresis), farMargin = previous === 'far' ? 1 + policy.hysteresis : 1 - policy.hysteresis;
  const tier = crownPixels >= nearLimit ? 'near' : crownPixels <= policy.farCrownPixels * farMargin && farErrorPixels <= policy.farErrorPixels * farMargin ? 'far' : 'mid';
  return { tier, crownPixels, farErrorPixels, pixelsPerMetre, conservativeDepth: depth };
}

// One vertical pilot, with no source factory call and no landscape placement.
// The caller retains source/level lifetime. For AO reviews the caller must use
// enableWillowLodCoverage on its normal override before drawing transitions.
export function createWillowLodPilot({ source, levels, placement = {}, policy = WILLOW_LOD_POLICY }) {
  const willow = (source.group ?? source).getObjectByName('garden-willow'); if (!willow || !levels?.mid?.length || !levels?.far?.length) throw new Error('Willow pilot needs one frozen source and its processed levels');
  const matrix = placementMatrix(placement), group = new THREE.Group(), representations = {};
  group.name = 'willow-geometry-lod-pilot'; group.applyMatrix4(matrix);
  try {
    representations.near = createNearRepresentation(willow);
    representations.mid = createWillowInstancedLevel(levels.mid, [{}]); representations.far = createWillowInstancedLevel(levels.far, [{}]);
    Object.values(representations).forEach(r => group.add(r.group)); group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group), worldScale = new THREE.Vector3().setFromMatrixScale(matrix).x;
    let current = 'near', transition = null, disposed = false;
    const blend = (from, to, phase) => {
      if (disposed || !representations[from] || !representations[to] || !(phase >= 0 && phase <= 1)) throw new Error('Invalid willow pilot blend');
      for (const r of Object.values(representations)) r.group.visible = false;
      if (from === to) { representations[to].group.visible = true; representations[to].setCoverage(0, 0, 0); return; }
      representations[from].group.visible = phase < 1; representations[from].setCoverage(0, phase, -1);
      representations[to].group.visible = phase > 0; representations[to].setCoverage(0, phase, 1);
    };
    blend('near', 'near', 0);
    return {
      group, representations, bounds, policy,
      setBlend: blend,
      update(camera, { viewportHeight, nowSeconds } = {}) {
        if (!Number.isFinite(nowSeconds)) throw new Error('Willow transition needs caller time in seconds');
        const selection = willowLodTierForCamera({ camera, worldBounds: bounds, viewportHeight, worldScale, previous: transition?.to ?? current, policy });
        if (!transition && selection.tier !== current) transition = { from: current, to: selection.tier, started: nowSeconds };
        if (transition) {
          const phase = THREE.MathUtils.clamp((nowSeconds - transition.started) / policy.fadeSeconds, 0, 1); blend(transition.from, transition.to, phase);
          if (phase === 1) { current = transition.to; transition = null; }
        }
        return { ...selection, current, transition: transition ? { ...transition } : null };
      },
      diagnostics: { nearSourceRebuilt: false, originalLeafPosesRetained: true, geometryDeformation: 'none-source-and-levels-static', normalOverrideNeedsCoveragePatch: true, nativeReviewed: false, mainSceneAllowed: false },
      dispose() { if (disposed) return; disposed = true; Object.values(representations).forEach(r => r.dispose()); group.clear(); },
    };
  } catch (error) { Object.values(representations).forEach(r => r.dispose()); group.clear(); throw error; }
}
