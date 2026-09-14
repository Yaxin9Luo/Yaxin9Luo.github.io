import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the live page's loader, without constructing architecture or GPU resources.
const page=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const start=page.indexOf('async function loadSceneBuilding('),end=page.indexOf('\nasync function prepareMuseumGround(',start);
assert.ok(start>=0&&end>start);
function harness(search,{cancelDuringPreparation=false}={}){
  const calls=[],controller=new AbortController(),owner={group:{name:'full-material-candidate'}};
  const context={query:new URLSearchParams(search),loadMuseumArchive:async(...args)=>{calls.push(['archive',...args]);return 'archive';},loadMuseumModel:async(...args)=>{calls.push(['model',...args]);return 'model';},
    injectedImport:async id=>{
      assert.equal(id,'./studio-assets.js');
      return {getStudioAsset:id=>({async loadFactory(options){
        calls.push(['prepare',id,options]);if(cancelDuringPreparation)controller.abort();
        return ()=>{calls.push(['construct']);return owner;};
      }})};
    }};
  vm.createContext(context);vm.runInContext(page.slice(start,end).replace('import(', 'injectedImport(')+';this.load=loadSceneBuilding;',context);
  return {calls,owner,signal:controller.signal,load:context.load};
}
test('a reviewed material candidate replaces both the resident and visited building route',async()=>{
  for(const options of [{},{manifestURL:'/old/manifest.json',expectedManifestSHA256:'previous'}]){
    const h=harness('review=still&materials=stone-r4');assert.equal(await h.load('fangwaiguan',{...options,signal:h.signal}),h.owner);
    assert.deepEqual(h.calls.map(call=>call[0]),['prepare','construct']);assert.equal(h.calls[0][2].materialVariant,'stone-r4');
  }
});
test('normal browsing and unrelated buildings preserve the archived source',async()=>{
  for(const [search,id] of [['materials=stone-r4','fangwaiguan'],['review=still','fangwaiguan'],['review=still&materials=stone-r4','xianfashan']]){
    const h=harness(search);await h.load(id,{manifestURL:'/approved/manifest.json',expectedManifestSHA256:'approved',signal:h.signal});
    assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'archive');assert.equal(h.calls[0][3].expectedManifestSHA256,'approved');
  }
});
test('cancellation and invalid candidates cannot construct or silently fall back to old finishes',async()=>{
  const late=harness('review=still&materials=stone-r4',{cancelDuringPreparation:true});
  await assert.rejects(late.load('fangwaiguan',{signal:late.signal}),{name:'AbortError'});assert.deepEqual(late.calls.map(call=>call[0]),['prepare']);
  const invalid=harness('review=still&materials=unknown');await assert.rejects(invalid.load('fangwaiguan'),/Unknown/);assert.equal(invalid.calls.length,0);
});
