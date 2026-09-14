import { pineClusterSha256 } from './pine-cluster-io.js';
import { PINE_CLUSTER_RECORDS } from './pine-cluster-records.js';

export const PINE_CLUSTER_VIEWS = Object.freeze({
  oblique: { label: '斜向', direction: [.65, .22, 1] },
  front: { label: '正面', direction: [0, .10, 1] },
  side: { label: '侧面', direction: [1, .12, 0] },
  back: { label: '背面', direction: [0, .10, -1] },
  top: { label: '顶面', direction: [.05, 1, .05] },
  underside: { label: '下视 · 移去承影板', direction: [.35, -.75, 1] },
});
export const PINE_CLUSTER_LIGHTS = Object.freeze({
  day: { background: '#aeb8bc', hemi: 2.3, key: '#fff0d4', intensity: 3.5, rim: '#bacde4', rimIntensity: 1.4 },
  night: { background: '#142333', hemi: 1.5, key: '#bbd6ff', intensity: 2.2, rim: '#edc189', rimIntensity: 2 },
});
const expected = { './vegetation-geometry.js': PINE_CLUSTER_RECORDS.source.geometrySha256, './garden-vegetation.js': PINE_CLUSTER_RECORDS.source.sha256 };
export async function pineClusterStudioIdentity(raw) {
  const files = [], chunks = [];
  for (const path of Object.keys(raw).sort()) {
    const sha256 = await pineClusterSha256(raw[path]); if (expected[path] && expected[path] !== sha256) throw new Error('Frozen pine dependency mismatch: ' + path);
    files.push({ path, sha256, bytes: new TextEncoder().encode(raw[path]).byteLength }); chunks.push(path + '\0' + raw[path] + '\0');
  }
  for (const path of Object.keys(expected)) if (!Object.hasOwn(raw, path)) throw new Error('Missing pine dependency identity: ' + path);
  return { sha256: await pineClusterSha256(chunks.join('')), files, sourceDependenciesVerified: true };
}
export async function savePineClusterCapture({ canvas, render, metadata, upload, signal }) {
  signal?.throwIfAborted(); render(); const record = structuredClone(metadata());
  const clean = x => String(x).replace(/[^a-z0-9_-]/gi, '-').slice(0, 40), stamp = Date.parse(record.createdAt);
  const stem = ['yuanmingyuan-pine-cluster', record.sourceIdentity.sha256.slice(0, 16), record.state.mode, record.view, record.light, record.output, record.water ? 'water' : 'ground', 'p' + Math.round(record.state.phase * 100), record.sequence, stamp].map(clean).join('-');
  record.files = { png: stem + '.png', json: stem + '.json' };
  const png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Pine cluster PNG encoding failed')), 'image/png'));
  signal?.throwIfAborted(); const json = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), retainedFiles = [];
  try { for (const [filename, blob] of [[record.files.png, png], [record.files.json, json]]) { signal?.throwIfAborted(); await upload(filename, blob, signal); retainedFiles.push(filename); } }
  catch (error) { error.retainedFiles = retainedFiles; throw error; }
  return { record, png, json };
}
