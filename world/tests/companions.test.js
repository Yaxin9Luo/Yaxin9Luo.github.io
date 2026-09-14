import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {Group,Raycaster,Vector3} from 'three';
import {createCompanionSystem} from '../src/companion-system.js';
import {companionAssetDiagnostics,createCompanionActor} from '../src/companion-assets.js';
import {loadAcceptedCompanions,exactBounds,solidBox} from './helpers/companion-runtime.js';

before(loadAcceptedCompanions);
test('outgoing real walk swing retains foot contact timing through the existing idle crossfade',()=>{
  const actor=createCompanionActor('sadaharu'),getSupportHeight=()=>6.171;actor.group.position.y=6.171;
  try{
    actor.setAction('walk');actor.seek(.83);actor.update(0,{getSupportHeight});assert.equal(actor.footStates.get('HindSoleL').planted,false);
    actor.setAction('idle');actor.update(0,{getSupportHeight});const transition=actor.footStates.get('HindSoleL');assert.equal(transition.planted,false,'a visibly raised outgoing paw is still in swing');assert.equal(transition.correction,0);
    for(let i=0;i<8;i++){actor.update(.025,{getSupportHeight});for(const foot of actor.footStates.values())if(foot.planted)assert.ok(Math.abs(foot.position.y+foot.correction-6.189)<1e-5);}
    assert.ok([...actor.footStates.values()].every(foot=>foot.planted));
  }finally{actor.dispose();}
});
test('seeking or a stable reduced pose clears outgoing walk contact ownership',()=>{
  for(const mode of ['seek','reduced']){
    const actor=createCompanionActor('sadaharu'),getSupportHeight=()=>6.171;actor.group.position.y=6.171;
    try{
      actor.setAction('walk');actor.seek(.83);actor.update(0,{getSupportHeight});actor.setAction('idle');actor.update(.01,{getSupportHeight});assert.equal(actor.footStates.get('HindSoleL').planted,false);
      if(mode==='seek')actor.seek(0);actor.update(0,{getSupportHeight,reducedMotion:mode==='reduced'});
      assert.ok([...actor.footStates.values()].every(foot=>foot.planted));for(const foot of actor.footStates.values())assert.ok(Math.abs(foot.position.y+foot.correction-6.189)<1e-5);
      actor.update(.2,{getSupportHeight});assert.ok([...actor.footStates.values()].every(foot=>foot.planted),'no old swing ownership returns after the stable pose');
    }finally{actor.dispose();}
  }
});
test('actual skinned descendant rays follow non-origin parents, movement and changed poses before any render',()=>{
  const parent=new Group(),actor=createCompanionActor('elizabeth');parent.position.set(17,3,-24);parent.rotation.y=.4;parent.add(actor.group);
  try{
    for(const position of [new Vector3(-13.95,6,44),new Vector3(8,9,-11)]){
      actor.group.position.copy(position);actor.group.rotation.y+=.35;actor.setAction('walk');actor.seek(.2);actor.update(0);
      const target=actor.group.localToWorld(new Vector3(0,1.5,0)),origin=actor.group.localToWorld(new Vector3(0,1.5,7));
      const meshes=[];actor.model.traverse(object=>{if(object.isMesh)meshes.push(object);});
      const hits=new Raycaster(origin,target.clone().sub(origin).normalize()).intersectObjects(meshes,false);assert.ok(hits.some(hit=>hit.object.name==='ContinuousShell'));
      const mesh=actor.model.getObjectByName('ContinuousShell');mesh.computeBoundingBox();assert.ok(mesh.boundingBox&&mesh.boundingSphere);
      actor.setAction('sign');actor.seek(.4);actor.update(0);assert.equal(mesh.boundingBox,null);assert.equal(mesh.boundingSphere,null,'instance ray bounds are invalidated without reskinning vertices on each simulation step');
      assert.ok(new Raycaster(origin,target.clone().sub(origin).normalize()).intersectObjects(meshes,false).length);
      const bounds=exactBounds(actor.group),worldRoot=actor.group.getWorldPosition(new Vector3());assert.ok(Math.abs(bounds.min.y-worldRoot.y)<.12);assert.ok(bounds.max.y-worldRoot.y<3.4);
    }
  }finally{actor.dispose();}
});
const places=[{kind:'elizabeth',position:{x:0,z:0},heading:0,waypoints:[{x:0,z:7},{x:-5,z:7}]},
  {kind:'sadaharu',position:{x:11,z:0},heading:0,waypoints:[{x:11,z:7},{x:17,z:5}]}];
