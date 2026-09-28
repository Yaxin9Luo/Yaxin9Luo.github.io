import {prepareJiuzhouSurfaceSource} from './jiuzhou-surface-source.js';
import {loadJiuzhouCourtyardMaps} from './jiuzhou-courtyard-materials.js';
import {applyJiuzhouCourtyardSurface} from './jiuzhou-courtyard-surface.js';

/** One existing complete source; the new lease releases before its borrowed finish/maps. */
export async function prepareJiuzhouCourtyardSource({signal,prepareSource=prepareJiuzhouSurfaceSource,loadMaps=loadJiuzhouCourtyardMaps,applySurface=applyJiuzhouCourtyardSurface}={}){
 signal?.throwIfAborted();
 const lifetime=new AbortController(),errors=[];
 let source=null,maps=null,surface=null,disposed=false,released=false,applying=false;
 const run=fn=>{try{fn();}catch(error){errors.push(error);}};
 function dispose(){
  disposed=true;signal?.removeEventListener('abort',abort);
  if(!applying&&!released){
   released=true;
   if(surface)run(()=>surface.dispose());
   if(source)run(()=>source.dispose());
   if(maps)run(()=>maps.dispose());
   run(()=>lifetime.abort(signal?.reason));
  }
  if(errors.length)throw new AggregateError([...errors],'Jiuzhou courtyard source cleanup failed');
 }
 const abort=()=>{try{dispose();}catch{/* Retained until explicit disposal/caller inspection. */}};
 signal?.addEventListener('abort',abort,{once:true});
 const adopt=value=>{
  if(disposed){run(()=>value?.dispose?.());throw signal?.reason??new DOMException('Jiuzhou courtyard source aborted','AbortError');}
  return value;
 };
 const assertBinding=()=>{
  if(disposed)throw new Error('Jiuzhou courtyard source disposed');
  surface.assertCurrent();source.assertBinding();
 };
 try{
  maps=adopt(await loadMaps({signal:lifetime.signal}));
  source=adopt(await prepareSource({signal:lifetime.signal}));
  if(!source?.group?.isGroup||source.disposed||typeof source.assertBinding!=='function'||typeof source.dispose!=='function')throw new Error('An existing Jiuzhou surface source owner is required');
  applying=true;
  try{surface=applySurface({group:source.group,mapOwner:maps});}finally{applying=false;}
  if(disposed){dispose();throw signal?.reason??new DOMException('Jiuzhou courtyard source aborted','AbortError');}
  assertBinding();
  return {
   group:source.group,collisionGroup:source.collisionGroup,sourceOwner:source.sourceOwner,
   landscapeOwner:source.landscapeOwner,material:source.material,field:source.field,
   diagnostics:{...source.diagnostics,courtyardSurface:surface.diagnostics,courtyardMaps:maps.files},
   update(time){
    if(disposed)throw new Error('Jiuzhou courtyard source disposed');
    surface.assertCurrent();
    if(source.update==null)source.assertBinding();else{
     if(prepareSource!==prepareJiuzhouSurfaceSource)source.assertBinding();
     source.update(time);
    }
   },
   assertBinding,dispose,get disposed(){return disposed;},get cleanupErrors(){return [...errors];}
  };
 }catch(error){
  try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou courtyard preparation failed',{cause:error});}
  throw error;
 }
}
