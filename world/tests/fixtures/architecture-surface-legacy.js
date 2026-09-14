// Frozen pre-index runtime oracle. Original SHA-256 3cc2a22f61c188900c5905d9c563ac0607ced6a54f44fb968947ea94d0ea8566; only the terrain import path is relocated.
import {Box3,FrontSide,Line3,Matrix3,Matrix4,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createSpatialIndex} from '../../src/yuanmingyuan/terrain-geometry.js';

// Query the rendered static architecture without replacing doorways by a solid
// building box. Indirect BVHs leave the authored mesh/index and its materials intact.
export function createArchitectureSurface(group,{include=mesh=>!mesh.material?.transparent&&mesh.userData.navigation!==false,signal}={}){
  const trees=new Map(),records=[],meshes=new Set(),guideSupports=new Set();let disposed=false,instanceCount=0;
  const instanceMatrix=new Matrix4();
  group.updateWorldMatrix(true,true);
  try{
    group.traverse(mesh=>{
      signal?.throwIfAborted();
      if(!mesh.isMesh||mesh.isSkinnedMesh||!include(mesh))return;
      const geometry=mesh.geometry;if(!geometry.getAttribute('position')?.count)return;
      if(!trees.has(geometry))trees.set(geometry,new MeshBVH(geometry,{indirect:true,setBoundingBox:false}));
      const localBounds=new Box3().setFromBufferAttribute(geometry.getAttribute('position'));
      const count=mesh.isInstancedMesh?mesh.count:1;
      for(let instance=0;instance<count;instance++){
        signal?.throwIfAborted();
        const matrix=mesh.matrixWorld.clone();
        if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,instanceMatrix);matrix.multiply(instanceMatrix);}
        const scale=new Vector3().setFromMatrixScale(matrix),minScale=Math.min(scale.x,scale.y,scale.z);
        // A zero-scale instance contributes no drawn surface. Do not invert a
        // singular placement into an invalid navigation primitive.
        if(minScale<=1e-9)continue;
        const inverse=new Matrix4().copy(matrix).invert(),normalMatrix=new Matrix3().getNormalMatrix(matrix),bounds=localBounds.clone().applyMatrix4(matrix);
        records.push({mesh,tree:trees.get(geometry),matrix,inverse,normalMatrix,bounds,minScale,instanceId:mesh.isInstancedMesh?instance:null});
        meshes.add(mesh);if(mesh.isInstancedMesh)instanceCount++;
      }
    });
  }catch(error){trees.clear();meshes.clear();records.length=0;throw error;}
  const index=createSpatialIndex(records,record=>({minX:record.bounds.min.x,maxX:record.bounds.max.x,minZ:record.bounds.min.z,maxZ:record.bounds.max.z}),16,2);
  const ceiling=records.reduce((top,record)=>Math.max(top,record.bounds.max.y),0)+1;
  const ray=new Ray(),direction=new Vector3(0,-1,0),localRay=new Ray(),point=new Vector3(),normal=new Vector3();
  const segment=new Line3(),queryBox=new Box3(),trianglePoint=new Vector3(),capsulePoint=new Vector3();
  const supportCounts=()=>({queries:0,candidateScans:0,boundsRejected:0,raycasts:0,hits:0}),support=supportCounts();

  function sampleSurface(candidates,x,z,maxY,minY,counts){
    counts.queries++;
    ray.set(point.set(x,maxY,z),direction);let best=null;
    for(const record of candidates){
      counts.candidateScans++;
      if(x<record.bounds.min.x||x>record.bounds.max.x||z<record.bounds.min.z||z>record.bounds.max.z||record.bounds.min.y>maxY||record.bounds.max.y<minY){counts.boundsRejected++;continue;}
      localRay.copy(ray).applyMatrix4(record.inverse);
      counts.raycasts++;
      const hit=record.tree.raycastFirst(localRay,FrontSide);if(!hit)continue;
      point.copy(hit.point).applyMatrix4(record.matrix);
      normal.copy(hit.face.normal).applyNormalMatrix(record.normalMatrix);
      // A ceiling underside must never become a landing surface.
      if(normal.y<=0||point.y>maxY+1e-5||point.y<minY||best&&point.y<=best.height)continue;
      best={height:point.y,normal:normal.clone(),walkable:normal.y>=Math.cos(35*Math.PI/180),surfaceId:record.instanceId===null?record.mesh.uuid:`${record.mesh.uuid}:${record.instanceId}`,source:'rendered-architecture'};
    }
    if(best)counts.hits++;
    return best;
  }

  function surfaceAt(x,z,{maxY=1000,minY=-1000}={}){
    if(maxY===Infinity)maxY=ceiling;
    if(disposed||![x,z,maxY,minY].every(Number.isFinite))return null;
    return sampleSurface(index.at(x,z),x,z,maxY,minY,support);
  }

  // Guide routes have a fixed local footprint and support ceiling. Index the
  // same placed primitives more tightly; never resample their triangles or
  // build another BVH. Records keep their original order for equal-height ties.
  function createGuideSupport(bounds,{maxY=1000,minY=-1000,cellSize=1}={}){
    if(maxY===Infinity)maxY=ceiling;
    if(disposed)throw new Error('Architecture support has been disposed.');
    if(!bounds||![bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ,maxY,minY,cellSize].every(Number.isFinite)||bounds.minX>bounds.maxX||bounds.minZ>bounds.maxZ||minY>maxY||cellSize<=0)throw new Error('Invalid local architecture support bounds.');
    const region={...bounds},selected=records.filter(record=>record.bounds.max.x>=region.minX&&record.bounds.min.x<=region.maxX&&record.bounds.max.z>=region.minZ&&record.bounds.min.z<=region.maxZ&&record.bounds.min.y<=maxY&&record.bounds.max.y>=minY);
    // Clip only the indexing rectangles, including very wide merged floors.
    // The exact original AABB and ray semantics remain in sampleSurface.
    let indexReferences=0;
    const localIndex=createSpatialIndex(selected,record=>{
      const clipped={minX:Math.max(region.minX,record.bounds.min.x),maxX:Math.min(region.maxX,record.bounds.max.x),minZ:Math.max(region.minZ,record.bounds.min.z),maxZ:Math.min(region.maxZ,record.bounds.max.z)};
      indexReferences+=(Math.floor(clipped.maxX/cellSize)-Math.floor(clipped.minX/cellSize)+1)*(Math.floor(clipped.maxZ/cellSize)-Math.floor(clipped.minZ/cellSize)+1);return clipped;
    },cellSize);
    const counts=supportCounts(),sourcePrimitiveCount=records.length;let released=false,fallbackQueries=0;
    const local={
      surfaceAt(x,z,{maxY:queryMaxY=maxY,minY:queryMinY=minY}={}){
        if(queryMaxY===Infinity)queryMaxY=ceiling;
        if(released||disposed||![x,z,queryMaxY,queryMinY].every(Number.isFinite))return null;
        if(x<region.minX||x>region.maxX||z<region.minZ||z>region.maxZ||queryMaxY>maxY||queryMinY<minY){fallbackQueries++;return surfaceAt(x,z,{maxY:queryMaxY,minY:queryMinY});}
        return sampleSurface(localIndex.at(x,z),x,z,queryMaxY,queryMinY,counts);
      },
      snapshot:()=>({...counts,queries:counts.queries+fallbackQueries,localQueries:counts.queries,fallbackQueries,primitiveCount:selected.length,sourcePrimitiveCount,indexReferences,cellSize,disposed:released}),
      dispose(){if(released)return;released=true;localIndex.clear();indexReferences=0;selected.length=0;guideSupports.delete(local);},
    };
    guideSupports.add(local);return local;
  }

  function capsuleBlocked({x,y,z,radius=.32,height=3.28,stepUp=0}){
    if(disposed)return false;
    const candidates=index.at(x,z);
    for(const record of candidates){
      if(record.bounds.max.y<y+.02||record.bounds.min.y>y+height||x+radius<record.bounds.min.x||x-radius>record.bounds.max.x||z+radius<record.bounds.min.z||z-radius>record.bounds.max.z)continue;
      segment.start.set(x,y+radius,z).applyMatrix4(record.inverse);
      segment.end.set(x,y+height-radius,z).applyMatrix4(record.inverse);
      const localRadius=radius/record.minScale;
      queryBox.makeEmpty().expandByPoint(segment.start).expandByPoint(segment.end).expandByScalar(localRadius);
      if(record.tree.shapecast({
        intersectsBounds:bounds=>bounds.intersectsBox(queryBox),
        intersectsTriangle:triangle=>{
          const distance=triangle.closestPointToSegment(segment,trianglePoint,capsulePoint);
          if(distance>=localRadius-1e-5)return false;
          point.copy(trianglePoint).applyMatrix4(record.matrix);
          triangle.getNormal(normal).applyNormalMatrix(record.normalMatrix);
          // Contact with the supporting floor/allowed riser is not a wall hit.
          return point.y>y+stepUp+.012&&!(normal.y>.7&&point.y<=y+.03);
        },
      }))return true;
    }
    return false;
  }
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const local of guideSupports)local.dispose();index.clear();records.length=0;trees.clear();meshes.clear();instanceCount=0;}
  if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
  return {surfaceAt,createGuideSupport,capsuleBlocked,dispose,get diagnostics(){return {meshCount:meshes.size,geometryCount:trees.size,instanceCount,primitiveCount:records.length,support:{...support},localGuideSupports:guideSupports.size,source:'actual-static-mesh-triangles',indirect:true,disposed};}};
}

// Garden wall/bridge rail segments are converted to the existing convex solid
// convention used by the rider and guide controllers. Gate gaps stay gaps.
export function segmentSolid(segment){
  const [ax,az]=segment.from,[bx,bz]=segment.to,dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
  if(!(length>0)||![ax,az,bx,bz,segment.radius,segment.minY,segment.maxY].every(Number.isFinite))throw new Error('Invalid museum wall segment.');
  const ux=dx/length,uz=dz/length,nx=-uz,nz=ux,centreX=(ax+bx)/2,centreZ=(az+bz)/2;
  return {id:segment.id,bottom:segment.minY,top:segment.maxY,walkable:false,planes:[
    [ux,0,uz,ux*centreX+uz*centreZ+length/2],[-ux,0,-uz,-ux*centreX-uz*centreZ+length/2],
    [nx,0,nz,nx*centreX+nz*centreZ+segment.radius],[-nx,0,-nz,-nx*centreX-nz*centreZ+segment.radius],
    [0,1,0,segment.maxY],[0,-1,0,-segment.minY],
  ]};
}
