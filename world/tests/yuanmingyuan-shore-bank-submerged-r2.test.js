import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createShoreBankStudy} from '../src/yuanmingyuan/shore-bank-study.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {shoreBankSpec,shoreBankWorldXZ,shoreBankCoordinates,shoreBankBedHeight,shoreBankWidth,createShoreBankFineBed,createShorePebbleGeometry,decodeShoreBankGeometry} from '../src/yuanmingyuan/shore-bank-geometry.js';
import {shoreBankSubmergedR2,capShoreBankSubmergedR2,validateShoreBankBedProfile} from '../src/yuanmingyuan/shore-bank-submerged-r2.js';

const digest=b=>createHash('sha256').update(b).digest('hex'),bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const sourceURL=new URL('../public/assets/yuanmingyuan/shore-bank-r1/terrain-regions-000aa4437ef678361b282ba2f55b9e533f90295ae5c6f3f83dcbd841623225f1.json',import.meta.url),raw=readFileSync(sourceURL),snapshot=JSON.parse(raw);
assert.equal(digest(raw),'000aa4437ef678361b282ba2f55b9e533f90295ae5c6f3f83dcbd841623225f1');
const freeze=new URL('../../work/yuanmingyuan/captures/source-b47041ba0c50b64e/world/src/yuanmingyuan/',import.meta.url);
const frozenSource=readFileSync(new URL('shore-bank-geometry.js',freeze),'utf8');
assert.equal(digest(frozenSource),'d9637b664d89ff95482b61c17ee7d5cf317586a6c7b21b9b5badc1b63ce7bc34');
// Execute the preserved complete R1 module. Only dependency URLs are resolved;
// its implementation is not reconstructed or rewritten to resemble a hash.
for(const [file,sha] of [['terrain-geometry.js','e5ff4a0856a27a7f083dd90c689356d3dbe2de4963dc36c0d41796d23f6284a7'],['terrain-patch-owner.js','f0fc75927744bb91935ec1987e16325661eca291beaf11115d2761498062d416']])assert.equal(digest(readFileSync(new URL('../src/yuanmingyuan/'+file,import.meta.url))),sha);
const linkedFrozen=frozenSource.replace(/from '([^']+)'/g,(_,specifier)=>`from '${specifier==='three'?import.meta.resolve('three'):new URL('../src/yuanmingyuan/'+specifier.slice(2),import.meta.url).href}'`);
const frozen=await import('data:text/javascript;base64,'+Buffer.from(linkedFrozen).toString('base64'));

