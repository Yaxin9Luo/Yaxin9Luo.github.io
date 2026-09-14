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

function resolvedNormalReadback(renderer, target) {
  if (!renderer.readRenderTargetPixels) return { status: 'unavailable', reason: 'renderer has no readRenderTargetPixels' };
  const previous = [renderer.getRenderTarget(), renderer.getActiveCubeFace?.() ?? 0, renderer.getActiveMipmapLevel?.() ?? 0];
  const pixels = [], coordinates = [[0, target.height - 1], [Math.floor(target.width / 2), Math.floor(target.height / 2)], [target.width - 1, target.height - 1]];
  try {
    for (const [x, y] of coordinates) {
      const values = new Uint16Array(4); values.fill(0x7e00); // NaN also detects a read API that returns without writing.
      renderer.readRenderTargetPixels(target, x, y, 1, 1, values);
      pixels.push({ x, y, rgba: Array.from(values, THREE.DataUtils.fromHalfFloat) });
    }
    const finite = pixels.every(pixel => pixel.rgba.every(Number.isFinite)), nonzero = pixels.some(pixel => pixel.rgba.slice(0, 3).some(value => value !== 0));
    return { status: !finite ? 'unwritten-or-nonfinite-readback' : nonzero ? 'nonzero-resolved-color-read' : 'zero-color-readback', pixels, scope: 'three actual resolved RGBA16F pixels; not whole-buffer or depth/beauty validation' };
  } catch (error) { return { status: 'readback-error', message: error.message }; }
  finally { renderer.setRenderTarget(...previous); }
}

export function createPineClusterR3Rendering(renderer, scene, camera, { bounds } = {}) {
  const samples = Math.min(4, renderer.capabilities.maxSamples || 0), target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false });
  const composer = new EffectComposer(renderer, target); composer.setPixelRatio(1);
  const scenePass = new NativeClusterScenePass(scene, camera, samples); composer.addPass(scenePass);
  const ao = new GTAOPass(scene, camera, 1, 1, {}, { radius: 1.6, distanceExponent: 1.4, thickness: .6, scale: 1, samples: 8 }, { lumaPhi: 5, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
  // R3's coverage is fractional at one resolved visible cluster surface. Use
  // the same four real coverage samples in the source and candidate GBuffer;
  // a single-sample normal pass would turn every nonzero texel into a sheet.
  ao.normalRenderTarget.samples = samples;
  // GTAOPass supplies a D24S8 texture. Three chooses the MSAA renderbuffer
  // format from stencilBuffer, not that texture's format. Keep both D24S8:
  // resolving COLOR|DEPTH from D24 to D24S8 invalidates the entire blit.
  ao.normalRenderTarget.stencilBuffer = true;
  ao.normalRenderTarget.resolveDepthBuffer = true;
  ao.normalRenderTarget.resolveStencilBuffer = false;
  ao.blendIntensity = .55; ao.gtaoRenderTarget.depthBuffer = false; ao.pdRenderTarget.depthBuffer = false;
  if (bounds) ao.setSceneClipBox(bounds);
  // Use the documented external GBuffer hook with the target already owned by
  // the pass. Its normal shader override is never used for alpha foliage.
  ao.setGBuffer(ao.normalRenderTarget.depthTexture, ao.normalRenderTarget.texture); composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .45, 1.35);
  for (const buffer of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) buffer.depthBuffer = false;
  composer.addPass(bloom); composer.addPass(createPineShootOpaqueOutputPass());
  const fallback = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }); fallback.toneMapped = false;
  let output = 'beauty', width = 1, height = 1, disposed = false, counters = null, normalReadback = { status: 'not-rendered' };
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
      // Diagnostic only, after all render passes: no shader extension queries,
      // rerender, target mutation or interpretation of a linked shader as proof.
      normalReadback = ao.enabled ? resolvedNormalReadback(renderer, ao.normalRenderTarget) : { status: 'skipped-for-color-output' };
    },
    metadata() { return { output, revision: 'r3', width, height, samples, nativePixels: true, finalOutputAlpha: 'opaque after MSAA resolve and postprocessing; RGB unchanged', normalBuffer: [ao.normalRenderTarget.width, ao.normalRenderTarget.height], normalCoverage: 'source and R3 both full-size MSAA4 normal/depth; R3 joint first-hit coverage alpha-to-coverage on one selected surface', colorCoverage: 'native MSAA4, deterministic PBR24 and fractional coverage; Reflector keeps its original 2048-square MSAA4 target', shadowCoverage: 'original 4096 PCF shadow; fixed 8x8 ordered area coverage for single-sample depth; native grain/transition acceptance pending', gtao: { radius: 1.6, thickness: .6, blend: .55 }, gBuffer: { width: ao.normalRenderTarget.width, height: ao.normalRenderTarget.height, samples: ao.normalRenderTarget.samples, colorFormat: ao.normalRenderTarget.texture.format, colorType: ao.normalRenderTarget.texture.type, depthFormat: ao.normalRenderTarget.depthTexture.format, depthType: ao.normalRenderTarget.depthTexture.type, stencilBuffer: ao.normalRenderTarget.stencilBuffer, resolveDepthBuffer: ao.normalRenderTarget.resolveDepthBuffer, resolveStencilBuffer: ao.normalRenderTarget.resolveStencilBuffer, normalSamplerMatchesTarget: ao.gtaoMaterial.uniforms.tNormal.value === ao.normalRenderTarget.texture, depthSamplerMatchesTarget: ao.gtaoMaterial.uniforms.tDepth.value === ao.normalRenderTarget.depthTexture, resolveContract: 'RGBA16F and D24S8 on both renderbuffer and texture; color/depth resolve, no stencil resolve', readback: normalReadback }, counters, nativeReviewed: false }; },
    dispose() { if (disposed) return; disposed = true; fallback.dispose(); for (const pass of composer.passes) pass.dispose?.(); composer.dispose(); },
  };
}
