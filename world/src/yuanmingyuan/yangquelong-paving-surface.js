import {prepareYangquelongSurface} from './yangquelong-surface.js';
import {createYangquelongMaterialCandidate} from './yangquelong-materials.js';
import {bindYangquelongPaving,yangquelongPavingSpec} from './yangquelong-paving-material.js';

/** Same full source, accepted stone/glaze and soil owners. The only new
 * binding happens before ground records its paving material identity. */
export async function prepareYangquelongPavingSurface(options={}){
 const createView=options.createMaterialView??createYangquelongMaterialCandidate;
 let paving;
 const owner=await prepareYangquelongSurface({...options,createMaterialView(args){
  const view=createView(args);let disposed=false,cleanupError=null;
  try{paving=bindYangquelongPaving({owner:view,signal:args.signal});}
  catch(error){try{view.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Paving material-view preparation failed',{cause:error});}throw error;}
  function dispose(){
   if(disposed)return;disposed=true;const errors=[];
   for(const handle of [paving,view])try{handle.dispose();}catch(error){errors.push(error);}
   if(errors.length){cleanupError=new AggregateError(errors,'Paving material-view release failed');throw cleanupError;}
  }
  return {...view,diagnostics:{...view.diagnostics,paving:paving.diagnostics},
   update(time){paving.assertCurrent();view.update?.(time);},dispose,
   async whenIdle(){const errors=[];for(const handle of [paving,view])try{await handle.whenIdle?.();}catch(error){errors.push(error);}if(cleanupError)errors.push(cleanupError);if(errors.length)throw new AggregateError(errors,'Paving material-view idle failed');},
   get disposed(){return disposed||view.disposed||paving.disposed;},get cleanupError(){return cleanupError??paving.cleanupError??view.cleanupError;},
  };
 }});
 // Keep the base surface identity and exact population contract. This is an
 // additional material hypothesis, never a fabricated new full-factory proof.
 owner.diagnostics.pavingRefinement=paving.diagnostics;
 owner.diagnostics.evidence.push({type:'contemporary-exhibition-design',scope:'outer court slab response',historicallySurveyed:false});
 owner.diagnostics.uncertainty.push('The outer paving slab grid, finish and colour are contemporary exhibition choices, pending native review.');
 owner.group.userData.pavingRefinement=yangquelongPavingSpec.id;
 function assertCurrent(){
  try{owner.assertCurrent();paving.assertCurrent();return true;}
  catch(error){try{owner.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Refined surface invalidation failed',{cause:error});}throw error;}
 }
 return {...owner,pavingBinding:paving,assertCurrent,
  update(time){assertCurrent();owner.update(time);},
  get disposed(){return owner.disposed;},get cleanupError(){return owner.cleanupError;},
 };
}
