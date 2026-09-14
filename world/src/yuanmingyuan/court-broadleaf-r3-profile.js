import * as THREE from 'three';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const courtBroadleafR3Review='work/yuanmingyuan/court-low-broadleaf-r3-candidate/freeze.json';
export const courtBroadleafR3Profile=freeze({
  "id": "court-low-broadleaf-r3",
  "triangles": 2889048,
  "meshes": 10,
  "leaves": 1822,
  "seed": 831427,
  "rootMinY": -0.030000144615769386,
  "rootRadius": 0.08790801105782849,
  "rootBandMaximumY": 0.005,
  "rootVertices": 1434,
  "rootMin": [
    -0.0744788870215416,
    -0.030000144615769386,
    -0.07987065613269806
  ],
  "rootMax": [
    0.07889322191476822,
    0.004570515360683203,
    0.07103259116411209
  ],
  "min": [
    -0.3674618899822235,
    -0.030000144615769386,
    -0.42682161927223206
  ],
  "max": [
    0.40390390157699585,
    0.642770528793335,
    0.3915433883666992
  ],
  "meshRecords": [
    {
      "name": "court-r3-detail-connected-wood",
      "vertices": 1505,
      "triangles": 2476,
      "kind": "wood",
      "leafVariant": null
    },
    {
      "name": "court-r3-detail-real-leaves-0",
      "vertices": 13957,
      "triangles": 25704,
      "kind": "leaf",
      "leafVariant": 0
    },
    {
      "name": "court-r3-detail-real-leaves-1",
      "vertices": 10673,
      "triangles": 19656,
      "kind": "leaf",
      "leafVariant": 1
    },
    {
      "name": "court-r3-detail-real-leaves-2",
      "vertices": 3284,
      "triangles": 6048,
      "kind": "leaf",
      "leafVariant": 2
    },
    {
      "name": "court-r3-ground-roots",
      "vertices": 1395,
      "triangles": 2448,
      "kind": "root",
      "leafVariant": null
    },
    {
      "name": "court-r3-connected-inner-wood",
      "vertices": 24823,
      "triangles": 43436,
      "kind": "wood",
      "leafVariant": null
    },
    {
      "name": "court-r3-leaf-petioles",
      "vertices": 53640,
      "triangles": 85824,
      "kind": "petiole",
      "leafVariant": null
    },
    {
      "name": "court-r3-real-ovate-leaves-0",
      "vertices": 718375,
      "triangles": 1323000,
      "kind": "leaf",
      "leafVariant": 0
    },
    {
      "name": "court-r3-real-ovate-leaves-1",
      "vertices": 619855,
      "triangles": 1141560,
      "kind": "leaf",
      "leafVariant": 1
    },
    {
      "name": "court-r3-real-ovate-leaves-2",
      "vertices": 129718,
      "triangles": 238896,
      "kind": "leaf",
      "leafVariant": 2
    }
  ],
  "textureRecords": {
    "map": {
      "file": "BilberryLeaf01_2K_front_BaseColor.png",
      "sha256": "bd6fee1075f66214c3b65a913a371107689984d37097db8b01863df0a31e0932",
      "bytes": 2594594,
      "width": 1024,
      "height": 2048,
      "bitDepth": 8,
      "pngColorType": 6
    },
    "normalMap": {
      "file": "BilberryLeaf01_2K_front_Normal.png",
      "sha256": "52350c490f57a82d519259ab6e05422581c8e02ce77920744045dff05ec1f96c",
      "bytes": 4179392,
      "width": 1024,
      "height": 2048,
      "bitDepth": 8,
      "pngColorType": 6
    },
    "roughnessMap": {
      "file": "BilberryLeaf01_2K_front_Roughness.png",
      "sha256": "8e90979a27ee159bd60ffeb903f663b328006938274066dc756052e73b304f42",
      "bytes": 1751683,
      "width": 1024,
      "height": 2048,
      "bitDepth": 8,
      "pngColorType": 6
    }
  },
  "normalConvention": "directx",
  "normalScale": [
    1,
    -1
  ],
  "sourceFreezeSHA256": "e5332dc3e047370199afbc609d6f534443570237335cecdc54f1734989e749f8",
  "nativeReviewed": false,
  "visualAcceptance": false,
  "integrationAcceptance": false,
  "historicallySurveyed": false
});

