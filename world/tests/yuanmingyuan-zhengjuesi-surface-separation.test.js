import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {zhengjuesiPlan} from '../src/yuanmingyuan/zhengjuesi-layout.js';
import {namedGroup} from '../src/yuanmingyuan/study-geometry.js';
import {ZhengjuesiBuilder,zhengjuesiPlinth} from '../src/yuanmingyuan/zhengjuesi-architecture.js';

const source=readFileSync(new URL('../src/yuanmingyuan/zhengjuesi-study.js',import.meta.url),'utf8');
const body=source.match(/function pave\(b, parent, name,[\s\S]*?(?=\nfunction buildCourts\()/)?.[0];
assert.ok(body);
const pave=new Function('THREE','namedGroup',`${body}\nreturn pave;`)(THREE,namedGroup);
function upperSurface(root,material,x=.31,z=.11){
  root.updateMatrixWorld(true);
  const hits=new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0)).intersectObject(root,true).filter(hit=>hit.object.material===material);
  assert.ok(hits.length,'Expected a real support surface');return hits[0].point.y;
}

test('actual hall platform retains paving height with its masonry core hidden below the stone cap',()=>{
  const b=new ZhengjuesiBuilder(),root=new THREE.Group(),floor=.64;
  try{
    zhengjuesiPlinth(b,root,{id:'test-hall',width:4,depth:3,bays:3,floor});b.flush();
    const bed=upperSurface(root,b.m.foundation),cap=upperSurface(root,b.m.stone),paving=upperSurface(root,b.m.paving);
    assert.ok(cap-bed>.08,'Core and cap tops are coplanar');
    assert.ok(paving-cap>.001&&paving-cap<.006,'Paving relief changed');
    assert.ok(Math.abs(paving-(floor+.003))<1e-5,'Existing walkable elevation changed');
  }finally{b.dispose();root.clear();}
});

test('actual courtyard and elevated link beds stay below the paving face',()=>{
  for(const top of [.025,.68]){
    const b=new ZhengjuesiBuilder(),root=new THREE.Group();
    try{
      pave(b,root,'court',0,0,4,3,top);b.flush();
      const bed=upperSurface(root,b.m.foundation),surface=upperSurface(root,b.m.paving);
      assert.ok(surface-bed>.019,'Paver top competes with its masonry bed');
      assert.ok(Math.abs(surface-top)<1e-6,'Court or raised-link height changed');
    }finally{b.dispose();root.clear();}
  }
});

// Run the actual rear-annex support prefix, without constructing the hall.
const annexPrefix=source.match(/function rearAnnex\(b, parent, spec\) \{[\s\S]*?(?=  const frame = namedGroup)/)?.[0];
assert.ok(annexPrefix);
const annexSupport=new Function('namedGroup','buildingGroup',`${annexPrefix}\nreturn group; }\nreturn rearAnnex;`)(namedGroup,(parent,spec)=>{const g=namedGroup(parent,spec.id);g.position.set(spec.center[0],0,spec.center[1]);return g;});

test('main-hall and rear-annex caps meet without duplicate horizontal faces',()=>{
  const spec=zhengjuesiPlan.axis.find(item=>item.id.endsWith('sanshengdian'));
  const b=new ZhengjuesiBuilder(),root=new THREE.Group();
  try{
    zhengjuesiPlinth(b,root,spec);annexSupport(b,root,spec);b.flush();root.updateMatrixWorld(true);
    for(const z of [-9.55,-10.3,-10.36,-10.4,-12]){
      const hits=new THREE.Raycaster(new THREE.Vector3(.7690476,3,z),new THREE.Vector3(0,-1,0)).intersectObject(root,true);
      const topStone=hits.filter(hit=>hit.object.material===b.m.stone&&hit.point.y>spec.floor-.015);
      const surfaces=new Set(topStone.map(hit=>`${hit.object.uuid}:${hit.instanceId}`));
      assert.ok(surfaces.size<=1,`overlapping stone caps at z=${z}: ${JSON.stringify(topStone.map(hit=>({parent:hit.object.parent.name,y:hit.point.y,instance:hit.instanceId})))}`);
      assert.ok(hits.length&&Math.abs(hits[0].point.y-spec.floor)<.08,`the join lost its walkable support at z=${z}`);
    }
  }finally{b.dispose();root.clear();}
});
