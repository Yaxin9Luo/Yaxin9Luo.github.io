import assert from 'node:assert/strict';
import {test} from 'node:test';
import {COMPANION_FOLEY_KINDS,createCompanionFoley,createCompanionFoleyBuffer,companionFoleyGain} from '../src/companion-foley.js';

test('original samples are deterministic, distinct, finite, quiet and close both waveform ends',()=>{
  for(const rate of [44100,48000,96000])for(const kind of COMPANION_FOLEY_KINDS)for(let variant=0;variant<4;variant++){
    const a=createCompanionFoley(kind,rate,variant),b=createCompanionFoley(kind,rate,variant);
    assert.ok(a.length>rate*.1&&a.length<rate,'short material foley, not empty data');assert.deepEqual(a,b);
    assert.notDeepEqual(a,createCompanionFoley(kind,rate,(variant+1)%4));
    let peak=0,power=0,mean=0;
    for(const value of a){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));power+=value*value;mean+=value;}
    assert.ok(peak>.04&&peak<.31);assert.ok(Math.sqrt(power/a.length)>.002);
    assert.ok(Math.abs(mean/a.length)<.001);assert.ok(a[0]===0&&a.at(-1)===0);
  }
});

test('the runtime buffer receives exactly the audition samples at the supplied context rate',()=>{
  const context={sampleRate:44100,createBuffer(channels,length,sampleRate){
    assert.equal(channels,1);assert.equal(sampleRate,this.sampleRate);
    const data=new Float32Array(length);return {sampleRate,length,numberOfChannels:channels,getChannelData:()=>data,copyToChannel:source=>data.set(source)};
  }};
  for(const kind of COMPANION_FOLEY_KINDS){
    const buffer=createCompanionFoleyBuffer(context,kind,2);
    assert.ok(buffer,'supplied effects context owns the buffer');
    assert.deepEqual(buffer.getChannelData(0),createCompanionFoley(kind,44100,2));
    buffer.getChannelData(0).fill(0);
    assert.ok(createCompanionFoley(kind,44100,2).some(v=>v!==0),'one voice cannot mutate a future sample');
  }
});

test('invalid kinds, variants and sample rates cannot allocate malformed audio',()=>{
  for(const args of [['copied-theme',48000,0],['dog-step',8000,0],['dog-step',NaN,0],['dog-step',48000,-1],['dog-step',48000,4],['dog-step',48000,.5]])assert.throws(()=>createCompanionFoley(...args),RangeError);
  assert.throws(()=>createCompanionFoleyBuffer(null,'dog-step'),TypeError);
});

test('distance attenuation is bounded, falls smoothly and silences distant or invalid events',()=>{
  assert.equal(companionFoleyGain(0),1);
  let previous=1;
  for(const d of [1,3,5,8,12,16,17.9]){const gain=companionFoleyGain(d);assert.ok(gain>0&&gain<previous);previous=gain;}
  for(const d of [18,100,NaN,Infinity,-1])assert.equal(companionFoleyGain(d),0);
});
