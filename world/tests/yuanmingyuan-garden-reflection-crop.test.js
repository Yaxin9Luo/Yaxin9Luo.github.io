import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepareGardenReflectionViews } from '../src/yuanmingyuan/garden-reflection-views.js';
import { attachMuseumMultiDrawCulling } from '../src/yuanmingyuan/museum-multidraw-culling.js';
import { createMuseumLandscape } from '../src/yuanmingyuan/museum-landscape.js';
import { museumSite } from '../src/yuanmingyuan/museum-sites.js';
import { triangulateSurface } from '../src/yuanmingyuan/terrain-geometry.js';
import { prepareGardenReflectionCrop as projectReflectionSampleWindow, gardenReflectionCullingProjection as cullingProjection, gardenRippleUvLimit as rippleUvLimit, withGardenReflectionCrop, gardenReflectionCropForDraw } from '../src/yuanmingyuan/garden-reflection-crop.js';
import { createGardenWater } from '../src/yuanmingyuan/garden-water.js';
function bilinearTexels(uv,width,height){const x=Math.floor(uv[0]*width-.5),y=Math.floor(uv[1]*height-.5);return [[x,y],[x+1,y],[x,y+1],[x+1,y+1]].map(([a,b])=>[Math.max(0,Math.min(width-1,a)),Math.max(0,Math.min(height-1,b))]);}

const output = { threeRevision: T.REVISION, gpuUsed: false, productionModified: false, fullFactoriesConstructed: 0, realReflectorCallbacks: 0, windows: [], coverage: { rayPlaneSamples: 0, bilinearTexels: 0, missedTexels: 0 }, actualHaiyue: null, culling: null, boundary: [], scissorState: null };
const productionPaths = ['garden-water.js', 'garden-reflection-views.js', 'museum-multidraw-culling.js'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBefore = Object.fromEntries(await Promise.all(productionPaths.map(async name => [name, sha(await readFile(new URL('../src/yuanmingyuan/' + name, import.meta.url)))])));
const camera = (position = [0, 10, 40], target = [0, 0, 0], opts = {}) => {
  const c = opts.ortho ? new T.OrthographicCamera(-18, 18, 13, -13, opts.near ?? .08, 22000) : new T.PerspectiveCamera(45, 3200 / 2200, opts.near ?? .08, 22000);
  c.position.fromArray(position); c.lookAt(...target);
  if (opts.offset) c.setViewOffset(3600, 2500, 120, 75, 3200, 2200);
  c.updateMatrixWorld(true); return c;
};
function makeSheet(y = 0, radius = 2.13) {
  const geometry = new T.CircleGeometry(radius, 64), sheet = new Reflector(geometry, { textureWidth: 2048, textureHeight: 2048, multisample: 4, clipBias: .0002 });
  sheet.rotation.x = -Math.PI / 2; sheet.position.y = y + .006; sheet.updateMatrixWorld(true);
  return { sheet, dispose() { sheet.dispose(); geometry.dispose(); } };
}
function realCallback(sheet, c, { targetWindow = null, fail = false, nestedShadow = false } = {}) {
  const originalTarget = new T.WebGLRenderTarget(128, 96), shadowTarget = new T.WebGLRenderTarget(64, 64), reflectionTarget = sheet.getRenderTarget();
  originalTarget.scissor.set(3, 5, 100, 80); originalTarget.scissorTest = true;
  let currentTarget = originalTarget, scissor = originalTarget.scissor.toArray(), scissorTest = true, viewport = originalTarget.viewport.toArray(), capture = null;
  const original = { scissor: reflectionTarget.scissor.clone(), scissorTest: reflectionTarget.scissorTest };
  const renderer = {
    xr: { enabled: true }, shadowMap: { autoUpdate: true, needsUpdate: false }, autoClear: false,
    state: { buffers: { depth: { setMask() {} } }, viewport(v) { viewport = v.toArray(); } },
    getRenderTarget: () => currentTarget,
    setRenderTarget(target) { currentTarget = target; viewport = target.viewport.toArray(); scissor = target.scissor.toArray(); scissorTest = target.scissorTest; },
    clear() { assert.deepEqual(scissor, reflectionTarget.scissor.toArray()); },
    render(scene, reflected) {
      output.realReflectorCallbacks++;
      capture = { camera: reflected, projection: reflected.projectionMatrix.toArray(), world: reflected.matrixWorld.toArray(), inverseWorld: reflected.matrixWorldInverse.toArray(), textureMatrix: sheet.material.uniforms.textureMatrix.value.clone(), scissor: [...scissor], scissorTest, viewport: [...viewport], xr: renderer.xr.enabled, shadowAuto: renderer.shadowMap.autoUpdate };
      if (nestedShadow) {
        const previous = currentTarget; renderer.setRenderTarget(shadowTarget);
        capture.shadowTarget = { viewport: [...viewport], scissor: [...scissor], scissorTest };
        renderer.setRenderTarget(previous);
      }
      if (fail) throw new Error('fixture-reflection-failure');
    },
  };
  const priorVisibility = sheet.visible, priorForce = sheet.forceUpdate;
  try {
    if (targetWindow) { reflectionTarget.scissor.fromArray(targetWindow.rect); reflectionTarget.scissorTest = true; }
    try { sheet.onBeforeRender(renderer, new T.Scene(), c); }
    catch (error) {
      // Same mandatory restoration already implemented by garden-water on error.
      renderer.xr.enabled = true; renderer.shadowMap.autoUpdate = true;
      renderer.setRenderTarget(originalTarget); sheet.visible = priorVisibility; sheet.forceUpdate = priorForce;
      if (!fail) throw error;
    }
  } finally {
    reflectionTarget.scissor.copy(original.scissor); reflectionTarget.scissorTest = original.scissorTest;
    assert.equal(currentTarget, originalTarget); assert.equal(renderer.xr.enabled, true); assert.equal(renderer.shadowMap.autoUpdate, true);
    assert.deepEqual(scissor, originalTarget.scissor.toArray()); assert.equal(scissorTest, true);
    originalTarget.dispose(); shadowTarget.dispose();
  }
  return capture;
}
function actualWindow(sheet, c, options = {}) {
  const predicted = prepareGardenReflectionViews([sheet], c)[0], actual = realCallback(sheet, c);
  if (!predicted) { assert.equal(actual, null); return null; }
  assert.deepEqual(predicted.camera.projectionMatrix.toArray(), actual.projection);
  assert.deepEqual(predicted.camera.matrixWorld.toArray(), actual.world);
  const before = actual.camera.projectionMatrix.toArray(), window = projectReflectionSampleWindow(sheet, c, actual.camera, { mainViewportWidth: 3200, mainViewportHeight: 2200, ...options });
  assert.deepEqual(actual.camera.projectionMatrix.toArray(), before);
  return { actual, window };
}

// Independent probes: ray/actual triangle plane -> actual stock textureMatrix.
// No window-prototype homography is used to determine the sampled coordinates.
function checkCoverage(sheet, c, actual, window, waveScale = .72) {
  if (window.kind !== 'window') return;
  const p = sheet.geometry.getAttribute('position'), index = sheet.geometry.index, count = index?.count ?? p.count, inverse = sheet.matrixWorld.clone().invert();
  const ray = new T.Raycaster(), plane = new T.Plane(), corners = [new T.Vector3(), new T.Vector3(), new T.Vector3()], offsets = [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]], local = new T.Vector4();
  const ripple = rippleUvLimit(waveScale), [x, y, w, h] = window.rect;
  for (let offset = 0; offset < count; offset += Math.max(3, Math.floor(count / 48 / 3) * 3)) {
    for (let i = 0; i < 3; i++) corners[i].fromBufferAttribute(p, index ? index.getX(offset + i) : offset + i).applyMatrix4(sheet.matrixWorld);
    plane.setFromCoplanarPoints(...corners);
    for (const weights of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.33, .34, .33], [.05, .90, .05]]) {
      const world = new T.Vector3(); corners.forEach((v, i) => world.addScaledVector(v, weights[i])); const ndc = world.clone().project(c);
      for (const [dx, dy] of offsets) {
        ray.setFromCamera(new T.Vector2(ndc.x + dx * 2 / 3200, ndc.y + dy * 2 / 2200), c);
        const hit = ray.ray.intersectPlane(plane, new T.Vector3()); if (!hit) continue;
        hit.applyMatrix4(inverse); local.set(hit.x, hit.y, hit.z, 1).applyMatrix4(actual.textureMatrix);
        assert.ok(local.w > 0); output.coverage.rayPlaneSamples++;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const uv = [Math.max(.001, Math.min(.999, local.x / local.w + sx * ripple)), Math.max(.001, Math.min(.999, local.y / local.w + sy * ripple))];
          for (const [px, py] of bilinearTexels(uv, 2048, 2048)) {
            output.coverage.bilinearTexels++;
            if (!(px >= x && px < x + w && py >= y && py < y + h)) output.coverage.missedTexels++;
            assert.ok(px >= x && px < x + w && py >= y && py < y + h, JSON.stringify({ uv, px, py, rect: window.rect }));
          }
        }
      }
    }
  }
}

