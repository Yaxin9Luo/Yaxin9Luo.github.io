import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCourtBandsR3Sources} from '../src/yuanmingyuan/court-planting-sources-r3.js';
import {courtBroadleafReview,courtBroadleafProfile} from '../src/yuanmingyuan/court-broadleaf-profile.js';
function fixture(){
 const events=[],regionId='test-drift',group=new THREE.Group(),part=new THREE.Group();part.userData.id='low-broadleaf';group.add(part);
 let disposed=false,loads=0,westernDisposed=false;
 const leafOwner={group,diagnostics:{id:courtBroadleafProfile.id,triangles:courtBroadleafProfile.triangles,fullResolutionVerified:true},get disposed(){return disposed;},update(t){events.push(['broadleaf-update',t]);},dispose(){if(!disposed){disposed=true;events.push('broadleaf-dispose');}}};
 const record={part,owner:leafOwner,review:courtBroadleafReview},oldRecord={part:{},owner:{},review:'existing-proof'};
 const western={prepareRegion:async id=>{assert.equal(id,regionId);events.push('western-prepare');return{sources:{sedge:oldRecord}};},update(t){events.push(['western-update',t]);},dispose(){if(!westernDisposed){westernDisposed=true;events.push('western-dispose');}},whenIdle:async()=>{},snapshot:()=>({sources:[{species:'sedge'}]})};
 const options={plantingLayout:{regions:[{id:regionId,placements:[{species:'sedge'},{species:'low-broadleaf'},{species:'low-broadleaf'}]}]},
  createWestern({plantingLayout}){assert.deepEqual(plantingLayout.regions[0].placements,[{species:'sedge'}]);return western;},
  loadBroadleaf:async()=>{loads++;return record;}};
 return{events,options,record,oldRecord,western,regionId,get loads(){return loads;}};
}
test('one complete prototype is shared across requests; borrowed source records are unchanged',async()=>{
 const f=fixture(),owner=createCourtBandsR3Sources(f.options);assert.equal(f.loads,0);
 const first=await owner.prepareRegion(f.regionId),second=await owner.prepareRegion(f.regionId);
 assert.equal(f.loads,1);assert.equal(first.sources['low-broadleaf'],f.record);assert.equal(second.sources['low-broadleaf'].part,f.record.part);
 assert.equal(first.sources.sedge,f.oldRecord);assert.equal(f.record.part.parent,f.record.owner.group);
 owner.update(2);assert.deepEqual(f.events.slice(-2),[['western-update',2],['broadleaf-update',2]]);
 assert.equal(owner.snapshot().builtBroadleaf,1);owner.dispose();owner.dispose();await owner.whenIdle();
 assert.equal(f.events.filter(e=>e==='broadleaf-dispose').length,1);assert.equal(f.events.filter(e=>e==='western-dispose').length,1);
 assert.equal(owner.update(3),false);
});
test('a request abort releases its late fresh source and publishes no partial region',async()=>{
 const f=fixture(),controller=new AbortController();let resolve;
 const owner=createCourtBandsR3Sources({...f.options,loadBroadleaf:()=>new Promise(r=>{resolve=r;})});
 const pending=owner.prepareRegion(f.regionId,{signal:controller.signal});
 while(!resolve)await new Promise(r=>setImmediate(r));
 controller.abort();resolve(f.record);await assert.rejects(pending,{name:'AbortError'});
 assert.equal(owner.snapshot().builtBroadleaf,0);assert.equal(owner.snapshot().completed,0);
 assert.equal(f.record.owner.disposed,true);assert.equal(f.events.includes('western-dispose'),false);
 owner.dispose();await owner.whenIdle();
});
test('dispose aborts preparation and whenIdle includes the late provider result',async()=>{
 const f=fixture();let resolve,receivedSignal;
 const owner=createCourtBandsR3Sources({...f.options,loadBroadleaf:({signal})=>{receivedSignal=signal;return new Promise(r=>{resolve=r;});}});
 const pending=owner.prepareRegion(f.regionId);
 while(!resolve)await new Promise(r=>setImmediate(r));
 owner.dispose();assert.equal(receivedSignal.aborted,true);let idle=false;const settled=owner.whenIdle().then(()=>{idle=true;});
 await new Promise(r=>setImmediate(r));assert.equal(idle,false);
 resolve(f.record);await assert.rejects(pending,{name:'AbortError'});await settled;assert.equal(idle,true);
 assert.equal(f.events.filter(e=>e==='broadleaf-dispose').length,1);assert.equal(f.events.filter(e=>e==='western-dispose').length,1);
});
test('concurrent calls serialize the full new source preparation',async()=>{
 const f=fixture();let resolve,calls=0;
 const owner=createCourtBandsR3Sources({...f.options,loadBroadleaf:()=>{calls++;return new Promise(r=>{resolve=r;});}});
 const a=owner.prepareRegion(f.regionId),b=owner.prepareRegion(f.regionId);
 while(!resolve)await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 resolve(f.record);const [x,y]=await Promise.all([a,b]);assert.equal(calls,1);assert.equal(x.sources['low-broadleaf'],y.sources['low-broadleaf']);
 owner.dispose();await owner.whenIdle();
});
test('wrong provenance or placed source is rejected and released',async()=>{
 for(const mutate of [r=>{r.review='unverified';},r=>{r.part.position.x=1;},r=>{r.owner.diagnostics.fullResolutionVerified=false;}]){
  const f=fixture();mutate(f.record);const owner=createCourtBandsR3Sources(f.options);
  await assert.rejects(owner.prepareRegion(f.regionId),/independently owned/);
  assert.equal(f.record.owner.disposed,true);assert.equal(owner.snapshot().completed,0);owner.dispose();await owner.whenIdle();
 }
});
test('invalid plans, wrong region and pre-aborted request start no provider load',async()=>{
 const f=fixture();assert.throws(()=>createCourtBandsR3Sources({...f.options,plantingLayout:{regions:[]}}));
 const owner=createCourtBandsR3Sources(f.options),controller=new AbortController();controller.abort();
 assert.throws(()=>owner.prepareRegion('different'),/frozen plan/);
 assert.throws(()=>owner.prepareRegion(f.regionId,{signal:controller.signal}),{name:'AbortError'});
 assert.equal(f.loads,0);owner.dispose();await owner.whenIdle();
});
test('provider failure remains observable and cleanup errors do not skip the other owner',async()=>{
 const f=fixture();f.record.review='unverified';f.record.owner.dispose=()=>{f.events.push('failed-leaf-cleanup');throw new Error('release failed');};
 const owner=createCourtBandsR3Sources(f.options);await assert.rejects(owner.prepareRegion(f.regionId),AggregateError);
 assert.throws(()=>owner.dispose(),AggregateError);assert.equal(f.events.includes('western-dispose'),true);
 await assert.rejects(owner.whenIdle(),AggregateError);
});
