import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../../world/package.json',import.meta.url));
const THREE=await import(require.resolve('three'));
const {GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const sharp=(await import(require.resolve('sharp'))).default;
globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const data=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return {width:data.width,height:data.height,close(){}};};
const [input,output]=process.argv.slice(2),bytes=await readFile(input),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);const body=gltf.scene.getObjectByName('SadaharuCoat'),position=body.geometry.getAttribute('position'),vertex=new THREE.Vector3(),soleVertices={FrontL:[],FrontR:[],HindL:[],HindR:[]};
for(let i=0;i<position.count;i++){vertex.fromBufferAttribute(position,i).applyMatrix4(body.matrixWorld);if(vertex.y<.0205){const key=(vertex.z>-.5?'Front':'Hind')+(vertex.x<0?'L':'R');soleVertices[key].push(i);}}
const result={sha256:createHash('sha256').update(bytes).digest('hex'),model:input,soleVertexCounts:Object.fromEntries(Object.entries(soleVertices).map(([key,v])=>[key,v.length])),clips:{}};
for(const clip of gltf.animations){
 const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const frames=[],minima=Object.fromEntries(Object.keys(soleVertices).map(key=>[key,Infinity]));let bodyMinimum=Infinity,lowestVertex=null;
 for(let sample=0;sample<=120;sample++){
   action.time=clip.duration*sample/120;mixer.update(0);gltf.scene.updateMatrixWorld(true);body.skeleton.update();const frame={time:action.time,soles:{}};
   for(const [key,indices] of Object.entries(soleVertices)){let min=Infinity;for(const i of indices){vertex.fromBufferAttribute(position,i);body.applyBoneTransform(i,vertex);vertex.applyMatrix4(body.matrixWorld);min=Math.min(min,vertex.y);}frame.soles[key]=min;minima[key]=Math.min(minima[key],min);}
   if(sample%4===0){for(let i=0;i<position.count;i++){vertex.fromBufferAttribute(position,i);body.applyBoneTransform(i,vertex);vertex.applyMatrix4(body.matrixWorld);if(vertex.y<bodyMinimum){bodyMinimum=vertex.y;const joints=body.geometry.getAttribute('skinIndex'),weights=body.geometry.getAttribute('skinWeight');lowestVertex={index:i,time:action.time,world:vertex.toArray(),rest:new THREE.Vector3().fromBufferAttribute(position,i).toArray(),influences:[0,1,2,3].map(k=>({bone:body.skeleton.bones[joints.getComponent(i,k)].name,weight:weights.getComponent(i,k)}))};}}}
   frames.push(frame);
 }
 result.clips[clip.name]={duration:clip.duration,minima,bodyMinimum,lowestVertex,frames};mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
}
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(result.clips).map(([key,v])=>[key,{minima:v.minima,bodyMinimum:v.bodyMinimum,lowestVertex:v.lowestVertex}]))));
