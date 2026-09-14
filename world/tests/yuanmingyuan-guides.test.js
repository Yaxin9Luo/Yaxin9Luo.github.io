import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createMuseumGuidePool} from '../src/yuanmingyuan/guide-pool.js';
import {companionManifest} from '../src/companion-manifest.js';
import {companionAssetDiagnostics} from '../src/companion-assets.js';
import {guideSign} from '../src/yuanmingyuan/museum-content.js';
import {createMuseumGuides} from '../src/yuanmingyuan/museum-guides.js';
import {Group} from 'three';

let bytes;
before(async()=>{
  const data=await readFile(new URL('../public'+companionManifest.elizabeth.url,import.meta.url));
  bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  globalThis.OffscreenCanvas=class {
    constructor(width,height){this.width=width;this.height=height;this.text=[];}
    getContext(){return {fillRect:()=>{this.text=[];},fillText:(text,x,y)=>this.text.push({text,x,y}),measureText:text=>({width:[...text].length*70})};}
  };
});
const load=()=>new GLTFLoader().parseAsync(bytes,'');
const fetchImpl=async url=>{assert.equal(url,companionManifest.elizabeth.url);return new Response(bytes);};
function trackResources(template){
  const resources=new Set(),counts=new Map();template.scene.traverse(object=>{
    if(object.geometry)resources.add(object.geometry);
    if(object.skeleton)resources.add(object.skeleton);
    for(const m of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}
  });
  for(const value of resources){const dispose=value.dispose.bind(value);counts.set(value,0);value.dispose=()=>{counts.set(value,counts.get(value)+1);dispose();};}
  return counts;
}

test('real Elizabeth clones share original meshes but keep bones, animation and bilingual signs independent',async()=>{
  const originalKinds=companionAssetDiagnostics().decodedKinds,pool=await createMuseumGuidePool({fetchImpl});
  const a=pool.create({entryId:'haiyantang',id:'west'}),b=pool.create({entryId:'yuanyingguan',id:'east',lang:'en'});
  assert.equal(pool.count,2);assert.equal(a.entryId,'haiyantang');
  const af=a.model.getObjectByName('SignFace'),bf=b.model.getObjectByName('SignFace');
  assert.equal(af.geometry,bf.geometry);assert.notEqual(af.material,bf.material);assert.notEqual(af.material.map,bf.material.map);
  assert.notEqual(a.model.getObjectByName('FootL'),b.model.getObjectByName('FootL'));
  const text=af.material.map.image.text.map(value=>value.text).join(' '),sign=guideSign('haiyantang');
  // Each fillText is one wrapped line. Chinese line breaks do not insert a
  // linguistic space; verify every character in order across those lines.
  assert.ok(text.replace(/\s+/g,'').includes(sign.zh.replace(/\s+/g,'')));assert.ok(text.includes(sign.en));
  a.setAction('walk');a.update(.24,{speed:.6});assert.equal(b.time,0);assert.equal(b.action,'idle');assert.ok(a.time>0);
  a.setLanguage('en');assert.equal(af.material.map.image.text.map(value=>value.text).join(' '),text,'both languages remain on the board');
  a.dispose();assert.equal(pool.count,1);b.update(.2);assert.ok(b.time>0);pool.dispose();pool.dispose();
  assert.equal(pool.count,0);assert.deepEqual(companionAssetDiagnostics().decodedKinds,originalKinds,'no original is retained in the portfolio cache');
  assert.throws(()=>pool.create({entryId:'haiyantang'}),/released/);
});

test('leaving the museum releases actor resources before the one original template, exactly once',async()=>{
  const template=await load(),counts=trackResources(template),controller=new AbortController();
  const pool=await createMuseumGuidePool({fetchImpl,parse:async()=>template,signal:controller.signal});
  const a=pool.create({entryId:'haiyantang'}),b=pool.create({entryId:'dashuifa'}),face=a.model.getObjectByName('SignFace');let signDisposed=0;
  face.material.map.addEventListener('dispose',()=>{signDisposed++;});
  a.dispose();assert.equal(signDisposed,1);assert.ok([...counts.values()].every(value=>value===0));
  controller.abort();assert.equal(pool.count,0);assert.ok([...counts.values()].every(value=>value===1));
  b.dispose();pool.dispose();assert.ok([...counts.values()].every(value=>value===1));
});

test('cancelling during decode rejects the result and disposes the late original',async()=>{
  const template=await load(),counts=trackResources(template),controller=new AbortController();
  let finish,entered;const parsing=new Promise(resolve=>{entered=resolve;}),pending=createMuseumGuidePool({fetchImpl,signal:controller.signal,parse:()=>{entered();return new Promise(resolve=>{finish=resolve;});}});
  await parsing;controller.abort();finish(template);await assert.rejects(pending,{name:'AbortError'});
  assert.ok([...counts.values()].every(value=>value===1));
});

