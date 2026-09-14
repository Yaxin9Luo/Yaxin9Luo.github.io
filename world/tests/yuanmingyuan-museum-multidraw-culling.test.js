import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { attachMuseumMultiDrawCulling } from '../src/yuanmingyuan/museum-multidraw-culling.js';
import { prepareGardenReflectionViews } from '../src/yuanmingyuan/garden-reflection-views.js';
import { createMuseumMultiDrawBatch } from '../src/yuanmingyuan/museum-multidraw-batch.js';

const options = { leafSize: 8, viewCacheSize: 3, yieldControl: async () => {} };
const renderer = {}, scene = new T.Scene();
function fixture({ side = 12, indexed = true } = {}) {
  const shapes = [new T.BoxGeometry(1, 2, 1), new T.SphereGeometry(.7, 8, 6), new T.CylinderGeometry(.3, .6, 1.4, 6)];
  if (!indexed) for (let i = 0; i < shapes.length; i++) { const g = shapes[i]; shapes[i] = g.toNonIndexed(); g.dispose(); }
  const map = new T.DataTexture(new Uint8Array([83, 140, 99, 255]), 1, 1); map.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({ map, roughness: .78, side: T.DoubleSide });
  const count = side * side, batch = new T.BatchedMesh(count + 4, shapes.reduce((n, g) => n + g.attributes.position.count, 0) + 2000, shapes.reduce((n, g) => n + (g.index?.count ?? 0), 0) + 6000, material), group = new T.Group();
  batch.name = 'actual-three-mixed-shapes'; batch.sortObjects = false; batch.perObjectFrustumCulled = true; batch.castShadow = batch.receiveShadow = true; group.add(batch);
  const geometries = shapes.map(g => batch.addGeometry(g, g.attributes.position.count + 100, indexed ? g.index.count + 300 : -1));
  for (let i = 0; i < count; i++) {
    const id = batch.addInstance(geometries[i % shapes.length]), matrix = new T.Matrix4().compose(new T.Vector3((i % side - side / 2) * 6, (i % 3) * 2, (Math.floor(i / side) - side / 2) * 6), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), i * .071), new T.Vector3(.6 + i % 4 * .13, .8 + i % 3 * .19, 1.1));
    batch.setMatrixAt(id, matrix); batch.setColorAt(id, new T.Color(.4 + i % 5 * .07, .51, .72));
    if (i % 17 === 5) batch.setVisibleAt(id, false);
  }
  group.position.set(11, 2, -17); group.rotation.y = .21; group.scale.set(1.1, .9, 1.2); group.updateMatrixWorld(true);
  let disposed = false;
  return { group, batch, shapes, geometries, material, map, dispose() { if (disposed) return; disposed = true; batch.dispose(); for (const g of shapes) g.dispose(); map.dispose(); material.dispose(); group.clear(); } };
}
function camera(x = 0, z = 45) { const c = new T.PerspectiveCamera(42, 1.4, .1, 130); c.position.set(x, 16, z); c.lookAt(x, 3, z - 35); c.updateMatrixWorld(true); return c; }
function draws(b) { const n = b._multiDrawCount; return { count: n, ids: [...b._indirectTexture.image.data.slice(0, n)], starts: [...b._multiDrawStarts.slice(0, n)], counts: [...b._multiDrawCounts.slice(0, n)] }; }
function reference(b, c, m = b.material) { T.BatchedMesh.prototype.onBeforeRender.call(b, renderer, scene, c, b.geometry, m); return draws(b); }
function compare(b, c, m = b.material, shadow = false) {
  const expected = reference(b, c, m);
  if (shadow) b.onBeforeShadow(renderer, null, camera(), c, b.geometry, m); else b.onBeforeRender(renderer, scene, c, b.geometry, m);
  assert.deepEqual(draws(b), expected); return expected;
}
const digest = b => { const h = createHash('sha256'); for (const a of [...Object.values(b.geometry.attributes), b.geometry.index].filter(Boolean)) h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)); for (const t of [b._matricesTexture, b._colorsTexture]) h.update(new Uint8Array(t.image.data.buffer)); return h.digest('hex'); };

