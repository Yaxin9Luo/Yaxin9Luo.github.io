import '../published-three-assets.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createGardenVegetationStudy } from './garden-vegetation.js';
import { buildWillowLodLevels } from './willow-lod-geometry.js';
import { createWillowLodPilot, willowLodTierForCamera } from './willow-lod-runtime.js';
import { willowLodReviewViews } from './willow-lod-study-views.js';
import { fitStudyShadow } from './shadow-framing.js';
import { createWillowDistanceRendering } from './willow-distance-rendering.js';
import { setWillowSampling, willowSamplingProgramAudit } from './willow-distance-sampling.js';
import { WILLOW_STUDIO_REVISION, WILLOW_HISTORICAL_REFERENCES, WILLOW_STUDIO_LIGHTS, willowStudioIdentity, willowSha256, saveWillowCapturePair, advanceWillowTransition, willowReviewNearPlane } from './willow-distance-studio-state.js';
import studioSource from './willow-distance-studio.js?raw';

// ?raw is deliberate: the identity covers editable original files, not Vite's
// transformed module responses. It also includes the review page itself.
const rawModules = import.meta.glob([
  './willow-lod-geometry.js', './willow-lod-runtime.js', './willow-lod-study-views.js',
  './garden-vegetation.js', './vegetation-wood-stability.js', './vegetation-geometry.js', './vegetation-textures.js', './garden-vegetation-views.js',
  './willow-distance-studio-state.js', './willow-distance-rendering.js', './willow-distance-sampling.js',
  './willow-distance-studio.css', '../../willow-distance-studio.html',
  './shadow-framing.js', '../render-quality.js', './zhengjuesi-distance-studio.css',
], { query: '?raw', import: 'default' });

const $ = id => document.getElementById(id), canvas = document.querySelector('canvas'), stage = $('distance-stage');
const query = new URLSearchParams(location.search), controller = new AbortController(), errors = [], downloadURLs = [];
const controlsIds = ['distance-mode', 'distance-view', 'distance-range', 'distance-light', 'distance-output', 'distance-sampling', 'distance-shadows', 'distance-play-blend', 'distance-approach', 'distance-pause', 'distance-save'];
const listeners = [], autoState = { current: 'near', transition: null }, timings = {};
let source, levels, pilot, sourceWrapper, scene, camera, renderer, post, controls, observer, ground, environment, key, rim, hemi, bounds, sourceIdentity, hdrIdentity;
let loading = true, disposed = false, capturing = false, pendingResize = false, frame = 0, animation = null, activeView = 'midFront', mode = 'source';
let coverage = { from: 'source', to: 'source', phase: 0 }, coverageKey = '', evaluation = null, shadowSetup = null, sequence = 0, renderSerial = 0, lastRenderMilliseconds = 0;
const status = text => { $('distance-status').textContent = text; };
function listen(target, type, handler, options) { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); }
function noteError(error, kind = 'runtime') { errors.push({ kind, message: error?.message ?? String(error), stack: error?.stack }); }
listen(window, 'error', event => noteError(event.error ?? event.message));
listen(window, 'unhandledrejection', event => noteError(event.reason));

function enableControls() {
  const disabled = loading || disposed || capturing;
  for (const id of controlsIds) $(id).disabled = disabled;
  $('distance-blend-controls').disabled = disabled || mode !== 'blend';
  $('distance-dispose').disabled = disposed;
  if (controls) controls.enabled = !disabled;
}

function updateDistanceLabel() {
  if (!camera) return;
  const distance = camera.position.distanceTo(controls.target);
  const near = willowReviewNearPlane(distance);
  if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
  $('distance-range').value = distance;
  $('distance-range-label').value = `${distance.toFixed(1)} m`;
}

function moveCamera(distance) {
  const direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(direction, distance);
  camera.lookAt(controls.target); camera.updateMatrixWorld(true); controls.update(); updateDistanceLabel();
}

