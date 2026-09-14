import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { renderPineShootNormalBuffer, createPineShootOpaqueOutputPass } from './pine-shoot-lod-rendering.js';

class NativeClusterScenePass extends RenderPass {
  constructor(scene, camera, samples) {
    super(scene, camera); this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false, resolveDepthBuffer: false, resolveStencilBuffer: false });
  }
  setSize(width, height) { this.target.setSize(width, height); }
  render(renderer, writeBuffer, readBuffer) { super.render(renderer, writeBuffer, this.target); renderer.initRenderTarget(readBuffer); renderer.copyTextureToTexture(this.target.texture, readBuffer.texture); }
  dispose() { this.target.dispose(); }
}

const copyCounters = renderer => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, points: renderer.info.render.points });
const difference = (after, before) => Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));

export function createPineClusterRendering(renderer, scene, camera, { bounds } = {}) {
  const samples = Math.min(4, renderer.capabilities.maxSamples || 0), target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false });
  const composer = new EffectComposer(renderer, target); composer.setPixelRatio(1);
  const scenePass = new NativeClusterScenePass(scene, camera, samples); composer.addPass(scenePass);
  const ao = new GTAOPass(scene, camera, 1, 1, {}, { radius: 1.6, distanceExponent: 1.4, thickness: .6, scale: 1, samples: 8 }, { lumaPhi: 5, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
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
    metadata() { return { output, width, height, samples, nativePixels: true, finalOutputAlpha: 'opaque after MSAA resolve and postprocessing; RGB unchanged', normalBuffer: [ao.normalRenderTarget.width, ao.normalRenderTarget.height], normalCoverage: 'source triangles or the same premultiplied stochastic field as shadows; full-size single-sample GBuffer', colorCoverage: 'physical MSAA4 geometric edges, identical stochastic field across colour/depth/normal; no per-card alpha-to-coverage mask correlation', gtao: { radius: 1.6, thickness: .6, blend: .55 }, counters, nativeReviewed: false }; },
    dispose() { if (disposed) return; disposed = true; fallback.dispose(); for (const pass of composer.passes) pass.dispose?.(); composer.dispose(); },
  };
}
