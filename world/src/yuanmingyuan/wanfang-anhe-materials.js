import * as THREE from 'three';
import {createJiuzhouWoodTexture} from './jiuzhou-paintwork.js';
import {prepareDagongmenFinishes} from './dagongmen-materials.js';
// Scalar microstructure copied from admitted Dagongmen material utility, with private names only.
function createMicrostructure(clay = false) {
  const size = 512, data = new Uint8Array(size * size * 4);
  const hash = (x, y, seed) => {
    let h = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
  };
  const noise = (u, v, cells, seed) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    let a = x - ix, c = y - iy; a = a * a * (3 - 2 * a); c = c * c * (3 - 2 * c);
    const h = (dx, dy) => hash((ix + dx) % cells, (iy + dy) % cells, seed);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(0, 0), h(1, 0), a), THREE.MathUtils.lerp(h(0, 1), h(1, 1), a), c);
  };
  const encode = x => Math.round(255 * THREE.MathUtils.clamp(x, 0, 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, i = 4 * (y * size + x);
    const fine = noise(u, v, 128, 31), mid = noise(u, v, clay ? 48 : 43, 89), broad = noise(u, v, clay ? 12 : 11, 173);
    data[i] = encode(.5 + .38 * (fine - .5) + .32 * (mid - .5) + .12 * (broad - .5));
    data[i + 1] = encode(.5 + .62 * (broad - .5) + .25 * (mid - .5));
    data[i + 2] = encode(.5 + .50 * (broad - .5) + .25 * (mid - .5)); data[i + 3] = 255;
    if (clay) {
      // Centimetre firing clouds carry albedo; fine relief remains a separate
      // channel. A periodic soft warp breaks the value-noise lattice without
      // adding grout, dirt marks, extra geometry or higher-frequency speckles.
      const warpU = .12 * (noise(u, v, 6, 431) - .5);
      const warpV = .12 * (noise(u, v, 6, 577) - .5);
      const smoke = noise(u + 2 + warpU, v + 2 + warpV, 6, 173);
      const firing = .55 * smoke + .30 * noise(u + 2 + warpV, v + 2 - warpU, 12, 227)
        + .15 * noise(u + 2 - warpU, v + 2 + warpV, 24, 359);
      data[i + 1] = encode(.5 + .60 * (smoke - .5) + .25 * (mid - .5) + .15 * (fine - .5));
      data[i + 2] = encode(.5 + 1.90 * (firing - .5));
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = clay ? 'wanfang-anhe-clay-grain-r3' : 'wanfang-anhe-authored-microfinish-r1'; texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  texture.userData = { provenance: 'original-authored-scalar-microstructure', historicalImage: false, channels: 'R height / G roughness / B slight mineral albedo', sourcePaintPixelsChanged: false };
  return texture;
}


export function makeWanfangAnheMaterials(owner){
  const add=(name,category,options)=>{const m=new THREE.MeshStandardMaterial(options);
    m.name='wanfang-anhe-'+name;m.userData={category,provenance:'authored-material-response; HKPM-model-palette-reference-not-measured-Qing-pigment'};owner.materials.add(m);return m;};
  try{
    const clay=createMicrostructure(true),mineral=createMicrostructure(false);
    for(const t of [clay,mineral])owner.textures.add(t);
    const wood=createJiuzhouWoodTexture();owner.textures.add(wood);
    wood.name='wanfang-anhe-finished-wood-grain';wood.userData={...wood.userData,borrowedAlgorithm:'createJiuzhouWoodTexture; unchanged full 384x768 pixels',historicalPaintwork:false};
    owner.finishTextures={clay,mineral};
    const m={
      stone:add('limestone-coping','stone',{color:0xc5beb0,roughness:.83}),
      carving:add('dressed-column-shoes','stone',{color:0xd2cabc,roughness:.80}),
      foundation:add('submerged-stone-base','masonry',{color:0x676e65,roughness:.95}),
      paving:add('grey-veranda-pavers','masonry',{color:0x96958b,roughness:.90}),
      pavingShade:add('quiet-paving-variation','masonry',{color:0x848a82,roughness:.93}),
      plaster:add('warm-recessed-wall','plaster',{color:0xc9c1aa,roughness:.92}),
      greenWood:add('oiled-green-square-posts','timber',{color:0x355c48,roughness:.61}),
      darkWood:add('deep-finished-timber','timber',{color:0x5a4030,map:wood,roughness:.67}),
      windowWood:add('warm-joinery-grain','timber',{color:0xd2bb8d,map:wood,roughness:.64}),
      green:add('muted-green-fang','painted-wood',{color:0x345548,roughness:.70}),
      blue:add('deep-blue-green-recess','painted-wood',{color:0x304b50,roughness:.76}),
      pale:add('quiet-stone-colour-line','painted-wood',{color:0xadb091,roughness:.77}),
      gold:add('restrained-ochre-edge','painted-wood',{color:0xa18a58,roughness:.67}),
      iron:add('hinge-and-dock-iron','metal',{color:0x343b39,metalness:.65,roughness:.53}),
      brick:add('grey-gable-infill','masonry',{color:0x69736d,roughness:.94}),
      paper:add('inferred-lattice-lining','paper',{color:0xb4a684,roughness:.98,side:THREE.DoubleSide}),
      greyTile:add('blue-grey-fired-clay','clay-tile',{color:0x6e767c,roughness:.91}),
      tileShade:add('fired-clay-shade','clay-tile',{color:0x626c72,roughness:.92}),
      tileLight:add('fired-clay-edge','clay-tile',{color:0x7b8287,roughness:.90}),
      bed:add('study-lake-bed','masonry',{color:0x515e56,roughness:1}),
      waterline:add('damp-stone-course','masonry',{color:0x5b6759,roughness:.94})
    };
    m.red=m.greenWood;m.greenTile=m.greyTile;m.darkTile=m.tileShade;
    return m;
  }catch(error){for(const set of [owner.materials,owner.textures]){for(const item of set)try{item.dispose();}catch{}set.clear();}throw error;}
}
export function prepareWanfangAnheFinishes(builder,group,diagnostics){
  // Borrow the already reviewed metric surface-gradient/individual clay firing
  // binder verbatim. It receives only Wanfang-owned maps and material objects.
  prepareDagongmenFinishes(builder,group,diagnostics);
}
