import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BASES = [
  { id: 'xy', u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },
  { id: 'zy', u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0] },
  { id: 'xz', u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0] },
];
const srgb = x => x <= .0031308 ? x * 12.92 : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - .055;
const clampByte = x => Math.round(THREE.MathUtils.clamp(x, 0, 1) * 255);

/** Connected source triangles are classified by their actual topology. No
 * needle positions or replacement branches are regenerated from the RNG. */
export function partitionPineShoot(geometry) {
  const position = geometry?.attributes.position, normal = geometry?.attributes.normal, color = geometry?.attributes.color, index = geometry?.index;
  if (geometry?.userData.body !== 'ramified-pine-shoot-with-paired-needles' || !index || !position || !normal || !color) throw new Error('Expected the real indexed pineShootGeometry source');
  const parents = new Uint32Array(position.count).map((_, i) => i);
  const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
  for (let i = 0; i < index.count; i += 3) { union(index.getX(i), index.getX(i + 1)); union(index.getX(i), index.getX(i + 2)); }
  const components = new Map();
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], key = find(ids[0]);
    if (!components.has(key)) components.set(key, { triangles: [], vertices: new Set() });
    const part = components.get(key); part.triangles.push(i / 3); ids.forEach(id => part.vertices.add(id));
  }
  const wood = [], needles = [];
  for (const part of components.values()) {
    part.vertices = [...part.vertices].sort((a, b) => a - b);
    if (part.triangles.length === 80 && part.vertices.length === 50) { wood.push(part); continue; }
    if (part.triangles.length !== 8 || part.vertices.length !== 10) throw new Error('Source component topology changed; refusing to silently omit it');
    const mean = V(), centre = V(), a = V(), b = V(), c = V();
    for (const t of part.triangles) {
      a.fromBufferAttribute(position, index.getX(t * 3)); b.fromBufferAttribute(position, index.getX(t * 3 + 1)); c.fromBufferAttribute(position, index.getX(t * 3 + 2));
      mean.add(b.sub(a).cross(c.sub(a)));
    }
    if (mean.lengthSq() < 1e-24) throw new Error('Degenerate source needle normal');
    mean.normalize(); part.vertices.forEach(id => centre.add(V().fromBufferAttribute(position, id))); centre.divideScalar(part.vertices.length);
    Object.assign(part, { normal: mean.toArray(), centre: centre.toArray() }); needles.push(part);
  }
  if (wood.length !== geometry.userData.woodyShoots || needles.length !== geometry.userData.needles || wood.length !== 6 || needles.length !== 460) throw new Error('Source component census differs from the seed-218 repeat unit');
  // The frozen helper emits each real woody branch followed by its own needles.
  // Use that actual index stream to avoid flattening leaves from distant forks
  // onto one whole-shoot plane. No branch/needle geometry is regenerated here.
  wood.sort((a, b) => a.triangles[0] - b.triangles[0]);
  const branchFamilies = wood.map((_, branch) => BASES.map(b => ({ ...b, basisId: b.id, id: 'wood-' + branch + '-' + b.id, branch, u: V(...b.u), v: V(...b.v), n: V(...b.n), needles: [], triangles: [] })));
  for (const needle of needles) {
    const branch = wood.findLastIndex(w => w.triangles[0] < needle.triangles[0]);
    if (branch < 0) throw new Error('A source needle precedes its wood block');
    const mean = V(...needle.normal); let family = branchFamilies[branch][0], alignment = -1;
    for (const candidate of branchFamilies[branch]) { const dot = Math.abs(mean.dot(candidate.n)); if (dot > alignment) { family = candidate; alignment = dot; } }
    Object.assign(needle, { branch, family: family.id, alignment }); family.needles.push(needle); family.triangles.push(...needle.triangles);
  }
  const families = branchFamilies.flat().filter(family => family.needles.length);
  for (const family of families) {
    const projected = family.needles.flatMap(part => part.vertices.map(id => { const p = V().fromBufferAttribute(position, id); return [p.dot(family.u), p.dot(family.v), p.dot(family.n)]; }));
    if (!projected.length) throw new Error('A source-normal family is empty');
    family.bounds = { min: [0, 1, 2].map(k => Math.min(...projected.map(p => p[k]))), max: [0, 1, 2].map(k => Math.max(...projected.map(p => p[k]))) };
  }
  return { wood, needles, families, sourceTriangles: index.count / 3, sourceVertices: position.count };
}

