import * as THREE from 'three';
import {createTriangleSampler,polygonArea,ringBounds} from './terrain-geometry.js';
import {pointInPolygon} from './garden-layout.js';

const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const pointKey=([x,z])=>`${Math.fround(x)},${Math.fround(z)}`;
const triangleIds=(geometry,n)=>[0,1,2].map(i=>geometry.index?geometry.index.getX(n+i):n+i);
const xz=(p,i)=>[p.getX(i),p.getZ(i)];
const signedArea=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const minimumArea=1e-9; // The original terrain sampler's projected-area cutoff.
export const higherTerrainSurface=(a,b)=>b&&(!a||b.height>=a.height)?b:a;

function subsetGeometry(source,faces,name){
  const ids=[],remap=new Map(),indices=[];
  for(const face of faces)for(const id of face){if(!remap.has(id)){remap.set(id,ids.length);ids.push(id);}indices.push(remap.get(id));}
  const geometry=new THREE.BufferGeometry();geometry.name=name;
  for(const [name,attribute] of Object.entries(source.attributes)){
    const array=new attribute.array.constructor(ids.length*attribute.itemSize);
    ids.forEach((id,i)=>{for(let c=0;c<attribute.itemSize;c++)array[i*attribute.itemSize+c]=attribute.getComponent(id,c);});
    geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Partition once along existing edges. Neither the original vertices nor the
 * triangles outside the bounded replacements are resampled. */
export function splitTerrainLand(geometry,replacements){
  const p=geometry.attributes.position,outside=[],selected=replacements.map(()=>[]),seen=new Set();
  for(const r of replacements){
    const b=r?.bounds;
    if(!r?.id||seen.has(r.id)||!b||![b.minX,b.maxX,b.minZ,b.maxZ].every(Number.isFinite)||b.minX>=b.maxX||b.minZ>=b.maxZ)throw new Error('Terrain replacements need unique IDs and finite nonempty bounds');
    if(r.ready)throw new Error('Live replacements must be initialized with the coarse layout and readyAssetIds: []');
    seen.add(r.id);
  }
  for(let n=0;n<(geometry.index?.count??p.count);n+=3){
    const face=triangleIds(geometry,n),b=ringBounds(face.map(i=>xz(p,i))),owners=[];
    for(let i=0;i<replacements.length;i++)if(overlaps(b,replacements[i].bounds))owners.push(i);
    if(owners.length>1)throw new Error('Terrain replacement triangles overlap; combine their descriptors before partitioning');
    (owners.length?selected[owners[0]]:outside).push(face);
  }
  if(selected.some(faces=>!faces.length))throw new Error('Terrain replacement does not intersect the original dry land');
  const result={geometry:null,patches:[]};
  try{
    result.geometry=subsetGeometry(geometry,outside,geometry.name);
    replacements.forEach((descriptor,i)=>result.patches.push({descriptor,coarseGeometry:subsetGeometry(geometry,selected[i],`${descriptor.id}-coarse-land`)}));
    return result;
  }catch(error){result.geometry?.dispose();for(const patch of result.patches)patch.coarseGeometry.dispose();throw error;}
}

function boundaryEdges(geometry){
  const edges=new Map();
  for(let n=0;n<geometry.index.count;n+=3){const f=triangleIds(geometry,n);for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=edgeKey(a,b),old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});}}
  return [...edges.values()].filter(edge=>edge.count===1);
}

function patchRegions(geometry,edges){
  const p=geometry.attributes.position,outgoing=new Map(),pending=edges.map(({a,b})=>({a:b,b:a,used:false}));
  // Upward original triangles run clockwise in XZ. Reverse the exposed edges
  // so the dry patch lies to their left, including holes on existing shores.
  for(const edge of pending){if(!outgoing.has(edge.a))outgoing.set(edge.a,[]);outgoing.get(edge.a).push(edge);}
  const loops=[];
  for(const first of pending){
    if(first.used)continue;const loop=[];let edge=first;
    while(edge&&!edge.used){
      edge.used=true;loop.push(xz(p,edge.a));if(edge.b===first.a)break;
      const a=xz(p,edge.a),b=xz(p,edge.b),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const candidates=(outgoing.get(edge.b)??[]).filter(next=>!next.used);
      const turn=next=>{const c=xz(p,next.b);return(Math.atan2(c[1]-b[1],c[0]-b[0])-angle+Math.PI*2)%(Math.PI*2);};
      candidates.sort((a,b)=>turn(a)-turn(b));edge=candidates[0];
    }
    if(!edge||edge.b!==first.a)throw new Error('Original terrain patch has an open boundary');loops.push(loop);
  }
  const regions=loops.filter(loop=>polygonArea(loop)>0).map(outer=>({outer,holes:[]}));
  for(const hole of loops.filter(loop=>polygonArea(loop)<0)){
    const owner=regions.filter(region=>pointInPolygon(hole[0],region.outer)).sort((a,b)=>polygonArea(a.outer)-polygonArea(b.outer))[0];
    if(!owner)throw new Error('Original terrain patch hole has no outer boundary');owner.holes.push(hole);
  }
  return regions;
}

