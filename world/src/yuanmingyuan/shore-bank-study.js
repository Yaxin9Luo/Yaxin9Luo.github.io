import * as THREE from 'three';
import {createTriangleSampler} from './terrain-geometry.js';
import {pointInPolygon} from './garden-layout.js';
import {applyGardenGroundTextures} from './ground-textures.js';
import {shoreBankSubmergedR2,validateShoreBankBedProfile} from './shore-bank-submerged-r2.js';
import {shorePebbleDriftId,shorePebbleDriftEvidence,shorePebbleDriftRecords,createShoreDriftPebbleGeometry,createShoreDriftMaterial} from './shore-pebble-drifts.js';
import {shoreBankSpec,shoreBankCoordinates,shoreBankWorldXZ,shoreBankColour,decodeShoreBankGeometry,splitShoreBankBed,createShoreBankFineBed,createShorePebbleGeometry} from './shore-bank-geometry.js';
import {shoreBankR4,createShoreBankR4Ground,createShoreBankR4Waterline} from './shore-bank-r4-geometry.js';
export {shoreBankSpec} from './shore-bank-geometry.js';
export {shoreBankStudyViews} from './shore-bank-study-views.js';

const fail=message=>{throw new Error('Shore bank study: '+message);};
const contains=(point,water)=>pointInPolygon(point,water.polygon)&&!(water.holes??[]).some(hole=>pointInPolygon(point,hole));
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const bytes=geometry=>[geometry.index,...Object.values(geometry.attributes)].filter(Boolean).reduce((n,a)=>n+a.array.byteLength,0);
function wetMaterial(earth,name,roughness){
  const material=new THREE.MeshStandardMaterial({name,color:0xffffff,vertexColors:true,roughness});
  applyGardenGroundTextures(material,{map:earth.map,normalMap:earth.normalMap,roughnessMap:earth.roughnessMap,source:earth.userData.earthTextureSource},{sampling:'stock-lookup'});material.normalScale.copy(earth.normalScale);material.roughness=roughness;return material;
}
function recolour(geometry,spec){
  const p=geometry.attributes.position,c=geometry.attributes.color,color=new THREE.Color(),edits=[];
  for(let i=0;i<p.count;i++){
    const before=[c.getX(i),c.getY(i),c.getZ(i)];shoreBankColour(p.getX(i),p.getY(i),p.getZ(i),color.fromArray(before),color,spec);const after=color.toArray().map(Math.fround);
    if(before.some((n,j)=>n!==after[j])){c.setXYZ(i,...after);edits.push({sourceVertexIndex:geometry.userData.sourceVertexIndices[i],color:after});}
  }return edits;
}
function decodeWater(record){
  if(!Number.isFinite(record.worldY)||!Array.isArray(record.worldMatrix)||record.worldMatrix.some((n,i)=>n!==(i===13?record.worldY:identity[i])))fail('water keeps its recorded worldY translation only');
  const descriptor={...record,worldMatrix:identity};return decodeShoreBankGeometry(descriptor,{requireColour:false});
}
function pebbleRecords(spec){
  const records=[];let seed=28461;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Unequal clusters and bare gaps; there is deliberately no repeated stone
  // spacing along the lip and no tall material in either viewing corridor.
  for(const [centre,count,span] of [[-10.4,23,2.2],[-7.4,13,1.7],[-.9,30,2.5],[1.5,12,1.4],[7.1,22,2.2],[10,19,1.8]]){
    for(let i=0;i<count;i++){
      const s=centre+(random()-.5)*span,n=-(.16+random()**1.6*1.3),large=i%11===0,radius=large?.11+random()*.055:.025+random()*.043;
      if(Math.abs(s)>spec.halfLength-1.2)continue;
      records.push({s,n,radius,scale:[radius*(.95+random()*.6),radius*(.30+random()*.18),radius*(.75+random()*.4)],yaw:random()*Math.PI*2,variant:Math.floor(random()*3),tone:random(),burial:.012+radius*.09});
    }
  }return records;
}

/** Detached review candidate built only from the supplied live-region record.
 * It owns its small geometries/materials/samplers. earthMaterial and its three
 * real ground textures are borrowed, as is any water renderer used by ROOT.
 * No global terrain, source asset, water polygon or planting owner is edited. */