function coarseSection({dry=false}={}){
  const positions=[],uv=[],colors=[],indices=[],ss=[-.6,0,.6],ns=dry?[0,.6,1.2]:[-1.2,-.6,0];
  for(const n of ns)for(const s of ss){const [x,z]=shoreBankWorldXZ(s,n);positions.push(x,2+n*.2,z);uv.push(x*.08,z*.08);colors.push(.2+s*.01,.14+n*.01,.07);}
  for(let n=0;n<2;n++)for(let s=0;s<2;s++){const a=n*3+s,b=a+1,c=a+3,d=c+1;indices.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.name=dry?'test-original-dry':'test-original-bed';g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={body:dry?'land':'lake-bed',sourceGeometryUUID:g.uuid,sourceGeometryName:g.name,sourceTriangleIndices:Array.from({length:8},(_,i)=>i),sourceVertexIndices:Array.from({length:9},(_,i)=>i)};return g;
}
const geoHashes=g=>Object.fromEntries([['index',digest(bytes(g.index.array))],...Object.entries(g.attributes).map(([name,a])=>[name,digest(bytes(a.array))])]);

test('explicit submerged cap keeps existing high source, datum and finite source boundaries',()=>{
  assert.equal(shoreBankSubmergedR2.materialVariant,'unchanged-r1');assert.equal(validateShoreBankBedProfile('r1'),'r1');assert.equal(validateShoreBankBedProfile('submerged-r2'),'submerged-r2');
  assert.equal(capShoreBankSubmergedR2(1.94,2.05,2),2);assert.equal(capShoreBankSubmergedR2(1.5,1.8,2),1.8);assert.equal(capShoreBankSubmergedR2(2.4,2.4,2),2.4);assert(Object.is(capShoreBankSubmergedR2(-0,-0,2),-0));
  for(const input of [[NaN,2,2],[1,Infinity,2],[1,2,-Infinity]])assert.throws(()=>capShoreBankSubmergedR2(...input),/finite/);
  for(const profile of ['',null,undefined,{},'r2','SUBMERGED-R2'])assert.throws(()=>validateShoreBankBedProfile(profile),/unknown bed profile/);
});

test('actual Float32 snapshot reproduces R1 emergence and the opt-in height stays below the actual 2.006 water plane',()=>{
  const bed=decodeShoreBankGeometry(snapshot.geometries.find(g=>g.body==='lake-bed')),sampler=createTriangleSampler([bed],2),original=geoHashes(bed);let emergedR1=0,samples=0,highest=-Infinity;
  try{
    for(let s=-11.75;s<=11.75;s+=.25)for(let d=.005;d<=3.5;d+=.025){
      const [x,z]=shoreBankWorldXZ(s,-d).map(Math.fround),hit=sampler.sample(x,z);assert(hit);const y0=shoreBankBedHeight(x,z,hit.height),old=frozen.shoreBankBedHeight(x,z,hit.height),y2=shoreBankBedHeight(x,z,hit.height,shoreBankSpec,'submerged-r2'),stored=Math.fround(y2);
      assert(Object.is(y0,old),'default R1 equals independent preserved source');assert(stored<=2);assert(stored<2.006);assert(y2>=hit.height);assert(y2<=y0);if(y0>2.006)emergedR1++;highest=Math.max(highest,stored);samples++;
    }
    assert(samples>10000);assert(emergedR1>300,'the original error must actually occur');assert.equal(highest,2);assert.deepEqual(geoHashes(bed),original);
  }finally{sampler.dispose();bed.dispose();}
});

test('every actual dry source vertex including n >= .7 remains byte-identical, as do outer/seam height guards',()=>{
  const record=snapshot.geometries.find(g=>g.body==='land'),p=record.attributes.position.values;let protectedVertices=0;
  for(let i=0;i<p.length;i+=3){const [x,y,z]=p.slice(i,i+3),n=shoreBankCoordinates(x,z)[1],next=shoreBankBedHeight(x,z,y,shoreBankSpec,'submerged-r2');assert(Object.is(next,y));if(n>=.7)protectedVertices++;}
  assert(protectedVertices>800);
  for(const [s,n,y] of [[-12,-.3,1.9],[12,-.3,1.9],[0,-3.5,1.2],[0,0,2],[0,.7,2.045]]){const [x,z]=shoreBankWorldXZ(s,n);assert.equal(shoreBankBedHeight(x,z,y,shoreBankSpec,'submerged-r2'),y);}
});

test('default and explicit R1 fine geometry match frozen R1 real buffers on the same Float32 source section',()=>{
  const coarse=coarseSection(),before=geoHashes(coarse),owners=[];
  try{
    const reference=frozen.createShoreBankFineBed(coarse),current=createShoreBankFineBed(coarse),explicit=createShoreBankFineBed(coarse,shoreBankSpec,{bedProfile:'r1'});owners.push(reference,current,explicit);
    assert(reference.index.count/3>100&&reference.index.count/3<5000,'bounded real refinement fixture only');assert.deepEqual(geoHashes(current),geoHashes(reference));assert.deepEqual(geoHashes(explicit),geoHashes(reference));assert.deepEqual(current.userData,reference.userData);assert.deepEqual(geoHashes(coarse),before);
  }finally{owners.forEach(g=>g.dispose());coarse.dispose();}
});

test('the R2 real triangle mesh preserves full topology, UV/color/XZ/seam bytes and lies strictly on one side of both double and GPU Float32 water planes',()=>{
  const coarse=coarseSection(),before=geoHashes(coarse),owners=[],materials=[],waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-2.006),gpuPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-Math.fround(2.006));let releases=0;
  try{
    const r1=createShoreBankFineBed(coarse),r2=createShoreBankFineBed(coarse,shoreBankSpec,{bedProfile:'submerged-r2'});owners.push(r1,r2);
    assert.deepEqual(bytes(r2.index.array),bytes(r1.index.array));for(const name of ['uv','color'])assert.deepEqual(bytes(r2.attributes[name].array),bytes(r1.attributes[name].array));
    const p=r2.attributes.position,point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();let maxDistance=-Infinity,changedY=0;
    for(let i=0;i<p.count;i++){
      assert(Object.is(p.getX(i),r1.attributes.position.getX(i)));assert(Object.is(p.getZ(i),r1.attributes.position.getZ(i)));if(p.getY(i)!==r1.attributes.position.getY(i))changedY++;
      point.fromBufferAttribute(p,i);assert(waterPlane.distanceToPoint(point)<=-.0059);assert(gpuPlane.distanceToPoint(point)<=-.0059);maxDistance=Math.max(maxDistance,waterPlane.distanceToPoint(point));
    }
    assert(changedY>20);assert(maxDistance<0);
    for(const {fine:i,coarse:j} of r2.userData.boundaryCopies)for(const name of ['position','normal','uv'])for(let component=0;component<coarse.attributes[name].itemSize;component++)assert(Object.is(r2.attributes[name].getComponent(i,component),coarse.attributes[name].getComponent(j,component)));
    for(let i=0;i<r2.index.count;i+=3){a.fromBufferAttribute(p,r2.index.getX(i));b.fromBufferAttribute(p,r2.index.getX(i+1));c.fromBufferAttribute(p,r2.index.getX(i+2));normal.crossVectors(b.sub(a),c.sub(a));assert(normal.y>1e-10,'actual Float32 triangle remains upward and nondegenerate');}
    assert([...r2.attributes.normal.array].every(Number.isFinite));assert.equal(r2.userData.boundaryVertexCount,r1.userData.boundaryVertexCount);assert.deepEqual(geoHashes(coarse),before);
    // A real Three ray chooses water, never the new sediment. R1's old strip
    // is independently shown to win at the same source-water intersection.
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});materials.push(material);const waterGeometry=coarse.clone();for(let i=0;i<waterGeometry.attributes.position.count;i++)waterGeometry.attributes.position.setY(i,2.006);waterGeometry.computeBoundingBox();waterGeometry.computeBoundingSphere();owners.push(waterGeometry);
    const water=new THREE.Mesh(waterGeometry,material),oldMesh=new THREE.Mesh(r1,material),newMesh=new THREE.Mesh(r2,material),ray=new THREE.Raycaster();water.updateMatrixWorld(true);oldMesh.updateMatrixWorld(true);newMesh.updateMatrixWorld(true);
    let oldOccludesWater=0,checked=0;
    for(let s=-.4;s<=.4;s+=.1)for(let d=.08;d<=.8;d+=.06){const [x,z]=shoreBankWorldXZ(s,-d);ray.set(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0));const old=ray.intersectObjects([oldMesh,water])[0],next=ray.intersectObjects([newMesh,water])[0];assert(next);assert.equal(next.object,water);if(old.object===oldMesh)oldOccludesWater++;checked++;}
    assert(checked>50);assert(oldOccludesWater>10,'the same real R1 mesh previously occluded this water');
    for(const g of owners)g.addEventListener('dispose',()=>releases++);
  }finally{owners.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());coarse.dispose();}
  assert.equal(releases,3);
});

