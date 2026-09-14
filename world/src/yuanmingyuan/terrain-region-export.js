import {Matrix4,Vector3} from 'three';

const EPS=1e-8;
const soilBodies=new Set(['land','lake-bed','asset-excavation']);
const detailBodies=new Set(['open-arch-bridge','stone-promenade','exhibition-ground-path']);
const contextBodies=new Set(['asset-excavation-wall','coastal-rock-strata','island-foundation','bridge-balustrade','formal-shore-detail','garden-wall']);
const fail=message=>{throw new Error(`Terrain region export: ${message}`);};
const overlaps=(a,b)=>a.minX<=b.maxX+EPS&&a.maxX>=b.minX-EPS&&a.minZ<=b.maxZ+EPS&&a.maxZ>=b.minZ-EPS;
const inside=(x,z,b)=>x>=b.minX-EPS&&x<=b.maxX+EPS&&z>=b.minZ-EPS&&z<=b.maxZ+EPS;
function boundsOf(ring){
  if(!Array.isArray(ring)||!ring.length||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))fail('invalid live XZ polygon');
  const b={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const [x,z] of ring){b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minZ=Math.min(b.minZ,z);b.maxZ=Math.max(b.maxZ,z);}return b;
}
function copy(value){
  if(value===undefined)return undefined;
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('non-finite live metadata');return value;}
  if(typeof value==='function')return {unsupportedFunction:true};
  if(value.isBufferGeometry)return {geometryUUID:value.uuid,geometryName:value.name};
  if(value.isVector3||value.isVector2||value.isColor)return value.toArray();
  if(Array.isArray(value)||ArrayBuffer.isView(value))return Array.from(value,copy);
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)fail('unsupported live metadata object');
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,copy(v)]));
}
// Inclusive convex SAT in XZ. Long triangles crossing a window with no vertex
// inside, vertical faces, and exact corner/edge contacts all remain whole.
function touches(a,b,c,region){
  const points=[a,b,c],box={minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
  if(!overlaps(box,region))return false;
  const cx=(region.minX+region.maxX)/2,cz=(region.minZ+region.maxZ)/2,hx=(region.maxX-region.minX)/2,hz=(region.maxZ-region.minZ)/2;
  for(let i=0;i<3;i++){
    const p=points[i],q=points[(i+1)%3],nx=-(q.z-p.z),nz=q.x-p.x,length=Math.hypot(nx,nz);if(!length)continue;
    const projections=points.map(v=>v.x*nx+v.z*nz),centre=cx*nx+cz*nz,radius=hx*Math.abs(nx)+hz*Math.abs(nz),epsilon=EPS*length;
    if(Math.min(...projections)>centre+radius+epsilon||Math.max(...projections)<centre-radius-epsilon)return false;
  }return true;
}
function validateMatrix(matrix){
  const e=matrix?.elements;
  if(!e||e.length!==16||!e.every(Number.isFinite)||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1||matrix.determinant()===0)fail('non-finite, non-affine or singular world matrix');
}
function currentMatrix(node,checked){
  if(!node||checked.has(node))return;currentMatrix(node.parent,checked);checked.add(node);
  validateMatrix(node.matrixWorld);
  const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=2e-12*Math.max(1,Math.abs(v),Math.abs(b[i])));
  if(node.matrixAutoUpdate&&!close(new Matrix4().compose(node.position,node.quaternion,node.scale).elements,node.matrix.elements))fail(`update live matrices before export (${node.name})`);
  if(node.matrixWorldAutoUpdate){
    const expected=node.parent?new Matrix4().multiplyMatrices(node.parent.matrixWorld,node.matrix):node.matrix;
    if(!close(expected.elements,node.matrixWorld.elements))fail(`stale world matrix (${node.name})`);
  }
}
function drawn(geometry){
  const {start=0,count=Infinity}=geometry.drawRange??{};
  if(!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0&&count%3===0))fail('unsupported draw range');
  return {start,count:count===Infinity?null:count};
}
function describeGeometry(geometry){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count;
  if(!geometry?.isBufferGeometry||geometry.isInstancedBufferGeometry||!p||p.itemSize!==3||p.isInterleavedBufferAttribute||p.normalized||!(p.array instanceof Float32Array)||!Number.isInteger(total)||total%3)fail('source needs ordinary Float32 triangle positions');
  if(index&&(!['Uint16Array','Uint32Array'].includes(index.array?.constructor.name)||index.itemSize!==1||index.normalized))fail('unsupported source index');
  return {position:p,index,total,drawRange:drawn(geometry)};
}
function triangle(record,number,vertices){
  const {position,index,total}=record.source;if(!Number.isInteger(number)||number<0||number*3+2>=total)fail('invalid original triangle index');
  for(let i=0;i<3;i++){
    const at=index?index.getX(number*3+i):number*3+i;
    if(!Number.isInteger(at)||at<0||at>=position.count)fail('invalid original vertex index');
    vertices[i].fromBufferAttribute(position,at).applyMatrix4(record.matrix);
    if(![vertices[i].x,vertices[i].y,vertices[i].z].every(Number.isFinite))fail('non-finite original triangle');
  }
}
function encodeGeometry(record){
  const selected=[...record.selected].sort((a,b)=>a-b),vertexIds=[],remap=new Map(),indices=[];
  for(const n of selected)for(let i=0;i<3;i++){
    const at=record.source.index?record.source.index.getX(n*3+i):n*3+i;
    if(!remap.has(at)){remap.set(at,vertexIds.length);vertexIds.push(at);}indices.push(remap.get(at));
  }
  const attributes={};
  for(const [name,attribute] of Object.entries(record.geometry.attributes)){
    if(attribute.isInterleavedBufferAttribute||attribute.normalized||!(attribute.array instanceof Float32Array)||attribute.count!==record.source.position.count)fail(`unsupported source attribute ${name}`);
    const values=[],negativeZeroIndices=[];
    for(const at of vertexIds)for(let c=0;c<attribute.itemSize;c++){
      const value=attribute.array[at*attribute.itemSize+c];if(!Number.isFinite(value))fail(`non-finite source ${name}`);
      if(Object.is(value,-0))negativeZeroIndices.push(values.length);values.push(value);
    }
    attributes[name]={arrayType:'Float32Array',itemSize:attribute.itemSize,values,negativeZeroIndices};
  }
  return {...record.metadata,geometryUUID:record.geometry.uuid,geometryName:record.geometry.name,worldMatrix:record.matrix.toArray(),sourceVertexCount:record.source.position.count,sourceTriangleCount:record.source.total/3,sourceIndexType:record.source.index?.array.constructor.name??null,sourceDrawRange:record.source.drawRange,sourceGroups:copy(record.geometry.groups),
    attributes,sourceVertexIndices:vertexIds,indices,sourceTriangleIndices:selected,regionTriangleOrdinals:Object.fromEntries(record.regions.map(region=>[region.id,selected.flatMap((n,i)=>record.memberships.get(n)?.has(region.id)?[i]:[])])),toleranceRetainedTriangleIndices:[...record.toleranceRetained].sort((a,b)=>a-b)};
}

