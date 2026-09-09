import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../../world/package.json',import.meta.url));
const THREE=await import(require.resolve('three'));
const {GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const sharp=(await import(require.resolve('sharp'))).default;
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const data=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return {width:data.width,height:data.height,close(){}};};
const [oldPath,newPath,output]=process.argv.slice(2);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function load(path){
  const bytes=await readFile(path),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binOffset=28+jsonLength;
  const images=(json.images||[]).map(image=>{const v=json.bufferViews[image.bufferView];return {mimeType:image.mimeType,sha256:hash(bytes.subarray(binOffset+(v.byteOffset||0),binOffset+(v.byteOffset||0)+v.byteLength))};});
  return {gltf,bytes,images};
}
const [a,b]=await Promise.all([load(oldPath),load(newPath)]);
function compareArray(a,b){
  if(!a||!b||a.length!==b.length)return {equal:false,lengths:[a?.length,b?.length]};
  let maximumDelta=0;for(let i=0;i<a.length;i++)maximumDelta=Math.max(maximumDelta,Math.abs(a[i]-b[i]));
  return {equal:maximumDelta===0,maximumDelta,length:a.length};
}
const meshes=[],nodes=[],clips=[],poseDifferences={};
a.gltf.scene.traverse(object=>{
  const other=b.gltf.scene.getObjectByName(object.name);
  if(object.isBone)nodes.push({name:object.name,restMatrix:compareArray(object.matrix.elements,other?.matrix.elements)});
  if(!object.isMesh)return;
  const attributes={};
  for(const [name,attribute] of Object.entries(object.geometry.attributes))attributes[name]=compareArray(attribute.array,other?.geometry.attributes[name]?.array);
  const binds=object.skeleton?object.skeleton.boneInverses.map((matrix,i)=>compareArray(matrix.elements,other?.skeleton?.boneInverses[i]?.elements)):[];
  meshes.push({name:object.name,attributes,indices:compareArray(object.geometry.index?.array,other?.geometry.index?.array),inverseBindsEqual:binds.every(value=>value.equal),boneNamesEqual:JSON.stringify(object.skeleton?.bones.map(b=>b.name))===JSON.stringify(other?.skeleton?.bones.map(b=>b.name))});
});
for(const clip of a.gltf.animations){
  const other=b.gltf.animations.find(item=>item.name===clip.name);
  clips.push({name:clip.name,durationEqual:clip.duration===other?.duration,trackCountEqual:clip.tracks.length===other?.tracks.length,tracks:clip.tracks.map(track=>{
    const next=other?.tracks.find(item=>item.name===track.name);
    return {name:track.name,times:compareArray(track.times,next?.times),values:compareArray(track.values,next?.values)};
  })});
  const ma=new THREE.AnimationMixer(a.gltf.scene),mb=new THREE.AnimationMixer(b.gltf.scene);
  const aa=ma.clipAction(clip),ab=mb.clipAction(other);for(const action of [aa,ab]){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}
  const perMesh={},va=new THREE.Vector3(),vb=new THREE.Vector3();
  for(let phase=0;phase<=8;phase++){
    aa.time=ab.time=clip.duration*phase/8;ma.update(0);mb.update(0);
    for(const item of [a,b]){item.gltf.scene.updateMatrixWorld(true);item.gltf.scene.traverse(o=>o.skeleton?.update());}
    for(const {name} of meshes){
      const left=a.gltf.scene.getObjectByName(name),right=b.gltf.scene.getObjectByName(name);let maximum=perMesh[name]||0;
      for(let i=0;i<left.geometry.attributes.position.count;i++){
        left.getVertexPosition(i,va).applyMatrix4(left.matrixWorld);right.getVertexPosition(i,vb).applyMatrix4(right.matrixWorld);maximum=Math.max(maximum,va.distanceTo(vb));
      }
      perMesh[name]=maximum;
    }
  }
  poseDifferences[clip.name]={samples:9,maximumWorldVertexDisplacement:Math.max(...Object.values(perMesh)),perMesh};
  ma.stopAllAction();mb.stopAllAction();ma.uncacheRoot(a.gltf.scene);mb.uncacheRoot(b.gltf.scene);
}
const result={previous:{path:oldPath,sha256:hash(a.bytes)},candidate:{path:newPath,sha256:hash(b.bytes)},embeddedImagesEqual:JSON.stringify(a.images)===JSON.stringify(b.images),images:b.images,boneRest:nodes,meshes,clips,poseDifferences};
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({candidate:result.candidate,embeddedImagesEqual:result.embeddedImagesEqual,allBoneRestEqual:nodes.every(n=>n.restMatrix.equal),allClipTracksEqual:clips.every(c=>c.durationEqual&&c.trackCountEqual&&c.tracks.every(t=>t.times.equal&&t.values.equal)),poseDifferences:Object.fromEntries(Object.entries(poseDifferences).map(([key,v])=>[key,v.maximumWorldVertexDisplacement]))}));
