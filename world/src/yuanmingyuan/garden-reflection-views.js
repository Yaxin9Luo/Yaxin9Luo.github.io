import { Matrix4, Plane, Vector3, Vector4 } from 'three';

/* Reflector camera/clip calculation adapted from Three.js r185 (MIT).
 * Copyright © 2010-2026 three.js authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Predict renderer matrix preparation without modifying source objects, dirty
// flags or manually supplied world matrices. A dirty/automatic parent forces
// descendants just as updateMatrixWorld does; a frozen Scene is not traversed.
function preparedWorld(object, matrices) {
  if (matrices.has(object)) return matrices.get(object);
  const parent = object.parent && preparedWorld(object.parent, matrices), frozenScene = parent?.frozenScene || (object.isScene && object.matrixWorldAutoUpdate === false), force = !frozenScene && !!(object.matrixAutoUpdate || object.matrixWorldNeedsUpdate || parent?.force);
  const matrix = !force || object.matrixWorldAutoUpdate === false ? object.matrixWorld.clone()
    : object.matrixAutoUpdate ? new Matrix4().compose(object.position, object.quaternion, object.scale) : object.matrix.clone();
  if (force && object.matrixWorldAutoUpdate !== false && parent) matrix.premultiply(parent.matrix);
  const prepared = { matrix, force, frozenScene };
  matrices.set(object, prepared);
  return prepared;
}

/** Predict the actual Reflector cameras before the outer render. Returned
 * cameras are independent snapshots, not the cached cameras used to draw water.
 * Only the exact stock back-face early exit removes a view. Other hidden or
 * offscreen sheets may be conservatively supplied; this does not certify any
 * omitted shadow camera or the downstream physical-pixel error calculation. */
export function prepareGardenReflectionViews(sheets, camera, { clipBias = .0002 } = {}) {
  if (!Array.isArray(sheets) || (!camera?.isPerspectiveCamera && !camera?.isOrthographicCamera) || !Number.isFinite(clipBias)) throw new Error('Reflection views require actual sheets, a perspective/orthographic camera and finite clip bias.');
  const matrices = new Map(), cameraWorld = preparedWorld(camera, matrices).matrix, cameraPosition = new Vector3().setFromMatrixPosition(cameraWorld), result = [];
  for (const sheet of sheets) {
    if (!sheet?.isReflector || typeof sheet.getRenderTarget !== 'function') throw new Error('Reflection views require actual Reflector sheets.');
    const surfaceWorld = preparedWorld(sheet, matrices).matrix, position = new Vector3().setFromMatrixPosition(surfaceWorld), rotation = new Matrix4().extractRotation(surfaceWorld), normal = new Vector3(0, 0, 1).applyMatrix4(rotation), view = new Vector3().subVectors(position, cameraPosition);
    if (view.dot(normal) > 0 && sheet.forceUpdate === false) continue;

    // r185 clones a camera only on its first use, then preserves fields such as
    // scale, near, layers and projectionMatrixInverse. Reading the seed keeps
    // those semantics without getReflectionCamera() creating a cache entry.
    const cached = sheet._reflectionCameras?.get(camera), seed = cached ?? camera, reflection = new seed.constructor().copy(seed, false);
    if (!cached) {
      if (camera.matrixAutoUpdate) reflection.updateMatrix();
      reflection.matrixWorld.copy(cameraWorld);
    }
    view.reflect(normal).negate().add(position);
    rotation.extractRotation(cameraWorld);
    const lookAtPosition = new Vector3(0, 0, -1).applyMatrix4(rotation).add(cameraPosition), target = new Vector3().subVectors(position, lookAtPosition).reflect(normal).negate().add(position);
    reflection.position.copy(view);
    reflection.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    reflection.lookAt(target);
    reflection.far = camera.far;
    reflection.updateMatrixWorld();
    reflection.projectionMatrix.copy(camera.projectionMatrix);

    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, position).applyMatrix4(reflection.matrixWorldInverse), clipPlane = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant), p = reflection.projectionMatrix.elements, q = new Vector4();
    q.x = (Math.sign(clipPlane.x) + p[8]) / p[0];
    q.y = (Math.sign(clipPlane.y) + p[9]) / p[5];
    q.z = reflection.isOrthographicCamera ? -camera.far : -1;
    q.w = reflection.isOrthographicCamera ? 1 : (1 + p[10]) / p[14];
    clipPlane.multiplyScalar(2 / clipPlane.dot(q));
    p[2] = clipPlane.x; p[6] = clipPlane.y;
    p[10] = reflection.isOrthographicCamera ? clipPlane.z - clipBias : clipPlane.z + 1 - clipBias;
    p[14] = reflection.isOrthographicCamera ? clipPlane.w - 1 : clipPlane.w;
    // Stock Reflector leaves projectionMatrixInverse unchanged; it is not the
    // inverse of this oblique projection and is not used to qualify pixel error.
    const renderTarget = sheet.getRenderTarget();
    result.push({ id: `garden-reflection:${sheet.uuid}`, camera: reflection, physicalWidth: renderTarget.width, physicalHeight: renderTarget.height });
  }
  return result;
}
