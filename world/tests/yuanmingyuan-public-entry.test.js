import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {basename,dirname} from 'node:path';
import {Interface} from '../src/ui.js';
import config from '../vite.config.js';

// Exercise actual Interface HTML, translation and delegated click handling.
// Browser layout, navigation and WebGL acceptance remain separate checks.
function page(t,{lang='en',search=''}={}){
  const saved=Object.fromEntries(['document','window','location','history','localStorage','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
  const nodes=new Map(),listeners=new Map();
  function element(key){
    if(nodes.has(key))return nodes.get(key);
    const attrs=new Map(),classes=new Set();
    const node={dataset:{},style:{setProperty(){}},textContent:'',innerHTML:'',hidden:false,scrollTop:0,isConnected:true,
      classList:{add(v){classes.add(v);},remove(v){classes.delete(v);},contains(v){return classes.has(v);},toggle(v,force){const on=force??!classes.has(v);on?classes.add(v):classes.delete(v);return on;}},
      setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k)??null;},hasAttribute(k){return attrs.has(k);},
      querySelector(s){return element(key+' '+s);},querySelectorAll(){return[];},addEventListener(){},focus(){document.activeElement=node;},
      closest(s){return s==='[data-action]'&&attrs.has('data-action')?node:null;}};
    nodes.set(key,node);return node;
  }
  const root=element('root'),entry=element('entry');let html='';
  Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{
    html=String(value);
    const link=html.match(/<a\b([^>]*\bdata-museum-entry\b[^>]*)>([^<]*)<\/a>/);
    assert.ok(link,'rendered welcome contains the garden link');
    for(const m of link[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))entry.setAttribute(m[1],m[2]??'');
    entry.dataset.i18n=entry.getAttribute('data-i18n');entry.textContent=link[2];
  }});
  root.querySelector=s=>s==='a[data-museum-entry]'?entry:element(s);
  root.querySelectorAll=s=>['[data-i18n]','a[data-museum-entry]'].includes(s)?[entry]:[];
  root.addEventListener=(type,listener)=>listeners.set(type,listener);
  const storage=new Map([['yaxin.grimoire.preferences',JSON.stringify({lang})]]);
  Object.defineProperties(globalThis,{
    document:{configurable:true,writable:true,value:{documentElement:element('html'),activeElement:null}},
    window:{configurable:true,writable:true,value:{addEventListener(){}}},
    location:{configurable:true,writable:true,value:new URL('https://portfolio.example/'+search)},
    history:{configurable:true,writable:true,value:{state:{},replaceState(){},pushState(){}}},
    localStorage:{configurable:true,writable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}},
    matchMedia:{configurable:true,writable:true,value:()=>({matches:false})},
  });
  const ui=new Interface(root);
  return {ui,entry,listeners,get html(){return html;}};
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
  const {ui,entry,html}=page(t);
  assert.equal(entry.textContent,'Yuanmingyuan');assert.equal(destination(entry).searchParams.get('lang'),'en');
  assert.equal(entry.getAttribute('target'),null);assert.equal(entry.hasAttribute('data-action'),false);
  assert.match(html,/<div class="quick-links">[\s\S]*data-museum-entry[\s\S]*<\/div><p class="no-gate"/);
  assert.equal(ui.game,null);assert.equal(ui.ready,false);assert.equal(ui.pendingStart,undefined);
});
test('both language switches preserve all three Western stations and the ordinary visitor URL',t=>{
  const {ui,entry}=page(t);
  for(const [lang,label] of [['zh','圆明园'],['en','Yuanmingyuan']]){
    ui.options.lang=lang;ui.applyLanguage();
    assert.equal(entry.textContent,label);assert.equal(destination(entry).searchParams.get('lang'),lang);
    assert.equal(destination(entry).searchParams.get('court'),'garden-r4');assert.equal(destination(entry).searchParams.has('review'),false);
  }
});
test('a supported URL language wins over the saved preference',t=>{
  const {ui,entry}=page(t,{lang:'en',search:'?lang=zh'});
  assert.equal(ui.options.lang,'zh');assert.equal(destination(entry).searchParams.get('lang'),'zh');assert.equal(entry.textContent,'圆明园');
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
  const expected={main:'index.html',studio:'asset-studio.html',review:'quality-review.html',exhibit:'exhibit-studio.html',companions:'companion-studio.html',herbarium:'herbarium-studio.html',fauna:'fauna-studio.html',museum:'yuanmingyuan.html',museumReader:'museum-reader.html',museumStudio:'yuanmingyuan-studio.html'};
  assert.deepEqual(Object.fromEntries(Object.entries(input).map(([k,v])=>[k,basename(v)])),expected);
  for(const file of Object.values(input))assert.ok(existsSync(file),file);
  const html=readFileSync(input.museum,'utf8'),fallback=readFileSync(input.museumReader,'utf8'),studio=readFileSync(input.museumStudio,'utf8');
  assert.match(html,/src="\/src\/yuanmingyuan\/museum-scene\.js"/);
  assert.match(html,/href="\/museum-reader\.html"/);assert.match(html,/尚未公开/);
  assert.match(fallback,/src="\/src\/yuanmingyuan\/reader-preview\.js"/);
  assert.match(studio,/src="\/src\/yuanmingyuan\/studio\.js"/);
  assert.equal(dirname(input.main),dirname(input.museum));assert.equal(dirname(input.main),dirname(input.museumReader));assert.equal(dirname(input.main),dirname(input.museumStudio));
});
