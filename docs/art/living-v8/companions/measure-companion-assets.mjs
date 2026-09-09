import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {companionManifest} from '../../../../world/src/companion-manifest.js';
const require=createRequire(new URL('../../../../world/package.json',import.meta.url));
const THREE=await import(require.resolve('three'));
const {GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const sharp=(await import(require.resolve('sharp'))).default;
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const data=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return {width:data.width,height:data.height,close(){}};};
const summary={axisConvention:'glTF +Y up, +Z forward; metres',boundsMethod:'Exact skinned vertices at idle t=0 and union of 21 samples per named clip. Sampled union is not an analytic bound between frames.',assets:{}};
for(const [kind,asset] of Object.entries(companionManifest)){
  const bytes=await readFile(new URL(`../../../../world/public${asset.url}`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let meshes=0,triangles=0,vertices=0;const materials=new Set(),bones=new Set();
  gltf.scene.traverse(object=>{
    if(object.isBone)bones.add(object.name);
    if(!object.isMesh)return;
    meshes++;vertices+=object.geometry.attributes.position.count;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;
    for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material.uuid);
  });
  function bounds(){gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(object=>object.skeleton?.update());return new THREE.Box3().setFromObject(gltf.scene,true);}
  const pack=box=>({min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()});
  const all=new THREE.Box3(),perClip={};let idle;
  for(const clip of gltf.animations){
    const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const box=new THREE.Box3();
    for(let sample=0;sample<=20;sample++){
      action.time=clip.duration*sample/20;mixer.update(0);const current=bounds();box.union(current);
      if(clip.name==='idle'&&sample===0)idle=pack(current);
    }
    all.union(box);perClip[clip.name]=pack(box);mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
  }
  const sourcePath=`world/public/models/companions/${kind}.blend`,sourceBytes=await readFile(new URL(`../../../../${sourcePath}`,import.meta.url));
  summary.assets[kind]={url:asset.url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,meshes,materials:materials.size,bones:bones.size,vertices,triangles,idle,animationSampleUnion:pack(all),perClip,
    editableSource:{path:sourcePath,sha256:createHash('sha256').update(sourceBytes).digest('hex'),bytes:sourceBytes.length}};
}
await writeFile(new URL('./delivery-metrics.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.assets));