function subsetGeometry(source, triangles, name) {
  const vertices = [...new Set(triangles.flatMap(t => [0, 1, 2].map(k => source.index.getX(t * 3 + k))))].sort((a, b) => a - b), remap = new Map(vertices.map((v, i) => [v, i])), result = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes)) {
    if (attr.isInterleavedBufferAttribute || attr.isInstancedBufferAttribute) throw new Error('Unsupported source attribute');
    const array = new attr.array.constructor(vertices.length * attr.itemSize);
    vertices.forEach((id, i) => { for (let k = 0; k < attr.itemSize; k++) array[i * attr.itemSize + k] = attr.array[id * attr.itemSize + k]; });
    result.setAttribute(name, new THREE.BufferAttribute(array, attr.itemSize, attr.normalized));
  }
  result.setIndex(triangles.flatMap(t => [0, 1, 2].map(k => remap.get(source.index.getX(t * 3 + k))))); result.name = name;
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}

function rasterFace(source, family, sign, { tileSize, samples, gutter, signal }) {
  const high = tileSize * samples, area = high * high, depth = new Float32Array(area).fill(-Infinity), hits = new Uint8Array(area), values = new Float32Array(area * 6);
  const pos = source.attributes.position, nor = source.attributes.normal, col = source.attributes.color, [minU, minV] = family.bounds.min, [maxU, maxV] = family.bounds.max;
  const spanU = maxU - minU, spanV = maxV - minV, interior = (tileSize - gutter * 2) * samples, padding = gutter * samples;
  let coveredSamples = 0;
  const read = id => {
    const p = V().fromBufferAttribute(pos, id), n = V().fromBufferAttribute(nor, id);
    return { x: padding + (p.dot(family.u) - minU) / spanU * interior, y: padding + (p.dot(family.v) - minV) / spanV * interior, z: p.dot(family.n) * sign, n, c: [col.getX(id), col.getY(id), col.getZ(id)] };
  };
  for (let ti = 0; ti < family.triangles.length; ti++) {
    if (ti % 64 === 0) signal?.throwIfAborted();
    const triangle = family.triangles[ti], [a, b, c] = [0, 1, 2].map(k => read(source.index.getX(triangle * 3 + k)));
    const determinant = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(determinant) < 1e-12) continue;
    const x0 = Math.max(0, Math.ceil(Math.min(a.x, b.x, c.x) - .5)), x1 = Math.min(high - 1, Math.floor(Math.max(a.x, b.x, c.x) - .5));
    const y0 = Math.max(0, Math.ceil(Math.min(a.y, b.y, c.y) - .5)), y1 = Math.min(high - 1, Math.floor(Math.max(a.y, b.y, c.y) - .5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = ((b.y - c.y) * (x + .5 - c.x) + (c.x - b.x) * (y + .5 - c.y)) / determinant;
      const v = ((c.y - a.y) * (x + .5 - c.x) + (a.x - c.x) * (y + .5 - c.y)) / determinant, w = 1 - u - v;
      if (Math.min(u, v, w) < -1e-8) continue;
      const z = a.z * u + b.z * v + c.z * w, pixel = y * high + x;
      if (z <= depth[pixel]) continue;
      depth[pixel] = z;
      if (!hits[pixel]) { hits[pixel] = 1; coveredSamples++; }
      const normal = a.n.clone().multiplyScalar(u).addScaledVector(b.n, v).addScaledVector(c.n, w).normalize();
      if (normal.dot(family.n) * sign < 0) normal.negate();
      for (let k = 0; k < 3; k++) { values[pixel * 6 + k] = a.c[k] * u + b.c[k] * v + c.c[k] * w; values[pixel * 6 + 3 + k] = normal.getComponent(k); }
    }
  }
  const base = new Uint8Array(tileSize * tileSize * 4), normal = new Uint8Array(base.length), occupied = new Uint8Array(tileSize * tileSize);
  let coverageSum = 0, nonzeroPixels = 0;
  for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
    let count = 0; const sum = [0, 0, 0, 0, 0, 0];
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const pixel = (y * samples + sy) * high + x * samples + sx;
      if (!hits[pixel]) continue; count++;
      for (let k = 0; k < 6; k++) sum[k] += values[pixel * 6 + k];
    }
    const i = y * tileSize + x, offset = i * 4, n = count ? V(...sum.slice(3)).normalize() : family.n.clone().multiplyScalar(sign);
    for (let k = 0; k < 3; k++) { base[offset + k] = count ? clampByte(srgb(sum[k] / count)) : 0; normal[offset + k] = clampByte(n.getComponent(k) * .5 + .5); }
    base[offset + 3] = clampByte(count / (samples * samples)); normal[offset + 3] = 255;
    coverageSum += base[offset + 3] / 255; if (count) { occupied[i] = 1; nonzeroPixels++; }
  }
  // Bleed colour/normal into transparent neighbours, never alpha. This avoids
  // black fringes when the renderer filters true fractional coverage.
  for (let pass = 0; pass < gutter; pass++) {
    const next = occupied.slice();
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      const i = y * tileSize + x; if (occupied[i]) continue;
      const adjacent = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].find(([a, b]) => a >= 0 && b >= 0 && a < tileSize && b < tileSize && occupied[b * tileSize + a]);
      if (!adjacent) continue;
      const from = (adjacent[1] * tileSize + adjacent[0]) * 4;
      for (let k = 0; k < 3; k++) { base[i * 4 + k] = base[from + k]; normal[i * 4 + k] = normal[from + k]; } next[i] = 1;
    }
    occupied.set(next);
  }
  return { base, normal, stats: { coveredSamples, sampleCount: area, coverageSum, nonzeroPixels, family: family.id, sign } };
}

