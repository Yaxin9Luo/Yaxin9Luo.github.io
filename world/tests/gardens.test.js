import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {locations} from '../src/locations.js';
import {createAuthoredGardens,createGardenSpecimen} from '../src/gardens.js';
import {gardenDistricts,insideAuthoredGarden,gradeGardenTerrain} from '../src/environment-layout.js';
import {terrainHeight,renderedTerrainHeight,createTerrainSpecimen} from '../src/world.js';
import {resolveRiderCollision,shortenCameraBoom} from '../src/collision.js';
import {queryGroundSupport,stepGroundMotion} from '../src/ground-motion.js';

const gardens=createAuthoredGardens(new THREE.Group());
const velocity={x:0,y:0,z:0};
const clear=position=>!resolveRiderCollision(position,velocity,gardens.colliders).collided;

test('paving support follows each rendered slab, grout gap, bevel and clipped corner',()=>{
  const district=gardenDistricts.find(d=>d.id==='courtyard'),group=gardens.districts.find(g=>g.name==='Grand Academy fountain courtyard');
  const ray=new THREE.Raycaster();gardens.group.updateMatrixWorld(true);
  const world={heightAt:()=>district.y,colliders:gardens.colliders.filter(s=>s.name?.startsWith('garden paving'))};
  // Local points avoid furniture and cover tile, grout, inlay, trim, base and
  // both sides of the clipped outer corner, plus the raised brass border.
  for(const [x,z]of [[16,0],[17.3,0],[17.6,0],[17.95,0],[17.5,20.5],[17.9,20.9],[0,0],[14.596153846,0],[17.225,1]]){
    ray.set(new THREE.Vector3(district.x+x,district.y+1,district.z+z),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObjects(group.children.filter(o=>o.isMesh),false),rendered=hits[0]?.point.y??district.y;
    const support=queryGroundSupport({x:district.x+x,z:district.z+z,feetY:district.y+.25,radius:0,height:0},world);
    assert.equal(support.valid,true,`${x},${z}`);
    assert.ok(Math.abs(support.y-rendered)<.001,`${x},${z}: support ${support.y}, render ${rendered}`);
  }
});

test('walking crosses grout, shallow brass strips and the stepped paving border without becoming trapped',()=>{
  const d=gardenDistricts.find(d=>d.id==='courtyard');
  const world={heightAt:()=>d.y,colliders:gardens.colliders.filter(s=>s.name?.startsWith('garden paving'))};
  let state={position:{x:d.x+14.4,y:d.y+.171,z:d.z+.7},heading:0};
  for(let i=0;i<55;i++)state=stepGroundMotion(state,{x:1,z:0},.05,world);
  assert.ok(state.position.x>d.x+18.7,`blocked at ${state.position.x-d.x}: ${state.reason}`);
});

test('continuous courtyard floors meet their authored grades and preserve landmark coordinates',()=>{
  for(const d of gardenDistricts){
    for(const x of[-.46,0,.46])for(const z of[-.46,0,.46]){
      const px=d.x+x*d.width,pz=d.z+z*d.depth;
      assert.ok(insideAuthoredGarden(px,pz),d.id);
      assert.ok(Math.abs(terrainHeight(px,pz)-d.y)<.015,`${d.id}: ${px},${pz}`);
      assert.ok(Math.abs(renderedTerrainHeight(px,pz)-d.y)<.04,`${d.id}: rendered grade`);
    }
  }
  assert.equal(gradeGardenTerrain(140,130,4.2),4.2,'unrelated remote terrain stays untouched');
});

test('garden paving stays on actual clipped island mesh, including the post and observatory corners',()=>{
  const ground=createTerrainSpecimen().children[0],ray=new THREE.Raycaster();ground.updateMatrixWorld(true);
  for(const d of gardenDistricts)for(const u of[-.48,0,.48])for(const v of[-.48,0,.48]){
    const x=d.x+u*d.width,z=d.z+v*d.depth;ray.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(ground)[0];assert.ok(hit,`${d.id} paving above an open shoreline at ${x},${z}`);
    assert.ok(Math.abs(hit.point.y-d.y)<.07,`${d.id} paving support`);
  }
});

test('fountain bypasses, academy view axis, district gates and reserved exhibition stay open',()=>{
  for(let z=10;z<=27;z+=1.25)assert.ok(clear({x:0,y:9.5,z}),`academy axis ${z}`);
  for(let i=0;i<48;i++){const a=i*Math.PI/24;assert.ok(clear({x:Math.cos(a)*7.2,y:9.7,z:35+Math.sin(a)*7.2}),`fountain circuit ${i}`);}
  for(let x=-23;x<-7;x+=.6)assert.ok(clear({x,y:9.6,z:38}),`west promenade ${x}`);
  for(const p of[{x:-70,y:10.5,z:24},{x:80,y:11.5,z:-48},{x:-84,y:10.5,z:-55},{x:-45,y:8.5,z:86}])assert.ok(clear(p),`gate ${JSON.stringify(p)}`);
  for(let x=53;x<=72;x+=2)for(let z=52;z<=65;z+=2)assert.ok(clear({x,y:9.5,z}),`reserved stage ${x},${z}`);
});

test('pergola collision follows its piers and beams while its open bays remain usable',()=>{
  assert.equal(clear({x:-16.65,y:8.5,z:25.35}),false,'solid stone pier');
  assert.equal(clear({x:-13.4,y:11.0,z:25.35}),false,'solid top crossbeam');
  assert.ok(clear({x:-13.3,y:8.8,z:29.6}),'open central pergola bay');
  const camera=shortenCameraBoom({x:-20,y:9,z:25.35},{x:-12,y:9,z:25.35},gardens.colliders);
  assert.ok(camera.blocked,'camera cannot cross a pergola pier');
});

test('garden export evidence is reproducible from the runtime geometry and retains every shared asset',()=>{
  const folder=new URL('../public/models/environment/',import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'));
  assert.equal(manifest.assets.length,gardenDistricts.length);
  for(const item of manifest.assets){
    const bytes=fs.readFileSync(new URL(item.file,folder));assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.length,item.bytes);
    const group=createGardenSpecimen(item.id),bounds=new THREE.Box3().setFromObject(group);let triangles=0;
    group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
    assert.equal(triangles,item.triangles,`${item.id} export geometry`);
    assert.ok(bounds.min.distanceTo(new THREE.Vector3(...item.bounds.min))<1e-5);assert.ok(bounds.max.distanceTo(new THREE.Vector3(...item.bounds.max))<1e-5);
  }
});

test('time controls receive actual lantern materials and local lights without taking over gameplay lights',()=>{
  assert.equal(gardens.lighting.lights.length,5);
  for(const {light,baseIntensity}of gardens.lighting.lights){assert.ok(light.isPointLight);assert.equal(light.intensity,baseIntensity);assert.equal(light.castShadow,false);}
  assert.ok(gardens.lighting.emissiveMaterials.length>0);
  assert.ok(gardens.lighting.nightMaterials.every(({material,uniform})=>material.uniforms[uniform].value===1));
  assert.ok(gardens.clockTargets.length>0);assert.ok(gardens.clockTargets.every(o=>o.isMesh&&o.userData.environmentAction==='time'));
  gardens.group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gardens.clockTargets[0]);
  assert.ok(bounds.containsPoint(gardens.clockPosition),'clock interaction position stays inside the actual armillary');
});

