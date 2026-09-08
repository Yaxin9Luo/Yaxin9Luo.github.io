import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createCastle, loadArchitectureAssets } from '../src/models.js';
import { loadLandscapeAssets, groundMaterial, surface } from '../src/landscape.js';
import { createGardenSpecimen } from '../src/gardens.js';

// Keep the real shared loader/binding path; Node substitutes only image decoding.
const loaded = [];
const originalTextureLoad = THREE.TextureLoader.prototype.loadAsync;
const originalHDRLoad = HDRLoader.prototype.loadAsync;
const originalDocument = globalThis.document;
THREE.TextureLoader.prototype.loadAsync = async function (url) {
  assert.ok(fs.existsSync(new URL(`../public${url}`, import.meta.url)), `missing local texture ${url}`);
  loaded.push(url);
  return new THREE.Texture();
};
HDRLoader.prototype.loadAsync = async () => new THREE.DataTexture();
globalThis.document = {};
await loadArchitectureAssets();
await loadLandscapeAssets();
THREE.TextureLoader.prototype.loadAsync = originalTextureLoad;
HDRLoader.prototype.loadAsync = originalHDRLoad;
if (originalDocument === undefined) delete globalThis.document;
else globalThis.document = originalDocument;

const castle = createCastle();
const materials = new Map();
castle.traverse(object => { if (object.isMesh) materials.set(object.material.name, object.material); });
const shaderFor = material => {
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader, vertexShader: THREE.ShaderLib.standard.vertexShader };
  material.onBeforeCompile(shader);
  return shader;
};

test('loaded building surfaces keep real PBR channels and distinguish broad surfaces from carved trim', () => {
  for (const name of ['limestone', 'weathered-stone', 'blue-grey-slate', 'walnut', 'foundation']) {
    const material = materials.get(name);
    assert.ok(material.map && material.normalMap && material.roughnessMap, `${name} lost a PBR channel`);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(material.roughnessMap.colorSpace, THREE.NoColorSpace);
    assert.ok(material.userData.albedoStrength >= .7, `${name} texture was almost erased`);
    assert.ok(material.normalScale.x >= .5, `${name} relief was almost erased`);
    assert.equal(material.map.wrapS, THREE.RepeatWrapping);
    assert.ok(loaded.includes(`/textures/${material.userData.surface}/color.webp`));
  }
  const wall = materials.get('limestone'), trim = materials.get('carved-limestone');
  assert.equal(wall.map, trim.map, 'shared material channels do not require duplicate GPU textures');
  assert.ok(trim.normalScale.x < wall.normalScale.x / 3, 'carved trim should not look like a second brick wall');
  assert.notEqual(wall.customProgramCacheKey(), trim.customProgramCacheKey());
  assert.equal(materials.get('blue-grey-slate').metalness, 0, 'slate is a dielectric');
});

test('roughness varies through the source image while keeping broad dielectric highlights', () => {
  for (const name of ['limestone', 'carved-limestone', 'blue-grey-slate', 'walnut', 'foundation']) {
    const material = materials.get(name), shader = shaderFor(material);
    assert.ok(material.userData.roughnessFloor >= .6);
    assert.ok(material.roughness >= material.userData.roughnessFloor);
    assert.match(shader.fragmentShader, /texture2D\(roughnessMap,vRoughnessMapUv\)/);
    assert.equal((shader.fragmentShader.match(/float roughnessFactor=/g) || []).length, 1);
    assert.equal((shader.fragmentShader.match(/vec3 authoredBase=/g) || []).length, 1);
  }
});

test('landscape retains measured meadow and rock textures without overriding deliberately plain garden trim', () => {
  const ground = groundMaterial(), rock = surface('mossy-rock'), plain = surface('castle-masonry', { map: null, normalMap: null, roughnessMap: null });
  assert.ok(ground.map && ground.normalMap && ground.roughnessMap);
  assert.ok(ground.normalScale.x >= .6);
  assert.ok(ground.userData.albedoStrength >= .7);
  assert.ok(rock.map && rock.normalMap && rock.roughnessMap);
  assert.ok(rock.normalScale.x >= .7);
  assert.equal(plain.map, null); assert.equal(plain.normalMap, null); assert.equal(plain.roughnessMap, null);
  const shader = shaderFor(ground);
  assert.equal(shader.uniforms.rockMap.value, rock.map);
  assert.match(shader.fragmentShader, /terrainPosition\.xz\/3\./, 'the rock scan is a three-metre tile');
  assert.equal((shader.fragmentShader.match(/vec3 authoredBase=/g) || []).length, 1);
  assert.match(shader.fragmentShader, /mix\(authoredBase,diffuseColor.rgb,0\.820\)/);
});

test('actual reading props use distinct stone, timber, metal, cloth and soil surfaces at physical scales', () => {
  const garden = createGardenSpecimen('reading'), props = new Map();
  garden.traverse(object => { if (object.isMesh) props.set(object.material.name, object.material); });
  for (const name of ['Garden warm limestone', 'Carved garden coping', 'Garden oiled walnut', 'Garden oak edges', 'Garden aged brass', 'Garden book cloth', 'Garden wine book cloth', 'Cultivated garden earth']) {
    const material = props.get(name);
    assert.ok(material?.map && material.normalMap && material.roughnessMap, `${name} lost its surface maps`);
    assert.equal(material.map.repeat.x, 1, 'per-prop scale must not mutate a shared texture');
    assert.ok(material.roughness >= material.userData.roughnessFloor);
    const shader = shaderFor(material), scale = material.userData.uvScale.toFixed(5);
    for (const uv of ['vMapUv', 'vNormalMapUv', 'vRoughnessMapUv']) assert.ok(shader.vertexShader.includes(`${uv}*=${scale};`), `${name} has misaligned PBR channels`);
  }
  assert.equal(props.get('Garden oiled walnut').map, materials.get('walnut').map, 'building and prop wood reuse the decoded texture');
  assert.ok(props.get('Garden book cloth').userData.metresPerRepeat < .3, 'book cloth should not have metre-wide stitches');
  assert.ok(props.get('Cultivated garden earth').normalScale.x >= .8);
  assert.ok(props.get('Carved garden coping').normalScale.x < props.get('Garden warm limestone').normalScale.x / 3);
  assert.ok(props.get('Garden aged brass').userData.roughnessFloor < props.get('Garden book cloth').userData.roughnessFloor);
});
