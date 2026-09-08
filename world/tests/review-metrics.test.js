import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFrames,ReviewMetrics,evidenceFilename} from '../src/review-metrics.js';

test('review statistics retain slow frames and reject unavailable samples',()=>{
  const summary=summarizeFrames([16,16,16,16,100,NaN,null,-1]);
  assert.equal(summary.count,5);assert.equal(summary.mean,32.8);assert.equal(summary.p95,100);assert.equal(summary.p50,16);
  assert.ok(Math.abs(summary.fps-30.4878)<.001);
  assert.equal(summarizeFrames([]).fps,null);
});

test('evidence filenames retain conditions and remain unique within one timestamp',()=>{
  const metadata={build:'338d112-baseline',view:'bridge',timeOfDay:'night',quality:'high',foliage:'full'},at=new Date('2026-09-08T03:04:05.123Z');
  const first=evidenceFilename(metadata,'metrics','json',at),second=evidenceFilename(metadata,'metrics','json',at);
  assert.match(first,/^338d112-baseline-bridge-night-high-full-native-metrics-20260908T030405123Z-\d+\.json$/);
  assert.notEqual(first,second);
  assert.notEqual(first,evidenceFilename({...metadata,quality:'low'},'frame','png',at));
  assert.match(evidenceFilename({...metadata,sampling:'2.5x'},'frame','png',at),/high-full-2-5x-frame-/);
});

function fixture({extension=true}={}){
  const queries=[],deleted=[],ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};let disjoint=false;
  const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>extension?ext:null,isContextLost:()=>false,getParameter:()=>disjoint,
    createQuery(){const query={available:false,result:2500000};queries.push(query);return query;},beginQuery(){},endQuery(){},
    getQueryParameter(query,parameter){if(parameter===this.QUERY_RESULT_AVAILABLE)return query.available;assert.equal(query.available,true,'GPU time must never be read before availability');return query.result;},
    deleteQuery:query=>deleted.push(query)};
  const renderer={getContext:()=>gl,info:{render:{calls:45,triangles:900},memory:{geometries:3,textures:4}}};
  return {metrics:new ReviewMetrics(renderer),queries,deleted,setDisjoint:value=>{disjoint=value;}};
}
function sample(metrics,at=0){const query=metrics.before(at);metrics.after(query,1,{near:3,mid:5,far:8});return query;}

test('GPU queries are collected after sampling stops without adding CPU frames',()=>{
  const {metrics,queries,deleted}=fixture();metrics.start();sample(metrics);metrics.active=false;queries[0].available=true;
  assert.equal(metrics.before(20),null);
  const result=metrics.result();assert.equal(result.gpuMs.count,1);assert.equal(result.gpuMs.mean,2.5);assert.equal(result.renderSubmitCpuMs.count,1);assert.equal(result.gpuQueries.pending,0);assert.equal(deleted.length,1);
});

test('GPU finalization yields while pending and drains the final available sample',async()=>{
  const {metrics,queries}=fixture();metrics.start();sample(metrics);let clock=0,waits=0;
  const report=await metrics.finalize({timeoutMs:100,pollIntervalMs:16,now:()=>clock,wait:async ms=>{waits++;clock+=ms;queries[0].available=true;}});
  assert.equal(waits,1);assert.equal(metrics.active,false);assert.equal(report.gpuQueries.pendingAtStop,1);assert.equal(report.gpuQueries.collected,1);assert.equal(report.gpuQueries.tailTimedOut,false);
});

test('GPU finalization abandons unavailable queries at the bounded deadline',async()=>{
  const {metrics,deleted}=fixture();metrics.start();sample(metrics);sample(metrics,16);let clock=0;
  const report=await metrics.finalize({timeoutMs:30,pollIntervalMs:16,now:()=>clock,wait:async ms=>{clock+=ms;}});
  assert.equal(clock,30);assert.equal(report.gpuQueries.pending,0);assert.equal(report.gpuQueries.abandoned,2);assert.equal(report.gpuQueries.tailTimedOut,true);assert.equal(deleted.length,2);
});

test('disjoint and unavailable GPU timers are reported separately from CPU submission',async()=>{
  const disjoint=fixture();disjoint.metrics.start();sample(disjoint.metrics);disjoint.setDisjoint(true);
  const report=await disjoint.metrics.finalize();assert.equal(report.gpuQueries.disjointEvents,1);assert.equal(report.gpuQueries.abandoned,1);assert.equal(report.gpuMs.count,0);assert.equal(report.renderSubmitCpuMs.count,1);
  const unavailable=fixture({extension:false});unavailable.metrics.start();sample(unavailable.metrics);
  const other=await unavailable.metrics.finalize();assert.equal(other.gpuTimerAvailable,false);assert.equal(other.gpuMs,null);assert.equal(other.renderSubmitCpuMs.count,1);
});