test('four useful portfolio props expose actual meshes and bounded world-space reading anchors',()=>{
  assert.equal(gardens.contentAnchors.length,4);
  assert.deepEqual(new Set(gardens.contentAnchors.map(a=>a.action.kind==='cv'?'cv':a.action.id)),new Set(['publications','journey','research','cv']));
  for(const anchor of gardens.contentAnchors)if(anchor.action.kind==='section')assert.ok(locations.some(location=>location.id===anchor.action.id),'Every content prop uses a real portfolio chapter id.');
  for(const anchor of gardens.contentAnchors){
    assert.ok(anchor.position.isVector3);assert.ok(anchor.label.en&&anchor.label.zh);
    const targets=gardens.contentTargets.filter(o=>JSON.stringify(o.userData.portfolioAction)===JSON.stringify(anchor.action));
    assert.ok(targets.length>0&&targets.every(o=>o.isMesh&&o.geometry.attributes.position.count>0));
    const bounds=new THREE.Box3();for(const target of targets)bounds.union(new THREE.Box3().setFromObject(target));
    assert.ok(bounds.expandByScalar(.18).containsPoint(anchor.position),`anchor belongs to ${anchor.label.en}`);
  }
  const decorative=[];gardens.group.traverse(o=>{if(o.isMesh&&!gardens.contentTargets.includes(o))decorative.push(o);});
  assert.ok(decorative.length>30);assert.ok(decorative.every(o=>!o.userData.portfolioAction),'ordinary paving and planting are not click targets');
});
