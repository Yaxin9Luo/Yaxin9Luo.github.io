import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const world=new URL('../../../../world/',import.meta.url),require=createRequire(new URL('package.json',world)),sharp=require('sharp');
const {GLTFLoader}=await import(new URL('node_modules/three/examples/jsm/loaders/GLTFLoader.js',world));
const hash=data=>createHash('sha256').update(data).digest('hex');
const currentBytes=await readFile(new URL('src/herbarium-assets.js',world)),oldBytes=await readFile(new URL('r6-water-final/herbarium-assets.js',import.meta.url));
const oldCode=oldBytes.toString().replace(/from '([^']+)'/g,(_,id)=>`from '${new URL(id==='three'?'node_modules/three/build/three.module.js':id.startsWith('three/addons/')?'node_modules/three/examples/jsm/'+id.slice(13):'src/'+id,world)}'`);
const current=await import(new URL('src/herbarium-assets.js',world)),previous=await import('data:text/javascript;base64,'+Buffer.from(oldCode).toString('base64'));
globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,close(){}};};
for(const id of ['fern_02','periwinkle_plant','potted_plant_01']){const bytes=await readFile(new URL(`public/models/herbarium/botanical/${id}.glb`,world)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');current.bindHerbariumBotanicalSource(id,gltf.scene);previous.bindHerbariumBotanicalSource(id,gltf.scene);}
const before=previous.createWaterGarden(),after=current.createWaterGarden(),changes=[];assert.equal(before.children.length,after.children.length);
for(let i=0;i<before.children.length;i++){
  const a=before.children[i],b=after.children[i];assert.equal(a.name,b.name);assert.deepEqual(a.geometry.index.array,b.geometry.index.array);assert.deepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
  for(const name of Object.keys(a.geometry.attributes)){
    const av=a.geometry.attributes[name],bv=b.geometry.attributes[name];if(hash(av.array)===hash(bv.array))continue;
    assert.equal(name,'normal');assert.ok(['lilyPink','lilyIvory'].includes(a.name));const changed=new Set();
    for(let k=0;k<av.count;k++)if(av.getX(k)!==bv.getX(k)||av.getY(k)!==bv.getY(k)||av.getZ(k)!==bv.getZ(k)){assert.equal(Math.hypot(av.getX(k),av.getY(k),av.getZ(k)),0);assert.ok(Math.abs(Math.hypot(bv.getX(k),bv.getY(k),bv.getZ(k))-1)<1e-6);changed.add(k);}
    const p=a.geometry.attributes.position,index=a.geometry.index;let incident=0;
    for(let k=0;k<index.count;k+=3){const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];if(!ids.some(v=>changed.has(v)))continue;incident++;const u=ids[1],v=ids[0],w=ids[2],ax=p.getX(u)-p.getX(v),ay=p.getY(u)-p.getY(v),az=p.getZ(u)-p.getZ(v),bx=p.getX(w)-p.getX(v),by=p.getY(w)-p.getY(v),bz=p.getZ(w)-p.getZ(v);assert.ok(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)<1e-12,'normal change touched a triangle with visible area');}
    changes.push({batch:a.name,changedEndpointNormals:changed.size,incidentZeroAreaTriangles:incident});
  }
}
assert.equal(changes.reduce((sum,x)=>sum+x.changedEndpointNormals,0),396);
const evidence={visualSourceSHA256:hash(oldBytes),finalSourceSHA256:hash(currentBytes),positionsIndicesUVColorsIdentical:true,changedNormalsOnlyIncidentOnZeroAreaTriangles:true,changes};
await writeFile(new URL('r6-final-parity.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));current.disposeHerbariumAsset(after);previous.disposeHerbariumAsset(before);
