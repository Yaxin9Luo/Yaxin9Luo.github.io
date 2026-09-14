import * as THREE from 'three';

// Offline processing of a borrowed, frozen specimen. Nothing here invokes its
// factory, changes the source, or replaces a botanical type with a new tree.
const V = (...a) => new THREE.Vector3(...a);
const clamp = THREE.MathUtils.clamp;
const triangleCount = g => (g.index?.count ?? g.attributes.position.count) / 3;
export const WILLOW_LOD_POLICY = Object.freeze({
  leafError: .0025, branchMidError: .014, branchFarError: .045,
  farCell: .24, farSpatialError: .22, farNormalConeDegrees: 36,
  nearCrownPixels: 620, farCrownPixels: 105, farErrorPixels: 1.1,
  hysteresis: .12, fadeSeconds: .5,
});

export function willowGeometryArea(geometry) {
  const p = geometry.attributes.position, index = geometry.index, a = V(), b = V(), c = V();
  let area = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, index ? index.getX(i) : i);
    b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}

// This is an independently sampled distance, not meshoptimizer's appearance
// metric. Samples include source vertices, triangle centroids and edge halves.
export function willowSampledSurfaceError(a, b) {
  function directed(source, target) {
    const tp = target.attributes.position, ti = target.index, sp = source.attributes.position, si = source.index;
    const triangle = new THREE.Triangle(), point = V(), closest = V(), aa = V(), bb = V(), cc = V();
    let maximum = 0, sum = 0, count = 0;
    const measure = p => {
      let distance = Infinity;
      for (let i = 0; i < (ti?.count ?? tp.count); i += 3) {
        triangle.a.fromBufferAttribute(tp, ti ? ti.getX(i) : i);
        triangle.b.fromBufferAttribute(tp, ti ? ti.getX(i + 1) : i + 1);
        triangle.c.fromBufferAttribute(tp, ti ? ti.getX(i + 2) : i + 2);
        distance = Math.min(distance, triangle.closestPointToPoint(p, closest).distanceTo(p));
      }
      maximum = Math.max(maximum, distance); sum += distance * distance; count++;
    };
    for (let i = 0; i < sp.count; i++) measure(point.fromBufferAttribute(sp, i));
    for (let i = 0; i < (si?.count ?? sp.count); i += 3) {
      aa.fromBufferAttribute(sp, si ? si.getX(i) : i); bb.fromBufferAttribute(sp, si ? si.getX(i + 1) : i + 1); cc.fromBufferAttribute(sp, si ? si.getX(i + 2) : i + 2);
      measure(point.copy(aa).add(bb).add(cc).multiplyScalar(1 / 3));
      measure(point.copy(aa).lerp(bb, .5)); measure(point.copy(bb).lerp(cc, .5)); measure(point.copy(cc).lerp(aa, .5));
    }
    return { maximum, rms: Math.sqrt(sum / count), samples: count };
  }
  const sourceToLod = directed(a, b), lodToSource = directed(b, a);
  return { sourceToLod, lodToSource, maximum: Math.max(sourceToLod.maximum, lodToSource.maximum), certifiedHausdorff: false };
}

function compactGeometry(source, indices) {
  const used = [...new Set(indices)].sort((a, b) => a - b), count = used.length, remap = new Map(used.map((id, i) => [id, i]));
  const index = Uint32Array.from(indices, id => remap.get(id)), result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const data = new attribute.array.constructor(count * attribute.itemSize);
    for (const [i, input] of used.entries()) {
      for (let k = 0; k < attribute.itemSize; k++) data[i * attribute.itemSize + k] = attribute.array[input * attribute.itemSize + k];
    }
    result.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize, attribute.normalized));
  }
  result.setIndex(new THREE.BufferAttribute(count <= 65535 ? Uint16Array.from(index) : index, 1));
  result.name = `${source.name}-willow-lod`; result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}