function setView(value) {
  if (!camera || !Object.hasOwn(willowLodReviewViews, value)) return;
  const view = willowLodReviewViews[value]; activeView = value; $('distance-view').value = value;
  controls.target.set(0, view.targetHeight, 0);
  camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(...view.direction).normalize(), view.distance);
  camera.lookAt(controls.target); camera.updateMatrixWorld(true); controls.update(); updateDistanceLabel(); invalidate();
}

function setLight() {
  if (!key) return;
  const preset = WILLOW_STUDIO_LIGHTS[$('distance-light').value], centre = bounds.getCenter(new THREE.Vector3());
  scene.background = new THREE.Color(preset.sky); scene.environmentIntensity = .35;
  hemi.intensity = preset.hemi; key.color.set(preset.key); key.intensity = preset.power; rim.color.set(preset.rim); rim.intensity = preset.edge;
  key.target.position.copy(centre); key.position.copy(centre).add(new THREE.Vector3(-50, 80, 60));
  rim.target.position.copy(centre); rim.position.copy(centre).add(new THREE.Vector3(40, 35, -60));
  // Include ground receiving the whole tree's shadow without moving buried roots.
  const receivers = bounds.clone().expandByVector(new THREE.Vector3(10, 0, 10)); receivers.min.y = 0;
  shadowSetup = fitStudyShadow(key, receivers, receivers.clone().union(bounds));
  renderer.shadowMap.needsUpdate = true; invalidate();
}

function showCoverage(value) {
  coverage = { ...value };
  const isSource = value.from === 'source', signature = `${value.from}/${value.to}/${value.phase}`;
  sourceWrapper.visible = isSource; pilot.group.visible = !isSource;
  if (!isSource && signature !== coverageKey) pilot.setBlend(value.from, value.to, value.phase);
  if (signature !== coverageKey) renderer.shadowMap.needsUpdate = true;
  coverageKey = signature;
}

function selectRepresentation(now) {
  camera.updateMatrixWorld(true);
  evaluation = willowLodTierForCamera({ camera, worldBounds: bounds, viewportHeight: canvas.height, previous: autoState.transition?.to ?? autoState.current });
  if (mode === 'auto') showCoverage(advanceWillowTransition(autoState, evaluation.tier, now, pilot.policy.fadeSeconds));
  else if (mode === 'blend') {
    const [from, to] = $('distance-pair').value.split('-'); showCoverage({ from, to, phase: Number($('distance-phase').value) / 100 });
  } else showCoverage({ from: mode, to: mode, phase: 0 });
  $('distance-phase-label').value = `${Math.round(coverage.phase * 100)}%`;
  $('distance-caption').textContent = `${mode === 'source' ? 'R3 当前源模型' : coverage.from === coverage.to ? coverage.from : `${coverage.from} → ${coverage.to} · ${(coverage.phase * 100).toFixed(0)}%`} · ${$('distance-light').value} · R3 同机位对照，本修订未验收`;
}

function freezeFrame() {
  animation = null; if (frame) cancelAnimationFrame(frame); frame = 0;
  if (mode === 'auto') {
    if (coverage.from !== coverage.to && coverage.phase > 0 && coverage.phase < 1) {
      mode = 'blend'; $('distance-pair').value = `${coverage.from}-${coverage.to}`; $('distance-phase').value = coverage.phase * 100;
    } else mode = coverage.phase === 1 ? coverage.to : coverage.from;
    autoState.transition = null; $('distance-mode').value = mode;
  }
  enableControls();
}

function setMode(value) {
  freezeFrame(); mode = value; $('distance-mode').value = value;
  if (mode === 'auto') { autoState.current = ['near', 'mid', 'far'].includes(coverage.to) ? coverage.to : 'near'; autoState.transition = null; }
  enableControls(); invalidate();
}

