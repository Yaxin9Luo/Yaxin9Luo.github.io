import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { vegetationGeometrySignatures } from './helpers/yuanmingyuan-vegetation-signatures.js';
import sharp from 'sharp';
import * as THREE from 'three';
import { seededGardenRandom, gardenValueNoise, curvedBranchGeometry, lanceolateLeafGeometry, needleGeometry, pineShootGeometry, juniperSprayTexture, juniperSprayCardGeometry, lotusLeafGeometry, lotusLeafHeight, lotusPetalGeometry, lotusBudPetalGeometry, lotusReceptacleGeometry, lakeStoneField, stableStoneGridValue, lakeStoneOpenings, lakeStoneGeometry, lakeStonePigment, VegetationGeometryBatch, VegetationInstanceBatch } from '../src/yuanmingyuan/vegetation-geometry.js';
import { gardenVegetationSources, gardenVegetationSpecs, gardenVegetationViews, createGardenVegetationStudy } from '../src/yuanmingyuan/garden-vegetation.js';

import { vegetationBarkSource, vegetationStoneSource, prepareVegetationTexturePixels, prepareLakeStoneTexturePixels, pineBarkTextures, pineBarkRelief, samplePineBarkRelief, lakeStoneTextures } from '../src/yuanmingyuan/vegetation-textures.js';

const sha256 = data => createHash('sha256').update(data).digest('hex');
let verifiedPixels;
async function barkPixels() {
  if (verifiedPixels) return verifiedPixels;
  const pairs = await Promise.all(Object.entries(vegetationBarkSource.files).map(async ([channel, source]) => {
    const file = fs.readFileSync(new URL(`../public${source.path}`, import.meta.url)); assert.equal(sha256(file), source.sha256);
    const { data, info } = await sharp(file).flip().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return [channel, Object.freeze({ data: new Uint8Array(data), width: info.width, height: info.height, channels: 4, origin: 'lower-left', encodedSha256: sha256(file), decodedSha256: sha256(data) })];
  }));
  verifiedPixels = Object.freeze(Object.fromEntries(pairs)); return verifiedPixels;
}

let verifiedStonePixels;
async function stonePixels() {
  if (verifiedStonePixels) return verifiedStonePixels;
  const pairs = await Promise.all(Object.entries(vegetationStoneSource.files).map(async ([channel, source]) => {
    const file = fs.readFileSync(new URL(`../public${source.path}`, import.meta.url)); assert.equal(sha256(file), source.sha256);
    const { data, info } = await sharp(file).flip().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return [channel, Object.freeze({ data: new Uint8Array(data), width: info.width, height: info.height, channels: 4, origin: 'lower-left', encodedSha256: sha256(file), decodedSha256: sha256(data) })];
  }));
  verifiedStonePixels = Object.freeze(Object.fromEntries(pairs)); return verifiedStonePixels;
}