function createFoldedCards(families, tileSize, gutter, atlasColumns, atlasRows, { columns = 2, rows = 2 } = {}) {
  const positions = [], normals = [], uv = [], indices = [], cards = [];
  families.forEach((family, fi) => {
    const [minU, minV, minD] = family.bounds.min, [maxU, maxV, maxD] = family.bounds.max, du = maxU - minU, dv = maxV - minV, grid = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const u = minU + du * x / columns, v = minV + dv * y / rows;
      let weight = 0, depth = 0;
      for (const leaf of family.needles) {
        const centre = V(...leaf.centre), a = (centre.dot(family.u) - u) / du, b = (centre.dot(family.v) - v) / dv, w = 1 / (.04 + a * a + b * b);
        weight += w; depth += centre.dot(family.n) * w;
      }
      const d = THREE.MathUtils.clamp(depth / weight, minD, maxD);
      grid.push(V().addScaledVector(family.u, u).addScaledVector(family.v, v).addScaledVector(family.n, d));
    }
    for (const sign of [1, -1]) {
      const tile = fi * 2 + (sign === 1 ? 0 : 1), tileX = tile % atlasColumns, tileY = Math.floor(tile / atlasColumns), start = positions.length / 3;
      for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
        positions.push(...grid[y * (columns + 1) + x].toArray()); normals.push(...family.n.clone().multiplyScalar(sign).toArray());
        uv.push((tileX + (gutter + (tileSize - gutter * 2) * x / columns) / tileSize) / atlasColumns, (tileY + (gutter + (tileSize - gutter * 2) * y / rows) / tileSize) / atlasRows);
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const a = start + y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(...(sign === 1 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
      }
      cards.push({ family: family.id, sign, tile, columns, rows, vertices: (columns + 1) * (rows + 1), triangles: rows * columns * 2 });
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.name = 'pine-shoot-source-baked-folded-cards';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return { geometry, cards };
}

export async function bakePineShootLod(source, { tileSize = 128, samples = 2, gutter = 8, signal, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  if (![32, 64, 128, 256, 512].includes(tileSize) || ![1, 2, 4].includes(samples) || !Number.isInteger(gutter) || gutter < 2 || gutter * 4 >= tileSize) throw new Error('Invalid bounded shoot bake dimensions');
  signal?.throwIfAborted(); const started = performance.now(), partition = partitionPineShoot(source), atlasColumns = THREE.MathUtils.ceilPowerOfTwo(Math.ceil(Math.sqrt(partition.families.length * 2))), atlasRows = THREE.MathUtils.ceilPowerOfTwo(Math.ceil(partition.families.length * 2 / atlasColumns)), width = tileSize * atlasColumns, height = tileSize * atlasRows, base = new Uint8Array(width * height * 4), normal = new Uint8Array(base.length), faceStats = [];
  let woodGeometry, cardGeometry;
  try {
    for (let fi = 0; fi < partition.families.length; fi++) for (const sign of [1, -1]) {
      signal?.throwIfAborted(); await yieldControl(); signal?.throwIfAborted();
      const tile = fi * 2 + (sign === 1 ? 0 : 1), tx = tile % atlasColumns, ty = Math.floor(tile / atlasColumns), face = rasterFace(source, partition.families[fi], sign, { tileSize, samples, gutter, signal });
      for (let y = 0; y < tileSize; y++) {
        const to = ((ty * tileSize + y) * width + tx * tileSize) * 4, from = y * tileSize * 4;
        base.set(face.base.subarray(from, from + tileSize * 4), to); normal.set(face.normal.subarray(from, from + tileSize * 4), to);
      }
      faceStats.push(face.stats);
    }
    signal?.throwIfAborted();
    woodGeometry = subsetGeometry(source, partition.wood.flatMap(p => p.triangles), 'pine-shoot-original-wood');
    const folded = createFoldedCards(partition.families, tileSize, gutter, atlasColumns, atlasRows); cardGeometry = folded.geometry;
    let disposed = false;
    return {
      woodGeometry, cardGeometry, maps: { base, normal, width, height, columns: atlasColumns, rows: atlasRows }, partition,
      diagnostics: { method: 'source wood blocks retain their own needle groups; two-sided orthographic material bakes on shallow folded cards', sourceTriangles: partition.sourceTriangles, sourceNeedles: partition.needles.length, representedNeedles: partition.families.reduce((n, f) => n + f.needles.length, 0), originalWoodTriangles: woodGeometry.index.count / 3, cardTriangles: cardGeometry.index.count / 3, totalTriangles: (woodGeometry.index.count + cardGeometry.index.count) / 3, cards: folded.cards, families: partition.families.map(f => ({ id: f.id, branch: f.branch, basisId: f.basisId, needles: f.needles.length, minimumNormalAlignment: Math.min(...f.needles.map(n => n.alignment)), bounds: f.bounds })), tileSize, samples, gutter, atlas: [width, height], atlasGrid: [atlasColumns, atlasRows], bytes: base.byteLength + normal.byteLength, faceStats, elapsedMilliseconds: performance.now() - started, nativeReviewed: false, mainSceneAllowed: false, depthReprojection: false, sourceGeometryChanged: false },
      dispose() { if (disposed) return; disposed = true; woodGeometry.dispose(); cardGeometry.dispose(); },
    };
  } catch (error) { woodGeometry?.dispose(); cardGeometry?.dispose(); throw error; }
}
