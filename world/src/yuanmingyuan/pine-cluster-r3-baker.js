import * as THREE from 'three';
import { PINE_CLUSTER_AXES } from './pine-cluster-baker.js';
import { pineClusterNormalBin } from './pine-cluster-normal-distribution.js';

export const PINE_CLUSTER_R3_BINS = 6;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const half = THREE.DataUtils.toHalfFloat;

/** A bounded, deterministic first-hit raster. There is no per-polygon union
 * cache, random normal choice or averaging of hidden surfaces. The two signed
 * views share sample locations but keep different frontmost source hits. */
export function rasterPineClusterR3(geometries, frame, { tileSize = 32, subsamples = 4, signal, sampleVisitor } = {}) {
  if (![8, 16, 32, 64, 128, 256].includes(tileSize) || ![1, 2, 4, 8, 16].includes(subsamples)) throw new Error('Unsupported bounded R3 dimensions');
  if (!geometries.length || geometries.some(g => !g.index || !g.attributes.position || !g.attributes.normal || !g.attributes.color)) throw new Error('R3 needs indexed source positions, normals and colours');
  const size = tileSize * subsamples, pixels = tileSize ** 2, low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;
  for (const geometry of geometries) {
    triangleCount += geometry.index.count / 3;
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const point = [p.getX(i), p.getY(i), p.getZ(i)], projected = [dot(point, frame.u), dot(point, frame.v), dot(point, frame.normal)];
      for (let k = 0; k < 3; k++) { low[k] = Math.min(low[k], projected[k]); high[k] = Math.max(high[k], projected[k]); }
    }
  }
  if (triangleCount > 28 * 4160 || !low.concat(high).every(Number.isFinite) || high[0] <= low[0] || high[1] <= low[1]) throw new Error('R3 source exceeds one 28-shoot cluster or has invalid bounds');
  // No padded carrier enlarges the true crown. Border texels contain the same
  // source interval as interior texels; clamp is safe only inside this mesh.
  const stride = 28, triangles = new Float64Array(triangleCount * stride), first = new Int32Array(triangleCount), last = new Int32Array(triangleCount), counts = new Uint32Array(size);
  let id = 0;
  for (const geometry of geometries) {
    const { position: p, normal: n, color: c } = geometry.attributes;
    for (let t = 0; t < geometry.index.count; t += 3, id++) {
      const offset = id * stride;
      for (let j = 0; j < 3; j++) {
        const i = geometry.index.getX(t + j), point = [p.getX(i), p.getY(i), p.getZ(i)];
        triangles.set([(dot(point, frame.u) - low[0]) / (high[0] - low[0]) * size, (dot(point, frame.v) - low[1]) / (high[1] - low[1]) * size, dot(point, frame.normal), n.getX(i), n.getY(i), n.getZ(i), c.getX(i), c.getY(i), c.getZ(i)], offset + j * 9);
      }
      const x0 = triangles[offset], y0 = triangles[offset + 1], x1 = triangles[offset + 9], y1 = triangles[offset + 10], x2 = triangles[offset + 18], y2 = triangles[offset + 19];
      const determinant = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      triangles[offset + 27] = determinant;
      first[id] = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - .5)); last[id] = Math.min(size - 1, Math.floor(Math.max(y0, y1, y2) - .5));
      if (Math.abs(determinant) < 1e-18) { first[id] = 1; last[id] = 0; }
      for (let row = first[id]; row <= last[id]; row++) counts[row]++;
    }
  }
  const starts = new Uint32Array(size + 1);
  for (let y = 0; y < size; y++) starts[y + 1] = starts[y] + counts[y];
  if (starts[size] > 24000000) throw new Error('R3 scanline index exceeded the explicit 96 MiB scratch ceiling');
  const rowIds = new Uint32Array(starts[size]), cursors = starts.slice(0, size);
  for (let t = 0; t < triangleCount; t++) for (let y = first[t]; y <= last[t]; y++) rowIds[cursors[y]++] = t;
  // Each bin carries a JOINT weight, signed normal and source linear RGB.
  // These are premultiplied fields so both box mips and trilinear filtering
  // combine visibility, colour and normal consistently.
  const output = Array.from({ length: 2 }, () => ({ moments: new Float64Array(pixels * 6 * 7), depth: new Float64Array(pixels * 2), coverage: new Float64Array(pixels) }));
  const depths = [new Float64Array(size), new Float64Array(size)], hitIds = [new Int32Array(size), new Int32Array(size)], weights = [new Float64Array(size * 2), new Float64Array(size * 2)];
  let sourceSamples = 0, intervalSamples = 0, nearestTies = 0, maximumActiveTriangles = 0;
  const add = (side, x, y) => {
    const t = hitIds[side][x]; if (t < 0) return;
    const o = t * stride, b = weights[side][x * 2], c = weights[side][x * 2 + 1], a = 1 - b - c;
    const sign = (triangles[o + 27] < 0 ? -1 : 1) * (side ? -1 : 1);
    let nx = (a * triangles[o + 3] + b * triangles[o + 12] + c * triangles[o + 21]) * sign, ny = (a * triangles[o + 4] + b * triangles[o + 13] + c * triangles[o + 22]) * sign, nz = (a * triangles[o + 5] + b * triangles[o + 14] + c * triangles[o + 23]) * sign;
    const length = Math.hypot(nx, ny, nz); if (!(length > 0)) throw new Error('Source interpolated normal is singular'); nx /= length; ny /= length; nz /= length;
    const color = [6, 7, 8].map(k => a * triangles[o + k] + b * triangles[o + 9 + k] + c * triangles[o + 18 + k]);
    const pixel = Math.floor(y / subsamples) * tileSize + Math.floor(x / subsamples), bin = pineClusterNormalBin([nx, ny, nz]), m = (pixel * 6 + bin) * 7, target = output[side];
    target.moments[m]++; target.moments[m + 1] += nx; target.moments[m + 2] += ny; target.moments[m + 3] += nz;
    for (let k = 0; k < 3; k++) target.moments[m + 4 + k] += color[k];
    target.coverage[pixel]++; target.depth[pixel * 2] += depths[side][x]; target.depth[pixel * 2 + 1] += depths[side][x] ** 2;
    sourceSamples++;
    sampleVisitor?.({ x, y, side, triangle: t, depth: depths[side][x], normal: [nx, ny, nz], color, pixel, bin });
  };
  for (let y = 0; y < size; y++) {
    signal?.throwIfAborted(); depths[0].fill(-Infinity); depths[1].fill(Infinity); hitIds[0].fill(-1); hitIds[1].fill(-1);
    maximumActiveTriangles = Math.max(maximumActiveTriangles, counts[y]);
    for (let q = starts[y]; q < starts[y + 1]; q++) {
      const t = rowIds[q], o = t * stride, xs = [triangles[o], triangles[o + 9], triangles[o + 18]], ys = [triangles[o + 1], triangles[o + 10], triangles[o + 19]], py = y + .5;
      let left = Infinity, right = -Infinity;
      for (let j = 0; j < 3; j++) { const k = (j + 1) % 3; if (ys[j] === ys[k] || py < Math.min(ys[j], ys[k]) || py > Math.max(ys[j], ys[k])) continue; const x = xs[j] + (xs[k] - xs[j]) * (py - ys[j]) / (ys[k] - ys[j]); left = Math.min(left, x); right = Math.max(right, x); }
      const begin = Math.max(0, Math.ceil(left - .5)), end = Math.min(size - 1, Math.floor(right - .5));
      if (end < begin) continue;
      const denominator = triangles[o + 27], dx1 = xs[1] - xs[0], dy1 = ys[1] - ys[0], dx2 = xs[2] - xs[0], dy2 = ys[2] - ys[0];
      let b = ((begin + .5 - xs[0]) * dy2 - (py - ys[0]) * dx2) / denominator, c = (dx1 * (py - ys[0]) - dy1 * (begin + .5 - xs[0])) / denominator;
      const db = dy2 / denominator, dc = -dy1 / denominator, z0 = triangles[o + 2], zb = triangles[o + 11] - z0, zc = triangles[o + 20] - z0;
      for (let x = begin; x <= end; x++, b += db, c += dc) {
        if (b < -1e-10 || c < -1e-10 || b + c > 1 + 1e-10) continue;
        const z = z0 + b * zb + c * zc; intervalSamples++;
        for (let side = 0; side < 2; side++) {
          const closer = side ? z < depths[side][x] : z > depths[side][x];
          if (z === depths[side][x]) nearestTies++;
          // Stable later-triangle ties match LessEqual for this input order.
          // The retained source's different draw grouping is not claimed to
          // resolve distinct coincident materials in this same order.
          if (!closer && z !== depths[side][x] && hitIds[side][x] >= 0) continue;
          depths[side][x] = z; hitIds[side][x] = t; weights[side][x * 2] = b; weights[side][x * 2 + 1] = c;
        }
      }
    }
    for (let x = 0; x < size; x++) { add(0, x, y); add(1, x, y); }
  }
  return { output, low, high, frame, size, tileSize, subsamples, diagnostics: { triangleCount, sourceSamples, intervalSamples, nearestTies, maximumActiveTriangles, rowIndexBytes: rowIds.byteLength, triangleScratchBytes: triangles.byteLength, scratchPolicy: 'one fixed scanline; bounded typed triangle/row index; no fragment polygons' } };
}

