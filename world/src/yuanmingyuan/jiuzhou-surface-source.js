import {prepareJiuzhouLandscapeSource} from './jiuzhou-landscape-source.js';
import {applyJiuzhouBuildingSurface} from './jiuzhou-building-surface.js';

// One owned landscape/source, with a synchronous borrowed building finish.
// Keep the caller's abort away from the underlying source until its finish
// and any outer composition navigation borrowers have been released.
export async function prepareJiuzhouSurfaceSource({signal,prepareLandscape=prepareJiuzhouLandscapeSource}={}){
  signal?.throwIfAborted();
  const lifetime=new AbortController(),errors=[];
  let landscape=null,surface=null,disposed=false,released=false,applying=false;
  const run=fn=>{try{fn();}catch(error){errors.push(error);}};
  function dispose(){
    disposed=true;signal?.removeEventListener('abort',abort);
    // A source material's synchronous clone/event callback can abort during
    // installation. Adopt the returned finish before releasing its source.
    if(applying||released)return;
    released=true;
    if(surface)run(()=>surface.dispose());
    if(landscape)run(()=>landscape.dispose());
    run(()=>lifetime.abort(signal?.reason));
    if(errors.length)throw new AggregateError([...errors],'Jiuzhou building/ground cleanup failed.');
  }
  const abort=()=>{try{dispose();}catch{/* retained for owner/caller inspection */}};
  signal?.addEventListener('abort',abort,{once:true});
  function assertBinding(){
    if(disposed)throw new Error('Jiuzhou building surface source was disposed.');
    surface.assertCurrent();landscape.assertBinding();
  }
  try{
    const acquired=await prepareLandscape({signal:lifetime.signal});
    if(disposed){
      run(()=>acquired?.dispose?.());
      throw signal?.reason??new DOMException('Jiuzhou surface source disposed','AbortError');
    }
    landscape=acquired;
    if(!landscape?.group?.isGroup||landscape.disposed||typeof landscape.dispose!=='function'||typeof landscape.assertBinding!=='function')throw new Error('A live Jiuzhou landscape owner is required.');
    applying=true;
    try{surface=applyJiuzhouBuildingSurface({group:landscape.group});}
    finally{applying=false;}
    if(disposed){dispose();throw signal?.reason??new DOMException('Jiuzhou surface source disposed','AbortError');}
    assertBinding();
    return {
      group:landscape.group,collisionGroup:landscape.collisionGroup,
      sourceOwner:landscape.sourceOwner,landscapeOwner:landscape,
      material:landscape.material,field:landscape.field,
      diagnostics:{...landscape.diagnostics,buildingSurface:surface.diagnostics},
      // The enclosing composition must release guides/support before this
      // owner. Propagate update/guard errors without self-disposal here.
      update(time){assertBinding();landscape.update?.(time);},
      assertBinding,dispose,get disposed(){return disposed;},
      get cleanupErrors(){return [...errors];},
    };
  }catch(error){
    try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou surface preparation and cleanup failed.',{cause:error});}
    if(errors.length)throw new AggregateError([error,...errors],'Jiuzhou surface preparation failed.',{cause:error});
    throw error;
  }
}
