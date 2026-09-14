import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {copperSwallowComponentSpecs} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {applySwallowPose,poseSwallowBodyPoint} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {copperSwallowPoseStudyId,copperSwallowPoseStudyViews} from '../src/yuanmingyuan/xieqiqu-swallow-pose-views.js';
import * as factory from '../src/yuanmingyuan/xieqiqu-swallow-pose-study.js';

test('the actual two eye meshes retain finite unit normals at unused sphere pole vertices without changing any rendered triangle',()=>{
  for(const spec of copperSwallowComponentSpecs.filter(p=>p.id.startsWith('eye-'))){
    const geometry=spec.create(),before=geometry.clone(),point=new THREE.Vector3(),connected=new Set(geometry.index.array);
    try{
      // Reproduce the previous complete run: Three computes zero accumulated
      // normals for the two sphere pole vertices not referenced by any face.
      const p=before.attributes.position;
      for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);poseSwallowBodyPoint(point,point);p.setXYZ(i,point.x,point.y,point.z);}
      before.computeVertexNormals();
      const zero=[];for(let i=0;i<p.count;i++)if(new THREE.Vector3().fromBufferAttribute(before.attributes.normal,i).lengthSq()===0)zero.push(i);
      assert.deepEqual(zero,[28,580]);assert.ok(zero.every(i=>!connected.has(i)));
      applySwallowPose(geometry,'eye');
      assert.deepEqual(geometry.attributes.position.array,before.attributes.position.array);
      assert.deepEqual(geometry.attributes.uv.array,before.attributes.uv.array);
      assert.deepEqual(geometry.index.array,before.index.array);
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(geometry.attributes.normal,i);assert.ok(Math.abs(point.length()-1)<2e-5,spec.id+' vertex '+i);
        if(connected.has(i))assert.deepEqual(point.toArray(),new THREE.Vector3().fromBufferAttribute(before.attributes.normal,i).toArray(),'every rendered normal must remain byte-identical');
      }
    }finally{geometry.dispose();before.dispose();}
  }
});

test('studio can import the seven pure views without any transitive factory dependency',async()=>{
  const text=await readFile(new URL('../src/yuanmingyuan/xieqiqu-swallow-pose-views.js',import.meta.url),'utf8');
  assert.doesNotMatch(text,/\bimport\b|\bexport\s+[^;]*\bfrom\b/);
  assert.equal(copperSwallowPoseStudyId,factory.copperSwallowPoseStudyId);
  assert.equal(copperSwallowPoseStudyViews,factory.copperSwallowPoseStudyViews);
  assert.deepEqual(Object.keys(copperSwallowPoseStudyViews),['threequarter','profile','front','top','head','wingfold','feet']);
});
