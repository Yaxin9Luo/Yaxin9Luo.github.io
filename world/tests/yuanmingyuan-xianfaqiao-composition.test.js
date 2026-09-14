import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {museumSite} from '../src/yuanmingyuan/museum-sites.js';
import {createXianfaqiaoComposition,xianfaqiaoRouteLanding} from '../src/yuanmingyuan/xianfaqiao-composition.js';
import {xianfaqiaoArchive} from '../src/yuanmingyuan/xianfaqiao-integration.js';
import {createMuseumNavigation} from '../src/yuanmingyuan/visitor-motion.js';
import {compositionOwner,compositionGround} from './helpers/xianfaqiao-composition-fixture.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const ownersFor=(events=[])=>new Map(['xieqiqu','xianfaqiao'].map(id=>[id,compositionOwner(id,events)]));
function fixture(owners,options={}){return createXianfaqiaoComposition({root:new Group(),load:async id=>owners.get(id),...options});}
let ground;
test.before(async()=>{const owners=ownersFor(),composition=fixture(owners);try{ground=compositionGround(await composition.prepare());}finally{composition.dispose();}});
test.after(()=>ground.dispose());

test('prepare serially retains exactly two complete source owners; water handoff gates borrowing and both approvals remain false',async()=>{
  const owners=ownersFor(),calls=[],gate=deferred(),entered=deferred();
  const composition=fixture(owners,{load:async(id,options)=>{calls.push([id,options]);if(id==='xianfaqiao'){entered.resolve();await gate.promise;}return owners.get(id);}});
  try{
    const pending=composition.prepare();await entered.promise;
    assert.deepEqual(calls.map(c=>c[0]),['xieqiqu','xianfaqiao']);assert.equal(calls[0][1].manifestURL,undefined);
    assert.equal(calls[1][1].manifestURL,xianfaqiaoArchive.manifestURL);assert.equal(calls[1][1].expectedManifestSHA256,xianfaqiaoArchive.manifestSHA256);
    assert.equal(composition.group.visible,false);await assert.rejects(composition.borrow('xieqiqu'),/handoff/);
    gate.resolve();const plan=await pending;assert.equal(plan.courts.length,3);assert.equal(plan.paths.length,2);assert.equal(plan.replacements.length,0);
    assert.equal(composition.group.visible,false);assert.equal(composition.snapshot.nativeApproved,false);assert.equal(composition.snapshot.composedWorldApproved,false);
    assert.equal(composition.get('xieqiqu').owner,owners.get('xieqiqu'));assert.equal(composition.get('xieqiqu').support.diagnostics.source,'actual-static-mesh-triangles');
    const actual=composition.get('xieqiqu').support.surfaceAt(347,-566.77,{maxY:5});assert.deepEqual(composition.support.surfaceAt(347,-566.77,{maxY:5}),actual);assert(Math.abs(actual.height-4)<1e-6);
    composition.bindWater(ground);assert.equal(composition.group.visible,true);assert.equal(composition.snapshot.waterBound,true);
    for(const owner of owners.values())assert(owner.sheets.every(mesh=>!mesh.visible&&mesh.userData.navigation===false));
    const first=await composition.borrow('xieqiqu');composition.release(first);const second=await composition.borrow('xianfaqiao');composition.release(second);
    assert.equal(await composition.borrow('xieqiqu'),first);composition.release(first);assert.equal(calls.length,2);
    composition.update(1);composition.update(2);for(const owner of owners.values()){assert.deepEqual(owner.updates,[1,2]);assert.equal(owner.disposeCalls,0);}
  }finally{composition.dispose();}
  for(const owner of owners.values()){assert.equal(owner.disposeCalls,1);assert(owner.disposedSheets.every(state=>state.visible&&state.navigation===undefined));}
  assert.equal(ground.terrain.disposed,false);assert.equal(ground.water.snapshot().disposed,false);
});

