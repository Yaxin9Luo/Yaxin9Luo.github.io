import * as THREE from 'three';
import { PINE_CLUSTER_NORMAL_BINS, pineClusterNormalBin } from './pine-cluster-normal-distribution.js';

export const PINE_CLUSTER_AXES = Object.freeze([
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function clip(poly, component, bound, keepGreater) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = (a[component] - bound) * (keepGreater ? 1 : -1), db = (b[component] - bound) * (keepGreater ? 1 : -1);
    if (da >= 0) out.push(a);
    if (da < 0 && db > 0 || da > 0 && db < 0) { const t = da / (da - db); out.push(a.map((value, j) => value + (b[j] - value) * t)); }
  }
  return out;
}
export function pineClusterPolygonArea(poly) {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; twice += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(twice) / 2;
}

/** Union of original convex polygons by a y sweep. Between vertex/edge
 * intersection events the union length is affine. Subtraction never creates
 * new fragments, and production retains only one scanline of input polygons. */
export function pineClusterUnionArea(polygons) {
  if (!polygons?.length) return 0;
  if (polygons.length === 1) return pineClusterPolygonArea(polygons[0]);
  const events = [], edges = [];
  for (let shape = 0; shape < polygons.length; shape++) {
    const polygon = polygons[shape];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]; events.push(a[1]);
      if (a[0] !== b[0] || a[1] !== b[1]) edges.push({ a, b, shape });
    }
  }
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j]; if (a.shape === b.shape) continue;
    const ax = a.b[0] - a.a[0], ay = a.b[1] - a.a[1], bx = b.b[0] - b.a[0], by = b.b[1] - b.a[1], denominator = ax * by - ay * bx;
    if (denominator === 0) continue;
    const ox = b.a[0] - a.a[0], oy = b.a[1] - a.a[1], t = (ox * by - oy * bx) / denominator, u = (ox * ay - oy * ax) / denominator;
    if (t > 0 && t < 1 && u > 0 && u < 1) events.push(a.a[1] + t * ay);
  }
  events.sort((a, b) => a - b); let area = 0;
  for (let i = 0; i + 1 < events.length; i++) {
    const low = events[i], high = events[i + 1]; if (!(high > low)) continue;
    const y = (low + high) / 2, intervals = [];
    for (const polygon of polygons) {
      let left = Infinity, right = -Infinity;
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length];
        if (a[1] === b[1] || y < Math.min(a[1], b[1]) || y >= Math.max(a[1], b[1])) continue;
        const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); left = Math.min(left, x); right = Math.max(right, x);
      }
      if (right > left) intervals.push([left, right]);
    }
    intervals.sort((a, b) => a[0] - b[0]); let length = 0, end = -Infinity;
    for (const [left, right] of intervals) { if (right > end) length += right - Math.max(left, end); end = Math.max(end, right); }
    area += length * (high - low);
  }
  return area;
}
function localPolygon(polygon, x, y) { return polygon.map(p => [p[0] - x, p[1] - y]); }
function unionCoverage(coverage, index, polygon, x, y) {
  const fragments = coverage.fragments ??= new Map(), existing = fragments.get(index) ?? [];
  existing.push(localPolygon(polygon, x, y)); fragments.set(index, existing); coverage[index] = Math.min(1, pineClusterUnionArea(existing));
}

/** Integrate actual triangle area in each fine pixel. Thin slivers contribute
 * even when no centre sample hits. The production baker supplies a row sink,
 * so no full-image polygon cache is allocated. */
export function rasterPineClusterTriangle(vertices, resolution, coverage, moments = null, subsamples = 1, onlyRow = null) {
  const minY = Math.max(0, Math.floor(Math.min(...vertices.map(v => v[1])))), maxY = Math.min(resolution - 1, Math.floor(Math.max(...vertices.map(v => v[1]))));
  let areaTotal = 0, touched = 0;
  for (let y = onlyRow === null ? minY : Math.max(minY, onlyRow); y <= (onlyRow === null ? maxY : Math.min(maxY, onlyRow)); y++) {
    const row = clip(clip(vertices, 1, y, true), 1, y + 1, false); if (row.length < 3) continue;
    const minX = Math.max(0, Math.floor(Math.min(...row.map(v => v[0])))), maxX = Math.min(resolution - 1, Math.floor(Math.max(...row.map(v => v[0]))));
    for (let x = minX; x <= maxX; x++) {
      const polygon = clip(clip(row, 0, x, true), 0, x + 1, false); if (polygon.length < 3) continue;
      const area = pineClusterPolygonArea(polygon); if (area < 1e-14) continue;
      if (typeof coverage === 'function') coverage(y * resolution + x, polygon, x, y);
      else unionCoverage(coverage, y * resolution + x, polygon, x, y);
      areaTotal += area; touched++;
      if (!moments) continue;
      const pixel = (Math.floor(y / subsamples) * (resolution / subsamples) + Math.floor(x / subsamples)) * 8;
      // A fan integrates each linearly interpolated attribute exactly. No
      // nearest-texel normal/colour fetch is introduced at the needle tips.
      for (let j = 1; j + 1 < polygon.length; j++) {
        const a = polygon[0], b = polygon[j], c = polygon[j + 1], triangleArea = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
        if (typeof moments === 'function') { moments(pixel, triangleArea, a, b, c); continue; }
        moments[pixel] += triangleArea;
        for (let k = 0; k < 7; k++) moments[pixel + k + 1] += triangleArea * (a[k + 2] + b[k + 2] + c[k + 2]) / 3;
      }
    }
  }
  return { areaTotal, touched };
}

