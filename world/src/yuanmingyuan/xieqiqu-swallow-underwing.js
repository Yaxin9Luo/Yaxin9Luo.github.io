import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createCopperSwallowWingGeometry} from './xieqiqu-copper-swallow.js';
import {createSwallowFeather,swallowWingHalfThickness,swallowWingHeight} from './xieqiqu-swallow-feathers.js';
import {applySwallowPose} from './xieqiqu-swallow-pose.js';

export const swallowUnderwingParameters=Object.freeze({
  version:'underwing-coverts-r3',secondaryCount:9,primaryCount:6,lesserCount:10,
  carrier:'unchanged actual wing triangles; short coverts rest on actual long-covert triangles',tipCentreClearance:.0003,
  halfThickness:.0014,camber:.0005,engravedCuts:3,cutDepth:.00032,
  secondaryVaneHeight:.019,primaryVaneHeight:.015,lesserVaneHeight:.014,
  shaftWidthFraction:.20,shaftHeight:.0045,freeTipClearance:.004,
  evidence:'authored copper feather arrangement; historical underside not documented',
});
const abort=signal=>{if(signal?.aborted)throw new DOMException('Underwing preparation aborted','AbortError');};

function carrierSurface(geometry,side){
  const tree=new MeshBVH(geometry,{indirect:true}),ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,1,0)),p=geometry.attributes.position,{rings,outlineSamples:sides}=geometry.userData,layerCount=1+rings*sides,rim=Array.from({length:sides},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,layerCount+1+(rings-1)*sides+j));
  return {
    height(x,z){ray.origin.set(x,geometry.boundingBox.min.y-.1,z);const hit=tree.raycastFirst(ray,THREE.DoubleSide);if(!hit||hit.face.normal.y>=0)throw new Error(`Underwing feather leaves the actual lower carrier at ${x},${z}`);return hit.point.y;},
    section(x){const zs=[];for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length],ax=side*a.x,bx=side*b.x;if((ax<=x&&bx>x)||(bx<=x&&ax>x))zs.push(THREE.MathUtils.lerp(a.z,b.z,(x-ax)/(bx-ax)));}if(zs.length!==2)throw new Error('Underwing section must cross the actual rim twice');return {front:Math.max(...zs),rear:Math.min(...zs)};},
  };
}

function featherLayout(side,surface){
  const parts=[],makePoint=(x,fraction)=>{const edge=surface.section(x),z=THREE.MathUtils.lerp(edge.front,edge.rear,fraction);return [side*x,-surface.height(side*x,z)-swallowWingHalfThickness(x),z];};
  for(const [tier,count]of [['secondary',9],['primary',6],['lesser',10]])for(let i=0;i<count;i++){
    const secondary=tier==='secondary',primary=tier==='primary',x=secondary?.135+i*.047:primary?.56+i*.054:.145+i*.057,root=makePoint(x,secondary?.29:primary?.25:.10),tip=makePoint(x+(secondary?.062:primary?.085:.043),secondary?.91:primary?.86:.58);tip[1]+=swallowWingHalfThickness(tip[0])+swallowUnderwingParameters.tipCentreClearance;
    parts.push({id:`underwing-${side}-${tier}-${i}`,tier,side,root,tip,width:secondary?.031-i*.001:primary?.023-i*.0015:.028-i*.0006,halfThickness:secondary?.0016:.0013,camber:.0005,steps:96,sides:40,vaneHeight:secondary?swallowUnderwingParameters.secondaryVaneHeight:primary?swallowUnderwingParameters.primaryVaneHeight:swallowUnderwingParameters.lesserVaneHeight});
  }
  return parts;
}

/** Keep the original closed lenticular topology and broad integral shaft.
 * Replace its repeated micro-barbs only on this new part with three shallow
 * paired cuts. This never edits an existing source feather or its producer. */
function engraveUnderwingFeather(geometry){
  const p=geometry.attributes.position,{steps,sides}=geometry.userData,positive=new THREE.Vector3(),negative=new THREE.Vector3(),up=new THREE.Vector3(),point=new THREE.Vector3();
  for(let row=0;row<=steps;row++){
    const t=row/steps;positive.fromBufferAttribute(p,row*sides+sides/4);negative.fromBufferAttribute(p,row*sides+sides*3/4);up.subVectors(positive,negative).normalize();
    for(let j=0;j<sides;j++){
      const angle=j/sides*Math.PI*2,v=Math.cos(angle),out=Math.sin(angle),old=.00023*Math.sin((t*17+Math.abs(v)*.8)*Math.PI*2)*Math.sin(Math.PI*t)*out*out;
      let cut=0;for(const centre of [.35,.56,.77])cut-=swallowUnderwingParameters.cutDepth*Math.exp(-(((t-centre+Math.abs(v)*.07)/.022)**2))*(1-v*v)*Math.max(0,out)**2;
      point.fromBufferAttribute(p,row*sides+j).addScaledVector(up,cut-old);p.setXYZ(row*sides+j,point.x,point.y,point.z);
    }
  }
}

