import {WorldAudio} from '../audio.js';

// The soundtrack is the site's existing attributed CC0 score, not historical
// Qing music. An exhibition fountain emitter follows the visited water court.
export function createMuseumAudio({engine=new WorldAudio(false),setTimer=setInterval,clearTimer=clearInterval}={}){
  let disposed=false,enabled=false,emitter=null;
  let frame={night:0,reading:false,position:{x:0,y:0,z:0},camera:{x:0,y:0,z:0},forward:{x:0,y:0,z:-1},speed:0,time:0};
  engine.setVolumes({music:.38,effects:.45});
  function pump(){
    if(disposed)return;
    engine.setEnvironment({night:frame.night,reading:frame.reading,position:frame.position});engine.setListener(frame.camera,frame.forward);engine.update(frame.time,frame.speed);
    const context=engine.context;if(!context||context.state!=='running')return;
    // The portfolio's default fountain is at its own world origin. Override
    // that emitter with this museum court's actual world position.
    if(engine.waterPanner&&emitter)for(const axis of ['x','y','z'])engine.waterPanner[`position${axis.toUpperCase()}`].setTargetAtTime(emitter[axis],context.currentTime,.1);
    engine.waterGain?.gain.setTargetAtTime(emitter?.26:0,context.currentTime,.65);
  }
  // Music continues quietly while reading a long exhibit. Hidden pages suspend
  // their context; this timer cannot resume one without a user gesture.
  const timer=setTimer(pump,500);
  return {
    setEnabled(value){if(disposed)return;enabled=Boolean(value);engine.setEnabled(enabled);if(enabled)engine.unlock();},
    unlock(){if(!disposed)return engine.unlock();},
    setSuspended(value){if(!disposed)engine.setSuspended(value);},
    setEmitter(position){emitter=position?{...position}:null;},
    update(value){frame={...frame,...value};pump();},
    play(name){if(!disposed)engine.play(name);},
    companion(event,options){if(!disposed)engine.playCompanion(event,options);},
    silence(owner){engine.cancelCompanionVoices(owner);},
    snapshot(){return {enabled,contextState:engine.context?.state||'idle',musicStatus:engine.musicStatus,emitter};},
    dispose(){if(disposed)return;disposed=true;clearTimer(timer);engine.dispose();},
  };
}
