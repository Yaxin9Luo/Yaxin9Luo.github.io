import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installVegetationWoodStability, patchVegetationWoodShader } from '../src/yuanmingyuan/vegetation-wood-stability.js';

const fresh = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} });
function materials() {
  const grain = new THREE.DataTexture(new Uint8Array([237, 237, 237, 255]), 1, 1);
  const bark = new THREE.MeshStandardMaterial({ name: 'yuanming-living-grey-brown-bark', vertexColors: true, roughness: .96, map: grain, bumpMap: grain, bumpScale: .018 });
  const stem = new THREE.MeshStandardMaterial({ name: 'yuanming-petioles-and-twigs', vertexColors: true, roughness: .88 });
  return { bark, stem, grain };
}
const close = (a, b, tolerance = 2e-13) => a.forEach((value, i) => assert(Math.abs(value - b[i]) <= tolerance, String(value) + ' differs from ' + String(b[i])));
const finite = a => a.every(Number.isFinite);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const size = Math.sqrt(dot(a, a)); return a.map(x => x / size); };
// CPU algebra reference, not a claim that these tests execute GLSL.
function safeUnit(a) {
  if (!finite(a)) return null;
  const largest = Math.max(...a.map(Math.abs));
  if (largest === 0) return null;
  const scaled = a.map(x => x / largest), result = unit(scaled);
  return finite(result) ? result : null;
}
function perturb(dx, dy, n, h, face, guarded) {
  const x = guarded ? safeUnit(dx) : unit(dx), y = guarded ? safeUnit(dy) : unit(dy);
  if (guarded && (!x || !y || !finite(h))) return n;
  const r1 = cross(y, n), r2 = cross(n, x), det = dot(x, r1) * face;
  if (guarded && (!Number.isFinite(det) || det === 0)) return n;
  const value = n.map((v, i) => Math.abs(det) * v - Math.sign(det) * (h[0] * r1[i] + h[1] * r2[i]));
  return guarded ? (safeUnit(value) ?? n) : unit(value);
}

test('RGB splice preserves alpha, vertex shader, uniforms and all later PBR work', () => {
  const shader = fresh(), before = structuredClone(shader);
  patchVegetationWoodShader(shader);
  const color = '/* vegetation-wood-stability-r1:rgb01 */\n#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n  diffuseColor.rgb *= clamp( vColor.rgb, vec3( 0.0 ), vec3( 1.0 ) );\n  diffuseColor.a *= vColor.a;\n#endif';
  assert.equal(shader.fragmentShader.replace(color, '#include <color_fragment>'), before.fragmentShader);
  assert.equal(shader.vertexShader, before.vertexShader);
  assert.deepEqual(shader.uniforms, before.uniforms);
  assert(shader.fragmentShader.includes('#include <bumpmap_pars_fragment>'));
  assert(shader.fragmentShader.includes('#include <lights_fragment_maps>'));
  assert(shader.fragmentShader.includes('#include <normal_fragment_maps>'));
});

test('bark keeps original height samples and guards only perturbNormalArb', () => {
  const before = THREE.ShaderChunk.bumpmap_pars_fragment, shader = fresh();
  patchVegetationWoodShader(shader, { bump: true });
  const start = before.indexOf('\tvec3 perturbNormalArb(');
  assert(start > 0);
  assert(shader.fragmentShader.includes(before.slice(0, start)));
  assert(shader.fragmentShader.includes('float fDet = dot( vSigmaX, R1 ) * faceDirection;'));
  assert(shader.fragmentShader.includes('fDet == 0.0'));
  assert(shader.fragmentShader.includes('value / largest'));
  assert(!shader.fragmentShader.includes('#include <bumpmap_pars_fragment>'));
  assert.equal(THREE.ShaderChunk.bumpmap_pars_fragment, before);
  assert.equal(shader.vertexShader, THREE.ShaderLib.standard.vertexShader);
  assert(shader.fragmentShader.indexOf('dFdy( surf_pos.xyz )') < shader.fragmentShader.indexOf('if ( ! willowBumpUnit'));
});

