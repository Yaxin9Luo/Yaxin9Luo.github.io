import * as THREE from 'three';
import { prepareLakeStoneTexturePixels, lakeStoneTextures, vegetationStoneSource } from './vegetation-textures.js';
import { prepareHanjingtangRubbings } from './hanjingtang-rubbings.js';

// Prepared images are CPU-only. Each Hanjingtang instance owns and releases its
// own three stone DataTextures and material. No geometry is created by prepare.
let preparedStonePixels;

export async function prepareHanjingtangAssets({ signal } = {}) {
  signal?.throwIfAborted();
  const [, pixels] = await Promise.all([
    prepareHanjingtangRubbings(),
    prepareLakeStoneTexturePixels({ signal }),
  ]);
  signal?.throwIfAborted(); preparedStonePixels = pixels;
  return { stonePixels: pixels };
}

export function hanjingtangLakeStoneMaterial(builder, pixels = preparedStonePixels) {
  if (!pixels) throw new Error('Await prepareHanjingtangAssets() or provide verified stonePixels before constructing the Hanjingtang lake stones.');
  const textures = lakeStoneTextures(pixels);
  for (const texture of Object.values(textures)) builder.textures.add(texture);
  const material = new THREE.MeshStandardMaterial({ ...textures, color: 0xffffff, vertexColors: true, roughness: 1, normalScale: new THREE.Vector2(1, 1) });
  material.name = 'hanjingtang-photographed-rock-01';
  material.userData = {
    category: 'lake-stone', source: vegetationStoneSource.url,
    license: vegetationStoneSource.license,
    geologicalIdentity: vegetationStoneSource.geologicalIdentity,
    evidence: 'authored garden stone with shared reviewed vegetation geometry; generic photographed rock surface is not identified as original Taihu limestone',
    sharedGpuResource: false,
  };
  builder.materials.add(material); return material;
}

export { vegetationStoneSource as hanjingtangStoneSource };
