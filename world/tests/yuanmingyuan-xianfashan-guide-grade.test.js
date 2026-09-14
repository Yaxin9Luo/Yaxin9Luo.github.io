import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCompanionSweep} from '../src/companion-system.js';
import {selectMuseumGuidePlacements} from '../src/yuanmingyuan/museum-guide-placement.js';
import {xianGuideFixture} from './helpers/xianfashan-guide-grade-fixture.js';
import {Group} from 'three';
import {createMuseumGuides} from '../src/yuanmingyuan/museum-guides.js';
import {companionManifest} from '../src/companion-manifest.js';

const visitor={x:885.1798535423213,y:4.03999999165535,z:-642.0599511807785};
const options=f=>({site:f.site,centre:{x:883,z:-640},world:f.world,architecture:f.architecture,visitorPosition:visitor,entryIds:['xianfashan','fanghe-xianfahua','xianfaqiao']});
const captured=[
  [{x:884.4250000000001,z:-646.1772758664048,heading:2.0943951023931904},{x:884.5083959896779,z:-646.2314338553438,heading:2.1991148575128503}],
  [{x:889.9798226778249,z:-639.8052442868556,heading:-.2064698515946313},{x:889.9548024091602,z:-639.7104614008842,heading:-.30970477739194696}],
  [{x:884.8178681847605,z:-632.6136001890779,heading:2.7227136331111477},{x:884.8535036904805,z:-632.7064338553438,heading:2.827433388230807}],
];

test('captured grade remains a real pier-base or paving edge, not an overhead support selection',()=>{
  const f=xianGuideFixture();try{
    assert(f.pads.some(pad=>pad.id==='xianfashan-mound-edge-ground'&&pad.blend===4&&pad.heightY===4));
    for(const [index,[from,to]]of captured.entries()){
      const hits=[],heightAt=(x,z)=>f.world.heightAt(x,z);heightAt.surfaceAt=(x,z)=>{const h=f.world.heightAt.surfaceAt(x,z);if(h)hits.push(h);return h;};
      const result=evaluateCompanionSweep({kind:'elizabeth',from,to,...f.world,heightAt});assert.equal(result.reason,'grade');
      const low=Math.min(...hits.map(h=>h.height)),high=Math.max(...hits.map(h=>h.height));
      assert(Math.abs(low-3.82)<1e-6);assert(Math.abs(high-(index===1?4.04:4.455))<1e-6);assert(high<4.89);
      assert(hits.some(h=>f.names.get(h.surfaceId)?.includes(index===1?'ground-approaches':'pier-base')));
    }
  }finally{f.dispose();}
});

test('new Xian placements retain continuous raised-board turning clearance away from the narrow approach',()=>{
  const f=xianGuideFixture();try{
    const result=selectMuseumGuidePlacements(options(f));assert.equal(result.placements.length,3);
    assert(!result.placements.some(p=>p.position.x===890&&p.position.z===-640));
    for(const p of result.placements){
      for(let i=0;i<4;i++){
        const turn=evaluateCompanionSweep({kind:'elizabeth',from:{...p.position,heading:i*Math.PI/2},to:{...p.position,heading:(i+1)*Math.PI/2},interaction:true,...f.world});
        assert.equal(turn.valid,true,JSON.stringify({position:p.position,quarter:i,result:turn}));
      }
    }
    for(let i=0;i<result.placements.length;i++)for(const q of result.placements.slice(i+1))assert(Math.hypot(q.position.x-result.placements[i].position.x,q.position.z-result.placements[i].position.z)>=7);
  }finally{f.dispose();}
});

test('actual controller moves all three locally supported guides and raises the Fanghe exhibit before inspection',t=>{
  const f=xianGuideFixture(),root=new Group(),actions=[],inspections=[];let system,actorDisposals=0;
  // Only the animation/render owner is a stub; real envelopes, support, route,
  // turn/interaction controller and museum exhibit binding are executed.
  const pool={create({id}){
    const group=new Group(),model=new Group();group.add(model);
    return {group,model,asset:companionManifest.elizabeth,footStates:new Map(),action:'idle',clip:'idle',time:0,duration:3,
      setAction(action){this.action=this.clip=action;this.time=0;this.duration=this.asset.durations[action];actions.push({id,action});},
      setSign(){},setLanguage(){},update(dt){this.time+=dt;},dispose(){actorDisposals++;group.removeFromParent();group.clear();}};
  }};
  try{
    const placements=selectMuseumGuidePlacements(options(f)).placements;assert.equal(placements.length,3);assert(placements.every(p=>p.waypoints.length>0));
    system=createMuseumGuides({pool,root,placements,...f.world,onInspect:event=>inspections.push(event)});
    let steps=0;
    while(steps++<600&&!system.snapshot().actors.every(a=>a.distance>.15))system.update(1/60);
    const moving=system.snapshot();assert(moving.actors.every(a=>a.valid&&a.distance>.15),JSON.stringify(moving.actors));
    const actor=moving.actors.find(a=>a.id==='xianfashan-guide-2'),approach={x:actor.position.x-4.8,y:actor.position.y,z:actor.position.z};
    assert.equal(system.interact(actor.id,{playerPosition:approach}),true);
    assert.equal(system.snapshot().actors.find(a=>a.id===actor.id).interactionCount,1);assert.equal(inspections.length,0,'reader waits for actual raise/hold state');
    let greetingSteps=0;while(greetingSteps++<600&&!inspections.some(event=>event.id===actor.id))system.update(1/60,{playerPosition:approach});
    assert(actions.some(event=>event.id===actor.id&&event.action==='sign_raise'));
    assert(inspections.some(event=>event.id===actor.id&&event.entryId==='fanghe-xianfahua'));
    assert(system.snapshot().actors.every(a=>a.valid));
    t.diagnostic(JSON.stringify({animationOwner:'stub-no-GLB-or-GPU',steps,greetingSteps,firstMovement:moving.actors.map(a=>({id:a.id,distance:a.distance,state:a.state,routeReview:a.routeReview})),inspections,queries:f.world.snapshot().queries}));
  }finally{system?.dispose();f.dispose();root.clear();}
  assert.equal(actorDisposals,3);
});
