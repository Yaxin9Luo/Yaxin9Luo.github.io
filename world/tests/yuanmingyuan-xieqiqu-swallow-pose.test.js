import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applySwallowPose,poseSwallowBodyPoint,poseSwallowWingPoint,swallowPoseBodyDrop,swallowPoseMouth,createBentSwallowLegGeometry,swallowPoseLegSections} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {createCopperSwallowWingGeometry,createCopperSwallowToeGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {swallowBodyProfile} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {swallowWingFeatherSpecs} from '../src/yuanmingyuan/xieqiqu-swallow-feathers.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

const point=new THREE.Vector3(),direction=new THREE.Vector3(0,1,0);
function closed(g){const r=inspectClosedSculptureGeometry(g);assert.equal(r.degenerateFaces,0);assert.equal(r.inwardShadingFaces,0,JSON.stringify({name:g.name,minDot:r.minimumFaceNormalDot,count:r.inwardShadingFaces}));assert.equal(r.boundaryEdges,0);assert.equal(r.nonManifoldEdges,0);assert.equal(r.inconsistentWindingEdges,0);assert.equal(r.euler,2);assert.ok(r.signedVolume>0);return r;}

test('the separate pose leaves the entire mouth region fixed and preserves orientation while moving the torso',()=>{
  assert.deepEqual(poseSwallowBodyPoint(new THREE.Vector3(...swallowPoseMouth)).toArray(),swallowPoseMouth);
  for(const z of [.38,.390,.455,.470,.54,.579])for(const x of [-.1,0,.1])assert.deepEqual(poseSwallowBodyPoint(new THREE.Vector3(x,.6,z)).toArray(),[x,.6,z]);
  for(const transform of [poseSwallowBodyPoint,poseSwallowWingPoint])for(const x of [.075,.11,.19,.25,.5,.8,1.1])for(const z of [-.7,-.3,0,.25]){
    const p=new THREE.Vector3(x,.55,z),h=1e-6,columns=[0,1,2].map(i=>{const a=p.clone(),b=p.clone();a.setComponent(i,a.getComponent(i)+h);b.setComponent(i,b.getComponent(i)-h);return transform(a).sub(transform(b)).multiplyScalar(.5/h);});
    const determinant=columns[0].dot(columns[1].clone().cross(columns[2]));assert.ok(determinant>.15,'local finite thickness must keep a positive orientation');if(transform===poseSwallowBodyPoint)assert.ok(Math.abs(determinant-1)<1e-8);
    const positive=transform(p),negative=transform(new THREE.Vector3(-p.x,p.y,p.z));assert.ok(positive.distanceTo(new THREE.Vector3(-negative.x,negative.y,negative.z))<1e-12);
  }
  assert.equal(swallowPoseBodyDrop(.015),.185);
});

test('the short bent leg is a real closed surface with a buried root and the original foot connection',()=>{
  const g=createBentSwallowLegGeometry(1),tree=new MeshBVH(g,{indirect:true});
  try{
    const r=closed(g),sections=swallowPoseLegSections(1);assert.ok(sections[2][2]<sections[1][2]&&sections[2][2]<sections[4][2],'hock bends back rather than forming a straight stilt');
    let embedded=0;for(let j=0;j<32;j++){point.fromBufferAttribute(g.attributes.position,j);const profile=swallowBodyProfile(point.z),cy=profile.centerY-swallowPoseBodyDrop(point.z);assert.ok((point.x/profile.width)**2+((point.y-cy)/profile.height)**2<1);embedded++;}
    for(const toe of [-1,0,1,2]){const t=createCopperSwallowToeGeometry(1,toe);try{for(let j=0;j<t.userData.sides;j++){point.fromBufferAttribute(t.attributes.position,j);for(const sign of [-1,1]){direction.set(0,sign,0);const hit=tree.raycastFirst(new THREE.Ray(point,direction),THREE.DoubleSide);assert.ok(hit&&hit.face.normal.dot(direction)>0,'same original toe cap must remain in the new ankle');}}}finally{t.dispose();}}
    console.log('POSE_LEG '+JSON.stringify({triangles:r.triangles,minDot:r.minimumFaceNormalDot,embeddedRoot:embedded}));
  }finally{g.dispose();}
});

test('one full-resolution wing and graduated feathers keep indices/UVs, closed surfaces and buried roots',()=>{
  const wing=createCopperSwallowWingGeometry(1),oldIds=wing.index.array.slice(),oldUV=wing.attributes.uv.array.slice();applySwallowPose(wing,'wing');
  const tree=new MeshBVH(wing,{indirect:true});let count=0,triangles=0,minDot=1;const lengths=[];
  try{
    assert.deepEqual(wing.index.array,oldIds);assert.deepEqual(wing.attributes.uv.array,oldUV);closed(wing);assert.throws(()=>applySwallowPose(wing,'wing'),/only once/);
    for(const spec of swallowWingFeatherSpecs(1)){
      const g=spec.create(),ids=g.index.array.slice(),uv=g.attributes.uv.array.slice(),primary=spec.id.startsWith('primary-')?Number(spec.id.split('-').at(-1)):null;
      try{
        applySwallowPose(g,'feather',{primaryIndex:primary});const seam=g.userData.poseCapSeams;assert.equal(g.index.count,ids.length);assert.deepEqual(g.index.array.subarray(0,seam.retainedSkinIndexCount),ids.subarray(0,seam.retainedSkinIndexCount));assert.deepEqual(g.attributes.uv.array.subarray(0,uv.length),uv);
        for(let i=seam.retainedSkinIndexCount;i<ids.length;i++){const a=new THREE.Vector3().fromBufferAttribute(g.attributes.position,ids[i]),b=new THREE.Vector3().fromBufferAttribute(g.attributes.position,g.index.array[i]);assert.deepEqual(a.toArray(),b.toArray(),'separate cap normals must preserve exact triangle coordinates');}
        const r=closed(g);triangles+=r.triangles;minDot=Math.min(minDot,r.minimumFaceNormalDot);
        for(let j=0;j<g.userData.sides;j++){point.fromBufferAttribute(g.attributes.position,j);for(const sign of [-1,1]){direction.set(0,sign,0);const hit=tree.raycastFirst(new THREE.Ray(point,direction),THREE.DoubleSide);assert.ok(hit&&hit.face.normal.dot(direction)>0,spec.id+' root '+j);}}
        if(primary!==null){const {steps,sides}=g.userData,start=new THREE.Vector3(),end=new THREE.Vector3();for(let j=0;j<sides;j++){start.add(new THREE.Vector3().fromBufferAttribute(g.attributes.position,j));end.add(new THREE.Vector3().fromBufferAttribute(g.attributes.position,steps*sides+j));}lengths.push(end.sub(start).length()/sides);}count++;
      }finally{g.dispose();}
    }
    assert.equal(count,31);assert.equal(lengths.indexOf(Math.max(...lengths)),1);assert.ok(Math.min(...lengths)/Math.max(...lengths)<.65);
    console.log('POSE_WING '+JSON.stringify({feathers:count,featherTriangles:triangles,minDot,primaryLengths:lengths}));
  }finally{wing.dispose();}
});
