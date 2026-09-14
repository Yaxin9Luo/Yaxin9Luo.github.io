import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const descriptor=id=>({id,assetId:id,representation:'full',site:{id,assetId:id,position:[0,4,0],rotationY:0,scale:1},approvedFullSHA256:'a'.repeat(64),source:{manifestURL:`/full/${id}.json`,approvedManifestSHA256:'a'.repeat(64)}});

function fixture({ids=['a','b'],signal,mountFull,loadFull}={}){
  const root=new Group(),descriptors=ids.map(descriptor),resources=[],events=[],counts={loads:0,mounts:0,visitMounts:0};let director,useResident=true;
  function owner(id,{disposeError=false}={}){
    const group=new Group(),geometry=new BoxGeometry(6,.25,6),material=new MeshBasicMaterial();group.position.y=3.875;group.add(new Mesh(geometry,material));let disposed=false;
    group.addEventListener('removed',()=>events.push('remove:'+id));
    const value={group,archive:{id,manifestSHA256:'a'.repeat(64)},disposeCalls:0,get disposed(){return disposed;},dispose(){this.disposeCalls++;disposed=true;events.push('dispose:'+id);geometry.dispose();material.dispose();group.clear();if(disposeError)throw new Error('owner dispose failure');}};
    resources.push(value);return value;
  }
  const controller=createMuseumSiteController({root,sites:descriptors,signal,load:(d,options)=>useResident?director.borrow(d.id,options):Promise.resolve(owner('independent-'+d.id)),release:resource=>{if(resource===director.get('a')?.owner||resource===director.get('b')?.owner||residentOwners.has(resource))director.release(resource);else{resource.group.removeFromParent();resource.dispose();}},mount:(resource,d)=>{
    counts.visitMounts++;if(!resource.group.parent)root.add(resource.group);assert.equal(resource.group.parent,root);
    const surface=createArchitectureSurface(resource.group);events.push('visit:'+d.id);
    return()=>{surface.dispose();events.push('visit-unmount:'+d.id);};
  }});
  const residentOwners=new WeakSet();
  director=createMuseumResidentBuildings({root,descriptors,siteController:controller,signal,baseURL:'https://resident-borrow.test/world/',loadFull:async(d,context)=>{
    counts.loads++;const resource=loadFull?await loadFull(d,context,{owner,events,counts}):owner(d.id);residentOwners.add(resource);return resource;
  },mountFull:(resource,d)=>{counts.mounts++;return mountFull?mountFull(resource,d,{owner,events,counts}):()=>events.push('resident-unmount:'+d.id);}});
  return {root,descriptors,director,controller,resources,events,counts,owner,useIndependent(){useResident=false;},async dispose(){try{controller.dispose();}finally{await director.dispose();for(const resource of resources)if(!resource.disposeCalls)try{resource.dispose();}catch{}}}};
}

test('get and borrow publish only a ready owner; borrow never starts or waits for decoding',async()=>{
  const started=deferred(),gate=deferred(),f=fixture({ids:['a'],mountFull(){started.resolve();return gate.promise;}});
  try{
    assert.equal(f.director.get('a'),null);assert.equal(f.director.get('missing'),null);
    await assert.rejects(f.director.borrow('a'),/ready/i);assert.equal(f.counts.loads,0);
    const loading=f.director.load();await started.promise;assert.equal(f.director.get('a'),null);await assert.rejects(f.director.borrow('a'),/ready/i);assert.equal(f.counts.loads,1);
    gate.resolve(()=>f.events.push('resident-unmount:a'));await loading;const record=f.director.get('a');
    assert.equal(record.owner,f.resources[0]);assert.equal(record.descriptor,f.descriptors[0]);assert.equal(record.owner.archive,f.resources[0].archive);assert.equal(f.director.get('a'),record);
    assert.equal(await f.director.borrow('a'),record.owner);assert.equal(f.director.snapshot.borrowers,1);assert.equal(f.director.snapshot.full[0].borrowers,1);f.director.release(record.owner);
    assert.equal(f.counts.loads,1);assert.equal(f.counts.mounts,1);
  }finally{gate.resolve(()=>{});await f.dispose();}
});

