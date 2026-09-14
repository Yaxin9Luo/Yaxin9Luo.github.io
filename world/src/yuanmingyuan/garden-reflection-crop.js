// Optional garden-water candidate; the original camera and full-size target stay unchanged.
import { ClampToEdgeWrapping, LinearFilter, Matrix3, Matrix4, Vector3, Vector4 } from 'three';

export const gardenRippleUvLimit = waveScale => (1.5 * .018 + 2.1 * .033 + 1.5 * .014) * .016 * Math.abs(waveScale);
const clamp = x => Math.max(.001, Math.min(.999, x));
const bias = () => new Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
const finite = values => values.every(Number.isFinite);
function columns(a, b, c) { return new Matrix3().set(a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]); }
const localBounds = new WeakMap(), activeCaptures = new WeakMap();
function affine(matrix, inverseView = false) {
  const e = matrix.elements;
  if (!finite(e) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || (inverseView ? e[15] <= 0 : e[15] !== 1)) return false;
  const determinant = matrix.determinant();
  return Number.isFinite(determinant) && determinant !== 0;
}

function boundsFor(geometry, position) {
  const signature = [position, position.array, position.version, position.data, position.data?.version, geometry.index, geometry.index?.version, geometry.drawRange.start, geometry.drawRange.count];
  const previous = localBounds.get(geometry);
  if (previous && signature.every((value, i) => previous.signature[i] === value)) return previous;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) for (let axis = 0; axis < 3; axis++) {
    const value = position.getComponent(i, axis); min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
  }
  const result = { signature, min, max }; localBounds.set(geometry, result); return result;
}

/** Actual triangle coordinates, plus a full main-raster-pixel Minkowski border.
 * On each triangle the interpolated mirror UV is a homography of main NDC.
 * Linear-fractional extrema are attained at the convex polygon's vertices when
 * its denominator stays positive. Twelve offset vertices bound that polygon.
 * No near/far clipping is needed to tighten the window: retaining the portions
 * beyond those planes only makes it more conservative. Any w singularity uses
 * the full target. The final sample clamp is applied BEFORE the filter border.
 * Numeric padding is a guarded engineering policy, not a GPU precision proof.
 */
