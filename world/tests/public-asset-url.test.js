import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAssetURL,publicAssetResponseMatches,fetchPublicAsset} from '../src/public-asset-url.js';
import {publishedAssets} from '../src/published-asset-map.js';
const [local,remote]=Object.entries(publishedAssets)[0],base='https://yaxin9luo.github.io/';
test('only exact local assets use the pinned revision; queries and fragments survive',()=>{
 assert.match(remote,/^https:\/\/raw\.githubusercontent\.com\/Yaxin9Luo\/Yaxin9Luo\.github\.io\/[a-f0-9]{40}\/world\/public\//);
 assert.equal(publicAssetURL(local,base),remote);
 assert.equal(publicAssetURL(local+'?v=1#x',base),remote+'?v=1#x');
 assert.equal(publicAssetURL(new URL(local,base),base),remote);
 for(const input of ['/files/CV_YaxinLuo.pdf','/museum-reader.html','/__review_capture/frame.png','data:image/png;base64,a','blob:https://yaxin9luo.github.io/1','https://elsewhere.example'+local])assert.equal(publicAssetURL(input,base),input);
});
test('a response may use only its original origin or its exact immutable asset URL',()=>{
 assert.equal(publicAssetResponseMatches(local,remote,base),true);
 assert.equal(publicAssetResponseMatches(local,base+'local-fallback',base),true);
 assert.equal(publicAssetResponseMatches(local,remote+'-tampered',base),false);
 assert.equal(publicAssetResponseMatches('/unlisted',remote,base),false);
 assert.equal(publicAssetResponseMatches(local,'https://elsewhere.example/file',base),false);
});
test('transport preserves cancellation, options, status and the actual response URL',async t=>{
 const controller=new AbortController(),options={signal:controller.signal,redirect:'error'},response=new Response('original bytes',{status:206});let call;
 t.mock.method(globalThis,'fetch',async (...args)=>{call=args;return response;});
 assert.equal(await fetchPublicAsset(local,options),response);
 assert.equal(call[0],remote);assert.equal(call[1],options);
 assert.equal(response.status,206);
});
test('Request inputs keep method and headers without installing a global fetch override',async t=>{
 const response=new Response('bytes');let call;
 const mock=t.mock.method(globalThis,'fetch',async (...args)=>{call=args;return response;});
 const input=new Request(base+local.slice(1),{headers:{Range:'bytes=0-31'}});
 assert.equal(await fetchPublicAsset(input),response);
 assert.equal(call[0].url,remote);assert.equal(call[0].headers.get('Range'),'bytes=0-31');assert.equal(call[0].method,'GET');
 assert.equal(globalThis.fetch,mock);
});
test('aborted asset transfers propagate their original failure',async t=>{
 const reason=new DOMException('Stopped','AbortError'),controller=new AbortController();controller.abort(reason);
 t.mock.method(globalThis,'fetch',async (_url,{signal})=>{signal.throwIfAborted();});
 await assert.rejects(fetchPublicAsset(local,{signal:controller.signal}),error=>error===reason);
});
