import {BufferGeometry,Float32BufferAttribute} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// These are the existing study's authored dimensions, not surveyed stonework.
export const XIANFAQIAO_DECK_JOIN=Object.freeze({deckY:1.25,deckWidth:32.3,deckDepth:5.28,deckThickness:.18,deckBevel:.018,bankCentre:16.1,bankWidth:4.2,bankDepth:7,bankHeight:2.72,bankY:-.11,bankBevel:.025});
const S=XIANFAQIAO_DECK_JOIN;
const sourceDeck=()=>new RoundedBoxGeometry(S.deckWidth,S.deckThickness,S.deckDepth,1,S.deckBevel).translate(0,S.deckY-S.deckThickness/2,0);
const sourceBank=side=>new RoundedBoxGeometry(S.bankWidth,S.bankHeight,S.bankDepth,1,S.bankBevel).translate(side*S.bankCentre,S.bankY,0);
const samePoint=(a,b)=>a.slice(0,3).every((v,i)=>Math.abs(v-b[i])<1e-11);
function clean(points){return points.filter((p,i)=>!samePoint(p,points[(i+points.length-1)%points.length]));}
function split(poly,axis,value){
  const low=[],high=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[axis]-value,db=b[axis]-value;
    if(da<=0)low.push(a);if(da>=0)high.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const t=da/(da-db),p=a.map((v,j)=>v+(b[j]-v)*t);p[axis]=value;low.push(p);high.push(p);
    }
  }
  return [clean(low),clean(high)];
}
function facesOf(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,faces=[];
  for(let i=0;i<p.count;i+=3)faces.push([0,1,2].map(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k),n.getX(i+k),n.getY(i+k),n.getZ(i+k),uv.getX(i+k),uv.getY(i+k)]));
  return faces;
}
function geometryOf(faces,name){
  const positions=[],normals=[],uvs=[];
  const vertex=p=>{positions.push(...p.slice(0,3));normals.push(...p.slice(3,6));uvs.push(...p.slice(6,8));};
  for(const face of faces){
    if(face.length<3)continue;
    if(face.length===3){for(const p of face)vertex(p);continue;}
    // Keep every split boundary vertex, including collinear ones. A centroid
    // fan avoids T-junctions without welding away the original UV/normal seams.
    const centre=face[0].map((_,j)=>face.reduce((sum,p)=>sum+p[j],0)/face.length);
    for(let i=0;i<face.length;i++){vertex(centre);vertex(face[i]);vertex(face[(i+1)%face.length]);}
  }
  const g=new BufferGeometry();g.name=name;
  g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(normals,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));g.computeBoundingBox();return g;
}
function flatTopBounds(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,vertices=[];
  for(let i=0;i<p.count;i++)if(n.getY(i)===1)vertices.push({x:p.getX(i),y:p.getY(i),z:p.getZ(i),u:geometry.attributes.uv.getX(i),v:geometry.attributes.uv.getY(i)});
  return {minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minZ:Math.min(...vertices.map(p=>p.z)),maxZ:Math.max(...vertices.map(p=>p.z)),vertices};
}
function trimAndCapX(faces,x,keepLow){
  const kept=[],boundary=[];
  for(const face of faces){
    const part=split(face,0,x)[keepLow?0:1];if(part.length<3)continue;kept.push(part);
    for(const p of part)if(p[0]===x&&!boundary.some(q=>samePoint(p,q)))boundary.push(p);
  }
  const y=boundary.reduce((sum,p)=>sum+p[1],0)/boundary.length,z=boundary.reduce((sum,p)=>sum+p[2],0)/boundary.length;
  boundary.sort((a,b)=>Math.atan2(a[2]-z,a[1]-y)-Math.atan2(b[2]-z,b[1]-y));if(!keepLow)boundary.reverse();
  kept.push(boundary.map(p=>[x,p[1],p[2],keepLow?1:-1,0,0,(p[2]+S.deckDepth/2)/S.deckDepth,(p[1]-S.deckY+S.deckThickness)/S.deckThickness]));
  return kept;
}

/** Trim only the invisible deck ends inside the existing bank bodies. */
export function xianfaqiaoDeckGeometry(){
  const original=sourceDeck(),bank=sourceBank(1);
  try{
    const join=flatTopBounds(bank).minX;
    return geometryOf(trimAndCapX(trimAndCapX(facesOf(original),join,true),-join,false),'xianfaqiao-deck-with-closed-butt-ends');
  }finally{original.dispose();bank.dispose();}
}

/** The original closed bank skin, split between its original brick and the
 * already-visible limestone paving. Together these two material patches form
 * the same closed bank; neither patch alone is a separate solid. */
export function xianfaqiaoAbutmentGeometries(side){
  if(side!==-1&&side!==1)throw new Error('Xianfaqiao abutment side must be -1 or 1');
  const bank=sourceBank(side),deck=sourceDeck();
  try{
    const top=flatTopBounds(deck),masonry=[],paving=[];let faces=facesOf(bank);
    // Split every original face with the same planes so material boundaries
    // remain conforming at the outer rounded edge and the original UV seams.
    for(const [axis,value]of [[0,side>0?top.maxX:top.minX],[2,top.minZ],[2,top.maxZ]])faces=faces.flatMap(face=>split(face,axis,value).filter(part=>part.length>=3));
    const a=top.vertices.find(p=>p.x===top.minX&&p.z===top.minZ),b=top.vertices.find(p=>p.x===top.maxX&&p.z===top.minZ),c=top.vertices.find(p=>p.x===top.minX&&p.z===top.maxZ);
    for(const face of faces){
      const x=face.reduce((s,p)=>s+p[0],0)/face.length,z=face.reduce((s,p)=>s+p[2],0)/face.length;
      if(face.every(p=>p[4]===1)&&x>=top.minX&&x<=top.maxX&&z>=top.minZ&&z<=top.maxZ){
        paving.push(face.map(p=>{const u=(p[0]-a.x)/(b.x-a.x),v=(p[2]-a.z)/(c.z-a.z);return [...p.slice(0,6),a.u+(b.u-a.u)*u+(c.u-a.u)*v,a.v+(b.v-a.v)*u+(c.v-a.v)*v];}));
      }else masonry.push(face);
    }
    return {masonry:geometryOf(masonry,`xianfaqiao-bank-${side}-original-brick-skin`),paving:geometryOf(paving,`xianfaqiao-bank-${side}-continuous-paving-top`)};
  }finally{bank.dispose();deck.dispose();}
}

export function addXianfaqiaoDeck(b,parent){
  const geometry=xianfaqiaoDeckGeometry();
  try{b.add(parent,geometry,b.m.paving,undefined,undefined,undefined,false);}finally{geometry.dispose();}
}
export function addXianfaqiaoAbutment(b,bankParent,pavingParent,side){
  const {masonry,paving}=xianfaqiaoAbutmentGeometries(side);
  try{
    b.add(bankParent,masonry,b.m.brick,undefined,undefined,undefined,false);
    b.add(pavingParent,paving,b.m.paving,undefined,undefined,undefined,false);
  }finally{masonry.dispose();paving.dispose();}
}
