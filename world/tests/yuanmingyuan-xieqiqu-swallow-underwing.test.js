import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCopperSwallowWingGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {applySwallowPose} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {createSwallowUnderwingFeatherParts,createSwallowUnderwingGeometry,swallowUnderwingParameters} from '../src/yuanmingyuan/xieqiqu-swallow-underwing.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';
import {createXieqiquCopperSwallowUnderwingStudy,createXieqiquCopperSwallowUnderwingReviewStudy,createXieqiquCopperSwallowShortNeckStudy,createXieqiquCopperSwallowShortNeckReviewStudy} from '../src/yuanmingyuan/xieqiqu-swallow-shortneck-study.js';
import {copperSwallowUnderwingStudyId,copperSwallowUnderwingStudyViews} from '../src/yuanmingyuan/xieqiqu-swallow-underwing-views.js';
import {copperSwallowShortNeckStudyViews} from '../src/yuanmingyuan/xieqiqu-swallow-shortneck-views.js';

const sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const hashes=g=>Object.fromEntries([['index',sha(g.index.array)],...Object.entries(g.attributes).map(([k,a])=>[k,sha(a.array)])]);

async function frozenUnderwingR2(file){
  const directory=new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/underwing-r3-local/',import.meta.url),baseline=JSON.parse(readFileSync(new URL('baseline.json',directory))),source=readFileSync(new URL('before-source/world/'+file,directory),'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'),baseline.sources[file]);
  // Load the exact frozen R2 implementation; only resolve its module imports
  // to the existing unchanged source dependencies and installed Three package.
  const resolved=source.replace(/from\s+(['"])([^'"]+)\1/g,(_match,quote,spec)=>'from '+quote+(spec.startsWith('.')?new URL(spec,new URL('../'+file,import.meta.url)).href:import.meta.resolve(spec))+quote);
  return import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
}

test('R3 has broad volumetric vanes, thin terminal shells and all eight frozen comparison cameras',async t=>{
  const parts=createSwallowUnderwingFeatherParts(1),a=new THREE.Vector3(),b=new THREE.Vector3();let broadSections=0,minimumThickness=Infinity,maximumThickness=0;
  try{
    for(const part of parts){
      const p=part.geometry.attributes.position,{steps,sides}=part.geometry.userData;
      for(let row=Math.ceil(steps*.4);row<=Math.floor(steps*.6);row++)for(let j=sides/4-3;j<=sides/4+3;j++){
        a.fromBufferAttribute(p,row*sides+j);b.fromBufferAttribute(p,row*sides+sides-j);const thickness=a.distanceTo(b);
        assert(thickness>.012,part.id+' broad cast vane '+row+','+j);minimumThickness=Math.min(minimumThickness,thickness);maximumThickness=Math.max(maximumThickness,thickness);broadSections++;
      }
      for(const row of [0,steps]){a.fromBufferAttribute(p,row*sides+sides/4);b.fromBufferAttribute(p,row*sides+sides*3/4);assert(a.distanceTo(b)>.001&&a.distanceTo(b)<.0025,part.id+' closed thin terminal');}
    }
    const views=await frozenUnderwingR2('src/yuanmingyuan/xieqiqu-swallow-underwing-views.js');assert.deepEqual(copperSwallowUnderwingStudyViews,views.copperSwallowUnderwingStudyViews);
    t.diagnostic(JSON.stringify({broadSections,minimumThickness,maximumThickness,allEightViewsUnchanged:true,nativeArtAcceptance:false}));
  }finally{parts.forEach(p=>p.geometry.dispose());}
});

test('both actual underwing rows are closed, outward, finite full-resolution copper feather surfaces',t=>{
  const original=JSON.parse(readFileSync(new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/shortneck-full-first/results.json',import.meta.url))).diagnostics.bounds,bounds=new THREE.Box3(new THREE.Vector3(...original.min),new THREE.Vector3(...original.max));let triangles=0,minimumDot=1;
  for(const side of [-1,1]){
    const parts=createSwallowUnderwingFeatherParts(side);
    try{
      assert.equal(parts.length,25);assert.equal(parts.filter(p=>p.tier==='secondary').length,9);assert.equal(parts.filter(p=>p.tier==='primary').length,6);assert.equal(parts.filter(p=>p.tier==='lesser').length,10);
      for(const part of parts){
        const g=part.geometry,r=inspectClosedSculptureGeometry(g);assert.equal(r.connectedComponents,1);assert.equal(r.euler,2);assert.equal(r.boundaryEdges,0);assert.equal(r.nonManifoldEdges,0);assert.equal(r.inconsistentWindingEdges,0);assert.equal(r.degenerateFaces,0);assert.equal(r.inwardShadingFaces,0,part.id);assert(r.signedVolume>0);minimumDot=Math.min(minimumDot,r.minimumFaceNormalDot);triangles+=r.triangles;
        assert(Object.values(g.attributes).every(a=>[...a.array].every(Number.isFinite)));assert.equal(g.attributes.position.count,g.attributes.normal.count);assert.equal(g.attributes.position.count,g.attributes.uv.count);assert.equal(g.userData.underwing.engravedCuts,3);assert(bounds.containsBox(g.boundingBox),'no new feather expands the original whole-bird bounds');
        for(let i=0;i<g.attributes.normal.count;i++)assert(Math.abs(Math.hypot(g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i))-1)<2e-5);
      }
    }finally{parts.forEach(p=>p.geometry.dispose());}
  }
  assert.equal(triangles,388000);t.diagnostic(JSON.stringify({triangles,minimumDot,feathers:50,native:false}));
});

test('every actual posed root remains embedded and the complete feather silhouette stays inside the untouched wing',t=>{
  let checkedRoots=0,checkedRails=0,exposed=0,maxRelief=0;
  for(const side of [-1,1]){
  const carrier=createCopperSwallowWingGeometry(side);applySwallowPose(carrier,'wing');const original=hashes(carrier),tree=new MeshBVH(carrier,{indirect:true}),parts=createSwallowUnderwingFeatherParts(side),point=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),ray=new THREE.Ray();
  const sectionAt=p=>{ray.origin.set(p.x,0,p.z);ray.direction.copy(up);const lower=tree.raycastFirst(ray,THREE.DoubleSide);ray.origin.y=2;ray.direction.copy(down);const upper=tree.raycastFirst(ray,THREE.DoubleSide);assert(lower&&upper,'covert footprint must remain within the actual wing silhouette');return {lower:lower.point.y,upper:upper.point.y};};
  try{
    for(const part of parts){const g=part.geometry,p=g.attributes.position,{steps,sides}=g.userData;
      for(let j=0;j<sides;j++){point.fromBufferAttribute(p,j);const limits=sectionAt(point);assert(point.y>=limits.lower&&point.y<=limits.upper,part.id+' root '+j);checkedRoots++;}
      for(let row=0;row<=steps;row++){
        for(const j of [0,sides/2]){point.fromBufferAttribute(p,row*sides+j);sectionAt(point);checkedRails++;}
        point.fromBufferAttribute(p,row*sides+sides/4);const lower=sectionAt(point).lower,relief=lower-point.y;if(relief>.0003)exposed++;maxRelief=Math.max(maxRelief,relief);
      }
    }
    assert(exposed>1000);assert(maxRelief>.025&&maxRelief<.045);assert.deepEqual(hashes(carrier),original);
  }finally{carrier.dispose();parts.forEach(p=>p.geometry.dispose());}
  }
  t.diagnostic(JSON.stringify({checkedRoots,checkedRails,exposed,maxRelief,carrierBytesUnchanged:true}));
});

test('short coverts have true parent-volume contacts and rooted smooth spans; neighboring secondaries really overlap',t=>{
  let contacts=0,adjacentIntersections=0,maximumAirGap=0,maximumBridge=0;const identity=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),down=up.clone().negate(),point=new THREE.Vector3(),ray=new THREE.Ray();
  for(const side of [-1,1]){
    const carrier=createCopperSwallowWingGeometry(side);applySwallowPose(carrier,'wing');const parts=createSwallowUnderwingFeatherParts(side),long=parts.filter(p=>p.tier!=='lesser'),parent=mergeGeometries([carrier,...long.map(p=>p.geometry)],false),tree=new MeshBVH(parent,{indirect:true});
    try{
      for(const part of parts.filter(p=>p.tier==='lesser')){
        const g=part.geometry,p=g.attributes.position,{steps,sides,parentSupport:support,parentContacts:sampled}=g.userData,inner=new THREE.Vector3().fromBufferAttribute(p,support.witness.row*sides+sides*3/4),shortTree=new MeshBVH(g,{indirect:true});
        assert(support.amplitude>0&&support.amplitude<.035,part.id+' finite physical span');assert(support.start>=0&&support.end<=1&&support.start<support.end);
        ray.origin.set(inner.x,parent.boundingBox.min.y-.1,inner.z);ray.direction.copy(up);const hit=tree.raycastFirst(ray,THREE.DoubleSide);assert(hit);assert(hit.point.distanceTo(new THREE.Vector3(...support.witness.parentPoint))<1e-7);assert(Math.abs(inner.y-hit.point.y-.0003)<1e-7,part.id+' real contact depth');
        // The parent witness must be inside the new closed short feather, not
        // just inside its AABB or a stored authoring assertion.
        point.copy(hit.point);for(const direction of [up,down]){const inside=shortTree.raycastFirst(new THREE.Ray(point,direction),THREE.DoubleSide);assert(inside&&inside.distance>1e-7&&inside.face.normal.dot(direction)>0,part.id+' true closed overlap');}contacts++;
        assert.equal(sampled.length,steps);assert(sampled.every(c=>Number.isFinite(c.innerY)&&c.weight>=0&&c.weight<=1));
        for(const c of sampled){assert.equal(c.innerY,p.getY(c.row*sides+sides*3/4));maximumAirGap=Math.max(maximumAirGap,c.gap);}maximumBridge=Math.max(maximumBridge,support.amplitude);
      }
      const secondary=parts.filter(p=>p.tier==='secondary');for(const p of secondary)p.geometry.boundsTree=new MeshBVH(p.geometry,{indirect:true});
      for(let i=0;i<secondary.length-1;i++){assert(secondary[i].geometry.boundsTree.intersectsGeometry(secondary[i+1].geometry,identity),secondary[i].id+' adjacent actual triangle overlap');adjacentIntersections++;}
    }finally{parent.dispose();carrier.dispose();parts.forEach(p=>{delete p.geometry.boundsTree;p.geometry.dispose();});}
  }
  // Small air pockets between rooted cast vanes are intentional. No part is
  // supported by an AABB or held floating above its only attachment.
  assert.equal(contacts,20);assert.equal(adjacentIntersections,16);assert(maximumAirGap<.009);
  t.diagnostic(JSON.stringify({contacts,adjacentIntersections,maximumAirGap,maximumBridge,testsUseActualTriangles:true}));
});

test('one draw per wing retains every component index and attribute without simplification',()=>{
  const parts=createSwallowUnderwingFeatherParts(1),merged=createSwallowUnderwingGeometry(1);let first=0,vertices=0;
  try{
    assert.equal(merged.userData.underwing.components.length,parts.length);assert.equal(merged.index.count,parts.reduce((n,p)=>n+p.geometry.index.count,0));
    for(let i=0;i<parts.length;i++){
      const g=parts[i].geometry,range=merged.userData.underwing.components[i];assert.equal(range.firstIndex,first);assert.equal(range.id,parts[i].id);
      for(const [name,a]of Object.entries(g.attributes))assert.deepEqual(merged.attributes[name].array.subarray(vertices*a.itemSize,(vertices+a.count)*a.itemSize),a.array);
      for(let j=0;j<g.index.count;j++)assert.equal(merged.index.getX(first+j)-vertices,g.index.getX(j));first+=g.index.count;vertices+=g.attributes.position.count;
    }
  }finally{merged.dispose();parts.forEach(p=>p.geometry.dispose());}
});

test('invalid and cancelled local builders clean only their own geometry without touching source materials',()=>{
  for(const side of [0,2,NaN,null])assert.throws(()=>createSwallowUnderwingGeometry(side),/side/);
  assert.throws(()=>createSwallowUnderwingGeometry(1,{signal:AbortSignal.abort()}),{name:'AbortError'});
  const original=THREE.BufferGeometry.prototype.dispose,counts=new Map();let reads=0;
  THREE.BufferGeometry.prototype.dispose=function(){counts.set(this,(counts.get(this)??0)+1);return original.call(this);};
  try{
    for(const [limit,expected,create]of [[4,4,createSwallowUnderwingFeatherParts],[16,18,createSwallowUnderwingFeatherParts],[28,29,createSwallowUnderwingGeometry]]){
      counts.clear();reads=0;assert.throws(()=>create(1,{signal:{get aborted(){return ++reads>limit;}}}),{name:'AbortError'});assert.equal(counts.size,expected,'actual cleanup at phase '+limit);assert([...counts.values()].every(n=>n===1));
      if(limit>=16)assert([...counts.keys()].some(g=>g.name==='underwing-short-covert-contact-parent'));
    }
  }finally{THREE.BufferGeometry.prototype.dispose=original;}
});

test('original wing, upper feathers, pose and neck stay byte-frozen',()=>{
  const baseline=JSON.parse(readFileSync(new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/underwing-local-r1/before-source.json',import.meta.url)));
  for(const [file,expected]of Object.entries(baseline))if(!file.endsWith('xieqiqu-swallow-shortneck-study.js'))assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+file,import.meta.url))).digest('hex'),expected,file);
  assert.equal(swallowUnderwingParameters.evidence,'authored copper feather arrangement; historical underside not documented');
});

