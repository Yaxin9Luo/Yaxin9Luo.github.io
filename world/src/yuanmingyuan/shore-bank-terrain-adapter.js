import * as THREE from 'three';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const adapters=new WeakMap();
const methodNames=['surfaceAt','heightAt','createGuideSupport'];
const fail=message=>{throw new Error('Shore bank terrain adapter: '+message);};
const combine=(errors,message)=>{if(errors.length)throw new AggregateError(errors,message);};
const attempt=(errors,action)=>{try{action();}catch(error){errors.push(error);}};
const overlap=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;

function worldIdentity(object){
  object.updateWorldMatrix(true,false);
  if(!identity.every((v,i)=>object.matrixWorld.elements[i]===v))fail('source and study meshes must retain their captured identity world transforms');
}
function staticGeometry(geometry){
  if(!geometry?.isBufferGeometry||!geometry.index||geometry.index.itemSize!==1||geometry.index.count%3||geometry.groups.length||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||Object.keys(geometry.morphAttributes).length)fail('only complete, indexed static source geometry is supported');
  for(const [name,a] of Object.entries(geometry.attributes))if(a.isInterleavedBufferAttribute||!(a.array instanceof Float32Array)||a.normalized||a.count!==geometry.attributes.position?.count)fail(`source ${name} must keep ordinary Float32 attributes`);
  if(geometry.attributes.position?.itemSize!==3)fail('source position attribute is missing');
}

/** The captured UUID identifies the snapshot, not a later factory invocation.
 * A different live UUID is accepted only after the original face indices,
 * ordered vertex IDs and all captured Float32 components match exactly. */
function compareSource(live,captured){
  staticGeometry(live);staticGeometry(captured);
  const faces=captured.userData.sourceTriangleIndices,vertices=captured.userData.sourceVertexIndices;
  if(!Array.isArray(faces)||faces.length!==captured.index.count/3||!Array.isArray(vertices)||vertices.length!==captured.attributes.position.count||new Set(vertices).size!==vertices.length)fail('captured original face/vertex mapping is incomplete');
  if(faces.some((id,i)=>!Number.isInteger(id)||id<0||id>=live.index.count/3||i>0&&id<=faces[i-1])||vertices.some(id=>!Number.isInteger(id)||id<0||id>=live.attributes.position.count))fail('captured original face/vertex mapping is out of range');
  for(let face=0;face<faces.length;face++)for(let c=0;c<3;c++)if(live.index.getX(faces[face]*3+c)!==vertices[captured.index.getX(face*3+c)])fail('live original triangle ordering or vertex index changed');
  let components=0;
  for(const [name,attribute] of Object.entries(captured.attributes)){
    const source=live.attributes[name];if(!source||source.itemSize!==attribute.itemSize)fail(`live original ${name} format changed`);
    for(let i=0;i<vertices.length;i++)for(let c=0;c<attribute.itemSize;c++){
      const actual=source.array[vertices[i]*source.itemSize+c],expected=attribute.array[i*attribute.itemSize+c];
      if(!Number.isFinite(actual)||!Object.is(actual,expected))fail(`live original ${name} differs at source vertex ${vertices[i]}`);components++;
    }
  }
  return components;
}
function geometryBounds(geometry){
  const p=geometry.attributes.position,b={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};let edge=0;
  for(let i=0;i<geometry.index.count;i+=3)for(let c=0;c<3;c++){const id=geometry.index.getX(i+c),next=geometry.index.getX(i+(c+1)%3);b.minX=Math.min(b.minX,p.getX(id));b.maxX=Math.max(b.maxX,p.getX(id));b.minZ=Math.min(b.minZ,p.getZ(id));b.maxZ=Math.max(b.maxZ,p.getZ(id));edge=Math.max(edge,Math.abs(p.getX(id)-p.getX(next)),Math.abs(p.getZ(id)-p.getZ(next)));}
  // The original/fine samplers accept barycentric coordinates to -1e-6.
  // Do not let this broad phase clip their small, scale-dependent edge halo.
  const halo=Math.max(edge,b.maxX-b.minX,b.maxZ-b.minZ)*3e-6;return {minX:b.minX-halo,maxX:b.maxX+halo,minZ:b.minZ-halo,maxZ:b.maxZ+halo};
}
function polygonBounds(polygon){
  if(!Array.isArray(polygon)||polygon.length<3||polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))fail('live path/court footprint is invalid');
  return {minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minZ:Math.min(...polygon.map(p=>p[1])),maxZ:Math.max(...polygon.map(p=>p[1]))};
}
function viewGeometry(source,name){
  const view=new THREE.BufferGeometry();view.name=name;
  for(const [key,attribute] of Object.entries(source.attributes))view.setAttribute(key,attribute);
  view.setIndex(source.index);view.boundingBox=source.boundingBox?.clone()??null;view.boundingSphere=source.boundingSphere?.clone()??null;
  view.userData={...source.userData,shoreBankDisplayView:true,sourceGeometryUUID:source.uuid,sourceGeometryName:source.name};return view;
}

