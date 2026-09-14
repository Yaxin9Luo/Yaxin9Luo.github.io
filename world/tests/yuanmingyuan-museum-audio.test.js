import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumAudio} from '../src/yuanmingyuan/museum-audio.js';

function setup(){
  const calls=[],value=()=>({setTargetAtTime:(...args)=>calls.push(args)}),engine={context:null,musicStatus:'idle',setVolumes(v){this.volumes=v;},setEnvironment(v){this.environment=v;},setListener(p,f){this.listener={p,f};},update(){},setEnabled(v){this.enabled=v;},unlock(){this.unlocks=(this.unlocks||0)+1;},setSuspended(v){this.suspended=v;},dispose(){this.disposals=(this.disposals||0)+1;}};
  let pump,cleared=0;const audio=createMuseumAudio({engine,setTimer:fn=>{pump=fn;return 7;},clearTimer:id=>{assert.equal(id,7);cleared++;}});
  const running=()=>{engine.context={state:'running',currentTime:4};engine.waterGain={gain:value()};engine.waterPanner={positionX:value(),positionY:value(),positionZ:value()};};
  return {audio,engine,calls,pump,running,get cleared(){return cleared;}};
}
test('museum audio never creates an audio context before a gesture',()=>{
  const {audio,engine,pump}=setup();pump();assert.equal(engine.unlocks,undefined);assert.equal(audio.snapshot().enabled,false);audio.setEnabled(true);assert.equal(engine.unlocks,1);assert.equal(engine.enabled,true);audio.dispose();
});
test('fountain audio follows the museum emitter instead of the portfolio origin',()=>{
  const {audio,engine,calls,running}=setup();running();audio.setEmitter({x:755,y:6,z:-620});audio.update({position:{x:755,y:4,z:-615},camera:{x:758,y:9,z:-601},night:1,reading:true});
  assert.deepEqual(calls.slice(0,3).map(v=>v[0]),[755,6,-620]);assert.equal(calls[3][0],.26);assert.equal(engine.environment.reading,true);assert.equal(engine.environment.night,1);
  audio.setEmitter(null);audio.update({reading:false});assert.equal(calls.at(-1)[0],0,'a dry courtyard must have no phantom fountain');audio.dispose();
});
test('a suspended or disposed reader cannot restart audio from its scheduling timer',()=>{
  const h=setup();h.audio.setSuspended(true);h.pump();assert.equal(h.engine.suspended,true);assert.equal(h.engine.unlocks,undefined);
  h.audio.dispose();h.audio.dispose();h.pump();h.audio.setEnabled(true);assert.equal(h.engine.unlocks,undefined);assert.equal(h.engine.disposals,1);assert.equal(h.cleared,1);
});
