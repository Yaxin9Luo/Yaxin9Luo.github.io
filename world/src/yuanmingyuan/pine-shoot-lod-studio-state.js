import { pineShootSha256 } from './pine-shoot-lod.js';

export const PINE_SHOOT_VIEWS = Object.freeze({
  front: { label: '正面', direction: [0, .10, 1] },
  side: { label: '侧面', direction: [1, .12, 0] },
  back: { label: '背面', direction: [0, .10, -1] },
  top: { label: '顶面', direction: [.05, 1, .05] },
  underside: { label: '下视 · 移去承影板', direction: [.35, -.75, 1] },
});
export const PINE_SHOOT_LIGHTS = Object.freeze({
  day: { background: '#aeb8bc', hemi: 2.3, key: '#fff0d4', intensity: 3.5, rim: '#bacde4', rimIntensity: 1.4 },
  night: { background: '#142333', hemi: 1.5, key: '#bbd6ff', intensity: 2.2, rim: '#edc189', rimIntensity: 2 },
});
const expected = {
  './vegetation-geometry.js': '59376f8a0703e92c00b274b3936c494eda7c43bed787e218ac1b7be3d25c8bd6',
  './vegetation-textures.js': '26b2c9310b67aa8075832dc9857775b3097da330ebcf16a0e6a36cfcef696474',
};
export async function pineShootStudioIdentity(raw) {
  const files = [], chunks = [];
  for (const path of Object.keys(raw).sort()) {
    const sha256 = await pineShootSha256(raw[path]); if (expected[path] && expected[path] !== sha256) throw new Error('Frozen pine dependency mismatch: ' + path);
    files.push({ path, sha256, bytes: new TextEncoder().encode(raw[path]).byteLength }); chunks.push(path + '\0' + raw[path] + '\0');
  }
  for (const path of Object.keys(expected)) if (!Object.hasOwn(raw, path)) throw new Error('Missing pine dependency identity: ' + path);
  return { sha256: await pineShootSha256(chunks.join('')), files, sourceDependenciesVerified: true };
}
export async function savePineShootCapture({ canvas, render, metadata, upload, signal }) {
  signal?.throwIfAborted(); render(); const record = structuredClone(metadata());
  const clean = x => String(x).replace(/[^a-z0-9_-]/gi, '-').slice(0, 24), stamp = Date.parse(record.createdAt);
  const stem = ['yuanmingyuan-pine-shoot-lod', record.sourceIdentity.sha256.slice(0, 16), record.state.mode, record.view, record.light, record.output, record.water ? 'water' : 'ground', 'p' + Math.round(record.state.phase * 100), record.sequence, stamp].map(clean).join('-');
  record.files = { png: stem + '.png', json: stem + '.json' };
  const png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Pine PNG encoding failed')), 'image/png'));
  signal?.throwIfAborted(); const json = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), retainedFiles = [];
  try { for (const [filename, blob] of [[record.files.png, png], [record.files.json, json]]) { signal?.throwIfAborted(); await upload(filename, blob, signal); retainedFiles.push(filename); } }
  catch (error) { error.retainedFiles = retainedFiles; throw error; }
  return { record, png, json };
}

