import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const descriptor=id=>({id,assetId:id,representation:'full',site:{id,assetId:id,position:[0,0,0],rotationY:0,scale:1},source:{manifestURL:`/full/${id}.json`,approvedManifestSHA256:'a'.repeat(64)},approvedFullSHA256:'a'.repeat(64)});
function harness({ids=['a'],root=new THREE.Group(),mountFull,loadFull,layerError,signal}={}){
  const events=[],owners=[],descriptors=ids.map(descriptor),counts={layerDispose:0,loads:0,mounts:0};
  function owner(id){const group=new THREE.Group(),geometry=new THREE.BoxGeometry(4,2,6),material=new THREE.MeshBasicMaterial();group.name=id;group.position.set(7,4,-5);group.add(new THREE.Mesh(geometry,material));group.addEventListener('removed',()=>events.push(`remove:${id}`));const resource={group,disposeCalls:0,updates:0,dispose(){this.disposeCalls++;events.push(`dispose:${id}`);geometry.dispose();material.dispose();group.clear();},update(){this.updates++;}};owners.push(resource);return resource;}
  const layer={snapshot:{sites:[]},load:async()=>{events.push('distance-load');},setFullSites(){},evaluate(){return this.snapshot;},update(){},dispose(){counts.layerDispose++;if(layerError)throw new Error(layerError);}};
  const h={root,events,owners,descriptors,counts,owner,layer,director:null};
  h.director=createMuseumResidentBuildings({root,descriptors,signal,baseURL:'https://mount.test/world/',createDistance:()=>layer,loadFull:async(d,context)=>{counts.loads++;events.push(`load:${d.id}`);return loadFull?loadFull(d,context,h):owner(d.id);},...(mountFull?{mountFull:(resource,d)=>{counts.mounts++;events.push(`mount:${d.id}`);return mountFull(resource,d,h);}}:{})});
  h.dispose=async()=>{await h.director.dispose();for(const resource of owners)if(!resource.disposeCalls)resource.dispose();};return h;
}

test('mount hook sees the actual parent/world transform and valid bounds, and releases before removal/disposal',async()=>{
  const root=new THREE.Group();root.position.set(200,2,100);root.scale.setScalar(2);
  const h=harness({root,mountFull(resource,d,h){assert.equal(resource.group.parent,root);assert.equal(resource.group.visible,false);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(resource.group.matrixWorld).toArray(),[214,10,90]);const actual=new THREE.Box3().setFromObject(resource.group),state=h.director.snapshot.full[0];assert.deepEqual(state.bounds,{min:actual.min.toArray(),max:actual.max.toArray()});assert.equal(state.ready,false);assert.equal(state.mounting,true);return()=>{h.events.push(`unbind:${d.id}`);assert.equal(resource.group.parent,root);assert.equal(resource.disposeCalls,0);};}});
  try{await h.director.load();assert.equal(h.director.snapshot.full[0].ready,true);assert.equal(h.owners[0].group.visible,true);await h.director.load();assert.equal(h.counts.mounts,1);await h.director.dispose();assert.deepEqual(h.events.slice(-3),['unbind:a','remove:a','dispose:a']);assert.equal(h.owners[0].disposeCalls,1);}finally{await h.dispose();}
});

test('an async mount completes serially before readiness, nearest, animation or the next full load',async()=>{
  const started=deferred(),gate=deferred(),h=harness({ids:['a','b'],mountFull(_resource,d,h){if(d.id==='a'){started.resolve();return gate.promise;}return()=>h.events.push('unbind:b');}});
  try{const pending=h.director.load();await started.promise;assert.equal(h.director.load(),pending);assert.equal(h.counts.loads,1);assert.equal(h.director.snapshot.full[0].ready,false);assert.equal(h.director.snapshot.full[0].mounting,true);assert.equal(h.director.nearest(new THREE.Vector3(7,4,-5)),null);h.director.evaluate({});h.director.update(1);assert.equal(h.owners[0].group.visible,false);assert.equal(h.owners[0].updates,0);gate.resolve(()=>h.events.push('unbind:a'));await pending;assert.deepEqual(h.events.slice(0,5),['distance-load','load:a','mount:a','load:b','mount:b']);assert(h.director.snapshot.full.every(record=>record.ready));assert.equal(h.counts.loads,2);}finally{gate.resolve(()=>{});await h.dispose();}
});