// Float32 uniform upload and both common matrix association orders. These are
// arithmetic probes, not a substitute for the pending native GL comparison.
function float32Probe(sheet, c, actual) {
  const multiply = (matrix, values) => Array.from({ length: 4 }, (_, row) => {
    let sum = 0; for (let column = 0; column < 4; column++) sum = Math.fround(sum + Math.fround(Math.fround(matrix.elements[column * 4 + row]) * Math.fround(values[column]))); return sum;
  });
  const compose = (a, b) => { const m = new T.Matrix4(); for (let column = 0; column < 4; column++) { const values = multiply(a, b.elements.slice(column * 4, column * 4 + 4)); for (let row = 0; row < 4; row++) m.elements[column * 4 + row] = values[row]; } return m; };
  const main = new T.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse).multiply(sheet.matrixWorld), pv = compose(c.projectionMatrix, c.matrixWorldInverse), p = sheet.geometry.attributes.position;
  let mirrorTexelError = 0, mainNdcInReflectionPixels = 0;
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i), p.getY(i), p.getZ(i), 1], exact = new T.Vector4(...v).applyMatrix4(actual.textureMatrix), rounded = multiply(actual.textureMatrix, v), q = new T.Vector4(...v).applyMatrix4(main), world = multiply(sheet.matrixWorld, v);
    for (const axis of [0, 1]) mirrorTexelError = Math.max(mirrorTexelError, Math.abs(Math.fround(rounded[axis] / rounded[3]) - exact.getComponent(axis) / exact.w) * 2048);
    for (const value of [multiply(pv, world), multiply(c.projectionMatrix, multiply(c.matrixWorldInverse, world))]) for (const axis of [0, 1]) mainNdcInReflectionPixels = Math.max(mainNdcInReflectionPixels, Math.abs(Math.fround(value[axis] / value[3]) - q.getComponent(axis) / q.w) * 1024);
  }
  assert.ok(mirrorTexelError + mainNdcInReflectionPixels < 1, 'The tested actual world coordinate magnitudes fit within the additional numeric guard.');
  return { vertices: p.count, mirrorTexelError, mainNdcInReflectionPixels, totalMeasuredErrorBelowNumericPixelGuard: true };
}