function record(g,body,meshOrder){return {phase:'soil',body,meshOrder,geometryUUID:g.uuid,geometryName:g.name,worldMatrix:new THREE.Matrix4().toArray(),sourceVertexCount:g.attributes.position.count,sourceTriangleCount:g.index.count/3,sourceVertexIndices:g.userData.sourceVertexIndices,sourceTriangleIndices:g.userData.sourceTriangleIndices,indices:[...g.index.array],attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{arrayType:'Float32Array',itemSize:a.itemSize,values:[...a.array],negativeZeroIndices:[...a.array].flatMap((v,i)=>Object.is(v,-0)?[i]:[])}]))};}

test('the public study option reaches real small geometry and marks R2 while material, dry bytes and borrowed ownership remain unchanged',()=>{
  const dry=coarseSection({dry:true}),bed=coarseSection(),material=new THREE.MeshStandardMaterial({vertexColors:true}),textures=[],studies=[];let borrowedDisposals=0;
  for(const [i,name] of ['map','normalMap','roughnessMap'].entries()){const t=new THREE.DataTexture(new Uint8Array([i===1?128:160,i===1?128:160,i===1?255:160,255]),1,1);t.addEventListener('dispose',()=>borrowedDisposals++);material[name]=t;textures.push(t);}
  material.userData.earthTextureSource='small-fixture-only';
  // A small synthetic source section, explicitly not a complete source capture.
  // No scattering is built; the real full snapshot is tested numerically above.
  const small={schema:'yuanmingyuan-live-terrain-regions-v1',sourceIdentity:'small-float32-section-only',facts:snapshot.facts,regions:snapshot.regions,geometries:[record(dry,'land',0),record(bed,'lake-bed',1)]};
  try{
    const r1=createShoreBankStudy({snapshot:small,earthMaterial:material,pebbles:false}),r2=createShoreBankStudy({snapshot:small,earthMaterial:material,pebbles:false,bedProfile:'submerged-r2'});studies.push(r1,r2);
    assert.equal(r1.diagnostics.id,shoreBankSpec.id);assert(!Object.hasOwn(r1.diagnostics,'bedProfile'));assert.equal(r2.diagnostics.id,shoreBankSubmergedR2.id);assert.equal(r2.diagnostics.bedProfile,'submerged-r2');assert.equal(r2.diagnostics.materialVariant,'unchanged-r1');assert.equal(r2.diagnostics.bedHeightCeiling,2);assert.equal(r2.diagnostics.fineBedTriangles,r1.diagnostics.fineBedTriangles);
    const original=r1.candidate.children.find(n=>n.userData.body==='land').geometry,unchanged=r2.candidate.children.find(n=>n.userData.body==='land').geometry;assert.deepEqual(geoHashes(original),geoHashes(unchanged));
    for(let i=0;i<r1.candidate.children.length;i++){
      const a=r1.candidate.children[i].material,b=r2.candidate.children[i].material;if(!a)continue;
      for(const key of ['map','normalMap','roughnessMap'])assert.equal(a[key],b[key]);assert.equal(a.roughness,b.roughness);assert.equal(a.metalness,b.metalness);assert.deepEqual(a.normalScale.toArray(),b.normalScale.toArray());assert.equal(a.customProgramCacheKey(),b.customProgramCacheKey());assert.deepEqual(a.userData,b.userData);
    }
    const tracked=new Set();r2.group.traverse(n=>{if(n.geometry)tracked.add(n.geometry);if(n.material)tracked.add(n.material);});for(const patch of r2.patches)tracked.add(patch.sourceGeometry);let disposed=0;for(const resource of tracked)resource.addEventListener('dispose',()=>disposed++);
    r2.dispose();assert.equal(disposed,tracked.size);assert.equal(borrowedDisposals,0);r2.dispose();assert.equal(disposed,tracked.size);assert.equal(r2.surfaceAt(...shoreBankWorldXZ(0,-.3)),null);
  }finally{studies.forEach(s=>s.dispose());dry.dispose();bed.dispose();material.dispose();textures.forEach(t=>t.dispose());}
  assert.equal(borrowedDisposals,3);
});

