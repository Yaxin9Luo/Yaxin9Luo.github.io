import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createMuseumOverviewLayer } from '../src/yuanmingyuan/museum-overview-layer.js';
import { createYuanmingyuanOverview } from '../scripts/export-yuanmingyuan-overview.mjs';
import { serializeYuanmingyuanArchive } from '../scripts/export-yuanmingyuan-assets.mjs';

const baseURL = 'https://museum.test/world/index.html', approval = 'a'.repeat(64), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const descriptor = (id, extras = {}) => ({ id, site: { position: [0,0,0], rotationY: 0, scale: 1 }, manifestURL: `/overviews/${id}/manifest.json`, approvedOverviewSHA256: approval, ...extras });
function manifest(id, extras = {}) {
  return { kind: 'yuanmingyuan-overview-archive', id, sourceArchiveDigest: 'c'.repeat(64), fullResolutionReplaced: false, nativeOverviewVisualReview: true, glb: { url: 'model.glb.gzip.bin', sha256: 'b'.repeat(64), bytes: 20 }, runtime: { url: 'runtime.json.gzip.bin', sha256: 'd'.repeat(64), bytes: 20 }, overview: { url: 'overview.json', sha256: approval, bytes: 20 }, ...extras };
}
function fetcher(entries, calls = []) {
  return async (url, { signal } = {}) => { if (signal?.aborted) throw signal.reason; calls.push(url); const entry = entries.get(url); if (entry === undefined) return new Response('', { status: 404 }); return new Response(typeof entry === 'string' || ArrayBuffer.isView(entry) ? entry : JSON.stringify(entry)); };
}
const manifests = ids => new Map(ids.map(id => [`https://museum.test/overviews/${id}/manifest.json`, manifest(id)]));
function owner(id, pixels = .1) {
  const group = new THREE.Group(); group.name = id;
  return { group, disposed: 0, evaluations: [], updates: [], evaluate(options) { this.evaluations.push(options); return { eligible: pixels <= .5, selection: pixels <= .5 ? 'overview' : 'full-required', projectedErrorPhysicalPixels: pixels, reason: pixels <= .5 ? 'certified' : 'physical-pixel-budget-exceeded' }; }, update(time) { this.updates.push(time); }, dispose() { this.disposed++; group.clear(); } };
}
function view(width = 1500, height = 1000, z = 100) { const camera = new THREE.PerspectiveCamera(50, width / height, .1, 2000); camera.position.z = z; return { camera, renderer: { getDrawingBufferSize: target => target.set(width, height), domElement: { clientWidth: 1, clientHeight: 1 } } }; }

test('unapproved, duplicate and malformed placements are rejected before mounting or fetching', () => {
  const root = new THREE.Group(); let calls = 0; const options = { root, baseURL, fetchImpl: async () => { calls++; } };
  assert.throws(() => createMuseumOverviewLayer({ ...options, descriptors: [descriptor('a', { approvedOverviewSHA256: null })] }), /approval/);
  assert.throws(() => createMuseumOverviewLayer({ ...options, descriptors: [descriptor('a'), descriptor('a')] }), /unique/);
  assert.throws(() => createMuseumOverviewLayer({ ...options, descriptors: [descriptor('a', { site: { position: [0, NaN, 0] } })] }), /placement/);
  assert.throws(() => createMuseumOverviewLayer({ ...options, descriptors: [descriptor('a', { manifestURL: 'https://other.test/model.json' })] }), /origin/);
  assert.equal(root.children.length, 0); assert.equal(calls, 0);
});

test('whole archive loading is serial and newly mounted proxies stay hidden before evaluation', async t => {
  const root = new THREE.Group(), gate = deferred(), a = owner('a'), b = owner('b'), calls = [], files = [];
  const layer = createMuseumOverviewLayer({ root, descriptors: [descriptor('a'), descriptor('b')], baseURL, fetchImpl: fetcher(manifests(['a', 'b']), files), loadOverview: async (entry, options) => { calls.push({ entry, signal: options.signal }); return entry.id === 'a' ? gate.promise : b; } }); t.after(() => layer.dispose());
  const pending = layer.load(); assert.equal(layer.load(), pending); await flush(); assert.equal(calls.length, 1); assert.equal(layer.snapshot.loaded, 0); assert.equal(layer.group.children.length, 0);
  gate.resolve(a); const state = await pending; assert.equal(calls.length, 2); assert.equal(state.loaded, 2); assert.equal(state.visible, 0); assert.equal(state.status, 'ready');
  assert.equal(calls[0].entry.glb.url, 'https://museum.test/overviews/a/model.glb.gzip.bin'); assert.equal(calls[0].entry.overview.url, 'https://museum.test/overviews/a/overview.json');
  const evaluated = layer.evaluate(view()); assert.deepEqual(evaluated.needsDetail, []); assert.equal(evaluated.visible, 2); assert.equal(a.evaluations[0].physicalWidth, 1500); assert.equal(a.evaluations[0].physicalHeight, 1000); assert.equal(a.evaluations[0].approvedOverviewSHA256, approval);
  await layer.load(); assert.equal(calls.length, 2);
});

