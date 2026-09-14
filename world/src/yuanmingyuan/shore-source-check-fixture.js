import * as THREE from 'three';
import {seededGardenRandom,VegetationGeometryBatch} from './vegetation-geometry.js';
import * as understory from './garden-understory-geometry.js';
import {traceShoreTargetNormalizations} from './shore-source-pose-trace.js';

export const shoreSourceCheckTarget='understory-shrub-flowering-spray-02-stamens';
export const shoreSourceCheckPaths=[
  'world/src/yuanmingyuan/garden-understory-study.js',
  'world/src/yuanmingyuan/garden-understory-geometry.js',
  'world/src/yuanmingyuan/vegetation-geometry.js',
  'world/src/yuanmingyuan/vegetation-textures.js',
];

const bytesOf=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
export async function sourceCheckSHA256(input){
  const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<a)throw new Error('Diagnostic source section changed: '+start);return source.slice(a,b);}

/** Work-only early-stop execution of the actual private source function.
 * Nothing inside addWood/flowerShrub or their seeded loops is rewritten. The
 * owner callback stops immediately after target geometry has been finished.
 * Sedges, ferns, later sprays and later canes are never constructed. */
export function createShoreSourceCheckFixture({studySource}){
  if(typeof studySource!=='string')throw new Error('The exact study source text is required');
  const stop=Symbol('target-finished'),disposed=[],draws=[],groups=[],batchInputs=[],poseInputs=new WeakMap();
  let target=null;
  class ObservedBatch extends VegetationGeometryBatch{
    add(geometry,matrix,tint){
      if(this.name==='understory-shrub-flowering-spray-02-centres'){
        const array=geometry.attributes.normal.array;
        batchInputs.push({source:geometry.name,vertexOffset:this.positions.length/3,vertexCount:geometry.attributes.position.count,
          matrix:(matrix??new THREE.Matrix4()).toArray(),normalMatrix:new THREE.Matrix3().getNormalMatrix(matrix??new THREE.Matrix4()).toArray(),
          sourceNormalBits:Array.from(new Uint32Array(array.buffer,array.byteOffset,array.length)),poseInput:poseInputs.get(matrix)??null});
      }
      return super.add(geometry,matrix,tint);
    }
  }
  const addWood=section(studySource,'function addWood(', '\nfunction sedge(');
  const flowerShrub=section(studySource,'function flowerShrub(', '\n/** Three authored reusable source forms');
  // The dynamic function is built solely from the hashed local source file,
  // not from page input. Imported geometry implementations stay unmodified.
  const imports={THREE,seededGardenRandom,VegetationGeometryBatch:ObservedBatch,...understory,
    understoryPose(origin,direction,normal,scale){
      const input={origin:origin.toArray(),direction:direction.toArray(),normal:normal.toArray(),scale:scale?[...scale]:[1,1,1]};
      const result=understory.understoryPose(origin,direction,normal,scale);
      const y=direction.clone().normalize(),x=y.clone().cross(normal).normalize(),z=x.clone().cross(y).normalize();
      input.diagnosticReplay={directionLengthSquared:direction.lengthSq(),directionLength:direction.length(),y:y.toArray(),x:x.toArray(),z:z.toArray()};
      poseInputs.set(result,input);return result;
    },
  };
  const build=new Function(...Object.keys(imports),'const V=(...p)=>new THREE.Vector3(...p);\n'+addWood+'\n'+flowerShrub+'\nreturn flowerShrub;')(...Object.values(imports));
  const root=new THREE.Group();root.name='understory-flower-shrub';
  const builder={flower:null,group(parent,name,data){const group=new THREE.Group();group.name=name;group.userData=data;parent.add(group);groups.push(name);return group;},
    mesh(parent,geometry,material,name){draws.push({name,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3});
      if(name===shoreSourceCheckTarget){target=geometry;throw stop;}
      geometry.dispose();disposed.push(name);
    },
  };
  try{build(builder,root,undefined);}catch(error){if(error!==stop){target?.dispose();root.clear();throw error;}}
  if(!target){root.clear();throw new Error('The actual source never produced the requested stamen mesh');}
  let released=false;
  return {geometry:target,batchInputs,diagnostics:{method:'Exact current private source bodies and imported geometry; stop at second spray owner.mesh callback',sourceFunctionBytes:addWood.length+flowerShrub.length,groups,draws,alreadyDisposed:disposed,completeUnderstoryConstructed:false,completeShrubConstructed:false,rendererConstructed:false,GPUUsed:false},
    dispose(){if(released)return;released=true;target.dispose();root.clear();},get disposed(){return released;}};
}

export async function inspectShoreSourceTarget({sourceTexts,manifest,runtime={},traceNormalizations=false}){
  const started=performance.now(),sourceIdentities=[];
  for(const path of shoreSourceCheckPaths){const source=sourceTexts[path],expected=manifest.sourceFiles.find(row=>row.path===path);if(typeof source!=='string'||!expected)throw new Error('Missing exact diagnostic source: '+path);
    const sha256=await sourceCheckSHA256(source);sourceIdentities.push({path,bytes:new TextEncoder().encode(source).byteLength,sha256,expectedSHA256:expected.sha256,match:sha256===expected.sha256});
  }
  if(sourceIdentities.some(row=>!row.match))throw new Error('Diagnostic source closure differs from production manifest');
  if(THREE.REVISION!==manifest.threeRevision)throw new Error('Diagnostic Three revision differs from production');
  const sourceIndex=manifest.sources.findIndex(record=>record.name===shoreSourceCheckTarget),record=manifest.sources[sourceIndex];
  if(!record)throw new Error('Target source is absent from the real production manifest');
  const expected=manifest.geometries[record.geometry],create=()=>createShoreSourceCheckFixture({studySource:sourceTexts[shoreSourceCheckPaths[0]]}),traced=traceNormalizations?traceShoreTargetNormalizations(create):null,fixture=traced?traced.value:create();
  try{
    const geometry=fixture.geometry,attributes={};
    for(const [name,attribute] of [['index',geometry.index],...Object.entries(geometry.attributes)]){
      const array=attribute.array,want=expected.attributes[name],sha256=await sourceCheckSHA256(bytesOf(array));
      attributes[name]={arrayType:array.constructor.name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,byteLength:array.byteLength,sha256,expectedSHA256:want?.sha256,match:sha256===want?.sha256};
    }
    const normal=geometry.attributes.normal.array;
    return {schema:'shore-source-target-check-v1',runtime:{...runtime,threeRevision:THREE.REVISION},target:shoreSourceCheckTarget,sourceIndex,geometryIndex:record.geometry,geometryName:geometry.name,
      sourceIdentities,attributes,allAttributesMatch:Object.values(attributes).every(row=>row.match),normalUint32:Array.from(new Uint32Array(normal.buffer,normal.byteOffset,normal.length)),
      batchInputs:fixture.batchInputs,normalizationTrace:traced?.trace??null,diagnostics:{...fixture.diagnostics,cpuMilliseconds:performance.now()-started,scope:'A bounded same-source target replay, not a capture of the original failing main scene or complete source factory'},nativeSceneReviewed:false};
  }finally{fixture.dispose();}
}