function create(extra={}){
  const root=new Group(),system=createCompanionSystem({root,heightAt:()=>1,waterLevel:0,colliders:[],placements:places,seed:93,...extra});
  assert.ok(system,'accepted-actor controller is created');return {root,system};
}
const state=(s,id='elizabeth')=>s.snapshot().actors.find(a=>a.id===id);
function advance(s,seconds,fps=60,context={}){for(let i=0;i<Math.round(seconds*fps);i++)s.update(1/fps,{playerPosition:{x:0,y:1,z:5},...context});}

test('actual full actors attach once, expose descendant picks and preserve independent instance resources',()=>{
  const before=companionAssetDiagnostics().liveActors,{root,system}=create(),other=create();
  try{
    assert.equal(root.children.length,2);assert.equal(system.pickMeshes.length,42);
    for(const mesh of system.pickMeshes)assert.ok(['elizabeth','sadaharu'].includes(system.idForObject(mesh)));
    const b=exactBounds(root.children[0]);assert.ok(b.max.y-b.min.y>2.95);
    assert.ok(b.max.x-b.min.x>1.96);assert.equal(state(system).valid,true);
    assert.ok(system.pickMeshes.some(m=>m.userData.companionId==='sadaharu'&&m.material.normalMap?.image.width>0),'real embedded coat texture decodes');
    const shared=system.pickMeshes.find(m=>m.name==='ContinuousShell').geometry;
    let disposed=0;shared.addEventListener('dispose',()=>disposed++);
    system.dispose();system.dispose();
    assert.equal(root.children.length,0);assert.equal(system.pickMeshes.length,0);assert.equal(disposed,0);
    assert.equal(companionAssetDiagnostics().liveActors,before+2);
    advance(other.system,.5);assert.equal(other.system.snapshot().disposed,false);
  }finally{system.dispose();other.system.dispose();}
  assert.equal(companionAssetDiagnostics().liveActors,before);
});

