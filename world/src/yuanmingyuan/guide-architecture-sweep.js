import {Box3,DoubleSide,Matrix3,Ray,Vector3} from 'three';
import {convexFootprint} from '../companion-footprint.js';

const EPSILON=1e-8;

// The caller supplies the existing companion sweep's endpoint corners, already
// expanded by the 22 cm skin and rotation sagitta. Their convex XZ hull contains
// the entire segment, including translation and the intervening rotation.
export function createGuideSweepVolume({vertices,from,to,supportSurfaceIds=[]}){
  if(!Array.isArray(vertices)||vertices.length<8||vertices.some(p=>![p.x,p.y,p.z].every(Number.isFinite))||![from?.y,to?.y].every(Number.isFinite))return null;
  const polygon=convexFootprint(vertices);if(polygon.length<3)return null;
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const p of vertices){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);bounds.minZ=Math.min(bounds.minZ,p.z);bounds.maxZ=Math.max(bounds.maxZ,p.z);}
  if(bounds.minY>=bounds.maxY)return null;
  const planes=[[0,-1,0,-bounds.minY],[0,1,0,bounds.maxY]];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    if(!length)continue;
    planes.push([dz/length,0,-dx/length,(dz*a.x-dx*a.z)/length]);
  }
  const interiorPoint=polygon.reduce((sum,p)=>({x:sum.x+p.x/polygon.length,y:sum.y,z:sum.z+p.z/polygon.length}),{x:0,y:(bounds.minY+bounds.maxY)/2,z:0});
  return {planes,bounds,interiorPoint,supportSurfaceIds,minimumSupportY:Math.min(from.y,to.y),maximumSupportY:Math.max(from.y,to.y)};
}

