import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createArchitectureEnsemble} from '../src/yuanmingyuan/architecture-ensemble.js';
import {createPersistentEnsemble} from '../src/yuanmingyuan/persistent-ensemble.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const descriptors=[{id:'court',assetId:'fixture-court',position:[0,4,0],rotationY:0,scale:1},{id:'bridge',assetId:'fixture-bridge',position:[6,4,0],rotationY:0,scale:1}];
function asset(id){
  const group=new Group(),material=new MeshBasicMaterial(),geometries=[];let disposed=false;
  function box(x,y,z,w,h,d){const geometry=new BoxGeometry(w,h,d),mesh=new Mesh(geometry,material);geometries.push(geometry);mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  function ramp(z,x0=-2,x1=2,top=2){const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([x0,0,z-1,x1,top,z-1,x1,top,z+1,x0,0,z+1],3));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();geometries.push(geometry);group.add(new Mesh(geometry,material));}
  // Binary-exact floor dimensions keep literal-height assertions exact even
  // after Float32 vertex storage; all cross-owner comparisons are strict too.
  if(id==='court'){box(0,-.125,0,10,.25,10);box(-1.5,1.5,0,.4,3,.5);box(1.5,1.5,0,.4,3,.5);box(0,3.3,0,3.4,.3,.5);}
  else{ramp(0);ramp(-7,-2,0,3);box(0,-3.125,8,4,.25,4);box(1,1,-4,.2,2,.2);}
  const owner={group,archive:{id,glbSHA256:'a'.repeat(64)},calls:0,geometryDisposals:0,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;this.calls++;for(const geometry of geometries)geometry.dispose();material.dispose();}};
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>owner.geometryDisposals++);return owner;
}
function place(owner,d){for(const group of new Set([owner.group,owner.collisionGroup].filter(Boolean))){group.position.fromArray(d.position);group.rotation.y=d.rotationY;group.scale.setScalar(d.scale);group.updateMatrixWorld(true);}}
function pair(){const owners=descriptors.map(d=>asset(d.id)),surfaces=owners.map((owner,i)=>{place(owner,descriptors[i]);return createArchitectureSurface(owner.group);});return {owners,surfaces,records:surfaces.map((support,i)=>({descriptor:descriptors[i],owner:owners[i],support})),dispose(){surfaces.forEach(s=>s.dispose());owners.forEach(o=>o.dispose());}};}
const top=(surfaces,x,z,options)=>surfaces.map(s=>s.surfaceAt(x,z,options)).filter(Boolean).reduce((best,hit)=>!best||hit.height>best.height?hit:best,null);
function volume(x,y,z,rx=.2,ry=.5,rz=.2){return {bounds:{minX:x-rx,maxX:x+rx,minY:y-ry,maxY:y+ry,minZ:z-rz,maxZ:z+rz},planes:[[1,0,0,x+rx],[-1,0,0,-x+rx],[0,1,0,y+ry],[0,-1,0,-y+ry],[0,0,1,z+rz],[0,0,-1,-z+rz]]};}

test('two explicit descriptors load serially and publish actual placed owners/support only when both are ready',async()=>{
  const a=asset('court'),b=asset('bridge'),first=deferred(),second=deferred(),root=new Group(),calls=[];
  const ensemble=createPersistentEnsemble({root,descriptors,place,load:d=>{calls.push(d.id);return d.id==='court'?first.promise:second.promise;}});
  const ready=ensemble.prepare();assert.equal(ensemble.prepare(),ready);assert.deepEqual(calls,['court']);assert.equal(ensemble.get('court'),null);
  first.resolve(a);await tick();assert.deepEqual(calls,['court','bridge']);assert.equal(ensemble.group.visible,false);assert.equal(ensemble.get('court'),null);
  second.resolve(b);const records=await ready;assert.equal(records.length,2);assert.equal(ensemble.snapshot.ready,true);assert.equal(ensemble.group.visible,true);
  assert.equal(ensemble.get('court').owner,a);assert.equal(ensemble.get('bridge').owner.archive,b.archive);assert.equal(ensemble.get('bridge').support.diagnostics.source,'actual-static-mesh-triangles');
  assert.equal(ensemble.get('court').support.disposed,false);assert.equal(ensemble.support.surfaceAt(0,1,{maxY:4.1}).height,4);
  await ensemble.prepare();assert.equal(calls.length,2);ensemble.dispose();assert(a.disposed&&b.disposed);assert.equal(root.children.length,0);assert(ensemble.snapshot.records.every(r=>r.released&&r.supportDisposed));
});