for (const indexed of [true, false]) test(`moving main/orthographic/shadow views preserve exact stock draw sequence (${indexed ? 'indexed' : 'nonindexed'})`, async () => {
  const f = fixture({ indexed }), before = digest(f.batch), helper = await attachMuseumMultiDrawCulling(f.group, options), depth = new T.MeshDepthMaterial();
  try {
    const views = [];
    for (let i = 0; i < 36; i++) { const c = camera(-55 + i * 3, 58 - i * .6); if (i % 4 === 0) c.setViewOffset(2000, 1400, 120, 80, 1500, 1050); views.push(c); }
    const ortho = new T.OrthographicCamera(-17, 17, 24, -24, .1, 180); ortho.position.set(35, 55, 20); ortho.lookAt(15, 0, -10); ortho.updateMatrixWorld(true); views.push(ortho);
    for (const c of views) { compare(f.batch, c); compare(f.batch, c, depth, true); }
    f.group.rotation.y += .13; f.group.position.x += 17; f.group.updateMatrixWorld(true); compare(f.batch, views[0]);
    assert.equal(digest(f.batch), before); assert.equal(f.batch.material, f.material); assert.equal(f.material.map, f.map); assert.equal(f.batch.perObjectFrustumCulled, true);
    const s = helper.snapshot().batches[0]; assert.equal(s.fallbackCalls, 0); assert.equal(s.invalidations, 0); assert.ok(s.nodesRejected > 0); assert.ok(s.nodesAccepted > 0);
  } finally { helper.dispose(); depth.dispose(); f.dispose(); }
});

test('actual garden Reflector oblique cameras at every water height preserve exact culling', async () => {
  const f = fixture(), helper = await attachMuseumMultiDrawCulling(f.group, options), plane = new T.PlaneGeometry(200, 200), sheets = [];
  try {
    for (const height of [0, 2, 3.7]) { const sheet = new Reflector(plane, { textureWidth: 8, textureHeight: 8, clipBias: .0002 }); sheet.rotation.x = -Math.PI / 2; sheet.position.y = height + .006; sheet.updateMatrixWorld(true); sheets.push(sheet); }
    for (let i = 0; i < 12; i++) {
      const c = camera(-32 + i * 5, 55 - i * 2);
      const views = prepareGardenReflectionViews(sheets, c);
      assert.equal(views.length, 3);
      for (const { camera: reflected } of views) { assert.notEqual(reflected.projectionMatrix.elements[6], 0); compare(f.batch, reflected); }
    }
    assert.equal(helper.snapshot().batches[0].fallbackCalls, 0);
  } finally { helper.dispose(); for (const sheet of sheets) sheet.dispose(); plane.dispose(); f.dispose(); }
});

test('orthographic sphere tangency, near/far boundaries and huge translated roots match stock', async () => {
  const f = fixture({ side: 1 }); f.batch.setVisibleAt(0, true); f.group.position.set(0, 0, 0); f.group.rotation.set(0, 0, 0); f.group.scale.set(1, 1, 1); f.batch.setMatrixAt(0, new T.Matrix4()); f.group.updateMatrixWorld(true);
  const sphere = f.batch.getBoundingSphereAt(f.geometries[0], new T.Sphere()), r = sphere.radius;
  let helper;
  try {
    for (const delta of [-1e-10, 0, 1e-10]) for (const point of [[5 + r + delta, 0, -10], [0, 0, -1 + r + delta], [0, 0, -20 - r + delta]]) {
      f.batch.setMatrixAt(0, new T.Matrix4().makeTranslation(...point)); helper = await attachMuseumMultiDrawCulling(f.group, { ...options, leafSize: 1 });
      const c = new T.OrthographicCamera(-5, 5, 5, -5, 1, 20); c.updateMatrixWorld(true); compare(f.batch, c); helper.dispose();
    }
    helper = await attachMuseumMultiDrawCulling(f.group, { ...options, leafSize: 1 });
    for (const worldX of [0, 1e8, -1e10]) { f.group.position.x = worldX; f.group.updateMatrixWorld(true); const c = camera(worldX); compare(f.batch, c); }
    for (const reversed of [false, true]) { const c = camera(); c.coordinateSystem = T.WebGPUCoordinateSystem; c._reversedDepth = reversed; c.updateProjectionMatrix(); compare(f.batch, c); }
  } finally { helper?.dispose(); f.dispose(); }
});

