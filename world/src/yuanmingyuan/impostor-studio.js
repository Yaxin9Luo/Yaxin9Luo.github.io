import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createPineShootImpostorSource } from './impostor-prototype.js';
import { bakeImpostorGPU } from './impostor-baker.js';
import { createImpostorStudyAsset, serializeImpostorStudy, fingerprintImpostorSource, loadImpostorStudy } from './impostor-runtime.js';
import { impostorStudioLighting } from './impostor-studio-state.js';
import './impostor-studio.css';

const $ = id => document.getElementById(id), stage = $('impostor-stage'), status = $('impostor-status');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = false;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, .005, 30); camera.name = 'impostor-study-main';
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = .18; controls.maxDistance = 6;
const source = createPineShootImpostorSource(), bounds = new THREE.Box3(new THREE.Vector3().fromArray(source.diagnostics.bounds.min), new THREE.Vector3().fromArray(source.diagnostics.bounds.max)), center = bounds.getCenter(new THREE.Vector3());
const placement = new THREE.Vector3(0, .12 - bounds.min.y, 0); source.group.position.copy(placement); scene.add(source.group); controls.target.copy(center).add(placement);
const sun = new THREE.DirectionalLight(0xffffff, 3.6), moon = new THREE.DirectionalLight('#a3bfff', .05), hemi = new THREE.HemisphereLight('#c0d9f0', '#4c593b', .6); scene.add(sun, sun.target, moon, moon.target, hemi);
sun.target.position.copy(controls.target); moon.target.position.copy(controls.target);
const buffer = renderer.getDrawingBufferSize(new THREE.Vector2()), mirrorGeometry = new THREE.PlaneGeometry(4, 4), mirror = new Reflector(mirrorGeometry, { color: 0x809ca1, textureWidth: buffer.x, textureHeight: buffer.y, clipBias: .0001, multisample: 4 }); mirror.name = 'impostor-study-water-reflector'; mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
const floorGeometry = new THREE.PlaneGeometry(20, 20), floorMaterial = new THREE.MeshStandardMaterial({ color: '#6f735e', roughness: .93 }), floor = new THREE.Mesh(floorGeometry, floorMaterial); floor.rotation.x = -Math.PI / 2; floor.position.y = -.004; scene.add(floor);
const occluderGeometry = new THREE.BoxGeometry(.025, .6, .025), occluderMaterial = new THREE.MeshStandardMaterial({ color: '#b6a480', roughness: .58 }), occluders = new THREE.Group();
for (const [x, z] of [[-.08, .12], [.08, -.12]]) { const post = new THREE.Mesh(occluderGeometry, occluderMaterial); post.position.set(x, .3, z); occluders.add(post); } occluders.visible = false; scene.add(occluders);
let asset = null, proxies = [], captureData = null, serialized = null, controller = null, busy = false, disposed = false, cleanedUp = false, lastInfo = 0, fingerprint = null, loadedManifestSHA256 = null; const errors = [];
const onError = event => errors.push({ time: performance.now(), message: event.message || String(event.reason) }); window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onError);