test('leaving and returning through the controller returns real borrows without removing or decoding either model again',async()=>{
  const root=new Group(),owners=descriptors.map(d=>asset(d.id));let loads=0,unmounted=0;
  const ensemble=createPersistentEnsemble({root,descriptors,place,load:async d=>{loads++;return owners[descriptors.indexOf(d)];}});await ensemble.prepare();
  const controller=createMuseumSiteController({sites:descriptors,load:(d,options)=>ensemble.borrow(d.id,options),release:ensemble.release,mount:()=>()=>unmounted++});
  const a=await controller.select('court');assert.equal(a,owners[0]);await controller.select('bridge');assert.equal(a.group.parent,ensemble.group);assert.equal(a.disposed,false);
  assert.equal(await controller.select('court'),a);assert.equal(loads,2);controller.cancel();assert.equal(unmounted,3);assert.equal(ensemble.group.children.length,2);
  assert(ensemble.snapshot.records.every(r=>r.borrowers===0));assert.equal(ensemble.get('court').support.disposed,false);controller.dispose();ensemble.dispose();assert(owners.every(o=>o.calls===1));
});

test('visit abort cancels its wait without aborting shared preparation or leaking a borrow',async()=>{
  const gate=deferred(),visit=new AbortController(),signals=[],a=asset('court'),b=asset('bridge');
  const ensemble=createPersistentEnsemble({root:new Group(),descriptors,place,load:(d,{signal})=>{signals.push(signal);return d.id==='court'?gate.promise:b;}});
  const aborted=ensemble.borrow('court',{signal:visit.signal});visit.abort();await assert.rejects(aborted,{name:'AbortError'});assert.equal(signals[0].aborted,false);
  gate.resolve(a);const owner=await ensemble.borrow('bridge');assert.equal(owner,b);assert.equal(ensemble.snapshot.records.find(r=>r.id==='court').borrowers,0);ensemble.release(b);ensemble.dispose();
});

test('lifetime cancellation disposes the prepared first owner and a cancellation-ignoring late second owner once',async()=>{
  const gate=deferred(),lifetime=new AbortController(),a=asset('court'),b=asset('bridge'),root=new Group();let calls=0;
  const ensemble=createPersistentEnsemble({root,descriptors,place,signal:lifetime.signal,load:d=>{calls++;return d.id==='court'?a:gate.promise;}}),ready=ensemble.prepare();await tick();assert.equal(calls,2);
  lifetime.abort();assert.equal(a.calls,1);assert.equal(root.children.length,0);assert.equal(ensemble.snapshot.status,'disposed');gate.resolve(b);await assert.rejects(ready,{name:'AbortError'});
  assert.equal(b.calls,1);assert.equal(ensemble.get('bridge'),null);assert(ensemble.snapshot.records.every(r=>r.released));ensemble.dispose();assert.equal(b.calls,1);
});

test('second load failure rolls back the complete hidden group and cannot falsely become ready',async()=>{
  const a=asset('court'),root=new Group();let calls=0;const failure=new Error('second archive unavailable');
  const ensemble=createPersistentEnsemble({root,descriptors,place,load:d=>{calls++;if(d.id==='bridge')throw failure;return a;}});
  await assert.rejects(ensemble.prepare(),error=>error===failure);assert.equal(calls,2);assert.equal(a.calls,1);assert.equal(ensemble.support,null);assert.equal(ensemble.get('court'),null);assert.equal(root.children.length,0);
  assert.equal(ensemble.snapshot.status,'failed');await assert.rejects(ensemble.prepare(),error=>error===failure);assert.equal(calls,2);ensemble.dispose();
});

test('placement failure releases its acquired resource and never constructs the next asset',async()=>{
  const a=asset('court');let calls=0;const ensemble=createPersistentEnsemble({root:new Group(),descriptors,load:()=>{calls++;return a;},place:()=>{throw new Error('invalid placement');}});
  await assert.rejects(ensemble.prepare(),/invalid placement/);assert.equal(calls,1);assert.equal(a.calls,1);assert.equal(ensemble.snapshot.ready,false);ensemble.dispose();
});

test('aggregate heights preserve maxY, true slope normals, steep nonwalkable faces and a real lake bed below water',()=>{
  const f=pair(),ensemble=createArchitectureEnsemble(f.records);try{
    for(const [x,z]of[[0,1],[4.5,0],[5,0],[6,0],[8,0],[5,-7],[6,8],[100,100]])for(const maxY of [3.8,4.1,5,10,Infinity])
      assert.deepEqual(ensemble.surfaceAt(x,z,{maxY}),top(f.surfaces,x,z,{maxY}));
    const slope=ensemble.surfaceAt(4.5,0,{maxY:8});assert(slope.height>4.2&&slope.height<4.3);assert(slope.normal.x<0&&slope.normal.y>.8);assert.equal(slope.walkable,true);
    assert.equal(ensemble.surfaceAt(4.5,0,{maxY:4.1}).height,4);assert.equal(ensemble.surfaceAt(5,-7,{maxY:10}).walkable,false);assert.equal(ensemble.surfaceAt(6,8,{maxY:3.8}).height,1);
  }finally{ensemble.dispose();f.dispose();}
});