test('unknown profile fails before any factory material allocation or borrowed resource mutation',()=>{
  const original=THREE.Material.prototype.dispose;let disposals=0;THREE.Material.prototype.dispose=function(){disposals++;return original.call(this);};
  try{assert.throws(()=>createShoreBankStudy({bedProfile:'not-a-profile'}),/unknown bed profile/);assert.throws(()=>createShoreBankFineBed(null,shoreBankSpec,{bedProfile:'not-a-profile'}),/unknown bed profile/);assert.throws(()=>shoreBankBedHeight(0,0,1,shoreBankSpec,'not-a-profile'),/unknown bed profile/);assert.equal(disposals,0);}finally{THREE.Material.prototype.dispose=original;}
});

test('an actual generated small pebble can be buried below the new shelf; full support must compare the visible union, not the stone alone',t=>{
  const source=readFileSync(new URL('../src/yuanmingyuan/shore-bank-study.js',import.meta.url),'utf8'),start=source.indexOf('function pebbleRecords(spec){'),end=source.indexOf('\n\n/** Detached',start);assert(start>=0&&end>start);
  const records=new Function('spec',source.slice(start,end)+'\nreturn pebbleRecords(spec);')(shoreBankSpec);
  const record=records.find(r=>Math.abs(r.s)<9&&-r.n+.1<shoreBankWidth(r.s)&&2*.82*r.scale[1]<r.burial-.0001);assert(record,'real existing scatter contains a fully buried small stone');
  const prototype=createShorePebbleGeometry(record.variant+1),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),stone=new THREE.InstancedMesh(prototype,material,1),[x,z]=shoreBankWorldXZ(record.s,record.n),matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),record.yaw),new THREE.Vector3(...record.scale)),point=new THREE.Vector3();let lift=-Infinity;
  for(let i=0;i<prototype.attributes.position.count;i++){point.fromBufferAttribute(prototype.attributes.position,i).applyMatrix4(matrix);lift=Math.max(lift,2-point.y);}matrix.elements[13]=lift-record.burial;stone.setMatrixAt(0,matrix);stone.getMatrixAt(0,matrix);stone.updateMatrixWorld(true);
  const collider=prototype.clone().applyMatrix4(matrix),floor=new THREE.BufferGeometry();floor.setAttribute('position',new THREE.Float32BufferAttribute([x-.2,2,z-.2,x+.2,2,z-.2,x+.2,2,z+.2,x-.2,2,z+.2],3));floor.setIndex([0,2,1,0,3,2]);floor.computeVertexNormals();const sampler=createTriangleSampler([floor,collider],1),floorMesh=new THREE.Mesh(floor,material);floorMesh.updateMatrixWorld(true);
  try{
    const ray=new THREE.Raycaster(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0)),stoneHit=ray.intersectObject(stone)[0],visible=ray.intersectObjects([stone,floorMesh])[0],support=sampler.sample(x,z);assert(stoneHit&&visible&&support);assert.equal(visible.object,floorMesh);assert.equal(support.geometry,floor);assert.equal(support.height,2);assert(support.height-stoneHit.point.y>.0001,'the former 20 micrometre all-stone assertion has a real false failure');assert(Math.abs(support.height-visible.point.y)<1e-12);
    t.diagnostic(JSON.stringify({sourceScatter:record,stoneY:stoneHit.point.y,visibleY:visible.point.y,supportY:support.height,oldComparisonError:support.height-stoneHit.point.y}));
  }finally{sampler.dispose();prototype.dispose();collider.dispose();floor.dispose();material.dispose();stone.dispose();}
});

