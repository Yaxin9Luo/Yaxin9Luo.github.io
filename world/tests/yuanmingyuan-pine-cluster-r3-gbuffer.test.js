import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { WebGLTextures } from 'three/src/renderers/webgl/WebGLTextures.js';
import { WebGLProperties } from 'three/src/renderers/webgl/WebGLProperties.js';
import { WebGLUtils } from 'three/src/renderers/webgl/WebGLUtils.js';
import { createPineClusterR3Rendering } from '../src/yuanmingyuan/pine-cluster-r3-rendering.js';

// Execute the installed Three allocation/resolve code against a recording GL
// boundary. This proves actual format selection and blit arguments, not GPU
// rendering or driver conformance. No texture storage or model is allocated.
function allocationTrace(target) {
  let identifier = 0, enumeration = 100000;
  const calls = [], enums = new Map();
  const fixed = { COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100, STENCIL_BUFFER_BIT: 0x0400 };
  const gl = new Proxy(fixed, { get(object, key) {
    if (key in object) return object[key];
    if (/^[A-Z0-9_]+$/.test(key)) { if (!enums.has(key)) enums.set(key, enumeration++); return enums.get(key); }
    return (...args) => { calls.push({ name: key, args }); return key.startsWith('create') ? { id: ++identifier, kind: key } : undefined; };
  } });
  const extensions = { has: () => false, get: () => null }, properties = WebGLProperties(), info = { memory: { textures: 0 }, render: { frame: 0 } };
  const state = new Proxy({}, { get: (_, key) => (...args) => { calls.push({ name: key, args }); } });
  const textures = new WebGLTextures(gl, extensions, state, properties, { maxSamples: 4, maxTextures: 16, maxTextureSize: 16384, getMaxAnisotropy: () => 1 }, WebGLUtils(gl, extensions), info);
  textures.setupRenderTarget(target); textures.updateMultisampleRenderTarget(target);
  const enumName = value => [...enums].find(([, code]) => value === code)?.[0] ?? value;
  const result = {
    buffers: calls.filter(x => x.name === 'renderbufferStorageMultisample').map(x => ({ samples: x.args[1], internalFormat: enumName(x.args[2]), size: x.args.slice(3) })),
    textures: calls.filter(x => x.name === 'texStorage2D').map(x => ({ internalFormat: enumName(x.args[2]), size: x.args.slice(3) })),
    blits: calls.filter(x => x.name === 'blitFramebuffer').map(x => ({ rectangle: x.args.slice(0, 8), color: !!(x.args[8] & gl.COLOR_BUFFER_BIT), depth: !!(x.args[8] & gl.DEPTH_BUFFER_BIT), stencil: !!(x.args[8] & gl.STENCIL_BUFFER_BIT), filter: enumName(x.args[9]) })),
  };
  target.dispose(); assert.equal(info.memory.textures, 0);
  return result;
}

test('actual r185 MSAA depth allocation matches the GTAO read texture for the combined colour/depth resolve', t => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), legacy = new GTAOPass(scene, camera, 13, 7);
  legacy.normalRenderTarget.samples = 4; legacy.normalRenderTarget.resolveStencilBuffer = false;
  const old = allocationTrace(legacy.normalRenderTarget); legacy.dispose();
  assert.equal(old.buffers.find(x => x.internalFormat.startsWith('DEPTH')).internalFormat, 'DEPTH_COMPONENT24');
  assert.equal(old.textures.find(x => x.internalFormat.startsWith('DEPTH')).internalFormat, 'DEPTH24_STENCIL8');
  let target;
  const setGBuffer = GTAOPass.prototype.setGBuffer;
  t.mock.method(GTAOPass.prototype, 'setGBuffer', function(...args) { setGBuffer.apply(this, args); target = this.normalRenderTarget; });
  const post = createPineClusterR3Rendering({ capabilities: { maxSamples: 4 }, getPixelRatio: () => 1 }, scene, camera);
  try {
    post.resize(13, 7, 1);
    const current = allocationTrace(target);
    console.log(JSON.stringify({ stage: 'installed-Three-GBuffer-allocation', gpu: false, old, current }));
    assert.equal(current.buffers.find(x => x.internalFormat.startsWith('DEPTH')).internalFormat, current.textures.find(x => x.internalFormat.startsWith('DEPTH')).internalFormat);
    assert.deepEqual(current.blits, [{ rectangle: [0, 0, 13, 7, 0, 0, 13, 7], color: true, depth: true, stencil: false, filter: 'NEAREST' }]);
    assert.ok(current.buffers.every(x => x.samples === 4));
    assert.equal(current.buffers[0].internalFormat, 'RGBA16F');
  } finally { post.dispose(); }
});