test('door opening stays clear and pillar/swept-column obstruction is the OR of real source triangle queries',()=>{
  const f=pair(),ensemble=createArchitectureEnsemble(f.records);try{
    for(const q of [{x:0,y:4,z:0,height:2.5},{x:1.4,y:4,z:0,height:2.5},{x:7,y:4,z:-4,height:2.5}])assert.equal(ensemble.capsuleBlocked(q),f.surfaces.some(s=>s.capsuleBlocked(q)));
    assert.equal(ensemble.capsuleBlocked({x:0,y:4,z:0,height:2.5}),false);assert.equal(ensemble.capsuleBlocked({x:1.4,y:4,z:0,height:2.5}),true);
    assert.equal(ensemble.intersectsGuideVolume(volume(0,5.4,0,.5,1,.15)),false);assert.equal(ensemble.intersectsGuideVolume(volume(1.4,5.4,0)),true);assert.equal(ensemble.intersectsGuideVolume(volume(7,5,-4)),true);
  }finally{ensemble.dispose();f.dispose();}
});

test('grouped local guide support matches original local queries; disposing it cannot release parent surfaces or geometry',()=>{
  const f=pair(),ensemble=createArchitectureEnsemble(f.records),bounds={minX:-3,maxX:9,minZ:-9,maxZ:10},options={maxY:6,minY:-2,cellSize:.5};
  const expected=f.surfaces.map(s=>s.createGuideSupport(bounds,options)),local=ensemble.createGuideSupport(bounds,options);try{
    for(const [x,z]of[[0,1],[4.5,0],[5,0],[6,8],[5,-7],[30,30]])for(const maxY of [3.8,4.1,6,Infinity])assert.deepEqual(local.surfaceAt(x,z,{maxY}),top(expected,x,z,{maxY}));
    assert.equal(local.snapshot().groups.length,2);local.dispose();assert.equal(local.surfaceAt(0,1),null);assert(f.surfaces.every(s=>!s.disposed));assert(f.owners.every(o=>o.geometryDisposals===0));
    assert.equal(ensemble.surfaceAt(0,1,{maxY:4.1}).height,4);const other=ensemble.createGuideSupport(bounds,options);ensemble.dispose();assert.equal(other.surfaceAt(0,1),null);assert(f.surfaces.every(s=>!s.disposed));
  }finally{local.dispose();expected.forEach(s=>s.dispose());ensemble.dispose();f.dispose();}
});

test('local preparation/cleanup failures release sibling local queries but never their parent surfaces',()=>{
  const f=pair(),ensemble=createArchitectureEnsemble(f.records),bounds={minX:-2,maxX:2,minZ:-2,maxZ:2};
  const original=f.surfaces[1].createGuideSupport;f.surfaces[1].createGuideSupport=()=>{throw new Error('second local failed');};
  assert.throws(()=>ensemble.createGuideSupport(bounds),/second local failed/);assert.equal(f.surfaces[0].diagnostics.localGuideSupports,0);
  f.surfaces[1].createGuideSupport=original;const first=f.surfaces[0].createGuideSupport;
  f.surfaces[0].createGuideSupport=(...args)=>{const local=first(...args),dispose=local.dispose;local.dispose=()=>{dispose();throw new Error('local cleanup failed');};return local;};
  const local=ensemble.createGuideSupport(bounds);assert.throws(()=>local.dispose(),AggregateError);assert(f.surfaces.every(s=>s.diagnostics.localGuideSupports===0&&!s.disposed));ensemble.dispose();f.dispose();
});

test('unexpected parent disposal fails closed without exposing a lower fallback as verified support',()=>{
  const f=pair(),ensemble=createArchitectureEnsemble(f.records),local=ensemble.createGuideSupport({minX:-2,maxX:2,minZ:-2,maxZ:2});f.surfaces[1].dispose();
  assert.equal(ensemble.surfaceAt(0,1,{maxY:5}),null);assert.equal(local.surfaceAt(0,1),null);assert.equal(ensemble.capsuleBlocked({x:0,y:4,z:0}),true);assert.equal(ensemble.intersectsGuideVolume(volume(0,5,0)),true);
  ensemble.dispose();f.dispose();
});

