import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { WebGLProgram } from 'three/src/renderers/webgl/WebGLProgram.js';
import { createWillowSourceFixture } from './helpers/willow-lod-source-fixture.js';
import { willowTriangleRecords, willowSourceTriangles, willowSurfaceMoments, willowPixelInterpolationProbe } from './helpers/willow-lod-appearance.js';
import { createWillowMidLeaf, buildWillowFoliageLevels } from '../src/yuanmingyuan/willow-lod-geometry.js';
import { enableWillowLodCoverage, willowCoverageAt } from '../src/yuanmingyuan/willow-lod-runtime.js';
import { WILLOW_SAMPLING_MODES, setWillowSampling } from '../src/yuanmingyuan/willow-distance-sampling.js';

let fixture, midLeaf, levels, sourceTriangles;
before(async () => {
  fixture = await createWillowSourceFixture({ minimumLeaves: 128 }); midLeaf = await createWillowMidLeaf(fixture.leaf);
  levels = buildWillowFoliageLevels(fixture.leaves, { sourceRoot: fixture.group, sourceLeaf: fixture.leaf, midLeaf }); sourceTriangles = willowSourceTriangles(fixture);
});
after(() => { levels?.mid.dispose(); levels?.far.dispose(); midLeaf?.dispose(); fixture?.dispose(); });

test('mid retains the source midrib colour field, balanced normals and projected area', () => {
  const source = willowSurfaceMoments(willowTriangleRecords(fixture.leaf)), mid = willowSurfaceMoments(willowTriangleRecords(midLeaf));
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(mid.areaMeanColor[c] / source.areaMeanColor[c] - 1) < .001, 'dark edges cannot stand in for the bright midrib');
  assert.ok(new THREE.Vector3(...source.areaMeanNormal).distanceTo(new THREE.Vector3(...mid.areaMeanNormal)) < .002);
  assert.ok(Math.abs(mid.projectedArea / source.projectedArea - 1) < .005);
  assert.ok(midLeaf.userData.measuredSurfaceError.maximum < .0006);
  const broken = fixture.leaf.clone(); broken.index.setX(2, 1);
  return assert.rejects(createWillowMidLeaf(broken), /topology/).finally(() => broken.dispose());
});

test('actual shoot poses and source tint survive colour/normal packing without clipping or average darkening', () => {
  const view = new THREE.Vector3(.22, .08, 1), source = willowSurfaceMoments(sourceTriangles, { view }), mid = willowSurfaceMoments(willowTriangleRecords(levels.mid), { view });
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(mid.areaMeanColor[c] / source.areaMeanColor[c] - 1) < .002);
  assert.ok(Math.abs(mid.projectedArea / source.projectedArea - 1) < .01);
  assert.ok(Math.abs(mid.projectedLambertMean / source.projectedLambertMean - 1) < .01);
  let vertex = 0;
  for (const mesh of fixture.leaves) for (let instance = 0; instance < mesh.count; instance++) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(instance, matrix); const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), tint = new THREE.Vector3().fromBufferAttribute(mesh.instanceColor, instance);
    for (let i = 0; i < midLeaf.attributes.position.count; i++, vertex++) {
      const expected = new THREE.Vector3().fromBufferAttribute(midLeaf.attributes.color, i).multiply(tint), actual = new THREE.Vector3().fromBufferAttribute(levels.mid.attributes.color, vertex);
      assert.ok(expected.toArray().every(x => x > 0 && x < 1));
      assert.ok(expected.clone().sub(actual).toArray().every(x => Math.abs(x) <= .5 / 255 + 1e-9));
      const n = new THREE.Vector3().fromBufferAttribute(midLeaf.attributes.normal, i).applyMatrix3(normalMatrix).normalize(), actualN = new THREE.Vector3().fromBufferAttribute(levels.mid.attributes.normal, vertex).normalize();
      assert.ok(n.angleTo(actualN) < .00004);
    }
  }
  assert.equal(levels.diagnostics.unrepresentedSourceLeaves, 0);
});

test('bounded real source leaves expose MSAA extrapolation; covered interior interpolation keeps the authored colour range', () => {
  const camera = new THREE.PerspectiveCamera(38, 2375 / 2200, 15, 2500);
  camera.position.set(160.8703750432003, 47.973738648145556, 731.2289774690923); camera.lookAt(0, 4.1, 0);
  for (const phase of [[0, 0], [.25, .25], [.5, 0], [0, .5]]) {
    const result = willowPixelInterpolationProbe(sourceTriangles, camera, { phase });
    assert.ok(result.coveredSamples > 0); assert.ok(result.centre.rgbOutOfUnitRangeSamples > 0);
    assert.equal(result.coveredInterior.rgbOutOfUnitRangeSamples, 0);
    assert.ok(result.coveredInterior.vertexRangeOvershoot.maximum < 1e-10);
    assert.equal(result.actualGpuResult, false); assert.equal(result.samplePatternIsMeasuredFromBrowser, false);
  }
});

