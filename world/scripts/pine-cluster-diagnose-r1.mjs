import * as THREE from 'three';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { pineClusterCoverageMip } from '../src/yuanmingyuan/pine-cluster-baker.js';

if (!process.execArgv.includes('--max-old-space-size=512')) throw new Error('Use the bounded 512 MiB heap');
const captures = new URL('../../work/production-v3/captures/', import.meta.url), output = new URL('../../work/yuanmingyuan/pine-cluster-r2/', import.meta.url);
await mkdir(output, { recursive: true });
const index = JSON.parse(await readFile(new URL('../../work/yuanmingyuan/pine-cluster-r1/native/captures.json', import.meta.url)));
const linear = byte => { const v = byte / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const luminance = rgb => rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
function cameraFor(metadata) {
  const camera = new THREE.PerspectiveCamera(); camera.projectionMatrix.fromArray(metadata.camera.projection); camera.matrixWorld.fromArray(metadata.camera.worldMatrix); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); return camera;
}
function rectangle(metadata, reflected = false) {
  const camera = cameraFor(metadata), points = [];
  for (const x of [metadata.bounds.min[0], metadata.bounds.max[0]]) for (const y of [metadata.bounds.min[1], metadata.bounds.max[1]]) for (const z of [metadata.bounds.min[2], metadata.bounds.max[2]]) {
    // Studio water is source minY minus the .10 ground and .035 water offsets.
    const p = new THREE.Vector3(x, reflected ? 2 * (metadata.bounds.min[1] - .135) - y : y, z).project(camera); points.push([(p.x + 1) * .5 * metadata.physical.width, (1 - p.y) * .5 * metadata.physical.height]);
  }
  const min = [0, 1].map(axis => Math.floor(Math.min(...points.map(p => p[axis]))) - 5), max = [0, 1].map(axis => Math.ceil(Math.max(...points.map(p => p[axis]))) + 5);
  return { left: min[0], top: min[1], width: max[0] - min[0], height: max[1] - min[1] };
}
const items = [];
for (const entry of index) {
  const metadata = JSON.parse(await readFile(new URL(entry.file, captures))), roi = rectangle(metadata);
  const buffer = await sharp(new URL(entry.png, captures).pathname).extract(roi).removeAlpha().raw().toBuffer();
  items.push({ ...entry, metadata, roi, buffer });
}
const pairedNative = [];
for (const source of items.filter(item => item.state.mode === 'source')) {
  const low = items.find(item => item.state.mode === 'low' && item.view === source.view && item.light === source.light && item.output === source.output);
  assert.deepEqual(source.metadata.camera, low.metadata.camera); assert.deepEqual(source.metadata.lighting, low.metadata.lighting); assert.deepEqual(source.metadata.physical, low.metadata.physical);
  if (source.output === 'normal') continue;
  const result = { view: source.view, light: source.light, output: source.output, cameraAndLightExactlyMatched: true };
  for (const reflected of [false, true]) {
    const roi = rectangle(source.metadata, reflected), data = reflected ? await Promise.all([source, low].map(item => sharp(new URL(item.png, captures).pathname).extract(roi).removeAlpha().raw().toBuffer())) : [source.buffer, low.buffer];
    let absolute = 0, changed = 0; const signed = [0, 0, 0];
    for (let p = 0; p < data[0].length / 3; p++) { let maximum = 0; for (let k = 0; k < 3; k++) { const difference = data[1][p * 3 + k] - data[0][p * 3 + k]; absolute += Math.abs(difference); signed[k] += difference; maximum = Math.max(maximum, Math.abs(difference)); } if (maximum > 4) changed++; }
    result[reflected ? 'reflectionBounds' : 'sourceBounds'] = { roi, meanAbsoluteDisplayRGBError: absolute / data[0].length, meanSignedDisplayRGB: signed.map(n => n / (data[0].length / 3)), changedPixelFractionAbove4: changed / (data[0].length / 3), note: 'Unmasked projected bounds including background, not isolated material radiance.' };
  }
  pairedNative.push(result);
}
const front = (mode, kind, light = 'day') => items.find(item => item.state.mode === mode && item.view === 'front' && item.output === kind && item.light === light);
const normalStats = {}, masks = {};
for (const mode of ['source', 'low']) {
  const item = front(mode, 'normal'), { buffer, metadata, roi } = item, view = cameraFor(metadata).matrixWorldInverse;
  const key = new THREE.Vector3().fromArray(metadata.lighting.keyPosition).sub(new THREE.Vector3().fromArray(metadata.lighting.keyTarget)).normalize().transformDirection(view);
  const ground = new THREE.Vector3(0, 1, 0).transformDirection(view), mask = new Uint8Array(roi.width * roi.height), sum = new THREE.Vector3();
  let count = 0, facing = 0, ndotl = 0, lengthError = 0;
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const bytes = [...buffer.subarray(pixel * 3, pixel * 3 + 3)];
    if (Math.max(...bytes.map((v, i) => Math.abs(v - [119, 119, 255][i]))) <= 1) continue;
    const n = new THREE.Vector3(...bytes.map(v => linear(v) * 2 - 1));
    if (n.clone().normalize().dot(ground) > .9995) continue;
    const length = n.length(); lengthError = Math.max(lengthError, Math.abs(length - 1)); n.normalize();
    count++; mask[pixel] = 1; sum.add(n); ndotl += Math.max(0, n.dot(key)); if (n.z > .85) facing++;
  }
  masks[mode] = mask; normalStats[mode] = { coveredSingleSamplePixels: count, meanViewNormal: sum.divideScalar(count).toArray(), cameraFacingNormalFraction: facing / count, meanUnshadowedKeyCosine: ndotl / count, maximumPackedNormalLengthError: lengthError, groundExcludedByNormalDot: .9995 };
}
const frontLighting = {};
for (const [kind, light] of [['beauty', 'day'], ['color', 'day'], ['beauty', 'night']]) {
  const pair = ['source', 'low'].map(mode => front(mode, kind, light)), sums = pair.map(() => ({ pixels: 0, rgb: [0, 0, 0], luminance: 0 })), common = structuredClone(sums);
  for (let p = 0; p < masks.source.length; p++) for (let mode = 0; mode < 2; mode++) {
    const rgb = [...pair[mode].buffer.subarray(p * 3, p * 3 + 3)].map(linear);
    for (const [accept, target] of [[masks[['source', 'low'][mode]][p], sums[mode]], [masks.source[p] && masks.low[p], common[mode]]]) if (accept) { target.pixels++; rgb.forEach((v, i) => target.rgb[i] += v); target.luminance += luminance(rgb); }
  }
  for (const values of [sums, common]) values.forEach(v => { v.rgb = v.rgb.map(n => n / v.pixels); v.luminance /= v.pixels; });
  frontLighting[kind + '-' + light] = { individualNormalMask: sums, commonNormalMask: common, commonLuminanceRatioLowOverSource: common[1].luminance / common[0].luminance };
}
const asset = new URL('../public/assets/pine-cluster-r1/', import.meta.url), manifest = JSON.parse(await readFile(new URL('manifest.json', asset)));
const decode = async file => { const bytes = await readFile(new URL(file, asset)), half = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2); return Float32Array.from(half, THREE.DataUtils.fromHalfFloat); };
const base = await decode(manifest.files.base.path), normal = await decode(manifest.files.normal.path), fieldStats = [];
const light = new THREE.Vector3().fromArray(front('source', 'normal').metadata.lighting.keyPosition).sub(new THREE.Vector3().fromArray(front('source', 'normal').metadata.lighting.keyTarget)).normalize();
for (let axis = 0; axis < 3; axis++) for (let mip = 0; mip < 4; mip++) {
  let weight = 0, meanLength = 0, lambertRaw = 0, lambertUnit = 0;
  for (const sheet of manifest.sheets.filter(s => s.axis === axis)) {
    const first = sheet.layer * manifest.width * manifest.height * 4;
    let b = { width: manifest.width, height: manifest.height, data: base.slice(first, first + manifest.width * manifest.height * 4) }, n = { ...b, data: normal.slice(first, first + manifest.width * manifest.height * 4) };
    for (let i = 0; i < mip; i++) { b = pineClusterCoverageMip(b); n = pineClusterCoverageMip(n); }
    for (let i = 0; i < b.data.length; i += 4) {
      const a = b.data[i + 3]; if (!(a > 0)) continue;
      const vector = new THREE.Vector3(n.data[i] / a * 2 - 1, n.data[i + 1] / a * 2 - 1, n.data[i + 2] / a * 2 - 1);
      weight += a; meanLength += a * vector.length(); lambertRaw += a * Math.max(0, vector.dot(light)); lambertUnit += a * Math.max(0, vector.normalize().dot(light));
    }
  }
  fieldStats.push({ axis, mip, alphaWeightedMeanNormalLength: meanLength / weight, rawMomentPositiveCosine: lambertRaw / weight, unitMeanPositiveCosine: lambertUnit / weight, renormalizationCosineRatio: lambertUnit / lambertRaw });
}
const source = createPineClusterSource(), areaStats = [];
try {
  for (let axis = 0; axis < 3; axis++) {
    const direction = new THREE.Vector3().setComponent(axis, 1), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), geoNormal = new THREE.Vector3(), n = new THREE.Vector3();
    let area = 0, wrongHemisphereArea = 0, sourceCosine = 0, hemisphereCosine = 0;
    for (const geometry of source.terminalGeometries) {
      const p = geometry.attributes.position, normals = geometry.attributes.normal;
      for (let i = 0; i < geometry.index.count; i += 3) {
        const ids = [0, 1, 2].map(j => geometry.index.getX(i + j)); a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
        geoNormal.crossVectors(b.sub(a), c.sub(a)); const sign = geoNormal.dot(direction) < 0 ? -1 : 1, w = Math.abs(geoNormal.dot(direction)) / 2;
        const mean = new THREE.Vector3(), wrong = new THREE.Vector3();
        for (const id of ids) { n.fromBufferAttribute(normals, id); mean.addScaledVector(n, sign / 3); wrong.addScaledVector(n, (n.dot(direction) < 0 ? -1 : 1) / 3); }
        mean.normalize(); wrong.normalize(); area += w; sourceCosine += w * Math.max(0, mean.dot(light)); hemisphereCosine += w * Math.max(0, wrong.dot(light)); if (mean.dot(wrong) < .99) wrongHemisphereArea += w;
      }
    }
    areaStats.push({ axis, projectedAreaWithOverdraw: area, areaWithChangedShadingNormalByVertexHemisphereFold: wrongHemisphereArea / area, sourceGeometricFaceCosine: sourceCosine / area, hemisphereFoldCosine: hemisphereCosine / area });
  }
} finally { source.dispose(); }
const results = { sourceTag: '776284dcd355c288', pairedNative, normalStats, frontLighting, fieldStats, areaStats, roi: front('source', 'normal').roi, notes: ['Native color is lit PBR with AO disabled, not an unlit base-colour pass.', 'Normal PNG decoded from sRGB; constant clear and ground normal are excluded. The GBuffer is single sample.', 'Analytic cosine metrics isolate normal transport without shadows/specular/environment; do not predict complete rendered radiance.', 'Source normal reference uses geometric triangle facing, as Three DoubleSide does. Source triangle overlap is retained in area-weighted diagnostic.'], gpuUsed: false, fullTreeConstructed: false, peakRSSKiB: process.resourceUsage().maxRSS };
await writeFile(new URL('diagnosis-r1.json', output), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
