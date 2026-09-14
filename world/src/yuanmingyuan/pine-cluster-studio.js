import '../published-three-assets.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createPineClusterSource } from './pine-cluster-source.js';
import { pineClusterSha256, loadPineClusterBake } from './pine-cluster-io.js';
import { createPineClusterPilot } from './pine-cluster-pilot.js';
import { createPineClusterRendering } from './pine-cluster-rendering.js';
import { PINE_CLUSTER_VIEWS, PINE_CLUSTER_LIGHTS, pineClusterStudioIdentity, savePineClusterCapture } from './pine-cluster-studio-state.js';
import { fitStudyShadow } from './shadow-framing.js';
import { willowSamplingProgramAudit } from './willow-distance-sampling.js';
import studioSource from './pine-cluster-studio.js?raw';

const rawModules = import.meta.glob(['./pine-cluster*.js', './pine-shoot-lod-materials.js', './pine-shoot-lod-rendering.js', './garden-vegetation.js', './vegetation-geometry.js', './willow-distance-sampling.js', './shadow-framing.js', '../../pine-cluster-studio.html'], { query: '?raw', import: 'default' });
const $ = id => document.getElementById(id), canvas = document.querySelector('canvas'), stage = $('pine-stage'), query = new URLSearchParams(location.search);
const lifetime = new AbortController(), errors = [], listeners = [], urls = [], timings = {};
let source, pilot, scene, camera, renderer, post, controls, observer, ground, water, key, rim, hemi, environment, bounds, sourceIdentity, hdrIdentity, textureIdentity, shadowSetup;
let disposed = false, loading = true, capturing = false, pendingResize = false, frame = 0, sequence = 0, renderSerial = 0, activeView = 'front', animation = null, reflection = null, drawMilliseconds = 0;
const status = text => { $('pine-status').textContent = text; };
function listen(target, event, handler, options) { target.addEventListener(event, handler, options); listeners.push(() => target.removeEventListener(event, handler, options)); }
function note(error, kind = 'runtime') { errors.push({ kind, message: error?.message ?? String(error), stack: error?.stack }); }
listen(window, 'error', event => note(event.error ?? event.message)); listen(window, 'unhandledrejection', event => note(event.reason));
function enable() {
  document.querySelectorAll('.controls button,.controls select,.controls input').forEach(node => { node.disabled = loading || disposed || capturing; });
  $('pine-dispose').disabled = disposed; if (controls) controls.enabled = !loading && !disposed && !capturing;
}
function pause() { animation = null; if (frame) cancelAnimationFrame(frame); frame = 0; }
function rangeLabel() {
  if (!camera || !controls) return;
  const distance = camera.position.distanceTo(controls.target); $('pine-distance-label').value = distance.toFixed(2);
  $('pine-distance').value = distance; camera.near = Math.max(.001, Math.min(.15, distance * .005)); camera.updateProjectionMatrix();
}
function moveDistance(value) {
  const distance = Math.max(2, Math.min(200, Number(value))), direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(direction, distance); camera.lookAt(controls.target); camera.updateMatrixWorld(true); rangeLabel();
}
function setView(value) {
  if (!PINE_CLUSTER_VIEWS[value]) return;
  activeView = value; $('pine-view').value = value; const distance = Number($('pine-distance').value);
  controls.target.copy(bounds.getCenter(new THREE.Vector3())); camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(...PINE_CLUSTER_VIEWS[value].direction).normalize(), distance);
  camera.lookAt(controls.target); camera.updateMatrixWorld(true); controls.update(); rangeLabel();
}
function lighting() {
  const preset = PINE_CLUSTER_LIGHTS[$('pine-light').value], centre = bounds.getCenter(new THREE.Vector3());
  scene.background = new THREE.Color(preset.background); scene.environmentIntensity = .35; renderer.toneMappingExposure = 1.1;
  hemi.intensity = preset.hemi; key.color.set(preset.key); key.intensity = preset.intensity; rim.color.set(preset.rim); rim.intensity = preset.rimIntensity;
  key.target.position.copy(centre); key.position.copy(centre).add(new THREE.Vector3(-.5, .8, .6));
  rim.target.position.copy(centre); rim.position.copy(centre).add(new THREE.Vector3(.4, .35, -.6));
  const receiver = new THREE.Box3(new THREE.Vector3(centre.x - 1.25, ground.position.y, centre.z - .85), new THREE.Vector3(centre.x + 1.25, ground.position.y + .005, centre.z + .85));
  shadowSetup = fitStudyShadow(key, receiver, receiver.clone().union(bounds));
  renderer.shadowMap.needsUpdate = true;
}
function applyDisplay() {
  pilot.setMode($('pine-mode').value, Number($('pine-phase').value) / 100);
  $('pine-phase-label').value = $('pine-phase').value + '%'; water.visible = $('pine-water').checked;
  ground.visible = activeView !== 'underside';
  post.setOutput($('pine-output').value); renderer.shadowMap.needsUpdate = true;
  $('pine-caption').textContent = `${pilot.state.mode} · ${activeView} · ${$('pine-light').value} · ${canvas.width}×${canvas.height} 原生像素 · 待审查`;
}
function metadata() {
  return {
    asset: 'actual-pine-secondary-branch-cluster-pilot', status: disposed ? 'disposed' : loading ? 'loading' : errors.length ? 'review-has-errors' : 'unreviewed', nativeReviewed: false, mainSceneAllowed: false,
    createdAt: new Date().toISOString(), sequence, sourceIdentity, hdrIdentity, textureIdentity, threeRevision: THREE.REVISION,
    state: pilot?.state ?? null, view: activeView, light: $('pine-light').value, output: $('pine-output').value, water: !!water?.visible, ground: !!ground?.visible, shadowEnabled: renderer?.shadowMap.enabled ?? false, sampling: 'centroid',
    camera: camera ? { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: controls.target.toArray(), fov: camera.fov, near: camera.near, far: camera.far, projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray() } : null,
    physical: renderer ? { width: canvas.width, height: canvas.height, cssWidth: stage.clientWidth, cssHeight: stage.clientHeight, dpr: renderer.getPixelRatio(), nativePixels: true } : null,
    lighting: key ? { ...PINE_CLUSTER_LIGHTS[$('pine-light').value], exposure: renderer.toneMappingExposure, environmentIntensity: scene.environmentIntensity, keyPosition: key.position.toArray(), keyTarget: key.target.position.toArray(), rimPosition: rim.position.toArray(), shadow: shadowSetup } : null,
    bounds: bounds ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null, source: source?.diagnostics, candidate: pilot?.diagnostics, reflection,
    render: renderer ? { serial: renderSerial, cpuMilliseconds: drawMilliseconds, pipeline: post?.metadata(), allPassCounters: { ...renderer.info.render }, resources: { ...renderer.info.memory }, samplingPrograms: disposed ? [] : willowSamplingProgramAudit(renderer) } : null,
    timings, ownership: '28 source shoots in actual transforms + 8 source branches; one independent candidate; owned revision-specific premultiplied half-float fields; candidate disposed before source; no full tree constructed', errors: structuredClone(errors),
  };
}
function draw() {
  if (disposed || loading) return;
  camera.updateMatrixWorld(true); applyDisplay(); reflection = { attempts: 0, captured: false, physical: [2048, 2048] };
  renderer.info.reset(); const started = performance.now(); post.render(); drawMilliseconds = performance.now() - started; renderSerial++;
  const representation = pilot.diagnostics.revision === 'r3' ? `R3 六个首交点视场 / 每 pass 提交 ${pilot.diagnostics.submittedTrianglesPerPass.toLocaleString()} 面 / 确定性 PBR24` : '42 张折面 / 两层深度';
  $('pine-metrics').textContent = `源 ${source.diagnostics.triangles.toLocaleString()} 面 / 候选存储 ${pilot.diagnostics.totalTriangles.toLocaleString()} 面\n28 个真实 shoot · 7 个末级枝簇 · 8 段完整支撑木枝\n源 5 draw / 候选 2 draw（每 pass）\n${representation}\n${(pilot.diagnostics.textureBytesWithMipsUpperBound / 1048576).toFixed(2)} MiB 含 mip 字段\n${canvas.width}×${canvas.height} · DPR ${renderer.getPixelRatio()}\n仅单簇试点，尚无 GPU 性能或美术准入`;
  $('pine-readout').textContent = JSON.stringify(metadata(), null, 2);
  if (errors.length) status(`记录到 ${errors.length} 项错误，保留失败证据；本帧不能作为通过。`);
}
function tick(now) {
  frame = 0; if (disposed || loading || capturing || document.hidden) return;
  if (animation?.kind === 'blend') {
    const amount = Math.min(1, (now - animation.started) / 4000); $('pine-phase').value = amount * 100; if (amount === 1) animation = null;
  } else if (animation?.kind === 'orbit') {
    const delta = (now - animation.started) / 1000 * .26, radius = animation.radius;
    camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(animation.angle + delta) * radius, animation.height, Math.cos(animation.angle + delta) * radius)); camera.lookAt(controls.target); activeView = 'orbit'; rangeLabel();
  }
  draw(); if (animation) invalidate();
}
function invalidate() { if (!disposed && !loading && !capturing && !document.hidden && !frame) frame = requestAnimationFrame(tick); }
function resize() {
  if (!renderer || disposed) return; if (capturing) { pendingResize = true; return; }
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight), dpr = devicePixelRatio;
  if (Math.max(width * dpr, height * dpr) > renderer.capabilities.maxTextureSize) throw new Error('Native canvas exceeds the render-target limit; resize the review window');
  renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); post.resize(width, height, dpr); camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
}
async function save() {
  if (disposed || loading || capturing) return null;
  pause(); capturing = true; sequence++; enable(); status('锁定当前机位，保存原生画布与同帧记录…');
  try {
    const result = await savePineClusterCapture({ canvas, render: draw, metadata, signal: lifetime.signal, upload: async (filename, blob, signal) => { const response = await fetch('/__review_capture/' + filename, { method: 'POST', body: blob, signal }); if (!response.ok) throw new Error('Capture HTTP ' + response.status + ': ' + await response.text()); } });
    urls.splice(0).forEach(URL.revokeObjectURL); $('pine-files').replaceChildren();
    for (const [kind, blob] of [['png', result.png], ['json', result.json]]) { const href = URL.createObjectURL(blob), link = document.createElement('a'); urls.push(href); link.href = href; link.download = result.record.files[kind]; link.textContent = result.record.files[kind]; $('pine-files').append(link); }
    status('PNG 与 JSON 已保存到 work/production-v3/captures/；仍待审查。'); return result.record.files;
  } catch (error) { if (!disposed) { note(error, 'capture'); status('保存失败：' + error.message + (error.retainedFiles?.length ? '；已有文件保留：' + error.retainedFiles.join(', ') : '')); } throw error; }
  finally { capturing = false; enable(); if (pendingResize && !disposed) { pendingResize = false; resize(); } }
}
function dispose(reason = 'review-disposed') {
  if (disposed) return; disposed = true; lifetime.abort(reason); pause(); observer?.disconnect(); listeners.splice(0).forEach(remove => remove()); controls?.dispose();
  pilot?.dispose(); source?.dispose(); ground?.geometry.dispose(); ground?.material.dispose(); water?.geometry.dispose(); water?.dispose(); environment?.dispose(); key?.shadow.map?.dispose(); key?.shadow.mapPass?.dispose();
  post?.dispose(); scene?.clear(); renderer?.dispose(); renderer?.forceContextLoss(); urls.splice(0).forEach(URL.revokeObjectURL);
  document.body.dataset.ready = 'disposed'; enable(); status('枝梢、候选、纹理、阴影、水镜与 WebGL 资源已释放。'); $('pine-readout').textContent = JSON.stringify(metadata(), null, 2);
}
async function loadHDR() {
  const response = await fetch('/textures/environment/sky.hdr', { signal: lifetime.signal }); if (!response.ok) throw new Error('HDR HTTP ' + response.status);
  const bytes = await response.arrayBuffer(); hdrIdentity = { path: '/textures/environment/sky.hdr', bytes: bytes.byteLength, sha256: await pineClusterSha256(bytes) }; lifetime.signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([bytes]));
  try { const texture = await new HDRLoader().loadAsync(url); if (disposed) { texture.dispose(); lifetime.signal.throwIfAborted(); } texture.mapping = THREE.EquirectangularReflectionMapping; return texture; }
  finally { URL.revokeObjectURL(url); }
}
async function prepare() {
  try {
    const raw = Object.fromEntries(await Promise.all(Object.entries(rawModules).map(async ([path, loader]) => [path, await loader()]))); raw['./pine-cluster-studio.js'] = studioSource;
    sourceIdentity = await pineClusterStudioIdentity(raw); lifetime.signal.throwIfAborted(); status('构造实际记录中的 28 个 shoot 与 8 段木枝；不构造整树…');
    const started = performance.now(); source = createPineClusterSource(); timings.sourceMilliseconds = performance.now() - started;
    const requested = query.get('candidate'), revision = requested === 'r1' ? 'r1' : requested === 'r3' ? 'r3' : 'r2';
    let renderingFactory = createPineClusterRendering;
    if (revision === 'r3') {
      const { loadPineClusterR3Bake } = await import('./pine-cluster-r3-io.js');
      const { createPineClusterR3Pilot } = await import('./pine-cluster-r3-pilot.js');
      const { createPineClusterR3Rendering } = await import('./pine-cluster-r3-rendering.js');
      pilot = createPineClusterR3Pilot(source, { signal: lifetime.signal, baked: await loadPineClusterR3Bake({ signal: lifetime.signal }) });
      renderingFactory = createPineClusterR3Rendering;
    } else {
      const baked = await loadPineClusterBake({ baseURL: `/assets/pine-cluster-${revision}/`, signal: lifetime.signal });
      pilot = await createPineClusterPilot(source, { signal: lifetime.signal, baked });
    }
    textureIdentity = { files: pilot.baked.identity, revision, format: revision === 'r3' ? 'RGBA16F six signed visibility/depth views and joint premultiplied colour/normal bins (36 layers each)' : pilot.baked.normalBins ? 'RGBA16F base/coverage and normal moment (42 layers each), plus six normal bins (252 layers)' : 'two RGBA16F 2D arrays, 42 layers, linear premultiplied fields', dimensions: [pilot.baked.width, pilot.baked.height, pilot.baked.layers], normalDistributionLayers: revision === 'r3' ? 36 : pilot.baked.normalBins ? pilot.baked.layers * 6 : 0 }; lifetime.signal.throwIfAborted();
    timings.candidateMilliseconds = performance.now() - started - timings.sourceMilliseconds;
    scene = new THREE.Scene(); scene.add(source.group, pilot.group); bounds = source.bounds.clone().union(new THREE.Box3().setFromObject(pilot.group));
    camera = new THREE.PerspectiveCamera(38, 1, .005, 1000);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.info.autoReset = false;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => note(new Error([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n')), 'shader');
    controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.minDistance = 2; controls.maxDistance = 200;
    listen(controls, 'change', () => { rangeLabel(); invalidate(); }); listen(controls, 'start', () => { pause(); activeView = 'orbit'; });
    ground = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.7), new THREE.MeshStandardMaterial({ color: '#535c59', roughness: .94 })); ground.rotation.x = -Math.PI / 2; ground.position.copy(bounds.getCenter(new THREE.Vector3())); ground.position.y = bounds.min.y - .10; ground.receiveShadow = true; scene.add(ground);
    water = new Reflector(new THREE.PlaneGeometry(16, 16), { textureWidth: 2048, textureHeight: 2048, multisample: 4, clipBias: .0002, color: 0xb8d2ca }); water.rotation.x = -Math.PI / 2; water.position.copy(ground.position); water.position.y -= .035; water.isWater = true; water.visible = false; water.name = 'pine-cluster-real-planar-water';
    const reflect = water.onBeforeRender;
    water.onBeforeRender = function(renderer, scene, view, ...rest) {
      const surface = new THREE.Vector3().setFromMatrixPosition(this.matrixWorld), eye = new THREE.Vector3().setFromMatrixPosition(view.matrixWorld), normal = new THREE.Vector3(0, 0, 1).transformDirection(this.matrixWorld), backFacing = surface.clone().sub(eye).dot(normal) > 0 && this.forceUpdate === false;
      if (reflection) reflection.attempts++;
      reflect.call(this, renderer, scene, view, ...rest);
      if (!backFacing && reflection) { const actual = this._reflectionCameras.get(view); reflection.captured = true; reflection.camera = { position: actual.position.toArray(), world: actual.matrixWorld.toArray(), projection: actual.projectionMatrix.toArray(), inverseWorld: actual.matrixWorldInverse.toArray() }; }
    };
    scene.add(water);
    key = new THREE.DirectionalLight(); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); rim = new THREE.DirectionalLight(); hemi = new THREE.HemisphereLight('#c8d5e8', '#5b4b3d'); scene.add(key, key.target, rim, rim.target, hemi);
    post = renderingFactory(renderer, scene, camera, { bounds: bounds.clone().expandByScalar(4) });
    status('载入现有 HDR；准备原生对照页…'); environment = await loadHDR(); if (disposed) { environment.dispose(); return; } scene.environment = environment;
    for (const [name, id] of [['mode', 'pine-mode'], ['view', 'pine-view'], ['light', 'pine-light'], ['output', 'pine-output']]) { const value = query.get(name); if (value && [...$(id).options].some(o => o.value === value)) $(id).value = value; }
    if (query.has('distance')) $('pine-distance').value = Math.max(2, Math.min(200, Number(query.get('distance')) || 30));
    if (query.has('phase')) $('pine-phase').value = Math.max(0, Math.min(100, Number(query.get('phase')) || 0)); $('pine-water').checked = query.get('water') === '1';
    loading = false; setView($('pine-view').value); lighting(); enable(); observer = new ResizeObserver(resize); observer.observe(stage); resize(); applyDisplay(); draw();
    document.body.dataset.ready = errors.length ? 'failed' : 'true'; status(errors.length ? '页面有错误，保留失败记录。' : '源枝簇与多方向折面已准备。请在 30–80 m 同机位检查日夜、斜向、侧背面、法线、阴影、水镜与过渡；本候选尚未验收。');
  } catch (error) { if (!disposed) { note(error, 'prepare'); dispose('prepare-failed'); document.body.dataset.ready = 'failed'; status('准备失败：' + error.message); } }
}
function setState(state) {
  if (loading || disposed || capturing) throw new Error('Pine review is not editable');
  pause();
  for (const [key, id] of [['mode', 'pine-mode'], ['light', 'pine-light'], ['output', 'pine-output']]) if (state[key] !== undefined) { if (![...$(id).options].some(o => o.value === state[key])) throw new Error('Invalid ' + key); $(id).value = state[key]; }
  if (state.phase !== undefined) $('pine-phase').value = THREE.MathUtils.clamp(state.phase, 0, 1) * 100;
  if (state.water !== undefined) $('pine-water').checked = !!state.water;
  if (state.view !== undefined) setView(state.view); if (state.distance !== undefined) moveDistance(state.distance); lighting(); draw(); return metadata();
}
for (const id of ['pine-mode', 'pine-light', 'pine-output', 'pine-water', 'pine-phase']) listen($(id), 'input', () => { pause(); if (id === 'pine-light') lighting(); invalidate(); });
listen($('pine-view'), 'change', () => { pause(); setView($('pine-view').value); invalidate(); });
listen($('pine-distance'), 'input', () => { pause(); moveDistance($('pine-distance').value); invalidate(); });
listen($('pine-play'), 'click', () => { pause(); $('pine-mode').value = 'blend'; $('pine-phase').value = 0; animation = { kind: 'blend', started: performance.now() }; invalidate(); });
listen($('pine-orbit'), 'click', () => { pause(); const offset = camera.position.clone().sub(controls.target); animation = { kind: 'orbit', started: performance.now(), angle: Math.atan2(offset.x, offset.z), radius: Math.hypot(offset.x, offset.z), height: offset.y }; invalidate(); });
listen($('pine-pause'), 'click', () => { pause(); draw(); }); listen($('pine-save'), 'click', () => { save().catch(() => {}); }); listen($('pine-dispose'), 'click', () => dispose());
listen(document, 'visibilitychange', () => { if (document.hidden) pause(); else invalidate(); }); listen(window, 'beforeunload', () => dispose('unload'));
enable(); const ready = prepare();
window.__pineClusterReview = { ready, metadata, setState, save, dispose, draw };