test('15 actual r185 callbacks at three heights retain P/texture UV and contain ray-plane + raster + ripple + bilinear probes', () => {
  for (const y of [0, 2, 3.7]) {
    const f = makeSheet(y);
    try {
      for (const [name, c] of [['front', camera([0, y + 10, 40], [0, y, 0])], ['oblique', camera([20, y + 8, 30], [0, y, 0])], ['offset', camera([0, y + 8, 40], [0, y, 0], { offset: true })], ['ortho', camera([0, y + 10, 40], [0, y, 0], { ortho: true })], ['near-cross', camera([0, y + 1, 5], [0, y, 0], { near: 4.5 })]]) {
        const { actual, window } = actualWindow(f.sheet, c); assert.equal(window.kind, 'window');
        checkCoverage(f.sheet, c, actual, window);
        const p = f.sheet.geometry.getAttribute('position'), matrix = new T.Matrix4().multiplyMatrices(actual.camera.projectionMatrix, actual.camera.matrixWorldInverse).multiply(f.sheet.matrixWorld);
        let uvDifference = 0;
        for (let i = 0; i < p.count; i++) { const local = new T.Vector4(p.getX(i), p.getY(i), p.getZ(i), 1), q = local.clone().applyMatrix4(matrix), r = local.applyMatrix4(actual.textureMatrix); uvDifference = Math.max(uvDifference, Math.abs(.5 * q.x / q.w + .5 - r.x / r.w), Math.abs(.5 * q.y / q.w + .5 - r.y / r.w)); }
        assert.ok(uvDifference < 2e-12); output.windows.push({ name, planeY: y + .006, window, maximumTextureUvDifference: uvDifference });
      }
    } finally { f.dispose(); }
  }
});

test('actual Yangquelong basin polygons with captured Haiyue camera produce tiny conservative windows', async () => {
  const capturePath = '../production-v3/captures/museum-world-baae58ac609ba7d3-haiyue-kaijin-1789172149366-3.json';
  const capture = JSON.parse(await readFile(new URL(capturePath.replace('../production-v3', '../../work/production-v3'), import.meta.url)));
  const layout = createMuseumLandscape({ sites: [museumSite('yangquelong')] }), levels = new Map();
  for (const court of layout.courts) { const water = court.water; if (!levels.has(water.surfaceY)) levels.set(water.surfaceY, []); levels.get(water.surfaceY).push({ name: court.id, polygon: water.surfacePolygon }); }
  const results = [], c = camera(capture.camera, capture.target);
  for (const [level, polygons] of levels) {
    const inputs = polygons.map(({ polygon }) => triangulateSurface([{ outer: polygon, holes: [] }], { heightAt: () => 0, edgeLength: Infinity })), geometry = mergeGeometries(inputs).rotateX(Math.PI / 2);
    const sheet = new Reflector(geometry, { textureWidth: 2048, textureHeight: 2048, multisample: 4, clipBias: .0002 }); sheet.rotation.x = -Math.PI / 2; sheet.position.y = level + .006; sheet.updateMatrixWorld(true);
    try { const { actual, window } = actualWindow(sheet, c); assert.equal(window.kind, 'window'); checkCoverage(sheet, c, actual, window); results.push({ level, sourcePolygons: polygons, window, float32Arithmetic: float32Probe(sheet, c, actual) }); }
    finally { sheet.dispose(); geometry.dispose(); inputs.forEach(g => g.dispose()); }
  }
  output.actualHaiyue = { nativeCapture: capturePath, sourceTag: capture.sourceTag, camera: capture.camera, target: capture.target, projectionFov: 45, projectionNear: .08, projectionFar: 22000, dimensions: capture.canvas, observedTrianglesPerFrame: capture.render.triangles, note: 'Camera position/target and canvas come from saved native evidence; FOV/near/far come from current museum-scene source. Only the small actual polygons were constructed; no full garden/building was loaded.', levels: results };
});

test('captured Xian camera inverse roundoff retains the actual Reflector sample envelope without rewriting matrices', async () => {
  const capturePath = '../../work/production-v3/captures/museum-world-19f4443e28771df2-xianfashan-1789176741086-2.json';
  const capture = JSON.parse(await readFile(new URL(capturePath, import.meta.url))), c = camera(capture.camera, capture.target), results = [];
  assert.equal(c.matrixWorld.elements[15], 1);
  assert.notEqual(c.matrixWorldInverse.elements[15], 1, 'The captured pose must actually exercise Three inversion roundoff.');
  for (const level of [0, 2, 3.7, 4.17]) {
    const f = makeSheet(level, 1.065);
    f.sheet.position.x = capture.target[0]; f.sheet.position.z = capture.target[2]; f.sheet.updateMatrixWorld(true);
    try {
      const predicted = prepareGardenReflectionViews([f.sheet], c)[0], actual = realCallback(f.sheet, c);
      assert.deepEqual(predicted.camera.matrixWorldInverse.toArray(), actual.inverseWorld);
      const matrices = [f.sheet.matrixWorld, c.matrixWorld, c.matrixWorldInverse, actual.camera.matrixWorld, actual.camera.matrixWorldInverse, c.projectionMatrix, actual.camera.projectionMatrix, actual.textureMatrix];
      const before = matrices.map(matrix => matrix.toArray()), options = { mainViewportWidth: capture.canvas.width, mainViewportHeight: capture.canvas.height };
      const window = projectReflectionSampleWindow(f.sheet, c, actual.camera, options);
      assert.equal(window.kind, 'window');
      checkCoverage(f.sheet, c, actual, window);
      assert.deepEqual(matrices.map(matrix => matrix.toArray()), before);
      // Positive homogeneous rescaling is an independent, equivalent view.
      // It must not be needed in production: actual uploaded matrices stay intact.
      const normalizedMain = c.clone(), normalizedMirror = actual.camera.clone();
      normalizedMain.matrixWorldInverse.multiplyScalar(1 / c.matrixWorldInverse.elements[15]);
      normalizedMirror.matrixWorldInverse.multiplyScalar(1 / actual.camera.matrixWorldInverse.elements[15]);
      assert.deepEqual(projectReflectionSampleWindow(f.sheet, normalizedMain, normalizedMirror, options).rect, window.rect);
      const cropped = realCallback(f.sheet, c, { targetWindow: window });
      assert.deepEqual(cropped.projection, actual.projection); assert.deepEqual(cropped.world, actual.world); assert.deepEqual(cropped.inverseWorld, actual.inverseWorld); assert.deepEqual(cropped.textureMatrix.toArray(), actual.textureMatrix.toArray());
      results.push({ level, bottomRows: before.slice(0, 5).map(values => [3, 7, 11, 15].map(i => values[i])), window, float32Arithmetic: float32Probe(f.sheet, c, actual) });
    } finally { f.dispose(); }
  }
  output.inverseRoundoff = { nativeCapture: capturePath, sourceTag: capture.sourceTag, camera: capture.camera, target: capture.target, note: 'Captured main camera pose, actual r185 inverse and Reflector callbacks; small diagnostic circles at the four real water elevations. No claim that the large lakes can be cropped.', results };
});

