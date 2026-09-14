import {parentPort,workerData} from 'node:worker_threads';
const pending=[];let ready=false;
globalThis.self={postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)};
const dispatch=data=>{parentPort.postMessage({testDispatch:true});self.onmessage({data});};
parentPort.on('message',data=>ready?dispatch(data):pending.push(data));
await import(workerData.module);ready=true;for(const data of pending)dispatch(data);