export function createShoreBankStudy({snapshot,earthMaterial,spec=shoreBankSpec,pebbles=true,bedProfile='r1',pebbleLayout='r1',stoneMaterial}={}){
  const started=performance.now();
  const curved=bedProfile===shoreBankR4.bedProfile;
  if(!curved)validateShoreBankBedProfile(bedProfile);
  if(!['r1',shorePebbleDriftId].includes(pebbleLayout))fail('unknown pebble layout');
  const drifts=pebbleLayout===shorePebbleDriftId;
  if(drifts&&bedProfile!=='submerged-r2'&&!curved)fail('new pebble drifts require the corrected submerged bed');
  if(drifts&&(!stoneMaterial?.isMeshStandardMaterial||![stoneMaterial.map,stoneMaterial.normalMap,stoneMaterial.roughnessMap].every(t=>t?.isTexture)))fail('new pebble drifts require the live rock PBR source');
  if(snapshot?.schema!=='yuanmingyuan-live-terrain-regions-v1'||!snapshot.facts||!Array.isArray(snapshot.geometries)||!Array.isArray(snapshot.regions))fail('a real terrain-region snapshot is required');
  if(!earthMaterial?.isMeshStandardMaterial||!earthMaterial.map?.isTexture||!earthMaterial.normalMap?.isTexture||!earthMaterial.roughnessMap?.isTexture)fail('the actual stock ground PBR material is required; no untextured substitute');
  if(![spec.halfLength,spec.waterY,spec.wetDepth,spec.colourDepth,spec.edgeLength,...spec.originXZ,...spec.tangentXZ,...spec.inlandXZ].every(Number.isFinite)||spec.halfLength<=2||spec.wetDepth<=1||spec.edgeLength<.06||spec.edgeLength>.5)fail('invalid bounded shore specification');
  if([spec.originXZ,spec.tangentXZ,spec.inlandXZ].some(p=>p.length!==2)||Math.abs(Math.hypot(...spec.tangentXZ)-1)>1e-10||Math.abs(Math.hypot(...spec.inlandXZ)-1)>1e-10||Math.abs(spec.tangentXZ[0]*spec.inlandXZ[0]+spec.tangentXZ[1]*spec.inlandXZ[1])>1e-10)fail('shore frame must retain orthonormal metre axes');
  const sourceRecords=snapshot.geometries.filter(record=>record.phase==='soil').sort((a,b)=>a.meshOrder-b.meshOrder);
  if(snapshot.geometries.some(record=>['detail','patch'].includes(record.phase)))fail('a detached path or private patch must not be omitted from original support');
  if(sourceRecords.some(record=>!['land','lake-bed'].includes(record.body)))fail('this candidate cannot change a source court or an unknown support');
  const waters=snapshot.facts.waterSurfaces??[];
  for(let s=-spec.halfLength;s<=spec.halfLength;s+=1){
    const water=waters.find(w=>contains(shoreBankWorldXZ(s,-.5,spec),w));if(!water||water.worldY!==spec.waterY)fail('the same existing lake sheet must cover the complete water-side lip');
    if(waters.some(w=>contains(shoreBankWorldXZ(s,1,spec),w)))fail('the protected root strip is not original dry land');
  }
  const corners=[[-spec.halfLength-2,-spec.wetDepth-2],[spec.halfLength+2,-spec.wetDepth-2],[spec.halfLength+2,spec.colourDepth+1],[-spec.halfLength-2,spec.colourDepth+1]].map(p=>shoreBankWorldXZ(...p,spec));
  if(!corners.every(([x,z])=>snapshot.regions.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ)))fail('the actual snapshot does not cover every modified bank and its collar');
  const group=new THREE.Group();group.name='shore-bank-study';const before=new THREE.Group(),candidate=new THREE.Group();before.name='shore-bank-original';candidate.name='shore-bank-candidate';group.add(before,candidate);before.visible=false;
  const ownedGeometries=new Set(),ownedMaterials=new Set(),samplers=new Set(),source=[],current=[],colorEdits=[],patches=[],waterSurfaces=[];let mode='candidate',disposed=false,pebbleSampler=null,collisionGeometry=null,curvedGround=null,shorelineN=null;
  const register=g=>{ownedGeometries.add(g);return g;};
  const material=wetMaterial(earthMaterial,'shore-bank-matched-earth',earthMaterial.roughness),wet=wetMaterial(earthMaterial,'shore-bank-damp-sediment',.88),stone=drifts?createShoreDriftMaterial(stoneMaterial):new THREE.MeshStandardMaterial({name:'shore-bank-rounded-gravel',color:0xffffff,roughness:.81,metalness:0});ownedMaterials.add(material);ownedMaterials.add(wet);ownedMaterials.add(stone);
  const add=(parent,g,m,body)=>{const mesh=new THREE.Mesh(g,m);mesh.name=g.name;mesh.castShadow=body!=='lake-bed';mesh.receiveShadow=true;mesh.userData={body,evidence:spec.evidence};parent.add(mesh);return mesh;};
  const release=()=>{if(disposed)return;disposed=true;const errors=[];for(const action of [()=>group.removeFromParent(),...Array.from(samplers,s=>()=>s.dispose()),...Array.from(ownedGeometries,g=>()=>g.dispose()),...Array.from(ownedMaterials,m=>()=>m.dispose()),()=>group.clear()])try{action();}catch(error){errors.push(error);}samplers.clear();ownedGeometries.clear();ownedMaterials.clear();if(errors.length)throw new AggregateError(errors,'Shore bank study cleanup failed');};
  try{
    for(const record of sourceRecords){
      const original=register(decodeShoreBankGeometry(record));source.push(original);add(before,original,material,record.body);
      if(curved){
        if(record.body==='land'){const display=register(original.clone());display.name='shore-bank-original-dry-land';colorEdits.push({sourceGeometryUUID:record.geometryUUID,sourceGeometryName:record.geometryName,edits:recolour(display,spec)});}
        continue;
      }
      if(record.body==='land'){
        const display=register(original.clone());display.name='shore-bank-original-dry-land';colorEdits.push({sourceGeometryUUID:record.geometryUUID,sourceGeometryName:record.geometryName,edits:recolour(display,spec)});current.push(display);add(candidate,display,material,'land');
      }else{
        const split=splitShoreBankBed(original,spec);register(split.coarse);register(split.outside);const fine=register(createShoreBankFineBed(split.coarse,spec,{bedProfile}));
        current.push(split.outside,fine);add(candidate,split.outside,material,'lake-bed');add(candidate,fine,wet,'lake-bed');
        patches.push({id:'shore-bank-bed-replacement',sourceGeometryUUID:record.geometryUUID,sourceGeometryName:record.geometryName,sourceTriangleIndices:[...split.coarse.userData.sourceTriangleIndices],sourceGeometry:split.coarse,geometry:fine,retainedGeometry:split.outside,originalSelectedOrdinals:split.selectedOrdinals});
      }
    }
    if(curved){
      const land=source.filter(g=>g.userData.body==='land'),bed=source.filter(g=>g.userData.body==='lake-bed');
      if(land.length!==1||bed.length!==1)fail('R4 requires one exact dry source and one exact bed source');
      curvedGround=createShoreBankR4Ground({land:land[0],bed:bed[0],spec});for(const g of curvedGround.geometries)register(g);
      for(const part of curvedGround.sources){const retained=part.retainedGeometry;if(retained.userData.body==='land')recolour(retained,spec);current.push(retained);add(candidate,retained,material,retained.userData.body);}
      current.push(curvedGround.geometry);add(candidate,curvedGround.geometry,wet,'land');
      patches.push({id:'shore-bank-r4-continuous-replacement',sources:curvedGround.sources,sourceGeometry:curvedGround.sourceGeometry,geometry:curvedGround.geometry});
      shorelineN=createShoreBankR4Waterline(curvedGround.geometry,spec);
    }
    if(!source.some(g=>g.userData.body==='land')||patches.length!==1)fail('the current candidate requires one ordinary lake bed and its original dry land');
    const originalSampler=createTriangleSampler(source),currentSampler=createTriangleSampler(current.filter(g=>g.userData.body!=='shore-bank-sediment'));samplers.add(originalSampler);samplers.add(currentSampler);
    const fineSampler=createTriangleSampler(patches.map(p=>p.geometry),1);samplers.add(fineSampler);
    const rockGroup=new THREE.Group();rockGroup.name='shore-bank-gravel-clusters';candidate.add(rockGroup);const placements=[];
    if(pebbles){
      const variants=[0,1,2].map(i=>register((drifts?createShoreDriftPebbleGeometry:createShorePebbleGeometry)(i+1))),records=drifts?shorePebbleDriftRecords(spec,curved?{shorelineN}:undefined):pebbleRecords(spec).map(r=>curved?{...r,n:r.n+shorelineN(r.s)}:r),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),normal=new THREE.Vector3(),q=new THREE.Quaternion(),yaw=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(),color=new THREE.Color();
      const vertices=[],indices=[];
      for(let variant=0;variant<variants.length;variant++){
        const list=records.filter(record=>record.variant===variant),geometry=variants[variant],instances=new THREE.InstancedMesh(geometry,stone,list.length);instances.name=`shore-bank-pebbles-${variant}`;instances.castShadow=instances.receiveShadow=true;rockGroup.add(instances);
        for(let n=0;n<list.length;n++){
          const r=list[n],[x,z]=shoreBankWorldXZ(r.s,r.n,spec),hit=fineSampler.sample(x,z);if(!hit)fail('a gravel contact leaves the captured original bed');
          normal.fromArray(hit.normal);q.setFromUnitVectors(up,normal);yaw.setFromAxisAngle(up,r.yaw);q.multiply(yaw);scale.fromArray(r.scale);matrix.compose(point.set(x,0,z),q,scale);
          const p=geometry.attributes.position;let lift=-Infinity;
          for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);const floor=fineSampler.sample(point.x,point.z);if(!floor)fail('a complete gravel body leaves the actual fine bed');lift=Math.max(lift,floor.height-point.y);}
          matrix.elements[13]=lift-r.burial;instances.setMatrixAt(n,matrix);instances.getMatrixAt(n,matrix);if(drifts)color.set('#c5cac4').lerp(new THREE.Color('#e7e1d3'),r.tone*.7);else color.set('#7b776b').lerp(new THREE.Color('#aaa18c'),r.tone*.72);instances.setColorAt(n,color);
          const first=vertices.length/3;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);vertices.push(point.x,point.y,point.z);}for(let i=0;i<geometry.index.count;i++)indices.push(first+geometry.index.getX(i));
          placements.push({...r,position:[x,matrix.elements[13],z],worldMatrix:matrix.toArray(),sourcePrototype:geometry.name});
        }
        instances.instanceMatrix.needsUpdate=true;instances.instanceColor.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();
      }
      // CPU-only contact: R2 keeps the computed world coordinates without a
      // second Float32 rounding after the actual stored instance transform.
      // Display prototypes/matrices and the frozen R1 collider stay unchanged.
      const collider=register(new THREE.BufferGeometry());collisionGeometry=collider;collider.name='shore-bank-actual-gravel-contact';collider.setAttribute('position',bedProfile==='submerged-r2'||curved?new THREE.BufferAttribute(new Float64Array(vertices),3):new THREE.Float32BufferAttribute(vertices,3));collider.setIndex(indices);collider.computeBoundingBox();collider.computeBoundingSphere();pebbleSampler=createTriangleSampler([collider],.5);samplers.add(pebbleSampler);
    }
    for(const record of snapshot.geometries.filter(record=>record.phase==='water')){
      const geometry=register(decodeWater(record));waterSurfaces.push({id:record.waterId,geometry,worldY:record.worldY,type:'lake',source:'unchanged original water triangles; caller owns water material'});
    }
    group.updateMatrixWorld(true);
    const inSnapshot=(x,z)=>snapshot.regions.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ);
    function surfaceAt(x,z,{maxY=Infinity,includePebbles=true}={}){
      if(disposed)return null;if(!inSnapshot(x,z))fail('query leaves the exported source windows');
      if(curved&&maxY===null)maxY=Infinity;
      let hit=(mode==='original'?originalSampler:currentSampler).sample(x,z,maxY);
      if(mode==='candidate'){const fine=fineSampler.sample(x,z,maxY);if(fine&&(!hit||fine.height>hit.height))hit=fine;}
      if(mode==='candidate'&&includePebbles&&shoreBankCoordinates(x,z,spec)[1]<.2){const stoneHit=pebbleSampler?.sample(x,z,maxY);if(stoneHit&&(!hit||stoneHit.height>hit.height))hit=stoneHit;}
      if(!hit)return null;const water=waters.find(w=>contains([x,z],w)),dry=curved?!water||hit.height>water.worldY+.03:hit.geometry.userData.body==='land'||!!water&&hit.height>water.worldY+.03;
      return {...hit,kind:dry?'land':'lake-bed',id:null,waterY:water?.worldY,walkable:dry,supportSource:'terrain-triangle',originalTriangleIndex:hit.geometry.userData.sourceTriangleIndices?.[hit.triangleIndex]??null};
    }
    const bedPatch=curved?curvedGround.sources.find(p=>p.sourceGeometry.userData.body==='lake-bed'):patches[0];
    const diagnostics={id:spec.id,sourceIdentity:snapshot.sourceIdentity,evidence:spec.evidence,sourceTriangles:source.reduce((n,g)=>n+g.index.count/3,0),fineBedTriangles:patches[0].geometry.index.count/3,retainedBedTriangles:bedPatch.retainedGeometry.index.count/3,sourceBedFacesReplaced:bedPatch.sourceTriangleIndices.length,seamVertices:patches[0].geometry.userData.boundaryVertexCount,unindexedRefinementVerticesRemoved:patches[0].geometry.userData.unindexedRefinementVerticesRemoved,unindexedOutsideSourceCandidates:patches[0].geometry.userData.unindexedOutsideSourceCandidates,sourceDryPositionsAndIndicesPreserved:!curved,waterY:spec.waterY,newWaterPolygons:0,colorVerticesChanged:colorEdits.reduce((n,d)=>n+d.edits.length,0),pebbles:placements.length,pebbleTriangles:placements.reduce((n,p)=>n+Array.from(ownedGeometries).find(g=>g.name===p.sourcePrototype).index.count/3,0),geometryBytes:[...ownedGeometries].reduce((n,g)=>n+bytes(g),0),buildMs:performance.now()-started,productionApproved:false,nativeReviewed:false,groundSampling:'stock-lookup',groundTextureSource:earthMaterial.userData.earthTextureSource??null,rootPolicy:'all original dry-land positions, topology and normals unchanged; no height approximation at retained roots',integration:'exclusive original-bed face replacement, dry vertex-colour edits and real fine/pebble support; do not add as a coplanar overlay'};
    if(curved)Object.assign(diagnostics,curvedGround.diagnostics,{rootPolicy:'source dry faces at n>1 retained exactly; only original near-water dry/bed faces replaced; original source arrays stay immutable',integration:'one connected dry-and-wet triangle surface; original water owner unchanged',waterlineBasis:'intersection of actual Float32 fine faces with the existing water render plane',waterlineTopology:shorelineN.diagnostics,waterline: Array.from({length:23},(_,i)=>{const s=(i-11)*spec.halfLength/12;return {s,n:shorelineN(s)};})});
    if(bedProfile===shoreBankSubmergedR2.bedProfile)Object.assign(diagnostics,{...shoreBankSubmergedR2,bedHeightCeiling:spec.waterY});
    if(drifts)Object.assign(diagnostics,{pebbleLayout,evidence:shorePebbleDriftEvidence,pebbleMaterials:'borrowed photographic rock maps; independent material owner',pebbleDrifts:3});
    return {group,before,candidate,patches,colorEdits,waterSurfaces,placements,spec,diagnostics,shorelineN,contactGeometries:[...patches.map(p=>p.geometry),...(collisionGeometry?[collisionGeometry]:[])],surfaceAt,heightAt:(x,z,options)=>surfaceAt(x,z,options)?.height,
      containsPatchPoint:(x,z)=>!disposed&&fineSampler.sample(x,z)!==null,
      samplePatch:(x,z,options)=>disposed||!fineSampler.sample(x,z)?null:surfaceAt(x,z,options),
      setMode(value){if(disposed)fail('owner disposed');if(!['original','candidate'].includes(value))fail('unknown comparison mode');mode=value;before.visible=value==='original';candidate.visible=value==='candidate';},
      get mode(){return mode;},get disposed(){return disposed;},dispose:release};
  }catch(error){try{release();}catch(cleanup){throw new AggregateError([error,cleanup],'Shore bank study construction and cleanup failed');}throw error;}
}
