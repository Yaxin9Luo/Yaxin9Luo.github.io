import * as THREE from 'three';
import { assetManifest } from '../asset-manifest.js';
import { createResourceLoader } from '../resource-loader.js';

export const vegetationBarkSource = Object.freeze({
  provider: 'Poly Haven', asset: 'pine_bark', author: 'Dimitrios Savva',
  url: 'https://polyhaven.com/a/pine_bark', license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license',
  width: 1024, height: 1024, tileMetres: [2, 2],
  files: {
    color: { path: '/textures/pine-bark/color.webp', sha256: '5c3e07a18c39b6638dded8ef13d6098a561c99db6f849ea8757ff376aa755147' },
    normal: { path: '/textures/pine-bark/normal.webp', sha256: 'd762910ef6c8c43530a76f287a43cd84af5653b8bbd4d2d633356bef43a05cb5' },
    roughness: { path: '/textures/pine-bark/roughness.webp', sha256: 'e7636ee05b394f0a328019dd80403a6a5717e798f47742c666d6838a6e6f4a21' },
  },
});

export const vegetationStoneSource = Object.freeze({
  provider: 'Poly Haven', asset: 'rock_01', author: 'Rob Tuytel',
  url: 'https://polyhaven.com/a/rock_01', license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license',
  width: 2048, height: 2048, tileMetres: [1.5, 1.5],
  geologicalIdentity: 'Generic photographed rock micro-surface; provider does not identify Taihu limestone.',
  files: {
    color: { path: '/textures/yuanmingyuan-lake-stone/color.webp', sha256: 'df407b9e81bd8db2bda41156b40d5e6ac3a5a47a93d0d1d09d121137b00541b3' },
    normal: { path: '/textures/yuanmingyuan-lake-stone/normal.webp', sha256: '1fd3e0ad8e6fdb245fa34e98068e38045db93f6472212b51c6f73cea72474237' },
    roughness: { path: '/textures/yuanmingyuan-lake-stone/roughness.webp', sha256: '5e103cdf05e5611303be895dbd1ea5dd45d9e3aaa5aeefd9d140a80b2859372c' },
  },
});

// This cache owns decoded CPU pixels only. Each study owns its own GPU textures,
// so disposing a study cannot invalidate a later factory or the main site.
const pixelLoader = createResourceLoader({ manifest: assetManifest });
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');

