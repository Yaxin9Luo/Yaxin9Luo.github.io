import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { QUALITY } from '../render-quality.js';
import { enableWillowLodCoverage } from './willow-lod-runtime.js';
import { setWillowSampling } from './willow-distance-sampling.js';

// Same resolved HDR scene pass as the museum renderer. Its own module stays
// untouched; this local review pipeline exposes the actual normal override.
class NativeScenePass extends RenderPass {
  constructor(scene, camera, samples) {
    super(scene, camera);
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false, resolveDepthBuffer: false, resolveStencilBuffer: false });
  }
  setSize(width, height) { this.target.setSize(width, height); }
  render(renderer, writeBuffer, readBuffer) { super.render(renderer, writeBuffer, this.target); renderer.initRenderTarget(readBuffer); renderer.copyTextureToTexture(this.target.texture, readBuffer.texture); }
  dispose() { this.target.dispose(); }
}

export function configureWillowNormalOverride(ao) {
  enableWillowLodCoverage(ao.normalMaterial); ao.normalMaterial.side = THREE.DoubleSide; ao.normalMaterial.needsUpdate = true;
  ao.blendIntensity = .55; ao.gtaoRenderTarget.depthBuffer = false; ao.pdRenderTarget.depthBuffer = false;
  // Do not use the museum's 0.8 resolution normal pass here: screen-door masks
  // in colour and normal/depth need the same gl_FragCoord pixel lattice.
  return { geometryNormalSide: 'double', coverage: 'same frozen willow vertex/fragment hook', resolutionScale: 1, shadowCoverage: 'same phase in light-map pixel coordinates', msaaBoundaryParity: 'requires native inspection' };
}

export function createWillowDistanceRendering(renderer, scene, camera, { clipBox }) {
  const samples = Math.min(QUALITY.high.samples, renderer.capabilities.maxSamples || 0);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false }), composer = new EffectComposer(renderer, target); composer.setPixelRatio(1);
  const scenePass = new NativeScenePass(scene, camera, samples); composer.addPass(scenePass);
  const ao = new GTAOPass(scene, camera, 1, 1, {}, { radius: 1.6, distanceExponent: 1.4, thickness: .6, scale: 1, samples: 8 }, { lumaPhi: 5, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
  const compatibility = configureWillowNormalOverride(ao); ao.setSceneClipBox(clipBox); composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .45, 1.35);
  for (const buffer of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) buffer.depthBuffer = false;
  composer.addPass(bloom); const smaa = new SMAAPass(); smaa.enabled = samples === 0; composer.addPass(smaa); composer.addPass(new OutputPass());
  let output = 'beauty', width = 1, height = 1, disposed = false;
  return {
    setSampling(value) { setWillowSampling(ao.normalMaterial, value); compatibility.sampling = value; compatibility.centroidNormalPass = 'single-sample buffer: centroid has no sampling-location effect per GLSL ES 3.00'; },
    setOutput(value) {
      if (!['beauty', 'color', 'normal', 'depth', 'ao'].includes(value)) throw new Error('Unknown willow review output');
      output = value; ao.enabled = value !== 'color'; bloom.enabled = value === 'beauty' || value === 'color';
      ao.output = ({ beauty: GTAOPass.OUTPUT.Default, normal: GTAOPass.OUTPUT.Normal, depth: GTAOPass.OUTPUT.Depth, ao: GTAOPass.OUTPUT.Denoise })[value] ?? GTAOPass.OUTPUT.Default;
      renderer.toneMapping = bloom.enabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    },
    resize(cssWidth, cssHeight, dpr) { width = Math.max(1, Math.floor(cssWidth * dpr)); height = Math.max(1, Math.floor(cssHeight * dpr)); composer.setSize(width, height); },
    render() { if (!disposed) composer.render(0); },
    metadata() { return { output, pipeline: 'museum HDR/GTAO/MSAA settings with explicit willow normal coverage', samples, width, height, normalBuffer: { width: ao.normalRenderTarget.width, height: ao.normalRenderTarget.height }, compatibility, nativeAdmissionAllowed: false }; },
    dispose() { if (disposed) return; disposed = true; for (const pass of composer.passes) pass.dispose?.(); composer.dispose(); },
  };
}
