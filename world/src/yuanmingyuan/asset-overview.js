import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import { archiveSHA256, loadYuanmingyuanArchive } from './asset-archive.js';

export const YUANMINGYUAN_OVERVIEW_SCHEMA = 1;
export const OVERVIEW_MAXIMUM_PHYSICAL_PIXELS = .5;

// ||A||₂ <= sqrt(||A||₁ ||A||∞), including shear and reflection. Unlike the
// largest column length, this is an upper bound for every displacement vector.
export function overviewAffineScaleBound(matrix) {
  const e = matrix.elements;
  if (e.some(value => !Number.isFinite(value)) || e[3] || e[7] || e[11] || e[15] !== 1) throw new Error('Overview requires a finite affine transform');
  const rows = [0, 1, 2].map(r => Math.abs(e[r]) + Math.abs(e[4 + r]) + Math.abs(e[8 + r]));
  const columns = [0, 4, 8].map(c => Math.abs(e[c]) + Math.abs(e[c + 1]) + Math.abs(e[c + 2]));
  return Math.sqrt(Math.max(...rows) * Math.max(...columns));
}

function canonicalAffine(matrix) {
  const result = matrix.clone(), e = result.elements, w = e[15];
  // Three's general inverse may return [0,0,0,1-epsilon]. Dividing the whole
  // matrix by finite nonzero w is the identical affine map, also for negative
  // w. Never tolerate a nonzero projective term, even below machine epsilon.
  if (e[3] === 0 && e[7] === 0 && e[11] === 0 && Number.isFinite(w) && w !== 0 && w !== 1) for (let i = 0; i < 16; i++) e[i] /= w;
  overviewAffineScaleBound(result);
  return result;
}

function validateProjection(camera) {
  const p = camera.projectionMatrix.elements;
  // Reflector changes only row Z (indices 2,6,10,14). X/Y and the divisor W
  // must retain these exact forms. View/film offsets cancel between points;
  // real focal lengths below account for zoom and asymmetric view sizes.
  if (camera.coordinateSystem !== THREE.WebGLCoordinateSystem || camera.reversedDepth || p.some(value => !Number.isFinite(value)) || p[0] === 0 || p[5] === 0 || p[1] || p[3] || p[4] || p[7] || (camera.isPerspectiveCamera ? p[11] !== -1 || p[15] !== 0 || p[12] || p[13] || p[14] >= 0 : p[11] !== 0 || p[15] !== 1 || p[8] || p[9] || p[10] >= 0)) throw new Error('Unsupported camera projection matrix');
  // Along a screen ray with t=-z, d(z_ndc)/dt=-p14/t² (perspective)
  // or -p10 (orthographic). These signs preserve forward depth ordering and
  // reject degenerate depth rows, without assuming the old axis-aligned near.
  return p;
}

function depthClipCertificate(projection, view, box, error) {
  // Work in archive coordinates: source Box3 +/- its certified displacement
  // bounds both surfaces. A sphere would extend far below a low building and
  // incorrectly reject a lake plane that actually clears its foundations.
  // WebGL retains -W <= Z <= W. Use the supplied P, not Reflector's stale
  // projectionMatrixInverse or the original camera.near/far parameters.
  const a = new THREE.Matrix4().multiplyMatrices(projection, view).elements;
  if (a.some(value => !Number.isFinite(value))) throw new Error('Non-finite overview clip projection');
  const min = box.min.toArray(), max = box.max.toArray();
  const planes = ['near', 'far'].map((name, index) => {
    const sign = index === 0 ? 1 : -1, plane = [0, 4, 8, 12].map(i => a[i + 3] + sign * a[i + 2]);
    const length = Math.hypot(plane[0], plane[1], plane[2]);
    if (!Number.isFinite(length) || !Number.isFinite(plane[3])) throw new Error('Non-finite overview clip plane');
    if (length === 0) return { name, unbounded: plane[3] > 0, certified: plane[3] > 0, minimumSourceDistanceArchiveUnits: null, maximumSourceDistanceArchiveUnits: null, minimumPairMarginArchiveUnits: null };
    for (let i = 0; i < 4; i++) plane[i] /= length;
    let low = plane[3], high = plane[3], magnitude = Math.abs(plane[3]);
    for (let i = 0; i < 3; i++) {
      low += plane[i] * (plane[i] >= 0 ? min[i] : max[i]);
      high += plane[i] * (plane[i] >= 0 ? max[i] : min[i]);
      magnitude += Math.abs(plane[i]) * Math.max(Math.abs(min[i]), Math.abs(max[i]));
    }
    if (![low, high, magnitude].every(Number.isFinite)) throw new Error('Non-finite overview clip bounds');
    // Subtract a rounding allowance; it can only deny, never loosen admission.
    const roundoffAllowance = 32 * Number.EPSILON * magnitude, margin = low - error - roundoffAllowance;
    return { name, unbounded: false, certified: margin > 0, minimumSourceDistanceArchiveUnits: low, maximumSourceDistanceArchiveUnits: high, errorArchiveUnits: error, roundoffAllowanceArchiveUnits: roundoffAllowance, minimumPairMarginArchiveUnits: margin };
  });
  return { certified: planes.every(plane => plane.certified), depthConvention: 'webgl-forward', method: 'source-box-and-error-inside-actual-depth-clip-planes', planes };
}

