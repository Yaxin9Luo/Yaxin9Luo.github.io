// Runtime garden geometry exported without lights or a browser.
// Run from the repository root: node scripts/art/environment/export-assets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../world/node_modules/three/build/three.module.js';
import {GLTFExporter} from '../../../world/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {createGardenSpecimen} from '../../../world/src/gardens.js';
import {gardenDistricts} from '../../../world/src/environment-layout.js';
import {createGroveTree,createGroveShrub,createGardenFlower} from '../../../world/src/grove-foliage.js';
import {CanvasElement,ImageData} from '@napi-rs/canvas';

// Standard canvas encoding keeps the runtime DataTexture leaf veins and bark
// relief in these review GLBs. The native canvas is an art-tool dependency only.
globalThis.OffscreenCanvas=CanvasElement;
globalThis.ImageData=ImageData;
// Napi's data() helper is not a browser Canvas API. GLTFExporter otherwise
// mistakes that function for a DataTexture pixel array and writes blank PNGs.
Object.defineProperty(CanvasElement.prototype,'data',{value:undefined,configurable:true});
const rasterTextures=new WeakMap();
function prepareTexturesForExport(object){
  object.traverse(mesh=>{
    if(!mesh.material)return;
    for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))for(const channel of['map','normalMap']){
      const source=material[channel];if(!source?.isDataTexture)continue;
      if(!rasterTextures.has(source)){
        const {width,height,data}=source.image,canvas=new CanvasElement(width,height);
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);
        const texture=new THREE.CanvasTexture(canvas);texture.name=source.name;texture.colorSpace=source.colorSpace;texture.flipY=source.flipY;texture.wrapS=source.wrapS;texture.wrapT=source.wrapT;texture.minFilter=source.minFilter;texture.magFilter=source.magFilter;texture.repeat.copy(source.repeat);texture.offset.copy(source.offset);rasterTextures.set(source,texture);
      }
      material[channel]=rasterTextures.get(source);
    }
  });return object;
}

globalThis.FileReader=class{
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const output=path.join(root,'world/public/models/environment');
await fs.mkdir(output,{recursive:true});
const assets=[];
for(const district of gardenDistricts){
  const object=prepareTexturesForExport(createGardenSpecimen(district.id)),bounds=new THREE.Box3().setFromObject(object);
  const binary=await new GLTFExporter().parseAsync(object,{binary:true,onlyVisible:true});
  const filename=`${district.id}.glb`;
  await fs.writeFile(path.join(output,filename),Buffer.from(binary));
  let triangles=0,meshes=0,colliders=0;const materials=new Set();
  object.traverse(o=>{colliders+=(o.userData.colliders||[]).length;if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;materials.add(o.material.name);}});
  const asset={id:district.id,file:filename,bytes:binary.byteLength,triangles,meshes,colliders,materials:[...materials],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},placement:{x:district.x,y:district.y,z:district.z},units:'metres',front:'+Z'};
  assets.push(asset);console.log(JSON.stringify(asset));
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:2,source:'world/src/gardens.js',layout:'world/src/environment-layout.js',provenance:'Original authored garden geometry. Botanical surfaces include the actual leaf and bark pigment/normal textures; the standard PBR export omits runtime wind. Non-botanical PBR loader textures use the offline factory base material.',assets},null,2)+'\n');
const foliageAssets=[];
for(const kind of['pine','silver','cherry']){
  const object=prepareTexturesForExport(createGroveTree(kind,168)),bounds=new THREE.Box3().setFromObject(object),binary=await new GLTFExporter().parseAsync(object,{binary:true,onlyVisible:true});
  const file=`grove-${kind}.glb`;await fs.writeFile(path.join(output,file),Buffer.from(binary));
  foliageAssets.push({id:kind,file,bytes:binary.byteLength,triangles:object.children.reduce((sum,o)=>sum+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0),meshes:object.children.length,detail:object.userData.botanicalDetail,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},opaque:true,units:'metres'});
}
for(const [id,object]of[['shrub',createGroveShrub()],['flower',createGardenFlower()]]){
  prepareTexturesForExport(object);const bounds=new THREE.Box3().setFromObject(object),binary=await new GLTFExporter().parseAsync(object,{binary:true,onlyVisible:true}),file=`garden-${id}.glb`;await fs.writeFile(path.join(output,file),Buffer.from(binary));
  foliageAssets.push({id,file,bytes:binary.byteLength,triangles:object.children.reduce((sum,o)=>sum+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0),meshes:object.children.length,detail:object.userData.botanicalDetail,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},opaque:true,units:'metres'});
}
await fs.writeFile(path.join(output,'foliage-manifest.json'),JSON.stringify({version:2,source:'world/src/grove-foliage.js',provenance:'Original curved branches, individual folded leaf/needle surfaces, separate flower petals and stamens. Shared local pigment and normal DataTextures are baked unchanged into standard PBR review textures. No alpha-masked leaves or large spherical crown shells.',assets:foliageAssets},null,2)+'\n');
