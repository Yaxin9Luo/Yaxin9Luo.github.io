import * as THREE from 'three';
import {JiuzhouBuilder,jiuzhouPolygonPlatform,jiuzhouMasonry} from './jiuzhou-architecture.js';
import {dougong} from './hanjingtang-architecture.js';
import {jiuzhouLattice} from './jiuzhou-joinery.js';
import {V,namedGroup} from './study-geometry.js';
import {makeWanfangAnheMaterials,prepareWanfangAnheFinishes} from './wanfang-anhe-materials.js';
import {WANFANG_ANHE_ID,wanfangAnheLayout as L,wanfangBays,wanfangOutline,roomBoundaryEdges,wanfangApproaches,wanfangDock,wanfangWaterCourts} from './wanfang-anhe-layout.js';
import {buildWanfangAnheRoof,wanfangRoofAt,wanfangRoofProfile} from './wanfang-anhe-roof.js';
import {createWanfangStudyWater} from './wanfang-anhe-water.js';

class WanfangBuilder extends JiuzhouBuilder{
  makeMaterials(){return makeWanfangAnheMaterials(this);}
  dispose(){
    if(this.disposed)return;this.disposed=true;const errors=[];
    for(const mesh of this.instanceMeshes??[])try{mesh.dispose();}catch(e){errors.push(e);}
    this.instanceMeshes?.clear();
    const geometry=new Set([...this.geometries,...this.prototypes.values(),...this.tileShapes?.values()??[]]);
    for(const {parts}of this.pending.values())for(const part of parts)geometry.add(part.geometry);
    this.pending.clear();this.prototypes.clear();this.tileShapes?.clear();this.tileInstances?.clear();this.tileGeometryBuckets?.clear();
    for(const set of [geometry,this.materials,this.textures])for(const item of set)try{item.dispose();}catch(e){errors.push(e);}
    this.geometries.clear();this.materials.clear();this.textures.clear();
    if(errors.length)throw new AggregateError(errors,'Wanfang owned resource cleanup failed');
  }
}
const group=(p,name,data={})=>namedGroup(p,name,{evidence:'working-reconstruction-not-a-survey',...data});
function spanGroup(parent,name,a,c,y=0){
  const g=group(parent,name,{mergeIntoParent:true});g.position.set((a[0]+c[0])/2,y,(a[1]+c[1])/2);g.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);return g;
}
function layeredBeam(b,parent,name,a,c,y,height=.30){
  const len=Math.hypot(c[0]-a[0],c[1]-a[1]),g=spanGroup(parent,name,a,c,y);
  b.woodBox(g,[0,0,0],[len,height,.26],b.m.greenWood);
  for(const face of [-1,1]){
    b.box(g,b.m.blue,[0,0,face*.137],[Math.max(.03,len-.07),height*.60,.028]);
    for(const dy of [-1,1])b.box(g,b.m.pale,[0,dy*height*.35,face*.157],[Math.max(.03,len-.10),.016,.018]);
  }
  b.woodBox(g,[0,height*.62,0],[len+.035,.065,.31],b.m.darkWood);
  return g;
}
function squarePost(b,parent,name,x,z,{outside=false,rotation=0}={}){
  const g=group(parent,name,{body:'square-oiled-wood-column-on-dressed-stone-shoe',mergeIntoParent:true});
  const w=L.columnWidth;
  b.box(g,b.m.stone,[x,L.floorY+.055,z],[w+.20,.11,w+.20]);
  b.box(g,b.m.carving,[x,L.floorY+.14,z],[w+.11,.10,w+.11]);
  b.woodBox(g,[x,L.floorY+(L.columnHeight+.18)/2,z],[w,L.columnHeight-.18,w],b.m.greenWood);
  for(const y of [.20,L.columnHeight-.12])b.box(g,b.m.darkWood,[x,L.floorY+y,z],[w+.017,.037,w+.017]);
  if(outside)dougong(b,g,[x,L.floorY+L.columnHeight-.015,z],.43,rotation);
  return g;
}
// Concave clipping can return a repeated, collinear ring. It has no paving
// area; extruding that ring would put thin vertical faces over a water court.
function wanfangPavingBuilder(b){
  return {m:b.m,rejectedZeroAreaCells:0,polygon(parent,points,bottom,top,material){
    const [ox,oz]=points[0]??[0,0];
    const twiceArea=points.reduce((sum,[x,z],i)=>{
      const [nx,nz]=points[(i+1)%points.length];return sum+(x-ox)*(nz-oz)-(z-oz)*(nx-ox);
    },0);
    if(Math.abs(twiceArea)<=1e-12){this.rejectedZeroAreaCells++;return;}
    b.polygon(parent,points,bottom,top,material);
  }};
}
function buildPlatform(b,parent){
  const outline=wanfangOutline(L.veranda+L.platformLip),g=group(parent,'wanfang-anhe-continuous-stone-platform',{body:'33-bay-nonrectangular-platform',navigation:true,topY:L.floorY,outline});
  const paving=wanfangPavingBuilder(b);
  jiuzhouPolygonPlatform(paving,g,'wanfang-anhe-veranda-paving',outline,L.floorY,{bottom:L.foundationBottom,pitch:.56});
  g.userData.rejectedZeroAreaPavingCells=paving.rejectedZeroAreaCells;
  for(let i=0;i<outline.length;i++){
    const a=outline[i],c=outline[(i+1)%outline.length];
    for(let row=0;row<6;row++)jiuzhouMasonry(b,g,a,c,L.floorY-.17-row*.30,.295,row<3?b.m.stone:b.m.foundation);
    // A damp course belongs to the stone base, not to a second opaque water plane.
    layeredStoneEdge(b,g,a,c,.035,.12,b.m.waterline);
  }
  return g;
}
function layeredStoneEdge(b,parent,a,c,y,h,material){
  const length=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=-Math.atan2(c[1]-a[1],c[0]-a[0]);
  b.box(parent,material,[(a[0]+c[0])/2,y,(a[1]+c[1])/2],[length,h,.055],[0,angle,0]);
}
// Straight purlins retain their section and height. At a folded roof junction
// stop the member before its complete circular envelope reaches the roof skin.
// A 0.10 m end setback leaves the cut inside the roof's 0.20 m faceted
// junction cells; the full solid is checked against that actual underside.
function purlinRange(point,cross,y){
  const half=L.bay/2-.025,radius=.10,clearance=.035;
  const fits=along=>{
    for(let i=0;i<=48;i++){
      const across=radius*(i/24-1),upper=y+Math.sqrt(Math.max(0,radius*radius-across*across));
      const [x,z]=point(along,cross+across),roof=wanfangRoofAt(x,z);
      if(!roof||roof.y-L.roofSkin-upper<clearance)return false;
    }
    return true;
  };
  if(!fits(0))throw new Error('Wanfang purlin centre does not fit below its roof.');
  const end=direction=>{
    let inside=0;const steps=Math.ceil(half/.10);
    for(let i=1;i<=steps;i++){
      const outside=direction*half*i/steps;
      if(fits(outside)){inside=outside;continue;}
      let a=inside,c=outside;
      for(let j=0;j<24;j++){const mid=(a+c)/2;if(fits(mid))a=mid;else c=mid;}
      return direction*Math.max(0,Math.abs(a)-.10);
    }
    return direction*half;
  };
  const range=[end(-1),end(1)];
  if(range[1]-range[0]<radius*4)throw new Error('Wanfang purlin junction produced an unusable straight member.');
  return range;
}
function buildTimber(b,parent){
  const timber=group(parent,'wanfang-anhe-timber-frame',{body:'one-interconnected-square-column-frame',columnGrid:'derived from 33 bay cell corners, not a historical pillar count'});
  const unique=new Map();
  for(const {center:[x,z]}of wanfangBays)for(const sx of [-1,1])for(const sz of [-1,1]){
    const p=[x+sx*L.bay/2,z+sz*L.bay/2];unique.set(p.map(v=>v.toFixed(6)).join(','),p);
  }
  let inner=0;for(const [x,z]of unique.values())squarePost(b,timber,'wanfang-inner-post-'+inner++,x,z);
  const outline=wanfangOutline(L.veranda),outside=new Map(),beams=[],bridgeColumnAdjustments=new Map();
  // The veranda pier grid is inferred. Keep its count and outside wall line,
  // but seat bridge-mouth piers beyond the full deck and their stone shoes.
  const postPoint=point=>{
    for(const bridge of wanfangApproaches){
      const dx=bridge.to[0]-bridge.from[0],dz=bridge.to[1]-bridge.from[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
      const px=point[0]-bridge.from[0],pz=point[1]-bridge.from[1],normal=px*ux+pz*uz,tangent=px*nx+pz*nz;
      const clearance=Math.ceil((bridge.width/2+(L.columnWidth+.20)/2+.05)*100)/100;
      if(Math.abs(normal)>L.platformLip+.02||Math.abs(tangent)>=clearance)continue;
      const target=tangent<-.01?-clearance:clearance,shift=target-tangent,result=[point[0]+nx*shift,point[1]+nz*shift];
      bridgeColumnAdjustments.set(point.map(v=>v.toFixed(6)).join(','),{bridgeId:bridge.id,from:point,to:result,alongWallShift:Math.abs(shift),stoneShoeClearance:clearance-(L.columnWidth+.20)/2-bridge.width/2});
      return result;
    }
    return point;
  };
  for(let i=0;i<outline.length;i++){
    const a=outline[i],c=outline[(i+1)%outline.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]),n=Math.ceil(len/L.bay);
    for(let j=0;j<n;j++){const p=postPoint([a[0]+(c[0]-a[0])*j/n,a[1]+(c[1]-a[1])*j/n]),q=postPoint([a[0]+(c[0]-a[0])*(j+1)/n,a[1]+(c[1]-a[1])*(j+1)/n]);
      outside.set(p.map(v=>v.toFixed(6)).join(','),p);beams.push([p,q]);}
  }
  let outer=0;
  const roomEdges=roomBoundaryEdges();
  for(const [x,z]of outside.values()){
    let near=null,d=Infinity;
    for(const edge of roomEdges){
      const dx=edge.to[0]-edge.from[0],dz=edge.to[1]-edge.from[1],t=THREE.MathUtils.clamp(((x-edge.from[0])*dx+(z-edge.from[1])*dz)/(dx*dx+dz*dz),0,1);
      const p=[edge.from[0]+t*dx,edge.from[1]+t*dz],distance=Math.hypot(x-p[0],z-p[1]);
      if(distance<d){d=distance;near=p;}
    }
    squarePost(b,timber,'wanfang-veranda-post-'+outer++,x,z,{outside:true,rotation:Math.atan2(x-near[0],z-near[1])});
  }
  beams.forEach(([a,c],i)=>layeredBeam(b,timber,'wanfang-eave-fang-'+i,a,c,L.floorY+L.columnHeight-.15,.29));
  const edges=roomBoundaryEdges();
  for(const [x,z]of outside.values()){
    let nearest=null,d=Infinity;
    for(const e of edges){const dx=e.to[0]-e.from[0],dz=e.to[1]-e.from[1],t=THREE.MathUtils.clamp(((x-e.from[0])*dx+(z-e.from[1])*dz)/(dx*dx+dz*dz),0,1),p=[e.from[0]+t*dx,e.from[1]+t*dz],dist=Math.hypot(x-p[0],z-p[1]);
      if(dist<d){d=dist;nearest=p;}}
    if(d>.1)layeredBeam(b,timber,'wanfang-veranda-transverse-tie-'+x+'-'+z,nearest,[x,z],L.floorY+L.columnHeight-.035,.22);
  }
  // Seven longitudinal purlin stations per locally oriented bay. Their height
  // and the intersection struts follow the actual continuous roof envelope.
  let purlins=0,rafters=0;const purlinClips=[];
  for(const bay of wanfangBays){
    const [cx,cz]=bay.center,axis=bay.part==='north'||bay.part==='south'||bay.part==='central'&&bay.grid[1]===0?'x':'z';
    const point=(along,cross)=>axis==='x'?[cx+along,cz+cross]:[cx+cross,cz+along];
    for(const cross of [-3.39,-2.37,-1.18,0,1.18,2.37,3.39]){
      const middle=point(0,cross),y=wanfangRoofProfile(cross)-.29,[fromAlong,toAlong]=purlinRange(point,cross,y);
      const a=point(fromAlong,cross),c=point(toAlong,cross);
      b.rod(timber,b.m.darkWood,[a[0],y,a[1]],[c[0],y,c[1]],.10,24);purlins++;
      if(toAlong-fromAlong<L.bay-.05-1e-8)purlinClips.push({bayId:bay.id,cross,fromAlong,toAlong,originalLength:L.bay-.05,length:toAlong-fromAlong});
      const actual=wanfangRoofAt(...middle)?.y-.23;
      if(actual>y+.15)b.rod(timber,b.m.greenWood,[middle[0],y,middle[1]],[middle[0],actual,middle[1]],.072,16);
    }
    for(let i=0;i<9;i++){
      const along=(i/8-.5)*L.bay*.96,points=[];
      for(let j=0;j<=32;j++){const cross=-3.78+7.56*j/32,[x,z]=point(along,cross),r=wanfangRoofAt(x,z);if(r)points.push(V(x,r.y-.155,z));}
      if(points.length>1){b.tube(timber,b.m.darkWood,points,.043,48,10);rafters++;}
    }
    const a=point(0,-L.bay/2),c=point(0,L.bay/2);
    layeredBeam(b,timber,'wanfang-bay-cross-beam-'+bay.id,a,c,L.floorY+L.columnHeight-.05,.24);
  }
  return {group:timber,diagnostics:{innerSquarePosts:inner,verandaSquarePosts:outer,bridgeColumnAdjustments:[...bridgeColumnAdjustments.values()],squareSection:L.columnWidth,purlinStationsPerBay:7,purlinMembers:purlins,purlinAnalyticClearance:.035,purlinJunctionEndSetback:.10,purlinClips,curvedRafters:rafters,structuralCalculation:false}};
}
function latticeLeaf(b,parent,name,width,height,{open=0,hinge=0}={}){
  const g=group(parent,name,{body:'thick-pierced-lattice-door-leaf',mergeIntoParent:true,thickness:.085,openingDegrees:open});
  g.position.x=hinge;g.rotation.y=THREE.MathUtils.degToRad(open);
  const cx=width/2;
  for(const x of [0,width])b.woodBox(g,[x,height/2,0],[.073,height,.085],b.m.windowWood);
  for(const y of [.07,.64,height-.055])b.woodBox(g,[cx,y,0],[width,.09,.088],b.m.windowWood);
  b.woodBox(g,[cx,.345,-.007],[width-.08,.50,.052],b.m.darkWood);
  for(const face of [-1,1])b.box(g,b.m.green,[cx,.345,face*.034],[width-.16,.36,.015]);
  const lattice=jiuzhouLattice(b,g,name+'-pierced-upper',{width:width-.08,height:height-.85,y:.73+(height-.85)/2,lining:'paper'});
  // Each exterior edge faces local -Z: put the pierced wood outside its lining.
  lattice.position.x=cx;lattice.rotation.y=Math.PI;
  for(const y of [.27,height-.23])b.add(g,b.prototype('wanfang-door-hinge',()=>new THREE.CylinderGeometry(.027,.027,.16,16)),b.m.iron,[0,y,0]);
  return g;
}
function buildEnvelope(b,parent){
  const g=group(parent,'wanfang-anhe-joinery-and-open-passages',{body:'continuous-exterior-wall-line-with-real-thick-open-leaves'});
  const openings=[];
  for(const [i,e]of roomBoundaryEdges().entries()){
    const frame=spanGroup(g,'wanfang-facade-'+e.id,e.from,e.to,L.floorY+.035);
    const width=L.bay-L.columnWidth,height=3.17,n=4,w=(width-.045)/n;
    const open=(e.part==='central'&&i%3===0)||(e.part!=='central'&&Number(e.bayId.split('-').at(-1))===3);
    for(const y of [.045,height+.095])b.woodBox(frame,[0,y,0],[width+.12,.105,.20],b.m.darkWood);
    for(const side of [-1,1])b.woodBox(frame,[side*width/2,height/2,0],[.086,height,.15],b.m.greenWood);
    for(let k=0;k<n;k++){
      let hinge=-width/2+k*w,angle=0;
      if(open&&(k===1||k===2)){
        if(k===1){hinge=-width/2+w;angle=-84;}
        else{hinge=width/2-w;angle=84;}
      }
      const leaf=latticeLeaf(b,frame,'wanfang-leaf-'+e.id+'-'+k,w-.02,height,{open:angle,hinge});
      if(open&&k===2){leaf.rotation.y+=Math.PI; /* Paired hinge uses rotation, never a negative merged scale. */}
    }
    if(open)openings.push({id:e.id,center:[(e.from[0]+e.to[0])/2,(e.from[1]+e.to[1])/2],clearWidth:2*w-.11,clearHeight:height-.12});
    layeredBeam(b,g,'wanfang-wall-fang-'+e.id,e.from,e.to,L.floorY+L.columnHeight-.19,.35);
  }
  return {group:g,diagnostics:{exteriorBayFacades:roomBoundaryEdges().length,latticeLeaves:roomBoundaryEdges().length*4,openPassages:openings,pattern:'plain stepped-square family; detailed historic carving not recovered',glazing:'inferred warm lining, no imported late-Xianfeng glass identity'}};
}
function nearOpening(x,z){
  for(const e of wanfangApproaches)if(Math.hypot(x-e.from[0],z-e.from[1])<e.width*.70)return true;
  return Math.abs(x-wanfangDock.center[0])<wanfangDock.width*.59&&Math.abs(z-wanfangDock.center[1])<.7;
}
function woodenRail(b,parent,name,a,c,{gateCheck=false,floor=L.floorY}={}){
  const g=spanGroup(parent,name,a,c,floor),len=Math.hypot(c[0]-a[0],c[1]-a[1]),n=Math.ceil(len/1.12),step=len/n;
  const allowed=x=>!gateCheck||!nearOpening((a[0]+c[0])/2+(c[0]-a[0])*x/len,(a[1]+c[1])/2+(c[1]-a[1])*x/len);
  for(let i=0;i<=n;i++){const x=-len/2+i*step;if(!allowed(x))continue;
    b.woodBox(g,[x,.405,0],[.096,.81,.096],b.m.windowWood);b.box(g,b.m.darkWood,[x,.823,0],[.13,.055,.13]);}
  for(let i=0;i<n;i++){const x=-len/2+(i+.5)*step;if(!allowed(x)||!allowed(x-step/2)||!allowed(x+step/2))continue;
    for(const y of [.18,.70])b.woodBox(g,[x,y,0],[step,.083,.077],b.m.windowWood);
    for(const d of [-.30,0,.30])b.woodBox(g,[x+d*step,.44,0],[.033,.46,.045],b.m.greenWood);
    b.woodBox(g,[x,.78,0],[step+.018,.066,.12],b.m.windowWood);
  }
}
function buildApproaches(b,parent){
  const g=group(parent,'wanfang-anhe-three-bridges-and-south-dock',{body:'three-documented-corner-connections-plus-short-south-water-stair',shoreSpansInferred:true});
  const outline=wanfangOutline(L.veranda+.045);
  for(let i=0;i<outline.length;i++)woodenRail(b,g,'wanfang-water-rail-'+i,outline[i],outline[(i+1)%outline.length],{gateCheck:true});
  for(const bridge of wanfangApproaches){
    const {from,to,width,spans}=bridge,len=Math.hypot(to[0]-from[0],to[1]-from[1]),body=spanGroup(g,bridge.id,from,to);
    // Flat timber deck and lintels, no invented scenic arch.
    // A physical timber backing joins the plank undersides. The visible
    // 7 mm joints remain; foot support cannot fall through to the water.
    b.woodBox(body,[0,L.floorY-.17,0],[len,.06,width],b.m.darkWood);
    for(let j=0;j<Math.ceil(len/.25);j++){const dx=len/Math.ceil(len/.25);
      b.woodBox(body,[-len/2+(j+.5)*dx,L.floorY-.07,0],[dx-.007,.14,width],b.m.windowWood);}
    for(const side of [-1,1])b.woodBox(body,[0,L.floorY-.23,side*(width/2-.21)],[len+.10,.28,.23],b.m.darkWood);
    for(let j=0;j<=spans;j++){
      const x=-len/2+len*j/spans;
      b.box(body,b.m.foundation,[x,(L.foundationBottom+L.floorY-.20)/2,0],[.44,L.floorY-.20-L.foundationBottom,width+.28]);
      b.box(body,b.m.stone,[x,L.floorY-.25,0],[.60,.16,width+.39]);
    }
    for(const side of [-1,1])woodenRail(b,body,bridge.id+'-rail-'+side,[-len/2,side*width/2],[len/2,side*width/2]);
    const terminal=group(body,bridge.id+'-inferred-landing',{body:'limited-study-abutment-not-a-historic-shore'});
    b.box(terminal,b.m.stone,[len/2+.70,L.floorY-.21,0],[1.40,.42,width+.50]);
  }
  const d=wanfangDock,stair=group(g,d.id,{body:'short-south-facing-water-stair-not-a-bridge',stairWidth:d.width});
  const count=7,rise=(L.floorY-d.bottomTreadY)/count;
  for(let i=0;i<count;i++){
    const top=L.floorY-rise*(i+1),z=d.center[1]+d.run*(i+.5)/count;
    b.box(stair,b.m.stone,[d.center[0],(L.foundationBottom+top)/2,z],[d.width,top-L.foundationBottom,d.run/count+.018]);
    b.box(stair,b.m.carving,[d.center[0],top-.020,z+d.run/count*.40],[d.width+.028,.043,.068]);
  }
  for(const side of [-1,1]){
    const x=d.center[0]+side*(d.width/2+.13);
    b.box(stair,b.m.stone,[x,.33,d.center[1]+d.run/2],[.26,.88,d.run+.08]);
  }
  return {group:g,diagnostics:{bridges:wanfangApproaches.map(v=>({...v})),dock:{...d,steps:count},continuousBridgeBacking:{topY:L.floorY-.14,bottomY:L.floorY-.20,thickness:.06,confinedToOriginalDeck:true,constructionInferred:true},source:'DPM 2016 PDF09 figure13/quoted corner labels; DPM2008 roof model. Exact shore distance inferred.'}};
}
export function createWanfangAnheStudy({signal}={}){
  signal?.throwIfAborted();
  const root=new THREE.Group();root.name=WANFANG_ANHE_ID;
  let b,water,disposed=false,abort;
  const diagnostics={id:WANFANG_ANHE_ID,family:'wanfang-anhe',revision:'navigation-refinement-r3',quality:'full-authored-owner-original-tile-arcs',provisionalScale:{metresPerChi:L.chi,bay:L.bay,veranda:L.veranda,columnWidth:L.columnWidth,columnHeight:L.columnHeight,notMeasured1860:true},
    historicalEvidence:L.evidence,layout:{bayCount:wanfangBays.length,centralBays:13,outerBayCounts:{north:5,east:5,south:5,west:5},handedness:'north→west; east→north; south→east; west→south',waterCourts:wanfangWaterCourts},
    material:{shaderPreparations:0,preparedMaterials:[],clayBindings:0},resources:{disposed:false},counts:null};
  const dispose=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);root.removeFromParent();
    const errors=[];try{water?.dispose();}catch(e){errors.push(e);}try{b?.dispose();}catch(e){errors.push(e);}
    root.clear();diagnostics.resources.disposed=true;
    if(errors.length)throw new AggregateError(errors,'Wanfang study cleanup failed');
  };
  try{
    b=new WanfangBuilder(WANFANG_ANHE_ID);
    const architecture=group(root,'wanfang-anhe-complete-architecture',{body:'connected-33-bay-water-palace'});
    buildPlatform(b,architecture);signal?.throwIfAborted();
    const frame=buildTimber(b,architecture),joinery=buildEnvelope(b,architecture),approaches=buildApproaches(b,architecture);
    signal?.throwIfAborted();const roof=buildWanfangAnheRoof(b,architecture);signal?.throwIfAborted();
    const bed=group(root,'wanfang-anhe-study-lake-bed',{navigation:false,historicalLakeOutline:false});
    b.box(bed,b.m.bed,[0,L.lakeBed-.08,0],[L.lakeHalf*2,.16,L.lakeHalf*2]);
    b.flush();b.releasePrototypes();prepareWanfangAnheFinishes(b,root,diagnostics.material);
    water=createWanfangStudyWater();root.add(water.group);water.update(0);
    root.updateMatrixWorld(true);root.userData={id:WANFANG_ANHE_ID,researchCandidate:true,sourceAsset:true,historicalMeasurement:false,coordinates:{east:'+X',north:'-Z',up:'+Y'},waterline:L.waterY};
    for(const p of [bed,water.group])p.traverse(o=>{o.userData.navigation=false;});
    diagnostics.roof=roof.diagnostics;diagnostics.timber=frame.diagnostics;diagnostics.joinery=joinery.diagnostics;diagnostics.approaches=approaches.diagnostics;diagnostics.water=water.diagnostics;
    let meshes=0,triangles=0,renderInstances=0;root.traverse(o=>{if(!o.isMesh)return;meshes++;const instances=o.isInstancedMesh?o.count:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*instances;if(o.isInstancedMesh)renderInstances+=o.count;});
    diagnostics.counts={meshes,triangles,renderInstanceCount:renderInstances,uniqueGeometries:b.geometries.size,ownedMaterials:b.materials.size,ownedTextures:b.textures.size};
    const box=new THREE.Box3().setFromObject(root),architecturalBox=new THREE.Box3().setFromObject(architecture);
    diagnostics.bounds={min:box.min.toArray(),max:box.max.toArray(),architecture:{min:architecturalBox.min.toArray(),max:architecturalBox.max.toArray()}};
    abort=()=>{try{dispose();}catch(error){diagnostics.resources.abortCleanupError=String(error);}};
    signal?.addEventListener('abort',abort,{once:true});signal?.throwIfAborted();
    return {group:root,diagnostics,layout:L,waterline:L.waterY,resources:{geometries:b.geometries,materials:b.materials,textures:b.textures,instanceMeshes:b.instanceMeshes,water},dispose,
      update(time=0){if(disposed)return;signal?.throwIfAborted();water.update(time);}};
  }catch(error){try{dispose();}catch(cleanup){diagnostics.resources.cleanupError=String(cleanup);}throw error;}
}