export async function bakePineClusterR3(source, { tileSize = 256, subsamples = 16, grid = 24, terminals = [0, 1, 2, 3, 4, 5, 6], signal, progress } = {}) {
  // Check BEFORE allocating fields: invalid caller dimensions must not evade
  // the one-cluster memory ceiling merely to fail later in the rasterizer.
  if (![16, 32, 64, 128, 256].includes(tileSize) || ![1, 2, 4, 8, 16].includes(subsamples)) throw new Error('Unsupported bounded R3 dimensions');
  signal?.throwIfAborted();
  if (source?.terminalGeometries?.length !== 7 || source.records?.shoots?.length !== 28 || ![4, 8, 16, 24, 32].includes(grid)) throw new Error('R3 requires the retained one-cluster source and a supported carrier grid');
  if (!terminals.length || new Set(terminals).size !== terminals.length || terminals.some(i => !Number.isInteger(i) || i < 0 || i > 6)) throw new Error('Invalid R3 terminal selection');
  const started = performance.now(), pixels = tileSize ** 2, layers = 6, normals = new Uint16Array(pixels * layers * 6 * 4), colors = new Uint16Array(normals.length), visibility = new Uint16Array(pixels * layers * 4);
  const positions = [], normalAttributes = [], uv = [], indices = [], views = [], metrics = [];
  const geometries = terminals.map(i => source.terminalGeometries[i]);
  for (let axis = 0; axis < 3; axis++) {
    signal?.throwIfAborted(); const frame = PINE_CLUSTER_AXES[axis], result = rasterPineClusterR3(geometries, frame, { tileSize, subsamples, signal });
    for (let side = 0; side < 2; side++) {
      const layer = axis * 2 + side, field = result.output[side], invSamples = 1 / subsamples ** 2;
      let covered = 0, partial = 0, sum = 0, binWeightError = 0;
      for (let pixel = 0; pixel < pixels; pixel++) {
        const coverage = field.coverage[pixel] * invSamples, at = (layer * pixels + pixel) * 4;
        visibility[at] = half(field.depth[pixel * 2] * invSamples); visibility[at + 1] = half(field.depth[pixel * 2 + 1] * invSamples); visibility[at + 3] = half(coverage);
        if (coverage) { covered++; sum += coverage; if (coverage < 1) partial++; }
        let recovered = 0;
        for (let bin = 0; bin < 6; bin++) {
          const m = (pixel * 6 + bin) * 7, out = ((layer * 6 + bin) * pixels + pixel) * 4;
          normals[out + 3] = colors[out + 3] = half(field.moments[m] * invSamples); recovered += THREE.DataUtils.fromHalfFloat(normals[out + 3]);
          for (let k = 0; k < 3; k++) { normals[out + k] = half(field.moments[m + 1 + k] * invSamples); colors[out + k] = half(field.moments[m + 4 + k] * invSamples); }
        }
        binWeightError = Math.max(binWeightError, Math.abs(recovered - coverage));
      }
      const offset = positions.length / 3, viewNormal = frame.normal.map(n => n * (side ? -1 : 1));
      for (let y = 0; y <= grid; y++) for (let x = 0; x <= grid; x++) {
        const u = x / grid, v = y / grid, centreX = u * tileSize, centreY = v * tileSize, radius = tileSize / grid * .65;
        let weight = 0, depth = 0;
        for (let py = Math.max(0, Math.floor(centreY - radius)); py < Math.min(tileSize, Math.ceil(centreY + radius)); py++) for (let px = Math.max(0, Math.floor(centreX - radius)); px < Math.min(tileSize, Math.ceil(centreX + radius)); px++) { const i = py * tileSize + px; weight += field.coverage[i]; depth += field.depth[i * 2]; }
        depth = weight ? depth / weight : (result.low[2] + result.high[2]) * .5;
        positions.push(...frame.u.map((value, i) => value * (result.low[0] + u * (result.high[0] - result.low[0])) + frame.v[i] * (result.low[1] + v * (result.high[1] - result.low[1])) + frame.normal[i] * depth));
        normalAttributes.push(...viewNormal); uv.push(u, v);
      }
      const start = indices.length;
      for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) { const a = offset + y * (grid + 1) + x, b = a + 1, c = a + grid + 1, d = c + 1; if (side) indices.push(a, d, b, a, c, d); else indices.push(a, b, d, a, d, c); }
      views.push({ layer, axis, side, normal: viewNormal, frame, min: result.low, max: result.high, start, count: indices.length - start });
      metrics.push({ layer, coveredTexels: covered, partialTexels: partial, coverageSum: sum, maximumHalfWeightError: binWeightError, raster: result.diagnostics });
    }
    progress?.({ axis, completedViews: (axis + 1) * 2, elapsedMilliseconds: performance.now() - started, heapUsed: typeof process !== 'undefined' ? process.memoryUsage().heapUsed : null });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalAttributes, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  let disposed = false;
  const bytes = normals.byteLength + colors.byteLength + visibility.byteLength;
  return { width: tileSize, height: tileSize, layers, normals, colors, visibility, geometry, views,
    diagnostics: { revision: 'r3', sourceRecordId: source.records.id, sourceSha256: source.records.source.sha256, sourceTriangles: source.diagnostics.triangles, partial: terminals.length !== 7, terminals, views: 6, bins: 6, quadratureDirectionsPerBin: 4, deterministicPbrEvaluations: 24, subpixelSamplesPerTexel: subsamples ** 2, carrierGrid: grid, storedFoliageTriangles: indices.length / 3, submittedFoliageTrianglesPerPass: grid ** 2 * 2, textureBytes: bytes, textureBytesWithMipsUpperBound: Math.ceil(bytes * 4 / 3), metrics, milliseconds: performance.now() - started, completeTreeConstructed: false, mainSceneAllowed: false, nativeReviewed: false },
    dispose() { if (disposed) return; disposed = true; geometry.dispose(); this.normals = this.colors = this.visibility = null; },
  };
}