function splitFace(face,mids){
  let [a,b,c]=face,ab=mids.get(edgeKey(a,b)),bc=mids.get(edgeKey(b,c)),ca=mids.get(edgeKey(c,a));
  const count=Number(ab!==undefined)+Number(bc!==undefined)+Number(ca!==undefined);
  if(!count)return [face];
  if(count===3)return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
  while(ab===undefined||(count===2&&bc===undefined)){[a,b,c]=[b,c,a];[ab,bc,ca]=[bc,ca,ab];}
  return count===1?[[a,ab,c],[ab,b,c]]:[[b,bc,ab],[a,ab,c],[ab,bc,c]];
}

/** Local fine land, with the original boundary's positions, UVs, colors and
 * normals copied bit for bit. No coastline, lake bed or water sheet is made. */
export function createFineTerrainLand(coarse,{courts=[],heightAt,colorAt,edgeLength=4.5,name='fine-terrain-land'}={}){
  if(typeof heightAt!=='function'||typeof colorAt!=='function'||!(edgeLength>0))throw new Error('Fine terrain needs height/color functions and a positive edge length');
  const p=coarse.attributes.position,vertices=[],keys=new Map(),boundary=boundaryEdges(coarse),fixed=new Map(),locked=new Set();
  const vertex=point=>{const key=pointKey(point);if(!keys.has(key)){keys.set(key,vertices.length);vertices.push([Math.fround(point[0]),Math.fround(point[1])]);}return keys.get(key);};
  for(const {a,b} of boundary){const aa=vertex(xz(p,a)),bb=vertex(xz(p,b));locked.add(edgeKey(aa,bb));fixed.set(aa,a);fixed.set(bb,b);}
  const regions=patchRegions(coarse,boundary),rings=courts.map(court=>court.polygon);
  for(const ring of rings){
    const region=regions.find(region=>ring.every(point=>pointInPolygon(point,region.outer)&&!region.holes.some(hole=>pointInPolygon(point,hole))));
    if(!region)throw new Error('Replacement excavation is not inside one original dry patch region');region.holes.push(ring);
  }
  let faces=[],sourceArea=0;
  for(let n=0;n<coarse.index.count;n+=3)sourceArea+=Math.abs(polygonArea(triangleIds(coarse,n).map(i=>xz(p,i))));
  for(const region of regions){
    const ids=[...region.outer,...region.holes.flat()].map(vertex);
    const triangles=THREE.ShapeUtils.triangulateShape(region.outer.map(point=>new THREE.Vector2(...point)),region.holes.map(ring=>ring.map(point=>new THREE.Vector2(...point))));
    for(const triangle of triangles){const face=triangle.map(i=>ids[i]);faces.push(signedArea(...face.map(id=>vertices[id]))<0?face:[face[0],face[2],face[1]]);}
  }
  // Earcut can omit collinear boundary vertices. Their stored Y and normal
  // need not be linear, so put each omitted vertex back into the actual edge.
  const used=new Set(faces.flat());
  for(const id of fixed.keys())if(!used.has(id)){
    const point=vertices[id];let restored=false;
    for(let n=0;n<faces.length&&!restored;n++)for(let i=0;i<3;i++){
      const [a,b,c]=[faces[n][i],faces[n][(i+1)%3],faces[n][(i+2)%3]],u=vertices[a],v=vertices[b],length2=(v[0]-u[0])**2+(v[1]-u[1])**2;
      const t=((point[0]-u[0])*(v[0]-u[0])+(point[1]-u[1])*(v[1]-u[1]))/length2;
      if(t>0&&t<1&&Math.abs(signedArea(u,v,point))<1e-8){faces[n]=[a,id,c];faces.push([id,b,c]);used.add(id);restored=true;break;}
    }
    if(!restored)throw new Error('Could not preserve an original terrain boundary vertex');
  }
  const initialEdges=new Set(faces.flatMap(face=>face.map((a,i)=>edgeKey(a,face[(i+1)%3]))));
  if([...locked].some(key=>!initialEdges.has(key)))throw new Error('Fine terrain did not preserve an original boundary edge');
  // Up to eight conforming passes add local detail. Exterior edges
  // stay untouched. A long fixed edge is deliberately allowed a graded collar:
  // trying to force it below edgeLength would refine forever toward that edge.
  let quantizedSplitsRejected=0;
  for(let pass=0;pass<8;pass++){
    const mids=new Map();
    for(const face of faces)for(let i=0;i<3;i++){
      const a=face[i],b=face[(i+1)%3],key=edgeKey(a,b),u=vertices[a],v=vertices[b];
      if(!locked.has(key)&&!mids.has(key)&&Math.hypot(u[0]-v[0],u[1]-v[1])>edgeLength)mids.set(key,vertex([(u[0]+v[0])/2,(u[1]+v[1])/2]));
    }
    // An almost-collinear stored border can have less than one Float32 ULP
    // of transverse room for another midpoint. Reject that split on both
    // adjacent faces; retain the existing positive-area triangle and seam.
    let changed=true;
    while(changed){changed=false;for(const face of faces)if(splitFace(face,mids).some(candidate=>signedArea(...candidate.map(id=>vertices[id]))>=-minimumArea)){
      for(let i=0;i<3;i++)if(mids.delete(edgeKey(face[i],face[(i+1)%3]))){changed=true;quantizedSplitsRejected++;}
    }}
    if(!mids.size)break;faces=faces.flatMap(face=>splitFace(face,mids));
  }
  const geometry=new THREE.BufferGeometry();geometry.name=name;
  try{
    const positions=new Float32Array(vertices.length*3),colors=new Float32Array(vertices.length*3),uv=new Float32Array(vertices.length*2);
    vertices.forEach(([x,z],i)=>{const y=heightAt(x,z),color=colorAt(x,y,z);if(!Number.isFinite(y))throw new Error('Fine terrain height is not finite');positions.set([x,y,z],i*3);colors.set(color.isColor?color.toArray():color,i*3);uv.set([x*.08,z*.08],i*2);});
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    for(const [id,original] of fixed)for(const name of ['position','color','uv']){const src=coarse.attributes[name],dst=geometry.attributes[name];if(src)for(let c=0;c<src.itemSize;c++)dst.setComponent(id,c,src.getComponent(original,c));}
    geometry.setIndex(faces.flat());geometry.computeVertexNormals();
    for(const [id,original] of fixed)for(let c=0;c<3;c++)geometry.attributes.normal.setComponent(id,c,coarse.attributes.normal.getComponent(original,c));
    const meshArea=faces.reduce((sum,face)=>sum+Math.abs(signedArea(...face.map(id=>vertices[id])))/2,0),expectedArea=sourceArea-rings.reduce((sum,ring)=>sum+Math.abs(polygonArea(ring)),0);
    if(Math.abs(meshArea-expectedArea)>Math.max(.0001,sourceArea*1e-6))throw new Error(`Fine terrain footprint mismatch: ${meshArea} / ${expectedArea}`);
    const degenerate=faces.filter(face=>signedArea(...face.map(id=>vertices[id]))>=-minimumArea);
    if(degenerate.length)throw new Error(`Fine terrain has ${degenerate.length} degenerate Float32 triangles: ${JSON.stringify(degenerate.slice(0,3).map(face=>face.map(id=>vertices[id])))}`);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={sourceArea,meshArea,expectedArea,boundaryVertexCount:fixed.size,boundaryCopies:[...fixed].map(([fine,coarse])=>({fine,coarse})),boundaryEdges:boundary.map(({a,b})=>[a,b]),subdivisionPassLimit:8,quantizedSplitsRejected};return geometry;
  }catch(error){geometry.dispose();throw error;}
}