const close=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<1e-6);
const identity=node=>node.position.x===0&&node.position.y===0&&node.position.z===0&&node.quaternion.x===0&&node.quaternion.y===0&&node.quaternion.z===0&&node.quaternion.w===1&&node.scale.x===1&&node.scale.y===1&&node.scale.z===1&&(node.matrixAutoUpdate||node.matrix.elements.every((v,i)=>v===(i%5===0?1:0)));
const fail=message=>{throw new Error('Textured broadleaf R3 '+message);};
function assertSurfaceDiagnostics(d){
 const p=courtBroadleafR3Profile;
 if(!d||d.normalConvention!=='directx'||d.effectiveImageTopV!==1||d.textureFlipY!==false||d.sourcePixelFormat!=='RGBA8'||d.encodedFilesUnmodified!==true||d.decodedOriginalDimensionsVerified!==true||
  d.generateMipmaps!==true||d.minFilter!=='LinearMipmapLinearFilter'||d.magFilter!=='LinearFilter'||d.anisotropy!==16||d.customMips!==false||d.sourceColorEdits!==false)fail('requires the unchanged original three-map surface lease');
 for(const [slot,r]of Object.entries(p.textureRecords)){
  const a=d.files?.[slot];if(!a||a.sha256!==r.sha256||a.bytes!==r.bytes||a.width!==r.width||a.height!==r.height||a.bitDepth!==8||a.pngColorType!==6)fail('surface source identity changed: '+slot);
 }
}
export function assertCourtBroadleafR3Record(record){
 const {part,owner,review}=record??{},p=courtBroadleafR3Profile,d=owner?.diagnostics;
 if(review!==courtBroadleafR3Review||!part?.isGroup||part.userData.id!=='low-broadleaf'||part.userData.sourceAssetId!==p.id||!owner?.group?.isGroup||owner.group.parent||owner.group.children.length!==1||part.parent!==owner.group||
  !identity(owner.group)||!identity(part)||owner.disposed||typeof owner.dispose!=='function'||d?.id!==p.id||d.seed!==p.seed||d.triangles!==p.triangles||d.meshCount!==p.meshes||d.counts?.leaves!==p.leaves||
  d.root?.bandVertices!==p.rootVertices||d.root.bandMaximumY!==p.rootBandMaximumY||!Number.isFinite(d.root.radius)||Math.abs(d.root.radius-p.rootRadius)>1e-6||!close(d.root.min,p.rootMin)||!close(d.root.max,p.rootMax)||
  d.material?.authoredGeometry!==true||d.material.maps!==3||d.material.normalConvention!=='directx'||d.historicallySurveyed!==false)fail('requires its complete independently owned textured source and new review identity');
 assertSurfaceDiagnostics(d.material.surfaceLease);return true;
}
function assertTexture(texture,slot){
 const r=courtBroadleafR3Profile.textureRecords[slot],data=texture?.image;
 if(!texture?.isTexture||texture.isCompressedTexture||texture.type!==THREE.UnsignedByteType||texture.format!==THREE.RGBAFormat||data?.width!==r.width||data.height!==r.height||
  texture.userData?.encodedSHA256!==r.sha256||texture.userData.encodedBytes!==r.bytes||texture.userData.encodedFileUnmodified!==true||texture.userData.effectiveImageTopV!==1||
  texture.colorSpace!==(slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace)||texture.flipY!==false||texture.premultiplyAlpha!==false||
  texture.wrapS!==THREE.ClampToEdgeWrapping||texture.wrapT!==THREE.ClampToEdgeWrapping||texture.minFilter!==THREE.LinearMipmapLinearFilter||texture.magFilter!==THREE.LinearFilter||
  texture.generateMipmaps!==true||texture.anisotropy!==16||texture.channel!==0||texture.mipmaps.length!==0||
  texture.offset.x!==0||texture.offset.y!==0||texture.repeat.x!==1||texture.repeat.y!==1||texture.center.x!==0||texture.center.y!==0||texture.rotation!==0||texture.matrixAutoUpdate!==true)fail('original sampler/image changed: '+slot);
}
export function assertCourtBroadleafR3Geometry(part,actual){
 const p=courtBroadleafR3Profile;
 if(actual.triangles!==p.triangles||actual.records.length!==p.meshes||part.userData.windAmplitude!==0||actual.roots.length!==p.rootVertices||
  !close(actual.bounds.min.toArray(),p.min)||!close(actual.bounds.max.toArray(),p.max))fail('complete crown or actual root band changed');
 let minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],radius=0;
 for(const q of actual.roots){
  const values=[q.x,q.y,q.z];if(!values.every(Number.isFinite)||q.y>p.rootBandMaximumY)fail('invalid actual root vertex');
  for(let i=0;i<3;i++){minimum[i]=Math.min(minimum[i],values[i]);maximum[i]=Math.max(maximum[i],values[i]);}
  radius=Math.max(radius,Math.hypot(q.x,q.z));
 }
 if(!close(minimum,p.rootMin)||!close(maximum,p.rootMax)||Math.abs(radius-p.rootRadius)>1e-6)fail('actual root extent changed');
 let leafMaterial=null,woodMaterial=null;
 for(const [i,{node}]of actual.records.entries()){
  const expected=p.meshRecords[i],g=node.geometry,m=node.material,leaf=expected.kind==='leaf';
  if(node.name!==expected.name||node.userData.botanicalPart!==expected.kind||!node.isMesh||node.isInstancedMesh||node.isSkinnedMesh||Array.isArray(m)||g.index?.count/3!==expected.triangles||g.attributes.position?.count!==expected.vertices||
   !g.attributes.normal||!g.attributes.color||!g.attributes.uv||g.attributes.normal.count!==expected.vertices||g.attributes.color.count!==expected.vertices||g.attributes.uv.count!==expected.vertices||
   g.drawRange.start!==0||g.drawRange.count!==Infinity||!m?.isMeshStandardMaterial||!m.vertexColors||m.alphaTest!==0||m.alphaHash||m.alphaToCoverage||m.transparent||m.opacity!==1||
   m.side!==(leaf?THREE.DoubleSide:THREE.FrontSide)||m.roughness!==(leaf?1:.89)||m.metalness!==0||m.color.getHex()!==0xffffff||m.emissive.getHex()!==0)fail('requires every original mesh and opaque PBR material');
  if(leaf){
   if(leafMaterial&&m!==leafMaterial)fail('must share the one private leaf material');leafMaterial=m;
   if(m.normalScale.x!==1||m.normalScale.y!==-1||m.normalMapType!==THREE.TangentSpaceNormalMap)fail('requires DirectX normalScale [1,-1]');
   for(const slot of ['map','normalMap','roughnessMap'])assertTexture(m[slot],slot);
   if(Object.entries(m).some(([key,value])=>value?.isTexture&&!['map','normalMap','roughnessMap'].includes(key)))fail('unexpected leaf map');
  }else{
   if(woodMaterial&&m!==woodMaterial)fail('must share the one original wood material');woodMaterial=m;
   if(Object.values(m).some(value=>value?.isTexture))fail('wood material must remain untextured');
  }
 }
 if(!leafMaterial||!woodMaterial||leafMaterial===woodMaterial||new Set([leafMaterial.map,leafMaterial.normalMap,leafMaterial.roughnessMap]).size!==3)fail('requires two materials and three independent original textures');
 return true;
}
export const courtBroadleafR3Contract=Object.freeze({profile:courtBroadleafR3Profile,review:courtBroadleafR3Review,assertRecord:assertCourtBroadleafR3Record,assertGeometry:assertCourtBroadleafR3Geometry});
