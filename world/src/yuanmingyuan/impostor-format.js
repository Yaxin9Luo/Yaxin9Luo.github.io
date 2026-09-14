import * as THREE from 'three';

export const IMPOSTOR_SCHEMA = 1;
export const IMPOSTOR_MAPS = ['base', 'normalRoughness', 'depthMaterial', 'emission'];
export const IMPOSTOR_MAX_GRID = 4; // This first study never schedules a 64-view bake.
export const IMPOSTOR_PASSES = Object.freeze({ beauty: true, surfaceDepth: true, reflectionView: true, shadow: false, normalPrepass: false, nativeReviewed: false, mainSceneAllowed: false });
const V = a => new THREE.Vector3().fromArray(a);
const sign = value => value < 0 ? -1 : 1;

export function encodeOctahedral(direction) {
  const d = V(direction); if (!Number.isFinite(d.lengthSq()) || !d.lengthSq()) throw new Error('A nonzero view direction is required');
  d.divideScalar(Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z));
  const x = d.y < 0 ? (1 - Math.abs(d.z)) * sign(d.x) : d.x;
  const z = d.y < 0 ? (1 - Math.abs(d.x)) * sign(d.z) : d.z;
  return [(x + 1) / 2, (z + 1) / 2];
}

export function decodeOctahedral(uv) {
  let x = uv[0] * 2 - 1, z = uv[1] * 2 - 1; const y = 1 - Math.abs(x) - Math.abs(z);
  if (y < 0) { const old = x; x = (1 - Math.abs(z)) * sign(x); z = (1 - Math.abs(old)) * sign(z); }
  return new THREE.Vector3(x, y, z).normalize().toArray();
}

export function selectImpostorFrames(direction, gridSize) {
  if (!Number.isInteger(gridSize) || gridSize < 2 || gridSize > IMPOSTOR_MAX_GRID) throw new Error('The small study supports grids of 2–4 only');
  const [u, v] = encodeOctahedral(direction).map(value => THREE.MathUtils.clamp(value, 0, 1) * (gridSize - 1));
  const x = Math.min(gridSize - 2, Math.floor(u)), y = Math.min(gridSize - 2, Math.floor(v)), a = u - x, b = v - y;
  return a + b <= 1
    ? [{ index: y * gridSize + x, weight: 1 - a - b }, { index: y * gridSize + x + 1, weight: a }, { index: (y + 1) * gridSize + x, weight: b }]
    : [{ index: (y + 1) * gridSize + x + 1, weight: a + b - 1 }, { index: (y + 1) * gridSize + x, weight: 1 - a }, { index: y * gridSize + x + 1, weight: 1 - b }];
}

export function createImpostorFrames(bounds, gridSize = 4) {
  selectImpostorFrames([0, 1, 0], gridSize);
  if (!bounds || ![bounds.min, bounds.max].every(a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite)) || bounds.min.some((v, i) => v >= bounds.max[i])) throw new Error('Nonempty finite three-dimensional source bounds are required');
  const box = new THREE.Box3(V(bounds.min), V(bounds.max)), center = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() * .525;
  const frames = [];
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
    const direction = V(decodeOctahedral([x / (gridSize - 1), y / (gridSize - 1)]));
    const upReference = Math.abs(direction.y) > .98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = upReference.cross(direction).normalize(), up = direction.clone().cross(right).normalize();
    frames.push({ index: frames.length, direction: direction.toArray(), right: right.toArray(), up: up.toArray() });
  }
  return { gridSize, center: center.toArray(), radius, bounds: { min: [...bounds.min], max: [...bounds.max] }, frames };
}

export function packDepth16(value) { const n = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 65535); return [n >>> 8, n & 255]; }
export const unpackDepth16 = (a, b) => (a * 256 + b) / 65535;
export const srgbToLinear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
export const linearToSrgb = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;

export function validateImpostorData(data) {
  const m = data?.manifest;
  if (m?.schema !== IMPOSTOR_SCHEMA || m.kind !== 'yuanmingyuan-material-impostor-study' || m.mainSceneAllowed !== false || m.sourceGeometryRetained !== true || m.nativeReviewed !== false) throw new Error('Unsupported impostor study manifest');
  if (!Number.isInteger(m.tileSize) || m.tileSize < 4 || m.tileSize > 256 || !Number.isInteger(m.gridSize) || m.gridSize < 2 || m.gridSize > IMPOSTOR_MAX_GRID) throw new Error('Invalid small-study dimensions');
  const layout = createImpostorFrames(m.bounds, m.gridSize);
  if (!Array.isArray(m.center) || m.center.length !== 3 || m.center.some((v, i) => !Number.isFinite(v) || Math.abs(v - layout.center[i]) > 1e-8) || !Number.isFinite(m.radius) || Math.abs(m.radius - layout.radius) > 1e-8) throw new Error('Impostor capture frame bounds mismatch');
  const count = m.tileSize * m.tileSize * m.gridSize ** 2 * 4;
  for (const key of IMPOSTOR_MAPS) if (!(data.maps?.[key] instanceof Uint8Array) || data.maps[key].length !== count) throw new Error(`Incomplete impostor ${key} pixels`);
  return layout;
}