function setSampling({ pause = true } = {}) {
  if (!scene || !post) return;
  if (pause) freezeFrame(); const sampling = $('distance-sampling').value, materials = new Set();
  for (const root of [source.group, pilot.group]) root.traverse(mesh => { if (mesh.isMesh && mesh.material.name === 'yuanming-leaf-lamina') materials.add(mesh.material); });
  for (const material of materials) setWillowSampling(material, sampling);
  post.setSampling(sampling); invalidate();
}

function setShadows({ pause = true } = {}) {
  if (!renderer || !scene) return;
  if (pause) freezeFrame(); const enabled = $('distance-shadows').checked;
  if (renderer.shadowMap.enabled !== enabled) {
    renderer.shadowMap.enabled = enabled; renderer.shadowMap.needsUpdate = true;
    scene.traverse(mesh => { if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.needsUpdate = true; });
  }
  invalidate();
}

function metadata() {
  return {
    asset: 'single-willow-distance-pilot', status: disposed ? 'disposed' : loading ? 'loading' : errors.length ? 'review-has-errors' : 'unreviewed', nativeAdmissionAllowed: false,
    reviewRevision: WILLOW_STUDIO_REVISION, historicalReferences: WILLOW_HISTORICAL_REFERENCES, distanceTiersNativeReviewed: false,
    createdAt: new Date().toISOString(), sequence, sourceIdentity, environmentSource: hdrIdentity, threeRevision: THREE.REVISION,
    mode, view: activeView, light: $('distance-light').value, output: $('distance-output').value, sampling: $('distance-sampling').value, shadowEnabled: $('distance-shadows').checked, coverage: { ...coverage }, evaluation,
    camera: camera ? { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: controls?.target.toArray() ?? null, fov: camera.fov, near: camera.near, far: camera.far, projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray() } : null,
    physical: renderer ? { width: canvas.width, height: canvas.height, dpr: renderer.getPixelRatio(), cssWidth: stage.clientWidth, cssHeight: stage.clientHeight, nativePixels: true } : null,
    lighting: key ? { ...WILLOW_STUDIO_LIGHTS[$('distance-light').value], exposure: renderer.toneMappingExposure, environment: scene.environmentIntensity, hemiSky: hemi.color.toArray(), hemiGround: hemi.groundColor.toArray(), keyPosition: key.position.toArray(), keyTarget: key.target.position.toArray(), rimPosition: rim.position.toArray(), shadow: shadowSetup } : null,
    bounds: bounds ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null, groundY: 0,
    counts: source ? { source: source.diagnostics.subassemblies, mid: levels?.diagnostics.mid, far: levels?.diagnostics.far } : null,
    sourceCpuReference: { historicalReferenceOnly: true, geometrySignature: '24b6f338405a950cc05ddfb40d9045aa6e12e547e60aeb2b5a2bdf3f493ca001', computedIn: 'willow-lod/production-r1.json; not recomputed by this page' },
    timings, render: renderer ? { serial: renderSerial, cpuMilliseconds: lastRenderMilliseconds, pipeline: post?.metadata(), allPassCounters: { ...renderer.info.render }, resources: { ...renderer.info.memory }, programs: renderer.info.programs?.length, samplingPrograms: disposed ? [] : willowSamplingProgramAudit(renderer), shadowDirty: renderer.shadowMap.needsUpdate } : null,
    ownership: { sourceAndLods: 'one current willow source; original botanical geometry with wood-stability shader', borrowedTextures: 'pilot -> levels -> source disposal order', environment: 'one page-owned HDR texture', sourceRearranged: false, viewWrapperOnly: true },
    limitations: ['This revision inherits no R1/R2 visual acceptance; all distance tiers, transitions and shadows remain unreviewed.', 'MSAA colour edges and the single-sample normal/depth edge require native comparison.', 'Centroid can change normal derivatives and therefore geometric roughness; compare centroid-color separately.', 'Current source and all representations retain the static botanical geometry; no wind is invented.'], errors: [...errors],
  };
}