export async function createWillowMidLeaf(source, { error = WILLOW_LOD_POLICY.leafError } = {}) {
  const positions = source.attributes.position, index = source.index, rows = positions?.count / 3 - 1;
  if (!(error > 0) || source.userData.body !== 'curved-lamina' || !Number.isInteger(rows) || rows < 2 || !index || index.count !== rows * 12 || !source.attributes.normal || !source.attributes.color) throw new Error('Willow mid leaf needs the original three-column lamina topology');
  for (let row = 0; row < rows; row++) for (let side = 0; side < 2; side++) {
    const a = row * 3 + side, expected = [a, a + 1, a + 3, a + 1, a + 4, a + 3], offset = row * 12 + side * 6;
    if (expected.some((value, i) => index.getX(offset + i) !== value)) throw new Error('Changed willow lamina strip topology');
  }
  // Preserve complete left-edge / midrib / right-edge sections. R1's free
  // collapse kept only dark edge vertices and biased both colour and normals.
  // Removing alternate longitudinal rows retains the original colour field and
  // curl without synthesizing a brighter material or discarding any leaf.
  const keptRows = [];
  for (let row = 0; row <= rows; row += 2) keptRows.push(row);
  if (keptRows.at(-1) !== rows) keptRows.push(rows);
  const indices = [];
  for (let row = 0; row < keptRows.length - 1; row++) for (let side = 0; side < 2; side++) {
    const a = keptRows[row] * 3 + side, b = keptRows[row + 1] * 3 + side;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const result = compactGeometry(source, indices);
  const sourceArea = willowGeometryArea(source), before = willowGeometryArea(result);
  // Only the sub-millimetre lamina width changes. Stem attachment, length,
  // curl, normals, leaf pose and per-instance colour retain their source data.
  const widthScale = clamp(sourceArea / before, 1, 1.15), p = result.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * widthScale);
  result.computeBoundingBox(); result.computeBoundingSphere();
  const measured = willowSampledSurfaceError(source, result), area = willowGeometryArea(result);
  if (measured.maximum > error || Math.abs(area / sourceArea - 1) > .035) { result.dispose(); throw new Error('Simplified willow lamina exceeds measured shape or surface-area limit'); }
  result.userData = { sourceTriangles: triangleCount(source), triangles: triangleCount(result), requestedError: error, keptRows, sourceMidribColorAndNormalSamplesRetained: true, wholeComponentsPruned: false, sourceArea, area, widthScale, measuredSurfaceError: measured, sourceLeavesDeleted: 0 };
  return result;
}

// The source's merged wood consists of consecutive closed curvedBranchGeometry
// tubes. Validate that exact topology before interpreting a ring: a changed or
// unrelated mesh is an error, never a silently accepted shape approximation.
export function inspectWillowBranchTubes(source) {
  const index = source.index, positions = source.attributes.position, tubes = [];
  if (!index || !positions) throw new Error('Willow wood needs indexed source tubes');
  let cursor = 0, vertexStart = 0;
  const match = expected => expected.every((value, i) => index.getX(cursor + i) === value);
  while (cursor < index.count) {
    const indexStart = cursor, stride = index.getX(cursor + 2) - vertexStart, radialSegments = stride - 1;
    if (!Number.isInteger(stride) || stride < 4 || stride > 257) throw new Error('Unexpected willow tube ring topology');
    let rows = 0;
    while (true) {
      const rowStart = vertexStart + rows * stride;
      if (!match([rowStart, rowStart + 1, rowStart + stride])) break;
      for (let side = 0; side < radialSegments; side++) {
        const a = rowStart + side, b = a + stride;
        if (!match([a, a + 1, b, a + 1, b + 1, b])) throw new Error('Changed willow tube strip topology');
        cursor += 6;
      }
      rows++;
    }
    if (rows < 1) throw new Error('Empty willow tube');
    const ringVertices = (rows + 1) * stride;
    for (const end of [0, 1]) for (let side = 0; side < radialSegments; side++) {
      const pole = vertexStart + ringVertices + end, ring = vertexStart + end * rows * stride;
      if (!match([pole, ring + side + (end ? 0 : 1), ring + side + (end ? 1 : 0)])) throw new Error('Willow tube is missing its original closed end cap');
      cursor += 3;
    }
    tubes.push({ vertexStart, stride, radialSegments, rows, indexStart, indexCount: cursor - indexStart }); vertexStart += ringVertices + 2;
  }
  if (vertexStart !== positions.count) throw new Error('Willow wood has unaccounted vertices');
  return tubes;
}

