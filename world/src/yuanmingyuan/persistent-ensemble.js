import {Group} from 'three';
import {createArchitectureSurface} from './architecture-surface.js';
import {createArchitectureEnsemble} from './architecture-ensemble.js';

const abortReason=signal=>signal.reason??new DOMException('Ensemble request aborted','AbortError');
function waitFor(promise,signal){
  if(!signal)return promise;
  if(signal.aborted)return Promise.reject(abortReason(signal));
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(abortReason(signal));};signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}

// load transfers an unattached full owner. place is the caller's synchronous
// reviewed placement operation, before source BVHs are built. This module does
// not decide archive/native admission, texture treatment or historical layout.
export function createPersistentEnsemble({root,descriptors,load,place,signal}={}){
  if(!root?.isObject3D||!Array.isArray(descriptors)||!descriptors.length||descriptors.some(d=>typeof d?.id!=='string'||!d.id)||new Set(descriptors.map(d=>d.id)).size!==descriptors.length||typeof load!=='function'||typeof place!=='function')
    throw new Error('Persistent ensemble requires a root, unique descriptors, loader and synchronous placement callback.');
  const definitions=[...descriptors],byId=new Map(definitions.map(d=>[d.id,d])),controller=new AbortController(),staged=[],summaries=[],owners=new WeakMap(),records=new Map(),errors=[];
  const group=new Group();group.name='Persistent architectural ensemble';group.visible=false;
  let disposed=false,status='idle',loadingId=null,operation=null,aggregate=null;
  const note=error=>errors.push({name:error?.name??'Error',message:error?.message??String(error)});
  function releaseRecord(record){
    if(record.released)return [];record.released=true;const failures=[];
    for(const release of [()=>record.support?.dispose(),()=>record.owner.group?.removeFromParent(),()=>record.owner.dispose?.()])try{release();}catch(error){failures.push(error);note(error);}
    Object.assign(record.summary,{ready:false,released:true,supportDisposed:record.support?.disposed??null});return failures;
  }
  function cleanup(){
    const failures=[];records.clear();const previous=aggregate;aggregate=null;
    if(previous)try{previous.dispose();}catch(error){failures.push(error);note(error);}
    for(const record of staged.splice(0))failures.push(...releaseRecord(record));
    try{group.removeFromParent();}catch(error){failures.push(error);note(error);}group.visible=false;return failures;
  }
  function prepare(){
    if(disposed)return Promise.reject(abortReason(controller.signal));
    if(operation)return operation;
    status='loading';
    operation=(async()=>{
      try{
        root.add(group);
        for(const descriptor of definitions){
          controller.signal.throwIfAborted();loadingId=descriptor.id;
          const owner=await load(descriptor,{signal:controller.signal});
          if(!owner||typeof owner!=='object')throw new Error(`Ensemble ${descriptor.id} did not return an owner.`);
          if(owners.has(owner))throw new Error('Each ensemble descriptor must return a distinct owner.');
          const summary={id:descriptor.id,ready:false,borrowers:0,released:false,supportDisposed:null},record={descriptor,owner,support:null,summary,released:false};summaries.push(summary);owners.set(owner,record);staged.push(record);
          controller.signal.throwIfAborted();
          if(!owner.group?.isObject3D||owner.group.parent||typeof owner.dispose!=='function'||owner.disposed)throw new Error(`Ensemble ${descriptor.id} requires a live unattached full owner.`);
          const result=place(owner,descriptor);if(result?.then)throw new Error('Ensemble placement must be synchronous.');
          controller.signal.throwIfAborted();group.add(owner.group);owner.group.updateWorldMatrix(true,true);
          const source=owner.collisionGroup??owner.group;
          if(!source?.isObject3D)throw new Error(`Ensemble ${descriptor.id} has no source collision group.`);
          source.updateWorldMatrix(true,true);
          if(!source.matrixWorld.elements.every(Number.isFinite)||!owner.group.matrixWorld.elements.every(Number.isFinite))throw new Error('Ensemble world transforms must be finite.');
          if(source!==owner.group&&source.matrixWorld.elements.some((value,i)=>Math.abs(value-owner.group.matrixWorld.elements[i])>1e-7))throw new Error('Rendered and source collision roots must share the placed world transform.');
          record.support=createArchitectureSurface(source,{signal:controller.signal});controller.signal.throwIfAborted();
          if(!record.support.diagnostics.primitiveCount)throw new Error(`Ensemble ${descriptor.id} has no actual source triangle primitives.`);
          Object.assign(summary,{ready:true,supportDisposed:false});
        }
        aggregate=createArchitectureEnsemble(staged);controller.signal.throwIfAborted();
        for(const record of staged)records.set(record.descriptor.id,Object.freeze({descriptor:record.descriptor,owner:record.owner,support:record.support}));
        loadingId=null;status='ready';group.visible=true;return [...records.values()];
      }catch(error){
        note(error);const failures=cleanup();loadingId=null;if(!disposed)status='failed';
        if(failures.length)throw new AggregateError([error,...failures],'Persistent ensemble preparation and cleanup failed',{cause:error});throw error;
      }
    })();
    // A cancelled visit can stop awaiting this shared operation; retain a
    // rejection handler while lifetime cancellation still cleans late owners.
    operation.catch(()=>{});return operation;
  }
  async function borrow(id,{signal:visitSignal}={}){
    if(!byId.has(id))throw new Error(`Unknown persistent ensemble site: ${id}`);
    visitSignal?.throwIfAborted();await waitFor(prepare(),visitSignal);visitSignal?.throwIfAborted();
    const record=records.get(id);if(disposed||!record||record.support.disposed||record.owner.disposed)throw new Error(`Persistent ensemble ${id} is unavailable.`);
    owners.get(record.owner).summary.borrowers++;return record.owner;
  }
  function release(owner){
    const record=owners.get(owner);if(!record||record.summary.borrowers<1)throw new Error('Return only an outstanding ensemble borrow.');
    record.summary.borrowers--;return record.summary.borrowers;
  }
  function dispose(){
    if(disposed)return;disposed=true;status='disposed';operation=null;signal?.removeEventListener('abort',onAbort);
    // Close aggregate/local queries before the source supports' abort handlers.
    // Pending decoders observe this abort before their next promise continuation.
    const failures=cleanup();controller.abort(signal?.reason);if(failures.length)throw new AggregateError(failures,'Persistent ensemble cleanup failed');
  }
  const onAbort=()=>{try{dispose();}catch{/* Every cleanup error remains in snapshot; event dispatch must not throw. */}};
  if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
  return {prepare,borrow,release,dispose,group,get:id=>records.get(id)??null,
    get support(){return aggregate;},get disposed(){return disposed;},
    get snapshot(){return {status,disposed,loadingId,ready:status==='ready',records:summaries.map(summary=>({...summary})),errors:errors.map(error=>({...error}))};},
  };
}
