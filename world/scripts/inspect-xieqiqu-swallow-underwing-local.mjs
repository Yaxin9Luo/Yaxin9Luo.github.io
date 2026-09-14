import * as THREE from 'three';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createCopperSwallowWingGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {applySwallowPose} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {createSwallowUnderwingGeometry,swallowUnderwingParameters} from '../src/yuanmingyuan/xieqiqu-swallow-underwing.js';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

if(!process.argv[2])throw new Error('Provide a new local-wing-only output directory');
const directory=path.resolve(process.argv[2]);await mkdir(directory,{recursive:false});
const started=performance.now(),files=['src/yuanmingyuan/xieqiqu-copper-swallow.js','src/yuanmingyuan/xieqiqu-swallow-feathers.js','src/yuanmingyuan/xieqiqu-swallow-pose.js','src/yuanmingyuan/xieqiqu-swallow-underwing.js','scripts/inspect-xieqiqu-swallow-underwing-local.mjs','scripts/xieqiqu-sculpture-cpu-review.mjs'],sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source={};
for(const file of files){const bytes=await readFile(new URL('../'+file,import.meta.url));source[file]=sha(bytes);const to=path.join(directory,'source/world',file);await mkdir(path.dirname(to),{recursive:true});await writeFile(to,bytes);}
const geometry=createCopperSwallowWingGeometry(1);applySwallowPose(geometry,'wing');const original=Object.fromEntries([['index',sha(Buffer.from(geometry.index.array.buffer))],...Object.entries(geometry.attributes).map(([key,a])=>[key,sha(Buffer.from(a.array.buffer))])]);
const material=new THREE.MeshStandardMaterial({name:'local-shape-inspection-only',color:0xffffff}),group=new THREE.Group(),carrier=new THREE.Mesh(geometry,material),owner={group,diagnostics:{scope:'one actual wing plus new underwing geometry only',native:false,wholeBird:false,parameters:swallowUnderwingParameters}},views={oblique:{direction:[.8,.5,1]},plan:{direction:[.08,1,.18]},profile:{direction:[1,.18,-.2]},back:{direction:[.05,-1,.18]}},result={source,originalCarrierHashes:original,wholeBird:false,gpu:false,materialAcceptance:false,inspectionTransform:'all geometry is rigidly turned pi radians around X so the unchanged CPU inspection light illuminates the lower side; this is not the native profile light'},disposed=[];let coverts;
group.add(carrier);group.rotation.x=Math.PI;
for(const resource of [geometry,material])resource.addEventListener('dispose',()=>disposed.push(resource.name||resource.type));
try{
  result.before=await inspectSculptureCPU(owner,path.join(directory,'before'),{viewSpecs:views,size:2048});coverts=createSwallowUnderwingGeometry(1);coverts.addEventListener('dispose',()=>disposed.push(coverts.name));group.add(new THREE.Mesh(coverts,material));
  result.after=await inspectSculptureCPU(owner,path.join(directory,'after'),{viewSpecs:views,size:2048});result.triangles={carrier:geometry.index.count/3,coverts:coverts.index.count/3};result.carrierHashesUnchanged=JSON.stringify(original)===JSON.stringify(Object.fromEntries([['index',sha(Buffer.from(geometry.index.array.buffer))],...Object.entries(geometry.attributes).map(([key,a])=>[key,sha(Buffer.from(a.array.buffer))])]));
}catch(error){result.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{geometry.dispose();coverts?.dispose();material.dispose();group.clear();result.disposed=disposed;result.seconds=(performance.now()-started)/1000;result.peakRSSBytes=process.resourceUsage().maxRSS*1024;await writeFile(path.join(directory,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({directory,triangles:result.triangles,seconds:result.seconds,peakRSSBytes:result.peakRSSBytes,disposed,error:result.error??null}));}
