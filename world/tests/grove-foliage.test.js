import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createGroveTree,createGroveShrub,createGardenFlower} from '../src/grove-foliage.js';
import {createVegetation} from '../src/landscape.js';

const trees=new Map(['pine','silver','cherry'].map(kind=>[kind,createGroveTree(kind,168)]));
const triangles=group=>group.children.reduce((sum,o)=>sum+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);

test('detailed trees keep opaque textured leaf surfaces, fine branches and the existing metre envelope',()=>{
  for(const [kind,tree]of trees){
    const leaf=tree.leavesMesh,trunk=tree.branchesMesh,bounds=new THREE.Box3().setFromObject(tree);
    assert.equal(tree.children.length,2,'shared instancing interface remains two material batches');
    assert.ok(triangles(tree)>40000&&triangles(tree)<(kind==='cherry'?400000:90000),'authored quality budget');
    assert.equal(leaf.material.alphaTest,0);assert.equal(leaf.material.transparent,false);
    for(const material of[leaf.material,trunk.material])for(const channel of['map','normalMap']){
      const image=material[channel]?.image;assert.ok(image?.data&&image.width>=128&&image.height>=256,'real local pigment and relief');
      for(let i=3;i<image.data.length;i+=4)assert.equal(image.data[i],255,'texture never removes the actual geometry silhouette');
      assert.ok(new Set(image.data.filter((_,i)=>i%4!==3)).size>12,'detail map is not a flat fallback');
    }
    assert.ok(trunk.geometry.attributes.position.count<leaf.geometry.attributes.position.count/3,'branches stay visually secondary');
    assert.ok(bounds.max.y<11&&bounds.min.y>(kind==='cherry'?-.25:-.12)&&bounds.getSize(new THREE.Vector3()).x<(kind==='cherry'?10.5:7.2),kind);
  }
});

test('the crown surface is made of small botanical pieces instead of metre-sized smooth balls',()=>{
  for(const [kind,tree]of trees){
    const geometry=tree.leavesMesh.geometry,p=geometry.attributes.position,ids=new Map(),parents=[],points=[],count=geometry.index?.count||p.count;
    const find=id=>{while(parents[id]!==id){parents[id]=parents[parents[id]];id=parents[id];}return id;};
    for(let i=0;i<count;i+=3){
      const face=[];
      for(let j=0;j<3;j++){
        const at=geometry.index?geometry.index.getX(i+j):i+j,q=[p.getX(at),p.getY(at),p.getZ(at)],key=q.map(v=>Math.round(v*1e5)).join(',');let id=ids.get(key);
        if(id===undefined){id=parents.length;ids.set(key,id);parents.push(id);points.push(q);}face.push(id);
      }
      parents[find(face[1])]=find(face[0]);parents[find(face[2])]=find(face[0]);
    }
    const components=new Map();
    points.forEach((p,i)=>{const id=find(i);if(!components.has(id))components.set(id,new THREE.Box3());components.get(id).expandByPoint(new THREE.Vector3(...p));});
    assert.ok(components.size>500,`${kind} needs independently shaped leaves or needle groups`);
    const sizes=[...components.values()].map(b=>b.getSize(new THREE.Vector3()).length()).sort((a,b)=>a-b);
    assert.ok(sizes[Math.floor(sizes.length*.99)]<1.05,`${kind} cannot regress to giant crown spheres`);
  }
});

test('actual leaf rays preserve a readable crown from both principal viewing directions',()=>{
  for(const [kind,tree]of trees){
    const leaf=tree.leavesMesh,b=new THREE.Box3().setFromObject(leaf),ray=new THREE.Raycaster();leaf.updateMatrixWorld(true);
    for(const axis of['x','z']){
      let hits=0;
      for(let i=0;i<16;i++)for(let j=0;j<24;j++){
        const lateral=THREE.MathUtils.lerp(axis==='z'?b.min.x:b.min.z,axis==='z'?b.max.x:b.max.z,(i+.5)/16),y=THREE.MathUtils.lerp(b.min.y,b.max.y,(j+.5)/24);
        ray.set(axis==='z'?new THREE.Vector3(lateral,y,20):new THREE.Vector3(20,y,lateral),axis==='z'?new THREE.Vector3(0,0,-1):new THREE.Vector3(-1,0,0));
        if(ray.intersectObject(leaf).length)hits++;
      }
      assert.ok(hits/384>(kind==='silver'?.32:.23),`${kind} ${axis} crown coverage: ${hits}/384`);
    }
  }
});