test('separate candidate entries cancel before geometry or material allocation and pure views preserve the native comparison camera',()=>{
  const original=THREE.BufferGeometry.prototype.dispose;let disposed=0;THREE.BufferGeometry.prototype.dispose=function(){disposed++;return original.call(this);};
  try{
    for(const create of [createXieqiquCopperSwallowUnderwingStudy,createXieqiquCopperSwallowUnderwingReviewStudy])assert.throws(()=>create({signal:AbortSignal.abort()}),{name:'AbortError'});
    for(const create of [createXieqiquCopperSwallowShortNeckStudy,createXieqiquCopperSwallowShortNeckReviewStudy])assert.throws(()=>create({underwingCoverts:'yes'}),/explicit boolean/);
    assert.equal(disposed,0);assert.equal(copperSwallowUnderwingStudyId,'xieqiqu-copper-swallow-shortneck-underwing-r3');assert.deepEqual(copperSwallowUnderwingStudyViews.profile,copperSwallowShortNeckStudyViews.profile);assert.deepEqual(copperSwallowUnderwingStudyViews.head,copperSwallowShortNeckStudyViews.head);
    const source=readFileSync(new URL('../src/yuanmingyuan/xieqiqu-swallow-underwing-views.js',import.meta.url),'utf8');assert.doesNotMatch(source,/study\.js|underwing\.js|three/);assert.match(source,/shortneck-views\.js/);
  }finally{THREE.BufferGeometry.prototype.dispose=original;}
});
