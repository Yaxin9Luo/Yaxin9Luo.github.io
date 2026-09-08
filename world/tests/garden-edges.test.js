import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLandscapeAssets,surface} from '../src/landscape.js';
import {createAuthoredGardens} from '../src/gardens.js';
import {insideAuthoredGarden} from '../src/environment-layout.js';

// Exercise local PBR binding; browser image/model decoding is a test boundary.
const textureLoad=THREE.TextureLoader.prototype.loadAsync,hdrLoad=HDRLoader.prototype.loadAsync,gltfLoad=GLTFLoader.prototype.loadAsync,document=globalThis.document;
THREE.TextureLoader.prototype.loadAsync=async url=>{assert.ok(fs.existsSync(new URL(`../public${url}`,import.meta.url)),url);return new THREE.Texture();};
HDRLoader.prototype.loadAsync=async()=>new THREE.DataTexture();globalThis.document={};
GLTFLoader.prototype.loadAsync=async url=>{assert.ok(fs.existsSync(new URL(`../public${url}`,import.meta.url)),url);const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1,2,2),new THREE.MeshStandardMaterial()));return {scene};};
try{await loadLandscapeAssets();}finally{
  THREE.TextureLoader.prototype.loadAsync=textureLoad;HDRLoader.prototype.loadAsync=hdrLoad;GLTFLoader.prototype.loadAsync=gltfLoad;
  if(document===undefined)delete globalThis.document;else globalThis.document=document;
}

const heightAt=(x,z)=>6+z*.006,nearPath=(x,z)=>z>15&&z<22;
const gardens=createAuthoredGardens(new THREE.Group(),heightAt,nearPath),edges=gardens.group.children.find(o=>o.name==='Planted transitions around academy courts');

test('edge stones bind the shared mossy-rock PBR and retain genuinely eroded geometry',()=>{
  const rock=edges.children.find(o=>o.material.name==='Garden eroded mossy fieldstone'),reference=surface('mossy-rock');
  for(const channel of['map','normalMap','roughnessMap'])assert.equal(rock.material[channel],reference[channel],`${channel} must reuse the real rock texture`);
  assert.ok(rock.material.map&&rock.material.normalMap&&rock.material.roughnessMap);
  assert.equal(rock.material.userData.surface,'mossy-rock');
  const vertices=rock.geometry.attributes.position,perStone=vertices.count/edges.userData.rockCount;
  assert.ok(perStone/3>=3000,'weathered stone surfaces keep enough shape samples');
  const item=edges.userData.edgePlacements.find(p=>p.kind==='rock'),inverse=new THREE.Matrix4().compose(new THREE.Vector3(item.x,item.y,item.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(...item.rotation)),new THREE.Vector3(...item.scale)).invert(),point=new THREE.Vector3();
  let min=Infinity,max=0;for(let i=0;i<perStone;i++){point.fromBufferAttribute(vertices,i).applyMatrix4(inverse);const r=point.length();min=Math.min(min,r);max=Math.max(max,r);}
  assert.ok(max-min>.27,'the stone has actual cuts and hollows, not a tinted sphere');
});

test('unequal planting ribbons keep actual vertices out of the reserved approach and remain low',()=>{
  assert.equal(edges.userData.transitionGroups,6);assert.ok(edges.userData.shrubCount>25);assert.ok(edges.userData.rockCount>8);
  const placements=edges.userData.edgePlacements;
  assert.ok(placements.some(p=>p.x<-50)&&placements.some(p=>p.x>73)&&placements.some(p=>Math.abs(p.x)<25),'three district borders receive planting');
  for(const p of placements){assert.ok(!insideAuthoredGarden(p.x,p.z,.12));assert.ok(!nearPath(p.x,p.z));assert.ok(Math.abs(p.y-heightAt(p.x,p.z))<.08);}
  for(const mesh of edges.children){
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(!nearPath(x,z),`${mesh.material.name} crosses the approach`);
      assert.ok(!(x>51&&x<73&&z>50&&z<82),'exhibition viewing lane stays clear');
      assert.ok(y-heightAt(x,z)<1.05,'near-ground planting cannot cover signs or portal sight lines');
    }
  }
});

test('edge dressing leaves all authored district collision solids unchanged',()=>{
  const baseline=createAuthoredGardens(new THREE.Group());
  assert.deepEqual(gardens.colliders,baseline.colliders);
  assert.deepEqual(gardens.contentAnchors.map(a=>a.position.toArray()),baseline.contentAnchors.map(a=>a.position.toArray()));
  assert.equal(edges.userData.colliders.length,0);
});