/** Synchronous detached JSON snapshot, not a terrain rebuild or a new sampler.
 * Render/update live matrices first. Private active asset supports are rejected
 * when a requested window overlaps them; visible meshes cannot substitute. */
export function captureTerrainRegions(terrain,{regions,probes=[],sourceIdentity=null}={}){
  const started=performance.now();
  if(!terrain?.group?.isObject3D||terrain.disposed||typeof terrain.surfaceAt!=='function'||typeof terrain.heightAt!=='function')fail('a live terrain owner with actual queries is required');
  if(!Array.isArray(regions)||!regions.length||!Array.isArray(probes)||!(sourceIdentity===null||typeof sourceIdentity==='string'))fail('regions, probes and source identity are invalid');
  const ids=new Set();regions=regions.map(region=>{
    const {id,minX,maxX,minZ,maxZ}=region??{};
    if(typeof id!=='string'||!id||ids.has(id)||![minX,maxX,minZ,maxZ].every(Number.isFinite)||maxX<minX||maxZ<minZ)fail('region IDs must be unique with finite ordered bounds');
    ids.add(id);return {id,minX,maxX,minZ,maxZ};
  });
  boundsOf(terrain.coastPolygon);
  const replacements=copy(terrain.replacementStates??[]),courts=terrain.courtFootprints??[],states=new Map(replacements.map(state=>[state.id,state]));
  for(const state of replacements)if(!state.bounds||![state.bounds.minX,state.bounds.maxX,state.bounds.minZ,state.bounds.maxZ].every(Number.isFinite)||state.bounds.minX>state.bounds.maxX||state.bounds.minZ>state.bounds.maxZ)fail('invalid replacement bounds');
  for(const state of replacements)if(state.active&&(!state.bounds||regions.some(region=>overlaps(region,state.bounds))))fail(`unsupported active replacement support: ${state.id}`);
  const localCourts=courts.filter(court=>regions.some(region=>overlaps(region,boundsOf(court.polygon))));
  for(const court of localCourts)if(court.sampleHeight)fail(`unsupported asset court sampler: ${court.id}`);
  const records=[],byGeometry=new Map(),checked=new Set(),vertices=[new Vector3(),new Vector3(),new Vector3()];let scannedTriangles=0,meshOrder=0;
  function collect(geometry,matrix,metadata){
    validateMatrix(matrix);const record={geometry,matrix:matrix.clone(),metadata,source:describeGeometry(geometry),regions,selected:new Set(),memberships:new Map(),toleranceRetained:new Set()};records.push(record);
    const entries=byGeometry.get(geometry)??[];entries.push(record);byGeometry.set(geometry,entries);
    // Read real vertices even if a cached boundingBox is stale. No live bounds
    // or matrices are recomputed/written. Barycentric weights >= -1e-6 expand
    // a face by at most two edge lengths * 1e-6; three is a conservative halo
    // for every later query in the window, independent of the supplied probes.
    const support=['soil','detail','patch'].includes(metadata.phase);
    for(let n=0;n<record.source.total/3;n++){
      triangle(record,n,vertices);scannedTriangles++;
      const [a,b,c]=vertices,halo=support?3e-6*Math.max(Math.hypot(a.x-b.x,a.z-b.z),Math.hypot(a.x-c.x,a.z-c.z),Math.hypot(b.x-c.x,b.z-c.z)):0;
      const box={minX:Math.min(a.x,b.x,c.x)-halo,maxX:Math.max(a.x,b.x,c.x)+halo,minZ:Math.min(a.z,b.z,c.z)-halo,maxZ:Math.max(a.z,b.z,c.z)+halo},membership=[];let exact=false;
      for(const region of regions){
        if(!overlaps(box,region))continue;
        if(touches(a,b,c,region)){membership.push(region.id);exact=true;}
        else if(halo&&touches(a,b,c,{minX:region.minX-halo,maxX:region.maxX+halo,minZ:region.minZ-halo,maxZ:region.maxZ+halo}))membership.push(region.id);
      }
      if(membership.length){record.selected.add(n);record.memberships.set(n,new Set(membership));if(!exact)record.toleranceRetained.add(n);}
    }
  }
  terrain.group.traverse(node=>{
    if(!node.isMesh)return;
    const order=meshOrder++,body=node.userData.body;
    let branch=node,ancestor=node.parent,patch=null;while(ancestor){if(states.has(ancestor.name)){patch=states.get(ancestor.name);break;}branch=ancestor;ancestor=ancestor.parent;}
    // Non-active patches query their original coarse child only. A prepared
    // hidden fine child is retained memory, not live support.
    if(patch&&(patch.active||branch!==node||body!=='land'))return;
    if(node.isInstancedMesh||node.isBatchedMesh||node.isSkinnedMesh||node.morphTargetInfluences?.length)fail('unsupported instanced, batched or deforming terrain mesh');
    if(!soilBodies.has(body)&&!detailBodies.has(body)&&!contextBodies.has(body))fail(`unrecognised terrain body: ${body}`);
    currentMatrix(node,checked);
    let visible=true;for(let at=node;at;at=at.parent)visible&&=at.visible;
    const material=Array.isArray(node.material)?node.material:[node.material];
    collect(node.geometry,node.matrixWorld,{recordId:node.uuid,meshName:node.name,meshOrder:order,body,phase:patch?'patch':soilBodies.has(body)?'soil':detailBodies.has(body)?'detail':'context',patchId:patch?.id??null,visible,materialVisible:material.some(m=>m?.visible),materialSides:material.map(m=>m?.side??null)});
  });
  const waterFacts=[];
  for(const water of terrain.waterSurfaces??[]){
    if(!regions.some(region=>overlaps(region,boundsOf(water.polygon))))continue;
    if(!Number.isFinite(water.worldY))fail('invalid logical water level');
    waterFacts.push(copy(water));
    collect(water.geometry,new Matrix4().makeTranslation(0,water.worldY,0),{recordId:`water:${water.id}`,meshName:null,meshOrder:null,body:'logical-water',phase:'water',waterId:water.id,worldY:water.worldY,transformSource:'terrain.waterSurfaces worldY; independent of rendered water shader offset'});
  }
  const liveProbes=[],probeIds=new Set();
  for(const request of probes){
    const {id,x,z}=request??{},maxY=request?.maxY??Infinity,includeBridges=request?.includeBridges??true;
    if(typeof id!=='string'||!id||probeIds.has(id)||![x,z].every(Number.isFinite)||!(maxY===Infinity||Number.isFinite(maxY))||typeof includeBridges!=='boolean'||!regions.some(region=>inside(x,z,region)))fail('probe must have a unique ID, valid options and lie in the region union');
    probeIds.add(id);const options={maxY,includeBridges},hit=terrain.surfaceAt(x,z,options),height=terrain.heightAt(x,z,options);
    if(height!==undefined&&!Number.isFinite(height)||height!==hit?.height)fail(`inconsistent live surfaceAt/heightAt: ${id}`);
    if(hit?.supportSource&&hit.supportSource!=='terrain-triangle')fail(`unsupported live probe support ${hit.supportSource}: ${id}`);
    let surface=null;
    if(hit){
      const {geometry,...rest}=hit;surface={...copy(rest),...(geometry?{geometryUUID:geometry.uuid,geometryName:geometry.name}:{})};
      if(geometry){
        const matches=(byGeometry.get(geometry)??[]).filter(record=>['soil','detail','patch'].includes(record.metadata.phase));
        if(matches.length!==1)fail(`live probe geometry has no unique exported support: ${id}`);
        const record=matches[0];triangle(record,hit.triangleIndex,vertices);
        if(!record.selected.has(hit.triangleIndex))fail(`live probe face lies outside the supported contact halo: ${id}`);
      }else if(hit.kind!=='sea')fail(`live support has no original triangle: ${id}`);
    }
    liveProbes.push({id,x,z,includeBridges,maxY:maxY===Infinity?null:maxY,surface,heightAt:height??null,heightAtDefined:height!==undefined});
  }
  if(terrain.disposed||JSON.stringify(replacements)!==JSON.stringify(copy(terrain.replacementStates??[])))fail('terrain/replacement state changed during capture');
  const geometries=records.filter(record=>record.selected.size).map(encodeGeometry);
  const featureRecords=(values,ringKey='polygon')=>(values??[]).filter(value=>value[ringKey]&&regions.some(region=>overlaps(region,boundsOf(value[ringKey])))).map(copy);
  const colliders=(terrain.colliders??[]).filter(value=>{
    if(value.type!=='segment'||!Array.isArray(value.from)||!Array.isArray(value.to)||!Number.isFinite(value.radius))fail('unsupported terrain collider metadata');
    const b=boundsOf([value.from,value.to]);for(const key of ['minX','minZ'])b[key]-=value.radius;for(const key of ['maxX','maxZ'])b[key]+=value.radius;return regions.some(region=>overlaps(region,b));
  }).map(copy);
  return {schema:'yuanmingyuan-live-terrain-regions-v1',sourceIdentity,terrain:{groupUUID:terrain.group.uuid,name:terrain.group.name,layoutId:terrain.diagnostics?.layoutId??null,worldMatrix:terrain.group.matrixWorld.toArray(),registration:terrain.diagnostics?.registration??null,metresCalibrated:false},regions,
    semantics:{selection:'union of inclusive world-XZ triangle contacts plus conservative support tolerance halo; whole original triangles, never clipped or resampled',attributes:'Finite original Float32 values; restore negativeZeroIndices to -0 after JSON parsing for byte-exact attributes',indices:'indices address compact attributes; sourceVertexIndices and sourceTriangleIndices retain original source identity/order',support:'Only soil/detail/patch phases supply terrain support. Context and logical water triangles are not floors. Hidden ordinary support meshes still belong to the source sampler; hidden inactive fine patches do not.',sampling:'Original upward-face barycentric terrain sampling, not interpolated shading normals. maxY:null means Infinity; includeBridges also controls paths/promenades. Live probes preserve wet/null/sea and exact owner metadata. The current garden sampler reads raw world-space source positions; a transformed rendering matrix alone does not authorize transformed offline sampling.',ordering:'Within soil/detail: mesh order then original triangle index, first wins equal heights. Detail wins ties with soil; patches win ties with those phases in patch order.',tolerances:{upwardNormalY:1e-9,denominator:1e-9,barycentric:1e-6,maxY:1e-6,regionContactWorld:EPS,supportHaloEdgeMultiplier:3e-6},toleranceRetention:'Support faces within maxEdgeXZ * 3e-6 of a window remain whole and are marked toleranceRetainedTriangleIndices when no exact window contact exists. This covers later query points, not only recorded probes. Unexpected live hits outside this halo reject the capture.',scope:'Detached evidence only; not a new authoritative sampler or historical survey. Active replacement/asset sampler overlap is unsupported. No source asset triangles or rendered water shader geometry are guessed.'},
    geometries,facts:{coastPolygon:copy(terrain.coastPolygon),courts:localCourts.map(copy),paths:featureRecords(terrain.paths),bridges:featureRecords(terrain.bridges,'footprint'),waterSurfaces:waterFacts,replacementStates:replacements,colliders},probes:liveProbes,
    diagnostics:{scannedTriangles,selectedTriangles:geometries.reduce((n,g)=>n+g.sourceTriangleIndices.length,0),meshRecords:geometries.length,probeCount:liveProbes.length,cpuMilliseconds:performance.now()-started,sourceMutated:false,gpuUsed:false}};
}
