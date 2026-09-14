import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Game} from '../src/game.js';
import {createCompanionSystem,evaluateCompanionSweep} from '../src/companion-system.js';
import {companionRoutes} from '../src/companion-route.js';
import {createCompanionSupport} from '../src/companion-support.js';
import {COMPANION_PLACEMENTS} from '../src/companion-placements.js';
import {loadAcceptedCompanions,solidBox} from './helpers/companion-runtime.js';
import {createCompanionWorldFixture} from './helpers/companion-world-fixture.js';

test('the actual later court greeting recovers with both actors and the flying visitor retained through repeated encounters',async t=>{
  const began=performance.now(),phase=label=>console.info(`Companion recovery ${(performance.now()-began).toFixed(0)} ms: ${label}`);
  await loadAcceptedCompanions();const fixture=await createCompanionWorldFixture(phase),{root,bindings}=fixture;
  let liveBindings=bindings,visitorPosition=null;const support=createCompanionSupport(()=>liveBindings),sounds=[];
  const visitorCollider=()=>visitorPosition?Game.prototype._companionVisitorCollider.call({started:true,exhibition:null,position:visitorPosition,locomotion:{mode:'flying'}}):null;
  const world=()=>({...liveBindings,heightAt:support.heightAt,collidersFor:support.collidersFor,visitorCollider:visitorCollider()});
  const system=createCompanionSystem({root,placements:COMPANION_PLACEMENTS,seed:7219,getWorld:world,onSound:event=>sounds.push(event)});
  const actor=id=>system.snapshot().actors.find(a=>a.id===id);
  const approach=id=>{const a=actor(id);visitorPosition=new Vector3(a.position.x-4.8,a.position.y+3.2,a.position.z);return visitorPosition;};
  let plantedSamples=0,turnSteps=0;
  const step=()=>{
    const before=actor('sadaharu');system.update(1/60,{playerPosition:visitorPosition});const after=actor('sadaharu');
    assert.ok(system.snapshot().actors.every(a=>a.valid),'both actual actor envelopes remain supported and clear');
    if(before.state==='turn'||after.state==='turn'){
      turnSteps++;assert.ok(Math.abs(after.heading-before.heading)<=.9/60+1e-8);assert.equal(after.distance,before.distance,'recovery rotation cannot manufacture resumed travel');
      assert.equal(after.completedInteraction?.resumedAt,null,'the completed greeting stays pending until actual walking');
    }
    if(before.state==='turn'||after.state==='turn'||Math.round(system.snapshot().activeTime*60)%15===0)for(const a of system.snapshot().actors)for(const foot of a.feet.filter(f=>f.planted)){
      const height=support.heightAt(foot.position.x,foot.position.z)+(a.kind==='elizabeth'?.008:.018);plantedSamples++;
      assert.ok(Math.abs(foot.position.y+foot.correction-height)<1e-5,`${a.id} ${a.state} ${foot.name} must follow accepted support`);
    }
  };
  try{
    // Replay the accepted-time history preceding the captured later dog pose.
    // Viewer movement occurs only at the original approach actions; the dog
    // visitor stays at the exact saved position throughout both full greetings.
    for(let frame=1;frame<=1889;frame++){
      step();
      if(frame===839)assert.equal(system.interact('elizabeth',{playerPosition:approach('elizabeth')}),true);
      if(frame===1634)approach('sadaharu');
    }
    const before=actor('sadaharu');
    assert.ok(Math.abs(before.position.x+14.25)<1e-6);assert.ok(Math.abs(before.position.z-38.872)<1e-6,JSON.stringify(before));
    assert.ok(Math.abs(before.heading-2*Math.PI)<1e-6);assert.ok(Math.abs(before.distance-13.323963168562402)<1e-6);
    assert.equal(system.interact('sadaharu',{playerPosition:approach('sadaharu')}),true);
    const retainedVisitor=visitorPosition.toArray();assert.ok(Math.abs(retainedVisitor[0]+19.05)<1e-6);assert.ok(Math.abs(retainedVisitor[2]-38.872)<1e-6);
    for(let encounter=1;encounter<=2;encounter++){
      if(encounter===2)assert.equal(system.interact('sadaharu',{playerPosition:visitorPosition}),true,'a second legitimate greeting remains available after actual recovery');
      let frames=0;while(actor('sadaharu').busy&&frames++<1200){if(frames%60===0)assert.equal(system.interact('sadaharu',{playerPosition:visitorPosition}),false);step();}
      const completed=actor('sadaharu'),receipt=completed.completedInteraction;assert.equal(completed.busy,false);assert.equal(receipt.interactionCount,encounter);assert.equal(receipt.resumedAt,null);
      assert.equal(sounds.filter(event=>event.actorId==='sadaharu'&&event.kind==='dog-breath').length,encounter);
      if(encounter===1){
        assert.ok(Math.abs(receipt.startedAt-31.483333333332826)<1e-6);assert.ok(Math.abs(receipt.completedAt-42.38333333333221)<1e-6);
        const from={...completed.position,heading:completed.heading},obstacles=system.colliders.filter(c=>c.id!=='companion:sadaharu').concat(visitorCollider()),rejections=[];
        for(const goal of [COMPANION_PLACEMENTS[1].position,...COMPANION_PLACEMENTS[1].waypoints])for(const route of companionRoutes(from,goal,1.25)){
          let result={valid:true},segment=null;
          for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];result=evaluateCompanionSweep({kind:'sadaharu',from:a,to:b,...bindings,heightAt:support.heightAt,colliders:support.collidersFor(a,b,'sadaharu',false).concat(obstacles)});if(!result.valid){segment={from:a,to:b};break;}}
          rejections.push({goal,length:route.length,result,segment});
        }
        const turnBack=evaluateCompanionSweep({kind:'sadaharu',from,to:{...from,heading:before.heading},...bindings,heightAt:support.heightAt,colliders:support.collidersFor(from,{...from,heading:before.heading},'sadaharu',false).concat(obstacles)});
        t.diagnostic(JSON.stringify({laterPose:from,visitor:retainedVisitor,otherActor:actor('elizabeth').position,rejections,turnBack}));
        assert.ok(rejections.length>0&&rejections.every(item=>!item.result.valid),'the captured greeting heading has no valid existing forward route');assert.equal(turnBack.valid,true,'the original heading is reachable through the full unchanged swept body envelope');
        // Add a live obstacle only inside the rotation's intermediate envelope:
        // both endpoint poses remain clear, so endpoint-only approval is unsafe.
        const blocker={...solidBox(from.x-.45,from.x-.15,from.z+1.73,from.z+1.88,from.y+.003,from.y+3.4),id:'test:recovery-mid-arc'};
        const checkRecovery=(toHeading=actor('sadaharu').heading)=>{
          const a=actor('sadaharu'),p={...a.position,heading:a.heading},q={...p,heading:toHeading};
          return evaluateCompanionSweep({kind:'sadaharu',from:p,to:q,...liveBindings,heightAt:support.heightAt,colliders:support.collidersFor(p,q,'sadaharu',false).concat(system.colliders.filter(c=>c.id!=='companion:sadaharu'),visitorCollider())});
        };
        liveBindings={...bindings,colliders:bindings.colliders.concat(blocker)};
        assert.equal(checkRecovery().valid,true);assert.equal(checkRecovery(before.heading).obstacle,blocker.id,'the whole turn must reject the live obstacle');
        const restored={...from,heading:before.heading};assert.equal(evaluateCompanionSweep({kind:'sadaharu',from:restored,...liveBindings,heightAt:support.heightAt,colliders:support.collidersFor(restored,restored,'sadaharu',false).concat(obstacles)}).valid,true,'the restored endpoint alone is also clear');
        for(let i=0;i<300;i++)step();
        assert.equal(actor('sadaharu').heading,from.heading);assert.equal(actor('sadaharu').distance,receipt.distance);assert.equal(actor('sadaharu').completedInteraction.resumedAt,null);
        liveBindings=bindings;
        for(let i=0;i<360&&actor('sadaharu').state!=='turn';i++)step();assert.equal(actor('sadaharu').state,'turn','clearing an obstacle retries the pending original heading');
        system.setPaused(true);const paused=system.snapshot();for(let i=0;i<10;i++)system.update(1/60);assert.deepEqual(system.snapshot(),paused,'pause advances neither recovery time nor actual feet');system.setPaused(false);
        for(let i=0;i<10;i++)step();
        liveBindings={...bindings,colliders:bindings.colliders.concat(blocker)};assert.equal(checkRecovery().valid,true);
        for(let i=0;i<240&&actor('sadaharu').state==='turn';i++){step();assert.equal(checkRecovery().valid,true,'each accepted turn step stops before the newly inserted obstacle');}
        assert.equal(actor('sadaharu').state,'rest');assert.ok(actor('sadaharu').heading>from.heading&&actor('sadaharu').heading<before.heading);
        assert.equal(actor('sadaharu').distance,receipt.distance);assert.equal(actor('sadaharu').completedInteraction.resumedAt,null);
        liveBindings=bindings;
      }
      frames=0;while(actor('sadaharu').completedInteraction.resumedAt===null&&frames++<900)step();
      const resumed=actor('sadaharu');phase(`encounter ${encounter}: completed ${receipt.completedAt}, resumed ${resumed.completedInteraction.resumedAt}`);
      assert.ok(resumed.completedInteraction.resumedAt>receipt.completedAt,`later encounter ${encounter} must actually resume with the visitor still present: ${JSON.stringify(resumed)}`);
      assert.ok(resumed.completedInteraction.resumedDistance>receipt.distance+.05);assert.deepEqual(visitorPosition.toArray(),retainedVisitor);assert.equal(resumed.completedInteraction.completedAt,receipt.completedAt);
      t.diagnostic(JSON.stringify({encounter,receipt:resumed.completedInteraction,position:resumed.position,heading:resumed.heading}));
    }
    assert.ok(turnSteps>0);assert.ok(plantedSamples>100);
    t.diagnostic(JSON.stringify({colliders:bindings.colliders.length,turnSteps,plantedSamples,renderer:false,visitorMovedDuringRecovery:false}));
  }finally{system.dispose();support.dispose();fixture.dispose();}
});
