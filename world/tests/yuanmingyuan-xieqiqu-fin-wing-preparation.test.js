import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCamberedSculptureSkin,createBorrowedMaterialSculpture} from '../src/yuanmingyuan/xieqiqu-sculpture-skin.js';
import {createStoneFishTailGeometry,createStoneFishPectoralGeometry,createXieqiquStoneFishStudy,stoneFishMouth} from '../src/yuanmingyuan/xieqiqu-stone-fish.js';
import {createCopperSwallowWingGeometry,createCopperSwallowTailGeometry,createXieqiquCopperSwallowStudy,copperSwallowMouth} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';

function topology(g){
  const index=g.index.array,p=g.attributes.position,edges=new Map();let volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.length;i+=3){a.fromBufferAttribute(p,index[i]);b.fromBufferAttribute(p,index[i+1]);c.fromBufferAttribute(p,index[i+2]);volume+=a.dot(b.cross(c))/6;for(let j=0;j<3;j++){const x=index[i+j],y=index[i+(j+1)%3],key=x<y?`${x},${y}`:`${y},${x}`,record=edges.get(key)??{count:0,winding:0};record.count++;record.winding+=x<y?1:-1;edges.set(key,record);}}
  assert.equal([...edges.values()].filter(e=>e.count!==2||e.winding!==0).length,0);assert.ok(volume>0);assert.equal(p.count-edges.size+index.length/3,2);
  for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),g.attributes.uv.getX(i),g.attributes.uv.getY(i)].every(Number.isFinite));assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).length()-1)<2e-5);}
  return {triangles:index.length/3,volume};
}

for(const[name,create]of [
  ['fish-tail',createStoneFishTailGeometry],
  ['fish-pectoral-left',()=>createStoneFishPectoralGeometry(-1)],
  ['fish-pectoral-right',()=>createStoneFishPectoralGeometry(1)],
  ['swallow-wing-left',()=>createCopperSwallowWingGeometry(-1)],
  ['swallow-wing-right',()=>createCopperSwallowWingGeometry(1)],
  ['swallow-tail-left',()=>createCopperSwallowTailGeometry(-1)],
  ['swallow-tail-right',()=>createCopperSwallowTailGeometry(1)],
])test(`${name} is an outward closed finite-thickness skin rather than an extruded slab`,()=>{
  const g=create();try{const result=topology(g),p=g.attributes.position,half=g.userData.skinLayerVertexCount??p.count/2;let minThickness=Infinity,maxThickness=0;
    for(let i=0;i<half;i++){const distance=new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3().fromBufferAttribute(p,i+half));minThickness=Math.min(minThickness,distance);maxThickness=Math.max(maxThickness,distance);}
    assert.ok(minThickness>.002&&minThickness<.022);assert.ok(maxThickness<.095);assert.ok(maxThickness>minThickness*2,'root thickens toward the anatomical join');console.log('SCULPTURE_THIN_COMPONENT '+JSON.stringify({name,...result,minThickness,maxThickness}));
  }finally{g.dispose();}
});

test('invalid star-domain skin is rejected before it can bridge a concave outline',()=>{
  const outline=Array.from({length:16},(_,i)=>[Math.cos(i/16*Math.PI*2),Math.sin(i/16*Math.PI*2),0]);assert.throws(()=>createCamberedSculptureSkin({name:'bad',outline,center:[3,0,0],normal:[0,0,1],halfThickness:()=>.01}),/not star-shaped/);
});

test('borrowed source PBR objects and pixels remain unchanged after geometric owner disposal',()=>{
  const pixels=new Uint8Array(4*4*4).fill(117),texture=new THREE.DataTexture(pixels,4,4),material=new THREE.MeshStandardMaterial({color:0x8a7357,roughness:.70,metalness:.81,roughnessMap:texture});let materialDisposals=0,textureDisposals=0,geometryDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);texture.addEventListener('dispose',()=>textureDisposals++);
  const owner=createBorrowedMaterialSculpture({id:'small-fixture',materials:{copper:material},roles:['copper'],mouthAnchor:[0,0,0],parts:[{id:'real-curved-wing',role:'copper',create:()=>{const g=createCopperSwallowWingGeometry(1);g.addEventListener('dispose',()=>geometryDisposals++);return g;}}]});
  assert.equal(owner.group.children[0].material,material);assert.equal(owner.group.children[0].castShadow,true);assert.equal(owner.group.children[0].receiveShadow,true);assert.equal(owner.diagnostics.visualAcceptance,false);owner.dispose();owner.dispose();assert.equal(geometryDisposals,1);assert.equal(materialDisposals,0);assert.equal(textureDisposals,0);assert.equal(material.roughness,.70);assert.ok(pixels.every(v=>v===117));material.dispose();texture.dispose();
});

test('mid-construction failure and cancellation release new geometry but never borrowed maps',()=>{
  const material=new THREE.MeshStandardMaterial();let disposals=0;
  const create=()=>{const g=new THREE.BoxGeometry(1,1,1);g.addEventListener('dispose',()=>disposals++);return g;};
  const base={id:'failure-fixture',materials:{copper:material},roles:['copper'],mouthAnchor:[0,0,0]};
  assert.throws(()=>createBorrowedMaterialSculpture({...base,parts:[{id:'first',role:'copper',create},{id:'failure',role:'copper',create:()=>{throw new Error('actual second component failure');}}]}),/actual second/);assert.equal(disposals,1);
  const controller=new AbortController();assert.throws(()=>createBorrowedMaterialSculpture({...base,signal:controller.signal,parts:[{id:'first',role:'copper',create:()=>{const g=create();controller.abort();return g;}},{id:'unreached',role:'copper',create:()=>{throw new Error('should not construct');}}]}),{name:'AbortError'});assert.equal(disposals,2);material.dispose();
});

test('unavailable source materials do not trigger full fish or swallow construction or substitutes',()=>{
  assert.throws(()=>createXieqiquStoneFishStudy(),/requires original source materials/);assert.throws(()=>createXieqiquCopperSwallowStudy(),/requires original source materials/);
  assert.deepEqual(stoneFishMouth,[0,.96,1.25]);assert.deepEqual(copperSwallowMouth,[0,.587,.579]);
});