export function prepareGardenReflectionCrop(sheet, mainCamera, reflectionCamera, {
  mainViewportWidth, mainViewportHeight, waveScale = sheet.material.uniforms.waveScale?.value ?? .72,
  rasterPixelMargin = 1, filterPixelMargin = 1, numericPixelMargin = 1,
} = {}) {
  const target = sheet.getRenderTarget(), width = target.width, height = target.height;
  const full = reason => ({ kind: 'full', reason, rect: [0, 0, width, height], areaFraction: 1 });
  const texture = target.texture, viewport = target.viewport;
  if (![width, height, mainViewportWidth, mainViewportHeight, waveScale, rasterPixelMargin, filterPixelMargin, numericPixelMargin].every(Number.isFinite) || Math.min(width, height, mainViewportWidth, mainViewportHeight) <= 0 || rasterPixelMargin < 1 || filterPixelMargin < 1 || numericPixelMargin < 1) return full('invalid-size-or-wave-parameters');
  if (texture.minFilter !== LinearFilter || texture.magFilter !== LinearFilter || texture.generateMipmaps || texture.anisotropy !== 1 || texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) return full('unbounded-or-unsupported-filter-footprint');
  if (viewport.x || viewport.y || viewport.z !== width || viewport.w !== height) return full('non-full-reflection-viewport');
  if (target.scissorTest) return full('preexisting-target-scissor');
  if (mainCamera.isArrayCamera || reflectionCamera.isArrayCamera) return full('array-camera');
  // Plain Camera.viewport can be restored by Reflector through WebGLState
  // without updating WebGLRenderer's tracked current viewport. Keep that
  // externally managed path unchanged rather than infer its raster footprint.
  if (mainCamera.viewport !== undefined) return full('custom-camera-viewport');
  // Three's analytic camera inverse can produce w = 1 +/- rounding error.
  // An exactly constant positive w is still affine; retain its actual value in
  // every projection below. Projective terms must remain exactly zero, and
  // source world matrices still need canonical w for Cartesian eye extraction.
  if (!affine(sheet.matrixWorld) || !affine(mainCamera.matrixWorld) || !affine(mainCamera.matrixWorldInverse, true) || !affine(reflectionCamera.matrixWorld) || !affine(reflectionCamera.matrixWorldInverse, true)) return full('nonfinite-or-nonaffine-world-matrix');
  const geometry = sheet.geometry, position = geometry.getAttribute('position'), index = geometry.index;
  if (!position || position.itemSize !== 3 || geometry.morphAttributes.position?.length) return full('unsupported-position-data');
  const count = index?.count ?? position.count, start = geometry.drawRange.start, end = Math.min(count, start + geometry.drawRange.count);
  if (!Number.isInteger(start) || start % 3 || (end - start) % 3) return full('non-triangle-draw-range');
  const main = new Matrix4().multiplyMatrices(mainCamera.projectionMatrix, mainCamera.matrixWorldInverse).multiply(sheet.matrixWorld);
  const mirror = bias().multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse).multiply(sheet.matrixWorld);
  if (!finite([...main.elements, ...mirror.elements])) return full('nonfinite-matrices');
  // A constant-size conservative preflight keeps the sea and large lake from
  // walking thousands of triangles when their bounds already cross the eye.
  // The cached bounds borrow no GPU resource and observe Three update versions.
  const bounds = boundsFor(geometry, position);
  if (!finite([...bounds.min, ...bounds.max])) return full('nonfinite-position-bounds');
  const eye = new Vector3().setFromMatrixPosition(mainCamera.matrixWorld).applyMatrix4(sheet.matrixWorld.clone().invert());
  if (eye.toArray().every((value, axis) => value >= bounds.min[axis] - 1e-7 && value <= bounds.max[axis] + 1e-7)) return full('camera-inside-sheet-bounds');
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const point = new Vector4(x, y, z, 1), q = point.clone().applyMatrix4(main), r = point.applyMatrix4(mirror);
    if (!finite([...q.toArray(), ...r.toArray()]) || q.w <= 1e-7 || r.w <= 1e-7) return full('bounds-cross-or-approach-w-zero');
  }
  const vertices = new Map(), used = new Set();
  for (let offset = start; offset < end; offset++) used.add(index ? index.getX(offset) : offset);
  const minRaw = [Infinity, Infinity], maxRaw = [-Infinity, -Infinity];
  let minW = Infinity, maxW = -Infinity;
  for (const id of used) {
    const local = new Vector4(position.getX(id), position.getY(id), position.getZ(id), 1), q = local.clone().applyMatrix4(main), r = local.clone().applyMatrix4(mirror);
    if (!finite([...q.toArray(), ...r.toArray()])) return full('nonfinite-vertex-projection');
    minW = Math.min(minW, q.w, r.w); maxW = Math.max(maxW, q.w, r.w);
    if (q.w <= 1e-7 || r.w <= 1e-7) return full('crosses-or-approaches-w-zero');
    if (Math.max(...q.toArray().map(Math.abs), ...r.toArray().map(Math.abs)) / Math.min(q.w, r.w) > 1e8) return full('ill-conditioned-homogeneous-projection');
    const screen = [q.x / q.w, q.y / q.w, 1], uvNumerator = [r.x / q.w, r.y / q.w, r.w / q.w];
    vertices.set(id, { screen, uvNumerator });
    for (let axis = 0; axis < 2; axis++) { const uv = uvNumerator[axis] / uvNumerator[2]; minRaw[axis] = Math.min(minRaw[axis], uv); maxRaw[axis] = Math.max(maxRaw[axis], uv); }
  }
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity], dx = 2 * rasterPixelMargin / mainViewportWidth, dy = 2 * rasterPixelMargin / mainViewportHeight;
  let triangles = 0, maximumHomographyCoefficient = 0;
  for (let offset = start; offset < end; offset += 3) {
    const tri = [0, 1, 2].map(i => vertices.get(index ? index.getX(offset + i) : offset + i));
    const screen = columns(...tri.map(v => v.screen)), det = screen.determinant();
    if (!Number.isFinite(det) || Math.abs(det) < 1e-13) return full('degenerate-or-edge-on-projected-triangle');
    const homography = columns(...tri.map(v => v.uvNumerator)).multiply(screen.invert());
    if (!finite(homography.elements)) return full('nonfinite-raster-homography');
    maximumHomographyCoefficient = Math.max(maximumHomographyCoefficient, ...homography.elements.map(Math.abs));
    if (maximumHomographyCoefficient > 1e8) return full('ill-conditioned-raster-homography');
    for (const vertex of tri) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const value = new Vector3(vertex.screen[0] + sx * dx, vertex.screen[1] + sy * dy, 1).applyMatrix3(homography);
      if (!finite(value.toArray()) || value.z <= 1e-7) return full('raster-border-crosses-w-zero');
      for (let axis = 0; axis < 2; axis++) { const uv = value.getComponent(axis) / value.z; min[axis] = Math.min(min[axis], uv); max[axis] = Math.max(max[axis], uv); }
    }
    triangles++;
  }
  if (!triangles) return full('empty-draw-range');
  const ripple = gardenRippleUvLimit(waveScale), sampleMin = min.map(v => clamp(v - ripple)), sampleMax = max.map(v => clamp(v + ripple));
  const border = filterPixelMargin + numericPixelMargin;
  const x0 = Math.max(0, Math.floor(sampleMin[0] * width - border)), x1 = Math.min(width, Math.ceil(sampleMax[0] * width + border));
  const y0 = Math.max(0, Math.floor(sampleMin[1] * height - border)), y1 = Math.min(height, Math.ceil(sampleMax[1] * height + border));
  const rect = [x0, y0, x1 - x0, y1 - y0];
  return { kind: rect[2] === width && rect[3] === height ? 'full' : 'window', reason: 'actual-triangle-raster-ripple-filter-envelope', rect, areaFraction: rect[2] * rect[3] / (width * height), rawUv: { min: minRaw, max: maxRaw }, rasterUv: { min, max }, sampleUv: { min: sampleMin, max: sampleMax }, rippleUvMargin: ripple, rasterPixelMargin, filterPixelMargin, numericPixelMargin, triangles, projectedVertices: vertices.size, minW, maxW, maximumHomographyCoefficient };
}

