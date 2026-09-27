// Roof construction derives from the frozen Ergongmen geometric utility; no Ergongmen owner or historical dimensions are imported.
import * as THREE from 'three';
import {JiuzhouBuilder} from './jiuzhou-architecture.js';
import {namedGroup,V} from './study-geometry.js';
import {roofTileRollGeometry,quarriedMasonryBlockGeometry} from './chinese-architecture-geometry.js';
import {singleJuanpengSection,cropJuanpengSection,jiuzhouRoofSectionPoint,juanpengSegmentPoint,joinedJuanpengStripGeometry,roofSurfacePatchGeometry,clayPanGeometry} from './jiuzhou-roof-geometry.js';
import {zhengdaGuangmingLayout as L} from './zhengda-guangming-layout.js';
import {makeZhengdaGuangmingMaterials} from './zhengda-guangming-materials.js';

export const part=(parent,name,data={})=>namedGroup(parent,name,{...data,reconstructionDetail:true});
export class ZhengdaBuilder extends JiuzhouBuilder{
 constructor(){super('zhengda-guangming');this.id=L.id;}
 makeMaterials(){return makeZhengdaGuangmingMaterials(this);}
 instanceTile(parent,points,material,kind){
  this.tileShapes??=new Map();this.tileInstances??=new Map();
  const spanX=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),spanZ=Math.max(...points.map(p=>p.z))-Math.min(...points.map(p=>p.z));
  const origin=V(spanX<1e-9?points[0].x:0,points[0].y,spanZ<1e-9?points[0].z:0),local=points.map(p=>p.clone().sub(origin));
  const shapeKey=JSON.stringify([kind,...local.map(p=>p.toArray())]);let geometry=this.tileShapes.get(shapeKey);
  if(!geometry){
   geometry=kind==='pan'?clayPanGeometry(local,.25):roofTileRollGeometry(local,L.roof.coverOuterDiameter/2,.018,32);
   geometry.userData={...geometry.userData,zhengdaTileKind:kind,coverOuterDiameter:kind==='cover'?L.roof.coverOuterDiameter:null,authoredCourseLength:L.roof.courseLength};
   geometry.computeBoundingBox();geometry.computeBoundingSphere();this.tileShapes.set(shapeKey,geometry);
  }
  const key=parent.uuid+':'+material.id+':'+geometry.id;
  if(!this.tileInstances.has(key))this.tileInstances.set(key,{parent,material,geometry,positions:[]});
  this.tileInstances.get(key).positions.push(origin.clone());
 }
 dispose(){
  if(this.disposed)return;const errors=[];
  for(const mesh of this.instanceMeshes??[])try{mesh.dispose();}catch(e){errors.push(e);}
  this.instanceMeshes?.clear();
  try{this.releasePrototypes();}catch(e){errors.push(e);}
  for(const {parts}of this.pending.values())for(const {geometry}of parts)try{geometry.dispose();}catch(e){errors.push(e);}
  this.pending.clear();this.tileInstances?.clear();this.disposed=true;
  for(const set of [this.geometries,this.materials,this.textures]){for(const resource of set)try{resource.dispose();}catch(e){errors.push(e);}set.clear();}
  if(errors.length)throw new AggregateError(errors,'Zhengda resource cleanup failed');
 }
}
export function zhengdaSparrowBrace(b,parent,{x,z,y,direction=1,rotationY=0}){
 const g=part(parent,'zhengda-carved-queti-'+parent.children.length,{body:'pierced-sparrow-brace',ornamentAuthority:'authored curved relief, not recovered original carving',mergeIntoParent:true});
 g.position.set(x,y,z);g.rotation.y=rotationY+(direction<0?Math.PI:0);
 const s=new THREE.Shape();s.moveTo(.06,0);s.lineTo(.78,0);s.bezierCurveTo(.77,-.13,.61,-.10,.57,-.22);s.bezierCurveTo(.51,-.34,.39,-.17,.29,-.34);s.bezierCurveTo(.18,-.49,.22,-.61,.06,-.62);s.closePath();
 const hole=new THREE.Path();hole.moveTo(.16,-.12);hole.bezierCurveTo(.40,-.08,.44,-.17,.33,-.23);hole.bezierCurveTo(.22,-.20,.21,-.30,.16,-.34);hole.closePath();s.holes.push(hole);
 const geo=new THREE.ExtrudeGeometry(s,{depth:.13,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.012,bevelThickness:.009,curveSegments:24});geo.translate(0,0,-.065);
 b.add(g,geo,b.m.green,undefined,undefined,undefined,true);
 for(const face of [-1,1]){
  const stroke=[[.11,-.04,face*.083],[.62,-.04,face*.083],[.56,-.14,face*.083],[.42,-.22,face*.083],[.30,-.27,face*.083],[.20,-.42,face*.083],[.12,-.55,face*.083]];
  b.tube(g,b.m.pale,stroke,.009,48,8);
 }
 return g;
}
function tileRun(b,parent,sample,row,{pan=true}={}){
 const coarse=Array.from({length:25},(_,i)=>sample(i/24));let length=0;for(let i=1;i<coarse.length;i++)length+=coarse[i].distanceTo(coarse[i-1]);if(length<.05)return;
 const count=Math.max(1,Math.ceil(length/L.roof.courseLength));
 for(let j=0;j<count;j++){
  const a=j/count,c=Math.min(1,(j+1.10)/count);
  const points=Array.from({length:7},(_,i)=>sample(THREE.MathUtils.lerp(a,c,i/6)).add(V(0,.026+.018*(1-i/6),0)));
  const mat=(row*13+j*7)%19===0?b.m.tileShade:(row*7+j*11)%31===0?b.m.tileLight:b.m.greyTile;
  b.instanceTile(parent,points,mat,'cover');
  if(pan){const pp=points.map((p,i)=>{const tangent=points[Math.min(i+1,6)].clone().sub(points[Math.max(i-1,0)]),side=V(tangent.z,0,-tangent.x).normalize();return p.clone().addScaledVector(side,L.roof.tilePitch/2).add(V(0,-.019,0));});b.instanceTile(parent,pp,mat,'pan');}
 }
}
export function zhengdaRoofProfile(){
 const r=L.roof;
 const section=singleJuanpengSection({depth:r.depth,eaveY:r.eaveY,crownY:r.eaveY+r.rise}),halfDepth=r.depth/2,breakZ=halfDepth*.55,upperWidth=r.width-r.depth*.38,upper=cropJuanpengSection(section,-breakZ,breakZ),fullHalf=r.width/2,upperHalf=upperWidth/2; const skinY=(x,z)=>{
  const ax=Math.abs(x),az=Math.abs(z);if(ax<=upperHalf&&az<=breakZ)return jiuzhouRoofSectionPoint(section,z).y;
  const tx=(fullHalf-ax)/(fullHalf-upperHalf),tz=(halfDepth-az)/(halfDepth-breakZ),t=Math.min(tx,tz);
  const hz=THREE.MathUtils.lerp(halfDepth,breakZ,t),hx=THREE.MathUtils.lerp(fullHalf,upperHalf,t),u=tx<tz?az/hz:ax/hx;
  return jiuzhouRoofSectionPoint(section,hz).y+.20*(1-t)**2*u**6;
 };
 return{section,halfDepth,breakZ,upperWidth,upper,fullHalf,upperHalf,skinY};
}
export function createZhengdaRoof(b,parent){
 const r=L.roof,g=part(parent,'zhengda-complete-rolled-hip-gable-roof',{body:'grey-juanpeng-xieshan',roofType:r.type,dougong:true,curveAuthority:'authored within documented late-state type'});
 const {section,halfDepth,breakZ,upperWidth,upper,fullHalf,upperHalf,skinY}=zhengdaRoofProfile();
 const upperGroup=part(g,'zhengda-continuous-rolled-crown',{body:'closed-continuous-rolled-roof'});
 b.add(part(upperGroup,'zhengda-upper-roof-skin',{body:'closed-roof-shell-only'}),joinedJuanpengStripGeometry({width:upperWidth,section:upper}),b.m.tileShade,undefined,undefined,undefined,true);
 const rows=Math.floor((upperWidth-.18)/r.tilePitch);
 for(let i=0;i<=rows;i++){
  const x=-upperWidth/2+.09+(upperWidth-.18)*i/rows;
  for(const segment of upper.segments){const up=segment.points[3].y>segment.points[0].y;tileRun(b,upperGroup,t=>juanpengSegmentPoint(segment,up?t:1-t,x),i,{pan:up?i<rows:i>0});}
  const points=Array.from({length:17},(_,j)=>jiuzhouRoofSectionPoint(section,-.20+.4*j/16,x).add(V(0,.089,0)));
  b.instanceTile(upperGroup,points,b.m.greyTile,'cover');
 }

 for(const side of [-1,1]){
  for(const mode of ['front','rear','side']){
   const sideFace=mode==='side',back=mode==='rear',hip=part(g,'zhengda-'+mode+'-hip-'+side,{body:'closed-hip-surface'});
   const sample=(u,t)=>{const hx=THREE.MathUtils.lerp(fullHalf,upperHalf,t),hz=THREE.MathUtils.lerp(halfDepth,breakZ,t),y=jiuzhouRoofSectionPoint(section,hz).y,lift=.20*(1-t)**2;return sideFace?V(side*hx,y+lift*(2*u-1)**6,(2*u-1)*hz):V(side*hx*u,y+lift*u**6,(back?-1:1)*hz);};
   b.add(part(hip,hip.name+'-skin',{body:'closed-roof-shell-only'}),roofSurfacePatchGeometry(sample,{columns:32,rows:48,thickness:.18}),b.m.tileShade,undefined,undefined,undefined,true);
   const span=sideFace?r.depth:fullHalf,n=Math.floor(span/r.tilePitch);
   for(let i=0;i<n;i++){
    const offset=sideFace?-halfDepth+(i+.5)*span/n:(i+.5)*span/n;
    const maxT=Math.min(1,sideFace?(halfDepth-Math.abs(offset)-.07)/(halfDepth-breakZ):(fullHalf-offset-.07)/(fullHalf-upperHalf));if(maxT<=.006)continue;
    const run=t=>{const at=t*maxT,hx=THREE.MathUtils.lerp(fullHalf,upperHalf,at),hz=THREE.MathUtils.lerp(halfDepth,breakZ,at);return sample(sideFace?(offset/hz+1)/2:offset/hx,at);};
    const tangent=run(.05).sub(run(0)),next=sideFace?V(0,0,1):V(side,0,0),toNext=V(tangent.z,0,-tangent.x).dot(next)>0;
    tileRun(b,hip,run,i,{pan:toNext?i<n-1:i>0});
   }
   if(sideFace)for(const edge of [0,1])tileRun(b,hip,t=>sample(edge,t).add(V(0,.105,0)),71+edge,{pan:false});
  }
  const wood=part(g,'zhengda-timber-shanhua-'+side,{body:'timber-gable-infill-with-authored-relief',notMasonry:true});
  const bottom=jiuzhouRoofSectionPoint(section,breakZ).y-.23,outline=[[upper.segments[0].points[0].x,bottom]];
  for(const seg of upper.segments)for(let i=0;i<=64;i++){const v=juanpengSegmentPoint(seg,i/64);outline.push([v.z,v.y-.18]);}outline.push([breakZ,bottom]);
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p))),geo=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false});geo.translate(0,0,-.08);geo.rotateY(-Math.PI/2);
  const gx=side*(upperHalf-.13);b.add(wood,geo,b.m.darkWood,[gx,0,0],undefined,undefined,true);
  for(const seg of upper.segments){const pts=Array.from({length:65},(_,i)=>{const v=juanpengSegmentPoint(seg,i/64,gx);v.y-=.075;return v;});b.tube(wood,b.m.greyTile,pts,.083,72,20);}
  for(let k=-5;k<=5;k++){
   const z=k*.39,available=jiuzhouRoofSectionPoint(section,z).y-.24-bottom;if(available<.14)continue;
   const y=bottom+available*.42,rx=Math.min(.16,available*.20),pts=[];
   for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;pts.push([gx+side*.088,y+rx*Math.sin(a)*(1+.16*Math.cos(3*a)),z+rx*Math.cos(a)]);}
   b.tube(wood,b.m.pale,pts,.013,48,10);
   b.tube(wood,b.m.gold,[[gx+side*.09,bottom+.06,z],[gx+side*.09,y-.05,z-.07],[gx+side*.09,y+rx*.8,z]],.007,24,8);
  }
 }
 g.userData.coverOuterDiameter=r.coverOuterDiameter;g.userData.tilePitch=r.tilePitch;g.userData.upperHalf=upperHalf;g.userData.breakZ=breakZ;
 return {group:g,section,skinY,upperHalf,breakZ};
}
