import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {roofTileRollGeometry} from './chinese-architecture-geometry.js';

// These recipes identify the existing frozen prototypes. A candidate only
// changes their subdivision; instance placement and material remain separate.
export const zhengjuesiDistanceTileRecipes=Object.freeze({
  'zhengjuesi-prototype-convex-lap-cover-tile':{radius:.101,thickness:.021,halfLength:.5,bow:.002,rows:3,arcs:14,pan:false},
  'zhengjuesi-prototype-concave-lap-pan-tile':{radius:.119,thickness:.021,halfLength:.5,bow:.002,rows:3,arcs:14,pan:true},
  'zhengjuesi-prototype-wall-coping-tile':{radius:.13,thickness:.025,halfLength:.26,bow:0,rows:2,arcs:14,pan:false},
});
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const area=polygon=>Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
const weights=(triangle,p)=>{const [a,b,c]=triangle,denominator=cross(a,b,c);return [cross(b,c,p)/denominator,cross(c,a,p)/denominator,cross(a,b,p)/denominator];};

function intersection(a,b){
  let polygon=a.map(p=>p.slice());const clip=cross(...b)>0?b:[b[0],b[2],b[1]];
  for(let i=0;i<3&&polygon.length;i++){
    const edge=clip[i],end=clip[(i+1)%3],next=[];
    for(let j=0;j<polygon.length;j++){
      const p=polygon[j],q=polygon[(j+1)%polygon.length],dp=cross(edge,end,p),dq=cross(edge,end,q);
      if(dp>=0)next.push(p);
      if((dp<0)!==(dq<0)){const t=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    polygon=next;
  }
  return polygon;
}

function tileParts(geometry,rows,arcs){
  const count=2*rows*(arcs+1)+8*(rows-1)+8*arcs,position=geometry.attributes.position,index=geometry.index;
  if(!Number.isInteger(rows)||rows<2||!Number.isInteger(arcs)||arcs<2||position?.count!==count||index?.count!==12*(rows-1)*arcs+12*(rows-1)+12*arcs)throw new Error('Tile parameter layout does not match the authored closed sheets, lips and caps.');
  const parts=[],params=new Map();let vertex=0,offset=0;
  function part(name,triangles){
    const items=[];
    for(let i=offset;i<offset+triangles*3;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],uv=ids.map(id=>params.get(id));if(uv.some(p=>!p)||area(uv)<=0)throw new Error('Invalid tile parameter triangle.');items.push({ids,uv,area:area(uv)});}
    offset+=triangles*3;parts.push({name,triangles:items});
  }
  for(const layer of ['outer','inner']){
    for(let row=0;row<rows;row++)for(let column=0;column<=arcs;column++)params.set(vertex++,[column/arcs,row/(rows-1)]);
    part(layer,2*(rows-1)*arcs);
  }
  for(const side of ['lip-left','lip-right']){
    for(let row=0;row<rows-1;row++)for(const uv of [[0,row/(rows-1)],[1,row/(rows-1)],[1,(row+1)/(rows-1)],[0,(row+1)/(rows-1)]])params.set(vertex++,uv);
    part(side,2*(rows-1));
  }
  for(const end of ['cap-start','cap-end']){
    for(let column=0;column<arcs;column++)for(const uv of [[column/arcs,0],[(column+1)/arcs,0],[(column+1)/arcs,1],[column/arcs,1]])params.set(vertex++,uv);
    part(end,2*arcs);
  }
  return parts;
}

function interpolate(geometry,attribute,triangle,uv,target){
  const a=geometry.attributes[attribute],w=weights(triangle.uv,uv);target.fill(0);
  for(let i=0;i<3;i++)for(let c=0;c<a.itemSize;c++)target[c]+=a.array[triangle.ids[i]*a.itemSize+c]*w[i];return target;
}

/** The six corresponding parameter surfaces share a complete [0,1]^2 domain.
 * Intersecting both triangulations makes their displacement affine on each
 * polygon. Its maximum norm is bounded by polygon-vertex norms in BOTH
 * directions, without a nearest-point query selecting the opposite clay face.
 * This is double-precision coverage with a stated guard, not formal interval
 * arithmetic or a proof that lighting/texture filtering has identical pixels. */
export function certifyZhengjuesiTileCorrespondence(source,target,{sourceRows,targetRows}={}){
  const from=tileParts(source,sourceRows,source.userData.curvedSurfaceArcs),to=tileParts(target,targetRows,target.userData.curvedSurfaceArcs),axes=[0,0,0],a=[0,0,0],b=[0,0,0];
  let maximum=0,polygons=0;const coverage=[];
  for(let part=0;part<from.length;part++){
    const aa=from[part].triangles,bb=to[part].triangles,coveredA=new Float64Array(aa.length),coveredB=new Float64Array(bb.length);
    for(let i=0;i<aa.length;i++)for(let j=0;j<bb.length;j++){
      const polygon=intersection(aa[i].uv,bb[j].uv),covered=area(polygon);if(!covered)continue;
      coveredA[i]+=covered;coveredB[j]+=covered;polygons++;
      for(const uv of polygon){interpolate(source,'position',aa[i],uv,a);interpolate(target,'position',bb[j],uv,b);maximum=Math.max(maximum,Math.hypot(...a.map((v,c)=>v-b[c])));for(let c=0;c<3;c++)axes[c]=Math.max(axes[c],Math.abs(a[c]-b[c]));}
    }
    const residual=Math.max(...aa.map((t,i)=>Math.abs(t.area-coveredA[i])),...bb.map((t,i)=>Math.abs(t.area-coveredB[i])));
    if(residual>1e-10)throw new Error(`Incomplete ${from[part].name} tile correspondence.`);
    coverage.push({part:from[part].name,sourceArea:aa.reduce((s,t)=>s+t.area,0),targetArea:bb.reduce((s,t)=>s+t.area,0),maximumAreaResidual:residual});
  }
  const extent=Math.max(1,...source.attributes.position.array.map(Math.abs),...target.attributes.position.array.map(Math.abs)),guard=extent*1e-9;
  return {method:'six-sheet-common-parameter-triangle-overlay-v1',certified:true,maximumError:maximum+guard,axisErrorBounds:axes.map(value=>value+guard),numericalGuard:guard,intersectionPolygons:polygons,coverage,visualLightingAcceptance:false};
}

// The coarse geometry keeps the source normal field sampled at its parameter
// vertices. This preserves curved illumination instead of using a faceted
// normal from the reduced angular polygon. Original texture bytes are untouched.
function transferTileAttributes(source,target,sourceRows,targetRows){
  const from=tileParts(source,sourceRows,source.userData.curvedSurfaceArcs),to=tileParts(target,targetRows,target.userData.curvedSurfaceArcs),normal=[0,0,0],uv=[0,0],done=new Set();
  for(let p=0;p<from.length;p++)for(const t of to[p].triangles)for(let v=0;v<3;v++){
    const id=t.ids[v];if(done.has(id))continue;done.add(id);const param=t.uv[v],match=from[p].triangles.find(triangle=>weights(triangle.uv,param).every(value=>value>=-1e-10&&value<=1+1e-10));
    if(!match)throw new Error('Missing original tile attribute correspondence.');
    interpolate(source,'normal',match,param,normal);const length=Math.hypot(...normal);if(length<=1e-10)throw new Error('Degenerate source tile normal.');target.attributes.normal.setXYZ(id,...normal.map(value=>value/length));
    interpolate(source,'uv',match,param,uv);target.attributes.uv.setXY(id,...uv);
  }
}

function tile(recipe,rows,arcs){
  const points=rows===2?[[0,0,-recipe.halfLength],[0,0,recipe.halfLength]]:[[0,0,-recipe.halfLength],[0,recipe.bow,0],[0,0,recipe.halfLength]];
  const geometry=roofTileRollGeometry(points,recipe.radius,recipe.thickness,arcs);if(recipe.pan)geometry.rotateZ(Math.PI);return geometry;
}

function sameBytes(a,b){
  const aa=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),bb=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);return aa.length===bb.length&&aa.every((value,i)=>value===bb[i]);
}

