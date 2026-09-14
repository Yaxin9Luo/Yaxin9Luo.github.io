import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createXieqiquCourtGardenOwner} from '../src/yuanmingyuan/xieqiqu-court-garden-owner.js';
import {createXieqiquCourtGardenR1Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r1-layout.js';
import {createXieqiquCourtGardenR2Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r2-layout.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
  const events=[],group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  group.add(mesh);
  const base={group,diagnostics:{assetId:'xieqiqu-complete-group',triangles:12},dispose(){events.push('base');group.clear();},update:time=>events.push('base-update:'+time)};
  const sources={prepareRegion:async()=>({sources:{fixture:true}}),dispose:()=>events.push('sources'),whenIdle:async()=>events.push('idle'),snapshot:()=>({sources:2}),update:time=>events.push('sources-update:'+time)};
  let garden,options;
  const prepareGarden=async input=>{
    options=input;const view=new THREE.Group();view.name='garden';group.add(view);
    let disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;view.removeFromParent();events.push('garden');input.signal.removeEventListener('abort',dispose);};
    input.signal.addEventListener('abort',dispose,{once:true});
    garden={group:view,dispose,diagnostics:{plantCount:124},assertCurrent(){assert.equal(disposed,false);assert.equal(view.parent,group);return true;}};
    return garden;
  };
  return {events,base,sources,prepareGarden,get garden(){return garden;},get options(){return options;},
    deps:{loadBase:async()=>base,createSources:()=>sources,prepareGarden}};
}

test('the full building and borrowed garden move together before actual support; disposal is views, sources, base',async()=>{
  const f=fixture(),owner=await createXieqiquCourtGardenOwner(f.deps);
  assert.equal(owner.group,f.base.group);assert.equal(owner.collisionGroup,owner.group);
  assert.equal(f.options.buildSupport,false);assert.equal(f.options.owner,f.base);
  owner.group.position.set(20,4,-50);owner.group.rotation.y=.7;owner.group.updateMatrixWorld(true);
  assert.equal(owner.assertCurrent(),true);assert.equal(f.garden.group.parent,owner.group);
  owner.update(2);assert.deepEqual(f.events,['base-update:2','sources-update:2']);
  owner.dispose();owner.dispose();assert.deepEqual(f.events.slice(2),['garden','sources','base']);
  assert.equal(owner.disposed,true);await owner.whenIdle();assert.equal(f.events.at(-1),'idle');
});
test('page abort after completion releases views before source owners',async()=>{
  const f=fixture(),controller=new AbortController(),owner=await createXieqiquCourtGardenOwner({...f.deps,signal:controller.signal});
  controller.abort();assert.equal(owner.disposed,true);assert.deepEqual(f.events,['garden','sources','base']);
});
test('a late building returned after cancellation is released once without starting plants',async()=>{
  const f=fixture(),load=deferred(),controller=new AbortController();
  const promise=createXieqiquCourtGardenOwner({...f.deps,loadBase:()=>load.promise,signal:controller.signal});
  controller.abort();load.resolve(f.base);await assert.rejects(promise,{name:'AbortError'});
  assert.deepEqual(f.events,['base']);
});
test('cancellation while the source request is pending closes the returned prototypes and base',async()=>{
  const f=fixture(),prepared=deferred(),started=deferred(),controller=new AbortController();
  f.sources.prepareRegion=()=>{started.resolve();return prepared.promise;};
  const promise=createXieqiquCourtGardenOwner({...f.deps,signal:controller.signal});
  await started.promise;controller.abort();assert.deepEqual(f.events,[]);
  prepared.resolve({sources:{}});await assert.rejects(promise,{name:'AbortError'});
  assert.deepEqual(f.events,['sources','base','idle']);
});
test('a noncooperative late garden is detached before the prototypes are disposed',async()=>{
  const f=fixture(),built=deferred(),started=deferred(),controller=new AbortController();
  const promise=createXieqiquCourtGardenOwner({...f.deps,signal:controller.signal,
    prepareGarden:()=>{started.resolve();return built.promise;}});
  await started.promise;controller.abort();assert.deepEqual(f.events,[]);
  built.resolve({dispose:()=>f.events.push('garden')});
  await assert.rejects(promise,{name:'AbortError'});assert.deepEqual(f.events,['garden','sources','base','idle']);
});
test('binding failure restores and releases sources, and a cleanup error never skips the base',async()=>{
  const f=fixture();
  f.sources.dispose=()=>{f.events.push('sources');throw new Error('source-dispose');};
  await assert.rejects(createXieqiquCourtGardenOwner({...f.deps,prepareGarden:async()=>{throw new Error('binding');}}),
    error=>error instanceof AggregateError&&error.errors.some(e=>e.message==='binding')&&error.errors.some(e=>e.message==='source-dispose'));
  assert.deepEqual(f.events,['sources','base','idle']);
});
test('abort from final progress cannot publish an already disposed owner',async()=>{
  const f=fixture(),controller=new AbortController();
  await assert.rejects(createXieqiquCourtGardenOwner({...f.deps,signal:controller.signal,
    onProgress:event=>{if(event.stage==='court-garden-ready')controller.abort();}}),{name:'AbortError'});
  assert.deepEqual(f.events,['garden','sources','base','idle']);
});


test('an invalidated garden during the animation update retires the complete owner',async()=>{
  const f=fixture(),owner=await createXieqiquCourtGardenOwner(f.deps);
  f.garden.assertCurrent=()=>{f.garden.dispose();throw new Error('source invalidated');};
  assert.throws(()=>owner.update(3),/source invalidated/);
  assert.equal(owner.disposed,true);assert.deepEqual(f.events,['garden','sources','base']);
  owner.update(4);owner.dispose();assert.equal(f.events.length,3);
});


for(const [id,layout]of [['default',undefined],['R2',createXieqiquCourtGardenR2Layout()]])test(id+' source request and binding share one immutable plan',async()=>{
  const f=fixture();let sourceLayout,region;
  const prepareRegion=f.sources.prepareRegion;f.sources.prepareRegion=(id,options)=>{region=id;return prepareRegion(id,options);};
  const owner=await createXieqiquCourtGardenOwner({...f.deps,...(layout?{layout}:{}),createSources:options=>{sourceLayout=options.plantingLayout;return f.sources;}});
  try{
    const plan=f.options.layout;assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.placements));
    if(layout)assert.equal(plan,layout);else assert.deepEqual(plan,createXieqiquCourtGardenR1Layout());
    assert.equal(sourceLayout,plan.sourceLayout);assert.equal(region,plan.id);
    assert.deepEqual(sourceLayout.regions[0].placements,plan.placements.map(p=>({species:p.species})));
    assert.equal(f.options.buildSupport,false);owner.dispose();assert.deepEqual(f.events,['garden','sources','base']);
  }finally{owner.dispose();}
});
test('R2 cancellation after source preparation starts follows the same pending ownership order',async()=>{
  const f=fixture(),layout=createXieqiquCourtGardenR2Layout(),started=deferred(),prepared=deferred(),controller=new AbortController();
  f.sources.prepareRegion=id=>{assert.equal(id,layout.id);started.resolve();return prepared.promise;};
  const promise=createXieqiquCourtGardenOwner({...f.deps,layout,signal:controller.signal});
  await started.promise;controller.abort();assert.deepEqual(f.events,[]);
  prepared.resolve({sources:{}});await assert.rejects(promise,{name:'AbortError'});
  assert.deepEqual(f.events,['sources','base','idle']);assert.equal(f.options,undefined);
});
