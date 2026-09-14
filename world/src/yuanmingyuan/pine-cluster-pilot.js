import * as THREE from 'three';
import { pineShootMaterialSet, attachPineShootMaterials } from './pine-shoot-lod-materials.js';
import { pineClusterBarkTexture } from './pine-cluster-source.js';
import { pineClusterMaterialSet } from './pine-cluster-materials.js';
import { bakePineCluster } from './pine-cluster-baker.js';

/** Takes ownership of an optional bake, never of the source. */
export async function createPineClusterPilot(source, { baked: suppliedBake, ...options } = {}) {
  const baked = suppliedBake ?? await bakePineCluster(source, options), group = new THREE.Group(), transition = { phase: { value: 0 }, role: { value: 0 } }, textures = [], materials = [], geometries = [];
  let disposed = false, mode = 'source', phase = 0;
  try {
    options.signal?.throwIfAborted();
    if (baked.diagnostics.partial) throw new Error('A partial terminal bake cannot be displayed as the complete branch cluster');
    if (baked.diagnostics.sourceSha256 !== source.records.source.sha256 || baked.diagnostics.sourceRecordId !== source.records.id) throw new Error('Cluster bake belongs to a different source');
    const makeTexture = (data, name, layers = baked.layers) => {
      const texture = new THREE.DataArrayTexture(data, baked.width, baked.height, layers); texture.name = name; texture.type = THREE.HalfFloatType; texture.format = THREE.RGBAFormat;
      texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 1; texture.needsUpdate = true; textures.push(texture); return texture;
    };
    const base = makeTexture(baked.base, 'pine-cluster-linear-premultiplied-base-coverage'), normal = makeTexture(baked.normal, 'pine-cluster-linear-premultiplied-normal-moment');
    const normalBins = baked.normalBins ? makeTexture(baked.normalBins, 'pine-cluster-source-normal-distribution', baked.layers * 6) : null;
    const cards = new THREE.Mesh(baked.geometry), set = pineClusterMaterialSet({ base, normal, normalBins, transition }); materials.push(...set.materials); attachPineShootMaterials(cards, set);
    cards.name = 'pine-cluster-42-volume-sheets'; group.add(cards);
    const branchGeometry = source.branchGeometry.clone(), bark = pineShootMaterialSet({ transition, name: 'pine-cluster-retained-eight-branches' }), barkTexture = pineClusterBarkTexture();
    geometries.push(branchGeometry); textures.push(barkTexture); materials.push(...bark.materials);
    bark.surface.roughness = .96; bark.surface.side = THREE.FrontSide; bark.surface.emissiveIntensity = 0; bark.surface.map = barkTexture; bark.surface.bumpMap = barkTexture; bark.surface.bumpScale = .018;
    const wood = new THREE.Mesh(branchGeometry); wood.name = 'pine-cluster-original-branch-geometry-copy'; attachPineShootMaterials(wood, bark); group.add(wood); group.name = 'pine-cluster-arm-3-fork-6-far-candidate'; group.updateMatrixWorld(true);
    const diagnostics = { ...baked.diagnostics, totalTriangles: baked.geometry.index.count / 3 + branchGeometry.index.count / 3, originalWoodTriangles: branchGeometry.index.count / 3, sourceShootInternalWood: 'all 28 source shoot wood components are included in the directional bake; the eight larger support branches remain actual geometry', drawCallsPerPass: 2,
      normalContract: normalBins ? 'Six projected-area source normal bins; four unit quadrature directions retain each first moment with isotropic transverse variance. Stable hash selection independent of coverage; geometric chart side, then inverse-transpose(instance) and normalMatrix. Ordinary source PBR; no full NDF or garden instancing admission.' : 'Premultiplied object-space source normal moment; inverse-transpose(instance) then normalMatrix; face forward to actual perspective or orthographic pass view, independent of card winding. Zero-scale instances invalid; no production instancing admission.',
      coverageContract: 'Same mean-preserving half-float alpha field and per-layer stochastic test in colour, GTAO normal/depth, directional and point-shadow passes. Finite-pixel grain and motion stability require native review.',
      admission: 'single real branch-cluster pilot only; no complete-tree representation, runtime selector, garden loading, GPU speedup or art acceptance' };
    function setMode(value, amount = 0) {
      if (disposed || !['source', 'low', 'blend'].includes(value) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw new Error('Invalid pine cluster display state');
      mode = value; phase = amount; source.group.visible = value === 'source' || value === 'blend' && amount < 1; group.visible = value === 'low' || value === 'blend' && amount > 0;
      source.transition.phase.value = transition.phase.value = amount; source.transition.role.value = value === 'blend' ? -1 : 0; transition.role.value = value === 'blend' ? 1 : 0;
      return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible };
    }
    setMode('source');
    return { group, cards, wood, baked, textures, materials, diagnostics, setMode, get state() { return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible }; },
      assertMainSceneAllowed() { throw new Error('Pine cluster pilot has no native or garden runtime admission'); },
      dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); baked.dispose(); source.transition.role.value = 0; source.transition.phase.value = 0; source.group.visible = true; },
    };
  } catch (error) { group.clear(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); baked.dispose(); throw error; }
}
