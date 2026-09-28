import * as THREE from 'three';
import {JiuzhouBuilder} from './jiuzhou-architecture.js';
import {namedGroup,V} from './study-geometry.js';
import {roofTileRollGeometry,quarriedMasonryBlockGeometry} from './chinese-architecture-geometry.js';
import {singleJuanpengSection,cropJuanpengSection,jiuzhouRoofSectionPoint,juanpengSegmentPoint,joinedJuanpengStripGeometry,roofSurfacePatchGeometry,clayPanGeometry} from './jiuzhou-roof-geometry.js';
import {ergongmenLayout as L} from './ergongmen-layout.js';

export const part=(parent,name,data={})=>namedGroup(parent,name,{...data,reconstructionDetail:true});
export class ErgongmenBuilder extends JiuzhouBuilder{
 constructor(){super('jiuzhou');this.id=L.id;}
 makeMaterials(){
  const m=super.makeMaterials();
  const data=new Uint8Array(1024*1024*4);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
   let h=Math.imul(x+271,374761393)^Math.imul(y+113,668265263);h=Math.imul(h^(h>>>13),1274126177);
   const v=128+Math.round(20*((h>>>0)/4294967295-.5)+8*Math.sin(x*.087)*Math.sin(y*.063)),i=(y*1024+x)*4;
   data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const bump=new THREE.DataTexture(data,1024,1024);bump.name='ergongmen-authored-mineral-relief';bump.colorSpace=THREE.NoColorSpace;
  bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.generateMipmaps=true;bump.minFilter=THREE.LinearMipmapLinearFilter;bump.needsUpdate=true;
  this.textures.add(bump);
  m.wallRed=new THREE.MeshStandardMaterial({color:0xa94e3b,roughness:.93,bumpMap:bump,bumpScale:.0012});m.wallRed.name='ergongmen-red-lime-plaster';this.materials.add(m.wallRed);
  m.brick.color.setHex(0x77786f);m.brick.bumpMap=bump;m.brick.bumpScale=.0007;m.brick.normalMap=null;
  m.paving.color.setHex(0x969a92);m.paving.bumpMap=bump;m.paving.bumpScale=.0005;m.paving.normalMap=null;
  m.rubble=[0x9b9588,0x85867e,0xaaa293,0x7d817b,0xb0a696,0x8c8b80].map((color,i)=>{
   const mat=m.stone.clone();mat.color.setHex(color);mat.userData={category:'tiger-skin-rubble',authoredStoneArrangement:true,variant:i};this.materials.add(mat);return mat;
  });
  m.red.color.setHex(0x933b2d);m.gold.color.setHex(0xb6a074);m.gold.metalness=.25;
  return m;
 }
 instanceTile(parent,points,material,kind){
  this.tileShapes??=new Map();this.tileInstances??=new Map();
  const spanX=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),spanZ=Math.max(...points.map(p=>p.z))-Math.min(...points.map(p=>p.z));
  const origin=V(spanX<1e-9?points[0].x:0,points[0].y,spanZ<1e-9?points[0].z:0),local=points.map(p=>p.clone().sub(origin));
  const shapeKey=JSON.stringify([kind,...local.map(p=>p.toArray())]);let geometry=this.tileShapes.get(shapeKey);
  if(!geometry){
   geometry=kind==='pan'?clayPanGeometry(local,.215):roofTileRollGeometry(local,L.roof.coverOuterDiameter/2,.018,32);
   geometry.userData={...geometry.userData,ergongmenTileKind:kind,coverOuterDiameter:kind==='cover'?L.roof.coverOuterDiameter:null,authoredCourseLength:L.roof.courseLength};
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
  if(errors.length)throw new AggregateError(errors,'Ergongmen resource cleanup failed');
 }
}
export function createErgongmenPlatform(b,parent){
 const p=L.platform,g=part(parent,'ergongmen-tiger-skin-platform',{body:'rubble-faced-platform',dimensions:[p.width,p.height,p.depth],sourceDimensions:true});
 b.box(g,b.m.foundation,[0,.30,0],[p.width-.06,.64,p.depth-.06]);
 b.box(g,b.m.stone,[0,p.height-.055,0],[p.width,.07,p.depth]);
 const pitchX=p.groundBrick[0]+.006,pitchZ=p.groundBrick[1]+.006;
 for(let z=-p.depth/2+.012,row=0;z<p.depth/2-.012;z+=pitchZ,row++){
  const d=Math.min(p.groundBrick[1],p.depth/2-.012-z);
  for(let x=-p.width/2+.012-(row%2)*pitchX/2;x<p.width/2-.012;x+=pitchX){
   const x0=Math.max(x,-p.width/2+.012),x1=Math.min(x+p.groundBrick[0],p.width/2-.012);if(x1<=x0)continue;
   b.box(g,(row+Math.round(x/pitchX))%19?b.m.paving:b.m.foundation,[(x0+x1)/2,p.height-.012,z+d/2],[x1-x0,.024,d]);
  }
 }
 for(const face of [0,1,2,3]){
  const along=face%2?p.depth:p.width,angle=face*Math.PI/2,normal=[Math.sin(angle),Math.cos(angle)],tangent=[Math.cos(angle),-Math.sin(angle)];
  const wallHalf=(face%2?p.width:p.depth)/2;
  for(let row=0;row<3;row++){
   let x=-along/2+.03,cell=0;
   while(x<along/2-.03){
    const w=Math.min(.40+.23*(.5+.5*Math.sin(cell*2.43+row*1.31+face)),along/2-.03-x),height=.173+.025*Math.sin(cell*1.13+row);
    const seed=face*91+row*31+cell,center=x+w/2;
    b.add(g,b.prototype('tiger-rubble-'+seed%23,()=>quarriedMasonryBlockGeometry(seed%23)),b.m.rubble[seed%6],
     [tangent[0]*center+normal[0]*(wallHalf-.105),.115+row*.182, tangent[1]*center+normal[1]*(wallHalf-.105)],[Math.max(.03,w-.012),height,.18],[0,angle,0]);
    x+=w;cell++;
   }
  }
 }
 return g;
}
export function ergongmenSparrowBrace(b,parent,{x,z,y,direction=1,rotationY=0}){
 const g=part(parent,'ergongmen-carved-queti-'+parent.children.length,{body:'pierced-sparrow-brace',ornamentAuthority:'authored curved relief, not recovered original carving',mergeIntoParent:true});
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
export function createErgongmenRoof(b,parent){
 const r=L.roof,g=part(parent,'ergongmen-eight-purlin-roof',{body:'grey-juanpeng-xieshan',roofType:r.type,dougong:false,curveAuthority:'authored within documented late-state type'});
 const section=singleJuanpengSection({depth:r.depth,eaveY:r.eaveY,crownY:r.eaveY+r.rise}),halfDepth=r.depth/2,breakZ=halfDepth*.55,upperWidth=r.width-r.depth*.38,upper=cropJuanpengSection(section,-breakZ,breakZ),fullHalf=r.width/2,upperHalf=upperWidth/2;
 const upperGroup=part(g,'ergongmen-continuous-rolled-crown',{body:'closed-continuous-rolled-roof'});
 b.add(part(upperGroup,'ergongmen-upper-roof-skin',{body:'closed-roof-shell-only'}),joinedJuanpengStripGeometry({width:upperWidth,section:upper}),b.m.tileShade,undefined,undefined,undefined,true);
 const rows=Math.floor((upperWidth-.18)/r.tilePitch);
 for(let i=0;i<=rows;i++){
  const x=-upperWidth/2+.09+(upperWidth-.18)*i/rows;
  for(const segment of upper.segments){const up=segment.points[3].y>segment.points[0].y;tileRun(b,upperGroup,t=>juanpengSegmentPoint(segment,up?t:1-t,x),i,{pan:up?i<rows:i>0});}
  const points=Array.from({length:17},(_,j)=>jiuzhouRoofSectionPoint(section,-.20+.4*j/16,x).add(V(0,.089,0)));
  b.instanceTile(upperGroup,points,b.m.greyTile,'cover');
 }
 const skinY=(x,z)=>{
  const ax=Math.abs(x),az=Math.abs(z);if(ax<=upperHalf&&az<=breakZ)return jiuzhouRoofSectionPoint(section,z).y;
  const tx=(fullHalf-ax)/(fullHalf-upperHalf),tz=(halfDepth-az)/(halfDepth-breakZ),t=Math.min(tx,tz);
  const hz=THREE.MathUtils.lerp(halfDepth,breakZ,t),hx=THREE.MathUtils.lerp(fullHalf,upperHalf,t),u=tx<tz?az/hz:ax/hx;
  return jiuzhouRoofSectionPoint(section,hz).y+.20*(1-t)**2*u**6;
 };
 for(const side of [-1,1]){
  for(const mode of ['front','rear','side']){
   const sideFace=mode==='side',back=mode==='rear',hip=part(g,'ergongmen-'+mode+'-hip-'+side,{body:'closed-hip-surface'});
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
  const wood=part(g,'ergongmen-timber-shanhua-'+side,{body:'timber-gable-infill-with-authored-relief',notMasonry:true});
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
