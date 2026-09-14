import * as THREE from 'three';
import {grassTangentPlacement} from './grass-geometry.js';

// Half-widths follow the bare foreground shoulders and the east grove's apron.
// Actual roads, installed plant crowns and actor reservations clip each point.
export const grassDrifts=[
  {id:'foreground-west',seed:261103,density:6.8,points:[[-37,22,4.5],[-43,31,6.5],[-40,40,5.5],[-34,50,5],[-24,57,6],[-10,63,5.5]]},
  {id:'foreground-low',seed:391117,density:7.2,points:[[-26,59,5],[-14,69,7],[-2,77,6],[11,81,4]]},
  {id:'east-grove',seed:571133,density:7.4,points:[[45,14,4],[55,15,5],[67,16,4.5],[79,14,4]]},
];
const unit=THREE.MathUtils.clamp,TAU=Math.PI*2;
const random=seed=>{let state=seed;return ()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};};

function compileDrift(drift){
  const curve=new THREE.CatmullRomCurve3(drift.points.map(([x,z,width])=>new THREE.Vector3(x,width,z))),points=curve.getPoints(Math.max(8,Math.ceil(curve.getLength()*2)));
  const bounds={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
  for(const p of points){bounds.minX=Math.min(bounds.minX,p.x-p.y);bounds.minZ=Math.min(bounds.minZ,p.z-p.y);bounds.maxX=Math.max(bounds.maxX,p.x+p.y);bounds.maxZ=Math.max(bounds.maxZ,p.z+p.y);}
  return {...drift,points,bounds,area:(bounds.maxX-bounds.minX)*(bounds.maxZ-bounds.minZ)};
}
function driftWeight(x,z,drift){
  const b=drift.bounds;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return 0;
  let radius=Infinity;
  const edge=.83+.12*Math.sin(x*.31+z*.17+drift.seed)+.05*Math.sin(z*.63-x*.11);
  for(let i=1;i<drift.points.length;i++){
    const a=drift.points[i-1],b=drift.points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    const t=length?unit(((x-a.x)*dx+(z-a.z)*dz)/length,0,1):0,width=(a.y+(b.y-a.y)*t)*edge;
    radius=Math.min(radius,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)/width);
  }
  return 1-THREE.MathUtils.smoothstep(radius,.28,1);
}
function spatialIndex(size){
  const cells=new Map(),key=(x,z)=>`${x},${z}`;
  return {
    add(p){const id=key(Math.floor(p.x/size),Math.floor(p.z/size)),list=cells.get(id)||[];list.push(p);cells.set(id,list);},
    nearest(x,z,radius){
      let nearest=null,distance=radius*radius;
      for(let cx=Math.floor((x-radius)/size);cx<=Math.floor((x+radius)/size);cx++)for(let cz=Math.floor((z-radius)/size);cz<=Math.floor((z+radius)/size);cz++)for(const p of cells.get(key(cx,cz))||[]){
        const d=(x-p.x)**2+(z-p.z)**2;if(d<distance){nearest=p;distance=d;}
      }
      return nearest;
    },
  };
}

/** Check the actual full-geometry roots after the final instance transform. */
export function grassRootSupport(p,geometry,heightAt,{allowed=()=>true,reserved=()=>false,lawnAt=()=>0}={}){
  const rotation=[p.rx??0,p.r??0,p.rz??0],scale=[p.sx??p.s??1,(p.sy??p.s??1)*(1-lawnAt(p.x,p.z)*.70),p.sz??p.s??1];
  if(![p.x,p.y,p.z,...rotation,...scale].every(Number.isFinite)||scale.some(s=>s<=0))return {supported:false,reason:'nonfinite'};
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)),point=new THREE.Vector3();
  // InstancedMesh stores these elements as Float32; test the drawn root plane.
  matrix.fromArray(new Float32Array(matrix.elements));
  let maxGap=-Infinity;
  for(const index of geometry.userData.grass.rootIndices){
    point.fromBufferAttribute(geometry.attributes.position,index).applyMatrix4(matrix);
    if(reserved(point.x,point.z)||!allowed(point.x,point.z))return {supported:false,reason:'exclusion'};
    const height=heightAt(point.x,point.z),gap=point.y-height;
    if(!Number.isFinite(height)||height<.6)return {supported:false,reason:'terrain'};
    if(!Number.isFinite(gap)||gap>1e-6||gap<-.06)return {supported:false,reason:'gap'};
    maxGap=Math.max(maxGap,gap);
  }
  return {supported:Number.isFinite(maxGap),maxGap};
}

