// Academy benchmark: builds (or reuses) a production bundle, serves it with the
// public assets, drives real Chrome on the real GPU and measures load and
// per-frame CPU/GPU cost without touching game code (requestAnimationFrame and
// WebGL draw calls are wrapped from an init script; GPU time uses
// EXT_disjoint_timer_query_webgl2, hidden from the page so the game cannot nest queries).
//
//   node world/scripts/bench-academy.mjs [--dist <dir>] [--classic] [--quality low]
//        [--width 1440 --height 900 --dpr 2] [--throttle 4] [--label name] [--out file.json]
//        [--scenarios spawn,fly,overview,trial,fly-throttled]
// Without --dist it builds into a temporary directory first. --classic measures
// the original world (?academy=classic) from the same bundle.
// CHROME_PATH overrides the Chrome executable (default: macOS Google Chrome).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';

const args=Object.fromEntries(process.argv.slice(2).reduce((acc,v,i,a)=>{if(v.startsWith('--'))acc.push([v.slice(2),a[i+1]?.startsWith('--')||a[i+1]===undefined?'1':a[i+1]]);return acc;},[]));
const WORLD=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const REPO=path.resolve(WORLD,'..');
let dist=args.dist?path.resolve(args.dist):null;
if(!dist){
  const {build}=await import('vite');dist=fs.mkdtempSync(path.join(os.tmpdir(),'academy-bench-'));
  await build({root:WORLD,configFile:path.join(WORLD,'vite.config.js'),logLevel:'warn',build:{outDir:dist,emptyOutDir:true,copyPublicDir:false}});
}
if(args.classic)args.query=(args.query?args.query+'&':'?')+'academy=classic';
else args.query=args.query||'?academy-debug';
const roots=[dist,path.join(REPO,'world/public'),REPO];
const label=args.label||'run';
const quality=args.quality||null; // null = site default
const width=Number(args.width||1440),height=Number(args.height||900),dpr=Number(args.dpr||2);
const throttle=Number(args.throttle||4);
const out=args.out||path.join(os.tmpdir(),`academy-bench-${label}.json`);
const scenarios=(args.scenarios||'spawn,fly,overview,fly-throttled').split(',');

