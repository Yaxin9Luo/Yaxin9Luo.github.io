import * as THREE from 'three';
import {JiuzhouBuilder,buildSingleJuanpengRoof,jiuzhouColumn,jiuzhouPlatform} from './jiuzhou-architecture.js';
import {paintedBeam} from './hanjingtang-architecture.js';
import {jiuzhouRoofSectionPoint} from './jiuzhou-roof-geometry.js';
import {namedGroup} from './study-geometry.js';
import {dagongmenLayout as L,dagongmenColumnXs,DAGONGMEN_ID} from './dagongmen-layout.js';
import {makeDagongmenMaterials,prepareDagongmenFinishes} from './dagongmen-materials.js';

const INFERRED='authored-proportions-not-a-recovered-Dagongmen-measurement';
class DagongmenBuilder extends JiuzhouBuilder {
  makeMaterials(){return makeDagongmenMaterials(this);}
  // Instance resources are borrowers of the owned tile geometry and material.
  // Release their buffers before the shared source resources, also on failure.
  dispose(){
    if(this.disposed)return;
    const errors=[];
    for(const mesh of this.instanceMeshes??[])try{mesh.dispose();}catch(e){errors.push(e);}
    this.instanceMeshes?.clear();
    const sets=[this.geometries,this.materials,this.textures];
    try{this.releasePrototypes();}catch(e){errors.push(e);}
    for(const {parts}of this.pending.values())for(const {geometry}of parts)try{geometry.dispose();}catch(e){errors.push(e);}
    this.pending.clear();this.tileInstances?.clear();this.tileShapes?.clear();
    this.disposed=true;
    for(const set of sets){for(const resource of set)try{resource.dispose();}catch(e){errors.push(e);}set.clear();}
    if(errors.length)throw new AggregateError(errors,'Dagongmen resource cleanup failed');
  }
}
const group=(parent,name,data={})=>namedGroup(parent,name,{evidence:INFERRED,...data});
function brickRectangle(b,parent,{x0,x1,z0,z1,y=.026,pitchX=.42,pitchZ=.82,white=false}){
  const cols=Math.ceil((x1-x0)/pitchX),rows=Math.ceil((z1-z0)/pitchZ),dx=(x1-x0)/cols,dz=(z1-z0)/rows;
  b.box(parent,b.m.foundation,[(x0+x1)/2,y-.049,(z0+z1)/2],[x1-x0,.07,z1-z0]);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const mat=white?b.m.stone:((i*31+j*17)%29<5?b.m.pavingShade:b.m.paving);
    b.box(parent,mat,[x0+(i+.5)*dx,y-.012,z0+(j+.5)*dz],[dx-.006,.03,dz-.006]);
  }
}
function ramp(b,parent,name,x,width,sign){
  const g=group(parent,name,{body:'solid-grooved-stone-ramp',typeEvidence:'1874 record names Dagongmen jiangcha; slope and dimensions inferred'});
  const inner=L.gate.depth/2+.07,outer=inner+2.7,n=30;
  for(let j=0;j<n;j++){
    const t=(j+.5)/n,z=sign*(outer-(outer-inner)*t),y=.018+(L.gate.floor-.018)*t;
    b.box(g,j%2?b.m.stone:b.m.carving,[x,y/2-.02,z],[width,y+.04,(outer-inner)/n+.004]);
  }
  for(const side of [-1,1])b.box(g,b.m.stone,[x+side*(width/2+.10),L.gate.floor/2,sign*(inner+outer)/2],[.20,L.gate.floor,outer-inner]);
  return g;
}
function doorLeaf(b,parent,name,{hingeX,z,width,height,floor=.48,side=1,angle=104}){
  const leaf=group(parent,name,{body:'solid-board-door-open-for-passage',mergeIntoParent:true,hingeAngleDegrees:side*angle,originalOpeningAngleRecovered:false});
  leaf.position.set(hingeX,floor,z);leaf.rotation.y=side*THREE.MathUtils.degToRad(angle);
  const panels=6,step=width/panels;
  for(let i=0;i<panels;i++)b.box(leaf,i%3?b.m.door:b.m.red,[side*(i+.5)*step,height/2,0],[step-.0025,height,.11]);
  for(const y of [.21,height*.47,height-.21]){
    b.box(leaf,b.m.darkWood,[side*width/2,y,-.105],[width-.035,.14,.10]);
    b.box(leaf,b.m.iron,[side*width/2,y,.061],[width-.10,.054,.014]);
    for(let i=0;i<6;i++)b.add(leaf,b.prototype('door-rivet',()=>new THREE.SphereGeometry(.027,12,8)),b.m.iron,[side*(.12+(width-.24)*i/5),y,.078]);
  }
  b.rod(leaf,b.m.iron,[0,-.03,0],[0,height+.11,0],.066,20);
  for(const y of [.25,height-.25])b.add(leaf,b.prototype('door-hinge-socket',()=>new THREE.CylinderGeometry(.10,.10,.14,24)),b.m.iron,[0,y,0]);
  for(const face of [-1,1]){
    const hx=side*(width-.30),hy=height*.50;
    b.box(leaf,b.m.iron,[hx,hy,face*.072],[.19,.25,.027]);
    b.add(leaf,b.prototype('functional-door-ring',()=>new THREE.TorusGeometry(.093,.018,12,28)),b.m.iron,[hx,hy-.075,face*.115]);
  }
  return leaf;
}
function opening(b,parent,name,cx,width,z,floor,height,{sideDoor=false}={}){
  const g=group(parent,name,{body:'open-paired-board-door',clearWidth:width-.20,clearHeight:height-.16});
  for(const side of [-1,1]){
    b.box(g,b.m.darkWood,[cx+side*(width/2-.035),floor+height/2,z],[.12,height+.08,.25]);
    doorLeaf(b,g,name+'-leaf-'+side,{hingeX:cx+side*(width/2-.13),z,width:width/2-.14,height:height-.16,floor:floor+.12,side:-side,angle:sideDoor?102:104});
  }
  b.box(g,b.m.darkWood,[cx,floor+height,z],[width+.16,.20,.31]);
  b.box(g,b.m.darkWood,[cx,floor+.058,z],[width+.04,.116,.34]);
  return g;
}
function mainGate(b,parent){
  const g=group(parent,'dagongmen-main-gate',{body:'independent-five-bay-south-facing-gate',bayWidths:[...L.gate.bayWidths],originalMetricAccuracy:'not-established'});
  const {floor,columnHeight,columnRadius}=L.gate,xs=dagongmenColumnXs(),half=L.gate.depth/2;
  jiuzhouPlatform(b,g,'dagongmen-main-platform',21.55,8.9,floor,{bottom:-.13,tilePitch:.65});
  for(const sign of [-1,1])ramp(b,g,'dagongmen-'+(sign>0?'front':'rear')+'-jiangcha',0,12.8,sign);
  for(const z of [-half,half])for(let i=0;i<xs.length;i++)jiuzhouColumn(b,g,'dagongmen-eave-column-'+z+'-'+i,xs[i],z,floor,columnHeight,{radius:columnRadius,base:[.79,.80,.35]});
  // Plain purlin frame and modest painted beams; no imported hall-specific
  // dougong stack, dragon emblem or claims of an exact historic caihua pattern.
  for(const z of [-half,half]){
    for(let i=0;i<5;i++)paintedBeam(b,g,[xs[i],z],[xs[i+1],z],floor+columnHeight-.11,.43);
    b.rod(g,b.m.red,[xs[0]-.45,4.94,z],[xs.at(-1)+.45,4.94,z],.115,24);
  }
  const doorZ=2.28,doorHeight=3.31;
  for(let i=1;i<=3;i++)opening(b,g,'dagongmen-middle-passage-'+i,(xs[i]+xs[i+1])/2,xs[i+1]-xs[i]-.43,doorZ,floor,doorHeight);
  for(const side of [-1,1]){
    const cx=side*8.5;
    b.box(g,b.m.brick,[side*10.26,2.56,0],[.36,4.12,8.15]);
    // Front/rear end-bay enclosing boards are independent of the three passages.
    for(const z of [doorZ,-half]){
      const w=3.8-.43;
      b.box(g,b.m.darkWood,[cx,2.16,z],[w,3.24,.19]);
      for(let j=0;j<10;j++)b.box(g,j%4?b.m.door:b.m.red,[cx+(j-4.5)*w/10,2.16,z+.108],[w/10-.006,3.16,.034]);
      for(const y of [.70,1.63,3.67])b.box(g,b.m.darkWood,[cx,y,z+.145],[w,.12,.085]);
    }
    // Internal end-room walls preserve the open centre aisle.
    b.box(g,b.m.darkWood,[side*6.64,2.27,(-half+doorZ)/2],[.19,3.55,doorZ+half]);
  }
  const roof=buildSingleJuanpengRoof(b,g,'dagongmen-main-roof',{width:L.gate.roofWidth,depth:L.gate.roofDepth,eaveY:L.gate.eaveY,rise:L.gate.rise});
  roof.group.userData.evidence='rolled-grey-hip-gable-comparison; precise-Dagongmen-profile-inferred';
  const section=roof.section,upperSpan=L.gate.roofWidth-L.gate.roofDepth*.38;
  const halfDepth=L.gate.roofDepth/2,breakZ=halfDepth*.55,upperHalf=upperSpan/2,fullHalf=L.gate.roofWidth/2;
  // These are the actual break/corner controls of buildSingleJuanpengRoof.
  // Outside the upper gable, sample the side hip instead of lifting end posts
  // to the central section. The original cover and masonry gables are retained.
  const skinY=(x,z)=>{
    const ax=Math.abs(x),az=Math.abs(z);
    if(ax<=upperHalf&&az<=breakZ)return jiuzhouRoofSectionPoint(section,z).y;
    const tx=(fullHalf-ax)/(fullHalf-upperHalf),tz=(halfDepth-az)/(halfDepth-breakZ);
    const t=Math.min(tx,tz),hz=halfDepth+(breakZ-halfDepth)*t,hx=fullHalf+(upperHalf-fullHalf)*t;
    const u=tx<tz?az/hz:ax/hx;
    return jiuzhouRoofSectionPoint(section,hz).y+.20*(1-t)**2*u**6;
  };
  const upperEnd=upperHalf-.08,purlinY=z=>jiuzhouRoofSectionPoint(section,z).y-.35;
  // The upper ends bear within the existing 180 mm gable, stopping 50 mm
  // before its outer face; lower eave purlins keep their original full span.
  for(const z of [-4.1,-2.55,-.68,.68,2.55,4.1]){
    const end=Math.abs(z)<breakZ?upperEnd:L.gate.width/2,y=purlinY(z);
    b.rod(g,b.m.red,[-end,y,z],[end,y,z],.15,24);
  }
  for(let i=0;i<=52;i++){
    const x=(i/52-.5)*(upperSpan-.45),points=[];
    for(let j=0;j<=32;j++){const v=jiuzhouRoofSectionPoint(section,-5.26+10.52*j/32,x);v.y-=.18;points.push(v);}
    b.tube(g,b.m.darkWood,points,.045,40,10);
  }
  for(const x of xs){
    b.box(g,b.m.red,[x,4.66,0],[.20,.31,8.35]);
    for(const z of [-2.55,-.68,.68,2.55]){
      const bearingY=Math.abs(x)>upperHalf?skinY(x,0)-.35:purlinY(z);
      // A small bearing overlap connects each short post to its real purlin.
      const y=bearingY-.135;
      if(y>4.72)b.rod(g,b.m.red,[x,4.72,z],[x,y,z],.10,20);
    }
  }
  // Side-hip bearers connect all four shortened outer posts under the lower
  // roof, retaining a continuous support path to the original transverse ties.
  for(const x of [xs[0],xs.at(-1)]){
    const y=skinY(x,0)-.35;
    b.rod(g,b.m.red,[x,y,-2.72],[x,y,2.72],.15,24);
  }
  g.userData.roofFrame={revision:'gable-bounded-purlins-and-local-hip-bearings-r2',
    upperPurlinHalfSpan:upperEnd,upperRoofHalfSpan:upperHalf,
    gableOuterFace:upperHalf-.03,sideSupportXs:[xs[0],xs.at(-1)],
    dimensions:'authored structural fit, not recovered historical joinery'};
  const plaque=group(g,'dagongmen-front-plaque',{body:'modern-transcription-of-documented-plaque',text:'圓明園',historicalCalligraphy:false,mergeIntoParent:true});
  b.box(plaque,b.m.darkWood,[0,4.26,4.30],[3.68,.99,.16]);
  b.box(plaque,b.m.gold,[0,4.26,4.391],[3.54,.91,.030]);
  b.add(plaque,new THREE.PlaneGeometry(3.42,.855),b.m.plaque,[0,4.26,4.411],undefined,undefined,true);
  for(const x of [-1.84,1.84])b.box(plaque,b.m.darkWood,[x,4.26,4.42],[.073,1.01,.09]);
  return g;
}
function wallSpan(b,parent,name,start,end,height=2.88){
  const w=end-start,cx=(start+end)/2,g=group(parent,name,{body:'solid-coped-wall',mergeIntoParent:true});
  b.box(g,b.m.foundation,[cx,.20,0],[w,.44,.66]);
  b.box(g,b.m.brick,[cx,.63,0],[w,.44,.58]);
  b.box(g,b.m.plaster,[cx,(.83+height)/2,0],[w,height-.83,.54]);
  for(const face of [-1,1])for(let k=0;k<3;k++)for(let j=0;j<Math.ceil(w/.55);j++){
    const dx=w/Math.ceil(w/.55);b.box(g,j%5?b.m.brick:b.m.foundation,[start+(j+.5)*dx,.39+k*.15,face*.297],[dx-.008,.143,.03]);
  }
  const roof=buildSingleJuanpengRoof(b,parent,name+'-coping',{width:w+.25,depth:1.07,eaveY:height+.055,rise:.24,xieshan:false});
  roof.group.position.x=cx;
  return g;
}
function sideWing(b,parent,side){
  const spec=L.wings,dx=side*(spec.endX-spec.joinX),dz=spec.endZ-spec.startZ,length=Math.hypot(dx,dz),c=length*spec.doorFraction;
  const g=group(parent,'dagongmen-'+(side<0?'west':'east')+'-splayed-wall',{body:'splayed-screen-wall-with-hooded-convenience-door',wallThickness:spec.wallThickness});
  g.position.set(side*spec.joinX,0,spec.startZ);g.rotation.y=-Math.atan2(dz,dx);
  wallSpan(b,g,g.name+'-inner',0,c-spec.doorWidth/2);
  wallSpan(b,g,g.name+'-outer',c+spec.doorWidth/2,length);
  // Real open hole through the wall; the door lintel is wholly above head height.
  b.box(g,b.m.brick,[c,2.86,0],[spec.doorWidth+.12,.28,.58]);
  for(const sign of [-1,1]){
    b.box(g,b.m.brick,[c+sign*(spec.doorWidth/2+.17),1.45,0],[.34,2.9,.72]);
    b.box(g,b.m.stone,[c+sign*(spec.doorWidth/2+.17),.12,0],[.47,.25,.85]);
  }
  opening(b,g,g.name+'-door',c,spec.doorWidth,0,.03,2.50,{sideDoor:true});
  const hood=buildSingleJuanpengRoof(b,g,g.name+'-door-hood',{width:3.65,depth:2.12,eaveY:3.12,rise:.58});
  hood.group.position.x=c;
  for(const face of [-1,1])paintedBeam(b,g,[c-1.55,face*.57],[c+1.55,face*.57],2.92,.24);
  return g;
}
function imperialRoad(b,parent){
  const g=group(parent,'dagongmen-front-imperial-road',{body:'white-axis-with-grey-brick-cross-arms',planEvidence:'DPM p24 inverted-T road; p37 white axis and grey flank',crossArmLengthsInferred:true,crossArmStationingInferred:true,transverseArms:1});
  const {width,frontZ}=L.road;
  brickRectangle(b,g,{x0:-width/2,x1:width/2,z0:7.1,z1:frontZ,white:true,pitchX:1.6,pitchZ:1.6});
  // Keep the 205 m relation; road-side apron is deliberately bounded rather
  // than inventing government ranges or a 9.2 ha completed court.
  for(const z of [199])for(const side of [-1,1])
    brickRectangle(b,g,{x0:side<0?-22:width/2,x1:side<0?-width/2:22,z0:z-1.6,z1:z+1.6});
  brickRectangle(b,g,{x0:-6.5,x1:6.5,z0:-8.5,z1:-4.3});
  return g;
}
function greatScreen(b,parent){
  const s=L.screen,g=group(parent,'dagongmen-great-screen-wall',{body:'great-screen-on-moulded-stone-base',screenLengthEvidence:'13 zhang annotation -> 41.6 m in DPM p36',upperFormEvidence:'comparative reconstruction; corrected figure18 takes precedence'});
  g.position.z=s.centerZ;
  const profiles=[[.10,.20,2.16],[.265,.13,2.00],[.395,.13,1.82],[.515,.11,1.74],[.645,.15,1.98]];
  for(const [y,h,d]of profiles)b.box(g,b.m.carving,[0,y,0],[s.length+.18,h,d]);
  b.box(g,b.m.wallRed,[0,(s.baseHeight+s.bodyTop)/2,0],[s.length,s.bodyTop-s.baseHeight,s.thickness]);
  for(const face of [-1,1]){
    b.box(g,b.m.wallRed,[0,.86,face*(s.thickness/2+.027)],[s.length-.40,.12,.055]);
    b.box(g,b.m.wallRed,[0,s.bodyTop-.12,face*(s.thickness/2+.027)],[s.length-.40,.12,.055]);
    for(let i=0;i<26;i++){
      const dx=s.length/26,x=-s.length/2+(i+.5)*dx;
      b.box(g,i%7?b.m.stone:b.m.carving,[x,.405,face*1.0],[dx-.012,.23,.048]);
    }
  }
  buildSingleJuanpengRoof(b,g,'dagongmen-great-screen-roof',{width:s.roofWidth,depth:s.roofDepth,eaveY:s.bodyTop+.13,rise:s.rise});
  return g;
}
export function createDagongmenStudy({signal,component='entrance'}={}){
  signal?.throwIfAborted();
  if(!['entrance','gate','side-door','screen'].includes(component))throw new Error('Unknown Dagongmen component');
  const root=new THREE.Group();root.name=DAGONGMEN_ID;
  const b=new DagongmenBuilder('dagongmen');
  let disposed=false,abort;
  const diagnostics={id:DAGONGMEN_ID,component,quality:'full-authored-tile-and-timber-geometry',scope:'Dagongmen gate, walls, road and distant screen; not the whole front court',
    evidence:[L.evidence],uncertainty:['Gate dimensions and roof curvature are proportional inference, not second-gate measurements','Modern plaque transcription; no claim of original calligraphy','No bronze lions, government office ranges, Er-gongmen, river or Zhengda Guangming in this first package'],
    material:{shaderPreparations:0,preparedMaterials:[],clayBindings:0},resources:{disposed:false},counts:null};
  const dispose=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);
    root.removeFromParent();try{b.dispose();}finally{root.clear();diagnostics.resources.disposed=true;}
  };
  try{
    if(component==='entrance'||component==='gate'){
      const gates=group(root,'dagongmen-gate-and-wings',{body:'gate-precinct'});mainGate(b,gates);
      for(const side of [-1,1])sideWing(b,gates,side);
    }else if(component==='side-door')sideWing(b,root,1);
    if(component==='entrance')imperialRoad(b,root);
    if(component==='entrance'||component==='screen')greatScreen(b,root);
    b.flush();b.releasePrototypes();prepareDagongmenFinishes(b,root,diagnostics.material);
    root.userData={id:DAGONGMEN_ID,sourceAsset:true,researchCandidate:true,date:L.date,evidence:L.evidence,component};
    root.updateMatrixWorld(true);
    let meshes=0,triangles=0,instances=0;root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh)instances+=o.count;});
    const box=new THREE.Box3().setFromObject(root);
    diagnostics.counts={meshes,triangles,renderInstances:instances,uniqueGeometries:b.geometries.size,ownedMaterials:b.materials.size,ownedTextures:b.textures.size};
    diagnostics.bounds={min:box.min.toArray(),max:box.max.toArray()};
    abort=()=>{try{dispose();}catch(e){diagnostics.resources.abortCleanupError=String(e);}};
    signal?.addEventListener('abort',abort,{once:true});signal?.throwIfAborted();
    return {group:root,diagnostics,layout:L,dispose,update(){if(disposed)return;signal?.throwIfAborted();}};
  }catch(error){try{dispose();}catch(cleanup){diagnostics.resources.cleanupError=String(cleanup);}throw error;}
}
