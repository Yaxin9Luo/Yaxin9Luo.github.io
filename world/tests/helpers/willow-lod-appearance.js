import * as THREE from 'three';

const V = (...x) => new THREE.Vector3(...x);
const vectorAt = (attribute, index) => V().fromBufferAttribute(attribute, index);

// Small-fixture measurements only. No renderer, whole specimen, textures, or
// fitted exposure are used. Integrals are over real triangles, not vertex count.
export function willowTriangleRecords(geometry, matrix = new THREE.Matrix4(), tint = V(1, 1, 1)) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), result = [];
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [0, 1, 2].map(j => geometry.index.getX(i + j));
    result.push({
      positions: ids.map(id => vectorAt(geometry.attributes.position, id).applyMatrix4(matrix)),
      normals: ids.map(id => vectorAt(geometry.attributes.normal, id).applyMatrix3(normalMatrix).normalize()),
      colors: ids.map(id => vectorAt(geometry.attributes.color, id).multiply(tint)),
    });
  }
  return result;
}

export function willowSourceTriangles(fixture) {
  const records = [], instance = new THREE.Matrix4();
  fixture.group.updateMatrixWorld(true);
  const inverse = fixture.group.matrixWorld.clone().invert();
  for (const mesh of fixture.leaves) {
    const local = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance);
      records.push(...willowTriangleRecords(mesh.geometry, local.clone().multiply(instance), mesh.instanceColor ? vectorAt(mesh.instanceColor, i) : V(1, 1, 1)));
    }
  }
  return records;
}

export function willowSurfaceMoments(triangles, { view = V(0, 0, 1), light = V(-50, 80, 60) } = {}) {
  view = view.clone().normalize(); light = light.clone().normalize();
  const color = V(), normal = V(), colorProjected = V(), normalSecond = [0, 0, 0, 0, 0, 0];
  let area = 0, projectedArea = 0, diffuseProjected = 0, colorDiffuseProjected = V();
  for (const triangle of triangles) {
    const [a, b, c] = triangle.positions, face = b.clone().sub(a).cross(c.clone().sub(a)), triangleArea = face.length() / 2;
    face.normalize(); const projected = triangleArea * Math.abs(face.dot(view));
    area += triangleArea; projectedArea += projected;
    // Three equal quadrature points integrate linear RGB exactly. Normalizing
    // the interpolated normal follows Three's normal fragment convention.
    for (const bary of [[2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]]) {
      const rgb = V(), n = V();
      for (let i = 0; i < 3; i++) { rgb.addScaledVector(triangle.colors[i], bary[i]); n.addScaledVector(triangle.normals[i], bary[i]); }
      n.normalize(); color.addScaledVector(rgb, triangleArea / 3); normal.addScaledVector(n, triangleArea / 3); colorProjected.addScaledVector(rgb, projected / 3);
      [n.x * n.x, n.y * n.y, n.z * n.z, n.x * n.y, n.x * n.z, n.y * n.z].forEach((x, i) => { normalSecond[i] += x * triangleArea / 3; });
      if (face.dot(view) < 0) n.negate();
      const diffuse = Math.max(0, n.dot(light)); diffuseProjected += diffuse * projected / 3; colorDiffuseProjected.addScaledVector(rgb, diffuse * projected / 3);
    }
  }
  return {
    triangles: triangles.length, area, projectedArea,
    areaMeanColor: color.divideScalar(area).toArray(), areaMeanNormal: normal.divideScalar(area).toArray(),
    normalSecondMoment: normalSecond.map(x => x / area), projectedMeanColor: colorProjected.divideScalar(projectedArea).toArray(),
    projectedLambertMean: diffuseProjected / projectedArea, projectedColorLambertMean: colorDiffuseProjected.divideScalar(projectedArea).toArray(),
    projectedAreaIsSumNotOcclusionCoverage: true, lightingIsDirectionalLambertDiagnosticNotPbrRender: true,
  };
}

function barycentric(x, y, positions, denominator) {
  const [a, b, c] = positions;
  const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
  const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
  return [u, v, 1 - u - v];
}
const inside = bary => bary.every(x => x >= -1e-9);
function perspectiveVarying(values, bary, inverseW) {
  const result = V(); let weight = 0;
  for (let i = 0; i < 3; i++) { const w = bary[i] * inverseW[i]; result.addScaledVector(values[i], w); weight += w; }
  return result.divideScalar(weight);
}
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, minimum: sorted[0] ?? null, maximum: sorted.at(-1) ?? null, mean: values.length ? values.reduce((s, x) => s + x, 0) / values.length : null, p95: sorted[Math.floor((sorted.length - 1) * .95)] ?? null };
}

/** Illustrative four-sample raster math on a few actual source shoots. The
 * sample pattern is explicitly declared; it is NOT claimed to be the browser's
 * hardware locations. No AO, shadows, HDR or postprocessing is simulated. */
