import * as THREE from 'three';

const base = import.meta.env?.BASE_URL ?? '/';
export const hanjingtangRubbingSources = ['PAI', 'PAJ', 'PAK'].map((suffix, index) => ({
  id: `npm-chunhua-volume1-${suffix}`,
  title: '御製重刻淳化閣帖（一） 冊',
  objectNumber: '故帖000204N000000000',
  albumOpening: index + 8,
  url: 'https://digitalarchive.npm.gov.tw/Collection/Detail/2106?dep=P',
  imageUrl: `${base}art/references/hanjingtang/hanjingtang-chunhua-volume1-K2D000204N000000000${suffix}.jpg`,
  provenanceUrl: `${base}art/references/hanjingtang/hanjingtang-chunhua-volume1-K2D000204N000000000${suffix}.jpg.json`,
  pixels: [1000, 749],
  license: 'CC0 for low-resolution images, per the official collection page',
  attribution: '御製重刻淳化閣帖（一） 冊。國立故宮博物院，臺北。',
  limits: 'Three historic rubbing photographs, six page regions, repeated as an interpretive display. Neither the complete 144 stone texts nor their original placement is reconstructed.',
}));

let preparedImages = null, pending = null;
export async function prepareHanjingtangRubbings() {
  if (preparedImages) return preparedImages;
  if (typeof Image === 'undefined') throw new Error('Rubbing preparation requires an image decoder; Node geometry tests do not verify image decoding.');
  if (!pending) pending = Promise.all(hanjingtangRubbingSources.map(source => new Promise((resolve, reject) => {
    const picture = new Image();
    picture.onload = async () => {
      try {
        await picture.decode();
        if (picture.naturalWidth !== 1000 || picture.naturalHeight !== 749) throw new Error(`Unexpected rubbing dimensions: ${source.id}`);
        resolve(picture);
      } catch (error) { reject(error); }
    };
    picture.onerror = () => reject(new Error(`Cannot load the historical rubbing: ${source.imageUrl}`));
    picture.src = source.imageUrl;
  }))).then(images => { preparedImages = images; return images; }).catch(error => { pending = null; throw error; });
  return pending;
}

export function createHanjingtangRubbingMaterials(builder) {
  if (typeof Image !== 'undefined' && !preparedImages) throw new Error('Await prepareHanjingtangRubbings() before constructing this browser asset.');
  return hanjingtangRubbingSources.map((source, index) => {
    const texture = new THREE.Texture(preparedImages?.[index] ?? null);
    texture.name = source.id; texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 4; texture.needsUpdate = !!preparedImages;
    texture.userData = { sourceId: source.id, historicImage: true, decoded: !!preparedImages, license: source.license };
    builder.textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ color: 0xe7e2d5, map: texture, bumpMap: texture, bumpScale: -.009, roughness: .88 });
    material.name = `hanjingtang-white-marble-inscription-${index}`;
    // Excavated stones are white marble. The original rubbing is white text on
    // black inked paper; use that luminance as a restrained intaglio mask, rather
    // than presenting black paper as the colour of the Qing stone surface.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 rubbingTexel = texture2D(map, vMapUv);
          float incision = smoothstep(0.08, 0.55, dot(rubbingTexel.rgb, vec3(0.2126, 0.7152, 0.0722)));
          diffuseColor.rgb *= mix(vec3(0.96), vec3(0.34), incision);
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'hanjingtang-historic-rubbing-intaglio-v1';
    material.userData = { category: 'stone-inscription', source, treatment: 'historic-letter-shapes; authored white-marble colour and shallow intaglio response', imageDecoded: !!preparedImages };
    builder.materials.add(material); return material;
  });
}

export function rubbingPageGeometry(width, height, page) {
  const geometry = new THREE.PlaneGeometry(width, height);
  // Crop by UV only: public JPEG files remain byte-for-byte unchanged. The
  // borders, labels and colour calibration strip are outside these page regions.
  const [left, right] = page ? [.504, .895] : [.095, .488], top = .044, bottom = .948;
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, left + uv.getX(i) * (right - left), 1 - bottom + uv.getY(i) * (bottom - top));
  return geometry;
}
