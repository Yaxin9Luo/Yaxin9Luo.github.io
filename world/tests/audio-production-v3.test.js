import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldAudio,windCycle} from '../src/audio.js';

// This boundary models asynchronous context state and explicit graph ownership;
// it does not claim to reproduce an audio device or decode/audition an MP3.
function audioFixture(t,{deferResume=false,deferSuspend=false}={}){
  const previousContext=globalThis.AudioContext,previousFetch=globalThis.fetch,contexts=[],requests=[];
  const param=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({type:'set',value,at});},setTargetAtTime(value,at){this.events.push({type:'target',value,at});},linearRampToValueAtTime(value,at){this.events.push({type:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({type:'exponential',value,at});}});
  class Context{
    constructor(){this.state='suspended';this.sampleRate=48000;this.currentTime=0;this.nodes=[];this.resumeJobs=[];this.suspendJobs=[];this.resumeCalls=0;this.suspendCalls=0;this.closeCalls=0;this.destination=this.node('destination');this.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(key=>[key,param()]));contexts.push(this);}
    node(kind){const node={kind,connections:new Set(),gain:param(),frequency:param(),playbackRate:param(),starts:[],stops:[],connect(destination){this.connections.add(destination);return destination;},disconnect(){this.connections.clear();},start(at=0){assert.equal(this.starts.length,0,'a source cannot be started twice');this.starts.push(at);},stop(at=0){this.stops.push(at);},end(){this.onended?.();}};this.nodes.push(node);return node;}
    createGain(){return this.node('gain');}createBiquadFilter(){return this.node('filter');}createBufferSource(){return this.node('source');}createOscillator(){return this.node('oscillator');}
    createDynamicsCompressor(){return Object.assign(this.node('compressor'),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(key=>[key,param()])));}
    createConvolver(){return this.node('convolver');}
    createPanner(){return Object.assign(this.node('panner'),Object.fromEntries(['positionX','positionY','positionZ'].map(key=>[key,param()])));}
    createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,getChannelData:index=>data[index]};}
    async decodeAudioData(){return {duration:60};}
    resume(){this.resumeCalls++;if(deferResume)return new Promise(resolve=>this.resumeJobs.push(()=>{if(this.state!=='closed')this.state='running';resolve();}));this.state='running';return Promise.resolve();}
    suspend(){this.suspendCalls++;if(deferSuspend)return new Promise(resolve=>this.suspendJobs.push(()=>{if(this.state!=='closed')this.state='suspended';resolve();}));this.state='suspended';return Promise.resolve();}
    async close(){this.closeCalls++;this.state='closed';}
    finishResume(){this.resumeJobs.splice(0).forEach(finish=>finish());}
    finishSuspend(){this.suspendJobs.splice(0).forEach(finish=>finish());}
  }
  globalThis.AudioContext=Context;globalThis.fetch=async(...args)=>{requests.push(args);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
  t.after(()=>{if(previousContext===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previousContext;globalThis.fetch=previousFetch;});
  return {contexts,requests};
}

test('repeated unlock, mute and resume keep one audio graph and one scheduled score per track',async t=>{
  const {contexts,requests}=audioFixture(t),audio=new WorldAudio();t.after(()=>audio.dispose());
  audio.unlock();assert.equal(contexts.length,0);audio.setEnabled(true);await audio._musicPromise;
  for(let i=0;i<8;i++){audio.unlock();audio.update(i);audio.setEnabled(false);audio.play('page');audio.setEnabled(true);audio.setSuspended(true);audio.setSuspended(false);}
  assert.equal(contexts.length,1);assert.equal(requests.length,2);assert.equal(audio.musicSources.size,2);
  assert.ok([...audio.musicSources].every(voice=>voice.source.starts.length===1));
  const context=contexts[0];audio.dispose();audio.dispose();audio.setEnabled(true);audio.unlock();
  assert.equal(context.closeCalls,1);assert.equal(context.state,'closed');assert.equal(contexts.length,1);assert.equal(audio.musicSources.size,0);
});

test('layered action sources release every gain/filter node and respect mute/background state',async t=>{
  const {contexts}=audioFixture(t),audio=new WorldAudio(true);t.after(()=>audio.dispose());audio.unlock();await audio._musicPromise;
  for(const name of ['boost','cast-start','lumos','page','travel'])audio.play(name);
  const voices=[...audio.voices];assert.ok(voices.length>5&&voices.length<=24,'layering is bounded, not one accidental graph per frame');
  for(const voice of voices)voice.oscillator.end();
  assert.equal(audio.voices.size,0);
  for(const voice of voices)for(const node of [voice.oscillator,voice.gain,voice.filter].filter(Boolean))assert.equal(node.connections.size,0);
  const nodeCount=contexts[0].nodes.length;audio.setEnabled(false);audio.play('boost');audio.setEnabled(true);audio.setSuspended(true);audio.play('page');
  assert.equal(contexts[0].nodes.length,nodeCount,'muted and background requests allocate no action nodes');
  audio.dispose();assert.ok(contexts[0].nodes.every(node=>node.connections.size===0),'disposing detaches the dry, reverb, panner and limiter paths');
});

test('action voice saturation stays bounded and disposal stops every scheduled source',async t=>{
  const {contexts}=audioFixture(t),audio=new WorldAudio(true);audio.unlock();await audio._musicPromise;
  for(let i=0;i<50;i++)audio.play('page');
  assert.equal(audio.voices.size,24);const voices=[...audio.voices];audio.dispose();
  assert.equal(audio.voices.size,0);assert.ok(voices.every(voice=>voice.oscillator.stops.length>=1));
  assert.equal(contexts[0].closeCalls,1);assert.ok(contexts[0].nodes.every(node=>node.connections.size===0));
});

test('a pending resume cannot turn audio back on after a background suspension request',async t=>{
  const {contexts}=audioFixture(t,{deferResume:true}),audio=new WorldAudio(true);t.after(()=>audio.dispose());audio.unlock();await audio._musicPromise;
  const context=contexts[0];assert.ok(context.resumeJobs.length>0);audio.setSuspended(true);context.finishResume();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(audio.suspended,true);assert.equal(context.state,'suspended','the latest background intent must win after asynchronous resume completes');
});

test('rapid opposite requests settle to the latest intent with bounded context operations',async t=>{
  const {contexts,requests}=audioFixture(t,{deferResume:true,deferSuspend:true}),audio=new WorldAudio(true);t.after(()=>audio.dispose());
  audio.unlock();await audio._musicPromise;const context=contexts[0],turn=()=>new Promise(resolve=>setImmediate(resolve));
  context.finishResume();await turn();assert.equal(context.state,'running');
  for(let i=0;i<100;i++){audio.setSuspended(true);audio.setSuspended(false);audio.unlock();}
  assert.equal(context.suspendJobs.length,1,'repeated background requests share the outstanding suspension');
  context.finishSuspend();await turn();assert.equal(context.resumeJobs.length,1,'the latest foreground intent resumes a delayed suspension');
  for(let i=0;i<100;i++){audio.setSuspended(false);audio.setSuspended(true);}
  context.finishResume();await turn();assert.equal(context.suspendJobs.length,1);
  context.finishSuspend();await turn();assert.equal(context.state,'suspended');assert.equal(audio.suspended,true);
  assert.equal(context.resumeCalls,2);assert.equal(context.suspendCalls,2);assert.equal(contexts.length,1);assert.equal(requests.length,2);
  audio.setSuspended(false);assert.equal(context.resumeJobs.length,1);const calls=context.resumeCalls+context.suspendCalls;
  audio.dispose();context.finishResume();await turn();
  assert.equal(context.state,'closed');assert.equal(context.closeCalls,1);assert.equal(context.resumeCalls+context.suspendCalls,calls,'late completion cannot request new context work after disposal');
  assert.equal(contexts.length,1);assert.ok(context.nodes.every(node=>node.connections.size===0));
});

test('a background request suppresses new action nodes while device suspension is pending',async t=>{
  const {contexts}=audioFixture(t,{deferSuspend:true}),audio=new WorldAudio(true);t.after(()=>audio.dispose());
  audio.unlock();await audio._musicPromise;const context=contexts[0],before=context.nodes.length;
  audio.setSuspended(true);assert.equal(context.state,'running','the device has not completed its asynchronous suspension');
  audio.play('page');audio.play('boost');
  assert.equal(context.nodes.length,before,'application background state suppresses new actions immediately');
  context.finishSuspend();await new Promise(resolve=>setImmediate(resolve));
});

test('wind cycles at delivery sample rates have finite energy and no exceptional wrap splice',()=>{
  for(const rate of [44100,48000])for(const duration of [.9,4]){
    const samples=windCycle(rate,duration,197),deltas=[];let power=0;
    assert.equal(samples.length,Math.round(rate*duration));
    for(let i=0;i<samples.length;i++){assert.ok(Number.isFinite(samples[i]));power+=samples[i]**2;if(i)deltas.push(Math.abs(samples[i]-samples[i-1]));}
    const seam=Math.abs(samples[0]-samples.at(-1)),largest=deltas.reduce((maximum,value)=>Math.max(maximum,value),0);
    assert.ok(power/samples.length>.001,'the cycle retains nonzero signal energy');
    assert.ok(seam<=largest,'the wrap step stays within ordinary adjacent-sample steps');
    assert.deepEqual(windCycle(rate,duration,197),samples,'repeated sources reuse a reproducible cycle');
  }
});