test('cancellation waits for a pending mount cleanup, then unbinds before freeing the still-live hidden source',async()=>{
  const started=deferred(),gate=deferred(),h=harness({mountFull(){started.resolve();return gate.promise;}});
  try{const loading=h.director.load();await started.promise;let finished=false;const closing=h.director.dispose();closing.then(()=>{finished=true;});await flush();assert.equal(finished,false);assert.equal(h.owners[0].disposeCalls,0);assert.equal(h.owners[0].group.parent,h.root);assert.equal(h.owners[0].group.visible,false);assert.equal(h.director.snapshot.full[0].ready,false);
    gate.resolve(()=>{h.events.push('late-unbind:a');assert.equal(h.owners[0].disposeCalls,0);assert.equal(h.owners[0].group.parent,h.root);});await loading;await closing;assert.deepEqual(h.events.slice(-3),['late-unbind:a','remove:a','dispose:a']);assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.director.snapshot.full[0].ready,false);assert.equal(h.director.snapshot.full[0].mounting,false);assert.equal(h.owners[0].group.parent,null);
  }finally{gate.resolve(()=>{});await h.dispose();}
});

test('a hook that cancels synchronously still returns a cleanup that runs before owner release, without reentrant double disposal',async()=>{
  let firstClosing,secondClosing;const h=harness({mountFull(_resource,_d,h){firstClosing=h.director.dispose();return()=>{h.events.push('unbind:a');secondClosing=h.director.dispose();};}});
  try{await h.director.load();await firstClosing;assert.equal(secondClosing,firstClosing);assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.counts.layerDispose,1);assert.deepEqual(h.events.slice(-3),['unbind:a','remove:a','dispose:a']);assert.equal(h.director.snapshot.full[0].ready,false);}finally{await h.dispose();}
});

test('mount failure is visible, never reports ready, and does not prevent another full owner from mounting',async()=>{
  const h=harness({ids:['a','b'],mountFull(_resource,d,h){if(d.id==='a')throw new Error('terrain source support rejected');return()=>h.events.push('unbind:b');}});
  try{await h.director.load();const [a,b]=h.director.snapshot.full;assert.equal(a.ready,false);assert.equal(a.mounting,false);assert.match(a.error,/support rejected/);assert.equal(b.ready,true);assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.owners[0].group.parent,null);assert.deepEqual(h.events.slice(1,7),['load:a','mount:a','remove:a','dispose:a','load:b','mount:b']);}finally{await h.dispose();}
});

test('a hook resolving to no release callback cannot report ready and its full source is released',async()=>{
  const h=harness({mountFull:async()=>undefined});try{await h.director.load();assert.equal(h.director.snapshot.full[0].ready,false);assert.match(h.director.snapshot.full[0].error,/release callback/);assert.equal(h.owners[0].disposeCalls,1);}finally{await h.dispose();}
});

test('a late rejected mount after cancellation remains observable and releases its source once',async()=>{
  const started=deferred(),gate=deferred(),h=harness({mountFull(){started.resolve();return gate.promise;}});
  try{const loading=h.director.load();await started.promise;const closing=h.director.dispose();gate.reject(new Error('late mount failed'));await loading;await closing;assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.director.snapshot.full[0].ready,false);assert.match(h.director.snapshot.full[0].error,/late mount failed/);}finally{gate.reject(new Error('finished'));await h.dispose();}
});

test('a cleanup exception cannot stop removal, source disposal, other residents or layer disposal',async()=>{
  const h=harness({ids:['a','b'],layerError:'distance cleanup failed',mountFull(_resource,d,h){return()=>{h.events.push(`unbind:${d.id}`);if(d.id==='a')throw new Error('terrain unbind failed');};}});
  try{await h.director.load();await h.director.dispose();assert(h.owners.every(owner=>owner.disposeCalls===1&&owner.group.parent===null));assert.deepEqual(h.events.filter(event=>/unbind|remove|dispose/.test(event)),['unbind:a','remove:a','dispose:a','unbind:b','remove:b','dispose:b']);assert(h.director.snapshot.disposalErrors.some(error=>/terrain unbind/.test(error.error)));assert(h.director.snapshot.disposalErrors.some(error=>/distance cleanup/.test(error.error)));assert.equal(h.counts.layerDispose,1);}finally{await h.dispose();}
});

test('a cancelled full loader never calls mountFull on its late detached resource',async()=>{
  const started=deferred(),gate=deferred(),h=harness({loadFull(_d,_context,h){started.resolve();return gate.promise.then(()=>h.owner('late'));},mountFull(){throw new Error('must not mount late source');}});
  try{const loading=h.director.load();await started.promise;const closing=h.director.dispose();gate.resolve();await loading;await closing;assert.equal(h.counts.mounts,0);assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.owners[0].group.parent,null);}finally{gate.resolve();await h.dispose();}
});

test('bad world bounds are rejected before the optional mount receives any resource',async()=>{
  const h=harness({loadFull(_d,_context,h){const owner=h.owner('bad-bounds');owner.group.position.x=Infinity;return owner;},mountFull(){throw new Error('must not mount invalid world geometry');}});
  try{await h.director.load();assert.equal(h.counts.mounts,0);assert.equal(h.director.snapshot.full[0].ready,false);assert.match(h.director.snapshot.full[0].error,/bounds/);assert.equal(h.owners[0].disposeCalls,1);}finally{await h.dispose();}
});