test('second pool binder failure restores the already hidden first pair and releases every source/support',async()=>{
  const owners=ownersFor(),composition=fixture(owners);await composition.prepare();const supports=composition.sites.map(site=>composition.get(site.id).support);
  const sheetIndex=ground.water.snapshot().sheets.findIndex(sheet=>sheet.height===4.13),sheet=ground.water.sheets[sheetIndex],range={...sheet.geometry.drawRange};
  try{sheet.geometry.setDrawRange(0,0);assert.throws(()=>composition.bindWater(ground),/both complete Xieqiqu pools/);}
  finally{sheet.geometry.setDrawRange(range.start,range.count);composition.dispose();}
  assert.equal(composition.disposed,true);assert.equal(composition.snapshot.waterBound,false);assert.equal(composition.group.parent,null);
  for(const support of supports)assert.equal(support.disposed,true);
  for(const owner of owners.values()){assert.equal(owner.disposeCalls,1);assert(owner.disposedSheets.every(state=>state.visible&&state.navigation===undefined));}
  assert.equal(ground.terrain.disposed,false);assert.equal(ground.water.snapshot().disposed,false);
});

test('abort closes local support, restores sheets before owner disposal, and outstanding borrows can still be returned',async()=>{
  const owners=ownersFor(),controller=new AbortController(),composition=fixture(owners,{signal:controller.signal});await composition.prepare();composition.bindWater(ground);
  const owner=await composition.borrow('xieqiqu'),support=composition.get('xieqiqu').support,local=composition.support.createGuideSupport({minX:343,maxX:353,minZ:-575,maxZ:-560});
  controller.abort();assert.equal(composition.disposed,true);assert.equal(support.disposed,true);assert.equal(local.snapshot().disposed,true);
  composition.release(owner);assert.equal(composition.snapshot.ensemble.records.reduce((n,r)=>n+r.borrowers,0),0);
  assert.throws(()=>composition.release(owner),/outstanding/);await assert.rejects(composition.borrow('xieqiqu'),/handoff/);
  for(const item of owners.values()){assert.equal(item.disposeCalls,1);assert(item.disposedSheets.every(state=>state.visible));}composition.dispose();
});

test('abort during the second decoder immediately releases the first and later reclaims its late owner once',async()=>{
  const events=[],owners=ownersFor(events),controller=new AbortController(),gate=deferred(),entered=deferred();
  const composition=fixture(owners,{signal:controller.signal,load:async id=>{if(id==='xianfaqiao'){entered.resolve();await gate.promise;}return owners.get(id);}});
  const operation=composition.prepare();await entered.promise;controller.abort();assert.equal(owners.get('xieqiqu').disposeCalls,1);assert.equal(owners.get('xianfaqiao').disposeCalls,0);
  gate.resolve();await assert.rejects(operation,/abort|disposed/i);assert.equal(owners.get('xianfaqiao').disposeCalls,1);assert.equal(composition.group.parent,null);composition.dispose();
});

test('a full source load failure leaves no active patch or owner, without allocating ground',async()=>{
  const peer=compositionOwner('xieqiqu'),composition=createXianfaqiaoComposition({root:new Group(),load:async id=>{if(id==='xianfaqiao')throw new Error('Decoder failed');return peer;}});
  await assert.rejects(composition.prepare(),/Decoder failed/);assert.equal(peer.disposeCalls,1);assert.equal(composition.plan,null);assert.equal(composition.support,null);assert.equal(composition.snapshot.waterBound,false);composition.dispose();
});

test('route landing and two seconds use the same live navigation triangles, not prescribed waypoint heights',async()=>{
  const owners=ownersFor(),composition=fixture(owners);await composition.prepare();composition.bindWater(ground);
  try{
    const nav=createMuseumNavigation({terrain:ground.terrain,architecture:()=>composition.support}),result=xianfaqiaoRouteLanding(composition,nav);
    assert.equal(result.valid,true);assert.equal(result.position.y,result.support.y);assert.equal(result.support.normal.y>0.95,true);
    let state={position:result.position,heading:0},distance=0;
    for(let i=0;i<120;i++){const step=nav.walk(state,{...result.direction,run:false},1/60);assert.equal(step.blocked,false,`actual approach blocked at step ${i}`);assert.equal(step.support.valid,true);state={position:step.position,heading:step.heading};distance+=step.distance;}
    assert(distance>6.3&&distance<6.6);assert(state.position.y>result.position.y+.15);assert(state.position.z>result.position.z+5.5);
    const rejected=xianfaqiaoRouteLanding(composition,{landing:()=>({valid:false,reason:'blocked'})});assert.equal(rejected.valid,false);assert.equal(rejected.position,undefined);
  }finally{composition.dispose();}
});