test('homogeneous-affine inverse support retains exact projective, singular, nonfinite and world-matrix fallbacks', () => {
  const f = makeSheet(), c = camera(), actual = realCallback(f.sheet, c), options = { mainViewportWidth: 3200, mainViewportHeight: 2200 };
  const matrices = [f.sheet.matrixWorld, c.matrixWorld, c.matrixWorldInverse, actual.camera.matrixWorld, actual.camera.matrixWorldInverse];
  let rejected = 0;
  try {
    for (const [matrixIndex, matrix] of matrices.entries()) {
      const original = matrix.clone();
      for (const axis of [3, 7, 11]) for (const value of [1e-20, -1e-20, 1]) {
        matrix.elements[axis] = value;
        assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).reason, 'nonfinite-or-nonaffine-world-matrix'); rejected++; matrix.copy(original);
      }
      for (const value of [0, -1, NaN, Infinity]) {
        matrix.elements[15] = value;
        assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).reason, 'nonfinite-or-nonaffine-world-matrix'); rejected++; matrix.copy(original);
      }
      matrix.multiplyScalar(0);
      assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).reason, 'nonfinite-or-nonaffine-world-matrix'); rejected++; matrix.copy(original);
      matrix.elements[0] = 1e308; matrix.elements[5] = 1e308;
      assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).reason, 'nonfinite-or-nonaffine-world-matrix'); rejected++; matrix.copy(original);
      if ([0, 1, 3].includes(matrixIndex)) {
        matrix.elements[15] = 1 + Number.EPSILON;
        assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).reason, 'nonfinite-or-nonaffine-world-matrix'); rejected++; matrix.copy(original);
      }
    }
    assert.equal(projectReflectionSampleWindow(f.sheet, c, actual.camera, options).kind, 'window');
    output.affineGuard = { unsafeMatrixCasesRejected: rejected, projectiveTolerance: 0, sourceWorldStillRequiresCanonicalW: true, originalMatricesRetained: true };
  } finally { f.dispose(); }
});

test('w-zero/horizon/backface/forceUpdate/filter/viewport/NaN and offscreen clamp boundaries remain conservative', () => {
  const f = makeSheet(0);
  try {
    for (const [name, c, expected] of [['w-zero', camera([0, .1, .15], [0, 0, -1]), 'full'], ['horizon', camera([0, .006, 40], [0, .006, 0]), 'full'], ['offscreen-positive-w', camera([45, 10, 40], [45, 0, 0]), 'window']]) {
      const result = actualWindow(f.sheet, c); assert.equal(result.window.kind, expected); output.boundary.push({ name, window: result.window });
      if (name === 'offscreen-positive-w') { assert.ok(result.window.rawUv.min[0] > 1 || result.window.rawUv.max[0] < 0); assert.ok(result.window.rect[2] >= 4); checkCoverage(f.sheet, c, result.actual, result.window); }
    }
    const below = camera([0, -2, 40]); assert.equal(actualWindow(f.sheet, below), null);
    f.sheet.forceUpdate = true; const forced = actualWindow(f.sheet, below); assert.ok(forced.actual); assert.equal(f.sheet.forceUpdate, false); output.boundary.push({ name: 'forced-backface', window: forced.window });
    const c = camera(), actual = realCallback(f.sheet, c), texture = f.sheet.getRenderTarget().texture, options = { mainViewportWidth: 3200, mainViewportHeight: 2200 };
    texture.minFilter = T.LinearMipmapLinearFilter; let result = projectReflectionSampleWindow(f.sheet, c, actual.camera, options); assert.equal(result.reason, 'unbounded-or-unsupported-filter-footprint'); output.boundary.push({ name: 'mipmap-filter', window: result }); texture.minFilter = T.LinearFilter;
    f.sheet.getRenderTarget().viewport.z = 512; result = projectReflectionSampleWindow(f.sheet, c, actual.camera, options); assert.equal(result.reason, 'non-full-reflection-viewport'); output.boundary.push({ name: 'changed-viewport', window: result }); f.sheet.getRenderTarget().viewport.z = 2048;
    f.sheet.geometry.attributes.position.setX(0, NaN); result = projectReflectionSampleWindow(f.sheet, c, actual.camera, options); assert.equal(result.kind, 'full'); assert.match(result.reason, /nonfinite/); output.boundary.push({ name: 'nonfinite-position', window: result });
  } finally { f.dispose(); }
});

function clipPolygon(polygon, planes) {
  for (const p of planes) {
    const next = [];
    for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = p.dot(a), db = p.dot(b); if (da >= 0) next.push(a); if ((da >= 0) !== (db >= 0)) next.push(a.clone().lerp(b, da / (da - db))); }
    polygon = next; if (!polygon.length) break;
  }
  return polygon;
}
const drawIds = b => [...b._indirectTexture.image.data.slice(0, b._multiDrawCount)];
const geometryHash = batch => sha(Buffer.concat([...Object.values(batch.geometry.attributes), batch.geometry.index].filter(Boolean).map(attribute => Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).concat([Buffer.from(batch._matricesTexture.image.data.buffer)])));