test('finite cache restores A→B→A, never keeps another view in the single indirect buffer', async () => {
  const f = fixture(), helper = await attachMuseumMultiDrawCulling(f.group, { ...options, viewCacheSize: 2 }), a = camera(-25), b = camera(35);
  try {
    const expectedA = reference(f.batch, a), expectedB = reference(f.batch, b); assert.notDeepEqual(expectedA.ids, expectedB.ids);
    for (const [c, expected] of [[a, expectedA], [b, expectedB], [a, expectedA]]) { f.batch.onBeforeRender(renderer, scene, c, f.batch.geometry, f.material); assert.deepEqual(draws(f.batch), expected); }
    const version = f.batch._indirectTexture.version; f.batch.onBeforeRender(renderer, scene, a, f.batch.geometry, f.material); assert.equal(f.batch._indirectTexture.version, version);
    a.fov = 26; a.updateProjectionMatrix(); compare(f.batch, a);
    assert.equal(helper.snapshot().batches[0].cachedViews, 2); assert.ok(helper.snapshot().batches[0].cacheHits >= 2);
  } finally { helper.dispose(); f.dispose(); }
});

test('continuous camera motion avoids per-instance transforms without depending on cache hits', async t => {
  const f = fixture({ side: 40 }), helper = await attachMuseumMultiDrawCulling(f.group, { ...options, viewCacheSize: 0 });
  try {
    let visible = 0;
    for (let i = 0; i < 48; i++) { const c = camera(-70 + i * 2, 80 - i * .9); c.fov = 24; c.far = 95; c.updateProjectionMatrix(); visible += compare(f.batch, c).count; }
    const s = helper.snapshot().batches[0], originalSphereTransforms = s.staticVisibleInstances * 48;
    assert.equal(s.cacheHits, 0); assert.equal(s.hierarchyQueries, 48); assert.equal(s.sphereTransforms, s.staticVisibleInstances);
    assert.ok(s.sphereTests < originalSphereTransforms * .35, JSON.stringify(s)); assert.equal(s.emittedInstances, visible); assert.equal(s.fallbackCalls, 0);
    t.diagnostic(JSON.stringify({ movingViews: 48, originalSphereTransforms, preparedSphereTransforms: s.sphereTransforms, exactLeafSphereTests: s.sphereTests, nodesTested: s.nodesTested, instancesEmitted: s.emittedInstances, helperCpuMs: s.queryMilliseconds, typedArrayBytes: s.typedArrayBytes, gpuRendered: false }));
  } finally { helper.dispose(); f.dispose(); }
});

test('different views containing the entire batch reuse the identical draw list without GPU upload', async () => {
  const f = fixture({ side: 4 }), helper = await attachMuseumMultiDrawCulling(f.group, { ...options, viewCacheSize: 0 });
  try {
    let expected;
    for (let i = 0; i < 24; i++) {
      const c = new T.PerspectiveCamera(75, 1.4, .1, 1000); c.position.set(i - 12, 65, 200); c.lookAt(0, 0, 0); c.updateMatrixWorld(true);
      expected ??= reference(f.batch, c); f.batch.onBeforeRender(renderer, scene, c, f.batch.geometry, f.material); assert.deepEqual(draws(f.batch), expected);
    }
    const s = helper.snapshot().batches[0]; assert.equal(s.cacheHits, 0); assert.equal(s.sphereTests, 0); assert.equal(s.nodesAccepted, 24); assert.equal(s.indirectUploads, 1); assert.equal(s.unchangedDrawLists, 23);
  } finally { helper.dispose(); f.dispose(); }
});