async function prepareSourcePixels(materialSource, signal) {
  const pairs = await Promise.all(Object.entries(materialSource.files).map(async ([channel, source]) => {
    const pixels = await pixelLoader.load(source.path, { signal, parse: async buffer => {
      if (await digest(buffer) !== source.sha256) throw new Error(`${materialSource.asset} source hash mismatch: ${channel}`);
      const bitmap = await createImageBitmap(new Blob([buffer], { type: 'image/webp' }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      try {
        if (bitmap.width !== materialSource.width || bitmap.height !== materialSource.height) throw new Error(`Unexpected ${materialSource.asset} dimensions: ${channel}`);
        const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bitmap.width, bitmap.height) : document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        if (!context) throw new Error('Canvas pixel decoding unavailable');
        context.setTransform(1, 0, 0, -1, 0, bitmap.height); context.drawImage(bitmap, 0, 0);
        const data = new Uint8Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
        return Object.freeze({ data, width: bitmap.width, height: bitmap.height, channels: 4, origin: 'lower-left', encodedSha256: source.sha256, decodedSha256: await digest(data) });
      } finally { bitmap.close(); }
    } });
    return [channel, pixels];
  }));
  return Object.freeze(Object.fromEntries(pairs));
}

export async function prepareVegetationTexturePixels({ signal, includeStone = true } = {}) {
  signal?.throwIfAborted();
  const [bark, stone] = await Promise.all([prepareSourcePixels(vegetationBarkSource, signal), includeStone ? prepareSourcePixels(vegetationStoneSource, signal) : undefined]);
  signal?.throwIfAborted();
  return Object.freeze(stone ? { ...bark, stone } : bark);
}

export async function prepareLakeStoneTexturePixels({ signal } = {}) {
  signal?.throwIfAborted();
  const stone = await prepareSourcePixels(vegetationStoneSource, signal);
  signal?.throwIfAborted();
  return stone;
}

export function validateVegetationTexturePixels(pixels) {
  for (const [channel, source] of Object.entries(vegetationBarkSource.files)) {
    const entry = pixels?.[channel];
    if (!entry || entry.width !== 1024 || entry.height !== 1024 || entry.channels !== 4 || entry.origin !== 'lower-left' || !(entry.data instanceof Uint8Array) || entry.data.byteLength !== 1024 * 1024 * 4 || entry.encodedSha256 !== source.sha256) throw new Error(`Pine bark needs verified full-resolution ${channel} pixels; await prepareVegetationTexturePixels() before constructing pine`);
  }
}

export function pineBarkTextures(pixels) {
  validateVegetationTexturePixels(pixels);
  const make = (channel, colorSpace) => {
    const entry = pixels[channel], texture = new THREE.DataTexture(entry.data, entry.width, entry.height, THREE.RGBAFormat);
    texture.name = `yuanming-polyhaven-pine-bark-${channel}`; texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
    texture.userData = { source: vegetationBarkSource.url, license: vegetationBarkSource.license, physicalTile: [2, 2], encodedSha256: entry.encodedSha256, decodedSha256: entry.decodedSha256, sharedCpuPixels: true, sharedGpuTexture: false };
    return texture;
  };
  return { map: make('color', THREE.SRGBColorSpace), normalMap: make('normal', THREE.NoColorSpace), roughnessMap: make('roughness', THREE.NoColorSpace) };
}

export function validateLakeStonePixels(pixels) {
  for (const [channel, source] of Object.entries(vegetationStoneSource.files)) {
    const entry = pixels?.[channel], { width, height } = vegetationStoneSource;
    if (!entry || entry.width !== width || entry.height !== height || entry.channels !== 4 || entry.origin !== 'lower-left' || !(entry.data instanceof Uint8Array) || entry.data.byteLength !== width * height * 4 || entry.encodedSha256 !== source.sha256) throw new Error(`Lake stone needs verified full-resolution ${channel} pixels; await prepareVegetationTexturePixels() before constructing lake-rock`);
  }
}

export function lakeStoneTextures(pixels) {
  validateLakeStonePixels(pixels);
  const make = (channel, colorSpace) => {
    const entry = pixels[channel], texture = new THREE.DataTexture(entry.data, entry.width, entry.height, THREE.RGBAFormat);
    texture.name = `yuanming-polyhaven-rock-01-${channel}`; texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
    texture.userData = { source: vegetationStoneSource.url, license: vegetationStoneSource.license, physicalTile: [...vegetationStoneSource.tileMetres], encodedSha256: entry.encodedSha256, decodedSha256: entry.decodedSha256, sharedCpuPixels: true, sharedGpuTexture: false, geologicalIdentity: vegetationStoneSource.geologicalIdentity };
    return texture;
  };
  return { map: make('color', THREE.SRGBColorSpace), normalMap: make('normal', THREE.NoColorSpace), roughnessMap: make('roughness', THREE.NoColorSpace) };
}

/** Low-frequency relief reconstructed from the actual OpenGL normal map. This
 * is a derived height field, not provider displacement or measured bark depth.
 * Periodic Poisson relaxation keeps raised plates aligned with the PBR pixels;
 * the normal map retains the fine cracks that the wood mesh cannot sample. */
export function pineBarkRelief(pixels, size = 128) {
  validateVegetationTexturePixels(pixels);
  const source = pixels.normal, gx = new Float32Array(size * size), gy = new Float32Array(size * size), rhs = new Float32Array(size * size), step = 2 / size;
  const index = (x, y) => (y + size) % size * size + (x + size) % size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let nx = 0, ny = 0, nz = 0, count = 0;
    for (let b = Math.floor(y * 1024 / size); b < Math.floor((y + 1) * 1024 / size); b++) for (let a = Math.floor(x * 1024 / size); a < Math.floor((x + 1) * 1024 / size); a++) { const i = (b * 1024 + a) * 4; nx += source.data[i] / 127.5 - 1; ny += source.data[i + 1] / 127.5 - 1; nz += source.data[i + 2] / 127.5 - 1; count++; }
    gx[index(x, y)] = -nx / Math.max(count * .2, nz); gy[index(x, y)] = -ny / Math.max(count * .2, nz);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rhs[index(x, y)] = (gx[index(x + 1, y)] - gx[index(x - 1, y)] + gy[index(x, y + 1)] - gy[index(x, y - 1)]) * step / 2;
  let heights = new Float32Array(size * size), next = new Float32Array(size * size);
  for (let iteration = 0; iteration < 512; iteration++) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = index(x, y); next[i] = (heights[index(x - 1, y)] + heights[index(x + 1, y)] + heights[index(x, y - 1)] + heights[index(x, y + 1)] - rhs[i]) * .25; }
    [heights, next] = [next, heights];
  }
  // A modest geometric contribution prevents doubling the full normal-map
  // relief; geometry carries the silhouette, the material carries fine flakes.
  for (let i = 0; i < heights.length; i++) heights[i] *= .65;
  return { heights, size, tileMetres: [2, 2], source: 'periodic-poisson-from-polyhaven-normal-gl', sourceSha256: source.encodedSha256, measuredDisplacement: false };
}

export function samplePineBarkRelief(surface, u, v) {
  const { size, heights } = surface, x = (u - Math.floor(u)) * size, y = (v - Math.floor(v)) * size, ix = Math.floor(x), iy = Math.floor(y), a = x - ix, b = y - iy;
  const at = (x, y) => heights[(y % size) * size + x % size];
  return (at(ix, iy) * (1 - a) + at(ix + 1, iy) * a) * (1 - b) + (at(ix, iy + 1) * (1 - a) + at(ix + 1, iy + 1) * a) * b;
}
