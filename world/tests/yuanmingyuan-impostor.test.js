import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import * as THREE from 'three';
import { encodeOctahedral, decodeOctahedral, selectImpostorFrames, createImpostorFrames, packDepth16, unpackDepth16, srgbToLinear, linearToSrgb, validateImpostorData, sampleImpostorData, traceImpostorRay, intersectImpostorBounds, IMPOSTOR_MAPS } from '../src/yuanmingyuan/impostor-format.js';
import { createPineShootImpostorSource } from '../src/yuanmingyuan/impostor-prototype.js';
import { createImpostorManifest, bakeImpostorCPUFixture, bakeImpostorGPU, downsampleImpostorCapture, patchImpostorCaptureShader, assertImpostorCaptureMaterial } from '../src/yuanmingyuan/impostor-baker.js';
import { createImpostorStudyAsset, serializeImpostorStudy, loadImpostorStudy, fingerprintImpostorSource } from '../src/yuanmingyuan/impostor-runtime.js';
import { impostorCameraState, patchImpostorShader } from '../src/yuanmingyuan/impostor-material.js';
import { impostorStudioLighting } from '../src/yuanmingyuan/impostor-studio-state.js';

const close = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const bounds = { min: [-1, -1, -1], max: [1, 1, 1] };
function tinyData() {
  const layout = createImpostorFrames(bounds, 3), tileSize = 4;
  const maps = Object.fromEntries(IMPOSTOR_MAPS.map(k => [k, new Uint8Array(tileSize ** 2 * 9 * 4)]));
  for (let i = 0; i < maps.base.length; i += 4) { maps.base.set([32, 96, 24, 255], i); maps.normalRoughness.set([128, 255, 128, 196], i); maps.depthMaterial.set([...packDepth16(.5), 0, 255], i); maps.emission.set([5, 8, 4, 255], i); }
  return { manifest: createImpostorManifest({ id: 'fixture', layout, tileSize, source: { triangles: 12 }, method: 'synthetic material unit fixture' }), maps };
}

test('full-sphere octahedral directions include reflected viewpoints below the object', () => {
  const directions = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (let i = 1; i < 60; i++) directions.push([Math.sin(i * 2.1), Math.cos(i * 1.7), Math.sin(i * .37)]);
  for (const direction of directions) {
    const unit = new THREE.Vector3().fromArray(direction).normalize();
    close(unit.distanceTo(new THREE.Vector3().fromArray(decodeOctahedral(encodeOctahedral(direction)))), 0);
    const frames = selectImpostorFrames(direction, 4); close(frames.reduce((s, f) => s + f.weight, 0), 1); assert.ok(frames.every(f => f.index >= 0 && f.index < 16 && f.weight >= 0));
  }
  assert.throws(() => selectImpostorFrames([0, 1, 0], 8), /2–4/);
});

test('capture frames are orthonormal and source bounds have a capture margin', () => {
  const layout = createImpostorFrames(bounds, 4);
  for (const frame of layout.frames) { const n = new THREE.Vector3().fromArray(frame.direction), r = new THREE.Vector3().fromArray(frame.right), u = new THREE.Vector3().fromArray(frame.up); close(n.length(), 1); close(r.dot(u), 0); close(r.clone().cross(u).dot(n), 1); }
  assert.ok(layout.radius > Math.sqrt(3));
});

test('packed depth error is bounded and the frozen pine emission survives sRGB bytes', () => {
  for (const d of [0, .0001, .137, .5, .99999, 1]) close(unpackDepth16(...packDepth16(d)), d, .5 / 65535 + 1e-10);
  const emission = new THREE.Color('#263724').multiplyScalar(.045);
  for (const value of emission.toArray()) { const byte = Math.round(linearToSrgb(value) * 255); assert.ok(byte > 0); close(srgbToLinear(byte / 255), value, .0002); }
});

test('shading-normal maps cannot silently become the reconstruction geometry normal', () => {
  const texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ normalMap: texture });
  try { assert.throws(() => assertImpostorCaptureMaterial(material), /geometric normals/); }
  finally { material.dispose(); texture.dispose(); }
});

