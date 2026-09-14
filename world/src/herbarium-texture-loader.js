import {HalfFloatType,UnsignedByteType,RGBAFormat,RedFormat} from 'three';
import {shrubNormalEncoding,validateShrubHDRResult} from './herbarium-normal-policy.js';

/** One active decode: cancellation terminates synchronous DWAA work off-thread.
 * The resource coordinator owns deduplication/cache lifetime; this owns workers. */
export function createShrubTextureDecoder({createWorker=()=>new Worker(new URL('./herbarium-texture-worker.js',import.meta.url),{type:'module'})}={}){
  const queue=[];let active=null;
  function pump(){
    if(active||!queue.length)return;
    const job=queue.shift();active=job;
    try{
      job.worker=createWorker();job.worker.addEventListener('message',job.message);job.worker.addEventListener('error',job.error);job.worker.addEventListener('messageerror',job.error);
      job.worker.postMessage({key:job.key,normalEncoding:job.normalEncoding,buffer:job.buffer},[job.buffer]);job.buffer=null;
    }catch(error){job.finish(error);}
  }
  return function decode(buffer,{key,signal,normalEncoding='exr'}={}){
    try{shrubNormalEncoding(normalEncoding);if(normalEncoding==='astc-hdr'&&key!=='normalMap')throw new Error('HDR encoding is only valid for the normal map');}catch(error){return Promise.reject(error);}
    if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Shrub texture decode cancelled','AbortError'));
    return new Promise((resolve,reject)=>{
      const job={key,normalEncoding,buffer,worker:null,finished:false};
      job.finish=async(error,result)=>{
        if(job.finished)return;job.finished=true;signal?.removeEventListener('abort',job.abort);
        const at=queue.indexOf(job);if(at>=0)queue.splice(at,1);job.buffer=null;
        if(job.worker){job.worker.removeEventListener('message',job.message);job.worker.removeEventListener('error',job.error);job.worker.removeEventListener('messageerror',job.error);try{await job.worker.terminate();}catch(cause){error ||= cause;}job.worker=null;}
        if(active===job)active=null;
        if(error)reject(error);else resolve(result);pump();
      };
      job.abort=()=>job.finish(signal.reason||new DOMException('Shrub texture decode cancelled','AbortError'));
      job.error=event=>job.finish(new Error(event.message||'Shrub texture worker failed'));
      job.message=({data})=>{
        if(job.finished)return;
        if(data?.error){job.finish(new Error(data.error));return;}
        if(normalEncoding==='astc-hdr'){
          try{job.finish(null,validateShrubHDRResult(data?.result));}catch(error){job.finish(error);}return;
        }
        const result=data?.result,half=key==='normalMap'||key==='roughnessMap',format=key==='normalMap'?RGBAFormat:RedFormat,components=format===RGBAFormat?4:1;
        if(!result||result.width!==8192||result.height!==8192||result.format!==format||result.type!==(half?HalfFloatType:UnsignedByteType)||!(result.data instanceof (half?Uint16Array:Uint8Array))||result.data.length!==8192*8192*components){job.finish(new Error('Invalid full-resolution shrub worker result'));return;}
        job.finish(null,result);
      };
      signal?.addEventListener('abort',job.abort,{once:true});queue.push(job);pump();
    });
  };
}
export const decodeShrubTexture=createShrubTextureDecoder();
