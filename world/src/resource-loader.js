import {assetManifest} from './asset-manifest.js';
/** Bounded, shared resource requests. This module deliberately has no engine imports. */
export function resourceError(type,message,status){const error=new Error(message);error.type=type;if(status)error.status=status;return error;}
export function redactResourceURL(value){
  try{const relative=!/^[a-z][a-z\d+.-]*:/i.test(value),url=new URL(value,'https://local.invalid');url.username='';url.password='';url.search='';url.hash='';return relative?url.pathname:url.href;}catch{return '[invalid URL]';}
}
export function createResourceLoader({fetchImpl=(...args)=>fetch(...args),now=()=>performance.now(),setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout,manifest={},onEvent=()=>{}}={}){
  const pending=new Map(),completed=new Map(),listeners=new Set([onEvent]),records=[];
  const emit=event=>{const safe={...event,id:/[?:]/.test(event.id)?redactResourceURL(event.id):event.id,url:redactResourceURL(event.url)};const previous=safe.phase==='fetching'?records.findLastIndex(record=>record.id===safe.id&&record.phase==='fetching'&&record.attempts===safe.attempts&&record.attemptId===safe.attemptId):-1;if(previous>=0)records[previous]=safe;else records.push(safe);if(records.length>1200)records.shift();for(const listener of listeners)listener(safe);};
  function load(resource,{signal,deadline=now()+20000,parse=buffer=>buffer,dispose=()=>{},onProgress=()=>{},attemptId}={}){
    const descriptor=typeof resource==='string'?{id:resource,url:resource}:resource;
    const asset={...descriptor,...(manifest[descriptor.id]||manifest[descriptor.url]||{})};
    const key=`${asset.id||asset.url}:${asset.url}`;
    if(signal?.aborted)return Promise.reject(resourceError('cancelled','Resource cancelled'));
    if(now()>=deadline)return Promise.reject(resourceError('timeout','Resource deadline exceeded'));
    if(completed.has(key))return Promise.resolve(completed.get(key));
    let entry=pending.get(key);
    if(entry?.controller.signal.aborted){pending.delete(key);entry=null;}
    if(!entry){
      const controller=new AbortController(),started=now();
      entry={controller,consumers:new Set(),done:false,deadline};pending.set(key,entry);
      const task=entry;
      let attempts=0,receivedBytes=0,totalBytes,phase='queued';
      const report=(next,extra={})=>{phase=next;const event={id:asset.id||asset.url,url:asset.url,attemptId,stage:asset.phase,phase,attempts,receivedBytes,totalBytes,elapsedMs:now()-started,...extra};emit(event);for(const consumer of task.consumers)consumer.onProgress(event);};
      const check=()=>{if(controller.signal.aborted)throw controller.signal.reason||resourceError('cancelled','Resource cancelled');if(now()>=task.deadline)throw resourceError('timeout','Resource deadline exceeded');};
      // A race is needed even when a test fetch or parser cannot observe AbortSignal.
      const aborted=new Promise((resolve,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason||resourceError('cancelled','Resource cancelled')),{once:true}));
      const work=async()=>{
        report('queued');
        while(true){
          try{
            check();attempts++;receivedBytes=0;totalBytes=undefined;report('fetching');
            const response=await fetchImpl(asset.url,{signal:controller.signal});check();
            if(!response.ok)throw resourceError('http',`HTTP ${response.status}`,response.status);
            const length=Number(response.headers?.get('content-length'));
            if(length>0&&!response.headers?.get('content-encoding'))totalBytes=length;
            let buffer;
            if(response.body?.getReader){
              const reader=response.body.getReader(),chunks=[];
              try{while(true){check();const {done,value}=await reader.read();if(done)break;check();chunks.push(value);receivedBytes+=value.byteLength;if(receivedBytes>totalBytes)totalBytes=undefined;report('fetching');}}
              catch(error){await reader.cancel().catch(()=>{});throw error;}
              finally{reader.releaseLock();}
              const bytes=new Uint8Array(receivedBytes);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}buffer=bytes.buffer;
            }else{buffer=await response.arrayBuffer();receivedBytes=buffer.byteLength;if(receivedBytes>totalBytes)totalBytes=undefined;report('fetching');}
            check();report('parsing');let result;
            try{result=await parse(buffer,{signal:controller.signal,url:asset.url});}catch(error){if(controller.signal.aborted)throw controller.signal.reason;throw resourceError('parse','Resource parsing failed');}
            if(controller.signal.aborted||now()>=task.deadline){dispose(result);check();}
            completed.set(key,result);report('ready');return result;
          }catch(error){
            if(controller.signal.aborted)throw controller.signal.reason;
            const type=error.type||'network';
            const transient=type==='network'||(type==='http'&&[408,429,500,502,503,504].includes(error.status));
            if(attempts===1&&transient&&now()-started<5000&&task.deadline-now()>=1000){report('retrying',{type,status:error.status});continue;}
            if(!error.type)error=resourceError(type,'Resource transfer failed');throw error;
          }
        }
      };
      task.promise=Promise.race([Promise.resolve().then(work),aborted]).catch(error=>{report(error.type==='cancelled'?'cancelled':'failed',{type:error.type||'network',status:error.status,failedPhase:phase});throw error;}).finally(()=>{task.done=true;if(pending.get(key)===task)pending.delete(key);});
      // Consumers subscribe below, including before an immediate deadline rejection.
      task.promise.catch(()=>{});
    }
    const task=entry;
    task.deadline=Math.max(task.deadline,deadline);
    return new Promise((resolve,reject)=>{
      const consumer={onProgress};task.consumers.add(consumer);
      let timer;
      const release=()=>{clearTimeoutImpl(timer);signal?.removeEventListener('abort',cancel);task.consumers.delete(consumer);};
      const leave=reason=>{release();reject(reason);if(!task.done&&task.consumers.size===0)task.controller.abort(reason);};
      const cancel=()=>leave(signal?.reason?.type?signal.reason:resourceError('cancelled','Resource cancelled'));
      timer=setTimeoutImpl(()=>leave(resourceError('timeout','Resource deadline exceeded')),Math.max(0,deadline-now()));
      signal?.addEventListener('abort',cancel,{once:true});
      task.promise.then(value=>{release();if(now()>=deadline)reject(resourceError('timeout','Resource deadline exceeded'));else resolve(value);},error=>{release();reject(error);});
    });
  }
  return {load,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},diagnostics:()=>records.map(record=>({...record}))};
}

/** Core GLBs are embedded-only, so GLTFLoader cannot create untracked child requests. */
export function assertSelfContainedGLB(buffer){
  const view=new DataView(buffer);
  if(buffer.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('Invalid GLB header');
  const jsonLength=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||jsonLength>buffer.byteLength-20)throw new Error('Invalid GLB JSON chunk');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri&&!item.uri.startsWith('data:'))throw new Error('External GLB dependencies must use the resource coordinator');
  return buffer;
}
export const resourceLoader=createResourceLoader({manifest:assetManifest});