function translateFeatherRing(geometry,row,offset){
  const p=geometry.attributes.position,{steps,sides,poseCapSeams}=geometry.userData,point=new THREE.Vector3();
  for(let j=0;j<sides;j++){point.fromBufferAttribute(p,row*sides+j).add(offset);p.setXYZ(row*sides+j,point.x,point.y,point.z);}
  if(row===0||row===steps){
    for(let j=0;j<sides;j++){point.fromBufferAttribute(p,row*sides+j);p.setXYZ(poseCapSeams.originalVertices+(row===steps?sides:0)+j,point.x,point.y,point.z);}
    const cap=(steps+1)*sides+(row===steps?1:0);point.fromBufferAttribute(p,cap).add(offset);p.setXYZ(cap,point.x,point.y,point.z);
  }
}

/** Broad cast vanes and an integral rounded shaft, with real thin free tips.
 * Root rings stay embedded; raised rear sections are connected closed shells. */
function shapeLayeredUnderwingFeather(geometry,spec){
  const p=geometry.attributes.position,{steps,sides}=geometry.userData,outer=new THREE.Vector3(),inner=new THREE.Vector3(),outward=new THREE.Vector3(),point=new THREE.Vector3(),offset=new THREE.Vector3();
  for(let row=1;row<=steps;row++){
    outer.fromBufferAttribute(p,row*sides+sides/4);inner.fromBufferAttribute(p,row*sides+sides*3/4);outward.subVectors(outer,inner).normalize();
    const t=row/steps,longitudinal=Math.sin(Math.PI*t)**1.15*THREE.MathUtils.smoothstep(t,.08,.22),tipLift=swallowUnderwingParameters.freeTipClearance*THREE.MathUtils.smoothstep(t,.55,1);
    translateFeatherRing(geometry,row,offset.copy(outward).multiplyScalar(tipLift));
    for(let j=1;j<sides/2;j++){
      const angle=2*Math.PI*j/sides,v=Math.cos(angle),across=Math.sin(angle),vane=spec.vaneHeight*across**1.35*(1+.22*v*spec.side),shaft=swallowUnderwingParameters.shaftHeight*Math.exp(-((v/swallowUnderwingParameters.shaftWidthFraction)**2))*across*across;
      point.fromBufferAttribute(p,row*sides+j).addScaledVector(outward,longitudinal*(vane+shaft));p.setXYZ(row*sides+j,point.x,point.y,point.z);
    }
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

/** Short coverts bridge long-feather edges with a smooth rooted curve. Its
 * offset is set by real parent intersections and has an actual contact witness;
 * it does not copy every lower feather edge into a kink in the upper vane. */
function fitShortCovertToParent(geometry,parent){
  const p=geometry.attributes.position,{steps,sides}=geometry.userData,ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,1,0)),inner=new THREE.Vector3(),offset=new THREE.Vector3(),contacts=[];let amplitude=0,witness=null;
  for(let row=1;row<=steps;row++){
    inner.fromBufferAttribute(p,row*sides+sides*3/4);ray.origin.set(inner.x,parent.geometry.boundingBox.min.y-.1,inner.z);const hit=parent.tree.raycastFirst(ray,THREE.DoubleSide);
    if(!hit)throw new Error('Short underwing covert leaves its actual parent surface');
    const needed=inner.y-hit.point.y-.0003;
    if(needed>amplitude){amplitude=needed;witness={row,parentPoint:hit.point.toArray(),triangle:hit.faceIndex};}
    contacts.push({row,parentY:hit.point.y,originalInnerY:inner.y,needed});
  }
  // Use the actual tallest overlapping vane as a contact, not a scaled-up
  // maximum divided by a near-zero root weight. The root-to-contact curve has
  // zero endpoint slopes, while earlier intersections remain a cast joint.
  const onset=contacts.find(c=>c.needed>Math.max(.003,amplitude*.25)),start=Math.max(0,(onset?.row??steps)/steps-.15),end=(witness?.row??steps)/steps;
  for(const contact of contacts){const weight=THREE.MathUtils.smoothstep(contact.row/steps,start,end),dy=-amplitude*weight;translateFeatherRing(geometry,contact.row,offset.set(0,dy,0));contact.innerY=p.getY(contact.row*sides+sides*3/4);contact.gap=contact.parentY-contact.innerY;contact.weight=weight;}
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.parentContacts=contacts;geometry.userData.parentSupport={amplitude,start,end,witness,construction:'smooth rooted bridge with actual parent contact; embedded root and earlier intersections are retained'};
}