export function simplifyWillowWood(source, { error = WILLOW_LOD_POLICY.branchMidError } = {}) {
  if (!(error > 0)) throw new Error('Willow wood error must be positive');
  const tubes = inspectWillowBranchTubes(source), p = source.attributes.position, a = V(), b = V(), point = V(), lerped = V();
  let maximumRingDeviation = 0, vertices = 0, indices = 0;
  const plans = tubes.map(tube => {
    const kept = new Set([0, tube.rows]), pending = [[0, tube.rows]];
    while (pending.length) {
      const [first, last] = pending.pop(); let maximum = 0, worst = -1;
      for (let row = first + 1; row < last; row++) {
        const t = (row - first) / (last - first);
        for (let side = 0; side < tube.stride; side++) {
          a.fromBufferAttribute(p, tube.vertexStart + first * tube.stride + side); b.fromBufferAttribute(p, tube.vertexStart + last * tube.stride + side);
          point.fromBufferAttribute(p, tube.vertexStart + row * tube.stride + side);
          const distance = point.distanceTo(lerped.copy(a).lerp(b, t));
          if (distance > maximum) { maximum = distance; worst = row; }
        }
      }
      if (maximum > error && worst > first) { kept.add(worst); pending.push([first, worst], [worst, last]); }
      else maximumRingDeviation = Math.max(maximumRingDeviation, maximum);
    }
    const rows = [...kept].sort((x, y) => x - y), count = rows.length * tube.stride + 2;
    vertices += count; indices += (rows.length - 1) * tube.radialSegments * 6 + tube.radialSegments * 6;
    return { ...tube, keptRows: rows, outputVertices: count };
  });
  const result = new THREE.BufferGeometry(), outputIndex = vertices <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices);
  for (const [name, attribute] of Object.entries(source.attributes)) result.setAttribute(name, new THREE.BufferAttribute(new attribute.array.constructor(vertices * attribute.itemSize), attribute.itemSize, attribute.normalized));
  let vertex = 0, index = 0;
  const copyVertex = input => {
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const destination = result.attributes[name].array;
      for (let k = 0; k < attribute.itemSize; k++) destination[vertex * attribute.itemSize + k] = attribute.array[input * attribute.itemSize + k];
    }
    vertex++;
  };
  for (const tube of plans) {
    const start = vertex;
    for (const row of tube.keptRows) for (let side = 0; side < tube.stride; side++) copyVertex(tube.vertexStart + row * tube.stride + side);
    const pole = vertex; copyVertex(tube.vertexStart + (tube.rows + 1) * tube.stride); copyVertex(tube.vertexStart + (tube.rows + 1) * tube.stride + 1);
    for (let row = 0; row < tube.keptRows.length - 1; row++) for (let side = 0; side < tube.radialSegments; side++) {
      const a = start + row * tube.stride + side, b = a + tube.stride; outputIndex.set([a, a + 1, b, a + 1, b + 1, b], index); index += 6;
    }
    for (const end of [0, 1]) for (let side = 0; side < tube.radialSegments; side++) {
      const ring = start + end * (tube.keptRows.length - 1) * tube.stride;
      outputIndex.set([pole + end, ring + side + (end ? 0 : 1), ring + side + (end ? 1 : 0)], index); index += 3;
    }
  }
  result.name = `${source.name}-retained-tube-lod`; result.setIndex(new THREE.BufferAttribute(outputIndex, 1)); result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData = { sourceTriangles: triangleCount(source), triangles: triangleCount(result), sourceTubes: tubes.length, outputTubes: tubes.length, radialCrossSectionsUnchanged: true, endCapsUnchanged: true, maximumRingDeviation, requestedError: error, sampledSurfaceVerificationRequired: true, wholeComponentsPruned: false };
  return result;
}