for (const [name, mutate] of [
  ['matrix', f => f.batch.setMatrixAt(0, new T.Matrix4().makeTranslation(0, 3, 10))],
  ['visibility', f => f.batch.setVisibleAt(0, false)],
  ['geometry id', f => f.batch.setGeometryIdAt(0, f.geometries[1])],
  ['delete instance', f => f.batch.deleteInstance(0)],
  ['add instance', f => f.batch.addInstance(f.geometries[1])],
  ['replace geometry', f => { const g = f.shapes[0].clone().scale(.2, 1, .7); try { f.batch.setGeometryAt(f.geometries[0], g); } finally { g.dispose(); } }],
  ['optimize', f => f.batch.optimize()],
  ['delete geometry', f => f.batch.deleteGeometry(f.geometries[1])],
  ['instance capacity', f => f.batch.setInstanceCount(f.batch.maxInstanceCount + 8)],
]) test(`${name} mutation suspends static acceleration and safely invokes stock`, async () => {
  const f = fixture(), helper = await attachMuseumMultiDrawCulling(f.group, options);
  try { compare(f.batch, camera()); mutate(f); compare(f.batch, camera()); const s = helper.snapshot().batches[0]; assert.ok(s.suspended?.startsWith('public-mutation:')); assert.equal(s.fallbackCalls, 1); assert.equal(s.typedArrayBytes, 0); }
  finally { helper.dispose(); f.dispose(); }
});

test('versioned raw matrix buffer and explicit private edits invalidate, colors alone stay live', async () => {
  const f = fixture(); let helper = await attachMuseumMultiDrawCulling(f.group, options);
  try {
    compare(f.batch, camera()); f.batch.setColorAt(2, new T.Color(.1, .2, .3)); compare(f.batch, camera()); assert.equal(helper.snapshot().batches[0].invalidations, 0);
    f.batch._matricesTexture.image.data[12] += 60; f.batch._matricesTexture.needsUpdate = true; compare(f.batch, camera()); assert.equal(helper.snapshot().batches[0].suspended, 'tracked-buffer-or-layout-changed');
    helper.dispose(); helper = await attachMuseumMultiDrawCulling(f.group, options); f.batch._instanceInfo[2].visible = false; helper.invalidate('private-edit'); compare(f.batch, camera()); assert.equal(helper.snapshot().batches[0].suspended, 'private-edit');
  } finally { helper.dispose(); f.dispose(); }
});

test('wireframe, sorting, ArrayCamera and disabled culling preserve exact stock fallback semantics', async () => {
  const f = fixture(), helper = await attachMuseumMultiDrawCulling(f.group, options);
  try {
    f.material.wireframe = true; compare(f.batch, camera()); f.material.wireframe = false;
    f.batch.sortObjects = true; compare(f.batch, camera()); f.batch.sortObjects = false;
    const c = new T.ArrayCamera([camera(-20), camera(20)]); compare(f.batch, c);
    f.batch.perObjectFrustumCulled = false; compare(f.batch, camera()); f.batch.perObjectFrustumCulled = true; compare(f.batch, camera());
    assert.equal(helper.snapshot().batches[0].fallbackCalls, 4); assert.equal(helper.snapshot().batches[0].suspended, null);
  } finally { helper.dispose(); f.dispose(); }
});

test('stock failures propagate once and are not hidden or retried by optimizer fallback', async () => {
  const f = fixture(), helper = await attachMuseumMultiDrawCulling(f.group, options); let calls = 0;
  try {
    f.batch.sortObjects = true; f.batch.customSort = () => { calls++; throw new Error('expected-stock-failure'); };
    assert.throws(() => f.batch.onBeforeRender(renderer, scene, camera(), f.batch.geometry, f.material), /expected-stock-failure/); assert.equal(calls, 1);
    f.batch.customSort = null;
  } finally { helper.dispose(); f.dispose(); }
});