export function willowPixelInterpolationProbe(triangles, camera, { width = 2375, height = 2200, phase = [0, 0] } = {}) {
  const samples = [[.375, .125], [.875, .375], [.125, .625], [.625, .875]], covered = new Map();
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]; let testedSamples = 0, trianglesWithCoverage = 0;
  for (const triangle of triangles) {
    const clip = triangle.positions.map(p => new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(projection));
    if (clip.some(p => p.w <= 0)) throw new Error('Small willow probe needs triangles in front of the camera');
    const inverseW = clip.map(p => 1 / p.w);
    const positions = clip.map(p => ({ x: (p.x / p.w * .5 + .5) * width + phase[0], y: (.5 - p.y / p.w * .5) * height + phase[1], z: p.z / p.w }));
    const [a, b, c] = positions, denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) < 1e-13) continue;
    const minX = Math.max(0, Math.floor(Math.min(...positions.map(p => p.x)))), maxX = Math.min(width - 1, Math.floor(Math.max(...positions.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...positions.map(p => p.y)))), maxY = Math.min(height - 1, Math.floor(Math.max(...positions.map(p => p.y))));
    let triangleCovered = false;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const hits = [];
      for (let sample = 0; sample < samples.length; sample++) {
        const [sx, sy] = samples[sample], bary = barycentric(x + sx, y + sy, positions, denominator); testedSamples++;
        if (inside(bary)) hits.push({ sample, bary, depth: bary.reduce((sum, v, i) => sum + v * positions[i].z, 0) });
      }
      if (!hits.length) continue;
      triangleCovered = true;
      const centreBary = barycentric(x + .5, y + .5, positions, denominator), centreInside = inside(centreBary);
      const interiorBary = centreInside ? centreBary : [0, 1, 2].map(i => hits.reduce((sum, hit) => sum + hit.bary[i], 0) / hits.length);
      const centreColor = perspectiveVarying(triangle.colors, centreBary, inverseW), interiorColor = perspectiveVarying(triangle.colors, interiorBary, inverseW);
      const centreNormal = perspectiveVarying(triangle.normals, centreBary, inverseW).normalize(), interiorNormal = perspectiveVarying(triangle.normals, interiorBary, inverseW).normalize();
      const lower = [0, 1, 2].map(i => Math.min(...triangle.colors.map(v => v.getComponent(i)))), upper = [0, 1, 2].map(i => Math.max(...triangle.colors.map(v => v.getComponent(i))));
      const overshoot = Math.max(0, ...centreColor.toArray().map((v, i) => Math.max(lower[i] - v, v - upper[i])));
      const interiorOvershoot = Math.max(0, ...interiorColor.toArray().map((v, i) => Math.max(lower[i] - v, v - upper[i])));
      for (const hit of hits) {
        const key = (y * width + x) * samples.length + hit.sample, previous = covered.get(key);
        if (!previous || hit.depth < previous.depth) covered.set(key, { depth: hit.depth, x, y, centreInside, centreColor, interiorColor, overshoot, interiorOvershoot, normalAngle: centreNormal.angleTo(interiorNormal) * 180 / Math.PI });
      }
    }
    if (triangleCovered) trianglesWithCoverage++;
  }
  const visible = [...covered.values()], pixels = new Set();
  for (const hit of visible) { pixels.add(hit.y * width + hit.x); bounds[0] = Math.min(bounds[0], hit.x); bounds[1] = Math.min(bounds[1], hit.y); bounds[2] = Math.max(bounds[2], hit.x); bounds[3] = Math.max(bounds[3], hit.y); }
  const colors = key => [0, 1, 2].map(i => stats(visible.map(hit => hit[key].getComponent(i))));
  return {
    width, height, phase, samplePattern: samples, samplePatternIsMeasuredFromBrowser: false, triangles: triangles.length, trianglesWithCoverage, testedSamples,
    coveredSamples: covered.size, coveredPixels: pixels.size, estimatedPixelCoverage: covered.size / samples.length, bounds: visible.length ? bounds : null,
    outsidePixelCentreSamples: visible.filter(hit => !hit.centreInside).length,
    centre: { channels: colors('centreColor'), rgbOutOfUnitRangeSamples: visible.filter(hit => hit.centreColor.toArray().some(v => v < 0 || v > 1)).length, vertexRangeOvershoot: stats(visible.map(hit => hit.overshoot)) },
    coveredInterior: { channels: colors('interiorColor'), rgbOutOfUnitRangeSamples: visible.filter(hit => hit.interiorColor.toArray().some(v => v < 0 || v > 1)).length, vertexRangeOvershoot: stats(visible.map(hit => hit.interiorOvershoot)) },
    centreVsInteriorNormalDegrees: stats(visible.map(hit => hit.normalAngle)),
    actualGpuResult: false, noPbrAoShadowOrPostprocessing: true,
  };
}
