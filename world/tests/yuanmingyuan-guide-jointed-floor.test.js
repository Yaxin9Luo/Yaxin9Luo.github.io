import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,BoxGeometry,InstancedMesh,Matrix4} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';

// A small excerpt of the actual Haiyue paving: identical rounded prototype,
// staggered pitch, Float32 instance transforms, joint depth and world placement.
// It avoids building the complete 29.9-million-triangle pavilion to reproduce
// the native first rejected patrol segment.
function court(){
  const root=new Group();root.position.set(550,2.65,-352);
  const material=new MeshBasicMaterial(),stone=new RoundedBoxGeometry(1,1,1,2,.022),baseGeometry=new BoxGeometry(28,.2,28);
  const base=new Mesh(baseGeometry,material);base.position.set(15,2.06,10);root.add(base);
  const placements=[];
  for(let iz=-4;iz<=28;iz++)for(let ix=0;ix<=24;ix++)placements.push([(ix+(iz%2)*.5)*1.26,2.168,iz*.84]);
  const pavers=new InstancedMesh(stone,material,placements.length);pavers.name='actual-haiyue-jointed-paving-excerpt';
  placements.forEach((p,i)=>pavers.setMatrixAt(i,new Matrix4().makeScale(1.246,.064,.826).setPosition(...p)));root.add(pavers);
  const architecture=createArchitectureSurface(root),terrain={colliders:[],surfaceAt:()=>({height:4,normal:{x:0,y:1,z:0},walkable:true,surfaceId:'terrain'})};
  const world=createMuseumGuideWorld({site:{position:[550,2.65,-352],guide:[13,2.2,13],scale:1},centre:{x:563,z:-339},terrain,architecture});
  return {world,dispose(){world.dispose();architecture.dispose();pavers.dispose();stone.dispose();baseGeometry.dispose();material.dispose();}};
}

test('native Haiyue patrol turns remain traversable across actual rounded paver joints',()=>{
  const f=court();
  const segments=[
    [{x:562.9548024091602,z:-345.7104614008843,heading:-.30970477739194696},{x:562.9201478151529,z:-345.6187615184891,heading:-.4129397031892626}],
    [{x:555.9798226778249,z:-338.80524428685555,heading:-.2064698515946313},{x:555.9548024091602,z:-338.7104614008843,heading:-.30970477739194696}],
    [{x:570.0052041994002,z:-338.90069795989575,heading:.10471975511965952},{x:570.0207597793029,z:-338.80248389372315,heading:.20943951023931903}],
  ];
  try{for(const [from,to]of segments){
    const original=evaluateCompanionSweep({kind:'elizabeth',from,to,...f.world,sweepBlocked:undefined});assert.equal(original.valid,true);
    const actual=evaluateCompanionSweep({kind:'elizabeth',from,to,...f.world});assert.deepEqual(actual,original);
  }}finally{f.dispose();}
});