/** Owns only its terrain geometries and samplers. The retained full asset and
 * its actual triangle support are borrowed; neither is ever disposed here. */
export function createTerrainPatchOwner({descriptor,coarseGeometry,material,buildFine}){
  const group=new THREE.Group();group.name=descriptor.id;
  const coarse=new THREE.Mesh(coarseGeometry,material);coarse.name=coarseGeometry.name;coarse.castShadow=coarse.receiveShadow=true;coarse.userData={body:'land',evidence:'authored-landscape'};group.add(coarse);
  // This sampler also serves pre-existing guide owners after a state change;
  // keep its cells local instead of inheriting the whole garden's 32 m grid.
  const sampler=createTriangleSampler([coarseGeometry],2),box=coarseGeometry.boundingBox;
  const bounds={minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z};
  let fine=null,binding=null,active=false,disposed=false,revision=0,error=null;
  function prepare(){
    if(disposed)throw new Error('Terrain patch has been disposed');if(fine)return snapshot();
    try{fine=buildFine();fine.group.visible=false;group.add(fine.group);error=null;return snapshot();}catch(reason){error=reason.message??String(reason);throw reason;}
  }
  const unavailable=value=>!value||value.disposed===true||value.ready===false;
  function activate(next){
    if(disposed)throw new Error('Terrain patch has been disposed');
    try{
      if(unavailable(next?.owner)||!next.owner.group?.isObject3D||typeof next.owner.dispose!=='function'||unavailable(next.support)||typeof next.support.surfaceAt!=='function')throw new Error('Replacement requires a retained full owner and ready triangle support');
      let hasMesh=false;next.owner.group.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.position?.count>0)hasMesh=true;});
      if(!hasMesh)throw new Error('Replacement full owner has no rendered geometry');
      next.owner.group.updateWorldMatrix(true,true);
      if(!next.owner.group.matrixWorld.elements.every(Number.isFinite))throw new Error('Replacement full owner has an invalid world transform');
      for(const court of descriptor.prepared.courts){
        const point=court.polygon.reduce((p,q)=>[p[0]+q[0]/court.polygon.length,p[1]+q[1]/court.polygon.length],[0,0]);
        const hit=next.support.surfaceAt(...point,{maxY:Infinity});
        if(!Number.isFinite(hit?.height)||hit.height<=court.floorY+.005)throw new Error('Replacement triangle support does not cover its excavation');
      }
      prepare();
    }catch(reason){error=reason.message??String(reason);throw reason;}
    if(active&&binding.owner===next.owner&&binding.support===next.support)return snapshot();
    // No await or external callbacks between these assignments: render and
    // both global/old local support queries observe one committed state.
    if(binding&&binding.owner!==next.owner)binding.owner.group.visible=false;
    binding={owner:next.owner,support:next.support};active=true;coarse.visible=false;fine.group.visible=true;binding.owner.group.visible=true;revision++;error=null;return snapshot();
  }
  function revert(){
    if(disposed)return snapshot();
    if(binding)binding.owner.group.visible=false;binding=null;coarse.visible=true;if(fine)fine.group.visible=false;
    if(active){active=false;revision++;}return snapshot();
  }
  function surfaceAt(x,z,{includeBridges=true,maxY=Infinity}={}){
    if(disposed||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)return null;
    if(active&&(unavailable(binding.owner)||unavailable(binding.support)))revert();
    const footprint=sampler.sample(x,z);if(!footprint)return null;
    if(!active){const hit=footprint.height<=maxY+1e-6?footprint:sampler.sample(x,z,maxY);return hit?{...hit,kind:'land',id:descriptor.id,walkable:true,supportSource:'terrain-triangle'}:null;}
    try{
      const ground=fine.surfaceAt(x,z,{includeBridges,maxY}),source=binding.support.surfaceAt(x,z,{maxY});
      const building=source&&Number.isFinite(source.height)&&source.height<=maxY+1e-6?{...source,kind:source.kind??'asset-terrain',id:descriptor.assetId,supportSource:'asset-triangle'}:null;
      return higherTerrainSurface(ground,building);
    }catch(reason){error=reason.message??String(reason);revert();return surfaceAt(x,z,{includeBridges,maxY});}
  }
  function snapshot(){const coarseTriangles=coarseGeometry.index.count/3,fineTriangles=fine?.triangleCount??0;return {id:descriptor.id,assetId:descriptor.assetId,state:disposed?'disposed':active?'active':fine?'prepared':'coarse',active,prepared:!!fine,revision,error,bounds:{...bounds},coarseTriangles,fineTriangles,visibleTerrainTriangles:disposed?0:active?fineTriangles:coarseTriangles,retainedTerrainTriangles:disposed?0:coarseTriangles+fineTriangles,seamVertices:fine?.land.userData.boundaryVertexCount??0};}
  function dispose(){if(disposed)return;revert();disposed=true;const errors=[];for(const action of [()=>sampler.dispose(),()=>coarseGeometry.dispose(),()=>fine?.dispose(),()=>group.removeFromParent(),()=>group.clear()])try{action();}catch(reason){errors.push(reason);}fine=null;if(errors.length)throw new AggregateError(errors,'Terrain patch disposal failed');}
  return {group,coarse,descriptor,bounds,prepare,activate,revert,surfaceAt,dispose,get disposed(){return disposed;},get snapshot(){return snapshot();},get fine(){return fine;}};
}