test('a stale decoder is released before a restarted batch begins', async t => {
  const root = new THREE.Group(), gate = deferred(), stale = owner('stale'), fresh = owner('fresh'), calls = []; let count = 0;
  const layer = createMuseumOverviewLayer({ root, descriptors: [descriptor('a')], baseURL, fetchImpl: fetcher(manifests(['a'])), loadOverview: async (_entry, { signal }) => { calls.push(signal); return ++count === 1 ? gate.promise : fresh; } }); t.after(() => layer.dispose());
  const first = layer.load(); await flush(); const cancelled = layer.cancel(), second = layer.load(); await flush(); assert.equal(count, 1); assert.equal(calls[0].aborted, true);
  gate.resolve(stale); await first; await cancelled; await second; assert.equal(stale.disposed, 1); assert.equal(stale.group.parent, null); assert.equal(count, 2); assert.equal(layer.snapshot.loaded, 1); assert.equal(fresh.disposed, 0); assert.equal(layer.group.children.length, 1);
});

test('batch cancellation preserves completed owners and lifetime disposal waits for late ownership', async () => {
  const root = new THREE.Group(), unrelated = new THREE.Group(); root.add(unrelated); const gate = deferred(), a = owner('a'), b = owner('late-b'), lifetime = new AbortController(), batch = new AbortController(); let bStarted = false;
  const layer = createMuseumOverviewLayer({ root, descriptors: [descriptor('a'), descriptor('b')], baseURL, signal: lifetime.signal, fetchImpl: fetcher(manifests(['a', 'b'])), loadOverview: async entry => { if (entry.id === 'a') return a; bStarted = true; return gate.promise; } });
  const pending = layer.load({ signal: batch.signal }); while (!bStarted) await flush(); layer.evaluate(view()); batch.abort(); assert.equal(a.disposed, 0); assert.equal(layer.snapshot.loaded, 1); assert.equal(layer.snapshot.visible, 1);
  lifetime.abort(); const finished = layer.dispose(); assert.equal(a.disposed, 1); assert.equal(layer.group.parent, null); assert.deepEqual(root.children, [unrelated]);
  let settled = false; finished.then(() => { settled = true; }); await flush(); assert.equal(settled, false); gate.resolve(b); await pending; await finished; assert.equal(b.disposed, 1); assert.equal(b.group.parent, null); assert.equal(layer.snapshot.status, 'disposed'); await layer.dispose(); assert.equal(a.disposed, 1); assert.equal(b.disposed, 1);
});

test('mismatched approval or file origin fails visibly before the decoder; other sites continue', async t => {
  const entries = manifests(['a', 'b', 'c']); entries.get('https://museum.test/overviews/a/manifest.json').overview.sha256 = '0'.repeat(64); entries.get('https://museum.test/overviews/b/manifest.json').runtime.url = 'https://other.test/runtime.json'; const calls = [];
  const layer = createMuseumOverviewLayer({ root: new THREE.Group(), descriptors: ['a', 'b', 'c'].map(id => descriptor(id)), baseURL, fetchImpl: fetcher(entries), loadOverview: async entry => { calls.push(entry.id); return owner(entry.id); } }); t.after(() => layer.dispose());
  await layer.load(); const state = layer.evaluate(view()); assert.deepEqual(calls, ['c']); assert.equal(state.status, 'partial'); assert.deepEqual(state.needsDetail, ['a', 'b']); assert.equal(state.visible, 1); assert.match(state.sites[0].error, /approval/); assert.match(state.sites[1].error, /origin/);
});

