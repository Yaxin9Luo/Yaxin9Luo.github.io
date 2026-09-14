import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

class NativePineScenePass extends RenderPass {
  constructor(scene, camera, samples) {
    super(scene, camera); this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false, resolveDepthBuffer: false, resolveStencilBuffer: false });
  }
  setSize(width, height) { this.target.setSize(width, height); }
  render(renderer, writeBuffer, readBuffer) { super.render(renderer, writeBuffer, this.target); renderer.initRenderTarget(readBuffer); renderer.copyTextureToTexture(this.target.texture, readBuffer.texture); }
  dispose() { this.target.dispose(); }
}

/** The source and cards use their real per-mesh normal materials. Water is
 * excluded from this GBuffer only. Its beauty/reflection render remains active.
 * Restore all scene/renderer state even when render throws. */
export function renderPineShootNormalBuffer({ renderer, scene, camera, target, fallbackMaterial }) {
  const previous = { target: renderer.getRenderTarget(), background: scene.background, override: scene.overrideMaterial, autoClear: renderer.autoClear, shadowAuto: renderer.shadowMap.autoUpdate, shadowDirty: renderer.shadowMap.needsUpdate, clear: renderer.getClearColor(new THREE.Color()).clone(), alpha: renderer.getClearAlpha() };
  const materials = [], hidden = [];
  try {
    scene.traverseVisible(object => {
      if (object.isWater || object.isPoints || object.isLine || object.isLine2) { hidden.push([object, object.visible]); object.visible = false; return; }
      if (!object.isMesh) return;
      materials.push([object, object.material]); object.material = object.userData.pineShootNormalMaterial ?? fallbackMaterial;
    });
    scene.background = null; scene.overrideMaterial = null;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(target); renderer.autoClear = false; renderer.setClearColor(0x7777ff, 1); renderer.clear(); renderer.render(scene, camera);
  } finally {
    materials.forEach(([object, material]) => { object.material = material; }); hidden.forEach(([object, visible]) => { object.visible = visible; });
    scene.background = previous.background; scene.overrideMaterial = previous.override;
    renderer.shadowMap.autoUpdate = previous.shadowAuto; renderer.shadowMap.needsUpdate = previous.shadowDirty;
    renderer.autoClear = previous.autoClear; renderer.setRenderTarget(previous.target); renderer.setClearColor(previous.clear, previous.alpha);
  }
}

const copyCounters = renderer => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, points: renderer.info.render.points });
const difference = (after, before) => Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));

/** This review always composites over an opaque scene background. Resolved
 * MSAA RGB already contains that background; coverage alpha is not canvas
 * transparency. Keep alpha-to-coverage in the geometry pass, then make only
 * the final canvas output opaque so PNG/browser unpremultiplication cannot
 * brighten its partially covered pixels. Tone mapping and RGB stay stock. */
export function createPineShootOpaqueOutputPass() {
  const pass = new OutputPass(), sample = 'gl_FragColor = texture2D( tDiffuse, vUv );';
  if (!pass.material.fragmentShader.includes(sample)) { pass.dispose(); throw new Error('Pine opaque output requires the stock OutputPass texture sample'); }
  pass.material.fragmentShader = pass.material.fragmentShader.replace(sample, sample + '\n\t\t\tgl_FragColor.a = 1.0;');
  return pass;
}

export function createPineShootLodRendering(renderer, scene, camera, { bounds, coverage = 'atlas' } = {}) {
  const samples = Math.min(4, renderer.capabilities.maxSamples || 0), target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false });
  const composer = new EffectComposer(renderer, target); composer.setPixelRatio(1);
  const scenePass = new NativePineScenePass(scene, camera, samples); composer.addPass(scenePass);
  const ao = new GTAOPass(scene, camera, 1, 1, {}, { radius: .024, distanceExponent: 1.4, thickness: .014, scale: 1, samples: 8 }, { lumaPhi: 5, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
  ao.blendIntensity = .55; ao.gtaoRenderTarget.depthBuffer = false; ao.pdRenderTarget.depthBuffer = false;
  if (bounds) ao.setSceneClipBox(bounds);
  // Use the documented external GBuffer hook with the target already owned by
  // the pass. Its normal shader override is never used for alpha foliage.
  ao.setGBuffer(ao.normalRenderTarget.depthTexture, ao.normalRenderTarget.texture); composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .45, 1.35);
  for (const buffer of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) buffer.depthBuffer = false;
  composer.addPass(bloom); composer.addPass(createPineShootOpaqueOutputPass());
  const fallback = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }); fallback.toneMapped = false;
  let output = 'beauty', width = 1, height = 1, disposed = false, counters = null;
  return {
    setOutput(value) {
      if (!['beauty', 'color', 'normal', 'depth', 'ao'].includes(value)) throw new Error('Unknown pine shoot review output');
      output = value; ao.enabled = value !== 'color'; bloom.enabled = value === 'beauty' || value === 'color';
      ao.output = ({ beauty: GTAOPass.OUTPUT.Default, normal: GTAOPass.OUTPUT.Normal, depth: GTAOPass.OUTPUT.Depth, ao: GTAOPass.OUTPUT.Denoise })[value] ?? GTAOPass.OUTPUT.Default;
      renderer.toneMapping = bloom.enabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    },
    resize(cssWidth, cssHeight, dpr) { width = Math.max(1, Math.floor(cssWidth * dpr)); height = Math.max(1, Math.floor(cssHeight * dpr)); composer.setSize(width, height); },
    render() {
      if (disposed) return;
      const before = copyCounters(renderer);
      if (ao.enabled) renderPineShootNormalBuffer({ renderer, scene, camera, target: ao.normalRenderTarget, fallbackMaterial: fallback });
      const afterNormal = copyCounters(renderer); composer.render(0);
      counters = { normal: difference(afterNormal, before), colorReflectionShadowAndScreen: difference(copyCounters(renderer), afterNormal) };
    },
    metadata() { return { output, width, height, samples, nativePixels: true, finalOutputAlpha: 'opaque after MSAA resolve and postprocessing; RGB unchanged', normalBuffer: [ao.normalRenderTarget.width, ao.normalRenderTarget.height], normalCoverage: coverage === 'geometry' ? 'actual source/ribbon triangles; single-sample GBuffer, no atlas' : 'same atlas alpha and cutoff as custom shadow maps; single-sample GBuffer', colorCoverage: coverage === 'geometry' ? 'actual triangle coverage with MSAA; no alpha map or A2C threshold' : 'alpha test + MSAA alpha-to-coverage', gtao: { radius: .024, thickness: .014, blend: .55 }, counters, nativeReviewed: false }; },
    dispose() { if (disposed) return; disposed = true; fallback.dispose(); for (const pass of composer.passes) pass.dispose?.(); composer.dispose(); },
  };
}
