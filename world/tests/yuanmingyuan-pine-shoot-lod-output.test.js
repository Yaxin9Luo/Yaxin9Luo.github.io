import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createPineShootOpaqueOutputPass } from '../src/yuanmingyuan/pine-shoot-lod-rendering.js';
import { pineShootMaterialSet } from '../src/yuanmingyuan/pine-shoot-lod-materials.js';

test('opaque review output changes only alpha after sampling the resolved scene', () => {
  const stock = new OutputPass(), actual = createPineShootOpaqueOutputPass();
  try {
    assert.equal(actual.isOutputPass, true);
    const shader = actual.material.fragmentShader, assignment = /\n\t\t\tgl_FragColor\.a = 1\.0;/g;
    assert.equal([...shader.matchAll(assignment)].length, 1);
    assert.equal(shader.replace(assignment, ''), stock.material.fragmentShader, 'all RGB, tone-mapping and color-space code must remain byte-identical');
    assert.ok(shader.indexOf('gl_FragColor.a = 1.0;') > shader.indexOf('gl_FragColor = texture2D( tDiffuse, vUv );'));
    assert.equal(actual.material.vertexShader, stock.material.vertexShader);
    assert.deepEqual(Object.keys(actual.uniforms), Object.keys(stock.uniforms));
    assert.notEqual(actual.material, stock.material);
  } finally { actual.dispose(); stock.dispose(); }
});

test('output keeps actual renderer exposure, transfer and day/night tone mapping through real OutputPass.render', () => {
  const pass = createPineShootOpaqueOutputPass(), texture = new THREE.Texture(), calls = [];
  const renderer = { toneMappingExposure: 1.1, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, setRenderTarget: target => calls.push(['target', target]), render: (scene, camera) => calls.push(['render', scene.material, camera]) };
  try {
    pass.renderToScreen = true; pass.render(renderer, null, { texture });
    assert.equal(pass.uniforms.tDiffuse.value, texture);
    assert.equal(pass.uniforms.toneMappingExposure.value, 1.1);
    assert.ok(Object.hasOwn(pass.material.defines, 'ACES_FILMIC_TONE_MAPPING'));
    assert.ok(Object.hasOwn(pass.material.defines, 'SRGB_TRANSFER'));
    assert.equal(calls[0][1], null);
    assert.equal(calls[1][1], pass.material);
    renderer.toneMappingExposure = .9; renderer.toneMapping = THREE.NoToneMapping; pass.render(renderer, null, { texture });
    assert.equal(pass.uniforms.toneMappingExposure.value, .9);
    assert.equal(Object.hasOwn(pass.material.defines, 'ACES_FILMIC_TONE_MAPPING'), false);
  } finally { texture.dispose(); pass.dispose(); }
});

test('geometry coverage and shadow cutoff remain independent of final canvas opacity', () => {
  const baseMap = new THREE.DataTexture(new Uint8Array([96, 130, 86, 128]), 1, 1), normalMap = new THREE.DataTexture(new Uint8Array([128, 255, 128, 255]), 1, 1);
  const set = pineShootMaterialSet({ baseMap, normalMap, transition: { phase: { value: .5 }, role: { value: 0 } } });
  try {
    assert.equal(set.surface.alphaToCoverage, true);
    assert.equal(set.surface.alphaTest, .18);
    assert.equal(set.surface.map, baseMap);
    assert.equal(set.surface.depthWrite, true);
    assert.equal(set.depth.map, baseMap);
    assert.equal(set.distance.map, baseMap);
    assert.equal(set.depth.alphaTest, .18);
    assert.equal(set.distance.alphaTest, .18);
    assert.equal(set.surface.normalMapType, THREE.ObjectSpaceNormalMap);
  } finally { set.materials.forEach(material => material.dispose()); baseMap.dispose(); normalMap.dispose(); }
});
