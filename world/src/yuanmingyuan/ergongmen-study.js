import * as THREE from 'three';
import {paintedBeam} from './hanjingtang-architecture.js';
import {jiuzhouRoofSectionPoint} from './jiuzhou-roof-geometry.js';
import {applyErgongmenSurface} from './ergongmen-surface.js';
import {ERGONGMEN_ID,ergongmenLayout as L,ergongmenColumnXs,ergongmenBayCenters} from './ergongmen-layout.js';
import {ErgongmenBuilder,part,createErgongmenPlatform,createErgongmenRoof,ergongmenSparrowBrace} from './ergongmen-geometry.js';

function column(b,parent,x,z,kind,index){
 const floor=L.platform.height,c=L.columns,radius=(kind==='inner'?c.innerDiameter:c.eavesDiameter)/2;
 const g=part(parent,'ergongmen-'+kind+'-column-'+index,{body:'wood-column-on-stone-base',x,z,woodHeight:c.woodHeight,woodDiameter:radius*2,woodBottomY:floor+c.baseHeight,woodTopY:floor+c.baseHeight+c.woodHeight,baseHeightInferred:true});
 b.box(g,b.m.stone,[x,floor+.030,z],[c.baseSquare,.060,c.baseSquare]);
 b.lathe(g,b.m.carving,[[0,.048],[.27,.048],[.27,.075],[.25,.095],[.25,c.baseHeight],[0,c.baseHeight]],[x,floor,z],64);
 const wood=part(g,g.name+'-wood',{body:'measurable-wood-shaft'});
 b.lathe(wood,b.m.red,[[0,0],[radius,0],[radius*.999,c.woodHeight*.20],[radius*.979,c.woodHeight*.60],[radius*.955,c.woodHeight],[0,c.woodHeight]],[x,floor+c.baseHeight,z],64);
 b.lathe(g,b.m.darkWood,[[0,0],[radius*1.015,0],[radius*1.015,.024],[0,.024]],[x,floor+c.baseHeight,z],64);
 return g;
}
function wall(b,parent,name,center,length,rotationY=0){
 const g=part(parent,name,{body:'brick-lower-red-plaster-upper-wall',lateState:true});g.position.set(center[0],L.platform.height,center[1]);g.rotation.y=rotationY;
 b.box(g,b.m.brick,[0,.51,0],[length,1.02,.28]);
 // The staggered facing bricks keep individual joints, instead of painting a flat wall.
 for(let row=0;row<12;row++)for(let x=-length/2-(row%2)*.123;x<length/2;x+=.246){
  const a=Math.max(-length/2,x),c=Math.min(length/2,x+.239);if(c-a<.008)continue;
  for(const face of [-1,1])b.box(g,b.m.brick,[(a+c)/2,.047+row*.079,face*.148],[c-a,.073,.022]);
 }
 const top=L.columns.baseHeight+L.columns.woodHeight-.21;
 b.box(g,b.m.wallRed,[0,(1.02+top)/2,0],[length,top-1.02,.286]);
 b.box(g,b.m.stone,[0,.992,0],[length+.024,.072,.326]);
 return g;
}
function doorPair(b,parent,bay){
 const xs=ergongmenColumnXs(),span=L.grid.bayWidths[bay]-.42,x=(xs[bay]+xs[bay+1])/2,floor=L.platform.height,h=L.doors.leafHeight,z=L.doors.z;
 const g=part(parent,'ergongmen-rear-inner-door-pair-'+bay,{body:'pair-of-open-red-plank-doors',lateState:true,bay,leaves:2,openingDegrees:L.doors.openingDegrees});
 const wood=part(g,g.name+'-frame');
 for(const side of [-1,1])b.box(wood,b.m.darkWood,[x+side*(span/2+.045),floor+h/2+.045,z],[.13,h+.09,.21]);
 b.box(wood,b.m.red,[x,floor+h+.125,z],[span+.24,.22,.23]);
 b.box(wood,b.m.darkWood,[x,floor+.040,z],[span+.10,.08,.30]);
 const transomTop=L.columns.baseHeight+L.columns.woodHeight-.31;
 b.box(wood,b.m.red,[x,floor+(h+.23+transomTop)/2,z],[span,transomTop-h-.23,.14]);
 for(const side of [-1,1]){
  const dir=-side,leaf=part(g,g.name+(side<0?'-left':'-right'),{body:'six-board-door-leaf',mergeIntoParent:true,openPoseAuthored:true});
  leaf.position.set(x+side*span/2,floor+.065,z);leaf.rotation.y=dir*THREE.MathUtils.degToRad(L.doors.openingDegrees);
  const width=span/2-.018;
  b.box(leaf,b.m.red,[dir*width/2,h/2,0],[width,h,.094]);
  for(let i=0;i<6;i++){
   const cx=dir*(i+.5)*width/6;
   b.woodBox(leaf,[cx,h/2,.056],[width/6-.006,h-.045,.026],b.m.red);
  }
  for(const y of [.20,.95,1.80,h-.20]){
   b.woodBox(leaf,[dir*width/2,y,-.081],[width-.09,.135,.090],b.m.darkWood);
   for(const dx of [.10,width-.10])b.add(leaf,b.prototype('door-peg',()=>new THREE.SphereGeometry(1,24,16)),b.m.gold,[dir*dx,y,-.134],[.019,.019,.014]);
  }
  for(const y of [.25,h*.50,h-.25]){
   b.rod(leaf,b.m.darkWood,[0,y-.080,0],[0,y+.08,0],.036,32);
   b.box(leaf,b.m.gold,[dir*.105,y,.068],[.18,.045,.018]);
  }
  // Ring handle is a real torus standing clear of the plate.
  const hx=dir*(width-.14),hy=h*.46;
  b.add(leaf,b.prototype('door-ring-plate',()=>new THREE.CylinderGeometry(1,1,1,48)),b.m.gold,[hx,hy,.088],[.060,.018,.060],[Math.PI/2,0,0]);
  b.add(leaf,b.prototype('door-handle-ring',()=>new THREE.TorusGeometry(.052,.009,12,48)),b.m.darkWood,[hx,hy-.028,.117]);
 }
 return g;
}
function stairs(b,parent,side,bay){
 const x=ergongmenBayCenters()[bay],w=L.grid.bayWidths[bay]-.74,p=L.platform,s=L.stairs,g=part(parent,'ergongmen-'+(side>0?'front':'rear')+'-stair-'+bay,{body:'four-solid-stone-treads',count:s.risers,typeSupportedCountInferred:true});
 const outer=p.depth/2+s.run,depth=s.run/s.risers;
 for(let i=0;i<s.risers;i++){
  const top=p.height*(i+1)/s.risers,z=side*(outer-depth*(i+.5));
  b.box(g,b.m.stone,[x,(top-.025)/2,z],[w,top+.025,depth+.009]);
  b.box(g,b.m.carving,[x,top-.018,side*(outer-depth*i-.027)],[w,.036,.060]);
  for(const lr of [-1,1])b.box(g,b.m.stone,[x+lr*(w/2+.12),(top+.07)/2,z],[.23,top+.07,depth+.007]);
 }
 return g;
}
function timberFrame(b,parent,roof){
 const g=part(parent,'ergongmen-eight-purlin-timber-frame',{body:'exposed-timber-without-dougong',mainPurlinCount:8,hipBearers:2,joineryAuthority:'members dimensioned and joined for this interpretation, not a measured carpentry survey'});
 const xs=ergongmenColumnXs(),top=L.platform.height+L.columns.baseHeight+L.columns.woodHeight,rz=L.roof.purlinZ;
 for(const x of xs)b.box(g,b.m.red,[x,top+.03,0],[.24,.28,L.grid.depth+.17]);
 const purlins=[];
 for(let i=0;i<rz.length;i++){
  const z=rz[i],high=Math.abs(z)<=roof.breakZ,half=high?roof.upperHalf-.16:L.grid.width/2+.08,y=jiuzhouRoofSectionPoint(roof.section,z).y-.32;
  const beam=part(g,'ergongmen-main-purlin-'+i,{body:'main-purlin',index:i,z,centerY:y,halfLength:half});
  b.rod(beam,b.m.red,[-half,y,z],[half,y,z],L.roof.purlinDiameter/2,48);purlins.push({x0:-half,x1:half,y,z});
  for(const x of xs.slice(1,-1)){
   const bottom=top+.17,end=y-L.roof.purlinDiameter/2;
   if(end>bottom)b.box(g,b.m.red,[x,(bottom+end)/2,z],[.15,end-bottom,.18]);
  }
 }
 for(const side of [-1,1]){
  const x=side*L.grid.width/2,pts=Array.from({length:49},(_,i)=>{const z=-3.85+7.70*i/48;return[x,roof.skinY(x,z)-.32,z];});
  const bearer=part(g,'ergongmen-side-hip-bearer-'+side,{body:'lower-local-hip-bearer',notAdditionalMainPurlin:true});b.tube(bearer,b.m.red,pts,.095,72,24);
  for(const z of rz){
   const end=roof.skinY(x,z)-.415,bottom=top+.17;
   if(end>bottom)b.box(g,b.m.red,[x,(bottom+end)/2,z],[.15,end-bottom,.18]);
  }
 }
 const rafters=part(g,'ergongmen-curved-rafters',{body:'continuous-bent-roof-rafters',skinOffset:.233});
 for(let x=-L.roof.width/2+.19;x<L.roof.width/2-.18;x+=.26){
  const pts=Array.from({length:65},(_,i)=>{const z=-L.roof.depth/2+.13+(L.roof.depth-.26)*i/64;return[x,roof.skinY(x,z)-.233,z];});
  b.tube(rafters,b.m.red,pts,L.roof.rafterRadius,80,16);
 }
 // Longitudinal eave fascia follows the very same side-lift curve as the skin.
 const fascia=part(g,'ergongmen-under-eave-fascia',{body:'curved-eave-fascia'});
 for(const side of [-1,1]){
  const z=side*(L.roof.depth/2-.12),pts=Array.from({length:65},(_,i)=>{const x=-L.roof.width/2+.12+(L.roof.width-.24)*i/64;return[x,roof.skinY(x,z)-.28,z];});
  b.tube(fascia,b.m.darkWood,pts,.075,96,20);
 }
 g.userData.purlins=purlins;return g;
}
function lotusTileEnds(b,parent,roof){
 const g=part(parent,'ergongmen-comparative-lotus-tile-ends',{body:'grey-clay-lotus-end-relief',authority:'lotus-end comparison in p35; authored petal carving'});
 const pitch=L.roof.tilePitch,n=Math.floor((L.roof.width-.22)/pitch);
 const disk=b.prototype('lotus-tile-end-disk',()=>new THREE.CylinderGeometry(.0608,.0608,.022,48));
 const petal=b.prototype('lotus-small-petal',()=>new THREE.SphereGeometry(1,16,12));
 for(const side of [-1,1])for(let i=0;i<=n;i++){
  const x=-L.roof.width/2+.11+(L.roof.width-.22)*i/n,z=side*(L.roof.depth/2-.005),y=roof.skinY(x,z)+.025;
  b.add(g,disk,b.m.greyTile,[x,y,z],undefined,[Math.PI/2,0,0]);
  for(let k=0;k<8;k++){const a=k*Math.PI/4; b.add(g,petal,b.m.greyTile,[x+Math.cos(a)*.025,y+Math.sin(a)*.025,z+side*.015],[.016,.007,.004],[0,0,a]);}
  b.add(g,petal,b.m.tileLight,[x,y,z+side*.016],[.010,.010,.004]);
 }
}
function resourceSummary(group){
 const geos=new Set(),mats=new Set(),textures=new Set();let meshes=0,triangles=0,instances=0;
 group.traverse(o=>{if(!o.isMesh)return;meshes++;geos.add(o.geometry);const count=o.isInstancedMesh?o.count:1;instances+=o.isInstancedMesh?o.count:0;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*count;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}
 });
 return{meshCount:meshes,triangleCount:triangles,instanceCount:instances,uniqueGeometries:geos.size,uniqueMaterials:mats.size,visibleMaterialTextures:textures.size};
}
export function createErgongmenStudy({signal}={}){
 signal?.throwIfAborted();
 const group=new THREE.Group();group.name=ERGONGMEN_ID;group.userData={asset:ERGONGMEN_ID,historicalState:L.historicalState,authoredReconstruction:true,source:'He Yan p35 with official p49 correction',sourceGate:'independent Ergongmen; no Dagongmen owner',geometryIsolation:false};
 let b=null,finish=null,disposed=false,abortHandler=null,owner;
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',abortHandler);
  const errors=[];for(const action of [()=>finish?.dispose(),()=>b?.dispose(),()=>{group.removeFromParent();group.clear();}])try{action();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError(errors,'Ergongmen owner cleanup failed');
 }
 try{
  b=new ErgongmenBuilder();createErgongmenPlatform(b,group);
  const fabric=part(group,'ergongmen-five-open-bays',{body:'five-open-front-bays-and-rear-inner-corridor',frontOpenBays:5,rearInnerDoorPairs:3});
  const xs=ergongmenColumnXs(),zs=[['front',L.grid.frontZ],['inner',L.grid.innerZ],['rear',L.grid.rearZ]],top=L.platform.height+L.columns.baseHeight+L.columns.woodHeight;
  for(const[kind,z]of zs){
   xs.forEach((x,i)=>column(b,fabric,x,z,kind,i));
   for(let bay=0;bay<5;bay++){
    const beam=part(fabric,'ergongmen-'+kind+'-fang-'+bay,{body:'painted-tie-beam',mergeIntoParent:true});
    paintedBeam(b,beam,[xs[bay],z],[xs[bay+1],z],top-.03);
    beam.userData.evidence='authored painted scroll/fangxin comparison; exact Ergongmen pattern not recovered';
    for(const[x,direction]of [[xs[bay],1],[xs[bay+1],-1]])ergongmenSparrowBrace(b,fabric,{x,z,y:top-.27,direction});
   }
  }
  for(const side of [-1,1])wall(b,fabric,'ergongmen-side-wall-'+side,[side*L.grid.width/2,0],L.grid.depth,-Math.PI/2);
  for(const bay of [0,4])wall(b,fabric,'ergongmen-end-bay-rear-wall-'+bay,[ergongmenBayCenters()[bay],L.grid.innerZ],L.grid.bayWidths[bay]-.28);
  L.doors.bays.forEach(bay=>doorPair(b,fabric,bay));
  for(const side of [-1,1])for(const bay of L.stairs.bays)stairs(b,group,side,bay);
  const roof=createErgongmenRoof(b,group);timberFrame(b,group,roof);lotusTileEnds(b,group,roof);
  b.flush();b.releasePrototypes();group.updateWorldMatrix(true,true);signal?.throwIfAborted();
  finish=applyErgongmenSurface({group});signal?.throwIfAborted();
  const bounds=new THREE.Box3().setFromObject(group,true),counts=resourceSummary(group);
  const diagnostics={...counts,id:ERGONGMEN_ID,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},columns:18,frontOpenBays:5,rearDoorPairs:3,mainPurlins:8,roofCoverDiameter:L.roof.coverOuterDiameter,dougong:0,sourceDimensions:L,materialFinish:finish.diagnostics,evidence:'CPU construction until independently rendered; not a native or historical survey claim'};
  owner={id:ERGONGMEN_ID,group,layout:L,diagnostics,dispose,get disposed(){return disposed;},
   update(){if(disposed)return;try{finish.assertCurrent();}catch(error){try{dispose();}catch(cleanup){error.cleanupError=cleanup;}throw error;}}
  };
  abortHandler=()=>dispose();signal?.addEventListener('abort',abortHandler,{once:true});signal?.throwIfAborted();
  return owner;
 }catch(error){try{dispose();}catch(cleanup){error.cleanupError=cleanup;}throw error;}
}