test('512 ordinary finite normals preserve the legacy direction', () => {
  let seed = 6153;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let i = 0; i < 512; i++) {
    const dx = [random(), random(), random()], dy = [random(), random(), random()], n = unit([random(), random(), random()]), h = [random() * .018, random() * .018], face = i % 2 ? 1 : -1;
    const original = perturb(dx, dy, n, h, face, false), guarded = perturb(dx, dy, n, h, face, true);
    assert(finite(original) && finite(guarded)); close(original, guarded);
  }
});

test('undefined normals fall back but nonzero 1e-25 determinant retains bump', () => {
  const n = [0, 0, 1];
  for (const [dx, dy, h] of [
    [[0, 0, 0], [0, 1, 0], [.01, .01]],
    [[1, 0, 0], [0, 0, 0], [.01, .01]],
    [[1, 0, 0], [1, 0, 0], [.01, .01]],
    [[Infinity, 0, 0], [0, 1, 0], [.01, .01]],
    [[1, 0, 0], [0, 1, 0], [NaN, .01]],
  ]) assert.equal(perturb(dx, dy, n, h, 1, true), n);
  const tiny = perturb([1, 0, 0], [1, 1e-25, 0], n, [.018, 0], 1, true);
  close(tiny, perturb([1, 0, 0], [1, 1e-25, 0], n, [.018, 0], 1, false));
  assert(tiny[1] > .99 && tiny[2] < 1e-20);
});

test('largest-component normalization avoids finite float32 length overflow and underflow', () => {
  const f = Math.fround;
  function unit32(value, scale) {
    let v = value.map(f);
    if (scale) { const largest = Math.max(...v.map(Math.abs)); v = v.map(x => f(x / largest)); }
    const size = f(Math.sqrt(f(f(f(v[0] * v[0]) + f(v[1] * v[1])) + f(v[2] * v[2]))));
    return v.map(x => f(x / size));
  }
  for (const v of [[3e38, -2e38, 1e38], [1e-30, -2e-30, 3e-30]]) {
    close(unit32(v, true), unit(v), 2e-7);
    const legacy = unit32(v, false); assert(!finite(legacy) || Math.hypot(...legacy) < .1);
  }
});

test('RGB bound is identity for authored inputs and does not clamp alpha', () => {
  const multiply = (diffuse, varying) => diffuse.map((x, i) => x * (i === 3 ? varying[i] : Math.min(1, Math.max(0, varying[i]))));
  for (const c of [[0, 0, 0], [1, 1, 1], [.14127106964588165, .1232977956533432, .09383652359247208], [.271660715341568, .30946892499923706, .13677720725536346]]) {
    assert.deepEqual(multiply([.7, .5, .9, .2], [...c, 1.25]), [.7 * c[0], .5 * c[1], .9 * c[2], .25]);
  }
  assert.deepEqual(multiply([.7, .5, .9, .2], [-3, .5, 4, -.5]), [0, .25, .9, -.1]);
});

test('prior hooks/cache run once with original receiver and installation is idempotent', () => {
  const m = materials(), renderer = {}, calls = [];
  for (const material of [m.bark, m.stem]) {
    material.onBeforeCompile = function(shader, actualRenderer) { assert.equal(this, material); assert.equal(actualRenderer, renderer); calls.push(this.name); shader.uniforms.original = { value: 7 }; };
    material.customProgramCacheKey = function() { return 'original:' + this.name; };
  }
  installVegetationWoodStability(m);
  const first = [m.bark, m.stem].map(material => [material.onBeforeCompile, material.customProgramCacheKey, material.version]);
  installVegetationWoodStability(m);
  for (const [i, material] of [m.bark, m.stem].entries()) {
    assert.deepEqual([material.onBeforeCompile, material.customProgramCacheKey, material.version], first[i]);
    const shader = fresh(); material.onBeforeCompile(shader, renderer);
    assert.equal(shader.uniforms.original.value, 7);
    assert.equal(shader.fragmentShader.includes('willow-bark-bump-guard-r1'), material === m.bark);
    assert(material.customProgramCacheKey().startsWith('original:' + material.name));
  }
  assert.equal(calls.length, 2);
  assert.notEqual(m.bark.customProgramCacheKey(), m.stem.customProgramCacheKey());
  m.bark.dispose(); m.stem.dispose(); m.grain.dispose();
});