const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.hdr':'application/octet-stream','.ktx2':'image/ktx2','.woff2':'font/woff2','.woff':'font/woff','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.exr':'application/octet-stream','.pdf':'application/pdf','.txt':'text/plain','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  for(const root of roots){
    const file=path.join(root,pathname);
    if(!file.startsWith(root))continue;
    let stat;try{stat=fs.statSync(file);}catch{continue;}
    if(stat.isDirectory())continue;
    res.writeHead(200,{'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','content-length':stat.size,'cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end('not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;

const instrument=`(()=>{
  const B=window.__bench={frames:[],longTasks:[],gl:null,ext:null,pending:[],cur:null,recording:false,drawCalls:0,tris:0};
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())B.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
  const gc=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,attrs){
    const gl=gc.call(this,type,attrs);
    if(gl&&type==='webgl2'&&this.id==='world'&&!B.gl){B.gl=gl;B.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');wrap(gl);}
    return gl;
  };
  function tri(mode,count,inst=1){if(mode===4)B.tris+=count/3*inst;else if(mode===5||mode===6)B.tris+=Math.max(0,count-2)*inst;}
  function wrap(gl){
    const de=gl.drawElements,da=gl.drawArrays,dei=gl.drawElementsInstanced,dai=gl.drawArraysInstanced,dre=gl.drawRangeElements;
    gl.drawElements=function(m,c,t,o){B.drawCalls++;tri(m,c);return de.call(this,m,c,t,o);};
    gl.drawArrays=function(m,f,c){B.drawCalls++;tri(m,c);return da.call(this,m,f,c);};
    gl.drawElementsInstanced=function(m,c,t,o,n){B.drawCalls++;tri(m,c,n);return dei.call(this,m,c,t,o,n);};
    gl.drawArraysInstanced=function(m,f,c,n){B.drawCalls++;tri(m,c,n);return dai.call(this,m,f,c,n);};
    gl.drawRangeElements=function(m,s,e,c,t,o){B.drawCalls++;tri(m,c);return dre.call(this,m,s,e,c,t,o);};
    const ge=gl.getExtension;
    gl.getExtension=function(name){if(name==='EXT_disjoint_timer_query_webgl2')return null;const ext=ge.call(this,name);
      if(ext&&name==='WEBGL_multi_draw'&&!ext.__wrapped){ext.__wrapped=true;
        const a=ext.multiDrawElementsWEBGL,b=ext.multiDrawElementsInstancedWEBGL,c=ext.multiDrawArraysWEBGL,d=ext.multiDrawArraysInstancedWEBGL;
        ext.multiDrawElementsWEBGL=function(m,counts,co,t,offs,oo,n){B.drawCalls++;for(let i=0;i<n;i++)tri(m,counts[co+i]);return a.apply(this,arguments);};
        if(b)ext.multiDrawElementsInstancedWEBGL=function(m,counts,co,t,offs,oo,inst,io,n){B.drawCalls++;for(let i=0;i<n;i++)tri(m,counts[co+i],inst[io+i]);return b.apply(this,arguments);};
        if(c)ext.multiDrawArraysWEBGL=function(m,f,fo,counts,co,n){B.drawCalls++;for(let i=0;i<n;i++)tri(m,counts[co+i]);return c.apply(this,arguments);};
        if(d)ext.multiDrawArraysInstancedWEBGL=function(m,f,fo,counts,co,inst,io,n){B.drawCalls++;for(let i=0;i<n;i++)tri(m,counts[co+i],inst[io+i]);return d.apply(this,arguments);};
      }
      return ext;};
  }
  const raf=window.requestAnimationFrame.bind(window);
  let frameTs=-1;
  window.requestAnimationFrame=function(cb){return raf(ts=>{
    if(ts!==frameTs){
      // close previous frame
      if(B.cur&&B.recording)B.frames.push(B.cur);
      poll();
      frameTs=ts;B.cur={ts,cpu:0,gpu:null,draws:0,tris:0,q:null};
    }
    const f=B.cur,gl=B.gl,ext=B.ext;let q=null;
    if(gl&&ext&&B.recording&&!B.queryActive){q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);B.queryActive=true;}
    const d0=B.drawCalls,t0=B.tris,c0=performance.now();
    try{cb(ts);}finally{
      f.cpu+=performance.now()-c0;f.draws+=B.drawCalls-d0;f.tris+=B.tris-t0;
      if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);B.queryActive=false;B.pending.push({q,f});f.gpu=f.gpu??0;f.qn=(f.qn||0)+1;}
    }
  });};
  function poll(){
    const gl=B.gl,ext=B.ext;if(!gl||!ext)return;
    const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
    B.pending=B.pending.filter(({q,f})=>{
      if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))return true;
      if(!disjoint)f.gpu+=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;else f.disjoint=true;
      f.qn--;gl.deleteQuery(q);return false;
    });
  }
  B.start=()=>{B.frames=[];B.recording=true;};
  B.stop=async()=>{B.recording=false;for(let i=0;i<30&&B.pending.length;i++){await new Promise(r=>setTimeout(r,50));poll();}
    return B.frames.map(f=>({ts:f.ts,cpu:f.cpu,gpu:f.qn===0&&!f.disjoint?f.gpu:null,draws:f.draws,tris:f.tris}));};
})();`;

const stats=(values)=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const q=p=>v[Math.min(v.length-1,Math.max(0,Math.ceil(v.length*p)-1))];return {n:v.length,mean:+(v.reduce((s,x)=>s+x,0)/v.length).toFixed(3),p50:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+v[v.length-1].toFixed(3)};};
function summarize(frames){
  const intervals=frames.slice(1).map((f,i)=>f.ts-frames[i].ts);
  const spikes=intervals.map((v,i)=>[v,i]).filter(([v])=>v>33.4).map(([v,i])=>`${v.toFixed(0)}ms@${i}`);
  return {frames:frames.length,spikes,interval:stats(intervals),cpu:stats(frames.map(f=>f.cpu)),gpu:stats(frames.map(f=>f.gpu)),draws:stats(frames.map(f=>f.draws)),tris:stats(frames.map(f=>f.tris)),
    over33ms:intervals.filter(x=>x>33.4).length,over50ms:intervals.filter(x=>x>50).length};
}

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
const prefs={lang:'en',sound:false,reducedMotion:false,...(quality?{quality}:{})};
await context.addInitScript(`try{const k='yaxin.grimoire.preferences';const p=JSON.parse(localStorage.getItem(k)||'{}');localStorage.setItem(k,JSON.stringify({...p,...${JSON.stringify(prefs)}}));}catch{}`);
await context.addInitScript(instrument);
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
const requests=new Map();let bytes=[];
cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url,t:e.timestamp}));
cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);bytes.push({url:r?.url,t:e.timestamp,bytes:e.encodedDataLength});});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

