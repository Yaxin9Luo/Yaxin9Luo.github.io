import test from 'node:test';
import assert from 'node:assert/strict';
import {createXieqiquCourtCompositionR3} from '../src/yuanmingyuan/xieqiqu-court-composition-r3.js';

function fixture(){
 const events=[],shared={name:'original'},privateMaterial={name:'private'},group={floor:{material:shared}};
 const court={
   group,diagnostics:{courtGarden:{plantCount:10}},
   assertCurrent(){assert.equal(group.floor.material,privateMaterial);},
   dispose(){events.push('court');group.floor.material=shared;},
   async whenIdle(){events.push('court-idle');},
 };
 const pool={dispose(){events.push('pool');}};
 let combined,paving;
 const options={
   layout:Object.freeze({id:'explicit-plan'}),createSources(){},prepareGarden(){},
   async createCourt(){events.push('garden-ready');group.floor.material=privateMaterial;return court;},
   createPool(){events.push('pool-ready');return pool;},
   combineFish({buildingOwner,poolOwner}){
     assert.equal(buildingOwner,court);assert.equal(poolOwner,pool);
     const capturedMaterial=group.floor.material;
     combined={group,diagnostics:{},validate(){assert.equal(group.floor.material,capturedMaterial);court.assertCurrent();return true;},
       update(time){events.push(['update',time]);},
       dispose(){events.push('fish-detach');poolOwner.dispose();buildingOwner.dispose();}
     };return combined;
   },
   decoratePaving(){
     paving={diagnostics:{},assertCurrent(){assert.equal(group.floor.material,privateMaterial);},
       dispose(){events.push('paving');}};
     return paving;
   }
 };
 return{events,group,court,pool,options};
}
test('the final private floor is retained through fish validation and release follows real owner dependencies',async()=>{
 const f=fixture(),owner=await createXieqiquCourtCompositionR3(f.options);
 assert.equal(owner.reviewSourceOwner,f.court);
 owner.assertCurrent();owner.update(2);owner.dispose();owner.dispose();await owner.whenIdle();
 assert.deepEqual(f.events,['garden-ready','pool-ready',['update',2],'paving','fish-detach','pool','court','court-idle']);
 assert.equal(owner.disposed,true);
});
test('a late court result after cancellation is released before any pool is created',async()=>{
 const f=fixture(),controller=new AbortController();let resolve;
 const task=createXieqiquCourtCompositionR3({...f.options,signal:controller.signal,createCourt:()=>new Promise(r=>{resolve=r;})});
 controller.abort();resolve(f.court);
 await assert.rejects(task,{name:'AbortError'});
 assert.deepEqual(f.events,['court','court-idle']);
});
test('failed material decoration retires the complete combined owner once',async()=>{
 const f=fixture();
 await assert.rejects(createXieqiquCourtCompositionR3({...f.options,decoratePaving:async()=>{throw new Error('texture unavailable');}}),/texture unavailable/);
 assert.deepEqual(f.events,['garden-ready','pool-ready','fish-detach','pool','court','court-idle']);
});
test('failed fish transaction leaves caller-owned court and pool available for cleanup',async()=>{
 const f=fixture();
 await assert.rejects(createXieqiquCourtCompositionR3({...f.options,combineFish:()=>{throw new Error('invalid source slot');}}),/invalid source slot/);
 assert.deepEqual(f.events,['garden-ready','pool-ready','pool','court','court-idle']);
});
test('late paving result after abort is released and never published',async()=>{
 const f=fixture(),controller=new AbortController();let resolve;
 const task=createXieqiquCourtCompositionR3({...f.options,signal:controller.signal,decoratePaving:()=>new Promise(r=>{resolve=r;})});
 while(!resolve)await new Promise(r=>setImmediate(r));
 controller.abort();resolve({dispose(){f.events.push('late-paving');}});
 await assert.rejects(task,{name:'AbortError'});
 assert.deepEqual(f.events,['garden-ready','pool-ready','fish-detach','pool','court','late-paving','court-idle']);
});

