import {loadCompanionAssets} from './companion-assets.js';

/** One Game owns one consumer, one result and its lifetime; cached source
 * resources are still owned by the existing GLTF coordinator. */
export function createCompanionInstallation({install,signal:parentSignal,onStatus=()=>{},loadAssets=loadCompanionAssets}){
  const controller=new AbortController(),listeners=[];let request,result,status='idle',error=null,disposed=false;
  const connect=signal=>{if(!signal)return;const abort=()=>{controller.abort(signal.reason);if(result){result.dispose();result=null;publish('cancelled');}};if(signal.aborted)abort();else{signal.addEventListener('abort',abort,{once:true});listeners.push(()=>signal.removeEventListener('abort',abort));}};
  connect(parentSignal);
  const publish=next=>{status=next;onStatus({status,error});};
  return {
    request({worldReady=Promise.resolve(),signal:requestSignal,...options}={}){
      if(request)return request;
      if(disposed){request=Promise.reject(controller.signal.reason);request.catch(()=>{});return request;}
      connect(requestSignal);
      const signal=controller.signal;
      publish('loading');
      const ready=Promise.all([Promise.resolve().then(()=>{signal.throwIfAborted();return loadAssets({...options,signal});}),worldReady]);
      request=(async()=>{
        let cancel;
        try{
          await Promise.race([ready,new Promise((_,reject)=>{cancel=()=>reject(signal.reason);if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});})]);
          signal.throwIfAborted();result=install();signal.throwIfAborted();publish('ready');return result;
        }catch(failure){if(signal.aborted&&result){result.dispose();result=null;}error=failure?.message||String(failure);if(!disposed)publish(signal.aborted?'cancelled':'failed');throw failure;}
        finally{signal.removeEventListener('abort',cancel);}
      })();
      request.catch(()=>{});return request;
    },
    snapshot(){return {status,error};},
    dispose(){if(disposed)return;disposed=true;controller.abort();for(const remove of listeners)remove();listeners.length=0;try{result?.dispose();}finally{result=null;publish('disposed');}},
  };
}
