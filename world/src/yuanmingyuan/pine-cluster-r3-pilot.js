import * as THREE from 'three';
import { pineClusterR3MaterialSet } from './pine-cluster-r3-materials.js';
import { pineClusterBarkTexture } from './pine-cluster-source.js';
import { pineShootMaterialSet, attachPineShootMaterials } from './pine-shoot-lod-materials.js';

export function pineClusterR3View(camera, world, centre) {
  if (!world.elements.every(Number.isFinite) || world.elements[3] !== 0 || world.elements[7] !== 0 || world.elements[11] !== 0 || world.elements[15] !== 1 || world.determinant() === 0) throw new Error('R3 pilot needs a finite invertible affine transform');
  const inverse = world.clone().invert();
  const direction = camera.isOrthographicCamera ? new THREE.Vector3(0, 0, 1).transformDirection(camera.matrixWorld).transformDirection(inverse) : new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse).sub(centre);
  if (!direction.toArray().every(Number.isFinite) || direction.lengthSq() === 0) throw new Error('R3 camera is invalid or at the cluster centre');
  const values = direction.toArray(); let axis = 0; for (let i = 1; i < 3; i++) if (Math.abs(values[i]) > Math.abs(values[axis])) axis = i;
  return axis * 2 + (values[axis] < 0 ? 1 : 0);
}

/** Owns its one bake and cloned support wood, borrows the exact source. No
 * whole-tree factory is used; one signed view is submitted per actual camera,
 * including nested reflections, normal passes and directional/point shadows.
 * Six-view parallax and view changes are explicitly still native-review gates. */
export function createPineClusterR3Pilot(source, { baked, signal } = {}) {
  const group = new THREE.Group(), textures = [], materials = [], geometries = [], transition = { phase: { value: 0 }, role: { value: 0 } };
  let disposed = false, mode = 'source', phase = 0;
  try {
    signal?.throwIfAborted();
    if (!baked || baked.diagnostics.revision !== 'r3' || baked.diagnostics.partial || baked.diagnostics.sourceSha256 !== source.records.source.sha256 || baked.diagnostics.sourceRecordId !== source.records.id) throw new Error('R3 pilot needs the complete matching single-cluster bake');
    const makeTexture = (data, layers, name) => {
      const texture = new THREE.DataArrayTexture(data, baked.width, baked.height, layers); texture.name = name; texture.type = THREE.HalfFloatType; texture.format = THREE.RGBAFormat; texture.colorSpace = THREE.NoColorSpace;
      texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 1; texture.needsUpdate = true; textures.push(texture); return texture;
    };
    const set = pineClusterR3MaterialSet({ visibility: makeTexture(baked.visibility, 6, 'r3-visible-first-hit-coverage-depth'), normals: makeTexture(baked.normals, 36, 'r3-joint-visible-normal-moments'), colors: makeTexture(baked.colors, 36, 'r3-joint-visible-original-colours'), transition }); materials.push(...set.materials);
    const cards = new THREE.Mesh(baked.geometry); cards.name = 'pine-cluster-r3-six-first-hit-surfaces-one-active-view'; attachPineShootMaterials(cards, set); group.add(cards);
    const centre = source.bounds.getCenter(new THREE.Vector3()), lastViews = {};
    const select = (camera, renderer, pass) => {
      if (cards.isInstancedMesh) throw new Error('R3 per-instance view scheduling has not been implemented or admitted');
      const layer = pineClusterR3View(camera, cards.matrixWorld, centre), view = baked.views[layer];
      baked.geometry.setDrawRange(view.start, view.count); set.view.value = layer;
      const target = renderer.getRenderTarget(); set.multisampled.value = target ? Number(target.samples > 1) : Number(!!renderer.getContext().getContextAttributes()?.antialias);
      lastViews[pass] = { layer, start: view.start, count: view.count, multisampled: !!set.multisampled.value, camera: camera.uuid };
    };
    cards.onBeforeRender = (renderer, _scene, camera, _geometry, material) => select(camera, renderer, material === set.normal ? 'normal' : 'color-or-reflection');
    cards.onBeforeShadow = (renderer, _mesh, _camera, shadowCamera) => select(shadowCamera, renderer, 'shadow');
    const branchGeometry = source.branchGeometry.clone(), barkTexture = pineClusterBarkTexture(), bark = pineShootMaterialSet({ transition, name: 'pine-cluster-r3-retained-support-wood' });
    geometries.push(branchGeometry); textures.push(barkTexture); materials.push(...bark.materials); bark.surface.roughness = .96; bark.surface.side = THREE.FrontSide; bark.surface.emissiveIntensity = 0; bark.surface.map = barkTexture; bark.surface.bumpMap = barkTexture; bark.surface.bumpScale = .018;
    const wood = new THREE.Mesh(branchGeometry); attachPineShootMaterials(wood, bark); group.add(wood); group.name = 'pine-cluster-r3-unadmitted-single-cluster'; group.updateMatrixWorld(true);
    const diagnostics = { ...baked.diagnostics, totalTriangles: baked.geometry.index.count / 3 + branchGeometry.index.count / 3, submittedTrianglesPerPass: baked.views[0].count / 3 + branchGeometry.index.count / 3, originalWoodTriangles: branchGeometry.index.count / 3, drawCallsPerPass: 2, lastViews,
      coverageContract: 'frontmost source triangle at each deterministic subpixel; one selected continuous surface per actual pass, native MSAA4 area coverage; fixed 8x8 ordered coverage only for single-sample shadows/fallback',
      normalContract: 'six JOINT visible colour/normal bins, four finite directions each, all 24 original Three PBR responses weighted deterministically; no random normal or RGB compensation; inverse-transpose instance then model-view normals; per-instance directional dispatch NOT yet implemented',
      approximation: 'six signed orthographic first-hit fields and smoothed depth carrier; mean/colour within each bin and isotropic transverse angular variance; hard dominant-view switches and oblique parallax unreviewed',
      admission: 'single 28-shoot candidate only; native compilation, image quality, AO/shadow/reflection, transitions, whole-tree reuse and speed are unreviewed' };
    function setMode(value, amount = 0) {
      if (disposed || !['source', 'low', 'blend'].includes(value) || !Number.isFinite(amount) || amount < 0 || amount > 1) throw new Error('Invalid R3 pilot state');
      mode = value; phase = amount; source.group.visible = value === 'source' || value === 'blend' && amount < 1; group.visible = value === 'low' || value === 'blend' && amount > 0;
      source.transition.phase.value = transition.phase.value = amount; source.transition.role.value = value === 'blend' ? -1 : 0; transition.role.value = value === 'blend' ? 1 : 0;
      return { mode, phase, sourceVisible: source.group.visible, lowVisible: group.visible };
    }
    setMode('source');
    return { group, cards, wood, baked, textures, materials, diagnostics, setMode, get state() { return { mode, phase, revision: 'r3', sourceVisible: source.group.visible, lowVisible: group.visible }; },
      assertMainSceneAllowed() { throw new Error('R3 pine cluster has no native or whole-tree admission'); },
      dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); cards.onBeforeRender = () => {}; cards.onBeforeShadow = () => {}; materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); baked.dispose(); source.transition.role.value = source.transition.phase.value = 0; source.group.visible = true; },
    };
  } catch (error) { group.clear(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); baked?.dispose(); throw error; }
}
