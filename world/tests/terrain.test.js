import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld,terrainHeight,renderedTerrainHeight} from '../src/world.js';
import {locations} from '../src/locations.js';

test('all gate foundations meet their graded ground',()=>{
  for(const l of locations)for(const x of [-3.8,0,3.8])for(const z of [-1.4,0,1.4]){
    assert.ok(Math.abs(terrainHeight(l.x+x,l.z+l.radius+3+z)-l.y)<.06,`${l.id} foundation`);
  }
});

test('road triangle interiors stay above the rendered hillside and use bridges over water',()=>{
  const world=createWorld(new THREE.Scene());
  const point=new THREE.Vector3(),vertex=new THREE.Vector3();
  const roads=world.root.children.filter(o=>o.name.startsWith('road-'));
  assert.equal(roads.length,8);
  for(const road of roads){
    const p=road.geometry.attributes.position,index=road.geometry.index;
    for(let k=0;k<index.count;k+=3){
      point.set(0,0,0);
      for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(p,index.getX(k+j)));
      point.multiplyScalar(1/3);
      const ground=renderedTerrainHeight(point.x,point.z),gap=point.y-ground;
      assert.ok(ground>0,`${road.name} crossed a shoreline gap`);
      assert.ok(gap>=0&&gap<.16,`${road.name} detached by ${gap} m at ${point.x}, ${point.z}`);
    }
  }
  world.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});
});