test('dispose and abort restore methods, free helper arrays and leave source resources owned by source', async () => {
  const f = fixture(), original = f.batch.onBeforeRender, matrixMethod = f.batch.setMatrixAt, resources = [f.batch.geometry, f.material, f.map, f.batch._matricesTexture], released = new Set();
  for (const r of resources) r.addEventListener('dispose', () => released.add(r));
  let helper = await attachMuseumMultiDrawCulling(f.group, options);
  try {
    compare(f.batch, camera()); helper.dispose(); helper.dispose(); assert.equal(f.batch.onBeforeRender, original); assert.equal(f.batch.setMatrixAt, matrixMethod); assert.equal(released.size, 0); assert.equal(helper.snapshot().batches[0].typedArrayBytes, 0);
    const controller = new AbortController(); helper = await attachMuseumMultiDrawCulling(f.group, { ...options, signal: controller.signal }); controller.abort(); assert.equal(f.batch.onBeforeRender, original); assert.equal(helper.snapshot().disposed, true); assert.equal(released.size, 0);
    const during = new AbortController(); await assert.rejects(attachMuseumMultiDrawCulling(f.group, { ...options, signal: during.signal, yieldControl: async () => during.abort() }), { name: 'AbortError' }); assert.equal(f.batch.onBeforeRender, original);
    helper = await attachMuseumMultiDrawCulling(f.group, options); f.batch.geometry.dispose(); assert.equal(f.batch.onBeforeRender, original); assert.equal(helper.snapshot().batches[0].disposed, true);
  } finally { helper.dispose(); f.dispose(); }
});

test('unsupported custom batches remain untouched, and cleanup preserves a later callback replacement', async () => {
  const f = fixture(), original = f.batch.onBeforeRender; f.batch.onBeforeRender = () => {};
  let helper = await attachMuseumMultiDrawCulling(f.group, options);
  try {
    assert.equal(helper.snapshot().appliedBatches, 0); assert.match(helper.snapshot().skipped[0].reason, /Custom BatchedMesh/); helper.dispose();
    f.batch.onBeforeRender = original; helper = await attachMuseumMultiDrawCulling(f.group, options); const replacement = () => {}; f.batch.onBeforeRender = replacement; helper.dispose(); assert.equal(f.batch.onBeforeRender, replacement);
  } finally { helper.dispose(); f.dispose(); }
});

test('frozen adapter integration preserves source owners and owner-first cleanup detaches helper', async () => {
  const sourceGroup = new T.Group(), box = new T.BoxGeometry(), cone = new T.ConeGeometry(.7, 2, 8), material = new T.MeshStandardMaterial();
  for (let i = 0; i < 6; i++) { const m = new T.Mesh(i % 2 ? cone : box, material); m.position.set(i * 3 - 9, 0, -5); m.castShadow = true; sourceGroup.add(m); }
  let sourceDisposals = 0;
  const source = { group: sourceGroup, dispose() { sourceDisposals++; box.dispose(); cone.dispose(); material.dispose(); sourceGroup.clear(); } };
  const owner = await createMuseumMultiDrawBatch(source, { id: 'haiyue', renderer: { extensions: { has: () => true }, capabilities: { maxTextureSize: 4096 } }, yieldControl: async () => {} });
  let helper;
  try {
    assert.notEqual(owner, source); helper = await attachMuseumMultiDrawCulling(owner.group, options); assert.equal(helper.snapshot().appliedBatches, 1);
    const batch = owner.group.children[0].children[0]; compare(batch, camera()); assert.equal(owner.collisionGroup, sourceGroup); assert.equal(owner.namedGroupRoot, sourceGroup);
    owner.dispose(); assert.equal(sourceDisposals, 1); assert.equal(helper.snapshot().batches[0].disposed, true); assert.equal(helper.snapshot().batches[0].typedArrayBytes, 0);
  } finally { helper?.dispose(); owner.dispose(); }
  assert.equal(sourceDisposals, 1);
});
