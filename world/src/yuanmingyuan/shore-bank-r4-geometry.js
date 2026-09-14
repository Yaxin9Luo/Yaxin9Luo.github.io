import * as THREE from 'three';
import {createTriangleSampler} from './terrain-geometry.js';
import {createFineTerrainLand} from './terrain-patch-owner.js';
import {shoreBankSpec,shoreBankCoordinates,shoreBankWorldXZ,shoreBankColour,splitShoreBankBed,interpolateShoreAttribute} from './shore-bank-geometry.js';

export const shoreBankR4=Object.freeze({
  id:'xianfa-shore-bank-curved-r4',bedProfile:'curved-r4',dryMorphLimit:.7,protectedDryLimit:1,
  renderWaterOffset:.006,maximumDatumShift:1.3,
  evidence:'Contemporary museum shore naturalisation; not a surveyed Qing shoreline.',
});
export const shoreBankR4ColourCollarWidth=.45;
// Unequal attached bends. These authored metre offsets are neither a survey
// nor repeated noise; shallow returns preserve the two viewing corridors.
const stations=[[-12,0],[-10.6,.35],[-8,1.3],[-5.8,.82],[-3.7,.32],[-1.1,.68],[1.4,.48],[3.8,.30],[6.6,1.02],[9.2,.58],[12,0]];
const fail=message=>{throw new Error('Shore bank R4: '+message);};
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const hermite=(a,b,ma,mb,t,length)=>{const t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*a+(t3-2*t2+t)*length*ma+(-2*t3+3*t2)*b+(t3-t2)*length*mb;};
const slopes=stations.map((p,i)=>{
  if(i===0||i===stations.length-1)return 0;
  const left=(p[1]-stations[i-1][1])/(p[0]-stations[i-1][0]),right=(stations[i+1][1]-p[1])/(stations[i+1][0]-p[0]);
  if(left*right<=0)return 0;
  const a=p[0]-stations[i-1][0],b=stations[i+1][0]-p[0];return 3*(a+b)/((2*b+a)/left+(b+2*a)/right);
});

export function shoreBankR4Shift(s,spec=shoreBankSpec){
  if(!Number.isFinite(s)||!(spec.halfLength>2))fail('invalid shore station');
  const station=s*12/spec.halfLength;
  if(Math.abs(station)>=12)return 0;
  let i=0;while(stations[i+1][0]<station)i++;
  const a=stations[i],b=stations[i+1],length=b[0]-a[0];return hermite(a[1],b[1],slopes[i],slopes[i+1],(station-a[0])/length,length);
}

/** A monotone coordinate warp across BOTH former dry and wet faces. The old
 * datum point moves lakeward; the dry collar and deep-bed boundary remain
 * identity with derivative one. This cannot make R1's detached raised ridge. */
export function shoreBankR4SourceN(s,n,spec=shoreBankSpec){
  if(!Number.isFinite(n)||spec.wetDepth<=shoreBankR4.maximumDatumShift+.5)fail('invalid transverse shore range');
  const d=shoreBankR4Shift(s,spec),lo=-spec.wetDepth,hi=shoreBankR4.dryMorphLimit;
  if(d===0||n<=lo||n>=hi)return n;
  const middle=-d,left=-lo/(middle-lo),right=hi/(hi-middle);
  // Conservative monotone-Hermite slope bound, retaining derivative one at
  // the two unchanged outer collars for every admitted shift <= 1.3 metres.
  const m=Math.min(2*left*right/(left+right),.95*Math.sqrt(9*left*left-1),.95*Math.sqrt(9*right*right-1));
  return n<middle?hermite(lo,0,1,m,(n-lo)/(middle-lo),middle-lo):hermite(0,hi,m,1,(n-middle)/(hi-middle),hi-middle);
}