await page.goto(origin+'/'+(args.query||''),{waitUntil:'load'});
await page.waitForTimeout(1500);
const preBytes=bytes.reduce((s,b)=>s+b.bytes,0);bytes=[];
const t0=await page.evaluate(()=>performance.now());
const wall0=Date.now();
await page.click('#explore-button');
await page.waitForFunction(()=>document.querySelector('.experience')?.classList.contains('world-ready'),null,{timeout:180000,polling:50});
const tInteractive=await page.evaluate(()=>performance.now());
const bytesInteractive=bytes.reduce((s,b)=>s+b.bytes,0);
await page.waitForFunction(()=>['ready','degraded'].includes(window.portfolioLoading?.snapshot()?.enhancements),null,{timeout:600000,polling:100});
const tFull=await page.evaluate(()=>performance.now());
const bytesFull=bytes.reduce((s,b)=>s+b.bytes,0);
const loadInfo=await page.evaluate(([t0,t1,t2])=>{
  const lt=window.__bench.longTasks;const win=(a,b)=>lt.filter(x=>x.start>=a&&x.start<b);
  const tbt=list=>list.reduce((s,x)=>s+Math.max(0,x.duration-50),0);
  const snap=window.portfolioLoading.snapshot();
  return {enhancements:snap.enhancements,toInteractiveMs:t1-t0,toFullMs:t2-t0,
    longTasksToInteractive:win(t0,t1).length,blockingToInteractiveMs:tbt(win(t0,t1)),
    longTasksToFull:win(t0,t2).length,blockingToFullMs:tbt(win(t0,t2)),maxLongTaskMs:Math.max(0,...win(t0,t2).map(x=>x.duration)),
    heapMB:performance.memory?performance.memory.usedJSHeapSize/1e6:null,
    renderer:(()=>{const gl=window.__bench.gl;const d=gl?.getExtension('WEBGL_debug_renderer_info');return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null;})(),
    canvas:(()=>{const c=document.querySelector('#world');return {w:c.width,h:c.height};})()};
},[t0,tInteractive,tFull]);
const result={label,quality:quality||'default',viewport:{width,height,dpr},load:{...loadInfo,preBytesMB:preBytes/1e6,bytesToInteractiveMB:bytesInteractive/1e6,bytesToFullMB:bytesFull/1e6,requestsToFull:bytes.length,wallMs:Date.now()-wall0},scenarios:{}};
console.log(label,'load',JSON.stringify(result.load));

// Let shaders/textures settle.
await page.waitForTimeout(3000);
async function record(name,ms,during){
  await page.evaluate(()=>window.__bench.start());
  const p=during?.();
  await page.waitForTimeout(ms);
  await p;
  const frames=await page.evaluate(()=>window.__bench.stop());
  result.scenarios[name]=summarize(frames);
  console.log(label,name,JSON.stringify(result.scenarios[name]));
}
const hold=async(keys,ms)=>{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);};
const lean=await page.evaluate(()=>Boolean(document.querySelector('.ac-intro')));
if(lean)await page.evaluate(()=>document.querySelector('.ac-intro [data-ac=free]')?.click());
await page.waitForTimeout(500);
for(const name of scenarios){
  if(name==='spawn')await record('spawn',5000);
  else if(name==='fly')await record('fly',6000,()=>hold(lean?['KeyD','ShiftLeft']:['KeyW','ShiftLeft'],6000));
  else if(name==='overview'){
    if(lean){await hold(['KeyW','ShiftLeft'],2600);await record('overview',5000,()=>hold(['KeyA'],5000));}
    else{await page.keyboard.press('KeyV');await page.waitForTimeout(1500);await record('overview',5000);await page.keyboard.press('KeyV');await page.keyboard.press('KeyV');await page.waitForTimeout(800);}}
  else if(name==='trial'&&lean){
    await page.evaluate(()=>{const g=window.__academy;g.startTrial('lantern-loop');g.__pilot=setInterval(()=>{if(!g.run||g.run.phase!=='running')return;if(g.target)g._castQueued=true;const f=g.flight,r=g.run.rings[g.run.ring];
      const near=Math.hypot(r.x-f.x,r.y-f.y,r.z-f.z)<14,a=near?r:{x:r.x+r.normal.x*4,y:r.y+r.normal.y*4,z:r.z+r.normal.z*4};const dx=a.x-f.x,dz=a.z-f.z,dy=a.y-f.y;
      const want=Math.atan2(-dx,-dz);let e=((want-f.heading+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
      g.setTouch(Math.max(-1,Math.min(1,-e*2.4)),-Math.max(-1,Math.min(1,(Math.atan2(dy,Math.max(4,Math.hypot(dx,dz)))-f.pitch*.5)/.62*1.6)));},16);});
    await page.waitForTimeout(3300);await record('trial',10000);await page.evaluate(()=>{clearInterval(window.__academy.__pilot);window.__academy.setTouch(0,0);window.__academy.freeFlight();});}
  else if(name==='fly-throttled'){await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});await record(`fly-cpu${throttle}x`,6000,()=>hold(lean?['KeyA','ShiftLeft']:['KeyS','ShiftLeft'],6000));await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});}
}
result.errors=errors.slice(0,20);
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log('wrote',out);
await browser.close();server.close();