function lighting() { const state = impostorStudioLighting(Number($('impostor-hour').value)), direction = new THREE.Vector3().fromArray(state.direction); sun.position.copy(controls.target).addScaledVector(direction, 4); moon.position.copy(controls.target).addScaledVector(direction, -4); sun.intensity = state.sunIntensity; moon.intensity = state.moonIntensity; hemi.intensity = state.hemisphereIntensity; sun.color.fromArray(state.sunColor); scene.background = new THREE.Color().fromArray(state.background); const mins = Math.round((state.hour % 24) * 60); $('impostor-hour-label').value = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; }
function setView(name) { const d = { front: [0, .2, 1], side: [1, .2, 0], back: [0, .2, -1], below: [.45, -.12, 1] }[name] || [0, .2, 1]; camera.position.copy(controls.target).addScaledVector(new THREE.Vector3().fromArray(d).normalize(), 1.15); controls.update(); }
function applyMode() {
  const mode = $('impostor-mode').value, debug = Number($('impostor-debug').value); source.group.visible = mode === 'source';
  proxies.forEach((proxy, i) => { proxy.mesh.visible = mode === 'proxy' ? i === 0 : mode === 'pair'; proxy.mesh.position.copy(placement); proxy.mesh.rotation.set(0, 0, 0); proxy.uniforms.impDebugMode.value = debug; if (mode === 'pair') { proxy.mesh.position.x += i ? .085 : -.085; proxy.mesh.position.z += i ? -.06 : .06; proxy.mesh.rotation.y = i ? -.42 : .42; } });
}
function metadata() { return { status: busy ? 'preparing-impostor' : (asset ? 'unreviewed-impostor-ready' : 'full-source-only'), assetSource: loadedManifestSHA256 ? 'verified-study-archive' : (asset ? 'local-capture' : 'full-source-only'), mainSceneAllowed: false, nativeReviewed: false, passes: { beauty: true, depthReprojection: true, reflectionCamera: true, shadow: false, normalPrepass: false }, renderer: { threeRevision: THREE.REVISION, drawingBuffer: renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(), pixelRatio: renderer.getPixelRatio(), antialias: renderer.getContext().getContextAttributes().antialias, toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, environment: 'isolated continuous lights; no museum HDR/GTAO' }, camera: { uuid: camera.uuid, position: camera.position.toArray(), target: controls.target.toArray(), projection: camera.projectionMatrix.toArray() }, hour: Number($('impostor-hour').value), mode: $('impostor-mode').value, debug: Number($('impostor-debug').value), source: { ...source.diagnostics, fingerprint, worldMatrix: source.group.matrixWorld.toArray() }, capture: captureData?.metrics || null, manifestSHA256: serialized?.manifestSHA256 || loadedManifestSHA256, ownership: asset?.stats() || null, proxyCameras: proxies.map(p => p.observations().map(observation => ({ ...observation, role: observation.cameraUUID === camera.uuid ? 'main' : 'reflector' }))), renderInfo: { ...renderer.info.render }, errors: [...errors] }; }
function installAsset(next) { asset?.disposeAll(); asset = next; proxies = [asset.createProxy(), asset.createProxy()]; proxies.forEach(p => scene.add(p.mesh)); for (const option of $('impostor-mode').options) option.disabled = false; $('impostor-mode').value = 'proxy'; applyMode(); }
function downloads() { const container = $('impostor-downloads'); container.replaceChildren(); for (const [name, bytes] of Object.entries(serialized.files)) { const a = document.createElement('a'); let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192)); a.href = `data:${name.endsWith('.json') ? 'application/json' : 'application/octet-stream'};base64,${btoa(binary)}`; a.download = name; a.textContent = `保存 ${name} · ${(bytes.byteLength / 1024).toFixed(1)} KiB`; container.appendChild(a); } }
async function bake() {
  if (busy || disposed) return; busy = true; controller = new AbortController(); $('impostor-bake').disabled = true; $('impostor-cancel').disabled = false;
  try {
    fingerprint = await fingerprintImpostorSource(source); source.diagnostics.geometryMaterialSHA256 = fingerprint.sha256;
    const data = await bakeImpostorGPU({ renderer, source, tileSize: Number($('impostor-size').value), gridSize: 4, supersample: 2, signal: controller.signal, onProgress: p => { status.textContent = `真实几何烘焙 ${p.captured}/${p.total} · ${(p.elapsedMs / 1000).toFixed(1)} 秒`; } });
    const packed = await serializeImpostorStudy(data); if (controller.signal.aborted || disposed) return;
    installAsset(createImpostorStudyAsset(data)); captureData = data; serialized = packed; loadedManifestSHA256 = null;
    downloads(); status.textContent = `烘焙完成，待原生验收 · ${(data.metrics.outputBytes / 1048576).toFixed(2)} MiB 材质数据。`;
  } catch (error) { status.textContent = `${error.name === 'AbortError' ? '已取消' : '烘焙失败'}：${error.message}`; if (error.name !== 'AbortError') errors.push({ message: error.message, stack: error.stack }); }
  finally { busy = false; controller = null; if (disposed) finishDispose(); else { $('impostor-bake').disabled = false; $('impostor-cancel').disabled = true; resize(); } }
}
async function loadStudyArchive(manifestPath, expectedSHA, fetchImpl = fetch) {
  busy = true; controller = new AbortController(); $('impostor-bake').disabled = true; $('impostor-cancel').disabled = false; status.textContent = '正在恢复已落盘实验数据并校验 SHA…'; let next;
  try {
    const url = new URL(manifestPath, location.href); if (url.origin !== location.origin) throw new Error('This isolated study only loads same-origin archives');
    fingerprint = await fingerprintImpostorSource(source); source.diagnostics.geometryMaterialSHA256 = fingerprint.sha256;
    next = await loadImpostorStudy({ manifestURL: url.href, expectedManifestSHA256: expectedSHA, signal: controller.signal, fetchImpl });
    if (disposed || controller.signal.aborted) return;
    if (next.manifest.source?.geometryMaterialSHA256 !== fingerprint.sha256) throw new Error('Archive does not match the complete source shoot');
    installAsset(next); next = null; loadedManifestSHA256 = expectedSHA; status.textContent = '已校验并恢复实验归档；未重新烘焙，仍待原生验收。';
  } catch (error) { status.textContent = `实验归档恢复失败：${error.message}`; errors.push({ message: error.message, stack: error.stack }); }
  finally { next?.disposeAll(); busy = false; controller = null; if (disposed) finishDispose(); else { $('impostor-bake').disabled = false; $('impostor-cancel').disabled = true; resize(); } }
}
async function loadLocalFiles() {
  if (busy || disposed) return;
  const files = new Map([...$('impostor-archive-files').files].map(file => [file.name, file]));
  const expected = ['manifest.json', 'base.rgba8.bin', 'normalRoughness.rgba8.bin', 'depthMaterial.rgba8.bin', 'emission.rgba8.bin'];
  if (files.size !== 5 || expected.some(name => !files.has(name))) { status.textContent = '请选择 manifest.json 与四个 .rgba8.bin 实验文件。'; return; }
  const fetchImpl = async (url, options) => { if (options.signal?.aborted) throw new DOMException('Local study load aborted', 'AbortError'); const file = files.get(new URL(url).pathname.split('/').pop()); return file ? new Response(await file.arrayBuffer(), { status: 200 }) : new Response(null, { status: 404 }); };
  await loadStudyArchive('/impostor-local-files/manifest.json', $('impostor-archive-sha').value.trim(), fetchImpl);
}
$('impostor-bake').addEventListener('click', bake); $('impostor-cancel').addEventListener('click', () => controller?.abort()); $('impostor-hour').addEventListener('input', lighting); $('impostor-mode').addEventListener('change', applyMode); $('impostor-debug').addEventListener('change', applyMode); $('impostor-reflection').addEventListener('change', () => { mirror.visible = $('impostor-reflection').checked; }); $('impostor-occluder').addEventListener('change', () => { occluders.visible = $('impostor-occluder').checked; }); document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('impostor-archive-files').addEventListener('change', loadLocalFiles);
function resize() { if (disposed || busy) return; renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); const size = renderer.getDrawingBufferSize(new THREE.Vector2()); mirror.getRenderTarget().setSize(size.x, size.y); }
window.addEventListener('resize', resize); lighting(); setView('front');
const parameters = new URLSearchParams(location.search); if (parameters.has('manifest')) void loadStudyArchive(parameters.get('manifest'), parameters.get('sha256'));
renderer.setAnimationLoop(time => { if (disposed || busy) return; controls.update(); renderer.render(scene, camera); if (time - lastInfo > 600) { lastInfo = time; $('impostor-metadata').textContent = JSON.stringify(metadata(), null, 2); } });
function finishDispose() { if (cleanedUp) return; cleanedUp = true; controls.dispose(); asset?.disposeAll(); source.dispose(); mirror.dispose(); mirrorGeometry.dispose(); floorGeometry.dispose(); floorMaterial.dispose(); occluderGeometry.dispose(); occluderMaterial.dispose(); scene.clear(); captureData = null; serialized = null; proxies = []; $('impostor-downloads').replaceChildren(); window.removeEventListener('resize', resize); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError); renderer.dispose(); renderer.forceContextLoss(); status.textContent = '审查资源已释放。'; $('impostor-metadata').textContent = JSON.stringify({ status: 'disposed', mainSceneAllowed: false, ownership: asset?.stats() || null, sourceDisposed: true, rendererDisposed: true, capturePixelBuffersReleased: true, exportLinksRemoved: true, activeAnimationLoop: false, contextLostRequested: true }, null, 2); }
function dispose() { if (disposed) return; disposed = true; controller?.abort(); renderer.setAnimationLoop(null); if (!busy) finishDispose(); }
window.addEventListener('pagehide', dispose, { once: true });
$('impostor-dispose').addEventListener('click', dispose);
window.__IMPOSTOR_STUDY__ = { metadata, bake, setView, setHour(hour) { $('impostor-hour').value = hour; lighting(); }, setMode(mode) { if (!['source', 'proxy', 'pair'].includes(mode) || mode !== 'source' && !asset) throw new Error('Requested study mode unavailable'); $('impostor-mode').value = mode; applyMode(); }, setDebug(mode) { $('impostor-debug').value = mode; applyMode(); }, cancel: () => controller?.abort(), serialized: () => serialized, dispose };