export function createZhengjuesiDistanceTile(source,{arcs=4,rows=2}={}){
  const recipe=zhengjuesiDistanceTileRecipes[source?.name];if(!recipe||![2,3].includes(rows)||![2,4,7,14].includes(arcs))throw new Error('Unknown or unsupported Zhengjuesi tile recipe.');
  const original=tile(recipe,recipe.rows,recipe.arcs);let target;
  try{
    if(!sameBytes(source.attributes.position.array,original.attributes.position.array)||!sameBytes(source.index.array,original.index.array))throw new Error('Frozen source tile differs from the validated recipe.');
    target=tile(recipe,rows,arcs);const proof=certifyZhengjuesiTileCorrespondence(source,target,{sourceRows:recipe.rows,targetRows:rows});transferTileAttributes(source,target,recipe.rows,rows);
    target.name=`${source.name}-distance-${arcs}x${rows}`;target.userData={...source.userData,curvedSurfaceArcs:arcs,distanceSubdivision:{arcs,rows},sourceNormalFieldPreservedAtVertices:true};
    return {geometry:target,proof,sourceTriangles:source.index.count/3,triangles:target.index.count/3};
  }catch(error){target?.dispose();throw error;}finally{original.dispose();}
}

// Conservative affine transport of an axis-aligned displacement box. It also
// handles reflected, nonuniform and sheared placements, and cannot use only
// one nominal scale when the real instance matrix is different.
export function zhengjuesiDistanceWorldError(axisErrorBounds,matrix){
  const e=matrix.elements;if(axisErrorBounds.length!==3||axisErrorBounds.some(value=>!Number.isFinite(value)||value<0)||e.some(value=>!Number.isFinite(value))||e[3]||e[7]||e[11]||e[15]!==1)throw new Error('Distance error needs finite affine coordinates.');
  const transformed=[0,1,2].map(row=>[0,1,2].reduce((sum,column)=>sum+Math.abs(e[column*4+row])*axisErrorBounds[column],0));return Math.hypot(...transformed);
}