test('controller A to B to A and cancellation reuse the same full models and release only visit-local support',async()=>{
  const f=fixture();try{await f.director.load();const a=f.director.get('a').owner,b=f.director.get('b').owner;
    for(const [id,expected] of [['a',a],['b',b],['a',a]]){
      assert.equal(await f.controller.select(id),expected);for(let i=0;i<3;i++){f.director.evaluate({});assert.equal(expected.group.visible,true,'a shared primary must never hide itself');}
      assert.equal(f.director.snapshot.borrowers,1);assert.equal(a.disposeCalls+b.disposeCalls,0);assert.equal(f.director.snapshot.full.find(r=>r.id===id).primaryVisible,true);
    }
    f.controller.cancel();f.director.evaluate({});assert.equal(f.director.snapshot.borrowers,0);assert.equal(f.counts.loads,2);assert.equal(f.counts.mounts,2);assert.equal(f.counts.visitMounts,3);assert(a.group.visible&&b.group.visible);assert.equal(a.group.parent,f.root);assert.equal(b.group.parent,f.root);assert.equal(a.disposeCalls+b.disposeCalls,0);
  }finally{await f.dispose();}assert(f.resources.every(resource=>resource.disposeCalls===1));
});

test('a genuinely different ready primary hides the resident, which reappears after that primary leaves',async()=>{
  const f=fixture({ids:['a']});try{await f.director.load();const resident=f.director.get('a').owner;await f.controller.select('a');f.director.evaluate({});assert.equal(resident.group.visible,true);
    f.controller.cancel();f.useIndependent();const independent=await f.controller.select('a');assert.notEqual(independent,resident);
    f.director.evaluate({});assert.equal(independent.group.visible,true);assert.equal(resident.group.visible,false);assert.equal(resident.disposeCalls,0);assert.equal(f.director.snapshot.borrowers,0);
    f.controller.cancel();f.director.evaluate({});assert.equal(independent.disposeCalls,1);assert.equal(resident.group.visible,true);assert.equal(f.counts.loads,1);
  }finally{await f.dispose();}
});

test('pre-aborted and invalid requests cannot acquire a borrow; over-release never disposes the source',async()=>{
  const f=fixture({ids:['a']});try{await f.director.load();const a=f.director.get('a').owner,abort=new AbortController(),reason=new Error('visit cancelled');abort.abort(reason);
    await assert.rejects(f.director.borrow('a',{signal:abort.signal}),error=>error===reason);await assert.rejects(f.director.borrow('missing'),/unknown/i);assert.equal(f.director.snapshot.borrowers,0);
    assert.throws(()=>f.director.release({}),/borrow/i);assert.throws(()=>f.director.release(a),/borrow/i);
    assert.equal(await f.director.borrow('a'),a);assert.equal(await f.director.borrow('a'),a);assert.equal(f.director.snapshot.full[0].borrowers,2);
    assert.equal(f.director.release(a),1);assert.equal(f.director.release(a),0);assert.throws(()=>f.director.release(a),/borrow/i);assert.equal(a.disposeCalls,0);assert.equal(a.group.parent,f.root);
  }finally{await f.dispose();}
});

test('a cancelled controller request returns its already acquired late borrow exactly once',async()=>{
  const f=fixture({ids:['a']}),acquired=deferred(),gate=deferred();let controller;
  try{await f.director.load();const owner=f.director.get('a').owner;controller=createMuseumSiteController({sites:f.descriptors,load:async(d,{signal})=>{const value=await f.director.borrow(d.id,{signal});acquired.resolve();await gate.promise;return value;},mount:()=>{throw new Error('cancelled borrow must not mount');},release:resource=>f.director.release(resource)});
    const pending=controller.select('a');await acquired.promise;assert.equal(f.director.snapshot.borrowers,1);controller.cancel();gate.resolve();assert.equal(await pending,null);assert.equal(f.director.snapshot.borrowers,0);assert.equal(owner.disposeCalls,0);assert.equal(owner.group.parent,f.root);assert.equal(f.counts.loads,1);
  }finally{gate.resolve();controller?.dispose();await f.dispose();}
});

