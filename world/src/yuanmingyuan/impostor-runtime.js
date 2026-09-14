import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import { IMPOSTOR_MAPS, IMPOSTOR_PASSES, validateImpostorData } from './impostor-format.js';
import { createImpostorMaterial } from './impostor-material.js';
import { throwIfImpostorAborted } from './impostor-baker.js';

export async function impostorSHA256(bytes) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintImpostorSource(source) {
  const records = [];
  source.group.traverse(node => { if (node.isMesh) records.push(node); });
  const geometry = [];
  for (const node of records) {
    const g = node.geometry, attributes = {};
    for (const name of Object.keys(g.attributes).sort()) { const a = g.attributes[name]; attributes[name] = { type: a.array.constructor.name, itemSize: a.itemSize, normalized: a.normalized, count: a.count, sha256: await impostorSHA256(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)) }; }
    geometry.push({ name: node.name, attributes, index: g.index ? { type: g.index.array.constructor.name, count: g.index.count, sha256: await impostorSHA256(new Uint8Array(g.index.array.buffer, g.index.array.byteOffset, g.index.array.byteLength)) } : null, groups: g.groups, localMatrix: node.matrix.toArray(), materials: (Array.isArray(node.material) ? node.material : [node.material]).map(m => ({ name: m.name, type: m.type, color: m.color.toArray(), vertexColors: m.vertexColors, roughness: m.roughness, metalness: m.metalness, side: m.side, emissive: m.emissive.toArray(), emissiveIntensity: m.emissiveIntensity })) });
  }
  return { sha256: await impostorSHA256(new TextEncoder().encode(JSON.stringify(geometry))), records: geometry };
}

export async function serializeImpostorStudy(data) {
  validateImpostorData(data);
  const manifest = structuredClone(data.manifest), files = {};
  manifest.files = {};
  for (const key of IMPOSTOR_MAPS) {
    const bytes = data.maps[key].slice(), filename = `${key}.rgba8.bin`;
    manifest.files[key] = { filename, byteLength: bytes.byteLength, sha256: await impostorSHA256(bytes) }; files[filename] = bytes;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n'); files['manifest.json'] = bytes;
  return { manifest, manifestSHA256: await impostorSHA256(bytes), files };
}

/** Owns copied pixels and shared carrier geometry; each mesh leases the maps.
 * Disposing the owner prevents new leases. Existing meshes release independently. */
export function createImpostorStudyAsset(input) {
  const layout = validateImpostorData(input), manifest = structuredClone(input.manifest);
  const maps = Object.fromEntries(IMPOSTOR_MAPS.map(k => [k, input.maps[k].slice()])), textures = {};
  for (const key of IMPOSTOR_MAPS) {
    const t = new THREE.DataArrayTexture(maps[key], manifest.tileSize, manifest.tileSize, manifest.gridSize ** 2);
    t.name = `impostor-${manifest.id}-${key}`; t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.NoColorSpace;
    // The shader decodes declared sRGB channels itself; numeric maps stay linear.
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.unpackAlignment = 1; t.needsUpdate = true; textures[key] = t;
  }
  const min = new THREE.Vector3().fromArray(layout.bounds.min), max = new THREE.Vector3().fromArray(layout.bounds.max), size = max.clone().sub(min), center = max.clone().add(min).multiplyScalar(.5);
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z); geometry.translate(center.x, center.y, center.z);
  let ownerDisposed = false, resourcesDisposed = false, references = 0; const leases = new Set();
  const stats = () => ({ ownerDisposed, resourcesDisposed, references, textures: resourcesDisposed ? 0 : 4, pixelBytes: resourcesDisposed ? 0 : Object.values(maps).reduce((s, b) => s + b.byteLength, 0), carrierTrianglesPerMesh: 12, nativeReviewed: false, mainSceneAllowed: false });
  function releaseIfUnused() { if (!ownerDisposed || references || resourcesDisposed) return; resourcesDisposed = true; geometry.dispose(); Object.values(textures).forEach(t => { t.dispose(); t.image.data = null; }); for (const key of IMPOSTOR_MAPS) maps[key] = null; }
  return {
    manifest, passes: { ...IMPOSTOR_PASSES }, stats,
    assertMainSceneAllowed() { throw new Error('Impostor study has no native approval, shadow pass or GTAO normal pass; main-scene integration is forbidden'); },
    createProxy() {
      if (ownerDisposed) throw new Error('Impostor owner already disposed');
      const binding = createImpostorMaterial(layout, manifest.tileSize, textures), mesh = new THREE.Mesh(geometry, binding.material); let disposed = false;
      mesh.name = `${manifest.id}-impostor-study`; mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.userData.impostorPasses = { ...IMPOSTOR_PASSES }; const observations = new Map();
      mesh.onBeforeRender = (renderer, scene, camera) => {
        if (disposed) throw new Error('Disposed impostor lease rendered');
        if (scene.overrideMaterial) throw new Error('Impostor carrier cannot use an override normal/depth material');
        const state = binding.update(mesh, camera, renderer);
        observations.set(camera.uuid, { cameraUUID: camera.uuid, cameraName: camera.name || '(unnamed)', worldPosition: state.position.toArray(), localPosition: state.localCamera.toArray(), frames: state.frames, selectionReference: 'source bounds center; fragment shader selects per ray', projection: state.projection.toArray(), orthographic: camera.isOrthographicCamera === true });
        if (observations.size > 8) observations.delete(observations.keys().next().value);
      };
      references++;
      const lease = { mesh, material: binding.material, uniforms: binding.uniforms, observations: () => [...observations.values()], dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); binding.material.dispose(); references--; leases.delete(lease); releaseIfUnused(); } };
      leases.add(lease); return lease;
    },
    dispose() { if (ownerDisposed) return; ownerDisposed = true; releaseIfUnused(); },
    disposeAll() { this.dispose(); [...leases].forEach(lease => lease.dispose()); },
  };
}