export function pineClusterCoverageMip(level) {
  const width = Math.max(1, level.width >> 1), height = Math.max(1, level.height >> 1), data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) data[(y * width + x) * 4 + c] += level.data[((y * 2 + dy) * level.width + x * 2 + dx) * 4 + c] / 4;
  }
  return { width, height, data };
}

/** One secondary branch, seven real four-shoot sprays. No source triangle is
 * simplified or deleted. Each spray is represented by two depth slabs for
 * each of three fixed object-space axes, with continuous folded sheets. */
export async function bakePineCluster(source, { tileSize = 128, subsamples = 4, grid = 4, signal, progress, terminals = [0, 1, 2, 3, 4, 5, 6] } = {}) {
  if (source?.terminalGeometries?.length !== 7 || source.records?.shoots?.length !== 28) throw new Error('Expected the retained 28-shoot source cluster');
  if (![32, 64, 128, 256].includes(tileSize) || ![1, 2, 4, 8].includes(subsamples) || ![1, 2, 4, 8].includes(grid)) throw new Error('Unsupported cluster bake dimensions');
  if (!terminals.length || new Set(terminals).size !== terminals.length || terminals.some(t => !Number.isInteger(t) || t < 0 || t > 6)) throw new Error('Invalid terminal selection');
  const started = performance.now(), layers = 42, pixels = tileSize * tileSize, highSize = tileSize * subsamples;
  const base = new Uint16Array(pixels * layers * 4), normal = new Uint16Array(base.length), normalBins = new Uint16Array(base.length * PINE_CLUSTER_NORMAL_BINS), positions = [], normals = [], uv = [], layerIds = [], axes = [], indices = [], sheets = [], metrics = [];
  let maximumRowFragments = 0, maximumRowPolygonsPerCell = 0;
  for (const terminal of terminals) {
    signal?.throwIfAborted();
    const geometry = source.terminalGeometries[terminal], p = geometry.attributes.position, n = geometry.attributes.normal, color = geometry.attributes.color;
    for (let axis = 0; axis < 3; axis++) {
      const frame = PINE_CLUSTER_AXES[axis], coordinates = new Float64Array(p.count * 3), low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.count; i++) {
        const point = [p.getX(i), p.getY(i), p.getZ(i)], q = [dot(point, frame.u), dot(point, frame.v), dot(point, frame.normal)];
        q.forEach((value, j) => { coordinates[i * 3 + j] = value; low[j] = Math.min(low[j], value); high[j] = Math.max(high[j], value); });
      }
      // Two complete zero-coverage texels separate the model from texture clamp.
      for (let i = 0; i < 2; i++) { const pad = (high[i] - low[i]) * 2 / (tileSize - 4); low[i] -= pad; high[i] += pad; }
      const middle = (low[2] + high[2]) / 2, covers = [new Float32Array(highSize * highSize), new Float32Array(highSize * highSize)], moments = [new Float64Array(pixels * 8), new Float64Array(pixels * 8)];
      const binMoments = [new Float64Array(pixels * PINE_CLUSTER_NORMAL_BINS * 4), new Float64Array(pixels * PINE_CLUSTER_NORMAL_BINS * 4)];
      const triangles = [[], []], rows = [Array.from({ length: highSize }, () => []), Array.from({ length: highSize }, () => [])];
      for (let triangle = 0; triangle < geometry.index.count; triangle += 3) {
        const ids = [0, 1, 2].map(offset => geometry.index.getX(triangle + offset)), points = ids.map(i => new THREE.Vector3().fromBufferAttribute(p, i));
        const facing = new THREE.Vector3().crossVectors(points[1].sub(points[0]), points[2].sub(points[0])).dot(new THREE.Vector3(...frame.normal)) < 0 ? -1 : 1;
        const mean = new THREE.Vector3(); for (const i of ids) mean.add(new THREE.Vector3().fromBufferAttribute(n, i));
        const bin = pineClusterNormalBin(mean.multiplyScalar(facing));
        const vertices = [0, 1, 2].map(offset => {
          const i = ids[offset], direction = [n.getX(i), n.getY(i), n.getZ(i)];
          // DoubleSide chooses one sign from actual triangle winding. Flipping
          // each shading vertex independently changes the source normal field.
          return [(coordinates[i * 3] - low[0]) / (high[0] - low[0]) * highSize, (coordinates[i * 3 + 1] - low[1]) / (high[1] - low[1]) * highSize, coordinates[i * 3 + 2], ...direction.map(value => value * facing), color.getX(i), color.getY(i), color.getZ(i), bin];
        });
        for (let slab = 0; slab < 2; slab++) {
          if (slab === 0 && vertices.every(vertex => vertex[2] === middle)) continue;
          const polygon = clip(vertices, 2, middle, slab === 1);
          for (let i = 1; i + 1 < polygon.length; i++) {
            const triangle = [polygon[0], polygon[i], polygon[i + 1]], id = triangles[slab].length; triangles[slab].push(triangle);
            const first = Math.max(0, Math.floor(Math.min(...triangle.map(v => v[1])))), last = Math.min(highSize - 1, Math.floor(Math.max(...triangle.map(v => v[1]))));
            for (let row = first; row <= last; row++) rows[slab][row].push(id);
          }
        }
      }
      for (let slab = 0; slab < 2; slab++) {
        const integrate = (pixel, area, a, b, c) => {
          moments[slab][pixel] += area;
          for (let k = 0; k < 7; k++) moments[slab][pixel + k + 1] += area * (a[k + 2] + b[k + 2] + c[k + 2]) / 3;
          const bin = Math.round(a[9]), offset = (pixel / 8 * PINE_CLUSTER_NORMAL_BINS + bin) * 4;
          binMoments[slab][offset] += area;
          for (let k = 0; k < 3; k++) binMoments[slab][offset + k + 1] += area * (a[k + 3] + b[k + 3] + c[k + 3]) / 3;
        };
        for (let y = 0; y < highSize; y++) {
          const cells = new Map(); let rowFragments = 0;
          const sink = (_index, polygon, x) => {
            if (cells.get(x) === null) return;
            const piece = localPolygon(polygon, x, y);
            if (pineClusterPolygonArea(piece) >= 1 - 1e-12) { cells.set(x, null); return; }
            const polygons = cells.get(x) ?? []; polygons.push(piece); cells.set(x, polygons); rowFragments++;
            maximumRowPolygonsPerCell = Math.max(maximumRowPolygonsPerCell, polygons.length);
            if (rowFragments > 150000) throw new Error('Cluster scanline scratch budget exceeded; no geometry is omitted');
          };
          for (const id of rows[slab][y]) rasterPineClusterTriangle(triangles[slab][id], highSize, sink, integrate, subsamples, y);
          for (const [x, polygons] of cells) covers[slab][y * highSize + x] = polygons === null ? 1 : Math.min(1, pineClusterUnionArea(polygons));
          maximumRowFragments = Math.max(maximumRowFragments, rowFragments);
          cells.clear(); rows[slab][y].length = 0;
        }
        triangles[slab].length = 0;
      }
      for (let slab = 0; slab < 2; slab++) {
        const layer = terminal * 6 + axis * 2 + slab, cover = covers[slab], moment = moments[slab], meanDepth = new Float32Array(pixels), alpha = new Float32Array(pixels);
        const slabLow = slab ? middle : low[2], slabHigh = slab ? high[2] : middle, centreDepth = (slabLow + slabHigh) / 2;
        let coverageSum = 0, projectedArea = 0, positivePixels = 0, minimumAlpha = 1, maximumAlpha = 0;
        for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
          const pixel = y * tileSize + x, m = pixel * 8, output = (layer * pixels + pixel) * 4;
          let amount = 0;
          for (let sy = 0; sy < subsamples; sy++) for (let sx = 0; sx < subsamples; sx++) amount += Math.min(1, cover[(y * subsamples + sy) * highSize + x * subsamples + sx]) / (subsamples * subsamples);
          alpha[pixel] = amount; coverageSum += amount; projectedArea += moment[m] / (subsamples * subsamples);
          meanDepth[pixel] = moment[m] ? moment[m + 1] / moment[m] : centreDepth;
          if (amount > 0) { positivePixels++; minimumAlpha = Math.min(minimumAlpha, amount); maximumAlpha = Math.max(maximumAlpha, amount); }
          for (let c = 0; c < 3; c++) {
            const originalColor = moment[m] ? moment[m + 5 + c] / moment[m] : 0, averageNormal = moment[m] ? moment[m + 2 + c] / moment[m] : frame.normal[c];
            // Linear premultiplied HALF_FLOAT fields. Hardware box/trilinear
            // filtering conserves mean coverage; black empty texels cannot
            // contaminate straight RGB or bend a low-alpha normal toward zero.
            base[output + c] = THREE.DataUtils.toHalfFloat(originalColor * amount);
            normal[output + c] = THREE.DataUtils.toHalfFloat((averageNormal * .5 + .5) * amount);
          }
          base[output + 3] = normal[output + 3] = THREE.DataUtils.toHalfFloat(amount);
          for (let bin = 0; bin < PINE_CLUSTER_NORMAL_BINS; bin++) {
            const sourceOffset = (pixel * PINE_CLUSTER_NORMAL_BINS + bin) * 4, targetOffset = ((layer * PINE_CLUSTER_NORMAL_BINS + bin) * pixels + pixel) * 4, area = binMoments[slab][sourceOffset];
            const weight = moment[m] ? amount * area / moment[m] : 0;
            for (let k = 0; k < 3; k++) normalBins[targetOffset + k] = THREE.DataUtils.toHalfFloat((area ? binMoments[slab][sourceOffset + k + 1] / area * .5 + .5 : 0) * weight);
            normalBins[targetOffset + 3] = THREE.DataUtils.toHalfFloat(weight);
          }
        }
        const offset = positions.length / 3;
        for (let y = 0; y <= grid; y++) for (let x = 0; x <= grid; x++) {
          const u = x / grid, v = y / grid, px = u * tileSize, py = v * tileSize, reach = tileSize / grid * .65;
          let depth = 0, weight = 0;
          for (let sy = Math.max(0, Math.floor(py - reach)); sy < Math.min(tileSize, Math.ceil(py + reach)); sy++) for (let sx = Math.max(0, Math.floor(px - reach)); sx < Math.min(tileSize, Math.ceil(px + reach)); sx++) {
            const i = sy * tileSize + sx, w = alpha[i]; depth += meanDepth[i] * w; weight += w;
          }
          depth = weight ? THREE.MathUtils.clamp(depth / weight, slabLow, slabHigh) : centreDepth;
          const point = frame.u.map((value, i) => value * (low[0] + u * (high[0] - low[0])) + frame.v[i] * (low[1] + v * (high[1] - low[1])) + frame.normal[i] * depth);
          positions.push(...point); normals.push(...frame.normal); uv.push(u, v); layerIds.push(layer); axes.push(axis);
        }
        for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) { const a = offset + y * (grid + 1) + x, b = a + 1, c = a + grid + 1, d = c + 1; indices.push(a, b, d, a, d, c); }
        const sheet = { layer, terminal, axis, slab, frame, projectedBounds: { min: low, max: high }, depthRange: [slabLow, slabHigh], vertexOffset: offset, vertexCount: (grid + 1) ** 2 };
        sheets.push(sheet); metrics.push({ layer, coverageSum, projectedAreaWithOverdraw: projectedArea, positivePixels, minimumAlpha, maximumAlpha, meanAlpha: coverageSum / pixels });
      }
    }
    progress?.({ terminal: terminal + 1, total: terminals.length, maximumRowFragments, maximumRowPolygonsPerCell, milliseconds: performance.now() - started });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted();
  const geometry = new THREE.BufferGeometry(); geometry.name = 'pine-cluster-six-folded-sheets-per-terminal';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('clusterLayer', new THREE.Float32BufferAttribute(layerIds, 1)); geometry.setAttribute('clusterAxis', new THREE.Float32BufferAttribute(axes, 1)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  let disposed = false;
  return { geometry, base, normal, normalBins, width: tileSize, height: tileSize, layers, sheets,
    diagnostics: { version: 2, normalFieldVersion: 2, normalBins: PINE_CLUSTER_NORMAL_BINS, type: 'actual-terminal-sprays-three-axes-two-depth-slabs', processedTerminals: [...terminals], partial: terminals.length !== 7, scratch: { scope: 'one scanline of original projected convex fragments; no subtraction fragments', maximumRowFragments, maximumRowPolygonsPerCell }, sourceRecordId: source.records.id, sourceSha256: source.records.source.sha256, tileSize, subsamples, grid, layers, cardTriangles: geometry.index.count / 3, baseTextureBytes: base.byteLength + normal.byteLength + normalBins.byteLength, textureBytesWithMipsUpperBound: Math.ceil((base.byteLength + normal.byteLength + normalBins.byteLength) * 4 / 3), milliseconds: performance.now() - started, coverage: 'analytical scanline union of original projected convex fragments per microcell, up to floating-point closure; linear premultiplied half-float field and mean-preserving hardware mipmaps', coverageIsExactUnion: true, lighting: 'actual geometric DoubleSide orientation; six projected-area normal bins with four unit first-moment-preserving directions per bin; ordinary PBR with original colour and roughness, native distribution/grain pending', metrics, nativeReviewed: false, mainSceneAllowed: false },
    dispose() { if (disposed) return; disposed = true; geometry.dispose(); },
  };
}
