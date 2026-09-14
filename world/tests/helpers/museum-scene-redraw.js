import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createMuseumPausedRedraw} from '../../src/yuanmingyuan/museum-paused-redraw.js';

export function createTestFrames(){
  let next=1;const queued=new Map(),all=new Map(),cancelled=[];
  return {request(callback){const id=next++;queued.set(id,callback);all.set(id,callback);return id;},
    cancel(id){queued.delete(id);cancelled.push(id);},
    step(now=1000){const jobs=[...queued];queued.clear();for(const [,callback] of jobs)callback(now);},
    late(id){all.get(id)?.(2000);},clear(){queued.clear();},
    get pending(){return [...queued.values()];},get ids(){return [...queued.keys()];},cancelled};
}

// Existing VM fixtures omit page bootstrap. Install the page's actual redraw
// initializer, with only RAF scheduling injected. Never make request() flush.
export function installSceneRedraw(context,source,{frames=createTestFrames()}={}){
  const start=source.indexOf('const redraw=createMuseumPausedRedraw({'),end=source.indexOf('\nconst touch=',start);
  assert.ok(start>=0&&end>start,'actual page redraw initializer exists');
  for(const [key,value] of Object.entries({ready:true,loading:false,disposed:false,contextLost:false,reviewPaused:true,capturing:false}))if(context[key]===undefined)context[key]=value;
  context.document??={};context.document.hidden??=false;context.query??=new URLSearchParams('review=still');
  context.paused??=()=>context.disposed||context.contextLost||context.document.hidden||!context.ready||context.loading||context.capturing||context.reviewPaused;
  context.requestAnimationFrame=callback=>frames.request(callback);context.cancelAnimationFrame=id=>frames.cancel(id);
  context.createMuseumPausedRedraw=options=>createMuseumPausedRedraw({...options,requestFrame:context.requestAnimationFrame,cancelFrame:context.cancelAnimationFrame});
  vm.runInContext(source.slice(start,end)+'\nthis.redraw=redraw;',context);
  return {redraw:context.redraw,frames,isPaused:vm.runInContext('paused',context),dispose(){context.redraw.dispose();frames.clear();}};
}