export async function loadImpostorStudy({ manifestURL, expectedManifestSHA256, signal, fetchImpl = fetchPublicAsset }) {
  throwIfImpostorAborted(signal);
  if (!/^[0-9a-f]{64}$/.test(expectedManifestSHA256 ?? '')) throw new Error('Explicit study manifest SHA-256 required');
  const response = await fetchImpl(manifestURL, { signal }); if (!response.ok) throw new Error(`Impostor manifest HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer()); throwIfImpostorAborted(signal);
  if (await impostorSHA256(bytes) !== expectedManifestSHA256) throw new Error('Impostor manifest SHA-256 mismatch');
  const manifest = JSON.parse(new TextDecoder().decode(bytes)), maps = {};
  const total = manifest.tileSize ** 2 * manifest.gridSize ** 2 * 4;
  if (!Number.isInteger(total) || total < 256 || total > 4194304) throw new Error('Invalid small-study pixel size');
  for (const key of IMPOSTOR_MAPS) {
    throwIfImpostorAborted(signal); const file = manifest.files?.[key];
    if (!file || file.filename !== `${key}.rgba8.bin` || file.byteLength !== total || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error(`Invalid impostor ${key} transport record`);
    const result = await fetchImpl(new URL(file.filename, response.url || manifestURL).href, { signal }); if (!result.ok) throw new Error(`Impostor ${key} HTTP ${result.status}`);
    const pixels = new Uint8Array(await result.arrayBuffer()); throwIfImpostorAborted(signal);
    if (pixels.byteLength !== file.byteLength || await impostorSHA256(pixels) !== file.sha256) throw new Error(`Impostor ${key} byte/hash mismatch`);
    maps[key] = pixels;
  }
  throwIfImpostorAborted(signal); const asset = createImpostorStudyAsset({ manifest, maps });
  if (signal?.aborted) { asset.dispose(); throwIfImpostorAborted(signal); }
  return asset;
}