test('source stays the complete original seed-218 geometry with exact material settings', async () => {
  const source = createPineShootImpostorSource(); let geometryDisposals = 0;
  try { source.geometry.addEventListener('dispose', () => geometryDisposals++); assert.equal(source.diagnostics.triangles, 4160); assert.equal(source.diagnostics.wholeTreeConstructed, false); assert.equal(source.material.roughness, .77); assert.equal(source.material.emissiveIntensity, .045); assert.equal(source.material.side, THREE.DoubleSide); assert.ok(source.geometry.attributes.color); const fingerprint = await fingerprintImpostorSource(source); assert.match(fingerprint.sha256, /^[0-9a-f]{64}$/); assert.equal(fingerprint.records[0].attributes.position.count, source.geometry.attributes.position.count); assert.equal(geometryDisposals, 0); }
  finally { source.dispose(); source.dispose(); }
  assert.equal(geometryDisposals, 1);
});

function planeSampler(layout, planes) {
  return (frameIndex, uv) => {
    if (uv.some(v => v < 0 || v > 1)) return null;
    const frame = layout.frames[frameIndex], N = new THREE.Vector3().fromArray(frame.direction), R = new THREE.Vector3().fromArray(frame.right), U = new THREE.Vector3().fromArray(frame.up), C = new THREE.Vector3().fromArray(layout.center);
    const origin = C.clone().addScaledVector(N, 2 * layout.radius).addScaledVector(R, (uv[0] - .5) * 2 * layout.radius).addScaledVector(U, (uv[1] - .5) * 2 * layout.radius), D = N.clone().negate();
    let hit = null;
    for (const plane of planes) {
      if (Math.abs(D.z) < 1e-10) continue; const t = (plane.z - origin.z) / D.z; if (t < 0) continue;
      const P = origin.clone().addScaledVector(D, t); if (Math.abs(P.x) > .9 || Math.abs(P.y) > .9 || plane.hole?.(P)) continue;
      if (!hit || t < hit.t) hit = { t, position: P, plane };
    }
    if (!hit) return null;
    return { coverage: 1, depth: .5 - hit.position.clone().sub(C).dot(N) / (2 * layout.radius), albedo: hit.plane.color, normal: [0, 0, D.z < 0 ? 1 : -1], roughness: .77, metalness: .12, ao: .93, emission: [.001, .002, .001] };
  };
}

test('ray reprojection preserves a geometric hole and resolves the rear surface through it', () => {
  const layout = createImpostorFrames(bounds, 3), front = { z: .4, color: [1, 0, 0], hole: p => Math.abs(p.x) < .18 && Math.abs(p.y) < .18 }, back = { z: -.4, color: [0, 0, 1] };
  const trace = (origin, planes) => traceImpostorRay({ layout, tileSize: 128, origin, direction: [0, 0, -1], sample: planeSampler(layout, planes) });
  assert.equal(trace([0, 0, 3], [front]), null);
  const through = trace([0, 0, 3], [front, back]); close(through.position[2], -.4); assert.deepEqual(through.albedo, [0, 0, 1]);
  const solid = trace([.4, 0, 3], [front, back]); close(solid.position[2], .4); assert.deepEqual(solid.albedo, [1, 0, 0]); close(solid.roughness, .77); close(solid.metalness, .12); close(solid.emission[1], .002);
  assert.ok(solid.t < through.t); assert.equal(intersectImpostorBounds([3, 0, 0], [0, 1, 0], bounds), null);
});