export function sampleImpostorData(data, frameIndex, uv) {
  const { tileSize, gridSize } = data.manifest;
  if (frameIndex < 0 || frameIndex >= gridSize ** 2 || uv.some(v => v < 0 || v > 1)) return null;
  const x = Math.min(tileSize - 1, Math.floor(uv[0] * tileSize)), y = Math.min(tileSize - 1, Math.floor(uv[1] * tileSize)), i = (frameIndex * tileSize * tileSize + y * tileSize + x) * 4;
  const { base, normalRoughness: n, depthMaterial: d, emission: e } = data.maps;
  return { coverage: base[i + 3] / 255, albedo: [0, 1, 2].map(k => srgbToLinear(base[i + k] / 255)), normal: new THREE.Vector3(n[i] / 127.5 - 1, n[i + 1] / 127.5 - 1, n[i + 2] / 127.5 - 1).normalize().toArray(), roughness: n[i + 3] / 255, depth: unpackDepth16(d[i], d[i + 1]), metalness: d[i + 2] / 255, ao: d[i + 3] / 255, emission: [0, 1, 2].map(k => srgbToLinear(e[i + k] / 255)) };
}

export function intersectImpostorBounds(origin, direction, bounds) {
  let near = -Infinity, far = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-12) { if (origin[i] < bounds.min[i] || origin[i] > bounds.max[i]) return null; continue; }
    const a = (bounds.min[i] - origin[i]) / direction[i], b = (bounds.max[i] - origin[i]) / direction[i]; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
  }
  return far >= Math.max(0, near) ? { near: Math.max(0, near), far } : null;
}

// CPU reference for a 2D DDA through the captured texel grid along a 3D ray.
// No empty texel is filled or dilated. Each occupied texel contributes its
// actual front depth only when the ray crosses that texel's depth plane.
export function traceImpostorRay({ layout, tileSize, origin, direction, sample, coverageCutoff = .01 }) {
  const O = V(origin), D = V(direction).normalize(), C = V(layout.center), interval = intersectImpostorBounds(origin, D.toArray(), layout.bounds);
  if (!interval) return null;
  const selected = selectImpostorFrames(D.clone().negate().toArray(), layout.gridSize), tolerance = layout.radius * 2 / tileSize, candidates = [];
  for (const selectedFrame of selected) {
    if (selectedFrame.weight <= 1e-6) continue;
    const frame = layout.frames[selectedFrame.index], N = V(frame.direction), R = V(frame.right), U = V(frame.up), denominator = D.dot(N);
    if (denominator > -1e-5) continue;
    const delta = O.clone().sub(C), uvOrigin = [delta.dot(R) / (2 * layout.radius) + .5, delta.dot(U) / (2 * layout.radius) + .5], uvVelocity = [D.dot(R) / (2 * layout.radius), D.dot(U) / (2 * layout.radius)];
    const cell = uvOrigin.map((u, axis) => Math.floor(THREE.MathUtils.clamp(u + uvVelocity[axis] * interval.near, 0, 1 - 1e-10) * tileSize));
    const steps = uvVelocity.map(v => Math.abs(v) < 1e-12 ? 0 : Math.sign(v));
    const next = uvVelocity.map((v, axis) => !steps[axis] ? Infinity : ((cell[axis] + (steps[axis] > 0 ? 1 : 0)) / tileSize - uvOrigin[axis]) / v);
    const strides = uvVelocity.map((v, axis) => !steps[axis] ? Infinity : 1 / (tileSize * Math.abs(v)));
    const cellEpsilon = 2 * layout.radius / tileSize * 1e-5; let t = interval.near, best = null;
    for (let step = 0; step < tileSize * 2 + 4; step++) {
      if (cell.some(v => v < 0 || v >= tileSize) || t > interval.far) break;
      const exit = Math.min(...next, interval.far), pixel = sample(frame.index, cell.map(v => (v + .5) / tileSize));
      if (pixel && pixel.coverage > coverageCutoff) {
        const height = (.5 - pixel.depth) * 2 * layout.radius, point = C.clone().addScaledVector(R, ((cell[0] + .5) / tileSize - .5) * 2 * layout.radius).addScaledVector(U, ((cell[1] + .5) / tileSize - .5) * 2 * layout.radius).addScaledVector(N, height), planeNormal = V(pixel.normal).normalize(), planeDenominator = D.dot(planeNormal);
        const hitT = Math.abs(planeDenominator) < 1e-5 ? Infinity : point.sub(O).dot(planeNormal) / planeDenominator;
        if (hitT >= t - cellEpsilon && hitT <= exit + cellEpsilon && hitT >= 0) { best = { ...pixel, t: hitT, frame: frame.index, weight: selectedFrame.weight, position: O.clone().addScaledVector(D, hitT).toArray() }; break; }
      }
      if (exit >= interval.far) break;
      // Cross both axes at corners; never revisit the same zero-width cell.
      const crossX = next[0] <= next[1], crossY = next[1] <= next[0]; t = exit;
      if (crossX) { cell[0] += steps[0]; next[0] += strides[0]; }
      if (crossY) { cell[1] += steps[1]; next[1] += strides[1]; }
    }
    if (best) candidates.push(best);
  }
  if (!candidates.length) return null;
  const front = Math.min(...candidates.map(c => c.t)), matching = candidates.filter(c => Math.abs(c.t - front) <= tolerance * 2), weight = matching.reduce((s, c) => s + c.weight * c.coverage, 0);
  if (!weight) return null;
  const result = { position: O.clone().addScaledVector(D, front).toArray(), t: front, selected: matching.map(c => c.frame), coverage: weight / matching.reduce((s, c) => s + c.weight, 0), albedo: [0, 0, 0], normal: [0, 0, 0], emission: [0, 0, 0], roughness: 0, metalness: 0, ao: 0 };
  for (const p of matching) { const w = p.weight * p.coverage / weight; for (const key of ['albedo', 'normal', 'emission']) for (let i = 0; i < 3; i++) result[key][i] += p[key][i] * w; for (const key of ['roughness', 'metalness', 'ao']) result[key] += p[key] * w; }
  result.normal = V(result.normal).normalize().toArray(); return result;
}