/** A bounded one-wing construction. The returned real feathers are owned by
 * the caller; the temporary untouched source carrier is always disposed. */
export function createSwallowUnderwingFeatherParts(side,{signal}={}){
  if(![-1,1].includes(side))throw new Error('Underwing side must be -1 or 1');abort(signal);
  const carrier=createCopperSwallowWingGeometry(side),parts=[];let current,parentGeometry,posedCarrier;
  try{
    // Use the original smooth wing field for section tangents. Differentiating
    // its coarse carrier triangles over 0.1 mm made adjacent rings twist at a
    // triangle seam. Actual root/tip placement and layer contacts still query
    // the retained triangles; only the newly authored vane frame is smooth.
    const surface=carrierSurface(carrier,side),height=(x,z)=>-swallowWingHeight(x,z),specs=featherLayout(side,surface);let parent;
    for(const spec of specs){
      if(spec.tier==='lesser'&&!parent){
        posedCarrier=carrier.clone();applySwallowPose(posedCarrier,'wing');parentGeometry=mergeGeometries([posedCarrier,...parts.map(p=>p.geometry)],false);posedCarrier.dispose();posedCarrier=null;if(!parentGeometry)throw new Error('Unable to build actual underwing parent surface');parentGeometry.name='underwing-short-covert-contact-parent';parentGeometry.computeBoundingBox();parent={geometry:parentGeometry,tree:new MeshBVH(parentGeometry,{indirect:true})};
      }
      abort(signal);current=createSwallowFeather({...spec,name:'swallow-'+spec.id,surfaceHeight:height});engraveUnderwingFeather(current);
      // Reflection changes handedness. Reverse every real triangle before the
      // existing wrist/forearm pose recomputes its actual outward normals.
      current.scale(1,-1,1);const index=current.index;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}index.needsUpdate=true;
      const p=current.attributes.position,uv=current.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)*.8,(p.getY(i)+p.getZ(i))*.5);
      applySwallowPose(current,'feather');shapeLayeredUnderwingFeather(current,spec);if(parent)fitShortCovertToParent(current,parent);
      const root=new THREE.Vector3().fromBufferAttribute(current.attributes.position,(spec.steps+1)*spec.sides),tip=new THREE.Vector3().fromBufferAttribute(current.attributes.position,(spec.steps+1)*spec.sides+1);
      current.userData={...current.userData,underwing:{...swallowUnderwingParameters,tier:spec.tier,root:root.toArray(),tip:tip.toArray()}};parts.push({id:spec.id,tier:spec.tier,geometry:current});current=null;
    }
    abort(signal);return parts;
  }catch(error){current?.dispose();for(const part of parts)part.geometry.dispose();throw error;}finally{posedCarrier?.dispose();parentGeometry?.dispose();carrier.dispose();}
}

/** One extra draw per wing, every feather surface/index retained. The original
 * 79-component short-neck sculpture is supplied separately by its owner. */
export function createSwallowUnderwingGeometry(side,{signal}={}){
  const parts=createSwallowUnderwingFeatherParts(side,{signal});let geometry;
  try{
    abort(signal);geometry=mergeGeometries(parts.map(p=>p.geometry),false);if(!geometry)throw new Error('Underwing feather merge failed');geometry.name=`swallow-underwing-coverts-${side}`;
    let first=0;const components=parts.map(p=>{const entry={id:p.id,tier:p.tier,firstIndex:first,indexCount:p.geometry.index.count};first+=entry.indexCount;return entry;});
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={underwing:{...swallowUnderwingParameters,side,components,closedComponents:parts.length},pose:'unchanged existing wing pose'};abort(signal);return geometry;
  }catch(error){geometry?.dispose();throw error;}finally{for(const part of parts)part.geometry.dispose();}
}
