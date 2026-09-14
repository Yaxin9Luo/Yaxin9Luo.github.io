import * as THREE from 'three';
import {createTriangleSampler} from './terrain-geometry.js';
import {createFineTerrainLand} from './terrain-patch-owner.js';
import {capShoreBankSubmergedR2,validateShoreBankBedProfile} from './shore-bank-submerged-r2.js';

export const shoreBankSpec=Object.freeze({
  id:'xianfa-shore-bank-study-r1',originXZ:Object.freeze([853.1562786319998,-554.839069658]),
  tangentXZ:Object.freeze([.9701425001453318,-.24253562503633427]),inlandXZ:Object.freeze([-.24253562503633427,-.9701425001453318]),
  halfLength:12,waterY:2,wetDepth:3.5,colourDepth:11,edgeLength:.15,
  evidence:'contemporary-exhibition-bank-naturalisation; not a surveyed Qing shoreline',
});
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return clamp(t*t*t*(t*(t*6-15)+10));};
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const fail=message=>{throw new Error('Shore bank: '+message);};
export const shoreBankCoordinates=(x,z,spec=shoreBankSpec)=>{const dx=x-spec.originXZ[0],dz=z-spec.originXZ[1];return [dx*spec.tangentXZ[0]+dz*spec.tangentXZ[1],dx*spec.inlandXZ[0]+dz*spec.inlandXZ[1]];};
export const shoreBankWorldXZ=(s,n,spec=shoreBankSpec)=>[spec.originXZ[0]+s*spec.tangentXZ[0]+n*spec.inlandXZ[0],spec.originXZ[1]+s*spec.tangentXZ[1]+n*spec.inlandXZ[1]];
const along=(s,spec)=>Math.abs(s)>=spec.halfLength-1e-8?0:1-smooth((Math.abs(s)-(spec.halfLength-2))/2);
export function shoreBankWidth(s){return Math.max(.23,Math.min(.92,.55+.20*Math.sin(s*.63+.4)+.11*Math.sin(s*1.39-1.1)+.055*Math.cos(s*2.73)));}

/** Only existing wet-bed vertices are shaped. Every dry-land position/index
 * stays intact, so the entire n>1 root zone keeps its original source faces.
 * The old land/bed seam remains at waterY. A low, attached sediment lip masks
 * portions of the existing water sheet; no new water polygon is inferred. */
export function shoreBankBedHeight(x,z,sourceY,spec=shoreBankSpec,bedProfile='r1'){
  if(bedProfile!=='r1'){
    validateShoreBankBedProfile(bedProfile);
    return capShoreBankSubmergedR2(sourceY,shoreBankBedHeight(x,z,sourceY,spec),spec.waterY);
  }
  const [s,n]=shoreBankCoordinates(x,z,spec),e=along(s,spec),d=-n;
  if(!e||d<=.00008||d>=spec.wetDepth-1e-8||sourceY>=spec.waterY-.000001)return sourceY;
  const width=shoreBankWidth(s),crest=.038+.026*(.5+.5*Math.sin(s*.77-.2));let target;
  if(d<=width)target=spec.waterY+crest*Math.sin(Math.PI*d/width)**2;
  else target=THREE.MathUtils.lerp(spec.waterY,sourceY,smooth((d-width)/.75));
  const ripples=.009*(.5+.5*Math.sin(s*1.7+d*3.4))**2*smooth((d-width)/.45)*(1-smooth((d-2.4)/1.1));
  return sourceY+e*Math.max(0,target-sourceY,ripples);
}
const colours={moss:new THREE.Color('#67764d'),soil:new THREE.Color('#72634c'),damp:new THREE.Color('#4c493b'),sand:new THREE.Color('#938b73'),bed:new THREE.Color('#646956')};
export function shoreBankColour(x,y,z,source,target=new THREE.Color(),spec=shoreBankSpec){
  const [s,n]=shoreBankCoordinates(x,z,spec),e=along(s,spec),weight=e*(n>=0?1-smooth((n-5)/6):1-smooth((-n-2)/1.5));
  target.copy(source);if(!weight)return target;
  const shift=.20*Math.sin(s*.68)+.13*Math.sin(s*1.31-.6),d=n-shift;
  const c=colours.damp.clone();
  if(d>=0){c.lerp(colours.soil,smooth(d/1.5));c.lerp(colours.moss,smooth((d-.8)/3));}
  else c.lerp(colours.bed,smooth(-d/2));
  // Two irregular sandy fans sit beneath the open water-view windows.
  const fan=Math.exp(-(((s+3.7)/1.8)**2))+.78*Math.exp(-(((s-3.8)/1.6)**2)),sand=clamp(fan)*Math.exp(-(((n-.3)/1.25)**2))*.62;
  c.lerp(colours.sand,sand).multiplyScalar(.97+.04*Math.sin(s*.53+n*.72));
  return target.lerp(c,weight);
}

