import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { prepareGardenReflectionViews } from '../src/yuanmingyuan/garden-reflection-views.js';
import { projectedOverviewError } from '../src/yuanmingyuan/asset-overview.js';
import { createReflectionFixture, cameraState, camerasFromReflectionAudit } from './fixtures/garden-reflection-views-scene.js';

const audit = JSON.parse(await readFile(new URL('../../work/yuanmingyuan/overview-reflection-projection-analysis-r1.json', import.meta.url)));
function fixture(t) { const f = createReflectionFixture(); t.after(() => f.dispose()); return f; }
function snapshotInputs(f, cameras) {
  const nodes = [];
  f.scene.traverse(node => nodes.push({ uuid: node.uuid, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(), matrix: node.matrix.toArray(), world: node.matrixWorld.toArray(), dirty: node.matrixWorldNeedsUpdate, visible: node.visible }));
  return {
    nodes, cameras: cameras.map(cameraState), counters: f.water.snapshot(), calls: f.calls.length,
    reflectors: f.water.sheets.map(sheet => ({ forceUpdate: sheet.forceUpdate, target: sheet.getRenderTarget().uuid, shader: sheet.material.uuid, texture: sheet.getRenderTarget().texture.uuid, textureMatrix: sheet.material.uniforms.textureMatrix.value.toArray(), time: sheet.material.uniforms.time.value, eye: sheet.material.uniforms.eye.value.toArray(), caches: cameras.map(camera => { const value = sheet._reflectionCameras.get(camera); return value ? { uuid: value.uuid, state: cameraState(value) } : null; }) })),
  };
}
function assertActual(prediction, actual) {
  assert.ok(actual, 'The actual Reflector callback must reach the recording renderer.');
  assert.deepEqual(cameraState(prediction.camera), actual.camera);
  assert.equal(prediction.physicalWidth, actual.physicalWidth); assert.equal(prediction.physicalHeight, actual.physicalHeight);
}

test('15 actual r185 callbacks match every predicted matrix at 0, 2 and 3.7 m water levels and 2048 physical pixels', t => {
  const f = fixture(t), data = [];
  assert.equal(THREE.REVISION, '185'); assert.equal(audit.threeRevision, '185');
  for (const { name, camera } of camerasFromReflectionAudit(audit)) {
    f.begin(camera); const before = snapshotInputs(f, [camera]), predicted = f.water.reflectionViews(camera);
    assert.deepEqual(snapshotInputs(f, [camera]), before); assert.equal(predicted.length, 3);
    for (const [index, sheet] of f.water.sheets.entries()) {
      assert.equal(sheet._reflectionCameras.has(camera), false);
      const view = predicted[index], actual = f.draw(sheet, camera); assertActual(view, actual);
      assert.equal(view.physicalWidth, 2048); assert.equal(view.physicalHeight, 2048); assert.notEqual(view.camera, sheet._reflectionCameras.get(camera)); assert.equal(view.id, `garden-reflection:${sheet.uuid}`);
      const prior = audit.runs.find(run => run.name === name && run.waterY === sheet.position.y); assert.ok(prior);
      // JSON cannot retain -0. This normalization is only for the older JSON
      // evidence; assertActual above compares every live element strictly.
      assert.deepEqual(actual.camera.projectionMatrix.map(value => value === 0 ? 0 : value), prior.projection); assert.deepEqual(actual.camera.position, prior.reflectionCamera);
      const input = { bounds: audit.bounds, error: audit.error, placementMatrix: new THREE.Matrix4().fromArray(audit.placement), physicalWidth: view.physicalWidth, physicalHeight: view.physicalHeight, pixelBudget: .5 }, expectedError = projectedOverviewError({ ...input, camera: sheet._reflectionCameras.get(camera) }), predictedError = projectedOverviewError({ ...input, camera: view.camera });
      assert.deepEqual(predictedError, expectedError); assert.equal(predictedError.clipping.certified, true);
      data.push({ name, planeY: sheet.position.y, physicalWidth: view.physicalWidth, physicalHeight: view.physicalHeight, maximumMatrixElementDifference: 0, sourceCamera: cameraState(camera), actualCamera: actual.camera, predictedCamera: cameraState(view.camera), projectedError: predictedError });
    }
  }
  assert.equal(f.calls.length, 15); t.diagnostic(JSON.stringify({ realReflectorCallbacks: f.calls.length, matches: data, gpuUsed: false }));
});