/** Used ONLY for querying geometry; never install this into the drawing camera.
 * Cropping rows X/Y preserves the exact original row Z/W oblique clip planes. */
export function gardenReflectionCullingProjection(camera, window, width, height) {
  const [x, y, w, h] = window.rect;
  if (x === 0 && y === 0 && w === width && h === height) return camera.projectionMatrix.clone();
  const left = x / width * 2 - 1, right = (x + w) / width * 2 - 1, bottom = y / height * 2 - 1, top = (y + h) / height * 2 - 1;
  return new Matrix4().set(2 / (right - left), 0, 0, -(right + left) / (right - left), 0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom), 0, 0, 1, 0, 0, 0, 0, 1).multiply(camera.projectionMatrix);
}

/** Synchronous scope for one actual Reflector capture. The renderer/target AND
 * camera identities must all match. Shadow/transmission targets, other water
 * cameras and subsequent main passes therefore cannot inherit this rectangle.
 * Save target object identities too: an external callback can replace vectors
 * or throw after the target switch. GPU restoration remains garden-water's job.
 */
export function withGardenReflectionCrop(renderer, target, reflectionCamera, window, render) {
  const old = { scissor: target.scissor, rect: target.scissor.clone(), viewport: target.viewport, view: target.viewport.clone(), enabled: target.scissorTest }, previous = activeCaptures.get(renderer);
  try {
    if (window.kind === 'window') {
      target.scissor.fromArray(window.rect); target.scissorTest = true;
      const identityCamera = { projectionMatrix: new Matrix4() };
      activeCaptures.set(renderer, { target, camera: reflectionCamera, rect: [...window.rect], clipMatrix: gardenReflectionCullingProjection(identityCamera, window, target.width, target.height), width: target.width, height: target.height });
    } else activeCaptures.delete(renderer);
    return render();
  } finally {
    target.scissor = old.scissor; target.scissor.copy(old.rect); target.viewport = old.viewport; target.viewport.copy(old.view); target.scissorTest = old.enabled;
    if (previous) activeCaptures.set(renderer, previous); else activeCaptures.delete(renderer);
  }
}

export function gardenReflectionCropForDraw(renderer, camera) {
  const scope = activeCaptures.get(renderer);
  if (!scope || scope.camera !== camera || renderer.getRenderTarget?.() !== scope.target) return null;
  const target = scope.target, viewport = target.viewport;
  if (target.width !== scope.width || target.height !== scope.height || !target.scissorTest || !target.scissor.toArray().every((value, i) => value === scope.rect[i]) || viewport.x || viewport.y || viewport.z !== scope.width || viewport.w !== scope.height) return null;
  return scope;
}