/** Conservative perspective bound for displacement of any corresponding pair
 * of surface points. Depth and off-axis position both matter; CSS pixel size
 * and distance to the object centre alone are not sufficient. Actual oblique
 * depth planes must also retain the complete source/error neighbourhood. */
export function projectedOverviewError({ camera, physicalWidth, physicalHeight, bounds, error, placementMatrix = new THREE.Matrix4(), pixelBudget = OVERVIEW_MAXIMUM_PHYSICAL_PIXELS }) {
  if (!camera?.isPerspectiveCamera && !camera?.isOrthographicCamera) throw new Error('Overview needs a perspective or orthographic camera');
  if (![physicalWidth, physicalHeight].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(error) || error < 0 || !Number.isFinite(pixelBudget) || pixelBudget <= 0 || pixelBudget > OVERVIEW_MAXIMUM_PHYSICAL_PIXELS) throw new Error('Invalid physical pixel dimensions, error, or pixel budget');
  const box = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
  if (box.isEmpty() || [...box.min.toArray(), ...box.max.toArray()].some(value => !Number.isFinite(value))) throw new Error('Invalid source overview bounds');
  // Validate each factor before multiplication: two projective inputs can
  // otherwise cancel into an affine product and escape the strict contract.
  canonicalAffine(camera.matrixWorld);
  const view = canonicalAffine(new THREE.Matrix4().multiplyMatrices(canonicalAffine(camera.matrixWorldInverse), canonicalAffine(placementMatrix)));
  const scaleBound = overviewAffineScaleBound(view);
  const sphere = box.getBoundingSphere(new THREE.Sphere()); sphere.center.applyMatrix4(view); sphere.radius *= scaleBound;
  const e = error * scaleBound, depth = -sphere.center.z - sphere.radius, radial = Math.hypot(sphere.center.x, sphere.center.y) + sphere.radius;
  const p = validateProjection(camera), clipping = depthClipCertificate(camera.projectionMatrix, view, box, error);
  const focalPixels = Math.max(Math.abs(p[0]) * physicalWidth, Math.abs(p[5]) * physicalHeight) / 2;
  if (![e, sphere.radius, depth, radial, focalPixels, camera.near].every(Number.isFinite) || camera.near < 0 || focalPixels <= 0) throw new Error('Non-finite overview projection or invalid near plane');
  const safeDepth = depth > e && depth > camera.near;
  const pixels = camera.isOrthographicCamera ? focalPixels * e : safeDepth ? focalPixels * e * Math.hypot(1, radial / depth) / (depth - e) : Infinity;
  // For this fixed lateral bound, solve for the minimum centre depth. This
  // number changes with viewport, zoom, placement, and off-axis position.
  let low = Math.max(camera.near, e), high = Math.max(1, low + focalPixels * e / pixelBudget + radial);
  const at = z => z > e ? focalPixels * e * Math.hypot(1, radial / z) / (z - e) : Infinity;
  if (camera.isPerspectiveCamera) {
    while (at(high) > pixelBudget) high *= 2;
    for (let i = 0; i < 60; i++) { const middle = (low + high) / 2; if (at(middle) > pixelBudget) low = middle; else high = middle; }
  }
  const eligible = safeDepth && clipping.certified && pixels <= pixelBudget;
  return { eligible, projectionReason: !clipping.certified ? 'clip-boundary-uncertified' : !safeDepth ? 'source-depth-unsafe' : pixels > pixelBudget ? 'physical-pixel-budget-exceeded' : 'within-physical-pixel-budget', clipping, projectedErrorPhysicalPixels: pixels, pixelBudget, nearestSourceDepth: depth, errorInCameraUnits: e, radiusInCameraUnits: sphere.radius, focalPhysicalPixels: focalPixels, minimumCentreDepth: camera.isPerspectiveCamera ? high + sphere.radius : null, distanceCanImproveError: !!camera.isPerspectiveCamera, equation: camera.isPerspectiveCamera ? 'f * e * sqrt(1 + (r / z)^2) / (z - e), z = centreDepth - sourceRadius' : 'f * e' };
}