function leafBasis(geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, color = geometry.attributes.color, index = geometry.index;
  const centre = V(), normal = V(), rgb = V(), a = V(), b = V(), c = V(); let weight = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2; weight += area;
    centre.addScaledVector(a.add(b).add(c), area / 3);
    for (const id of ids) { if (n) normal.addScaledVector(a.fromBufferAttribute(n, id), area / 3); if (color) rgb.addScaledVector(a.fromBufferAttribute(color, id), area / 3); }
  }
  centre.multiplyScalar(1 / weight); normal.normalize(); rgb.multiplyScalar(1 / weight);
  let radius = 0, nearest = Infinity;
  for (let i = 0; i < p.count; i++) radius = Math.max(radius, a.fromBufferAttribute(p, i).distanceTo(centre));
  // The area centroid of a curved lamina need not lie on its surface. Retain an
  // actual triangle centroid as the anchor for the reverse spatial bound.
  const surfaceAnchor = V();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
    a.add(b).add(c).multiplyScalar(1 / 3);
    const distance = a.distanceToSquared(centre);
    if (distance < nearest) { nearest = distance; surfaceAnchor.copy(a); }
  }
  return { centre, normal, color: rgb, area: weight, radius, surfaceAnchor };
}

function sourceLeafRecords(meshes, rootMatrixInverse, sourceLeaf) {
  const basis = leafBasis(sourceLeaf), matrix = new THREE.Matrix4(), instance = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), record = [];
  for (const mesh of meshes) {
    const local = new THREE.Matrix4().multiplyMatrices(rootMatrixInverse, mesh.matrixWorld);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance); matrix.multiplyMatrices(local, instance);
      const e = matrix.elements, sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
      if (matrix.determinant() <= 0 || Math.max(sx, sy, sz) - Math.min(sx, sy, sz) > 1e-5) throw new Error('Willow leaf source must use positive uniform scale');
      normalMatrix.getNormalMatrix(matrix);
      const tint = mesh.instanceColor ? V(mesh.instanceColor.getX(i), mesh.instanceColor.getY(i), mesh.instanceColor.getZ(i)) : V(1, 1, 1);
      record.push({ sourceIndex: record.length, matrix: Float32Array.from(e), centre: basis.centre.clone().applyMatrix4(matrix), surfaceAnchor: basis.surfaceAnchor.clone().applyMatrix4(matrix), normal: basis.normal.clone().applyMatrix3(normalMatrix).normalize(), axis: V(0, 1, 0).transformDirection(matrix), color: basis.color.clone().multiply(tint), tint, area: basis.area * sx * sx, radius: basis.radius * sx });
    }
  }
  return { records: record, basis };
}

function makeAggregate(leaves, maximumError) {
  const centre = V(), normal = V(), color = V(), axis = V(), reference = leaves[0].normal; let area = 0;
  for (const leaf of leaves) {
    area += leaf.area; centre.addScaledVector(leaf.centre, leaf.area); color.addScaledVector(leaf.color, leaf.area);
    normal.addScaledVector(leaf.normal, leaf.area * (leaf.normal.dot(reference) < 0 ? -1 : 1));
    axis.addScaledVector(leaf.axis, leaf.area * (leaf.axis.dot(leaves[0].axis) < 0 ? -1 : 1));
  }
  centre.multiplyScalar(1 / area); color.multiplyScalar(1 / area); normal.normalize();
  axis.addScaledVector(normal, -axis.dot(normal)).normalize();
  if (axis.lengthSq() < .5) axis.copy(V(1, 0, .2).cross(normal).normalize());
  const across = axis.clone().cross(normal).normalize();
  let alongVariance = 0, acrossVariance = 0, sourceRadius = 0, nearest = Infinity;
  for (const leaf of leaves) {
    const delta = leaf.centre.clone().sub(centre);
    alongVariance += leaf.area * (delta.dot(axis) ** 2 + (leaf.radius * .46) ** 2);
    acrossVariance += leaf.area * (delta.dot(across) ** 2 + (leaf.radius * .14) ** 2);
    sourceRadius = Math.max(sourceRadius, delta.length() + leaf.radius); nearest = Math.min(nearest, leaf.surfaceAnchor.distanceTo(centre));
  }
  const aspect = clamp(Math.sqrt(alongVariance / Math.max(acrossVariance, 1e-14)), .5, 3.2);
  const length = Math.sqrt(area * aspect), width = area / length, radius = Math.hypot(length, width) / 2;
  const errorBound = Math.max(sourceRadius, radius + nearest);
  // Reject aggregation rather than silently enlarging leaves across an empty
  // region. Leaves from a failed cell remain exact independent mid laminas.
  if (errorBound > maximumError) return null;
  return { centre, normal, color, axis, across, length, width, area, sourceRadius, errorBound, count: leaves.length, sourceIndices: leaves.map(leaf => leaf.sourceIndex) };
}