test('source invalidation during update releases the outer material and fish owners too',async()=>{
 const f=fixture(),owner=await createXieqiquCourtCompositionR3(f.options);
 f.court.assertCurrent=()=>{throw new Error('court source invalidated');};
 assert.throws(()=>owner.update(1),/court source invalidated/);
 assert.equal(owner.disposed,true);await owner.whenIdle();
 assert.deepEqual(f.events,['garden-ready','pool-ready','paving','fish-detach','pool','court','court-idle']);
 owner.dispose();
 assert.equal(f.events.filter(x=>x==='paving').length,1);
});
test('a failed ready paving guard cannot leave the assembly drawable',async()=>{
 const f=fixture();let invalid=false;
 const owner=await createXieqiquCourtCompositionR3({...f.options,decoratePaving:()=>({
   assertCurrent(){if(invalid)throw new Error('paving source invalidated');},
   dispose(){f.events.push('paving');}
 })});
 invalid=true;assert.throws(()=>owner.assertCurrent(),/paving source invalidated/);
 assert.equal(owner.disposed,true);owner.update(2);await owner.whenIdle();
 assert.deepEqual(f.events,['garden-ready','pool-ready','paving','fish-detach','pool','court','court-idle']);
});
test('an inner animation failure retires the complete composition',async()=>{
 const f=fixture(),combine=f.options.combineFish;
 const owner=await createXieqiquCourtCompositionR3({...f.options,combineFish:options=>{
   const result=combine(options);result.update=()=>{throw new Error('animation invalidated');};return result;
 }});
 assert.throws(()=>owner.update(3),/animation invalidated/);
 assert.equal(owner.disposed,true);await owner.whenIdle();
 assert.deepEqual(f.events,['garden-ready','pool-ready','paving','fish-detach','pool','court','court-idle']);
});


function throwingPaving(f){
 const failure=new Error('paving disposal sentinel');
 f.options.decoratePaving=()=>({assertCurrent(){},dispose(){f.events.push('paving');throw failure;}});
 return failure;
}
test('explicit disposal reports failures after releasing every other dependency exactly once',async()=>{
 const f=fixture(),failure=throwingPaving(f),owner=await createXieqiquCourtCompositionR3(f.options);
 assert.throws(()=>owner.dispose(),error=>error instanceof AggregateError&&error.errors.includes(failure));
 assert.equal(owner.disposed,true);assert.deepEqual(f.events,['garden-ready','pool-ready','paving','fish-detach','pool','court']);
 assert.throws(()=>owner.dispose(),AggregateError);
 assert.equal(f.events.filter(e=>e==='court').length,1);
 await assert.rejects(owner.whenIdle(),error=>error.errors.includes(failure));
});
test('abort listeners do not throw cleanup errors out of EventTarget, but whenIdle reports them',async()=>{
 const f=fixture(),failure=throwingPaving(f),controller=new AbortController(),owner=await createXieqiquCourtCompositionR3({...f.options,signal:controller.signal});
 assert.doesNotThrow(()=>controller.abort());assert.equal(owner.disposed,true);
 await assert.rejects(owner.whenIdle(),error=>error.errors.includes(failure));
 assert.equal(f.events.filter(e=>e==='court').length,1);
});
test('validation failure preserves its cause when cleanup also fails',async()=>{
 const f=fixture(),failure=throwingPaving(f),owner=await createXieqiquCourtCompositionR3(f.options),original=new Error('changed source sentinel');
 f.court.assertCurrent=()=>{throw original;};
 assert.throws(()=>owner.assertCurrent(),error=>error.cause===original&&error.errors[0]===original&&error.errors.includes(failure));
 assert.equal(owner.disposed,true);assert.equal(f.events.filter(e=>e==='pool').length,1);
});
test('animation failure preserves its cause and reports one cleanup failure',async()=>{
 const f=fixture(),failure=throwingPaving(f),combine=f.options.combineFish,original=new Error('animation sentinel');
 f.options.combineFish=options=>({...combine(options),update(){throw original;}});
 const owner=await createXieqiquCourtCompositionR3(f.options);
 assert.throws(()=>owner.update(2),error=>error.cause===original&&error.errors.length===2&&error.errors.includes(failure));
 assert.equal(owner.disposed,true);
});
test('failed preparation awaits cleanup and preserves the preparation cause',async()=>{
 const f=fixture(),combine=f.options.combineFish,original=new Error('paving construction sentinel'),failure=new Error('combined cleanup sentinel');
 f.options.combineFish=options=>{const owner=combine(options);return {...owner,dispose(){owner.dispose();throw failure;}};};
 f.options.decoratePaving=()=>{throw original;};
 await assert.rejects(createXieqiquCourtCompositionR3(f.options),error=>error.cause===original&&error.errors[0]===original&&error.errors[1].errors.includes(failure));
 assert(f.events.includes('court-idle'));assert.equal(f.events.filter(e=>e==='court').length,1);
});
