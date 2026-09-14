// Review telemetry only: call rendered() after a successful render, never at
// selection time. Keep the previous successful frame to bracket each switch.
export function createDistanceApproachTrace({maximumSwitches=32}={}){
  if(!Number.isInteger(maximumSwitches)||maximumSwitches<1||maximumSwitches>256)throw new Error('Invalid approach trace capacity');
  let run=null,serial=0;
  return {
    begin({nowMilliseconds,fromMetres,toMetres,durationMilliseconds}){
      run={runId:++serial,status:'running',reason:null,clock:'performance.now milliseconds; frames stamped after successful render',startedAtMilliseconds:nowMilliseconds,endedAtMilliseconds:null,requested:{fromMetres,toMetres,durationMilliseconds},maximumSwitches,renderedFrames:0,totalSwitches:0,droppedSwitches:0,initialFrame:null,lastFrame:null,switches:[]};
    },
    rendered({nowMilliseconds,...frame}){
      if(!run||run.status!=='running')return;
      const sample={...structuredClone(frame),renderedAtMilliseconds:nowMilliseconds,elapsedMilliseconds:nowMilliseconds-run.startedAtMilliseconds},previous=run.lastFrame;
      run.renderedFrames++;run.initialFrame??=sample;
      if(previous&&previous.representation!==sample.representation){
        run.totalSwitches++;run.switches.push({from:previous.representation,to:sample.representation,previousFrame:previous,...sample});
        if(run.switches.length>maximumSwitches){run.switches.shift();run.droppedSwitches++;}
      }
      run.lastFrame=sample;
    },
    stop(reason,nowMilliseconds){
      if(!run||run.status!=='running')return;
      run.status=reason==='completed'?'completed':'stopped';run.reason=reason;run.endedAtMilliseconds=nowMilliseconds;
    },
    snapshot(){return structuredClone(run);}
  };
}
