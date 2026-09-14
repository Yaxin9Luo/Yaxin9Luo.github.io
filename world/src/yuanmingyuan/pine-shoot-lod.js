import * as THREE from 'three';
import { pineShootGeometry } from './vegetation-geometry.js';
import { bakePineShootLod } from './pine-shoot-lod-baker.js';
import { pineShootMaterialSet, attachPineShootMaterials } from './pine-shoot-lod-materials.js';

export async function pineShootSha256(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function pineShootGeometryFingerprint(geometry) {
  const data = [];
  for (const name of ['index', ...Object.keys(geometry.attributes).sort()]) {
    const attr = name === 'index' ? geometry.index : geometry.attributes[name];
    data.push({ name, type: attr.array.constructor.name, size: attr.itemSize, normalized: attr.normalized, count: attr.count, sha256: await pineShootSha256(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength)) });
  }
  return { sha256: await pineShootSha256(JSON.stringify(data)), attributes: data };
}

/** One real repeat unit only. This entry never calls a whole-tree factory. */
export function createPineShootLodSource() {
  const geometry = pineShootGeometry({ seed: 218 }), group = new THREE.Group(), transition = { phase: { value: 0 }, role: { value: 0 } }, materials = pineShootMaterialSet({ transition, name: 'pine-shoot-source' }), mesh = new THREE.Mesh(geometry);
  mesh.name = 'pine-shoot-218-original'; attachPineShootMaterials(mesh, materials); group.name = 'pine-shoot-218-source'; group.add(mesh); group.updateMatrixWorld(true);
  let disposed = false;
  return { group, mesh, geometry, materials, transition, bounds: new THREE.Box3().setFromObject(group), diagnostics: { id: 'pine-shoot-218', seed: 218, triangles: geometry.index.count / 3, completeTreeConstructed: false, material: { color: '#ffffff', vertexColors: true, roughness: .77, emissive: '#263724', emissiveIntensity: .045 }, nativeReviewed: false }, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); materials.materials.forEach(m => m.dispose()); geometry.dispose(); } };
}

/** Source remains caller-owned. The candidate owns its bake and texture views;
 * disposing it neither clears nor disposes the retained near geometry. */
export async function createPineShootLodPilot(source, options = {}) {
  if (!source?.geometry || source.diagnostics?.triangles !== 4160) throw new Error('Expected one retained 4,160-triangle pine shoot source');
  const before = await pineShootGeometryFingerprint(source.geometry), baked = await bakePineShootLod(source.geometry, options), group = new THREE.Group(), textures = [], ownedMaterials = [];
  const transition = { phase: { value: 0 }, role: { value: 0 } };
  try {
    options.signal?.throwIfAborted();
    const makeTexture = (data, colorSpace, name) => {
      const texture = new THREE.DataTexture(data, baked.maps.width, baked.maps.height, THREE.RGBAFormat, THREE.UnsignedByteType);
      texture.name = name; texture.colorSpace = colorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 8; texture.needsUpdate = true; textures.push(texture); return texture;
    };
    const baseMap = makeTexture(baked.maps.base, THREE.SRGBColorSpace, 'pine-shoot-source-base-coverage'), normalMap = makeTexture(baked.maps.normal, THREE.NoColorSpace, 'pine-shoot-source-object-normal');
    const woodSet = pineShootMaterialSet({ transition, name: 'pine-shoot-retained-wood' }), cardSet = pineShootMaterialSet({ transition, baseMap, normalMap, name: 'pine-shoot-folded-needle-cards' });
    ownedMaterials.push(...woodSet.materials, ...cardSet.materials);
    const wood = new THREE.Mesh(baked.woodGeometry), cards = new THREE.Mesh(baked.cardGeometry); wood.name = 'pine-shoot-original-six-wood-branches'; cards.name = 'pine-shoot-branch-local-folded-needle-cards';
    attachPineShootMaterials(wood, woodSet); attachPineShootMaterials(cards, cardSet); group.name = 'pine-shoot-folded-card-pilot'; group.add(wood, cards);
    const after = await pineShootGeometryFingerprint(source.geometry); options.signal?.throwIfAborted(); if (after.sha256 !== before.sha256) throw new Error('The retained pine source changed during candidate construction');
    let disposed = false, mode = 'source', phase = 0;
    const diagnostics = { ...baked.diagnostics, sourceFingerprint: before, sourceAndCandidateIndependentOwners: true, sourceDraws: 1, candidateDraws: 2, passes: { pbr: true, alphaDepth: true, alphaDistance: true, alphaNormal: true, reflectionUsesActualCamera: true, nativeReviewed: false }, limits: ['Branch-local folded projection families approximate needle parallax and occlusion; this is a manual review pilot.', 'Alpha-to-coverage beauty edges and single-sample normal/shadow edges need native comparison.', 'Generated mipmaps and atlas gutters need distance/movement inspection.', 'Lower triangle count is not a measured speedup.', 'Object-space normal maps are used on ordinary meshes; future InstancedMesh rotations require their own normal-transform adapter and tests.'], nativeReviewed: false, mainSceneAllowed: false };
    function setMode(value, amount = 0) {
      if (disposed || !['source', 'low', 'blend'].includes(value) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw new Error('Invalid pine shoot display state');
      mode = value; phase = amount;
      source.group.visible = value === 'source' || value === 'blend' && amount < 1; group.visible = value === 'low' || value === 'blend' && amount > 0;
      source.transition.phase.value = transition.phase.value = amount;
      source.transition.role.value = value === 'blend' ? -1 : 0; transition.role.value = value === 'blend' ? 1 : 0;
      return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible };
    }
    setMode('source');
    return { group, wood, cards, textures, materials: ownedMaterials, baked, source, diagnostics, setMode, get state() { return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible }; }, assertMainSceneAllowed() { throw new Error('Pine shoot card pilot has no native or main-scene admission'); }, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); ownedMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); baked.dispose(); source.transition.role.value = 0; source.transition.phase.value = 0; source.group.visible = true; } };
  } catch (error) { group.clear(); ownedMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); baked.dispose(); throw error; }
}
