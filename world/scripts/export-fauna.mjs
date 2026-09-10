import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {FAUNA_VERSION,createSwallow,setSwallowPose,createPaperLantern,createFirefly,setFireflyFlight,fireflyFlightRig,disposeFaunaSpecimen} from '../src/sky-fauna.js';

// GLTFExporter only needs FileReader to encode its generated binary buffer.
globalThis.FileReader=class{
  readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();});}
};
const output=new URL('../public/models/fauna/',import.meta.url);await mkdir(output,{recursive:true});
const sourceURL=new URL('../src/sky-fauna.js',import.meta.url),source=await readFile(sourceURL),manifest={version:FAUNA_VERSION,recipe:'world/src/sky-fauna.js',recipeSHA256:createHash('sha256').update(source).digest('hex'),assets:[]};
for(const [id,create] of [['swallow',createSwallow],['paper-lantern',createPaperLantern],['firefly',createFirefly]]){
  const original=create(),object=original.clone(true),excluded=[];
  object.traverse(o=>{if(o.userData.excludeFromGLB)excluded.push(o);o.userData={originalAsset:FAUNA_VERSION};});excluded.forEach(o=>o.removeFromParent());
  const animations=[];
  if(id==='swallow'){
    const times=[],weights=[],rotations=[];
    for(let frame=0;frame<=300;frame++){const t=frame/30;setSwallowPose(original,'flight',t);times.push(t);weights.push(...original.morphTargetInfluences);rotations.push(...original.quaternion.toArray());}
    animations.push(new THREE.AnimationClip('Bank, flap and glide',10,[new THREE.NumberKeyframeTrack(`${object.uuid}.morphTargetInfluences`,times,weights),new THREE.QuaternionKeyframeTrack(`${object.uuid}.quaternion`,times,rotations)]));
  }
  if(id==='firefly'){
    const parts=fireflyFlightRig(original),times=[],values=parts.map(()=>({positions:[],rotations:[]}));
    for(let frame=0;frame<=1200;frame++){const t=frame/120;times.push(t);setFireflyFlight(original,t);parts.forEach(({part},i)=>{values[i].positions.push(...part.position.toArray());values[i].rotations.push(...part.quaternion.toArray());});}
    const tracks=parts.flatMap(({part},i)=>{const target=object.children[original.children.indexOf(part)];return[new THREE.VectorKeyframeTrack(`${target.uuid}.position`,times,values[i].positions),new THREE.QuaternionKeyframeTrack(`${target.uuid}.quaternion`,times,values[i].rotations)];});
    animations.push(new THREE.AnimationClip('23 Hz attached wingbeat',10,tracks));
  }
  const bytes=await new GLTFExporter().parseAsync(object,{binary:true,animations,onlyVisible:false});await writeFile(new URL(id+'.glb',output),Buffer.from(bytes));
  manifest.assets.push({id,file:id+'.glb',bytes:bytes.byteLength,sha256:createHash('sha256').update(Buffer.from(bytes)).digest('hex'),geometry:'Exact runtime mesh topology, vertex pigments and morph positions/normals',limitations:id==='paper-lantern'?'GLB base PBR paper material; runtime shader adds filtered fibres and graded emission. Additive view-space aura remains in editable source.':id==='firefly'?'Exact PBR insect; view-space additive aura remains in editable source.':null});disposeFaunaSpecimen(original);
}
await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');await writeFile(new URL('sky-fauna.js',output),source);
console.log(JSON.stringify(manifest,null,2));
