import {Box3,FrontSide,Line3,Matrix3,Matrix4,Ray,Triangle,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createSpatialIndex} from './terrain-geometry.js';
import {intersectsGuideVolume as intersectsGuideVolumeRecords} from './guide-architecture-sweep.js';

// A broad grid cell can contain thousands of decorative instances. This tree
// rejects only unions of their exact stored AABBs; leaf candidates retain the
// original record order before the unchanged ray/triangle tests run.
function createRecordIndex(records){
  const leafSize=8,found=[],pending=[];let nodeCount=0,root;
  const counts={queries:0,nodesVisited:0,nodesRejected:0,leafRecordsVisited:0,legacyCellRejected:0};
  function build(ids){
    if(!ids.length)return null;
    const node={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
    let minCX=Infinity,maxCX=-Infinity,minCY=Infinity,maxCY=-Infinity,minCZ=Infinity,maxCZ=-Infinity;
    for(const id of ids){
      const b=records[id].bounds,cx=b.min.x+b.max.x,cy=b.min.y+b.max.y,cz=b.min.z+b.max.z;
      node.minX=Math.min(node.minX,b.min.x);node.maxX=Math.max(node.maxX,b.max.x);node.minY=Math.min(node.minY,b.min.y);node.maxY=Math.max(node.maxY,b.max.y);node.minZ=Math.min(node.minZ,b.min.z);node.maxZ=Math.max(node.maxZ,b.max.z);
      minCX=Math.min(minCX,cx);maxCX=Math.max(maxCX,cx);minCY=Math.min(minCY,cy);maxCY=Math.max(maxCY,cy);minCZ=Math.min(minCZ,cz);maxCZ=Math.max(maxCZ,cz);
    }
    nodeCount++;
    if(ids.length<=leafSize)node.ids=ids;
    else{
      const axis=maxCX-minCX>=maxCY-minCY&&maxCX-minCX>=maxCZ-minCZ?'x':maxCY-minCY>=maxCZ-minCZ?'y':'z';
      ids.sort((a,b)=>{const aa=records[a].bounds,bb=records[b].bounds;return (aa.min[axis]+aa.max[axis])-(bb.min[axis]+bb.max[axis])||a-b;});
      const middle=Math.floor(ids.length/2);node.left=build(ids.slice(0,middle));node.right=build(ids.slice(middle));
    }
    return node;
  }
  root=build(records.map((_,index)=>index));
  return {
    // Private scratch arrays are consumed synchronously by one query. No
    // candidate arrays escape through the public architectural surface API.
    query(minX,maxX,minY,maxY,minZ,maxZ,legacyCellX,legacyCellZ){
      counts.queries++;found.length=0;pending.length=0;if(root)pending.push(root);
      while(pending.length){
        const node=pending.pop();counts.nodesVisited++;
        if(node.maxX<minX||node.minX>maxX||node.maxY<minY||node.minY>maxY||node.maxZ<minZ||node.minZ>maxZ){counts.nodesRejected++;continue;}
        if(node.ids)for(const id of node.ids){
          counts.leafRecordsVisited++;
          // Preserve the old 16 m grid's 2 m padding for unusually large
          // capsule radii too; this changes candidate cost, not its contract.
          if(legacyCellX!==undefined){const b=records[id].bounds;if(legacyCellX<Math.floor((b.min.x-2)/16)||legacyCellX>Math.floor((b.max.x+2)/16)||legacyCellZ<Math.floor((b.min.z-2)/16)||legacyCellZ>Math.floor((b.max.z+2)/16)){counts.legacyCellRejected++;continue;}}
          found.push(id);
        }else{pending.push(node.right,node.left);}
      }
      found.sort((a,b)=>a-b);return found;
    },
    snapshot:()=>({...counts,kind:'exact-record-aabb-hierarchy',nodeCount,recordCount:records.length,leafSize}),
    clear(){root=null;nodeCount=0;found.length=0;pending.length=0;},
  };
}

const GUIDE_TRIANGLE_FALLBACK=Symbol('guide-triangle-fallback');
// At least the existing world-hit comparison allowance. This inflates only
// candidate height bounds; returned support is never raised or rounded.
const GUIDE_HEIGHT_BOUND_SLACK=1e-5;

// A local, static broad phase over the ORIGINAL placed triangles. XZ arithmetic
// only selects a candidate. The returned point is still computed by Three's
// original local-space Ray/triangle operation. Uncertain edges, height ordering
// and unusual transforms retain the original BVH path and its tie ordering.
function createGuideTriangleIndex(records,region,minY,maxY,cellSize,signal){
  const triangles=[],worldClip=new Box3(new Vector3(region.minX,minY,region.minZ),new Vector3(region.maxX,maxY,region.maxZ));
  const localClip=new Box3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3(),rawNormal=new Vector3(),normal=new Vector3();
  const localDown=new Vector3(),down=new Vector3(0,-1,0),ray=new Ray(),localRay=new Ray(),point=new Vector3(),origin=new Vector3();
  let extractedTriangles=0,indexReferences=0,unsafeTriangles=0,disposed=false,orderedCells=new WeakSet();
  const linearNorm=m=>{const e=m.elements;return Math.max(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]),Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]),Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]));};
  const overlap=(t,padding=0)=>t.maxX>=region.minX-padding&&t.minX<=region.maxX+padding&&t.maxZ>=region.minZ-padding&&t.minZ<=region.maxZ+padding;
  function add(triangle){
    if(!overlap(triangle,triangle.positionError))return;
    if(triangle.unsafe)unsafeTriangles++;
    triangles.push(triangle);
  }
  for(const record of records){
    signal?.throwIfAborted();
    const e=record.matrix.elements,condition=linearNorm(record.matrix)*linearNorm(record.inverse);
    const rb=record.bounds;
    const magnitude=Math.max(1,...e.map(Math.abs),...rb.min.toArray().map(Math.abs),...rb.max.toArray().map(Math.abs),Math.abs(region.minX),Math.abs(region.maxX),Math.abs(region.minZ),Math.abs(region.maxZ),Math.abs(minY),Math.abs(maxY));
    // This is a slow-path error envelope, never an extension of support. Do
    // not optimize projective/singular or badly conditioned placements.
    const positionError=Math.max(1e-8,512*Number.EPSILON*magnitude*(1+condition));
    if(!Number.isFinite(condition)||condition<=0||condition>1e6||magnitude>1e9||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1){
      add({record,unsafe:true,positionError:1e-8,minX:rb.min.x,maxX:rb.max.x,minZ:rb.min.z,maxZ:rb.max.z});continue;
    }
    const position=record.mesh.geometry.getAttribute('position'),indices=record.mesh.geometry.index;
    localDown.copy(down).transformDirection(record.inverse);
    // Reuse the already-owned BVH and its actual group/drawRange coverage.
    // The inverse-transformed world AABB is conservative under affine placement.
    localClip.copy(worldClip).expandByScalar(positionError).applyMatrix4(record.inverse);
    record.tree.shapecast({
      intersectsBounds:bounds=>bounds.intersectsBox(localClip),
      intersectsTriangle(triangle,triangleIndex){
        extractedTriangles++;
        // Use the same unnormalised cross/dot as Ray.intersectTriangle for
        // culling. A face-normal threshold must not expose a floor below it.
        ab.subVectors(triangle.b,triangle.a);ac.subVectors(triangle.c,triangle.a);rawNormal.crossVectors(ab,ac);
        if(localDown.dot(rawNormal)>=0)return false;
        Triangle.getNormal(triangle.a,triangle.b,triangle.c,normal).applyNormalMatrix(record.normalMatrix);
        a.copy(triangle.a).applyMatrix4(record.matrix);b.copy(triangle.b).applyMatrix4(record.matrix);c.copy(triangle.c).applyMatrix4(record.matrix);
        const bounds={minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
        if(Math.min(a.y,b.y,c.y)>maxY+positionError||Math.max(a.y,b.y,c.y)<minY-positionError)return false;
        const abx=b.x-a.x,abz=b.z-a.z,acx=c.x-a.x,acz=c.z-a.z,denominator=abx*acz-abz*acx;
        const projectedScale=Math.abs(abx*acz)+Math.abs(abz*acx);
        const upperY=Math.max(a.y,b.y,c.y)+Math.max(positionError,GUIDE_HEIGHT_BOUND_SLACK);
        const unsafe=!Number.isFinite(upperY)||!Number.isFinite(denominator)||Math.abs(denominator)<=128*Number.EPSILON*projectedScale||Math.abs(denominator)<1e-12||normal.y<=1e-6;
        if(unsafe){add({record,unsafe:true,positionError,...bounds});return false;}
        const offset=triangleIndex*3;
        add({record,position,ia:indices?indices.getX(offset):offset,ib:indices?indices.getX(offset+1):offset+1,ic:indices?indices.getX(offset+2):offset+2,
          ax:a.x,ay:a.y,az:a.z,abx,abz,acx,acz,by:b.y-a.y,cy:c.y-a.y,denominator,projectedScale,normal:normal.clone(),positionError,upperY,...bounds});
        return false;
      },
    });
  }
  const index=createSpatialIndex(triangles,t=>{
    const padding=t.positionError,box={minX:Math.max(region.minX,t.minX-padding),maxX:Math.min(region.maxX,t.maxX+padding),minZ:Math.max(region.minZ,t.minZ-padding),maxZ:Math.min(region.maxZ,t.maxZ+padding)};
    indexReferences+=(Math.floor(box.maxX/cellSize)-Math.floor(box.minX/cellSize)+1)*(Math.floor(box.maxZ/cellSize)-Math.floor(box.minZ/cellSize)+1);return box;
  },cellSize);
  const counts={projectedQueries:0,triangleCandidates:0,triangleBoundsRejected:0,preciseTriangleTests:0,triangleFallbackQueries:0,heightEarlyStops:0,heightPrunedCandidates:0,heightSortedCells:0};
  const heightOrder=(a,b)=>Boolean(a.unsafe)!==Boolean(b.unsafe)?a.unsafe?-1:1:a.unsafe?0:b.upperY-a.upperY;
  const fallback=()=>{counts.triangleFallbackQueries++;return GUIDE_TRIANGLE_FALLBACK;};
  return {
    sample(x,z,ceiling,bottom){
      if(disposed)return null;
      counts.projectedQueries++;let best=null,bestHeight=-Infinity,bestError=0,runnerUp=-Infinity;
      const candidates=index.at(x,z);
      // Order only cells actually visited. Sorting the entire multi-million
      // triangle store would add cold-start work for mostly unused regions.
      // Unsafe entries precede every safe entry, even below a valid winner.
      if(candidates.length&&!orderedCells.has(candidates)){candidates.sort(heightOrder);orderedCells.add(candidates);counts.heightSortedCells++;}
      for(let i=0;i<candidates.length;i++){
        const t=candidates[i];
        // A strict separation of conservative intervals is required. Equal
        // heights, competing error intervals and upper-edge uncertainty still
        // reach the original checks/fallback. A final original Ray/triangle
        // intersection below must verify the selected candidate as before.
        if(!t.unsafe&&best&&t.upperY<bestHeight-bestError){counts.heightEarlyStops++;counts.heightPrunedCandidates+=candidates.length-i;break;}
        counts.triangleCandidates++;const r=t.record.bounds,padding=t.positionError;
        if(x<r.min.x||x>r.max.x||z<r.min.z||z>r.max.z||r.min.y>ceiling||r.max.y<bottom||x<t.minX-padding||x>t.maxX+padding||z<t.minZ-padding||z>t.maxZ+padding){counts.triangleBoundsRejected++;continue;}
        if(t.unsafe)return fallback();
        const dx=x-t.ax,dz=z-t.az,sign=t.denominator<0?-1:1,area=Math.abs(t.denominator);
        const bu=(dx*t.acz-dz*t.acx)*sign,cv=(t.abx*dz-t.abz*dx)*sign,aw=area-bu-cv;
        const edgeError=16*padding*(Math.abs(t.abx)+Math.abs(t.abz)+Math.abs(t.acx)+Math.abs(t.acz)+Math.abs(dx)+Math.abs(dz))+
          64*Number.EPSILON*(t.projectedScale+Math.abs(dx*t.acz)+Math.abs(dz*t.acx)+Math.abs(t.abx*dz)+Math.abs(t.abz*dx));
        if(bu< -edgeError||cv< -edgeError||aw< -edgeError)continue;
        if(Math.min(bu,cv,aw)<=edgeError)return fallback();
        const u=bu/area,v=cv/area,height=t.ay+u*t.by+v*t.cy;
        const error=padding+4*edgeError/area*(Math.abs(t.by)+Math.abs(t.cy))+32*Number.EPSILON*(Math.abs(t.ay)+Math.abs(u*t.by)+Math.abs(v*t.cy));
        if(!Number.isFinite(error)||Math.abs(height-ceiling)<=error||Math.abs(height-bottom)<=error)return fallback();
        if(height>ceiling||height<bottom)continue;
        if(height>bestHeight){if(best)runnerUp=Math.max(runnerUp,bestHeight+bestError);best=t;bestHeight=height;bestError=error;}
        else runnerUp=Math.max(runnerUp,height+error);
      }
      if(!best)return null;
      if(bestHeight-bestError<=runnerUp)return fallback();
      ray.set(origin.set(x,ceiling,z),down);localRay.copy(ray).applyMatrix4(best.record.inverse);
      a.fromBufferAttribute(best.position,best.ia);b.fromBufferAttribute(best.position,best.ib);c.fromBufferAttribute(best.position,best.ic);
      counts.preciseTriangleTests++;
      if(!localRay.intersectTriangle(a,b,c,true,point))return fallback();
      point.applyMatrix4(best.record.matrix);
      if(Math.abs(point.y-bestHeight)>bestError||point.y>ceiling+1e-5||point.y<bottom)return fallback();
      return {height:point.y,normal:best.normal.clone(),walkable:best.normal.y>=Math.cos(35*Math.PI/180),surfaceId:best.record.instanceId===null?best.record.mesh.uuid:`${best.record.mesh.uuid}:${best.record.instanceId}`,source:'rendered-architecture'};
    },
    snapshot:()=>({...counts,triangleCount:triangles.length,extractedTriangles,triangleIndexReferences:indexReferences,unsafeTriangles}),
    dispose(){if(disposed)return;disposed=true;index.clear();orderedCells=new WeakSet();triangles.length=0;indexReferences=0;},
  };
}

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
  const index=createRecordIndex(records);
  const ceiling=records.reduce((top,record)=>Math.max(top,record.bounds.max.y),0)+1;
  const ray=new Ray(),direction=new Vector3(0,-1,0),localRay=new Ray(),point=new Vector3(),normal=new Vector3();
  const segment=new Line3(),queryBox=new Box3(),trianglePoint=new Vector3(),capsulePoint=new Vector3();
  const supportCounts=()=>({queries:0,candidateScans:0,boundsRejected:0,raycasts:0,hits:0}),support=supportCounts();
  const collision={queries:0,candidateScans:0,boundsRejected:0,shapecasts:0,hits:0};

  function sampleSurface(candidates,x,z,maxY,minY,counts){
    counts.queries++;
    ray.set(point.set(x,maxY,z),direction);let best=null;
    for(const candidate of candidates){
      const record=typeof candidate==='number'?records[candidate]:candidate;
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
    return sampleSurface(index.query(x,x,minY,maxY,z,z),x,z,maxY,minY,support);
  }

  // Guide routes have a fixed local footprint and support ceiling. Reuse the
  // owned BVHs to index their original placed triangles, with the same record
  // index and BVH operation retained for exact-boundary/tie fallbacks.
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
    let triangleIndex;
    try{triangleIndex=createGuideTriangleIndex(selected,region,minY,maxY,cellSize,signal);}catch(error){localIndex.clear();selected.length=0;throw error;}
    const counts=supportCounts(),sourcePrimitiveCount=records.length;let released=false,fallbackQueries=0;
    const local={
      surfaceAt(x,z,{maxY:queryMaxY=maxY,minY:queryMinY=minY}={}){
        if(queryMaxY===Infinity)queryMaxY=ceiling;
        if(released||disposed||![x,z,queryMaxY,queryMinY].every(Number.isFinite))return null;
        if(x<region.minX||x>region.maxX||z<region.minZ||z>region.maxZ||queryMaxY>maxY||queryMinY<minY){fallbackQueries++;return surfaceAt(x,z,{maxY:queryMaxY,minY:queryMinY});}
        const hit=triangleIndex.sample(x,z,queryMaxY,queryMinY);
        if(hit===GUIDE_TRIANGLE_FALLBACK)return sampleSurface(localIndex.at(x,z),x,z,queryMaxY,queryMinY,counts);
        counts.queries++;if(hit)counts.hits++;return hit;
      },
      snapshot:()=>({...counts,...triangleIndex.snapshot(),queries:counts.queries+fallbackQueries,localQueries:counts.queries,fallbackQueries,primitiveCount:selected.length,sourcePrimitiveCount,indexReferences,cellSize,disposed:released}),
      dispose(){if(released)return;released=true;localIndex.clear();triangleIndex.dispose();indexReferences=0;selected.length=0;guideSupports.delete(local);},
    };
    guideSupports.add(local);return local;
  }

  // The controller supplies the full swept convex volume, not two endpoint
  // rays. Reuse this owner's exact record broad phase and existing BVHs; the
  // helper consumes the scratch candidate IDs synchronously and owns neither.
  function intersectsGuideVolume(volume){
    if(disposed)return true;
    const bounds=volume?.bounds,planes=volume?.planes;
    if(!bounds||!['minX','maxX','minY','maxY','minZ','maxZ'].every(key=>Number.isFinite(bounds[key]))||bounds.minX>bounds.maxX||bounds.minY>bounds.maxY||bounds.minZ>bounds.maxZ||!Array.isArray(planes)||planes.length<5)return true;
    for(const plane of planes){
      if(!Array.isArray(plane)||plane.length!==4||!plane.every(Number.isFinite))return true;
      const length=Math.hypot(plane[0],plane[1],plane[2]);if(!Number.isFinite(length)||length<=0)return true;
    }
    if(volume.counters!==undefined&&(!volume.counters||typeof volume.counters!=='object'))return true;
    // Match the clipping helper's contact envelope at the broad phase too.
    const padding=1e-8,candidateIds=index.query(bounds.minX-padding,bounds.maxX+padding,bounds.minY-padding,bounds.maxY+padding,bounds.minZ-padding,bounds.maxZ+padding);
    return intersectsGuideVolumeRecords(volume,{records,candidateIds});
  }

  function capsuleBlocked({x,y,z,radius=.32,height=3.28,stepUp=0}){
    if(disposed)return false;
    collision.queries++;
    // The former grid returned no cell for a nonfinite query centre.
    if(!Number.isFinite(x)||!Number.isFinite(z))return false;
    const candidates=index.query(x-radius,x+radius,y+.02,y+height,z-radius,z+radius,Math.floor(x/16),Math.floor(z/16));
    for(const id of candidates){
      const record=records[id];collision.candidateScans++;
      if(record.bounds.max.y<y+.02||record.bounds.min.y>y+height||x+radius<record.bounds.min.x||x-radius>record.bounds.max.x||z+radius<record.bounds.min.z||z-radius>record.bounds.max.z){collision.boundsRejected++;continue;}
      segment.start.set(x,y+radius,z).applyMatrix4(record.inverse);
      segment.end.set(x,y+height-radius,z).applyMatrix4(record.inverse);
      const localRadius=radius/record.minScale;
      queryBox.makeEmpty().expandByPoint(segment.start).expandByPoint(segment.end).expandByScalar(localRadius);
      collision.shapecasts++;
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
      })){collision.hits++;return true;}
    }
    return false;
  }
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const local of guideSupports)local.dispose();index.clear();records.length=0;trees.clear();meshes.clear();instanceCount=0;}
  if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
  return {surfaceAt,createGuideSupport,intersectsGuideVolume,capsuleBlocked,dispose,get disposed(){return disposed;},get diagnostics(){return {meshCount:meshes.size,geometryCount:trees.size,instanceCount,primitiveCount:records.length,support:{...support},collision:{...collision},candidateIndex:index.snapshot(),localGuideSupports:guideSupports.size,source:'actual-static-mesh-triangles',indirect:true,disposed};}};
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