function assertRecipe(source,canonical){
  const a=source.index?.array,b=canonical.index?.array;
  if(!sameBytes(source.attributes.position.array,canonical.attributes.position.array)||!!a!==!!b||(a&&!sameBytes(a,b)))throw new Error('Frozen source geometry differs from the validated recipe.');
}

/** The closed rounded paving lies in the unit cube. The cube inset by its
 * authored round radius lies behind every outward face plane, hence in the
 * star-shaped kernel. Corresponding rays from the origin therefore differ by
 * at most that inset on each axis. No convexity of the triangulated bevel is
 * assumed: slightly non-planar bevel quads can fail a strict convexity check.
 * Flattening the tiny bevel changes its normal/UV field and needs native review. */
export function createZhengjuesiDistanceStone(source){
  if(source?.name!=='zhengjuesi-prototype-dressed-stone')throw new Error('Unknown dressed-stone recipe.');
  const original=new RoundedBoxGeometry(1,1,1,2,.022);let target;
  try{
    assertRecipe(source,original);const p=source.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),guard=1e-7,inset=.478-guard;
    for(let i=0;i<p.count;i++)if(Math.max(Math.abs(p.getX(i)),Math.abs(p.getY(i)),Math.abs(p.getZ(i)))>.5+guard)throw new Error('Stone escapes the enclosing cube.');
    for(let i=0;i<p.count;i+=3){
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);n.subVectors(b,a).cross(c.sub(a)).normalize();
      if(n.lengthSq()<.9)throw new Error('Degenerate stone face.');
      const offset=n.dot(a);if(inset*(Math.abs(n.x)+Math.abs(n.y)+Math.abs(n.z))>offset+1e-10)throw new Error('Stone does not contain the inset cube.');
    }
    target=new THREE.BoxGeometry();target.name=source.name+'-distance-flat-bevel';target.userData={...source.userData,distanceSubdivision:'authored-bevel-replaced-by-enclosing-cube'};
    const delta=.5-inset;
    return {geometry:target,sourceTriangles:p.count/3,triangles:12,proof:{method:'closed-star-kernel-inset-cube-common-ray-v1',certified:true,maximumError:Math.sqrt(3)*delta,axisErrorBounds:[delta,delta,delta],numericalGuard:guard,texturePixelsUnchanged:true,normalAndUVField:'flat faces; bevel field approximated',visualLightingAcceptance:false}};
  }catch(error){target?.dispose();throw error;}finally{original.dispose();}
}

