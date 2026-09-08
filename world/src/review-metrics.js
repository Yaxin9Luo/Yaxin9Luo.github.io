/** Explicit, opt-in review measurements. Never changes render quality. */
export function summarizeFrames(frames) {
  const values=frames.filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
  if(!values.length)return {count:0,mean:null,p50:null,p95:null,p99:null,fps:null};
  const mean=values.reduce((sum,n)=>sum+n,0)/values.length;
  const percentile=p=>values[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
  return {count:values.length,mean,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),fps:1000/mean};
}

let evidenceSequence=0;
export function evidenceFilename(metadata,kind,extension,at=new Date()) {
  const clean=(value,max=24)=>String(value||'unknown').replace(/[^a-z0-9_-]+/gi,'-').slice(0,max);
  const timestamp=at.toISOString().replace(/[-:.]/g,'');
  return [clean(metadata.build),clean(metadata.view,16),clean(metadata.timeOfDay,12),clean(metadata.quality,12),clean(metadata.foliage,8),clean(metadata.sampling||'native',8),clean(kind,12),timestamp,++evidenceSequence].join('-')+'.'+clean(extension,5);
}

export class ReviewMetrics {
  constructor(renderer) {
    this.renderer=renderer;this.gl=renderer.getContext();
    this.extension=this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending=[];this.reset();
  }
  reset() {
    this.frames=[];this.cpu=[];this.gpu=[];this.samples=[];this.last=null;this.active=false;
    for(const query of this.pending)this.gl.deleteQuery(query);
    this.pending.length=0;
    this.issued=0;this.abandoned=0;this.disjointEvents=0;this.pendingAtStop=0;this.tailTimedOut=false;
  }
  start() {this.reset();this.active=true;}
  pollGPU() {
    if(!this.extension||!this.pending.length)return;
    const gl=this.gl,ext=this.extension;
    if(gl.isContextLost?.()||gl.getParameter(ext.GPU_DISJOINT_EXT)){
      this.disjointEvents++;this.abandonPending();return;
    }
    while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){
      const query=this.pending.shift();this.gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
    }
  }
  abandonPending() {
    this.abandoned+=this.pending.length;
    for(const query of this.pending)this.gl.deleteQuery(query);
    this.pending.length=0;
  }
  before(now) {
    this.pollGPU();
    if(!this.active)return null;
    if(this.last!==null)this.frames.push(now-this.last);
    this.last=now;
    if(this.extension){
      const gl=this.gl,ext=this.extension;
      if(!gl.isContextLost?.()&&!gl.getParameter(ext.GPU_DISJOINT_EXT)&&this.pending.length<6){const query=gl.createQuery();if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);this.issued++;return query;}}
    }
    return null;
  }
  after(query,cpu,scene={}) {
    if(query){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(query);}
    if(!this.active)return;
    this.cpu.push(cpu);
    const {render,memory}=this.renderer.info;
    this.samples.push({calls:render.calls,triangles:render.triangles,geometries:memory.geometries,textures:memory.textures,...scene});
  }
  async finalize({timeoutMs=500,pollIntervalMs=16,now=()=>performance.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
    this.active=false;this.pendingAtStop=this.pending.length;
    const deadline=now()+Math.max(0,timeoutMs);
    this.pollGPU();
    while(this.pending.length&&now()<deadline){
      await wait(Math.min(pollIntervalMs,Math.max(0,deadline-now())));
      this.pollGPU();
    }
    if(this.pending.length){this.tailTimedOut=true;this.abandonPending();}
    return this.result();
  }
  result() {
    this.pollGPU();
    const mean=key=>this.samples.length?this.samples.reduce((sum,s)=>sum+(s[key]||0),0)/this.samples.length:null;
    return {framesMs:summarizeFrames(this.frames),renderSubmitCpuMs:summarizeFrames(this.cpu),gpuMs:this.extension?summarizeFrames(this.gpu):null,
      gpuTimerAvailable:Boolean(this.extension),gpuQueries:{issued:this.issued,collected:this.gpu.length,pending:this.pending.length,pendingAtStop:this.pendingAtStop,abandoned:this.abandoned,disjointEvents:this.disjointEvents,tailTimedOut:this.tailTimedOut},meanDrawCalls:mean('calls'),meanSubmittedTriangles:mean('triangles'),last:this.samples.at(-1)||null,
      note:'Composer totals include shadows, reflection and postprocessing. CPU submission is not GPU time. Geometry/texture values are counts, not memory bytes.'};
  }
  dispose(){this.reset();}
}