const V = (...values) => new THREE.Vector3(...values);
function physicalVertexIds(geometry) {
  const p = geometry.attributes.position, positions = new Map();
  return Array.from({ length: p.count }, (_, i) => { const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`; if (!positions.has(key)) positions.set(key, positions.size); return positions.get(key); });
}
function meshComponentCount(geometry) {
  const physical = physicalVertexIds(geometry), parents = Array.from({ length: new Set(physical).size }, (_, i) => i), find = x => parents[x] === x ? x : (parents[x] = find(parents[x])), join = (a, b) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
  for (let i = 0; i < geometry.index.count; i += 3) { const a = physical[geometry.index.getX(i)]; join(a, physical[geometry.index.getX(i + 1)]); join(a, physical[geometry.index.getX(i + 2)]); }
  return new Set(parents.map((_, i) => find(i))).size;
}

function stoneUvCoverage(geometry) {
  const p = geometry.attributes.position, uv = geometry.attributes.uv, tile = geometry.userData.physicalTile[0]; let minimum = Infinity, maximum = 0;
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [0, 1, 2].map(j => geometry.index.getX(i + j)), a = V().fromBufferAttribute(p, ids[0]), b = V().fromBufferAttribute(p, ids[1]), c = V().fromBufferAttribute(p, ids[2]);
    const worldArea = b.sub(a).cross(c.sub(a)).length(), [x, y, z] = ids.map(id => new THREE.Vector2().fromBufferAttribute(uv, id));
    const textureArea = Math.abs(y.sub(x).cross(z.sub(x))) * tile * tile, ratio = textureArea / worldArea;
    assert.ok(textureArea > 0, `zero-area stone UV face ${i / 3}`); minimum = Math.min(minimum, ratio); maximum = Math.max(maximum, ratio);
  }
  return { minimum, maximum };
}
function finiteGeometry(geometry) {
  const count = geometry.attributes.position.count;
  for (const name of ['position', 'normal', 'color', 'uv']) {
    const attribute = geometry.attributes[name]; assert.ok(attribute, name); assert.equal(attribute.count, count);
    assert.ok(attribute.array.every(Number.isFinite), `${name} must be finite`);
  }
  assert.ok(geometry.index.array.every(index => index >= 0 && index < count));
  const p = geometry.attributes.position, normal = geometry.attributes.normal;
  for (let i = 0; i < count; i++) assert.ok(V(normal.getX(i), normal.getY(i), normal.getZ(i)).length() > .9, `normal ${i}`);
  for (let i = 0; i < geometry.index.count; i += 3) {
    const points = [0, 1, 2].map(offset => V().fromBufferAttribute(p, geometry.index.getX(i + offset)));
    assert.ok(points[1].sub(points[0]).cross(points[2].sub(points[0])).lengthSq() > 1e-24, `${geometry.name}: zero-area face ${i / 3}`);
  }
}

test('historical categories and review views retain explicit evidence boundaries', () => {
  assert.deepEqual(gardenVegetationSpecs.map(spec => spec.id), ['willow', 'pine', 'juniper', 'lotus', 'lake-rock']);
  for (const spec of gardenVegetationSpecs) { assert.ok(spec.evidence.includes('authored')); for (const id of spec.sourceIds) assert.match(gardenVegetationSources[id].url, /^https:\/\//); }
  for (const view of Object.values(gardenVegetationViews)) { assert.equal(view.direction.length, 3); assert.ok(view.direction.some(value => value !== 0)); assert.deepEqual(view.groups, view.isolate); }
  assert.throws(() => createGardenVegetationStudy({ specimens: ['unrecognized'] }), /Unknown vegetation specimen/);
});

test('authored variation is reproducible without changing the global random generator', () => {
  const a = seededGardenRandom(28), b = seededGardenRandom(28), c = seededGardenRandom(29);
  const one = Array.from({ length: 12 }, a), two = Array.from({ length: 12 }, b), other = Array.from({ length: 12 }, c);
  assert.deepEqual(one, two); assert.notDeepEqual(one, other); assert.ok(one.every(value => value >= 0 && value < 1));
});

test('a tapered branch has outward side faces and follows its curved control line', () => {
  const points = [[0, 0, 0], [.3, 1, -.15], [-.1, 2, .1], [.2, 3, 0]], radii = [.25, .19, .10, .02], segments = 24, sides = 12;
  const geometry = curvedBranchGeometry({ points, radii, segments, radialSegments: sides, bark: 0 }); finiteGeometry(geometry);
  const curve = new THREE.CatmullRomCurve3(points.map(point => V(...point)), false, 'centripetal'), p = geometry.attributes.position, n = geometry.attributes.normal;
  for (let row = 1; row < segments; row++) {
    const centre = curve.getPointAt(row / segments), average = V();
    for (let side = 0; side < sides; side++) { const index = row * (sides + 1) + side, point = V().fromBufferAttribute(p, index); average.add(point); assert.ok(V().fromBufferAttribute(n, index).dot(point.clone().sub(centre)) > 0); }
    assert.ok(average.divideScalar(sides).distanceTo(centre) < 1e-6);
  }
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld();
  assert.ok(new THREE.Raycaster(V(2, 1.5, 0), V(-1, 0, 0)).intersectObject(mesh).length > 0, 'front-sided branch must be visible from outside');
  geometry.dispose(); material.dispose();
});

test('unevenly spaced woody control points retain their local thickness', () => {
  const geometry = curvedBranchGeometry({ points: [[0, 0, 0], [0, .10, 0], [0, 2, 0]], radii: [.22, .11, .02], segments: 40, radialSegments: 8, bark: 0 }), p = geometry.attributes.position;
  const ring = 2 * 9; assert.ok(Math.abs(p.getY(ring) - .10) < .005); assert.ok(Math.abs(Math.hypot(p.getX(ring), p.getZ(ring)) - .11) < .008, 'short basal flare must not be stretched over the entire trunk'); geometry.dispose();
});

test('photographic pine pixels retain source hashes, full resolution and independent GPU ownership', async () => {
  const pixels = await barkPixels(), first = pineBarkTextures(pixels), second = pineBarkTextures(pixels);
  assert.throws(() => createGardenVegetationStudy({ specimens: ['pine'] }), /verified full-resolution/);
  for (const [property, channel] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']]) {
    const a = first[property], b = second[property]; assert.notEqual(a, b); assert.equal(a.image.data, pixels[channel].data); assert.equal(b.image.data, a.image.data);
    assert.equal(a.image.width, 1024); assert.equal(a.image.height, 1024); assert.equal(a.flipY, false); assert.equal(a.userData.encodedSha256, vegetationBarkSource.files[channel].sha256);
    assert.deepEqual(a.userData.physicalTile, [2, 2]); assert.equal(a.colorSpace, property === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
    let secondDisposed = 0; b.addEventListener('dispose', () => secondDisposed++); a.dispose(); assert.equal(secondDisposed, 0); assert.equal(sha256(b.image.data), pixels[channel].decodedSha256); b.dispose(); assert.equal(secondDisposed, 1);
  }
});

test('browser pixel preparation decodes the same bytes and orientation as the CPU input', async () => {
  const saved = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas }, requests = [], closed = [];
  const sources = [vegetationBarkSource, vegetationStoneSource].flatMap(source => Object.values(source.files));
  globalThis.fetch = async url => { requests.push(url); const source = sources.find(source => url.includes(source.path) || url.includes(source.path.slice('/textures/'.length, -'.webp'.length).replaceAll('/', '-') + '-')); assert.ok(source); return new Response(fs.readFileSync(new URL(`../public${source.path}`, import.meta.url)), { status: 200 }); };
  globalThis.createImageBitmap = async (blob, options) => { assert.deepEqual(options, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { width: info.width, height: info.height, data, close() { closed.push(this); } }; };
  globalThis.OffscreenCanvas = class { constructor(width, height) { this.width = width; this.height = height; } getContext() { let bitmap; return { setTransform: (...transform) => assert.deepEqual(transform, [1, 0, 0, -1, 0, this.height]), drawImage: image => { bitmap = image; }, getImageData: () => { const data = new Uint8Array(bitmap.data.length), stride = bitmap.width * 4; for (let row = 0; row < bitmap.height; row++) data.set(bitmap.data.subarray(row * stride, (row + 1) * stride), (bitmap.height - 1 - row) * stride); return { data }; } }; } };
  try {
    const pixels = await prepareVegetationTexturePixels(), expected = await barkPixels(), expectedStone = await stonePixels(); assert.equal(requests.length, 6); assert.equal(closed.length, 6);
    for (const channel of ['color', 'normal', 'roughness']) { assert.equal(pixels[channel].decodedSha256, expected[channel].decodedSha256); assert.deepEqual(pixels[channel].data, expected[channel].data); }
    for (const channel of ['color', 'normal', 'roughness']) { assert.equal(pixels.stone[channel].decodedSha256, expectedStone[channel].decodedSha256); assert.deepEqual(pixels.stone[channel].data, expectedStone[channel].data); }
    const again = await prepareVegetationTexturePixels(), stoneOnly = await prepareLakeStoneTexturePixels(), barkOnly = await prepareVegetationTexturePixels({ includeStone: false }); assert.equal(requests.length, 6); assert.equal(again.normal.data, pixels.normal.data); assert.equal(stoneOnly.normal.data, pixels.stone.normal.data); assert.equal(barkOnly.stone, undefined);
    const controller = new AbortController(); controller.abort(); await assert.rejects(prepareVegetationTexturePixels({ signal: controller.signal }), { name: 'AbortError' });
  } finally { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
});

test('lake stone uses full photographic PBR pixels with independent GPU ownership', async () => {
  assert.throws(() => createGardenVegetationStudy({ specimens: ['lake-rock'] }), /verified full-resolution/);
  const pixels = await stonePixels(), first = lakeStoneTextures(pixels), second = lakeStoneTextures(pixels);
  for (const [property, channel] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']]) {
    const a = first[property], b = second[property]; assert.notEqual(a, b); assert.equal(a.image.data, pixels[channel].data);
    assert.equal(a.image.width, 2048); assert.equal(a.image.height, 2048); assert.equal(a.flipY, false); assert.equal(a.colorSpace, property === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
    assert.deepEqual(a.userData.physicalTile, [1.5, 1.5]); assert.equal(a.userData.encodedSha256, vegetationStoneSource.files[channel].sha256);
    assert.equal(a.wrapS, THREE.RepeatWrapping); assert.equal(a.minFilter, THREE.LinearMipmapLinearFilter); assert.equal(a.anisotropy, 8);
    let disposed = 0; b.addEventListener('dispose', () => disposed++); a.dispose(); assert.equal(disposed, 0); assert.equal(sha256(b.image.data), pixels[channel].decodedSha256); b.dispose(); assert.equal(disposed, 1);
  }
  const rough = pixels.roughness.data, bins = new Set(); for (let i = 0; i < rough.length; i += 256) bins.add(rough[i]); assert.ok(bins.size > 80, 'real roughness variation survives decoding');
});

test('pine relief follows the actual normal-map gradients and preserves the wood seam', async () => {
  const pixels = await barkPixels(), surface = pineBarkRelief(pixels, 64), geometry = curvedBranchGeometry({ points: [[0, 0, 0], [0, 1, 0], [0, 2, 0]], radii: [.31, .31, .31], radialSegments: 48, segments: 96, bark: 0, barkProfile: 'pine-plates', barkSurface: surface });
  finiteGeometry(geometry); assert.ok(surface.heights.every(Number.isFinite)); assert.equal(surface.measuredDisplacement, false);
  const range = Math.max(...surface.heights) - Math.min(...surface.heights); assert.ok(range > .006 && range < .08, `derived relief range ${range}`);
  for (const [u, v] of [[.21, .15], [.71, .44], [.43, .81]]) { assert.ok(Math.abs(samplePineBarkRelief(surface, u, v) - samplePineBarkRelief(surface, u + 1, v - 1)) < 1e-8); }
  let agreement = 0, samples = 0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    const dx = samplePineBarkRelief(surface, (x + 1) / 64, y / 64) - samplePineBarkRelief(surface, (x - 1) / 64, y / 64), dy = samplePineBarkRelief(surface, x / 64, (y + 1) / 64) - samplePineBarkRelief(surface, x / 64, (y - 1) / 64), i = (y * 16 * 1024 + x * 16) * 4;
    const nx = pixels.normal.data[i] - 127.5, ny = pixels.normal.data[i + 1] - 127.5;
    if (Math.hypot(nx, ny) < 12 || Math.hypot(dx, dy) < .0001) continue;
    if (-dx * nx - dy * ny > 0) agreement++; samples++;
  }
  assert.ok(agreement / samples > .66, `height/normal sign agreement ${agreement}/${samples}`);
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let row = 0; row <= 96; row++) assert.ok(V().fromBufferAttribute(p, row * 49).distanceTo(V().fromBufferAttribute(p, row * 49 + 48)) < 1e-6);
  assert.ok(Math.abs(uv.getY(96 * 49) - 1) < 1e-6, 'two metres of trunk use one full vertical tile');
  assert.ok(Math.abs(uv.getX(48) - 2 * Math.PI * .31 / 2) < 1e-6, 'circumference UV uses a two-metre tile'); geometry.dispose();
});

test('willow lamina has a central fold, narrow tips, curvature and attached petiole', () => {
  const geometry = lanceolateLeafGeometry(), p = geometry.attributes.position; finiteGeometry(geometry);
  assert.ok(V().fromBufferAttribute(p, 1).length() < 1e-8);
  assert.ok(p.getZ(13) > p.getZ(12));
  assert.ok(Math.abs(p.getX(0)) < .001 && Math.abs(p.getX(p.count - 1)) < .001);
  assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z > .008);
  assert.ok(geometry.boundingBox.max.y >= .09 && geometry.boundingBox.max.y <= .16);
  assert.ok(geometry.boundingBox.max.y / (geometry.boundingBox.max.x - geometry.boundingBox.min.x) > 5);
  geometry.dispose();
});

test('pine needles are tapered curved blades with finite normals', () => {
  const geometry = needleGeometry(), p = geometry.attributes.position; finiteGeometry(geometry);
  assert.ok(p.getZ(p.count - 1) > .01);
  assert.ok(geometry.boundingBox.max.y >= .06 && geometry.boundingBox.max.y <= .15);
  assert.ok(geometry.boundingBox.max.x - geometry.boundingBox.min.x <= .0015);
  assert.ok(p.getX(p.count - 1) - p.getX(p.count - 2) < (p.getX(1) - p.getX(0)) * .11);
  geometry.dispose();
});

test('a live pine repeat unit has ramified wood and volumetric paired needles at botanical scale', () => {
  const geometry = pineShootGeometry(); finiteGeometry(geometry); const size = geometry.boundingBox.getSize(V());
  assert.ok(size.x > .28 && size.z > .28 && size.y > .26); assert.ok(size.length() < .85);
  assert.ok(geometry.userData.woodyShoots > 3 && geometry.userData.needles === geometry.userData.fascicles * 2);
  assert.ok(geometry.userData.minNeedleLength >= .06 && geometry.userData.maxNeedleLength <= .15);
  geometry.dispose();
});

test('original juniper alpha sprays preserve small leaf marks, open gaps and three-dimensional support', () => {
  const texture = juniperSprayTexture({ size: 128 }), data = texture.image.data, geometry = juniperSprayCardGeometry(); finiteGeometry(geometry);
  let clear = 0, visible = 0, antialias = 0, opaqueBorder = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = data[(y * 128 + x) * 4 + 3]; if (!a) clear++; if (a >= 62) visible++; if (a > 0 && a < 255) antialias++; if ((x === 0 || x === 127 || y === 0 || y === 127) && a > 61) opaqueBorder++; }
  assert.ok(clear > 128 * 128 * .35 && visible > 128 * 128 * .14); assert.ok(antialias > 100); assert.equal(opaqueBorder, 0, 'foliage must not be cropped at the edge of an alpha card');
  assert.ok(geometry.boundingBox.getSize(V()).z > .15); assert.equal(geometry.boundingBox.max.y.toFixed(3), texture.userData.physicalHeight.toFixed(3));
  assert.ok(texture.userData.awlLeafLength[1] <= .012 && texture.userData.scaleLeafLength[1] <= .003); assert.equal(texture.userData.referencePhotographyBundled, false);
  geometry.dispose(); texture.dispose();
});

test('lotus leaf is an upward peltate disk with one complete ruffled boundary', () => {
  const sides = 48, rings = 7, geometry = lotusLeafGeometry({ radialSegments: sides, rings, seed: .4 }); finiteGeometry(geometry);
  const p = geometry.attributes.position, n = geometry.attributes.normal, edges = new Map();
  assert.deepEqual(V().fromBufferAttribute(p, 0).toArray(), [0, 0, 0]);
  for (let i = 0; i < p.count; i++) assert.ok(n.getY(i) > .5, `leaf normal ${i}`);
  for (let i = 0; i < geometry.index.count; i += 3) for (let edge = 0; edge < 3; edge++) { const a = geometry.index.getX(i + edge), b = geometry.index.getX(i + (edge + 1) % 3), key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
  const boundary = [...edges].filter(([, count]) => count === 1); assert.equal(boundary.length, sides);
  for (const [key] of boundary) assert.ok(key.split(':').every(index => Number(index) >= 1 + (rings - 1) * sides), 'no radial notch');
  assert.ok(p.getY(p.count - 1) > .06); assert.ok(lotusLeafHeight(0, 2) === 0);
  geometry.dispose();
});

test('lotus petals are cupped above the receptacle with pale-to-pink vertex colour', () => {
  const geometry = lotusPetalGeometry(), p = geometry.attributes.position, c = geometry.attributes.color; finiteGeometry(geometry);
  assert.ok(geometry.boundingBox.max.y > .25); assert.ok(p.getY(35) > p.getY(37), 'petal sides rise around the longitudinal trough');
  assert.ok(c.getY(2) > c.getY(p.count - 3));
  geometry.dispose();
});

test('overlapping bud petals enclose the middle and converge at stalk and tip', () => {
  const petal = lotusBudPetalGeometry(), batch = new VegetationGeometryBatch('closed-bud-fixture'); finiteGeometry(petal);
  for (let i = 0; i < 8; i++) batch.add(petal, new THREE.Matrix4().makeRotationY(i / 8 * Math.PI * 2));
  const geometry = batch.finish(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld();
  for (let i = 0; i < 24; i++) { const angle = i / 24 * Math.PI * 2 + .01, direction = V(Math.cos(angle), 0, Math.sin(angle)); assert.ok(new THREE.Raycaster(direction.clone().multiplyScalar(.5).add(V(0, .14, 0)), direction.negate()).intersectObject(mesh).length >= 2, 'closed envelope at every azimuth'); }
  const p = petal.attributes.position; assert.ok(Math.hypot(p.getX(2), p.getZ(2)) < .0001); assert.ok(Math.hypot(p.getX(p.count - 3), p.getZ(p.count - 3)) < .0001);
  geometry.dispose(); petal.dispose(); material.dispose();
});

test('receptacle poles are single vertices with nonzero, closed outward faces', () => {
  const geometry = lotusReceptacleGeometry(); finiteGeometry(geometry);
  const p = geometry.attributes.position, edges = new Map(); let poles = 0;
  for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) < 1e-8) poles++;
  assert.equal(poles, 2);
  for (let i = 0; i < geometry.index.count; i += 3) for (let edge = 0; edge < 3; edge++) { const a = geometry.index.getX(i + edge), b = geometry.index.getX(i + (edge + 1) % 3), key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
  assert.ok([...edges.values()].every(count => count === 2));
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld();
  assert.ok(new THREE.Raycaster(V(0, 1, 0), V(0, -1, 0)).intersectObject(mesh).length > 0);
  assert.ok(new THREE.Raycaster(V(1, .1, 0), V(-1, 0, 0)).intersectObject(mesh).length > 0);
  geometry.dispose(); material.dispose();
});

test('lake stone field preserves a solid base and differently oriented open windows', () => {
  assert.ok(lakeStoneField(0, .1, 0) < 0);
  for (const { centre, direction } of lakeStoneOpenings) for (let distance = -2; distance <= 2; distance += .04) { const point = V(...centre).addScaledVector(V(...direction).normalize(), distance); assert.ok(lakeStoneField(...point.toArray()) > 0, `window ${centre}: ${distance}`); }
  for (const [x, y, z] of [[0, -1, 0], [0, 5, 0], [2, 2, 0], [0, 1, 2]]) assert.ok(Number.isFinite(lakeStoneField(x, y, z)) && lakeStoneField(x, y, z) > 0);
});

test('a real near-zero production cell survives Float32 triangle storage', () => {
  const corner = V(-.20375, .796081081081081, -.4588235294117647), step = [2.73 / 104, 4.66 / 148, 1.62 / 68], spacing = Math.min(...step), neighbours = step.map((distance, axis) => corner.clone().setComponent(axis, corner.getComponent(axis) - distance));
  const raw = -1.158459715551452e-7, outside = [.01046398678437185, .0051861329052421135, .00882137342778615]; // Captured original failing cell, retained after artistic field edits.
  const crossArea = stable => { const value = stable ? stableStoneGridValue(raw, spacing) : raw, points = neighbours.map((p, i) => { const other = outside[i], t = value / (value - other); return corner.clone().lerp(p, t).fromArray(corner.clone().lerp(p, t).toArray().map(Math.fround)); }); return points[1].sub(points[0]).cross(points[2].sub(points[0])).lengthSq(); };
  assert.ok(crossArea(false) < 1e-24, 'retained R3 failure reproduced without a full factory'); assert.ok(crossArea(true) > 1e-24);
  assert.equal(Math.sign(stableStoneGridValue(raw, spacing)), Math.sign(raw));
});

test('recorded upper and basal erosion cavities remain open to the outside', () => {
  for (const { min, max, step } of [{ min: [-1.16, 3.36, .08], max: [-.89, 3.64, .29], step: .006 }, { min: [-.19, .27, -.37], max: [-.12, .36, -.29], step: .003 }]) {
    const n = max.map((value, axis) => Math.ceil((value - min[axis]) / step) + 1), inside = new Uint8Array(n[0] * n[1] * n[2]), id = (x, y, z) => x + n[0] * (y + n[1] * z);
    for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) inside[id(x,y,z)] = lakeStoneField(min[0] + x * step, min[1] + y * step, min[2] + z * step) > 0 ? 1 : 0;
    for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
      if (!inside[id(x,y,z)]) continue; const todo = [[x,y,z]]; let touchesBox = false; inside[id(x,y,z)] = 0;
      for (let q = 0; q < todo.length; q++) { const point = todo[q]; touchesBox ||= point.some((value, axis) => value === 0 || value === n[axis] - 1);
        for (let axis = 0; axis < 3; axis++) for (const sign of [-1,1]) { const next = [...point]; next[axis] += sign; if (next[axis] >= 0 && next[axis] < n[axis] && inside[id(...next)]) { inside[id(...next)] = 0; todo.push(next); } }
      }
      assert.ok(touchesBox, `sealed air cavity inside ${min}`);
    }
  }
});

test('small stone mesh is closed and exposes actual holes from either side', () => {
  const geometry = lakeStoneGeometry({ resolution: 32 }); finiteGeometry(geometry);
  // Frozen R3 triangle streams ignore UV-only duplicate vertices. These hashes
  // detect any changed physical face, winding, position or field normal.
  for (const [name, expected] of [['position', '0d26e84e5db997fa90fea4739040792117170a6a43d7226faeb782c177ef380f'], ['normal', '52a690c8d96fc9b1242736b3eb374aa5370a6d57a2e202a09ee1f56222d9c521']]) {
    const stream = new Float32Array(geometry.index.count * 3), attribute = geometry.attributes[name];
    for (let i = 0; i < geometry.index.count; i++) { const index = geometry.index.getX(i); stream.set([attribute.getX(index), attribute.getY(index), attribute.getZ(index)], i * 3); }
    assert.equal(sha256(new Uint8Array(stream.buffer)), expected, `R3 physical ${name} stream`);
  }
  const coverage = stoneUvCoverage(geometry); assert.ok(coverage.minimum > .57 && coverage.maximum < 1.01, JSON.stringify(coverage));
  assert.ok(geometry.userData.chartTriangles.every(count => count > 0)); assert.ok(geometry.userData.uvSeamVertices > 0);
  const edges = new Map(), physical = physicalVertexIds(geometry);
  for (let i = 0; i < geometry.index.count; i += 3) for (let edge = 0; edge < 3; edge++) { const a = physical[geometry.index.getX(i + edge)], b = physical[geometry.index.getX(i + (edge + 1) % 3)], key = a < b ? `${a}:${b}` : `${b}:${a}`, sign = a < b ? 1 : -1, entry = edges.get(key) ?? { count: 0, direction: 0 }; entry.count++; entry.direction += sign; edges.set(key, entry); }
  assert.ok([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0), 'each stone edge is shared by two consistently wound faces');
  assert.equal(meshComponentCount(geometry), 1, 'the folded ribs must form one connected stone');
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld();
  for (const { centre, direction } of lakeStoneOpenings) for (const side of [-1, 1]) { const ray = V(...direction).normalize().multiplyScalar(-side), origin = V(...centre).addScaledVector(ray, -2); assert.equal(new THREE.Raycaster(origin, ray).intersectObject(mesh).length, 0, `window ${centre}`); }
  assert.ok(new THREE.Raycaster(V(-.53, .98, 2), V(0, 0, -1)).intersectObject(mesh).length >= 2, 'solid limestone remains beside the apertures');
  geometry.dispose(); material.dispose();
});

test('stone mineral tints are continuous and keep the photographic albedo visible', () => {
  const colours = [];
  for (let y = .17; y < 4.1; y += .17) for (const [x, z] of [[-.45, .21], [.51, -.29], [.05, .03]]) {
    const colour = lakeStonePigment(x, y, z), neighbour = lakeStonePigment(x + .00001, y, z);
    assert.ok(colour.every(value => value >= .45 && value <= 1)); assert.ok(colour.every((value, i) => Math.abs(value - neighbour[i]) < .001)); colours.push(colour);
  }
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.max(...colours.map(c => c[channel])) - Math.min(...colours.map(c => c[channel])) > .10);
  assert.ok(colours.some(c => c[2] > c[0] + .035), 'cool grey mineral zones'); assert.ok(colours.some(c => c[0] > c[2] + .045), 'buff and oxide zones');
});

test('weathering is continuous across noise cells and does not repeat with a short world-space period', () => {
  for (const y of [.11, 1.48, 3.32]) assert.ok(Math.abs(gardenValueNoise(1 - 1e-5, y, .31) - gardenValueNoise(1 + 1e-5, y, .31)) < 1e-4);
  const a = Array.from({ length: 20 }, (_, i) => gardenValueNoise(i * .17, 1.53, .39)), b = Array.from({ length: 20 }, (_, i) => gardenValueNoise(i * .17 + 1, 1.53, .39)); assert.ok(a.some((value, i) => Math.abs(value - b[i]) > .3));
});

test('batching retains transformed positions, inverse-transpose normals and source geometry', () => {
  const leaf = lanceolateLeafGeometry({ rows: 3 }), before = Array.from(leaf.attributes.position.array), batch = new VegetationGeometryBatch('fixture-leaf-batch');
  const matrix = new THREE.Matrix4().compose(V(3, 2, -1), new THREE.Quaternion().setFromEuler(new THREE.Euler(.4, .2, -.3)), V(2, .7, 1.3));
  batch.add(leaf, matrix, .8); batch.add(leaf); const geometry = batch.finish(); finiteGeometry(geometry);
  assert.equal(geometry.attributes.position.count, leaf.attributes.position.count * 2); assert.deepEqual(Array.from(leaf.attributes.position.array), before);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  for (let i = 0; i < leaf.attributes.position.count; i++) {
    assert.ok(V().fromBufferAttribute(geometry.attributes.position, i).distanceTo(V().fromBufferAttribute(leaf.attributes.position, i).applyMatrix4(matrix)) < 1e-6);
    assert.ok(V().fromBufferAttribute(geometry.attributes.normal, i).distanceTo(V().fromBufferAttribute(leaf.attributes.normal, i).applyMatrix3(normalMatrix).normalize()) < 1e-6);
    assert.ok(Math.abs(geometry.attributes.color.getY(i) - leaf.attributes.color.getY(i) * .8) < 1e-6);
  }
  geometry.dispose(); leaf.dispose();
});

test('foliage instances preserve editable transforms, actual ray hits and complete bounds', () => {
  const geometry = lanceolateLeafGeometry(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), batch = new VegetationInstanceBatch('fixture-editable-foliage');
  batch.add(new THREE.Matrix4().makeTranslation(-1, 2, 0), .82); batch.add(new THREE.Matrix4().makeTranslation(2, 0, 1), .95);
  const mesh = batch.finish(geometry, material); mesh.updateMatrixWorld(); assert.equal(mesh.count, 2); assert.equal(mesh.geometry, geometry);
  const actual = new THREE.Matrix4(); mesh.getMatrixAt(1, actual); assert.deepEqual(actual.elements.slice(12, 15), [2, 0, 1]);
  assert.ok(mesh.boundingBox.min.x < -1 && mesh.boundingBox.max.x > 2); assert.ok(mesh.boundingBox.max.y > 2.1);
  const hits = new THREE.Raycaster(V(-1, 2.07, 1), V(0, 0, -1)).intersectObject(mesh); assert.ok(hits.length > 0); assert.equal(hits[0].instanceId, 0);
  let disposed = false; mesh.addEventListener('dispose', () => { disposed = true; }); mesh.dispose(); assert.equal(disposed, true); geometry.dispose(); material.dispose();
});

// The shared workstation serializes production factories with native rendering.
// Opt in only after its CPU slot is assigned; ordinary tests stay lightweight.
test('full production study exposes every view and valid editable geometry', { skip: process.env.YUANMING_VEGETATION_PRODUCTION !== '1' }, async () => {
  const memory = () => ({ ...process.memoryUsage(), peakRssKiB: process.resourceUsage().maxRSS });
  const report = { scope: 'One full five-specimen CPU factory; no browser or GPU', startedAt: new Date().toISOString(), status: 'running', before: memory() };
  let study;
  try {
    const texturePixels = { ...await barkPixels(), stone: await stonePixels() }, describe = pixels => Object.fromEntries(Object.entries(pixels).map(([channel, entry]) => [channel, { width: entry.width, height: entry.height, encodedSha256: entry.encodedSha256, decodedSha256: entry.decodedSha256 }]));
    report.pbrInputs = { bark: describe(await barkPixels()), stone: describe(texturePixels.stone) };
    const start = performance.now(); study = createGardenVegetationStudy({ texturePixels }); report.buildMs = performance.now() - start; report.afterBuild = memory(); report.diagnostics = study.diagnostics;
    report.nonStoneGeometry = { comparedWith: 'frozen R3 factory, four non-stone specimens only', signatures: vegetationGeometrySignatures(study.group) };
    const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/yuanmingyuan-vegetation-r3-nonstone.json', import.meta.url))); assert.equal(baseline.status, 'passed');
    assert.deepEqual(report.nonStoneGeometry.signatures, baseline.signatures); report.nonStoneGeometry.byteIdentical = true;
    const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set(), names = new Map();
    study.group.traverse(object => {
      if (object.name) names.set(object.name, (names.get(object.name) ?? 0) + 1);
      if (object.isMesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } }
      if (object.isInstancedMesh) { instances.add(object); assert.ok(object.instanceMatrix.array.every(Number.isFinite)); assert.ok(object.instanceColor.array.every(Number.isFinite)); }
    });
    report.namedViews = Object.entries(gardenVegetationViews).map(([id, view]) => { for (const name of view.groups) assert.equal(names.get(name), 1, `view ${id}: ${name}`); return { id, groups: view.groups, resolved: true }; });
    let geometryBytes = 0, trianglesChecked = 0;
    for (const geometry of geometries) { finiteGeometry(geometry); for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength; geometryBytes += geometry.index.array.byteLength; trianglesChecked += geometry.index.count / 3; }
    report.storage = { uniqueGeometries: geometries.size, storedTrianglesChecked: trianglesChecked, geometryBytes, instanceBytes: [...instances].reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength + mesh.instanceColor.array.byteLength, 0), materials: materials.size, textures: textures.size, instancedMeshes: instances.size };
    report.boundsChecks = study.diagnostics.subassemblies.map(part => { assert.ok(part.bounds.size.every(size => size > 0 && Number.isFinite(size))); return { id: part.id, min: part.bounds.min, max: part.bounds.max, verified: true }; });
    const scaleCheck = (name, length, lower, upper) => {
      const mesh = study.group.getObjectByName(name), values = mesh.instanceMatrix.array; let min = Infinity, max = -Infinity;
      for (let i = 0; i < mesh.count; i++) { const offset = i * 16 + 4, size = Math.hypot(values[offset], values[offset + 1], values[offset + 2]) * length; min = Math.min(min, size); max = Math.max(max, size); }
      assert.ok(min >= lower && max <= upper); return { mesh: name, count: mesh.count, minLength: min, maxLength: max };
    };
    report.botanicalScale = [scaleCheck('willow-alternate-lanceolate-foliage', .135, .09, .16)];
    for (const mesh of instances) if (mesh.geometry.userData.body === 'ramified-pine-shoot-with-paired-needles') { const limits = mesh.geometry.userData; report.botanicalScale.push(scaleCheck(mesh.name, limits.minNeedleLength, .06, .15), scaleCheck(mesh.name, limits.maxNeedleLength, .06, .15)); }
    const rock = study.group.getObjectByName('lake-rock-main'), geometry = rock.geometry, edges = new Map(), physical = physicalVertexIds(geometry);
    for (let i = 0; i < geometry.index.count; i += 3) for (let edge = 0; edge < 3; edge++) { const a = physical[geometry.index.getX(i + edge)], b = physical[geometry.index.getX(i + (edge + 1) % 3)], key = a < b ? `${a}:${b}` : `${b}:${a}`, entry = edges.get(key) ?? { count: 0, direction: 0 }; entry.count++; entry.direction += a < b ? 1 : -1; edges.set(key, entry); }
    assert.ok([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0));
    report.stone = { triangles: geometry.index.count / 3, closedConsistentlyOrientedEdges: edges.size, connectedComponents: meshComponentCount(geometry), uvCoverage: stoneUvCoverage(geometry), uvCharts: geometry.userData, holeRays: [] }; assert.equal(report.stone.connectedComponents, 1);
    assert.ok(report.stone.uvCoverage.minimum > .50 && report.stone.uvCoverage.maximum < 1.1, 'physical UV scale survives Float32 production triangles');
    for (const { centre, direction } of lakeStoneOpenings) for (const side of [-1, 1]) { const ray = V(...direction).normalize().multiplyScalar(-side), origin = rock.localToWorld(V(...centre).addScaledVector(ray, -2)), hits = new THREE.Raycaster(origin, ray.transformDirection(rock.matrixWorld)).intersectObject(rock); assert.equal(hits.length, 0); report.stone.holeRays.push({ local: centre, direction, side, intersections: hits.length }); }
    const materialSide = rock.material.side; rock.material.side = THREE.DoubleSide; assert.ok(new THREE.Raycaster(rock.localToWorld(V(-.53, .98, 2)), V(0, 0, -1)).intersectObject(rock).length >= 2); rock.material.side = materialSide;
    const disposeCounts = { geometries: 0, materials: 0, textures: 0, instances: 0 };
    for (const [objects, key] of [[geometries, 'geometries'], [materials, 'materials'], [textures, 'textures'], [instances, 'instances']]) for (const object of objects) object.addEventListener('dispose', () => { disposeCounts[key]++; });
    study.dispose(); const first = { ...disposeCounts }; study.dispose(); assert.deepEqual(disposeCounts, first); assert.equal(study.group.children.length, 0); assert.deepEqual(disposeCounts, { geometries: geometries.size, materials: materials.size, textures: textures.size, instances: instances.size });
    report.disposal = { verified: true, idempotent: true, ...disposeCounts }; report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = { message: error.message, stack: error.stack }; throw error; }
  finally { study?.dispose(); report.finishedAt = new Date().toISOString(); report.afterDisposal = memory(); fs.writeFileSync(new URL('../../docs/art/yuanmingyuan/vegetation-production-smoke.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`); }
});
