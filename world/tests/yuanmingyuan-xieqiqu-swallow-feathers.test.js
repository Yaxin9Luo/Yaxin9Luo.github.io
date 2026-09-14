import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {swallowWingFeatherSpecs} from '../src/yuanmingyuan/xieqiqu-swallow-feathers.js';
import {createCopperSwallowWingGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';

test('real primary feather has closed outward thickness and no broad flat extruded edge',()=>{
  const g=swallowWingFeatherSpecs(1)[0].create(),p=g.attributes.position,ids=g.index.array,edges=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0,minDot=1;
  try{
    for(let i=0;i<ids.length;i+=3){a.fromBufferAttribute(p,ids[i]);b.fromBufferAttribute(p,ids[i+1]);c.fromBufferAttribute(p,ids[i+2]);volume+=a.dot(b.clone().cross(c))/6;const face=b.sub(a).cross(c.sub(a)).normalize(),n=new THREE.Vector3();for(let j=0;j<3;j++){n.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,ids[i+j]));const x=ids[i+j],y=ids[i+(j+1)%3],key=Math.min(x,y)*p.count+Math.max(x,y),v=edges.get(key)??[0,0];v[0]++;v[1]+=x<y?1:-1;edges.set(key,v);}minDot=Math.min(minDot,face.dot(n.normalize()));}
    assert.ok(volume>0);assert.ok(minDot>0);assert.ok([...edges.values()].every(([n,d])=>n===2&&d===0));assert.equal(p.count-edges.size+ids.length/3,2);assert.ok(g.boundingBox.getSize(new THREE.Vector3()).y<.16);
  }finally{g.dispose();}
});

test('feather root caps fit inside the actual thin wing on both mirrored sides',()=>{
  for(const side of [-1,1]){
    const wing=createCopperSwallowWingGeometry(side),tree=new MeshBVH(wing,{indirect:true});let checked=0;
    try{for(const spec of swallowWingFeatherSpecs(side)){const feather=spec.create();try{const p=feather.attributes.position,rays=[new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)];for(let corner=0;corner<feather.userData.sides;corner++){const root=new THREE.Vector3().fromBufferAttribute(p,corner);for(const direction of rays){const hit=tree.raycastFirst(new THREE.Ray(root,direction),THREE.DoubleSide);assert.ok(hit&&hit.face.normal.dot(direction)>0,spec.id+' cap corner '+corner+' outside the actual wing');}}checked++;}finally{feather.dispose();}}assert.equal(checked,31);}finally{wing.dispose();}
  }
});

test('curved feather centres emerge once from the real carrier rather than slicing back through it',()=>{
  const wing=createCopperSwallowWingGeometry(1),tree=new MeshBVH(wing,{indirect:true}),down=new THREE.Vector3(0,-1,0);
  try{for(const spec of swallowWingFeatherSpecs(1)){const g=spec.create(),p=g.attributes.position,{steps,sides}=g.userData;let emerged=false,samples=0;
    try{for(let row=0;row<=steps;row++){const centre=new THREE.Vector3();for(let j=0;j<sides;j++)centre.add(new THREE.Vector3().fromBufferAttribute(p,row*sides+j));centre.divideScalar(sides);const hit=tree.raycastFirst(new THREE.Ray(new THREE.Vector3(centre.x,2,centre.z),down),THREE.DoubleSide);if(!hit)continue;const delta=centre.y-hit.point.y;if(delta>.0001)emerged=true;else if(delta<-.0001)assert.equal(emerged,false,spec.id+' re-enters the actual carrier at row '+row);samples++;}assert.ok(samples>3);}finally{g.dispose();}
  }}finally{wing.dispose();}
});
