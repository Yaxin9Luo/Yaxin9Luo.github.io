import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual page loader. The spies replace model construction only;
// the URL selection, options and complete-source delegation remain real code.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const start=source.indexOf('async function loadSceneBuilding('),end=source.indexOf('\nasync function prepareMuseumGround(',start);
assert(start>=0&&end>start);
function route(search){
  const calls=[],signal=new AbortController().signal,r2Layout={id:'r2-layout'},owners={r4:{id:'r4-owner'},r3:{id:'r3-owner'},legacy:{id:'legacy-owner'}};
  const ctx={query:new URLSearchParams(search),lang:'en',busy(){},
    createXieqiquCourtGardenR4Study(options){calls.push({kind:'r4',options});return owners.r4;},
    createXieqiquCourtGardenR3Study(options){calls.push({kind:'r3',options});return owners.r3;},
    createXieqiquCourtGardenOwner(options){calls.push({kind:'legacy',options});return owners.legacy;},
    createXieqiquCourtGardenR2Layout(){return r2Layout;},
    loadMuseumModel(id,options){const value={kind:'model',id,options};calls.push(value);return value;},
    loadMuseumArchive(id,manifestURL,options){const value={kind:'archive',id,manifestURL,options};calls.push(value);return value;},
  };
  vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nthis.load=loadSceneBuilding;',ctx);
  return {calls,signal,r2Layout,owners,load:(id='xieqiqu',options={})=>ctx.load(id,{signal,...options})};
}
for(const review of [false,true])test('explicit R4 composition chooses the formal factory with review='+review,async()=>{
  const f=route('composition=xianfaqiao&court=garden-r4'+(review?'&review=still':''));
  assert.equal(await f.load(),f.owners.r4);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].options.signal,f.signal);
  const sourceSignal=new AbortController().signal;
  const base=await f.calls[0].options.loadBase({signal:sourceSignal});
  assert.equal(base.kind,'model');assert.equal(base.id,'xieqiqu');assert.equal(base.options.signal,sourceSignal);
});
for(const variant of ['garden-r1','garden-r2']){
  test(variant+' remains available in its explicit composition review',async()=>{
    const f=route('composition=xianfaqiao&court='+variant+'&review=still');
    assert.equal(await f.load(),f.owners.legacy);assert.equal(f.calls.length,1);
    assert.equal(f.calls[0].options.layout,variant==='garden-r2'?f.r2Layout:undefined);
  });
  test(variant+' remains unavailable on an ordinary visitor URL',async()=>{
    const f=route('composition=xianfaqiao&court='+variant);
    await assert.rejects(f.load(),/explicit Xieqiqu composition/);assert.equal(f.calls.length,0);
  });
}
for(const search of [
  'court=garden-r4',
  'court=garden-r4&review=still',
  'composition=other&court=garden-r4&review=still',
  'composition=xianfaqiao&court=unknown',
  'composition=xianfaqiao&court=unknown&review=still',
])test('unsupported court selection fails before allocating: '+search,async()=>{
  const f=route(search);await assert.rejects(f.load(),/explicit Xieqiqu composition/);assert.equal(f.calls.length,0);
});
for(const search of ['', 'composition=xianfaqiao', 'composition=xianfaqiao&review=still'])test('no court retains the ordinary source route: '+(search||'(empty)'),async()=>{
  const f=route(search),result=await f.load();assert.equal(result.kind,'model');assert.equal(result.id,'xieqiqu');
  assert.equal(f.calls.length,1);assert.equal(result.options.signal,f.signal);
});
test('a court query does not redirect another non-composition model',async()=>{
  const f=route('court=garden-r4'),result=await f.load('fangwaiguan');
  assert.equal(result.kind,'model');assert.equal(result.id,'fangwaiguan');assert.equal(f.calls.length,1);
});
test('the bridge keeps its pinned archive route beside the R4 court',async()=>{
  const f=route('composition=xianfaqiao&court=garden-r4');
  const result=await f.load('xianfaqiao',{manifestURL:'/pinned/bridge.json',expectedManifestSHA256:'pinned-sha'});
  assert.equal(result.kind,'archive');assert.equal(result.id,'xianfaqiao');assert.equal(result.manifestURL,'/pinned/bridge.json');
  assert.equal(result.options.expectedManifestSHA256,'pinned-sha');assert.equal(result.options.signal,f.signal);assert.equal(f.calls.length,1);
});

test('R3 replay retains its original study and remains review-only',async()=>{
  const replay=route('composition=xianfaqiao&court=garden-r3&review=still');assert.equal(await replay.load(),replay.owners.r3);assert.equal(replay.calls[0].kind,'r3');
  const ordinary=route('composition=xianfaqiao&court=garden-r3');await assert.rejects(ordinary.load(),/also require review/);assert.equal(ordinary.calls.length,0);
});