test('real BatchedMesh hierarchy accepts every independently clipped triangle and preserves main/shadow source bytes and order', async () => {
  const f = makeSheet(), c = camera(), { actual, window } = actualWindow(f.sheet, c), sourceProjection = actual.camera.projectionMatrix.toArray();
  const shape = new T.BoxGeometry(1.2, 2.4, 1.2), material = new T.MeshStandardMaterial(), batch = new T.BatchedMesh(901, shape.attributes.position.count, shape.index.count, material), group = new T.Group(); group.add(batch); batch.sortObjects = false;
  const gid = batch.addGeometry(shape), matrices = [];
  for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) { const id = batch.addInstance(gid), m = new T.Matrix4().compose(new T.Vector3((x - 15) * 4, 1.2 + z % 4, 20 - z * 4), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), x * .031), new T.Vector3(.8 + x % 3 * .2, .6 + z % 3 * .2, 1)); batch.setMatrixAt(id, m); matrices.push(m); }
  const giant = batch.addInstance(gid), giantMatrix = new T.Matrix4().compose(new T.Vector3(0, 1, -30), new T.Quaternion(), new T.Vector3(140, 1, 1)); batch.setMatrixAt(giant, giantMatrix); matrices.push(giantMatrix); group.updateMatrixWorld(true);
  const before = geometryHash(batch), renderer = {}, scene = new T.Scene(), baseline = camera(), shadow = new T.OrthographicCamera(-25, 25, 25, -25, .1, 200); shadow.position.set(0, 80, 40); shadow.lookAt(0, 0, -20); shadow.updateMatrixWorld(true);
  const stock = view => { T.BatchedMesh.prototype.onBeforeRender.call(batch, renderer, scene, view, batch.geometry, material); return drawIds(batch); }, mainIds = stock(baseline), shadowIds = stock(shadow), fullIds = stock(actual.camera);
  const queryCamera = actual.camera.clone(); queryCamera.projectionMatrix.copy(cullingProjection(actual.camera, window, 2048, 2048)); const croppedStock = stock(queryCamera);
  const helper = await attachMuseumMultiDrawCulling(group, { leafSize: 8, viewCacheSize: 3, yieldControl: async () => {} });
  try {
    batch.onBeforeRender(renderer, scene, queryCamera, batch.geometry, material); const cropped = drawIds(batch); assert.deepEqual(cropped, croppedStock); assert.equal(new Set(cropped).size, cropped.length); assert.ok(cropped.length < fullIds.length); assert.ok(cropped.includes(giant), 'A large sphere crossing the window must survive.');
    const [x, y, w, h] = window.rect, l = x / 1024 - 1, r = (x + w) / 1024 - 1, b = y / 1024 - 1, t = (y + h) / 1024 - 1, planes = [new T.Vector4(1, 0, 0, -l), new T.Vector4(-1, 0, 0, r), new T.Vector4(0, 1, 0, -b), new T.Vector4(0, -1, 0, t), new T.Vector4(0, 0, 1, 1), new T.Vector4(0, 0, -1, 1)], selected = new Set(cropped);
    let trianglesWithWindowIntersection = 0, distinctRequired = new Set();
    const p = shape.attributes.position, index = shape.index, pv = new T.Matrix4().multiplyMatrices(actual.camera.projectionMatrix, actual.camera.matrixWorldInverse).multiply(batch.matrixWorld);
    for (let id = 0; id < matrices.length; id++) { const transform = pv.clone().multiply(matrices[id]); for (let offset = 0; offset < index.count; offset += 3) { const polygon = [0, 1, 2].map(i => { const j = index.getX(offset + i); return new T.Vector4(p.getX(j), p.getY(j), p.getZ(j), 1).applyMatrix4(transform); }); if (clipPolygon(polygon, planes).length >= 3) { trianglesWithWindowIntersection++; distinctRequired.add(id); assert.ok(selected.has(id), 'Missing independently clipped geometry instance ' + id); } } }
    for (const row of [2, 3]) for (let column = 0; column < 4; column++) assert.equal(queryCamera.projectionMatrix.elements[column * 4 + row], actual.camera.projectionMatrix.elements[column * 4 + row]);
    batch.onBeforeRender(renderer, scene, baseline, batch.geometry, material); assert.deepEqual(drawIds(batch), mainIds);
    batch.onBeforeShadow(renderer, null, baseline, shadow, batch.geometry, material); assert.deepEqual(drawIds(batch), shadowIds);
    batch.onBeforeRender(renderer, scene, queryCamera, batch.geometry, material); assert.deepEqual(drawIds(batch), cropped);
    assert.deepEqual(actual.camera.projectionMatrix.toArray(), sourceProjection); assert.equal(geometryHash(batch), before);
    output.culling = { instances: matrices.length, fullReflectionDraws: fullIds.length, croppedReflectionDraws: cropped.length, retainedFraction: cropped.length / fullIds.length, independentTriangleIntersections: trianglesWithWindowIntersection, independentlyRequiredInstances: distinctRequired.size, missedInstances: 0, largeSpanningInstanceRetained: true, exactMainDrawSequence: mainIds.length, exactShadowDrawSequence: shadowIds.length, sourceGeometryAndMatricesSHA256: before, sourceBytesUnchanged: true, originalProjectionUnchanged: true, obliqueZWRowsUnchanged: true, hierarchy: helper.snapshot().batches[0], limitation: 'Diagnostic culling-camera clone only; no production scope registry or GPU rendering was implemented.' };
  } finally { helper.dispose(); batch.dispose(); material.dispose(); shape.dispose(); f.dispose(); }
});

