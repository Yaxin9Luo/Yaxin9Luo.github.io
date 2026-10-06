import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {basename,dirname} from 'node:path';
import {Interface} from '../src/ui.js';
import config from '../vite.config.js';

// Exercise actual Interface HTML, translation and delegated click handling.
// Browser layout, navigation and WebGL acceptance remain separate checks.
function page(t,{lang='en',search=''}={}){
  const saved=Object.fromEntries(['document','window','location','history','localStorage','matchMedia','Audio','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
  const nodes=new Map(),listeners=new Map();
  function element(key){
    if(nodes.has(key))return nodes.get(key);
    const attrs=new Map(),classes=new Set();
    const node={dataset:{},style:{setProperty(){}},textContent:'',innerHTML:'',hidden:false,scrollTop:0,isConnected:true,
      classList:{add(v){classes.add(v);},remove(v){classes.delete(v);},contains(v){return classes.has(v);},toggle(v,force){const on=force??!classes.has(v);on?classes.add(v):classes.delete(v);return on;}},
      setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k)??null;},hasAttribute(k){return attrs.has(k);},
      querySelector(s){return element(key+' '+s);},querySelectorAll(){return[];},addEventListener(){},focus(){document.activeElement=node;},
      replaceChildren(){},append(){},appendChild(){},prepend(){},insertAdjacentHTML(){},remove(){},contains(){return false;},getBoundingClientRect(){return {left:0,top:0,right:0,bottom:0,width:0,height:0};},
      closest(s){return s==='[data-action]'&&attrs.has('data-action')?node:null;}};
    nodes.set(key,node);return node;
  }
  // The museum entry is a top-bar capsule: a link holding a line icon and a translatable label.
  const root=element('root'),entry=element('entry'),label=element('label');let html='';
  Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{
    html=String(value);
    const link=html.match(/<a\b([^>]*\bdata-museum-entry\b[^>]*)>([\s\S]*?)<\/a>/);
    assert.ok(link,'rendered top bar contains the Yuanmingyuan link');
    for(const m of link[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))entry.setAttribute(m[1],m[2]??'');
    const span=link[2].match(/^<svg\b[\s\S]*<\/svg><span data-i18n="(\w+)">([^<]*)<\/span>$/);
    assert.ok(span,'the link shows a line icon and a translatable label');
    label.dataset.i18n=span[1];label.textContent=span[2];
  }});
  // The landing's interactive canvas layer is covered by landing.test.js and browser checks; keep it unmounted here.
  root.querySelector=s=>s==='a[data-museum-entry]'?entry:s==='.landing'?null:element(s);
  root.querySelectorAll=s=>s==='[data-i18n]'?[label]:s==='a[data-museum-entry]'?[entry]:[];
  root.addEventListener=(type,listener)=>listeners.set(type,listener);
  const storage=new Map([['yaxin.grimoire.preferences',JSON.stringify({lang})]]);
  // The CV Tour guide mounts with the Interface; it only needs inert media, observer and frame stubs here.
  const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  Object.defineProperties(globalThis,{
    document:{configurable:true,writable:true,value:{documentElement:element('html'),activeElement:null,hidden:false,addEventListener(){},createElement:tag=>element(`new ${tag} ${nodes.size}`)}},
    window:{configurable:true,writable:true,value:{addEventListener(){},matchMedia:media}},
    Audio:{configurable:true,writable:true,value:class{play(){return Promise.resolve();}pause(){}addEventListener(){}}},
    ResizeObserver:{configurable:true,writable:true,value:class{observe(){}unobserve(){}disconnect(){}}},
    requestAnimationFrame:{configurable:true,writable:true,value:()=>0},
    cancelAnimationFrame:{configurable:true,writable:true,value:()=>{}},
    location:{configurable:true,writable:true,value:new URL('https://portfolio.example/'+search)},
    history:{configurable:true,writable:true,value:{state:{},replaceState(){},pushState(){}}},
    localStorage:{configurable:true,writable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}},
    matchMedia:{configurable:true,writable:true,value:media},
  });
  const ui=new Interface(root);
  return {ui,entry,label,listeners,get html(){return html;}};
}
function destination(entry){
  const url=new URL(entry.getAttribute('href'),'https://portfolio.example/');
  assert.equal(url.origin,'https://portfolio.example');assert.equal(url.pathname,'/yuanmingyuan.html');
  assert.deepEqual([...url.searchParams.keys()].sort(),['composition','court','lang','planting','yangquelong']);
  assert.equal(url.searchParams.get('composition'),'xianfaqiao');assert.equal(url.searchParams.get('planting'),'western');assert.equal(url.searchParams.get('court'),'garden-r4');
  assert.equal(url.searchParams.get('yangquelong'),'refined-r1');
  assert.equal(url.hash,'');return url;
}
test('cold welcome links to all three Western stations, R4 court and outer planting in the same tab',t=>{
  const {ui,entry,label,html}=page(t);
  assert.equal(label.textContent,'Yuanmingyuan');assert.equal(destination(entry).searchParams.get('lang'),'en');
  assert.equal(entry.getAttribute('target'),null);assert.equal(entry.hasAttribute('data-action'),false);
  assert.match(html,/<header class="topbar">[\s\S]*<span class="ec-explore"[^>]*>[\s\S]*data-museum-entry[\s\S]*<\/header>/,'a capsule in the top bar, next to 3D Academy and World map');
  const footer=html.slice(html.indexOf('<footer class="intro-footer'),html.indexOf('</footer>'));
  assert.ok(footer.length>0&&!footer.includes('data-museum-entry'),'the status bar no longer carries the entry');
  assert.equal(ui.game,null);assert.equal(ui.ready,false);assert.equal(ui.pendingStart,undefined);
});
test('both language switches preserve all three Western stations and the ordinary visitor URL',t=>{
  const {ui,entry,label}=page(t);
  for(const [lang,text] of [['zh','圆明园'],['en','Yuanmingyuan']]){
    ui.options.lang=lang;ui.applyLanguage();
    assert.equal(label.textContent,text);assert.equal(destination(entry).searchParams.get('lang'),lang);
    assert.equal(destination(entry).searchParams.get('court'),'garden-r4');assert.equal(destination(entry).searchParams.has('review'),false);
  }
});
test('a supported URL language wins over the saved preference',t=>{
  const {ui,entry,label}=page(t,{lang:'en',search:'?lang=zh'});
  assert.equal(ui.options.lang,'zh');assert.equal(destination(entry).searchParams.get('lang'),'zh');assert.equal(label.textContent,'圆明园');
});
test('invalid URL language retains a saved supported language',t=>{
  const {ui,entry}=page(t,{lang:'zh',search:'?lang=%22%3Ebad'});
  assert.equal(ui.options.lang,'zh');assert.equal(destination(entry).searchParams.get('lang'),'zh');
});
test('actual delegated click leaves garden navigation native without starting the academy',t=>{
  const {ui,entry,listeners}=page(t);let prevented=0,starts=0,actions=0;
  ui.setLoadingController({start(){starts++;}});ui.action=()=>{actions++;};
  listeners.get('click')({target:entry,preventDefault(){prevented++;}});
  assert.equal(prevented,0);assert.equal(actions,0);assert.equal(starts,0);assert.equal(ui.pendingStart,undefined);assert.equal(ui.game,null);
});
test('build inputs include museum, reader and Yuanmingyuan studio while retaining every old entry',()=>{
  const input=config.build.rolldownOptions.input;
  const expected={main:'index.html',blog:'index.html',studio:'asset-studio.html',review:'quality-review.html',exhibit:'exhibit-studio.html',companions:'companion-studio.html',herbarium:'herbarium-studio.html',fauna:'fauna-studio.html',museum:'yuanmingyuan.html',museumReader:'museum-reader.html',museumStudio:'yuanmingyuan-studio.html'};
  assert.deepEqual(Object.fromEntries(Object.entries(input).map(([k,v])=>[k,basename(v)])),expected);
  for(const file of Object.values(input))assert.ok(existsSync(file),file);
  const html=readFileSync(input.museum,'utf8'),fallback=readFileSync(input.museumReader,'utf8'),studio=readFileSync(input.museumStudio,'utf8');
  assert.match(html,/src="\/src\/yuanmingyuan\/museum-scene\.js"/);
  assert.match(html,/href="\/museum-reader\.html"/);
  // The museum and its exhibit directory are public; review studios stay out of search.
  for(const page of [html,fallback])assert.doesNotMatch(page,/noindex|尚未公开|预览/);
  assert.match(studio,/noindex/);
  assert.match(fallback,/src="\/src\/yuanmingyuan\/reader-preview\.js"/);
  assert.match(studio,/src="\/src\/yuanmingyuan\/studio\.js"/);
  assert.equal(dirname(input.main),dirname(input.museum));assert.equal(dirname(input.main),dirname(input.museumReader));assert.equal(dirname(input.main),dirname(input.museumStudio));
});