test('transformed separate collision root is retained as the real source support with original archive identity',async()=>{
  const owner=asset('bridge');owner.collisionGroup=owner.group;owner.group=owner.collisionGroup.clone(true);const d={...descriptors[1],rotationY:.63,scale:1.4};
  const ensemble=createPersistentEnsemble({root:new Group(),descriptors:[d],load:async()=>owner,place});await ensemble.prepare();const record=ensemble.get(d.id),point=new Vector3(0,1,0).applyMatrix4(owner.collisionGroup.matrixWorld);
  assert.equal(record.owner,owner);assert.equal(record.owner.archive,owner.archive);assert.equal(record.support.diagnostics.source,'actual-static-mesh-triangles');assert(Math.abs(record.support.surfaceAt(point.x,point.z,{maxY:10}).height-point.y)<1e-6);
  assert.equal('nativeApproved'in record,false);assert.equal('supportReady'in record,false);ensemble.dispose();assert.equal(record.support.disposed,true);
});

test('a render/source world-transform mismatch fails preparation instead of registering fictional support',async()=>{
  const owner=asset('court');owner.collisionGroup=owner.group.clone(true);const ensemble=createPersistentEnsemble({root:new Group(),descriptors:[descriptors[0]],load:()=>owner,place:(o,d)=>{o.group.position.fromArray(d.position);}});
  await assert.rejects(ensemble.prepare(),/share the placed world transform/);assert.equal(owner.calls,1);assert.equal(ensemble.support,null);ensemble.dispose();
});

test('one throwing owner disposer cannot leak the other owner, aggregate locals, or parent attachment',async()=>{
  const root=new Group(),a=asset('court'),b=asset('bridge'),old=a.dispose;a.dispose=function(){old.call(this);throw new Error('first owner cleanup failed');};
  const ensemble=createPersistentEnsemble({root,descriptors,place,load:d=>d.id==='court'?a:b});await ensemble.prepare();const records=descriptors.map(d=>ensemble.get(d.id)),local=ensemble.support.createGuideSupport({minX:-2,maxX:8,minZ:-2,maxZ:2});
  assert.throws(()=>ensemble.dispose(),AggregateError);assert(a.disposed&&b.disposed);assert.equal(b.calls,1);assert.equal(root.children.length,0);assert(records.every(r=>r.support.disposed));assert.equal(local.surfaceAt(0,1),null);assert(ensemble.snapshot.errors.some(e=>/first owner/.test(e.message)));ensemble.dispose();
});

test('pre-abort and duplicate descriptors do no loading; duplicate source owner is disposed only once',async()=>{
  const lifetime=new AbortController();lifetime.abort();let calls=0;
  const stopped=createPersistentEnsemble({root:new Group(),descriptors,place,signal:lifetime.signal,load:()=>{calls++;}});await assert.rejects(stopped.prepare(),{name:'AbortError'});assert.equal(calls,0);
  assert.throws(()=>createPersistentEnsemble({root:new Group(),descriptors:[descriptors[0],descriptors[0]],place,load:()=>{calls++;}}),/unique descriptors/);
  const owner=asset('court'),duplicate=createPersistentEnsemble({root:new Group(),descriptors,place,load:()=>owner});await assert.rejects(duplicate.prepare(),/distinct owner/);assert.equal(owner.calls,1);duplicate.dispose();
});

test('an empty source cannot publish a ready ensemble merely because a support object was constructed',async()=>{
  const owner=asset('court');owner.group.clear();const ensemble=createPersistentEnsemble({root:new Group(),descriptors:[descriptors[0]],place,load:()=>owner});
  await assert.rejects(ensemble.prepare(),/no actual source triangle primitives/);assert.equal(ensemble.get('court'),null);assert.equal(owner.calls,1);assert.equal(ensemble.snapshot.ready,false);ensemble.dispose();
});

test('lifetime release closes grouped local queries before source support and render-owner disposal',async()=>{
  const events=[],owners=descriptors.map(d=>asset(d.id)),lifetime=new AbortController();
  const ensemble=createPersistentEnsemble({root:new Group(),descriptors,place,signal:lifetime.signal,load:d=>owners[descriptors.indexOf(d)]});await ensemble.prepare();
  for(const d of descriptors){const record=ensemble.get(d.id),source=record.support,create=source.createGuideSupport,dispose=source.dispose,ownerDispose=record.owner.dispose;
    source.createGuideSupport=(...args)=>{const local=create(...args),close=local.dispose;local.dispose=()=>{events.push('local-'+d.id);close();};return local;};
    source.dispose=()=>{events.push('source-'+d.id);dispose();};record.owner.dispose=function(){events.push('owner-'+d.id);ownerDispose.call(this);};
  }
  ensemble.support.createGuideSupport({minX:-2,maxX:8,minZ:-2,maxZ:2});lifetime.abort();
  assert.deepEqual(events,['local-court','local-bridge','source-court','owner-court','source-bridge','owner-bridge']);assert(owners.every(owner=>owner.calls===1));
});