function draw({ select = true, now = performance.now() / 1000 } = {}) {
  if (disposed || loading || document.hidden) return;
  if (select) selectRepresentation(now);
  renderer.info.reset(); const started = performance.now(); post.render(); lastRenderMilliseconds = performance.now() - started; renderSerial++;
  const info = levels.diagnostics;
  $('distance-metrics').textContent = `原柳 ${source.diagnostics.triangleCount.toLocaleString()} / 中景 ${info.mid.triangles.toLocaleString()} / 远景 ${info.far.triangles.toLocaleString()} 面。冠形约 ${evaluation?.crownPixels.toFixed(1) ?? '—'} px；画布 ${canvas.width} × ${canvas.height} 原生像素。`;
  $('distance-readout').textContent = JSON.stringify(metadata(), null, 2);
  if (errors.length) status(`记录到 ${errors.length} 项错误；本帧不能作为通过证据。详见记录，仍可保存失败截图。`);
}

function tick(time) {
  frame = 0; if (disposed || loading || capturing || document.hidden) return;
  if (animation) {
    const progress = Math.min(1, (time - animation.started) / animation.duration);
    if (animation.kind === 'blend') $('distance-phase').value = progress * 100;
    else { const smooth = progress * progress * (3 - 2 * progress); moveCamera(900 + (16 - 900) * smooth); }
    if (progress === 1) animation = null;
  }
  draw({ now: time / 1000 });
  if (animation || (mode === 'auto' && (autoState.transition || autoState.current !== evaluation.tier))) invalidate();
}

function invalidate() { if (!disposed && !loading && !capturing && !document.hidden && !frame) frame = requestAnimationFrame(tick); }
function resize() {
  if (!renderer || disposed) return;
  if (capturing) { pendingResize = true; return; }
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight), dpr = devicePixelRatio;
  if (Math.max(width * dpr, height * dpr) > renderer.capabilities.maxTextureSize) throw new Error('Native canvas exceeds this GPU render-target limit; reduce the window size before review.');
  renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); post.resize(width, height, dpr);
  camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
}

async function upload(name, blob, signal) {
  const response = await fetch(`/__review_capture/${name}`, { method: 'POST', body: blob, signal });
  if (!response.ok) throw new Error(`Capture HTTP ${response.status}: ${await response.text()}`);
}

async function save() {
  if (loading || disposed || capturing) return;
  freezeFrame(); capturing = true; sequence++; enableControls(); status('正在保存当前原生帧；镜头、过渡和尺寸已锁定。');
  try {
    const result = await saveWillowCapturePair({ canvas, render: () => draw({ select: false }), metadata, upload, signal: controller.signal });
    if (disposed) return;
    downloadURLs.splice(0).forEach(URL.revokeObjectURL); $('distance-capture-results').replaceChildren();
    for (const [index, blob] of [result.png, result.json].entries()) {
      const url = URL.createObjectURL(blob), link = document.createElement('a'); downloadURLs.push(url); link.href = url; link.download = result.files[index]; link.textContent = result.files[index]; $('distance-capture-results').append(link);
    }
    status('已保存原生 PNG 与同帧 JSON 到 work/production-v3/captures/。下方链接也可下载本次文件。');
  } catch (error) {
    if (!disposed) { noteError(error, 'capture'); status(`保存失败：${error.message}${error.retainedFiles?.length ? `；已保存文件保留：${error.retainedFiles.join(', ')}` : ''}`); }
  } finally { capturing = false; enableControls(); if (pendingResize && !disposed) { pendingResize = false; resize(); } }
}