test('R2 CPU contact avoids the recorded world Float32 re-quantization while R1 and actual instance bytes stay unchanged',t=>{
  // Execute only the real private collider-construction block: one original
  // 320-face prototype at the recorded Float32 instance matrix, no bank owner.
  const current=readFileSync(new URL('../src/yuanmingyuan/shore-bank-study.js',import.meta.url),'utf8'),old=readFileSync(new URL('shore-bank-study.js',freeze),'utf8');assert.equal(digest(old),'b2ef98296b1e8d1fc9297cc5cd247b5eb62f91c13bdfd2428b951fc6a912d16f');
  function contact(source,vertices,indices,bedProfile){
    const start=source.indexOf('const collider=register(new THREE.BufferGeometry());'),end=source.indexOf('pebbleSampler=createTriangleSampler',start);assert(start>=0&&end>start);
    return new Function('THREE','vertices','indices','bedProfile','curved','register','let collisionGeometry;'+source.slice(start,end)+'return collider;')(THREE,vertices,indices,bedProfile,bedProfile==='curved-r4',g=>g);
  }
  const matrix=new THREE.Matrix4().fromArray([.07575289905071259,0,-.09006618708372116,0,0,.04642673209309578,0,0,.07812152057886124,0,.06570646911859512,0,853.2732543945312,2.0158915519714355,-554.6624145507812,1]),query=[853.182049307423,-554.6556584899439];
  const prototype=createShorePebbleGeometry(2),material=new THREE.MeshStandardMaterial({roughness:.81,metalness:0}),instance=new THREE.InstancedMesh(prototype,material,1),geometries=[prototype],samplers=[];let released=0;
  instance.setMatrixAt(0,matrix);instance.getMatrixAt(0,matrix);instance.setColorAt(0,new THREE.Color('#7b776b').lerp(new THREE.Color('#aaa18c'),.1332810358144343*.72));instance.updateMatrixWorld(true);
  const before={prototype:geoHashes(prototype),matrix:digest(bytes(instance.instanceMatrix.array)),color:digest(bytes(instance.instanceColor.array))},point=new THREE.Vector3(),vertices=[];
  for(let i=0;i<prototype.attributes.position.count;i++){point.fromBufferAttribute(prototype.attributes.position,i).applyMatrix4(matrix);vertices.push(point.x,point.y,point.z);}
  try{
    const original=contact(old,vertices,[...prototype.index.array]),r1=contact(current,vertices,[...prototype.index.array],'r1'),r2=contact(current,vertices,[...prototype.index.array],'submerged-r2');geometries.push(original,r1,r2);
    assert.deepEqual(geoHashes(r1),geoHashes(original),'the default R1 collider keeps the frozen original bytes');assert(r1.attributes.position.array instanceof Float32Array);assert(r2.attributes.position.array instanceof Float64Array,'only R2 retains calculated world coordinates');assert.deepEqual(bytes(r2.index.array),bytes(r1.index.array));assert.deepEqual([...r2.attributes.position.array],vertices);
    const oldSampler=createTriangleSampler([r1],.5),nextSampler=createTriangleSampler([r2],.5);samplers.push(oldSampler,nextSampler);
    const ray=new THREE.Raycaster(new THREE.Vector3(query[0],8,query[1]),new THREE.Vector3(0,-1,0)),hit=ray.intersectObject(instance)[0],oldHit=oldSampler.sample(...query),nextHit=nextSampler.sample(...query);assert(hit&&oldHit&&nextHit);assert.equal(hit.faceIndex,126);assert.equal(nextHit.triangleIndex,126);
    const oldError=Math.abs(hit.point.y-oldHit.height),nextError=Math.abs(hit.point.y-nextHit.height);assert(Math.abs(hit.point.y-2.034277859841915)<1e-12);assert(Math.abs(oldError-.000028001836030799865)<1e-12,'preserved real failure exceeds the unchanged 20 micrometre tolerance');assert(oldError>.00002);assert(nextError<1e-12);assert(nextError<.00002);
    assert.deepEqual({prototype:geoHashes(prototype),matrix:digest(bytes(instance.instanceMatrix.array)),color:digest(bytes(instance.instanceColor.array))},before);assert(instance.geometry.attributes.position.array instanceof Float32Array);assert.equal(instance.material,material);assert.equal(material.roughness,.81);assert.equal(material.metalness,0);assert.equal(instance.children.length,0,'CPU contact geometry is never added to the display object');
    t.diagnostic(JSON.stringify({originalRayY:hit.point.y,r1SupportY:oldHit.height,r2SupportY:nextHit.height,oldError,nextError,unchangedTolerance:.00002,extraCPUPositionBytes:r2.attributes.position.array.byteLength-r1.attributes.position.array.byteLength}));
  }finally{samplers.forEach(s=>s.dispose());geometries.forEach(g=>{g.addEventListener('dispose',()=>released++);g.dispose();});instance.dispose();material.dispose();}
  assert.equal(released,4);
});
