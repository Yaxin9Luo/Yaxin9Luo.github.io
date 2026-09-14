import test from 'node:test';
import assert from 'node:assert/strict';
import {createXianfaqiaoGardenPlantingLayout} from '../src/yuanmingyuan/xianfaqiao-garden-planting.js';
import {westernGardenPlantingSpec} from '../src/yuanmingyuan/western-garden-planting.js';
import {pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {extendFuhaiNortheastBankContext,fuhaiNortheastBankContextRegionId} from '../src/yuanmingyuan/fuhai-ne-bank-context-r1.js';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
test('all old regions, reservations and metadata survive by value and identity; frozen input is untouched',()=>{
  const original=createXianfaqiaoGardenPlantingLayout();original.unrelated={keep:['WIP']};
  const before=JSON.stringify(original);freeze(original);
  const next=extendFuhaiNortheastBankContext(original);
  assert.equal(JSON.stringify(original),before);assert.equal(next.regions.length,original.regions.length+1);
  for(const [i,r]of original.regions.entries()){assert.equal(next.regions[i],r);assert.deepEqual(next.regions[i],r);}
  for(const k of Object.keys(original).filter(k=>!['id','regions'].includes(k)))assert.equal(next[k],original[k]);
  assert.equal(next.sourcePlanId,original.id);
});
test('the two approved willows keep exact world position, scale and yaw',()=>{
  const plan=extendFuhaiNortheastBankContext(createXianfaqiaoGardenPlantingLayout()),r=plan.regions.at(-1);
  assert.equal(r.id,fuhaiNortheastBankContextRegionId);
  assert.deepEqual(r.placements.filter(p=>p.species==='willow').map(p=>[p.position,p.scale,p.yaw]),[
    [[269,null,-552],1.35,-.4],[[283,null,-545],1.05,.65]]);
});
test('low shoulders remain inside the selected bank, clear the root flares, and have unique deterministic placements',()=>{
  const a=extendFuhaiNortheastBankContext(createXianfaqiaoGardenPlantingLayout()),b=extendFuhaiNortheastBankContext(createXianfaqiaoGardenPlantingLayout());
  assert.deepEqual(a,b);
  const r=a.regions.at(-1);assert.equal(new Set(r.placements.map(p=>p.id)).size,r.placements.length);
  assert.equal(new Set(r.placements.map(p=>[p.position[0],p.position[2]].join(','))).size,r.placements.length);
  for(const p of r.placements){
    assert.equal(pointInPolygon([p.position[0],p.position[2]],r.designPolygon),true,p.id);
    assert.equal(p.position[1],null);assert.ok([p.scale,p.yaw,p.burial,p.envelope.radius,p.envelope.height].every(Number.isFinite));
    if(p.species!=='willow')for(const root of r.rootReservations)
      assert.ok(Math.hypot(p.position[0]-root.position[0],p.position[2]-root.position[1])>root.radius+.14*p.scale,p.id);
  }
  assert.deepEqual(Object.fromEntries(['willow','sedge','flower-shrub'].map(id=>[id,r.placements.filter(p=>p.species===id).length])),{willow:2,sedge:122,'flower-shrub':10});
});
test('the source templates, reviewed geometry cost and explicit opt-in boundary are preserved',()=>{
  const old=createXianfaqiaoGardenPlantingLayout(),next=extendFuhaiNortheastBankContext(old),r=next.regions.at(-1);
  const source=new Map(old.regions.flatMap(r=>r.placements).map(p=>[p.species,p]));
  for(const p of r.placements){const t=source.get(p.species);assert.deepEqual(p.evidence,t.evidence);assert.equal(p.burial,t.burial);assert.ok(Math.abs(p.envelope.radius/p.scale-t.envelope.radius/t.scale)<1e-12);}
  assert.equal(r.estimatedFullSourceTriangles,r.placements.reduce((n,p)=>n+westernGardenPlantingSpec.sourceTriangles[p.species],0));
  assert.equal(next.nativeCompositionReviewed,false);assert.equal(next.historicallySurveyed,false);
  assert.throws(()=>extendFuhaiNortheastBankContext(next),/complete current/);
  assert.throws(()=>extendFuhaiNortheastBankContext({...old,regions:[...old.regions,r]}),/only once/);
});