test('actual Reflector uses target scissor without cropping projection/viewport; nested shadow target and failure cleanup remain separate', () => {
  const f = makeSheet(), c = camera();
  try {
    const { actual, window } = actualWindow(f.sheet, c), before = f.sheet.getRenderTarget().scissor.toArray(), result = realCallback(f.sheet, c, { targetWindow: window, nestedShadow: true });
    assert.deepEqual(result.projection, actual.projection); assert.deepEqual(result.viewport, [0, 0, 2048, 2048]); assert.deepEqual(result.scissor, window.rect); assert.equal(result.scissorTest, true);
    assert.deepEqual(result.shadowTarget, { viewport: [0, 0, 64, 64], scissor: [0, 0, 64, 64], scissorTest: false }); assert.deepEqual(f.sheet.getRenderTarget().scissor.toArray(), before); assert.equal(f.sheet.getRenderTarget().scissorTest, false);
    realCallback(f.sheet, c, { targetWindow: window, fail: true }); assert.deepEqual(f.sheet.getRenderTarget().scissor.toArray(), before); assert.equal(f.sheet.getRenderTarget().scissorTest, false);
    output.scissorState = { window: window.rect, reflectionViewport: result.viewport, originalProjectionUnchanged: true, actualStockCallbackObserved: true, nestedShadowTarget: result.shadowTarget, targetSettingsRestoredAfterSuccessAndFailure: true, rendererStateProof: 'Faithful CPU state stub plus direct inspection of r185 setRenderTarget/WebGLShadowMap/resolve; not a GL execution proof.' };
  } finally { f.dispose(); }
});

function waterHarness(t) {
  const sources = [-4.85, 4.85].map(z => ({ geometry: new T.CircleGeometry(1.065, 64).rotateX(-Math.PI / 2).translate(-6.6, 0, z), worldY: 4.17 }));
  const coast = [[-20, -20], [20, -20], [20, 20], [-20, 20]], water = createGardenWater({ terrain: { waterSurfaces: sources, coastPolygon: coast }, layout: { exhibition: { seaY: 0, coast: { polygon: coast } } } });
  const scene = new T.Scene(), main = new T.WebGLRenderTarget(3200, 2200), shadowTarget = new T.WebGLRenderTarget(256, 256), c = camera([0, 16, 40]), viewport = main.viewport.clone(), calls = []; scene.add(water.group); scene.updateMatrixWorld(true);
  let target = main;
  const renderer = { xr: { enabled: true }, shadowMap: { autoUpdate: false, needsUpdate: false }, autoClear: false,
    state: { buffers: { depth: { setMask() {} } }, viewport: value => viewport.copy(value) },
    getRenderTarget: () => target, getCurrentViewport: value => value.copy(viewport), getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget(value) { target = value; viewport.copy(value.viewport); }, clear() {},
    render(renderScene, renderCamera) { const crop = gardenReflectionCropForDraw(renderer, renderCamera), call = { crop: crop && [...crop.rect], projection: renderCamera.projectionMatrix.toArray(), world: renderCamera.matrixWorld.toArray(), viewport: target.viewport.toArray(), scissor: target.scissor.toArray(), scissorTest: target.scissorTest, size: [target.width, target.height], textureMatrix: water.sheets[0].material.uniforms.textureMatrix.value.toArray() }; calls.push(call); renderer.duringRender?.(renderScene, renderCamera, call); },
  };
  const sample = { lightDirection: new T.Vector3(1, 1, 1).normalize(), key: new T.Color(1, 1, 1), keyIntensity: 3, night: 0, water: new T.Color(.3, .5, .4) };
  const update = () => water.update(12, sample, c), draw = () => { const sheet = water.sheets[0]; sheet.onBeforeRender(renderer, scene, c, sheet.geometry, sheet.material); };
  t.after(() => { water.dispose(); sources.forEach(s => s.geometry.dispose()); main.dispose(); shadowTarget.dispose(); });
  return { water, scene, main, shadowTarget, camera: c, renderer, calls, update, draw };
}

test('default-off and same-epoch full/crop/full toggles preserve actual camera and texture UV; resize/wave/geometry invalidates cropped cache', t => {
  const f = waterHarness(t), sheet = f.water.sheets[0]; assert.equal(f.water.snapshot().reflectionCropEnabled, false); assert.equal(sheet.geometry.index.count / 3, 128, 'Both circles must remain in the actual merged water sheet.');
  f.update(); f.draw(); f.draw(); assert.equal(f.calls.length, 1); const full = f.calls[0]; assert.equal(full.crop, null);
  f.water.setReflectionCropEnabled(true); f.draw(); f.draw(); assert.equal(f.calls.length, 2); const cropped = f.calls[1]; assert.ok(cropped.crop); assert.deepEqual(cropped.projection, full.projection); assert.deepEqual(cropped.world, full.world); assert.deepEqual(cropped.textureMatrix, full.textureMatrix); assert.deepEqual(cropped.viewport, full.viewport); assert.deepEqual(cropped.size, [2048, 2048]);
  f.main.viewport.set(13, 17, 640, 480); f.renderer.setRenderTarget(f.main); f.draw(); assert.equal(f.calls.length, 3); assert.notDeepEqual(f.calls[2].crop, cropped.crop);
  sheet.material.uniforms.waveScale.value = 2; f.draw(); assert.equal(f.calls.length, 4); assert.notDeepEqual(f.calls[3].crop, f.calls[2].crop);
  const position = sheet.geometry.attributes.position; position.setX(1, position.getX(1) - .3); position.needsUpdate = true; f.draw(); assert.equal(f.calls.length, 5);
  f.water.setReflectionCropEnabled(false); f.draw(); assert.equal(f.calls.length, 6); assert.equal(f.calls[5].crop, null); assert.deepEqual(f.calls[5].projection, full.projection);
  const snapshot = f.water.snapshot(); assert.equal(snapshot.reflectionCropEnabled, false); assert.equal(snapshot.sheets[0].crop.total.windows, 4); snapshot.sheets[0].crop.total.windows = 999; assert.equal(f.water.snapshot().sheets[0].crop.total.windows, 4);
  assert.throws(() => f.water.setReflectionCropEnabled('1'), /boolean/); f.water.dispose(); assert.equal(f.water.setReflectionCropEnabled(true), false);
});