function dispose(reason = 'review-disposed') {
  if (disposed) return; disposed = true; controller.abort(reason); animation = null; if (frame) cancelAnimationFrame(frame); frame = 0;
  observer?.disconnect(); controls?.dispose(); pilot?.dispose(); levels?.dispose(); source?.dispose(); sourceWrapper?.clear();
  ground?.geometry.dispose(); ground?.material.dispose(); environment?.dispose(); key?.shadow.map?.dispose(); key?.shadow.mapPass?.dispose();
  post?.dispose(); scene?.clear(); renderer?.dispose(); renderer?.forceContextLoss(); downloadURLs.splice(0).forEach(URL.revokeObjectURL); listeners.splice(0).forEach(remove => remove());
  document.body.dataset.ready = 'disposed'; enableControls(); status('柳树、距离几何、材质、阴影、后处理与 WebGL 资源已释放。刷新页面可重新审查。');
  $('distance-readout').textContent = JSON.stringify(metadata(), null, 2);
}

async function loadEnvironment() {
  const path = '/textures/environment/sky.hdr', response = await fetch(path, { signal: controller.signal });
  if (!response.ok) throw new Error(`Studio HDR HTTP ${response.status}`);
  const bytes = await response.arrayBuffer(); controller.signal.throwIfAborted();
  hdrIdentity = { url: path, bytes: bytes.byteLength, sha256: await willowSha256(bytes) };
  controller.signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([bytes]));
  try {
    const texture = await new HDRLoader().loadAsync(url);
    if (disposed) { texture.dispose(); controller.signal.throwIfAborted(); }
    texture.mapping = THREE.EquirectangularReflectionMapping; return texture;
  } finally { URL.revokeObjectURL(url); }
}