test('seeded roaming and foley agree across 8, 30 and 60 FPS on actual actors',()=>{
  const results=[];
  for(const fps of [8,30,60]){
    const events=[],{system}=create({onSound:e=>events.push(e)});
    try{advance(system,18,fps);const s=system.snapshot();
      assert.ok(s.actors.every(a=>a.distance>1),'both actors actually roam');
      results.push({time:s.activeTime,actors:s.actors,events:events.map(({owner,...event})=>event)});
    }finally{system.dispose();}
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});

test('real planted soles stay on mild live support, while gait uses accepted distance',()=>{
  const heightAt=(_x,z)=>1+.008*z,{system}=create({heightAt,placements:[{...places[0],waypoints:[{x:-5,z:7}]},places[1]]});
  try{
    let walking=0,turning=0;
    for(let i=0;i<650;i++){
      const previous=state(system);system.update(1/60);const s=state(system);
      if(s.state==='walk'&&previous.state==='walk'){
        walking++;const d=s.distance-previous.distance;
        const phaseDelta=((s.clipTime-previous.clipTime)%1.2+1.2)%1.2;
        assert.ok(Math.abs(phaseDelta-d/.64*1.2)<1e-5);
        for(const foot of s.feet.filter(f=>f.planted))assert.ok(Math.abs(foot.position.y+foot.correction-heightAt(foot.position.x,foot.position.z)-.008)<1e-5);
      }
      if(s.state==='walk'&&Math.abs(s.heading-previous.heading)>1e-8){
        turning++;assert.ok(Math.abs(s.heading-previous.heading)<=.9/60+1e-6);assert.ok(s.distance>previous.distance,'roaming turns translate with the walk pose');
      }
    }
    assert.ok(walking>100);assert.ok(turning>0);
  }finally{system.dispose();}
});

test('a live collider replacement stops motion before its full footprint reaches a new wall',()=>{
  let colliders=[];const events=[],{system}=create({getWorld:()=>({heightAt:()=>1,colliders,waterLevel:0}),onSound:e=>events.push(e)});
  try{
    for(let i=0;i<180;i++){system.update(1/60);if(state(system).state==='walk')break;}
    const before=state(system),z=before.position.z;
    colliders=[solidBox(-8,8,z+1.5,z+1.52)];
    advance(system,5);const stopped=state(system);
    assert.ok(stopped.position.z<z+.24,'whole head/sign carry stops short of thin wall');
    const distance=stopped.distance,count=events.filter(e=>e.actorId==='elizabeth').length;
    advance(system,1);assert.equal(state(system).distance,distance);
    assert.equal(events.filter(e=>e.actorId==='elizabeth').length,count,'blocked actor emits no new steps');
  }finally{system.dispose();}
});

test('rebound unsupported placements hide safely and can recover without moving through invalid terrain',()=>{
  const {system,root}=create();
  try{
    const stalePick=system.pickMeshes[0];
    system.rebind({heightAt:()=>undefined});system.update(1/60);
    assert.equal(state(system).valid,false);assert.equal(root.children[0].visible,false);
    assert.equal(system.pickMeshes.length,0);assert.equal(system.idForObject(stalePick),null);
    assert.equal(system.nearest({x:0,y:1,z:4}),null);
    const d=state(system).distance;advance(system,2);assert.equal(state(system).distance,d);
    system.rebind({heightAt:()=>1});advance(system,1);
    assert.equal(state(system).valid,true);assert.equal(root.children[0].visible,true);
    assert.equal(system.pickMeshes.length,42);
  }finally{system.dispose();}
});

test('Elizabeth guards range/repeats, raises once, holds readable EN/ZH, lowers and resumes',()=>{
  const events=[],messages=[],{system,root}=create({onSound:e=>events.push(e),onMessage:m=>messages.push(m),language:'en'});
  try{
    system.update(0,{playerPosition:{x:0,y:1,z:4}});
    assert.equal(system.interact('bad'),false);assert.equal(system.interact('elizabeth',{playerPosition:{x:0,y:1,z:40}}),false);
    assert.equal(system.interact('elizabeth'),true);
    for(let i=0;i<20;i++)assert.equal(system.interact('elizabeth'),false);
    advance(system,1);const held=state(system);assert.equal(held.clip,'sign_hold');
    const face=root.children[0].getObjectByName('SignFace'),texture=face.material.map;
    assert.match(texture.image.text.join(' '),/Welcome/);
    const before=held.clipTime;system.setLanguage('zh');assert.equal(face.material.map,texture);
    assert.match(texture.image.text.join(''),/欢迎/);assert.equal(state(system).clipTime,before);
    advance(system,2);assert.equal(state(system).clip,'sign_hold','readable hold survives two more seconds');
    assert.equal(events.filter(e=>e.kind==='sign-tap').length,1);assert.equal(messages.length,1);
    advance(system,3);assert.equal(state(system).busy,false);
    assert.equal(system.interact('elizabeth'),true);advance(system,1);
    assert.ok(state(system).sign.en.length>0&&state(system).sign.zh.length>0);
    assert.doesNotMatch(state(system).sign.en,/Papers that way|clickable/);
  }finally{system.dispose();}
});

test('actual sign vertices remain clear and an obstructed board/turn refuses to start',()=>{
  let colliders=[solidBox(2.4,2.5,-2,2)];
  const {system,root}=create({getWorld:()=>({heightAt:()=>1,waterLevel:0,colliders})});
  try{
    system.update(0,{playerPosition:{x:0,y:1,z:4}});
    assert.equal(system.interact('elizabeth'),false);assert.equal(state(system).interactionCount,0);
    colliders=[solidBox(3,3.1,-2,2)];assert.equal(system.interact('elizabeth'),true);
    for(let i=0;i<8;i++){
      advance(system,.5);const bounds=exactBounds(root.children[0]);
      assert.ok(bounds.max.x<3,'real raised/lowered board clears the obstacle');assert.ok(bounds.min.y>=1-.0001);
    }
  }finally{system.dispose();}
});

test('Sadaharu completes greet, sniff, sit, seated hold and stand without restarting on repeats',()=>{
  const {system}=create(),seen=new Set();
  try{
    system.update(0,{playerPosition:{x:11,y:1,z:4}});assert.equal(system.interact('sadaharu'),true);
    for(let i=0;i<660;i++){
      if(i<20)assert.equal(system.interact('sadaharu'),false);
      system.update(1/60);seen.add(state(system,'sadaharu').state);
    }
    for(const action of ['greet','sniff','sit','seated','stand'])assert.ok(seen.has(action),action);
    assert.equal(state(system,'sadaharu').busy,false);
  }finally{system.dispose();}
});

test('pause and reduced motion freeze timers/translation/cadence and an explicit reduced encounter is stable',()=>{
  const events=[],silences=[],{system}=create({onSound:e=>events.push(e),onSilence:e=>silences.push(e)});
  try{
    advance(system,3);system.setPaused(true);const paused=system.snapshot();
    system.update(10);assert.deepEqual(system.snapshot(),paused);assert.equal(system.interact('elizabeth'),false);
    system.setPaused(false);system.update(0,{reducedMotion:true,playerPosition:{x:0,y:1,z:4}});
    const before=state(system);assert.equal(system.interact('elizabeth'),true);
    const frozen=system.snapshot(),count=events.length;advance(system,4,8,{reducedMotion:true});
    assert.deepEqual(system.snapshot(),frozen);assert.equal(events.length,count);
    assert.deepEqual(state(system).position,before.position);assert.equal(state(system).clip,'sign_hold');
    assert.equal(system.interact('elizabeth'),false);
    system.setLanguage('en');assert.equal(state(system).clip,'sign_hold');
    advance(system,5,60,{reducedMotion:false});assert.equal(events.filter(e=>e.kind==='sign-tap').length,0,'resume never replays a skipped tap');
    assert.ok(silences.some(e=>e.reason==='paused'));assert.ok(silences.some(e=>e.reason==='reduced-motion'));
  }finally{system.dispose();}
});

test('synchronous callback pause stops remaining actors and does not leave deferred footsteps',()=>{
  let active=true;const events=[];
  const {system}=create({isActive:()=>active,onSound:e=>{events.push(e);active=false;}});
  try{
    for(let i=0;i<600&&active;i++)system.update(1/8);
    assert.ok(events.length>0);const stopped=system.snapshot();system.update(3);
    assert.deepEqual(system.snapshot(),stopped);assert.equal(events.length,1);
    active=true;system.update(0);assert.equal(events.length,1);
  }finally{system.dispose();}
});

test('long input stalls accept at most .25 seconds with no later catch-up',()=>{
  const {system}=create();try{
    system.update(30);assert.ok(Math.abs(system.snapshot().activeTime-.25)<1e-8);
    const stopped=system.snapshot();system.update(0);assert.deepEqual(system.snapshot(),stopped);
  }finally{system.dispose();}
});

test('other actors and reserved board envelopes block overlapping routes and greetings',()=>{
  const p=[{kind:'elizabeth',position:{x:0,z:0},waypoints:[{x:0,z:9}]},
    {kind:'sadaharu',position:{x:0,z:9},heading:Math.PI,waypoints:[{x:0,z:0}]}];
  const {system}=create({placements:p});
  try{
    advance(system,12);assert.equal(state(system).distance,0);assert.equal(state(system,'sadaharu').distance,0);
    assert.ok(state(system,'sadaharu').valid&&state(system).valid,'yield in valid separated places');
  }finally{system.dispose();}
  const tight=create({placements:[{kind:'elizabeth',position:{x:0,z:0}}, {kind:'sadaharu',position:{x:3,z:0}}]});
  try{tight.system.update(0,{playerPosition:{x:0,y:1,z:4}});assert.equal(tight.system.interact('elizabeth'),false);}
  finally{tight.system.dispose();}
});

test('snapshot and picking reads do not advance actors or emit events; disposal is terminal',()=>{
  const events=[],{system}=create({onSound:e=>events.push(e)});
  advance(system,4);const s=system.snapshot(),count=events.length;
  for(let i=0;i<12;i++){system.nearest({x:0,y:1,z:4});system.idForObject(system.pickMeshes[0]);assert.deepEqual(system.snapshot(),s);}
  assert.equal(events.length,count);system.dispose();const terminal=system.snapshot();
  system.update(1);system.setLanguage('zh');system.setPaused(false);system.rebind({heightAt:()=>9});
  assert.equal(system.interact('elizabeth'),false);assert.equal(system.nearest({x:0,y:1,z:4}),null);
  assert.deepEqual(system.snapshot(),terminal);
});

test('partial real actor creation failure releases earlier actors and leaves the caller root intact',()=>{
  const original=globalThis.OffscreenCanvas,before=companionAssetDiagnostics().liveActors,root=new Group();
  const unrelated=new Group();root.add(unrelated);
  globalThis.OffscreenCanvas=class {getContext(){throw new Error('canvas unavailable');}};
  try{
    assert.throws(()=>createCompanionSystem({root,heightAt:()=>1,placements:[places[1],places[0]]}),/canvas unavailable/);
    assert.deepEqual(root.children,[unrelated]);assert.equal(companionAssetDiagnostics().liveActors,before);
  }finally{globalThis.OffscreenCanvas=original;}
});

test('a failing external silence callback cannot strand actor resources during disposal',()=>{
  const before=companionAssetDiagnostics().liveActors,{root,system}=create({onSilence(){throw new Error('audio disconnected');}});
  assert.throws(()=>system.dispose(),/audio disconnected/);
  assert.equal(root.children.length,0);assert.equal(companionAssetDiagnostics().liveActors,before);
  system.dispose();
});

test('a reduced greeting faces the visitor once, and live invalid support hides its stable pose',()=>{
  let heightAt=()=>1;const {system}=create({getWorld:()=>({heightAt})});
  try{
    system.update(0,{reducedMotion:true,playerPosition:{x:-4,y:1,z:0}});
    assert.equal(system.interact('elizabeth'),true);
    assert.ok(Math.abs(state(system).heading+Math.PI/2)<1e-8,'intentional pose faces the reader');
    heightAt=()=>undefined;system.update(0,{reducedMotion:true});
    assert.equal(state(system).valid,false);
  }finally{system.dispose();}
});

test('reduced poses refresh real planted soles on legal live support replacement without advancing pose or timers',()=>{
  const {system}=create();
  try{
    system.update(0,{reducedMotion:true});const before=system.snapshot();
    const heightAt=(_x,z)=>1+.008*z;system.rebind({heightAt});system.update(0,{reducedMotion:true});
    const after=system.snapshot();assert.equal(after.activeTime,before.activeTime);assert.equal(after.soundEvents,before.soundEvents);
    for(const actor of after.actors){
      const old=before.actors.find(a=>a.id===actor.id);assert.equal(actor.valid,true);assert.equal(actor.clip,old.clip);assert.equal(actor.clipTime,old.clipTime);assert.equal(actor.distance,old.distance);
      for(const foot of actor.feet.filter(f=>f.planted))assert.ok(Math.abs(foot.position.y+foot.correction-heightAt(foot.position.x,foot.position.z)-(actor.kind==='elizabeth'?.008:.018))<1e-5,`${actor.kind} ${foot.name} must reflect current support`);
    }
  }finally{system.dispose();}
});

test('the long real dog stays supportable on terrain during locomotion and the entire greeting sequence',()=>{
  const heightAt=(_x,z)=>1+.008*z,{root,system}=create({heightAt});
  try{
    let planted=0;
    for(let i=0;i<500;i++){
      system.update(1/60);const dog=state(system,'sadaharu');
      if(dog.state==='walk')for(const foot of dog.feet.filter(f=>f.planted)){
        planted++;assert.ok(Math.abs(foot.position.y+foot.correction-heightAt(foot.position.x,foot.position.z)-.018)<.001);
      }
    }
    assert.ok(planted>100);
    const dog=state(system,'sadaharu');system.update(0,{playerPosition:{x:dog.position.x,y:dog.position.y,z:dog.position.z+4}});
    assert.equal(system.interact('sadaharu'),true);
    for(let i=0;i<20;i++){
      advance(system,.5);const b=exactBounds(root.children[1]);
      assert.ok(b.min.y>=heightAt(b.min.x,b.min.z)-.015,'actual transitioned body never buries into the gentle slope');
    }
  }finally{system.dispose();}
});


test('completion receipts come only from each real full action chain and actual resumed walking',()=>{
  for(const id of ['elizabeth','sadaharu']){
    const {system}=create(),visitor=id==='elizabeth'?{x:0,y:1,z:4}:{x:11,y:1,z:4};
    try{
      system.update(0,{playerPosition:visitor});const startedAt=system.snapshot().activeTime;assert.equal(system.interact(id),true);
      const seen=new Set();let frames=0;
      while(state(system,id).busy&&frames++<1200){system.update(1/60);const a=state(system,id);seen.add(a.state);if(a.busy)assert.equal(a.completedInteraction,null);}
      const completed=state(system,id),receipt=completed.completedInteraction;assert.ok(receipt);assert.equal(receipt.interactionCount,1);assert.equal(receipt.startedAt,startedAt);assert.equal(receipt.completedAt,system.snapshot().activeTime);assert.equal(receipt.resumedAt,null);assert.equal(receipt.distance,completed.distance);
      for(const phase of id==='elizabeth'?['raise','hold','lower']:['greet','sniff','sit','seated','stand'])assert.ok(seen.has(phase),phase);
      frames=0;while(state(system,id).completedInteraction.resumedAt===null&&frames++<600)system.update(1/60);
      const resumed=state(system,id);assert.ok(resumed.completedInteraction.resumedAt>receipt.completedAt);assert.ok(resumed.completedInteraction.resumedDistance>receipt.distance+.05);assert.ok(resumed.distance>=resumed.completedInteraction.resumedDistance);assert.equal(resumed.busy,false);
      resumed.completedInteraction.completedAt=-1;assert.equal(state(system,id).completedInteraction.completedAt,receipt.completedAt,'receipt snapshots are independent copies');
    }finally{system.dispose();}
  }
});

test('completion receipts cannot be manufactured by invalid support or a reduced-pose shortcut',()=>{
  for(const mode of ['invalid','reduced'])for(const id of ['elizabeth','sadaharu']){
    const {system}=create(),visitor=id==='elizabeth'?{x:0,y:1,z:4}:{x:11,y:1,z:4};
    try{
      system.update(0,{playerPosition:visitor});assert.equal(system.interact(id),true);advance(system,1);
      if(mode==='invalid'){system.rebind({heightAt:()=>undefined});system.rebind({heightAt:()=>1});}
      else{system.update(0,{reducedMotion:true});system.update(0,{reducedMotion:false});}
      advance(system,6);assert.equal(state(system,id).completedInteraction,null);assert.equal(state(system,id).interactionCount,1);
    }finally{system.dispose();}
  }
});