test('sparse occupied texel between all three old depth guesses is recovered without filling empty cells', () => {
  const layout = createImpostorFrames(bounds, 4), tileSize = 128, point = new THREE.Vector3(0, 0, .31), selection = selectImpostorFrames([0, 0, 1], 4).find(f => f.weight > 0), frame = layout.frames[selection.index], N = new THREE.Vector3().fromArray(frame.direction), R = new THREE.Vector3().fromArray(frame.right), U = new THREE.Vector3().fromArray(frame.up);
  const project = p => [p.dot(R) / (2 * layout.radius) + .5, p.dot(U) / (2 * layout.radius) + .5], cell = project(point).map(u => Math.floor(u * tileSize));
  for (const z of [0, 1, -1]) assert.notDeepEqual(project(new THREE.Vector3(0, 0, z)).map(u => Math.floor(u * tileSize)), cell);
  const material = { depth: .5 - point.dot(N) / (2 * layout.radius), normal: N.toArray(), albedo: [.1, .4, .05], emission: [.001, .002, .001], roughness: .77, metalness: 0, ao: 1 };
  const trace = coverage => traceImpostorRay({ layout, tileSize, origin: [0, 0, 3], direction: [0, 0, -1], sample: (index, uv) => index === frame.index && uv.every((u, i) => Math.floor(u * tileSize) === cell[i]) ? { ...material, coverage } : null });
  const opaque = trace(1); assert.ok(opaque); close(opaque.position[2], .31); close(opaque.coverage, 1);
  const partial = trace(.25); assert.ok(partial); close(partial.coverage, .25); assert.equal(trace(0), null);
});

test('the captured real normal keeps an opaque plane continuous across depth texels', () => {
  const layout = createImpostorFrames(bounds, 4), plane = { z: .2, color: [.4, .4, .4] }, sample = planeSampler(layout, [plane]);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const hit = traceImpostorRay({ layout, tileSize: 32, origin: [(x / 23 - .5) * 1.2, (y / 23 - .5) * 1.2, 3], direction: [0, 0, -1], sample });
    assert.ok(hit, `Unexpected gap at ${x},${y}`); close(hit.position[2], .2); close(hit.coverage, 1);
  }
});

test('main and reflected cameras select independent frames under a nonuniform site transform', () => {
  const mesh = new THREE.Mesh(); mesh.position.set(3, 2, -1); mesh.rotation.y = .4; mesh.scale.set(2, 1, .8);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 100); camera.position.set(4, 8, 6); camera.lookAt(3, 2, -1);
  const reflection = camera.clone(); reflection.position.y = -camera.position.y; reflection.lookAt(3, 2, -1); reflection.projectionMatrix.elements[10] = -.93;
  const layout = createImpostorFrames(bounds, 4), main = impostorCameraState(mesh, camera, layout), water = impostorCameraState(mesh, reflection, layout);
  assert.notDeepEqual(main.frames, water.frames); close(water.projection.elements[10], -.93); assert.notEqual(main.cameraUUID, water.cameraUUID);
  close(main.localCamera.clone().applyMatrix4(main.world).distanceTo(camera.position), 0);
  const normal = new THREE.Vector3(1, 1, 0).normalize().applyNormalMatrix(main.worldNormal), tangent = new THREE.Vector3(1, -1, 0).transformDirection(main.world); close(normal.dot(tangent), 0);
});

test('supersampling retains clear holes, fractional coverage, normal and material without dark fringe', () => {
  const input = Object.fromEntries(IMPOSTOR_MAPS.map(k => [k, new Uint8Array(4 * 4 * 4)]));
  input.base.set([180, 90, 40, 255], 0); input.normalRoughness.set([128, 255, 128, 196], 0); input.depthMaterial.set([...packDepth16(.2), 20, 255], 0); input.emission.set([7, 9, 6, 255], 0);
  const output = downsampleImpostorCapture(input, 2, 2);
  assert.deepEqual([...output.base.slice(0, 3)], [180, 90, 40]); assert.equal(output.base[3], 64); assert.equal(output.base[7], 0); assert.equal(output.normalRoughness[3], 196); close(unpackDepth16(output.depthMaterial[0], output.depthMaterial[1]), .2, 1 / 65535); assert.equal(output.emission[0], 7);
});