export function clusterWillowLeaves(records, { cell = WILLOW_LOD_POLICY.farCell, maximumError = WILLOW_LOD_POLICY.farSpatialError, normalConeDegrees = WILLOW_LOD_POLICY.farNormalConeDegrees } = {}) {
  if (!(cell > 0 && maximumError > 0 && normalConeDegrees > 0 && normalConeDegrees < 90)) throw new Error('Invalid willow aggregation limits');
  const cells = new Map(), cos = Math.cos(normalConeDegrees * Math.PI / 180);
  for (const record of records) {
    const p = record.centre, key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
    let bins = cells.get(key); if (!bins) cells.set(key, bins = []);
    // Test both sides of the double-sided leaf; opposite normals describe the
    // same optical plane. Keep genuinely different leaf-facing directions.
    let bin = bins.find(b => b.every(r => Math.abs(r.normal.dot(record.normal)) >= cos));
    if (!bin) bins.push(bin = []); bin.push(record);
  }
  const aggregates = [], singles = []; let maximumBound = 0;
  for (const bins of cells.values()) for (const leaves of bins) {
    if (leaves.length === 1) { singles.push(leaves[0]); continue; }
    const aggregate = makeAggregate(leaves, maximumError);
    if (!aggregate) { singles.push(...leaves); continue; }
    aggregates.push(aggregate); maximumBound = Math.max(maximumBound, aggregate.errorBound);
  }
  const originalArea = records.reduce((sum, r) => sum + r.area, 0);
  const area = aggregates.reduce((sum, r) => sum + r.area, 0) + singles.reduce((sum, r) => sum + r.area, 0);
  return { aggregates, singles, diagnostics: { inputLeaves: records.length, groupedLeaves: aggregates.reduce((s, a) => s + a.count, 0), aggregatePatches: aggregates.length, unmergedLeaves: singles.length, originalArea, area, maximumSpatialBound: maximumBound, cell, normalConeDegrees, areaIsSumNotVisibilityCoverage: true, spatialBoundUsesActualSurfaceAnchor: true } };
}

// Packed normal/color attributes reduce storage without changing positions.
// These are ordinary triangles, so standard depth/normal/shadow passes see the
// same shape. No alpha texture, billboard, point sprite or custom depth exists.
class PackedWillowBuilder {
  constructor(vertices, indices) { this.p = new Float32Array(vertices * 3); this.n = new Int16Array(vertices * 3); this.c = new Uint8Array(vertices * 3); this.index = vertices <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices); this.v = 0; this.i = 0; }
  vertex(p, n, c) { const offset = this.v++ * 3; this.p.set(p.toArray(), offset); this.n.set(n.toArray().map(v => Math.round(clamp(v, -1, 1) * 32767)), offset); this.c.set(c.toArray().map(v => Math.round(clamp(v, 0, 1) * 255)), offset); }
  leaf(geometry, record) {
    const matrix = new THREE.Matrix4().fromArray(record.matrix), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), start = this.v, p = V(), n = V(), c = V();
    for (let i = 0; i < geometry.attributes.position.count; i++) this.vertex(p.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(matrix), n.fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix).normalize(), c.fromBufferAttribute(geometry.attributes.color, i).multiply(record.tint));
    for (const index of geometry.index.array) this.index[this.i++] = start + index;
  }
  patch(patch) {
    const start = this.v, p = V();
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.vertex(p.copy(patch.centre).addScaledVector(patch.across, x * patch.width / 2).addScaledVector(patch.axis, y * patch.length / 2), patch.normal, patch.color);
    this.index.set([start, start + 1, start + 2, start, start + 2, start + 3], this.i); this.i += 6;
  }
  finish(name) { const g = new THREE.BufferGeometry(); g.name = name; g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.n, 3, true)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3, true)); g.setIndex(new THREE.BufferAttribute(this.index, 1)); g.computeBoundingBox(); g.computeBoundingSphere(); return g; }
}