export function validateOverviewReport(report) {
  if (report?.schema !== YUANMINGYUAN_OVERVIEW_SCHEMA || report.kind !== 'yuanmingyuan-overview' || report.certification?.method !== 'bidirectional-convex-triangle-cover-v1' || report.certification?.allAcceptedGeometryCertified !== true || report.fullArchiveRetained !== true || report.materialsAndTexturePixelsUnchanged !== true || report.verticesMoved !== false || report.quantized !== false || !Number.isFinite(report.maximumErrorArchiveWorld) || report.maximumErrorArchiveWorld < 0 || !Array.isArray(report.sourceRootWorldMatrix) || report.sourceRootWorldMatrix.length !== 16) throw new Error('Unsupported or uncertified overview report');
  const root = new THREE.Matrix4().fromArray(report.sourceRootWorldMatrix); overviewAffineScaleBound(root);
  if (root.determinant() === 0) throw new Error('Overview source root transform is singular');
  return report;
}

/** Load the independent overview archive with the same exact material/pixel
 * reader as a full archive. The caller owns visibility and full-asset loading.
 * An approval token must identify these precise report bytes before selection. */
export async function loadYuanmingyuanOverview(descriptor, { signal, fetchImpl = fetchPublicAsset, onProgress, yieldControl } = {}) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Overview aborted', 'AbortError');
  if (!descriptor?.overview?.url || !/^[a-f0-9]{64}$/.test(descriptor.overview.sha256 ?? '')) throw new Error('Overview descriptor and report SHA256 are required');
  const response = await fetchImpl(descriptor.overview.url, { signal });
  if (!response.ok) throw new Error(`Overview report HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== descriptor.overview.bytes || await archiveSHA256(bytes) !== descriptor.overview.sha256) throw new Error('Overview report byte length or SHA256 mismatch');
  if (signal?.aborted) throw signal.reason ?? new DOMException('Overview aborted', 'AbortError');
  const report = validateOverviewReport(JSON.parse(new TextDecoder().decode(bytes)));
  if (report.id !== descriptor.id || report.sourceArchiveDigest !== descriptor.sourceArchiveDigest) throw new Error('Overview and source archive identities differ');
  const asset = await loadYuanmingyuanArchive(descriptor, { signal, fetchImpl, onProgress, yieldControl });
  let disposed = false;
  const originalInverse = new THREE.Matrix4().fromArray(report.sourceRootWorldMatrix).invert();
  return {
    ...asset, overview: report,
    evaluate({ camera, physicalWidth, physicalHeight, pixelBudget, approvedOverviewSHA256 } = {}) {
      if (disposed) return { eligible: false, selection: 'full-required', reason: 'overview-disposed' };
      if (approvedOverviewSHA256 !== descriptor.overview.sha256) return { eligible: false, selection: 'full-required', reason: 'native-overview-review-required' };
      asset.group.updateWorldMatrix(true, true);
      const placementMatrix = new THREE.Matrix4().multiplyMatrices(asset.group.matrixWorld, originalInverse);
      const evaluation = projectedOverviewError({ camera, physicalWidth, physicalHeight, pixelBudget, bounds: report.boundsArchiveWorld, error: report.maximumErrorArchiveWorld, placementMatrix });
      return { ...evaluation, selection: evaluation.eligible ? 'overview' : 'full-required', reason: evaluation.eligible ? 'certified-geometry-below-pixel-budget' : evaluation.projectionReason };
    },
    dispose() { if (!disposed) { disposed = true; asset.dispose(); } },
  };
}