test('actual mounted full site overrides proxy visibility and invalid precision never lowers the tolerance', async t => {
  const a = owner('a'), b = owner('b', .8); b.evaluate = function (options) { this.evaluations.push(options); return { eligible: true, selection: 'overview', projectedErrorPhysicalPixels: .8 }; };
  const layer = createMuseumOverviewLayer({ root: new THREE.Group(), descriptors: [descriptor('a'), descriptor('b')], baseURL, fetchImpl: fetcher(manifests(['a', 'b'])), loadOverview: async entry => entry.id === 'a' ? a : b }); t.after(() => layer.dispose()); await layer.load();
  let state = layer.evaluate(view()); assert.deepEqual(state.needsDetail, ['b']); assert.equal(state.visible, 1); layer.setFullSite('a'); assert.equal(layer.snapshot.visible, 0); assert.equal(layer.snapshot.sites[0].precision, 'full'); assert.equal(a.group.visible, true);
  state = layer.evaluate({ ...view(), fullSiteId: 'b' }); assert.equal(state.visible, 1); assert.deepEqual(state.needsDetail, []); assert.equal(state.sites[1].precision, 'full');
  state = layer.evaluate({ ...view(), fullSiteId: null, pixelBudget: .75 }); assert.equal(state.visible, 0); assert.deepEqual(state.needsDetail, ['a', 'b']); assert.match(state.viewError, /0.5/);
  const evaluateA = a.evaluate; a.evaluate = () => ({ eligible: true, selection: 'overview', projectedErrorPhysicalPixels: -1 });
  state = layer.evaluate(view()); assert.equal(state.visible, 0); assert.deepEqual(state.needsDetail, ['a', 'b']); a.evaluate = evaluateA;
  state = layer.evaluate(view(3000, 2000)); assert.equal(a.evaluations.at(-1).physicalWidth, 3000); assert.equal(a.evaluations.at(-1).physicalHeight, 2000);
  state = layer.evaluate(view(0, 0)); assert.equal(state.visible, 0); assert.deepEqual(state.needsDetail, ['a', 'b']); layer.update(2.75); assert.deepEqual(a.updates, [2.75]); assert.deepEqual(b.updates, [2.75]);
});

test('configuration errors, retry, and pre-aborted lifetimes retain clear ownership', async () => {
  const a = owner('failed'), fresh = owner('fresh'); let fail = true, calls = 0;
  const layer = createMuseumOverviewLayer({ root: new THREE.Group(), descriptors: [descriptor('a')], baseURL, fetchImpl: fetcher(manifests(['a'])), loadOverview: async () => ++calls === 1 ? a : fresh, configure: () => { if (fail) throw new Error('configured surface missing'); } });
  await layer.load(); assert.equal(a.disposed, 1); assert.deepEqual(layer.snapshot.needsDetail, ['a']); assert.equal(layer.group.children.length, 0); fail = false; await layer.load(); assert.equal(layer.snapshot.loaded, 1); await layer.dispose(); assert.equal(fresh.disposed, 1);
  const signal = new AbortController(); signal.abort(); const root = new THREE.Group(), stopped = createMuseumOverviewLayer({ root, descriptors: [descriptor('a')], baseURL, signal: signal.signal, fetchImpl: async () => { throw new Error('must not fetch'); } }); assert.equal((await stopped.load()).status, 'disposed'); assert.equal(root.children.length, 0);
});

test('invalid decoder output and failed animation never leave a visible or leaked owner', async t => {
  const a = owner('a'); let calls = 0;
  const layer = createMuseumOverviewLayer({ root: new THREE.Group(), descriptors: [descriptor('a')], baseURL, fetchImpl: fetcher(manifests(['a'])), loadOverview: async () => ++calls === 1 ? undefined : a }); t.after(() => layer.dispose());
  await layer.load(); assert.deepEqual(layer.snapshot.needsDetail, ['a']); assert.deepEqual(layer.snapshot.disposalErrors, []); assert.equal(layer.snapshot.loaded, 0);
  await layer.load(); assert.equal(layer.evaluate(view()).visible, 1); a.update = () => { throw new Error('lost animation state'); }; layer.update(3);
  assert.equal(layer.snapshot.visible, 0); assert.equal(layer.snapshot.loaded, 0); assert.deepEqual(layer.snapshot.needsDetail, ['a']); assert.match(layer.snapshot.sites[0].error, /lost animation state/); assert.equal(a.disposed, 1); assert.equal(a.group.parent, null);
  await layer.dispose(); assert.equal(a.disposed, 1);
});

