const approach=(value,target,rate,dt)=>{
  const next=value+(target-value)*(1-Math.exp(-rate*dt));
  return Math.abs(next-target)<.0001?target:next;
};

/** Event-driven motion. Elapsed wall time never determines an exhibit pose. */
export class ExhibitMotion{
  constructor(){this.values={focus:0,open:0,media:0,pulse:0};this.targets={focus:0,open:0,media:0};this.lastTime=null;}
  set(channel,value,reduced=false){this.targets[channel]=value;if(reduced)this.values[channel]=value;return this.snapshot();}
  media(index,count,reduced=false){this.set('media',count>1?index/(count-1):0,reduced);}
  loaded(reduced=false){this.values.pulse=reduced?0:1;}
  update(time,dt,reduced=false){
    let elapsed=Number.isFinite(dt)?dt:(this.lastTime===null?0:time-this.lastTime);
    if(Number.isFinite(time))this.lastTime=time;
    // Paused updates (dt = 0) and gaps after background suspension do no work.
    elapsed=Number.isFinite(elapsed)&&elapsed>0&&elapsed<=.25?Math.min(elapsed,.05):0;
    if(reduced){Object.assign(this.values,this.targets,{pulse:0});return this.snapshot();}
    for(const channel of ['focus','open','media'])this.values[channel]=approach(this.values[channel],this.targets[channel],channel==='open'?6:8,elapsed);
    this.values.pulse=approach(this.values.pulse,0,5,elapsed);return this.snapshot();
  }
  snapshot(){return {...this.values};}
}