/** Append locally seeded low growth after the unchanged legacy grass stream. */
export function createGrassDistribution(originals,geometries,heightAt,{drifts=grassDrifts,allowed=()=>true,reserved=()=>false,lawnAt=()=>0,openingAt=()=>0}={}){
  const compiled=drifts.map(compileDrift),groups=geometries.map(()=>[]),anchors=spatialIndex(4),occupied=spatialIndex(.32);
  const stats={original:originals.length,added:0,total:originals.length,loweredOriginal:0,candidates:0,maxRootGap:null,
    addedTiers:{low:0,mid:0},rejected:{outside:0,opening:0,reserved:0,excluded:0,terrain:0,unanchored:0,spacing:0,support:0},
    rootRejections:{exclusion:0,terrain:0,gap:0,nonfinite:0},zones:compiled.map(d=>({id:d.id,density:d.density,boundingArea:d.area,candidates:0,added:0,loweredOriginal:0}))};
  function patchAt(x,z){
    let index=-1,weight=0;compiled.forEach((drift,i)=>{const w=driftWeight(x,z,drift);if(w>weight){weight=w;index=i;}});return {index,weight};
  }
  originals.forEach((p,i)=>{
    anchors.add(p);occupied.add(p);let next=p;
    if(!reserved(p.x,p.z)){
      const {index,weight}=patchAt(p.x,p.z);
      if(index>=0&&openingAt(p.x,p.z)<.7){
        const rand=random(compiled[index].seed+Math.imul(i+1,104729));
        if(rand()<weight*.95){const low=rand()<.80;next={...p,sy:p.s*(low?.40+rand()*.20:.65+rand()*.20)};stats.loweredOriginal++;stats.zones[index].loweredOriginal++;}
      }
    }
    groups[i%groups.length].push(grassTangentPlacement(next,heightAt));
  });
  const originalCounts=groups.map(group=>group.length);
  if(!originals.length)return {groups,originalCounts,stats};
  for(const [index,drift]of compiled.entries()){
    const rand=random(drift.seed),b=drift.bounds,count=Math.ceil(drift.area*drift.density),zone=stats.zones[index];
    for(let i=0;i<count;i++){
      stats.candidates++;zone.candidates++;
      const x=b.minX+rand()*(b.maxX-b.minX),z=b.minZ+rand()*(b.maxZ-b.minZ),patch=patchAt(x,z);
      if(patch.index!==index||rand()>patch.weight){stats.rejected.outside++;continue;}
      if(reserved(x,z)){stats.rejected.reserved++;continue;}
      if(!allowed(x,z)){stats.rejected.excluded++;continue;}
      const height=heightAt(x,z);
      if(!Number.isFinite(height)||height<.6){stats.rejected.terrain++;continue;}
      const opening=openingAt(x,z);
      if(opening>=.7||rand()<opening*.85){stats.rejected.opening++;continue;}
      const anchor=anchors.nearest(x,z,3.4);
      if(!anchor){stats.rejected.unanchored++;continue;}
      if(occupied.nearest(x,z,.18+(1-patch.weight)*.12)){stats.rejected.spacing++;continue;}
      const variant=Math.floor(rand()*groups.length),low=rand()<.85,p={x,y:height-.025,z,s:anchor.s,sy:anchor.s*(low?.40+rand()*.20:.65+rand()*.20),r:rand()*TAU};
      let planted;
      try{planted=grassTangentPlacement(p,heightAt);}catch(error){if(!(error instanceof RangeError))throw error;stats.rejected.support++;stats.rootRejections.nonfinite++;continue;}
      const support=grassRootSupport(planted,geometries[variant],heightAt,{allowed,reserved,lawnAt});
      if(!support.supported){stats.rejected.support++;stats.rootRejections[support.reason]++;continue;}
      groups[variant].push(planted);occupied.add(p);stats.added++;stats.total++;zone.added++;stats.addedTiers[low?'low':'mid']++;
      stats.maxRootGap=Math.max(stats.maxRootGap??-Infinity,support.maxGap);
    }
  }
  return {groups,originalCounts,stats};
}