function cylinderRecipe(name){
  const rod=/^zhengjuesi-prototype-rod-(\d+)$/.exec(name);
  if(rod)return {top:1,bottom:1,height:1,arcs:Number(rod[1]),rows:1};
  if(name==='zhengjuesi-prototype-tapered-round-column')return {top:.97,bottom:1,height:1,arcs:28,rows:3};
  if(name==='zhengjuesi-prototype-solid-lotus-tile-end')return {top:.103,bottom:.103,height:.030,arcs:20,rows:1};
  return null;
}

/** A closed polygonal frustum has the same linear height/radius profile at
 * every height, independently of axial subdivisions. Both polygon boundaries
 * have a common angular parameter; linear interpolation of a unit circle has
 * error <= h²/8. Sum the source/target bounds, then include their filled caps.
 * Angular error acts in XZ only; a long thin rod must not inherit its Y scale. */
export function createZhengjuesiDistanceCylinder(source,{arcs=4}={}){
  const recipe=cylinderRecipe(source?.name);if(!recipe||!Number.isInteger(arcs)||arcs<3||arcs>=recipe.arcs)throw new Error('Unknown or unsupported closed cylinder recipe.');
  const original=new THREE.CylinderGeometry(recipe.top,recipe.bottom,recipe.height,recipe.arcs,recipe.rows);let target;
  try{
    assertRecipe(source,original);target=new THREE.CylinderGeometry(recipe.top,recipe.bottom,recipe.height,arcs,1);target.name=source.name+`-distance-${arcs}`;target.userData={...source.userData,distanceSubdivision:{arcs,rows:1}};
    const guard=Math.max(1,recipe.height,recipe.top,recipe.bottom)*1e-7,radial=Math.max(recipe.top,recipe.bottom)*Math.PI**2/2*(1/recipe.arcs**2+1/arcs**2)+guard;
    return {geometry:target,sourceTriangles:source.index.count/3,triangles:target.index.count/3,proof:{method:'closed-frustum-common-height-angle-v1',certified:true,maximumError:Math.hypot(radial,guard),axisErrorBounds:[radial,guard,radial],radialErrorBound:radial,axialErrorBound:guard,numericalGuard:guard,normalAndUVField:'authored analytic circular normals and cylinder UV at reduced angular vertices',visualLightingAcceptance:false}};
  }catch(error){target?.dispose();throw error;}finally{original.dispose();}
}

export function zhengjuesiDistanceCandidateError(candidate,matrix){
  const p=candidate.proof;
  // Validate even the specialized radial case with the general affine check.
  const box=zhengjuesiDistanceWorldError(p.axisErrorBounds,matrix);
  if(p.radialErrorBound===undefined)return box;
  const e=matrix.elements,a=e[0]**2+e[1]**2+e[2]**2,b=e[8]**2+e[9]**2+e[10]**2,c=e[0]*e[8]+e[1]*e[9]+e[2]*e[10],radialScale=Math.sqrt((a+b+Math.hypot(a-b,2*c))/2);
  return Math.min(box,p.radialErrorBound*radialScale+p.axialErrorBound*Math.hypot(e[4],e[5],e[6]));
}

// A building-specific provider for the generic batching pipeline. Every
// returned geometry is newly owned; unknown source prototypes are kept intact.
export function zhengjuesiDistanceCandidates(source){
  const result=[];
  try{
    if(zhengjuesiDistanceTileRecipes[source.name])for(const arcs of [2,4,7])result.push(createZhengjuesiDistanceTile(source,{arcs}));
    else if(source.name==='zhengjuesi-prototype-dressed-stone')result.push(createZhengjuesiDistanceStone(source));
    else if(cylinderRecipe(source.name))for(const arcs of [3,4,6,8].filter(n=>n<cylinderRecipe(source.name).arcs))result.push(createZhengjuesiDistanceCylinder(source,{arcs}));
    return result.sort((a,b)=>a.triangles-b.triangles);
  }catch(error){for(const item of result)item.geometry.dispose();throw error;}
}