test('a live source update failure closes aggregate and local queries before leaving the failed composition',async()=>{
  const owners=ownersFor(),composition=fixture(owners);await composition.prepare();composition.bindWater(ground);
  const aggregate=composition.support,supports=composition.sites.map(site=>composition.get(site.id).support);
  const local=aggregate.createGuideSupport({minX:343,maxX:353,minZ:-575,maxZ:-560});
  owners.get('xieqiqu').update=()=>{throw new Error('Invalidated court source');};
  assert.throws(()=>composition.update(1),/Invalidated court source/);
  assert.equal(composition.disposed,true);assert.equal(composition.snapshot.status,'failed');assert.match(composition.snapshot.lastError,/Invalidated court source/);
  assert.equal(aggregate.disposed,true);assert(supports.every(s=>s.disposed));assert.equal(local.snapshot().disposed,true);
  assert.equal(composition.group.parent,null);assert.equal(ground.terrain.disposed,false);
  for(const owner of owners.values())assert.equal(owner.disposeCalls,1);
  composition.update(2);composition.dispose();for(const owner of owners.values())assert.equal(owner.disposeCalls,1);
});

test('only the R4 composition descriptor enters at the reviewed north retreat and retains existing focus, guide and bridge',()=>{
  const load=()=>{throw new Error('Descriptor inspection must not build either source');};
  const current=createXianfaqiaoComposition({root:new Group(),load,court:'garden-r4'});
  const legacy=createXianfaqiaoComposition({root:new Group(),load});
  try{
    const peer=current.sites.find(site=>site.id==='xieqiqu'),old=legacy.sites.find(site=>site.id==='xieqiqu');
    assert.deepEqual(peer.arrival,[0,13,-55]);
    assert.equal(peer.viewYaw,Math.PI-Math.atan2(4,12));
    const {arrival,viewYaw,...retained}=peer,{arrival:oldArrival,...oldRetained}=old;
    assert.deepEqual(retained,oldRetained,'all placement, focus, guide and source properties remain identical');
    assert.deepEqual(current.sites.find(site=>site.id==='xianfaqiao'),legacy.sites.find(site=>site.id==='xianfaqiao'));
    assert.equal(current.snapshot.nativeApproved,false);assert.equal(current.snapshot.composedWorldApproved,false);
  }finally{current.dispose();legacy.dispose();}
});

test('legacy, R1, R2, R3 and unknown court descriptors retain the established west bridge arrival',()=>{
  for(const court of [undefined,null,'garden-r1','garden-r2','garden-r3','unknown']){
    const owner=createXianfaqiaoComposition({root:new Group(),load(){throw new Error('Unexpected source load');},court});
    try{
      const peer=owner.sites.find(site=>site.id==='xieqiqu');
      assert.deepEqual(peer.arrival,[-48,10,-1.77]);assert.equal(peer.viewYaw,undefined);
      assert.deepEqual(peer.focus,[-26,5,17]);assert.deepEqual(peer.guide,[-45,.04,-5]);
    }finally{owner.dispose();}
  }
});

test('R4 descriptor construction does not mutate the ordinary noncomposition museum site',()=>{
  const before=structuredClone(museumSite('xieqiqu'));
  const owner=createXianfaqiaoComposition({root:new Group(),load(){throw new Error('Unexpected source load');},court:'garden-r4'});
  try{assert.deepEqual(museumSite('xieqiqu'),before);assert.deepEqual(museumSite('xieqiqu').arrival,[0,15,50]);}
  finally{owner.dispose();}
});