// The architecture owner supplies its original placed records and candidate
// IDs. This function neither allocates a BVH nor owns geometry/materials. A
// triangle is transformed by the true instance matrix and clipped against all
// convex-volume planes, so holes and narrow passages retain their actual shape.
export function intersectsGuideVolume({planes,bounds,interiorPoint,supportSurfaceIds=[],minimumSupportY=-Infinity,maximumSupportY=-Infinity,supportAt,counters},{records,candidateIds}){
  if(!bounds||!['minX','maxX','minY','maxY','minZ','maxZ'].every(key=>Number.isFinite(bounds[key]))||bounds.minX>bounds.maxX||bounds.minY>bounds.maxY||bounds.minZ>bounds.maxZ||!Array.isArray(planes)||planes.length<5||planes.some(p=>!Array.isArray(p)||p.length!==4||!p.every(Number.isFinite)||Math.hypot(...p.slice(0,3))===0))return true;
  if(!Array.isArray(supportSurfaceIds)||supportSurfaceIds.some(id=>typeof id!=='string')||![minimumSupportY,maximumSupportY].every(y=>Number.isFinite(y)||y===-Infinity)||minimumSupportY>maximumSupportY)return true;
  if(supportAt!==undefined&&typeof supportAt!=='function')return true;
  const count=key=>{if(counters)counters[key]=(counters[key]??0)+1;};
  const a=new Vector3(),b=new Vector3(),c=new Vector3(),normal=new Vector3(),normalMatrix=new Matrix3(),localBox=new Box3(),ray=new Ray(),localRay=new Ray();
  const worldBox=new Box3(new Vector3(bounds.minX,bounds.minY,bounds.minZ),new Vector3(bounds.maxX,bounds.maxY,bounds.maxZ)).expandByScalar(EPSILON);
  const centre=interiorPoint?new Vector3(interiorPoint.x,interiorPoint.y,interiorPoint.z):worldBox.getCenter(new Vector3());
  if(!centre.toArray().every(Number.isFinite)||planes.some(([x,y,z,d])=>x*centre.x+y*centre.y+z*centre.z>d+EPSILON))return true;
  let polygon=[],clipped=[];
  function clipTriangle(triangle,record){
    a.copy(triangle.a).applyMatrix4(record.matrix);b.copy(triangle.b).applyMatrix4(record.matrix);c.copy(triangle.c).applyMatrix4(record.matrix);
    polygon.length=0;polygon.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    for(const [nx,ny,nz,d]of planes){
      clipped.length=0;
      let px=polygon.at(-3),py=polygon.at(-2),pz=polygon.at(-1),pd=nx*px+ny*py+nz*pz-d-EPSILON;
      for(let i=0;i<polygon.length;i+=3){
        const x=polygon[i],y=polygon[i+1],z=polygon[i+2],distance=nx*x+ny*y+nz*z-d-EPSILON;
        if((distance<=0)!==(pd<=0)){const t=pd/(pd-distance);clipped.push(px+(x-px)*t,py+(y-py)*t,pz+(z-pz)*t);}
        if(distance<=0)clipped.push(x,y,z);
        px=x;py=y;pz=z;pd=distance;
      }
      [polygon,clipped]=[clipped,polygon];if(!polygon.length)return false;
    }
    return true;
  }
  function supportWitness(record,sourceId){
    count('supportWitnessCandidates');
    // A rounded paver's vertical corner may intersect first. Its XZ projection
    // is a line, whose downward ray can hit the joint below. Find an ACTUAL
    // upward face of this same instance inside the swept hull instead. This is
    // a second sequential shapecast, not a shapecast inside a triangle callback.
    return record.tree.shapecast({
      intersectsBounds:box=>box.intersectsBox(localBox),
      intersectsTriangle(triangle){
        count('supportWitnessTriangles');
        triangle.getNormal(normal).applyNormalMatrix(record.normalMatrix??normalMatrix.getNormalMatrix(record.matrix));
        if(normal.y<=.5||!clipTriangle(triangle,record))return false;
        let top=-Infinity,x=0,y=0,z=0,area=0;const n=polygon.length/3;
        for(let i=0;i<polygon.length;i+=3){
          top=Math.max(top,polygon[i+1]);x+=polygon[i]/n;y+=polygon[i+1]/n;z+=polygon[i+2]/n;
          const j=(i+3)%polygon.length;
          area+=(polygon[i]-polygon[0])*(polygon[j+2]-polygon[2])-(polygon[j]-polygon[0])*(polygon[i+2]-polygon[2]);
        }
        // An unseen higher step is not promoted into support. Retain the old
        // minimum supported height and require a nonzero interior, not a line.
        if(top>minimumSupportY+.002+EPSILON||area===0)return false;
        count('supportWitnessQueries');
        const surface=supportAt(x,z);
        if(surface?.surfaceId!==sourceId||surface.walkable===false||!Number.isFinite(surface.height)||!(surface.normal?.y>.5)||Math.abs(surface.height-y)>1e-5||surface.height>minimumSupportY+.002+EPSILON)return false;
        count('supportWitnessHits');return true;
      },
    });
  }
  // The support callback may fall back to this architecture owner's global
  // index and replace its scratch candidate array. Keep this query's IDs stable.
  for(const id of supportAt?candidateIds.slice():candidateIds){
    const record=records[id];count('candidateScans');
    if(!record.bounds.intersectsBox(worldBox)){count('boundsRejected');continue;}
    localBox.copy(worldBox).applyMatrix4(record.inverse);
    const sourceId=record.instanceId===null?record.mesh?.uuid:record.mesh?`${record.mesh.uuid}:${record.instanceId}`:null;
    let contactCandidate=false;
    function blockedByTriangles(confirmedSupport){
      count('shapecasts');
      return record.tree.shapecast({
      intersectsBounds:box=>box.intersectsBox(localBox),
      intersectsTriangle(triangle){
        count('triangleTests');
        if(!clipTriangle(triangle,record))return false;
        let top=-Infinity;for(let i=1;i<polygon.length;i+=3)top=Math.max(top,polygon[i]);
        triangle.getNormal(normal).applyNormalMatrix(record.normalMatrix??normalMatrix.getNormalMatrix(record.matrix));
        const contact=top<=minimumSupportY+.002+EPSILON||(normal.y>.7&&top<=maximumSupportY+.03+EPSILON);
        if(confirmedSupport&&contact)return false;
        contactCandidate=contact;
        return true;
      },
      });
    }
    const confirmedSupport=sourceId&&supportSurfaceIds.includes(sourceId);
    let blocked=blockedByTriangles(confirmedSupport);
    if(blocked&&!confirmedSupport&&contactCandidate&&sourceId&&supportAt&&supportWitness(record,sourceId))blocked=blockedByTriangles(true);
    if(blocked){count('hits');return true;}
    // An initially embedded actor need not cross a surface during this query.
    // Only an interior point surrounded by outward-facing nearest surfaces in
    // all six directions is conservatively considered enclosed. Inner cavity
    // walls face the point, and a sampled opening/missing hit keeps it clear. This
    // avoids scanning/welding every prototype or filling its complete AABB.
    // It is conservative, not an inside proof for arbitrary open/nonmanifold
    // meshes: an opening missed by all six rays may still be rejected.
    if(record.bounds.containsPoint(centre)){
      let enclosed=true;
      for(const direction of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){
        ray.set(centre,a.set(...direction));localRay.copy(ray).applyMatrix4(record.inverse);count('enclosureRaycasts');
        const hit=record.tree.raycastFirst(localRay,DoubleSide);
        if(!hit||hit.face.normal.dot(localRay.direction)<=1e-10){enclosed=false;break;}
      }
      if(enclosed){count('enclosureHits');count('hits');return true;}
    }
  }
  return false;
}
