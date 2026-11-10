import {fetchPublicAsset} from '../public-asset-url.js';

// Synthesised sound for the lean Academy: wind that follows speed, chimes that
// climb with a ring chain, pickups that rise with the combo. Optional music uses
// the existing CC0 academy track. Nothing loads until sound is enabled.

const PENTATONIC=[0,2,4,7,9,12,14,16,19,21,24];
const note=(base,step)=>base*Math.pow(2,PENTATONIC[Math.min(PENTATONIC.length-1,step)]/12);

export function createSfx({enabled=false,music=.5,effects=.65}={}){
  let ctx=null,master=null,fxBus=null,musicBus=null,wind=null,windFilter=null,windGain=null,musicSource=null,musicBuffer=null,musicLoading=false;
  const state={enabled,music,effects,suspended:false,status:'muted'};
  function ensure(){
    if(ctx||!state.enabled)return ctx;
    const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC){state.status='unavailable';return null;}
    try{ctx=new AC();}catch{state.status='unavailable';return null;}
    master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
    fxBus=ctx.createGain();fxBus.gain.value=state.effects;fxBus.connect(master);
    musicBus=ctx.createGain();musicBus.gain.value=state.music*.55;musicBus.connect(master);
    // Wind: looping filtered noise.
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
    let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.06)/1.06;data[i]=last*3.2;}
    wind=ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;
    windFilter=ctx.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=400;windFilter.Q.value=.7;
    windGain=ctx.createGain();windGain.gain.value=0;wind.connect(windFilter).connect(windGain).connect(fxBus);wind.start();
    state.status='ready';
    return ctx;
  }
  async function loadMusic(){
    if(musicBuffer||musicLoading||!ctx)return;musicLoading=true;
    try{
      const response=await fetchPublicAsset('/audio/academy/night-theme.mp3');if(!response.ok)throw new Error(String(response.status));
      musicBuffer=await ctx.decodeAudioData(await response.arrayBuffer());startMusic();
    }catch{/* Music is optional; effects keep working. */}finally{musicLoading=false;}
  }
  function startMusic(){
    if(!ctx||!musicBuffer||musicSource)return;
    musicSource=ctx.createBufferSource();musicSource.buffer=musicBuffer;musicSource.loop=true;musicSource.connect(musicBus);musicSource.start();
  }
  function tone(freq,{dur=.25,type='sine',vol=.25,attack=.005,end=freq,delay=0,bus=fxBus}={}){
    if(!ctx||state.suspended)return;
    const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(end!==freq)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(bus);o.start(t);o.stop(t+dur+.05);
  }
  function noiseBurst({dur=.2,vol=.3,freq=1200,q=1,delay=0,type='bandpass'}={}){
    if(!ctx||state.suspended)return;
    const t=ctx.currentTime+delay,len=Math.ceil(ctx.sampleRate*dur),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.value=vol;
    s.connect(f).connect(g).connect(fxBus);s.start(t);
  }
  const sounds={
    ring({chain=1,perfect=false}){const base=523.25,s=Math.min(9,chain-1);tone(note(base,s),{dur:.5,type:'triangle',vol:.22});tone(note(base,s)*2,{dur:.35,vol:.08,delay:.02});if(perfect)tone(note(base,s+2)*2,{dur:.45,type:'sine',vol:.1,delay:.06});},
    stardust({combo=1}){tone(note(880,Math.min(10,combo-1)),{dur:.12,type:'sine',vol:.09});},
    shard(){[0,4,7,12].forEach((st,i)=>tone(523.25*Math.pow(2,st/12),{dur:.6,type:'triangle',vol:.14,delay:i*.07}));},
    boost(){noiseBurst({dur:.45,vol:.25,freq:900,q:.6,type:'lowpass'});tone(140,{dur:.4,type:'sawtooth',vol:.04,end:280});},
    roll(){noiseBurst({dur:.28,vol:.22,freq:1800,q:.8});},
    cast(){tone(1320,{dur:.16,type:'square',vol:.035,end:660});tone(990,{dur:.12,vol:.06});},
    hitWisp(){tone(330,{dur:.12,type:'square',vol:.05,end:220});},
    banish(){[0,7,12,19].forEach((st,i)=>tone(659.25*Math.pow(2,st/12),{dur:.3,type:'sine',vol:.08,delay:i*.045}));noiseBurst({dur:.3,vol:.12,freq:3000,q:.5});},
    hurt(){tone(110,{dur:.35,type:'sawtooth',vol:.12,end:55});noiseBurst({dur:.25,vol:.3,freq:400,q:.7,type:'lowpass'});},
    bump(){tone(90,{dur:.22,type:'triangle',vol:.22,end:50});noiseBurst({dur:.15,vol:.2,freq:300,type:'lowpass'});},
    scrape(){noiseBurst({dur:.3,vol:.18,freq:600,q:.4,type:'lowpass'});},
    tick(){tone(660,{dur:.12,type:'square',vol:.05});},
    go(){[0,4,7].forEach(st=>tone(523.25*Math.pow(2,st/12)*2,{dur:.5,type:'triangle',vol:.1}));},
    lowTime(){tone(880,{dur:.08,type:'square',vol:.04});tone(880,{dur:.08,type:'square',vol:.04,delay:.15});},
    finish({medal}){const steps=medal==='gold'?[0,4,7,12,16,19]:medal==='silver'?[0,4,7,12]:[0,4,7];steps.forEach((st,i)=>tone(392*Math.pow(2,st/12),{dur:.7,type:'triangle',vol:.13,delay:i*.09}));},
    fail(){[7,4,0].forEach((st,i)=>tone(392*Math.pow(2,st/12),{dur:.5,type:'triangle',vol:.1,delay:i*.12}));},
    discover(){[0,7,12].forEach((st,i)=>tone(440*Math.pow(2,st/12),{dur:.8,type:'sine',vol:.08,delay:i*.12}));},
    gate(){tone(392,{dur:.9,type:'triangle',vol:.12,end:784});},
    ui(){tone(1046,{dur:.06,type:'sine',vol:.05});},
  };
  return {
    get status(){return state.enabled?state.status:'muted';},
    get enabled(){return state.enabled;},
    unlock(){if(!state.enabled)return;ensure();if(ctx?.state==='suspended')ctx.resume().catch(()=>{});if(ctx&&state.music>0)loadMusic();},
    setEnabled(value){state.enabled=Boolean(value);if(state.enabled){this.unlock();}else if(ctx){ctx.suspend().catch(()=>{});}},
    setSuspended(value){state.suspended=Boolean(value);if(!ctx)return;if(state.suspended)ctx.suspend().catch(()=>{});else if(state.enabled)ctx.resume().catch(()=>{});},
    setVolumes({music=state.music,effects=state.effects}={}){state.music=music;state.effects=effects;if(fxBus)fxBus.gain.value=effects;if(musicBus)musicBus.gain.value=music*.55;if(music>0)loadMusic();},
    play(name,options={}){if(!state.enabled||!ctx||state.suspended)return;sounds[name]?.(options);},
    update(speed,boosting,dt){
      if(!ctx||!windGain)return;const target=state.suspended?0:Math.min(.32,Math.max(0,(speed-6)/50)*.28+(boosting?.06:0));
      windGain.gain.setTargetAtTime(target,ctx.currentTime,.12);windFilter.frequency.setTargetAtTime(250+speed*28+(boosting?600:0),ctx.currentTime,.15);
    },
    dispose(){try{musicSource?.stop();wind?.stop();ctx?.close();}catch{/* already closed */}ctx=null;},
  };
}