test('page disposal releases resident mounts and owners once despite outstanding borrows, with later return still safe',async()=>{
  const f=fixture({ids:['a']});try{await f.director.load();const owner=await f.director.borrow('a');await f.director.dispose();
    assert.equal(f.director.get('a'),null);await assert.rejects(f.director.borrow('a'),/disposed/i);assert.equal(owner.disposeCalls,1);assert.equal(owner.group.parent,null);assert.deepEqual(f.events.slice(-3),['resident-unmount:a','remove:a','dispose:a']);
    assert.equal(f.director.snapshot.borrowers,1);assert.equal(f.director.release(owner),0);assert.equal(f.director.snapshot.borrowers,0);await f.director.dispose();assert.equal(owner.disposeCalls,1);assert.throws(()=>f.director.release(owner),/borrow/i);
  }finally{await f.dispose();}
});

test('a failed full load cannot be borrowed, and explicit retry still loads only the failed source',async()=>{
  let fail=true;const f=fixture({loadFull(d,_context,h){if(d.id==='a'&&fail)throw new Error('source SHA rejected');return h.owner(d.id);}});
  try{await f.director.load();assert.equal(f.director.get('a'),null);await assert.rejects(f.director.borrow('a'),/ready/i);const b=f.director.get('b').owner;
    fail=false;await f.director.load();assert.equal(f.director.get('b').owner,b);assert.equal(f.counts.loads,3);assert.equal(f.director.snapshot.full.find(r=>r.id==='a').error,null);
    const a=await f.director.borrow('a');f.director.release(a);assert.equal(f.counts.loads,3);
  }finally{await f.dispose();}
});

test('a duplicate loader owner is rejected without destroying the other ready resident or aliasing borrow counts',async()=>{
  let shared;const f=fixture({loadFull(_d,_context,h){return shared??=h.owner('a');}});
  try{await f.director.load();assert.equal(shared.disposeCalls,0);assert.equal(f.director.get('a').owner,shared);assert.equal(f.director.get('b'),null);assert.match(f.director.snapshot.full[1].error,/distinct|already/i);
    assert.equal(await f.director.borrow('a'),shared);f.director.release(shared);assert.equal(f.director.snapshot.borrowers,0);
  }finally{await f.dispose();}assert.equal(shared.disposeCalls,1);
});

test('a failed earlier owner cannot return a borrow issued to a newer owner of the same descriptor',async()=>{
  let fail=true;const f=fixture({ids:['a'],mountFull(){if(fail)throw new Error('first source mount failed');return()=>{};}});
  try{await f.director.load();const old=f.resources[0];assert.equal(old.disposeCalls,1);fail=false;await f.director.load();const current=await f.director.borrow('a');assert.notEqual(old,current);
    assert.throws(()=>f.director.release(old),/borrow/i);assert.equal(f.director.snapshot.borrowers,1);assert.equal(f.director.release(current),0);assert.equal(current.disposeCalls,0);
  }finally{await f.dispose();}assert(f.resources.every(owner=>owner.disposeCalls===1));
});

test('throwing resident unmount still releases all owners, and does not invalidate outstanding return accounting',async()=>{
  const f=fixture({mountFull(_owner,d,h){return()=>{h.events.push('resident-unmount:'+d.id);if(d.id==='a')throw new Error('unbind failed');};}});
  try{await f.director.load();const a=await f.director.borrow('a');await f.director.dispose();assert(f.resources.every(owner=>owner.disposeCalls===1&&owner.group.parent===null));assert(f.director.snapshot.disposalErrors.some(error=>/unbind failed/.test(error.error)));assert.equal(f.director.release(a),0);assert.equal(f.director.snapshot.borrowers,0);
  }finally{await f.dispose();}
});
