import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createShoreBankStudy} from '../src/yuanmingyuan/shore-bank-study.js';
import {shoreBankSpec,shoreBankWorldXZ,shoreBankCoordinates,shoreBankBedHeight,shoreBankWidth,createShorePebbleGeometry,shoreGeometryBoundary} from '../src/yuanmingyuan/shore-bank-geometry.js';

const snapshotPath=new URL('../../work/production-v3/captures/terrain-regions-5deaa85c62d11679-1789195173683.json',import.meta.url),raw=readFileSync(snapshotPath),snapshot=JSON.parse(raw),snapshotSHA=createHash('sha256').update(raw).digest('hex');
assert.equal(snapshotSHA,'000aa4437ef678361b282ba2f55b9e533f90295ae5c6f3f83dcbd841623225f1');
function borrowedMaterial(){
  const material=new THREE.MeshStandardMaterial({vertexColors:true}),textures=['map','normalMap','roughnessMap'].map((name,i)=>{const t=new THREE.DataTexture(new Uint8Array([i===1?128:160,i===1?128:160,i===1?255:160,255]),1,1);material[name]=t;return t;});let released=0;
  for(const texture of textures)texture.addEventListener('dispose',()=>released++);material.userData.earthSampling='stock-lookup';material.normalScale.set(.42,.42);return {material,textures,get released(){return released;},dispose(){material.dispose();textures.forEach(t=>t.dispose());}};
}
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function meshChecks(geometry){
  const p=geometry.attributes.position,ab=new THREE.Vector3(),ac=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),edges=new Map();let minimumArea=Infinity;
  for(let n=0;n<geometry.index.count;n+=3){const ids=[0,1,2].map(i=>geometry.index.getX(n+i));a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);const twiceArea=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length();assert(twiceArea>1e-10,`nonzero actual 3D triangle ${n/3}`);minimumArea=Math.min(minimumArea,twiceArea*.5);for(let i=0;i<3;i++){const aa=ids[i],bb=ids[(i+1)%3],key=aa<bb?`${aa}:${bb}`:`${bb}:${aa}`;edges.set(key,(edges.get(key)||0)+1);}}
  assert([...edges.values()].every(n=>n<=2),'no edge has more than two incident faces');return {minimumArea,boundaryEdges:[...edges.values()].filter(n=>n===1).length};
}

test('water-side profile has unequal widths, stays bounded and leaves all original dry/root heights untouched',()=>{
  const widths=[];for(let s=-12;s<=12;s+=.2){widths.push(shoreBankWidth(s));for(const n of [.001,.5,1,2,16]){const [x,z]=shoreBankWorldXZ(s,n);assert.equal(shoreBankBedHeight(x,z,3.87654321),3.87654321);}}
  assert(Math.max(...widths)-Math.min(...widths)>.4);assert(Math.max(...widths)<1);
  for(const [s,n] of [[-12,-.4],[12,-.5],[0,-3.5],[0,0]]){const [x,z]=shoreBankWorldXZ(s,n);assert.equal(shoreBankBedHeight(x,z,n===0?2:1.6),n===0?2:1.6);}
});
test('rounded gravel prototypes have closed, correctly oriented pole fans and smooth finite normals',()=>{
  for(let seed=1;seed<=3;seed++){
    const g=createShorePebbleGeometry(seed);try{const check=meshChecks(g);assert.equal(check.boundaryEdges,0);assert([...g.attributes.normal.array].every(Number.isFinite));let volume=0;const p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));volume+=a.dot(b.cross(c))/6;}assert(volume>1,'outward closed shell');}finally{g.dispose();}
  }
});