test('captured Xian pose crops the real GardenWater merged-pool callback while its cross-eye sea stays full', async t => {
  const capture = JSON.parse(await readFile(new URL('../../work/production-v3/captures/museum-world-19f4443e28771df2-xianfashan-1789176741086-2.json', import.meta.url))), f = waterHarness(t);
  f.camera.position.fromArray(capture.camera); f.camera.lookAt(...capture.target); f.camera.updateMatrixWorld(true);
  f.water.group.position.set(capture.target[0], 0, capture.target[2]); f.scene.updateMatrixWorld(true);
  f.update(); f.draw(); const full = f.calls.at(-1);
  f.water.setReflectionCropEnabled(true); f.draw(); const cropped = f.calls.at(-1);
  assert.ok(cropped.crop); assert.deepEqual(cropped.projection, full.projection); assert.deepEqual(cropped.world, full.world); assert.deepEqual(cropped.textureMatrix, full.textureMatrix); assert.deepEqual(cropped.viewport, full.viewport);
  const sea = f.water.sheets[1]; sea.onBeforeRender(f.renderer, f.scene, f.camera, sea.geometry, sea.material);
  assert.equal(f.calls.at(-1).crop, null); assert.equal(f.water.snapshot().sheets[1].crop.last.reason, 'bounds-cross-or-approach-w-zero');
  f.water.setReflectionCropEnabled(false); f.draw(); assert.deepEqual(f.calls.at(-1), full);
  output.xianCallback = { smallMergedPoolRect: cropped.crop, crossEyeSeaReason: 'bounds-cross-or-approach-w-zero', exactFullCropFullCameraAndTexture: true, note: 'Real GardenWater callback and sea geometry, small translated fixture basins; no full scene construction.' };
});

test('real scoped crop drives the hierarchy while nested shadow, main and another target retain exact stock draws', async t => {
  const f = waterHarness(t), shape = new T.BoxGeometry(1, 2, 1), material = new T.MeshStandardMaterial(), batch = new T.BatchedMesh(225, shape.attributes.position.count, shape.index.count, material), gid = batch.addGeometry(shape); batch.sortObjects = false;
  for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) batch.setMatrixAt(batch.addInstance(gid), new T.Matrix4().makeTranslation((x - 7) * 4, 5, 12 - z * 4));
  const root = new T.Group(); root.add(batch); f.scene.add(root); f.scene.updateMatrixWorld(true);
  const helper = await attachMuseumMultiDrawCulling(root, { leafSize: 8, viewCacheSize: 3, yieldControl: async () => {} });
  t.after(() => { helper.dispose(); batch.dispose(); shape.dispose(); material.dispose(); });
  const shadow = new T.OrthographicCamera(-20, 20, 20, -20, .1, 200); shadow.position.set(0, 70, 40); shadow.lookAt(0, 0, 0); shadow.updateMatrixWorld(true);
  const stock = c => { T.BatchedMesh.prototype.onBeforeRender.call(batch, f.renderer, f.scene, c, batch.geometry, material); return drawIds(batch); };
  const mainIds = stock(f.camera), shadowIds = stock(shadow), pairs = [];
  f.renderer.duringRender = (scene, reflected) => {
    const scope = gardenReflectionCropForDraw(f.renderer, reflected), original = reflected.projectionMatrix.toArray(), query = reflected.clone();
    if (scope) query.projectionMatrix.premultiply(scope.clipMatrix); const expected = stock(query);
    batch.onBeforeRender(f.renderer, scene, reflected, batch.geometry, material); const actual = drawIds(batch); assert.deepEqual(actual, expected); pairs.push({ cropped: !!scope, count: actual.length }); assert.deepEqual(reflected.projectionMatrix.toArray(), original);
    const target = f.renderer.getRenderTarget(); f.renderer.setRenderTarget(f.shadowTarget); assert.equal(gardenReflectionCropForDraw(f.renderer, reflected), null); batch.onBeforeShadow(f.renderer, null, reflected, shadow, batch.geometry, material); assert.deepEqual(drawIds(batch), shadowIds);
    f.renderer.setRenderTarget(target); assert.equal(!!gardenReflectionCropForDraw(f.renderer, reflected), !!scope); assert.equal(gardenReflectionCropForDraw(f.renderer, f.camera), null);
    batch.onBeforeRender(f.renderer, scene, reflected, batch.geometry, material); assert.deepEqual(drawIds(batch), expected);
  };
  f.update(); f.draw(); f.water.setReflectionCropEnabled(true); f.draw(); f.water.setReflectionCropEnabled(false); f.draw();
  assert.ok(pairs[1].count < pairs[0].count); assert.deepEqual(pairs[0], pairs[2]);
  batch.onBeforeRender(f.renderer, f.scene, f.camera, batch.geometry, material); assert.deepEqual(drawIds(batch), mainIds); assert.equal(gardenReflectionCropForDraw(f.renderer, f.water.sheets[0].getReflectionCamera(f.camera)), null); assert.equal(helper.snapshot().batches[0].croppedReflectionCalls, 2);
  output.productionScope = { actualFullCroppedFullDrawCounts: pairs, realMainSequence: mainIds.length, realShadowSequence: shadowIds.length, sourceCameraNeverCropped: true, nestedTargetExcluded: true };
});