test('the lower trunk widens into one continuous root collar instead of separate root spikes',()=>{
  for(const [kind,tree]of trees){
    const g=tree.branchesMesh.geometry,p=g.attributes.position,index=g.index,ids=new Map(),parents=[],points=[];
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    for(let face=0;face<index.count;face+=3){
      const vertices=[index.getX(face),index.getX(face+1),index.getX(face+2)];if(vertices.some(i=>p.getY(i)>1.4))continue;
      const group=vertices.map(i=>{const q=[p.getX(i),p.getY(i),p.getZ(i)],key=q.map(v=>Math.round(v*1e5)).join(',');if(!ids.has(key)){ids.set(key,parents.length);parents.push(parents.length);points.push(q);}return ids.get(key);});
      parents[find(group[1])]=find(group[0]);parents[find(group[2])]=find(group[0]);
    }
    assert.equal(new Set(points.map((_,i)=>find(i))).size,1,`${kind} collar and root ridges share an actual surface`);
    const radius=range=>Math.max(...points.filter(p=>range(p[1])).map(p=>Math.hypot(p[0],p[2]))),base=radius(y=>y<.12),stem=radius(y=>y>.8);
    assert.ok(base>stem*1.5,`${kind} root collar visibly flares before entering the soil`);
  }
});

test('small shrubs and flowers have their own grounded geometry and differentiated plant detail',()=>{
  const shrub=createGroveShrub(),flower=createGardenFlower(),bounds=new THREE.Box3().setFromObject(shrub);
  assert.ok(triangles(shrub)<12000&&triangles(shrub)<triangles(trees.get('silver'))/5,'understory does not duplicate a full tree');
  assert.ok(bounds.min.y>-.05&&bounds.max.y<1.3,'shrub is rooted at ground zero');
  assert.ok(flower.userData.botanicalDetail.flowers>=6&&flower.userData.botanicalDetail.leaves>=6,'separate petals, stamens and leaves');
  assert.ok(triangles(flower)>2000&&triangles(flower)<6000,'close garden flowers retain curved petals and physical stamens');
});

test('the normal world path instances the same trees and a dedicated low understory without browser assets',()=>{
  const root=new THREE.Group(),stats=createVegetation(root,()=>6,()=>false),crowns=root.children.filter(o=>o.name.includes('crowns'));
  assert.equal(crowns.length,3);assert.equal(stats.treeLimit,64);assert.ok(stats.treeCount<=64);
  assert.ok(crowns.every(o=>o.isInstancedMesh&&o.count>0&&o.material.alphaTest===0));
  assert.ok(stats.understoryCount>0);assert.ok(root.children.some(o=>o.name==='Leafy grove understory'));
  assert.ok(root.children.some(o=>o.name==='Fine understory stems'));
});

test('review GLBs match tree geometry and contain nonempty leaf and bark textures',()=>{
  const folder=new URL('../public/models/environment/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('foliage-manifest.json',folder),'utf8'));
  for(const [kind,tree]of trees){
    const item=manifest.assets.find(item=>item.id===kind),bytes=fs.readFileSync(new URL(item.file,folder));
    assert.equal(item.triangles,triangles(tree));assert.equal(bytes.length,item.bytes);assert.equal(bytes.toString('ascii',0,4),'glTF');
    const length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+length));
    assert.ok(gltf.images.length>=4,'both material groups retain pigment and normal maps');
    for(const image of gltf.images)assert.ok(gltf.bufferViews[image.bufferView].byteLength>300,'blank canvas export is rejected');
  }
});