test('one actual 3-window candidate preserves dry triangles and boundary bytes, changes only its existing lake margin and releases every owned resource',t=>{
  const borrowed=borrowedMaterial();let study;const originalJSON=JSON.stringify(snapshot),started=performance.now(),rssBefore=process.memoryUsage().rss;
  t.after(()=>{study?.dispose();borrowed.dispose();});study=createShoreBankStudy({snapshot,earthMaterial:borrowed.material});
  t.diagnostic(JSON.stringify(study.diagnostics));const ownedGeometries=new Set(study.contactGeometries),ownedMaterials=new Set();study.group.traverse(node=>{if(node.geometry)ownedGeometries.add(node.geometry);for(const m of [].concat(node.material??[]))ownedMaterials.add(m);});for(const p of study.patches)ownedGeometries.add(p.sourceGeometry);for(const water of study.waterSurfaces)ownedGeometries.add(water.geometry);
  let geometryReleases=0,materialReleases=0;for(const g of ownedGeometries)g.addEventListener('dispose',()=>geometryReleases++);for(const m of ownedMaterials)m.addEventListener('dispose',()=>materialReleases++);
  const original=study.before.children.find(node=>node.userData.body==='land').geometry,dry=study.candidate.children.find(node=>node.userData.body==='land').geometry;
  for(const key of ['position','normal','uv'])assert.equal(hash(dry.attributes[key].array),hash(original.attributes[key].array),`${key} original bit identity`);assert.equal(hash(dry.index.array),hash(original.index.array));assert.notEqual(hash(dry.attributes.color.array),hash(original.attributes.color.array));
  const patch=study.patches[0],fine=patch.geometry,coarse=patch.sourceGeometry;
  for(const {fine:i,coarse:j} of fine.userData.boundaryCopies)for(const name of ['position','normal','uv'])for(let c=0;c<coarse.attributes[name].itemSize;c++)assert(Object.is(fine.attributes[name].getComponent(i,c),coarse.attributes[name].getComponent(j,c)),`${name} seam byte`);
  const topology=meshChecks(fine);assert.equal(topology.boundaryEdges,shoreGeometryBoundary(coarse).length);assert(Math.abs(fine.userData.sourceArea-fine.userData.meshArea)<.0001);assert(fine.index.count>coarse.index.count*20,'real local refinement');
  let dryProbes=0,maxDryHeightError=0,maxDryNormalError=0;
  for(const p of snapshot.probes.filter(p=>p.surface?.kind==='land')){
    const hit=study.surfaceAt(p.x,p.z,{maxY:p.maxY??Infinity});assert(hit);assert.equal(hit.height,p.surface.height);assert.deepEqual(hit.normal,p.surface.normal);assert.equal(hit.kind,'land');assert.equal(hit.originalTriangleIndex,p.surface.triangleIndex);dryProbes++;
  }
  let raisedSamples=0,wetSamples=0;const shoreline=[];
  for(let s=-11.5;s<=11.5;s+=.5){let outermost=null;
    for(let d=0;d<=1.9;d+=.025){const [x,z]=shoreBankWorldXZ(s,-d),hit=study.surfaceAt(x,z,{includePebbles:false});assert(hit);if(hit.height>shoreBankSpec.waterY+.001){raisedSamples++;outermost=d;}else wetSamples++;}
    shoreline.push({s,outermost});
  }
  assert(raisedSamples>100&&wetSamples>100);const widths=shoreline.filter(p=>p.outermost!==null).map(p=>p.outermost);assert(Math.max(...widths)-Math.min(...widths)>.25,'actual triangle/water intersection is irregular');
  for(const p of study.placements){assert(p.n<0);assert(Math.abs(p.s)<12);assert(study.containsPatchPoint(p.position[0],p.position[2]));assert(p.scale[1]<.08);}
  let maximumPebbleN=-Infinity;const collision=study.contactGeometries.find(g=>g.name==='shore-bank-actual-gravel-contact');for(let i=0;i<collision.attributes.position.count;i++)maximumPebbleN=Math.max(maximumPebbleN,shoreBankCoordinates(collision.attributes.position.getX(i),collision.attributes.position.getZ(i))[1]);assert(maximumPebbleN<.2,'all actual gravel vertices precede the new .80173 m crown boundary');
  const cut=shoreBankWorldXZ(0,-.3),top=study.surfaceAt(...cut,{includePebbles:false});assert(study.containsPatchPoint(...cut));assert.equal(study.samplePatch(...cut,{maxY:top.height-.1,includePebbles:false}),null,'an upper-bound miss must not reveal the removed original bed');
  // The collider uses each actual stored Float32 instance matrix, not the
  // higher-precision pre-upload placement values.
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,20),gravel=study.candidate.getObjectByName('shore-bank-gravel-clusters');let rayHits=0,maxContactError=0;
  for(const p of study.placements.filter((_,i)=>i%9===0)){ray.ray.origin.set(p.position[0],8,p.position[2]);const hit=ray.intersectObject(gravel,true)[0];if(!hit)continue;const sampled=study.surfaceAt(p.position[0],p.position[2]);assert(sampled.height>=hit.point.y-.00002);maxContactError=Math.max(maxContactError,Math.abs(sampled.height-hit.point.y));rayHits++;}assert(rayHits>8);assert(maxContactError<.00002);
  for(const water of study.waterSurfaces){const source=snapshot.geometries.find(record=>record.phase==='water'&&record.waterId===water.id);assert.equal(water.worldY,2);assert.deepEqual([...water.geometry.attributes.position.array],source.attributes.position.values);assert.deepEqual([...water.geometry.index.array],source.indices);}
  study.setMode('original');assert.equal(study.before.visible,true);assert.equal(study.candidate.visible,false);for(const p of snapshot.probes){const hit=study.surfaceAt(p.x,p.z,{maxY:p.maxY??Infinity});assert.equal(hit?.height,p.surface?.height);assert.deepEqual(hit?.normal,p.surface?.normal);}study.setMode('candidate');
  assert.equal(JSON.stringify(snapshot),originalJSON);assert.equal(borrowed.released,0);const result={snapshotSHA,diagnostics:study.diagnostics,topology,dryProbes,maxDryHeightError,maxDryNormalError,waterIntersection:shoreline,rayHits,maxContactError,maximumPebbleN,totalMs:performance.now()-started,rssBefore,rssAfter:process.memoryUsage().rss,gpuUsed:false,materialFixture:'1x1 CPU PBR ownership fixtures only; ROOT native must borrow actual 4K ground maps'};
  original.addEventListener('dispose',()=>{throw new Error('simulated one-geometry cleanup failure');});assert.throws(()=>study.dispose(),AggregateError);assert.equal(geometryReleases,ownedGeometries.size);assert.equal(materialReleases,ownedMaterials.size);assert.equal(borrowed.released,0);assert.equal(study.surfaceAt(850,-560),null);assert.equal(study.samplePatch(850,-555),null);assert.throws(()=>study.setMode('original'),/disposed/);study.dispose();assert.equal(geometryReleases,ownedGeometries.size);
  if(process.env.SHORE_BANK_REPORT)writeFileSync(process.env.SHORE_BANK_REPORT,JSON.stringify({...result,disposed:true,ownedGeometryReleases:geometryReleases,materialReleases,borrowedTextureReleases:borrowed.released,cleanupFailureStillReleasesRemainingResources:true},null,2)+'\n');
});