function assembleWithThree(material, shaderName) {
  const shader = { vertexShader: THREE.ShaderLib[shaderName].vertexShader, fragmentShader: THREE.ShaderLib[shaderName].fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, null);
  // Exercise Three's actual include expansion and WebGL2 prefix emitter. These
  // GL calls only record text; they intentionally do NOT simulate compilation.
  const submitted = new Map(), gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
    createProgram: () => ({}), createShader: type => ({ type }), shaderSource: (handle, text) => submitted.set(handle.type, text),
    compileShader() {}, attachShader() {}, bindAttribLocation() {}, linkProgram() {}, deleteProgram() {},
  };
  const parameters = {
    ...shader, shaderType: material.type, shaderName: 'willow-centroid-cpu-assembly', defines: {}, precision: 'highp', isRawShaderMaterial: false,
    vertexColors: true, vertexAlphas: false, instancing: true, instancingColor: true, doubleSided: true, hasPositionAttribute: true,
    envMapCubeUVHeight: null, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace,
    numDirLights: 1, numSpotLights: 0, numSpotLightMaps: 0, numRectAreaLights: 0, numPointLights: 0, numHemiLights: 1,
    numDirLightShadows: 0, numSpotLightShadows: 0, numSpotLightShadowsWithMaps: 0, numPointLightShadows: 0, numClippingPlanes: 0, numClipIntersection: 0,
  };
  const program = new WebGLProgram({ getContext: () => gl }, material.customProgramCacheKey(), parameters, { releaseStatesOfProgram() {} }); program.destroy();
  return { vertex: submitted.get(gl.VERTEX_SHADER), fragment: submitted.get(gl.FRAGMENT_SHADER) };
}

test('Three r185 emits matching WebGL2 centroid interfaces while leaving fading and pixel baseline unchanged', async () => {
  const assembly = [];
  for (const [Material, name] of [[THREE.MeshStandardMaterial, 'standard'], [THREE.MeshNormalMaterial, 'normal']]) {
    const material = enableWillowLodCoverage(new Material({ side: THREE.DoubleSide }));
    try {
      const keys = [];
      for (const mode of WILLOW_SAMPLING_MODES) {
        setWillowSampling(material, mode); const version = material.version; setWillowSampling(material, mode); assert.equal(material.version, version);
        keys.push(material.customProgramCacheKey()); const code = assembleWithThree(material, name);
        for (const [stage, text] of Object.entries(code)) {
          assert.ok(text.startsWith('#version 300 es\n')); assert.ok(text.includes(`#define varying ${stage === 'vertex' ? 'out' : 'in'}`));
          assert.ok(text.includes('vWillowLodFade')); assert.ok(!text.includes('centroid varying vec2 vWillowLodFade'));
          if (name === 'standard') assert.equal(text.includes('centroid varying vec4 vColor;'), mode !== 'pixel');
          assert.equal(text.includes('centroid varying vec3 vNormal;'), mode === 'centroid');
          if (mode === 'pixel') assert.ok(!text.includes('centroid varying'));
          if (stage === 'fragment') assert.ok(text.includes('floor(gl_FragCoord.xy)'));
          if (process.env.WILLOW_SHADER_ASSEMBLY_DIR) { await mkdir(process.env.WILLOW_SHADER_ASSEMBLY_DIR, { recursive: true }); await writeFile(`${process.env.WILLOW_SHADER_ASSEMBLY_DIR}/${name}-${mode}.${stage}.glsl`, text); }
        }
        assembly.push({ material: name, mode, vertexBytes: code.vertex.length, fragmentBytes: code.fragment.length, assembledBy: 'actual Three WebGLProgram with text-recording GL sink', gpuCompiled: false });
      }
      assert.equal(new Set(keys).size, 3); assert.throws(() => setWillowSampling(material, 'bright'), /Unknown/);
    } finally { material.dispose(); }
  }
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) assert.notEqual(willowCoverageAt(x, y, .5, 1), willowCoverageAt(x, y, .5, -1));
  if (process.env.WILLOW_SHADER_ASSEMBLY_DIR) await writeFile(`${process.env.WILLOW_SHADER_ASSEMBLY_DIR}/assembly.json`, JSON.stringify(assembly, null, 2) + '\n');
});

test('studio applies one visible sampling condition to every foliage tier and records actual linked-program evidence', async () => {
  const main = await readFile(new URL('../src/yuanmingyuan/willow-distance-studio.js', import.meta.url), 'utf8');
  assert.match(main, /for \(const root of \[source\.group, pilot\.group\]\)/);
  assert.match(main, /post\.setSampling\(sampling\)/); assert.match(main, /samplingPrograms: disposed \? \[\] : willowSamplingProgramAudit\(renderer\)/);
  assert.match(main, /setSampling\(\{ pause: false \}\)/);
});
