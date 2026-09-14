import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';

// Synthetic, bound metadata and tiny real Three geometry. The actual distance
// layer performs approval checks and .4/.5 selection; no production manifest,
// archive decoder, complete asset factory or renderer is invoked.
const baseURL='https://resident.test/world/',hash=value=>createHash('sha256').update(value).digest('hex'),bytes=value=>Buffer.from(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(id='temple'){
  const source={id,sourceDigest:'c'.repeat(64),transport:{sourceManifestSHA256:'b'.repeat(64)},verification:{exactRoundtripPassed:true,simplified:false,quantized:false}};
  const report={schema:1,kind:'yuanmingyuan-building-distance',id,sourceArchiveDigest:source.sourceDigest,sourceRootWorldMatrix:new THREE.Matrix4().toArray(),fullArchiveRetained:true,texturePixelsUnchanged:true,originalInstances:1,representedInstances:1,requestedMaximumErrorWorld:.05,maximumErrorArchiveWorld:.04,boundsArchiveWorld:{min:[-1,-1,-1],max:[1,1,1]},provenance:{sourceManifestSHA256:source.transport.sourceManifestSHA256}};
  const manifest={kind:'yuanmingyuan-building-distance-pilot',id:id+'-distance',distance:{report,sha256:hash(bytes(report))},glb:{url:'tiny.glb',sha256:'d'.repeat(64)},runtime:{url:'tiny.runtime.json',sha256:'e'.repeat(64)}};
  const sourceBytes=bytes(source),distanceBytes=bytes(manifest),descriptor={id,assetId:id,site:{id,position:[0,0,0],scale:1,rotationY:0},source:{manifestURL:`/full/${id}.json`,approvedManifestSHA256:hash(sourceBytes)},manifestURL:`/distance/${id}.json`,expectedManifestSHA256:hash(distanceBytes),approvedDistanceSHA256:hash(distanceBytes)};
  return {id,report,manifest,descriptor,entries:new Map([[new URL(descriptor.source.manifestURL,baseURL).href,sourceBytes],[new URL(descriptor.manifestURL,baseURL).href,distanceBytes]])};
}

function fullOwner(name,{size=[2,2,2],position=[0,0,0],disposeError=null,empty=false}={}){
  const group=new THREE.Group();group.name=name;group.position.fromArray(position);
  const geometry=empty?null:new THREE.BoxGeometry(...size),material=empty?null:new THREE.MeshStandardMaterial({color:'#cabf9f'});
  if(geometry)group.add(new THREE.Mesh(geometry,material));
  return {group,disposeCalls:0,updates:[],dispose(){this.disposeCalls++;geometry?.dispose();material?.dispose();group.clear();if(disposeError)throw new Error(disposeError);},update(time){this.updates.push(time);}};
}

function distanceOwner(f,options){
  const owner=fullOwner('distance-'+f.id,options);
  return Object.assign(owner,{distance:{report:f.report,reportSHA256:f.manifest.distance.sha256,manifestSHA256:f.descriptor.expectedManifestSHA256},evaluate({camera}){const pixels=camera.userData.errorPixels;return {eligible:pixels<=.5,nativeApproved:true,manifestSHA256:this.distance.manifestSHA256,projectedErrorPhysicalPixels:pixels,nearestSourceDepth:100,reason:'controlled-real-layer-fixture'};}});
}

function view(pixels,{distance=1000,additional=[]}={}){
  const camera=new THREE.PerspectiveCamera(40,2435/2200,1,4000);camera.position.set(0,8,distance);camera.lookAt(0,0,0);camera.userData.errorPixels=pixels;
  return {camera,renderer:{getDrawingBufferSize:value=>value.set(2435,2200)},additionalViews:additional.map((p,i)=>{const extra=camera.clone();extra.userData.errorPixels=p;return {id:'additional-'+i,camera:extra,physicalWidth:1024,physicalHeight:512};})};
}

function visibleUnder(group,root){
  if(!group?.isObject3D)return false;
  let cursor=group;while(cursor){if(!cursor.visible)return false;if(cursor===root)return true;cursor=cursor.parent;}return false;
}

function harness({fixtures=[fixture()],root=new THREE.Group(),siteController=null,loadFull,loadDistance,signal,...options}={}){
  const entries=new Map(fixtures.flatMap(f=>[...f.entries])),distance=fixtures.map(f=>distanceOwner(f)),full=fixtures.map(f=>fullOwner('resident-'+f.id));
  const counts={fetch:0,distance:0,full:0},events=[];
  const director=createMuseumResidentBuildings({
    root,descriptors:fixtures.map(f=>f.descriptor),siteController,signal,baseURL,...options,
    fetchImpl:async(url,{signal}={})=>{signal?.throwIfAborted();counts.fetch++;const body=entries.get(url);return body?new Response(body):new Response('',{status:404});},
    loadDistance:async(entry,context)=>{const index=fixtures.findIndex(f=>f.descriptor.manifestURL===new URL(entry.manifestURL).pathname);counts.distance++;events.push('distance:'+fixtures[index].id);return loadDistance?loadDistance(fixtures[index],context,distance[index]):distance[index];},
    loadFull:async(descriptor,context)=>{const index=fixtures.findIndex(f=>f.id===descriptor.id);counts.full++;events.push('full:'+descriptor.id);return loadFull?loadFull(descriptor,context,full[index]):full[index];},
  });
  return {root,fixtures,director,full,distance,counts,events,draw(pixels,options){const state=director.evaluate(view(pixels,options));return {state,visible:fixtures.map((f,i)=>({id:f.id,resident:visibleUnder(full[i].group,root),distance:visibleUnder(distance[i].group,root),primary:siteController?.snapshot.siteId===f.id&&visibleUnder(siteController.resource?.group,root)}))};},async dispose(){await director.dispose();for(const owner of [...full,...distance])if(owner.disposeCalls===0)try{owner.dispose();}catch{}}};
}

function exactlyOne(draw,id='temple',expected){
  const site=draw.visible.find(s=>s.id===id),visible=['resident','distance','primary'].filter(name=>site[name]);assert.deepEqual(visible,[expected],`one physical owner after each evaluate/render boundary for ${id}`);
  const record=draw.state.distance.sites.find(s=>s.id===id);assert.equal(record.duplicateFullOwners,false);assert.equal(record.coverage,expected==='distance'?'distance':'full');
}

test('distance and full loaders coalesce and run serially before residents are ready',async t=>{
  const a=fixture('a'),b=fixture('b'),distanceGate=deferred(),distanceStarted=deferred(),fullGate=deferred(),fullStarted=deferred();
  const h=harness({fixtures:[a,b],loadDistance:async(f,_context,owner)=>{if(f.id==='a'){distanceStarted.resolve();await distanceGate.promise;}return owner;},loadFull:async(d,_context,owner)=>{if(d.id==='a'){fullStarted.resolve();await fullGate.promise;}return owner;}});t.after(()=>{distanceGate.resolve();fullGate.resolve();return h.dispose();});
  const first=h.director.load();assert.equal(h.director.load(),first);await distanceStarted.promise;assert.deepEqual(h.events,['distance:a']);assert.equal(h.counts.full,0);
  distanceGate.resolve();await fullStarted.promise;assert.deepEqual(h.events,['distance:a','distance:b','full:a']);assert.equal(h.director.snapshot.full.some(record=>record.ready),false);
  fullGate.resolve();await first;assert.deepEqual(h.events,['distance:a','distance:b','full:a','full:b']);assert.equal(h.director.snapshot.full.every(record=>record.ready),true);assert.equal(h.director.snapshot.loading,false);
  await h.director.load();assert.equal(h.counts.distance,2);assert.equal(h.counts.full,2);
});

test('camera jumps and .4/.5 hysteresis select exactly one already loaded representation without another decode',async t=>{
  const h=harness();t.after(()=>h.dispose());await h.director.load();
  for(const [pixels,expected] of [[.2,'distance'],[.41,'distance'],[.5,'distance'],[.50001,'resident'],[.49,'resident'],[.40001,'resident'],[.4,'distance'],[.8,'resident'],[.2,'distance']])exactlyOne(h.draw(pixels,{distance:expected==='resident'?75:1000}), 'temple',expected);
  assert.deepEqual(h.counts,{fetch:2,distance:1,full:1});
  h.director.update(123);assert.deepEqual(h.full[0].updates,[123]);assert.deepEqual(h.distance[0].updates,[123]);
});

test('all supplied views can require the warm full source and must pass entry before releasing it',async t=>{
  const h=harness();t.after(()=>h.dispose());await h.director.load();
  exactlyOne(h.draw(.2),'temple','distance');exactlyOne(h.draw(.2,{additional:[.6]}),'temple','resident');
  exactlyOne(h.draw(.2,{additional:[.41]}),'temple','resident');exactlyOne(h.draw(.2,{additional:[.4]}),'temple','distance');assert.equal(h.counts.full,1);
});

test('real site-controller loading, ready takeover and retirement never draw two full owners or await another fallback',async t=>{
  const root=new THREE.Group(),gateA=deferred(),gateB=deferred(),primaryA=fullOwner('primary-temple'),primaryB=fullOwner('primary-other');
  const controller=createMuseumSiteController({sites:[{id:'temple'},{id:'other'}],load:site=>site.id==='temple'?gateA.promise:gateB.promise,mount:owner=>{root.add(owner.group);}});
  const h=harness({root,siteController:controller});t.after(async()=>{gateA.resolve(primaryA);gateB.resolve(primaryB);controller.dispose();await h.dispose();if(primaryA.disposeCalls===0)primaryA.dispose();if(primaryB.disposeCalls===0)primaryB.dispose();});await h.director.load();
  exactlyOne(h.draw(.7),'temple','resident');const visiting=controller.select('temple');exactlyOne(h.draw(.7),'temple','resident');gateA.resolve(primaryA);await visiting;
  exactlyOne(h.draw(.7),'temple','primary');exactlyOne(h.draw(.2),'temple','primary');assert.equal(h.full[0].disposeCalls,0);
  const leaving=controller.select('other');assert.equal(primaryA.disposeCalls,1);exactlyOne(h.draw(.7),'temple','resident');exactlyOne(h.draw(.2),'temple','distance');gateB.resolve(primaryB);await leaving;
  assert.equal(h.counts.full,1);assert.equal(h.counts.distance,1);await h.director.dispose();assert.equal(primaryB.disposeCalls,0);assert.equal(primaryB.group.parent,root,'independent primary owner remains owned by its controller');
});

test('primary requires a ready, visible resource mounted beneath the director root',async t=>{
  const root=new THREE.Group(),hidden=new THREE.Group(),primary=fullOwner('primary'),controller={snapshot:{status:'ready',siteId:'temple'},resource:primary};root.add(hidden);hidden.visible=false;
  const h=harness({root,siteController:controller});t.after(async()=>{await h.dispose();primary.dispose();});await h.director.load();
  exactlyOne(h.draw(.7),'temple','resident');hidden.add(primary.group);exactlyOne(h.draw(.7),'temple','resident');hidden.visible=true;exactlyOne(h.draw(.7),'temple','primary');primary.group.visible=false;exactlyOne(h.draw(.7),'temple','resident');
});

test('primary that becomes ready before a late resident load finishes keeps sole full ownership',async t=>{
  const root=new THREE.Group(),gate=deferred(),started=deferred(),primary=fullOwner('primary-first');
  const controller=createMuseumSiteController({sites:[{id:'temple'}],load:async()=>primary,mount:owner=>{root.add(owner.group);}});
  const h=harness({root,siteController:controller,loadFull:async(_descriptor,_context,owner)=>{started.resolve();await gate.promise;return owner;}});
  t.after(async()=>{gate.resolve();controller.dispose();await h.dispose();if(primary.disposeCalls===0)primary.dispose();});
  const pending=h.director.load();await started.promise;await controller.select('temple');exactlyOne(h.draw(.8),'temple','primary');gate.resolve();await pending;
  exactlyOne(h.draw(.8),'temple','primary');assert.equal(h.director.snapshot.full[0].ready,true);assert.equal(h.director.snapshot.full[0].visible,false);
  controller.cancel();exactlyOne(h.draw(.8),'temple','resident');assert.equal(h.counts.full,1);
});

test('full-load errors remain not ready, retain far coverage, and only explicit reload retries the failed owner',async t=>{
  let fail=true;const h=harness({loadFull:async(_d,_context,owner)=>{if(fail)throw new Error('full decoder rejected SHA');return owner;}});t.after(()=>h.dispose());await h.director.load();
  assert.equal(h.director.snapshot.full[0].ready,false);assert.match(h.director.snapshot.full[0].error,/rejected SHA/);exactlyOne(h.draw(.2),'temple','distance');
  const near=h.draw(.7);assert.equal(near.state.distance.sites[0].coverage,'coverage-gap');assert.equal(near.state.full[0].ready,false);assert.equal(near.visible[0].resident,false);assert.equal(h.counts.full,1);
  fail=false;await h.director.load();exactlyOne(h.draw(.7),'temple','resident');assert.equal(h.counts.full,2);assert.equal(h.counts.distance,1);assert.equal(h.director.snapshot.full[0].error,null);
});

test('lifetime abort while distance is decoding prevents any full load and releases the late distance owner',async()=>{
  const gate=deferred(),started=deferred(),lifetime=new AbortController();let received;
  const h=harness({signal:lifetime.signal,loadDistance:async(_f,{signal},owner)=>{received=signal;started.resolve();await gate.promise;return owner;}});
  try{const pending=h.director.load();await started.promise;lifetime.abort();assert.equal(received.aborted,true);gate.resolve();await pending;assert.equal(h.counts.full,0);assert.equal(h.distance[0].disposeCalls,1);assert.equal(h.distance[0].group.parent,null);assert.equal(h.director.snapshot.disposed,true);assert.equal(h.director.snapshot.loading,false);}finally{gate.resolve();await h.dispose();}
});

test('a pre-aborted lifetime never requests or mounts source resources',async()=>{
  const lifetime=new AbortController(),root=new THREE.Group(),unrelated=new THREE.Group();root.add(unrelated);lifetime.abort();
  const h=harness({root,signal:lifetime.signal});
  try{await h.director.load();assert.deepEqual(h.counts,{fetch:0,distance:0,full:0});assert.equal(h.director.snapshot.disposed,true);assert.deepEqual(root.children,[unrelated]);assert.equal(h.director.nearest(new THREE.Vector3()),null);}finally{await h.dispose();}
});

test('late full results after cancellation stay detached and are disposed once, even when disposal itself throws',async()=>{
  for(const throwing of [false,true]){
    const gate=deferred(),started=deferred(),late=fullOwner('late-full',{disposeError:throwing?'late disposer failed':null});let received;
    const h=harness({loadFull:async(_d,{signal})=>{received=signal;started.resolve();return gate.promise;}});
    try{const pending=h.director.load();await started.promise;h.director.dispose();assert.equal(received.aborted,true);gate.resolve(late);await pending;assert.equal(late.group.parent,null);assert.equal(h.director.snapshot.full[0].ready,false);assert.equal(late.disposeCalls,1,'late owner is consumed before invoking its fallible disposer');if(throwing)assert.ok(h.director.snapshot.disposalErrors.some(record=>/late disposer failed/.test(record.error)));}
    finally{gate.resolve(late);await h.dispose();if(late.disposeCalls===0)try{late.dispose();}catch{}}
  }
});

test('dispose completion includes a cancelled full loader that finishes late',async()=>{
  const gate=deferred(),started=deferred(),late=fullOwner('late-owned-full');
  const h=harness({loadFull:async()=>{started.resolve();return gate.promise;}});const pending=h.director.load();await started.promise;
  let ended=false;const ending=Promise.resolve(h.director.dispose()).then(()=>{ended=true;});
  try{await flush();assert.equal(ended,false,'callers must be able to wait before allocating a replacement heavy owner');gate.resolve(late);await pending;await ending;assert.equal(late.disposeCalls,1);}finally{gate.resolve(late);await pending;await h.dispose();}
});

test('failure of one owner disposer does not leak other residents, distance owners or unrelated scene ownership',async()=>{
  const root=new THREE.Group(),unrelated=fullOwner('unrelated'),a=fullOwner('full-a',{disposeError:'full a dispose failed'}),b=fullOwner('full-b');root.add(unrelated.group);
  const h=harness({root,fixtures:[fixture('a'),fixture('b')],loadFull:async descriptor=>descriptor.id==='a'?a:b});await h.director.load();
  try{await h.director.dispose();await h.director.dispose();assert.equal(a.disposeCalls,1);assert.equal(b.disposeCalls,1);assert.equal(h.distance[0].disposeCalls,1);assert.equal(h.distance[1].disposeCalls,1);assert.ok(h.director.snapshot.disposalErrors.some(r=>r.id==='a'&&/dispose failed/.test(r.error)));assert.deepEqual(root.children,[unrelated.group]);assert.equal(unrelated.disposeCalls,0);}finally{await h.dispose();unrelated.dispose();}
});

test('an empty full scene cannot falsely retire a working distance owner as ready',async()=>{
  const empty=fullOwner('empty-decoder-result',{empty:true}),h=harness({loadFull:async()=>empty});
  try{await h.director.load();assert.equal(h.director.snapshot.full[0].ready,false);assert.ok(h.director.snapshot.full[0].error);assert.equal(empty.disposeCalls,1);exactlyOne(h.draw(.2),'temple','distance');assert.equal(h.draw(.7).state.distance.sites[0].coverage,'coverage-gap');}finally{await h.dispose();}
});

test('nearest uses the building boundary before its centre and compares every ready resident',async t=>{
  const a=fullOwner('long-court',{size:[200,8,20],position:[100,4,0]}),b=fullOwner('small-court',{size:[10,8,10],position:[270,4,0]});
  const h=harness({fixtures:[fixture('a'),fixture('b')],loadFull:async d=>d.id==='a'?a:b});t.after(()=>h.dispose());await h.director.load();
  const point=new THREE.Vector3(215,999,0),candidate=h.director.nearest(point);assert.equal(candidate.site.id,'a');assert.equal(candidate.distance,15);assert.ok(point.clone().setY(4).distanceTo(new THREE.Vector3(100,4,0))>75);
  assert.equal(h.director.nearest(new THREE.Vector3(275,4,0)).site.id,'b');assert.equal(h.director.nearest(new THREE.Vector3(400,0,0)),null);
});

test('nearest bounds include the actual parent world transform after the source is mounted',async t=>{
  const root=new THREE.Group();root.position.set(200,0,50);root.scale.setScalar(2);
  const owner=fullOwner('transformed-court',{size:[100,8,20],position:[100,4,0]}),h=harness({root,loadFull:async()=>owner});t.after(()=>h.dispose());await h.director.load();root.updateMatrixWorld(true);
  const actual=new THREE.Box3().setFromObject(owner.group),point=new THREE.Vector3(actual.max.x+24,0,actual.getCenter(new THREE.Vector3()).z),candidate=h.director.nearest(point);
  assert.ok(candidate,'the actual world bounding box is within the preparation radius');assert.equal(candidate.distance,24);assert.deepEqual(h.director.snapshot.full[0].bounds,{min:actual.min.toArray(),max:actual.max.toArray()});
});

test('a borrowed source formerly hidden by distance stays the sole physical primary across far/near evaluation',async t=>{
  const root=new THREE.Group();let h;
  const controller=createMuseumSiteController({sites:[{id:'temple'}],load:(site,options)=>h.director.borrow(site.id,options),release:owner=>h.director.release(owner),mount:owner=>{assert.equal(owner.group.parent,root);return()=>{};}});
  h=harness({root,siteController:controller});t.after(async()=>{controller.dispose();await h.dispose();});await h.director.load();
  exactlyOne(h.draw(.2),'temple','distance');const resident=h.full[0];assert.equal(resident.group.visible,false);
  assert.equal(await controller.select('temple'),resident);
  for(const pixels of [.2,.8,.3,.7,.2]){
    const draw=h.draw(pixels),state=draw.state.distance.sites[0];assert.equal(resident.group.visible,true);assert.equal(visibleUnder(h.distance[0].group,root),false);
    assert.equal(state.fullMountCount,1);assert.equal(state.duplicateFullOwners,false);assert.equal(state.coverage,'full');assert.equal(h.director.snapshot.borrowers,1);
    assert.equal(controller.resource,h.director.get('temple').owner);
  }
  controller.cancel();exactlyOne(h.draw(.2),'temple','distance');exactlyOne(h.draw(.8),'temple','resident');assert.equal(h.director.snapshot.borrowers,0);assert.deepEqual(h.counts,{fetch:2,distance:1,full:1});assert.equal(resident.disposeCalls,0);
});
