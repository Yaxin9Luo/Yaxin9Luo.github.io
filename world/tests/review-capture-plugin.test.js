import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {reviewCapturePlugin} from '../review-capture-plugin.js';
import {evidenceFilename} from '../src/review-metrics.js';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'review-capture-test-')),images=join(root,'root-images'),captures=join(root,'evidence'),routes=[];
  await mkdir(images);await writeFile(join(images,'DViN.png'),Buffer.from([137,80,78,71,13,10,26,10]));
  reviewCapturePlugin(captures,{imageDirectory:images}).configureServer({middlewares:{use:(prefix,handler)=>routes.push({prefix,handler})}});
  const server=createServer((req,res)=>{
    const route=routes.find(entry=>req.url.startsWith(entry.prefix));if(!route){res.writeHead(404).end();return;}
    // Connect keeps a leading slash on the route-relative request URL.
    req.url=req.url.slice(route.prefix.length-1);void route.handler(req,res,()=>res.writeHead(404).end());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  return {base:`http://127.0.0.1:${server.address().port}`,captures,images};
}

test('mounted image route returns configured root-image bytes and MIME',async t=>{
  const {base}=await fixture(t),response=await fetch(`${base}/images/DViN.png?cache=1`);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[137,80,78,71,13,10,26,10]);
});

test('mounted evidence route accepts complete filenames and refuses overwrites',async t=>{
  const {base,captures}=await fixture(t),name=evidenceFilename({build:'338d112-baseline',view:'overview',timeOfDay:'night',quality:'balanced',foliage:'full'},'metrics','json');
  const response=await fetch(`${base}/__review_capture/${name}`,{method:'POST',body:'{"first":true}'});
  assert.equal(response.status,200);assert.equal(await readFile(join(captures,name),'utf8'),'{"first":true}');
  const duplicate=await fetch(`${base}/__review_capture/${name}`,{method:'POST',body:'overwritten'});
  assert.equal(duplicate.status,409);assert.equal(await readFile(join(captures,name),'utf8'),'{"first":true}');
});

test('capture route rejects malformed origin and escaped paths',async t=>{
  const {base}=await fixture(t);
  assert.equal((await fetch(`${base}/__review_capture/test.json`,{method:'POST',headers:{Origin:'invalid'},body:'x'})).status,400);
  assert.equal((await fetch(`${base}/__review_capture/test.json`,{method:'POST',headers:{Origin:'https://example.com'},body:'x'})).status,403);
  assert.equal((await fetch(`${base}/__review_capture/%2e%2e%2foutside.json`,{method:'POST',body:'x'})).status,400);
  assert.equal((await fetch(`${base}/__review_capture/test.json`)).status,405);
});