/** Install before creating scene/guide queries. terrain and study are borrowed:
 * dispose adapter, then study, then terrain. Initialization is inactive. No
 * source vertex, geometry owner, material, texture or water is disposed here. */
export function createShoreBankTerrainAdapter({terrain,study}={}){
  if(!terrain?.group?.isObject3D||terrain.disposed||!terrain.earthMaterial?.isMaterial||methodNames.some(name=>typeof terrain[name]!=='function'))fail('a live terrain owner is required');
  if(adapters.has(terrain))fail('this terrain already has a shore bank adapter');
  if(!study?.group?.isObject3D||study.group.parent||study.disposed||study.patches?.length!==1||!study.before?.isObject3D||!study.candidate?.isObject3D||['containsPatchPoint','samplePatch','setMode'].some(name=>typeof study[name]!=='function'))fail('a detached, live shore bank study is required');
  const originalDescriptors=Object.fromEntries(methodNames.map(name=>[name,Object.getOwnPropertyDescriptor(terrain,name)]));
  if(methodNames.some(name=>!originalDescriptors[name]||!('value' in originalDescriptors[name])||!originalDescriptors[name].writable))fail('terrain query functions must be writable own properties');
  const original=Object.fromEntries(methodNames.map(name=>[name,terrain[name]])),patch=study.patches[0],patchSources=patch.sources??[patch],records=[],waterRecords=[];
  const curved=Array.isArray(patch.sources);
  if(curved&&(patchSources.length!==2||patchSources.filter(p=>p.sourceGeometry?.userData.body==='land').length!==1||patchSources.filter(p=>p.sourceGeometry?.userData.body==='lake-bed').length!==1))fail('continuous shore replacement needs one dry and one bed source');
  for(const part of patchSources){
    const selected=new Set(part.sourceTriangleIndices);
    if(!selected.size||selected.size!==part.sourceTriangleIndices?.length||selected.size!==part.sourceGeometry?.index?.count/3||part.sourceTriangleIndices.some((id,i)=>id!==part.sourceGeometry.userData.sourceTriangleIndices[i]))fail('replacement must name each captured original bed or dry triangle exactly once');
  }
  const findMesh=captured=>{
    const name=captured.userData.sourceGeometryName,list=[];terrain.group.traverse(node=>{if(node.isMesh&&node.geometry?.name===name)list.push(node);});
    if(list.length!==1||list[0].isInstancedMesh||list[0].isSkinnedMesh||Array.isArray(list[0].material))fail(`live source ${name} must resolve to exactly one ordinary mesh`);
    return list[0];
  };
  for(const part of patchSources){const mesh=findMesh(part.sourceGeometry);if(records.some(r=>r.mesh===mesh))fail('duplicate replacement source');records.push({mesh,source:mesh.geometry,captured:part.sourceGeometry,kind:part.sourceGeometry.userData.body==='land'?'dry':'bed',selected:new Set(part.sourceTriangleIndices),view:null});}
  const bedRecord=records.find(r=>r.kind==='bed');if(!bedRecord)fail('a lake-bed source is required');
  const bedSource=bedRecord.source,selected=bedRecord.selected,partsBounds=records.map(r=>geometryBounds(r.captured)),bounds={minX:Math.min(...partsBounds.map(b=>b.minX)),maxX:Math.max(...partsBounds.map(b=>b.maxX)),minZ:Math.min(...partsBounds.map(b=>b.minZ)),maxZ:Math.max(...partsBounds.map(b=>b.maxZ))};
  for(const edit of study.colorEdits??[]){
    const originals=[];study.before.traverse(node=>{if(node.isMesh&&node.geometry?.userData.sourceGeometryUUID===edit.sourceGeometryUUID&&node.geometry.userData.body==='land')originals.push(node.geometry);});
    if(originals.length!==1)fail('dry colour changes require the corresponding captured original geometry');
    const captured=originals[0],mesh=findMesh(captured);
    const existing=records.find(r=>r.mesh===mesh);
    if(existing&&(!curved||existing.kind!=='dry'||existing.edit))fail('multiple display edits target the same source mesh');
    const allowed=new Set(captured.userData.sourceVertexIndices),seen=new Set();
    for(const change of edit.edits){if(!allowed.has(change.sourceVertexIndex)||seen.has(change.sourceVertexIndex)||change.color?.length!==3||!change.color.every(n=>Number.isFinite(n)&&Math.fround(n)===n))fail('dry colour edit is outside its captured vertices or is not Float32');seen.add(change.sourceVertexIndex);}
    if(existing){existing.edit=edit;existing.colourCaptured=captured;}
    else records.push({mesh,source:mesh.geometry,captured,kind:'colour',edit,view:null});
  }
  if(!records.some(r=>r.edit))fail('the original dry-land colour record is required');
  for(const water of study.waterSurfaces??[]){
    const matches=(terrain.waterSurfaces??[]).filter(w=>w.id===water.id);if(matches.length!==1)fail('captured water must resolve to one live water surface');waterRecords.push({live:matches[0],captured:water});
  }
  if(!waterRecords.length)fail('the captured original water owner is required');
  const fineMeshes=[];study.candidate.traverse(node=>{if(node.isMesh&&node.geometry===patch.geometry)fineMeshes.push(node);});
  const gravel=study.candidate.getObjectByName('shore-bank-gravel-clusters');
  if(fineMeshes.length!==1||!gravel?.isObject3D)fail('the candidate must expose its actual fine-bed mesh and gravel group');
  const sourceFine=fineMeshes[0];
  function validate(){
    if(terrain.disposed||study.disposed)fail('a borrowed owner was disposed');worldIdentity(terrain.group);worldIdentity(study.group);worldIdentity(study.candidate);
    let components=0;
    for(const record of records){worldIdentity(record.mesh);if(record.mesh.geometry!==record.source&&record.mesh.geometry!==record.view)fail('another owner changed the live source mesh');if(record.mesh.material!==terrain.earthMaterial)fail('the source ground material owner changed');components+=compareSource(record.source,record.captured);if(record.colourCaptured)components+=compareSource(record.source,record.colourCaptured);}
    for(const {live,captured} of waterRecords){if(!terrain.waterSurfaces.includes(live)||live.worldY!==captured.worldY||live.worldY!==study.spec.waterY)fail('the original water level or owner changed');components+=compareSource(live.geometry,captured.geometry);}
    for(const path of [...(terrain.paths??[]),...(terrain.courtFootprints??[])])if(overlap(bounds,polygonBounds(path.polygon)))fail('a live path or court crosses the local bed; it needs an explicit composition');
    for(const replacement of terrain.replacementStates??[])if(replacement.active&&replacement.bounds&&overlap(bounds,replacement.bounds))fail('an active private terrain replacement crosses this bed');
    worldIdentity(sourceFine);staticGeometry(patch.geometry);worldIdentity(gravel);gravel.traverse(node=>{if(node.isMesh)worldIdentity(node);});
    if(sourceFine.material?.map!==terrain.earthMaterial.map||sourceFine.material?.normalMap!==terrain.earthMaterial.normalMap||sourceFine.material?.roughnessMap!==terrain.earthMaterial.roughnessMap)fail('candidate and live terrain must borrow the same ground texture owner');
    return components;
  }
  // Complete validation precedes attaching nodes or replacing public methods.
  const verifiedComponents=validate(),group=new THREE.Group(),queries=new Set(),instanceNodes=[];group.name='shore-bank-terrain-adapter';group.visible=false;group.userData={privateTerrainSupport:true,shoreBankTerrainAdapter:true,sourceSnapshotIdentity:study.diagnostics?.sourceIdentity??null};
  const installedMethods=new Set();let active=false,disposed=false,revision=0,lastError=null;
  const inBounds=(x,z)=>x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ;
  function restoreDisplay(errors){
    active=false;attempt(errors,()=>{group.visible=false;});
    for(const r of records)attempt(errors,()=>{if(r.mesh.geometry===r.view)r.mesh.geometry=r.source;else if(r.mesh.geometry!==r.source)fail('display geometry ownership changed during rollback');});
  }
  function revert(){
    if(disposed)return snapshot();const wasActive=active,errors=[];restoreDisplay(errors);if(wasActive)revision++;
    if(errors.length){lastError=errors.map(e=>e.message??String(e)).join('; ');combine(errors,'Shore bank display rollback failed');}return snapshot();
  }
  function query(base,x,z,options,patchOnly=false){
    if(disposed||terrain.disposed)return null;
    if(active&&(study.disposed||study.mode!=='candidate'))revert();
    if(!active)return patchOnly?null:base(x,z,options);
    if(curved&&options?.maxY===null)options={...options,maxY:Infinity};
    if(!inBounds(x,z))return patchOnly?null:retainedHit(base(x,z,options));
    let next,retained;
    try{if(!study.containsPatchPoint(x,z))return patchOnly?null:retainedHit(base(x,z,options));next=study.samplePatch(x,z,options);retained=retainedHit(base(x,z,options));}
    catch(error){lastError=error.message??String(error);const errors=[error];restoreDisplay(errors);revision++;if(errors.length>1)combine(errors,'Shore bank query and rollback failed');throw error;}
    // In particular, a maxY miss on the fine surface cannot reveal the removed
    // original bed. A distinct real bridge/path/dry triangle is still retained.
    return next&&(!retained||next.height>retained.height)?next:retained;
  }
  function retainedHit(hit){return hit&&records.some(r=>r.selected&&hit.geometry===r.source&&r.selected.has(hit.triangleIndex))?null:hit;}
  const originalSurface=(...args)=>original.surfaceAt.apply(terrain,args),surfaceAt=(x,z,options)=>query(originalSurface,x,z,options);
  const heightAt=(x,z,options)=>surfaceAt(x,z,options)?.height;
  function createGuideSupport(localBounds){
    if(disposed||terrain.disposed)fail('adapter has been disposed');
    const local=original.createGuideSupport.call(terrain,localBounds);let released=false;
    if(typeof local?.surfaceAt!=='function'||typeof local.dispose!=='function'){
      const errors=[new Error('Shore bank terrain adapter: original terrain returned an invalid local query owner')];
      if(typeof local?.dispose==='function')attempt(errors,()=>local.dispose());if(errors.length>1)combine(errors,'Invalid shore bank local query cleanup failed');throw errors[0];
    }
    const localSurface=(...args)=>local.surfaceAt(...args),owner={surfaceAt:(x,z,options)=>released||disposed?null:query(localSurface,x,z,options),get triangleCount(){return local.triangleCount;},get disposed(){return released||disposed;},dispose(){if(released)return;released=true;queries.delete(owner);local.dispose();}};
    queries.add(owner);return owner;
  }
  const wrappers={surfaceAt,heightAt,createGuideSupport};
  function restoreMethods(errors){
    for(const name of installedMethods)attempt(errors,()=>{if(terrain[name]!==wrappers[name])fail(`another owner changed ${name}; refusing to overwrite it`);Object.defineProperty(terrain,name,originalDescriptors[name]);});installedMethods.clear();
  }
  function cleanup(){
    if(disposed)return;const errors=[];restoreDisplay(errors);disposed=true;
    // Restore public entry points even when a local query's disposal throws.
    restoreMethods(errors);adapters.delete(terrain);
    for(const owner of [...queries])attempt(errors,()=>owner.dispose());queries.clear();
    attempt(errors,()=>group.removeFromParent());
    for(const node of instanceNodes)attempt(errors,()=>node.dispose());
    for(const record of records)if(record.view)attempt(errors,()=>record.view.dispose());
    attempt(errors,()=>group.clear());combine(errors,'Shore bank adapter cleanup failed');
  }
  function activate(){
    if(disposed)fail('adapter has been disposed');
    try{validate();if(active)return snapshot();study.setMode('candidate');for(const r of records)r.mesh.geometry=r.view;group.visible=true;active=true;revision++;lastError=null;return snapshot();}
    catch(error){lastError=error.message??String(error);const errors=[error];restoreDisplay(errors);if(errors.length>1)combine(errors,'Shore bank activation and rollback failed');throw error;}
  }
  function snapshot(){return {id:'shore-bank-terrain-adapter',state:disposed?'disposed':active?'active':'inactive',active,revision,error:lastError,sourceSnapshotIdentity:study.diagnostics?.sourceIdentity??null,sourceGeometryUUID:curved?bedRecord.captured.userData.sourceGeometryUUID:patch.sourceGeometryUUID,liveGeometryUUID:bedSource.uuid,verifiedFloat32Components:verifiedComponents,replacedBedFaces:selected.size,fineBedTriangles:patch.geometry.index.count/3,localQueries:queries.size,bounds:{...bounds},originalWaterOwnerRetained:true,borrowedTerrain:true,borrowedStudy:true,...(curved?{bedProfile:'curved-r4',replacedDryFaces:records.filter(r=>r.kind==='dry').reduce((n,r)=>n+r.selected.size,0),replacementSources:records.filter(r=>r.selected).map(r=>({kind:r.kind,sourceGeometryUUID:r.captured.userData.sourceGeometryUUID,liveGeometryUUID:r.source.uuid,faces:r.selected.size}))}:{})};}
  try{
    for(const record of records){
      const view=viewGeometry(record.source,record.source.name+'-shore-bank-display');record.view=view;
      if(record.selected){
        const source=record.source.index,array=new source.array.constructor(source.count-record.selected.size*3),sourceTriangles=[];let j=0;
        for(let i=0;i<source.count;i+=3)if(!record.selected.has(i/3)){sourceTriangles.push(i/3);for(let c=0;c<3;c++)array[j++]=source.getX(i+c);}
        view.setIndex(new THREE.BufferAttribute(array,1));view.userData.sourceTriangleIndices=sourceTriangles;
      }
      if(record.edit){
        const color=record.source.attributes.color.clone();view.setAttribute('color',color);
        for(const edit of record.edit.edits)color.setXYZ(edit.sourceVertexIndex,...edit.color);color.needsUpdate=true;
      }
    }
    const fine=new THREE.Mesh(sourceFine.geometry,sourceFine.material);fine.name=sourceFine.name;fine.castShadow=sourceFine.castShadow;fine.receiveShadow=sourceFine.receiveShadow;fine.userData={...sourceFine.userData,body:'shore-bank-sediment',privateTerrainSupport:true};group.add(fine);
    const stones=gravel.clone(true);stones.traverse(node=>{if(node.isInstancedMesh)instanceNodes.push(node);});group.add(stones);
    terrain.group.add(group);
    // Plain data properties were verified above; no callbacks occur between
    // these assignments. The initialized adapter remains entirely inactive.
    for(const name of methodNames){Object.defineProperty(terrain,name,{...originalDescriptors[name],value:wrappers[name]});installedMethods.add(name);}adapters.set(terrain,true);
    return {group,activate,revert,surfaceAt,heightAt,samplePatch:(x,z,options)=>query(originalSurface,x,z,options,true),dispose:cleanup,get active(){return active;},get disposed(){return disposed;},get snapshot(){return snapshot();}};
  }catch(error){try{cleanup();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Shore bank adapter construction and cleanup failed');}throw error;}
}