export function buildWillowFoliageLevels(meshes, { sourceRoot, sourceLeaf, midLeaf, policy = WILLOW_LOD_POLICY } = {}) {
  sourceRoot.updateMatrixWorld(true);
  const { records, basis } = sourceLeafRecords(meshes, new THREE.Matrix4().copy(sourceRoot.matrixWorld).invert(), sourceLeaf), cluster = clusterWillowLeaves(records, { cell: policy.farCell, maximumError: policy.farSpatialError, normalConeDegrees: policy.farNormalConeDegrees });
  const midBuilder = new PackedWillowBuilder(records.length * midLeaf.attributes.position.count, records.length * midLeaf.index.count);
  for (const record of records) midBuilder.leaf(midLeaf, record);
  const farBuilder = new PackedWillowBuilder(cluster.singles.length * midLeaf.attributes.position.count + cluster.aggregates.length * 4, cluster.singles.length * midLeaf.index.count + cluster.aggregates.length * 6);
  for (const record of cluster.singles) farBuilder.leaf(midLeaf, record);
  for (const patch of cluster.aggregates) farBuilder.patch(patch);
  const mid = midBuilder.finish('willow-mid-all-source-leaves'), far = farBuilder.finish('willow-far-spatial-lamina-aggregates');
  return { mid, far, diagnostics: { ...cluster.diagnostics, sourceLeafArea: basis.area, midRenderedArea: willowGeometryArea(mid), farRenderedArea: willowGeometryArea(far), allMidLeafPosesPreserved: true, midLeafAreaRatio: midLeaf.userData.area / basis.area, unrepresentedSourceLeaves: 0 } };
}

export function willowGeometryBytes(geometry) { return Object.values(geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, geometry.index?.array.byteLength ?? 0); }

export async function buildWillowLodLevels(source, { policy = WILLOW_LOD_POLICY } = {}) {
  const sourceRoot = source.group ?? source, willow = sourceRoot.getObjectByName('garden-willow');
  if (!willow) throw new Error('Willow LOD needs the frozen garden-willow specimen');
  sourceRoot.updateMatrixWorld(true);
  const leaves = [], wood = []; willow.traverse(mesh => { if (!mesh.isMesh) return; if (mesh.isInstancedMesh) leaves.push(mesh); else wood.push(mesh); });
  if (!leaves.length || leaves.some(m => m.geometry.userData.body !== 'curved-lamina')) throw new Error('Unexpected willow foliage source');
  const owned = [], mid = [], far = [];
  try {
    const midLeaf = await createWillowMidLeaf(leaves[0].geometry, { error: policy.leafError }); owned.push(midLeaf);
    const foliage = buildWillowFoliageLevels(leaves, { sourceRoot: willow, sourceLeaf: leaves[0].geometry, midLeaf, policy }); owned.push(foliage.mid, foliage.far);
    mid.push({ name: 'willow-mid-foliage', geometry: foliage.mid, material: leaves[0].material, materialBorrowed: true });
    far.push({ name: 'willow-far-foliage', geometry: foliage.far, material: leaves[0].material, materialBorrowed: true });
    const inverse = new THREE.Matrix4().copy(willow.matrixWorld).invert(), branches = [];
    for (const mesh of wood) {
      const local = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld), results = [];
      for (const [tier, list, error] of [['mid', mid, policy.branchMidError], ['far', far, policy.branchFarError]]) {
        const geometry = simplifyWillowWood(mesh.geometry, { error }); geometry.applyMatrix4(local); owned.push(geometry);
        list.push({ name: `${mesh.name}-${tier}`, geometry, material: mesh.material, materialBorrowed: true }); results.push({ tier, ...geometry.userData });
      }
      branches.push({ source: mesh.name, results });
    }
    midLeaf.dispose(); owned.splice(owned.indexOf(midLeaf), 1);
    const summarize = list => ({ triangles: list.reduce((s, r) => s + triangleCount(r.geometry), 0), geometryBytes: list.reduce((s, r) => s + willowGeometryBytes(r.geometry), 0), meshesPerPopulation: list.length });
    let disposed = false;
    return { mid, far, policy, diagnostics: { sourceId: 'garden-willow', nearUnmodified: true, foliage: foliage.diagnostics, branches, mid: summarize(mid), far: summarize(far), nativeReviewed: false, mainSceneAllowed: false, wind: 'source-and-lods-static' }, dispose() { if (disposed) return; disposed = true; owned.forEach(g => g.dispose()); } };
  } catch (error) { owned.forEach(g => g.dispose()); throw error; }
}
