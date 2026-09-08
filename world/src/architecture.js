import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { loadPBRTexture } from './asset-cache.js';

const bevelCache = new Map();

/** A genuine 44-triangle chamfered solid, with a bevel measured in world units. */
export function beveledBlock(width, height, depth, bevel = 0.045) {
  const edge = Math.min(bevel, width * 0.22, height * 0.22, depth * 0.22);
  const key = [width, height, depth, edge].join('/');
  if (bevelCache.has(key)) return bevelCache.get(key);
  const half = [width / 2, height / 2, depth / 2];
  const points = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = (axis + 1) % 3, b = (axis + 2) % 3;
    for (const sign of [-1, 1]) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const p = [0, 0, 0];
      p[axis] = half[axis] * sign;
      p[a] = (half[a] - edge) * sa;
      p[b] = (half[b] - edge) * sb;
      points.push(new THREE.Vector3(...p));
    }
  }
  const geometry = new ConvexGeometry(points);
  bevelCache.set(key, geometry);
  return geometry;
}

/** Orthographic UVs in metres. Each triangle chooses one consistent projection. */
export function assignArchitecturalUVs(geometry, metresPerRepeat = 2.085) {
  const p = geometry.attributes.position;
  const uvs = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    normal.crossVectors(b.sub(a), c.sub(a));
    const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
      // Vertical masonry keeps its courses level; roof slopes use their true run.
      if (ny >= nx && ny >= nz) {
        uvs[j * 2] = x / metresPerRepeat;
        uvs[j * 2 + 1] = z / metresPerRepeat;
      } else if (nz >= nx) {
        uvs[j * 2] = x / metresPerRepeat;
        uvs[j * 2 + 1] = y / metresPerRepeat;
      } else {
        uvs[j * 2] = z / metresPerRepeat;
        uvs[j * 2 + 1] = y / metresPerRepeat;
      }
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

let loading = null;
let registered = null;
export function registerArchitectureMaterials(materials) {
  registered = materials;
  for (const key of ['stone', 'stoneLight', 'stoneDark', 'mortar']) if(materials[key]) Object.assign(materials[key].userData, { surface: 'castle-masonry', metresPerRepeat: 2.085 });
  for (const key of ['slate', 'rock']) if(materials[key]) Object.assign(materials[key].userData, { surface: 'mossy-rock', metresPerRepeat: 3 });
  for (const key of ['roof', 'roofLight', 'roofDark']) if(materials[key]) Object.assign(materials[key].userData, { surface: 'slate-roof', metresPerRepeat: 3 });
  for (const key of ['wood', 'woodLight']) if(materials[key]) Object.assign(materials[key].userData, { surface: 'aged-wood', metresPerRepeat: 2 });
  if(materials.copper) Object.assign(materials.copper.userData, { surface: 'oxidized-copper', metresPerRepeat: 1 });
}

/** Explicit preload keeps imports and procedural geometry usable in Node tools. */
export function loadArchitectureAssets() {
  if (loading) return loading;
  if (typeof document === 'undefined') return Promise.resolve();
  if (!registered) throw new Error('Architecture materials have not been registered.');
  const sets = {};
  const tasks = [];
  for (const [name, channels] of Object.entries({
    'castle-masonry': ['color', 'normal', 'roughness'],
    'slate-roof': ['color', 'normal', 'roughness'],
    'aged-wood': ['color', 'normal', 'roughness'],
    'mossy-rock': ['color', 'normal', 'roughness'],
    'oxidized-copper': ['color', 'normal', 'roughness', 'metalness'],
  })) {
    sets[name] = {};
    for (const channel of channels) tasks.push(loadPBRTexture(name, channel).then(texture => {
      sets[name][channel] = texture;
    }));
  }
  loading = Promise.all(tasks).then(() => {
    const bind = (keys, setName, normalStrength, metres) => {
      const set = sets[setName];
      for (const key of keys) {
        const material = registered[key];
        if (!material) continue;
        material.map = set.color;
        material.normalMap = set.normal;
        material.normalScale.setScalar(normalStrength);
        material.roughnessMap = set.roughness;
        if (set.metalness) material.metalnessMap = set.metalness;
        material.userData.surface = setName;
        material.userData.metresPerRepeat = metres;
        material.needsUpdate = true;
      }
    };
    bind(['stone', 'stoneLight', 'stoneDark', 'mortar'], 'castle-masonry', 0.75, 2.085);
    bind(['slate', 'rock'], 'mossy-rock', 0.9, 3);
    bind(['roof', 'roofLight', 'roofDark'], 'slate-roof', 0.8, 3);
    bind(['wood', 'woodLight'], 'aged-wood', 0.55, 2);
    bind(['copper'], 'oxidized-copper', 0.65, 1);
  });
  return loading;
}