test('R3 resolved diagnostic reports actual readable pixels, skips colour-only output and restores target on failure', t => {
  t.mock.method(EffectComposer.prototype, 'render', () => {}); // No GPU/composer simulation is claimed.
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), prior = { id: 'caller-target' }, restored = [], clear = new THREE.Color(.2, .3, .4);
  let current = prior, reads = 0, behavior = 'data';
  const renderer = {
    capabilities: { maxSamples: 4 }, getPixelRatio: () => 1, info: { render: { calls: 0, triangles: 0, lines: 0, points: 0 } },
    shadowMap: { autoUpdate: true, needsUpdate: true }, autoClear: true,
    getRenderTarget: () => current, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    setRenderTarget: (...args) => { current = args[0]; restored.push(args); },
    getClearColor: target => target.copy(clear), getClearAlpha: () => 1, setClearColor() {}, clear() {}, render() {},
    getContext: () => { throw new Error('no shader/debug extension or raw framebuffer queries'); },
    readRenderTargetPixels(target, x, y, width, height, buffer) {
      reads++; assert.equal(target.width, 13); assert.equal(target.height, 7); assert.equal(target.stencilBuffer, true);
      assert.ok(x >= 0 && x < 13 && y >= 0 && y < 7); assert.equal(width, 1); assert.equal(height, 1); assert.ok(buffer instanceof Uint16Array);
      if (behavior === 'throw') throw new Error('read failure');
      if (behavior === 'data') buffer.set([.5, .5, 1, 1].map(THREE.DataUtils.toHalfFloat));
      if (behavior === 'zero') buffer.fill(0);
    },
  };
  const post = createPineClusterR3Rendering(renderer, scene, camera);
  try {
    post.resize(13, 7, 1); post.render();
    let metadata = post.metadata();
    assert.equal(metadata.gBuffer.colorType, THREE.HalfFloatType); assert.equal(metadata.gBuffer.depthFormat, THREE.DepthStencilFormat); assert.equal(metadata.gBuffer.depthType, THREE.UnsignedInt248Type);
    assert.equal(metadata.gBuffer.normalSamplerMatchesTarget, true); assert.equal(metadata.gBuffer.depthSamplerMatchesTarget, true);
    assert.equal(metadata.gBuffer.readback.status, 'nonzero-resolved-color-read'); assert.equal(reads, 3);
    assert.deepEqual(restored.at(-1), [prior, 2, 1]); assert.equal(metadata.nativeReviewed, false);
    post.setOutput('color'); post.render(); assert.equal(reads, 3); assert.equal(post.metadata().gBuffer.readback.status, 'skipped-for-color-output');
    post.setOutput('normal'); behavior = 'unwritten'; post.render(); assert.equal(post.metadata().gBuffer.readback.status, 'unwritten-or-nonfinite-readback');
    behavior = 'zero'; post.render(); assert.equal(post.metadata().gBuffer.readback.status, 'zero-color-readback');
    behavior = 'throw'; post.render(); assert.equal(post.metadata().gBuffer.readback.status, 'readback-error'); assert.deepEqual(restored.at(-1), [prior, 2, 1]);
  } finally { post.dispose(); post.dispose(); }
});