test('both selections validate before mutation and normalMap/leaf material are rejected', () => {
  const m = materials(), initial = [m.bark.onBeforeCompile, m.bark.customProgramCacheKey, m.bark.version];
  const leaf = new THREE.MeshStandardMaterial({ name: 'yuanming-leaf-lamina', vertexColors: true });
  assert.throws(() => installVegetationWoodStability({ bark: m.bark, stem: leaf }), /expected builder wood/);
  assert.deepEqual([m.bark.onBeforeCompile, m.bark.customProgramCacheKey, m.bark.version], initial);
  m.stem.normalMap = new THREE.Texture();
  assert.throws(() => installVegetationWoodStability(m), /original bump-map scope/);
  assert.deepEqual([m.bark.onBeforeCompile, m.bark.customProgramCacheKey, m.bark.version], initial);
  m.stem.normalMap.dispose(); leaf.dispose(); m.bark.dispose(); m.stem.dispose(); m.grain.dispose();
});

test('missing/duplicate shader markers fail atomically and prior hook errors propagate', () => {
  const shader = fresh(); shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', '');
  const before = shader.fragmentShader;
  assert.throws(() => patchVegetationWoodShader(shader, { bump: true }), /expected one shader marker/);
  assert.equal(shader.fragmentShader, before);
  const duplicate = fresh(); duplicate.fragmentShader += '\n#include <color_fragment>';
  assert.throws(() => patchVegetationWoodShader(duplicate), /expected one shader marker/);
  const m = materials(), error = new Error('existing compile failure');
  m.bark.onBeforeCompile = () => { throw error; };
  installVegetationWoodStability(m);
  assert.throws(() => m.bark.onBeforeCompile(fresh(), {}), actual => actual === error);
  m.bark.dispose(); m.stem.dispose(); m.grain.dispose();
});

test('maps, PBR, geometry, leaf/petal/pine materials and resource ownership remain unchanged', () => {
  const m = materials();
  const leaves = new THREE.MeshStandardMaterial({ name: 'yuanming-leaf-lamina', vertexColors: true, roughness: .77, emissive: '#263724', emissiveIntensity: .045, side: THREE.DoubleSide });
  const petals = new THREE.MeshStandardMaterial({ name: 'yuanming-lotus-petal-silk', vertexColors: true, roughness: .64, side: THREE.DoubleSide });
  const normal = new THREE.Texture(), pineBark = new THREE.MeshStandardMaterial({ name: 'yuanming-pine-longitudinal-fissures-and-flaking-plates', vertexColors: true, normalMap: normal, roughness: 1 });
  Object.assign(m, { leaves, petals, pineBark });
  const others = [leaves, petals, pineBark], beforeOthers = others.map(x => [x.onBeforeCompile, x.customProgramCacheKey, x.version, x.toJSON()]);
  const before = [m.bark, m.stem].map(x => x.toJSON());
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const mesh = new THREE.Mesh(geometry, m.bark), positions = geometry.attributes.position.array;
  let disposed = 0; [geometry, m.grain, m.bark, m.stem].forEach(x => x.addEventListener('dispose', () => disposed++));
  installVegetationWoodStability(m);
  assert.deepEqual([m.bark, m.stem].map(x => x.toJSON()), before);
  assert.deepEqual(others.map(x => [x.onBeforeCompile, x.customProgramCacheKey, x.version, x.toJSON()]), beforeOthers);
  assert.equal(mesh.geometry, geometry); assert.equal(geometry.attributes.position.array, positions);
  assert.equal(m.bark.map, m.grain); assert.equal(m.bark.bumpMap, m.grain);
  assert.equal(disposed, 0);
  [geometry, m.grain, m.bark, m.stem, ...others, normal].forEach(x => x.dispose());
  assert.equal(disposed, 4);
});
