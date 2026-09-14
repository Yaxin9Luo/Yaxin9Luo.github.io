import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createXianfaqiaoGardenPlantingLayout} from '../src/yuanmingyuan/xianfaqiao-garden-planting.js';
import {createWesternGardenPlantingLayout,createWesternGardenPlantingPlan} from '../src/yuanmingyuan/western-garden-planting.js';
import {createXianfaqiaoComposition} from '../src/yuanmingyuan/xianfaqiao-composition.js';
import {museumSites} from '../src/yuanmingyuan/museum-sites.js';
import {gardenLayout} from '../src/yuanmingyuan/garden-layout.js';
import {compositionOwner,compositionGround} from './helpers/xianfaqiao-composition-fixture.js';

const newRegions=['xieqiqu-forelake-garden','xianfaqiao-approach-garden','xieqiqu-north-garden'];
test('outer garden design leaves every baseline region and reservation intact and uses distinct explicit regions',()=>{
  const before=JSON.stringify({museumSites,gardenLayout}),base=createWesternGardenPlantingLayout(),next=createXianfaqiaoGardenPlantingLayout();
  assert.equal(JSON.stringify({museumSites,gardenLayout}),before);assert.deepEqual(next.regions.slice(0,base.regions.length),base.regions);
  assert.deepEqual(next.clearings,base.clearings);assert.deepEqual(next.buildingReserves,base.buildingReserves);
  assert.deepEqual(next.regions.slice(base.regions.length).map(r=>r.id),newRegions);
  const added=next.regions.slice(base.regions.length).flatMap(r=>r.placements);
  assert.equal(new Set(next.regions.flatMap(r=>r.placements).map(p=>p.id)).size,next.regions.reduce((n,r)=>n+r.placements.length,0));
  assert(added.every(p=>p.position[1]===null&&!p.evidence.surveyed));
  const willow=added.find(p=>p.species==='willow');assert(willow);assert(willow.position[0]-willow.envelope.radius>403,'The main north/south view stays open.');
});

test('new outer-bank and approach envelopes fit the actual composed fixture terrain, preserved courts and full triangle support',async t=>{
  const scene=new THREE.Scene(),composition=createXianfaqiaoComposition({root:scene,load:async id=>compositionOwner(id)});
  const plan=await composition.prepare(),ground=compositionGround(plan,{north:-720});composition.bindWater(ground);
  t.after(()=>{composition.dispose();ground.dispose();});
  const frames=new Map(museumSites.map(site=>[site.id,site]));for(const site of composition.sites)frames.set(site.id,site);
  const plantingLayout=createXianfaqiaoGardenPlantingLayout({sites:[...frames.values()],layout:plan.layout});
  for(const regionId of newRegions){
    const candidate=createWesternGardenPlantingPlan({regionId,terrain:ground.terrain,architecture:composition.support,plantingLayout});
    assert.deepEqual(candidate.rejected,[],JSON.stringify(candidate.rejected));assert.equal(candidate.valid,true);
    assert(candidate.placements.every(p=>p.grounding.samples.length===17&&p.grounding.samples.every(s=>Number.isFinite(s.height))));
  }
});
