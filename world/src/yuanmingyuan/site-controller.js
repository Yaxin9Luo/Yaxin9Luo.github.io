// A visit owns its resource unless an explicit release callback returns a
// borrowed owner. Late results follow that same ownership contract.
function disposeResource(resource){try{resource.group?.removeFromParent();}finally{resource.dispose();}}
export function createMuseumSiteController({sites,load,mount,release:releaseResource=disposeResource,onChange=()=>{},signal}={}){
  if(typeof releaseResource!=='function')throw new Error('Museum site release must be a function.');
  const byId=new Map(sites.map(site=>[site.id,site]));
  if(byId.size!==sites.length)throw new Error('Museum site IDs must be unique.');
  let disposed=false,generation=0,request=null,live=null,queue=Promise.resolve();
  let state={status:'idle',siteId:null,error:null};const cleanupErrors=[];
  const snapshot=()=>({...state,generation,cleanupErrors:cleanupErrors.map(error=>({...error}))});
  const notify=next=>{state=next;onChange(snapshot());};
  const current=ticket=>!disposed&&request===ticket&&!ticket.controller.signal.aborted;
  function release(record){
    if(!record||record.released)return;record.released=true;
    const errors=[];for(const action of [()=>record.unmount?.(),()=>releaseResource(record.resource)])try{action();}catch(error){errors.push(error);cleanupErrors.push({message:error?.message??String(error)});}
    if(errors.length)throw new AggregateError(errors,errors.length===1?(errors[0]?.message??String(errors[0])):'Museum site release failed');
  }
  function retire(){const previous=live;live=null;release(previous);}
  function select(id){
    if(disposed)return Promise.resolve(null);
    if(!byId.has(id))return Promise.reject(new Error(`Unknown museum site: ${id}`));
    if(request?.site.id===id&&!request.controller.signal.aborted)return request.promise;
    request?.controller.abort();
    try{retire();}catch(error){request=null;notify({status:'failed',siteId:id,error:error.message||String(error)});return Promise.reject(error);}
    const ticket={site:byId.get(id),generation:++generation,controller:new AbortController(),promise:null};request=ticket;
    notify({status:'loading',siteId:id,error:null});
    const operation=queue.catch(()=>{}).then(async()=>{
      if(!current(ticket))return null;
      let record=null;
      try{
        const resource=await load(ticket.site,{signal:ticket.controller.signal});
        if(!resource||typeof resource.dispose!=='function')throw new Error('Museum model did not return a resource owner.');
        record={resource,unmount:null,released:false};
        if(!current(ticket)){release(record);return null;}
        record.unmount=mount(resource,ticket.site);
        if(!current(ticket)){release(record);return null;}
        live=record;notify({status:'ready',siteId:id,error:null});return resource;
      }catch(error){
        try{release(record);}catch(cleanup){error=new AggregateError([error,cleanup],'Museum site load and cleanup failed');}
        if(current(ticket)){request=null;notify({status:'failed',siteId:id,error:error.message||String(error)});}
        return null;
      }
    });
    ticket.promise=operation;queue=operation;return operation;
  }
  function cancel(){if(disposed)return;request?.controller.abort();request=null;generation++;try{retire();}finally{notify({status:'idle',siteId:null,error:null});}}
  function dispose(){if(disposed)return;disposed=true;request?.controller.abort();request=null;generation++;try{retire();}finally{signal?.removeEventListener('abort',onAbort);notify({status:'disposed',siteId:null,error:null});}}
  const onAbort=()=>{try{dispose();}catch{/* Cleanup failures remain observable through snapshot. */}};
  if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
  return {select,cancel,dispose,get snapshot(){return snapshot();},get resource(){return live?.resource||null;}};
}