test('current camera and sheet TRS, including changed parent transforms, are predicted before source matrix preparation', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(53, 1.6, .08, 3000), rig = new THREE.Group(); f.scene.add(rig); rig.add(camera); camera.position.set(15, 40, 70); camera.lookAt(0, 4, 0); f.begin(camera);
  for (const sheet of f.water.sheets) assertActual(f.water.reflectionViews(camera)[f.water.sheets.indexOf(sheet)], f.draw(sheet, camera));
  const cameraBefore = camera.matrixWorld.toArray(), sheetBefore = f.water.sheets[0].matrixWorld.toArray();
  rig.position.set(-24, 7, 18); rig.rotation.set(.02, .16, -.03); camera.position.x += 16; camera.rotation.y += .18;
  f.water.group.position.set(4, .6, -8); f.water.group.rotation.y = .27; f.water.sheets[0].position.y += .23; f.water.sheets[0].rotation.z += .015;
  const before = snapshotInputs(f, [camera]), views = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before);
  assert.deepEqual(camera.matrixWorld.toArray(), cameraBefore); assert.deepEqual(f.water.sheets[0].matrixWorld.toArray(), sheetBefore);
  f.begin(camera); assert.notDeepEqual(camera.matrixWorld.toArray(), cameraBefore); assert.notDeepEqual(f.water.sheets[0].matrixWorld.toArray(), sheetBefore);
  for (const [i, sheet] of f.water.sheets.entries()) assertActual(views[i], f.draw(sheet, camera));
});

test('a previously cached reflection camera remains unchanged while new projection and pose are predicted', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(44, 1.5, .08, 5000); camera.position.set(20, 36, 80); camera.lookAt(0, 2, 0); camera.scale.setScalar(1.2); f.begin(camera);
  for (const sheet of f.water.sheets) f.draw(sheet, camera);
  const firstNear = camera.near, initialScale = camera.scale.toArray();
  camera.near = 3; camera.far = 22000; camera.zoom = 1.3; camera.setViewOffset(3200, 2200, 130, 70, 2700, 2000); camera.updateProjectionMatrix(); camera.position.y += 5; camera.rotation.z = .09; camera.scale.setScalar(.9); camera.layers.set(4); f.begin(camera);
  const before = snapshotInputs(f, [camera]), predicted = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before);
  for (const [index, sheet] of f.water.sheets.entries()) {
    const view = predicted[index]; assert.equal(view.camera.near, firstNear); assert.deepEqual(view.camera.scale.toArray(), initialScale); assert.equal(view.camera.layers.mask, 1);
    assertActual(view, f.draw(sheet, camera)); assert.notDeepEqual(view.camera.projectionMatrix.clone().invert().toArray(), view.camera.projectionMatrixInverse.toArray());
  }
});

test('back-facing early exits and forceUpdate agree with real callbacks independently at all three water levels', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(45, 1.4, .08, 2000); camera.position.set(0, 1, 40); camera.lookAt(0, 1, 0); f.begin(camera);
  const before = snapshotInputs(f, [camera]), views = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before); assert.equal(views.length, 1); assert.equal(views[0].id, `garden-reflection:${f.water.sheets[2].uuid}`);
  assert.equal(f.draw(f.water.sheets[0], camera), null); assert.equal(f.draw(f.water.sheets[1], camera), null); assertActual(views[0], f.draw(f.water.sheets[2], camera));
  f.water.sheets[0].forceUpdate = true; const forcedBefore = snapshotInputs(f, [camera]), forced = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), forcedBefore); assert.equal(forced.length, 2);
  assertActual(forced[0], f.draw(f.water.sheets[0], camera)); assert.equal(f.water.sheets[0].forceUpdate, false);
  camera.position.y = -10; f.begin(camera); assert.deepEqual(f.water.reflectionViews(camera), []); for (const sheet of f.water.sheets) assert.equal(f.draw(sheet, camera), null);
});

test('helper calls do not consume the frame cache, alter shader uniforms or retain returned cameras across calls', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(40, 1, .1, 2000); camera.position.set(7, 20, 40); camera.lookAt(0, 0, 0); f.begin(camera);
  const first = f.water.reflectionViews(camera), before = snapshotInputs(f, [camera]), second = prepareGardenReflectionViews(f.water.sheets, camera);
  assert.deepEqual(snapshotInputs(f, [camera]), before); assert.notEqual(first[0].camera, second[0].camera); first[0].camera.projectionMatrix.elements.fill(777); assert.notDeepEqual(first[0].camera.projectionMatrix.toArray(), second[0].camera.projectionMatrix.toArray());
  for (const sheet of f.water.sheets) f.draw(sheet, camera);
  const cached = snapshotInputs(f, [camera]); f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), cached);
  for (const sheet of f.water.sheets) assert.equal(f.draw(sheet, camera), null);
  assert.equal(f.calls.length, 3); for (const sheet of f.water.snapshot().sheets) { assert.equal(sheet.frame.capture, 1); assert.equal(sheet.frame.reuse, 1); }
});