test('external hooks and unknown shader/filter/target configuration use the full stock path; failure restores target objects and cache', t => {
  const f = waterHarness(t), sheet = f.water.sheets[0], target = sheet.getRenderTarget(), originalScissor = target.scissor, originalViewport = target.viewport;
  f.water.setReflectionCropEnabled(true); f.update();
  f.renderer.duringRender = () => { target.scissor = new T.Vector4(9, 9, 9, 9); target.viewport = new T.Vector4(1, 2, 3, 4); target.scissorTest = false; f.renderer.shadowMap.autoUpdate = true; f.renderer.shadowMap.needsUpdate = true; throw new Error('external-before-render-failure'); };
  assert.throws(f.draw, /external-before-render-failure/); assert.equal(f.renderer.getRenderTarget(), f.main); assert.equal(f.renderer.xr.enabled, true); assert.equal(f.renderer.shadowMap.autoUpdate, false); assert.equal(f.renderer.shadowMap.needsUpdate, false); assert.equal(target.scissor, originalScissor); assert.equal(target.viewport, originalViewport); assert.deepEqual(target.scissor.toArray(), [0, 0, 2048, 2048]); assert.deepEqual(target.viewport.toArray(), [0, 0, 2048, 2048]); assert.equal(target.scissorTest, false); assert.equal(f.water.snapshot().sheets[0].cached, false); assert.equal(gardenReflectionCropForDraw(f.renderer, sheet.getReflectionCamera(f.camera)), null);
  f.renderer.duringRender = null; f.draw(); assert.ok(f.calls.at(-1).crop); assert.equal(f.water.snapshot().sheets[0].cached, true);
  const countBeforeCustomViewport = f.calls.length; f.camera.viewport = new T.Vector4(2, 3, 900, 700); f.draw(); assert.equal(f.calls.length, countBeforeCustomViewport + 1); assert.equal(f.calls.at(-1).crop, null); assert.equal(f.water.snapshot().sheets[0].crop.last.reason, 'custom-camera-viewport'); delete f.camera.viewport; f.draw(); assert.ok(f.calls.at(-1).crop);
  const capture = sheet.onBeforeRender; let externalCalls = 0; sheet.onBeforeRender = (...args) => { externalCalls++; return capture(...args); }; f.draw(); assert.equal(externalCalls, 1); assert.equal(f.calls.at(-1).crop, null); assert.equal(f.water.snapshot().sheets[0].crop.last.reason, 'unsupported-water-draw'); sheet.onBeforeRender = capture;
  const fragment = sheet.material.fragmentShader; sheet.material.fragmentShader += '\n// unknown custom shader'; f.draw(); assert.equal(f.calls.at(-1).crop, null); sheet.material.fragmentShader = fragment;
    target.viewport.z = 1024; f.draw(); assert.equal(f.calls.at(-1).crop, null); assert.equal(target.viewport.z, 1024); target.viewport.z = 2048;
    f.camera.viewport = new T.Vector4(2, 3, 900, 700); f.draw(); assert.equal(f.calls.at(-1).crop, null); assert.equal(f.water.snapshot().sheets[0].crop.last.reason, 'custom-camera-viewport'); delete f.camera.viewport;
  target.scissor.set(6, 8, 500, 600); target.scissorTest = true; f.draw(); assert.equal(f.calls.at(-1).crop, null); assert.deepEqual(f.calls.at(-1).scissor, [6, 8, 500, 600]); assert.deepEqual(target.scissor.toArray(), [6, 8, 500, 600]); assert.equal(target.scissorTest, true);
});

test('scope A/B/A rectangles enter the actual hierarchy cache while original camera/geometry stay intact', async t => {
  const f = waterHarness(t), box = new T.BoxGeometry(), material = new T.MeshStandardMaterial(), batch = new T.BatchedMesh(21, box.attributes.position.count, box.index.count, material), gid = batch.addGeometry(box); batch.sortObjects = false;
  for (let x = -10; x <= 10; x++) batch.setMatrixAt(batch.addInstance(gid), new T.Matrix4().makeTranslation(x * 2, 5, -10)); const root = new T.Group(); root.add(batch); root.updateMatrixWorld(true);
  const helper = await attachMuseumMultiDrawCulling(root, { viewCacheSize: 3, yieldControl: async () => {} }); t.after(() => { helper.dispose(); batch.dispose(); box.dispose(); material.dispose(); });
  const reflected = prepareGardenReflectionViews([f.water.sheets[0]], f.camera)[0].camera, target = f.water.sheets[0].getRenderTarget(), before = reflected.projectionMatrix.toArray(), matrixHash = geometryHash(batch), windows = [{ kind: 'window', rect: [0, 0, 960, 2048] }, { kind: 'window', rect: [1088, 0, 960, 2048] }], draws = [];
  for (const window of [windows[0], windows[1], windows[0]]) withGardenReflectionCrop(f.renderer, target, reflected, window, () => { f.renderer.setRenderTarget(target); try { batch.onBeforeRender(f.renderer, f.scene, reflected, batch.geometry, material); draws.push(drawIds(batch)); } finally { f.renderer.setRenderTarget(f.main); } });
  assert.notDeepEqual(draws[0], draws[1]); assert.deepEqual(draws[0], draws[2]); assert.ok(helper.snapshot().batches[0].cacheHits >= 1); assert.deepEqual(reflected.projectionMatrix.toArray(), before); assert.equal(geometryHash(batch), matrixHash); assert.equal(gardenReflectionCropForDraw(f.renderer, reflected), null);
});

after(async () => {
  const sourceAfter = Object.fromEntries(await Promise.all(productionPaths.map(async name => [name, sha(await readFile(new URL('../src/yuanmingyuan/' + name, import.meta.url)))])));
  assert.deepEqual(sourceAfter, sourceBefore); output.productionSHA256 = sourceAfter; output.rippleUvLimits = { lake: rippleUvLimit(.72), sea: rippleUvLimit(1.5) }; output.peakRSSKiB = process.resourceUsage().maxRSS;
  console.log('REFLECTION_CROP_EVIDENCE ' + JSON.stringify(output));
});
