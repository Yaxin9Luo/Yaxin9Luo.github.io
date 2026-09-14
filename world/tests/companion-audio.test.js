import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldAudio} from '../src/audio.js';
import {createCompanionFoley} from '../src/companion-foley.js';

function boundary(t){
  const original={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch},contexts=[];
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
  const node=()=>({gain:param(),frequency:param(),playbackRate:param(),positionX:param(),positionY:param(),positionZ:param(),connections:[],connect(n){this.connections.push(n);return n;},disconnect(){this.disconnections=(this.disconnections||0)+1;},start(at){this.startedAt=at;},stop(at){this.stoppedAt=at;}});
  globalThis.AudioContext=class {
    constructor(){this.currentTime=3;this.sampleRate=48000;this.state='suspended';this.destination={};this.sources=[];contexts.push(this);}
    createGain(){return node();}createPanner(){return node();}createBiquadFilter(){return node();}createOscillator(){return node();}
    createBufferSource(){const n=node();this.sources.push(n);return n;}
    createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i],copyToChannel(samples,i){data[i].set(samples);}};}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
  };
  globalThis.fetch=async()=>({ok:false,status:404});
  t.after(()=>Object.assign(globalThis,original));return contexts;
}
const event=(owner='test',kind='sign-tap')=>({owner,actorId:'elizabeth',kind,variant:2,position:{x:0,y:0,z:1}});

test('original companion samples reach the existing effects bus only after explicit unlock and share its 24 voices',async t=>{
  const contexts=boundary(t),audio=new WorldAudio();t.after(()=>audio.dispose());
  assert.equal(audio.playCompanion(event()),false);assert.equal(contexts.length,0);
  audio.setEnabled(true);assert.equal(audio.playCompanion(event()),false);audio.unlock();await audio._musicPromise;
  audio.setListener({x:0,y:0,z:0},{x:0,y:0,z:-1});assert.equal(audio.playCompanion(event()),true);
  const voice=[...audio.voices][0];assert.deepEqual(voice.oscillator.buffer.getChannelData(0),createCompanionFoley('sign-tap',48000,2));
  assert.equal(voice.oscillator.startedAt,3);assert.ok(voice.gain.connections.includes(voice.panner));assert.ok(voice.panner.connections.includes(audio.effectsBus));
  assert.equal(voice.panner.rolloffFactor,0,'manual listener attenuation is applied once');
  for(let i=1;i<24;i++)audio._tone(200,.2);assert.equal(audio.voices.size,24);
  assert.equal(audio.playCompanion(event()),false);assert.equal(audio.voices.size,24);
  voice.oscillator.onended();assert.equal(audio.voices.size,23);assert.equal(voice.panner.disconnections,1);
  assert.equal(contexts.length,1);
});

test('owner cancellation, mute, reading and synchronous suspension release companion tails without cancelling other effects',async t=>{
  boundary(t);const audio=new WorldAudio(true);t.after(()=>audio.dispose());audio.unlock();await audio._musicPromise;
  audio.setListener({x:0,y:0,z:0},{x:0,y:0,z:-1});audio.play('page');const original=audio.voices.size;
  audio.playCompanion(event('a'));audio.playCompanion(event('b'));audio.cancelCompanionVoices('a');assert.equal(audio.voices.size,original+1);
  audio.setEnvironment({reading:true});assert.equal(audio.voices.size,original);assert.equal(audio.playCompanion(event()),false);
  audio.setEnvironment({reading:false});audio.playCompanion(event());audio.setEnabled(false);assert.equal(audio.voices.size,original);assert.equal(audio.playCompanion(event()),false);
  audio.setEnabled(true);audio.playCompanion(event());audio.context.suspend=()=>new Promise(()=>{});audio.setSuspended(true);
  assert.equal(audio.context.state,'running');assert.equal(audio.playCompanion(event()),false);assert.equal(audio.voices.size,original);
  audio.dispose();audio.dispose();assert.equal(audio.voices.size,0);
});

test('distance, zero effects volume and a current activity guard allocate no silent or inactive source nodes',async t=>{
  boundary(t);const audio=new WorldAudio(true);t.after(()=>audio.dispose());audio.unlock();await audio._musicPromise;
  audio.setListener({x:0,y:0,z:0},{x:0,y:0,z:-1});const count=audio.context.sources.length;
  assert.equal(audio.playCompanion({...event(),position:{x:0,y:0,z:18}}),false);
  assert.equal(audio.playCompanion(event(),{isActive:()=>false}),false);
  audio.setVolumes({effects:0});assert.equal(audio.playCompanion(event()),false);assert.equal(audio.context.sources.length,count);
  audio.setVolumes({effects:.5});assert.equal(audio.playCompanion(event()),true);assert.equal(audio.companionSnapshot().activeVoices,1);
  audio.setVolumes({effects:0});assert.equal(audio.companionSnapshot().activeVoices,0);
});


test('nearby companion attenuation follows the visitor while the follow camera retains spatial orientation',async t=>{
  boundary(t);const audio=new WorldAudio(true);t.after(()=>audio.dispose());audio.unlock();await audio._musicPromise;
  audio.setListener({x:0,y:7,z:22},{x:0,y:0,z:-1});
  assert.equal(audio.playCompanion(event()),false,'the default listener contract still uses camera range');
  assert.equal(audio.playCompanion(event(),{distanceFrom:{x:0,y:1.3,z:5}}),true,'a close visitor hears a greeting even with the normal 17 m follow camera');
  const voice=[...audio.voices][0];assert.ok(voice.gain.gain.value>0);assert.equal(voice.panner.positionZ.value,1);assert.deepEqual(audio.listenerPosition,{x:0,y:7,z:22});
  const count=audio.context.sources.length;assert.equal(audio.playCompanion(event(),{distanceFrom:{x:0,y:1.3,z:30}}),false);assert.equal(audio.context.sources.length,count);
});