test('actual target resizing, orthographic offset projection and manually supplied transforms are retained', t => {
  const f = fixture(t), camera = new THREE.OrthographicCamera(-60, 60, 45, -45, .3, 5000); camera.position.set(10, 60, 90); camera.lookAt(0, 4, 0); camera.zoom = 1.4; camera.setViewOffset(3200, 2200, 140, 60, 2600, 1900); camera.updateProjectionMatrix();
  f.water.sheets[0].getRenderTarget().setSize(1024, 768);
  const sheet = f.water.sheets[1]; sheet.updateMatrix(); sheet.matrixAutoUpdate = false; sheet.matrix.premultiply(new THREE.Matrix4().makeTranslation(3, .2, 4)); f.begin(camera);
  const before = snapshotInputs(f, [camera]), views = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before);
  assert.equal(views[0].physicalWidth, 1024); assert.equal(views[0].physicalHeight, 768); assert.equal(views[1].physicalWidth, 2048);
  for (const [i, actual] of f.water.sheets.entries()) assertActual(views[i], f.draw(actual, camera));
});

test('camera A to B to A uses each real r185 seed, and disposal returns no reflection views', t => {
  const f = fixture(t), a = new THREE.PerspectiveCamera(40, 1.3, .1, 5000); a.position.set(5, 25, 90); a.lookAt(0, 0, 0); const b = a.clone(); b.position.x += 20; b.near = 2; b.updateProjectionMatrix();
  for (const camera of [a, b, a]) { f.begin(camera); const views = f.water.reflectionViews(camera); for (const [i, sheet] of f.water.sheets.entries()) assertActual(views[i], f.draw(sheet, camera)); }
  assert.equal(f.calls.length, 9); f.water.dispose(); assert.deepEqual(f.water.reflectionViews(a), []); assert.deepEqual(f.water.reflectionViews(), []);
});

test('manual world matrices and a frozen scene are predicted without forcing author-disabled updates', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(40, 1, .1, 4000); camera.position.set(12, 30, 90); camera.lookAt(0, 0, 0); f.begin(camera);
  const sheet = f.water.sheets[0]; sheet.matrixWorldAutoUpdate = false; sheet.matrixWorld.premultiply(new THREE.Matrix4().makeTranslation(2, .4, 3)); sheet.position.y += 30;
  camera.matrixAutoUpdate = false; camera.matrixWorldNeedsUpdate = false; camera.matrix.premultiply(new THREE.Matrix4().makeTranslation(20, 30, 10));
  let before = snapshotInputs(f, [camera]), views = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before); f.begin(camera);
  for (const [i, actual] of f.water.sheets.entries()) assertActual(views[i], f.draw(actual, camera));
  f.scene.matrixWorldAutoUpdate = false; f.water.group.position.y += 5; before = snapshotInputs(f, [camera]); views = f.water.reflectionViews(camera); assert.deepEqual(snapshotInputs(f, [camera]), before);
  // WebGLRenderer skips scene.updateMatrixWorld when this flag is disabled.
  camera.updateMatrixWorld();
  for (const [i, actual] of f.water.sheets.entries()) { actual.forceUpdate = true; assertActual(views[i], f.draw(actual, camera)); }
});

test('prediction copies only the camera state and never clones its scene attachments', t => {
  const f = fixture(t), camera = new THREE.PerspectiveCamera(40, 1, .1, 3000); camera.position.set(10, 20, 60); camera.lookAt(0, 0, 0);
  const attachment = new THREE.Object3D(); let clones = 0; const clone = attachment.clone.bind(attachment); attachment.clone = function (...args) { clones++; return clone(...args); }; camera.add(attachment); f.begin(camera);
  const views = f.water.reflectionViews(camera); assert.equal(clones, 0); assert.ok(views.every(view => view.camera.children.length === 0));
  for (const [i, sheet] of f.water.sheets.entries()) assertActual(views[i], f.draw(sheet, camera));
  assert.equal(clones, 3, 'Only the actual r185 callback clones scene attachments during first cache creation.');
});
