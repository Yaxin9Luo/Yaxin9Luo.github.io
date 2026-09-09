import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../../world/package.json',import.meta.url)),sharp=require('sharp'),{NodeIO}=require('@gltf-transform/core');
const root=fileURLToPath(new URL('../../../../',import.meta.url)),sources=path.join(root,'work/living-v8/research/plant-sources'),out=path.join(root,'world/public/models/herbarium/botanical');
await fs.mkdir(out,{recursive:true});const records=[];
for(const[id,alpha]of[['fern_02','alpha'],['periwinkle_plant','opacity'],['shrub_01','alpha'],['potted_plant_01','leaves_alpha']]){
  const source=path.join(sources,id),document=await new NodeIO().read(path.join(source,id+'_4k.gltf'));
  const color=await fs.readFile(path.join(source,'textures',id+(id==='potted_plant_01'?'_leaves':'')+'_diff_4k.jpg')),mask=await fs.readFile(path.join(source,'textures',id+'_'+alpha+'_4k.png'));
  const {data:rgb,info}=await sharp(color).removeAlpha().raw().toBuffer({resolveWithObject:true}),{data:opacity,info:mi}=await sharp(mask).greyscale().raw().toBuffer({resolveWithObject:true});
  if(info.width!==mi.width||info.height!==mi.height)throw new Error('Source alpha size mismatch');
  const rgba=Buffer.alloc(info.width*info.height*4);let masked=0;
  for(let i=0,j=0;i<rgba.length;i+=4,j++){rgba[i]=rgb[j*3];rgba[i+1]=rgb[j*3+1];rgba[i+2]=rgb[j*3+2];rgba[i+3]=opacity[j];if(opacity[j]<128)masked++;}
  const png=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  for(const material of document.getRoot().listMaterials()){if(id==='potted_plant_01'&&!material.getName().endsWith('_leaves'))continue;material.getBaseColorTexture().setImage(png).setMimeType('image/png').setName(id+' source RGB plus original alpha');material.setAlphaMode('MASK').setAlphaCutoff(.5).setDoubleSided(true);}
  const bytes=await new NodeIO().writeBinary(document),destination=path.join(out,id+'.glb');await fs.writeFile(destination,bytes);
  records.push({id,source:'https://polyhaven.com/a/'+id,license:'CC0',runtimeGLB:'world/public/models/herbarium/botanical/'+id+'.glb',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,derivative:'Original unresized 4096 source RGB copied exactly with matching original alpha; MASK alphaCutoff0.5; all original source variant meshes/normals/UVs unchanged.',width:info.width,height:info.height,maskedPixelFraction:masked/(info.width*info.height),variants:document.getRoot().listNodes().map(n=>n.getName()),rgbSHA256:crypto.createHash('sha256').update(color).digest('hex'),alphaSHA256:crypto.createHash('sha256').update(mask).digest('hex')});console.log(id,bytes.length,records.at(-1).sha256);
}
await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(records,null,2));