test('tiny CPU capture samples the real shoot, with real surface normals and clear background', () => {
  const source = createPineShootImpostorSource();
  try {
    source.group.visible = false; source.group.position.set(10, 20, 30);
    const data = bakeImpostorCPUFixture({ source, tileSize: 16, gridSize: 3 }); validateImpostorData(data);
    assert.equal(data.metrics.rays, 2304); assert.ok(data.metrics.hits > 0 && data.metrics.hits < 2304);
    const normals = new Set(), colors = new Set(); let emission = 0;
    for (let i = 0; i < data.maps.base.length; i += 4) if (data.maps.base[i + 3]) { normals.add(data.maps.normalRoughness.slice(i, i + 3).join(',')); colors.add(data.maps.base.slice(i, i + 3).join(',')); emission += data.maps.emission[i]; }
    assert.ok(normals.size > 5); assert.ok(colors.size > 5); assert.ok(emission > 0); assert.equal(source.group.children.length, 1); assert.equal(source.material.name, 'yuanming-leaf-lamina'); assert.equal(source.group.visible, false); assert.deepEqual(source.group.position.toArray(), [10, 20, 30]); assert.deepEqual(data.manifest.bounds, source.diagnostics.bounds);
    // Independent triangle intersections validate the recovered positions at
    // captured views; this does not certify between-view disocclusion.
    const layout = createImpostorFrames(data.manifest.bounds, 3), original = new THREE.Mesh(source.geometry, source.material), raycaster = new THREE.Raycaster(); let checked = 0;
    for (const frame of layout.frames) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const uv = [(x + .5) / 16, (y + .5) / 16], pixel = sampleImpostorData(data, frame.index, uv); if (!pixel.coverage) continue;
      const N = new THREE.Vector3().fromArray(frame.direction), origin = new THREE.Vector3().fromArray(layout.center).addScaledVector(N, layout.radius * 1.05).addScaledVector(new THREE.Vector3().fromArray(frame.right), (uv[0] - .5) * 2 * layout.radius).addScaledVector(new THREE.Vector3().fromArray(frame.up), (uv[1] - .5) * 2 * layout.radius), D = N.clone().negate();
      raycaster.set(origin, D); const hit = raycaster.intersectObject(original)[0]; assert.ok(hit);
      const reconstructed = traceImpostorRay({ layout, tileSize: 16, origin: origin.toArray(), direction: D.toArray(), sample: (index, coord) => sampleImpostorData(data, index, coord) }); assert.ok(reconstructed);
      close(new THREE.Vector3().fromArray(reconstructed.position).distanceTo(hit.point), 0, layout.radius * 2 / 65535); checked++;
    }
    assert.equal(checked, data.metrics.hits);
  } finally { source.dispose(); }
});

test('day/night rig remains continuous at horizon and midnight without rebaking material pixels', () => {
  const noon = impostorStudioLighting(12), midnight = impostorStudioLighting(0);
  assert.ok(noon.sunIntensity > 3); assert.equal(midnight.sunIntensity, 0); assert.ok(midnight.moonIntensity > 0);
  for (const time of [0, 6, 18, 24]) { const left = impostorStudioLighting(time - .00001), right = impostorStudioLighting(time + .00001); for (const key of ['sunIntensity', 'moonIntensity', 'hemisphereIntensity']) close(left[key], right[key], .0001); }
});