test('a malformed source encountered after material allocation disposes every new material and leaves borrowed texture owners live',()=>{
  const b=borrowedMaterial(),dispose=THREE.Material.prototype.dispose;let released=0;THREE.Material.prototype.dispose=function(){released++;return dispose.call(this);};
  try{
    const records=snapshot.geometries.map(record=>record.body==='land'?{...record,attributes:{...record.attributes,position:{...record.attributes.position,arrayType:'Float64Array'}}}:record);
    assert.throws(()=>createShoreBankStudy({snapshot:{...snapshot,geometries:records},earthMaterial:b.material}),/original Float32/);assert.equal(released,3);assert.equal(b.released,0);
    assert.throws(()=>createShoreBankStudy({snapshot,earthMaterial:b.material,spec:{...shoreBankSpec,inlandXZ:[0,-2]}}),/orthonormal/);assert.equal(released,3);
  }finally{THREE.Material.prototype.dispose=dispose;b.dispose();}
});

test('missing real PBR input, wrong lake level or extra private support fail explicitly without consuming borrowed maps',()=>{
  assert.throws(()=>createShoreBankStudy({snapshot}),/actual stock ground/);const b=borrowedMaterial();try{
    assert.throws(()=>createShoreBankStudy({snapshot:{...snapshot,facts:{...snapshot.facts,waterSurfaces:snapshot.facts.waterSurfaces.map(w=>({...w,worldY:2.5}))}},earthMaterial:b.material}),/same existing lake/);
    assert.throws(()=>createShoreBankStudy({snapshot:{...snapshot,geometries:[...snapshot.geometries,{phase:'patch'}]},earthMaterial:b.material}),/private patch/);assert.equal(b.released,0);
  }finally{b.dispose();}
});