test('failed requests and unknown exhibit IDs create no actors',async()=>{
  await assert.rejects(createMuseumGuidePool({fetchImpl:async()=>new Response('',{status:503})}),/503/);
  const controller=new AbortController();controller.abort();let requested=false;
  await assert.rejects(createMuseumGuidePool({signal:controller.signal,fetchImpl:async()=>{requested=true;}}),{name:'AbortError'});assert.equal(requested,false);
  const pool=await createMuseumGuidePool({fetchImpl});assert.throws(()=>pool.create({entryId:'not-an-exhibit'}),/existing museum exhibit/);assert.equal(pool.count,0);pool.dispose();
});

test('a museum sign raises before opening its exhibit, pauses with the reader and resumes its local patrol',async()=>{
  const pool=await createMuseumGuidePool({fetchImpl}),root=new Group(),opened=[];
  const guides=createMuseumGuides({pool,root,heightAt:()=>1,waterLevel:0,placements:[{id:'haiyan-west',entryId:'haiyantang',position:{x:0,z:0},heading:0,waypoints:[{x:0,z:5},{x:5,z:5},{x:5,z:0}]}],onInspect:value=>{opened.push(value);guides.setPaused(true);}});
  const visitor={x:0,y:1,z:5};assert.equal(guides.nearest(visitor).label.zh,'海晏堂');assert.equal(guides.nearest(visitor).entryId,'haiyantang');
  assert.equal(guides.interact('haiyan-west',{playerPosition:visitor}),true);assert.equal(opened.length,0);
  for(let i=0;i<45;i++)guides.update(1/30,{playerPosition:visitor});
  assert.deepEqual(opened,[{id:'haiyan-west',entryId:'haiyantang'}]);
  const paused=guides.snapshot();assert.equal(paused.paused,true);assert.equal(paused.actors[0].state,'hold');
  assert.deepEqual(paused.actors[0].sign,guideSign('haiyantang'));guides.update(1);assert.equal(guides.snapshot().activeTime,paused.activeTime);
  guides.setPaused(false);for(let i=0;i<330;i++)guides.update(1/30,{playerPosition:visitor});
  const state=guides.snapshot().actors[0];assert.ok(state.valid);assert.ok(state.distance>.3);assert.equal(opened.length,1);assert.ok(state.position.x>=-2&&state.position.x<=7&&state.position.z>=-2&&state.position.z<=7);
  guides.dispose();pool.dispose();assert.equal(root.children.length,0);
});

test('a guide retains its own exhibit when there is no clearance for the sign animation',async()=>{
  const pool=await createMuseumGuidePool({fetchImpl}),root=new Group(),visitor={x:2.7,y:1,z:0};
  const blocked={id:'visitor',bottom:1,top:4.28,planes:[[1,0,0,3.35],[-1,0,0,-2.05],[0,0,1,.65],[0,0,-1,.65],[0,1,0,4.28],[0,-1,0,-1]]};
  const guides=createMuseumGuides({pool,root,heightAt:()=>1,waterLevel:0,getWorld:()=>({heightAt:()=>1,waterLevel:0,colliders:[],visitorCollider:blocked}),placements:[{id:'pavilion-guide',entryId:'haiyue-main-pavilion',position:{x:0,z:0},heading:0}]});
  try{
    const nearest=guides.nearest(visitor);assert.equal(nearest.entryId,'haiyue-main-pavilion');
    assert.equal(guides.interact(nearest.id,{playerPosition:visitor}),false,'the wide board cannot rotate through the visitor');
    assert.equal(guides.nearest(visitor).entryId,'haiyue-main-pavilion','the reader fallback must use this exhibit, not the site overview');
    assert.equal(guides.snapshot().actors[0].interactionCount,0);
  }finally{guides.dispose();pool.dispose();}
});

test('reduced motion exposes the sign without waiting for animation and still opens only the assigned exhibit',async()=>{
  const pool=await createMuseumGuidePool({fetchImpl}),root=new Group(),opened=[];
  const guides=createMuseumGuides({pool,root,heightAt:()=>1,waterLevel:0,placements:[{id:'yuanying',entryId:'yuanyingguan',position:{x:0,z:0}}],onInspect:value=>opened.push(value)});
  guides.update(0,{reducedMotion:true});assert.ok(guides.interact('yuanying',{playerPosition:{x:0,y:1,z:5}}));
  assert.deepEqual(opened,[{id:'yuanying',entryId:'yuanyingguan'}]);assert.equal(guides.snapshot().actors[0].state,'reduced-sign');
  guides.dispose();pool.dispose();
});