test('shader uses reconstructed depth and shading position, standard lighting, and real material channels', () => {
  const original = THREE.ShaderLib.standard;
  const shader = patchImpostorShader({ vertexShader: original.vertexShader, fragmentShader: original.fragmentShader, uniforms: {} }, {});
  assert.match(shader.fragmentShader, /gl_FragDepth = impDepth/); assert.match(shader.fragmentShader, /#define vViewPosition impShadingViewPosition/); assert.match(shader.fragmentShader, /#include <lights_fragment_begin>/); assert.match(shader.fragmentShader, /impProjection \* impView/); assert.match(shader.fragmentShader, /totalEmissiveRadiance = impHit.emission/); assert.doesNotMatch(shader.fragmentShader, /#include <normal_fragment_maps>/);
  const capture = patchImpostorCaptureShader({ vertexShader: original.vertexShader, fragmentShader: original.fragmentShader, uniforms: {} }, {});
  assert.match(capture.fragmentShader, /location = 3/); assert.match(capture.fragmentShader, /inverseTransformDirection\(normal, viewMatrix\)/); assert.match(capture.fragmentShader, /impEncode\(totalEmissiveRadiance\)/); assert.doesNotMatch(capture.fragmentShader, /#include <tonemapping_fragment>/);
});

test('a source owner and two proxy leases release their own resources exactly once', () => {
  const data = tinyData(), originalByte = data.maps.base[0], asset = createImpostorStudyAsset(data), a = asset.createProxy(), b = asset.createProxy(); let materialDisposals = 0, geometryDisposals = 0, textureDisposals = 0;
  a.material.addEventListener('dispose', () => materialDisposals++); b.material.addEventListener('dispose', () => materialDisposals++); a.mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const key of ['impBase', 'impNormalRoughness', 'impDepthMaterial', 'impEmission']) a.uniforms[key].value.addEventListener('dispose', () => textureDisposals++);
  data.maps.base[0] = originalByte + 1; assert.equal(a.uniforms.impBase.value.image.data[0], originalByte);
  asset.dispose(); assert.equal(asset.stats().references, 2); assert.equal(asset.stats().textures, 4); assert.throws(() => asset.createProxy(), /disposed/);
  a.dispose(); a.dispose(); assert.equal(asset.stats().resourcesDisposed, false); b.dispose(); asset.dispose(); assert.equal(asset.stats().resourcesDisposed, true); assert.equal(asset.stats().pixelBytes, 0); assert.equal(materialDisposals, 2); assert.equal(textureDisposals, 4); assert.equal(geometryDisposals, 1);
});

test('unreviewed studies reject world integration and carrier override passes', () => {
  const asset = createImpostorStudyAsset(tinyData()), proxy = asset.createProxy();
  try { assert.throws(() => asset.assertMainSceneAllowed(), /no native approval/); assert.equal(proxy.mesh.castShadow, false); assert.equal(proxy.mesh.receiveShadow, false); assert.equal(proxy.mesh.userData.impostorPasses.normalPrepass, false); assert.throws(() => proxy.mesh.onBeforeRender({}, { overrideMaterial: new THREE.MeshNormalMaterial() }, new THREE.PerspectiveCamera()), /override/); }
  finally { asset.disposeAll(); }
});

test('four map pixels survive serialized SHA-checked transport without quantizing again', async () => {
  const data = tinyData(), serialized = await serializeImpostorStudy(data), calls = [];
  const fetchImpl = async url => { const filename = new URL(url).pathname.split('/').pop(); calls.push(filename); const body = serialized.files[filename]; return { ok: true, url: String(url), arrayBuffer: async () => body.slice().buffer }; };
  const asset = await loadImpostorStudy({ manifestURL: 'https://fixture.invalid/study/manifest.json', expectedManifestSHA256: serialized.manifestSHA256, fetchImpl }), proxy = asset.createProxy();
  try { assert.deepEqual(calls, ['manifest.json', ...IMPOSTOR_MAPS.map(k => `${k}.rgba8.bin`)]); assert.deepEqual(proxy.uniforms.impBase.value.image.data, data.maps.base); assert.deepEqual(proxy.uniforms.impEmission.value.image.data, data.maps.emission); }
  finally { asset.disposeAll(); }
});

test('transport tampering and cancellation are errors, never silent full/placeholder fallback', async () => {
  const serialized = await serializeImpostorStudy(tinyData());
  const fetchImpl = async url => { const name = new URL(url).pathname.split('/').pop(), body = serialized.files[name].slice(); if (name === 'normalRoughness.rgba8.bin') body[4] ^= 1; return { ok: true, url: String(url), arrayBuffer: async () => body.buffer }; };
  await assert.rejects(loadImpostorStudy({ manifestURL: 'https://fixture.invalid/manifest.json', expectedManifestSHA256: serialized.manifestSHA256, fetchImpl }), /byte\/hash mismatch/);
  const controller = new AbortController(); let count = 0;
  await assert.rejects(loadImpostorStudy({ manifestURL: 'https://fixture.invalid/manifest.json', expectedManifestSHA256: serialized.manifestSHA256, signal: controller.signal, fetchImpl: async url => { count++; const name = new URL(url).pathname.split('/').pop(); if (name === 'emission.rgba8.bin') controller.abort(); return { ok: true, url: String(url), arrayBuffer: async () => serialized.files[name].slice().buffer }; } }), /abort/i);
  assert.equal(count, 5);
});

test('real loopback HTTP restores the serialized manifest and all four binary maps', async () => {
  const data = tinyData(), serialized = await serializeImpostorStudy(data), requests = [];
  const server = createServer((request, response) => { const name = new URL(request.url, 'http://fixture.invalid').pathname.slice(1), bytes = serialized.files[name]; requests.push(name); response.setHeader('Connection', 'close'); if (!bytes) { response.writeHead(404); response.end(); return; } response.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'application/octet-stream'); response.setHeader('Content-Length', bytes.byteLength); response.end(bytes); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let asset;
  try {
    const manifestURL = `http://127.0.0.1:${server.address().port}/manifest.json`;
    asset = await loadImpostorStudy({ manifestURL, expectedManifestSHA256: serialized.manifestSHA256 });
    const proxy = asset.createProxy(); assert.deepEqual(proxy.uniforms.impNormalRoughness.value.image.data, data.maps.normalRoughness); assert.deepEqual(proxy.uniforms.impDepthMaterial.value.image.data, data.maps.depthMaterial); assert.equal(requests.length, 5);
  } finally { asset?.disposeAll(); await new Promise(resolve => server.close(resolve)); }
});

test('failed GPU draw restores renderer state and disposes targets without touching source geometry', async () => {
  const source = createPineShootImpostorSource(), originalTarget = { original: true }; let targetDisposals = 0, geometryDisposals = 0, materialDisposals = 0;
  source.geometry.addEventListener('dispose', () => geometryDisposals++); source.material.addEventListener('dispose', () => materialDisposals++);
  const renderer = { isWebGLRenderer: true, capabilities: {}, shadowMap: { enabled: true }, xr: { enabled: true }, autoClear: false, toneMapping: THREE.ACESFilmicToneMapping, target: originalTarget, getContext: () => ({ MAX_DRAW_BUFFERS: 1, MAX_COLOR_ATTACHMENTS: 2, getParameter: () => 4 }), getRenderTarget() { return this.target; }, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0, getClearColor: c => c.set('#654321'), getClearAlpha: () => .7, getViewport: v => v.set(1, 2, 80, 90), getScissor: v => v.set(3, 4, 50, 60), getScissorTest: () => true, setRenderTarget(t) { this.target = t; if (t.isWebGLRenderTarget) t.addEventListener('dispose', () => targetDisposals++); }, setViewport(v) { this.viewport = v.toArray(); }, setScissor(v) { this.scissor = v.toArray(); }, setScissorTest(v) { this.scissorTest = v; }, setClearColor(c, a) { this.clearColor = c; this.alpha = a; }, clear() {}, render() { throw new Error('fixture GPU draw failure'); } };
  try { await assert.rejects(bakeImpostorGPU({ renderer, source, tileSize: 4, gridSize: 3 }), /fixture GPU draw failure/); assert.equal(renderer.target, originalTarget); assert.deepEqual(renderer.viewport, [1, 2, 80, 90]); assert.equal(renderer.alpha, .7); assert.equal(renderer.autoClear, false); assert.equal(renderer.shadowMap.enabled, true); assert.equal(renderer.xr.enabled, true); assert.equal(targetDisposals, 1); assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0); assert.equal(source.group.children[0].material, source.material); }
  finally { source.dispose(); }
});

test('sampling rejects incomplete maps and reports material pixels in linear working space', () => {
  const data = tinyData(), sampled = sampleImpostorData(data, 0, [.5, .5]); close(sampled.albedo[1], srgbToLinear(96 / 255)); close(sampled.roughness, 196 / 255); assert.ok(sampled.emission.every(v => v > 0)); data.maps.emission = new Uint8Array(3); assert.throws(() => validateImpostorData(data), /Incomplete/);
});