test('real tiny overview reader preserves placement, data pixels and independent disposal', async t => {
  const sourceRoot = new THREE.Group(); sourceRoot.position.set(2, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2, 2, 2), texture = new THREE.DataTexture(new Uint8Array([23,91,207,0, 67,149,3,255, 199,31,113,127, 241,59,181,255]), 2, 2); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material); mesh.name = 'real-small-stone'; mesh.castShadow = mesh.receiveShadow = true; sourceRoot.add(mesh); sourceRoot.updateMatrixWorld(true);
  const source = { group: sourceRoot, diagnostics: {}, dispose() { geometry.dispose(); texture.dispose(); material.dispose(); sourceRoot.clear(); } }; t.after(source.dispose);
  const overview = await createYuanmingyuanOverview(source, { id: 'archive-fixture', sourceArchiveDigest: 'e'.repeat(64), maximumErrorWorld: .02 }); t.after(overview.dispose);
  // A deliberately conservative test upper bound exercises distance gating;
  // it exceeds the tiny fixture's measured error, rather than understating it.
  overview.report.maximumErrorArchiveWorld = .025;
  const archive = await serializeYuanmingyuanArchive(overview, { id: 'archive-fixture' }), report = Buffer.from(JSON.stringify(overview.report)), url = 'https://museum.test/shared/manifest.json';
  const metadata = manifest('archive-fixture', { sourceArchiveDigest: overview.report.sourceArchiveDigest, glb: { url: 'model.glb', sha256: sha(archive.glb), bytes: archive.glb.length }, runtime: { url: 'runtime.json', sha256: sha(archive.runtime), bytes: archive.runtime.length }, overview: { url: 'overview.json', sha256: sha(report), bytes: report.length } });
  const entries = new Map([[url, metadata], ['https://museum.test/shared/model.glb', archive.glb], ['https://museum.test/shared/runtime.json', archive.runtime], ['https://museum.test/shared/overview.json', report]]), calls = [];
  const root = new THREE.Group(), untouched = new THREE.Group(); root.add(untouched);
  const site = { position: [10, 0, 0], rotationY: Math.PI / 2, scale: 2 }, options = { assetId: 'archive-fixture', site, manifestURL: url, approvedOverviewSHA256: sha(report) };
  const layer = createMuseumOverviewLayer({ root, descriptors: [descriptor('logical-site', options), descriptor('other-site', { ...options, site: { position: [-10, 0, 0], rotationY: 0, scale: 1 } })], baseURL, fetchImpl: fetcher(entries, calls) }); t.after(() => layer.dispose()); await layer.load();
  let state = layer.evaluate(view(1500, 1000, 400)); assert.equal(state.visible, 2); assert.deepEqual(state.needsDetail, []);
  const [first, second] = layer.group.children.map(wrapper => wrapper.getObjectByName('real-small-stone')); assert.notEqual(first.geometry, second.geometry); assert.notEqual(first.material.map, second.material.map); assert.deepEqual(first.material.map.image.data, texture.image.data); assert.equal(first.material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(first.castShadow, true); assert.equal(first.receiveShadow, true);
  const position = new THREE.Vector3(); first.getWorldPosition(position); assert.ok(position.distanceTo(new THREE.Vector3(12, 0, -4)) < 1e-10);
  state = layer.evaluate(view(3000, 2000, 100)); assert.ok(state.needsDetail.includes('logical-site')); assert.equal(state.sites[0].visible, false); assert.ok(state.sites[0].projection.projectedErrorPhysicalPixels > .5);
  state = layer.evaluate({ ...view(3000, 2000, 100), fullSiteId: 'logical-site' }); assert.equal(state.sites[0].precision, 'full'); assert.ok(!state.needsDetail.includes('logical-site'));
  let disposedGeometry = 0, disposedMaterial = 0, disposedTexture = 0;
  for (const object of [first, second]) { object.geometry.addEventListener('dispose', () => disposedGeometry++); object.material.addEventListener('dispose', () => disposedMaterial++); object.material.map.addEventListener('dispose', () => disposedTexture++); }
  await layer.dispose(); await layer.dispose(); assert.equal(disposedGeometry, 2); assert.equal(disposedMaterial, 2); assert.equal(disposedTexture, 2); assert.deepEqual(root.children, [untouched]); assert.equal(calls.filter(call => call.endsWith('/model.glb')).length, 2); assert.deepEqual(layer.snapshot.disposalErrors, []);
});
