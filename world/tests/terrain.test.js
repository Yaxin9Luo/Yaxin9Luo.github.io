import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld,islandGeometry,terrainHeight,renderedTerrainHeight} from '../src/world.js';
import {locations,bridges} from '../src/locations.js';
import {bridgeBankClearance} from './helpers/bridge-bank-clearance.js';
import {authoredGradeSamples} from './helpers/authored-grades.js';

test('castle shoulders descend to two open coves while authored route levels stay fixed',()=>{
  assert.ok(terrainHeight(0,-75)>10,'rear castle shoulder rises above the outer meadow');
  assert.ok(terrainHeight(-39,-38)>8&&terrainHeight(39,-42)>8,'both castle flanks continue the precinct');
  for(const [x,z]of [[96,36],[0,94]])assert.equal(terrainHeight(x,z),-22,'the east and south coves open to the lake');
  for(const [x,z]of [[91,32],[-22,94]])assert.ok(terrainHeight(x,z)<0&&terrainHeight(x,z)>-13,'low banks slope toward the cove');
  for(const [x,z,y]of [[0,17,6],[-24,38,6.174077339537973],[-66,65,5.5963098418824675],[48,80,7.385671904391492],[45,54,6]])assert.ok(Math.abs(terrainHeight(x,z)-y)<1e-8,'authored roads, grove walks and exhibits retain their grade');
  for(const ends of Object.values(bridges))for(const [x,z]of ends)assert.equal(terrainHeight(x,z),7);
});

test('coves have unequal inlets separated by a connected headland and broad rock benches',()=>{
  assert.equal(terrainHeight(-10,90),-22,'south inlet reaches its irregular inner bay');
  assert.ok(terrainHeight(6,94)>0,'a projecting rock headland interrupts the low banks between unequal south recesses');
  assert.ok(Math.abs(terrainHeight(-27,84)-terrainHeight(-27,82))<.8,'a broad middle bench interrupts the bank slope');
  assert.ok(terrainHeight(-27,78)-terrainHeight(-27,84)>2,'the next rock riser creates real vertical relief');
});

test('one connected low bank interrupts the south bay shelves at lake level',()=>{
  assert.ok(terrainHeight(-10,87)>-15&&terrainHeight(-10,87)<-14,'the descent reaches the lake without a raised rim');
  const heights=[78,80,82,84,86,87].map(z=>terrainHeight(-10,z));
  for(let i=1;i<heights.length;i++)assert.ok(heights[i]<heights[i-1]-.15,'the low bank crosses the middle shelf continuously');
  assert.ok(terrainHeight(6,94)>0,'the existing connected headland stays raised');
});

test('actual ground and cliff faces clear both viaduct rail footprints above the deck',()=>{
  const terrain=islandGeometry();
  for(const result of bridgeBankClearance([terrain.ground,terrain.cliffs])){
    assert.ok(result.faces>100);
    assert.ok(result.maximum<=result.ceiling,`${result.name} bank reaches ${result.maximum} at ${JSON.stringify(result.point)}, above ${result.ceiling}`);
  }
  terrain.ground.dispose();terrain.cliffs.dispose();
});

test('clipped shore triangle interiors expose the same support height as their rendered vertices',()=>{
  const {ground,cliffs}=islandGeometry(),p=ground.attributes.position,index=ground.index;let checked=0;
  for(let i=0;i<index.count;i+=3){
    const vertices=[0,1,2].map(j=>index.getX(i+j));
    if(!vertices.some(j=>Math.abs(p.getX(j)*2-Math.round(p.getX(j)*2))>1e-5||Math.abs(p.getZ(j)*2-Math.round(p.getZ(j)*2))>1e-5))continue;
    const x=vertices.reduce((sum,j)=>sum+p.getX(j),0)/3,z=vertices.reduce((sum,j)=>sum+p.getZ(j),0)/3,y=vertices.reduce((sum,j)=>sum+p.getY(j),0)/3;
    assert.ok(Math.abs(renderedTerrainHeight(x,z)-y)<.025,`shore support detached at ${x}, ${z}: ${renderedTerrainHeight(x,z)} vs ${y}`);checked++;
  }
  assert.ok(checked>1000);ground.dispose();cliffs.dispose();
});

test('sculpted terrain stays finite and shares every open ground edge with the cliff top',()=>{
  const {ground,cliffs,shore}=islandGeometry(),edges=new Map(),p=ground.attributes.position,index=ground.index;
  const parents=Uint32Array.from({length:p.count},(_,i)=>i),root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(const geometry of [ground,cliffs]){
    for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    geometry.computeBoundingBox();assert.ok(geometry.boundingBox.min.y>=-24.01&&geometry.boundingBox.max.y<24);
  }
  for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){
    const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=a<b?`${a}/${b}`:`${b}/${a}`;
    parents[root(b)]=root(a);
    const edge=edges.get(key)||{count:0,a,b};edge.count++;edges.set(key,edge);
  }
  assert.equal(new Set(Array.from(parents,(_,i)=>root(i))).size,3,'only the main island and the two bridged satellite islands remain');
  const top=new Set(),cp=cliffs.attributes.position,ci=cliffs.index,key=j=>`${p.getX(j)},${p.getY(j)},${p.getZ(j)}`;
  for(let i=0;i<ci.count;i+=192)for(const j of [ci.getX(i),ci.getX(i+2)])top.add(`${cp.getX(j)},${cp.getY(j)},${cp.getZ(j)}`);
  let boundary=0;for(const edge of edges.values()){
    assert.ok(edge.count<=2,'no terrain edge belongs to more than two triangles');
    if(edge.count===1){assert.ok(top.has(key(edge.a))&&top.has(key(edge.b)),'cliff shell closes the ground rim');boundary++;}
  }
  assert.equal(boundary,shore.length);ground.dispose();cliffs.dispose();
});

test('authored garden interiors and fixed landmark pads override nearby bank blends',()=>{
  for(const p of authoredGradeSamples()){
    assert.ok(Math.abs(terrainHeight(p.x,p.z)-p.y)<1e-8,`${p.id} source grade at ${p.x},${p.z}`);
    assert.ok(Math.abs(renderedTerrainHeight(p.x,p.z)-p.y)<.025,`${p.id} rendered grade at ${p.x},${p.z}`);
  }
});

test('all gate foundations meet their graded ground',()=>{
  for(const x of [-29,0,29])for(const z of [-61,-38,-15])assert.ok(Math.abs(terrainHeight(x,z)-9)<.06,'entire rectangular castle foundation is supported');
  for(const l of locations)for(const x of [-3.8,0,3.8])for(const z of [-1.4,0,1.4]){
    assert.ok(Math.abs(terrainHeight(l.x+x,l.z+l.radius+3+z)-l.y)<.06,`${l.id} foundation`);
  }
});

test('road triangle interiors stay above the rendered hillside and use bridges over water',()=>{
  const world=createWorld(new THREE.Scene(),{herbarium:false});
  const point=new THREE.Vector3(),vertex=new THREE.Vector3();
  const roads=world.root.children.filter(o=>o.name.startsWith('road-'));
  const centres=roads.filter(o=>!o.name.includes('planted-shoulder')),shoulders=roads.filter(o=>o.name.includes('planted-shoulder'));
  assert.equal(centres.length,8);
  for(const road of centres){assert.ok(shoulders.some(o=>o.name===`${road.name}-planted-shoulder--1`));assert.ok(shoulders.some(o=>o.name===`${road.name}-planted-shoulder-1`));}
  assert.equal(shoulders.length,centres.length*2);
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