export function decodeShoreBankGeometry(record,{requireColour=true}={}){
  if(!record||!Array.isArray(record.worldMatrix)||!identity.every((n,i)=>record.worldMatrix[i]===n))fail('local snapshot support must keep its original identity world transform');
  const geometry=new THREE.BufferGeometry();geometry.name=record.geometryName;
  try{
    for(const [name,a] of Object.entries(record.attributes??{})){
      if(a.arrayType!=='Float32Array'||!Number.isInteger(a.itemSize)||a.itemSize<1||!Array.isArray(a.values)||a.values.length%a.itemSize||a.values.some(n=>!Number.isFinite(n)||Math.fround(n)!==n))fail('invalid original Float32 attribute');
      const values=new Float32Array(a.values);for(const i of a.negativeZeroIndices??[]){if(!Number.isInteger(i)||i<0||i>=values.length||values[i]!==0)fail('invalid source signed zero');values[i]=-0;}
      geometry.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));
    }
    const p=geometry.attributes.position;
    if(!p||p.itemSize!==3||!geometry.attributes.normal||requireColour&&!geometry.attributes.color||!Array.isArray(record.indices)||record.indices.length%3||record.indices.some(i=>!Number.isInteger(i)||i<0||i>=p.count)||record.sourceTriangleIndices?.length!==record.indices.length/3||record.sourceVertexIndices?.length!==p.count)fail('invalid original topology');
    if(Object.values(geometry.attributes).some(a=>a.count!==p.count)||record.sourceTriangleIndices.some((id,i)=>!Number.isInteger(id)||id<0||id>=record.sourceTriangleCount||i>0&&id<=record.sourceTriangleIndices[i-1])||record.sourceVertexIndices.some(id=>!Number.isInteger(id)||id<0||id>=record.sourceVertexCount))fail('invalid original source identity mapping');
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(record.indices),1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    geometry.userData={sourceGeometryUUID:record.geometryUUID,sourceGeometryName:record.geometryName,sourceTriangleIndices:[...record.sourceTriangleIndices],sourceVertexIndices:[...record.sourceVertexIndices],body:record.body};return geometry;
  }catch(error){geometry.dispose();throw error;}
}
function subset(source,ordinals,name){
  const remap=new Map(),ids=[],indices=[];
  for(const number of ordinals)for(let c=0;c<3;c++){const id=source.index.getX(number*3+c);if(!remap.has(id)){remap.set(id,ids.length);ids.push(id);}indices.push(remap.get(id));}
  const g=new THREE.BufferGeometry();g.name=name;
  for(const [name,a] of Object.entries(source.attributes)){const values=new Float32Array(ids.length*a.itemSize);for(let i=0;i<ids.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(ids[i],c);g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
  g.setIndex(indices);g.userData={...source.userData,sourceTriangleIndices:ordinals.map(i=>source.userData.sourceTriangleIndices[i]),sourceVertexIndices:ids.map(i=>source.userData.sourceVertexIndices[i])};g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function splitShoreBankBed(source,spec=shoreBankSpec){
  const selected=[],outside=[],p=source.attributes.position;
  for(let i=0;i<source.index.count/3;i++){
    const sn=[0,1,2].map(c=>{const id=source.index.getX(i*3+c);return shoreBankCoordinates(p.getX(id),p.getZ(id),spec);});
    const touches=Math.min(...sn.map(v=>v[0]))<spec.halfLength+1&&Math.max(...sn.map(v=>v[0]))>-spec.halfLength-1&&Math.min(...sn.map(v=>v[1]))<.0001&&Math.max(...sn.map(v=>v[1]))>-spec.wetDepth-1;
    (touches?selected:outside).push(i);
  }
  if(!selected.length)fail('no original lake-bed faces beneath the specified shore');
  let coarse;
  try{coarse=subset(source,selected,'shore-bank-original-bed-patch');return {coarse,outside:subset(source,outside,'shore-bank-retained-bed'),selectedOrdinals:selected};}catch(error){coarse?.dispose();throw error;}
}
export function interpolateShoreAttribute(geometry,triangleIndex,x,z,name){
  const p=geometry.attributes.position,a=geometry.attributes[name],ids=[0,1,2].map(c=>geometry.index.getX(triangleIndex*3+c)),[i,j,k]=ids;
  const ax=p.getX(i),az=p.getZ(i),bx=p.getX(j),bz=p.getZ(j),cx=p.getX(k),cz=p.getZ(k),den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,weights=[u,v,1-u-v];
  return Array.from({length:a.itemSize},(_,c)=>ids.reduce((sum,id,n)=>sum+a.getComponent(id,c)*weights[n],0));
}
export function createShoreBankFineBed(coarse,spec=shoreBankSpec,{bedProfile='r1'}={}){
  validateShoreBankBedProfile(bedProfile);
  const sampler=createTriangleSampler([coarse]),originalColour=new THREE.Color(),coarseForSeam=coarse.clone(),missing=new Map();let fine;
  try{
    const p=coarseForSeam.attributes.position,c=coarseForSeam.attributes.color;
    for(let i=0;i<p.count;i++){const [s,n]=shoreBankCoordinates(p.getX(i),p.getZ(i),spec);if(Math.abs(n)<.002&&Math.abs(s)<spec.halfLength){shoreBankColour(p.getX(i),p.getY(i),p.getZ(i),originalColour.fromBufferAttribute(c,i),originalColour,spec);c.setXYZ(i,...originalColour.toArray());}}
    const hitAt=(x,z)=>{
      const hit=sampler.sample(x,z);if(hit)return hit;
      const key=`${x},${z}`;if(missing.has(key))return missing.get(key);
      // The existing conforming refiner can retain unindexed, rejected
      // Float32 midpoint candidates. Supply only a temporary finite value,
      // then prove that NO returned face uses it and remove every orphan.
      // A rendered vertex outside the actual source is always an error.
      const p=coarse.attributes.position;let nearest=null,distance=Infinity;
      for(let f=0;f<coarse.index.count;f+=3)for(let c=0;c<3;c++){
        const a=coarse.index.getX(f+c),b=coarse.index.getX(f+(c+1)%3),ax=p.getX(a),az=p.getZ(a),dx=p.getX(b)-ax,dz=p.getZ(b)-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)),d=Math.hypot(x-ax-t*dx,z-az-t*dz);
        if(d<distance){distance=d;nearest={a,b,t};}
      }
      if(distance>.00015)fail(`fine vertex leaves the original bed at ${x},${z}`);
      const {a,b,t}=nearest,value={height:THREE.MathUtils.lerp(p.getY(a),p.getY(b),t),colour:[0,1,2].map(c=>THREE.MathUtils.lerp(coarse.attributes.color.getComponent(a,c),coarse.attributes.color.getComponent(b,c),t)),unindexedOnly:true};missing.set(key,value);return value;
    };
    fine=createFineTerrainLand(coarseForSeam,{edgeLength:spec.edgeLength,name:'shore-bank-fine-bed',heightAt:(x,z)=>shoreBankBedHeight(x,z,hitAt(x,z).height,spec,bedProfile),colorAt:(x,y,z)=>{const hit=hitAt(x,z);return shoreBankColour(x,y,z,originalColour.fromArray(hit.colour??interpolateShoreAttribute(coarse,hit.triangleIndex,x,z,'color')),new THREE.Color(),spec);}});
    const used=[...new Set(fine.index.array)].sort((a,b)=>a-b),pFine=fine.attributes.position;
    for(const id of used)if(missing.has(`${pFine.getX(id)},${pFine.getZ(id)}`))fail('a rendered fine vertex leaves the original source; rejected midpoint cannot be used');
    const remap=new Map(used.map((id,i)=>[id,i])),removed=fine.attributes.position.count-used.length;
    if(removed){for(const [name,a] of Object.entries(fine.attributes)){const values=new Float32Array(used.length*a.itemSize);for(let i=0;i<used.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(used[i],c);fine.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}fine.setIndex([...fine.index.array].map(id=>remap.get(id)));fine.userData.boundaryCopies=fine.userData.boundaryCopies.map(p=>({...p,fine:remap.get(p.fine)}));fine.computeBoundingBox();fine.computeBoundingSphere();}
    fine.userData.unindexedRefinementVerticesRemoved=removed;fine.userData.unindexedOutsideSourceCandidates=missing.size;
    fine.userData={...fine.userData,body:'shore-bank-sediment',sourceGeometryUUID:coarse.userData.sourceGeometryUUID,sourceRegionTriangleIndices:[...coarse.userData.sourceTriangleIndices]};return fine;
  }catch(error){fine?.dispose();throw error;}finally{sampler.dispose();coarseForSeam.dispose();}
}

/** Irregular but smooth, closed pebble. Pole fans have one vertex each; no
 * degenerate latitude caps or per-face random colours are used. */
export function createShorePebbleGeometry(seed=1){
  const rings=9,segments=20,positions=[],indices=[],phi=seed*.731;
  positions.push(0,.82,0);
  for(let r=1;r<rings;r++){
    const theta=Math.PI*r/rings;
    for(let j=0;j<segments;j++){
      const a=j*Math.PI*2/segments,rad=Math.sin(theta)*(1+.075*Math.sin(3*a+phi)*Math.sin(theta)+.035*Math.cos(5*a-.5*theta+phi));
      positions.push(rad*Math.cos(a)+.055*Math.sin(theta*2+phi),Math.cos(theta)*.82+.045*Math.sin(a*2+phi)*Math.sin(theta)**2,rad*Math.sin(a)*.88);
    }
  }
  const bottom=positions.length/3;positions.push(0,-.82,0);
  for(let j=0;j<segments;j++)indices.push(0,1+(j+1)%segments,1+j);
  for(let r=0;r<rings-2;r++)for(let j=0;j<segments;j++){const a=1+r*segments+j,b=1+r*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
  for(let j=0;j<segments;j++)indices.push(bottom,1+(rings-2)*segments+j,1+(rings-2)*segments+(j+1)%segments);
  const geometry=new THREE.BufferGeometry();geometry.name=`shore-pebble-${seed}`;geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function shoreGeometryBoundary(geometry){
  const edges=new Map();for(let i=0;i<geometry.index.count;i+=3)for(let c=0;c<3;c++){const a=geometry.index.getX(i+c),b=geometry.index.getX(i+(c+1)%3),key=edgeKey(a,b);if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}return [...edges.values()].filter(e=>e.count===1);
}
