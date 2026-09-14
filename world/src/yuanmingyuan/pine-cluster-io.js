import * as THREE from 'three';

export async function pineClusterSha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function loadPineClusterBake({ baseURL = '/assets/pine-cluster-r2/', signal, fetcher = fetch } = {}) {
  signal?.throwIfAborted();
  const read = async path => { const response = await fetcher(baseURL + path, { signal }); if (!response.ok) throw new Error('Cluster bake HTTP ' + response.status + ': ' + path); return response; };
  const manifest = await (await read('manifest.json')).json();
  if (![1, 2].includes(manifest.version) || ![32, 64, 128, 256].includes(manifest.width) || manifest.height !== manifest.width || manifest.layers !== 42 || manifest.version === 2 && (manifest.diagnostics.normalFieldVersion !== 2 || manifest.diagnostics.normalBins !== 6)) throw new Error('Invalid cluster bake dimensions');
  const loaded = await Promise.all(['geometry', 'base', 'normal', ...(manifest.version === 2 ? ['normalBins'] : [])].map(async key => {
    const entry = manifest.files[key]; if (!/^[a-z0-9-]+\.(json|bin)$/.test(entry.path)) throw new Error('Invalid cluster bake resource path');
    const bytes = await (await read(entry.path)).arrayBuffer(); signal?.throwIfAborted();
    if (bytes.byteLength !== entry.bytes || await pineClusterSha256(bytes) !== entry.sha256) throw new Error('Cluster bake digest mismatch: ' + key);
    return bytes;
  }));
  const [geometryBytes, baseBytes, normalBytes, binBytes] = loaded, expectedBytes = manifest.width * manifest.height * manifest.layers * 4 * 2;
  if (baseBytes.byteLength !== expectedBytes || normalBytes.byteLength !== expectedBytes || binBytes && binBytes.byteLength !== expectedBytes * 6) throw new Error('Cluster field byte count mismatch');
  const data = JSON.parse(new TextDecoder().decode(geometryBytes)), geometry = new THREE.BufferGeometry();
  try {
    const expected = { position: 3, normal: 3, uv: 2, clusterLayer: 1, clusterAxis: 1 };
    for (const [name, size] of Object.entries(expected)) {
      const values = data.attributes[name]; if (!Array.isArray(values) || values.length % size || !values.every(Number.isFinite)) throw new Error('Invalid cluster attribute: ' + name);
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
    }
    const count = geometry.attributes.position.count;
    if (!Object.values(geometry.attributes).every(a => a.count === count) || !Array.isArray(data.index) || data.index.length % 3 || !data.index.every(i => Number.isInteger(i) && i >= 0 && i < count)) throw new Error('Invalid cluster topology');
    if (data.index.length / 3 !== manifest.diagnostics.cardTriangles) throw new Error('Cluster triangle count mismatch');
    geometry.setIndex(data.index); geometry.name = 'pine-cluster-six-folded-sheets-per-terminal'; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); signal?.throwIfAborted();
    let disposed = false;
    return { geometry, base: new Uint16Array(baseBytes), normal: new Uint16Array(normalBytes), normalBins: binBytes ? new Uint16Array(binBytes) : null, width: manifest.width, height: manifest.height, layers: manifest.layers, sheets: manifest.sheets, diagnostics: manifest.diagnostics, identity: manifest.files,
      dispose() { if (disposed) return; disposed = true; geometry.dispose(); },
    };
  } catch (error) { geometry.dispose(); throw error; }
}