async function prepare() {
  try {
    const raw = Object.fromEntries(await Promise.all(Object.entries(rawModules).map(async ([path, load]) => [path, await load()])));
    // Vite intentionally omits the importing module from glob expansion.
    raw['./willow-distance-studio.js'] = studioSource;
    sourceIdentity = await willowStudioIdentity(raw); controller.signal.throwIfAborted();
    status('R3 当前源码匹配；正在构造唯一柳树。旧视觉记录仅供参考。'); await new Promise(resolve => setTimeout(resolve, 0)); controller.signal.throwIfAborted();
    let started = performance.now(); source = createGardenVegetationStudy({ specimens: ['willow'] }); timings.sourceFactoryMilliseconds = performance.now() - started;
    status('原柳已完成；正在生成中远景几何。'); await new Promise(resolve => setTimeout(resolve, 0)); controller.signal.throwIfAborted();
    started = performance.now(); const built = await buildWillowLodLevels(source);
    if (disposed) { built.dispose(); return; } levels = built; timings.levelsMilliseconds = performance.now() - started;
    started = performance.now(); pilot = createWillowLodPilot({ source, levels }); timings.pilotMilliseconds = performance.now() - started;
    bounds = pilot.bounds.clone(); scene = new THREE.Scene(); sourceWrapper = new THREE.Group(); sourceWrapper.name = 'willow-source-normalized-view-only';
    const willow = source.group.getObjectByName('garden-willow'); willow.updateWorldMatrix(true, true);
    sourceWrapper.matrix.copy(willow.matrixWorld).invert(); sourceWrapper.matrixAutoUpdate = false; sourceWrapper.add(source.group); scene.add(sourceWrapper, pilot.group);
    camera = new THREE.PerspectiveCamera(38, 1, .05, 2500);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.info.autoReset = false;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => noteError(new Error([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n')), 'shader');
    post = createWillowDistanceRendering(renderer, scene, camera, { clipBox: bounds.clone().expandByScalar(40) });
    controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.minDistance = 10; controls.maxDistance = 1200; controls.maxPolarAngle = Math.PI * .49;
    listen(controls, 'change', () => { updateDistanceLabel(); invalidate(); }); listen(controls, 'start', () => { freezeFrame(); activeView = 'orbit'; });
    ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#353b39', roughness: .96 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; scene.add(ground);
    key = new THREE.DirectionalLight(); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); rim = new THREE.DirectionalLight(); hemi = new THREE.HemisphereLight('#c8d5e8', '#5b4b3d'); scene.add(key, key.target, rim, rim.target, hemi);
    status('正在载入共享 Studio HDR；尚未完成原生审查。'); environment = await loadEnvironment(); if (disposed) { environment.dispose(); return; } scene.environment = environment;
    for (const [param, id] of [['mode', 'distance-mode'], ['view', 'distance-view'], ['light', 'distance-light'], ['output', 'distance-output'], ['sampling', 'distance-sampling'], ['pair', 'distance-pair']]) {
      const value = query.get(param); if (value && [...$(id).options].some(option => option.value === value)) $(id).value = value;
    }
    if (query.has('phase')) $('distance-phase').value = Math.max(0, Math.min(100, Number(query.get('phase')) || 0));
    if (query.get('shadows') === 'off') $('distance-shadows').checked = false;
    mode = $('distance-mode').value; post.setOutput($('distance-output').value); setSampling({ pause: false }); setShadows({ pause: false }); loading = false; document.body.dataset.ready = 'true'; enableControls();
    observer = new ResizeObserver(resize); observer.observe(stage); resize(); setView($('distance-view').value); setLight();
    if (query.has('distance')) { const distance = Number(query.get('distance')); if (Number.isFinite(distance)) moveCamera(Math.max(10, Math.min(1200, distance))); activeView += '-custom-distance'; }
    // The first button press may precede the first RAF. Establish the selected
    // geometry now so a save can never draw both uninitialized groups.
    selectRepresentation(performance.now() / 1000);
    status('R3 当前源模型与三档实例已准备。可同机位检查并保存；本修订的全部距离档尚未验收。'); invalidate();
  } catch (error) { if (!disposed) { noteError(error, 'prepare'); dispose('prepare-failed'); document.body.dataset.ready = 'failed'; status(`准备失败：${error.message}`); $('distance-readout').textContent = JSON.stringify(metadata(), null, 2); } }
}

listen($('distance-mode'), 'change', () => setMode($('distance-mode').value));
listen($('distance-view'), 'change', () => { freezeFrame(); setView($('distance-view').value); });
listen($('distance-range'), 'input', () => { freezeFrame(); activeView = 'manual-distance'; moveCamera(Number($('distance-range').value)); invalidate(); });
listen($('distance-light'), 'change', setLight);
listen($('distance-output'), 'change', () => { post.setOutput($('distance-output').value); invalidate(); });
listen($('distance-sampling'), 'change', setSampling);
listen($('distance-shadows'), 'change', setShadows);
listen($('distance-pair'), 'change', () => { animation = null; invalidate(); });
listen($('distance-phase'), 'input', () => { animation = null; invalidate(); });
for (const button of document.querySelectorAll('[data-phase]')) listen(button, 'click', () => { animation = null; $('distance-phase').value = button.dataset.phase; setMode('blend'); });
listen($('distance-play-blend'), 'click', () => { setMode('blend'); $('distance-phase').value = 0; animation = { kind: 'blend', started: performance.now(), duration: 3000 }; invalidate(); });
listen($('distance-approach'), 'click', () => {
  setMode('auto'); moveCamera(900); activeView = 'approach';
  autoState.current = willowLodTierForCamera({ camera, worldBounds: bounds, viewportHeight: canvas.height }).tier; autoState.transition = null;
  animation = { kind: 'approach', started: performance.now(), duration: 8000 }; invalidate();
});
listen($('distance-pause'), 'click', () => { freezeFrame(); draw({ select: false }); status('已暂停并保留当前机位与过渡进度。'); });
listen($('distance-save'), 'click', () => void save()); listen($('distance-dispose'), 'click', () => dispose());
listen(window, 'pagehide', () => dispose());
listen(document, 'visibilitychange', () => { if (document.hidden) freezeFrame(); else invalidate(); });
void prepare();
