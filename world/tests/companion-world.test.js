import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAcceptedCompanions,exactBounds,solidBox} from './helpers/companion-runtime.js';
import {createCompanionSupport} from '../src/companion-support.js';
import {createCompanionSystem,evaluateCompanionSweep} from '../src/companion-system.js';
import {queryGroundSupport} from '../src/ground-motion.js';
import {createCompanionWorldFixture} from './helpers/companion-world-fixture.js';
import {COMPANION_PLACEMENTS} from '../src/companion-placements.js';

test('both accepted actors actually travel connected routes on the assembled world geometry and live walkable colliders',async t=>{
  const began=performance.now(),phase=label=>console.info(`CPU world check ${(performance.now()-began).toFixed(0)} ms: ${label}`);
  // Real geometry/node transforms and support/collision owners. Only image
  // presentation is isolated; no renderer, full image maps or WebGL assertion.
  await loadAcceptedCompanions();const fixture=await createCompanionWorldFixture(phase);const {root,world,botanicalBytes,assemblyTimings}=fixture;let bindings=fixture.bindings;
  let visitor=null;const sounds=[];
  const support=createCompanionSupport(()=>bindings),system=createCompanionSystem({root,placements:COMPANION_PLACEMENTS,seed:7219,onSound:event=>sounds.push(event),getWorld:()=>({...bindings,heightAt:support.heightAt,collidersFor:support.collidersFor,visitorCollider:visitor})});phase('companions attached');
  const visitorAt=(x,z)=>{
    const feetY=support.heightAt(x,z),hit=queryGroundSupport({x,z,feetY},bindings);if(!hit.valid)return null;
    visitor={...solidBox(x-.65,x+.65,z-.65,z+.65,feetY,feetY+3.28),id:'visitor'};return {x,y:feetY+1.3,z};
  };
  const feetValid=(snapshot,frame)=>{for(const actor of snapshot.actors)for(const foot of actor.feet.filter(f=>f.planted)){
    const surface=support.heightAt.surfaceAt(foot.position.x,foot.position.z),expected=surface.height+(actor.kind==='elizabeth'?.008:.018),error=foot.position.y+foot.correction-expected;
    assert.ok(Math.abs(error)<1e-5,JSON.stringify({frame,time:snapshot.activeTime,kind:actor.kind,state:actor.state,clip:actor.clip,clipTime:actor.clipTime,root:actor.position,heading:actor.heading,foot,surface,expected,error}));
  }};
  try{
    const gardenEvents=assemblyTimings.filter(event=>event.region==='gardens');assert.equal(gardenEvents.length,1);
    assert.deepEqual(gardenEvents[0].assemblySteps.map(step=>step.region),['gardens-build','courtyard-underplanting']);
    for(const step of gardenEvents[0].assemblySteps)assert.ok(Number.isFinite(step.assemblyMs)&&step.assemblyMs>=0);
    assert.ok(gardenEvents[0].assemblySteps.reduce((sum,step)=>sum+step.assemblyMs,0)<=gardenEvents[0].assemblyMs);
    t.diagnostic(JSON.stringify({assemblyTimings}));
    const initial=system.snapshot();assert.ok(initial.actors.every(a=>a.valid),JSON.stringify(initial.actors.map(a=>({kind:a.kind,valid:a.valid,reason:a.reason}))));
    let samples=0,turning=0;const extents=new Map(initial.actors.map(a=>[a.id,{minX:a.position.x,maxX:a.position.x,minZ:a.position.z,maxZ:a.position.z}]));
    for(let i=0;i<3600;i++){
      if(i%600===0)phase(`${i/60} accepted seconds`);
      const previous=system.snapshot();
      if(i===1500){const actor=previous.actors[0];assert.ok(visitorAt(actor.position.x+Math.sin(actor.heading)*2.9,actor.position.z+Math.cos(actor.heading)*2.9),'temporary visitor occupies actual walkable space');}
      if(i===1800)visitor=null;
      system.update(1/60);const current=system.snapshot();
      if(i===1200){bindings={...bindings,heightAt:world.heightAt,colliders:[...bindings.colliders]};system.rebind({});}
      for(const actor of current.actors){
        assert.equal(actor.valid,true,`${actor.kind}: ${actor.reason}`);
        const e=extents.get(actor.id);e.minX=Math.min(e.minX,actor.position.x);e.maxX=Math.max(e.maxX,actor.position.x);e.minZ=Math.min(e.minZ,actor.position.z);e.maxZ=Math.max(e.maxZ,actor.position.z);
        const before=previous.actors.find(a=>a.id===actor.id);
        if(actor.state==='walk'&&Math.abs(actor.heading-before.heading)>1e-8){assert.ok(actor.distance>before.distance);turning++;}
        if(i%30===0){samples+=actor.feet.filter(f=>f.planted).length;if(visitor)assert.equal(evaluateCompanionSweep({kind:actor.kind,from:{...actor.position,heading:actor.heading},heightAt:support.heightAt,waterLevel:-15,colliders:[visitor]}).valid,true,'visitor and actual body envelopes remain separated');}
      }
      if(i%30===0)feetValid(current,i);
    }
    const final=system.snapshot();
    for(const actor of final.actors){
      const spread=extents.get(actor.id);t.diagnostic(JSON.stringify({kind:actor.kind,distance:actor.distance,spread,supportSpread:actor.supportSpread}));
      assert.ok(actor.distance>10,`${actor.kind} must accumulate meaningful actual movement, got ${actor.distance}`);
      assert.ok(Math.hypot(spread.maxX-spread.minX,spread.maxZ-spread.minZ)>2.5,'connected movement must explore more than a stationary safe pose');
      const bounds=exactBounds(root.children.find(g=>g.name===`Companion:${actor.kind}`));assert.ok(bounds.max.y-bounds.min.y>2.8,'full accepted scale remains');
    }
    assert.ok(turning>100);assert.ok(samples>500);
    for(const actor of system.snapshot().actors){
      let position=null;
      for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
        position=visitorAt(actor.position.x+Math.sin(actor.heading+angle)*4.8,actor.position.z+Math.cos(actor.heading+angle)*4.8);
        if(position&&system.interact(actor.id,{playerPosition:position}))break;position=null;visitor=null;
      }
      assert.ok(position,`${actor.kind} has a supported, clear real-world greeting approach`);
      let frames=0;while(system.snapshot().actors.find(a=>a.id===actor.id).busy&&frames<1080){system.update(1/60,{playerPosition:position});if(frames%15===0)feetValid(system.snapshot(),`greeting:${actor.kind}:${frames}`);frames++;}
      assert.equal(system.snapshot().actors.find(a=>a.id===actor.id).busy,false,`${actor.kind} completes the actual supported encounter`);
      assert.ok(sounds.some(e=>e.actorId===actor.id&&e.kind===(actor.kind==='elizabeth'?'sign-tap':'dog-breath')));visitor=null;
      t.diagnostic(JSON.stringify({kind:actor.kind,greetingAcceptedFrames:frames,visitor:position}));
    }
    t.diagnostic(JSON.stringify({worldComplete:world.complete,colliders:bindings.colliders.length,botanicalGeometryBytes:botanicalBytes,plantedFootSamples:samples,walkingTurnSteps:turning,renderer:false,imagePresentationIsolated:true}));
  }finally{system.dispose();support.dispose();fixture.dispose();}
});
