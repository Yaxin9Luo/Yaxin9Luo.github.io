import * as THREE from 'three';
import { pineClusterSha256 } from './pine-cluster-io.js';

/** Independently versioned R3 resources. Old R1/R2 manifests and loader stay
 * unchanged. Reading is sequential, retaining only this one cluster. */
export async function loadPineClusterR3Bake({ baseURL = '/assets/pine-cluster-r3/', signal, fetcher = fetch } = {}) {
  signal?.throwIfAborted();
  const read = async path => { const response = await fetcher(baseURL + path, { signal }); if (!response.ok) throw new Error('R3 bake HTTP ' + response.status + ': ' + path); return response; };
  const manifest = await (await read('manifest.json')).json();
  if (manifest.version !== 3 || ![16, 32, 64, 128, 256].includes(manifest.width) || manifest.height !== manifest.width || manifest.layers !== 6 || manifest.diagnostics?.bins !== 6 || manifest.diagnostics.mainSceneAllowed !== false) throw new Error('Invalid R3 bake manifest');
  const buffers = {};
  for (const key of ['geometry', 'visibility', 'normals', 'colors']) {
    const entry = manifest.files[key]; if (!entry || !/^[a-z0-9-]+\.(json|bin)$/.test(entry.path)) throw new Error('Invalid R3 resource path');
    const bytes = await (await read(entry.path)).arrayBuffer(); signal?.throwIfAborted();
    if (bytes.byteLength !== entry.bytes || await pineClusterSha256(bytes) !== entry.sha256) throw new Error('R3 resource digest mismatch: ' + key);
    buffers[key] = bytes;
  }
  const fieldBytes = manifest.width * manifest.height * 6 * 4 * 2;
  if (buffers.visibility.byteLength !== fieldBytes || buffers.normals.byteLength !== fieldBytes * 6 || buffers.colors.byteLength !== fieldBytes * 6) throw new Error('R3 field dimensions mismatch');
  const data = JSON.parse(new TextDecoder().decode(buffers.geometry)), geometry = new THREE.BufferGeometry();
  try {
    for (const [name, size] of Object.entries({ position: 3, normal: 3, uv: 2 })) { const values = data.attributes[name]; if (!Array.isArray(values) || values.length % size || !values.every(Number.isFinite)) throw new Error('Invalid R3 attribute: ' + name); geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size)); }
    const count = geometry.attributes.position.count;
    if (!Object.values(geometry.attributes).every(a => a.count === count) || !Array.isArray(data.index) || data.index.length % 3 || !data.index.every(i => Number.isInteger(i) && i >= 0 && i < count)) throw new Error('Invalid R3 topology');
    if (!Array.isArray(manifest.views) || manifest.views.length !== 6 || manifest.views.some((view, i) => view.layer !== i || view.start !== i * view.count || view.count !== data.index.length / 6 || view.count % 3)) throw new Error('Invalid R3 directional draw ranges');
    if (data.index.length / 3 !== manifest.diagnostics.storedFoliageTriangles) throw new Error('R3 stored triangle count mismatch');
    geometry.setIndex(data.index); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); signal?.throwIfAborted(); let disposed = false;
    return { geometry, visibility: new Uint16Array(buffers.visibility), normals: new Uint16Array(buffers.normals), colors: new Uint16Array(buffers.colors), width: manifest.width, height: manifest.height, layers: 6, views: manifest.views, diagnostics: manifest.diagnostics, identity: manifest.files,
      dispose() { if (disposed) return; disposed = true; geometry.dispose(); this.visibility = this.normals = this.colors = null; },
    };
  } catch (error) { geometry.dispose(); throw error; }
}
