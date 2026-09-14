// Current source bytes are verified independently of any native acceptance.
// R1/R2 records and their source snapshots remain immutable historical evidence.
export const WILLOW_STUDIO_REVISION = 'willow-distance-r3-wood-stability';
export const WILLOW_HISTORICAL_REFERENCES = Object.freeze([
  Object.freeze({ revision: 'r1', sourceIdentitySha256: '7e71e043a8b82fb7caa5aff4ba571a61b1a888fb4a566fdf0e05adaff6ee1647', assetBundleSha256: '4b5cc7c189cded62346791cdc015c5f28771810da44dd8ae236b6c8263e0cd62', proof: 'docs/art/yuanmingyuan/willow-distance-studio-r1-freeze.json' }),
  Object.freeze({ revision: 'r2', sourceIdentitySha256: 'cf79dccf6227037be004bab8f9bbe3a911d7ee4f830fd303ca138d1682b7b4ec', assetBundleSha256: 'bd2c85f17a58af31b1e1056ebf7f91844ac705249491dae3fb90eff2e8ca36a8', proof: 'docs/art/yuanmingyuan/willow-distance-studio-r2-freeze.json' }),
]);
export const WILLOW_FROZEN_BUNDLE = '1ed3466cf503960ec29f38c541d8afc147bb639309503f06a200fd3ccdce5032';
export const WILLOW_EXPECTED_ASSET_SOURCES = Object.freeze({
  './willow-lod-geometry.js': '794b3fe78485f092e264965bc5d8b40e38a10e10efeec14cc53a8c044d2034a8',
  './willow-lod-runtime.js': '733b84b1d630498d16cbc74a6b0f2919a854f0659d239f7f0012574a4ce13ea3',
  './willow-lod-study-views.js': '75f4d134446237df0a33969a56718e67131b2a42f190c6037580d71fcf9653e1',
  './garden-vegetation.js': '966a0b6231acc1247b5aeab754422e9d07c61d4acfb4ae1d7fe89d0ad1ab936d',
  './vegetation-wood-stability.js': 'e45bcdeb83dba9f86d593f91e6570ac0bae02de180aa881cececa124e8ac7038',
  './vegetation-geometry.js': '59376f8a0703e92c00b274b3936c494eda7c43bed787e218ac1b7be3d25c8bd6',
  './vegetation-textures.js': '26b2c9310b67aa8075832dc9857775b3097da330ebcf16a0e6a36cfcef696474',
  './garden-vegetation-views.js': 'ffa60e3ec940294cbd19bc769d7d92b8962f0fc7930eaaeebf1c3f5db0bb9901',
});
// Exact preset values in shared Studio; exposure and environment stay fixed.
export const WILLOW_STUDIO_LIGHTS = Object.freeze({
  day: Object.freeze({ sky: '#aeb8bc', hemi: 2.3, key: '#fff0d4', power: 3.5, rim: '#bacde4', edge: 1.4 }),
  night: Object.freeze({ sky: '#142333', hemi: 1.5, key: '#bbd6ff', power: 2.2, rim: '#edc189', edge: 2 }),
});

export async function willowSha256(bytes) {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('');
}

export function willowReviewNearPlane(distance) {
  if (!(Number.isFinite(distance) && distance > 0)) throw new Error('Invalid willow viewing distance');
  // The single-tree review has no foreground architecture. Give its distant
  // leaf layers usable depth precision, while keeping the nearest crown clear.
  return Math.max(.05, Math.min(25, distance * .02));
}

export async function willowStudioIdentity(rawSources) {
  const files = []; let bundle = '';
  for (const path of Object.keys(rawSources).sort()) {
    const source = rawSources[path], sha256 = await willowSha256(source), expected = WILLOW_EXPECTED_ASSET_SOURCES[path];
    if (expected && sha256 !== expected) throw new Error(`Frozen willow source mismatch: ${path}`);
    files.push({ path, sha256, bytes: new TextEncoder().encode(source).byteLength }); bundle += path + '\0' + source + '\0';
  }
  for (const path of Object.keys(WILLOW_EXPECTED_ASSET_SOURCES)) if (!Object.hasOwn(rawSources, path)) throw new Error(`Frozen willow source missing: ${path}`);
  return { reviewRevision: WILLOW_STUDIO_REVISION, sha256: await willowSha256(bundle), frozenAssetBundleSha256: WILLOW_FROZEN_BUNDLE, files, frozenAssetCodeVerified: true, historicalReferences: WILLOW_HISTORICAL_REFERENCES, nativeReviewed: false, mainSceneAllowed: false };
}

export function willowCaptureStem(record) {
  const clean = value => String(value).replace(/[^a-z0-9_-]/gi, '-').slice(0, 30);
  return ['yuanmingyuan-willow-distance', record.sourceIdentity.sha256.slice(0, 16), record.mode, record.view, record.light, record.output, record.sampling ?? 'pixel', record.shadowEnabled === false ? 'shadow-off' : 'shadow-on', `p${Math.round((record.coverage?.phase ?? 0) * 100)}`, record.sequence, Date.parse(record.createdAt)].map(clean).join('-');
}

export async function saveWillowCapturePair({ canvas, render, metadata, upload, signal }) {
  signal?.throwIfAborted(); render();
  // Snapshot metadata immediately after the draw; image encoding and uploads
  // must not read a later camera, phase or resize state.
  const record = structuredClone(metadata()), stem = willowCaptureStem(record), names = [stem + '.png', stem + '.json'];
  record.files = { png: names[0], json: names[1] };
  const png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Native PNG encoding failed')), 'image/png'));
  signal?.throwIfAborted();
  const json = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), retainedFiles = [];
  try {
    for (const [name, blob] of [[names[0], png], [names[1], json]]) { signal?.throwIfAborted(); await upload(name, blob, signal); retainedFiles.push(name); }
  } catch (error) { error.retainedFiles = retainedFiles; throw error; }
  return { files: names, metadata: record, png, json };
}

export function advanceWillowTransition(state, wanted, now, duration = .5) {
  if (!['near', 'mid', 'far'].includes(wanted) || !Number.isFinite(now) || !(duration > 0)) throw new Error('Invalid willow transition state');
  if (!state.transition && wanted !== state.current) state.transition = { from: state.current, to: wanted, started: now };
  if (!state.transition) return { from: state.current, to: state.current, phase: 0 };
  const { from, to, started } = state.transition, phase = Math.max(0, Math.min(1, (now - started) / duration));
  if (phase === 1) { state.current = to; state.transition = null; }
  return { from, to, phase };
}