function subset(source,ordinals,name){
  const vertices=[],remap=new Map(),indices=[];
  for(const f of ordinals)for(let c=0;c<3;c++){const id=source.index.getX(f*3+c);if(!remap.has(id)){remap.set(id,vertices.length);vertices.push(id);}indices.push(remap.get(id));}
  const geometry=new THREE.BufferGeometry();geometry.name=name;
  for(const [name,a]of Object.entries(source.attributes)){const values=new Float32Array(vertices.length*a.itemSize);for(let i=0;i<vertices.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(vertices[i],c);geometry.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
  geometry.setIndex(indices);geometry.userData={...source.userData,sourceTriangleIndices:ordinals.map(i=>source.userData.sourceTriangleIndices[i]),sourceVertexIndices:vertices.map(i=>source.userData.sourceVertexIndices[i])};geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function splitShoreBankR4Dry(source,spec=shoreBankSpec){
  const p=source.attributes.position,selected=[],outside=[];
  for(let i=0;i<source.index.count/3;i++){
    const sn=[0,1,2].map(c=>{const id=source.index.getX(i*3+c);return shoreBankCoordinates(p.getX(id),p.getZ(id),spec);});
    const touches=Math.min(...sn.map(v=>v[0]))<spec.halfLength&&Math.max(...sn.map(v=>v[0]))>-spec.halfLength&&Math.min(...sn.map(v=>v[1]))<shoreBankR4.dryMorphLimit&&Math.max(...sn.map(v=>v[1]))>-.0001;
    if(touches&&Math.max(...sn.map(v=>v[1]))>=shoreBankR4.protectedDryLimit)fail('selected dry face reaches the protected root strip; a new explicit partition is required');
    (touches?selected:outside).push(i);
  }
  if(!selected.length)fail('no original dry collar faces');
  let coarse;try{coarse=subset(source,selected,'shore-bank-original-dry-collar');return {coarse,outside:subset(source,outside,'shore-bank-retained-dry-land'),selectedOrdinals:selected};}catch(error){coarse?.dispose();throw error;}
}

/** Weld only exactly identical source Float32 XYZ triples. The historical
 * snapshot has eight common seam vertices; no tolerance weld can move them. */
export function mergeShoreBankR4Mother(sources){
  const vertices=[],owners=[],map=new Map(),indices=[],attributes={},formats=Object.entries(sources[0].attributes).map(([name,a])=>[name,a.itemSize]);
  let welded=0;
  for(const source of sources){
    if(formats.some(([name,size])=>source.attributes[name]?.itemSize!==size))fail('source attribute formats differ');
    const p=source.attributes.position,remap=new Map();
    for(let i=0;i<source.index.count;i++){
      const id=source.index.getX(i);if(!remap.has(id)){
        const xyz=[p.getX(id),p.getY(id),p.getZ(id)],key=xyz.map(v=>Object.is(v,-0)?'-0':String(v)).join(',');
        let mapped=map.get(key);if(mapped===undefined){mapped=vertices.length;map.set(key,mapped);vertices.push(xyz);owners.push({source,id});}else if(owners[mapped].source!==source)welded++;
        remap.set(id,mapped);
      }indices.push(remap.get(id));
    }
  }
  if(!welded)fail('dry and bed sources do not have an exact common seam');
  const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let c=0;c<3;c++){const a=indices[i+c],b=indices[i+(c+1)%3],key=edgeKey(a,b),old=edges.get(key);if(old){if(old.a===a||old.count===2)fail('overlapping or nonmanifold original mother faces');old.count++;}else edges.set(key,{a,b,count:1});}
  const geometry=new THREE.BufferGeometry();geometry.name='shore-bank-r4-original-mother';
  for(const [name,size]of formats){const values=new Float32Array(vertices.length*size);for(let i=0;i<owners.length;i++)for(let c=0;c<size;c++)values[i*size+c]=owners[i].source.attributes[name].getComponent(owners[i].id,c);attributes[name]=new THREE.BufferAttribute(values,size);geometry.setAttribute(name,attributes[name]);}
  geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={body:'shore-bank-r4-mother',weldedSeamVertices:welded,sourceMotherFaces:indices.length/3};return geometry;
}

/** Continue the original coarse triangle colour field through a narrow collar.
 * Copying only long boundary-edge endpoints leaves the nonlinear shore colour
 * centimetres away from a different, linearly interpolated edge colour. This
 * blend changes only RGB; its value and first derivative return to the shore
 * target at 45 cm. Source geometry and all of its attributes remain borrowed. */
export function createShoreBankR4ColourCollar(source,width=shoreBankR4ColourCollarWidth){
  if(!source?.index||source.attributes.color?.itemSize!==3||!Number.isFinite(width)||width<=0)fail('invalid source colour collar');
  const p=source.attributes.position,c=source.attributes.color,edges=new Map();
  for(let i=0;i<source.index.count;i+=3)for(let j=0;j<3;j++){const a=source.index.getX(i+j),b=source.index.getX(i+(j+1)%3),key=edgeKey(a,b);if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
  const boundary=[...edges.values()].filter(e=>e.count===1).map(({a,b})=>({a,b,x:p.getX(a),z:p.getZ(a),dx:p.getX(b)-p.getX(a),dz:p.getZ(b)-p.getZ(a)}));
  if(!boundary.length||boundary.some(e=>e.dx*e.dx+e.dz*e.dz===0))fail('source colour collar has no valid outer edges');
  const sampler=createTriangleSampler([source]);let disposed=false;
  return {blend(x,z,target){
    if(disposed)fail('source colour collar has been disposed');
    let distance2=Infinity,nearest=null;
    for(const edge of boundary){const t=Math.max(0,Math.min(1,((x-edge.x)*edge.dx+(z-edge.z)*edge.dz)/(edge.dx*edge.dx+edge.dz*edge.dz))),d=(x-edge.x-t*edge.dx)**2+(z-edge.z-t*edge.dz)**2;if(d<distance2){distance2=d;nearest={...edge,t};}}
    if(distance2>=width*width)return target;
    const distance=Math.sqrt(distance2),hit=sampler.sample(x,z);
    if(!hit&&distance>.00015)fail('colour collar query leaves the source');
    // The refiner's rejected, unindexed Float32 candidates have the same
    // <=0.15 mm edge allowance as sourceAt below; indexed misses still reject.
    const original=hit?interpolateShoreAttribute(source,hit.triangleIndex,x,z,'color'):[0,1,2].map(i=>THREE.MathUtils.lerp(c.getComponent(nearest.a,i),c.getComponent(nearest.b,i),nearest.t));
    const t=distance/width,weight=1-t*t*t*(t*(t*6-15)+10);
    target.r=THREE.MathUtils.lerp(target.r,original[0],weight);target.g=THREE.MathUtils.lerp(target.g,original[1],weight);target.b=THREE.MathUtils.lerp(target.b,original[2],weight);return target;
  },dispose(){if(disposed)return;disposed=true;sampler.dispose();}};
}

/** Small local owner only; caller registers returned geometries. Input source
 * geometries, original terrain, water and plant owners remain borrowed. */
export function createShoreBankR4Ground({land,bed,spec=shoreBankSpec}){
  const owned=new Set(),register=g=>{owned.add(g);return g;};let sampler,motherForSeam,colourCollar;
  try{
    const dry=splitShoreBankR4Dry(land,spec);register(dry.coarse);register(dry.outside);
    const wet=splitShoreBankBed(bed,spec);register(wet.coarse);register(wet.outside);
    const mother=register(mergeShoreBankR4Mother([dry.coarse,wet.coarse]));sampler=createTriangleSampler([dry.coarse,wet.coarse]);
    const color=new THREE.Color(),missing=new Map();motherForSeam=mother.clone();
    for(let i=0;i<motherForSeam.attributes.position.count;i++){const p=motherForSeam.attributes.position,c=motherForSeam.attributes.color;shoreBankColour(p.getX(i),p.getY(i),p.getZ(i),color.fromBufferAttribute(c,i),color,spec);c.setXYZ(i,...color.toArray());}
    colourCollar=createShoreBankR4ColourCollar(motherForSeam);
    const originalHit=(x,z)=>sampler.sample(x,z);
    const sourceAt=(x,z)=>{
      const hit=originalHit(x,z);if(hit)return hit;
      const key=`${x},${z}`;if(missing.has(key))return missing.get(key);
      // The shared refiner can emit unused rejected Float32 candidates. Only
      // those orphans may use an edge value; every indexed miss rejects below.
      const p=mother.attributes.position;let closest=null,distance=Infinity;
      for(let i=0;i<mother.index.count;i+=3)for(let c=0;c<3;c++){const a=mother.index.getX(i+c),b=mother.index.getX(i+(c+1)%3),ax=p.getX(a),az=p.getZ(a),dx=p.getX(b)-ax,dz=p.getZ(b)-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-ax-t*dx,z-az-t*dz);if(d<distance){distance=d;closest={a,b,t};}}
      if(!closest||distance>.00015)fail('fine point leaves the captured mother surface');
      const {a,b,t}=closest,value={height:THREE.MathUtils.lerp(p.getY(a),p.getY(b),t),colour:[0,1,2].map(c=>THREE.MathUtils.lerp(mother.attributes.color.getComponent(a,c),mother.attributes.color.getComponent(b,c),t)),unindexedOnly:true};missing.set(key,value);return value;
    };
    const target=(x,z)=>{
      const base=sourceAt(x,z),[s,n]=shoreBankCoordinates(x,z,spec),sourceN=shoreBankR4SourceN(s,n,spec);
      if(base.unindexedOnly||sourceN===n)return {hit:base,x,z};
      const [sx,sz]=shoreBankWorldXZ(s,sourceN,spec),hit=originalHit(sx,sz);if(!hit)fail('warped query leaves the captured source');return {hit,x:sx,z:sz};
    };
    const fine=register(createFineTerrainLand(motherForSeam,{edgeLength:spec.edgeLength,name:'shore-bank-r4-fine-ground',heightAt:(x,z)=>target(x,z).hit.height,colorAt:(x,y,z)=>{const value=target(x,z),hit=value.hit;return colourCollar.blend(x,z,shoreBankColour(value.x,y,value.z,color.fromArray(hit.colour??interpolateShoreAttribute(hit.geometry,hit.triangleIndex,value.x,value.z,'color')),new THREE.Color(),spec));}}));
    const used=[...new Set(fine.index.array)].sort((a,b)=>a-b),p=fine.attributes.position;
    for(const id of used)if(missing.has(`${p.getX(id)},${p.getZ(id)}`))fail('indexed fine vertex leaves the original mother');
    const removed=p.count-used.length;
    if(removed){const remap=new Map(used.map((id,i)=>[id,i]));for(const [name,a]of Object.entries(fine.attributes)){const values=new Float32Array(used.length*a.itemSize);for(let i=0;i<used.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(used[i],c);fine.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}fine.setIndex([...fine.index.array].map(id=>remap.get(id)));fine.userData.boundaryCopies=fine.userData.boundaryCopies.map(p=>({...p,fine:remap.get(p.fine)}));fine.computeBoundingBox();fine.computeBoundingSphere();}
    fine.userData={...fine.userData,body:'shore-bank-sediment',bedProfile:shoreBankR4.bedProfile,unindexedRefinementVerticesRemoved:removed,unindexedOutsideSourceCandidates:missing.size};
    const sources=[dry,wet].map(split=>({sourceGeometryUUID:split.coarse.userData.sourceGeometryUUID,sourceGeometryName:split.coarse.userData.sourceGeometryName,sourceTriangleIndices:[...split.coarse.userData.sourceTriangleIndices],sourceGeometry:split.coarse,retainedGeometry:split.outside,originalSelectedOrdinals:split.selectedOrdinals}));
    return {geometry:fine,sourceGeometry:mother,sources,geometries:[...owned],diagnostics:{...shoreBankR4,motherFaces:mother.index.count/3,replacedDryFaces:dry.coarse.index.count/3,replacedBedFaces:wet.coarse.index.count/3,weldedSeamVertices:mother.userData.weldedSeamVertices,protectedDryFacesUnchanged:true,wholeOriginalDryTopologyPreserved:false,colourCollar:{width:shoreBankR4ColourCollarWidth,source:'original triangle RGB interpolation',changedAttributes:['color']}}};
  }catch(error){for(const g of owned)g.dispose();throw error;}finally{sampler?.dispose();colourCollar?.dispose();motherForSeam?.dispose();}
}

/** Intersect the SAME Float32 fine triangles that render and support contact.
 * The +6mm plane is the existing Reflector's position, not a new water level. */
export function createShoreBankR4Waterline(geometry,spec=shoreBankSpec){
  const segments=[],graph=new Map(),meshEdges=new Map(),p=geometry.attributes.position,y=spec.waterY+shoreBankR4.renderWaterOffset;
  for(let i=0;i<geometry.index.count;i+=3){
    const crossings=new Map();for(let c=0;c<3;c++){
      let a=geometry.index.getX(i+c),b=geometry.index.getX(i+(c+1)%3);if(a>b)[a,b]=[b,a];
      const edge=edgeKey(a,b);meshEdges.set(edge,(meshEdges.get(edge)??0)+1);
      const ay=p.getY(a)-y,by=p.getY(b)-y;
      if(ay===0&&by===0)fail('water plane coincides with an edge; an explicit contour partition is required');
      if((ay<0)===(by<0))continue;
      const t=ay/(ay-by),x=THREE.MathUtils.lerp(p.getX(a),p.getX(b),t),z=THREE.MathUtils.lerp(p.getZ(a),p.getZ(b),t),key=ay===0?`vertex:${a}`:by===0?`vertex:${b}`:edge;
      crossings.set(key,{key,edge,point:shoreBankCoordinates(x,z,spec)});
    }
    if(crossings.size===2){
      const [a,b]=[...crossings.values()];segments.push([a.point,b.point,i/3]);
      for(const [u,v]of [[a,b],[b,a]]){if(!graph.has(u.key))graph.set(u.key,{point:u.point,edge:u.edge,adjacent:[]});graph.get(u.key).adjacent.push(v.key);}
    }
  }
  if(!segments.length)fail('fine geometry does not intersect the original render water plane');
  // A shoreline may double back in s while remaining one continuous curve.
  // Detect the actual R1 failure (a detached/closed strip) with the triangle
  // edge graph, not by incorrectly requiring a globally single-valued n(s).
  const seen=new Set();let components=0;
  for(const key of graph.keys())if(!seen.has(key)){components++;const queue=[key];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...graph.get(id).adjacent);}}
  const ends=[...graph.values()].filter(v=>v.adjacent.length===1);
  if(components!==1||ends.length!==2||[...graph.values()].some(v=>v.adjacent.length>2)||ends.some(v=>meshEdges.get(v.edge)!==1))fail('waterline has disconnected strips, a closed island, or an internal open seam');
  if(Math.min(...ends.map(v=>v.point[0]))>-spec.halfLength||Math.max(...ends.map(v=>v.point[0]))<spec.halfLength)fail('connected waterline does not span the complete authored shore');
  const at=(segment,s)=>{const [a,b]=segment;return THREE.MathUtils.lerp(a[1],b[1],Math.max(0,Math.min(1,(s-a[0])/(b[0]-a[0]))));};
  // Report every overlapping interval, including small connected backtracks;
  // do not hide them behind the later 111 anchor samples or average error.
  const ordered=segments.filter(([a,b])=>Math.abs(b[0]-a[0])>=1e-12).map(segment=>({segment,lo:Math.max(-spec.halfLength,Math.min(segment[0][0],segment[1][0])),hi:Math.min(spec.halfLength,Math.max(segment[0][0],segment[1][0]))})).filter(v=>v.lo<=v.hi).sort((a,b)=>a.lo-b.lo);
  let active=[],maximumTransverseBacktrack=0;
  for(const entry of ordered){active=active.filter(old=>old.hi>=entry.lo-1e-8);for(const old of active){const lo=Math.max(entry.lo,old.lo),hi=Math.min(entry.hi,old.hi);if(hi<lo-1e-8)continue;for(const s of [lo,Math.max(lo,hi)])maximumTransverseBacktrack=Math.max(maximumTransverseBacktrack,Math.abs(at(entry.segment,s)-at(old.segment,s)));}active.push(entry);}
  const sample=s=>{let n=null;for(const [a,b]of segments){if(s<Math.min(a[0],b[0])-1e-8||s>Math.max(a[0],b[0])+1e-8)continue;const span=b[0]-a[0];if(Math.abs(span)<1e-12)continue;const value=THREE.MathUtils.lerp(a[1],b[1],Math.max(0,Math.min(1,(s-a[0])/span)));n=n===null?value:Math.min(n,value);}
    if(n===null)fail('stone station has no actual fine-water intersection');return Math.min(0,n);
  };
  sample.diagnostics={segments:segments.length,components,endpoints:ends.map(v=>v.point),allOverlappingIntervalsChecked:true,maximumTransverseBacktrack,gravelRule:'outermost existing-water intersection',renderPlaneY:y,waterDatum:spec.waterY};return sample;
}
