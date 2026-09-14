import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GardenGateBuilder} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {BRIDGE,fiveSluiceWallGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {XIANFAQIAO_DECK_JOIN,xianfaqiaoDeckGeometry,xianfaqiaoAbutmentGeometries,addXianfaqiaoDeck,addXianfaqiaoAbutment} from '../src/yuanmingyuan/xianfaqiao-deck-joins.js';
import {xianfaqiaoStudyViews} from '../src/yuanmingyuan/xianfa-landscape-views.js';
import {assertClosedWinding,assertGeometryNormals,resources} from './yuanmingyuan-garden-study-checks.js';

function fixture(legacy=false){
  const b=new GardenGateBuilder('xianfaqiao'),group=new THREE.Group(),base=new THREE.Group(),land=new THREE.Group();
  base.name='xianfaqiao-five-opening-sluice';land.name='xianfaqiao-study-grounded-abutments';group.add(base,land);
  try{
    b.add(base,fiveSluiceWallGeometry(),b.m.wetStone);
    if(legacy){
      b.box(base,b.m.paving,[0,BRIDGE.deckY-.09,0],[32.3,.18,5.28],.018);
      for(const side of [-1,1])b.box(land,b.m.brick,[side*16.1,-.11,0],[4.2,2.72,7],.025);
    }else{addXianfaqiaoDeck(b,base);for(const side of [-1,1])addXianfaqiaoAbutment(b,land,base,side);}
    return b.finish(group,{assetId:'xianfaqiao-join-component'});
  }catch(error){b.dispose();throw error;}
}
const down=(asset,x,z)=>new THREE.Raycaster(new THREE.Vector3(x,1.5,z),new THREE.Vector3(0,-1,0),0,.5).intersectObject(asset.group,true);
// At the exact butt line the original bevel also touches the top at one edge.
// It is not a second coplanar top face; retain it in the unfiltered support ray.
const topHits=hits=>hits.filter(h=>Math.abs(h.point.y-BRIDGE.deckY)<1e-6&&h.face.normal.y>.999);
const kinds=hits=>new Set(hits.map(h=>h.object.material.name));
const near=(a,b,t=1e-6)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`);

test('the separately approved bridge source delta matches its own freeze',()=>{
  const baseline=JSON.parse(readFileSync(new URL('./fixtures/xianfaqiao-deck-join-r1.json',import.meta.url),'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const study=readFileSync(new URL('../src/yuanmingyuan/xianfa-landscape-study.js',import.meta.url),'utf8');
  assert.equal(sha(study.slice(study.indexOf('export function createXianfaqiaoStudy('))),baseline.bridgeStudyFunctionSHA256);
  assert.equal(sha(readFileSync(new URL('../src/yuanmingyuan/xianfaqiao-deck-joins.js',import.meta.url))),baseline.bridgeJoinHelperSHA256);
});

test('the original source primitives reproduce the two different coplanar top materials',t=>{
  const a=fixture(true);
  try{for(const side of [-1,1]){
    const hits=topHits(down(a,side*15,1.75));assert.equal(kinds(hits).size,2);
    t.diagnostic(JSON.stringify(hits.map(h=>({x:h.point.x,y:h.point.y,material:h.object.material.name}))));
  }}finally{a.dispose();}
});

test('trimmed slab and each two-material bank retain closed, consistently wound solid skins',()=>{
  const deck=xianfaqiaoDeckGeometry();
  try{assertClosedWinding(deck);assertGeometryNormals(deck);near(deck.boundingBox.min.y,1.07);near(deck.boundingBox.max.y,BRIDGE.deckY);near(deck.boundingBox.max.x,14.025);}
  finally{deck.dispose();}
  for(const side of [-1,1]){
    const {masonry,paving}=xianfaqiaoAbutmentGeometries(side),combined=mergeGeometries([masonry,paving]);
    try{assertClosedWinding(combined);assertGeometryNormals(combined);assert(paving.attributes.position.count>0);assert(masonry.attributes.uv.count===masonry.attributes.position.count);}
    finally{masonry.dispose();paving.dispose();combined.dispose();}
  }
  assert.throws(()=>xianfaqiaoAbutmentGeometries(0),/side/);
  assert.equal(XIANFAQIAO_DECK_JOIN.deckY,BRIDGE.deckY);assert.equal(XIANFAQIAO_DECK_JOIN.deckWidth,BRIDGE.deckWidth);
});

test('both real lane surfaces cross the sealed joints without a height gap or duplicate flat top',()=>{
  const a=fixture();
  try{
    for(const z of [-1.75,1.75])for(let i=0;i<=360;i++){
      const x=-18.15+36.3*i/360,hits=topHits(down(a,x,z));assert.equal(kinds(hits).size,1,`${x}, ${z}`);near(hits[0].point.y,BRIDGE.deckY);assert(hits[0].face.normal.y>.999);
    }
    for(const side of [-1,1])for(const offset of [-.003,-.0001,0,.0001,.003])for(const z of [-1.75,1.75]){
      const x=side*(14.024999618530273+offset),hits=topHits(down(a,x,z));assert.equal(kinds(hits).size,1);assert.match(hits[0].object.material.name,/limestone-paving/);
    }
  }finally{a.dispose();}
});

test('paving extent, original material response and original exterior UVs survive the overlap removal',()=>{
  const before=fixture(true),after=fixture();
  try{
    for(const side of [-1,1])for(const [xx,z,material]of [[13.8,1.75,'limestone-paving'],[14.05,1.75,'limestone-paving'],[15.7,1.75,'limestone-paving'],[16.10,2.60,'limestone-paving'],[16.20,1.75,'carved-brick'],[17.0,1.75,'carved-brick'],[15.7,2.70,'carved-brick'],[18.185,.3,'carved-brick']]){
      const x=side*xx,old=down(before,x,z).find(h=>h.object.material.name.includes(material)),fresh=down(after,x,z)[0];assert(old);assert(fresh);
      near(fresh.point.y,old.point.y);assert.equal(fresh.object.material.name,old.object.material.name);
      near(fresh.uv.x,old.uv.x);near(fresh.uv.y,old.uv.y);
      assert.equal(fresh.object.material.color.getHex(),old.object.material.color.getHex());assert.equal(fresh.object.material.roughness,old.object.material.roughness);
      if(old.object.material.roughnessMap)assert.deepEqual(fresh.object.material.roughnessMap.image.data,old.object.material.roughnessMap.image.data);
    }
    assert.equal(before.diagnostics.meshCount,after.diagnostics.meshCount,'paving patches use the existing paving draw');
    assert.equal(after.diagnostics.triangles-before.diagnostics.triangles,628);
    assert.deepEqual(before.diagnostics.bounds,after.diagnostics.bounds);
  }finally{before.dispose();after.dispose();}
});

test('the two pure close-up views use stable original groups and frame both joints without isolation',()=>{
  const a=fixture();
  try{for(const [key,side]of [['deck-join-positive',1],['deck-join-negative',-1]]){
    const view=xianfaqiaoStudyViews[key],box=new THREE.Box3();for(const name of view.groups)box.union(new THREE.Box3().setFromObject(a.group.getObjectByName(name)));
    const low=box.min.clone(),size=box.getSize(new THREE.Vector3()),crop=new THREE.Box3(new THREE.Vector3(...view.crop.min).multiply(size).add(low),new THREE.Vector3(...view.crop.max).multiply(size).add(low));
    assert(crop.containsPoint(new THREE.Vector3(side*14.025,1.25,side*1.75)));
    assert(crop.containsPoint(new THREE.Vector3(side*16.132,1.25,side*1.75)));
    assert.equal(view.isolate,undefined);assert(view.direction.every(Number.isFinite));
  }}finally{a.dispose();}
});

test('small component resources belong to one builder and release exactly once',()=>{
  const a=fixture(),owned=resources(a.group),calls=new Map();
  for(const set of Object.values(owned))for(const resource of set){calls.set(resource,0);resource.addEventListener('dispose',()=>calls.set(resource,calls.get(resource)+1));}
  a.dispose();a.dispose();assert.equal(a.group.children.length,0);assert([...calls.values()].every(n=>n===1));
  const b=fixture();try{for(const [key,set]of Object.entries(resources(b.group)))for(const resource of set)assert(!owned[key].has(resource));}finally{b.dispose();}
});
