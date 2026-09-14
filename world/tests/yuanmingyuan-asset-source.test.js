import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMuseumArchive} from '../src/yuanmingyuan/asset-source.js';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';

const baseURL='https://museum.test/yuanmingyuan.html';
const manifest={id:'fanghe-xianfahua',glb:{url:'model.glb.gz',compression:'gzip',sha256:'a'.repeat(64),transferSha256:'b'.repeat(64),bytes:400,transferBytes:120},runtime:{url:'model.runtime.json.gz',compression:'gzip',sha256:'c'.repeat(64),transferSha256:'d'.repeat(64),bytes:200,transferBytes:80}};
test('versioned manifest resolves both lossless transports without changing their checksums',async()=>{
  const requests=[],owner={group:{},dispose(){}};
  const result=await loadMuseumArchive(manifest.id,'/assets/yuanmingyuan/fanghe/v1/manifest.json',{baseURL,fetcher:async url=>{requests.push(url);return {ok:true,json:async()=>manifest};},load:async descriptor=>{assert.equal(descriptor.id,manifest.id);assert.equal(descriptor.glb.url,'https://museum.test/assets/yuanmingyuan/fanghe/v1/model.glb.gz');assert.equal(descriptor.runtime.url,'https://museum.test/assets/yuanmingyuan/fanghe/v1/model.runtime.json.gz');assert.equal(descriptor.glb.transferSha256,manifest.glb.transferSha256);assert.equal(descriptor.glb.sha256,manifest.glb.sha256);return owner;}});
  assert.equal(result,owner);assert.deepEqual(requests,['https://museum.test/assets/yuanmingyuan/fanghe/v1/manifest.json']);
});
test('wrong identity, external files and failed manifests never reach model reconstruction',async()=>{
  let reconstructed=0;const load=async()=>{reconstructed++;};
  for(const replacement of [{...manifest,id:'other'},{...manifest,glb:{...manifest.glb,url:'https://elsewhere.test/model.glb.gz'}}])await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{baseURL,load,fetcher:async()=>({ok:true,json:async()=>replacement})}));
  await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{baseURL,load,fetcher:async()=>({ok:false,status:404})}),/404/);
  await assert.rejects(loadMuseumArchive(manifest.id,'https://elsewhere.test/manifest.json',{baseURL,load,fetcher:async()=>{throw new Error('Must not fetch external manifest');}}),/hosted/);
  assert.equal(reconstructed,0);
});
test('leaving during JSON parsing cancels before allocating a model',async()=>{
  const controller=new AbortController();let reconstructed=false;
  await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{baseURL,signal:controller.signal,fetcher:async()=>({ok:true,json:async()=>{controller.abort();return manifest;}}),load:async()=>{reconstructed=true;}}),{name:'AbortError'});
  assert.equal(reconstructed,false);
});

test('resident full archives bind the exact reviewed manifest bytes before decoding',async()=>{
  const bytes=JSON.stringify(manifest),sha=createHash('sha256').update(bytes).digest('hex');let decodes=0;
  const options={baseURL,expectedManifestSHA256:sha,fetcher:async()=>new Response(bytes),load:async()=>{decodes++;return {dispose(){}};}};
  await loadMuseumArchive(manifest.id,'/manifest.json',options);assert.equal(decodes,1);
  await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{...options,fetcher:async()=>new Response(bytes+' ')}),/SHA256 mismatch/);
  await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{...options,expectedManifestSHA256:'short'}),/full SHA256/);
  assert.equal(decodes,1,'neither unreviewed byte stream reaches reconstruction');
});

test('a manifest HTTP redirect cannot leave the exhibition origin even with an approved SHA',async t=>{
  const bytes=JSON.stringify(manifest),expectedManifestSHA256=createHash('sha256').update(bytes).digest('hex');
  let externalRequests=0,reconstructed=0;
  const external=createServer((request,response)=>{externalRequests++;response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});response.end(bytes);});
  const local=createServer((request,response)=>{response.writeHead(302,{location:`http://127.0.0.1:${external.address().port}/manifest.json`});response.end();});
  for(const server of [external,local]){
    t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  }
  await assert.rejects(loadMuseumArchive(manifest.id,'/manifest.json',{
    baseURL:`http://127.0.0.1:${local.address().port}/`,expectedManifestSHA256,
    load:async()=>{reconstructed++;return {dispose(){}};},
  }),{name:'TypeError'});
  assert.equal(externalRequests,0,'the redirect target must never receive a request');
  assert.equal(reconstructed,0);
});
