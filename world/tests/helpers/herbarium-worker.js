import {Worker} from 'node:worker_threads';

/** Actual browser worker module on a real thread; no decoder substitutes. */
export class HerbariumWorker{
  constructor(url){
    this.listeners=new Map();this.terminated=false;this.started=new Promise(resolve=>{this.start=resolve;});
    this.thread=new Worker(new URL('./herbarium-worker-host.js',import.meta.url),{workerData:{module:url.href}});
    this.thread.on('message',data=>{if(data.testDispatch){this.start();return;}for(const listener of this.listeners.get('message')||[])listener({data});});
    for(const kind of ['error','messageerror'])this.thread.on(kind,error=>{for(const listener of this.listeners.get(kind)||[])listener(error);});
  }
  addEventListener(kind,listener){if(!this.listeners.has(kind))this.listeners.set(kind,new Set());this.listeners.get(kind).add(listener);}
  removeEventListener(kind,listener){this.listeners.get(kind)?.delete(listener);}
  postMessage(data,transfer){this.thread.postMessage(data,transfer);}
  async terminate(){await this.thread.terminate();this.terminated=true;}
}
